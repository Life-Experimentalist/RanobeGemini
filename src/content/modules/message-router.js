/**
 * Content script message router.
 * Registers the browser.runtime.onMessage listener and dispatches to the
 * action-specific handlers provided by content.js. Keeping dispatch here
 * prevents content.js from growing each time a new action is added.
 */

import { debugLog } from "../../utils/logger.js";

/**
 * Wraps an async task so the message channel stays open while it resolves.
 * @param {{ task: Function, sendResponse: Function, onSuccess?: Function, fallbackError?: string }} opts
 * @returns {true}
 */
export function respondFromAsyncAction({
	task,
	sendResponse,
	onSuccess = (result) => result,
	fallbackError,
}) {
	Promise.resolve()
		.then(task)
		.then((result) => {
			sendResponse(onSuccess(result));
		})
		.catch((error) => {
			sendResponse({
				success: false,
				error: error.message || fallbackError,
			});
		});
	return true;
}

/**
 * Register all content-script message handlers.
 *
 * @param {Object} handlers
 * @param {Function} handlers.handleApiKeyMissingMessage
 * @param {Function} handlers.handleChunkProcessed
 * @param {Function} handlers.handleChunkError
 * @param {Function} handlers.handleAllChunksProcessed
 * @param {Function} handlers.handleProcessingCancelledMessage
 * @param {Function} handlers.handleGetSiteHandlerInfo
 * @param {Function} handlers.handleTestExtraction
 * @param {Function} handlers.handleEnhanceClick
 * @param {Function} handlers.handleSummarizeClick
 * @param {Function} handlers.handleGetNovelInfo
 * @param {Function} handlers.handleAddToLibrary
 * @param {Function} handlers.handleUpdateNovelReadingStatus
 * @param {Function} handlers.handleGetNovelContext
 */
export function registerContentMessageHandlers(handlers) {
	browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		debugLog("Content script received message:", message);

		if (message.action === "ping") {
			sendResponse({ success: true, message: "Content script is alive" });
			return true;
		}

		if (message.action === "apiKeyMissing") {
			handlers.handleApiKeyMissingMessage();
			sendResponse({ success: true });
			return true;
		}

		if (message.action === "chunkProcessed") {
			handlers.handleChunkProcessed(message);
			sendResponse({ success: true });
			return true;
		}

		if (message.action === "chunkError") {
			handlers.handleChunkError(message);
			sendResponse({ success: true });
			return true;
		}

		if (message.action === "allChunksProcessed") {
			handlers.handleAllChunksProcessed(message);
			sendResponse({ success: true });
			return true;
		}

		if (message.action === "processingCancelled") {
			handlers.handleProcessingCancelledMessage(message);
			sendResponse({ success: true });
			return true;
		}

		if (message.action === "getSiteHandlerInfo") {
			return respondFromAsyncAction({
				task: () => handlers.handleGetSiteHandlerInfo(),
				sendResponse,
				fallbackError: "Failed to get site handler info",
			});
		}

		if (message.action === "testExtraction") {
			return respondFromAsyncAction({
				task: () => handlers.handleTestExtraction(),
				sendResponse,
				fallbackError: "Failed to test extraction",
			});
		}

		if (
			message.action === "processWithGemini" ||
			message.action === "enhanceChapter"
		) {
			return respondFromAsyncAction({
				task: () => handlers.handleEnhanceClick(),
				sendResponse,
				onSuccess: () => ({ success: true }),
				fallbackError: "Unknown error processing content",
			});
		}

		if (message.action === "settingsUpdated") {
			debugLog("Settings updated:", message);
			sendResponse({ success: true });
			return true;
		}

		if (
			message.action === "summarizeWithGemini" ||
			message.action === "summarizeChapter"
		) {
			return respondFromAsyncAction({
				task: () => handlers.handleSummarizeClick(),
				sendResponse,
				onSuccess: () => ({ success: true }),
				fallbackError: "Unknown error summarizing content",
			});
		}

		if (message.action === "getNovelInfo") {
			return respondFromAsyncAction({
				task: () => handlers.handleGetNovelInfo(),
				sendResponse,
				fallbackError: "Failed to get novel info",
			});
		}

		if (message.action === "addToLibrary") {
			return respondFromAsyncAction({
				task: () => handlers.handleAddToLibrary(),
				sendResponse,
				fallbackError: "Failed to add to library",
			});
		}

		if (message.action === "updateNovelReadingStatus") {
			return respondFromAsyncAction({
				task: () =>
					handlers.handleUpdateNovelReadingStatus(
						message.novelId,
						message.readingStatus,
					),
				sendResponse,
				fallbackError: "Failed to update reading status",
			});
		}

		if (message.action === "getNovelContext") {
			if (handlers.handleGetNovelContext) {
				return handlers.handleGetNovelContext(sendResponse);
			}
			sendResponse({ novelId: null, novelTitle: null, chapterNum: null });
			return false;
		}

		if (message.action === "toggleGeminiUI") {
			handlers.handleToggleBannersVisibility?.();
			// Return the new state so the popup can update its button label.
			const nowHidden = document.body.hasAttribute("data-rg-ui-hidden");
			sendResponse({ success: true, nowHidden });
			return true;
		}

		return false;
	});
}
