/**
 * Storage Manager for Ranobe Gemini
 * Manages caching of enhanced content using browser.storage.local
 */

export class StorageManager {
	constructor() {
		this.DB_KEY_PREFIX = "rg_enhanced_";
		this.CACHE_EXPIRY_DAYS = 7; // Cache entries older than this will be cleaned up
	}

	/**
	 * Generate a cache key from URL
	 * Normalizes FanFiction.net mobile/desktop URLs to share cache
	 * @param {string} url - The chapter URL
	 * @returns {string} Cache key
	 */
	generateCacheKey(url) {
		// Use just the pathname to avoid query parameter differences
		try {
			const urlObj = new URL(url);
			let pathname = urlObj.pathname;

			// Normalize FanFiction.net URLs: treat m.fanfiction.net and www.fanfiction.net as same
			// This allows cached content to be shared between mobile and desktop versions
			if (urlObj.hostname.includes("fanfiction.net")) {
				// Use a normalized hostname for cache key
				const normalizedHostname = "fanfiction.net";
				return this.DB_KEY_PREFIX + normalizedHostname + pathname;
			}

			return this.DB_KEY_PREFIX + urlObj.hostname + pathname;
		} catch (e) {
			return this.DB_KEY_PREFIX + url;
		}
	}

	/**
	 * Save enhanced content to cache
	 * @param {string} url - Chapter URL
	 * @param {Object} data - Data to cache
	 * @param {string} data.title - Chapter title
	 * @param {string} data.originalContent - Original chapter text
	 * @param {string} data.enhancedContent - Enhanced chapter text
	 * @param {Object} data.modelInfo - Model info object with name and provider
	 * @param {Object} data.settings - Settings used (optional)
	 * @returns {Promise<boolean>} Success status
	 */
	async saveEnhancedContent(url, data) {
		try {
			const cacheKey = this.generateCacheKey(url);
			const cacheEntry = {
				url: url,
				title: data.title,
				originalContent: data.originalContent,
				enhancedContent: data.enhancedContent,
				modelInfo: data.modelInfo,
				settings: data.settings || {},
				timestamp: Date.now(),
				version: "1.0",
			};

			await browser.storage.local.set({
				[cacheKey]: cacheEntry,
			});

			console.log("✓ Enhanced content cached for:", url);
			return true;
		} catch (error) {
			console.error("Failed to save enhanced content:", error);
			return false;
		}
	}

	/**
	 * Load enhanced content from cache
	 * @param {string} url - Chapter URL
	 * @returns {Promise<Object|null>} Cached data or null if not found
	 */
	async loadEnhancedContent(url) {
		try {
			const cacheKey = this.generateCacheKey(url);
			const result = await browser.storage.local.get(cacheKey);

			if (result[cacheKey]) {
				const entry = result[cacheKey];

				// Check if cache entry is still valid (not expired)
				const ageInDays =
					(Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24);
				if (ageInDays > this.CACHE_EXPIRY_DAYS) {
					console.log("Cache entry expired, removing:", url);
					await this.removeEnhancedContent(url);
					return null;
				}

				console.log("✓ Loaded cached enhanced content for:", url);
				return entry;
			}

			return null;
		} catch (error) {
			console.error("Failed to load enhanced content:", error);
			return null;
		}
	}

	/**
	 * Remove cached enhanced content
	 * @param {string} url - Chapter URL
	 * @returns {Promise<boolean>} Success status
	 */
	async removeEnhancedContent(url) {
		try {
			const cacheKey = this.generateCacheKey(url);
			await browser.storage.local.remove(cacheKey);
			console.log("✓ Removed cached content for:", url);
			return true;
		} catch (error) {
			console.error("Failed to remove cached content:", error);
			return false;
		}
	}

	/**
	 * Check if enhanced content is cached for a URL
	 * @param {string} url - Chapter URL
	 * @returns {Promise<boolean>} True if cached
	 */
	async isCached(url) {
		const cached = await this.loadEnhancedContent(url);
		return cached !== null;
	}

	/**
	 * Clean up old cache entries
	 * @returns {Promise<number>} Number of entries removed
	 */
	async cleanupOldCache() {
		try {
			const allData = await browser.storage.local.get(null);
			let removedCount = 0;
			const now = Date.now();
			const expiryMs = this.CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

			for (const key in allData) {
				if (key.startsWith(this.DB_KEY_PREFIX)) {
					const entry = allData[key];
					if (entry.timestamp && now - entry.timestamp > expiryMs) {
						await browser.storage.local.remove(key);
						removedCount++;
					}
				}
			}

			if (removedCount > 0) {
				console.log(
					`✓ Cleaned up ${removedCount} expired cache entries`
				);
			}

			return removedCount;
		} catch (error) {
			console.error("Failed to cleanup old cache:", error);
			return 0;
		}
	}

	/**
	 * Get all cached URLs
	 * @returns {Promise<Array<string>>} Array of cached URLs
	 */
	async getAllCachedUrls() {
		try {
			const allData = await browser.storage.local.get(null);
			const urls = [];

			for (const key in allData) {
				if (key.startsWith(this.DB_KEY_PREFIX)) {
					const entry = allData[key];
					if (entry.url) {
						urls.push(entry.url);
					}
				}
			}

			return urls;
		} catch (error) {
			console.error("Failed to get cached URLs:", error);
			return [];
		}
	}

	/**
	 * Get cache statistics
	 * @returns {Promise<Object>} Cache statistics
	 */
	async getCacheStats() {
		try {
			const allData = await browser.storage.local.get(null);
			let totalEntries = 0;
			let totalSize = 0;
			const now = Date.now();

			for (const key in allData) {
				if (key.startsWith(this.DB_KEY_PREFIX)) {
					totalEntries++;
					const entrySize = JSON.stringify(allData[key]).length;
					totalSize += entrySize;
				}
			}

			return {
				totalEntries,
				totalSizeKB: Math.round(totalSize / 1024),
				cacheExpiryDays: this.CACHE_EXPIRY_DAYS,
			};
		} catch (error) {
			console.error("Failed to get cache stats:", error);
			return {
				totalEntries: 0,
				totalSizeKB: 0,
				cacheExpiryDays: this.CACHE_EXPIRY_DAYS,
			};
		}
	}

	/**
	 * Clear all cached content
	 * @returns {Promise<boolean>} Success status
	 */
	async clearAllCache() {
		try {
			const allData = await browser.storage.local.get(null);
			const keysToRemove = [];

			for (const key in allData) {
				if (key.startsWith(this.DB_KEY_PREFIX)) {
					keysToRemove.push(key);
				}
			}

			if (keysToRemove.length > 0) {
				await browser.storage.local.remove(keysToRemove);
				console.log(`✓ Cleared ${keysToRemove.length} cached entries`);
			}

			return true;
		} catch (error) {
			console.error("Failed to clear cache:", error);
			return false;
		}
	}
}

// Export singleton instance
export default new StorageManager();
