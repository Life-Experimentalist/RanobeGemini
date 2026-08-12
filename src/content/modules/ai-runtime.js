/**
 * AI Runtime logic extracted from content.js
 * Handles Enhance, Summarize and other AI-related actions on the page.
 */

export async function handleEnhanceClickRuntime({
	documentRef = document,
	windowRef = window,
	browserRef = browser,
	loadChunkBatchModule,
	loadChunkingSystem,
	storageManager,
	cancelEnhanceButton,
	showStatusMessage,
	showWorkInProgressBanner,
	handleReenhanceChunk,
	getEnhancementCancelRequested,
	setEnhancementCancelRequested,
	isCachedContent,
	hasCachedContent,
	onResetChunkCacheFlags,
	onResetCacheFlags,
	onCacheLoaded,
	onCacheMiss,
	findContentArea,
	replaceContentWithEnhancedVersion,
	extractContent,
	wakeUpBackgroundWorker,
	setFormattingOptions,
	debugLog,
	debugError,
	getCleanContentHTML,
	buildChunkBanner,
	stripHtmlTags,
	summarizeChunkRange,
	shouldBannersBeHidden,
	enableCopyOnContentArea,
	novelLibrary,
	buildCombinedPrompt,
	sendMessageWithRetry,
	handleChunkProcessed,
}) {
	// Prevent concurrent invocations
	const firstBtn = documentRef.querySelector(".gemini-enhance-btn");
	if (firstBtn?.disabled) return;

	setEnhancementCancelRequested(false);

	const existingChunkedOnClick = documentRef.getElementById(
		"gemini-chunked-content",
	);

	const batch = await loadChunkBatchModule();
	const precheckResult = await batch?.runEnhancementPrechecksRuntime?.({
		existingChunkedOnClick,
		isCachedContent,
		hasCachedContent,
		storageManager,
		documentRef,
		cancelEnhanceButton,
		showStatusMessage,
		showWorkInProgressBanner,
		handleReenhanceChunk,
		isEnhancementCancelled: getEnhancementCancelRequested,
		loadChunkingSystem,
		windowRef,
		onResetChunkCacheFlags,
		findContentArea,
		replaceContentWithEnhancedVersion,
		onResetCacheFlags,
		onCacheLoaded,
		onCacheMiss,
	});

	if (precheckResult?.handled) {
		return;
	}

	const extractedContent = extractContent();
	if (!extractedContent.found) {
		showStatusMessage("No content found to process", "error");
		return;
	}

	try {
		const startup = await batch?.prepareEnhancementStartupRuntime?.({
			documentRef,
			cancelEnhanceButton,
			showStatusMessage,
			wakeUpBackgroundWorker,
			browserRef,
			loadChunkingSystem,
			setFormattingOptions,
			debugLog,
		});

		const chunkingEnabled = startup?.chunkingEnabled !== false;
		const chunking = startup?.chunking || null;
		const useEmoji = startup?.useEmoji === true;

		const chunkPrep = await batch?.prepareEnhancementChunkRuntime?.({
			chunkingEnabled,
			chunking,
			extractedText: extractedContent.text,
			findContentArea,
			showStatusMessage,
			debugLog,
			debugError,
			getCleanContentHTML,
			documentRef,
			buildChunkBanner,
			stripHtmlTags,
			onSummarizeLong: (indices) => summarizeChunkRange(indices, false),
			onSummarizeShort: (indices) => summarizeChunkRange(indices, true),
			shouldBannersBeHidden,
			showWorkInProgressBanner,
			enableCopyOnContentArea,
		});

		const shouldChunk = chunkPrep?.shouldChunk === true;
		const chunks = chunkPrep?.chunks || [];
		const contentToSend = chunkPrep?.contentToSend ?? extractedContent.text;

		const lifecycleResult = await batch?.runEnhancementLifecycleRuntime?.({
			novelLibrary,
			locationHref: windowRef.location.href,
			debugLog,
			buildCombinedPrompt,
			shouldChunk,
			showWorkInProgressBanner,
			sendMessageWithRetry,
			extractedTitle: extractedContent.title,
			contentToSend,
			useEmoji,
			isEnhancementCancelled: getEnhancementCancelRequested,
			documentRef,
			cancelEnhanceButton,
			showStatusMessage,
			replaceContentWithEnhancedVersion,
			loadChunkingSystem,
			chunks,
			handleChunkProcessed,
			extractedContentText: extractedContent.text,
			browserRef,
			consoleWarn: console.warn,
		});

		return lifecycleResult;
	} catch (error) {
		const batchModule = await loadChunkBatchModule();
		batchModule?.handleEnhancementLifecycleErrorRuntime?.({
			error,
			debugError,
			showStatusMessage,
			documentRef,
			cancelEnhanceButton,
			buttonText: "✨ Enhance with Gemini",
		});
	}
}

export async function handleSummarizeClickRuntime({
	isShort = false,
	summarizeChunkRange,
}) {
	return summarizeChunkRange([0], isShort);
}

export default {
	handleEnhanceClickRuntime,
	handleSummarizeClickRuntime,
};
