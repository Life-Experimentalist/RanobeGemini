/**
 * Enhancement cancel flow extracted from content.js.
 */

export function handleCancelEnhancementRuntime({
	documentRef = document,
	windowRef = window,
	debugLog = () => {},
	debugError = () => {},
	sendMessageWithRetry,
	showStatusMessage,
	cancelEnhanceButton,
	setEnhancementCancelRequested,
	showWorkInProgressBanner,
}) {
	debugLog("Cancelling enhancement process...");
	if (typeof setEnhancementCancelRequested === "function") {
		setEnhancementCancelRequested(true);
	}

	if (typeof sendMessageWithRetry === "function") {
		sendMessageWithRetry({ action: "cancelEnhancement" }).catch((error) => {
			debugError("Failed to send cancel request:", error);
		});
	}

	showStatusMessage?.(
		"Cancelling enhancement... processed chunks will be kept.",
		"info",
	);

	if (cancelEnhanceButton) {
		cancelEnhanceButton.style.display = "none";
	}

	documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
		btn.textContent = "⚡ Enhance Chapter";
		btn.disabled = false;
		btn.classList.remove("loading");
	});

	const chunkedContainer = documentRef.getElementById(
		"gemini-chunked-content",
	);
	const totalChunks = chunkedContainer
		? chunkedContainer.querySelectorAll(".gemini-chunk-content").length
		: 1;
	const completedChunks = chunkedContainer
		? chunkedContainer.querySelectorAll(
				'.gemini-chunk-content[data-chunk-enhanced="true"]',
			).length
		: 0;

	let wordCounts = null;
	const chunking = windowRef.chunkingSystemCache;
	if (chunkedContainer && chunking?.core?.countWords) {
		const allChunks = chunkedContainer.querySelectorAll(
			".gemini-chunk-content",
		);
		let totalOriginalWords = 0;
		let totalEnhancedWords = 0;

		allChunks.forEach((chunk) => {
			const originalContent =
				chunk.getAttribute("data-original-chunk-content") || "";
			const enhancedContent = chunk.innerHTML;
			totalOriginalWords += chunking.core.countWords(originalContent);
			totalEnhancedWords += chunking.core.countWords(enhancedContent);
		});

		wordCounts = {
			original: totalOriginalWords,
			enhanced: totalEnhancedWords,
		};
	}

	if (typeof showWorkInProgressBanner === "function") {
		showWorkInProgressBanner(
			completedChunks,
			totalChunks,
			"paused",
			wordCounts,
		);
	}
}

export default {
	handleCancelEnhancementRuntime,
};
