/**
 * Chunk control state and event bookkeeping extracted from content.js.
 */

export function createChunkControlRuntime() {
	const pausedChunks = new Set();
	const skippedChunks = new Set();

	return {
		pausedChunks,
		skippedChunks,
		markSkip(chunkIndex) {
			skippedChunks.add(chunkIndex);
		},
		markPause(chunkIndex) {
			pausedChunks.add(chunkIndex);
		},
		clearPause(chunkIndex) {
			pausedChunks.delete(chunkIndex);
		},
		clearSkip(chunkIndex) {
			skippedChunks.delete(chunkIndex);
		},
		consumeSkip(chunkIndex) {
			if (!skippedChunks.has(chunkIndex)) return false;
			skippedChunks.delete(chunkIndex);
			return true;
		},
		consumePause(chunkIndex) {
			if (!pausedChunks.has(chunkIndex)) return false;
			pausedChunks.delete(chunkIndex);
			return true;
		},
		isSkipped(chunkIndex) {
			return skippedChunks.has(chunkIndex);
		},
		isPaused(chunkIndex) {
			return pausedChunks.has(chunkIndex);
		},
	};
}
