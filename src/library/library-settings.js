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

// ── Navigation tabs definition ────────────────────────────────────────────────
const SETTINGS_TABS = [
	{ id: "general", icon: "💾", label: "General", panelId: "panel-general" },
	{ id: "backups", icon: "☁️", label: "Backups", panelId: "panel-backups" },
	{
		id: "automation",
		icon: "⚡",
		label: "Automation",
		panelId: "panel-automation",
	},
	{ id: "sites", icon: "🌐", label: "Sites", panelId: "panel-sites" },
	{ id: "prompts", icon: "✍️", label: "Prompts", panelId: "panel-prompts" },
	{
		id: "statuses",
		icon: "📋",
		label: "Statuses",
		panelId: "panel-statuses",
	},
	{
		id: "advanced",
		icon: "⚙️",
		label: "Advanced",
		panelId: "panel-advanced",
	},
	{
		id: "copy",
		icon: "📋",
		label: "Copy Format",
		panelId: "panel-copy",
	},
];

// ── Theme — centralized ───────────────────────────────────────────────────────
import {
	DEFAULT_THEME as defaultTheme,
	THEME_PRESETS,
	setThemeVariables,
	applyThemeFromStorage,
	setupThemeListener,
	getPresetList,
	resolveMode,
} from "../utils/theme-config.js";

// ── Page state ────────────────────────────────────────────────────────────────
let librarySettings = { autoHoldEnabled: true, autoHoldDays: 7 };
let siteSettings = {};
let libraryApiKeys = [];

// ── Utilities ─────────────────────────────────────────────────────────────────
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

// ── Slider fill ───────────────────────────────────────────────────────────────
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

// ── Navigation ────────────────────────────────────────────────────────────────
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

// ── Version badge ─────────────────────────────────────────────────────────────
import { BUILD_VERSION } from "../config/build-version.js";

function updateVersion() {
	const badge = $("ls-version-badge");
	if (!badge) return;
	// BUILD_VERSION is stamped by dev/build.js on every build — always up-to-date
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

// ── Theme UI helpers (module-level — used by both loadLibraryThemeControls
//    and setupEventListeners) ─────────────────────────────────────────────────

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

// ── Load: Theme Controls ──────────────────────────────────────────────────────
async function loadLibraryThemeControls() {
	try {
		const result = await browser.storage.local.get("themeSettings");
		const theme = result.themeSettings || defaultTheme;

		// ── Mode: sync hidden select + pill buttons ────────────────────────────
		const themeMode = $("library-theme-mode");
		const currentMode = theme.mode || "dark";
		if (themeMode) themeMode.value = currentMode;
		syncModePills(currentMode);

		// ── Preset skin dropdown ───────────────────────────────────────────────
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

		// ── Auto-behavior panel ────────────────────────────────────────────────
		syncAutoPanel(theme.mode || "dark", theme);
	} catch (err) {
		debugError("Failed to load theme controls:", err);
	}
}

// ── Load: Model Settings ──────────────────────────────────────────────────────
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
					endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`,
				};
			});
	} catch (err) {
		debugError("Failed to fetch models:", err);
		return null;
	}
}

async function updateLibraryModelSelector(apiKey) {
	const sel = $("library-model-select");
	if (!sel) return;
	try {
		sel.innerHTML = '<option value="">Loading models…</option>';
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

		const stored = await browser.storage.local.get([
			"selectedModelId",
			"modelEndpoint",
		]);
		let selectedModelId = stored.selectedModelId || "";

		sel.innerHTML = "";
		models.forEach((model) => {
			const opt = document.createElement("option");
			opt.value = model.id;
			opt.textContent = model.displayName;
			if (!selectedModelId && model.id === DEFAULT_MODEL_ID)
				selectedModelId = model.id;
			sel.appendChild(opt);
		});

		if (selectedModelId) sel.value = selectedModelId;
		else if (stored.modelEndpoint) {
			const mid = stored.modelEndpoint.split("/").pop().split(":")[0];
			if (mid && sel.querySelector(`option[value="${mid}"]`))
				sel.value = mid;
		}

		const selectedModel = models.find((m) => m.id === sel.value);
		setLibraryModelEndpoint(
			selectedModel?.endpoint ||
				(sel.value
					? `https://generativelanguage.googleapis.com/v1beta/models/${sel.value}:generateContent`
					: ""),
		);

		await browser.storage.local.set({
			availableModels: models,
			selectedModelId: sel.value,
			modelsLastFetched: Date.now(),
		});
	} catch (err) {
		debugError("Error updating model selector:", err);
		sel.innerHTML = `
			<option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
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
			"selectedModelId",
			"modelEndpoint",
		]);

		const allKeys = [data.apiKey, ...(data.backupApiKeys || [])].filter(
			Boolean,
		);

		if (allKeys.length > 0) {
			await updateLibraryModelSelector(allKeys[0]);
		} else {
			const sel = $("library-model-select");
			if (sel) {
				sel.innerHTML = `
					<option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
					<option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
					<option value="gemini-2.5-pro">Gemini 2.5 Pro (Better quality)</option>
				`;
				if (data.selectedModelId) sel.value = data.selectedModelId;
			}
		}

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

// ── Load: API Keys (Unified) ─────────────────────────────────────────────────
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
				data-index="${index}" style="padding:2px 8px;font-size:13px;">✕</button>
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
			showToast("✅ API key removed", "success");
		});
	});
}

// ── Load: Advanced Settings ───────────────────────────────────────────────────
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

// ── Load: Telemetry Settings ──────────────────────────────────────────────────
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

// ── Load: Library Settings (auto-hold, carousel) ──────────────────────────────
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

// ── Load: Site Settings ───────────────────────────────────────────────────────
async function loadSiteSettings_() {
	try {
		siteSettings = await getSiteSettings();
	} catch (err) {
		debugError("Failed to load site settings:", err);
		siteSettings = {};
	}
}

function renderSiteAutoAddSettings() {
	const list = $("site-autoadd-list");
	if (!list) return;

	list.innerHTML = "";

	const shelvesArr = Object.values(SHELVES);

	shelvesArr.forEach((shelf) => {
		if (!shelf || !shelf.id) return;

		const shelfId = shelf.id;
		const shelfSett =
			siteSettings[shelfId] || getDefaultSiteSettings(shelfId);
		const isEnabled = shelfSett.enabled !== false;
		const autoAddEnabled = shelfSett.autoAddEnabled !== false;

		const statusOptions = Object.entries(READING_STATUS_INFO)
			.map(
				([key, info]) => `
			<option value="${key}">${info.label}</option>
		`,
			)
			.join("");

		// Build favicon URL using Google's proxy (avoids hotlink blocks)
		const faviconUrl = shelf.icon
			? (() => {
					try {
						return `https://www.google.com/s2/favicons?domain=${new URL(shelf.icon).hostname}&sz=32`;
					} catch {
						return null;
					}
				})()
			: null;
		const invertIcon = shelf.invertIconInDarkMode === true;
		const iconHtml = faviconUrl
			? `<img src="${faviconUrl}" class="ls-site-icon-img" alt="" data-emoji="${shelf.emoji || "📖"}" ${invertIcon ? 'data-invert="true"' : ""} />`
			: `<span class="ls-site-icon-emoji">${shelf.emoji || "📖"}</span>`;

		const row = document.createElement("div");
		row.style.cssText =
			"display:flex;align-items:center;gap:12px;padding:10px;" +
			"border:1px solid var(--border-color);border-radius:8px;margin-bottom:8px;" +
			"background:var(--bg-secondary);";
		row.innerHTML = `
			<label class="ls-toggle" title="Enable/disable ${shelf.name}">
				<input type="checkbox" class="site-enable-toggle" data-shelf="${shelfId}"
					${isEnabled ? "checked" : ""} />
				<span class="ls-toggle-track"></span>
			</label>
			<span class="ls-site-icon-wrap">${iconHtml}</span>
			<span style="flex:1;font-weight:500;font-size:13px;">${shelf.name || shelfId}</span>
			<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
				<label class="ls-toggle" title="Auto-add ${shelf.name} to library">
					<input type="checkbox" class="site-autoadd-toggle" data-shelf="${shelfId}"
						${autoAddEnabled ? "checked" : ""} />
					<span class="ls-toggle-track"></span>
				</label>
				<label style="font-size:11px;color:var(--text-secondary);">On chapter:</label>
				<select class="site-autoadd-status ls-select" data-shelf="${shelfId}" data-mode="chapter"
					style="font-size:12px;padding:4px 6px;min-width:130px;">
					${statusOptions}
				</select>
				<label style="font-size:11px;color:var(--text-secondary);">On novel:</label>
				<select class="site-autoadd-status ls-select" data-shelf="${shelfId}" data-mode="novel"
					style="font-size:12px;padding:4px 6px;min-width:130px;">
					${statusOptions}
				</select>
			</div>
		`;

		// Swap favicon → emoji on load failure (no inline onerror, avoids CSP)
		const imgEl = row.querySelector(".ls-site-icon-img");
		if (imgEl) {
			imgEl.addEventListener("error", () => {
				const emoji = imgEl.dataset.emoji || "📖";
				const span = document.createElement("span");
				span.className = "ls-site-icon-emoji";
				span.textContent = emoji;
				imgEl.replaceWith(span);
			});
		}

		// Toggle enable/disable
		row.querySelector(".site-enable-toggle").addEventListener(
			"change",
			async (e) => {
				const current =
					siteSettings[shelfId] || getDefaultSiteSettings(shelfId);
				const updated = { ...current, enabled: e.target.checked };
				siteSettings[shelfId] = updated;
				await saveSiteSettings(siteSettings);
				showToast(
					e.target.checked
						? `✅ ${shelf.name} enabled`
						: `⛔ ${shelf.name} disabled`,
					"info",
				);
			},
		);

		// Toggle auto-add
		row.querySelector(".site-autoadd-toggle").addEventListener(
			"change",
			async (e) => {
				const current =
					siteSettings[shelfId] || getDefaultSiteSettings(shelfId);
				const updated = {
					...current,
					autoAddEnabled: e.target.checked,
				};
				siteSettings[shelfId] = updated;
				await saveSiteSettings(siteSettings);
				showToast(
					e.target.checked
						? `✅ Auto-add enabled for ${shelf.name}`
						: `⏸️ Auto-add disabled for ${shelf.name}`,
					"info",
				);
			},
		);

		// Auto-add status change
		row.querySelectorAll(".site-autoadd-status").forEach((select) => {
			const mode = select.dataset.mode;
			if (mode === "chapter") {
				select.value =
					shelfSett.autoAddStatusChapter || READING_STATUS.READING;
			} else {
				select.value =
					shelfSett.autoAddStatusNovel || READING_STATUS.PLAN_TO_READ;
			}
			select.addEventListener("change", async (e) => {
				const current =
					siteSettings[shelfId] || getDefaultSiteSettings(shelfId);
				const updated = { ...current };
				if (mode === "chapter") {
					updated.autoAddStatusChapter = e.target.value;
				} else {
					updated.autoAddStatusNovel = e.target.value;
				}
				siteSettings[shelfId] = updated;
				await saveSiteSettings(siteSettings);
			});
		});

		list.appendChild(row);
	});
}

function renderWebsiteSettingsPanels_() {
	const container = $("ls-website-settings-panels");
	if (!container) return;

	container.innerHTML = "";

	WEBSITE_SETTINGS_DEFINITIONS.forEach((def) => {
		const stored = siteSettings[def.id] || {};
		const wrapper = document.createElement("div");
		wrapper.innerHTML = renderWebsiteSettingsPanel(def, stored);
		container.appendChild(wrapper);
	});

	// Wire up favicon error fallback (no inline onerror — CSP violation)
	container
		.querySelectorAll("img.ls-handler-panel-icon[data-emoji]")
		.forEach((img) => {
			img.addEventListener("error", () => {
				const span = document.createElement("span");
				span.className = "ls-handler-panel-icon ls-handler-panel-emoji";
				span.textContent = img.dataset.emoji;
				img.replaceWith(span);
			});
		});

	// Wire up setting changes
	container
		.querySelectorAll("input[data-setting], select[data-setting]")
		.forEach((input) => {
			input.addEventListener("change", async (e) => {
				const shelfId = e.target.dataset.shelf;
				const settKey = e.target.dataset.setting;
				if (!shelfId || !settKey) return;
				const current = siteSettings[shelfId] || {};
				const val =
					e.target.type === "checkbox"
						? e.target.checked
						: e.target.value;
				siteSettings[shelfId] = { ...current, [settKey]: val };
				await saveSiteSettings(siteSettings);
				const siteDef = WEBSITE_SETTINGS_DEFINITIONS.find(
					(d) => d.id === shelfId,
				);
				showToast(
					`✅ ${siteDef?.label || shelfId} setting saved`,
					"success",
				);
			});
		});
}

// ── Load: Backup Checkboxes ───────────────────────────────────────────────────
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

// ── Load: Rolling Backups ─────────────────────────────────────────────────────
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
				<div style="font-size:11px;color:#aaa;">${b.novelCount} novels • ${b.reason}</div>
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
				showToast("✅ Backup restored!", "success");
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

// ── Load: Rolling Backup Status Indicator ─────────────────────────────────────
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
			if (statusIcon) statusIcon.textContent = "⏳";
			if (statusText)
				statusText.textContent = "Waiting for first backup…";
			if (countdownContainer) countdownContainer.style.display = "none";
			if (lastBackupTimeDiv) lastBackupTimeDiv.style.display = "none";
			return;
		}

		const lastMs = lastEntry.timestamp;
		const nextMs = lastMs + intervalMinutes * 60000;
		const nowMs = Date.now();

		if (nowMs >= nextMs) {
			if (statusIcon) statusIcon.textContent = "📅";
			if (statusText) statusText.textContent = "Backup due now";
			if (countdownContainer) countdownContainer.style.display = "none";
		} else {
			const remainMs = nextMs - nowMs;
			const remainMins = Math.floor(remainMs / 60000);
			const remainSecs = Math.floor((remainMs % 60000) / 1000);
			if (statusIcon) statusIcon.textContent = "⏳";
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

// ── Load: Google Drive UI ─────────────────────────────────────────────────────
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
			uriListEl.innerHTML = uris
				.map(
					(uri) =>
						`<div style="display:flex;align-items:center;gap:6px;">
							<code style="flex:1;font-size:10px;background:var(--bg-secondary);padding:3px 6px;border-radius:4px;word-break:break-all;">${uri}</code>
							<button class="ls-btn ls-btn-sm ls-btn-secondary copy-redirect-uri-btn" data-uri="${uri}" title="Copy" style="min-width:32px;flex-shrink:0;">📋</button>
						</div>`,
				)
				.join("");
			uriListEl
				.querySelectorAll(".copy-redirect-uri-btn")
				.forEach((btn) => {
					btn.addEventListener("click", () => {
						navigator.clipboard
							.writeText(btn.dataset.uri)
							.then(() =>
								showToast("✅ Redirect URI copied!", "success"),
							)
							.catch(() =>
								showToast("❌ Failed to copy", "error"),
							);
					});
				});
		}
	} catch (_) {
		// identity API not available in this context — fail silently
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

		const mode = tokens.backupMode || "scheduled";
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
			driveStatus.textContent = "🟢 Connected";
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
				driveStatus.textContent = "🔴 Auth failed";
				driveStatus.style.color = "#f59e0b";
				const authErr = $("driveAuthError");
				if (authErr) {
					authErr.textContent = authErrMsg;
					authErr.style.display = "block";
				}
			} else {
				driveStatus.textContent = "⚫ Disconnected";
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

// ── URL Import helpers ────────────────────────────────────────────────────────
function extractUrlsFromText(text) {
	const urlRegex = /https?:\/\/[^\s<>"',]+/gi;
	return [...new Set(text.match(urlRegex) || [])];
}

function filterSupportedUrls(urls) {
	return urls.filter((url) => {
		try {
			return isSupportedDomain(new URL(url).hostname);
		} catch {
			return false;
		}
	});
}

async function addUrlsToLibrary(urls) {
	let added = 0,
		failed = 0;
	for (const url of urls) {
		try {
			await browser.tabs.create({ url, active: false });
			added++;
		} catch {
			failed++;
		}
	}
	return { added, failed };
}

// ── Legacy export / import / clear ───────────────────────────────────────────
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
		showToast("✅ Library exported", "success");
	} catch (err) {
		debugError("Export failed:", err);
		showToast("❌ Export failed: " + err.message, "error");
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
			`✅ Imported ${novels.length} novels (${mode} mode)`,
			"success",
		);
	} catch (err) {
		debugError("Import failed:", err);
		showToast("❌ Import failed: " + err.message, "error");
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
		showToast("❌ Failed to clear library: " + err.message, "error");
	}
}

// ── Google Drive handlers ─────────────────────────────────────────────────────
async function handleConnectDrive() {
	const btn = $("connectDriveBtn");
	try {
		if (btn) {
			btn.disabled = true;
			btn.textContent = "🔗 Connecting…";
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
			await browser.storage.local.set({
				driveAutoRestoreEnabled: true,
				driveAutoRestoreMergeMode: "merge",
			});
			showToast("✅ Google Drive connected!", "success");
			await updateDriveUI();
		} else {
			throw new Error(response?.error || "Authentication failed");
		}
	} catch (err) {
		debugError("Connect Drive failed:", err);
		showToast(`❌ Drive connect failed: ${err.message}`, "error");
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.textContent = "🔗 Connect Google Drive";
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
		showToast("❌ Failed to disconnect: " + err.message, "error");
	}
}

// ── Copy Format Tab ───────────────────────────────────────────────────────────
async function initCopyFormatTab() {
	// ── Helpers ────────────────────────────────────────────────────────────────
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

	// ── Load real library novels for live preview ──────────────────────────────
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

	// ── Unified Export template ───────────────────────────────────────────────
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
				`<button type="button" class="ls-btn ls-btn-sm ls-btn-secondary${t.recommended ? " ls-btn-accent" : ""}" data-export-token="${escHtml(t.token)}" title="${escHtml(t.desc)} — e.g. ${escHtml(t.example)}" style="font-family:monospace;">${escHtml(t.token)}</button>`,
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
				showToast("✅ Copy format saved!", "success");
			} catch (err) {
				showToast("❌ Failed to save: " + err.message, "error");
			}
		});
	}

	// ── Per-site overrides section ────────────────────────────────────────────
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
							<span>${shelf.emoji || "🌐"}</span>
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

// ── Event Listeners ───────────────────────────────────────────────────────────
function setupEventListeners() {
	// ── Theme ──────────────────────────────────────────────────────────────────

	// Sync color pickers <→ text inputs
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

	// Mode pill buttons — update hidden select, sync pills, auto-adjust colors
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

	// Auto schedule time inputs — use both change and input for responsiveness
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
				showToast("✅ Theme saved!", "success");
			} catch (err) {
				showToast("❌ Failed to save theme: " + err.message, "error");
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
						"⚠️ Enter a name for the custom preset",
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
					emoji: "🎨",
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
				// Reload controls — dropdown now shows the new preset selected
				await loadLibraryThemeControls();
				showToast(`✅ Custom preset “${name}” saved!`, "success");
			} catch (err) {
				showToast("❌ Failed to save preset: " + err.message, "error");
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
					showToast("⚠️ Select a custom preset to delete", "warning");
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
					"❌ Failed to delete preset: " + err.message,
					"error",
				);
			}
		});
	}

	// Reset Theme button — resets colours+mode but keeps custom presets
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

	// Hidden mode <select> change — kept for backward compat; pills also fire this
	const themeMode = $("library-theme-mode");
	if (themeMode) {
		themeMode.addEventListener("change", () => {
			syncModePills(themeMode.value);
			setThemeVariables(readCurrentThemeFromUI());
		});
	}

	// Theme preset skin change — live-preview + auto-save
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
						bgSecondary: "", // Clear overrides — let preset defaults apply
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

	// ── AI Model ───────────────────────────────────────────────────────────────

	// Test API Key
	const testKeyBtn = $("library-test-api-key");
	if (testKeyBtn) {
		testKeyBtn.addEventListener("click", async () => {
			const key = libraryApiKeys[0] || "";
			if (!key) {
				showToast("⚠️ Add an API key first", "error");
				return;
			}
			testKeyBtn.disabled = true;
			testKeyBtn.textContent = "Testing…";
			try {
				const models = await fetchLibraryModels(key);
				if (models && models.length > 0) {
					showToast(
						`✅ API key valid — ${models.length} models available`,
						"success",
					);
				} else {
					showToast("⚠️ Key accepted but no models found", "error");
				}
			} catch (err) {
				showToast("❌ API key test failed: " + err.message, "error");
			} finally {
				testKeyBtn.disabled = false;
				testKeyBtn.textContent = "Test";
			}
		});
	}

	// Refresh models
	const refreshModelsBtn = $("library-refresh-models");
	if (refreshModelsBtn) {
		refreshModelsBtn.addEventListener("click", async () => {
			const key = libraryApiKeys[0] || "";
			if (!key) {
				showToast("⚠️ Add an API key first", "error");
				return;
			}
			refreshModelsBtn.disabled = true;
			refreshModelsBtn.textContent = "↻ Loading…";
			await updateLibraryModelSelector(key);
			refreshModelsBtn.disabled = false;
			refreshModelsBtn.textContent = "↻ Refresh";
			showToast("✅ Models refreshed", "success");
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
			const endpoint =
				match?.endpoint ||
				(selectedId
					? `https://generativelanguage.googleapis.com/v1beta/models/${selectedId}:generateContent`
					: "");
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
				showToast("📋 Endpoint copied!", "success");
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

	// ── API Keys (Unified) ─────────────────────────────────────────────────────

	const addKeyBtn = $("library-add-api-key");
	if (addKeyBtn) {
		addKeyBtn.addEventListener("click", async () => {
			const newKey = $("library-new-api-key")?.value?.trim();
			if (!newKey) {
				showToast("⚠️ Enter a key first", "error");
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
			showToast("✅ API key added", "success");
		});
	}

	const rotSel = $("library-api-key-rotation");
	if (rotSel) {
		rotSel.addEventListener("change", async () => {
			await browser.storage.local.set({ apiKeyRotation: rotSel.value });
		});
	}

	// ── URL Import ─────────────────────────────────────────────────────────────

	const urlImportBtn = $("url-import-btn");
	const urlImportText = $("url-import-text");
	const urlImportStatus = $("url-import-status");

	if (urlImportBtn && urlImportText) {
		urlImportBtn.addEventListener("click", async () => {
			const raw = urlImportText.value || "";
			const extracted = extractUrlsFromText(raw);
			const supported = filterSupportedUrls(extracted);

			if (urlImportStatus) {
				urlImportStatus.textContent =
					supported.length === 0
						? "No supported URLs found."
						: `Found ${supported.length} supported URL(s). Adding…`;
			}
			if (supported.length === 0) return;
			const results = await addUrlsToLibrary(supported);
			if (urlImportStatus) {
				urlImportStatus.textContent = `Added ${results.added}, failed ${results.failed}.`;
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

	// ── Legacy Data Management ─────────────────────────────────────────────────

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

	// ── Comprehensive Backup ───────────────────────────────────────────────────

	const createCBBtn = $("createComprehensiveBackup");
	if (createCBBtn) {
		createCBBtn.addEventListener("click", async () => {
			try {
				createCBBtn.disabled = true;
				createCBBtn.textContent = "⏳ Creating…";
				const backup = await createComprehensiveBackup({
					type: BACKUP_OPTIONS.FULL,
					includeApiKeys: $("backupIncludeApiKeys")?.checked ?? true,
					includeCredentials:
						$("backupIncludeCredentials")?.checked ?? true,
				});
				downloadBackupAsFile(backup);
				showToast(
					`✅ Full backup downloaded (${backup.metadata.novelCount} novels)`,
					"success",
				);
			} catch (err) {
				debugError("Comprehensive backup failed:", err);
				showToast(`❌ Backup failed: ${err.message}`, "error");
			} finally {
				createCBBtn.disabled = false;
				createCBBtn.textContent = "💾 Full Backup";
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
					confirmMsg += `📦 Backup Version: ${backup.extensionVersion}\n`;
				if (backup.version)
					confirmMsg += `📋 Format Version: ${backup.version}\n`;
				confirmMsg += `📚 ${novelCount} novels\n`;
				confirmMsg += `🔑 API Key: ${hasApiKey ? "Yes" : "No"}\n`;
				confirmMsg += `🔐 OAuth Credentials: ${hasCredentials ? "Yes" : "No"}\n\n`;
				confirmMsg += "Mode: MERGE (preserves existing data)";

				if (!confirm(confirmMsg)) {
					e.target.value = "";
					return;
				}

				const mode =
					document.querySelector('input[name="mergeMode"]:checked')
						?.value || "merge";
				await restoreComprehensiveBackup(backup, { mode });
				showToast(`✅ Backup restored (${mode} mode)!`, "success");
			} catch (err) {
				debugError("Restore failed:", err);
				showToast(`❌ Restore failed: ${err.message}`, "error");
			}
			e.target.value = "";
		});
	}

	// ── Rolling Backup Controls ────────────────────────────────────────────────

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
				createRollingBtn.textContent = "⏳ Creating…";
				await createRollingBackup("manual");
				await loadRollingBackups();
				await initializeRollingBackupStatus();
				showToast("✅ Rolling backup created!", "success");
			} catch (err) {
				showToast(`❌ Failed: ${err.message}`, "error");
			} finally {
				createRollingBtn.disabled = false;
				createRollingBtn.textContent = "➕ Create Rolling Backup Now";
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

	// ── Google Drive ───────────────────────────────────────────────────────────

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
				backupNowBtn.textContent = "📤 Backing up…";
				const response = await browser.runtime.sendMessage({
					action: "uploadLibraryBackupToDrive",
					folderId: null,
					reason: "manual",
				});
				if (response?.success) {
					showToast("✅ Backed up to Google Drive!", "success");
				} else {
					throw new Error(response?.error || "Backup failed");
				}
			} catch (err) {
				showToast(`❌ Drive backup failed: ${err.message}`, "error");
			} finally {
				backupNowBtn.disabled = false;
				backupNowBtn.textContent = "📤 Backup Now";
			}
		});
	}

	const syncFromDriveBtn = $("library-sync-from-drive-btn");
	if (syncFromDriveBtn) {
		syncFromDriveBtn.addEventListener("click", async () => {
			try {
				syncFromDriveBtn.disabled = true;
				syncFromDriveBtn.textContent = "🔄 Syncing…";
				const response = await browser.runtime.sendMessage({
					action: "syncDriveNow",
					reason: "manual",
				});
				if (response?.success) {
					showToast("✅ Synced from Google Drive!", "success");
				} else {
					throw new Error(response?.error || "Sync failed");
				}
			} catch (err) {
				showToast(`❌ Sync failed: ${err.message}`, "error");
			} finally {
				syncFromDriveBtn.disabled = false;
				syncFromDriveBtn.textContent = "🔄 Sync from Drive";
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
					)?.value || "scheduled";
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

	// View Drive backups — toggle the inline <details> collapsible
	const viewBackupsBtn = $("library-view-backups-btn");
	if (viewBackupsBtn) {
		viewBackupsBtn.addEventListener("click", () => {
			const section = $("drive-backups-section");
			if (section) {
				section.open = !section.open;
				if (section.open) {
					loadDriveBackupsList();
					section.scrollIntoView({
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
					showToast("⚠️ Paste your JSON first", "error");
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
				showToast("✅ JSON parsed — review and save", "success");
			} catch (err) {
				showToast(`❌ Parse failed: ${err.message}`, "error");
			}
		});
	}

	const saveFromJsonBtn = $("saveOAuthFromJson");
	if (saveFromJsonBtn) {
		saveFromJsonBtn.addEventListener("click", async () => {
			try {
				const json = $("oauthJsonPaste")?.value?.trim();
				if (!json) {
					showToast("⚠️ Paste your JSON first", "error");
					return;
				}
				const creds = parseOAuthCredentials(json);
				if (!creds.clientId)
					throw new Error("No Client ID found in JSON");
				await browser.storage.local.set({
					driveClientId: creds.clientId,
					driveClientSecret: creds.clientSecret || "",
				});
				showToast("✅ OAuth credentials saved from JSON!", "success");
				await updateDriveUI();
			} catch (err) {
				showToast(`❌ Save failed: ${err.message}`, "error");
			}
		});
	}

	const saveOAuthBtn = $("saveOAuthSettings");
	if (saveOAuthBtn) {
		saveOAuthBtn.addEventListener("click", async () => {
			const clientId = $("driveClientId")?.value?.trim();
			const clientSecret = $("driveClientSecret")?.value?.trim() || "";
			if (!clientId) {
				showToast("⚠️ Client ID is required", "error");
				return;
			}
			await browser.storage.local.set({
				driveClientId: clientId,
				driveClientSecret: clientSecret,
			});
			showToast("✅ OAuth credentials saved!", "success");
		});
	}

	// Toggle client secret visibility
	const toggleSecretBtn = $("toggleClientSecretVisibility");
	if (toggleSecretBtn) {
		toggleSecretBtn.addEventListener("click", () => {
			const el = $("driveClientSecret");
			if (!el) return;
			el.type = el.type === "password" ? "text" : "password";
			toggleSecretBtn.textContent = el.type === "password" ? "👁️" : "🙈";
		});
	}

	// ── Carousel ───────────────────────────────────────────────────────────────

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

	// ── Auto-Hold ──────────────────────────────────────────────────────────────

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

	// ── Periodic Chapter Check ─────────────────────────────────────────────────

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

	// ── Prompts ────────────────────────────────────────────────────────────────

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
			showToast("✅ Prompt reset to default", "success");
		});
	});

	// ── Telemetry ──────────────────────────────────────────────────────────────

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

	// ── Debug ──────────────────────────────────────────────────────────────────

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

	// ── Processing Options (Chunking) ──────────────────────────────────────────

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

	// ── AI Parameters ──────────────────────────────────────────────────────────

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
				showToast("📋 Endpoint copied!", "success");
			}
		});
	}

	// ── Factory Reset ──────────────────────────────────────────────────────────

	const factoryResetBtn = $("library-factory-reset-btn");
	if (factoryResetBtn) {
		factoryResetBtn.addEventListener("click", async () => {
			const msg =
				"⚠️ FACTORY RESET ⚠️\n\nThis will permanently delete:\n" +
				"• All novels from your library\n" +
				"• All enhanced chapters and summaries\n" +
				"• Google Drive OAuth credentials\n" +
				"• All local and browser-stored backups\n" +
				"• All settings and preferences\n\n" +
				"Type 'RESET' to confirm:";
			const input = prompt(msg);
			if (input?.trim() !== "RESET") return;
			try {
				await browser.storage.local.clear();
				showToast("🔥 Factory reset complete. Reloading…", "info");
				setTimeout(() => location.reload(), 1500);
			} catch (err) {
				showToast(`❌ Reset failed: ${err.message}`, "error");
			}
		});
	}

	// ── Storage change listener ────────────────────────────────────────────────
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

// ── Google Drive Backups List ─────────────────────────────────────────────────
async function loadDriveBackupsList() {
	const listEl = $("drive-backups-list");
	if (!listEl) return;
	listEl.innerHTML =
		'<div style="padding:20px;text-align:center;color:var(--text-secondary);">Loading Drive backups…</div>';
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
					btn.textContent = "Restoring…";
					const res = await browser.runtime.sendMessage({
						action: "restoreFromDrive",
						fileId: btn.dataset.id,
						mode: "merge",
					});
					if (res?.success) {
						showToast("✅ Drive backup restored!", "success");
						const section = $("drive-backups-section");
						if (section) section.open = false;
					} else {
						throw new Error(res?.error || "Restore failed");
					}
				} catch (err) {
					showToast(`❌ Restore failed: ${err.message}`, "error");
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

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
	debugLog("⚙️ Library Settings page initialising…");

	// Build navigation
	renderNav();
	activateTabFromUrl();

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
	renderSiteAutoAddSettings();
	renderWebsiteSettingsPanels_();

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

	// Wire up all event listeners
	setupEventListeners();

	// Google Drive UI
	await updateDriveUI();

	// Ensure all range sliders show their fill correctly
	initAllSliderFills();

	debugLog("⚙️ Library Settings page ready.");
}

// Start
document.addEventListener("DOMContentLoaded", init);
