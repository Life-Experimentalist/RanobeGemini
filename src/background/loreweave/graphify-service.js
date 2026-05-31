/**
 * Graphify service — extracts story entities from chapter text and ingests into LoreWeave.
 * Also saves results to the local story chronicle when chronicle is enabled.
 */

import { buildGraphifyPrompt } from "./graphify-prompt.js";
import { postIngestDelta } from "./loreweave-client.js";
import {
	loadChronicle,
	saveChapterRecord,
	getEntityIndex,
	markGraphified,
} from "./chronicle-storage.js";

const MAX_CHAPTER_CHARS = 150_000;

/**
 * Extract story entities from chapter text and push to LoreWeave.
 *
 * @param {string} chapterText
 * @param {Object} config        - from browser.storage.local
 * @param {number} epochOrder    - chapter number as integer
 * @param {string} epochLabel    - e.g. "Chapter 042"
 * @returns {Promise<{entities_added, edges_added, domain_id}>}
 */
export async function graphifyChapter(
	chapterText,
	config,
	epochOrder,
	epochLabel,
) {
	const {
		loreWeaveUrl,
		loreWeaveDomainId,
		loreWeaveToken,
		loreWeaveChronicleEnabled,
		loreWeaveWritingStyle,
		loreWeaveNovelId,
	} = config;

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

	// Build prior context from chronicle if enabled
	let priorEntityIds = [];
	let priorContext = "";

	if (loreWeaveChronicleEnabled && loreWeaveNovelId) {
		const entityIndex = await getEntityIndex(loreWeaveNovelId);
		priorEntityIds = Object.keys(entityIndex);

		const chronicle = await loadChronicle(loreWeaveNovelId);
		const chapters = chronicle?.chapters || {};
		const sorted = Object.values(chapters)
			.filter((c) => c.chapterNum < epochOrder && c.shortSummary)
			.sort((a, b) => b.chapterNum - a.chapterNum);
		if (sorted.length > 0) {
			priorContext = sorted[0].shortSummary;
		}
	}

	const text = chapterText.slice(0, MAX_CHAPTER_CHARS);
	const prompt = buildGraphifyPrompt(text, loreWeaveDomainId, epochOrder, epochLabel, {
		priorEntityIds,
		priorContext,
		writingStyle: loreWeaveWritingStyle || "other",
	});

	const modelEndpoint =
		config.modelEndpoint ||
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

	const geminiRes = await fetch(`${modelEndpoint}?key=${apiKey}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			contents: [{ role: "user", parts: [{ text: prompt }] }],
			generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
		}),
	});

	if (!geminiRes.ok) {
		const errBody = await geminiRes.text().catch(() => "");
		throw new Error(`Gemini API error ${geminiRes.status}: ${errBody.slice(0, 200)}`);
	}

	const geminiData = await geminiRes.json();
	const rawJson = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
	if (!rawJson) {
		throw new Error("Gemini returned an empty response for graphify.");
	}

	const clean = rawJson
		.replace(/^```[a-z]*\n?/m, "")
		.replace(/```\s*$/m, "")
		.trim();

	let delta;
	try {
		delta = JSON.parse(clean);
	} catch (err) {
		throw new Error(`Gemini returned invalid JSON: ${err.message}`);
	}

	if (
		!delta.domain_id ||
		!Array.isArray(delta.extracted_entities) ||
		!Array.isArray(delta.state_forms) ||
		!Array.isArray(delta.temporal_edges)
	) {
		throw new Error(
			"Gemini response missing required fields (domain_id, extracted_entities, state_forms, temporal_edges).",
		);
	}

	await postIngestDelta(loreWeaveUrl, delta, loreWeaveToken || "");

	if (loreWeaveChronicleEnabled && loreWeaveNovelId) {
		await saveChapterRecord(loreWeaveNovelId, epochOrder, {
			chapterLabel: epochLabel,
			summary: "",
			shortSummary: "",
			entities: delta.extracted_entities.map((e) => ({
				id: e.id,
				name: e.name,
				type: e.type,
				aliases: e.aliases || [],
			})),
			edges: (delta.temporal_edges || []).map((e) => ({
				source_id: e.source_id,
				target_id: e.target_id,
				relation_type: e.relation_type,
				weight: e.weight || 1.0,
			})),
			graphified: true,
			domainId: loreWeaveDomainId,
		});
		await markGraphified(loreWeaveNovelId, epochOrder);
	}

	return {
		entities_added: delta.extracted_entities.length,
		edges_added: delta.temporal_edges?.length ?? 0,
		domain_id: delta.domain_id,
	};
}
