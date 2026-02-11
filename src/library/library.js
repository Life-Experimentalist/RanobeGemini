/**
 * Novel Library Page Script
 * Handles UI interactions and data loading for the library page
 */

import {
	novelLibrary,
	SHELVES,
	READING_STATUS,
	READING_STATUS_INFO,
} from "../utils/novel-library.js";
import {
	DEFAULT_PROMPT,
	DEFAULT_SUMMARY_PROMPT,
	DEFAULT_SHORT_SUMMARY_PROMPT,
	DEFAULT_PERMANENT_PROMPT,
	DEFAULT_DRIVE_CLIENT_ID,
} from "../utils/constants.js";
import { isSupportedDomain } from "../utils/domain-constants.js";
import { debugLog, debugError } from "../utils/logger.js";
import {
	filterEnabledShelves,
	getSiteSettings,
	getDefaultSiteSettings,
	isSiteEnabled,
	saveSiteSettings,
	SITE_SETTINGS_KEY,
} from "../utils/site-settings.js";
import {
	WEBSITE_SETTINGS_DEFINITIONS,
	renderWebsiteSettingsPanel,
} from "./site-settings-ui.js";
import {
	createComprehensiveBackup,
	restoreComprehensiveBackup,
	downloadBackupAsFile,
	readBackupFromFile,
	parseOAuthCredentials,
	validateRedirectUris,
	createRollingBackup,
	listRollingBackups,
	getRollingBackup,
	deleteRollingBackup,
	BACKUP_OPTIONS,
} from "../utils/comprehensive-backup.js";
import { libraryBackupManager } from "../utils/library-backup-manager.js";
import {
	getTelemetryConfig,
	saveTelemetryConfig,
	isFirstRun,
	markFirstRunComplete,
	optInTelemetry,
	optOutTelemetry,
	trackFeatureUsage,
} from "../utils/telemetry.js";
// import { getCardRenderer } from "./websites/novel-card-base.js";

// Modal renderer cache
const modalRendererCache = {};
const modalStylesInjected = new Set();

// Prefix site-specific modal CSS so it only affects the modal when that site's
// metadata is being rendered. This prevents styles from leaking into the main
// library UI.
function scopeModalCss(cssText, scopeSelector) {
	if (!cssText || !scopeSelector) return cssText;
	return cssText
		.split("}")
		.map((block) => {
			const parts = block.split("{");
			if (parts.length < 2) return block;
			const selector = parts[0].trim();
			const rules = parts.slice(1).join("{");
			if (!selector || selector.startsWith("@")) return block; // Skip @media/@keyframes
			return `${scopeSelector} ${selector} {${rules}}`;
		})
		.join("}");
}

// State
let currentView = "shelves";
let currentSort = "recent";
let currentStatusFilter = "all";
let searchQuery = "";
let allNovels = [];
let siteSettings = {};
let librarySettings = {
	autoHoldEnabled: true,
	autoHoldDays: 7,
};

// Shared theme defaults (mirrors popup defaults)
const defaultTheme = {
	mode: "auto",
	accentPrimary: "#4b5563",
	accentSecondary: "#6b7280",
	bgColor: "#0f172a",
	textColor: "#e5e7eb",
};

const themePalettes = {
	dark: {
		"primary-color": "#4b5563",
		"primary-hover": "#6b7280",
		"secondary-color": "#9ca3af",
		"danger-color": "#ef4444",
		"success-color": "#22c55e",
		"bg-primary": "#0f172a",
		"bg-secondary": "#111827",
		"bg-tertiary": "#1f2937",
		"bg-card": "#1f2937",
		"bg-card-hover": "#2b3544",
		"text-primary": "#e5e7eb",
		"text-secondary": "#9ca3af",
		"text-muted": "#6b7280",
		"border-color": "#2f3644",
		"border-light": "#3b4454",
	},
	light: {
		"primary-color": "#4b5563",
		"primary-hover": "#6b7280",
		"secondary-color": "#6b7280",
		"danger-color": "#ef4444",
		"success-color": "#22c55e",
		"bg-primary": "#f3f4f6",
		"bg-secondary": "#ffffff",
		"bg-tertiary": "#e5e7eb",
		"bg-card": "#ffffff",
		"bg-card-hover": "#f3f4f6",
		"text-primary": "#111827",
		"text-secondary": "#374151",
		"text-muted": "#6b7280",
		"border-color": "#e5e7eb",
		"border-light": "#d1d5db",
	},
};

// Track metadata refresh snapshots to show before/after banners
const REFRESH_PREFIX = "rg-refresh-snapshot-";
const REFRESH_TAB_TIMEOUT_MS = 18000; // Allow extra time for slower sites before auto-closing refresh tab

/**
 * Get relative time string (e.g., "2 hours ago", "3 days ago")
 * @param {Date} date - The date to compare
 * @returns {string} Relative time string
 */
function getRelativeTimeString(date) {
	const now = new Date();
	const diffMs = now - date;
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSeconds < 60) return "Just now";
	if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
	if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
	if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
	if (diffDays < 30) {
		const weeks = Math.floor(diffDays / 7);
		return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
	}
	if (diffDays < 365) {
		const months = Math.floor(diffDays / 30);
		return `${months} month${months !== 1 ? "s" : ""} ago`;
	}
	const years = Math.floor(diffDays / 365);
	return `${years} year${years !== 1 ? "s" : ""} ago`;
}

function getRefreshTabTimeout(url) {
	if (!url) return REFRESH_TAB_TIMEOUT_MS;

	try {
		const { hostname } = new URL(url);
		// Some sites render slowly; give them more breathing room
		if (hostname.includes("archiveofourown")) return 22000;
		if (hostname.includes("ranobes")) return 20000;
		if (hostname.includes("scribblehub")) return 20000;
		return REFRESH_TAB_TIMEOUT_MS;
	} catch (_err) {
		return REFRESH_TAB_TIMEOUT_MS;
	}
}

// DOM Elements
const elements = {
	// Stats
	totalNovels: document.getElementById("total-novels"),
	totalChapters: document.getElementById("total-chapters"),
	shelfCount: document.getElementById("shelf-count"),

	// Views
	shelvesView: document.getElementById("shelves-view"),
	recentView: document.getElementById("recent-view"),
	allView: document.getElementById("all-view"),
	listsView: document.getElementById("lists-view"),
	recentNovels: document.getElementById("recent-novels"),
	allNovels: document.getElementById("all-novels"),
	listsNovels: document.getElementById("lists-novels"),
	listsTitle: document.getElementById("lists-title"),
	listsStats: document.getElementById("lists-stats"),

	// Reading Status Filter
	readingStatusFilter: document.getElementById("reading-status-filter"),
	statusFilterBtns: document.querySelectorAll(".status-filter-btn"),

	// States
	emptyState: document.getElementById("empty-state"),
	loadingState: document.getElementById("loading-state"),

	// Controls
	searchInput: document.getElementById("search-input"),
	sortSelect: document.getElementById("sort-select"),
	viewButtons: document.querySelectorAll(".view-btn"),
	refreshBtn: document.getElementById("refresh-btn"),
	settingsBtn: document.getElementById("settings-btn"),
	siteAutoAddList: document.getElementById("site-autoadd-list"),

	// Novel Modal
	novelModal: document.getElementById("novel-modal"),
	modalClose: document.getElementById("modal-close"),
	modalCover: document.getElementById("modal-cover"),
	modalTitle: document.getElementById("modal-title"),
	modalAuthor: document.getElementById("modal-author"),
	modalShelf: document.getElementById("modal-shelf"),
	modalStatus: document.getElementById("modal-status"),
	modalStatusSelector: document.getElementById("modal-status-selector"),
	modalChapters: document.getElementById("modal-chapters"),
	modalEnhanced: document.getElementById("modal-enhanced"),
	modalLastRead: document.getElementById("modal-last-read"),
	modalDescription: document.getElementById("modal-description"),
	modalGenres: document.getElementById("modal-genres"),
	modalGenresContainer: document.getElementById("modal-genres-container"),
	modalContinueBtn: document.getElementById("modal-continue-btn"),
	modalSourceBtn: document.getElementById("modal-source-btn"),
	modalRefreshBtn: document.getElementById("modal-refresh-btn"),
	modalEditBtn: document.getElementById("modal-edit-btn"),
	modalRemoveBtn: document.getElementById("modal-remove-btn"),

	// Modal Metadata Sections
	modalMetadataContainer: document.getElementById("modal-metadata-container"),
	modalRatingSection: document.getElementById("modal-rating-section"),
	modalRating: document.getElementById("modal-rating"),
	modalWarningsRow: document.getElementById("modal-warnings-row"),
	modalWarnings: document.getElementById("modal-warnings"),
	modalCategoriesRow: document.getElementById("modal-categories-row"),
	modalCategories: document.getElementById("modal-categories"),
	modalFandomsSection: document.getElementById("modal-fandoms-section"),
	modalFandoms: document.getElementById("modal-fandoms"),
	modalRelationshipsSection: document.getElementById(
		"modal-relationships-section",
	),
	modalRelationships: document.getElementById("modal-relationships"),
	modalCharactersSection: document.getElementById("modal-characters-section"),
	modalCharacters: document.getElementById("modal-characters"),
	modalAdditionalTagsSection: document.getElementById(
		"modal-additional-tags-section",
	),
	modalAdditionalTags: document.getElementById("modal-additional-tags"),
	modalWorkStatsSection: document.getElementById("modal-work-stats-section"),
	modalWorkStats: document.getElementById("modal-work-stats"),

	// Edit Modal
	editModal: document.getElementById("edit-modal"),
	editClose: document.getElementById("edit-close"),
	editForm: document.getElementById("edit-novel-form"),
	editTitle: document.getElementById("edit-title"),
	editAuthor: document.getElementById("edit-author"),
	editCover: document.getElementById("edit-cover"),
	editCoverPreview: document.getElementById("edit-cover-preview"),
	editDescription: document.getElementById("edit-description"),
	editStatus: document.getElementById("edit-status"),
	editTotalChapters: document.getElementById("edit-total-chapters"),
	editGenres: document.getElementById("edit-genres"),
	editCustomPrompt: document.getElementById("edit-custom-prompt"),
	editCancelBtn: document.getElementById("edit-cancel-btn"),

	// Settings Modal
	settingsModal: document.getElementById("settings-modal"),
	settingsClose: document.getElementById("settings-close"),
	settingsSaveBtn: document.getElementById("settings-save"),
	exportBtn: document.getElementById("export-btn"),
	importBtn: document.getElementById("import-btn"),
	importFile: document.getElementById("import-file"),
	clearBtn: document.getElementById("clear-btn"),
	autoHoldToggle: document.getElementById("auto-hold-toggle"),
	autoHoldDays: document.getElementById("auto-hold-days"),
	urlImportText: document.getElementById("url-import-text"),
	urlImportBtn: document.getElementById("url-import-btn"),
	urlImportClear: document.getElementById("url-import-clear"),
	urlImportStatus: document.getElementById("url-import-status"),
	libraryChunkingEnabled: document.getElementById("library-chunking-enabled"),
	libraryChunkSize: document.getElementById("library-chunk-size"),
	libraryChunkSummaryCount: document.getElementById(
		"library-chunk-summary-count",
	),
	libraryMaxOutputTokens: document.getElementById(
		"library-max-output-tokens",
	),

	// Comprehensive Backup
	comprehensiveBackupBtn: document.getElementById("comprehensive-backup-btn"),
	comprehensiveRestoreBtn: document.getElementById(
		"comprehensive-restore-btn",
	),
	comprehensiveRestoreFile: document.getElementById(
		"comprehensive-restore-file",
	),
	rollingBackupToggle: document.getElementById("rolling-backup-toggle"),
	// New comprehensive backup elements
	createComprehensiveBackupBtn: document.getElementById(
		"createComprehensiveBackup",
	),
	restoreComprehensiveBackupBtn: document.getElementById(
		"restoreComprehensiveBackup",
	),
	comprehensiveBackupFile: document.getElementById("comprehensiveBackupFile"),
	backupIncludeApiKeys: document.getElementById("backupIncludeApiKeys"),
	backupIncludeCredentials: document.getElementById(
		"backupIncludeCredentials",
	),
	autoBackupEnabled: document.getElementById("autoBackupEnabled"),
	rollingBackupInterval: document.getElementById("rollingBackupInterval"),
	rollingBackupIntervalDisplay: document.getElementById(
		"rollingBackupIntervalDisplay",
	),
	rollingBackupList: document.getElementById("rollingBackupList"),
	createRollingBackupBtn: document.getElementById("createRollingBackup"),
	backupHistoryList: document.getElementById("backupHistoryList"),
	mergeModeRadios: document.querySelectorAll('input[name="mergeMode"]'),

	// Google Drive Backup
	libraryViewBackupsBtn: document.getElementById("library-view-backups-btn"),
	libraryDriveSyncNowBtn: document.getElementById(
		"library-sync-from-drive-btn",
	),
	driveBackupsModal: document.getElementById("drive-backups-modal"),
	driveBackupsClose: document.getElementById("drive-backups-close"),
	driveBackupsLoading: document.getElementById("drive-backups-loading"),
	driveBackupsList: document.getElementById("drive-backups-list"),
	driveBackupsEmpty: document.getElementById("drive-backups-empty"),
	connectDriveBtn: document.getElementById("connectDriveBtn"),
	disconnectDriveBtn: document.getElementById("disconnectDriveBtn"),
	backupNowBtn: document.getElementById("backupNowBtn"),
	driveNotConnected: document.getElementById("driveNotConnected"),
	driveConnected: document.getElementById("driveConnected"),
	driveStatusSpan: document.getElementById("driveStatus"),
	driveAuthError: document.getElementById("driveAuthError"),
	driveBackupModeRadios: document.querySelectorAll(
		'input[name="driveBackupMode"]',
	),
	continuousBackupCheckInterval: document.getElementById(
		"continuousBackupCheckInterval",
	),
	driveBackupRetention: document.getElementById("driveBackupRetention"),
	driveBackupRetentionDisplay: document.getElementById(
		"driveBackupRetentionDisplay",
	),
	driveAutoRestoreEnabled: document.getElementById("driveAutoRestoreEnabled"),
	driveClientIdInput: document.getElementById("driveClientId"),
	driveClientSecretInput: document.getElementById("driveClientSecret"),
	toggleClientSecretBtn: document.getElementById(
		"toggleClientSecretVisibility",
	),
	saveOAuthSettingsBtn: document.getElementById("saveOAuthSettings"),
	oauthJsonPaste: document.getElementById("oauthJsonPaste"),
	parseOAuthJsonBtn: document.getElementById("parseOAuthJson"),
	saveOAuthFromJsonBtn: document.getElementById("saveOAuthFromJson"),
	driveFolderIdInput: document.getElementById("driveFolderId"),

	// Telemetry Settings
	telemetryToggle: document.getElementById("telemetry-toggle"),
	telemetryDetails: document.getElementById("telemetry-details"),
	sendErrorsToggle: document.getElementById("send-errors-toggle"),
	webhookUrl: document.getElementById("webhook-url"),

	// Debug Settings
	debugModeToggle: document.getElementById("library-debug-mode"),

	// Theme Settings (Library Modal)
	libraryThemeMode: document.getElementById("library-theme-mode"),
	libraryAccentColorPicker: document.getElementById(
		"library-accentColorPicker",
	),
	libraryAccentColorText: document.getElementById("library-accentColorText"),
	libraryAccentSecondaryPicker: document.getElementById(
		"library-accentSecondaryPicker",
	),
	libraryAccentSecondaryText: document.getElementById(
		"library-accentSecondaryText",
	),
	libraryBackgroundColorPicker: document.getElementById(
		"library-backgroundColorPicker",
	),
	libraryBackgroundColorText: document.getElementById(
		"library-backgroundColorText",
	),
	libraryTextColorPicker: document.getElementById("library-textColorPicker"),
	libraryTextColorText: document.getElementById("library-textColorText"),
	librarySaveThemeBtn: document.getElementById("library-save-theme"),
	libraryResetThemeBtn: document.getElementById("library-reset-theme"),

	// AI Model Settings (Library Modal)
	libraryApiKeyInput: document.getElementById("library-api-key"),
	librarySaveApiKeyBtn: document.getElementById("library-save-api-key"),
	libraryTestApiKeyBtn: document.getElementById("library-test-api-key"),
	libraryModelSelect: document.getElementById("library-model-select"),
	libraryModelEndpointInput: document.getElementById(
		"library-model-endpoint",
	),
	libraryCopyModelEndpointBtn: document.getElementById(
		"library-copy-model-endpoint",
	),
	libraryRefreshModelsBtn: document.getElementById("library-refresh-models"),
	libraryTemperatureSlider: document.getElementById(
		"library-temperature-slider",
	),
	libraryTemperatureValue: document.getElementById(
		"library-temperature-value",
	),

	// Font Size (Library Modal)
	libraryFontSizeSlider: document.getElementById("library-font-size-slider"),
	libraryFontSizeValue: document.getElementById("library-font-size-value"),

	// Advanced Settings (Library Modal)
	libraryTopKSlider: document.getElementById("library-top-k-slider"),
	libraryTopKValue: document.getElementById("library-top-k-value"),
	libraryTopPSlider: document.getElementById("library-top-p-slider"),
	libraryTopPValue: document.getElementById("library-top-p-value"),
	libraryAdvancedModelEndpoint: document.getElementById(
		"library-advanced-model-endpoint",
	),
	libraryAdvancedCopyEndpoint: document.getElementById(
		"library-advanced-copy-endpoint",
	),
	libraryPromptMain: document.getElementById("library-prompt-main"),
	libraryResetPromptMain: document.getElementById(
		"library-reset-prompt-main",
	),
	libraryPromptSummary: document.getElementById("library-prompt-summary"),
	libraryResetPromptSummary: document.getElementById(
		"library-reset-prompt-summary",
	),
	libraryPromptShortSummary: document.getElementById(
		"library-prompt-short-summary",
	),
	libraryResetPromptShortSummary: document.getElementById(
		"library-reset-prompt-short-summary",
	),
	libraryPromptPermanent: document.getElementById("library-prompt-permanent"),
	libraryResetPromptPermanent: document.getElementById(
		"library-reset-prompt-permanent",
	),

	// Telemetry Consent Modal
	telemetryConsentModal: document.getElementById("telemetry-consent-modal"),
	telemetryAcceptBtn: document.getElementById("telemetry-accept-btn"),
	telemetryDeclineBtn: document.getElementById("telemetry-decline-btn"),
	telemetryBanner: document.getElementById("telemetry-banner"),
	telemetryBannerDisable: document.getElementById("telemetry-banner-disable"),
	telemetryBannerKeep: document.getElementById("telemetry-banner-keep"),

	// Carousel
	carouselSection: document.getElementById("carousel-section"),
	carouselTrack: document.getElementById("carousel-track"),
	carouselIndicators: document.getElementById("carousel-indicators"),
	carouselPlayPause: document.getElementById("carousel-play-pause"),
	carouselPrev: document.getElementById("carousel-prev"),
	carouselNext: document.getElementById("carousel-next"),
};

async function applyLibraryTheme() {
	try {
		const result = await browser.storage.local.get("themeSettings");
		const theme = result.themeSettings || defaultTheme;
		setThemeVariables(theme);
	} catch (error) {
		debugError("Failed to apply theme settings:", error);
		setThemeVariables(defaultTheme);
	}
}

function setThemeVariables(theme) {
	const root = document.documentElement;
	const mode = theme.mode || "dark";
	const palette = themePalettes[mode === "light" ? "light" : "dark"];

	if (mode === "light") {
		root.setAttribute("data-theme", "light");
	} else if (mode === "auto") {
		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)"
		).matches;
		root.setAttribute("data-theme", prefersDark ? "dark" : "light");
	} else {
		root.removeAttribute("data-theme");
	}

	Object.entries(palette).forEach(([key, value]) => {
		root.style.setProperty(`--${key}`, value);
	});

	// Respect custom colors when provided
	if (theme.accentPrimary)
		root.style.setProperty("--primary-color", theme.accentPrimary);
	if (theme.accentSecondary)
		root.style.setProperty("--primary-hover", theme.accentSecondary);
	if (theme.bgColor) root.style.setProperty("--bg-primary", theme.bgColor);
	if (theme.textColor)
		root.style.setProperty("--text-primary", theme.textColor);
}

// Carousel State
let carouselState = {
	currentIndex: 0,
	isPlaying: true,
	interval: null,
	itemsPerView: 4,
	itemsToShow: 10, // Max novels to try to show in carousel
	uniqueCount: 0, // Actual unique novels available for the carousel
};

// Detect if running in sidebar (set via manifest URL parameter)
const isSidebar = window.location.search.includes("sidebar=true");

// Apply sidebar class early to minimize layout flash
if (isSidebar) {
	document.documentElement.classList.add("sidebar-mode");
}

async function openNovelFromQueryParams() {
	try {
		const params = new URLSearchParams(window.location.search);
		const novelId = params.get("novel");
		if (!novelId) return;
		const novel = await novelLibrary.getNovel(novelId);
		if (novel) {
			openNovelDetail(novel);
		}
	} catch (_err) {
		debugError("Failed to open novel from query params:", _err);
	}
}

/**
 * Load rolling backups into the UI
 */
async function loadRollingBackups() {
	if (!elements.rollingBackupList) return;

	const backups = await listRollingBackups();

	if (backups.length === 0) {
		elements.rollingBackupList.innerHTML = `
			<div class="no-backups" style="text-align: center; padding: 15px; color: #888; font-size: 12px">
				No rolling backups yet. Enable auto-backup or create one manually.
			</div>`;
		return;
	}

	elements.rollingBackupList.innerHTML = backups
		.map(
			(b) => `
		<div class="backup-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; margin-bottom: 6px; font-size: 12px">
			<div>
				<div style="font-weight: 500">${b.dateStr}</div>
				<div style="font-size: 11px; color: #aaa">${b.novelCount} novels • ${b.reason}</div>
			</div>
			<div style="display: flex; gap: 4px;">
				<button class="rolling-restore btn btn-secondary" data-key="${b.key}" style="font-size: 11px; padding: 4px 8px;">
					Restore
				</button>
				<button class="rolling-download btn btn-secondary" data-key="${b.key}" style="font-size: 11px; padding: 4px 8px;">
					Download
				</button>
				<button class="rolling-delete btn btn-danger" data-key="${b.key}" style="font-size: 11px; padding: 4px 8px;">
					Delete
				</button>
			</div>
		</div>
	`,
		)
		.join("");

	// Add event listeners
	elements.rollingBackupList.querySelectorAll(".rolling-restore").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const backup = await getRollingBackup(btn.dataset.key);
			if (backup && confirm("Restore this backup? (Merge mode)")) {
				await restoreComprehensiveBackup(backup, { mode: "merge" });
				showNotification("✅ Backup restored!", "success");
				setTimeout(() => location.reload(), 1000);
			}
		});
	});

	elements.rollingBackupList.querySelectorAll(".rolling-download").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const backup = await getRollingBackup(btn.dataset.key);
			if (backup) {
				downloadBackupAsFile(backup);
			}
		});
	});

	elements.rollingBackupList.querySelectorAll(".rolling-delete").forEach((btn) => {
		btn.addEventListener("click", async () => {
			if (confirm("Delete this backup?")) {
				await deleteRollingBackup(btn.dataset.key);
				await loadRollingBackups();
				showNotification("Backup deleted", "success");
			}
		});
	});
}

/**
 * Initialize and update rolling backup status indicator
 * Shows countdown timer, status, and last backup time
 */
async function initializeRollingBackupStatus() {
	const statusContainer = document.getElementById("rollingBackupStatus");
	const statusIcon = document.getElementById("backupStatusIcon");
	const statusText = document.getElementById("backupStatusText");
	const countdownContainer = document.getElementById("backupCountdownContainer");
	const countdownTime = document.getElementById("backupCountdownTime");
	const lastBackupTimeDiv = document.getElementById("lastBackupTime");
	const lastBackupTimeText = document.getElementById("lastBackupTimeText");

	if (!statusContainer) return; // Elements don't exist

	// Get rolling backup settings
	const stored = await browser.storage.local.get([
		"rg_rolling_backup_enabled",
		"rollingBackupIntervalMinutes",
		"rg_rolling_backup_meta",
	]);

	const isEnabled = stored.rg_rolling_backup_enabled ?? true;
	const intervalMinutes = parseInt(stored.rollingBackupIntervalMinutes) || 60;
	const metadata = stored.rg_rolling_backup_meta || {};

	// Hide status if rolling backups are disabled
	if (!isEnabled) {
		statusContainer.style.display = "none";
		return;
	}

	statusContainer.style.display = "block";

	// Function to update countdown display
	const updateCountdown = () => {
		if (!metadata.lastBackupTime) {
			statusIcon.textContent = "⏳";
			statusText.textContent = "Waiting for first backup...";
			if (countdownContainer) countdownContainer.style.display = "none";
			if (lastBackupTimeDiv) lastBackupTimeDiv.style.display = "none";
			return;
		}

		const lastBackupMs = parseInt(metadata.lastBackupTime);
		const nextBackupMs = lastBackupMs + intervalMinutes * 60 * 1000;
		const nowMs = Date.now();

		if (nowMs >= nextBackupMs) {
			// Next backup is due or overdue
			statusIcon.textContent = "📅";
			statusText.textContent = "Backup due now";
			if (countdownContainer) countdownContainer.style.display = "none";
		} else {
			// Calculate remaining time
			const remainingMs = nextBackupMs - nowMs;
			const remainingMins = Math.floor(remainingMs / 60000);
			const remainingSecs = Math.floor((remainingMs % 60000) / 1000);

			statusIcon.textContent = "⏳";
			statusText.textContent =
				remainingMins > 0
					? `Next backup in ${remainingMins}m ${remainingSecs}s`
					: `Next backup in ${remainingSecs}s`;

			if (countdownContainer) {
				countdownContainer.style.display = "block";
				if (countdownTime) {
					countdownTime.textContent = `${remainingMins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
				}
			}
		}

		// Update last backup time
		if (lastBackupTimeDiv && lastBackupTimeText) {
			const lastBackupDate = new Date(lastBackupMs);
			const now = new Date();
			const diffMs = now - lastBackupDate;
			const diffMins = Math.floor(diffMs / 60000);
			const diffHours = Math.floor(diffMs / 3600000);
			const diffDays = Math.floor(diffMs / 86400000);

			let timeStr;
			if (diffMins < 1) {
				timeStr = "just now";
			} else if (diffMins < 60) {
				timeStr = `${diffMins}m ago`;
			} else if (diffHours < 24) {
				timeStr = `${diffHours}h ago`;
			} else {
				timeStr = `${diffDays}d ago`;
			}

			lastBackupTimeText.textContent = timeStr;
			lastBackupTimeDiv.style.display = "block";
		}
	};

	// Initial update
	updateCountdown();

	// Update countdown every second
	if (!window.rollingBackupCountdownInterval) {
		window.rollingBackupCountdownInterval = setInterval(updateCountdown, 1000);
	}
}

/**
 * Load backup history (quick library backups)
 */
async function loadBackupHistory() {
	if (!elements.backupHistoryList) return;

	try {
		const backups = await libraryBackupManager.listBackups();

		if (!backups || backups.length === 0) {
			elements.backupHistoryList.innerHTML = `
				<div style="text-align: center; padding: 15px; color: #888; font-size: 12px">
					No backups yet
				</div>`;
			return;
		}

		elements.backupHistoryList.innerHTML = backups
			.map(
				(backup) => `
			<div class="backup-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; margin-bottom: 6px; font-size: 12px">
				<div>
					<div style="font-weight: 500; color: #e0e0e0; margin-bottom: 3px;">${backup.dateStr}</div>
					<div style="font-size: 12px; color: #aaa;">
						${backup.novelCount} novels • ${Math.round(backup.size / 1024)} KB ${
							backup.isAutomatic
								? '<span style="color: #4caf50;">(Auto)</span>'
								: "(Manual)"
						}
					</div>
				</div>
				<div style="display: flex; gap: 6px;">
					<button class="backup-restore-btn" data-backup-id="${backup.id}" style="padding: 6px 12px; font-size: 11px; background: #667eea; border: none; border-radius: 4px; cursor: pointer; color: white;">
						Restore
					</button>
					<button class="backup-delete-btn" data-backup-id="${backup.id}" style="padding: 6px 12px; font-size: 11px; background: #db4437; border: none; border-radius: 4px; cursor: pointer; color: white;">
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
				const mergeModeChecked = document.querySelector('input[name="mergeMode"]:checked')?.value || "merge";

				try {
					const restored = await libraryBackupManager.restoreBackup(backupId, mergeModeChecked);
					if (restored) {
						await browser.storage.local.set({ novelHistory: restored });
						showNotification(`Backup restored successfully (${mergeModeChecked} mode)!`, "success");
						await loadBackupHistory();
						await loadLibrary();
					}
				} catch (error) {
					debugError("Error restoring backup:", error);
					showNotification("Failed to restore backup", "error");
				}
			});
		});

		document.querySelectorAll(".backup-delete-btn").forEach((btn) => {
			btn.addEventListener("click", async function () {
				const backupId = this.dataset.backupId;
				if (confirm("Are you sure you want to delete this backup?")) {
					await libraryBackupManager.deleteBackup(backupId);
					await loadBackupHistory();
					showNotification("Backup deleted successfully!", "success");
				}
			});
		});
	} catch (error) {
		debugError("Error loading backup history:", error);
	}
}

/**
 * Save backup checkbox settings
 */
async function saveBackupCheckboxSettings() {
	try {
		const settings = {
			backupIncludeApiKeys: elements.backupIncludeApiKeys?.checked ?? true,
			backupIncludeCredentials: elements.backupIncludeCredentials?.checked ?? true,
			rollingBackupIntervalMinutes: elements.rollingBackupInterval
				? parseInt(elements.rollingBackupInterval.value, 10) || 60
				: 60,
		};
		await browser.storage.local.set(settings);
	} catch (error) {
		debugError("Failed to save backup checkbox settings:", error);
	}
}

/**
 * Load backup checkbox settings
 */
async function loadBackupCheckboxSettings() {
	try {
		const settings = await browser.storage.local.get([
			"backupIncludeApiKeys",
			"backupIncludeCredentials",
			"rg_rolling_backup_enabled",
			"rollingBackupIntervalMinutes",
		]);

		if (elements.backupIncludeApiKeys) {
			elements.backupIncludeApiKeys.checked = settings.backupIncludeApiKeys ?? true;
		}
		if (elements.backupIncludeCredentials) {
			elements.backupIncludeCredentials.checked = settings.backupIncludeCredentials ?? true;
		}
		if (elements.autoBackupEnabled) {
			elements.autoBackupEnabled.checked = settings.rg_rolling_backup_enabled ?? true;
		}
		if (elements.rollingBackupInterval) {
			const interval = settings.rollingBackupIntervalMinutes ?? 60;
			elements.rollingBackupInterval.value = String(interval);
			if (elements.rollingBackupIntervalDisplay) {
				elements.rollingBackupIntervalDisplay.textContent = String(interval);
			}
		}
	} catch (error) {
		debugError("Failed to load backup checkbox settings:", error);
	}
}

/**
 * Initialize the library page
 */
async function init() {
	debugLog(
		"📚 Initializing Novel Library Page" +
			(isSidebar ? " (Sidebar mode)" : ""),
	);

	// Add sidebar class to body if in sidebar
	if (isSidebar) {
		document.body.classList.add("sidebar-mode");
	}

	await applyLibraryTheme();
	await loadSiteToggleSettings();

	// Populate supported sites list dynamically from SHELVES
	populateSupportedSites();

	// Load saved library-level settings
	await loadLibrarySettings();

	// Load telemetry settings
	await loadTelemetrySettings();

	// Load backup settings
	await loadBackupCheckboxSettings();
	await loadRollingBackups();
	await initializeRollingBackupStatus();
	await loadBackupHistory();

	// Load UI settings (theme, model, display)
	await loadLibraryThemeControls();
	await loadLibraryModelSettings();
	await loadLibraryDisplaySettings();
	await loadLibraryAdvancedSettings();
	setupEventListeners();
	await updateDriveUI();
	// Set up storage change listener for auto-updates
	setupStorageListener();

	// Load library data
	await loadLibrary();
	await openNovelFromQueryParams();

	// Check for first run telemetry consent
	await checkFirstRunConsent();
}

/**
 * Set up storage change listener for auto-updates
 */
function setupStorageListener() {
	browser.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== "local") return;

		// Check if library data changed
		if (changes.rg_novel_library) {
			debugLog("📚 Library data changed externally, refreshing...");
			// Debounce the refresh to avoid rapid updates
			if (window.libraryRefreshTimeout) {
				clearTimeout(window.libraryRefreshTimeout);
			}
			window.libraryRefreshTimeout = setTimeout(() => {
				loadLibrary();
			}, 500);
		}

		if (changes[SITE_SETTINGS_KEY]) {
			loadSiteToggleSettings().then(() => {
				populateSupportedSites();
				loadLibrary();
			});
		}

		// Check if rolling backup metadata changed (new backup created)
		if (
			changes.rg_rolling_backup_meta ||
			changes.rg_rolling_backup_enabled ||
			changes.rollingBackupIntervalMinutes
		) {
			debugLog(
				"📦 Rolling backup settings/metadata changed, updating status...",
			);
			initializeRollingBackupStatus();
			if (changes.rg_rolling_backup_meta) {
				loadRollingBackups();
			}
		}

		if (
			changes.driveAuthTokens ||
			changes.driveAuthError ||
			changes.backupMode ||
			changes.driveAutoRestoreEnabled ||
			changes.continuousBackupCheckIntervalMinutes ||
			changes.driveClientId ||
			changes.driveClientSecret
		) {
			updateDriveUI();
		}
	});
}

/**
 * Load library settings (auto-hold, etc.) and sync controls
 */
async function loadLibrarySettings() {
	try {
		librarySettings = await novelLibrary.getSettings();
	} catch (error) {
		debugError("Failed to load library settings:", error);
		librarySettings = { autoHoldEnabled: true, autoHoldDays: 7 };
	}

	if (elements.autoHoldToggle) {
		elements.autoHoldToggle.checked = !!librarySettings.autoHoldEnabled;
	}

	if (elements.autoHoldDays) {
		elements.autoHoldDays.value =
			librarySettings.autoHoldDays || librarySettings.autoHoldDays === 0
				? librarySettings.autoHoldDays
				: 7;
	}
}

async function loadSiteToggleSettings() {
	try {
		siteSettings = await getSiteSettings();
	} catch (error) {
		debugError("Failed to load site settings:", error);
		siteSettings = {};
	}

	renderSiteAutoAddSettings();
	renderWebsiteSettingsTabs();
}

/**
 * Load telemetry settings and sync UI controls
 */
async function loadTelemetrySettings() {
	try {
		const config = await getTelemetryConfig();

		if (elements.telemetryToggle) {
			elements.telemetryToggle.checked = !!config.enabled;
		}

		// Load debug mode setting
		if (elements.debugModeToggle) {
			const debugResult = await browser.storage.local.get("debugMode");
			// Default to true if not set
			elements.debugModeToggle.checked = debugResult.debugMode !== false;
		}

		// Always show telemetry details since it's opt-out
		if (elements.telemetryDetails) {
			elements.telemetryDetails.style.display = "block";
		}

		if (elements.sendErrorsToggle) {
			elements.sendErrorsToggle.checked = !!config.sendErrorReports;
		}

		if (elements.webhookUrl) {
			elements.webhookUrl.value = config.customWebhookUrl || "";
		}

		// Load rolling backup setting
		if (elements.rollingBackupToggle) {
			const result = await browser.storage.local.get(
				"rg_rolling_backup_enabled",
			);
			elements.rollingBackupToggle.checked =
				result.rg_rolling_backup_enabled !== false; // Default to true
		}
	} catch (error) {
		debugError("Failed to load telemetry settings:", error);
	}
}

async function loadLibraryThemeControls() {
	try {
		const result = await browser.storage.local.get("themeSettings");
		const theme = result.themeSettings || defaultTheme;

		if (elements.libraryThemeMode) {
			elements.libraryThemeMode.value = theme.mode || "dark";
		}

		if (
			elements.libraryAccentColorPicker &&
			elements.libraryAccentColorText
		) {
			elements.libraryAccentColorPicker.value =
				theme.accentPrimary || defaultTheme.accentPrimary;
			elements.libraryAccentColorText.value =
				theme.accentPrimary || defaultTheme.accentPrimary;
		}

		if (
			elements.libraryAccentSecondaryPicker &&
			elements.libraryAccentSecondaryText
		) {
			elements.libraryAccentSecondaryPicker.value =
				theme.accentSecondary || defaultTheme.accentSecondary;
			elements.libraryAccentSecondaryText.value =
				theme.accentSecondary || defaultTheme.accentSecondary;
		}

		if (
			elements.libraryBackgroundColorPicker &&
			elements.libraryBackgroundColorText
		) {
			elements.libraryBackgroundColorPicker.value =
				theme.bgColor || defaultTheme.bgColor;
			elements.libraryBackgroundColorText.value =
				theme.bgColor || defaultTheme.bgColor;
		}

		if (elements.libraryTextColorPicker && elements.libraryTextColorText) {
			elements.libraryTextColorPicker.value =
				theme.textColor || defaultTheme.textColor;
			elements.libraryTextColorText.value =
				theme.textColor || defaultTheme.textColor;
		}

		setThemeVariables(theme);
	} catch (error) {
		debugError("Failed to load theme controls:", error);
	}
}

async function loadLibraryDisplaySettings() {
	try {
		if (elements.libraryTemperatureSlider) {
			const result = await browser.storage.local.get("customTemperature");
			const temp = result.customTemperature ?? 0.7;
			elements.libraryTemperatureSlider.value = temp;
			if (elements.libraryTemperatureValue) {
				elements.libraryTemperatureValue.textContent = temp.toFixed(1);
			}
		}

		if (elements.libraryFontSizeSlider) {
			const result = await browser.storage.local.get("fontSize");
			const size = result.fontSize ?? 100;
			elements.libraryFontSizeSlider.value = size;
			if (elements.libraryFontSizeValue) {
				elements.libraryFontSizeValue.textContent = `${size}%`;
			}
		}
	} catch (error) {
		debugError("Failed to load display settings:", error);
	}
}

function formatLibraryModelName(modelId) {
	return modelId
		.replace("gemini-", "Gemini ")
		.replace(/-/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function setLibraryModelEndpoint(value) {
	if (elements.libraryModelEndpointInput) {
		elements.libraryModelEndpointInput.value = value || "";
	}
	// Also update in Advanced Settings tab
	if (elements.libraryAdvancedModelEndpoint) {
		elements.libraryAdvancedModelEndpoint.value = value || "";
	}
}

async function fetchLibraryModels(apiKey) {
	if (!apiKey) return null;
	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
		);
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}
		const data = await response.json();
		return (data.models || [])
			.filter(
				(model) =>
					model.name.includes("gemini") &&
					model.supportedGenerationMethods?.includes(
						"generateContent",
					),
			)
			.map((model) => {
				const id = model.name.split("/").pop();
				return {
					id,
					displayName: formatLibraryModelName(id),
					endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`,
				};
			});
	} catch (error) {
		debugError("Failed to fetch models:", error);
		return null;
	}
}

async function updateLibraryModelSelector(apiKey) {
	if (!elements.libraryModelSelect) return;
	try {
		elements.libraryModelSelect.innerHTML =
			'<option value="">Loading models...</option>';
		elements.libraryModelSelect.disabled = true;

		const models = await fetchLibraryModels(apiKey);
		if (!models || models.length === 0) {
			elements.libraryModelSelect.innerHTML =
				'<option value="">No models available</option>';
			return;
		}

		models.sort((a, b) => {
			if (a.id.includes("2.0") && !b.id.includes("2.0")) return -1;
			if (!a.id.includes("2.0") && b.id.includes("2.0")) return 1;
			if (a.id.includes("1.5") && !b.id.includes("1.5")) return -1;
			if (!a.id.includes("1.5") && b.id.includes("1.5")) return 1;
			return a.displayName.localeCompare(b.displayName);
		});

		const stored = await browser.storage.local.get([
			"selectedModelId",
			"modelEndpoint",
		]);
		let selectedModelId = stored.selectedModelId || "";

		elements.libraryModelSelect.innerHTML = "";
		models.forEach((model) => {
			const option = document.createElement("option");
			option.value = model.id;
			option.textContent = model.displayName;
			if (!selectedModelId && model.id === "gemini-2.0-flash") {
				selectedModelId = model.id;
			}
			elements.libraryModelSelect.appendChild(option);
		});

		if (selectedModelId) {
			elements.libraryModelSelect.value = selectedModelId;
		} else if (stored.modelEndpoint) {
			const modelId = stored.modelEndpoint.split("/").pop().split(":")[0];
			if (
				modelId &&
				elements.libraryModelSelect.querySelector(
					`option[value="${modelId}"]`,
				)
			) {
				elements.libraryModelSelect.value = modelId;
			}
		}

		const selectedModel = models.find(
			(model) => model.id === elements.libraryModelSelect.value,
		);
		setLibraryModelEndpoint(
			selectedModel?.endpoint ||
				(elements.libraryModelSelect.value
					? `https://generativelanguage.googleapis.com/v1beta/models/${elements.libraryModelSelect.value}:generateContent`
					: ""),
		);

		await browser.storage.local.set({
			availableModels: models,
			selectedModelId: elements.libraryModelSelect.value,
			modelsLastFetched: Date.now(),
		});
	} catch (error) {
		debugError("Error updating model selector:", error);
		elements.libraryModelSelect.innerHTML =
			'<option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option><option value="gemini-2.5-flash">Gemini 2.5 Flash</option><option value="gemini-2.5-pro">Gemini 2.5 Pro</option>';
	} finally {
		elements.libraryModelSelect.disabled = false;
	}
}

async function loadLibraryModelSettings() {
	try {
		const data = await browser.storage.local.get([
			"apiKey",
			"selectedModelId",
			"modelEndpoint",
		]);
		if (elements.libraryApiKeyInput) {
			elements.libraryApiKeyInput.value = data.apiKey || "";
		}
		if (data.apiKey) {
			await updateLibraryModelSelector(data.apiKey);
		} else if (elements.libraryModelSelect) {
			elements.libraryModelSelect.innerHTML = `
				<option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option>
				<option value="gemini-2.5-flash">Gemini 2.5 Flash (Faster)</option>
				<option value="gemini-2.5-pro">Gemini 2.5 Pro (Better quality)</option>
			`;
			if (data.selectedModelId) {
				elements.libraryModelSelect.value = data.selectedModelId;
			}
		}

		const selectedModelId =
			elements.libraryModelSelect?.value || data.selectedModelId || "";
		const endpoint =
			data.modelEndpoint ||
			(selectedModelId
				? `https://generativelanguage.googleapis.com/v1beta/models/${selectedModelId}:generateContent`
				: "");

		setLibraryModelEndpoint(endpoint);

		// Also set the endpoint in Advanced Settings tab
		if (elements.libraryAdvancedModelEndpoint) {
			elements.libraryAdvancedModelEndpoint.value = endpoint;
		}
	} catch (error) {
		debugError("Failed to load model settings:", error);
	}
}

/**
 * Load Advanced Settings from storage
 */
async function loadLibraryAdvancedSettings() {
	try {
		const data = await browser.storage.local.get([
			"topK",
			"topP",
			"modelEndpoint",
			"customPrompt",
			"customSummaryPrompt",
			"customShortSummaryPrompt",
			"permanentPrompt",
			"chunkingEnabled",
			"chunkSize",
			"maxOutputTokens",
		]);

		// Load Top K
		if (elements.libraryTopKSlider && elements.libraryTopKValue) {
			const topK = data.topK !== undefined ? data.topK : 40;
			elements.libraryTopKSlider.value = topK;
			elements.libraryTopKValue.textContent = topK;
		}

		// Load Top P
		if (elements.libraryTopPSlider && elements.libraryTopPValue) {
			const topP = data.topP !== undefined ? data.topP : 0.95;
			elements.libraryTopPSlider.value = topP;
			elements.libraryTopPValue.textContent = topP.toFixed(2);
		}

		// Load Model Endpoint
		if (elements.libraryAdvancedModelEndpoint) {
			elements.libraryAdvancedModelEndpoint.value =
				data.modelEndpoint || "";
		}

		// Load Prompts
		if (elements.libraryPromptMain) {
			elements.libraryPromptMain.value =
				data.customPrompt || DEFAULT_PROMPT;
		}
		if (elements.libraryPromptSummary) {
			elements.libraryPromptSummary.value =
				data.customSummaryPrompt || DEFAULT_SUMMARY_PROMPT;
		}
		if (elements.libraryPromptShortSummary) {
			elements.libraryPromptShortSummary.value =
				data.customShortSummaryPrompt || DEFAULT_SHORT_SUMMARY_PROMPT;
		}
		if (elements.libraryPromptPermanent) {
			elements.libraryPromptPermanent.value =
				data.permanentPrompt || DEFAULT_PERMANENT_PROMPT;
		}

		if (elements.libraryChunkingEnabled) {
			elements.libraryChunkingEnabled.checked =
				data.chunkingEnabled !== false;
		}
		if (elements.libraryChunkSize) {
			elements.libraryChunkSize.value = data.chunkSize || 20000;
		}
		if (elements.libraryMaxOutputTokens) {
			elements.libraryMaxOutputTokens.value =
				data.maxOutputTokens || 8192;
		}
	} catch (error) {
		debugError("Failed to load advanced settings:", error);
	}
}

/**
 * Check for first run and show telemetry consent modal
 */
async function checkFirstRunConsent() {
	try {
		const firstRun = await isFirstRun();
		const config = await getTelemetryConfig();

		// Only show banner on first run if consent hasn't been shown yet
		if (firstRun && !config.consentShown) {
			if (elements.telemetryBanner) {
				elements.telemetryBanner.classList.remove("hidden");
			}
		} else if (elements.telemetryBanner) {
			elements.telemetryBanner.classList.add("hidden");
		}
	} catch (error) {
		debugError("Failed to check first run consent:", error);
	}
}

/**
 * Persist auto-hold setting changes
 */
async function persistAutoHoldSettings(updates = {}) {
	const nextSettings = {
		...librarySettings,
		...updates,
	};
	librarySettings = await novelLibrary.saveSettings(nextSettings);
}

/**
 * Apply auto-hold to novels that have been inactive beyond the configured window
 */
async function enforceAutoHold(novels) {
	if (!librarySettings?.autoHoldEnabled || !Array.isArray(novels)) return;

	const thresholdDays = Math.max(
		1,
		parseInt(librarySettings.autoHoldDays, 10) || 7
	);
	const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
	const now = Date.now();

	const updates = [];

	novels.forEach((novel) => {
		const lastTouch = novel.lastAccessedAt || novel.addedAt || 0;
		const status = novel.readingStatus;
		const isProtectedStatus =
			status === READING_STATUS.COMPLETED ||
			status === READING_STATUS.DROPPED;

		// Only move active Reading items to On Hold after inactivity
		if (
			status === READING_STATUS.READING &&
			!isProtectedStatus &&
			now - lastTouch > thresholdMs
		) {
			updates.push({ id: novel.id, title: novel.title });
		}
	});

	if (updates.length === 0) return false;

	for (const novel of updates) {
		await novelLibrary.updateNovel(novel.id, {
			readingStatus: READING_STATUS.ON_HOLD,
		});
	}

	showNotification(
		`Moved ${updates.length} novel(s) to On Hold after inactivity.`,
		"info"
	);

	return true;
}

/**
 * Render a shelf icon - supports emoji strings, URL strings, and URL objects
 * @param {string|Object} icon - Either an emoji string, URL string, or {url: string, fallback: string}
 * @param {string} className - Optional CSS class name
 * @returns {string} HTML string for the icon
 */
function renderShelfIcon(icon, className = "", fallbackEmoji = "📖") {
	if (!icon) {
		return `<span class="shelf-icon ${className}">${fallbackEmoji}</span>`;
	}

	// If icon is a simple string
	if (typeof icon === "string") {
		// Check if it's a URL (starts with http:// or https://)
		if (icon.startsWith("http://") || icon.startsWith("https://")) {
			return `<span class="shelf-icon shelf-icon-img ${className}">
				<img src="${escapeHtml(icon)}" alt=""
					style="width: 1.5em; height: 1.5em; vertical-align: middle;">
				<span class="icon-fallback" style="display: none;">${fallbackEmoji}</span>
			</span>`;
		}
		// It's an emoji
		return `<span class="shelf-icon ${className}">${icon}</span>`;
	}

	// If icon is an object with url and fallback
	if (typeof icon === "object" && icon.url) {
		const fallback = icon.fallback || fallbackEmoji;
		return `<span class="shelf-icon shelf-icon-img ${className}">
			<img src="${escapeHtml(icon.url)}" alt=""
				style="width: 1.5em; height: 1.5em; vertical-align: middle;">
			<span class="icon-fallback" style="display: none;">${fallback}</span>
		</span>`;
	}

	return `<span class="shelf-icon ${className}">${fallbackEmoji}</span>`;
}

/**
 * Get the icon emoji/text from a shelf icon config
 * @param {string|Object} icon - Either an emoji string, URL string, or {url: string, fallback: string}
 * @param {string} emoji - Optional emoji fallback from shelf
 * @returns {string} The emoji/text to use
 */
function getIconText(icon, emoji) {
	if (!icon) return emoji || "📖";
	// If it's a URL string, prefer emoji fallback instead of leaking URL text
	if (typeof icon === "string") {
		if (icon.startsWith("http://") || icon.startsWith("https://")) {
			return emoji || "📖";
		}
		return icon;
	}
	if (typeof icon === "object" && icon.fallback) return icon.fallback;
	return emoji || "📖";
}

/**
 * Render shelf icon for novel cover placeholder - supports images and emojis
 * @param {string|Object} icon - Either an emoji string, URL string, or {url: string, fallback: string}
 * @returns {string} HTML string for the icon
 */
function renderShelfIconForPlaceholder(icon, fallbackEmoji = "📖") {
	if (!icon) return fallbackEmoji;

	// If icon is a simple string
	if (typeof icon === "string") {
		// Check if it's a URL
		if (icon.startsWith("http://") || icon.startsWith("https://")) {
			return `<img src="${escapeHtml(
				icon
			)}" alt="" class="placeholder-icon-img" style="width: 3rem; height: 3rem; object-fit: contain;">
				<span class="placeholder-icon-fallback" style="display: none; font-size: 2rem;">${fallbackEmoji}</span>`;
		}
		// It's an emoji
		return icon;
	}

	// If icon is an object with url and fallback
	if (typeof icon === "object" && icon.url) {
		const fallback = icon.fallback || fallbackEmoji;
		return `<img src="${escapeHtml(
			icon.url
		)}" alt="" class="placeholder-icon-img" style="width: 3rem; height: 3rem; object-fit: contain;">
				<span class="placeholder-icon-fallback" style="display: none; font-size: 2rem;">${fallback}</span>`;
	}

	return fallbackEmoji;
}

/**
 * Render shelf icon overlay for novel cards
 * @param {string|Object} icon - Either an emoji string, URL string, or {url: string, fallback: string}
 * @returns {string} HTML string for the icon overlay
 */
function renderShelfIconOverlay(icon) {
	if (!icon) return '<span class="novel-icon-overlay">📖</span>';

	// If icon is a simple string
	if (typeof icon === "string") {
		// Check if it's a URL
		if (icon.startsWith("http://") || icon.startsWith("https://")) {
			return `<div class="novel-icon-overlay">
				<img src="${escapeHtml(icon)}" alt="" class="overlay-icon-img">
				<span class="overlay-icon-fallback" style="display: none;">📖</span>
			</div>`;
		}
		// It's an emoji
		return `<span class="novel-icon-overlay">${icon}</span>`;
	}

	// If icon is an object with url and fallback
	if (typeof icon === "object" && icon.url) {
		const fallback = icon.fallback || "📖";
		return `<div class="novel-icon-overlay">
				<img src="${escapeHtml(icon.url)}" alt="" class="overlay-icon-img">
				<span class="overlay-icon-fallback" style="display: none;">${fallback}</span>
			</div>`;
	}

	return '<span class="novel-icon-overlay">📖</span>';
}

// Attach fallback handlers for small icon images used in shelf badges/placeholders
function attachIconFallbacks(root = document) {
	root.querySelectorAll(".shelf-icon-img img").forEach((img) => {
		const fallback = img.nextElementSibling;
		if (!fallback) return;
		img.addEventListener("error", () => {
			img.style.display = "none";
			fallback.style.display = "inline";
		});
	});

	root.querySelectorAll(".placeholder-icon-img").forEach((img) => {
		const fallback = img.nextElementSibling;
		if (!fallback) return;
		img.addEventListener("error", () => {
			img.style.display = "none";
			fallback.style.display = "flex";
		});
	});

	root.querySelectorAll(".overlay-icon-img").forEach((img) => {
		const fallback = img.nextElementSibling;
		if (!fallback) return;
		img.addEventListener("error", () => {
			img.style.display = "none";
			fallback.style.display = "flex";
		});
	});

	root.querySelectorAll("img.meta-icon[data-fallback-emoji]").forEach(
		(img) => {
			img.addEventListener("error", () => {
				const emoji = img.dataset.fallbackEmoji || "📖";
				const span = document.createElement("span");
				span.textContent = emoji;
				img.replaceWith(span);
			});
		}
	);
}

function createCoverPlaceholder(content, extraClasses = []) {
	const placeholder = document.createElement("div");
	placeholder.className = "novel-cover-placeholder";
	extraClasses.forEach((cls) => placeholder.classList.add(cls));
	placeholder.innerHTML = content || "📖";
	return placeholder;
}

function initCoverImage(imgEl, sources, placeholderContent) {
	if (!imgEl) return;
	const srcList = (sources || []).filter(Boolean);
	let index = 0;
	const extraClasses = imgEl.classList.contains("carousel-cover")
		? ["carousel-cover-placeholder"]
		: [];
	const placeholder = createCoverPlaceholder(
		placeholderContent,
		extraClasses
	);
	const tryNext = () => {
		if (index >= srcList.length) {
			imgEl.replaceWith(placeholder);
			return;
		}
		imgEl.src = srcList[index++];
	};
	imgEl.addEventListener("error", () => tryNext());
	tryNext();
}

function getShelfById(shelfId) {
	if (!shelfId) return null;
	const direct = SHELVES[shelfId];
	if (direct) return direct;
	const upper = shelfId.toUpperCase();
	if (SHELVES[upper]) return SHELVES[upper];
	const lower = shelfId.toLowerCase();
	return SHELVES[lower] || null;
}

function injectModalStyles(cssText, key, scopeSelector) {
	if (!cssText || modalStylesInjected.has(key)) return;
	const styleEl = document.createElement("style");
	styleEl.dataset.modalStyles = `modal-style-${key}`;
	styleEl.textContent = scopeSelector
		? scopeModalCss(cssText, scopeSelector)
		: cssText;
	document.head.appendChild(styleEl);
	modalStylesInjected.add(key);
}

async function loadModalRendererForShelf(shelfId) {
	if (!shelfId) return null;
	const key = shelfId.toLowerCase();
	if (modalRendererCache[key]) return modalRendererCache[key];

	try {
		// Dynamic import based on shelf ID
		// Note: This relies on the convention that the renderer is available at ./websites/{shelfId}/novel-card.js
		const mod = await import(`./websites/${key}/novel-card.js`);
		const renderer =
			mod.default ||
			Object.values(mod).find(
				(val) =>
					val?.renderCard ||
					val?.renderModalMetadata ||
					val?.showModal,
			);

		modalRendererCache[key] = renderer || null;
		if (renderer?.getCustomStyles) {
			const scopeSelector = `.modal[data-modal-site="${key}"]`;
			injectModalStyles(renderer.getCustomStyles(), key, scopeSelector);
		}
		return renderer || null;
	} catch (err) {
		// Only log error if it's not a "module not found" error, which is expected for unsupported sites
		// But debugLog is fine.
		debugLog(`No site-specific renderer found for ${key}: ${err.message}`);
		modalRendererCache[key] = null;
		return null;
	}
}

async function renderNovelMetadataForShelf(novel) {
	if (!novel?.shelfId) return false;

	const renderer = await loadModalRendererForShelf(novel.shelfId);
	if (!renderer?.renderModalMetadata) {
		debugLog(`No modal renderer found for shelf: ${novel.shelfId}`);
		return false;
	}

	try {
		if (!elements.modalMetadataContainer) {
			debugLog("modal-metadata-container element not found");
			return false;
		}

		elements.modalMetadataContainer.style.display = "block";
		elements.modalMetadataContainer.innerHTML = "";
		elements.modalMetadataContainer.dataset.shelfId = novel.shelfId;

		renderer.renderModalMetadata(novel);

		const hasContent =
			elements.modalMetadataContainer.innerHTML.trim().length > 0;
		if (!hasContent) {
			debugLog(
				`Modal renderer for ${novel.shelfId} produced no content; falling back`
			);
			return false;
		}

		debugLog(`Modal metadata rendered by: ${novel.shelfId}`);
		return true;
	} catch (err) {
		debugError(`Error rendering modal metadata for ${novel.shelfId}:`, err);
		return false;
	}
}

function getHandlerTypeForNovel(novel) {
	const shelf = getShelfById(novel?.shelfId);
	return (
		novel?.metadata?.handlerType || shelf?.handlerType || "chapter_embedded"
	);
}

function resolveMetadataRefreshUrl(novel) {
	const handlerType = getHandlerTypeForNovel(novel);
	if (handlerType === "chapter_embedded") {
		return novel.lastReadUrl || novel.sourceUrl || novel.lastReadChapterUrl;
	}
	return novel.sourceUrl || novel.lastReadUrl || novel.lastReadChapterUrl;
}

function applyModalActionVisibility(novel) {
	const handlerType = getHandlerTypeForNovel(novel);
	if (!elements.modalSourceBtn) return;

	if (handlerType === "chapter_embedded") {
		elements.modalSourceBtn.style.display = "none";
		elements.modalSourceBtn.removeAttribute("href");
	} else {
		elements.modalSourceBtn.style.display = "inline-flex";
	}
}

/**
 * Populate the supported sites list from SHELVES
 */
function populateSupportedSites() {
	const sitesList = document.getElementById("supported-sites-list");
	if (!sitesList) return;

	const enabled = filterEnabledShelves(siteSettings);

	sitesList.innerHTML = enabled
		.map(
			(shelf) =>
				`<li>${renderShelfIcon(shelf.icon, "site-icon")} ${
					shelf.name
				}</li>`
		)
		.join("");

	attachIconFallbacks(sitesList);
}

function renderSiteAutoAddSettings() {
	if (!elements.siteAutoAddList) return;
	if (!SHELVES || !Object.keys(SHELVES).length) return;

	const defaults = getDefaultSiteSettings();
	const shelves = Object.values(SHELVES).sort((a, b) =>
		(a.name || a.id).localeCompare(b.name || b.id),
	);

	const statusOptions = [
		READING_STATUS.READING,
		READING_STATUS.PLAN_TO_READ,
		READING_STATUS.UP_TO_DATE,
		READING_STATUS.COMPLETED,
		READING_STATUS.ON_HOLD,
		READING_STATUS.DROPPED,
		READING_STATUS.RE_READING,
	];

	elements.siteAutoAddList.innerHTML = "";

	shelves.forEach((shelf) => {
		const setting = siteSettings[shelf.id] || defaults[shelf.id] || {};
		const siteEnabled = setting.enabled !== false;
		const autoAddEnabled = siteEnabled && setting.autoAddEnabled !== false;
		const autoAddStatusChapter = setting.autoAddStatusChapter || "reading";
		const autoAddStatusNovel = setting.autoAddStatusNovel || "plan-to-read";

		const row = document.createElement("div");
		row.className = "site-autoadd-row";
		row.dataset.siteId = shelf.id;

		const iconHtml = renderShelfIcon(
			shelf.icon,
			"site-icon",
			shelf.emoji || "📖",
		);


		row.innerHTML = `
			<div class="site-autoadd-header">
				<div class="site-autoadd-title">
					<div class="site-autoadd-icon">${iconHtml || "📖"}</div>
					<div class="site-autoadd-name">${shelf.name || shelf.id}</div>
				</div>
				<div class="site-autoadd-status ${
					siteEnabled ? "enabled" : "disabled"
				}">${siteEnabled ? "Enabled" : "Disabled"}</div>
			</div>
			<div class="site-autoadd-controls">
				<div class="site-autoadd-toggle">
					<span>Site enabled</span>
					<label class="toggle-switch toggle-switch-sm">
						<input type="checkbox" data-setting="enabled" ${siteEnabled ? "checked" : ""} />
						<span class="toggle-slider"></span>
					</label>
				</div>
				<div class="site-autoadd-toggle">
					<span>Auto-add novels</span>
					<label class="toggle-switch toggle-switch-sm">
						<input type="checkbox" data-setting="autoAddEnabled" ${
							autoAddEnabled ? "checked" : ""
						} ${siteEnabled ? "" : "disabled"} />
						<span class="toggle-slider"></span>
					</label>
				</div>
				<label>
					<span>On chapter pages</span>
					<select data-setting="autoAddStatusChapter" ${siteEnabled ? "" : "disabled"}>
						${statusOptions
							.map((status) => {
								const label =
									READING_STATUS_INFO[status]?.label ||
									status;
								return `<option value="${status}" ${
									status === autoAddStatusChapter
										? "selected"
										: ""
								}>${label}</option>`;
							})
							.join("")}
					</select>
				</label>
				<label>
					<span>On novel pages</span>
					<select data-setting="autoAddStatusNovel" ${siteEnabled ? "" : "disabled"}>
						${statusOptions
							.map((status) => {
								const label =
									READING_STATUS_INFO[status]?.label ||
									status;
								return `<option value="${status}" ${
									status === autoAddStatusNovel
										? "selected"
										: ""
								}>${label}</option>`;
							})
							.join("")}
					</select>
				</label>
			</div>
		`;

		const updateRowState = (enabled) => {
			row.classList.toggle("is-disabled", !enabled);
			const statusBadge = row.querySelector(".site-autoadd-status");
			if (statusBadge) {
				statusBadge.textContent = enabled ? "Enabled" : "Disabled";
				statusBadge.classList.toggle("enabled", enabled);
				statusBadge.classList.toggle("disabled", !enabled);
			}
			row.querySelectorAll("select").forEach((select) => {
				select.disabled = !enabled;
			});
			const autoAddToggle = row.querySelector(
				"input[data-setting='autoAddEnabled']",
			);
			if (autoAddToggle) {
				autoAddToggle.disabled = !enabled;
				if (!enabled) autoAddToggle.checked = false;
			}
		};

		updateRowState(siteEnabled);

		const handleChange = async () => {
			const enabledToggle = row.querySelector(
				"input[data-setting='enabled']",
			);
			const autoAddToggle = row.querySelector(
				"input[data-setting='autoAddEnabled']",
			);
			const statusChapter = row.querySelector(
				"select[data-setting='autoAddStatusChapter']",
			);
			const statusNovel = row.querySelector(
				"select[data-setting='autoAddStatusNovel']",
			);
			const enabled = enabledToggle?.checked ?? true;

			updateRowState(enabled);

			const updated = {
				enabled,
				autoAddEnabled: enabled
					? (autoAddToggle?.checked ?? true)
					: false,
				autoAddStatusChapter:
					statusChapter?.value || autoAddStatusChapter,
				autoAddStatusNovel: statusNovel?.value || autoAddStatusNovel,
			};

			try {
				siteSettings = await saveSiteSettings({
					[shelf.id]: updated,
				});
				showToast(
					`Saved auto-add settings for ${shelf.name || shelf.id}`,
					"success",
				);
			} catch (error) {
				debugError("Failed to save auto-add settings:", error);
				showToast("Failed to save auto-add settings", "error");
			}
		};

		row.querySelectorAll("input, select").forEach((control) => {
			control.addEventListener("change", handleChange);
		});

		elements.siteAutoAddList.appendChild(row);
	});

	attachIconFallbacks(elements.siteAutoAddList);
}

function renderWebsiteSettingsTabs() {
	const tabsContainer = document.querySelector(".settings-tabs");
	const modalContent = document.querySelector(".settings-modal-content");

	if (!tabsContainer || !modalContent) return;

	modalContent
		.querySelectorAll(".website-settings-panel")
		.forEach((panel) => panel.remove());
	tabsContainer
		.querySelectorAll(".website-settings-tab")
		.forEach((tab) => tab.remove());

	WEBSITE_SETTINGS_DEFINITIONS.forEach((definition) => {
		const tabId = `website-settings-${definition.id}`;
		const tabButton = document.createElement("button");
		tabButton.className = "settings-tab website-settings-tab";
		tabButton.dataset.tab = tabId;
		tabButton.textContent = definition.label;
		tabsContainer.appendChild(tabButton);

		const panel = document.createElement("div");
		panel.className = "settings-tab-content hidden website-settings-panel";
		panel.id = tabId;
		panel.innerHTML = renderWebsiteSettingsPanel(
			definition,
			siteSettings[definition.id] ||
				getDefaultSiteSettings()[definition.id] ||
				{},
		);
		modalContent.appendChild(panel);
	});

	attachWebsiteSettingsHandlers();
	bindSettingsTabListeners();
}

function attachWebsiteSettingsHandlers() {
	const inputs = document.querySelectorAll(
		".website-settings-panel input[data-setting]",
	);

	inputs.forEach((input) => {
		input.addEventListener("change", async () => {
			const shelfId = input.dataset.shelf;
			const key = input.dataset.setting;
			if (!shelfId || !key) return;

			const defaults = getDefaultSiteSettings();
			const base = siteSettings[shelfId] || defaults[shelfId] || {};
			const updated = {
				...base,
				[key]: input.checked,
			};

			try {
				siteSettings = await saveSiteSettings({
					[shelfId]: updated,
				});
				showToast(
					`Saved ${key} for ${base.name || shelfId}`,
					"success",
				);
			} catch (error) {
				debugError("Failed to save website settings:", error);
				showToast("Failed to save website settings", "error");
			}
		});
	});
}

function bindSettingsTabListeners() {
	const settingsTabs = document.querySelectorAll(".settings-tab");
	settingsTabs.forEach((tab) => {
		if (tab.dataset.bound === "true") return;
		tab.dataset.bound = "true";
		tab.addEventListener("click", () => {
			const targetTabId = tab.dataset.tab;

			settingsTabs.forEach((t) => t.classList.remove("active"));
			tab.classList.add("active");

			document
				.querySelectorAll(".settings-tab-content")
				.forEach((content) => {
					content.classList.add("hidden");
				});

			const targetContent = document.getElementById(targetTabId);
			if (targetContent) {
				targetContent.classList.remove("hidden");
			}
		});
	});

	if (!document.querySelector(".settings-tab.active")) {
		if (settingsTabs.length > 0) {
			settingsTabs[0].classList.add("active");
		}
	}
}

function extractUrlsFromText(text = "") {
	const urls = text.match(/https?:\/\/[^\s)\]\[<>]+/gi) || [];
	const cleaned = urls
		.map((raw) => raw.replace(/[),.\]]+$/g, ""))
		.filter(Boolean);
	return [...new Set(cleaned)];
}

function filterSupportedUrls(urls = []) {
	return urls.filter((value) => {
		try {
			const hostname = new URL(value).hostname;
			return isSupportedDomain(hostname);
		} catch (_err) {
			return false;
		}
	});
}

function waitForTabComplete(tabId, timeoutMs = 15000) {
	return new Promise((resolve, reject) => {
		let timeoutId;
		const onUpdated = (updatedTabId, info) => {
			if (updatedTabId !== tabId || info.status !== "complete") return;
			browser.tabs.onUpdated.removeListener(onUpdated);
			if (timeoutId) clearTimeout(timeoutId);
			resolve();
		};

		browser.tabs.onUpdated.addListener(onUpdated);
		timeoutId = setTimeout(() => {
			browser.tabs.onUpdated.removeListener(onUpdated);
			reject(new Error("Timed out waiting for tab load"));
		}, timeoutMs);
	});
}

async function sendAddToLibraryMessage(tabId) {
	const maxAttempts = 3;
	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		try {
			const response = await browser.tabs.sendMessage(tabId, {
				action: "addToLibrary",
			});
			if (response?.success) return true;
		} catch (_err) {
			// retry
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	return false;
}

async function addUrlsToLibrary(urls = []) {
	const results = {
		added: 0,
		skipped: 0,
		failed: 0,
	};

	for (const url of urls) {
		let tabId = null;
		try {
			const tab = await browser.tabs.create({
				url,
				active: false,
			});
			tabId = tab.id;
			await waitForTabComplete(tabId);
			const success = await sendAddToLibraryMessage(tabId);
			if (success) {
				results.added += 1;
			} else {
				results.failed += 1;
			}
		} catch (_err) {
			results.failed += 1;
		} finally {
			if (tabId !== null) {
				try {
					await browser.tabs.remove(tabId);
				} catch (_err) {
					// ignore close errors
				}
			}
		}
	}

	return results;
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
	// Search
	elements.searchInput.addEventListener("input", debounce(handleSearch, 300));

	// Sort
	elements.sortSelect.addEventListener("change", handleSort);

	// View toggle
	elements.viewButtons.forEach((btn) => {
		btn.addEventListener("click", () => handleViewChange(btn.dataset.view));
	});

	// Reading status filter
	if (elements.statusFilterBtns) {
		elements.statusFilterBtns.forEach((btn) => {
			btn.addEventListener("click", () =>
				handleStatusFilterChange(btn.dataset.status),
			);
		});
	}

	// Refresh
	elements.refreshBtn.addEventListener("click", loadLibrary);

	// Settings
	elements.settingsBtn.addEventListener("click", () =>
		openModal(elements.settingsModal),
	);
	elements.settingsClose.addEventListener("click", () =>
		closeModal(elements.settingsModal),
	);

	if (elements.urlImportBtn && elements.urlImportText) {
		elements.urlImportBtn.addEventListener("click", async () => {
			const rawText = elements.urlImportText.value || "";
			const extracted = extractUrlsFromText(rawText);
			const supported = filterSupportedUrls(extracted);

			if (elements.urlImportStatus) {
				elements.urlImportStatus.textContent =
					supported.length === 0
						? "No supported URLs found."
						: `Found ${supported.length} supported URL(s). Adding...`;
			}

			if (supported.length === 0) return;

			const results = await addUrlsToLibrary(supported);
			if (elements.urlImportStatus) {
				elements.urlImportStatus.textContent = `Added ${results.added}, failed ${results.failed}.`;
			}
		});
	}

	if (elements.urlImportClear && elements.urlImportText) {
		elements.urlImportClear.addEventListener("click", () => {
			elements.urlImportText.value = "";
			if (elements.urlImportStatus) {
				elements.urlImportStatus.textContent = "Ready to import.";
			}
		});
	}

	// Novel modal
	elements.modalClose.addEventListener("click", () =>
		closeModal(elements.novelModal),
	);
	elements.modalRemoveBtn.addEventListener("click", handleRemoveNovel);
	elements.modalRefreshBtn.addEventListener("click", handleRefreshMetadata);
	elements.modalEditBtn.addEventListener("click", handleOpenEditModal);
	if (elements.modalStatusSelector) {
		elements.modalStatusSelector.addEventListener(
			"change",
			handleModalStatusChange,
		);
	}

	// Listen for openNovelModal events from shelf pages
	window.addEventListener("openNovelModal", async (e) => {
		const { novelId } = e.detail;
		if (novelId) {
			try {
				const novel = await novelLibrary.getNovel(novelId);
				if (novel) {
					openNovelDetail(novel);
				}
			} catch (error) {
				debugError("Error opening novel modal:", error);
			}
		}
	});

	// Edit modal
	elements.editClose.addEventListener("click", () =>
		closeModal(elements.editModal),
	);
	elements.editCancelBtn.addEventListener("click", () =>
		closeModal(elements.editModal),
	);
	elements.editForm.addEventListener("submit", handleSaveEdit);
	elements.editCover.addEventListener(
		"input",
		debounce(handleCoverPreview, 500),
	);

	// Settings actions
	elements.exportBtn.addEventListener("click", handleExport);
	elements.importBtn.addEventListener("click", () =>
		elements.importFile.click(),
	);
	elements.importFile.addEventListener("change", handleImport);
	elements.clearBtn.addEventListener("click", handleClearLibrary);

	// Settings tabs
	bindSettingsTabListeners();

	// Settings save button - saves library settings configuration
	if (elements.settingsSaveBtn) {
		elements.settingsSaveBtn.addEventListener("click", async () => {
			try {
				// Collect all settings from the modal
				const apiKey = elements.libraryApiKeyInput?.value?.trim() || "";
				const selectedModelId =
					elements.libraryModelSelect?.value || "";
				let modelEndpoint = "";
				if (selectedModelId) {
					const stored =
						await browser.storage.local.get("availableModels");
					const match = stored.availableModels?.find(
						(m) => m.id === selectedModelId,
					);
					modelEndpoint =
						match?.endpoint ||
						`https://generativelanguage.googleapis.com/v1beta/models/${selectedModelId}:generateContent`;
				}

				const themeSettings = elements.libraryThemeMode
					? {
							mode: elements.libraryThemeMode.value || "dark",
							accentPrimary:
								elements.libraryAccentColorPicker?.value ||
								defaultTheme.accentPrimary,
							accentSecondary:
								elements.libraryAccentSecondaryPicker?.value ||
								defaultTheme.accentSecondary,
							bgColor:
								elements.libraryBackgroundColorPicker?.value ||
								defaultTheme.bgColor,
							textColor:
								elements.libraryTextColorPicker?.value ||
								defaultTheme.textColor,
						}
					: null;

				const settingsToSave = {
					autoHoldEnabled: elements.autoHoldToggle?.checked ?? false,
					autoHoldDays: parseInt(
						elements.autoHoldDays?.value ?? 7,
						10,
					),
					rollingBackupEnabled:
						elements.rollingBackupToggle?.checked ?? true,
					telemetryEnabled: elements.telemetryToggle?.checked ?? true,
					sendErrorsEnabled:
						elements.sendErrorsToggle?.checked ?? true,
					webhookUrl: elements.webhookUrl?.value?.trim() ?? "",
					apiKey,
					selectedModelId,
					modelEndpoint,
					customTemperature: elements.libraryTemperatureSlider
						? parseFloat(elements.libraryTemperatureSlider.value)
						: undefined,
					fontSize: elements.libraryFontSizeSlider
						? parseInt(elements.libraryFontSizeSlider.value, 10)
						: undefined,
					themeSettings: themeSettings || undefined,
					chunkingEnabled:
						elements.libraryChunkingEnabled?.checked ?? true,
					chunkSizeWords: elements.libraryChunkSize
						? parseInt(elements.libraryChunkSize.value, 10) || 3200
						: 3200,
					chunkSummaryCount: elements.libraryChunkSummaryCount
						? parseInt(
								elements.libraryChunkSummaryCount.value,
								10,
							) || 2
						: 2,
					maxOutputTokens: elements.libraryMaxOutputTokens
						? parseInt(elements.libraryMaxOutputTokens.value, 10) ||
							8192
						: undefined,
					// Advanced Settings
					topK: elements.libraryTopKSlider
						? parseInt(elements.libraryTopKSlider.value, 10)
						: undefined,
					topP: elements.libraryTopPSlider
						? parseFloat(elements.libraryTopPSlider.value)
						: undefined,
					customPrompt:
						elements.libraryPromptMain?.value || undefined,
					customSummaryPrompt:
						elements.libraryPromptSummary?.value || undefined,
					customShortSummaryPrompt:
						elements.libraryPromptShortSummary?.value || undefined,
					permanentPrompt:
						elements.libraryPromptPermanent?.value || undefined,
				};

				// Save to storage
				await browser.storage.local.set({
					autoHoldEnabled: settingsToSave.autoHoldEnabled,
					autoHoldDays: settingsToSave.autoHoldDays,
					rg_rolling_backup_enabled:
						settingsToSave.rollingBackupEnabled,
					telemetryEnabled: settingsToSave.telemetryEnabled,
					sendErrorsEnabled: settingsToSave.sendErrorsEnabled,
					webhookUrl: settingsToSave.webhookUrl,
					apiKey: settingsToSave.apiKey,
					selectedModelId: settingsToSave.selectedModelId,
					modelEndpoint: settingsToSave.modelEndpoint,
					customTemperature: settingsToSave.customTemperature,
					fontSize: settingsToSave.fontSize,
					chunkingEnabled: settingsToSave.chunkingEnabled,
					chunkSize: settingsToSave.chunkSize,
					maxOutputTokens: settingsToSave.maxOutputTokens,
					topK: settingsToSave.topK,
					topP: settingsToSave.topP,
					customPrompt: settingsToSave.customPrompt,
					customSummaryPrompt: settingsToSave.customSummaryPrompt,
					customShortSummaryPrompt:
						settingsToSave.customShortSummaryPrompt,
					permanentPrompt: settingsToSave.permanentPrompt,
					...(settingsToSave.themeSettings
						? { themeSettings: settingsToSave.themeSettings }
						: {}),
				});

				if (settingsToSave.themeSettings) {
					setThemeVariables(settingsToSave.themeSettings);
				}

				showNotification(
					"✅ All settings saved successfully!",
					"success",
				);
			} catch (error) {
				debugError("Error saving settings:", error);
				showNotification(
					`❌ Failed to save settings: ${error.message}`,
					"error",
				);
			}
		});
	}

	// Comprehensive backup
	if (elements.comprehensiveBackupBtn) {
		elements.comprehensiveBackupBtn.addEventListener(
			"click",
			handleComprehensiveBackup,
		);
	}
	if (elements.comprehensiveRestoreBtn) {
		elements.comprehensiveRestoreBtn.addEventListener("click", () =>
			elements.comprehensiveRestoreFile?.click(),
		);
	}
	if (elements.comprehensiveRestoreFile) {
		elements.comprehensiveRestoreFile.addEventListener(
			"change",
			handleComprehensiveRestore,
		);
	}
	if (elements.rollingBackupToggle) {
		elements.rollingBackupToggle.addEventListener("change", async (e) => {
			await browser.storage.local.set({
				rg_rolling_backup_enabled: e.target.checked,
			});
			showNotification(
				e.target.checked
					? "Rolling backups enabled"
					: "Rolling backups disabled",
				"info",
			);
		});
	}

	// New comprehensive backup handlers (from popup)
	if (elements.createComprehensiveBackupBtn) {
		elements.createComprehensiveBackupBtn.addEventListener(
			"click",
			async () => {
				try {
					elements.createComprehensiveBackupBtn.disabled = true;
					elements.createComprehensiveBackupBtn.textContent =
						"⏳ Creating...";

					const backup = await createComprehensiveBackup({
						type: BACKUP_OPTIONS.FULL,
						includeApiKeys:
							elements.backupIncludeApiKeys?.checked ?? true,
						includeCredentials:
							elements.backupIncludeCredentials?.checked ?? true,
					});

					downloadBackupAsFile(backup);
					showNotification(
						`✅ Full backup downloaded (${backup.metadata.novelCount} novels)`,
						"success",
					);
				} catch (error) {
					debugError("Comprehensive backup failed:", error);
					showNotification(
						`❌ Backup failed: ${error.message}`,
						"error",
					);
				} finally {
					elements.createComprehensiveBackupBtn.disabled = false;
					elements.createComprehensiveBackupBtn.textContent =
						"💾 Full Backup";
				}
			},
		);
	}

	if (elements.restoreComprehensiveBackupBtn) {
		elements.restoreComprehensiveBackupBtn.addEventListener("click", () => {
			elements.comprehensiveBackupFile?.click();
		});
	}

	if (elements.comprehensiveBackupFile) {
		elements.comprehensiveBackupFile.addEventListener(
			"change",
			async (e) => {
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

					let confirmMsg = `Restore this backup?\n\n`;
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
						restoreApiKeys:
							hasApiKey && confirm("Restore API keys?"),
						restoreCredentials:
							hasCredentials &&
							confirm("Restore OAuth credentials?"),
					});

					if (result.success) {
						if (result.versionInfo?.warnings?.length > 0) {
							const warningMsg =
								result.versionInfo.warnings.join("\n");
							showNotification(`⚠️ ${warningMsg}`, "warning");
							setTimeout(() => {
								showNotification(
									`✅ Restored ${result.restoredKeys.length} items!`,
									"success",
								);
							}, 3000);
						} else {
							showNotification(
								`✅ Restored ${result.restoredKeys.length} items!`,
								"success",
							);
						}
						setTimeout(() => location.reload(), 1500);
					}
				} catch (error) {
					debugError("Restore failed:", error);
					showNotification(
						`❌ Restore failed: ${error.message}`,
						"error",
					);
				}

				e.target.value = "";
			},
		);
	}

	if (elements.autoBackupEnabled) {
		elements.autoBackupEnabled.addEventListener("change", async (e) => {
			await browser.storage.local.set({
				rg_rolling_backup_enabled: e.target.checked,
			});
			showNotification(
				e.target.checked
					? "Automatic rolling backups enabled"
					: "Automatic rolling backups disabled",
				"info",
			);
		});
	}

	if (elements.rollingBackupInterval) {
		const updateRollingIntervalDisplay = () => {
			if (elements.rollingBackupIntervalDisplay) {
				elements.rollingBackupIntervalDisplay.textContent =
					elements.rollingBackupInterval.value;
			}
		};

		elements.rollingBackupInterval.addEventListener("input", () => {
			updateRollingIntervalDisplay();
		});
		elements.rollingBackupInterval.addEventListener("change", () => {
			updateRollingIntervalDisplay();
			saveBackupCheckboxSettings();
		});
	}

	if (elements.createRollingBackupBtn) {
		elements.createRollingBackupBtn.addEventListener("click", async () => {
			try {
				elements.createRollingBackupBtn.disabled = true;
				elements.createRollingBackupBtn.textContent = "⏳ Creating...";

				await createRollingBackup("manual");
				await loadRollingBackups();
				showNotification("✅ Rolling backup created!", "success");
			} catch (error) {
				debugError("Rolling backup failed:", error);
				showNotification(`❌ Failed: ${error.message}`, "error");
			} finally {
				elements.createRollingBackupBtn.disabled = false;
				elements.createRollingBackupBtn.textContent =
					"➕ Create Rolling Backup Now";
			}
		});
	}

	// Backup checkbox settings persistence
	if (elements.backupIncludeApiKeys) {
		elements.backupIncludeApiKeys.addEventListener(
			"change",
			saveBackupCheckboxSettings,
		);
	}
	if (elements.backupIncludeCredentials) {
		elements.backupIncludeCredentials.addEventListener(
			"change",
			saveBackupCheckboxSettings,
		);
	}

	// Google Drive Backup
	if (elements.libraryViewBackupsBtn) {
		elements.libraryViewBackupsBtn.addEventListener(
			"click",
			handleViewDriveBackups,
		);
	}
	if (elements.libraryDriveSyncNowBtn) {
		elements.libraryDriveSyncNowBtn.addEventListener(
			"click",
			handleDriveSyncFromLibrary,
		);
	}
	if (elements.driveBackupsClose) {
		elements.driveBackupsClose.addEventListener("click", () =>
			closeModal(elements.driveBackupsModal),
		);
	}
	if (elements.connectDriveBtn) {
		elements.connectDriveBtn.addEventListener("click", handleConnectDrive);
	}
	if (elements.disconnectDriveBtn) {
		elements.disconnectDriveBtn.addEventListener(
			"click",
			handleDisconnectDrive,
		);
	}
	if (elements.backupNowBtn) {
		elements.backupNowBtn.addEventListener("click", handleBackupNow);
	}
	if (elements.driveBackupModeRadios) {
		elements.driveBackupModeRadios.forEach((radio) => {
			radio.addEventListener("change", handleDriveBackupModeChange);
		});
	}
	if (elements.continuousBackupCheckInterval) {
		elements.continuousBackupCheckInterval.addEventListener(
			"change",
			handleContinuousBackupCheckIntervalChange,
		);
		elements.continuousBackupCheckInterval.addEventListener(
			"input",
			handleContinuousBackupCheckIntervalChange,
		);
	}
	if (elements.driveBackupRetention) {
		elements.driveBackupRetention.addEventListener(
			"change",
			handleDriveBackupRetentionChange,
		);
		elements.driveBackupRetention.addEventListener(
			"input",
			handleDriveBackupRetentionChange,
		);
	}
	if (elements.driveAutoRestoreEnabled) {
		elements.driveAutoRestoreEnabled.addEventListener(
			"change",
			handleDriveAutoRestoreToggle,
		);
	}
	if (elements.toggleClientSecretBtn && elements.driveClientSecretInput) {
		elements.toggleClientSecretBtn.addEventListener("click", () => {
			const isPassword =
				elements.driveClientSecretInput.type === "password";
			elements.driveClientSecretInput.type = isPassword
				? "text"
				: "password";
			elements.toggleClientSecretBtn.textContent = isPassword
				? "🙈"
				: "👁️";
			elements.toggleClientSecretBtn.title = isPassword
				? "Hide Client Secret"
				: "Show Client Secret";
		});
	}
	if (elements.saveOAuthSettingsBtn) {
		elements.saveOAuthSettingsBtn.addEventListener(
			"click",
			handleSaveOAuthSettings,
		);
	}
	if (elements.parseOAuthJsonBtn) {
		elements.parseOAuthJsonBtn.addEventListener(
			"click",
			handleParseOAuthJson,
		);
	}
	if (elements.saveOAuthFromJsonBtn) {
		elements.saveOAuthFromJsonBtn.addEventListener(
			"click",
			handleSaveOAuthFromJson,
		);
	}

	// Debug mode toggle
	if (elements.debugModeToggle) {
		elements.debugModeToggle.addEventListener("change", async (e) => {
			const enabled = e.target.checked;
			await browser.storage.local.set({ debugMode: enabled });
			showNotification(
				enabled
					? "Debug mode enabled. Check browser console for logs."
					: "Debug mode disabled.",
				enabled ? "success" : "info",
			);
		});
	}

	// Telemetry settings
	if (elements.telemetryToggle) {
		elements.telemetryToggle.addEventListener("change", async (e) => {
			const enabled = e.target.checked;
			if (enabled) {
				await optInTelemetry();
				showNotification(
					"Analytics enabled. Thank you for helping improve Ranobe Gemini!",
					"success",
				);
			} else {
				await optOutTelemetry();
				showNotification(
					"Analytics disabled. You can re-enable anytime.",
					"info",
				);
			}
		});
	}
	if (elements.sendErrorsToggle) {
		elements.sendErrorsToggle.addEventListener("change", async (e) => {
			await saveTelemetryConfig({ sendErrorReports: e.target.checked });
		});
	}
	if (elements.webhookUrl) {
		elements.webhookUrl.addEventListener("change", async (e) => {
			await saveTelemetryConfig({
				customWebhookUrl: e.target.value.trim(),
			});
			if (e.target.value.trim()) {
				showNotification("Custom webhook URL saved", "success");
			}
		});
	}

	// Theme settings (Library Modal)
	const buildLibraryTheme = () => ({
		mode: elements.libraryThemeMode?.value || "dark",
		accentPrimary:
			elements.libraryAccentColorPicker?.value ||
			defaultTheme.accentPrimary,
		accentSecondary:
			elements.libraryAccentSecondaryPicker?.value ||
			defaultTheme.accentSecondary,
		bgColor:
			elements.libraryBackgroundColorPicker?.value ||
			defaultTheme.bgColor,
		textColor:
			elements.libraryTextColorPicker?.value || defaultTheme.textColor,
	});

	const syncLibraryColorInputs = (picker, text) => {
		if (!picker || !text) return;
		picker.addEventListener("input", () => {
			text.value = picker.value;
			setThemeVariables(buildLibraryTheme());
		});
		text.addEventListener("input", () => {
			if (/^#[0-9A-Fa-f]{6}$/.test(text.value)) {
				picker.value = text.value;
				setThemeVariables(buildLibraryTheme());
			}
		});
	};

	syncLibraryColorInputs(
		elements.libraryAccentColorPicker,
		elements.libraryAccentColorText,
	);
	syncLibraryColorInputs(
		elements.libraryAccentSecondaryPicker,
		elements.libraryAccentSecondaryText,
	);
	syncLibraryColorInputs(
		elements.libraryBackgroundColorPicker,
		elements.libraryBackgroundColorText,
	);
	syncLibraryColorInputs(
		elements.libraryTextColorPicker,
		elements.libraryTextColorText,
	);

	if (elements.libraryThemeMode) {
		elements.libraryThemeMode.addEventListener("change", async () => {
			const theme = buildLibraryTheme();
			setThemeVariables(theme);
			await browser.storage.local.set({ themeSettings: theme });
			showNotification("✅ Theme updated", "success");
		});
	}

	if (elements.librarySaveThemeBtn) {
		elements.librarySaveThemeBtn.addEventListener("click", async () => {
			try {
				const theme = buildLibraryTheme();
				await browser.storage.local.set({ themeSettings: theme });
				setThemeVariables(theme);
				showNotification("✅ Theme saved", "success");
			} catch (error) {
				debugError("Failed to save theme:", error);
				showNotification("❌ Failed to save theme", "error");
			}
		});
	}

	if (elements.libraryResetThemeBtn) {
		elements.libraryResetThemeBtn.addEventListener("click", async () => {
			try {
				await browser.storage.local.set({
					themeSettings: defaultTheme,
				});
				await loadLibraryThemeControls();
				setThemeVariables(defaultTheme);
				showNotification("✅ Theme reset", "success");
			} catch (error) {
				debugError("Failed to reset theme:", error);
				showNotification("❌ Failed to reset theme", "error");
			}
		});
	}

	// API key + model settings (Library Modal)
	if (elements.librarySaveApiKeyBtn && elements.libraryApiKeyInput) {
		elements.librarySaveApiKeyBtn.addEventListener("click", async () => {
			const apiKey = elements.libraryApiKeyInput.value.trim();
			if (!apiKey) {
				showNotification("❌ Please enter a valid API key", "error");
				return;
			}
			try {
				await browser.storage.local.set({ apiKey });
				await updateLibraryModelSelector(apiKey);
				showNotification("✅ API key saved", "success");
			} catch (error) {
				debugError("Error saving API key:", error);
				showNotification("❌ Failed to save API key", "error");
			}
		});
	}

	if (elements.libraryTestApiKeyBtn && elements.libraryApiKeyInput) {
		elements.libraryTestApiKeyBtn.addEventListener("click", async () => {
			const apiKey = elements.libraryApiKeyInput.value.trim();
			if (!apiKey) {
				showNotification("❌ Enter an API key to test", "error");
				return;
			}
			try {
				elements.libraryTestApiKeyBtn.disabled = true;
				showNotification("🔍 Testing API key...", "info");
				const models = await fetchLibraryModels(apiKey);
				if (models && models.length > 0) {
					await browser.storage.local.set({ apiKey });
					await updateLibraryModelSelector(apiKey);
					showNotification(
						"✅ API key valid. Models loaded.",
						"success",
					);
				} else {
					showNotification(
						"❌ API key invalid or no models",
						"error",
					);
				}
			} catch (error) {
				debugError("Error testing API key:", error);
				showNotification("❌ Failed to test API key", "error");
			} finally {
				elements.libraryTestApiKeyBtn.disabled = false;
			}
		});
	}

	if (elements.libraryRefreshModelsBtn) {
		elements.libraryRefreshModelsBtn.addEventListener("click", async () => {
			const apiKey = elements.libraryApiKeyInput?.value.trim();
			if (!apiKey) {
				showNotification("❌ Enter API key to refresh models", "error");
				return;
			}
			await updateLibraryModelSelector(apiKey);
			showNotification("✅ Models refreshed", "success");
		});
	}

	if (elements.libraryModelSelect) {
		elements.libraryModelSelect.addEventListener("change", async () => {
			const selectedModelId = elements.libraryModelSelect.value;
			if (!selectedModelId) return;
			try {
				const stored =
					await browser.storage.local.get("availableModels");
				const matched = stored.availableModels?.find(
					(m) => m.id === selectedModelId,
				);
				const modelEndpoint =
					matched?.endpoint ||
					`https://generativelanguage.googleapis.com/v1beta/models/${selectedModelId}:generateContent`;
				setLibraryModelEndpoint(modelEndpoint);
				await browser.storage.local.set({
					selectedModelId,
					modelEndpoint,
				});
				showNotification("✅ Model selected", "success");
			} catch (error) {
				debugError("Failed to save model selection:", error);
				showNotification("❌ Failed to save model", "error");
			}
		});
	}

	if (elements.libraryCopyModelEndpointBtn) {
		elements.libraryCopyModelEndpointBtn.addEventListener(
			"click",
			async () => {
				const endpoint =
					elements.libraryModelEndpointInput?.value || "";
				if (!endpoint) {
					showNotification("❌ No model URL to copy", "error");
					return;
				}
				try {
					await navigator.clipboard.writeText(endpoint);
					showNotification("✅ Model URL copied", "success");
				} catch (error) {
					debugError("Failed to copy model URL:", error);
					showNotification("❌ Failed to copy URL", "error");
				}
			},
		);
	}

	// AI Model settings (Library Modal)
	if (elements.libraryTemperatureSlider) {
		elements.libraryTemperatureSlider.addEventListener("input", (e) => {
			const value = parseFloat(e.target.value);
			if (elements.libraryTemperatureValue) {
				elements.libraryTemperatureValue.textContent = value.toFixed(1);
			}
		});

		elements.libraryTemperatureSlider.addEventListener(
			"change",
			async (e) => {
				const value = parseFloat(e.target.value);
				await browser.storage.local.set({ customTemperature: value });
				showNotification("✅ Temperature setting saved", "success");
			},
		);
	}

	// Font size settings (Library Modal)
	if (elements.libraryFontSizeSlider) {
		elements.libraryFontSizeSlider.addEventListener("input", (e) => {
			const value = parseInt(e.target.value, 10);
			if (elements.libraryFontSizeValue) {
				elements.libraryFontSizeValue.textContent = `${value}%`;
			}
		});

		elements.libraryFontSizeSlider.addEventListener("change", async (e) => {
			const value = parseInt(e.target.value, 10);
			await browser.storage.local.set({ fontSize: value });
			document.documentElement.style.setProperty(
				"--content-font-size",
				`${value}%`,
			);
			showNotification("✅ Font size setting saved", "success");
		});
	}

	// Advanced Settings - Top K slider (Library Modal)
	if (elements.libraryTopKSlider) {
		elements.libraryTopKSlider.addEventListener("input", (e) => {
			const value = parseInt(e.target.value, 10);
			if (elements.libraryTopKValue) {
				elements.libraryTopKValue.textContent = value;
			}
		});

		elements.libraryTopKSlider.addEventListener("change", async (e) => {
			const value = parseInt(e.target.value, 10);
			await browser.storage.local.set({ topK: value });
			showNotification("✅ Top K setting saved", "success");
		});
	}

	// Advanced Settings - Top P slider (Library Modal)
	if (elements.libraryTopPSlider) {
		elements.libraryTopPSlider.addEventListener("input", (e) => {
			const value = parseFloat(e.target.value);
			if (elements.libraryTopPValue) {
				elements.libraryTopPValue.textContent = value.toFixed(2);
			}
		});

		elements.libraryTopPSlider.addEventListener("change", async (e) => {
			const value = parseFloat(e.target.value);
			await browser.storage.local.set({ topP: value });
			showNotification("✅ Top P setting saved", "success");
		});
	}

	// Advanced Settings - Copy endpoint button (Library Modal)
	if (elements.libraryAdvancedCopyEndpoint) {
		elements.libraryAdvancedCopyEndpoint.addEventListener(
			"click",
			async () => {
				const endpoint =
					elements.libraryAdvancedModelEndpoint?.value || "";
				if (!endpoint) {
					showNotification("❌ No model URL to copy", "error");
					return;
				}
				try {
					await navigator.clipboard.writeText(endpoint);
					showNotification("✅ Model URL copied", "success");
				} catch (error) {
					debugError("Failed to copy model URL:", error);
					showNotification("❌ Failed to copy URL", "error");
				}
			},
		);
	}

	// Factory Reset Button
	if (document.getElementById("library-factory-reset-btn")) {
		document
			.getElementById("library-factory-reset-btn")
			.addEventListener("click", handleFactoryReset);
	}

	// Advanced Settings - Prompt reset buttons (Library Modal)
	if (elements.libraryResetPromptMain) {
		elements.libraryResetPromptMain.addEventListener("click", async () => {
			if (elements.libraryPromptMain) {
				elements.libraryPromptMain.value = DEFAULT_PROMPT;
				await browser.storage.local.set({
					customPrompt: DEFAULT_PROMPT,
				});
				showNotification("✅ Main prompt reset to default", "success");
			}
		});
	}

	if (elements.libraryResetPromptSummary) {
		elements.libraryResetPromptSummary.addEventListener(
			"click",
			async () => {
				if (elements.libraryPromptSummary) {
					elements.libraryPromptSummary.value =
						DEFAULT_SUMMARY_PROMPT;
					await browser.storage.local.set({
						customSummaryPrompt: DEFAULT_SUMMARY_PROMPT,
					});
					showNotification(
						"✅ Summary prompt reset to default",
						"success",
					);
				}
			},
		);
	}

	if (elements.libraryResetPromptShortSummary) {
		elements.libraryResetPromptShortSummary.addEventListener(
			"click",
			async () => {
				if (elements.libraryPromptShortSummary) {
					elements.libraryPromptShortSummary.value =
						DEFAULT_SHORT_SUMMARY_PROMPT;
					await browser.storage.local.set({
						customShortSummaryPrompt: DEFAULT_SHORT_SUMMARY_PROMPT,
					});
					showNotification(
						"✅ Short summary prompt reset to default",
						"success",
					);
				}
			},
		);
	}

	if (elements.libraryResetPromptPermanent) {
		elements.libraryResetPromptPermanent.addEventListener(
			"click",
			async () => {
				if (elements.libraryPromptPermanent) {
					elements.libraryPromptPermanent.value =
						DEFAULT_PERMANENT_PROMPT;
					await browser.storage.local.set({
						permanentPrompt: DEFAULT_PERMANENT_PROMPT,
					});
					showNotification(
						"✅ Permanent prompt reset to default",
						"success",
					);
				}
			},
		);
	}

	// Telemetry consent modal (opt-out notification)
	if (elements.telemetryAcceptBtn) {
		elements.telemetryAcceptBtn.addEventListener("click", async () => {
			// Keep enabled (default)
			await markFirstRunComplete();
			closeModal(elements.telemetryConsentModal);
			showNotification(
				"Thank you for helping improve Ranobe Gemini!",
				"success",
			);
		});
	}
	if (elements.telemetryDeclineBtn) {
		elements.telemetryDeclineBtn.addEventListener("click", async () => {
			await optOutTelemetry();
			await markFirstRunComplete();
			closeModal(elements.telemetryConsentModal);
			// Update UI
			if (elements.telemetryToggle) {
				elements.telemetryToggle.checked = false;
			}
			showNotification(
				"Analytics disabled. You can re-enable anytime in Settings.",
				"info",
			);
		});
	}

	// Telemetry opt-out banner
	if (elements.telemetryBannerDisable) {
		elements.telemetryBannerDisable.addEventListener("click", async () => {
			await optOutTelemetry();
			await saveTelemetryConfig({
				consentShown: true,
				consentDate: Date.now(),
			});
			await markFirstRunComplete();
			if (elements.telemetryToggle) {
				elements.telemetryToggle.checked = false;
			}
			if (elements.telemetryBanner) {
				elements.telemetryBanner.classList.add("hidden");
			}
			showNotification(
				"Analytics disabled. You can re-enable anytime in Settings.",
				"info",
			);
		});
	}
	if (elements.telemetryBannerKeep) {
		elements.telemetryBannerKeep.addEventListener("click", async () => {
			await saveTelemetryConfig({
				consentShown: true,
				consentDate: Date.now(),
			});
			await markFirstRunComplete();
			if (elements.telemetryToggle) {
				elements.telemetryToggle.checked = true;
			}
			if (elements.telemetryBanner) {
				elements.telemetryBanner.classList.add("hidden");
			}
			showNotification(
				"Thanks for helping improve Ranobe Gemini!",
				"success",
			);
		});
	}

	// Carousel controls
	elements.carouselPlayPause.addEventListener(
		"click",
		toggleCarouselPlayPause,
	);
	elements.carouselPrev.addEventListener("click", () => moveCarousel(-1));
	elements.carouselNext.addEventListener("click", () => moveCarousel(1));

	// Modal backdrop clicks
	document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
		backdrop.addEventListener("click", (e) => {
			const modal = e.target.closest(".modal");
			if (modal) closeModal(modal);
		});
	});

	// Escape key to close modals
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			document
				.querySelectorAll(".modal:not(.hidden)")
				.forEach(closeModal);
		}
	});
}

/**
 * Load library data and update UI
 */
async function loadLibrary() {
	showLoading(true);

	try {
		// Clean up any duplicates first
		const cleanupResult = await novelLibrary.cleanupDuplicates();
		if (cleanupResult.totalRemoved > 0) {
			debugLog(
				`📚 Cleaned up ${cleanupResult.totalRemoved} duplicate novels`
			);
		}

		// Get all novels
		allNovels = await novelLibrary.getRecentNovels();

		// Apply auto-hold based on inactivity
		const updated = await enforceAutoHold(allNovels);
		if (updated) {
			allNovels = await novelLibrary.getRecentNovels();
		}

		const enabledShelfIds = new Set(
			filterEnabledShelves(siteSettings).map((shelf) => shelf.id)
		);
		allNovels = allNovels.filter((novel) =>
			enabledShelfIds.has(novel.shelfId)
		);

		// Get library stats after any updates
		const stats = await novelLibrary.getStats();
		updateStats(stats);

		// Check if library is empty
		if (allNovels.length === 0) {
			showEmptyState(true);
			showLoading(false);
			return;
		}

		showEmptyState(false);

		// Initialize carousel with recent novels
		initCarousel(allNovels);

		// Render current view
		renderCurrentView();
	} catch (error) {
		debugError("Failed to load library:", error);
		showEmptyState(true);
	}

	showLoading(false);
}

/**
 * Update stats display
 */
function updateStats(stats) {
	const enabledShelves = filterEnabledShelves(siteSettings);
	const enabledShelfIds = new Set(enabledShelves.map((shelf) => shelf.id));
	const enabledNovels = allNovels || [];
	const enabledChapters = enabledNovels.reduce(
		(sum, novel) => sum + (novel.enhancedChaptersCount || 0),
		0
	);

	if (elements.totalNovels)
		elements.totalNovels.textContent = enabledNovels.length;
	if (elements.totalChapters)
		elements.totalChapters.textContent = enabledChapters;

	// Count active shelves
	const activeShelfCount = Object.entries(stats.shelves || {}).filter(
		([id, shelfStats]) =>
			enabledShelfIds.has(id) && (shelfStats?.novelCount || 0) > 0
	).length;
	if (elements.shelfCount) elements.shelfCount.textContent = activeShelfCount;
}

/**
 * Render the current view
 */
function renderCurrentView() {
	const filteredNovels = filterAndSortNovels();

	// Show/hide reading status filter based on view
	if (elements.autoHoldToggle) {
		elements.autoHoldToggle.addEventListener("change", async (e) => {
			await persistAutoHoldSettings({
				autoHoldEnabled: e.target.checked,
			});
		});
	}
	if (elements.autoHoldDays) {
		elements.autoHoldDays.addEventListener("change", async (e) => {
			const days = Math.max(1, parseInt(e.target.value, 10) || 7);
			elements.autoHoldDays.value = days;
			await persistAutoHoldSettings({ autoHoldDays: days });
		});
	}
	if (elements.readingStatusFilter) {
		elements.readingStatusFilter.classList.toggle(
			"hidden",
			currentView !== "lists"
		);
	}

	switch (currentView) {
		case "shelves":
			renderShelvesView(filteredNovels);
			break;
		case "recent":
			renderRecentView(filteredNovels);
			break;
		case "all":
			renderAllView(filteredNovels);
			break;
		case "lists":
			renderListsView(filteredNovels);
			break;
	}
}

/**
 * Filter and sort novels based on current settings
 */
function filterAndSortNovels() {
	let novels = [...allNovels];

	// Filter by search query
	if (searchQuery) {
		const query = searchQuery.toLowerCase();
		novels = novels.filter(
			(novel) =>
				novel.title.toLowerCase().includes(query) ||
				novel.author.toLowerCase().includes(query)
		);
	}

	// Filter by reading status (only in lists view)
	if (currentView === "lists" && currentStatusFilter !== "all") {
		novels = novels.filter((novel) => {
			const novelStatus = novel.readingStatus || "unset";
			return novelStatus === currentStatusFilter;
		});
	}

	// Sort
	switch (currentSort) {
		case "recent":
			novels.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
			break;
		case "added":
			novels.sort((a, b) => b.addedAt - a.addedAt);
			break;
		case "title":
			novels.sort((a, b) => a.title.localeCompare(b.title));
			break;
		case "chapters":
			novels.sort(
				(a, b) =>
					(b.enhancedChaptersCount || 0) -
					(a.enhancedChaptersCount || 0)
			);
			break;
	}

	return novels;
}

/**
 * Render reading lists view with status filtering
 */
function renderListsView(novels) {
	if (!elements.listsNovels) return;

	// Update title based on current filter
	const statusInfo = READING_STATUS_INFO[currentStatusFilter];
	if (elements.listsTitle) {
		if (currentStatusFilter === "all") {
			elements.listsTitle.textContent = "📖 Reading Lists";
		} else if (statusInfo) {
			elements.listsTitle.textContent = `${statusInfo.label}`;
		}
	}

	// Render stats
	if (elements.listsStats) {
		renderListsStats();
	}

	// Render novels
	elements.listsNovels.innerHTML = "";

	if (novels.length === 0) {
		elements.listsNovels.innerHTML = `
			<div class="empty-list-message">
				<p>No novels in this list yet.</p>
				<p class="empty-hint">Set a reading status on any novel to see it here!</p>
			</div>
		`;
		return;
	}

	novels.forEach((novel) => {
		const card = createNovelCard(novel);
		elements.listsNovels.appendChild(card);
	});
}

/**
 * Render reading status stats
 */
async function renderListsStats() {
	if (!elements.listsStats) return;

	// Count novels by status
	const statusCounts = {};
	Object.values(READING_STATUS).forEach((status) => {
		statusCounts[status] = 0;
	});
	statusCounts["unset"] = 0;

	allNovels.forEach((novel) => {
		const status = novel.readingStatus || "unset";
		if (statusCounts[status] !== undefined) {
			statusCounts[status]++;
		} else {
			statusCounts["unset"]++;
		}
	});

	// Build stats HTML
	let statsHtml = "";
	Object.entries(READING_STATUS_INFO).forEach(([status, info]) => {
		const count = statusCounts[status] || 0;
		statsHtml += `
			<div class="lists-stat-item">
				<span>${info.label.split(" ")[0]}</span>
				<span class="count">${count}</span>
			</div>
		`;
	});

	// Add unset count
	if (statusCounts["unset"] > 0) {
		statsHtml += `
			<div class="lists-stat-item">
				<span>📌</span>
				<span class="count">${statusCounts["unset"]}</span>
				<span style="font-size: 0.8em; color: var(--text-muted);">No Status</span>
			</div>
		`;
	}

	elements.listsStats.innerHTML = statsHtml;
}

/**
 * Render shelves view
 */
function renderShelvesView(novels) {
	elements.shelvesView.innerHTML = "";

	// Group novels by shelf
	const novelsByShelf = {};
	const shelfLatestActivity = {}; // Track latest activity per shelf

	for (const novel of novels) {
		if (!novelsByShelf[novel.shelfId]) {
			novelsByShelf[novel.shelfId] = [];
			shelfLatestActivity[novel.shelfId] = 0;
		}
		novelsByShelf[novel.shelfId].push(novel);
		// Track the most recent activity in this shelf
		const novelActivity = novel.lastAccessedAt || novel.addedAt || 0;
		if (novelActivity > shelfLatestActivity[novel.shelfId]) {
			shelfLatestActivity[novel.shelfId] = novelActivity;
		}
	}

	// Sort enabled shelves by latest activity (most recent first)
	const sortedShelves = filterEnabledShelves(siteSettings).sort((a, b) => {
		const activityA = shelfLatestActivity[a.id] || 0;
		const activityB = shelfLatestActivity[b.id] || 0;
		return activityB - activityA; // Descending order
	});

	// Render shelves in sorted order
	for (const shelfDefinition of sortedShelves) {
		const shelfNovels = novelsByShelf[shelfDefinition.id] || [];

		const shelfSection = document.createElement("section");
		// Start collapsed by default
		shelfSection.className = "shelf-section collapsed";
		shelfSection.dataset.shelfId = shelfDefinition.id;

		const showAll = shelfSection.dataset.expanded === "true";
		const isCollapsed = shelfSection.classList.contains("collapsed");
		// When collapsed, render all cards but CSS will limit visible rows
		// When expanded but not showAll, show first 10 (2 rows), otherwise show all
		const visibleNovels =
			showAll || isCollapsed ? shelfNovels : shelfNovels.slice(0, 10);
		const hasMore = shelfNovels.length > 10;

		shelfSection.innerHTML = `
			<div class="shelf-header">
				<h2 class="shelf-title">
					<button class="shelf-collapse-btn" title="Expand shelf" data-shelf-id="${
						shelfDefinition.id
					}">
						<span class="collapse-icon">▶</span>
					</button>
					<span class="shelf-color-bar" style="background: ${
						shelfDefinition.color
					}"></span>
					${renderShelfIcon(shelfDefinition.icon)}
					${shelfDefinition.name}
					<span class="novel-count">(${shelfNovels.length})</span>
				</h2>
				<a href="websites/${
					shelfDefinition.id
				}/index.html" class="shelf-view-all-link" title="View full shelf page">
					View All →
				</a>
			</div>
			<div class="novel-grid ${!showAll && hasMore ? "limited" : ""}"></div>
			${
				hasMore
					? `<button class="shelf-show-more" data-shelf-id="${
							shelfDefinition.id
					  }" style="display: none;">${
							showAll ? "Show Less" : "Show More"
					  }</button>`
					: ""
			}
		`;

		const grid = shelfSection.querySelector(".novel-grid");

		if (shelfNovels.length === 0) {
			// Show empty shelf message
			grid.innerHTML = `
				<div class="empty-shelf-message">
					<span class="empty-icon">📚</span>
					<p>No novels from ${shelfDefinition.name} yet!</p>
					<small>Visit a chapter on <a href="https://${shelfDefinition.primaryDomain}" class="shelf-domain-link" target="_blank">${shelfDefinition.primaryDomain}</a> to add novels</small>
				</div>
			`;
		} else {
			// Render novel cards (limited or all) - use shelf-specific card for this view
			visibleNovels.forEach((novel) => {
				grid.appendChild(
					createNovelCardForShelf(novel, shelfDefinition)
				);
			});
		}

		// Add event listeners
		const collapseBtn = shelfSection.querySelector(".shelf-collapse-btn");
		collapseBtn.addEventListener("click", () =>
			toggleShelfCollapse(shelfDefinition.id)
		);

		const showMoreBtn = shelfSection.querySelector(".shelf-show-more");
		if (showMoreBtn) {
			showMoreBtn.addEventListener("click", () =>
				toggleShelfExpand(shelfDefinition.id)
			);
		}

		elements.shelvesView.appendChild(shelfSection);
	}

	// If no shelves registered at all, show empty state
	if (Object.keys(SHELVES).length === 0) {
		showEmptyState(true);
	}
}

/**
 * Create a novel card for shelf view (shows tags instead of website name)
 */
function createNovelCardForShelf(novel, shelf) {
	const card = document.createElement("div");
	card.className = "novel-card";
	card.dataset.novelId = novel.id;

	// Fallback to extension logo if cover fails to load
	const fallbackLogo = browser.runtime.getURL("icons/logo-256.png");

	// Generate placeholder content with icon image support
	const placeholderContent = shelf
		? renderShelfIconForPlaceholder(shelf.icon, shelf.emoji || "📖")
		: "📖";

	const coverHtml = novel.coverUrl
		? `<img data-cover-src="${escapeHtml(
				novel.coverUrl
		  )}" alt="Cover" class="novel-cover" loading="lazy">`
		: `<div class="novel-cover-placeholder">${placeholderContent}</div>`;

	const progress =
		novel.totalChapters > 0
			? Math.round((novel.lastReadChapter / novel.totalChapters) * 100)
			: 0;

	// Get current reading status
	const currentStatus = novel.readingStatus || READING_STATUS.PLAN_TO_READ;
	const statusInfo =
		READING_STATUS_INFO[currentStatus] ||
		READING_STATUS_INFO[READING_STATUS.PLAN_TO_READ];

	// Generate status dropdown options
	const statusOptions = Object.entries(READING_STATUS_INFO)
		.map(
			([status, info]) =>
				`<option value="${status}" ${
					status === currentStatus ? "selected" : ""
				}>${info.label}</option>`
		)
		.join("");

	// Show tags/genres instead of website name (since we're already in a shelf)
	const tagsHtml = (novel.genres || novel.tags || [])
		.slice(0, 3)
		.map(
			(tag) =>
				`<span class="meta-badge tag-badge">${escapeHtml(tag)}</span>`
		)
		.join("");

	card.innerHTML = `
		<div class="novel-card-inner">
			${coverHtml}
			<div class="novel-card-content">
				<h3 class="novel-card-title">${escapeHtml(novel.title)}</h3>
				<p class="novel-card-author">${escapeHtml(novel.author || "Unknown")}</p>
				<div class="novel-card-meta">
					${
						tagsHtml ||
						`<span class="meta-badge enhanced">✨ ${
							novel.enhancedChaptersCount || 0
						} enhanced</span>`
					}
				</div>
				<div class="novel-card-status">
					<select class="status-dropdown" data-novel-id="${
						novel.id
					}" title="Change reading status">
						${statusOptions}
					</select>
				</div>
				${
					novel.totalChapters > 0
						? `
				<div class="novel-card-progress">
					<div class="progress-bar">
						<div class="progress-fill" style="width: ${progress}%"></div>
					</div>
					<span>Ch. ${novel.lastReadChapter || 1}/${novel.totalChapters}</span>
				</div>
				`
						: ""
				}
			</div>
		</div>
	`;

	// Add event listener for status dropdown
	const statusDropdown = card.querySelector(".status-dropdown");
	statusDropdown.dataset.status = currentStatus;

	statusDropdown.addEventListener("click", (e) => {
		e.stopPropagation();
	});
	statusDropdown.addEventListener("change", async (e) => {
		e.stopPropagation();
		const newStatus = e.target.value;
		e.target.dataset.status = newStatus;
		await handleStatusChange(novel.id, newStatus);
	});

	// Attach cover fallback using inline onerror
	const coverImg = card.querySelector(".novel-cover");
	if (coverImg && novel.coverUrl) {
		const shelfIconUrl = shelf?.icon?.startsWith?.("http")
			? shelf.icon
			: null;
		coverImg.src = novel.coverUrl;
		coverImg.onerror = () => {
			if (shelfIconUrl) {
				coverImg.src = shelfIconUrl;
				coverImg.onerror = () => {
					coverImg.src = fallbackLogo;
					coverImg.onerror = null;
				};
			} else {
				coverImg.src = fallbackLogo;
				coverImg.onerror = null;
			}
		};
	} else if (coverImg) {
		coverImg.src = fallbackLogo;
	}
	attachIconFallbacks(card);

	card.addEventListener("click", () => openNovelDetail(novel));

	return card;
}

/**
 * Render recent view
 */
function renderRecentView(novels) {
	elements.recentNovels.innerHTML = "";

	const recentNovels = novels.slice(0, 20);
	recentNovels.forEach((novel) => {
		elements.recentNovels.appendChild(createNovelCard(novel));
	});
}

/**
 * Render all novels view
 */
function renderAllView(novels) {
	elements.allNovels.innerHTML = "";

	novels.forEach((novel) => {
		elements.allNovels.appendChild(createNovelCard(novel));
	});
}

/**
 * Create a novel card element
 */
function createNovelCard(novel) {
	const card = document.createElement("div");
	card.className = "novel-card";
	card.dataset.novelId = novel.id;

	const shelf = Object.values(SHELVES).find((s) => s.id === novel.shelfId);
	const shelfIconHtml = shelf
		? renderShelfIcon(shelf.icon, "site-icon", shelf.emoji || "📖")
		: renderShelfIcon(null, "site-icon");

	// Fallback to extension logo if cover fails to load
	const fallbackLogo = browser.runtime.getURL("icons/logo-256.png");

	// Generate placeholder content with icon image support
	const placeholderContent = shelf
		? renderShelfIconForPlaceholder(shelf.icon, shelf.emoji || "📖")
		: "📖";

	const coverHtml = novel.coverUrl
		? `<img data-cover-src="${escapeHtml(
				novel.coverUrl
		  )}" alt="Cover" class="novel-cover" loading="lazy">`
		: `<div class="novel-cover-placeholder">${placeholderContent}</div>`;

	const progress =
		novel.totalChapters > 0
			? Math.round((novel.lastReadChapter / novel.totalChapters) * 100)
			: 0;

	// Get current reading status
	const currentStatus = novel.readingStatus || READING_STATUS.PLAN_TO_READ;
	const statusInfo =
		READING_STATUS_INFO[currentStatus] ||
		READING_STATUS_INFO[READING_STATUS.PLAN_TO_READ];

	// Generate status dropdown options
	const statusOptions = Object.entries(READING_STATUS_INFO)
		.map(
			([status, info]) =>
				`<option value="${status}" ${
					status === currentStatus ? "selected" : ""
				}>${info.label}</option>`
		)
		.join("");

	card.innerHTML = `
		<div class="novel-card-inner">
			${coverHtml}
			<div class="novel-card-content">
				<h3 class="novel-card-title">${escapeHtml(novel.title)}</h3>
				<p class="novel-card-author">${escapeHtml(novel.author || "Unknown")}</p>
				<div class="novel-card-meta">
					<span class="meta-badge">${shelfIconHtml} ${escapeHtml(
		shelf?.name || "Unknown"
	)}</span>
					${
						novel.enhancedChaptersCount > 0
							? `<span class="meta-badge enhanced">✨ ${novel.enhancedChaptersCount} enhanced</span>`
							: ""
					}
				</div>
				<div class="novel-card-status">
					<select class="status-dropdown" data-novel-id="${
						novel.id
					}" title="Change reading status">
						${statusOptions}
					</select>
				</div>
				${
					novel.totalChapters > 0
						? `
				<div class="novel-card-progress">
					<div class="progress-bar">
						<div class="progress-fill" style="width: ${progress}%"></div>
					</div>
					<span>Ch. ${novel.lastReadChapter || 1}/${novel.totalChapters}</span>
				</div>
				`
						: ""
				}
			</div>
		</div>
	`;

	// Add event listener for status dropdown
	const statusDropdown = card.querySelector(".status-dropdown");
	// Set initial data attribute for CSS styling
	statusDropdown.dataset.status = currentStatus;

	statusDropdown.addEventListener("click", (e) => {
		e.stopPropagation(); // Prevent card click from opening modal
	});
	statusDropdown.addEventListener("change", async (e) => {
		e.stopPropagation();
		const newStatus = e.target.value;
		// Update data attribute for CSS styling
		e.target.dataset.status = newStatus;
		await handleStatusChange(novel.id, newStatus);
	});

	card.addEventListener("click", () => openNovelDetail(novel));

	return card;
}

/**
 * Handle reading status change from dropdown
 */
async function handleStatusChange(novelId, newStatus) {
	try {
		await novelLibrary.updateNovel(novelId, { readingStatus: newStatus });
		// Update local cache
		const novelIndex = allNovels.findIndex((n) => n.id === novelId);
		if (novelIndex !== -1) {
			allNovels[novelIndex].readingStatus = newStatus;
		}
		// Show brief notification
		showNotification(
			`Status updated to ${
				READING_STATUS_INFO[newStatus]?.label || newStatus
			}`
		);
	} catch (error) {
		debugError("Failed to update reading status:", error);
		showNotification("Failed to update status", "error");
		// Reload to reset dropdown
		loadLibrary();
	}
}

/**
 * Show a brief notification
 */
function showNotification(message, type = "success") {
	const notification = document.createElement("div");
	notification.className = `notification notification-${type}`;
	notification.textContent = message;
	document.body.appendChild(notification);

	// Animate in
	requestAnimationFrame(() => {
		notification.classList.add("show");
	});

	// Remove after 2 seconds
	setTimeout(() => {
		notification.classList.remove("show");
		setTimeout(() => notification.remove(), 300);
	}, 2000);
}

/**
 * Open novel detail modal
 * Delegates to site-specific renderer if available
 */
async function openNovelDetail(novel) {
	currentModalNovel = novel || null;
	if (elements.modalRemoveBtn && novel?.id) {
		elements.modalRemoveBtn.dataset.novelId = novel.id;
	}
	if (elements.modalStatus && novel?.id) {
		elements.modalStatus.dataset.novelId = novel.id;
	}
	const shelfId = novel.shelfId;
	let handled = false;

	if (shelfId) {
		const renderer = await loadModalRendererForShelf(shelfId);
		if (renderer && typeof renderer.showModal === "function") {
			try {
				debugLog(`Using custom modal for ${shelfId}`);
				handled = await renderer.showModal(novel);
			} catch (e) {
				debugError(`Error in custom modal for ${shelfId}:`, e);
			}
		}
	}

	if (!handled) {
		await openDefaultNovelDetail(novel);
	} else {
		applyModalActionVisibility(novel);
	}
}

/**
 * Default implementation of novel detail modal
 */
async function openDefaultNovelDetail(novel) {
	const shelf = getShelfById(novel.shelfId);
	const fallbackLogo = browser.runtime.getURL("icons/logo-256.png");

	// Reset visibility of generic elements (restoring state from site-specific modifications)
	const genericStats = document.querySelector(".novel-stats");
	if (genericStats) genericStats.style.display = "";

	const metadataContainer = document.getElementById(
		"modal-metadata-container",
	);
	if (metadataContainer) metadataContainer.style.display = "none";

	const coverContainer = document.getElementById("modal-cover-container");
	if (coverContainer) {
		// Restore standard cover image if it was replaced/removed
		if (!document.getElementById("modal-cover")) {
			coverContainer.innerHTML =
				'<img id="modal-cover" src="" alt="Cover" class="novel-cover-large" />';
			// Re-bind cached element reference if possible, or we just rely on getElementById for robust code here?
			// Since 'elements' object is cached at startup, its modalCover property is now stale (pointing to detached node).
			// We must update the cached reference.
			if (elements)
				elements.modalCover = document.getElementById("modal-cover");
		} else {
			// Just clear any siblings (placeholders) but keep the image?
			// Actually simplest is to just reset InnerHTML always to be safe
			coverContainer.innerHTML =
				'<img id="modal-cover" src="" alt="Cover" class="novel-cover-large" />';
			if (elements)
				elements.modalCover = document.getElementById("modal-cover");
		}
	}

	// Tag modal with site id for scoped styling
	if (elements.novelModal) {
		elements.novelModal.dataset.modalSite = shelf?.id || "";
	}

	// Use shelf/website icon as fallback instead of main logo
	const shelfFallback =
		shelf?.icon && shelf.icon.startsWith?.("http")
			? shelf.icon
			: fallbackLogo;

	// Set cover with fallback using inline onerror
	if (elements.modalCover) {
		elements.modalCover.style.display = "block";
		if (novel.coverUrl) {
			elements.modalCover.src = novel.coverUrl;
			elements.modalCover.onerror = () => {
				if (shelfFallback && shelfFallback !== fallbackLogo) {
					elements.modalCover.src = shelfFallback;
					elements.modalCover.onerror = () => {
						elements.modalCover.src = fallbackLogo;
						elements.modalCover.onerror = null;
					};
				} else {
					elements.modalCover.src = fallbackLogo;
					elements.modalCover.onerror = null;
				}
			};
		} else if (shelfFallback) {
			elements.modalCover.src = shelfFallback;
			elements.modalCover.onerror = () => {
				elements.modalCover.src = fallbackLogo;
				elements.modalCover.onerror = null;
			};
		} else {
			elements.modalCover.src = fallbackLogo;
			elements.modalCover.onerror = null;
		}
	}

	// Set basic info
	elements.modalTitle.textContent = novel.title;
	elements.modalAuthor.textContent = novel.author || "Unknown";

	// Render shelf badge with icon (using innerHTML to render HTML)
	elements.modalShelf.innerHTML = shelf
		? `${renderShelfIcon(shelf.icon, "site-icon")} ${shelf.name}`
		: "Unknown";
	attachIconFallbacks(elements.modalShelf);

	// Set reading status selector with options from READING_STATUS_INFO
	if (elements.modalStatusSelector) {
		const currentStatus =
			novel.readingStatus || READING_STATUS.PLAN_TO_READ;

		// Clear existing options
		elements.modalStatusSelector.innerHTML = "";

		// Populate options from READING_STATUS_INFO
		Object.entries(READING_STATUS_INFO).forEach(([status, info]) => {
			const option = document.createElement("option");
			option.value = status;
			option.textContent = info.label;
			if (status === currentStatus) {
				option.selected = true;
			}
			elements.modalStatusSelector.appendChild(option);
		});

		elements.modalStatusSelector.dataset.novelId = novel.id;
	}

	// Set status display badge
	const statusInfo =
		READING_STATUS_INFO[novel.readingStatus] ||
		READING_STATUS_INFO[READING_STATUS.PLAN_TO_READ];
	elements.modalStatus.textContent = statusInfo.label;
	elements.modalStatus.style.display = "inline";

	// Store current novel ID for status changes
	elements.modalStatus.dataset.novelId = novel.id;

	// Set stats
	elements.modalChapters.textContent = novel.totalChapters || "?";
	elements.modalEnhanced.textContent = novel.enhancedChaptersCount || 0;
	elements.modalLastRead.textContent = novel.lastReadChapter || 1;

	// Set description
	elements.modalDescription.textContent =
		novel.description || "No description available.";

	// Set genres
	if (novel.genres && novel.genres.length > 0) {
		elements.modalGenres.innerHTML = novel.genres
			.map(
				(genre) =>
					`<span class="genre-tag">${escapeHtml(genre)}</span>`,
			)
			.join("");
		elements.modalGenresContainer.style.display = "block";
	} else {
		elements.modalGenresContainer.style.display = "none";
	}

	// Populate rich metadata from site-specific renderer (fallback to generic)
	const renderedBySite = await renderNovelMetadataForShelf(novel);
	if (!renderedBySite) {
		populateNovelMetadata(novel);
	}

	// Wire up .status-btn elements added by site-specific renderers
	const statusButtons = document.querySelectorAll(".status-btn");
	const currentStatus = novel.readingStatus || READING_STATUS.PLAN_TO_READ;

	statusButtons.forEach((btn) => {
		const status = btn.getAttribute("data-status");

		// Set active state
		if (status === currentStatus) {
			btn.classList.add("active");
		} else {
			btn.classList.remove("active");
		}

		// Add click handler
		btn.onclick = async () => {
			try {
				await novelLibrary.updateNovel(novel.id, {
					readingStatus: status,
				});

				// Update button states
				statusButtons.forEach((b) => {
					if (b.getAttribute("data-status") === status) {
						b.classList.add("active");
					} else {
						b.classList.remove("active");
					}
				});

				// Update the dropdown selector if present
				if (elements.modalStatusSelector) {
					elements.modalStatusSelector.value = status;
				}

				// Update the status badge
				const statusInfo = READING_STATUS_INFO[status];
				if (elements.modalStatus && statusInfo) {
					elements.modalStatus.textContent = statusInfo.label;
				}

				// Refresh the library view
				await loadLibrary();

				showNotification("Status updated successfully!");
			} catch (error) {
				debugError("Error updating status:", error);
				showNotification("Failed to update status");
			}
		};
	});

	// Set action buttons
	const refreshTarget = resolveMetadataRefreshUrl(novel);
	elements.modalContinueBtn.href =
		novel.lastReadUrl || novel.sourceUrl || "#";
	if (elements.modalSourceBtn) {
		elements.modalSourceBtn.href = refreshTarget || novel.sourceUrl || "#";
	}
	if (elements.modalRefreshBtn) {
		elements.modalRefreshBtn.dataset.refreshUrl = refreshTarget || "";
	}

	applyModalActionVisibility(novel);

	// Store current novel ID for removal
	elements.modalRemoveBtn.dataset.novelId = novel.id;

	openModal(elements.novelModal);
}

/**
 * Populate novel metadata sections in the modal
 * @param {Object} novel - The novel object with metadata
 */
function populateNovelMetadata(novel) {
	const metadata = novel.metadata || {};
	let hasAnyMetadata = false;

	// Helper function to render tag list
	const renderTagList = (container, tags) => {
		if (!container || !tags || tags.length === 0) return false;
		container.innerHTML = tags
			.map((tag) => `<span class="tag-item">${escapeHtml(tag)}</span>`)
			.join("");
		return true;
	};

	// Rating section (primarily for AO3, FanFiction)
	if (metadata.rating) {
		hasAnyMetadata = true;
		elements.modalRatingSection.style.display = "block";

		// Determine rating class for styling
		const ratingLower = metadata.rating.toLowerCase();
		let ratingClass = "rating-not-rated";
		if (
			ratingLower.includes("general") ||
			ratingLower === "g" ||
			ratingLower === "k"
		) {
			ratingClass = "rating-general";
		} else if (
			ratingLower.includes("teen") ||
			ratingLower === "t" ||
			ratingLower === "k+"
		) {
			ratingClass = "rating-teen";
		} else if (ratingLower.includes("mature") || ratingLower === "m") {
			ratingClass = "rating-mature";
		} else if (
			ratingLower.includes("explicit") ||
			ratingLower === "e" ||
			ratingLower === "ma"
		) {
			ratingClass = "rating-explicit";
		}

		elements.modalRating.className = `rating-badge ${ratingClass}`;
		elements.modalRating.textContent = metadata.rating;

		// Warnings
		if (metadata.warnings && metadata.warnings.length > 0) {
			elements.modalWarningsRow.style.display = "flex";
			renderTagList(elements.modalWarnings, metadata.warnings);
		} else if (
			metadata.archive_warnings &&
			metadata.archive_warnings.length > 0
		) {
			elements.modalWarningsRow.style.display = "flex";
			renderTagList(elements.modalWarnings, metadata.archive_warnings);
		} else {
			elements.modalWarningsRow.style.display = "none";
		}

		// Categories
		if (metadata.categories && metadata.categories.length > 0) {
			elements.modalCategoriesRow.style.display = "flex";
			renderTagList(elements.modalCategories, metadata.categories);
		} else {
			elements.modalCategoriesRow.style.display = "none";
		}
	} else {
		elements.modalRatingSection.style.display = "none";
	}

	// Fandoms section
	if (metadata.fandoms && metadata.fandoms.length > 0) {
		hasAnyMetadata = true;
		elements.modalFandomsSection.style.display = "block";
		renderTagList(elements.modalFandoms, metadata.fandoms);
	} else if (metadata.fandom) {
		hasAnyMetadata = true;
		elements.modalFandomsSection.style.display = "block";
		elements.modalFandoms.innerHTML = `<span class="tag-item">${escapeHtml(
			metadata.fandom
		)}</span>`;
	} else {
		elements.modalFandomsSection.style.display = "none";
	}

	// Relationships section
	if (metadata.relationships && metadata.relationships.length > 0) {
		hasAnyMetadata = true;
		elements.modalRelationshipsSection.style.display = "block";
		renderTagList(elements.modalRelationships, metadata.relationships);
	} else {
		elements.modalRelationshipsSection.style.display = "none";
	}

	// Characters section
	if (metadata.characters && metadata.characters.length > 0) {
		hasAnyMetadata = true;
		elements.modalCharactersSection.style.display = "block";
		renderTagList(elements.modalCharacters, metadata.characters);
	} else {
		elements.modalCharactersSection.style.display = "none";
	}

	// Additional Tags section (use additionalTags, freeformTags, or tags)
	const additionalTags =
		metadata.additionalTags || metadata.freeformTags || metadata.tags;
	if (additionalTags && additionalTags.length > 0) {
		hasAnyMetadata = true;
		elements.modalAdditionalTagsSection.style.display = "block";
		renderTagList(elements.modalAdditionalTags, additionalTags);
	} else {
		elements.modalAdditionalTagsSection.style.display = "none";
	}

	// Work Stats section
	// Check both metadata.stats (AO3 style) and metadata directly (FanFiction style)
	const statsNested = metadata.stats || {};
	const stats = {
		words: statsNested.words || metadata.words || null,
		kudos: statsNested.kudos || metadata.kudos || null,
		hits: statsNested.hits || metadata.hits || null,
		bookmarks: statsNested.bookmarks || metadata.bookmarks || null,
		comments: statsNested.comments || metadata.comments || null,
		reviews: statsNested.reviews || metadata.reviews || null,
		favorites: statsNested.favorites || metadata.favorites || null,
		follows: statsNested.follows || metadata.follows || null,
	};
	const hasStats =
		stats.words ||
		stats.kudos ||
		stats.hits ||
		stats.bookmarks ||
		stats.comments ||
		stats.reviews ||
		stats.favorites ||
		stats.follows;
	if (hasStats) {
		hasAnyMetadata = true;
		elements.modalWorkStatsSection.style.display = "block";

		let statsHtml = "";
		if (stats.words) {
			statsHtml += `<div class="work-stat-item"><span class="work-stat-value">${formatNumber(
				stats.words
			)}</span><span class="work-stat-label">Words</span></div>`;
		}
		if (stats.kudos) {
			statsHtml += `<div class="work-stat-item"><span class="work-stat-value">${formatNumber(
				stats.kudos
			)}</span><span class="work-stat-label">Kudos</span></div>`;
		}
		if (stats.hits) {
			statsHtml += `<div class="work-stat-item"><span class="work-stat-value">${formatNumber(
				stats.hits
			)}</span><span class="work-stat-label">Hits</span></div>`;
		}
		if (stats.bookmarks) {
			statsHtml += `<div class="work-stat-item"><span class="work-stat-value">${formatNumber(
				stats.bookmarks
			)}</span><span class="work-stat-label">Bookmarks</span></div>`;
		}
		if (stats.comments) {
			statsHtml += `<div class="work-stat-item"><span class="work-stat-value">${formatNumber(
				stats.comments
			)}</span><span class="work-stat-label">Comments</span></div>`;
		}
		// FanFiction-specific stats
		if (stats.reviews) {
			statsHtml += `<div class="work-stat-item"><span class="work-stat-value">${formatNumber(
				stats.reviews
			)}</span><span class="work-stat-label">Reviews</span></div>`;
		}
		if (stats.favorites) {
			statsHtml += `<div class="work-stat-item"><span class="work-stat-value">${formatNumber(
				stats.favorites
			)}</span><span class="work-stat-label">Favorites</span></div>`;
		}
		if (stats.follows) {
			statsHtml += `<div class="work-stat-item"><span class="work-stat-value">${formatNumber(
				stats.follows
			)}</span><span class="work-stat-label">Follows</span></div>`;
		}

		elements.modalWorkStats.innerHTML = statsHtml;
	} else {
		elements.modalWorkStatsSection.style.display = "none";
	}

	// Show/hide the entire metadata container
	elements.modalMetadataContainer.style.display = hasAnyMetadata
		? "block"
		: "none";
}

/**
 * Format large numbers with K/M suffixes
 * @param {number} num - The number to format
 * @returns {string} - Formatted number string
 */
function formatNumber(num) {
	if (!num) return "0";
	if (num >= 1000000) {
		return (num / 1000000).toFixed(1) + "M";
	}
	if (num >= 1000) {
		return (num / 1000).toFixed(1) + "K";
	}
	return num.toString();
}

/**
 * Handle status change from modal dropdown
 */
async function handleModalStatusChange(e) {
	const novelId = e.target.dataset.novelId;
	const newStatus = e.target.value;

	if (!novelId) return;

	try {
		// Update the novel reading status
		await novelLibrary.updateNovel(novelId, { readingStatus: newStatus });

		// Update the display badge
		const statusInfo = READING_STATUS_INFO[newStatus];
		elements.modalStatus.textContent = statusInfo?.label || newStatus;
		elements.modalStatus.style.display = "inline";

		// Refresh the view to show updated status
		await loadLibrary();

		showNotification("Status updated successfully!");
	} catch (error) {
		debugError("Error updating status:", error);
		showNotification("Failed to update status");
	}
}

/**
 * Handle refresh metadata button click
 * Resets edited fields and navigates to the novel page to refresh
 */
async function handleRefreshMetadata() {
	const novelId = elements.modalRemoveBtn.dataset.novelId;
	const novel = allNovels.find((n) => n.id === novelId);

	if (!novel) {
		showToast("Novel not found", "error");
		return;
	}

	const confirmed = confirm(
		`Refresh metadata for "${novel.title}"?\n\n` +
			`This will open the novel's page to fetch the latest details from the source.`
	);

	if (!confirmed) return;

	try {
		// Reset edited fields
		await novelLibrary.resetEditedFields(novelId, "all");

		// Mark last update as old to trigger refresh on next visit
		const library = await novelLibrary.getLibrary();
		if (library.novels[novelId]) {
			library.novels[novelId].lastMetadataUpdate = 0; // Force update on next visit
			library.novels[novelId].pendingRefresh = true; // Flag for content.js
			await novelLibrary.saveLibrary(library);
		}

		// Show banner
		showNotification("Refreshing metadata... Opening novel page", "info");

		// Close the modal
		closeModal(elements.novelModal);

		// Navigate to the best URL for refresh (handler-type aware)
		const preferredUrl =
			elements.modalRefreshBtn?.dataset.refreshUrl ||
			resolveMetadataRefreshUrl(novel);
		if (preferredUrl) {
			// Open in a new tab so user can see the refresh happen
			window.open(preferredUrl, "_blank");
		} else {
			showToast("No source URL available for this novel", "error");
		}
	} catch (error) {
		debugError("Error refreshing metadata:", error);
		showToast("Failed to reset metadata. Please try again.", "error");
	}
}

/**
 * Handle remove novel button click
 */
async function handleRemoveNovel() {
	const novelId = elements.modalRemoveBtn.dataset.novelId;

	if (
		confirm(
			"Are you sure you want to remove this novel from your library? This cannot be undone."
		)
	) {
		await novelLibrary.removeNovel(novelId);
		closeModal(elements.novelModal);
		await loadLibrary();
	}
}

// Store current novel being edited
let currentEditingNovel = null;
let currentModalNovel = null;

/**
 * Handle opening the edit modal
 */
function handleOpenEditModal() {
	const novelId =
		currentModalNovel?.id || elements.modalRemoveBtn?.dataset.novelId;
	const novel = currentModalNovel || allNovels.find((n) => n.id === novelId);

	if (!novel) {
		showToast("Novel not found", "error");
		return;
	}

	currentEditingNovel = novel;

	// Populate form fields
	elements.editTitle.value = novel.title || "";
	elements.editAuthor.value = novel.author || "";
	elements.editCover.value = novel.coverUrl || "";
	elements.editDescription.value = novel.description || "";
	elements.editStatus.value = novel.status || "unknown";
	elements.editTotalChapters.value = novel.totalChapters || "";
	elements.editGenres.value = (novel.genres || []).join(", ");
	elements.editCustomPrompt.value = novel.customPrompt || "";

	// Update cover preview
	updateCoverPreview(novel.coverUrl);

	// Close detail modal, open edit modal
	closeModal(elements.novelModal);
	openModal(elements.editModal);
}

/**
 * Handle cover URL input for preview
 */
function handleCoverPreview() {
	const url = elements.editCover.value.trim();
	updateCoverPreview(url);
}

/**
 * Update cover image preview
 */
function updateCoverPreview(url) {
	if (!url) {
		elements.editCoverPreview.innerHTML = "";
		return;
	}

	const img = document.createElement("img");
	img.alt = "Cover preview";
	img.addEventListener("error", () => {
		elements.editCoverPreview.innerHTML =
			"<span class='preview-error'>Invalid image URL</span>";
	});
	img.src = url;
	elements.editCoverPreview.innerHTML = "";
	elements.editCoverPreview.appendChild(img);
}

/**
 * Handle save edit form submission
 * Marks fields as manually edited so auto-updates won't overwrite them
 */
async function handleSaveEdit(e) {
	e.preventDefault();

	if (!currentEditingNovel) {
		showToast("No novel selected for editing", "error");
		return;
	}

	// Gather form data
	const updatedData = {
		...currentEditingNovel,
		title: elements.editTitle.value.trim() || currentEditingNovel.title,
		author: elements.editAuthor.value.trim() || "Unknown",
		coverUrl: elements.editCover.value.trim(),
		description: elements.editDescription.value.trim(),
		status: elements.editStatus.value,
		totalChapters: parseInt(elements.editTotalChapters.value) || 0,
		genres: elements.editGenres.value
			.split(",")
			.map((g) => g.trim())
			.filter((g) => g.length > 0),
		customPrompt: elements.editCustomPrompt.value.trim(),
	};

	try {
		// Update novel in library with isManualEdit=true
		// This marks changed fields so auto-updates won't overwrite them
		await novelLibrary.addOrUpdateNovel(updatedData, true);

		// Close modal and refresh
		closeModal(elements.editModal);
		await loadLibrary();

		showToast("Novel updated successfully!", "success");
	} catch (error) {
		debugError("Failed to update novel:", error);
		showToast("Failed to update novel", "error");
	}
}

/**
 * Show toast notification
 */
function showToast(message, type = "info") {
	const toast = document.createElement("div");
	toast.className = `toast ${type}`;
	toast.textContent = message;
	document.body.appendChild(toast);

	// Remove after animation
	setTimeout(() => {
		toast.remove();
	}, 3000);
}

/**
 * Handle view change
 */
function handleViewChange(view) {
	currentView = view;

	// Update button states
	elements.viewButtons.forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.view === view);
	});

	// Update view visibility
	document.querySelectorAll(".view-content").forEach((el) => {
		el.classList.toggle(
			"active",
			el.id === `${view}-view` || el.id === `${view}s-view`
		);
	});

	renderCurrentView();
}

/**
 * Handle reading status filter change
 */
function handleStatusFilterChange(status) {
	currentStatusFilter = status;

	// Update button states
	elements.statusFilterBtns.forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.status === status);
	});

	renderCurrentView();
}

/**
 * Handle search input
 */
function handleSearch(e) {
	searchQuery = e.target.value;
	renderCurrentView();
}

/**
 * Handle sort change
 */
function handleSort(e) {
	currentSort = e.target.value;
	renderCurrentView();
}

/**
 * Handle export library
 */
async function handleExport() {
	try {
		const data = await novelLibrary.exportLibrary();
		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = `ranobe-gemini-library-${
			new Date().toISOString().split("T")[0]
		}.json`;
		a.click();

		URL.revokeObjectURL(url);
		alert("Library exported successfully!");
	} catch (error) {
		debugError("Export failed:", error);
		alert("Failed to export library. See console for details.");
	}
}

/**
 * Handle import library
 */
async function handleImport(e) {
	const file = e.target.files?.[0];
	if (!file) return;

	try {
		const text = await file.text();
		const data = JSON.parse(text);

		// Validate import data structure
		if (!data.library || !data.version) {
			throw new Error("Invalid library backup file format");
		}

		const novelCount = Object.keys(data.library.novels || {}).length;
		// Handle toggle inputs
		const inputs = document.querySelectorAll(
			".website-settings-panel input[data-setting]",
		);
		inputs.forEach((input) => {
			input.addEventListener("change", async () => {
				const shelfId = input.dataset.shelf;
				const key = input.dataset.setting;
				if (!shelfId || !key) return;

				const defaults = getDefaultSiteSettings();
				const base = siteSettings[shelfId] || defaults[shelfId] || {};
				const updated = {
					...base,
					[key]: input.checked,
				};

				try {
					siteSettings = await saveSiteSettings({
						[shelfId]: updated,
					});
					showToast(
						`Saved ${key} for ${base.name || shelfId}`,
						"success",
					);
				} catch (error) {
					debugError("Failed to save website settings:", error);
					showToast("Failed to save website settings", "error");
				}
			});
		});

		// Handle select fields
		const selects = document.querySelectorAll(
			".website-settings-panel select[data-setting]",
		);
		selects.forEach((select) => {
			select.addEventListener("change", async () => {
				const shelfId = select.dataset.shelf;
				const key = select.dataset.setting;
				if (!shelfId || !key) return;

				const defaults = getDefaultSiteSettings();
				const base = siteSettings[shelfId] || defaults[shelfId] || {};
				const updated = {
					...base,
					[key]: select.value,
				};

				try {
					siteSettings = await saveSiteSettings({
						[shelfId]: updated,
					});
					showToast(
						`Saved ${key} for ${base.name || shelfId}`,
						"success",
					);
				} catch (error) {
					debugError("Failed to save website settings:", error);
					showToast("Failed to save website settings", "error");
				}
			});
		});
		const result = await novelLibrary.importLibrary(data, false);
		if (result.success) {
			await loadLibrary();
			closeModal(elements.settingsModal);
			alert(
				`Library replaced successfully!\n\n• ${result.imported} novels imported`,
			);
		} else {
			throw new Error(result.error || "Import failed");
		}
	} catch (error) {
		debugError("Import failed:", error);
		alert(
			`Failed to import library: ${error.message}\n\nMake sure the file is a valid Ranobe Gemini backup.`,
		);
	}

	// Reset file input
	e.target.value = "";
}

/**
 * Handle clear library
 */
async function handleClearLibrary() {
	if (
		confirm(
			"Are you sure you want to clear your entire library? This cannot be undone!"
		)
	) {
		if (confirm('Type "yes" to confirm you want to delete all novels.')) {
			await novelLibrary.clearLibrary();
			closeModal(elements.settingsModal);
			await loadLibrary();
		}
	}
}

/**
 * Handle comprehensive backup creation
 */
async function handleComprehensiveBackup() {
	try {
		showNotification("Creating comprehensive backup...", "info");
		const backup = await createComprehensiveBackup();
		await downloadBackupAsFile(backup, "comprehensive");
		showNotification("Comprehensive backup created successfully!", "success");

		// Track feature usage
		trackFeatureUsage("comprehensive_backup");
	} catch (error) {
		debugError("Comprehensive backup failed:", error);
		showNotification(`Backup failed: ${error.message}`, "error");
	}
}

/**
 * Handle comprehensive backup restoration
 */
async function handleComprehensiveRestore(e) {
	const file = e.target.files?.[0];
	if (!file) return;

	try {
		const backup = await readBackupFromFile(file);

		// Show confirmation with backup details
		const novelCount = backup.data?.novelHistory ? Object.keys(backup.data.novelHistory).length : 0;
		const hasApiKeys = !!(backup.data?.apiKey || backup.data?.backupApiKeys?.length);
		const hasPrompts = !!(backup.data?.promptTemplate || backup.data?.summaryPrompt || backup.data?.shortSummaryPrompt);
		const hasDriveSettings = !!(backup.data?.driveClientId);

		const details = [
			`📚 ${novelCount} novels`,
			hasApiKeys ? "🔑 API Keys" : null,
			hasPrompts ? "📝 Prompts" : null,
			hasDriveSettings ? "☁️ Drive Settings" : null,
		].filter(Boolean).join(", ");

		const choice = confirm(
			`Comprehensive Backup Found\n\n` +
			`Created: ${new Date(backup.timestamp).toLocaleString()}\n` +
			`Contains: ${details}\n\n` +
			`Do you want to restore this backup?\n\n` +
			`⚠️ This will overwrite your current settings.`
		);

		if (choice) {
			showNotification("Restoring backup...", "info");
			const result = await restoreComprehensiveBackup(backup, { merge: true });

			if (result.success) {
				await loadLibrary();
				await loadLibrarySettings();
				await loadTelemetrySettings();
				closeModal(elements.settingsModal);
				showNotification(
					`Backup restored! ${result.restored} items recovered.`,
					"success"
				);

				// Track feature usage
				trackFeatureUsage("comprehensive_restore");
			} else {
				throw new Error(result.error || "Restore failed");
			}
		}
	} catch (error) {
		debugError("Comprehensive restore failed:", error);
		showNotification(`Restore failed: ${error.message}`, "error");
	}

	// Reset file input
	e.target.value = "";
}

/**
 * Handle viewing backups from Google Drive
 */
async function handleViewDriveBackups() {
	try {
		if (!elements.libraryViewBackupsBtn) {
			debugError("View Backups button not found in DOM");
			return;
		}

		// Check if connected to Drive
		const tokens = await browser.storage.local.get("driveAuthTokens");
		if (!tokens?.driveAuthTokens?.access_token) {
			showNotification(
				"❌ Not connected to Google Drive. Set up OAuth in Library settings first.",
				"error",
			);
			return;
		}

		// Open modal and show loading state
		openModal(elements.driveBackupsModal);
		elements.driveBackupsLoading.classList.remove("hidden");
		elements.driveBackupsList.classList.add("hidden");
		elements.driveBackupsEmpty.classList.add("hidden");

		debugLog("Fetching backups from Drive...");
		const response = await browser.runtime.sendMessage({
			action: "listDriveBackups",
		});

		debugLog("Backups response:", response);

		if (!response?.success) {
			throw new Error(response?.error || "Failed to fetch backups");
		}

		// Extract backups array from response object
		const backups = response?.backups || [];

		if (backups.length === 0) {
			elements.driveBackupsLoading.classList.add("hidden");
			elements.driveBackupsEmpty.classList.remove("hidden");
			return;
		}

		// Download and parse each backup to get metadata
		const backupsWithMeta = [];
		for (const backup of backups) {
			try {
				const downloadResponse = await browser.runtime.sendMessage({
					action: "downloadDriveBackup",
					fileId: backup.id,
				});

				if (downloadResponse?.success && downloadResponse?.data) {
					const backupData = downloadResponse.data;
					// Check both new and old library keys for compatibility
					const libraryData = backupData.data?.rg_novel_library?.novels || backupData.data?.novelHistory;
					const novelCount = libraryData
						? Object.keys(libraryData).length
						: 0;
					const hasApiKeys = !!(backupData.data?.apiKey || backupData.data?.backupApiKeys?.length);
					const hasDriveSettings = !!(backupData.data?.driveClientId);
					const hasTheme = !!(backupData.data?.themeSettings);

					backupsWithMeta.push({
						...backup,
						novelCount,
						hasApiKeys,
						hasDriveSettings,
						hasTheme,
						backupData,
					});
				} else {
					// Add backup without metadata if download failed
					backupsWithMeta.push({
						...backup,
						novelCount: 0,
						hasApiKeys: false,
						hasDriveSettings: false,
						hasTheme: false,
					});
				}
			} catch (err) {
				debugError(`Failed to download backup ${backup.name}:`, err);
				// Add backup without metadata
				backupsWithMeta.push({
					...backup,
					novelCount: 0,
					hasApiKeys: false,
					hasDriveSettings: false,
					hasTheme: false,
				});
			}
		}

		// Display backups in modal
		displayDriveBackups(backupsWithMeta);

		// Track feature usage
		if (typeof trackFeatureUsage === "function") {
			trackFeatureUsage("view_drive_backups");
		}
	} catch (err) {
		debugError("View backups failed", err);
		showNotification(`❌ Failed to view backups: ${err.message}`, "error");
		closeModal(elements.driveBackupsModal);
	}
}

/**
 * Display drive backups in modal
 */
function displayDriveBackups(backups) {
	elements.driveBackupsLoading.classList.add("hidden");
	elements.driveBackupsList.classList.remove("hidden");
	elements.driveBackupsList.innerHTML = "";

	// Get user's timezone
	const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	for (const backup of backups) {
		const card = document.createElement("div");
		card.style.cssText = `
			background: var(--bg-secondary, #1e293b);
			padding: 16px;
			border-radius: 8px;
			border-left: 3px solid #4285f4;
			cursor: pointer;
			transition: transform 0.2s, box-shadow 0.2s;
		`;

		card.addEventListener("mouseenter", () => {
			card.style.transform = "translateX(4px)";
			card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
		});

		card.addEventListener("mouseleave", () => {
			card.style.transform = "";
			card.style.boxShadow = "";
		});

		// Enhanced date formatting with timezone
		const backupDate = new Date(backup.modifiedTime || backup.createdTime);
		const dateOptions = {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			timeZoneName: "short",
			timeZone: userTimezone,
		};
		const formattedDate = backupDate.toLocaleString("en-US", dateOptions);
		const relativeTime = getRelativeTimeString(backupDate);

		const size = backup.size ? `${(backup.size / 1024).toFixed(1)} KB` : "Unknown";

		// Extract more metadata from backup
		const features = [];
		if (backup.novelCount > 0) features.push(`📚 ${backup.novelCount} novels`);
		if (backup.hasApiKeys) features.push("🔑 API Keys");
		if (backup.hasDriveSettings) features.push("☁️ OAuth");
		if (backup.hasTheme) features.push("🎨 Theme");

		// Determine backup type from filename
		const isContinuous = backup.name.includes("continuous");
		const backupType = isContinuous ? "🔄 Continuous" : "📅 Scheduled";
		const backupVersion = backup.backupData?.version || "Unknown";

		card.innerHTML = `
			<div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
				<div style="flex: 1;">
					<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
						<h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">
							${backupType}
						</h3>
						<span style="font-size: 10px; padding: 2px 6px; background: rgba(66, 133, 244, 0.2); border-radius: 3px; color: #4285f4;">
							v${backupVersion}
						</span>
					</div>
					<p style="margin: 0 0 4px 0; font-size: 11px; color: var(--text-secondary, #9ca3af);">
						🕒 ${formattedDate}
					</p>
					<p style="margin: 0; font-size: 10px; color: var(--text-secondary, #666); font-style: italic;">
						${relativeTime} • 💾 ${size}
					</p>
				</div>
				<button class="btn btn-primary" style="font-size: 11px; padding: 6px 12px;" data-backup-id="${backup.id}">
					📥 Restore
				</button>
			</div>
			${features.length > 0 ? `
				<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color, #374151);">
					${features.map(f => `<span style="font-size: 10px; padding: 3px 7px; background: var(--bg-tertiary, #0f172a); border-radius: 4px; color: var(--text-secondary, #9ca3af);">${f}</span>`).join('')}
				</div>
			` : ''}
		`;

		// Add click handler for restore button
		const restoreBtn = card.querySelector("button");
		restoreBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			await handleRestoreSpecificBackup(backup);
		});

		elements.driveBackupsList.appendChild(card);
	}
}

/**
 * Handle restoring a specific backup
 */
async function handleRestoreSpecificBackup(backup) {
	const confirm = window.confirm(
		`Restore backup "${backup.name}"?\n\n` +
		`Created: ${new Date(backup.createdTime).toLocaleString()}\n` +
		`Novels: ${backup.novelCount || 0}\n\n` +
		`⚠️ This will merge with your current library.`
	);

	if (!confirm) return;

	try {
		showNotification("🔄 Restoring backup...", "info");

		if (backup.backupData) {
			// We already have the data
			const result = await restoreComprehensiveBackup(backup.backupData, { merge: true });
			if (result.success) {
				await loadLibrary();
				await loadLibrarySettings();
				closeModal(elements.driveBackupsModal);
				showNotification(
					`✅ Restored ${result.restored} items from backup!`,
					"success"
				);
			} else {
				throw new Error(result.error || "Restore failed");
			}
		} else {
			// Download and restore
			const downloadResponse = await browser.runtime.sendMessage({
				action: "downloadDriveBackup",
				fileId: backup.id,
			});

			if (downloadResponse?.success && downloadResponse?.data) {
				const result = await restoreComprehensiveBackup(downloadResponse.data, { merge: true });
				if (result.success) {
					await loadLibrary();
					await loadLibrarySettings();
					closeModal(elements.driveBackupsModal);
					showNotification(
						`✅ Restored ${result.restored} items from backup!`,
						"success"
					);
				} else {
					throw new Error(result.error || "Restore failed");
				}
			} else {
				throw new Error("Failed to download backup");
			}
		}
	} catch (err) {
		debugError("Failed to restore backup:", err);
		showNotification(`❌ Failed to restore: ${err.message}`, "error");
	}
}

/**
 * Update Google Drive UI
 */
async function updateDriveUI() {
	if (
		!elements.driveNotConnected ||
		!elements.driveConnected ||
		!elements.driveStatusSpan
	) {
		return;
	}

	try {
		const tokens = await browser.storage.local.get([
			"driveAuthTokens",
			"driveAuthError",
			"backupMode",
			"driveAutoRestoreEnabled",
			"continuousBackupCheckIntervalMinutes",
			"driveBackupRetention",
			"driveClientId",
			"driveClientSecret",
		]);
		const hasToken = tokens.driveAuthTokens?.access_token;

		if (elements.driveClientIdInput) {
			elements.driveClientIdInput.value =
				tokens.driveClientId || DEFAULT_DRIVE_CLIENT_ID || "";
		}
		if (elements.driveClientSecretInput) {
			elements.driveClientSecretInput.value =
				tokens.driveClientSecret || "";
		}

		const mode = tokens.backupMode || "scheduled";
		const continuousContainer = document.getElementById(
			"continuousBackupCheckContainer",
		);
		if (continuousContainer) {
			continuousContainer.style.display =
				mode === "continuous" || mode === "both" ? "block" : "none";
		}
		const radios = elements.driveBackupModeRadios || [];
		radios.forEach((radio) => {
			radio.checked = radio.value === mode;
		});
		if (elements.driveAutoRestoreEnabled) {
			elements.driveAutoRestoreEnabled.checked =
				tokens.driveAutoRestoreEnabled === true;
		}

		// Load continuous backup interval
		const interval =
			tokens.continuousBackupCheckIntervalMinutes || 2;
		if (elements.continuousBackupCheckInterval) {
			elements.continuousBackupCheckInterval.value = interval;
		}
		const display = document.getElementById(
			"continuousCheckIntervalDisplay",
		);
		if (display) {
			display.textContent = interval;
		}

		// Load Drive backup retention
		const retention = tokens.driveBackupRetention || 5;
		if (elements.driveBackupRetention) {
			elements.driveBackupRetention.value = retention;
		}
		if (elements.driveBackupRetentionDisplay) {
			elements.driveBackupRetentionDisplay.textContent = retention;
		}

		if (hasToken) {
			elements.driveNotConnected.style.display = "none";
			elements.driveConnected.style.display = "block";
			elements.driveStatusSpan.textContent = "🟢 Connected";
			elements.driveStatusSpan.style.color = "#34a853";
			if (elements.driveAuthError) {
				elements.driveAuthError.style.display = "none";
				elements.driveAuthError.textContent = "";
			}
		} else {
			elements.driveNotConnected.style.display = "block";
			elements.driveConnected.style.display = "none";
			const authError = tokens.driveAuthError?.message;
			if (authError) {
				elements.driveStatusSpan.textContent = "🔴 Auth failed";
				elements.driveStatusSpan.style.color = "#f59e0b";
				if (elements.driveAuthError) {
					elements.driveAuthError.textContent = authError;
					elements.driveAuthError.style.display = "block";
				}
			} else {
				elements.driveStatusSpan.textContent = "⚫ Disconnected";
				elements.driveStatusSpan.style.color = "#999";
				if (elements.driveAuthError) {
					elements.driveAuthError.style.display = "none";
					elements.driveAuthError.textContent = "";
				}
			}
			if (elements.driveAutoRestoreEnabled) {
				elements.driveAutoRestoreEnabled.checked = false;
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
		if (!elements.connectDriveBtn) return;

		elements.connectDriveBtn.disabled = true;
		elements.connectDriveBtn.textContent = "🔗 Connecting...";

		const saved = await browser.storage.local.get([
			"driveClientId",
			"driveClientSecret",
		]);
		const clientIdInput = elements.driveClientIdInput?.value.trim();
		const clientSecretInput =
			elements.driveClientSecretInput?.value.trim();
		const clientId =
			clientIdInput ||
			saved.driveClientId ||
			DEFAULT_DRIVE_CLIENT_ID;
		const clientSecret =
			clientSecretInput || saved.driveClientSecret || "";

		await browser.storage.local.set({
			driveClientId: clientId,
			driveClientSecret: clientSecret,
		});

		const response = await browser.runtime.sendMessage({
			action: "ensureDriveAuth",
		});

		if (response?.success) {
			const tokens = await browser.storage.local.get("driveAuthTokens");
			if (!tokens.driveAuthTokens?.access_token) {
				throw new Error(
					"OAuth completed but no tokens were saved. Check your OAuth client type and redirect URI.",
				);
			}

			await browser.storage.local.set({
				driveAutoRestoreEnabled: true,
				driveAutoRestoreMergeMode: "merge",
			});

			showNotification(
				"✅ Google Drive connected successfully!",
				"success",
			);
			await updateDriveUI();

			try {
				await browser.runtime.sendMessage({
					action: "uploadLibraryBackupToDrive",
					folderId: null,
					reason: "oauth-initial",
				});
			} catch (backupErr) {
				debugError("Initial backup failed", backupErr);
			}

			try {
				await browser.runtime.sendMessage({
					action: "syncDriveNow",
					reason: "oauth-initial",
				});
			} catch (syncErr) {
				debugError("Initial sync failed", syncErr);
			}
		} else {
			throw new Error(response?.error || "Authentication failed");
		}
	} catch (err) {
		debugError("Failed to connect Drive", err);
		showNotification(
			`Failed to connect Google Drive: ${err.message}`,
			"error",
		);
	} finally {
		if (elements.connectDriveBtn) {
			elements.connectDriveBtn.disabled = false;
			elements.connectDriveBtn.textContent = "🔗 Connect Google Drive";
		}
	}
}

/**
 * Disconnect from Google Drive
 */
async function handleDisconnectDrive() {
	if (!confirm("Disconnect Google Drive? Backups won't sync automatically.")) {
		return;
	}

	try {
		await browser.storage.local.set({ driveAuthTokens: null });
		showNotification("Disconnected from Google Drive", "success");
		await updateDriveUI();
	} catch (err) {
		debugError("Failed to disconnect Drive", err);
		showNotification("Failed to disconnect Google Drive", "error");
	}
}

/**
 * Backup library to Google Drive now
 */
async function handleBackupNow() {
	if (!elements.backupNowBtn) return;

	try {
		const tokens = await browser.storage.local.get("driveAuthTokens");
		if (!tokens.driveAuthTokens?.access_token) {
			showNotification(
				"❌ Not connected to Google Drive. Connect first.",
				"error",
			);
			return;
		}

		elements.backupNowBtn.disabled = true;
		elements.backupNowBtn.textContent = "📤 Backing up...";

		const response = await browser.runtime.sendMessage({
			action: "uploadLibraryBackupToDrive",
			folderId: null,
			reason: "manual",
		});

		if (response?.success) {
			const fileName =
				response.primary?.filename || response.name || "backup";
			showNotification(`✅ Backup uploaded: ${fileName}`, "success");
		} else {
			throw new Error(response?.error || "Upload failed");
		}
	} catch (err) {
		debugError("Failed to backup to Drive", err);
		showNotification(`Failed: ${err.message}`, "error");
	} finally {
		elements.backupNowBtn.disabled = false;
		elements.backupNowBtn.textContent = "📤 Backup Now";
	}
}

/**
 * Handle Drive backup mode change
 */
async function handleDriveBackupModeChange(e) {
	try {
		const mode = e.target.value;
		await browser.storage.local.set({ backupMode: mode });

		const continuousContainer = document.getElementById(
			"continuousBackupCheckContainer",
		);
		if (continuousContainer) {
			continuousContainer.style.display =
				mode === "continuous" || mode === "both" ? "block" : "none";
		}

		showNotification(`Backup mode set to: ${mode}`, "success");
	} catch (err) {
		debugError("Failed to update backup mode", err);
		showNotification("Failed to update backup mode", "error");
	}
}

/**
 * Handle continuous backup check interval change
 */
async function handleContinuousBackupCheckIntervalChange(e) {
	try {
		const interval = parseInt(e.target.value, 10);
		await browser.storage.local.set({
			continuousBackupCheckIntervalMinutes: interval,
		});

		const display = document.getElementById(
			"continuousCheckIntervalDisplay",
		);
		if (display) {
			display.textContent = interval;
		}
	} catch (err) {
		debugError("Failed to update continuous backup interval", err);
	}
}

/**
 * Handle Drive backup retention change
 */
/**
 * Handle Factory Reset - Delete everything (library + OAuth + settings)
 */
async function handleFactoryReset() {
	try {
		// Triple confirmation to prevent accidents
		const confirmed1 = confirm(
			"⚠️ FACTORY RESET WARNING\n\n" +
				"This will permanently delete:\n" +
				"• All novels from your library\n" +
				"• All enhanced chapters and summaries\n" +
				"• Google Drive OAuth credentials\n" +
				"• All settings and preferences\n\n" +
				"💡 This does NOT delete Google Drive cloud backups.\n\n" +
				"Are you absolutely sure you want to continue?"
		);

		if (!confirmed1) {
			showNotification("Factory Reset cancelled", "info");
			return;
		}

		const confirmed2 = confirm(
			"🔥 FINAL CONFIRMATION\n\n" +
				"Type 'DELETE EVERYTHING' in your mind and click OK to proceed.\n\n" +
				"This action CANNOT be undone!"
		);

		if (!confirmed2) {
			showNotification("Factory Reset cancelled", "info");
			return;
		}

		showNotification("🔥 Factory Reset in progress...", "info");

		// 1. Clear all storage (library, OAuth, settings, everything)
		await browser.storage.local.clear();

		// 2. Disconnect from Google Drive (revoke OAuth)
		try {
			await revokeGoogleDriveAccess();
		} catch (err) {
			debugError("Failed to revoke Drive access during reset", err);
		}

		// 3. Reset UI to defaults
		novelLibrary.clear();
		renderNovelLibrary();
		updateLibraryStats();

		// 4. Reset all form elements to defaults
		if (elements.driveBackupModeScheduled) {
			elements.driveBackupModeScheduled.checked = true;
		}
		if (elements.driveBackupInterval) {
			elements.driveBackupInterval.value = 2;
		}
		if (elements.driveBackupRetention) {
			elements.driveBackupRetention.value = 5;
		}

		// 5. Show success message
		showNotification(
			"✅ Factory Reset complete - Extension restored to defaults",
			"success"
		);

		// 6. Reload page after 2 seconds to ensure clean state
		setTimeout(() => {
			window.location.reload();
		}, 2000);
	} catch (err) {
		debugError("Factory Reset failed", err);
		showNotification(
			`❌ Factory Reset failed: ${err.message}`,
			"error"
		);
	}
}

async function handleDriveBackupRetentionChange(e) {
	try {
		const count = parseInt(e.target.value, 10);
		await browser.storage.local.set({
			driveBackupRetention: count,
		});

		if (elements.driveBackupRetentionDisplay) {
			elements.driveBackupRetentionDisplay.textContent = count;
		}
	} catch (err) {
		debugError("Failed to update Drive backup retention", err);
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
		showNotification(
			enabled
				? "Auto-restore from Drive enabled"
				: "Auto-restore from Drive disabled",
			"success",
		);
	} catch (err) {
		debugError("Failed to update auto-restore", err);
	}
}

/**
 * Save OAuth settings manually
 */
async function handleSaveOAuthSettings() {
	const clientId = elements.driveClientIdInput?.value.trim() || "";
	const clientSecret =
		elements.driveClientSecretInput?.value.trim() || "";

	await browser.storage.local.set({
		driveClientId: clientId,
		driveClientSecret: clientSecret,
	});

	showNotification("OAuth credentials saved", "success");
}

/**
 * Parse OAuth JSON and fill fields
 */
async function handleParseOAuthJson() {
	try {
		const jsonText = elements.oauthJsonPaste?.value?.trim();
		if (!jsonText) {
			showNotification("Paste your OAuth JSON first", "error");
			return;
		}

		const result = parseOAuthCredentials(jsonText);
		if (!result.valid) {
			showNotification(`❌ ${result.error}`, "error");
			return;
		}

		const uriValidation = validateRedirectUris(result.redirectUris);
		if (elements.driveClientIdInput) {
			elements.driveClientIdInput.value = result.clientId;
		}
		if (elements.driveClientSecretInput) {
			elements.driveClientSecretInput.value = result.clientSecret || "";
		}
		if (elements.toggleClientSecretBtn && elements.driveClientSecretInput) {
			elements.driveClientSecretInput.type = "text";
			elements.toggleClientSecretBtn.textContent = "🙈";
			elements.toggleClientSecretBtn.title = "Hide Client Secret";
		}

		const warning = uriValidation.warnings?.length
			? ` ${uriValidation.warnings.join(", ")}`
			: "";
		showNotification(`✅ Parsed OAuth JSON.${warning}`, "success");
	} catch (err) {
		debugError("Failed to parse OAuth JSON", err);
		showNotification("Failed to parse OAuth JSON", "error");
	}
}

/**
 * Save OAuth JSON into storage
 */
async function handleSaveOAuthFromJson() {
	try {
		const clientId = elements.driveClientIdInput?.value.trim() || "";
		const clientSecret =
			elements.driveClientSecretInput?.value.trim() || "";
		await browser.storage.local.set({
			driveClientId: clientId,
			driveClientSecret: clientSecret,
		});
		showNotification("OAuth credentials saved", "success");
	} catch (err) {
		debugError("Failed to save OAuth credentials", err);
		showNotification("Failed to save OAuth credentials", "error");
	}
}

/**
 * Handle syncing library from Google Drive
 */
async function handleDriveSyncFromLibrary() {
	try {
		if (!elements.libraryDriveSyncNowBtn) {
			debugError("Sync from Drive button not found in DOM");
			return;
		}

		const originalText = elements.libraryDriveSyncNowBtn.textContent;
		elements.libraryDriveSyncNowBtn.setAttribute("data-original-text", originalText);

		// Check if connected to Drive
		const tokens = await browser.storage.local.get("driveAuthTokens");
		if (!tokens?.driveAuthTokens?.access_token) {
			showNotification(
				"❌ Not connected to Google Drive. Set up OAuth in Library settings first.",
				"error",
			);
			return;
		}

		elements.libraryDriveSyncNowBtn.disabled = true;
		elements.libraryDriveSyncNowBtn.textContent = "⏳ Syncing...";

		debugLog("Syncing library from Drive...");
		const response = await browser.runtime.sendMessage({
			action: "syncDriveNow",
		});

		if (!response) {
			throw new Error("No response from background script");
		}

		if (response?.success) {
			debugLog("Drive sync successful", response);
			showNotification(
				"✅ Library synced from Drive successfully!",
				"success",
			);

			// Reload library to show synced data
			if (typeof loadLibrary === "function") {
				await loadLibrary();
			}
			if (typeof loadLibrarySettings === "function") {
				await loadLibrarySettings();
			}

			// Track feature usage
			if (typeof trackFeatureUsage === "function") {
				trackFeatureUsage("drive_sync_from_library");
			}
		} else {
			throw new Error(response?.error || "Drive sync failed");
		}
	} catch (err) {
		debugError("Drive sync failed", err);
		showNotification(`❌ Failed to sync from Drive: ${err.message}`, "error");
	} finally {
		if (elements.libraryDriveSyncNowBtn) {
			elements.libraryDriveSyncNowBtn.disabled = false;
			const originalText = elements.libraryDriveSyncNowBtn.getAttribute("data-original-text");
			if (originalText) {
				elements.libraryDriveSyncNowBtn.textContent = originalText;
				elements.libraryDriveSyncNowBtn.removeAttribute("data-original-text");
			}
		}
	}
}

/**
 * Show/hide loading state
 */
function showLoading(show) {
	elements.loadingState.classList.toggle("hidden", !show);
}

/**
 * Show/hide empty state
 */
function showEmptyState(show) {
	elements.emptyState.classList.toggle("hidden", !show);

	// Hide all views when showing empty state
	if (show) {
		elements.shelvesView.innerHTML = "";
		elements.recentNovels.innerHTML = "";
		elements.allNovels.innerHTML = "";
	}
}

/**
 * Open a modal
 */
function openModal(modal) {
	modal.classList.remove("hidden");
	document.body.style.overflow = "hidden";
}

/**
 * Initialize and populate the carousel with recent novels
 */
function initCarousel(novels) {
	stopCarousel(); // Reset any existing auto-scroll interval before rebuilding

	if (!novels || novels.length === 0) {
		elements.carouselSection.style.display = "none";
		carouselState.uniqueCount = 0;
		carouselState.currentIndex = 0;
		return;
	}

	elements.carouselSection.style.display = "block";

	// Get top N most recent novels (configurable but capped by available count)
	const sortedNovels = [...novels].sort(
		(a, b) => b.lastAccessedAt - a.lastAccessedAt
	);
	const maxItems = Math.min(carouselState.itemsToShow, sortedNovels.length);
	const recentNovels = sortedNovels.slice(0, maxItems);
	// Rotate so the first item moves to the end (prevents initial half-hidden card)
	const displayNovels =
		recentNovels.length > 1
			? [...recentNovels.slice(1), recentNovels[0]]
			: recentNovels;
	carouselState.uniqueCount = displayNovels.length;

	// Duplicate novels for infinite scrolling
	const infiniteNovels = [
		...displayNovels,
		...displayNovels,
		...displayNovels,
	];

	// Fallback to extension logo if cover fails to load
	const fallbackLogo = browser.runtime.getURL("icons/logo-256.png");

	// Populate carousel track
	elements.carouselTrack.innerHTML = "";
	infiniteNovels.forEach((novel, index) => {
		const shelf =
			SHELVES[novel.shelfId] || SHELVES[novel.shelfId.toUpperCase()];
		const item = document.createElement("div");
		item.className = "carousel-item";
		item.dataset.novelId = novel.id;
		item.dataset.originalIndex = index % displayNovels.length;

		// Use shelf emoji as fallback for icon (now available from SHELF_REGISTRY)
		const shelfEmoji = shelf?.emoji || "📖";

		// Use shelf icon as cover fallback (website favicon), then main logo
		const shelfCoverFallback =
			shelf?.icon && shelf.icon.startsWith("http")
				? shelf.icon
				: fallbackLogo;

		// Render small shelf icon for meta section - always show image icon, emoji only as final fallback
		const shelfIconSmall = shelf?.icon
			? shelf.icon.startsWith("http")
				? `<img src="${escapeHtml(
						shelf.icon
				  )}" alt="" class="meta-icon" data-fallback-emoji="${escapeHtml(
						shelfEmoji
				  )}" style="width: 1em; height: 1em; vertical-align: middle;">`
				: shelf.icon
			: shelfEmoji;

		// Generate tags display for carousel (show first 2 tags)
		const novelTags = novel.genres || novel.tags || [];
		const tagsHtml = novelTags
			.slice(0, 2)
			.map(
				(tag) => `<span class="carousel-tag">${escapeHtml(tag)}</span>`
			)
			.join("");
		const moreTagsCount = novelTags.length > 2 ? novelTags.length - 2 : 0;
		const moreTagsHtml =
			moreTagsCount > 0
				? `<span class="carousel-tag-more">+${moreTagsCount}</span>`
				: "";

		// Determine cover source list for fallback handling
		const coverSrcList = [
			novel.coverUrl,
			shelfCoverFallback,
			fallbackLogo,
		].filter(Boolean);

		const siteBadge = shelf
			? `<span class="website-badge" style="background: ${
					shelf.color || "#666"
			  }">${shelfIconSmall} ${escapeHtml(shelf.name)}</span>`
			: "";

		const hoverDescription =
			novel.description?.trim() ||
			(novel.tags?.length
				? `Tags: ${novel.tags.slice(0, 4).join(", ")}`
				: "No summary available");
		const hoverReadingLine = novel.lastReadChapter
			? `Ch. ${novel.lastReadChapter}${
					novel.totalChapters ? `/${novel.totalChapters}` : ""
			  }`
			: "Not started";
		const hoverTiming = formatRelativeTime(novel.lastAccessedAt);

		item.innerHTML = `
			<div class="carousel-item-image-wrapper">
				${siteBadge ? `<div class="carousel-site-chip">${siteBadge}</div>` : ""}
				<img data-cover-src="${escapeHtml(novel.coverUrl || "")}" alt="${escapeHtml(
			novel.title
		)}" class="carousel-cover">
			</div>
			<div class="carousel-item-info">
				<h3 class="carousel-item-title">${escapeHtml(novel.title)}</h3>
				<p class="carousel-item-author">by ${escapeHtml(
					novel.author || "Unknown Author"
				)}</p>
				<div class="carousel-item-tags">
					${tagsHtml || '<span class="carousel-tag-none">No tags</span>'}${moreTagsHtml}
				</div>
				<div class="carousel-item-meta">
					<span>✨ ${novel.enhancedChaptersCount || 0} enhanced</span>
					<span>📅 ${formatRelativeTime(novel.lastAccessedAt)}</span>
				</div>
			</div>
			<div class="carousel-item-hover-details">
				<div class="hover-details-content">
					<h4>${escapeHtml(novel.title)}</h4>
					<p class="hover-author">by ${escapeHtml(novel.author || "Unknown")}</p>
					<p class="hover-description">${escapeHtml(hoverDescription)}</p>
					<div class="hover-stats">
						<span>📖 ${hoverReadingLine}</span>
						<span>✨ ${novel.enhancedChaptersCount || 0} enhanced</span>
						<span>⏱ ${hoverTiming}</span>
					</div>
					<div class="hover-actions">
						<button class="hover-btn hover-continue" data-novel-id="${
							novel.id
						}">Continue Reading</button>
						<button class="hover-btn hover-details" data-novel-id="${
							novel.id
						}">Full Details</button>
					</div>
				</div>
			</div>
		`;

		// Click handler to open modal
		item.addEventListener("click", (e) => {
			if (!e.target.closest(".hover-btn")) {
				openNovelDetail(novel);
			}
		});

		// Hover button handlers
		const continueBtn = item.querySelector(".hover-continue");
		const detailsBtn = item.querySelector(".hover-details");

		if (continueBtn) {
			continueBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				if (novel.lastReadUrl) {
					window.open(novel.lastReadUrl, "_blank");
				}
			});
		}

		if (detailsBtn) {
			detailsBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				openNovelDetail(novel);
			});
		}

		const coverImg = item.querySelector(".carousel-cover");
		if (coverImg && coverSrcList.length > 0) {
			const [primary, ...fallbacks] = coverSrcList;
			coverImg.src = primary;
			let fallbackIndex = 0;
			coverImg.onerror = () => {
				if (fallbackIndex < fallbacks.length) {
					coverImg.src = fallbacks[fallbackIndex++];
				} else {
					coverImg.onerror = null;
				}
			};
		}
		attachIconFallbacks(item);

		elements.carouselTrack.appendChild(item);
	});

	// Start at the middle set for infinite scrolling
	carouselState.currentIndex = carouselState.uniqueCount;

	// Use requestAnimationFrame to ensure layout is complete before positioning
	requestAnimationFrame(() => {
		updateCarouselPosition(false);
	});

	// Populate indicators (only for actual novels, not duplicates)
	elements.carouselIndicators.innerHTML = "";
	for (let i = 0; i < recentNovels.length; i++) {
		const indicator = document.createElement("div");
		indicator.className = "carousel-indicator" + (i === 0 ? " active" : "");
		indicator.addEventListener("click", () => goToCarouselPage(i));
		elements.carouselIndicators.appendChild(indicator);
	}

	// Start auto-scrolling
	startCarousel();
}

/**
 * Start carousel auto-scrolling
 */
function startCarousel() {
	if (carouselState.interval) clearInterval(carouselState.interval);

	// Do not auto-play if there's 0 or 1 novel
	if (!carouselState.uniqueCount || carouselState.uniqueCount <= 1) {
		carouselState.isPlaying = false;
		elements.carouselPlayPause.textContent = "▶️";
		elements.carouselPlayPause.title = "Play auto-scroll";
		return;
	}

	carouselState.isPlaying = true;
	elements.carouselPlayPause.textContent = "⏸️";
	elements.carouselPlayPause.title = "Pause auto-scroll";

	carouselState.interval = setInterval(() => {
		moveCarousel(1);
	}, 3000); // Auto-scroll every 3 seconds
}

/**
 * Stop carousel auto-scrolling
 */
function stopCarousel() {
	if (carouselState.interval) {
		clearInterval(carouselState.interval);
		carouselState.interval = null;
	}

	carouselState.isPlaying = false;
	elements.carouselPlayPause.textContent = "▶️";
	elements.carouselPlayPause.title = "Play auto-scroll";
}

/**
 * Toggle carousel play/pause
 */
function toggleCarouselPlayPause() {
	if (carouselState.isPlaying) {
		stopCarousel();
	} else {
		startCarousel();
	}
}

/**
 * Move carousel by direction (-1 or 1)
 */
function moveCarousel(direction) {
	const items = elements.carouselTrack.children;
	if (items.length === 0) return;

	const totalNovels = carouselState.uniqueCount || 0;

	// Don't do anything if we only have one or no items
	if (totalNovels <= 1) return;

	carouselState.currentIndex += direction;

	// Normal animation first
	updateCarouselPosition(true);

	// After animation completes, check if we need to wrap
	// We have 3 copies: [0..n-1] [n..2n-1] [2n..3n-1]
	// We want to stay in or near the middle set [n..2n-1]
	setTimeout(() => {
		let needsReset = false;

		if (carouselState.currentIndex >= totalNovels * 2) {
			// Wrapped past the end, reset to equivalent position in middle set
			carouselState.currentIndex =
				carouselState.currentIndex - totalNovels;
			needsReset = true;
		} else if (carouselState.currentIndex < totalNovels) {
			// Wrapped before the start, reset to equivalent position in middle set
			carouselState.currentIndex =
				carouselState.currentIndex + totalNovels;
			needsReset = true;
		}

		if (needsReset) {
			updateCarouselPosition(false); // Reset without animation
		}
	}, 550); // Wait for animation to complete (500ms + buffer)

	// Update indicators to show actual position
	updateCarouselIndicators();
}

/**
 * Go to specific carousel page
 */
function goToCarouselPage(index) {
	const items = elements.carouselTrack.children;
	if (items.length === 0) return;

	const totalNovels = carouselState.uniqueCount || 0;
	if (totalNovels === 0) return;
	// Jump to middle set + requested index
	carouselState.currentIndex = totalNovels + index;

	updateCarouselPosition(true);
	updateCarouselIndicators();
}

/**
 * Update carousel visual position
 */
function updateCarouselPosition(animate = true) {
	const track = elements.carouselTrack;
	if (!track.children[0]) return;

	const itemWidth = track.children[0].offsetWidth || 0;
	const computedStyle = window.getComputedStyle(track);
	const gapValue = computedStyle.columnGap || computedStyle.gap || "0px";
	const gap = parseFloat(gapValue) || 0;
	const translateX = -(carouselState.currentIndex * (itemWidth + gap));

	track.style.transition = animate ? "transform 0.5s ease-in-out" : "none";
	track.style.transform = `translateX(${translateX}px)`;
}

/**
 * Update carousel indicators based on current position
 */
function updateCarouselIndicators() {
	const indicators = elements.carouselIndicators.children;
	const totalNovels = carouselState.uniqueCount || 0;
	if (totalNovels === 0) return;
	const actualIndex = carouselState.currentIndex % totalNovels;

	for (let i = 0; i < indicators.length; i++) {
		indicators[i].classList.toggle("active", i === actualIndex);
	}
}

/**
 * Format relative time (e.g., "2 days ago")
 */
function formatRelativeTime(timestamp) {
	const now = Date.now();
	const diff = now - timestamp;
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ago`;
	if (hours > 0) return `${hours}h ago`;
	if (minutes > 0) return `${minutes}m ago`;
	return "just now";
}

/**
 * Toggle shelf collapse/expand
 * When collapsed: show only 2 rows with fade-out effect
 * When expanded: show full content based on showAll state
 */
function toggleShelfCollapse(shelfId) {
	const shelfSection = document.querySelector(
		`.shelf-section[data-shelf-id="${shelfId}"]`
	);
	if (!shelfSection) return;

	const isCollapsed = shelfSection.classList.toggle("collapsed");
	const collapseIcon = shelfSection.querySelector(".collapse-icon");
	const showMoreBtn = shelfSection.querySelector(".shelf-show-more");

	if (isCollapsed) {
		collapseIcon.textContent = "▶";
		shelfSection.querySelector(".shelf-collapse-btn").title =
			"Expand shelf";
		// Hide show more button when collapsed (arrow handles expand)
		if (showMoreBtn) {
			showMoreBtn.style.display = "none";
		}
	} else {
		collapseIcon.textContent = "▼";
		shelfSection.querySelector(".shelf-collapse-btn").title =
			"Collapse shelf";
		// Show and update show more button text based on expanded state
		if (showMoreBtn) {
			showMoreBtn.style.display = "";
			const showAll = shelfSection.dataset.expanded === "true";
			showMoreBtn.textContent = showAll ? "Show Less" : "Show More";
		}
	}
}

/**
 * Toggle shelf show more/less
 */
function toggleShelfExpand(shelfId) {
	const shelfSection = document.querySelector(
		`.shelf-section[data-shelf-id="${shelfId}"]`
	);
	if (!shelfSection) return;

	const isExpanded = shelfSection.dataset.expanded === "true";
	shelfSection.dataset.expanded = !isExpanded;

	// Re-render this shelf
	renderCurrentView();
}

/**
 * Close a modal
 */
function closeModal(modal) {
	modal.classList.add("hidden");
	document.body.style.overflow = "";
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Debounce function for search
 */
function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Listen for storage changes to auto-reload library data
 * This handles updates from content scripts or other extension pages
 */
browser.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== "local") return;

	// Check if novels data changed
	if (changes.novels) {
		debugLog("📚 Storage change detected, reloading library...");
		// Debounce the reload to avoid rapid refreshes
		if (window.libraryReloadTimeout) {
			clearTimeout(window.libraryReloadTimeout);
		}
		window.libraryReloadTimeout = setTimeout(async () => {
			await loadLibrary();
			debugLog("📚 Library reloaded due to storage change");
		}, 500);
	}
});

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);

// Check URL hash to auto-open settings modal
window.addEventListener("hashchange", handleHashChange);
window.addEventListener("load", handleHashChange);

function handleHashChange() {
	const hash = window.location.hash.substring(1); // Remove '#'
	if (hash === "settings" && elements.settingsModal) {
		openModal(elements.settingsModal);
	}
}
