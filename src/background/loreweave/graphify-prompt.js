/**
 * Builds the Gemini prompt for LoreWeave entity extraction.
 *
 * Outputs JSON matching the LoreWeave Phase 5 IngestDelta schema:
 * {
 *   domain_id: string,
 *   extracted_entities: [{id, name, type, aliases}],
 *   state_forms:        [{id, entity_id, epoch_order, epoch_label}],
 *   temporal_edges:     [{source_id, target_id, relation_type, start_epoch, end_epoch, weight}]
 * }
 *
 * epoch_order must be a JSON integer (the chapter number).
 * relation_type must be one of: ALIGNED_WITH, HATES, MENTORS, KNOWS_SECRET
 */

/**
 * @param {string} chapterText   - Plain text of the chapter
 * @param {string} domainId      - LoreWeave domain ID, e.g. "lw_dom_xianxia"
 * @param {number} epochOrder    - Chapter number as integer (e.g. 42)
 * @param {string} epochLabel    - Human-readable epoch, e.g. "Chapter 042"
 * @returns {string}
 */
export function buildGraphifyPrompt(
	chapterText,
	domainId,
	epochOrder,
	epochLabel,
) {
	return `You are a story knowledge-graph extractor for LoreWeave.

Analyse the novel chapter below. Extract all named entities and the relationships between them that are ESTABLISHED OR CHANGED in this chapter only. Do not infer from prior chapters.

## Output format
Return ONLY valid JSON matching this exact shape. No markdown fences, no commentary, no trailing text.

{
  "domain_id": "${domainId}",
  "extracted_entities": [
    {
      "id": "lw_ent_<slug>",
      "name": "<canonical name in source language>",
      "type": "<character|artifact|location|faction>",
      "aliases": ["<alternate name>", "<transliteration>"]
    }
  ],
  "state_forms": [
    {
      "id": "lw_sf_<entity_slug>_ch${String(epochOrder).padStart(4, "0")}",
      "entity_id": "lw_ent_<slug>",
      "epoch_order": ${epochOrder},
      "epoch_label": "${epochLabel}"
    }
  ],
  "temporal_edges": [
    {
      "source_id": "lw_sf_<a>_ch${String(epochOrder).padStart(4, "0")}",
      "target_id": "lw_sf_<b>_ch${String(epochOrder).padStart(4, "0")}",
      "relation_type": "<ALIGNED_WITH|HATES|MENTORS|KNOWS_SECRET>",
      "start_epoch": ${epochOrder},
      "end_epoch": null,
      "weight": 1.0
    }
  ]
}

## ID rules
- All IDs use only lowercase letters, digits, and underscores.
- Entity IDs: lw_ent_ + romanised slug of canonical name. Same entity MUST get the same ID across all chapters.
- State form IDs: lw_sf_ + entity slug + _ + ch + zero-padded chapter number (e.g. lw_sf_li_wei_ch0042).
- epoch_order MUST be the integer ${epochOrder}. Do NOT use a string.
- Include ALL known aliases (other-language names, nicknames, titles, epithets).

## Relation types (use EXACTLY these strings)
- ALIGNED_WITH: working together, sworn allies, members of same group
- HATES: antagonistic, enemies, sworn rivals
- MENTORS: teaching/training/guiding (one direction: mentor source -> student target)
- KNOWS_SECRET: source character knows a secret about target character

## Entity types
- character: any named person, cultivator, demon, god, AI, etc.
- artifact: named weapons, tools, treasures, techniques, cultivation manuals
- location: named places, realms, sects, cities, planes of existence
- faction: named organisations, sects, kingdoms, clans

## Rules
- Include a state_form for EVERY entity that appears or is referenced in this chapter.
- Create temporal_edges ONLY for relationships explicitly shown or stated in this chapter.
- Consolidate the same entity across different names into ONE entity with all names as aliases.
- If unsure which relation_type applies, omit the edge rather than guess.
- epoch_order must always be the integer ${epochOrder} for every state_form and edge in this response.

## Chapter text
${chapterText}`;
}
