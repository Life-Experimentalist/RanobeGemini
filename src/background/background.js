// Background script for Ranobe Gemini
import { debugLog, debugError } from "../utils/logger.js";
import {
	DEFAULT_PROMPT,
	DEFAULT_MODEL_ENDPOINT,
	DEFAULT_PERMANENT_PROMPT,
	DEFAULT_SUMMARY_PROMPT,
	DEFAULT_SHORT_SUMMARY_PROMPT,
	KEEP_ALIVE_ALARM_INTERVAL_MINUTES,
	NOVEL_CHAPTER_CHECK_ALARM_NAME,
} from "../utils/constants.js";
import chunkingSystem from "../utils/chunking/index.js";
import {
	ensureDriveAccessToken,
	revokeDriveTokens,
	uploadLogsToDriveWithAdapter,
	uploadLibraryBackupToDrive,
	listDriveBackups,
	downloadDriveBackup,
	getContinuousDriveBackup,
	getLatestDriveBackup,
} from "../utils/drive.js";
import {
	createRollingBackup,
	listRollingBackups,
} from "../utils/comprehensive-backup.js";
import { novelLibrary } from "../utils/novel-library.js";
import { notificationManager } from "../utils/notification-manager.js";
import {
	initializeTelemetry,
	sendTelemetryPing,
	trackInstall,
} from "../utils/telemetry.js";
import { processMessage } from "./message-handlers/index.js";
import {
	setupNovelUpdateAlarm,
	handleNovelUpdateAlarm,
} from "./novel-updater.js";

// Browser API compatibility shim - Chrome uses 'chrome', Firefox uses 'browser'
// This must be at the very top before any other code
if (typeof browser === "undefined") {
	globalThis.browser = chrome;
}

// Wrap in async IIFE to allow top-level await in service workers
(async () => {
	// Ensure browser API is available within the IIFE scope
	const browser =
		typeof globalThis.browser !== "undefined" ? globalThis.browser : chrome;

	const api = typeof browser !== "undefined" ? browser : chrome;

	debugLog("Ranobe Gemini: Background script loaded");

	const updateNotificationBadge = () => {
		try {
			const stats = notificationManager.getStats();
			const unread = stats?.unread || 0;
			const badgeText = unread > 999 ? "999+" : `${unread}`;
			const actionApi = api.action || api.browserAction;
			if (actionApi?.setBadgeText) {
				actionApi.setBadgeText({ text: unread > 0 ? badgeText : "" });
				if (actionApi.setBadgeBackgroundColor) {
					actionApi.setBadgeBackgroundColor({ color: "#ef4444" });
				}
			}
		} catch (_err) {
			// ignore badge update failures
		}
	};

	notificationManager
		.initialize()
		.then(updateNotificationBadge)
		.catch(() => {});

	// ============================================================
	// CROSS-BROWSER KEEP-ALIVE MECHANISM (MV3)
	// ============================================================
	// Chrome MV3: Service workers sleep after ~30 seconds of inactivity
	// Firefox MV3: Uses event pages which are more persistent but can still unload
	// This mechanism works for both browsers to ensure responsiveness

	const KEEP_ALIVE_ALARM_NAME = "ranobe-gemini-keep-alive";
	const DEFAULT_KEEP_ALIVE_INTERVAL_MINUTES =
		KEEP_ALIVE_ALARM_INTERVAL_MINUTES || 0.5; // 30 seconds
	const AUTO_BACKUP_ALARM_NAME = "ranobe-gemini-auto-backup";
	const ROLLING_BACKUP_ALARM_NAME = "ranobe-gemini-rolling-backup";
	const DRIVE_SYNC_ALARM_NAME = "ranobe-gemini-drive-sync";
	const DEFAULT_BACKUP_RETENTION = 3;
	const DEFAULT_BACKUP_FOLDER = "RanobeGeminiBackups";
	const CONTINUOUS_BACKUP_CHECK_DEFAULT_INTERVAL_MINUTES = 2;
	const DEFAULT_ROLLING_BACKUP_INTERVAL_MINUTES = 60;
	const DEFAULT_DRIVE_SYNC_INTERVAL_MINUTES = 10;
	const KEEP_ALIVE_PORT_NAME = "rg-keepalive";

	// Detect browser type
	const isFirefox =
		typeof browser !== "undefined" &&
		browser.runtime?.getBrowserInfo !== undefined;
	const isChrome = !isFirefox && typeof chrome !== "undefined";

	// Set up the keep-alive alarm (works in both Chrome and Firefox)
	async function setupKeepAliveAlarm() {
		try {
			const api = typeof browser !== "undefined" ? browser : chrome;

			// Check if alarms API is available
			if (!api.alarms) {
				console.warn(
					"Alarms API not available, using setInterval fallback only",
				);
				return false;
			}

			// Get user-configured interval from storage
			const data = await api.storage.local.get(
				"keepAliveIntervalMinutes",
			);
			let intervalMinutes =
				data.keepAliveIntervalMinutes ||
				DEFAULT_KEEP_ALIVE_INTERVAL_MINUTES;

			// Chrome enforces minimum of 1 minute for alarms
			// Firefox allows shorter intervals
			if (isChrome) {
				intervalMinutes = Math.max(1, intervalMinutes);
			} else {
				// Firefox: can use shorter intervals, minimum 0.5 minutes (30 seconds)
				intervalMinutes = Math.max(0.5, intervalMinutes);
			}

			// Clear any existing alarm first
			try {
				await api.alarms.clear(KEEP_ALIVE_ALARM_NAME);
			} catch (e) {
				// Ignore errors when clearing non-existent alarms
			}

			// Create a new periodic alarm
			await api.alarms.create(KEEP_ALIVE_ALARM_NAME, {
				periodInMinutes: intervalMinutes,
			});

			debugLog(
				`[Keep-Alive] Alarm set with interval: ${intervalMinutes} minutes (${
					isFirefox ? "Firefox" : "Chrome"
				})`,
			);
			return true;
		} catch (error) {
			debugError("Error setting up keep-alive alarm:", error);
			return false;
		}
	}

	// Handle alarm events (cross-browser)
	const alarmApi =
		typeof browser !== "undefined" ? browser.alarms : chrome?.alarms;
	if (alarmApi?.onAlarm) {
		alarmApi.onAlarm.addListener((alarm) => {
			if (alarm.name === KEEP_ALIVE_ALARM_NAME) {
				// Simple heartbeat - just log to keep the background script alive
				debugLog(
					`[Keep-Alive] Background script heartbeat at ${new Date().toISOString()}`,
				);
			} else if (alarm.name === AUTO_BACKUP_ALARM_NAME) {
				performAutoBackup().catch((err) =>
					debugError("Auto-backup failed:", err),
				);
			} else if (alarm.name === ROLLING_BACKUP_ALARM_NAME) {
				createRollingBackup("scheduled").catch((err) =>
					debugError("Rolling backup failed:", err),
				);
			} else if (alarm.name === DRIVE_SYNC_ALARM_NAME) {
				syncLibraryFromDrive({ reason: "scheduled" }).catch((err) =>
					debugError("Drive sync failed:", err),
				);
			} else if (alarm.name === NOVEL_CHAPTER_CHECK_ALARM_NAME) {
				handleNovelUpdateAlarm().catch((err) =>
					debugError("[NovelUpdater] Alarm handler failed:", err),
				);
			}
		});
	}

	// Initialize the keep-alive system
	setupKeepAliveAlarm();
	// Initialize periodic novel chapter-check alarm
	setupNovelUpdateAlarm(alarmApi);

	// Port-based keep-alive for MV3: content scripts open a long-lived port and ping periodically.
	browser.runtime.onConnect.addListener((port) => {
		if (port.name !== KEEP_ALIVE_PORT_NAME) return;
		port.onMessage.addListener((msg) => {
			if (msg?.type === "ping") {
				port.postMessage({ type: "pong", ts: Date.now() });
			}
		});
	});

	// Service worker events (Chrome only - Firefox uses event pages)
	if (isChrome && typeof self !== "undefined" && self.addEventListener) {
		self.addEventListener("install", () => {
			debugLog("Service worker installed");
			self.skipWaiting?.();
		});

		self.addEventListener("activate", (event) => {
			debugLog("Service worker activated");
			event.waitUntil(self.clients?.claim?.());
			setupKeepAliveAlarm();
		});
	}

	// Firefox event page: use runtime.onStartup and runtime.onInstalled
	if (isFirefox) {
		browser.runtime.onStartup?.addListener(() => {
			debugLog("Firefox: Extension started");
			setupKeepAliveAlarm();
			scheduleRollingBackupAlarm();
			ensureInitialRollingBackup();
			// Send startup telemetry
			initializeTelemetry().then(() => sendTelemetryPing("startup"));
		});

		browser.runtime.onInstalled?.addListener((details) => {
			debugLog("Firefox: Extension installed/updated");
			setupKeepAliveAlarm();
			browser.storage.local
				.get([
					"rg_rolling_backup_enabled",
					"rollingBackupIntervalMinutes",
				])
				.then((prefs) => {
					const updates = {};
					if (prefs.rg_rolling_backup_enabled === undefined) {
						updates.rg_rolling_backup_enabled = true;
					}
					if (prefs.rollingBackupIntervalMinutes === undefined) {
						updates.rollingBackupIntervalMinutes =
							DEFAULT_ROLLING_BACKUP_INTERVAL_MINUTES;
					}
					if (Object.keys(updates).length > 0) {
						return browser.storage.local.set(updates);
					}
					return null;
				})
				.finally(() => {
					scheduleRollingBackupAlarm();
					ensureInitialRollingBackup();
				});
			// Track install/update
			initializeTelemetry().then(() => {
				if (details?.reason === "install") {
					trackInstall(false);
				} else if (details?.reason === "update") {
					trackInstall(true);
				}
			});
		});
	} else {
		// Chromium browsers
		browser.runtime.onInstalled?.addListener((details) => {
			debugLog("Chromium: Extension installed/updated");
			setupKeepAliveAlarm();
			browser.storage.local
				.get([
					"rg_rolling_backup_enabled",
					"rollingBackupIntervalMinutes",
				])
				.then((prefs) => {
					const updates = {};
					if (prefs.rg_rolling_backup_enabled === undefined) {
						updates.rg_rolling_backup_enabled = true;
					}
					if (prefs.rollingBackupIntervalMinutes === undefined) {
						updates.rollingBackupIntervalMinutes =
							DEFAULT_ROLLING_BACKUP_INTERVAL_MINUTES;
					}
					if (Object.keys(updates).length > 0) {
						return browser.storage.local.set(updates);
					}
					return null;
				})
				.finally(() => {
					scheduleRollingBackupAlarm();
					ensureInitialRollingBackup();
				});
			// Track install/update
			initializeTelemetry().then(() => {
				if (details?.reason === "install") {
					trackInstall(false);
				} else if (details?.reason === "update") {
					trackInstall(true);
				}
			});
		});
	}

	// ============================================================
	// END KEEP-ALIVE MECHANISM
	// ============================================================

	// ============================================================
	// BACKUP UTILITIES
	// ============================================================
	async function createBackupFile({
		folder = DEFAULT_BACKUP_FOLDER,
		saveAs = false,
		retention = DEFAULT_BACKUP_RETENTION,
	}) {
		const downloadsApi = browser.downloads || chrome?.downloads;
		if (!downloadsApi) {
			throw new Error("Downloads API not available");
		}

		const data = await novelLibrary.exportLibrary();
		const timestamp = new Date()
			.toISOString()
			.replace(/[:T]/g, "-")
			.replace(/\..+/, "");
		const filenameOnly = `rg-backup-${timestamp}.json`;
		const filename = folder ? `${folder}/${filenameOnly}` : filenameOnly;

		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);

		const downloadId = await downloadsApi.download({
			url,
			filename,
			saveAs,
		});

		// Clean up object URL after a short delay
		setTimeout(() => URL.revokeObjectURL(url), 30000);

		// Update history and persist
		const stored = await browser.storage.local.get("backupHistory");
		const history = [
			{
				filename,
				createdAt: Date.now(),
				exportedAt: data.exportedAt || Date.now(),
				downloadId,
			},
			...(stored.backupHistory || []),
		].slice(0, retention || DEFAULT_BACKUP_RETENTION);

		await browser.storage.local.set({
			backupHistory: history,
			lastBackupAt: Date.now(),
			backupFolder: folder,
		});

		return { downloadId, filename, history };
	}

	async function uploadLibraryBackupToDriveWithHistory({
		folderId,
		reason = "scheduled",
		variant = "versioned",
	}) {
		const data = await novelLibrary.exportLibrary();
		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		});

		const uploadResult = await uploadLibraryBackupToDrive(blob, {
			folderId,
			variant: variant === "continuous" ? "continuous" : "versioned",
		});

		const filename = uploadResult.name;

		// Track history for visibility
		const stored = await browser.storage.local.get("backupHistory");
		const history = [
			{
				filename,
				createdAt: Date.now(),
				uploadedToDrive: true,
				reason,
				fileId: uploadResult.id,
				webViewLink: uploadResult?.webViewLink,
				variant,
			},
			...(stored.backupHistory || []),
		].slice(0, 50); // keep last 50 backup history entries for UI

		await browser.storage.local.set({
			backupHistory: history,
			lastBackupAt: Date.now(),
		});

		return { filename, history, uploadResult };
	}

	async function performAutoBackup() {
		const prefs = await browser.storage.local.get([
			"autoBackupEnabled",
			"backupFolder",
			"backupRetention",
			"backupMode",
			"driveFolderId",
		]);
		const driveTokens = await browser.storage.local.get("driveAuthTokens");
		const driveConnected = !!driveTokens.driveAuthTokens?.access_token;

		if (!prefs.autoBackupEnabled && !driveConnected) {
			return { success: false, skipped: true, reason: "disabled" };
		}

		const mode = prefs.backupMode || "scheduled";
		if (mode !== "scheduled" && mode !== "both") {
			return { success: false, skipped: true, reason: "mode" };
		}

		const retention = prefs.backupRetention || DEFAULT_BACKUP_RETENTION;
		const folder = prefs.backupFolder || DEFAULT_BACKUP_FOLDER;

		try {
			// Prefer Drive if available, fall back to downloads
			try {
				const driveResult = await uploadLibraryBackupToDriveWithHistory(
					{
						folderId: prefs.driveFolderId,
						reason: "scheduled",
						variant: "versioned",
					},
				);
				debugLog(
					"Auto-backup uploaded to Drive:",
					driveResult.filename,
				);
				return { success: true, ...driveResult, target: "drive" };
			} catch (driveErr) {
				debugError(
					"Drive auto-backup failed, falling back to file:",
					driveErr,
				);
			}

			if (!prefs.autoBackupEnabled) {
				return {
					success: false,
					skipped: true,
					reason: "drive-only",
				};
			}

			const result = await createBackupFile({
				folder,
				saveAs: false,
				retention,
			});
			debugLog("Auto-backup created:", result.filename);
			return { success: true, ...result, target: "file" };
		} catch (error) {
			debugError("Auto-backup failed:", error);
			return { success: false, error: error.message };
		}
	}

	async function syncLibraryFromDrive({
		force = false,
		reason = "auto",
	} = {}) {
		// Check if OAuth credentials are configured before attempting sync
		const oauthPrefs = await browser.storage.local.get([
			"driveClientId",
			"driveClientSecret",
		]);

		if (!oauthPrefs.driveClientId || !oauthPrefs.driveClientSecret) {
			// OAuth not configured - skip silently (no error logging)
			return {
				success: false,
				skipped: true,
				reason: "oauth-not-configured",
			};
		}

		const prefs = await browser.storage.local.get([
			"driveAutoRestoreEnabled",
			"driveAutoRestoreMergeMode",
			"backupMode",
		]);

		if (!prefs.driveAutoRestoreEnabled && !force) {
			return { success: false, skipped: true, reason: "disabled" };
		}

		const backupMode = prefs.backupMode || "scheduled";
		const mergeMode = prefs.driveAutoRestoreMergeMode || "merge";
		const shouldMerge = mergeMode !== "replace";

		const latestFile =
			backupMode === "continuous" || backupMode === "both"
				? await getContinuousDriveBackup()
				: await getLatestDriveBackup();

		if (!latestFile?.id) {
			return { success: false, skipped: true, reason: "no-backup" };
		}

		const syncState = await browser.storage.local.get("driveLastSync");
		const lastSync = syncState.driveLastSync || {};

		if (
			!force &&
			lastSync.fileId === latestFile.id &&
			lastSync.modifiedTime === latestFile.modifiedTime
		) {
			return { success: false, skipped: true, reason: "up-to-date" };
		}

		const backupData = await downloadDriveBackup(latestFile.id);
		if (!backupData?.library || !backupData?.version) {
			return { success: false, skipped: true, reason: "invalid-backup" };
		}

		const importResult = await novelLibrary.importLibrary(
			backupData,
			shouldMerge,
		);

		await browser.storage.local.set({
			driveLastSync: {
				fileId: latestFile.id,
				modifiedTime: latestFile.modifiedTime,
				name: latestFile.name,
				reason,
				mergeMode,
				importedAt: Date.now(),
			},
		});

		return { success: true, file: latestFile, result: importResult };
	}

	let continuousBackupCheckTimer = null;
	let lastLibraryHash = null;

	// Calculate hash of current library state
	async function getLibraryHash() {
		try {
			const library = await novelLibrary.getLibrary();
			// Create a simple hash by JSON stringifying and counting changes
			const libraryJson = JSON.stringify(library);
			// Use a simple hash function for comparison
			let hash = 0;
			for (let i = 0; i < libraryJson.length; i++) {
				const char = libraryJson.charCodeAt(i);
				hash = (hash << 5) - hash + char;
				hash = hash & hash; // Convert to 32-bit integer
			}
			return hash.toString(16);
		} catch (err) {
			debugError("Failed to calculate library hash:", err);
			return null;
		}
	}

	// Check if library has changed since last check
	async function hasLibraryChanged() {
		try {
			const currentHash = await getLibraryHash();
			if (currentHash === null) return false;

			if (lastLibraryHash === null) {
				// First run, store the hash
				lastLibraryHash = currentHash;
				return false;
			}

			const changed = lastLibraryHash !== currentHash;
			if (changed) {
				lastLibraryHash = currentHash;
				debugLog("Library change detected");
			}
			return changed;
		} catch (err) {
			debugError("Error checking library changes:", err);
			return false;
		}
	}

	async function scheduleAutoBackup() {
		const prefs = await browser.storage.local.get([
			"autoBackupEnabled",
			"backupIntervalDays",
			"backupMode",
		]);
		const driveTokens = await browser.storage.local.get("driveAuthTokens");
		const driveConnected = !!driveTokens.driveAuthTokens?.access_token;
		const enabled = prefs.autoBackupEnabled || driveConnected;
		const intervalDays = prefs.backupIntervalDays || 1;
		const mode = prefs.backupMode || "scheduled";

		if (!browser.alarms) return false;

		// Clear existing alarm
		try {
			await browser.alarms.clear(AUTO_BACKUP_ALARM_NAME);
		} catch (e) {
			// ignore
		}

		if (!enabled || (mode !== "scheduled" && mode !== "both")) return false;

		await browser.alarms.create(AUTO_BACKUP_ALARM_NAME, {
			periodInMinutes: Math.max(60 * 24 * intervalDays, 60),
		});
		return true;
	}

	async function scheduleRollingBackupAlarm() {
		const prefs = await browser.storage.local.get([
			"rg_rolling_backup_enabled",
			"rollingBackupIntervalMinutes",
		]);
		const enabled = prefs.rg_rolling_backup_enabled ?? true;
		const intervalMinutes =
			prefs.rollingBackupIntervalMinutes ||
			DEFAULT_ROLLING_BACKUP_INTERVAL_MINUTES;

		if (!browser.alarms) return false;

		try {
			await browser.alarms.clear(ROLLING_BACKUP_ALARM_NAME);
		} catch (_e) {
			// ignore
		}

		if (!enabled) return false;

		await browser.alarms.create(ROLLING_BACKUP_ALARM_NAME, {
			periodInMinutes: Math.max(1, intervalMinutes),
		});
		return true;
	}

	async function ensureInitialRollingBackup() {
		try {
			const prefs = await browser.storage.local.get([
				"rg_rolling_backup_enabled",
			]);
			if (prefs.rg_rolling_backup_enabled === false) return false;

			const existing = await listRollingBackups();
			if (existing.length === 0) {
				await createRollingBackup("install");
			}
			return true;
		} catch (error) {
			debugError("Failed to create initial rolling backup:", error);
			return false;
		}
	}

	async function scheduleContinuousBackupCheck() {
		// Clear existing timer
		if (continuousBackupCheckTimer) {
			clearInterval(continuousBackupCheckTimer);
			continuousBackupCheckTimer = null;
		}

		const prefs = await browser.storage.local.get([
			"autoBackupEnabled",
			"backupMode",
			"continuousBackupCheckIntervalMinutes",
			"driveFolderId",
		]);
		const driveTokens = await browser.storage.local.get("driveAuthTokens");
		const driveConnected = !!driveTokens.driveAuthTokens?.access_token;

		if (!prefs.autoBackupEnabled && !driveConnected) return;
		const mode = prefs.backupMode || "scheduled";
		if (mode !== "continuous" && mode !== "both") return;

		// Get the check interval (how often to check for changes)
		const checkIntervalMinutes =
			prefs.continuousBackupCheckIntervalMinutes ||
			CONTINUOUS_BACKUP_CHECK_DEFAULT_INTERVAL_MINUTES;
		const checkIntervalMs = Math.max(1, checkIntervalMinutes) * 60 * 1000;

		// Initialize hash on first run
		if (lastLibraryHash === null) {
			lastLibraryHash = await getLibraryHash();
		}

		// Set up polling interval
		continuousBackupCheckTimer = setInterval(async () => {
			try {
				const changed = await hasLibraryChanged();
				if (changed) {
					debugLog(
						`Continuous backup triggered by library change (check interval: ${checkIntervalMinutes}m)`,
					);
					// Backup immediately on change detection
					await uploadLibraryBackupToDriveWithHistory({
						folderId: prefs.driveFolderId,
						reason: "continuous-change",
						variant: "continuous",
					});
					debugLog("Continuous backup uploaded to Drive");
				}
			} catch (err) {
				debugError("Continuous backup check failed:", err);
			}
		}, checkIntervalMs);

		debugLog(
			`Continuous backup check scheduled every ${checkIntervalMinutes} minutes`,
		);
	}

	async function scheduleDriveSync() {
		if (!browser.alarms) return false;

		try {
			await browser.alarms.clear(DRIVE_SYNC_ALARM_NAME);
		} catch (_err) {
			// ignore
		}

		const prefs = await browser.storage.local.get([
			"driveAutoRestoreEnabled",
			"driveSyncIntervalMinutes",
		]);

		if (!prefs.driveAutoRestoreEnabled) return false;

		const intervalMinutes = Math.max(
			5,
			prefs.driveSyncIntervalMinutes ||
				DEFAULT_DRIVE_SYNC_INTERVAL_MINUTES,
		);

		await browser.alarms.create(DRIVE_SYNC_ALARM_NAME, {
			periodInMinutes: intervalMinutes,
		});

		return true;
	}

	// Kick off scheduling on startup
	scheduleAutoBackup().catch((err) =>
		console.warn("Auto-backup schedule setup failed:", err?.message),
	);
	scheduleRollingBackupAlarm().catch((err) =>
		console.warn("Rolling backup schedule setup failed:", err?.message),
	);
	scheduleContinuousBackupCheck().catch((err) =>
		console.warn(
			"Continuous backup check schedule setup failed:",
			err?.message,
		),
	);
	scheduleDriveSync().catch((err) =>
		console.warn("Drive sync schedule setup failed:", err?.message),
	);
	ensureInitialRollingBackup().catch((err) =>
		console.warn("Initial rolling backup failed:", err?.message),
	);
	setTimeout(() => {
		syncLibraryFromDrive({ reason: "startup" }).catch((err) =>
			debugError("Drive sync on startup failed:", err),
		);
	}, 15000);

	browser.storage.onChanged.addListener((changes, area) => {
		if (area !== "local") return;
		// Watch both old and new library keys for changes
		if (changes.novelHistory || changes.rg_novel_library) {
			scheduleContinuousBackupCheck(); // Fixed: was scheduleContinuousBackup
		}
		if (
			changes.backupMode ||
			changes.autoBackupEnabled ||
			changes.backupIntervalDays ||
			changes.continuousBackupDelayMinutes ||
			changes.continuousBackupCheckIntervalMinutes
		) {
			scheduleAutoBackup();
			scheduleContinuousBackupCheck();
		}

		if (
			changes.rg_rolling_backup_enabled ||
			changes.rollingBackupIntervalMinutes
		) {
			scheduleRollingBackupAlarm();
		}

		if (
			changes.driveAutoRestoreEnabled ||
			changes.driveSyncIntervalMinutes
		) {
			scheduleDriveSync();
		}
	});

	// Global configuration
	let currentConfig = null;

	// Cancellation flag for chunk processing
	let isCancellationRequested = false;

	// Initialize configuration
	async function initConfig() {
		try {
			// Get settings directly from storage
			const data = await browser.storage.local.get();
			return {
				apiKey: data.apiKey || "",
				backupApiKeys: data.backupApiKeys || [], // Array of backup API keys
				apiKeyRotation: data.apiKeyRotation || "failover", // "failover" or "round-robin"
				currentApiKeyIndex: data.currentApiKeyIndex || 0, // Current API key index for round-robin
				defaultPrompt: data.defaultPrompt || DEFAULT_PROMPT,
				summaryPrompt: data.summaryPrompt || DEFAULT_SUMMARY_PROMPT,
				shortSummaryPrompt:
					data.shortSummaryPrompt || DEFAULT_SHORT_SUMMARY_PROMPT,
				permanentPrompt:
					data.permanentPrompt || DEFAULT_PERMANENT_PROMPT,
				temperature: data.temperature || 0.7,
				topP: data.topP !== undefined ? data.topP : 0.95,
				topK: data.topK !== undefined ? data.topK : 40,
				maxOutputTokens: data.maxOutputTokens || 8192,
				debugMode: data.debugMode || false,
				modelEndpoint: data.modelEndpoint || DEFAULT_MODEL_ENDPOINT,
				chunkingEnabled: data.chunkingEnabled !== false,
				chunkSize: data.chunkSize || 20000, // Used for both threshold AND chunk size
				chunkThreshold: data.chunkSize || 20000, // Same as chunkSize (simplified)
				useEmoji: data.useEmoji || false,
				fontSize: data.fontSize || 100, // Font size percentage (default 100%)
			};
		} catch (error) {
			debugError("Error loading configuration:", error);
			return {
				apiKey: "",
				backupApiKeys: [],
				apiKeyRotation: "failover",
				currentApiKeyIndex: 0,
				defaultPrompt:
					"Please fix grammar and improve readability of this text while maintaining original meaning.",
				summaryPrompt: DEFAULT_SUMMARY_PROMPT,
				shortSummaryPrompt:
					DEFAULT_SHORT_SUMMARY_PROMPT ||
					"Provide a brief 2-3 paragraph summary.",
				permanentPrompt: DEFAULT_PERMANENT_PROMPT,
				temperature: 0.7,
				topP: 0.95,
				topK: 40,
				maxOutputTokens: 8192,
				chunkingEnabled: true,
				chunkSize: 20000,
				chunkThreshold: 20000,
				useEmoji: false,
				fontSize: 100,
			};
		}
	}

	// Get the current API key based on rotation strategy
	function getCurrentApiKey(config, forceNext = false) {
		const allKeys = [config.apiKey, ...config.backupApiKeys].filter(
			(k) => k && k.trim(),
		);
		if (allKeys.length === 0) return null;

		if (config.apiKeyRotation === "round-robin") {
			let index = config.currentApiKeyIndex || 0;
			if (forceNext) {
				index = (index + 1) % allKeys.length;
				// Save the new index
				browser.storage.local.set({ currentApiKeyIndex: index });
			}
			return { key: allKeys[index], index, total: allKeys.length };
		} else {
			// Failover mode - try primary first, then backups
			return { key: allKeys[0], index: 0, total: allKeys.length };
		}
	}

	// Get next API key for failover
	async function getNextApiKey(config, currentIndex) {
		const allKeys = [config.apiKey, ...config.backupApiKeys].filter(
			(k) => k && k.trim(),
		);
		const nextIndex = currentIndex + 1;
		if (nextIndex >= allKeys.length) {
			return null; // No more keys available
		}
		return {
			key: allKeys[nextIndex],
			index: nextIndex,
			total: allKeys.length,
		};
	}

	// Make API call with automatic key rotation on rate limit errors
	async function makeApiCallWithRotation(modelEndpoint, requestBody, config) {
		const allKeys = [config.apiKey, ...config.backupApiKeys].filter(
			(k) => k && k.trim(),
		);

		if (allKeys.length === 0) {
			throw new Error(
				"No API keys configured. Please set an API key in the extension popup.",
			);
		}

		let currentKeyInfo = getCurrentApiKey(config);
		let attempts = 0;
		const maxAttempts = allKeys.length;

		while (attempts < maxAttempts) {
			const apiKey = currentKeyInfo.key;
			debugLog(
				`Attempting API call with key ${currentKeyInfo.index + 1}/${
					currentKeyInfo.total
				}`,
			);

			try {
				const response = await fetch(`${modelEndpoint}?key=${apiKey}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				});

				// Parse the response
				const responseData = await response.json();

				// Check for rate limiting
				if (response.status === 429) {
					const retryAfter = response.headers.get("retry-after");
					const waitTime = retryAfter
						? parseInt(retryAfter) * 1000
						: 60000;

					debugLog(
						`Rate limit hit on key ${
							currentKeyInfo.index + 1
						}. Will try next key.`,
					);

					// Try next key
					if (config.apiKeyRotation === "round-robin") {
						currentKeyInfo = getCurrentApiKey(config, true); // Force next key
					} else {
						// Failover mode
						const nextKey = await getNextApiKey(
							config,
							currentKeyInfo.index,
						);
						if (nextKey) {
							currentKeyInfo = nextKey;
						} else {
							// No more keys, throw rate limit error
							throw new Error(
								`Rate limit reached on all ${
									allKeys.length
								} API keys. Please try again in ${Math.ceil(
									waitTime / 1000,
								)} seconds.`,
							);
						}
					}
					attempts++;
					continue;
				}

				// Return both response and data for further processing
				return {
					response,
					responseData,
					keyUsed: currentKeyInfo.index,
				};
			} catch (fetchError) {
				// Network error or other fetch failure
				debugError(
					`API call failed with key ${currentKeyInfo.index + 1}:`,
					fetchError,
				);

				// Try next key for network errors too
				if (config.apiKeyRotation === "round-robin") {
					currentKeyInfo = getCurrentApiKey(config, true);
				} else {
					const nextKey = await getNextApiKey(
						config,
						currentKeyInfo.index,
					);
					if (nextKey) {
						currentKeyInfo = nextKey;
					} else {
						throw fetchError; // Re-throw if no more keys
					}
				}
				attempts++;
			}
		}

		throw new Error(
			`All ${allKeys.length} API keys exhausted. Please check your API keys or try again later.`,
		);
	}

	// Helper function to combine prompts for Gemini
	function combinePrompts(
		mainPrompt,
		permanentPrompt,
		siteSpecificPrompt = "",
	) {
		let combinedPrompt = mainPrompt;

		// Add site-specific prompt if available
		if (siteSpecificPrompt && siteSpecificPrompt.length > 0) {
			combinedPrompt +=
				"\n\n## Site-Specific Context:\n" + siteSpecificPrompt;
		}

		// Add permanent prompt if available
		if (permanentPrompt && permanentPrompt.length > 0) {
			combinedPrompt +=
				"\n\n## Always Follow These Instructions:\n" + permanentPrompt;
		}

		return combinedPrompt;
	}

	// Handle messages from content script
	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
		debugLog("Background received message:", message);

		if (message.action === "ping") {
			sendResponse({
				success: true,
				message: "Background script is alive",
			});
			return true;
		}

		if (message.action === "createLibraryBackup") {
			createBackupFile({
				folder: message.folder,
				saveAs: message.saveAs === true,
				retention: message.retention || DEFAULT_BACKUP_RETENTION,
			})
				.then((result) => sendResponse({ success: true, ...result }))
				.catch((error) =>
					sendResponse({
						success: false,
						error: error.message,
					}),
				);
			return true;
		}

		if (message.action === "uploadLibraryBackupToDrive") {
			(async () => {
				try {
					debugLog("Starting Drive backup upload...");
					debugLog("Backup reason:", message.reason);

					// Ensure we have valid auth before attempting backup
					const tokens =
						await browser.storage.local.get("driveAuthTokens");
					if (!tokens.driveAuthTokens?.access_token) {
						throw new Error(
							"Not authenticated with Google Drive. Please connect Drive first.",
						);
					}
					debugLog("Auth tokens verified for backup");

					const prefs = await browser.storage.local.get("backupMode");
					const mode = prefs.backupMode || "scheduled";

					debugLog("Uploading primary backup...");
					const primary = await uploadLibraryBackupToDriveWithHistory(
						{
							folderId: message.folderId,
							reason: message.reason || "manual",
							variant: message.variant || "versioned",
						},
					);
					debugLog(
						"Primary backup uploaded successfully:",
						primary.filename,
					);

					let rolling = null;
					if (mode === "continuous" || mode === "both") {
						debugLog("Uploading rolling backup...");
						rolling = await uploadLibraryBackupToDriveWithHistory({
							folderId: message.folderId,
							reason: "rolling",
							variant: "continuous",
						});
						debugLog(
							"Rolling backup uploaded successfully:",
							rolling.filename,
						);
					}

					debugLog("Backup complete, sending success response");
					sendResponse({
						success: true,
						primary,
						rolling,
						name: primary?.filename || primary?.name,
					});
				} catch (error) {
					debugError("Backup error:", error);
					sendResponse({
						success: false,
						error: error.message,
					});
				}
			})().catch((error) => {
				debugError("Backup handler error:", error);
				sendResponse({ success: false, error: error.message });
			});
			return true;
		}

		if (message.action === "listDriveBackups") {
			listDriveBackups()
				.then((backups) => sendResponse({ success: true, backups }))
				.catch((error) =>
					sendResponse({
						success: false,
						backups: [],
						error: error.message,
					}),
				);
			return true;
		}

		if (message.action === "downloadDriveBackup") {
			downloadDriveBackup(message.fileId)
				.then((data) => sendResponse({ success: true, data }))
				.catch((error) =>
					sendResponse({
						success: false,
						error: error.message,
					}),
				);
			return true;
		}

		if (message.action === "syncAutoBackups") {
			scheduleAutoBackup()
				.then((scheduled) => {
					scheduleContinuousBackupCheck();
					return sendResponse({ success: true, scheduled });
				})
				.catch((error) =>
					sendResponse({
						success: false,
						error: error.message,
					}),
				);
			return true;
		}

		if (message.action === "syncDriveNow") {
			syncLibraryFromDrive({ force: true, reason: "manual" })
				.then((result) => sendResponse({ success: true, ...result }))
				.catch((error) =>
					sendResponse({ success: false, error: error.message }),
				);
			return true;
		}

		if (message.action === "ensureDriveAuth") {
			ensureDriveAccessToken({ interactive: true })
				.then(() => sendResponse({ success: true }))
				.catch((error) =>
					sendResponse({
						success: false,
						error: error.message,
					}),
				);
			return true;
		}

		if (message.action === "resetDriveAuth") {
			revokeDriveTokens()
				.then(() => sendResponse({ success: true }))
				.catch((error) =>
					sendResponse({
						success: false,
						error: error.message,
					}),
				);
			return true;
		}

		if (message.action === "fetchDesktopMetadata") {
			// Fetch desktop version of mobile page to extract full metadata
			(async () => {
				try {
					const { url, novelId, handler } = message;

					debugLog(
						`[Background] Fetching desktop metadata from: ${url}`,
					);

					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(
							`HTTP ${response.status}: ${response.statusText}`,
						);
					}

					const html = await response.text();
					const parser = new DOMParser();
					const doc = parser.parseFromString(html, "text/html");

					// Extract metadata based on handler type
					let metadata = {};

					if (handler === "fanfiction") {
						// FanFiction.net specific extraction
						const profileTop = doc.querySelector("#profile_top");
						if (profileTop) {
							// Extract description
							const descDiv =
								profileTop.querySelector("div.xcontrast_txt");
							metadata.description = descDiv
								? descDiv.textContent.trim()
								: "";

							// Extract title
							const titleEl =
								profileTop.querySelector("b.xcontrast_txt");
							metadata.title = titleEl
								? titleEl.textContent.trim()
								: "";

							// Extract author
							const authorLink =
								profileTop.querySelector("a[href^='/u/']");
							metadata.author = authorLink
								? authorLink.textContent.trim()
								: "";

							// Extract metadata (rating, language, genre, etc.)
							const grayCenter = profileTop.querySelectorAll(
								"span.xgray.xcontrast_txt",
							);
							if (grayCenter.length > 0) {
								const metaText = grayCenter[0].textContent;
								metadata.metadataText = metaText;

								// Parse rating, language, genres, etc.
								const ratingMatch =
									metaText.match(/Rated:\\s*([^-]+)/);
								if (ratingMatch)
									metadata.rating = ratingMatch[1].trim();

								const languageMatch =
									metaText.match(/([A-Z][a-z]+)\\s*-/);
								if (languageMatch)
									metadata.language = languageMatch[1];
							}

							// Extract stats (chapters, words, reviews, etc.)
							const statsSpan = profileTop.querySelector(
								"span.xgray.xcontrast_txt:last-child",
							);
							if (statsSpan) {
								const statsText = statsSpan.textContent;

								const chaptersMatch =
									statsText.match(/Chapters:\\s*(\\d+)/);
								if (chaptersMatch)
									metadata.chapters = parseInt(
										chaptersMatch[1],
									);

								const wordsMatch =
									statsText.match(/Words:\\s*([\\d,]+)/);
								if (wordsMatch)
									metadata.words = parseInt(
										wordsMatch[1].replace(/,/g, ""),
									);
							}
						}
					}

					// Save metadata to library
					if (Object.keys(metadata).length > 0) {
						const library = await novelLibrary.getLibrary();
						const novel = library[novelId];

						if (novel) {
							// Merge metadata with existing novel data
							const updated = {
								...novel,
								description:
									metadata.description || novel.description,
								author: metadata.author || novel.author,
								rating: metadata.rating || novel.rating,
								language: metadata.language || novel.language,
								totalChapters:
									metadata.chapters || novel.totalChapters,
								wordCount: metadata.words || novel.wordCount,
								metadataFetchedAt: Date.now(),
							};

							await novelLibrary.updateNovel(novelId, updated);
							debugLog(
								`[Background] Updated novel ${novelId} with desktop metadata`,
							);
						}
					}

					sendResponse({ success: true, metadata });
				} catch (error) {
					debugError(
						"[Background] Failed to fetch desktop metadata:",
						error,
					);
					sendResponse({ success: false, error: error.message });
				}
			})();
			return true;
		}

		if (message.action === "uploadLogsToDrive") {
			uploadLogsToDriveWithAdapter({
				filename: message.filename || "ranobe-logs.json",
				folderId: message.folderId,
			})
				.then((result) =>
					sendResponse({
						success: true,
						count: result?.count,
					}),
				)
				.catch((error) =>
					sendResponse({
						success: false,
						error: error.message,
					}),
				);
			return true;
		}

		if (message.action === "logNotification") {
			notificationManager
				.add({
					type: message.type,
					message: message.message,
					title: message.title,
					url: message.url,
					novelData: message.novelData,
					metadata: message.metadata,
					source: message.source || "background",
				})
				.then((id) => {
					updateNotificationBadge();
					sendResponse({ success: true, id });
				})
				.catch((error) =>
					sendResponse({
						success: false,
						error: error.message,
					}),
				);
			return true;
		}

		if (message.action === "getNotifications") {
			notificationManager
				.initialize()
				.then(() => {
					const notifications = notificationManager.getAll({
						type: message.type || null,
						unreadOnly: message.unreadOnly === true,
						limit: message.limit || null,
						grouped: message.grouped === true,
					});
					const stats = notificationManager.getStats();
					sendResponse({
						success: true,
						notifications,
						stats,
					});
				})
				.catch((error) =>
					sendResponse({
						success: false,
						notifications: [],
						stats: null,
						error: error.message,
					}),
				);
			return true;
		}

		if (message.action === "markNotificationRead") {
			notificationManager
				.markAsRead(message.id)
				.then(() => {
					const stats = notificationManager.getStats();
					updateNotificationBadge();
					sendResponse({ success: true, stats });
				})
				.catch((error) =>
					sendResponse({ success: false, error: error.message }),
				);
			return true;
		}

		if (message.action === "markAllNotificationsRead") {
			notificationManager
				.markAllAsRead()
				.then(() => {
					const stats = notificationManager.getStats();
					updateNotificationBadge();
					sendResponse({ success: true, stats });
				})
				.catch((error) =>
					sendResponse({ success: false, error: error.message }),
				);
			return true;
		}

		if (message.action === "deleteNotification") {
			notificationManager
				.delete(message.id)
				.then(() => {
					const stats = notificationManager.getStats();
					updateNotificationBadge();
					sendResponse({ success: true, stats });
				})
				.catch((error) =>
					sendResponse({ success: false, error: error.message }),
				);
			return true;
		}

		if (message.action === "clearNotifications") {
			notificationManager
				.clearAll()
				.then(() => {
					updateNotificationBadge();
					sendResponse({ success: true });
				})
				.catch((error) =>
					sendResponse({ success: false, error: error.message }),
				);
			return true;
		}

		// Handle cancel enhancement request
		if (message.action === "cancelEnhancement") {
			debugLog("Enhancement cancellation requested");
			// Set a flag that can be checked during chunk processing
			isCancellationRequested = true;
			sendResponse({
				success: true,
				message: "Cancellation requested",
			});
			return true;
		}

		if (message.action === "getModelInfo") {
			getModelInfo()
				.then((modelInfo) => {
					sendResponse({
						success: true,
						maxContextSize: modelInfo.maxContextSize,
						maxOutputTokens: modelInfo.maxOutputTokens,
					});
				})
				.catch((error) => {
					debugError("Error getting model info:", error);
					sendResponse({
						success: false,
						error:
							error.message || "Unknown error getting model info",
						// Provide safe defaults
						maxContextSize: 16000,
						maxOutputTokens: 8192,
					});
				});
			return true;
		}

		if (message.action === "processWithGemini") {
			// DEBUG: Log incoming message content
			debugLog(
				`[processWithGemini] Received message. Content length: ${
					message.content?.length || 0
				}`,
			);
			debugLog(
				`[processWithGemini] Content preview (first 200 chars): "${message.content?.substring(
					0,
					200,
				)}"`,
			);

			// CRITICAL: Check if API key exists before attempting to process
			// Load config to check API key and get settings
			initConfig()
				.then(async (config) => {
					// Check if we have any API key (primary or backup)
					const allKeys = [
						config.apiKey,
						...(config.backupApiKeys || []),
					].filter((k) => k && k.trim());

					if (allKeys.length === 0) {
						debugError(
							"[processWithGemini] No API key found. Opening popup for configuration.",
						);
						// Open the popup for user to add API key
						try {
							await browser.action.openPopup();
						} catch (popupError) {
							// If popup fails (e.g., on Android), send notification
							console.warn(
								"Failed to open popup, sending notification instead:",
								popupError,
							);
							await browser.notifications.create({
								type: "basic",
								title: "Ranobe Gemini",
								message:
									"Please configure your API key in the extension settings.",
								iconUrl:
									browser.runtime.getURL("icons/icon.png"),
							});
						}
						// Send error response to content script
						sendResponse({
							success: false,
							error: "API key is missing. Please configure it in the extension popup.",
							needsApiKey: true,
						});
						return;
					}

					// Use chunkSize as both the threshold and chunk size (simplified)
					const chunkSize = config.chunkSize || 20000;
					const forceChunking = message.forceChunking === true;

					// For longer content or when forced, use chunk processing with progressive rendering
					if (
						forceChunking ||
						(message.content && message.content.length > chunkSize)
					) {
						debugLog(
							forceChunking
								? "Chunking forced by content script"
								: `Content length ${message.content.length} exceeds chunk size ${chunkSize}, using chunked processing`,
						);
						processContentInChunks(
							message.title,
							message.content,
							message.useEmoji,
							message.siteSpecificPrompt || "",
							sender.tab?.id,
							forceChunking,
						)
							.then((result) => {
								sendResponse({
									success: true,
									result: result,
								});
							})
							.catch((error) => {
								debugError(
									"Error processing with Gemini in chunks:",
									error,
								);
								sendResponse({
									success: false,
									error:
										error.message ||
										"Unknown error processing with Gemini",
								});
							});
					} else {
						// For shorter content, process as a single piece
						debugLog(
							`Content length ${
								message.content?.length || 0
							} is under chunk size ${chunkSize}, processing as single piece`,
						);
						processContentWithGemini(
							message.title,
							message.content,
							message.isPart,
							message.partInfo,
							message.useEmoji,
							null,
							message.siteSpecificPrompt || "",
						)
							.then((result) => {
								sendResponse({
									success: true,
									result: result,
								});
							})
							.catch((error) => {
								debugError(
									"Error processing with Gemini:",
									error,
								);
								sendResponse({
									success: false,
									error:
										error.message ||
										"Unknown error processing with Gemini",
								});
							});
					}
				})
				.catch((error) => {
					debugError("Error loading config:", error);
					sendResponse({
						success: false,
						error: "Failed to load configuration",
					});
				});
			return true; // Indicates we'll send a response asynchronously
		}

		// Handler for resuming chunk processing after a rate limit pause
		if (message.action === "resumeProcessing") {
			debugLog("Resuming processing from chunk", message.startChunkIndex);

			// Create an array of chunks to process
			const remainingChunks = message.remainingChunks || [];
			const totalChunksRemaining = remainingChunks.length;

			if (totalChunksRemaining === 0) {
				sendResponse({
					success: false,
					error: "No chunks to resume processing",
				});
				return true;
			}

			// Process the remaining chunks sequentially
			(async () => {
				try {
					let results = [];
					let failedChunks = [];

					// Process each remaining chunk
					for (let i = 0; i < totalChunksRemaining; i++) {
						try {
							const chunkIndex = message.startChunkIndex + i;
							debugLog(
								`Resuming chunk ${chunkIndex + 1}/${
									message.totalChunks
								}`,
							);

							// Add delay between chunks to avoid rate limits
							if (i > 0) {
								const delay = 1000; // 1 second delay between resumed chunks
								await new Promise((resolve) =>
									setTimeout(resolve, delay),
								);
							}

							const chunk = remainingChunks[i];
							const partInfo = {
								current: chunkIndex + 1,
								total: message.totalChunks,
							};

							// Process this chunk
							const result = await processContentWithGemini(
								message.title,
								chunk,
								true,
								partInfo,
								message.useEmoji,
							);

							// Store and send the result immediately
							results.push({
								originalContent: chunk,
								enhancedContent: result.enhancedContent,
								chunkIndex: chunkIndex,
								processed: true,
							});

							// Send this chunk result back to content script
							// Must use tabs.sendMessage to reach content scripts
							const resumeTabId = sender.tab?.id;
							if (resumeTabId) {
								browser.tabs
									.sendMessage(resumeTabId, {
										action: "chunkProcessed",
										chunkIndex: chunkIndex,
										totalChunks: message.totalChunks,
										result: {
											originalContent: chunk,
											enhancedContent:
												result.enhancedContent,
										},
										isResumed: true,
										isComplete:
											i === totalChunksRemaining - 1 &&
											failedChunks.length === 0,
									})
									.catch((error) =>
										debugError(
											"Error sending resumed chunk result to tab:",
											error,
										),
									);
							}
						} catch (error) {
							debugError(
								"Error processing resumed chunk:",
								error,
							);

							const chunkIndex = message.startChunkIndex + i;
							// Store information about the failed chunk
							failedChunks.push({
								originalContent: remainingChunks[i],
								chunkIndex: chunkIndex,
								error: error.message || "Unknown error",
								processed: false,
							});

							// Check if this is a rate limit error
							const isRateLimitError =
								error.message &&
								(error.message.includes("rate limit") ||
									error.message.includes("quota") ||
									error.message.includes("429"));

							if (isRateLimitError) {
								debugLog(
									"Rate limit detected during resume. Pausing processing.",
								);

								// Notify about the rate limit
								if (resumeTabId) {
									browser.tabs
										.sendMessage(resumeTabId, {
											action: "chunkError",
											chunkIndex: chunkIndex,
											totalChunks: message.totalChunks,
											error: error.message,
											isRateLimit: true,
											remainingChunks:
												message.totalChunks -
												chunkIndex,
											unprocessedChunks:
												remainingChunks.slice(i),
											isResumed: true,
										})
										.catch((error) =>
											debugError(
												"Error sending rate limit notification during resume:",
												error,
											),
										);
								}

								// Stop processing remaining chunks
								break;
							} else {
								// For other errors, notify but continue processing
								if (resumeTabId) {
									browser.tabs
										.sendMessage(resumeTabId, {
											action: "chunkError",
											chunkIndex: chunkIndex,
											totalChunks: message.totalChunks,
											error: error.message,
											isRateLimit: false,
											isResumed: true,
										})
										.catch((error) =>
											debugError(
												"Error sending chunk error notification during resume:",
												error,
											),
										);
								}
							}
						}
					}

					// Notify that all resumed processing is complete
					if (resumeTabId) {
						browser.tabs
							.sendMessage(resumeTabId, {
								action: "resumeProcessingComplete",
								totalProcessed: results.length,
								totalFailed: failedChunks.length,
								totalChunks: message.totalChunks,
								failedChunks: failedChunks.map(
									(chunk) => chunk.chunkIndex,
								),
							})
							.catch((error) =>
								debugError(
									"Error sending resume completion notification:",
									error,
								),
							);
					}

					sendResponse({
						success: true,
						processedChunks: results.length,
						failedChunks: failedChunks.length,
					});
				} catch (error) {
					debugError("Error in resume processing:", error);
					sendResponse({
						success: false,
						error:
							error.message ||
							"Unknown error in resume processing",
					});
				}
			})();

			return true; // Indicates we'll send a response asynchronously
		}

		// Handler for re-enhancing a single chunk
		if (message.action === "reenhanceChunk") {
			debugLog(`Re-enhancing chunk ${message.chunkIndex}`);

			(async () => {
				try {
					// Load config to check API key
					const config = await initConfig();
					const allKeys = [
						config.apiKey,
						...(config.backupApiKeys || []),
					].filter((k) => k && k.trim());

					if (allKeys.length === 0) {
						sendResponse({
							success: false,
							error: "API key is missing. Please configure it in the extension popup.",
							needsApiKey: true,
						});
						return;
					}

					const partInfo = {
						current: message.chunkIndex + 1,
						total: message.totalChunks || 1,
					};

					// Process this single chunk
					const result = await processContentWithGemini(
						message.title || "Content",
						message.content,
						true, // isPart
						partInfo,
						message.useEmoji || false,
						null,
						message.siteSpecificPrompt || "",
					);

					sendResponse({
						success: true,
						result: {
							originalContent: message.content,
							enhancedContent: result.enhancedContent,
							modelInfo: result.modelInfo,
						},
					});
				} catch (error) {
					debugError(
						`Error re-enhancing chunk ${message.chunkIndex}:`,
						error,
					);
					sendResponse({
						success: false,
						error:
							error.message || "Unknown error re-enhancing chunk",
					});
				}
			})();

			return true; // Indicates we'll send a response asynchronously
		}

		if (message.action === "summarizeWithGemini") {
			summarizeContentWithGemini(
				message.title,
				message.content,
				message.isPart,
				message.partInfo,
				false, // isShort = false for long summaries
			)
				.then((summary) => {
					sendResponse({ success: true, summary: summary });
				})
				.catch((error) => {
					debugError("Error summarizing with Gemini:", error);
					sendResponse({
						success: false,
						error:
							error.message ||
							"Unknown error summarizing with Gemini",
					});
				});
			return true; // Indicates we'll send a response asynchronously
		}

		// Handle short summary requests
		if (message.action === "shortSummarizeWithGemini") {
			summarizeContentWithGemini(
				message.title,
				message.content,
				message.isPart,
				message.partInfo,
				true, // isShort = true for short summaries
			)
				.then((summary) => {
					sendResponse({ success: true, summary: summary });
				})
				.catch((error) => {
					debugError(
						"Error creating short summary with Gemini:",
						error,
					);
					sendResponse({
						success: false,
						error:
							error.message ||
							"Unknown error creating short summary",
					});
				});
			return true; // Indicates we'll send a response asynchronously
		}

		if (message.action === "combinePartialSummaries") {
			combinePartialSummaries(
				message.title,
				message.partSummaries,
				message.partCount,
			)
				.then((summary) => {
					sendResponse({
						success: true,
						combinedSummary: summary,
					});
				})
				.catch((error) => {
					debugError("Error combining summaries:", error);
					sendResponse({
						success: false,
						error:
							error.message ||
							"Unknown error combining summaries",
					});
				});
			return true; // Indicates we'll send a response asynchronously
		}

		// Handle request to open the popup window
		if (message.action === "openPopup") {
			browser.windows
				.create({
					url: browser.runtime.getURL("popup/popup.html"),
					type: "popup",
					width: 400,
					height: 550,
				})
				.catch((error) => {
					debugError("Error opening popup:", error);
				});
			// Send response
			sendResponse({ success: true });
			return true;
		}

		// Handle metadata fetching for background operations
		if (message.action === "fetchNovelMetadata") {
			return processMessage(message, sender, sendResponse);
		}

		// Handle handler settings proposal requests
		if (message.action === "getHandlerSettings") {
			return processMessage(message, sender, sendResponse);
		}

		// Handle updating novel metadata from content script
		if (message.action === "updateNovelMetadata") {
			(async () => {
				try {
					const { novelId, metadata } = message;

					if (!novelId) {
						sendResponse({
							success: false,
							error: "Missing novelId",
						});
						return;
					}

					// Load novel library
					let lib = await loadNovelLibraryForBackground();
					if (!lib || !lib.novels) {
						sendResponse({
							success: false,
							error: "Failed to load novel library",
						});
						return;
					}

					// Get the novel from library
					const novel = lib.novels[novelId];
					if (!novel) {
						sendResponse({
							success: false,
							error: `Novel ${novelId} not found in library`,
						});
						return;
					}

					// If metadata was provided, update the novel
					if (metadata && typeof metadata === "object") {
						// Update the novel with new metadata
						const updated = {
							...novel,
							...metadata,
							lastMetadataUpdate: Date.now(),
							lastAccessedAt: Date.now(),
						};

						// Save updated novel
						lib.novels[novelId] = updated;
						await saveLibraryData(lib);

						debugLog(
							`[Background] Updated novel ${novelId} metadata`,
						);
						sendResponse({
							success: true,
							metadata: updated,
						});
					} else {
						sendResponse({
							success: false,
							error: "No metadata provided",
						});
					}
				} catch (error) {
					debugError(
						"[Background] Error updating novel metadata:",
						error,
					);
					sendResponse({
						success: false,
						error:
							error.message || "Unknown error updating metadata",
					});
				}
			})();
			return true;
		}

		return false;
	});

	// Get model information based on current configuration
	async function getModelInfo() {
		try {
			// Load latest config
			currentConfig = await initConfig();

			// Default values
			let maxContextSize = 16000; // Default for gemini-2.5-flash
			let maxOutputTokens = currentConfig.maxOutputTokens || 8192;

			// Model-specific values
			const modelId =
				currentConfig.selectedModelId ||
				currentConfig.modelEndpoint?.split("/").pop().split(":")[0] ||
				"gemini-2.5-flash";

			// Set appropriate context sizes based on model
			if (modelId.includes("gemini-2.5-pro")) {
				maxContextSize = 1000000; // 1M token context for Gemini 2.5 Pro
			} else if (modelId.includes("gemini-2.5-flash")) {
				maxContextSize = 16000; // 16k token context for Gemini 2.5 Flash
			} else if (modelId.includes("gemini-2.0-flash")) {
				maxContextSize = 32000; // 32k token context for Gemini 2.0 Flash
			}

			// Get font size setting (default 100%)
			const fontSize = currentConfig.fontSize || 100;

			return {
				modelId,
				maxContextSize,
				maxOutputTokens,
				fontSize,
			};
		} catch (error) {
			debugError("Error determining model info:", error);
			// Return safe defaults
			return {
				modelId: "unknown",
				maxContextSize: 16000,
				maxOutputTokens: 8192,
				fontSize: 100,
			};
		}
	}

	// Process content in chunks, handling one at a time with rate limit awareness
	async function processContentInChunks(
		title,
		content,
		useEmoji = false,
		siteSpecificPrompt = "",
		tabId = null,
		forceChunking = false,
	) {
		debugLog(
			`[processContentInChunks] Starting. Content length: ${content?.length}, tabId: ${tabId}`,
		);
		try {
			// Load latest config directly from storage for most up-to-date settings
			currentConfig = await initConfig();
			debugLog(
				`[processContentInChunks] Config loaded. chunkingEnabled: ${currentConfig.chunkingEnabled}, chunkSize: ${currentConfig.chunkSize}`,
			);

			// Check if chunking is enabled
			if (!currentConfig.chunkingEnabled) {
				debugLog(
					"[processContentInChunks] Chunking is DISABLED. Processing content as a single piece.",
				);
				return await processContentWithGemini(
					title,
					content,
					false,
					null,
					useEmoji,
					null,
					siteSpecificPrompt,
				);
			}

			// Get model info to determine appropriate chunk size
			const modelInfo = await getModelInfo();
			const modelContextSize = modelInfo.maxContextSize || 16000;

			// Calculate safe chunk size based on model context
			// Reserve space for: system prompt (~1500 tokens), conversation history (~2000 tokens), output (~maxOutputTokens)
			// Average word = ~1.3 tokens, average character = ~0.25 tokens
			const promptOverheadTokens = 1500;
			const historyOverheadTokens = 2000;
			const outputTokens = currentConfig.maxOutputTokens || 8192;
			const availableInputTokens =
				modelContextSize -
				promptOverheadTokens -
				historyOverheadTokens -
				outputTokens;

			// Convert tokens to characters (roughly 4 chars per token for English text)
			const maxCharsForInput = Math.max(availableInputTokens * 4, 4000);

			// Use the smaller of: configured chunk size (words), calculated safe size, or 3200 default
			// NOTE: Default 3200 words MUST match content.js and other references for consistency
			const configuredChunkSizeWords =
				currentConfig.chunkSizeWords || 3200;
			// Convert words to approximate character count for comparison (1 word ≈ 7 chars)
			const configuredChunkSizeChars = configuredChunkSizeWords * 7;
			const effectiveChunkSizeChars = Math.min(
				configuredChunkSizeChars,
				maxCharsForInput,
			);
			const effectiveChunkSizeWords = Math.floor(
				effectiveChunkSizeChars / 7,
			);

			debugLog(
				`[processContentInChunks] Model: ${modelInfo.modelId}, Context: ${modelContextSize} tokens`,
			);
			debugLog(
				`[processContentInChunks] Available for input: ~${availableInputTokens} tokens (~${maxCharsForInput} chars)`,
			);
			debugLog(
				`[processContentInChunks] Using effective chunk size: ${effectiveChunkSizeWords} words (~${effectiveChunkSizeChars} characters)`,
			);
			if (effectiveChunkSizeWords < configuredChunkSizeWords) {
				debugLog(
					`[processContentInChunks] WARNING: Model context (${modelContextSize} tokens) limits effective chunk size to ${effectiveChunkSizeWords} words, below configured ${configuredChunkSizeWords} words. Consider increasing model context or reducing chunk size.`,
				);
			}
			debugLog(
				`[processContentInChunks] Content length: ${content.length}, effectiveChunkSize: ${effectiveChunkSizeChars}`,
			);

			// Only split if content exceeds the chunk size (unless forced)
			if (!forceChunking && content.length <= effectiveChunkSizeChars) {
				debugLog(
					`[processContentInChunks] Content (${content.length}) <= effectiveChunkSize (${effectiveChunkSizeChars}), processing as single piece.`,
				);
				return await processContentWithGemini(
					title,
					content,
					false,
					null,
					useEmoji,
					null,
					siteSpecificPrompt,
				);
			}

			// When forceChunking is true, the content script already created DOM wrappers
			// using the configured chunk size. We MUST split with the same size here
			// so the chunk count matches, otherwise chunks won't find their DOM targets.
			const splitSizeWords = forceChunking
				? configuredChunkSizeWords
				: effectiveChunkSizeWords;

			debugLog(
				"[processContentInChunks] Content exceeds chunk size, using word-based paragraph-aware splitting...",
			);
			debugLog(
				`[processContentInChunks] Split size: ${splitSizeWords} words (${forceChunking ? "configured — matching content script" : "model-aware effective"})`,
			);
			// Use new modular chunking system with paragraph awareness
			const chunks = chunkingSystem.core.splitContentByWords(
				content,
				splitSizeWords,
			);
			const contentChunks = chunks.map((chunk) => chunk.content);
			const totalChunks = contentChunks.length;

			debugLog(
				`[processContentInChunks] Split into ${totalChunks} chunks`,
			);

			// DEBUG: Log each chunk's size and first 100 chars
			contentChunks.forEach((chunk, idx) => {
				debugLog(
					`[processContentInChunks] Chunk ${idx}: ${
						chunk?.length || 0
					} chars, empty=${!chunk || chunk.trim().length === 0}`,
				);
				debugLog(
					`[processContentInChunks] Chunk ${idx} preview: "${chunk?.substring(
						0,
						100,
					)}..."`,
				);
			});

			// CRITICAL: Check API key BEFORE processing any chunks
			// This prevents wasting time and showing misleading error messages
			const allKeys = [
				currentConfig.apiKey,
				...(currentConfig.backupApiKeys || []),
			].filter((k) => k && k.trim());

			if (allKeys.length === 0) {
				const error = new Error(
					"API key is missing. Please set it in the extension popup.",
				);
				debugError(
					"[processContentInChunks] No API key found. Aborting chunk processing.",
				);

				// Notify user via content script
				if (tabId) {
					try {
						await browser.tabs.sendMessage(tabId, {
							action: "apiKeyMissing",
							error: error.message,
						});
					} catch (msgError) {
						debugError(
							"Error sending API key missing message:",
							msgError,
						);
					}
				}

				// Try to open popup
				try {
					await browser.action.openPopup();
				} catch (popupError) {
					// Fallback notification
					await browser.notifications.create({
						type: "basic",
						title: "Ranobe Gemini",
						message:
							"Please configure your API key in the extension settings.",
						iconUrl: browser.runtime.getURL("icons/icon.png"),
					});
				}

				throw error;
			}

			// Array to store results for each chunk
			let results = [];
			let failedChunks = [];

			// For maintaining conversation context between chunks
			let conversationHistory = null;

			// Reset cancellation flag at start of new processing
			isCancellationRequested = false;

			// Process each chunk one by one
			for (let i = 0; i < totalChunks; i++) {
				// Check for cancellation before processing each chunk
				if (isCancellationRequested) {
					debugLog(
						`[processContentInChunks] Cancellation requested at chunk ${
							i + 1
						}/${totalChunks}`,
					);
					if (tabId) {
						browser.tabs
							.sendMessage(tabId, {
								action: "processingCancelled",
								processedChunks: results.length,
								remainingChunks: totalChunks - i,
								totalChunks: totalChunks,
							})
							.catch(debugerror);
					}
					break;
				}

				let retryCount = 0;
				let processed = false;

				while (!processed && retryCount < 3) {
					// Check cancellation in retry loop too
					if (isCancellationRequested) {
						debugLog(
							"[processContentInChunks] Cancellation during retry",
						);
						break;
					}

					try {
						debugLog(`Processing chunk ${i + 1}/${totalChunks}`);

						// Wait a bit between chunks to avoid rate limiting
						if (i > 0 || retryCount > 0) {
							const delay = 1000 * (retryCount + 1); // Increased delay between retries
							debugLog(
								`Waiting ${delay}ms before processing next chunk...`,
							);
							await new Promise((resolve) =>
								setTimeout(resolve, delay),
							);
						}

						// Process this chunk
						const chunk = contentChunks[i];
						const partInfo = {
							current: i + 1,
							total: totalChunks,
						};

						// DEBUG: Log chunk content before processing
						debugLog(
							`[DEBUG] Chunk ${i} content length: ${
								chunk?.length || 0
							}`,
						);
						debugLog(
							`[DEBUG] Chunk ${i} first 200 chars: "${chunk?.substring(
								0,
								200,
							)}"`,
						);
						debugLog(
							`[DEBUG] Chunk ${i} is empty: ${
								!chunk || chunk.trim().length === 0
							}`,
						);

						// CRITICAL: Validate chunk has actual content before sending
						if (!chunk || chunk.trim().length < 50) {
							debugError(
								`[ERROR] Chunk ${i} is empty or too short (${
									chunk?.length || 0
								} chars). Skipping.`,
							);
							throw new Error(
								`Chunk ${i} has no content to process`,
							);
						}

						// Process with Gemini, passing conversation history for context
						// NOTE: For first chunk, don't pass conversation history to avoid pollution
						const result = await processContentWithGemini(
							title,
							chunk,
							true,
							partInfo,
							useEmoji,
							i === 0 ? null : conversationHistory, // First chunk always starts fresh
							siteSpecificPrompt,
						);

						// Guard against excessive shortening (avoid accidental summaries)
						const originalWordCount = chunkingSystem?.core
							?.countWords
							? chunkingSystem.core.countWords(chunk)
							: 0;
						const enhancedWordCount = chunkingSystem?.core
							?.countWords
							? chunkingSystem.core.countWords(
									result.enhancedContent,
								)
							: 0;
						const minRetentionRatio = 0.7;
						if (originalWordCount >= 200 && enhancedWordCount > 0) {
							const minWords = Math.round(
								originalWordCount * minRetentionRatio,
							);
							if (enhancedWordCount < minWords) {
								debugError(
									`[processContentInChunks] Enhanced content too short (${enhancedWordCount}/${originalWordCount} words). Retrying chunk ${i}.`,
								);
								throw new Error(
									`Enhanced content too short (${enhancedWordCount}/${originalWordCount} words).`,
								);
							}
						}

						// Store the result for this chunk
						results.push({
							originalContent: chunk,
							enhancedContent: result.enhancedContent,
							chunkIndex: i,
							processed: true,
						});

						// Update conversation history for next chunk
						conversationHistory = result.conversationHistory;

						// Immediately send this processed chunk back to the content script
						// Include streaming information for progressive updates
						// Must use tabs.sendMessage to reach content scripts
						if (tabId) {
							browser.tabs
								.sendMessage(tabId, {
									action: "chunkProcessed",
									chunkIndex: i,
									totalChunks: totalChunks,
									result: {
										originalContent: chunk,
										enhancedContent: result.enhancedContent,
										isResumed: retryCount > 0,
										modelInfo: result.modelInfo,
									},
									isComplete:
										i === totalChunks - 1 &&
										failedChunks.length === 0,
									progressPercent: Math.round(
										((i + 1) / totalChunks) * 100,
									),
								})
								.catch((error) =>
									debugError(
										"Error sending chunk result to tab:",
										error,
									),
								);
						}

						processed = true;
					} catch (error) {
						debugError(
							`Error processing chunk ${
								i + 1
							}/${totalChunks} (attempt ${retryCount + 1}):`,
							error,
						);

						// Check if this is a rate limit error
						const isRateLimitError =
							error.message &&
							(error.message.includes("rate limit") ||
								error.message.includes("quota") ||
								error.message.includes("429"));

						if (isRateLimitError) {
							// Parse retry time from error message if available
							let waitTime = 60000; // Default 1 minute
							const timeMatch =
								error.message.match(/(\d+) seconds/);
							if (timeMatch && timeMatch[1]) {
								waitTime = parseInt(timeMatch[1]) * 1000;
							}

							debugLog(
								`Rate limit detected. Waiting ${
									waitTime / 1000
								} seconds before retrying...`,
							);

							// Notify the content script about the rate limit and wait
							if (tabId) {
								browser.tabs
									.sendMessage(tabId, {
										action: "chunkError",
										chunkIndex: i,
										totalChunks: totalChunks,
										error: error.message,
										isRateLimit: true,
										waitTime: waitTime,
										retryCount: retryCount,
									})
									.catch((error) =>
										debugError(
											"Error sending rate limit notification:",
											error,
										),
									);
							}

							// Wait for the specified time with periodic keep-alive pings
							// to prevent service worker from sleeping during long waits
							const startTime = Date.now();
							while (Date.now() - startTime < waitTime) {
								// Keep alive ping every 25 seconds
								const remainingWait = Math.min(
									25000,
									waitTime - (Date.now() - startTime),
								);
								if (remainingWait > 0) {
									await new Promise((resolve) =>
										setTimeout(resolve, remainingWait),
									);
								}
								// Log to keep the service worker active
								debugLog(
									`[Keep-Alive] Rate limit wait: ${Math.round(
										(waitTime - (Date.now() - startTime)) /
											1000,
									)}s remaining`,
								);
							}

							// Increment retry count and try again
							retryCount++;
						} else if (retryCount < 2) {
							// For non-rate limit errors, retry with exponential backoff
							const backoffTime = Math.pow(2, retryCount) * 3000;
							debugLog(
								`Error processing chunk. Retrying in ${
									backoffTime / 1000
								} seconds...`,
							);

							// Notify content script
							if (tabId) {
								browser.tabs
									.sendMessage(tabId, {
										action: "chunkError",
										chunkIndex: i,
										totalChunks: totalChunks,
										error: error.message,
										isRateLimit: false,
										retryCount: retryCount,
									})
									.catch((error) =>
										debugError(
											"Error sending chunk error notification:",
											error,
										),
									);
							} // Wait and retry
							await new Promise((resolve) =>
								setTimeout(resolve, backoffTime),
							);
							retryCount++;
						} else {
							// If we've exhausted retries, mark as failed and move on
							failedChunks.push({
								originalContent: contentChunks[i],
								chunkIndex: i,
								error: error.message || "Unknown error",
								processed: false,
							});

							// Notify content script about failure
							if (tabId) {
								browser.tabs
									.sendMessage(tabId, {
										action: "chunkError",
										chunkIndex: i,
										totalChunks: totalChunks,
										error: error.message,
										isRateLimit: false,
										isResumed: false,
										finalFailure: true,
									})
									.catch((error) =>
										debugError(
											"Error sending chunk error notification:",
											error,
										),
									);
							}
							processed = true; // Move on to next chunk
						}
					}
				}
			}

			// Notify that all processing is complete
			debugLog("All chunks processed. Notifying content script.");

			// Send complete notification to content script
			if (tabId) {
				browser.tabs
					.sendMessage(tabId, {
						action: "allChunksProcessed",
						totalProcessed: results.length,
						totalFailed: failedChunks.length,
						totalChunks: totalChunks,
						failedChunks: failedChunks.map(
							(chunk) => chunk.chunkIndex,
						),
						hasPartialContent: results.length > 0,
					})
					.catch((error) =>
						debugError(
							"Error sending completion notification:",
							error,
						),
					);
			}

			// Return status info (DON'T include enhancedContent to avoid duplicate processing)
			// Chunks were already sent individually via messages above
			const combinedResult = {
				originalContent: content,
				processedChunks: results.length,
				totalChunks: totalChunks,
				failedChunks: failedChunks.length,
				isComplete: failedChunks.length === 0,
				chunksProcessed: true, // Flag to prevent re-processing in content script
			};

			return combinedResult;
		} catch (error) {
			debugError("Error in chunk processing:", error);
			throw error;
		}
	}

	// Process content with Gemini API
	async function processContentWithGemini(
		title,
		content,
		isPart = false,
		partInfo = null,
		useEmoji = false,
		conversationHistory = null,
		siteSpecificPrompt = "",
	) {
		try {
			// CRITICAL: Validate content exists and has substance
			if (!content || typeof content !== "string") {
				throw new Error("No content provided for enhancement");
			}

			const trimmedContent = content.trim();
			if (trimmedContent.length < 50) {
				throw new Error(
					`Content too short for enhancement (${trimmedContent.length} chars)`,
				);
			}

			// Add debugging to verify content is received
			debugLog(
				`[processContentWithGemini] Processing content with length: ${
					content?.length || 0
				} characters.`,
			);
			debugLog(
				`[processContentWithGemini] First 200 chars: "${content?.substring(
					0,
					200,
				)}..."`,
			);
			debugLog(
				`[processContentWithGemini] Last 200 chars: "...${content?.substring(
					content.length - 200,
				)}"`,
			);

			// Extract and preserve HTML tags like images and game stats boxes before sending to Gemini
			const preservedElements = [];
			const contentWithPlaceholders = content.replace(
				/<img[^>]+>|<iframe[^>]+>|<video[^>]+>|<audio[^>]+>|<source[^>]+>|<div class="game-stats-box">[\s\S]*?<\/div>/gi,
				(match) => {
					const placeholder = `[PRESERVED_ELEMENT_${preservedElements.length}]`;
					preservedElements.push(match);
					return placeholder;
				},
			);

			debugLog(
				`Preserved ${preservedElements.length} HTML elements (images and game stats boxes)`,
			);

			// Debug log if any game stats boxes were found
			if (preservedElements.length > 0) {
				const gameBoxCount = preservedElements.filter((el) =>
					el.includes('class="game-stats-box"'),
				).length;
				if (gameBoxCount > 0) {
					debugLog(
						`Found ${gameBoxCount} game stats boxes to preserve`,
					);
				}
			}

			// Load latest config directly from storage for most up-to-date settings
			currentConfig = await initConfig();

			// Check if we have any API key (primary or backup)
			const allKeys = [
				currentConfig.apiKey,
				...(currentConfig.backupApiKeys || []),
			].filter((k) => k && k.trim());
			if (allKeys.length === 0) {
				throw new Error(
					"API key is missing. Please set it in the extension popup.",
				);
			}

			// Log part information if processing in parts
			if (isPart && partInfo) {
				debugLog(
					`Processing "${title}" - Part ${partInfo.current}/${partInfo.total} with Gemini (${contentWithPlaceholders.length} characters)`,
				);
			} else {
				debugLog(
					`Processing "${title}" with Gemini (${contentWithPlaceholders.length} characters)`,
				);
			}

			// Get model endpoint from settings - use the selected model endpoint or fall back to default
			const modelEndpoint =
				currentConfig.modelEndpoint ||
				"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

			debugLog(`Using model endpoint: ${modelEndpoint}`);

			// Get model name for logging
			const modelName =
				currentConfig.selectedModelId ||
				modelEndpoint.split("/").pop().split(":")[0];
			debugLog(`Using model: ${modelName}`);

			// Store model info to pass back to content script
			const modelInfo = {
				name: modelName,
				provider: modelName.includes("gemini")
					? "Google Gemini"
					: modelName.includes("gpt")
						? "OpenAI"
						: "AI",
			};

			// Get emoji setting - from parameter or config
			const shouldUseEmoji =
				useEmoji !== undefined ? useEmoji : currentConfig.useEmoji;
			if (shouldUseEmoji) {
				debugLog("Emoji mode is enabled - adding emojis to dialogue");
			}

			// Prepare the request for Gemini API with the latest prompt from settings
			let promptPrefix = currentConfig.defaultPrompt;

			// If processing a part, add special instructions
			if (isPart && partInfo) {
				promptPrefix += `\n\nNote: This is part ${partInfo.current} of ${partInfo.total} parts. Please enhance this part while maintaining consistency with other parts.`;
			}

			// Add emoji instructions if enabled
			if (shouldUseEmoji) {
				promptPrefix +=
					'\n\nAdditional instruction: Add appropriate emojis next to dialogues to enhance emotional expressions. Place the emoji immediately after the quotation marks that end the dialogue. For example: "I\'m so happy!" 😊 she said. Or "This is terrible." 😠 he growled. Choose emojis that fit the emotion being expressed in the dialogue.';
			}

			// Combine base prompt, permanent prompt, title, and content
			const fullPrompt = combinePrompts(
				promptPrefix,
				currentConfig.permanentPrompt,
				siteSpecificPrompt, // Use the site-specific prompt parameter
			);

			// Create the full system instruction
			const systemInstruction = `${fullPrompt}\n\n### Title:\n${title}`;

			// Create request body with proper system instruction format for Gemini
			let requestContents = [];

			// If we have conversation history, validate and use it to maintain context
			if (conversationHistory && conversationHistory.length > 0) {
				// Filter out any invalid entries (empty text, wrong roles)
				const validHistory = conversationHistory.filter((entry) => {
					if (
						!entry ||
						!entry.role ||
						!entry.parts ||
						!entry.parts[0]
					)
						return false;
					if (
						!entry.parts[0].text ||
						entry.parts[0].text.trim() === ""
					)
						return false;
					// Gemini only accepts 'user' and 'model' roles
					if (entry.role !== "user" && entry.role !== "model") {
						// Convert 'assistant' to 'model'
						if (entry.role === "assistant") {
							entry.role = "model";
						} else {
							return false;
						}
					}
					return true;
				});

				// Ensure alternating roles (user, model, user, model...)
				const cleanedHistory = [];
				let lastRole = null;
				for (const entry of validHistory) {
					// Skip if same role as previous (no consecutive same roles)
					if (entry.role === lastRole) continue;
					cleanedHistory.push(entry);
					lastRole = entry.role;
				}

				// If history ends with 'user', we need to ensure we don't add another user message
				// The last entry should be 'model' before we add a new 'user' message
				if (
					cleanedHistory.length > 0 &&
					cleanedHistory[cleanedHistory.length - 1].role === "user"
				) {
					// Remove the last user message since we're about to add a new one
					cleanedHistory.pop();
				}

				requestContents = cleanedHistory;

				// Add the current content as a new user message
				requestContents.push({
					role: "user",
					parts: [
						{
							text: `### Content to Enhance:\n${contentWithPlaceholders}`,
						},
					],
				});
			} else {
				// Start a new conversation with proper user message
				requestContents = [
					{
						role: "user",
						parts: [
							{
								text: `### Content to Enhance:\n${contentWithPlaceholders}`,
							},
						],
					},
				];
			}

			// Create the request body with system_instruction separate from contents
			const requestBody = {
				system_instruction: {
					parts: [
						{
							text: systemInstruction,
						},
					],
				},
				contents: requestContents,
				generationConfig: {
					temperature: currentConfig.temperature || 0.7,
					maxOutputTokens: currentConfig.maxOutputTokens || 8192,
					topP:
						currentConfig.topP !== undefined
							? currentConfig.topP
							: 0.95,
					topK:
						currentConfig.topK !== undefined
							? currentConfig.topK
							: 40,
				},
			};

			// Log the request if debug mode is enabled
			if (currentConfig.debugMode) {
				debugLog("Gemini API Request:", {
					url: modelEndpoint,
					requestBody: JSON.parse(JSON.stringify(requestBody)),
				});
			}

			// Make the API call with automatic key rotation
			const { response, responseData, keyUsed } =
				await makeApiCallWithRotation(
					modelEndpoint,
					requestBody,
					currentConfig,
				);

			// Log the response if debug mode is enabled
			if (currentConfig.debugMode) {
				debugLog("Gemini API Response:", responseData);
				if (keyUsed > 0) {
					debugLog(`Used backup API key ${keyUsed}`);
				}
			}

			// Handle other API errors
			if (!response.ok) {
				let errorMessage =
					responseData.error?.message ||
					`API Error: ${response.status} ${response.statusText}`;

				// Provide helpful error messages for common issues
				if (
					errorMessage.includes("exceeds the maximum") ||
					errorMessage.includes("token limit") ||
					errorMessage.includes("context length") ||
					errorMessage.includes("too long")
				) {
					errorMessage = `Content exceeds model's context limit. The chapter may be too long. Try using a model with larger context (like Gemini Pro) or enable chunking in settings. Original error: ${errorMessage}`;
				} else if (
					errorMessage.includes("invalid") &&
					errorMessage.includes("key")
				) {
					errorMessage = `Invalid API key. Please check your API key in the extension settings. Original error: ${errorMessage}`;
				}

				throw new Error(errorMessage);
			}

			// Check for content safety blocks
			if (responseData.candidates && responseData.candidates.length > 0) {
				const candidate = responseData.candidates[0];

				// Check if content was blocked by safety filters
				if (
					candidate.finishReason === "SAFETY" ||
					candidate.finishReason === "BLOCKED_REASON_UNSPECIFIED"
				) {
					debugError(
						"Content blocked by safety filters:",
						candidate.safetyRatings,
					);
					throw new Error(
						"Content was blocked by Gemini's safety filters. The content may contain sensitive themes. Try adjusting your content or prompt.",
					);
				}

				// Check if content is missing
				if (
					!candidate.content ||
					!candidate.content.parts ||
					candidate.content.parts.length === 0
				) {
					debugError("No content parts in response:", candidate);
					throw new Error(
						"Gemini returned no content. This may be due to safety filters or an API issue.",
					);
				}
			}

			// Extract the generated text
			if (responseData.candidates && responseData.candidates.length > 0) {
				let generatedText =
					responseData.candidates[0].content?.parts[0]?.text;

				// Capture conversation history for future chunks
				const updatedConversationHistory = [...requestContents];

				// Add the model response to conversation history (Gemini uses 'model' not 'assistant')
				if (generatedText) {
					updatedConversationHistory.push({
						role: "model",
						parts: [{ text: generatedText }],
					});
				}

				if (generatedText) {
					// Restore preserved HTML elements if they exist
					if (preservedElements && preservedElements.length > 0) {
						debugLog(
							`Restoring ${preservedElements.length} HTML elements`,
						);
						preservedElements.forEach((element, index) => {
							const placeholder = `[PRESERVED_ELEMENT_${index}]`;
							generatedText = generatedText.replace(
								new RegExp(placeholder, "g"),
								element,
							);
						});

						// Log restoration of game stats boxes if any were present
						const gameBoxCount = preservedElements.filter((el) =>
							el.includes('class="game-stats-box"'),
						).length;
						if (gameBoxCount > 0) {
							debugLog(
								`Restored ${gameBoxCount} game stats boxes in processed text`,
							);
						}
					}

					return {
						originalContent: content,
						enhancedContent: generatedText,
						modelInfo: modelInfo, // Include model info in the response
						conversationHistory:
							updatedConversationHistory.slice(-4), // Keep last 4 messages for context
					};
				}
			}

			throw new Error(
				"No valid response content returned from Gemini API",
			);
		} catch (error) {
			debugError("Gemini API error:", error);
			throw error;
		}
	}

	// Summarize content with Gemini API
	async function summarizeContentWithGemini(
		title,
		content,
		isPart = false,
		partInfo = null,
		isShort = false,
	) {
		try {
			// Load latest config
			currentConfig = await initConfig();

			// Check if we have any API key (primary or backup)
			const allKeys = [
				currentConfig.apiKey,
				...(currentConfig.backupApiKeys || []),
			].filter((k) => k && k.trim());
			if (allKeys.length === 0) {
				throw new Error(
					"API key is missing. Please set it in the extension popup.",
				);
			}

			const summaryType = isShort ? "short" : "long";
			if (isPart && partInfo) {
				debugLog(
					`Creating ${summaryType} summary of "${title}" - Part ${partInfo.current}/${partInfo.total} with Gemini (${content.length} characters)`,
				);
			} else {
				debugLog(
					`Creating ${summaryType} summary of "${title}" with Gemini (${content.length} characters)`,
				);
			}

			const modelEndpoint =
				currentConfig.modelEndpoint ||
				"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

			// Use the appropriate summary prompt based on isShort flag
			let summarizationBasePrompt;
			if (isShort) {
				summarizationBasePrompt =
					currentConfig.shortSummaryPrompt ||
					DEFAULT_SHORT_SUMMARY_PROMPT;
			} else {
				summarizationBasePrompt =
					currentConfig.summaryPrompt || DEFAULT_SUMMARY_PROMPT;
			}

			// If processing a part, add special instructions
			if (isPart && partInfo) {
				summarizationBasePrompt += `\n\nNote: This is part ${partInfo.current} of ${partInfo.total} parts. Please summarize this part while maintaining consistency with other parts.`;
			}

			// Combine base summarization prompt, permanent prompt, title, and content
			const fullSummarizationPrompt = combinePrompts(
				summarizationBasePrompt,
				currentConfig.permanentPrompt,
				"", // Site-specific prompt can be added here if needed
			);

			// Create proper role-based content for summarization
			const requestContents = [
				{
					role: "user",
					parts: [
						{
							text: `### Content to Summarize:\n${content}`,
						},
					],
				},
			];

			// Use smaller output tokens for short summaries
			const maxOutputTokens = isShort ? 512 : 2048;

			const requestBody = {
				system_instruction: {
					parts: [
						{
							text: `${fullSummarizationPrompt}\n\n### Title:\n${title}`,
						},
					],
				},
				contents: requestContents,
				generationConfig: {
					temperature: 0.5, // Lower temperature for more focused summary
					maxOutputTokens: maxOutputTokens,
					topP:
						currentConfig.topP !== undefined
							? currentConfig.topP
							: 0.95,
					topK:
						currentConfig.topK !== undefined
							? currentConfig.topK
							: 40,
				},
			};

			if (currentConfig.debugMode) {
				debugLog("Gemini Summarization Request:", {
					url: modelEndpoint,
					requestBody: JSON.parse(JSON.stringify(requestBody)),
				});
			}

			// Make the API call with automatic key rotation
			const { response, responseData, keyUsed } =
				await makeApiCallWithRotation(
					modelEndpoint,
					requestBody,
					currentConfig,
				);

			if (currentConfig.debugMode) {
				debugLog("Gemini Summarization Response:", responseData);
				if (keyUsed > 0) {
					debugLog(`Used backup API key ${keyUsed}`);
				}
			}

			if (!response.ok) {
				const errorMessage =
					responseData.error?.message ||
					`API Error: ${response.status} ${response.statusText}`;
				throw new Error(errorMessage);
			}

			if (responseData.candidates && responseData.candidates.length > 0) {
				const generatedSummary =
					responseData.candidates[0].content?.parts[0]?.text;
				if (generatedSummary) {
					return generatedSummary;
				}
			}

			throw new Error("No valid summary returned from Gemini API");
		} catch (error) {
			debugError("Gemini API summarization error:", error);
			throw error;
		}
	}

	// Combine partial summaries into a single summary
	async function combinePartialSummaries(title, partSummaries, partCount) {
		try {
			// Load latest config
			currentConfig = await initConfig();

			// Check if we have any API key (primary or backup)
			const allKeys = [
				currentConfig.apiKey,
				...(currentConfig.backupApiKeys || []),
			].filter((k) => k && k.trim());
			if (allKeys.length === 0) {
				throw new Error(
					"API key is missing. Please set it in the extension popup.",
				);
			}

			debugLog(
				`Combining ${partCount} partial summaries for "${title}" with Gemini`,
			);

			const modelEndpoint =
				currentConfig.modelEndpoint ||
				"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

			// Use the summary prompt from settings
			const combinationBasePrompt =
				"Please combine the following partial summaries into a coherent, comprehensive summary of the entire chapter:";

			// Combine base combination prompt, permanent prompt, title, and partial summaries
			const fullCombinationPrompt = combinePrompts(
				combinationBasePrompt,
				currentConfig.permanentPrompt,
				"", // Site-specific prompt can be added here if needed
			);

			// Create full content with all part summaries
			const allPartSummaries = partSummaries
				.map(
					(summary, index) =>
						`Part ${index + 1}/${partCount}:\n${summary}`,
				)
				.join("\n\n");

			// Create proper role-based content for summary combination
			const requestContents = [
				{
					role: "user",
					parts: [
						{
							text: `### Partial Summaries:\n${allPartSummaries}`,
						},
					],
				},
			];

			const requestBody = {
				system_instruction: {
					parts: [
						{
							text: `${fullCombinationPrompt}\n\n### Title:\n${title}`,
						},
					],
				},
				contents: requestContents,
				generationConfig: {
					temperature: 0.5, // Lower temperature for more focused summary
					maxOutputTokens: 512, // Limit summary length
					topP:
						currentConfig.topP !== undefined
							? currentConfig.topP
							: 0.95,
					topK:
						currentConfig.topK !== undefined
							? currentConfig.topK
							: 40,
				},
			};

			if (currentConfig.debugMode) {
				debugLog("Gemini Combination Request:", {
					url: modelEndpoint,
					requestBody: JSON.parse(JSON.stringify(requestBody)),
				});
			}

			// Make the API call with automatic key rotation
			const { response, responseData, keyUsed } =
				await makeApiCallWithRotation(
					modelEndpoint,
					requestBody,
					currentConfig,
				);

			if (currentConfig.debugMode) {
				debugLog("Gemini Combination Response:", responseData);
				if (keyUsed > 0) {
					debugLog(`Used backup API key ${keyUsed}`);
				}
			}

			if (!response.ok) {
				const errorMessage =
					responseData.error?.message ||
					`API Error: ${response.status} ${response.statusText}`;
				throw new Error(errorMessage);
			}

			if (responseData.candidates && responseData.candidates.length > 0) {
				const combinedSummary =
					responseData.candidates[0].content?.parts[0]?.text;
				if (combinedSummary) {
					return combinedSummary;
				}
			}

			throw new Error(
				"No valid combined summary returned from Gemini API",
			);
		} catch (error) {
			debugError("Gemini API combination error:", error);
			throw error;
		}
	}

	// Listen for storage changes to ensure our config is always up-to-date
	browser.storage.onChanged.addListener(async (changes) => {
		// Refresh our configuration when storage changes
		currentConfig = await initConfig();
		debugLog("Configuration updated due to storage changes");

		// Log the key that changed
		const changedKeys = Object.keys(changes);
		debugLog("Changed settings:", changedKeys);
	});

	// Setup browser action (icon) click handler
	browser.action.onClicked.addListener(() => {
		debugLog("Browser action clicked");
		// Open the simple popup directly if popup doesn't open
		browser.windows
			.create({
				url: browser.runtime.getURL("popup/popup.html"),
				type: "popup",
				width: 400,
				height: 550,
			})
			.catch((error) => {
				debugError("Error opening popup:", error);
			});
	});

	// Handle keyboard commands
	browser.commands.onCommand.addListener(async (command) => {
		debugLog("Command received:", command);

		switch (command) {
			case "open-library":
				browser.tabs.create({
					url: browser.runtime.getURL("library/library.html"),
				});
				break;

			case "enhance-page":
				// Send enhance message to active tab
				try {
					const [activeTab] = await browser.tabs.query({
						active: true,
						currentWindow: true,
					});
					if (activeTab) {
						browser.tabs.sendMessage(activeTab.id, {
							action: "enhanceChapter",
						});
					}
				} catch (error) {
					debugError("Error sending enhance command:", error);
				}
				break;

			case "summarize-page":
				// Send summarize message to active tab
				try {
					const [activeTab] = await browser.tabs.query({
						active: true,
						currentWindow: true,
					});
					if (activeTab) {
						browser.tabs.sendMessage(activeTab.id, {
							action: "summarizeChapter",
						});
					}
				} catch (error) {
					debugError("Error sending summarize command:", error);
				}
				break;
		}
	});

	// Initialize when background script loads
	initConfig()
		.then((config) => {
			currentConfig = config;
			debugLog("Configuration loaded:", config);
		})
		.catch((error) => debugError("Config initialization error:", error));

	// Create context menu items for right-click on extension icon
	try {
		// Remove existing menus first to avoid duplicates on reload
		browser.contextMenus
			.removeAll()
			.then(() => {
				// Add Novel Library shortcut
				browser.contextMenus.create({
					id: "openNovelLibrary",
					title: "📚 Open Novel Library",
					contexts: ["action"], // Shows when right-clicking extension icon
				});

				// Add separator
				browser.contextMenus.create({
					id: "separator1",
					type: "separator",
					contexts: ["action"],
				});

				// Add quick settings access
				browser.contextMenus.create({
					id: "openSettings",
					title: "⚙️ Settings",
					contexts: ["action"],
				});

				debugLog("Context menus created successfully");
			})
			.catch((err) => debugError("Error creating context menus:", err));
	} catch (error) {
		debugError("Context menus API not available:", error);
	}

	// Handle context menu clicks
	browser.contextMenus.onClicked.addListener((info, _tab) => {
		switch (info.menuItemId) {
			case "openNovelLibrary":
				browser.tabs.create({
					url: browser.runtime.getURL("library/library.html"),
				});
				break;
			case "openSettings":
				browser.tabs.create({
					url: browser.runtime.getURL("popup/popup.html"),
				});
				break;
		}
	});

	// Log the extension startup
	debugLog("Ranobe Gemini extension initialized");

	// Fallback heartbeat using setInterval (less reliable in MV3, but works as backup)
	// Primary keep-alive is handled by chrome.alarms above
	setInterval(() => {
		// Only log occasionally to reduce noise
		if (Math.random() < 0.1) {
			debugLog("[Fallback] Background script heartbeat (setInterval)");
		}
	}, 25000);
})();
