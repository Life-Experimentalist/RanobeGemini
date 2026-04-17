const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434/api/generate";
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";

export function createOllamaProviderAdapter({ initConfig, combinePrompts }) {
	if (
		typeof initConfig !== "function" ||
		typeof combinePrompts !== "function"
	) {
		throw new Error(
			"createOllamaProviderAdapter requires initConfig and combinePrompts functions.",
		);
	}

	async function callOllama({ prompt, config }) {
		const endpoint = config.ollamaEndpoint || DEFAULT_OLLAMA_ENDPOINT;
		const model = config.ollamaModel || DEFAULT_OLLAMA_MODEL;
		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model,
				prompt,
				stream: false,
				options: {
					temperature: config.temperature || 0.7,
					top_p: config.topP !== undefined ? config.topP : 0.95,
					top_k: config.topK !== undefined ? config.topK : 40,
					num_predict: config.maxOutputTokens || 8192,
				},
			}),
		});
		const data = await response.json();
		if (!response.ok) {
			throw new Error(
				data?.error ||
					`Ollama API error: ${response.status} ${response.statusText}`,
			);
		}
		const text = String(data?.response || "").trim();
		if (!text) {
			throw new Error("No content returned from Ollama provider.");
		}
		return { text, model };
	}

	return {
		async generateEnhancement(payload) {
			const config = await initConfig();
			let enhancementPrompt = config.defaultPrompt;
			if (payload.isPart && payload.partInfo) {
				enhancementPrompt += `\n\nNote: This is part ${payload.partInfo.current} of ${payload.partInfo.total} parts. Keep style consistent.`;
			}
			const fullPrompt = combinePrompts(
				enhancementPrompt,
				config.permanentPrompt,
				payload.siteSpecificPrompt || "",
			);
			const prompt = `${fullPrompt}\n\n### Title:\n${payload.title}\n\n### Content to Enhance:\n${payload.content}`;
			const { text, model } = await callOllama({ prompt, config });
			return {
				originalContent: payload.content,
				enhancedContent: text,
				modelInfo: {
					name: model,
					provider: "Ollama",
				},
				conversationHistory: null,
			};
		},
		async generateSummary(payload) {
			const config = await initConfig();
			const summarizationPrompt = payload.isShort
				? config.shortSummaryPrompt
				: config.summaryPrompt;
			const fullPrompt = combinePrompts(
				summarizationPrompt,
				config.permanentPrompt,
				"",
			);
			const prompt = `${fullPrompt}\n\n### Title:\n${payload.title}\n\n### Content to Summarize:\n${payload.content}`;
			const { text } = await callOllama({ prompt, config });
			return text;
		},
		async getHealthStatus() {
			const config = await initConfig();
			const endpoint = config.ollamaEndpoint || DEFAULT_OLLAMA_ENDPOINT;
			const model = config.ollamaModel || DEFAULT_OLLAMA_MODEL;
			return {
				providerId: "ollama",
				ok: Boolean(endpoint && model),
				reason:
					endpoint && model
						? "ready"
						: "Missing ollamaEndpoint or ollamaModel.",
			};
		},
		async listModels() {
			const config = await initConfig();
			const endpoint = config.ollamaEndpoint || DEFAULT_OLLAMA_ENDPOINT;
			const model = config.ollamaModel || DEFAULT_OLLAMA_MODEL;
			return [{ id: model, name: model, endpoint, isSelected: true }];
		},
	};
}
