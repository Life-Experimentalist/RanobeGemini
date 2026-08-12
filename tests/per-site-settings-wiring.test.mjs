/**
 * A handler's `SETTINGS_DEFINITION.fields` and its `getProposedLibrarySettings()`
 * are two unrelated lists that look interchangeable. The Library settings page
 * renders the former and saves it into the per-site settings store keyed by
 * shelf id; the `getHandlerSettings` background message returns the latter,
 * keyed by domain.
 *
 * Reading one from the other is the bug these tests exist to catch, and it is
 * invisible at runtime: the lookup simply returns undefined, so the custom CSS,
 * font size, and typeface a user configured per site do nothing at all and
 * nothing is logged. That shipped once already.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { READING_FONTS } from "../src/utils/constants.js";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const readText = (p) => readFileSync(root(p), "utf8");

const HANDLERS_WITH_READING_FONT = [
	"src/utils/website-handlers/scribblehub-handler.js",
	"src/utils/website-handlers/ranobes-handler.js",
];

test("content.js reads per-site fields from the store the Library writes to", () => {
	const src = readText("src/content/content.js");
	const fn = src.slice(
		src.indexOf("async function injectHandlerCustomCSS()"),
		src.indexOf("async function loadUIElementsRuntimeModule()"),
	);
	assert.ok(fn.length > 0, "injectHandlerCustomCSS() not found");

	assert.match(
		fn,
		/siteSettings\[handlerShelfId\]/,
		"per-site fields must be read from the site settings store by shelf id",
	);
	assert.doesNotMatch(
		fn,
		/getHandlerSettings/,
		"getHandlerSettings returns the metadata-only proposed schema keyed by domain — it never contains SETTINGS_DEFINITION values",
	);
});

test("every per-site field content.js consumes is declared by some handler", async () => {
	const src = readText("src/content/content.js");
	const fn = src.slice(
		src.indexOf("async function injectHandlerCustomCSS()"),
		src.indexOf("async function loadUIElementsRuntimeModule()"),
	);

	// The keys the content script pulls off the per-site settings object.
	const consumed = new Set(
		[...fn.matchAll(/handlerSettings\.(\w+)/g)].map((m) => m[1]),
	);
	assert.ok(
		consumed.size > 0,
		"no per-site keys consumed — did the shape change?",
	);

	const { HANDLER_MODULES } =
		await import("../src/utils/website-handlers/handler-registry.js");
	const declared = new Set();
	for (const file of HANDLER_MODULES) {
		const mod = await import(`../src/utils/website-handlers/${file}`);
		for (const exported of Object.values(mod)) {
			for (const field of exported?.SETTINGS_DEFINITION?.fields || []) {
				declared.add(field.key);
			}
		}
	}

	for (const key of consumed) {
		assert.ok(
			declared.has(key),
			`content.js reads "${key}" but no handler declares it in SETTINGS_DEFINITION — the branch is dead`,
		);
	}
});

test("per-site typeface options stay in step with the shared font list", async () => {
	const ids = READING_FONTS.map((f) => f.id).join(",");

	for (const path of HANDLERS_WITH_READING_FONT) {
		const mod = await import(`../${path}`);
		const H = Object.values(mod).find((v) => v?.SETTINGS_DEFINITION);
		assert.ok(H, `${path}: no exported handler with SETTINGS_DEFINITION`);

		const field = H.SETTINGS_DEFINITION.fields.find(
			(f) => f.key === "readingFont",
		);
		assert.ok(field, `${path}: declares no readingFont field`);
		assert.equal(field.type, "select");
		assert.equal(
			field.options.map((o) => o.value).join(","),
			ids,
			`${path}: readingFont options drifted from READING_FONTS — build them from the shared list`,
		);
	}
});
