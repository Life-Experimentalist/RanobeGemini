/**
 * Chunk event handlers extracted from content.js.
 */

export async function toggleChunkViewRuntime({
	chunkIndex,
	documentRef = document,
	applyCollapsibleSections,
	findContentArea,
	enableCopyOnContentArea,
	escapeHtml,
}) {
	const chunkWrapper = documentRef.querySelector(
		`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
	);
	if (!chunkWrapper) return;

	const chunkContent = chunkWrapper.querySelector(".gemini-chunk-content");
	const toggleBtn = chunkWrapper.querySelector(".gemini-chunk-toggle-btn");
	if (!chunkContent || !toggleBtn) return;

	const isShowingEnhanced =
		toggleBtn.getAttribute("data-showing") === "enhanced";
	const originalHtml = chunkContent.getAttribute("data-original-chunk-html");
	const originalContent = chunkContent.getAttribute(
		"data-original-chunk-content",
	);
	const enhancedContent =
		chunkContent.getAttribute("data-enhanced-chunk-content") ||
		chunkContent.innerHTML;

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
		toggleBtn.textContent = "\u{2728} Show Enhanced";
		toggleBtn.setAttribute("data-showing", "original");
		return;
	}

	chunkContent.innerHTML = enhancedContent;
	applyCollapsibleSections(chunkContent);
	toggleBtn.textContent = "\u{1F441} Show Original";
	toggleBtn.setAttribute("data-showing", "enhanced");

	const contentArea = findContentArea();
	if (contentArea) {
		enableCopyOnContentArea(contentArea);
	}
}

export async function deleteChunkEnhancementRuntime({
	chunkIndex,
	windowRef = window,
	documentRef = document,
	loadChunkingSystem,
	showStatusMessage,
	escapeHtml,
	buildChunkBanner,
	chunkBehaviorConfig,
	onEnhance,
}) {
	const chunking = await loadChunkingSystem();
	if (!chunking) return;

	const chunkWrapper = documentRef.querySelector(
		`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
	);
	if (!chunkWrapper) return;

	const chunkContent = chunkWrapper.querySelector(".gemini-chunk-content");
	if (!chunkContent) return;

	const originalHtml = chunkContent.getAttribute("data-original-chunk-html");
	const originalContent = chunkContent.getAttribute(
		"data-original-chunk-content",
	);

	if (!originalContent && !originalHtml) {
		showStatusMessage(
			"Original content not available for this chunk.",
			"error",
		);
		return;
	}

	await chunking.cache.deleteChunkFromCache(
		windowRef.location.href,
		chunkIndex,
	);

	if (originalHtml) {
		chunkContent.innerHTML = originalHtml;
	} else {
		chunkContent.innerHTML = `<div style="white-space: pre-wrap;">${escapeHtml(originalContent)}</div>`;
	}
	chunkContent.removeAttribute("data-chunk-enhanced");
	chunkContent.removeAttribute("data-enhanced-chunk-content");

	const banner = chunkWrapper.querySelector(".gemini-chunk-banner");
	if (banner) {
		const totalChunks = documentRef.querySelectorAll(
			".gemini-chunk-banner",
		).length;
		const newBanner = buildChunkBanner(
			chunking,
			chunkIndex,
			totalChunks,
			"pending",
			null,
			null,
			null,
			chunkBehaviorConfig.wordCountThreshold,
			onEnhance,
		);
		banner.replaceWith(newBanner);
	}

	showStatusMessage(
		`Chunk ${chunkIndex + 1} reverted to original.`,
		"info",
		2000,
	);
}

export async function handleChunkToggleRuntime({
	chunkIndex,
	documentRef = document,
	applyCollapsibleSections,
	findContentArea,
	enableCopyOnContentArea,
	escapeHtml,
}) {
	const chunkWrapper = documentRef.querySelector(
		`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
	);
	if (!chunkWrapper) return;

	const chunkContent = chunkWrapper.querySelector(".gemini-chunk-content");
	const toggleBtn = chunkWrapper.querySelector(".gemini-chunk-toggle-btn");
	if (!chunkContent || !toggleBtn) return;

	const isShowingEnhanced =
		toggleBtn.getAttribute("data-showing") === "enhanced";
	const originalHtml = chunkContent.getAttribute("data-original-chunk-html");
	const originalContent = chunkContent.getAttribute(
		"data-original-chunk-content",
	);
	const enhancedContent =
		chunkContent.getAttribute("data-enhanced-chunk-content") ||
		chunkContent.innerHTML;

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
		toggleBtn.textContent = "\u{393}\u{A3}\u{BF} Show Enhanced";
		toggleBtn.setAttribute("data-showing", "original");
		return;
	}

	chunkContent.innerHTML = enhancedContent;
	applyCollapsibleSections(chunkContent);
	toggleBtn.textContent = "\u{2261}\u{192}\u{E6}\u{FC} Show Original";
	toggleBtn.setAttribute("data-showing", "enhanced");

	const contentArea = findContentArea();
	if (contentArea) {
		enableCopyOnContentArea(contentArea);
	}
}

export async function handleSkipChunkRuntime({
	chunkIndex,
	chunkControlRuntime,
	debugLog = () => {},
}) {
	chunkControlRuntime?.markSkip(chunkIndex);
	debugLog(
		`Chunk ${chunkIndex} marked for skip \u{393}\u{C7}\u{F6} will discard result on arrival.`,
	);
}

export async function handlePauseChunkRuntime({
	chunkIndex,
	chunkControlRuntime,
	debugLog = () => {},
}) {
	chunkControlRuntime?.markPause(chunkIndex);
	debugLog(
		`Chunk ${chunkIndex} marked for pause \u{393}\u{C7}\u{F6} will store result without applying.`,
	);
}

export async function handleShowEnhancedChunkRuntime({
	chunkIndex,
	loadChunkingSystem,
	showStatusMessage,
	applyCollapsibleSections,
	chunkControlRuntime,
	buildChunkBanner,
	chunkBehaviorConfig,
	findContentArea,
	enableCopyOnContentArea,
	cancelEnhanceButton,
	documentRef = document,
	browserRef = browser,
}) {
	const chunking = await loadChunkingSystem?.();
	if (!chunking) return;

	const chunkWrapper = documentRef.querySelector(
		`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
	);
	if (!chunkWrapper) return;

	const chunkContent = chunkWrapper.querySelector(".gemini-chunk-content");
	if (!chunkContent) return;

	const enhancedContent = chunkContent.getAttribute(
		"data-enhanced-chunk-content",
	);
	if (!enhancedContent) {
		showStatusMessage?.(
			`No pending enhanced content for chunk ${chunkIndex + 1}.`,
			"error",
		);
		return;
	}

	chunkContent.innerHTML = enhancedContent;
	applyCollapsibleSections?.(chunkContent);
	chunkContent.setAttribute("data-chunk-enhanced", "true");
	chunkControlRuntime?.clearPause(chunkIndex);

	const nTotalChunks = documentRef.querySelectorAll(
		".gemini-chunk-banner",
	).length;
	const settingsData = await browserRef.storage.local.get([
		"wordCountThreshold",
	]);
	const wct =
		settingsData.wordCountThreshold !== undefined
			? settingsData.wordCountThreshold
			: chunkBehaviorConfig.wordCountThreshold;
	const originalText =
		chunkContent.getAttribute("data-original-chunk-content") || "";
	const origWords = chunking.core.countWords(originalText);
	const enhWords = chunking.core.countWords(enhancedContent);
	const completedBanner = buildChunkBanner(
		chunking,
		chunkIndex,
		nTotalChunks,
		"completed",
		null,
		null,
		{ original: origWords, enhanced: enhWords },
		wct,
	);
	const freshBanner = documentRef.querySelector(
		`.chunk-banner-${chunkIndex}`,
	);
	if (freshBanner) freshBanner.replaceWith(completedBanner);

	const allChunkEls = documentRef.querySelectorAll(".gemini-chunk-content");
	const doneEls = documentRef.querySelectorAll(
		'.gemini-chunk-content[data-chunk-enhanced="true"]',
	);
	const allDone =
		doneEls.length === allChunkEls.length && allChunkEls.length > 0;

	if (allDone) {
		documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
			btn.textContent = "\u{2261}\u{192}\u{F6}\u{E4} Re-enhance with Gemini";
			btn.disabled = false;
			btn.classList.remove("loading");
		});
		if (cancelEnhanceButton) cancelEnhanceButton.style.display = "none";
	}

	const contentAreaForCopy = findContentArea?.();
	if (contentAreaForCopy) {
		contentAreaForCopy.setAttribute("data-showing-enhanced", "true");
		enableCopyOnContentArea?.(contentAreaForCopy);
	}

	showStatusMessage?.(
		`Chunk ${chunkIndex + 1} enhancement applied! \u{393}\u{A3}\u{BF}`,
		"success",
		2000,
	);
}

export async function handleDiscardPausedChunkRuntime({
	chunkIndex,
	loadChunkingSystem,
	buildChunkBanner,
	chunkBehaviorConfig,
	chunkControlRuntime,
	showStatusMessage,
	handleReenhanceChunk,
	documentRef = document,
}) {
	const chunking = await loadChunkingSystem?.();
	if (!chunking) return;

	const chunkWrapper = documentRef.querySelector(
		`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
	);
	if (!chunkWrapper) return;

	const chunkContent = chunkWrapper.querySelector(".gemini-chunk-content");
	if (!chunkContent) return;

	chunkContent.removeAttribute("data-enhanced-chunk-content");
	chunkControlRuntime?.clearPause(chunkIndex);

	const nTotalChunks = documentRef.querySelectorAll(
		".gemini-chunk-banner",
	).length;
	const pendingBanner = buildChunkBanner(
		chunking,
		chunkIndex,
		nTotalChunks,
		"pending",
		null,
		null,
		null,
		chunkBehaviorConfig.wordCountThreshold,
		() => handleReenhanceChunk(chunkIndex),
	);
	const freshBanner = documentRef.querySelector(
		`.chunk-banner-${chunkIndex}`,
	);
	if (freshBanner) freshBanner.replaceWith(pendingBanner);

	showStatusMessage?.(
		`Chunk ${chunkIndex + 1} enhancement discarded.`,
		"info",
		2000,
	);
}

export async function handleReenhanceChunkRuntime({
	chunkIndex,
	loadChunkingSystem,
	debugLog = () => {},
	debugError = () => {},
	showStatusMessage,
	buildChunkBanner,
	showWorkInProgressBanner,
	wakeUpBackgroundWorker,
	sendMessageWithRetry,
	browserRef = browser,
	documentRef = document,
	windowRef = window,
	stripHtmlTags,
	buildCombinedPrompt,
	chunkBehaviorConfig,
	chunkControlRuntime,
	loadDomIntegrationModule,
	shouldBannersBeHidden,
	handleToggleAllChunks,
	handleDeleteAllChunks,
	extractNovelContext,
	addToNovelLibrary,
	findContentArea,
	enableCopyOnContentArea,
	sanitizeHTML,
	applyCollapsibleSections,
	cancelEnhanceButton,
	confirmFn,
	getFormattingOptions,
	setFormattingOptions,
	getLastChunkModelInfo,
	setLastChunkModelInfo,
	setHasCachedContent,
}) {
	const chunking = await loadChunkingSystem?.();
	if (!chunking) return;

	debugLog(`Re-enhancing chunk ${chunkIndex}...`);

	const chunkContent = documentRef.querySelector(
		`.gemini-chunk-content[data-chunk-index="${chunkIndex}"]`,
	);

	const contentForEnhancement =
		chunkContent?.getAttribute("data-original-chunk-html") ||
		chunkContent?.getAttribute("data-original-chunk-content");
	const originalText =
		chunkContent?.getAttribute("data-original-chunk-content") ||
		stripHtmlTags?.(contentForEnhancement || "") ||
		"";

	if (!contentForEnhancement) {
		debugError("No original content found for chunk", chunkIndex);
		showStatusMessage?.(
			`Cannot re-enhance chunk ${chunkIndex + 1}: Original content not found`,
			"error",
		);
		return;
	}

	const nTotalChunksNow =
		documentRef.querySelectorAll(".gemini-chunk-banner").length || 1;
	const wasBtnAlreadyDisabled = Array.from(
		documentRef.querySelectorAll(".gemini-enhance-btn"),
	).some((btn) => btn.disabled);

	const processingBanner = buildChunkBanner(
		chunking,
		chunkIndex,
		nTotalChunksNow,
		"processing",
		null,
		null,
		null,
		chunkBehaviorConfig.wordCountThreshold,
		null,
		wasBtnAlreadyDisabled,
	);
	const existingBannerPre = documentRef.querySelector(
		`.chunk-banner-${chunkIndex}`,
	);
	if (existingBannerPre) {
		existingBannerPre.replaceWith(processingBanner);
	}

	if (!wasBtnAlreadyDisabled) {
		documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
			btn.disabled = true;
			btn.classList.add("loading");
		});
	}

	const doneAtStart = documentRef.querySelectorAll(
		'.gemini-chunk-content[data-chunk-enhanced="true"]',
	).length;
	const totalForWip =
		documentRef.querySelectorAll(".gemini-chunk-content").length ||
		nTotalChunksNow;
	showWorkInProgressBanner?.(doneAtStart, totalForWip, "processing", null);

	try {
		await wakeUpBackgroundWorker?.();

		const settings = await browserRef.storage.local.get([
			"useEmoji",
			"formatGameStats",
			"centerSceneHeadings",
		]);
		const useEmoji = settings.useEmoji === true;
		const nextFormattingOptions = {
			...(getFormattingOptions?.() || {}),
			useEmoji,
			formatGameStats: settings.formatGameStats !== false,
			centerSceneHeadings: settings.centerSceneHeadings !== false,
		};
		setFormattingOptions?.(nextFormattingOptions);

		const combinedPrompt = await buildCombinedPrompt?.();

		const response = await sendMessageWithRetry?.({
			action: "reenhanceChunk",
			chunkIndex,
			content: contentForEnhancement,
			title: documentRef.title,
			siteSpecificPrompt: combinedPrompt,
			useEmoji,
		});

		if (response && response.success && response.result) {
			const modelInfo = response.result?.modelInfo || null;
			if (modelInfo) {
				setLastChunkModelInfo?.(modelInfo);
			}

			if (chunkControlRuntime?.consumeSkip(chunkIndex)) {
				debugLog(
					`Chunk ${chunkIndex} was skipped - discarding result.`,
				);
				const nTotalForSkip = documentRef.querySelectorAll(
					".gemini-chunk-banner",
				).length;
				const pendingBanner = buildChunkBanner(
					chunking,
					chunkIndex,
					nTotalForSkip,
					"pending",
					null,
					null,
					null,
					chunkBehaviorConfig.wordCountThreshold,
					() =>
						handleReenhanceChunkRuntime({
							chunkIndex,
							loadChunkingSystem,
							debugLog,
							debugError,
							showStatusMessage,
							buildChunkBanner,
							showWorkInProgressBanner,
							wakeUpBackgroundWorker,
							sendMessageWithRetry,
							browserRef,
							documentRef,
							windowRef,
							stripHtmlTags,
							buildCombinedPrompt,
							chunkBehaviorConfig,
							chunkControlRuntime,
							loadDomIntegrationModule,
							shouldBannersBeHidden,
							handleToggleAllChunks,
							handleDeleteAllChunks,
							extractNovelContext,
							addToNovelLibrary,
							findContentArea,
							enableCopyOnContentArea,
							sanitizeHTML,
							applyCollapsibleSections,
							confirmFn,
							getFormattingOptions,
							setFormattingOptions,
							getLastChunkModelInfo,
							setLastChunkModelInfo,
							setHasCachedContent,
						}),
				);
				const skippedBannerEl = documentRef.querySelector(
					`.chunk-banner-${chunkIndex}`,
				);
				if (skippedBannerEl) skippedBannerEl.replaceWith(pendingBanner);
				const allForSkip =
					documentRef.querySelectorAll(".gemini-chunk-content")
						.length || nTotalForSkip;
				const doneForSkip = documentRef.querySelectorAll(
					'.gemini-chunk-content[data-chunk-enhanced="true"]',
				).length;
				showWorkInProgressBanner?.(
					doneForSkip,
					allForSkip,
					"paused",
					null,
				);
				if (!wasBtnAlreadyDisabled) {
					documentRef
						.querySelectorAll(".gemini-enhance-btn")
						.forEach((btn) => {
							btn.textContent = "\u{393}\u{A3}\u{BF} Enhance with Gemini";
							btn.disabled = false;
							btn.classList.remove("loading");
						});
				}
				showStatusMessage?.(
					`Chunk ${chunkIndex + 1} was skipped.`,
					"info",
					2000,
				);
				return;
			}

			if (chunkContent) {
				const sanitizedContent =
					sanitizeHTML?.(response.result.enhancedContent) ||
					response.result.enhancedContent;
				if (chunkControlRuntime?.consumePause(chunkIndex)) {
					chunkContent.setAttribute(
						"data-enhanced-chunk-content",
						sanitizedContent,
					);
					const nTotalForPause = documentRef.querySelectorAll(
						".gemini-chunk-banner",
					).length;
					const pausedBanner = buildChunkBanner(
						chunking,
						chunkIndex,
						nTotalForPause,
						"paused",
					);
					const pausedBannerEl = documentRef.querySelector(
						`.chunk-banner-${chunkIndex}`,
					);
					if (pausedBannerEl)
						pausedBannerEl.replaceWith(pausedBanner);
					const allForPause =
						documentRef.querySelectorAll(".gemini-chunk-content")
							.length || nTotalForPause;
					const doneForPause = documentRef.querySelectorAll(
						'.gemini-chunk-content[data-chunk-enhanced="true"]',
					).length;
					showWorkInProgressBanner?.(
						doneForPause,
						allForPause,
						"paused",
						null,
					);
					if (!wasBtnAlreadyDisabled) {
						documentRef
							.querySelectorAll(".gemini-enhance-btn")
							.forEach((btn) => {
								btn.textContent = "\u{393}\u{A3}\u{BF} Enhance with Gemini";
								btn.disabled = false;
								btn.classList.remove("loading");
							});
					}
					showStatusMessage?.(
						`Chunk ${chunkIndex + 1} enhancement ready - click "\u{393}\u{A3}\u{BF} Show Enhanced" to apply.`,
						"info",
						4000,
					);
					return;
				}

				chunkContent.innerHTML = sanitizedContent;
				applyCollapsibleSections?.(chunkContent);
				chunkContent.setAttribute("data-chunk-enhanced", "true");
				chunkContent.setAttribute(
					"data-enhanced-chunk-content",
					sanitizedContent,
				);

				const nTotalChunks = documentRef.querySelectorAll(
					".gemini-chunk-banner",
				).length;
				const settingsData = await browserRef.storage.local.get([
					"wordCountThreshold",
				]);
				const wct =
					settingsData.wordCountThreshold !== undefined
						? settingsData.wordCountThreshold
						: chunkBehaviorConfig.wordCountThreshold;
				const origWords = chunking.core.countWords(originalText || "");
				const enhWords = chunking.core.countWords(sanitizedContent);
				const completedBanner = buildChunkBanner(
					chunking,
					chunkIndex,
					nTotalChunks,
					"completed",
					null,
					null,
					{ original: origWords, enhanced: enhWords },
					wct,
				);
				const freshBanner = documentRef.querySelector(
					`.chunk-banner-${chunkIndex}`,
				);
				if (freshBanner) freshBanner.replaceWith(completedBanner);
			}

			let totalChunks = documentRef.querySelectorAll(
				".gemini-chunk-wrapper",
			).length;
			await chunking.cache.saveChunkToCache(
				windowRef.location.href,
				chunkIndex,
				{
					originalContent: contentForEnhancement,
					enhancedContent: response.result.enhancedContent,
					wordCount: response.result.wordCount || 0,
					timestamp: Date.now(),
					totalChunks: totalChunks || undefined,
					modelInfo,
				},
			);

			const allChunkEls = documentRef.querySelectorAll(
				".gemini-chunk-content",
			);
			const doneEls = documentRef.querySelectorAll(
				'.gemini-chunk-content[data-chunk-enhanced="true"]',
			);
			const allDoneNow =
				doneEls.length === allChunkEls.length && allChunkEls.length > 0;

			const chunkWordCounts = chunking.core?.countWords
				? {
						original: Array.from(allChunkEls).reduce(
							(s, c) =>
								s +
								chunking.core.countWords(
									c.getAttribute(
										"data-original-chunk-content",
									) || "",
								),
							0,
						),
						enhanced: Array.from(doneEls).reduce(
							(s, c) => s + chunking.core.countWords(c.innerHTML),
							0,
						),
					}
				: null;

			showWorkInProgressBanner?.(
				doneEls.length,
				allChunkEls.length,
				allDoneNow ? "complete" : "paused",
				chunkWordCounts,
			);

			setHasCachedContent?.(true);

			if (allDoneNow) {
				documentRef
					.querySelectorAll(".gemini-enhance-btn")
					.forEach((btn) => {
						btn.textContent = "\u{2261}\u{192}\u{F6}\u{E4} Re-enhance with Gemini";
						btn.disabled = false;
						btn.classList.remove("loading");
					});
				if (cancelEnhanceButton)
					cancelEnhanceButton.style.display = "none";

				const contentAreaForMaster = findContentArea?.();
				if (contentAreaForMaster && chunking?.ui) {
					const domIntegration = await loadDomIntegrationModule?.();
					domIntegration?.ensureMasterBannerRuntime?.({
						documentRef,
						contentArea: contentAreaForMaster,
						chunking,
						totalChunks: null,
						lastChunkModelInfo: getLastChunkModelInfo?.(),
						shouldBannersBeHidden,
						onToggleAll: handleToggleAllChunks,
						onDeleteAll: handleDeleteAllChunks,
						confirmFn,
					});
				}

				try {
					const novelContext = extractNovelContext?.();
					await addToNovelLibrary?.(novelContext);
				} catch (libraryError) {
					debugError(
						"Failed to update novel library after all chunks done:",
						libraryError,
					);
				}
				showStatusMessage?.(
					"Content fully enhanced with Gemini! \u{393}\u{A3}\u{BF}",
					"success",
				);
			} else {
				if (!wasBtnAlreadyDisabled) {
					documentRef
						.querySelectorAll(".gemini-enhance-btn")
						.forEach((btn) => {
							btn.textContent = "\u{393}\u{A3}\u{BF} Enhance with Gemini";
							btn.disabled = false;
							btn.classList.remove("loading");
						});
				}
				showStatusMessage?.(
					`Chunk ${chunkIndex + 1} re-enhanced successfully!`,
					"success",
				);
			}

			const contentAreaForCopy = findContentArea?.();
			if (contentAreaForCopy) {
				contentAreaForCopy.setAttribute(
					"data-showing-enhanced",
					"true",
				);
				enableCopyOnContentArea?.(contentAreaForCopy);
			}
		} else {
			const errorMsg = response?.error || "Unknown error";
			const existingBanner = documentRef.querySelector(
				`.chunk-banner-${chunkIndex}`,
			);
			if (existingBanner) {
				const totalChunks = documentRef.querySelectorAll(
					".gemini-chunk-banner",
				).length;
				const errorBanner = buildChunkBanner(
					chunking,
					chunkIndex,
					totalChunks,
					"error",
					errorMsg,
				);
				existingBanner.replaceWith(errorBanner);
			}
			const allChErr =
				documentRef.querySelectorAll(".gemini-chunk-content").length ||
				nTotalChunksNow;
			const doneChErr = documentRef.querySelectorAll(
				'.gemini-chunk-content[data-chunk-enhanced="true"]',
			).length;
			showWorkInProgressBanner?.(doneChErr, allChErr, "paused", null);
			if (!wasBtnAlreadyDisabled) {
				documentRef
					.querySelectorAll(".gemini-enhance-btn")
					.forEach((btn) => {
						btn.textContent = "\u{393}\u{A3}\u{BF} Enhance with Gemini";
						btn.disabled = false;
						btn.classList.remove("loading");
					});
			}
			showStatusMessage?.(
				`Failed to re-enhance chunk ${chunkIndex + 1}: ${errorMsg}`,
				"error",
			);
		}
	} catch (error) {
		const existingBanner = documentRef.querySelector(
			`.chunk-banner-${chunkIndex}`,
		);
		if (existingBanner) {
			const totalChunks = documentRef.querySelectorAll(
				".gemini-chunk-banner",
			).length;
			const errorBanner = buildChunkBanner(
				chunking,
				chunkIndex,
				totalChunks,
				"error",
				error.message || "Unknown error",
			);
			existingBanner.replaceWith(errorBanner);
		}
		const allChCatch =
			documentRef.querySelectorAll(".gemini-chunk-content").length ||
			nTotalChunksNow;
		const doneChCatch = documentRef.querySelectorAll(
			'.gemini-chunk-content[data-chunk-enhanced="true"]',
		).length;
		showWorkInProgressBanner?.(doneChCatch, allChCatch, "paused", null);
		if (!wasBtnAlreadyDisabled) {
			documentRef
				.querySelectorAll(".gemini-enhance-btn")
				.forEach((btn) => {
					btn.textContent = "\u{393}\u{A3}\u{BF} Enhance with Gemini";
					btn.disabled = false;
					btn.classList.remove("loading");
				});
		}
		debugError("Error re-enhancing chunk:", error);
		showStatusMessage?.(
			`Error re-enhancing chunk ${chunkIndex + 1}: ${error.message}`,
			"error",
		);
	}
}

export default {
	toggleChunkViewRuntime,
	deleteChunkEnhancementRuntime,
	handleChunkToggleRuntime,
	handleSkipChunkRuntime,
	handlePauseChunkRuntime,
	handleShowEnhancedChunkRuntime,
	handleDiscardPausedChunkRuntime,
	handleReenhanceChunkRuntime,
};
