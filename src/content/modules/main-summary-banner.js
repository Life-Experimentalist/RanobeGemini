/**
 * Runtime for the main chunk-summary banner shown after chunked enhancement.
 */

export function createMainSummaryBannerRuntime({
	modelInfo,
	totalChunks,
	completedChunks,
	findContentArea,
	countWords,
	handleToggleAllChunks,
	handleDeleteAllChunks,
	documentRef = document,
	windowRef = window,
}) {
	const contentArea = findContentArea?.();
	const originalText = contentArea?.getAttribute("data-original-text") || "";

	// Calculate total enhanced word count from all chunks.
	let totalEnhancedWords = 0;
	const allChunkContents = documentRef.querySelectorAll(
		".gemini-chunk-content",
	);
	allChunkContents.forEach((chunk) => {
		const enhancedContent =
			chunk.getAttribute("data-enhanced-chunk-content") ||
			chunk.innerHTML;
		totalEnhancedWords += countWords(enhancedContent);
	});

	const originalWordCount = countWords(originalText);
	const wordDifference = totalEnhancedWords - originalWordCount;
	const percentChange =
		originalWordCount > 0
			? Math.round((wordDifference / originalWordCount) * 100)
			: 0;
	const changeSymbol = wordDifference >= 0 ? "+" : "-";

	const modelName = modelInfo?.name || "AI";
	const modelProvider = modelInfo?.provider || "Ranobe Gemini";
	const modelDisplay = `Enhanced with ${modelProvider}${
		modelName !== "AI" ? ` (${modelName})` : ""
	}`;

	const allSuccess = completedChunks === totalChunks;
	const statusEmoji = allSuccess ? "✨" : "⚠️";
	const statusText = allSuccess
		? `All ${totalChunks} chunks enhanced`
		: `${completedChunks}/${totalChunks} chunks enhanced`;

	const banner = documentRef.createElement("div");
	banner.className = "gemini-main-summary-banner";
	banner.id = "gemini-main-summary-banner";

	const isDarkMode =
		documentRef.querySelector(
			'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth',
		) || windowRef.matchMedia("(prefers-color-scheme: dark)").matches;

	const bgColor = isDarkMode ? "#2a2a3c" : "#f0f8ff";
	const borderColor = isDarkMode ? "#4a4a5c" : "#a8d4f0";
	const textColor = isDarkMode ? "#e0e0e0" : "#333";
	const subtleColor = isDarkMode ? "#aaa" : "#666";

	banner.style.cssText = `
		margin: 15px 0;
		padding: 15px 18px;
		background: ${bgColor};
		border-radius: 10px;
		border: 2px solid ${borderColor};
		box-shadow: 0 3px 10px rgba(0,0,0,0.1);
	`;

	banner.innerHTML = `
		<div style="display: flex; flex-direction: column; gap: 12px;">
			<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
				<div style="display: flex; align-items: center; gap: 10px;">
					<span style="font-size: 22px;">${statusEmoji}</span>
					<div>
						<div style="font-weight: bold; font-size: 16px; color: ${textColor};">${modelDisplay}</div>
						<div style="font-size: 12px; color: ${subtleColor};">${statusText}</div>
					</div>
				</div>
				<div style="display: flex; align-items: center; gap: 8px;">
					<button class="gemini-main-toggle-btn" data-showing="enhanced" style="
						padding: 6px 12px;
						background: #4285f4;
						color: white;
						border: none;
						border-radius: 6px;
						cursor: pointer;
						font-size: 12px;
						font-weight: 600;
					">📄 Show All Original</button>
					<button class="gemini-main-delete-btn" title="Delete all cached enhanced content" style="
						padding: 6px 12px;
						background: #d32f2f;
						color: white;
						border: none;
						border-radius: 6px;
						cursor: pointer;
						font-size: 12px;
						font-weight: 600;
					">🗑️ Delete Cache</button>
				</div>
			</div>
			<div style="padding-top: 10px; border-top: 1px solid ${
				isDarkMode ? "#444" : "#ddd"
			};">
				<div style="font-size: 14px; color: ${textColor}; font-family: monospace;">
					Total Words: ${originalWordCount.toLocaleString()} → ${totalEnhancedWords.toLocaleString()}
					<span style="color: ${
						wordDifference >= 0 ? "#28a745" : "#dc3545"
					}; font-weight: bold; margin-left: 8px;">
						(${changeSymbol}${Math.abs(wordDifference).toLocaleString()}, ${changeSymbol}${Math.abs(percentChange)}%)
					</span>
				</div>
			</div>
		</div>
	`;

	const toggleAllBtn = banner.querySelector(".gemini-main-toggle-btn");
	if (toggleAllBtn) {
		toggleAllBtn.addEventListener("click", (event) => {
			event.preventDefault();
			handleToggleAllChunks();
		});
	}

	const deleteAllBtn = banner.querySelector(".gemini-main-delete-btn");
	if (deleteAllBtn) {
		deleteAllBtn.addEventListener("click", async (event) => {
			event.preventDefault();
			if (
				windowRef.confirm(
					"Are you sure you want to delete all cached enhanced content for this chapter?",
				)
			) {
				await handleDeleteAllChunks();
			}
		});
	}

	return banner;
}

export default {
	createMainSummaryBannerRuntime,
};
