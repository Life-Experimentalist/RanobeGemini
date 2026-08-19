/**
 * The shelf filter engine is what five site pages now share, so a regression
 * here breaks every shelf at once. These tests pin the behaviours the old
 * per-site copies had, plus the ones that only appear once things are shared:
 * descriptor-scoped persistence, and stats that survive bad data.
 */

import test from "node:test";
import assert from "node:assert/strict";

const ENGINE_URL = new URL(
	"../src/library/websites/shelf-filter-engine.js",
	import.meta.url,
).href;

const engine = await import(ENGINE_URL);
const {
	FILTER_KINDS,
	applyFilters,
	applySort,
	buildActiveChips,
	bucketReadingStatus,
	clearFilterValue,
	computeInsights,
	computeStats,
	createDefaultFilterState,
	deriveFilterOptions,
	filterAndSort,
	formatNumber,
	loadFilterState,
	maxBy,
	normalizeModalStatus,
	normalizeReadingStatus,
	saveFilterState,
	sortAlpha,
	sumField,
} = engine;

/** A descriptor exercising all four filter kinds at once. */
const DESCRIPTOR = {
	shelfId: "test",
	filterStorageKey: "rg_test_filters",
	filters: [
		{ kind: FILTER_KINDS.SEARCH, key: "search", label: "Search" },
		{ kind: FILTER_KINDS.SELECT, key: "language", label: "Language" },
		{
			kind: FILTER_KINDS.MULTI,
			key: "genres",
			label: "Genres",
			modeSelectable: true,
		},
		{
			kind: FILTER_KINDS.RANGE,
			key: "wordCount",
			label: "Words",
			value: (novel) => novel.metadata?.words || 0,
		},
	],
	sorts: [
		{
			value: "title",
			label: "Title",
			compare: (a, b) => a.title.localeCompare(b.title),
		},
		{
			value: "words",
			label: "Words",
			compare: (a, b) => b.metadata.words - a.metadata.words,
		},
	],
	stats: [
		{ id: "count", label: "Novels", compute: (n) => n.length },
		{
			id: "boom",
			label: "Broken",
			compute: () => {
				throw new Error("bad metadata");
			},
		},
	],
	insights: [
		{
			id: "longest",
			label: "Longest",
			pick: (novels) => {
				const novel = maxBy(novels, (n) => n.metadata.words);
				return { novel, text: novel?.title || "-" };
			},
		},
	],
};

const NOVELS = [
	{
		id: "a",
		title: "Alpha",
		author: "Ann",
		readingStatus: "currently-reading",
		metadata: { language: "English", genres: ["Action", "Fantasy"], words: 90000 },
	},
	{
		id: "b",
		title: "Beta",
		author: "Bo",
		readingStatus: "re_reading",
		metadata: { language: "Chinese", genres: ["Fantasy"], words: 12000 },
	},
	{
		id: "c",
		title: "Gamma",
		author: "Cy",
		readingStatus: "completed",
		metadata: { language: "English", genres: ["Action"], words: 500 },
	},
];

/**
 * Install a `localStorage` double. Shelf pages persist filters there, and Node
 * has no such global.
 *
 * @param {Object<string, string>} seed
 */
function installLocalStorage(seed = {}) {
	const previous = globalThis.localStorage;
	const store = new Map(Object.entries(seed));
	globalThis.localStorage = {
		getItem: (key) => (store.has(key) ? store.get(key) : null),
		setItem: (key, value) => store.set(key, String(value)),
		removeItem: (key) => store.delete(key),
	};
	return {
		dump: () => Object.fromEntries(store),
		restore: () => {
			globalThis.localStorage = previous;
		},
	};
}

const state = (overrides = {}) => ({
	...createDefaultFilterState(DESCRIPTOR),
	...overrides,
});

const titles = (novels) => novels.map((n) => n.title);

// ── Normalisation ─────────────────────────────────────────────────────────────

test("reading statuses from every past schema collapse to one spelling", () => {
	// Several extension generations wrote these; a shelf must treat them alike.
	assert.equal(normalizeReadingStatus("currently-reading"), "reading");
	assert.equal(normalizeReadingStatus("in-progress"), "reading");
	assert.equal(normalizeReadingStatus("re_reading"), "re-reading");
	assert.equal(normalizeReadingStatus("rereading"), "re-reading");
	assert.equal(normalizeReadingStatus("COMPLETED"), "completed");
	assert.equal(normalizeReadingStatus(""), "");
});

test("a missing status defaults to plan-to-read only in the modal", () => {
	assert.equal(normalizeModalStatus(""), "plan-to-read");
	assert.equal(normalizeModalStatus(undefined), "plan-to-read");
	assert.equal(normalizeModalStatus("reading"), "reading");
});

test("large counts are abbreviated, small ones are not", () => {
	assert.equal(formatNumber(0), "0");
	assert.equal(formatNumber(999), "999");
	assert.equal(formatNumber(45700), "45.7K");
	assert.equal(formatNumber(1200000), "1.2M");
	assert.equal(formatNumber("1,200,000"), "1.2M");
	assert.equal(formatNumber("not a number"), "0");
});

test("alphabetical sorting ignores case and leaves the input alone", () => {
	const input = ["beta", "Alpha", "gamma"];
	assert.deepEqual(sortAlpha(input), ["Alpha", "beta", "gamma"]);
	assert.deepEqual(input, ["beta", "Alpha", "gamma"]);
});

// ── Filtering ─────────────────────────────────────────────────────────────────

test("search spans title, author and multi-filter values", () => {
	assert.deepEqual(
		titles(applyFilters(DESCRIPTOR, NOVELS, state({ search: "cy" }))),
		["Gamma"],
	);
	assert.deepEqual(
		titles(applyFilters(DESCRIPTOR, NOVELS, state({ search: "fantasy" }))),
		["Alpha", "Beta"],
	);
});

test("a select filter matches case-insensitively and 'all' is a no-op", () => {
	assert.deepEqual(
		titles(applyFilters(DESCRIPTOR, NOVELS, state({ language: "english" }))),
		["Alpha", "Gamma"],
	);
	assert.equal(
		applyFilters(DESCRIPTOR, NOVELS, state({ language: "all" })).length,
		3,
	);
});

test("multi filters honour the any/all mode", () => {
	const selected = { genres: ["Action", "Fantasy"] };
	assert.deepEqual(
		titles(
			applyFilters(
				DESCRIPTOR,
				NOVELS,
				state({ ...selected, genresMode: "any" }),
			),
		),
		["Alpha", "Beta", "Gamma"],
	);
	assert.deepEqual(
		titles(
			applyFilters(
				DESCRIPTOR,
				NOVELS,
				state({ ...selected, genresMode: "all" }),
			),
		),
		["Alpha"],
	);
});

test("a range filter applies each bound independently", () => {
	assert.deepEqual(
		titles(applyFilters(DESCRIPTOR, NOVELS, state({ wordCountMin: "10000" }))),
		["Alpha", "Beta"],
	);
	assert.deepEqual(
		titles(applyFilters(DESCRIPTOR, NOVELS, state({ wordCountMax: "12000" }))),
		["Beta", "Gamma"],
	);
	// Both blank must not filter anything out.
	assert.equal(
		applyFilters(
			DESCRIPTOR,
			NOVELS,
			state({ wordCountMin: "", wordCountMax: "" }),
		).length,
		3,
	);
});

test("filtering never mutates the input array", () => {
	const input = [...NOVELS];
	applyFilters(DESCRIPTOR, input, state({ search: "alpha" }));
	assert.equal(input.length, 3);
});

// ── Sorting ───────────────────────────────────────────────────────────────────

test("an unknown sort key leaves the order untouched rather than throwing", () => {
	assert.deepEqual(
		titles(applySort(DESCRIPTOR, NOVELS, "no-such-sort")),
		["Alpha", "Beta", "Gamma"],
	);
});

test("filterAndSort applies both halves", () => {
	assert.deepEqual(
		titles(
			filterAndSort(
				DESCRIPTOR,
				NOVELS,
				state({ language: "English", sort: "words" }),
			),
		),
		["Alpha", "Gamma"],
	);
});

// ── Option derivation ─────────────────────────────────────────────────────────

test("options come from the data, deduped with the first spelling kept", () => {
	const novels = [
		{ metadata: { language: "English", genres: ["Action"] } },
		{ metadata: { language: "english", genres: ["action", "Fantasy"] } },
	];
	const options = deriveFilterOptions(DESCRIPTOR, novels);
	assert.deepEqual(options.language, ["English"]);
	assert.deepEqual(options.genres, ["Action", "Fantasy"]);
});

// ── Persistence ───────────────────────────────────────────────────────────────

test("saved filters round-trip through storage", () => {
	const fake = installLocalStorage();
	try {
		saveFilterState(DESCRIPTOR, state({ language: "English" }));
		assert.equal(loadFilterState(DESCRIPTOR).language, "English");
	} finally {
		fake.restore();
	}
});

test("keys the descriptor no longer declares are dropped on load", () => {
	// A filter removed from a site must not linger and silently hide novels.
	const fake = installLocalStorage({
		rg_test_filters: JSON.stringify({ language: "English", fandoms: ["X"] }),
	});
	try {
		const loaded = loadFilterState(DESCRIPTOR);
		assert.equal(loaded.language, "English");
		assert.equal("fandoms" in loaded, false);
	} finally {
		fake.restore();
	}
});

test("corrupt stored filters fall back to defaults instead of throwing", () => {
	const fake = installLocalStorage({ rg_test_filters: "{not json" });
	try {
		assert.deepEqual(
			loadFilterState(DESCRIPTOR),
			createDefaultFilterState(DESCRIPTOR),
		);
	} finally {
		fake.restore();
	}
});

test("a missing localStorage is tolerated in both directions", () => {
	const previous = globalThis.localStorage;
	globalThis.localStorage = undefined;
	try {
		assert.deepEqual(
			loadFilterState(DESCRIPTOR),
			createDefaultFilterState(DESCRIPTOR),
		);
		saveFilterState(DESCRIPTOR, state());
	} finally {
		globalThis.localStorage = previous;
	}
});

// ── Chips ─────────────────────────────────────────────────────────────────────

test("chips describe exactly the filters that are actually narrowing", () => {
	assert.deepEqual(buildActiveChips(DESCRIPTOR, state()), []);

	const chips = buildActiveChips(
		DESCRIPTOR,
		state({
			search: "alpha",
			language: "English",
			genres: ["Action", "Fantasy"],
			genresMode: "all",
			wordCountMin: "100",
		}),
	);
	const keys = chips.map((c) => c.key);
	assert.equal(keys.filter((k) => k === "genres").length, 2);
	assert.ok(keys.includes("search"));
	assert.ok(keys.includes("language"));
	assert.ok(keys.includes("genresMode"));
	assert.ok(keys.includes("wordCountMin"));
});

test("clearing a chip returns a new state and removes only that value", () => {
	const before = state({ genres: ["Action", "Fantasy"] });
	const after = clearFilterValue(DESCRIPTOR, before, "genres", "Action");
	assert.deepEqual(after.genres, ["Fantasy"]);
	assert.deepEqual(before.genres, ["Action", "Fantasy"]);
});

test("clearing a suffixed key resets that bound alone", () => {
	const before = state({ wordCountMin: "100", wordCountMax: "900" });
	const after = clearFilterValue(DESCRIPTOR, before, "wordCountMin");
	assert.equal(after.wordCountMin, "");
	assert.equal(after.wordCountMax, "900");
});

// ── Stats and insights ────────────────────────────────────────────────────────

test("one broken stat does not take the rest of the panel down", () => {
	const stats = computeStats(DESCRIPTOR, NOVELS);
	assert.equal(stats.count, "3");
	assert.equal(stats.boom, "-");
});

test("insights resolve to the novel they point at", () => {
	const insights = computeInsights(DESCRIPTOR, NOVELS);
	assert.equal(insights.longest.novel.id, "a");
	assert.equal(insights.longest.text, "Alpha");
});

test("insights over an empty shelf point at nothing", () => {
	const insights = computeInsights(DESCRIPTOR, []);
	assert.equal(insights.longest.novel, null);
	assert.equal(insights.longest.text, "-");
});

test("status buckets use the normalised spelling", () => {
	const buckets = bucketReadingStatus(NOVELS);
	assert.deepEqual(buckets, {
		reading: 1,
		"re-reading": 1,
		completed: 1,
	});
});

test("an unset status is bucketed as plan-to-read", () => {
	assert.deepEqual(bucketReadingStatus([{ id: "x" }]), { "plan-to-read": 1 });
});

test("sumField prefers metadata and skips non-numbers", () => {
	assert.equal(sumField(NOVELS, "words"), 102500);
	assert.equal(sumField([{ words: "lots" }, { words: 5 }], "words"), 5);
});

test("maxBy returns null when every value is zero", () => {
	assert.equal(maxBy([{ w: 0 }, { w: 0 }], (n) => n.w), null);
});
