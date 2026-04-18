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

	const isShowingEnhanced = toggleBtn.getAttribute("data-showing") === "enhanced";
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
		toggleBtn.textContent = "Γ£¿ Show Enhanced";
		toggleBtn.setAttribute("data-showing", "original");
		return;
	}

	chunkContent.innerHTML = enhancedContent;
	applyCollapsibleSections(chunkContent);
	toggleBtn.textContent = "≡ƒæü Show Original";
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
		`Chunk ${chunkIndex} marked for skip ΓÇö will discard result on arrival.`,
	);
}

export async function handlePauseChunkRuntime({
	chunkIndex,
	chunkControlRuntime,
	debugLog = () => {},
}) {
	chunkControlRuntime?.markPause(chunkIndex);
	debugLog(
		`Chunk ${chunkIndex} marked for pause ΓÇö will store result without applying.`,
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

	const nTotalChunks = documentRef.querySelectorAll(".gemini-chunk-banner").length;
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
	const freshBanner = documentRef.querySelector(`.chunk-banner-${chunkIndex}`);
	if (freshBanner) freshBanner.replaceWith(completedBanner);

	const allChunkEls = documentRef.querySelectorAll(".gemini-chunk-content");
	const doneEls = documentRef.querySelectorAll(
		'.gemini-chunk-content[data-chunk-enhanced="true"]',
	);
	const allDone = doneEls.length === allChunkEls.length && allChunkEls.length > 0;

	if (allDone) {
		documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
			btn.textContent = "≡ƒöä Re-enhance with Gemini";
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
		`Chunk ${chunkIndex + 1} enhancement applied! Γ£¿`,
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

	const nTotalChunks = documentRef.querySelectorAll(".gemini-chunk-banner").length;
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
	const freshBanner = documentRef.querySelector(`.chunk-banner-${chunkIndex}`);
	if (freshBanner) freshBanner.replaceWith(pendingBanner);

	showStatusMessage?.(
		`Chunk ${chunkIndex + 1} enhancement discarded.`,
		"info",
		2000,
	);
}

export default {
	toggleChunkViewRuntime,
	deleteChunkEnhancementRuntime,
	handleChunkToggleRuntime,
	handleSkipChunkRuntime,
	handlePauseChunkRuntime,
	handleShowEnhancedChunkRuntime,
	handleDiscardPausedChunkRuntime,
};
