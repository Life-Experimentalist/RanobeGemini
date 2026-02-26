/**
 * Universal Metadata Fetcher
 * Handles both chapter_embedded and dedicated_page handler types
 * Fetches full metadata in background without blocking user interaction
 *
 * Handler Types:
 * - "chapter_embedded": Metadata fully available on current page
 * - "dedicated_page": Metadata requires fetching separate dedicated page
 * - "chapter_embedded_requires_redirect": Metadata requires URL redirect (e.g., mobile -> desktop)
 */

import { debugLog, debugError } from "./logger.js";

class MetadataFetcher {
	/**
	 * Fetch metadata based on handler type strategy
	 * @param {string} handlerType - Handler type: 'chapter_embedded', 'dedicated_page', or 'chapter_embedded_requires_redirect'
	 * @param {string} currentUrl - Current page URL
	 * @param {Object} handler - The handler instance
	 * @returns {Promise<Object|null>} Complete metadata or null on failure
	 */
	static async fetchMetadata(handlerType, currentUrl, handler) {
		try {
			debugLog(
				`[MetadataFetcher] Fetching metadata for type: ${handlerType}`,
			);

			switch (handlerType) {
				case "chapter_embedded":
					// Full metadata available on current page
					return this._fetchChapterEmbeddedMetadata(
						currentUrl,
						handler,
					);

				case "dedicated_page":
					// Need to fetch from dedicated novel page
					return this._fetchDedicatedPageMetadata(
						currentUrl,
						handler,
					);

				case "chapter_embedded_requires_redirect":
					// Metadata requires URL redirect (e.g., mobile -> desktop)
					return this._fetchWithUrlRedirect(currentUrl, handler);

				default:
					debugError(
						`[MetadataFetcher] Unknown handler type: ${handlerType}`,
					);
					return null;
			}
		} catch (error) {
			debugError("[MetadataFetcher] Error fetching metadata:", error);
			return null;
		}
	}

	/**
	 * Chapter Embedded: Extract metadata from current page
	 * Full metadata available on chapter/reading pages
	 * @private
	 */
	static async _fetchChapterEmbeddedMetadata(url, handler) {
		try {
			debugLog(
				"[MetadataFetcher] Using chapter_embedded strategy (local extraction)",
			);

			// Handler's own extraction method (data already in DOM)
			const metadata = handler.extractNovelMetadata();

			if (metadata) {
				metadata.fetchedAt = Date.now();
				metadata.fetchStrategy = "chapter_embedded";
				debugLog(
					"[MetadataFetcher] Successfully extracted chapter_embedded metadata",
				);
				return metadata;
			}

			debugError(
				"[MetadataFetcher] Handler returned null for chapter_embedded metadata",
			);
			return null;
		} catch (error) {
			debugError(
				"[MetadataFetcher] Error in chapter_embedded fetch:",
				error,
			);
			return null;
		}
	}

	/**
	 * Dedicated Page: Fetch and extract metadata from dedicated novel page
	 * Requires fetching a separate URL (e.g., /novels/123/ or /series/123/)
	 * @private
	 */
	static async _fetchDedicatedPageMetadata(url, handler) {
		try {
			debugLog(
				"[MetadataFetcher] Using dedicated_page strategy (fetch + extract)",
			);

			// Get the novel details URL
			const novelPageUrl =
				handler.getMetadataSourceUrl?.() || handler.getNovelPageUrl?.();
			if (!novelPageUrl) {
				debugError(
					"[MetadataFetcher] Could not determine novel page URL from handler",
				);
				return null;
			}

			debugLog(
				`[MetadataFetcher] Fetching from dedicated page: ${novelPageUrl}`,
			);

			// Fetch the dedicated page in background with timeout
			const response = await Promise.race([
				fetch(novelPageUrl, {
					method: "GET",
					credentials: "omit",
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					},
				}),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Fetch timeout")), 15000),
				),
			]);

			if (!response.ok) {
				debugError(
					"[MetadataFetcher] Failed to fetch novel page:",
					response.status,
				);
				return null;
			}

			const html = await response.text();

			// Parse the fetched HTML into an isolated document so we get a
			// proper <body> element for the DOM swap.  Assigning a <div> to
			// document.body is spec-undefined and can corrupt page state.
			const parser = new DOMParser();
			const fetchedDoc = parser.parseFromString(html, "text/html");
			const fetchedBody = document.adoptNode(fetchedDoc.body);

			// Temporarily swap DOM to allow handler extraction
			const originalBody = document.body;

			try {
				// Swap body contents only
				document.documentElement.replaceChild(
					fetchedBody,
					originalBody,
				);

				// Call handler's extraction with the fetched DOM
				const metadata = handler.extractNovelMetadata();

				if (metadata) {
					metadata.fetchedAt = Date.now();
					metadata.fetchStrategy = "dedicated_page";
					metadata.fetchedFromUrl = novelPageUrl;
					debugLog(
						"[MetadataFetcher] Successfully extracted dedicated_page metadata",
					);
					return metadata;
				}

				return null;
			} finally {
				// Restore original DOM
				document.documentElement.replaceChild(
					originalBody,
					fetchedBody,
				);
			}
		} catch (error) {
			debugError(
				"[MetadataFetcher] Error in dedicated_page fetch:",
				error,
			);
			return null;
		}
	}

	/**
	 * Redirect Strategy: Fetch metadata from alternative URL (e.g., desktop version)
	 * Used when mobile/alternative version needs data from primary version
	 * @private
	 */
	static async _fetchWithUrlRedirect(url, handler) {
		try {
			debugLog(
				"[MetadataFetcher] Using redirect strategy (visit alternative URL)",
			);

			// Handler provides the redirect URL (e.g., mobile -> www)
			const redirectUrl = handler.getMetadataSourceUrl?.();
			if (!redirectUrl) {
				debugError(
					"[MetadataFetcher] Handler did not provide metadata source URL",
				);
				return null;
			}

			debugLog(
				`[MetadataFetcher] Redirecting metadata fetch to: ${redirectUrl}`,
			);

			// Fetch from redirect URL
			const response = await Promise.race([
				fetch(redirectUrl, {
					method: "GET",
					credentials: "omit",
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					},
				}),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Fetch timeout")), 15000),
				),
			]);

			if (!response.ok) {
				debugError(
					"[MetadataFetcher] Failed to fetch redirect URL:",
					response.status,
				);
				return null;
			}

			const html = await response.text();
			const parser = new DOMParser();
			const fetchedDoc = parser.parseFromString(html, "text/html");
			const fetchedBody = document.adoptNode(fetchedDoc.body);

			const originalBody = document.body;

			try {
				document.documentElement.replaceChild(
					fetchedBody,
					originalBody,
				);
				const metadata = handler.extractNovelMetadata();

				if (metadata) {
					metadata.fetchedAt = Date.now();
					metadata.fetchStrategy = "redirect";
					metadata.redirectedFromUrl = url;
					metadata.fetchedFromUrl = redirectUrl;
					debugLog(
						"[MetadataFetcher] Successfully extracted redirect metadata",
					);
					return metadata;
				}

				return null;
			} finally {
				document.documentElement.replaceChild(
					originalBody,
					fetchedBody,
				);
			}
		} catch (error) {
			debugError("[MetadataFetcher] Error in redirect fetch:", error);
			return null;
		}
	}

	/**
	 * Validate fetched metadata
	 * Ensures essential fields are present
	 * @param {Object} metadata - Metadata to validate
	 * @returns {boolean} True if metadata is valid
	 */
	static validateMetadata(metadata) {
		if (!metadata) return false;

		// Essential fields
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
