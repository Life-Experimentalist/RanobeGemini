/**
 * Enhancement banner visibility helpers extracted from content.js.
 */

function getBannerSelector() {
	return ".gemini-chunk-banner, .gemini-master-banner, .gemini-wip-banner, .gemini-main-summary-group, .gemini-chunk-summary-group, .gemini-summary-text-container";
}

export function shouldBannersBeHiddenRuntime({
	documentRef = document,
	currentHandler,
}) {
	const toggleBtn = documentRef.querySelector(".gemini-toggle-banners-btn");
	if (!toggleBtn) {
		return currentHandler?.constructor?.DEFAULT_BANNERS_VISIBLE === false;
	}
	return toggleBtn.textContent.includes("Show");
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
		? "\u{26A1} Hide Gemini UI"
		: "\u{26A1} Show Gemini UI";
	const nextMainLabel = isHidden
		? '<span style="font-size: 20px;">\u{26A1}</span> <span style="font-weight: 600;">Hide Ranobe Gemini</span>'
		: '<span style="font-size: 20px;">\u{26A1}</span> <span style="font-weight: 600;">Show Ranobe Gemini</span>';

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

	if (isHidden) {
		documentRef.body.removeAttribute("data-rg-ui-hidden");
	} else {
		documentRef.body.setAttribute("data-rg-ui-hidden", "true");
	}

	syncToggleButtons(documentRef, isHidden, callerBtn);

	showStatusMessage?.(
		isHidden ? "Showing Ranobe Gemini UI..." : "Ranobe Gemini UI hidden.",
		"info",
		2000,
	);

	return true;
}

export default {
	shouldBannersBeHiddenRuntime,
	toggleEnhancedBannersRuntime,
};
