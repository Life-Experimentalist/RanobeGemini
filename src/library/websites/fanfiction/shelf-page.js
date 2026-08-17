/**
 * @fileoverview FanFiction.net shelf.
 *
 * FanFiction.net carries favourite/follow/review counts, a K/K+/T/M content
 * rating and a fandom list, so it declares those sorts, that rating select and
 * the shared fandom browser. Everything generic lives in `../shelf-core.js`.
 *
 * Two defects from the hand-written page are fixed here:
 *   - "Single Fandom" and "Crossovers" used different definitions of a
 *     crossover, so a story could count as both, or as neither. Both cards and
 *     the Story Type filter now share one `isCrossover` test.
 *   - word count was read from `stats.words` when filtering, `metadata.words`
 *     when totalling and `stats.words` again when sorting; one `wordsOf`
 *     helper now answers for the whole page.
 *
 * The taxonomy machinery the old file carried (CANONICAL_LABELS, CATEGORY_
 * LOOKUP, buildTaxonomyFromNovels, categorizeLabel) turned out to be dead
 * weight: every call site passed a forced category, so the lookup branch was
 * unreachable. Only the case-folding it did on the way past mattered, and
 * `canonical()` below is that, in ten lines.
 */

import FanFictionNovelCard from "./novel-card.js";
import { FanfictionHandler } from "../../../utils/website-handlers/fanfiction-handler.js";
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

/** FanFiction.net's own top-level sections, used to bucket hierarchy entries. */
const DOMAIN_TYPES = new Set([
	"anime",
	"books",
	"cartoons",
	"comics",
	"games",
	"misc",
	"plays",
	"movies",
	"tv",
]);

/**
 * First spelling of a label wins, so "Harry Potter" and "harry potter" collapse
 * into one filter option instead of two.
 *
 * @type {Map<string, string>}
 */
const CANONICAL = new Map();

/**
 * @param {unknown} label
 * @returns {string}
 */
function canonical(label) {
	const cleaned = String(label ?? "").trim();
	if (!cleaned) return "";
	const lower = cleaned.toLowerCase();
	if (!CANONICAL.has(lower)) CANONICAL.set(lower, cleaned);
	return CANONICAL.get(lower);
}

/** Bucketing is pure per novel, so it is worth caching across filter passes. */
const BUCKET_CACHE = new WeakMap();

/**
 * Split a story's labels into fandoms, genres, characters, content types and
 * whatever is left over as tags. A label already claimed by another bucket is
 * dropped from tags so it is not offered twice.
 *
 * @param {object} novel
 * @returns {{fandoms: string[], genres: string[], characters: string[], contentTypes: string[], tags: string[]}}
 */
function bucketsOf(novel) {
	const cached = BUCKET_CACHE.get(novel);
	if (cached) return cached;

	const metadata = novel.metadata || {};
	const take = (list) =>
		(Array.isArray(list) ? list : []).map(canonical).filter(Boolean);

	const fandoms = take(metadata.fandoms);
	const characters = take(metadata.characters);
	const genres = [
		...new Set([...take(metadata.genres), ...take(novel.genres)]),
	];
	const contentTypes = [
		...new Set(
			(metadata.hierarchy || [])
				.map((entry) => canonical(entry?.name))
				.filter((name) => name && DOMAIN_TYPES.has(name.toLowerCase())),
		),
	];

	const claimed = new Set([
		...fandoms,
		...genres,
		...characters,
		...contentTypes,
	]);
	const tags = [
		...new Set([...take(metadata.tags), ...take(novel.tags)]),
	].filter((tag) => !claimed.has(tag));

	const buckets = { fandoms, genres, characters, contentTypes, tags };
	BUCKET_CACHE.set(novel, buckets);
	return buckets;
}

/** One spelling of word count for the whole page. */
const wordsOf = (novel) =>
	novel.stats?.words || novel.metadata?.words || novel.words || 0;

const chaptersOf = (novel) =>
	novel.totalChapters || novel.metadata?.chapters || 0;

/** A stat that lives on either `stats` or `metadata`. */
const statOf = (novel, key) => novel.stats?.[key] || novel.metadata?.[key] || 0;

/**
 * One definition of a crossover for the Story Type filter and both stat cards.
 *
 * @param {object} novel
 * @returns {boolean}
 */
const isCrossover = (novel) =>
	novel.sourceUrl?.includes("/crossovers/") === true ||
	novel.metadata?.isCrossover === true ||
	bucketsOf(novel).fandoms.length > 1;

const workStatusOf = (novel) =>
	(novel.metadata?.status || novel.status || "").toLowerCase();

const timeOf = (value) => {
	if (!value) return 0;
	if (typeof value === "number") return value;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
};

/** FanFiction.net's letter ratings, ordered so they can be averaged. */
const RATING_SCORES = { k: 1, "k+": 2, t: 3, m: 4 };

export const descriptor = {
	shelfId: "fanfiction",
	filterStorageKey: "rg_ff_filters_fanfiction",
	cardRenderer: FanFictionNovelCard,
	handler: FanfictionHandler,
	randomPick: true,

	filterSection: createFandomNav({
		title: "Browse by Fandom",
		maxSelection: 2,
		values: (novel) => bucketsOf(novel).fandoms,
	}),

	filters: [
		{ kind: FILTER_KINDS.SEARCH, key: "search", label: "Search" },
		{
			kind: FILTER_KINDS.SELECT,
			key: "rating",
			label: "Rating",
			allLabel: "All Ratings",
			options: [
				{ value: "K", label: "K" },
				{ value: "K+", label: "K+" },
				{ value: "T", label: "T" },
				{ value: "M", label: "M" },
			],
			value: (novel) => novel.metadata?.rating || novel.rating || "",
		},
		{
			kind: FILTER_KINDS.SELECT,
			key: "workStatus",
			label: "Work Status",
			allLabel: "All",
			options: [
				{ value: "completed", label: "Completed" },
				{ value: "ongoing", label: "Ongoing" },
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
			key: "storyType",
			label: "Story Type",
			allLabel: "All Types",
			options: [
				{ value: "single", label: "Single Fandom" },
				{ value: "crossover", label: "Crossover" },
			],
			match: (novel, wanted) =>
				wanted === "crossover"
					? isCrossover(novel)
					: !isCrossover(novel),
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
			// FanFiction.net crossovers pair at most two fandoms.
			maxSelection: 2,
			searchable: true,
			values: (novel) => bucketsOf(novel).fandoms,
		},
		{
			kind: FILTER_KINDS.MULTI,
			key: "genres",
			label: "Genres",
			toggleLabel: "Choose Genres",
			// FanFiction.net has always required every selected genre to match.
			mode: "all",
			values: (novel) => bucketsOf(novel).genres,
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
			values: (novel) => bucketsOf(novel).characters,
		},
		{
			kind: FILTER_KINDS.MULTI,
			key: "tags",
			label: "Tags",
			toggleLabel: "Choose Tags",
			modeSelectable: true,
			searchable: true,
			values: (novel) => [
				...bucketsOf(novel).tags,
				...bucketsOf(novel).contentTypes,
			],
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
				timeOf(statOf(b, "publishedDate")) -
				timeOf(statOf(a, "publishedDate")),
		},
		{
			value: "updated",
			label: "Updated Date",
			compare: (a, b) =>
				timeOf(statOf(b, "updatedDate")) -
				timeOf(statOf(a, "updatedDate")),
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
			label: "Stories",
			compute: (novels) => novels.length.toLocaleString(),
		},
		{
			id: "stats-single",
			label: "Single Fandom",
			compute: (novels) =>
				novels.filter((n) => !isCrossover(n)).length.toLocaleString(),
		},
		{
			id: "stats-crossovers",
			label: "Crossovers",
			compute: (novels) =>
				novels.filter(isCrossover).length.toLocaleString(),
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
			id: "stats-avgrating",
			label: "Avg Rating",
			compute: (novels) => {
				const scores = novels
					.map((n) => RATING_SCORES[ratingKeyOf(n)])
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
			id: "most-favorited",
			label: "Most Favorited",
			icon: "⭐",
			pick: (novels) => countInsight(novels, "favorites"),
		},
		{
			id: "most-followed",
			label: "Most Followed",
			icon: "\u{1F465}",
			pick: (novels) => countInsight(novels, "follows"),
		},
		{
			id: "most-reviewed",
			label: "Most Reviewed",
			icon: "\u{1F4AC}",
			pick: (novels) => countInsight(novels, "reviews"),
		},
		{
			id: "longest-story",
			label: "Longest Story",
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
 * The rating letter, lowercased, or "" when the story carries none.
 *
 * @param {object} novel
 * @returns {string}
 */
function ratingKeyOf(novel) {
	return String(novel.metadata?.rating ?? novel.rating ?? "")
		.trim()
		.toLowerCase();
}

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
