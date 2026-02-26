/**
 * Handler Settings Message Handler
 * Handles "getHandlerSettings" messages from content scripts and UI
 *
 * Responsibility: Retrieve and manage handler-proposed library settings
 * Each handler can propose custom settings that customize library behavior
 *
 * Message Format:
 * {
 *   action: "getHandlerSettings",
 *   handlerDomain: "fanfiction.net"  // specific handler
 * }
 * OR to get all handlers:
 * {
 *   action: "getHandlerSettings",
 *   includeAllHandlers: true
 * }
 *
 * Response Format:
 * {
 *   success: true,
 *   settings: {
 *     "fanfiction.net": {
 *       handlerName: "FanFiction.net",
 *       settings: {
 *         domainPreference: { type: "string", enum: [...], default: "www", ... },
 *         ...
 *       }
 *     }
 *   }
 * }
 * OR
 * {
 *   success: false,
 *   error: "Error message"
 * }
 */

import { debugLog, debugError } from "../../utils/logger.js";

/**
 * Handle getHandlerSettings message
 * @param {Object} message - Message from content script/UI
 * @param {Function} sendResponse - Callback to send response
 * @returns {boolean} True if response is async
 */
export async function handleGetSettings(message, sendResponse) {
	try {
		debugLog("[SettingsHandler] Processing handler settings request");

		const HandlerSettings = (
			await import("../../utils/handler-settings.js")
		).default;
		const { handlerRegistry } =
			await import("../../utils/website-handlers/handler-registry.js");

		const { handlerDomain, includeAllHandlers, userSettings } = message;

		// Handle request for all handlers' settings
		if (includeAllHandlers) {
			debugLog("[SettingsHandler] Retrieving settings for all handlers");

			const handlers = handlerRegistry.getAllHandlers?.() || [];
			const allSettings =
				HandlerSettings.getAllProposedSettings(handlers);

			debugLog(
				`[SettingsHandler] Retrieved settings for ${Object.keys(allSettings).length} handlers`,
			);

			sendResponse({
				success: true,
				settings: allSettings,
			});
			return false;
		}

		// Handle request for specific handler
		if (!handlerDomain) {
			debugError("[SettingsHandler] No handlerDomain provided");
			sendResponse({
				success: false,
				error: "Either handlerDomain or includeAllHandlers must be provided",
			});
			return false;
		}

		debugLog(`[SettingsHandler] Retrieving settings for ${handlerDomain}`);

		// Get the handler instance
		const handler = handlerRegistry.getHandlerByDomain(handlerDomain);
		if (!handler) {
			debugError(
				`[SettingsHandler] Handler not found for domain: ${handlerDomain}`,
			);
			sendResponse({
				success: false,
				error: `Handler not found for domain: ${handlerDomain}`,
			});
			return false;
		}

		// Get proposed settings schema
		const proposed = handler.getProposedLibrarySettings?.() || {};

		// If user sent settings to validate, validate them
		let validated = proposed;
		if (userSettings && Object.keys(proposed).length > 0) {
			validated = HandlerSettings.validateHandlerSettings(
				handler,
				userSettings,
			);
			debugLog("[SettingsHandler] Validated user settings");
		}

		debugLog(
			`[SettingsHandler] Retrieved ${Object.keys(proposed).length} settings for ${handlerDomain}`,
		);

		sendResponse({
			success: true,
			settings: {
				[handlerDomain]: {
					handlerName: handler.name || handlerDomain,
					proposed,
					validated: userSettings ? validated : undefined,
				},
			},
		});

		return false; // Synchronous response
	} catch (error) {
		debugError("[SettingsHandler] Error getting handler settings:", error);
		sendResponse({
			success: false,
			error: error.message || "Unknown error retrieving settings",
		});
		return false;
	}
}

/**
 * Save handler settings to persistent storage
 * @param {string} handlerDomain - Handler domain identifier
 * @param {Object} settings - Settings to save
 * @returns {Promise<boolean>} True if saved successfully
 */
export async function saveHandlerSettings(handlerDomain, settings) {
	try {
		const browser =
			typeof globalThis.browser !== "undefined"
				? globalThis.browser
				: chrome;

		const key = `handler-settings-${handlerDomain}`;
		const serialized = JSON.stringify(settings);

		await browser.storage.local.set({ [key]: serialized });

		debugLog(`[SettingsHandler] Saved settings for ${handlerDomain}`);
		return true;
	} catch (error) {
		debugError(
			`[SettingsHandler] Error saving settings for ${handlerDomain}:`,
			error,
		);
		return false;
	}
}

/**
 * Load handler settings from persistent storage
 * @param {string} handlerDomain - Handler domain identifier
 * @returns {Promise<Object>} Saved settings or empty object
 */
export async function loadHandlerSettings(handlerDomain) {
	try {
		const browser =
			typeof globalThis.browser !== "undefined"
				? globalThis.browser
				: chrome;

		const key = `handler-settings-${handlerDomain}`;
		const result = await browser.storage.local.get(key);

		if (result[key]) {
			const settings = JSON.parse(result[key]);
			debugLog(`[SettingsHandler] Loaded settings for ${handlerDomain}`);
			return settings;
		}

		return {};
	} catch (error) {
		debugError(
			`[SettingsHandler] Error loading settings for ${handlerDomain}:`,
			error,
		);
		return {};
	}
}

export default {
	action: "getHandlerSettings",
	handler: handleGetSettings,
};
