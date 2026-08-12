import assert from "node:assert/strict";
import test from "node:test";

import {
	NATIVE_SYNC_CHUNK_PREFIX,
	NATIVE_SYNC_META_KEY,
} from "../src/utils/constants.js";
import { installFakeBrowser } from "./helpers/fake-sync-storage.mjs";

/**
 * Import the adapter lazily so the fake `browser` global is in place first.
 */
async function loadAdapter() {
	const { createNativeSyncStorageAdapter } = await import(
		"../src/background/storage/adapters/native-sync-storage.js"
	);
	return createNativeSyncStorageAdapter();
}

const chunkKeys = (dump) =>
	Object.keys(dump).filter((key) => key.startsWith(NATIVE_SYNC_CHUNK_PREFIX));

/** A library payload of roughly `kb` kilobytes. */
function payload(kb, marker = "x") {
	return JSON.stringify({ marker, blob: marker.repeat(kb * 1024) });
}

test("round-trips a payload containing non-ASCII text", async (t) => {
	const fake = installFakeBrowser();
	t.after(fake.restore);

	const adapter = await loadAdapter();
	const original = JSON.stringify({
		title: "『転生』 — ünïcödé ✨ emoji 🐉",
		chapters: ["第一話", "第二話"],
	});

	await adapter.uploadBackup(original);
	assert.equal(await adapter.downloadBackup("native-sync"), original);
});

test("reclaims chunks left behind by a larger previous backup", async (t) => {
	const fake = installFakeBrowser();
	t.after(fake.restore);

	const adapter = await loadAdapter();

	await adapter.uploadBackup(payload(40, "a"));
	const big = chunkKeys(fake.dump()).length;
	assert.ok(big > 1, `expected multiple chunks, got ${big}`);

	const small = payload(1, "b");
	await adapter.uploadBackup(small);
	const after = chunkKeys(fake.dump()).length;

	assert.ok(after < big, `stale chunks leaked: ${after} keys remain of ${big}`);
	assert.equal(after, fake.dump()[NATIVE_SYNC_META_KEY].totalChunks);
	assert.equal(await adapter.downloadBackup("native-sync"), small);
});

test("a shrunk backup does not read back the previous payload's tail", async (t) => {
	const fake = installFakeBrowser();
	t.after(fake.restore);

	const adapter = await loadAdapter();
	await adapter.uploadBackup(payload(30, "a"));
	const small = payload(1, "b");
	await adapter.uploadBackup(small);

	const restored = await adapter.downloadBackup("native-sync");
	assert.equal(restored, small);
	assert.ok(
		!restored.includes("aaaa"),
		"the previous payload's tail bled into the new one",
	);
});

test("rejects a library that will not fit instead of throwing a quota error", async (t) => {
	const fake = installFakeBrowser();
	t.after(fake.restore);

	const adapter = await loadAdapter();
	await assert.rejects(
		() => adapter.uploadBackup(payload(200, "z")),
		/too large for browser sync/i,
	);
	// Nothing partial was written.
	assert.deepEqual(fake.dump(), {});
});

test("leaves room for other synced keys", async (t) => {
	// A long account key stands in for the other things sharing the sync area.
	const fake = installFakeBrowser({ loreWeaveAccountKey: "k".repeat(2000) });
	t.after(fake.restore);

	const adapter = await loadAdapter();
	await adapter.uploadBackup(payload(20, "a"));

	assert.equal(fake.dump().loreWeaveAccountKey, "k".repeat(2000));
});

test("every stored chunk stays under the per-item limit", async (t) => {
	const fake = installFakeBrowser();
	t.after(fake.restore);

	const adapter = await loadAdapter();
	await adapter.uploadBackup(payload(50, "a"));

	const dump = fake.dump();
	for (const key of chunkKeys(dump)) {
		const bytes = key.length + JSON.stringify(dump[key]).length;
		assert.ok(bytes <= 8192, `${key} is ${bytes} bytes`);
	}
});

test("refuses to assemble a backup with a missing chunk", async (t) => {
	const fake = installFakeBrowser();
	t.after(fake.restore);

	const adapter = await loadAdapter();
	await adapter.uploadBackup(payload(30, "a"));

	// Simulate a partially-replicated profile.
	await globalThis.browser.storage.sync.remove(`${NATIVE_SYNC_CHUNK_PREFIX}1`);

	await assert.rejects(
		() => adapter.downloadBackup("native-sync"),
		/incomplete/i,
	);
});

test("refuses a backup whose reassembled length disagrees with its meta", async (t) => {
	const fake = installFakeBrowser();
	t.after(fake.restore);

	const adapter = await loadAdapter();
	await adapter.uploadBackup(payload(10, "a"));

	const key = `${NATIVE_SYNC_CHUNK_PREFIX}0`;
	const stored = (await globalThis.browser.storage.sync.get(key))[key];
	await globalThis.browser.storage.sync.set({ [key]: stored.slice(0, -8) });

	await assert.rejects(
		() => adapter.downloadBackup("native-sync"),
		/size check/i,
	);
});

test("refuses a backup written by a newer schema", async (t) => {
	const fake = installFakeBrowser();
	t.after(fake.restore);

	const adapter = await loadAdapter();
	await adapter.uploadBackup(payload(1, "a"));

	const meta = fake.dump()[NATIVE_SYNC_META_KEY];
	await globalThis.browser.storage.sync.set({
		[NATIVE_SYNC_META_KEY]: { ...meta, version: 99 },
	});

	await assert.rejects(
		() => adapter.downloadBackup("native-sync"),
		/newer version/i,
	);
});

test("resetAuth reclaims orphaned chunks the meta record does not know about", async (t) => {
	const fake = installFakeBrowser({
		[`${NATIVE_SYNC_CHUNK_PREFIX}97`]: "orphan-a",
		[`${NATIVE_SYNC_CHUNK_PREFIX}98`]: "orphan-b",
		loreWeaveAccountKey: "keep-me",
	});
	t.after(fake.restore);

	const adapter = await loadAdapter();
	await adapter.uploadBackup(payload(2, "a"));
	await adapter.resetAuth();

	assert.deepEqual(fake.dump(), { loreWeaveAccountKey: "keep-me" });
});

test("listBackups is empty before the first upload", async (t) => {
	const fake = installFakeBrowser();
	t.after(fake.restore);

	const adapter = await loadAdapter();
	assert.deepEqual(await adapter.listBackups(), []);
	assert.equal(await adapter.getLatestBackup(), null);
	await assert.rejects(
		() => adapter.downloadBackup("native-sync"),
		/No native sync backup/i,
	);
});

test("concurrent uploads serialise instead of interleaving", async (t) => {
	const fake = installFakeBrowser();
	t.after(fake.restore);

	const adapter = await loadAdapter();
	const candidates = [payload(20, "a"), payload(10, "b"), payload(3, "c")];

	await Promise.all(candidates.map((p) => adapter.uploadBackup(p)));

	// Whichever landed last must be intact: no chunk from another upload, and no
	// tail left over from a longer one.
	const restored = await adapter.downloadBackup("native-sync");
	assert.ok(
		candidates.includes(restored),
		"concurrent uploads produced a spliced payload",
	);
});
