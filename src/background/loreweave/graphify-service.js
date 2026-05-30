/**
 * Graphify service — extracts story entities from chapter text and ingests into LoreWeave.
 *
 * Calls the Gemini API directly with a low-temperature extraction prompt,
 * then POSTs the structured result to the LoreWeave /lw_api/ingest endpoint.
 */

import { buildGraphifyPrompt } from "./graphify-prompt.js";
import { postIngestDelta } from "./loreweave-client.js";

// 150k chars ~= 100k tokens; well within Gemini 2.0 Flash 1M context window
const MAX_CHAPTER_CHARS = 150_000;

/**
 * Extract story entities from chapter text and push to LoreWeave.
 *
 * @param {string} chapterText    - Raw plain-text chapter
 * @param {Object} config         - Extension settings from browser.storage.local
 * @param {number} epochOrder     - Chapter number as integer (epoch_order for LoreWeave)
 * @param {string} epochLabel     - Human-readable epoch string, e.g. "Chapter 042"
 * @returns {Promise<{entities_added: number, edges_added: number, domain_id: string}>}
 */
export async function graphifyChapter(
	chapterText,
	config,
	epochOrder,
	epochLabel,
) {
	const { loreWeaveUrl, loreWeaveDomainId, loreWeaveToken } = config;
	if (!loreWeaveUrl || !loreWeaveDomainId) {
		throw new Error(
			"LoreWeave URL and Domain ID must be configured in the LoreWeave tab.",
		);
	}

	const apiKey = config.apiKey;
	if (!apiKey) {
		throw new Error(
			"No Gemini API key configured. Set one in the extension settings.",
		);
	}

	const text = chapterText.slice(0, MAX_CHAPTER_CHARS);
	const prompt = buildGraphifyPrompt(
		text,
		loreWeaveDomainId,
		epochOrder,
		epochLabel,
	);

	// Call Gemini directly with low temperature for structured JSON extraction
	const modelEndpoint =
		config.modelEndpoint ||
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

	const requestBody = {
		contents: [{ role: "user", parts: [{ text: prompt }] }],
		generationConfig: {
			temperature: 0.1,
			maxOutputTokens: 8192,
		},
	};

	const geminiRes = await fetch(`${modelEndpoint}?key=${apiKey}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(requestBody),
	});

	if (!geminiRes.ok) {
		const errBody = await geminiRes.text().catch(() => "");
		throw new Error(
			`Gemini API error ${geminiRes.status}: ${errBody.slice(0, 200)}`,
		);
	}

	const geminiData = await geminiRes.json();
	const rawJson =
		geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

	if (!rawJson) {
		throw new Error("Gemini returned an empty response for graphify.");
	}

	// Strip accidental markdown code fences before parsing
	const clean = rawJson
		.replace(/^```[a-z]*\n?/m, "")
		.replace(/```\s*$/m, "")
		.trim();

	let delta;
	try {
		delta = JSON.parse(clean);
	} catch (err) {
		throw new Error(
			`Gemini returned invalid JSON for graphify: ${err.message}`,
		);
	}

	if (!delta.domain_id || !Array.isArray(delta.extracted_entities)) {
		throw new Error(
			"Gemini response is missing required fields (domain_id, extracted_entities).",
		);
	}

	await postIngestDelta(loreWeaveUrl, delta, loreWeaveToken || "");

	return {
		entities_added: delta.extracted_entities.length,
		edges_added: delta.temporal_edges?.length ?? 0,
		domain_id: delta.domain_id,
	};
}
