/**
 * @fileoverview The shelf page runtime shared by every site.
 *
 * Each site's `shelf-page.js` is now a descriptor plus a call to
 * `initShelfPage()`. This module owns everything that was previously copied
 * five times: loading the library, building the filter UI, filtering, sorting,
 * rendering cards, the detail modal, analytics, and deep links.
 *
 * Sites differ only in what they declare — AO3 declares fandom/relationship/
 * character/word-count filters and eight stat cards, NovelBin declares language
 * and genre and six. See `shelf-filter-engine.js` for the descriptor shape.
 */

import { escapeHtml, escapeUrlAttr } from "../../utils/html-escape.js";
import {
	READING_STATUS_INFO,
	updateNovelInLibrary,
	novelLibrary,
} from "../../utils/novel-library.js";
import { loadImageWithCache } from "../../utils/image-cache.js";
import {
	resolveExportTemplate,
	formatExportFilename,
} from "../../utils/novel-copy-format.js";
import {
	applyThemeFromStorage,
	setupThemeListener,
} from "../../utils/theme-config.js";
// Side-effect import: watches body[data-bg-animation] and drives the canvas
// animations. The CSS-only ones arrive with shelf-page.css.
import "../../utils/bg-animation.js";
import {
	bindModalSwipeDismiss,
	createModalNavigationController,
	recoverMissingNovelById,
} from "../shared-shelf-helpers.js";
import { openInlineEditModal } from "../edit-modal.js";
import { debugError } from "../../utils/logger.js";
import {
	FILTER_KINDS,
	applyFilters,
	applySort,
	buildActiveChips,
	bucketReadingStatus,
	clearFilterValue,
	computeInsights,
	computeStats,
	createDefaultFilterState,
	deriveFilterOptions,
	loadFilterState,
	normalizeModalStatus,
	saveFilterState,
} from "./shelf-filter-engine.js";

// ── Toast ─────────────────────────────────────────────────────────────────────

/**
 * Show a transient message. Falls back to a self-styled element because shelf
 * pages do not share the library app's toast container.
 *
 * @param {string} message
 * @param {"success"|"error"|"info"} type
 */
export function showToast(message, type = "success") {
	const toast = document.createElement("div");
	toast.className = `toast toast-${type}`;
	toast.textContent = message;
	toast.style.cssText = `
		position: fixed; bottom: 20px; right: 20px;
		padding: 12px 24px; border-radius: 8px;
		color: white; font-weight: 500; z-index: 10000;
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

// ── Shelf runtime ─────────────────────────────────────────────────────────────

/**
 * Boot a shelf page.
 *
 * @param {object} descriptor - See `shelf-filter-engine.js` for the shape.
 * @returns {Promise<void>}
 */
export async function initShelfPage(descriptor) {
	const shelf = createShelfRuntime(descriptor);
	await shelf.start();
}

/**
 * Build the runtime for one descriptor. Split out from `initShelfPage` so the
 * closure state is explicit and every helper below can see it.
 *
 * @param {object} descriptor
 */
function createShelfRuntime(descriptor) {
	let allNovels = [];
	let filteredNovels = [];
	let filterState = createDefaultFilterState(descriptor);
	let filterOptions = {};

	const modalNavigation = createModalNavigationController({
		getContextIds: (novelId) => {
			const visible = filteredNovels.length ? filteredNovels : allNovels;
			const visibleIds = visible.map((n) => n.id);
			if (novelId && visibleIds.includes(novelId)) return visibleIds;
			const allIds = allNovels.map((n) => n.id);
			if (novelId && allIds.includes(novelId)) return allIds;
			return visibleIds.length ? visibleIds : allIds;
		},
		findNovelById: (novelId) =>
			filteredNovels.find((n) => n.id === novelId) ||
			allNovels.find((n) => n.id === novelId) ||
			null,
		onOpenNovel: (novel, options) => showNovelModal(novel, options),
	});

	// ── Filter UI ─────────────────────────────────────────────────────────────

	/**
	 * Render the filter dropdown from the descriptor. Static markup per site is
	 * what made these files diverge, so the grid is generated instead.
	 */
	function renderFilterControls() {
		const grid = document.getElementById("filter-grid");
		if (!grid) return;

		const sortOptions = (descriptor.sorts || [])
			.map(
				(s) =>
					`<option value="${escapeHtml(s.value)}">${escapeHtml(
						s.label,
					)}</option>`,
			)
			.join("");

		const blocks = [
			`<div class="filter-item" data-filter-item="sort">
				<label for="sort-select">Sort by:</label>
				<select id="sort-select">${sortOptions}</select>
			</div>`,
		];

		for (const filter of descriptor.filters || []) {
			if (filter.kind === FILTER_KINDS.SEARCH) continue;
			blocks.push(renderFilterBlock(filter));
		}

		blocks.push(`<div class="filter-item full-width">
			<button class="clear-filters-btn" id="clear-filters-btn">Clear All Filters</button>
		</div>`);

		grid.innerHTML = blocks.join("");
	}

	/**
	 * Markup for one non-search filter.
	 *
	 * @param {object} filter
	 * @returns {string}
	 */
	function renderFilterBlock(filter) {
		const id = `${filter.key}-filter`;
		const label = escapeHtml(filter.label);

		if (filter.kind === FILTER_KINDS.SELECT) {
			const options = filter.options
				? filter.options
						.map(
							(o) =>
								`<option value="${escapeHtml(
									o.value,
								)}">${escapeHtml(o.label)}</option>`,
						)
						.join("")
				: "";
			return `<div class="filter-item" data-filter-item="${escapeHtml(filter.key)}">
				<label for="${id}">${label}:</label>
				<select id="${id}">
					<option value="all">${escapeHtml(filter.allLabel || `All ${filter.label}`)}</option>
					${options}
				</select>
			</div>`;
		}

		const hint = filter.hint
			? `<p class="filter-hint">${escapeHtml(filter.hint)}</p>`
			: "";

		if (filter.kind === FILTER_KINDS.MULTI) {
			// Reuses the tag-match styling the hand-written pages already had.
			const modeSelect = filter.modeSelectable
				? `<div class="tag-match-row">
						<label class="tag-match-label" for="${filter.key}-mode">Match:</label>
						<select class="tag-match-select" id="${filter.key}-mode">
							<option value="any">Any (OR)</option>
							<option value="all">All (AND)</option>
						</select>
					</div>`
				: "";
			return `<div class="filter-item" data-filter-item="${escapeHtml(filter.key)}">
				<label>${label}:</label>
				<div class="multi-dropdown">
					<button type="button" class="multi-dropdown-toggle" id="${filter.key}-dropdown-toggle">${escapeHtml(
						filter.toggleLabel || `Choose ${filter.label}`,
					)}</button>
					<div class="multi-dropdown-panel" id="${filter.key}-dropdown-panel">
						${
							filter.searchable
								? `<input type="text" class="multi-dropdown-search" id="${filter.key}-pill-search" placeholder="Search ${escapeHtml(
										filter.label.toLowerCase(),
									)}..." />`
								: ""
						}
						${modeSelect}
						<div class="filter-pill-list" id="${id}"></div>
					</div>
				</div>
				${hint}
			</div>`;
		}

		if (filter.kind === FILTER_KINDS.RANGE) {
			// Ranges take the full row — both hand-written pages had them there.
			return `<div class="filter-item full-width" data-filter-item="${escapeHtml(filter.key)}">
				<label>${label}:</label>
				<div class="wordcount-row">
					<input type="number" min="0" id="${filter.key}-min" placeholder="Min" />
					<span class="range-separator">to</span>
					<input type="number" min="0" id="${filter.key}-max" placeholder="Max" />
				</div>
				${hint}
			</div>`;
		}

		return "";
	}

	/** Fill data-derived select options and pill lists. */
	function populateDynamicFilters() {
		filterOptions = deriveFilterOptions(descriptor, allNovels);

		for (const filter of descriptor.filters || []) {
			if (filter.kind === FILTER_KINDS.SELECT && !filter.options) {
				const select = document.getElementById(`${filter.key}-filter`);
				if (!select) continue;
				select.innerHTML =
					`<option value="all">${escapeHtml(
						filter.allLabel || `All ${filter.label}`,
					)}</option>` +
					(filterOptions[filter.key] || [])
						.map(
							(v) =>
								`<option value="${escapeHtml(v)}">${escapeHtml(
									v,
								)}</option>`,
						)
						.join("");
				select.value = filterState[filter.key] || "all";
			} else if (filter.kind === FILTER_KINDS.MULTI) {
				renderPillList(filter);
			}
		}
	}

	/**
	 * Render a multi filter's checkbox pills.
	 *
	 * @param {object} filter
	 */
	function renderPillList(filter) {
		const container = document.getElementById(`${filter.key}-filter`);
		if (!container) return;

		const items = filterOptions[filter.key] || [];
		if (!items.length) {
			container.innerHTML = `<span class="filter-chip">No ${escapeHtml(
				filter.label.toLowerCase(),
			)} found</span>`;
			return;
		}

		const selected = filterState[filter.key] || [];
		container.innerHTML = items
			.map((item) => {
				const safe = escapeHtml(item);
				const active = selected.includes(item);
				return `<label class="filter-pill ${active ? "active" : ""}" data-pill-value="${safe}">
					<input type="checkbox" value="${safe}" ${active ? "checked" : ""} />
					<span>${safe}</span>
				</label>`;
			})
			.join("");

		const boxes = [...container.querySelectorAll("input[type='checkbox']")];

		/**
		 * Some filters cap how many values can be picked at once (AO3's tag
		 * lists run to thousands). Past the cap the unchecked pills go dead
		 * rather than silently doing nothing.
		 */
		const enforceLimit = () => {
			if (!filter.maxSelection) return;
			const atLimit =
				(filterState[filter.key] || []).length >= filter.maxSelection;
			for (const box of boxes) {
				box.disabled = atLimit && !box.checked;
				box.closest(".filter-pill")?.classList.toggle(
					"disabled",
					box.disabled,
				);
			}
		};

		for (const input of boxes) {
			input.addEventListener("change", (e) => {
				const value = e.target.value;
				const current = new Set(filterState[filter.key] || []);
				if (e.target.checked) current.add(value);
				else current.delete(value);
				filterState[filter.key] = [...current];
				e.target
					.closest(".filter-pill")
					?.classList.toggle("active", e.target.checked);
				enforceLimit();
				persistAndRefresh();
			});
		}
		enforceLimit();

		if (filter.searchable) setupPillSearch(filter, boxes);
	}

	/**
	 * Wire the in-panel search box for filters with long option lists.
	 *
	 * @param {object} filter
	 * @param {HTMLInputElement[]} boxes
	 */
	function setupPillSearch(filter, boxes) {
		const search = document.getElementById(`${filter.key}-pill-search`);
		if (!search) return;
		search.oninput = () => {
			const query = search.value.trim().toLowerCase();
			for (const box of boxes) {
				const pill = box.closest(".filter-pill");
				if (!pill) continue;
				pill.style.display =
					!query || box.value.toLowerCase().includes(query)
						? ""
						: "none";
			}
		};
	}

	/** Push `filterState` back into the controls after a programmatic change. */
	function applyFilterStateToUI() {
		for (const filter of descriptor.filters || []) {
			if (filter.kind === FILTER_KINDS.SEARCH) {
				const input = document.getElementById("search-input");
				if (input) input.value = filterState[filter.key] || "";
			} else if (filter.kind === FILTER_KINDS.SELECT) {
				const select = document.getElementById(`${filter.key}-filter`);
				if (select) select.value = filterState[filter.key] || "all";
			} else if (filter.kind === FILTER_KINDS.MULTI) {
				// Re-rendering keeps checked, active and disabled in step; doing
				// it by hand is what let the old pages drift out of sync.
				renderPillList(filter);
				if (filter.modeSelectable) {
					const mode = document.getElementById(`${filter.key}-mode`);
					if (mode)
						mode.value =
							filterState[`${filter.key}Mode`] ||
							filter.mode ||
							"any";
				}
			} else if (filter.kind === FILTER_KINDS.RANGE) {
				const min = document.getElementById(`${filter.key}-min`);
				const max = document.getElementById(`${filter.key}-max`);
				if (min) min.value = filterState[`${filter.key}Min`] || "";
				if (max) max.value = filterState[`${filter.key}Max`] || "";
			}
		}
		const sortSelect = document.getElementById("sort-select");
		if (sortSelect) sortSelect.value = filterState.sort;
		renderActiveFilters();
	}

	/** Render the removable chips that summarise active filters. */
	function renderActiveFilters() {
		updateDropdownLabels();

		const container = document.getElementById("active-filters");
		if (!container) return;

		const chips = buildActiveChips(descriptor, filterState);
		container.innerHTML = "";
		for (const chip of chips) {
			const el = document.createElement("span");
			el.className = "filter-chip";
			el.innerHTML = `<strong>${escapeHtml(
				chip.label,
			)}</strong> <button aria-label="Clear filter" data-key="${escapeHtml(
				chip.key,
			)}" data-value="${escapeHtml(chip.value || "")}">×</button>`;
			container.appendChild(el);
		}

		container.querySelectorAll("button").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				filterState = clearFilterValue(
					descriptor,
					filterState,
					btn.dataset.key,
					btn.dataset.value,
				);
				applyFilterStateToUI();
				persistAndRefresh();
			});
		});

		const badge = document.getElementById("filter-badge");
		if (badge) {
			badge.textContent = String(chips.length);
			badge.style.display = chips.length > 0 ? "inline-block" : "none";
		}
	}

	/** Show selection counts on the multi-dropdown toggles. */
	function updateDropdownLabels() {
		for (const filter of descriptor.filters || []) {
			if (filter.kind !== FILTER_KINDS.MULTI) continue;
			const toggle = document.getElementById(
				`${filter.key}-dropdown-toggle`,
			);
			if (!toggle) continue;
			const base = filter.toggleLabel || `Choose ${filter.label}`;
			const count = (filterState[filter.key] || []).length;
			toggle.textContent = count > 0 ? `${base} (${count})` : base;
		}
	}

	/** Wire every filter control. Called once, after `renderFilterControls`. */
	function setupFilterListeners() {
		const searchFilter = (descriptor.filters || []).find(
			(f) => f.kind === FILTER_KINDS.SEARCH,
		);
		const searchInput = document.getElementById("search-input");
		if (searchFilter && searchInput) {
			searchInput.value = filterState[searchFilter.key] || "";
			let debounce;
			searchInput.addEventListener("input", (e) => {
				clearTimeout(debounce);
				const value = e.target.value.trim();
				debounce = setTimeout(() => {
					filterState[searchFilter.key] = value;
					persistAndRefresh();
				}, 200);
			});
		}

		const sortSelect = document.getElementById("sort-select");
		if (sortSelect) {
			sortSelect.value = filterState.sort;
			sortSelect.addEventListener("change", (e) => {
				filterState.sort = e.target.value;
				persistAndRefresh();
			});
		}

		for (const filter of descriptor.filters || []) {
			if (filter.kind === FILTER_KINDS.SELECT) {
				const select = document.getElementById(`${filter.key}-filter`);
				if (!select) continue;
				select.value = filterState[filter.key] || "all";
				select.addEventListener("change", (e) => {
					filterState[filter.key] = e.target.value;
					persistAndRefresh();
				});
			} else if (filter.kind === FILTER_KINDS.MULTI) {
				setupMultiDropdown(filter);
			} else if (filter.kind === FILTER_KINDS.RANGE) {
				for (const bound of ["Min", "Max"]) {
					const input = document.getElementById(
						`${filter.key}-${bound.toLowerCase()}`,
					);
					if (!input) continue;
					input.value = filterState[`${filter.key}${bound}`] || "";
					let debounce;
					input.addEventListener("input", (e) => {
						clearTimeout(debounce);
						const value = e.target.value;
						debounce = setTimeout(() => {
							filterState[`${filter.key}${bound}`] = value;
							persistAndRefresh();
						}, 250);
					});
				}
			}
		}

		const clearBtn = document.getElementById("clear-filters-btn");
		if (clearBtn) {
			clearBtn.addEventListener("click", () => {
				filterState = createDefaultFilterState(descriptor);
				applyFilterStateToUI();
				populateDynamicFilters();
				persistAndRefresh();
				closeFilterDropdown();
			});
		}

		setupFilterPanelToggle();
	}

	/**
	 * Open/close behaviour for a multi filter's pill panel, plus its optional
	 * search box and match-mode select.
	 *
	 * @param {object} filter
	 */
	function setupMultiDropdown(filter) {
		const toggle = document.getElementById(`${filter.key}-dropdown-toggle`);
		const panel = document.getElementById(`${filter.key}-dropdown-panel`);
		if (toggle && panel) {
			panel.style.display = "none";
			toggle.addEventListener("click", (e) => {
				e.stopPropagation();
				panel.style.display =
					panel.style.display === "block" ? "none" : "block";
			});
		}

		const search = document.getElementById(`${filter.key}-pill-search`);
		if (search) {
			search.addEventListener("input", (e) => {
				const query = e.target.value.trim().toLowerCase();
				document
					.querySelectorAll(
						`#${CSS.escape(`${filter.key}-filter`)} .filter-pill`,
					)
					.forEach((pill) => {
						const value = (
							pill.dataset.pillValue || ""
						).toLowerCase();
						pill.style.display = value.includes(query)
							? ""
							: "none";
					});
			});
		}

		if (filter.modeSelectable) {
			const mode = document.getElementById(`${filter.key}-mode`);
			if (mode) {
				mode.value =
					filterState[`${filter.key}Mode`] || filter.mode || "any";
				mode.addEventListener("change", (e) => {
					filterState[`${filter.key}Mode`] = e.target.value;
					persistAndRefresh();
				});
			}
		}
	}

	/** Close the filter dropdown and every pill panel inside it. */
	function closeFilterDropdown() {
		const dropdown = document.getElementById("filter-dropdown");
		const toggle = document.getElementById("filter-toggle-btn");
		if (dropdown) dropdown.style.display = "none";
		if (toggle) toggle.classList.remove("active");
		document
			.querySelectorAll(".multi-dropdown-panel")
			.forEach((panel) => (panel.style.display = "none"));
	}

	/** The ⚙ Filters button, its positioning, and outside-click dismissal. */
	function setupFilterPanelToggle() {
		const toggle = document.getElementById("filter-toggle-btn");
		const dropdown = document.getElementById("filter-dropdown");
		if (!toggle || !dropdown) return;

		dropdown.style.display = "none";

		toggle.addEventListener("click", () => {
			if (dropdown.style.display !== "none") {
				closeFilterDropdown();
				return;
			}
			dropdown.style.display = "block";
			positionFilterDropdown();
			toggle.classList.add("active");
		});

		window.addEventListener("resize", () => {
			if (dropdown.style.display !== "none") positionFilterDropdown();
		});

		document.addEventListener("click", (e) => {
			if (dropdown.style.display === "none") return;
			if (dropdown.contains(e.target) || toggle.contains(e.target))
				return;
			closeFilterDropdown();
		});
	}

	/** Keep the dropdown on screen regardless of where the button sits. */
	function positionFilterDropdown() {
		const dropdown = document.getElementById("filter-dropdown");
		const button = document.getElementById("filter-toggle-btn");
		if (!dropdown || !button) return;

		const buttonRect = button.getBoundingClientRect();
		const pad = 12;
		const measured = dropdown.offsetWidth || 380;
		const width = Math.min(
			Math.max(measured, 280),
			window.innerWidth - pad * 2,
		);
		dropdown.style.width = `${width}px`;

		const height = dropdown.offsetHeight || 0;
		let left = buttonRect.right - width;
		left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
		let top = buttonRect.bottom + 8;
		if (top + height > window.innerHeight - pad) {
			const spaceAbove = buttonRect.top - 8;
			if (spaceAbove >= height) top = buttonRect.top - height - 8;
		}

		dropdown.style.position = "fixed";
		dropdown.style.left = `${left}px`;
		dropdown.style.right = "auto";
		dropdown.style.top = `${Math.max(pad, top)}px`;
		dropdown.style.bottom = "auto";
	}

	// ── Filter / sort / render cycle ──────────────────────────────────────────

	/** Persist the current filters, then re-filter, re-render and re-summarise. */
	function persistAndRefresh() {
		saveFilterState(descriptor, filterState);
		refresh();
	}

	function refresh() {
		filteredNovels = applySort(
			descriptor,
			applyFilters(descriptor, allNovels, filterState),
			filterState.sort,
		);
		renderActiveFilters();
		renderFilterSection();
		renderNovels();
		renderAnalytics(filteredNovels);
	}

	/**
	 * Draw the optional extra block a site declares inside its filter panel —
	 * today only the AO3/FanFiction fandom browser. It is redrawn on every
	 * refresh so it can never disagree with the filter state, which is exactly
	 * how the hand-written versions used to drift.
	 */
	function renderFilterSection() {
		const section = descriptor.filterSection;
		if (typeof section?.render !== "function") return;
		const container = document.getElementById(section.containerId);
		if (!container) return;
		section.render(container, {
			novels: allNovels,
			filteredNovels,
			filterState,
			setFilters: (patch) => {
				Object.assign(filterState, patch);
				applyFilterStateToUI();
				persistAndRefresh();
			},
		});
	}

	/** Draw the card grid, or the empty state when nothing matches. */
	function renderNovels() {
		const grid = document.getElementById("novel-grid");
		const emptyState = document.getElementById("empty-state");
		const loadingState = document.getElementById("loading-state");
		const novelCount = document.getElementById("novel-count");
		if (!grid) return;

		if (loadingState) loadingState.style.display = "none";

		if (!filteredNovels.length) {
			grid.style.display = "none";
			if (emptyState) emptyState.style.display = "block";
			if (novelCount) novelCount.textContent = "(0 novels)";
			return;
		}

		if (emptyState) emptyState.style.display = "none";
		grid.style.display = "grid";
		grid.innerHTML = "";

		for (const novel of filteredNovels) {
			try {
				grid.appendChild(descriptor.cardRenderer.renderCard(novel));
			} catch (error) {
				debugError(
					`[${descriptor.shelfId}] card render failed:`,
					error,
				);
				grid.appendChild(buildFallbackCard(novel));
			}
		}

		if (novelCount) {
			novelCount.textContent = `(${filteredNovels.length} ${
				filteredNovels.length === 1 ? "novel" : "novels"
			})`;
		}
	}

	/**
	 * Minimal card used when a site renderer throws, so one bad record cannot
	 * blank the whole shelf.
	 *
	 * @param {object} novel
	 * @returns {HTMLElement}
	 */
	function buildFallbackCard(novel) {
		const card = document.createElement("div");
		card.className = "novel-card";
		card.dataset.novelId = novel.id;
		card.innerHTML = `<div class="novel-card-info">
			<h3 class="novel-title">${escapeHtml(novel.title || "Untitled")}</h3>
			<p class="novel-author">${escapeHtml(novel.author || "Unknown")}</p>
		</div>`;
		card.addEventListener("click", () => showNovelModal(novel));
		return card;
	}

	// ── Analytics ─────────────────────────────────────────────────────────────

	/** Build the stat cards and insight rows the descriptor declares. */
	function renderAnalyticsScaffold() {
		const stats = document.getElementById("stats-summary");
		if (stats && (descriptor.stats || []).length) {
			stats.innerHTML = descriptor.stats
				.map(
					(stat) => `<div class="stat-card">
						<span class="stat-value" id="${escapeHtml(stat.id)}">0</span>
						<span class="stat-label">${escapeHtml(stat.label)}</span>
					</div>`,
				)
				.join("");
		}

		const insights = document.getElementById("analytics-items");
		if (insights && (descriptor.insights || []).length) {
			insights.innerHTML = descriptor.insights
				.map(
					(insight) => `<div class="analytics-item">
						<span class="analytics-icon">${escapeHtml(insight.icon || "\u{1F4D6}")}</span>
						<div class="analytics-detail">
							<span class="analytics-label">${escapeHtml(insight.label)}</span>
							<span class="analytics-value" id="${escapeHtml(insight.id)}">-</span>
						</div>
					</div>`,
				)
				.join("");
			setupInsightClicks();
		}
	}

	/**
	 * Recompute every stat, insight and the status chart.
	 *
	 * @param {object[]} novels - The currently visible set.
	 */
	function renderAnalytics(novels) {
		const stats = computeStats(descriptor, novels);
		for (const [id, value] of Object.entries(stats)) {
			const el = document.getElementById(id);
			if (el) el.textContent = value;
		}

		const insights = computeInsights(descriptor, novels);
		for (const [id, result] of Object.entries(insights)) {
			setInsightTarget(id, result.novel, result.text);
		}

		renderReadingStatusChart(bucketReadingStatus(novels), novels.length);
	}

	/**
	 * Point an insight card at a novel, making it clickable only when there is
	 * something to open.
	 *
	 * @param {string} valueId
	 * @param {object|null} novel
	 * @param {string} text
	 */
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

	/** Delegate clicks and keyboard activation on the insight list. */
	function setupInsightClicks() {
		const container = document.querySelector(".analytics-items");
		if (!container || container.dataset.bound === "true") return;
		container.dataset.bound = "true";

		const openFromItem = (item) => {
			if (!item?.dataset?.novelId) return;
			const novel = allNovels.find((n) => n.id === item.dataset.novelId);
			if (novel) showNovelModal(novel);
		};

		container.addEventListener("click", (e) =>
			openFromItem(e.target.closest(".analytics-item")),
		);
		container.addEventListener("keydown", (e) => {
			if (e.key !== "Enter" && e.key !== " ") return;
			const item = e.target.closest(".analytics-item");
			if (!item?.dataset?.novelId) return;
			e.preventDefault();
			openFromItem(item);
		});
	}

	/**
	 * Stacked bar of reading statuses plus its legend.
	 *
	 * @param {Object<string, number>} buckets
	 * @param {number} total
	 */
	function renderReadingStatusChart(buckets, total) {
		const chart = document.getElementById("reading-status-chart");
		const legend = document.getElementById("reading-status-legend");
		const summary = document.getElementById("status-chart-summary");
		if (!chart || !legend) return;

		chart.innerHTML = "";
		legend.innerHTML = "";

		const totalCount =
			total || Object.values(buckets).reduce((s, v) => s + v, 0);
		const entries = Object.entries(buckets).filter(([, c]) => c > 0);

		if (!entries.length || !totalCount) {
			if (summary) summary.textContent = "No novels yet";
			return;
		}

		const parts = [];
		for (const [key, count] of entries) {
			const info = READING_STATUS_INFO[key] || {};
			const label = info.label || key.replace(/[-_]/g, " ");
			const color = info.color || "var(--primary-color)";

			const segment = document.createElement("div");
			segment.className = "bar-segment";
			segment.style.background = color;
			segment.style.flex = String(count);
			segment.title = `${label}: ${count}`;
			chart.appendChild(segment);

			const pct = Math.round((count / totalCount) * 100);
			const legendItem = document.createElement("div");
			legendItem.className = "bar-legend-item";
			legendItem.innerHTML = `<span class="legend-swatch" style="background:${escapeHtml(
				color,
			)}"></span><span>${escapeHtml(label)} (${pct}%)</span>`;
			legend.appendChild(legendItem);

			parts.push(`${count.toLocaleString()} ${label}`);
		}

		if (summary) summary.textContent = parts.join(" • ");
	}

	// ── Detail modal ──────────────────────────────────────────────────────────

	/**
	 * Open the novel detail modal.
	 *
	 * @param {object} novel
	 * @param {{contextIds?: string[]}} [options]
	 */
	function showNovelModal(novel, options = {}) {
		const modal = document.getElementById("novel-modal");
		if (!modal) return;

		modalNavigation.syncContext(novel.id, options.contextIds);
		rememberOpenNovelInUrl(novel.id);

		setText("modal-title", novel.title || "");
		renderModalAuthor(novel);
		renderModalDescription(novel);
		renderModalCover(novel);
		renderModalProgress(novel);
		wireModalActions(novel, modal);
		wireModalStatusButtons(novel);

		if (
			typeof descriptor.cardRenderer?.renderModalMetadata === "function"
		) {
			descriptor.cardRenderer.renderModalMetadata(novel);
		}
		if (typeof descriptor.renderModalExtras === "function") {
			descriptor.renderModalExtras(novel, { showToast });
		}

		modal.style.display = "flex";
		bindModalDismissal(modal);
	}

	/** Keep the open novel in the URL so the page can be reloaded or shared. */
	function rememberOpenNovelInUrl(novelId) {
		try {
			const params = new URLSearchParams(window.location.search);
			params.set("novel", novelId);
			params.set("openModal", "1");
			history.replaceState(
				null,
				"",
				`${window.location.pathname}?${params.toString()}`,
			);
		} catch (_error) {
			// A failed history write must not block the modal.
		}
	}

	function setText(id, text) {
		const el = document.getElementById(id);
		if (el) el.textContent = text;
	}

	function renderModalAuthor(novel) {
		const el = document.getElementById("modal-author");
		if (!el) return;
		const authorUrl = novel.metadata?.authorUrl;
		if (authorUrl) {
			el.innerHTML = `<a href="${escapeUrlAttr(
				authorUrl,
			)}" target="_blank" rel="noreferrer">${escapeHtml(
				novel.author || "Unknown",
			)}</a>`;
		} else {
			el.textContent = novel.author || "Unknown";
		}
	}

	function renderModalDescription(novel) {
		const el = document.getElementById("modal-description");
		if (!el) return;
		el.textContent = "";
		if (!novel.description) return;
		const lines = novel.description.split(/\n/);
		lines.forEach((line, i) => {
			el.appendChild(document.createTextNode(line));
			if (i < lines.length - 1)
				el.appendChild(document.createElement("br"));
		});
	}

	function renderModalCover(novel) {
		const img = document.getElementById("modal-cover");
		if (!img) return;
		const url = novel.coverUrl || novel.coverImage;
		if (!url) {
			img.style.display = "none";
			return;
		}
		img.style.display = "block";
		img.addEventListener("error", () => {
			img.style.display = "none";
		});
		loadImageWithCache(img, url).catch(() => {});
	}

	function renderModalProgress(novel) {
		const total = novel.totalChapters || novel.metadata?.totalChapters || 0;
		const read = novel.lastReadChapter || novel.currentChapter || 0;
		const pct =
			total > 0 ? Math.min(Math.round((read / total) * 100), 100) : 0;
		const fill = document.getElementById("modal-progress-fill");
		const text = document.getElementById("modal-progress-text");
		if (fill) fill.style.width = `${pct}%`;
		if (text)
			text.textContent =
				total > 0 ? `Ch. ${read} / ${total} (${pct}%)` : "";
	}

	/**
	 * Wire the modal's action buttons. Handlers are assigned rather than added
	 * so reopening the modal for another novel replaces them.
	 *
	 * @param {object} novel
	 * @param {HTMLElement} modal
	 */
	function wireModalActions(novel, modal) {
		const continueBtn = document.getElementById("modal-continue-btn");
		if (continueBtn) {
			const url = novel.lastReadUrl || novel.sourceUrl;
			if (url) {
				continueBtn.href = url;
				continueBtn.style.display = "inline-flex";
			} else {
				continueBtn.style.display = "none";
			}
		}

		const readBtn = document.getElementById("modal-read-btn");
		if (readBtn && novel.sourceUrl) readBtn.href = novel.sourceUrl;

		const refreshBtn = document.getElementById("modal-refresh-btn");
		if (refreshBtn) {
			refreshBtn.onclick = () => {
				refreshNovelMetadata(novel);
				modal.style.display = "none";
			};
		}

		const editBtn = document.getElementById("modal-edit-btn");
		if (editBtn) {
			editBtn.onclick = () => {
				openEditModal(novel);
				modal.style.display = "none";
			};
		}

		const removeBtn = document.getElementById("modal-remove-btn");
		if (removeBtn) {
			removeBtn.onclick = async () => {
				if (
					!confirm(
						`Are you sure you want to remove "${novel.title}" from your library?`,
					)
				) {
					return;
				}
				await removeNovelFromLibrary(novel.id);
				modal.style.display = "none";
			};
		}

		for (const id of [
			"modal-open-library-btn",
			"modal-open-library-header-btn",
		]) {
			const btn = document.getElementById(id);
			if (!btn) continue;
			btn.onclick = () => {
				window.open(
					browser.runtime.getURL(
						`library/library.html?novel=${encodeURIComponent(
							novel.id,
						)}&openModal=1`,
					),
					"_blank",
				);
			};
		}

		const copyBtn = document.getElementById("modal-copy-info-btn");
		if (copyBtn) {
			copyBtn.onclick = async () => {
				try {
					const settings = await novelLibrary.getSettings();
					const template = resolveExportTemplate(
						settings?.novelCopyFormats,
						novel.shelfId,
					);
					await navigator.clipboard.writeText(
						formatExportFilename(novel, template),
					);
					flashButton(copyBtn, "✅ Copied!", "📋 Copy Name");
				} catch (_error) {
					flashButton(copyBtn, "❌ Failed", "📋 Copy Name");
				}
			};
		}
	}

	/**
	 * Briefly swap a button's label to acknowledge an action.
	 *
	 * @param {HTMLElement} button
	 * @param {string} temporary
	 * @param {string} restored
	 */
	function flashButton(button, temporary, restored) {
		button.textContent = temporary;
		setTimeout(() => {
			button.textContent = restored;
		}, 2000);
	}

	function wireModalStatusButtons(novel) {
		const buttons = document.querySelectorAll(".status-btn");
		const current = normalizeModalStatus(novel.readingStatus);
		buttons.forEach((btn) => {
			const status = normalizeModalStatus(
				btn.getAttribute("data-status"),
			);
			btn.classList.toggle("active", status === current);
			btn.onclick = async () => {
				const updated = { ...novel, readingStatus: status };
				await updateNovelInLibrary(updated);
				replaceNovelInPlace(updated);
				refresh();
				buttons.forEach((b) => {
					b.classList.toggle(
						"active",
						normalizeModalStatus(b.getAttribute("data-status")) ===
							status,
					);
				});
			};
		});
	}

	/**
	 * Swap an updated novel into both working arrays so the UI reflects the
	 * change without a full reload from storage.
	 *
	 * @param {object} updated
	 */
	function replaceNovelInPlace(updated) {
		const i = allNovels.findIndex((n) => n?.id === updated.id);
		if (i >= 0) allNovels[i] = updated;
		const f = filteredNovels.findIndex((n) => n?.id === updated.id);
		if (f >= 0) filteredNovels[f] = updated;
	}

	/** Close on backdrop click, the close button, Escape, or a swipe down. */
	function bindModalDismissal(modal) {
		const close = () => {
			modal.style.display = "none";
		};

		const closeBtn = document.getElementById("modal-close-btn");
		const backdrop = document.getElementById("modal-backdrop");
		if (closeBtn) closeBtn.onclick = close;
		if (backdrop) backdrop.onclick = close;

		if (typeof modal._swipeCleanup === "function") modal._swipeCleanup();
		modal._swipeCleanup = bindModalSwipeDismiss({
			modal,
			onDismiss: close,
		});

		if (!modal.dataset.escapeBound) {
			modal.dataset.escapeBound = "1";
			document.addEventListener("keydown", (e) => {
				if (e.key === "Escape" && modal.style.display !== "none")
					close();
			});
		}
	}

	// ── Library operations ────────────────────────────────────────────────────

	async function removeNovelFromLibrary(novelId) {
		try {
			const result = await browser.storage.local.get("rg_novel_library");
			const library = result.rg_novel_library || { novels: {} };
			if (!library.novels?.[novelId]) return;
			delete library.novels[novelId];
			await browser.storage.local.set({ rg_novel_library: library });
			allNovels = allNovels.filter((n) => n.id !== novelId);
			refresh();
			showToast("Novel removed from library", "success");
		} catch (error) {
			debugError(`[${descriptor.shelfId}] remove failed:`, error);
			showToast("Failed to remove novel", "error");
		}
	}

	/** Metadata refresh happens on the source page, so open it. */
	function refreshNovelMetadata(novel) {
		const url = novel?.sourceUrl || novel?.url || "";
		if (!url) {
			showToast("No source URL available for refresh", "error");
			return;
		}
		window.open(url, "_blank", "noopener,noreferrer");
		showToast("Opened source page to refresh metadata", "info");
	}

	function openEditModal(novel) {
		if (!novel?.id) {
			showToast("Missing novel id for edit", "error");
			return;
		}
		openInlineEditModal(novel, descriptor.handler, {
			onSaved: (updated) => {
				replaceNovelInPlace(updated);
				refresh();
			},
			showToast,
		});
	}

	// ── Deep links ────────────────────────────────────────────────────────────

	/**
	 * Honour `?novel=<id>`; when the id is not on this shelf, offer to import it
	 * rather than silently showing nothing.
	 */
	function openNovelFromQuery() {
		let novelId = null;
		try {
			novelId = new URLSearchParams(window.location.search).get("novel");
		} catch (_error) {
			return;
		}
		if (!novelId) return;

		const novel = allNovels.find((n) => n?.id === novelId);
		if (novel) {
			showNovelModal(novel);
			return;
		}

		recoverMissingNovelById(novelId, {
			showToast,
			onImported: async (result) => {
				if (result?.shelfId && result.shelfId !== descriptor.shelfId) {
					window.open(
						browser.runtime.getURL(
							`library/websites/${result.shelfId}/index.html?novel=${encodeURIComponent(
								novelId,
							)}&openModal=1`,
						),
						"_blank",
					);
					return;
				}
				await loadNovels();
				const imported = allNovels.find((n) => n?.id === novelId);
				refresh();
				if (imported) showNovelModal(imported);
			},
		});
	}

	// ── Startup ───────────────────────────────────────────────────────────────

	/** Read this shelf's novels out of storage. */
	async function loadNovels() {
		const storage = await browser.storage.local.get("rg_novel_library");
		const novels = storage.rg_novel_library?.novels || {};
		allNovels = Object.values(novels).filter(
			(n) => n && n.shelfId === descriptor.shelfId,
		);
	}

	/** Respect the library-wide "hide the filter toolbar" display options. */
	async function applyDisplaySettings() {
		const result = await browser.storage.local.get("libraryDisplayOptions");
		const options = {
			showFilterToolbar: true,
			showSortFilter: true,
			showStatusFilter: true,
			showActiveFilters: true,
			...(result.libraryDisplayOptions || {}),
		};

		const container = document.querySelector(".filter-dropdown-container");
		if (!container) return;
		if (!options.showFilterToolbar) {
			container.style.display = "none";
			return;
		}

		const hide = (selector, visible) => {
			const el = document.querySelector(selector);
			if (el) el.style.display = visible ? "" : "none";
		};
		hide('[data-filter-item="sort"]', options.showSortFilter);
		hide('[data-filter-item="readingStatus"]', options.showStatusFilter);
		hide("#active-filters", options.showActiveFilters);
	}

	/** Swap the site favicon for the text fallback if the image 404s. */
	function setupFaviconFallback() {
		const img = document.getElementById("page-icon-img");
		const fallback = document.getElementById("page-icon");
		if (!img) return;
		img.addEventListener("error", () => {
			img.style.display = "none";
			if (fallback) fallback.style.display = "inline-block";
		});
	}

	/**
	 * Add the "pick one for me" button beside the search bar. Opt-in via
	 * `descriptor.randomPick` because not every shelf wants the extra control.
	 */
	function setupRandomPick() {
		if (!descriptor.randomPick) return;
		const searchInput = document.getElementById("search-input");
		if (!searchInput || document.getElementById("random-select-btn"))
			return;
		const container = searchInput.parentElement;
		if (!container) return;

		const button = document.createElement("button");
		button.type = "button";
		button.id = "random-select-btn";
		button.className = "btn btn-secondary random-select-btn";
		button.textContent = "\u{1F3B2} Random";
		button.title = "Pick a random novel from current filters";
		button.addEventListener("click", () => {
			const pool = filteredNovels.length ? filteredNovels : allNovels;
			if (!pool.length) {
				showToast("No novels available for random pick", "info");
				return;
			}
			showNovelModal(pool[Math.floor(Math.random() * pool.length)]);
		});

		container.insertBefore(button, searchInput);
	}

	/** Reload when the library changes in another tab. */
	function watchLibraryChanges() {
		if (typeof browser === "undefined" || !browser.storage?.onChanged)
			return;
		browser.storage.onChanged.addListener(async (changes, area) => {
			if (area !== "local" || !changes.rg_novel_library) return;
			await loadNovels();
			populateDynamicFilters();
			refresh();
		});
	}

	async function start() {
		await applyThemeFromStorage();
		setupThemeListener();
		setupFaviconFallback();

		const loadingState = document.getElementById("loading-state");
		const emptyState = document.getElementById("empty-state");

		try {
			await loadNovels();
			filterState = loadFilterState(descriptor);

			renderAnalyticsScaffold();
			renderFilterControls();
			populateDynamicFilters();
			setupFilterListeners();
			applyFilterStateToUI();
			setupRandomPick();
			await applyDisplaySettings();

			// Card clicks open the detail modal rather than the default event.
			descriptor.cardRenderer.onCardClick = (novel) =>
				showNovelModal(novel);

			refresh();
			modalNavigation.bind();
			watchLibraryChanges();
			openNovelFromQuery();
		} catch (error) {
			debugError(`[${descriptor.shelfId}] init failed:`, error);
			if (loadingState) loadingState.style.display = "none";
			if (emptyState) {
				emptyState.style.display = "block";
				const heading = emptyState.querySelector("h2");
				if (heading) heading.textContent = `Error: ${error.message}`;
			}
		}
	}

	return { start };
}
