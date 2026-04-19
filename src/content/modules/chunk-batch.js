/**
 * Batch chunk control handlers extracted from content.js.
 */

export function toggleAllChunksRuntime({ documentRef = document, escapeHtml }) {
	const mainBanner = documentRef.querySelector(".gemini-master-banner");
	const toggleBtn = mainBanner?.querySelector(
		".gemini-master-toggle-all-btn",
	);
	if (!toggleBtn) return;

	const isShowingEnhanced =
		toggleBtn.getAttribute("data-showing") !== "original";
	const allChunkContents = documentRef.querySelectorAll(
		".gemini-chunk-content",
	);
	const allChunkToggleBtns = documentRef.querySelectorAll(
		".gemini-chunk-toggle-btn",
	);

	allChunkContents.forEach((chunkContent) => {
		if (chunkContent.getAttribute("data-chunk-enhanced") !== "true") return;

		const originalHtml = chunkContent.getAttribute(
			"data-original-chunk-html",
		);
		const originalContent = chunkContent.getAttribute(
			"data-original-chunk-content",
		);

		if (isShowingEnhanced) {
			chunkContent.setAttribute(
				"data-enhanced-chunk-content",
				chunkContent.innerHTML,
			);
			if (originalHtml) {
				chunkContent.innerHTML = originalHtml;
			} else {
				chunkContent.innerHTML = `<div style="white-space: pre-wrap;">${escapeHtml(originalContent || "")}</div>`;
			}
			return;
		}

		const savedEnhanced = chunkContent.getAttribute(
			"data-enhanced-chunk-content",
		);
		if (savedEnhanced) {
			chunkContent.innerHTML = savedEnhanced;
		}
	});

	allChunkToggleBtns.forEach((btn) => {
		if (isShowingEnhanced) {
			btn.textContent = "✨ Show Enhanced";
			btn.setAttribute("data-showing", "original");
			return;
		}
		btn.textContent = "👁 Show Original";
		btn.setAttribute("data-showing", "enhanced");
	});

	if (isShowingEnhanced) {
		toggleBtn.textContent = "✨ Show All Enhanced";
		toggleBtn.setAttribute("data-showing", "original");
		return;
	}
	toggleBtn.textContent = "👁 Show All Original";
	toggleBtn.setAttribute("data-showing", "enhanced");
}

export async function deleteAllChunksRuntime({
	findContentArea,
	loadChunkingSystem,
	storageManager,
	windowRef = window,
	documentRef = document,
	showStatusMessage,
	onResetCacheFlags,
}) {
	const contentArea = findContentArea();
	if (!contentArea) return;

	const originalHtml = contentArea.getAttribute("data-original-html");
	if (originalHtml) {
		contentArea.innerHTML = originalHtml;
		contentArea.removeAttribute("data-original-html");
		contentArea.removeAttribute("data-original-text");
		contentArea.removeAttribute("data-total-chunks");
	}

	const chunking = await loadChunkingSystem();
	if (chunking) {
		await chunking.cache.deleteAllChunksForUrl(windowRef.location.href);
	}
	if (storageManager) {
		await storageManager.removeEnhancedContent(windowRef.location.href);
	}

	onResetCacheFlags?.();
	showStatusMessage(
		"All enhanced content deleted. Reverted to original.",
		"info",
		3000,
	);

	documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
		btn.textContent = "✨ Enhance with Gemini";
		btn.disabled = false;
	});
}

export async function continueChunkEnhancementRuntime({
	allChunkEls,
	enhancedChunkEls,
	errorBanners,
	documentRef = document,
	cancelEnhanceButton,
	showStatusMessage,
	showWorkInProgressBanner,
	handleReenhanceChunk,
	isEnhancementCancelled,
}) {
	const hasErrorChunks = errorBanners.length > 0;
	const isPartial =
		allChunkEls.length > 0 &&
		enhancedChunkEls.length > 0 &&
		enhancedChunkEls.length < allChunkEls.length;

	if (!isPartial && !(allChunkEls.length > 0 && hasErrorChunks)) {
		return false;
	}

	const remainingIndices = Array.from(allChunkEls)
		.filter((el) => el.getAttribute("data-chunk-enhanced") !== "true")
		.map((el) => parseInt(el.getAttribute("data-chunk-index"), 10))
		.filter((idx) => !isNaN(idx));

	documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
		btn.textContent = "Processing...";
		btn.disabled = true;
		btn.classList.add("loading");
	});

	if (cancelEnhanceButton) {
		cancelEnhanceButton.style.display = "inline-flex";
	}

	const statusMsg =
		hasErrorChunks && enhancedChunkEls.length === 0
			? `Re-generating ${errorBanners.length} failed chunk(s)...`
			: `Continuing enhancement: ${remainingIndices.length} chunk(s) remaining...`;
	showStatusMessage(statusMsg, "info", 3000);
	showWorkInProgressBanner(
		enhancedChunkEls.length,
		allChunkEls.length,
		"processing",
	);

	for (const chunkIndex of remainingIndices) {
		if (isEnhancementCancelled?.()) break;
		await handleReenhanceChunk(chunkIndex);
	}

	if (cancelEnhanceButton) {
		cancelEnhanceButton.style.display = "none";
	}

	documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
		if (btn.disabled || btn.classList.contains("loading")) {
			const allNow = documentRef.querySelectorAll(
				".gemini-chunk-content",
			);
			const doneNow = documentRef.querySelectorAll(
				'.gemini-chunk-content[data-chunk-enhanced="true"]',
			);
			const allCompleted =
				doneNow.length === allNow.length && allNow.length > 0;
			btn.textContent = allCompleted
				? "≡ƒöä Re-enhance with Gemini"
				: "Γ£¿ Enhance with Gemini";
			btn.disabled = false;
			btn.classList.remove("loading");
		}
	});

	return true;
}

export async function prepareFreshEnhancementFromChunkCacheRuntime({
	allChunkEls,
	enhancedChunkEls,
	showStatusMessage,
	loadChunkingSystem,
	windowRef = window,
	onResetChunkCacheFlags,
}) {
	if (
		enhancedChunkEls.length > 0 &&
		enhancedChunkEls.length === allChunkEls.length
	) {
		showStatusMessage(
			"All chunks already enhanced ΓÇö re-enhancing from scratch...",
			"info",
			3000,
		);
	}

	const chunkingForCleanup = await loadChunkingSystem();
	if (chunkingForCleanup?.cache?.deleteAllChunksForUrl) {
		await chunkingForCleanup.cache
			.deleteAllChunksForUrl(windowRef.location.href)
			.catch(() => {});
	}

	onResetChunkCacheFlags?.();
}

export async function prepareRegenerationFromCachedContentRuntime({
	storageManager,
	loadChunkingSystem,
	findContentArea,
	documentRef = document,
	windowRef = window,
	onResetCacheFlags,
}) {
	if (!storageManager) return;

	await storageManager.removeEnhancedContent(windowRef.location.href);

	const chunking = await loadChunkingSystem();
	if (chunking?.cache?.deleteAllChunksForUrl) {
		await chunking.cache.deleteAllChunksForUrl(windowRef.location.href);
	}

	onResetCacheFlags?.();

	documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
		btn.textContent = "Γ£¿ Enhance with Gemini";
	});

	const contentArea = findContentArea?.();
	if (!contentArea) return;

	const chunkedContainer = documentRef.getElementById(
		"gemini-chunked-content",
	);
	if (chunkedContainer) chunkedContainer.remove();

	const masterBanner = contentArea.querySelector(".gemini-master-banner");
	if (masterBanner) masterBanner.remove();

	const placeholderSummary = contentArea.querySelector(
		".gemini-main-summary-group",
	);
	if (placeholderSummary) placeholderSummary.remove();

	const originalHtml = contentArea.getAttribute("data-original-html");
	const originalContent = contentArea.getAttribute("data-original-content");
	const isShowingEnhanced =
		contentArea.getAttribute("data-showing-enhanced") === "true";

	if (!isShowingEnhanced) return;

	if (originalHtml) {
		contentArea.innerHTML = originalHtml;
		contentArea.removeAttribute("data-original-html");
		contentArea.removeAttribute("data-original-text");
		contentArea.removeAttribute("data-total-chunks");
	} else if (originalContent) {
		contentArea.innerHTML = originalContent;
	}

	contentArea.setAttribute("data-showing-enhanced", "false");
	const banner = contentArea.querySelector(".gemini-enhanced-banner");
	if (banner) banner.remove();
}

export async function loadCachedEnhancedContentRuntime({
	storageManager,
	showStatusMessage,
	replaceContentWithEnhancedVersion,
	windowRef = window,
	cancelEnhanceButton,
	onCacheLoaded,
	onCacheMiss,
}) {
	if (!storageManager) return false;

	try {
		const cachedData = await storageManager.loadEnhancedContent(
			windowRef.location.href,
		);
		if (cachedData && cachedData.enhancedContent) {
			showStatusMessage("Loading cached enhanced content...", "info");
			replaceContentWithEnhancedVersion(cachedData);
			onCacheLoaded?.();
			if (cancelEnhanceButton) {
				cancelEnhanceButton.style.display = "none";
			}
			return true;
		}

		showStatusMessage(
			"Cached enhanced content is invalid or missing.",
			"error",
		);
		onCacheMiss?.();
		return false;
	} catch (_err) {
		showStatusMessage("Failed to load cached enhanced content.", "error");
		onCacheMiss?.();
		return false;
	}
}

export async function resolveChunkingInputRuntime({
	chunkingEnabled,
	chunking,
	extractedText,
	contentArea,
	getCleanContentHTML,
	showStatusMessage,
	debugLog = () => {},
	debugError = () => {},
}) {
	let shouldChunk = Boolean(chunkingEnabled && chunking && extractedText);
	let chunks = [];
	let chunkSummaryCount = 2;
	let contentToSend = extractedText;

	if (!shouldChunk) {
		return {
			shouldChunk,
			chunks,
			chunkSummaryCount,
			contentToSend,
		};
	}

	try {
		const chunkConfig = await chunking.config.getChunkConfig();
		const chunkSizeWords = chunkConfig.chunkSizeWords;
		chunkSummaryCount = chunkConfig.chunkSummaryCount;

		const originalHTML =
			contentArea.getAttribute("data-original-html") ||
			getCleanContentHTML(contentArea);
		contentToSend = originalHTML;
		chunks = chunking.core.splitContentByWords(
			originalHTML,
			chunkSizeWords,
		);
		debugLog(
			`[Chunking] Split content into ${chunks.length} chunks (word-based, ${chunkSizeWords} words per chunk)`,
		);
	} catch (splitError) {
		debugError("Failed to split content for chunking:", splitError);
		showStatusMessage(
			"Chunking failed; proceeding without chunking.",
			"warning",
			4000,
		);
		shouldChunk = false;
	}

	if (!chunks || chunks.length === 0) {
		shouldChunk = false;
	}

	return {
		shouldChunk,
		chunks,
		chunkSummaryCount,
		contentToSend,
	};
}

export function cleanupChunkedUiBeforeInitRuntime({
	documentRef = document,
	contentArea,
}) {
	const existingChunkedContainer = documentRef.getElementById(
		"gemini-chunked-content",
	);
	if (existingChunkedContainer) {
		existingChunkedContainer.remove();
	}

	const existingMasterBanner = contentArea.querySelector(
		".gemini-master-banner",
	);
	if (existingMasterBanner) {
		existingMasterBanner.remove();
	}

	const existingPlaceholderGroup = contentArea.parentNode?.querySelector(
		".gemini-main-summary-group",
	);
	if (existingPlaceholderGroup) {
		existingPlaceholderGroup.remove();
	}
}

export async function prepareChunkedViewRuntime({
	contentArea,
	chunks,
	chunkSummaryCount,
	chunking,
	buildChunkBanner,
	stripHtmlTags,
	onSummarizeLong,
	onSummarizeShort,
	shouldBannersBeHidden,
	getCleanContentHTML,
	extractedText,
	showWorkInProgressBanner,
	enableCopyOnContentArea,
	debugLog = () => {},
	debugError = () => {},
	showStatusMessage,
	documentRef = document,
}) {
	const originalHTML =
		contentArea.getAttribute("data-original-html") ||
		getCleanContentHTML(contentArea);
	const originalText =
		contentArea.getAttribute("data-original-text") || extractedText;

	try {
		contentArea.setAttribute("data-original-html", originalHTML);
		contentArea.setAttribute("data-original-text", originalText);
		contentArea.setAttribute("data-total-chunks", chunks.length);

		const chunkedContentContainer = documentRef.createElement("div");
		chunkedContentContainer.id = "gemini-chunked-content";
		chunkedContentContainer.style.width = "100%";

		for (let i = 0; i < chunks.length; i++) {
			const chunkWrapper = documentRef.createElement("div");
			chunkWrapper.className = "gemini-chunk-wrapper";
			chunkWrapper.setAttribute("data-chunk-index", i);

			const initialStatus = i === 0 ? "processing" : "pending";
			const banner = buildChunkBanner(
				chunking,
				i,
				chunks.length,
				initialStatus,
			);
			chunkWrapper.appendChild(banner);

			const chunkContent = documentRef.createElement("div");
			chunkContent.className = "gemini-chunk-content";
			chunkContent.setAttribute("data-chunk-index", i);
			chunkContent.setAttribute(
				"data-original-chunk-html",
				chunks[i].content,
			);
			chunkContent.setAttribute(
				"data-original-chunk-content",
				stripHtmlTags(chunks[i].content),
			);
			chunkContent.innerHTML = chunks[i].content;
			chunkWrapper.appendChild(chunkContent);

			chunkedContentContainer.appendChild(chunkWrapper);
		}

		contentArea.innerHTML = "";
		contentArea.appendChild(chunkedContentContainer);

		const chunkWrappers = Array.from(
			chunkedContentContainer.querySelectorAll(".gemini-chunk-wrapper"),
		);
		if (chunking?.summaryUI) {
			documentRef
				.querySelectorAll(".gemini-main-summary-group")
				.forEach((el) => el.remove());

			const newMainSummaryGroup =
				chunking.summaryUI.createMainSummaryGroup(
					chunks.length,
					onSummarizeLong,
					onSummarizeShort,
				);
			if (shouldBannersBeHidden()) {
				newMainSummaryGroup.style.display = "none";
			}
			contentArea.insertBefore(
				newMainSummaryGroup,
				chunkedContentContainer,
			);

			if (chunks.length > 1) {
				chunking.summaryUI.insertSummaryGroups(
					chunkedContentContainer,
					chunkWrappers,
					chunkSummaryCount,
					onSummarizeLong,
					onSummarizeShort,
				);
			}
		}

		if (shouldBannersBeHidden()) {
			const chunkBanners = chunkedContentContainer.querySelectorAll(
				".gemini-chunk-banner",
			);
			chunkBanners.forEach((banner) => {
				banner.style.display = "none";
			});
		}

		debugLog(
			`Prepared ${chunks.length} chunks for inline replacement with preserved HTML`,
		);
		showWorkInProgressBanner(0, chunks.length);
		enableCopyOnContentArea(contentArea);
		return true;
	} catch (prepError) {
		debugError("Failed to prepare chunked view:", prepError);
		contentArea.innerHTML = originalHTML;
		contentArea.removeAttribute("data-original-html");
		contentArea.removeAttribute("data-original-text");
		contentArea.removeAttribute("data-total-chunks");
		showStatusMessage(
			"Could not prepare chunked content. Proceeding without chunking.",
			"warning",
			4000,
		);
		return false;
	}
}

export function handleEnhancementCancelledRuntime({
	documentRef = document,
	cancelEnhanceButton,
	debugLog = () => {},
}) {
	debugLog("Enhancement cancelled; ignoring response");
	const wipBanner = documentRef.querySelector(".gemini-wip-banner");
	if (wipBanner) {
		wipBanner.remove();
	}

	const cancelButton = documentRef.querySelector(".gemini-enhance-btn");
	if (cancelButton) {
		cancelButton.textContent = "Γ£¿ Enhance with Gemini";
		cancelButton.disabled = false;
		cancelButton.classList.remove("loading");
	}

	if (cancelEnhanceButton) {
		cancelEnhanceButton.style.display = "none";
	}
}

export async function handleEnhancementResponseRuntime({
	response,
	documentRef = document,
	showWorkInProgressBanner,
	replaceContentWithEnhancedVersion,
	loadChunkingSystem,
	chunks,
	handleChunkProcessed,
	extractedContentText,
	showStatusMessage,
	browserRef = browser,
	consoleWarn = console.warn,
}) {
	if (response && response.success) {
		if (response.result && response.result.enhancedContent) {
			const isChunkedUiActive = Boolean(
				documentRef.getElementById("gemini-chunked-content"),
			);
			if (isChunkedUiActive) {
				const chunking = await loadChunkingSystem?.();
				const totalChunks = chunks?.length || 1;
				const wordCount = chunking?.core?.countWords
					? chunking.core.countWords(response.result.enhancedContent)
					: 0;
				await handleChunkProcessed?.({
					chunkIndex: 0,
					totalChunks,
					result: {
						originalContent: extractedContentText,
						enhancedContent: response.result.enhancedContent,
						wordCount,
					},
					isComplete: true,
				});
			} else {
				showWorkInProgressBanner?.(1, 1, "complete");
				replaceContentWithEnhancedVersion?.(response.result);
			}
		}
		return;
	}

	const errorMessage = response?.error || "Unknown error";
	if (response?.needsApiKey || errorMessage.includes("API key is missing")) {
		showStatusMessage?.(
			"ΓÜá∩╕Å API key is missing. Please configure it in the extension popup.",
			"error",
		);
		try {
			await browserRef.runtime.sendMessage({ action: "openPopup" });
		} catch (popupError) {
			consoleWarn("Could not open popup automatically:", popupError);
			showStatusMessage?.(
				"ΓÜá∩╕Å API key is missing. Please click the extension icon to configure it.",
				"error",
				10000,
			);
		}
		return;
	}

	showStatusMessage?.(
		"Error processing with Gemini: " + errorMessage,
		"error",
	);
}

export function resetEnhanceButtonsOnErrorRuntime({
	documentRef = document,
	buttonText = "Γ£¿ Enhance with Gemini",
}) {
	documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
		if (btn.disabled || btn.classList.contains("loading")) {
			btn.textContent = buttonText;
			btn.disabled = false;
			btn.classList.remove("loading");
		}
	});
}

export async function prepareEnhancementStartupRuntime({
	documentRef = document,
	cancelEnhanceButton,
	showStatusMessage,
	wakeUpBackgroundWorker,
	browserRef = browser,
	loadChunkingSystem,
	setFormattingOptions,
	debugLog = () => {},
}) {
	documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
		btn.textContent = "Waking up AI...";
		btn.disabled = true;
	});
	if (cancelEnhanceButton) {
		cancelEnhanceButton.style.display = "inline-flex";
	}
	showStatusMessage("Waking up AI service...", "info");

	const isReady = await wakeUpBackgroundWorker?.();
	if (!isReady) {
		throw new Error(
			"Background service is not responding. Please try again.",
		);
	}

	documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
		btn.textContent = "Processing...";
	});
	showStatusMessage("Processing content with Gemini AI...", "info");

	const settings = await browserRef.storage.local.get([
		"chunkingEnabled",
		"chunkSizeWords",
		"chunkSummaryCount",
		"useEmoji",
		"formatGameStats",
		"centerSceneHeadings",
	]);
	const chunkingEnabled = settings.chunkingEnabled !== false;
	const useEmoji = settings.useEmoji === true;
	setFormattingOptions?.({
		useEmoji,
		formatGameStats: settings.formatGameStats !== false,
		centerSceneHeadings: settings.centerSceneHeadings !== false,
	});

	const chunking = chunkingEnabled ? await loadChunkingSystem?.() : null;
	if (chunkingEnabled && !chunking) {
		showStatusMessage(
			"Chunking system unavailable. Proceeding without chunking.",
			"warning",
			3000,
		);
	}

	debugLog(
		`Enhancement startup prepared (chunkingEnabled=${chunkingEnabled}, useEmoji=${useEmoji})`,
	);

	return {
		settings,
		chunkingEnabled,
		chunking,
		useEmoji,
	};
}

export async function requestEnhancementProcessingRuntime({
	novelLibrary,
	locationHref,
	debugLog = () => {},
	buildCombinedPrompt,
	shouldChunk,
	showWorkInProgressBanner,
	sendMessageWithRetry,
	extractedTitle,
	contentToSend,
	useEmoji,
}) {
	let novelCustomPrompt = "";
	if (novelLibrary) {
		try {
			const novel = await novelLibrary.getNovelByUrl(locationHref);
			if (novel && novel.customPrompt) {
				novelCustomPrompt = novel.customPrompt;
				debugLog(`Using novel-specific prompt for: ${novel.title}`);
			}
		} catch (err) {
			debugLog("Could not get novel custom prompt:", err);
		}
	}

	const combinedPrompt = await buildCombinedPrompt?.(
		novelCustomPrompt || undefined,
	);

	// Keep single-progress behavior for non-chunked processing.
	if (!shouldChunk) {
		showWorkInProgressBanner?.(0, 1);
	}

	return sendMessageWithRetry?.({
		action: "processWithGemini",
		title: extractedTitle,
		content: contentToSend,
		siteSpecificPrompt: combinedPrompt,
		useEmoji,
		forceChunking: Boolean(shouldChunk),
	});
}

export async function handleExistingChunkedStateOnEnhanceRuntime({
	existingChunkedOnClick,
	isCachedContent,
	documentRef = document,
	cancelEnhanceButton,
	showStatusMessage,
	showWorkInProgressBanner,
	handleReenhanceChunk,
	isEnhancementCancelled,
	loadChunkingSystem,
	windowRef = window,
	onResetChunkCacheFlags,
}) {
	if (!existingChunkedOnClick || isCachedContent) {
		return { handled: false };
	}

	const allChunkEls = existingChunkedOnClick.querySelectorAll(
		".gemini-chunk-content",
	);
	const enhancedChunkEls = existingChunkedOnClick.querySelectorAll(
		'.gemini-chunk-content[data-chunk-enhanced="true"]',
	);
	const errorBanners = existingChunkedOnClick.querySelectorAll(
		'.gemini-chunk-banner[data-chunk-status="error"]',
	);
	const hasErrorChunks = errorBanners.length > 0;
	const isPartial =
		allChunkEls.length > 0 &&
		enhancedChunkEls.length > 0 &&
		enhancedChunkEls.length < allChunkEls.length;

	if (isPartial || (allChunkEls.length > 0 && hasErrorChunks)) {
		const handledByRuntime = await continueChunkEnhancementRuntime({
			allChunkEls,
			enhancedChunkEls,
			errorBanners,
			documentRef,
			cancelEnhanceButton,
			showStatusMessage,
			showWorkInProgressBanner,
			handleReenhanceChunk,
			isEnhancementCancelled,
		});
		if (handledByRuntime) {
			return { handled: true };
		}
	}

	await prepareFreshEnhancementFromChunkCacheRuntime({
		allChunkEls,
		enhancedChunkEls,
		showStatusMessage,
		loadChunkingSystem,
		windowRef,
		onResetChunkCacheFlags,
	});

	return { handled: false };
}

export async function handleEnhancementCacheGateRuntime({
	storageManager,
	isCachedContent,
	hasCachedContent,
	documentRef = document,
	loadChunkingSystem,
	findContentArea,
	windowRef = window,
	showStatusMessage,
	replaceContentWithEnhancedVersion,
	cancelEnhanceButton,
	onResetCacheFlags,
	onCacheLoaded,
	onCacheMiss,
}) {
	if (!storageManager || (!isCachedContent && !hasCachedContent)) {
		return false;
	}

	const enhanceBtns = documentRef.querySelectorAll(".gemini-enhance-btn");
	const originalText = enhanceBtns[0]?.textContent ?? "";

	if (isCachedContent && originalText.includes("Regenerate")) {
		await prepareRegenerationFromCachedContentRuntime({
			storageManager,
			loadChunkingSystem,
			findContentArea,
			documentRef,
			windowRef,
			onResetCacheFlags,
		});
		return false;
	}

	return loadCachedEnhancedContentRuntime({
		storageManager,
		showStatusMessage,
		replaceContentWithEnhancedVersion,
		windowRef,
		cancelEnhanceButton,
		onCacheLoaded,
		onCacheMiss,
	});
}

export async function prepareEnhancementChunkRuntime({
	chunkingEnabled,
	chunking,
	extractedText,
	findContentArea,
	showStatusMessage,
	debugLog = () => {},
	debugError = () => {},
	getCleanContentHTML,
	documentRef = document,
	buildChunkBanner,
	stripHtmlTags,
	onSummarizeLong,
	onSummarizeShort,
	shouldBannersBeHidden,
	showWorkInProgressBanner,
	enableCopyOnContentArea,
}) {
	const contentArea = findContentArea?.();
	if (!contentArea) {
		throw new Error("Unable to find content area for enhancement");
	}

	let shouldChunk = Boolean(chunkingEnabled && chunking && extractedText);
	let chunks = [];
	let chunkSummaryCount = 2;
	let contentToSend = extractedText;

	const chunkInput = await resolveChunkingInputRuntime({
		chunkingEnabled,
		chunking,
		extractedText,
		contentArea,
		getCleanContentHTML,
		showStatusMessage,
		debugLog,
		debugError,
	});
	if (chunkInput) {
		shouldChunk = chunkInput.shouldChunk;
		chunks = chunkInput.chunks;
		chunkSummaryCount = chunkInput.chunkSummaryCount;
		contentToSend = chunkInput.contentToSend;
	}

	if (shouldChunk) {
		cleanupChunkedUiBeforeInitRuntime({
			documentRef,
			contentArea,
		});

		const prepared = await prepareChunkedViewRuntime({
			contentArea,
			chunks,
			chunkSummaryCount,
			chunking,
			buildChunkBanner,
			stripHtmlTags,
			onSummarizeLong,
			onSummarizeShort,
			shouldBannersBeHidden,
			getCleanContentHTML,
			extractedText,
			showWorkInProgressBanner,
			enableCopyOnContentArea,
			debugLog,
			debugError,
			showStatusMessage,
			documentRef,
		});
		if (!prepared) {
			shouldChunk = false;
		}
	}

	return {
		contentArea,
		shouldChunk,
		chunks,
		chunkSummaryCount,
		contentToSend,
	};
}

export async function runEnhancementLifecycleRuntime({
	novelLibrary,
	locationHref,
	debugLog = () => {},
	buildCombinedPrompt,
	shouldChunk,
	showWorkInProgressBanner,
	sendMessageWithRetry,
	extractedTitle,
	contentToSend,
	useEmoji,
	isEnhancementCancelled,
	documentRef = document,
	cancelEnhanceButton,
	showStatusMessage,
	replaceContentWithEnhancedVersion,
	loadChunkingSystem,
	chunks,
	handleChunkProcessed,
	extractedContentText,
	browserRef = browser,
	consoleWarn = console.warn,
}) {
	const response = await requestEnhancementProcessingRuntime({
		novelLibrary,
		locationHref,
		debugLog,
		buildCombinedPrompt,
		shouldChunk,
		showWorkInProgressBanner,
		sendMessageWithRetry,
		extractedTitle,
		contentToSend,
		useEmoji,
	});

	if (isEnhancementCancelled?.()) {
		handleEnhancementCancelledRuntime({
			documentRef,
			cancelEnhanceButton,
			debugLog,
		});
		return { cancelled: true };
	}

	await handleEnhancementResponseRuntime({
		response,
		documentRef,
		showWorkInProgressBanner,
		replaceContentWithEnhancedVersion,
		loadChunkingSystem,
		chunks,
		handleChunkProcessed,
		extractedContentText,
		showStatusMessage,
		browserRef,
		consoleWarn,
	});

	if (cancelEnhanceButton) {
		cancelEnhanceButton.style.display = "none";
	}

	return { cancelled: false };
}

export function handleEnhancementLifecycleErrorRuntime({
	error,
	debugError = () => {},
	showStatusMessage,
	documentRef = document,
	cancelEnhanceButton,
	buttonText = "Γ£¿ Enhance with Gemini",
}) {
	debugError("Error in handleEnhanceClick:", error);
	showStatusMessage?.(`Error: ${error.message}`, "error");
	resetEnhanceButtonsOnErrorRuntime({
		documentRef,
		buttonText,
	});
	if (cancelEnhanceButton) {
		cancelEnhanceButton.style.display = "none";
	}
}

export async function runEnhancementPrechecksRuntime({
	existingChunkedOnClick,
	isCachedContent,
	hasCachedContent,
	storageManager,
	documentRef = document,
	cancelEnhanceButton,
	showStatusMessage,
	showWorkInProgressBanner,
	handleReenhanceChunk,
	isEnhancementCancelled,
	loadChunkingSystem,
	windowRef = window,
	onResetChunkCacheFlags,
	findContentArea,
	replaceContentWithEnhancedVersion,
	onResetCacheFlags,
	onCacheLoaded,
	onCacheMiss,
}) {
	const chunkedStateResult = await handleExistingChunkedStateOnEnhanceRuntime(
		{
			existingChunkedOnClick,
			isCachedContent,
			documentRef,
			cancelEnhanceButton,
			showStatusMessage,
			showWorkInProgressBanner,
			handleReenhanceChunk,
			isEnhancementCancelled,
			loadChunkingSystem,
			windowRef,
			onResetChunkCacheFlags,
		},
	);
	if (chunkedStateResult?.handled) {
		return { handled: true };
	}

	const loadedFromCache = await handleEnhancementCacheGateRuntime({
		storageManager,
		isCachedContent,
		hasCachedContent,
		documentRef,
		loadChunkingSystem,
		findContentArea,
		windowRef,
		showStatusMessage,
		replaceContentWithEnhancedVersion,
		cancelEnhanceButton,
		onResetCacheFlags,
		onCacheLoaded,
		onCacheMiss,
	});
	if (loadedFromCache) {
		return { handled: true };
	}

	return { handled: false };
}

export async function restoreChunkedContentFromCacheRuntime({
	chunking,
	chunks,
	metadata,
	findContentArea,
	browserRef = browser,
	chunkBehaviorConfig,
	stripHtmlTags,
	sanitizeHTML,
	buildChunkBanner,
	summarizeChunkRange,
	shouldBannersBeHidden,
	handleToggleAllChunks,
	handleDeleteAllChunks,
	loadDomIntegrationModule,
	documentRef = document,
	confirmFn,
	onSetLastChunkModelInfo,
	onSetCachedFlags,
	enableCopyOnContentArea,
	showStatusMessage,
	debugLog = () => {},
}) {
	const contentArea = findContentArea?.();
	if (!contentArea) return false;

	const settingsData = await browserRef.storage.local.get([
		"wordCountThreshold",
	]);
	const wordCountThreshold =
		settingsData.wordCountThreshold !== undefined
			? settingsData.wordCountThreshold
			: chunkBehaviorConfig.wordCountThreshold;

	const totalChunks = Number.isInteger(metadata?.totalChunks)
		? metadata.totalChunks
		: chunks.length;
	const cacheTimestamp =
		metadata?.lastUpdated ||
		Math.max(
			...chunks
				.map((chunk) => chunk?.timestamp)
				.filter((ts) => Number.isFinite(ts)),
		);
	const modelInfo =
		metadata?.modelInfo ||
		chunks.find((chunk) => chunk?.modelInfo)?.modelInfo ||
		null;
	if (modelInfo) {
		onSetLastChunkModelInfo?.(modelInfo);
	}

	const originalHtmlSnapshot = contentArea.innerHTML;
	const originalText = chunks
		.map((chunk) => stripHtmlTags(chunk?.originalContent || ""))
		.join("\n\n");

	contentArea.setAttribute("data-original-html", originalHtmlSnapshot);
	contentArea.setAttribute("data-original-text", originalText);
	contentArea.setAttribute("data-total-chunks", totalChunks);

	const chunkedContentContainer = documentRef.createElement("div");
	chunkedContentContainer.id = "gemini-chunked-content";
	chunkedContentContainer.style.width = "100%";

	const sortedChunks = [...chunks].sort(
		(a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0),
	);

	sortedChunks.forEach((chunk, fallbackIndex) => {
		const chunkIndex = Number.isInteger(chunk.chunkIndex)
			? chunk.chunkIndex
			: fallbackIndex;
		const chunkWrapper = documentRef.createElement("div");
		chunkWrapper.className = "gemini-chunk-wrapper";
		chunkWrapper.setAttribute("data-chunk-index", chunkIndex);

		const chunkTimestamp = chunk?.timestamp || cacheTimestamp;
		const cacheInfo = chunkTimestamp
			? { fromCache: true, timestamp: chunkTimestamp }
			: { fromCache: true };

		const originalContent = chunk?.originalContent || "";
		const enhancedContent = chunk?.enhancedContent || "";
		const originalWords = stripHtmlTags(originalContent)
			.split(/\s+/)
			.filter((w) => w).length;
		const enhancedWords = stripHtmlTags(enhancedContent)
			.split(/\s+/)
			.filter((w) => w).length;
		const wordCounts = {
			original: originalWords,
			enhanced: enhancedWords,
		};

		const banner = buildChunkBanner(
			chunking,
			chunkIndex,
			totalChunks,
			"cached",
			null,
			cacheInfo,
			wordCounts,
			wordCountThreshold,
		);
		chunkWrapper.appendChild(banner);

		const chunkContent = documentRef.createElement("div");
		chunkContent.className = "gemini-chunk-content";
		chunkContent.setAttribute("data-chunk-index", chunkIndex);
		chunkContent.setAttribute(
			"data-original-chunk-content",
			chunk?.originalContent || "",
		);
		if (/<[^>]+>/.test(chunk?.originalContent || "")) {
			chunkContent.setAttribute(
				"data-original-chunk-html",
				chunk.originalContent,
			);
		}

		const sanitizedContent = sanitizeHTML(chunk?.enhancedContent || "");
		chunkContent.innerHTML = sanitizedContent;
		chunkContent.setAttribute("data-chunk-enhanced", "true");
		chunkContent.setAttribute("data-showing", "enhanced");
		chunkContent.setAttribute(
			"data-enhanced-chunk-content",
			sanitizedContent,
		);
		chunkWrapper.appendChild(chunkContent);

		chunkedContentContainer.appendChild(chunkWrapper);
	});

	contentArea.innerHTML = "";
	contentArea.appendChild(chunkedContentContainer);

	const chunkWrappers = Array.from(
		chunkedContentContainer.querySelectorAll(".gemini-chunk-wrapper"),
	);
	if (chunking?.summaryUI) {
		const summarySettings = await browserRef.storage.local.get([
			"chunkSummaryCount",
		]);
		const chunkSummaryCount =
			summarySettings.chunkSummaryCount ||
			chunking?.config?.DEFAULT_CHUNK_SUMMARY_COUNT ||
			2;

		documentRef
			.querySelectorAll(".gemini-main-summary-group")
			.forEach((el) => el.remove());

		const mainSummaryGroup = chunking.summaryUI.createMainSummaryGroup(
			totalChunks,
			(indices) => summarizeChunkRange(indices, false),
			(indices) => summarizeChunkRange(indices, true),
		);

		if (shouldBannersBeHidden()) {
			mainSummaryGroup.style.display = "none";
		}

		contentArea.insertBefore(mainSummaryGroup, chunkedContentContainer);

		if (totalChunks > 1) {
			chunking.summaryUI.insertSummaryGroups(
				chunkedContentContainer,
				chunkWrappers,
				chunkSummaryCount,
				(indices) => summarizeChunkRange(indices, false),
				(indices) => summarizeChunkRange(indices, true),
			);
		}
	}

	if (chunking?.ui) {
		const originalWords = chunking.core.countWords(originalText);
		const enhancedWords = sortedChunks.reduce((sum, chunk) => {
			return sum + chunking.core.countWords(chunk?.enhancedContent || "");
		}, 0);
		const domIntegration = await loadDomIntegrationModule?.();
		domIntegration?.ensureMasterBannerRuntime?.({
			documentRef,
			contentArea,
			chunking,
			totalChunks,
			originalWords,
			enhancedWords,
			isCached: true,
			lastChunkModelInfo: modelInfo,
			cacheMeta: cacheTimestamp ? { timestamp: cacheTimestamp } : null,
			shouldBannersBeHidden,
			onToggleAll: handleToggleAllChunks,
			onDeleteAll: handleDeleteAllChunks,
			confirmFn,
		});
	}

	onSetCachedFlags?.();
	contentArea.setAttribute("data-showing-enhanced", "true");

	const domIntegration = await loadDomIntegrationModule?.();
	if (domIntegration?.clearTransientEnhancementBannersRuntime) {
		domIntegration.clearTransientEnhancementBannersRuntime({
			documentRef,
		});
	} else {
		const wipBanner = documentRef.querySelector(".gemini-wip-banner");
		if (wipBanner) wipBanner.remove();
	}

	documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
		btn.textContent = "ΓÖ╗ Regenerate with Gemini";
		btn.disabled = false;
		btn.classList.remove("loading");
	});

	enableCopyOnContentArea?.(contentArea);
	showStatusMessage?.("Loaded cached enhanced content.", "success", 3000);
	debugLog?.(
		`[Cache Restore] Restored ${sortedChunks.length}/${totalChunks} chunk(s) from cache`,
	);

	return true;
}
