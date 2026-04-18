/**
 * Runtime for handling per-chunk enhancement progress updates.
 */

export async function handleChunkProcessedRuntime({
	message,
	loadChunkingSystem,
	findContentArea,
	browserRef,
	chunkBehaviorConfig,
	onChunkModelInfo,
	getLastChunkModelInfo,
	sanitizeHTML,
	windowRef = window,
	buildChunkBanner,
	showWorkInProgressBanner,
	cancelEnhanceButton,
	loadDomIntegrationModule,
	shouldBannersBeHidden,
	handleToggleAllChunks,
	handleDeleteAllChunks,
	confirmFn,
	extractNovelContext,
	addToNovelLibrary,
	debugLog = () => {},
	debugError = () => {},
	enableCopyOnContentArea,
	documentRef = document,
}) {
	const chunking = await loadChunkingSystem?.();
	if (!chunking) return;

	const contentArea = findContentArea?.();
	if (!contentArea) return;

	const settingsData = await browserRef.storage.local.get([
		"wordCountThreshold",
	]);
	const wordCountThreshold =
		settingsData.wordCountThreshold !== undefined
			? settingsData.wordCountThreshold
			: chunkBehaviorConfig.wordCountThreshold;

	const chunkIndex = message.chunkIndex;
	const totalChunks = message.totalChunks;
	const chunkResult = message.result;
	const chunkModelInfo = chunkResult?.modelInfo || null;
	if (chunkModelInfo) {
		onChunkModelInfo?.(chunkModelInfo);
	}

	const chunkedContainer = documentRef.getElementById(
		"gemini-chunked-content",
	);
	if (!chunkedContainer) return;

	const chunkWrapper = chunkedContainer.querySelector(
		`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
	);
	if (!chunkWrapper) {
		debugLog(
			`[handleChunkProcessed] WARNING: No DOM wrapper for chunk ${chunkIndex}/${totalChunks}. ` +
				"Background may have split into more chunks than content script expected.",
		);
		if (message.isComplete) {
			const completedInDom = documentRef.querySelectorAll(
				'.gemini-chunk-content[data-chunk-enhanced="true"]',
			).length;
			showWorkInProgressBanner?.(
				completedInDom,
				totalChunks,
				"complete",
				null,
			);
			if (cancelEnhanceButton) {
				cancelEnhanceButton.style.display = "none";
			}
			documentRef
				.querySelectorAll(".gemini-enhance-btn")
				.forEach((btn) => {
					btn.textContent = "≡ƒöä Re-enhance with Gemini";
					btn.disabled = false;
					btn.classList.remove("loading");
				});
		}
		return;
	}

	if (chunkResult && chunkResult.enhancedContent) {
		const chunkContent = chunkWrapper.querySelector(
			".gemini-chunk-content",
		);
		if (chunkContent) {
			const sanitizedContent = sanitizeHTML(chunkResult.enhancedContent);
			chunkContent.innerHTML = sanitizedContent;
			chunkContent.setAttribute("data-chunk-enhanced", "true");
			chunkContent.setAttribute(
				"data-enhanced-chunk-content",
				sanitizedContent,
			);
		}

		await chunking.cache.saveChunkToCache(
			windowRef.location.href,
			chunkIndex,
			{
				originalContent: chunkResult.originalContent || "",
				enhancedContent: chunkResult.enhancedContent,
				wordCount: chunkResult.wordCount || 0,
				timestamp: Date.now(),
				totalChunks,
				modelInfo: chunkModelInfo,
			},
		);
		const existingBanner = chunkWrapper.querySelector(
			".gemini-chunk-banner",
		);
		if (existingBanner) {
			const chunkContent = chunkWrapper.querySelector(
				".gemini-chunk-content",
			);
			const originalContent =
				chunkContent?.getAttribute("data-original-chunk-content") || "";
			const enhancedContent = chunkContent?.innerHTML || "";
			const originalWords = chunking.core.countWords(originalContent);
			const enhancedWords = chunking.core.countWords(enhancedContent);
			const wordCounts = {
				original: originalWords,
				enhanced: enhancedWords,
			};

			const newBanner = buildChunkBanner(
				chunking,
				chunkIndex,
				totalChunks,
				"completed",
				null,
				null,
				wordCounts,
				wordCountThreshold,
			);
			existingBanner.replaceWith(newBanner);
		}
	}

	const completedChunks = chunkedContainer.querySelectorAll(
		'.gemini-chunk-content[data-chunk-enhanced="true"]',
	).length;

	let wordCounts = null;
	if (chunking?.core?.countWords) {
		const allChunks = chunkedContainer.querySelectorAll(
			".gemini-chunk-content",
		);
		let totalOriginalWords = 0;
		let totalEnhancedWords = 0;

		allChunks.forEach((chunk) => {
			const originalContent =
				chunk.getAttribute("data-original-chunk-content") || "";
			const isEnhanced =
				chunk.getAttribute("data-chunk-enhanced") === "true";
			const content = isEnhanced ? chunk.innerHTML : originalContent;

			totalOriginalWords += chunking.core.countWords(originalContent);
			if (isEnhanced) {
				totalEnhancedWords += chunking.core.countWords(content);
			}
		});

		wordCounts = {
			original: totalOriginalWords,
			enhanced: totalEnhancedWords,
		};
	}

	showWorkInProgressBanner?.(
		completedChunks,
		totalChunks,
		"processing",
		wordCounts,
	);

	if (message.isComplete) {
		showWorkInProgressBanner?.(
			totalChunks,
			totalChunks,
			"complete",
			wordCounts,
		);
		if (cancelEnhanceButton) {
			cancelEnhanceButton.style.display = "none";
		}

		documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
			btn.textContent = "≡ƒöä Re-enhance with Gemini";
			btn.disabled = false;
			btn.classList.remove("loading");
		});

		if (contentArea && chunking?.ui) {
			const domIntegration = await loadDomIntegrationModule?.();
			domIntegration?.ensureMasterBannerRuntime?.({
				documentRef,
				contentArea,
				chunking,
				totalChunks,
				lastChunkModelInfo: getLastChunkModelInfo?.() || chunkModelInfo,
				shouldBannersBeHidden,
				onToggleAll: handleToggleAllChunks,
				onDeleteAll: handleDeleteAllChunks,
				confirmFn,
			});

			const mainSummaryText = documentRef.querySelector(
				".gemini-main-summary-text",
			);
			if (mainSummaryText) {
				mainSummaryText.setAttribute(
					"data-group-end",
					String(totalChunks - 1),
				);
			}
		}

		try {
			const novelContext = extractNovelContext?.();
			await addToNovelLibrary?.(novelContext);
		} catch (libraryError) {
			debugError(
				"Failed to update novel library after batch chunk completion:",
				libraryError,
			);
		}
	}

	if (contentArea) {
		enableCopyOnContentArea?.(contentArea);
	}
}

export default {
	handleChunkProcessedRuntime,
};
