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

	// Render each shelf
	for (const [shelfId, shelfDefinition] of Object.entries(SHELVES)) {
		const shelfNovels = novelsByShelf[shelfDefinition.id] || [];

		// Skip empty shelves unless showing all
		if (shelfNovels.length === 0) continue;

		const shelfSection = document.createElement("section");
		shelfSection.className = "shelf-section";
		shelfSection.innerHTML = `
			<div class="shelf-header">
				<h2 class="shelf-title">
					<span class="shelf-color-bar" style="background: ${shelfDefinition.color}"></span>
					<span class="shelf-icon">${shelfDefinition.icon}</span>
					${shelfDefinition.name}
					<span class="novel-count">(${shelfNovels.length})</span>
				</h2>
			</div>
			<div class="novel-grid"></div>
		`;

		const grid = shelfSection.querySelector(".novel-grid");
		shelfNovels.forEach((novel) => {
			grid.appendChild(createNovelCard(novel));
		});

		elements.shelvesView.appendChild(shelfSection);
	}

	// If no shelves with novels, show empty state
	if (elements.shelvesView.children.length === 0) {
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
