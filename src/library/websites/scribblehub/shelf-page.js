/**
 * @fileoverview ScribbleHub shelf.
 *
 * ScribbleHub carries a numeric star rating, view/favourite/follow/review
 * counts and fandom tags, so it declares nine stat cards and the popularity
 * sorts. Everything generic lives in `../shelf-core.js`.
 *
 * Two controls from the old hand-written page are gone on purpose:
 *   - the K/K+/T/M content-rating select, which compared those letters against
 *     ScribbleHub's numeric star rating and so could never match anything;
 *   - the Characters pill list, which the handler never populates.
 */

import ScribbleHubNovelCard from "./novel-card.js";
import { ScribbleHubHandler } from "../../../utils/website-handlers/scribblehub-handler.js";
import { READING_STATUS } from "../../../utils/novel-library.js";
import { initShelfPage } from "../shelf-core.js";
import {
	FILTER_KINDS,
	formatNumber,
	maxBy,
	normalizeReadingStatus,
	sumField,
} from "../shelf-filter-engine.js";

/** One spelling of word count for the whole page. */
const wordsOf = (novel) =>
	novel.metadata?.words || novel.stats?.words || novel.words || 0;

const chaptersOf = (novel) =>
	novel.metadata?.totalChapters || novel.totalChapters || 0;

const ratingOf = (novel) => {
	const raw = novel.metadata?.rating ?? novel.rating;
	const value = parseFloat(raw);
	return Number.isNaN(value) ? 0 : value;
};

const workStatusOf = (novel) =>
	(novel.metadata?.status || novel.status || "").toLowerCase();

/** ScribbleHub lists fandoms and tags in both the old and new shapes. */
const listOf = (novel, key) => [
	...(Array.isArray(novel.metadata?.[key]) ? novel.metadata[key] : []),
	...(Array.isArray(novel[key]) ? novel[key] : []),
];

/** A stat that lives on either `stats` or `metadata`. */
const statOf = (novel, key) => novel.stats?.[key] || novel.metadata?.[key] || 0;

const timeOf = (value) => {
	if (!value) return 0;
	if (typeof value === "number") return value;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
};

export const descriptor = {
	shelfId: "scribblehub",
	filterStorageKey: "rg_filters_scribblehub",
	cardRenderer: ScribbleHubNovelCard,
	handler: ScribbleHubHandler,
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
				{ value: "Hiatus", label: "Hiatus" },
				{ value: "Dropped", label: "Dropped" },
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
			kind: FILTER_KINDS.SELECT,
			key: "storyType",
			label: "Story Type",
			allLabel: "All Types",
			options: [
				{ value: "single", label: "Single Fandom" },
				{ value: "crossover", label: "Crossover" },
			],
			match: (novel, wanted) => {
				const crossover =
					novel.metadata?.isCrossover === true ||
					listOf(novel, "fandoms").length > 1;
				return wanted === "crossover" ? crossover : !crossover;
			},
		},
		{
			kind: FILTER_KINDS.SELECT,
			key: "language",
			label: "Language",
			allLabel: "All Languages",
			value: (novel) => novel.metadata?.language || novel.language || "",
		},
		{
			kind: FILTER_KINDS.MULTI,
			key: "fandoms",
			label: "Fandoms",
			toggleLabel: "Choose Fandoms",
			searchable: true,
			values: (novel) => listOf(novel, "fandoms"),
		},
		{
			kind: FILTER_KINDS.MULTI,
			key: "genres",
			label: "Genres",
			toggleLabel: "Choose Genres",
			// ScribbleHub has always required every selected genre to match.
			mode: "all",
			values: (novel) => listOf(novel, "genres"),
		},
		{
			kind: FILTER_KINDS.MULTI,
			key: "tags",
			label: "Tags",
			toggleLabel: "Choose Tags",
			modeSelectable: true,
			searchable: true,
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
			compare: (a, b) => ratingOf(b) - ratingOf(a),
		},
		{
			value: "favorites",
			label: "Favorites",
			compare: (a, b) => statOf(b, "favorites") - statOf(a, "favorites"),
		},
		{
			value: "follows",
			label: "Follows",
			compare: (a, b) => statOf(b, "follows") - statOf(a, "follows"),
		},
		{
			value: "reviews",
			label: "Reviews",
			compare: (a, b) => statOf(b, "reviews") - statOf(a, "reviews"),
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
				novels
					.filter((n) => workStatusOf(n) === "completed")
					.length.toLocaleString(),
		},
		{
			id: "stats-avgrating",
			label: "Avg Rating",
			compute: (novels) => {
				const rated = novels.filter((n) => ratingOf(n) > 0);
				if (!rated.length) return "-";
				const total = rated.reduce((sum, n) => sum + ratingOf(n), 0);
				return (total / rated.length).toFixed(1);
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
		{
			id: "stats-languages",
			label: "Languages",
			compute: (novels) => String(countLanguages(novels) || "-"),
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
	],

	insights: [
		{
			id: "highest-rated",
			label: "Highest Rated",
			icon: "⭐",
			pick: (novels) => {
				const novel = maxBy(novels, ratingOf);
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
			pick: (novels) => ({
				novel: null,
				text: String(countLanguages(novels) || "-"),
			}),
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
						: timeOf(n.metadata?.updatedDate || n.updatedDate),
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

/** @param {object[]} novels */
function countLanguages(novels) {
	return new Set(
		novels
			.map((n) => n.metadata?.language || n.language)
			.filter(Boolean)
			.map((l) => String(l).trim().toLowerCase()),
	).size;
}

/** @param {object} novel */
function workStatusOrder(novel) {
	const order = { completed: 0, ongoing: 1 };
	return order[workStatusOf(novel)] ?? 99;
}

// Guarded so the descriptor above can be imported and tested outside a browser.
if (typeof document !== "undefined") {
	initShelfPage(descriptor);
}
