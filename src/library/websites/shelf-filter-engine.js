/**
 * @fileoverview Pure filter/sort/stat engine for shelf pages.
 *
 * Every shelf page filters, sorts and summarises the same shape of novel — only
 * the *dimensions* differ. AO3 filters by fandom, relationship, character and
 * word count; NovelBin only by language and genre. Rather than five copies of
 * the same loops, each site declares what it has and this module does the work.
 *
 * Nothing here touches the DOM, so it is unit-testable in plain Node. The DOM
 * side lives in `shelf-core.js`.
 *
 * A shelf descriptor looks like:
 *
 *   {
 *     shelfId: "ao3",
 *     filterStorageKey: "rg_ao3_filters",
 *     filters: [ ...see FILTER KINDS below... ],
 *     sorts:   [ { value, label, compare(a, b) } ],
 *     stats:   [ { id, label, compute(novels) } ],
 *     insights:[ { id, label, pick(novels) } ],
 *   }
 *
 * FILTER KINDS
 *   search — free text. Matched against `searchFields(novel)`, defaulting to
 *            title/author/description plus every multi filter's values.
 *   select — one-of. `options` is a static list or omitted, in which case the
 *            option list is derived from the novels via `values(novel)`.
 *   multi  — many-of, rendered as pills. `mode` is "any" or "all"; when
 *            `modeSelectable` is set the user can switch it at runtime.
 *   range  — numeric min/max over `value(novel)`.
 */

import { READING_STATUS } from "../../utils/novel-library.js";

/** Filter kinds understood by this engine and by `shelf-core.js`. */
export const FILTER_KINDS = Object.freeze({
	SEARCH: "search",
	SELECT: "select",
	MULTI: "multi",
	RANGE: "range",
});

/**
 * Map a stored reading status onto the canonical enum.
 *
 * Statuses have been written by several generations of the extension, so
 * "re_reading", "re-reading" and "rereading" all appear in real libraries.
 *
 * @param {string} status
 * @returns {string} Canonical status, or "" when there is nothing to map.
 */
export function normalizeReadingStatus(status) {
	if (!status) return "";
	const normalized = String(status).toLowerCase().replace(/_/g, "-");
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

/**
 * Reading status for the modal's status buttons, which always need a value.
 *
 * @param {string} status
 * @returns {string}
 */
export function normalizeModalStatus(status) {
	return normalizeReadingStatus(status) || READING_STATUS.PLAN_TO_READ;
}

/**
 * Abbreviate a count for a stat card: 1234 → "1,234", 45678 → "45.7K".
 *
 * @param {number|string} num
 * @returns {string}
 */
export function formatNumber(num) {
	const n =
		typeof num === "string" ? parseInt(num.replace(/,/g, ""), 10) : num;
	if (!n || Number.isNaN(n)) return "0";
	if (n >= 1_000_000)
		return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
	if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
	return n.toLocaleString();
}

/** Case-insensitive alphabetical sort, returning a new array. */
export function sortAlpha(values) {
	return [...values].sort((a, b) =>
		String(a).localeCompare(String(b), undefined, { sensitivity: "base" }),
	);
}

/**
 * Read a filter's per-novel values, tolerating the two shapes the library uses:
 * a top-level field and a `metadata` field of the same name.
 *
 * @param {object} filter
 * @param {object} novel
 * @returns {string[]}
 */
function multiValues(filter, novel) {
	const raw =
		typeof filter.values === "function"
			? filter.values(novel)
			: novel?.[filter.key] || novel?.metadata?.[filter.key] || [];
	if (!Array.isArray(raw)) return raw ? [String(raw).trim()] : [];
	return raw.map((v) => String(v).trim()).filter(Boolean);
}

/**
 * Read a select filter's per-novel value.
 *
 * @param {object} filter
 * @param {object} novel
 * @returns {string}
 */
function selectValue(filter, novel) {
	const raw =
		typeof filter.value === "function"
			? filter.value(novel)
			: (novel?.metadata?.[filter.key] ?? novel?.[filter.key] ?? "");
	return raw == null ? "" : String(raw).trim();
}

/**
 * Build the starting filter state for a descriptor.
 *
 * @param {object} descriptor
 * @returns {object}
 */
export function createDefaultFilterState(descriptor) {
	const state = { sort: descriptor.sorts?.[0]?.value || "recent" };
	for (const filter of descriptor.filters || []) {
		switch (filter.kind) {
			case FILTER_KINDS.SEARCH:
				state[filter.key] = "";
				break;
			case FILTER_KINDS.SELECT:
				state[filter.key] = "all";
				break;
			case FILTER_KINDS.MULTI:
				state[filter.key] = [];
				if (filter.modeSelectable) {
					state[`${filter.key}Mode`] = filter.mode || "any";
				}
				break;
			case FILTER_KINDS.RANGE:
				state[`${filter.key}Min`] = "";
				state[`${filter.key}Max`] = "";
				break;
			default:
				break;
		}
	}
	return state;
}

/**
 * Load persisted filters, falling back to defaults for anything missing or
 * corrupt. A stale key from an older descriptor is simply ignored.
 *
 * @param {object} descriptor
 * @returns {object}
 */
export function loadFilterState(descriptor) {
	const defaults = createDefaultFilterState(descriptor);
	try {
		const raw = globalThis.localStorage?.getItem(
			descriptor.filterStorageKey,
		);
		if (!raw) return defaults;
		const saved = JSON.parse(raw);
		if (!saved || typeof saved !== "object") return defaults;
		// Only keys the descriptor still declares survive a round trip.
		const merged = { ...defaults };
		for (const key of Object.keys(defaults)) {
			if (key in saved) merged[key] = saved[key];
		}
		return merged;
	} catch (_error) {
		return defaults;
	}
}

/**
 * Persist filter state. Storage failures are non-fatal — the page keeps working
 * with in-memory filters.
 *
 * @param {object} descriptor
 * @param {object} state
 */
export function saveFilterState(descriptor, state) {
	try {
		globalThis.localStorage?.setItem(
			descriptor.filterStorageKey,
			JSON.stringify(state),
		);
	} catch (_error) {
		// Ignore — quota or a disabled storage backend.
	}
}

/**
 * Collect the option list for every filter whose options come from the data
 * rather than from a fixed list.
 *
 * @param {object} descriptor
 * @param {object[]} novels
 * @returns {Object<string, string[]>} filter key → sorted option labels
 */
export function deriveFilterOptions(descriptor, novels) {
	const options = {};
	for (const filter of descriptor.filters || []) {
		if (filter.kind === FILTER_KINDS.MULTI) {
			const seen = new Map();
			for (const novel of novels) {
				for (const value of multiValues(filter, novel)) {
					// First spelling wins so casing stays stable across renders.
					if (!seen.has(value.toLowerCase())) {
						seen.set(value.toLowerCase(), value);
					}
				}
			}
			options[filter.key] = sortAlpha([...seen.values()]);
		} else if (filter.kind === FILTER_KINDS.SELECT && !filter.options) {
			const seen = new Map();
			for (const novel of novels) {
				const value = selectValue(filter, novel);
				if (value && !seen.has(value.toLowerCase())) {
					seen.set(value.toLowerCase(), value);
				}
			}
			options[filter.key] = sortAlpha([...seen.values()]);
		}
	}
	return options;
}

/**
 * The haystack a search filter matches against.
 *
 * @param {object} descriptor
 * @param {object} novel
 * @returns {string}
 */
function searchHaystack(descriptor, novel) {
	if (typeof descriptor.searchFields === "function") {
		return descriptor
			.searchFields(novel)
			.filter(Boolean)
			.join(" ")
			.toLowerCase();
	}
	const parts = [novel.title, novel.author, novel.description];
	for (const filter of descriptor.filters || []) {
		if (filter.kind === FILTER_KINDS.MULTI) {
			parts.push(...multiValues(filter, novel));
		}
	}
	return parts.filter(Boolean).join(" ").toLowerCase();
}

/**
 * Apply every declared filter. Returns a new array; the input is untouched.
 *
 * @param {object} descriptor
 * @param {object[]} novels
 * @param {object} state
 * @returns {object[]}
 */
export function applyFilters(descriptor, novels, state) {
	let result = [...novels];

	for (const filter of descriptor.filters || []) {
		switch (filter.kind) {
			case FILTER_KINDS.SEARCH: {
				const query = String(state[filter.key] || "")
					.trim()
					.toLowerCase();
				if (!query) break;
				result = result.filter((novel) =>
					searchHaystack(descriptor, novel).includes(query),
				);
				break;
			}

			case FILTER_KINDS.SELECT: {
				const wanted = state[filter.key];
				if (!wanted || wanted === "all") break;
				result = result.filter((novel) => {
					if (typeof filter.match === "function") {
						return filter.match(novel, wanted);
					}
					return (
						selectValue(filter, novel).toLowerCase() ===
						String(wanted).toLowerCase()
					);
				});
				break;
			}

			case FILTER_KINDS.MULTI: {
				const selected = state[filter.key];
				if (!Array.isArray(selected) || selected.length === 0) break;
				// A mode in the state wins wherever it came from: `modeSelectable`
				// puts a control in the filter grid, but a filter section can
				// own the control instead (the fandom browser does).
				const mode = state[`${filter.key}Mode`] || filter.mode || "any";
				result = result.filter((novel) => {
					const owned = new Set(
						multiValues(filter, novel).map((v) => v.toLowerCase()),
					);
					const test = (value) => owned.has(value.toLowerCase());
					return mode === "all"
						? selected.every(test)
						: selected.some(test);
				});
				break;
			}

			case FILTER_KINDS.RANGE: {
				const min = parseInt(state[`${filter.key}Min`], 10);
				const max = parseInt(state[`${filter.key}Max`], 10);
				const hasMin = !Number.isNaN(min);
				const hasMax = !Number.isNaN(max);
				if (!hasMin && !hasMax) break;
				result = result.filter((novel) => {
					const value = Number(filter.value(novel)) || 0;
					if (hasMin && value < min) return false;
					if (hasMax && value > max) return false;
					return true;
				});
				break;
			}

			default:
				break;
		}
	}

	return result;
}

/**
 * Sort by the descriptor's named comparator. An unknown sort key leaves the
 * order alone rather than throwing.
 *
 * @param {object} descriptor
 * @param {object[]} novels
 * @param {string} sortValue
 * @returns {object[]} A new, sorted array.
 */
export function applySort(descriptor, novels, sortValue) {
	const sort = (descriptor.sorts || []).find((s) => s.value === sortValue);
	const sorted = [...novels];
	if (sort?.compare) sorted.sort(sort.compare);
	return sorted;
}

/** Convenience: filter then sort, the pairing every shelf page needs. */
export function filterAndSort(descriptor, novels, state) {
	return applySort(
		descriptor,
		applyFilters(descriptor, novels, state),
		state.sort,
	);
}

/**
 * Describe the currently active filters as removable chips.
 *
 * @param {object} descriptor
 * @param {object} state
 * @returns {{key: string, label: string, value: string}[]}
 */
export function buildActiveChips(descriptor, state) {
	const chips = [];
	for (const filter of descriptor.filters || []) {
		switch (filter.kind) {
			case FILTER_KINDS.SEARCH: {
				const value = String(state[filter.key] || "").trim();
				if (value) {
					chips.push({
						key: filter.key,
						label: `${filter.chipPrefix || "Search"}: ${value}`,
						value: "",
					});
				}
				break;
			}

			case FILTER_KINDS.SELECT: {
				const value = state[filter.key];
				if (value && value !== "all") {
					chips.push({
						key: filter.key,
						label: `${filter.chipPrefix || filter.label}: ${value}`,
						value: "",
					});
				}
				break;
			}

			case FILTER_KINDS.MULTI: {
				for (const value of state[filter.key] || []) {
					chips.push({
						key: filter.key,
						label: `${filter.chipPrefix || filter.label}: ${value}`,
						value,
					});
				}
				if (
					filter.modeSelectable &&
					(state[filter.key] || []).length > 1 &&
					state[`${filter.key}Mode`] === "all"
				) {
					chips.push({
						key: `${filter.key}Mode`,
						label: `${filter.label}: all must match`,
						value: "",
					});
				}
				break;
			}

			case FILTER_KINDS.RANGE: {
				const min = parseInt(state[`${filter.key}Min`], 10);
				if (!Number.isNaN(min) && min > 0) {
					chips.push({
						key: `${filter.key}Min`,
						label: `${filter.label} ≥ ${min.toLocaleString()}`,
						value: "",
					});
				}
				const max = parseInt(state[`${filter.key}Max`], 10);
				if (!Number.isNaN(max) && max > 0) {
					chips.push({
						key: `${filter.key}Max`,
						label: `${filter.label} ≤ ${max.toLocaleString()}`,
						value: "",
					});
				}
				break;
			}

			default:
				break;
		}
	}
	return chips;
}

/**
 * Clear one chip. Returns a new state object.
 *
 * @param {object} descriptor
 * @param {object} state
 * @param {string} key - The chip's key, which for multi filters is the filter key.
 * @param {string} [value] - For multi filters, the single value to drop.
 * @returns {object}
 */
export function clearFilterValue(descriptor, state, key, value) {
	const next = { ...state };
	const filter = (descriptor.filters || []).find((f) => f.key === key);

	if (!filter) {
		// Mode and range chips carry a suffixed key of their own.
		const modeOwner = (descriptor.filters || []).find(
			(f) => `${f.key}Mode` === key,
		);
		if (modeOwner) {
			next[key] = modeOwner.mode || "any";
			return next;
		}
		if (key.endsWith("Min") || key.endsWith("Max")) next[key] = "";
		return next;
	}

	switch (filter.kind) {
		case FILTER_KINDS.SEARCH:
			next[key] = "";
			break;
		case FILTER_KINDS.SELECT:
			next[key] = "all";
			break;
		case FILTER_KINDS.MULTI:
			next[key] = (next[key] || []).filter((v) => v !== value);
			break;
		case FILTER_KINDS.RANGE:
			next[`${key}Min`] = "";
			next[`${key}Max`] = "";
			break;
		default:
			break;
	}
	return next;
}

/**
 * Compute every stat card's display value.
 *
 * @param {object} descriptor
 * @param {object[]} novels
 * @returns {Object<string, string>} stat id → text
 */
export function computeStats(descriptor, novels) {
	const out = {};
	for (const stat of descriptor.stats || []) {
		try {
			out[stat.id] = String(stat.compute(novels));
		} catch (_error) {
			out[stat.id] = "-";
		}
	}
	return out;
}

/**
 * Resolve each insight to the novel it points at, so the card can be clickable.
 *
 * @param {object} descriptor
 * @param {object[]} novels
 * @returns {Object<string, {novel: object|null, text: string}>}
 */
export function computeInsights(descriptor, novels) {
	const out = {};
	for (const insight of descriptor.insights || []) {
		try {
			const result = insight.pick(novels);
			out[insight.id] = {
				novel: result?.novel || null,
				text: result?.text || "-",
			};
		} catch (_error) {
			out[insight.id] = { novel: null, text: "-" };
		}
	}
	return out;
}

/**
 * Bucket novels by canonical reading status, for the status mix chart.
 *
 * @param {object[]} novels
 * @returns {Object<string, number>}
 */
export function bucketReadingStatus(novels) {
	return novels.reduce((acc, novel) => {
		const key =
			normalizeReadingStatus(novel.readingStatus) ||
			READING_STATUS.PLAN_TO_READ;
		acc[key] = (acc[key] || 0) + 1;
		return acc;
	}, {});
}

/**
 * Sum a numeric field across novels, checking `metadata` first then the novel.
 *
 * @param {object[]} novels
 * @param {...string} fields - Field names tried in order per novel.
 * @returns {number}
 */
export function sumField(novels, ...fields) {
	return novels.reduce((total, novel) => {
		for (const field of fields) {
			const value = novel?.metadata?.[field] ?? novel?.[field];
			if (typeof value === "number" && !Number.isNaN(value)) {
				return total + value;
			}
		}
		return total;
	}, 0);
}

/**
 * Pick the novel with the largest value of a numeric field.
 *
 * @param {object[]} novels
 * @param {(novel: object) => number} valueOf
 * @returns {object|null}
 */
export function maxBy(novels, valueOf) {
	let best = null;
	let bestValue = -Infinity;
	for (const novel of novels) {
		const value = Number(valueOf(novel)) || 0;
		if (value > bestValue) {
			bestValue = value;
			best = novel;
		}
	}
	return bestValue > 0 ? best : null;
}
