/**
 * Enhancement banner visibility helpers extracted from content.js.
 */

function getBannerSelector() {
	// All Ranobe Gemini UI elements on the page — toggled together by Hide/Show UI.
	return [
		// Enhancement flow banners
		".gemini-chunk-banner",
		".gemini-master-banner",
		".gemini-wip-banner",
		".gemini-main-summary-group",
		".gemini-chunk-summary-group",
		".gemini-summary-text-container",
		".gemini-short-summary-text-container",
		".gemini-main-summary-banner",
		// Controls bars
		"#gemini-controls",
		"#rg-chapter-novel-controls",
		// Notification / update banners
		"#rg-notification-banner",
	].join(", ");
}

export function shouldBannersBeHiddenRuntime({
	documentRef = document,
	currentHandler,
}) {
	// Prefer the body attribute as the authoritative state — it is set/cleared
	// by toggleEnhancedBannersRuntime and survives even when there is no
	// toggle button on the page (e.g. after we moved it to the popup).
	if (documentRef.body.hasAttribute("data-rg-ui-hidden")) {
		return true; // currently hidden → toggle will show
	}

	// Fallback: use the on-page toggle button text when present.
	const toggleBtn = documentRef.querySelector(".gemini-toggle-banners-btn");
	if (toggleBtn) {
		return toggleBtn.textContent.includes("Show");
	}

	// No state tracked yet → respect the handler's default.
	return currentHandler?.constructor?.DEFAULT_BANNERS_VISIBLE === false;
}

function toggleBannerNodes(documentRef, isHidden) {
	const banners = documentRef.querySelectorAll(getBannerSelector());
	if (banners.length === 0) return 0;

	banners.forEach((banner) => {
		if (isHidden) {
			const saved = banner.dataset.rgSavedDisplay;
			banner.style.display = saved !== undefined ? saved : "";
			delete banner.dataset.rgSavedDisplay;
			return;
		}

		banner.dataset.rgSavedDisplay = banner.style.display;
		banner.style.display = "none";
	});

	return banners.length;
}

function syncToggleButtons(documentRef, isHidden, callerBtn = null) {
	const nextChapterLabel = isHidden
		? "⚡ Hide Gemini UI"
		: "⚡ Show Gemini UI";
	const nextMainLabel = isHidden
		? '<span style="font-size: 20px;">⚡</span> <span style="font-weight: 600;">Hide Ranobe Gemini</span>'
		: '<span style="font-size: 20px;">⚡</span> <span style="font-weight: 600;">Show Ranobe Gemini</span>';

	const toggleBtn = documentRef.querySelector(".gemini-toggle-banners-btn");
	if (toggleBtn) {
		toggleBtn.innerHTML = nextMainLabel;
	}

	const chapterToggleBtn =
		callerBtn || documentRef.querySelector(".gemini-chapter-toggle-btn");
	if (chapterToggleBtn) {
		chapterToggleBtn.innerHTML = nextChapterLabel;
	}
}

export function toggleEnhancedBannersRuntime({
	documentRef = document,
	currentHandler,
	showStatusMessage,
	callerBtn = null,
	onVisibilityChange = null,
}) {
	const banners = documentRef.querySelectorAll(getBannerSelector());
	if (banners.length === 0) {
		showStatusMessage?.("No enhancement banners to show/hide.", "info");
		return false;
	}

	const isHidden = shouldBannersBeHiddenRuntime({
		documentRef,
		currentHandler,
	});
	toggleBannerNodes(documentRef, isHidden);

	const nowHidden = !isHidden;
	if (nowHidden) {
		documentRef.body.setAttribute("data-rg-ui-hidden", "true");
	} else {
		documentRef.body.removeAttribute("data-rg-ui-hidden");
	}

	syncToggleButtons(documentRef, !nowHidden, callerBtn);
	onVisibilityChange?.(nowHidden);

	showStatusMessage?.(
		nowHidden ? "Ranobe Gemini UI hidden." : "Showing Ranobe Gemini UI...",
		"info",
		2000,
	);

	return true;
}

/**
 * Apply a stored hidden/visible state without toggling — used on page load.
 * @param {boolean} shouldBeHidden
 * @param {Document} documentRef
 * @param {object} currentHandler
 */
export function applyStoredVisibilityRuntime({
	shouldBeHidden,
	documentRef = document,
	currentHandler,
}) {
	const currentlyHidden = shouldBannersBeHiddenRuntime({
		documentRef,
		currentHandler,
	});
	if (currentlyHidden === shouldBeHidden) return;
	toggleBannerNodes(documentRef, !shouldBeHidden);
	if (shouldBeHidden) {
		documentRef.body.setAttribute("data-rg-ui-hidden", "true");
	} else {
		documentRef.body.removeAttribute("data-rg-ui-hidden");
	}
	syncToggleButtons(documentRef, !shouldBeHidden, null);
}

export default {
	shouldBannersBeHiddenRuntime,
	toggleEnhancedBannersRuntime,
	applyStoredVisibilityRuntime,
};
