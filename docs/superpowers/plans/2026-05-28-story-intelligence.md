# Story Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the narrow 4-relation graphify extraction with a universal 6-entity / 10-relation schema that works for any fiction style, add a per-novel story chronicle stored in `browser.storage.local`, use that chronicle to improve future AI summaries with prior context, and sync stable entity IDs with LoreWeave's integer epoch versioning.

**Architecture:** Three layers — (1) LoreWeave backend gets expanded relation types, (2) `chronicle-storage.js` owns all per-novel storage with a clean read/write API, (3) `graphify-prompt.js` + `graphify-service.js` are updated to produce the universal schema and save results to the chronicle. Summary improvement hooks into the existing background summarization path via `browser.storage.local` reads before the AI call.

**Tech Stack:** Python/FastAPI (LoreWeave backend), plain JS (extension), `browser.storage.local`, Gemini REST API.

---

### Task 1: Expand LoreWeave backend relation types

**Files:**
- Modify: `V:\Code\ProjectCode\LoreWeave\backend\src\loreweave\graph\graphify.py:9`
- Modify: `V:\Code\ProjectCode\LoreWeave\frontend\src\utils\api.ts:19`
- Modify: `V:\Code\ProjectCode\LoreWeave\backend\tests\test_graphify.py`
- Modify: `V:\Code\ProjectCode\LoreWeave\backend\tests\test_routes.py`

- [ ] **Step 1: Update _VALID_RELATION_TYPES in graphify.py**

Open `V:\Code\ProjectCode\LoreWeave\backend\src\loreweave\graph\graphify.py`. Replace line 9:

```python
_VALID_RELATION_TYPES = frozenset({
    # Universal relation types (Phase 6)
    "KNOWS", "ALLIED", "OPPOSED", "LEADS", "MENTORS",
    "OWNS", "MEMBER_OF", "LOCATED_AT", "CREATED", "RELATED_TO",
    # Legacy aliases — kept for backward-compatibility with existing graph data
    "ALIGNED_WITH", "HATES", "KNOWS_SECRET",
})
```

- [ ] **Step 2: Update the regex assertion on the same line below**

The existing assertion in `upsert_temporal_edge` checks `re.fullmatch(r"[A-Z_]+", relation_type)`. This still works — all new types are `[A-Z_]+`. No change needed.

- [ ] **Step 3: Update test_valid_relation_types_are_known in test_graphify.py**

Find the test `test_valid_relation_types_are_known` and update it:

```python
def test_valid_relation_types_are_known() -> None:
    assert "KNOWS" in _VALID_RELATION_TYPES
    assert "ALLIED" in _VALID_RELATION_TYPES
    assert "OPPOSED" in _VALID_RELATION_TYPES
    assert "LEADS" in _VALID_RELATION_TYPES
    assert "MENTORS" in _VALID_RELATION_TYPES
    assert "OWNS" in _VALID_RELATION_TYPES
    assert "MEMBER_OF" in _VALID_RELATION_TYPES
    assert "LOCATED_AT" in _VALID_RELATION_TYPES
    assert "CREATED" in _VALID_RELATION_TYPES
    assert "RELATED_TO" in _VALID_RELATION_TYPES
    # Legacy aliases still accepted
    assert "ALIGNED_WITH" in _VALID_RELATION_TYPES
    assert "HATES" in _VALID_RELATION_TYPES
    assert "KNOWS_SECRET" in _VALID_RELATION_TYPES
```

- [ ] **Step 4: Add acceptance test for new relation types in test_routes.py**

Add at the end of `test_routes.py`:

```python
@pytest.mark.asyncio
async def test_ingest_accepts_new_relation_types():
    """All 10 universal relation types must be accepted (not rejected with 422)."""
    for rel in ["KNOWS", "ALLIED", "OPPOSED", "LEADS", "OWNS",
                "MEMBER_OF", "LOCATED_AT", "CREATED", "RELATED_TO"]:
        payload = {
            "domain_id": "lw_dom_test",
            "extracted_entities": [],
            "state_forms": [],
            "temporal_edges": [
                {
                    "source_id": "lw_sf_a",
                    "target_id": "lw_sf_b",
                    "relation_type": rel,
                    "start_epoch": 1,
                }
            ],
        }
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/lw_api/ingest", json=payload)
        assert response.status_code == 200, f"Expected 200 for {rel}, got {response.status_code}"
```

- [ ] **Step 5: Run LoreWeave tests**

```powershell
cd V:\Code\ProjectCode\LoreWeave\backend
uv run pytest tests/test_graphify.py tests/test_routes.py -v
```

Expected: all pass including new tests.

- [ ] **Step 6: Update api.ts relation_type union**

In `V:\Code\ProjectCode\LoreWeave\frontend\src\utils\api.ts`, replace line 19:

```typescript
export interface TemporalEdge {
  source_id: string;
  target_id: string;
  relation_type:
    | 'KNOWS' | 'ALLIED' | 'OPPOSED' | 'LEADS' | 'MENTORS'
    | 'OWNS' | 'MEMBER_OF' | 'LOCATED_AT' | 'CREATED' | 'RELATED_TO'
    | 'ALIGNED_WITH' | 'HATES' | 'KNOWS_SECRET';
  start_epoch: number;
  end_epoch?: number;
  weight?: number;
}
```

Also update `Entity.type`:

```typescript
export interface Entity {
  id: string;
  name: string;
  type: 'character' | 'place' | 'group' | 'item' | 'concept' | 'other';
}
```

- [ ] **Step 7: Commit LoreWeave changes**

```powershell
cd V:\Code\ProjectCode\LoreWeave
git add backend/src/loreweave/graph/graphify.py backend/tests/test_graphify.py backend/tests/test_routes.py frontend/src/utils/api.ts
git commit -m "feat: expand relation types to 10 universal + 3 legacy; add entity type 'place/group/item/concept/other'"
```

---

### Task 2: Create chronicle-storage.js

**Files:**
- Create: `V:\Code\ProjectCode\RanobesGemini\src\background\loreweave\chronicle-storage.js`

- [ ] **Step 1: Create the file**

Create `src/background/loreweave/chronicle-storage.js` with this content:

```js
/**
 * Chronicle Storage — per-novel accumulated story context.
 *
 * Storage key: rg_chronicle_{novelId}
 *
 * Schema:
 * {
 *   novelId, domainId, lastUpdated,
 *   chapters: {
 *     [chapterNum]: {
 *       chapterNum, chapterLabel, summary, shortSummary,
 *       entities: [{id, name, type}],
 *       edges: [{source_id, target_id, relation_type, weight}],
 *       graphified: boolean,
 *       timestamp
 *     }
 *   },
 *   entityIndex: {
 *     [entityId]: { id, name, type, aliases, lastSeenChapter }
 *   }
 * }
 */

const CHRONICLE_PREFIX = "rg_chronicle_";

function chronicleKey(novelId) {
	return `${CHRONICLE_PREFIX}${novelId}`;
}

/**
 * Load the full chronicle for a novel. Returns null if none exists.
 * @param {string} novelId
 * @returns {Promise<Object|null>}
 */
export async function loadChronicle(novelId) {
	const key = chronicleKey(novelId);
	const stored = await browser.storage.local.get(key);
	return stored[key] || null;
}

/**
 * Save (merge) a chapter record into the chronicle.
 * Also updates the entityIndex with any new/seen entities.
 * @param {string} novelId
 * @param {number} chapterNum
 * @param {{ chapterLabel, summary, shortSummary, entities, edges }} record
 */
export async function saveChapterRecord(novelId, chapterNum, record) {
	const key = chronicleKey(novelId);
	const stored = await browser.storage.local.get(key);
	const chronicle = stored[key] || {
		novelId,
		domainId: record.domainId || "",
		lastUpdated: 0,
		chapters: {},
		entityIndex: {},
	};

	chronicle.chapters[chapterNum] = {
		chapterNum,
		chapterLabel: record.chapterLabel || `Chapter ${chapterNum}`,
		summary: record.summary || "",
		shortSummary: record.shortSummary || "",
		entities: record.entities || [],
		edges: record.edges || [],
		graphified: record.graphified || false,
		timestamp: Date.now(),
	};

	// Merge into entityIndex
	for (const entity of record.entities || []) {
		if (!entity.id) continue;
		const existing = chronicle.entityIndex[entity.id];
		chronicle.entityIndex[entity.id] = {
			id: entity.id,
			name: entity.name,
			type: entity.type,
			aliases: entity.aliases || existing?.aliases || [],
			lastSeenChapter: chapterNum,
		};
	}

	chronicle.lastUpdated = Date.now();
	if (record.domainId) chronicle.domainId = record.domainId;

	await browser.storage.local.set({ [key]: chronicle });
}

/**
 * Get a single chapter record from the chronicle.
 * @param {string} novelId
 * @param {number} chapterNum
 * @returns {Promise<Object|null>}
 */
export async function getChapterRecord(novelId, chapterNum) {
	const chronicle = await loadChronicle(novelId);
	return chronicle?.chapters?.[chapterNum] || null;
}

/**
 * Get the N most recent chapter summaries before a given chapter number.
 * Returns newest-first.
 * @param {string} novelId
 * @param {number} beforeChapter - upper bound (exclusive)
 * @param {number} count
 * @returns {Promise<Array<{chapterNum, chapterLabel, summary}>>}
 */
export async function getRecentSummaries(novelId, beforeChapter, count = 5) {
	const chronicle = await loadChronicle(novelId);
	if (!chronicle?.chapters) return [];
	return Object.values(chronicle.chapters)
		.filter((c) => c.chapterNum < beforeChapter && c.summary)
		.sort((a, b) => b.chapterNum - a.chapterNum)
		.slice(0, count)
		.map(({ chapterNum, chapterLabel, summary }) => ({
			chapterNum,
			chapterLabel,
			summary,
		}));
}

/**
 * Get the entity index (all known entities for this novel).
 * @param {string} novelId
 * @returns {Promise<Object>}
 */
export async function getEntityIndex(novelId) {
	const chronicle = await loadChronicle(novelId);
	return chronicle?.entityIndex || {};
}

/**
 * Mark a chapter as successfully sent to LoreWeave.
 * @param {string} novelId
 * @param {number} chapterNum
 */
export async function markGraphified(novelId, chapterNum) {
	const key = chronicleKey(novelId);
	const stored = await browser.storage.local.get(key);
	const chronicle = stored[key];
	if (!chronicle?.chapters?.[chapterNum]) return;
	chronicle.chapters[chapterNum].graphified = true;
	chronicle.lastUpdated = Date.now();
	await browser.storage.local.set({ [key]: chronicle });
}

/**
 * Wipe all chronicle data for a novel.
 * @param {string} novelId
 */
export async function clearChronicle(novelId) {
	await browser.storage.local.remove(chronicleKey(novelId));
}
```

- [ ] **Step 2: Verify the file was created**

```powershell
Test-Path "V:\Code\ProjectCode\RanobesGemini\src\background\loreweave\chronicle-storage.js"
```

Expected: `True`

- [ ] **Step 3: Commit**

```powershell
cd V:\Code\ProjectCode\RanobesGemini
git add src/background/loreweave/chronicle-storage.js
git commit -m "feat: add chronicle-storage.js — per-novel story context accumulation"
```

---

### Task 3: Rewrite graphify-prompt.js with universal schema

**Files:**
- Modify: `src/background/loreweave/graphify-prompt.js`

- [ ] **Step 1: Replace the entire file**

```js
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

	const styleHint = {
		xianxia: "This is a xianxia/cultivation novel. Treat cultivation realms, techniques, and sect names as `concept` or `group` entities. Characters often have multiple titles and aliases.",
		litrpg: "This is a LitRPG novel. Treat skill names, class titles, and system notifications as `concept` entities. Stat sheets list `item` entities.",
		fantasy: "This is a western fantasy novel. Magic schools, divine laws, and world-specific terms are `concept` entities.",
		romance: "This is a romance novel. Focus on character relationships and secrets. `KNOWS_SECRET` (mapped to `KNOWS`) and `RELATED_TO` are common.",
		thriller: "This is a thriller/mystery. Focus on alliances, oppositions, and secrets. Many `KNOWS` and `OPPOSED` edges.",
		other: "",
	}[writingStyle] || "";

	const priorCtxBlock = priorContext
		? `\n## Prior story context\n${priorContext}\n`
		: "";

	const priorIdsBlock = priorEntityIds.length
		? `\n## Known entity IDs (REUSE these — do not invent new IDs for the same entity)\n${priorEntityIds.slice(0, 60).join(", ")}\n`
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
- other      — any clearly named recurring element that doesn't fit above

## Relation types
- KNOWS       — characters are mutually aware of each other
- ALLIED      — cooperative, sworn companions, allies
- OPPOSED     — enemies, rivals, antagonistic forces
- LEADS       — source commands/leads target (person→group or superior→subordinate)
- MENTORS     — source teaches/trains/guides target (one direction)
- OWNS        — source possesses target item
- MEMBER_OF   — source belongs to target group
- LOCATED_AT  — source entity is at/from target place
- CREATED     — source made/summoned/forged/discovered target entity
- RELATED_TO  — any meaningful link that doesn't fit above

## Rules
- Include a state_form for EVERY entity that appears or is referenced.
- Create edges ONLY for relationships explicitly shown or stated.
- Consolidate the same entity under different names into ONE entity with all names as aliases.
- If unsure of relation type, use RELATED_TO rather than omitting the edge.
- epoch_order must always be ${epochOrder} for every state_form and edge in this response.

## Chapter text
${chapterText}`;
}
```

- [ ] **Step 2: Build and lint**

```powershell
cd V:\Code\ProjectCode\RanobesGemini
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```powershell
git add src/background/loreweave/graphify-prompt.js
git commit -m "feat: universal 6-entity/10-relation extraction schema with style hints and prior context"
```

---

### Task 4: Update graphify-service.js to use chronicle

**Files:**
- Modify: `src/background/loreweave/graphify-service.js`

- [ ] **Step 1: Add chronicle imports and update graphifyChapter**

Replace the content of `src/background/loreweave/graphify-service.js` with:

```js
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
 * Also saves results to the local story chronicle.
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
	const novelId = config.loreWeaveNovelId || null;
	let priorEntityIds = [];
	let priorContext = "";

	if (loreWeaveChronicleEnabled && novelId) {
		const entityIndex = await getEntityIndex(novelId);
		priorEntityIds = Object.keys(entityIndex);

		const chronicle = await loadChronicle(novelId);
		const chapters = chronicle?.chapters || {};
		const sorted = Object.values(chapters)
			.filter((c) => c.chapterNum < epochOrder && c.shortSummary)
			.sort((a, b) => b.chapterNum - a.chapterNum);
		if (sorted.length > 0) {
			priorContext = sorted[0].shortSummary;
		}
	}

	const text = chapterText.slice(0, MAX_CHAPTER_CHARS);
	const prompt = buildGraphifyPrompt(
		text,
		loreWeaveDomainId,
		epochOrder,
		epochLabel,
		{
			priorEntityIds,
			priorContext,
			writingStyle: loreWeaveWritingStyle || "other",
		},
	);

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

	if (!delta.domain_id || !Array.isArray(delta.extracted_entities)) {
		throw new Error("Gemini response missing required fields (domain_id, extracted_entities).");
	}

	// Send to LoreWeave backend
	await postIngestDelta(loreWeaveUrl, delta, loreWeaveToken || "");

	// Save to chronicle if enabled
	if (loreWeaveChronicleEnabled && novelId) {
		await saveChapterRecord(novelId, epochOrder, {
			chapterLabel: epochLabel,
			summary: "",       // summary is set separately after AI summary generation
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
		await markGraphified(novelId, epochOrder);
	}

	return {
		entities_added: delta.extracted_entities.length,
		edges_added: delta.temporal_edges?.length ?? 0,
		domain_id: delta.domain_id,
	};
}
```

- [ ] **Step 2: Build and lint**

```powershell
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```powershell
git add src/background/loreweave/graphify-service.js
git commit -m "feat: graphify service uses chronicle for prior entity IDs and context"
```

---

### Task 5: Add new constants and config defaults

**Files:**
- Modify: `src/utils/constants.js` — add 3 new LoreWeave constants
- Modify: `src/config/config.js` — add 3 new defaults

- [ ] **Step 1: Add constants to constants.js**

Find the `LOREWEAVE_AUTO_GRAPHIFY` line at the end of `src/utils/constants.js`. Add these after it:

```js
export const LOREWEAVE_CHRONICLE_ENABLED = false;  // opt-in: accumulate story chronicle
export const LOREWEAVE_USE_PRIOR_CONTEXT = false;  // inject chronicle into summaries
export const LOREWEAVE_WRITING_STYLE = "other";    // hint for extraction prompt
```

- [ ] **Step 2: Add to COMPREHENSIVE_BACKUP_KEYS**

In the `COMPREHENSIVE_BACKUP_KEYS` array, find the loreweave section and add:

```js
"loreWeaveChronicleEnabled",
"loreWeaveUsePriorContext",
"loreWeaveWritingStyle",
```

- [ ] **Step 3: Add defaults to config.js**

Find the `loreWeaveAutoGraphify` line in `DEFAULT_CONFIG`. Add after it:

```js
loreWeaveChronicleEnabled: LOREWEAVE_CHRONICLE_ENABLED,
loreWeaveUsePriorContext: LOREWEAVE_USE_PRIOR_CONTEXT,
loreWeaveWritingStyle: LOREWEAVE_WRITING_STYLE,
```

Also add the imports at the top:

```js
import {
    // ... existing imports ...
    LOREWEAVE_CHRONICLE_ENABLED,
    LOREWEAVE_USE_PRIOR_CONTEXT,
    LOREWEAVE_WRITING_STYLE,
} from "../utils/constants.js";
```

- [ ] **Step 4: Build and lint**

```powershell
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```powershell
git add src/utils/constants.js src/config/config.js
git commit -m "feat: add chronicle and writing-style config constants"
```

---

### Task 6: Add chronicle settings to popup LoreWeave tab

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.js`

- [ ] **Step 1: Add controls to popup.html**

Find the LoreWeave tab panel in `popup.html` (the `id="loreweave"` div). After the existing `lwAutoGraphify` checkbox item, add:

```html
<div class="config-item">
    <label class="check-label">
        <input type="checkbox" id="lwChronicleEnabled" />
        <span>Build story chronicle (accumulate chapter context)</span>
    </label>
</div>

<div class="config-item">
    <label class="check-label">
        <input type="checkbox" id="lwUsePriorContext" />
        <span>Use chronicle context to improve summaries</span>
    </label>
</div>

<div class="config-item">
    <label for="lwWritingStyle">Writing Style Hint</label>
    <select id="lwWritingStyle" class="config-select">
        <option value="other">General (any style)</option>
        <option value="xianxia">Xianxia / Cultivation</option>
        <option value="litrpg">LitRPG / System</option>
        <option value="fantasy">Western Fantasy</option>
        <option value="romance">Romance</option>
        <option value="thriller">Thriller / Mystery</option>
    </select>
</div>
```

- [ ] **Step 2: Wire up in popup.js**

At the end of the LoreWeave tab section in `popup.js` (near the other `lwAuto` logic), add:

```js
const lwChronicle = document.getElementById("lwChronicleEnabled");
const lwPriorCtx = document.getElementById("lwUsePriorContext");
const lwStyle = document.getElementById("lwWritingStyle");

// Load
browser.storage.local
    .get(["loreWeaveChronicleEnabled", "loreWeaveUsePriorContext", "loreWeaveWritingStyle"])
    .then(({ loreWeaveChronicleEnabled, loreWeaveUsePriorContext, loreWeaveWritingStyle }) => {
        if (lwChronicle) lwChronicle.checked = !!loreWeaveChronicleEnabled;
        if (lwPriorCtx) lwPriorCtx.checked = !!loreWeaveUsePriorContext;
        if (lwStyle) lwStyle.value = loreWeaveWritingStyle || "other";
    })
    .catch(() => {});

if (lwChronicle) {
    lwChronicle.addEventListener("change", () =>
        browser.storage.local.set({ loreWeaveChronicleEnabled: lwChronicle.checked }).catch(() => {})
    );
}
if (lwPriorCtx) {
    lwPriorCtx.addEventListener("change", () =>
        browser.storage.local.set({ loreWeaveUsePriorContext: lwPriorCtx.checked }).catch(() => {})
    );
}
if (lwStyle) {
    lwStyle.addEventListener("change", () =>
        browser.storage.local.set({ loreWeaveWritingStyle: lwStyle.value }).catch(() => {})
    );
}
```

- [ ] **Step 3: Build, lint, emoji scan**

```powershell
npm run lint && npm run build && npm run emoji:scan
```

Expected: 0 errors, no emoji issues.

- [ ] **Step 4: Commit**

```powershell
git add src/popup/popup.html src/popup/popup.js
git commit -m "feat: add chronicle and writing-style settings to LoreWeave popup tab"
```

---

### Task 7: Chronicle summary update hook

When a chapter is summarized (long or short), save that summary to the chronicle so future chapters have prior context available.

**Files:**
- Modify: `src/background/background.js` — hook summary result into chronicle

- [ ] **Step 1: Find the summarization response path in background.js**

Search for where the summary result is returned back to the content script:

```powershell
Select-String -Path "src\background\background.js" -Pattern "summarize|summary.*result|prose.*summary" | Select-Object -First 10
```

Find the message handler that handles summary requests (action `summarize` or similar). After the summary text is returned, add a call to `saveChapterRecord` if chronicle is enabled.

- [ ] **Step 2: Add the hook**

In `background.js`, import from chronicle-storage (add to imports at top):

```js
import {
    saveChapterRecord,
} from "./loreweave/chronicle-storage.js";
```

In the summary response handler, after the AI summary is generated and before `sendResponse` is called, add:

```js
// Save summary to chronicle if enabled
const config = await initConfig();
if (config.loreWeaveChronicleEnabled && message.novelId && message.chapterNum) {
    const isShort = message.isShort;
    const updateKey = isShort ? "shortSummary" : "summary";
    const key = `rg_chronicle_${message.novelId}`;
    const stored = await browser.storage.local.get(key);
    const chronicle = stored[key];
    if (chronicle?.chapters?.[message.chapterNum]) {
        chronicle.chapters[message.chapterNum][updateKey] = summaryText;
        chronicle.lastUpdated = Date.now();
        await browser.storage.local.set({ [key]: chronicle });
    }
}
```

- [ ] **Step 3: Ensure novelId and chapterNum are passed in summary messages**

Search for where `sendMessage({ action: "summarize" ... })` is called in `content.js`:

```powershell
Select-String -Path "src\content\content.js" -Pattern "action.*summar" | Select-Object -First 5
```

Add `novelId` and `chapterNum` to the payload if not already present:

```js
// In the summarize message payload, add:
novelId: getNovelIdFromCurrentPage?.() || null,
chapterNum: lastKnownNovelData?.currentChapter || null,
```

- [ ] **Step 4: Build and lint**

```powershell
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```powershell
git add src/background/background.js src/content/content.js
git commit -m "feat: save AI summaries to story chronicle when chronicle is enabled"
```

---

### Task 8: Final validation

- [ ] **Step 1: LoreWeave backend tests**

```powershell
cd V:\Code\ProjectCode\LoreWeave\backend
uv run pytest -q
```

Expected: all pass (was 71 before, should be same or more).

- [ ] **Step 2: RanobesGemini lint + build**

```powershell
cd V:\Code\ProjectCode\RanobesGemini
npm run lint && npm run build && npm run emoji:scan
```

Expected: 0 errors.

- [ ] **Step 3: Functional smoke test**

Load `dist/dist-chromium/` in `chrome://extensions`. Open a chapter page. In the popup LoreWeave tab:
1. Set a backend URL, domain ID, and check "Build story chronicle"
2. Set writing style to "Xianxia"
3. Click "Graphify Current Chapter"
4. Expected: "Sent N entities, M edges" message appears

Check `browser.storage.local` in devtools → `rg_chronicle_{novelId}` key should exist with `chapters` and `entityIndex` populated.
