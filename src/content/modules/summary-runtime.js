/**
 * Summary runtime helpers extracted from content.js.
 *
 * This module owns summary-service loading and summary render fallback.
 */

let summaryServiceModule = null;

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
			totalChunks >= 12
				? "high"
				: totalChunks >= 9
					? "medium"
					: "normal";
		const reviewId = `${novelId}::${chapterNumber ?? "unknown"}::${summaryType}`;

		const existingData = await storageApi.get(pendingKey);
		const currentQueue = Array.isArray(existingData?.[pendingKey])
			? existingData[pendingKey]
			: [];

		let hasPending = false;
		const nextQueue = currentQueue.map((item) => {
			if (item?.id === reviewId && (item?.status || "pending") === "pending") {
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
		await storageApi.set({
			[pendingKey]: nextQueue.slice(0, 200),
		});
	} catch (_error) {
		// Non-blocking: review recommendation queue should never break summary flow.
	}
}
