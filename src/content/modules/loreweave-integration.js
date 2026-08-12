/**
 * LoreWeave auto-integration — fires after chapter enhancement completes.
 *
 * Gated on the experimental opt-in, then on the loreWeaveAutoGraphify flag and
 * a configured backend. If all three hold, sends the chapter text to the
 * background service worker for graphify processing. Fire-and-forget — does not
 * block the enhancement UI.
 */

import { isLoreWeaveEnabled } from "../../utils/loreweave-gate.js";

/**
 * @param {string} chapterText      - Plain text of the enhanced/original chapter
 * @param {Object} [novelMetadata]  - Optional metadata from the site handler
 * @param {number|string} [novelMetadata.chapter] - Chapter number
 */
export async function maybeSendToLoreWeave(chapterText, novelMetadata) {
	try {
		if (!(await isLoreWeaveEnabled())) return;

		const stored = await browser.storage.local.get([
			"loreWeaveAutoGraphify",
			"loreWeaveUrl",
			"loreWeaveDomainId",
		]);

		if (
			!stored.loreWeaveAutoGraphify ||
			!stored.loreWeaveUrl ||
			!stored.loreWeaveDomainId
		) {
			return;
		}

		const chapterNum = novelMetadata?.chapter
			? parseInt(novelMetadata.chapter, 10)
			: NaN;

		const epochOrder = Number.isFinite(chapterNum)
			? chapterNum
			: Date.now();
		const epochLabel = Number.isFinite(chapterNum)
			? `Chapter ${String(chapterNum).padStart(4, "0")}`
			: `ts_${Date.now()}`;

		browser.runtime.sendMessage({
			action: "loreweave-graphify",
			chapterText,
			epochOrder,
			epochLabel,
			// Pass the domain ID so the handler doesn't have to re-read storage
			domainId: stored.loreWeaveDomainId,
		});
	} catch {
		// Silently ignore — never disrupt the reading experience
	}
}
