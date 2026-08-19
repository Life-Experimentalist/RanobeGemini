/**
 * The bundled typefaces are the one part of this extension that ships binary
 * third-party content, so two things have to hold and neither is visible in a
 * diff: every face offered in the settings actually exists on disk, and every
 * one of them carries its licence.
 *
 * The failure these tests exist to catch is silent. A missing .woff2 does not
 * throw anywhere — the @font-face simply never loads and the reader gets the
 * site's own font while the dropdown claims otherwise. A missing OFL.txt is
 * worse: it is a redistribution problem that no runtime will ever report.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { READING_FONTS, getReadingFontStack } from "../src/utils/constants.js";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const readText = (p) => readFileSync(root(p), "utf8");
const readJSON = (p) => JSON.parse(readText(p));

const EXT_FONT_DIR = "src/fonts";
const LANDING_FONT_DIR = "landing/assets/fonts";

/** The `url("./x.woff2")` targets a stylesheet actually asks the browser for. */
const referencedFiles = (css) =>
	[...css.matchAll(/url\("\.\/([^"]+)"\)/g)].map((m) => m[1]);

/** The family names a stylesheet declares faces for. */
const declaredFamilies = (css) =>
	new Set(
		[...css.matchAll(/font-family:\s*"([^"]+)"/g)].map((m) => m[1]),
	);

test("every bundled reading font has its files on disk", () => {
	const css = readText(`${EXT_FONT_DIR}/fonts.css`);
	const families = declaredFamilies(css);

	for (const font of READING_FONTS.filter((f) => f.bundled)) {
		// The first entry of the stack is the family the @font-face declares;
		// the rest are fallbacks that must never be relied on.
		const family = font.stack.match(/^"([^"]+)"/)?.[1];
		assert.ok(
			family,
			`${font.id}: a bundled font must name its family first and in quotes`,
		);
		assert.ok(
			families.has(family),
			`${font.id}: src/fonts/fonts.css declares no @font-face for "${family}" — the dropdown would offer a face that never loads`,
		);
	}
});

test("no reading font is offered without a stack, and unknown ids fall back", () => {
	for (const font of READING_FONTS) {
		assert.equal(typeof font.note, "string");
		assert.ok(font.note.length > 0, `${font.id}: missing note`);
		if (font.bundled) {
			assert.ok(font.stack, `${font.id}: bundled but has no stack`);
		}
	}

	// An id saved by a newer build must degrade to the site's own font rather
	// than to a broken stack.
	assert.equal(getReadingFontStack("no-such-font-id"), "");
	assert.equal(getReadingFontStack(undefined), "");
});

test("both font stylesheets only reference files that exist", () => {
	for (const dir of [EXT_FONT_DIR, LANDING_FONT_DIR]) {
		const css = readText(`${dir}/fonts.css`);
		const files = referencedFiles(css);
		assert.ok(files.length > 0, `${dir}/fonts.css references no font files`);
		for (const file of files) {
			assert.ok(
				existsSync(root(`${dir}/${file}`)),
				`${dir}/fonts.css asks for ${file}, which is not committed`,
			);
		}
	}
});

test("no font ships without its licence, and none is orphaned", () => {
	for (const dir of [EXT_FONT_DIR, LANDING_FONT_DIR]) {
		const entries = readdirSync(root(dir));
		const licences = entries.filter((f) => /^OFL-.*\.txt$/.test(f));
		assert.ok(licences.length > 0, `${dir}: no OFL licence text committed`);

		for (const licence of licences) {
			assert.match(
				readText(`${dir}/${licence}`),
				/SIL OPEN FONT LICENSE/i,
				`${dir}/${licence} is not the SIL OFL`,
			);
		}

		// Every .woff2 is named `<slug>-<weight>-<subset>.woff2` and every slug
		// must have a matching OFL-<slug>.txt beside it.
		const slugs = new Set(
			entries
				.filter((f) => f.endsWith(".woff2"))
				.map((f) => f.split("-")[0]),
		);
		for (const slug of slugs) {
			assert.ok(
				entries.includes(`OFL-${slug}.txt`),
				`${dir}: ${slug}.woff2 files ship with no OFL-${slug}.txt`,
			);
		}

		// And the reverse — a licence with no font left behind by a purge.
		const css = readText(`${dir}/fonts.css`);
		const referenced = new Set(referencedFiles(css));
		for (const file of entries.filter((f) => f.endsWith(".woff2"))) {
			assert.ok(
				referenced.has(file),
				`${dir}: ${file} is committed but no @font-face uses it`,
			);
		}
	}
});

test("the extension can actually load its own fonts", () => {
	for (const name of ["chromium", "firefox"]) {
		const manifest = readJSON(`src/manifest-${name}.json`);

		const site = (manifest.content_scripts || []).find((cs) =>
			(cs.js || []).some((f) => f.endsWith("content/content.js")),
		);
		assert.ok(
			(site?.css || []).includes("fonts/fonts.css"),
			`${name}: the site content script does not inject fonts/fonts.css`,
		);

		// The stylesheet's url() references resolve against the extension
		// origin, so without this the host page cannot fetch a single face.
		const war = (manifest.web_accessible_resources || []).flatMap(
			(entry) => entry.resources || [],
		);
		assert.ok(
			war.includes("fonts/*.woff2"),
			`${name}: fonts/*.woff2 is not web-accessible — every @font-face would fail silently`,
		);
	}
});

test("the landing site does not call out to Google for fonts", () => {
	const dir = root("landing");
	for (const file of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
		const html = readFileSync(`${dir}/${file}`, "utf8");
		assert.doesNotMatch(
			html,
			/fonts\.(googleapis|gstatic)\.com/,
			`landing/${file} still loads a font from Google — that leaks every visitor's IP and blocks first paint`,
		);
	}
});
