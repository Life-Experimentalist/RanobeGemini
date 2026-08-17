/**
 * Native browser sync storage adapter.
 *
 * Stores the library backup in `browser.storage.sync`, which the browser
 * replicates across the user's signed-in profiles. That area is small and
 * hard-capped, so everything here is about staying inside three limits at once:
 * total bytes, bytes per key, and writes per minute.
 *
 * Layout: one meta key plus N chunk keys holding a base64 payload. Chunk count
 * varies with library size, so every write also reclaims chunks left behind by
 * a larger previous backup — otherwise they occupy the quota forever.
 */

import {
	NATIVE_SYNC_CHUNK_PREFIX,
	NATIVE_SYNC_KEY_OVERHEAD_BYTES,
	NATIVE_SYNC_MAX_ITEMS,
	NATIVE_SYNC_META_KEY,
	NATIVE_SYNC_MIN_WRITE_INTERVAL_MS,
	NATIVE_SYNC_QUOTA_BYTES,
	NATIVE_SYNC_QUOTA_BYTES_PER_ITEM,
	NATIVE_SYNC_RESERVED_BYTES,
	NATIVE_SYNC_SCHEMA_VERSION,
} from "../../../utils/constants.js";
import { debugLog, debugError } from "../../../utils/logger.js";

/** Payload bytes per chunk key. Base64 is ASCII, so chars == bytes. */
const CHUNK_SIZE =
	NATIVE_SYNC_QUOTA_BYTES_PER_ITEM - NATIVE_SYNC_KEY_OVERHEAD_BYTES;

const chunkKey = (index) => `${NATIVE_SYNC_CHUNK_PREFIX}${index}`;

/**
 * Base64-encode a string via UTF-8 bytes.
 *
 * Base64 keeps every stored value pure ASCII, which matters twice over: chunk
 * boundaries can never split a surrogate pair, and byte accounting becomes
 * exact (1 char == 1 byte) instead of an estimate.
 *
 * @param {string} jsonStr
 * @returns {string}
 */
function encodePayload(jsonStr) {
	const bytes = new TextEncoder().encode(jsonStr);
	// Chunked, because String.fromCharCode(...) blows the argument limit on
	// anything large.
	const STEP = 0x8000;
	let binary = "";
	for (let i = 0; i < bytes.length; i += STEP) {
		binary += String.fromCharCode(...bytes.subarray(i, i + STEP));
	}
	return btoa(binary);
}

/**
 * @param {string} encoded
 * @returns {string}
 */
function decodePayload(encoded) {
	const binary = atob(encoded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new TextDecoder().decode(bytes);
}

function splitIntoChunks(str) {
	const chunks = [];
	for (let i = 0; i < str.length; i += CHUNK_SIZE) {
		chunks.push(str.slice(i, i + CHUNK_SIZE));
	}
	return chunks;
}

/**
 * Every `rg_sync_chunk_*` key currently in the sync area, including orphans
 * from backups written before this adapter reclaimed them.
 *
 * @returns {Promise<string[]>}
 */
async function listStoredChunkKeys() {
	const all = await browser.storage.sync.get(null);
	return Object.keys(all || {}).filter((key) =>
		key.startsWith(NATIVE_SYNC_CHUNK_PREFIX),
	);
}

/**
 * Bytes the sync area holds for keys that are not ours. Used to size the
 * payload budget against what is actually free rather than the raw quota.
 *
 * @returns {Promise<number>}
 */
async function foreignBytesInUse() {
	// getBytesInUse is optional in the WebExtensions spec; older Firefox lacks
	// it. Fall back to assuming the reserve covers whatever else is stored.
	if (typeof browser.storage.sync.getBytesInUse !== "function") return 0;
	try {
		const [total, ours] = await Promise.all([
			browser.storage.sync.getBytesInUse(null),
			listStoredChunkKeys().then((keys) =>
				browser.storage.sync.getBytesInUse([
					NATIVE_SYNC_META_KEY,
					...keys,
				]),
			),
		]);
		return Math.max(0, total - ours);
	} catch (error) {
		debugError("[NativeSync] Could not measure sync usage:", error);
		return 0;
	}
}

/**
 * Turn a browser quota/rate error into something a user can act on.
 *
 * @param {unknown} error
 * @returns {Error}
 */
function describeWriteFailure(error) {
	const message = String(error?.message || error || "");
	if (/MAX_WRITE_OPERATIONS|WRITE_OPERATIONS_PER/i.test(message)) {
		return new Error(
			"Browser sync is rate-limited right now. Wait a minute and sync again.",
		);
	}
	if (/QUOTA_BYTES_PER_ITEM/i.test(message)) {
		return new Error(
			"A sync chunk exceeded the per-key limit. Please report this — it is a bug.",
		);
	}
	if (/QUOTA_BYTES|quota exceeded/i.test(message)) {
		return new Error(
			"Browser sync storage is full. Clear it below, or switch to Google Drive, Dropbox, OneDrive or WebDAV for a larger library.",
		);
	}
	return error instanceof Error ? error : new Error(message);
}

export function createNativeSyncStorageAdapter() {
	// storage.sync allows roughly one write every two seconds. Uploads are
	// serialised through this chain so a burst of "Sync Now" clicks (or a
	// scheduled backup landing on top of one) queues instead of failing.
	let writeChain = Promise.resolve();
	let lastWriteAt = 0;

	function serializeWrite(task) {
		const run = writeChain.then(async () => {
			const wait =
				NATIVE_SYNC_MIN_WRITE_INTERVAL_MS - (Date.now() - lastWriteAt);
			if (wait > 0)
				await new Promise((resolve) => setTimeout(resolve, wait));
			try {
				return await task();
			} finally {
				lastWriteAt = Date.now();
			}
		});
		// Keep the chain alive after a failure so later writes still run.
		writeChain = run.catch(() => {});
		return run;
	}

	return {
		async uploadBackup(backupBlob) {
			let jsonStr;
			if (typeof backupBlob === "string") {
				jsonStr = backupBlob;
			} else if (
				typeof Blob !== "undefined" &&
				backupBlob instanceof Blob
			) {
				jsonStr = await backupBlob.text();
			} else {
				jsonStr = JSON.stringify(backupBlob);
			}

			const encoded = encodePayload(jsonStr);
			const chunks = splitIntoChunks(encoded);

			// Cost of what we are about to write: payload plus per-key overhead,
			// plus the meta record.
			const payloadCost =
				encoded.length + chunks.length * NATIVE_SYNC_KEY_OVERHEAD_BYTES;
			const metaCost = 128;
			const budget =
				NATIVE_SYNC_QUOTA_BYTES -
				NATIVE_SYNC_RESERVED_BYTES -
				(await foreignBytesInUse());

			if (payloadCost + metaCost > budget) {
				const usedKb = Math.round((payloadCost + metaCost) / 1024);
				const freeKb = Math.max(0, Math.round(budget / 1024));
				throw new Error(
					`Library is too large for browser sync (needs ~${usedKb} KB, ${freeKb} KB available). Switch to Google Drive, Dropbox, OneDrive or WebDAV for unlimited size.`,
				);
			}
			if (chunks.length + 1 > NATIVE_SYNC_MAX_ITEMS) {
				throw new Error(
					"Library needs more sync keys than the browser allows. Switch to a cloud provider.",
				);
			}

			return serializeWrite(async () => {
				const liveKeys = new Set(chunks.map((_, i) => chunkKey(i)));
				const staleKeys = (await listStoredChunkKeys()).filter(
					(key) => !liveKeys.has(key),
				);

				const batch = {
					[NATIVE_SYNC_META_KEY]: {
						totalChunks: chunks.length,
						timestamp: Date.now(),
						version: NATIVE_SYNC_SCHEMA_VERSION,
						encodedLength: encoded.length,
					},
				};
				chunks.forEach((chunk, i) => {
					batch[chunkKey(i)] = chunk;
				});

				try {
					// Write first, prune second: a crash in between leaves unused
					// chunks (reclaimed on the next upload) rather than a meta record
					// pointing at chunks that no longer exist.
					await browser.storage.sync.set(batch);
					if (staleKeys.length) {
						await browser.storage.sync.remove(staleKeys);
						debugLog(
							`[NativeSync] Reclaimed ${staleKeys.length} stale chunk key(s)`,
						);
					}
				} catch (error) {
					throw describeWriteFailure(error);
				}

				return { id: "native-sync", name: "native-sync-backup" };
			});
		},

		async listBackups() {
			const result = await browser.storage.sync.get(NATIVE_SYNC_META_KEY);
			const meta = result[NATIVE_SYNC_META_KEY];
			if (!meta) return [];
			return [
				{
					id: "native-sync",
					name: "Native Browser Sync",
					modifiedTime: meta.timestamp,
				},
			];
		},

		async downloadBackup(_fileId) {
			const metaResult =
				await browser.storage.sync.get(NATIVE_SYNC_META_KEY);
			const meta = metaResult[NATIVE_SYNC_META_KEY];
			if (!meta) throw new Error("No native sync backup found.");
			if (meta.version > NATIVE_SYNC_SCHEMA_VERSION) {
				throw new Error(
					`This backup was written by a newer version of the extension (format v${meta.version}). Update the extension to restore it.`,
				);
			}

			const chunkKeys = Array.from({ length: meta.totalChunks }, (_, i) =>
				chunkKey(i),
			);
			const chunkResult = await browser.storage.sync.get(chunkKeys);

			// A partially-replicated backup must fail loudly. Silently joining the
			// chunks that did arrive yields a truncated payload that then fails
			// somewhere far less obvious.
			const missing = chunkKeys.filter(
				(key) => typeof chunkResult[key] !== "string",
			);
			if (missing.length) {
				throw new Error(
					`Sync backup is incomplete: ${missing.length} of ${chunkKeys.length} chunks are missing. The browser may still be syncing — try again shortly.`,
				);
			}

			const assembled = chunkKeys.map((key) => chunkResult[key]).join("");
			if (meta.encodedLength && assembled.length !== meta.encodedLength) {
				throw new Error(
					"Sync backup failed its size check — the data is corrupt or still replicating.",
				);
			}

			try {
				return decodePayload(assembled);
			} catch (error) {
				debugError(
					"[NativeSync] Could not decode backup payload:",
					error,
				);
				throw new Error(
					"Sync backup could not be decoded — the data is corrupt.",
					{ cause: error },
				);
			}
		},

		async getLatestBackup() {
			const backups = await this.listBackups();
			return backups[0] ?? null;
		},

		async getContinuousBackup() {
			return this.getLatestBackup();
		},

		async ensureAuth() {
			return { success: true };
		},

		async resetAuth() {
			// Scan rather than trust the meta record: orphaned chunks are exactly
			// the case where the meta count is wrong.
			const keysToRemove = [
				NATIVE_SYNC_META_KEY,
				...(await listStoredChunkKeys()),
			];
			await browser.storage.sync.remove(keysToRemove);
			debugLog(`[NativeSync] Cleared ${keysToRemove.length} sync key(s)`);
			return { success: true };
		},
	};
}
