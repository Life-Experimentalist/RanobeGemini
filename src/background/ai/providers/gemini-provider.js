import { DEFAULT_MODEL_ENDPOINT } from "../../../utils/constants.js";

export function createGeminiProviderAdapter({
	initConfig,
	processContentWithGemini,
	summarizeContentWithGemini,
}) {
	if (
		typeof initConfig !== "function" ||
		typeof processContentWithGemini !== "function" ||
		typeof summarizeContentWithGemini !== "function"
	) {
		throw new Error(
			"createGeminiProviderAdapter requires initConfig, processContentWithGemini, and summarizeContentWithGemini functions.",
		);
	}

	return {
		async generateEnhancement(payload) {
			return processContentWithGemini(
				payload.title,
				payload.content,
				payload.isPart,
				payload.partInfo,
				payload.useEmoji,
				payload.conversationHistory,
				payload.siteSpecificPrompt,
			);
		},
		async generateSummary(payload) {
			return summarizeContentWithGemini(
				payload.title,
				payload.content,
				payload.isPart,
				payload.partInfo,
				payload.isShort,
			);
		},
		async getHealthStatus() {
			const config = await initConfig();
			const allKeys = [
				config.apiKey,
				...(config.backupApiKeys || []),
			].filter((k) => k && k.trim());

			return {
				providerId: "gemini",
				ok: allKeys.length > 0,
				reason:
					allKeys.length > 0 ? "ready" : "No API keys configured.",
			};
		},
		async listModels() {
			const config = await initConfig();
			const endpoint = config.modelEndpoint || DEFAULT_MODEL_ENDPOINT;
			const selectedModelId =
				config.selectedModelId ||
				endpoint.split("/").pop().split(":")[0] ||
				"gemini-2.5-flash";

			return [
				{
					id: selectedModelId,
					name: selectedModelId,
					endpoint,
					isSelected: true,
				},
			];
		},
	};
}
