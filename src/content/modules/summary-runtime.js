/**
 * Summary runtime helpers extracted from content.js.
 *
 * This module owns summary-service loading, summary render fallback,
 * review-queue bookkeeping, and the page-level summary orchestration.
 */

let summaryServiceModule = null;
const PENDING_SUMMARY_REVIEW_KEY = "rg_pending_summary_reviews";

export async function loadSummaryServiceRuntime({
	browserRef,
	debugLog,
	debugError,
	initContext,
}) {
	if (summaryServiceModule) return summaryServiceModule;

	try {
		const url = browserRef.runtime.getURL("utils/summary-service.js");
		debugLog("Loading summary service from:", url);
		const mod = await import(url);
		if (!mod || !mod.default) {
			debugError(
				"Summary service module loaded but has no default export",
			);
			return null;
		}

		summaryServiceModule = mod.default;
		summaryServiceModule.init(initContext);
		debugLog("Summary service loaded and initialised successfully");
		return summaryServiceModule;
	} catch (error) {
		debugError(
			"Error loading summary service module (will use inline fallback):",
			error,
		);
		return null;
	}
}

export function renderSummaryOutputRuntime({
	container,
	summary,
	summaryType,
	summaryService,
	findContentArea,
	stripHtmlTags,
	documentRef = document,
	windowRef = window,
}) {
	if (!container) return;

	if (!summaryService) {
		const contentArea = findContentArea();
		const referenceNode =
			contentArea?.querySelector(
				"#gemini-enhanced-content p, #gemini-enhanced-content div, p, article p, div, span",
			) ||
			contentArea ||
			documentRef.body;
		const refStyles = windowRef.getComputedStyle(referenceNode);
		container.style.display = "block";
		container.style.textAlign = "left";
		while (container.firstChild) {
			container.removeChild(container.firstChild);
		}

		const heading = documentRef.createElement("h4");
		heading.textContent = `${summaryType} Summary:`;
		heading.style.cssText = `margin:0 0 12px 0;font-size:0.98em;font-weight:700;font-family:${refStyles.fontFamily};line-height:1.4;color:${refStyles.color};text-align:left;`;
		container.appendChild(heading);

		const body = documentRef.createElement("div");
		body.style.fontFamily = refStyles.fontFamily;
		body.style.fontSize = refStyles.fontSize;
		body.style.fontWeight = refStyles.fontWeight;
		body.style.lineHeight = refStyles.lineHeight;
		body.style.color = refStyles.color;
		body.style.textAlign =
			refStyles.textAlign && refStyles.textAlign !== "center"
				? refStyles.textAlign
				: "left";
		body.style.whiteSpace = "pre-wrap";
		body.textContent = stripHtmlTags(summary);
		container.appendChild(body);
		return;
	}

	summaryService.renderSummaryInContainer(container, summary, summaryType);
}

export async function queueSummaryReviewRecommendationRuntime({
	storageApi,
	pendingKey,
	isShort,
	chunkIndices,
	lastKnownNovelData,
	documentRef = document,
	windowRef = window,
}) {
	try {
		const totalChunkElements = documentRef.querySelectorAll(
			".gemini-chunk-content",
		).length;
		const totalChunks = Math.max(
			totalChunkElements || 0,
			Array.isArray(chunkIndices) ? chunkIndices.length : 0,
		);
		const threshold = isShort ? 8 : 6;
		if (totalChunks < threshold) return;

		const novelId =
			lastKnownNovelData?.id ||
			windowRef.location.pathname ||
			documentRef.title;
		const chapterNumber = lastKnownNovelData?.currentChapter ?? null;
		const summaryType = isShort ? "short" : "long";
		const recommendationLevel =
			totalChunks >= 12 ? "high" : totalChunks >= 9 ? "medium" : "normal";
		const reviewId = `${novelId}::${chapterNumber ?? "unknown"}::${summaryType}`;

		const existingData = await storageApi.get(pendingKey);
		const currentQueue = Array.isArray(existingData?.[pendingKey])
			? existingData[pendingKey]
			: [];

		let hasPending = false;
		const nextQueue = currentQueue.map((item) => {
			if (
				item?.id === reviewId &&
				(item?.status || "pending") === "pending"
			) {
				hasPending = true;
				return {
					...item,
					totalChunks,
					recommendationLevel,
					updatedAt: Date.now(),
				};
			}
			return item;
		});

		if (!hasPending) {
			nextQueue.push({
				id: reviewId,
				status: "pending",
				novelId,
				title: lastKnownNovelData?.title || documentRef.title,
				chapterNumber,
				summaryType,
				totalChunks,
				recommendationLevel,
				reason:
					totalChunks >= 12
						? "Very large chapter. Queueing for focused review before trusting summary output."
						: "Large chunk count detected. Review summary quality for possible compression artifacts.",
				sourceUrl: windowRef.location.href,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
		}

		nextQueue.sort((a, b) => (b?.updatedAt || 0) - (a?.updatedAt || 0));
		await storageApi.set({ [pendingKey]: nextQueue.slice(0, 200) });
	} catch (_error) {
		// Non-blocking: review recommendation queue should never break summary flow.
	}
}

export async function summarizeChunkRangeRuntime({
	chunkIndices,
	isShort,
	groupStartIndex = null,
	loadSummaryService,
	wakeUpBackgroundWorker,
	sendMessageWithRetry,
	browserRef = browser,
	documentRef = document,
	windowRef = window,
	debugLog = () => {},
	debugError = () => {},
	showStatusMessage,
	findContentArea,
	extractContent,
	stripHtmlTags,
	getLastKnownNovelData,
	loadNovelLibrary,
}) {
	const summaryService = await loadSummaryService?.();
	if (summaryService) {
		debugLog(
			`Summary service loaded - delegating ${isShort ? "short" : "long"} summary for chunks`,
			chunkIndices,
		);
		const result = await summaryService.summarize(chunkIndices, isShort);
		await queueSummaryReviewRecommendationRuntime({
			storageApi: browserRef.storage.local,
			pendingKey: PENDING_SUMMARY_REVIEW_KEY,
			isShort,
			chunkIndices,
			lastKnownNovelData: getLastKnownNovelData?.() || null,
			documentRef,
			windowRef,
		});
		return result;
	}

	debugLog(
		"Summary service unavailable - using inline fallback for",
		isShort ? "short" : "long",
		"summary",
	);

	const summaryType = isShort ? "Short" : "Long";
	const statusDiv = documentRef.getElementById("gemini-status");
	const isMainSummary =
		groupStartIndex === null ||
		(groupStartIndex === 0 && chunkIndices.length > 1);

	let btn = null;
	if (isMainSummary) {
		const btnClass = isShort
			? ".gemini-main-short-summary-btn"
			: ".gemini-main-long-summary-btn";
		btn = documentRef.querySelector(btnClass);
	} else {
		const group = documentRef.querySelector(
			`.gemini-chunk-summary-group[data-start-index="${groupStartIndex}"]`,
		);
		if (group) {
			const btnClass = isShort
				? ".gemini-chunk-short-summary-btn"
				: ".gemini-chunk-long-summary-btn";
			btn = group.querySelector(btnClass);
		}
	}
	const originalBtnText = btn?.textContent || "";

	let summaryTextContainer;
	if (isMainSummary) {
		summaryTextContainer =
			documentRef.querySelector(".gemini-main-summary-text") ||
			documentRef.querySelector(
				".gemini-summary-text-container[data-group-start='0']",
			);
	} else {
		summaryTextContainer = documentRef.querySelector(
			`.gemini-summary-text-container[data-group-start="${groupStartIndex}"]`,
		);
	}

	try {
		if (btn) {
			btn.disabled = true;
			btn.textContent = "Waking up AI...";
		}
		if (statusDiv) statusDiv.textContent = "Waking up AI service...";

		const isReady = await wakeUpBackgroundWorker?.();
		if (!isReady)
			throw new Error(
				"Background service is not responding. Please try again.",
			);

		if (btn) btn.textContent = "Extracting content...";
		if (statusDiv) statusDiv.textContent = "Extracting content...";
		if (summaryTextContainer) {
			summaryTextContainer.style.display = "block";
			summaryTextContainer.textContent = `Generating ${summaryType.toLowerCase()} summary...`;
		}

		let contentText = null;
		let contentSource = "none";

		const chunkTexts = chunkIndices
			.map((index) => {
				const el = documentRef.querySelector(
					`.gemini-chunk-content[data-chunk-index="${index}"]`,
				);
				if (!el) return "";
				const isEnhanced =
					el.getAttribute("data-chunk-enhanced") === "true";
				const html = isEnhanced
					? el.innerHTML
					: el.getAttribute("data-original-chunk-html") ||
						el.innerHTML;
				return stripHtmlTags?.(html || "") || "";
			})
			.filter((t) => t?.trim().length > 0);

		if (chunkTexts.length > 0) {
			contentText = chunkTexts.join("\n\n");
			contentSource = "chunks";
		}

		if (!contentText) {
			const contentArea = findContentArea?.();
			const storedOriginal = contentArea
				?.getAttribute("data-original-text")
				?.trim();
			if (storedOriginal) {
				contentText = storedOriginal;
				contentSource = "data-original-text";
			}
		}

		if (!contentText) {
			const extracted = extractContent?.();
			if (extracted && extracted.text?.trim()) {
				contentText = extracted.text.trim();
				contentSource = "live-extraction";
			}
		}

		if (!contentText) {
			const msg =
				"No content found on this page. Make sure a chapter page is loaded.";
			showStatusMessage?.(msg, "warning", 5000);
			if (summaryTextContainer) {
				summaryTextContainer.style.display = "block";
				summaryTextContainer.textContent = msg;
			}
			return;
		}

		debugLog(
			`Inline fallback collected ${contentText.length} chars from ${contentSource}`,
		);

		if (btn) btn.textContent = "Summarising...";
		if (statusDiv)
			statusDiv.textContent = `Sending to Gemini for ${summaryType.toLowerCase()} summary...`;

		const action = isShort
			? "shortSummarizeWithGemini"
			: "summarizeWithGemini";
		const response = await sendMessageWithRetry?.({
			action,
			title: documentRef.title,
			content: contentText,
		});

		if (!response?.success || !response.summary) {
			const errMsg = response?.error || "Failed to generate summary.";
			if (errMsg.includes("API key is missing")) {
				showStatusMessage?.(
					"API key is missing. Opening settings page...",
					"error",
				);
				browserRef.runtime.sendMessage({ action: "openPopup" });
			}
			throw new Error(errMsg);
		}

		renderSummaryOutputRuntime({
			container: summaryTextContainer,
			summary: response.summary,
			summaryType,
			summaryService: null,
			findContentArea,
			stripHtmlTags: stripHtmlTags || ((value) => value),
			documentRef,
			windowRef,
		});
		if (statusDiv)
			statusDiv.textContent = "Summary generated successfully!";
		showStatusMessage?.(
			`${summaryType} summary generated!`,
			"success",
			3000,
		);
		await queueSummaryReviewRecommendationRuntime({
			storageApi: browserRef.storage.local,
			pendingKey: PENDING_SUMMARY_REVIEW_KEY,
			isShort,
			chunkIndices,
			lastKnownNovelData: getLastKnownNovelData?.() || null,
			documentRef,
			windowRef,
		});

		try {
			const cachedNovelData = getLastKnownNovelData?.();
			const novelId = cachedNovelData?.id;
			const chapterNumber = cachedNovelData?.currentChapter;
			if (novelId && chapterNumber != null) {
				const novelLibrary = await loadNovelLibrary?.();
				if (novelLibrary) {
					const totalChunkEls = documentRef.querySelectorAll(
						".gemini-chunk-content",
					);
					await novelLibrary.updateChapter(novelId, {
						chapterNumber,
						url: windowRef.location.href,
						isSummarized: true,
						summaryType: isShort ? "short" : "long",
						totalChunksForChapter: totalChunkEls.length || 1,
						summarizedAt: Date.now(),
					});
				}
			}
		} catch (_e) {
			/* silent */
		}
	} catch (error) {
		debugError("Inline summary fallback error:", error);
		if (statusDiv) {
			statusDiv.textContent = error.message.includes("API key")
				? "API key is missing. Please check the settings."
				: `Error: ${error.message}`;
		}
		if (summaryTextContainer) {
			summaryTextContainer.style.display = "block";
			summaryTextContainer.textContent = `Failed to generate summary: ${error.message}`;
		}
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.textContent = originalBtnText;
		}
		setTimeout(() => {
			if (statusDiv?.textContent?.includes("Summary generated")) {
				statusDiv.textContent = "";
			}
		}, 5000);
	}
}

export default {
	loadSummaryServiceRuntime,
	renderSummaryOutputRuntime,
	queueSummaryReviewRecommendationRuntime,
	summarizeChunkRangeRuntime,
};
