/**
 * LoreWeave chapter-scraping DOM job.
 *
 * The queue manager fetches chapter pages from the background, where Chromium
 * has no `DOMParser`. The parsing half lives here so it can be dispatched
 * through `background/dom-host.js` and run wherever a document exists.
 *
 * Kept in the loreweave/ folder so the shared DOM-job module does not grow
 * LoreWeave-specific selectors.
 */

const CONTENT_SELECTORS = [
	"#chr-content",
	".chr-c",
	"article",
	".chapter-content",
];

const NEXT_LINK_SELECTORS = [
	'a.js-chapter-nav[data-chapter-nav="next"]',
	'a[rel="next"]',
	".chr-nav a:last-child",
];

const NOISE_SELECTOR = "script,style,ins,[class*=ads],[id*=ads]";

export const LOREWEAVE_DOM_JOBS = {
	/**
	 * Pull chapter text and the "next chapter" link out of a fetched page.
	 *
	 * @param {{html: string, url: string}} payload
	 * @returns {{content: string, nextUrl: string|null, words: number}}
	 */
	parseLoreWeaveChapter({ html, url }) {
		const doc = new DOMParser().parseFromString(html, "text/html");

		let contentEl = null;
		for (const selector of CONTENT_SELECTORS) {
			contentEl = doc.querySelector(selector);
			if (contentEl) break;
		}
		contentEl = contentEl || doc.body;

		contentEl
			?.querySelectorAll(NOISE_SELECTOR)
			.forEach((el) => el.remove());

		const content = (
			contentEl?.innerText ||
			contentEl?.textContent ||
			""
		).trim();
		const words = content.split(/\s+/).filter(Boolean).length;

		let nextEl = null;
		for (const selector of NEXT_LINK_SELECTORS) {
			nextEl = doc.querySelector(selector);
			if (nextEl) break;
		}

		let nextUrl =
			nextEl?.getAttribute("data-chapter-url") ||
			nextEl?.getAttribute("href") ||
			null;
		if (nextUrl) {
			try {
				nextUrl = new URL(nextUrl, url).href;
			} catch {
				nextUrl = null;
			}
		}

		return { content, nextUrl, words };
	},
};
