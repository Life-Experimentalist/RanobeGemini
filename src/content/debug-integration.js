// This script integrates the debug panel with the rest of the extension
import { addDebugButton } from "./debug-utils.js";
import { debugLog } from "../utils/logger.js";

/**
 * Initializes the debug panel based on configuration
 * @param {Object} config - Extension configuration object
 * @returns {Boolean} Whether the debug panel was initialized
 */
export function initializeDebugPanel(config) {
	// Only initialize if debugging is enabled in configuration
	if (!config || !config.debugPanelEnabled) {
		debugLog("Debug panel is disabled in config");
		return false;
	}

	// Only initialize if we're on a chapter page
	const currentHandler = window.currentHandler;
	if (currentHandler && !currentHandler.isChapter(document)) {
		debugLog("Not a chapter page, debug panel not initialized");
		return false;
	}

	debugLog("Initializing debug panel");

	// Add debug button to UI
	addDebugButton();

	// Log debug panel initialization
	debugLog("Debug panel initialized successfully");
	return true;
}
