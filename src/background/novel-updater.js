/**
 * Novel Periodic Updater
 *
 * Runs periodic background checks for novels marked as "Up to Date" to detect
 * when the author publishes new chapters. When a new chapter is found the novel
 * status is automatically changed back to READING so it appears prominently
 * in the library.
 *
 * Controlled by constants:
 *   NOVEL_PERIODIC_UPDATE_ENABLED         (default: false)
 *   NOVEL_PERIODIC_UPDATE_INTERVAL_MINUTES
 *   NOVEL_PERIODIC_UPDATE_STALENESS_MINUTES
 *   NOVEL_CHAPTER_CHECK_ALARM_NAME
 */

import { debugLog, debugError } from "../utils/logger.js";
import {
	NOVEL_PERIODIC_UPDATE_ENABLED,
	NOVEL_PERIODIC_UPDATE_INTERVAL_MINUTES,
	NOVEL_PERIODIC_UPDATE_STALENESS_MINUTES,
	NOVEL_CHAPTER_CHECK_ALARM_NAME,
} from "../utils/constants.js";
import { NovelLibrary, READING_STATUS } from "../utils/novel-library.js";

const novelLibrary = new NovelLibrary();

// ---------------------------------------------------------------------------
// Alarm Management
// ---------------------------------------------------------------------------

/**
 * Set up (or re-create) the periodic novel chapter-check alarm.
 * Safe to call on install, update, and startup.
 * Does nothing if NOVEL_PERIODIC_UPDATE_ENABLED is false.
 *
 * @param {Object} alarmApi - browser.alarms or chrome.alarms
 */
export async function setupNovelUpdateAlarm(alarmApi) {
	if (!NOVEL_PERIODIC_UPDATE_ENABLED) {
		debugLog("[NovelUpdater] Periodic updates disabled via constants.");
		// Clear any leftover alarm from a previous enabled state
		try {
			await alarmApi?.clear?.(NOVEL_CHAPTER_CHECK_ALARM_NAME);
		} catch (clearErr) {
			// Ignore – alarm may not exist yet
			debugLog(`[NovelUpdater] Alarm clear skipped: ${clearErr.message}`);
		}
		return;
	}

	if (!alarmApi) {
		debugError("[NovelUpdater] Alarms API not available.");
		return;
	}

	try {
		// Clear existing alarm before re-creating (avoids duplicates)
		await alarmApi.clear(NOVEL_CHAPTER_CHECK_ALARM_NAME);

		const intervalMinutes = Math.max(
			1,
			NOVEL_PERIODIC_UPDATE_INTERVAL_MINUTES,
		);

		await alarmApi.create(NOVEL_CHAPTER_CHECK_ALARM_NAME, {
			delayInMinutes: intervalMinutes,
			periodInMinutes: intervalMinutes,
		});

		debugLog(
			`[NovelUpdater] Chapter-check alarm set: every ${intervalMinutes} min.`,
		);
	} catch (error) {
		debugError("[NovelUpdater] Failed to create alarm:", error);
	}
}

// ---------------------------------------------------------------------------
// Alarm Handler
// ---------------------------------------------------------------------------

/**
 * Handle the NOVEL_CHAPTER_CHECK_ALARM_NAME alarm firing.
 * Call this from the background.js onAlarm listener.
 *
 * @returns {Promise<void>}
 */
export async function handleNovelUpdateAlarm() {
	if (!NOVEL_PERIODIC_UPDATE_ENABLED) return;

	debugLog("[NovelUpdater] Running periodic chapter-count check…");

	try {
		await checkUpToDateNovels();
	} catch (err) {
		debugError("[NovelUpdater] Error during chapter check:", err);
	}
}

// ---------------------------------------------------------------------------
// Core Check Logic
// ---------------------------------------------------------------------------

/**
 * Iterate all UP_TO_DATE novels and fetch fresh chapter counts for any that
 * haven't been checked within the staleness window.
 */
async function checkUpToDateNovels() {
	const library = await novelLibrary.getLibrary();
	const novels = Object.values(library.novels || {});
	const upToDate = novels.filter(
		(n) => n?.readingStatus === READING_STATUS.UP_TO_DATE && n?.sourceUrl,
	);

	if (upToDate.length === 0) {
		debugLog("[NovelUpdater] No UP_TO_DATE novels to check.");
		return;
	}

	debugLog(`[NovelUpdater] Checking ${upToDate.length} UP_TO_DATE novel(s)…`);

	const stalenessMs = NOVEL_PERIODIC_UPDATE_STALENESS_MINUTES * 60 * 1000;
	const now = Date.now();
	let updatedCount = 0;

	for (const novel of upToDate) {
		// Respect staleness window – skip if checked recently
		const lastChecked = novel.metadata?.lastChapterCheckAt || 0;
		if (now - lastChecked < stalenessMs) {
			debugLog(
				`[NovelUpdater] Skipping "${novel.title}" (checked ${Math.round((now - lastChecked) / 60000)} min ago)`,
			);
			continue;
		}

		try {
			const result = await fetchFreshChapterCount(novel);
			if (result !== null) {
				const updated = await processChapterCountResult(novel, result);
				if (updated) updatedCount++;
			}

			// Stagger requests to avoid hammering servers
			await sleep(2000 + Math.random() * 3000);
		} catch (err) {
			debugError(`[NovelUpdater] Failed to check "${novel.title}":`, err);
		}
	}

	if (updatedCount > 0) {
		debugLog(
			`[NovelUpdater] Updated ${updatedCount} novel(s) with new chapter counts.`,
		);
	}
}

/**
 * Fetch fresh metadata for a single novel using the appropriate handler.
 *
 * @param {Object} novel
 * @returns {Promise<{totalChapters: number}|null>}
 */
async function fetchFreshChapterCount(novel) {
	try {
		// Dynamically import so the heavy handler code isn't loaded until needed
		const MetadataFetcher = (await import("../utils/metadata-fetcher.js"))
			.default;
		const { handlerRegistry } =
			await import("../utils/website-handlers/handler-registry.js");

		const handler = handlerRegistry.getHandlerByDomain(
			new URL(novel.sourceUrl).hostname,
		);
		if (!handler) {
			debugLog(
				`[NovelUpdater] No handler found for "${novel.title}" (${novel.sourceUrl})`,
			);
			return null;
		}

		const handlerType =
			handler.constructor?.HANDLER_TYPE ||
			handler.constructor?.SHELF_METADATA?.handlerType ||
			"dedicated_page";

		debugLog(
			`[NovelUpdater] Fetching metadata for "${novel.title}" via ${handlerType}…`,
		);

		const metadata = await MetadataFetcher.fetchMetadata(
			handlerType,
			novel.sourceUrl,
			handler,
		);

		if (metadata && typeof metadata.totalChapters === "number") {
			return { totalChapters: metadata.totalChapters, raw: metadata };
		}

		return null;
	} catch (err) {
		debugError(
			`[NovelUpdater] fetchFreshChapterCount failed for "${novel.title}":`,
			err,
		);
		return null;
	}
}

/**
 * Compare a freshly fetched chapter count with the stored value.
 * Updates the library if a new chapter is detected.
 *
 * @param {Object} novel
 * @param {{totalChapters: number, raw: Object}} result
 * @returns {Promise<boolean>} true if the novel was updated
 */
async function processChapterCountResult(novel, result) {
	const now = Date.now();
	const storedChapters = novel.totalChapters || 0;
	const freshChapters = result.totalChapters || 0;

	// Always stamp the last-checked time
	const metadataUpdate = {
		...(novel.metadata || {}),
		lastChapterCheckAt: now,
	};

	if (freshChapters > storedChapters) {
		debugLog(
			`[NovelUpdater] New chapters for "${novel.title}": ${storedChapters} → ${freshChapters}`,
		);

		// Merge any other fresh metadata fields (non-destructive)
		if (result.raw) {
			// Merge fresh metadata fields (excluding totalChapters which is handled above)
			const restMeta = { ...result.raw };
			delete restMeta.totalChapters;
			Object.assign(metadataUpdate, restMeta);
		}

		await novelLibrary.addOrUpdateNovel(
			{
				...novel,
				totalChapters: freshChapters,
				readingStatus: READING_STATUS.READING,
				metadata: metadataUpdate,
				lastAccessedAt: now,
			},
			false, // not a manual edit
		);

		return true;
	}

	// No new chapters – just update the check timestamp
	await novelLibrary.addOrUpdateNovel(
		{
			...novel,
			metadata: metadataUpdate,
		},
		false,
	);

	return false;
}

// ---------------------------------------------------------------------------
// Manual "Selective Update" for a single novel
// ---------------------------------------------------------------------------

/**
 * Trigger an immediate metadata refresh for one novel by its ID.
 * Used by the "Update Metadata" button in the content script UI.
 *
 * @param {string} novelId
 * @returns {Promise<{success: boolean, novel?: Object, error?: string}>}
 */
export async function updateSingleNovelMetadata(novelId) {
	try {
		const library = await novelLibrary.getLibrary();
		const novel = library.novels?.[novelId];

		if (!novel) {
			return { success: false, error: `Novel not found: ${novelId}` };
		}

		const result = await fetchFreshChapterCount(novel);
		if (!result) {
			return {
				success: false,
				error: "Could not fetch metadata for this novel",
			};
		}

		await processChapterCountResult(novel, result);

		// Return the refreshed novel
		const refreshedLibrary = await novelLibrary.getLibrary();
		return {
			success: true,
			novel: refreshedLibrary.novels?.[novelId] || novel,
		};
	} catch (err) {
		debugError("[NovelUpdater] updateSingleNovelMetadata error:", err);
		return { success: false, error: err.message || String(err) };
	}
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
