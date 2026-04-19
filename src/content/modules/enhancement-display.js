/**
 * Enhancement display helper functions extracted from content.js.
 */

export function showProcessingErrorRuntime({
	errorMessage,
	documentRef = document,
	findContentArea,
	insertNodeAtContentTop,
	debugError = () => {},
}) {
	debugError("Processing error:", errorMessage);

	const contentArea =
		typeof findContentArea === "function" ? findContentArea() : null;
	if (!contentArea) return;

	const errorBox = documentRef.createElement("div");
	errorBox.className = "gemini-error-box";
	errorBox.style.cssText = `
        background-color: #fff3cd;
        border: 1px solid #ffeeba;
        color: #856404;
        padding: 15px;
        margin: 15px 0;
        border-radius: 5px;
    `;

	errorBox.innerHTML = `
        <strong>Error processing content with Gemini:</strong>
        <p>${errorMessage}</p>
        <p>Please try again or check your API key and settings.</p>
    `;

	if (typeof insertNodeAtContentTop === "function") {
		insertNodeAtContentTop(contentArea, errorBox);
	}
}

export function removeOriginalWordCountRuntime({ documentRef = document }) {
	const existingWordCount = documentRef.querySelector(".gemini-word-count");
	if (existingWordCount) {
		existingWordCount.remove();
	}
}

export function addWordCountDisplayRuntime({
	contentArea,
	originalCount,
	newCount,
	documentRef = document,
	insertAfterControlsOrTop,
}) {
	const existingWordCount = documentRef.querySelector(".gemini-word-count");
	if (existingWordCount) {
		const percentChange = (
			((newCount - originalCount) / originalCount) *
			100
		).toFixed(1);
		const changeText =
			percentChange >= 0
				? `+${percentChange}% increase`
				: `${percentChange}% decrease`;

		existingWordCount.innerHTML = `
<strong>  Word Count:</strong> ${originalCount} -> ${newCount} (${changeText})
`;
		return;
	}

	const wordCountContainer = documentRef.createElement("div");
	wordCountContainer.className = "gemini-word-count";
	wordCountContainer.style.cssText = `
margin: 10px 0 15px 0;
color: #bab9a0;
font-size: 14px;
text-align: left;
`;

	const percentChange = (
		((newCount - originalCount) / originalCount) *
		100
	).toFixed(1);
	const changeText =
		percentChange >= 0
			? `+${percentChange}% increase`
			: `${percentChange}% decrease`;

	wordCountContainer.innerHTML = `
<strong>  Word Count:</strong> ${originalCount} -> ${newCount} (${changeText})
`;

	if (typeof insertAfterControlsOrTop === "function") {
		insertAfterControlsOrTop(contentArea, wordCountContainer);
	}
}

export function applyDefaultFormattingRuntime({
	contentArea,
	formattingOptions,
}) {
	if (!contentArea) return;

	if (formattingOptions?.centerSceneHeadings) {
		const headingSelectors =
			"h2, h3, h4, .section-divider, hr.section-divider";
		contentArea.querySelectorAll(headingSelectors).forEach((el) => {
			if (el.tagName === "HR") {
				el.style.marginLeft = "auto";
				el.style.marginRight = "auto";
				el.style.width = "60%";
				return;
			}
			el.style.textAlign = "center";
			el.style.marginLeft = "auto";
			el.style.marginRight = "auto";
		});
	}
}

export function displayEnhancedContentRuntime({
	originalContent,
	enhancedContent,
	findContentArea,
	showStatusMessage,
	windowRef = window,
	sanitizeHTML,
	shouldUseTextOnlyEnhancement,
	getCurrentHandler,
	applyPostEnhancementFormatting,
	createEnhancedBanner,
	removeOriginalWordCount,
	refreshToggleBanner,
	enableCopyOnContentArea,
	insertNodeAtContentTop,
	debugLog = () => {},
	debugError = () => {},
}) {
	const contentArea = findContentArea?.();
	if (!contentArea) {
		showStatusMessage?.(
			"Unable to find content area for replacement",
			"error",
		);
		return false;
	}

	try {
		const scrollPosition = windowRef.scrollY;

		contentArea.setAttribute("data-original-content", originalContent);

		const sanitizedEnhancedContent = sanitizeHTML
			? sanitizeHTML(enhancedContent)
			: enhancedContent;

		contentArea.setAttribute(
			"data-enhanced-content",
			sanitizedEnhancedContent,
		);
		contentArea.setAttribute("data-showing-enhanced", "true");

		const currentHandler = getCurrentHandler?.();
		const supportsTextOnly = shouldUseTextOnlyEnhancement?.();

		if (
			supportsTextOnly &&
			typeof currentHandler?.applyEnhancedContent === "function"
		) {
			debugLog(
				"Handler provides text-only enhancement for display path; delegating...",
			);
			currentHandler.applyEnhancedContent(
				contentArea,
				sanitizedEnhancedContent,
			);
		} else {
			debugLog(
				"Using default full HTML replacement in displayEnhancedContent...",
			);
			contentArea.innerHTML = sanitizedEnhancedContent;
		}

		applyPostEnhancementFormatting?.(contentArea);

		const banner = createEnhancedBanner?.(
			originalContent,
			sanitizedEnhancedContent,
		);

		removeOriginalWordCount?.();

		const toggleButton = banner?.querySelector(".gemini-toggle-btn");
		if (toggleButton) {
			const toggleContent = function () {
				const isShowingEnhanced =
					contentArea.getAttribute("data-showing-enhanced") ===
					"true";
				if (isShowingEnhanced) {
					contentArea.innerHTML = sanitizeHTML
						? sanitizeHTML(originalContent)
						: originalContent;
					contentArea.setAttribute("data-showing-enhanced", "false");
					refreshToggleBanner?.({
						contentArea,
						createBanner: () =>
							createEnhancedBanner?.(
								originalContent,
								sanitizedEnhancedContent,
							),
						toggleLabel: "Show Enhanced",
						onToggleClick: toggleContent,
					});
				} else {
					contentArea.innerHTML = sanitizeHTML
						? sanitizeHTML(sanitizedEnhancedContent)
						: sanitizedEnhancedContent;
					contentArea.setAttribute("data-showing-enhanced", "true");

					applyPostEnhancementFormatting?.(contentArea);
					enableCopyOnContentArea?.(contentArea);
					refreshToggleBanner?.({
						contentArea,
						createBanner: () =>
							createEnhancedBanner?.(
								originalContent,
								sanitizedEnhancedContent,
							),
						toggleLabel: "Show Original",
						onToggleClick: toggleContent,
					});
				}
			};
			toggleButton.addEventListener("click", toggleContent);
		}

		const existingBanner = contentArea.querySelector(
			".gemini-enhanced-banner",
		);
		if (existingBanner) {
			existingBanner.remove();
		}

		if (banner && typeof insertNodeAtContentTop === "function") {
			insertNodeAtContentTop(contentArea, banner);
		}

		enableCopyOnContentArea?.(contentArea);

		windowRef.scrollTo(0, scrollPosition);

		showStatusMessage?.("Content successfully enhanced with Gemini!");

		return true;
	} catch (error) {
		debugError("Error displaying enhanced content:", error);
		showStatusMessage?.(`Error: ${error.message}`, "error");
		return false;
	}
}

export function normalizeEnhancedParagraphsRuntime({
	sanitizedContent,
	debugLog = () => {},
}) {
	let normalizedContent = sanitizedContent;

	if (!/<p[\s>]/i.test(normalizedContent)) {
		debugLog(
			"Enhanced content missing <p> tags, converting newlines to paragraphs",
		);
		const paragraphs = normalizedContent
			.split(/\n\n+/)
			.map((p) => p.trim())
			.filter((p) => p.length > 0);
		normalizedContent = paragraphs.map((p) => `<p>${p}</p>`).join("\n");
	}

	return normalizedContent;
}

export function persistEnhancedContentAttributesRuntime({
	contentArea,
	originalContent,
	debugLog = () => {},
}) {
	if (!contentArea) return;

	contentArea.setAttribute("data-original-content", originalContent);
	contentArea.setAttribute("data-enhanced-content", contentArea.innerHTML);
	contentArea.setAttribute("data-showing-enhanced", "true");

	const originalHasPTags = /<p[\s>]/i.test(originalContent);
	const enhancedHasPTags = /<p[\s>]/i.test(contentArea.innerHTML);
	debugLog(
		"Stored data attributes. Original length:",
		originalContent ? originalContent.length : 0,
		"Enhanced length:",
		contentArea.innerHTML ? contentArea.innerHTML.length : 0,
		"contentArea id:",
		contentArea.id,
		"Original has <p> tags:",
		originalHasPTags,
		"Enhanced has <p> tags:",
		enhancedHasPTags,
	);
	debugLog(
		"Original HTML preview:",
		originalContent ? originalContent.substring(0, 500) : "null",
	);
}

export function prepareCachedEnhancementUiRuntime({
	isFromCache,
	documentRef = document,
	onSetCachedFlags,
	regenerateLabel = "🔄 Regenerate with Gemini",
}) {
	if (!isFromCache) return;

	onSetCachedFlags?.();
	documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
		btn.textContent = regenerateLabel;
	});
}

export function resolveEnhancementPayloadRuntime({ enhancedContent }) {
	const modelInfo =
		typeof enhancedContent === "object" &&
		(enhancedContent.modelInfo || enhancedContent.modelUsed)
			? enhancedContent.modelInfo || {
					name: enhancedContent.modelUsed,
					provider: "Google Gemini",
				}
			: null;

	const enhancedContentText =
		typeof enhancedContent === "object" && enhancedContent.enhancedContent
			? enhancedContent.enhancedContent
			: enhancedContent;

	return {
		modelInfo,
		enhancedContentText,
	};
}

export function deriveOriginalEnhancementContentRuntime({
	isFromCache,
	enhancedContent,
	contentArea,
	stripHtmlTags,
	debugLog = () => {},
}) {
	const originalContent = isFromCache
		? enhancedContent.originalContent
		: contentArea.innerHTML;
	const originalText = isFromCache
		? stripHtmlTags(enhancedContent.originalContent)
		: contentArea.innerText || contentArea.textContent;

	debugLog(
		"replaceContentWithEnhancedVersion: isFromCache =",
		isFromCache,
		", originalContent has <p> tags =",
		/<p[\s>]/i.test(originalContent),
		", originalContent length =",
		originalContent?.length || 0,
	);

	return {
		originalContent,
		originalText,
	};
}

export function applyEnhancedPresentationRuntime({
	contentArea,
	applyPostEnhancementFormatting,
	currentFontSize,
}) {
	if (!contentArea) return;

	applyPostEnhancementFormatting?.(contentArea);

	if (currentFontSize && currentFontSize !== 100) {
		contentArea.style.fontSize = `${currentFontSize}%`;
	}
}

export function resolveNormalizedEnhancementPayloadRuntime({
	enhancedContent,
	sanitizeHTML,
	debugLog = () => {},
}) {
	const payload = resolveEnhancementPayloadRuntime({ enhancedContent }) || {};
	const modelInfo = payload.modelInfo || null;
	const enhancedContentText = payload.enhancedContentText ?? enhancedContent;
	const sanitizedContent =
		normalizeEnhancedParagraphsRuntime({
			sanitizedContent: sanitizeHTML(enhancedContentText),
			debugLog,
		}) || sanitizeHTML(enhancedContentText);

	return {
		modelInfo,
		enhancedContentText,
		sanitizedContent,
	};
}

export function prepareEnhancementFlowContextRuntime({
	enhancedContent,
	contentArea,
	documentRef = document,
	stripHtmlTags,
	sanitizeHTML,
	debugLog = () => {},
	onSetCachedFlags,
}) {
	const isFromCache =
		typeof enhancedContent === "object" &&
		enhancedContent.originalContent &&
		enhancedContent.timestamp;
	const cacheInfo = isFromCache
		? {
				fromCache: true,
				timestamp: enhancedContent.timestamp,
			}
		: null;

	prepareCachedEnhancementUiRuntime({
		isFromCache,
		documentRef,
		onSetCachedFlags,
	});

	const originalPayload = deriveOriginalEnhancementContentRuntime({
		isFromCache,
		enhancedContent,
		contentArea,
		stripHtmlTags,
		debugLog,
	});
	const resolvedPayload = resolveNormalizedEnhancementPayloadRuntime({
		enhancedContent,
		sanitizeHTML,
		debugLog,
	});

	return {
		isFromCache,
		cacheInfo,
		originalContent: originalPayload.originalContent,
		originalText: originalPayload.originalText,
		modelInfo: resolvedPayload.modelInfo,
		enhancedContentText: resolvedPayload.enhancedContentText,
		sanitizedContent: resolvedPayload.sanitizedContent,
	};
}

export function applyEnhancedContentToAreaRuntime({
	contentArea,
	sanitizedContent,
	originalContent,
	currentHandler,
	supportsTextOnly,
	preserveHtmlElements,
	preserveGameStatsBoxes,
	restoreGameStatsBoxes,
	sanitizeHTML,
	documentRef = document,
	debugLog = () => {},
}) {
	if (!contentArea) {
		return { newContent: "" };
	}

	let newContent = "";

	if (
		supportsTextOnly &&
		typeof currentHandler?.applyEnhancedContent === "function"
	) {
		debugLog(
			"Handler provides text-only enhancement; delegating paragraph updates...",
		);
		currentHandler.applyEnhancedContent(contentArea, sanitizedContent);
		newContent = contentArea.innerText || contentArea.textContent;
		return { newContent };
	}

	debugLog("Using default full HTML enhancement pathway...");
	const { preservedElements: originalImages } =
		preserveHtmlElements(originalContent);
	debugLog(`Preserved ${originalImages.length} images from original content`);
	const { modifiedContent: contentWithPreservedStats, preservedBoxes } =
		preserveGameStatsBoxes(sanitizedContent);
	let contentToDisplay = contentWithPreservedStats;
	if (preservedBoxes.length > 0) {
		debugLog(`Restoring ${preservedBoxes.length} game stats boxes`);
		contentToDisplay = restoreGameStatsBoxes(
			contentToDisplay,
			preservedBoxes,
		);
	}
	if (originalImages.length > 0) {
		const imageContainer = documentRef.createElement("div");
		imageContainer.className = "preserved-images-container";
		imageContainer.style.cssText =
			"\n\t\t\t\tmargin: 10px 0;\n\t\t\t\ttext-align: center;\n\t\t\t";
		originalImages.forEach((img) => {
			if (img.includes("<img")) {
				imageContainer.innerHTML += img;
			}
		});
		contentToDisplay = imageContainer.outerHTML + contentToDisplay;
	}
	contentArea.innerHTML = sanitizeHTML(contentToDisplay);
	newContent = contentArea.innerText || contentArea.textContent;

	return { newContent };
}

export function setupCachedEnhancementToggleBannerRuntime({
	contentArea,
	originalText,
	newContent,
	modelInfo,
	isCachedContent,
	cacheInfo,
	sanitizeHTML,
	applyPostEnhancementFormatting,
	enableCopyOnContentArea,
	refreshToggleBanner,
	createEnhancedBanner,
	debugLog = () => {},
	debugError = () => {},
}) {
	if (!contentArea) return;

	const setupToggleBanner = (showingEnhanced) => {
		const existingBanners = contentArea.querySelectorAll(
			".gemini-enhanced-banner",
		);
		existingBanners.forEach((b) => b.remove());

		debugLog(
			"Toggle button found, attaching click handler. showingEnhanced:",
			showingEnhanced,
		);

		const onToggleBannerClick = function (e) {
			debugLog("Toggle button clicked!");
			e.preventDefault();
			e.stopPropagation();

			const currentlyShowingEnhanced =
				contentArea.getAttribute("data-showing-enhanced") === "true";
			debugLog("currentlyShowingEnhanced:", currentlyShowingEnhanced);

			if (currentlyShowingEnhanced) {
				const storedOriginal = contentArea.getAttribute(
					"data-original-content",
				);
				debugLog(
					"Switching to original. storedOriginal length:",
					storedOriginal ? storedOriginal.length : 0,
					"Has <p> tags:",
					storedOriginal ? /<p[\s>]/i.test(storedOriginal) : false,
				);
				debugLog(
					"Restoring HTML preview:",
					storedOriginal ? storedOriginal.substring(0, 500) : "null",
				);
				if (storedOriginal) {
					contentArea.innerHTML = sanitizeHTML(storedOriginal);
					contentArea.setAttribute("data-showing-enhanced", "false");
					debugLog(
						"Switched to original content. Actual innerHTML has <p> tags:",
						/<p[\s>]/i.test(contentArea.innerHTML),
					);
				} else {
					debugError("No stored original content found!");
				}
			} else {
				const storedEnhanced = contentArea.getAttribute(
					"data-enhanced-content",
				);
				debugLog(
					"Switching to enhanced. storedEnhanced length:",
					storedEnhanced ? storedEnhanced.length : 0,
				);
				if (storedEnhanced) {
					contentArea.innerHTML = sanitizeHTML(storedEnhanced);
					contentArea.setAttribute("data-showing-enhanced", "true");

					applyPostEnhancementFormatting?.(contentArea);
					enableCopyOnContentArea?.(contentArea);
					debugLog("Switched to enhanced content");
				} else {
					debugError("No stored enhanced content found!");
				}
			}

			debugLog(
				"Setting up toggle banner for state:",
				!currentlyShowingEnhanced,
			);
			setupToggleBanner(!currentlyShowingEnhanced);
		};

		const newBanner = refreshToggleBanner?.({
			contentArea,
			createBanner: () =>
				createEnhancedBanner?.(
					originalText,
					newContent,
					modelInfo,
					isCachedContent,
					cacheInfo,
				),
			toggleLabel: showingEnhanced ? "Show Original" : "Show Enhanced",
			onToggleClick: onToggleBannerClick,
			wireDeleteCache: true,
		});

		debugLog(
			"Banner inserted. contentArea:",
			contentArea.id,
			"Banner parent:",
			newBanner?.parentNode ? newBanner.parentNode.id : "null",
		);
	};

	setupToggleBanner(true);
}

export async function finalizeCachedEnhancementRuntime({
	windowRef = window,
	scrollPosition,
	showStatusMessage,
	isFromCache,
	modelInfo,
	newContent,
	storageManager,
	documentRef = document,
	originalContent,
	enhancedContentText,
	setCachedFlag,
	debugLog = () => {},
	debugError = () => {},
	extractNovelContext,
	addToNovelLibrary,
	updateChapterProgression,
}) {
	windowRef.scrollTo(0, scrollPosition);
	showStatusMessage?.(
		"Content successfully enhanced with Gemini!",
		"success",
		5000,
		{
			metadata: {
				source: isFromCache ? "cache" : "fresh",
				model:
					modelInfo?.name ||
					modelInfo?.model ||
					modelInfo?.id ||
					null,
				contentLength: newContent?.length || null,
			},
		},
	);

	if (storageManager) {
		try {
			await storageManager.saveEnhancedContent(windowRef.location.href, {
				title: documentRef.title,
				originalContent,
				enhancedContent: enhancedContentText,
				modelInfo,
				timestamp: Date.now(),
			});
			setCachedFlag?.();
			debugLog("Enhanced content saved to cache");
		} catch (saveError) {
			debugError("Failed to save to cache:", saveError);
		}
	}

	try {
		const novelContext = extractNovelContext?.();
		await addToNovelLibrary?.(novelContext);
	} catch (libraryError) {
		debugError("Failed to add to novel library:", libraryError);
	}

	await updateChapterProgression?.();
}

export async function runEnhancedReplacementFlowRuntime({
	contentArea,
	sanitizedContent,
	originalContent,
	originalText,
	currentHandler,
	supportsTextOnly,
	preserveHtmlElements,
	preserveGameStatsBoxes,
	restoreGameStatsBoxes,
	sanitizeHTML,
	documentRef = document,
	debugLog = () => {},
	debugError = () => {},
	applyPostEnhancementFormatting,
	currentFontSize,
	removeOriginalWordCount,
	modelInfo,
	isCachedContent,
	cacheInfo,
	enableCopyOnContentArea,
	refreshToggleBanner,
	createEnhancedBanner,
	windowRef = window,
	scrollPosition,
	showStatusMessage,
	isFromCache,
	storageManager,
	enhancedContentText,
	setCachedFlag,
	extractNovelContext,
	addToNovelLibrary,
	updateChapterProgression,
}) {
	const displayResult = applyEnhancedContentToAreaRuntime({
		contentArea,
		sanitizedContent,
		originalContent,
		currentHandler,
		supportsTextOnly,
		preserveHtmlElements,
		preserveGameStatsBoxes,
		restoreGameStatsBoxes,
		sanitizeHTML,
		documentRef,
		debugLog,
	});
	const newContent =
		displayResult?.newContent ||
		contentArea.innerText ||
		contentArea.textContent;

	applyEnhancedPresentationRuntime({
		contentArea,
		applyPostEnhancementFormatting,
		currentFontSize,
	});

	persistEnhancedContentAttributesRuntime({
		contentArea,
		originalContent,
		debugLog,
	});

	removeOriginalWordCount?.();

	setupCachedEnhancementToggleBannerRuntime({
		contentArea,
		originalText,
		newContent,
		modelInfo,
		isCachedContent,
		cacheInfo,
		sanitizeHTML,
		applyPostEnhancementFormatting,
		enableCopyOnContentArea,
		refreshToggleBanner,
		createEnhancedBanner,
		debugLog,
		debugError,
	});

	enableCopyOnContentArea?.(contentArea);

	await finalizeCachedEnhancementRuntime({
		windowRef,
		scrollPosition,
		showStatusMessage,
		isFromCache,
		modelInfo,
		newContent,
		storageManager,
		documentRef,
		originalContent,
		enhancedContentText,
		setCachedFlag,
		debugLog,
		debugError,
		extractNovelContext,
		addToNovelLibrary,
		updateChapterProgression,
	});

	return { newContent };
}

export default {
	showProcessingErrorRuntime,
	removeOriginalWordCountRuntime,
	addWordCountDisplayRuntime,
	applyDefaultFormattingRuntime,
	displayEnhancedContentRuntime,
	normalizeEnhancedParagraphsRuntime,
	persistEnhancedContentAttributesRuntime,
	prepareCachedEnhancementUiRuntime,
	resolveEnhancementPayloadRuntime,
	deriveOriginalEnhancementContentRuntime,
	applyEnhancedPresentationRuntime,
	resolveNormalizedEnhancementPayloadRuntime,
	prepareEnhancementFlowContextRuntime,
	applyEnhancedContentToAreaRuntime,
	setupCachedEnhancementToggleBannerRuntime,
	finalizeCachedEnhancementRuntime,
	runEnhancedReplacementFlowRuntime,
};
