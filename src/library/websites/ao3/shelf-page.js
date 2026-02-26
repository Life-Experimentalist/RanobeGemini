/**
 * Archive of Our Own (AO3) Shelf Page Script
 * Handles filtering, sorting, rendering, and fandom navigation for the AO3 library view
 */

import { AO3CardRenderer } from "./novel-card.js";
import { AO3Handler } from "../../../utils/website-handlers/ao3-handler.js";
import { NovelCardRenderer } from "../novel-card-base.js";
import { openInlineEditModal } from "../../edit-modal.js";
import {
	READING_STATUS,
	READING_STATUS_INFO,
	updateNovelInLibrary,
} from "../../../utils/novel-library.js";
import { loadImageWithCache } from "../../../utils/image-cache.js";

const CANONICAL_LABELS = new Map();

const CATEGORY_LOOKUP = {
	fandoms: new Set(),
	relationships: new Set(),
	characters: new Set(),
	additionalTags: new Set(),
};

// Initialize taxonomy categories from handler definition
const TAXONOMY = AO3Handler.SHELF_METADATA?.taxonomy || [
	{ id: "fandoms", label: "Fandoms", type: "array" },
	{ id: "relationships", label: "Relationships", type: "array" },
	{ id: "characters", label: "Characters", type: "array" },
	{ id: "additionalTags", label: "Additional Tags", type: "array" },
];

// State for filtering and rendering
let allNovels = [];
let filteredNovels = [];
let currentView = "all";
let selectedFandom = null;

const FILTER_STORAGE_KEY = "rg_ao3_filters";
const DEFAULT_FILTERS = {
	search: "",
	rating: "all",
	readingStatus: "all",
	workStatus: "all",
	category: "all",
	language: "all",
	fandoms: [],
	relationships: [],
	characters: [],
	tags: [],
	tagsMode: "any",
	fandomsMode: "any",
	fandomsView: "dropdown",
	wordCountMin: "",
	wordCountMax: "",
	sort: "recent",
};

let filterState = { ...DEFAULT_FILTERS };

function resetTaxonomy() {
	CANONICAL_LABELS.clear();
	Object.values(CATEGORY_LOOKUP).forEach((set) => set.clear());
}

function registerLabel(label, category) {
	if (!label) return "";
	const cleaned = label.toString().trim();
	if (!cleaned) return "";
	const lower = cleaned.toLowerCase();
	if (!CANONICAL_LABELS.has(lower)) {
		CANONICAL_LABELS.set(lower, cleaned);
	}
	if (category && CATEGORY_LOOKUP[category]) {
		CATEGORY_LOOKUP[category].add(lower);
	}
	return CANONICAL_LABELS.get(lower) || cleaned;
}

function canonicalizeLabel(label, category) {
	return registerLabel(label, category);
}

function categorizeLabel(label) {
	const lower = label.toLowerCase();
	for (const key of Object.keys(CATEGORY_LOOKUP)) {
		if (CATEGORY_LOOKUP[key].has(lower)) return key;
	}
	return null;
}

function sortAlpha(list = []) {
	return [...list].sort((a, b) => a.localeCompare(b));
}

function buildTaxonomyFromNovels(novels) {
	resetTaxonomy();
	novels.forEach((novel) => {
		const metadata = novel.metadata || {};

		// Register fandoms
		(metadata.fandoms || []).forEach((v) => registerLabel(v, "fandoms"));
		// Register relationships
		(metadata.relationships || []).forEach((v) =>
			registerLabel(v, "relationships"),
		);
		// Register characters
		(metadata.characters || []).forEach((v) =>
			registerLabel(v, "characters"),
		);
		// Register additional tags
		(metadata.additionalTags || []).forEach((v) =>
			registerLabel(v, "additionalTags"),
		);
	});
}

function loadSavedFilters() {
	try {
		const saved = localStorage.getItem(FILTER_STORAGE_KEY);
		if (saved) {
			filterState = { ...DEFAULT_FILTERS, ...JSON.parse(saved) };
		}
	} catch (error) {
		console.warn("[AO3 Shelf] Failed to load saved filters", error);
		filterState = { ...DEFAULT_FILTERS };
	}
}

function persistFilters() {
	try {
		localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterState));
	} catch (error) {
		console.warn("[AO3 Shelf] Failed to save filters", error);
	}
}

function applyFilterStateToUI() {
	const searchInput = document.getElementById("search-input");
	if (searchInput) {
		searchInput.value = filterState.search || "";
	}

	const bindValue = (id, value) => {
		const el = document.getElementById(id);
		if (el) {
			el.value = value;
		}
	};

	bindValue("rating-filter", filterState.rating);
	bindValue("status-filter", filterState.readingStatus);
	bindValue("work-status-filter", filterState.workStatus);
	bindValue("category-filter", filterState.category);
	bindValue("language-filter", filterState.language);
	bindValue("sort-select", filterState.sort);
	bindValue("wordcount-min", filterState.wordCountMin || "");
	bindValue("wordcount-max", filterState.wordCountMax || "");

	const tagMatchSelect = document.getElementById("tags-match-mode");
	if (tagMatchSelect) {
		tagMatchSelect.value = filterState.tagsMode || "any";
	}

	syncMultiSelectUI("fandoms-filter", filterState.fandoms || [], {});
	syncMultiSelectUI(
		"relationships-filter",
		filterState.relationships || [],
		{},
	);
	syncMultiSelectUI("characters-filter", filterState.characters || [], {});
	syncMultiSelectUI("tags-filter", filterState.tags || [], {});

	renderActiveFilters();
}

function renderActiveFilters() {
	const container = document.getElementById("active-filters");
	if (!container) return;
	updateDropdownLabels();

	const chips = [];
	const addChip = (key, label, value = "") =>
		chips.push({ key, label, value });

	if (filterState.search) addChip("search", `Search: ${filterState.search}`);
	if (filterState.rating && filterState.rating !== "all")
		addChip("rating", `Rating: ${filterState.rating}`);
	if (filterState.readingStatus && filterState.readingStatus !== "all")
		addChip("readingStatus", `Reading: ${filterState.readingStatus}`);
	if (filterState.workStatus && filterState.workStatus !== "all")
		addChip("workStatus", `Status: ${filterState.workStatus}`);
	if (filterState.category && filterState.category !== "all")
		addChip("category", `Category: ${filterState.category}`);
	if (filterState.language && filterState.language !== "all")
		addChip("language", `Language: ${filterState.language}`);

	(filterState.fandoms || []).forEach((fandom) => {
		addChip("fandoms", `Fandom: ${fandom}`, fandom);
	});

	(filterState.relationships || []).forEach((relationship) => {
		addChip("relationships", `Ship: ${relationship}`, relationship);
	});

	(filterState.characters || []).forEach((character) => {
		addChip("characters", `Character: ${character}`, character);
	});

	const minWords = parseInt(filterState.wordCountMin, 10);
	if (!Number.isNaN(minWords) && minWords > 0) {
		addChip("wordCountMin", `Words ≥ ${minWords.toLocaleString()}`);
	}

	const maxWords = parseInt(filterState.wordCountMax, 10);
	if (!Number.isNaN(maxWords) && maxWords > 0) {
		addChip("wordCountMax", `Words ≤ ${maxWords.toLocaleString()}`);
	}

	(filterState.tags || []).forEach((tag) => {
		addChip("tags", `Tag: ${tag}`, tag);
	});

	if ((filterState.tags || []).length && filterState.tagsMode === "all") {
		addChip("tagsMode", "Tags: all must match");
	}

	container.innerHTML = "";
	chips.forEach((chip) => {
		const el = document.createElement("span");
		el.className = "filter-chip";
		el.innerHTML = `<strong>${escapeHtml(
			chip.label,
		)}</strong> <button aria-label="Clear filter" data-key="${
			chip.key
		}" data-value="${chip.value ? escapeHtml(chip.value) : ""}">×</button>`;
		container.appendChild(el);
	});

	container.querySelectorAll("button").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			clearFilter(btn.dataset.key, btn.dataset.value);
		});
	});

	updateFilterBadge(chips.length);
}

function updateFilterBadge(count) {
	const badge = document.getElementById("filter-badge");
	if (!badge) return;
	badge.textContent = count;
	badge.style.display = count > 0 ? "inline-block" : "none";
}

function updateDropdownLabels() {
	const setLabel = (id, base, count = 0) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.textContent = count > 0 ? `${base} (${count})` : base;
	};

	setLabel(
		"fandoms-dropdown-toggle",
		"Choose Fandoms",
		(filterState.fandoms || []).length,
	);
	setLabel(
		"relationships-dropdown-toggle",
		"Choose Relationships",
		(filterState.relationships || []).length,
	);
	setLabel(
		"characters-dropdown-toggle",
		"Choose Characters",
		(filterState.characters || []).length,
	);
	const tagsCount = (filterState.tags || []).length;
	const baseTagsLabel =
		filterState.tagsMode === "all" ? "Tags (AND)" : "Choose Tags";
	setLabel("tags-dropdown-toggle", baseTagsLabel, tagsCount);
}

function clearFilter(key, value) {
	switch (key) {
		case "search":
			filterState.search = "";
			break;
		case "rating":
			filterState.rating = "all";
			break;
		case "readingStatus":
			filterState.readingStatus = "all";
			break;
		case "workStatus":
			filterState.workStatus = "all";
			break;
		case "category":
			filterState.category = "all";
			break;
		case "language":
			filterState.language = "all";
			break;
		case "fandoms":
			filterState.fandoms = filterState.fandoms.filter(
				(f) => f !== value,
			);
			break;
		case "relationships":
			filterState.relationships = filterState.relationships.filter(
				(r) => r !== value,
			);
			break;
		case "characters":
			filterState.characters = filterState.characters.filter(
				(c) => c !== value,
			);
			break;
		case "wordCountMin":
			filterState.wordCountMin = "";
			break;
		case "wordCountMax":
			filterState.wordCountMax = "";
			break;
		case "tags":
			filterState.tags = filterState.tags.filter((t) => t !== value);
			break;
		case "tagsMode":
			filterState.tagsMode = "any";
			break;
		default:
			break;
	}

	applyFilterStateToUI();
	persistFilters();
	applyFiltersAndSort();
}

function syncMultiSelectUI(containerId, selectedValues, options = {}) {
	const container = document.getElementById(containerId);
	if (!container) return;
	const { maxSelection } = options;
	container.querySelectorAll("input[type='checkbox']").forEach((input) => {
		const isChecked = selectedValues.includes(input.value);
		input.checked = isChecked;
		const pill = input.closest(".filter-pill");
		pill?.classList.toggle("active", isChecked);
	});

	if (maxSelection) {
		const selectedCount = selectedValues.length;
		container
			.querySelectorAll("input[type='checkbox']")
			.forEach((input) => {
				const pill = input.closest(".filter-pill");
				const shouldDisable =
					!input.checked && selectedCount >= maxSelection;
				input.disabled = shouldDisable;
				pill?.classList.toggle("disabled", shouldDisable);
			});
	}
}

function renderPillList(
	containerId,
	items,
	selectedValues,
	stateKey,
	options = {},
) {
	const container = document.getElementById(containerId);
	if (!container) return;

	if (!items || items.length === 0) {
		container.innerHTML = '<span class="filter-chip">No options</span>';
		return;
	}

	container.innerHTML = items
		.map((item) => {
			const safe = escapeHtml(item);
			const isActive = selectedValues.includes(item);
			return `
				<label class="filter-pill ${isActive ? "active" : ""}">
					<input type="checkbox" value="${safe}" ${isActive ? "checked" : ""} />
					<span>${safe}</span>
				</label>
			`;
		})
		.join("");

	const { maxSelection } = options;
	const enforceLimit = () => {
		if (!maxSelection) return;
		const selected = filterState[stateKey] || [];
		const selectedCount = selected.length;
		container
			.querySelectorAll("input[type='checkbox']")
			.forEach((input) => {
				const pill = input.closest(".filter-pill");
				const shouldDisable =
					!input.checked && selectedCount >= maxSelection;
				input.disabled = shouldDisable;
				pill?.classList.toggle("disabled", shouldDisable);
			});
	};

	container.querySelectorAll("input[type='checkbox']").forEach((input) => {
		input.addEventListener("change", (e) => {
			const value = e.target.value;
			const current = new Set(filterState[stateKey] || []);
			if (e.target.checked) {
				if (maxSelection && current.size >= maxSelection) {
					e.target.checked = false;
					return;
				}
				current.add(value);
			} else {
				current.delete(value);
			}
			filterState[stateKey] = [...current];
			persistFilters();
			renderActiveFilters();
			applyFiltersAndSort();
			enforceLimit();
		});
	});

	enforceLimit();
}

function buildFilterOptionsFromNovels(novels) {
	const languages = new Set();
	const fandoms = new Set();
	const relationships = new Set();
	const characters = new Set();
	const tags = new Set();

	novels.forEach((novel) => {
		const metadata = novel.metadata || {};
		if (metadata.language) languages.add(metadata.language);

		(metadata.fandoms || []).forEach((fandom) =>
			fandoms.add(canonicalizeLabel(fandom, "fandoms")),
		);
		(metadata.relationships || []).forEach((rel) =>
			relationships.add(canonicalizeLabel(rel, "relationships")),
		);
		(metadata.characters || []).forEach((char) =>
			characters.add(canonicalizeLabel(char, "characters")),
		);
		(metadata.additionalTags || []).forEach((tag) =>
			tags.add(canonicalizeLabel(tag, "additionalTags")),
		);
	});

	return {
		languages: sortAlpha(languages),
		fandoms: sortAlpha(fandoms),
		relationships: sortAlpha(relationships),
		characters: sortAlpha(characters),
		tags: sortAlpha(tags),
	};
}

function populateDynamicFilters() {
	const { languages, fandoms, relationships, characters, tags } =
		buildFilterOptionsFromNovels(allNovels);

	const languageSelect = document.getElementById("language-filter");
	if (languageSelect) {
		languageSelect.innerHTML =
			'<option value="all">All Languages</option>' +
			(languages.length
				? languages
						.map(
							(lang) =>
								`<option value="${escapeHtml(
									lang,
								)}">${escapeHtml(lang)}</option>`,
						)
						.join("")
				: '<option value="all" disabled>No languages found</option>');
		languageSelect.value =
			filterState.language === "all" ? "all" : filterState.language;
	}

	renderPillList("fandoms-filter", fandoms, filterState.fandoms, "fandoms");
	renderPillList(
		"relationships-filter",
		relationships,
		filterState.relationships,
		"relationships",
	);
	renderPillList(
		"characters-filter",
		characters,
		filterState.characters,
		"characters",
	);
	renderPillList("tags-filter", tags, filterState.tags, "tags");
	applyFilterStateToUI();
}

function renderNovels(novels = filteredNovels) {
	const grid = document.getElementById("novel-grid");
	const emptyState = document.getElementById("empty-state");
	const loadingState = document.getElementById("loading-state");
	const novelCount = document.getElementById("novel-count");

	if (!grid) return;

	if (!novels || novels.length === 0) {
		grid.style.display = "none";
		if (emptyState) emptyState.style.display = "block";
		if (novelCount) novelCount.textContent = "(0 works)";
		return;
	}

	if (loadingState) loadingState.style.display = "none";
	if (emptyState) emptyState.style.display = "none";
	grid.style.display = "grid";

	grid.innerHTML = "";
	novels.forEach((novel) => {
		try {
			let cardElement = null;
			if (
				AO3CardRenderer &&
				typeof AO3CardRenderer.renderCard === "function"
			) {
				cardElement = AO3CardRenderer.renderCard(novel);
			} else {
				cardElement = NovelCardRenderer.renderCard(novel);
			}
			grid.appendChild(cardElement);
		} catch (error) {
			console.error("Error rendering novel card:", error);
			try {
				const fallbackRenderer = NovelCardRenderer;
				const fallbackCard = fallbackRenderer.renderCard(novel);
				grid.appendChild(fallbackCard);
			} catch (fallbackError) {
				console.error("Fallback card render failed:", fallbackError);
				const minimalCard = document.createElement("div");
				minimalCard.className = "novel-card";
				minimalCard.dataset.novelId = novel.id;
				minimalCard.innerHTML = `
					<div class="novel-card-info">
						<h3 class="novel-title">${novel.title}</h3>
						<p class="novel-author">${novel.author || "Unknown"}</p>
					</div>
				`;
				grid.appendChild(minimalCard);
			}
		}
	});

	if (novelCount)
		novelCount.textContent = `(${novels.length} ${
			novels.length === 1 ? "work" : "works"
		})`;

	grid.querySelectorAll(".novel-card").forEach((card) => {
		card.addEventListener("click", (e) => {
			if (!e.target.closest("button, a")) {
				const novelId = card.dataset.novelId;
				const novel = novels.find((n) => n.id === novelId);
				if (novel) {
					showNovelModal(novel);
				}
			}
		});
	});
}

function showNovelModal(novel) {
	const modal = document.getElementById("novel-modal");
	if (!modal) return;

	const metadata = novel.metadata || {};
	const rating = metadata.rating || novel.rating || "";

	const titleEl = document.getElementById("modal-title");
	if (titleEl) titleEl.textContent = novel.title || "";

	const authorEl = document.getElementById("modal-author");
	if (authorEl) {
		authorEl.textContent = `${novel.author || "Anonymous"}`;
	}

	const descriptionEl = document.getElementById("modal-description");
	if (descriptionEl) descriptionEl.textContent = novel.description || "";

	// Handle cover only when available
	const coverContainer = document.getElementById("modal-cover-container");
	const coverImg = document.getElementById("modal-cover");
	const coverUrl =
		novel.coverUrl || metadata.coverUrl || metadata.cover || "";
	const safeCoverUrl = coverUrl ? escapeHtml(coverUrl) : "";

	if (coverContainer) {
		if (coverUrl) {
			coverContainer.style.display = "";
			coverContainer.innerHTML = `
				<img
					class="modal-cover-img"
					src="${safeCoverUrl}"
					alt="${novel.title ? `${novel.title} cover` : "Novel cover"}"
					loading="lazy"
				/>
			`;
			const injectedImg =
				coverContainer.querySelector(".modal-cover-img");
			if (injectedImg) {
				loadImageWithCache(injectedImg, coverUrl).catch(() => {});
				injectedImg.addEventListener("error", () => {
					coverContainer.remove();
				});
			}
		} else {
			coverContainer.innerHTML = "";
			coverContainer.style.display = "none";
		}
	} else if (coverImg) {
		if (coverUrl) {
			loadImageWithCache(coverImg, coverUrl).catch(() => {});
			coverImg.style.display = "block";
			coverImg.addEventListener("error", () => {
				coverImg.style.display = "none";
			});
		} else {
			coverImg.style.display = "none";
		}
	}

	if (AO3CardRenderer && AO3CardRenderer.renderModalMetadata) {
		AO3CardRenderer.renderModalMetadata(novel);
	} else {
		// Fallback: Render basic metadata
		renderBasicModalMetadata(novel);
	}

	// Set up action buttons
	const continueBtn = document.getElementById("modal-continue-btn");
	if (continueBtn) {
		// Use last read chapter URL or source URL
		const continueUrl = novel.lastChapterUrl || novel.sourceUrl;
		if (continueUrl) {
			continueBtn.href = continueUrl;
			continueBtn.style.display = "inline-flex";
		} else {
			continueBtn.style.display = "none";
		}
	}

	const readBtn = document.getElementById("modal-read-btn");
	if (readBtn && novel.sourceUrl) {
		readBtn.href = novel.sourceUrl;
	}

	const refreshBtn = document.getElementById("modal-refresh-btn");
	if (refreshBtn) {
		refreshBtn.onclick = () => {
			refreshNovelMetadata(novel.id);
			closeModal();
		};
	}

	const editBtn = document.getElementById("modal-edit-btn");
	if (editBtn) {
		editBtn.onclick = () => {
			openEditModal(novel);
			closeModal();
		};
	}

	const removeBtn = document.getElementById("modal-remove-btn");
	if (removeBtn) {
		removeBtn.onclick = async () => {
			if (
				confirm(
					`Remove "${novel.title}" from your library? This cannot be undone.`,
				)
			) {
				await removeNovelFromLibrary(novel.id);
				closeModal();
			}
		};
	}

	// Setup reading status buttons
	const statusButtons = document.querySelectorAll(".status-btn");
	const currentStatus = normalizeModalStatus(novel.readingStatus);

	statusButtons.forEach((btn) => {
		const status = normalizeModalStatus(btn.getAttribute("data-status"));

		// Set active state
		if (status === currentStatus) {
			btn.classList.add("active");
		} else {
			btn.classList.remove("active");
		}

		// Add click handler
		btn.onclick = async () => {
			const updatedNovel = { ...novel, readingStatus: status };
			await updateNovelInLibrary(updatedNovel);
			const idx = allNovels.findIndex((n) => n.id === novel.id);
			if (idx >= 0) allNovels[idx] = updatedNovel;
			const filteredIdx = filteredNovels.findIndex(
				(n) => n.id === novel.id,
			);
			if (filteredIdx >= 0) filteredNovels[filteredIdx] = updatedNovel;

			applyFiltersAndSort();

			// Update button states
			statusButtons.forEach((b) => {
				if (
					normalizeModalStatus(b.getAttribute("data-status")) ===
					status
				) {
					b.classList.add("active");
				} else {
					b.classList.remove("active");
				}
			});
		};
	});

	modal.style.display = "flex";

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

function renderBasicModalMetadata(novel) {
	const container = document.getElementById("modal-metadata-container");
	if (!container) return;

	const metadata = novel.metadata || {};
	let html = "";

	// Rating & Warnings
	if (metadata.rating) {
		html += `<div class="modal-metadata-section">
			<h4>Rating & Warnings</h4>
			<div class="modal-metadata-content">
				<span class="rating-badge ${getRatingClass(metadata.rating)}">${escapeHtml(
					metadata.rating,
				)}</span>
			</div>`;
		if (metadata.warnings && metadata.warnings.length > 0) {
			html += `<div class="modal-metadata-content">
				${metadata.warnings
					.map(
						(w) =>
							`<span class="tag-item warning-tag">${escapeHtml(
								w,
							)}</span>`,
					)
					.join("")}
			</div>`;
		}
		html += "</div>";
	}

	// Categories
	if (metadata.categories && metadata.categories.length > 0) {
		html += `<div class="modal-metadata-section">
			<h4>Categories</h4>
			<div class="modal-metadata-content">
				${metadata.categories
					.map(
						(c) =>
							`<span class="tag-item category-tag">${escapeHtml(
								c,
							)}</span>`,
					)
					.join("")}
			</div>
		</div>`;
	}

	// Fandoms
	if (metadata.fandoms && metadata.fandoms.length > 0) {
		html += `<div class="modal-metadata-section">
			<h4>Fandoms</h4>
			<div class="modal-metadata-content">
				${metadata.fandoms
					.map(
						(f) =>
							`<span class="tag-item fandom-tag">${escapeHtml(
								f,
							)}</span>`,
					)
					.join("")}
			</div>
		</div>`;
	}

	// Relationships
	if (metadata.relationships && metadata.relationships.length > 0) {
		html += `<div class="modal-metadata-section">
			<h4>Relationships</h4>
			<div class="modal-metadata-content">
				${metadata.relationships
					.map(
						(r) =>
							`<span class="tag-item relationship-tag">${escapeHtml(
								r,
							)}</span>`,
					)
					.join("")}
			</div>
		</div>`;
	}

	// Characters
	if (metadata.characters && metadata.characters.length > 0) {
		html += `<div class="modal-metadata-section">
			<h4>Characters</h4>
			<div class="modal-metadata-content">
				${metadata.characters
					.map(
						(c) =>
							`<span class="tag-item character-tag">${escapeHtml(
								c,
							)}</span>`,
					)
					.join("")}
			</div>
		</div>`;
	}

	// Additional Tags
	if (metadata.additionalTags && metadata.additionalTags.length > 0) {
		html += `<div class="modal-metadata-section">
			<h4>Additional Tags</h4>
			<div class="modal-metadata-content">
				${metadata.additionalTags
					.map(
						(t) =>
							`<span class="tag-item additional-tag">${escapeHtml(
								t,
							)}</span>`,
					)
					.join("")}
			</div>
		</div>`;
	}

	// Work Stats
	const stats = metadata.stats || metadata;
	const hasStats =
		stats.words ||
		stats.kudos ||
		stats.hits ||
		stats.bookmarks ||
		stats.comments;
	if (hasStats) {
		html += `<div class="modal-metadata-section modal-work-stats">
			<h4>Work Stats</h4>
			<div class="modal-stats-grid">`;
		if (stats.words)
			html += `<div class="stat-badge"><span class="stat-label">Words</span><span class="stat-value">${formatNumber(
				stats.words,
			)}</span></div>`;
		if (stats.kudos)
			html += `<div class="stat-badge"><span class="stat-label">Kudos</span><span class="stat-value">${formatNumber(
				stats.kudos,
			)}</span></div>`;
		if (stats.hits)
			html += `<div class="stat-badge"><span class="stat-label">Hits</span><span class="stat-value">${formatNumber(
				stats.hits,
			)}</span></div>`;
		if (stats.bookmarks)
			html += `<div class="stat-badge"><span class="stat-label">Bookmarks</span><span class="stat-value">${formatNumber(
				stats.bookmarks,
			)}</span></div>`;
		if (stats.comments)
			html += `<div class="stat-badge"><span class="stat-label">Comments</span><span class="stat-value">${formatNumber(
				stats.comments,
			)}</span></div>`;
		html += "</div></div>";
	}

	container.innerHTML = html;
}

function getRatingClass(rating) {
	const ratingLower = (rating || "").toLowerCase();
	if (ratingLower.includes("general")) return "rating-general";
	if (ratingLower.includes("teen")) return "rating-teen";
	if (ratingLower.includes("mature")) return "rating-mature";
	if (ratingLower.includes("explicit")) return "rating-explicit";
	return "rating-not-rated";
}

function ratingFilter(novels, selectedRating = filterState.rating) {
	if (!selectedRating || selectedRating === "all") return novels;
	return novels.filter((novel) => {
		const rawRating = novel.metadata?.rating ?? "";
		return rawRating === selectedRating;
	});
}

function categoryFilter(novels, selectedCategory = filterState.category) {
	if (!selectedCategory || selectedCategory === "all") return novels;
	return novels.filter((novel) => {
		const categories = novel.metadata?.categories || [];
		return categories.includes(selectedCategory);
	});
}

function applyFiltersAndSort() {
	filteredNovels = [...allNovels];

	const {
		search,
		rating,
		readingStatus,
		workStatus,
		category,
		language,
		fandoms,
		relationships,
		characters,
		tags,
		tagsMode,
		wordCountMin,
		wordCountMax,
		sort,
	} = filterState;

	if (search) {
		const query = search.toLowerCase();
		filteredNovels = filteredNovels.filter((n) => {
			const titleMatch = n.title?.toLowerCase().includes(query);
			const authorMatch = n.author?.toLowerCase().includes(query);
			const fandomMatch = (n.metadata?.fandoms || [])
				.join(" ")
				.toLowerCase()
				.includes(query);
			return titleMatch || authorMatch || fandomMatch;
		});
	}

	filteredNovels = ratingFilter(filteredNovels, rating);
	filteredNovels = categoryFilter(filteredNovels, category);

	if (readingStatus && readingStatus !== "all") {
		filteredNovels = filteredNovels.filter((n) => {
			const normalized = normalizeReadingStatus(n.readingStatus);
			return normalized === readingStatus;
		});
	}

	if (workStatus && workStatus !== "all") {
		filteredNovels = filteredNovels.filter((n) => n.status === workStatus);
	}

	if (language && language !== "all") {
		const targetLang = language.toLowerCase();
		filteredNovels = filteredNovels.filter(
			(n) => (n.metadata?.language || "").toLowerCase() === targetLang,
		);
	}

	if (Array.isArray(fandoms) && fandoms.length > 0) {
		const fandomsMode = filterState.fandomsMode || "any";
		const normalizedSelected = fandoms.map((f) =>
			canonicalizeLabel(f, "fandoms"),
		);
		filteredNovels = filteredNovels.filter((n) => {
			const storyFandoms = (n.metadata?.fandoms || []).map((f) =>
				canonicalizeLabel(f, "fandoms"),
			);
			if (fandomsMode === "all") {
				// ALL mode: story must include all selected fandoms
				return normalizedSelected.every((f) =>
					storyFandoms.includes(f),
				);
			} else {
				// ANY mode: story must include at least one selected fandom
				return storyFandoms.some((f) => normalizedSelected.includes(f));
			}
		});
	}

	if (Array.isArray(relationships) && relationships.length > 0) {
		filteredNovels = filteredNovels.filter((n) => {
			const storyRelationships = n.metadata?.relationships || [];
			return relationships.every((rel) =>
				storyRelationships.includes(rel),
			);
		});
	}

	if (Array.isArray(characters) && characters.length > 0) {
		filteredNovels = filteredNovels.filter((n) => {
			const storyCharacters = n.metadata?.characters || [];
			return characters.every((char) => storyCharacters.includes(char));
		});
	}

	if (Array.isArray(tags) && tags.length > 0) {
		filteredNovels = filteredNovels.filter((n) => {
			const storyTags = n.metadata?.additionalTags || [];
			if (tagsMode === "all") {
				return tags.every((tag) => storyTags.includes(tag));
			}
			return storyTags.some((tag) => tags.includes(tag));
		});
	}

	const minWords = parseInt(wordCountMin, 10);
	const maxWords = parseInt(wordCountMax, 10);
	filteredNovels = filteredNovels.filter((n) => {
		const words = n.metadata?.words || n.metadata?.stats?.words || 0;
		if (!Number.isNaN(minWords) && minWords > 0 && words < minWords)
			return false;
		if (!Number.isNaN(maxWords) && maxWords > 0 && words > maxWords)
			return false;
		return true;
	});

	if (sort) {
		filteredNovels.sort((a, b) => {
			const getStat = (n, key) =>
				n.metadata?.stats?.[key] || n.metadata?.[key] || 0;

			switch (sort) {
				case "recent":
					return (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0);
				case "added":
					return (b.addedAt || 0) - (a.addedAt || 0);
				case "title":
					return a.title.localeCompare(b.title);
				case "chapters":
					return (
						(b.enhancedChaptersCount || 0) -
						(a.enhancedChaptersCount || 0)
					);
				case "words":
					return getStat(b, "words") - getStat(a, "words");
				case "kudos":
					return getStat(b, "kudos") - getStat(a, "kudos");
				case "hits":
					return getStat(b, "hits") - getStat(a, "hits");
				case "comments":
					return getStat(b, "comments") - getStat(a, "comments");
				case "bookmarks":
					return getStat(b, "bookmarks") - getStat(a, "bookmarks");
				case "published":
					return (
						getStat(b, "publishedDate") -
						getStat(a, "publishedDate")
					);
				case "updated":
					return (
						getStat(b, "completedDate") -
						getStat(a, "completedDate")
					);
				case "status":
					return (
						getWorkStatusOrder(a.status) -
						getWorkStatusOrder(b.status)
					);
				default:
					return 0;
			}
		});
	}

	renderActiveFilters();
	renderNovels();
	updateAnalytics(filteredNovels);
	setupFandomNav(allNovels);
	persistFilters();
}

function getWorkStatusOrder(status) {
	const order = { completed: 0, ongoing: 1 };
	return order[status] ?? 99;
}

function normalizeReadingStatus(status) {
	if (!status) return "";
	const normalized = status.toLowerCase().replace(/_/g, "-");
	switch (normalized) {
		case "currently-reading":
		case "in-progress":
			return READING_STATUS.READING;
		case "rereading":
			return READING_STATUS.RE_READING;
		default:
			return normalized;
	}
}

function normalizeModalStatus(status) {
	if (!status) return READING_STATUS.PLAN_TO_READ;
	return normalizeReadingStatus(status) || READING_STATUS.PLAN_TO_READ;
}

function setupFandomNav(novels) {
	const filterContainer = document.getElementById("fandom-filter-section");
	const categoryGrid = document.getElementById("category-grid");
	const renderTarget = filterContainer || categoryGrid;
	if (!renderTarget) return;

	if (filterContainer) {
		const categorySection = document.getElementById("category-section");
		if (categorySection) categorySection.style.display = "none";
	}

	const baseNovels =
		(filterState.fandomsMode || "any") === "all" ? filteredNovels : novels;
	const fandomCounts = new Map();

	baseNovels.forEach((novel) => {
		const fandoms = novel.metadata?.fandoms || [];
		fandoms.forEach((fandom) => {
			fandomCounts.set(fandom, (fandomCounts.get(fandom) || 0) + 1);
		});
	});

	if (fandomCounts.size === 0) {
		const categorySection = document.getElementById("category-section");
		if (categorySection) categorySection.style.display = "none";
		return;
	}

	const categorySection = document.getElementById("category-section");
	if (categorySection) categorySection.style.display = "block";

	const viewMode = filterState.fandomsView || "dropdown";

	let html = `
		<div class="fandom-grid-header">
			<div class="fandom-grid-controls">
				<select id="fandom-match-mode" class="fandom-match-select" title="Filter mode">
					<option value="any">Match ANY</option>
					<option value="all">Match ALL</option>
				</select>
				<div class="fandom-view-toggle" role="group" aria-label="Fandom view">
					<button type="button" class="view-toggle-btn ${
						viewMode === "dropdown" ? "active" : ""
					}" data-view="dropdown" aria-label="Dropdown view" title="Dropdown view">☰</button>
					<button type="button" class="view-toggle-btn ${
						viewMode === "grid" ? "active" : ""
					}" data-view="grid" aria-label="Grid view" title="Grid view">▦</button>
				</div>
				<button id="clear-fandoms" class="clear-fandoms-btn" style="display: none;">Clear Selection</button>
			</div>
			<div class="fandom-grid-actions">
				<div class="multi-dropdown">
					<button type="button" class="multi-dropdown-toggle" id="fandoms-nav-toggle">Choose Fandoms</button>
					<div class="multi-dropdown-panel" id="fandoms-nav-panel">
						<div class="filter-pill-list fandom-dropdown-list" id="fandoms-nav-list"></div>
					</div>
				</div>
			</div>
		</div>
		<div class="fandom-grid-container" data-view="${viewMode}">
			<div class="fandom-grid">`;

	// Sort by count, then alphabetically
	const sortedFandoms = [...fandomCounts.entries()].sort((a, b) => {
		if (b[1] !== a[1]) return b[1] - a[1];
		return a[0].localeCompare(b[0]);
	});

	sortedFandoms.slice(0, 60).forEach(([fandom, count]) => {
		if (!count) return;
		const isSelected = (filterState.fandoms || []).includes(fandom);
		const safeName = escapeHtml(fandom);
		html += `
			<button class="fandom-card ${
				isSelected ? "selected" : ""
			}" data-fandom="${encodeURIComponent(
				fandom,
			)}" aria-pressed="${isSelected}">
				<span class="fandom-name">${safeName}</span>
				<span class="fandom-count">${count} ${count === 1 ? "work" : "works"}</span>
			</button>
		`;
	});
	html += "</div></div>";

	renderTarget.innerHTML = html;

	const dropdownList = renderTarget.querySelector("#fandoms-nav-list");
	if (dropdownList) {
		dropdownList.innerHTML = sortedFandoms
			.filter(([, count]) => count > 0)
			.map(([fandom, count]) => {
				const safeName = escapeHtml(fandom);
				const isSelected = (filterState.fandoms || []).includes(fandom);
				return `
					<label class="filter-pill ${isSelected ? "active" : ""}">
						<input type="checkbox" value="${safeName}" ${isSelected ? "checked" : ""} />
						<span class="pill-label">${safeName}</span>
						<span class="pill-count">${count}</span>
					</label>
				`;
			})
			.join("");
	}

	// Set up match mode selector
	const matchModeSelect = renderTarget.querySelector("#fandom-match-mode");
	if (matchModeSelect) {
		matchModeSelect.value = filterState.fandomsMode || "any";
		matchModeSelect.addEventListener("change", () => {
			filterState.fandomsMode = matchModeSelect.value;
			persistFilters();
			if ((filterState.fandoms || []).length > 0) {
				applyFiltersAndSort();
			}
			setupFandomNav(allNovels);
		});
	}

	const viewToggleButtons = renderTarget.querySelectorAll(".view-toggle-btn");
	viewToggleButtons.forEach((btn) => {
		btn.addEventListener("click", () => {
			const view = btn.dataset.view;
			filterState.fandomsView = view;
			persistFilters();
			setupFandomNav(allNovels);
		});
	});

	// Set up clear button
	const clearBtn = renderTarget.querySelector("#clear-fandoms");
	if (clearBtn) {
		if ((filterState.fandoms || []).length > 0) {
			clearBtn.style.display = "inline-block";
		}
		clearBtn.addEventListener("click", () => {
			filterState.fandoms = [];
			applyFilterStateToUI();
			persistFilters();
			applyFiltersAndSort();
			setupFandomNav(allNovels);
		});
	}

	const updateSelection = (fandom, isSelected) => {
		const currentFandoms = filterState.fandoms || [];
		if (isSelected) {
			if (currentFandoms.length >= 2) {
				return;
			}
			if (!currentFandoms.includes(fandom)) {
				filterState.fandoms = [...currentFandoms, fandom];
			}
		} else {
			filterState.fandoms = currentFandoms.filter((f) => f !== fandom);
		}

		if (clearBtn) {
			clearBtn.style.display =
				filterState.fandoms.length > 0 ? "inline-block" : "none";
		}

		applyFilterStateToUI();
		persistFilters();
		applyFiltersAndSort();
		document
			.getElementById("novel-grid")
			?.scrollIntoView({ behavior: "smooth" });
	};

	renderTarget.querySelectorAll(".fandom-card").forEach((card) => {
		card.addEventListener("click", () => {
			const fandom = decodeURIComponent(card.dataset.fandom);
			const isSelected = !(filterState.fandoms || []).includes(fandom);
			updateSelection(fandom, isSelected);
		});
	});

	const dropdownToggle = renderTarget.querySelector("#fandoms-nav-toggle");
	const dropdownPanel = renderTarget.querySelector("#fandoms-nav-panel");
	if (dropdownToggle && dropdownPanel) {
		dropdownToggle.addEventListener("click", () => {
			dropdownPanel.classList.toggle("open");
		});
	}

	if (dropdownList) {
		dropdownList
			.querySelectorAll("input[type='checkbox']")
			.forEach((input) => {
				input.addEventListener("change", () => {
					const fandom = input.value;
					const isSelected = input.checked;
					if (isSelected && (filterState.fandoms || []).length >= 2) {
						input.checked = false;
						return;
					}
					updateSelection(fandom, isSelected);
				});
			});
	}
}

function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

function setInsightTarget(valueId, novel, text) {
	const valueEl = document.getElementById(valueId);
	if (!valueEl) return;
	valueEl.textContent = text || "-";
	const item = valueEl.closest(".analytics-item");
	if (!item) return;
	if (novel && novel.id) {
		item.dataset.novelId = novel.id;
		item.classList.add("analytics-clickable");
		item.setAttribute("role", "button");
		item.tabIndex = 0;
	} else {
		item.removeAttribute("data-novel-id");
		item.classList.remove("analytics-clickable");
		item.removeAttribute("role");
		item.removeAttribute("tabindex");
	}
}

function setupInsightClicks() {
	const container = document.querySelector(".analytics-items");
	if (!container || container.dataset.bound === "true") return;
	container.dataset.bound = "true";

	const openFromItem = (item) => {
		if (!item?.dataset?.novelId) return;
		const novel = allNovels.find((n) => n.id === item.dataset.novelId);
		if (novel) showNovelModal(novel);
	};

	container.addEventListener("click", (event) => {
		const item = event.target.closest(".analytics-item");
		openFromItem(item);
	});

	container.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		const item = event.target.closest(".analytics-item");
		if (!item?.dataset?.novelId) return;
		event.preventDefault();
		openFromItem(item);
	});
}

function updateAnalytics(novels) {
	const setStatText = (id, value) => {
		const el = document.getElementById(id);
		if (el) el.textContent = value;
	};

	if (!novels || novels.length === 0) {
		setStatText("stats-novels", "0");
		setStatText("stats-enhanced", "0");
		setStatText("stats-words", "0");
		setStatText("stats-completed", "0");
		setStatText("stats-kudos", "0");
		setStatText("stats-hits", "0");
		setStatText("stats-avgrating", "-");
		setStatText("stats-reading", "0%");
		setStatText("stats-avg-words", "-");
		setInsightTarget("most-kudos", null, "-");
		setInsightTarget("most-hits", null, "-");
		setInsightTarget("most-comments", null, "-");
		setInsightTarget("longest-work", null, "-");
		setInsightTarget("newest-addition", null, "-");
		setInsightTarget("most-chapters", null, "-");

		renderReadingStatusChart({});
		return;
	}

	const totalNovels = novels.length;
	const totalEnhanced = novels.reduce(
		(sum, n) => sum + (n.enhancedChaptersCount || 0),
		0,
	);
	const totalWords = novels.reduce(
		(sum, n) => sum + (n.metadata?.words || n.metadata?.stats?.words || 0),
		0,
	);
	const totalKudos = novels.reduce(
		(sum, n) => sum + (n.metadata?.kudos || n.metadata?.stats?.kudos || 0),
		0,
	);
	const totalHits = novels.reduce(
		(sum, n) => sum + (n.metadata?.hits || n.metadata?.stats?.hits || 0),
		0,
	);
	const completedWorks = novels.filter(
		(n) =>
			(n.metadata?.status || n.status || "").toLowerCase() ===
			"completed",
	).length;

	const readingBuckets = novels.reduce((acc, novel) => {
		const key =
			normalizeReadingStatus(novel.readingStatus) ||
			READING_STATUS.PLAN_TO_READ;
		acc[key] = (acc[key] || 0) + 1;
		return acc;
	}, {});
	const readingCount =
		readingBuckets[READING_STATUS.READING] ||
		readingBuckets["reading"] ||
		0;
	const readingPercent = Math.round((readingCount / totalNovels) * 100);

	// Calculate average rating
	const ratingMap = {
		"General Audiences": 1,
		"Teen And Up Audiences": 2,
		Mature: 3,
		Explicit: 4,
	};
	let totalRating = 0;
	let ratedCount = 0;
	novels.forEach((n) => {
		if (n.metadata?.rating && ratingMap[n.metadata.rating]) {
			totalRating += ratingMap[n.metadata.rating];
			ratedCount++;
		}
	});
	const avgRating =
		ratedCount > 0 ? (totalRating / ratedCount).toFixed(1) : "-";
	const avgWords = totalNovels > 0 ? Math.round(totalWords / totalNovels) : 0;

	setStatText("stats-novels", totalNovels.toLocaleString());
	setStatText("stats-enhanced", totalEnhanced.toLocaleString());
	setStatText("stats-words", formatNumber(totalWords));
	setStatText("stats-completed", completedWorks.toLocaleString());
	setStatText("stats-kudos", formatNumber(totalKudos));
	setStatText("stats-hits", formatNumber(totalHits));
	setStatText("stats-avgrating", avgRating);
	setStatText("stats-reading", `${readingPercent}%`);
	setStatText("stats-avg-words", formatNumber(avgWords));

	// Library insights
	let mostKudos = null;
	let mostHits = null;
	let mostComments = null;
	let longest = null;

	novels.forEach((novel) => {
		const getStatVal = (n, key) =>
			n.metadata?.stats?.[key] || n.metadata?.[key] || 0;

		if (
			!mostKudos ||
			getStatVal(novel, "kudos") > getStatVal(mostKudos, "kudos")
		) {
			mostKudos = novel;
		}
		if (
			!mostHits ||
			getStatVal(novel, "hits") > getStatVal(mostHits, "hits")
		) {
			mostHits = novel;
		}
		if (
			!mostComments ||
			getStatVal(novel, "comments") > getStatVal(mostComments, "comments")
		) {
			mostComments = novel;
		}
		if (
			!longest ||
			getStatVal(novel, "words") > getStatVal(longest, "words")
		) {
			longest = novel;
		}
	});

	const getStatVal = (n, key) =>
		n?.metadata?.stats?.[key] || n?.metadata?.[key] || 0;

	// Calculate newest addition (most recently added to library)
	let newestAddition = null;
	novels.forEach((novel) => {
		const dateAdded = novel.dateAdded || novel.addedAt || 0;
		if (
			!newestAddition ||
			dateAdded >
				(newestAddition.dateAdded || newestAddition.addedAt || 0)
		) {
			newestAddition = novel;
		}
	});

	// Calculate most chapters
	let mostChapters = null;
	novels.forEach((novel) => {
		const chapters = novel.totalChapters || novel.metadata?.chapters || 0;
		if (
			!mostChapters ||
			chapters >
				(mostChapters.totalChapters ||
					mostChapters.metadata?.chapters ||
					0)
		) {
			mostChapters = novel;
		}
	});

	setInsightTarget(
		"most-kudos",
		mostKudos,
		mostKudos
			? `${mostKudos.title} (${formatNumber(
					getStatVal(mostKudos, "kudos"),
				)})`
			: "-",
	);
	setInsightTarget(
		"most-hits",
		mostHits,
		mostHits
			? `${mostHits.title} (${formatNumber(
					getStatVal(mostHits, "hits"),
				)})`
			: "-",
	);
	setInsightTarget(
		"most-comments",
		mostComments,
		mostComments
			? `${mostComments.title} (${formatNumber(
					getStatVal(mostComments, "comments"),
				)})`
			: "-",
	);
	setInsightTarget(
		"longest-work",
		longest,
		longest
			? `${longest.title} (${formatNumber(getStatVal(longest, "words"))})`
			: "-",
	);
	setInsightTarget(
		"newest-addition",
		newestAddition,
		newestAddition ? newestAddition.title : "-",
	);
	setInsightTarget(
		"most-chapters",
		mostChapters,
		mostChapters
			? `${mostChapters.title} (${
					mostChapters.totalChapters ||
					mostChapters.metadata?.chapters ||
					0
				})`
			: "-",
	);

	renderReadingStatusChart(readingBuckets, totalNovels);
}

function renderReadingStatusChart(buckets = {}, total = 0) {
	const chart = document.getElementById("reading-status-chart");
	const legend = document.getElementById("reading-status-legend");
	const summary = document.getElementById("status-chart-summary");
	if (!chart || !legend || !summary) return;

	chart.innerHTML = "";
	legend.innerHTML = "";

	const totalCount =
		total || Object.values(buckets).reduce((sum, val) => sum + val, 0);
	const entries = Object.entries(buckets).filter(([, count]) => count > 0);

	if (!entries.length || !totalCount) {
		summary.textContent = "No works yet";
		return;
	}

	entries.forEach(([key, count]) => {
		const info = READING_STATUS_INFO[key] || {};
		const label = info.label || key.replace(/_/g, " ");
		const segment = document.createElement("div");
		segment.className = "bar-segment";
		segment.style.background = info.color || "var(--primary-color)";
		segment.style.flex = count;
		segment.title = `${label}: ${count}`;
		chart.appendChild(segment);

		const percent = Math.round((count / totalCount) * 100);
		const legendItem = document.createElement("div");
		legendItem.className = "bar-legend-item";
		legendItem.innerHTML = `<span class="legend-swatch" style="background:${
			info.color || "var(--primary-color)"
		}"></span><span>${escapeHtml(label)} (${percent}%)</span>`;
		legend.appendChild(legendItem);
	});

	const completedCount =
		buckets[READING_STATUS.COMPLETED] || buckets.completed || 0;
	const readingCount =
		buckets[READING_STATUS.READING] || buckets.reading || 0;
	const plantoreadCount =
		buckets[READING_STATUS.PLAN_TO_READ] || buckets["plan-to-read"] || 0;

	summary.textContent = `${plantoreadCount} Plan to Read • ${readingCount} Reading • ${completedCount} Completed`;
}

function formatNumber(num) {
	if (!num) return "0";
	if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
	if (num >= 1000) return (num / 1000).toFixed(1) + "K";
	return num.toString();
}

function positionFilterDropdown() {
	const dropdown = document.getElementById("filter-dropdown");
	const button = document.getElementById("filter-toggle-btn");
	if (!dropdown || !button) return;

	// AO3 page uses an inline, wide filter surface
	if (document.body?.classList.contains("ao3-page")) {
		dropdown.style.position = "relative";
		dropdown.style.left = "0";
		dropdown.style.right = "0";
		dropdown.style.top = "0";
		dropdown.style.width = "100%";
		return;
	}
}

function setupFilters() {
	const ratingFilterEl = document.getElementById("rating-filter");
	const sortSelect = document.getElementById("sort-select");
	const statusFilter = document.getElementById("status-filter");
	const workStatusFilter = document.getElementById("work-status-filter");
	const categoryFilterEl = document.getElementById("category-filter");
	const languageFilter = document.getElementById("language-filter");
	const searchInput = document.getElementById("search-input");
	const wordMinInput = document.getElementById("wordcount-min");
	const wordMaxInput = document.getElementById("wordcount-max");
	const backBtn = document.getElementById("back-to-all");
	const filterToggleBtn = document.getElementById("filter-toggle-btn");
	const filterDropdown = document.getElementById("filter-dropdown");
	const clearFiltersBtn = document.getElementById("clear-filters-btn");
	const tagsMatchSelect = document.getElementById("tags-match-mode");
	const multiDropdowns = [
		{
			toggleId: "fandoms-dropdown-toggle",
			panelId: "fandoms-dropdown-panel",
		},
		{
			toggleId: "relationships-dropdown-toggle",
			panelId: "relationships-dropdown-panel",
		},
		{
			toggleId: "characters-dropdown-toggle",
			panelId: "characters-dropdown-panel",
		},
		{ toggleId: "tags-dropdown-toggle", panelId: "tags-dropdown-panel" },
	];

	const closeAllPanels = () => {
		multiDropdowns.forEach(({ panelId }) => {
			const panel = document.getElementById(panelId);
			if (panel) panel.style.display = "none";
		});
	};

	multiDropdowns.forEach(({ toggleId, panelId }) => {
		const toggle = document.getElementById(toggleId);
		const panel = document.getElementById(panelId);
		if (!toggle || !panel) return;
		panel.style.display = "none";
		toggle.addEventListener("click", (e) => {
			e.stopPropagation();
			const isOpen = panel.style.display === "block";
			closeAllPanels();
			panel.style.display = isOpen ? "none" : "block";
		});
	});

	if (filterDropdown && !filterDropdown.style.display) {
		filterDropdown.style.display = "none";
	}

	const bindSelect = (element, key) => {
		if (!element) return;
		element.value = filterState[key];
		element.addEventListener("change", (e) => {
			filterState[key] = e.target.value;
			persistFilters();
			renderActiveFilters();
			applyFiltersAndSort();
		});
	};

	if (filterToggleBtn && filterDropdown) {
		filterToggleBtn.addEventListener("click", () => {
			const isVisible = filterDropdown.style.display !== "none";
			if (isVisible) {
				filterDropdown.style.display = "none";
				filterToggleBtn.classList.remove("active");
				closeAllPanels();
				return;
			}
			filterDropdown.style.display = "block";
			positionFilterDropdown();
			filterToggleBtn.classList.add("active");
		});

		window.addEventListener("resize", () => {
			if (filterDropdown.style.display !== "none") {
				positionFilterDropdown();
			}
		});

		document.addEventListener("click", (e) => {
			const clickedInsideDropdown = filterDropdown.contains(e.target);
			const clickedToggle = filterToggleBtn.contains(e.target);
			const clickedPanel = multiDropdowns.some(
				({ toggleId, panelId }) => {
					const toggle = document.getElementById(toggleId);
					const panel = document.getElementById(panelId);
					return (
						(toggle && toggle.contains(e.target)) ||
						(panel && panel.contains(e.target))
					);
				},
			);

			if (!clickedInsideDropdown && !clickedToggle && !clickedPanel) {
				filterDropdown.style.display = "none";
				filterToggleBtn.classList.remove("active");
				closeAllPanels();
			}
		});
	}

	if (clearFiltersBtn) {
		clearFiltersBtn.addEventListener("click", () => {
			filterState = { ...DEFAULT_FILTERS };
			applyFilterStateToUI();
			renderActiveFilters();
			applyFiltersAndSort();

			if (filterDropdown) filterDropdown.style.display = "none";
			if (filterToggleBtn) filterToggleBtn.classList.remove("active");
		});
	}

	bindSelect(ratingFilterEl, "rating");
	bindSelect(sortSelect, "sort");
	bindSelect(statusFilter, "readingStatus");
	bindSelect(workStatusFilter, "workStatus");
	bindSelect(categoryFilterEl, "category");
	bindSelect(languageFilter, "language");
	bindSelect(tagsMatchSelect, "tagsMode");

	const bindNumberInput = (input, key) => {
		if (!input) return;
		input.value = filterState[key] || "";
		input.addEventListener("input", (e) => {
			filterState[key] = e.target.value.trim();
			persistFilters();
			renderActiveFilters();
			applyFiltersAndSort();
		});
	};

	bindNumberInput(wordMinInput, "wordCountMin");
	bindNumberInput(wordMaxInput, "wordCountMax");

	if (searchInput) {
		searchInput.value = filterState.search;
		let debounce;
		searchInput.addEventListener("input", (e) => {
			clearTimeout(debounce);
			debounce = setTimeout(() => {
				filterState.search = e.target.value.trim();
				persistFilters();
				renderActiveFilters();
				applyFiltersAndSort();
			}, 200);
		});
		ensureRandomSelectButton();
	}

	if (backBtn) {
		backBtn.addEventListener("click", () => {
			location.reload();
		});
	}

	renderActiveFilters();
}

function ensureRandomSelectButton() {
	const searchInput = document.getElementById("search-input");
	if (!searchInput) return;
	if (document.getElementById("random-select-btn")) return;
	const container = searchInput.parentElement;
	if (!container) return;

	const button = document.createElement("button");
	button.type = "button";
	button.id = "random-select-btn";
	button.className = "btn btn-secondary random-select-btn";
	button.textContent = "🎲 Random";
	button.title = "Pick a random novel from current filters";

	button.addEventListener("click", () => {
		const pool = filteredNovels.length ? filteredNovels : allNovels;
		if (!pool.length) {
			showToast("No novels available for random pick", "info");
			return;
		}
		const pick = pool[Math.floor(Math.random() * pool.length)];
		showNovelModal(pick);
	});

	container.insertBefore(button, searchInput);
}

async function initializeAO3Shelf() {
	const loadingState = document.getElementById("loading-state");
	const emptyState = document.getElementById("empty-state");
	const novelGrid = document.getElementById("novel-grid");

	try {
		const storage = await browser.storage.local.get("rg_novel_library");
		const fullLibrary = storage["rg_novel_library"] || {};
		const novelsList = fullLibrary.novels || {};
		const allStoredNovels = Object.values(novelsList);

		allNovels = allStoredNovels.filter((n) => n && n.shelfId === "ao3");
		filteredNovels = [...allNovels];
		buildTaxonomyFromNovels(allNovels);

		if (
			AO3CardRenderer &&
			typeof AO3CardRenderer.primeTaxonomy === "function"
		) {
			AO3CardRenderer.primeTaxonomy(allNovels);
		}
		loadSavedFilters();

		if (allNovels.length === 0) {
			if (loadingState) loadingState.style.display = "none";
			if (emptyState) emptyState.style.display = "block";
			if (novelGrid) novelGrid.style.display = "none";
			return;
		}

		if (loadingState) loadingState.style.display = "none";
		if (emptyState) emptyState.style.display = "none";
		if (novelGrid) novelGrid.style.display = "grid";

		const pageIconImg = document.getElementById("page-icon-img");
		const pageIcon = document.getElementById("page-icon");
		if (pageIconImg) {
			pageIconImg.style.display = "inline-block";
			if (pageIcon) pageIcon.style.display = "none";
			pageIconImg.addEventListener("error", () => {
				pageIconImg.style.display = "none";
				if (pageIcon) pageIcon.style.display = "inline-block";
			});
			pageIconImg.addEventListener("load", () => {
				pageIconImg.style.display = "inline-block";
				if (pageIcon) pageIcon.style.display = "none";
			});
		}

		populateDynamicFilters();
		setupFandomNav(allNovels);
		setupFilters();
		setupInsightClicks();
		applyFiltersAndSort();
		openNovelFromQuery();
	} catch (error) {
		console.error(
			"[AO3 Shelf] CRITICAL ERROR during initialization:",
			error,
		);
		if (loadingState) loadingState.style.display = "none";
		if (emptyState) {
			emptyState.style.display = "block";
			const h2 = emptyState.querySelector("h2");
			if (h2) h2.textContent = `Error: ${error.message}`;
		}
		if (novelGrid) novelGrid.style.display = "none";
	}
}

function openNovelFromQuery() {
	try {
		const params = new URLSearchParams(window.location.search);
		const novelId = params.get("novel");
		if (!novelId) return;
		const novel = allNovels.find((n) => n && n.id === novelId);
		if (novel) {
			showNovelModal(novel);
		} else {
			showToast("Novel not found in this shelf", "info");
		}
	} catch (_err) {
		debugError("Error parsing query parameters:", _err);
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeAO3Shelf);
} else {
	initializeAO3Shelf();
}

// ===== Helper Functions for Modal Actions =====

/**
 * Remove novel from library
 * @param {string} novelId - Novel ID
 */
async function removeNovelFromLibrary(novelId) {
	try {
		const storage = await browser.storage.local.get("rg_novel_library");
		const library = storage["rg_novel_library"] || { novels: {} };

		if (library.novels && library.novels[novelId]) {
			delete library.novels[novelId];
			await browser.storage.local.set({ rg_novel_library: library });

			// Remove from local state and re-render
			allNovels = allNovels.filter((n) => n.id !== novelId);
			filteredNovels = filteredNovels.filter((n) => n.id !== novelId);
			renderNovels();
			updateAnalytics();

			showToast("Novel removed from library", "success");
		}
	} catch (error) {
		console.error("Error removing novel:", error);
		showToast("Failed to remove novel", "error");
	}
}

/**
 * Refresh novel metadata from source
 * @param {string} novelId - Novel ID
 */
async function refreshNovelMetadata(novelId) {
	try {
		showToast("Refreshing metadata...", "info");

		// Dispatch event for main library to handle
		window.dispatchEvent(
			new CustomEvent("refreshNovelMetadata", { detail: { novelId } }),
		);

		// Reload the page after a short delay to get updated data
		setTimeout(() => {
			location.reload();
		}, 1500);
	} catch (error) {
		console.error("Error refreshing metadata:", error);
		showToast("Failed to refresh metadata", "error");
	}
}

function openEditModal(novel) {
	if (!novel?.id) {
		showToast("Missing novel id for edit", "error");
		return;
	}
	openInlineEditModal(novel, AO3Handler, {
		onSaved: (updatedNovel) => {
			const idx = allNovels.findIndex((n) => n?.id === updatedNovel.id);
			if (idx >= 0) allNovels[idx] = updatedNovel;
			const fi = filteredNovels.findIndex(
				(n) => n?.id === updatedNovel.id,
			);
			if (fi >= 0) filteredNovels[fi] = updatedNovel;
		},
		showToast,
	});
}

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - Toast type (success, error, info)
 */
function showToast(message, type = "success") {
	// Remove existing toast
	const existing = document.querySelector(".shelf-toast");
	if (existing) existing.remove();

	const toast = document.createElement("div");
	toast.className = `shelf-toast toast-${type}`;
	toast.textContent = message;
	document.body.appendChild(toast);

	// Trigger animation
	requestAnimationFrame(() => {
		toast.classList.add("show");
	});

	// Auto-dismiss
	setTimeout(() => {
		toast.classList.remove("show");
		setTimeout(() => toast.remove(), 300);
	}, 3000);
}
