/**
 * Background message handler for LoreWeave connectivity checks.
 *
 * Receives { action: "loreweave-ping", url: string }
 * and responds with { success: true, reachable: boolean }.
 *
 * Gated: with the experimental integration off, no request is made at all.
 */

import { pingLoreWeave } from "../loreweave/loreweave-client.js";
import {
	isLoreWeaveEnabled,
	LOREWEAVE_DISABLED_MESSAGE,
} from "../../utils/loreweave-gate.js";

export default {
	action: "loreweave-ping",

	handler(message, sendResponse) {
		(async () => {
			if (!(await isLoreWeaveEnabled())) {
				sendResponse({
					success: false,
					reachable: false,
					error: LOREWEAVE_DISABLED_MESSAGE,
				});
				return;
			}
			try {
				const reachable = await pingLoreWeave(message.url || "");
				sendResponse({ success: true, reachable });
			} catch {
				sendResponse({ success: true, reachable: false });
			}
		})();

		return true;
	},
};
