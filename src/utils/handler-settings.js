/**
 * Handler Settings Manager
 * Validates, manages, and applies handler-proposed settings
 * Allows each handler to customize library UI behavior without code changes
 */

import { debugLog, debugError } from "./logger.js";

class HandlerSettings {
	/**
	 * Validate a settings value against schema definition
	 * @param {Object} setting - Setting definition with type, enum, range, etc.
	 * @param {*} value - Value to validate
	 * @returns {boolean} True if valid
	 */
	static validateSetting(setting, value) {
		if (value === undefined || value === null) {
			// Use default if not provided
			if (setting.default !== undefined) {
				return true;
			}
			// Required but missing
			if (setting.required) {
				debugError(
					`[HandlerSettings] Required setting missing: ${setting.label}`,
				);
				return false;
			}
			return true;
		}

		// Type validation
		if (!this._validateType(value, setting.type)) {
			debugError(
				`[HandlerSettings] Type validation failed for ${setting.label}: expected ${setting.type}, got ${typeof value}`,
			);
			return false;
		}

		// Enum validation
		if (setting.enum && !setting.enum.includes(value)) {
			debugError(
				`[HandlerSettings] Enum validation failed for ${setting.label}: ${value} not in [${setting.enum.join(", ")}]`,
			);
			return false;
		}

		// Range validation (for numbers)
		if (setting.type === "number") {
			if (setting.min !== undefined && value < setting.min) {
				debugError(
					`[HandlerSettings] ${setting.label} below minimum: ${value} < ${setting.min}`,
				);
				return false;
			}
			if (setting.max !== undefined && value > setting.max) {
				debugError(
					`[HandlerSettings] ${setting.label} above maximum: ${value} > ${setting.max}`,
				);
				return false;
			}
		}

		// String validation (length)
		if (setting.type === "string") {
			if (setting.minLength && value.length < setting.minLength) {
				debugError(
					`[HandlerSettings] ${setting.label} too short: length ${value.length} < ${setting.minLength}`,
				);
				return false;
			}
			if (setting.maxLength && value.length > setting.maxLength) {
				debugError(
					`[HandlerSettings] ${setting.label} too long: length ${value.length} > ${setting.maxLength}`,
				);
				return false;
			}
		}

		return true;
	}

	/**
	 * Type validation helper
	 * @private
	 */
	static _validateType(value, expectedType) {
		const actualType = typeof value;

		if (expectedType === "boolean") return actualType === "boolean";
		if (expectedType === "string") return actualType === "string";
		if (expectedType === "number")
			return actualType === "number" && !isNaN(value);
		if (expectedType === "array") return Array.isArray(value);
		if (expectedType === "object")
			return actualType === "object" && value !== null;

		return false;
	}

	/**
	 * Validate all settings from handler against schema
	 * @param {Object} handler - Handler instance
	 * @param {Object} userSettings - User's configured values
	 * @returns {Object} Validated settings (with defaults applied)
	 */
	static validateHandlerSettings(handler, userSettings = {}) {
		const proposed = handler.getProposedLibrarySettings?.();
		if (!proposed) {
			return {};
		}

		const validated = {};

		// Validate each proposed setting
		for (const [key, setting] of Object.entries(proposed)) {
			const userValue = userSettings[key];

			// Validate the user value against the setting schema
			if (!this.validateSetting(setting, userValue)) {
				debugLog(
					`[HandlerSettings] Using default for ${key}: ${setting.default}`,
				);
				validated[key] = setting.default;
				continue;
			}

			// Use user value or default
			validated[key] =
				userValue !== undefined ? userValue : setting.default;
		}

		return validated;
	}

	/**
	 * Get active settings for a handler
	 * Merges proposed settings schema with user's saved values
	 * @param {Object} handler - Handler instance
	 * @param {Object} savedSettings - Previously saved settings
	 * @returns {Object} Final settings with proper defaults
	 */
	static getActiveSettings(handler, savedSettings = {}) {
		const proposed = handler.getProposedLibrarySettings?.();
		if (!proposed) {
			return {};
		}

		const active = {};

		for (const [key, setting] of Object.entries(proposed)) {
			// Priority: saved value > default
			if (savedSettings[key] !== undefined) {
				if (this.validateSetting(setting, savedSettings[key])) {
					active[key] = savedSettings[key];
				} else {
					active[key] = setting.default;
				}
			} else {
				active[key] = setting.default;
			}
		}

		return active;
	}

	/**
	 * Get all proposed settings from all active handlers
	 * Used for library settings UI
	 * @param {Array<Object>} handlers - Array of handler instances
	 * @returns {Object} Map of handler domain -> proposed settings
	 */
	static getAllProposedSettings(handlers) {
		const all = {};

		for (const handler of handlers) {
			const domain = handler.domain;
			const proposed = handler.getProposedLibrarySettings?.();

			if (proposed && Object.keys(proposed).length > 0) {
				all[domain] = {
					handlerName: handler.name,
					settings: proposed,
				};
			}
		}

		return all;
	}

	/**
	 * Apply handler settings to customize library behavior
	 * Each handler interprets settings as needed
	 * @param {Object} handler - Handler instance
	 * @param {Object} activeSettings - The active settings
	 * @returns {Promise<void>}
	 */
	static async applyHandlerSettings(handler, activeSettings) {
		if (
			!handler.applyLibrarySetting ||
			Object.keys(activeSettings).length === 0
		) {
			return;
		}

		try {
			for (const [key, value] of Object.entries(activeSettings)) {
				await handler.applyLibrarySetting(key, value);
			}
			debugLog(
				`[HandlerSettings] Applied ${Object.keys(activeSettings).length} settings for ${handler.domain}`,
			);
		} catch (error) {
			debugError(
				`[HandlerSettings] Error applying settings for ${handler.domain}:`,
				error,
			);
		}
	}

	/**
	 * Serialize settings for storage (localStorage, IndexedDB, etc.)
	 * @param {Object} settings - Settings object
	 * @returns {string} JSON-serialized settings
	 */
	static serialize(settings) {
		return JSON.stringify(settings);
	}

	/**
	 * Deserialize settings from storage
	 * @param {string} serialized - JSON string
	 * @returns {Object} Deserialized settings
	 */
	static deserialize(serialized) {
		try {
			return JSON.parse(serialized);
		} catch (error) {
			debugError("[HandlerSettings] JSON parse error:", error);
			return {};
		}
	}

	/**
	 * Create UI controls for a setting
	 * Returns metadata for rendering setting in UI
	 * @param {string} key - Setting key
	 * @param {Object} setting - Setting definition
	 * @returns {Object} UI metadata
	 */
	static getSettingUIMetadata(key, setting) {
		return {
			key,
			label: setting.label || key,
			description: setting.description || "",
			type: setting.type,
			enum: setting.enum || null,
			min: setting.min || null,
			max: setting.max || null,
			default: setting.default,
			required: setting.required || false,
		};
	}
}

export default HandlerSettings;
