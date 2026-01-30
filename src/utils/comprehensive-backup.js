/**
 * Comprehensive Backup System for Ranobe Gemini
 * Handles complete backup/restore of all extension data including:
 * - Library data (novels, chapters, reading history)
 * - Settings (prompts, API keys, model configuration)
 * - Google Drive credentials (optional)
 * - Site-specific settings
 */

import { debugLog, debugError } from "./logger.js";
import { COMPREHENSIVE_BACKUP_KEYS } from "./constants.js";

const ROLLING_BACKUP_KEY = "rg_rolling_backup";
const ROLLING_BACKUP_METADATA_KEY = "rg_rolling_backup_meta";
const MAX_ROLLING_BACKUPS = 5;
const BACKUP_VERSION = "2.0";

/**
 * Comprehensive backup options
 */
export const BACKUP_OPTIONS = {
	LIBRARY_ONLY: "library",
	SETTINGS_ONLY: "settings",
	FULL: "full",
	CUSTOM: "custom",
};

/**
 * Create a comprehensive backup of all extension data
 * @param {Object} options - Backup options
 * @param {string} options.type - Type of backup: 'library', 'settings', 'full', 'custom'
 * @param {boolean} options.includeCredentials - Include OAuth credentials
 * @param {boolean} options.includeApiKeys - Include API keys
 * @param {Array<string>} options.customKeys - Custom keys to backup (for 'custom' type)
 * @returns {Promise<Object>} Backup data object
 */
export async function createComprehensiveBackup(options = {}) {
	const {
		type = BACKUP_OPTIONS.FULL,
		includeCredentials = false,
		includeApiKeys = true,
		customKeys = [],
	} = options;

	try {
		let keysToBackup = [];

		switch (type) {
			case BACKUP_OPTIONS.LIBRARY_ONLY:
				keysToBackup = ["novelHistory"];
				break;
			case BACKUP_OPTIONS.SETTINGS_ONLY:
				keysToBackup = COMPREHENSIVE_BACKUP_KEYS.filter(
					(k) => k !== "novelHistory",
				);
				break;
			case BACKUP_OPTIONS.CUSTOM:
				keysToBackup = customKeys;
				break;
			case BACKUP_OPTIONS.FULL:
			default:
				keysToBackup = [...COMPREHENSIVE_BACKUP_KEYS];
				break;
		}

		// Filter out credentials if not wanted
		if (!includeCredentials) {
			keysToBackup = keysToBackup.filter(
				(k) => !["driveClientId", "driveClientSecret"].includes(k),
			);
		}

		if (!includeApiKeys) {
			keysToBackup = keysToBackup.filter(
				(k) => !["apiKey", "backupApiKeys"].includes(k),
			);
		}

		// Get all requested data
		const allData = await browser.storage.local.get(keysToBackup);

		// Get chapters data separately (stored with prefix)
		const chaptersData = {};
		if (
			type === BACKUP_OPTIONS.FULL ||
			type === BACKUP_OPTIONS.LIBRARY_ONLY
		) {
			const fullStorage = await browser.storage.local.get(null);
			for (const key in fullStorage) {
				if (key.startsWith("novel_chapters_")) {
					chaptersData[key] = fullStorage[key];
				}
			}
		}

		const backup = {
			version: BACKUP_VERSION,
			type,
			createdAt: Date.now(),
			createdAtISO: new Date().toISOString(),
			extensionVersion:
				browser.runtime.getManifest?.()?.version || "unknown",
			browser: detectBrowser(),
			data: allData,
			chapters: chaptersData,
			metadata: {
				novelCount: Object.keys(allData.novelHistory || {}).length,
				hasApiKey: !!allData.apiKey,
				hasPrompts: !!(allData.promptTemplate || allData.summaryPrompt),
				hasDriveCredentials: !!allData.driveClientId,
				includesCredentials: includeCredentials,
				includesApiKeys: includeApiKeys,
			},
		};

		debugLog("✓ Comprehensive backup created:", backup.metadata);
		return backup;
	} catch (error) {
		debugError("Failed to create comprehensive backup:", error);
		throw error;
	}
}

/**
 * Restore from a comprehensive backup
 * @param {Object} backup - The backup data object
 * @param {Object} options - Restore options
 * @param {string} options.mode - 'merge' or 'replace'
 * @param {boolean} options.restoreCredentials - Restore OAuth credentials
 * @param {boolean} options.restoreApiKeys - Restore API keys
 * @returns {Promise<Object>} Restore result
 */
export async function restoreComprehensiveBackup(backup, options = {}) {
	const {
		mode = "merge",
		restoreCredentials = false,
		restoreApiKeys = true,
	} = options;

	try {
		if (!backup || !backup.version || !backup.data) {
			throw new Error("Invalid backup format");
		}

		const results = {
			success: true,
			restoredKeys: [],
			skippedKeys: [],
			errors: [],
		};

		const dataToRestore = { ...backup.data };

		// Filter out credentials if not wanted
		if (!restoreCredentials) {
			delete dataToRestore.driveClientId;
			delete dataToRestore.driveClientSecret;
			results.skippedKeys.push("driveClientId", "driveClientSecret");
		}

		if (!restoreApiKeys) {
			delete dataToRestore.apiKey;
			delete dataToRestore.backupApiKeys;
			results.skippedKeys.push("apiKey", "backupApiKeys");
		}

		if (mode === "merge") {
			// Merge with existing data
			const existingData = await browser.storage.local.get(
				Object.keys(dataToRestore),
			);

			for (const [key, value] of Object.entries(dataToRestore)) {
				if (key === "novelHistory" && existingData.novelHistory) {
					// Smart merge library data
					dataToRestore[key] = smartMergeLibrary(
						existingData.novelHistory,
						value,
					);
				}
				results.restoredKeys.push(key);
			}
		} else {
			results.restoredKeys = Object.keys(dataToRestore);
		}

		// Restore main data
		await browser.storage.local.set(dataToRestore);

		// Restore chapters data if present
		if (backup.chapters && Object.keys(backup.chapters).length > 0) {
			await browser.storage.local.set(backup.chapters);
			results.restoredKeys.push(
				...Object.keys(backup.chapters).map((k) => `(chapters) ${k}`),
			);
		}

		debugLog("✓ Comprehensive backup restored:", results);
		return results;
	} catch (error) {
		debugError("Failed to restore comprehensive backup:", error);
		throw error;
	}
}

/**
 * Smart merge library data
 */
function smartMergeLibrary(existing, incoming) {
	const merged = { ...existing };

	for (const [novelId, novel] of Object.entries(incoming || {})) {
		if (!merged[novelId]) {
			merged[novelId] = novel;
			continue;
		}

		const existingNovel = merged[novelId];
		const existingAccess = existingNovel.lastAccessedAt || 0;
		const incomingAccess = novel.lastAccessedAt || 0;

		// Keep the more recently accessed version
		if (incomingAccess > existingAccess) {
			merged[novelId] = {
				...novel,
				addedAt: Math.min(
					existingNovel.addedAt || Date.now(),
					novel.addedAt || Date.now(),
				),
			};
		} else {
			// Keep existing but update some fields from incoming
			merged[novelId] = {
				...existingNovel,
				enhancedChaptersCount: Math.max(
					existingNovel.enhancedChaptersCount || 0,
					novel.enhancedChaptersCount || 0,
				),
			};
		}
	}

	return merged;
}

/**
 * Create a rolling backup (stored in browser storage)
 * Called automatically on significant changes
 */
export async function createRollingBackup(reason = "auto") {
	try {
		const backup = await createComprehensiveBackup({
			type: BACKUP_OPTIONS.FULL,
			includeCredentials: false,
			includeApiKeys: true,
		});

		backup.reason = reason;
		backup.isRolling = true;

		// Get existing rolling backups
		const result = await browser.storage.local.get(
			ROLLING_BACKUP_METADATA_KEY,
		);
		const metadata = result[ROLLING_BACKUP_METADATA_KEY] || [];

		// Add new backup
		const backupKey = `${ROLLING_BACKUP_KEY}_${Date.now()}`;
		metadata.unshift({
			key: backupKey,
			timestamp: backup.createdAt,
			reason,
			novelCount: backup.metadata.novelCount,
		});

		// Keep only MAX_ROLLING_BACKUPS
		const toDelete = metadata.slice(MAX_ROLLING_BACKUPS);
		const toKeep = metadata.slice(0, MAX_ROLLING_BACKUPS);

		// Delete old backups
		for (const old of toDelete) {
			await browser.storage.local.remove(old.key);
		}

		// Save new backup and updated metadata
		await browser.storage.local.set({
			[backupKey]: backup,
			[ROLLING_BACKUP_METADATA_KEY]: toKeep,
		});

		debugLog(`✓ Rolling backup created (${reason}):`, backupKey);
		return { key: backupKey, backup };
	} catch (error) {
		debugError("Failed to create rolling backup:", error);
		return null;
	}
}

/**
 * List available rolling backups
 */
export async function listRollingBackups() {
	try {
		const result = await browser.storage.local.get(
			ROLLING_BACKUP_METADATA_KEY,
		);
		const metadata = result[ROLLING_BACKUP_METADATA_KEY] || [];

		return metadata.map((m) => ({
			...m,
			dateStr: new Date(m.timestamp).toLocaleString(),
		}));
	} catch (error) {
		debugError("Failed to list rolling backups:", error);
		return [];
	}
}

/**
 * Get a specific rolling backup
 */
export async function getRollingBackup(key) {
	try {
		const result = await browser.storage.local.get(key);
		return result[key] || null;
	} catch (error) {
		debugError("Failed to get rolling backup:", error);
		return null;
	}
}

/**
 * Delete a rolling backup
 */
export async function deleteRollingBackup(key) {
	try {
		await browser.storage.local.remove(key);

		const result = await browser.storage.local.get(
			ROLLING_BACKUP_METADATA_KEY,
		);
		const metadata = (result[ROLLING_BACKUP_METADATA_KEY] || []).filter(
			(m) => m.key !== key,
		);

		await browser.storage.local.set({
			[ROLLING_BACKUP_METADATA_KEY]: metadata,
		});

		debugLog("✓ Rolling backup deleted:", key);
		return true;
	} catch (error) {
		debugError("Failed to delete rolling backup:", error);
		return false;
	}
}

/**
 * Parse Google OAuth JSON credentials file
 * Supports both "web" and "installed" application types
 * @param {string} jsonString - The JSON string from client_secret file
 * @returns {Object} Parsed credentials with clientId, clientSecret, redirectUris
 */
export function parseOAuthCredentials(jsonString) {
	try {
		// Trim whitespace to handle any formatting (single-line or multi-line)
		const trimmedJson = jsonString.trim();
		const parsed = JSON.parse(trimmedJson);

		// Check for "web" type (Web application)
		if (parsed.web) {
			return {
				valid: true,
				type: "web",
				clientId: parsed.web.client_id,
				clientSecret: parsed.web.client_secret,
				redirectUris: parsed.web.redirect_uris || [],
				projectId: parsed.web.project_id,
			};
		}

		// Check for "installed" type (Desktop/Native application)
		if (parsed.installed) {
			return {
				valid: true,
				type: "installed",
				clientId: parsed.installed.client_id,
				clientSecret: parsed.installed.client_secret,
				redirectUris: parsed.installed.redirect_uris || [],
				projectId: parsed.installed.project_id,
			};
		}

		// Direct format (just client_id and client_secret at root)
		if (parsed.client_id) {
			return {
				valid: true,
				type: "direct",
				clientId: parsed.client_id,
				clientSecret: parsed.client_secret || "",
				redirectUris: parsed.redirect_uris || [],
				projectId: parsed.project_id,
			};
		}

		return {
			valid: false,
			error: "Unrecognized credential format. Expected 'web', 'installed', or direct client_id.",
		};
	} catch (error) {
		return {
			valid: false,
			error: `Invalid JSON: ${error.message}`,
		};
	}
}

/**
 * Validate OAuth redirect URIs against expected patterns
 * @param {Array<string>} uris - Redirect URIs from credentials
 * @returns {Object} Validation result
 */
export function validateRedirectUris(uris) {
	const browser = detectBrowser();
	const expectedPatterns = {
		chrome: /^https:\/\/[a-z]+\.chromiumapp\.org/i,
		firefox: /^https:\/\/[a-f0-9]+\.extensions\.allizom\.org/i,
		edge: /^https:\/\/[a-z]+\.chromiumapp\.org/i,
		web: /^https:\/\/ranobe\.vkrishna04\.me/i,
	};

	const results = {
		browser,
		valid: false,
		matchingUri: null,
		warnings: [],
		uris: uris || [],
	};

	if (!uris || uris.length === 0) {
		results.warnings.push("No redirect URIs configured in credentials");
		return results;
	}

	// Check for matching URI
	for (const uri of uris) {
		if (browser === "chrome" || browser === "edge") {
			if (expectedPatterns.chrome.test(uri)) {
				results.valid = true;
				results.matchingUri = uri;
				break;
			}
		} else if (browser === "firefox") {
			if (expectedPatterns.firefox.test(uri)) {
				results.valid = true;
				results.matchingUri = uri;
				break;
			}
		}

		// Also accept web redirect for all browsers
		if (expectedPatterns.web.test(uri)) {
			results.valid = true;
			results.matchingUri = uri;
			results.warnings.push(
				"Using web redirect URI. Extension-native redirect may be faster.",
			);
		}
	}

	if (!results.valid) {
		results.warnings.push(
			`No redirect URI matches expected pattern for ${browser}. ` +
				`Expected pattern: ${expectedPatterns[browser] || expectedPatterns.chrome}`,
		);
	}

	return results;
}

/**
 * Detect current browser
 */
function detectBrowser() {
	if (typeof browser !== "undefined" && browser.runtime?.getBrowserInfo) {
		return "firefox";
	}
	if (navigator.userAgent.includes("Edg/")) {
		return "edge";
	}
	if (navigator.userAgent.includes("Chrome")) {
		return "chrome";
	}
	return "unknown";
}

/**
 * Export backup as downloadable file
 * @param {Object} backup - Backup data
 * @param {string} filename - Optional filename
 */
export function downloadBackupAsFile(backup, filename = null) {
	const name =
		filename ||
		`ranobe-gemini-backup-${new Date().toISOString().split("T")[0]}.json`;

	const blob = new Blob([JSON.stringify(backup, null, 2)], {
		type: "application/json",
	});

	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	a.click();

	URL.revokeObjectURL(url);
	debugLog("✓ Backup downloaded:", name);
}

/**
 * Read backup from uploaded file
 * @param {File} file - File object
 * @returns {Promise<Object>} Parsed backup data
 */
export async function readBackupFromFile(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const data = JSON.parse(e.target.result);
				resolve(data);
			} catch (error) {
				reject(new Error(`Invalid JSON file: ${error.message}`));
			}
		};
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsText(file);
	});
}
