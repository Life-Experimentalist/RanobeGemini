// Simple popup script for Ranobe Gemini

import {
	DEFAULT_PROMPT,
	DEFAULT_SUMMARY_PROMPT,
	DEFAULT_SHORT_SUMMARY_PROMPT,
	DEFAULT_PERMANENT_PROMPT,
	DEFAULT_DRIVE_CLIENT_ID,
} from "../utils/constants.js";
import { novelLibrary, SHELVES } from "../utils/novel-library.js";
import { debugLog, debugError } from "../utils/logger.js";
import {
	getDefaultSiteSettings,
	getSiteSettings,
	isSiteEnabled,
	saveSiteSettings,
} from "../utils/site-settings.js";
import { libraryBackupManager } from "../utils/library-backup-manager.js";

document.addEventListener("DOMContentLoaded", async function () {
	// DOM elements
	const apiKeyInput = document.getElementById("apiKey");
	const saveApiKeyBtn = document.getElementById("saveApiKey");
	const testApiKeyBtn = document.getElementById("testApiKey");
	const enhancePageBtn = document.getElementById("enhancePageBtn");
	const getKeyLink = document.getElementById("getKeyLink");
	const statusDiv = document.getElementById("status");
	const modelSelect = document.getElementById("modelSelect");
	const promptTemplate = document.getElementById("promptTemplate");
	const resetPromptBtn = document.getElementById("resetPrompt");
	const summaryPrompt = document.getElementById("summaryPrompt"); // Get summary prompt textarea
	const resetSummaryPromptBtn = document.getElementById("resetSummaryPrompt"); // Get summary prompt reset button
	const shortSummaryPrompt = document.getElementById("shortSummaryPrompt"); // Get short summary prompt textarea
	const resetShortSummaryPromptBtn = document.getElementById(
		"resetShortSummaryPrompt"
	); // Get short summary prompt reset button
	const permanentPrompt = document.getElementById("permanentPrompt"); // Get permanent prompt textarea
	const resetPermanentPromptBtn = document.getElementById(
		"resetPermanentPrompt"
	); // Get permanent prompt reset button
	const debugModeCheckbox = document.getElementById("debugMode");

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
	const topPSlider = document.getElementById("topPSlider");
	const topPValue = document.getElementById("topPValue");
	const topKSlider = document.getElementById("topKSlider");
	const topKValue = document.getElementById("topKValue");
	const fontSizeSlider = document.getElementById("fontSizeSlider");
	const fontSizeValue = document.getElementById("fontSizeValue");
	const customEndpointInput = document.getElementById("customEndpoint");
	const saveAdvancedSettingsBtn = document.getElementById(
		"saveAdvancedSettings"
	);
	const resetAllAdvancedBtn = document.getElementById("resetAllAdvanced");
	const toggleAdvancedParamsBtn = document.getElementById(
		"toggleAdvancedParams"
	);
	const advancedParamsContent = document.getElementById(
		"advancedParamsContent"
	);
	const siteToggleList = document.getElementById("siteToggleList");
	const resetSiteTogglesBtn = document.getElementById("resetSiteToggles");

	// Backup mode controls
	const backupModeScheduled = document.getElementById("backupModeScheduled");
	const backupModeContinuous = document.getElementById(
		"backupModeContinuous"
	);

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
	const autoBackupEnabled = document.getElementById("autoBackupEnabled");
	const backupLocation = document.getElementById("backupLocation");
	const chooseBackupLocation = document.getElementById(
		"chooseBackupLocation"
	);
	const createManualBackup = document.getElementById("createManualBackup");
	const restoreBackupBtn2 = document.getElementById("restoreBackupBtn");
	const backupList = document.getElementById("backupList");
	const mergeModRadios = document.querySelectorAll('input[name="mergeMode"]');

	const CONTINUOUS_BACKUP_DELAY_MINUTES = 5;

	// Receive OAuth tokens from oauth-redirect.html and persist
	window.addEventListener("message", async (event) => {
		if (event.data?.source !== "ranobe-gemini-oauth") return;
		const payload = {
			accessToken: event.data.accessToken,
			expiresAt: event.data.expiresAt,
		};
		try {
			await browser.storage.local.set({ googleOAuth: payload });
			setDriveStatus?.("OAuth token received", "success");
			showStatus("Google OAuth token saved", "success");
		} catch (err) {
			debugError("Failed to store OAuth token", err);
		}
	});

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
		"currentProgressPercent"
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
		"centerSceneHeadings"
	);
	const backupFolderInput = document.getElementById("backupFolder");
	const autoBackupToggle = document.getElementById("autoBackupToggle");
	const manualBackupBtn = document.getElementById("manualBackupBtn");
	const restoreBackupBtn = document.getElementById("restoreBackupBtn");
	const restoreFileInput = document.getElementById("restoreFileInput");
	const backupHistoryList = document.getElementById("backupHistoryList");
	const driveClientIdInput = document.getElementById("driveClientId");
	const driveFolderIdInput = document.getElementById("driveFolderId");
	const driveAuthBtn = document.getElementById("driveAuthBtn");
	const driveUploadLogsBtn = document.getElementById("driveUploadLogsBtn");
	const driveResetBtn = document.getElementById("driveResetBtn");
	const driveStatus = document.getElementById("driveStatus");

	// Google Drive Backup elements
	const connectDriveBtn = document.getElementById("connectDriveBtn");
	const disconnectDriveBtn = document.getElementById("disconnectDriveBtn");
	const backupNowBtn = document.getElementById("backupNowBtn");
	const viewBackupsBtn = document.getElementById("viewBackupsBtn");
	const driveNotConnected = document.getElementById("driveNotConnected");
	const driveConnected = document.getElementById("driveConnected");
	const driveStatusSpan = document.getElementById("driveStatus");
	const driveBackupModeRadios = document.querySelectorAll(
		'input[name="driveBackupMode"]'
	);

	// Theme elements
	const themeModeSelect = document.getElementById("themeMode");
	const accentColorPicker = document.getElementById("accentColorPicker");
	const accentColorText = document.getElementById("accentColorText");
	const accentSecondaryPicker = document.getElementById(
		"accentSecondaryPicker"
	);
	const accentSecondaryText = document.getElementById("accentSecondaryText");
	const backgroundColorPicker = document.getElementById(
		"backgroundColorPicker"
	);
	const backgroundColorText = document.getElementById("backgroundColorText");
	const textColorPicker = document.getElementById("textColorPicker");
	const textColorText = document.getElementById("textColorText");
	const saveThemeBtn = document.getElementById("saveTheme");
	const resetThemeBtn = document.getElementById("resetTheme");

	// Store current page novel data
	let currentPageNovelData = null;
	let currentSiteShelfId = null;
	let siteSettings = {};
	let backupHistory = [];
	const BACKUP_RETENTION = 3;
	const BACKUP_INTERVAL_DAYS = 1;

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
				"(prefers-color-scheme: dark)"
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

	// Initialize theme controls
	syncColorInputs(accentColorPicker, accentColorText);
	syncColorInputs(accentSecondaryPicker, accentSecondaryText);
	syncColorInputs(backgroundColorPicker, backgroundColorText);
	syncColorInputs(textColorPicker, textColorText);

	// Theme event listeners
	if (saveThemeBtn) {
		saveThemeBtn.addEventListener("click", saveTheme);
	}

	if (resetThemeBtn) {
		resetThemeBtn.addEventListener("click", resetTheme);
	}

	if (themeModeSelect) {
		themeModeSelect.addEventListener("change", () => {
			const theme = {
				mode: themeModeSelect.value,
				accentPrimary:
					accentColorPicker?.value || defaultTheme.accentPrimary,
				accentSecondary:
					accentSecondaryPicker?.value ||
					defaultTheme.accentSecondary,
				bgColor: backgroundColorPicker?.value || defaultTheme.bgColor,
				textColor: textColorPicker?.value || defaultTheme.textColor,
			};
			applyTheme(theme);
		});
	}

	// Load theme on startup
	loadTheme();

	await loadSiteToggleSettings();

	// Site toggle helpers
	async function loadSiteToggleSettings() {
		try {
			siteSettings = await getSiteSettings();
		} catch (error) {
			debugError("Failed to load site settings:", error);
			siteSettings = getDefaultSiteSettings();
		}
		renderSiteToggles();
	}

	async function persistSiteToggleSettings() {
		if (!siteToggleList) return siteSettings;
		const updates = {};
		const rows = siteToggleList.querySelectorAll(".site-toggle-row");
		rows.forEach((row) => {
			const siteId = row.dataset.siteId;
			const checkbox = row.querySelector("input[type='checkbox']");
			if (siteId && checkbox) {
				updates[siteId] = { enabled: checkbox.checked };
			}
		});

		if (Object.keys(updates).length === 0) return siteSettings;
		siteSettings = await saveSiteSettings(updates);
		return siteSettings;
	}

	function renderSiteToggles() {
		if (!siteToggleList) return;
		const defaults = getDefaultSiteSettings();
		const shelves = Object.values(SHELVES).sort((a, b) =>
			(a.name || a.id).localeCompare(b.name || b.id)
		);

		siteToggleList.innerHTML = "";

		shelves.forEach((shelf) => {
			const setting = siteSettings[shelf.id] ||
				defaults[shelf.id] || {
					enabled: true,
				};
			const row = document.createElement("label");
			row.className = "site-toggle-row";
			row.dataset.siteId = shelf.id;

			const iconHtml = shelf.icon?.startsWith("http")
				? `<img src="${shelf.icon}" alt="${shelf.name}" onerror="this.remove()">`
				: shelf.emoji || "📖";
			const domainsPreview = (shelf.domains || []).slice(0, 2).join(", ");

			row.innerHTML = `
				<div class="site-toggle-meta">
					<span class="site-toggle-icon">${iconHtml}</span>
					<div>
						<div class="site-toggle-name">${shelf.name || shelf.id}</div>
						<div class="site-toggle-domains">${domainsPreview}</div>
					</div>
				</div>
				<div class="site-toggle-control">
					<input type="checkbox" ${
						setting.enabled !== false ? "checked" : ""
					} aria-label="Enable ${shelf.name || shelf.id}">
				</div>
			`;

			// Add event listener to checkbox
			const checkbox = row.querySelector("input[type='checkbox']");
			if (checkbox) {
				checkbox.addEventListener("change", async () => {
					await persistSiteToggleSettings();
					showStatus(
						`${shelf.name} ${
							checkbox.checked ? "enabled" : "disabled"
						}`,
						"success"
					);
					// Refresh library display if on library tab
					const activeTab = document.querySelector(
						".tab-content.active"
					);
					if (activeTab && activeTab.id === "library") {
						await initializeLibraryTab();
					}
				});
			}

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
				`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
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
							"generateContent"
						)
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
				apiKey ? "present" : "missing"
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
				modelSelect.value
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

	// Tab switching functionality
	tabButtons.forEach((button) => {
		button.addEventListener("click", () => {
			// Remove active class from all buttons and contents
			tabButtons.forEach((btn) => btn.classList.remove("active"));
			tabContents.forEach((content) =>
				content.classList.remove("active")
			);

			// Add active class to clicked button
			button.classList.add("active");

			// Show corresponding content
			const tabId = button.getAttribute("data-tab");
			document.getElementById(tabId).classList.add("active");

			// Special handling for library tab
			if (tabId === "library") {
				initializeLibraryTab();
			}
		});
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
		const data = await browser.storage.local.get();

		if (data.apiKey) {
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
		promptTemplate.value = data.defaultPrompt || DEFAULT_PROMPT;

		// Load summary prompt
		summaryPrompt.value = data.summaryPrompt || DEFAULT_SUMMARY_PROMPT;

		// Load short summary prompt
		if (shortSummaryPrompt) {
			shortSummaryPrompt.value =
				data.shortSummaryPrompt || DEFAULT_SHORT_SUMMARY_PROMPT;
		}

		// Load permanent prompt
		permanentPrompt.value =
			data.permanentPrompt || DEFAULT_PERMANENT_PROMPT;

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
		if (driveFolderIdInput) {
			driveFolderIdInput.value = data.driveFolderId || "";
		}
		if (driveStatus) {
			driveStatus.textContent = data.driveAuthTokens
				? "Drive tokens cached"
				: "Not signed in";
		}

		// Set debug mode checkbox
		debugModeCheckbox.checked = data.debugMode || false;

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
		if (autoBackupToggle)
			autoBackupToggle.checked = data.autoBackupEnabled || false;
		const backupMode = data.backupMode || "scheduled";
		if (backupModeScheduled)
			backupModeScheduled.checked = backupMode === "scheduled";
		if (backupModeContinuous)
			backupModeContinuous.checked = backupMode === "continuous";
		backupHistory = data.backupHistory || [];
		renderBackupHistory();

		// Set API key rotation strategy
		if (apiKeyRotationSelect) {
			apiKeyRotationSelect.value = data.apiKeyRotation || "failover";
		}
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
					"error"
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
		const maxTokens = data?.maxOutputTokens || 8192;
		const temperature = parseFloat(temperatureSlider.value);

		if (!apiKey) {
			showStatus("Please enter a valid API key", "error");
			return;
		}

		try {
			// Determine model endpoint based on selection
			let modelEndpoint;

			// Try to find the model endpoint from stored available models
			const storedData = await browser.storage.local.get(
				"availableModels"
			);
			if (storedData.availableModels) {
				const selectedModel = storedData.availableModels.find(
					(m) => m.id === selectedModelId
				);
				if (selectedModel) {
					modelEndpoint = selectedModel.endpoint;
				}
			}

			// Fallback to constructing the endpoint if not found
			if (!modelEndpoint) {
				modelEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModelId}:generateContent`;
			}

			await browser.storage.local.set({
				apiKey: apiKey,
				selectedModelId: selectedModelId,
				modelEndpoint: modelEndpoint,
				debugMode: debugModeCheckbox.checked,
				useEmoji: useEmojiCheckbox ? useEmojiCheckbox.checked : false, // Save emoji setting
				formatGameStats: formatGameStatsInput?.checked !== false, // default true
				centerSceneHeadings:
					centerSceneHeadingsInput?.checked !== false, // default true
				maxOutputTokens: maxTokens,
				temperature: temperature,
				chunkingEnabled: chunkingEnabledInput?.checked !== false,
				chunkSize: chunkSizeInput
					? Math.min(
							Math.max(
								parseInt(chunkSizeInput.value, 10) || 20000,
								5000
							),
							50000
					  )
					: 20000,
			});

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
					"error"
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
					siteSettings = await saveSiteSettings(
						getDefaultSiteSettings()
					);
					renderSiteToggles();
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
					"error"
				);
			}
		});
	}

	if (resetSiteTogglesBtn) {
		resetSiteTogglesBtn.addEventListener("click", async () => {
			siteSettings = await saveSiteSettings(getDefaultSiteSettings());
			renderSiteToggles();
			showStatus("Site toggles restored to defaults", "success");
		});
	}

	// Reset prompt to default
	resetPromptBtn.addEventListener("click", () => {
		promptTemplate.value = DEFAULT_PROMPT;
		showStatus("Enhancement prompt reset to default", "info");
	});

	// Reset summary prompt to default
	resetSummaryPromptBtn.addEventListener("click", () => {
		summaryPrompt.value = DEFAULT_SUMMARY_PROMPT;
		showStatus("Summary prompt reset to default", "info");
	});

	// Reset short summary prompt to default
	if (resetShortSummaryPromptBtn) {
		resetShortSummaryPromptBtn.addEventListener("click", () => {
			if (shortSummaryPrompt) {
				shortSummaryPrompt.value = DEFAULT_SHORT_SUMMARY_PROMPT;
				showStatus("Short summary prompt reset to default", "info");
			}
		});
	}

	// Reset permanent prompt to default
	resetPermanentPromptBtn.addEventListener("click", () => {
		permanentPrompt.value = DEFAULT_PERMANENT_PROMPT;
		showStatus("Permanent prompt reset to default", "info");
	});

	// Full Prompt Preview functionality
	const fullPromptPreview = document.getElementById("fullPromptPreview");
	const refreshPromptPreviewBtn = document.getElementById(
		"refreshPromptPreview"
	);
	const copyFullPromptBtn = document.getElementById("copyFullPrompt");

	function generateFullPromptPreview() {
		if (!fullPromptPreview) return;

		const enhancementPrompt = promptTemplate?.value || DEFAULT_PROMPT;
		const permPrompt = permanentPrompt?.value || DEFAULT_PERMANENT_PROMPT;

		// Get site-specific prompts
		let sitePrompts = "";
		const sitePromptsContainer = document.getElementById(
			"siteSpecificPromptsContainer"
		);
		if (sitePromptsContainer) {
			const sitePromptItems =
				sitePromptsContainer.querySelectorAll(".site-prompt-item");
			sitePromptItems.forEach((item) => {
				const siteName = item.querySelector(".site-name")?.value;
				const sitePromptContent = item.querySelector(
					".site-prompt-content"
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

	if (refreshPromptPreviewBtn) {
		refreshPromptPreviewBtn.addEventListener(
			"click",
			generateFullPromptPreview
		);
	}

	if (copyFullPromptBtn) {
		copyFullPromptBtn.addEventListener("click", async () => {
			generateFullPromptPreview();
			try {
				await navigator.clipboard.writeText(
					fullPromptPreview.textContent
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
		".prompt-preview-section"
	);
	if (promptPreviewSection) {
		promptPreviewSection.addEventListener("toggle", (e) => {
			if (e.target.open) {
				generateFullPromptPreview();
			}
		});
	}

	// Enhance current page
	enhancePageBtn.addEventListener("click", async () => {
		try {
			const data = await browser.storage.local.get("apiKey");
			if (!data.apiKey) {
				showStatus("Please save an API key first", "error");
				return;
			}

			const tabs = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (tabs[0]) {
				showStatus("Processing page...", "info");

				try {
					// First ping the content script to make sure it's responsive
					const processResponse = await browser.tabs.sendMessage(
						tabs[0].id,
						{ action: "processWithGemini" }
					);

					if (processResponse && processResponse.success) {
						showStatus("Page enhancement started!", "success");
					} else {
						showStatus(
							"Error: " +
								(processResponse?.error || "Unknown error"),
							"error"
						);
					}
				} catch (error) {
					debugError("Communication error:", error);

					if (
						error.message?.includes(
							"could not establish connection"
						)
					) {
						showStatus(
							"Error: This page is not supported by the extension.",
							"error"
						);
					} else {
						showStatus("Error: " + error.message, "error");
					}
				}
			}
		} catch (error) {
			debugError("Error enhancing page:", error);
			showStatus("Error enhancing page: " + error.message, "error");
		}
	});

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
					"error"
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

	// Helper function to show status messages
	function showStatus(message, type) {
		statusDiv.textContent = message;
		statusDiv.className = type || "";

		// Auto clear success messages after 3 seconds
		if (type === "success") {
			setTimeout(() => {
				statusDiv.textContent = "";
				statusDiv.className = "";
			}, 3000);
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
	 * Load novels from storage and display them grouped by domain
	 */
	async function loadNovels() {
		showStatus("Loading novels...", "info");

		try {
			// Get novels from storage
			const result = await browser.storage.local.get(["novelHistory"]);
			const novels = result.novelHistory || {};

			if (Object.keys(novels).length === 0) {
				novelsListContainer.innerHTML =
					'<div class="no-novels">No novels found in your reading history.</div>';
				showStatus("No novels found in your reading history.", "info");
				return;
			}

			// Clear the novels list
			novelsListContainer.innerHTML = "";

			// Group novels by domain
			const novelsByDomain = {};
			Object.entries(novels).forEach(([novelId, novel]) => {
				const domain = novel.domain || extractDomain(novel.url || "");
				if (!novelsByDomain[domain]) {
					novelsByDomain[domain] = [];
				}
				novelsByDomain[domain].push([novelId, novel]);
			});

			// Sort domains by most recently read novel
			const sortedDomains = Object.entries(novelsByDomain).sort(
				(a, b) => {
					const latestA = Math.max(
						...a[1].map(([_, novel]) =>
							new Date(
								novel.lastRead || "1970-01-01T00:00:00.000Z"
							).getTime()
						)
					);
					const latestB = Math.max(
						...b[1].map(([_, novel]) =>
							new Date(
								novel.lastRead || "1970-01-01T00:00:00.000Z"
							).getTime()
						)
					);
					return latestB - latestA;
				}
			);

			// Create domain sections
			sortedDomains.forEach(([domain, domainNovels]) => {
				const shelf = getShelfByDomain(domain);
				if (shelf && !isSiteEnabled(siteSettings, shelf.id)) {
					return;
				}
				// Sort novels within domain by last read
				const sortedNovels = domainNovels.sort((a, b) => {
					const lastReadA =
						a[1].lastRead || "1970-01-01T00:00:00.000Z";
					const lastReadB =
						b[1].lastRead || "1970-01-01T00:00:00.000Z";
					return new Date(lastReadB) - new Date(lastReadA);
				});

				// Create domain section
				const domainSection = createDomainSection(domain, sortedNovels);
				novelsListContainer.appendChild(domainSection);
			});

			showStatus(
				`Loaded ${Object.keys(novels).length} novels from ${
					sortedDomains.length
				} sites.`,
				"success"
			);

			// Add event listeners for domain toggles
			document.querySelectorAll(".domain-toggle").forEach((toggle) => {
				toggle.addEventListener("click", function () {
					const section = this.closest(".domain-section");
					const novelsList = section.querySelector(".domain-novels");
					novelsList.classList.toggle("collapsed");
					const icon = this.querySelector(".toggle-icon");
					icon.textContent = novelsList.classList.contains(
						"collapsed"
					)
						? "▶"
						: "▼";
				});
			});

			// Add event listeners for chapter toggles
			document
				.querySelectorAll(".novel-chapters-toggle")
				.forEach((toggle) => {
					toggle.addEventListener("click", function () {
						const chapters =
							this.closest(".novel-item").querySelector(
								".novel-chapters"
							);
						chapters.classList.toggle("active");
						this.textContent = chapters.classList.contains("active")
							? "▲ Hide Chapters"
							: "▼ Show Chapters";
					});
				});

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
								(id) => id !== novelId
							);
						}

						await browser.storage.local.set({ autoEnhanceNovels });
						debugLog(
							"Auto-enhance updated for:",
							novelId,
							this.checked
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
	 * Create a domain section element
	 * @param {string} domain - Domain name
	 * @param {Array} novels - Array of [novelId, novel] tuples
	 * @returns {HTMLElement} - The domain section element
	 */
	function createDomainSection(domain, novels) {
		const section = document.createElement("div");
		section.className = "domain-section";

		// Get shelf info for icon
		const shelf = getShelfByDomain(domain);
		const shelfIcon = shelf ? shelf.icon : "📖";
		const shelfName = shelf ? shelf.name : domain;
		const iconHtml = renderDomainIcon(shelfIcon);

		const header = document.createElement("div");
		header.className = "domain-header domain-toggle";
		header.innerHTML = `
			<span class="toggle-icon">▼</span>
			${iconHtml}
			<span class="domain-name">${shelfName}</span>
			<span class="domain-count">${novels.length} ${
			novels.length === 1 ? "novel" : "novels"
		}</span>
		`;

		const novelsList = document.createElement("div");
		novelsList.className = "domain-novels";

		novels.forEach(([novelId, novel]) => {
			const novelItem = createNovelItem(novelId, novel);
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
	function createNovelItem(novelId, novel) {
		const novelItem = document.createElement("div");
		novelItem.className = "novel-item";

		const bookTitle = novel.bookTitle || "Unknown Title";
		const author = novel.author || "Unknown Author";
		const lastRead = novel.lastRead
			? formatRelativeTime(novel.lastRead)
			: "Never";

		// Build extended info HTML
		let extendedInfoHtml = "";
		if (
			novel.description ||
			novel.rating ||
			novel.wordCount ||
			novel.genres?.length > 0
		) {
			extendedInfoHtml = '<div class="novel-extended-info">';

			if (novel.description) {
				const shortDesc =
					novel.description.length > 200
						? novel.description.substring(0, 200) + "..."
						: novel.description;
				extendedInfoHtml += `<div class="novel-description">${shortDesc}</div>`;
			}

			const statsItems = [];
			if (novel.rating) statsItems.push(`Rating: ${novel.rating}`);
			if (novel.language) statsItems.push(`Language: ${novel.language}`);
			if (novel.wordCount)
				statsItems.push(`Words: ${novel.wordCount.toLocaleString()}`);
			if (novel.completed !== undefined)
				statsItems.push(novel.completed ? "✓ Complete" : "Ongoing");

			if (statsItems.length > 0) {
				extendedInfoHtml += `<div class="novel-stats">${statsItems.join(
					" • "
				)}</div>`;
			}

			const engagementItems = [];
			if (novel.reviews) engagementItems.push(`${novel.reviews} reviews`);
			if (novel.favorites)
				engagementItems.push(`${novel.favorites} favs`);
			if (novel.follows) engagementItems.push(`${novel.follows} follows`);

			if (engagementItems.length > 0) {
				extendedInfoHtml += `<div class="novel-engagement">${engagementItems.join(
					" • "
				)}</div>`;
			}

			if (novel.genres && novel.genres.length > 0) {
				const genreTags = novel.genres
					.map((g) => `<span class="genre-tag">${g}</span>`)
					.join("");
				extendedInfoHtml += `<div class="novel-genres">${genreTags}</div>`;
			}

			extendedInfoHtml += "</div>";
		}

		// Create chapters list
		const chaptersHtml =
			novel.chapters && novel.chapters.length > 0
				? createChaptersListHtml(novel.chapters, novel.url)
				: '<div style="padding: 10px; font-style: italic;">No chapter history available</div>';

		novelItem.innerHTML = `
			<div class="novel-meta">
				<span class="novel-last-read">Last read: ${lastRead}</span>
			</div>
			<div class="novel-title">${bookTitle}</div>
			<div class="novel-info">
				<span>Author: ${author}</span>
				<div>Chapters read: ${novel.chapters ? novel.chapters.length : 0}</div>
			</div>
			${extendedInfoHtml}
			<div class="novel-actions">
				<button class="novel-chapters-toggle">▼ Show Chapters</button>
				${
					novel.currentChapterUrl
						? `<a href="${novel.currentChapterUrl}" target="_blank" style="text-decoration: none;"><button>Continue Reading</button></a>`
						: ""
				}
				<label class="auto-enhance-label" title="Auto-enhance this novel's chapters">
					<input type="checkbox" class="auto-enhance-checkbox" data-novel-id="${novelId}">
					Auto-Enhance
				</label>
			</div>
			<div class="novel-chapters">${chaptersHtml}</div>
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

		// Limit to 10 most recent chapters
		const recentChapters = sortedChapters.slice(0, 10);

		if (recentChapters.length === 0) {
			return '<div style="padding: 10px; font-style: italic;">No chapter history available</div>';
		}

		return recentChapters
			.map((chapter) => {
				const chapterTitle = chapter.title || "Unnamed Chapter";
				const chapterDate = chapter.date
					? formatCompleteDate(chapter.date)
					: "Unknown date";
				const chapterUrl = chapter.url || novelUrl;

				return `
				<div class="chapter-item">
					<a href="${chapterUrl}" class="chapter-link" target="_blank">${chapterTitle}</a>
					<span class="chapter-date">${chapterDate}</span>
				</div>
			`;
			})
			.join("");
	}

	// Add event listener for refresh novels button
	if (refreshNovelsBtn) {
		refreshNovelsBtn.addEventListener("click", () => {
			loadLibrary();
			loadNovels();
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
					matchDomainPattern(hostname, pattern)
				)
			);
			if (shelf && !isSiteEnabled(siteSettings, shelf.id)) {
				return null;
			}
			return shelf;
		} catch (e) {
			return null;
		}
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
			// Get current tab
			const tabs = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (!tabs[0]) {
				showNotSupported("No active tab");
				return;
			}

			const currentTab = tabs[0];
			const { hostname: currentHostname } = new URL(currentTab.url);
			const rawShelfMatch = Object.values(SHELVES).find((shelf) =>
				(shelf.domains || []).some((pattern) =>
					matchDomainPattern(currentHostname, pattern)
				)
			);
			const siteDisabled =
				rawShelfMatch && !isSiteEnabled(siteSettings, rawShelfMatch.id);
			const shelfForTab = siteDisabled ? null : rawShelfMatch;

			if (siteDisabled) {
				showNotSupported(
					"This site is disabled in settings. Re-enable it in Advanced → Site Toggles."
				);
				return;
			}
			const isExtensionPage = currentTab.url.startsWith(
				browser.runtime.getURL("")
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
						response.error || "Could not extract novel info"
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
					error
				);
				if (
					(error.message?.includes(
						"could not establish connection"
					) ||
						error.message?.includes(
							"Receiving end does not exist"
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
				if (
					error.message?.includes("could not establish connection") ||
					error.message?.includes("Receiving end does not exist")
				) {
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

		// Update status badge
		if (pageStatusBadge) {
			if (novelInfo.isInLibrary) {
				pageStatusBadge.textContent = "✓ In Library";
				pageStatusBadge.className = "status-badge in-library";
			} else {
				pageStatusBadge.textContent = "New Novel";
				pageStatusBadge.className = "status-badge new";
			}
		}

		// Get shelf info
		const shelf = novelInfo.shelfId
			? Object.values(SHELVES).find((s) => s.id === novelInfo.shelfId)
			: null;
		const shelfEmoji = shelf?.emoji || "📖";
		const shelfIcon = shelf?.icon;

		// Cover
		if (currentNovelCover) {
			if (novelInfo.coverUrl) {
				currentNovelCover.innerHTML = `<img src="${escapeHtml(
					novelInfo.coverUrl
				)}" alt="Cover" class="cover-image" onerror="this.parentElement.innerHTML='<div class=\\'cover-placeholder\\'>${shelfEmoji}</div>'">`;
			} else {
				const iconHtml =
					shelfIcon && shelfIcon.startsWith("http")
						? `<img src="${escapeHtml(
								shelfIcon
						  )}" alt="" class="cover-site-icon" onerror="this.outerHTML='${shelfEmoji}'">`
						: shelfEmoji;
				currentNovelCover.innerHTML = `<div class="cover-placeholder">${iconHtml}</div>`;
			}
		}

		// Title & Author
		if (currentNovelTitle) {
			currentNovelTitle.textContent = novelInfo.title || "Unknown Title";
			currentNovelTitle.title = novelInfo.title || "";
		}
		if (currentNovelAuthor) {
			currentNovelAuthor.textContent = novelInfo.author
				? `by ${novelInfo.author}`
				: "";
		}

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
							100
					)
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
							readingStatusSelect.value
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
										g
									)}</span>`
							)
							.join("");
						if (moreCount > 0) {
							genresList.innerHTML += `<span class="genre-tag more" title="${escapeHtml(
								genres.slice(3).join(", ")
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
					"success"
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
					"error"
				);
			}
		} catch (error) {
			debugError("Error adding to library:", error);
			showStatus("Error: " + error.message, "error");
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
				showStatus("Status updated!", "success");
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
			// Get library stats
			const stats = await novelLibrary.getStats();
			const enabledShelves = new Set(
				Object.values(SHELVES)
					.filter((shelf) => isSiteEnabled(siteSettings, shelf.id))
					.map((shelf) => shelf.id)
			);

			// Update stats
			if (statNovels) statNovels.textContent = stats.totalNovels || 0;
			if (statChapters)
				statChapters.textContent = stats.totalEnhancedChapters || 0;
			if (statShelves) {
				const activeCount = Object.entries(stats.shelves || {}).filter(
					([id, s]) => enabledShelves.has(id) && s.novelCount > 0
				).length;
				statShelves.textContent = activeCount;
			}

			// Get recent novels
			const allRecentNovels = await novelLibrary.getRecentNovels(20);
			const enabledRecentNovels = allRecentNovels.filter((novel) =>
				enabledShelves.has(novel.shelfId)
			);

			// Filter by current site if applicable
			let displayNovels = enabledRecentNovels;
			let showingSiteSpecific = false;
			let currentShelf = null;

			if (currentSiteShelfId && enabledShelves.has(currentSiteShelfId)) {
				currentShelf = Object.values(SHELVES).find(
					(s) => s.id === currentSiteShelfId
				);
				const siteNovels = allRecentNovels.filter(
					(n) => n.shelfId === currentSiteShelfId
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
									currentShelf.icon
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
								(s) => s.id === novel.shelfId
							);
							const shelfEmoji = shelf?.emoji || "📖";
							const shelfIcon = shelf?.icon;
							const shelfName = shelf?.name || "Unknown";

							// Build cover HTML
							let coverHtml;
							if (novel.coverUrl) {
								coverHtml = `<img src="${escapeHtml(
									novel.coverUrl
								)}" alt="" class="novel-cover-img" onerror="this.outerHTML='<div class=\\'novel-cover-placeholder\\'>${shelfEmoji}</div>'">`;
							} else {
								const iconHtml =
									shelfIcon && shelfIcon.startsWith("http")
										? `<img src="${escapeHtml(
												shelfIcon
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
												shelfIcon
										  )}" alt="" onerror="this.outerHTML='${shelfEmoji}'">`
										: shelfEmoji
								}
							</span>`;

							return `
							<div class="novel-grid-item" data-url="${escapeHtml(
								novel.lastReadUrl || novel.sourceUrl
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
		const autoBackupEnabled = autoBackupToggle?.checked || false;
		const backupMode = backupModeScheduled?.checked
			? "scheduled"
			: "continuous";

		backupHistory = (backupHistory || []).slice(0, BACKUP_RETENTION);

		await browser.storage.local.set({
			backupFolder,
			autoBackupEnabled,
			backupMode,
			continuousBackupDelayMinutes: CONTINUOUS_BACKUP_DELAY_MINUTES,
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
			manualBackupBtn?.classList.add("loading");

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
			manualBackupBtn?.classList.remove("loading");
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
					`Click Cancel to REPLACE your entire library`
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
					"success"
				);
			} else {
				throw new Error(result.error || "Import failed");
			}
		} catch (error) {
			debugError("Restore failed:", error);
			showStatus(
				`Failed to import library: ${error.message}\n\nMake sure the file is a valid Ranobe Gemini backup.`,
				"error"
			);
		} finally {
			if (restoreFileInput) restoreFileInput.value = "";
		}
	}

	function setDriveStatus(text, kind = "info") {
		if (!driveStatus) return;
		driveStatus.textContent = text || "";
		switch (kind) {
			case "error":
				driveStatus.style.color = "#d14343";
				break;
			case "success":
				driveStatus.style.color = "#0f9d58";
				break;
			default:
				driveStatus.style.color = "#475569";
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

	if (manualBackupBtn) {
		manualBackupBtn.addEventListener("click", () =>
			triggerManualBackup(true)
		);
	}

	if (backupFolderInput) {
		backupFolderInput.addEventListener("change", () => {
			persistBackupPrefs();
		});
	}

	if (autoBackupToggle) {
		autoBackupToggle.addEventListener("change", async () => {
			await persistBackupPrefs();
			showStatus(
				autoBackupToggle.checked
					? "Auto backup enabled"
					: "Auto backup disabled",
				"success"
			);
		});
	}

	if (backupModeScheduled) {
		backupModeScheduled.addEventListener("change", () => {
			if (backupModeScheduled.checked) {
				persistBackupPrefs({ backupMode: "scheduled" });
			}
		});
	}

	if (backupModeContinuous) {
		backupModeContinuous.addEventListener("change", () => {
			if (backupModeContinuous.checked) {
				persistBackupPrefs({ backupMode: "continuous" });
			}
		});
	}

	if (restoreBackupBtn && restoreFileInput) {
		restoreBackupBtn.addEventListener("click", () =>
			restoreFileInput.click()
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
			setDriveStatus("Client ID saved", "success");
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
			setDriveStatus("Folder saved", "success");
		});
	}

	if (driveAuthBtn) {
		driveAuthBtn.addEventListener("click", async () => {
			const clientId =
				driveClientIdInput?.value.trim() || DEFAULT_DRIVE_CLIENT_ID;
			if (!clientId) {
				setDriveStatus("Add your OAuth client ID first", "error");
				return;
			}
			setDriveStatus("Opening Google sign-in...");
			try {
				await browser.runtime.sendMessage({
					action: "ensureDriveAuth",
				});
				setDriveStatus("Drive connected", "success");
			} catch (err) {
				setDriveStatus(
					`Drive auth failed: ${err?.message || err}`,
					"error"
				);
			}
		});
	}

	if (driveUploadLogsBtn) {
		driveUploadLogsBtn.addEventListener("click", async () => {
			const clientId =
				driveClientIdInput?.value.trim() || DEFAULT_DRIVE_CLIENT_ID;
			if (!clientId) {
				setDriveStatus("Add your OAuth client ID first", "error");
				return;
			}
			driveUploadLogsBtn.classList.add("loading");
			setDriveStatus("Uploading logs to Drive...");
			try {
				const folderId = driveFolderIdInput?.value.trim();
				const resp = await browser.runtime.sendMessage({
					action: "uploadLogsToDrive",
					folderId: folderId || undefined,
				});
				if (resp?.success) {
					setDriveStatus(
						`Uploaded ${resp.count || "logs"} entries to Drive`,
						"success"
					);
				} else {
					throw new Error(resp?.error || "Upload failed");
				}
			} catch (err) {
				setDriveStatus(
					`Drive upload failed: ${err?.message || err}`,
					"error"
				);
			} finally {
				driveUploadLogsBtn.classList.remove("loading");
			}
		});
	}

	if (driveResetBtn) {
		driveResetBtn.addEventListener("click", async () => {
			setDriveStatus("Resetting tokens...");
			try {
				await browser.runtime.sendMessage({ action: "resetDriveAuth" });
				setDriveStatus("Drive tokens cleared", "success");
			} catch (err) {
				setDriveStatus(`Reset failed: ${err?.message || err}`, "error");
			}
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
				height
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
				"siteSpecificPromptsContainer"
			);

			if (container) {
				const existingSitePrompt = container.querySelector(
					`[data-site="${currentSite}"]`
				);

				if (sitePrompt && sitePrompt.length > 0) {
					if (existingSitePrompt) {
						// Update existing prompt
						existingSitePrompt.querySelector(
							".prompt-text"
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
						"siteSpecificPromptsContainer"
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
							`[data-site="${response.siteIdentifier}"]`
						);

						if (!sitePromptElement) {
							// Create new site prompt element from template
							const template = document.querySelector(
								".site-prompt-template"
							);
							if (template) {
								// Clone the template
								sitePromptElement = template
									.querySelector(".site-prompt-item")
									.cloneNode(true);
								sitePromptElement.setAttribute(
									"data-site",
									response.siteIdentifier
								);

								// Set site name
								const siteNameElement =
									sitePromptElement.querySelector(
										".site-name"
									);
								if (siteNameElement) {
									siteNameElement.textContent =
										response.siteIdentifier;
								}

								// Set prompt content
								const textarea =
									sitePromptElement.querySelector(
										".site-prompt-content"
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
										".remove-site-prompt"
									);
								if (removeButton) {
									removeButton.addEventListener(
										"click",
										function () {
											sitePromptElement.remove();
											if (
												container.querySelectorAll(
													".site-prompt-item"
												).length === 0
											) {
												if (noPromptsElement) {
													noPromptsElement.style.display =
														"block";
												}
											}
										}
									);
								}

								container.appendChild(sitePromptElement);
							}
						} else {
							// Update existing site prompt
							const textarea = sitePromptElement.querySelector(
								".site-prompt-content"
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
				"siteSpecificPromptsContainer"
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
						".site-prompt-template"
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
							".site-prompt-content"
						);
						if (textarea) {
							textarea.value = prompt;
						}

						// Add remove button functionality
						const removeButton = promptItem.querySelector(
							".remove-site-prompt"
						);
						if (removeButton) {
							removeButton.addEventListener("click", function () {
								promptItem.remove();
								if (
									container.querySelectorAll(
										".site-prompt-item"
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

	// Add site prompt button functionality
	document
		.getElementById("addSitePrompt")
		.addEventListener("click", function () {
			const container = document.getElementById(
				"siteSpecificPromptsContainer"
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
					".remove-site-prompt"
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

	// Modify the savePrompts function to include site-specific prompts
	document
		.getElementById("savePrompts")
		.addEventListener("click", async function () {
			// Save enhancement prompt
			const promptTemplate =
				document.getElementById("promptTemplate").value;
			localStorage.setItem("geminiPromptTemplate", promptTemplate);

			// Save summary prompt
			const summaryPrompt =
				document.getElementById("summaryPrompt").value;
			localStorage.setItem("geminiSummaryPrompt", summaryPrompt);

			// Save short summary prompt
			const shortSummaryPromptEl =
				document.getElementById("shortSummaryPrompt");
			const shortSummaryPrompt = shortSummaryPromptEl
				? shortSummaryPromptEl.value
				: DEFAULT_SHORT_SUMMARY_PROMPT;
			localStorage.setItem(
				"geminiShortSummaryPrompt",
				shortSummaryPrompt
			);

			// Save permanent prompt
			const permanentPrompt =
				document.getElementById("permanentPrompt").value;
			localStorage.setItem("permanentPrompt", permanentPrompt);

			// Also save to browser.storage.local for background script access
			try {
				await browser.storage.local.set({
					defaultPrompt: promptTemplate,
					summaryPrompt: summaryPrompt,
					shortSummaryPrompt: shortSummaryPrompt,
					permanentPrompt: permanentPrompt,
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

	// ========== NOVELS TAB HANDLERS ==========
	/**
	 * Load and display novels in the tab
	 */
	async function loadNovelsTab() {
		try {
			const result = await browser.storage.local.get(["novelHistory"]);
			const novels = result.novelHistory || {};
			const novelArray = Object.values(novels);

			// Get current novel info if on a supported site
			await updateCurrentNovelInfo();

			// Load all novels grouped by site
			await displayNovelsByWebsite(novelArray);

			// If on unsupported page or no current novel, show top 6 recent
			const tabs = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			const currentUrl = tabs[0]?.url || "";
			const isSupported = ALL_SUPPORTED_DOMAINS.some((domain) =>
				currentUrl.includes(domain)
			);

			if (!isSupported || novelArray.length === 0) {
				await showTopRecentNovels(novelArray);
			}
		} catch (error) {
			debugError("Error loading novels tab:", error);
			novelsListContainer.innerHTML =
				'<div class="no-novels">Error loading novels. Try refreshing.</div>';
		}
	}

	/**
	 * Update current novel info section
	 */
	async function updateCurrentNovelInfo() {
		try {
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
				return;
			}

			const currentUrl = tabs[0].url;
			const result = await browser.storage.local.get(["novelHistory"]);
			const novels = result.novelHistory || {};

			// Find novel matching current URL
			let currentNovel = null;
			for (const novel of Object.values(novels)) {
				if (
					novel.url &&
					(currentUrl.includes(novel.url) ||
						novel.url.includes(currentUrl))
				) {
					currentNovel = novel;
					break;
				}
			}

			if (currentNovel) {
				// Get novels from same site
				const sameSiteNovels = Object.values(novels).filter(
					(n) =>
						n.domain === currentNovel.domain &&
						n.id !== currentNovel.id
				);

				currentNovelInfo.innerHTML = `
					<div style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15)); padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
						<div style="display: flex; gap: 12px; margin-bottom: 12px;">
							${
								currentNovel.coverUrl
									? `<img src="${escapeHtml(
											currentNovel.coverUrl
									  )}" style="width: 60px; height: 80px; object-fit: cover; border-radius: 4px;" alt="Cover" />`
									: ""
							}
							<div style="flex: 1;">
								<div style="font-size: 15px; font-weight: 600; color: #e0e0e0; margin-bottom: 5px;">${escapeHtml(
									currentNovel.title || "Unknown"
								)}</div>
								<div style="font-size: 12px; color: #aaa; margin-bottom: 4px;">by ${escapeHtml(
									currentNovel.author || "Unknown"
								)}</div>
								<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
									<span style="font-size: 10px; padding: 2px 8px; background: rgba(76, 175, 80, 0.2); color: #4caf50; border-radius: 10px;">
										${escapeHtml(currentNovel.status || "Ongoing")}
									</span>
									<span style="font-size: 10px; padding: 2px 8px; background: rgba(102, 126, 234, 0.2); color: #667eea; border-radius: 10px;">
										${currentNovel.totalChapters || "?"} chapters
									</span>
									${
										currentNovel.lastReadChapter
											? `<span style="font-size: 10px; padding: 2px 8px; background: rgba(255, 152, 0, 0.2); color: #ff9800; border-radius: 10px;">
										Ch. ${currentNovel.lastReadChapter}
									</span>`
											: ""
									}
								</div>
							</div>
						</div>
						${
							currentNovel.description
								? `<div style="font-size: 11px; color: #999; line-height: 1.4; max-height: 60px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
							${escapeHtml(currentNovel.description)}
						</div>`
								: ""
						}
					</div>

					${
						sameSiteNovels.length > 0
							? `
						<div style="margin-top: 12px;">
							<div style="font-size: 12px; font-weight: 600; color: #aaa; margin-bottom: 8px;">
								📚 More from ${escapeHtml(currentNovel.domain || "this site")}
							</div>
							<div style="display: grid; grid-template-columns: 1fr; gap: 6px;">
								${sameSiteNovels
									.slice(0, 3)
									.map(
										(n) => `
									<div style="padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 11px; cursor: pointer;" onclick="window.open('${escapeHtml(
										n.url || "#"
									)}', '_blank')">
										<div style="font-weight: 500; color: #e0e0e0;">${escapeHtml(n.title)}</div>
										<div style="color: #888; font-size: 10px;">by ${escapeHtml(
											n.author || "Unknown"
										)}</div>
									</div>
								`
									)
									.join("")}
							</div>
						</div>
					`
							: ""
					}
				`;
			} else {
				// Try to get page info from content script
				browser.tabs
					.sendMessage(tabs[0].id, {
						action: "getPageInfo",
					})
					.then((response) => {
						if (response && response.novelInfo) {
							const novel = response.novelInfo;
							currentNovelInfo.innerHTML = `
								<div style="background: rgba(102, 126, 234, 0.1); padding: 12px; border-radius: 6px; border-left: 3px solid #667eea;">
									<div style="font-size: 14px; font-weight: 500; color: #e0e0e0; margin-bottom: 4px;">${escapeHtml(
										novel.title || "Unknown"
									)}</div>
									<div style="font-size: 12px; color: #aaa; margin-bottom: 3px;">by ${escapeHtml(
										novel.author || "Unknown"
									)}</div>
									<div style="font-size: 11px; color: #888; margin-top: 6px;">
										<span style="color: #4caf50;">${escapeHtml(
											novel.status || "Ongoing"
										)}</span> • ${
								novel.totalChapters || "?"
							} chapters
									</div>
								</div>
							`;
						} else {
							currentNovelInfo.innerHTML = `
								<div class="no-current-novel">
									<p>No current novel detected.</p>
									<p class="description">Visit a novel page to see details here.</p>
								</div>
							`;
						}
					})
					.catch(() => {
						currentNovelInfo.innerHTML = `
							<div class="no-current-novel">
								<p>Visit a supported novel site to see details here.</p>
							</div>
						`;
					});
			}
		} catch (error) {
			debugError("Error updating current novel info:", error);
		}
	}

	/**
	 * Show top 6 recent novels from all sites
	 */
	async function showTopRecentNovels(allNovels) {
		try {
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
						new Date(b.lastRead || 0) - new Date(a.lastRead || 0)
				)
				.slice(0, 6);

			suggestedNovelsList.innerHTML = `
				<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
					${recentNovels
						.map(
							(novel) => `
						<div style="padding: 10px; background: rgba(102, 126, 234, 0.05); border-radius: 6px; border: 1px solid rgba(102, 126, 234, 0.2); cursor: pointer;" onclick="window.open('${escapeHtml(
							novel.url || "#"
						)}', '_blank')">
							${
								novel.coverUrl
									? `<img src="${escapeHtml(
											novel.coverUrl
									  )}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" alt="Cover" />`
									: ""
							}
							<div style="font-size: 12px; font-weight: 500; color: #e0e0e0; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(
								novel.title || "Unknown"
							)}</div>
							<div style="font-size: 10px; color: #aaa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">by ${escapeHtml(
								novel.author || "Unknown"
							)}</div>
							<div style="font-size: 9px; color: #888; margin-top: 4px;">
								${new Date(novel.lastRead || new Date()).toLocaleDateString()}
							</div>
						</div>
					`
						)
						.join("")}
				</div>
			`;
		} catch (error) {
			debugError("Error showing top recent novels:", error);
		}
	}

	/**
	 * Display novels grouped by website
	 */
	async function displayNovelsByWebsite(allNovels) {
		try {
			if (allNovels.length === 0) {
				novelsListContainer.innerHTML =
					'<div class="no-novels">No novels in your library yet.</div>';
				return;
			}

			// Group by domain
			const novelsByDomain = {};
			allNovels.forEach((novel) => {
				const domain = novel.domain || "Unknown";
				if (!novelsByDomain[domain]) {
					novelsByDomain[domain] = [];
				}
				novelsByDomain[domain].push(novel);
			});

			// Sort domains by most recent novel
			const sortedDomains = Object.entries(novelsByDomain).sort(
				(a, b) => {
					const latestA = Math.max(
						...a[1].map((n) => new Date(n.lastRead || 0).getTime())
					);
					const latestB = Math.max(
						...b[1].map((n) => new Date(n.lastRead || 0).getTime())
					);
					return latestB - latestA;
				}
			);

			// Build HTML
			let html = `
				<div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
					<div style="font-size: 13px; color: #aaa;">
						${allNovels.length} novel${allNovels.length !== 1 ? "s" : ""} across ${
				sortedDomains.length
			} site${sortedDomains.length !== 1 ? "s" : ""}
					</div>
					<button id="showTopRecent" style="padding: 6px 12px; font-size: 11px; background: #667eea; border: none; border-radius: 4px; cursor: pointer; color: white;">
						🌟 Top 6 Recent
					</button>
				</div>
			`;

			for (const [domain, domainNovels] of sortedDomains) {
				// Get shelf info for better display
				const shelf = Object.values(SHELVES).find((s) =>
					s.domains.some((d) => domain.includes(d))
				);

				html += `
					<div class="domain-section" style="margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 12px; background: rgba(0,0,0,0.2);">
						<div style="font-weight: bold; margin-bottom: 10px; color: #667eea; display: flex; align-items: center; gap: 8px;">
							${
								shelf && shelf.icon
									? `<span style="font-size: 16px;">${
											shelf.emoji || shelf.icon
									  }</span>`
									: "📖"
							}
							<span>${shelf ? shelf.name : domain}</span>
							<span style="font-size: 11px; font-weight: normal; color: #888;">(${
								domainNovels.length
							})</span>
						</div>
						<div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
							${domainNovels
								.sort(
									(a, b) =>
										new Date(b.lastRead || 0) -
										new Date(a.lastRead || 0)
								)
								.map(
									(novel) => `
								<div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; gap: 10px; align-items: start;" onclick="window.open('${escapeHtml(
									novel.url || "#"
								)}', '_blank')">
									${
										novel.coverUrl
											? `<img src="${escapeHtml(
													novel.coverUrl
											  )}" style="width: 40px; height: 55px; object-fit: cover; border-radius: 3px; flex-shrink: 0;" alt="Cover" />`
											: ""
									}
									<div style="flex: 1; min-width: 0;">
										<div style="font-weight: 500; margin-bottom: 3px; word-break: break-word; color: #e0e0e0;">${escapeHtml(
											novel.title || "Unknown"
										)}</div>
										<div style="color: #aaa; font-size: 11px; margin-bottom: 2px;">by ${escapeHtml(
											novel.author || "Unknown"
										)}</div>
										<div style="color: #888; font-size: 10px; display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
											<span>📅 ${new Date(novel.lastRead || new Date()).toLocaleDateString()}</span>
											${novel.lastReadChapter ? `<span>📖 Ch. ${novel.lastReadChapter}</span>` : ""}
											${
												novel.enhancedChaptersCount
													? `<span>✨ ${novel.enhancedChaptersCount} enhanced</span>`
													: ""
											}
										</div>
									</div>
								</div>
							`
								)
								.join("")}
						</div>
					</div>
				`;
			}

			novelsListContainer.innerHTML = html;

			// Add event listener for top recent button
			const topRecentBtn = document.getElementById("showTopRecent");
			if (topRecentBtn) {
				topRecentBtn.addEventListener("click", () => {
					showTopRecentNovels(allNovels);
				});
			}
		} catch (error) {
			debugError("Error displaying novels by website:", error);
		}
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
			`
				)
				.join("");

			// Add event listeners for restore and delete
			document.querySelectorAll(".backup-restore-btn").forEach((btn) => {
				btn.addEventListener("click", async function () {
					const backupId = this.dataset.backupId;
					const mergeMode =
						document.querySelector(
							'input[name="mergeMode"]:checked'
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
				mergeMode
			);

			if (restored) {
				await browser.storage.local.set({
					novelHistory: restored,
				});

				showStatus(
					`Backup restored successfully (${mergeMode} mode)!`,
					"success"
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
			const tokens = await browser.storage.local.get("driveAuthTokens");
			const isConnected = !!tokens.driveAuthTokens?.access_token;

			if (isConnected) {
				driveNotConnected.style.display = "none";
				driveConnected.style.display = "block";
				driveStatusSpan.textContent = "🟢 Connected";
				driveStatusSpan.style.color = "#4CAF50";

				// Load backup mode
				const prefs = await browser.storage.local.get("backupMode");
				const mode = prefs.backupMode || "scheduled";
				document.querySelector(
					`input[name="driveBackupMode"][value="${mode}"]`
				).checked = true;
			} else {
				driveNotConnected.style.display = "block";
				driveConnected.style.display = "none";
				driveStatusSpan.textContent = "⚫ Disconnected";
				driveStatusSpan.style.color = "#999";
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
			connectDriveBtn.disabled = true;
			connectDriveBtn.textContent = "🔗 Connecting...";

			const clientId = DEFAULT_DRIVE_CLIENT_ID;
			const redirectUri = browser.identity.getRedirectURL("drive");

			// Build OAuth URL
			const params = new URLSearchParams({
				client_id: clientId,
				redirect_uri: redirectUri,
				response_type: "code",
				scope: "https://www.googleapis.com/auth/drive.file",
				access_type: "offline",
				prompt: "consent",
			});

			// Open OAuth redirect page in new tab
			const oauthUrl = `https://ranobe.vkrishna04.me/oauth-redirect.html?${params.toString()}`;
			browser.tabs.create({ url: browser.runtime.getURL(oauthUrl) });

			showStatus(
				"Opening Google login... Please authorize the extension.",
				"info"
			);

			// Poll for token (wait up to 30 seconds)
			let attempts = 0;
			const pollInterval = setInterval(async () => {
				attempts++;
				const stored = await browser.storage.local.get(
					"driveAuthTokens"
				);

				if (stored.driveAuthTokens?.access_token || attempts > 30) {
					clearInterval(pollInterval);
					connectDriveBtn.disabled = false;
					connectDriveBtn.textContent = "🔗 Connect Google Drive";

					if (stored.driveAuthTokens?.access_token) {
						showStatus(
							"✅ Google Drive connected successfully!",
							"success"
						);
						await updateDriveUI();
					} else {
						showStatus(
							"❌ Authentication failed or timed out",
							"error"
						);
					}
				}
			}, 1000);
		} catch (err) {
			debugError("Failed to connect Drive", err);
			showStatus("Failed to connect Google Drive", "error");
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
				"Disconnect Google Drive? Backups won't sync automatically."
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
		try {
			backupNowBtn.disabled = true;
			backupNowBtn.textContent = "📤 Backing up...";

			const response = await browser.runtime.sendMessage({
				action: "uploadLibraryBackupToDrive",
				folderId: null,
				reason: "manual",
			});

			if (response.success) {
				showStatus(`✅ Backup uploaded: ${response.name}`, "success");
			} else {
				throw new Error(response.error || "Upload failed");
			}
		} catch (err) {
			debugError("Failed to backup to Drive", err);
			showStatus(`Failed: ${err.message}`, "error");
		} finally {
			backupNowBtn.disabled = false;
			backupNowBtn.textContent = "📤 Backup Now";
		}
	}

	/**
	 * View backups on Google Drive
	 */
	async function handleViewBackups() {
		try {
			const backups = await browser.runtime.sendMessage({
				action: "listDriveBackups",
			});

			if (!backups || backups.length === 0) {
				showStatus("No backups found on Drive", "info");
				return;
			}

			// Build backup list HTML
			let html =
				'<div style="max-height: 300px; overflow-y: auto; font-size: 12px">';
			for (const backup of backups.slice(0, 20)) {
				const date = new Date(backup.createdTime).toLocaleDateString();
				const size = backup.size
					? `${(backup.size / 1024).toFixed(1)} KB`
					: "Unknown";
				html += `
					<div style="padding: 6px; border-bottom: 1px solid #ddd; cursor: pointer"
						 onclick="restoreFromDrive('${backup.id}')">
						<div style="font-weight: bold">${backup.name}</div>
						<div style="color: #666">${date} • ${size}</div>
					</div>
				`;
			}
			html += "</div>";

			// Show in modal or status
			showStatus(
				`Found ${backups.length} backups. Click to restore: ` + html,
				"info"
			);
		} catch (err) {
			debugError("Failed to list backups", err);
			showStatus("Failed to load backups", "error");
		}
	}

	/**
	 * Save Drive backup mode preference
	 */
	async function handleDriveBackupModeChange(event) {
		try {
			const mode = event.target.value;
			await browser.storage.local.set({ backupMode: mode });
			showStatus(
				`Backup mode changed to: ${
					mode === "scheduled" ? "Daily Scheduled" : "Continuous"
				}`,
				"success"
			);
		} catch (err) {
			debugError("Failed to update backup mode", err);
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
				false
			);

			if (backup) {
				showStatus(
					`Backup created: ${backup.novelCount} novels backed up`,
					"success"
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
				autoBackupEnabled: autoBackupEnabled?.checked || false,
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

	if (createManualBackup) {
		createManualBackup.addEventListener("click", handleCreateManualBackup);
	}

	if (autoBackupEnabled) {
		autoBackupEnabled.addEventListener("change", updateBackupConfig);
	}

	mergeModRadios.forEach((radio) => {
		radio.addEventListener("change", updateBackupConfig);
	});

	// Attach Google Drive backup handlers
	if (connectDriveBtn) {
		connectDriveBtn.addEventListener("click", handleConnectDrive);
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
	driveBackupModeRadios.forEach((radio) => {
		radio.addEventListener("change", handleDriveBackupModeChange);
	});

	// Load backups and novels on popup open
	(async () => {
		await libraryBackupManager.initializeConfig();
		const config = await libraryBackupManager.getConfig();

		if (autoBackupEnabled) {
			autoBackupEnabled.checked = config.autoBackupEnabled || false;
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
	})();

	// Load novels when novels tab is opened
	document.querySelectorAll(".tab-btn").forEach((btn) => {
		btn.addEventListener("click", async function () {
			if (this.getAttribute("data-tab") === "novels") {
				await loadNovelsTab();
			}
		});
	});

	// Log that the popup is initialized
	debugLog("RanobeGemini popup initialized");

	// Load site-specific prompts
	loadSiteHandlerPrompts();

	// Initialize info tab with dynamic data
	initInfoTab();

	// Add tab change listener to update prompts when switching to the prompts tab
	document.querySelectorAll(".tab-btn").forEach(function (button) {
		button.addEventListener("click", function () {
			if (button.getAttribute("data-tab") === "prompts") {
				// Reload site-specific prompts when prompts tab is selected
				loadSiteHandlerPrompts();
			}
		});
	});

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
				".faq-item:nth-child(3) .faq-answer ul"
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
						shelf.name
					)}</strong> — <code>${escapeHtml(allDomains)}</code></li>`;
				});
				supportedSitesList.innerHTML = sitesHTML;
			}
		} catch (error) {
			debugError("Error initializing info tab:", error);
		}
	}
});
