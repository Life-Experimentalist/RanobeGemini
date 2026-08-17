/**
 * Opt-in backup encryption for Ranobe Gemini.
 *
 * Threat model, stated plainly so nobody has to guess:
 *
 *   This protects a backup file that has left the machine — sitting in Google
 *   Drive, OneDrive, Dropbox, a WebDAV box, or an email attachment. It stops
 *   the storage provider, anyone who gets the file, and anyone who gets into
 *   the cloud account from reading your library, prompts, and API keys.
 *
 *   It does NOT protect against someone who already has your browser profile.
 *   The key lives in extension storage next to the data it protects, because
 *   the alternative is a passphrase the user has to type on every backup, and
 *   a backup people stop taking protects nothing at all.
 *
 * Why not "use the Gmail address as the passphrase", which is the obvious
 * zero-effort idea: the ciphertext and the address live in the same Google
 * account. Anyone who can open the Drive file already knows whose Drive it is,
 * so the key is taped to the lock. Guessable-secret-as-key is not encryption,
 * it is obfuscation with extra steps, and it is worse than plaintext because
 * it invites people to trust it.
 *
 * Cross-browser is why the recovery code exists, not just backup paranoia.
 * `browser.storage.sync` rides the Firefox or Chrome account, so a key put
 * there never crosses from Firefox to Chrome. The recovery code is the
 * transport: you paste it once per browser, exactly like the API key.
 *
 * Format: AES-GCM-256, 96-bit random IV per file, key either raw (recovery
 * code path, no KDF needed because the code IS the key) or PBKDF2-SHA256 over
 * a user-chosen passphrase.
 */

import { debugLog, debugError } from "./logger.js";
import {
	BACKUP_ENCRYPTION_ENABLED_KEY,
	BACKUP_ENCRYPTION_KEY_STORAGE,
} from "./constants.js";

export const BACKUP_ENVELOPE_FORMAT = "ranobe-encrypted-backup";
export const BACKUP_ENVELOPE_VERSION = 1;

const PBKDF2_ITERATIONS = 600000;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const SALT_BYTES = 16;

/**
 * Crockford base32: no I, L, O or U, so a hand-copied recovery code cannot be
 * ruined by the 1/I/l or 0/O confusion. Decoding folds I and L back to 1 and
 * O back to 0, so a user who types what they think they see still succeeds.
 */
const B32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/* -------------------------------------------------------------------------- */
/* Encoding helpers                                                            */
/* -------------------------------------------------------------------------- */

function bytesToBase64(bytes) {
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary);
}

function base64ToBytes(b64) {
	const binary = atob(b64);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
	return out;
}

/**
 * Render 32 key bytes as a dashed, hand-typable recovery code.
 * @param {Uint8Array} bytes
 * @returns {string} e.g. "8K2F-9QRT-..." (13 groups of 4)
 */
export function bytesToRecoveryCode(bytes) {
	let bits = 0;
	let value = 0;
	let out = "";

	for (const b of bytes) {
		value = (value << 8) | b;
		bits += 8;
		while (bits >= 5) {
			out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];

	return out.match(/.{1,4}/g).join("-");
}

/**
 * Parse a recovery code back into key bytes.
 * @param {string} code
 * @returns {Uint8Array}
 * @throws {Error} if the code is not a well-formed 32-byte code
 */
export function recoveryCodeToBytes(code) {
	const clean = String(code || "")
		.toUpperCase()
		.replace(/[^0-9A-Z]/g, "")
		.replace(/[IL]/g, "1")
		.replace(/O/g, "0");

	if (clean.length === 0) {
		throw new Error("Recovery code is empty.");
	}

	let bits = 0;
	let value = 0;
	const out = [];

	for (const ch of clean) {
		const idx = B32_ALPHABET.indexOf(ch);
		if (idx < 0) {
			throw new Error(
				`Recovery code contains "${ch}", which is not a valid character.`,
			);
		}
		value = (value << 5) | idx;
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}

	if (out.length < KEY_BYTES) {
		throw new Error(
			`Recovery code is too short (${out.length} of ${KEY_BYTES} bytes). Check for missing characters.`,
		);
	}

	return new Uint8Array(out.slice(0, KEY_BYTES));
}

/* -------------------------------------------------------------------------- */
/* Key management                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort mirror of the key to `browser.storage.sync`.
 *
 * This is a convenience for a user's other profiles in the SAME browser
 * family. It is not the cross-browser mechanism — that is the recovery code.
 * Failures here are non-fatal: sync storage may be disabled, unavailable, or
 * over quota, and none of that should stop a backup.
 */
async function mirrorKeyToSync(keyB64) {
	try {
		await browser.storage.sync.set({
			[BACKUP_ENCRYPTION_KEY_STORAGE]: keyB64,
		});
	} catch (error) {
		debugLog("Backup key not mirrored to sync storage:", error?.message);
	}
}

/**
 * Read the stored backup key, pulling it down from sync storage if this
 * profile does not have it locally yet.
 * @returns {Promise<Uint8Array|null>}
 */
export async function getBackupKey() {
	const local = await browser.storage.local.get(
		BACKUP_ENCRYPTION_KEY_STORAGE,
	);
	let keyB64 = local[BACKUP_ENCRYPTION_KEY_STORAGE];

	if (!keyB64) {
		try {
			const synced = await browser.storage.sync.get(
				BACKUP_ENCRYPTION_KEY_STORAGE,
			);
			keyB64 = synced[BACKUP_ENCRYPTION_KEY_STORAGE];
			if (keyB64) {
				await browser.storage.local.set({
					[BACKUP_ENCRYPTION_KEY_STORAGE]: keyB64,
				});
				debugLog("Backup key adopted from sync storage.");
			}
		} catch (error) {
			debugLog(
				"Sync storage unavailable for backup key:",
				error?.message,
			);
		}
	}

	if (!keyB64) return null;

	try {
		const bytes = base64ToBytes(keyB64);
		return bytes.length === KEY_BYTES ? bytes : null;
	} catch (error) {
		debugError("Stored backup key is corrupt:", error);
		return null;
	}
}

/**
 * Get the backup key, generating one on first use.
 * @returns {Promise<{key: Uint8Array, recoveryCode: string, isNew: boolean}>}
 */
export async function getOrCreateBackupKey() {
	const existing = await getBackupKey();
	if (existing) {
		return {
			key: existing,
			recoveryCode: bytesToRecoveryCode(existing),
			isNew: false,
		};
	}

	const key = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
	const keyB64 = bytesToBase64(key);
	await browser.storage.local.set({
		[BACKUP_ENCRYPTION_KEY_STORAGE]: keyB64,
	});
	await mirrorKeyToSync(keyB64);

	debugLog("New backup encryption key generated.");
	return { key, recoveryCode: bytesToRecoveryCode(key), isNew: true };
}

/**
 * Adopt a key from a recovery code typed on another browser.
 * This is how an encrypted backup made in Firefox becomes readable in Chrome.
 * @param {string} code
 * @returns {Promise<Uint8Array>} the adopted key
 */
export async function setBackupKeyFromRecoveryCode(code) {
	const key = recoveryCodeToBytes(code);
	const keyB64 = bytesToBase64(key);
	await browser.storage.local.set({
		[BACKUP_ENCRYPTION_KEY_STORAGE]: keyB64,
	});
	await mirrorKeyToSync(keyB64);
	debugLog("Backup key set from recovery code.");
	return key;
}

/**
 * The recovery code for this browser's key, or null if no key exists yet.
 * @returns {Promise<string|null>}
 */
export async function getRecoveryCode() {
	const key = await getBackupKey();
	return key ? bytesToRecoveryCode(key) : null;
}

/**
 * Forget the key. Any backup already encrypted with it becomes unreadable
 * here unless the user still has the recovery code, so callers must confirm.
 */
export async function clearBackupKey() {
	await browser.storage.local.remove(BACKUP_ENCRYPTION_KEY_STORAGE);
	try {
		await browser.storage.sync.remove(BACKUP_ENCRYPTION_KEY_STORAGE);
	} catch {
		// Sync storage may be unavailable; the local removal is what matters.
	}
	debugLog("Backup encryption key cleared.");
}

/**
 * Whether new backups should be encrypted. Defaults to false: plaintext
 * export stays the default so nobody is surprised by a file they cannot open.
 * @returns {Promise<boolean>}
 */
export async function isBackupEncryptionEnabled() {
	const stored = await browser.storage.local.get(
		BACKUP_ENCRYPTION_ENABLED_KEY,
	);
	return stored[BACKUP_ENCRYPTION_ENABLED_KEY] === true;
}

/**
 * Turn encryption on or off. Turning it on generates a key if there is none.
 * @param {boolean} enabled
 * @returns {Promise<{enabled: boolean, recoveryCode: string|null, isNewKey: boolean}>}
 */
export async function setBackupEncryptionEnabled(enabled) {
	await browser.storage.local.set({
		[BACKUP_ENCRYPTION_ENABLED_KEY]: !!enabled,
	});

	if (!enabled) {
		return { enabled: false, recoveryCode: null, isNewKey: false };
	}

	const { recoveryCode, isNew } = await getOrCreateBackupKey();
	return { enabled: true, recoveryCode, isNewKey: isNew };
}

/* -------------------------------------------------------------------------- */
/* Envelope                                                                    */
/* -------------------------------------------------------------------------- */

async function importRawKey(keyBytes) {
	return crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "AES-GCM" },
		false,
		["encrypt", "decrypt"],
	);
}

async function deriveKeyFromPassphrase(passphrase, salt, iterations) {
	const material = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(passphrase),
		{ name: "PBKDF2" },
		false,
		["deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt, iterations, hash: "SHA-256" },
		material,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

/**
 * Is this object an encrypted envelope rather than a plain backup?
 * @param {any} obj
 * @returns {boolean}
 */
export function isEncryptedEnvelope(obj) {
	return !!(
		obj &&
		typeof obj === "object" &&
		obj.format === BACKUP_ENVELOPE_FORMAT &&
		typeof obj.ciphertext === "string"
	);
}

/**
 * Wrap a backup object in an encrypted envelope.
 *
 * Pass either `key` (raw bytes, the recovery-code path) or `passphrase`
 * (PBKDF2 path). The envelope keeps a small plaintext `hint` block so a user
 * staring at five files in Drive can tell which one they want without
 * decrypting each — that is a deliberate, documented metadata leak of the
 * date, the backup type and the novel count. Nothing else escapes.
 *
 * @param {Object} backup
 * @param {{key?: Uint8Array, passphrase?: string}} secret
 * @returns {Promise<Object>} envelope, safe to JSON.stringify
 */
export async function encryptBackupEnvelope(backup, secret = {}) {
	const { key, passphrase } = secret;
	if (!key && !passphrase) {
		throw new Error(
			"encryptBackupEnvelope requires a key or a passphrase.",
		);
	}

	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	let cryptoKey;
	let kdf = null;

	if (passphrase) {
		const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
		cryptoKey = await deriveKeyFromPassphrase(
			passphrase,
			salt,
			PBKDF2_ITERATIONS,
		);
		kdf = {
			name: "PBKDF2",
			hash: "SHA-256",
			iterations: PBKDF2_ITERATIONS,
			salt: bytesToBase64(salt),
		};
	} else {
		cryptoKey = await importRawKey(key);
	}

	const plaintext = new TextEncoder().encode(JSON.stringify(backup));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		cryptoKey,
		plaintext,
	);

	return {
		format: BACKUP_ENVELOPE_FORMAT,
		envelopeVersion: BACKUP_ENVELOPE_VERSION,
		cipher: "AES-GCM-256",
		kdf,
		iv: bytesToBase64(iv),
		ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
		hint: {
			createdAtISO: backup?.createdAtISO || new Date().toISOString(),
			type: backup?.type || "unknown",
			novelCount: backup?.metadata?.novelCount ?? null,
			extensionVersion: backup?.extensionVersion || "unknown",
		},
	};
}

/**
 * Unwrap an encrypted envelope.
 *
 * @param {Object} envelope
 * @param {{key?: Uint8Array, passphrase?: string}} secret
 * @returns {Promise<Object>} the original backup object
 * @throws {Error} with a message that distinguishes "wrong secret" from
 *                 "not a backup at all", because those need different fixes
 */
export async function decryptBackupEnvelope(envelope, secret = {}) {
	if (!isEncryptedEnvelope(envelope)) {
		throw new Error("This file is not an encrypted Ranobe backup.");
	}
	if (envelope.cipher !== "AES-GCM-256") {
		throw new Error(
			`Unsupported cipher "${envelope.cipher}". This backup was made by a newer version of the extension.`,
		);
	}

	const { key, passphrase } = secret;
	let cryptoKey;

	if (envelope.kdf) {
		if (!passphrase) {
			throw new Error(
				"This backup is protected by a passphrase. Enter it to restore.",
			);
		}
		if (envelope.kdf.name !== "PBKDF2" || envelope.kdf.hash !== "SHA-256") {
			throw new Error(
				`Unsupported key derivation "${envelope.kdf.name}/${envelope.kdf.hash}".`,
			);
		}
		cryptoKey = await deriveKeyFromPassphrase(
			passphrase,
			base64ToBytes(envelope.kdf.salt),
			envelope.kdf.iterations,
		);
	} else {
		if (!key) {
			throw new Error(
				"This backup is encrypted and this browser has no key for it. Paste the recovery code in Settings → Backup, then try again.",
			);
		}
		cryptoKey = await importRawKey(key);
	}

	let plaintext;
	try {
		plaintext = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
			cryptoKey,
			base64ToBytes(envelope.ciphertext),
		);
	} catch {
		// AES-GCM authentication failed. That is one error for two causes, and
		// the crypto layer genuinely cannot tell them apart, so say both.
		throw new Error(
			envelope.kdf
				? "Wrong passphrase, or the backup file is damaged."
				: "Wrong recovery code, or the backup file is damaged.",
		);
	}

	try {
		return JSON.parse(new TextDecoder().decode(plaintext));
	} catch (error) {
		throw new Error(
			`Decrypted backup is not valid JSON: ${error.message}`,
			{
				cause: error,
			},
		);
	}
}

/* -------------------------------------------------------------------------- */
/* Cloud transport                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Encrypt an object on its way to a remote provider, if encryption is on.
 *
 * Used for Drive / OneDrive / Dropbox / WebDAV, where the file lands somewhere
 * the provider can read it. Deliberately NOT used for native browser sync:
 * that adapter writes to `browser.storage.sync`, which is the same store the
 * key is mirrored into, so encrypting there would be theatre — and it would
 * cost a third more bytes against a hard 100KB quota.
 *
 * Passes the object through untouched when encryption is off, so every caller
 * can wrap unconditionally.
 *
 * @param {Object} obj
 * @returns {Promise<Object>} the envelope, or `obj` unchanged
 */
export async function maybeEncryptForTransport(obj) {
	if (!(await isBackupEncryptionEnabled())) return obj;
	const { key } = await getOrCreateBackupKey();
	return encryptBackupEnvelope(obj, { key });
}

/**
 * Decrypt an object coming back from a remote provider, if it is an envelope.
 *
 * Always safe to call: a plaintext backup, including every backup made before
 * this feature existed, passes straight through.
 *
 * @param {Object} obj
 * @returns {Promise<Object>}
 */
export async function maybeDecryptFromTransport(obj) {
	if (!isEncryptedEnvelope(obj)) return obj;
	const key = await getBackupKey();
	return decryptBackupEnvelope(obj, { key });
}
