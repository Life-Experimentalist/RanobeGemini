/**
 * Story Chat's context sources are user choices, and for a long time they were
 * not: the settings page wrote `rg_chat_settings` and nothing ever read it, so
 * every toggle in the panel was decoration. These tests drive the real handler
 * with a stubbed `fetch` and assert on the prompt it would have sent — the only
 * place the difference between "honoured" and "ignored" is observable.
 */

import test from "node:test";
import assert from "node:assert/strict";

/** Minimal `browser.storage.local` over a plain object. */
function installBrowser(store = {}) {
	globalThis.browser = {
		storage: {
			local: {
				get: async (keys) => {
					if (keys === undefined || keys === null) return { ...store };
					const wanted = Array.isArray(keys) ? keys : [keys];
					const out = {};
					for (const k of wanted) {
						if (k in store) out[k] = store[k];
					}
					return out;
				},
				set: async (obj) => Object.assign(store, obj),
				remove: async (k) => delete store[k],
			},
		},
	};
	return store;
}

/** Capture the request body the handler builds, without making one. */
function installFetch() {
	const calls = [];
	globalThis.fetch = async (_url, init) => {
		calls.push(JSON.parse(init.body));
		return {
			ok: true,
			json: async () => ({
				candidates: [{ content: { parts: [{ text: "ok" }] } }],
			}),
		};
	};
	return calls;
}

installBrowser();
const { normalizeChatSettings } = await import(
	"../src/utils/chat-settings.js"
);
const chatHandler = (await import(
	"../src/background/message-handlers/chat-handler.js"
)).default;

const NOVEL_ID = "novel-1";

const CHRONICLE = {
	novelId: NOVEL_ID,
	chapters: {
		1: { chapterNum: 1, chapterLabel: "Ch 1", summary: "Rin leaves home." },
		2: { chapterNum: 2, chapterLabel: "Ch 2", summary: "Rin meets Kaede." },
	},
	entityIndex: {
		rin: { name: "Rin", type: "character" },
	},
};

/**
 * Run the handler and return the system prompt it sent.
 * @param {object} opts
 */
async function promptFor({ settings, chapterText = "", loreWeave = true }) {
	installBrowser({
		apiKey: "test-key",
		loreWeaveExperimental: loreWeave,
		[`rg_chronicle_${NOVEL_ID}`]: CHRONICLE,
		rg_chat_settings: settings,
	});
	const calls = installFetch();

	await new Promise((resolve) => {
		chatHandler.handler(
			{
				action: "story-chat",
				question: "Who is Rin?",
				novelId: NOVEL_ID,
				conversationHistory: [],
				chapterText,
			},
			resolve,
		);
	});

	assert.equal(calls.length, 1, "expected exactly one provider call");
	return calls[0];
}

const ALL_ON = {
	useCurrentChapter: true,
	useChronicle: true,
	useLoreWeave: true,
	maxHistory: 6,
};

const systemText = (body) => body.system_instruction.parts[0].text;

// ── Context sources ───────────────────────────────────────────────────────────

test("every source on puts all three in the prompt", async () => {
	const body = await promptFor({
		settings: ALL_ON,
		chapterText: "Rin walked north.",
	});
	const prompt = systemText(body);

	assert.match(prompt, /Rin walked north\./);
	assert.match(prompt, /Rin meets Kaede\./);
	assert.match(prompt, /Rin \(character\)/);
});

test("turning off the current chapter drops it and keeps the rest", async () => {
	const prompt = systemText(
		await promptFor({
			settings: { ...ALL_ON, useCurrentChapter: false },
			chapterText: "Rin walked north.",
		}),
	);

	assert.doesNotMatch(prompt, /Rin walked north\./);
	assert.match(prompt, /Rin meets Kaede\./);
});

test("turning off the chronicle drops the summaries", async () => {
	const prompt = systemText(
		await promptFor({
			settings: { ...ALL_ON, useChronicle: false },
			chapterText: "Rin walked north.",
		}),
	);

	assert.doesNotMatch(prompt, /Rin meets Kaede\./);
	assert.match(prompt, /Rin walked north\./);
});

test("turning off LoreWeave drops the entity index", async () => {
	const prompt = systemText(
		await promptFor({ settings: { ...ALL_ON, useLoreWeave: false } }),
	);

	assert.doesNotMatch(prompt, /Known entities/);
	assert.match(prompt, /Rin meets Kaede\./);
});

test("the experimental gate overrides the LoreWeave toggle", async () => {
	// Leaving the toggle on must not reach LoreWeave data while the master
	// experimental switch is off — that switch is the promise that nothing
	// LoreWeave-shaped happens until the user opts in.
	const prompt = systemText(
		await promptFor({ settings: ALL_ON, loreWeave: false }),
	);

	assert.doesNotMatch(prompt, /Known entities/);
});

test("with every source off the model is told so, not handed an empty block", async () => {
	const prompt = systemText(
		await promptFor({
			settings: {
				useCurrentChapter: false,
				useChronicle: false,
				useLoreWeave: false,
				maxHistory: 6,
			},
			chapterText: "Rin walked north.",
		}),
	);

	assert.match(prompt, /No story context available/);
});

// ── History depth ─────────────────────────────────────────────────────────────

test("maxHistory bounds how many turns are sent", async () => {
	installBrowser({
		apiKey: "test-key",
		[`rg_chronicle_${NOVEL_ID}`]: CHRONICLE,
		rg_chat_settings: { ...ALL_ON, maxHistory: 2 },
	});
	const calls = installFetch();

	// Five prior pairs; maxHistory 2 should keep the last two pairs only.
	const history = [];
	for (let i = 1; i <= 5; i++) {
		history.push({ role: "user", parts: [{ text: `q${i}` }] });
		history.push({ role: "model", parts: [{ text: `a${i}` }] });
	}

	const response = await new Promise((resolve) => {
		chatHandler.handler(
			{ question: "next", novelId: NOVEL_ID, conversationHistory: history },
			resolve,
		);
	});

	// 2 pairs of history + the new question.
	assert.equal(calls[0].contents.length, 5);
	assert.equal(calls[0].contents[0].parts[0].text, "q4");
	// The returned history is trimmed too, or it would grow back next turn.
	assert.equal(response.conversationHistory.length, 6);
});

// ── Normalization ─────────────────────────────────────────────────────────────

test("a missing settings blob falls back to the documented defaults", () => {
	const s = normalizeChatSettings(undefined);
	assert.deepEqual(s, {
		useCurrentChapter: true,
		useChronicle: true,
		useLoreWeave: true,
		maxHistory: 6,
	});
});

test("maxHistory is clamped rather than trusted", () => {
	// The number input enforces 2–20, but storage is editable and this value
	// multiplies directly into the request size.
	assert.equal(normalizeChatSettings({ maxHistory: 500 }).maxHistory, 20);
	assert.equal(normalizeChatSettings({ maxHistory: 0 }).maxHistory, 2);
	assert.equal(normalizeChatSettings({ maxHistory: -3 }).maxHistory, 2);
	assert.equal(normalizeChatSettings({ maxHistory: "8" }).maxHistory, 8);
	assert.equal(normalizeChatSettings({ maxHistory: "nope" }).maxHistory, 6);
});
