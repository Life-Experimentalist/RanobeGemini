/**
 * Novel Library Manager for Ranobe Gemini
 * Manages a library of novels organized by site "shelves"
 * with unified storage across mobile/desktop variants
 */

import { DOMAIN_REGISTRY, SHELF_REGISTRY } from "./domain-constants.js";

/**
 * Shelf definitions - dynamically imported from handler SHELF_METADATA
 * via SHELF_REGISTRY in domain-constants.js
 *
 * Structure per shelf:
 * {
 *   id: string,           // Unique shelf ID (e.g., "fanfiction")
 *   name: string,         // Display name (e.g., "FanFiction.net")
 *   icon: string,         // Emoji icon (e.g., "📚")
 *   color: string,        // Brand color hex (e.g., "#2a4b8d")
 *   domains: string[],    // All supported domains for this shelf
 *   novelIdPattern: RegExp, // Pattern to extract novel ID from URL
 *   primaryDomain: string // Main domain for metadata fetching
 * }
 *
 * To add a new site:
 * 1. Create a handler in website-handlers/
 * 2. Add static SHELF_METADATA to the handler class
 * 3. Import the handler in domain-constants.js
 * 4. The shelf will automatically appear in the library!
 */
export const SHELVES = SHELF_REGISTRY;

/**
 * Novel data structure
 * @typedef {Object} Novel
 * @property {string} id - Unique identifier (shelfId + novelId)
 * @property {string} shelfId - Which shelf this novel belongs to
 * @property {string} siteNovelId - Site-specific novel ID (extracted from URL)
 * @property {string} title - Novel title
 * @property {string} author - Author name
 * @property {string} coverUrl - Cover image URL
 * @property {string} description - Novel description/summary
 * @property {string} sourceUrl - URL to the novel's main page
 * @property {number} totalChapters - Total number of chapters
 * @property {number} lastReadChapter - Last chapter the user read
 * @property {string} lastReadUrl - URL of the last read chapter
 * @property {string} status - Novel status (ongoing, completed, etc.)
 * @property {Array<string>} genres - Array of genre tags
 * @property {Array<string>} tags - Additional tags
 * @property {number} addedAt - Timestamp when added to library
 * @property {number} lastAccessedAt - Timestamp of last access
 * @property {number} enhancedChaptersCount - Number of enhanced chapters
 * @property {Object} metadata - Additional site-specific metadata
 */

/**
 * Chapter data structure
 * @typedef {Object} Chapter
 * @property {string} id - Unique identifier (novelId + chapterNumber)
 * @property {string} novelId - Parent novel ID
 * @property {number} chapterNumber - Chapter number
 * @property {string} title - Chapter title
 * @property {string} url - Chapter URL
 * @property {boolean} isEnhanced - Whether this chapter has been enhanced
 * @property {number} enhancedAt - Timestamp when enhanced
 * @property {number} readAt - Timestamp when last read
 */

export class NovelLibrary {
	constructor() {
		this.LIBRARY_KEY = "rg_novel_library";
		this.CHAPTERS_KEY_PREFIX = "rg_novel_chapters_";
		this.SETTINGS_KEY = "rg_library_settings";
	}

	/**
	 * Initialize the library (load from storage)
	 * @returns {Promise<Object>} Library data
	 */
	async init() {
		const library = await this.getLibrary();
		console.log(
			`📚 Novel Library initialized with ${
				Object.keys(library.novels).length
			} novels`
		);
		return library;
	}

	/**
	 * Get the full library data
	 * @returns {Promise<Object>} Library object with novels and metadata
	 */
	async getLibrary() {
		try {
			const result = await browser.storage.local.get(this.LIBRARY_KEY);
			return (
				result[this.LIBRARY_KEY] || {
					novels: {},
					shelves: {},
					lastUpdated: null,
					version: "1.0",
				}
			);
		} catch (error) {
			console.error("Failed to get library:", error);
			return {
				novels: {},
				shelves: {},
				lastUpdated: null,
				version: "1.0",
			};
		}
	}

	/**
	 * Save the library data
	 * @param {Object} library - Library data to save
	 * @returns {Promise<boolean>} Success status
	 */
	async saveLibrary(library) {
		try {
			library.lastUpdated = Date.now();
			await browser.storage.local.set({
				[this.LIBRARY_KEY]: library,
			});
			return true;
		} catch (error) {
			console.error("Failed to save library:", error);
			return false;
		}
	}

	/**
	 * Determine which shelf a URL belongs to
	 * @param {string} url - The URL to check
	 * @returns {Object|null} Shelf definition or null if not found
	 */
	getShelfForUrl(url) {
		try {
			const urlObj = new URL(url);
			const hostname = urlObj.hostname.toLowerCase();

			for (const [key, shelf] of Object.entries(SHELVES)) {
				for (const domain of shelf.domains) {
					if (
						hostname === domain ||
						hostname === `www.${domain}` ||
						hostname.endsWith(`.${domain}`)
					) {
						return shelf;
					}
				}
			}
			return null;
		} catch (error) {
			console.error("Error determining shelf for URL:", error);
			return null;
		}
	}

	/**
	 * Extract novel ID from URL based on shelf pattern
	 * @param {string} url - The URL to extract from
	 * @param {Object} shelf - Shelf definition with novelIdPattern
	 * @returns {string|null} Novel ID or null if not found
	 */
	extractNovelId(url, shelf) {
		if (!shelf || !shelf.novelIdPattern) return null;

		try {
			const urlObj = new URL(url);
			const match = urlObj.pathname.match(shelf.novelIdPattern);
			if (match) {
				// Return first non-null capture group
				return match.slice(1).find((g) => g) || null;
			}
			return null;
		} catch (error) {
			console.error("Error extracting novel ID:", error);
			return null;
		}
	}

	/**
	 * Generate a unique library ID for a novel
	 * @param {string} shelfId - Shelf identifier
	 * @param {string} siteNovelId - Site-specific novel ID
	 * @returns {string} Unique library ID
	 */
	generateNovelId(shelfId, siteNovelId) {
		return `${shelfId}_${siteNovelId}`;
	}

	/**
	 * Add or update a novel in the library
	 * @param {Object} novelData - Novel data to add/update
	 * @returns {Promise<Object>} The saved novel
	 */
	async addOrUpdateNovel(novelData) {
		const library = await this.getLibrary();

		const existingNovel = library.novels[novelData.id];
		const now = Date.now();

		if (existingNovel) {
			// Update existing novel
			library.novels[novelData.id] = {
				...existingNovel,
				...novelData,
				lastAccessedAt: now,
				// Don't overwrite addedAt
				addedAt: existingNovel.addedAt,
			};
		} else {
			// Add new novel
			library.novels[novelData.id] = {
				...novelData,
				addedAt: now,
				lastAccessedAt: now,
				enhancedChaptersCount: novelData.enhancedChaptersCount || 0,
			};
		}

		// Update shelf stats
		if (!library.shelves[novelData.shelfId]) {
			library.shelves[novelData.shelfId] = {
				novelCount: 0,
				lastUpdated: now,
			};
		}

		// Recount novels for this shelf
		library.shelves[novelData.shelfId].novelCount = Object.values(
			library.novels
		).filter((n) => n.shelfId === novelData.shelfId).length;
		library.shelves[novelData.shelfId].lastUpdated = now;

		await this.saveLibrary(library);

		console.log(`📚 Novel saved to library: ${novelData.title}`);
		return library.novels[novelData.id];
	}

	/**
	 * Get a novel by its library ID
	 * @param {string} novelId - Library novel ID
	 * @returns {Promise<Object|null>} Novel data or null
	 */
	async getNovel(novelId) {
		const library = await this.getLibrary();
		return library.novels[novelId] || null;
	}

	/**
	 * Get a novel by URL
	 * @param {string} url - Chapter or novel URL
	 * @returns {Promise<Object|null>} Novel data or null
	 */
	async getNovelByUrl(url) {
		const shelf = this.getShelfForUrl(url);
		if (!shelf) return null;

		const siteNovelId = this.extractNovelId(url, shelf);
		if (!siteNovelId) return null;

		const novelId = this.generateNovelId(shelf.id, siteNovelId);
		return this.getNovel(novelId);
	}

	/**
	 * Get all novels for a specific shelf
	 * @param {string} shelfId - Shelf identifier
	 * @returns {Promise<Array<Object>>} Array of novels
	 */
	async getNovelsByShelf(shelfId) {
		const library = await this.getLibrary();
		return Object.values(library.novels)
			.filter((novel) => novel.shelfId === shelfId)
			.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
	}

	/**
	 * Get all novels sorted by last accessed
	 * @param {number} limit - Maximum number of novels to return (0 = all)
	 * @returns {Promise<Array<Object>>} Array of novels
	 */
	async getRecentNovels(limit = 0) {
		const library = await this.getLibrary();
		let novels = Object.values(library.novels).sort(
			(a, b) => b.lastAccessedAt - a.lastAccessedAt
		);

		if (limit > 0) {
			novels = novels.slice(0, limit);
		}

		return novels;
	}

	/**
	 * Get library statistics
	 * @returns {Promise<Object>} Statistics object
	 */
	async getStats() {
		const library = await this.getLibrary();
		const novels = Object.values(library.novels);

		const stats = {
			totalNovels: novels.length,
			totalEnhancedChapters: novels.reduce(
				(sum, n) => sum + (n.enhancedChaptersCount || 0),
				0
			),
			shelves: {},
		};

		// Stats per shelf
		for (const [key, shelf] of Object.entries(SHELVES)) {
			const shelfNovels = novels.filter((n) => n.shelfId === shelf.id);
			stats.shelves[shelf.id] = {
				name: shelf.name,
				icon: shelf.icon,
				novelCount: shelfNovels.length,
				enhancedChapters: shelfNovels.reduce(
					(sum, n) => sum + (n.enhancedChaptersCount || 0),
					0
				),
			};
		}

		return stats;
	}

	/**
	 * Remove a novel from the library
	 * @param {string} novelId - Library novel ID
	 * @returns {Promise<boolean>} Success status
	 */
	async removeNovel(novelId) {
		const library = await this.getLibrary();

		if (!library.novels[novelId]) {
			return false;
		}

		const shelfId = library.novels[novelId].shelfId;
		delete library.novels[novelId];

		// Update shelf stats
		if (library.shelves[shelfId]) {
			library.shelves[shelfId].novelCount = Object.values(
				library.novels
			).filter((n) => n.shelfId === shelfId).length;
		}

		// Also remove chapters data
		try {
			await browser.storage.local.remove(
				this.CHAPTERS_KEY_PREFIX + novelId
			);
		} catch (error) {
			console.error("Failed to remove chapters data:", error);
		}

		await this.saveLibrary(library);
		console.log(`📚 Novel removed from library: ${novelId}`);
		return true;
	}

	/**
	 * Update chapter tracking for a novel
	 * @param {string} novelId - Library novel ID
	 * @param {Object} chapterData - Chapter data
	 * @returns {Promise<boolean>} Success status
	 */
	async updateChapter(novelId, chapterData) {
		try {
			const chaptersKey = this.CHAPTERS_KEY_PREFIX + novelId;
			const result = await browser.storage.local.get(chaptersKey);
			const chapters = result[chaptersKey] || { chapters: {} };

			const chapterId = `ch_${
				chapterData.chapterNumber || chapterData.url
			}`;

			chapters.chapters[chapterId] = {
				...chapters.chapters[chapterId],
				...chapterData,
				lastUpdated: Date.now(),
			};

			await browser.storage.local.set({
				[chaptersKey]: chapters,
			});

			// Update enhanced chapters count in novel
			const enhancedCount = Object.values(chapters.chapters).filter(
				(ch) => ch.isEnhanced
			).length;

			const library = await this.getLibrary();
			if (library.novels[novelId]) {
				library.novels[novelId].enhancedChaptersCount = enhancedCount;
				library.novels[novelId].lastReadChapter =
					chapterData.chapterNumber;
				library.novels[novelId].lastReadUrl = chapterData.url;
				library.novels[novelId].lastAccessedAt = Date.now();
				await this.saveLibrary(library);
			}

			return true;
		} catch (error) {
			console.error("Failed to update chapter:", error);
			return false;
		}
	}

	/**
	 * Get chapters data for a novel
	 * @param {string} novelId - Library novel ID
	 * @returns {Promise<Object>} Chapters data
	 */
	async getChapters(novelId) {
		try {
			const chaptersKey = this.CHAPTERS_KEY_PREFIX + novelId;
			const result = await browser.storage.local.get(chaptersKey);
			return result[chaptersKey] || { chapters: {} };
		} catch (error) {
			console.error("Failed to get chapters:", error);
			return { chapters: {} };
		}
	}

	/**
	 * Create novel data from current page context
	 * This is called by the content script when enhancing a chapter
	 * @param {Object} context - Page context with URL, title, etc.
	 * @param {Object} handler - The website handler for additional extraction
	 * @returns {Object|null} Novel data ready to save, or null if not supported
	 */
	createNovelFromContext(context, handler) {
		const { url, title, chapterNumber } = context;

		const shelf = this.getShelfForUrl(url);
		if (!shelf) {
			console.log("Novel Library: URL not from a supported site");
			return null;
		}

		const siteNovelId = this.extractNovelId(url, shelf);
		if (!siteNovelId) {
			console.log("Novel Library: Could not extract novel ID from URL");
			return null;
		}

		const novelId = this.generateNovelId(shelf.id, siteNovelId);

		// Extract title from page title (strip chapter info)
		// Most sites have format: "Chapter X - Novel Title" or "Novel Title - Chapter X"
		let novelTitle = title;
		// Try to clean up common patterns
		novelTitle = novelTitle
			.replace(/^chapter\s*\d+[\s\-:]+/i, "") // "Chapter 1 - Title" -> "Title"
			.replace(/[\s\-:]+chapter\s*\d+$/i, "") // "Title - Chapter 1" -> "Title"
			.replace(/\s*-\s*FanFiction\.Net$/i, "") // Remove FanFiction.Net suffix
			.replace(/\s*\[Archive of Our Own\]$/i, "") // Remove AO3 suffix
			.trim();

		return {
			id: novelId,
			shelfId: shelf.id,
			siteNovelId: siteNovelId,
			title: novelTitle || "Unknown Novel",
			author: context.author || "Unknown",
			coverUrl: context.coverUrl || "",
			description: context.description || "",
			sourceUrl: url,
			totalChapters: context.totalChapters || 0,
			lastReadChapter: chapterNumber || 1,
			lastReadUrl: url,
			status: context.status || "unknown",
			genres: context.genres || [],
			tags: context.tags || [],
			metadata: context.metadata || {},
		};
	}

	/**
	 * Export library data for backup
	 * @returns {Promise<Object>} Exportable library data
	 */
	async exportLibrary() {
		const library = await this.getLibrary();

		// Get all chapters data
		const allData = await browser.storage.local.get(null);
		const chaptersData = {};

		for (const key in allData) {
			if (key.startsWith(this.CHAPTERS_KEY_PREFIX)) {
				const novelId = key.replace(this.CHAPTERS_KEY_PREFIX, "");
				chaptersData[novelId] = allData[key];
			}
		}

		return {
			library,
			chapters: chaptersData,
			exportedAt: Date.now(),
			version: "1.0",
		};
	}

	/**
	 * Import library data from backup
	 * @param {Object} data - Exported library data
	 * @param {boolean} merge - If true, merges with existing data; if false, replaces
	 * @returns {Promise<{success: boolean, imported: number, updated: number, errors: number}>}
	 */
	async importLibrary(data, merge = true) {
		try {
			if (!data.library || !data.version) {
				throw new Error("Invalid import data format");
			}

			let imported = 0;
			let updated = 0;
			let errors = 0;

			if (merge) {
				// Merge with existing library
				const existingLibrary = await this.getLibrary();

				for (const [novelId, novel] of Object.entries(
					data.library.novels || {}
				)) {
					try {
						if (existingLibrary.novels[novelId]) {
							// Update existing novel - keep newer data
							const existing = existingLibrary.novels[novelId];
							existingLibrary.novels[novelId] = {
								...existing,
								...novel,
								// Keep the earlier addedAt date
								addedAt: Math.min(
									existing.addedAt || Date.now(),
									novel.addedAt || Date.now()
								),
								// Keep the later lastAccessedAt date
								lastAccessedAt: Math.max(
									existing.lastAccessedAt || 0,
									novel.lastAccessedAt || 0
								),
								// Combine enhanced chapters count (take max)
								enhancedChaptersCount: Math.max(
									existing.enhancedChaptersCount || 0,
									novel.enhancedChaptersCount || 0
								),
							};
							updated++;
						} else {
							// Add new novel
							existingLibrary.novels[novelId] = novel;
							imported++;
						}
					} catch (err) {
						console.error(`Error importing novel ${novelId}:`, err);
						errors++;
					}
				}

				// Update shelf stats
				for (const [shelfId, shelf] of Object.entries(SHELVES)) {
					existingLibrary.shelves[shelf.id] = {
						novelCount: Object.values(
							existingLibrary.novels
						).filter((n) => n.shelfId === shelf.id).length,
						lastUpdated: Date.now(),
					};
				}

				await this.saveLibrary(existingLibrary);

				// Merge chapters data
				if (data.chapters) {
					for (const [novelId, chapters] of Object.entries(
						data.chapters
					)) {
						try {
							const chaptersKey =
								this.CHAPTERS_KEY_PREFIX + novelId;
							const result = await browser.storage.local.get(
								chaptersKey
							);
							const existingChapters = result[chaptersKey] || {
								chapters: {},
							};

							// Merge chapter data
							existingChapters.chapters = {
								...existingChapters.chapters,
								...chapters.chapters,
							};

							await browser.storage.local.set({
								[chaptersKey]: existingChapters,
							});
						} catch (err) {
							console.error(
								`Error importing chapters for ${novelId}:`,
								err
							);
						}
					}
				}
			} else {
				// Replace mode - clear and set
				await browser.storage.local.set({
					[this.LIBRARY_KEY]: data.library,
				});
				imported = Object.keys(data.library.novels || {}).length;

				// Import chapters data
				if (data.chapters) {
					const chaptersToSave = {};
					for (const [novelId, chapters] of Object.entries(
						data.chapters
					)) {
						chaptersToSave[this.CHAPTERS_KEY_PREFIX + novelId] =
							chapters;
					}
					await browser.storage.local.set(chaptersToSave);
				}
			}

			console.log(
				`📚 Library imported: ${imported} new, ${updated} updated, ${errors} errors`
			);
			return { success: true, imported, updated, errors };
		} catch (error) {
			console.error("Failed to import library:", error);
			return {
				success: false,
				imported: 0,
				updated: 0,
				errors: 1,
				error: error.message,
			};
		}
	}

	/**
	 * Clear the entire library
	 * @returns {Promise<boolean>} Success status
	 */
	async clearLibrary() {
		try {
			// Get all keys to remove
			const allData = await browser.storage.local.get(null);
			const keysToRemove = [this.LIBRARY_KEY];

			for (const key in allData) {
				if (key.startsWith(this.CHAPTERS_KEY_PREFIX)) {
					keysToRemove.push(key);
				}
			}

			await browser.storage.local.remove(keysToRemove);
			console.log("📚 Library cleared");
			return true;
		} catch (error) {
			console.error("Failed to clear library:", error);
			return false;
		}
	}
}

// Export singleton instance
export const novelLibrary = new NovelLibrary();
export default novelLibrary;
