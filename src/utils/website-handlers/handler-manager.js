/**
 * Handler Manager
 * Manages website-specific content handlers for RanobeGemini extension
 */

import ranobesHandler from "./ranobes-handler.js";
import fanfictionHandler from "./fanfiction-handler.js";
import fanfictionMobileHandler from "./fanfiction-mobile-handler.js";
import ao3Handler from "./ao3-handler.js";
import webnovelHandler from "./webnovel-handler.js";
import { BaseWebsiteHandler } from "./base-handler.js";

// Website handler manager
export class HandlerManager {
	constructor() {
		// Register all handlers here
		// Order matters: more specific handlers (like mobile) should come before generic ones
		this.handlers = [
			ranobesHandler,
			fanfictionMobileHandler, // Check mobile version first
			fanfictionHandler,
			ao3Handler,
			webnovelHandler,
			// Add more handlers as they are developed
		];
	}

	/**
	 * Determines which handler to use for the current website
	 * @returns {Object|null} The appropriate handler for the current site or null if none matches
	 */
	async getHandlerForCurrentSite() {
		const hostname = window.location.hostname;

		try {
			// Try loading ranobes handler if on a ranobes site
			if (hostname.includes("ranobes")) {
				console.log("Loaded ranobes handler");
				return ranobesHandler;
			}
			// Check for mobile fanfiction FIRST (more specific)
			else if (hostname === "m.fanfiction.net") {
				console.log("Loaded fanfiction mobile handler");
				return fanfictionMobileHandler;
			}
			// Try loading fanfiction handler if on fanfiction.net (desktop)
			else if (hostname.includes("fanfiction.net")) {
				console.log("Loaded fanfiction handler");
				return fanfictionHandler;
			}
			// Try loading AO3 handler if on archiveofourown.org
			else if (
				hostname.includes("archiveofourown.org") ||
				hostname.includes("ao3.org")
			) {
				console.log("Loaded AO3 handler");
				return ao3Handler;
			}
			// Try loading WebNovel handler if on webnovel.com
			else if (
				hostname.includes("webnovel.com") ||
				hostname.includes("webnovel.net")
			) {
				console.log("Loaded WebNovel handler");
				return webnovelHandler;
			}

			// No specific handler found
			console.log(`No specific handler for hostname: ${hostname}`);

			// Return a generic handler based on the base handler class
			return new BaseWebsiteHandler();
		} catch (error) {
			console.error(`Error loading handler for ${hostname}:`, error);
			return null;
		}
	}
}

// Export manager methods
export default new HandlerManager();
