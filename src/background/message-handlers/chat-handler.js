/**
 * Background handler for story chat.
 * action: "story-chat"
 * payload: { question, novelId, conversationHistory, chapterText }
 * conversationHistory is stored in Gemini format: [{role, parts:[{text}]}]
 * response: { success, answer, conversationHistory }
 *
 * Which context sources are consulted is the user's choice — see
 * utils/chat-settings.js. `chapterText` is sent by the caller only when the
 * "current chapter" source is on; the handler re-checks rather than trusting it.
 */

import {
	loadChronicle,
	getEntityIndex,
} from "../loreweave/chronicle-storage.js";
import { getChatSettings } from "../../utils/chat-settings.js";
import { isLoreWeaveEnabled } from "../../utils/loreweave-gate.js";
import { DEFAULT_MODEL_ENDPOINT } from "../../utils/constants.js";
import {
	CHAT_MAX_CONTEXT_CHARS,
	CHAT_MAX_CHAPTER_CHARS,
} from "../../utils/constants.js";

export default {
	action: "story-chat",

	handler(message, sendResponse) {
		const {
			question,
			novelId,
			conversationHistory = [],
			chapterText = "",
		} = message;

		_buildResponse(question, novelId, conversationHistory, chapterText)
			.then(({ answer, updatedHistory }) =>
				sendResponse({
					success: true,
					answer,
					conversationHistory: updatedHistory,
				}),
			)
			.catch((err) =>
				sendResponse({ success: false, error: err.message }),
			);

		return true;
	},
};

async function _buildResponse(question, novelId, history, chapterText) {
	const config = await browser.storage.local.get();
	const settings = await getChatSettings();

	const novelTitle = config.lw_novel_title || "this novel";
	const contextBlock = await _assembleContext(
		novelId,
		question,
		chapterText,
		settings,
	);

	const systemPrompt = `You are a story assistant for "${novelTitle}".
Answer questions using ONLY the provided story context.
If the answer is not in the context, say so clearly.
Keep answers concise (2-4 sentences unless detail is needed).

## Story context
${contextBlock}`;

	const trimmedHistory = history.slice(-(settings.maxHistory * 2));

	const answer = await _callProvider(
		config,
		systemPrompt,
		question,
		trimmedHistory,
	);

	const updatedHistory = [
		...trimmedHistory,
		{ role: "user", parts: [{ text: question }] },
		{ role: "model", parts: [{ text: answer }] },
	];

	return { answer, updatedHistory };
}

async function _callProvider(config, systemPrompt, question, history) {
	const provider = String(config.aiProvider || "gemini").toLowerCase();

	if (provider === "openai-compatible") {
		return _callOpenAI(config, systemPrompt, question, history);
	}
	if (provider === "ollama") {
		return _callOllama(config, systemPrompt, question, history);
	}
	return _callGemini(config, systemPrompt, question, history);
}

async function _callGemini(config, systemPrompt, question, history) {
	const apiKey = config.apiKey;
	if (!apiKey) throw new Error("No Gemini API key configured.");

	const modelEndpoint = config.modelEndpoint || DEFAULT_MODEL_ENDPOINT;

	const contents = [
		...history,
		{ role: "user", parts: [{ text: question }] },
	];

	const res = await fetch(`${modelEndpoint}?key=${apiKey}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			system_instruction: { parts: [{ text: systemPrompt }] },
			contents,
			generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
		}),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Gemini error ${res.status}: ${body.slice(0, 100)}`);
	}

	const data = await res.json();
	return (
		data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
		"No answer generated."
	);
}

async function _callOpenAI(config, systemPrompt, question, history) {
	const apiKey = config.openAiApiKey || config.apiKey;
	if (!apiKey) throw new Error("No OpenAI-compatible API key configured.");

	const endpoint =
		config.openAiEndpoint || "https://api.openai.com/v1/chat/completions";

	// Convert Gemini history format to OpenAI format
	const messages = [
		{ role: "system", content: systemPrompt },
		...history.map((h) => ({
			role: h.role === "model" ? "assistant" : h.role,
			content: h.parts?.[0]?.text || "",
		})),
		{ role: "user", content: question },
	];

	const res = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: config.openAiModel || "gpt-4o-mini",
			messages,
			temperature: 0.3,
			max_tokens: 1024,
		}),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`OpenAI error ${res.status}: ${body.slice(0, 100)}`);
	}

	const data = await res.json();
	return (
		data?.choices?.[0]?.message?.content?.trim() || "No answer generated."
	);
}

async function _callOllama(config, systemPrompt, question, history) {
	const endpoint =
		config.ollamaEndpoint || "http://localhost:11434/api/generate";
	const model = config.ollamaModel || "llama3.1:8b";

	// Ollama generate API: embed history as conversation in prompt
	let prompt = `${systemPrompt}\n\n`;
	for (const h of history) {
		const role = h.role === "model" ? "Assistant" : "User";
		prompt += `${role}: ${h.parts?.[0]?.text || ""}\n`;
	}
	prompt += `User: ${question}\nAssistant:`;

	const res = await fetch(endpoint, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ model, prompt, stream: false }),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Ollama error ${res.status}: ${body.slice(0, 100)}`);
	}

	const data = await res.json();
	return String(data?.response || "").trim() || "No answer generated.";
}

/**
 * Build the story context from the sources the user left switched on. Each
 * source is optional and independent — with all of them off the model is told
 * so, rather than being handed an empty block it would then hallucinate into.
 */
async function _assembleContext(novelId, question, chapterText, settings) {
	const sections = [];
	let budget = CHAT_MAX_CONTEXT_CHARS;

	if (settings.useCurrentChapter && chapterText) {
		const text = chapterText.slice(0, CHAT_MAX_CHAPTER_CHARS);
		sections.push(`## Current chapter\n${text}`);
		budget -= text.length;
	}

	if (novelId && settings.useChronicle) {
		const chronicle = await _chronicleSection(novelId, question, budget);
		if (chronicle) sections.push(`## Chapter summaries\n${chronicle}`);
	}

	// The entity index comes from LoreWeave, so the master experimental gate
	// applies on top of the per-feature toggle.
	if (novelId && settings.useLoreWeave && (await isLoreWeaveEnabled())) {
		const entities = await _entitySection(novelId);
		if (entities) sections.push(`## Known entities\n${entities}`);
	}

	if (!sections.length) {
		return novelId
			? "(No story context available. Enable a context source in Settings -> Chat, or enhance some chapters to build a chronicle.)"
			: "(No novel detected on the current tab, so no story context is available.)";
	}

	return sections.join("\n\n");
}

async function _chronicleSection(novelId, question, budget) {
	if (budget <= 0) return "";

	const chronicle = await loadChronicle(novelId);
	if (!chronicle) return "";

	const chapters = Object.values(chronicle.chapters || {})
		.filter((c) => c.summary)
		.sort((a, b) => a.chapterNum - b.chapterNum);

	if (!chapters.length) return "";

	const chapterMentions = [
		...(question.matchAll(/ch(?:apter)?\s*(\d+)/gi) || []),
	].map((m) => parseInt(m[1], 10));

	let selectedChapters;
	if (chapterMentions.length > 0) {
		const expanded = new Set();
		for (const num of chapterMentions) {
			for (let n = num - 2; n <= num + 2; n++) expanded.add(n);
		}
		selectedChapters = chapters.filter((c) => expanded.has(c.chapterNum));
		if (!selectedChapters.length) selectedChapters = chapters.slice(-10);
	} else {
		const earliest = chapters.slice(0, 5);
		const recent = chapters.slice(-10);
		const combined = [
			...new Map(
				[...earliest, ...recent].map((c) => [c.chapterNum, c]),
			).values(),
		];
		selectedChapters = combined.sort((a, b) => a.chapterNum - b.chapterNum);
	}

	let context = "";
	for (const ch of selectedChapters) {
		const line = `[${ch.chapterLabel}] ${ch.summary}\n`;
		if ((context + line).length > budget) break;
		context += line;
	}

	return context;
}

async function _entitySection(novelId) {
	const entityIndex = await getEntityIndex(novelId);
	return Object.values(entityIndex || {})
		.slice(0, 30)
		.map((e) => `${e.name} (${e.type})`)
		.join(", ");
}
