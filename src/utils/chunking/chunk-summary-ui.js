/**
 * Chunk Summary UI - Material Design
 * Creates summary button groups that repeat every N chunks
 * Theme-aware styling
 */

import { DEFAULT_CHUNK_SUMMARY_COUNT } from "./chunk-config.js";
import { isDarkMode, getThemeColors } from "./chunk-ui.js";

/**
 * Create a summary button group for a range of chunks
 * @param {number} startIndex - Starting chunk index (inclusive)
 * @param {number} endIndex - Ending chunk index (inclusive)
 * @param {Array<number>} chunkIndices - Array of chunk indices in this group
 * @param {Function} onLongSummary - Callback for long summary (receives chunkIndices)
 * @param {Function} onShortSummary - Callback for short summary (receives chunkIndices)
 * @returns {HTMLElement} The summary button group element
 */
export function createSummaryButtonGroup(
	startIndex,
	endIndex,
	chunkIndices,
	onLongSummary,
	onShortSummary,
) {
	const colors = getThemeColors();
	const groupContainer = document.createElement("div");
	groupContainer.className = "gemini-chunk-summary-group";
	groupContainer.setAttribute("data-start-index", startIndex);
	groupContainer.setAttribute("data-end-index", endIndex);
	groupContainer.style.cssText = `
		display: flex;
		gap: 12px;
		padding: 16px;
		background: ${colors.surfaceVariant};
		border: 1px solid ${colors.outline};
		border-radius: 4px;
		margin: 20px 0;
		justify-content: center;
		flex-wrap: wrap;
	`;

	const rangeLabel = document.createElement("div");
	rangeLabel.style.cssText = `
		flex: 0 0 100%;
		text-align: center;
		color: ${colors.onSurface};
		font-weight: 600;
		font-size: 14px;
		margin-bottom: 8px;
	`;
	rangeLabel.textContent = `Summary for Chunks ${startIndex + 1}-${
		endIndex + 1
	}`;
	groupContainer.appendChild(rangeLabel);

	// Long summary button
	const longSummaryBtn = document.createElement("button");
	longSummaryBtn.className = "gemini-chunk-long-summary-btn";
	longSummaryBtn.style.cssText = `
		padding: 10px 20px;
		background: ${colors.primary};
		color: #ffffff;
		border: 1px solid ${colors.outline};
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: box-shadow 0.2s;
		font-family: inherit;
	`;
	longSummaryBtn.textContent = "📝 Long Summary";
	longSummaryBtn.addEventListener("mouseenter", () => {
		longSummaryBtn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
	});
	longSummaryBtn.addEventListener("mouseleave", () => {
		longSummaryBtn.style.boxShadow = "none";
	});
	longSummaryBtn.addEventListener("click", () => {
		if (onLongSummary) {
			onLongSummary(chunkIndices);
		}
	});
	groupContainer.appendChild(longSummaryBtn);

	// Short summary button
	const shortSummaryBtn = document.createElement("button");
	shortSummaryBtn.className = "gemini-chunk-short-summary-btn";
	shortSummaryBtn.style.cssText = `
		padding: 10px 20px;
		background: ${colors.surface};
		color: ${colors.primary};
		border: 1px solid ${colors.outline};
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: box-shadow 0.2s;
		font-family: inherit;
	`;
	shortSummaryBtn.textContent = "✨ Short Summary";
	shortSummaryBtn.addEventListener("mouseenter", () => {
		shortSummaryBtn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
	});
	shortSummaryBtn.addEventListener("mouseleave", () => {
		shortSummaryBtn.style.boxShadow = "none";
	});
	shortSummaryBtn.addEventListener("click", () => {
		if (onShortSummary) {
			onShortSummary(chunkIndices);
		}
	});
	groupContainer.appendChild(shortSummaryBtn);

	// Add summary text container (initially hidden)
	const summaryTextContainer = document.createElement("div");
	summaryTextContainer.className = "gemini-summary-text-container";
	summaryTextContainer.setAttribute("data-group-start", startIndex);
	summaryTextContainer.setAttribute("data-group-end", endIndex);
	summaryTextContainer.style.cssText = `
		display: none;
		background: transparent;
		border: none;
		margin: 16px 0;
		padding: 0;
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
		color: inherit;
	`;
	groupContainer.appendChild(summaryTextContainer);

	return groupContainer;
}

/**
 * Calculate where to insert summary button groups
 * Returns an array of chunk index ranges where summary buttons should appear
 *
 * @param {number} totalChunks - Total number of chunks
 * @param {number} chunkSummaryCount - Number of chunks per summary group (default: 2)
 * @returns {Array<{startIndex: number, endIndex: number, indices: Array<number>}>}
 */
export function calculateSummaryPositions(
	totalChunks,
	chunkSummaryCount = DEFAULT_CHUNK_SUMMARY_COUNT,
) {
	if (totalChunks <= 0) return [];

	const summaryPositions = [];
	let currentIndex = 0;

	while (currentIndex < totalChunks) {
		const startIndex = currentIndex;
		const endIndex = Math.min(
			currentIndex + chunkSummaryCount - 1,
			totalChunks - 1,
		);

		const indices = [];
		for (let i = startIndex; i <= endIndex; i++) {
			indices.push(i);
		}

		summaryPositions.push({
			startIndex,
			endIndex,
			indices,
		});

		currentIndex += chunkSummaryCount;
	}

	console.log(
		`[ChunkSummaryUI] Calculated ${summaryPositions.length} summary groups for ${totalChunks} chunks (every ${chunkSummaryCount} chunks)`,
	);

	return summaryPositions;
}

/**
 * Insert summary button groups into a container at appropriate positions
 * @param {HTMLElement} container - Container element to insert summary groups into
 * @param {Array<HTMLElement>} chunkElements - Array of chunk content elements (in order)
 * @param {number} chunkSummaryCount - Number of chunks per summary group
 * @param {Function} onLongSummary - Callback for long summary
 * @param {Function} onShortSummary - Callback for short summary
 */
export function insertSummaryGroups(
	container,
	chunkElements,
	chunkSummaryCount,
	onLongSummary,
	onShortSummary,
) {
	if (!container || !chunkElements || chunkElements.length === 0) {
		console.warn(
			"[ChunkSummaryUI] Invalid parameters for insertSummaryGroups",
		);
		return;
	}

	const totalChunks = chunkElements.length;
	const summaryPositions = calculateSummaryPositions(
		totalChunks,
		chunkSummaryCount,
	);

	// Insert summary groups BEFORE each group of chunks
	summaryPositions.forEach((position, groupIndex) => {
		const { startIndex, endIndex, indices } = position;

		// Find the first chunk element of this group
		// Insert summary banner BEFORE the first chunk
		const firstChunkElement = chunkElements[startIndex];
		if (firstChunkElement && firstChunkElement.parentNode === container) {
			const summaryGroup = createSummaryButtonGroup(
				startIndex,
				endIndex,
				indices,
				onLongSummary,
				onShortSummary,
			);

			// Insert before the first chunk in the group
			container.insertBefore(summaryGroup, firstChunkElement);

			console.log(
				`[ChunkSummaryUI] Inserted summary group ${
					groupIndex + 1
				} before chunk ${startIndex}`,
			);
		}
	});
}

/**
 * Create a main summary button group (for the entire content at top)
 * @param {number} totalChunks - Total number of chunks
 * @param {Function} onLongSummary - Callback for long summary (receives all chunk indices)
 * @param {Function} onShortSummary - Callback for short summary (receives all chunk indices)
 * @param {Function|null} onEnhance - Callback for enhance/re-enhance button
 * @returns {HTMLElement} The main summary button group
 */
export function createMainSummaryGroup(
	totalChunks,
	onLongSummary,
	onShortSummary,
	onEnhance = null,
) {
	const colors = getThemeColors();
	const allIndices = Array.from({ length: totalChunks }, (_, i) => i);

	const groupContainer = document.createElement("div");
	groupContainer.className = "gemini-main-summary-group";
	groupContainer.style.cssText = `
		display: flex;
		gap: 12px;
		padding: 16px;
		background: ${colors.surfaceVariant};
		border: 1px solid ${colors.outline};
		border-radius: 4px;
		margin: 20px 0;
		justify-content: center;
		flex-wrap: wrap;
	`;

	const label = document.createElement("div");
	label.style.cssText = `
		flex: 0 0 100%;
		text-align: center;
		color: ${colors.onSurface};
		font-weight: 600;
		font-size: 16px;
		margin-bottom: 8px;
	`;
	label.textContent = "Full Chapter Summary";
	groupContainer.appendChild(label);

	// Long summary button
	const longSummaryBtn = document.createElement("button");
	longSummaryBtn.className = "gemini-main-long-summary-btn";
	longSummaryBtn.style.cssText = `
		padding: 10px 20px;
		background: ${colors.primary};
		color: #ffffff;
		border: 1px solid ${colors.outline};
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: box-shadow 0.2s;
		font-family: inherit;
	`;
	longSummaryBtn.textContent = "📝 Long Summary";
	longSummaryBtn.addEventListener("mouseenter", () => {
		longSummaryBtn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
	});
	longSummaryBtn.addEventListener("mouseleave", () => {
		longSummaryBtn.style.boxShadow = "none";
	});
	longSummaryBtn.addEventListener("click", () => {
		if (onLongSummary) {
			onLongSummary(allIndices);
		}
	});
	groupContainer.appendChild(longSummaryBtn);

	// Short summary button
	const shortSummaryBtn = document.createElement("button");
	shortSummaryBtn.className = "gemini-main-short-summary-btn";
	shortSummaryBtn.style.cssText = `
		padding: 10px 20px;
		background: ${colors.surface};
		color: ${colors.primary};
		border: 1px solid ${colors.outline};
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: box-shadow 0.2s;
		font-family: inherit;
	`;
	shortSummaryBtn.textContent = "✨ Short Summary";
	shortSummaryBtn.addEventListener("mouseenter", () => {
		shortSummaryBtn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
	});
	shortSummaryBtn.addEventListener("mouseleave", () => {
		shortSummaryBtn.style.boxShadow = "none";
	});
	shortSummaryBtn.addEventListener("click", () => {
		if (onShortSummary) {
			onShortSummary(allIndices);
		}
	});
	groupContainer.appendChild(shortSummaryBtn);

	// Add enhance/re-enhance button if callback provided
	if (onEnhance) {
		const enhanceBtn = document.createElement("button");
		enhanceBtn.className = "gemini-enhance-btn";
		enhanceBtn.style.cssText = `
			padding: 10px 20px;
			background: ${colors.surface};
			color: #bab9a0;
			border: 1px solid ${colors.outline};
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			font-weight: 600;
			transition: box-shadow 0.2s;
			font-family: inherit;
		`;
		enhanceBtn.textContent = "⚡ Enhance Chapter";
		enhanceBtn.addEventListener("mouseenter", () => {
			enhanceBtn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
		});
		enhanceBtn.addEventListener("mouseleave", () => {
			enhanceBtn.style.boxShadow = "none";
		});
		enhanceBtn.addEventListener("click", () => {
			onEnhance();
		});
		groupContainer.appendChild(enhanceBtn);
	}

	// Add summary text container (initially hidden)
	const summaryTextContainer = document.createElement("div");
	summaryTextContainer.className =
		"gemini-summary-text-container gemini-main-summary-text";
	summaryTextContainer.setAttribute("data-group-start", "0");
	summaryTextContainer.setAttribute(
		"data-group-end",
		String(totalChunks - 1),
	);
	summaryTextContainer.style.cssText = `
		display: none;
		background: transparent;
		border: none;
		margin: 16px 0;
		padding: 0;
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
		color: inherit;
	`;
	groupContainer.appendChild(summaryTextContainer);

	return groupContainer;
}

export default {
	createSummaryButtonGroup,
	calculateSummaryPositions,
	insertSummaryGroups,
	createMainSummaryGroup,
};
