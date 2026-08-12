/**
 * @fileoverview Archive of Our Own shelf.
 *
 * AO3 is the richest of the five shelves: kudos/hits/comments/bookmarks, an
 * archive rating, relationship and character tag sets, and the fandom browser
 * it shares with FanFiction.net. All of that is declared here; everything
 * generic lives in `../shelf-core.js`.
 *
 * Word count used to be read as `metadata.words || metadata.stats.words` when
 * filtering but `metadata.stats.words || metadata.words` when sorting, so a
 * work carrying both could sort by one number and be filtered by the other.
 * `wordsOf` below is the single answer.
 */

import { AO3CardRenderer } from "./novel-card.js";
import { AO3Handler } from "../../../utils/website-handlers/ao3-handler.js";
import { READING_STATUS } from "../../../utils/novel-library.js";
import { initShelfPage } from "../shelf-core.js";
import { createFandomNav } from "../shelf-fandom-nav.js";
import {
	FILTER_KINDS,
	formatNumber,
	maxBy,
	normalizeReadingStatus,
	sumField,
} from "../shelf-filter-engine.js";

/** AO3 nests its counts under `metadata.stats`, but older records did not. */
const statOf = (novel, key) =>
	novel.metadata?.stats?.[key] || novel.metadata?.[key] || 0;

/** One spelling of word count for the whole page. */
const wordsOf = (novel) => statOf(novel, "words");

const chaptersOf = (novel) =>
	novel.totalChapters || novel.metadata?.chapters || 0;

const listOf = (novel, key) =>
	Array.isArray(novel.metadata?.[key]) ? novel.metadata[key] : [];

const workStatusOf = (novel) =>
	(novel.metadata?.status || novel.status || "").toLowerCase();

const timeOf = (value) => {
	if (!value) return 0;
	if (typeof value === "number") return value;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
};

/** The archive's ratings, ordered so a shelf average means something. */
const RATING_SCORES = {
	"general audiences": 1,
	"teen and up audiences": 2,
	mature: 3,
	explicit: 4,
};

export const descriptor = {
	shelfId: "ao3",
	filterStorageKey: "rg_ao3_filters",
	cardRenderer: AO3CardRenderer,
	handler: AO3Handler,
	randomPick: true,

	filterSection: createFandomNav({
		title: "Browse by Fandom",
		maxSelection: 2,
		values: (novel) => listOf(novel, "fandoms"),
	}),

	filters: [
		{ kind: FILTER_KINDS.SEARCH, key: "search", label: "Search" },
		{
			kind: FILTER_KINDS.SELECT,
			key: "rating",
			label: "Rating",
			allLabel: "All Ratings",
			options: [
				{ value: "General Audiences", label: "General Audiences" },
				{ value: "Teen And Up Audiences", label: "Teen And Up" },
				{ value: "Mature", label: "Mature" },
				{ value: "Explicit", label: "Explicit" },
				{ value: "Not Rated", label: "Not Rated" },
			],
			value: (novel) => novel.metadata?.rating || "",
		},
		{
			kind: FILTER_KINDS.SELECT,
			key: "workStatus",
			label: "Work Status",
			allLabel: "All",
			options: [
				{ value: "completed", label: "Completed" },
				{ value: "ongoing", label: "Work in Progress" },
			],
			value: workStatusOf,
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
			key: "category",
			label: "Category",
			allLabel: "All Categories",
			options: [
				{ value: "F/F", label: "F/F" },
				{ value: "F/M", label: "F/M" },
				{ value: "M/M", label: "M/M" },
				{ value: "Gen", label: "Gen" },
				{ value: "Multi", label: "Multi" },
				{ value: "Other", label: "Other" },
			],
			// A work carries several categories, so this is a contains test.
			match: (novel, wanted) =>
				listOf(novel, "categories").some(
					(c) => String(c).toLowerCase() === wanted.toLowerCase(),
				),
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
			key: "fandoms",
			label: "Fandoms",
			toggleLabel: "Choose Fandoms",
			// The fandom browser below owns the any/all control for this filter.
			maxSelection: 2,
			searchable: true,
			values: (novel) => listOf(novel, "fandoms"),
		},
		{
			kind: FILTER_KINDS.MULTI,
			key: "relationships",
			label: "Relationships",
			toggleLabel: "Choose Relationships",
			mode: "all",
			searchable: true,
			values: (novel) => listOf(novel, "relationships"),
		},
		{
			kind: FILTER_KINDS.MULTI,
			key: "characters",
			label: "Characters",
			toggleLabel: "Choose Characters",
			hint: "Up to four at a time",
			maxSelection: 4,
			mode: "all",
			searchable: true,
			values: (novel) => listOf(novel, "characters"),
		},
		{
			kind: FILTER_KINDS.MULTI,
			key: "tags",
			label: "Additional Tags",
			toggleLabel: "Choose Tags",
			modeSelectable: true,
			searchable: true,
			values: (novel) => listOf(novel, "additionalTags"),
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
			value: "kudos",
			label: "Kudos",
			compare: (a, b) => statOf(b, "kudos") - statOf(a, "kudos"),
		},
		{
			value: "hits",
			label: "Hits",
			compare: (a, b) => statOf(b, "hits") - statOf(a, "hits"),
		},
		{
			value: "comments",
			label: "Comments",
			compare: (a, b) => statOf(b, "comments") - statOf(a, "comments"),
		},
		{
			value: "bookmarks",
			label: "Bookmarks",
			compare: (a, b) => statOf(b, "bookmarks") - statOf(a, "bookmarks"),
		},
		{
			value: "published",
			label: "Published Date",
			compare: (a, b) =>
				timeOf(statOf(b, "publishedDate")) -
				timeOf(statOf(a, "publishedDate")),
		},
		{
			value: "updated",
			label: "Updated Date",
			// AO3 records the last update as `completedDate` on finished works.
			compare: (a, b) =>
				timeOf(statOf(b, "updatedDate") || statOf(b, "completedDate")) -
				timeOf(statOf(a, "updatedDate") || statOf(a, "completedDate")),
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
			label: "Works",
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
			label: "Completed Works",
			compute: (novels) =>
				novels
					.filter((n) => workStatusOf(n) === "completed")
					.length.toLocaleString(),
		},
		{
			id: "stats-kudos",
			label: "Total Kudos",
			compute: (novels) =>
				formatNumber(
					novels.reduce((sum, n) => sum + statOf(n, "kudos"), 0),
				),
		},
		{
			id: "stats-hits",
			label: "Total Hits",
			compute: (novels) =>
				formatNumber(
					novels.reduce((sum, n) => sum + statOf(n, "hits"), 0),
				),
		},
		{
			id: "stats-avgrating",
			label: "Avg Rating",
			compute: (novels) => {
				const scores = novels
					.map(
						(n) =>
							RATING_SCORES[
								String(n.metadata?.rating || "")
									.trim()
									.toLowerCase()
							],
					)
					.filter(Boolean);
				if (!scores.length) return "-";
				const total = scores.reduce((sum, s) => sum + s, 0);
				return (total / scores.length).toFixed(1);
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
			id: "most-kudos",
			label: "Most Kudos",
			icon: "❤️",
			pick: (novels) => countInsight(novels, "kudos"),
		},
		{
			id: "most-hits",
			label: "Most Hits",
			icon: "\u{1F441}️",
			pick: (novels) => countInsight(novels, "hits"),
		},
		{
			id: "most-comments",
			label: "Most Comments",
			icon: "\u{1F4AC}",
			pick: (novels) => countInsight(novels, "comments"),
		},
		{
			id: "longest-work",
			label: "Longest Work",
			icon: "\u{1F4CF}",
			pick: (novels) => {
				const novel = maxBy(novels, wordsOf);
				return {
					novel,
					text: novel
						? `${novel.title} (${formatNumber(wordsOf(novel))})`
						: "-",
				};
			},
		},
		{
			id: "newest-addition",
			label: "Newest Addition",
			icon: "\u{1F195}",
			pick: (novels) => {
				const novel = maxBy(
					novels,
					(n) => n.addedAt || n.dateAdded || 0,
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
				return {
					novel,
					text: novel ? `${novel.title} (${chaptersOf(novel)})` : "-",
				};
			},
		},
	],
};

/**
 * Shared shape for the three "most X" insights, which all show the count.
 *
 * @param {object[]} novels
 * @param {string} key
 * @returns {{novel: object|null, text: string}}
 */
function countInsight(novels, key) {
	const novel = maxBy(novels, (n) => statOf(n, key));
	return {
		novel,
		text: novel
			? `${novel.title} (${formatNumber(statOf(novel, key))})`
			: "-",
	};
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
