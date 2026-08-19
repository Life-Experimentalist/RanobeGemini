/**
 * The landing bridge is the extension's only page-facing entry point. It runs on
 * the project site and listens to `postMessage`, so its guards are the whole of
 * the trust boundary: anything that gets past them reaches `runtime.sendMessage`
 * and, from there, the background script.
 *
 * It is a content script with no exports, so these tests install a minimal
 * window/browser environment and import it for its side effects — which is also
 * what the browser does.
 */

import test from "node:test";
import assert from "node:assert/strict";

const BRIDGE_URL = new URL(
	"../src/content/landing-bridge.js",
	import.meta.url,
).href;

const PAGE_ORIGIN = "https://ranobegemini.example";

let loadCount = 0;

/**
 * Install the globals the bridge touches and import a fresh copy of it.
 * The query string defeats the ES module cache so each scenario starts clean.
 */
async function loadBridge({ search = "", hash = "", manifest = { version: "5.0.0" } } = {}) {
	const posted = [];
	const sent = [];
	let listener = null;

	globalThis.window = {
		addEventListener: (type, fn) => {
			if (type === "message") listener = fn;
		},
		postMessage: (message, targetOrigin) => posted.push({ message, targetOrigin }),
		location: { origin: PAGE_ORIGIN, search, hash },
	};
	globalThis.document = { documentElement: { dataset: {} } };
	globalThis.browser = {
		runtime: {
			getManifest: () => {
				if (!manifest) throw new Error("Extension context invalidated");
				return manifest;
			},
			getURL: (path) => `moz-extension://test-id/${path}`,
			sendMessage: async (message) => {
				sent.push(message);
				return { success: true };
			},
		},
	};

	await import(`${BRIDGE_URL}?load=${loadCount++}`);

	return {
		posted,
		sent,
		dataset: globalThis.document.documentElement.dataset,
		/** Deliver a message event, defaulting every field to a valid one. */
		fire: ({ source, origin, data } = {}) =>
			listener({
				source: source === undefined ? globalThis.window : source,
				origin: origin === undefined ? PAGE_ORIGIN : origin,
				data:
					data === null
						? null
						: {
								channel: "ranobe-gemini",
								direction: "to-extension",
								...data,
							},
			}),
	};
}

/** Let the bridge's promise chains settle. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// ── Presence ──────────────────────────────────────────────────────────────────

test("presence is announced as the installed version", async () => {
	const bridge = await loadBridge();
	assert.equal(bridge.dataset.ranobeGemini, "5.0.0");
});

test("an invalidated extension context leaves presence unannounced", async () => {
	// Happens when the extension updates while the page is open. Throwing here
	// would abort the module and take the message listener down with it.
	const bridge = await loadBridge({ manifest: null });
	assert.equal(bridge.dataset.ranobeGemini, undefined);
});

// ── The trust boundary ────────────────────────────────────────────────────────

test("a ping from the page itself is answered", async () => {
	const bridge = await loadBridge();
	bridge.fire({ data: { op: "ping", id: 7 } });

	assert.equal(bridge.posted.length, 1);
	const { message, targetOrigin } = bridge.posted[0];
	assert.equal(message.op, "ping");
	assert.equal(message.id, 7);
	assert.equal(message.installed, true);
	assert.equal(message.version, "5.0.0");
	assert.equal(message.direction, "from-extension");
	assert.match(message.libraryUrl, /library\/library\.html$/);
	// Never broadcast to "*": the reply carries the extension's own URL.
	assert.equal(targetOrigin, PAGE_ORIGIN);
});

test("messages that fail any guard are ignored silently", async () => {
	const bridge = await loadBridge();
	const valid = { op: "ping", id: 1 };

	const rejected = [
		["a different window", { source: {}, data: valid }],
		["a cross-origin sender", { origin: "https://evil.example", data: valid }],
		["another channel", { data: { ...valid, channel: "something-else" } }],
		["the extension's own replies", { data: { ...valid, direction: "from-extension" } }],
		["an unlisted operation", { data: { ...valid, op: "eval" } }],
		["no operation at all", { data: { ...valid, op: undefined } }],
		["an empty payload", { data: null }],
	];

	for (const [name, event] of rejected) {
		bridge.posted.length = 0;
		bridge.sent.length = 0;
		bridge.fire(event);
		await tick();
		assert.equal(bridge.posted.length, 0, `${name} was answered`);
		assert.equal(bridge.sent.length, 0, `${name} reached the background script`);
	}
});

test("a cross-origin message cannot open the library", async () => {
	// The one operation with a side effect outside the page.
	const bridge = await loadBridge();
	bridge.fire({
		origin: "https://evil.example",
		data: { op: "openLibrary", id: 2 },
	});
	await tick();
	assert.deepEqual(bridge.sent, []);
});

test("openLibrary is forwarded and its outcome reported back", async () => {
	const bridge = await loadBridge();
	bridge.fire({ data: { op: "openLibrary", id: 3 } });
	await tick();

	assert.deepEqual(bridge.sent, [{ action: "openLibrary" }]);
	assert.deepEqual(bridge.posted[0].message, {
		channel: "ranobe-gemini",
		direction: "from-extension",
		id: 3,
		op: "openLibrary",
		success: true,
	});
});

test("a failure to open the library is reported, not thrown", async () => {
	const bridge = await loadBridge();
	globalThis.browser.runtime.sendMessage = async () => {
		throw new Error("background asleep");
	};
	bridge.fire({ data: { op: "openLibrary", id: 4 } });
	await tick();

	assert.equal(bridge.posted[0].message.success, false);
	assert.equal(bridge.posted[0].message.error, "background asleep");
});

// ── OAuth relay ───────────────────────────────────────────────────────────────

test("an authorization code in the query string is relayed with its state", async () => {
	const bridge = await loadBridge({ search: "?code=abc123&state=xyz" });
	assert.deepEqual(bridge.sent, [
		{ action: "oauthTabRelay", state: "xyz", authorizationCode: "abc123" },
	]);
});

test("an authorization code in the fragment is relayed too", async () => {
	// Implicit-style responses put the parameters after the hash.
	const bridge = await loadBridge({ hash: "#code=abc123&state=xyz" });
	assert.deepEqual(bridge.sent, [
		{ action: "oauthTabRelay", state: "xyz", authorizationCode: "abc123" },
	]);
});

test("a code with no state is not relayed", async () => {
	// The background matches `state` against its pending flows; relaying a code
	// without one would hand the background something it cannot attribute.
	const bridge = await loadBridge({ search: "?code=abc123" });
	assert.deepEqual(bridge.sent, []);
});

test("an ordinary page visit relays nothing", async () => {
	const bridge = await loadBridge({ search: "?utm_source=newsletter" });
	assert.deepEqual(bridge.sent, []);
});
