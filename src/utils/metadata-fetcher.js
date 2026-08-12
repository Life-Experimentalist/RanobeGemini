/**
 * Universal Metadata Fetcher
 *
 * Thin background-side facade over the `fetchNovelMetadata` DOM job. All three
 * strategies reduce to the same thing — resolve the page that carries the
 * metadata, fetch it, scrape it with the site handler — so the strategy name is
 * passed straight through:
 *
 * - "chapter_embedded": metadata is on the chapter page itself.
 * - "dedicated_page": metadata is on a separate novel/series page.
 * - "chapter_embedded_requires_redirect": metadata is on an alternative version
 *   of the page (e.g. desktop instead of mobile).
 *
 * The scraping itself happens in `background/dom-jobs.js`, inside a context that
 * owns a throwaway document. This module used to parse the HTML itself and swap
 * it into whatever document happened to be around, which threw on Chromium (a
 * service worker has no `DOMParser`) and scraped the empty background page on
 * Firefox.
 */

import { debugLog, debugError } from "./logger.js";
import { runDomJob } from "../background/dom-host.js";

class MetadataFetcher {
	/**
	 * Fetch metadata using the strategy declared by the handler.
	 *
	 * @param {"chapter_embedded"|"dedicated_page"|"chapter_embedded_requires_redirect"} handlerType
	 * @param {string} currentUrl - URL of the page the request originated from.
	 * @param {Object} handler - The site handler instance (used only for its domain).
	 * @returns {Promise<Object|null>} Complete metadata, or null on failure.
	 */
	static async fetchMetadata(handlerType, currentUrl, handler) {
		if (!currentUrl) {
			debugError("[MetadataFetcher] No URL supplied");
			return null;
		}

		let handlerDomain;
		try {
			handlerDomain = new URL(currentUrl).hostname;
		} catch {
			debugError(`[MetadataFetcher] Not a valid URL: ${currentUrl}`);
			return null;
		}

		try {
			debugLog(
				`[MetadataFetcher] ${handlerType} fetch for ${handlerDomain}`,
			);
			const metadata = await runDomJob("fetchNovelMetadata", {
				handlerDomain,
				currentUrl,
				handlerType,
			});

			if (!metadata) {
				debugError(
					`[MetadataFetcher] No metadata extracted for ${currentUrl}`,
				);
				return null;
			}

			// Let the handler normalise what came back. Safe to call here: it is
			// plain data manipulation, not DOM access.
			return handler?.processRemoteMetadata?.(metadata) || metadata;
		} catch (error) {
			debugError(
				`[MetadataFetcher] ${handlerType} fetch failed for ${currentUrl}:`,
				error,
			);
			return null;
		}
	}

	/**
	 * Validate fetched metadata — ensures essential fields are present.
	 *
	 * @param {Object} metadata
	 * @returns {boolean}
	 */
	static validateMetadata(metadata) {
		if (!metadata) return false;

		const essential = ["title", "author"];
		for (const field of essential) {
			if (!metadata[field]) {
				debugError(
					`[MetadataFetcher] Missing essential field: ${field}`,
				);
				return false;
			}
		}

		return true;
	}
}

export default MetadataFetcher;
