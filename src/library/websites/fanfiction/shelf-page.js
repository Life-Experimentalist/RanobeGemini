/**
 * FanFiction.net Shelf Page Script
 * Handles filtering, sorting, rendering, and fandom navigation for the FanFiction library view
 */

import FanFictionNovelCard from "./novel-card.js";
import { FanfictionHandler } from "../../../utils/website-handlers/fanfiction-handler.js";
import { NovelCardRenderer } from "../novel-card-base.js";
import {
	READING_STATUS,
	READING_STATUS_INFO,
	updateNovelInLibrary,
} from "../../../utils/novel-library.js";
import { loadImageWithCache } from "../../../utils/image-cache.js";

const CANONICAL_LABELS = new Map();

const DOMAIN_TYPES = [
	"Anime",
	"Books",
	"Cartoons",
	"Comics",
	"Games",
	"Misc",
	"Plays",
	"Movies",
	"TV",
];

const CATEGORY_LOOKUP = {
	contentTypes: new Set(),
};

// Initialize taxonomy categories from handler definition
const TAXONOMY = FanfictionHandler.SHELF_METADATA?.taxonomy || [
	{ id: "fandoms", label: "Fandoms", type: "array" },
	{ id: "genres", label: "Genres", type: "array" },
	{ id: "characters", label: "Characters", type: "array" },
	{ id: "tags", label: "Tags", type: "array" },
];

TAXONOMY.forEach((tax) => {
	CATEGORY_LOOKUP[tax.id] = new Set();
});

const MAX_FANDOMS = 2;
const MAX_CHARACTERS = 4;

// State for filtering and rendering
let allNovels = [];
let filteredNovels = [];
let currentView = "all";
let selectedFandom = null;

const FILTER_STORAGE_KEY = "rg_ff_filters_fanfiction";
const DEFAULT_FILTERS = {
	search: "",
	rating: "all",
	readingStatus: "all",
	workStatus: "all",
	storyType: "all",
	language: "all",
	fandoms: [],
	genres: [],
	characters: [],
	tags: [],
	tagsMode: "any",
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

function isDomainLabel(label) {
	if (!label) return false;
	return DOMAIN_TYPES.some(
		(domain) =>
			domain.toLowerCase() === label.toString().trim().toLowerCase()
	);
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

		TAXONOMY.forEach((tax) => {
			const key = tax.id;
			// Check both top-level and nested metadata
			const values = novel[key] || metadata[key] || [];
			if (Array.isArray(values)) {
				values.forEach((v) => registerLabel(v, key));
			}
		});

		(metadata.hierarchy || []).forEach((entry) => {
			if (isDomainLabel(entry?.name)) {
				registerLabel(entry.name, "contentTypes");
			}
		});
	});
}

function loadSavedFilters() {
	try {
		const saved = localStorage.getItem(FILTER_STORAGE_KEY);
		if (saved) {
			filterState = { ...DEFAULT_FILTERS, ...JSON.parse(saved) };
		}
	} catch (error) {
		console.warn("[FanFiction Shelf] Failed to load saved filters", error);
		filterState = { ...DEFAULT_FILTERS };
	}
}

function persistFilters() {
	try {
		localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterState));
	} catch (error) {
		console.warn("[FanFiction Shelf] Failed to save filters", error);
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
	bindValue("fandom-filter", filterState.storyType);
	bindValue("language-filter", filterState.language);
	bindValue("sort-select", filterState.sort);
	bindValue("wordcount-min", filterState.wordCountMin || "");
	bindValue("wordcount-max", filterState.wordCountMax || "");

	const tagMatchSelect = document.getElementById("tags-match-mode");
	if (tagMatchSelect) {
		tagMatchSelect.value = filterState.tagsMode || "any";
	}

	TAXONOMY.forEach((tax) => {
		const elementId = `${tax.id}-filter`;
		// Use specific max selection if defined, otherwise defaults
		let maxSelection;
		if (tax.id === "fandoms") maxSelection = MAX_FANDOMS;
		if (tax.id === "characters") maxSelection = MAX_CHARACTERS;

		syncMultiSelectUI(elementId, filterState[tax.id] || [], {
			maxSelection,
		});
	});

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
	if (filterState.storyType && filterState.storyType !== "all")
		addChip("storyType", `Type: ${filterState.storyType}`);
	if (filterState.language && filterState.language !== "all")
		addChip("language", `Language: ${filterState.language}`);

	(filterState.fandoms || []).forEach((fandom) => {
		addChip("fandoms", `Fandom: ${fandom}`, fandom);
	});

	(filterState.genres || []).forEach((genre) => {
		addChip("genres", `Genre: ${genre}`, genre);
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
			chip.label
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
		(filterState.fandoms || []).length
	);
	setLabel(
		"genres-dropdown-toggle",
		"Choose Genres",
		(filterState.genres || []).length
	);
	setLabel(
		"characters-dropdown-toggle",
		"Choose Characters",
		(filterState.characters || []).length
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
		case "storyType":
			filterState.storyType = "all";
			break;
		case "language":
			filterState.language = "all";
			break;
		case "fandoms":
			filterState.fandoms = filterState.fandoms.filter(
				(f) => f !== value
			);
			break;
		case "genres":
			filterState.genres = filterState.genres.filter((g) => g !== value);
			break;
		case "characters":
			filterState.characters = filterState.characters.filter(
				(c) => c !== value
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
	options = {}
) {
	const container = document.getElementById(containerId);
	if (!container) return;

	if (!items || items.length === 0) {
		container.innerHTML = `<span class="filter-chip">No options</span>`;
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
	const genres = new Set();
	const characters = new Set();
	const tags = new Set();
	const contentTypes = new Set();

	novels.forEach((novel) => {
		const metadata = novel.metadata || {};
		if (metadata.language) languages.add(metadata.language);

		const buckets = categorizeNovelAttributes(novel);
		buckets.fandoms.forEach((fandom) => fandoms.add(fandom));
		buckets.genres.forEach((genre) => genres.add(genre));
		buckets.characters.forEach((character) => characters.add(character));
		buckets.contentTypes.forEach((type) => contentTypes.add(type));
		buckets.tags.forEach((tag) => tags.add(tag));
	});

	const miscTags = new Set(
		[...tags].filter(
			(tag) =>
				!fandoms.has(tag) &&
				!genres.has(tag) &&
				!characters.has(tag) &&
				!contentTypes.has(tag)
		)
	);
	contentTypes.forEach((type) => miscTags.add(type));

	return {
		languages: sortAlpha(languages),
		fandoms: sortAlpha(fandoms),
		genres: sortAlpha(genres),
		characters: sortAlpha(characters),
		tags: sortAlpha(miscTags),
	};
}

function populateDynamicFilters() {
	const { languages, fandoms, genres, characters, tags } =
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
									lang
								)}">${escapeHtml(lang)}</option>`
						)
						.join("")
				: '<option value="all" disabled>No languages found</option>');
		languageSelect.value =
			filterState.language === "all" ? "all" : filterState.language;
	}

	renderPillList("fandoms-filter", fandoms, filterState.fandoms, "fandoms", {
		maxSelection: MAX_FANDOMS,
	});
	renderPillList("genres-filter", genres, filterState.genres, "genres");
	renderPillList(
		"characters-filter",
		characters,
		filterState.characters,
		"characters",
		{ maxSelection: MAX_CHARACTERS }
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
		if (novelCount) novelCount.textContent = "(0 novels)";
		return;
	}

	if (loadingState) loadingState.style.display = "none";
	if (emptyState) emptyState.style.display = "none";
	grid.style.display = "grid";

	grid.innerHTML = "";
	novels.forEach((novel) => {
		try {
			const renderer = FanFictionNovelCard || NovelCardRenderer;
			const cardElement = renderer.renderCard(novel);
			grid.appendChild(cardElement);
		} catch (error) {
			console.error("Error rendering novel card:", error);
			const fallbackCard = document.createElement("div");
			fallbackCard.className = "novel-card";
			fallbackCard.dataset.novelId = novel.id;
			fallbackCard.innerHTML = `
				<div class="novel-card-info">
					<h3 class="novel-title">${novel.title}</h3>
					<p class="novel-author">${novel.author || "Unknown"}</p>
				</div>
			`;
			grid.appendChild(fallbackCard);
		}
	});

	if (novelCount)
		novelCount.textContent = `(${novels.length} ${
			novels.length === 1 ? "novel" : "novels"
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

	const titleEl = document.getElementById("modal-title");
	if (titleEl) titleEl.textContent = novel.title || "";

	const authorEl = document.getElementById("modal-author");
	const authorUrl = novel.metadata?.authorUrl;
	if (authorEl) {
		if (authorUrl) {
			authorEl.innerHTML = `<a href="${authorUrl}" target="_blank" rel="noreferrer">${escapeHtml(
				novel.author || "Unknown"
			)}</a>`;
		} else {
			authorEl.textContent = `${novel.author || "Unknown"}`;
		}
	}

	const descriptionEl = document.getElementById("modal-description");
	if (descriptionEl) descriptionEl.textContent = novel.description || "";

	const coverImg = document.getElementById("modal-cover");
	if (coverImg && novel.coverUrl) {
		loadImageWithCache(coverImg, novel.coverUrl).catch(() => {});
		coverImg.style.display = "block";
		coverImg.addEventListener("error", () => {
			coverImg.style.display = "none";
		});
	} else if (coverImg) {
		coverImg.style.display = "none";
	}

	// Set up action buttons
	const continueBtn = document.getElementById("modal-continue-btn");
	if (continueBtn) {
		const lastReadUrl =
			novel.lastReadChapterUrl ||
			novel.currentChapterUrl ||
			novel.sourceUrl;
		if (lastReadUrl) {
			continueBtn.href = lastReadUrl;
			continueBtn.style.display = "inline-flex";
		} else {
			continueBtn.style.display = "none";
		}
	}

	const readBtn = document.getElementById("modal-read-btn");
	if (readBtn && novel.sourceUrl) {
		readBtn.href = novel.sourceUrl;
		readBtn.textContent = "View on Site";
	}

	// Refresh button
	const refreshBtn = document.getElementById("modal-refresh-btn");
	if (refreshBtn) {
		refreshBtn.onclick = () => {
			refreshNovelMetadata(novel);
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

	if (FanFictionNovelCard && FanFictionNovelCard.renderModalMetadata) {
		FanFictionNovelCard.renderModalMetadata(novel);
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

	// CSS is now handled in shelf-page.css

	modal.style.display = "flex";

	const closeBtn = document.getElementById("modal-close-btn");
	const backdrop = document.getElementById("modal-backdrop");

	function closeModal() {
		modal.style.display = "none";
	}

	closeBtn.addEventListener("click", closeModal);
	backdrop.addEventListener("click", closeModal);

	const closeOnEscape = (e) => {
		if (e.key === "Escape") {
			closeModal();
			document.removeEventListener("keydown", closeOnEscape);
		}
	};
	document.addEventListener("keydown", closeOnEscape);
}

function fandomTypeFilter(novels, fandomType = filterState.storyType) {
	if (!fandomType || fandomType === "all") return novels;

	return novels.filter((novel) => {
		const isCrossover =
			novel.sourceUrl?.includes("/crossovers/") ||
			novel.metadata?.isCrossover === true ||
			(novel.metadata?.fandoms && novel.metadata.fandoms.length > 1);
		return fandomType === "crossover" ? isCrossover : !isCrossover;
	});
}

function ratingFilter(novels, selectedRating = filterState.rating) {
	if (!selectedRating || selectedRating === "all") return novels;
	const normalizedSelected = selectedRating.toLowerCase();
	return novels.filter((novel) => {
		const rawRating = novel.metadata?.rating ?? novel.rating ?? "";
		const rating = rawRating.toString().trim().toLowerCase();
		return rating === normalizedSelected;
	});
}

function applyFiltersAndSort() {
	filteredNovels = [...allNovels];

	const {
		search,
		rating,
		readingStatus,
		workStatus,
		storyType,
		language,
		fandoms,
		genres,
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

	if (readingStatus && readingStatus !== "all") {
		filteredNovels = filteredNovels.filter((n) => {
			const normalized = normalizeReadingStatus(n.readingStatus);
			return normalized === readingStatus;
		});
	}

	if (workStatus && workStatus !== "all") {
		filteredNovels = filteredNovels.filter((n) => n.status === workStatus);
	}

	filteredNovels = fandomTypeFilter(filteredNovels, storyType);

	if (language && language !== "all") {
		const targetLang = language.toLowerCase();
		filteredNovels = filteredNovels.filter(
			(n) => (n.metadata?.language || "").toLowerCase() === targetLang
		);
	}

	if (Array.isArray(fandoms) && fandoms.length > 0) {
		filteredNovels = filteredNovels.filter((n) => {
			const storyFandoms = [...categorizeNovelAttributes(n).fandoms];
			return storyFandoms.some((f) => fandoms.includes(f));
		});
	}

	if (Array.isArray(genres) && genres.length > 0) {
		filteredNovels = filteredNovels.filter((n) => {
			const storyGenres = getNovelGenres(n);
			return genres.every((genre) => storyGenres.includes(genre));
		});
	}

	if (Array.isArray(characters) && characters.length > 0) {
		filteredNovels = filteredNovels.filter((n) => {
			const storyCharacters = getNovelCharacters(n);
			return characters.every((character) =>
				storyCharacters.includes(character)
			);
		});
	}

	if (Array.isArray(tags) && tags.length > 0) {
		filteredNovels = filteredNovels.filter((n) => {
			const storyTags = getNovelTags(n);
			if (tagsMode === "all") {
				return tags.every((tag) => storyTags.includes(tag));
			}
			return storyTags.some((tag) => tags.includes(tag));
		});
	}

	const minWords = parseInt(wordCountMin, 10);
	const maxWords = parseInt(wordCountMax, 10);
	filteredNovels = filteredNovels.filter((n) => {
		const words = n.stats?.words || n.metadata?.words || 0;
		if (!Number.isNaN(minWords) && minWords > 0 && words < minWords)
			return false;
		if (!Number.isNaN(maxWords) && maxWords > 0 && words > maxWords)
			return false;
		return true;
	});

	if (sort) {
		filteredNovels.sort((a, b) => {
			const getStat = (n, key) =>
				n.stats?.[key] || n.metadata?.[key] || 0;

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
				case "favorites":
					return getStat(b, "favorites") - getStat(a, "favorites");
				case "follows":
					return getStat(b, "follows") - getStat(a, "follows");
				case "reviews":
					return getStat(b, "reviews") - getStat(a, "reviews");
				case "published":
					return (
						getStat(b, "publishedDate") -
						getStat(a, "publishedDate")
					);
				case "updated":
					return (
						getStat(b, "updatedDate") - getStat(a, "updatedDate")
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

function normalizeRatingClass(rating) {
	const val = (rating || "").toString().trim().toLowerCase();
	if (!val) return "";
	if (val === "k+") return "rating-kp";
	return `rating-${val}`;
}

function categorizeNovelAttributes(novel) {
	const metadata = novel.metadata || {};
	const buckets = {
		fandoms: new Set(),
		genres: new Set(),
		characters: new Set(),
		tags: new Set(),
		contentTypes: new Set(),
	};

	const addValue = (value, forcedCategory) => {
		if (!value) return;
		const canonical = canonicalizeLabel(value, forcedCategory);
		const domainCategory = isDomainLabel(canonical) ? "contentTypes" : null;
		const category =
			forcedCategory ||
			domainCategory ||
			categorizeLabel(canonical) ||
			"tags";
		buckets[category].add(canonical);
	};

	const addList = (list, forcedCategory) => {
		(list || []).forEach((item) => addValue(item, forcedCategory));
	};

	addList(metadata.fandoms, "fandoms");
	addList(metadata.characters, "characters");
	addList(metadata.genres, "genres");
	addList(novel.genres, "genres");
	addList(metadata.tags, "tags");
	addList(novel.tags, "tags");

	(metadata.hierarchy || []).forEach((entry) => {
		if (isDomainLabel(entry?.name)) {
			addValue(entry.name, "contentTypes");
		}
	});

	// Keep tags bucket for misc only (exclude items already categorized elsewhere)
	[...buckets.tags].forEach((tag) => {
		if (
			buckets.fandoms.has(tag) ||
			buckets.genres.has(tag) ||
			buckets.characters.has(tag) ||
			buckets.contentTypes.has(tag)
		) {
			buckets.tags.delete(tag);
		}
	});

	return buckets;
}

function getNovelTags(novel) {
	const buckets = categorizeNovelAttributes(novel);
	return [...buckets.tags, ...buckets.contentTypes];
}

function getNovelGenres(novel) {
	return [...categorizeNovelAttributes(novel).genres];
}

function getNovelCharacters(novel) {
	return [...categorizeNovelAttributes(novel).characters];
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

	const singleFandoms = new Map();
	const crossoverPairs = new Map();

	novels.forEach((novel) => {
		const isCrossover = novel.metadata?.isCrossover === true;
		const fandoms = novel.metadata?.fandoms || [];

		if (isCrossover) {
			fandoms.forEach((fandom) => {
				if (!crossoverPairs.has(fandom)) {
					crossoverPairs.set(fandom, new Set());
				}
			});
		} else if (fandoms.length > 0) {
			const fandom = fandoms[0];
			singleFandoms.set(fandom, (singleFandoms.get(fandom) || 0) + 1);
		}
	});

	const viewMode = filterState.fandomsView || "dropdown";

	let html = `
		<div class="fandom-grid-header">
			<div class="fandom-grid-controls">
				<div class="fandom-view-toggle" role="group" aria-label="Fandom view">
					<button type="button" class="view-toggle-btn ${
						viewMode === "dropdown" ? "active" : ""
					}" data-view="dropdown" aria-label="Dropdown view" title="Dropdown view">☰</button>
					<button type="button" class="view-toggle-btn ${
						viewMode === "grid" ? "active" : ""
					}" data-view="grid" aria-label="Grid view" title="Grid view">▦</button>
				</div>
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
		<div class="fandom-grid-container" data-view="${viewMode}">`;

	if (singleFandoms.size > 0) {
		html += `<div class="category-group"><h4>Single Fandom Stories</h4><div class="fandom-grid">`;
		singleFandoms.forEach((count, fandom) => {
			html += `
				<button class="fandom-card single" data-fandom="${encodeURIComponent(
					fandom,
				)}" data-type="single">
					<span class="fandom-icon">📖</span>
					<span class="fandom-name">${escapeHtml(fandom)}</span>
					<span class="fandom-count">${count} ${count === 1 ? "story" : "stories"}</span>
				</button>
			`;
		});
		html += `</div></div>`;
	}

	if (crossoverPairs.size > 0) {
		html += `<div class="category-group"><h4>Crossover Stories</h4><div class="fandom-grid">`;
		crossoverPairs.forEach((otherFandoms, fandom) => {
			html += `
				<button class="fandom-card crossover" data-fandom="${encodeURIComponent(
					fandom,
				)}" data-type="crossover">
					<span class="fandom-icon">🔀</span>
					<span class="fandom-name">${escapeHtml(fandom)}</span>
					<span class="fandom-count">${otherFandoms.size} ${
						otherFandoms.size === 1 ? "crossover" : "crossovers"
					}</span>
				</button>
			`;
		});
		html += `</div></div>`;
	}

	html += `</div>`;

	renderTarget.innerHTML = html;

	const dropdownList = renderTarget.querySelector("#fandoms-nav-list");
	if (dropdownList) {
		const dropdownItems = [];
		singleFandoms.forEach((count, fandom) => {
			dropdownItems.push({ fandom, count, type: "single", icon: "📖" });
		});
		crossoverPairs.forEach((otherFandoms, fandom) => {
			dropdownItems.push({
				fandom,
				count: otherFandoms.size,
				type: "crossover",
				icon: "🔀",
			});
		});

		dropdownList.innerHTML = dropdownItems
			.sort(
				(a, b) => b.count - a.count || a.fandom.localeCompare(b.fandom),
			)
			.map((item) => {
				const safeName = escapeHtml(item.fandom);
				return `
					<button type="button" class="fandom-dropdown-item" data-fandom="${encodeURIComponent(
						item.fandom,
					)}" data-type="${item.type}">
						<span class="pill-icon">${item.icon}</span>
						<span class="pill-label">${safeName}</span>
						<span class="pill-count">${item.count}</span>
					</button>
				`;
			})
			.join("");
	}

	renderTarget.querySelectorAll(".fandom-card").forEach((card) => {
		card.addEventListener("click", () => {
			const fandom = decodeURIComponent(card.dataset.fandom);
			const type = card.dataset.type;
			handleFandomClick(fandom, type);
		});
	});

	const viewToggleButtons = renderTarget.querySelectorAll(".view-toggle-btn");
	viewToggleButtons.forEach((btn) => {
		btn.addEventListener("click", () => {
			const view = btn.dataset.view;
			filterState.fandomsView = view;
			persistFilters();
			setupFandomNav(allNovels);
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
			.querySelectorAll(".fandom-dropdown-item")
			.forEach((button) => {
				button.addEventListener("click", () => {
					const fandom = decodeURIComponent(button.dataset.fandom);
					const type = button.dataset.type;
					handleFandomClick(fandom, type);
				});
			});
	}
}

function handleFandomClick(fandom, type) {
	selectedFandom = fandom;

	if (type === "crossover") {
		const filtered = allNovels.filter((novel) => {
			const isCrossover = novel.metadata?.isCrossover === true;
			const fandoms = novel.metadata?.fandoms || [];
			return isCrossover && fandoms.includes(fandom);
		});
		renderNovels(filtered);
	} else {
		filterNovelsBySingleFandom(fandom);
	}

	document
		.getElementById("novel-grid")
		.scrollIntoView({ behavior: "smooth" });
}

function filterNovelsByFandomPair(fandom1, fandom2) {
	const filtered = allNovels.filter((novel) => {
		const fandoms = novel.metadata?.fandoms || [];
		return fandoms.includes(fandom1) && fandoms.includes(fandom2);
	});

	renderNovels(filtered);
	document
		.getElementById("novel-grid")
		.scrollIntoView({ behavior: "smooth" });
}

function filterNovelsBySingleFandom(fandom) {
	const filtered = allNovels.filter((novel) => {
		const fandoms = novel.metadata?.fandoms || [];
		const isCrossover = novel.metadata?.isCrossover === true;
		return !isCrossover && fandoms.includes(fandom);
	});

	renderNovels(filtered);
	document
		.getElementById("novel-grid")
		.scrollIntoView({ behavior: "smooth" });
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
	if (!novels || novels.length === 0) {
		document.getElementById("stats-novels").textContent = "0";
		document.getElementById("stats-enhanced").textContent = "0";
		document.getElementById("stats-words").textContent = "0";
		document.getElementById("stats-avg-words").textContent = "-";
		document.getElementById("stats-reading").textContent = "0%";
		document.getElementById("stats-avgrating").textContent = "-";
		document.getElementById("stats-completed").textContent = "0";
		document.getElementById("stats-single").textContent = "0";
		document.getElementById("stats-crossovers").textContent = "0";
		setInsightTarget("most-favorited", null, "-");
		setInsightTarget("most-followed", null, "-");
		setInsightTarget("most-reviewed", null, "-");
		setInsightTarget("longest-story", null, "-");
		setInsightTarget("newest-addition", null, "-");
		setInsightTarget("most-chapters", null, "-");

		renderReadingStatusChart({});
		return;
	}

	const totalNovels = novels.length;
	const totalEnhanced = novels.reduce(
		(sum, n) => sum + (n.enhancedChaptersCount || 0),
		0
	);
	const totalWords = novels.reduce(
		(sum, n) => sum + (n.metadata?.words || n.words || 0),
		0
	);
	const avgWords = totalNovels > 0 ? Math.round(totalWords / totalNovels) : 0;
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
	const completedWorks = novels.filter(
		(n) => (n.status || "").toLowerCase() === "completed"
	).length;
	const singleCount = novels.filter((n) => {
		const fandoms = n.metadata?.fandoms || [];
		return !n.metadata?.isCrossover || fandoms.length === 1;
	}).length;
	const crossoverCount = novels.filter((n) => {
		const fandoms = n.metadata?.fandoms || [];
		return fandoms.length > 1;
	}).length;

	const ratingMap = { K: 1, "K+": 2, T: 3, M: 4 };
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

	document.getElementById("stats-novels").textContent =
		totalNovels.toLocaleString();
	document.getElementById("stats-enhanced").textContent =
		totalEnhanced.toLocaleString();
	document.getElementById("stats-words").textContent =
		formatNumber(totalWords);
	document.getElementById("stats-avg-words").textContent =
		formatNumber(avgWords);
	document.getElementById("stats-completed").textContent =
		completedWorks.toLocaleString();
	document.getElementById("stats-crossovers").textContent =
		crossoverCount.toLocaleString();
	document.getElementById("stats-single").textContent =
		singleCount.toLocaleString();
	document.getElementById("stats-avgrating").textContent = avgRating;
	document.getElementById("stats-reading").textContent = `${readingPercent}%`;

	let mostFavorited = null;
	let mostFollowed = null;
	let mostReviewed = null;
	let longest = null;

	novels.forEach((novel) => {
		if (
			!mostFavorited ||
			(novel.metadata?.favorites || 0) >
				(mostFavorited.metadata?.favorites || 0)
		) {
			mostFavorited = novel;
		}
		if (
			!mostFollowed ||
			(novel.metadata?.follows || 0) >
				(mostFollowed.metadata?.follows || 0)
		) {
			mostFollowed = novel;
		}
		if (
			!mostReviewed ||
			(novel.metadata?.reviews || 0) >
				(mostReviewed.metadata?.reviews || 0)
		) {
			mostReviewed = novel;
		}
		if (
			!longest ||
			(novel.metadata?.words || 0) > (longest.metadata?.words || 0)
		) {
			longest = novel;
		}
	});

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
		"most-favorited",
		mostFavorited,
		mostFavorited
			? `${mostFavorited.title} (${mostFavorited.metadata?.favorites || 0})`
			: "-",
	);
	setInsightTarget(
		"most-followed",
		mostFollowed,
		mostFollowed
			? `${mostFollowed.title} (${mostFollowed.metadata?.follows || 0})`
			: "-",
	);
	setInsightTarget(
		"most-reviewed",
		mostReviewed,
		mostReviewed
			? `${mostReviewed.title} (${mostReviewed.metadata?.reviews || 0})`
			: "-",
	);
	setInsightTarget(
		"longest-story",
		longest,
		longest
			? `${longest.title} (${formatNumber(longest.metadata?.words || 0)})`
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
		summary.textContent = "No stories yet";
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

	const completedKey = READING_STATUS.COMPLETED || "completed";
	const readingKey = READING_STATUS.READING || "reading";
	const plantoreadKey = READING_STATUS.PLAN_TO_READ || "plan-to-read";
	const onHoldKey = READING_STATUS.ON_HOLD || "on-hold";
	const rereadingKey = READING_STATUS.REREADING || "rereading";
	const completedCount = buckets[completedKey] || buckets.completed || 0;
	const readingCount = buckets[readingKey] || buckets.reading || 0;
	const plantoreadCount = buckets[plantoreadKey] || buckets.plantoread || 0;
	const onHoldCount = buckets[onHoldKey] || buckets.onHold || 0;
	const rereadingCount = buckets[rereadingKey] || buckets.rereading || 0;

	summary.textContent = `${rereadingCount.toLocaleString()} Rereading • ${plantoreadCount.toLocaleString()} Plan to Read • ${completedCount.toLocaleString()} Completed • ${readingCount.toLocaleString()} Reading • ${onHoldCount.toLocaleString()} on Hold`;
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

	// FanFiction page uses an inline, wide filter surface that should scroll with the page
	if (document.body?.classList.contains("fanfiction-page")) {
		dropdown.style.position = "relative";
		dropdown.style.left = "0";
		dropdown.style.right = "0";
		dropdown.style.top = "0";
		dropdown.style.width = "100%";
		return;
	}

	const wasHidden =
		getComputedStyle(dropdown).display === "none" ||
		dropdown.style.display === "none";

	if (wasHidden) {
		dropdown.style.visibility = "hidden";
		dropdown.style.display = "block";
	}

	const buttonRect = button.getBoundingClientRect();
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const minPadding = 12;

	const measuredWidth = dropdown.offsetWidth || 440;
	const clampedWidth = Math.min(
		Math.max(measuredWidth, 320),
		viewportWidth - minPadding * 2
	);
	dropdown.style.width = `${clampedWidth}px`;

	const dropdownHeight = dropdown.offsetHeight || 0;
	let left = buttonRect.right - clampedWidth;
	left = Math.max(left, minPadding);
	left = Math.min(left, viewportWidth - clampedWidth - minPadding);

	let top = buttonRect.bottom + 8;
	let placeAbove = false;
	if (top + dropdownHeight > viewportHeight - minPadding) {
		const spaceAbove = buttonRect.top - 8;
		if (spaceAbove >= dropdownHeight) {
			placeAbove = true;
			top = buttonRect.top - dropdownHeight - 8;
		}
	}

	dropdown.style.position = "fixed";
	dropdown.style.left = `${left}px`;
	dropdown.style.right = "auto";
	dropdown.style.top = placeAbove
		? `${Math.max(minPadding, top)}px`
		: `${Math.min(buttonRect.bottom + 8, viewportHeight - minPadding)}px`;
	dropdown.style.bottom = "auto";

	if (wasHidden) {
		dropdown.style.display = "none";
		dropdown.style.visibility = "";
	}
}

function setupFandomFilter() {
	const fandomFilter = document.getElementById("fandom-filter");
	const ratingFilterEl = document.getElementById("rating-filter");
	const sortSelect = document.getElementById("sort-select");
	const statusFilter = document.getElementById("status-filter");
	const workStatusFilter = document.getElementById("work-status-filter");
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
			toggleId: "genres-dropdown-toggle",
			panelId: "genres-dropdown-panel",
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
				}
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

	bindSelect(fandomFilter, "storyType");
	bindSelect(ratingFilterEl, "rating");
	bindSelect(sortSelect, "sort");
	bindSelect(statusFilter, "readingStatus");
	bindSelect(workStatusFilter, "workStatus");
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
	}

	if (backBtn) {
		backBtn.addEventListener("click", () => {
			location.reload();
		});
	}

	renderActiveFilters();
}

async function initializeFanFictionShelf() {
	const loadingState = document.getElementById("loading-state");
	const emptyState = document.getElementById("empty-state");
	const novelGrid = document.getElementById("novel-grid");

	try {
		const storage = await browser.storage.local.get("rg_novel_library");
		const fullLibrary = storage["rg_novel_library"] || {};
		const novelsList = fullLibrary.novels || {};
		const allStoredNovels = Object.values(novelsList);

		allNovels = allStoredNovels.filter(
			(n) => n && n.shelfId === "fanfiction"
		);
		filteredNovels = [...allNovels];
		buildTaxonomyFromNovels(allNovels);
		if (
			FanFictionNovelCard &&
			typeof FanFictionNovelCard.primeTaxonomy === "function"
		) {
			FanFictionNovelCard.primeTaxonomy(allNovels);
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
		setupFandomFilter();
		setupInsightClicks();
		applyFiltersAndSort();
	} catch (error) {
		console.error(
			"[FanFiction Shelf] CRITICAL ERROR during initialization:",
			error
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

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeFanFictionShelf);
} else {
	initializeFanFictionShelf();
}

// Helper functions for modal action buttons
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
		const library = result.rg_novel_library || { novels: {} };

		if (library.novels && library.novels[novelId]) {
			delete library.novels[novelId];
			await browser.storage.local.set({ rg_novel_library: library });

			// Refresh the display
			allNovels = allNovels.filter((n) => n.id !== novelId);
			updateAnalytics(allNovels);
			applyFiltersAndSort();

			showToast("Novel removed from library", "success");
		}
	} catch (error) {
		console.error("[FanFiction Shelf] Error removing novel:", error);
		showToast("Failed to remove novel", "error");
	}
}

function refreshNovelMetadata(novel) {
	const url = novel?.url || novel?.sourceUrl || "";
	if (!url) {
		showToast("No source URL available for refresh", "error");
		return;
	}
	window.open(url, "_blank", "noopener,noreferrer");
	showToast("Opened source page to refresh metadata", "info");
}

function openEditModal(novel) {
	const id = novel?.id || "";
	if (!id) {
		showToast("Missing novel id for edit", "error");
		return;
	}
	const baseUrl =
		typeof browser !== "undefined" && browser?.runtime?.getURL
			? browser.runtime.getURL("library/library.html")
			: "../library.html";
	window.open(`${baseUrl}?edit=${encodeURIComponent(id)}`, "_blank");
}
