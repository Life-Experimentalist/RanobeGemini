/**
 * Content Script Modules Index
 * Central location for managing content script features
 *
 * Each module handles a specific feature area:
 * - library-integration: Add to Library button and functionality
 * - More modules can be added as needed
 *
 * Usage in content script:
 * import { initializeModules } from './modules/index.js';
 * await initializeModules(handler, handlerDomain, handlerType);
 */

import libraryIntegration from "./library-integration.js";
import { debugLog, debugError } from "../../utils/logger.js";

const modules = [
	{
		name: "library-integration",
		instance: libraryIntegration,
		enabled: true,
	},
	// Add more modules here as features grow
];

/**
 * Initialize all enabled content modules
 * @param {Object} handler - Handler instance
 * @param {string} handlerDomain - Handler domain identifier
 * @param {string} handlerType - Handler type
 * @returns {Promise<Object>} Results of module initialization
 */
export async function initializeModules(handler, handlerDomain, handlerType) {
	const results = {};

	for (const module of modules) {
		if (!module.enabled) {
			debugLog(
				`[ContentModules] Skipping disabled module: ${module.name}`,
			);
			results[module.name] = { enabled: false };
			continue;
		}

		try {
			debugLog(`[ContentModules] Initializing ${module.name}`);

			const success = await module.instance.initialize(
				handler,
				handlerDomain,
				handlerType,
			);

			results[module.name] = {
				enabled: true,
				success,
			};

			if (success) {
				debugLog(
					`[ContentModules] ${module.name} initialized successfully`,
				);
			} else {
				debugLog(
					`[ContentModules] ${module.name} initialization returned false`,
				);
			}
		} catch (error) {
			debugError(
				`[ContentModules] Error initializing ${module.name}:`,
				error,
			);
			results[module.name] = {
				enabled: true,
				success: false,
				error: error.message,
			};
		}
	}

	debugLog("[ContentModules] All modules processed");
	return results;
}

/**
 * Get status of all modules
 * @returns {Array<Object>} Status of each module
 */
export function getModuleStatus() {
	return modules.map((m) => ({
		name: m.name,
		enabled: m.enabled,
		hasInstance: !!m.instance,
	}));
}

/**
 * Enable or disable a module
 * @param {string} moduleName - Name of module to toggle
 * @param {boolean} enable - True to enable, false to disable
 * @returns {boolean} True if module found and toggled
 */
export function toggleModule(moduleName, enable = true) {
	const module = modules.find((m) => m.name === moduleName);
	if (module) {
		module.enabled = enable;
		debugLog(
			`[ContentModules] Module ${moduleName} ${enable ? "enabled" : "disabled"}`,
		);
		return true;
	}
	return false;
}

/**
 * Cleanup all modules
 * Call before navigation or when content script unloads
 */
export function cleanupAllModules() {
	debugLog("[ContentModules] Cleaning up all modules");
	for (const module of modules) {
		try {
			if (module.instance?.destroy) {
				module.instance.destroy();
			}
		} catch (error) {
			debugError(
				`[ContentModules] Error cleaning up ${module.name}:`,
				error,
			);
		}
	}
}

export default {
	initializeModules,
	getModuleStatus,
	toggleModule,
	cleanupAllModules,
};
