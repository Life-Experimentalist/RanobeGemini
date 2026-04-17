/**
 * Runtime contract utilities for website handlers.
 *
 * This module defines:
 * - required handler contract surface (must exist)
 * - optional capability hooks (detected for feature branching)
 * - validation helpers used by HandlerManager during registration
 */

import { BaseWebsiteHandler } from "./base-handler.js";

export const REQUIRED_INSTANCE_METHOD_OVERRIDES = ["canHandle", "extractTitle"];

export const REQUIRED_STATIC_ARRAYS = ["SUPPORTED_DOMAINS"];

export const OPTIONAL_CAPABILITY_HOOKS = [
	"supportsTextOnlyEnhancement",
	"formatAfterEnhancement",
	"extractNovelMetadata",
	"getMetadataSourceUrl",
	"processRemoteMetadata",
	"getProposedLibrarySettings",
	"getChapterUIConfig",
	"getCustomButtons",
	"injectCustomUI",
];

function isFunction(value) {
	return typeof value === "function";
}

function hasOverride(instance, methodName) {
	if (!instance || !isFunction(instance[methodName])) return false;
	const baseFn = BaseWebsiteHandler.prototype[methodName];
	return instance[methodName] !== baseFn;
}

function hasNonEmptyStaticArray(instance, fieldName) {
	const value = instance?.constructor?.[fieldName];
	return Array.isArray(value) && value.length > 0;
}

/**
 * Validate a handler instance against required contract shape.
 * @param {BaseWebsiteHandler} handler
 * @returns {{
 *   isValid: boolean,
 *   missingRequired: string[],
 *   warnings: string[],
 *   capabilities: { optionalHooks: string[] }
 * }}
 */
export function validateHandlerContractRuntime(handler) {
	const missingRequired = [];
	const warnings = [];

	for (const methodName of REQUIRED_INSTANCE_METHOD_OVERRIDES) {
		if (!hasOverride(handler, methodName)) {
			missingRequired.push(`instance method override: ${methodName}()`);
		}
	}

	for (const staticField of REQUIRED_STATIC_ARRAYS) {
		if (!hasNonEmptyStaticArray(handler, staticField)) {
			missingRequired.push(`static ${staticField}[]`);
		}
	}

	const optionalHooks = [];
	for (const hookName of OPTIONAL_CAPABILITY_HOOKS) {
		if (!isFunction(handler?.[hookName])) continue;
		optionalHooks.push(hookName);
	}

	if (!optionalHooks.includes("formatAfterEnhancement")) {
		warnings.push(
			"Optional hook missing: formatAfterEnhancement() (default formatting fallback will be used)",
		);
	}

	if (!optionalHooks.includes("supportsTextOnlyEnhancement")) {
		warnings.push(
			"Optional hook missing: supportsTextOnlyEnhancement() (HTML enhancement path only)",
		);
	}

	return {
		isValid: missingRequired.length === 0,
		missingRequired,
		warnings,
		capabilities: { optionalHooks },
	};
}
