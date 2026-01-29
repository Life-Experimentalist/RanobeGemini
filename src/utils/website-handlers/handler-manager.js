/**
 * Handler Manager
 * Manages website-specific content handlers for RanobeGemini extension
 */

import { BaseWebsiteHandler } from "./base-handler.js";
import { HANDLER_MODULES } from "./handler-registry.js";
import { debugLog, debugError } from "../logger.js";
import {
	getSiteSettings,
	getDomainSettings,
	isSiteEnabled,
	isDomainEnabled,
} from "../site-settings.js";

function matchesHostname(hostname, pattern) {
	if (!pattern || !hostname) return false;
	if (pattern.startsWith("*")) {
		const suffix = pattern.replace(/^\*\.?/, "");
		return hostname === suffix || hostname.endsWith(`.${suffix}`);
	}
	return hostname === pattern || hostname.endsWith(`.${pattern}`);
}

// Website handler manager
export class HandlerManager {
	constructor() {
		this.handlersPromise = null;
	}

	async loadHandlers() {
		if (this.handlersPromise) return this.handlersPromise;

		this.handlersPromise = (async () => {
			const loadedHandlers = [];
			const initialized = new Set();
			for (const modulePath of HANDLER_MODULES) {
				try {
					const url = browser.runtime.getURL(
						`utils/website-handlers/${modulePath}`,
					);
					const mod = await import(url);

					const candidates = [];
					const classCandidates = [];

					// Prefer default export if provided
					if (mod.default) {
						if (mod.default instanceof BaseWebsiteHandler) {
							candidates.push(mod.default);
						} else if (
							typeof mod.default === "function" &&
							mod.default.prototype instanceof BaseWebsiteHandler
						) {
							classCandidates.push(mod.default);
							candidates.push(new mod.default());
						}
					}

					// Fall back to any named exports that extend BaseWebsiteHandler
					for (const value of Object.values(mod)) {
						if (!value || value === mod.default) continue;
						if (value === BaseWebsiteHandler) continue;

						if (value instanceof BaseWebsiteHandler) {
							candidates.push(value);
						} else if (
							typeof value === "function" &&
							value.prototype instanceof BaseWebsiteHandler
						) {
							classCandidates.push(value);
							candidates.push(new value());
						}
					}

					for (const handlerClass of classCandidates) {
						const name = handlerClass?.name;
						if (!name || initialized.has(name)) continue;
						if (typeof handlerClass.initialize === "function") {
							try {
								handlerClass.initialize();
							} catch (initError) {
								console.warn(
									`HandlerManager: initialize failed for ${name}:`,
									initError,
								);
							}
						}
						initialized.add(name);
					}

					// Deduplicate by constructor name to avoid double-loading
					const uniqueByName = new Map();
					for (const handler of candidates) {
						const name = handler?.constructor?.name;
						if (name && !uniqueByName.has(name)) {
							uniqueByName.set(name, handler);
						}
					}

					loadedHandlers.push(...uniqueByName.values());
				} catch (importError) {
					console.warn(
						`HandlerManager: failed to load ${modulePath}:`,
						importError,
					);
				}
			}

			// Sort by optional PRIORITY (lower number = earlier match)
			loadedHandlers.sort(
				(a, b) =>
					(a?.constructor?.PRIORITY || 100) -
					(b?.constructor?.PRIORITY || 100)
			);

			return loadedHandlers;
		})();

		return this.handlersPromise;
	}

	/**
	 * Determines which handler to use for the current website
	 * @returns {Object|null} The appropriate handler for the current site or null if none matches
	 */
	async getHandlerForCurrentSite() {
		const hostname = window.location.hostname;
		const handlers = await this.loadHandlers();
		const siteSettings = await getSiteSettings();
		const domainSettings = await getDomainSettings();
		let disabledMatchForHost = false;

		for (const handler of handlers) {
			try {
				const domains = handler?.constructor?.SUPPORTED_DOMAINS || [];
				const shelfId = handler?.constructor?.SHELF_METADATA?.id;
				const matchesHost = domains.some((domain) =>
					matchesHostname(hostname, domain)
				);

				if (shelfId && !isSiteEnabled(siteSettings, shelfId)) {
					if (matchesHost) {
						disabledMatchForHost = true;
					}
					continue;
				}

				if (!isDomainEnabled(domainSettings, hostname)) {
					if (matchesHost) {
						disabledMatchForHost = true;
					}
					continue;
				}

				if (typeof handler?.canHandle === "function") {
					if (handler.canHandle()) {
						debugLog(`Loaded handler: ${handler.constructor.name}`);
						return handler;
					}
				}

				// Fallback: match against SUPPORTED_DOMAINS if provided
				if (matchesHost) {
					debugLog(
						`Loaded handler via SUPPORTED_DOMAINS: ${handler.constructor.name}`
					);
					return handler;
				}
			} catch (handlerError) {
				console.warn(
					"HandlerManager: error evaluating handler",
					handlerError
				);
			}
		}

		debugLog(`No specific handler for hostname: ${hostname}`);
		if (disabledMatchForHost) {
			debugLog("Site disabled via settings; skipping generic handler");
			return null;
		}
		return new BaseWebsiteHandler();
	}
}

// Export manager instance
export default new HandlerManager();
