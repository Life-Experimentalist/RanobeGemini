/**
 * Enhanced-content banner factory extracted from content.js.
 */

export function createEnhancedBannerRuntime({
	originalContent,
	enhancedContent,
	modelInfo,
	showDeleteButton = false,
	cacheInfo = null,
	documentRef = document,
	windowRef = window,
	countWords,
}) {
	if (typeof countWords !== "function") {
		return null;
	}

	const originalWordCount = countWords(originalContent);
	const enhancedWordCount = countWords(enhancedContent);
	const wordDifference = enhancedWordCount - originalWordCount;
	const percentChange =
		originalWordCount > 0
			? Math.round((wordDifference / originalWordCount) * 100)
			: 0;
	const changeSymbol = wordDifference >= 0 ? "+" : "-";

	const modelName = modelInfo?.name || "AI";
	const modelProvider = modelInfo?.provider || "Ranobe Gemini";

	const isFromCache = cacheInfo?.fromCache === true;
	const cacheTimestamp = cacheInfo?.timestamp;
	let cacheLabel = "";
	let cacheIcon = "";

	if (isFromCache && cacheTimestamp) {
		const age = Date.now() - cacheTimestamp;
		const hours = Math.floor(age / (1000 * 60 * 60));
		const days = Math.floor(hours / 24);
		const timeAgo = days > 0 ? `${days}d ago` : `${hours}h ago`;
		cacheLabel = ` \u{2022} Cached ${timeAgo}`;
		cacheIcon = "\u{2713} ";
	}

	const modelDisplay = `${cacheIcon}Enhanced with ${modelProvider}${
		modelName !== "AI" ? ` (${modelName})` : ""
	}${cacheLabel}`;

	const banner = documentRef.createElement("div");
	banner.className = "gemini-enhanced-banner";

	let bannerBg = "#f7f7f7";
	let bannerBorder = "#ddd";
	let bannerColor = "inherit";

	const isDark =
		documentRef.querySelector(
			'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth',
		) || windowRef.matchMedia("(prefers-color-scheme: dark)").matches;

	if (isDark) {
		bannerBg = "#2c2c2c";
		bannerBorder = "#444";
		bannerColor = "#e0e0e0";
	}

	if (isFromCache) {
		if (isDark) {
			bannerBg = "#1e3a1e";
			bannerBorder = "#2e7d32";
		} else {
			bannerBg = "#f1f8f4";
			bannerBorder = "#4caf50";
		}
	}

	banner.style.cssText = `
        margin: 15px 0;
        padding: 15px;
        background-color: ${bannerBg};
        border-radius: 8px;
        border: 2px solid ${bannerBorder};
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        color: ${bannerColor};
    `;

	const deleteButtonHtml = showDeleteButton
		? '<button class="gemini-delete-cache-btn" title="Delete cached enhanced content" aria-label="Delete cached enhanced content" style="padding: 8px 12px; margin-left: 8px; background-color: #d32f2f; color: white; border: 1px solid #b71c1c; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px;">\u{1F5D1}\u{FE0F}</button>'
		: "";

	banner.innerHTML = `
        <div style="display: flex; flex-direction: column; width: 100%;">
			<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center;">
                        <span style="font-size: 18px; margin-right: 5px;">\u{2728}</span>
                        <span style="font-weight: bold; margin: 0 10px; font-size: 16px;">${modelDisplay}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="gemini-toggle-btn">Show Original</button>
                        ${deleteButtonHtml}
                    </div>
                </div>
            <div style="width: 100%; font-size: 14px; color: #555; padding-top: 8px; border-top: 1px solid #eee;">
                <span style="font-family: monospace;">
                    Words: ${originalWordCount.toLocaleString()} \u{2192} ${enhancedWordCount.toLocaleString()}
                    <span style="color: ${
						wordDifference >= 0 ? "#28a745" : "#dc3545"
					}; font-weight: bold;">
                        (${changeSymbol}${wordDifference.toLocaleString()}, ${changeSymbol}${Math.abs(
							percentChange,
						)}%)
                    </span>
                </span>
            </div>
        </div>
    `;

	return banner;
}

export default {
	createEnhancedBannerRuntime,
};
