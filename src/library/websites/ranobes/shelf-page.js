/**
 * @fileoverview Ranobes shelf.
 *
 * Ranobes scrapes rating, views, language and a separate translation status on
 * top of the usual fields, so it declares nine stat cards and six insights —
 * more than NovelBin, less than AO3. Everything generic lives in
 * `../shelf-core.js`.
 */

import RanobesNovelCard from "./novel-card.js";
import { RanobesHandler } from "../../../utils/website-handlers/ranobes-handler.js";
import { READING_STATUS } from "../../../utils/novel-library.js";
import { initShelfPage } from "../shelf-core.js";
import {
	FILTER_KINDS,
	formatNumber,
	maxBy,
	normalizeReadingStatus,
	sumField,
} from "../shelf-filter-engine.js";

/**
 * One spelling of word count for the whole page. The old file read
 * `stats.words` in the range filter but `metadata.words` in the stat card, so
 * the two could disagree on the same novel.
 */
const wordsOf = (novel) =>
	novel.metadata?.words || novel.stats?.words || novel.words || 0;

const chaptersOf = (novel) =>
	novel.metadata?.totalChapters || novel.totalChapters || 0;

/** Publication status, as opposed to the user's own reading status. */
const workStatusOf = (novel) =>
	(novel.metadata?.status || novel.status || "").toLowerCase();

const countWorkStatus = (novels, wanted) =>
	novels.filter((n) => workStatusOf(n) === wanted).length;

/** Ranobes lists genres and tags separately in both shapes it has shipped. */
const listOf = (novel, key) => [
	...(Array.isArray(novel.metadata?.[key]) ? novel.metadata[key] : []),
	...(Array.isArray(novel[key]) ? novel[key] : []),
];

/** A date field that may be a timestamp or an ISO-ish string. */
const timeOf = (value) => {
	if (!value) return 0;
	if (typeof value === "number") return value;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
};

export const descriptor = {
	shelfId: "ranobes",
	filterStorageKey: "rg_filters_ranobes",
	cardRenderer: RanobesNovelCard,
	handler: RanobesHandler,
	randomPick: true,

	filters: [
		{ kind: FILTER_KINDS.SEARCH, key: "search", label: "Search" },
		{
			kind: FILTER_KINDS.SELECT,
			key: "workStatus",
			label: "Work Status",
			allLabel: "All",
			options: [
				{ value: "Completed", label: "Completed" },
				{ value: "Ongoing", label: "Ongoing" },
				{ value: "Hiatus", label: "On Hiatus" },
			],
			value: (novel) => novel.metadata?.status || novel.status || "",
		},
		{
			kind: FILTER_KINDS.SELECT,
			key: "translationStatus",
			label: "Translation Status",
			allLabel: "All",
			options: [
				{ value: "Completed", label: "Completed" },
				{ value: "Ongoing", label: "Ongoing" },
				{ value: "Dropped", label: "Dropped" },
			],
			value: (novel) => novel.metadata?.translationStatus || "",
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
			kind: FILTER_KINDS.SELECT,
			key: "language",
			label: "Language",
			allLabel: "All Languages",
			value: (novel) => novel.metadata?.language || "",
		},
		{
			kind: FILTER_KINDS.MULTI,
			key: "genres",
			label: "Genres",
			toggleLabel: "Choose Genres",
			// Ranobes has always required every selected genre to match.
			mode: "all",
			values: (novel) => listOf(novel, "genres"),
		},
		{
			kind: FILTER_KINDS.MULTI,
			key: "tags",
			label: "Tags",
			toggleLabel: "Choose Tags",
			modeSelectable: true,
			values: (novel) => listOf(novel, "tags"),
		},
		{
			kind: FILTER_KINDS.RANGE,
			key: "wordCount",
			label: "Word Count Range",
			hint: "Leave blank for no limit",
			value: wordsOf,
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
			value: "chapters",
			label: "Enhanced Chapters",
			compare: (a, b) =>
				(b.enhancedChaptersCount || 0) - (a.enhancedChaptersCount || 0),
		},
		{
			value: "words",
			label: "Word Count",
			compare: (a, b) => wordsOf(b) - wordsOf(a),
		},
		{
			value: "rating",
			label: "Rating",
			compare: (a, b) =>
				(b.metadata?.rating || 0) - (a.metadata?.rating || 0),
		},
		{
			value: "published",
			label: "Published Date",
			compare: (a, b) =>
				timeOf(b.metadata?.publishedDate || b.publishedDate) -
				timeOf(a.metadata?.publishedDate || a.publishedDate),
		},
		{
			value: "updated",
			label: "Updated Date",
			compare: (a, b) =>
				timeOf(b.metadata?.updatedDate || b.updatedDate) -
				timeOf(a.metadata?.updatedDate || a.updatedDate),
		},
		{
			value: "status",
			label: "Work Status",
			// Completed first, then ongoing, then everything unknown.
			compare: (a, b) => workStatusOrder(a) - workStatusOrder(b),
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
			id: "stats-words",
			label: "Total Words",
			compute: (novels) =>
				formatNumber(novels.reduce((sum, n) => sum + wordsOf(n), 0)),
		},
		{
			id: "stats-avg-words",
			label: "Avg Words",
			compute: (novels) => {
				if (!novels.length) return "-";
				const total = novels.reduce((sum, n) => sum + wordsOf(n), 0);
				return formatNumber(Math.round(total / novels.length));
			},
		},
		{
			id: "stats-completed",
			label: "Completed",
			compute: (novels) =>
				countWorkStatus(novels, "completed").toLocaleString(),
		},
		{
			id: "stats-ongoing",
			label: "Ongoing",
			compute: (novels) =>
				countWorkStatus(novels, "ongoing").toLocaleString(),
		},
		{
			id: "stats-translating",
			label: "Translating",
			compute: (novels) =>
				novels
					.filter(
						(n) =>
							(
								n.metadata?.translationStatus || ""
							).toLowerCase() === "translating",
					)
					.length.toLocaleString(),
		},
		{
			id: "stats-avglength",
			label: "Avg Chapters",
			compute: (novels) => {
				if (!novels.length) return "-";
				const total = novels.reduce((sum, n) => sum + chaptersOf(n), 0);
				return (total / novels.length).toFixed(1);
			},
		},
		{
			id: "stats-reading",
			label: "Reading",
			compute: (novels) => {
				if (!novels.length) return "0%";
				const reading = novels.filter(
					(n) =>
						normalizeReadingStatus(n.readingStatus) ===
						READING_STATUS.READING,
				).length;
				return `${Math.round((reading / novels.length) * 100)}%`;
			},
		},
	],

	insights: [
		{
			id: "highest-rated",
			label: "Highest Rated",
			icon: "⭐",
			pick: (novels) => {
				const novel = maxBy(novels, (n) => n.metadata?.rating || 0);
				return { novel, text: novel?.title || "-" };
			},
		},
		{
			id: "most-popular",
			label: "Most Popular",
			icon: "\u{1F4C8}",
			pick: (novels) => {
				const novel = maxBy(
					novels,
					(n) => n.metadata?.views || n.views || 0,
				);
				return { novel, text: novel?.title || "-" };
			},
		},
		{
			id: "language-count",
			label: "Languages",
			icon: "\u{1F310}",
			pick: (novels) => {
				const languages = new Set(
					novels
						.map((n) => n.metadata?.language)
						.filter(Boolean)
						.map((l) => l.trim().toLowerCase()),
				);
				return {
					novel: null,
					text: languages.size ? String(languages.size) : "-",
				};
			},
		},
		{
			// Was chapter count, which made this a duplicate of Most Chapters.
			id: "longest-novel",
			label: "Longest Novel",
			icon: "\u{1F4CF}",
			pick: (novels) => {
				const novel = maxBy(novels, wordsOf);
				return { novel, text: novel?.title || "-" };
			},
		},
		{
			id: "newest-addition",
			label: "Newest Addition",
			icon: "\u{1F195}",
			pick: (novels) => {
				const novel = maxBy(novels, (n) =>
					n.addedAt
						? n.addedAt
						: timeOf(n.metadata?.publishedDate || n.publishedDate),
				);
				return { novel, text: novel?.title || "-" };
			},
		},
		{
			id: "most-chapters",
			label: "Most Chapters",
			icon: "\u{1F4DA}",
			pick: (novels) => {
				const novel = maxBy(novels, chaptersOf);
				return { novel, text: novel?.title || "-" };
			},
		},
	],
};

/** @param {object} novel */
function workStatusOrder(novel) {
	const order = { completed: 0, ongoing: 1 };
	return order[workStatusOf(novel)] ?? 99;
}

// Guarded so the descriptor above can be imported and tested outside a browser.
if (typeof document !== "undefined") {
	initShelfPage(descriptor);
}
