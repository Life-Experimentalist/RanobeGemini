/**
 * Website handler extraction tests (audit finding TEST-1).
 *
 * Every supported site is a moving target: the markup can change without
 * notice, and the only thing between that and a silent extraction failure is a
 * list of CSS selectors. These tests run the real handlers against reduced
 * fixtures (see `tests/fixtures/README.md`) and assert three things per site:
 *
 *   1. `canHandle()` claims the right hostnames and refuses the wrong ones.
 *   2. `isChapterPage()` separates chapters from index/profile/detail pages —
 *      the negative cases matter more than the positive ones, because a false
 *      positive puts the enhance UI on a page with nothing to enhance.
 *   3. `extractContent()` returns the prose *and* leaves the noise behind.
 *
 * Point 3 is the one worth the effort. "Extraction returned something" is a
 * much weaker claim than "extraction returned the right thing", and the bugs
 * that actually reached users were of the second kind: ad markup arriving in
 * the model prompt, and a regex eating the letters "ad" out of ordinary words.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { withPage } from "./helpers/dom-harness.mjs";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/** Read a fixture by basename (without the `.html`). */
function fixture(name) {
	return readFileSync(join(FIXTURE_DIR, `${name}.html`), "utf8");
}

const { RanobesHandler } = await import(
	"../src/utils/website-handlers/ranobes-handler.js"
);
const { NovelbinHandler } = await import(
	"../src/utils/website-handlers/novelbin-handler.js"
);
const { NovelarrowHandler } = await import(
	"../src/utils/website-handlers/novelarrow-handler.js"
);
const { ScribbleHubHandler } = await import(
	"../src/utils/website-handlers/scribblehub-handler.js"
);
const { AO3Handler } = await import(
	"../src/utils/website-handlers/ao3-handler.js"
);
const { FanfictionHandler } = await import(
	"../src/utils/website-handlers/fanfiction-handler.js"
);
const { FanfictionMobileHandler } = await import(
	"../src/utils/website-handlers/fanfiction-mobile-handler.js"
);
const { WebNovelHandler } = await import(
	"../src/utils/website-handlers/webnovel-handler.js"
);

/**
 * The sentence that broke Ranobes. Every one of "had", "already", "road",
 * "ahead", "shadowed" and "afraid" contains the letters `ad`, so an unanchored
 * ad-stripping regex turns it into "He halrey walked the roahe, showed and
 * afraid." Asserted verbatim on every site, because the base extraction path is
 * shared and a regression there would hit all of them.
 */
const PROSE = "He had already walked the road ahead, shadowed and afraid.";

/** Text that only ever appears inside an element the handler must strip. */
const NOISE = "SPONSOR BLOCK TEXT";

/** Assert the common shape of a successful extraction. */
function assertCleanExtraction(result, { title }) {
	assert.equal(result.found, true, "extraction should report found");
	assert.equal(result.title, title);
	assert.ok(
		result.text.includes(PROSE),
		`prose was altered or lost.\nGot: ${JSON.stringify(result.text)}`,
	);
	assert.ok(
		!result.text.includes(NOISE),
		`ad markup leaked into the extracted text.\nGot: ${JSON.stringify(result.text)}`,
	);
	assert.ok(
		!/document\.createElement|adsbygoogle\s*=|__NEXT_DATA__|g_data|window\.tracker/.test(
			result.text,
		),
		`script source leaked into the extracted text.\nGot: ${JSON.stringify(result.text)}`,
	);
}

// ─── Ranobes ────────────────────────────────────────────────────────────────

const RANOBES_CHAPTER_URL = "https://ranobes.top/read-1206917.html";
const RANOBES_NOVEL_URL = "https://ranobes.top/novels/1234-ashes-ninth-gate.html";

test("Ranobes: handles its four domains and nothing else", () => {
	for (const host of ["ranobes.top", "ranobes.net", "ranobes.com", "ranobes.org"]) {
		withPage(fixture("ranobes-chapter"), `https://${host}/read-1.html`, () => {
			assert.equal(new RanobesHandler().canHandle(), true, host);
		});
	}
	withPage(fixture("ranobes-chapter"), "https://novelbin.com/b/x/y", () => {
		assert.equal(new RanobesHandler().canHandle(), false);
	});
});

test("Ranobes: chapter page is detected, novel detail page is not", () => {
	withPage(fixture("ranobes-chapter"), RANOBES_CHAPTER_URL, () => {
		assert.equal(new RanobesHandler().isChapterPage(), true);
	});
	withPage(fixture("ranobes-novel"), RANOBES_NOVEL_URL, () => {
		const handler = new RanobesHandler();
		assert.equal(
			handler.isChapterPage(),
			false,
			"a /novels/{id}-{slug}.html page carries a chapter list, not a chapter",
		);
	});
});

test("Ranobes: title drops the trailing author credit", () => {
	withPage(fixture("ranobes-chapter"), RANOBES_CHAPTER_URL, () => {
		// The fixture heading reads "Chapter 42: The Long Road by Kalen Vex".
		assert.equal(new RanobesHandler().extractTitle(), "Chapter 42: The Long Road");
	});
});

test("Ranobes: extraction keeps the prose and drops the ads", () => {
	withPage(fixture("ranobes-chapter"), RANOBES_CHAPTER_URL, () => {
		const result = new RanobesHandler().extractContent();
		assertCleanExtraction(result, { title: "Chapter 42: The Long Road" });
		assert.ok(
			result.text.includes("the ninth bell rang twice"),
			"content after the ad slot should survive",
		);
	});
});

test("Ranobes: a standalone 'Advertisement' line is stripped, 'had'/'road' are not", () => {
	// This is the regression test for the ad-stripping regexes. They used to be
	// written as `/\[?\s*ad\s*\]?/gi` — every part optional except the literal
	// "ad" — which matched that substring anywhere in the chapter.
	withPage(fixture("ranobes-chapter"), RANOBES_CHAPTER_URL, () => {
		const { text } = new RanobesHandler().extractContent();
		assert.ok(
			!/^\s*Advertisement\s*$/m.test(text),
			"the standalone Advertisement line should have been removed",
		);
		assert.ok(text.includes("had already"), "'had already' must survive");
		assert.ok(text.includes("the road ahead"), "'the road ahead' must survive");
	});
});

test("Ranobes: removeAdRelatedText only strips anchored markers", () => {
	withPage(fixture("ranobes-chapter"), RANOBES_CHAPTER_URL, () => {
		const strip = (s) => new RanobesHandler().removeAdRelatedText(s);
		// Prose is returned byte-for-byte — this is the whole point.
		assert.equal(strip(PROSE), PROSE);
		// Marker lines go, and the blank line they leave behind is collapsed by
		// the cleanup pass at the end of removeAdRelatedText().
		assert.equal(strip("a\n[ad]\nb"), "a\nb");
		assert.equal(strip("a\nAdvertisement\nb"), "a\nb");
		assert.equal(strip("a\nSponsored content\nb"), "a\nb");
		// A bracketed marker mid-line goes without taking its neighbours.
		assert.equal(strip("Read the [ad] notice."), "Read the notice.");
	});
});

// ─── NovelBin ───────────────────────────────────────────────────────────────

const NOVELBIN_CHAPTER_URL = "https://novelbin.com/b/ashes-ninth-gate/chapter-42";

test("NovelBin: chapter, detail and listing URLs are told apart", () => {
	const html = fixture("novelbin-chapter");
	withPage(html, NOVELBIN_CHAPTER_URL, () => {
		const handler = new NovelbinHandler();
		assert.equal(handler.canHandle(), true);
		assert.equal(handler.isChapterPage(), true);
		assert.equal(handler.isNovelPage(), false);
	});
	withPage(html, "https://novelbin.com/b/ashes-ninth-gate", () => {
		const handler = new NovelbinHandler();
		assert.equal(handler.isChapterPage(), false);
		assert.equal(handler.isNovelPage(), true);
	});
	withPage(html, "https://novelbin.com/sort/latest", () => {
		const handler = new NovelbinHandler();
		assert.equal(handler.isChapterPage(), false);
		assert.equal(handler.isNovelPage(), false);
	});
});

test("NovelBin: subdomains are handled, novelarrow.com is not", () => {
	const html = fixture("novelbin-chapter");
	withPage(html, "https://en.novelbin.com/b/x/chapter-1", () => {
		assert.equal(new NovelbinHandler().canHandle(), true);
	});
	withPage(html, "https://novelarrow.com/chapter/x/chapter-1", () => {
		assert.equal(
			new NovelbinHandler().canHandle(),
			false,
			"NovelArrow has its own higher-priority handler",
		);
	});
});

test("NovelBin: extraction keeps the prose and drops the ads", () => {
	withPage(fixture("novelbin-chapter"), NOVELBIN_CHAPTER_URL, () => {
		const result = new NovelbinHandler().extractContent();
		assertCleanExtraction(result, { title: "Chapter 42: The Long Road" });
		assert.equal(result.selector, "novelbin-chr-content");
	});
});

test("NovelBin: a non-chapter URL extracts nothing rather than guessing", () => {
	withPage(fixture("novelbin-chapter"), "https://novelbin.com/b/ashes-ninth-gate", () => {
		const result = new NovelbinHandler().extractContent();
		assert.equal(result.found, false);
		assert.equal(result.selector, "novelbin-not-chapter");
		assert.equal(result.text, "");
	});
});

test("NovelBin: navigation is read from the data-chapter-url attributes", () => {
	withPage(fixture("novelbin-chapter"), NOVELBIN_CHAPTER_URL, () => {
		const nav = new NovelbinHandler().getChapterNavigation();
		assert.equal(nav.hasPrevious, true);
		assert.equal(nav.hasNext, true);
		assert.equal(nav.currentChapter, 42);
	});
});

// ─── NovelArrow ─────────────────────────────────────────────────────────────

const NOVELARROW_CHAPTER_URL =
	"https://novelarrow.com/chapter/ashes-ninth-gate/chapter-42";

test("NovelArrow: /chapter/ URLs are chapters, /novel/ URLs are detail pages", () => {
	const html = fixture("novelarrow-chapter");
	withPage(html, NOVELARROW_CHAPTER_URL, () => {
		const handler = new NovelarrowHandler();
		assert.equal(handler.canHandle(), true);
		assert.equal(handler.isChapterPage(), true);
	});
	withPage(html, "https://novelarrow.com/novel/ashes-ninth-gate", () => {
		const handler = new NovelarrowHandler();
		assert.equal(handler.isChapterPage(), false);
		assert.equal(handler.isNovelPage(), true);
	});
});

test("NovelArrow: shares NovelBin's library id so the two domains merge", () => {
	// The shelf is keyed on this. If it ever diverges, a reader who switches
	// domains gets two copies of the same novel in their library.
	withPage(fixture("novelarrow-chapter"), NOVELARROW_CHAPTER_URL, () => {
		assert.equal(
			new NovelarrowHandler().generateNovelId(),
			"novelbin-ashes-ninth-gate",
		);
	});
	withPage(fixture("novelbin-chapter"), NOVELBIN_CHAPTER_URL, () => {
		assert.equal(
			new NovelbinHandler().generateNovelId(),
			"novelbin-ashes-ninth-gate",
		);
	});
});

test("NovelArrow: the two domains produce the same canonical cache URL", () => {
	withPage(fixture("novelarrow-chapter"), NOVELARROW_CHAPTER_URL, () => {
		assert.equal(
			new NovelarrowHandler().getCanonicalCacheUrl(),
			"https://novelbin.com/b/ashes-ninth-gate/chapter-42",
		);
	});
});

test("NovelArrow: extraction reads the React article and the og:novel meta title", () => {
	withPage(fixture("novelarrow-chapter"), NOVELARROW_CHAPTER_URL, () => {
		const result = new NovelarrowHandler().extractContent();
		assertCleanExtraction(result, { title: "Ashes of the Ninth Gate" });
	});
});

// ─── ScribbleHub ────────────────────────────────────────────────────────────

const SCRIBBLEHUB_CHAPTER_URL =
	"https://www.scribblehub.com/read/123456-ashes-ninth-gate/chapter/987654/";

test("ScribbleHub: chapter URLs are detected, series pages are not", () => {
	const html = fixture("scribblehub-chapter");
	withPage(html, SCRIBBLEHUB_CHAPTER_URL, () => {
		const handler = new ScribbleHubHandler();
		assert.equal(handler.canHandle(), true);
		assert.equal(handler.isChapterPage(), true);
	});
	withPage(
		fixture("ranobes-novel"),
		"https://www.scribblehub.com/series/123456/ashes-ninth-gate/",
		() => {
			assert.equal(new ScribbleHubHandler().isChapterPage(), false);
		},
	);
});

test("ScribbleHub: extraction strips stats, ad slots and the prev/next row", () => {
	withPage(fixture("scribblehub-chapter"), SCRIBBLEHUB_CHAPTER_URL, () => {
		const result = new ScribbleHubHandler().extractContent();
		assertCleanExtraction(result, { title: "Chapter 42: The Long Road" });
		assert.ok(!result.text.includes("1,204 words"), ".chapter_stats must go");
		assert.ok(!/Previous\s*Next/.test(result.text), ".prenext row must go");
	});
});

// ─── AO3 ────────────────────────────────────────────────────────────────────

const AO3_CHAPTER_URL = "https://archiveofourown.org/works/12345678/chapters/98765432";
const AO3_FULL_WORK_URL =
	"https://archiveofourown.org/works/12345678?view_full_work=true";

test("AO3: only canonical /works routes are handled", () => {
	const html = fixture("ao3-chapter");
	withPage(html, AO3_CHAPTER_URL, () => {
		assert.equal(new AO3Handler().canHandle(), true);
	});
	withPage(html, "https://archiveofourown.org/works/12345678", () => {
		assert.equal(new AO3Handler().canHandle(), true, "single-chapter works");
	});
	withPage(html, "https://archiveofourown.org/tags/Original%20Work/works", () => {
		assert.equal(
			new AO3Handler().canHandle(),
			false,
			"a tag listing is not a work",
		);
	});
});

test("AO3: title joins the work title and the chapter title", () => {
	withPage(fixture("ao3-chapter"), AO3_CHAPTER_URL, () => {
		assert.equal(
			new AO3Handler().extractTitle(),
			"Ashes of the Ninth Gate - Chapter 42: The Long Road",
		);
	});
});

test("AO3: chapter extraction returns both text and structure-preserving HTML", () => {
	withPage(fixture("ao3-chapter"), AO3_CHAPTER_URL, () => {
		const result = new AO3Handler().extractContent();
		assert.equal(result.found, true);
		assert.ok(result.text.includes(PROSE));
		assert.ok(
			result.content.includes("<p>"),
			"AO3 preserves markup so author formatting survives the round trip",
		);
		assert.ok(
			!result.content.includes("<script"),
			"scripts must not survive into the HTML handed downstream",
		);
	});
});

test("AO3: a full-work page concatenates every chapter and skips author notes", () => {
	withPage(fixture("ao3-full-work"), AO3_FULL_WORK_URL, () => {
		const handler = new AO3Handler();
		assert.equal(handler.isFullWorkPage(), true);

		const result = handler.extractContent();
		assert.equal(result.isFullWork, true);
		assert.equal(result.totalChapters, 2);
		assert.equal(result.title, "Ashes of the Ninth Gate");
		assert.ok(result.text.includes("The first bell rang"), "chapter 1 prose");
		assert.ok(result.text.includes(PROSE), "chapter 2 prose");
		assert.ok(
			result.text.includes("== Chapter 1: The First Bell =="),
			"chapter headings mark the boundaries",
		);
		assert.ok(
			!result.text.includes("AUTHOR NOTE THAT MUST NOT BE EXTRACTED"),
			"notes blocks are not story text and must not be sent to the model",
		);
	});
});

test("AO3: view_full_work without multiple chapters is not a full-work page", () => {
	// The query parameter alone is not enough — AO3 leaves it on single-chapter
	// works too, and treating those as full-work pages takes a different, more
	// expensive extraction path for no reason.
	withPage(fixture("ao3-chapter"), `${AO3_CHAPTER_URL}?view_full_work=true`, () => {
		assert.equal(new AO3Handler().isFullWorkPage(), false);
	});
});

// ─── FanFiction.net (desktop) ───────────────────────────────────────────────

const FF_CHAPTER_URL =
	"https://www.fanfiction.net/s/13456789/42/ashes-of-the-ninth-gate";

test("FanFiction: story pages are handled, user profiles and mobile are not", () => {
	const html = fixture("fanfiction-chapter");
	withPage(html, FF_CHAPTER_URL, () => {
		const handler = new FanfictionHandler();
		assert.equal(handler.canHandle(), true);
		assert.equal(handler.isChapterPage(), true);
	});
	withPage(html, "https://www.fanfiction.net/u/999999/kalenvex", () => {
		assert.equal(
			new FanfictionHandler().canHandle(),
			false,
			"a user profile lists stories, it is not one",
		);
	});
	withPage(html, "https://m.fanfiction.net/s/13456789/42/", () => {
		assert.equal(
			new FanfictionHandler().canHandle(),
			false,
			"m.fanfiction.net belongs to the mobile handler",
		);
	});
});

test("FanFiction: extraction uses the story title, not the page title", () => {
	// The page <title> is "Ashes of the Ninth Gate, a fantasy fanfic | FanFiction".
	// The base extractContent() used to return that verbatim, which made the
	// handler's own extractTitle() dead code.
	withPage(fixture("fanfiction-chapter"), FF_CHAPTER_URL, () => {
		const result = new FanfictionHandler().extractContent();
		assertCleanExtraction(result, { title: "Ashes of the Ninth Gate" });
	});
});

// ─── FanFiction.net (mobile) ────────────────────────────────────────────────

const FF_MOBILE_CHAPTER_URL = "https://m.fanfiction.net/s/13456789/42/";

test("FanFiction mobile: only m.fanfiction.net, and only story URLs", () => {
	const html = fixture("fanfiction-mobile-chapter");
	withPage(html, FF_MOBILE_CHAPTER_URL, () => {
		const handler = new FanfictionMobileHandler();
		assert.equal(handler.canHandle(), true);
		assert.equal(handler.isChapterPage(), true);
	});
	withPage(html, "https://www.fanfiction.net/s/13456789/42/", () => {
		assert.equal(new FanfictionMobileHandler().canHandle(), false);
	});
	withPage(html, "https://m.fanfiction.net/u/999999/", () => {
		assert.equal(new FanfictionMobileHandler().isChapterPage(), false);
	});
});

test("FanFiction mobile: extraction reads #storycontent and the centred title", () => {
	withPage(fixture("fanfiction-mobile-chapter"), FF_MOBILE_CHAPTER_URL, () => {
		const result = new FanfictionMobileHandler().extractContent();
		assertCleanExtraction(result, { title: "Ashes of the Ninth Gate" });
	});
});

// ─── WebNovel ───────────────────────────────────────────────────────────────

const WEBNOVEL_CHAPTER_URL =
	"https://www.webnovel.com/book/ashes-ninth-gate_12345/chapter/2964516";

test("WebNovel: chapter and book pages are told apart", () => {
	const html = fixture("webnovel-chapter");
	withPage(html, WEBNOVEL_CHAPTER_URL, () => {
		const h = new WebNovelHandler();
		try {
			assert.equal(h.canHandle(), true);
			assert.equal(h.isChapterPage(), true);
		} finally {
			// Must happen *inside* withPage: the constructor starts a 1s poll that
			// reads `document`, and unmount() takes that global away. Cleaning up
			// after the mount leaves the interval alive to fire into nothing.
			h.cleanup();
		}
	});
});

test("WebNovel: extraction targets one chapter of the infinite-scroll stack", () => {
	withPage(fixture("webnovel-chapter"), WEBNOVEL_CHAPTER_URL, () => {
		const h = new WebNovelHandler();
		try {
			const result = h.extractChapterContent("2964516");
			assert.equal(result.found, true);
			assert.equal(result.title, "Chapter 42: The Long Road");
			assert.ok(result.text.includes(PROSE));
			assert.ok(
				!result.text.includes("The bell had been cast"),
				"the next chapter in the scroll stack must not bleed in",
			);
		} finally {
			h.cleanup();
		}
	});
});

test("WebNovel: constructing the handler off-site starts no timers", () => {
	// HandlerManager.loadHandlers() constructs *every* handler class on *every*
	// supported site to ask which one can handle the page. The chapter monitors
	// used to start unconditionally in the constructor, which left a 1s poll and
	// a document-wide MutationObserver running on Ranobes, AO3 and FanFiction
	// for the life of the tab.
	withPage(fixture("ranobes-chapter"), RANOBES_CHAPTER_URL, () => {
		const handler = new WebNovelHandler();
		assert.equal(handler.canHandle(), false);
		assert.equal(handler.urlPollTimer, null, "no interval off-site");
		assert.equal(handler.chapterObserver, null, "no observer off-site");
		assert.equal(handler.initialInjectTimer, null, "no timeout off-site");
	});
});

test("WebNovel: cleanup() is idempotent and clears both monitors", () => {
	withPage(fixture("webnovel-chapter"), WEBNOVEL_CHAPTER_URL, () => {
		const handler = new WebNovelHandler();
		assert.notEqual(handler.urlPollTimer, null, "on-site the poll should run");
		assert.notEqual(
			handler.initialInjectTimer,
			null,
			"on-site the deferred first sweep should be scheduled",
		);
		handler.cleanup();
		assert.equal(handler.urlPollTimer, null);
		assert.equal(handler.chapterObserver, null);
		assert.equal(handler.initialInjectTimer, null);
		handler.cleanup(); // must not throw
	});
});
