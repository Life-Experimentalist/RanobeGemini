/**
 * The chromium manifest is the single source of truth: the version, the
 * permissions, and the site match patterns are all owned there or derived from
 * the site handlers, and `dev/generate-manifest-domains.js` propagates them.
 *
 * That propagation is wrapped in a try/catch that only logs, and every derived
 * file is committed, so drift is silent — a hand-edited `package.json` version
 * or a new handler whose domain never reached the manifest both ship happily.
 * These tests read the committed files and assert the invariants directly.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const readJSON = (p) => JSON.parse(readFileSync(root(p), "utf8"));
const readText = (p) => readFileSync(root(p), "utf8");

const chromium = readJSON("src/manifest-chromium.json");
const firefox = readJSON("src/manifest-firefox.json");

const HANDLERS_DIR = root("src/utils/website-handlers");

/** The content-script entry whose matches are handler-derived. */
const siteEntry = (manifest) =>
	(manifest.content_scripts || []).find((cs) =>
		(cs.js || []).some((f) => f.endsWith("content/content.js")),
	);

// ── Version propagation ───────────────────────────────────────────────────────

test("the chromium manifest carries a valid version", () => {
	assert.match(chromium.version, /^\d+\.\d+\.\d+$/);
});

test("every derived surface carries the manifest's version", () => {
	const expected = chromium.version;
	assert.equal(firefox.version, expected, "src/manifest-firefox.json");
	assert.equal(readJSON("package.json").version, expected, "package.json");
	assert.equal(
		readJSON("src/library/manifest.webmanifest").version,
		expected,
		"src/library/manifest.webmanifest",
	);
	// The settings UI reads this generated constant, so a stale value is visible
	// to users as a wrong version number.
	const match = readText("src/config/build-version.js").match(
		/BUILD_VERSION\s*=\s*"([^"]+)"/,
	);
	assert.equal(match?.[1], expected, "src/config/build-version.js");
});

// ── Handler registration ──────────────────────────────────────────────────────

const handlerFiles = readdirSync(HANDLERS_DIR).filter(
	(f) => f.endsWith("-handler.js") && !f.startsWith("base"),
);

test("every handler file is listed in the generated registry", () => {
	const registry = readText("src/utils/website-handlers/handler-registry.js");
	for (const file of handlerFiles) {
		assert.ok(
			registry.includes(`"${file}"`),
			`${file} is not in handler-registry.js — run npm run build`,
		);
	}
});

test("the registry lists nothing that no longer exists", () => {
	const listed = [
		...readText("src/utils/website-handlers/handler-registry.js").matchAll(
			/"([^"]+\.js)"/g,
		),
	].map((m) => m[1]);
	assert.ok(listed.length > 0, "the registry is empty");
	for (const file of listed) {
		assert.ok(handlerFiles.includes(file), `${file} is registered but missing`);
	}
});

// ── Domain coverage ───────────────────────────────────────────────────────────

/** Every domain declared by a handler, the way the generator reads them. */
function declaredDomains() {
	const domains = new Set();
	for (const file of handlerFiles) {
		const source = readFileSync(`${HANDLERS_DIR}/${file}`, "utf8");
		const block = source.match(/static\s+SUPPORTED_DOMAINS\s*=\s*\[([\s\S]*?)\]/);
		if (!block) continue;
		for (const quoted of block[1].match(/"([^"]+)"|'([^']+)'/g) || []) {
			const domain = quoted.replace(/["']/g, "").trim();
			if (domain && !domain.startsWith("//") && !domain.startsWith("*")) {
				domains.add(domain);
			}
		}
	}
	return [...domains];
}

/** Does `*://*.example.com/*` cover `www.example.com`? */
function covers(pattern, domain) {
	const host = pattern.replace(/^\*:\/\/\*\./, "").replace(/\/\*$/, "");
	return domain === host || domain.endsWith(`.${host}`);
}

const DOMAINS = declaredDomains();

test("handlers declare domains at all", () => {
	// The generator throws on an empty set; this catches the subtler case of the
	// regex silently stopping to match after a refactor of the handler shape.
	assert.ok(DOMAINS.length >= handlerFiles.length - 1, DOMAINS.join(", "));
});

for (const [name, manifest] of [
	["chromium", chromium],
	["firefox", firefox],
]) {
	test(`${name}: every handler domain is covered by a content-script match`, () => {
		const matches = siteEntry(manifest)?.matches || [];
		for (const domain of DOMAINS) {
			assert.ok(
				matches.some((p) => covers(p, domain)),
				`${domain} has a handler but no match pattern — the content script never runs there`,
			);
		}
	});

	test(`${name}: optional host permissions track the content-script matches`, () => {
		// Site access is requested at runtime against these patterns; a mismatch
		// makes the permission request fail with nothing to grant.
		assert.deepEqual(
			[...(manifest.optional_host_permissions || [])].sort(),
			[...(siteEntry(manifest)?.matches || [])].sort(),
		);
	});

	test(`${name}: web-accessible resources are exposed on the same origins`, () => {
		assert.deepEqual(
			[...(manifest.web_accessible_resources?.[0]?.matches || [])].sort(),
			[...(siteEntry(manifest)?.matches || [])].sort(),
		);
	});
}

// ── Cross-platform agreement ──────────────────────────────────────────────────

test("both manifests match the same sites", () => {
	assert.deepEqual(siteEntry(chromium)?.matches, siteEntry(firefox)?.matches);
});

test("both manifests expose the same web-accessible resources", () => {
	assert.deepEqual(
		chromium.web_accessible_resources?.[0]?.resources,
		firefox.web_accessible_resources?.[0]?.resources,
	);
});

test("permissions differ only by the documented platform additions", () => {
	// Chromium's service worker has no DOM, so it alone needs `offscreen`, and
	// its side panel needs `sidePanel` where Firefox's `sidebar_action` needs
	// no permission at all. Any third divergence is a mistake, not a platform
	// difference — which is the whole reason this list is asserted exactly.
	const extra = chromium.permissions.filter(
		(p) => !firefox.permissions.includes(p),
	);
	assert.deepEqual(extra, ["offscreen", "sidePanel"]);
	assert.deepEqual(
		firefox.permissions.filter((p) => !chromium.permissions.includes(p)),
		[],
	);
});

test("the side_panel key and the sidePanel permission ship together", () => {
	// Chrome does not register a side panel from `default_path` alone. Declaring
	// one without the other is silently broken in one direction and a
	// declared-but-unused permission in the other.
	assert.equal(
		Boolean(chromium.side_panel?.default_path),
		chromium.permissions.includes("sidePanel"),
		"chromium: side_panel and the sidePanel permission must both be present or both absent",
	);
	assert.ok(
		!firefox.permissions.includes("sidePanel"),
		"firefox uses sidebar_action and must not declare Chrome's sidePanel permission",
	);
});

test("no permission is declared without a caller", () => {
	// Every entry here was traced to a call site. Adding one to the manifest
	// without adding it here is the reminder to go find its caller first —
	// `activeTab` sat in both manifests for months with no `scripting.*` call
	// anywhere in the codebase to make it mean anything.
	const justified = new Set([
		"alarms", // scheduled backups, incognito expiry
		"contextMenus", // right-click actions on supported pages
		"downloads", // background rolling backup (utils/download-data.js)
		"identity", // launchWebAuthFlow for cloud sync
		"notifications", // long background job completion
		"offscreen", // chromium DOM/XML parsing
		"sidePanel", // chromium side_panel manifest key
		"storage", // settings, library, cache
		"tabs", // locating the reading tab, opening library pages
	]);
	for (const manifest of [firefox, chromium]) {
		for (const permission of manifest.permissions) {
			assert.ok(
				justified.has(permission),
				`${permission} is declared but has no recorded caller`,
			);
		}
	}
});

test("host_permissions cover the endpoints fetched unconditionally", () => {
	// The Gemini endpoint is the extension's primary function and went
	// undeclared for a long time, working only because Google serves it with
	// permissive CORS headers. Opt-in and user-typed endpoints are deliberately
	// absent — see HOST_PERMISSIONS in dev/generate-manifest-domains.js.
	for (const manifest of [firefox, chromium]) {
		assert.deepEqual(manifest.host_permissions, [
			"https://generativelanguage.googleapis.com/*",
			"https://oauth2.googleapis.com/*",
			"https://www.googleapis.com/*",
		]);
	}
});

test("both manifests request the same host permissions", () => {
	assert.deepEqual(chromium.host_permissions, firefox.host_permissions);
});

test("both manifests enforce the same extension-page CSP", () => {
	const csp = (m) => m.content_security_policy?.extension_pages;
	assert.ok(csp(chromium), "chromium has no extension_pages CSP");
	assert.equal(csp(chromium), csp(firefox));
	// The directives MV3 does not default are the point of declaring it at all.
	for (const directive of [
		"object-src 'none'",
		"frame-ancestors 'none'",
		"base-uri 'none'",
		"form-action 'none'",
	]) {
		assert.ok(csp(chromium).includes(directive), `CSP lost ${directive}`);
	}
});

// ── The landing bridge ────────────────────────────────────────────────────────

/** The content-script entry that carries the landing-page bridge. */
const landingEntry = (manifest) =>
	(manifest.content_scripts || []).find((cs) =>
		(cs.js || []).some((f) => f.endsWith("content/landing-bridge.js")),
	);

test("one origin drives the OAuth redirect, the sender guard, and both manifests", () => {
	// `OAUTH_REDIRECT_URIS.web` in constants.js is the only place this origin is
	// authored. background.js derives its `LANDING_ORIGIN` guard from it, and
	// dev/generate-manifest-domains.js stamps the bridge matches from it. If the
	// guard and the matches ever disagree, the bridge runs on a page the worker
	// then refuses to hear — an OAuth flow that hangs with no error anywhere.
	const redirect = readText("src/utils/constants.js").match(
		/web:\s*"([^"]+)"/,
	)?.[1];
	assert.ok(redirect, "OAUTH_REDIRECT_URIS.web not found in constants.js");
	const origin = new URL(redirect).origin;

	assert.match(
		readText("src/background/background.js"),
		/const LANDING_ORIGIN = new URL\(OAUTH_REDIRECT_URIS\.web\)\.origin;/,
		"background.js re-types the landing origin instead of deriving it",
	);

	for (const [name, manifest] of [
		["chromium", chromium],
		["firefox", firefox],
	]) {
		assert.deepEqual(
			landingEntry(manifest)?.matches,
			[`${origin}/*`],
			`${name}: landing-bridge matches drifted from constants.js`,
		);
		// It has to read the OAuth response before the page's own script strips it
		// from the address bar, so document_idle would be too late.
		assert.equal(landingEntry(manifest)?.run_at, "document_start", name);
	}
});

test("no manifest re-opens the externally_connectable channel", () => {
	// The bridge replaced `externally_connectable`, which had shipped with
	// `ids: ["*"]` — any extension could message this worker — and never worked on
	// Gecko for web pages anyway. Re-adding the key would restore both problems.
	for (const [name, manifest] of [
		["chromium", chromium],
		["firefox", firefox],
	]) {
		assert.equal(manifest.externally_connectable, undefined, name);
	}
});

test("no manifest grants a broad host permission", () => {
	for (const [name, manifest] of [
		["chromium", chromium],
		["firefox", firefox],
	]) {
		for (const pattern of manifest.host_permissions || []) {
			assert.ok(
				!/^\*:\/\/\*\/\*$|<all_urls>/.test(pattern),
				`${name} requests ${pattern} unconditionally`,
			);
		}
	}
});
