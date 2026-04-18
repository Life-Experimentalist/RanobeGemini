/**
 * Runtime for handling per-chunk enhancement errors.
 */

export async function handleChunkErrorRuntime({
	message,
	loadChunkingSystem,
	buildChunkBanner,
	showStatusMessage,
	debugLog = () => {},
	documentRef = document,
}) {
	const chunking = await loadChunkingSystem?.();
	if (!chunking) return;

	const chunkIndex = message.chunkIndex;
	const totalChunks = message.totalChunks;

	const chunkedContainer = documentRef.getElementById(
		"gemini-chunked-content",
	);
	if (!chunkedContainer) return;

	const chunkWrapper = chunkedContainer.querySelector(
		`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
	);
	if (!chunkWrapper) return;

	// Ignore stale late-arriving errors for already enhanced chunks.
	const chunkContent = chunkWrapper.querySelector(".gemini-chunk-content");
	if (chunkContent?.getAttribute("data-chunk-enhanced") === "true") {
		debugLog(
			`[handleChunkError] Chunk ${chunkIndex} is already enhanced - ignoring late error: ${message.error}`,
		);
		return;
	}

	const existingBanner = chunkWrapper.querySelector(".gemini-chunk-banner");
	if (existingBanner) {
		// Derive total from DOM to avoid stale message counts.
		const actualTotalChunks =
			chunkedContainer.querySelectorAll(".gemini-chunk-wrapper").length ||
			totalChunks;
		const errorBanner = buildChunkBanner(
			chunking,
			chunkIndex,
			actualTotalChunks,
			"error",
			message.error,
		);
		existingBanner.replaceWith(errorBanner);
	}

	showStatusMessage?.(
		`Error processing chunk ${chunkIndex + 1}: ${message.error}`,
		"error",
	);
}

export default {
	handleChunkErrorRuntime,
};
