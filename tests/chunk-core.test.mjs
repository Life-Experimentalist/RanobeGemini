/**
 * Chapter chunking decides what text each AI request sees. If it drops a
 * paragraph the reader silently loses it from the enhanced chapter; if it
 * returns a chunk far over the target the request can exceed the model's
 * context and fail outright. Neither failure is visible in the UI, so the
 * invariants are pinned here instead.
 *
 * Node has no DOMParser, so these exercise the mini-dom fallback path — which
 * is also the path Chromium's MV3 service worker takes.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
	countWords,
	splitContentByWords,
	validateChunkSize,
} from "../src/utils/chunking/chunk-core.js";
import { MIN_CHUNK_WORDS } from "../src/utils/chunking/chunk-config.js";

/** The splitter narrates every decision; keep the test output readable. */
function quietly(fn) {
	const { log, warn } = console;
	console.log = () => {};
	console.warn = () => {};
	try {
		return fn();
	} finally {
		console.log = log;
		console.warn = warn;
	}
}

const split = (content, size) => quietly(() => splitContentByWords(content, size));

/** `count` paragraphs of `words` words each, numbered so they stay distinct. */
function paragraphs(count, words) {
	return Array.from(
		{ length: count },
		(_, i) => `<p>${Array.from({ length: words }, (_, w) => `p${i}w${w}`).join(" ")}</p>`,
	).join("\n");
}

const totalWords = (chunks) => chunks.reduce((sum, c) => sum + c.wordCount, 0);

// ── Word counting ─────────────────────────────────────────────────────────────

test("word count ignores markup and emoji", () => {
	assert.equal(countWords("one two three"), 3);
	assert.equal(countWords("<p>one two</p><p>three</p>"), 3);
	// Emoji are stripped, not counted as words — an emoji-heavy chapter would
	// otherwise report a size the model never sees.
	assert.equal(countWords("one \u{1F600} two"), 2);
	assert.equal(countWords(""), 0);
	assert.equal(countWords(null), 0);
	assert.equal(countWords(12345), 0);
});

test("chunk size is clamped to the documented minimum", () => {
	assert.equal(validateChunkSize(500), 500);
	assert.equal(validateChunkSize("500"), 500);
	assert.equal(validateChunkSize(1), MIN_CHUNK_WORDS);
	assert.equal(validateChunkSize("nonsense"), MIN_CHUNK_WORDS);
	assert.equal(validateChunkSize(undefined), MIN_CHUNK_WORDS);
});

// ── Degenerate input ──────────────────────────────────────────────────────────

test("empty and non-string content yields no chunks rather than throwing", () => {
	assert.deepEqual(split("", 100), []);
	assert.deepEqual(split(null, 100), []);
	assert.deepEqual(split(undefined, 100), []);
	assert.deepEqual(split(42, 100), []);
});

// ── The three documented rules ────────────────────────────────────────────────

test("rule 1: a chapter under the target stays one chunk", () => {
	const chunks = split(paragraphs(4, 20), 200);
	assert.equal(chunks.length, 1);
	assert.equal(chunks[0].wordCount, 80);
	assert.equal(chunks[0].index, 0);
});

test("rule 2: between one and two targets splits into two balanced chunks", () => {
	const chunks = split(paragraphs(15, 10), 100); // 150 words, target 100
	assert.equal(chunks.length, 2);
	// "Balanced" is the point of the rule: neither half may be trivial.
	const [a, b] = chunks.map((c) => c.wordCount);
	assert.ok(Math.abs(a - b) <= 10, `unbalanced halves: ${a} vs ${b}`);
});

test("rule 3: a long chapter splits into several chunks", () => {
	const chunks = split(paragraphs(50, 20), 100); // 1000 words, target 100
	assert.ok(chunks.length >= 8, `expected many chunks, got ${chunks.length}`);
});

// ── Invariants that must hold for every shape ─────────────────────────────────

const SHAPES = [
	{ name: "under target", html: paragraphs(4, 20), size: 200, words: 80 },
	{ name: "just over target", html: paragraphs(11, 10), size: 100, words: 110 },
	{ name: "just under twice target", html: paragraphs(19, 10), size: 100, words: 190 },
	{ name: "exactly twice target", html: paragraphs(20, 10), size: 100, words: 200 },
	{ name: "many targets", html: paragraphs(50, 20), size: 100, words: 1000 },
	{ name: "uneven paragraphs", html: paragraphs(3, 90) + paragraphs(30, 4), size: 100, words: 390 },
	{
		name: "one oversized paragraph",
		html: `${paragraphs(2, 5)}\n<p>${Array.from({ length: 400 }, (_, i) => `big${i}`).join(" ")}</p>`,
		size: 100,
		words: 410,
	},
	{
		name: "mixed block tags",
		html: "<h2>Chapter One</h2>" + paragraphs(10, 15) + "<blockquote><p>quoted words here now</p></blockquote>",
		size: 60,
		words: 2 + 150 + 4,
	},
	{
		// The shape that breaks a naive two-way split: the first paragraph is
		// too small to balance against, so the second half carries almost
		// everything and lands well over the target.
		name: "tiny paragraph then a huge one",
		html: `${paragraphs(1, 5)}\n<p>${Array.from({ length: 180 }, (_, i) => `h${i}`).join(" ")}</p>`,
		size: 100,
		words: 185,
	},
];

for (const shape of SHAPES) {
	test(`${shape.name}: chunks are contiguously indexed`, () => {
		const chunks = split(shape.html, shape.size);
		assert.deepEqual(
			chunks.map((c) => c.index),
			chunks.map((_, i) => i),
		);
	});

	test(`${shape.name}: no words are lost or duplicated`, () => {
		const chunks = split(shape.html, shape.size);
		assert.equal(totalWords(chunks), shape.words);
	});

	test(`${shape.name}: no chunk exceeds the target size`, () => {
		const chunks = split(shape.html, shape.size);
		for (const chunk of chunks) {
			assert.ok(
				chunk.wordCount <= shape.size,
				`chunk ${chunk.index} is ${chunk.wordCount} words, target ${shape.size}`,
			);
		}
	});

	test(`${shape.name}: every chunk carries content`, () => {
		for (const chunk of split(shape.html, shape.size)) {
			assert.ok(chunk.content.trim().length > 0, `chunk ${chunk.index} is empty`);
		}
	});
}

// ── Plain text ────────────────────────────────────────────────────────────────

test("plain text splits on word boundaries with nothing lost", () => {
	const text = Array.from({ length: 500 }, (_, i) => `w${i}`).join(" ");
	const chunks = split(text, 100);
	assert.ok(chunks.length >= 5);
	assert.equal(totalWords(chunks), 500);
	for (const chunk of chunks) {
		assert.ok(chunk.wordCount <= 100, `${chunk.wordCount} > 100`);
	}
	// Reassembling must give the original text back, in order.
	assert.equal(chunks.map((c) => c.content).join(" "), text);
});

test("plain text under the target is left whole", () => {
	const chunks = split("just a few words here", 100);
	assert.equal(chunks.length, 1);
	assert.equal(chunks[0].content, "just a few words here");
});
