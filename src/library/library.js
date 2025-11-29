/**
 * Novel Library Page Script
 * Handles UI interactions and data loading for the library page
 */

import { novelLibrary, SHELVES } from "../utils/novel-library.js";

// State
let currentView = "shelves";
let currentSort = "recent";
let searchQuery = "";
let allNovels = [];

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
	recentNovels: document.getElementById("recent-novels"),
	allNovels: document.getElementById("all-novels"),

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
	modalChapters: document.getElementById("modal-chapters"),
	modalEnhanced: document.getElementById("modal-enhanced"),
	modalLastRead: document.getElementById("modal-last-read"),
	modalDescription: document.getElementById("modal-description"),
	modalGenres: document.getElementById("modal-genres"),
	modalGenresContainer: document.getElementById("modal-genres-container"),
	modalContinueBtn: document.getElementById("modal-continue-btn"),
	modalSourceBtn: document.getElementById("modal-source-btn"),
	modalEditBtn: document.getElementById("modal-edit-btn"),
	modalRemoveBtn: document.getElementById("modal-remove-btn"),

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
	itemsToShow: 10, // Total novels in carousel (configurable)
};

/**
 * Initialize the library page
 */
async function init() {
	console.log("📚 Initializing Novel Library Page");

	// Populate supported sites list dynamically from SHELVES
	populateSupportedSites();

	// Set up event listeners
	setupEventListeners();

	// Load library data
	await loadLibrary();
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
				`<li><span class="site-icon">${shelf.icon}</span> ${shelf.name}</li>`
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
	elements.modalEditBtn.addEventListener("click", handleOpenEditModal);

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
		// Get library stats
		const stats = await novelLibrary.getStats();
		updateStats(stats);

		// Get all novels
		allNovels = await novelLibrary.getRecentNovels();

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
		console.error("Failed to load library:", error);
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
 * Render shelves view
 */
function renderShelvesView(novels) {
	elements.shelvesView.innerHTML = "";

	// Group novels by shelf
	const novelsByShelf = {};
	for (const novel of novels) {
		if (!novelsByShelf[novel.shelfId]) {
			novelsByShelf[novel.shelfId] = [];
		}
		novelsByShelf[novel.shelfId].push(novel);
	}

	// Render ALL registered shelves (including empty ones)
	for (const [shelfId, shelfDefinition] of Object.entries(SHELVES)) {
		const shelfNovels = novelsByShelf[shelfDefinition.id] || [];

		const shelfSection = document.createElement("section");
		shelfSection.className = "shelf-section";
		shelfSection.dataset.shelfId = shelfDefinition.id;

		const showAll = shelfSection.dataset.expanded === "true";
		const visibleNovels = showAll ? shelfNovels : shelfNovels.slice(0, 10); // 2 rows of 5
		const hasMore = shelfNovels.length > 10;

		shelfSection.innerHTML = `
			<div class="shelf-header">
				<h2 class="shelf-title">
					<button class="shelf-collapse-btn" title="Collapse shelf" data-shelf-id="${
						shelfDefinition.id
					}">
						<span class="collapse-icon">▼</span>
					</button>
					<span class="shelf-color-bar" style="background: ${
						shelfDefinition.color
					}"></span>
					<span class="shelf-icon">${shelfDefinition.icon}</span>
					${shelfDefinition.name}
					<span class="novel-count">(${shelfNovels.length})</span>
				</h2>
				<a href="shelf/${
					shelfDefinition.id
				}.html" class="shelf-view-all-link" title="View full shelf page">
					View All →
				</a>
			</div>
			<div class="novel-grid ${!showAll && hasMore ? "limited" : ""}"></div>
			${
				hasMore
					? `<button class="shelf-show-more" data-shelf-id="${
							shelfDefinition.id
					  }">${showAll ? "Show Less" : "Show More"}</button>`
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
			// Render novel cards (limited or all)
			visibleNovels.forEach((novel) => {
				grid.appendChild(createNovelCard(novel));
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
	const shelfIcon = shelf ? shelf.icon : "📖";

	const coverHtml = novel.coverUrl
		? `<img src="${novel.coverUrl}" alt="Cover" class="novel-cover" loading="lazy" onerror="this.outerHTML='<div class=\\'novel-cover-placeholder\\'>${shelfIcon}</div>'">`
		: `<div class="novel-cover-placeholder">${shelfIcon}</div>`;

	const progress =
		novel.totalChapters > 0
			? Math.round((novel.lastReadChapter / novel.totalChapters) * 100)
			: 0;

	card.innerHTML = `
		<div class="novel-card-inner">
			${coverHtml}
			<div class="novel-card-content">
				<h3 class="novel-card-title">${escapeHtml(novel.title)}</h3>
				<p class="novel-card-author">${escapeHtml(novel.author || "Unknown")}</p>
				<div class="novel-card-meta">
					<span class="meta-badge">${shelfIcon} ${shelf?.name || "Unknown"}</span>
					${
						novel.enhancedChaptersCount > 0
							? `<span class="meta-badge enhanced">✨ ${novel.enhancedChaptersCount} enhanced</span>`
							: ""
					}
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

	card.addEventListener("click", () => openNovelDetail(novel));

	return card;
}

/**
 * Open novel detail modal
 */
function openNovelDetail(novel) {
	const shelf = Object.values(SHELVES).find((s) => s.id === novel.shelfId);

	// Set cover
	if (novel.coverUrl) {
		elements.modalCover.src = novel.coverUrl;
		elements.modalCover.style.display = "block";
	} else {
		elements.modalCover.style.display = "none";
	}

	// Set basic info
	elements.modalTitle.textContent = novel.title;
	elements.modalAuthor.textContent = novel.author || "Unknown";
	elements.modalShelf.textContent = shelf
		? `${shelf.icon} ${shelf.name}`
		: "Unknown";
	elements.modalStatus.textContent =
		novel.status !== "unknown" ? novel.status : "";
	elements.modalStatus.style.display =
		novel.status !== "unknown" ? "inline" : "none";

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

	// Set action buttons
	elements.modalContinueBtn.href = novel.lastReadUrl || novel.sourceUrl;
	elements.modalSourceBtn.href = novel.sourceUrl;

	// Store current novel ID for removal
	elements.modalRemoveBtn.dataset.novelId = novel.id;

	openModal(elements.novelModal);
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
		// Update novel in library
		await novelLibrary.addOrUpdateNovel(updatedData);

		// Close modal and refresh
		closeModal(elements.editModal);
		await loadLibrary();

		showToast("Novel updated successfully!", "success");
	} catch (error) {
		console.error("Failed to update novel:", error);
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
		console.error("Export failed:", error);
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
		console.error("Import failed:", error);
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
	if (!novels || novels.length === 0) {
		elements.carouselSection.style.display = "none";
		return;
	}

	elements.carouselSection.style.display = "block";

	// Get top N most recent novels (configurable)
	const recentNovels = novels
		.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
		.slice(0, carouselState.itemsToShow);

	// Duplicate novels for infinite scrolling
	const infiniteNovels = [...recentNovels, ...recentNovels, ...recentNovels];

	// Populate carousel track
	elements.carouselTrack.innerHTML = "";
	infiniteNovels.forEach((novel, index) => {
		const shelf = SHELVES[novel.shelfId];
		const item = document.createElement("div");
		item.className = "carousel-item";
		item.dataset.novelId = novel.id;
		item.dataset.originalIndex = index % recentNovels.length;

		item.innerHTML = `
			<img src="${
				novel.coverUrl || "../icons/logo-light-1024.png"
			}" alt="${escapeHtml(novel.title)}"
				 onerror="this.src='../icons/logo-light-1024.png'">
			<div class="carousel-item-info">
				<div class="carousel-item-website">
					<span class="website-badge" style="background: ${shelf?.color || "#666"}">${
			shelf?.icon || "📚"
		} ${shelf?.name || "Unknown"}</span>
				</div>
				<h3 class="carousel-item-title">${escapeHtml(novel.title)}</h3>
				<p class="carousel-item-author">by ${escapeHtml(novel.author || "Unknown")}</p>
				<div class="carousel-item-meta">
					<span>📚 ${novel.enhancedChaptersCount || 0} chapters</span>
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
	carouselState.currentIndex = recentNovels.length;
	updateCarouselPosition(false);

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

	const totalNovels = carouselState.itemsToShow;

	carouselState.currentIndex += direction;

	// Infinite scrolling logic
	if (carouselState.currentIndex >= totalNovels * 2) {
		// Jumped to end, reset to middle without animation
		carouselState.currentIndex = totalNovels;
		updateCarouselPosition(false);
		setTimeout(() => {
			carouselState.currentIndex += direction;
			updateCarouselPosition(true);
		}, 50);
	} else if (carouselState.currentIndex < totalNovels) {
		// Jumped to beginning, reset to middle without animation
		carouselState.currentIndex = totalNovels * 2 - 1;
		updateCarouselPosition(false);
		setTimeout(() => {
			carouselState.currentIndex += direction;
			updateCarouselPosition(true);
		}, 50);
	} else {
		updateCarouselPosition(true);
	}

	// Update indicators to show actual position
	updateCarouselIndicators();
}

/**
 * Go to specific carousel page
 */
function goToCarouselPage(index) {
	const items = elements.carouselTrack.children;
	if (items.length === 0) return;

	const totalNovels = carouselState.itemsToShow;
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
	const totalNovels = carouselState.itemsToShow;
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
 */
function toggleShelfCollapse(shelfId) {
	const shelfSection = document.querySelector(
		`.shelf-section[data-shelf-id="${shelfId}"]`
	);
	if (!shelfSection) return;

	const isCollapsed = shelfSection.classList.toggle("collapsed");
	const collapseIcon = shelfSection.querySelector(".collapse-icon");

	if (isCollapsed) {
		collapseIcon.textContent = "▶";
		shelfSection.querySelector(".shelf-collapse-btn").title =
			"Expand shelf";
	} else {
		collapseIcon.textContent = "▼";
		shelfSection.querySelector(".shelf-collapse-btn").title =
			"Collapse shelf";
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

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);
