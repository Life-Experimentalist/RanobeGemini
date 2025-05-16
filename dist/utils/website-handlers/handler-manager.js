/**
 * Handler Manager
 * Manages website-specific content handlers for RanobeGemini extension
 */

// Import handlers dynamically to avoid circular dependencies
// These will be loaded when getHandlerForCurrentSite is called

/**
 * Determines which handler to use for the current website
 * @returns {Object|null} The appropriate handler for the current site or null if none matches
 */
export async function getHandlerForCurrentSite() {
	const hostname = window.location.hostname;

	try {
		// Try loading ranobes handler if on a ranobes site
		if (hostname.includes("ranobes")) {
			const ranobesHandlerUrl = browser.runtime.getURL(
				"utils/website-handlers/ranobes-handler.js"
			);
			const ranobesModule = await import(ranobesHandlerUrl);
			console.log("Loaded ranobes handler");
			return ranobesModule.default;
		}
		// Try loading fanfiction handler if on fanfiction.net
		else if (hostname.includes("fanfiction.net")) {
			const fanfictionHandlerUrl = browser.runtime.getURL(
				"utils/website-handlers/fanfiction-handler.js"
			);
			const fanfictionModule = await import(fanfictionHandlerUrl);
			console.log("Loaded fanfiction handler");
			return fanfictionModule.default;
		}

		// No specific handler found
		console.log(`No specific handler for hostname: ${hostname}`);

		// Return a generic handler based on the base handler class
		const baseHandlerUrl = browser.runtime.getURL(
			"utils/website-handlers/base-handler.js"
		);
		const baseHandlerModule = await import(baseHandlerUrl);

		// Create an anonymous instance of BaseWebsiteHandler for generic handling
		return new baseHandlerModule.BaseWebsiteHandler();
	} catch (error) {
		console.error(`Error loading handler for ${hostname}:`, error);
		return null;
	}
}

// Export manager methods
export default {
	getHandlerForCurrentSite,
};
