/**
 * Builds the Gemini extraction prompt for LoreWeave.
 *
 * Universal schema — works for any fiction style:
 *   Entity types: character | place | group | item | concept | other
 *   Relation types: KNOWS | ALLIED | OPPOSED | LEADS | MENTORS |
 *                   OWNS | MEMBER_OF | LOCATED_AT | CREATED | RELATED_TO
 *
 * @param {string}   chapterText    - Plain text chapter
 * @param {string}   domainId       - LoreWeave domain, e.g. "lw_dom_xianxia"
 * @param {number}   epochOrder     - Chapter number as integer
 * @param {string}   epochLabel     - e.g. "Chapter 042"
 * @param {Object}   [options]
 * @param {string[]} [options.priorEntityIds]  - Known entity IDs from chronicle
 * @param {string}   [options.priorContext]    - 1-sentence summary of prior events
 * @param {string}   [options.writingStyle]    - "xianxia"|"litrpg"|"fantasy"|"romance"|"thriller"|"other"
 * @returns {string}
 */
export function buildGraphifyPrompt(
	chapterText,
	domainId,
	epochOrder,
	epochLabel,
	options = {},
) {
	const { priorEntityIds = [], priorContext = "", writingStyle = "other" } = options;
	const chPad = String(epochOrder).padStart(4, "0");

	const styleHints = {
		xianxia:
			"This is a xianxia/cultivation novel. Treat cultivation realms, techniques, and sect names as `concept` or `group` entities. Characters often have many aliases and titles.",
		litrpg:
			"This is a LitRPG/system novel. Treat skill names, class titles, and system notifications as `concept` entities. Named gear is `item`.",
		fantasy:
			"This is a western fantasy novel. Magic schools, divine laws, and world-specific terms are `concept` entities.",
		romance:
			"This is a romance novel. Focus on character relationships. KNOWS and RELATED_TO edges are most common.",
		thriller:
			"This is a thriller/mystery. Focus on alliances, oppositions, and secrets.",
		other: "",
	};
	const styleHint = styleHints[writingStyle] || "";

	const priorCtxBlock = priorContext
		? `\n## Prior story context\n${priorContext}\n`
		: "";

	const priorIdsBlock = priorEntityIds.length
		? `\n## Known entity IDs (REUSE these exact IDs — do not invent new IDs for the same entity)\n${priorEntityIds.slice(0, 60).join(", ")}\n`
		: "";

	return `You are a story knowledge-graph extractor for LoreWeave.
Analyse the chapter below and extract all named entities and relationships ESTABLISHED OR CHANGED in this chapter only.
${styleHint}
${priorCtxBlock}${priorIdsBlock}
## Output format
Return ONLY valid JSON. No markdown fences, no commentary, no trailing text.

{
  "domain_id": "${domainId}",
  "extracted_entities": [
    {
      "id": "lw_ent_<slug>",
      "name": "<canonical name in source language>",
      "type": "<character|place|group|item|concept|other>",
      "aliases": ["<alternate name or transliteration>"]
    }
  ],
  "state_forms": [
    {
      "id": "lw_sf_<entity_slug>_ch${chPad}",
      "entity_id": "lw_ent_<slug>",
      "epoch_order": ${epochOrder},
      "epoch_label": "${epochLabel}"
    }
  ],
  "temporal_edges": [
    {
      "source_id": "lw_sf_<a>_ch${chPad}",
      "target_id": "lw_sf_<b>_ch${chPad}",
      "relation_type": "<KNOWS|ALLIED|OPPOSED|LEADS|MENTORS|OWNS|MEMBER_OF|LOCATED_AT|CREATED|RELATED_TO>",
      "start_epoch": ${epochOrder},
      "end_epoch": null,
      "weight": 1.0
    }
  ]
}

## ID rules
- All IDs: lowercase letters, digits, underscores only.
- Entity IDs: lw_ent_ + romanised slug. SAME entity across chapters = SAME ID.
- State form IDs: lw_sf_ + entity_slug + _ch + zero-padded chapter number.
- epoch_order MUST be the integer ${epochOrder} — never a string.
- Include ALL known name variants, nicknames, titles, and alternate-language names as aliases.

## Entity types
- character  — named person, cultivator, demon, god, AI, spirit, etc.
- place      — named location, realm, dungeon, city, sect headquarters, plane
- group      — named organisation, sect, guild, army, clan, kingdom
- item       — named weapon, artifact, tool, cultivation manual, technique, skill book
- concept    — cultivation stage, magic system, divine law, title, status effect, class
- other      — any clearly named recurring element that does not fit above

## Relation types
- KNOWS       — characters are mutually aware of each other
- ALLIED      — cooperative, sworn companions, allies
- OPPOSED     — enemies, rivals, antagonistic forces
- LEADS       — source commands/leads target (person to group or superior to subordinate)
- MENTORS     — source teaches/trains/guides target (one direction)
- OWNS        — source possesses target item
- MEMBER_OF   — source belongs to target group
- LOCATED_AT  — source entity is at/from target place
- CREATED     — source made/summoned/forged/discovered target entity
- RELATED_TO  — any meaningful link that does not fit above

## Rules
- Include a state_form for EVERY entity that appears or is referenced.
- Create edges ONLY for relationships explicitly shown or stated.
- Consolidate the same entity under different names into ONE entity with all names as aliases.
- If unsure of relation type, use RELATED_TO rather than omitting the edge.
- epoch_order must always be ${epochOrder} for every state_form and edge in this response.

## Chapter text
${chapterText}`;
}
