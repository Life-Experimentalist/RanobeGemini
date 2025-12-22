/**
 * Library Backup Manager for Ranobe Gemini
 * Handles automatic and manual backups of library data with rotation
 * Supports smart merging of backup data with current library
 */

import { debugLog, debugError } from "./logger.js";

const BACKUP_CONFIG_KEY = "rg_backup_config";
const BACKUP_METADATA_KEY = "rg_backup_metadata";
const MAX_BACKUPS = 3;
const BACKUP_FILE_PREFIX = "ranobe-gemini-backup-";

export class LibraryBackupManager {
	constructor() {
		this.maxBackups = MAX_BACKUPS;
		this.backupPrefix = BACKUP_FILE_PREFIX;
	}

	/**
	 * Initialize backup configuration
	 * @returns {Promise<Object>} Backup config
	 */
	async initializeConfig() {
		try {
			const result = await browser.storage.local.get(BACKUP_CONFIG_KEY);
			if (result[BACKUP_CONFIG_KEY]) {
				return result[BACKUP_CONFIG_KEY];
			}

			const config = {
				autoBackupEnabled: false,
				backupLocation: null, // Will be set by user
				lastAutoBackup: null,
				mergeMode: "merge", // merge, replace, append
			};

			await browser.storage.local.set({
				[BACKUP_CONFIG_KEY]: config,
			});

			return config;
		} catch (error) {
			debugError("Failed to initialize backup config:", error);
			throw error;
		}
	}

	/**
	 * Get current backup configuration
	 * @returns {Promise<Object>} Current config
	 */
	async getConfig() {
		try {
			const result = await browser.storage.local.get(BACKUP_CONFIG_KEY);
			return result[BACKUP_CONFIG_KEY] || (await this.initializeConfig());
		} catch (error) {
			debugError("Failed to get backup config:", error);
			return null;
		}
	}

	/**
	 * Update backup configuration
	 * @param {Object} updates - Config updates
	 * @returns {Promise<boolean>} Success status
	 */
	async updateConfig(updates) {
		try {
			const config = await this.getConfig();
			const newConfig = { ...config, ...updates };

			await browser.storage.local.set({
				[BACKUP_CONFIG_KEY]: newConfig,
			});

			debugLog("Backup config updated:", newConfig);
			return true;
		} catch (error) {
			debugError("Failed to update backup config:", error);
			return false;
		}
	}

	/**
	 * Create a backup of library data
	 * Automatically rotates old backups if max is reached
	 * @param {Object} libraryData - Novel library data to backup
	 * @param {boolean} isAutomatic - Whether this is an automatic backup
	 * @returns {Promise<Object>} Backup metadata or null on failure
	 */
	async createBackup(libraryData, isAutomatic = false) {
		try {
			const timestamp = Date.now();
			const backupId = `${this.backupPrefix}${timestamp}`;
			const dateStr = new Date(timestamp).toLocaleString();

			const backupData = {
				id: backupId,
				timestamp,
				dateStr,
				isAutomatic,
				size: JSON.stringify(libraryData).length,
				novelCount: Object.keys(libraryData || {}).length,
				data: libraryData,
				version: "1.0",
			};

			// Store in local storage
			await browser.storage.local.set({
				[backupId]: backupData,
			});

			// Update metadata
			await this._updateBackupMetadata(backupId, backupData);

			// Rotate backups if necessary
			if (isAutomatic) {
				await this._rotateBackups();
			}

			debugLog("✓ Backup created:", backupId);
			return {
				id: backupId,
				timestamp,
				dateStr,
				isAutomatic,
				novelCount: backupData.novelCount,
				size: backupData.size,
			};
		} catch (error) {
			debugError("Failed to create backup:", error);
			return null;
		}
	}

	/**
	 * Get list of all backups
	 * @returns {Promise<Array>} Array of backup metadata objects
	 */
	async listBackups() {
		try {
			const result = await browser.storage.local.get(BACKUP_METADATA_KEY);
			const metadata = result[BACKUP_METADATA_KEY] || {};
			const backups = Object.values(metadata).sort(
				(a, b) => b.timestamp - a.timestamp
			);

			debugLog(`Found ${backups.length} backups`);
			return backups;
		} catch (error) {
			debugError("Failed to list backups:", error);
			return [];
		}
	}

	/**
	 * Restore a backup
	 * @param {string} backupId - ID of backup to restore
	 * @param {string} mergeMode - How to merge: "merge", "replace", "append"
	 * @returns {Promise<Object>} Restored data or null on failure
	 */
	async restoreBackup(backupId, mergeMode = "merge") {
		try {
			// Get backup data
			const result = await browser.storage.local.get(backupId);
			if (!result[backupId]) {
				throw new Error(`Backup not found: ${backupId}`);
			}

			const backupData = result[backupId];

			// Get current library data
			let currentData = {};
			const currentResult = await browser.storage.local.get(
				"novelHistory"
			);
			if (currentResult.novelHistory) {
				currentData = currentResult.novelHistory;
			}

			// Merge data based on mode
			let mergedData;
			if (mergeMode === "replace") {
				mergedData = backupData.data || {};
			} else if (mergeMode === "append") {
				mergedData = this._appendMerge(currentData, backupData.data);
			} else {
				// smart merge (default)
				mergedData = this._smartMerge(currentData, backupData.data);
			}

			debugLog(`✓ Backup restored with ${mergeMode} mode:`, backupId);
			return mergedData;
		} catch (error) {
			debugError("Failed to restore backup:", error);
			return null;
		}
	}

	/**
	 * Delete a backup
	 * @param {string} backupId - ID of backup to delete
	 * @returns {Promise<boolean>} Success status
	 */
	async deleteBackup(backupId) {
		try {
			await browser.storage.local.remove(backupId);

			// Remove from metadata
			const result = await browser.storage.local.get(BACKUP_METADATA_KEY);
			const metadata = result[BACKUP_METADATA_KEY] || {};
			delete metadata[backupId];

			await browser.storage.local.set({
				[BACKUP_METADATA_KEY]: metadata,
			});

			debugLog("✓ Backup deleted:", backupId);
			return true;
		} catch (error) {
			debugError("Failed to delete backup:", error);
			return false;
		}
	}

	/**
	 * Export backup to file (for manual download)
	 * @param {string} backupId - ID of backup to export
	 * @returns {Promise<Object>} File content and metadata
	 */
	async exportBackupToFile(backupId) {
		try {
			const result = await browser.storage.local.get(backupId);
			if (!result[backupId]) {
				throw new Error(`Backup not found: ${backupId}`);
			}

			const backupData = result[backupId];
			const fileName = `${this.backupPrefix}${backupData.timestamp}.json`;

			const fileContent = {
				version: "1.0",
				exported: new Date().toISOString(),
				backup: backupData,
			};

			debugLog("✓ Backup exported for download:", fileName);
			return {
				filename: fileName,
				content: JSON.stringify(fileContent, null, 2),
				mimeType: "application/json",
			};
		} catch (error) {
			debugError("Failed to export backup:", error);
			return null;
		}
	}

	/**
	 * Import backup from file
	 * @param {Object} fileContent - Parsed JSON file content
	 * @param {string} mergeMode - How to merge: "merge", "replace", "append"
	 * @returns {Promise<boolean>} Success status
	 */
	async importBackupFromFile(fileContent, mergeMode = "merge") {
		try {
			if (!fileContent.backup || !fileContent.backup.data) {
				throw new Error("Invalid backup file format");
			}

			const backupData = fileContent.backup;

			// Create backup entry for history
			const backupId = `${this.backupPrefix}${Date.now()}-imported`;
			await browser.storage.local.set({
				[backupId]: backupData,
			});

			await this._updateBackupMetadata(backupId, backupData);

			debugLog("✓ Backup imported from file:", backupId);
			return true;
		} catch (error) {
			debugError("Failed to import backup from file:", error);
			return false;
		}
	}

	/**
	 * Smart merge algorithm: combines two library datasets intelligently
	 * - Keeps newer entries (based on lastAccessedAt or addedAt)
	 * - Combines reading histories
	 * - Preserves user-edited fields
	 * @private
	 */
	_smartMerge(current, backup) {
		const merged = { ...current };

		Object.entries(backup || {}).forEach(([novelId, backupNovel]) => {
			if (!merged[novelId]) {
				// Novel not in current, add it
				merged[novelId] = backupNovel;
			} else {
				const currentNovel = merged[novelId];

				// Keep the more recently accessed version
				const currentLastAccess =
					currentNovel.lastAccessedAt || currentNovel.addedAt || 0;
				const backupLastAccess =
					backupNovel.lastAccessedAt || backupNovel.addedAt || 0;

				if (backupLastAccess > currentLastAccess) {
					// Backup is newer, but preserve user edits from current
					merged[novelId] = {
						...backupNovel,
						editedFields:
							currentNovel.editedFields ||
							backupNovel.editedFields,
					};
				}

				// Merge enhanced chapters count (take maximum)
				if (
					backupNovel.enhancedChaptersCount >
					(currentNovel.enhancedChaptersCount || 0)
				) {
					merged[novelId].enhancedChaptersCount =
						backupNovel.enhancedChaptersCount;
				}

				// Merge tags and genres (union)
				if (
					backupNovel.tags &&
					currentNovel.tags &&
					Array.isArray(backupNovel.tags) &&
					Array.isArray(currentNovel.tags)
				) {
					const tagSet = new Set([
						...currentNovel.tags,
						...backupNovel.tags,
					]);
					merged[novelId].tags = Array.from(tagSet);
				}
			}
		});

		return merged;
	}

	/**
	 * Append merge: only adds new novels from backup
	 * @private
	 */
	_appendMerge(current, backup) {
		const merged = { ...current };

		Object.entries(backup || {}).forEach(([novelId, backupNovel]) => {
			if (!merged[novelId]) {
				merged[novelId] = backupNovel;
			}
		});

		return merged;
	}

	/**
	 * Update backup metadata
	 * @private
	 */
	async _updateBackupMetadata(backupId, backupData) {
		try {
			const result = await browser.storage.local.get(BACKUP_METADATA_KEY);
			const metadata = result[BACKUP_METADATA_KEY] || {};

			metadata[backupId] = {
				id: backupId,
				timestamp: backupData.timestamp,
				dateStr: backupData.dateStr,
				isAutomatic: backupData.isAutomatic,
				novelCount: backupData.novelCount,
				size: backupData.size,
			};

			await browser.storage.local.set({
				[BACKUP_METADATA_KEY]: metadata,
			});
		} catch (error) {
			debugError("Failed to update backup metadata:", error);
		}
	}

	/**
	 * Rotate backups: keep only the latest MAX_BACKUPS
	 * Removes oldest automatic backups first
	 * @private
	 */
	async _rotateBackups() {
		try {
			const backups = await this.listBackups();

			if (backups.length > this.maxBackups) {
				// Sort: automatic backups first (to delete old ones), then by timestamp desc
				const sortedBackups = backups.sort((a, b) => {
					// Automatic backups come first
					if (a.isAutomatic !== b.isAutomatic) {
						return a.isAutomatic ? -1 : 1;
					}
					// Then by timestamp descending (newer first)
					return b.timestamp - a.timestamp;
				});

				// Delete oldest backups
				const toDelete = sortedBackups.slice(this.maxBackups);
				for (const backup of toDelete) {
					await this.deleteBackup(backup.id);
					debugLog("Rotated backup (deleted):", backup.id);
				}
			}
		} catch (error) {
			debugError("Failed to rotate backups:", error);
		}
	}

	/**
	 * Check if auto-backup is needed
	 * @returns {Promise<boolean>} True if backup should be created
	 */
	async shouldAutoBackup() {
		try {
			const config = await this.getConfig();
			if (!config.autoBackupEnabled) {
				return false;
			}

			const now = Date.now();
			const lastBackup = config.lastAutoBackup || 0;
			const oneDayMs = 24 * 60 * 60 * 1000;

			return now - lastBackup > oneDayMs;
		} catch (error) {
			debugError("Failed to check auto-backup:", error);
			return false;
		}
	}

	/**
	 * Get backup storage usage
	 * @returns {Promise<Object>} Storage stats
	 */
	async getStorageStats() {
		try {
			const backups = await this.listBackups();
			const totalSize = backups.reduce(
				(sum, b) => sum + (b.size || 0),
				0
			);
			const totalNovels = backups.reduce(
				(sum, b) => sum + (b.novelCount || 0),
				0
			);

			return {
				backupCount: backups.length,
				totalSize,
				totalNovels,
				maxBackups: this.maxBackups,
				isFull: backups.length >= this.maxBackups,
			};
		} catch (error) {
			debugError("Failed to get storage stats:", error);
			return null;
		}
	}
}

export const libraryBackupManager = new LibraryBackupManager();
