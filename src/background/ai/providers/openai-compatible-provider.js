const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function createOpenAICompatibleProviderAdapter({
	initConfig,
	combinePrompts,
}) {
	if (
		typeof initConfig !== "function" ||
		typeof combinePrompts !== "function"
	) {
		throw new Error(
			"createOpenAICompatibleProviderAdapter requires initConfig and combinePrompts functions.",
		);
	}

	async function callOpenAI({
		systemInstruction,
		userMessage,
		config,
		conversationHistory = null,
	}) {
		const endpoint = config.openAiEndpoint || DEFAULT_OPENAI_ENDPOINT;
		const apiKey = config.openAiApiKey || config.apiKey || "";
		if (!apiKey.trim()) {
			throw new Error(
				"OpenAI-compatible API key is missing. Set openAiApiKey or apiKey in storage.",
			);
		}

		const messages = [{ role: "system", content: systemInstruction }];
		if (
			Array.isArray(conversationHistory) &&
			conversationHistory.length > 0
		) {
			messages.push(...conversationHistory);
		}
		messages.push({ role: "user", content: userMessage });

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: config.openAiModel || DEFAULT_OPENAI_MODEL,
				messages,
				temperature: config.temperature || 0.7,
				top_p: config.topP !== undefined ? config.topP : 0.95,
				max_tokens: config.maxOutputTokens || 8192,
			}),
		});

		const data = await response.json();
		if (!response.ok) {
			throw new Error(
				data?.error?.message ||
					`OpenAI-compatible API error: ${response.status} ${response.statusText}`,
			);
		}

		const text = data?.choices?.[0]?.message?.content?.trim();
		if (!text) {
			throw new Error(
				"No content returned from OpenAI-compatible provider.",
			);
		}

		return { text };
	}

	return {
		async generateEnhancement(payload) {
			const config = await initConfig();
			const basePrompt =
				payload.isPart && payload.partInfo
					? `${config.defaultPrompt}\n\nNote: This is part ${payload.partInfo.current} of ${payload.partInfo.total} parts. Please maintain consistency with other parts.`
					: config.defaultPrompt;
			const fullPrompt = combinePrompts(
				basePrompt,
				config.permanentPrompt,
				payload.siteSpecificPrompt || "",
			);
			const systemInstruction = `${fullPrompt}\n\n### Title:\n${payload.title}`;
			const userMessage = `### Content to Enhance:\n${payload.content}`;

			const normalizedHistory = Array.isArray(payload.conversationHistory)
				? payload.conversationHistory
						.map((entry) => {
							const role =
								entry?.role === "assistant" ||
								entry?.role === "model"
									? "assistant"
									: entry?.role;
							const content =
								entry?.content || entry?.parts?.[0]?.text;
							if (!role || !content) return null;
							if (role !== "user" && role !== "assistant")
								return null;
							return { role, content };
						})
						.filter(Boolean)
				: null;

			const { text } = await callOpenAI({
				systemInstruction,
				userMessage,
				config,
				conversationHistory: normalizedHistory,
			});

			const updatedConversationHistory = [
				...(normalizedHistory || []),
				{ role: "user", content: userMessage },
				{ role: "assistant", content: text },
			].slice(-4);

			return {
				originalContent: payload.content,
				enhancedContent: text,
				modelInfo: {
					name: config.openAiModel || DEFAULT_OPENAI_MODEL,
					provider: "OpenAI Compatible",
				},
				conversationHistory: updatedConversationHistory,
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
			const systemInstruction = `${fullPrompt}\n\n### Title:\n${payload.title}`;
			const userMessage = `### Content to Summarize:\n${payload.content}`;

			const { text } = await callOpenAI({
				systemInstruction,
				userMessage,
				config,
			});
			return text;
		},
		async getHealthStatus() {
			const config = await initConfig();
			const endpoint = config.openAiEndpoint || DEFAULT_OPENAI_ENDPOINT;
			const apiKey = config.openAiApiKey || config.apiKey || "";
			return {
				providerId: "openai-compatible",
				ok: Boolean(endpoint && apiKey),
				reason:
					endpoint && apiKey
						? "ready"
						: "Missing openAiEndpoint or openAiApiKey/apiKey.",
			};
		},
		async listModels() {
			const config = await initConfig();
			const endpoint = config.openAiEndpoint || DEFAULT_OPENAI_ENDPOINT;
			const model = config.openAiModel || DEFAULT_OPENAI_MODEL;
			return [{ id: model, name: model, endpoint, isSelected: true }];
		},
	};
}
