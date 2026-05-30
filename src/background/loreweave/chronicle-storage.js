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
 *       entities: [{id, name, type, aliases}],
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
 * @param {{ chapterLabel, summary, shortSummary, entities, edges, graphified, domainId }} record
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
