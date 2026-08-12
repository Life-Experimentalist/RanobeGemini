/**
 * The orchestrator decides where a user's library backup actually goes. Getting
 * it wrong means a backup silently lands nowhere, or a restore reads from a
 * provider the user switched away from — both invisible until the day the
 * backup is needed.
 *
 * Settings have two shapes in the wild: the current `syncDestinations` array and
 * the legacy `activeSync` string that older installs still carry.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createStorageSyncOrchestrator } from "../src/background/storage/storage-orchestrator.js";
import { REQUIRED_STORAGE_SYNC_METHODS } from "../src/background/storage/storage-interface.js";

/** An adapter that records what it was asked to do. */
function fakeAdapter(providerId, { failUpload = false } = {}) {
	const calls = [];
	const record = (name) => (...args) => {
		calls.push({ name, args });
		if (name === "uploadBackup" && failUpload) {
			return Promise.reject(new Error(`${providerId} upload failed`));
		}
		return Promise.resolve({ providerId, name });
	};
	const adapter = {
		calls,
		listBackups: () => {
			calls.push({ name: "listBackups", args: [] });
			return Promise.resolve([{ id: `${providerId}-1` }]);
		},
		getLatestBackup: () => {
			calls.push({ name: "getLatestBackup", args: [] });
			return Promise.resolve({ id: `${providerId}-latest` });
		},
		getContinuousBackup: () => {
			calls.push({ name: "getContinuousBackup", args: [] });
			return Promise.resolve(null);
		},
	};
	for (const name of ["uploadBackup", "downloadBackup", "ensureAuth", "resetAuth"]) {
		adapter[name] = record(name);
	}
	return adapter;
}

/** A `browser` double whose local storage returns whatever the test seeds. */
const fakeBrowser = (stored) => ({
	storage: { local: { get: async () => stored } },
});

const build = (stored, overrides = {}) => {
	const drive = fakeAdapter("google-drive");
	const native = fakeAdapter("native-sync");
	const webdav = fakeAdapter("webdav");
	return {
		drive,
		native,
		webdav,
		sync: createStorageSyncOrchestrator({
			browserRef: fakeBrowser(stored),
			defaultProvider: "native-sync",
			adapters: { "google-drive": drive, "native-sync": native, webdav },
			...overrides,
		}),
	};
};

const uploads = (adapter) => adapter.calls.filter((c) => c.name === "uploadBackup");

// ── Registration ──────────────────────────────────────────────────────────────

test("an adapter missing a required method is rejected at registration", () => {
	for (const missing of REQUIRED_STORAGE_SYNC_METHODS) {
		const adapter = fakeAdapter("broken");
		delete adapter[missing];
		assert.throws(
			() => createStorageSyncOrchestrator({ adapters: { broken: adapter } }),
			new RegExp(missing),
			`a missing ${missing} was accepted`,
		);
	}
});

test("registered providers are reported back", () => {
	const { sync } = build({});
	assert.deepEqual(sync.getRegisteredProviders().sort(), [
		"google-drive",
		"native-sync",
		"webdav",
	]);
});

// ── Choosing the destination ──────────────────────────────────────────────────

test("no stored settings falls back to the default provider", async () => {
	const { sync } = build({});
	assert.equal(await sync.getActiveSyncProviderId(), "native-sync");
});

test("the legacy activeSync string is still honoured", async () => {
	// Installs that predate multi-destination sync only have this key.
	const { sync } = build({ activeSync: "webdav" });
	assert.equal(await sync.getActiveSyncProviderId(), "webdav");
});

test("syncDestinations wins over the legacy key", async () => {
	const { sync } = build({
		activeSync: "webdav",
		syncDestinations: [{ providerId: "google-drive" }],
	});
	assert.equal(await sync.getActiveSyncProviderId(), "google-drive");
});

test("a provider with no adapter falls back rather than throwing", async () => {
	// A destination can outlive the adapter that served it — e.g. settings
	// restored from a backup taken on a newer version.
	const { sync } = build({ syncDestinations: [{ providerId: "ftp" }] });
	assert.equal(await sync.getActiveSyncProviderId(), "native-sync");
});

test("malformed destination entries are skipped", async () => {
	const { sync } = build({
		syncDestinations: [null, { providerId: "" }, { providerId: "webdav" }],
	});
	assert.equal(await sync.getActiveSyncProviderId(), "webdav");
});

test("a storage read that throws still yields a usable provider", async () => {
	const sync = createStorageSyncOrchestrator({
		browserRef: {
			storage: {
				local: {
					get: async () => {
						throw new Error("storage unavailable");
					},
				},
			},
		},
		defaultProvider: "native-sync",
		adapters: { "native-sync": fakeAdapter("native-sync") },
	});
	assert.equal(await sync.getActiveSyncProviderId(), "native-sync");
});

test("no browser API at all still yields the default provider", async () => {
	const sync = createStorageSyncOrchestrator({
		defaultProvider: "native-sync",
		adapters: { "native-sync": fakeAdapter("native-sync") },
	});
	assert.equal(await sync.getActiveSyncProviderId(), "native-sync");
});

// ── Uploading ─────────────────────────────────────────────────────────────────

test("a backup reaches every configured destination", async () => {
	const { sync, drive, native, webdav } = build({
		syncDestinations: [
			{ providerId: "google-drive" },
			{ providerId: "webdav" },
			{ providerId: "native-sync" },
		],
	});
	const result = await sync.uploadBackup("payload");

	// The primary is what the caller hears about; the rest are best-effort.
	assert.equal(result.providerId, "google-drive");
	for (const adapter of [drive, webdav, native]) {
		assert.equal(uploads(adapter).length, 1);
		assert.equal(uploads(adapter)[0].args[0], "payload");
	}
});

test("each destination gets its own custom path, not the primary's", async () => {
	const { sync, drive, webdav } = build({
		syncDestinations: [
			{ providerId: "google-drive", customPath: "Drive/Backups" },
			{ providerId: "webdav", customPath: "dav/backups" },
		],
	});
	await sync.uploadBackup("payload", { retention: 3 });

	assert.equal(uploads(drive)[0].args[1].customPath, "Drive/Backups");
	assert.equal(uploads(webdav)[0].args[1].customPath, "dav/backups");
	// Caller options are passed through to both.
	assert.equal(uploads(webdav)[0].args[1].retention, 3);
});

test("a failing secondary does not fail the upload", async () => {
	const drive = fakeAdapter("google-drive");
	const broken = fakeAdapter("webdav", { failUpload: true });
	const sync = createStorageSyncOrchestrator({
		browserRef: fakeBrowser({
			syncDestinations: [{ providerId: "google-drive" }, { providerId: "webdav" }],
		}),
		defaultProvider: "google-drive",
		adapters: { "google-drive": drive, webdav: broken },
	});

	const result = await sync.uploadBackup("payload");
	assert.equal(result.providerId, "google-drive");
	assert.equal(uploads(broken).length, 1, "the secondary was still attempted");
});

test("a failing primary surfaces to the caller", async () => {
	// The opposite of the rule above: the user asked for this one.
	const broken = fakeAdapter("google-drive", { failUpload: true });
	const sync = createStorageSyncOrchestrator({
		browserRef: fakeBrowser({ syncDestinations: [{ providerId: "google-drive" }] }),
		defaultProvider: "google-drive",
		adapters: { "google-drive": broken },
	});
	await assert.rejects(sync.uploadBackup("payload"), /upload failed/);
});

test("destinations with no registered adapter fall back to the default", async () => {
	const { sync, native } = build({
		syncDestinations: [{ providerId: "ftp" }, { providerId: "smb" }],
	});
	const result = await sync.uploadBackup("payload");
	assert.equal(result.providerId, "native-sync");
	assert.equal(uploads(native).length, 1);
});

// ── Reading ───────────────────────────────────────────────────────────────────

test("reads go to the primary destination only", async () => {
	const { sync, drive, webdav } = build({
		syncDestinations: [{ providerId: "google-drive" }, { providerId: "webdav" }],
	});

	assert.deepEqual(await sync.listBackups(), {
		providerId: "google-drive",
		backups: [{ id: "google-drive-1" }],
	});
	assert.deepEqual(await sync.getLatestBackup(), {
		providerId: "google-drive",
		file: { id: "google-drive-latest" },
	});
	// A provider with nothing stored reports null rather than undefined.
	assert.deepEqual(await sync.getContinuousBackup(), {
		providerId: "google-drive",
		file: null,
	});
	assert.equal(webdav.calls.length, 0, "a read fanned out to a secondary");
	assert.equal(drive.calls.length, 3);
});

test("a download is tagged with the provider it came from", async () => {
	const { sync, drive } = build({ activeSync: "google-drive" });
	const { providerId, data } = await sync.downloadBackup("file-1", { raw: true });
	assert.equal(providerId, "google-drive");
	assert.equal(data.providerId, "google-drive");
	assert.deepEqual(drive.calls[0].args, ["file-1", { raw: true }]);
});

// ── Auth ──────────────────────────────────────────────────────────────────────

test("auth calls are routed to the active provider", async () => {
	const { sync, drive } = build({ activeSync: "google-drive" });
	assert.equal((await sync.ensureAuth()).providerId, "google-drive");
	assert.equal((await sync.resetAuth()).providerId, "google-drive");
	assert.deepEqual(
		drive.calls.map((c) => c.name),
		["ensureAuth", "resetAuth"],
	);
});

test("a provider without auth says so instead of failing obscurely", async () => {
	// `ensureAuth`/`resetAuth` are optional in the contract — native sync needs
	// neither — so the error has to name the provider.
	const adapter = fakeAdapter("native-sync");
	delete adapter.ensureAuth;
	delete adapter.resetAuth;
	const sync = createStorageSyncOrchestrator({
		browserRef: fakeBrowser({ activeSync: "native-sync" }),
		defaultProvider: "native-sync",
		adapters: { "native-sync": adapter },
	});

	await assert.rejects(sync.ensureAuth(), /native-sync.*ensureAuth/);
	await assert.rejects(sync.resetAuth(), /native-sync.*resetAuth/);
});
