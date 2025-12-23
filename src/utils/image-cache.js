/**
 * Image Cache Utility
 * Caches cover images using IndexedDB to avoid rate limiting and improve performance
 */

const DB_NAME = "RanobeGeminiImageCache";
const DB_VERSION = 1;
const STORE_NAME = "images";
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

let dbInstance = null;

/**
 * Open/create the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
async function openDatabase() {
	if (dbInstance) return dbInstance;

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			console.error(
				"[ImageCache] Failed to open database:",
				request.error
			);
			reject(request.error);
		};

		request.onsuccess = () => {
			dbInstance = request.result;
			resolve(dbInstance);
		};

		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, {
					keyPath: "url",
				});
				store.createIndex("timestamp", "timestamp", { unique: false });
			}
		};
	});
}

/**
 * Generate a cache key from URL
 * @param {string} url - Image URL
 * @returns {string} Cache key
 */
function getCacheKey(url) {
	// Normalize the URL for consistent caching
	try {
		const urlObj = new URL(url);
		return urlObj.href;
	} catch {
		return url;
	}
}

/**
 * Get cached image data
 * @param {string} url - Image URL
 * @returns {Promise<string|null>} Base64 data URL or null if not cached
 */
export async function getCachedImage(url) {
	if (!url) return null;

	try {
		const db = await openDatabase();
		const key = getCacheKey(url);

		return new Promise((resolve) => {
			const transaction = db.transaction(STORE_NAME, "readonly");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.get(key);

			request.onsuccess = () => {
				const result = request.result;
				if (result) {
					// Check if cache is still valid
					if (Date.now() - result.timestamp < CACHE_DURATION) {
						resolve(result.dataUrl);
					} else {
						// Cache expired, delete it
						deleteFromCache(url).catch(() => {});
						resolve(null);
					}
				} else {
					resolve(null);
				}
			};

			request.onerror = () => {
				console.warn(
					"[ImageCache] Failed to get cached image:",
					request.error
				);
				resolve(null);
			};
		});
	} catch (error) {
		console.warn("[ImageCache] Error getting cached image:", error);
		return null;
	}
}

/**
 * Cache an image
 * @param {string} url - Image URL
 * @param {string} dataUrl - Base64 data URL
 */
export async function cacheImage(url, dataUrl) {
	if (!url || !dataUrl) return;

	try {
		const db = await openDatabase();
		const key = getCacheKey(url);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			const store = transaction.objectStore(STORE_NAME);

			const data = {
				url: key,
				dataUrl: dataUrl,
				timestamp: Date.now(),
			};

			const request = store.put(data);

			request.onsuccess = () => resolve();
			request.onerror = () => {
				console.warn(
					"[ImageCache] Failed to cache image:",
					request.error
				);
				reject(request.error);
			};
		});
	} catch (error) {
		console.warn("[ImageCache] Error caching image:", error);
	}
}

/**
 * Delete an image from cache
 * @param {string} url - Image URL
 */
export async function deleteFromCache(url) {
	if (!url) return;

	try {
		const db = await openDatabase();
		const key = getCacheKey(url);

		return new Promise((resolve) => {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.delete(key);

			request.onsuccess = () => resolve();
			request.onerror = () => resolve(); // Ignore errors on delete
		});
	} catch (error) {
		console.warn("[ImageCache] Error deleting from cache:", error);
	}
}

/**
 * Fetch and cache an image, returning the cached data URL
 * @param {string} url - Image URL to fetch
 * @param {string} fallbackUrl - Fallback URL if fetch fails
 * @returns {Promise<string>} Data URL or fallback/original URL
 */
export async function fetchAndCacheImage(url, fallbackUrl = "") {
	if (!url) return fallbackUrl;

	// Check cache first
	const cached = await getCachedImage(url);
	if (cached) {
		return cached;
	}

	// Try to fetch the image
	try {
		const response = await fetch(url, {
			mode: "cors",
			credentials: "omit",
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const blob = await response.blob();

		// Convert to data URL
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onloadend = async () => {
				const dataUrl = reader.result;
				// Cache for future use
				await cacheImage(url, dataUrl);
				resolve(dataUrl);
			};
			reader.onerror = () => {
				resolve(fallbackUrl || url);
			};
			reader.readAsDataURL(blob);
		});
	} catch (error) {
		// Rate limited or other error - return fallback
		console.debug(
			"[ImageCache] Could not fetch image:",
			url,
			error.message
		);
		return fallbackUrl || url;
	}
}

/**
 * Load image with caching - use for img elements
 * Sets up the image element to use cached data or fallback
 * @param {HTMLImageElement} imgElement - The image element
 * @param {string} url - Original image URL
 * @param {string} fallbackUrl - Fallback URL if image fails
 */
export async function loadImageWithCache(imgElement, url, fallbackUrl = "") {
	if (!url || !imgElement) {
		if (fallbackUrl && imgElement) {
			imgElement.src = fallbackUrl;
		}
		return;
	}

	// Check cache first
	const cached = await getCachedImage(url);
	if (cached) {
		imgElement.src = cached;
		return;
	}

	// Set original URL and add load handler to cache on success
	imgElement.src = url;

	// Use a one-time load handler to cache successful loads
	const loadHandler = async () => {
		imgElement.removeEventListener("load", loadHandler);

		// Try to cache the loaded image
		try {
			// Create a canvas to get the image data
			const canvas = document.createElement("canvas");
			canvas.width = imgElement.naturalWidth;
			canvas.height = imgElement.naturalHeight;

			const ctx = canvas.getContext("2d");
			ctx.drawImage(imgElement, 0, 0);

			// Get as data URL (use JPEG for smaller size)
			const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
			await cacheImage(url, dataUrl);
		} catch (e) {
			// Canvas tainted or other error - just skip caching
			console.debug(
				"[ImageCache] Could not cache image after load:",
				e.message
			);
		}
	};

	imgElement.addEventListener("load", loadHandler, { once: true });
}

/**
 * Clear all cached images
 */
export async function clearImageCache() {
	try {
		const db = await openDatabase();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.clear();

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	} catch (error) {
		console.error("[ImageCache] Error clearing cache:", error);
	}
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache() {
	try {
		const db = await openDatabase();
		const cutoff = Date.now() - CACHE_DURATION;

		return new Promise((resolve) => {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			const index = store.index("timestamp");
			const range = IDBKeyRange.upperBound(cutoff);
			const request = index.openCursor(range);

			request.onsuccess = (event) => {
				const cursor = event.target.result;
				if (cursor) {
					store.delete(cursor.primaryKey);
					cursor.continue();
				} else {
					resolve();
				}
			};

			request.onerror = () => resolve();
		});
	} catch (error) {
		console.warn("[ImageCache] Error cleaning up cache:", error);
	}
}

// Export default object with all functions
export default {
	getCachedImage,
	cacheImage,
	deleteFromCache,
	fetchAndCacheImage,
	loadImageWithCache,
	clearImageCache,
	cleanupExpiredCache,
};
