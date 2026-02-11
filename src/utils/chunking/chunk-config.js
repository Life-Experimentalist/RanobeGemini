/**
 * Chunking Configuration
 * Centralized configuration for the chunking system
 */

// Default chunk size in words
export const DEFAULT_CHUNK_SIZE_WORDS = 3200;

// Default number of chunks after which summary buttons repeat
export const DEFAULT_CHUNK_SUMMARY_COUNT = 2;

// Minimum chunk size in words (for validation)
export const MIN_CHUNK_WORDS = 100;

// Configuration keys for browser storage
export const CHUNK_CONFIG_KEYS = {
	CHUNK_SIZE_WORDS: "chunkSizeWords",
	CHUNK_SUMMARY_COUNT: "chunkSummaryCount",
};

/**
 * Get chunk configuration from storage with defaults
 * @returns {Promise<{chunkSizeWords: number, chunkSummaryCount: number}>}
 */
export async function getChunkConfig() {
	try {
		// Try to get configuration from browser storage
		const config = await browser.storage.local.get([
			CHUNK_CONFIG_KEYS.CHUNK_SIZE_WORDS,
			CHUNK_CONFIG_KEYS.CHUNK_SUMMARY_COUNT,
		]);

		return {
			chunkSizeWords:
				config[CHUNK_CONFIG_KEYS.CHUNK_SIZE_WORDS] ||
				DEFAULT_CHUNK_SIZE_WORDS,
			chunkSummaryCount:
				config[CHUNK_CONFIG_KEYS.CHUNK_SUMMARY_COUNT] ||
				DEFAULT_CHUNK_SUMMARY_COUNT,
		};
	} catch (error) {
		console.warn("Failed to load chunk config, using defaults:", error);
		return {
			chunkSizeWords: DEFAULT_CHUNK_SIZE_WORDS,
			chunkSummaryCount: DEFAULT_CHUNK_SUMMARY_COUNT,
		};
	}
}

/**
 * Save chunk configuration to storage
 * @param {number} chunkSizeWords - Chunk size in words
 * @param {number} chunkSummaryCount - Number of chunks per summary repeat
 * @returns {Promise<void>}
 */
export async function saveChunkConfig(chunkSizeWords, chunkSummaryCount) {
	try {
		await browser.storage.local.set({
			[CHUNK_CONFIG_KEYS.CHUNK_SIZE_WORDS]: Math.max(
				chunkSizeWords,
				MIN_CHUNK_WORDS,
			),
			[CHUNK_CONFIG_KEYS.CHUNK_SUMMARY_COUNT]: Math.max(
				chunkSummaryCount,
				1,
			),
		});
	} catch (error) {
		console.error("Failed to save chunk config:", error);
		throw error;
	}
}

export default {
	DEFAULT_CHUNK_SIZE_WORDS,
	DEFAULT_CHUNK_SUMMARY_COUNT,
	MIN_CHUNK_WORDS,
	CHUNK_CONFIG_KEYS,
	getChunkConfig,
	saveChunkConfig,
};
