/**
 * The LoreWeave gate is the single switch that decides whether the experimental
 * integration exists. These tests pin the three properties everything else
 * depends on: off by default, fail-closed, and honestly persisted.
 */

import test from "node:test";
import assert from "node:assert/strict";

const GATE_URL = new URL("../src/utils/loreweave-gate.js", import.meta.url).href;
const CONSTANTS_URL = new URL("../src/utils/constants.js", import.meta.url).href;

/**
 * Install a `browser.storage.local` double.
 *
 * @param {object|Error} state - Seed contents, or an Error to throw on access.
 */
function installLocalStorage(state = {}) {
	const previous = globalThis.browser;
	const store = state instanceof Error ? null : new Map(Object.entries(state));

	globalThis.browser = {
		storage: {
			local: {
				async get(keys) {
					if (state instanceof Error) throw state;
					const list = Array.isArray(keys) ? keys : [keys];
					const out = {};
					for (const key of list) {
						if (store.has(key)) out[key] = store.get(key);
					}
					return out;
				},
				async set(items) {
					if (state instanceof Error) throw state;
					for (const [key, value] of Object.entries(items)) {
						store.set(key, value);
					}
				},
			},
		},
	};

	return {
		dump: () => (store ? Object.fromEntries(store) : {}),
		restore: () => {
			globalThis.browser = previous;
		},
	};
}

test("ships switched off", async () => {
	const { LOREWEAVE_EXPERIMENTAL_ENABLED } = await import(CONSTANTS_URL);
	assert.equal(
		LOREWEAVE_EXPERIMENTAL_ENABLED,
		false,
		"LoreWeave must default to off — it is a separate, still-maturing project",
	);
});

test("an unset preference falls back to the shipped default", async () => {
	const fake = installLocalStorage({});
	try {
		const { isLoreWeaveEnabled } = await import(GATE_URL);
		assert.equal(await isLoreWeaveEnabled(), false);
	} finally {
		fake.restore();
	}
});

test("an explicit opt-in is honoured", async () => {
	const fake = installLocalStorage({ loreWeaveExperimental: true });
	try {
		const { isLoreWeaveEnabled } = await import(GATE_URL);
		assert.equal(await isLoreWeaveEnabled(), true);
	} finally {
		fake.restore();
	}
});

test("a non-boolean stored value is ignored rather than coerced", async () => {
	// A truthy string must not switch the integration on by accident.
	const fake = installLocalStorage({ loreWeaveExperimental: "yes" });
	try {
		const { isLoreWeaveEnabled } = await import(GATE_URL);
		assert.equal(await isLoreWeaveEnabled(), false);
	} finally {
		fake.restore();
	}
});

test("fails closed when storage is unreadable", async () => {
	const fake = installLocalStorage(new Error("storage unavailable"));
	try {
		const { isLoreWeaveEnabled } = await import(GATE_URL);
		assert.equal(await isLoreWeaveEnabled(), false);
	} finally {
		fake.restore();
	}
});

test("setLoreWeaveEnabled stores a boolean, not the raw argument", async () => {
	const fake = installLocalStorage({});
	try {
		const { setLoreWeaveEnabled, LOREWEAVE_EXPERIMENTAL_KEY } =
			await import(GATE_URL);
		await setLoreWeaveEnabled("truthy string");
		assert.equal(fake.dump()[LOREWEAVE_EXPERIMENTAL_KEY], true);
		await setLoreWeaveEnabled(0);
		assert.equal(fake.dump()[LOREWEAVE_EXPERIMENTAL_KEY], false);
	} finally {
		fake.restore();
	}
});

test("the network client refuses to send while the gate is off", async () => {
	const fake = installLocalStorage({ loreWeaveExperimental: false });
	const previousFetch = globalThis.fetch;
	let fetched = false;
	globalThis.fetch = async () => {
		fetched = true;
		throw new Error("fetch should never be reached");
	};
	try {
		const { postIngestDelta, pingLoreWeave } = await import(
			new URL(
				"../src/background/loreweave/loreweave-client.js",
				import.meta.url,
			).href
		);
		await assert.rejects(
			() => postIngestDelta("https://example.invalid", {}, ""),
			/experimental/i,
		);
		assert.equal(await pingLoreWeave("https://example.invalid"), false);
		assert.equal(fetched, false, "no request may leave the browser");
	} finally {
		globalThis.fetch = previousFetch;
		fake.restore();
	}
});
