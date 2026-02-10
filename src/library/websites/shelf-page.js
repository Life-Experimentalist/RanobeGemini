/**
 * @fileoverview Shelf Page Management - Individual shelf/website view all pages
 * Handles displaying all novels from a specific shelf with filtering and sorting
 */

import { storageManager } from "../../utils/storage-manager.js";
import {
	getNovelLibrary,
	updateNovelInLibrary,
	READING_STATUS,
	READING_STATUS_INFO,
} from "../../utils/novel-library.js";
import {
	getSiteSettings,
	saveSiteSettings,
	getDefaultSiteSettings,
} from "../../utils/site-settings.js";
import {
	getWebsiteSettingsDefinition,
	renderWebsiteSettingsPanel,
} from "../site-settings-ui.js";
import { debugLog, debugError } from "../../utils/logger.js";

// Theme defaults shared with popup/library
const defaultTheme = {
	mode: "dark",
	accentPrimary: "#4b5563",
	accentSecondary: "#6b7280",
	bgColor: "#0f172a",
	textColor: "#e5e7eb",
};

const themePalettes = {
	dark: {
		"primary-color": "#4b5563",
		"primary-hover": "#6b7280",
		"bg-primary": "#0f172a",
		"bg-secondary": "#111827",
		"bg-tertiary": "#1f2937",
		"bg-card": "#1f2937",
		"bg-card-hover": "#2b3544",
		"text-primary": "#e5e7eb",
		"text-secondary": "#9ca3af",
		"text-muted": "#6b7280",
		"border-color": "#2f3644",
	},
	light: {
		"primary-color": "#4b5563",
		"primary-hover": "#6b7280",
		"bg-primary": "#f3f4f6",
		"bg-secondary": "#ffffff",
		"bg-tertiary": "#e5e7eb",
		"bg-card": "#ffffff",
		"bg-card-hover": "#f3f4f6",
		"text-primary": "#111827",
		"text-secondary": "#374151",
		"text-muted": "#6b7280",
		"border-color": "#e5e7eb",
	},
};

// Helper to get just the label from READING_STATUS_INFO
const READING_STATUS_LABELS = Object.fromEntries(
	Object.entries(READING_STATUS_INFO).map(([key, value]) => [
		key,
		value.label,
	])
);

// State variables
let currentShelf = null;
let shelfConfig = null;
let allNovels = [];
let filteredNovels = [];
let currentFilters = {
	search: "",
	readingStatus: "all",
	tags: [],
	sort: "lastAccessedAt",
	sortOrder: "desc",
};

// Available tags extracted from novels
let availableTags = new Set();

// Custom filter callbacks registered by specific shelf pages
let customFilterCallbacks = [];

async function applyShelfTheme() {
	try {
		const result =
			typeof browser !== "undefined" && browser.storage?.local
				? await browser.storage.local.get("themeSettings")
				: {};
		const theme = result.themeSettings || defaultTheme;
		setThemeVariables(theme);
	} catch (error) {
		debugError("Failed to apply shelf theme:", error);
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

	// Respect custom overrides
	if (theme.accentPrimary)
		root.style.setProperty("--primary-color", theme.accentPrimary);
	if (theme.accentSecondary)
		root.style.setProperty("--primary-hover", theme.accentSecondary);
	if (theme.bgColor) root.style.setProperty("--bg-primary", theme.bgColor);
	if (theme.textColor)
		root.style.setProperty("--text-primary", theme.textColor);
}

function setupThemeListener() {
	if (typeof browser === "undefined" || !browser.storage?.onChanged) return;

	browser.storage.onChanged.addListener((changes, area) => {
		if (area !== "local" || !changes.themeSettings) return;
		applyShelfTheme();
	});
}

/**
 * Register a custom filter callback to extend filtering logic
 * @param {Function} callback - Function that receives novels array and returns filtered array
 */
export function registerCustomFilter(callback) {
	if (typeof callback === "function") {
		customFilterCallbacks.push(callback);
	}
}

function openNovelFromQuery() {
	try {
		const params = new URLSearchParams(window.location.search);
		const novelId = params.get("novel");
		if (!novelId) return;
		const novel = allNovels.find((n) => n && n.id === novelId);
		if (novel) {
			openNovelDetails(novelId);
		} else {
			showToast("Novel not found in this shelf", "info");
		}
	} catch (_err) {
		debugError("Error opening novel from query:", _err);
	}
}

/**
 * Initialize shelf page
 * @param {string} shelfId - The shelf identifier
 * @param {Object} config - Shelf configuration (id, name, icon, color, primaryDomain)
 */
export async function initShelfPage(shelfId, config = {}) {
	currentShelf = shelfId;
	shelfConfig = config;

	await applyShelfTheme();
	setupThemeListener();

	// Setup UI elements
	setupFilterControls();
	setupEventListeners();
	setupWebsiteSettingsModal();

	// Load and display novels
	await loadShelfNovels();
	openNovelFromQuery();
}

/**
 * Setup filter control elements
 */
function setupFilterControls() {
	const filterContainer = document.getElementById("shelf-filters");
	if (!filterContainer) return;

	filterContainer.innerHTML = `
        <div class="shelf-filters-row">
            <div class="filter-group search-group">
                <input type="text"
                       id="shelf-search"
                       placeholder="Search novels..."
                       class="filter-input">
            </div>

			<div class="filter-group">
				<button type="button" id="random-select-btn" class="filter-btn">
					🎲 Random
				</button>
            </div>

            <div class="filter-group">
                <label for="status-filter">Status:</label>
                <select id="status-filter" class="filter-select">
                    <option value="all">All Status</option>
                    ${Object.entries(READING_STATUS_INFO)
						.map(
							([status, info]) =>
								`<option value="${status}">${info.label}</option>`,
						)
						.join("")}
                </select>
            </div>

            <div class="filter-group">
                <label for="tags-filter">Tags:</label>
                <div class="tags-filter-container" id="tags-filter-container">
                    <button type="button" class="tags-dropdown-btn" id="tags-dropdown-btn">
                        <span id="tags-count">All Tags</span>
                        <span class="dropdown-arrow">▼</span>
                    </button>
                    <div class="tags-dropdown" id="tags-dropdown">
                        <div class="tags-dropdown-search">
                            <input type="text" id="tag-search" placeholder="Search tags...">
                        </div>
                        <div class="tags-list" id="tags-list">
                            <!-- Tags will be populated dynamically -->
                        </div>
                        <div class="tags-dropdown-actions">
                            <button type="button" id="clear-tags-btn">Clear All</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="filter-group">
                <label for="sort-filter">Sort:</label>
                <select id="sort-filter" class="filter-select">
                    <option value="lastAccessedAt">Last Read</option>
                    <option value="dateAdded">Date Added</option>
                    <option value="title">Title</option>
                    <option value="currentChapter">Current Chapter</option>
                    <option value="totalChapters">Total Chapters</option>
                </select>
            </div>

            <div class="filter-group">
                <button type="button" id="sort-order-btn" class="sort-order-btn" title="Toggle sort order">
                    <span id="sort-order-icon">↓</span>
                </button>
            </div>
        </div>

        <div class="active-filters" id="active-filters">
            <!-- Active filter tags shown here -->
        </div>
    `;
}

/**
 * Setup event listeners for filter controls
 */
async function setupWebsiteSettingsModal() {
	const definition = getWebsiteSettingsDefinition(currentShelf);
	if (!definition) return;

	const header = document.querySelector(".shelf-page-header");
	const backLink = header?.querySelector(".back-link");
	if (header && !header.querySelector("#site-settings-btn")) {
		const settingsBtn = document.createElement("button");
		settingsBtn.id = "site-settings-btn";
		settingsBtn.className = "shelf-settings-btn";
		settingsBtn.type = "button";
		settingsBtn.textContent = "⚙️ Settings";
		if (backLink && backLink.parentElement === header) {
			header.insertBefore(settingsBtn, backLink);
		} else {
			header.appendChild(settingsBtn);
		}
	}

	let currentSettings = {};
	try {
		const allSettings = await getSiteSettings();
		currentSettings =
			allSettings[currentShelf] ||
			getDefaultSiteSettings()[currentShelf] ||
			{};
	} catch (_err) {
		currentSettings = getDefaultSiteSettings()[currentShelf] || {};
	}

	const existingModal = document.getElementById("site-settings-modal");
	if (!existingModal) {
		const modal = document.createElement("div");
		modal.id = "site-settings-modal";
		modal.className = "modal hidden";
		modal.innerHTML = `
			<div class="modal-backdrop"></div>
			<div class="modal-content settings-modal-content">
				<button class="modal-close" id="site-settings-close">&times;</button>
				<h2 style="margin-bottom: 8px;">⚙️ ${definition.label} Settings</h2>
				<p style="margin: 0 0 16px 0; font-size: 13px; color: var(--text-secondary, #999);">
					Manage site-specific preferences for this library.
				</p>
				<div class="settings-tabs">
					<button class="settings-tab active" data-tab="website-settings-panel">
						⚙️ Settings
					</button>
				</div>
				<div class="settings-tab-content" id="website-settings-panel">
					${renderWebsiteSettingsPanel(definition, currentSettings)}
				</div>
			</div>
		`;
		document.body.appendChild(modal);
	}

	const settingsBtn = document.getElementById("site-settings-btn");
	const settingsModal = document.getElementById("site-settings-modal");
	const settingsClose = document.getElementById("site-settings-close");
	const settingsBackdrop = settingsModal?.querySelector(".modal-backdrop");

	const openModal = () => {
		if (settingsModal) settingsModal.classList.remove("hidden");
	};
	const closeModal = () => {
		if (settingsModal) settingsModal.classList.add("hidden");
	};

	if (settingsBtn) settingsBtn.addEventListener("click", openModal);
	if (settingsClose) settingsClose.addEventListener("click", closeModal);
	if (settingsBackdrop)
		settingsBackdrop.addEventListener("click", closeModal);

	const inputs = document.querySelectorAll(
		"#site-settings-modal input[data-setting]",
	);
	inputs.forEach((input) => {
		input.addEventListener("change", async () => {
			const key = input.dataset.setting;
			if (!key) return;
			const updated = {
				...currentSettings,
				[key]: input.checked,
			};
			try {
				const saved = await saveSiteSettings({
					[currentShelf]: updated,
				});
				currentSettings = saved[currentShelf] || updated;
				showToast("Settings saved", "success");
			} catch (error) {
				debugError("Failed to save site settings:", error);
				showToast("Failed to save settings", "error");
			}
		});
	});
}

function setupEventListeners() {
	// Search input
	const searchInput = document.getElementById("shelf-search");
	if (searchInput) {
		let searchTimeout;
		searchInput.addEventListener("input", (e) => {
			clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => {
				currentFilters.search = e.target.value.trim().toLowerCase();
				applyFiltersAndSort();
			}, 300);
		});
	}

	// Status filter
	const statusFilter = document.getElementById("status-filter");
	if (statusFilter) {
		statusFilter.addEventListener("change", (e) => {
			currentFilters.readingStatus = e.target.value;
			applyFiltersAndSort();
			updateActiveFilters();
		});
	}

	// Tags dropdown
	const tagsDropdownBtn = document.getElementById("tags-dropdown-btn");
	const tagsDropdown = document.getElementById("tags-dropdown");
	if (tagsDropdownBtn && tagsDropdown) {
		tagsDropdownBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			tagsDropdown.classList.toggle("show");
		});

		// Close dropdown when clicking outside
		document.addEventListener("click", (e) => {
			if (
				!tagsDropdownBtn.contains(e.target) &&
				!tagsDropdown.contains(e.target)
			) {
				tagsDropdown.classList.remove("show");
			}
		});
	}

	// Tag search
	const tagSearch = document.getElementById("tag-search");
	if (tagSearch) {
		tagSearch.addEventListener("input", (e) => {
			filterTagsList(e.target.value.toLowerCase());
		});
	}

	// Clear tags button
	const clearTagsBtn = document.getElementById("clear-tags-btn");
	if (clearTagsBtn) {
		clearTagsBtn.addEventListener("click", () => {
			currentFilters.tags = [];
			updateTagsUI();
			applyFiltersAndSort();
			updateActiveFilters();
		});
	}

	// Sort filter
	const sortFilter = document.getElementById("sort-filter");
	if (sortFilter) {
		sortFilter.addEventListener("change", (e) => {
			currentFilters.sort = e.target.value;
			applyFiltersAndSort();
		});
	}

	// Sort order button
	const sortOrderBtn = document.getElementById("sort-order-btn");
	if (sortOrderBtn) {
		sortOrderBtn.addEventListener("click", () => {
			currentFilters.sortOrder =
				currentFilters.sortOrder === "asc" ? "desc" : "asc";
			document.getElementById("sort-order-icon").textContent =
				currentFilters.sortOrder === "asc" ? "↑" : "↓";
			applyFiltersAndSort();
		});
	}

	// Random select button
	const randomSelectBtn = document.getElementById("random-select-btn");
	if (randomSelectBtn) {
		randomSelectBtn.addEventListener("click", () => {
			const pool = filteredNovels.length ? filteredNovels : allNovels;
			if (!pool.length) {
				showToast("No novels available for random pick", "info");
				return;
			}
			const pick = pool[Math.floor(Math.random() * pool.length)];
			openNovelDetails(pick.id);
		});
	}

	// Listen for storage changes to auto-update
	if (typeof browser !== "undefined" && browser.storage) {
		browser.storage.onChanged.addListener((changes, area) => {
			if (area === "local" && changes.rg_novel_library) {
				loadShelfNovels();
			}
		});
	}
}

/**
 * Load novels for the current shelf
 */
async function loadShelfNovels() {
	try {
		const library = await getNovelLibrary();
		allNovels = Object.values(library).filter(
			(novel) => novel.shelfId === currentShelf
		);

		// Extract available tags
		extractAvailableTags();

		// Apply initial filters and sort
		applyFiltersAndSort();
	} catch (error) {
		debugError("Error loading shelf novels:", error);
		showError("Failed to load novels");
	}
}

/**
 * Extract all unique tags from novels
 */
function extractAvailableTags() {
	availableTags.clear();

	allNovels.forEach((novel) => {
		if (novel.tags && Array.isArray(novel.tags)) {
			novel.tags.forEach((tag) => availableTags.add(tag));
		}
	});

	// Populate tags list
	populateTagsList();
}

/**
 * Populate the tags dropdown list
 */
function populateTagsList() {
	const tagsList = document.getElementById("tags-list");
	if (!tagsList) return;

	const sortedTags = [...availableTags].sort((a, b) =>
		a.toLowerCase().localeCompare(b.toLowerCase())
	);

	if (sortedTags.length === 0) {
		tagsList.innerHTML = '<div class="no-tags">No tags found</div>';
		return;
	}

	tagsList.innerHTML = sortedTags
		.map(
			(tag) => `
        <label class="tag-item" data-tag="${escapeHtml(tag)}">
            <input type="checkbox"
                   value="${escapeHtml(tag)}"
                   ${currentFilters.tags.includes(tag) ? "checked" : ""}>
            <span class="tag-name">${escapeHtml(tag)}</span>
            <span class="tag-count">${countNovelsWithTag(tag)}</span>
        </label>
    `
		)
		.join("");

	// Add event listeners for checkboxes
	tagsList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
		checkbox.addEventListener("change", (e) => {
			const tag = e.target.value;
			if (e.target.checked) {
				if (!currentFilters.tags.includes(tag)) {
					currentFilters.tags.push(tag);
				}
			} else {
				currentFilters.tags = currentFilters.tags.filter(
					(t) => t !== tag
				);
			}
			updateTagsUI();
			applyFiltersAndSort();
			updateActiveFilters();
		});
	});
}

/**
 * Count novels with a specific tag
 * @param {string} tag - Tag to count
 * @returns {number} - Number of novels with tag
 */
function countNovelsWithTag(tag) {
	return allNovels.filter((novel) => novel.tags && novel.tags.includes(tag))
		.length;
}

/**
 * Filter the tags list based on search
 * @param {string} search - Search term
 */
function filterTagsList(search) {
	const tagItems = document.querySelectorAll(".tag-item");
	tagItems.forEach((item) => {
		const tagName = item.dataset.tag.toLowerCase();
		item.style.display = tagName.includes(search) ? "flex" : "none";
	});
}

/**
 * Update tags UI (button text and checkboxes)
 */
function updateTagsUI() {
	const tagsCount = document.getElementById("tags-count");
	if (tagsCount) {
		if (currentFilters.tags.length === 0) {
			tagsCount.textContent = "All Tags";
		} else if (currentFilters.tags.length === 1) {
			tagsCount.textContent = currentFilters.tags[0];
		} else {
			tagsCount.textContent = `${currentFilters.tags.length} tags`;
		}
	}

	// Update checkboxes
	const checkboxes = document.querySelectorAll(
		'#tags-list input[type="checkbox"]'
	);
	checkboxes.forEach((checkbox) => {
		checkbox.checked = currentFilters.tags.includes(checkbox.value);
	});
}

/**
 * Update active filters display
 */
function updateActiveFilters() {
	const container = document.getElementById("active-filters");
	if (!container) return;

	const filters = [];

	if (currentFilters.readingStatus !== "all") {
		const label =
			READING_STATUS_LABELS[currentFilters.readingStatus] ||
			currentFilters.readingStatus;
		filters.push({
			type: "status",
			label: `Status: ${label}`,
			value: currentFilters.readingStatus,
		});
	}

	currentFilters.tags.forEach((tag) => {
		filters.push({
			type: "tag",
			label: tag,
			value: tag,
		});
	});

	if (filters.length === 0) {
		container.innerHTML = "";
		container.style.display = "none";
		return;
	}

	container.style.display = "flex";
	container.innerHTML =
		filters
			.map(
				(filter) => `
        <span class="active-filter-tag" data-type="${
			filter.type
		}" data-value="${escapeHtml(filter.value)}">
            ${escapeHtml(filter.label)}
            <button type="button" class="remove-filter" aria-label="Remove filter">×</button>
        </span>
    `
			)
			.join("") +
		`
        <button type="button" class="clear-all-filters" id="clear-all-filters">Clear All</button>
    `;

	// Add event listeners for removing individual filters
	container.querySelectorAll(".remove-filter").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			const tag = e.target.closest(".active-filter-tag");
			const type = tag.dataset.type;
			const value = tag.dataset.value;

			if (type === "status") {
				currentFilters.readingStatus = "all";
				document.getElementById("status-filter").value = "all";
			} else if (type === "tag") {
				currentFilters.tags = currentFilters.tags.filter(
					(t) => t !== value
				);
				updateTagsUI();
			}

			applyFiltersAndSort();
			updateActiveFilters();
		});
	});

	// Clear all filters button
	const clearAllBtn = document.getElementById("clear-all-filters");
	if (clearAllBtn) {
		clearAllBtn.addEventListener("click", () => {
			currentFilters.readingStatus = "all";
			currentFilters.tags = [];
			currentFilters.search = "";

			document.getElementById("status-filter").value = "all";
			document.getElementById("shelf-search").value = "";
			updateTagsUI();

			applyFiltersAndSort();
			updateActiveFilters();
		});
	}
}

/**
 * Apply current filters and sort to novels
 */
function applyFiltersAndSort() {
	// Start with all novels
	filteredNovels = [...allNovels];

	// Apply search filter
	if (currentFilters.search) {
		filteredNovels = filteredNovels.filter(
			(novel) =>
				novel.title.toLowerCase().includes(currentFilters.search) ||
				(novel.author &&
					novel.author
						.toLowerCase()
						.includes(currentFilters.search)) ||
				(novel.description &&
					novel.description
						.toLowerCase()
						.includes(currentFilters.search))
		);
	}

	// Apply reading status filter
	if (currentFilters.readingStatus !== "all") {
		filteredNovels = filteredNovels.filter(
			(novel) => novel.readingStatus === currentFilters.readingStatus
		);
	}

	// Apply tags filter (novels must have ALL selected tags)
	if (currentFilters.tags.length > 0) {
		filteredNovels = filteredNovels.filter(
			(novel) =>
				novel.tags &&
				currentFilters.tags.every((tag) => novel.tags.includes(tag))
		);
	}

	// Apply custom filter callbacks
	for (const callback of customFilterCallbacks) {
		try {
			filteredNovels = callback(filteredNovels);
		} catch (e) {
			debugError("Custom filter callback error:", e);
		}
	}

	// Apply sort
	filteredNovels.sort((a, b) => {
		let aVal, bVal;

		switch (currentFilters.sort) {
			case "title":
				aVal = a.title.toLowerCase();
				bVal = b.title.toLowerCase();
				return currentFilters.sortOrder === "asc"
					? aVal.localeCompare(bVal)
					: bVal.localeCompare(aVal);

			case "lastAccessedAt":
				aVal = a.lastAccessedAt || 0;
				bVal = b.lastAccessedAt || 0;
				break;

			case "dateAdded":
				aVal = a.dateAdded || 0;
				bVal = b.dateAdded || 0;
				break;

			case "currentChapter":
				aVal = a.currentChapter || 0;
				bVal = b.currentChapter || 0;
				break;

			case "totalChapters":
				aVal = a.totalChapters || 0;
				bVal = b.totalChapters || 0;
				break;

			default:
				aVal = a.lastAccessedAt || 0;
				bVal = b.lastAccessedAt || 0;
		}

		return currentFilters.sortOrder === "asc" ? aVal - bVal : bVal - aVal;
	});

	// Render results
	renderNovels();
}

/**
 * Render filtered novels to the page
 */
function renderNovels() {
	const container = document.getElementById("shelf-novels-grid");
	if (!container) return;

	if (filteredNovels.length === 0) {
		container.innerHTML = `
            <div class="no-novels-message">
                <p>No novels found matching your filters.</p>
                ${
					allNovels.length > 0
						? "<p>Try adjusting your filters.</p>"
						: "<p>Add novels to this shelf to see them here.</p>"
				}
            </div>
        `;
		return;
	}

	container.innerHTML = filteredNovels
		.map((novel) => createNovelCard(novel))
		.join("");

	// Update results count
	const resultsCount = document.getElementById("results-count");
	if (resultsCount) {
		resultsCount.textContent = `Showing ${filteredNovels.length} of ${allNovels.length} novels`;
	}

	// Setup card event listeners
	setupCardEventListeners();
}

/**
 * Create HTML for a novel card
 * @param {Object} novel - Novel data
 * @returns {string} - HTML string
 */
function createNovelCard(novel) {
	const statusLabel = READING_STATUS_LABELS[novel.readingStatus] || "Unknown";
	const statusClass = novel.readingStatus || "unknown";

	const progress =
		novel.totalChapters && novel.totalChapters > 0
			? Math.min(
					100,
					Math.round(
						(novel.currentChapter / novel.totalChapters) * 100
					)
			  )
			: 0;

	const lastRead = novel.lastAccessedAt
		? new Date(novel.lastAccessedAt).toLocaleDateString()
		: "Never";

	// Get tags display (show first 3 tags + count if more)
	let tagsHtml = "";
	if (novel.tags && novel.tags.length > 0) {
		const displayTags = novel.tags.slice(0, 3);
		const moreCount = novel.tags.length - 3;
		tagsHtml = `
            <div class="novel-tags">
                ${displayTags
					.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
					.join("")}
                ${
					moreCount > 0
						? `<span class="tag more-tags">+${moreCount}</span>`
						: ""
				}
            </div>
        `;
	}

	return `
        <div class="novel-card" data-novel-id="${escapeHtml(novel.id)}">
            <div class="novel-cover">
                ${
					novel.coverImage
						? `<img src="${escapeHtml(
								novel.coverImage
						  )}" alt="${escapeHtml(novel.title)}" loading="lazy">`
						: `<div class="novel-cover-placeholder">${escapeHtml(
								novel.title.charAt(0)
						  )}</div>`
				}
                <div class="novel-status-badge status-${statusClass}">${statusLabel}</div>
            </div>

            <div class="novel-info">
                <h3 class="novel-title" title="${escapeHtml(
					novel.title
				)}">${escapeHtml(novel.title)}</h3>

                ${
					novel.author
						? `<p class="novel-author">by ${escapeHtml(
								novel.author
						  )}</p>`
						: ""
				}

                <div class="novel-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text">
                        Ch. ${novel.currentChapter || 0}${
		novel.totalChapters ? ` / ${novel.totalChapters}` : ""
	}
                    </span>
                </div>

                ${tagsHtml}

                <div class="novel-meta">
                    <span class="last-read">Last read: ${lastRead}</span>
                </div>

                <div class="novel-actions">
                    <select class="status-select" data-novel-id="${escapeHtml(
						novel.id
					)}">
                        ${Object.entries(READING_STATUS_LABELS)
							.map(
								([value, label]) => `
                            <option value="${value}" ${
									novel.readingStatus === value
										? "selected"
										: ""
								}>${label}</option>
                        `
							)
							.join("")}
                    </select>

                    <button class="btn-continue" data-url="${escapeHtml(
						novel.lastChapterUrl || novel.sourceUrl
					)}" title="Continue reading">
                        📖 Continue
                    </button>

                    <button class="btn-novel-menu" data-novel-id="${escapeHtml(
						novel.id
					)}" title="More options">
                        ⋮
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Setup event listeners for novel cards
 */
function setupCardEventListeners() {
	// Status select change
	document.querySelectorAll(".status-select").forEach((select) => {
		select.addEventListener("change", async (e) => {
			const novelId = e.target.dataset.novelId;
			const newStatus = e.target.value;

			try {
				await updateNovelInLibrary(novelId, {
					readingStatus: newStatus,
				});

				// Update the badge
				const card = e.target.closest(".novel-card");
				const badge = card.querySelector(".novel-status-badge");
				if (badge) {
					badge.className = `novel-status-badge status-${newStatus}`;
					badge.textContent = READING_STATUS_LABELS[newStatus];
				}

				// If filtering by status, we may need to re-filter
				if (currentFilters.readingStatus !== "all") {
					await loadShelfNovels();
				}

				showToast(
					`Status updated to ${READING_STATUS_LABELS[newStatus]}`
				);
			} catch (error) {
				debugError("Error updating status:", error);
				showToast("Failed to update status", "error");
			}
		});
	});

	// Continue button
	document.querySelectorAll(".btn-continue").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			const url = e.target.dataset.url;
			if (url) {
				window.open(url, "_blank");
			}
		});
	});

	// Novel menu button
	document.querySelectorAll(".btn-novel-menu").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			const novelId = e.target.dataset.novelId;
			showNovelMenu(novelId, e.target);
		});
	});

	// Click on card to open novel details
	document.querySelectorAll(".novel-card").forEach((card) => {
		card.addEventListener("click", (e) => {
			// Don't trigger if clicking on interactive elements
			if (
				e.target.closest(".novel-actions") ||
				e.target.closest(".status-select") ||
				e.target.closest(".btn-continue") ||
				e.target.closest(".btn-novel-menu")
			) {
				return;
			}

			const novelId = card.dataset.novelId;
			openNovelDetails(novelId);
		});
	});
}

/**
 * Show context menu for a novel
 * @param {string} novelId - Novel ID
 * @param {HTMLElement} anchor - Anchor element
 */
function showNovelMenu(novelId, anchor) {
	// Remove any existing menu
	const existingMenu = document.querySelector(".novel-context-menu");
	if (existingMenu) existingMenu.remove();

	const novel = allNovels.find((n) => n.id === novelId);
	if (!novel) return;

	const menu = document.createElement("div");
	menu.className = "novel-context-menu";
	menu.innerHTML = `
        <button class="menu-item" data-action="details">📋 View Details</button>
        <button class="menu-item" data-action="source">🔗 Open Source Page</button>
        <button class="menu-item" data-action="refresh">🔄 Refresh Metadata</button>
        <hr>
        <button class="menu-item danger" data-action="remove">🗑️ Remove from Library</button>
    `;

	// Position menu near anchor
	const rect = anchor.getBoundingClientRect();
	menu.style.position = "fixed";
	menu.style.top = `${rect.bottom + 5}px`;
	menu.style.left = `${rect.left}px`;

	document.body.appendChild(menu);

	// Handle menu actions
	menu.querySelectorAll(".menu-item").forEach((item) => {
		item.addEventListener("click", async () => {
			const action = item.dataset.action;
			menu.remove();

			switch (action) {
				case "details":
					openNovelDetails(novelId);
					break;
				case "source":
					if (novel.sourceUrl) {
						window.open(novel.sourceUrl, "_blank");
					}
					break;
				case "refresh":
					// Trigger refresh from the main library.js
					window.dispatchEvent(
						new CustomEvent("refreshNovelMetadata", {
							detail: { novelId },
						})
					);
					break;
				case "remove":
					if (confirm(`Remove "${novel.title}" from library?`)) {
						await removeNovelFromLibrary(novelId);
					}
					break;
			}
		});
	});

	// Close menu on outside click
	const closeHandler = (e) => {
		if (!menu.contains(e.target) && e.target !== anchor) {
			menu.remove();
			document.removeEventListener("click", closeHandler);
		}
	};
	setTimeout(() => document.addEventListener("click", closeHandler), 0);
}

/**
 * Open novel details modal
 * @param {string} novelId - Novel ID
 */
function openNovelDetails(novelId) {
	// Dispatch event for main library to handle
	window.dispatchEvent(
		new CustomEvent("openNovelModal", { detail: { novelId } })
	);
}

/**
 * Remove novel from library
 * @param {string} novelId - Novel ID
 */
async function removeNovelFromLibrary(novelId) {
	try {
		const library = await getNovelLibrary();
		delete library[novelId];
		await storageManager.set({ rg_novel_library: library });

		// Reload shelf
		await loadShelfNovels();
		showToast("Novel removed from library");
	} catch (error) {
		debugError("Error removing novel:", error);
		showToast("Failed to remove novel", "error");
	}
}

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - Toast type (success, error, info)
 */
function showToast(message, type = "success") {
	// Check if there's a global showToast function
	if (window.showToast) {
		window.showToast(message, type);
		return;
	}

	// Fallback toast implementation
	const existing = document.querySelector(".shelf-toast");
	if (existing) existing.remove();

	const toast = document.createElement("div");
	toast.className = `shelf-toast toast-${type}`;
	toast.textContent = message;
	document.body.appendChild(toast);

	setTimeout(() => toast.classList.add("show"), 10);
	setTimeout(() => {
		toast.classList.remove("show");
		setTimeout(() => toast.remove(), 300);
	}, 3000);
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
	const container = document.getElementById("shelf-novels-grid");
	if (container) {
		container.innerHTML = `
            <div class="error-message">
                <p>⚠️ ${escapeHtml(message)}</p>
                <button onclick="location.reload()">Retry</button>
            </div>
        `;
	}
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
	if (!text) return "";
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

// Export for use in main library and shelf pages
export { loadShelfNovels, applyFiltersAndSort, currentFilters, renderNovels };
