import * as banners from "./ui-banners.js";
import * as controls from "./ui-controls.js";

export function createUIElementsRuntime({
	documentRef = document,
	windowRef = window,
	browserRef = browser,
	isMobileDevice = false,
	protectFromThemeExtensions = (el) => el,
	currentHandler = null,
	getNovelLibrary = async () => null,
	debugError = () => {},
	handlers = {},
} = {}) {
	const createToggleBannersButton = () =>
		banners.createToggleBannersButton({
			documentRef,
			onToggleBanners: handlers.onToggleBanners,
		});

	const createEnhanceButton = () =>
		controls.createEnhanceButton({
			documentRef,
			onEnhance: handlers.onEnhance,
		});

	const createCancelEnhanceButton = () =>
		controls.createCancelEnhanceButton({
			documentRef,
			onCancelEnhance: handlers.onCancelEnhance,
		});

	const removeChapterNovelControlsFromDOM = () =>
		controls.removeChapterNovelControlsFromDOM(documentRef);

	const placeChapterNovelControls = (novelControls, config) =>
		controls.placeChapterNovelControls(novelControls, {
			controlsConfig: config,
			documentRef,
			currentHandler,
		});

	const createChapterPageNovelControls = (params) =>
		controls.createChapterPageNovelControls({
			documentRef,
			browserRef,
			windowRef,
			currentHandler,
			getNovelLibrary,
			protectFromThemeExtensions,
			isIncognitoActive: params.isIncognitoActive,
			debugError,
			...params,
		});

	const injectNovelPageUI = (params) =>
		controls.injectNovelPageUI({
			documentRef,
			browserRef,
			windowRef,
			currentHandler,
			getNovelLibrary,
			protectFromThemeExtensions,
			isMobileDevice,
			...params,
		});

	const injectUI = (params) =>
		controls.injectUI({
			documentRef,
			protectFromThemeExtensions,
			createEnhanceButton,
			createCancelEnhanceButton,
			isMobileDevice,
			...params,
		});

	return {
		createToggleBannersButton,
		createCancelEnhanceButton,
		createEnhanceButton,
		injectNovelPageUI,
		createChapterPageNovelControls,
		injectUI,
		removeChapterNovelControlsFromDOM,
		placeChapterNovelControls,
	};
}

export const showProgressUpdatePromptRuntime =
	banners.showProgressUpdatePromptRuntime;
export const showRereadingBannerRuntime = banners.showRereadingBannerRuntime;
export const deriveReadingStatusFromProgressRuntime =
	banners.deriveReadingStatusFromProgressRuntime;
export const shouldShowProgressPromptRuntime =
	banners.shouldShowProgressPromptRuntime;

export default {
	createUIElementsRuntime,
	showProgressUpdatePromptRuntime,
	showRereadingBannerRuntime,
	deriveReadingStatusFromProgressRuntime,
	shouldShowProgressPromptRuntime,
};
