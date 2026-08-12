/**
 * @fileoverview NovelBin / NovelArrow shelf.
 *
 * Everything generic — loading, filtering, sorting, rendering, the modal,
 * analytics, deep links — lives in `../shelf-core.js`. This file only declares
 * what NovelBin has: language and genre filters, six stat cards, four insights,
 * and one site-specific extra (the LNCrawl multi-domain command panel).
 */

import { NovelbinNovelCard } from "./novel-card.js";
import { NovelbinHandler } from "../../../utils/website-handlers/novelbin-handler.js";
import { READING_STATUS } from "../../../utils/novel-library.js";
import { initShelfPage } from "../shelf-core.js";
import {
	FILTER_KINDS,
	formatNumber,
	maxBy,
	normalizeReadingStatus,
	sumField,
} from "../shelf-filter-engine.js";

/** Word count is spelled three different ways across scraped metadata. */
const wordsOf = (novel) =>
	novel.metadata?.words || novel.metadata?.wordCount || novel.words || 0;

const chaptersOf = (novel) =>
	novel.metadata?.totalChapters || novel.totalChapters || 0;

/** Publication status, as opposed to the user's own reading status. */
const workStatusOf = (novel) =>
	(novel.metadata?.status || novel.status || "").toLowerCase();

const countWorkStatus = (novels, wanted) =>
	novels.filter((n) => workStatusOf(n) === wanted).length;

export const descriptor = {
	shelfId: "novelbin",
	filterStorageKey: "rg_filters_novelbin",
	cardRenderer: NovelbinNovelCard,
	handler: NovelbinHandler,

	filters: [
		{ kind: FILTER_KINDS.SEARCH, key: "search", label: "Search" },
		{
			kind: FILTER_KINDS.SELECT,
			key: "workStatus",
			label: "Work Status",
			allLabel: "All",
			options: [
				{ value: "Ongoing", label: "Ongoing" },
				{ value: "Completed", label: "Completed" },
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
			key: "language",
			label: "Language",
			allLabel: "All Languages",
		},
		{
			kind: FILTER_KINDS.MULTI,
			key: "genres",
			label: "Genres",
			toggleLabel: "Choose Genres",
			// NovelBin has always required every selected genre to match.
			mode: "all",
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
			id: "most-chapters",
			label: "Most Chapters",
			icon: "\u{1F4DA}",
			pick: (novels) => {
				const novel = maxBy(novels, chaptersOf);
				return { novel, text: novel?.title || "-" };
			},
		},
		{
			id: "longest-novel",
			label: "Longest Novel",
			icon: "\u{1F4CB}",
			pick: (novels) => {
				const novel = maxBy(novels, wordsOf);
				return { novel, text: novel?.title || "-" };
			},
		},
		{
			id: "newest-addition",
			label: "Newest Addition",
			icon: "\u{1F5DE}",
			pick: (novels) => {
				const novel = maxBy(
					novels,
					(n) => n.addedAt || n.metadata?.addedDate || 0,
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
						.map((l) => l.trim()),
				);
				return {
					novel: null,
					text: languages.size ? String(languages.size) : "-",
				};
			},
		},
	],

	renderModalExtras: renderLncrawlPanel,
};

/**
 * NovelBin is mirrored across three domains and any one of them can be down, so
 * the panel offers an lncrawl command for each rather than guessing.
 *
 * @param {object} novel
 */
function renderLncrawlPanel(novel) {
	const button = document.getElementById("modal-lncrawl-btn");
	const panel = document.getElementById("modal-lncrawl-panel");
	const commands = document.getElementById("modal-lncrawl-cmds");
	if (!button || !panel || !commands) return;

	const slug = extractNovelSlug(novel.sourceUrl || novel.lastReadUrl || "");

	button.onclick = () => {
		const opening = panel.style.display === "none";
		panel.style.display = opening ? "block" : "none";
		if (!opening) return;

		if (!slug) {
			commands.textContent = "Could not extract novel slug from URL.";
			return;
		}

		const domains = [
			{
				label: "novelbin.com",
				url: `https://novelbin.com/b/${slug}`,
				note: "",
			},
			{
				label: "novelbin.me",
				url: `https://novelbin.me/b/${slug}`,
				note: "(mirror — may be down)",
			},
			{
				label: "novelarrow.com",
				url: `https://novelarrow.com/novel/${slug}`,
				note: "(new site)",
			},
		];

		commands.textContent = "";
		for (const domain of domains) {
			commands.appendChild(buildCommandRow(domain));
		}
	};
}

/**
 * @param {string} url
 * @returns {string} The novel slug, or "" when the URL is not a novel page.
 */
function extractNovelSlug(url) {
	try {
		const match = new URL(url).pathname.match(
			/\/(?:b|novel)\/([a-z0-9-]+)/i,
		);
		return match ? match[1] : "";
	} catch (_error) {
		return "";
	}
}

/**
 * One copyable `lncrawl -u "…"` row.
 *
 * @param {{label: string, url: string, note: string}} domain
 * @returns {HTMLElement}
 */
function buildCommandRow(domain) {
	const command = `lncrawl -u "${domain.url}"`;

	const row = document.createElement("div");
	row.style.cssText =
		"display:flex;align-items:center;gap:6px;margin-bottom:6px;";

	const code = document.createElement("code");
	code.style.cssText =
		"flex:1;font-size:11px;padding:4px 8px;background:var(--bg-secondary,#1e1e2e);border-radius:4px;border:1px solid var(--border-color,#44475a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
	code.title = command;
	code.textContent = command;

	const copyBtn = document.createElement("button");
	copyBtn.className = "btn btn-icon lncrawl-copy-cmd";
	copyBtn.style.cssText = "flex-shrink:0;font-size:11px;padding:3px 8px;";
	copyBtn.title = `Copy command for ${domain.label}`;
	copyBtn.textContent = "\u{1F4CB}";
	copyBtn.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(command);
			copyBtn.textContent = "✅";
			setTimeout(() => {
				copyBtn.textContent = "\u{1F4CB}";
			}, 2500);
		} catch (_error) {
			copyBtn.textContent = "❌";
			setTimeout(() => {
				copyBtn.textContent = "\u{1F4CB}";
			}, 2000);
		}
	});

	row.appendChild(code);
	row.appendChild(copyBtn);

	if (domain.note) {
		const note = document.createElement("span");
		note.style.cssText =
			"font-size:10px;color:var(--text-muted,#888);flex-shrink:0;";
		note.textContent = domain.note;
		row.appendChild(note);
	}

	return row;
}

// Guarded so the descriptor above can be imported and tested outside a browser.
if (typeof document !== "undefined") {
	initShelfPage(descriptor);
}
