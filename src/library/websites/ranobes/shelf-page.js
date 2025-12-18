/**
 * Ranobes Shelf Page Script
 * Handles filtering, sorting, rendering, and modals for the Ranobes library view
 */

import { RanobesHandler } from "../../../utils/website-handlers/ranobes-handler.js";
import {
	READING_STATUS,
	READING_STATUS_INFO,
} from "../../../utils/novel-library.js";

// State variables
let allNovels = [];
let filteredNovels = [];

// Filter state
const DEFAULT_FILTERS = {
	search: "",
	readingStatus: "all",
	workStatus: "all",
	language: "all",
	genre: "all",
	sort: "recent",
};

let filterState = { ...DEFAULT_FILTERS };

// Dynamic filter options
const availableLanguages = new Set();
const availableGenres = new Set();

/**
 * Normalize reading status for consistent comparison
 */
function normalizeReadingStatus(status) {
	if (!status) return READING_STATUS.PLAN_TO_READ;
	const normalized = status
		.toString()
		.toLowerCase()
		.replace(/[_\s-]/g, "");

	const statusMap = {
		reading: READING_STATUS.READING,
		currentlyreading: READING_STATUS.READING,
		completed: READING_STATUS.COMPLETED,
		plantoread: READING_STATUS.PLAN_TO_READ,
		plan_to_read: READING_STATUS.PLAN_TO_READ,
		onhold: READING_STATUS.ON_HOLD,
		on_hold: READING_STATUS.ON_HOLD,
		dropped: READING_STATUS.DROPPED,
		rereading: READING_STATUS.REREADING,
	};

	return statusMap[normalized] || READING_STATUS.PLAN_TO_READ;
}

/**
 * Format large numbers for display
 */
function formatNumber(num) {
	if (!num) return "0";
	if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
	if (num >= 1000) return (num / 1000).toFixed(1) + "K";
	return num.toLocaleString();
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

/**
 * Initialize the shelf page
 */
async function initializeRanobesShelf() {
	console.log("[Ranobes Shelf] Initializing...");

	const loadingState = document.getElementById("loading-state");
	const emptyState = document.getElementById("empty-state");
	const novelGrid = document.getElementById("novel-grid");

	try {
		// Load novels from storage
		const result = await browser.storage.local.get("rg_novel_library");
		const library = result.rg_novel_library || {};

		console.log(
			`[Ranobes Shelf] Total novels in library: ${
				Object.keys(library).length
			}`
		);

		// Filter for Ranobes novels
		allNovels = Object.values(library).filter((novel) => {
			const source = (novel.source || "").toLowerCase();
			const sourceUrl = (novel.sourceUrl || "").toLowerCase();
			const isRanobes =
				source === "ranobes" ||
				source.includes("ranobes") ||
				sourceUrl.includes("ranobes.top") ||
				sourceUrl.includes("ranobes.net") ||
				sourceUrl.includes("ranobes.com");

			if (isRanobes) {
				console.log(
					`[Ranobes Shelf] Found novel: ${novel.title} (source: ${novel.source}, url: ${novel.sourceUrl})`
				);
			}

			return isRanobes;
		});

		console.log(
			`[Ranobes Shelf] Loaded ${allNovels.length} Ranobes novels`
		);

		// Extract available filter options
		allNovels.forEach((novel) => {
			if (novel.metadata?.language) {
				availableLanguages.add(novel.metadata.language);
			}
			if (novel.metadata?.genres) {
				novel.metadata.genres.forEach((g) => availableGenres.add(g));
			}
		});

		// Populate dynamic filters
		populateDynamicFilters();

		// Setup event listeners
		setupEventListeners();

		if (allNovels.length === 0) {
			console.log("[Ranobes Shelf] No novels found, showing empty state");
			if (loadingState) loadingState.style.display = "none";
			if (emptyState) emptyState.style.display = "block";
			if (novelGrid) novelGrid.style.display = "none";
			updateAnalytics([]);
			return;
		}

		console.log("[Ranobes Shelf] Showing novel grid");
		if (loadingState) loadingState.style.display = "none";
		if (emptyState) emptyState.style.display = "none";
		if (novelGrid) novelGrid.style.display = "grid";

		// Apply filters and render
		applyFiltersAndSort();

		// Setup page icon
		const pageIconImg = document.getElementById("page-icon-img");
		const pageIcon = document.getElementById("page-icon");
		if (pageIconImg) {
			pageIconImg.style.display = "inline-block";
			if (pageIcon) pageIcon.style.display = "none";
			pageIconImg.onerror = () => {
				pageIconImg.style.display = "none";
				if (pageIcon) pageIcon.style.display = "inline-block";
			};
		}
	} catch (error) {
		console.error("[Ranobes Shelf] Error initializing:", error);
		if (loadingState) loadingState.style.display = "none";
		if (emptyState) {
			emptyState.style.display = "block";
			const h2 = emptyState.querySelector("h2");
			if (h2) h2.textContent = `Error: ${error.message}`;
		}
	}
}

/**
 * Populate dynamic filter dropdowns
 */
function populateDynamicFilters() {
	const languageFilter = document.getElementById("language-filter");
	const genreFilter = document.getElementById("genre-filter");

	if (languageFilter) {
		const sortedLanguages = Array.from(availableLanguages).sort();
		sortedLanguages.forEach((lang) => {
			const option = document.createElement("option");
			option.value = lang;
			option.textContent = lang;
			languageFilter.appendChild(option);
		});
	}

	if (genreFilter) {
		const sortedGenres = Array.from(availableGenres).sort();
		sortedGenres.forEach((genre) => {
			const option = document.createElement("option");
			option.value = genre;
			option.textContent = genre;
			genreFilter.appendChild(option);
		});
	}
}

/**
 * Setup event listeners for filters and interactions
 */
function setupEventListeners() {
	// Search input
	const searchInput = document.getElementById("search-input");
	if (searchInput) {
		let searchTimeout;
		searchInput.addEventListener("input", () => {
			clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => {
				filterState.search = searchInput.value.trim();
				applyFiltersAndSort();
			}, 300);
		});
	}

	// Sort select
	const sortSelect = document.getElementById("sort-select");
	if (sortSelect) {
		sortSelect.addEventListener("change", () => {
			filterState.sort = sortSelect.value;
			applyFiltersAndSort();
		});
	}

	// Reading status filter
	const readingStatusFilter = document.getElementById(
		"reading-status-filter"
	);
	if (readingStatusFilter) {
		readingStatusFilter.addEventListener("change", () => {
			filterState.readingStatus = readingStatusFilter.value;
			applyFiltersAndSort();
		});
	}

	// Work status filter
	const workStatusFilter = document.getElementById("work-status-filter");
	if (workStatusFilter) {
		workStatusFilter.addEventListener("change", () => {
			filterState.workStatus = workStatusFilter.value;
			applyFiltersAndSort();
		});
	}

	// Language filter
	const languageFilter = document.getElementById("language-filter");
	if (languageFilter) {
		languageFilter.addEventListener("change", () => {
			filterState.language = languageFilter.value;
			applyFiltersAndSort();
		});
	}

	// Genre filter
	const genreFilter = document.getElementById("genre-filter");
	if (genreFilter) {
		genreFilter.addEventListener("change", () => {
			filterState.genre = genreFilter.value;
			applyFiltersAndSort();
		});
	}
}

/**
 * Apply filters and sort, then render
 */
function applyFiltersAndSort() {
	filteredNovels = [...allNovels];

	const { search, readingStatus, workStatus, language, genre, sort } =
		filterState;

	// Search filter
	if (search) {
		const query = search.toLowerCase();
		filteredNovels = filteredNovels.filter((n) => {
			const titleMatch = n.title?.toLowerCase().includes(query);
			const authorMatch = n.author?.toLowerCase().includes(query);
			const tagMatch = (n.metadata?.tags || []).some((t) =>
				t.toLowerCase().includes(query)
			);
			return titleMatch || authorMatch || tagMatch;
		});
	}

	// Reading status filter
	if (readingStatus && readingStatus !== "all") {
		filteredNovels = filteredNovels.filter((n) => {
			const normalized = normalizeReadingStatus(n.readingStatus);
			return normalized === readingStatus;
		});
	}

	// Work status filter
	if (workStatus && workStatus !== "all") {
		filteredNovels = filteredNovels.filter((n) => {
			const status = (n.status || "").toLowerCase();
			return status === workStatus.toLowerCase();
		});
	}

	// Language filter
	if (language && language !== "all") {
		filteredNovels = filteredNovels.filter((n) => {
			return (n.metadata?.language || "") === language;
		});
	}

	// Genre filter
	if (genre && genre !== "all") {
		filteredNovels = filteredNovels.filter((n) => {
			return (n.metadata?.genres || []).includes(genre);
		});
	}

	// Sort
	filteredNovels.sort((a, b) => {
		switch (sort) {
			case "recent":
				return (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0);
			case "added":
				return (
					(b.dateAdded || b.addedAt || 0) -
					(a.dateAdded || a.addedAt || 0)
				);
			case "title":
				return (a.title || "").localeCompare(b.title || "");
			case "title-desc":
				return (b.title || "").localeCompare(a.title || "");
			case "chapters":
				return (b.totalChapters || 0) - (a.totalChapters || 0);
			case "chapters-asc":
				return (a.totalChapters || 0) - (b.totalChapters || 0);
			default:
				return 0;
		}
	});

	renderNovels();
	updateAnalytics(allNovels);
	updateActiveFilters();
}

/**
 * Update active filters display
 */
function updateActiveFilters() {
	const container = document.getElementById("active-filters");
	if (!container) return;

	container.innerHTML = "";
	const activeFilters = [];

	if (filterState.search) {
		activeFilters.push({
			label: `Search: "${filterState.search}"`,
			key: "search",
		});
	}
	if (filterState.readingStatus !== "all") {
		const info = READING_STATUS_INFO[filterState.readingStatus];
		activeFilters.push({
			label: `Status: ${info?.label || filterState.readingStatus}`,
			key: "readingStatus",
		});
	}
	if (filterState.workStatus !== "all") {
		activeFilters.push({
			label: `Work: ${filterState.workStatus}`,
			key: "workStatus",
		});
	}
	if (filterState.language !== "all") {
		activeFilters.push({
			label: `Language: ${filterState.language}`,
			key: "language",
		});
	}
	if (filterState.genre !== "all") {
		activeFilters.push({
			label: `Genre: ${filterState.genre}`,
			key: "genre",
		});
	}

	if (activeFilters.length === 0) return;

	activeFilters.forEach((filter) => {
		const tag = document.createElement("span");
		tag.className = "active-filter-tag";
		tag.innerHTML = `${escapeHtml(
			filter.label
		)} <span class="remove-filter" data-key="${filter.key}">×</span>`;
		container.appendChild(tag);

		tag.querySelector(".remove-filter").addEventListener("click", () => {
			if (filter.key === "search") {
				filterState.search = "";
				const input = document.getElementById("search-input");
				if (input) input.value = "";
			} else {
				filterState[filter.key] = "all";
				const select = document.getElementById(
					filter.key === "readingStatus"
						? "reading-status-filter"
						: filter.key === "workStatus"
						? "work-status-filter"
						: `${filter.key}-filter`
				);
				if (select) select.value = "all";
			}
			applyFiltersAndSort();
		});
	});

	// Add clear all button
	if (activeFilters.length > 1) {
		const clearBtn = document.createElement("button");
		clearBtn.className = "clear-all-filters";
		clearBtn.textContent = "Clear All";
		clearBtn.addEventListener("click", () => {
			filterState = { ...DEFAULT_FILTERS };
			const searchInput = document.getElementById("search-input");
			if (searchInput) searchInput.value = "";
			document
				.querySelectorAll(".filter-section select")
				.forEach((sel) => {
					sel.value = "all";
				});
			const sortSelect = document.getElementById("sort-select");
			if (sortSelect) sortSelect.value = "recent";
			applyFiltersAndSort();
		});
		container.appendChild(clearBtn);
	}
}

/**
 * Render novels to the grid
 */
function renderNovels() {
	const grid = document.getElementById("novel-grid");
	const emptyState = document.getElementById("empty-state");
	const novelCount = document.getElementById("novel-count");

	if (!grid) return;

	if (filteredNovels.length === 0) {
		grid.style.display = "none";
		if (emptyState) {
			emptyState.style.display = "block";
			const h2 = emptyState.querySelector("h2");
			if (h2) {
				h2.textContent =
					allNovels.length > 0
						? "No novels match your filters"
						: "No novels from Ranobes yet!";
			}
		}
		if (novelCount) novelCount.textContent = "(0 novels)";
		return;
	}

	if (emptyState) emptyState.style.display = "none";
	grid.style.display = "grid";

	grid.innerHTML = "";

	filteredNovels.forEach((novel) => {
		const card = createNovelCard(novel);
		grid.appendChild(card);
	});

	if (novelCount) {
		novelCount.textContent = `(${filteredNovels.length} novel${
			filteredNovels.length !== 1 ? "s" : ""
		})`;
	}

	// Setup card click handlers
	grid.querySelectorAll(".novel-card").forEach((card) => {
		card.addEventListener("click", (e) => {
			if (!e.target.closest("button, a, select")) {
				const novelId = card.dataset.novelId;
				const novel = filteredNovels.find((n) => n.id === novelId);
				if (novel) {
					showNovelModal(novel);
				}
			}
		});
	});
}

/**
 * Create a novel card element
 */
function createNovelCard(novel) {
	const card = document.createElement("div");
	card.className = "novel-card";
	card.dataset.novelId = novel.id;

	const coverUrl = novel.coverUrl || "";
	const status = (novel.status || "ongoing").toLowerCase();
	const statusClass =
		status === "completed"
			? "completed"
			: status === "hiatus"
			? "hiatus"
			: "ongoing";
	const readingStatus = normalizeReadingStatus(novel.readingStatus);
	const readingInfo =
		READING_STATUS_INFO[readingStatus] ||
		READING_STATUS_INFO[READING_STATUS.PLAN_TO_READ];

	const genres = (novel.metadata?.genres || []).slice(0, 3);
	const genresHtml = genres
		.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`)
		.join("");

	const progress = novel.totalChapters
		? Math.round(((novel.lastReadChapter || 1) / novel.totalChapters) * 100)
		: 0;

	card.innerHTML = `
		<div class="novel-card-cover">
			${
				coverUrl
					? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(
							novel.title
					  )}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
					: ""
			}
			<div class="novel-card-placeholder" style="${
				coverUrl ? "display: none;" : "display: flex;"
			}">
				<span>🍃</span>
			</div>
			<div class="novel-card-badges">
				<span class="status-badge ${statusClass}">${escapeHtml(status)}</span>
			</div>
		</div>
		<div class="novel-card-info">
			<h3 class="novel-title">${escapeHtml(novel.title)}</h3>
			<p class="novel-author">${escapeHtml(novel.author || "Unknown Author")}</p>
			<div class="novel-genres">${genresHtml}</div>
			<div class="novel-stats">
				<span>📖 ${novel.totalChapters || "?"} ch</span>
				<span>✨ ${novel.enhancedChaptersCount || 0}</span>
			</div>
			<div class="progress-bar">
				<div class="progress-fill" style="width: ${progress}%; background: ${
		readingInfo.color || "var(--ranobes-primary)"
	}"></div>
			</div>
			<div class="reading-status" style="color: ${readingInfo.color}">
				${readingInfo.emoji || "📚"} ${readingInfo.label}
			</div>
		</div>
	`;

	return card;
}

/**
 * Show novel detail modal
 */
function showNovelModal(novel) {
	const modal = document.getElementById("novel-modal");
	if (!modal) return;

	// Set basic info
	document.getElementById("modal-title").textContent = novel.title || "";
	document.getElementById("modal-author").textContent = `by ${
		novel.author || "Unknown"
	}`;
	document.getElementById("modal-description").textContent =
		novel.description || "No description available.";

	// Handle cover
	const coverImg = document.getElementById("modal-cover");
	const coverPlaceholder = document.getElementById("modal-cover-placeholder");

	if (novel.coverUrl) {
		coverImg.src = novel.coverUrl;
		coverImg.style.display = "block";
		if (coverPlaceholder) coverPlaceholder.style.display = "none";
		coverImg.onerror = () => {
			coverImg.style.display = "none";
			if (coverPlaceholder) coverPlaceholder.style.display = "flex";
		};
	} else {
		coverImg.style.display = "none";
		if (coverPlaceholder) coverPlaceholder.style.display = "flex";
	}

	// Set metadata
	const metadata = novel.metadata || {};
	const metadataContainer = document.getElementById("modal-metadata");
	metadataContainer.innerHTML = `
		<div class="metadata-item">
			<div class="label">Status</div>
			<div class="value">${escapeHtml(novel.status || "Unknown")}</div>
		</div>
		<div class="metadata-item">
			<div class="label">Chapters</div>
			<div class="value">${novel.totalChapters || "?"}</div>
		</div>
		<div class="metadata-item">
			<div class="label">Enhanced</div>
			<div class="value">${novel.enhancedChaptersCount || 0}</div>
		</div>
		<div class="metadata-item">
			<div class="label">Current</div>
			<div class="value">Ch. ${novel.lastReadChapter || 1}</div>
		</div>
		${
			metadata.language
				? `
		<div class="metadata-item">
			<div class="label">Language</div>
			<div class="value">${escapeHtml(metadata.language)}</div>
		</div>`
				: ""
		}
		${
			metadata.rating
				? `
		<div class="metadata-item">
			<div class="label">Rating</div>
			<div class="value">${escapeHtml(metadata.rating)}</div>
		</div>`
				: ""
		}
	`;

	// Set genres
	const genresContainer = document.getElementById("modal-genres");
	if (metadata.genres && metadata.genres.length > 0) {
		genresContainer.innerHTML = metadata.genres
			.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`)
			.join("");
		genresContainer.parentElement.style.display = "block";
	} else {
		genresContainer.parentElement.style.display = "none";
	}

	// Set tags
	const tagsContainer = document.getElementById("modal-tags");
	if (metadata.tags && metadata.tags.length > 0) {
		tagsContainer.innerHTML = metadata.tags
			.map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`)
			.join("");
		tagsContainer.parentElement.style.display = "block";
	} else {
		tagsContainer.parentElement.style.display = "none";
	}

	// Set action buttons
	const continueBtn = document.getElementById("modal-continue-btn");
	if (continueBtn) {
		const lastReadUrl =
			novel.lastReadChapterUrl ||
			novel.currentChapterUrl ||
			novel.sourceUrl;
		continueBtn.href = lastReadUrl || "#";
		continueBtn.style.display = lastReadUrl ? "inline-flex" : "none";
	}

	const readBtn = document.getElementById("modal-read-btn");
	if (readBtn && novel.sourceUrl) {
		readBtn.href = novel.sourceUrl;
	}

	// Refresh button
	const refreshBtn = document.getElementById("modal-refresh-btn");
	if (refreshBtn) {
		refreshBtn.onclick = () => {
			refreshNovelMetadata(novel.id);
			closeModal();
		};
	}

	// Edit button
	const editBtn = document.getElementById("modal-edit-btn");
	if (editBtn) {
		editBtn.onclick = () => {
			openEditModal(novel);
			closeModal();
		};
	}

	// Remove button
	const removeBtn = document.getElementById("modal-remove-btn");
	if (removeBtn) {
		removeBtn.onclick = async () => {
			if (
				confirm(
					`Are you sure you want to remove "${novel.title}" from your library?`
				)
			) {
				await removeNovelFromLibrary(novel.id);
				closeModal();
			}
		};
	}

	// Show modal
	modal.style.display = "flex";

	// Close handlers
	const closeBtn = document.getElementById("modal-close-btn");
	const backdrop = document.getElementById("modal-backdrop");

	function closeModal() {
		modal.style.display = "none";
	}

	closeBtn.onclick = closeModal;
	backdrop.onclick = closeModal;

	const closeOnEscape = (e) => {
		if (e.key === "Escape") {
			closeModal();
			document.removeEventListener("keydown", closeOnEscape);
		}
	};
	document.addEventListener("keydown", closeOnEscape);
}

/**
 * Update analytics display
 */
function updateAnalytics(novels) {
	const setStatText = (id, value) => {
		const el = document.getElementById(id);
		if (el) el.textContent = value;
	};

	if (!novels || novels.length === 0) {
		setStatText("stats-novels", "0");
		setStatText("stats-chapters", "0");
		setStatText("stats-enhanced", "0");
		setStatText("stats-words", "0");
		setStatText("stats-completed", "0");
		setStatText("stats-reading", "0");
		setStatText("most-chapters", "-");
		setStatText("longest-novel", "-");
		setStatText("most-enhanced", "-");
		setStatText("newest-addition", "-");
		setStatText("top-rated", "-");
		setStatText("most-popular", "-");
		return;
	}

	const totalNovels = novels.length;
	const totalChapters = novels.reduce(
		(sum, n) => sum + (n.totalChapters || 0),
		0
	);
	const totalEnhanced = novels.reduce(
		(sum, n) => sum + (n.enhancedChaptersCount || 0),
		0
	);

	// Estimate words (assuming ~2000 words per chapter average for web novels)
	const estimatedWords = totalEnhanced * 2000;

	const completedCount = novels.filter(
		(n) =>
			normalizeReadingStatus(n.readingStatus) === READING_STATUS.COMPLETED
	).length;

	const readingCount = novels.filter(
		(n) =>
			normalizeReadingStatus(n.readingStatus) === READING_STATUS.READING
	).length;

	setStatText("stats-novels", totalNovels.toLocaleString());
	setStatText("stats-chapters", formatNumber(totalChapters));
	setStatText("stats-enhanced", formatNumber(totalEnhanced));
	setStatText("stats-words", formatNumber(estimatedWords));
	setStatText("stats-completed", completedCount.toLocaleString());
	setStatText("stats-reading", readingCount.toLocaleString());

	// Library insights
	let mostChapters = null;
	let longest = null;
	let mostEnhanced = null;
	let newestAddition = null;
	let topRated = null;
	let mostPopular = null;

	novels.forEach((novel) => {
		const chapters = novel.totalChapters || 0;
		const enhanced = novel.enhancedChaptersCount || 0;
		const dateAdded = novel.dateAdded || novel.addedAt || 0;
		const rating = novel.metadata?.rating || 0;
		const views = novel.metadata?.views || novel.metadata?.hits || 0;

		if (!mostChapters || chapters > (mostChapters.totalChapters || 0)) {
			mostChapters = novel;
		}
		if (!longest || chapters > (longest.totalChapters || 0)) {
			longest = novel;
		}
		if (
			!mostEnhanced ||
			enhanced > (mostEnhanced.enhancedChaptersCount || 0)
		) {
			mostEnhanced = novel;
		}
		if (
			!newestAddition ||
			dateAdded >
				(newestAddition.dateAdded || newestAddition.addedAt || 0)
		) {
			newestAddition = novel;
		}
		if (!topRated || rating > (topRated.metadata?.rating || 0)) {
			topRated = novel;
		}
		if (
			!mostPopular ||
			views >
				(mostPopular.metadata?.views || mostPopular.metadata?.hits || 0)
		) {
			mostPopular = novel;
		}
	});

	setStatText(
		"most-chapters",
		mostChapters
			? `${mostChapters.title} (${mostChapters.totalChapters || 0})`
			: "-"
	);
	setStatText(
		"longest-novel",
		longest ? `${longest.title} (${longest.totalChapters || 0} ch)` : "-"
	);
	setStatText(
		"most-enhanced",
		mostEnhanced
			? `${mostEnhanced.title} (${
					mostEnhanced.enhancedChaptersCount || 0
			  })`
			: "-"
	);
	setStatText("newest-addition", newestAddition ? newestAddition.title : "-");
	setStatText(
		"top-rated",
		topRated?.metadata?.rating
			? `${topRated.title} (${topRated.metadata.rating})`
			: "-"
	);
	setStatText(
		"most-popular",
		mostPopular?.metadata?.views || mostPopular?.metadata?.hits
			? `${mostPopular.title} (${formatNumber(
					mostPopular.metadata.views || mostPopular.metadata.hits
			  )})`
			: "-"
	);
}

// Helper functions for modal actions
function showToast(message, type = "success") {
	const toast = document.createElement("div");
	toast.className = `toast toast-${type}`;
	toast.textContent = message;
	toast.style.cssText = `
		position: fixed;
		bottom: 20px;
		right: 20px;
		padding: 12px 24px;
		border-radius: 8px;
		color: white;
		font-weight: 500;
		z-index: 10000;
		animation: slideIn 0.3s ease;
		background-color: ${
			type === "success"
				? "#10b981"
				: type === "error"
				? "#ef4444"
				: "#3b82f6"
		};
	`;
	document.body.appendChild(toast);
	setTimeout(() => {
		toast.style.animation = "slideOut 0.3s ease";
		setTimeout(() => toast.remove(), 300);
	}, 3000);
}

async function removeNovelFromLibrary(novelId) {
	try {
		const result = await browser.storage.local.get("rg_novel_library");
		const library = result.rg_novel_library || {};

		if (library[novelId]) {
			delete library[novelId];
			await browser.storage.local.set({ rg_novel_library: library });

			// Refresh the display
			allNovels = allNovels.filter((n) => n.id !== novelId);
			applyFiltersAndSort();

			showToast("Novel removed from library", "success");
		}
	} catch (error) {
		console.error("[Ranobes Shelf] Error removing novel:", error);
		showToast("Failed to remove novel", "error");
	}
}

function refreshNovelMetadata(novelId) {
	window.dispatchEvent(
		new CustomEvent("refreshNovelMetadata", { detail: { novelId } })
	);
	showToast("Refresh requested - visit the novel page to update", "info");
}

function openEditModal(novel) {
	window.dispatchEvent(
		new CustomEvent("openEditModal", { detail: { novel } })
	);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeRanobesShelf);
} else {
	initializeRanobesShelf();
}
