/**
 * Background message handler for LoreWeave graphify requests.
 *
 * Receives { action: "loreweave-graphify", chapterText, epochOrder, epochLabel }
 * from content.js or the popup, loads config, and calls the graphify service.
 */

import { graphifyChapter } from "../loreweave/graphify-service.js";

export default {
	action: "loreweave-graphify",

	handler(message, sendResponse) {
		const { chapterText, epochOrder, epochLabel } = message;

		browser.storage.local
			.get([
				"apiKey",
				"modelEndpoint",
				"loreWeaveUrl",
				"loreWeaveDomainId",
				"loreWeaveToken",
			])
			.then((config) =>
				graphifyChapter(
					chapterText,
					config,
					epochOrder ?? 0,
					epochLabel ?? `Epoch ${epochOrder ?? 0}`,
				),
			)
			.then((stats) => sendResponse({ success: true, stats }))
			.catch((err) => {
				console.error("[LoreWeave] graphify error:", err);
				sendResponse({ success: false, error: err.message });
			});

		return true; // keep message channel open for async response
	},
};
