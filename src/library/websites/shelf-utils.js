/**
 * @fileoverview Shared utility functions for shelf pages.
 *
 * Every site-specific shelf (AO3, FanFiction, Ranobes, ScribbleHub) duplicates
 * these helpers. Import from here instead of copy-pasting.
 *
 * Usage (in a site-specific shelf-page.js):
 *   import { createTaxonomyEngine, escapeHtml, formatNumber, ... } from "../shelf-utils.js";
 *   const taxonomy = createTaxonomyEngine(CATEGORY_LOOKUP_INIT);
 */

import {
	READING_STATUS,
	READING_STATUS_INFO,
} from "../../utils/novel-library.js";

// \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
// Taxonomy Engine
// \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

/**
 * Create a self-contained taxonomy engine with its own label map and category lookup.
 * Each shelf page gets its own instance so there are no cross-shelf collisions.
 *
 * @param {Object<string, Set>} categoryLookup - initial category \u{2192} Set map (e.g. { genres: new Set(), tags: new Set() })
 * @returns {Object} Taxonomy engine with reset, register, canonicalize, categorize, sortAlpha, buildFromNovels
 */
export function createTaxonomyEngine(categoryLookup) {
	const CANONICAL_LABELS = new Map();
	const CATEGORY_LOOKUP = categoryLookup;

	function reset() {
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

	/**
	 * Build taxonomy from novels using the provided taxonomy definition.
	 * @param {Array} novels
	 * @param {Array<{id: string, label: string, type: string}>} taxonomyDef
	 */
	function buildFromNovels(novels, taxonomyDef) {
		reset();
		// Ensure CATEGORY_LOOKUP has keys for all taxonomy entries
		taxonomyDef.forEach((tax) => {
			if (!CATEGORY_LOOKUP[tax.id]) {
				CATEGORY_LOOKUP[tax.id] = new Set();
			}
		});

		novels.forEach((novel) => {
			const metadata = novel.metadata || {};
			taxonomyDef.forEach((tax) => {
				const values = novel[tax.id] || metadata[tax.id] || [];
				if (Array.isArray(values)) {
					values.forEach((v) => registerLabel(v, tax.id));
				}
			});
		});
	}

	return {
		reset,
		registerLabel,
		canonicalizeLabel,
		categorizeLabel,
		sortAlpha,
		buildFromNovels,
		getCanonicalLabels: () => CANONICAL_LABELS,
		getCategoryLookup: () => CATEGORY_LOOKUP,
	};
}

// \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
// Filter Persistence
// \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

/**
 * Load saved filters from localStorage.
 * @param {string} storageKey - e.g. "rg_filters_scribblehub"
 * @param {Object} defaults - default filter state
 * @returns {Object} merged filter state
 */
export function loadSavedFilters(storageKey, defaults) {
	try {
		const raw = localStorage.getItem(storageKey);
		if (raw) {
			const saved = JSON.parse(raw);
			return { ...defaults, ...saved };
		}
	} catch {
		// Ignore parse errors
	}
	return { ...defaults };
}

/**
 * Persist filter state to localStorage.
 * @param {string} storageKey
 * @param {Object} filterState
 */
export function persistFilters(storageKey, filterState) {
	try {
		localStorage.setItem(storageKey, JSON.stringify(filterState));
	} catch {
		// Ignore storage errors
	}
}

// \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
// Reading Status Helpers
// \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

/**
 * Normalize reading status to canonical enum value.
 * @param {string} status
 * @returns {string}
 */
export function normalizeReadingStatus(status) {
	if (!status) return READING_STATUS.PLAN_TO_READ;
	const lower = status.toLowerCase().replace(/[_-]/g, "");

	const MAP = {
		reading: READING_STATUS.READING,
		plantoread: READING_STATUS.PLAN_TO_READ,
		completed: READING_STATUS.COMPLETED,
		onhold: READING_STATUS.ON_HOLD,
		dropped: READING_STATUS.DROPPED,
		uptodate: READING_STATUS.UP_TO_DATE,
		rereading: READING_STATUS.RE_READING,
	};
	return MAP[lower] || status;
}

/**
 * Normalize status for modal display.
 * @param {string} status
 * @returns {string}
 */
export function normalizeModalStatus(status) {
	return normalizeReadingStatus(status);
}

/**
 * Sort order for work status strings.
 * @param {string} status - e.g. "ongoing", "completed", "hiatus"
 * @returns {number}
 */
export function getWorkStatusOrder(status) {
	const ORDER = { ongoing: 0, completed: 1, hiatus: 2, cancelled: 3 };
	return ORDER[(status || "").toLowerCase()] ?? 99;
}

/**
 * Reading status labels (emoji + text) keyed by status id.
 */
export const READING_STATUS_LABELS = Object.fromEntries(
	Object.entries(READING_STATUS_INFO).map(([key, value]) => [
		key,
		value.label,
	]),
);

// \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
// UI Utilities
// \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

/**
 * Escape HTML entities.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
	if (!text) return "";
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Format a large number for display (e.g. 1234 \u{2192} "1.2K").
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
	if (typeof num !== "number" || isNaN(num)) return "0";
	if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
	if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
	return num.toString();
}

/**
 * Show a brief toast notification.
 * @param {string} message
 * @param {"success"|"error"|"info"} type
 */
export function showToast(message, type = "success") {
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

/**
 * Set the text and optional click target for an insight card.
 * @param {string} id - DOM id of the stat element
 * @param {string} text - display text
 * @param {string} [tooltip] - optional title/tooltip
 * @param {Function} [onClick] - optional click handler
 */
export function setInsightTarget(id, text, tooltip, onClick) {
	const el = document.getElementById(id);
	if (!el) return;
	el.textContent = text;
	if (tooltip) el.title = tooltip;
	if (onClick) {
		el.style.cursor = "pointer";
		el.addEventListener("click", onClick);
	}
}

/**
 * Render a horizontal bar chart for reading-status distribution.
 * @param {Object<string, number>} buckets - status \u{2192} count
 * @param {number} total
 */
export function renderReadingStatusChart(buckets, total) {
	const container = document.getElementById("reading-status-chart");
	if (!container) return;

	container.innerHTML = "";
	if (total === 0) return;

	const statusColors = {};
	for (const [key, info] of Object.entries(READING_STATUS_INFO)) {
		statusColors[key] = info.color || "#6b7280";
	}

	const sorted = Object.entries(buckets).sort(
		([, a], [, b]) => (b || 0) - (a || 0),
	);

	sorted.forEach(([status, count]) => {
		if (!count) return;
		const pct = Math.round((count / total) * 100);
		const color = statusColors[status] || "#6b7280";
		const label =
			READING_STATUS_LABELS[status] ||
			status
				.replace(/[-_]/g, " ")
				.replace(/\b\w/g, (c) => c.toUpperCase());

		const row = document.createElement("div");
		row.style.cssText =
			"display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;";

		const labelEl = document.createElement("span");
		labelEl.style.cssText = "min-width:90px;color:var(--text-secondary);";
		labelEl.textContent = label;

		const barBg = document.createElement("div");
		barBg.style.cssText =
			"flex:1;height:8px;background:var(--bg-tertiary,#1f2937);border-radius:4px;overflow:hidden;";

		const barFill = document.createElement("div");
		barFill.style.cssText = `height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.3s ease;`;
		barBg.appendChild(barFill);

		const countEl = document.createElement("span");
		countEl.style.cssText =
			"min-width:40px;text-align:right;color:var(--text-muted);";
		countEl.textContent = `${count}`;

		row.appendChild(labelEl);
		row.appendChild(barBg);
		row.appendChild(countEl);
		container.appendChild(row);
	});
}

// \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
// Multi-Select / Filter Pill UI
// \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

/**
 * Synchronise a multi-select checkbox container with an external array value.
 * @param {string} containerId - DOM id of the checkbox container
 * @param {Array<string>} selectedValues - current selections
 * @param {Function} onChange - callback(newArray) when selection changes
 */
export function syncMultiSelectUI(containerId, selectedValues, onChange) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const boxes = container.querySelectorAll('input[type="checkbox"]');
	boxes.forEach((box) => {
		box.checked = selectedValues.includes(box.value);
		// Avoid duplicate listeners \u{2014} clone-in-place pattern
		const fresh = box.cloneNode(true);
		box.parentNode.replaceChild(fresh, box);
		fresh.addEventListener("change", () => {
			const next = [];
			container
				.querySelectorAll('input[type="checkbox"]:checked')
				.forEach((cb) => next.push(cb.value));
			onChange(next);
		});
	});
}

/**
 * Render a list of clickable pill items inside a container.
 * @param {string} containerId - target DOM id
 * @param {Array<string>} items - pill labels
 * @param {Array<string>} selectedItems - currently selected labels
 * @param {Function} onToggle - callback(label) when a pill is clicked
 */
export function renderPillList(containerId, items, selectedItems, onToggle) {
	const container = document.getElementById(containerId);
	if (!container) return;
	container.innerHTML = "";

	items.forEach((item) => {
		const pill = document.createElement("button");
		pill.className = `filter-pill${selectedItems.includes(item) ? " active" : ""}`;
		pill.textContent = item;
		pill.addEventListener("click", () => onToggle(item));
		container.appendChild(pill);
	});
}

/**
 * Update the filter badge count.
 * @param {number} count
 */
export function updateFilterBadge(count) {
	const badge = document.getElementById("filter-badge");
	if (!badge) return;
	badge.textContent = count;
	badge.style.display = count > 0 ? "inline-flex" : "none";
}

// \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}
// Novel Library Operations
// \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

/**
 * Remove a novel from the storage library and execute a refresh callback.
 * @param {string} novelId
 * @param {Function} onRemoved - callback() after removal
 */
export async function removeNovelFromLibrary(novelId, onRemoved) {
	try {
		const result = await browser.storage.local.get("rg_novel_library");
		const library = result.rg_novel_library || { novels: {} };

		if (library.novels && library.novels[novelId]) {
			delete library.novels[novelId];
			await browser.storage.local.set({ rg_novel_library: library });
			if (typeof onRemoved === "function") onRemoved();
			showToast("Novel removed from library", "success");
		}
	} catch (error) {
		console.error("[Shelf] Error removing novel:", error);
		showToast("Failed to remove novel", "error");
	}
}

/**
 * Open source URL for a novel to trigger metadata refresh.
 * @param {Object} novel
 */
export function refreshNovelMetadata(novel) {
	const url = novel?.url || novel?.sourceUrl || "";
	if (!url) {
		showToast("No source URL available for refresh", "error");
		return;
	}
	window.open(url, "_blank", "noopener,noreferrer");
	showToast("Opened source page to refresh metadata", "info");
}

/**
 * Open a novel detail if `?novel=<id>` is in the URL query string.
 * @param {Array} novels - current novels list
 * @param {Function} showModal - callback(novel) to display the modal
 */
export function openNovelFromQuery(novels, showModal) {
	try {
		const params = new URLSearchParams(window.location.search);
		const novelId = params.get("novel");
		if (!novelId) return;
		const novel = novels.find((n) => n && n.id === novelId);
		if (novel) {
			showModal(novel);
		} else {
			showToast("Novel not found in this shelf", "info");
		}
	} catch {
		// ignore
	}
}
