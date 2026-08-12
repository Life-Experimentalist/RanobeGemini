/**
 * Mount a page of HTML so a website handler can be run against it in Node.
 *
 * Website handlers are the layer most exposed to breakage in this codebase:
 * each supported site can change its markup at any time without telling us, and
 * the only thing standing between that and a silent extraction failure is a list
 * of CSS selectors. Those selectors were untested because running a handler
 * needs a DOM, and `node --test` has none.
 *
 * `linkedom` supplies the DOM. It is a devDependency and never ships in the
 * extension. It covers everything the handlers actually touch — `querySelector`,
 * `classList`, `dataset`, `closest`, `cloneNode`, `innerText`,
 * `getBoundingClientRect` — so no part of the DOM is faked here, which matters:
 * a hand-rolled shim would be a second implementation to be wrong, and a test
 * that passes against a wrong shim is worse than no test.
 *
 * The fixtures under `tests/fixtures/` are *reduced* pages: the real structural
 * skeleton of each site (the selectors, nesting, and attributes the handler
 * navigates) with the bulk of the prose and all of the advertising, tracking,
 * and styling removed. They are not byte-exact captures, and they should not be
 * — a 400 KB verbatim page would make the failure message unreadable and would
 * pin a thousand details nobody is asserting.
 */

import { parseHTML } from "linkedom";

import { setPageUrlOverride } from "../../src/utils/dom-env.js";

/** Globals a mount replaces, so `unmount()` can put back exactly what it found. */
const MANAGED_GLOBALS = [
	"window",
	"document",
	"DOMParser",
	"Node",
	"Element",
	"HTMLElement",
	"NodeFilter",
	"MutationObserver",
	"getComputedStyle",
	"browser",
];

/**
 * Viewport size reported to handlers. linkedom leaves `innerHeight` undefined,
 * and the WebNovel handler picks the "currently visible" chapter with
 * `rect.top <= window.innerHeight / 2` — against `undefined` that comparison is
 * `NaN`, silently false, and the handler falls through to a different branch
 * than the one a real browser would take. A concrete number keeps the test on
 * the same code path as production.
 */
const VIEWPORT = { width: 1280, height: 800 };

/**
 * Minimal `browser` stand-in. Handlers do not call the extension APIs
 * themselves, but they import `debugLog`, which reads the debug-mode flag from
 * `browser.storage.local`. Without this the first log call throws and the
 * failure looks like a selector bug.
 */
function makeFakeBrowser() {
	const local = new Map();
	return {
		storage: {
			local: {
				get: async (keys) => {
					const wanted =
						typeof keys === "string"
							? [keys]
							: Array.isArray(keys)
								? keys
								: Object.keys(keys || {});
					const out = {};
					for (const key of wanted) {
						if (local.has(key)) out[key] = local.get(key);
					}
					return out;
				},
				set: async (items) => {
					for (const [key, value] of Object.entries(items)) {
						local.set(key, value);
					}
				},
				remove: async (keys) => {
					for (const key of [].concat(keys)) local.delete(key);
				},
			},
		},
		runtime: {
			getURL: (p) => `moz-extension://test/${p}`,
			sendMessage: async () => ({}),
		},
	};
}

/**
 * @param {string} html Fixture markup.
 * @param {string} url The URL the handler should believe it is on. Handlers
 *   derive novel IDs, canonical URLs, and `isChapterPage()` from this, so it is
 *   part of the fixture, not decoration.
 * @returns {{document: Document, window: Window, unmount: () => void}}
 */
export function mountPage(html, url) {
	const saved = new Map();
	for (const name of MANAGED_GLOBALS) {
		saved.set(name, Object.hasOwn(globalThis, name) ? globalThis[name] : undefined);
	}

	const dom = parseHTML(html);

	globalThis.window = dom.window;
	globalThis.document = dom.document;
	globalThis.DOMParser = dom.DOMParser;
	globalThis.Node = dom.Node;
	globalThis.Element = dom.Element;
	globalThis.HTMLElement = dom.HTMLElement;
	globalThis.NodeFilter = dom.NodeFilter;
	globalThis.MutationObserver = dom.MutationObserver;
	globalThis.getComputedStyle = dom.window.getComputedStyle?.bind(dom.window);
	globalThis.browser = makeFakeBrowser();

	try {
		dom.window.innerWidth = VIEWPORT.width;
		dom.window.innerHeight = VIEWPORT.height;
	} catch {
		// Read-only on some linkedom versions; the handlers that read it all
		// have a fallback branch, so this is not worth failing a mount over.
	}

	// Handlers read the page URL through `pageLocation()` rather than
	// `window.location`, precisely so it can be pointed somewhere else — the
	// background does the same thing when it scrapes a fetched document.
	setPageUrlOverride(url);

	return {
		document: dom.document,
		window: dom.window,
		unmount() {
			setPageUrlOverride(null);
			for (const name of MANAGED_GLOBALS) {
				const value = saved.get(name);
				if (value === undefined) delete globalThis[name];
				else globalThis[name] = value;
			}
		},
	};
}

/**
 * Run `fn` with a fixture mounted, and unmount even if it throws. Without the
 * `finally`, one failing assertion leaves a stale `document` global behind and
 * every later test in the file fails for the wrong reason.
 *
 * @template T
 * @param {string} html
 * @param {string} url
 * @param {(ctx: {document: Document, window: Window}) => T} fn
 * @returns {T}
 */
export function withPage(html, url, fn) {
	const page = mountPage(html, url);
	try {
		return fn(page);
	} finally {
		page.unmount();
	}
}
