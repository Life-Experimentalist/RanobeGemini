// This script integrates the debug panel with the rest of the extension
import { addDebugButton } from "./debug-utils.js";

/**
 * Initializes the debug panel based on configuration
 * @param {Object} config - Extension configuration object
 * @returns {Boolean} Whether the debug panel was initialized
 */
export function initializeDebugPanel(config) {
	// Only initialize if debugging is enabled in configuration
	if (!config || !config.debugPanelEnabled) {
		console.log("Debug panel is disabled in config");
		return false;
	}

	// Only initialize if we're on a chapter page
	const currentHandler = window.currentHandler;
	if (currentHandler && !currentHandler.isChapter(document)) {
		console.log("Not a chapter page, debug panel not initialized");
		return false;
	}

	console.log("Initializing debug panel");

	// Add debug button to UI
	addDebugButton();

	// Log debug panel initialization
	console.log("Debug panel initialized successfully");
	return true;
}
