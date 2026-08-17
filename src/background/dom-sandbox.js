/**
 * DOM sandbox — mounts a fetched page into the current document so that the
 * website handlers, which were written against a live page, can scrape it.
 *
 * This only runs in contexts that own a disposable document: the Chromium
 * offscreen document, or the Firefox background event page. It must never be
 * used on a page the user is looking at — mounting swaps out
 * `document.documentElement` wholesale.
 *
 * While a document is mounted, `pageLocation()` (see `utils/dom-env.js`) is
 * pointed at the fetched URL, so handlers derive novel IDs and canonical links
 * from the page they are actually reading rather than from the host page.
 */

import { setPageUrlOverride } from "../utils/dom-env.js";

/**
 * Whether this context can mount a fetched document.
 * @returns {boolean}
 */
export function canMountDocument() {
	return (
		typeof document !== "undefined" &&
		typeof DOMParser !== "undefined" &&
		Boolean(document.documentElement)
	);
}

/**
 * Parse `html`, mount it as the current document, run `fn`, then restore.
 *
 * Mounting replaces the whole `<html>` element (not just `<body>`) because
 * several handlers read `<meta>` and `<link rel="canonical">` out of the head.
 *
 * @template T
 * @param {string} html - Raw HTML of the fetched page.
 * @param {string} url - URL the HTML came from; drives `pageLocation()`.
 * @param {() => T | Promise<T>} fn - Scraping work to run against the document.
 * @returns {Promise<T>}
 */
export async function withMountedDocument(html, url, fn) {
	if (!canMountDocument()) {
		throw new Error(
			"withMountedDocument() called in a context without a document",
		);
	}

	const parsed = new DOMParser().parseFromString(html, "text/html");
	if (!parsed?.documentElement) {
		throw new Error("Fetched page could not be parsed as HTML");
	}

	const incoming = document.adoptNode(parsed.documentElement);
	const original = document.documentElement;

	setPageUrlOverride(url);
	document.replaceChild(incoming, original);
	try {
		return await fn();
	} finally {
		document.replaceChild(original, incoming);
		setPageUrlOverride(null);
	}
}
