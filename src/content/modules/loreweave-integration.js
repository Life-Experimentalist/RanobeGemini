/**
 * LoreWeave auto-integration \u{2014} fires after chapter enhancement completes.
 *
 * Reads the loreWeaveAutoGraphify flag from storage. If enabled and a
 * LoreWeave backend is configured, sends the chapter text to the background
 * service worker for graphify processing. Fire-and-forget \u{2014} does not block
 * the enhancement UI.
 */

/**
 * @param {string} chapterText      - Plain text of the enhanced/original chapter
 * @param {Object} [novelMetadata]  - Optional metadata from the site handler
 * @param {number|string} [novelMetadata.chapter] - Chapter number
 */
export async function maybeSendToLoreWeave(chapterText, novelMetadata) {
	try {
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

		const epochOrder = Number.isFinite(chapterNum) ? chapterNum : Date.now();
		const epochLabel = Number.isFinite(chapterNum)
			? `Chapter ${String(chapterNum).padStart(4, "0")}`
			: `ts_${Date.now()}`;

		browser.runtime.sendMessage({
			action: "loreweave-graphify",
			chapterText,
			epochOrder,
			epochLabel,
		});
	} catch {
		// Silently ignore \u{2014} never disrupt the reading experience
	}
}
