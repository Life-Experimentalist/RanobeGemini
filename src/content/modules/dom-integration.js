/**
 * DOM integration helpers for chunk runtime banner insertion.
 */

export function ensureMasterBannerRuntime({
	documentRef = document,
	contentArea,
	chunking,
	totalChunks,
	originalWords,
	enhancedWords,
	isCached = false,
	lastChunkModelInfo,
	cacheMeta = null,
	shouldBannersBeHidden,
	onToggleAll,
	onDeleteAll,
	confirmFn,
}) {
	if (!contentArea || !chunking?.ui || !chunking?.core) return false;

	const existingMaster = documentRef.querySelector(".gemini-master-banner");
	if (existingMaster) return false;

	const allChunkEls = documentRef.querySelectorAll(".gemini-chunk-content");
	const resolvedOriginalWords = Number.isFinite(originalWords)
		? originalWords
		: Array.from(allChunkEls).reduce((sum, chunk) => {
				return (
					sum +
					chunking.core.countWords(
						chunk.getAttribute("data-original-chunk-content") || "",
					)
				);
			}, 0);
	const resolvedEnhancedWords = Number.isFinite(enhancedWords)
		? enhancedWords
		: Array.from(allChunkEls).reduce((sum, chunkContent) => {
				return sum + chunking.core.countWords(chunkContent.innerHTML);
			}, 0);

	const resolvedTotalChunks =
		totalChunks && Number.isFinite(totalChunks)
			? totalChunks
			: allChunkEls.length;
	const masterBanner = chunking.ui.createMasterBanner(
		resolvedOriginalWords,
		resolvedEnhancedWords,
		resolvedTotalChunks,
		isCached,
		lastChunkModelInfo,
		cacheMeta,
	);

	const toggleAllBtn = masterBanner.querySelector(
		".gemini-master-toggle-all-btn",
	);
	if (toggleAllBtn) {
		toggleAllBtn.setAttribute("data-showing", "enhanced");
		toggleAllBtn.addEventListener("click", (e) => {
			e.preventDefault();
			onToggleAll?.();
		});
	}

	const deleteAllBtn = masterBanner.querySelector(
		".gemini-master-delete-all-btn",
	);
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

export function upsertWorkInProgressBannerRuntime({
	documentRef = document,
	newBanner,
	findContentArea,
}) {
	if (!newBanner) return false;

	const existingBanner = documentRef.querySelector(".gemini-wip-banner");
	if (existingBanner && existingBanner.parentNode) {
		existingBanner.parentNode.replaceChild(newBanner, existingBanner);
		return true;
	}

	const contentArea = findContentArea?.();
	if (!contentArea) return false;

	const chunkedContainer = documentRef.getElementById(
		"gemini-chunked-content",
	);
	if (chunkedContainer) {
		contentArea.insertBefore(newBanner, chunkedContainer);
		return true;
	}

	contentArea.insertBefore(newBanner, contentArea.firstChild);
	return true;
}

export function clearTransientEnhancementBannersRuntime({
	documentRef = document,
	removeErrorBanner = false,
}) {
	const wipBanner = documentRef.querySelector(".gemini-wip-banner");
	if (wipBanner) {
		wipBanner.remove();
	}

	if (!removeErrorBanner) return;

	const errorBanner = documentRef.querySelector(".gemini-error-banner");
	if (errorBanner) {
		errorBanner.remove();
	}
}

export function insertMainUiBlocksRuntime({
	insertionPoint,
	insertionPosition = "before",
	controlsContainer,
	mainSummaryGroup = null,
	siteEnhancementsContainer = null,
	versionSwitcherContainer = null,
}) {
	if (!insertionPoint || !controlsContainer) return false;

	if (insertionPosition === "before" || insertionPosition === "beforebegin") {
		if (!insertionPoint.parentNode) return false;
		if (siteEnhancementsContainer) {
			insertionPoint.parentNode.insertBefore(
				siteEnhancementsContainer,
				insertionPoint,
			);
		}
		insertionPoint.parentNode.insertBefore(
			controlsContainer,
			insertionPoint,
		);
		if (mainSummaryGroup) {
			insertionPoint.parentNode.insertBefore(
				mainSummaryGroup,
				insertionPoint,
			);
		}
		return true;
	}

	if (insertionPosition === "after" || insertionPosition === "afterend") {
		if (!insertionPoint.parentNode) return false;
		if (siteEnhancementsContainer) {
			insertionPoint.parentNode.insertBefore(
				siteEnhancementsContainer,
				insertionPoint.nextSibling,
			);
		}
		insertionPoint.parentNode.insertBefore(
			controlsContainer,
			siteEnhancementsContainer
				? siteEnhancementsContainer.nextSibling
				: insertionPoint.nextSibling,
		);
		if (mainSummaryGroup) {
			insertionPoint.parentNode.insertBefore(
				mainSummaryGroup,
				controlsContainer.nextSibling,
			);
		}
		return true;
	}

	if (insertionPosition === "prepend" || insertionPosition === "afterbegin") {
		if (versionSwitcherContainer) {
			insertionPoint.prepend(versionSwitcherContainer);
		}
		insertionPoint.prepend(controlsContainer);
		if (mainSummaryGroup) {
			insertionPoint.insertBefore(
				mainSummaryGroup,
				controlsContainer.nextSibling,
			);
		}
		return true;
	}

	if (insertionPosition === "append" || insertionPosition === "beforeend") {
		if (versionSwitcherContainer) {
			insertionPoint.appendChild(versionSwitcherContainer);
		}
		insertionPoint.appendChild(controlsContainer);
		if (mainSummaryGroup) {
			insertionPoint.appendChild(mainSummaryGroup);
		}
		return true;
	}

	if (!insertionPoint.parentNode) return false;
	insertionPoint.parentNode.insertBefore(controlsContainer, insertionPoint);
	if (mainSummaryGroup) {
		insertionPoint.parentNode.insertBefore(
			mainSummaryGroup,
			insertionPoint,
		);
	}
	return true;
}

export function insertAfterControlsOrTopRuntime({
	documentRef = document,
	contentArea,
	node,
	controlsSelector = "#gemini-controls",
}) {
	if (!contentArea || !node) return false;

	const controlsContainer = documentRef.querySelector(controlsSelector);
	if (controlsContainer?.parentNode) {
		controlsContainer.parentNode.insertBefore(
			node,
			controlsContainer.nextSibling,
		);
		return true;
	}

	contentArea.insertBefore(node, contentArea.firstChild);
	return true;
}

export function insertAtContentTopRuntime({ contentArea, node }) {
	if (!contentArea || !node) return false;
	if (contentArea.firstChild) {
		contentArea.insertBefore(node, contentArea.firstChild);
	} else {
		contentArea.appendChild(node);
	}
	return true;
}
