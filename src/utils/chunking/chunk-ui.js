/**
 * Chunk UI Components
 * Creates and manages UI elements for individual chunks
 */

/**
 * Detect if dark mode is active
 * Checks handler's site-specific theme detection first, then falls back to extension theme
 * @returns {boolean} True if dark mode
 */
export function isDarkMode() {
	// Check if handler provides site-specific theme
	if (typeof window !== "undefined" && window.__ranobeGeminiHandler) {
		const handler = window.__ranobeGeminiHandler;
		if (typeof handler.getPageTheme === "function") {
			const pageTheme = handler.getPageTheme();
			if (pageTheme === "dark") return true;
			if (pageTheme === "light") return false;
			// 'auto' falls through to extension theme detection
		}
	}

	// Fall back to extension theme setting
	const root = document.documentElement;
	const theme = root.getAttribute("data-theme");
	if (theme === "light") return false;
	if (theme === "dark") return true;
	// Auto mode - check system preference
	return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true;
}

/**
 * Get theme-aware colors (Material Design palette)
 * @returns {Object} Color palette object
 */
export function getThemeColors() {
	const dark = isDarkMode();
	return dark
		? {
				primary: "#bb86fc",
				onSurface: "#e1e1e1",
				onSurfaceVariant: "#b3b3b3",
				surface: "#121212",
				surfaceVariant: "#1e1e1e",
				outline: "#3a3a3a",
				outlineVariant: "#4a4a4a",
				overlay: "rgba(255, 255, 255, 0.08)",
				overlayHover: "rgba(255, 255, 255, 0.12)",
				error: "#cf6679",
				success: "#81c784",
			}
		: {
				primary: "#6200ee",
				onSurface: "#1c1c1c",
				onSurfaceVariant: "#5f5f5f",
				surface: "#ffffff",
				surfaceVariant: "#f5f5f5",
				outline: "#d0d0d0",
				outlineVariant: "#e0e0e0",
				overlay: "rgba(0, 0, 0, 0.05)",
				overlayHover: "rgba(0, 0, 0, 0.08)",
				error: "#b00020",
				success: "#4caf50",
			};
}

/**
 * Create a chunk banner with controls (regenerate, toggle, delete)
 * @param {number} chunkIndex - Index of the chunk (0-based)
 * @param {number} totalChunks - Total number of chunks
 * @param {string} status - Status: 'pending', 'processing', 'completed', 'error', 'cached'
 * @param {string} errorMessage - Error message if status is 'error'
 * @param {Object} callbacks - Event handler callbacks { onRegenerate, onToggle, onDelete }
 * @param {Object} cacheInfo - Cache metadata { fromCache: boolean, timestamp: number }
 * @returns {HTMLElement} The chunk banner element
 */
export function createChunkBanner(
	chunkIndex,
	totalChunks,
	status = "pending",
	errorMessage = null,
	callbacks = {},
	cacheInfo = null,
	wordCounts = null,
	threshold = 25,
) {
	const banner = document.createElement("div");
	banner.className = `gemini-chunk-banner chunk-banner-${chunkIndex}`;
	banner.setAttribute("data-chunk-index", chunkIndex);
	banner.setAttribute("data-chunk-status", status);

	// Determine if showing cache status
	const isFromCache = cacheInfo?.fromCache === true || status === "cached";
	const cacheTimestamp = cacheInfo?.timestamp;

	// Status icon and text
	let statusIcon = "⏳";
	let statusText = "Pending";
	let statusColor = "#666";

	// Cache time display
	let cacheTimeText = "";
	if (isFromCache && cacheTimestamp) {
		const age = Date.now() - cacheTimestamp;
		const hours = Math.floor(age / (1000 * 60 * 60));
		const days = Math.floor(hours / 24);
		const timeAgo = days > 0 ? `${days}d ago` : `${hours}h ago`;
		cacheTimeText = ` (${timeAgo})`;
	}

	switch (status) {
		case "processing":
			statusIcon = "⏳";
			statusText = "Processing...";
			statusColor = "#4285f4";
			break;
		case "completed":
			statusIcon = isFromCache ? "✓" : "✅";
			statusText = isFromCache ? `Cached${cacheTimeText}` : "Complete";
			statusColor = "#0f9d58";
			break;
		case "error":
			statusIcon = "❌";
			statusText = errorMessage || "Error";
			statusColor = "#ea4335";
			break;
		case "cached":
			statusIcon = "✓";
			statusText = `Cached${cacheTimeText}`;
			statusColor = "#0f9d58";
			break;
		default:
			statusIcon = "⏳";
			statusText = "Pending";
			statusColor = "#666";
	}

	const colors = getThemeColors();

	// Cache status styling - subtle green tint for cached chunks
	let bannerBg = colors.surfaceVariant;
	let bannerBorder = colors.outline;

	if (isFromCache) {
		const dark = isDarkMode();
		if (dark) {
			bannerBg = "#1e3a1e"; // Dark green tint
			bannerBorder = "#2e7d32"; // Green border
		} else {
			bannerBg = "#f1f8f4"; // Light green tint
			bannerBorder = "#4caf50"; // Green border
		}
	}

	// Prepare word count display
	let wordCountDisplay = "";
	let thresholdWarning = "";
	if (wordCounts && (wordCounts.original || wordCounts.enhanced)) {
		const original = wordCounts.original || 0;
		const enhanced = wordCounts.enhanced || 0;
		const diff = enhanced - original;
		const percentChange =
			original > 0 ? ((diff / original) * 100).toFixed(1) : 0;
		const absDiffPercent = Math.abs(percentChange);

		let diffColor = "#999"; // Gray for no change
		let diffSign = "";
		if (diff > 0) {
			diffColor = "#4caf50"; // Green for increase
			diffSign = "+";
		} else if (diff < 0) {
			diffColor = "#ef4444"; // Red for decrease
		}

		// Check if threshold is exceeded
		if (absDiffPercent > threshold) {
			thresholdWarning = `
				<div style="
					display: flex;
					align-items: center;
					gap: 8px;
					background: rgba(239, 68, 68, 0.1);
					border-left: 3px solid #ef4444;
					padding: 8px 12px;
					border-radius: 4px;
					font-size: 12px;
					color: #fca5a5;
				">
					<span style="font-size: 16px;">⚠️</span>
					<span>Word count change (${percentChange}%) exceeds threshold (${threshold}%)</span>
				</div>
			`;
		}

		wordCountDisplay = `
			<div style="display: flex; gap: 16px; align-items: center; font-size: 12px; color: ${colors.onSurfaceVariant};">
				<span>📄 ${original} → ${enhanced}</span>
				<span style="color: ${diffColor}; font-weight: 600;">${diffSign}${diff} (${percentChange}%)</span>
			</div>
		`;
	}

	banner.innerHTML = `
		<div style="
			display: flex;
			flex-direction: column;
			gap: 8px;
			padding: 12px 16px;
			background: ${bannerBg};
			border: 2px solid ${bannerBorder};
			border-radius: 8px;
			margin: 16px 0;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
			color: ${colors.onSurface};
			box-sizing: border-box;
			width: 100%;
			max-width: 100%;
		">
			<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
				<div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
					<span style="font-size: 18px;">${statusIcon}</span>
					<span style="
						font-weight: 500;
						color: ${status === "error" ? colors.error : colors.onSurface};
					">${statusText}</span>
					<span style="
						padding: 4px 12px;
						background: ${colors.overlay};
						border: 1px solid ${colors.outline};
						border-radius: 12px;
						font-size: 12px;
						font-weight: 600;
						color: ${colors.onSurfaceVariant};
						white-space: nowrap;
					">Chunk ${chunkIndex + 1}/${totalChunks}</span>
				</div>
				<div style="display: flex; gap: 8px; flex-wrap: wrap;" class="chunk-controls">
					<div class="chunk-navigation" style="display: flex; gap: 4px; margin-right: 8px; border-right: 1px solid ${colors.outline}; padding-right: 8px; flex-shrink: 0;">
						<!-- Navigation buttons will be added here -->
					</div>
					<!-- Action buttons will be added here -->
				</div>
			</div>
			${wordCountDisplay}
			${thresholdWarning}
		</div>
	`;

	const controlsContainer = banner.querySelector(".chunk-controls");
	const navigationContainer = banner.querySelector(".chunk-navigation");

	// Material Design button helper
	const createMaterialButton = (
		text,
		className,
		title,
		colorType = "primary",
	) => {
		const colors = getThemeColors();
		const btn = document.createElement("button");
		btn.className = className;
		btn.setAttribute("data-chunk-index", chunkIndex);
		btn.title = title;

		let bgColor, textColor, hoverBg;
		switch (colorType) {
			case "error":
				bgColor = colors.error;
				textColor = "#ffffff";
				hoverBg = colors.error + "dd";
				break;
			case "neutral":
				bgColor = colors.overlay;
				textColor = colors.onSurface;
				hoverBg = colors.overlayHover;
				break;
			default: // primary
				bgColor = colors.overlay;
				textColor = colors.primary;
				hoverBg = colors.overlayHover;
		}

		btn.style.cssText = `
			padding: 6px 12px;
			background: ${bgColor};
			color: ${textColor};
			border: 1px solid ${colors.outline};
			border-radius: 4px;
			cursor: pointer;
			font-size: 13px;
			font-weight: 500;
			transition: background 0.2s, box-shadow 0.2s;
			font-family: inherit;
			min-height: 36px;
			white-space: nowrap;
		`;
		btn.textContent = text;

		btn.addEventListener("mouseenter", () => {
			btn.style.background = hoverBg;
			btn.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)";
		});
		btn.addEventListener("mouseleave", () => {
			btn.style.background = bgColor;
			btn.style.boxShadow = "none";
		});

		return btn;
	};

	// Add navigation buttons
	const prevBtn = createMaterialButton(
		"⬆️",
		"gemini-chunk-prev-btn",
		"Go to previous chunk",
		"neutral",
	);
	prevBtn.style.minWidth = "32px";
	prevBtn.style.padding = "4px 8px";
	if (chunkIndex === 0) {
		prevBtn.disabled = true;
		prevBtn.style.opacity = "0.5";
		prevBtn.style.cursor = "not-allowed";
	}
	prevBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (chunkIndex > 0) {
			const allBanners = document.querySelectorAll(
				".gemini-chunk-banner",
			);
			const prevBanner = allBanners[chunkIndex - 1];
			if (prevBanner) {
				prevBanner.scrollIntoView({
					behavior: "smooth",
					block: "start",
				});
			}
		}
	});
	navigationContainer.appendChild(prevBtn);

	const nextBtn = createMaterialButton(
		"⬇️",
		"gemini-chunk-next-btn",
		"Go to next chunk",
		"neutral",
	);
	nextBtn.style.minWidth = "32px";
	nextBtn.style.padding = "4px 8px";
	if (chunkIndex === totalChunks - 1) {
		nextBtn.disabled = true;
		nextBtn.style.opacity = "0.5";
		nextBtn.style.cursor = "not-allowed";
	}
	nextBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (chunkIndex < totalChunks - 1) {
			const allBanners = document.querySelectorAll(
				".gemini-chunk-banner",
			);
			const nextBanner = allBanners[chunkIndex + 1];
			if (nextBanner) {
				nextBanner.scrollIntoView({
					behavior: "smooth",
					block: "start",
				});
			}
		}
	});
	navigationContainer.appendChild(nextBtn);

	// Add regenerate button if completed or error
	if (status === "completed" || status === "error" || status === "cached") {
		const regenerateBtn = createMaterialButton(
			"🔄 Regenerate",
			"gemini-chunk-regenerate-btn",
			"Regenerate this chunk",
			"primary",
		);
		regenerateBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (callbacks.onRegenerate) {
				callbacks.onRegenerate(chunkIndex);
			}
		});
		controlsContainer.appendChild(regenerateBtn);
	}

	// Add toggle button if completed or cached
	if (status === "completed" || status === "cached") {
		const toggleBtn = createMaterialButton(
			"👁 Show Original",
			"gemini-chunk-toggle-btn",
			"Toggle original/enhanced",
			"neutral",
		);
		toggleBtn.setAttribute("data-showing", "enhanced");
		toggleBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (callbacks.onToggle) {
				callbacks.onToggle(chunkIndex);
			}
		});
		controlsContainer.appendChild(toggleBtn);
	}

	// Add delete button if completed or cached
	if (status === "completed" || status === "cached") {
		const deleteBtn = createMaterialButton(
			"🗑 Delete",
			"gemini-chunk-delete-btn",
			"Delete cached data for this chunk",
			"error",
		);
		deleteBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (callbacks.onDelete) {
				callbacks.onDelete(chunkIndex);
			}
		});
		controlsContainer.appendChild(deleteBtn);
	}

	return banner;
}

/**
 * Create a chunk content container
 * @param {number} chunkIndex - Chunk index (0-based)
 * @param {string} originalContent - Original (plain text or HTML) content
 * @param {string} enhancedContent - Enhanced HTML content, or null if not enhanced yet
 * @returns {HTMLElement} The chunk content container
 */
export function createChunkContentContainer(
	chunkIndex,
	originalContent,
	enhancedContent = null,
) {
	const container = document.createElement("div");
	container.className = "gemini-chunk-content";
	container.setAttribute("data-chunk-index", chunkIndex);
	container.setAttribute("data-original-chunk-content", originalContent);

	if (enhancedContent) {
		container.innerHTML = enhancedContent;
		container.setAttribute("data-chunk-enhanced", "true");
		container.setAttribute("data-showing", "enhanced");
	} else {
		// Show original content for now
		container.innerHTML = `<div style="white-space: pre-wrap;">${escapeHtml(
			originalContent,
		)}</div>`;
		container.setAttribute("data-chunk-enhanced", "false");
		container.setAttribute("data-showing", "original");
	}

	return container;
}

/**
 * Update a chunk banner's status
 * @param {number} chunkIndex - The chunk index
 * @param {string} status - New status ('pending', 'processing', 'completed', 'error', 'cached')
 * @param {string} errorMessage - Error message if applicable
 * @param {number} totalChunks - Total number of chunks
 * @returns {HTMLElement|null} The new banner element, or null if old banner not found
 */
export function updateChunkBannerStatus(
	chunkIndex,
	status,
	errorMessage = null,
	totalChunks = null,
) {
	const existingBanner = document.querySelector(
		`.chunk-banner-${chunkIndex}`,
	);
	if (!existingBanner) {
		console.warn(
			`[ChunkUI] No banner found for chunk ${chunkIndex} to update`,
		);
		return null;
	}

	// Determine total chunks from existing banner or parameter
	const total =
		totalChunks ||
		parseInt(
			existingBanner
				.closest("[data-total-chunks]")
				?.getAttribute("data-total-chunks") ||
				document.querySelectorAll(".gemini-chunk-banner").length,
		);

	const newBanner = createChunkBanner(
		chunkIndex,
		total,
		status,
		errorMessage,
	);
	existingBanner.replaceWith(newBanner);
	return newBanner;
}

/**
 * Create a work-in-progress banner showing chunk processing
 * Material Design style, theme-aware
 * @param {number} currentChunk - Current chunk being processed (1-based for display)
 * @param {number} totalChunks - Total number of chunks
 * @returns {HTMLElement} The WIP banner element
 */
export function createWorkInProgressBanner(currentChunk, totalChunks) {
	const progressPercent = Math.round((currentChunk / totalChunks) * 100);
	const colors = getThemeColors();

	const banner = document.createElement("div");
	banner.className = "gemini-wip-banner";
	banner.style.cssText = `
		padding: 16px 20px;
		background: ${colors.surfaceVariant};
		border: 1px solid ${colors.outline};
		color: ${colors.onSurface};
		border-radius: 4px;
		margin: 16px 0;
		text-align: center;
	`;

	banner.innerHTML = `
		<div style="display: flex; flex-direction: column; gap: 12px;">
			<div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
				<span style="font-size: 20px;">⏳</span>
				<span style="font-weight: 600; font-size: 16px; color: ${colors.onSurface};">Processing Content</span>
			</div>
			<div style="font-size: 14px; color: ${colors.onSurfaceVariant};">
				Processing chunk ${currentChunk} of ${totalChunks} (${progressPercent}% complete)
			</div>
			<div style="background: ${colors.outlineVariant}; border-radius: 4px; height: 8px; overflow: hidden;">
				<div style="
					width: ${progressPercent}%;
					height: 100%;
					background: ${colors.primary};
					border-radius: 4px;
					transition: width 0.3s ease;
				"></div>
			</div>
		</div>
	`;

	return banner;
}

/**
 * Create master banner showing overall enhancement statistics
 * Material Design style - only shown when multiple chunks
 * @param {number} originalWordCount - Original content word count
 * @param {number} enhancedWordCount - Enhanced content word count
 * @param {number} totalChunks - Total number of chunks
 * @param {boolean} isFromCache - Whether loaded from cache
 * @param {Object|null} modelInfo - Model info object with name/provider
 * @param {Object|null} cacheInfo - Cache metadata { timestamp: number }
 * @returns {HTMLElement} The master banner element
 */
export function createMasterBanner(
	originalWordCount,
	enhancedWordCount,
	totalChunks,
	isFromCache = false,
	modelInfo = null,
	cacheInfo = null,
) {
	const colors = getThemeColors();
	const wordDiff = enhancedWordCount - originalWordCount;
	const percentChange =
		originalWordCount > 0
			? ((wordDiff / originalWordCount) * 100).toFixed(1)
			: 0;

	const isIncrease = wordDiff > 0;
	const changeColor = isIncrease ? colors.success : colors.error;
	const changeIcon = isIncrease ? "↑" : "↓";

	const modelName = modelInfo?.name || "AI";
	const modelProvider = modelInfo?.provider || "Ranobe Gemini";
	let cacheLabel = "";
	let cacheIcon = "";
	if (isFromCache) {
		cacheIcon = "✓ ";
		if (cacheInfo?.timestamp) {
			const age = Date.now() - cacheInfo.timestamp;
			const hours = Math.floor(age / (1000 * 60 * 60));
			const days = Math.floor(hours / 24);
			const timeAgo = days > 0 ? `${days}d ago` : `${hours}h ago`;
			cacheLabel = ` • Cached ${timeAgo}`;
		}
	}
	const modelDisplay = `${cacheIcon}Enhanced with ${modelProvider}${
		modelName !== "AI" ? ` (${modelName})` : ""
	}${cacheLabel}`;

	const banner = document.createElement("div");
	banner.className = "gemini-master-banner";
	banner.style.cssText = `
		padding: 16px 20px;
		background: ${colors.surface};
		border: 2px solid ${colors.primary};
		border-radius: 4px;
		margin: 20px 0;
		color: ${colors.onSurface};
		box-sizing: border-box;
		width: 100%;
		max-width: 100%;
	`;

	banner.innerHTML = `
		<div style="display: flex; flex-direction: column; gap: 12px;">
			<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
				<div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1 1 200px;">
					<span style="font-size: 20px; flex-shrink: 0;">✨</span>
					<span style="font-weight: 600; font-size: 15px; overflow-wrap: break-word; word-break: break-word;">${modelDisplay}</span>
				</div>
				<div style="display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0;" class="master-controls">
					<button class="gemini-master-toggle-all-btn" style="
						padding: 6px 12px;
						background: ${colors.overlay};
						color: ${colors.primary};
						border: 1px solid ${colors.outline};
						border-radius: 4px;
						cursor: pointer;
						font-size: 13px;
						font-weight: 500;
						font-family: inherit;
						min-height: 36px;
						white-space: nowrap;
					">👁 Show All Original</button>
					<button class="gemini-master-delete-all-btn" style="
						padding: 6px 12px;
						background: ${colors.error};
						color: #ffffff;
						border: 1px solid ${colors.outline};
						border-radius: 4px;
						cursor: pointer;
						font-size: 13px;
						font-weight: 500;
						font-family: inherit;
						min-height: 36px;
						white-space: nowrap;
					">🗑 Delete All</button>
				</div>
			</div>
			<div style="display: flex; gap: 16px; font-size: 13px; color: ${colors.onSurfaceVariant}; flex-wrap: wrap;">
				<div>
					<span style="font-weight: 500;">Chunks:</span>
					<span style="font-weight: 600; color: ${colors.onSurface};">${totalChunks}</span>
				</div>
				<div>
					<span style="font-weight: 500;">Original:</span>
					<span style="font-weight: 600; color: ${colors.onSurface};">${originalWordCount.toLocaleString()} w</span>
				</div>
				<div>
					<span style="font-weight: 500;">Enhanced:</span>
					<span style="font-weight: 600; color: ${colors.onSurface};">${enhancedWordCount.toLocaleString()} w</span>
				</div>
				<div>
					<span style="font-weight: 500;">Change:</span>
					<span style="font-weight: 600; color: ${changeColor};">
						${changeIcon} ${Math.abs(wordDiff).toLocaleString()} w (${percentChange}%)
					</span>
				</div>
			</div>
		</div>
	`;

	return banner;
}

/**
 * Simple HTML escape function
 * @param {string} str - String to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(str) {
	if (!str) return "";
	const div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
}

export default {
	createChunkBanner,
	createChunkContentContainer,
	updateChunkBannerStatus,
	createWorkInProgressBanner,
	createMasterBanner,
	isDarkMode,
	getThemeColors,
};
