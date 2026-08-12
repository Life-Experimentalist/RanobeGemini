import assert from "node:assert/strict";
import test from "node:test";

/**
 * A minimal `browser.storage` stand-in. The shared fake-sync-storage helper
 * models sync quotas, which is not what these tests are about — here the
 * interesting question is whether local and sync are treated as the separate
 * stores they really are.
 */
function installFakeStorage({ syncAvailable = true } = {}) {
	const previous = globalThis.browser;
	const local = new Map();
	const sync = new Map();

	const area = (map, available) => ({
		async get(keys) {
			if (!available) throw new Error("storage.sync is unavailable");
			const list = Array.isArray(keys) ? keys : [keys];
			const out = {};
			for (const key of list) if (map.has(key)) out[key] = map.get(key);
			return out;
		},
		async set(items) {
			if (!available) throw new Error("storage.sync is unavailable");
			for (const [key, value] of Object.entries(items)) map.set(key, value);
		},
		async remove(keys) {
			if (!available) throw new Error("storage.sync is unavailable");
			const list = Array.isArray(keys) ? keys : [keys];
			for (const key of list) map.delete(key);
		},
	});

	globalThis.browser = {
		storage: {
			local: area(local, true),
			sync: area(sync, syncAvailable),
		},
	};

	return {
		local,
		sync,
		restore: () => {
			globalThis.browser = previous;
		},
	};
}

async function loadCrypto() {
	// Cache-bust so each test gets a module with no leaked state, and so the
	// fake `browser` global installed above is the one it closes over.
	return import(`../src/utils/backup-crypto.js?t=${counter++}`);
}
let counter = 0;

const SAMPLE = {
	version: "3.0",
	type: "full",
	createdAtISO: "2026-08-12T00:00:00.000Z",
	extensionVersion: "5.0.0",
	data: { apiKey: "AIza-secret", promptTemplate: "『転生』 ünïcödé 🐉" },
	metadata: { novelCount: 42 },
};

test("a backup survives an encrypt/decrypt round trip", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();

	const { key } = await crypto.getOrCreateBackupKey();
	const envelope = await crypto.encryptBackupEnvelope(SAMPLE, { key });
	const restored = await crypto.decryptBackupEnvelope(envelope, { key });

	assert.deepEqual(restored, SAMPLE);
});

test("the envelope does not leak the plaintext it wraps", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();

	const { key } = await crypto.getOrCreateBackupKey();
	const envelope = await crypto.encryptBackupEnvelope(SAMPLE, { key });
	const serialized = JSON.stringify(envelope);

	assert.ok(!serialized.includes("AIza-secret"));
	assert.ok(!serialized.includes("転生"));
	// The hint block is a deliberate, documented exception.
	assert.equal(envelope.hint.novelCount, 42);
});

test("every envelope gets a fresh IV, so two backups never share one", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();

	const { key } = await crypto.getOrCreateBackupKey();
	const a = await crypto.encryptBackupEnvelope(SAMPLE, { key });
	const b = await crypto.encryptBackupEnvelope(SAMPLE, { key });

	assert.notEqual(a.iv, b.iv);
	assert.notEqual(a.ciphertext, b.ciphertext);
});

test("a recovery code round-trips to the same key bytes", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();

	const { key, recoveryCode } = await crypto.getOrCreateBackupKey();
	assert.deepEqual(crypto.recoveryCodeToBytes(recoveryCode), key);
});

test("a recovery code tolerates the ways people retype it", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();

	const { key, recoveryCode } = await crypto.getOrCreateBackupKey();

	// Lowercased, dashes stripped, spaces introduced.
	const mangled = recoveryCode.toLowerCase().replace(/-/g, "  ");
	assert.deepEqual(crypto.recoveryCodeToBytes(mangled), key);
});

test("the recovery code carries an encrypted backup to a different browser", async (t) => {
	// Browser one: makes the backup.
	const first = installFakeStorage();
	const cryptoA = await loadCrypto();
	const { key: keyA, recoveryCode } = await cryptoA.getOrCreateBackupKey();
	const envelope = await cryptoA.encryptBackupEnvelope(SAMPLE, { key: keyA });
	first.restore();

	// Browser two: different profile, different sync account, no key at all.
	const second = installFakeStorage();
	t.after(second.restore);
	const cryptoB = await loadCrypto();

	assert.equal(await cryptoB.getBackupKey(), null);
	await assert.rejects(
		cryptoB.decryptBackupEnvelope(envelope, { key: null }),
		/no key for it/,
	);

	const adopted = await cryptoB.setBackupKeyFromRecoveryCode(recoveryCode);
	assert.deepEqual(await cryptoB.decryptBackupEnvelope(envelope, { key: adopted }), SAMPLE);
});

test("a wrong recovery code is rejected rather than silently returning garbage", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();

	const { key } = await crypto.getOrCreateBackupKey();
	const envelope = await crypto.encryptBackupEnvelope(SAMPLE, { key });

	const wrong = crypto.recoveryCodeToBytes(
		crypto.bytesToRecoveryCode(new Uint8Array(32).fill(7)),
	);
	await assert.rejects(
		crypto.decryptBackupEnvelope(envelope, { key: wrong }),
		/Wrong recovery code/,
	);
});

test("a tampered ciphertext fails authentication", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();

	const { key } = await crypto.getOrCreateBackupKey();
	const envelope = await crypto.encryptBackupEnvelope(SAMPLE, { key });

	// Flip one character of the base64 payload.
	const flipped = envelope.ciphertext[0] === "A" ? "B" : "A";
	envelope.ciphertext = flipped + envelope.ciphertext.slice(1);

	await assert.rejects(crypto.decryptBackupEnvelope(envelope, { key }));
});

test("a passphrase-protected backup needs the passphrase, not the key", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();

	const envelope = await crypto.encryptBackupEnvelope(SAMPLE, {
		passphrase: "correct horse battery staple",
	});

	assert.equal(envelope.kdf.name, "PBKDF2");
	await assert.rejects(
		crypto.decryptBackupEnvelope(envelope, { key: new Uint8Array(32) }),
		/protected by a passphrase/,
	);
	await assert.rejects(
		crypto.decryptBackupEnvelope(envelope, { passphrase: "wrong" }),
		/Wrong passphrase/,
	);
	assert.deepEqual(
		await crypto.decryptBackupEnvelope(envelope, {
			passphrase: "correct horse battery staple",
		}),
		SAMPLE,
	);
});

test("transport helpers pass plaintext through when encryption is off", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();

	assert.equal(await crypto.isBackupEncryptionEnabled(), false);
	assert.equal(await crypto.maybeEncryptForTransport(SAMPLE), SAMPLE);
	// Backups made before this feature existed must still restore.
	assert.equal(await crypto.maybeDecryptFromTransport(SAMPLE), SAMPLE);
});

test("transport helpers encrypt and decrypt once the setting is on", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();

	const { recoveryCode, isNewKey } =
		await crypto.setBackupEncryptionEnabled(true);
	assert.ok(isNewKey);
	assert.ok(recoveryCode.length > 0);

	const wrapped = await crypto.maybeEncryptForTransport(SAMPLE);
	assert.ok(crypto.isEncryptedEnvelope(wrapped));
	assert.deepEqual(await crypto.maybeDecryptFromTransport(wrapped), SAMPLE);
});

test("the key is not stored where a backup would pick it up", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();
	const { COMPREHENSIVE_BACKUP_KEYS, BACKUP_ENCRYPTION_KEY_STORAGE } =
		await import("../src/utils/constants.js");

	await crypto.getOrCreateBackupKey();

	assert.ok(fake.local.has(BACKUP_ENCRYPTION_KEY_STORAGE));
	assert.ok(
		!COMPREHENSIVE_BACKUP_KEYS.includes(BACKUP_ENCRYPTION_KEY_STORAGE),
		"the encryption key must never be inside the file it encrypts",
	);
});

test("a key generated on one profile is adopted from sync storage on another", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();

	const { key } = await crypto.getOrCreateBackupKey();

	// Same browser family, different profile: sync has it, local does not.
	fake.local.clear();
	assert.deepEqual(await crypto.getBackupKey(), key);
});

test("an unavailable sync store does not stop key generation", async (t) => {
	const fake = installFakeStorage({ syncAvailable: false });
	t.after(fake.restore);
	const crypto = await loadCrypto();

	const { key, recoveryCode } = await crypto.getOrCreateBackupKey();
	assert.equal(key.length, 32);
	assert.deepEqual(crypto.recoveryCodeToBytes(recoveryCode), key);
});

test("a malformed recovery code is refused with a usable message", async (t) => {
	const fake = installFakeStorage();
	t.after(fake.restore);
	const crypto = await loadCrypto();

	assert.throws(() => crypto.recoveryCodeToBytes(""), /empty/);
	assert.throws(() => crypto.recoveryCodeToBytes("ABCD-EFGH"), /too short/);
	assert.throws(
		() => crypto.recoveryCodeToBytes("U".repeat(52)),
		/not a valid character/,
	);
});
