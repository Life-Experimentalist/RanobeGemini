/**
 * Runtime for handling all-chunks-processed completion messages.
 */

export function handleAllChunksProcessedRuntime({
	message,
	debugLog = () => {},
	showWorkInProgressBanner,
	showStatusMessage,
	cancelEnhanceButton,
	documentRef = document,
}) {
	debugLog(
		`All chunks processed: ${message.totalProcessed}/${message.totalChunks} successful`,
	);

	documentRef.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
		btn.textContent = "\u{26A1} Re-enhance with Gemini";
		btn.disabled = false;
		btn.classList.remove("loading");
	});

	if (message.failedChunks && message.failedChunks.length > 0) {
		// Ignore stale failure indices when those chunks were already re-enhanced.
		const actuallyStillFailed = message.failedChunks.filter((index) => {
			const chunkContent = documentRef.querySelector(
				`.gemini-chunk-content[data-chunk-index="${index}"]`,
			);
			return chunkContent?.getAttribute("data-chunk-enhanced") !== "true";
		});

		if (actuallyStillFailed.length === 0) {
			const allChunkElements = documentRef.querySelectorAll(
				".gemini-chunk-content",
			);
			const doneElements = documentRef.querySelectorAll(
				'.gemini-chunk-content[data-chunk-enhanced="true"]',
			);
			if (
				doneElements.length === allChunkElements.length &&
				allChunkElements.length > 0
			) {
				showWorkInProgressBanner?.(
					doneElements.length,
					allChunkElements.length,
					"complete",
					null,
				);
				return;
			}
		}

		const completedInDom = documentRef.querySelectorAll(
			'.gemini-chunk-content[data-chunk-enhanced="true"]',
		).length;
		showWorkInProgressBanner?.(
			completedInDom,
			message.totalChunks,
			"paused",
			null,
		);
		if (cancelEnhanceButton) {
			cancelEnhanceButton.style.display = "none";
		}

		const successPercentage = Math.round(
			(message.totalProcessed / message.totalChunks) * 100,
		);
		showStatusMessage?.(
			`Partially enhanced ${message.totalProcessed} of ${message.totalChunks} chunks (${successPercentage}% complete). You can re-enhance failed chunks.`,
			"warning",
		);
		return;
	}

	showStatusMessage?.(
		`Content successfully enhanced with Gemini! (${message.totalProcessed} chunks processed)`,
		"success",
	);
}

export default {
	handleAllChunksProcessedRuntime,
};
