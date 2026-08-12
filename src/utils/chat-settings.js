/**
 * Story Chat settings — the one place that turns stored values into the
 * settings the chat actually runs with.
 *
 * The settings page and the background handler both go through here, so a
 * stored value that is missing, stale, or hand-edited resolves the same way on
 * both sides instead of each applying its own fallbacks.
 */

import {
	CHAT_SETTINGS_KEY,
	CHAT_SETTINGS_DEFAULTS,
	CHAT_MAX_HISTORY_MIN,
	CHAT_MAX_HISTORY_MAX,
} from "./constants.js";

export { CHAT_SETTINGS_KEY, CHAT_SETTINGS_DEFAULTS };

/**
 * Coerce a stored blob into a complete, in-range settings object.
 * @param {object} [stored]
 * @returns {{useCurrentChapter: boolean, useChronicle: boolean, useLoreWeave: boolean, maxHistory: number}}
 */
export function normalizeChatSettings(stored) {
	const s = { ...CHAT_SETTINGS_DEFAULTS, ...(stored || {}) };

	const parsed = parseInt(s.maxHistory, 10);
	const maxHistory = Number.isFinite(parsed)
		? Math.min(CHAT_MAX_HISTORY_MAX, Math.max(CHAT_MAX_HISTORY_MIN, parsed))
		: CHAT_SETTINGS_DEFAULTS.maxHistory;

	return {
		useCurrentChapter: !!s.useCurrentChapter,
		useChronicle: !!s.useChronicle,
		useLoreWeave: !!s.useLoreWeave,
		maxHistory,
	};
}

/**
 * Read the user's chat settings. Falls back to defaults if storage is
 * unreadable — the chat degrades to its documented behaviour rather than
 * refusing to answer.
 * @returns {Promise<ReturnType<typeof normalizeChatSettings>>}
 */
export async function getChatSettings() {
	try {
		const stored = await browser.storage.local.get(CHAT_SETTINGS_KEY);
		return normalizeChatSettings(stored?.[CHAT_SETTINGS_KEY]);
	} catch {
		return normalizeChatSettings(null);
	}
}
