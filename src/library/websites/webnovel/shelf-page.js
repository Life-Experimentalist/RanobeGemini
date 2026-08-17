/**
 * @fileoverview WebNovel shelf.
 *
 * WebNovel scrapes the least of any supported site — status, genres, tags and a
 * chapter count — so this descriptor is deliberately the smallest one. The
 * shared core in `../shelf-core.js` supplies everything else.
 */

import { WebNovelNovelCard } from "./novel-card.js";
import { WebNovelHandler } from "../../../utils/website-handlers/webnovel-handler.js";
import { READING_STATUS } from "../../../utils/novel-library.js";
import { initShelfPage } from "../shelf-core.js";
import {
	FILTER_KINDS,
	maxBy,
	normalizeReadingStatus,
	sumField,
} from "../shelf-filter-engine.js";

/** WebNovel writes `chapterCount` where the other sites write `totalChapters`. */
const chaptersOf = (novel) =>
	novel.totalChapters ||
	novel.metadata?.totalChapters ||
	novel.metadata?.chapterCount ||
	0;

const workStatusOf = (novel) =>
	(novel.metadata?.status || novel.status || "").toLowerCase();

export const descriptor = {
	shelfId: "webnovel",
	filterStorageKey: "rg_filters_webnovel",
	cardRenderer: WebNovelNovelCard,
	handler: WebNovelHandler,

	filters: [
		{ kind: FILTER_KINDS.SEARCH, key: "search", label: "Search" },
		{
			kind: FILTER_KINDS.SELECT,
			key: "workStatus",
			label: "Work Status",
			allLabel: "All",
			options: [
				{ value: "ongoing", label: "Ongoing" },
				{ value: "completed", label: "Completed" },
				{ value: "hiatus", label: "Hiatus" },
			],
			value: (novel) => novel.metadata?.status || novel.status || "",
		},
		{
			kind: FILTER_KINDS.SELECT,
			key: "readingStatus",
			label: "Reading Status",
			allLabel: "All",
			options: [
				{ value: READING_STATUS.PLAN_TO_READ, label: "Plan to Read" },
				{ value: READING_STATUS.READING, label: "Currently Reading" },
				{ value: READING_STATUS.COMPLETED, label: "Completed" },
				{ value: READING_STATUS.ON_HOLD, label: "On Hold" },
				{ value: READING_STATUS.DROPPED, label: "Dropped" },
				{ value: READING_STATUS.RE_READING, label: "Re-reading" },
			],
			match: (novel, wanted) =>
				normalizeReadingStatus(novel.readingStatus) === wanted,
		},
		{
			kind: FILTER_KINDS.MULTI,
			key: "genres",
			label: "Genres",
			toggleLabel: "Choose Genres",
			modeSelectable: true,
		},
	],

	sorts: [
		{
			value: "recent",
			label: "Recently Read",
			compare: (a, b) =>
				(b.lastAccessedAt || 0) - (a.lastAccessedAt || 0),
		},
		{
			value: "added",
			label: "Date Added",
			compare: (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
		},
		{
			value: "title",
			label: "Title",
			compare: (a, b) => (a.title || "").localeCompare(b.title || ""),
		},
		{
			value: "enhanced",
			label: "Enhanced Chapters",
			compare: (a, b) =>
				(b.enhancedChaptersCount || 0) - (a.enhancedChaptersCount || 0),
		},
		{
			value: "chapters",
			label: "Total Chapters",
			compare: (a, b) => chaptersOf(b) - chaptersOf(a),
		},
	],

	stats: [
		{
			id: "stats-novels",
			label: "Novels",
			compute: (novels) => novels.length.toLocaleString(),
		},
		{
			id: "stats-enhanced",
			label: "Enhanced Chapters",
			compute: (novels) =>
				sumField(novels, "enhancedChaptersCount").toLocaleString(),
		},
		{
			id: "stats-chapters",
			label: "Total Chapters",
			compute: (novels) =>
				novels
					.reduce((sum, n) => sum + chaptersOf(n), 0)
					.toLocaleString(),
		},
		{
			id: "stats-completed",
			label: "Completed",
			compute: (novels) =>
				novels
					.filter((n) => workStatusOf(n) === "completed")
					.length.toLocaleString(),
		},
	],

	insights: [
		{
			id: "most-chapters",
			label: "Most Chapters",
			icon: "\u{1F4DA}",
			pick: (novels) => {
				const novel = maxBy(novels, chaptersOf);
				return { novel, text: novel?.title || "-" };
			},
		},
		{
			id: "most-enhanced",
			label: "Most Enhanced",
			icon: "✨",
			pick: (novels) => {
				const novel = maxBy(
					novels,
					(n) => n.enhancedChaptersCount || 0,
				);
				return { novel, text: novel?.title || "-" };
			},
		},
		{
			id: "newest-addition",
			label: "Newest Addition",
			icon: "\u{1F5DE}",
			pick: (novels) => {
				const novel = maxBy(novels, (n) => n.addedAt || 0);
				return { novel, text: novel?.title || "-" };
			},
		},
	],
};

// Guarded so the descriptor above can be imported and tested outside a browser.
if (typeof document !== "undefined") {
	initShelfPage(descriptor);
}
