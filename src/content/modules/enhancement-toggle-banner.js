/**
 * Enhancement banner refresh helpers extracted from content.js.
 */

export function attachDeleteCacheButtonHandlerRuntime({
	banner,
	storageManager,
	windowRef = window,
	showStatusMessage,
	onDeleted = null,
}) {
	const deleteButton = banner?.querySelector(".gemini-delete-cache-btn");
	if (!deleteButton) return;

	deleteButton.addEventListener("click", async () => {
		if (!confirm("Delete cached enhanced content for this page?")) {
			return;
		}
		if (!storageManager) return;

		await storageManager.removeEnhancedContent(windowRef.location.href);
		if (typeof onDeleted === "function") {
			onDeleted();
		}
		showStatusMessage?.(
			"Cached content deleted. Reloading page...",
			"info",
		);
		setTimeout(() => windowRef.location.reload(), 1000);
	});
}

export function refreshToggleBannerRuntime({
	contentArea,
	createBanner,
	toggleLabel,
	onToggleClick,
	insertBeforeNode = null,
	wireDeleteCache = false,
	windowRef = window,
	storageManager,
	showStatusMessage,
	insertNodeAtContentTop,
}) {
	if (!contentArea || typeof createBanner !== "function") return null;

	const refreshedBanner = createBanner();
	if (!refreshedBanner) return null;

	const refreshedToggleButton = refreshedBanner.querySelector(
		".gemini-toggle-btn",
	);
	if (refreshedToggleButton) {
		refreshedToggleButton.textContent = toggleLabel;
		if (typeof onToggleClick === "function") {
			refreshedToggleButton.addEventListener("click", onToggleClick);
		}
	}

	if (wireDeleteCache) {
		attachDeleteCacheButtonHandlerRuntime({
			banner: refreshedBanner,
			storageManager,
			windowRef,
			showStatusMessage,
		});
	}

	if (insertBeforeNode) {
		contentArea.insertBefore(refreshedBanner, insertBeforeNode);
	} else if (typeof insertNodeAtContentTop === "function") {
		insertNodeAtContentTop(contentArea, refreshedBanner);
	} else if (contentArea.firstChild) {
		contentArea.insertBefore(refreshedBanner, contentArea.firstChild);
	} else {
		contentArea.appendChild(refreshedBanner);
	}

	return refreshedBanner;
}

export default {
	attachDeleteCacheButtonHandlerRuntime,
	refreshToggleBannerRuntime,
};
