/**
 * Chunk Summary UI - Material Design
 * Creates summary button groups that repeat every N chunks
 * Theme-aware styling
 *
 * Structure used for BOTH main and per-chunk groups:
 *
 *   .gemini-*-summary-group   (display:block  — outer card)
 *     ├── .rg-summary-label   (plain text label)
 *     ├── .rg-summary-buttons (display:grid   — equal-width button grid)
 *     │     ├── button
 *     │     └── button ...
 *     └── .gemini-summary-text-container  (display:none → block on reveal)
 *
 * Keeping label / buttons / text in separate divs prevents the
 * flex-child sizing issues that arose with a flat single-flex layout.
 */

import { DEFAULT_CHUNK_SUMMARY_COUNT } from "./chunk-config.js";
// eslint-disable-next-line no-unused-vars
import { isDarkMode, getThemeColors } from "./chunk-ui.js";

/* ─────────────────────────────────────────────────────────────
   Internal helpers
───────────────────────────────────────────────────────────── */

function buildCard(className, colors) {
	const card = document.createElement("div");
	card.className = className;
	card.style.cssText = `
		box-sizing: border-box;
		width: 100%;
		background: ${colors.surfaceVariant};
		border: 1px solid ${colors.outline};
		border-radius: 6px;
		padding: 12px 14px;
		margin: 14px 0;
	`;
	return card;
}

function buildLabel(text, colors, fontSize = "13px") {
	const label = document.createElement("div");
	label.className = "rg-summary-label";
	label.textContent = text;
	label.style.cssText = `
		font-weight: 600;
		font-size: ${fontSize};
		color: ${colors.onSurface};
		text-align: center;
		margin-bottom: 10px;
	`;
	return label;
}

function buildButtonRow() {
	const row = document.createElement("div");
	row.className = "rg-summary-buttons";
	row.style.cssText = `
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	`;
	return row;
}

function buildButton(
	text,
	className,
	bgColor,
	textColor,
	colors,
	outline = false,
) {
	const btn = document.createElement("button");
	btn.className = className;
	btn.style.cssText = `
		flex: 1 1 140px;
		box-sizing: border-box;
		padding: 9px 12px;
		margin: 15px 0;
		background: ${bgColor};
		color: ${textColor};
		border: ${outline ? `1px solid ${colors.outline}` : "none"};
		border-radius: 5px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		white-space: nowrap;
		min-height: 38px;
		transition: filter 0.15s, box-shadow 0.15s;
		box-shadow: 0 1px 3px rgba(0,0,0,0.25);
		text-align: center;
		display: inline-flex;
		justify-content: center;
		align-items: center;
	`;
	btn.textContent = text;
	btn.addEventListener("mouseenter", () => {
		btn.style.filter = "brightness(1.12)";
		btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.35)";
	});
	btn.addEventListener("mouseleave", () => {
		btn.style.filter = "";
		btn.style.boxShadow = "0 1px 3px rgba(0,0,0,0.25)";
	});
	return btn;
}

function buildTextContainer(groupStart, groupEnd, colors, extraClass = "") {
	const div = document.createElement("div");
	div.className =
		"gemini-summary-text-container" + (extraClass ? " " + extraClass : "");
	div.setAttribute("data-group-start", String(groupStart));
	div.setAttribute("data-group-end", String(groupEnd));
	div.style.cssText = `
		display: none;
		box-sizing: border-box;
		width: 100%;
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid ${colors.outline};
		font-family: inherit;
		font-size: inherit;
		line-height: 1.7;
		color: ${colors.onSurface};
		text-align: left;
		word-break: break-word;
	`;
	return div;
}

/* ─────────────────────────────────────────────────────────────
   Exported: per-chunk summary group (appears between N chunks)
───────────────────────────────────────────────────────────── */

/**
 * Create a summary button group for a range of chunks
 * @param {number}   startIndex
 * @param {number}   endIndex
 * @param {number[]} chunkIndices
 * @param {Function} onLongSummary
 * @param {Function} onShortSummary
 * @returns {HTMLElement}
 */
export function createSummaryButtonGroup(
	startIndex,
	endIndex,
	chunkIndices,
	onLongSummary,
	onShortSummary,
	_onEnhance = null,
) {
	const colors = getThemeColors();
	const card = buildCard("gemini-chunk-summary-group", colors);
	card.setAttribute("data-start-index", startIndex);
	card.setAttribute("data-end-index", endIndex);

	card.appendChild(
		buildLabel(
			`Summary · Chunks ${startIndex + 1}–${endIndex + 1}`,
			colors,
		),
	);

	const row = buildButtonRow();

	const longBtn = buildButton(
		"📝 Long Summary",
		"gemini-chunk-long-summary-btn",
		colors.primary,
		colors.onPrimary,
		colors,
	);
	longBtn.addEventListener("click", () =>
		onLongSummary?.(chunkIndices, startIndex),
	);
	row.appendChild(longBtn);

	const shortBtn = buildButton(
		"✨ Short Summary",
		"gemini-chunk-short-summary-btn",
		colors.surface,
		colors.primary,
		colors,
		true,
	);
	shortBtn.addEventListener("click", () =>
		onShortSummary?.(chunkIndices, startIndex),
	);
	row.appendChild(shortBtn);

	card.appendChild(row);
	card.appendChild(buildTextContainer(startIndex, endIndex, colors));

	return card;
}

/* ─────────────────────────────────────────────────────────────
   Exported: main summary group (full chapter, shown at top)
───────────────────────────────────────────────────────────── */

/**
 * Create the full-chapter summary button group shown above the content.
 * @param {number}        totalChunks
 * @param {Function}      onLongSummary
 * @param {Function}      onShortSummary
 * @param {Function|null} onEnhance
 * @returns {HTMLElement}
 */
export function createMainSummaryGroup(
	totalChunks,
	onLongSummary,
	onShortSummary,
	onEnhance = null,
) {
	const colors = getThemeColors();
	const allIndices = Array.from({ length: totalChunks }, (_, i) => i);

	const card = buildCard("gemini-main-summary-group", colors);

	card.appendChild(buildLabel("Full Chapter Summary", colors, "14px"));

	const row = buildButtonRow();

	if (onEnhance) {
		const enhanceBtn = buildButton(
			"⚡ Enhance Chapter",
			"gemini-enhance-btn",
			colors.primary,
			colors.onPrimary,
			colors,
		);
		enhanceBtn.addEventListener("click", () => onEnhance?.());
		row.appendChild(enhanceBtn);
	}

	const longBtn = buildButton(
		"📝 Long Summary",
		"gemini-main-long-summary-btn",
		colors.primary,
		colors.onPrimary,
		colors,
	);
	longBtn.addEventListener("click", () => onLongSummary?.(allIndices));
	row.appendChild(longBtn);

	const shortBtn = buildButton(
		"✨ Short Summary",
		"gemini-main-short-summary-btn",
		colors.surface,
		colors.primary,
		colors,
		true,
	);
	shortBtn.addEventListener("click", () => onShortSummary?.(allIndices));
	row.appendChild(shortBtn);

	card.appendChild(row);
	card.appendChild(
		buildTextContainer(
			0,
			totalChunks - 1,
			colors,
			"gemini-main-summary-text",
		),
	);

	return card;
}

/* ─────────────────────────────────────────────────────────────
   Exported: position calculation + insertion helpers
───────────────────────────────────────────────────────────── */

/**
 * Calculate where to insert per-chunk summary groups.
 * @param {number} totalChunks
 * @param {number} chunkSummaryCount
 * @returns {Array<{startIndex:number, endIndex:number, indices:number[]}>}
 */
export function calculateSummaryPositions(
	totalChunks,
	chunkSummaryCount = DEFAULT_CHUNK_SUMMARY_COUNT,
) {
	if (totalChunks <= 0) return [];

	const positions = [];
	let i = 0;

	while (i < totalChunks) {
		const start = i;
		const end = Math.min(i + chunkSummaryCount - 1, totalChunks - 1);
		const indices = [];
		for (let j = start; j <= end; j++) indices.push(j);
		positions.push({ startIndex: start, endIndex: end, indices });
		i += chunkSummaryCount;
	}

	console.log(
		`[ChunkSummaryUI] ${positions.length} summary group(s) for ${totalChunks} chunks`,
	);
	return positions;
}

/**
 * Insert per-chunk summary groups into a container before each group's
 * first chunk wrapper element.
 */
export function insertSummaryGroups(
	container,
	chunkElements,
	chunkSummaryCount,
	onLongSummary,
	onShortSummary,
	onEnhance = null,
) {
	if (!container || !chunkElements?.length) {
		console.warn("[ChunkSummaryUI] insertSummaryGroups: invalid params");
		return;
	}

	const positions = calculateSummaryPositions(
		chunkElements.length,
		chunkSummaryCount,
	);

	positions.forEach((pos, idx) => {
		const { startIndex, endIndex, indices } = pos;
		const firstEl = chunkElements[startIndex];
		if (firstEl && firstEl.parentNode === container) {
			const group = createSummaryButtonGroup(
				startIndex,
				endIndex,
				indices,
				onLongSummary,
				onShortSummary,
				onEnhance,
			);
			container.insertBefore(group, firstEl);
			console.log(
				`[ChunkSummaryUI] Inserted summary group ${idx + 1} before chunk ${startIndex}`,
			);
		}
	});
}

export default {
	createSummaryButtonGroup,
	calculateSummaryPositions,
	insertSummaryGroups,
	createMainSummaryGroup,
};
