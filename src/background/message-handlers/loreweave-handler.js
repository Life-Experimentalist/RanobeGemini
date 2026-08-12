/**
 * Background message handler for LoreWeave graphify requests.
 *
 * Receives { action: "loreweave-graphify", chapterText, epochOrder, epochLabel, domainId? }
 * domainId may be passed explicitly per-novel; falls back to global loreWeaveDomainId in storage.
 *
 * Refuses outright unless the user has enabled the experimental integration.
 */

import { graphifyChapter } from "../loreweave/graphify-service.js";
import { debugError } from "../../utils/logger.js";
import {
	isLoreWeaveEnabled,
	LOREWEAVE_DISABLED_MESSAGE,
} from "../../utils/loreweave-gate.js";

async function graphify({ chapterText, epochOrder, epochLabel, domainId }) {
	const [localConfig, syncConfig] = await Promise.all([
		browser.storage.local.get([
			"apiKey",
			"modelEndpoint",
			"loreWeaveUrl",
			"loreWeaveDomainId",
			"loreWeaveChronicleEnabled",
			"loreWeaveWritingStyle",
			"loreWeaveNovelId",
		]),
		browser.storage.sync.get(["loreWeaveAccountKey"]),
	]);

	let accountKey = syncConfig.loreWeaveAccountKey || "";

	// Auto-register on first use if no key exists
	if (!accountKey && localConfig.loreWeaveUrl) {
		try {
			const res = await fetch(
				`${localConfig.loreWeaveUrl}/lw_api/auth/register`,
				{ method: "POST" },
			);
			if (res.ok) {
				const data = await res.json();
				accountKey = data.api_key;
				await browser.storage.sync.set({
					loreWeaveAccountKey: accountKey,
				});
			}
		} catch (error) {
			// Auto-registration is best-effort: LoreWeave is an optional
			// experimental integration, so a failure here must not abort
			// graphify. The call below runs with an empty key and surfaces its
			// own error.
			debugError("LoreWeave auto-registration failed:", error);
		}
	}

	const effectiveDomainId = domainId || localConfig.loreWeaveDomainId || "";
	return graphifyChapter(
		chapterText,
		{
			...localConfig,
			loreWeaveDomainId: effectiveDomainId,
			loreWeaveAccountKey: accountKey,
		},
		epochOrder ?? 0,
		epochLabel ?? `Epoch ${epochOrder ?? 0}`,
	);
}

export default {
	action: "loreweave-graphify",

	handler(message, sendResponse) {
		(async () => {
			if (!(await isLoreWeaveEnabled())) {
				sendResponse({
					success: false,
					error: LOREWEAVE_DISABLED_MESSAGE,
				});
				return;
			}
			try {
				const stats = await graphify(message);
				sendResponse({ success: true, stats });
			} catch (err) {
				debugError("[LoreWeave] graphify error:", err);
				sendResponse({ success: false, error: err.message });
			}
		})();

		return true;
	},
};
