/**
 * NovelArrow Shelf Page Script
 * Handles filtering, sorting, rendering, and navigation for the NovelBin library view
 */

import { NovelbinNovelCard } from "./novel-card.js";
import { NovelbinHandler } from "../../../utils/website-handlers/novelbin-handler.js";
import { NovelCardRenderer } from "../novel-card-base.js";
import { openInlineEditModal } from "../../edit-modal.js";
import {
	READING_STATUS,
	READING_STATUS_INFO,
	updateNovelInLibrary,
	novelLibrary,
} from "../../../utils/novel-library.js";
import { loadImageWithCache } from "../../../utils/image-cache.js";
import {
	resolveExportTemplate,
	formatExportFilename,
} from "../../../utils/novel-copy-format.js";
import {
	applyThemeFromStorage,
	setupThemeListener,
} from "../../../utils/theme-config.js";
import {
	bindModalSwipeDismiss,
	createModalNavigationController,
	recoverMissingNovelById,
} from "../../shared-shelf-helpers.js";

// ── State ─────────────────────────────────────────────────────────────────────

let allNovels = [];
let filteredNovels = [];

const modalNavigation = createModalNavigationController({
	getContextIds: (novelId) => {
		const visibleNovels = filteredNovels.length > 0 ? filteredNovels : allNovels;
		const visibleIds = visibleNovels.map((n) => n.id);
		if (novelId && visibleIds.includes(novelId)) return visibleIds;
		const allIds = allNovels.map((n) => n.id);
		if (novelId && allIds.includes(novelId)) return allIds;
		return visibleIds.length > 0 ? visibleIds : allIds;
	},
	findNovelById: (novelId) =>
		filteredNovels.find((n) => n.id === novelId) ||
		allNovels.find((n) => n.id === novelId) ||
		null,
	onOpenNovel: (novel, options) => showNovelModal(novel, options),
});

// ── Filter state ──────────────────────────────────────────────────────────────

const FILTER_STORAGE_KEY = "rg_filters_novelbin";
const DEFAULT_FILTERS = {
	search: "",
	readingStatus: "all",
	workStatus: "all",
	language: "all",
	genres: [],
	sort: "recent",
};

let filterState = { ...DEFAULT_FILTERS };

function loadSavedFilters() {
	try {
		const saved = localStorage.getItem(FILTER_STORAGE_KEY);
		if (saved) {
			filterState = { ...DEFAULT_FILTERS, ...JSON.parse(saved) };
		}
	} catch (e) {
		console.warn("[NovelArrow Shelf] Failed to load saved filters", e);
		filterState = { ...DEFAULT_FILTERS };
	}
}

function persistFilters() {
	try {
		localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterState));
	} catch (e) {
		console.warn("[NovelArrow Shelf] Failed to persist filters", e);
	}
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = String(text ?? "");
	return div.innerHTML;
}

function formatNumber(num) {
	if (!num) return "0";
	const n = typeof num === "string" ? parseInt(num.replace(/,/g, ""), 10) : num;
	if (isNaN(n)) return "0";
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
	if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
	if (n >= 1_000) return n.toLocaleString();
	return n.toString();
}

function normalizeReadingStatus(status) {
	if (!status) return "";
	const normalized = status.toLowerCase().replace(/_/g, "-");
	switch (normalized) {
		case "currently-reading":
		case "in-progress":
			return READING_STATUS.READING;
		case "rereading":
		case "re-reading":
			return READING_STATUS.RE_READING;
		default:
			return normalized;
	}
}

function normalizeModalStatus(status) {
	if (!status) return READING_STATUS.PLAN_TO_READ;
	return normalizeReadingStatus(status) || READING_STATUS.PLAN_TO_READ;
}

function getNovelGenres(novel) {
	const metadata = novel.metadata || {};
	const raw = Array.isArray(metadata.genres)
		? metadata.genres
		: Array.isArray(novel.genres)
			? novel.genres
			: [];
	return raw.map((g) => g.trim()).filter(Boolean);
}

function sortAlpha(set) {
	return [...set].sort((a, b) => a.localeCompare(b));
}

// ── Taxonomy / filter option building ─────────────────────────────────────────

function buildFilterOptions(novels) {
	const languages = new Set();
	const genres = new Set();
	novels.forEach((novel) => {
		const meta = novel.metadata || {};
		if (meta.language) languages.add(meta.language.trim());
		getNovelGenres(novel).forEach((g) => genres.add(g));
	});
	return { languages: sortAlpha(languages), genres: sortAlpha(genres) };
}

function populateDynamicFilters() {
	const { languages, genres } = buildFilterOptions(allNovels);

	// Language dropdown
	const languageSelect = document.getElementById("language-filter");
	if (languageSelect) {
		languageSelect.innerHTML =
			'<option value="all">All Languages</option>' +
			languages
				.map((lang) => `<option value="${escapeHtml(lang)}">${escapeHtml(lang)}</option>`)
				.join("");
		languageSelect.value = filterState.language === "all" ? "all" : filterState.language;
	}

	// Genres pill list
	renderPillList("genres-filter", genres, filterState.genres, "genres");
}

// ── Multi-select pill list ────────────────────────────────────────────────────

function renderPillList(containerId, items, selectedValues, stateKey) {
	const container = document.getElementById(containerId);
	if (!container) return;

	if (!items || items.length === 0) {
		container.innerHTML = '<span class="filter-chip">No genres found</span>';
		return;
	}

	container.innerHTML = items
		.map((item) => {
			const safe = escapeHtml(item);
			const isActive = selectedValues.includes(item);
			return `<label class="filter-pill ${isActive ? "active" : ""}">
				<input type="checkbox" value="${safe}" ${isActive ? "checked" : ""} />
				<span>${safe}</span>
			</label>`;
		})
		.join("");

	container.querySelectorAll("input[type='checkbox']").forEach((input) => {
		input.addEventListener("change", (e) => {
			const value = e.target.value;
			const current = new Set(filterState[stateKey] || []);
			if (e.target.checked) {
				current.add(value);
			} else {
				current.delete(value);
			}
			filterState[stateKey] = [...current];
			persistFilters();
			renderActiveFilters();
			applyFiltersAndSort();
		});
	});
}

function syncPillListUI(containerId, selectedValues) {
	const container = document.getElementById(containerId);
	if (!container) return;
	container.querySelectorAll("input[type='checkbox']").forEach((input) => {
		const isChecked = selectedValues.includes(input.value);
		input.checked = isChecked;
		input.closest(".filter-pill")?.classList.toggle("active", isChecked);
	});
}

// ── Active filter chips ───────────────────────────────────────────────────────

function renderActiveFilters() {
	const container = document.getElementById("active-filters");
	if (!container) return;

	updateGenresDropdownLabel();

	const chips = [];
	const addChip = (key, label, value = "") => chips.push({ key, label, value });

	if (filterState.search) addChip("search", `Search: ${filterState.search}`);
	if (filterState.readingStatus && filterState.readingStatus !== "all")
		addChip("readingStatus", `Reading: ${filterState.readingStatus}`);
	if (filterState.workStatus && filterState.workStatus !== "all")
		addChip("workStatus", `Status: ${filterState.workStatus}`);
	if (filterState.language && filterState.language !== "all")
		addChip("language", `Language: ${filterState.language}`);
	(filterState.genres || []).forEach((g) => addChip("genres", `Genre: ${g}`, g));

	container.innerHTML = "";
	chips.forEach((chip) => {
		const el = document.createElement("span");
		el.className = "filter-chip";
		el.innerHTML = `<strong>${escapeHtml(chip.label)}</strong> <button aria-label="Clear filter" data-key="${chip.key}" data-value="${chip.value ? escapeHtml(chip.value) : ""}">\u{D7}</button>`;
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

function updateGenresDropdownLabel() {
	const toggle = document.getElementById("genres-dropdown-toggle");
	if (!toggle) return;
	const count = (filterState.genres || []).length;
	toggle.textContent = count > 0 ? `Choose Genres (${count})` : "Choose Genres";
}

function clearFilter(key, value) {
	switch (key) {
		case "search":
			filterState.search = "";
			break;
		case "readingStatus":
			filterState.readingStatus = "all";
			break;
		case "workStatus":
			filterState.workStatus = "all";
			break;
		case "language":
			filterState.language = "all";
			break;
		case "genres":
			filterState.genres = (filterState.genres || []).filter((g) => g !== value);
			break;
		default:
			break;
	}
	applyFilterStateToUI();
	persistFilters();
	applyFiltersAndSort();
}

function applyFilterStateToUI() {
	const searchInput = document.getElementById("search-input");
	if (searchInput) searchInput.value = filterState.search || "";

	const bindValue = (id, value) => {
		const el = document.getElementById(id);
		if (el) el.value = value;
	};

	bindValue("status-filter", filterState.readingStatus);
	bindValue("work-status-filter", filterState.workStatus);
	bindValue("language-filter", filterState.language);
	bindValue("sort-select", filterState.sort);

	syncPillListUI("genres-filter", filterState.genres || []);
	renderActiveFilters();
}

// ── Filter & sort ─────────────────────────────────────────────────────────────

function applyFiltersAndSort() {
	filteredNovels = [...allNovels];

	const { search, readingStatus, workStatus, language, genres, sort } = filterState;

	if (search) {
		const query = search.toLowerCase();
		filteredNovels = filteredNovels.filter((n) => {
			const meta = n.metadata || {};
			return [n.title, n.author, n.description, ...(meta.genres || []), ...(n.genres || [])]
				.filter(Boolean)
				.join(" ")
				.toLowerCase()
				.includes(query);
		});
	}

	if (readingStatus && readingStatus !== "all") {
		filteredNovels = filteredNovels.filter(
			(n) => normalizeReadingStatus(n.readingStatus) === readingStatus,
		);
	}

	if (workStatus && workStatus !== "all") {
		filteredNovels = filteredNovels.filter((n) => {
			const s = (n.metadata?.status || n.status || "").toLowerCase();
			return s === workStatus.toLowerCase();
		});
	}

	if (language && language !== "all") {
		const target = language.toLowerCase();
		filteredNovels = filteredNovels.filter(
			(n) => (n.metadata?.language || "").toLowerCase() === target,
		);
	}

	if (Array.isArray(genres) && genres.length > 0) {
		filteredNovels = filteredNovels.filter((n) => {
			const novelGenres = getNovelGenres(n);
			return genres.every((g) => novelGenres.includes(g));
		});
	}

	if (sort) {
		filteredNovels.sort((a, b) => {
			switch (sort) {
				case "recent":
					return (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0);
				case "added":
					return (b.addedAt || 0) - (a.addedAt || 0);
				case "title":
					return (a.title || "").localeCompare(b.title || "");
				case "chapters":
					return (b.enhancedChaptersCount || 0) - (a.enhancedChaptersCount || 0);
				case "words":
					return (
						(b.metadata?.words || b.words || 0) -
						(a.metadata?.words || a.words || 0)
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

// ── Render novels ─────────────────────────────────────────────────────────────

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
			const renderer = NovelbinNovelCard || NovelCardRenderer;
			const card = renderer.renderCard(novel);
			grid.appendChild(card);
		} catch (err) {
			console.error("[NovelArrow Shelf] Error rendering card:", err);
			const fallback = document.createElement("div");
			fallback.className = "novel-card";
			fallback.dataset.novelId = novel.id;
			fallback.innerHTML = `<div class="novel-card-info"><h3 class="novel-title">${escapeHtml(novel.title)}</h3><p class="novel-author">${escapeHtml(novel.author || "Unknown")}</p></div>`;
			fallback.addEventListener("click", () => showNovelModal(novel));
			grid.appendChild(fallback);
		}
	});

	if (novelCount)
		novelCount.textContent = `(${novels.length} ${novels.length === 1 ? "novel" : "novels"})`;

}

// ── Modal ─────────────────────────────────────────────────────────────────────

function showNovelModal(novel, options = {}) {
	const modal = document.getElementById("novel-modal");
	if (!modal) return;

	modalNavigation.syncContext(novel.id, options.contextIds);

	try {
		const params = new URLSearchParams(window.location.search);
		params.set("novel", novel.id);
		params.set("openModal", "1");
		history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
	} catch (_) {
		// non-critical
	}

	// Header
	const titleEl = document.getElementById("modal-title");
	if (titleEl) titleEl.textContent = novel.title || "";

	const authorEl = document.getElementById("modal-author");
	if (authorEl) {
		const authorUrl = novel.metadata?.authorUrl;
		if (authorUrl) {
			authorEl.innerHTML = `<a href="${escapeHtml(authorUrl)}" target="_blank" rel="noreferrer">${escapeHtml(novel.author || "Unknown")}</a>`;
		} else {
			authorEl.textContent = novel.author || "Unknown";
		}
	}

	const descriptionEl = document.getElementById("modal-description");
	if (descriptionEl) {
		descriptionEl.textContent = "";
		if (novel.description) {
			novel.description.split(/\n/).forEach((line, i, arr) => {
				descriptionEl.appendChild(document.createTextNode(line));
				if (i < arr.length - 1) descriptionEl.appendChild(document.createElement("br"));
			});
		}
	}

	const coverImg = document.getElementById("modal-cover");
	if (coverImg && novel.coverUrl) {
		loadImageWithCache(coverImg, novel.coverUrl).catch(() => {});
		coverImg.style.display = "block";
		coverImg.addEventListener("error", () => { coverImg.style.display = "none"; });
	} else if (coverImg) {
		coverImg.style.display = "none";
	}

	// Action buttons
	const continueBtn = document.getElementById("modal-continue-btn");
	if (continueBtn) {
		const lastReadUrl = novel.lastReadUrl || novel.sourceUrl;
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
		// Button text is already "View on NovelArrow" in the HTML
	}

	const refreshBtn = document.getElementById("modal-refresh-btn");
	if (refreshBtn) {
		refreshBtn.onclick = () => { refreshNovelMetadata(novel); closeModal(); };
	}

	const editBtn = document.getElementById("modal-edit-btn");
	if (editBtn) {
		editBtn.onclick = () => { openEditModal(novel); closeModal(); };
	}

	const removeBtn = document.getElementById("modal-remove-btn");
	if (removeBtn) {
		removeBtn.onclick = async () => {
			if (confirm(`Are you sure you want to remove "${novel.title}" from your library?`)) {
				await removeNovelFromLibrary(novel.id);
				closeModal();
			}
		};
	}

	const openLibraryBtn = document.getElementById("modal-open-library-btn");
	if (openLibraryBtn) {
		openLibraryBtn.onclick = () => {
			const url = browser.runtime.getURL(
				`library/library.html?novel=${encodeURIComponent(novel.id)}&openModal=1`,
			);
			window.open(url, "_blank");
		};
	}

	const openLibraryHeaderBtn = document.getElementById("modal-open-library-header-btn");
	if (openLibraryHeaderBtn) {
		openLibraryHeaderBtn.onclick = () => {
			const url = browser.runtime.getURL(
				`library/library.html?novel=${encodeURIComponent(novel.id)}&openModal=1`,
			);
			window.open(url, "_blank");
		};
	}

	// Site-specific metadata
	if (NovelbinNovelCard?.renderModalMetadata) {
		NovelbinNovelCard.renderModalMetadata(novel);
	}

	// Reading status buttons
	const statusButtons = document.querySelectorAll(".status-btn");
	const currentStatus = normalizeModalStatus(novel.readingStatus);
	statusButtons.forEach((btn) => {
		const status = normalizeModalStatus(btn.getAttribute("data-status"));
		btn.classList.toggle("active", status === currentStatus);
		btn.onclick = async () => {
			const updatedNovel = { ...novel, readingStatus: status };
			await updateNovelInLibrary(updatedNovel);
			const idx = allNovels.findIndex((n) => n.id === novel.id);
			if (idx >= 0) allNovels[idx] = updatedNovel;
			const fi = filteredNovels.findIndex((n) => n.id === novel.id);
			if (fi >= 0) filteredNovels[fi] = updatedNovel;
			applyFiltersAndSort();
			statusButtons.forEach((b) => {
				b.classList.toggle(
					"active",
					normalizeModalStatus(b.getAttribute("data-status")) === status,
				);
			});
		};
	});

	// Copy name button
	const copyInfoBtn = document.getElementById("modal-copy-info-btn");
	if (copyInfoBtn) {
		copyInfoBtn.onclick = async () => {
			try {
				const settings = await novelLibrary.getSettings();
				const template = resolveExportTemplate(settings?.novelCopyFormats, novel.shelfId);
				const text = formatExportFilename(novel, template);
				await navigator.clipboard.writeText(text);
				copyInfoBtn.textContent = "\u{2705} Copied!";
				setTimeout(() => { copyInfoBtn.textContent = "\u{1F4CB} Copy Name"; }, 2000);
			} catch (_) {
				copyInfoBtn.textContent = "\u{274C} Failed";
				setTimeout(() => { copyInfoBtn.textContent = "\u{1F4CB} Copy Name"; }, 2000);
			}
		};
	}

	// LNCrawl multi-domain panel
	const lncrawlBtn = document.getElementById("modal-lncrawl-btn");
	const lncrawlPanel = document.getElementById("modal-lncrawl-panel");
	const lncrawlCmds = document.getElementById("modal-lncrawl-cmds");
	if (lncrawlBtn && lncrawlPanel && lncrawlCmds) {
		// Extract slug from the novel's sourceUrl or lastReadUrl
		const novelUrl = novel.sourceUrl || novel.lastReadUrl || "";
		let slug = "";
		try {
			const u = new URL(novelUrl);
			const m = u.pathname.match(/\/(?:b|novel)\/([a-z0-9-]+)/i);
			if (m) slug = m[1];
		} catch (_) { /* ignore */ }

		lncrawlBtn.onclick = () => {
			const open = lncrawlPanel.style.display === "none";
			lncrawlPanel.style.display = open ? "block" : "none";
			if (!open) return;

			// Build the three domain command rows
			const domains = slug
				? [
					{ label: "novelbin.com", url: `https://novelbin.com/b/${slug}`, note: "" },
					{ label: "novelbin.me", url: `https://novelbin.me/b/${slug}`, note: "(mirror — may be down)" },
					{ label: "novelarrow.com", url: `https://novelarrow.com/novel/${slug}`, note: "(new site)" },
				]
				: [];

			if (!domains.length) {
				lncrawlCmds.textContent = "Could not extract novel slug from URL.";
				return;
			}

			lncrawlCmds.textContent = "";
			domains.forEach((d) => {
				const cmd = `lncrawl -u "${d.url}"`;

				const row = document.createElement("div");
				row.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:6px;";

				const code = document.createElement("code");
				code.style.cssText = "flex:1;font-size:11px;padding:4px 8px;background:var(--bg-secondary,#1e1e2e);border-radius:4px;border:1px solid var(--border-color,#44475a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
				code.title = cmd;
				code.textContent = cmd;

				const copyBtn = document.createElement("button");
				copyBtn.className = "btn btn-icon lncrawl-copy-cmd";
				copyBtn.style.cssText = "flex-shrink:0;font-size:11px;padding:3px 8px;";
				copyBtn.title = `Copy command for ${d.label}`;
				copyBtn.textContent = "\u{1F4CB}";
				copyBtn.addEventListener("click", async () => {
					try {
						await navigator.clipboard.writeText(cmd);
						copyBtn.textContent = "\u{2705}";
						setTimeout(() => { copyBtn.textContent = "\u{1F4CB}"; }, 2500);
					} catch (_) {
						copyBtn.textContent = "\u{274C}";
						setTimeout(() => { copyBtn.textContent = "\u{1F4CB}"; }, 2000);
					}
				});

				row.appendChild(code);
				row.appendChild(copyBtn);

				if (d.note) {
					const note = document.createElement("span");
					note.style.cssText = "font-size:10px;color:var(--text-muted,#888);flex-shrink:0;";
					note.textContent = d.note;
					row.appendChild(note);
				}

				lncrawlCmds.appendChild(row);
			});
		};

	}

	// Progress bar
	{
		const total = novel.totalChapters || novel.metadata?.totalChapters || 0;
		const read = novel.lastReadChapter || 0;
		const pct = total > 0 ? Math.min(Math.round((read / total) * 100), 100) : 0;
		const fill = document.getElementById("modal-progress-fill");
		const text = document.getElementById("modal-progress-text");
		if (fill) fill.style.width = pct + "%";
		if (text) {
			text.textContent = total > 0 ? `Ch. ${read} / ${total} (${pct}%)` : "";
		}
	}

	modal.style.display = "flex";

	const closeBtn = document.getElementById("modal-close-btn");
	const backdrop = document.getElementById("modal-backdrop");

	function closeModal() {
		modal.style.display = "none";
	}

	if (typeof modal._swipeCleanup === "function") modal._swipeCleanup();
	modal._swipeCleanup = bindModalSwipeDismiss({ modal, onDismiss: closeModal });

	closeBtn.addEventListener("click", closeModal);
	backdrop.addEventListener("click", closeModal);

	const closeOnEscape = (e) => {
		if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", closeOnEscape); }
	};
	document.addEventListener("keydown", closeOnEscape);
}

// ── Analytics ─────────────────────────────────────────────────────────────────

function setInsightTarget(valueId, novel, text) {
	const valueEl = document.getElementById(valueId);
	if (!valueEl) return;
	valueEl.textContent = text || "-";
	const item = valueEl.closest(".analytics-item");
	if (!item) return;
	if (novel?.id) {
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

	container.addEventListener("click", (e) => openFromItem(e.target.closest(".analytics-item")));
	container.addEventListener("keydown", (e) => {
		if (e.key !== "Enter" && e.key !== " ") return;
		const item = e.target.closest(".analytics-item");
		if (!item?.dataset?.novelId) return;
		e.preventDefault();
		openFromItem(item);
	});
}

function updateAnalytics(novels) {
	const setText = (id, val) => {
		const el = document.getElementById(id);
		if (el) el.textContent = val;
	};

	if (!novels || novels.length === 0) {
		setText("stats-novels", "0");
		setText("stats-enhanced", "0");
		setText("stats-words", "0");
		setText("stats-completed", "0");
		setText("stats-ongoing", "0");
		setText("stats-reading", "0%");
		setText("language-count", "-");
		setInsightTarget("most-chapters", null, "-");
		setInsightTarget("longest-novel", null, "-");
		setInsightTarget("newest-addition", null, "-");
		renderReadingStatusChart({});
		return;
	}

	const totalNovels = novels.length;
	const totalEnhanced = novels.reduce((s, n) => s + (n.enhancedChaptersCount || 0), 0);
	const totalWords = novels.reduce(
		(s, n) => s + (n.metadata?.words || n.metadata?.wordCount || n.words || 0),
		0,
	);

	const completedWorks = novels.filter((n) => {
		const s = (n.metadata?.status || n.status || "").toLowerCase();
		return s === "completed";
	}).length;

	const ongoingWorks = novels.filter((n) => {
		const s = (n.metadata?.status || n.status || "").toLowerCase();
		return s === "ongoing";
	}).length;

	const readingBuckets = novels.reduce((acc, n) => {
		const key = normalizeReadingStatus(n.readingStatus) || READING_STATUS.PLAN_TO_READ;
		acc[key] = (acc[key] || 0) + 1;
		return acc;
	}, {});
	const readingCount = readingBuckets[READING_STATUS.READING] || readingBuckets["reading"] || 0;
	const readingPercent = Math.round((readingCount / totalNovels) * 100);

	// Insights
	const mostChapters = novels.reduce((max, n) => {
		const c = n.metadata?.totalChapters || n.totalChapters || 0;
		return c > (max.metadata?.totalChapters || max.totalChapters || 0) ? n : max;
	}, {});

	const longestNovel = novels.reduce((max, n) => {
		const w = n.metadata?.words || n.metadata?.wordCount || n.words || 0;
		const maxW = max.metadata?.words || max.metadata?.wordCount || max.words || 0;
		return w > maxW ? n : max;
	}, {});

	const newestAddition = novels.reduce((newest, n) => {
		const d = n.addedAt || n.metadata?.addedDate || 0;
		const nd = newest.addedAt || newest.metadata?.addedDate || 0;
		return d > nd ? n : newest;
	}, {});

	const languages = new Set();
	novels.forEach((n) => {
		const lang = n.metadata?.language;
		if (lang) languages.add(lang);
	});

	// Update stat cards
	setText("stats-novels", totalNovels.toLocaleString());
	setText("stats-enhanced", totalEnhanced.toLocaleString());
	setText("stats-words", formatNumber(totalWords));
	setText("stats-completed", completedWorks.toLocaleString());
	setText("stats-ongoing", ongoingWorks.toLocaleString());
	setText("stats-reading", readingPercent + "%");
	setText("language-count", languages.size || "-");

	setInsightTarget("most-chapters", mostChapters?.id ? mostChapters : null, mostChapters?.title || "-");
	setInsightTarget("longest-novel", longestNovel?.id ? longestNovel : null, longestNovel?.title || "-");
	setInsightTarget("newest-addition", newestAddition?.id ? newestAddition : null, newestAddition?.title || "-");

	renderReadingStatusChart(readingBuckets, totalNovels);
}

function renderReadingStatusChart(buckets = {}, total = 0) {
	const chart = document.getElementById("reading-status-chart");
	const legend = document.getElementById("reading-status-legend");
	const summary = document.getElementById("status-chart-summary");
	if (!chart || !legend || !summary) return;

	chart.innerHTML = "";
	legend.innerHTML = "";

	const totalCount = total || Object.values(buckets).reduce((s, v) => s + v, 0);
	const entries = Object.entries(buckets).filter(([, count]) => count > 0);

	if (!entries.length || !totalCount) {
		summary.textContent = "No novels yet";
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

		const pct = Math.round((count / totalCount) * 100);
		const legendItem = document.createElement("div");
		legendItem.className = "bar-legend-item";
		legendItem.innerHTML = `<span class="legend-swatch" style="background:${info.color || "var(--primary-color)"}"></span><span>${escapeHtml(label)} (${pct}%)</span>`;
		legend.appendChild(legendItem);
	});

	const completedCount = buckets[READING_STATUS.COMPLETED] || buckets.completed || 0;
	const readingCount = buckets[READING_STATUS.READING] || buckets.reading || 0;
	const planCount = buckets[READING_STATUS.PLAN_TO_READ] || buckets["plan-to-read"] || 0;
	const onHoldCount = buckets[READING_STATUS.ON_HOLD] || buckets["on-hold"] || 0;
	const rereadCount = buckets[READING_STATUS.RE_READING] || buckets["re-reading"] || buckets.rereading || 0;

	summary.textContent = `${rereadCount.toLocaleString()} Rereading \u{2022} ${planCount.toLocaleString()} Plan to Read \u{2022} ${completedCount.toLocaleString()} Completed \u{2022} ${readingCount.toLocaleString()} Reading \u{2022} ${onHoldCount.toLocaleString()} On Hold`;
}

// ── Filter UI setup ───────────────────────────────────────────────────────────

function positionFilterDropdown() {
	const dropdown = document.getElementById("filter-dropdown");
	const button = document.getElementById("filter-toggle-btn");
	if (!dropdown || !button) return;

	const wasHidden = dropdown.style.display === "none" || !dropdown.style.display;
	if (wasHidden) {
		dropdown.style.visibility = "hidden";
		dropdown.style.display = "block";
	}

	const buttonRect = button.getBoundingClientRect();
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const pad = 12;
	const measuredWidth = dropdown.offsetWidth || 380;
	const clampedWidth = Math.min(Math.max(measuredWidth, 280), viewportWidth - pad * 2);
	dropdown.style.width = `${clampedWidth}px`;

	const dropdownHeight = dropdown.offsetHeight || 0;
	let left = buttonRect.right - clampedWidth;
	left = Math.max(pad, Math.min(left, viewportWidth - clampedWidth - pad));
	let top = buttonRect.bottom + 8;
	if (top + dropdownHeight > viewportHeight - pad) {
		const spaceAbove = buttonRect.top - 8;
		if (spaceAbove >= dropdownHeight) top = buttonRect.top - dropdownHeight - 8;
	}

	dropdown.style.position = "fixed";
	dropdown.style.left = `${left}px`;
	dropdown.style.right = "auto";
	dropdown.style.top = `${Math.max(pad, top)}px`;
	dropdown.style.bottom = "auto";

	if (wasHidden) {
		dropdown.style.display = "none";
		dropdown.style.visibility = "";
	}
}

function setupFilters() {
	const sortSelect = document.getElementById("sort-select");
	const statusFilter = document.getElementById("status-filter");
	const workStatusFilter = document.getElementById("work-status-filter");
	const languageFilter = document.getElementById("language-filter");
	const searchInput = document.getElementById("search-input");
	const filterToggleBtn = document.getElementById("filter-toggle-btn");
	const filterDropdown = document.getElementById("filter-dropdown");
	const clearFiltersBtn = document.getElementById("clear-filters-btn");
	const genresToggle = document.getElementById("genres-dropdown-toggle");
	const genresPanel = document.getElementById("genres-dropdown-panel");

	// Genres multi-dropdown toggle
	if (genresToggle && genresPanel) {
		genresPanel.style.display = "none";
		genresToggle.addEventListener("click", (e) => {
			e.stopPropagation();
			genresPanel.style.display = genresPanel.style.display === "block" ? "none" : "block";
		});
	}

	// Filter panel toggle
	if (filterToggleBtn && filterDropdown) {
		filterDropdown.style.display = "none";

		filterToggleBtn.addEventListener("click", () => {
			const isVisible = filterDropdown.style.display !== "none";
			if (isVisible) {
				filterDropdown.style.display = "none";
				filterToggleBtn.classList.remove("active");
				if (genresPanel) genresPanel.style.display = "none";
				return;
			}
			filterDropdown.style.display = "block";
			positionFilterDropdown();
			filterToggleBtn.classList.add("active");
		});

		window.addEventListener("resize", () => {
			if (filterDropdown.style.display !== "none") positionFilterDropdown();
		});

		document.addEventListener("click", (e) => {
			const inside = filterDropdown.contains(e.target) || filterToggleBtn.contains(e.target) || genresPanel?.contains(e.target) || genresToggle?.contains(e.target);
			if (!inside) {
				filterDropdown.style.display = "none";
				filterToggleBtn.classList.remove("active");
				if (genresPanel) genresPanel.style.display = "none";
			}
		});
	}

	if (clearFiltersBtn) {
		clearFiltersBtn.addEventListener("click", () => {
			filterState = { ...DEFAULT_FILTERS };
			applyFilterStateToUI();
			populateDynamicFilters();
			applyFiltersAndSort();
			if (filterDropdown) filterDropdown.style.display = "none";
			if (filterToggleBtn) filterToggleBtn.classList.remove("active");
		});
	}

	const bindSelect = (el, key) => {
		if (!el) return;
		el.value = filterState[key];
		el.addEventListener("change", (e) => {
			filterState[key] = e.target.value;
			persistFilters();
			renderActiveFilters();
			applyFiltersAndSort();
		});
	};

	bindSelect(sortSelect, "sort");
	bindSelect(statusFilter, "readingStatus");
	bindSelect(workStatusFilter, "workStatus");
	bindSelect(languageFilter, "language");

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

	renderActiveFilters();
}

// ── Library helpers ───────────────────────────────────────────────────────────

function showToast(message, type = "success") {
	const toast = document.createElement("div");
	toast.className = `toast toast-${type}`;
	toast.textContent = message;
	toast.style.cssText = `
		position: fixed; bottom: 20px; right: 20px;
		padding: 12px 24px; border-radius: 8px;
		color: white; font-weight: 500; z-index: 10000;
		animation: slideIn 0.3s ease;
		background-color: ${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"};
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
			allNovels = allNovels.filter((n) => n.id !== novelId);
			updateAnalytics(allNovels);
			applyFiltersAndSort();
			showToast("Novel removed from library", "success");
		}
	} catch (err) {
		console.error("[NovelArrow Shelf] Error removing novel:", err);
		showToast("Failed to remove novel", "error");
	}
}

function refreshNovelMetadata(novel) {
	const url = novel?.sourceUrl || novel?.url || "";
	if (!url) { showToast("No source URL available for refresh", "error"); return; }
	window.open(url, "_blank", "noopener,noreferrer");
	showToast("Opened source page to refresh metadata", "info");
}

function openEditModal(novel) {
	if (!novel?.id) { showToast("Missing novel id for edit", "error"); return; }
	openInlineEditModal(novel, NovelbinHandler, {
		onSaved: (updatedNovel) => {
			const idx = allNovels.findIndex((n) => n?.id === updatedNovel.id);
			if (idx >= 0) allNovels[idx] = updatedNovel;
			const fi = filteredNovels.findIndex((n) => n?.id === updatedNovel.id);
			if (fi >= 0) filteredNovels[fi] = updatedNovel;
		},
		showToast,
	});
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
			recoverMissingNovelById(novelId, {
				showToast,
				onImported: async (result) => {
					if (result?.shelfId && result.shelfId !== "novelbin") {
						const targetUrl = browser.runtime.getURL(
							`library/websites/${result.shelfId}/index.html?novel=${encodeURIComponent(novelId)}&openModal=1`,
						);
						window.open(targetUrl, "_blank");
						return;
					}
					const library = await novelLibrary.getLibrary();
					allNovels = Object.values(library.novels || {}).filter(
						(n) => n && n.shelfId === "novelbin",
					);
					const imported = allNovels.find((n) => n && n.id === novelId);
					if (imported) {
						applyFiltersAndSort();
						showNovelModal(imported);
					}
				},
			});
		}
	} catch (_) {
		// ignore
	}
}

async function applyDisplaySettings() {
	const result = await browser.storage.local.get("libraryDisplayOptions");
	const s = {
		showFilterToolbar: true,
		showSortFilter: true,
		showStatusFilter: true,
		showActiveFilters: true,
		...(result.libraryDisplayOptions || {}),
	};
	const container = document.querySelector(".filter-dropdown-container");
	if (!container) return;
	if (!s.showFilterToolbar) { container.style.display = "none"; return; }
	const sortItem = document.getElementById("sort-select")?.closest(".filter-item");
	if (sortItem) sortItem.style.display = s.showSortFilter ? "" : "none";
	const statusItem = document.getElementById("status-filter")?.closest(".filter-item");
	if (statusItem) statusItem.style.display = s.showStatusFilter ? "" : "none";
	const activeFilters = document.getElementById("active-filters");
	if (activeFilters) activeFilters.style.display = s.showActiveFilters ? "" : "none";
}

// ── Initialization ────────────────────────────────────────────────────────────

(async () => {
	await applyThemeFromStorage();
	setupThemeListener();

	const loadingState = document.getElementById("loading-state");
	const emptyState = document.getElementById("empty-state");
	const novelGrid = document.getElementById("novel-grid");

	try {
		const storage = await browser.storage.local.get("rg_novel_library");
		const fullLibrary = storage["rg_novel_library"] || {};
		const novelsList = fullLibrary.novels || {};
		const allStoredNovels = Object.values(novelsList);

		allNovels = allStoredNovels.filter((n) => n && n.shelfId === "novelbin");
		filteredNovels = [...allNovels];

		loadSavedFilters();

		if (allNovels.length === 0) {
			if (loadingState) loadingState.style.display = "none";
			if (emptyState) emptyState.style.display = "block";
			if (novelGrid) novelGrid.style.display = "none";
			setupFilters();
			return;
		}

		if (loadingState) loadingState.style.display = "none";
		if (emptyState) emptyState.style.display = "none";
		if (novelGrid) novelGrid.style.display = "grid";

		// Favicon fallback
		const pageIconImg = document.getElementById("page-icon-img");
		const pageIcon = document.getElementById("page-icon");
		if (pageIconImg) {
			pageIconImg.addEventListener("error", () => {
				pageIconImg.style.display = "none";
				if (pageIcon) pageIcon.style.display = "inline-block";
			});
		}

		// Wire card clicks → modal. NovelbinNovelCard.onCardClick dispatches a
		// custom event by default; override it here so clicks open the modal directly.
		NovelbinNovelCard.onCardClick = (novel) => showNovelModal(novel);

		populateDynamicFilters();
		setupFilters();
		await applyDisplaySettings();
		setupInsightClicks();
		applyFiltersAndSort();
		modalNavigation.bind();
		openNovelFromQuery();
	} catch (err) {
		console.error("[NovelArrow Shelf] CRITICAL ERROR during initialization:", err);
		if (loadingState) loadingState.style.display = "none";
		if (emptyState) {
			emptyState.style.display = "block";
			const h2 = emptyState.querySelector("h2");
			if (h2) h2.textContent = `Error: ${err.message}`;
		}
		if (novelGrid) novelGrid.style.display = "none";
	}
})();
