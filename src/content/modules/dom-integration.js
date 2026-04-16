/**
 * DOM integration helpers for chunk runtime banner insertion.
 */

export function ensureMasterBannerRuntime({
	documentRef = document,
	contentArea,
	chunking,
	totalChunks,
	lastChunkModelInfo,
	shouldBannersBeHidden,
	onToggleAll,
	onDeleteAll,
	confirmFn,
}) {
	if (!contentArea || !chunking?.ui || !chunking?.core) return false;

	const existingMaster = documentRef.querySelector(".gemini-master-banner");
	if (existingMaster) return false;

	const allChunkEls = documentRef.querySelectorAll(".gemini-chunk-content");
	const originalWords = Array.from(allChunkEls).reduce((sum, chunk) => {
		return (
			sum +
			chunking.core.countWords(
				chunk.getAttribute("data-original-chunk-content") || "",
			)
		);
	}, 0);
	const enhancedWords = Array.from(allChunkEls).reduce((sum, chunkContent) => {
		return sum + chunking.core.countWords(chunkContent.innerHTML);
	}, 0);

	const resolvedTotalChunks =
		totalChunks && Number.isFinite(totalChunks) ? totalChunks : allChunkEls.length;
	const masterBanner = chunking.ui.createMasterBanner(
		originalWords,
		enhancedWords,
		resolvedTotalChunks,
		false,
		lastChunkModelInfo,
		null,
	);

	const toggleAllBtn = masterBanner.querySelector(".gemini-master-toggle-all-btn");
	if (toggleAllBtn) {
		toggleAllBtn.setAttribute("data-showing", "enhanced");
		toggleAllBtn.addEventListener("click", (e) => {
			e.preventDefault();
			onToggleAll?.();
		});
	}

	const deleteAllBtn = masterBanner.querySelector(".gemini-master-delete-all-btn");
	if (deleteAllBtn) {
		deleteAllBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			if (
				confirmFn?.(
					"Delete all cached enhanced content for this chapter?",
				)
			) {
				await onDeleteAll?.();
			}
		});
	}

	if (shouldBannersBeHidden?.()) {
		masterBanner.style.display = "none";
	}

	contentArea.insertBefore(masterBanner, contentArea.firstChild);
	return true;
}
