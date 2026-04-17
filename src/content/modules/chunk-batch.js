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
