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
		toggleBtn.textContent = "✨ Show Enhanced";
		toggleBtn.setAttribute("data-showing", "original");
		return;
	}

	chunkContent.innerHTML = enhancedContent;
	applyCollapsibleSections(chunkContent);
	toggleBtn.textContent = "👁 Show Original";
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
		showStatusMessage("Original content not available for this chunk.", "error");
		return;
	}

	await chunking.cache.deleteChunkFromCache(windowRef.location.href, chunkIndex);

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

	showStatusMessage(`Chunk ${chunkIndex + 1} reverted to original.`, "info", 2000);
}
