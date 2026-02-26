/**
 * Metadata Fetching Message Handler
 * Handles "fetchNovelMetadata" messages from content scripts
 *
 * Responsibility: Fetch complete novel metadata in background without blocking UI
 * Supports three handler types:
 * - chapter_embedded: Extract from current page
 * - dedicated_page: Fetch from separate novel page
 * - chapter_embedded_requires_redirect: Fetch from alternate URL
 *
 * Message Format:
 * {
 *   action: "fetchNovelMetadata",
 *   url: "current page URL",
 *   handlerDomain: "fanfiction.net",
 *   handlerType: "chapter_embedded"
 * }
 *
 * Response Format:
 * {
 *   success: true,
 *   metadata: { title, author, genres, ... }
 * }
 * OR
 * {
 *   success: false,
 *   error: "Error message"
 * }
 */

import { debugLog, debugError } from "../../utils/logger.js";

/**
 * Handle fetchNovelMetadata message
 * @param {Object} message - Message from content script
 * @param {Function} sendResponse - Callback to send response
 * @returns {boolean} True if response is async
 */
export async function handleFetchMetadata(message, sendResponse) {
	// Validate message structure
	if (!message.url || !message.handlerDomain || !message.handlerType) {
		sendResponse({
			success: false,
			error: "Missing required parameters: url, handlerDomain, handlerType",
		});
		return false;
	}

	try {
		debugLog(
			`[MetadataHandler] Processing metadata fetch for ${message.handlerDomain}`,
		);

		// Import MetadataFetcher and handler registry
		const MetadataFetcher = (
			await import("../../utils/metadata-fetcher.js")
		).default;
		const { handlerRegistry } =
			await import("../../utils/website-handlers/handler-registry.js");

		const { url, handlerDomain, handlerType } = message;

		// Get handler instance
		const handler = handlerRegistry.getHandlerByDomain(handlerDomain);
		if (!handler) {
			debugError(
				`[MetadataHandler] Handler not found for domain: ${handlerDomain}`,
			);
			sendResponse({
				success: false,
				error: `Handler not found for domain: ${handlerDomain}`,
			});
			return false;
		}

		debugLog(
			`[MetadataHandler] Using ${handlerType} strategy to fetch metadata`,
		);

		// Fetch metadata using appropriate strategy
		const metadata = await MetadataFetcher.fetchMetadata(
			handlerType,
			url,
			handler,
		);

		if (!metadata) {
			debugError("[MetadataHandler] Metadata fetcher returned null");
			sendResponse({
				success: false,
				error: "Failed to fetch metadata",
			});
			return false;
		}

		// Validate metadata completeness
		if (!MetadataFetcher.validateMetadata(metadata)) {
			debugError("[MetadataHandler] Metadata validation failed");
			sendResponse({
				success: false,
				error: "Fetched metadata is incomplete or invalid",
			});
			return false;
		}

		// Allow handler to post-process metadata
		const processed = handler.processRemoteMetadata?.(metadata) || metadata;

		debugLog(
			`[MetadataHandler] Successfully fetched and validated metadata for ${handlerDomain}`,
		);

		sendResponse({
			success: true,
			metadata: processed,
		});
		return false; // Synchronous response sent
	} catch (error) {
		debugError("[MetadataHandler] Error fetching novel metadata:", error);
		sendResponse({
			success: false,
			error: error.message || "Unknown error fetching metadata",
		});
		return false;
	}
}

export default {
	action: "fetchNovelMetadata",
	handler: handleFetchMetadata,
};
