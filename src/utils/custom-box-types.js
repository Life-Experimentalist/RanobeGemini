/**
 * Custom Content Box Types
 * Allows users to define their own named CSS classes for content boxes,
 * style them independently, and have Gemini instructed to use them.
 *
 * Storage key: rg_custom_box_types
 * Schema: Array of CustomBoxType objects (see typedef below)
 *
 * @typedef {Object} CustomBoxType
 * @property {string}  id              - Unique identifier (timestamp-based)
 * @property {string}  name            - Display name shown in settings UI
 * @property {string}  className       - CSS class Gemini should apply (no dot prefix)
 * @property {string}  emoji           - Optional emoji for visual identification
 * @property {string}  backgroundColor - CSS background-color value
 * @property {string}  borderColor     - CSS border-color value
 * @property {string}  textColor       - CSS color value
 * @property {string}  borderStyle     - CSS border-style (solid/dashed/dotted)
 * @property {string}  borderWidth     - CSS border-left-width (e.g. "3px")
 * @property {string}  promptHint      - Free-text hint for Gemini: when to apply this class
 * @property {string}  cssOverride     - Raw CSS override (replaces generated CSS when non-empty)
 */

export const CUSTOM_BOX_TYPES_KEY = "rg_custom_box_types";

/**
 * Generate injected CSS for all custom box types.
 * @param {CustomBoxType[]} boxTypes
 * @returns {string}
 */
export function generateCSSForBoxTypes(boxTypes) {
	if (!Array.isArray(boxTypes) || boxTypes.length === 0) return "";

	return boxTypes
		.map((box) => {
			if (!box.className) return "";
			const cls = `.${box.className.replace(/\./g, "")}`;

			if (box.cssOverride && box.cssOverride.trim()) {
				// User-supplied raw CSS wins entirely
				return `/* Custom box: ${box.name || box.className} */\n${box.cssOverride.trim()}`;
			}

			const bg = box.backgroundColor || "rgba(20, 20, 30, 0.9)";
			const border = box.borderColor || "rgba(130, 130, 200, 0.6)";
			const text = box.textColor || "#d0d0e0";
			const bStyle = box.borderStyle || "solid";
			const bWidth = box.borderWidth || "3px";

			return `/* Custom box: ${box.name || box.className} */
${cls} {
	background-color: ${bg};
	border: 1px ${bStyle} ${border};
	border-left: ${bWidth} ${bStyle} ${border};
	border-radius: 6px;
	padding: 12px 16px 12px 18px;
	margin: 18px 0;
	color: ${text};
	font-size: 13.5px;
	line-height: 1.7;
	box-sizing: border-box;
	width: 100%;
}`;
		})
		.filter(Boolean)
		.join("\n\n");
}

/**
 * Build the prompt appendix that tells Gemini about available custom box classes.
 * @param {CustomBoxType[]} boxTypes
 * @returns {string}  Empty string if no box types defined.
 */
export function buildCustomBoxPromptAppendix(boxTypes) {
	if (!Array.isArray(boxTypes) || boxTypes.length === 0) return "";

	const lines = [
		"**Custom Content Box Classes (user-defined):**",
		"Wrap matching content in the following `<div>` tags when appropriate:",
	];

	for (const box of boxTypes) {
		if (!box.className) continue;
		const emoji = box.emoji ? `${box.emoji} ` : "";
		const hint = box.promptHint ? ` — ${box.promptHint}` : "";
		lines.push(
			`- \`<div class="${box.className}">\`: ${emoji}${box.name || box.className}${hint}.`,
		);
	}

	return lines.join("\n");
}

/**
 * Load custom box types from browser storage.
 * @returns {Promise<CustomBoxType[]>}
 */
export async function getCustomBoxTypes() {
	try {
		const result = await browser.storage.local.get(CUSTOM_BOX_TYPES_KEY);
		return Array.isArray(result[CUSTOM_BOX_TYPES_KEY])
			? result[CUSTOM_BOX_TYPES_KEY]
			: [];
	} catch (_err) {
		return [];
	}
}

/**
 * Save custom box types to browser storage.
 * @param {CustomBoxType[]} boxTypes
 * @returns {Promise<void>}
 */
export async function saveCustomBoxTypes(boxTypes) {
	await browser.storage.local.set({
		[CUSTOM_BOX_TYPES_KEY]: Array.isArray(boxTypes) ? boxTypes : [],
	});
}

/**
 * Create a new CustomBoxType with sensible defaults.
 * @param {Partial<CustomBoxType>} [overrides]
 * @returns {CustomBoxType}
 */
export function createBoxType(overrides = {}) {
	return {
		id: `rg-box-${Date.now()}`,
		name: "New Box",
		className: "rg-custom-box",
		emoji: "📦",
		backgroundColor: "rgba(20, 20, 30, 0.9)",
		borderColor: "rgba(130, 130, 200, 0.6)",
		textColor: "#d0d0e0",
		borderStyle: "solid",
		borderWidth: "3px",
		promptHint: "",
		cssOverride: "",
		...overrides,
	};
}
