/**
 * @fileoverview The fandom browser shared by the AO3 and FanFiction shelves.
 *
 * Both sites shipped their own ~200-line copy of this. They agreed on the
 * markup and disagreed on the behaviour: AO3's cards toggled the real
 * `fandoms` filter, while FanFiction's called `renderNovels(subset)` directly,
 * so its grid could disagree with the active filters, showed no chip, and
 * forgot the choice on reload. The unified version keeps AO3's behaviour —
 * every click goes through the normal filter state.
 *
 * The old "Choose Fandoms" floating panel is gone: it toggled an `.open` class
 * no stylesheet ever defined, so the panel was permanently open. The view
 * toggle now does the job it was always labelled for — a compact list or a card
 * grid — and only one of the two is on screen at a time.
 */

import { escapeHtml } from "../../utils/html-escape.js";

/**
 * Build a filter-section descriptor for the shelf core.
 *
 * @param {object} [options]
 * @param {string} [options.key] - Multi-filter key the cards drive.
 * @param {string} [options.modeKey] - Filter-state key holding any/all.
 * @param {string} [options.viewKey] - Filter-state key holding list/grid.
 * @param {number} [options.maxSelection] - Cap on simultaneous selections.
 * @param {number} [options.limit] - How many cards the grid shows.
 * @param {string} [options.title] - Heading above the browser.
 * @param {(novel: object) => string[]} [options.values] - Value extractor.
 * @returns {{containerId: string, render: Function}}
 */
export function createFandomNav(options = {}) {
	const {
		key = "fandoms",
		modeKey = `${key}Mode`,
		viewKey = `${key}View`,
		maxSelection = 2,
		limit = 60,
		title = "Browse by Fandom",
		values = (novel) => novel.metadata?.fandoms || [],
	} = options;

	return {
		containerId: "fandom-filter-section",

		/**
		 * @param {HTMLElement} container
		 * @param {object} api - `{novels, filteredNovels, filterState, setFilters}`
		 */
		render(container, api) {
			const selected = api.filterState[key] || [];
			const mode = api.filterState[modeKey] || "any";
			const view = api.filterState[viewKey] || "dropdown";

			// Under "all" the counts come from what is already on screen: an
			// unselected fandom that cannot co-occur with the current picks
			// would otherwise advertise matches it can never produce.
			const counts = countValues(
				mode === "all" ? api.filteredNovels : api.novels,
				values,
			);

			if (!counts.size) {
				container.innerHTML = "";
				container.style.display = "none";
				return;
			}
			container.style.display = "";

			const sorted = [...counts.entries()].sort(
				(a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
			);

			container.innerHTML = buildMarkup({
				title,
				mode,
				view,
				sorted,
				selected,
				limit,
				hasSelection: selected.length > 0,
			});

			wire(container, api, {
				key,
				modeKey,
				viewKey,
				maxSelection,
				selected,
			});
		},
	};
}

/**
 * @param {object[]} novels
 * @param {(novel: object) => string[]} values
 * @returns {Map<string, number>}
 */
function countValues(novels, values) {
	const counts = new Map();
	for (const novel of novels) {
		for (const value of values(novel) || []) {
			if (!value) continue;
			counts.set(value, (counts.get(value) || 0) + 1);
		}
	}
	return counts;
}

/**
 * @param {object} view
 * @returns {string}
 */
function buildMarkup(view) {
	const cards = view.sorted
		.slice(0, view.limit)
		.map(([value, count]) => {
			const safe = escapeHtml(value);
			const active = view.selected.includes(value);
			return `<button type="button" class="fandom-card ${
				active ? "selected" : ""
			}" data-fandom-value="${safe}" aria-pressed="${active}">
				<span class="fandom-name">${safe}</span>
				<span class="fandom-count">${count} ${count === 1 ? "work" : "works"}</span>
			</button>`;
		})
		.join("");

	const pills = view.sorted
		.map(([value, count]) => {
			const safe = escapeHtml(value);
			const active = view.selected.includes(value);
			return `<label class="filter-pill ${
				active ? "active" : ""
			}" data-pill-value="${safe}">
				<input type="checkbox" value="${safe}" ${active ? "checked" : ""} />
				<span class="pill-label">${safe}</span>
				<span class="pill-count">${count}</span>
			</label>`;
		})
		.join("");

	// Only the grid is capped — the list is scrollable, so it can show all.
	const hidden = Math.max(0, view.sorted.length - view.limit);
	const overflow =
		view.view === "grid" && hidden
			? `<p class="filter-hint">Showing the top ${view.limit} of ${view.sorted.length}. Switch to the list view for the rest.</p>`
			: "";

	return `<div class="fandom-grid-header">
			<h4 class="fandom-grid-title">${escapeHtml(view.title)}</h4>
			<div class="fandom-grid-controls">
				<select id="fandom-match-mode" class="fandom-match-select" title="Filter mode">
					<option value="any" ${view.mode === "any" ? "selected" : ""}>Match ANY</option>
					<option value="all" ${view.mode === "all" ? "selected" : ""}>Match ALL</option>
				</select>
				<div class="fandom-view-toggle" role="group" aria-label="Fandom view">
					<button type="button" class="view-toggle-btn ${
						view.view === "dropdown" ? "active" : ""
					}" data-view="dropdown" title="List view">&#9776;</button>
					<button type="button" class="view-toggle-btn ${
						view.view === "grid" ? "active" : ""
					}" data-view="grid" title="Grid view">&#9638;</button>
				</div>
			</div>
			<div class="fandom-grid-actions">
				<button type="button" id="clear-fandoms" class="clear-fandoms-btn" ${
					view.hasSelection ? "" : 'style="display: none;"'
				}>Clear Selection</button>
			</div>
		</div>
		<input type="text" class="multi-dropdown-search" id="fandom-nav-search" placeholder="Search fandoms..." />
		<div class="fandom-grid-container" data-view="${escapeHtml(view.view)}">
			<div class="fandom-grid">${cards}</div>
		</div>
		<div class="filter-pill-list fandom-dropdown-list" data-view="${escapeHtml(
			view.view,
		)}">${pills}</div>
		${overflow}`;
}

/**
 * Attach the listeners for one rendered pass. The core re-renders the section
 * after every state change, so nothing here has to update the markup itself.
 *
 * @param {HTMLElement} container
 * @param {object} api
 * @param {object} config
 */
function wire(container, api, config) {
	const { key, modeKey, viewKey, maxSelection, selected } = config;

	const toggle = (value, wanted) => {
		if (
			wanted &&
			selected.length >= maxSelection &&
			!selected.includes(value)
		) {
			return;
		}
		const next = wanted
			? [...new Set([...selected, value])]
			: selected.filter((v) => v !== value);
		api.setFilters({ [key]: next });
		document
			.getElementById("novel-grid")
			?.scrollIntoView({ behavior: "smooth", block: "nearest" });
	};

	container
		.querySelector("#fandom-match-mode")
		?.addEventListener("change", (e) =>
			api.setFilters({ [modeKey]: e.target.value }),
		);

	for (const button of container.querySelectorAll(".view-toggle-btn")) {
		button.addEventListener("click", () =>
			api.setFilters({ [viewKey]: button.dataset.view }),
		);
	}

	container
		.querySelector("#clear-fandoms")
		?.addEventListener("click", () => api.setFilters({ [key]: [] }));

	for (const card of container.querySelectorAll(".fandom-card")) {
		card.addEventListener("click", () => {
			const value = card.dataset.fandomValue;
			toggle(value, !selected.includes(value));
		});
	}

	for (const box of container.querySelectorAll(
		".fandom-dropdown-list input[type='checkbox']",
	)) {
		box.addEventListener("change", () => {
			// Bounce the box back when the cap rejects the change.
			if (box.checked && selected.length >= maxSelection) {
				box.checked = false;
				return;
			}
			toggle(box.value, box.checked);
		});
	}

	setupSearch(container);
}

/**
 * Filter both views from one box. Kept local to the rendered pass so it does
 * not need to survive a re-render.
 *
 * @param {HTMLElement} container
 */
function setupSearch(container) {
	const search = container.querySelector("#fandom-nav-search");
	if (!search) return;
	const entries = [
		...container.querySelectorAll(".fandom-card, .filter-pill"),
	].map((el) => ({
		el,
		text: (
			el.dataset.fandomValue ||
			el.dataset.pillValue ||
			""
		).toLowerCase(),
	}));

	search.addEventListener("input", () => {
		const query = search.value.trim().toLowerCase();
		for (const entry of entries) {
			entry.el.style.display =
				!query || entry.text.includes(query) ? "" : "none";
		}
	});
}
