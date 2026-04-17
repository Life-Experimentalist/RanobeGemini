/**
 * AI provider adapter contract helpers.
 *
 * Required methods:
 * - generateEnhancement(payload)
 * - generateSummary(payload)
 * - getHealthStatus()
 *
 * Optional methods:
 * - listModels()
 */

export const REQUIRED_PROVIDER_METHODS = [
	"generateEnhancement",
	"generateSummary",
	"getHealthStatus",
];

export const OPTIONAL_PROVIDER_METHODS = ["listModels"];

function isFunction(value) {
	return typeof value === "function";
}

export function validateProviderAdapterRuntime(
	provider,
	providerId = "unknown",
) {
	const missingRequired = [];
	const warnings = [];

	for (const methodName of REQUIRED_PROVIDER_METHODS) {
		if (!isFunction(provider?.[methodName])) {
			missingRequired.push(methodName);
		}
	}

	for (const methodName of OPTIONAL_PROVIDER_METHODS) {
		if (!isFunction(provider?.[methodName])) {
			warnings.push(
				`${providerId}: optional provider method not implemented: ${methodName}()`,
			);
		}
	}

	return {
		isValid: missingRequired.length === 0,
		missingRequired,
		warnings,
	};
}
