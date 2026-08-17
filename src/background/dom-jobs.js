/**
 * DOM jobs — units of work that need a real document.
 *
 * These run either inline (Firefox background event page) or inside the
 * Chromium offscreen document. Both entry points go through
 * `background/dom-host.js`, which decides which. Payloads and results must stay
 * JSON-serialisable, because on Chromium they cross a message boundary.
 *
 * Site handlers were written for the content-script context: they read
 * `document` freely and assume `pageLocation()` is the novel's URL. Keeping the
 * *entire* handler interaction inside a job is what makes that assumption safe —
 * the background never touches a handler directly.
 */

import { withMountedDocument } from "./dom-sandbox.js";
import { setPageUrlOverride } from "../utils/dom-env.js";
import { debugLog, debugError } from "../utils/logger.js";
import handlerManager from "../utils/website-handlers/handler-manager.js";
import { LOREWEAVE_DOM_JOBS } from "./loreweave/chapter-scrape-job.js";

/**
 * Discriminator on offscreen job messages, so the background's own onMessage
 * listener can ignore them.
 */
export const OFFSCREEN_TARGET = "offscreen-dom";

const FETCH_TIMEOUT_MS = 15000;

/**
 * A desktop UA: several sites serve a cut-down mobile page otherwise, and the
 * handlers expect the desktop markup.
 */
const DESKTOP_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/**
 * Fetch a page as text, with a timeout.
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchHtml(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			method: "GET",
			credentials: "omit",
			headers: { "User-Agent": DESKTOP_UA },
			signal: controller.signal,
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} ${response.statusText}`);
		}
		return await response.text();
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Strip anything the structured-clone algorithm would choke on. Handlers
 * occasionally hand back DOM nodes or functions inside metadata objects; those
 * survive an inline call but kill an offscreen round-trip, so drop them here
 * and keep both paths behaving identically.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function toPlainData(value) {
	try {
		return JSON.parse(JSON.stringify(value ?? null));
	} catch {
		return null;
	}
}

/**
 * Ask the handler which URL carries the metadata for `handlerType`.
 * Must be called with the page-URL override already pointing at the page the
 * handler should believe it is on.
 *
 * @param {object} handler
 * @param {string} handlerType
 * @param {string} currentUrl
 * @returns {string|null}
 */
function resolveSourceUrl(handler, handlerType, currentUrl) {
	switch (handlerType) {
		case "chapter_embedded":
			// Metadata is on the chapter page itself.
			return currentUrl || null;

		case "dedicated_page":
			return (
				handler.getMetadataSourceUrl?.() ||
				handler.getNovelPageUrl?.() ||
				null
			);

		case "chapter_embedded_requires_redirect":
			return handler.getMetadataSourceUrl?.() || null;

		default:
			throw new Error(`Unknown metadata handler type: ${handlerType}`);
	}
}

export const DOM_JOBS = {
	/**
	 * Resolve the metadata source page for a novel, fetch it, and scrape it with
	 * the site handler.
	 *
	 * Resolution is attempted twice. The first attempt runs against the host
	 * document (effectively empty), which is enough for the handlers that derive
	 * the URL from `pageLocation()` alone — the overwhelming majority — and costs
	 * no network. Handlers whose resolution needs the chapter markup (a
	 * breadcrumb link, a canonical tag) return null there, so the chapter page is
	 * fetched and mounted and resolution is retried against it.
	 *
	 * @param {{handlerDomain: string, currentUrl: string, handlerType: string}} payload
	 * @returns {Promise<object|null>} Plain metadata, or null if nothing was found.
	 */
	async fetchNovelMetadata({ handlerDomain, currentUrl, handlerType }) {
		const handler = await handlerManager.getHandlerByDomain(handlerDomain);
		if (!handler) {
			throw new Error(
				`No handler registered for domain: ${handlerDomain}`,
			);
		}
		if (typeof handler.extractNovelMetadata !== "function") {
			throw new Error(
				`Handler for ${handlerDomain} does not implement extractNovelMetadata()`,
			);
		}

		// Attempt 1 — URL arithmetic only.
		let sourceUrl;
		setPageUrlOverride(currentUrl);
		try {
			sourceUrl = resolveSourceUrl(handler, handlerType, currentUrl);
		} finally {
			setPageUrlOverride(null);
		}

		// Attempt 2 — the handler needs to look at the chapter page.
		let chapterHtml = null;
		if (!sourceUrl) {
			debugLog(
				`[DomJobs] Resolving metadata URL needs the chapter page: ${currentUrl}`,
			);
			chapterHtml = await fetchHtml(currentUrl);
			sourceUrl = await withMountedDocument(chapterHtml, currentUrl, () =>
				resolveSourceUrl(handler, handlerType, currentUrl),
			);
		}

		if (!sourceUrl) {
			debugError(
				`[DomJobs] Handler for ${handlerDomain} could not resolve a metadata URL for ${currentUrl}`,
			);
			return null;
		}

		const html =
			sourceUrl === currentUrl && chapterHtml !== null
				? chapterHtml
				: await fetchHtml(sourceUrl);

		const metadata = await withMountedDocument(html, sourceUrl, () =>
			handler.extractNovelMetadata(),
		);
		if (!metadata) return null;

		const plain = toPlainData(metadata);
		if (!plain) return null;

		plain.fetchedAt = Date.now();
		plain.fetchStrategy = handlerType;
		plain.fetchedFromUrl = sourceUrl;
		if (sourceUrl !== currentUrl) plain.redirectedFromUrl = currentUrl;
		return plain;
	},

	...LOREWEAVE_DOM_JOBS,
};

/**
 * Run a job by name.
 *
 * @param {string} op
 * @param {object} payload
 * @returns {Promise<unknown>}
 */
export async function runJob(op, payload) {
	const job = DOM_JOBS[op];
	if (!job) throw new Error(`Unknown DOM job: ${op}`);
	return job(payload || {});
}
