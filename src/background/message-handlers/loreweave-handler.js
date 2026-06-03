/**
 * Background message handler for LoreWeave graphify requests.
 *
 * Receives { action: "loreweave-graphify", chapterText, epochOrder, epochLabel, domainId? }
 * domainId may be passed explicitly per-novel; falls back to global config (legacy).
 */

import { graphifyChapter } from "../loreweave/graphify-service.js";

export default {
	action: "loreweave-graphify",

	handler(message, sendResponse) {
		const { chapterText, epochOrder, epochLabel, domainId: messageDomainId } = message;

		browser.storage.local
			.get([
				"apiKey",
				"modelEndpoint",
				"loreWeaveUrl",
				"loreWeaveToken",
				"loreWeaveUserId",
			])
			.then(async (config) => {
				// Ensure UUID exists
				let userId = config.loreWeaveUserId;
				if (!userId) {
					userId = crypto.randomUUID
						? crypto.randomUUID()
						: `lw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
					await browser.storage.local.set({ loreWeaveUserId: userId });
				}
				// Per-novel domain ID takes priority over any global fallback
				const effectiveDomainId = messageDomainId || "";
				return graphifyChapter(
					chapterText,
					{ ...config, loreWeaveDomainId: effectiveDomainId, loreWeaveUserId: userId },
					epochOrder ?? 0,
					epochLabel ?? `Epoch ${epochOrder ?? 0}`,
				);
			})
			.then((stats) => sendResponse({ success: true, stats }))
			.catch((err) => {
				console.error("[LoreWeave] graphify error:", err);
				sendResponse({ success: false, error: err.message });
			});

		return true;
	},
};
