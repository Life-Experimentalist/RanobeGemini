/**
 * The theme layer is the only writer of `body[data-bg-animation]`, which both
 * the CSS animations and the canvas engine key off. That link was missing for
 * a long time: presets declared an animation, the stylesheets and the engine
 * were shipped, and nothing ever set the attribute — so the feature was inert
 * with no error anywhere to show for it. These tests pin the wiring.
 */

import test from "node:test";
import assert from "node:assert/strict";

/** The parts of the DOM `setThemeVariables` touches. */
function installDom({ withBody = true } = {}) {
	const el = () => {
		const attrs = new Map();
		return {
			attrs,
			style: { setProperty: () => {}, removeProperty: () => {} },
			setAttribute: (k, v) => attrs.set(k, v),
			removeAttribute: (k) => attrs.delete(k),
			getAttribute: (k) => attrs.get(k) ?? null,
		};
	};
	const documentElement = el();
	const body = withBody ? el() : null;
	const domListeners = new Map();

	globalThis.document = {
		documentElement,
		body,
		addEventListener: (type, fn) => domListeners.set(type, fn),
	};
	globalThis.window = { matchMedia: undefined };

	return {
		documentElement,
		body,
		/** Fire DOMContentLoaded and hand back the body that then exists. */
		ready: (lateBody) => {
			globalThis.document.body = lateBody;
			domListeners.get("DOMContentLoaded")?.();
			return lateBody;
		},
	};
}

const { setThemeVariables, THEME_PRESETS } = await (async () => {
	installDom();
	return import("../src/utils/theme-config.js");
})();

const animationOf = (dom) => dom.body.getAttribute("data-bg-animation");

// ── The attribute the animations key off ──────────────────────────────────────

test("a theme with no animation still declares the attribute", () => {
	// "none" rather than a missing attribute: the CSS has a `[data-bg-animation]`
	// base rule, and the engine's observer only fires on a change.
	const dom = installDom();
	setThemeVariables({ mode: "dark" });
	assert.equal(animationOf(dom), "none");
});

test("the theme's animation reaches the body", () => {
	const dom = installDom();
	setThemeVariables({ mode: "dark", bgAnimation: "falling-leaves" });
	assert.equal(animationOf(dom), "falling-leaves");
});

test("switching themes replaces the previous animation", () => {
	// The engine diffs against the running animation, so a stale value here
	// leaves the old canvas running under the new theme.
	const dom = installDom();
	setThemeVariables({ mode: "dark", bgAnimation: "snow" });
	setThemeVariables({ mode: "light", bgAnimation: "waves" });
	assert.equal(animationOf(dom), "waves");
	setThemeVariables({ mode: "light" });
	assert.equal(animationOf(dom), "none");
});

test("a theme applied before <body> exists is applied once it does", () => {
	// Pages apply the theme from <head> to avoid a flash of the default palette.
	const dom = installDom({ withBody: false });
	setThemeVariables({ mode: "dark", bgAnimation: "fireflies" });

	const lateBody = installDom().body;
	dom.ready(lateBody);
	assert.equal(lateBody.getAttribute("data-bg-animation"), "fireflies");
});

// ── Preset metadata ───────────────────────────────────────────────────────────

test("every preset animation is one the engine or the CSS implements", () => {
	// A preset naming an animation nobody implements silently renders nothing.
	const IMPLEMENTED = new Set([
		// utils/bg-animation.js
		"particles",
		"falling-leaves",
		"snow",
		"rain",
		"fireflies",
		// library/websites/bg-animations.css
		"waves",
		"leaves",
		"shimmer",
		"none",
	]);

	for (const [id, preset] of Object.entries(THEME_PRESETS)) {
		const animation = preset?.meta?.animation;
		if (!animation) continue;
		assert.ok(
			IMPLEMENTED.has(animation),
			`preset "${id}" declares an unimplemented animation: ${animation}`,
		);
	}
});
