const META_KEY = "rg_sync_meta";
const CHUNK_PREFIX = "rg_sync_chunk_";
const CHUNK_SIZE = 7000;
const MAX_PAYLOAD_BYTES = 90_000;

function encodePayload(jsonStr) {
	return btoa(unescape(encodeURIComponent(jsonStr)));
}

function decodePayload(encoded) {
	return decodeURIComponent(escape(atob(encoded)));
}

function splitIntoChunks(str) {
	const chunks = [];
	for (let i = 0; i < str.length; i += CHUNK_SIZE) {
		chunks.push(str.slice(i, i + CHUNK_SIZE));
	}
	return chunks;
}

export function createNativeSyncStorageAdapter() {
	return {
		async uploadBackup(backupBlob) {
			let jsonStr;
			if (typeof backupBlob === "string") {
				jsonStr = backupBlob;
			} else if (backupBlob instanceof Blob) {
				jsonStr = await backupBlob.text();
			} else {
				jsonStr = JSON.stringify(backupBlob);
			}

			const encoded = encodePayload(jsonStr);
			if (encoded.length > MAX_PAYLOAD_BYTES) {
				throw new Error(
					"Library too large for native sync — use Google Drive or Dropbox instead.",
				);
			}

			const chunks = splitIntoChunks(encoded);
			const timestamp = Date.now();
			const batch = {
				[META_KEY]: { totalChunks: chunks.length, timestamp, version: 1 },
			};
			chunks.forEach((chunk, i) => {
				batch[`${CHUNK_PREFIX}${i}`] = chunk;
			});

			await browser.storage.sync.set(batch);
			return { id: "native-sync", name: "native-sync-backup" };
		},

		async listBackups() {
			const result = await browser.storage.sync.get(META_KEY);
			const meta = result[META_KEY];
			if (!meta) return [];
			return [{ id: "native-sync", name: "Native Browser Sync", modifiedTime: meta.timestamp }];
		},

		async downloadBackup(_fileId) {
			const metaResult = await browser.storage.sync.get(META_KEY);
			const meta = metaResult[META_KEY];
			if (!meta) throw new Error("No native sync backup found.");

			const chunkKeys = Array.from(
				{ length: meta.totalChunks },
				(_, i) => `${CHUNK_PREFIX}${i}`,
			);
			const chunkResult = await browser.storage.sync.get(chunkKeys);
			const assembled = chunkKeys.map((k) => chunkResult[k] || "").join("");
			return decodePayload(assembled);
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
			const metaResult = await browser.storage.sync.get(META_KEY);
			const meta = metaResult[META_KEY];
			const keysToRemove = [META_KEY];
			if (meta?.totalChunks) {
				for (let i = 0; i < meta.totalChunks; i++) {
					keysToRemove.push(`${CHUNK_PREFIX}${i}`);
				}
			}
			await browser.storage.sync.remove(keysToRemove);
			return { success: true };
		},
	};
}
