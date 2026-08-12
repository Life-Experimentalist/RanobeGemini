/**
 * Every shelf page is now a descriptor handed to `shelf-core.js`. That moved the
 * risk: the loops are tested in `shelf-filter-engine.test.mjs`, but a typo in a
 * descriptor's accessor no longer breaks at import time — it breaks silently at
 * runtime, and `computeStats` even swallows the throw and prints "-".
 *
 * So these tests call every accessor a descriptor declares, directly and outside
 * the engine's try/catch, against a fully-populated novel and a nearly-empty one.
 * Real libraries contain both: records written years ago by earlier versions of
 * the extension often carry a title and nothing else.
 *
 * They also check each site's HTML still has the containers the core fills. A
 * bulk edit to the six index.html files has already deleted one of those once.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { FILTER_KINDS } from "../src/library/websites/shelf-filter-engine.js";
import {
	buildActiveChips,
	computeInsights,
	computeStats,
	createDefaultFilterState,
	deriveFilterOptions,
	filterAndSort,
} from "../src/library/websites/shelf-filter-engine.js";

const SHELVES = [
	"novelbin",
	"webnovel",
	"ranobes",
	"scribblehub",
	"fanfiction",
	"ao3",
];

/**
 * Containers `shelf-core.js` writes generated markup into. A shelf missing one
 * loses that whole section with no error in the console.
 */
const REQUIRED_IDS = [
	"stats-summary",
	"analytics-items",
	"filter-grid",
	"novel-grid",
	"search-input",
	"active-filters",
	"filter-dropdown",
	"filter-toggle-btn",
	"loading-state",
	"empty-state",
	"novel-count",
	"reading-status-chart",
	"reading-status-legend",
	"status-chart-summary",
];

const siteFile = (shelf, name) =>
	fileURLToPath(
		new URL(`../src/library/websites/${shelf}/${name}`, import.meta.url),
	);

/** Load all six descriptors once; the bootstrap self-guards on `document`. */
const descriptors = new Map(
	await Promise.all(
		SHELVES.map(async (shelf) => {
			const mod = await import(
				new URL(
					`../src/library/websites/${shelf}/shelf-page.js`,
					import.meta.url,
				).href
			);
			return [shelf, mod.descriptor];
		}),
	),
);

/**
 * A novel carrying every field any of the six sites reads, in both the
 * top-level and the `metadata` spelling.
 */
const RICH = {
	id: "rich",
	title: "The Rich Record",
	author: "Ann Author",
	description: "A work with every field populated.",
	sourceUrl: "https://example.com/crossovers/story/1",
	url: "https://example.com/story/1",
	readingStatus: "currently-reading",
	status: "completed",
	currentChapter: 12,
	totalChapters: 40,
	dateAdded: "2026-01-01T00:00:00Z",
	lastRead: "2026-02-01T00:00:00Z",
	words: 120000,
	metadata: {
		language: "English",
		rating: "Mature",
		status: "completed",
		chapters: 40,
		words: 120000,
		genres: ["Action", "Fantasy"],
		tags: ["Slow Burn", "Angst"],
		additionalTags: ["Slow Burn", "Angst"],
		fandoms: ["Fandom A", "Fandom B"],
		characters: ["Char One", "Char Two"],
		relationships: ["Char One/Char Two"],
		categories: ["M/M", "Gen"],
		isCrossover: true,
		publishedDate: "2025-06-01T00:00:00Z",
		updatedDate: "2026-02-01T00:00:00Z",
		completedDate: "2026-02-01T00:00:00Z",
		stats: {
			words: 120000,
			kudos: 900,
			hits: 45000,
			comments: 120,
			bookmarks: 60,
			favorites: 300,
			follows: 280,
			reviews: 75,
			views: 45000,
		},
	},
};

/** What a record written by an early version of the extension looks like. */
const SPARSE = { id: "sparse", title: "Bare Record" };

const NOVELS = [RICH, SPARSE];

for (const shelf of SHELVES) {
	const descriptor = descriptors.get(shelf);

	test(`${shelf}: descriptor declares the identity the core needs`, () => {
		assert.ok(descriptor, "shelf-page.js must export `descriptor`");
		assert.equal(descriptor.shelfId, shelf);
		assert.match(descriptor.filterStorageKey, /^rg_/);
		assert.equal(typeof descriptor.cardRenderer, "function");
		assert.ok(descriptor.handler, "a site handler supplies title and colours");
	});

	test(`${shelf}: filters are well-formed and uniquely keyed`, () => {
		const kinds = new Set(Object.values(FILTER_KINDS));
		const seen = new Set();
		assert.ok(descriptor.filters?.length, "a shelf with no filters is a bug");

		for (const filter of descriptor.filters) {
			assert.ok(kinds.has(filter.kind), `${filter.key}: unknown kind`);
			assert.equal(typeof filter.key, "string");
			assert.equal(seen.has(filter.key), false, `${filter.key}: duplicate key`);
			seen.add(filter.key);
			assert.ok(filter.label, `${filter.key}: needs a label`);

			// A range with no reader compares `undefined` against its bounds and
			// quietly hides everything.
			if (filter.kind === FILTER_KINDS.RANGE) {
				assert.equal(typeof filter.value, "function", `${filter.key}: no value()`);
			}
			// Static options must be {value,label} pairs — the core reads both.
			if (Array.isArray(filter.options)) {
				for (const option of filter.options) {
					assert.equal(typeof option.value, "string", `${filter.key}: option`);
					assert.ok(option.label, `${filter.key}: option needs a label`);
				}
			}
		}
	});

	test(`${shelf}: every filter accessor survives rich and sparse novels`, () => {
		for (const novel of NOVELS) {
			for (const filter of descriptor.filters) {
				if (typeof filter.value === "function") {
					assert.notEqual(filter.value(novel), undefined, filter.key);
				}
				if (typeof filter.values === "function") {
					assert.ok(Array.isArray(filter.values(novel)), `${filter.key}: values`);
				}
				if (typeof filter.match === "function") {
					assert.equal(typeof filter.match(novel, "anything"), "boolean", filter.key);
				}
			}
			if (typeof descriptor.searchFields === "function") {
				assert.ok(Array.isArray(descriptor.searchFields(novel)));
			}
		}
	});

	test(`${shelf}: sorts are uniquely keyed and compare cleanly`, () => {
		const seen = new Set();
		assert.ok(descriptor.sorts?.length, "the default sort comes from sorts[0]");

		for (const sort of descriptor.sorts) {
			assert.equal(seen.has(sort.value), false, `${sort.value}: duplicate`);
			seen.add(sort.value);
			assert.ok(sort.label, `${sort.value}: needs a label`);
			assert.equal(typeof sort.compare, "function", `${sort.value}: no compare`);
			// Both orders, so a comparator that only guards one side is caught.
			assert.equal(typeof sort.compare(RICH, SPARSE), "number", sort.value);
			assert.equal(typeof sort.compare(SPARSE, RICH), "number", sort.value);
		}
	});

	test(`${shelf}: stats compute without throwing`, () => {
		const seen = new Set();
		for (const stat of descriptor.stats || []) {
			assert.equal(seen.has(stat.id), false, `${stat.id}: duplicate stat id`);
			seen.add(stat.id);
			assert.ok(stat.label, `${stat.id}: needs a label`);
			// Called directly: `computeStats` catches throws and renders "-", so a
			// broken stat would otherwise pass this suite and fail only on screen.
			assert.notEqual(stat.compute(NOVELS), undefined, stat.id);
			assert.notEqual(stat.compute([]), undefined, `${stat.id}: empty shelf`);
		}
	});

	test(`${shelf}: insights pick without throwing`, () => {
		const seen = new Set();
		for (const insight of descriptor.insights || []) {
			assert.equal(seen.has(insight.id), false, `${insight.id}: duplicate`);
			seen.add(insight.id);
			assert.ok(insight.label, `${insight.id}: needs a label`);
			for (const pool of [NOVELS, []]) {
				const picked = insight.pick(pool);
				assert.equal(typeof picked, "object", insight.id);
				assert.equal(typeof picked.text, "string", `${insight.id}: text`);
			}
		}
	});

	test(`${shelf}: a full engine pass over both novel shapes`, () => {
		const state = createDefaultFilterState(descriptor);
		// Defaults must never hide anything, or a shelf opens looking empty.
		assert.equal(filterAndSort(descriptor, NOVELS, state).length, 2);
		assert.deepEqual(buildActiveChips(descriptor, state), []);
		assert.equal(typeof deriveFilterOptions(descriptor, NOVELS), "object");

		// Every declared stat must reach the panel. "-" is a legitimate value here
		// (a shelf with no ratings has no average); the direct-call test above is
		// what catches a stat that throws.
		const stats = computeStats(descriptor, NOVELS);
		for (const stat of descriptor.stats || []) {
			assert.ok(stat.id in stats, `${stat.id} missing from computeStats`);
		}
		const insights = computeInsights(descriptor, NOVELS);
		for (const insight of descriptor.insights || []) {
			assert.ok(insights[insight.id], insight.id);
		}
	});

	test(`${shelf}: every sort actually orders the shelf`, () => {
		for (const sort of descriptor.sorts) {
			const state = { ...createDefaultFilterState(descriptor), sort: sort.value };
			assert.equal(filterAndSort(descriptor, NOVELS, state).length, 2, sort.value);
		}
	});

	test(`${shelf}: index.html has the containers the core fills`, () => {
		const html = readFileSync(siteFile(shelf, "index.html"), "utf8");
		for (const id of REQUIRED_IDS) {
			assert.ok(html.includes(`id="${id}"`), `index.html lost #${id}`);
		}
		if (descriptor.filterSection) {
			const { containerId, render } = descriptor.filterSection;
			assert.equal(typeof render, "function", "filterSection needs render()");
			assert.ok(
				html.includes(`id="${containerId}"`),
				`index.html lost #${containerId}, so the filter section never renders`,
			);
		}
	});
}

test("no two shelves share a filter storage key", () => {
	// Sharing one would let a filter set on AO3 hide works on FanFiction.
	const keys = SHELVES.map((s) => descriptors.get(s).filterStorageKey);
	assert.equal(new Set(keys).size, keys.length, keys.join(", "));
});

test("the fandom browser is declared identically on the sites that have it", () => {
	// It is the only shared filter section; both sites must point at the same
	// container id or the shared CSS in shelf-page.css stops applying.
	const withSection = SHELVES.filter((s) => descriptors.get(s).filterSection);
	assert.deepEqual(withSection, ["fanfiction", "ao3"]);
	for (const shelf of withSection) {
		assert.equal(
			descriptors.get(shelf).filterSection.containerId,
			"fandom-filter-section",
		);
	}
});
