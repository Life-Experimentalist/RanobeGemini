/**
 * Reading Status Filters Module
 * Handles rendering and state management for status filter buttons in the library
 */

import { READING_STATUS_INFO } from "../../utils/novel-library.js";
import { getAllStatuses, getDefaultRereadingOverlay } from "../status-machine.js";

let currentStatusFilter = "all";
let onFilterChangeCallback = null;

/**
 * Initialize status filters
 * @param {HTMLElement} container - The container to render buttons into
 * @param {Object} settings - Library settings
 * @param {Function} onChange - Callback when filter changes
 */
export function initStatusFilters(container, settings, onChange) {
	if (!container) return;
	onFilterChangeCallback = onChange;
	
	renderStatusFilterButtons(container, settings);
	
	// Attach click listeners via event delegation on the container
	container.addEventListener("click", (e) => {
		const btn = e.target.closest(".status-filter-btn");
		if (!btn) return;
		handleStatusFilterChange(btn.dataset.status, container);
	});
}

/**
 * Handle status filter change
 * @param {string} status - The selected status ID
 * @param {HTMLElement} container - The button container
 */
function handleStatusFilterChange(status, container) {
	currentStatusFilter = status;

	// Update button states
	if (container) {
		container.querySelectorAll(".status-filter-btn").forEach((btn) => {
			btn.classList.toggle("active", btn.dataset.status === status);
		});
	}

	if (typeof onFilterChangeCallback === "function") {
		onFilterChangeCallback(status);
	}
}

/**
 * Get the current status filter
 * @returns {string}
 */
export function getStatusFilter() {
	return currentStatusFilter;
}

/**
 * Set the current status filter programmatically
 * @param {string} status 
 * @param {HTMLElement} container 
 */
export function setStatusFilter(status, container) {
	currentStatusFilter = status;
	if (container) {
		container.querySelectorAll(".status-filter-btn").forEach((btn) => {
			btn.classList.toggle("active", btn.dataset.status === status);
		});
	}
}

/**
 * Render reading status filter buttons
 * @param {HTMLElement} container 
 * @param {Object} settings 
 */
export function renderStatusFilterButtons(container, settings = {}) {
	if (!container) return;

	const statuses = getAllStatuses(settings, READING_STATUS_INFO);
	const rereadingOverlay = {
		...getDefaultRereadingOverlay(),
		...(settings.rereadingOverlay || {}),
	};

	// Build button HTML
	const allBtn = `<button class="status-filter-btn ${
		currentStatusFilter === "all" ? "active" : ""
	}" data-status="all" title="All Novels">\u{1F4DA} All</button>`;

	const statusBtns = statuses
		.filter((s) => !s.isRereadingOverlay) // RE_READING handled inline as overlay
		.map(
			(s) =>
				`<button class="status-filter-btn ${
					currentStatusFilter === s.id ? "active" : ""
				}" data-status="${s.id}" title="${s.label}"
				style="--status-color:${s.color};">${s.label}</button>`,
		)
		.join("");

	// Re-reading overlay toggle (only if enabled in settings)
	const rrBtn = rereadingOverlay.enabled
		? `<button class="status-filter-btn status-filter-rereading ${
				currentStatusFilter === "_rereading" ? "active" : ""
		  }" data-status="_rereading"
			title="${rereadingOverlay.label} (overlay filter)"
			style="--status-color:${rereadingOverlay.color};">${rereadingOverlay.label}</button>`
		: "";

	container.innerHTML = allBtn + statusBtns + rrBtn;
}
