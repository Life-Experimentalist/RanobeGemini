/**
 * Novel Metadata Update Message Handler
 *
 * Handles "updateNovelMetadata" messages, which request an immediate metadata
 * refresh for a specific novel.
 *
 * Message Format:
 * {
 *   action: "updateNovelMetadata",
 *   novelId: "scribblehub-12345"
 * }
 *
 * Response Format:
 * { success: true,  novel: { ...updatedNovel } }
 * { success: false, error: "reason" }
 */

import { debugLog, debugError } from "../../utils/logger.js";
import { updateSingleNovelMetadata } from "../novel-updater.js";

/**
 * Handle the "updateNovelMetadata" message.
 * @param {Object}   message      - Message from content/popup script.
 * @param {Function} sendResponse - Response callback.
 * @returns {boolean} true = async response
 */
async function handleUpdateNovelMetadata(message, sendResponse) {
	const { novelId } = message;

	if (!novelId) {
		sendResponse({
			success: false,
			error: "Missing required param: novelId",
		});
		return false;
	}

	debugLog(`[UpdateHandler] Refreshing metadata for novel: ${novelId}`);

	try {
		const result = await updateSingleNovelMetadata(novelId);
		sendResponse(result);
	} catch (err) {
		debugError("[UpdateHandler] Unexpected error:", err);
		sendResponse({ success: false, error: err.message || String(err) });
	}

	return true; // async
}

export default {
	action: "updateNovelMetadata",
	handler: (message, sendResponse) => {
		// Call the async function and signal async response
		handleUpdateNovelMetadata(message, sendResponse);
		return true;
	},
};
