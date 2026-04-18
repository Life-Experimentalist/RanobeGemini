/**
 * Enhancement attribution helpers extracted from content.js.
 */

export function addModelAttributionRuntime({
	modelInfo,
	documentRef = document,
	windowRef = window,
	findContentArea,
	escapeHtml,
}) {
	if (!modelInfo) return;

	const contentArea =
		typeof findContentArea === "function" ? findContentArea() : null;
	if (!contentArea) return;

	if (documentRef.querySelector(".gemini-model-attribution")) return;

	const isDarkMode =
		documentRef.querySelector(
			'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth',
		) || windowRef.matchMedia("(prefers-color-scheme: dark)").matches;

	const attribution = documentRef.createElement("div");
	attribution.className = "gemini-model-attribution";
	attribution.style.cssText = `
			margin: 1.5em 0;
			padding: 8px 12px;
			background: ${isDarkMode ? "#2a2a2a" : "#f5f5f5"};
			border-radius: 6px;
			font-size: 12px;
			color: ${isDarkMode ? "#999" : "#666"};
			text-align: center;
		`;

	const modelName = modelInfo.name || modelInfo.modelId || "Gemini AI";
	const safeModelName =
		typeof escapeHtml === "function"
			? escapeHtml(modelName)
			: String(modelName);
	attribution.innerHTML = `
			<span style="opacity: 0.7;">Enhanced by</span>
			<span style="font-weight: 600;">${safeModelName}</span>
			<span style="opacity: 0.7;">via Ranobe Gemini</span>
		`;

	contentArea.appendChild(attribution);
}

export default {
	addModelAttributionRuntime,
};
