import { validateProviderAdapterRuntime } from "./provider-interface.js";

export function createProviderRegistry({
	defaultProviderId = "gemini",
	debugLog = () => {},
	debugError = () => {},
} = {}) {
	const providers = new Map();

	function registerProvider(providerId, adapter) {
		if (!providerId || typeof providerId !== "string") {
			throw new Error("Provider ID must be a non-empty string");
		}

		const normalizedProviderId = providerId.toLowerCase();
		const contract = validateProviderAdapterRuntime(
			adapter,
			normalizedProviderId,
		);
		if (!contract.isValid) {
			throw new Error(
				`Provider '${normalizedProviderId}' is missing required methods: ${contract.missingRequired.join(", ")}`,
			);
		}

		if (contract.warnings.length > 0) {
			for (const warning of contract.warnings) {
				debugLog(`AI provider registry warning: ${warning}`);
			}
		}

		providers.set(normalizedProviderId, adapter);
		debugLog(`AI provider registered: ${normalizedProviderId}`);
	}

	function getProvider(providerId) {
		const normalizedProviderId = String(
			providerId || defaultProviderId,
		).toLowerCase();
		if (providers.has(normalizedProviderId)) {
			return providers.get(normalizedProviderId);
		}

		if (providers.has(defaultProviderId)) {
			debugError(
				`AI provider '${normalizedProviderId}' not found. Falling back to '${defaultProviderId}'.`,
			);
			return providers.get(defaultProviderId);
		}

		throw new Error(
			`AI provider '${normalizedProviderId}' not found and no default provider is registered.`,
		);
	}

	function listProviderIds() {
		return Array.from(providers.keys());
	}

	return {
		registerProvider,
		getProvider,
		listProviderIds,
	};
}
