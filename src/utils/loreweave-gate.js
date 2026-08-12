/**
 * LoreWeave experimental gate.
 *
 * LoreWeave is a separate project that is still maturing. Ranobe Gemini ships
 * the integration off: its UI is hidden and no request reaches a LoreWeave
 * backend until the user turns it on in Settings -> Advanced -> Experimental.
 *
 * Every LoreWeave entry point — content script, background message handlers,
 * and the queue's optional graphify step — checks this before doing anything.
 */

import { LOREWEAVE_EXPERIMENTAL_ENABLED } from "./constants.js";

/** Storage key holding the user's opt-in. */
export const LOREWEAVE_EXPERIMENTAL_KEY = "loreWeaveExperimental";

/** Shown wherever a gated action is refused. */
export const LOREWEAVE_DISABLED_MESSAGE =
	"LoreWeave is an experimental integration and is currently turned off. Enable it in Settings → Advanced → Experimental features.";

/**
 * @returns {Promise<boolean>} Whether the user has opted in.
 */
export async function isLoreWeaveEnabled() {
	try {
		const stored = await browser.storage.local.get(
			LOREWEAVE_EXPERIMENTAL_KEY,
		);
		const value = stored?.[LOREWEAVE_EXPERIMENTAL_KEY];
		return typeof value === "boolean"
			? value
			: LOREWEAVE_EXPERIMENTAL_ENABLED;
	} catch {
		// Storage unavailable — fail closed.
		return LOREWEAVE_EXPERIMENTAL_ENABLED;
	}
}

/**
 * @param {boolean} enabled
 * @returns {Promise<void>}
 */
export async function setLoreWeaveEnabled(enabled) {
	await browser.storage.local.set({
		[LOREWEAVE_EXPERIMENTAL_KEY]: Boolean(enabled),
	});
}
