/**
 * Runtime for finalizing chunked enhanced content in prefix mode.
 */

export async function finalizePrefixEnhancedContentRuntime({
	modelInfo,
	findContentArea,
	stripHtmlTags,
	storageManager,
	windowRef = window,
	documentRef = document,
	debugLog = () => {},
	debugError = () => {},
	extractNovelContext,
	addToNovelLibrary,
	updateChapterProgression,
	createEnhancedBanner,
	attachDeleteCacheButtonHandler,
	showStatusMessage,
	refreshToggleBanner,
	domIntegrationModule,
	getIsCachedContent = () => false,
	onCachedContentSaved,
}) {
	const contentArea = findContentArea?.();
	if (!contentArea) return;

	const enhancedContainer = documentRef.getElementById(
		"gemini-enhanced-container",
	);
	if (!enhancedContainer) {
		debugError("No enhanced container found for finalization");
		return;
	}

	const originalContent =
		contentArea.getAttribute("data-original-html") ||
		contentArea.getAttribute("data-original-content") ||
		documentRef.getElementById("gemini-original-content")?.innerHTML ||
		"";

	const originalText = stripHtmlTags(originalContent);
	const enhancedContent = enhancedContainer.innerHTML;
	const enhancedText = stripHtmlTags(enhancedContent);

	if (storageManager && enhancedContent) {
		try {
			await storageManager.saveEnhancedContent(windowRef.location.href, {
				title: documentRef.title,
				originalContent,
				enhancedContent,
				modelInfo,
				timestamp: Date.now(),
				isChunked: true,
			});
			onCachedContentSaved?.();
			debugLog("Chunked enhanced content saved to cache");
		} catch (saveError) {
			debugError("Failed to save chunked content to cache:", saveError);
		}
	}

	try {
		const novelContext = extractNovelContext?.();
		await addToNovelLibrary?.(novelContext);
		await updateChapterProgression?.();
	} catch (libraryError) {
		debugError("Failed to update novel library:", libraryError);
	}

	const banner = createEnhancedBanner?.(
		originalText,
		enhancedText,
		modelInfo,
		getIsCachedContent(),
	);
	if (!banner) return;

	attachDeleteCacheButtonHandler?.(banner);

	const toggleButton = banner.querySelector(".gemini-toggle-btn");
	if (toggleButton) {
		const toggleContent = function () {
			const isShowingEnhanced =
				contentArea.getAttribute("data-showing-enhanced") === "true";
			if (isShowingEnhanced) {
				contentArea.innerHTML = originalContent;
				contentArea.setAttribute("data-showing-enhanced", "false");
				showStatusMessage?.(
					"Showing original content. Click 'Show Enhanced' to view the improved version.",
				);
				refreshToggleBanner?.({
					contentArea,
					createBanner: () =>
						createEnhancedBanner?.(
							originalText,
							enhancedText,
							modelInfo,
							getIsCachedContent(),
						),
					toggleLabel: "Show Enhanced",
					onToggleClick: toggleContent,
					insertBeforeNode: contentArea.firstChild,
					wireDeleteCache: true,
				});
			} else {
				contentArea.innerHTML = "";
				contentArea.appendChild(enhancedContainer);
				contentArea.setAttribute("data-showing-enhanced", "true");
				showStatusMessage?.(
					"Showing enhanced content. Click 'Show Original' to view the original version.",
				);
				refreshToggleBanner?.({
					contentArea,
					createBanner: () =>
						createEnhancedBanner?.(
							originalText,
							enhancedText,
							modelInfo,
							getIsCachedContent(),
						),
					toggleLabel: "Show Original",
					onToggleClick: toggleContent,
					insertBeforeNode: enhancedContainer,
					wireDeleteCache: true,
				});
			}
		};
		toggleButton.addEventListener("click", toggleContent);
	}

	contentArea.setAttribute("data-showing-enhanced", "true");

	const existingBanner = contentArea.querySelector(".gemini-enhanced-banner");
	if (existingBanner) {
		existingBanner.remove();
	}

	contentArea.insertBefore(banner, enhancedContainer);
	contentArea.setAttribute("data-showing-enhanced", "true");

	if (domIntegrationModule?.clearTransientEnhancementBannersRuntime) {
		domIntegrationModule.clearTransientEnhancementBannersRuntime({
			documentRef,
			removeErrorBanner: true,
		});
	} else {
		const wipBanner = documentRef.querySelector(".gemini-wip-banner");
		if (wipBanner) {
			wipBanner.remove();
		}

		const errorBanner = documentRef.querySelector(".gemini-error-banner");
		if (errorBanner) {
			errorBanner.remove();
		}
	}

	enhancedContainer.classList.add("gemini-processing-complete");
}

export default {
	finalizePrefixEnhancedContentRuntime,
};
