# Spec 1: Universal Story Intelligence
> Date: 2026-05-28  
> Status: Approved

---

## Goal
Replace the narrow 4-relation extraction prompt with a universal schema that works for any fiction style (xianxia, LitRPG, romance, thriller, fan-fiction, isekai, etc.), accumulate per-novel story context locally as a "chronicle", use that context to improve AI summaries, and sync everything to LoreWeave using integer epoch_order from chapter numbers.

---

## 1. Universal Extraction Schema

### Entity types (6, last is catch-all)

| Type | Examples |
|---|---|
| `character` | People, cultivators, demons, AIs, gods, spirits |
| `place` | Cities, sects, realms, dungeons, planes, planets |
| `group` | Sects, clans, guilds, kingdoms, parties |
| `item` | Weapons, artifacts, talismans, skill books, cultivation manuals, cursed objects |
| `concept` | Cultivation stages, magic systems, titles, cultivation laws, system skills, divine laws |
| `other` | Anything that doesn't fit above but is clearly a named, recurring element |

**Rationale:** `other` acts as a catch-all so the AI never has to omit an important entity just because it doesn't fit the 5 main types. Future types can be added without schema breakage.

### Relation types (10, last is catch-all)

| Relation | Direction | Meaning |
|---|---|---|
| `KNOWS` | bidirectional intent | Characters are aware of each other |
| `ALLIED` | source ↔ target | Cooperative, allied, sworn companions |
| `OPPOSED` | source → target | Enemies, rivals, opposing forces |
| `LEADS` | source → target | source commands/leads target (person→group or person→person) |
| `MENTORS` | source → target | source teaches/trains/guides target |
| `OWNS` | source → target | source possesses target item/artifact |
| `MEMBER_OF` | source → target | source belongs to target group/faction |
| `LOCATED_AT` | source → target | source entity is at/from target place |
| `CREATED` | source → target | source made/summoned/forged target entity |
| `RELATED_TO` | flexible | Any meaningful relationship that doesn't fit above |

**LoreWeave backend change required:** Expand `_VALID_RELATION_TYPES` in `backend/src/loreweave/graph/graphify.py` to include all 10 types. Also remove the `ALIGNED_WITH`, `HATES`, `KNOWS_SECRET` types (or keep as aliases mapped to `ALLIED`, `OPPOSED`, `KNOWS`).

### Prompt structure

`buildGraphifyPrompt` is replaced with a new modular version:

```
buildGraphifyPrompt(chapterText, domainId, epochOrder, epochLabel, options?)
```

`options.priorEntityIds` — array of entity IDs already known from chronicle (so the AI reuses stable IDs instead of inventing new ones).

`options.writingStyle` — optional hint string: `"xianxia"`, `"litrpg"`, `"fantasy"`, `"romance"`, `"thriller"`, `"other"` — used to add a single short guidance paragraph about what entities are most common in that style. Does NOT change the schema.

`options.priorContext` — optional 1–2 sentence synopsis of events so far (injected before chapter text) so the AI can resolve ambiguous pronouns/references.

---

## 2. Story Chronicle Local Storage

### Storage key

`rg_chronicle_{novelId}` → stored in `browser.storage.local`

### Schema

```js
{
  novelId: string,
  domainId: string,         // LoreWeave domain, e.g. "lw_dom_..."
  lastUpdated: number,      // timestamp
  chapters: {
    [chapterNum]: {
      chapterNum: number,
      chapterLabel: string, // e.g. "Chapter 042"
      summary: string,      // long-form summary text
      shortSummary: string, // short-form summary text (may be empty)
      entities: [           // entity IDs extracted this chapter
        { id, name, type }
      ],
      edges: [              // relation edges extracted this chapter
        { source_id, target_id, relation_type, weight }
      ],
      graphified: boolean,  // whether this chapter was sent to LoreWeave
      timestamp: number,
    }
  },
  entityIndex: {
    [entityId]: { id, name, type, aliases, lastSeenChapter }
  }
}
```

`entityIndex` is a running map of every entity seen so far — used to feed `priorEntityIds` and `priorContext` into subsequent prompts so IDs stay stable.

### chronicle-storage.js

New file: `src/background/loreweave/chronicle-storage.js`

Exports:
- `loadChronicle(novelId)` → chronicle object or null
- `saveChapterRecord(novelId, chapterNum, record)` → merges into chronicle, updates entityIndex
- `getChapterRecord(novelId, chapterNum)` → single chapter record
- `getRecentSummaries(novelId, beforeChapter, count=5)` → array of { chapterNum, summary } sorted by chapter, most recent first
- `getEntityIndex(novelId)` → entityIndex map
- `clearChronicle(novelId)` → wipe all chronicle data for a novel
- `markGraphified(novelId, chapterNum)` → sets graphified: true

---

## 3. LoreWeave Versioning

`epoch_order` = chapter number as integer (already implemented in graphify-service.js).

**New:** The graphify service now calls `loadChronicle` first and passes `priorEntityIds` and a brief `priorContext` (last chapter's short summary, if any) into the prompt. This ensures entity IDs stay stable across chapters — the same character gets the same `lw_ent_*` ID every time.

After a successful ingest, `markGraphified(novelId, chapterNum)` is called.

---

## 4. Summary Context Improvement

### Where it hooks in

`summarizeContentWithGemini` in `background.js` receives the chapter text and config. Before building the summary prompt, it loads recent chapter summaries from the chronicle:

```js
const recentSummaries = await getRecentSummaries(novelId, currentChapterNum, 5);
```

These are injected as a "Story so far" block:

```
## Story so far (last 5 chapters)
Chapter 38: Li Wei reaches the Foundation stage and confronts Elder Mao...
Chapter 39: ...
...

## Now summarise this chapter:
[chapter text]
```

This makes summaries coherent across chapters instead of treating each in isolation.

### Where novelId comes from

`summarizeContentWithGemini` already has access to `currentConfig`. The content script passes `novelId` in the message payload. The background handler reads it from `message.novelId`.

---

## 5. After-Enhancement Chronicle Hook

After a chapter is enhanced (in `graphify-service.js` or the loreweave-integration module):
1. Extract entities + edges via graphify prompt
2. Save to chronicle (`saveChapterRecord`)
3. Post to LoreWeave if enabled (`postIngestDelta`)
4. Mark graphified

The existing `maybeSendToLoreWeave` in `loreweave-integration.js` is extended to also store in chronicle.

---

## 6. Settings

New opt-in fields added to `src/utils/constants.js` and `src/config/config.js`:

```js
LOREWEAVE_CHRONICLE_ENABLED: false   // master toggle for chronicle accumulation
LOREWEAVE_USE_PRIOR_CONTEXT: false   // inject chronicle context into summaries
LOREWEAVE_WRITING_STYLE: "other"     // hint for extraction prompt
```

Exposed in popup LoreWeave tab (existing panel): two checkboxes + a style dropdown.

---

## LoreWeave Backend Changes (V:\Code\ProjectCode\LoreWeave)

### `backend/src/loreweave/graph/graphify.py`

Replace `_VALID_RELATION_TYPES`:
```python
_VALID_RELATION_TYPES = frozenset({
    "KNOWS", "ALLIED", "OPPOSED", "LEADS", "MENTORS",
    "OWNS", "MEMBER_OF", "LOCATED_AT", "CREATED", "RELATED_TO",
    # Legacy aliases kept for backward compatibility
    "ALIGNED_WITH", "HATES", "KNOWS_SECRET",
})
```

### `backend/tests/test_graphify.py`

Update `test_valid_relation_types_are_known` to include new types.

### `backend/tests/test_routes.py`

Update `test_ingest_rejects_invalid_relation_type` (LOVES still invalid).  
Add `test_ingest_accepts_new_relation_types` (KNOWS, ALLIED, OPPOSED, etc. all return 200).

### `frontend/src/utils/api.ts`

Update `TemporalEdge.relation_type` union to include all 10 types.

---

## Files to create/modify (RanobesGemini)

| Action | File |
|---|---|
| Create | `src/background/loreweave/chronicle-storage.js` |
| Modify | `src/background/loreweave/graphify-prompt.js` — universal schema |
| Modify | `src/background/loreweave/graphify-service.js` — use chronicle, save results |
| Modify | `src/content/modules/loreweave-integration.js` — hook into summary + chronicle |
| Modify | `src/utils/constants.js` — 3 new constants |
| Modify | `src/config/config.js` — 3 new defaults |
| Modify | `src/popup/popup.html` — 2 checkboxes + style dropdown in LoreWeave tab |
| Modify | `src/popup/popup.js` — load/save new settings |
