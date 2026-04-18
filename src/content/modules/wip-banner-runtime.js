/**
 * Work-in-progress enhancement banner runtime extracted from content.js.
 */

export function createWorkInProgressBannerRuntime({
	completedChunks,
	totalChunks,
	state = "processing",
	wordCounts = null,
	documentRef = document,
	handleCancelEnhancement,
	handleToggleAllChunks,
}) {
	const safeTotal = Number.isFinite(totalChunks) && totalChunks > 0 ? totalChunks : 1;
	const clampedCompleted = Math.max(0, Math.min(completedChunks || 0, safeTotal));
	const progressPercent = Math.round((clampedCompleted / safeTotal) * 100);

	const isComplete = state === "complete" || clampedCompleted >= safeTotal;
	const isPaused = state === "paused";

	const titleText = isComplete
		? "Enhancement Complete"
		: isPaused
			? "Enhancement Paused"
			: "Enhancing Content";

	const statusLine = isComplete
		? `All ${safeTotal} chunk${safeTotal > 1 ? "s" : ""} completed.`
		: isPaused
			? `Enhancement paused at ${clampedCompleted} of ${safeTotal} chunks.`
			: `Completed ${clampedCompleted} of ${safeTotal} chunks.`;

	let wordCountHTML = "";
	if (
		wordCounts &&
		typeof wordCounts.original === "number" &&
		typeof wordCounts.enhanced === "number"
	) {
		const diff = wordCounts.enhanced - wordCounts.original;
		const diffPercent =
			wordCounts.original > 0
				? Math.round((diff / wordCounts.original) * 100)
				: 0;
		const diffColor = diff > 0 ? "#4ade80" : diff < 0 ? "#f87171" : "#94a3b8";
		const diffSign = diff > 0 ? "+" : "";

		wordCountHTML = `
				<div style="margin: 12px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 13px;">
					<div style="display: flex; justify-content: space-around; text-align: center; flex-wrap: wrap; gap: 10px;">
						<div>
							<div style="color: #94a3b8; font-size: 11px; margin-bottom: 4px;">Original</div>
							<div style="font-weight: 600;">${wordCounts.original.toLocaleString()} words</div>
						</div>
						<div>
							<div style="color: #94a3b8; font-size: 11px; margin-bottom: 4px;">Enhanced</div>
							<div style="font-weight: 600;">${wordCounts.enhanced.toLocaleString()} words</div>
						</div>
						<div>
							<div style="color: #94a3b8; font-size: 11px; margin-bottom: 4px;">Difference</div>
							<div style="font-weight: 600; color: ${diffColor};">${diffSign}${diff.toLocaleString()} (${diffSign}${diffPercent}%)</div>
						</div>
					</div>
				</div>
			`;
	}

	const banner = documentRef.createElement("div");
	banner.className = "gemini-wip-banner";
	banner.style.cssText = `
			background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
			border: 1px solid #475569;
			border-radius: 8px;
			padding: 16px;
			margin: 16px 0;
			box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
			color: #e5e7eb;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
			box-sizing: border-box;
			width: 100%;
			max-width: 100%;
			overflow: hidden;
		`;

	banner.innerHTML = `
			<div style="display: flex; align-items: center; margin-bottom: 8px;">
				<span style="font-size: 18px; margin-right: 10px;">${isComplete ? "✅" : isPaused ? "⏸️" : "⏳"}</span>
				<span style="font-weight: bold; font-size: 16px;">${titleText}</span>
			</div>
			<div style="width: 100%; margin: 10px 0; background: #475569; height: 10px; border-radius: 5px; overflow: hidden;">
				<div class="progress-bar" style="width: ${progressPercent}%; background: ${isComplete ? "#4ade80" : isPaused ? "#fb923c" : "#3b82f6"}; height: 100%; transition: width 0.3s ease;"></div>
			</div>
			<div class="progress-text" style="font-size: 14px; color: #cbd5e1;">
				${statusLine}
			</div>
			${wordCountHTML}
			${
				isComplete
					? ""
					: `
				<button class="gemini-cancel-btn" style="margin-top: 10px; padding: 8px 14px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; transition: background 0.2s; font-weight: 600; min-height: 40px; max-width: 100%;">
					Cancel Enhancement
				</button>
			`
			}
			${
				isComplete || isPaused
					? `
				<button class="gemini-wip-show-original-btn" style="margin-top: 10px; padding: 8px 14px; background: #334155; color: #e2e8f0; border: 1px solid #475569; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; min-height: 40px; max-width: 100%;">
					👁 Show Original
				</button>
			`
					: ""
			}
		`;

	if (!isComplete) {
		const cancelBtn = banner.querySelector(".gemini-cancel-btn");
		if (cancelBtn) {
			cancelBtn.addEventListener("click", handleCancelEnhancement);
			cancelBtn.addEventListener("mouseenter", () => {
				cancelBtn.style.background = "#b91c1c";
			});
			cancelBtn.addEventListener("mouseleave", () => {
				cancelBtn.style.background = "#dc3545";
			});
		}
	}

	const showOrigBtn = banner.querySelector(".gemini-wip-show-original-btn");
	if (showOrigBtn) {
		showOrigBtn.addEventListener("click", () => {
			handleToggleAllChunks?.();
			const masterToggle = documentRef.querySelector(
				".gemini-master-toggle-all-btn",
			);
			const isNowOriginal = masterToggle?.getAttribute("data-showing") === "original";
			showOrigBtn.textContent = isNowOriginal
				? "✨ Show Enhanced"
				: "👁 Show Original";
		});
	}

	return banner;
}

export async function showWorkInProgressBannerRuntime({
	completedChunks,
	totalChunks,
	state = "processing",
	wordCounts = null,
	documentRef = document,
	findContentArea,
	loadDomIntegrationModule,
	createWorkInProgressBanner,
}) {
	const newBanner = createWorkInProgressBanner(
		completedChunks,
		totalChunks,
		state,
		wordCounts,
	);

	const domIntegration = await loadDomIntegrationModule?.();
	if (domIntegration?.upsertWorkInProgressBannerRuntime) {
		domIntegration.upsertWorkInProgressBannerRuntime({
			documentRef,
			newBanner,
			findContentArea,
		});
		return;
	}

	const existingBanner = documentRef.querySelector(".gemini-wip-banner");
	if (existingBanner && existingBanner.parentNode) {
		existingBanner.parentNode.replaceChild(newBanner, existingBanner);
		return;
	}

	const contentArea = findContentArea?.();
	if (!contentArea) return;

	const chunkedContainer = documentRef.getElementById("gemini-chunked-content");
	if (chunkedContainer) {
		contentArea.insertBefore(newBanner, chunkedContainer);
		return;
	}

	contentArea.insertBefore(newBanner, contentArea.firstChild);
}

export default {
	createWorkInProgressBannerRuntime,
	showWorkInProgressBannerRuntime,
};
