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
import { debugLog, debugError } from "../utils/logger.js";

// State
let currentView = "shelves";
let currentSort = "recent";
let currentStatusFilter = "all";
let searchQuery = "";
let allNovels = [];
let librarySettings = {
	autoHoldEnabled: true,
	autoHoldDays: 7,
};

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
		"modal-relationships-section"
	),
	modalRelationships: document.getElementById("modal-relationships"),
	modalCharactersSection: document.getElementById("modal-characters-section"),
	modalCharacters: document.getElementById("modal-characters"),
	modalAdditionalTagsSection: document.getElementById(
		"modal-additional-tags-section"
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
	exportBtn: document.getElementById("export-btn"),
	importBtn: document.getElementById("import-btn"),
	importFile: document.getElementById("import-file"),
	clearBtn: document.getElementById("clear-btn"),
	autoHoldToggle: document.getElementById("auto-hold-toggle"),
	autoHoldDays: document.getElementById("auto-hold-days"),

	// Carousel
	carouselSection: document.getElementById("carousel-section"),
	carouselTrack: document.getElementById("carousel-track"),
	carouselIndicators: document.getElementById("carousel-indicators"),
	carouselPlayPause: document.getElementById("carousel-play-pause"),
	carouselPrev: document.getElementById("carousel-prev"),
	carouselNext: document.getElementById("carousel-next"),
};

// Carousel State
let carouselState = {
	currentIndex: 0,
	isPlaying: true,
	interval: null,
	itemsPerView: 5,
	itemsToShow: 10, // Max novels to try to show in carousel
	uniqueCount: 0, // Actual unique novels available for the carousel
};

// Detect if running in sidebar (set via manifest URL parameter)
const isSidebar = window.location.search.includes("sidebar=true");

// Apply sidebar class early to minimize layout flash
if (isSidebar) {
	document.documentElement.classList.add("sidebar-mode");
}

/**
 * Initialize the library page
 */
async function init() {
	debugLog(
		"📚 Initializing Novel Library Page" +
			(isSidebar ? " (Sidebar mode)" : "")
	);

	// Add sidebar class to body if in sidebar
	if (isSidebar) {
		document.body.classList.add("sidebar-mode");
	}

	// Populate supported sites list dynamically from SHELVES
	populateSupportedSites();

	// Load saved library-level settings
	await loadLibrarySettings();

	// Set up event listeners
	setupEventListeners();

	// Set up storage change listener for auto-updates
	setupStorageListener();

	// Load library data
	await loadLibrary();
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
		const isProtectedStatus =
			novel.readingStatus === READING_STATUS.COMPLETED ||
			novel.readingStatus === READING_STATUS.DROPPED;

		if (
			!isProtectedStatus &&
			novel.readingStatus !== READING_STATUS.ON_HOLD &&
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
					onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
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
				onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
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
			)}" alt="" class="placeholder-icon-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="width: 3rem; height: 3rem; object-fit: contain;">
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
		)}" alt="" class="placeholder-icon-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="width: 3rem; height: 3rem; object-fit: contain;">
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
				<img src="${escapeHtml(
					icon
				)}" alt="" class="overlay-icon-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
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
				<img src="${escapeHtml(
					icon.url
				)}" alt="" class="overlay-icon-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
				<span class="overlay-icon-fallback" style="display: none;">${fallback}</span>
			</div>`;
	}

	return '<span class="novel-icon-overlay">📖</span>';
}

/**
 * Populate the supported sites list from SHELVES
 */
function populateSupportedSites() {
	const sitesList = document.getElementById("supported-sites-list");
	if (!sitesList) return;

	sitesList.innerHTML = Object.values(SHELVES)
		.map(
			(shelf) =>
				`<li>${renderShelfIcon(shelf.icon, "site-icon")} ${
					shelf.name
				}</li>`
		)
		.join("");
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
				handleStatusFilterChange(btn.dataset.status)
			);
		});
	}

	// Refresh
	elements.refreshBtn.addEventListener("click", loadLibrary);

	// Settings
	elements.settingsBtn.addEventListener("click", () =>
		openModal(elements.settingsModal)
	);
	elements.settingsClose.addEventListener("click", () =>
		closeModal(elements.settingsModal)
	);

	// Novel modal
	elements.modalClose.addEventListener("click", () =>
		closeModal(elements.novelModal)
	);
	elements.modalRemoveBtn.addEventListener("click", handleRemoveNovel);
	elements.modalRefreshBtn.addEventListener("click", handleRefreshMetadata);
	elements.modalEditBtn.addEventListener("click", handleOpenEditModal);
	if (elements.modalStatusSelector) {
		elements.modalStatusSelector.addEventListener(
			"change",
			handleModalStatusChange
		);
	}

	// Edit modal
	elements.editClose.addEventListener("click", () =>
		closeModal(elements.editModal)
	);
	elements.editCancelBtn.addEventListener("click", () =>
		closeModal(elements.editModal)
	);
	elements.editForm.addEventListener("submit", handleSaveEdit);
	elements.editCover.addEventListener(
		"input",
		debounce(handleCoverPreview, 500)
	);

	// Settings actions
	elements.exportBtn.addEventListener("click", handleExport);
	elements.importBtn.addEventListener("click", () =>
		elements.importFile.click()
	);
	elements.importFile.addEventListener("change", handleImport);
	elements.clearBtn.addEventListener("click", handleClearLibrary);

	// Carousel controls
	elements.carouselPlayPause.addEventListener(
		"click",
		toggleCarouselPlayPause
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
	elements.totalNovels.textContent = stats.totalNovels;
	elements.totalChapters.textContent = stats.totalEnhancedChapters;

	// Count active shelves
	const activeShelfCount = Object.values(stats.shelves).filter(
		(s) => s.novelCount > 0
	).length;
	elements.shelfCount.textContent = activeShelfCount;
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

	// Sort shelves by latest activity (most recent first)
	const sortedShelves = Object.entries(SHELVES).sort((a, b) => {
		const activityA = shelfLatestActivity[a[1].id] || 0;
		const activityB = shelfLatestActivity[b[1].id] || 0;
		return activityB - activityA; // Descending order
	});

	// Render shelves in sorted order
	for (const [shelfId, shelfDefinition] of sortedShelves) {
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
	const fallbackLogo = browser.runtime.getURL("icons/logo-light-128.png");

	// Generate placeholder content with icon image support
	const placeholderContent = shelf
		? renderShelfIconForPlaceholder(shelf.icon, shelf.emoji || "📖")
		: "📖";

	const coverHtml = novel.coverUrl
		? `<img src="${novel.coverUrl}" alt="Cover" class="novel-cover" loading="lazy" onerror="this.src='${fallbackLogo}'; this.onerror=null;">`
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
	const fallbackLogo = browser.runtime.getURL("icons/logo-light-128.png");

	// Generate placeholder content with icon image support
	const placeholderContent = shelf
		? renderShelfIconForPlaceholder(shelf.icon, shelf.emoji || "📖")
		: "📖";

	const coverHtml = novel.coverUrl
		? `<img src="${novel.coverUrl}" alt="Cover" class="novel-cover" loading="lazy" onerror="this.src='${fallbackLogo}'; this.onerror=null;">`
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
 */
function openNovelDetail(novel) {
	const shelf = Object.values(SHELVES).find((s) => s.id === novel.shelfId);
	const fallbackLogo = browser.runtime.getURL("icons/logo-light-128.png");

	// Use shelf/website icon as fallback instead of main logo
	const shelfFallback =
		shelf?.icon && shelf.icon.startsWith("http")
			? shelf.icon
			: fallbackLogo;

	// Set cover with fallback to shelf icon
	if (novel.coverUrl) {
		elements.modalCover.src = novel.coverUrl;
		elements.modalCover.onerror = function () {
			// Try shelf icon first, then fall back to main logo
			if (this.src !== shelfFallback && shelfFallback !== fallbackLogo) {
				this.src = shelfFallback;
			} else {
				this.src = fallbackLogo;
				this.onerror = null;
			}
		};
		elements.modalCover.style.display = "block";
	} else {
		// No cover URL - use shelf icon if available, otherwise main logo
		elements.modalCover.src = shelfFallback;
		elements.modalCover.onerror = function () {
			this.src = fallbackLogo;
			this.onerror = null;
		};
		elements.modalCover.style.display = "block";
	}

	// Set basic info
	elements.modalTitle.textContent = novel.title;
	elements.modalAuthor.textContent = novel.author || "Unknown";

	// Render shelf badge with icon (using innerHTML to render HTML)
	elements.modalShelf.innerHTML = shelf
		? `${renderShelfIcon(shelf.icon, "site-icon")} ${shelf.name}`
		: "Unknown";

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
				(genre) => `<span class="genre-tag">${escapeHtml(genre)}</span>`
			)
			.join("");
		elements.modalGenresContainer.style.display = "block";
	} else {
		elements.modalGenresContainer.style.display = "none";
	}

	// Populate rich metadata from novel.metadata
	populateNovelMetadata(novel);

	// Set action buttons
	elements.modalContinueBtn.href = novel.lastReadUrl || novel.sourceUrl;
	elements.modalSourceBtn.href = novel.sourceUrl;

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
	const stats = metadata.stats || {};
	const hasStats =
		stats.words ||
		stats.kudos ||
		stats.hits ||
		stats.bookmarks ||
		stats.comments;
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

		// Navigate to the novel's source page to fetch fresh data
		const novelUrl = novel.sourceUrl || novel.lastReadUrl;
		if (novelUrl) {
			// Open in a new tab so user can see the refresh happen
			window.open(novelUrl, "_blank");
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

/**
 * Handle opening the edit modal
 */
function handleOpenEditModal() {
	const novelId = elements.modalRemoveBtn.dataset.novelId;
	const novel = allNovels.find((n) => n.id === novelId);

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

	elements.editCoverPreview.innerHTML = `<img src="${escapeHtml(
		url
	)}" alt="Cover preview" onerror="this.outerHTML='<span class=\\'preview-error\\'>Invalid image URL</span>'">`;
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
		const choice = confirm(
			`Found ${novelCount} novels in backup file.\n\n` +
				`Click OK to MERGE with your existing library (recommended)\n` +
				`Click Cancel to see replace option`
		);

		if (choice) {
			// Merge mode
			const result = await novelLibrary.importLibrary(data, true);
			if (result.success) {
				await loadLibrary();
				closeModal(elements.settingsModal);
				alert(
					`Library merged successfully!\n\n` +
						`• ${result.imported} new novels added\n` +
						`• ${result.updated} existing novels updated\n` +
						(result.errors > 0
							? `• ${result.errors} errors occurred`
							: "")
				);
			} else {
				throw new Error(result.error || "Import failed");
			}
		} else {
			// Ask about replace
			if (
				confirm(
					"Do you want to REPLACE your entire library with the backup?\n\n" +
						"⚠️ WARNING: This will delete all your current library data!"
				)
			) {
				const result = await novelLibrary.importLibrary(data, false);
				if (result.success) {
					await loadLibrary();
					closeModal(elements.settingsModal);
					alert(
						`Library replaced successfully!\n\n• ${result.imported} novels imported`
					);
				} else {
					throw new Error(result.error || "Import failed");
				}
			}
		}
	} catch (error) {
		debugError("Import failed:", error);
		alert(
			`Failed to import library: ${error.message}\n\nMake sure the file is a valid Ranobe Gemini backup.`
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
	carouselState.uniqueCount = recentNovels.length;

	// Duplicate novels for infinite scrolling
	const infiniteNovels = [...recentNovels, ...recentNovels, ...recentNovels];

	// Fallback to extension logo if cover fails to load
	const fallbackLogo = browser.runtime.getURL("icons/logo-light-128.png");

	// Populate carousel track
	elements.carouselTrack.innerHTML = "";
	infiniteNovels.forEach((novel, index) => {
		const shelf = SHELVES[novel.shelfId];
		const item = document.createElement("div");
		item.className = "carousel-item";
		item.dataset.novelId = novel.id;
		item.dataset.originalIndex = index % recentNovels.length;

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
				  )}" alt="" class="meta-icon" onerror="this.outerHTML='${shelfEmoji}';" style="width: 1em; height: 1em; vertical-align: middle;">`
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

		// Determine cover source and fallback chain
		const coverSrc = novel.coverUrl || shelfCoverFallback;
		const coverFallbackChain = novel.coverUrl
			? `this.onerror=function(){this.src='${fallbackLogo}';this.onerror=null;}; this.src='${shelfCoverFallback}';`
			: `this.src='${fallbackLogo}'; this.onerror=null;`;

		item.innerHTML = `
			<div class="carousel-item-image-wrapper">
				<img src="${coverSrc}" alt="${escapeHtml(novel.title)}"
					 onerror="${coverFallbackChain}">
			</div>
			<div class="carousel-item-info">
				${
					shelf
						? `<div class="carousel-item-website">
					<span class="website-badge" style="background: ${
						shelf.color || "#666"
					}">${shelfIconSmall} ${escapeHtml(shelf.name)}</span>
				</div>`
						: ""
				}
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
					<p class="hover-description">${escapeHtml(
						novel.description || "No description available"
					)}</p>
					<div class="hover-stats">
						<span>📖 ${novel.totalChapters || "?"} chapters</span>
						<span>✨ ${novel.enhancedChaptersCount || 0} enhanced</span>
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
	const gap = 16; // --spacing-md
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
