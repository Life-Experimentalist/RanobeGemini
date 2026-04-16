/**
 * Extension bridge utilities.
 *
 * Purpose:
 * - Keep third-party extension integration modular and opt-in.
 * - Allow handlers to read extension-provided status signals through a shared API.
 * - Keep per-site bridge toggles aligned with library site settings.
 */

const EXTENSION_BRIDGES = [
	{
		id: "betterfiction",
		shelfId: "fanfiction",
		settingKey: "betterFictionSyncEnabled",
		datasetKey: "rgBetterfictionSync",
		statusSelector:
			"#organizer-status-selecter select[aria-label='Change reading status']",
		defaultEnabled: true,
	},
	{
		id: "ao3-experimental-status",
		shelfId: "ao3",
		settingKey: "experimentalAo3BridgeEnabled",
		datasetKey: "rgAo3ExperimentalBridge",
		defaultEnabled: false,
		statusSelector: "html[data-rg-ao3-bridge-status]",
		statusAttribute: "data-rg-ao3-bridge-status",
	},
];

function normalizeReadingStatus(rawValue) {
	const normalized = String(rawValue || "").trim().toLowerCase();
	if (!normalized) return null;

	if (/(complete|completed|finished|done)/.test(normalized)) {
		return "completed";
	}
	if (/(drop|dropped|abandon)/.test(normalized)) {
		return "dropped";
	}
	if (/(hold|paused|hiatus)/.test(normalized)) {
		return "on-hold";
	}
	if (/(plan|to\s*read|want\s*to\s*read|queued?)/.test(normalized)) {
		return "to-read";
	}
	if (/(reading|current|in\s*progress)/.test(normalized)) {
		return "reading";
	}

	return null;
}

export function getExtensionBridgeDefinitions() {
	return EXTENSION_BRIDGES.map((bridge) => ({ ...bridge }));
}

/**
 * Apply bridge enable/disable flags to document dataset based on site settings.
 *
 * @param {Object} options
 * @param {Object} [options.siteSettings] - Site settings object from storage.
 * @param {string|null} [options.activeShelfId] - Current active shelf id.
 * @param {Document} [options.documentRef] - Target document.
 */
export function applyExtensionBridgeFlags({
	siteSettings = {},
	activeShelfId = null,
	documentRef = document,
} = {}) {
	if (!documentRef?.body) return;

	for (const bridge of EXTENSION_BRIDGES) {
		if (activeShelfId && bridge.shelfId !== activeShelfId) continue;

		const shelfSettings = siteSettings?.[bridge.shelfId] || {};
		const configured = shelfSettings[bridge.settingKey];
		const enabled =
			typeof configured === "boolean"
				? configured
				: bridge.defaultEnabled !== false;
		documentRef.body.dataset[bridge.datasetKey] = enabled
			? "true"
			: "false";
	}
}

/**
 * Read normalized status from a configured extension bridge.
 *
 * @param {string} bridgeId
 * @param {Object} [options]
 * @param {Document} [options.documentRef]
 * @returns {string|null}
 */
export function readExtensionBridgeStatus(
	bridgeId,
	{ documentRef = document } = {},
) {
	const bridge = EXTENSION_BRIDGES.find((item) => item.id === bridgeId);
	if (!bridge || !documentRef?.querySelector) return null;

	const syncFlag = documentRef.body?.dataset?.[bridge.datasetKey];
	if (syncFlag === "false") return null;

	const selector = documentRef.querySelector(bridge.statusSelector);
	if (!selector) return null;

	const raw = bridge.statusAttribute
		? selector.getAttribute(bridge.statusAttribute) || ""
		: selector.selectedOptions?.[0]?.textContent || selector.value || "";
	return normalizeReadingStatus(raw);
}
