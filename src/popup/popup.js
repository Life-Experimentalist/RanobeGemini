// Simple popup script for Ranobe Gemini

import {
	DEFAULT_PROMPT,
	DEFAULT_SUMMARY_PROMPT,
	DEFAULT_SHORT_SUMMARY_PROMPT,
	DEFAULT_PERMANENT_PROMPT,
	DEFAULT_DRIVE_CLIENT_ID,
	DEFAULT_DEBUG_MODE,
} from "../utils/constants.js";
import { debugLog, debugError } from "../utils/logger.js";
import { libraryBackupManager } from "../utils/library-backup-manager.js";
import {
	createComprehensiveBackup,
	restoreComprehensiveBackup,
	createRollingBackup,
	listRollingBackups,
	getRollingBackup,
	deleteRollingBackup,
	parseOAuthCredentials,
	validateRedirectUris,
	downloadBackupAsFile,
	readBackupFromFile,
	BACKUP_OPTIONS,
} from "../utils/comprehensive-backup.js";
import {
	notificationManager,
	NotificationType,
	notifySuccess,
	notifyError,
	notifyInfo,
	notifyWarning,
} from "../utils/notification-manager.js";

// Log that imports completed successfully
debugLog("popup.js: All module imports completed successfully");

// Apply theme mode early to reduce flash (CSP-safe, no inline script)
(async () => {
	try {
		const stored = await browser.storage.local.get("themeSettings");
		const theme = stored.themeSettings || { mode: "dark" };
		const root = document.documentElement;
		if (theme.mode === "light") {
			root.setAttribute("data-theme", "light");
		} else if (theme.mode === "auto") {
			const prefersDark = window.matchMedia(
				"(prefers-color-scheme: dark)",
			).matches;
			root.setAttribute("data-theme", prefersDark ? "dark" : "light");
		} else {
			root.removeAttribute("data-theme");
		}
	} catch (error) {
		// Ignore theme errors; default to dark
		document.documentElement.removeAttribute("data-theme");
	}
})();

let novelLibrary = null;
let SHELVES = {};
let siteSettingsApi = null;
let depsReady = false;

async function ensureLibraryDeps() {
	if (depsReady) return true;
	try {
		const [libModule, siteModule] = await Promise.all([
			import("../utils/novel-library.js"),
			import("../utils/site-settings.js"),
		]);
		novelLibrary = libModule.novelLibrary;
		SHELVES = libModule.SHELVES || {};
		siteSettingsApi = siteModule;
		depsReady = true;
		return true;
	} catch (error) {
		debugError("Failed to load library dependencies:", error);
		return false;
	}
}

function isSiteEnabledSafe(settings, shelfId) {
	if (
		!siteSettingsApi ||
		typeof siteSettingsApi.isSiteEnabled !== "function"
	) {
		return true;
	}
	return siteSettingsApi.isSiteEnabled(settings, shelfId);
}

// Wrap everything in a try-catch to prevent catastrophic failures
try {
	// Initialize notification manager early
	notificationManager.initialize().catch((err) => {
		console.error("Failed to initialize notification manager:", err);
	});

	const startPopup = async () => {
		// Wrap initialization in try-catch
		try {
			await initializePopup();
		} catch (error) {
			console.error("Fatal error initializing popup:", error);
			// Show error in UI
			const statusDiv = document.getElementById("status");
			if (statusDiv) {
				statusDiv.textContent =
					"Error loading popup. Please reload the extension.";
				statusDiv.className = "error";
			}
		}
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", startPopup);
	} else {
		startPopup();
	}
} catch (error) {
	debugError("Critical error in popup script:", error);
}

async function initializePopup() {
	try {
		window.__popupJsReady = true;
	} catch (_err) {
		debugError("Failed to set window.__popupJsReady flag in popup.", _err);
	}

	// DOM elements
	const apiKeyInput = document.getElementById("apiKey");
	const saveApiKeyBtn = document.getElementById("saveApiKey");
	const testApiKeyBtn = document.getElementById("testApiKey");
	const getKeyLink = document.getElementById("getKeyLink");
	const statusDiv = document.getElementById("status");
	const modelSelect = document.getElementById("modelSelect");
	const promptTemplate = document.getElementById("promptTemplate");
	const resetPromptBtn = document.getElementById("resetPrompt");
	const summaryPrompt = document.getElementById("summaryPrompt");
	const resetSummaryPromptBtn = document.getElementById("resetSummaryPrompt");
	const shortSummaryPrompt = document.getElementById("shortSummaryPrompt");
	const resetShortSummaryPromptBtn = document.getElementById(
		"resetShortSummaryPrompt",
	);
	const permanentPrompt = document.getElementById("permanentPrompt");
	const resetPermanentPromptBtn = document.getElementById(
		"resetPermanentPrompt",
	);
	const debugModeCheckbox = document.getElementById("debugMode");
	const modelEndpointDisplay = document.getElementById(
		"modelEndpointDisplay",
	);
	const copyModelEndpoint = document.getElementById("copyModelEndpoint");

	// Expose the debug toggle globally so shared debugLog can read it synchronously in the popup.
	try {
		if (typeof window !== "undefined") {
			window.debugModeCheckbox = debugModeCheckbox;
		}
	} catch (err) {
		// ignore
	}
	const saveSettingsBtn = document.getElementById("saveSettings");
	const tabButtons = document.querySelectorAll(".tab-btn");
	const tabContents = document.querySelectorAll(".tab-content");
	const temperatureSlider = document.getElementById("temperatureSlider");
	const temperatureValue = document.getElementById("temperatureValue");

	// ===== CRITICAL: Setup tab switching IMMEDIATELY =====
	// This must run before any async code that might fail
	console.log(
		"Setting up tab switching...",
		tabButtons.length,
		"buttons found",
	);

	const setActiveTab = (tabId) => {
		// Remove active class from all buttons and contents
		tabButtons.forEach((btn) => btn.classList.remove("active"));
		tabContents.forEach((content) => content.classList.remove("active"));

		// Add active class to clicked button
		const activeButton = document.querySelector(
			`.tab-btn[data-tab="${tabId}"]`,
		);
		if (activeButton) {
			activeButton.classList.add("active");
		}

		// Show corresponding content
		const targetContent = document.getElementById(tabId);
		if (targetContent) {
			targetContent.classList.add("active");
		}
	};

	if (tabButtons.length > 0 && tabContents.length > 0) {
		tabButtons.forEach((button) => {
			button.addEventListener("click", async () => {
				const tabId = button.getAttribute("data-tab");
				setActiveTab(tabId);

				if (tabId === "novels" && typeof loadNovelsTab === "function") {
					await loadNovelsTab();
				}
				if (
					tabId === "notifications" &&
					typeof initNotificationsTab === "function"
				) {
					await initNotificationsTab();
				}
			});
		});
		console.log("Tab switching setup complete!");
	} else {
		console.error("Tab switching failed - buttons or contents not found!");
	}
	// ===== END CRITICAL SECTION =====

	const topPSlider = document.getElementById("topPSlider");
	const topPValue = document.getElementById("topPValue");
	const topKSlider = document.getElementById("topKSlider");
	const topKValue = document.getElementById("topKValue");
	const fontSizeSlider = document.getElementById("fontSizeSlider");
	const fontSizeValue = document.getElementById("fontSizeValue");
	const customEndpointInput = document.getElementById("customEndpoint");
	const saveAdvancedSettingsBtn = document.getElementById(
		"saveAdvancedSettings",
	);
	const resetAllAdvancedBtn = document.getElementById("resetAllAdvanced");
	const toggleAdvancedParamsBtn = document.getElementById(
		"toggleAdvancedParams",
	);
	const advancedParamsContent = document.getElementById(
		"advancedParamsContent",
	);
	const siteToggleList = document.getElementById("siteToggleList");
	const resetSiteTogglesBtn = document.getElementById("resetSiteToggles");

	// Backup API Keys elements
	const backupKeysListContainer = document.getElementById("backupKeysList");
	const newBackupKeyInput = document.getElementById("newBackupKey");
	const addBackupKeyBtn = document.getElementById("addBackupKey");
	const apiKeyRotationSelect = document.getElementById("apiKeyRotation");

	// Novels tab elements
	const refreshNovelsBtn = document.getElementById("refreshNovels");
	const novelsListContainer = document.getElementById("novelsList");
	const currentNovelInfo = document.getElementById("currentNovelInfo");
	const suggestedNovelsList = document.getElementById("suggestedNovelsList");

	// Library backup elements
	const autoBackupCheckbox = document.getElementById("autoBackupEnabled");
	const backupLocation = document.getElementById("backupLocation");
	const chooseBackupLocation = document.getElementById(
		"chooseBackupLocation",
	);
	const createManualBackup = document.getElementById("createManualBackup");
	// restoreBackupBtn2 removed as duplicate
	const backupList = document.getElementById("backupList");
	const mergeModRadios = document.querySelectorAll('input[name="mergeMode"]');

	const CONTINUOUS_BACKUP_DELAY_MINUTES = 5;
	const CONTINUOUS_BACKUP_CHECK_INTERVAL_MINUTES = 2; // Default check interval

	// Library Tab Elements (New)
	const libraryLoading = document.getElementById("libraryLoading");
	const currentPageSection = document.getElementById("currentPageSection");
	const pageStatusBadge = document.getElementById("pageStatusBadge");
	const currentNovelCard = document.getElementById("currentNovelCard");
	const currentNovelCover = document.getElementById("currentNovelCover");
	const currentNovelTitle = document.getElementById("currentNovelTitle");
	const currentNovelAuthor = document.getElementById("currentNovelAuthor");
	const currentPageTypeTag = document.getElementById("currentPageTypeTag");
	const currentStatusTag = document.getElementById("currentStatusTag");
	const currentChapterInfo = document.getElementById("currentChapterInfo");
	const currentChapterText = document.getElementById("currentChapterText");
	const currentProgressBar = document.getElementById("currentProgressBar");
	const currentProgressFill = document.getElementById("currentProgressFill");
	const currentProgressPercent = document.getElementById(
		"currentProgressPercent",
	);
	const libraryDetails = document.getElementById("libraryDetails");
	const readingStatusSelect = document.getElementById("readingStatusSelect");
	const enhancedCountRow = document.getElementById("enhancedCountRow");
	const enhancedCountValue = document.getElementById("enhancedCountValue");
	const genresRow = document.getElementById("genresRow");
	const genresList = document.getElementById("genresList");
	const addToLibraryBtn = document.getElementById("addToLibraryBtn");
	const openNovelBtn = document.getElementById("openNovelBtn");
	const notSupportedMessage = document.getElementById("notSupportedMessage");
	const notSupportedText = document.getElementById("notSupportedText");
	const openFullLibraryBtn = document.getElementById("openFullLibrary");
	const refreshLibraryBtn = document.getElementById("refreshLibrary");
	const statNovels = document.getElementById("statNovels");
	const statChapters = document.getElementById("statChapters");
	const statShelves = document.getElementById("statShelves");
	const recentSectionTitle = document.getElementById("recentSectionTitle");
	const siteIndicator = document.getElementById("siteIndicator");
	const recentNovelsGrid = document.getElementById("recentNovelsGrid");
	const emptyState = document.getElementById("emptyState");
	const chunkingEnabledInput = document.getElementById("chunkingEnabled");
	const chunkSizeInput = document.getElementById("chunkSize");
	const formatGameStatsInput = document.getElementById("formatGameStats");
	const centerSceneHeadingsInput = document.getElementById(
		"centerSceneHeadings",
	);
	const backupFolderInput = document.getElementById("backupFolder");
	// autoBackupToggle removed (consolidated with autoBackupCheckbox)
	// manualBackupBtn removed (consolidated with createManualBackup)
	const restoreBackupBtn = document.getElementById("restoreBackupBtn");
	const restoreFileInput = document.getElementById("restoreFileInput");
	const backupHistoryList = document.getElementById("backupHistoryList");
	const driveClientIdInput = document.getElementById("driveClientId");
	const driveClientSecretInput = document.getElementById("driveClientSecret");
	const toggleClientSecretBtn = document.getElementById(
		"toggleClientSecretVisibility",
	);
	const driveFolderIdInput = document.getElementById("driveFolderId");

	// OAuth JSON parsing elements
	const oauthJsonPaste = document.getElementById("oauthJsonPaste");
	const parseOAuthJsonBtn = document.getElementById("parseOAuthJson");
	const saveOAuthFromJsonBtn = document.getElementById("saveOAuthFromJson");
	const oauthParseResult = document.getElementById("oauthParseResult");
	const saveOAuthSettingsBtn = document.getElementById("saveOAuthSettings");

	// Comprehensive backup elements
	const createComprehensiveBackupBtn = document.getElementById(
		"createComprehensiveBackup",
	);
	const restoreComprehensiveBackupBtn = document.getElementById(
		"restoreComprehensiveBackup",
	);
	const comprehensiveBackupFile = document.getElementById(
		"comprehensiveBackupFile",
	);
	const backupIncludeApiKeys = document.getElementById(
		"backupIncludeApiKeys",
	);
	const backupIncludeCredentials = document.getElementById(
		"backupIncludeCredentials",
	);
	const rollingBackupList = document.getElementById("rollingBackupList");
	const createRollingBackupBtn = document.getElementById(
		"createRollingBackup",
	);

	// Google Drive Backup elements
	const connectDriveBtn = document.getElementById("connectDriveBtn");
	const disconnectDriveBtn = document.getElementById("disconnectDriveBtn");
	const backupNowBtn = document.getElementById("backupNowBtn");
	const viewBackupsBtn = document.getElementById("viewBackupsBtn");
	const openLibrarySettings = document.getElementById("openLibrarySettings");
	const driveNotConnected = document.getElementById("driveNotConnected");
	const driveConnected = document.getElementById("driveConnected");
	const driveStatusSpan = document.getElementById("driveStatus");
	const driveAuthError = document.getElementById("driveAuthError");
	const driveBackupModeRadios = document.querySelectorAll(
		'input[name="driveBackupMode"]',
	);
	const driveAutoRestoreEnabled = document.getElementById(
		"driveAutoRestoreEnabled",
	);
	const driveSyncNowBtn = document.getElementById("driveSyncNowBtn");

	// Declare variables for elements still used but previously undeclared (strict mode requires declaration)
	let currentSiteShelfId = null;
	let currentPageNovelData = null;
	let currentNotificationFilter = "all";
	let siteSettings = {};
	let backupHistory = [];
	const BACKUP_RETENTION = 3;
	const BACKUP_INTERVAL_DAYS = 1;

	// Element references for items that exist in popup HTML but were accessed as implicit globals
	const randomizeSuggestionsBtn = document.getElementById(
		"randomizeSuggestions",
	);
	const notificationsTabBtn = document.getElementById("notificationsTabBtn");
	const notificationBadge = document.getElementById("notificationBadge");
	const notificationsContainer = document.getElementById(
		"notificationsContainer",
	);
	const markAllReadBtn = document.getElementById("markAllReadBtn");
	const clearNotificationsBtn = document.getElementById(
		"clearNotificationsBtn",
	);
	const filterButtons = document.querySelectorAll(".notification-filter-btn");
	const totalNotifsSpan = document.getElementById("totalNotifs");
	const unreadNotifsSpan = document.getElementById("unreadNotifs");

	// Theme defaults
	const defaultTheme = {
		mode: "dark",
		accentPrimary: "#4b5563",
		accentSecondary: "#6b7280",
		bgColor: "#111827",
		textColor: "#e5e7eb",
	};

	// Theme Management Functions
	async function loadTheme() {
		try {
			const result = await browser.storage.local.get("themeSettings");
			const theme = result.themeSettings || defaultTheme;

			// Apply theme mode
			if (themeModeSelect) {
				themeModeSelect.value = theme.mode || "dark";
			}

			// Set color pickers and text inputs
			if (accentColorPicker && accentColorText) {
				accentColorPicker.value =
					theme.accentPrimary || defaultTheme.accentPrimary;
				accentColorText.value =
					theme.accentPrimary || defaultTheme.accentPrimary;
			}

			if (accentSecondaryPicker && accentSecondaryText) {
				accentSecondaryPicker.value =
					theme.accentSecondary || defaultTheme.accentSecondary;
				accentSecondaryText.value =
					theme.accentSecondary || defaultTheme.accentSecondary;
			}

			if (backgroundColorPicker && backgroundColorText) {
				backgroundColorPicker.value =
					theme.bgColor || defaultTheme.bgColor;
				backgroundColorText.value =
					theme.bgColor || defaultTheme.bgColor;
			}

			if (textColorPicker && textColorText) {
				textColorPicker.value =
					theme.textColor || defaultTheme.textColor;
				textColorText.value = theme.textColor || defaultTheme.textColor;
			}

			// Apply theme to UI
			applyTheme(theme);
		} catch (error) {
			debugError("Error loading theme:", error);
			applyTheme(defaultTheme);
		}
	}

	function applyTheme(theme) {
		const root = document.documentElement;

		const toRGBA = (hex, alpha = 0.8) => {
			if (!/^#([0-9A-Fa-f]{6})$/.test(hex || "")) return null;
			const r = parseInt(hex.slice(1, 3), 16);
			const g = parseInt(hex.slice(3, 5), 16);
			const b = parseInt(hex.slice(5, 7), 16);
			return `rgba(${r}, ${g}, ${b}, ${alpha})`;
		};

		// Apply theme mode
		if (theme.mode === "light") {
			root.setAttribute("data-theme", "light");
		} else if (theme.mode === "auto") {
			// Use system preference
			const prefersDark = window.matchMedia(
				"(prefers-color-scheme: dark)",
			).matches;
			root.setAttribute("data-theme", prefersDark ? "dark" : "light");
		} else {
			root.removeAttribute("data-theme"); // Default to dark
		}

		const primaryText = theme.textColor || defaultTheme.textColor;
		const secondaryText = toRGBA(primaryText, 0.78) || primaryText;

		// Apply custom colors
		root.style.setProperty("--accent-primary", theme.accentPrimary);
		root.style.setProperty("--accent-secondary", theme.accentSecondary);
		root.style.setProperty("--container-bg", theme.bgColor);
		root.style.setProperty("--text-primary", primaryText);
		root.style.setProperty("--text-secondary", secondaryText);
		root.style.setProperty("--text-muted", secondaryText);
	}

	async function saveTheme() {
		try {
			const theme = {
				mode: themeModeSelect?.value || "dark",
				accentPrimary:
					accentColorPicker?.value || defaultTheme.accentPrimary,
				accentSecondary:
					accentSecondaryPicker?.value ||
					defaultTheme.accentSecondary,
				bgColor: backgroundColorPicker?.value || defaultTheme.bgColor,
				textColor: textColorPicker?.value || defaultTheme.textColor,
			};

			await browser.storage.local.set({ themeSettings: theme });
			applyTheme(theme);
			showStatus("Theme saved successfully!", "success");
		} catch (error) {
			debugError("Error saving theme:", error);
			showStatus("Failed to save theme", "error");
		}
	}

	async function resetTheme() {
		try {
			await browser.storage.local.set({ themeSettings: defaultTheme });

			// Reset UI controls
			if (themeModeSelect) themeModeSelect.value = defaultTheme.mode;
			if (accentColorPicker)
				accentColorPicker.value = defaultTheme.accentPrimary;
			if (accentColorText)
				accentColorText.value = defaultTheme.accentPrimary;
			if (accentSecondaryPicker)
				accentSecondaryPicker.value = defaultTheme.accentSecondary;
			if (accentSecondaryText)
				accentSecondaryText.value = defaultTheme.accentSecondary;
			if (backgroundColorPicker)
				backgroundColorPicker.value = defaultTheme.bgColor;
			if (backgroundColorText)
				backgroundColorText.value = defaultTheme.bgColor;
			if (textColorPicker) textColorPicker.value = defaultTheme.textColor;
			if (textColorText) textColorText.value = defaultTheme.textColor;

			applyTheme(defaultTheme);
			showStatus("Theme reset to default", "success");
		} catch (error) {
			debugError("Error resetting theme:", error);
			showStatus("Failed to reset theme", "error");
		}
	}

	// Sync color picker and text input
	function syncColorInputs(picker, text) {
		if (picker && text) {
			picker.addEventListener("input", () => {
				text.value = picker.value;
			});
			text.addEventListener("input", () => {
				if (/^#[0-9A-Fa-f]{6}$/.test(text.value)) {
					picker.value = text.value;
				}
			});
		}
	}

	// Initialize theme controls (color pickers removed from popup HTML - managed in library settings)
	// syncColorInputs calls removed - accentColorPicker etc. no longer exist in popup

	// Theme mode select (still in popup HTML)
	const themeModeSelect = document.getElementById("themeMode");
	if (themeModeSelect) {
		themeModeSelect.addEventListener("change", () => {
			const theme = {
				mode: themeModeSelect.value,
				accentPrimary: defaultTheme.accentPrimary,
				accentSecondary: defaultTheme.accentSecondary,
				bgColor: defaultTheme.bgColor,
				textColor: defaultTheme.textColor,
			};
			applyTheme(theme);
		});
	}

	// Load theme on startup
	loadTheme();

	// Load backup checkbox settings on startup
	loadBackupCheckboxSettings();

	// Load site toggle settings on startup
	loadSiteToggleSettings();

	// Site toggle helpers
	async function loadSiteToggleSettings() {
		const depsOk = await ensureLibraryDeps();
		if (!depsOk) {
			siteSettings = {};
			return;
		}
		try {
			siteSettings = await siteSettingsApi.getSiteSettings();
		} catch (error) {
			debugError("Failed to load site settings:", error);
			siteSettings = siteSettingsApi.getDefaultSiteSettings();
		}
		renderSiteToggles();
	}

	async function persistSiteToggleSettings() {
		if (!siteToggleList) return siteSettings;
		const updates = {};
		const defaults = siteSettingsApi?.getDefaultSiteSettings?.() || {};
		const rows = siteToggleList.querySelectorAll(".site-toggle-row");
		rows.forEach((row) => {
			const siteId = row.dataset.siteId;
			const enabledToggle = row.querySelector(
				"input[data-setting='enabled']",
			);
			const autoAddToggle = row.querySelector(
				"input[data-setting='autoAddEnabled']",
			);
			const autoAddStatusChapter = row.querySelector(
				"select[data-setting='autoAddStatusChapter']",
			);
			const autoAddStatusNovel = row.querySelector(
				"select[data-setting='autoAddStatusNovel']",
			);
			const def = defaults[siteId] || {};
			if (siteId) {
				updates[siteId] = {
					enabled: enabledToggle
						? enabledToggle.checked
						: def.enabled !== false,
					autoAddEnabled: autoAddToggle
						? autoAddToggle.checked
						: def.autoAddEnabled !== false,
					autoAddStatusChapter:
						autoAddStatusChapter?.value ||
						def.autoAddStatusChapter ||
						"reading",
					autoAddStatusNovel:
						autoAddStatusNovel?.value ||
						def.autoAddStatusNovel ||
						"plan-to-read",
				};
			}
		});

		if (Object.keys(updates).length === 0) return siteSettings;
		if (!siteSettingsApi) return siteSettings;
		siteSettings = await siteSettingsApi.saveSiteSettings(updates);
		return siteSettings;
	}

	// Backup Options Checkbox Persistence
	async function loadBackupCheckboxSettings() {
		try {
			const result = await browser.storage.local.get(
				"backupCheckboxSettings",
			);
			const settings = result.backupCheckboxSettings || {
				includeApiKeys: true,
				includeCredentials: true,
			};

			if (backupIncludeApiKeys) {
				backupIncludeApiKeys.checked = settings.includeApiKeys;
			}
			if (backupIncludeCredentials) {
				backupIncludeCredentials.checked = settings.includeCredentials;
			}

			debugLog("Loaded backup checkbox settings:", settings);
		} catch (error) {
			debugError("Failed to load backup checkbox settings:", error);
		}
	}

	async function saveBackupCheckboxSettings() {
		try {
			const settings = {
				includeApiKeys: backupIncludeApiKeys?.checked ?? true,
				includeCredentials: backupIncludeCredentials?.checked ?? false,
			};

			await browser.storage.local.set({
				backupCheckboxSettings: settings,
			});

			debugLog("Saved backup checkbox settings:", settings);
		} catch (error) {
			debugError("Failed to save backup checkbox settings:", error);
		}
	}

	// Add change event listeners to backup checkboxes
	if (backupIncludeApiKeys) {
		backupIncludeApiKeys.addEventListener(
			"change",
			saveBackupCheckboxSettings,
		);
	}
	if (backupIncludeCredentials) {
		backupIncludeCredentials.addEventListener(
			"change",
			saveBackupCheckboxSettings,
		);
	}

	const AUTO_ADD_STATUS_OPTIONS = [
		{ value: "reading", label: "📖 Reading" },
		{ value: "plan-to-read", label: "📋 Plan to Read" },
		{ value: "up-to-date", label: "✨ Up to Date" },
		{ value: "completed", label: "✅ Completed" },
		{ value: "on-hold", label: "⏸️ On Hold" },
		{ value: "dropped", label: "❌ Dropped" },
		{ value: "re-reading", label: "🔁 Re-reading" },
	];

	function renderSiteToggles() {
		if (!siteToggleList) return;
		if (!siteSettingsApi || !Object.keys(SHELVES).length) return;
		const defaults = siteSettingsApi.getDefaultSiteSettings();
		const shelves = Object.values(SHELVES).sort((a, b) =>
			(a.name || a.id).localeCompare(b.name || b.id),
		);

		siteToggleList.innerHTML = "";

		shelves.forEach((shelf) => {
			const setting = siteSettings[shelf.id] ||
				defaults[shelf.id] || {
					enabled: true,
					autoAddEnabled: true,
					autoAddStatusChapter: "reading",
					autoAddStatusNovel: "plan-to-read",
				};
			const row = document.createElement("div");
			row.className = "site-toggle-row";
			row.dataset.siteId = shelf.id;

			const iconHtml = shelf.icon?.startsWith("http")
				? `<img src="${shelf.icon}" alt="${shelf.name}" onerror="this.remove()">`
				: shelf.emoji || "📖";
			const domainsPreview = (shelf.domains || []).slice(0, 2).join(", ");
			const autoAddStatusChapter =
				setting.autoAddStatusChapter || "reading";
			const autoAddStatusNovel =
				setting.autoAddStatusNovel || "plan-to-read";
			const buildOptions = (selected) =>
				AUTO_ADD_STATUS_OPTIONS.map(
					(opt) =>
						`<option value="${opt.value}" ${
							opt.value === selected ? "selected" : ""
						}>${opt.label}</option>`,
				).join("");

			row.innerHTML = `
				<div class="site-toggle-meta">
					<span class="site-toggle-icon">${iconHtml}</span>
					<div>
						<div class="site-toggle-name">${shelf.name || shelf.id}</div>
						<div class="site-toggle-domains">${domainsPreview}</div>
					</div>
				</div>
				<div class="site-toggle-controls">
					<div class="site-toggle-control">
						<span class="site-toggle-label">Enabled</span>
						<label class="toggle-switch toggle-switch-sm">
							<input type="checkbox" data-setting="enabled" ${
								setting.enabled !== false ? "checked" : ""
							} aria-label="Enable ${shelf.name || shelf.id}">
							<span class="toggle-slider"></span>
						</label>
					</div>
					<div class="site-toggle-control">
						<span class="site-toggle-label">Auto-add</span>
						<label class="toggle-switch toggle-switch-sm">
							<input type="checkbox" data-setting="autoAddEnabled" ${
								setting.autoAddEnabled !== false
									? "checked"
									: ""
							} aria-label="Auto add ${shelf.name || shelf.id}">
							<span class="toggle-slider"></span>
						</label>
					</div>
					<div class="site-autoadd-selects">
						<label>
							<span>On chapter</span>
							<select data-setting="autoAddStatusChapter">
								${buildOptions(autoAddStatusChapter)}
							</select>
						</label>
						<label>
							<span>On novel</span>
							<select data-setting="autoAddStatusNovel">
								${buildOptions(autoAddStatusNovel)}
							</select>
						</label>
					</div>
				</div>
			`;

			const handleSettingChange = async () => {
				await persistSiteToggleSettings();
				showStatus(
					`Updated auto-add settings for ${shelf.name || shelf.id}`,
					"success",
				);
				const activeTab = document.querySelector(".tab-content.active");
				if (activeTab && activeTab.id === "library") {
					await initializeLibraryTab();
				}
			};

			row.querySelectorAll("input, select").forEach((control) => {
				control.addEventListener("change", handleSettingChange);
			});

			siteToggleList.appendChild(row);
		});
	}

	// Backup API Keys Management
	let backupApiKeys = [];

	function renderBackupKeys() {
		if (!backupKeysListContainer) return;

		backupKeysListContainer.innerHTML = "";

		if (backupApiKeys.length === 0) {
			backupKeysListContainer.innerHTML =
				'<div class="description" style="padding: 8px; text-align: center;">No backup keys added yet</div>';
			return;
		}

		backupApiKeys.forEach((key, index) => {
			const keyItem = document.createElement("div");
			keyItem.className = "backup-key-item";
			const keyPreview =
				key.substring(0, 8) + "..." + key.substring(key.length - 4);
			keyItem.innerHTML = `
				<span class="key-label">Key ${index + 1}</span>
				<span class="key-preview">${keyPreview}</span>
				<button class="remove-key-btn" data-index="${index}">✕</button>
			`;
			backupKeysListContainer.appendChild(keyItem);
		});

		// Add event listeners for remove buttons
		backupKeysListContainer
			.querySelectorAll(".remove-key-btn")
			.forEach((btn) => {
				btn.addEventListener("click", async (e) => {
					const index = parseInt(e.target.dataset.index);
					backupApiKeys.splice(index, 1);
					await browser.storage.local.set({
						backupApiKeys: backupApiKeys,
					});
					renderBackupKeys();
					showStatus("Backup key removed", "success");
				});
			});
	}

	// Add backup key handler
	if (addBackupKeyBtn && newBackupKeyInput) {
		addBackupKeyBtn.addEventListener("click", async () => {
			const newKey = newBackupKeyInput.value.trim();
			if (!newKey) {
				showStatus("Please enter a valid API key", "error");
				return;
			}

			if (backupApiKeys.includes(newKey)) {
				showStatus("This key is already added", "error");
				return;
			}

			backupApiKeys.push(newKey);
			await browser.storage.local.set({ backupApiKeys: backupApiKeys });
			newBackupKeyInput.value = "";
			renderBackupKeys();
			showStatus("Backup key added successfully", "success");
		});
	}

	// API Key Rotation handler
	if (apiKeyRotationSelect) {
		apiKeyRotationSelect.addEventListener("change", async () => {
			await browser.storage.local.set({
				apiKeyRotation: apiKeyRotationSelect.value,
			});
			showStatus("Key rotation strategy saved", "success");
		});
	}

	// Initialize sliders
	if (temperatureSlider && temperatureValue) {
		temperatureSlider.addEventListener("input", () => {
			temperatureValue.textContent = temperatureSlider.value;
		});
	}

	if (topPSlider && topPValue) {
		topPSlider.addEventListener("input", () => {
			topPValue.textContent = topPSlider.value;
		});
	}

	if (topKSlider && topKValue) {
		topKSlider.addEventListener("input", () => {
			topKValue.textContent = topKSlider.value;
		});
	}

	// Initialize font size slider
	if (fontSizeSlider && fontSizeValue) {
		fontSizeSlider.addEventListener("input", () => {
			fontSizeValue.textContent = fontSizeSlider.value + "%";
		});
	}

	// Toggle advanced parameters section
	if (toggleAdvancedParamsBtn && advancedParamsContent) {
		toggleAdvancedParamsBtn.addEventListener("click", () => {
			toggleAdvancedParamsBtn.classList.toggle("active");
			advancedParamsContent.classList.toggle("active");
		});
	}

	// Enable resizing of the popup
	setupResizing();

	// Function to fetch available Gemini models
	async function fetchAvailableModels(apiKey) {
		if (!apiKey) {
			console.warn("fetchAvailableModels called without apiKey");
			return null;
		}

		try {
			debugLog("Fetching models from Gemini API...");
			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
			);

			debugLog("API response status:", response.status);

			if (!response.ok) {
				const errorText = await response.text();
				debugError("API error response:", errorText);
				throw new Error(`HTTP error ${response.status}: ${errorText}`);
			}

			const data = await response.json();
			debugLog("API returned data:", data);

			// Filter for Gemini models that support text generation
			const geminiModels = data.models
				.filter(
					(model) =>
						model.name.includes("gemini") &&
						model.supportedGenerationMethods &&
						model.supportedGenerationMethods.includes(
							"generateContent",
						),
				)
				.map((model) => {
					// Extract the model name from the full path
					const id = model.name.split("/").pop();
					return {
						id: id,
						displayName: formatModelName(id),
						endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`,
					};
				});

			debugLog("Filtered Gemini models:", geminiModels);
			return geminiModels;
		} catch (error) {
			debugError("Error fetching models:", error);
			return null;
		}
	}

	// Format model name for display
	function formatModelName(modelId) {
		// Convert model IDs like "gemini-2.5-flash" to "Gemini 2.5 Flash"
		return modelId
			.replace("gemini-", "Gemini ")
			.replace(/-/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	// Update model selector with available models
	async function updateModelSelector(apiKey) {
		try {
			debugLog(
				"updateModelSelector called with apiKey:",
				apiKey ? "present" : "missing",
			);

			// Show loading state
			modelSelect.innerHTML =
				'<option value="">Loading models...</option>';
			modelSelect.disabled = true;

			// Fetch models
			debugLog("Fetching available models...");
			const models = await fetchAvailableModels(apiKey);
			debugLog("Fetched models:", models);

			if (!models || models.length === 0) {
				console.warn("No models fetched or empty list");
				modelSelect.innerHTML =
					'<option value="">No models available</option>';
				return;
			}

			// Get current selection if any
			const currentSettings = await browser.storage.local.get([
				"selectedModelId",
				"modelEndpoint",
			]);
			let selectedModelId = currentSettings.selectedModelId || "";

			// Sort models with Gemini 2.0 models first, then 1.5, then others
			models.sort((a, b) => {
				if (a.id.includes("2.0") && !b.id.includes("2.0")) return -1;
				if (!a.id.includes("2.0") && b.id.includes("2.0")) return 1;
				if (a.id.includes("1.5") && !b.id.includes("1.5")) return -1;
				if (!a.id.includes("1.5") && b.id.includes("1.5")) return 1;
				return a.displayName.localeCompare(b.displayName);
			});

			// Clear and populate the select
			modelSelect.innerHTML = "";

			models.forEach((model) => {
				const option = document.createElement("option");
				option.value = model.id;
				option.textContent = model.displayName;

				// If there's no selection yet, prefer gemini-2.0-flash as default
				if (!selectedModelId && model.id === "gemini-2.0-flash") {
					selectedModelId = model.id;
				}

				modelSelect.appendChild(option);
			});

			// Set selection based on previous setting or default
			if (selectedModelId) {
				modelSelect.value = selectedModelId;
			} else if (currentSettings.modelEndpoint) {
				// Try to match from endpoint if no direct ID
				const modelId = currentSettings.modelEndpoint
					.split("/")
					.pop()
					.split(":")[0];
				if (
					modelId &&
					modelSelect.querySelector(`option[value="${modelId}"]`)
				) {
					modelSelect.value = modelId;
				} else {
					// Default to first option if no match found
					modelSelect.selectedIndex = 0;
				}
			} else {
				// Default to first option if no previous selection
				modelSelect.selectedIndex = 0;
			}

			// Save the available models for later use
			await browser.storage.local.set({
				availableModels: models,
				selectedModelId: modelSelect.value,
				modelsLastFetched: Date.now(),
			});

			debugLog(
				"Model selector updated with",
				models.length,
				"models. Selected:",
				modelSelect.value,
			);
		} catch (error) {
			debugError("Error updating model selector:", error);
			modelSelect.innerHTML =
				'<option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option><option value="gemini-2.5-flash">Gemini 2.5 Flash</option><option value="gemini-2.5-pro">Gemini 2.5 Pro</option>';
		} finally {
			modelSelect.disabled = false;
		}
	}

	// Make textareas automatically resize to fit content
	const textareas = document.querySelectorAll("textarea");
	textareas.forEach((textarea) => {
		function adjustHeight() {
			textarea.style.height = "auto";
			textarea.style.height = textarea.scrollHeight + "px";
		}
		adjustHeight();
		textarea.addEventListener("input", adjustHeight);
		textarea.addEventListener("focus", adjustHeight);
	});

	// First ping the background script to ensure it's running
	try {
		debugLog("Pinging background script...");
		const pingResponse = await browser.runtime.sendMessage({
			action: "ping",
		});
		debugLog("Background script response:", pingResponse);

		if (pingResponse && pingResponse.success) {
			debugLog("Background script is active");
		}
	} catch (error) {
		// Soft-fail: service worker may be asleep—log and continue without alarming the user
		console.warn("Background script not reachable yet:", error?.message);
	}

	// Load settings from storage
	try {
		const debugPref = await browser.storage.local.get("debugMode");
		if (typeof debugPref.debugMode !== "boolean") {
			await browser.storage.local.set({ debugMode: DEFAULT_DEBUG_MODE });
		}

		const data = await browser.storage.local.get();

		if (data.apiKey && apiKeyInput && !apiKeyInput.value) {
			apiKeyInput.value = data.apiKey;

			// If we have an API key, load available models
			await updateModelSelector(data.apiKey);
		} else {
			// No API key, use static default options
			modelSelect.innerHTML = `
				<option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option>
				<option value="gemini-2.5-flash">Gemini 2.5 Flash (Faster)</option>
				<option value="gemini-2.5-pro">Gemini 2.5 Pro (Better quality)</option>
			`;
		}

		// Always set the prompt template - this fixes the empty box issue
		if (promptTemplate && !promptTemplate.value) {
			promptTemplate.value = data.defaultPrompt || DEFAULT_PROMPT;
		}

		// Load summary prompt
		if (summaryPrompt && !summaryPrompt.value) {
			summaryPrompt.value = data.summaryPrompt || DEFAULT_SUMMARY_PROMPT;
		}

		// Load short summary prompt
		if (shortSummaryPrompt && !shortSummaryPrompt.value) {
			shortSummaryPrompt.value =
				data.shortSummaryPrompt || DEFAULT_SHORT_SUMMARY_PROMPT;
		}

		// Load permanent prompt
		if (permanentPrompt && !permanentPrompt.value) {
			permanentPrompt.value =
				data.permanentPrompt || DEFAULT_PERMANENT_PROMPT;
		}

		// Set model selection based on saved endpoint
		if (data.modelEndpoint) {
			if (data.modelEndpoint.includes("gemini-2.0-flash")) {
				modelSelect.value = "gemini-2.0-flash";
			} else if (data.modelEndpoint.includes("gemini-2.5-pro")) {
				modelSelect.value = "gemini-2.5-pro";
			} else if (data.modelEndpoint.includes("gemini-2.5-flash")) {
				modelSelect.value = "gemini-2.5-flash";
			} else {
				// Default to gemini-2.0-flash if endpoint doesn't match any known model
				modelSelect.value = "gemini-2.0-flash";
			}
		} else {
			// Default to gemini-2.0-flash if no endpoint is specified
			modelSelect.value = "gemini-2.0-flash";
		}

		// Chunking controls
		if (chunkingEnabledInput) {
			chunkingEnabledInput.checked = data.chunkingEnabled !== false;
		}
		if (chunkSizeInput) {
			chunkSizeInput.value = data.chunkSize || 20000;
		}

		if (formatGameStatsInput) {
			formatGameStatsInput.checked = data.formatGameStats !== false; // default true
		}

		if (centerSceneHeadingsInput) {
			centerSceneHeadingsInput.checked =
				data.centerSceneHeadings !== false; // default true
		}

		if (driveClientIdInput) {
			driveClientIdInput.value =
				data.driveClientId || DEFAULT_DRIVE_CLIENT_ID || "";
		}
		if (driveClientSecretInput) {
			driveClientSecretInput.value = data.driveClientSecret || "";
		}
		if (driveFolderIdInput) {
			driveFolderIdInput.value = data.driveFolderId || "";
		}

		// Set debug mode checkbox (respect default when unset)
		if (debugModeCheckbox) {
			debugModeCheckbox.checked =
				typeof data.debugMode === "boolean"
					? data.debugMode
					: DEFAULT_DEBUG_MODE;
		}

		// Set emoji checkbox state
		const useEmojiCheckbox = document.getElementById("useEmoji");
		if (useEmojiCheckbox) {
			useEmojiCheckbox.checked = data.useEmoji || false; // Default to false
		}

		// Set temperature slider
		if (temperatureSlider && temperatureValue) {
			const temp =
				data.temperature !== undefined ? data.temperature : 0.7;
			temperatureSlider.value = temp;
			temperatureValue.textContent = temp;
		}

		// Set top-p slider
		if (topPSlider && topPValue) {
			const topP = data.topP !== undefined ? data.topP : 0.95;
			topPSlider.value = topP;
			topPValue.textContent = topP;
		}

		// Set top-k slider
		if (topKSlider && topKValue) {
			const topK = data.topK !== undefined ? data.topK : 40;
			topKSlider.value = topK;
			topKValue.textContent = topK;
		}

		// Set font size slider
		if (fontSizeSlider && fontSizeValue) {
			const fontSize = data.fontSize !== undefined ? data.fontSize : 100;
			fontSizeSlider.value = fontSize;
			fontSizeValue.textContent = fontSize + "%";
		}

		// Set custom endpoint
		if (customEndpointInput) {
			customEndpointInput.value = data.customEndpoint || "";
		}

		// Load backup API keys
		backupApiKeys = data.backupApiKeys || [];
		renderBackupKeys();

		// Load backup preferences
		const backupFolder = data.backupFolder || "RanobeGeminiBackups";
		if (backupFolderInput) backupFolderInput.value = backupFolder;
		if (autoBackupCheckbox)
			autoBackupCheckbox.checked = data.autoBackupEnabled || false;
		const backupMode = data.backupMode || "scheduled";
		backupHistory = data.backupHistory || [];
		renderBackupHistory();

		// Set API key rotation strategy
		if (apiKeyRotationSelect) {
			apiKeyRotationSelect.value = data.apiKeyRotation || "failover";
		}

		// Update model endpoint display
		await updateModelEndpointDisplay();
	} catch (error) {
		debugError("Error loading settings:", error);
		// If settings fail to load, at least set the default prompt
		if (promptTemplate && !promptTemplate.value) {
			promptTemplate.value = DEFAULT_PROMPT;
		}
		// Set default summary prompt on error
		if (summaryPrompt && !summaryPrompt.value) {
			summaryPrompt.value = DEFAULT_SUMMARY_PROMPT;
		}
		// Set default permanent prompt on error
		if (permanentPrompt && !permanentPrompt.value) {
			permanentPrompt.value = DEFAULT_PERMANENT_PROMPT;
		}
	}

	// Save individual API key and refresh models
	saveApiKeyBtn.addEventListener("click", async () => {
		const apiKey = apiKeyInput.value.trim();

		if (!apiKey) {
			showStatus("Please enter a valid API key", "error");
			return;
		}

		try {
			debugLog("Saving API key...");
			await browser.storage.local.set({ apiKey });
			debugLog("API key saved, updating model selector...");
			showStatus("API key saved successfully!", "success");

			// Refresh model list with new API key
			await updateModelSelector(apiKey);
			debugLog("Model selector updated successfully");
		} catch (error) {
			debugError("Error saving API key:", error);
			showStatus("Error saving API key: " + error.message, "error");
		}
	});

	// Test API key and update models list
	testApiKeyBtn.addEventListener("click", async () => {
		const apiKey = apiKeyInput.value.trim();

		if (!apiKey) {
			showStatus("Please enter an API key to test", "error");
			return;
		}

		try {
			showStatus("Testing API key and fetching models...", "info");
			testApiKeyBtn.disabled = true;

			// Fetch models first to validate API key
			const models = await fetchAvailableModels(apiKey);

			if (models && models.length > 0) {
				// Update model dropdown
				await updateModelSelector(apiKey);

				// Auto-save the API key if valid
				await browser.storage.local.set({ apiKey });

				showStatus("API key is valid! Models loaded ✓", "success");
			} else {
				showStatus(
					"API key appears invalid or no models available",
					"error",
				);
			}
		} catch (error) {
			debugError("API key test error:", error);
			showStatus(`Error testing API key: ${error.message}`, "error");
		} finally {
			testApiKeyBtn.disabled = false;
		}
	});

	// Save all basic settings
	saveSettingsBtn.addEventListener("click", async () => {
		const apiKey = apiKeyInput.value.trim();
		const selectedModelId = modelSelect.value;
		const useEmojiCheckbox = document.getElementById("useEmoji");
		const stored = await browser.storage.local.get("maxOutputTokens");
		const maxTokens = stored?.maxOutputTokens || 8192;
		const temperature = temperatureSlider
			? parseFloat(temperatureSlider.value)
			: 0.7;

		if (!apiKey) {
			showStatus("Please enter a valid API key", "error");
			return;
		}

		try {
			// Determine model endpoint based on selection
			let modelEndpoint;

			// Try to find the model endpoint from stored available models
			const storedData =
				await browser.storage.local.get("availableModels");
			if (storedData.availableModels) {
				const selectedModel = storedData.availableModels.find(
					(m) => m.id === selectedModelId,
				);
				if (selectedModel) {
					modelEndpoint = selectedModel.endpoint;
				}
			}

			// Fallback to constructing the endpoint if not found
			if (!modelEndpoint) {
				modelEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModelId}:generateContent`;
			}

			const updates = {
				apiKey: apiKey,
				selectedModelId: selectedModelId,
				modelEndpoint: modelEndpoint,
				debugMode: debugModeCheckbox?.checked ?? false,
				useEmoji: useEmojiCheckbox ? useEmojiCheckbox.checked : false,
				formatGameStats: formatGameStatsInput?.checked !== false,
				centerSceneHeadings:
					centerSceneHeadingsInput?.checked !== false,
				maxOutputTokens: maxTokens,
				temperature: temperature,
			};

			if (chunkingEnabledInput) {
				updates.chunkingEnabled =
					chunkingEnabledInput.checked !== false;
			}

			if (chunkSizeInput) {
				updates.chunkSize = Math.min(
					Math.max(parseInt(chunkSizeInput.value, 10) || 20000, 5000),
					50000,
				);
			}

			await browser.storage.local.set(updates);

			showStatus("Basic settings saved successfully!", "success");
		} catch (error) {
			debugError("Error saving settings:", error);
			showStatus("Error saving settings: " + error.message, "error");
		}
	});

	// Save advanced settings
	if (saveAdvancedSettingsBtn) {
		saveAdvancedSettingsBtn.addEventListener("click", async () => {
			try {
				const topP = parseFloat(topPSlider.value);
				const topK = parseInt(topKSlider.value, 10);
				const customEndpoint = customEndpointInput.value.trim();
				const fontSize = fontSizeSlider
					? parseInt(fontSizeSlider.value, 10)
					: 100;

				await browser.storage.local.set({
					defaultPrompt: promptTemplate.value,
					summaryPrompt: summaryPrompt.value,
					permanentPrompt: permanentPrompt.value,
					topP: topP,
					topK: topK,
					customEndpoint: customEndpoint,
					fontSize: fontSize,
				});

				await persistSiteToggleSettings();
				showStatus("Advanced settings saved successfully!", "success");
			} catch (error) {
				debugError("Error saving advanced settings:", error);
				showStatus(
					"Error saving advanced settings: " + error.message,
					"error",
				);
			}
		});
	}

	// Reset all advanced settings
	if (resetAllAdvancedBtn) {
		resetAllAdvancedBtn.addEventListener("click", async () => {
			try {
				// Reset prompts
				promptTemplate.value = DEFAULT_PROMPT;
				summaryPrompt.value = DEFAULT_SUMMARY_PROMPT;
				permanentPrompt.value = DEFAULT_PERMANENT_PROMPT;

				// Reset sliders
				if (topPSlider && topPValue) {
					topPSlider.value = 0.95;
					topPValue.textContent = "0.95";
				}

				if (topKSlider && topKValue) {
					topKSlider.value = 40;
					topKValue.textContent = "40";
				}

				if (fontSizeSlider && fontSizeValue) {
					fontSizeSlider.value = 100;
					fontSizeValue.textContent = "100%";
				}

				if (customEndpointInput) {
					customEndpointInput.value = "";
				}

				if (siteToggleList) {
					const depsOk = await ensureLibraryDeps();
					if (depsOk && siteSettingsApi) {
						siteSettings = await siteSettingsApi.saveSiteSettings(
							siteSettingsApi.getDefaultSiteSettings(),
						);
						renderSiteToggles();
					}
				}

				// Save the reset values
				await browser.storage.local.set({
					defaultPrompt: DEFAULT_PROMPT,
					summaryPrompt: DEFAULT_SUMMARY_PROMPT,
					permanentPrompt: DEFAULT_PERMANENT_PROMPT,
					topP: 0.95,
					topK: 40,
					customEndpoint: "",
					fontSize: 100,
				});

				showStatus("Advanced settings reset to defaults", "info");
			} catch (error) {
				debugError("Error resetting advanced settings:", error);
				showStatus(
					"Error resetting settings: " + error.message,
					"error",
				);
			}
		});
	}

	if (resetSiteTogglesBtn) {
		resetSiteTogglesBtn.addEventListener("click", async () => {
			const depsOk = await ensureLibraryDeps();
			if (depsOk && siteSettingsApi) {
				siteSettings = await siteSettingsApi.saveSiteSettings(
					siteSettingsApi.getDefaultSiteSettings(),
				);
				renderSiteToggles();
				showStatus("Site toggles restored to defaults", "success");
			}
		});
	}

	if (resetPromptBtn && promptTemplate) {
		resetPromptBtn.addEventListener("click", () => {
			promptTemplate.value = DEFAULT_PROMPT;
			showStatus("Enhancement prompt reset to default", "info");
		});
	}

	if (resetSummaryPromptBtn && summaryPrompt) {
		resetSummaryPromptBtn.addEventListener("click", () => {
			summaryPrompt.value = DEFAULT_SUMMARY_PROMPT;
			showStatus("Summary prompt reset to default", "info");
		});
	}

	if (resetShortSummaryPromptBtn && shortSummaryPrompt) {
		resetShortSummaryPromptBtn.addEventListener("click", () => {
			shortSummaryPrompt.value = DEFAULT_SHORT_SUMMARY_PROMPT;
			showStatus("Short summary prompt reset to default", "info");
		});
	}

	if (resetPermanentPromptBtn && permanentPrompt) {
		resetPermanentPromptBtn.addEventListener("click", () => {
			permanentPrompt.value = DEFAULT_PERMANENT_PROMPT;
			showStatus("Permanent prompt reset to default", "info");
		});
	}

	// Full Prompt Preview functionality
	const fullPromptPreview = document.getElementById("fullPromptPreview");
	const refreshPromptPreviewBtn = document.getElementById(
		"refreshPromptPreview",
	);
	const copyFullPromptBtn = document.getElementById("copyFullPrompt");

	function generateFullPromptPreview() {
		if (!fullPromptPreview) return;

		const enhancementPrompt = promptTemplate?.value || DEFAULT_PROMPT;
		const permPrompt = permanentPrompt?.value || DEFAULT_PERMANENT_PROMPT;

		// Get site-specific prompts
		let sitePrompts = "";
		const sitePromptsContainer = document.getElementById(
			"siteSpecificPromptsContainer",
		);
		if (sitePromptsContainer) {
			const sitePromptItems =
				sitePromptsContainer.querySelectorAll(".site-prompt-item");
			sitePromptItems.forEach((item) => {
				const siteName = item.querySelector(".site-name")?.value;
				const sitePromptContent = item.querySelector(
					".site-prompt-content",
				)?.value;
				if (siteName && sitePromptContent) {
					sitePrompts += `\n--- ${siteName} ---\n${sitePromptContent}\n`;
				}
			});
		}

		// Build the full prompt preview
		let fullPrompt = "";
		fullPrompt += "=== SYSTEM INSTRUCTION ===\n\n";
		fullPrompt += enhancementPrompt;

		if (sitePrompts.trim()) {
			fullPrompt += "\n\n=== SITE-SPECIFIC CONTEXT ===\n";
			fullPrompt += sitePrompts;
		}

		if (permPrompt.trim()) {
			fullPrompt += "\n\n=== PERMANENT INSTRUCTIONS ===\n";
			fullPrompt += permPrompt;
		}

		fullPrompt += "\n\n=== TITLE ===\n";
		fullPrompt += "[Chapter title from page]";

		fullPrompt += "\n\n=== CONTENT TO ENHANCE ===\n";
		fullPrompt += "[Chapter content from page]";

		fullPromptPreview.textContent = fullPrompt;
	}

	if (refreshPromptPreviewBtn && fullPromptPreview) {
		refreshPromptPreviewBtn.addEventListener(
			"click",
			generateFullPromptPreview,
		);
	}

	if (copyFullPromptBtn && fullPromptPreview) {
		copyFullPromptBtn.addEventListener("click", async () => {
			generateFullPromptPreview();
			try {
				await navigator.clipboard.writeText(
					fullPromptPreview.textContent,
				);
				showStatus("Full prompt copied to clipboard!", "success");
			} catch (err) {
				debugError("Failed to copy:", err);
				showStatus("Failed to copy to clipboard", "error");
			}
		});
	}

	// Auto-generate preview when the details element is opened
	const promptPreviewSection = document.querySelector(
		".prompt-preview-section",
	);
	if (promptPreviewSection && fullPromptPreview) {
		promptPreviewSection.addEventListener("toggle", (e) => {
			if (e.target.open) {
				generateFullPromptPreview();
			}
		});
	}

	// Enhance current page (button removed from popup HTML - enhancement is done from content script)
	// enhancePageBtn handler removed

	// Open Google AI Studio link to get API key
	getKeyLink.addEventListener("click", (e) => {
		e.preventDefault();
		browser.tabs.create({
			url: "https://aistudio.google.com/app/api-keys",
		});
	});

	// Add refresh models button functionality
	const refreshModelsBtn = document.getElementById("refreshModels");
	if (refreshModelsBtn) {
		refreshModelsBtn.addEventListener("click", async () => {
			const apiKey = apiKeyInput.value.trim();
			if (!apiKey) {
				showStatus("Please enter an API key first", "error");
				return;
			}

			try {
				refreshModelsBtn.disabled = true;
				refreshModelsBtn.textContent = "⟳";
				await updateModelSelector(apiKey);
				showStatus("Models refreshed successfully", "success");
			} catch (error) {
				showStatus(
					"Error refreshing models: " + error.message,
					"error",
				);
			} finally {
				refreshModelsBtn.disabled = false;
				refreshModelsBtn.textContent = "↻";
			}
		});
	}

	// Add auto-refresh of models list when dropdown is clicked
	modelSelect.addEventListener("mousedown", async function (e) {
		// Only check if we haven't refreshed models recently
		const data = await browser.storage.local.get([
			"modelsLastFetched",
			"apiKey",
		]);
		const lastFetched = data.modelsLastFetched || 0;
		const now = Date.now();

		// Refresh models if it's been more than 1 hour since last fetch
		if (now - lastFetched > 3600000 && data.apiKey) {
			e.preventDefault(); // Prevent default dropdown behavior
			await updateModelSelector(data.apiKey);
			// Now allow the dropdown to open
			setTimeout(() => modelSelect.click(), 100);
		}
	});

	// Update model endpoint display when model selection changes
	modelSelect.addEventListener("change", updateModelEndpointDisplay);

	// Helper function to update model endpoint display
	async function updateModelEndpointDisplay() {
		if (!modelEndpointDisplay) return;

		const selectedModelId = modelSelect.value;
		if (!selectedModelId) {
			modelEndpointDisplay.value = "";
			return;
		}

		// Construct endpoint URL
		const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModelId}:generateContent`;
		modelEndpointDisplay.value = endpoint;
	}

	// Copy model endpoint to clipboard
	if (copyModelEndpoint) {
		copyModelEndpoint.addEventListener("click", async () => {
			const endpoint = modelEndpointDisplay.value;
			if (!endpoint) {
				showStatus("No endpoint to copy", "error");
				return;
			}

			try {
				await navigator.clipboard.writeText(endpoint);
				showStatus("Endpoint copied to clipboard!", "success");
			} catch (error) {
				debugError("Failed to copy endpoint:", error);
				showStatus("Failed to copy endpoint", "error");
			}
		});
	}

	// Helper function to show status messages
	async function showStatus(message, type, options = {}) {
		if (statusDiv) {
			statusDiv.textContent = message;
			statusDiv.className = type || "";
		}

		// Auto clear success messages after 3 seconds
		if (type === "success") {
			setTimeout(() => {
				if (statusDiv) {
					statusDiv.textContent = "";
					statusDiv.className = "";
				}
			}, 3000);
		}

		// Log to notification system
		try {
			const notificationType =
				type === "success"
					? NotificationType.SUCCESS
					: type === "error"
						? NotificationType.ERROR
						: type === "info"
							? NotificationType.INFO
							: type === "warning"
								? NotificationType.WARNING
								: NotificationType.INFO;

			// Get current tab URL if available
			let currentUrl = null;
			try {
				const tabs = await browser.tabs.query({
					active: true,
					currentWindow: true,
				});
				currentUrl = tabs[0]?.url || null;
			} catch (e) {
				// Ignore error getting tab URL
			}

			try {
				await browser.runtime.sendMessage({
					action: "logNotification",
					type: notificationType,
					message,
					url: currentUrl,
					source: "popup",
					...options,
				});
			} catch (_err) {
				await notificationManager.add({
					type: notificationType,
					message,
					url: currentUrl,
					source: "popup",
					...options,
				});
			}

			// Update notification badge
			updateNotificationBadge();
		} catch (error) {
			console.error("Failed to log notification:", error);
		}
	}

	// Novels Tab Functionality

	/**
	 * Format a date string as a relative time (e.g., "2 days ago")
	 * @param {string} dateStr - ISO date string
	 * @returns {string} - Formatted relative time
	 */
	function formatRelativeTime(dateStr) {
		const date = new Date(dateStr);
		const now = new Date();
		const diffTime = Math.abs(now - date);
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
		const diffMinutes = Math.floor(diffTime / (1000 * 60));

		if (diffDays > 30) {
			const months = Math.floor(diffDays / 30);
			return `${months} month${months > 1 ? "s" : ""} ago`;
		} else if (diffDays > 0) {
			return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
		} else if (diffHours > 0) {
			return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
		} else {
			return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
		}
	}

	/**
	 * Format a complete date
	 * @param {string} dateStr - ISO date string
	 * @returns {string} - Formatted date string
	 */
	function formatCompleteDate(dateStr) {
		const date = new Date(dateStr);
		return date.toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	/**
	 * Extract domain from URL
	 * @param {string} url - Full URL
	 * @returns {string} - Domain name
	 */
	function extractDomain(url) {
		try {
			const urlObj = new URL(url);
			return urlObj.hostname.replace("www.", "");
		} catch (e) {
			return "unknown";
		}
	}

	/**
	 * Display novels grouped by website
	 */
	async function displayNovelsByWebsite(allNovels, options = {}) {
		try {
			if (!novelsListContainer) {
				return;
			}
			if (allNovels.length === 0) {
				novelsListContainer.innerHTML =
					'<div class="no-novels">No novels in your library yet.</div>';
				return;
			}

			const novelsByShelf = new Map();
			allNovels.forEach((novel) => {
				if (!novel || !novel.shelfId) return;
				const shelf = Object.values(SHELVES).find(
					(s) => s.id === novel.shelfId,
				);
				if (shelf && !isSiteEnabledSafe(siteSettings, shelf.id)) {
					return;
				}
				if (!novelsByShelf.has(novel.shelfId)) {
					novelsByShelf.set(novel.shelfId, []);
				}
				novelsByShelf.get(novel.shelfId).push(novel);
			});

			const sortedShelves = Array.from(novelsByShelf.entries()).sort(
				(a, b) => {
					const latestA = Math.max(
						...a[1].map((n) => n.lastAccessedAt || 0),
					);
					const latestB = Math.max(
						...b[1].map((n) => n.lastAccessedAt || 0),
					);
					return latestB - latestA;
				},
			);

			novelsListContainer.innerHTML = "";
			sortedShelves.forEach(([shelfId, shelfNovels]) => {
				const sortedNovels = shelfNovels.sort(
					(a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0),
				);
				const section = createDomainSection(
					shelfId,
					sortedNovels,
					options,
				);
				novelsListContainer.appendChild(section);
			});

			attachLibraryListHandlers();
		} catch (error) {
			debugError("Error displaying novels by website:", error);
			if (novelsListContainer) {
				novelsListContainer.innerHTML =
					'<div class="no-novels">Failed to display novels.</div>';
			}
		}
	}

	function attachLibraryListHandlers() {
		document.querySelectorAll(".domain-toggle").forEach((toggle) => {
			toggle.addEventListener("click", function (e) {
				if (e.target.closest(".domain-expand-btn")) return;
				const section = this.closest(".domain-section");
				const novelsList = section.querySelector(".domain-novels");
				novelsList.classList.toggle("collapsed");
				const icon = this.querySelector(".toggle-icon");
				if (icon) {
					icon.textContent = novelsList.classList.contains(
						"collapsed",
					)
						? "▶"
						: "▼";
				}
			});
		});

		document.querySelectorAll(".domain-expand-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const section = btn.closest(".domain-section");
				const hiddenItems = section.querySelectorAll(".collapsed-item");
				const isExpanded = btn.dataset.expanded === "true";
				hiddenItems.forEach((item) => {
					item.style.display = isExpanded ? "none" : "block";
				});
				btn.dataset.expanded = isExpanded ? "false" : "true";
				btn.textContent = isExpanded ? "▶ Show all" : "▼ Show less";
			});
		});

		document.querySelectorAll(".novel-view-library-btn").forEach((btn) => {
			btn.addEventListener("click", async (e) => {
				e.preventDefault();
				const novelId = btn.dataset.novelId;
				const shelfId = btn.dataset.shelfId;
				await openNovelInLibrary(novelId, shelfId);
			});
		});
	}

	/**
	 * Load novels from storage and display them grouped by domain
	 */
	async function loadNovels() {
		showStatus("Loading novels...", "info");

		try {
			const depsOk = await ensureLibraryDeps();
			if (!depsOk) {
				showStatus("Novel history unavailable in popup", "error");
				return;
			}

			const library = await novelLibrary.getLibrary();
			const novels = library.novels || {};

			if (Object.keys(novels).length === 0) {
				novelsListContainer.innerHTML =
					'<div class="no-novels">No novels found in your reading history.</div>';
				showStatus("No novels found in your reading history.", "info");
				return;
			}

			// Clear the novels list
			novelsListContainer.innerHTML = "";

			await displayNovelsByWebsite(Object.values(novels), {
				collapsed: false,
				limitPerShelf: 0,
			});

			showStatus(
				`Loaded ${Object.keys(novels).length} novels from library.`,
				"success",
			);

			// Add event listeners for auto-enhance checkboxes
			document
				.querySelectorAll(".auto-enhance-checkbox")
				.forEach((checkbox) => {
					const novelId = checkbox.dataset.novelId;

					// Load saved state
					browser.storage.local
						.get(["autoEnhanceNovels"])
						.then((result) => {
							const autoEnhanceNovels =
								result.autoEnhanceNovels || [];
							checkbox.checked =
								autoEnhanceNovels.includes(novelId);
						});

					checkbox.addEventListener("change", async function () {
						const result = await browser.storage.local.get([
							"autoEnhanceNovels",
						]);
						let autoEnhanceNovels = result.autoEnhanceNovels || [];

						if (this.checked) {
							if (!autoEnhanceNovels.includes(novelId)) {
								autoEnhanceNovels.push(novelId);
							}
						} else {
							autoEnhanceNovels = autoEnhanceNovels.filter(
								(id) => id !== novelId,
							);
						}

						await browser.storage.local.set({ autoEnhanceNovels });
						debugLog(
							"Auto-enhance updated for:",
							novelId,
							this.checked,
						);
					});
				});
		} catch (error) {
			debugError("Error loading novels:", error);
			showStatus("Error loading novels. Please try again.", "error");
		}
	}

	/**
	 * Get shelf info by domain name
	 * @param {string} domain - Domain name (e.g., "www.fanfiction.net")
	 * @returns {Object|null} Shelf definition or null
	 */
	function getShelfByDomain(domain) {
		const normalizedDomain = domain.toLowerCase();
		for (const [key, shelf] of Object.entries(SHELVES)) {
			for (const shelfDomain of shelf.domains) {
				const normalizedShelfDomain = shelfDomain.toLowerCase();
				if (
					normalizedDomain === normalizedShelfDomain ||
					normalizedDomain === `www.${normalizedShelfDomain}` ||
					normalizedDomain.endsWith(`.${normalizedShelfDomain}`)
				) {
					return shelf;
				}
			}
		}
		return null;
	}

	/**
	 * Render a shelf/domain icon - supports emoji, URL strings
	 * @param {string|Object} icon - Icon value (emoji string, URL string, or {url, fallback})
	 * @param {string} className - Optional CSS class
	 * @returns {string} HTML string for the icon
	 */
	function renderDomainIcon(icon, className = "") {
		if (!icon) return `<span class="domain-icon ${className}">📖</span>`;

		// If icon is a simple string
		if (typeof icon === "string") {
			// Check if it's a URL (starts with http:// or https://)
			if (icon.startsWith("http://") || icon.startsWith("https://")) {
				return `<span class="domain-icon domain-icon-img ${className}">
					<img src="${escapeHtml(icon)}" alt=""
						onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
						style="width: 16px; height: 16px; vertical-align: middle;">
					<span class="icon-fallback" style="display: none;">📖</span>
				</span>`;
			}
			// It's an emoji
			return `<span class="domain-icon ${className}">${icon}</span>`;
		}

		// If icon is an object with url and fallback
		if (typeof icon === "object" && icon.url) {
			const fallback = icon.fallback || "📖";
			return `<span class="domain-icon domain-icon-img ${className}">
				<img src="${escapeHtml(icon.url)}" alt=""
					onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
					style="width: 16px; height: 16px; vertical-align: middle;">
				<span class="icon-fallback" style="display: none;">${fallback}</span>
			</span>`;
		}

		return `<span class="domain-icon ${className}">📖</span>`;
	}

	/**
	 * Create a shelf section element
	 * @param {string} shelfId - Shelf identifier
	 * @param {Array} novels - Array of novel objects
	 * @param {Object} options - Render options
	 * @returns {HTMLElement} - The shelf section element
	 */
	function createDomainSection(shelfId, novels, options = {}) {
		const section = document.createElement("div");
		section.className = "domain-section";

		const shelf = Object.values(SHELVES).find((s) => s.id === shelfId);
		const shelfIcon = shelf ? shelf.icon : "📖";
		const shelfName = shelf ? shelf.name : shelfId;
		const iconHtml = renderDomainIcon(shelfIcon);
		const limit = options.limitPerShelf || 0;

		const header = document.createElement("div");
		header.className = "domain-header domain-toggle";
		header.innerHTML = `
			<span class="toggle-icon">▼</span>
			${iconHtml}
			<span class="domain-name">${escapeHtml(shelfName)}</span>
			<span class="domain-count">${novels.length} ${
				novels.length === 1 ? "novel" : "novels"
			}</span>
		`;

		const novelsList = document.createElement("div");
		novelsList.className = "domain-novels";

		novels.forEach((novel, index) => {
			const novelItem = createNovelItem(novel);
			if (limit > 0 && index >= limit) {
				novelItem.classList.add("collapsed-item");
				novelItem.style.display = "none";
			}
			novelsList.appendChild(novelItem);
		});

		section.appendChild(header);
		section.appendChild(novelsList);

		return section;
	}

	/**
	 * Create a novel item element
	 * @param {string} novelId - Novel ID
	 * @param {Object} novel - Novel data
	 * @returns {HTMLElement} - The novel item element
	 */
	function createNovelItem(novel) {
		const novelItem = document.createElement("div");
		novelItem.className = "novel-item";
		novelItem.dataset.novelId = novel.id;
		novelItem.dataset.shelfId = novel.shelfId || "";

		const bookTitle = novel.title || novel.bookTitle || "Unknown Title";
		const author = novel.author || "Unknown Author";
		const lastAccessed = novel.lastAccessedAt
			? formatRelativeTime(new Date(novel.lastAccessedAt).toISOString())
			: "Unknown";
		const totalChapters = novel.totalChapters || novel.chapterCount || "?";
		const lastReadChapter =
			novel.lastReadChapter || novel.currentChapter || null;
		const readingStatus = novel.readingStatus || "Unknown";
		const sourceUrl = novel.sourceUrl || novel.mainNovelUrl || novel.url;

		const chips = [];
		if (readingStatus)
			chips.push(
				`<span class="chip chip-primary">${escapeHtml(readingStatus)}</span>`,
			);
		if (totalChapters)
			chips.push(
				`<span class="chip chip-info">${escapeHtml(String(totalChapters))} chapters</span>`,
			);
		if (lastReadChapter)
			chips.push(
				`<span class="chip chip-warning">Ch. ${escapeHtml(String(lastReadChapter))}</span>`,
			);

		const coverImg = novel.coverImage
			? `<img src="${escapeHtml(novel.coverImage)}" alt="${escapeHtml(bookTitle)}" class="novel-cover">`
			: '<div class="novel-cover-placeholder">📖</div>';

		novelItem.innerHTML = `
			<div class="novel-card-wrapper">
				<div class="novel-cover-section">
					${coverImg}
				</div>
				<div class="novel-content-section">
					<div class="novel-header">
						<div class="novel-title">${escapeHtml(bookTitle)}</div>
						<div class="novel-author">${escapeHtml(author)}</div>
					</div>
					<div class="novel-meta-info">
						<span class="meta-item">Last read: ${escapeHtml(lastAccessed)}</span>
						${lastReadChapter ? `<span class="meta-item">Ch. ${escapeHtml(String(lastReadChapter))}/${escapeHtml(String(totalChapters))}</span>` : ""}
					</div>
					<div class="novel-status-chips">
						<span class="chip-status">${escapeHtml(readingStatus)}</span>
						<span class="chip-chapters">${escapeHtml(String(totalChapters))} ch.</span>
					</div>
					<div class="novel-actions-compact">
						<button class="novel-view-library-btn" data-novel-id="${escapeHtml(
							novel.id,
						)}" data-shelf-id="${escapeHtml(novel.shelfId || "")}">
							View Details
						</button>
						${
							sourceUrl
								? `<a href="${escapeHtml(
										sourceUrl,
									)}" target="_blank" class="novel-continue-btn">Continue</a>`
								: ""
						}
					</div>
				</div>
			</div>
		`;

		return novelItem;
	}

	/**
	 * Create HTML for chapters list
	 * @param {Array} chapters - Array of chapter objects
	 * @param {string} novelUrl - Base URL of the novel
	 * @returns {string} - HTML string for chapters list
	 */
	function createChaptersListHtml(chapters, novelUrl) {
		// Sort chapters by read date (most recent first)
		const sortedChapters = [...chapters].sort((a, b) => {
			return new Date(b.date || 0) - new Date(a.date || 0);
		});
	}

	// Add event listener for quick library button in header
	const quickLibraryBtn = document.getElementById("quickLibraryBtn");
	if (quickLibraryBtn) {
		quickLibraryBtn.addEventListener("click", () => {
			browser.tabs.create({
				url: browser.runtime.getURL("library/library.html"),
			});
		});
	}

	// ============================================
	// LIBRARY TAB FUNCTIONS
	// ============================================

	/**
	 * Initialize the Library tab
	 */
	async function initializeLibraryTab() {
		// Show loading state
		if (libraryLoading) libraryLoading.style.display = "flex";

		try {
			const depsOk = await ensureLibraryDeps();
			if (!depsOk) {
				showStatus("Library data unavailable in popup", "error");
				return;
			}

			// Load current page info first (determines site-specific filtering)
			await loadCurrentPageInfo();

			// Then load library data
			await loadLibraryData();
		} catch (error) {
			debugError("Error initializing library tab:", error);
		} finally {
			// Hide loading state
			if (libraryLoading) libraryLoading.style.display = "none";
		}
	}

	// Helper: match hostname against wildcard pattern
	function matchDomainPattern(hostname, pattern) {
		const normalizedHost = hostname.toLowerCase();
		const normalizedPattern = pattern.toLowerCase();

		if (normalizedPattern.startsWith("*.")) {
			const base = normalizedPattern.substring(2);
			return (
				normalizedHost === base || normalizedHost.endsWith(`.${base}`)
			);
		}

		return normalizedHost === normalizedPattern;
	}

	// Helper: detect shelf from a URL
	function getShelfFromUrl(url) {
		try {
			const { hostname } = new URL(url);
			const shelf = Object.values(SHELVES).find((shelf) =>
				(shelf.domains || []).some((pattern) =>
					matchDomainPattern(hostname, pattern),
				),
			);
			if (shelf && !isSiteEnabledSafe(siteSettings, shelf.id)) {
				return null;
			}
			return shelf;
		} catch (e) {
			return null;
		}
	}

	/**
	 * Helper: get the current active tab
	 */
	async function getCurrentTab() {
		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		return tabs[0] || null;
	}

	/**
	 * Load and display current page novel information
	 */
	async function loadCurrentPageInfo() {
		// Reset state
		currentPageNovelData = null;
		currentSiteShelfId = null;

		// Reset UI
		if (currentNovelCard) currentNovelCard.style.display = "none";
		if (notSupportedMessage) notSupportedMessage.style.display = "none";
		if (pageStatusBadge) {
			pageStatusBadge.textContent = "Detecting...";
			pageStatusBadge.className = "status-badge";
		}

		try {
			const currentTab = await getCurrentTab();
			if (!currentTab) {
				showNotSupported("Could not determine current tab");
				return;
			}

			const shelfForTab = getShelfFromUrl(currentTab.url);
			const isExtensionPage = currentTab.url.startsWith(
				browser.runtime.getURL(""),
			);

			// If this is an extension page (library/popup), we don't attempt extraction
			if (isExtensionPage) {
				if (pageStatusBadge) {
					pageStatusBadge.textContent = "Extension page";
					pageStatusBadge.className = "status-badge site";
				}
				if (notSupportedMessage)
					notSupportedMessage.style.display = "none";
				return;
			}

			// Try to communicate with content script
			try {
				const response = await browser.tabs.sendMessage(currentTab.id, {
					action: "getNovelInfo",
				});

				debugLog("📚 Library: getNovelInfo response:", response);

				if (response && response.success && response.novelInfo) {
					currentPageNovelData = response.novelInfo;
					currentSiteShelfId = response.novelInfo.shelfId || null;
					displayCurrentPageNovel(response.novelInfo);
				} else if (response && !response.success && shelfForTab) {
					// Supported site but non-novel page: treat as site context only
					currentSiteShelfId = shelfForTab.id;
					if (currentNovelCard)
						currentNovelCard.style.display = "none";
					if (notSupportedMessage)
						notSupportedMessage.style.display = "none";
					if (pageStatusBadge) {
						pageStatusBadge.textContent = `${shelfForTab.name} site`;
						pageStatusBadge.className = "status-badge site";
					}
				} else if (response && !response.success) {
					showNotSupported(
						response.error || "Could not extract novel info",
					);
				} else if (!response && shelfForTab) {
					// No response but domain matches a supported shelf
					currentSiteShelfId = shelfForTab.id;
					if (pageStatusBadge) {
						pageStatusBadge.textContent = `${shelfForTab.name} site`;
						pageStatusBadge.className = "status-badge site";
					}
					if (notSupportedMessage)
						notSupportedMessage.style.display = "none";
				} else {
					showNotSupported("No novel info available");
				}
			} catch (error) {
				debugLog(
					"📚 Library: Error communicating with content script:",
					error,
				);
				if (
					(error.message?.includes(
						"could not establish connection",
					) ||
						error.message?.includes(
							"Receiving end does not exist",
						)) &&
					shelfForTab
				) {
					// Supported site but non-novel page
					currentSiteShelfId = shelfForTab.id;
					if (pageStatusBadge) {
						pageStatusBadge.textContent = `${shelfForTab.name} site`;
						pageStatusBadge.className = "status-badge site";
					}
					if (notSupportedMessage)
						notSupportedMessage.style.display = "none";
					return;
				}
				// Content script not available - page not supported
				if (error.message?.includes("Receiving end does not exist")) {
					showNotSupported("Not a supported novel site");
				} else {
					showNotSupported("Error: " + error.message);
				}
			}
		} catch (error) {
			debugError("Error loading current page info:", error);
			showNotSupported("Error detecting page");
		}
	}

	/**
	 * Display the current page novel info
	 */
	function displayCurrentPageNovel(novelInfo) {
		if (!currentNovelCard) return;

		// Show the card, hide not supported message
		currentNovelCard.style.display = "flex";
		if (notSupportedMessage) notSupportedMessage.style.display = "none";

		// Page type tag
		if (currentPageTypeTag) {
			if (novelInfo.isChapterPage) {
				currentPageTypeTag.textContent = "📖 Chapter";
				currentPageTypeTag.className = "tag tag-page-type chapter";
				currentPageTypeTag.style.display = "inline-flex";
			} else if (novelInfo.isNovelPage) {
				currentPageTypeTag.textContent = "📚 Novel Page";
				currentPageTypeTag.className = "tag tag-page-type novel";
				currentPageTypeTag.style.display = "inline-flex";
			} else {
				currentPageTypeTag.style.display = "none";
			}
		}

		// Status tag
		if (currentStatusTag) {
			const status = novelInfo.status;
			if (status) {
				const statusMap = {
					completed: { text: "✅ Completed", class: "completed" },
					ongoing: { text: "📝 Ongoing", class: "ongoing" },
					hiatus: { text: "⏸️ Hiatus", class: "hiatus" },
					dropped: { text: "❌ Dropped", class: "dropped" },
				};
				const statusInfo = statusMap[status.toLowerCase()] || {
					text: status,
					class: "",
				};
				currentStatusTag.textContent = statusInfo.text;
				currentStatusTag.className = `tag tag-status ${statusInfo.class}`;
				currentStatusTag.style.display = "inline-flex";
			} else {
				currentStatusTag.style.display = "none";
			}
		}

		// Chapter info
		if (currentChapterText) {
			let chapterStr = "";
			if (novelInfo.chapterTitle) {
				chapterStr = novelInfo.chapterTitle;
			} else if (novelInfo.currentChapter) {
				chapterStr = novelInfo.totalChapters
					? `Chapter ${novelInfo.currentChapter} of ${novelInfo.totalChapters}`
					: `Chapter ${novelInfo.currentChapter}`;
			} else if (novelInfo.totalChapters) {
				chapterStr = `${novelInfo.totalChapters} chapters total`;
			}
			currentChapterText.textContent = chapterStr;
			if (currentChapterInfo) {
				currentChapterInfo.style.display = chapterStr ? "flex" : "none";
			}
		}

		// Progress bar
		if (
			currentProgressBar &&
			currentProgressFill &&
			currentProgressPercent
		) {
			if (novelInfo.totalChapters && novelInfo.currentChapter) {
				const progress = Math.min(
					100,
					Math.round(
						(novelInfo.currentChapter / novelInfo.totalChapters) *
							100,
					),
				);
				currentProgressBar.style.display = "block";
				currentProgressFill.style.width = `${progress}%`;
				currentProgressPercent.textContent = `${progress}%`;
				currentProgressPercent.style.display = "inline";
			} else {
				currentProgressBar.style.display = "none";
				currentProgressPercent.style.display = "none";
			}
		}

		// Library details (only if in library)
		if (libraryDetails) {
			if (novelInfo.isInLibrary) {
				libraryDetails.style.display = "block";

				// Reading status
				if (readingStatusSelect) {
					readingStatusSelect.value =
						novelInfo.readingStatus || "reading";
					readingStatusSelect.onchange = async () => {
						await updateReadingStatus(
							novelInfo.novelId,
							readingStatusSelect.value,
						);
					};
				}

				// Enhanced count
				if (enhancedCountValue && enhancedCountRow) {
					const count = novelInfo.enhancedChapters || 0;
					if (count > 0) {
						enhancedCountValue.textContent = `${count} chapter${
							count !== 1 ? "s" : ""
						}`;
						enhancedCountRow.style.display = "flex";
					} else {
						enhancedCountRow.style.display = "none";
					}
				}

				// Genres
				if (genresList && genresRow) {
					const genres = novelInfo.genres || [];
					if (genres.length > 0) {
						const displayGenres = genres.slice(0, 3);
						const moreCount = genres.length - 3;
						genresList.innerHTML = displayGenres
							.map(
								(g) =>
									`<span class="genre-tag">${escapeHtml(
										g,
									)}</span>`,
							)
							.join("");
						if (moreCount > 0) {
							genresList.innerHTML += `<span class="genre-tag more" title="${escapeHtml(
								genres.slice(3).join(", "),
							)}">+${moreCount}</span>`;
						}
						genresRow.style.display = "flex";
					} else {
						genresRow.style.display = "none";
					}
				}
			} else {
				libraryDetails.style.display = "none";
			}
		}

		// Buttons
		if (addToLibraryBtn) {
			const btnText = addToLibraryBtn.querySelector(".btn-text");
			if (btnText) {
				btnText.textContent = novelInfo.isInLibrary
					? "Update"
					: "Add to Library";
			}
			addToLibraryBtn.onclick = () => addCurrentNovelToLibrary();
		}

		if (openNovelBtn) {
			if (novelInfo.isInLibrary && novelInfo.lastReadUrl) {
				openNovelBtn.style.display = "inline-flex";
				openNovelBtn.onclick = () => {
					browser.tabs.create({ url: novelInfo.lastReadUrl });
				};
			} else if (novelInfo.mainNovelUrl || novelInfo.sourceUrl) {
				openNovelBtn.style.display = "inline-flex";
				openNovelBtn.onclick = () => {
					browser.tabs.create({
						url: novelInfo.mainNovelUrl || novelInfo.sourceUrl,
					});
				};
			} else {
				openNovelBtn.style.display = "none";
			}
		}
	}

	/**
	 * Show "not supported" message
	 */
	function showNotSupported(message) {
		if (currentNovelCard) currentNovelCard.style.display = "none";
		if (notSupportedMessage) {
			notSupportedMessage.style.display = "flex";
			if (notSupportedText) {
				notSupportedText.textContent =
					message || "Not a supported page";
			}
		}
		if (pageStatusBadge) {
			pageStatusBadge.textContent = "Not Supported";
			pageStatusBadge.className = "status-badge not-supported";
		}
	}

	/**
	 * Add current novel to library
	 */
	async function addCurrentNovelToLibrary() {
		try {
			const tabs = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (!tabs[0]) return;

			const response = await browser.tabs.sendMessage(tabs[0].id, {
				action: "addToLibrary",
			});

			if (response && response.success) {
				showStatus(
					currentPageNovelData?.isInLibrary
						? "Novel updated!"
						: "Novel added to library!",
					"success",
					{
						title:
							response?.novel?.title ||
							currentPageNovelData?.title,
						novelData: response?.novel || currentPageNovelData,
						metadata: {
							action: "library-save",
						},
					},
				);

				// Update UI
				if (currentPageNovelData) {
					currentPageNovelData.isInLibrary = true;
				}
				if (pageStatusBadge) {
					pageStatusBadge.textContent = "✓ In Library";
					pageStatusBadge.className = "status-badge in-library";
				}
				if (addToLibraryBtn) {
					const btnText = addToLibraryBtn.querySelector(".btn-text");
					if (btnText) btnText.textContent = "Update";
				}
				if (libraryDetails) {
					libraryDetails.style.display = "block";
				}

				// Refresh library data
				await loadLibraryData();
			} else {
				showStatus(
					"Failed: " + (response?.error || "Unknown error"),
					"error",
					{
						title: "Library save failed",
						novelData: currentPageNovelData,
						metadata: {
							action: "library-save",
						},
					},
				);
			}
		} catch (error) {
			debugError("Error adding to library:", error);
			showStatus("Error: " + error.message, "error", {
				title: "Library save failed",
				novelData: currentPageNovelData,
				metadata: {
					action: "library-save",
				},
			});
		}
	}

	/**
	 * Update reading status for a novel
	 */
	async function updateReadingStatus(novelId, status) {
		try {
			const tabs = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (!tabs[0]) return;

			const response = await browser.tabs.sendMessage(tabs[0].id, {
				action: "updateNovelReadingStatus",
				novelId: novelId,
				readingStatus: status,
			});

			if (response && response.success) {
				showStatus("Status updated!", "success", {
					title: "Reading status updated",
					novelData: currentPageNovelData,
					metadata: {
						status,
					},
				});
			}
		} catch (error) {
			debugError("Error updating reading status:", error);
		}
	}

	/**
	 * Load library statistics and recent novels
	 */
	async function loadLibraryData() {
		try {
			const depsOk = await ensureLibraryDeps();
			if (!depsOk || !novelLibrary) {
				showStatus("Library data unavailable in popup", "error");
				return;
			}

			// Get library stats
			const stats = await novelLibrary.getStats();
			const enabledShelves = new Set(
				Object.values(SHELVES)
					.filter((shelf) =>
						isSiteEnabledSafe(siteSettings, shelf.id),
					)
					.map((shelf) => shelf.id),
			);

			// Update stats
			if (statNovels) statNovels.textContent = stats.totalNovels || 0;
			if (statChapters)
				statChapters.textContent = stats.totalEnhancedChapters || 0;
			if (statShelves) {
				const activeCount = Object.entries(stats.shelves || {}).filter(
					([id, s]) => enabledShelves.has(id) && s.novelCount > 0,
				).length;
				statShelves.textContent = activeCount;
			}

			// Get recent novels
			const allRecentNovels = await novelLibrary.getRecentNovels(20);
			const enabledRecentNovels = allRecentNovels.filter((novel) =>
				enabledShelves.has(novel.shelfId),
			);

			// Filter by current site if applicable
			let displayNovels = enabledRecentNovels;
			let showingSiteSpecific = false;
			let currentShelf = null;

			if (currentSiteShelfId && enabledShelves.has(currentSiteShelfId)) {
				currentShelf = Object.values(SHELVES).find(
					(s) => s.id === currentSiteShelfId,
				);
				const siteNovels = allRecentNovels.filter(
					(n) => n.shelfId === currentSiteShelfId,
				);

				if (siteNovels.length > 0) {
					displayNovels = siteNovels;
					showingSiteSpecific = true;
				}
			}

			// Limit to 6 novels
			displayNovels = displayNovels.slice(0, 6);

			// Update section title
			if (recentSectionTitle) {
				recentSectionTitle.textContent =
					showingSiteSpecific && currentShelf
						? `${currentShelf.name} Novels`
						: "Recent Novels";
			}

			// Update site indicator
			if (siteIndicator) {
				if (showingSiteSpecific && currentShelf) {
					const iconHtml =
						currentShelf.icon &&
						currentShelf.icon.startsWith("http")
							? `<img src="${escapeHtml(
									currentShelf.icon,
								)}" alt="" class="site-icon" onerror="this.outerHTML='${
									currentShelf.emoji || "📖"
								}'">`
							: currentShelf.emoji || "📖";
					siteIndicator.innerHTML = iconHtml;
					siteIndicator.style.display = "inline-flex";
				} else {
					siteIndicator.style.display = "none";
				}
			}

			// Render novels grid
			if (recentNovelsGrid) {
				if (displayNovels.length === 0) {
					recentNovelsGrid.innerHTML = "";
					if (emptyState) {
						emptyState.querySelector(".empty-text").textContent =
							showingSiteSpecific
								? `No novels from ${
										currentShelf?.name || "this site"
									} yet. Start enhancing!`
								: "No novels yet. Start enhancing chapters to build your library!";
						emptyState.style.display = "flex";
					}
				} else {
					if (emptyState) emptyState.style.display = "none";

					recentNovelsGrid.innerHTML = displayNovels
						.map((novel) => {
							const shelf = Object.values(SHELVES).find(
								(s) => s.id === novel.shelfId,
							);
							const shelfEmoji = shelf?.emoji || "📖";
							const shelfIcon = shelf?.icon;
							const shelfName = shelf?.name || "Unknown";

							// Build cover HTML
							let coverHtml;
							if (novel.coverUrl) {
								coverHtml = `<img src="${escapeHtml(
									novel.coverUrl,
								)}" alt="" class="novel-cover-img" onerror="this.outerHTML='<div class=\\'novel-cover-placeholder\\'>${shelfEmoji}</div>'">`;
							} else {
								const iconHtml =
									shelfIcon && shelfIcon.startsWith("http")
										? `<img src="${escapeHtml(
												shelfIcon,
											)}" alt="" class="novel-cover-site-icon" onerror="this.outerHTML='${shelfEmoji}'">`
										: shelfEmoji;
								coverHtml = `<div class="novel-cover-placeholder">${iconHtml}</div>`;
							}

							// Site badge (only show if not filtering by site)
							const siteBadgeHtml = showingSiteSpecific
								? ""
								: `
							<span class="novel-site-badge" title="${shelfName}">
								${
									shelfIcon && shelfIcon.startsWith("http")
										? `<img src="${escapeHtml(
												shelfIcon,
											)}" alt="" onerror="this.outerHTML='${shelfEmoji}'">`
										: shelfEmoji
								}
							</span>`;

							return `
							<div class="novel-grid-item" data-url="${escapeHtml(
								novel.lastReadUrl || novel.sourceUrl,
							)}" title="${escapeHtml(novel.title)}">
								<div class="novel-cover">
									${coverHtml}
									${siteBadgeHtml}
								</div>
								<div class="novel-info">
									<div class="novel-title">${escapeHtml(novel.title)}</div>
									<div class="novel-meta">
										${
											novel.enhancedChaptersCount > 0
												? `<span class="enhanced-badge">✨ ${novel.enhancedChaptersCount}</span>`
												: ""
										}
									</div>
								</div>
							</div>
						`;
						})
						.join("");

					// Add click handlers
					recentNovelsGrid
						.querySelectorAll(".novel-grid-item")
						.forEach((item) => {
							item.addEventListener("click", () => {
								const url = item.dataset.url;
								if (url) browser.tabs.create({ url });
							});
						});
				}
			}
		} catch (error) {
			debugError("Error loading library data:", error);
			if (recentNovelsGrid) {
				recentNovelsGrid.innerHTML = `<div class="error-message">Failed to load library. <button onclick="loadLibraryData()">Retry</button></div>`;
			}
		}
	}

	// Backup helpers
	function renderBackupHistory() {
		if (!backupHistoryList) return;
		if (!backupHistory || backupHistory.length === 0) {
			backupHistoryList.innerHTML = "<li>No backups yet</li>";
			return;
		}

		backupHistoryList.innerHTML = backupHistory
			.slice(0, BACKUP_RETENTION)
			.map((entry) => {
				const timestamp =
					entry.createdAt ||
					entry.exportedAt ||
					entry.date ||
					entry.timestamp ||
					Date.now();
				const date = new Date(timestamp);
				const file = escapeHtml(entry.filename || "rg-backup.json");
				return `<li>${date.toLocaleString()} — ${file}</li>`;
			})
			.join("");
	}

	async function persistBackupPrefs(extra = {}) {
		const folderValue = (backupFolderInput?.value || "").trim();
		const backupFolder = folderValue || "RanobeGeminiBackups";
		const autoBackupEnabled = autoBackupCheckbox?.checked || false;
		const storedPrefs = await browser.storage.local.get("backupMode");
		const backupMode =
			extra.backupMode || storedPrefs.backupMode || "scheduled";

		backupHistory = (backupHistory || []).slice(0, BACKUP_RETENTION);

		await browser.storage.local.set({
			backupFolder,
			autoBackupEnabled,
			backupMode,
			continuousBackupDelayMinutes: CONTINUOUS_BACKUP_DELAY_MINUTES,
			continuousBackupCheckIntervalMinutes:
				CONTINUOUS_BACKUP_CHECK_INTERVAL_MINUTES,
			backupRetention: BACKUP_RETENTION,
			backupIntervalDays: BACKUP_INTERVAL_DAYS,
			backupHistory,
			...extra,
		});

		// Inform background to reschedule auto backups if needed
		try {
			await browser.runtime.sendMessage({
				action: "syncAutoBackups",
			});
		} catch (e) {
			console.warn("Unable to sync auto backup schedule:", e?.message);
		}
	}

	async function triggerManualBackup(saveAs = true) {
		try {
			createManualBackup?.classList.add("loading");

			const folderValue = (backupFolderInput?.value || "").trim();
			const backupFolder = folderValue || "RanobeGeminiBackups";

			const response = await browser.runtime.sendMessage({
				action: "createLibraryBackup",
				folder: backupFolder,
				saveAs,
				retention: BACKUP_RETENTION,
			});

			if (!response?.success) {
				throw new Error(response?.error || "Backup failed");
			}

			const stored = await browser.storage.local.get("backupHistory");
			backupHistory =
				response.history || stored.backupHistory || backupHistory;
			renderBackupHistory();
			await persistBackupPrefs({
				backupFolder,
				backupHistory,
				lastBackupAt: Date.now(),
			});

			showStatus(`Backup saved to ${response.filename}`, "success");
		} catch (error) {
			debugError("Backup failed:", error);
			showStatus("Backup failed: " + error.message, "error");
		} finally {
			createManualBackup?.classList.remove("loading");
		}
	}

	async function handleRestoreFromFile(file) {
		if (!file) return;
		try {
			const text = await file.text();
			const data = JSON.parse(text);

			// Validate import data structure
			if (!data.library || !data.version) {
				throw new Error("Invalid library backup file format");
			}

			const novelCount = Object.keys(data.library.novels || {}).length;
			const choice = confirm(
				`Found ${novelCount} novels in backup file.\n\n` +
					`Click OK to MERGE with your existing library (recommended)\n` +
					`Click Cancel to REPLACE your entire library`,
			);

			const result = await novelLibrary.importLibrary(data, choice);

			if (result.success) {
				await initializeLibraryTab();
				showStatus(
					`Library ${
						choice ? "merged" : "restored"
					} successfully!\n\n` +
						`• ${result.imported} new novels added\n` +
						`• ${result.updated} existing novels updated` +
						(result.errors > 0
							? `\n• ${result.errors} errors occurred`
							: ""),
					"success",
				);
			} else {
				throw new Error(result.error || "Import failed");
			}
		} catch (error) {
			debugError("Restore failed:", error);
			showStatus(
				`Failed to import library: ${error.message}\n\nMake sure the file is a valid Ranobe Gemini backup.`,
				"error",
			);
		} finally {
			if (restoreFileInput) restoreFileInput.value = "";
		}
	}

	async function persistDriveConfig({ clientId, folderId } = {}) {
		const payload = {};
		if (clientId !== undefined) payload.driveClientId = clientId;
		if (folderId !== undefined) payload.driveFolderId = folderId;
		await browser.storage.local.set(payload);
	}

	// Setup Library Tab Event Listeners
	if (openFullLibraryBtn) {
		openFullLibraryBtn.addEventListener("click", () => {
			browser.tabs.create({
				url: browser.runtime.getURL("library/library.html"),
			});
		});
	}

	if (refreshLibraryBtn) {
		refreshLibraryBtn.addEventListener("click", async () => {
			refreshLibraryBtn.classList.add("spinning");
			await initializeLibraryTab();
			refreshLibraryBtn.classList.remove("spinning");
		});
	}

	if (createManualBackup) {
		createManualBackup.addEventListener("click", () =>
			triggerManualBackup(true),
		);
	}

	if (backupFolderInput) {
		backupFolderInput.addEventListener("change", () => {
			persistBackupPrefs();
		});
	}

	if (autoBackupCheckbox) {
		autoBackupCheckbox.addEventListener("change", async () => {
			await persistBackupPrefs();
			showStatus(
				autoBackupCheckbox.checked
					? "Auto backup enabled"
					: "Auto backup disabled",
				"success",
			);
		});
	}

	if (restoreBackupBtn && restoreFileInput) {
		restoreBackupBtn.addEventListener("click", () =>
			restoreFileInput.click(),
		);
		restoreFileInput.addEventListener("change", () => {
			if (restoreFileInput.files && restoreFileInput.files[0]) {
				handleRestoreFromFile(restoreFileInput.files[0]);
			}
		});
	}

	if (driveClientIdInput) {
		driveClientIdInput.addEventListener("change", async () => {
			const value = driveClientIdInput.value.trim();
			await persistDriveConfig({ clientId: value });
			showStatus("Drive client ID saved", "success");
			try {
				await browser.runtime.sendMessage({ action: "resetDriveAuth" });
			} catch (err) {
				debugError("Failed to reset Drive auth", err);
			}
		});
	}

	if (driveFolderIdInput) {
		driveFolderIdInput.addEventListener("change", async () => {
			const value = driveFolderIdInput.value.trim();
			await persistDriveConfig({ folderId: value });
			showStatus("Drive folder saved", "success");
		});
	}

	/**
	 * Escape HTML to prevent XSS
	 */
	function escapeHtml(text) {
		if (!text) return "";
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}

	// Improved resizing functionality
	function setupResizing() {
		const resizeHandle = document.getElementById("resize-handle");
		const sizeIndicator = document.getElementById("sizeIndicator");

		// Guard against missing elements
		if (!resizeHandle || !sizeIndicator) {
			return;
		}
		let isResizing = false;
		let startX, startY, startWidth, startHeight;

		// Default popup dimensions
		const DEFAULT_WIDTH = 380;
		const DEFAULT_HEIGHT = 500;
		const MIN_WIDTH = 320;
		const MIN_HEIGHT = 400;
		const MAX_WIDTH = 800;
		const MAX_HEIGHT = 900;

		// Load saved dimensions on startup
		browser.storage.local
			.get(["popupWidth", "popupHeight"])
			.then((result) => {
				if (result.popupWidth && result.popupHeight) {
					setSize(result.popupWidth, result.popupHeight);
				} else {
					// Set default size
					setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
				}
			});

		// Handle resize start
		resizeHandle.addEventListener("mousedown", (e) => {
			isResizing = true;
			startX = e.clientX;
			startY = e.clientY;
			startWidth = document.body.offsetWidth;
			startHeight = document.body.offsetHeight;

			// Display size indicator
			updateSizeIndicator(startWidth, startHeight);
			sizeIndicator.classList.add("visible");

			// Add event listeners for tracking
			document.addEventListener("mousemove", handleResize);
			document.addEventListener("mouseup", stopResize);

			// Prevent default behavior
			e.preventDefault();
		});

		// Handle resizing
		function handleResize(e) {
			if (!isResizing) return;

			// Calculate new dimensions
			let newWidth = startWidth + (e.clientX - startX);
			let newHeight = startHeight + (e.clientY - startY);

			// Apply constraints
			newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
			newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, newHeight));

			// Apply new size
			setSize(newWidth, newHeight);

			// Update size indicator
			updateSizeIndicator(newWidth, newHeight);
		}

		// Stop resizing
		function stopResize() {
			if (isResizing) {
				isResizing = false;

				// Save current dimensions
				browser.storage.local.set({
					popupWidth: document.body.offsetWidth,
					popupHeight: document.body.offsetHeight,
				});

				// Hide size indicator with a delay
				setTimeout(() => {
					sizeIndicator.classList.remove("visible");
				}, 800);

				// Remove event listeners
				document.removeEventListener("mousemove", handleResize);
				document.removeEventListener("mouseup", stopResize);
			}
		}

		// Set size with safety checks
		function setSize(width, height) {
			document.body.style.width = width + "px";
			document.body.style.height = height + "px";
		}

		// Update size indicator
		function updateSizeIndicator(width, height) {
			sizeIndicator.textContent = `${Math.round(width)} × ${Math.round(
				height,
			)}`;
		}

		// Double-click to reset size
		resizeHandle.addEventListener("dblclick", () => {
			setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
			browser.storage.local.set({
				popupWidth: DEFAULT_WIDTH,
				popupHeight: DEFAULT_HEIGHT,
			});
			updateSizeIndicator(DEFAULT_WIDTH, DEFAULT_HEIGHT);
			sizeIndicator.classList.add("visible");
			setTimeout(() => {
				sizeIndicator.classList.remove("visible");
			}, 800);
		});
	}

	// Function to get site-specific prompt from current handler
	function getSiteSpecificPrompt(currentHandler) {
		if (
			currentHandler &&
			typeof currentHandler.getSiteSpecificPrompt === "function"
		) {
			return currentHandler.getSiteSpecificPrompt();
		}
		return "";
	}

	// Helper function to update the UI with the current site-specific prompt
	function updateSiteSpecificPromptUI() {
		const currentSite = getCurrentSiteIdentifier();
		const currentHandler = handlerManager.getHandlerForCurrentSite();

		if (currentHandler) {
			const sitePrompt = getSiteSpecificPrompt(currentHandler);
			// Create or update site-specific prompt UI
			const container = document.getElementById(
				"siteSpecificPromptsContainer",
			);

			if (container) {
				const existingSitePrompt = container.querySelector(
					`[data-site="${currentSite}"]`,
				);

				if (sitePrompt && sitePrompt.length > 0) {
					if (existingSitePrompt) {
						// Update existing prompt
						existingSitePrompt.querySelector(
							".prompt-text",
						).textContent = sitePrompt;
					} else {
						// Create new prompt element
						const sitePromptEl = document.createElement("div");
						sitePromptEl.className = "site-prompt";
						sitePromptEl.dataset.site = currentSite;

						const siteName = document.createElement("strong");
						siteName.textContent =
							getSiteDisplayName(currentSite) + ":";

						const promptText = document.createElement("div");
						promptText.className = "prompt-text";
						promptText.textContent = sitePrompt;

						sitePromptEl.appendChild(siteName);
						sitePromptEl.appendChild(promptText);
						container.appendChild(sitePromptEl);
					}
				}
			}
		}
	}

	// Helper function to get a display name for a site
	function getSiteDisplayName(siteIdentifier) {
		const siteMappings = {
			ranobes: "Ranobes",
			fanfiction: "FanFiction.net",
			// Add more mappings as needed
		};

		// Extract domain from identifier if it's a full URL
		let domain = siteIdentifier;
		if (domain.includes(".")) {
			domain = domain.split(".")[0].toLowerCase();
		}

		return (
			siteMappings[domain] ||
			domain.charAt(0).toUpperCase() + domain.slice(1)
		);
	}

	// Function to load site-specific prompts
	async function loadSiteHandlerPrompts() {
		try {
			// Get active tab
			const tabs = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (!tabs || tabs.length === 0) {
				debugLog("No active tab found");
				return;
			}

			// Try to send message to content script
			try {
				// Send message to get site handler info
				const response = await browser.tabs.sendMessage(tabs[0].id, {
					action: "getSiteHandlerInfo",
				});

				// Check if we got a valid response with a handler
				if (response && response.success && response.hasHandler) {
					debugLog("Found site handler:", response.siteIdentifier);

					// Update the site-specific prompts container
					const container = document.getElementById(
						"siteSpecificPromptsContainer",
					);
					const noPromptsElement =
						document.getElementById("noSitePrompts");

					if (container) {
						// Hide the "no prompts" message
						if (noPromptsElement) {
							noPromptsElement.style.display = "none";
						}

						// Add or update the site-specific prompt
						let sitePromptElement = container.querySelector(
							`[data-site="${response.siteIdentifier}"]`,
						);

						if (!sitePromptElement) {
							// Create new site prompt element from template
							const template = document.querySelector(
								".site-prompt-template",
							);
							if (template) {
								// Clone the template
								sitePromptElement = template
									.querySelector(".site-prompt-item")
									.cloneNode(true);
								sitePromptElement.setAttribute(
									"data-site",
									response.siteIdentifier,
								);

								// Set site name
								const siteNameElement =
									sitePromptElement.querySelector(
										".site-name",
									);
								if (siteNameElement) {
									siteNameElement.textContent =
										response.siteIdentifier;
								}

								// Set prompt content
								const textarea =
									sitePromptElement.querySelector(
										".site-prompt-content",
									);
								if (textarea) {
									textarea.value =
										response.siteSpecificPrompt ||
										response.defaultPrompt ||
										"";
								}

								// Add remove button functionality
								const removeButton =
									sitePromptElement.querySelector(
										".remove-site-prompt",
									);
								if (removeButton) {
									removeButton.addEventListener(
										"click",
										function () {
											sitePromptElement.remove();
											if (
												container.querySelectorAll(
													".site-prompt-item",
												).length === 0
											) {
												if (noPromptsElement) {
													noPromptsElement.style.display =
														"block";
												}
											}
										},
									);
								}

								container.appendChild(sitePromptElement);
							}
						} else {
							// Update existing site prompt
							const textarea = sitePromptElement.querySelector(
								".site-prompt-content",
							);
							if (textarea) {
								textarea.value =
									response.siteSpecificPrompt ||
									response.defaultPrompt ||
									"";
							}
						}
					}
				} else {
					debugLog("No site handler found for current page");
				}
			} catch (error) {
				debugLog("Error communicating with content script:", error);
				// This might happen if the content script isn't loaded on this page
				// Load any saved site-specific prompts instead
				loadSavedSitePrompts();
			}
		} catch (error) {
			debugError("Error loading site handler prompts:", error);
		}
	}

	// Load saved site-specific prompts from localStorage
	function loadSavedSitePrompts() {
		try {
			const savedPrompts = localStorage.getItem("siteSpecificPrompts");
			if (!savedPrompts) return;

			const promptsObj = JSON.parse(savedPrompts);
			const container = document.getElementById(
				"siteSpecificPromptsContainer",
			);
			const noPromptsElement = document.getElementById("noSitePrompts");

			if (container && Object.keys(promptsObj).length > 0) {
				// Hide the "no prompts" message
				if (noPromptsElement) {
					noPromptsElement.style.display = "none";
				}

				// Clear existing prompts
				const existingPrompts =
					container.querySelectorAll(".site-prompt-item");
				existingPrompts.forEach((item) => {
					if (!item.closest(".site-prompt-template")) {
						item.remove();
					}
				});

				// Add each saved prompt
				Object.entries(promptsObj).forEach(([site, prompt]) => {
					const template = document.querySelector(
						".site-prompt-template",
					);
					if (template) {
						// Clone the template
						const promptItem = template
							.querySelector(".site-prompt-item")
							.cloneNode(true);

						promptItem.setAttribute("data-site", site);

						// Set site name
						const siteNameElement =
							promptItem.querySelector(".site-name");
						if (siteNameElement) {
							siteNameElement.textContent = site;
						}

						// Set prompt content
						const textarea = promptItem.querySelector(
							".site-prompt-content",
						);
						if (textarea) {
							textarea.value = prompt;
						}

						// Add remove button functionality
						const removeButton = promptItem.querySelector(
							".remove-site-prompt",
						);
						if (removeButton) {
							removeButton.addEventListener("click", function () {
								promptItem.remove();
								if (
									container.querySelectorAll(
										".site-prompt-item",
									).length === 0
								) {
									if (noPromptsElement) {
										noPromptsElement.style.display =
											"block";
									}
								}
							});
						}

						container.appendChild(promptItem);
					}
				});
			}
		} catch (error) {
			debugError("Error loading saved site prompts:", error);
		}
	}

	const addSitePromptButton = document.getElementById("addSitePrompt");
	if (addSitePromptButton) {
		addSitePromptButton.addEventListener("click", function () {
			const container = document.getElementById(
				"siteSpecificPromptsContainer",
			);
			const noPromptsElement = document.getElementById("noSitePrompts");
			const template = document.querySelector(".site-prompt-template");

			if (container && template) {
				// Hide the "no prompts" message
				if (noPromptsElement) {
					noPromptsElement.style.display = "none";
				}

				// Clone the template
				const newPrompt = template
					.querySelector(".site-prompt-item")
					.cloneNode(true);

				// Make site name editable
				const siteNameInput = newPrompt.querySelector(".site-name");
				if (siteNameInput) {
					siteNameInput.contentEditable = "true";
					siteNameInput.focus();
				}

				// Add remove button functionality
				const removeButton = newPrompt.querySelector(
					".remove-site-prompt",
				);
				if (removeButton) {
					removeButton.addEventListener("click", function () {
						newPrompt.remove();
						if (
							container.querySelectorAll(".site-prompt-item")
								.length === 0
						) {
							if (noPromptsElement) {
								noPromptsElement.style.display = "block";
							}
						}
					});
				}

				container.appendChild(newPrompt);
			}
		});
	}

	const savePromptsButton = document.getElementById("savePrompts");
	if (savePromptsButton) {
		savePromptsButton.addEventListener("click", async function () {
			const promptInput = document.getElementById("promptTemplate");
			const summaryInput = document.getElementById("summaryPrompt");
			const permanentInput = document.getElementById("permanentPrompt");
			if (!promptInput || !summaryInput || !permanentInput) {
				showStatus("Prompts UI not available", "error");
				return;
			}
			// Save enhancement prompt
			const promptValue = promptInput.value;
			localStorage.setItem("geminiPromptTemplate", promptValue);

			// Save summary prompt
			const summaryValue = summaryInput.value;
			localStorage.setItem("geminiSummaryPrompt", summaryValue);

			// Save short summary prompt
			const shortSummaryPromptEl =
				document.getElementById("shortSummaryPrompt");
			const shortSummaryValue = shortSummaryPromptEl
				? shortSummaryPromptEl.value
				: DEFAULT_SHORT_SUMMARY_PROMPT;
			localStorage.setItem("geminiShortSummaryPrompt", shortSummaryValue);

			// Save permanent prompt
			const permanentValue = permanentInput.value;
			localStorage.setItem("permanentPrompt", permanentValue);

			// Also save to browser.storage.local for background script access
			try {
				await browser.storage.local.set({
					defaultPrompt: promptValue,
					summaryPrompt: summaryValue,
					shortSummaryPrompt: shortSummaryValue,
					permanentPrompt: permanentValue,
				});
			} catch (error) {
				debugError("Error saving prompts to browser storage:", error);
			}

			// Save site-specific prompts
			saveSiteHandlerPrompts();

			showStatus("Prompts saved successfully!", "success");

			// Notify content script about updated prompts
			browser.tabs
				.query({ active: true, currentWindow: true })
				.then((tabs) => {
					if (tabs[0]) {
						browser.tabs.sendMessage(tabs[0].id, {
							action: "settingsUpdated",
						});
					}
				});
		});
	}

	// ========== NOVELS TAB HANDLERS ==========
	/**
	 * Load and display novels in the tab
	 */
	/**
	 * Load randomized novel suggestions from enabled sites
	 */
	async function loadRandomizedSuggestions() {
		try {
			if (!suggestedNovelsList) {
				debugLog("Suggested novels list element not found");
				return;
			}

			const depsOk = await ensureLibraryDeps();
			if (!depsOk) {
				console.error("Library dependencies not available");
				return;
			}

			// Get site settings to filter enabled sites
			let currentSiteSettings = {};
			try {
				currentSiteSettings = siteSettingsApi
					? await siteSettingsApi.getSiteSettings()
					: {};
			} catch (_err) {
				currentSiteSettings =
					siteSettingsApi?.getDefaultSiteSettings?.() || {};
			}

			const library = await novelLibrary.getLibrary();
			const allNovels = Object.values(library.novels || {});

			// Group novels by site (shelfId)
			const novelsBySite = {};
			allNovels.forEach((novel) => {
				if (novel.shelfId) {
					if (!novelsBySite[novel.shelfId]) {
						novelsBySite[novel.shelfId] = [];
					}
					novelsBySite[novel.shelfId].push(novel);
				}
			});

			// Filter sites: enabled and with 10+ novels
			const eligibleSites = Object.entries(novelsBySite).filter(
				([shelfId, novels]) => {
					const isEnabled =
						currentSiteSettings[shelfId]?.enabled !== false;
					const hasEnoughNovels = novels.length >= 10;
					return isEnabled && hasEnoughNovels;
				},
			);

			if (eligibleSites.length === 0) {
				suggestedNovelsList.innerHTML = `
					<div class="no-novels" style="grid-column: 1/-1; text-align: center; padding: 20px; color: #888;">
						<p>Not enough novels to show suggestions.</p>
						<p style="font-size: 12px; margin-top: 8px;">Add more novels to your library from enabled sites!</p>
					</div>
				`;
				return;
			}

			// Pick 1-2 random novels from each eligible site
			const randomSuggestions = [];
			eligibleSites.forEach(([shelfId, novels]) => {
				// Shuffle and take 1-2 novels
				const shuffled = [...novels].sort(() => Math.random() - 0.5);
				const count = Math.min(2, shuffled.length);
				randomSuggestions.push(...shuffled.slice(0, count));
			});

			// Shuffle the final list and limit to reasonable number (9-12)
			const finalSuggestions = [...randomSuggestions]
				.sort(() => Math.random() - 0.5)
				.slice(0, 12);

			// Render the suggestions
			if (finalSuggestions.length === 0) {
				suggestedNovelsList.innerHTML = `
					<div class="no-novels" style="grid-column: 1/-1; text-align: center; padding: 20px; color: #888;">
						No novels found for suggestions.
					</div>
				`;
				return;
			}

			suggestedNovelsList.innerHTML = finalSuggestions
				.map((novel) => renderSuggestedNovelCard(novel))
				.join("");

			// Add click handlers to open novels in library
			const suggCards = suggestedNovelsList.querySelectorAll(
				".suggested-novel-card",
			);
			suggCards.forEach((card) => {
				card.addEventListener("click", async () => {
					const novelId = card.getAttribute("data-novel-id");
					const shelfId = card.getAttribute("data-shelf-id");
					if (novelId) {
						await openNovelInLibrary(novelId, shelfId);
					}
				});
			});
		} catch (error) {
			debugError("Error loading randomized suggestions:", error);
			if (suggestedNovelsList) {
				suggestedNovelsList.innerHTML = `
					<div class="no-novels" style="grid-column: 1/-1; text-align: center; padding: 20px; color: #f88;">
						Error loading suggestions. Try again.
					</div>
				`;
			}
		}
	}

	async function loadNovelsTab() {
		try {
			if (
				!novelsListContainer ||
				!suggestedNovelsList ||
				!currentNovelInfo
			) {
				debugLog(
					"Novels tab elements missing; skipping novels tab render.",
				);
				return;
			}

			const depsOk = await ensureLibraryDeps();
			if (!depsOk) {
				showStatus("Novel history unavailable in popup", "error");
				return;
			}

			try {
				siteSettings = siteSettingsApi
					? await siteSettingsApi.getSiteSettings()
					: {};
			} catch (_err) {
				siteSettings =
					siteSettingsApi?.getDefaultSiteSettings?.() || {};
			}

			const library = await novelLibrary.getLibrary();
			const novelArray = Object.values(library.novels || {});

			// Get current novel info if on a supported site
			const currentNovel = await updateCurrentNovelInfo(novelArray);

			// Detect if current page is supported
			const tabs = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			const currentUrl = tabs[0]?.url || "";
			const currentShelf = getShelfFromUrl(currentUrl);
			const isSupported = Boolean(currentShelf);

			// Suggested novels: same website or recent fallback
			if (currentNovel?.shelfId) {
				await showSuggestedNovelsFromShelf(
					currentNovel.shelfId,
					novelArray,
					currentNovel.id,
				);
			} else {
				await showTopRecentNovels(novelArray);
			}

			// Library list: collapsed by default on supported sites
			const collapsed = isSupported;
			const limitPerShelf = collapsed ? 1 : 0;
			await displayNovelsByWebsite(novelArray, {
				collapsed,
				limitPerShelf,
			});
		} catch (error) {
			debugError("Error loading novels tab:", error);
			if (novelsListContainer) {
				novelsListContainer.innerHTML =
					'<div class="no-novels">Error loading novels. Try refreshing.</div>';
			}
		}
	}

	/**
	 * Update current novel info section
	 */
	async function updateCurrentNovelInfo(allNovels = []) {
		try {
			if (!currentNovelInfo) {
				return null;
			}
			const tabs = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (!tabs[0]) {
				currentNovelInfo.innerHTML = `
					<div class="no-current-novel">
						<p>No current novel detected.</p>
						<p class="description">Visit a novel page and the extension will track your reading.</p>
					</div>
				`;
				return null;
			}

			const currentUrl = tabs[0].url || "";
			const currentShelf = getShelfFromUrl(currentUrl);
			const currentNovel = await novelLibrary.getNovelByUrl(currentUrl);

			if (currentNovel) {
				renderCurrentNovelDetails(currentNovel);
				return currentNovel;
			}

			const knownPageInfo = (() => {
				try {
					const libraryUrl = browser.runtime.getURL(
						"library/library.html",
					);
					const popupUrl = browser.runtime.getURL("popup/popup.html");

					if (currentUrl.startsWith(libraryUrl)) {
						return {
							title: "Library Page",
							detail: "You're viewing your Ranobe Gemini Library.",
						};
					}

					if (currentUrl.startsWith(popupUrl)) {
						return {
							title: "Extension Settings",
							detail: "You're in Ranobe Gemini popup settings.",
						};
					}

					if (currentUrl.includes("/library/websites/")) {
						return {
							title: "Website Library",
							detail: "You're viewing a website-specific library page.",
						};
					}

					if (
						currentUrl.startsWith("chrome://newtab") ||
						currentUrl.startsWith("edge://newtab") ||
						currentUrl.startsWith("about:newtab") ||
						currentUrl.startsWith("about:home")
					) {
						return {
							title: "New Tab",
							detail: "You're on a new tab page.",
						};
					}

					if (
						currentUrl.startsWith("chrome://extensions") ||
						currentUrl.startsWith("edge://extensions") ||
						currentUrl.startsWith("about:addons")
					) {
						return {
							title: "Extensions Manager",
							detail: "You're managing your browser extensions.",
						};
					}

					if (
						currentUrl.includes("addons.mozilla.org") ||
						currentUrl.includes(
							"microsoftedge.microsoft.com/addons",
						)
					) {
						return {
							title: "Add-on Store",
							detail: "You're viewing an add-on store page.",
						};
					}

					const url = new URL(currentUrl);
					if (
						url.hostname === "vkrishna04.me" ||
						url.hostname === "ranobe.vkrishna04.me"
					) {
						return {
							title: "VKrishna04 Site",
							detail: "You're on VKrishna04's website. Enjoy exploring!",
						};
					}
				} catch (_err) {
					return null;
				}
				return null;
			})();

			if (knownPageInfo) {
				currentNovelInfo.innerHTML = `
					<div class="no-current-novel">
						<p>${escapeHtml(knownPageInfo.title)}</p>
						<p class="description">${escapeHtml(knownPageInfo.detail)}</p>
					</div>
				`;
				return null;
			}

			if (!currentShelf) {
				currentNovelInfo.innerHTML = `
					<div class="no-current-novel">
						<p>Unsupported website.</p>
						<p class="description">Showing your full library below.</p>
					</div>
				`;
				return null;
			}

			currentNovelInfo.innerHTML = `
				<div class="no-current-novel">
					<p>No current novel detected.</p>
					<p class="description">Visit a novel page to see details here.</p>
				</div>
			`;
			return null;
		} catch (error) {
			debugError("Error updating current novel info:", error);
			return null;
		}
	}

	/**
	 * Show top 6 recent novels from all sites
	 */
	async function showTopRecentNovels(allNovels) {
		try {
			if (!suggestedNovelsList) {
				return;
			}
			if (allNovels.length === 0) {
				suggestedNovelsList.innerHTML = `
					<div class="no-suggestions">
						<p>No novels in your library yet. Start reading to build your collection!</p>
					</div>
				`;
				return;
			}

			// Get top 6 most recent
			const recentNovels = allNovels
				.sort(
					(a, b) =>
						new Date(b.lastRead || 0) - new Date(a.lastRead || 0),
				)
				.slice(0, 6);

			suggestedNovelsList.innerHTML = `
				<div class="suggested-novels-container">
					${recentNovels.map((novel) => renderSuggestedNovelCard(novel)).join("")}
				</div>
			`;

			// Add click handlers to open novels in library
			suggestedNovelsList
				.querySelectorAll(".suggested-novel-card")
				.forEach((card) => {
					card.addEventListener("click", async () => {
						const novelId = card.dataset.novelId;
						const shelf = card.dataset.shelfId;
						await openNovelInLibrary(novelId, shelf);
					});
				});
		} catch (error) {
			debugError("Error showing top recent novels:", error);
		}
	}

	function renderCurrentNovelDetails(novel) {
		const title = novel.title || novel.bookTitle || "Unknown";
		const author = novel.author || "Unknown";
		const readingStatus = novel.readingStatus || "Unknown";
		const lastAccessed = novel.lastAccessedAt
			? new Date(novel.lastAccessedAt).toLocaleDateString()
			: "Unknown";
		const totalChapters = novel.totalChapters || novel.chapterCount || "?";
		const lastReadChapter =
			novel.lastReadChapter || novel.currentChapter || null;

		// Compact chips for mobile - show only most important 3
		const chips = [];
		if (readingStatus)
			chips.push(
				`<span class="chip chip-primary">${escapeHtml(readingStatus)}</span>`,
			);
		if (lastReadChapter)
			chips.push(
				`<span class="chip chip-warning">Ch. ${escapeHtml(String(lastReadChapter))}/${escapeHtml(String(totalChapters))}</span>`,
			);
		else if (totalChapters)
			chips.push(
				`<span class="chip chip-info">${escapeHtml(String(totalChapters))} chapters</span>`,
			);

		// Truncate description for mobile (2 lines max)
		let description = novel.description || "";
		if (description.length > 120) {
			description = description.substring(0, 120) + "...";
		}

		currentNovelInfo.innerHTML = `
		<div class="current-novel-card">
			<div class="current-novel-cover">
				${
					novel.coverUrl
						? `<img src="${escapeHtml(novel.coverUrl)}" alt="Cover" />`
						: `<div class="current-novel-cover-placeholder">📚</div>`
				}
			</div>
			<div class="current-novel-info">
				<div class="current-novel-title">${escapeHtml(title)}</div>
				<div class="current-novel-author">by ${escapeHtml(author)}</div>
				<div class="current-novel-chips">${chips.join(" ")}</div>
				${
					description
						? `<div class="current-novel-description">${escapeHtml(description)}</div>`
						: ""
				}
				<button class="btn-small btn-primary current-novel-library-link" data-novel-id="${escapeHtml(novel.id)}" data-shelf-id="${escapeHtml(novel.shelfId || "")}">
					📚 View Full Details
				</button>
			</div>
		</div>
	`;

		const link = currentNovelInfo.querySelector(
			".current-novel-library-link",
		);
		if (link) {
			link.addEventListener("click", async () => {
				await openNovelInLibrary(novel.id, novel.shelfId);
			});
		}
	}

	async function showSuggestedNovelsFromShelf(
		shelfId,
		allNovels,
		excludeNovelId,
	) {
		try {
			if (!suggestedNovelsList) return;
			const suggestions = allNovels
				.filter((n) => n.shelfId === shelfId && n.id !== excludeNovelId)
				.sort(
					(a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0),
				)
				.slice(0, 6);

			if (suggestions.length === 0) {
				suggestedNovelsList.innerHTML = `
					<div class="no-suggestions">
						<p>No suggestions yet for this website.</p>
					</div>
				`;
				return;
			}

			suggestedNovelsList.innerHTML = `
				<div class="suggested-novels-container">
					${suggestions.map((novel) => renderSuggestedNovelCard(novel)).join("")}
				</div>
			`;

			suggestedNovelsList
				.querySelectorAll(".suggested-novel-card")
				.forEach((card) => {
					card.addEventListener("click", async () => {
						const novelId = card.dataset.novelId;
						const shelf = card.dataset.shelfId;
						await openNovelInLibrary(novelId, shelf);
					});
				});
		} catch (error) {
			debugError("Error showing shelf suggestions:", error);
		}
	}

	function renderSuggestedNovelCard(novel) {
		const status = novel.readingStatus || novel.status || "Reading";
		const chapters = novel.totalChapters || novel.chapterCount || null;
		const lastReadRaw = novel.lastRead || novel.lastAccessedAt || null;
		const lastRead = lastReadRaw
			? new Date(lastReadRaw).toLocaleDateString()
			: "—";

		return `
			<div class="suggested-novel-card" data-novel-id="${escapeHtml(novel.id)}" data-shelf-id="${escapeHtml(novel.shelfId || "")}">
				<div class="suggested-novel-cover">
					${
						novel.coverUrl
							? `<img src="${escapeHtml(novel.coverUrl)}" alt="Cover" />`
							: `<div class="suggested-novel-cover-placeholder">📖</div>`
					}
				</div>
				<div class="suggested-novel-body">
					<div class="suggested-novel-title">${escapeHtml(novel.title || "Unknown")}</div>
					<div class="suggested-novel-author">by ${escapeHtml(novel.author || "Unknown")}</div>
					<div class="suggested-novel-meta">
						<span class="novel-chip chip-primary">${escapeHtml(status)}</span>
						${
							chapters
								? `<span class="novel-chip chip-info">${escapeHtml(String(chapters))} ch</span>`
								: ""
						}
					</div>
					<div class="suggested-novel-foot">Last read: ${escapeHtml(lastRead)}</div>
				</div>
			</div>
		`;
	}

	/**
	 * Update suggested novels based on reading history
	 */
	async function updateSuggestedNovels(allNovels) {
		// This is now replaced by showTopRecentNovels
		await showTopRecentNovels(allNovels);
	}

	// ========== LIBRARY BACKUP HANDLERS ==========
	/**
	 * Load and display backup history
	 */
	async function loadBackupHistory() {
		try {
			if (!backupList) {
				return;
			}
			const backups = await libraryBackupManager.listBackups();

			if (backups.length === 0) {
				backupList.innerHTML =
					'<div class="no-backups" style="text-align: center; padding: 20px; color: #888;">No backups yet. Create your first backup!</div>';
				return;
			}

			backupList.innerHTML = backups
				.map(
					(backup) => `
				<div style="padding: 12px; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
					<div style="flex: 1;">
						<div style="font-weight: 500; color: #e0e0e0; margin-bottom: 3px;">${
							backup.dateStr
						}</div>
						<div style="font-size: 12px; color: #aaa;">
							${backup.novelCount} novels • ${Math.round(backup.size / 1024)} KB ${
								backup.isAutomatic
									? '<span style="color: #4caf50;">(Auto)</span>'
									: "(Manual)"
							}
						</div>
					</div>
					<div style="display: flex; gap: 6px;">
						<button class="backup-restore-btn" data-backup-id="${
							backup.id
						}" style="padding: 6px 12px; font-size: 11px; background: #667eea; border: none; border-radius: 4px; cursor: pointer; color: white;">
							Restore
						</button>
						<button class="backup-delete-btn" data-backup-id="${
							backup.id
						}" style="padding: 6px 12px; font-size: 11px; background: #db4437; border: none; border-radius: 4px; cursor: pointer; color: white;">
							Delete
						</button>
					</div>
				</div>
			`,
				)
				.join("");

			// Add event listeners for restore and delete
			document.querySelectorAll(".backup-restore-btn").forEach((btn) => {
				btn.addEventListener("click", async function () {
					const backupId = this.dataset.backupId;
					const mergeMode =
						document.querySelector(
							'input[name="mergeMode"]:checked',
						)?.value || "merge";
					await handleRestoreBackup(backupId, mergeMode);
				});
			});

			document.querySelectorAll(".backup-delete-btn").forEach((btn) => {
				btn.addEventListener("click", async function () {
					const backupId = this.dataset.backupId;
					if (
						confirm("Are you sure you want to delete this backup?")
					) {
						await libraryBackupManager.deleteBackup(backupId);
						await loadBackupHistory();
						showStatus("Backup deleted successfully!", "success");
					}
				});
			});
		} catch (error) {
			debugError("Error loading backup history:", error);
		}
	}

	/**
	 * Handle restore backup
	 */
	async function handleRestoreBackup(backupId, mergeMode) {
		try {
			const restored = await libraryBackupManager.restoreBackup(
				backupId,
				mergeMode,
			);

			if (restored) {
				await browser.storage.local.set({
					novelHistory: restored,
				});

				showStatus(
					`Backup restored successfully (${mergeMode} mode)!`,
					"success",
				);
				await loadBackupHistory();
				await loadNovelsTab();
			}
		} catch (error) {
			debugError("Error restoring backup:", error);
			showStatus("Failed to restore backup", "error");
		}
	}

	/**
	 * Update Google Drive backup UI based on connection status
	 */
	async function updateDriveUI() {
		try {
			if (!driveNotConnected || !driveConnected || !driveStatusSpan) {
				debugError("Drive UI elements missing in popup");
				return;
			}

			// Initially hide both sections to prevent flicker
			driveNotConnected.style.display = "none";
			driveConnected.style.display = "none";

			const tokens = await browser.storage.local.get([
				"driveAuthTokens",
				"driveAuthError",
			]);
			const isConnected = !!tokens.driveAuthTokens?.access_token;

			if (driveOAuthDetails) {
				driveOAuthDetails.open = !isConnected;
			}

			if (isConnected) {
				driveNotConnected.style.display = "none";
				driveConnected.style.display = "block";
				driveStatusSpan.textContent = "🟢 Connected";
				driveStatusSpan.style.color = "#4CAF50";
				if (driveAuthError) {
					driveAuthError.style.display = "none";
					driveAuthError.textContent = "";
				}

				// Load backup mode
				const prefs = await browser.storage.local.get([
					"backupMode",
					"continuousBackupCheckIntervalMinutes",
				]);
				const mode = prefs.backupMode || "scheduled";
				const modeRadio = document.querySelector(
					`input[name="driveBackupMode"][value="${mode}"]`,
				);
				if (modeRadio) modeRadio.checked = true;

				// Load continuous backup check interval
				const continuousCheckInterval =
					prefs.continuousBackupCheckIntervalMinutes || 2;
				const continuousCheckSlider = document.getElementById(
					"continuousBackupCheckInterval",
				);
				const continuousCheckDisplay = document.getElementById(
					"continuousCheckIntervalDisplay",
				);
				if (continuousCheckSlider) {
					continuousCheckSlider.value = continuousCheckInterval;
				}
				if (continuousCheckDisplay) {
					continuousCheckDisplay.textContent =
						continuousCheckInterval;
				}

				// Show/hide continuous backup interval control
				const continuousContainer = document.getElementById(
					"continuousBackupCheckContainer",
				);
				if (continuousContainer) {
					continuousContainer.style.display =
						mode === "continuous" || mode === "both"
							? "block"
							: "none";
				}

				const restorePrefs = await browser.storage.local.get(
					"driveAutoRestoreEnabled",
				);
				if (driveAutoRestoreEnabled) {
					driveAutoRestoreEnabled.checked =
						restorePrefs.driveAutoRestoreEnabled === true;
				}
			} else {
				driveNotConnected.style.display = "block";
				driveConnected.style.display = "none";
				const authError = tokens.driveAuthError?.message;
				if (authError) {
					driveStatusSpan.textContent = "🔴 Auth failed";
					driveStatusSpan.style.color = "#f59e0b";
					if (driveAuthError) {
						driveAuthError.textContent = authError;
						driveAuthError.style.display = "block";
					}
				} else {
					driveStatusSpan.textContent = "⚫ Disconnected";
					driveStatusSpan.style.color = "#999";
					if (driveAuthError) {
						driveAuthError.style.display = "none";
						driveAuthError.textContent = "";
					}
				}
				if (driveAutoRestoreEnabled) {
					driveAutoRestoreEnabled.checked = false;
				}
			}
		} catch (err) {
			debugError("Failed to update Drive UI", err);
		}
	}

	/**
	 * Connect to Google Drive via OAuth
	 */
	async function handleConnectDrive() {
		try {
			debugLog("handleConnectDrive called");
			debugLog("connectDriveBtn element:", connectDriveBtn);

			if (!connectDriveBtn) {
				debugError("connectDriveBtn element not found!");
				showStatus("Button element not found", "error");
				return;
			}

			connectDriveBtn.disabled = true;
			connectDriveBtn.textContent = "🔗 Connecting...";

			const saved = await browser.storage.local.get([
				"driveClientId",
				"driveClientSecret",
			]);
			const clientIdInput = driveClientIdInput?.value.trim();
			const clientSecretInput = driveClientSecretInput?.value.trim();
			const clientId =
				clientIdInput || saved.driveClientId || DEFAULT_DRIVE_CLIENT_ID;
			const clientSecret =
				clientSecretInput || saved.driveClientSecret || "";

			await browser.storage.local.set({
				driveClientId: clientId,
				driveClientSecret: clientSecret,
			});

			debugLog("Sending ensureDriveAuth message...");
			const response = await browser.runtime.sendMessage({
				action: "ensureDriveAuth",
			});

			debugLog("ensureDriveAuth response:", response);

			if (response?.success) {
				const tokens =
					await browser.storage.local.get("driveAuthTokens");
				if (!tokens.driveAuthTokens?.access_token) {
					throw new Error(
						"OAuth completed but no tokens were saved. Check your OAuth client type and redirect URI.",
					);
				}
				showStatus(
					"✅ Google Drive connected successfully!",
					"success",
				);

				// Enable auto-restore by default after successful OAuth
				debugLog("Enabling auto-restore from Drive...");
				await browser.storage.local.set({
					driveAutoRestoreEnabled: true,
					driveAutoRestoreMergeMode: "merge",
				});

				await updateDriveUI();

				// Auto-backup after successful OAuth connection
				debugLog("Creating initial backup after OAuth connection...");
				try {
					const backupResponse = await browser.runtime.sendMessage({
						action: "uploadLibraryBackupToDrive",
						folderId: null,
						reason: "oauth-initial",
					});

					if (backupResponse?.success) {
						const fileName =
							backupResponse.primary?.filename || "backup";
						debugLog("Initial backup created:", fileName);
						showStatus(
							`✅ Initial backup created: ${fileName}`,
							"success",
						);
					} else {
						debugError(
							"Initial backup failed:",
							backupResponse?.error,
						);
						showStatus(
							`Note: Initial backup creation skipped (${backupResponse?.error || "unknown error"})`,
							"warning",
						);
					}
				} catch (backupErr) {
					debugError("Auto-backup error:", backupErr);
					showStatus(
						`Note: Initial backup not created (${backupErr.message})`,
						"warning",
					);
				}

				// Trigger initial sync from Drive after OAuth
				debugLog("Triggering initial sync from Drive...");
				try {
					const syncResponse = await browser.runtime.sendMessage({
						action: "syncDriveNow",
						reason: "oauth-initial",
					});

					if (syncResponse?.success) {
						debugLog("Initial Drive sync completed:", syncResponse);
						if (syncResponse.imported) {
							showStatus(
								`✅ Synced ${syncResponse.novelCount || 0} novels from Drive`,
								"success",
							);
						} else {
							showStatus(
								"✅ Drive sync completed (no new data)",
								"success",
							);
						}
					} else if (syncResponse?.skipped) {
						debugLog("Drive sync skipped:", syncResponse.reason);
						// Don't show skipped message to user - it's expected
					} else {
						debugError("Initial sync failed:", syncResponse?.error);
					}
				} catch (syncErr) {
					debugError("Auto-sync error:", syncErr);
					// Don't show sync errors to user - backup succeeded which is most important
				}
			} else {
				throw new Error(response?.error || "Authentication failed");
			}
		} catch (err) {
			debugError("Failed to connect Drive", err);
			showStatus(
				`Failed to connect Google Drive: ${err.message}`,
				"error",
			);
			if (connectDriveBtn) {
				connectDriveBtn.disabled = false;
				connectDriveBtn.textContent = "🔗 Connect Google Drive";
			}
			return;
		}

		if (connectDriveBtn) {
			connectDriveBtn.disabled = false;
			connectDriveBtn.textContent = "🔗 Connect Google Drive";
		}
	}

	/**
	 * Disconnect from Google Drive
	 */
	async function handleDisconnectDrive() {
		if (
			!confirm(
				"Disconnect Google Drive? Backups won't sync automatically.",
			)
		)
			return;

		try {
			await browser.storage.local.set({ driveAuthTokens: null });
			showStatus("Disconnected from Google Drive", "success");
			await updateDriveUI();
		} catch (err) {
			debugError("Failed to disconnect Drive", err);
			showStatus("Failed to disconnect Google Drive", "error");
		}
	}

	/**
	 * Backup library to Google Drive now
	 */
	async function handleBackupNow() {
		if (!backupNowBtn) return;

		try {
			// Check if connected to Drive
			const tokens = await browser.storage.local.get("driveAuthTokens");
			if (!tokens.driveAuthTokens?.access_token) {
				showStatus(
					"❌ Not connected to Google Drive. Connect first.",
					"error",
				);
				return;
			}

			backupNowBtn.disabled = true;
			backupNowBtn.textContent = "📤 Backing up...";

			debugLog("Starting manual backup to Drive...");

			const response = await browser.runtime.sendMessage({
				action: "uploadLibraryBackupToDrive",
				folderId: null,
				reason: "manual",
			});

			debugLog("Backup response:", response);

			if (response?.success) {
				const fileName =
					response.primary?.filename || response.name || "backup";
				debugLog("Backup successful:", fileName);
				showStatus(`✅ Backup uploaded: ${fileName}`, "success");
			} else {
				throw new Error(response?.error || "Upload failed");
			}
		} catch (err) {
			debugError("Failed to backup to Drive", err);
			showStatus(`Failed: ${err.message}`, "error");
		} finally {
			backupNowBtn.disabled = false;
			backupNowBtn.textContent = "📤 Backup Now";
		}
	}

	function formatFileSize(bytes) {
		if (!bytes && bytes !== 0) return "Unknown";
		const kb = bytes / 1024;
		if (kb < 1024) return `${kb.toFixed(1)} KB`;
		return `${(kb / 1024).toFixed(2)} MB`;
	}

	function getRelativeTimeString(date) {
		const now = new Date();
		const diffMs = now - date;
		const seconds = Math.floor(diffMs / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (seconds < 60) return `${seconds}s ago`;
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return `${days}d ago`;
	}

	function getBackupTags(name) {
		const tags = [];
		const lower = (name || "").toLowerCase();
		if (lower.includes("continuous")) tags.push("🔄 Continuous");
		else tags.push("📅 Scheduled");
		const versionMatch = name?.match(/v\d+(?:\.\d+)?/i);
		if (versionMatch) tags.push(versionMatch[0].toUpperCase());
		return tags;
	}

	async function handleRestoreDriveBackup(fileId) {
		try {
			if (!fileId) return;
			showStatus("⏳ Downloading backup...", "info");
			const response = await browser.runtime.sendMessage({
				action: "downloadDriveBackup",
				fileId,
			});

			if (!response?.success || !response.data) {
				throw new Error(response?.error || "Download failed");
			}

			await restoreComprehensiveBackup(response.data, {
				mode: "merge",
				restoreCredentials: false,
				restoreApiKeys: true,
			});

			showStatus("✅ Backup restored successfully", "success");
			await loadNovelsTab();
		} catch (err) {
			debugError("Drive backup restore failed", err);
			showStatus(`Restore failed: ${err.message}`, "error");
		}
	}

	function renderDriveBackups(backups) {
		if (!driveBackupsList) return;
		driveBackupsList.innerHTML = "";

		const list = document.createElement("div");
		list.style.maxHeight = "260px";
		list.style.overflowY = "auto";
		list.style.display = "grid";
		list.style.gap = "12px";

		backups.slice(0, 20).forEach((backup) => {
			const created = new Date(
				backup.modifiedTime || backup.createdTime || Date.now(),
			);
			const modified = new Date(backup.modifiedTime || Date.now());
			const sizeLabel = formatFileSize(Number(backup.size));

			// Determine backup type from filename
			const isContinuous =
				backup.name === "ranobe-library-continuous.json";
			const backupType = isContinuous ? "Continuous" : "Manual";
			const backupTypeColor = isContinuous ? "#4CAF50" : "#2196F3";

			// Parse timestamp from filename for manual backups
			let backupDate = created;
			if (!isContinuous && backup.name.includes("ranobe-library-")) {
				const timestampStr = backup.name
					.replace("ranobe-library-", "")
					.replace(".json", "");
				// Try to parse ISO timestamp from filename
				const parsed = new Date(
					timestampStr.replace(/-/g, ":").replace("T", " "),
				);
				if (!isNaN(parsed.getTime())) {
					backupDate = parsed;
				}
			}

			const card = document.createElement("div");
			card.className = "drive-backup-card";
			card.style.padding = "12px";
			card.style.background = "rgba(0, 0, 0, 0.1)";
			card.style.borderRadius = "6px";
			card.style.borderLeft = `4px solid ${backupTypeColor}`;

			// Title row with type badge
			const titleRow = document.createElement("div");
			titleRow.style.display = "flex";
			titleRow.style.justifyContent = "space-between";
			titleRow.style.alignItems = "center";
			titleRow.style.marginBottom = "8px";

			const titleLeft = document.createElement("div");
			titleLeft.style.display = "flex";
			titleLeft.style.alignItems = "center";
			titleLeft.style.gap = "8px";

			const typeBadge = document.createElement("span");
			typeBadge.style.padding = "2px 8px";
			typeBadge.style.borderRadius = "12px";
			typeBadge.style.fontSize = "11px";
			typeBadge.style.fontWeight = "600";
			typeBadge.style.background = backupTypeColor;
			typeBadge.style.color = "white";
			typeBadge.textContent = backupType;

			const fileName = document.createElement("span");
			fileName.style.fontSize = "13px";
			fileName.style.fontWeight = "500";
			fileName.style.color = "#ddd";
			fileName.textContent = isContinuous
				? "Rolling Backup"
				: backupDate.toLocaleString();

			titleLeft.appendChild(typeBadge);
			titleLeft.appendChild(fileName);

			const sizeSpan = document.createElement("span");
			sizeSpan.style.fontSize = "12px";
			sizeSpan.style.color = "#aaa";
			sizeSpan.textContent = sizeLabel;

			titleRow.appendChild(titleLeft);
			titleRow.appendChild(sizeSpan);

			// Metadata row with icons
			const meta = document.createElement("div");
			meta.style.fontSize = "11px";
			meta.style.color = "#999";
			meta.style.marginBottom = "10px";
			meta.style.display = "flex";
			meta.style.gap = "12px";
			meta.style.flexWrap = "wrap";

			const createdSpan = document.createElement("span");
			createdSpan.textContent = `📅 ${backupDate.toLocaleDateString()} ${backupDate.toLocaleTimeString()}`;

			const relativeSpan = document.createElement("span");
			relativeSpan.textContent = `🕒 ${getRelativeTimeString(backupDate)}`;

			meta.appendChild(createdSpan);
			meta.appendChild(relativeSpan);

			// Actions row
			const actions = document.createElement("div");
			actions.style.display = "flex";
			actions.style.gap = "8px";

			const restoreBtn = document.createElement("button");
			restoreBtn.className = "btn-secondary";
			restoreBtn.style.fontSize = "12px";
			restoreBtn.style.flex = "1";
			restoreBtn.textContent = "📥 Restore";
			restoreBtn.addEventListener("click", () => {
				handleRestoreDriveBackup(backup.id);
			});

			const viewDetailsBtn = document.createElement("button");
			viewDetailsBtn.className = "btn-secondary";
			viewDetailsBtn.style.fontSize = "12px";
			viewDetailsBtn.style.padding = "6px 12px";
			viewDetailsBtn.textContent = "ℹ️";
			viewDetailsBtn.title = "View detailed backup info";
			viewDetailsBtn.addEventListener("click", async () => {
				await showBackupDetails(backup);
			});

			actions.appendChild(restoreBtn);
			actions.appendChild(viewDetailsBtn);

			card.appendChild(titleRow);
			card.appendChild(meta);
			card.appendChild(actions);
			list.appendChild(card);
		});

		if (backups.length === 0) {
			list.innerHTML = `
				<div style="text-align: center; padding: 30px; color: #888;">
					<div style="font-size: 48px; margin-bottom: 12px;">📦</div>
					<div style="font-size: 14px;">No backups found on Google Drive</div>
					<div style="font-size: 12px; margin-top: 8px; color: #666;">Create a backup to get started</div>
				</div>
			`;
		}

		driveBackupsList.appendChild(list);
	}

	/**
	 * Show detailed backup information in a modal
	 */
	async function showBackupDetails(backup) {
		try {
			showStatus("⏳ Loading backup details...", "info");

			// Download and parse the backup to get detailed metadata
			const response = await browser.runtime.sendMessage({
				action: "downloadDriveBackup",
				fileId: backup.id,
			});

			if (!response || !response.data) {
				throw new Error("Failed to download backup");
			}

			const backupData = response.data;
			const metadata = backupData.metadata || {};
			const novelCount =
				metadata.novelCount ||
				Object.keys(
					backupData.data?.novelHistory ||
						backupData.data?.rg_novel_library?.novels ||
						{},
				).length ||
				0;

			// Calculate chapter count
			let chapterCount = 0;
			if (backupData.chapters) {
				chapterCount = Object.values(backupData.chapters).reduce(
					(sum, chapterData) => {
						return (
							sum +
							(Array.isArray(chapterData)
								? chapterData.length
								: 0)
						);
					},
					0,
				);
			}

			const details = `
📦 Backup Details
━━━━━━━━━━━━━━━
📚 Novels: ${novelCount}
📖 Chapters: ${chapterCount}
💾 Size: ${formatFileSize(Number(backup.size))}
📅 Created: ${new Date(backup.createdTime || backup.modifiedTime).toLocaleString()}
🔄 Modified: ${new Date(backup.modifiedTime).toLocaleString()}
🆔 Version: ${backupData.version || "unknown"}
🔧 Extension: ${backupData.extensionVersion || "unknown"}
🌐 Browser: ${backupData.browser || "unknown"}

🔑 Contains:
${metadata.hasApiKey ? "✅" : "❌"} API Keys
${metadata.hasPrompts ? "✅" : "❌"} Custom Prompts
${metadata.hasDriveCredentials ? "✅" : "❌"} Drive Credentials
			`.trim();

			alert(details);
			showStatus("✅ Backup details loaded", "success");
		} catch (error) {
			debugError("Failed to load backup details:", error);
			showStatus(
				`❌ Failed to load backup details: ${error.message}`,
				"error",
			);
		}
	}

	/**
	 * View backups on Google Drive
	 */
	async function handleViewBackups() {
		if (!viewBackupsBtn) return;

		try {
			// Check if connected to Drive
			const tokens = await browser.storage.local.get("driveAuthTokens");
			if (!tokens.driveAuthTokens?.access_token) {
				showStatus(
					"❌ Not connected to Google Drive. Connect first.",
					"error",
				);
				return;
			}

			viewBackupsBtn.disabled = true;
			viewBackupsBtn.textContent = "⏳ Loading...";

			debugLog("Fetching backups from Drive...");
			const response = await browser.runtime.sendMessage({
				action: "listDriveBackups",
			});

			debugLog("Backups response:", response);

			// Extract backups array from response object
			const backups = response?.backups || response;

			if (!backups || backups.length === 0) {
				renderDriveBackups([]);
				showStatus("No backups found on Drive", "info");
				return;
			}

			renderDriveBackups(backups);
			showStatus(
				"Retrieved " + backups.length + " backup(s) from Drive",
				"success",
			);
		} catch (err) {
			debugError("View backups failed", err);
			showStatus(`View backups failed: ${err.message}`, "error");
		} finally {
			viewBackupsBtn.disabled = false;
			viewBackupsBtn.textContent = "📋 View Backups";
		}
	}

	/**
	 * Handle Sync From Drive Now button click
	 */
	async function handleDriveSyncNow() {
		if (!driveSyncNowBtn) return;

		try {
			// Check if connected to Drive
			const tokens = await browser.storage.local.get("driveAuthTokens");
			if (!tokens.driveAuthTokens?.access_token) {
				showStatus(
					"❌ Not connected to Google Drive. Connect first.",
					"error",
				);
				return;
			}

			driveSyncNowBtn.disabled = true;
			driveSyncNowBtn.textContent = "⏳ Syncing...";

			debugLog("Syncing library from Drive...");
			const response = await browser.runtime.sendMessage({
				action: "syncDriveNow",
			});

			if (response?.success) {
				debugLog("Drive sync successful");
				showStatus(
					"Library synced from Drive successfully!",
					"success",
				);
				// Reload library if on library page
				if (typeof loadLibrary === "function") {
					await loadLibrary();
				}
			} else {
				throw new Error(response?.error || "Drive sync failed");
			}
		} catch (err) {
			debugError("Drive sync failed", err);
			showStatus(`Drive sync failed: ${err.message}`, "error");
		} finally {
			driveSyncNowBtn.disabled = false;
			driveSyncNowBtn.textContent = "🔄 Sync From Drive Now";
		}
	}

	/**
	 * Handle Drive backup mode change (scheduled vs continuous)
	 */
	async function handleDriveBackupModeChange(e) {
		try {
			const mode = e.target.value;
			await browser.storage.local.set({ backupMode: mode });

			// Show/hide continuous backup check interval control
			const continuousContainer = document.getElementById(
				"continuousBackupCheckContainer",
			);
			if (continuousContainer) {
				continuousContainer.style.display =
					mode === "continuous" || mode === "both" ? "block" : "none";
			}

			showStatus(`Backup mode set to: ${mode}`, "success");
		} catch (err) {
			debugError("Failed to update backup mode", err);
			showStatus("Failed to update backup mode", "error");
		}
	}

	/**
	 * Handle continuous backup check interval change
	 */
	async function handleContinuousBackupCheckIntervalChange(e) {
		try {
			const interval = parseInt(e.target.value);
			await browser.storage.local.set({
				continuousBackupCheckIntervalMinutes: interval,
			});

			// Update display
			const display = document.getElementById(
				"continuousCheckIntervalDisplay",
			);
			if (display) {
				display.textContent = interval;
			}

			debugLog(
				`Continuous backup check interval set to ${interval} minutes`,
			);
		} catch (err) {
			debugError(
				"Failed to update continuous backup check interval",
				err,
			);
		}
	}

	/**
	 * Handle Drive auto-restore toggle
	 */
	async function handleDriveAutoRestoreToggle(e) {
		try {
			const enabled = e.target.checked;
			await browser.storage.local.set({
				driveAutoRestoreEnabled: enabled,
			});
			showStatus(
				enabled
					? "Auto-restore from Drive enabled"
					: "Auto-restore from Drive disabled",
				"success",
			);
		} catch (err) {
			debugError("Failed to update auto-restore setting", err);
			showStatus("Failed to update auto-restore setting", "error");
		}
	}

	/**
	 * Handle manual backup creation
	 */
	async function handleCreateManualBackup() {
		try {
			const result = await browser.storage.local.get(["novelHistory"]);
			const libraryData = result.novelHistory || {};

			const backup = await libraryBackupManager.createBackup(
				libraryData,
				false,
			);

			if (backup) {
				showStatus(
					`Backup created: ${backup.novelCount} novels backed up`,
					"success",
				);
				await loadBackupHistory();
			}
		} catch (error) {
			debugError("Error creating backup:", error);
			showStatus("Failed to create backup", "error");
		}
	}

	/**
	 * Update backup config
	 */
	async function updateBackupConfig() {
		try {
			const config = {
				autoBackupEnabled: autoBackupCheckbox?.checked || false,
				mergeMode:
					document.querySelector('input[name="mergeMode"]:checked')
						?.value || "merge",
			};

			await libraryBackupManager.updateConfig(config);
			showStatus("Backup settings saved!", "success");
		} catch (error) {
			debugError("Error updating backup config:", error);
		}
	}

	// Attach backup handlers
	if (refreshNovelsBtn) {
		refreshNovelsBtn.addEventListener("click", loadNovelsTab);
	}

	if (randomizeSuggestionsBtn) {
		randomizeSuggestionsBtn.addEventListener("click", async () => {
			await loadRandomizedSuggestions();
		});
	}

	if (createManualBackup) {
		createManualBackup.addEventListener("click", handleCreateManualBackup);
	}

	if (autoBackupCheckbox) {
		autoBackupCheckbox.addEventListener("change", updateBackupConfig);
	}

	mergeModRadios.forEach((radio) => {
		radio.addEventListener("change", updateBackupConfig);
	});

	// Attach Google Drive backup handlers
	if (connectDriveBtn) {
		// Use both click and touchend for better mobile support
		const handleConnect = (e) => {
			e.preventDefault();
			e.stopPropagation();
			handleConnectDrive();
		};
		connectDriveBtn.addEventListener("click", handleConnect);
		// Add touch event for mobile browsers
		connectDriveBtn.addEventListener("touchend", handleConnect, {
			passive: false,
		});
	}
	if (disconnectDriveBtn) {
		disconnectDriveBtn.addEventListener("click", handleDisconnectDrive);
	}
	if (backupNowBtn) {
		backupNowBtn.addEventListener("click", handleBackupNow);
	}
	if (viewBackupsBtn) {
		viewBackupsBtn.addEventListener("click", handleViewBackups);
	}

	// Handle all Library Settings buttons
	const allLibrarySettingsButtons = document.querySelectorAll(
		".open-library-settings",
	);
	allLibrarySettingsButtons.forEach((button) => {
		button.addEventListener("click", () => {
			browser.tabs.create({
				url: browser.runtime.getURL("library/library.html#settings"),
			});
		});
	});

	// Handle openLibrarySettingsFromBackup button (in Advanced tab Backups section)
	const openLibrarySettingsFromBackup = document.getElementById(
		"openLibrarySettingsFromBackup",
	);
	if (openLibrarySettingsFromBackup) {
		openLibrarySettingsFromBackup.addEventListener("click", () => {
			browser.tabs.create({
				url: browser.runtime.getURL("library/library.html#settings"),
			});
		});
	}

	// openLibrarySettingsFromPrompts removed (prompts section moved to library settings)

	// Handle Main Library button
	const openMainLibrary = document.getElementById("openMainLibrary");
	if (openMainLibrary) {
		openMainLibrary.addEventListener("click", () => {
			browser.tabs.create({
				url: browser.runtime.getURL("library/library.html"),
			});
		});
	}

	// Handle shelf links (website-specific libraries)
	const shelfLinks = document.querySelectorAll(".shelf-link");
	shelfLinks.forEach((link) => {
		link.addEventListener("click", (e) => {
			e.preventDefault();
			const shelfId = link.getAttribute("data-shelf");
			if (shelfId) {
				browser.tabs.create({
					url: browser.runtime.getURL(
						`library/websites/${shelfId}/index.html`,
					),
				});
			}
		});
	});

	// Handle Backup Manager button
	const openBackupManager = document.getElementById("openBackupManager");
	if (openBackupManager) {
		openBackupManager.addEventListener("click", () => {
			// Open library settings on Backup tab
			// The hash will be handled to open settings, then we need to switch to backup tab
			// For now, just open settings - user can click Backup tab
			browser.tabs.create({
				url: browser.runtime.getURL("library/library.html#settings"),
			});
		});
	}

	driveBackupModeRadios.forEach((radio) => {
		radio.addEventListener("change", handleDriveBackupModeChange);
	});
	const continuousBackupCheckInterval = document.getElementById(
		"continuousBackupCheckInterval",
	);
	if (continuousBackupCheckInterval) {
		continuousBackupCheckInterval.addEventListener(
			"change",
			handleContinuousBackupCheckIntervalChange,
		);
		continuousBackupCheckInterval.addEventListener(
			"input",
			handleContinuousBackupCheckIntervalChange,
		);
	}
	if (driveAutoRestoreEnabled) {
		driveAutoRestoreEnabled.addEventListener(
			"change",
			handleDriveAutoRestoreToggle,
		);
	}
	if (driveSyncNowBtn) {
		driveSyncNowBtn.addEventListener("click", handleDriveSyncNow);
	}

	// Eye icon toggle for client secret visibility
	if (toggleClientSecretBtn && driveClientSecretInput) {
		toggleClientSecretBtn.addEventListener("click", () => {
			const isPassword = driveClientSecretInput.type === "password";
			driveClientSecretInput.type = isPassword ? "text" : "password";
			toggleClientSecretBtn.textContent = isPassword ? "🙈" : "👁️";
			toggleClientSecretBtn.title = isPassword
				? "Hide Client Secret"
				: "Show Client Secret";
		});
	}

	// ===== OAuth JSON Parsing Handlers =====
	if (parseOAuthJsonBtn) {
		parseOAuthJsonBtn.addEventListener("click", async () => {
			try {
				const jsonText = oauthJsonPaste?.value?.trim();
				if (!jsonText) {
					showOAuthParseResult(
						"Please paste your OAuth JSON first",
						"error",
					);
					return;
				}

				debugLog("Parsing OAuth JSON, length:", jsonText.length);
				const result = parseOAuthCredentials(jsonText);

				if (!result.valid) {
					debugError("OAuth parsing failed:", result.error);
					showOAuthParseResult(`❌ ${result.error}`, "error");
					return;
				}

				debugLog("OAuth parsed successfully:", {
					type: result.type,
					clientIdLength: result.clientId?.length,
					clientSecretLength: result.clientSecret?.length,
				});

				// Validate redirect URIs
				const uriValidation = validateRedirectUris(result.redirectUris);

				// Apply credentials to inputs (but don't save yet)
				if (driveClientIdInput)
					driveClientIdInput.value = result.clientId;
				if (driveClientSecretInput)
					driveClientSecretInput.value = result.clientSecret || "";
				// Show the secret after parsing so user can verify
				if (toggleClientSecretBtn && driveClientSecretInput) {
					driveClientSecretInput.type = "text";
					toggleClientSecretBtn.textContent = "🙈";
					toggleClientSecretBtn.title = "Hide Client Secret";
				}

				let message = `✅ Parsed ${result.type} credentials\n`;
				message += `Client ID: ${result.clientId.substring(0, 20)}...\n`;
				message += `Click "Save to Storage" to save credentials.`;

				if (uriValidation.warnings.length > 0) {
					message += `\n⚠️ ${uriValidation.warnings.join(", ")}`;
				}

				showOAuthParseResult(
					message,
					uriValidation.valid ? "success" : "warning",
				);
			} catch (err) {
				debugError("Failed to parse OAuth JSON", err);
				showOAuthParseResult(
					"❌ Failed to parse: " + err.message,
					"error",
				);
			}
		});
	}

	// ===== Save OAuth from JSON Handler =====
	if (saveOAuthFromJsonBtn) {
		saveOAuthFromJsonBtn.addEventListener("click", async () => {
			try {
				const clientId = driveClientIdInput?.value.trim() || "";
				const clientSecret = driveClientSecretInput?.value.trim() || "";

				if (!clientId) {
					showOAuthParseResult(
						"No Client ID to save. Parse JSON first.",
						"error",
					);
					return;
				}

				const existing = await browser.storage.local.get([
					"driveFolderId",
				]);
				const folderId =
					driveFolderIdInput?.value.trim() ||
					existing.driveFolderId ||
					"";

				debugLog("Saving OAuth credentials to storage...");
				await browser.storage.local.set({
					driveClientId: clientId,
					driveClientSecret: clientSecret,
					driveFolderId: folderId,
				});

				debugLog("Verifying saved OAuth credentials...");
				const saved = await browser.storage.local.get([
					"driveClientId",
					"driveClientSecret",
					"driveFolderId",
				]);

				debugLog("Saved values:", {
					clientIdMatch: saved.driveClientId === clientId,
					secretMatch: saved.driveClientSecret === clientSecret,
					folderIdMatch: saved.driveFolderId === folderId,
					savedClientIdLength: saved.driveClientId?.length,
					savedSecretLength: saved.driveClientSecret?.length,
				});

				if (
					saved.driveClientId !== clientId ||
					saved.driveClientSecret !== clientSecret ||
					saved.driveFolderId !== folderId
				) {
					debugError("OAuth verification failed!", {
						expected: {
							clientId: clientId.substring(0, 20),
							secretLength: clientSecret?.length,
							folderId,
						},
						actual: {
							clientId: saved.driveClientId?.substring(0, 20),
							secretLength: saved.driveClientSecret?.length,
							folderId: saved.driveFolderId,
						},
					});
					showOAuthParseResult(
						"❌ Failed to save credentials",
						"error",
					);
					showStatus("❌ OAuth settings failed to persist", "error");
					return;
				}

				debugLog("OAuth credentials saved and verified successfully!");
				showOAuthParseResult(
					"✅ Credentials saved to storage!",
					"success",
				);
				showStatus("✅ OAuth settings saved!", "success");
				await updateDriveUI();
			} catch (err) {
				debugError("Failed to save OAuth settings", err);
				showOAuthParseResult(
					"❌ Failed to save: " + err.message,
					"error",
				);
				showStatus(
					"❌ Failed to save OAuth settings: " + err.message,
					"error",
				);
			}
		});
	}

	function showOAuthParseResult(message, type = "info") {
		if (!oauthParseResult) return;
		oauthParseResult.style.display = "block";
		oauthParseResult.textContent = message;
		oauthParseResult.style.whiteSpace = "pre-wrap";
		oauthParseResult.style.wordWrap = "break-word";

		// Use CSS variables for colors that respect theme
		let backgroundColor, textColor;
		if (type === "error") {
			textColor = "#ef4444";
			backgroundColor = "rgba(239, 68, 68, 0.1)";
		} else if (type === "success") {
			textColor = "#22c55e";
			backgroundColor = "rgba(34, 197, 94, 0.1)";
		} else if (type === "warning") {
			textColor = "#f59e0b";
			backgroundColor = "rgba(245, 158, 11, 0.1)";
		} else {
			textColor = "var(--text-secondary, #9ca3af)";
			backgroundColor = "var(--accent-primary, rgba(0, 0, 0, 0.1))";
		}

		oauthParseResult.style.color = textColor;
		oauthParseResult.style.backgroundColor = backgroundColor;
	}

	if (saveOAuthSettingsBtn) {
		saveOAuthSettingsBtn.addEventListener("click", async () => {
			try {
				const clientId = driveClientIdInput?.value.trim() || "";
				const clientSecret = driveClientSecretInput?.value.trim() || "";
				const folderId = driveFolderIdInput?.value.trim() || "";

				if (!clientId) {
					showStatus("Please enter a Client ID", "error");
					return;
				}

				debugLog("Saving OAuth credentials:", {
					clientIdLength: clientId.length,
					clientSecretLength: clientSecret.length,
					folderIdLength: folderId.length,
				});

				await browser.storage.local.set({
					driveClientId: clientId,
					driveClientSecret: clientSecret,
					driveFolderId: folderId,
				});

				const saved = await browser.storage.local.get([
					"driveClientId",
					"driveClientSecret",
					"driveFolderId",
				]);

				debugLog("Verifying saved OAuth credentials:", {
					savedClientId: saved.driveClientId?.substring(0, 20),
					savedSecretLength: saved.driveClientSecret?.length,
					expectedClientId: clientId.substring(0, 20),
					expectedSecretLength: clientSecret.length,
				});

				if (
					saved.driveClientId !== clientId ||
					saved.driveClientSecret !== clientSecret ||
					saved.driveFolderId !== folderId
				) {
					debugError("OAuth settings failed to persist!", {
						saved,
						expected: { clientId, clientSecret, folderId },
					});
					showStatus(
						"❌ OAuth settings failed to persist - check console",
						"error",
					);
					return;
				}

				showStatus("✅ OAuth settings saved!", "success");
				if (typeof showOAuthParseResult === "function") {
					showOAuthParseResult(
						"✅ OAuth settings saved successfully",
						"success",
					);
				}
				if (driveClientIdInput) driveClientIdInput.value = clientId;
				if (driveClientSecretInput)
					driveClientSecretInput.value = clientSecret;
				if (driveFolderIdInput) driveFolderIdInput.value = folderId;
				await updateDriveUI();
			} catch (err) {
				debugError("Error saving OAuth settings:", err);
				showStatus(
					"❌ Error saving OAuth settings: " + err.message,
					"error",
				);
			}
		});
	}

	// ===== Comprehensive Backup Handlers =====
	if (createComprehensiveBackupBtn) {
		createComprehensiveBackupBtn.addEventListener("click", async () => {
			try {
				createComprehensiveBackupBtn.disabled = true;
				createComprehensiveBackupBtn.textContent = "⏳ Creating...";

				const backup = await createComprehensiveBackup({
					type: BACKUP_OPTIONS.FULL,
					includeApiKeys: backupIncludeApiKeys?.checked ?? true,
					includeCredentials:
						backupIncludeCredentials?.checked ?? true,
				});

				downloadBackupAsFile(backup);
				showStatus(
					`✅ Full backup downloaded (${backup.metadata.novelCount} novels)`,
					"success",
				);
			} catch (error) {
				debugError("Comprehensive backup failed:", error);
				showStatus(`❌ Backup failed: ${error.message}`, "error");
			} finally {
				createComprehensiveBackupBtn.disabled = false;
				createComprehensiveBackupBtn.textContent = "💾 Full Backup";
			}
		});
	}

	if (restoreComprehensiveBackupBtn) {
		restoreComprehensiveBackupBtn.addEventListener("click", () => {
			comprehensiveBackupFile?.click();
		});
	}

	if (comprehensiveBackupFile) {
		comprehensiveBackupFile.addEventListener("change", async (e) => {
			const file = e.target.files?.[0];
			if (!file) return;

			try {
				const backup = await readBackupFromFile(file);

				if (!backup.version || !backup.data) {
					throw new Error("Invalid backup file format");
				}

				const novelCount = backup.metadata?.novelCount || 0;
				const hasApiKey = backup.metadata?.hasApiKey;
				const hasCredentials = backup.metadata?.hasDriveCredentials;

				// Build confirmation message with version info
				let confirmMsg = `Restore this backup?\n\n`;

				// Add version information if available
				if (backup.extensionVersion) {
					confirmMsg += `📦 Backup Version: ${backup.extensionVersion}\n`;
				}
				if (backup.version) {
					confirmMsg += `📋 Format Version: ${backup.version}\n`;
				}
				confirmMsg += `📚 ${novelCount} novels\n`;
				confirmMsg += `🔑 API Key: ${hasApiKey ? "Yes" : "No"}\n`;
				confirmMsg += `🔐 OAuth Credentials: ${hasCredentials ? "Yes" : "No"}\n\n`;
				confirmMsg += `Mode: MERGE (preserves existing data)`;

				if (!confirm(confirmMsg)) {
					e.target.value = "";
					return;
				}

				const result = await restoreComprehensiveBackup(backup, {
					mode: "merge",
					restoreApiKeys: hasApiKey && confirm("Restore API keys?"),
					restoreCredentials:
						hasCredentials && confirm("Restore OAuth credentials?"),
				});

				if (result.success) {
					// Show version warnings if any
					if (result.versionInfo?.warnings?.length > 0) {
						const warningMsg =
							result.versionInfo.warnings.join("\n");
						showStatus(`⚠️ ${warningMsg}`, "warning");
						setTimeout(() => {
							showStatus(
								`✅ Restored ${result.restoredKeys.length} items!`,
								"success",
							);
						}, 3000);
					} else {
						showStatus(
							`✅ Restored ${result.restoredKeys.length} items!`,
							"success",
						);
					}
					// Reload popup to reflect changes
					setTimeout(() => location.reload(), 1500);
				}
			} catch (error) {
				debugError("Restore failed:", error);
				showStatus(`❌ Restore failed: ${error.message}`, "error");
			}

			e.target.value = "";
		});
	}

	// ===== Rolling Backup Handlers =====
	async function loadRollingBackups() {
		if (!rollingBackupList) return;

		const backups = await listRollingBackups();

		if (backups.length === 0) {
			rollingBackupList.innerHTML = `
				<div class="no-backups" style="text-align: center; padding: 15px; color: #888; font-size: 12px">
					No rolling backups yet. Enable auto-backup or create one manually.
				</div>`;
			return;
		}

		rollingBackupList.innerHTML = backups
			.map(
				(b) => `
			<div class="backup-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; margin-bottom: 6px; font-size: 12px">
				<div>
					<div style="font-weight: 500">${b.dateStr}</div>
					<div style="color: #888; font-size: 11px">${b.novelCount} novels • ${b.reason}</div>
				</div>
				<div style="display: flex; gap: 4px">
					<button class="rolling-restore" data-key="${b.key}" style="padding: 4px 8px; font-size: 11px">↩️</button>
					<button class="rolling-download" data-key="${b.key}" style="padding: 4px 8px; font-size: 11px">💾</button>
					<button class="rolling-delete" data-key="${b.key}" style="padding: 4px 8px; font-size: 11px; color: #ef4444">🗑️</button>
				</div>
			</div>
		`,
			)
			.join("");

		// Attach event listeners
		rollingBackupList
			.querySelectorAll(".rolling-restore")
			.forEach((btn) => {
				btn.addEventListener("click", async () => {
					const backup = await getRollingBackup(btn.dataset.key);
					if (
						backup &&
						confirm("Restore this backup? (Merge mode)")
					) {
						await restoreComprehensiveBackup(backup, {
							mode: "merge",
						});
						showStatus("✅ Backup restored!", "success");
						setTimeout(() => location.reload(), 1000);
					}
				});
			});

		rollingBackupList
			.querySelectorAll(".rolling-download")
			.forEach((btn) => {
				btn.addEventListener("click", async () => {
					const backup = await getRollingBackup(btn.dataset.key);
					if (backup) {
						downloadBackupAsFile(backup);
					}
				});
			});

		rollingBackupList.querySelectorAll(".rolling-delete").forEach((btn) => {
			btn.addEventListener("click", async () => {
				if (confirm("Delete this backup?")) {
					await deleteRollingBackup(btn.dataset.key);
					await loadRollingBackups();
					showStatus("Backup deleted", "success");
				}
			});
		});
	}

	if (createRollingBackupBtn) {
		createRollingBackupBtn.addEventListener("click", async () => {
			try {
				createRollingBackupBtn.disabled = true;
				createRollingBackupBtn.textContent = "⏳ Creating...";

				await createRollingBackup("manual");
				await loadRollingBackups();
				showStatus("✅ Rolling backup created!", "success");
			} catch (error) {
				debugError("Rolling backup failed:", error);
				showStatus(`❌ Failed: ${error.message}`, "error");
			} finally {
				createRollingBackupBtn.disabled = false;
				createRollingBackupBtn.textContent =
					"➕ Create Rolling Backup Now";
			}
		});
	}

	// Load rolling backups on popup open
	loadRollingBackups();

	// Load backups and novels on popup open
	(async () => {
		await libraryBackupManager.initializeConfig();
		const config = await libraryBackupManager.getConfig();

		if (autoBackupCheckbox) {
			autoBackupCheckbox.checked = config.autoBackupEnabled || false;
		}

		document
			.querySelectorAll('input[name="mergeMode"]')
			.forEach((radio) => {
				if (radio.value === (config.mergeMode || "merge")) {
					radio.checked = true;
				}
			});

		await loadBackupHistory();
		// Update Google Drive UI on popup open
		await updateDriveUI();
		// Update notification badge on popup open (so it shows before clicking tab)
		await updateNotificationBadge();

		// Default tab selection: go to Novels after API key is set
		try {
			const stored = await browser.storage.local.get([
				"apiKey",
				"backupApiKeys",
			]);
			const hasKey =
				!!stored.apiKey ||
				(Array.isArray(stored.backupApiKeys) &&
					stored.backupApiKeys.length > 0);
			setActiveTab(hasKey ? "novels" : "config");
			if (hasKey) {
				await loadNovelsTab();
			}
		} catch (err) {
			debugError("Failed to select default tab", err);
		}
	})();

	// Notifications tab is now a proper tab handled by tab switching above
	// (Old modal toggle code removed)

	// Log that the popup is initialized
	debugLog("RanobeGemini popup initialized");

	// Load site-specific prompts (only when UI is present)
	const sitePromptsContainer = document.getElementById(
		"siteSpecificPromptsContainer",
	);
	if (sitePromptsContainer) {
		loadSiteHandlerPrompts();
	}

	// Initialize info tab with dynamic data
	initInfoTab();

	// Add tab change listener to update prompts when switching to the prompts tab
	if (sitePromptsContainer) {
		document.querySelectorAll(".tab-btn").forEach(function (button) {
			button.addEventListener("click", function () {
				if (button.getAttribute("data-tab") === "prompts") {
					// Reload site-specific prompts when prompts tab is selected
					loadSiteHandlerPrompts();
				}
			});
		});
	}

	/**
	 * Initialize Info tab with dynamic version and supported sites
	 */
	async function initInfoTab() {
		try {
			// Get version from manifest
			const manifestUrl = browser.runtime.getURL("manifest.json");
			const manifestResponse = await fetch(manifestUrl);
			const manifest = await manifestResponse.json();
			const version = manifest.version || "Unknown";

			// Update version badge
			const versionBadge = document.querySelector(".version-badge");
			if (versionBadge) {
				versionBadge.textContent = `Version ${version}`;
			}

			// Build supported sites list from SHELF_REGISTRY
			const supportedSitesList = document.querySelector(
				".faq-item:nth-child(3) .faq-answer ul",
			);
			if (supportedSitesList && SHELVES) {
				let sitesHTML = "";
				Object.values(SHELVES).forEach((shelf) => {
					const emoji = shelf.emoji || "📚";
					const primaryDomain =
						shelf.primaryDomain ||
						(shelf.domains && shelf.domains[0]) ||
						"N/A";
					const allDomains =
						shelf.domains && shelf.domains.length > 1
							? shelf.domains.join(", ")
							: primaryDomain;
					sitesHTML += `<li>${emoji} <strong>${escapeHtml(
						shelf.name,
					)}</strong> — <code>${escapeHtml(allDomains)}</code></li>`;
				});
				supportedSitesList.innerHTML = sitesHTML;
			}
		} catch (error) {
			debugError("Error initializing info tab:", error);
		}
	}

	/**
	 * Initialize Notifications Tab
	 */
	async function initNotificationsTab() {
		try {
			await notificationManager.initialize();
			await loadNotifications();
			await updateNotificationBadge();
		} catch (error) {
			debugError("Error initializing notifications tab:", error);
		}
	}

	/**
	 * Load and display notifications
	 */
	async function loadNotifications() {
		const filterType =
			currentNotificationFilter === "all"
				? null
				: currentNotificationFilter;

		let notifications = [];
		let stats = null;
		try {
			const response = await browser.runtime.sendMessage({
				action: "getNotifications",
				type: filterType,
				grouped: true, // Request grouped notifications
			});
			if (response?.success) {
				notifications = response.notifications || [];
				stats = response.stats || null;
			} else {
				throw new Error(response?.error || "Notification fetch failed");
			}
		} catch (_error) {
			notifications = notificationManager.getAll({
				type: filterType,
				grouped: true,
			});
			stats = notificationManager.getStats();
		}

		// Update stats
		if (stats) {
			if (totalNotifsSpan) totalNotifsSpan.textContent = stats.total;
			if (unreadNotifsSpan) unreadNotifsSpan.textContent = stats.unread;
		} else {
			const fallbackStats = notificationManager.getStats();
			if (totalNotifsSpan)
				totalNotifsSpan.textContent = fallbackStats.total;
			if (unreadNotifsSpan)
				unreadNotifsSpan.textContent = fallbackStats.unread;
		}

		// Clear container
		if (!notificationsContainer) return;

		if (notifications.length === 0) {
			notificationsContainer.innerHTML = `
				<div class="no-notifications">
					<p>📭</p>
					<p>No notifications</p>
					<p class="description">${
						currentNotificationFilter === "all"
							? "Notifications will appear here as you use the extension"
							: `No ${currentNotificationFilter} notifications`
					}</p>
				</div>
			`;
			return;
		}

		// Build notifications HTML
		notificationsContainer.innerHTML = notifications
			.map((notif) => renderNotification(notif))
			.join("");

		// Add event listeners
		notificationsContainer
			.querySelectorAll(".notification-item")
			.forEach((item) => {
				const id = item.dataset.id;
				const notif = notifications.find((n) => n.id === id);
				item.addEventListener("click", async (e) => {
					// Don't mark as read if clicking action buttons
					if (e.target.closest(".notification-action-btn")) return;
					if (e.target.closest(".notification-library-link")) return;

					try {
						// If grouped notification, mark all underlying notifications
						if (notif?.isGroup && notif?.groupedNotifications) {
							await Promise.all(
								notif.groupedNotifications.map((n) =>
									browser.runtime
										.sendMessage({
											action: "markNotificationRead",
											id: n.id,
										})
										.catch(() =>
											notificationManager.markAsRead(
												n.id,
											),
										),
								),
							);
						} else {
							await browser.runtime.sendMessage({
								action: "markNotificationRead",
								id,
							});
						}
					} catch (_err) {
						if (notif?.isGroup && notif?.groupedNotifications) {
							notif.groupedNotifications.forEach((n) =>
								notificationManager.markAsRead(n.id),
							);
						} else {
							await notificationManager.markAsRead(id);
						}
					}
					item.classList.remove("unread");
					await updateNotificationBadge();
				});
			});

		// Add expand/collapse listeners for grouped notifications
		notificationsContainer
			.querySelectorAll(".notification-group-toggle")
			.forEach((toggle) => {
				toggle.addEventListener("click", (e) => {
					e.stopPropagation();
					const group = toggle
						.closest(".notification-item")
						.querySelector(".notification-group-items");
					group.classList.toggle("expanded");
					toggle.textContent = group.classList.contains("expanded")
						? "▼ Hide"
						: `▶ Show ${toggle.dataset.count} related`;
				});
			});

		// Add library link listeners
		notificationsContainer
			.querySelectorAll(".notification-library-link")
			.forEach((link) => {
				link.addEventListener("click", async (e) => {
					e.preventDefault();
					e.stopPropagation();
					const novelId = link.dataset.novelId;
					const shelfId = link.dataset.shelfId;
					await openNovelInLibrary(novelId, shelfId);
				});
			});

		notificationsContainer
			.querySelectorAll(".notification-action-btn")
			.forEach((btn) => {
				btn.addEventListener("click", (e) => {
					e.stopPropagation();
					const action = btn.dataset.action;
					const id = btn.closest(".notification-item").dataset.id;
					if (action === "delete") {
						deleteNotification(id);
					}
				});
			});
	}

	/**
	 * Render a single notification
	 */
	function renderNotification(notif) {
		const relativeTime = formatRelativeTime(notif.timestamp);
		const fullTime = new Date(notif.timestamp).toLocaleString();

		// Handle grouped notifications
		if (notif.isGroup && notif.groupedNotifications) {
			return renderGroupedNotification(notif);
		}

		return `
			<div class="notification-item ${notif.read ? "" : "unread"}" data-id="${escapeHtml(notif.id)}">
				<div class="notification-header">
					<span class="notification-type-badge ${notif.type}">${notif.type}</span>
					<span class="notification-time" title="${fullTime}">${relativeTime}</span>
				</div>
				${notif.title ? `<div class="notification-title">${escapeHtml(notif.title)}</div>` : ""}
				<div class="notification-message">${escapeHtml(notif.message)}</div>
				${renderNotificationMeta(notif)}
				<div class="notification-actions">
					<button class="notification-action-btn" data-action="delete">🗑️ Delete</button>
				</div>
			</div>
		`;
	}

	/**
	 * Render a grouped notification
	 */
	function renderGroupedNotification(notif) {
		const relativeTime = formatRelativeTime(notif.timestamp);
		const fullTime = new Date(notif.timestamp).toLocaleString();
		const startTime = formatRelativeTime(notif.timeRange.start);

		return `
			<div class="notification-item notification-group ${notif.read ? "" : "unread"}" data-id="${escapeHtml(notif.id)}">
				<div class="notification-header">
					<span class="notification-type-badge ${notif.type}">${notif.type}</span>
					<span class="notification-group-badge">${notif.groupCount} updates</span>
					<span class="notification-time" title="${fullTime}">${startTime} - ${relativeTime}</span>
				</div>
				${notif.title ? `<div class="notification-title">${escapeHtml(notif.title)}</div>` : ""}
				<div class="notification-message">${escapeHtml(notif.message)}</div>
				${renderNotificationMeta(notif)}
				<button class="notification-group-toggle" data-count="${notif.groupCount}">
					▶ Show ${notif.groupCount} related
				</button>
				<div class="notification-group-items">
					${notif.groupedNotifications.map((n) => renderGroupedItem(n)).join("")}
				</div>
				<div class="notification-actions">
					<button class="notification-action-btn" data-action="delete">🗑️ Delete</button>
				</div>
			</div>
		`;
	}

	/**
	 * Render a single item within a group
	 */
	function renderGroupedItem(notif) {
		const relativeTime = formatRelativeTime(notif.timestamp);
		const fullTime = new Date(notif.timestamp).toLocaleString();

		return `
			<div class="notification-group-item">
				<div class="notification-group-item-header">
					<span class="notification-type-badge ${notif.type}">${notif.type}</span>
					<span class="notification-time" title="${fullTime}">${relativeTime}</span>
				</div>
				<div class="notification-message">${escapeHtml(notif.message)}</div>
			</div>
		`;
	}

	/**
	 * Render notification metadata
	 */
	function renderNotificationMeta(notif) {
		let metaHTML = "";

		if (notif.url || notif.novelData || notif.source) {
			metaHTML += '<div class="notification-meta">';

			if (notif.url) {
				metaHTML += `
					<div class="notification-meta-item">
						<a href="${escapeHtml(notif.url)}" target="_blank" class="notification-url">
							🔗 ${escapeHtml(truncateUrl(notif.url))}
						</a>
					</div>
				`;
			}

			if (notif.source) {
				metaHTML += `
					<div class="notification-meta-item">
						<strong>Source:</strong> ${escapeHtml(notif.source)}
					</div>
				`;
			}

			if (notif.novelData) {
				const novelTitle =
					notif.novelData.title ||
					notif.novelData.bookTitle ||
					"Unknown Novel";
				const novelId = notif.novelData.novelId;
				const shelfId = notif.novelData.shelfId;

				metaHTML += `
					<div class="notification-novel-data">
						<div class="notification-novel-title">${escapeHtml(novelTitle)}</div>
						<div class="notification-novel-meta">
							${notif.novelData.author ? `by ${escapeHtml(notif.novelData.author)}` : ""}
							${notif.novelData.currentChapter ? ` • Ch. ${notif.novelData.currentChapter}` : ""}
						</div>
						${
							novelId && shelfId
								? `<button class="notification-library-link" data-novel-id="${escapeHtml(novelId)}" data-shelf-id="${escapeHtml(shelfId)}">
									📚 View in Library
								</button>`
								: ""
						}
					</div>
				`;
			}

			if (notif.metadata && Object.keys(notif.metadata).length > 0) {
				metaHTML += `
					<div class="notification-meta-item notification-meta-details">
						<strong>Details:</strong>
						${renderNotificationMetadataList(notif.metadata)}
					</div>
				`;
			}

			metaHTML += "</div>";
		}

		return metaHTML;
	}

	function renderNotificationMetadataList(metadata) {
		const entries = Object.entries(metadata)
			.filter(([, value]) => value !== undefined && value !== null)
			.slice(0, 8);

		if (entries.length === 0) return "";

		const items = entries
			.map(([key, value]) => {
				let displayValue = value;
				if (typeof value === "object") {
					try {
						displayValue = JSON.stringify(value);
					} catch (_err) {
						displayValue = "[Object]";
					}
				}
				const text = String(displayValue);
				const trimmed =
					text.length > 120 ? `${text.slice(0, 117)}...` : text;
				return `<div class="notification-meta-detail"><strong>${escapeHtml(
					key,
				)}:</strong> ${escapeHtml(trimmed)}</div>`;
			})
			.join("");

		return `<div class="notification-meta-details-list">${items}</div>`;
	}

	/**
	 * Truncate URL for display
	 */
	function truncateUrl(url) {
		try {
			const urlObj = new URL(url);
			const path =
				urlObj.pathname.length > 30
					? urlObj.pathname.substring(0, 30) + "..."
					: urlObj.pathname;
			return `${urlObj.hostname}${path}`;
		} catch (e) {
			return url.length > 50 ? url.substring(0, 50) + "..." : url;
		}
	}

	/**
	 * Delete a notification
	 */
	async function deleteNotification(id) {
		try {
			await browser.runtime.sendMessage({
				action: "deleteNotification",
				id,
			});
		} catch (_err) {
			await notificationManager.delete(id);
		}
		await loadNotifications();
		await updateNotificationBadge();
	}

	/**
	 * Open novel in library (opens library page with modal)
	 */
	async function openNovelInLibrary(novelId, shelfId) {
		try {
			const shelf = Object.values(SHELVES).find((s) => s.id === shelfId);
			const shelfPage = shelf
				? `library/websites/${encodeURIComponent(shelfId)}/index.html`
				: "library/library.html";
			const libraryUrl = browser.runtime.getURL(
				`${shelfPage}?novel=${encodeURIComponent(novelId)}`,
			);

			// Open in new tab
			await browser.tabs.create({
				url: libraryUrl,
				active: true,
			});

			// Close popup
			window.close();
		} catch (error) {
			debugError("Failed to open novel in library:", error);
			showStatus("Failed to open library. Please try again.", "error");
		}
	}

	/**
	 * Update notification badge
	 */
	async function updateNotificationBadge() {
		if (!notificationBadge) return;
		let unreadCount = 0;
		try {
			const response = await browser.runtime.sendMessage({
				action: "getNotifications",
				limit: 0,
			});
			if (response?.success && response.stats) {
				unreadCount = response.stats.unread || 0;
			} else {
				unreadCount = notificationManager.getUnreadCount();
			}
		} catch (_error) {
			unreadCount = notificationManager.getUnreadCount();
		}
		const badgeText = unreadCount > 999 ? "999+" : `${unreadCount}`;
		if (unreadCount > 0) {
			notificationBadge.textContent = badgeText;
			notificationBadge.style.display = "inline-block";
		} else {
			notificationBadge.style.display = "none";
		}

		try {
			const actionApi = browser.action || browser.browserAction;
			if (actionApi?.setBadgeText) {
				actionApi.setBadgeText({
					text: unreadCount > 0 ? badgeText : "",
				});
				if (actionApi.setBadgeBackgroundColor) {
					actionApi.setBadgeBackgroundColor({ color: "#ef4444" });
				}
			}
		} catch (_err) {
			// ignore badge errors for browsers that do not support it
		}
	}

	// Notification tab event listeners
	if (filterButtons) {
		filterButtons.forEach((btn) => {
			btn.addEventListener("click", async () => {
				filterButtons.forEach((b) => b.classList.remove("active"));
				btn.classList.add("active");
				currentNotificationFilter = btn.dataset.filter;
				await loadNotifications();
			});
		});
	}

	if (markAllReadBtn) {
		markAllReadBtn.addEventListener("click", async () => {
			try {
				await browser.runtime.sendMessage({
					action: "markAllNotificationsRead",
				});
			} catch (_err) {
				await notificationManager.markAllAsRead();
			}
			await loadNotifications();
			await updateNotificationBadge();
			showStatus("All notifications marked as read", "success");
		});
	}

	if (clearNotificationsBtn) {
		clearNotificationsBtn.addEventListener("click", async () => {
			if (
				confirm(
					"Are you sure you want to clear all notifications? This cannot be undone.",
				)
			) {
				try {
					await browser.runtime.sendMessage({
						action: "clearNotifications",
					});
				} catch (_err) {
					await notificationManager.clearAll();
				}
				await loadNotifications();
				await updateNotificationBadge();
				showStatus("All notifications cleared", "info");
			}
		});
	}

	// Tab switching for notifications is handled in the main tab switching code above
	// Initialize notifications badge on startup (content loads on tab switch)
	updateNotificationBadge();
}
