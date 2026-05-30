/**
 * Background message handler for LoreWeave connectivity checks.
 *
 * Receives { action: "loreweave-ping", url: string }
 * and responds with { success: true, reachable: boolean }.
 */

import { pingLoreWeave } from "../loreweave/loreweave-client.js";

export default {
	action: "loreweave-ping",

	handler(message, sendResponse) {
		const { url } = message;
		pingLoreWeave(url || "")
			.then((reachable) => sendResponse({ success: true, reachable }))
			.catch(() => sendResponse({ success: true, reachable: false }));
		return true;
	},
};
