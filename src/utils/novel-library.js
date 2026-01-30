/**
 * Novel Library Manager for Ranobe Gemini
 * Manages a library of novels organized by site "shelves"
 * with unified storage across mobile/desktop variants
 */

import { debugLog, debugError } from "./logger.js";
import { DOMAIN_REGISTRY, SHELF_REGISTRY } from "./domain-constants.js";

/**
 * Reading status constants
 * Used to categorize novels by reading progress
 */
export const READING_STATUS = {
	READING: "reading",
	COMPLETED: "completed",
	PLAN_TO_READ: "plan-to-read",
	ON_HOLD: "on-hold",
	DROPPED: "dropped",
	RE_READING: "re-reading",
};

/**
 * Reading status display info
 */
export const READING_STATUS_INFO = {
	[READING_STATUS.READING]: { label: "📖 Reading", color: "#4caf50" },
	[READING_STATUS.COMPLETED]: { label: "✅ Completed", color: "#2196f3" },
	[READING_STATUS.PLAN_TO_READ]: {
		label: "📋 Plan to Read",
		color: "#ff9800",
	},
	[READING_STATUS.ON_HOLD]: { label: "⏸️ On Hold", color: "#9e9e9e" },
	[READING_STATUS.DROPPED]: { label: "❌ Dropped", color: "#f44336" },
	[READING_STATUS.RE_READING]: { label: "🔁 Re-reading", color: "#9c27b0" },
};

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
 * @property {boolean} autoEnhance - Whether to automatically enhance chapters for this novel
 * @property {Object} metadata - Additional site-specific metadata
 * @property {Object} editedFields - Fields that have been manually edited by user
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
	 * Get library-level settings with defaults applied
	 * @returns {Promise<Object>} Settings object
	 */
	async getSettings() {
		const defaults = {
			autoHoldEnabled: true,
			autoHoldDays: 7,
		};

		try {
			const result = await browser.storage.local.get(this.SETTINGS_KEY);
			return { ...defaults, ...(result[this.SETTINGS_KEY] || {}) };
		} catch (error) {
			debugError("Failed to load library settings:", error);
			return { ...defaults };
		}
	}

	/**
	 * Save library-level settings (merged with existing)
	 * @param {Object} updates - Partial settings to persist
	 * @returns {Promise<Object>} Persisted settings
	 */
	async saveSettings(updates) {
		try {
			const current = await this.getSettings();
			const merged = {
				...current,
				...updates,
				lastUpdated: Date.now(),
			};

			await browser.storage.local.set({
				[this.SETTINGS_KEY]: merged,
			});

			return merged;
		} catch (error) {
			debugError("Failed to save library settings:", error);
			return updates;
		}
	}

	/**
	 * Initialize the library (load from storage)
	 * @returns {Promise<Object>} Library data
	 */
	async init() {
		// Run migration for old ID format (underscore to hyphen)
		await this.migrateOldIdFormat();

		const library = await this.getLibrary();
		debugLog(
			`📚 Novel Library initialized with ${
				Object.keys(library.novels).length
			} novels`,
		);
		return library;
	}

	/**
	 * Migrate novels with old underscore ID format to new hyphen format
	 * e.g., "fanfiction_12345" -> "fanfiction-12345"
	 * @returns {Promise<void>}
	 */
	async migrateOldIdFormat() {
		try {
			const library = await this.getLibrary();
			const novels = library.novels;
			let migrated = 0;

			const novelEntries = Object.entries(novels);
			for (const [oldId, novel] of novelEntries) {
				// Check if ID uses old underscore format
				if (oldId.includes("_") && !oldId.includes("-")) {
					const newId = oldId.replace("_", "-");

					// Skip if new ID already exists
					if (novels[newId]) {
						// Delete the old one if duplicate
						delete novels[oldId];
						migrated++;
						continue;
					}

					// Update the ID in the novel object
					novel.id = newId;
					novels[newId] = novel;
					delete novels[oldId];

					// Also migrate chapters key
					const oldChaptersKey = this.CHAPTERS_KEY_PREFIX + oldId;
					const newChaptersKey = this.CHAPTERS_KEY_PREFIX + newId;

					const chaptersResult =
						await browser.storage.local.get(oldChaptersKey);
					if (chaptersResult[oldChaptersKey]) {
						await browser.storage.local.set({
							[newChaptersKey]: chaptersResult[oldChaptersKey],
						});
						await browser.storage.local.remove(oldChaptersKey);
					}

					migrated++;
				}
			}

			if (migrated > 0) {
				await this.saveLibrary(library);
				debugLog(`📚 Migrated ${migrated} novels from old ID format`);
			}
		} catch (error) {
			debugError("Error migrating old ID format:", error);
		}
	}

	/**
	 * Get the full library data
	 * @returns {Promise<Object>} Library object with novels and metadata
	 */
	async getLibrary() {
		try {
			const result = await browser.storage.local.get(this.LIBRARY_KEY);
			const library = result[this.LIBRARY_KEY] || {
				novels: {},
				shelves: {},
				lastUpdated: null,
				version: "1.0",
			};

			await this.applyStaleStatusRules(library);
			if (this.normalizeFanfictionMetadata(library)) {
				await this.saveLibrary(library);
			}
			return library;
		} catch (error) {
			debugError("Failed to get library:", error);
			return {
				novels: {},
				shelves: {},
				lastUpdated: null,
				version: "1.0",
			};
		}
	}

	/**
	 * Normalize FanFiction character/relationship metadata for existing novels.
	 * - Relationship groups come from bracketed names and are capped at 4.
	 * - Characters are cleaned of bracket fragments and status tokens.
	 * @param {Object} library
	 * @returns {boolean} Whether changes were applied.
	 */
	normalizeFanfictionMetadata(library) {
		if (!library || !library.novels) return false;
		let changed = false;

		const cleanName = (value) =>
			String(value || "")
				.replace(/[\[\]]/g, "")
				.replace(/\s+/g, " ")
				.trim();

		const isInvalidToken = (value) => {
			if (!value) return true;
			const cleaned = value.trim();
			if (!cleaned) return true;
			if (/^\d+$/.test(cleaned)) return true;
			if (/^\-?\s*status\s*:/i.test(cleaned)) return true;
			if (/^\-?\s*complete\s*\-?$/i.test(cleaned)) return true;
			if (
				/^\-?\s*complete\s*\-?$/i.test(cleaned.replace(/\s*\-\s*/g, ""))
			)
				return true;
			return false;
		};

		const addUnique = (list, value) => {
			if (!value) return;
			if (!list.includes(value)) list.push(value);
		};

		for (const novel of Object.values(library.novels)) {
			const shelfId = (novel.shelfId || "").toLowerCase();
			if (shelfId !== "fanfiction") continue;

			const meta = novel.metadata || {};
			let novelChanged = false;
			const sourceTags = Array.isArray(novel.tags) ? novel.tags : [];
			const sourceGenres = Array.isArray(novel.genres)
				? novel.genres
				: [];
			const sourceCharacters = Array.isArray(meta.characters)
				? meta.characters
				: [];

			const relationshipSet = new Set();
			const relationships = [];

			const addRelationshipGroup = (group) => {
				const cleaned = group
					.map((c) => cleanName(c))
					.filter((c) => !isInvalidToken(c))
					.slice(0, 4);
				if (cleaned.length < 2) return;
				const key = cleaned.join("|");
				if (relationshipSet.has(key)) return;
				relationshipSet.add(key);
				relationships.push(cleaned);
			};

			// Existing relationships
			if (Array.isArray(meta.relationships)) {
				meta.relationships.forEach((group) => {
					if (Array.isArray(group)) addRelationshipGroup(group);
				});
			}

			// Extract bracketed relationships from tags/genres
			const combined = [...sourceTags, ...sourceGenres].join(", ");
			const bracketMatches = combined.match(/\[([^\]]+)\]/g) || [];
			bracketMatches.forEach((bracket) => {
				const inside = bracket.replace(/[\[\]]/g, "").trim();
				if (!inside) return;
				addRelationshipGroup(inside.split(","));
			});

			const characterList = [];
			[...sourceCharacters, ...sourceTags, ...sourceGenres].forEach(
				(entry) => {
					const cleaned = cleanName(entry);
					if (isInvalidToken(cleaned)) return;
					addUnique(characterList, cleaned);
				},
			);

			relationships.forEach((group) => {
				group.forEach((c) => addUnique(characterList, c));
			});

			const prevChars = Array.isArray(meta.characters)
				? meta.characters
				: [];
			const prevRels = Array.isArray(meta.relationships)
				? meta.relationships
				: [];

			const charsChanged =
				JSON.stringify(prevChars) !== JSON.stringify(characterList);
			const relChanged =
				JSON.stringify(prevRels) !== JSON.stringify(relationships);

			if (charsChanged) {
				if (characterList.length) {
					meta.characters = characterList;
				} else {
					delete meta.characters;
				}
				novelChanged = true;
			}

			if (relChanged) {
				if (relationships.length) {
					meta.relationships = relationships;
				} else {
					delete meta.relationships;
				}
				novelChanged = true;
			}

			if (novelChanged) {
				novel.metadata = meta;
				changed = true;
			}
		}

		return changed;
	}

	/**
	 * Auto-adjust stale reading statuses:
	 * - If a novel hasn't been touched for 7+ days and is still READING:
	 *   - If progress is at chapter 1 (not started) → PLAN_TO_READ
	 *   - Otherwise → ON_HOLD
	 * Completed remains user-controlled.
	 * @param {Object} library
	 */
	async applyStaleStatusRules(library) {
		if (!library || !library.novels) return;

		const now = Date.now();
		const thresholdMs = 7 * 24 * 60 * 60 * 1000; // 7 days
		let changed = false;

		for (const novel of Object.values(library.novels)) {
			const lastActivity =
				novel.lastAccessedAt || novel.lastUpdated || novel.addedAt;
			if (!lastActivity || now - lastActivity < thresholdMs) continue;

			if (novel.readingStatus === READING_STATUS.READING) {
				const lastReadChapter = novel.lastReadChapter || 0;
				const currentChapter =
					novel.currentChapter || novel.metadata?.currentChapter || 0;
				const progressChapter = Math.max(
					lastReadChapter,
					currentChapter,
				);
				const totalChapters =
					novel.totalChapters || novel.metadata?.totalChapters || 0;

				if (progressChapter <= 1) {
					novel.readingStatus = READING_STATUS.PLAN_TO_READ;
				} else {
					novel.readingStatus = READING_STATUS.ON_HOLD;
				}

				novel.lastAccessedAt = now;
				changed = true;
			}
		}

		if (changed) {
			await this.saveLibrary(library);
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
			debugError("Failed to save library:", error);
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
			debugError("Error determining shelf for URL:", error);
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
			debugError("Error extracting novel ID:", error);
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
		// Use hyphen to match handler format (e.g., "fanfiction-12345")
		return `${shelfId}-${siteNovelId}`;
	}

	/**
	 * Add or update a novel in the library
	 * Respects manually edited fields - auto-updates won't overwrite them
	 * @param {Object} novelData - Novel data to add/update
	 * @param {boolean} isManualEdit - If true, marks changed fields as edited
	 * @returns {Promise<Object>} The saved novel
	 */
	async addOrUpdateNovel(novelData, isManualEdit = false) {
		const library = await this.getLibrary();

		const existingNovel = library.novels[novelData.id];
		const now = Date.now();

		if (existingNovel) {
			// Fields that can be auto-updated from site visits
			const autoUpdatableFields = [
				"title",
				"author",
				"coverUrl",
				"description",
				"status",
				"totalChapters",
				"genres",
				"tags",
				"metadata",
				"stats",
			];

			// Get existing edited fields or initialize empty
			const editedFields = existingNovel.editedFields || {};

			// If this is a manual edit, mark fields as edited
			if (isManualEdit) {
				for (const field of autoUpdatableFields) {
					if (
						novelData[field] !== undefined &&
						novelData[field] !== existingNovel[field]
					) {
						editedFields[field] = true;
					}
				}
			}

			// Build the updated novel data - ADDITIVE: never lose existing data
			const updatedNovel = { ...existingNovel };

			// Helper to check if a value is valid/meaningful
			const isValidValue = (val) => {
				if (val === undefined || val === null) return false;
				if (val === "" || val === "Unknown" || val === "Unknown Novel")
					return false;
				if (Array.isArray(val) && val.length === 0) return false;
				if (
					typeof val === "object" &&
					!Array.isArray(val) &&
					Object.keys(val).length === 0
				)
					return false;
				return true;
			};

			for (const [key, value] of Object.entries(novelData)) {
				if (key === "addedAt" || key === "editedFields") continue;

				// For auto-updates, skip fields that have been manually edited
				if (
					!isManualEdit &&
					autoUpdatableFields.includes(key) &&
					editedFields[key]
				) {
					debugLog(
						`📚 Skipping auto-update for manually edited field: ${key}`,
					);
					continue;
				}

				// Special handling for metadata and stats - merge objects, preserving existing values
				if (key === "metadata" || key === "stats") {
					const existingObj = existingNovel[key] || {};
					const newObj = value || {};

					// Merge but only keep new values if they are valid
					const merged = { ...existingObj };
					for (const [k, v] of Object.entries(newObj)) {
						if (isValidValue(v)) {
							merged[k] = v;
						}
					}
					updatedNovel[key] = merged;
					continue;
				}

				// For arrays (genres, tags), merge and deduplicate
				if (Array.isArray(value) && Array.isArray(existingNovel[key])) {
					if (value.length > 0) {
						// New data exists, use it but also preserve any unique existing items
						const merged = [
							...new Set([...value, ...existingNovel[key]]),
						];
						updatedNovel[key] = merged;
					}
					// If new array is empty, keep existing
					continue;
				}

				// ADDITIVE: Only update if new value is valid
				// If new value is empty/invalid, keep existing value
				if (isValidValue(value)) {
					updatedNovel[key] = value;
				} else if (isValidValue(existingNovel[key])) {
					// Keep existing valid value
					debugLog(
						`📚 Preserving existing ${key}: ${existingNovel[key]}`,
					);
				}
			}

			updatedNovel.lastAccessedAt = now;
			updatedNovel.addedAt = existingNovel.addedAt;
			updatedNovel.editedFields = editedFields;

			library.novels[novelData.id] = updatedNovel;
		} else {
			// Add new novel with proper defaults
			library.novels[novelData.id] = {
				...novelData,
				addedAt: now,
				lastAccessedAt: now,
				enhancedChaptersCount: novelData.enhancedChaptersCount || 0,
				// Set defaults for new novels:
				// - lastReadChapter defaults to 0 (not started yet)
				// - readingStatus defaults to PLAN_TO_READ
				// These will be overridden if novelData explicitly provides them
				lastReadChapter:
					novelData.lastReadChapter !== undefined
						? novelData.lastReadChapter
						: 0,
				readingStatus:
					novelData.readingStatus || READING_STATUS.PLAN_TO_READ,
				editedFields: {}, // Initialize empty edited fields
			};
		} // Update shelf stats
		if (!library.shelves[novelData.shelfId]) {
			library.shelves[novelData.shelfId] = {
				novelCount: 0,
				lastUpdated: now,
			};
		}

		// Recount novels for this shelf
		library.shelves[novelData.shelfId].novelCount = Object.values(
			library.novels,
		).filter((n) => n.shelfId === novelData.shelfId).length;
		library.shelves[novelData.shelfId].lastUpdated = now;

		await this.saveLibrary(library);

		debugLog(`📚 Novel saved to library: ${novelData.title}`);
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
	 * Update specific fields of a novel
	 * @param {string} novelId - Library novel ID
	 * @param {Object} updates - Fields to update
	 * @returns {Promise<Object|null>} Updated novel or null
	 */
	async updateNovel(novelId, updates) {
		try {
			const library = await this.getLibrary();
			if (!library.novels[novelId]) {
				debugError(`Novel not found: ${novelId}`);
				return null;
			}

			// Update specified fields
			for (const [key, value] of Object.entries(updates)) {
				library.novels[novelId][key] = value;
			}
			library.novels[novelId].lastAccessedAt = Date.now();

			await this.saveLibrary(library);
			debugLog(`📚 Updated novel: ${library.novels[novelId].title}`);
			return library.novels[novelId];
		} catch (error) {
			debugError("Error updating novel:", error);
			return null;
		}
	}

	/**
	 * Update reading progress and automatically adjust reading status
	 * @param {string} novelId - Library novel ID
	 * @param {number} chapterNumber - Current chapter number
	 * @param {string} chapterUrl - URL of the current chapter
	 * @returns {Promise<Object|null>} Updated novel or null
	 */
	async updateReadingProgress(novelId, chapterNumber, chapterUrl) {
		try {
			const library = await this.getLibrary();
			const novel = library.novels[novelId];

			if (!novel) {
				debugError(`Novel not found: ${novelId}`);
				return null;
			}

			const updates = {
				lastReadChapter: chapterNumber,
				lastReadUrl: chapterUrl,
				lastAccessedAt: Date.now(),
			};

			// Auto-update reading status based on progress
			const currentStatus =
				novel.readingStatus || READING_STATUS.PLAN_TO_READ;

			// Only auto-resume if status is "On Hold"
			if (
				currentStatus === READING_STATUS.ON_HOLD &&
				chapterNumber >= 1
			) {
				updates.readingStatus = READING_STATUS.READING;
				debugLog(`📚 Auto-status: On Hold → Reading`);
			}

			// If user reaches the last chapter, suggest completion
			// (Only auto-complete if they were actively reading)
			if (
				novel.totalChapters > 0 &&
				chapterNumber >= novel.totalChapters &&
				(currentStatus === READING_STATUS.READING ||
					currentStatus === READING_STATUS.RE_READING)
			) {
				updates.readingStatus = READING_STATUS.COMPLETED;
				debugLog(
					`📚 Auto-status: ${currentStatus} → Completed (reached chapter ${chapterNumber}/${novel.totalChapters})`,
				);
			}

			// Apply updates
			Object.assign(novel, updates);
			await this.saveLibrary(library);

			debugLog(
				`📚 Progress updated: Ch.${chapterNumber} - ${novel.title}`,
			);
			return novel;
		} catch (error) {
			debugError("Error updating reading progress:", error);
			return null;
		}
	}

	/**
	 * Update a novel's custom prompt
	 * @param {string} novelId - Library novel ID
	 * @param {string} customPrompt - Custom prompt for enhancement
	 * @returns {Promise<boolean>} Success status
	 */
	async updateNovelCustomPrompt(novelId, customPrompt) {
		try {
			const library = await this.getLibrary();
			if (!library.novels[novelId]) {
				debugError(`Novel not found: ${novelId}`);
				return false;
			}

			library.novels[novelId].customPrompt = customPrompt;
			library.novels[novelId].lastAccessedAt = Date.now();

			await this.saveLibrary(library);
			debugLog(
				`📝 Updated custom prompt for: ${library.novels[novelId].title}`,
			);
			return true;
		} catch (error) {
			debugError("Error updating novel custom prompt:", error);
			return false;
		}
	}

	/**
	 * Reset manually edited fields to allow auto-updates again
	 * @param {string} novelId - Library novel ID
	 * @param {Array<string>|string} fields - Field(s) to reset, or 'all' to reset all
	 * @returns {Promise<boolean>} Success status
	 */
	async resetEditedFields(novelId, fields = "all") {
		try {
			const library = await this.getLibrary();
			if (!library.novels[novelId]) {
				debugError(`Novel not found: ${novelId}`);
				return false;
			}

			const novel = library.novels[novelId];

			if (!novel.editedFields) {
				debugLog(`📚 No edited fields to reset for: ${novel.title}`);
				return true;
			}

			if (fields === "all") {
				novel.editedFields = {};
				debugLog(`📚 Reset all edited fields for: ${novel.title}`);
			} else {
				const fieldsToReset = Array.isArray(fields) ? fields : [fields];
				for (const field of fieldsToReset) {
					delete novel.editedFields[field];
				}
				debugLog(
					`📚 Reset edited fields [${fieldsToReset.join(
						", ",
					)}] for: ${novel.title}`,
				);
			}

			await this.saveLibrary(library);
			return true;
		} catch (error) {
			debugError("Error resetting edited fields:", error);
			return false;
		}
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
			(a, b) => b.lastAccessedAt - a.lastAccessedAt,
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
				0,
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
					0,
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
				library.novels,
			).filter((n) => n.shelfId === shelfId).length;
		}

		// Also remove chapters data
		try {
			await browser.storage.local.remove(
				this.CHAPTERS_KEY_PREFIX + novelId,
			);
		} catch (error) {
			debugError("Failed to remove chapters data:", error);
		}

		await this.saveLibrary(library);
		debugLog(`📚 Novel removed from library: ${novelId}`);
		return true;
	}

	/**
	 * Get all novels with a specific reading status
	 * @param {string} status - Reading status to filter by
	 * @returns {Promise<Array<Object>>} Array of novels with that status
	 */
	async getNovelsByReadingStatus(status) {
		const library = await this.getLibrary();
		return Object.values(library.novels)
			.filter((novel) => novel.readingStatus === status)
			.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
	}

	/**
	 * Update a novel's reading status
	 * @param {string} novelId - Library novel ID
	 * @param {string} status - New reading status
	 * @returns {Promise<boolean>} Success status
	 */
	async updateReadingStatus(novelId, status) {
		try {
			const library = await this.getLibrary();
			if (!library.novels[novelId]) {
				debugError(`Novel not found: ${novelId}`);
				return false;
			}

			library.novels[novelId].readingStatus = status;
			library.novels[novelId].lastAccessedAt = Date.now();

			await this.saveLibrary(library);
			debugLog(
				`📚 Updated reading status for ${library.novels[novelId].title}: ${status}`,
			);
			return true;
		} catch (error) {
			debugError("Error updating reading status:", error);
			return false;
		}
	}

	/**
	 * Get reading status statistics
	 * @returns {Promise<Object>} Object with count per status
	 */
	async getReadingStatusStats() {
		const library = await this.getLibrary();
		const novels = Object.values(library.novels);

		const stats = {
			total: novels.length,
			byStatus: {},
		};

		// Initialize all statuses with 0
		Object.values(READING_STATUS).forEach((status) => {
			stats.byStatus[status] = 0;
		});
		stats.byStatus["unset"] = 0;

		// Count novels per status
		novels.forEach((novel) => {
			const status = novel.readingStatus || "unset";
			if (stats.byStatus[status] !== undefined) {
				stats.byStatus[status]++;
			} else {
				stats.byStatus["unset"]++;
			}
		});

		return stats;
	}

	/**
	 * Update novel metadata retroactively if new data is found
	 * Also handles readingStatus and other direct updates
	 * @param {string} novelId - Library novel ID
	 * @param {Object} newMetadata - New metadata to merge
	 * @returns {Promise<boolean>} Success status
	 */
	async updateNovelMetadata(novelId, newMetadata) {
		try {
			const library = await this.getLibrary();
			const novel = library.novels[novelId];

			if (!novel) {
				debugLog("Novel Library: Novel not found for metadata update");
				return false;
			}

			// Get existing edited fields or initialize empty
			const editedFields = novel.editedFields || {};
			let updated = false;

			// Fields that can be auto-updated (respecting editedFields)
			const autoUpdatableFields = [
				"description",
				"author",
				"coverUrl",
				"title",
				"status",
				"totalChapters",
				"genres",
				"tags",
				"metadata",
				"stats",
			];

			// Helper to check if a value is valid/meaningful
			const isValidValue = (val) => {
				if (val === undefined || val === null) return false;
				if (val === "" || val === "Unknown" || val === "Unknown Novel")
					return false;
				if (Array.isArray(val) && val.length === 0) return false;
				if (
					typeof val === "object" &&
					!Array.isArray(val) &&
					Object.keys(val).length === 0
				)
					return false;
				return true;
			};

			// Update auto-updatable fields (skip if manually edited)
			for (const field of autoUpdatableFields) {
				if (newMetadata[field] !== undefined) {
					// Skip if manually edited
					if (editedFields[field]) {
						debugLog(`📚 Skipping edited field: ${field}`);
						continue;
					}

					// Special handling for metadata and stats - merge objects, preserving existing
					if (field === "metadata" || field === "stats") {
						const existingObj = novel[field] || {};
						const newObj = newMetadata[field] || {};

						// Merge but only update with valid new values
						const merged = { ...existingObj };
						let hasChanges = false;
						for (const [k, v] of Object.entries(newObj)) {
							if (isValidValue(v)) {
								if (merged[k] !== v) hasChanges = true;
								merged[k] = v;
							}
						}
						if (hasChanges) {
							novel[field] = merged;
							debugLog(`📚 Merging ${field}:`, novel[field]);
							updated = true;
						}
						continue;
					}

					// For arrays, merge and deduplicate if new data exists
					if (
						Array.isArray(newMetadata[field]) &&
						Array.isArray(novel[field])
					) {
						if (newMetadata[field].length > 0) {
							const merged = [
								...new Set([
									...newMetadata[field],
									...novel[field],
								]),
							];
							if (
								merged.length !== novel[field].length ||
								!merged.every((v, i) => v === novel[field][i])
							) {
								novel[field] = merged;
								updated = true;
							}
						}
						continue;
					}

					// ADDITIVE: Only update if new value is valid AND (novel has no value OR new is better)
					const hasValidNewValue = isValidValue(newMetadata[field]);
					const hasExistingValue = isValidValue(novel[field]);

					// Special handling for totalChapters - allow 0 to be updated to a positive number
					const shouldUpdate =
						field === "totalChapters"
							? (!novel[field] || novel[field] === 0) &&
								hasValidNewValue
							: hasValidNewValue &&
								(!hasExistingValue || hasValidNewValue);

					if (shouldUpdate && hasValidNewValue) {
						debugLog(
							`📚 Updating ${field}: ${novel[field]} -> ${newMetadata[field]}`,
						);
						novel[field] = newMetadata[field];
						updated = true;
					} else if (!hasValidNewValue && hasExistingValue) {
						debugLog(
							`📚 Preserving existing ${field}: ${novel[field]}`,
						);
					}
				}
			} // Direct updates (always apply, not auto-updatable)
			// These are user actions, not site scraping
			if (newMetadata.readingStatus !== undefined) {
				novel.readingStatus = newMetadata.readingStatus;
				updated = true;
			}

			if (newMetadata.lastReadChapter !== undefined) {
				novel.lastReadChapter = newMetadata.lastReadChapter;
				updated = true;
			}

			if (newMetadata.lastReadUrl !== undefined) {
				novel.lastReadUrl = newMetadata.lastReadUrl;
				updated = true;
			}

			// Main novel URL (sourceUrl) can be updated
			if (newMetadata.mainNovelUrl && !novel.sourceUrl) {
				novel.sourceUrl = newMetadata.mainNovelUrl;
				updated = true;
			}

			if (updated) {
				novel.lastAccessedAt = Date.now();
				library.novels[novelId] = novel;
				await this.saveLibrary(library);
				debugLog("Novel Library: Updated metadata for", novel.title);
			}

			return updated;
		} catch (error) {
			debugError("Failed to update novel metadata:", error);
			return false;
		}
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
				(ch) => ch.isEnhanced,
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
			debugError("Failed to update chapter:", error);
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
			debugError("Failed to get chapters:", error);
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
			debugLog("Novel Library: URL not from a supported site");
			return null;
		}

		// Use handler's generateNovelId if available (ensures consistency)
		let novelId;
		let siteNovelId;

		if (handler && typeof handler.generateNovelId === "function") {
			novelId = handler.generateNovelId(url);
			// Extract the site ID portion from handler's ID (e.g., "fanfiction-12345" -> "12345")
			siteNovelId = novelId.replace(/^[a-z]+-/, "");
		} else {
			// Fallback to library's extraction
			siteNovelId = this.extractNovelId(url, shelf);
			if (!siteNovelId) {
				debugLog("Novel Library: Could not extract novel ID from URL");
				return null;
			}
			novelId = this.generateNovelId(shelf.id, siteNovelId);
		}

		if (!novelId) {
			debugLog("Novel Library: Could not generate novel ID");
			return null;
		}

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
			lastReadChapter: chapterNumber || 1, // From context, so we're on a chapter
			lastReadUrl: url,
			readingStatus: READING_STATUS.READING, // User is reading this chapter
			status: context.status || "unknown",
			genres: context.genres || [],
			tags: context.tags || [],
			metadata: context.metadata || {},
			customPrompt: "", // Novel-specific custom prompt for enhancement
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

			// Helper to check if a value is valid/meaningful
			const isValidValue = (val) => {
				if (val === undefined || val === null) return false;
				if (val === "" || val === "Unknown" || val === "Unknown Novel")
					return false;
				if (Array.isArray(val) && val.length === 0) return false;
				if (
					typeof val === "object" &&
					!Array.isArray(val) &&
					Object.keys(val).length === 0
				)
					return false;
				return true;
			};

			// Helper to merge two novels, keeping the best data from both
			const mergeNovels = (existing, incoming) => {
				const merged = { ...existing };

				for (const [key, incomingValue] of Object.entries(incoming)) {
					const existingValue = existing[key];

					// Special timestamp handling
					if (key === "addedAt") {
						// Keep the earlier addedAt date
						merged[key] = Math.min(
							existingValue || Date.now(),
							incomingValue || Date.now(),
						);
						continue;
					}
					if (
						key === "lastAccessedAt" ||
						key === "lastUpdated" ||
						key === "lastMetadataUpdate"
					) {
						// Keep the later timestamp
						merged[key] = Math.max(
							existingValue || 0,
							incomingValue || 0,
						);
						continue;
					}
					if (
						key === "enhancedChaptersCount" ||
						key === "lastReadChapter"
					) {
						// Take the higher value
						merged[key] = Math.max(
							existingValue || 0,
							incomingValue || 0,
						);
						continue;
					}

					// Special handling for metadata and stats - deep merge
					if (key === "metadata" || key === "stats") {
						const existingObj = existingValue || {};
						const incomingObj = incomingValue || {};
						const mergedObj = { ...existingObj };

						for (const [k, v] of Object.entries(incomingObj)) {
							// Only take incoming if it's valid
							if (isValidValue(v)) {
								mergedObj[k] = v;
							}
						}
						merged[key] = mergedObj;
						continue;
					}

					// For arrays, merge and deduplicate
					if (
						Array.isArray(incomingValue) &&
						Array.isArray(existingValue)
					) {
						if (incomingValue.length > 0) {
							merged[key] = [
								...new Set([
									...incomingValue,
									...existingValue,
								]),
							];
						}
						// If incoming is empty but existing has data, keep existing
						continue;
					}

					// For other fields: only update if incoming is valid
					// If incoming is invalid but existing is valid, keep existing
					if (isValidValue(incomingValue)) {
						merged[key] = incomingValue;
					}
					// Otherwise, merged already has existing value from spread
				}

				return merged;
			};

			if (merge) {
				// Merge with existing library
				const existingLibrary = await this.getLibrary();

				for (const [novelId, novel] of Object.entries(
					data.library.novels || {},
				)) {
					try {
						if (existingLibrary.novels[novelId]) {
							// Update existing novel - use additive merge
							const existing = existingLibrary.novels[novelId];
							existingLibrary.novels[novelId] = mergeNovels(
								existing,
								novel,
							);
							updated++;
						} else {
							// Add new novel
							existingLibrary.novels[novelId] = novel;
							imported++;
						}
					} catch (err) {
						debugError(`Error importing novel ${novelId}:`, err);
						errors++;
					}
				}

				// Update shelf stats
				for (const [shelfId, shelf] of Object.entries(SHELVES)) {
					existingLibrary.shelves[shelf.id] = {
						novelCount: Object.values(
							existingLibrary.novels,
						).filter((n) => n.shelfId === shelf.id).length,
						lastUpdated: Date.now(),
					};
				}

				await this.saveLibrary(existingLibrary);

				// Merge chapters data
				if (data.chapters) {
					for (const [novelId, chapters] of Object.entries(
						data.chapters,
					)) {
						try {
							const chaptersKey =
								this.CHAPTERS_KEY_PREFIX + novelId;
							const result =
								await browser.storage.local.get(chaptersKey);
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
							debugError(
								`Error importing chapters for ${novelId}:`,
								err,
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
						data.chapters,
					)) {
						chaptersToSave[this.CHAPTERS_KEY_PREFIX + novelId] =
							chapters;
					}
					await browser.storage.local.set(chaptersToSave);
				}
			}

			debugLog(
				`📚 Library imported: ${imported} new, ${updated} updated, ${errors} errors`,
			);
			return { success: true, imported, updated, errors };
		} catch (error) {
			debugError("Failed to import library:", error);
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
			debugLog("📚 Library cleared");
			return true;
		} catch (error) {
			debugError("Failed to clear library:", error);
			return false;
		}
	}

	/**
	 * Find duplicate novels in the library
	 * Duplicates are identified by:
	 * 1. Same siteNovelId within the same shelf
	 * 2. Very similar titles (normalized) within the same shelf
	 * @param {string} shelfId - Optional: limit search to specific shelf
	 * @returns {Promise<Array>} Array of duplicate groups
	 */
	async findDuplicates(shelfId = null) {
		const library = await this.getLibrary();
		const novels = Object.values(library.novels);

		// Filter by shelf if specified
		const filteredNovels = shelfId
			? novels.filter((n) => n.shelfId === shelfId)
			: novels;

		const duplicateGroups = [];
		const processedIds = new Set();

		// Helper to normalize title for comparison
		const normalizeTitle = (title) => {
			if (!title) return "";
			return title
				.toLowerCase()
				.replace(/[^\w\s]/g, "") // Remove punctuation
				.replace(/\s+/g, " ") // Normalize whitespace
				.trim();
		};

		// Group by siteNovelId first (most reliable)
		const bySiteNovelId = {};
		for (const novel of filteredNovels) {
			if (novel.siteNovelId) {
				const key = `${novel.shelfId}_${novel.siteNovelId}`;
				if (!bySiteNovelId[key]) {
					bySiteNovelId[key] = [];
				}
				bySiteNovelId[key].push(novel);
			}
		}

		// Find groups with more than one novel (duplicates by siteNovelId)
		for (const [key, group] of Object.entries(bySiteNovelId)) {
			if (group.length > 1) {
				duplicateGroups.push({
					reason: "same_site_novel_id",
					key: key,
					novels: group.map((n) => ({
						id: n.id,
						title: n.title,
						siteNovelId: n.siteNovelId,
						addedAt: n.addedAt,
						lastAccessedAt: n.lastAccessedAt,
						enhancedChaptersCount: n.enhancedChaptersCount || 0,
					})),
				});
				group.forEach((n) => processedIds.add(n.id));
			}
		}

		// Also check for title similarity (for novels without matching siteNovelId)
		const byNormalizedTitle = {};
		for (const novel of filteredNovels) {
			if (processedIds.has(novel.id)) continue;

			const normalizedTitle = normalizeTitle(novel.title);
			if (!normalizedTitle) continue;

			const key = `${novel.shelfId}_${normalizedTitle}`;
			if (!byNormalizedTitle[key]) {
				byNormalizedTitle[key] = [];
			}
			byNormalizedTitle[key].push(novel);
		}

		// Find groups with more than one novel (duplicates by title)
		for (const [key, group] of Object.entries(byNormalizedTitle)) {
			if (group.length > 1) {
				duplicateGroups.push({
					reason: "similar_title",
					key: key,
					novels: group.map((n) => ({
						id: n.id,
						title: n.title,
						siteNovelId: n.siteNovelId,
						addedAt: n.addedAt,
						lastAccessedAt: n.lastAccessedAt,
						enhancedChaptersCount: n.enhancedChaptersCount || 0,
					})),
				});
			}
		}

		debugLog(`📚 Found ${duplicateGroups.length} duplicate groups`);
		return duplicateGroups;
	}

	/**
	 * Merge duplicate novels, keeping the one with the most data
	 * @param {Array<string>} novelIds - Array of novel IDs to merge
	 * @param {string} keepId - Optional: ID of the novel to keep (auto-selects best if not provided)
	 * @returns {Promise<Object>} Result with kept novel and removed count
	 */
	async mergeDuplicates(novelIds, keepId = null) {
		if (!novelIds || novelIds.length < 2) {
			return { success: false, error: "Need at least 2 novels to merge" };
		}

		const library = await this.getLibrary();
		const novels = novelIds.map((id) => library.novels[id]).filter(Boolean);

		if (novels.length < 2) {
			return { success: false, error: "Not enough valid novels found" };
		}

		// Determine which novel to keep (most data/activity)
		let novelToKeep;
		if (keepId && library.novels[keepId]) {
			novelToKeep = library.novels[keepId];
		} else {
			// Score novels by data quality
			const scoreNovel = (novel) => {
				let score = 0;
				if (novel.enhancedChaptersCount)
					score += novel.enhancedChaptersCount * 10;
				if (novel.lastReadChapter) score += novel.lastReadChapter;
				if (novel.coverUrl) score += 5;
				if (novel.description) score += 3;
				if (novel.author) score += 2;
				if (novel.lastAccessedAt) score += 1;
				return score;
			};

			novelToKeep = novels.reduce((best, current) =>
				scoreNovel(current) > scoreNovel(best) ? current : best,
			);
		}

		const keepNovelId = novelToKeep.id;
		const removeIds = novelIds.filter((id) => id !== keepNovelId);

		// Merge data from other novels into the keeper
		for (const removeId of removeIds) {
			const removeNovel = library.novels[removeId];
			if (!removeNovel) continue;

			// Merge reading progress (keep highest)
			if (
				removeNovel.lastReadChapter > (novelToKeep.lastReadChapter || 0)
			) {
				novelToKeep.lastReadChapter = removeNovel.lastReadChapter;
				novelToKeep.lastReadUrl = removeNovel.lastReadUrl;
			}

			// Merge enhanced chapters count (keep highest)
			if (
				(removeNovel.enhancedChaptersCount || 0) >
				(novelToKeep.enhancedChaptersCount || 0)
			) {
				novelToKeep.enhancedChaptersCount =
					removeNovel.enhancedChaptersCount;
			}

			// Merge reading status (prefer more advanced status)
			// Priority: COMPLETED > READING > ON_HOLD > DROPPED > PLAN_TO_READ
			const statusPriority = {
				completed: 5,
				reading: 4,
				on_hold: 3,
				dropped: 2,
				plan_to_read: 1,
			};
			const keepStatus = novelToKeep.readingStatus || "plan_to_read";
			const removeStatus = removeNovel.readingStatus || "plan_to_read";
			if (
				(statusPriority[removeStatus] || 0) >
				(statusPriority[keepStatus] || 0)
			) {
				novelToKeep.readingStatus = removeStatus;
			}

			// Merge total chapters (keep highest)
			if (
				(removeNovel.totalChapters || 0) >
				(novelToKeep.totalChapters || 0)
			) {
				novelToKeep.totalChapters = removeNovel.totalChapters;
			}

			// Merge cover URL if kept novel doesn't have one
			if (!novelToKeep.coverUrl && removeNovel.coverUrl) {
				novelToKeep.coverUrl = removeNovel.coverUrl;
			}

			// Merge description if kept novel doesn't have one
			if (!novelToKeep.description && removeNovel.description) {
				novelToKeep.description = removeNovel.description;
			}

			// Merge genres/tags (combine unique)
			if (removeNovel.genres && removeNovel.genres.length > 0) {
				const existingGenres = novelToKeep.genres || [];
				novelToKeep.genres = [
					...new Set([...existingGenres, ...removeNovel.genres]),
				];
			}
			if (removeNovel.tags && removeNovel.tags.length > 0) {
				const existingTags = novelToKeep.tags || [];
				novelToKeep.tags = [
					...new Set([...existingTags, ...removeNovel.tags]),
				];
			}

			// Merge chapter data
			try {
				const keepChaptersKey = this.CHAPTERS_KEY_PREFIX + keepNovelId;
				const removeChaptersKey = this.CHAPTERS_KEY_PREFIX + removeId;

				const [keepResult, removeResult] = await Promise.all([
					browser.storage.local.get(keepChaptersKey),
					browser.storage.local.get(removeChaptersKey),
				]);

				const keepChapters = keepResult[keepChaptersKey] || {
					chapters: {},
				};
				const removeChapters = removeResult[removeChaptersKey] || {
					chapters: {},
				};

				// Merge chapters, preferring enhanced ones
				for (const [chapterId, chapter] of Object.entries(
					removeChapters.chapters || {},
				)) {
					const existingChapter = keepChapters.chapters[chapterId];
					if (
						!existingChapter ||
						(chapter.isEnhanced && !existingChapter.isEnhanced)
					) {
						keepChapters.chapters[chapterId] = chapter;
					}
				}

				// Save merged chapters and remove old
				await browser.storage.local.set({
					[keepChaptersKey]: keepChapters,
				});
				await browser.storage.local.remove(removeChaptersKey);
			} catch (err) {
				debugError(`Error merging chapters for ${removeId}:`, err);
			}

			// Remove the duplicate novel
			delete library.novels[removeId];
		}

		// Update the kept novel
		library.novels[keepNovelId] = novelToKeep;

		// Update shelf stats
		if (novelToKeep.shelfId && library.shelves[novelToKeep.shelfId]) {
			library.shelves[novelToKeep.shelfId].novelCount = Object.values(
				library.novels,
			).filter((n) => n.shelfId === novelToKeep.shelfId).length;
			library.shelves[novelToKeep.shelfId].lastUpdated = Date.now();
		}

		await this.saveLibrary(library);

		debugLog(
			`📚 Merged ${removeIds.length} duplicates into ${novelToKeep.title}`,
		);
		return {
			success: true,
			keptNovel: novelToKeep,
			removedCount: removeIds.length,
			removedIds: removeIds,
		};
	}

	/**
	 * Automatically find and merge all duplicates in the library
	 * @param {string} shelfId - Optional: limit to specific shelf
	 * @returns {Promise<Object>} Results summary
	 */
	async cleanupDuplicates(shelfId = null) {
		const duplicateGroups = await this.findDuplicates(shelfId);

		if (duplicateGroups.length === 0) {
			debugLog("📚 No duplicates found");
			return { success: true, mergedGroups: 0, totalRemoved: 0 };
		}

		let mergedGroups = 0;
		let totalRemoved = 0;
		const errors = [];

		for (const group of duplicateGroups) {
			try {
				const novelIds = group.novels.map((n) => n.id);
				const result = await this.mergeDuplicates(novelIds);
				if (result.success) {
					mergedGroups++;
					totalRemoved += result.removedCount;
				} else {
					errors.push({ group: group.key, error: result.error });
				}
			} catch (err) {
				errors.push({ group: group.key, error: err.message });
			}
		}

		debugLog(
			`📚 Cleanup complete: ${mergedGroups} groups merged, ${totalRemoved} duplicates removed`,
		);
		return {
			success: errors.length === 0,
			mergedGroups,
			totalRemoved,
			errors: errors.length > 0 ? errors : undefined,
		};
	}
}

// Export singleton instance
export const novelLibrary = new NovelLibrary();
export default novelLibrary;

/**
 * Helper function to get novel library (returns novels object)
 * @returns {Promise<Object>} Library novels object
 */
export async function getNovelLibrary() {
	const lib = await novelLibrary.getLibrary();
	return lib.novels || {};
}

/**
 * Helper function to update a novel in the library
 * @param {Object} novel - Novel to update
 * @returns {Promise<boolean>} Success status
 */
export async function updateNovelInLibrary(novelOrId, updates = {}) {
	if (novelOrId && typeof novelOrId === "object") {
		const novelId = novelOrId.id;
		if (!novelId) return null;
		return await novelLibrary.updateNovel(novelId, novelOrId);
	}

	if (!novelOrId) return null;
	return await novelLibrary.updateNovel(novelOrId, updates);
}
