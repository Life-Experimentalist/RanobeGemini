/**
 * Library Settings Page Script
 * Standalone settings page for Ranobe Gemini library configuration.
 * Replaces the settings modal from library.html and library.js.
 */

/* eslint-disable no-unused-vars */
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
	DEFAULT_DEBUG_TRUNCATE_OUTPUT,
	DEFAULT_DEBUG_TRUNCATE_LENGTH,
	DEFAULT_CHUNK_SIZE_WORDS,
	DEFAULT_CHUNK_SUMMARY_COUNT,
	CAROUSEL_ACTIVE_SITE_BONUS,
	CAROUSEL_MIN_COUNT,
	CAROUSEL_DEFAULT_MANUAL_COUNT,
	DEFAULT_MODEL_ID,
	DEFAULT_MODEL_ENDPOINT,
} from "../utils/constants.js";
import {
	isSupportedDomain,
	SHELF_REGISTRY,
} from "../utils/domain-constants.js";
import { debugLog, debugError } from "../utils/logger.js";
import {
	filterEnabledShelves,
	getSiteSettings,
	getDefaultSiteSettings,
	saveSiteSettings,
	SITE_SETTINGS_KEY,
} from "../utils/site-settings.js";
import {
	WEBSITE_SETTINGS_DEFINITIONS,
	renderWebsiteSettingsPanel,
} from "./site-settings-ui.js";
import {
	initStatusSettingsTab,
	applyStatusConfig,
} from "./status-settings-ui.js";
import {
	createComprehensiveBackup,
	restoreComprehensiveBackup,
	downloadBackupAsFile,
	readBackupFromFile,
	parseOAuthCredentials,
	createRollingBackup,
	listRollingBackups,
	getRollingBackup,
	deleteRollingBackup,
	BACKUP_OPTIONS,
} from "../utils/comprehensive-backup.js";
import { libraryBackupManager } from "../utils/library-backup-manager.js";
import { getTelemetryConfig, saveTelemetryConfig } from "../utils/telemetry.js";
import {
	formatExportFilename,
	EXPORT_TOKENS,
	PREVIEW_NOVEL,
	DEFAULT_EXPORT_TEMPLATE,
} from "../utils/novel-copy-format.js";
import {
	CUSTOM_BOX_TYPES_KEY,
	getCustomBoxTypes,
	saveCustomBoxTypes,
	createBoxType,
	generateCSSForBoxTypes,
} from "../utils/custom-box-types.js";

// \u{2500}\u{2500} Navigation tabs definition \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
const SETTINGS_TABS = [
	// Core / API
	{ id: "general", icon: "\u{1F4BE}", label: "General", panelId: "panel-general" },
	{ id: "ai-providers", icon: "\u{1F916}", label: "AI Providers", panelId: "panel-ai-providers" },
	{ id: "prompts", icon: "\u{270D}\u{FE0F}", label: "Prompts", panelId: "panel-prompts" },
	// Reading / Display
	{ id: "statuses", icon: "\u{1F4CB}", label: "Statuses", panelId: "panel-statuses" },
	{ id: "copy", icon: "\u{1F4CB}", label: "Copy Format", panelId: "panel-copy" },
	// Content processing (merged filters + boxes)
	{ id: "content-processing", icon: "\u{1F3A8}", label: "Content", panelId: "panel-content-processing" },
	// Library management
	{ id: "sites", icon: "\u{1F310}", label: "Sites", panelId: "panel-sites" },
	{ id: "automation", icon: "\u{26A1}", label: "Automation", panelId: "panel-automation" },
	{ id: "backups", icon: "\u{2601}\u{FE0F}", label: "Backups", panelId: "panel-backups" },
	// Story tools (Queue + Chat merged into LoreWeave/AI-Providers panels)
	{ id: "loreweave", icon: "\u{1F578}\u{FE0F}", label: "LoreWeave", panelId: "panel-loreweave" },
	// Advanced
	{ id: "advanced", icon: "\u{2699}\u{FE0F}", label: "Advanced", panelId: "panel-advanced" },
];

// \u{2500}\u{2500} Theme \u{2014} centralized \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
import {
	DEFAULT_THEME as defaultTheme,
	THEME_PRESETS,
	setThemeVariables,
	applyThemeFromStorage,
	setupThemeListener,
	getPresetList,
	resolveMode,
} from "../utils/theme-config.js";

// \u{2500}\u{2500} Page state \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
let librarySettings = { autoHoldEnabled: true, autoHoldDays: 7 };
let siteSettings = {};
let libraryApiKeys = [];

// \u{2500}\u{2500} Utilities \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
const $ = (id) => document.getElementById(id);

let toastTimer = null;
function showToast(message, type = "info") {
	const toast = $("ls-toast");
	if (!toast) return;
	toast.textContent = message;
	// Clear state then force reflow so the fade-in animation re-triggers
	toast.className = "";
	void toast.offsetWidth;
	toast.className = `${type} visible`;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		toast.classList.remove("visible");
	}, 3500);
}

async function applyTheme() {
	try {
		await applyThemeFromStorage();
	} catch (err) {
		debugError("Failed to apply theme:", err);
		setThemeVariables(defaultTheme);
	}
}

// \u{2500}\u{2500} Slider fill \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
/**
 * Updates the CSS --slider-fill variable so the range track shows a filled
 * portion from the left edge to the current thumb position.
 * @param {HTMLInputElement} slider
 */
function updateSliderFill(slider) {
	if (!slider) return;
	const min = parseFloat(slider.min) || 0;
	const max = parseFloat(slider.max) || 100;
	const val = parseFloat(slider.value) || 0;
	const pct = Math.min(
		100,
		Math.max(0, Math.round(((val - min) / (max - min)) * 100)),
	);
	slider.style.setProperty("--slider-fill", `${pct}%`);
}

/** Initialise fills for every .ls-range present in the document. */
function initAllSliderFills() {
	document.querySelectorAll(".ls-range").forEach(updateSliderFill);
}

// \u{2500}\u{2500} Navigation \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
function renderNav() {
	const nav = $("ls-nav");
	if (!nav) return;

	nav.innerHTML = SETTINGS_TABS.map(
		(tab) => `
		<button
			class="ls-nav-item"
			data-tab="${tab.id}"
			data-panel="${tab.panelId}"
			aria-controls="${tab.panelId}"
			type="button"
		>
			<span class="ls-nav-icon">${tab.icon}</span>
			<span class="ls-nav-label">${tab.label}</span>
		</button>
	`,
	).join("");

	nav.querySelectorAll(".ls-nav-item").forEach((btn) => {
		btn.addEventListener("click", () => activateTab(btn.dataset.tab));
	});
}

function activateTab(tabId) {
	// Update nav items
	document.querySelectorAll(".ls-nav-item").forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.tab === tabId);
	});

	// Update panels
	document.querySelectorAll(".ls-panel").forEach((panel) => {
		panel.classList.remove("active");
	});
	const tab = SETTINGS_TABS.find((t) => t.id === tabId);
	if (tab) {
		const panel = $(tab.panelId);
		if (panel) panel.classList.add("active");
	}

	// Update URL without navigation
	const url = new URL(window.location.href);
	url.searchParams.set("tab", tabId);
	history.replaceState(null, "", url);
}

function activateTabFromUrl() {
	const params = new URLSearchParams(window.location.search);
	const tab = params.get("tab");
	const found = SETTINGS_TABS.find((t) => t.id === tab);
	activateTab(found ? found.id : SETTINGS_TABS[0].id);
}

// Expose activateTab globally so inline onclick="activateTab(...)" in HTML works
window.activateTab = activateTab;

// \u{2500}\u{2500} AI Provider per-slot switcher \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
function initAiProviderTabs() {
	// Wire provider tab pill clicks
	document.querySelectorAll(".ls-provider-tab").forEach((btn) => {
		btn.addEventListener("click", () => {
			const slot = btn.dataset.slot;
			const provider = btn.dataset.provider;
			switchProviderConfig(slot, provider);
		});
	});

	// Wire the fallback enable/disable toggle
	const fallbackToggle = $("fallback-model-enabled");
	const fallbackConfig = $("fallback-model-config");
	if (fallbackToggle && fallbackConfig) {
		fallbackToggle.addEventListener("change", () => {
			fallbackConfig.classList.toggle("ls-hidden", !fallbackToggle.checked);
		});
	}
}

/** Show the correct provider config block for a given slot and hide the others. */
function switchProviderConfig(slot, provider) {
	["gemini", "openai", "ollama"].forEach((p) => {
		const el = $(`${slot}-${p}-config`);
		if (el) el.classList.toggle("ls-hidden", p !== provider);
	});
	// Sync hidden select value for save/load compatibility
	const sel = $(`${slot}-provider-select`);
	if (sel) sel.value = provider;
	// Sync tab pill active state
	syncProviderTabs(slot, provider);
	// Update the badge on the primary slot
	if (slot === "primary") {
		const badge = $("primary-provider-badge");
		if (badge) {
			const labels = { gemini: "Gemini", openai: "OpenAI", ollama: "Ollama" };
			badge.textContent = labels[provider] ?? provider;
		}
	}
}

/** Set active class on provider tab pills for a slot. */
function syncProviderTabs(slot, provider) {
	document.querySelectorAll(`.ls-provider-tab[data-slot="${slot}"]`).forEach((btn) => {
		const active = btn.dataset.provider === provider;
		btn.classList.toggle("active", active);
		btn.setAttribute("aria-pressed", active ? "true" : "false");
	});
}

// \u{2500}\u{2500} Version badge \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
import { BUILD_VERSION } from "../config/build-version.js";

function updateVersion() {
	const badge = $("ls-version-badge");
	if (!badge) return;
	// BUILD_VERSION is stamped by dev/build.js on every build \u{2014} always up-to-date
	if (BUILD_VERSION) {
		badge.textContent = `v${BUILD_VERSION}`;
		return;
	}
	// Fallback: runtime manifest (reflects installed extension version)
	try {
		const v = browser.runtime.getManifest()?.version;
		if (v) badge.textContent = `v${v}`;
	} catch (_e) {
		/* ignore */
	}
}

/**
 * Show or hide the auto-behavior panel and populate its radios/inputs.
 * @param {string} mode - current mode value ("dark"|"light"|"auto")
 * @param {Object} [theme] - current stored themeSettings (to restore saved values)
 */
function syncAutoPanel(mode, theme = {}) {
	const panel = $("ls-auto-behavior-panel");
	if (!panel) return;
	if (mode !== "auto") {
		panel.style.display = "none";
		return;
	}
	panel.style.display = "";
	// Restore saved behavior
	const behavior = theme.autoBehavior || "system";
	const radio = panel.querySelector(
		`input[name="ls-auto-behavior"][value="${behavior}"]`,
	);
	if (radio) radio.checked = true;
	// Restore time inputs
	const startEl = $("ls-auto-time-start");
	const endEl = $("ls-auto-time-end");
	if (startEl) startEl.value = theme.timeCustomStart || "06:00";
	if (endEl) endEl.value = theme.timeCustomEnd || "18:00";
	// Show/hide schedule grid
	const grid = $("ls-schedule-inputs");
	if (grid) grid.style.display = behavior === "schedule" ? "" : "none";
}

// \u{2500}\u{2500} Theme UI helpers (module-level \u{2014} used by both loadLibraryThemeControls
//    and setupEventListeners) \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

/**
 * Set the active class on the mode pill buttons.
 * @param {string} mode - "dark" | "light" | "auto"
 */
function syncModePills(mode) {
	document.querySelectorAll(".ls-mode-pill").forEach((btn) => {
		const active = btn.dataset.mode === mode;
		btn.classList.toggle("active", active);
		btn.setAttribute("aria-pressed", active ? "true" : "false");
	});
}

/**
 * Show or hide the delete-preset button based on whether the current
 * selection is a custom preset.
 * @param {string} selectedId
 * @param {Object} customPresets
 */
function updateDeletePresetBtn(selectedId, customPresets) {
	const btn = $("library-delete-custom-preset");
	if (!btn) return;
	const isCustom = !!(customPresets || {})[selectedId];
	btn.style.display = isCustom ? "" : "none";
}

// \u{2500}\u{2500} Load: Theme Controls \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function loadLibraryThemeControls() {
	try {
		const result = await browser.storage.local.get("themeSettings");
		const theme = result.themeSettings || defaultTheme;

		// \u{2500}\u{2500} Mode: sync hidden select + pill buttons \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
		const themeMode = $("library-theme-mode");
		const currentMode = theme.mode || "dark";
		if (themeMode) themeMode.value = currentMode;
		syncModePills(currentMode);

		// \u{2500}\u{2500} Preset skin dropdown \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
		const presetSelect = $("library-theme-preset");
		if (presetSelect) {
			const presets = getPresetList(theme.customPresets || {});
			const grouped = {};
			presets.forEach((p) => {
				if (!grouped[p.group]) grouped[p.group] = [];
				grouped[p.group].push(p);
			});
			presetSelect.innerHTML = Object.entries(grouped)
				.map(([group, items]) => {
					const label =
						group === "custom"
							? "Custom Presets"
							: group === "default"
								? "Built-in Presets"
								: group === "creative"
									? "Creative Themes"
									: group === "skin"
										? "Themed Skins"
										: group;
					return `<optgroup label="${label}">${items.map((p) => `<option value="${p.id}">${p.emoji} ${p.name}</option>`).join("")}</optgroup>`;
				})
				.join("");
			// theme.preset stores the selected value (can be a custom ID)
			presetSelect.value = theme.preset || "material-dark";
			updateDeletePresetBtn(theme.preset, theme.customPresets || {});
		}

		const apPicker = $("library-accentColorPicker");
		const apText = $("library-accentColorText");
		if (apPicker && apText) {
			apPicker.value = theme.accentPrimary || defaultTheme.accentPrimary;
			apText.value = theme.accentPrimary || defaultTheme.accentPrimary;
		}

		const asPicker = $("library-accentSecondaryPicker");
		const asText = $("library-accentSecondaryText");
		if (asPicker && asText) {
			asPicker.value =
				theme.accentSecondary || defaultTheme.accentSecondary;
			asText.value =
				theme.accentSecondary || defaultTheme.accentSecondary;
		}

		const bgPicker = $("library-backgroundColorPicker");
		const bgText = $("library-backgroundColorText");
		if (bgPicker && bgText) {
			bgPicker.value = theme.bgColor || defaultTheme.bgColor;
			bgText.value = theme.bgColor || defaultTheme.bgColor;
		}

		const bgsPicker = $("library-bgSecondaryPicker");
		const bgsText = $("library-bgSecondaryText");
		if (bgsPicker && bgsText) {
			const val =
				theme.bgSecondary || theme.bgColor || defaultTheme.bgColor;
			bgsPicker.value = val;
			bgsText.value = val;
		}

		const bgtPicker = $("library-bgTertiaryPicker");
		const bgtText = $("library-bgTertiaryText");
		if (bgtPicker && bgtText) {
			const val =
				theme.bgTertiary || theme.bgColor || defaultTheme.bgColor;
			bgtPicker.value = val;
			bgtText.value = val;
		}

		const txPicker = $("library-textColorPicker");
		const txText = $("library-textColorText");
		if (txPicker && txText) {
			txPicker.value = theme.textColor || defaultTheme.textColor;
			txText.value = theme.textColor || defaultTheme.textColor;
		}

		// Font size
		const fsSl = $("library-font-size-slider");
		const fsVl = $("library-font-size-value");
		if (fsSl) {
			const result2 = await browser.storage.local.get("fontSize");
			const size = result2.fontSize ?? 100;
			fsSl.value = size;
			if (fsVl) fsVl.textContent = `${size}%`;
			updateSliderFill(fsSl);
		}

		setThemeVariables(theme);

		// \u{2500}\u{2500} Auto-behavior panel \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
		syncAutoPanel(theme.mode || "dark", theme);
	} catch (err) {
		debugError("Failed to load theme controls:", err);
	}
}

// \u{2500}\u{2500} Load: Model Settings \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
function formatLibraryModelName(modelId) {
	return modelId
		.replace("gemini-", "Gemini ")
		.replace(/-/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function setLibraryModelEndpoint(value) {
	const ep1 = $("library-model-endpoint");
	const ep2 = $("library-advanced-model-endpoint");
	if (ep1) ep1.value = value || "";
	if (ep2) ep2.value = value || "";
}

async function fetchLibraryModels(apiKey) {
	if (!apiKey) return null;
	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
		);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const data = await response.json();
		const baseEndpoint = DEFAULT_MODEL_ENDPOINT.replace(/\/[^/]+:generateContent$/, "");
		return (data.models || [])
			.filter(
				(m) =>
					m.name.includes("gemini") &&
					m.supportedGenerationMethods?.includes("generateContent"),
			)
			.map((m) => {
				const id = m.name.split("/").pop();
				return {
					id,
					displayName: formatLibraryModelName(id),
					endpoint: `${baseEndpoint}/${id}:generateContent`,
				};
			});
	} catch (err) {
		debugError("Failed to fetch models:", err);
		return null;
	}
}

async function fetchOpenAIModels(baseUrl, apiKey) {
	if (!baseUrl || !apiKey) return [];
	try {
		const modelsUrl = baseUrl.replace(/\/chat\/completions\/?$/, "").replace(/\/$/, "") + "/models";
		const res = await fetch(modelsUrl, {
			headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!res.ok) return [];
		const data = await res.json();
		return (data.data || [])
			.map((m) => ({ id: m.id, displayName: m.id }))
			.sort((a, b) => a.id.localeCompare(b.id));
	} catch {
		return [];
	}
}

async function fetchOllamaModels(baseUrl) {
	if (!baseUrl) return [];
	try {
		const url = baseUrl.replace(/\/$/, "") + "/api/tags";
		const res = await fetch(url);
		if (!res.ok) return [];
		const data = await res.json();
		return (data.models || []).map((m) => ({ id: m.name, displayName: m.name }));
	} catch {
		return [];
	}
}

function populateModelSelect(selectEl, models, savedValue) {
	const prev = savedValue || selectEl.value;
	selectEl.replaceChildren(); // safe clear — no innerHTML
	if (!models.length) {
		const opt = document.createElement("option");
		opt.value = "";
		opt.textContent = "— no models found —";
		selectEl.appendChild(opt);
		return;
	}
	models.forEach((m) => {
		const opt = document.createElement("option");
		opt.value = m.id;
		opt.textContent = m.displayName || m.id;
		if (m.id === prev) opt.selected = true;
		selectEl.appendChild(opt);
	});
	if (!selectEl.value && prev) selectEl.value = prev;
}

async function updateLibraryModelSelector(apiKey, slot = "primary") {
	const selId =
		slot === "primary" ? "library-model-select" : "fallback-gemini-model";
	const sel = $(selId);
	if (!sel) return;

	try {
		sel.innerHTML = '<option value="">Loading models\u{2026}</option>';
		sel.disabled = true;

		const models = await fetchLibraryModels(apiKey);
		if (!models || models.length === 0) {
			sel.innerHTML = '<option value="">No models available</option>';
			return;
		}

		models.sort((a, b) => {
			if (a.id.includes("2.0") && !b.id.includes("2.0")) return -1;
			if (!a.id.includes("2.0") && b.id.includes("2.0")) return 1;
			if (a.id.includes("1.5") && !b.id.includes("1.5")) return -1;
			if (!a.id.includes("1.5") && b.id.includes("1.5")) return 1;
			return a.displayName.localeCompare(b.displayName);
		});

		const key =
			slot === "primary" ? "primaryModelConfig" : "fallbackModelConfig";
		const stored = await browser.storage.local.get([
			key,
			"selectedModelId", // legacy
		]);
		let savedModelId = stored[key]?.modelId || "";
		if (!savedModelId && slot === "primary")
			savedModelId = stored.selectedModelId || "";

		sel.innerHTML = "";
		models.forEach((model) => {
			const opt = document.createElement("option");
			opt.value = model.id;
			opt.textContent = model.displayName;
			if (!savedModelId && model.id === DEFAULT_MODEL_ID)
				savedModelId = model.id;
			sel.appendChild(opt);
		});

		if (savedModelId) sel.value = savedModelId;

		if (slot === "primary") {
			const selectedModel = models.find((m) => m.id === sel.value);
			setLibraryModelEndpoint(
				selectedModel?.endpoint ||
					(sel.value
						? `https://generativelanguage.googleapis.com/v1beta/models/${sel.value}:generateContent`
						: ""),
			);
		}
	} catch (err) {
		debugError(`Error updating ${slot} model selector:`, err);
		sel.innerHTML = `
			<option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
			<option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
			<option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
		`;
	} finally {
		sel.disabled = false;
	}
}

async function loadLibraryModelSettings() {
	try {
		const data = await browser.storage.local.get([
			"apiKey",
			"backupApiKeys",
			"primaryModelConfig",
			"fallbackModelConfig",
			"fallbackModelEnabled",
			"selectedModelId", // legacy
			"modelEndpoint", // legacy
		]);

		const allKeys = [data.apiKey, ...(data.backupApiKeys || [])].filter(
			Boolean,
		);

		// \u{2500}\u{2500} Primary Slot \u{2500}\u{2500}
		const primaryConfig = data.primaryModelConfig || {
			provider: "gemini",
			modelId: data.selectedModelId || "gemini-2.5-flash",
		};
		const primaryProviderSel = $("primary-provider-select");
		if (primaryProviderSel) {
			primaryProviderSel.value = primaryConfig.provider || "gemini";
			switchProviderConfig("primary", primaryProviderSel.value);
		}

		if (primaryConfig.provider === "gemini") {
			if (allKeys.length > 0) {
				await updateLibraryModelSelector(allKeys[0], "primary");
			} else {
				const sel = $("library-model-select");
				if (sel) {
					sel.innerHTML = `
						<option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
						<option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
						<option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
					`;
					sel.value = primaryConfig.modelId;
				}
			}
		} else if (primaryConfig.provider === "openai") {
			if ($("primary-openai-base-url"))
				$("primary-openai-base-url").value = primaryConfig.baseUrl || "";
			// Populate custom text input always; try to match select option too
			const poModel = $("primary-openai-model");
			const poCustom = $("primary-openai-model-custom");
			if (poCustom) poCustom.value = primaryConfig.modelId || "";
			if (poModel) {
				poModel.value = primaryConfig.modelId || "";
				if (!poModel.value && primaryConfig.modelId) {
					// Model not in select yet — add a temporary option
					const opt = document.createElement("option");
					opt.value = primaryConfig.modelId;
					opt.textContent = primaryConfig.modelId;
					poModel.appendChild(opt);
					poModel.value = primaryConfig.modelId;
				}
			}
			if ($("primary-openai-key"))
				$("primary-openai-key").value = primaryConfig.apiKey || "";
		} else if (primaryConfig.provider === "ollama") {
			if ($("primary-ollama-url"))
				$("primary-ollama-url").value = primaryConfig.baseUrl || "";
			const poOllamaModel = $("primary-ollama-model");
			if (poOllamaModel) {
				poOllamaModel.value = primaryConfig.modelId || "";
				if (!poOllamaModel.value && primaryConfig.modelId) {
					const opt = document.createElement("option");
					opt.value = primaryConfig.modelId;
					opt.textContent = primaryConfig.modelId;
					poOllamaModel.appendChild(opt);
					poOllamaModel.value = primaryConfig.modelId;
				}
			}
		}

		// \u{2500}\u{2500} Fallback Slot \u{2500}\u{2500}
		const fallbackEnabled = !!data.fallbackModelEnabled;
		const fallbackTog = $("fallback-model-enabled");
		if (fallbackTog) {
			fallbackTog.checked = fallbackEnabled;
			const configBlock = $("fallback-model-config");
			if (configBlock)
				configBlock.classList.toggle("ls-hidden", !fallbackEnabled);
		}

		const fallbackConfig = data.fallbackModelConfig || {
			provider: "gemini",
			modelId: "gemini-2.0-flash",
		};
		const fallbackProviderSel = $("fallback-provider-select");
		if (fallbackProviderSel) {
			fallbackProviderSel.value = fallbackConfig.provider || "gemini";
			switchProviderConfig("fallback", fallbackProviderSel.value);
		}

		if (fallbackConfig.provider === "gemini") {
			if (allKeys.length > 0) {
				await updateLibraryModelSelector(allKeys[0], "fallback");
			} else {
				const sel = $("fallback-gemini-model");
				if (sel) {
					sel.innerHTML = `
						<option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
						<option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
						<option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
					`;
					sel.value = fallbackConfig.modelId;
				}
			}
		} else if (fallbackConfig.provider === "openai") {
			if ($("fallback-openai-base-url"))
				$("fallback-openai-base-url").value = fallbackConfig.baseUrl || "";
			if ($("fallback-openai-model"))
				$("fallback-openai-model").value = fallbackConfig.modelId || "";
			if ($("fallback-openai-key"))
				$("fallback-openai-key").value = fallbackConfig.apiKey || "";
		} else if (fallbackConfig.provider === "ollama") {
			if ($("fallback-ollama-url"))
				$("fallback-ollama-url").value = fallbackConfig.baseUrl || "";
			if ($("fallback-ollama-model"))
				$("fallback-ollama-model").value = fallbackConfig.modelId || "";
		}

		// Update legacy endpoint if needed
		const selectedModelId =
			$("library-model-select")?.value || data.selectedModelId || "";
		const endpoint =
			data.modelEndpoint ||
			(selectedModelId
				? `https://generativelanguage.googleapis.com/v1beta/models/${selectedModelId}:generateContent`
				: "");
		setLibraryModelEndpoint(endpoint);

		// Temperature
		const tempSl = $("library-temperature-slider");
		const tempVl = $("library-temperature-value");
		if (tempSl) {
			const r = await browser.storage.local.get("customTemperature");
			const temp = r.customTemperature ?? 0.7;
			tempSl.value = temp;
			if (tempVl) tempVl.textContent = parseFloat(temp).toFixed(1);
			updateSliderFill(tempSl);
		}
	} catch (err) {
		debugError("Failed to load model settings:", err);
	}
}

// \u{2500}\u{2500} Load: API Keys (Unified) \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
function renderLibraryApiKeys() {
	const list = $("library-api-keys-list");
	if (!list) return;

	list.innerHTML = "";

	if (!libraryApiKeys || libraryApiKeys.length === 0) {
		list.innerHTML =
			'<div style="padding:8px;text-align:center;font-size:12px;color:var(--text-secondary);">No API keys added yet</div>';
		return;
	}

	libraryApiKeys.forEach((key, index) => {
		const item = document.createElement("div");
		item.style.cssText =
			"display:flex;justify-content:space-between;align-items:center;padding:8px;" +
			"background:var(--bg-secondary,#0f172a);border-radius:4px;margin-bottom:6px;" +
			"border:1px solid var(--border-color);font-size:12px;";

		const preview =
			key.substring(0, 8) +
			"..." +
			key.substring(Math.max(key.length - 4, 0));
		item.innerHTML = `
			<span style="font-weight:500;color:#3b82f6;">Key ${index + 1}</span>
			<span style="color:var(--text-secondary);font-family:monospace;font-size:11px;">${preview}</span>
			<button class="library-remove-key-btn ls-btn ls-btn-danger ls-btn-sm"
				data-index="${index}" style="padding:2px 8px;font-size:13px;">\u{2715}</button>
		`;
		list.appendChild(item);
	});

	list.querySelectorAll(".library-remove-key-btn").forEach((btn) => {
		btn.addEventListener("click", async (e) => {
			const idx = parseInt(e.currentTarget.dataset.index, 10);
			if (Number.isNaN(idx)) return;
			libraryApiKeys.splice(idx, 1);
			await browser.storage.local.set({
				apiKey: libraryApiKeys[0] || "",
				backupApiKeys: libraryApiKeys.slice(1),
			});
			renderLibraryApiKeys();
			showToast("\u{2705} API key removed", "success");
		});
	});
}

// \u{2500}\u{2500} Load: Advanced Settings \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function loadLibraryAdvancedSettings() {
	try {
		const data = await browser.storage.local.get([
			"topK",
			"topP",
			"wordCountThreshold",
			"modelEndpoint",
			"customPrompt",
			"customSummaryPrompt",
			"customShortSummaryPrompt",
			"permanentPrompt",
			"chunkSizeWords",
			"chunkingEnabled",
			"chunkSummaryCount",
			"maxOutputTokens",
			"debugMode",
			"debugTruncateOutput",
			"debugTruncateLength",
			"apiKey",
			"backupApiKeys",
			"apiKeyRotation",
		]);

		// Top K
		const topKSl = $("library-top-k-slider");
		const topKVl = $("library-top-k-value");
		if (topKSl && topKVl) {
			const v = data.topK !== undefined ? data.topK : 40;
			topKSl.value = v;
			topKVl.textContent = v;
			updateSliderFill(topKSl);
		}

		// Top P
		const topPSl = $("library-top-p-slider");
		const topPVl = $("library-top-p-value");
		if (topPSl && topPVl) {
			const v = data.topP !== undefined ? data.topP : 0.95;
			topPSl.value = v;
			topPVl.textContent = parseFloat(v).toFixed(2);
			updateSliderFill(topPSl);
		}

		// Word Count Threshold
		const wcSl = $("library-word-count-threshold-slider");
		const wcVl = $("library-word-count-threshold-value");
		if (wcSl && wcVl) {
			const v =
				data.wordCountThreshold !== undefined
					? data.wordCountThreshold
					: 25;
			wcSl.value = v;
			wcVl.textContent = v;
			updateSliderFill(wcSl);
		}

		// Prompts
		const promptMain = $("library-prompt-main");
		if (promptMain) promptMain.value = data.customPrompt || DEFAULT_PROMPT;

		const promptSummary = $("library-prompt-summary");
		if (promptSummary)
			promptSummary.value =
				data.customSummaryPrompt || DEFAULT_SUMMARY_PROMPT;

		const promptShort = $("library-prompt-short-summary");
		if (promptShort)
			promptShort.value =
				data.customShortSummaryPrompt || DEFAULT_SHORT_SUMMARY_PROMPT;

		const promptPerm = $("library-prompt-permanent");
		if (promptPerm)
			promptPerm.value = data.permanentPrompt || DEFAULT_PERMANENT_PROMPT;

		// Chunking
		const chunkEl = $("library-chunking-enabled");
		if (chunkEl) chunkEl.checked = data.chunkingEnabled !== false;

		const chunkSize = $("library-chunk-size");
		if (chunkSize)
			chunkSize.value =
				data.chunkSizeWords ||
				data.chunkSize ||
				DEFAULT_CHUNK_SIZE_WORDS;

		const chunkSumCount = $("library-chunk-summary-count");
		if (chunkSumCount)
			chunkSumCount.value =
				data.chunkSummaryCount || DEFAULT_CHUNK_SUMMARY_COUNT;

		const maxTokens = $("library-max-output-tokens");
		if (maxTokens) maxTokens.value = data.maxOutputTokens || 8192;

		// Debug mode
		const debugToggle = $("library-debug-mode");
		const debugSub = $("debug-sub-options");
		if (debugToggle) {
			debugToggle.checked = data.debugMode === true;
			if (debugSub) {
				debugSub.classList.toggle("ls-hidden", !debugToggle.checked);
				debugSub.style.display = debugToggle.checked ? "block" : "";
			}
		}

		const truncToggle = $("library-debug-truncate");
		if (truncToggle) {
			truncToggle.checked =
				data.debugTruncateOutput !== undefined
					? data.debugTruncateOutput
					: DEFAULT_DEBUG_TRUNCATE_OUTPUT;
		}

		const truncLength = $("library-debug-truncate-length");
		if (truncLength)
			truncLength.value =
				data.debugTruncateLength || DEFAULT_DEBUG_TRUNCATE_LENGTH;

		// API Keys (unified)
		libraryApiKeys = [data.apiKey, ...(data.backupApiKeys || [])].filter(
			Boolean,
		);
		renderLibraryApiKeys();

		const rotSel = $("library-api-key-rotation");
		if (rotSel) rotSel.value = data.apiKeyRotation || "round_robin";
		if (!data.apiKeyRotation) {
			await browser.storage.local.set({
				apiKeyRotation: "round_robin",
			});
		}
	} catch (err) {
		debugError("Failed to load advanced settings:", err);
	}
}

// \u{2500}\u{2500} Load: Telemetry Settings \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function loadTelemetrySettings() {
	try {
		const config = await getTelemetryConfig();

		const telTog = $("telemetry-toggle");
		if (telTog) telTog.checked = !!config.enabled;

		const sendErrTog = $("send-errors-toggle");
		if (sendErrTog) sendErrTog.checked = !!config.sendErrorReports;

		const webhookIn = $("webhook-url");
		if (webhookIn) webhookIn.value = config.customWebhookUrl || "";

		const telDetails = document.getElementById("telemetry-details");
		if (telDetails) telDetails.style.display = "block";

		const debugResult = await browser.storage.local.get("debugMode");
		const debugToggle = $("library-debug-mode");
		if (debugToggle) debugToggle.checked = debugResult.debugMode !== false;
	} catch (err) {
		debugError("Failed to load telemetry settings:", err);
	}
}

// \u{2500}\u{2500} Load: Library Settings (auto-hold, carousel) \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function loadLibrarySettings_() {
	try {
		librarySettings = await novelLibrary.getSettings();
	} catch (err) {
		debugError("Failed to load library settings:", err);
		librarySettings = { autoHoldEnabled: true, autoHoldDays: 7 };
	}

	const autoHoldTog = $("auto-hold-toggle");
	if (autoHoldTog) autoHoldTog.checked = !!librarySettings.autoHoldEnabled;

	const autoHoldDays = $("auto-hold-days");
	if (autoHoldDays) {
		autoHoldDays.value =
			librarySettings.autoHoldDays || librarySettings.autoHoldDays === 0
				? librarySettings.autoHoldDays
				: 7;
	}

	const hideGeminiUiReadAloudTog = $("hide-gemini-ui-readaloud-toggle");
	if (hideGeminiUiReadAloudTog) {
		hideGeminiUiReadAloudTog.checked =
			librarySettings.hideGeminiUiFromReadAloud !== false;
	}

	// Periodic chapter check
	try {
		const ucResult = await browser.storage.local.get([
			"novelUpdateEnabled",
			"novelUpdateIntervalDays",
		]);
		const updateTog = $("novel-update-toggle");
		if (updateTog)
			updateTog.checked =
				ucResult.novelUpdateEnabled !== undefined
					? !!ucResult.novelUpdateEnabled
					: true; // matches constant default
		const updateInt = $("novel-update-interval");
		if (updateInt)
			updateInt.value =
				ucResult.novelUpdateIntervalDays !== undefined
					? ucResult.novelUpdateIntervalDays
					: 3;
	} catch (err) {
		debugError("Failed to load novel update settings:", err);
	}

	// Carousel
	try {
		const result = await browser.storage.local.get("carouselManualCount");
		if (result.carouselManualCount != null) {
			const useManual = $("carousel-use-manual");
			const manualCont = $("carousel-manual-container-auto");
			const manualCount = $("carousel-manual-count");
			if (useManual) useManual.checked = true;
			if (manualCont) manualCont.classList.remove("ls-hidden");
			if (manualCount) manualCount.value = result.carouselManualCount;
		}
	} catch (err) {
		debugError("Failed to load carousel settings:", err);
	}
}

// \u{2500}\u{2500} Load: Site Settings \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function loadSiteSettings_() {
	try {
		siteSettings = await getSiteSettings();
	} catch (err) {
		debugError("Failed to load site settings:", err);
		siteSettings = {};
	}
}

function _makeFaviconImg(iconUrl, emoji, invertInDark) {
	if (!iconUrl) return null;
	try {
		const img = document.createElement("img");
		img.src = iconUrl;
		img.className = "ls-site-icon-img";
		img.alt = "";
		img.dataset.emoji = emoji || "\u{1F4D6}";
		if (invertInDark) img.dataset.invert = "true";
		img.addEventListener("error", () => {
			const span = document.createElement("span");
			span.className = "ls-site-icon-emoji";
			span.textContent = img.dataset.emoji;
			img.replaceWith(span);
		});
		return img;
	} catch {
		return null;
	}
}

function _makeStatusSelect(shelfId, mode, currentValue) {
	const sel = document.createElement("select");
	sel.className = "site-autoadd-status ls-select";
	sel.dataset.shelf = shelfId;
	sel.dataset.mode = mode;
	Object.entries(READING_STATUS_INFO).forEach(([key, info]) => {
		const opt = document.createElement("option");
		opt.value = key;
		opt.textContent = info.label;
		if (key === currentValue) opt.selected = true;
		sel.appendChild(opt);
	});
	return sel;
}

function renderSiteSettingsCards() {
	const container = $("ls-site-cards");
	if (!container) return;
	container.innerHTML = "";

	const shelves = Object.values(SHELF_REGISTRY);

	shelves.forEach((regEntry) => {
		const shelfId = regEntry.id;
		const shelf = SHELVES[shelfId.toUpperCase()] || SHELVES[shelfId] || regEntry;
		const shelfSett = siteSettings[shelfId] || getDefaultSiteSettings(shelfId);
		const isForceDisabled = regEntry.forceDisabled === true;
		const isEnabled = !isForceDisabled && shelfSett.enabled !== false;
		const autoAddEnabled = shelfSett.autoAddEnabled !== false;
		const permissionOrigins = regEntry.permissionOrigins || [];
		const siteDef = WEBSITE_SETTINGS_DEFINITIONS.find((d) => d.id === shelfId);
		const hasSettings = Boolean(siteDef);

		// ── Card wrapper ───────────────────────────────────────────────────
		const card = document.createElement("div");
		card.className = "ls-site-card" + (isForceDisabled ? " ls-site-card--force-disabled" : "");
		card.dataset.shelf = shelfId;

		// ── Header ─────────────────────────────────────────────────────────
		const header = document.createElement("div");
		header.className = "ls-site-card-header";

		const iconWrap = document.createElement("span");
		iconWrap.className = "ls-site-icon-wrap";
		const imgEl = _makeFaviconImg(
			shelf.icon || regEntry.icon,
			shelf.emoji || regEntry.emoji,
			shelf.invertIconInDarkMode,
		);
		if (imgEl) {
			iconWrap.appendChild(imgEl);
		} else {
			const em = document.createElement("span");
			em.className = "ls-site-icon-emoji";
			em.textContent = shelf.emoji || regEntry.emoji || "📖";
			iconWrap.appendChild(em);
		}
		header.appendChild(iconWrap);

		const info = document.createElement("div");
		info.className = "ls-site-card-info";
		const nameEl = document.createElement("span");
		nameEl.className = "ls-site-card-name";
		nameEl.textContent = shelf.name || regEntry.name || shelfId;
		const domainEl = document.createElement("span");
		domainEl.className = "ls-site-card-domain";
		domainEl.textContent = regEntry.primaryDomain || shelfId;
		info.appendChild(nameEl);
		info.appendChild(domainEl);
		header.appendChild(info);

		if (isForceDisabled) {
			const badge = document.createElement("span");
			badge.className = "ls-badge ls-badge-muted";
			badge.textContent = "Coming soon";
			header.appendChild(badge);
		} else {
			const toggleLabel = document.createElement("label");
			toggleLabel.className = "ls-toggle";
			toggleLabel.title = "Enable " + (shelf.name || shelfId);
			const toggleInput = document.createElement("input");
			toggleInput.type = "checkbox";
			toggleInput.className = "site-enable-toggle";
			toggleInput.dataset.shelf = shelfId;
			toggleInput.checked = isEnabled;
			const toggleTrack = document.createElement("span");
			toggleTrack.className = "ls-toggle-track";
			toggleLabel.appendChild(toggleInput);
			toggleLabel.appendChild(toggleTrack);
			header.appendChild(toggleLabel);
		}

		if (hasSettings) {
			const chevron = document.createElement("button");
			chevron.className = "ls-site-card-chevron";
			chevron.setAttribute("aria-expanded", "false");
			chevron.textContent = "▾";
			header.appendChild(chevron);
		}

		card.appendChild(header);

		if (!isForceDisabled) {
			// ── Auto-add sub-row ───────────────────────────────────────────
			const aaRow = document.createElement("div");
			aaRow.className = "ls-site-card-autoadd" + (isEnabled ? "" : " ls-hidden");

			const aaLbl = document.createElement("span");
			aaLbl.className = "ls-site-autoadd-label";
			aaLbl.textContent = "Auto-add:";
			const aaToggle = document.createElement("label");
			aaToggle.className = "ls-toggle";
			const aaInput = document.createElement("input");
			aaInput.type = "checkbox";
			aaInput.className = "site-autoadd-toggle";
			aaInput.dataset.shelf = shelfId;
			aaInput.checked = autoAddEnabled;
			const aaTrack = document.createElement("span");
			aaTrack.className = "ls-toggle-track";
			aaToggle.appendChild(aaInput);
			aaToggle.appendChild(aaTrack);
			aaRow.appendChild(aaLbl);
			aaRow.appendChild(aaToggle);

			const chLbl = document.createElement("span");
			chLbl.className = "ls-site-autoadd-label";
			chLbl.textContent = "On chapter:";
			const chSel = _makeStatusSelect(
				shelfId, "chapter",
				shelfSett.autoAddStatusChapter || READING_STATUS.READING,
			);
			aaRow.appendChild(chLbl);
			aaRow.appendChild(chSel);

			const nvLbl = document.createElement("span");
			nvLbl.className = "ls-site-autoadd-label";
			nvLbl.textContent = "On novel:";
			const nvSel = _makeStatusSelect(
				shelfId, "novel",
				shelfSett.autoAddStatusNovel || READING_STATUS.PLAN_TO_READ,
			);
			aaRow.appendChild(nvLbl);
			aaRow.appendChild(nvSel);

			card.appendChild(aaRow);

			// ── Settings panel (open by default, collapsible) ─────────────
			if (hasSettings) {
				const settingsPanel = document.createElement("div");
				// Start expanded so settings are immediately visible
				settingsPanel.className = "ls-site-card-settings";
				const stored = siteSettings[shelfId] || {};
				settingsPanel.innerHTML = renderWebsiteSettingsPanel(siteDef, stored);
				card.appendChild(settingsPanel);

				const chevron = header.querySelector(".ls-site-card-chevron");
				if (chevron) {
					// Start in expanded state
					chevron.setAttribute("aria-expanded", "true");
					chevron.textContent = "▴";
					chevron.addEventListener("click", () => {
						const expanded = chevron.getAttribute("aria-expanded") === "true";
						chevron.setAttribute("aria-expanded", String(!expanded));
						chevron.textContent = expanded ? "▾" : "▴";
						settingsPanel.classList.toggle("ls-hidden", expanded);
					});
				}
			}

			// ── Enable toggle: save + request/revoke permission ────────────
			const enableToggle = card.querySelector(".site-enable-toggle");
			if (enableToggle) {
				enableToggle.addEventListener("change", async (e) => {
					const wantEnabled = e.target.checked;
					if (wantEnabled && permissionOrigins.length) {
						try {
							const granted = await browser.permissions.request({ origins: permissionOrigins });
							if (!granted) {
								e.target.checked = false;
								showToast("Permission denied for " + (shelf.name || shelfId), "error");
								return;
							}
						} catch (err) {
							debugError("Permission request failed:", err);
							e.target.checked = false;
							return;
						}
					} else if (!wantEnabled && permissionOrigins.length) {
						browser.permissions.remove({ origins: permissionOrigins }).catch(() => {});
					}
					const aaRowEl = card.querySelector(".ls-site-card-autoadd");
					if (aaRowEl) aaRowEl.classList.toggle("ls-hidden", !wantEnabled);
					const current = siteSettings[shelfId] || getDefaultSiteSettings(shelfId);
					siteSettings[shelfId] = { ...current, enabled: wantEnabled };
					await saveSiteSettings(siteSettings);
					showToast(
						wantEnabled
							? (shelf.name || shelfId) + " enabled"
							: (shelf.name || shelfId) + " disabled",
						"info",
					);
				});
			}

			// ── Auto-add toggle ────────────────────────────────────────────
			aaInput.addEventListener("change", async (e) => {
				const current = siteSettings[shelfId] || getDefaultSiteSettings(shelfId);
				siteSettings[shelfId] = { ...current, autoAddEnabled: e.target.checked };
				await saveSiteSettings(siteSettings);
				showToast(
					e.target.checked
						? "Auto-add enabled for " + (shelf.name || shelfId)
						: "Auto-add disabled for " + (shelf.name || shelfId),
					"info",
				);
			});

			// ── Status selects ─────────────────────────────────────────────
			[chSel, nvSel].forEach((sel) => {
				sel.addEventListener("change", async (e) => {
					const mode = e.target.dataset.mode;
					const current = siteSettings[shelfId] || getDefaultSiteSettings(shelfId);
					const updated = { ...current };
					if (mode === "chapter") updated.autoAddStatusChapter = e.target.value;
					else updated.autoAddStatusNovel = e.target.value;
					siteSettings[shelfId] = updated;
					await saveSiteSettings(siteSettings);
				});
			});

			// ── Per-site setting field changes ─────────────────────────────
			card.querySelectorAll("input[data-setting], select[data-setting], textarea[data-setting]").forEach((input) => {
				const evtName = input.tagName === "TEXTAREA" ? "input" : "change";
				let saveTimer = null;
				input.addEventListener(evtName, async (e) => {
					const sid = e.target.dataset.shelf;
					const settKey = e.target.dataset.setting;
					if (!sid || !settKey) return;
					let val;
					if (e.target.type === "checkbox") val = e.target.checked;
					else if (e.target.type === "number") val = parseFloat(e.target.value) || 0;
					else val = e.target.value;
					siteSettings[sid] = { ...(siteSettings[sid] || {}), [settKey]: val };
					// Debounce save for textarea/number to avoid hammering storage
					if (saveTimer) clearTimeout(saveTimer);
					saveTimer = setTimeout(async () => {
						await saveSiteSettings(siteSettings);
						showToast((shelf.name || sid) + " setting saved", "success");
					}, e.target.type === "number" || e.target.tagName === "TEXTAREA" ? 600 : 0);
				});
			});
		}

		container.appendChild(card);
	});
}

async function loadBackupCheckboxSettings() {
	try {
		const data = await browser.storage.local.get([
			"backupIncludeApiKeys",
			"backupIncludeCredentials",
			"rg_rolling_backup_enabled",
			"rollingBackupIntervalMinutes",
		]);

		const incApiKeys = $("backupIncludeApiKeys");
		if (incApiKeys) incApiKeys.checked = data.backupIncludeApiKeys ?? true;

		const incCreds = $("backupIncludeCredentials");
		if (incCreds) incCreds.checked = data.backupIncludeCredentials ?? true;

		const autoBackup = $("autoBackupEnabled");
		if (autoBackup)
			autoBackup.checked = data.rg_rolling_backup_enabled ?? true;

		const interval = data.rollingBackupIntervalMinutes ?? 1440;
		const intervalEl = $("rollingBackupInterval");
		if (intervalEl) intervalEl.value = String(interval);
		const intervalDisp = $("rollingBackupIntervalDisplay");
		if (intervalDisp) intervalDisp.textContent = String(interval);
	} catch (err) {
		debugError("Failed to load backup checkbox settings:", err);
	}
}

// \u{2500}\u{2500} Load: Rolling Backups \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function loadRollingBackups() {
	const listEl = $("rollingBackupList");
	if (!listEl) return;

	const backups = await listRollingBackups();

	if (backups.length === 0) {
		listEl.innerHTML = `
			<div class="no-backups" style="text-align:center;padding:15px;color:#888;font-size:12px;">
				No rolling backups yet. Enable auto-backup or create one manually.
			</div>`;
		return;
	}

	listEl.innerHTML = backups
		.map(
			(b) => `
		<div class="backup-item" style="display:flex;justify-content:space-between;align-items:center;
			padding:8px;background:rgba(0,0,0,0.1);border-radius:4px;margin-bottom:6px;font-size:12px;">
			<div>
				<div style="font-weight:500;">${b.dateStr}</div>
				<div style="font-size:11px;color:#aaa;">${b.novelCount} novels \u{2022} ${b.reason}</div>
			</div>
			<div style="display:flex;gap:4px;">
				<button class="rolling-restore ls-btn ls-btn-secondary ls-btn-sm" data-key="${b.key}">Restore</button>
				<button class="rolling-download ls-btn ls-btn-secondary ls-btn-sm" data-key="${b.key}">Download</button>
				<button class="rolling-delete ls-btn ls-btn-danger ls-btn-sm" data-key="${b.key}">Delete</button>
			</div>
		</div>
	`,
		)
		.join("");

	listEl.querySelectorAll(".rolling-restore").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const backup = await getRollingBackup(btn.dataset.key);
			if (backup && confirm("Restore this backup? (Merge mode)")) {
				await restoreComprehensiveBackup(backup, { mode: "merge" });
				showToast("\u{2705} Backup restored!", "success");
				setTimeout(() => location.reload(), 1000);
			}
		});
	});

	listEl.querySelectorAll(".rolling-download").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const backup = await getRollingBackup(btn.dataset.key);
			if (backup) downloadBackupAsFile(backup);
		});
	});

	listEl.querySelectorAll(".rolling-delete").forEach((btn) => {
		btn.addEventListener("click", async () => {
			if (confirm("Delete this backup?")) {
				await deleteRollingBackup(btn.dataset.key);
				await loadRollingBackups();
				showToast("Backup deleted", "success");
			}
		});
	});
}

// \u{2500}\u{2500} Load: Rolling Backup Status Indicator \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function initializeRollingBackupStatus() {
	const statusContainer = $("rollingBackupStatus");
	const statusIcon = $("backupStatusIcon");
	const statusText = $("backupStatusText");
	const countdownContainer = $("backupCountdownContainer");
	const countdownTime = $("backupCountdownTime");
	const lastBackupTimeDiv = $("lastBackupTime");
	const lastBackupTimeText = $("lastBackupTimeText");

	if (!statusContainer) return;

	const stored = await browser.storage.local.get([
		"rg_rolling_backup_enabled",
		"rollingBackupIntervalMinutes",
		"rg_rolling_backup_meta",
	]);

	const isEnabled = stored.rg_rolling_backup_enabled ?? true;
	const intervalMinutes =
		parseInt(stored.rollingBackupIntervalMinutes) || 1440;
	const backupList = Array.isArray(stored.rg_rolling_backup_meta)
		? stored.rg_rolling_backup_meta
		: [];
	const lastEntry = backupList[0] ?? null;

	if (!isEnabled) {
		statusContainer.style.display = "none";
		return;
	}
	statusContainer.style.display = "block";

	const updateCountdown = () => {
		if (!lastEntry) {
			if (statusIcon) statusIcon.textContent = "\u{23F3}";
			if (statusText)
				statusText.textContent = "Waiting for first backup\u{2026}";
			if (countdownContainer) countdownContainer.style.display = "none";
			if (lastBackupTimeDiv) lastBackupTimeDiv.style.display = "none";
			return;
		}

		const lastMs = lastEntry.timestamp;
		const nextMs = lastMs + intervalMinutes * 60000;
		const nowMs = Date.now();

		if (nowMs >= nextMs) {
			if (statusIcon) statusIcon.textContent = "\u{1F4C5}";
			if (statusText) statusText.textContent = "Backup due now";
			if (countdownContainer) countdownContainer.style.display = "none";
		} else {
			const remainMs = nextMs - nowMs;
			const remainMins = Math.floor(remainMs / 60000);
			const remainSecs = Math.floor((remainMs % 60000) / 1000);
			if (statusIcon) statusIcon.textContent = "\u{23F3}";
			if (statusText)
				statusText.textContent =
					remainMins > 0
						? `Next backup in ${remainMins}m ${remainSecs}s`
						: `Next backup in ${remainSecs}s`;
			if (countdownContainer) {
				countdownContainer.style.display = "block";
				if (countdownTime)
					countdownTime.textContent = `${String(remainMins).padStart(2, "0")}:${String(remainSecs).padStart(2, "0")}`;
			}
		}

		if (lastBackupTimeDiv && lastBackupTimeText) {
			const d = new Date(lastMs);
			const diffMs = Date.now() - d;
			const diffMins = Math.floor(diffMs / 60000);
			const diffHrs = Math.floor(diffMs / 3600000);
			const diffDays = Math.floor(diffMs / 86400000);
			const str =
				diffMins < 1
					? "just now"
					: diffMins < 60
						? `${diffMins}m ago`
						: diffHrs < 24
							? `${diffHrs}h ago`
							: `${diffDays}d ago`;
			lastBackupTimeText.textContent = str;
			lastBackupTimeDiv.style.display = "block";
		}
	};

	updateCountdown();
	if (!window._lsRollingCountdown) {
		window._lsRollingCountdown = setInterval(updateCountdown, 1000);
	}
}

// \u{2500}\u{2500} Load: Google Drive UI \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function updateDriveUI() {
	const driveNotConn = $("driveNotConnected");
	const driveConn = $("driveConnected");
	const driveStatus = $("driveStatus");
	if (!driveNotConn || !driveConn || !driveStatus) return;

	// Always show redirect URI list so user knows what to add to Google Console
	try {
		const uriListEl = $("drive-redirect-uri-list");
		if (uriListEl) {
			const primary = browser.identity.getRedirectURL("drive");
			// Some browser builds also accept the bare extension URL as a redirect
			const secondary = browser.identity.getRedirectURL("");
			const uris = [...new Set([primary, secondary].filter(Boolean))];
			const isFirefox = navigator.userAgent.includes("Firefox");
			const firefoxNote = isFirefox
				? `<div style="font-size:11px;color:var(--text-secondary);margin-top:8px;padding:6px;background:var(--bg-tertiary);border-radius:4px;">
					\u{26A0}\u{FE0F} <strong>Firefox Note:</strong> Google Cloud may show "Alizom" instead of the app name. This is a Firefox extension system limitation. <strong>Make sure the redirect URI above is registered in Google Cloud Console OAuth</strong> for logins to work.
				</div>`
				: "";
			uriListEl.innerHTML =
				uris
					.map(
						(uri) =>
							`<div style="display:flex;align-items:center;gap:6px;">
							<code style="flex:1;font-size:10px;background:var(--bg-secondary);padding:3px 6px;border-radius:4px;word-break:break-all;">${uri}</code>
							<button class="ls-btn ls-btn-sm ls-btn-secondary copy-redirect-uri-btn" data-uri="${uri}" title="Copy" style="min-width:32px;flex-shrink:0;">\u{1F4CB}</button>
						</div>`,
					)
					.join("") + firefoxNote;
			uriListEl
				.querySelectorAll(".copy-redirect-uri-btn")
				.forEach((btn) => {
					btn.addEventListener("click", () => {
						navigator.clipboard
							.writeText(btn.dataset.uri)
							.then(() =>
								showToast("\u{2705} Redirect URI copied!", "success"),
							)
							.catch(() =>
								showToast("\u{274C} Failed to copy", "error"),
							);
					});
				});
		}
	} catch (_) {
		// identity API not available in this context \u{2014} fail silently
	}

	try {
		const tokens = await browser.storage.local.get([
			"driveAuthTokens",
			"driveAuthError",
			"backupMode",
			"driveAutoRestoreEnabled",
			"driveBackupRetention",
			"driveClientId",
			"driveClientSecret",
		]);
		const hasToken = tokens.driveAuthTokens?.access_token;

		const clientIdIn = $("driveClientId");
		if (clientIdIn)
			clientIdIn.value =
				tokens.driveClientId || DEFAULT_DRIVE_CLIENT_ID || "";

		const clientSecIn = $("driveClientSecret");
		if (clientSecIn) clientSecIn.value = tokens.driveClientSecret || "";

		const mode = tokens.backupMode || "both";
		const contCont = $("continuousBackupCheckContainer");
		if (contCont)
			contCont.style.display =
				mode === "continuous" || mode === "both" ? "block" : "none";

		document
			.querySelectorAll('input[name="driveBackupMode"]')
			.forEach((r) => {
				r.checked = r.value === mode;
			});

		const autoRestore = $("driveAutoRestoreEnabled");
		if (autoRestore)
			autoRestore.checked = tokens.driveAutoRestoreEnabled === true;

		if (hasToken) {
			driveNotConn.style.display = "none";
			driveConn.style.display = "block";
			driveStatus.textContent = "\u{1F7E2} Connected";
			driveStatus.style.color = "#34a853";
			const authErr = $("driveAuthError");
			if (authErr) {
				authErr.style.display = "none";
				authErr.textContent = "";
			}
		} else {
			driveNotConn.style.display = "block";
			driveConn.style.display = "none";
			const authErrMsg = tokens.driveAuthError?.message;
			if (authErrMsg) {
				const isRevoked = authErrMsg.includes("revoked");
				driveStatus.textContent = isRevoked
					? "\u{1F534} Access Revoked"
					: "\u{1F534} Auth failed";
				driveStatus.style.color = "#ef4444";
				const authErr = $("driveAuthError");
				if (authErr) {
					if (isRevoked) {
						// Show revocation banner with reconnect button
						authErr.innerHTML = `
							<div style="background:#fca5a5;border:2px solid #dc2626;border-radius:8px;padding:12px;margin-bottom:12px;">
								<div style="font-weight:bold;color:#7f1d1d;margin-bottom:8px;">\u{26D4} Google Drive access was revoked</div>
								<div style="color:#991b1b;font-size:13px;margin-bottom:10px;">Your Google Drive access has been revoked. To reconnect, please click the button below.</div>
								<button class="ls-btn ls-btn-primary" id="reconnectDriveBtn" style="width:100%;">
									\u{1F510} Reconnect Google Drive
								</button>
							</div>
						`;
						authErr.style.display = "block";
						// Wire up the reconnect button
						const reconnectBtn = $("reconnectDriveBtn");
						if (reconnectBtn) {
							reconnectBtn.addEventListener(
								"click",
								handleConnectDrive,
							);
						}
					} else {
						authErr.textContent = authErrMsg;
						authErr.style.display = "block";
					}
				}
			} else {
				driveStatus.textContent = "\u{26AB} Disconnected";
				driveStatus.style.color = "#999";
				const authErr = $("driveAuthError");
				if (authErr) {
					authErr.style.display = "none";
					authErr.textContent = "";
				}
			}
			if (autoRestore) autoRestore.checked = false;
		}
	} catch (err) {
		debugError("Failed to update Drive UI", err);
	}
}

// \u{2500}\u{2500} URL Import helpers \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
function extractUrlsFromText(text) {
	const urlRegex = /https?:\/\/[^\s<>"',]+/gi;
	return [...new Set(text.match(urlRegex) || [])];
}

function filterSupportedUrls(urls) {
	return urls.filter((url) => {
		try {
			const parsed = new URL(url);
			if (!isSupportedDomain(parsed.hostname)) return false;
			// Explicitly ignore AO3 series lists (community-curated lists, not single works).
			if (
				(parsed.hostname.includes("archiveofourown.org") ||
					parsed.hostname.includes("ao3.org")) &&
				!/^\/works\/\d+(?:\/chapters\/\d+)?\/?$/.test(
					parsed.pathname || "",
				)
			) {
				return false;
			}
			// Ensure the URL maps to an actual importable novel identity.
			// Example: AO3 /series/* pages are intentionally excluded.
			return !!novelLibrary.getNovelIdentityFromUrl(url);
		} catch {
			return false;
		}
	});
}

function inferChapterHintFromUrl(url) {
	try {
		const parsed = new URL(url);
		const fromQuery = Number(parsed.searchParams.get("chapter"));
		if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;

		const match = (parsed.pathname || "").match(
			/(?:chapter|chap|ch)[-_/ ]?(\d{1,5})/i,
		);
		if (match) {
			const n = Number(match[1]);
			if (Number.isFinite(n) && n > 0) return n;
		}
	} catch (_error) {
		// ignore parse issues
	}
	return 0;
}

// ── Import Preview Modal ────────────────────────────────────────────────────────
function showImportPreviewModal({ prepared, invalidUrls, totalExtracted, onConfirm }) {
	document.getElementById("import-preview-modal")?.remove();

	const toImport = prepared.toImport || [];
	const existingItems = prepared.existingItems || [];
	const duplicateItems = prepared.duplicateItems || [];

	const overlay = document.createElement("div");
	overlay.id = "import-preview-modal";
	overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;";

	const modal = document.createElement("div");
	modal.style.cssText = "background:var(--bg-secondary,#111827);border:1px solid var(--border-color,#333);border-radius:10px;width:100%;max-width:700px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.6);overflow:hidden;";

	// ── Header ──────────────────────────────────────────────────────────────
	const hdr = document.createElement("div");
	hdr.style.cssText = "padding:16px 20px;border-bottom:1px solid var(--border-color,#333);display:flex;align-items:center;justify-content:space-between;";
	const htitle = document.createElement("div");
	htitle.innerHTML = `<div style="font-size:15px;font-weight:700;color:var(--text-primary)">Review URLs Before Import</div><div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${totalExtracted} URL(s) extracted from your text</div>`;
	const closeX = document.createElement("button");
	closeX.style.cssText = "background:none;border:none;color:var(--text-secondary);font-size:20px;cursor:pointer;padding:2px 6px;border-radius:4px;";
	closeX.textContent = "\u{2715}";
	closeX.addEventListener("click", () => overlay.remove());
	hdr.appendChild(htitle);
	hdr.appendChild(closeX);
	modal.appendChild(hdr);

	// ── Breakdown chips ──────────────────────────────────────────────────────
	const chips = document.createElement("div");
	chips.style.cssText = "padding:10px 20px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--border-color,#333);background:var(--bg-tertiary,#1f2937);";
	const chipDefs = [
		{ n: toImport.length, label: "ready to import", color: "#22c55e" },
		{ n: existingItems.length, label: "already in library", color: "#f59e0b" },
		{ n: invalidUrls.length, label: "invalid / unsupported", color: "#ef4444" },
		{ n: duplicateItems.length, label: "duplicates", color: "#8b5cf6" },
	];
	for (const { n, label, color } of chipDefs) {
		const c = document.createElement("span");
		c.style.cssText = `padding:4px 12px;border-radius:12px;font-size:12px;font-weight:700;background:${color}22;color:${color};border:1px solid ${color}55;`;
		c.textContent = `${n} ${label}`;
		chips.appendChild(c);
	}
	modal.appendChild(chips);

	// ── Tab bar ──────────────────────────────────────────────────────────────
	const tabBar = document.createElement("div");
	tabBar.style.cssText = "display:flex;border-bottom:1px solid var(--border-color,#333);padding:0 20px;background:var(--bg-secondary);";
	const body = document.createElement("div");
	body.style.cssText = "flex:1;overflow-y:auto;padding:16px 20px;";

	const sections = {};
	const tabBtns = [];

	const tabDefs = [
		{ id: "ready", label: `\u{2705} Ready (${toImport.length})`, show: true },
		{ id: "existing", label: `\u{1F4DA} In Library (${existingItems.length})`, show: existingItems.length > 0 },
		{ id: "invalid", label: `\u{274C} Invalid (${invalidUrls.length})`, show: invalidUrls.length > 0 },
		{ id: "duplicates", label: `\u{267B}\u{FE0F} Duplicates (${duplicateItems.length})`, show: duplicateItems.length > 0 },
	].filter((t) => t.show || t.id === "ready");

	function activateTab(id) {
		tabBtns.forEach((b) => {
			const active = b.dataset.tid === id;
			b.style.borderBottom = active ? "2px solid var(--accent-color,#7c3aed)" : "2px solid transparent";
			b.style.color = active ? "var(--accent-color,#7c3aed)" : "var(--text-secondary)";
			b.style.fontWeight = active ? "600" : "400";
		});
		for (const [sid, sec] of Object.entries(sections)) {
			sec.style.display = sid === id ? "" : "none";
		}
	}

	for (const t of tabDefs) {
		const btn = document.createElement("button");
		btn.style.cssText = "background:none;border:none;border-bottom:2px solid transparent;padding:9px 14px;font-size:12px;cursor:pointer;white-space:nowrap;";
		btn.textContent = t.label;
		btn.dataset.tid = t.id;
		btn.addEventListener("click", () => activateTab(t.id));
		tabBar.appendChild(btn);
		tabBtns.push(btn);
		const sec = document.createElement("div");
		sec.style.display = "none";
		sections[t.id] = sec;
		body.appendChild(sec);
	}

	// ── Tab: Ready ───────────────────────────────────────────────────────────
	{
		const sec = sections["ready"];
		if (toImport.length === 0) {
			const p = document.createElement("p");
			p.style.cssText = "color:var(--text-secondary);font-size:13px;margin:0;";
			p.textContent = "No new novels to import. Check the other tabs.";
			sec.appendChild(p);
		} else {
			const note = document.createElement("p");
			note.style.cssText = "font-size:12px;color:var(--text-secondary);margin:0 0 10px;";
			note.textContent = `${toImport.length} novel(s) will be imported.`;
			sec.appendChild(note);
			const ul = document.createElement("div");
			ul.style.cssText = "display:flex;flex-direction:column;gap:4px;max-height:220px;overflow-y:auto;";
			for (const item of toImport) {
				const row = document.createElement("div");
				row.style.cssText = "font-size:11px;padding:5px 8px;border-radius:4px;background:var(--bg-tertiary);color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:3px solid #22c55e;";
				row.textContent = item.originalUrl || item.url;
				row.title = item.originalUrl || item.url;
				ul.appendChild(row);
			}
			sec.appendChild(ul);
		}
	}

	// ── Tab: Existing ────────────────────────────────────────────────────────
	const updateCheckboxes = [];
	if (existingItems.length) {
		const sec = sections["existing"];
		const note = document.createElement("p");
		note.style.cssText = "font-size:12px;color:var(--text-secondary);margin:0 0 10px;line-height:1.5;";
		note.textContent = "These novels are already in your library. Tick the ones you want to re-import to refresh metadata (title, chapter count, cover).";
		sec.appendChild(note);

		const selAll = document.createElement("label");
		selAll.style.cssText = "display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary);margin-bottom:8px;cursor:pointer;";
		const selAllCb = document.createElement("input");
		selAllCb.type = "checkbox";
		selAll.appendChild(selAllCb);
		selAll.appendChild(document.createTextNode("Select all to update"));
		sec.appendChild(selAll);

		const ul = document.createElement("div");
		ul.style.cssText = "display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto;";
		for (const item of existingItems) {
			const row = document.createElement("label");
			row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;border:1px solid var(--border-color,#333);border-left:3px solid #f59e0b;cursor:pointer;";
			const cb = document.createElement("input");
			cb.type = "checkbox";
			cb.dataset.importUrl = item.importUrl || item.url;
			cb.dataset.novelId = item.novelId;
			updateCheckboxes.push(cb);
			const info = document.createElement("div");
			info.style.cssText = "flex:1;min-width:0;";
			const t = document.createElement("div");
			t.style.cssText = "font-size:12px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
			t.textContent = item.title;
			t.title = item.title;
			const s = document.createElement("div");
			s.style.cssText = "font-size:10px;color:var(--text-secondary);margin-top:1px;";
			s.textContent = item.totalChapters
				? `Ch. ${item.lastReadChapter}/${item.totalChapters} \u{B7} ${item.novelId}`
				: item.novelId;
			info.appendChild(t);
			info.appendChild(s);
			row.appendChild(cb);
			row.appendChild(info);
			ul.appendChild(row);
		}
		sec.appendChild(ul);

		selAllCb.addEventListener("change", () => {
			updateCheckboxes.forEach((c) => { c.checked = selAllCb.checked; });
		});
	}

	// ── Tab: Invalid ─────────────────────────────────────────────────────────
	let invalidTextarea = null;
	if (invalidUrls.length) {
		const sec = sections["invalid"];

		const note = document.createElement("div");
		note.style.cssText = "margin-bottom:10px;";
		note.innerHTML = `
			<p style="font-size:12px;color:var(--text-secondary);margin:0 0 6px;line-height:1.5;">
				These ${invalidUrls.length} URL(s) were not recognised as supported novel pages.
				Common reasons: wrong site, AO3 series or tag pages, malformed URL, or unsupported format.
			</p>
			<p style="font-size:12px;color:var(--text-secondary);margin:0;line-height:1.5;">
				<strong style="color:var(--text-primary);">Edit them below</strong>, or use <strong style="color:var(--text-primary);">Find on NovelArrow</strong> to search for the same novel on a supported site.
			</p>`;
		sec.appendChild(note);

		// Per-URL rows with "Find on NovelArrow" button
		const perUrlList = document.createElement("div");
		perUrlList.style.cssText = "display:flex;flex-direction:column;gap:6px;margin-bottom:10px;";

		for (const url of invalidUrls) {
			const rowEl = document.createElement("div");
			rowEl.style.cssText = "display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--border-color,#333);border-left:3px solid #ef4444;border-radius:6px;background:var(--bg-secondary);";

			const urlText = document.createElement("span");
			urlText.style.cssText = "flex:1;font-size:11px;font-family:monospace;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
			urlText.textContent = url;
			urlText.title = url;

			const findBtn = document.createElement("button");
			findBtn.className = "ls-btn ls-btn-secondary ls-btn-sm";
			findBtn.style.cssText = "flex-shrink:0;font-size:11px;white-space:nowrap;";
			findBtn.textContent = "\u{1F50D} Find on supported sites";

			// Search results dropdown
			const dropdown = document.createElement("div");
			dropdown.style.cssText = "display:none;position:absolute;z-index:10000;background:var(--bg-secondary,#111827);border:1px solid var(--border-color,#333);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.5);width:360px;max-height:260px;overflow-y:auto;";
			rowEl.style.position = "relative";

			findBtn.addEventListener("click", async () => {
				findBtn.disabled = true;
				findBtn.textContent = "\u{23F3} Searching\u{2026}";
				dropdown.style.display = "none";
				try {
					const query = _slugToQuery(url);
					if (!query) { findBtn.textContent = "No title found"; return; }
					const siteGroups = await searchSupportedSites(query);
					dropdown.innerHTML = "";

					if (!siteGroups.length) {
						const none = document.createElement("div");
						none.style.cssText = "padding:12px;font-size:12px;color:var(--text-secondary);text-align:center;";
						none.textContent = `No matches found for: "${query}"`;
						dropdown.appendChild(none);
					} else {
						const hdr = document.createElement("div");
						hdr.style.cssText = "padding:6px 10px;font-size:10px;font-weight:700;color:var(--text-muted,#6b7280);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border-color,#333);";
						hdr.textContent = `Results for "${query}"`;
						dropdown.appendChild(hdr);

						for (const group of siteGroups) {
							// Site label
							const siteHdr = document.createElement("div");
							siteHdr.style.cssText = "padding:4px 10px;font-size:10px;font-weight:700;color:var(--accent-color,#7c3aed);background:var(--bg-tertiary);border-bottom:1px solid var(--border-color,#333);";
							siteHdr.textContent = `${group.emoji} ${group.site}`;
							dropdown.appendChild(siteHdr);

							for (const r of group.results) {
								const item = document.createElement("div");
								item.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border-color,#333);";
								item.addEventListener("mouseenter", () => { item.style.background = "var(--bg-tertiary)"; });
								item.addEventListener("mouseleave", () => { item.style.background = ""; });

								if (r.cover) {
									const thumb = document.createElement("img");
									thumb.src = r.cover;
									thumb.style.cssText = "width:32px;height:40px;object-fit:cover;border-radius:3px;flex-shrink:0;";
									thumb.onerror = () => { thumb.style.display = "none"; };
									item.appendChild(thumb);
								}

								const info = document.createElement("div");
								info.style.cssText = "flex:1;min-width:0;";
								const t = document.createElement("div");
								t.style.cssText = "font-size:12px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
								t.textContent = r.title;
								const sub = document.createElement("div");
								sub.style.cssText = "font-size:10px;color:var(--text-secondary);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
								sub.textContent = r.author || r.url;
								info.appendChild(t);
								info.appendChild(sub);

								const useBtn = document.createElement("button");
								useBtn.className = "ls-btn ls-btn-primary ls-btn-sm";
								useBtn.style.cssText = "font-size:10px;flex-shrink:0;";
								useBtn.textContent = "Use";
								useBtn.addEventListener("click", () => {
									const lines = (invalidTextarea.value || "").split("\n");
									const idx = lines.findIndex((l) => l.trim() === url);
									if (idx !== -1) lines[idx] = r.url;
									else lines.push(r.url);
									invalidTextarea.value = lines.join("\n");
									rowEl.style.borderLeftColor = "#22c55e";
									urlText.textContent = r.url;
									urlText.title = r.url;
									urlText.style.color = "#22c55e";
									findBtn.textContent = "\u{2705} Replaced";
									dropdown.style.display = "none";
								});

								item.appendChild(info);
								item.appendChild(useBtn);
								dropdown.appendChild(item);
							}
						}
					}
					dropdown.style.display = "";
				} catch (e) {
					findBtn.textContent = "\u{274C} Search failed";
					setTimeout(() => {
						findBtn.textContent = "\u{1F50D} Find on supported sites";
						findBtn.disabled = false;
					}, 2000);
					return;
				} finally {
					if (findBtn.textContent !== "\u{2705} Replaced" && findBtn.textContent !== "\u{274C} Search failed") {
						findBtn.textContent = "\u{1F50D} Find on supported sites";
					}
					findBtn.disabled = false;
				}
			});

			// Close dropdown on outside click
			document.addEventListener("click", (e) => {
				if (!rowEl.contains(e.target)) dropdown.style.display = "none";
			}, { once: false, capture: false });

			rowEl.appendChild(urlText);
			rowEl.appendChild(findBtn);
			rowEl.appendChild(dropdown);
			perUrlList.appendChild(rowEl);
		}
		sec.appendChild(perUrlList);

		// Editable textarea for batch editing
		const textareaLabel = document.createElement("p");
		textareaLabel.style.cssText = "font-size:11px;font-weight:600;color:var(--text-secondary);margin:0 0 4px;";
		textareaLabel.textContent = "Or edit all at once (one URL per line):";
		sec.appendChild(textareaLabel);

		invalidTextarea = document.createElement("textarea");
		invalidTextarea.className = "ls-textarea";
		invalidTextarea.style.cssText = "width:100%;min-height:100px;font-size:11px;font-family:monospace;resize:vertical;box-sizing:border-box;";
		invalidTextarea.value = invalidUrls.join("\n");
		invalidTextarea.placeholder = "Edit URLs here, one per line…";
		invalidTextarea.spellcheck = false;
		sec.appendChild(invalidTextarea);

		const hint = document.createElement("p");
		hint.style.cssText = "font-size:11px;color:var(--text-muted,#6b7280);margin:6px 0 0;";
		hint.textContent = "Corrected URLs will be re-validated on import. Supported: NovelArrow, Ranobes, ScribbleHub, FanFiction, AO3 (works only), WebNovel.";
		sec.appendChild(hint);
	}

	// ── Tab: Duplicates ──────────────────────────────────────────────────────
	if (duplicateItems.length) {
		const sec = sections["duplicates"];
		const note = document.createElement("p");
		note.style.cssText = "font-size:12px;color:var(--text-secondary);margin:0 0 10px;line-height:1.5;";
		note.textContent = "The same novel appeared more than once in your input. Only the first occurrence is imported; these extras are ignored.";
		sec.appendChild(note);
		const ul = document.createElement("div");
		ul.style.cssText = "display:flex;flex-direction:column;gap:4px;max-height:180px;overflow-y:auto;";
		for (const item of duplicateItems) {
			const row = document.createElement("div");
			row.style.cssText = "font-size:11px;padding:5px 8px;border-radius:4px;background:var(--bg-tertiary);color:var(--text-secondary);border-left:3px solid #8b5cf6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
			row.textContent = item.url;
			row.title = item.url;
			ul.appendChild(row);
		}
		sec.appendChild(ul);
	}

	modal.appendChild(tabBar);
	modal.appendChild(body);

	// ── Progress bar (hidden until import starts) ─────────────────────────────
	const progressWrap = document.createElement("div");
	progressWrap.style.cssText = "padding:0 20px;display:none;border-top:1px solid var(--border-color,#333);";
	const progressLbl = document.createElement("div");
	progressLbl.style.cssText = "font-size:11px;color:var(--text-secondary);padding:8px 0 4px;";
	progressLbl.textContent = "Importing\u{2026}";
	const progressBarWrap = document.createElement("div");
	progressBarWrap.style.cssText = "background:var(--bg-tertiary);border-radius:3px;height:5px;overflow:hidden;margin-bottom:8px;";
	const progressBarFill = document.createElement("div");
	progressBarFill.style.cssText = "background:#22c55e;height:100%;width:0%;transition:width 0.3s;";
	progressBarWrap.appendChild(progressBarFill);
	progressWrap.appendChild(progressLbl);
	progressWrap.appendChild(progressBarWrap);
	modal.appendChild(progressWrap);

	// ── Footer ────────────────────────────────────────────────────────────────
	const footer = document.createElement("div");
	footer.style.cssText = "padding:12px 20px;border-top:1px solid var(--border-color,#333);display:flex;justify-content:space-between;align-items:center;gap:10px;";
	const cancelBtn = document.createElement("button");
	cancelBtn.className = "ls-btn ls-btn-secondary";
	cancelBtn.textContent = "Cancel";
	cancelBtn.addEventListener("click", () => overlay.remove());
	const importBtn = document.createElement("button");
	importBtn.className = "ls-btn ls-btn-primary";
	const importBtnBase = toImport.length > 0
		? `Import ${toImport.length} Novel${toImport.length !== 1 ? "s" : ""} \u{2192}`
		: "Import Selected \u{2192}";
	importBtn.textContent = importBtnBase;

	importBtn.addEventListener("click", async () => {
		importBtn.disabled = true;
		cancelBtn.disabled = true;
		importBtn.textContent = "\u{23F3} Starting\u{2026}";

		// Collect corrected invalid URLs (re-parse the edited textarea)
		const correctedUrls = invalidTextarea
			? extractUrlsFromText(invalidTextarea.value)
			: [];

		// Collect force-update items (checked "already in library")
		const forcedUpdateItems = updateCheckboxes
			.filter((cb) => cb.checked)
			.map((cb) => ({
				url: cb.dataset.importUrl,
				originalUrl: cb.dataset.importUrl,
				novelId: cb.dataset.novelId,
				shelfId: "",
			}));

		// Show progress bar
		progressWrap.style.display = "";
		tabBar.style.display = "none";
		body.style.display = "none";

		await onConfirm({
			toImport,
			forcedUpdateItems,
			correctedUrls,
			modalEl: overlay,
			progressLbl,
			progressBarFill,
		});
	});

	footer.appendChild(cancelBtn);
	footer.appendChild(importBtn);
	modal.appendChild(footer);

	overlay.appendChild(modal);
	overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
	document.body.appendChild(overlay);

	// Activate first tab that has content
	const firstActive = tabDefs.find((t) => t.id === "invalid" && invalidUrls.length > 0)?.id
		|| (toImport.length > 0 ? "ready" : tabDefs[0]?.id);
	activateTab(firstActive);
}

// ── Import runner (called by both old and new flows) ─────────────────────────
async function _runImport({ toImport, forcedUpdateItems = [], correctedUrls = [], modalEl, urlImportStatus, progressLbl, progressBarFill }) {
	const results = await addUrlsToLibrary(
		correctedUrls,
		(progress) => {
			if (progressLbl) {
				const cur = progress.processed ?? 0;
				const total = (progress.queued ?? 0) + (toImport.length || 0) + (forcedUpdateItems.length || 0);
				const done = cur + ((toImport.length || 0) + (forcedUpdateItems.length || 0)) - (progress.queued ?? 0);
				const pct = total ? Math.round((Math.max(0, done) / total) * 100) : 0;
				progressLbl.textContent = `Importing ${progress.processed}/${progress.queued + (toImport.length || 0) + (forcedUpdateItems.length || 0)} \u{B7} Added ${progress.added} \u{B7} Failed ${progress.failed}\u{2026}`;
				if (progressBarFill) progressBarFill.style.width = pct + "%";
			}
			if (urlImportStatus) {
				const p = progress;
				urlImportStatus.textContent = `Processing ${p.processed}/${p.queued} \u{B7} Added ${p.added} \u{B7} Failed ${p.failed}`;
			}
		},
		[...toImport, ...forcedUpdateItems],
	);

	if (modalEl) modalEl.remove();

	if (urlImportStatus) {
		const parts = [`Added ${results.added}`];
		if (results.failed) parts.push(`\u{26A0}\u{FE0F} ${results.failed} failed`);
		if (results.skipped) parts.push(`${results.skipped} skipped`);
		urlImportStatus.textContent = "Done. " + parts.join(" \u{B7} ") + ".";
	}

	const hasIssues =
		results.failed > 0 ||
		results.existingItems.length > 0 ||
		results.duplicateItems.length > 0 ||
		results.unsupportedItems.length > 0;

	if (hasIssues) {
		showImportResultsModal(results, []);
	} else {
		showToast(`\u{2705} Import complete. Added ${results.added} novel(s).`, "success");
	}
}

// ── Import Results Modal ────────────────────────────────────────────────────────
function showImportResultsModal(results, allInputUrls = []) {
	// Remove any existing modal
	document.getElementById("import-results-modal")?.remove();

	const overlay = document.createElement("div");
	overlay.id = "import-results-modal";
	overlay.style.cssText = `
		position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;
		display:flex;align-items:center;justify-content:center;padding:16px;
	`;

	const modal = document.createElement("div");
	modal.style.cssText = `
		background:var(--bg-secondary,#111827);border:1px solid var(--border-color,#2f3644);
		border-radius:10px;width:100%;max-width:680px;max-height:80vh;display:flex;
		flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.6);overflow:hidden;
	`;

	// Header
	const header = document.createElement("div");
	header.style.cssText = "padding:16px 20px;border-bottom:1px solid var(--border-color,#333);display:flex;align-items:center;justify-content:space-between;gap:12px;";
	const title = document.createElement("h2");
	title.style.cssText = "margin:0;font-size:16px;color:var(--text-primary);";
	title.textContent = "Import Results";
	const closeBtn = document.createElement("button");
	closeBtn.style.cssText = "background:none;border:none;color:var(--text-secondary);font-size:20px;cursor:pointer;line-height:1;padding:2px 6px;border-radius:4px;";
	closeBtn.textContent = "\u{2715}";
	closeBtn.addEventListener("click", () => overlay.remove());
	header.appendChild(title);
	header.appendChild(closeBtn);
	modal.appendChild(header);

	// Summary chips
	const summary = document.createElement("div");
	summary.style.cssText = "padding:12px 20px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--border-color,#333);";
	const chipData = [
		{ label: `\u{2705} ${results.added} added`, color: "#22c55e", show: results.added > 0 },
		{ label: `\u{274C} ${results.failed} failed`, color: "#ef4444", show: results.failed > 0 },
		{ label: `\u{1F4DA} ${results.existingItems.length} already in library`, color: "#f59e0b", show: results.existingItems.length > 0 },
		{ label: `\u{267B}\u{FE0F} ${results.duplicateItems.length} duplicates`, color: "#8b5cf6", show: results.duplicateItems.length > 0 },
		{ label: `\u{1F6AB} ${results.unsupportedItems.length} unsupported`, color: "#6b7280", show: results.unsupportedItems.length > 0 },
	];
	for (const { label, color, show } of chipData) {
		if (!show) continue;
		const chip = document.createElement("span");
		chip.style.cssText = `padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;background:${color}22;color:${color};border:1px solid ${color}44;`;
		chip.textContent = label;
		summary.appendChild(chip);
	}
	modal.appendChild(summary);

	// Tab nav
	const tabs = [];
	const tabDefs = [
		{ id: "failed", label: `\u{274C} Failed (${results.failedUrls.length})`, show: results.failedUrls.length > 0 },
		{ id: "existing", label: `\u{1F4DA} In Library (${results.existingItems.length})`, show: results.existingItems.length > 0 },
		{ id: "duplicate", label: `\u{267B}\u{FE0F} Duplicates (${results.duplicateItems.length})`, show: results.duplicateItems.length > 0 },
		{ id: "unsupported", label: `\u{1F6AB} Unsupported (${results.unsupportedItems.length})`, show: results.unsupportedItems.length > 0 },
	].filter((t) => t.show);

	const tabBar = document.createElement("div");
	tabBar.style.cssText = "display:flex;gap:0;border-bottom:1px solid var(--border-color,#333);padding:0 20px;";
	const tabBody = document.createElement("div");
	tabBody.style.cssText = "flex:1;overflow-y:auto;padding:16px 20px;";

	const sections = {};

	function activateTab(id) {
		tabs.forEach((t) => {
			const active = t.dataset.tabId === id;
			t.style.borderBottom = active ? "2px solid var(--accent-color,#7c3aed)" : "2px solid transparent";
			t.style.color = active ? "var(--accent-color,#7c3aed)" : "var(--text-secondary)";
			t.style.fontWeight = active ? "600" : "400";
		});
		for (const [sid, sec] of Object.entries(sections)) {
			sec.style.display = sid === id ? "" : "none";
		}
	}

	for (const tab of tabDefs) {
		const btn = document.createElement("button");
		btn.style.cssText = "background:none;border:none;border-bottom:2px solid transparent;padding:8px 14px;font-size:12px;cursor:pointer;color:var(--text-secondary);white-space:nowrap;";
		btn.textContent = tab.label;
		btn.dataset.tabId = tab.id;
		btn.addEventListener("click", () => activateTab(tab.id));
		tabBar.appendChild(btn);
		tabs.push(btn);

		const sec = document.createElement("div");
		sec.style.display = "none";
		sec.dataset.section = tab.id;
		sections[tab.id] = sec;
		tabBody.appendChild(sec);
	}

	// ── Failed section ────────────────────────────────────────────────────────
	if (results.failedUrls.length) {
		const sec = sections["failed"];
		sec.appendChild(_importNote("These URLs opened as tabs but the extension could not extract novel data. The tabs were left open so you can inspect them. You can retry or open them manually."));
		for (const item of results.failedUrls) {
			sec.appendChild(_importRow(
				item.url,
				item.error || "Unknown error",
				"error",
				[
					{
						label: "Retry",
						onClick: async (rowEl, btn) => {
							btn.textContent = "Retrying…";
							btn.disabled = true;
							const [ok, err] = await _retryImportUrl(item.url);
							if (ok) {
								rowEl.style.opacity = "0.4";
								rowEl.querySelector(".ir-status").textContent = "✅ Added";
							} else {
								rowEl.querySelector(".ir-status").textContent = "❌ " + err;
								btn.textContent = "Retry";
								btn.disabled = false;
							}
						},
					},
					{
						label: "Open URL",
						onClick: () => browser.tabs.create({ url: item.url }),
					},
				],
			));
		}
	}

	// ── Already in Library section ────────────────────────────────────────────
	if (results.existingItems.length) {
		const sec = sections["existing"];
		sec.appendChild(_importNote("These novels are already in your library. You can update their metadata (title, chapters, cover) from the site, or keep what you have."));
		for (const item of results.existingItems) {
			const subtitle = item.totalChapters
				? `Ch. ${item.lastReadChapter}/${item.totalChapters} \u{B7} ${item.novelId}`
				: item.novelId;
			sec.appendChild(_importRow(
				item.title,
				subtitle,
				"existing",
				[
					{
						label: "Update Metadata",
						onClick: async (rowEl, btn) => {
							btn.textContent = "Updating…";
							btn.disabled = true;
							const [ok, err] = await _retryImportUrl(item.importUrl || item.url, true);
							if (ok) {
								rowEl.style.opacity = "0.4";
								rowEl.querySelector(".ir-status").textContent = "\u{2705} Updated";
							} else {
								rowEl.querySelector(".ir-status").textContent = "\u{274C} " + err;
								btn.textContent = "Update Metadata";
								btn.disabled = false;
							}
						},
					},
					{
						label: "Open in Library",
						onClick: () => browser.tabs.create({ url: browser.runtime.getURL("library/library.html") }),
					},
				],
			));
		}
	}

	// ── Duplicates section ────────────────────────────────────────────────────
	if (results.duplicateItems.length) {
		const sec = sections["duplicate"];
		sec.appendChild(_importNote("The same novel appeared multiple times in your input. Only the first occurrence was imported; these duplicates were ignored."));
		for (const item of results.duplicateItems) {
			sec.appendChild(_importRow(item.url, item.novelId, "duplicate", []));
		}
	}

	// ── Unsupported section ───────────────────────────────────────────────────
	if (results.unsupportedItems.length) {
		const sec = sections["unsupported"];
		sec.appendChild(_importNote("These URLs are not from a supported site, or are not a novel/chapter page (e.g. AO3 series lists). They were skipped."));
		for (const item of results.unsupportedItems) {
			if (!item.url) continue;
			sec.appendChild(_importRow(item.url, "Not a supported novel URL", "unsupported", []));
		}
	}

	// Activate first tab
	if (tabDefs.length) activateTab(tabDefs[0].id);

	modal.appendChild(tabBar);
	modal.appendChild(tabBody);

	// Footer
	const footer = document.createElement("div");
	footer.style.cssText = "padding:12px 20px;border-top:1px solid var(--border-color,#333);display:flex;justify-content:flex-end;";
	const doneBtn = document.createElement("button");
	doneBtn.className = "ls-btn ls-btn-primary ls-btn-sm";
	doneBtn.textContent = "Done";
	doneBtn.addEventListener("click", () => overlay.remove());
	footer.appendChild(doneBtn);
	modal.appendChild(footer);

	overlay.appendChild(modal);
	overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
	document.body.appendChild(overlay);
}

// ── Cross-site URL resolution via NovelArrow/NovelBin search ──────────────────────────────

/**
 * Convert a URL slug or path into a plain text search query.
 * E.g. "back-then-i-adored-you" → "back then i adored you"
 *      "/back-then-i-adored-you.html" → "back then i adored you"
 */
function _slugToQuery(url) {
	try {
		const pathname = new URL(url).pathname;
		// Strip leading slash, file extension, common prefixes like /b/
		const raw = pathname
			.replace(/^\/+/, "")
			.replace(/\.html?$/i, "")
			.replace(/^b\//, "")
			.split("/")
			.pop() || "";
		return raw.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
	} catch {
		return "";
	}
}

/**
 * Supported-site search configurations.
 * Each entry defines how to search that site and parse results.
 * Only sites whose shelfId is enabled in siteSettings will be queried.
 */
const SITE_SEARCH_CONFIGS = [
	{
		// novelbin shelfId covers both novelbin.com and novelarrow.com
		shelfId: "novelbin",
		label: "NovelBin (NovelArrow)",
		emoji: "\u{1F4DA}",
		buildUrl: (q) => `https://novelarrow.com/search?q=${encodeURIComponent(q)}`,
		parseResults(doc, limit) {
			// NovelArrow is a Next.js React app — links to /novel/{slug} are the results.
			const links = doc.querySelectorAll("a[href*='/novel/']");
			const out = [];
			const seen = new Set();
			for (const a of links) {
				const href = a.getAttribute("href") || "";
				if (!href.match(/\/novel\/[a-z0-9-]+$/i)) continue;
				const url = href.startsWith("http") ? href : `https://novelarrow.com${href}`;
				if (seen.has(url)) continue;
				seen.add(url);
				out.push({
					title: a.textContent.trim() || href.split("/").pop(),
					url,
					author: "",
					cover: "",
				});
				if (out.length >= limit) break;
			}
			// Fallback: search novelbin.com if novelarrow returns nothing
			if (!out.length) {
				const rows = doc.querySelectorAll(".col-novel-main .list-novel .row");
				for (const row of rows) {
					const a = row.querySelector("h3.novel-title a");
					if (!a) continue;
					const href = a.getAttribute("href") || "";
					out.push({
						title: a.getAttribute("title") || a.textContent.trim(),
						url: href.startsWith("http") ? href : `https://novelbin.com${href}`,
						author: row.querySelector(".author")?.textContent?.replace(/\s+/g, " ").trim() || "",
						cover: row.querySelector("img.cover")?.getAttribute("src") || "",
					});
					if (out.length >= limit) break;
				}
			}
			return out;
		},
	},
	{
		shelfId: "ranobes",
		label: "Ranobes",
		emoji: "\u{1F30F}",
		buildUrl: (q) => `https://ranobes.net/search/${encodeURIComponent(q)}/`,
		parseResults(doc, limit) {
			const articles = doc.querySelectorAll("article.block.story.shortstory");
			const out = [];
			for (const a of articles) {
				const titleEl = a.querySelector("h2.title a");
				if (!titleEl) continue;
				const href = titleEl.getAttribute("href") || "";
				const url = href.startsWith("http") ? href : `https://ranobes.net${href}`;
				// Cover is a CSS background-image on figure.cover
				let cover = "";
				const fig = a.querySelector("figure.cover");
				if (fig) {
					const m = (fig.getAttribute("style") || "").match(/url\(["']?([^"')]+)["']?\)/);
					if (m) cover = m[1];
				}
				out.push({
					title: titleEl.textContent.trim(),
					url,
					author: "",
					cover,
				});
				if (out.length >= limit) break;
			}
			return out;
		},
	},
];

/**
 * Search all currently-enabled supported sites for a title query.
 * Runs all searches in parallel; returns results grouped by site.
 * @param {string} query
 * @param {number} [limitPerSite=4]
 * @returns {Promise<Array<{site:string, emoji:string, results:Array}>>}
 */
async function searchSupportedSites(query, limitPerSite = 4) {
	const enabledIds = new Set(
		Object.entries(siteSettings)
			.filter(([, s]) => s.enabled !== false)
			.map(([id]) => id),
	);

	const activeConfigs = SITE_SEARCH_CONFIGS.filter((c) => enabledIds.has(c.shelfId));
	if (!activeConfigs.length) return [];

	const results = await Promise.allSettled(
		activeConfigs.map(async (cfg) => {
			const url = cfg.buildUrl(query.trim());
			const resp = await fetch(url, { credentials: "omit", headers: { Accept: "text/html" } });
			if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
			const html = await resp.text();
			const doc = new DOMParser().parseFromString(html, "text/html");
			return {
				site: cfg.label,
				emoji: cfg.emoji,
				results: cfg.parseResults(doc, limitPerSite),
			};
		}),
	);

	return results
		.filter((r) => r.status === "fulfilled" && r.value.results.length > 0)
		.map((r) => r.value);
}

function _importNote(text) {
	const p = document.createElement("p");
	p.style.cssText = "font-size:12px;color:var(--text-secondary);margin:0 0 12px;line-height:1.5;";
	p.textContent = text;
	return p;
}

const TYPE_COLOR = { error: "#ef4444", existing: "#f59e0b", duplicate: "#8b5cf6", unsupported: "#6b7280" };

function _importRow(title, subtitle, type, actions) {
	const row = document.createElement("div");
	row.style.cssText = `
		display:flex;align-items:center;gap:10px;padding:8px 10px;
		border:1px solid var(--border-color,#333);border-left:3px solid ${TYPE_COLOR[type] || "#6b7280"};
		border-radius:6px;margin-bottom:6px;flex-wrap:wrap;
	`;

	const info = document.createElement("div");
	info.style.cssText = "flex:1;min-width:0;";
	const t = document.createElement("div");
	t.style.cssText = "font-size:12px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
	t.textContent = title;
	const s = document.createElement("div");
	s.className = "ir-status";
	s.style.cssText = "font-size:11px;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
	s.textContent = subtitle;
	info.appendChild(t);
	info.appendChild(s);
	row.appendChild(info);

	const btns = document.createElement("div");
	btns.style.cssText = "display:flex;gap:6px;flex-shrink:0;";
	for (const action of actions) {
		const btn = document.createElement("button");
		btn.className = "ls-btn ls-btn-secondary ls-btn-sm";
		btn.textContent = action.label;
		btn.addEventListener("click", () => action.onClick(row, btn));
		btns.appendChild(btn);
	}
	row.appendChild(btns);
	return row;
}

async function _retryImportUrl(url, forceUpdate = false) {
	let tabId = null;
	try {
		const tab = await browser.tabs.create({ url, active: false });
		tabId = tab.id;
		await waitForTabComplete(tabId);
		const response = await sendAddToLibraryMessage(tabId);
		if (response.success) {
			await browser.tabs.remove(tabId).catch(() => {});
			return [true, null];
		}
		await browser.tabs.remove(tabId).catch(() => {});
		return [false, response.error || "Failed"];
	} catch (err) {
		if (tabId) await browser.tabs.remove(tabId).catch(() => {});
		return [false, err.message || "Error"];
	}
}

// forcedItems — items that skip the existence check (e.g. "update metadata" for already-saved novels).
// Each item must be: { url, originalUrl, novelId, shelfId }
async function addUrlsToLibrary(urls, onProgress = null, forcedItems = []) {
	const results = {
		total: urls.length + forcedItems.length,
		queued: 0,
		processed: 0,
		added: 0,
		continued: 0,
		skipped: 0,
		skippedExisting: 0,
		skippedDuplicates: 0,
		unsupported: 0,
		failed: 0,
		failedUrls: [],
		// Detailed lists for the results modal
		existingItems: [],
		duplicateItems: [],
		unsupportedItems: [],
	};

	const prepared = await novelLibrary.prepareUrlsForImport(urls);
	// Merge forcedItems directly into the queue (they bypass the existence check)
	const queue = [...(prepared.toImport || []), ...forcedItems];
	results.queued = queue.length;
	results.skippedExisting = prepared.skippedExisting || 0;
	results.skippedDuplicates = prepared.skippedDuplicates || 0;
	results.unsupported = prepared.unsupported || 0;
	results.skipped =
		results.skippedExisting +
		results.skippedDuplicates +
		results.unsupported;
	results.existingItems = prepared.existingItems || [];
	results.duplicateItems = prepared.duplicateItems || [];
	results.unsupportedItems = prepared.unsupportedItems || [];

	if (typeof onProgress === "function") {
		onProgress({ ...results, phase: "prepared" });
	}

	for (const item of queue) {
		let tabId = null;
		let shouldCloseTab = true;
		try {
			if (typeof onProgress === "function") {
				onProgress({
					...results,
					phase: "processing",
					currentUrl: item.originalUrl || item.url,
				});
			}

			const tab = await browser.tabs.create({
				url: item.originalUrl || item.url,
				active: false,
			});
			tabId = tab.id;
			await waitForTabComplete(tabId);
			const response = await sendAddToLibraryMessage(tabId);
			if (response.success) {
				results.added += 1;
				const lastReadChapter = Number(
					response?.novel?.lastReadChapter || 0,
				);
				const chapterHint = inferChapterHintFromUrl(
					item.originalUrl || item.url,
				);
				if (lastReadChapter > 0 || chapterHint > 0) {
					results.continued += 1;
				}
			} else {
				results.failed += 1;
				shouldCloseTab = false; // Keep failed tab open for user visibility/debugging.
				results.failedUrls.push({
					url: item.originalUrl || item.url,
					error: response.error || "Failed to add this URL",
				});
			}
		} catch (error) {
			results.failed += 1;
			shouldCloseTab = false;
			results.failedUrls.push({
				url: item.originalUrl || item.url,
				error: error?.message || "Unexpected import error",
			});
		} finally {
			results.processed += 1;
			if (typeof onProgress === "function") {
				onProgress({ ...results, phase: "processed" });
			}
			if (tabId !== null) {
				if (shouldCloseTab) {
					try {
						await browser.tabs.remove(tabId);
					} catch (_closeError) {
						// ignore close errors
					}
				}
			}
		}
	}

	return results;
}

function waitForTabComplete(tabId, timeoutMs = 30000) {
	return new Promise((resolve, reject) => {
		let timeoutId;
		const onUpdated = (updatedTabId, changeInfo) => {
			if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
			browser.tabs.onUpdated.removeListener(onUpdated);
			if (timeoutId) clearTimeout(timeoutId);
			resolve();
		};

		browser.tabs.onUpdated.addListener(onUpdated);
		timeoutId = setTimeout(() => {
			browser.tabs.onUpdated.removeListener(onUpdated);
			reject(new Error("Timed out waiting for tab to load (30 s)"));
		}, timeoutMs);
	});
}

async function sendAddToLibraryMessage(tabId) {
	// Give the content script time to fully inject and initialize.
	// Sites like NovelBin execute heavy JS after the "complete" event fires.
	await new Promise((r) => setTimeout(r, 2500));

	const maxAttempts = 6;
	let lastError = null;

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		try {
			const response = await browser.tabs.sendMessage(tabId, {
				action: "addToLibrary",
			});
			if (response?.success) {
				return { success: true, novel: response.novel || null };
			}
			if (response && response.success === false) {
				return {
					success: false,
					error: response.error || "Metadata extraction failed",
				};
			}
		} catch (err) {
			lastError = err;
		}
		// Exponential-ish back-off: 1.5 s → 2 s → 2.5 s …
		await new Promise((r) => setTimeout(r, 1500 + attempt * 500));
	}

	return {
		success: false,
		error: lastError?.message || "Content script did not respond after 6 attempts",
	};
}

// \u{2500}\u{2500} Legacy export / import / clear \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function handleExport() {
	try {
		const data = await browser.storage.local.get("novelHistory");
		const novels = data.novelHistory || [];
		const blob = new Blob([JSON.stringify(novels, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `ranobe-library-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
		showToast("\u{2705} Library exported", "success");
	} catch (err) {
		debugError("Export failed:", err);
		showToast("\u{274C} Export failed: " + err.message, "error");
	}
}

async function handleImport(e) {
	const file = e.target.files?.[0];
	if (!file) return;
	try {
		const text = await file.text();
		const novels = JSON.parse(text);
		if (!Array.isArray(novels)) throw new Error("Invalid format");
		const mode =
			document.querySelector('input[name="mergeMode"]:checked')?.value ||
			"merge";
		if (mode === "replace") {
			await browser.storage.local.set({ novelHistory: novels });
		} else {
			const existing =
				(await browser.storage.local.get("novelHistory"))
					.novelHistory || [];
			const map = new Map(existing.map((n) => [n.id, n]));
			novels.forEach((n) => {
				if (!map.has(n.id)) map.set(n.id, n);
			});
			await browser.storage.local.set({
				novelHistory: [...map.values()],
			});
		}
		showToast(
			`\u{2705} Imported ${novels.length} novels (${mode} mode)`,
			"success",
		);
	} catch (err) {
		debugError("Import failed:", err);
		showToast("\u{274C} Import failed: " + err.message, "error");
	}
	e.target.value = "";
}

async function handleClearLibrary() {
	if (!confirm("Clear all novels from your library? This cannot be undone."))
		return;
	try {
		await browser.storage.local.set({ novelHistory: [] });
		showToast("Library cleared", "info");
	} catch (err) {
		showToast("\u{274C} Failed to clear library: " + err.message, "error");
	}
}

// \u{2500}\u{2500} Google Drive handlers \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function handleConnectDrive() {
	const btn = $("connectDriveBtn");
	try {
		if (btn) {
			btn.disabled = true;
			btn.textContent = "\u{1F517} Connecting\u{2026}";
		}
		const saved = await browser.storage.local.get([
			"driveClientId",
			"driveClientSecret",
		]);
		const clientId =
			$("driveClientId")?.value.trim() ||
			saved.driveClientId ||
			DEFAULT_DRIVE_CLIENT_ID ||
			"";
		const clientSecret =
			$("driveClientSecret")?.value.trim() ||
			saved.driveClientSecret ||
			"";
		await browser.storage.local.set({
			driveClientId: clientId,
			driveClientSecret: clientSecret,
		});

		const response = await browser.runtime.sendMessage({
			action: "ensureDriveAuth",
		});
		if (response?.success) {
			const current = await browser.storage.local.get(["backupMode"]);
			await browser.storage.local.set({
				driveAutoRestoreEnabled: true,
				driveAutoRestoreMergeMode: "merge",
				backupMode: current.backupMode || "both",
			});
			showToast("\u{2705} Google Drive connected!", "success");
			await updateDriveUI();

			const syncResponse = await browser.runtime.sendMessage({
				action: "syncDriveNow",
				reason: "connect",
				force: true,
			});

			if (syncResponse?.success) {
				showToast("\u{2705} Synced existing Google Drive backup", "success");
			} else if (syncResponse?.skipped) {
				if (syncResponse.reason === "no-backup") {
					showToast(
						"\u{2139}\u{FE0F} Connected. No existing Drive backup found yet.",
						"info",
					);
					await browser.runtime.sendMessage({
						action: "uploadLibraryBackupToDrive",
						reason: "first-connect",
						variant: "versioned",
					});
				} else {
					showToast("\u{2139}\u{FE0F} Drive connected. Sync skipped.", "info");
				}
			}
		} else {
			throw new Error(response?.error || "Authentication failed");
		}
	} catch (err) {
		debugError("Connect Drive failed:", err);
		showToast(`\u{274C} Drive connect failed: ${err.message}`, "error");
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.textContent = "\u{1F517} Connect Google Drive";
		}
	}
}

async function handleDisconnectDrive() {
	if (!confirm("Disconnect Google Drive? Backups won't sync automatically."))
		return;
	try {
		await browser.storage.local.set({ driveAuthTokens: null });
		showToast("Disconnected from Google Drive", "success");
		await updateDriveUI();
	} catch (err) {
		debugError("Disconnect Drive failed:", err);
		showToast("\u{274C} Failed to disconnect: " + err.message, "error");
	}
}

// \u{2500}\u{2500} Copy Format Tab \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function initCopyFormatTab() {
	// \u{2500}\u{2500} Helpers \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
	function escHtml(str) {
		return String(str ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	// Load current settings
	const settings = await novelLibrary.getSettings();
	const fmt = settings.novelCopyFormats || {};
	// Unified export format
	const exportTemplate = fmt.exportTemplate || DEFAULT_EXPORT_TEMPLATE;

	// \u{2500}\u{2500} Load real library novels for live preview \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
	let previewNovel = PREVIEW_NOVEL; // fallback if library is empty

	try {
		const allNovels = await novelLibrary.getNovels();
		if (allNovels.length > 0) {
			const sorted = [...allNovels].sort((a, b) => {
				const da = a.lastAccessedAt || a.addedAt || 0;
				const db = b.lastAccessedAt || b.addedAt || 0;
				return db - da;
			});
			previewNovel = sorted[0];
		}
	} catch (_err) {
		// silently fall back to PREVIEW_NOVEL
	}

	// \u{2500}\u{2500} Unified Export template \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
	const exportTplInput = $("copy-export-template");

	// Populate export template input
	if (exportTplInput) exportTplInput.value = exportTemplate;

	function updateExportPreview() {
		const previewEl = $("copy-export-preview");
		if (!previewEl) return;
		const template =
			exportTplInput?.value?.trim() || DEFAULT_EXPORT_TEMPLATE;
		previewEl.textContent = formatExportFilename(previewNovel, template);
	}

	// Export token chips
	const exportTokensGrid = $("copy-export-tokens-grid");
	if (exportTokensGrid) {
		exportTokensGrid.innerHTML = EXPORT_TOKENS.map(
			(t) =>
				`<button type="button" class="ls-btn ls-btn-sm ls-btn-secondary${t.recommended ? " ls-btn-accent" : ""}" data-export-token="${escHtml(t.token)}" title="${escHtml(t.desc)} \u{2014} e.g. ${escHtml(t.example)}" style="font-family:monospace;">${escHtml(t.token)}</button>`,
		).join("");
		exportTokensGrid
			.querySelectorAll("button[data-export-token]")
			.forEach((btn) => {
				btn.addEventListener("click", () => {
					if (!exportTplInput) return;
					const token = btn.dataset.exportToken;
					const start =
						exportTplInput.selectionStart ??
						exportTplInput.value.length;
					const end =
						exportTplInput.selectionEnd ??
						exportTplInput.value.length;
					exportTplInput.value =
						exportTplInput.value.slice(0, start) +
						token +
						exportTplInput.value.slice(end);
					exportTplInput.focus();
					exportTplInput.selectionStart =
						exportTplInput.selectionEnd = start + token.length;
					updateExportPreview();
				});
			});
	}

	if (exportTplInput) {
		exportTplInput.addEventListener("input", updateExportPreview);
		updateExportPreview();
	}

	// Save button
	const saveBtn = $("copy-format-save-btn");
	if (saveBtn) {
		saveBtn.addEventListener("click", async () => {
			try {
				const current = await novelLibrary.getSettings();
				const newExportTemplate =
					exportTplInput?.value?.trim() || DEFAULT_EXPORT_TEMPLATE;

				// Collect per-site overrides from the dynamic inputs
				const newSiteOverrides = {};
				document
					.querySelectorAll("[data-site-tpl-shelf]")
					.forEach((input) => {
						const shelfId = input.dataset.siteTplShelf;
						const val = input.value.trim();
						if (val) newSiteOverrides[shelfId] = val;
					});

				await novelLibrary.saveSettings({
					...current,
					novelCopyFormats: {
						...(current.novelCopyFormats || {}),
						exportTemplate: newExportTemplate,
						exportSiteOverrides: newSiteOverrides,
					},
				});
				showToast("\u{2705} Copy format saved!", "success");
			} catch (err) {
				showToast("\u{274C} Failed to save: " + err.message, "error");
			}
		});
	}

	// \u{2500}\u{2500} Per-site overrides section \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
	const siteOverridesSection = $("copy-site-overrides-section");
	const siteOverridesList = $("copy-site-overrides-list");
	if (siteOverridesSection && siteOverridesList) {
		const enabledShelves = filterEnabledShelves(siteSettings);
		if (enabledShelves.length > 0) {
			siteOverridesSection.style.display = "";
			const currentOverrides = fmt.exportSiteOverrides || {};

			siteOverridesList.innerHTML = enabledShelves
				.map((shelf) => {
					const savedVal = currentOverrides[shelf.id] || "";
					const siteDefault =
						shelf.defaultExportTemplate || DEFAULT_EXPORT_TEMPLATE;
					const placeholder = `Leave blank to use global template (site default: ${siteDefault})`;
					return `<div class="ls-form-group" style="margin-bottom:14px;">
						<label class="ls-label" style="display:flex;align-items:center;gap:6px;">
							<span>${shelf.emoji || "\u{1F310}"}</span>
							<span>${escHtml(shelf.name)}</span>
						</label>
						<input
							type="text"
							class="ls-input"
							data-site-tpl-shelf="${escHtml(shelf.id)}"
							value="${escHtml(savedVal)}"
							placeholder="${escHtml(placeholder)}"
						/>
					</div>`;
				})
				.join("");
		}
	}
}

// \u{2500}\u{2500} Event Listeners \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
function setupEventListeners() {
	// \u{2500}\u{2500} Theme \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	// Sync color pickers <\u{2192} text inputs
	[
		["library-accentColorPicker", "library-accentColorText"],
		["library-accentSecondaryPicker", "library-accentSecondaryText"],
		["library-backgroundColorPicker", "library-backgroundColorText"],
		["library-bgSecondaryPicker", "library-bgSecondaryText"],
		["library-bgTertiaryPicker", "library-bgTertiaryText"],
		["library-textColorPicker", "library-textColorText"],
	].forEach(([pickId, textId]) => {
		const pick = $(pickId);
		const text = $(textId);
		if (!pick || !text) return;
		pick.addEventListener("input", () => {
			text.value = pick.value;
			setThemeVariables(readCurrentThemeFromUI());
		});
		text.addEventListener("input", () => {
			if (/^#[0-9a-fA-F]{6}$/.test(text.value)) {
				pick.value = text.value;
				setThemeVariables(readCurrentThemeFromUI());
			}
		});
	});

	// Mode pill buttons \u{2014} update hidden select, sync pills, auto-adjust colors
	document.querySelectorAll(".ls-mode-pill").forEach((btn) => {
		btn.addEventListener("click", () => {
			const mode = btn.dataset.mode;
			const modeSelect = $("library-theme-mode");
			if (modeSelect) modeSelect.value = mode;
			syncModePills(mode);
			syncAutoPanel(mode);
			// Auto-adjust all color pickers to the preset values for this mode
			const effectiveMode = resolveMode(mode);
			const basePresetId =
				$("library-theme-preset")?.dataset?.basePreset ||
				$("library-theme-preset")?.value ||
				"material-dark";
			const builtIn =
				THEME_PRESETS[basePresetId] || THEME_PRESETS["material-dark"];
			const palette = builtIn[effectiveMode] || builtIn.dark || {};
			// Background
			const newBg = palette["bg-primary"] || defaultTheme.bgColor;
			const bgPicker = $("library-backgroundColorPicker");
			const bgText = $("library-backgroundColorText");
			if (bgPicker) bgPicker.value = newBg;
			if (bgText) bgText.value = newBg;
			// Reset secondary/tertiary to auto-derive
			const bgsPicker = $("library-bgSecondaryPicker");
			const bgsText = $("library-bgSecondaryText");
			if (bgsPicker) bgsPicker.value = newBg;
			if (bgsText) bgsText.value = newBg;
			const bgtPicker = $("library-bgTertiaryPicker");
			const bgtText = $("library-bgTertiaryText");
			if (bgtPicker) bgtPicker.value = newBg;
			if (bgtText) bgtText.value = newBg;
			// Accent
			const newAccent =
				palette["primary-color"] || defaultTheme.accentPrimary;
			const apPicker = $("library-accentColorPicker");
			const apText = $("library-accentColorText");
			if (apPicker) apPicker.value = newAccent;
			if (apText) apText.value = newAccent;
			const newAccent2 =
				palette["primary-hover"] || defaultTheme.accentSecondary;
			const asPicker = $("library-accentSecondaryPicker");
			const asText = $("library-accentSecondaryText");
			if (asPicker) asPicker.value = newAccent2;
			if (asText) asText.value = newAccent2;
			// Text
			const newTextColor =
				palette["text-primary"] ||
				(effectiveMode === "light" ? "#111827" : "#e5e7eb");
			const txPicker = $("library-textColorPicker");
			const txText = $("library-textColorText");
			if (txPicker) txPicker.value = newTextColor;
			if (txText) txText.value = newTextColor;
			setThemeVariables(readCurrentThemeFromUI());
		});
	});

	// AI Provider Shortcuts (CSP compliant)
	const goToAiBtn = $("go-to-ai-providers");
	if (goToAiBtn) {
		goToAiBtn.addEventListener("click", () => activateTab("ai-providers"));
	}

	function readCurrentThemeFromUI() {
		const bgPrimary =
			$("library-backgroundColorPicker")?.value || defaultTheme.bgColor;
		const bgSecondaryVal = $("library-bgSecondaryPicker")?.value || "";
		const bgTertiaryVal = $("library-bgTertiaryPicker")?.value || "";
		const selectedPreset =
			$("library-theme-preset")?.value || "material-dark";
		// basePreset is tagged on the <select> element when a custom preset is
		// loaded, so palette lookups always resolve to a real THEME_PRESETS key.
		const basePreset = $("library-theme-preset")?.dataset?.basePreset || "";
		// Auto-behavior
		const autoBehaviorEl = document.querySelector(
			'input[name="ls-auto-behavior"]:checked',
		);
		return {
			mode: $("library-theme-mode")?.value || "dark",
			preset: selectedPreset,
			basePreset,
			accentPrimary:
				$("library-accentColorPicker")?.value ||
				defaultTheme.accentPrimary,
			accentSecondary:
				$("library-accentSecondaryPicker")?.value ||
				defaultTheme.accentSecondary,
			bgColor: bgPrimary,
			bgSecondary: bgSecondaryVal !== bgPrimary ? bgSecondaryVal : "",
			bgTertiary: bgTertiaryVal !== bgPrimary ? bgTertiaryVal : "",
			textColor:
				$("library-textColorPicker")?.value || defaultTheme.textColor,
			autoBehavior: autoBehaviorEl?.value || "system",
			timeCustomStart: $("ls-auto-time-start")?.value || "06:00",
			timeCustomEnd: $("ls-auto-time-end")?.value || "18:00",
		};
	}

	// Auto-behavior radio buttons
	document
		.querySelectorAll('input[name="ls-auto-behavior"]')
		.forEach((radio) => {
			radio.addEventListener("change", () => {
				const grid = $("ls-schedule-inputs");
				if (grid)
					grid.style.display =
						radio.value === "schedule" ? "" : "none";
				// For sun/schedule: sync all color pickers to the effective
				// mode's palette so dark-mode picker values don't override
				// the resolved light palette.
				if (radio.value === "sun" || radio.value === "schedule") {
					const partialTheme = readCurrentThemeFromUI();
					partialTheme.autoBehavior = radio.value;
					const effectiveMode = resolveMode("auto", partialTheme);
					const bpId =
						partialTheme.basePreset ||
						partialTheme.preset ||
						"material-dark";
					const pal =
						(THEME_PRESETS[bpId] || THEME_PRESETS["material-dark"])[
							effectiveMode
						] || THEME_PRESETS["material-dark"].dark;
					const newBg = pal["bg-primary"] || defaultTheme.bgColor;
					// Bg
					[
						"library-backgroundColorPicker",
						"library-backgroundColorText",
					].forEach((id) => {
						const el = $(id);
						if (el) el.value = newBg;
					});
					// Reset secondary/tertiary to auto-derive
					[
						"library-bgSecondaryPicker",
						"library-bgSecondaryText",
						"library-bgTertiaryPicker",
						"library-bgTertiaryText",
					].forEach((id) => {
						const el = $(id);
						if (el) el.value = newBg;
					});
					// Accent
					const newAcc =
						pal["primary-color"] || defaultTheme.accentPrimary;
					[
						"library-accentColorPicker",
						"library-accentColorText",
					].forEach((id) => {
						const el = $(id);
						if (el) el.value = newAcc;
					});
					const newAcc2 =
						pal["primary-hover"] || defaultTheme.accentSecondary;
					[
						"library-accentSecondaryPicker",
						"library-accentSecondaryText",
					].forEach((id) => {
						const el = $(id);
						if (el) el.value = newAcc2;
					});
					// Text
					const newTx =
						pal["text-primary"] ||
						(effectiveMode === "light" ? "#111827" : "#e5e7eb");
					[
						"library-textColorPicker",
						"library-textColorText",
					].forEach((id) => {
						const el = $(id);
						if (el) el.value = newTx;
					});
				}
				setThemeVariables(readCurrentThemeFromUI());
			});
		});

	// Auto schedule time inputs \u{2014} use both change and input for responsiveness
	[$("ls-auto-time-start"), $("ls-auto-time-end")].forEach((el) => {
		el?.addEventListener("change", () =>
			setThemeVariables(readCurrentThemeFromUI()),
		);
		el?.addEventListener("input", () =>
			setThemeVariables(readCurrentThemeFromUI()),
		);
	});

	// Save Theme button
	const saveThemeBtn = $("library-save-theme");
	if (saveThemeBtn) {
		saveThemeBtn.addEventListener("click", async () => {
			try {
				const result = await browser.storage.local.get("themeSettings");
				const current = result.themeSettings || { ...defaultTheme };
				const themeSettings = {
					...readCurrentThemeFromUI(),
					customPresets: current.customPresets || {},
				};
				await browser.storage.local.set({ themeSettings });
				setThemeVariables(themeSettings);
				showToast("\u{2705} Theme saved!", "success");
			} catch (err) {
				showToast("\u{274C} Failed to save theme: " + err.message, "error");
			}
		});
	}

	// Background secondary/tertiary reset buttons (reset to auto-derive)
	$("library-bgSecondaryReset")?.addEventListener("click", () => {
		const primary =
			$("library-backgroundColorPicker")?.value || defaultTheme.bgColor;
		const picker = $("library-bgSecondaryPicker");
		const text = $("library-bgSecondaryText");
		if (picker) picker.value = primary;
		if (text) text.value = primary;
		setThemeVariables(readCurrentThemeFromUI());
	});
	$("library-bgTertiaryReset")?.addEventListener("click", () => {
		const primary =
			$("library-backgroundColorPicker")?.value || defaultTheme.bgColor;
		const picker = $("library-bgTertiaryPicker");
		const text = $("library-bgTertiaryText");
		if (picker) picker.value = primary;
		if (text) text.value = primary;
		setThemeVariables(readCurrentThemeFromUI());
	});

	// Save Custom Preset button
	const saveCustomPresetBtn = $("library-save-custom-preset");
	if (saveCustomPresetBtn) {
		saveCustomPresetBtn.addEventListener("click", async () => {
			try {
				const nameInput = $("library-custom-preset-name");
				const name = nameInput?.value?.trim();
				if (!name) {
					showToast(
						"\u{26A0}\u{FE0F} Enter a name for the custom preset",
						"warning",
					);
					nameInput?.focus();
					return;
				}
				const presetId =
					"custom-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
				const result = await browser.storage.local.get("themeSettings");
				const current = result.themeSettings || { ...defaultTheme };
				const uiTheme = readCurrentThemeFromUI();
				// basePreset must always be a real THEME_PRESETS key, never custom-* id
				const basePreset =
					uiTheme.basePreset || uiTheme.preset || "material-dark";
				const newPreset = {
					name,
					emoji: "\u{1F3A8}",
					accentPrimary: uiTheme.accentPrimary,
					accentSecondary: uiTheme.accentSecondary,
					bgColor: uiTheme.bgColor,
					bgSecondary: uiTheme.bgSecondary,
					bgTertiary: uiTheme.bgTertiary,
					textColor: uiTheme.textColor,
					bgAnimation: uiTheme.bgAnimation || "none",
					basePreset,
					mode: uiTheme.mode,
				};
				const updatedSettings = {
					...current,
					preset: presetId,
					basePreset,
					customPresets: {
						...(current.customPresets || {}),
						[presetId]: newPreset,
					},
				};
				await browser.storage.local.set({
					themeSettings: updatedSettings,
				});
				if (nameInput) nameInput.value = "";
				// Reload controls \u{2014} dropdown now shows the new preset selected
				await loadLibraryThemeControls();
				showToast(`\u{2705} Custom preset "${name}" saved!`, "success");
			} catch (err) {
				showToast("\u{274C} Failed to save preset: " + err.message, "error");
			}
		});
	}

	// Delete Custom Preset button
	const deletePresetBtn = $("library-delete-custom-preset");
	if (deletePresetBtn) {
		deletePresetBtn.addEventListener("click", async () => {
			try {
				const result = await browser.storage.local.get("themeSettings");
				const current = result.themeSettings || { ...defaultTheme };
				const selectedId = $("library-theme-preset")?.value;
				if (!selectedId || !(current.customPresets || {})[selectedId]) {
					showToast("\u{26A0}\u{FE0F} Select a custom preset to delete", "warning");
					return;
				}
				const presetName =
					current.customPresets[selectedId]?.name || selectedId;
				if (!confirm(`Delete custom preset "${presetName}"?`)) return;
				const { [selectedId]: _removed, ...remaining } =
					current.customPresets;
				const updated = {
					...current,
					preset: "material-dark",
					basePreset: "",
					customPresets: remaining,
				};
				await browser.storage.local.set({ themeSettings: updated });
				await loadLibraryThemeControls();
				showToast(`Preset "${presetName}" deleted`, "info");
			} catch (err) {
				showToast(
					"\u{274C} Failed to delete preset: " + err.message,
					"error",
				);
			}
		});
	}

	// Reset Theme button \u{2014} resets colours+mode but keeps custom presets
	const resetThemeBtn = $("library-reset-theme");
	if (resetThemeBtn) {
		resetThemeBtn.addEventListener("click", async () => {
			if (!confirm("Reset theme to defaults? Custom presets are kept."))
				return;
			const result = await browser.storage.local.get("themeSettings");
			const current = result.themeSettings || {};
			const reset = {
				...defaultTheme,
				customPresets: current.customPresets || {},
			};
			await browser.storage.local.set({ themeSettings: reset });
			await loadLibraryThemeControls();
			setThemeVariables(reset);
			showToast("Theme reset to defaults (custom presets kept)", "info");
		});
	}

	// Font size slider
	const fsSl = $("library-font-size-slider");
	const fsVl = $("library-font-size-value");
	if (fsSl) {
		fsSl.addEventListener("input", async () => {
			const size = parseInt(fsSl.value, 10);
			if (fsVl) fsVl.textContent = `${size}%`;
			updateSliderFill(fsSl);
			await browser.storage.local.set({ fontSize: size });
		});
	}

	// Hidden mode <select> change \u{2014} kept for backward compat; pills also fire this
	const themeMode = $("library-theme-mode");
	if (themeMode) {
		themeMode.addEventListener("change", () => {
			syncModePills(themeMode.value);
			setThemeVariables(readCurrentThemeFromUI());
		});
	}

	// Theme preset skin change \u{2014} live-preview + auto-save
	const presetSelect = $("library-theme-preset");
	if (presetSelect) {
		presetSelect.addEventListener("change", async () => {
			try {
				const result = await browser.storage.local.get("themeSettings");
				const current = result.themeSettings || { ...defaultTheme };
				const selectedId = presetSelect.value;
				const customPresets = current.customPresets || {};

				let newSettings;
				if (customPresets[selectedId]) {
					// Custom preset: keep selectedId as preset so the dropdown
					// stays correct after reload; store basePreset separately.
					const cp = customPresets[selectedId];
					newSettings = {
						...current,
						preset: selectedId,
						basePreset: cp.basePreset || "material-dark",
						mode: cp.mode || current.mode,
						accentPrimary:
							cp.accentPrimary || current.accentPrimary,
						accentSecondary:
							cp.accentSecondary || current.accentSecondary,
						bgColor: cp.bgColor || current.bgColor,
						bgSecondary: cp.bgSecondary || "",
						bgTertiary: cp.bgTertiary || "",
						textColor: cp.textColor || current.textColor,
						bgAnimation: cp.bgAnimation || "none",
					};
					// Tag the select element so readCurrentThemeFromUI picks up basePreset
					const ps = $("library-theme-preset");
					if (ps) ps.dataset.basePreset = newSettings.basePreset;
				} else {
					// Built-in preset: load preset's default colors into settings.
					// If the preset declares a preferred mode (defaultMode), honour it.
					const builtInPreset = THEME_PRESETS[selectedId];
					const declaredMode = builtInPreset?.meta?.defaultMode;
					const modeToUse = declaredMode || current.mode || "dark";
					if (declaredMode && declaredMode !== current.mode) {
						// Silently switch mode so light presets feel correct
						const modeSelect = $("library-theme-mode");
						if (modeSelect) modeSelect.value = declaredMode;
						syncModePills(declaredMode);
						syncAutoPanel(declaredMode, current);
					}
					const effectiveMode = resolveMode(modeToUse);
					const palette =
						builtInPreset?.[effectiveMode] ||
						builtInPreset?.dark ||
						{};
					const animation = builtInPreset?.meta?.animation || "none";
					newSettings = {
						...current,
						preset: selectedId,
						basePreset: "",
						mode: declaredMode || current.mode || "dark",
						// Load preset colors so pickers show the actual values
						accentPrimary:
							palette["primary-color"] ||
							defaultTheme.accentPrimary,
						accentSecondary:
							palette["primary-hover"] ||
							defaultTheme.accentSecondary,
						bgColor: palette["bg-primary"] || defaultTheme.bgColor,
						bgSecondary: "", // Clear overrides \u{2014} let preset defaults apply
						bgTertiary: "",
						textColor:
							palette["text-primary"] || defaultTheme.textColor,
						bgAnimation: animation,
					};
					const ps = $("library-theme-preset");
					if (ps) ps.dataset.basePreset = "";
				}
				await browser.storage.local.set({ themeSettings: newSettings });
				setThemeVariables(newSettings);
				// Reload pickers so colors reflect the chosen preset
				await loadLibraryThemeControls();
				updateDeletePresetBtn(
					selectedId,
					newSettings.customPresets || {},
				);
				showToast(
					`Theme changed to ${presetSelect.selectedOptions[0]?.text || selectedId}`,
					"success",
				);
			} catch (err) {
				debugError("Failed to change theme preset:", err);
			}
		});
	}

	// \u{2500}\u{2500} AI Model \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	// Test API Key
	const testKeyBtn = $("library-test-api-key");
	if (testKeyBtn) {
		testKeyBtn.addEventListener("click", async () => {
			const key = libraryApiKeys[0] || "";
			if (!key) {
				showToast("\u{26A0}\u{FE0F} Add an API key first", "error");
				return;
			}
			testKeyBtn.disabled = true;
			testKeyBtn.textContent = "Testing\u{2026}";
			try {
				const models = await fetchLibraryModels(key);
				if (models && models.length > 0) {
					showToast(
						`\u{2705} API key valid \u{2014} ${models.length} models available`,
						"success",
					);
				} else {
					showToast("\u{26A0}\u{FE0F} Key accepted but no models found", "error");
				}
			} catch (err) {
				showToast("\u{274C} API key test failed: " + err.message, "error");
			} finally {
				testKeyBtn.disabled = false;
				testKeyBtn.textContent = "Test";
			}
		});
	}

	// Refresh models — Gemini primary
	const refreshModelsBtn = $("library-refresh-models");
	if (refreshModelsBtn) {
		refreshModelsBtn.addEventListener("click", async () => {
			const key = libraryApiKeys[0] || "";
			if (!key) {
				showToast("\u{26A0}\u{FE0F} Add an API key first", "error");
				return;
			}
			refreshModelsBtn.disabled = true;
			refreshModelsBtn.textContent = "\u{21BB} Loading\u{2026}";
			await updateLibraryModelSelector(key);
			refreshModelsBtn.disabled = false;
			refreshModelsBtn.textContent = "\u{21BB} Refresh";
			showToast("\u{2705} Models refreshed", "success");
		});
	}

	// Refresh models — Gemini fallback
	const fallbackRefreshBtn = $("fallback-refresh-models");
	if (fallbackRefreshBtn) {
		fallbackRefreshBtn.addEventListener("click", async () => {
			const key = libraryApiKeys[0] || "";
			if (!key) { showToast("Add a Gemini API key first", "error"); return; }
			fallbackRefreshBtn.disabled = true;
			fallbackRefreshBtn.textContent = "↻ Loading…";
			await updateLibraryModelSelector(key, "fallback");
			fallbackRefreshBtn.disabled = false;
			fallbackRefreshBtn.textContent = "↻ Refresh";
		});
	}

	// Refresh models — Primary OpenAI-compatible
	const poRefreshBtn = $("primary-openai-refresh-models");
	if (poRefreshBtn) {
		poRefreshBtn.addEventListener("click", async () => {
			const baseUrl = $("primary-openai-base-url")?.value?.trim();
			const apiKey = $("primary-openai-key")?.value?.trim();
			poRefreshBtn.disabled = true;
			poRefreshBtn.textContent = "↻ Loading…";
			const models = await fetchOpenAIModels(baseUrl, apiKey);
			const sel = $("primary-openai-model");
			const custom = $("primary-openai-model-custom");
			if (sel) {
				const saved = custom?.value?.trim() || sel.value;
				populateModelSelect(sel, models, saved);
			}
			poRefreshBtn.disabled = false;
			poRefreshBtn.textContent = "↻ Models";
			showToast(models.length ? `${models.length} models loaded` : "No models found — check URL and key", models.length ? "success" : "error");
		});
	}

	// Refresh models — Primary Ollama
	const poOllamaRefreshBtn = $("primary-ollama-refresh-models");
	if (poOllamaRefreshBtn) {
		poOllamaRefreshBtn.addEventListener("click", async () => {
			const baseUrl = $("primary-ollama-url")?.value?.trim() || "http://localhost:11434";
			poOllamaRefreshBtn.disabled = true;
			poOllamaRefreshBtn.textContent = "↻ Loading…";
			const models = await fetchOllamaModels(baseUrl);
			const sel = $("primary-ollama-model");
			if (sel) populateModelSelect(sel, models, sel.value);
			poOllamaRefreshBtn.disabled = false;
			poOllamaRefreshBtn.textContent = "↻ Models";
			showToast(models.length ? `${models.length} Ollama models found` : "No models — is Ollama running?", models.length ? "success" : "error");
		});
	}

	// Refresh models — Fallback OpenAI-compatible
	const foRefreshBtn = $("fallback-openai-refresh-models");
	if (foRefreshBtn) {
		foRefreshBtn.addEventListener("click", async () => {
			const baseUrl = $("fallback-openai-base-url")?.value?.trim();
			const apiKey = $("fallback-openai-key")?.value?.trim();
			foRefreshBtn.disabled = true;
			foRefreshBtn.textContent = "↻ Loading…";
			const models = await fetchOpenAIModels(baseUrl, apiKey);
			const sel = $("fallback-openai-model");
			const custom = $("fallback-openai-model-custom");
			if (sel) {
				const saved = custom?.value?.trim() || sel.value;
				populateModelSelect(sel, models, saved);
			}
			foRefreshBtn.disabled = false;
			foRefreshBtn.textContent = "↻ Models";
			showToast(models.length ? `${models.length} models loaded` : "No models found", models.length ? "success" : "error");
		});
	}

	// Refresh models — Fallback Ollama
	const foOllamaRefreshBtn = $("fallback-ollama-refresh-models");
	if (foOllamaRefreshBtn) {
		foOllamaRefreshBtn.addEventListener("click", async () => {
			const baseUrl = $("fallback-ollama-url")?.value?.trim() || "http://localhost:11434";
			foOllamaRefreshBtn.disabled = true;
			foOllamaRefreshBtn.textContent = "↻ Loading…";
			const models = await fetchOllamaModels(baseUrl);
			const sel = $("fallback-ollama-model");
			if (sel) populateModelSelect(sel, models, sel.value);
			foOllamaRefreshBtn.disabled = false;
			foOllamaRefreshBtn.textContent = "↻ Models";
			showToast(models.length ? `${models.length} Ollama models found` : "No models — is Ollama running?", models.length ? "success" : "error");
		});
	}

	// Model select change
	const modelSel = $("library-model-select");
	if (modelSel) {
		modelSel.addEventListener("change", async () => {
			const selectedId = modelSel.value;
			const stored = await browser.storage.local.get("availableModels");
			const match = stored.availableModels?.find(
				(m) => m.id === selectedId,
			);
			const baseEndpoint = DEFAULT_MODEL_ENDPOINT.replace(/\/[^/]+:generateContent$/, "");
			const endpoint =
				match?.endpoint ||
				(selectedId ? `${baseEndpoint}/${selectedId}:generateContent` : "");
			setLibraryModelEndpoint(endpoint);
			await browser.storage.local.set({
				selectedModelId: selectedId,
				modelEndpoint: endpoint,
			});
		});
	}

	// Copy model endpoint
	const copyEpBtn = $("library-copy-model-endpoint");
	if (copyEpBtn) {
		copyEpBtn.addEventListener("click", async () => {
			const endpoint = $("library-model-endpoint")?.value;
			if (endpoint) {
				await navigator.clipboard.writeText(endpoint).catch(() => {});
				showToast("\u{1F4CB} Endpoint copied!", "success");
			}
		});
	}

	// Temperature slider
	const tempSl = $("library-temperature-slider");
	const tempVl = $("library-temperature-value");
	if (tempSl) {
		tempSl.addEventListener("input", async () => {
			const v = parseFloat(tempSl.value);
			if (tempVl) tempVl.textContent = v.toFixed(1);
			updateSliderFill(tempSl);
			await browser.storage.local.set({ customTemperature: v });
		});
	}

	// \u{2500}\u{2500} API Keys (Unified) \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const addKeyBtn = $("library-add-api-key");
	if (addKeyBtn) {
		addKeyBtn.addEventListener("click", async () => {
			const newKey = $("library-new-api-key")?.value?.trim();
			if (!newKey) {
				showToast("\u{26A0}\u{FE0F} Enter a key first", "error");
				return;
			}
			libraryApiKeys.push(newKey);
			await browser.storage.local.set({
				apiKey: libraryApiKeys[0] || "",
				backupApiKeys: libraryApiKeys.slice(1),
			});
			if (libraryApiKeys.length === 1) {
				await updateLibraryModelSelector(newKey);
			}
			const inp = $("library-new-api-key");
			if (inp) inp.value = "";
			renderLibraryApiKeys();
			showToast("\u{2705} API key added", "success");
		});
	}

	const rotSel = $("library-api-key-rotation");
	if (rotSel) {
		rotSel.addEventListener("change", async () => {
			await browser.storage.local.set({ apiKeyRotation: rotSel.value });
		});
	}

	// \u{2500}\u{2500} Save AI Settings (AI Providers panel header action) \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
	const saveAiBtn = $("library-save-ai-settings");
	if (saveAiBtn) {
		saveAiBtn.addEventListener("click", async () => {
			try {
				const tempSlider = $("library-temperature-slider");
				const updates = {};

				// Temperature (shared)
				if (tempSlider) updates.customTemperature = parseFloat(tempSlider.value);

				// \u{2500}\u{2500} Primary slot \u{2500}\u{2500}
				const primaryProvider = $("primary-provider-select")?.value ?? "gemini";
				let primaryConfig = { provider: primaryProvider };
				if (primaryProvider === "gemini") {
					const sel = $("library-model-select");
					const ep = $("library-model-endpoint");
					primaryConfig.modelId = sel?.value ?? "gemini-2.5-flash";
					primaryConfig.endpoint = ep?.value || `https://generativelanguage.googleapis.com/v1beta/models/${primaryConfig.modelId}:generateContent`;
					// Keep legacy keys in sync for existing code
					updates.selectedModelId = primaryConfig.modelId;
					updates.modelEndpoint = primaryConfig.endpoint;
				} else if (primaryProvider === "openai") {
					primaryConfig.baseUrl = $("primary-openai-base-url")?.value ?? "";
					// Prefer select; fall back to custom text input
					primaryConfig.modelId = $("primary-openai-model")?.value || $("primary-openai-model-custom")?.value || "";
					primaryConfig.apiKey = $("primary-openai-key")?.value ?? "";
				} else if (primaryProvider === "ollama") {
					primaryConfig.baseUrl = $("primary-ollama-url")?.value ?? "http://localhost:11434";
					primaryConfig.modelId = $("primary-ollama-model")?.value ?? "";
				}
				updates.primaryModelConfig = primaryConfig;

				// \u{2500}\u{2500} Fallback slot \u{2500}\u{2500}
				const fallbackEnabled = $("fallback-model-enabled")?.checked ?? false;
				updates.fallbackModelEnabled = fallbackEnabled;
				if (fallbackEnabled) {
					const fallbackProvider = $("fallback-provider-select")?.value ?? "gemini";
					let fallbackConfig = { provider: fallbackProvider };
					if (fallbackProvider === "gemini") {
						fallbackConfig.modelId = $("fallback-gemini-model")?.value ?? "gemini-2.0-flash";
						// Keep legacy backupModelId in sync
						updates.backupModelId = fallbackConfig.modelId;
					} else if (fallbackProvider === "openai") {
						fallbackConfig.baseUrl = $("fallback-openai-base-url")?.value ?? "";
						fallbackConfig.modelId = $("fallback-openai-model")?.value || $("fallback-openai-model-custom")?.value || "";
						fallbackConfig.apiKey = $("fallback-openai-key")?.value ?? "";
					} else if (fallbackProvider === "ollama") {
						fallbackConfig.baseUrl = $("fallback-ollama-url")?.value ?? "http://localhost:11434";
						fallbackConfig.modelId = $("fallback-ollama-model")?.value ?? "";
					}

					// Validate: fallback model must differ from primary model
					const sameProvider = fallbackConfig.provider === (primaryConfig.provider || "gemini");
					const sameModel = sameProvider && fallbackConfig.modelId && fallbackConfig.modelId === primaryConfig.modelId;
					if (sameModel) {
						showToast("\u{26A0}\u{FE0F} Fallback model must differ from the primary model.", "warning");
						return;
					}

					updates.fallbackModelConfig = fallbackConfig;
				} else {
					updates.fallbackModelConfig = null;
				}

				await browser.storage.local.set(updates);
				showToast("\u{2705} AI settings saved!", "success");
			} catch (err) {
				showToast("\u{274C} Failed to save: " + err.message, "error");
			}
		});
	}

	// \u{2500}\u{2500} Popup Defaults \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const popupDefaultSort = $("popup-default-sort");
	if (popupDefaultSort) {
		browser.storage.local.get("novelLibrarySort").then((res) => {
			popupDefaultSort.value = res.novelLibrarySort || "recent";
		});
		popupDefaultSort.addEventListener("change", () => {
			browser.storage.local.set({ novelLibrarySort: popupDefaultSort.value });
		});
	}

	// \u{2500}\u{2500} URL Import \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const urlImportBtn = $("url-import-btn");
	const urlImportText = $("url-import-text");
	const urlImportStatus = $("url-import-status");

	if (urlImportBtn && urlImportText) {
		urlImportBtn.addEventListener("click", async () => {
			const raw = urlImportText.value || "";
			const extracted = extractUrlsFromText(raw);

			if (!extracted.length) {
				showToast("\u{274C} No URLs found in the text.", "error");
				if (urlImportStatus) urlImportStatus.textContent = "No URLs found.";
				return;
			}

			// Classify before any tab is opened (fast path)
			if (urlImportStatus) urlImportStatus.textContent = "Analysing URLs\u{2026}";
			urlImportBtn.disabled = true;
			urlImportBtn.textContent = "\u{23F3} Analysing\u{2026}";

			try {
				const supported = filterSupportedUrls(extracted);
				// All extracted URLs that didn't pass filterSupportedUrls
				const supportedSet = new Set(supported);
				const unsupportedFromFilter = extracted.filter((u) => !supportedSet.has(u));

				// Deep classify the supported ones
				const prepared = await novelLibrary.prepareUrlsForImport(supported);

				// Collect ALL invalid URLs: failed domain filter + failed identity extraction
				const invalidUrls = [
					...unsupportedFromFilter,
					...(prepared.unsupportedItems || []).map((i) => i.url).filter(Boolean),
				];

				if (urlImportStatus) urlImportStatus.textContent = "Ready.";
				urlImportBtn.disabled = false;
				urlImportBtn.textContent = "\u{2795} Add URLs to Library";

				showImportPreviewModal({
					prepared,
					invalidUrls,
					totalExtracted: extracted.length,
					onConfirm: async ({ toImport, forcedUpdateItems, correctedUrls, modalEl }) => {
						await _runImport({
							toImport,
							forcedUpdateItems,
							correctedUrls,
							modalEl,
							urlImportStatus,
						});
					},
				});
			} catch (err) {
				urlImportBtn.disabled = false;
				urlImportBtn.textContent = "\u{2795} Add URLs to Library";
				if (urlImportStatus) urlImportStatus.textContent = "Analysis failed: " + err.message;
				showToast("\u{274C} Analysis failed: " + err.message, "error");
			}
		});
	}

	const urlImportClear = $("url-import-clear");
	if (urlImportClear && urlImportText) {
		urlImportClear.addEventListener("click", () => {
			urlImportText.value = "";
			if (urlImportStatus)
				urlImportStatus.textContent = "Ready to import.";
		});
	}

	// \u{2500}\u{2500} Legacy Data Management \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const exportBtn = $("export-btn");
	if (exportBtn) exportBtn.addEventListener("click", handleExport);

	const importBtn = $("import-btn");
	const importFile = $("import-file");
	if (importBtn && importFile) {
		importBtn.addEventListener("click", () => importFile.click());
		importFile.addEventListener("change", handleImport);
	}

	const clearBtn = $("clear-btn");
	if (clearBtn) clearBtn.addEventListener("click", handleClearLibrary);

	// \u{2500}\u{2500} Comprehensive Backup \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const createCBBtn = $("createComprehensiveBackup");
	if (createCBBtn) {
		createCBBtn.addEventListener("click", async () => {
			try {
				createCBBtn.disabled = true;
				createCBBtn.textContent = "\u{23F3} Creating\u{2026}";
				const backup = await createComprehensiveBackup({
					type: BACKUP_OPTIONS.FULL,
					includeApiKeys: $("backupIncludeApiKeys")?.checked ?? true,
					includeCredentials:
						$("backupIncludeCredentials")?.checked ?? true,
				});
				downloadBackupAsFile(backup);
				showToast(
					`\u{2705} Full backup downloaded (${backup.metadata.novelCount} novels)`,
					"success",
				);
			} catch (err) {
				debugError("Comprehensive backup failed:", err);
				showToast(`\u{274C} Backup failed: ${err.message}`, "error");
			} finally {
				createCBBtn.disabled = false;
				createCBBtn.textContent = "\u{1F4BE} Full Backup";
			}
		});
	}

	const restoreCBBtn = $("restoreComprehensiveBackup");
	const comprehensiveFile = $("comprehensiveBackupFile");

	if (restoreCBBtn && comprehensiveFile) {
		restoreCBBtn.addEventListener("click", () => comprehensiveFile.click());
	}

	if (comprehensiveFile) {
		comprehensiveFile.addEventListener("change", async (e) => {
			const file = e.target.files?.[0];
			if (!file) return;
			try {
				const backup = await readBackupFromFile(file);
				if (!backup.version || !backup.data)
					throw new Error("Invalid backup file format");

				const novelCount = backup.metadata?.novelCount || 0;
				const hasApiKey = backup.metadata?.hasApiKey;
				const hasCredentials = backup.metadata?.hasDriveCredentials;

				let confirmMsg = "Restore this backup?\n\n";
				if (backup.extensionVersion)
					confirmMsg += `\u{1F4E6} Backup Version: ${backup.extensionVersion}\n`;
				if (backup.version)
					confirmMsg += `\u{1F4CB} Format Version: ${backup.version}\n`;
				confirmMsg += `\u{1F4DA} ${novelCount} novels\n`;
				confirmMsg += `\u{1F511} API Key: ${hasApiKey ? "Yes" : "No"}\n`;
				confirmMsg += `\u{1F510} OAuth Credentials: ${hasCredentials ? "Yes" : "No"}\n\n`;
				confirmMsg += "Mode: MERGE (preserves existing data)";

				if (!confirm(confirmMsg)) {
					e.target.value = "";
					return;
				}

				const mode =
					document.querySelector('input[name="mergeMode"]:checked')
						?.value || "merge";
				await restoreComprehensiveBackup(backup, { mode });
				showToast(`\u{2705} Backup restored (${mode} mode)!`, "success");
			} catch (err) {
				debugError("Restore failed:", err);
				showToast(`\u{274C} Restore failed: ${err.message}`, "error");
			}
			e.target.value = "";
		});
	}

	// \u{2500}\u{2500} Rolling Backup Controls \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const autoBackupEl = $("autoBackupEnabled");
	if (autoBackupEl) {
		autoBackupEl.addEventListener("change", async (e) => {
			await browser.storage.local.set({
				rg_rolling_backup_enabled: e.target.checked,
			});
			showToast(
				e.target.checked
					? "Rolling backups enabled"
					: "Rolling backups disabled",
				"info",
			);
			await initializeRollingBackupStatus();
		});
	}

	const createRollingBtn = $("createRollingBackup");
	if (createRollingBtn) {
		createRollingBtn.addEventListener("click", async () => {
			try {
				createRollingBtn.disabled = true;
				createRollingBtn.textContent = "\u{23F3} Creating\u{2026}";
				await createRollingBackup("manual");
				await loadRollingBackups();
				await initializeRollingBackupStatus();
				showToast("\u{2705} Rolling backup created!", "success");
			} catch (err) {
				showToast(`\u{274C} Failed: ${err.message}`, "error");
			} finally {
				createRollingBtn.disabled = false;
				createRollingBtn.textContent = "\u{2795} Create Rolling Backup Now";
			}
		});
	}

	const rollingIntervalEl = $("rollingBackupInterval");
	const rollingIntervalDisp = $("rollingBackupIntervalDisplay");
	if (rollingIntervalEl) {
		rollingIntervalEl.addEventListener("change", async () => {
			const val = parseInt(rollingIntervalEl.value, 10) || 1440;
			if (rollingIntervalDisp)
				rollingIntervalDisp.textContent = String(val);
			await browser.storage.local.set({
				rollingBackupIntervalMinutes: val,
			});
		});
	}

	// \u{2500}\u{2500} Google Drive \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	// ── Native Browser Sync ────────────────────────────────────────────────────

	function showNativeSyncMsg(text, type) {
		const el = $("nativeSyncMessage");
		if (!el) return;
		el.textContent = text;
		el.className = "ls-alert ls-alert-" + (type === "error" ? "warn" : (type || "info"));
		el.style.display = "block";
		setTimeout(() => { el.style.display = "none"; }, 5000);
	}

	const nativeSyncNowBtn = $("nativeSyncNowBtn");
	if (nativeSyncNowBtn) {
		nativeSyncNowBtn.addEventListener("click", async () => {
			nativeSyncNowBtn.disabled = true;
			nativeSyncNowBtn.textContent = "Syncing…";
			try {
				const resp = await browser.runtime.sendMessage({ action: "nativeSyncNow" });
				if (resp?.success) showNativeSyncMsg("✅ Synced to browser account!", "success");
				else throw new Error(resp?.error || "Sync failed");
			} catch (err) {
				showNativeSyncMsg("❌ " + err.message, "error");
			} finally {
				nativeSyncNowBtn.disabled = false;
				nativeSyncNowBtn.textContent = "☁ Sync Now";
			}
		});
	}

	const nativeSyncRestoreBtn = $("nativeSyncRestoreBtn");
	if (nativeSyncRestoreBtn) {
		nativeSyncRestoreBtn.addEventListener("click", async () => {
			nativeSyncRestoreBtn.disabled = true;
			nativeSyncRestoreBtn.textContent = "Restoring…";
			try {
				const resp = await browser.runtime.sendMessage({ action: "nativeSyncRestore" });
				if (resp?.success) {
					showNativeSyncMsg("✅ Restored from browser sync!", "success");
					setTimeout(() => location.reload(), 1500);
				} else {
					throw new Error(resp?.error || "Restore failed");
				}
			} catch (err) {
				showNativeSyncMsg("❌ " + err.message, "error");
			} finally {
				nativeSyncRestoreBtn.disabled = false;
				nativeSyncRestoreBtn.textContent = "↺ Restore from Sync";
			}
		});
	}

	const nativeSyncClearBtn = $("nativeSyncClearBtn");
	if (nativeSyncClearBtn) {
		nativeSyncClearBtn.addEventListener("click", async () => {
			if (!confirm("Clear all native browser sync data? This cannot be undone.")) return;
			nativeSyncClearBtn.disabled = true;
			try {
				const resp = await browser.runtime.sendMessage({ action: "nativeSyncClear" });
				if (resp?.success) showNativeSyncMsg("✅ Sync data cleared.", "success");
				else throw new Error(resp?.error || "Clear failed");
			} catch (err) {
				showNativeSyncMsg("❌ " + err.message, "error");
			} finally {
				nativeSyncClearBtn.disabled = false;
			}
		});
	}

	const connectBtn = $("connectDriveBtn");
	if (connectBtn) connectBtn.addEventListener("click", handleConnectDrive);

	const disconnectBtn = $("disconnectDriveBtn");
	if (disconnectBtn)
		disconnectBtn.addEventListener("click", handleDisconnectDrive);

	const backupNowBtn = $("backupNowBtn");
	if (backupNowBtn) {
		backupNowBtn.addEventListener("click", async () => {
			try {
				backupNowBtn.disabled = true;
				backupNowBtn.textContent = "\u{1F4E4} Backing up\u{2026}";
				const response = await browser.runtime.sendMessage({
					action: "uploadLibraryBackupToDrive",
					folderId: null,
					reason: "manual",
				});
				if (response?.success) {
					showToast("\u{2705} Backed up to Google Drive!", "success");
					// Auto-refresh the backup list after successful backup
					setTimeout(() => loadDriveBackupsList(), 500);
				} else {
					throw new Error(response?.error || "Backup failed");
				}
			} catch (err) {
				showToast(`\u{274C} Drive backup failed: ${err.message}`, "error");
			} finally {
				backupNowBtn.disabled = false;
				backupNowBtn.textContent = "\u{1F4E4} Backup Now";
			}
		});
	}

	const syncFromDriveBtn = $("library-sync-from-drive-btn");
	if (syncFromDriveBtn) {
		syncFromDriveBtn.addEventListener("click", async () => {
			try {
				syncFromDriveBtn.disabled = true;
				syncFromDriveBtn.textContent = "\u{1F504} Syncing\u{2026}";
				const response = await browser.runtime.sendMessage({
					action: "syncDriveNow",
					reason: "manual",
					force: true,
				});
				if (response?.success) {
					showToast("\u{2705} Synced from Google Drive!", "success");
				} else if (response?.skipped) {
					if (response.reason === "no-backup") {
						showToast("\u{2139}\u{FE0F} No backup found in Drive yet.", "info");
					} else {
						showToast(
							`\u{2139}\u{FE0F} Sync skipped: ${response.reason}`,
							"info",
						);
					}
				} else {
					throw new Error(response?.error || "Sync failed");
				}
			} catch (err) {
				showToast(`\u{274C} Sync failed: ${err.message}`, "error");
			} finally {
				syncFromDriveBtn.disabled = false;
				syncFromDriveBtn.textContent = "\u{1F504} Sync from Drive";
			}
		});
	}

	// Drive backup mode radios
	document
		.querySelectorAll('input[name="driveBackupMode"]')
		.forEach((radio) => {
			radio.addEventListener("change", async () => {
				const mode =
					document.querySelector(
						'input[name="driveBackupMode"]:checked',
					)?.value || "both";
				await browser.storage.local.set({ backupMode: mode });
				const contCont = $("continuousBackupCheckContainer");
				if (contCont)
					contCont.style.display =
						mode === "continuous" || mode === "both"
							? "block"
							: "none";
			});
		});

	// Continuous backup interval
	const contIntEl = $("continuousBackupCheckInterval");
	const contIntDisp = $("continuousCheckIntervalDisplay");
	if (contIntEl) {
		contIntEl.addEventListener("input", async () => {
			const v = parseInt(contIntEl.value, 10) || 2;
			if (contIntDisp) contIntDisp.textContent = v;
			await browser.storage.local.set({
				continuousBackupCheckIntervalMinutes: v,
			});
		});
	}

	// Drive auto-restore
	const autoRestoreEl = $("driveAutoRestoreEnabled");
	if (autoRestoreEl) {
		autoRestoreEl.addEventListener("change", async (e) => {
			await browser.storage.local.set({
				driveAutoRestoreEnabled: e.target.checked,
			});
		});
	}

	// View Drive backups \u{2014} toggle the inline <details> collapsible
	const viewBackupsBtn = $("library-view-backups-btn");
	const driveBackupsSection = $("drive-backups-section");

	if (driveBackupsSection) {
		driveBackupsSection.addEventListener("toggle", () => {
			// Always reload when expanded, including when user toggles
			// the details header directly without using the button.
			if (driveBackupsSection.open) {
				loadDriveBackupsList();
			}
		});
	}

	if (viewBackupsBtn) {
		viewBackupsBtn.addEventListener("click", () => {
			if (driveBackupsSection) {
				driveBackupsSection.open = !driveBackupsSection.open;
				if (driveBackupsSection.open) {
					driveBackupsSection.scrollIntoView({
						behavior: "smooth",
						block: "nearest",
					});
				}
			}
		});
	}

	// OAuth JSON paste
	const parseOAuthBtn = $("parseOAuthJson");
	if (parseOAuthBtn) {
		parseOAuthBtn.addEventListener("click", async () => {
			try {
				const json = $("oauthJsonPaste")?.value?.trim();
				if (!json) {
					showToast("\u{26A0}\u{FE0F} Paste your JSON first", "error");
					return;
				}
				const creds = parseOAuthCredentials(json);
				if (creds.clientId) {
					const el = $("driveClientId");
					if (el) el.value = creds.clientId;
				}
				if (creds.clientSecret) {
					const el = $("driveClientSecret");
					if (el) el.value = creds.clientSecret;
				}
				showToast("\u{2705} JSON parsed \u{2014} review and save", "success");
			} catch (err) {
				showToast(`\u{274C} Parse failed: ${err.message}`, "error");
			}
		});
	}

	const saveFromJsonBtn = $("saveOAuthFromJson");
	if (saveFromJsonBtn) {
		saveFromJsonBtn.addEventListener("click", async () => {
			try {
				const json = $("oauthJsonPaste")?.value?.trim();
				if (!json) {
					showToast("\u{26A0}\u{FE0F} Paste your JSON first", "error");
					return;
				}
				const creds = parseOAuthCredentials(json);
				if (!creds.clientId)
					throw new Error("No Client ID found in JSON");
				await browser.storage.local.set({
					driveClientId: creds.clientId,
					driveClientSecret: creds.clientSecret || "",
				});
				showToast("\u{2705} OAuth credentials saved from JSON!", "success");
				await updateDriveUI();
			} catch (err) {
				showToast(`\u{274C} Save failed: ${err.message}`, "error");
			}
		});
	}

	const saveOAuthBtn = $("saveOAuthSettings");
	if (saveOAuthBtn) {
		saveOAuthBtn.addEventListener("click", async () => {
			const clientId = $("driveClientId")?.value?.trim();
			const clientSecret = $("driveClientSecret")?.value?.trim() || "";
			if (!clientId) {
				showToast("\u{26A0}\u{FE0F} Client ID is required", "error");
				return;
			}
			await browser.storage.local.set({
				driveClientId: clientId,
				driveClientSecret: clientSecret,
			});
			showToast("\u{2705} OAuth credentials saved!", "success");
		});
	}

	// Toggle client secret visibility
	const toggleSecretBtn = $("toggleClientSecretVisibility");
	if (toggleSecretBtn) {
		toggleSecretBtn.addEventListener("click", () => {
			const el = $("driveClientSecret");
			if (!el) return;
			el.type = el.type === "password" ? "text" : "password";
			toggleSecretBtn.textContent = el.type === "password" ? "\u{1F441}\u{FE0F}" : "\u{1F648}";
		});
	}

	// \u{2500}\u{2500} Carousel \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const useManualEl = $("carousel-use-manual");
	const manualCont = $("carousel-manual-container-auto");
	if (useManualEl && manualCont) {
		useManualEl.addEventListener("change", async () => {
			manualCont.classList.toggle("ls-hidden", !useManualEl.checked);
			if (!useManualEl.checked) {
				await browser.storage.local.remove("carouselManualCount");
			}
		});
	}

	const manualCountEl = $("carousel-manual-count");
	if (manualCountEl) {
		manualCountEl.addEventListener("change", async () => {
			const count = parseInt(manualCountEl.value, 10);
			if (!Number.isNaN(count)) {
				await browser.storage.local.set({ carouselManualCount: count });
				showToast(`Carousel set to ${count} novels`, "success");
			}
		});
	}

	// \u{2500}\u{2500} Auto-Hold \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const autoHoldTog = $("auto-hold-toggle");
	if (autoHoldTog) {
		autoHoldTog.addEventListener("change", async (e) => {
			const next = {
				...librarySettings,
				autoHoldEnabled: e.target.checked,
			};
			librarySettings = await novelLibrary.saveSettings(next);
		});
	}

	const autoHoldDays = $("auto-hold-days");
	if (autoHoldDays) {
		autoHoldDays.addEventListener("change", async (e) => {
			const days = parseInt(e.target.value, 10) || 7;
			const next = { ...librarySettings, autoHoldDays: days };
			librarySettings = await novelLibrary.saveSettings(next);
		});
	}

	const hideGeminiUiReadAloudTog = $("hide-gemini-ui-readaloud-toggle");
	if (hideGeminiUiReadAloudTog) {
		hideGeminiUiReadAloudTog.addEventListener("change", async (e) => {
			const next = {
				...librarySettings,
				hideGeminiUiFromReadAloud: e.target.checked,
			};
			librarySettings = await novelLibrary.saveSettings(next);
		});
	}

	// \u{2500}\u{2500} Periodic Chapter Check \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const novelUpdateTog = $("novel-update-toggle");
	if (novelUpdateTog) {
		novelUpdateTog.addEventListener("change", async (e) => {
			await browser.storage.local.set({
				novelUpdateEnabled: e.target.checked,
			});
			showToast(
				e.target.checked
					? "Chapter checking enabled"
					: "Chapter checking disabled",
				"success",
			);
		});
	}

	const novelUpdateInt = $("novel-update-interval");
	if (novelUpdateInt) {
		novelUpdateInt.addEventListener("change", async (e) => {
			const days = Math.max(
				1,
				Math.min(30, parseInt(e.target.value, 10) || 3),
			);
			e.target.value = days;
			await browser.storage.local.set({ novelUpdateIntervalDays: days });
			showToast(`Novel check interval: every ${days} day(s)`, "success");
		});
	}

	const checkNowBtn = $("novel-update-check-now");
	const checkStatus = $("novel-update-check-status");
	if (checkNowBtn) {
		checkNowBtn.addEventListener("click", async () => {
			checkNowBtn.disabled = true;
			if (checkStatus) checkStatus.textContent = "Checking…";
			try {
				await browser.runtime.sendMessage({ action: "checkNovelsNow" });
				if (checkStatus) checkStatus.textContent = "✅ Check complete";
			} catch (e) {
				if (checkStatus) checkStatus.textContent = "❌ " + e.message;
			} finally {
				checkNowBtn.disabled = false;
				setTimeout(() => { if (checkStatus) checkStatus.textContent = ""; }, 4000);
			}
		});
	}

	// \u{2500}\u{2500} Prompts \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const promptResets = [
		{
			btn: "library-reset-prompt-main",
			ta: "library-prompt-main",
			def: DEFAULT_PROMPT,
			key: "customPrompt",
		},
		{
			btn: "library-reset-prompt-summary",
			ta: "library-prompt-summary",
			def: DEFAULT_SUMMARY_PROMPT,
			key: "customSummaryPrompt",
		},
		{
			btn: "library-reset-prompt-short-summary",
			ta: "library-prompt-short-summary",
			def: DEFAULT_SHORT_SUMMARY_PROMPT,
			key: "customShortSummaryPrompt",
		},
		{
			btn: "library-reset-prompt-permanent",
			ta: "library-prompt-permanent",
			def: DEFAULT_PERMANENT_PROMPT,
			key: "permanentPrompt",
		},
	];
	promptResets.forEach(({ btn, ta, def, key }) => {
		const btnEl = $(btn);
		const taEl = $(ta);
		if (!btnEl || !taEl) return;

		// Auto-save on change
		taEl.addEventListener("change", async () => {
			await browser.storage.local.set({ [key]: taEl.value });
		});

		// Reset to default
		btnEl.addEventListener("click", async () => {
			if (!confirm("Reset this prompt to default?")) return;
			taEl.value = def;
			await browser.storage.local.set({ [key]: def });
			showToast("\u{2705} Prompt reset to default", "success");
		});
	});

	// \u{2500}\u{2500} Telemetry \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const telTog = $("telemetry-toggle");
	if (telTog) {
		telTog.addEventListener("change", async (e) => {
			const config = await getTelemetryConfig();
			await saveTelemetryConfig({ ...config, enabled: e.target.checked });
		});
	}

	const sendErrTog = $("send-errors-toggle");
	if (sendErrTog) {
		sendErrTog.addEventListener("change", async (e) => {
			const config = await getTelemetryConfig();
			await saveTelemetryConfig({
				...config,
				sendErrorReports: e.target.checked,
			});
		});
	}

	const webhookIn = $("webhook-url");
	if (webhookIn) {
		webhookIn.addEventListener("change", async () => {
			const config = await getTelemetryConfig();
			await saveTelemetryConfig({
				...config,
				customWebhookUrl: webhookIn.value.trim(),
			});
		});
	}

	// \u{2500}\u{2500} Debug \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const debugToggle = $("library-debug-mode");
	const debugSub = $("debug-sub-options");
	if (debugToggle) {
		debugToggle.addEventListener("change", async (e) => {
			if (debugSub) {
				debugSub.classList.toggle("ls-hidden", !e.target.checked);
				debugSub.style.display = e.target.checked ? "block" : "";
			}
			await browser.storage.local.set({ debugMode: e.target.checked });
		});
	}

	const truncToggle = $("library-debug-truncate");
	if (truncToggle) {
		truncToggle.addEventListener("change", async (e) => {
			await browser.storage.local.set({
				debugTruncateOutput: e.target.checked,
			});
		});
	}

	const truncLength = $("library-debug-truncate-length");
	if (truncLength) {
		truncLength.addEventListener("change", async () => {
			const len =
				parseInt(truncLength.value, 10) ||
				DEFAULT_DEBUG_TRUNCATE_LENGTH;
			await browser.storage.local.set({ debugTruncateLength: len });
		});
	}

	// \u{2500}\u{2500} Processing Options (Chunking) \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const chunkEl = $("library-chunking-enabled");
	if (chunkEl) {
		chunkEl.addEventListener("change", async (e) => {
			await browser.storage.local.set({
				chunkingEnabled: e.target.checked,
			});
		});
	}

	const chunkSizeEl = $("library-chunk-size");
	if (chunkSizeEl) {
		chunkSizeEl.addEventListener("change", async () => {
			await browser.storage.local.set({
				chunkSizeWords:
					parseInt(chunkSizeEl.value, 10) || DEFAULT_CHUNK_SIZE_WORDS,
			});
		});
	}

	const wordCountThresholdInput = document.getElementById("wordCountThreshold");
	if (wordCountThresholdInput) {
		wordCountThresholdInput.addEventListener("change", async () => {
			const newThreshold = parseInt(wordCountThresholdInput.value || "25", 10);
			if (!isNaN(newThreshold) && newThreshold >= 5) {
				await browser.storage.local.set({ wordCountThreshold: newThreshold });
			}
		});
	}

	const chunkSumEl = $("library-chunk-summary-count");
	if (chunkSumEl) {
		chunkSumEl.addEventListener("change", async () => {
			await browser.storage.local.set({
				chunkSummaryCount:
					parseInt(chunkSumEl.value, 10) ||
					DEFAULT_CHUNK_SUMMARY_COUNT,
			});
		});
	}

	const maxTokensEl = $("library-max-output-tokens");
	if (maxTokensEl) {
		maxTokensEl.addEventListener("change", async () => {
			await browser.storage.local.set({
				maxOutputTokens: parseInt(maxTokensEl.value, 10) || 8192,
			});
		});
	}

	// \u{2500}\u{2500} AI Parameters \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const topKSl = $("library-top-k-slider");
	const topKVl = $("library-top-k-value");
	if (topKSl) {
		topKSl.addEventListener("input", async () => {
			const v = parseInt(topKSl.value, 10);
			if (topKVl) topKVl.textContent = v;
			updateSliderFill(topKSl);
			await browser.storage.local.set({ topK: v });
		});
	}

	const topPSl = $("library-top-p-slider");
	const topPVl = $("library-top-p-value");
	if (topPSl) {
		topPSl.addEventListener("input", async () => {
			const v = parseFloat(topPSl.value);
			if (topPVl) topPVl.textContent = v.toFixed(2);
			updateSliderFill(topPSl);
			await browser.storage.local.set({ topP: v });
		});
	}

	const wcSl = $("library-word-count-threshold-slider");
	const wcVl = $("library-word-count-threshold-value");
	if (wcSl) {
		wcSl.addEventListener("input", async () => {
			const v = parseInt(wcSl.value, 10);
			if (wcVl) wcVl.textContent = v;
			updateSliderFill(wcSl);
			await browser.storage.local.set({ wordCountThreshold: v });
		});
	}

	// Copy advanced endpoint
	const copyAdvEpBtn = $("library-advanced-copy-endpoint");
	if (copyAdvEpBtn) {
		copyAdvEpBtn.addEventListener("click", async () => {
			const endpoint = $("library-advanced-model-endpoint")?.value;
			if (endpoint) {
				await navigator.clipboard.writeText(endpoint).catch(() => {});
				showToast("\u{1F4CB} Endpoint copied!", "success");
			}
		});
	}

	// \u{2500}\u{2500} Factory Reset \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

	const factoryResetBtn = $("library-factory-reset-btn");
	if (factoryResetBtn) {
		factoryResetBtn.addEventListener("click", async () => {
			const msg =
				"\u{26A0}\u{FE0F} FACTORY RESET \u{26A0}\u{FE0F}\n\nThis will permanently delete:\n" +
				"\u{2022} All novels from your library\n" +
				"\u{2022} All enhanced chapters and summaries\n" +
				"\u{2022} Google Drive OAuth credentials\n" +
				"\u{2022} All local and browser-stored backups\n" +
				"\u{2022} All settings and preferences\n\n" +
				"Type 'RESET' to confirm:";
			const input = prompt(msg);
			if (input?.trim() !== "RESET") return;
			try {
				await browser.storage.local.clear();
				showToast("\u{1F525} Factory reset complete. Reloading\u{2026}", "info");
				setTimeout(() => location.reload(), 1500);
			} catch (err) {
				showToast(`\u{274C} Reset failed: ${err.message}`, "error");
			}
		});
	}

	// \u{2500}\u{2500} Storage change listener \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
	browser.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== "local") return;

		if (
			changes.driveAuthTokens ||
			changes.driveAuthError ||
			changes.backupMode ||
			changes.driveAutoRestoreEnabled ||
			changes.driveClientId ||
			changes.driveClientSecret
		) {
			updateDriveUI();
		}

		if (
			changes.rg_rolling_backup_meta ||
			changes.rg_rolling_backup_enabled ||
			changes.rollingBackupIntervalMinutes
		) {
			initializeRollingBackupStatus();
			if (changes.rg_rolling_backup_meta) loadRollingBackups();
		}

		if (changes.themeSettings) {
			const theme = changes.themeSettings.newValue || defaultTheme;
			setThemeVariables(theme);
		}
	});
}

// \u{2500}\u{2500} Google Drive Backups List \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function loadDriveBackupsList() {
	const listEl = $("drive-backups-list");
	if (!listEl) return;
	listEl.innerHTML =
		'<div style="padding:20px;text-align:center;color:var(--text-secondary);">Loading Drive backups\u{2026}</div>';
	try {
		const response = await browser.runtime.sendMessage({
			action: "listDriveBackups",
		});
		if (!response?.success || !response.backups?.length) {
			listEl.innerHTML =
				'<div style="padding:20px;text-align:center;color:var(--text-secondary);">No Drive backups found.</div>';
			return;
		}
		listEl.innerHTML = response.backups
			.map((b) => {
				const modifiedDisplay = b.modifiedTime
					? new Date(b.modifiedTime).toLocaleString()
					: "";
				return `
			<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;
				border:1px solid var(--border-color);border-radius:8px;margin-bottom:8px;
				background:var(--bg-secondary);">
				<div>
					<div style="font-weight:500;font-size:13px;">${b.name}</div>
					<div style="font-size:11px;color:var(--text-secondary);">${modifiedDisplay}</div>
				</div>
				<button class="drive-restore-btn ls-btn ls-btn-secondary ls-btn-sm" data-id="${b.id}">Restore</button>
			</div>
		`;
			})
			.join("");

		listEl.querySelectorAll(".drive-restore-btn").forEach((btn) => {
			btn.addEventListener("click", async () => {
				if (!confirm("Restore this Drive backup? (Merge mode)")) return;
				try {
					btn.disabled = true;
					btn.textContent = "Restoring\u{2026}";
					const res = await browser.runtime.sendMessage({
						action: "restoreFromDrive",
						fileId: btn.dataset.id,
						mode: "merge",
					});
					if (res?.success) {
						showToast("\u{2705} Drive backup restored!", "success");
						const section = $("drive-backups-section");
						if (section) section.open = false;
					} else {
						throw new Error(res?.error || "Restore failed");
					}
				} catch (err) {
					showToast(`\u{274C} Restore failed: ${err.message}`, "error");
					btn.disabled = false;
					btn.textContent = "Restore";
				}
			});
		});
	} catch (err) {
		debugError("Failed to load Drive backups:", err);
		listEl.innerHTML = `<div style="padding:20px;text-align:center;color:#f87171;">Error: ${err.message}</div>`;
	}
}

// \u{2500}\u{2500} Custom Content Boxes tab \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function initContentBoxesTab() {
	const container = document.getElementById("content-boxes-list");
	if (!container) return;

	function escHtml(str) {
		return String(str ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	let boxTypes = await getCustomBoxTypes();

	function saveAndRender() {
		saveCustomBoxTypes(boxTypes);
		render();
	}

	function updatePreview(previewEl, box) {
		if (!previewEl) return;
		const css = generateCSSForBoxTypes([box]);
		let styleTag = previewEl.querySelector("style");
		if (!styleTag) {
			styleTag = document.createElement("style");
			previewEl.appendChild(styleTag);
		}
		styleTag.textContent = css;
		const boxEl = previewEl.querySelector(`.preview-box`);
		if (boxEl) {
			boxEl.className = `preview-box ${box.className || ""}`;
		}
	}

	function render() {
		container.innerHTML = "";
		if (boxTypes.length === 0) {
			container.innerHTML = `<p class="ls-hint" style="padding:16px 0;">No custom box types yet. Click "+ Add Box Type" to create one.</p>`;
		}
		boxTypes.forEach((box, idx) => {
			const card = document.createElement("div");
			card.className = "ls-section";
			card.style.cssText = "margin-bottom:16px;";
			card.setAttribute("data-box-id", box.id);
			card.innerHTML = `
				<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
					<span style="font-size:20px;">${escHtml(box.emoji || "\u{1F4E6}")}</span>
					<strong style="flex:1;">${escHtml(box.name)}</strong>
					<code style="font-size:11px;background:rgba(0,0,0,0.2);padding:2px 6px;border-radius:4px;">.${escHtml(box.className)}</code>
					<button class="ls-btn ls-btn-danger ls-btn-sm cb-delete-btn" data-idx="${idx}" title="Delete">\u{1F5D1}\u{FE0F}</button>
				</div>
				<div class="ls-form-group">
					<label class="ls-label">Display Name</label>
					<input type="text" class="ls-input cb-name" data-idx="${idx}" value="${escHtml(box.name)}" placeholder="Author Note" />
				</div>
				<div class="ls-form-group" style="margin-top:8px;">
					<label class="ls-label">CSS Class Name <span class="ls-hint">(no dot \u{2014} Gemini will use this)</span></label>
					<input type="text" class="ls-input cb-classname" data-idx="${idx}" value="${escHtml(box.className)}" placeholder="rg-my-box" />
				</div>
				<div class="ls-form-group" style="margin-top:8px;">
					<label class="ls-label">Emoji</label>
					<input type="text" class="ls-input" style="width:80px;" value="${escHtml(box.emoji || "")}" data-idx="${idx}" class="cb-emoji" placeholder="\u{1F4E6}" />
				</div>
				<div class="ls-form-group" style="margin-top:8px;">
					<label class="ls-label">AI Prompt Hint <span class="ls-hint">(tell Gemini when to apply this class)</span></label>
					<input type="text" class="ls-input cb-prompt-hint" data-idx="${idx}" value="${escHtml(box.promptHint || "")}" placeholder="stat windows, system pop-ups" />
				</div>
				<details style="margin-top:10px;">
					<summary class="ls-label" style="cursor:pointer;">\u{1F3A8} Appearance</summary>
					<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
						<div class="ls-form-group">
							<label class="ls-label">Background</label>
							<input type="color" class="cb-bg-color" data-idx="${idx}" value="${escHtml(rgbToHex(box.backgroundColor))}" style="width:100%;height:36px;border:none;border-radius:4px;cursor:pointer;" />
						</div>
						<div class="ls-form-group">
							<label class="ls-label">Border / Text</label>
							<input type="color" class="cb-border-color" data-idx="${idx}" value="${escHtml(rgbToHex(box.borderColor))}" style="width:100%;height:36px;border:none;border-radius:4px;cursor:pointer;" />
						</div>
						<div class="ls-form-group">
							<label class="ls-label">Text Color</label>
							<input type="color" class="cb-text-color" data-idx="${idx}" value="${escHtml(rgbToHex(box.textColor))}" style="width:100%;height:36px;border:none;border-radius:4px;cursor:pointer;" />
						</div>
					</div>
					<div class="ls-form-group" style="margin-top:10px;">
						<label class="ls-label">Raw CSS Override <span class="ls-hint">(leave blank to use appearance above)</span></label>
						<textarea class="ls-textarea cb-css-override" data-idx="${idx}" rows="4" placeholder=".my-class {\n  background: #1a2535;\n  border-left: 3px solid #4a90e2;\n}">${escHtml(box.cssOverride || "")}</textarea>
					</div>
				</details>
				<div class="cb-preview" style="margin-top:12px;border-radius:4px;overflow:hidden;">
					<div class="ls-hint" style="margin-bottom:6px;">Live preview:</div>
					<div class="preview-box ${escHtml(box.className || "")}" style="padding:10px 14px;border-radius:4px;">
						This is a sample paragraph showing how the <strong>${escHtml(box.name || "custom box")}</strong> will look when Gemini applies it to content.
					</div>
				</div>`;
			container.appendChild(card);

			// Inject preview CSS
			const previewEl = card.querySelector(".cb-preview");
			updatePreview(previewEl, box);
		});

		// Bind change events
		container.querySelectorAll(".cb-name").forEach((el) => {
			el.addEventListener("input", (e) => {
				const i = +e.target.dataset.idx;
				boxTypes[i].name = e.target.value;
				saveCustomBoxTypes(boxTypes);
				// update card heading live
				const card_ = e.target.closest("[data-box-id]");
				if (card_) {
					const strong = card_.querySelector("strong");
					if (strong) strong.textContent = e.target.value;
				}
			});
		});
		container.querySelectorAll(".cb-classname").forEach((el) => {
			el.addEventListener("input", (e) => {
				const i = +e.target.dataset.idx;
				boxTypes[i].className = e.target.value
					.replace(/\./g, "")
					.replace(/\s+/g, "-");
				e.target.value = boxTypes[i].className;
				saveCustomBoxTypes(boxTypes);
				const card_ = e.target.closest("[data-box-id]");
				if (card_) {
					const code = card_.querySelector("code");
					if (code) code.textContent = `.${boxTypes[i].className}`;
					const pb = card_.querySelector(".preview-box");
					if (pb)
						pb.className = `preview-box ${boxTypes[i].className}`;
					updatePreview(
						card_.querySelector(".cb-preview"),
						boxTypes[i],
					);
				}
			});
		});
		container.querySelectorAll(".cb-prompt-hint").forEach((el) => {
			el.addEventListener("input", (e) => {
				const i = +e.target.dataset.idx;
				boxTypes[i].promptHint = e.target.value;
				saveCustomBoxTypes(boxTypes);
			});
		});
		container.querySelectorAll(".cb-bg-color").forEach((el) => {
			el.addEventListener("input", (e) => {
				const i = +e.target.dataset.idx;
				boxTypes[i].backgroundColor = e.target.value;
				saveCustomBoxTypes(boxTypes);
				updatePreview(
					e.target
						.closest("[data-box-id]")
						?.querySelector(".cb-preview"),
					boxTypes[i],
				);
			});
		});
		container.querySelectorAll(".cb-border-color").forEach((el) => {
			el.addEventListener("input", (e) => {
				const i = +e.target.dataset.idx;
				boxTypes[i].borderColor = e.target.value;
				saveCustomBoxTypes(boxTypes);
				updatePreview(
					e.target
						.closest("[data-box-id]")
						?.querySelector(".cb-preview"),
					boxTypes[i],
				);
			});
		});
		container.querySelectorAll(".cb-text-color").forEach((el) => {
			el.addEventListener("input", (e) => {
				const i = +e.target.dataset.idx;
				boxTypes[i].textColor = e.target.value;
				saveCustomBoxTypes(boxTypes);
				updatePreview(
					e.target
						.closest("[data-box-id]")
						?.querySelector(".cb-preview"),
					boxTypes[i],
				);
			});
		});
		container.querySelectorAll(".cb-css-override").forEach((el) => {
			el.addEventListener("input", (e) => {
				const i = +e.target.dataset.idx;
				boxTypes[i].cssOverride = e.target.value;
				saveCustomBoxTypes(boxTypes);
				updatePreview(
					e.target
						.closest("[data-box-id]")
						?.querySelector(".cb-preview"),
					boxTypes[i],
				);
			});
		});
		container.querySelectorAll(".cb-delete-btn").forEach((el) => {
			el.addEventListener("click", (e) => {
				const i =
					+e.target.closest("[data-idx]")?.dataset.idx ??
					+e.target.dataset.idx;
				if (confirm(`Delete "${boxTypes[i]?.name}"?`)) {
					boxTypes.splice(i, 1);
					saveAndRender();
				}
			});
		});
	}

	// Helper: try to parse any CSS color to a 6-char hex; fall back to #808080
	function rgbToHex(color) {
		// Already hex?
		if (/^#[0-9a-f]{6}$/i.test(color)) return color;
		if (/^#[0-9a-f]{3}$/i.test(color)) {
			const [, r, g, b] = color.match(/^#(.)(.)(.)$/);
			return `#${r}${r}${g}${g}${b}${b}`;
		}
		// rgba / rgb \u{2014} use canvas to convert
		try {
			const canvas = document.createElement("canvas");
			canvas.width = canvas.height = 1;
			const ctx = canvas.getContext("2d");
			ctx.fillStyle = color;
			ctx.fillRect(0, 0, 1, 1);
			const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
			return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
		} catch {
			return "#808080";
		}
	}

	render();

	// + Add button
	const addBtn = document.getElementById("content-boxes-add-btn");
	if (addBtn) {
		addBtn.addEventListener("click", () => {
			const newBox = createBoxType({ id: `rg-box-${Date.now()}` });
			boxTypes.push(newBox);
			saveAndRender();
		});
	}
}

// \u{2500}\u{2500} Content Filters Tab \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
async function initContentFiltersTab() {
	const { DEFAULT_CONTENT_FILTER_SETTINGS } =
		await import("../utils/collapsible-sections.js");

	// Load current settings
	const result = await browser.storage.local.get("contentFilterSettings");
	let settings = {
		...DEFAULT_CONTENT_FILTER_SETTINGS,
		...result.contentFilterSettings,
	};

	// Wire up built-in type toggles and dropdowns
	const fightToggle = document.getElementById("cf-fight-enabled");
	const fightDefault = document.getElementById("cf-fight-default");
	const r18Toggle = document.getElementById("cf-r18-enabled");
	const r18Default = document.getElementById("cf-r18-default");
	const authorToggle = document.getElementById("cf-author-enabled");
	const authorDefault = document.getElementById("cf-author-default");

	if (fightToggle) {
		fightToggle.checked = settings.fight?.enabled !== false;
		fightToggle.addEventListener("change", () => {
			settings.fight = {
				...settings.fight,
				enabled: fightToggle.checked,
			};
		});
	}
	if (fightDefault) {
		fightDefault.value = String(settings.fight?.defaultCollapsed ?? true);
		fightDefault.addEventListener("change", () => {
			settings.fight = {
				...settings.fight,
				defaultCollapsed: fightDefault.value === "true",
			};
		});
	}

	if (r18Toggle) {
		r18Toggle.checked = settings.r18?.enabled !== false;
		r18Toggle.addEventListener("change", () => {
			settings.r18 = { ...settings.r18, enabled: r18Toggle.checked };
		});
	}
	if (r18Default) {
		r18Default.value = String(settings.r18?.defaultCollapsed ?? true);
		r18Default.addEventListener("change", () => {
			settings.r18 = {
				...settings.r18,
				defaultCollapsed: r18Default.value === "true",
			};
		});
	}

	if (authorToggle) {
		authorToggle.checked = settings.authorNote?.enabled !== false;
		authorToggle.addEventListener("change", () => {
			settings.authorNote = {
				...settings.authorNote,
				enabled: authorToggle.checked,
			};
		});
	}
	if (authorDefault) {
		authorDefault.value = String(
			settings.authorNote?.defaultCollapsed ?? false,
		);
		authorDefault.addEventListener("change", () => {
			settings.authorNote = {
				...settings.authorNote,
				defaultCollapsed: authorDefault.value === "true",
			};
		});
	}

	// Wire up playground toggles
	const playgroundExamples = [
		{ id: "pg-fight-example", type: "fight" },
		{ id: "pg-r18-example", type: "r18" },
		{ id: "pg-author-example", type: "author-note" },
	];

	for (const example of playgroundExamples) {
		const wrapper = document.getElementById(example.id);
		if (wrapper) {
			const header = wrapper.querySelector(".rg-collapsible-header");
			if (header) {
				header.addEventListener("click", () => {
					const isCollapsed =
						wrapper.classList.contains("rg-collapsed");
					const summaryBlock = wrapper.querySelector(
						".rg-collapsible-summary-block",
					);
					const contentBlock = wrapper.querySelector(
						".rg-collapsible-content",
					);
					const toggleBtn = wrapper.querySelector(
						".rg-collapsible-toggle-btn",
					);

					if (isCollapsed) {
						wrapper.classList.remove("rg-collapsed");
						wrapper.classList.add("rg-expanded");
						if (contentBlock) contentBlock.style.display = "block";
						if (summaryBlock) summaryBlock.style.display = "none";
						if (toggleBtn) toggleBtn.textContent = "\u{25B2} Collapse";
					} else {
						wrapper.classList.remove("rg-expanded");
						wrapper.classList.add("rg-collapsed");
						if (contentBlock) contentBlock.style.display = "none";
						if (summaryBlock) summaryBlock.style.display = "block";
						if (toggleBtn) toggleBtn.textContent = "\u{25BC} Read";
					}
				});
			}
		}
	}

	// Custom types UI
	const customList = document.getElementById("cf-custom-list");
	const addCustomBtn = document.getElementById("cf-add-custom-btn");

	function renderCustomTypes() {
		customList.innerHTML = "";
		const customTypes = settings.custom || [];
		if (customTypes.length === 0) {
			customList.innerHTML = `<p class="ls-hint" style="color:rgba(200,195,185,0.6);">No custom types yet. Click "+ Add Custom Type" to create one.</p>`;
			return;
		}
		customTypes.forEach((type, idx) => {
			const card = document.createElement("div");
			card.className = "ls-form-group";
			card.style.cssText =
				"border-top:1px solid var(--border-color);padding-top:12px;padding-bottom:12px;";
			card.innerHTML = `
				<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
					<span style="font-size:24px;" class="cf-icon">${type.icon || "\u{1F4C4}"}</span>
					<input type="text" class="ls-input cf-name" placeholder="Type name" value="${type.name || ""}" style="flex:1;"/>
					<button class="ls-btn ls-btn-danger ls-btn-sm cf-delete-btn" data-idx="${idx}">\u{1F5D1}\u{FE0F}</button>
				</div>
				<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
					<div>
						<label class="ls-label" style="font-size:12px;">Type ID</label>
						<input type="text" class="ls-input cf-id" placeholder="flashback" value="${type.id || ""}" disabled style="opacity:0.6;" />
					</div>
					<div>
						<label class="ls-label" style="font-size:12px;">Emoji</label>
						<input type="text" class="ls-input cf-icon-input" placeholder="\u{23EE}\u{FE0F}" value="${type.icon || ""}" style="width:100%;" />
					</div>
				</div>
				<div style="margin-top:10px;">
					<label class="ls-label" style="font-size:12px;">Hint for Gemini <span class="ls-hint">(what content to wrap)</span></label>
					<textarea class="ls-input cf-hint" placeholder="e.g., flashback scenes with heavy worldbuilding exposition" style="min-height:60px;font-family:monospace;font-size:12px;">${type.hint || ""}</textarea>
				</div>
				<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
					<label class="ls-label-checkbox" style="display:flex;align-items:center;gap:8px;">
						<input type="checkbox" class="cf-enabled" ${type.enabled !== false ? "checked" : ""} />
						<span>Enabled</span>
					</label>
					<label class="ls-label-checkbox" style="display:flex;align-items:center;gap:8px;">
						<input type="checkbox" class="cf-collapsed" ${type.defaultCollapsed !== false ? "checked" : ""} />
						<span>Default collapsed</span>
					</label>
				</div>
			`;

			const nameInput = card.querySelector(".cf-name");
			const iconInput = card.querySelector(".cf-icon-input");
			const hintInput = card.querySelector(".cf-hint");
			const enabledCheckbox = card.querySelector(".cf-enabled");
			const collapsedCheckbox = card.querySelector(".cf-collapsed");
			const deleteBtn = card.querySelector(".cf-delete-btn");
			const iconDisplay = card.querySelector(".cf-icon");

			nameInput.addEventListener("change", () => {
				settings.custom[idx].name = nameInput.value;
			});
			iconInput.addEventListener("change", () => {
				settings.custom[idx].icon = iconInput.value;
				iconDisplay.textContent = iconInput.value || "\u{1F4C4}";
			});
			hintInput.addEventListener("change", () => {
				settings.custom[idx].hint = hintInput.value;
			});
			enabledCheckbox.addEventListener("change", () => {
				settings.custom[idx].enabled = enabledCheckbox.checked;
			});
			collapsedCheckbox.addEventListener("change", () => {
				settings.custom[idx].defaultCollapsed =
					collapsedCheckbox.checked;
			});
			deleteBtn.addEventListener("click", () => {
				settings.custom.splice(idx, 1);
				renderCustomTypes();
			});

			customList.appendChild(card);
		});
	}

	if (addCustomBtn) {
		addCustomBtn.addEventListener("click", () => {
			const newType = {
				id: `custom-${Date.now()}`,
				name: "New Type",
				icon: "\u{1F4C4}",
				enabled: true,
				defaultCollapsed: true,
				hint: "",
			};
			if (!settings.custom) settings.custom = [];
			settings.custom.push(newType);
			renderCustomTypes();
		});
	}

	renderCustomTypes();

	// Save button
	const saveBtn = document.getElementById("content-filters-save-btn");
	if (saveBtn) {
		saveBtn.addEventListener("click", async () => {
			await browser.storage.local.set({
				contentFilterSettings: settings,
			});
			showToast("\u{2705} Content filter settings saved!");
		});
	}
}

// \u{2500}\u{2500} Display Settings Tab \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
const DISPLAY_SETTINGS_KEY = "libraryDisplayOptions";
const DEFAULT_DISPLAY_SETTINGS = {
	showFilterToolbar: true,
	showSortFilter: true,
	showStatusFilter: true,
	showActiveFilters: true,
};

async function initDisplaySettingsTab() {
	const result = await browser.storage.local.get(DISPLAY_SETTINGS_KEY);
	const settings = { ...DEFAULT_DISPLAY_SETTINGS, ...(result[DISPLAY_SETTINGS_KEY] || {}) };

	const toolbarEl = document.getElementById("display-show-filter-toolbar");
	const sortEl = document.getElementById("display-show-sort-filter");
	const statusEl = document.getElementById("display-show-status-filter");
	const activeEl = document.getElementById("display-show-active-filters");

	if (toolbarEl) toolbarEl.checked = settings.showFilterToolbar;
	if (sortEl) sortEl.checked = settings.showSortFilter;
	if (statusEl) statusEl.checked = settings.showStatusFilter;
	if (activeEl) activeEl.checked = settings.showActiveFilters;

	const saveBtn = document.getElementById("display-settings-save-btn");
	if (saveBtn) {
		saveBtn.addEventListener("click", async () => {
			await browser.storage.local.set({
				[DISPLAY_SETTINGS_KEY]: {
					showFilterToolbar: toolbarEl?.checked ?? true,
					showSortFilter: sortEl?.checked ?? true,
					showStatusFilter: statusEl?.checked ?? true,
					showActiveFilters: activeEl?.checked ?? true,
				},
			});
			showToast("\u{2705} Display settings saved!");
		});
	}
}

// \u{2500}\u{2500} Init \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
// ── Queue panel ────────────────────────────────────────────────────────────────

const STATUS_ICON = {
	pending: "\u{23F3}",
	running: "\u{25B6}",
	paused: "\u{23F8}",
	done: "\u{2705}",
	error: "\u{274C}",
};
const STATUS_COLOR = {
	pending: "#6b7280",
	running: "#3b82f6",
	paused: "#f59e0b",
	done: "#22c55e",
	error: "#ef4444",
};

async function initQueuePanel() {
	const addBtn = document.getElementById("ls-qAddBtn");
	const jobList = document.getElementById("ls-qJobList");
	const resultView = document.getElementById("ls-qResultView");
	const resultClose = document.getElementById("ls-qResultClose");
	const resultContent = document.getElementById("ls-qResultContent");
	const resultTitle = document.getElementById("ls-qResultTitle");

	if (!addBtn) return;

	// ── Render job list ──────────────────────────────────────────────────────
	async function renderJobs() {
		if (!jobList) return;
		let jobs = [];
		try {
			const resp = await browser.runtime.sendMessage({ action: "queue", subAction: "status" });
			jobs = resp?.result?.jobs || [];
		} catch (_e) {
			jobList.innerHTML = "";
			const p = document.createElement("p");
			p.className = "ls-section-desc";
			p.textContent = "Unable to load queue.";
			jobList.appendChild(p);
			return;
		}

		jobList.innerHTML = "";

		if (jobs.length === 0) {
			const empty = document.createElement("p");
			empty.className = "ls-section-desc";
			empty.textContent = "No jobs queued. Add one below or from a novel’s edit modal.";
			jobList.appendChild(empty);
			return;
		}

		for (const job of jobs) {
			const prog = job.progress || {};
			const total = prog.total ?? Math.max(1, (job.endChapter || 1) - (job.startChapter || 1) + 1);
			const done = (prog.processedChapters || []).length;
			const skipped = (prog.skippedChapters || []).length;
			const failed = (prog.failedChapters || []).length;
			const pct = Math.round((done / total) * 100);
			const color = STATUS_COLOR[job.status] || "#6b7280";
			const icon = STATUS_ICON[job.status] || "\u{23F3}";

			const card = document.createElement("div");
			card.style.cssText = `
				border:1px solid var(--border-color,#333);
				border-left:3px solid ${color};
				border-radius:6px;
				padding:10px 12px;
				margin-bottom:8px;
				font-size:12px;
				background:var(--bg-secondary);
			`;

			// ── Title row ────────────────────────────────────────────────────
			const titleRow = document.createElement("div");
			titleRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:6px;";
			const statusSpan = document.createElement("span");
			statusSpan.textContent = icon;
			statusSpan.style.cssText = `font-size:14px;color:${color};flex-shrink:0;`;
			const titleSpan = document.createElement("span");
			titleSpan.style.cssText = "font-weight:600;flex:1;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
			titleSpan.textContent = job.novelTitle || "(Unnamed novel)";
			const chSpan = document.createElement("span");
			chSpan.style.cssText = "color:var(--text-secondary);font-size:11px;flex-shrink:0;";
			chSpan.textContent = `Ch ${job.startChapter}–${job.endChapter}`;
			titleRow.appendChild(statusSpan);
			titleRow.appendChild(titleSpan);
			titleRow.appendChild(chSpan);
			card.appendChild(titleRow);

			// ── Progress bar ─────────────────────────────────────────────────
			if (job.status === "running" || job.status === "paused" || job.status === "done") {
				const bar = document.createElement("div");
				bar.style.cssText = "background:var(--bg-tertiary);border-radius:3px;height:5px;overflow:hidden;margin-bottom:6px;";
				const fill = document.createElement("div");
				fill.style.cssText = `background:${color};height:100%;width:${pct}%;transition:width 0.3s;`;
				bar.appendChild(fill);
				card.appendChild(bar);
			}

			// ── Stats row ────────────────────────────────────────────────────
			const statsRow = document.createElement("div");
			statsRow.style.cssText = "display:flex;gap:12px;margin-bottom:6px;font-size:11px;flex-wrap:wrap;";

			const addStat = (label, value, color) => {
				const s = document.createElement("span");
				s.innerHTML = `<span style="color:${color || "var(--text-secondary)"};">${value}</span> ${label}`;
				statsRow.appendChild(s);
			};

			if (job.status !== "pending") {
				addStat("done", done, "#22c55e");
				if (skipped) addStat("skipped", skipped, "#f59e0b");
				if (failed) addStat("failed", failed, "#ef4444");
				addStat(`/ ${total} total`, "", "var(--text-secondary)");
				if (job.status === "running") addStat(`(${pct}%)`, "", "#3b82f6");
			}

			if (job.status === "error" && job.error) {
				const errSpan = document.createElement("span");
				errSpan.style.cssText = "color:#ef4444;font-size:11px;";
				errSpan.textContent = "⚠️ " + job.error.slice(0, 120);
				statsRow.appendChild(errSpan);
			}

			if (job.status === "done" && skipped > 0) {
				const note = document.createElement("div");
				note.style.cssText = "color:#f59e0b;font-size:11px;margin-top:2px;";
				note.textContent = `${skipped} chapter(s) skipped — too short or empty (< 100 words).`;
				statsRow.appendChild(note);
			}

			card.appendChild(statsRow);

			// ── Actions ──────────────────────────────────────────────────────
			const actRow = document.createElement("div");
			actRow.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";

			const makeBtn = (label, danger, onClick) => {
				const b = document.createElement("button");
				b.className = "ls-btn ls-btn-sm " + (danger ? "ls-btn-danger" : "ls-btn-secondary");
				b.textContent = label;
				b.addEventListener("click", async () => {
					b.disabled = true;
					await onClick();
					b.disabled = false;
				});
				return b;
			};

			if (job.status === "running") {
				actRow.appendChild(makeBtn("⏸ Pause", false, async () => {
					await browser.runtime.sendMessage({ action: "queue", subAction: "pause" });
					await renderJobs();
				}));
			} else if (job.status === "paused" || job.status === "pending") {
				actRow.appendChild(makeBtn("▶ Resume", false, async () => {
					await browser.runtime.sendMessage({ action: "queue", subAction: "resume" });
					await renderJobs();
				}));
			}

			if (job.status === "done") {
				actRow.appendChild(makeBtn("View Summary", false, async () => {
					if (resultView) resultView.style.display = "";
					if (resultTitle) resultTitle.textContent = `${job.novelTitle} · Ch ${job.startChapter}–${job.endChapter}`;
					if (resultContent) resultContent.textContent = job.summary || "(No summary generated)";
				}));
			}

			actRow.appendChild(makeBtn("❌ Remove", true, async () => {
				await browser.runtime.sendMessage({ action: "queue", subAction: "cancel", jobId: job.id });
				await renderJobs();
			}));

			card.appendChild(actRow);
			jobList.appendChild(card);
		}
	}

	// ── Add job ──────────────────────────────────────────────────────────────
	addBtn.addEventListener("click", async () => {
		const firstUrl = document.getElementById("ls-qFirstUrl")?.value?.trim();
		const start = parseInt(document.getElementById("ls-qStart")?.value, 10) || 1;
		const end = parseInt(document.getElementById("ls-qEnd")?.value, 10) || 1;
		const sendToLW = document.getElementById("ls-qSendToLW")?.checked ?? true;
		if (!firstUrl) { showToast("Enter the first chapter URL", "warning"); return; }
		if (start > end) { showToast("From chapter must be ≤ To chapter", "warning"); return; }
		try {
			const config = await browser.storage.local.get(["loreWeaveUrl", "loreWeaveWritingStyle"]);
			await browser.runtime.sendMessage({
				action: "queue",
				subAction: "add",
				job: {
					novelTitle: "",
					firstChapterUrl: firstUrl,
					startChapter: start,
					endChapter: end,
					sendToLoreWeave: sendToLW,
					writingStyle: config.loreWeaveWritingStyle || "other",
					loreWeaveUrl: config.loreWeaveUrl || "",
					domainId: "",
				},
			});
			showToast(`Job queued: Ch ${start}–${end}`, "success");
			document.getElementById("ls-qFirstUrl").value = "";
			await renderJobs();
		} catch (e) {
			showToast("Failed: " + e.message, "error");
		}
	});

	if (resultClose) {
		resultClose.addEventListener("click", () => {
			if (resultView) resultView.style.display = "none";
		});
	}

	// Auto-refresh every 8 seconds while the panel is visible
	await renderJobs();
	const _refreshInterval = setInterval(async () => {
		const panel = document.getElementById("panel-queue-details");
		if (panel && panel.open) {
			await renderJobs();
		}
	}, 8000);

	// Clean up on panel hide (tab switch) — best-effort
	document.getElementById("ls-nav")?.addEventListener("click", () => {
		clearInterval(_refreshInterval);
	});
}

// ── LoreWeave panel ─────────────────────────────────────────────────────────────
async function initLoreWeavePanel() {
	const lsUrl = document.getElementById("ls-lwUrl");
	const lsAuto = document.getElementById("ls-lwAutoGraphify");
	const lsChronicle = document.getElementById("ls-lwChronicleEnabled");
	const lsPrior = document.getElementById("ls-lwUsePriorContext");
	const lsStyle = document.getElementById("ls-lwWritingStyle");
	const lsSave = document.getElementById("ls-lwSaveBtn");
	const lsPing = document.getElementById("ls-lwPingBtn");
	const lsPingStatus = document.getElementById("ls-lwPingStatus");
	const lsUserIdEl = document.getElementById("ls-lwUserId");
	const lsCopyUid = document.getElementById("ls-lwCopyUserId");

	if (!lsUrl) return;

	// Load or generate LoreWeave user ID (SponsorBlock-style UUID)
	try {
		const stored = await browser.storage.local.get([
			"loreWeaveUrl", "loreWeaveAutoGraphify", "loreWeaveChronicleEnabled",
			"loreWeaveUsePriorContext", "loreWeaveWritingStyle", "loreWeaveUserId",
		]);
		if (lsUrl) lsUrl.value = stored.loreWeaveUrl || "";
		if (lsAuto) lsAuto.checked = !!stored.loreWeaveAutoGraphify;
		if (lsChronicle) lsChronicle.checked = !!stored.loreWeaveChronicleEnabled;
		if (lsPrior) lsPrior.checked = !!stored.loreWeaveUsePriorContext;
		if (lsStyle && stored.loreWeaveWritingStyle) lsStyle.value = stored.loreWeaveWritingStyle;

		let userId = stored.loreWeaveUserId;
		if (!userId) {
			userId = crypto.randomUUID ? crypto.randomUUID() : `lw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
			await browser.storage.local.set({ loreWeaveUserId: userId });
		}
		if (lsUserIdEl) lsUserIdEl.textContent = userId;
	} catch (_e) { /* non-critical */ }

	if (lsCopyUid && lsUserIdEl) {
		lsCopyUid.addEventListener("click", () => {
			navigator.clipboard.writeText(lsUserIdEl.textContent).then(() => {
				showToast("User ID copied", "success");
			}).catch(() => {});
		});
	}

	if (lsSave) {
		lsSave.addEventListener("click", async () => {
			await browser.storage.local.set({
				loreWeaveUrl: lsUrl?.value?.trim() || "",
				loreWeaveAutoGraphify: lsAuto?.checked ?? false,
				loreWeaveChronicleEnabled: lsChronicle?.checked ?? false,
				loreWeaveUsePriorContext: lsPrior?.checked ?? false,
				loreWeaveWritingStyle: lsStyle?.value || "other",
			});
			showToast("LoreWeave settings saved", "success");
		});
	}

	if (lsPing) {
		lsPing.addEventListener("click", async () => {
			const url = lsUrl?.value?.trim();
			if (!url) { showToast("Enter a backend URL first", "warning"); return; }
			if (lsPingStatus) { lsPingStatus.textContent = "Testing\u{2026}"; lsPingStatus.style.display = "block"; }
			try {
				const resp = await browser.runtime.sendMessage({ action: "loreweave:ping", url });
				if (lsPingStatus) {
					lsPingStatus.textContent = resp?.success ? "\u{2705} Connected" : "\u{274C} " + (resp?.error || "Failed");
					lsPingStatus.style.display = "block";
				}
			} catch (e) {
				if (lsPingStatus) { lsPingStatus.textContent = "\u{274C} " + e.message; lsPingStatus.style.display = "block"; }
			}
		});
	}
}

// ── Chat settings panel ─────────────────────────────────────────────────────────
async function initChatPanel() {
	const saveBtn = document.getElementById("ls-chatSettingsSaveBtn");
	if (!saveBtn) return;

	const CHAT_SETTINGS_KEY = "rg_chat_settings";
	const defaults = {
		useCurrentChapter: true,
		useChronicle: true,
		useLoreWeave: true,
		useWebSearch: false,
		maxHistory: 6,
	};

	try {
		const stored = await browser.storage.local.get(CHAT_SETTINGS_KEY);
		const s = { ...defaults, ...(stored[CHAT_SETTINGS_KEY] || {}) };
		const useChapter = document.getElementById("ls-chatUseCurrentChapter");
		const useChronicle = document.getElementById("ls-chatUseChronicle");
		const useLW = document.getElementById("ls-chatUseLoreWeave");
		const useWeb = document.getElementById("ls-chatUseWebSearch");
		const maxHist = document.getElementById("ls-chatMaxHistory");
		if (useChapter) useChapter.checked = s.useCurrentChapter;
		if (useChronicle) useChronicle.checked = s.useChronicle;
		if (useLW) useLW.checked = s.useLoreWeave;
		if (useWeb) useWeb.checked = s.useWebSearch;
		if (maxHist) maxHist.value = s.maxHistory;
	} catch (_e) { /* non-critical */ }

	saveBtn.addEventListener("click", async () => {
		const s = {
			useCurrentChapter: document.getElementById("ls-chatUseCurrentChapter")?.checked ?? true,
			useChronicle: document.getElementById("ls-chatUseChronicle")?.checked ?? true,
			useLoreWeave: document.getElementById("ls-chatUseLoreWeave")?.checked ?? true,
			useWebSearch: document.getElementById("ls-chatUseWebSearch")?.checked ?? false,
			maxHistory: parseInt(document.getElementById("ls-chatMaxHistory")?.value, 10) || 6,
		};
		await browser.storage.local.set({ [CHAT_SETTINGS_KEY]: s });
		showToast("Chat settings saved", "success");
	});
}

async function init() {
	debugLog("\u{2699}\u{FE0F} Library Settings page initialising\u{2026}");

	// Build navigation
	renderNav();
	activateTabFromUrl();
	initAiProviderTabs(); // Wire up provider switcher in AI Providers panel

	// Apply theme ASAP to prevent flash
	await applyTheme();
	setupThemeListener();

	// Version badge
	updateVersion();

	// Load all settings
	await loadLibrarySettings_();

	// Apply status config from library settings
	applyStatusConfig(librarySettings?.statusConfig);

	// Initialise Status Settings tab (renders on demand)
	initStatusSettingsTab(
		() => librarySettings,
		async (patch) => {
			const next = { ...librarySettings, ...patch };
			librarySettings = await novelLibrary.saveSettings(next);
			applyStatusConfig(librarySettings.statusConfig);
		},
	);

	// Load and render Site Settings
	await loadSiteSettings_();
	renderSiteSettingsCards();

	// Telemetry
	await loadTelemetrySettings();

	// Backup settings
	await loadBackupCheckboxSettings();
	await loadRollingBackups();
	await initializeRollingBackupStatus();

	// Theme, model, advanced
	await loadLibraryThemeControls();
	await loadLibraryModelSettings();
	await loadLibraryAdvancedSettings();

	// Copy Format tab
	await initCopyFormatTab();

	// Custom Content Boxes tab
	await initContentBoxesTab();

	// Content Filters tab
	await initContentFiltersTab();

	// Display Settings tab (hidden panel kept for JS compat)
	await initDisplaySettingsTab();

	// New story-tool panels moved from popup
	await initQueuePanel();
	await initLoreWeavePanel();
	await initChatPanel();

	// Wire up all event listeners
	setupEventListeners();

	// Google Drive UI
	await updateDriveUI();

	// Ensure all range sliders show their fill correctly
	initAllSliderFills();

	debugLog("\u{2699}\u{FE0F} Library Settings page ready.");
}

// Start
document.addEventListener("DOMContentLoaded", init);
