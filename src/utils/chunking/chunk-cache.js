/**
 * Chunk Cache Manager
 * Handles per-chunk storage, retrieval, and deletion
 * Each chunk is cached separately for granular control
 */

/**
 * Generate a cache key for a specific chunk
 * @param {string} url - Page URL
 * @param {number} chunkIndex - Chunk index
 * @returns {string} Cache key
 */
function getChunkCacheKey(url, chunkIndex) {
	// Simple hash function for URL to keep storage keys manageable
	const urlHash = simpleHash(url);
	return `chunk_cache_${urlHash}_${chunkIndex}`;
}

/**
 * Generate a metadata key for all chunks at a URL
 * @param {string} url - Page URL
 * @returns {string} Metadata cache key
 */
function getChunkMetadataKey(url) {
	const urlHash = simpleHash(url);
	return `chunk_metadata_${urlHash}`;
}

/**
 * Simple hash function for URLs
 * @param {string} str - String to hash
 * @returns {string} Hash string
 */
function simpleHash(str) {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash).toString(36);
}

/**
 * Save a chunk to cache
 * @param {string} url - Page URL
 * @param {number} chunkIndex - Chunk index (0-based)
 * @param {Object} chunkData - Chunk data to save
 * @param {string} chunkData.originalContent - Original chunk content
 * @param {string} chunkData.enhancedContent - Enhanced chunk content
 * @param {number} chunkData.wordCount - Word count of chunk
 * @param {number} chunkData.timestamp - Timestamp when cached
 * @returns {Promise<void>}
 */
export async function saveChunkToCache(url, chunkIndex, chunkData) {
	try {
		const cacheKey = getChunkCacheKey(url, chunkIndex);
		const dataToStore = {
			...chunkData,
			url,
			chunkIndex,
			timestamp: chunkData.timestamp || Date.now(),
		};

		await browser.storage.local.set({
			[cacheKey]: dataToStore,
		});

		// Update metadata to track which chunks exist
		await updateChunkMetadata(url, chunkIndex, "add", {
			totalChunks: chunkData.totalChunks,
			modelInfo: chunkData.modelInfo,
		});

		console.log(`[ChunkCache] Saved chunk ${chunkIndex} for ${url}`);
	} catch (error) {
		console.error(
			`[ChunkCache] Failed to save chunk ${chunkIndex}:`,
			error,
		);
		throw error;
	}
}

/**
 * Get a chunk from cache
 * @param {string} url - Page URL
 * @param {number} chunkIndex - Chunk index (0-based)
 * @returns {Promise<Object|null>} Cached chunk data or null if not found
 */
export async function getChunkFromCache(url, chunkIndex) {
	try {
		const cacheKey = getChunkCacheKey(url, chunkIndex);
		const result = await browser.storage.local.get(cacheKey);

		if (result && result[cacheKey]) {
			console.log(
				`[ChunkCache] Retrieved chunk ${chunkIndex} from cache`,
			);
			return result[cacheKey];
		}

		console.log(`[ChunkCache] Chunk ${chunkIndex} not found in cache`);
		return null;
	} catch (error) {
		console.error(`[ChunkCache] Failed to get chunk ${chunkIndex}:`, error);
		return null;
	}
}

/**
 * Delete a specific chunk from cache
 * @param {string} url - Page URL
 * @param {number} chunkIndex - Chunk index (0-based)
 * @returns {Promise<void>}
 */
export async function deleteChunkFromCache(url, chunkIndex) {
	try {
		const cacheKey = getChunkCacheKey(url, chunkIndex);
		await browser.storage.local.remove(cacheKey);

		// Update metadata to remove this chunk
		await updateChunkMetadata(url, chunkIndex, "remove");

		console.log(`[ChunkCache] Deleted chunk ${chunkIndex} for ${url}`);
	} catch (error) {
		console.error(
			`[ChunkCache] Failed to delete chunk ${chunkIndex}:`,
			error,
		);
		throw error;
	}
}

/**
 * Get all chunks for a URL
 * @param {string} url - Page URL
 * @returns {Promise<Array<Object>>} Array of chunk data objects, sorted by index
 */
export async function getAllChunksFromCache(url) {
	try {
		const metadata = await getChunkMetadata(url);
		if (
			!metadata ||
			!metadata.chunkIndices ||
			metadata.chunkIndices.length === 0
		) {
			return [];
		}

		const chunks = [];
		for (const chunkIndex of metadata.chunkIndices) {
			const chunk = await getChunkFromCache(url, chunkIndex);
			if (chunk) {
				chunks.push(chunk);
			}
		}

		// Sort by chunk index
		chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

		console.log(
			`[ChunkCache] Retrieved ${chunks.length} chunks for ${url}`,
		);
		return chunks;
	} catch (error) {
		console.error("[ChunkCache] Failed to get all chunks:", error);
		return [];
	}
}

/**
 * Delete all chunks for a URL
 * @param {string} url - Page URL
 * @returns {Promise<void>}
 */
export async function deleteAllChunksForUrl(url) {
	try {
		const metadata = await getChunkMetadata(url);
		if (!metadata || !metadata.chunkIndices) {
			console.log(`[ChunkCache] No chunks found to delete for ${url}`);
			return;
		}

		// Delete all individual chunks
		const deletePromises = metadata.chunkIndices.map((chunkIndex) =>
			deleteChunkFromCache(url, chunkIndex),
		);
		await Promise.all(deletePromises);

		// Delete metadata
		const metadataKey = getChunkMetadataKey(url);
		await browser.storage.local.remove(metadataKey);

		console.log(
			`[ChunkCache] Deleted all ${metadata.chunkIndices.length} chunks for ${url}`,
		);
	} catch (error) {
		console.error("[ChunkCache] Failed to delete all chunks:", error);
		throw error;
	}
}

/**
 * Get chunk metadata (which chunks exist)
 * @param {string} url - Page URL
 * @returns {Promise<Object|null>} Metadata object or null
 */
export async function getChunkMetadata(url) {
	try {
		const metadataKey = getChunkMetadataKey(url);
		const result = await browser.storage.local.get(metadataKey);
		return result[metadataKey] || null;
	} catch (error) {
		console.error("[ChunkCache] Failed to get metadata:", error);
		return null;
	}
}

/**
 * Update chunk metadata (track which chunks exist)
 * @param {string} url - Page URL
 * @param {number} chunkIndex - Chunk index
 * @param {string} action - 'add' or 'remove'
 * @returns {Promise<void>}
 */
async function updateChunkMetadata(
	url,
	chunkIndex,
	action,
	metadataUpdate = null,
) {
	try {
		const metadataKey = getChunkMetadataKey(url);
		let metadata = await getChunkMetadata(url);

		if (!metadata) {
			metadata = {
				url,
				chunkIndices: [],
				lastUpdated: Date.now(),
			};
		}

		if (action === "add") {
			if (!metadata.chunkIndices.includes(chunkIndex)) {
				metadata.chunkIndices.push(chunkIndex);
				metadata.chunkIndices.sort((a, b) => a - b);
			}
		} else if (action === "remove") {
			metadata.chunkIndices = metadata.chunkIndices.filter(
				(idx) => idx !== chunkIndex,
			);
		}

		if (metadataUpdate) {
			if (Number.isInteger(metadataUpdate.totalChunks)) {
				metadata.totalChunks = metadataUpdate.totalChunks;
			}
			if (metadataUpdate.modelInfo) {
				metadata.modelInfo = metadataUpdate.modelInfo;
			}
		}

		metadata.lastUpdated = Date.now();

		await browser.storage.local.set({
			[metadataKey]: metadata,
		});
	} catch (error) {
		console.error("[ChunkCache] Failed to update metadata:", error);
	}
}

/**
 * Check if any chunks exist for a URL
 * @param {string} url - Page URL
 * @returns {Promise<boolean>} True if chunks exist
 */
export async function hasChunksInCache(url) {
	const metadata = await getChunkMetadata(url);
	return (
		metadata && metadata.chunkIndices && metadata.chunkIndices.length > 0
	);
}

/**
 * Get chunk count for a URL
 * @param {string} url - Page URL
 * @returns {Promise<number>} Number of cached chunks
 */
export async function getChunkCount(url) {
	const metadata = await getChunkMetadata(url);
	return metadata && metadata.chunkIndices ? metadata.chunkIndices.length : 0;
}

/**
 * Detect and clear old cache format
 * Old format had combined enhanced content, new uses per-chunk
 * @returns {Promise<number>} Number of old cache entries cleared
 */
export async function clearOldCache() {
	try {
		const allData = await browser.storage.local.get(null);
		let clearedCount = 0;

		for (const key in allData) {
			const data = allData[key];
			// Detect old cache format: has isChunked property
			if (data && typeof data === "object" && data.isChunked === true) {
				await browser.storage.local.remove(key);
				clearedCount++;
				console.log(`[ChunkCache] Cleared old cache format: ${key}`);
			}
		}

		if (clearedCount > 0) {
			console.log(
				`[ChunkCache] Migration: Cleared ${clearedCount} old cache entries`,
			);
		}
		return clearedCount;
	} catch (error) {
		console.error("[ChunkCache] Error clearing old cache:", error);
		return 0;
	}
}

export default {
	saveChunkToCache,
	getChunkFromCache,
	deleteChunkFromCache,
	getAllChunksFromCache,
	deleteAllChunksForUrl,
	getChunkMetadata,
	hasChunksInCache,
	getChunkCount,
	clearOldCache,
};
