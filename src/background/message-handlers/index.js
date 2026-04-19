/**
 * Message Handler Registry
 * Central location for all background message handlers
 *
 * Add new handlers here to register them automatically
 * Each handler exports:
 * - action: string identifier
 * - handler: function(message, sendResponse) -> boolean
 */

import metadataHandler from "./metadata-handler.js";
import settingsHandler from "./settings-handler.js";
import updateHandler from "./update-handler.js";

// Registry of all message handlers
const handlers = [metadataHandler, settingsHandler, updateHandler];

/**
 * Process incoming message and dispatch to appropriate handler
 * @param {Object} message - Message object
 * @param {Object} sender - Message sender info
 * @param {Function} sendResponse - Response callback
 * @returns {boolean} True if response is/will be async
 */
export function processMessage(message, sender, sendResponse) {
	const handler = handlers.find((h) => h.action === message.action);

	if (handler) {
		try {
			const result = handler.handler(message, sendResponse);
			// Async handlers return a Promise \u{2014} the browser extension runtime only
			// keeps the message channel open when the listener returns the boolean
			// `true` synchronously.  Returning a Promise is truthy but it does NOT
			// keep the channel open in Firefox (and is unreliable in Chrome MV3).
			// Detect Promise returns and substitute `true` so that the async
			// handler's eventual `sendResponse()` call reaches the caller.
			if (result && typeof result.then === "function") {
				return true;
			}
			return result;
		} catch (error) {
			console.error(
				`Error processing message action "${message.action}":`,
				error,
			);
			sendResponse({
				success: false,
				error: error.message,
			});
			return false;
		}
	}

	// Handler not found - return false to indicate sync response not possible
	return false;
}

/**
 * Get all registered handlers
 * @returns {Array} Array of handler objects
 */
export function getAllHandlers() {
	return handlers.map((h) => ({
		action: h.action,
		name: h.handler.name || "Unknown",
	}));
}

export default {
	processMessage,
	getAllHandlers,
};
