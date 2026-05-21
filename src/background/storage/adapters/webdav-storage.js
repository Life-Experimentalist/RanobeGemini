/**
 * WebDAV storage adapter for Ranobe Gemini.
 * Stores backups on any WebDAV-compatible server (Nextcloud, ownCloud, NAS, etc.)
 * using HTTP basic auth. Credentials are stored in browser.storage.local.
 */

const CREDS_KEY = "webdavCredentials";

// ─── Credential helpers ────────────────────────────────────────────────────────

async function loadCredentials() {
	const result = await browser.storage.local.get(CREDS_KEY);
	return result?.[CREDS_KEY] || null;
}

export async function saveWebdavCredentials({ serverUrl, username, password, path = "/" }) {
	const normalized = serverUrl.replace(/\/+$/, "");
	await browser.storage.local.set({
		[CREDS_KEY]: { serverUrl: normalized, username, password, path },
	});
}

export async function clearWebdavCredentials() {
	await browser.storage.local.remove(CREDS_KEY);
}

export async function getWebdavCredentials() {
	return loadCredentials();
}

// ─── Internal HTTP helpers ─────────────────────────────────────────────────────

function authHeader(username, password) {
	return "Basic " + btoa(`${username}:${password}`);
}

function resolveBackupPath(creds, customPath) {
	const basePath = (customPath || creds.path || "/").replace(/\/+$/, "");
	return basePath;
}

function backupUrl(creds, customPath, fileName = "") {
	const base = creds.serverUrl;
	const dir = resolveBackupPath(creds, customPath);
	return fileName ? `${base}${dir}/${fileName}` : `${base}${dir}/`;
}

async function davRequest(method, url, { auth, body, headers = {} } = {}) {
	const resp = await fetch(url, {
		method,
		headers: {
			Authorization: auth,
			...headers,
		},
		body: body ?? undefined,
	});
	if (!resp.ok) {
		throw new Error(`WebDAV ${method} ${url} → ${resp.status} ${resp.statusText}`);
	}
	return resp;
}

// ─── PROPFIND parser (minimal — extracts file names and dates) ─────────────────

function parsePropfindXml(xmlText) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xmlText, "application/xml");
	const responses = Array.from(doc.querySelectorAll("response, d\\:response"));

	return responses
		.map((r) => {
			const href = r.querySelector("href, d\\:href")?.textContent?.trim() || "";
			const displayName =
				r.querySelector("displayname, d\\:displayname")?.textContent?.trim() ||
				href.split("/").pop() || "";
			const lastModified =
				r.querySelector("getlastmodified, d\\:getlastmodified")?.textContent?.trim() || "";
			const contentLength =
				r.querySelector("getcontentlength, d\\:getcontentlength")?.textContent?.trim() || "0";
			const isCollection =
				r.querySelector("collection, d\\:collection") != null ||
				href.endsWith("/");
			return {
				href,
				name: displayName,
				lastModified,
				size: parseInt(contentLength, 10) || 0,
				isCollection,
			};
		})
		.filter((f) => !f.isCollection && f.name);
}

// ─── Backup name helpers ───────────────────────────────────────────────────────

const BACKUP_PREFIX = "ranobegemini_backup_";
const CONTINUOUS_NAME = "ranobegemini_continuous.json";

function timestampedName() {
	const now = new Date();
	const ts = now
		.toISOString()
		.replace(/[:.]/g, "-")
		.replace("T", "_")
		.slice(0, 19);
	return `${BACKUP_PREFIX}${ts}.json`;
}

function isBackupFile(name) {
	return name.startsWith(BACKUP_PREFIX) && name.endsWith(".json");
}

// ─── Adapter factory ───────────────────────────────────────────────────────────

export function createWebdavStorageAdapter() {
	async function requireCreds(options = {}) {
		// Allow per-call credential override (for testing or multi-destination)
		if (options.credentials) return options.credentials;
		const creds = await loadCredentials();
		if (!creds?.serverUrl || !creds?.username) {
			throw new Error(
				"WebDAV credentials not configured. Set server URL and username in Library Settings → Sync.",
			);
		}
		return creds;
	}

	async function ensureDirectory(creds, customPath) {
		const dirUrl = backupUrl(creds, customPath);
		const auth = authHeader(creds.username, creds.password);
		// Check if directory exists via PROPFIND depth 0
		try {
			await fetch(dirUrl, {
				method: "PROPFIND",
				headers: { Authorization: auth, Depth: "0" },
			});
		} catch (_err) {
			// Ignore — directory will be created on first MKCOL
		}
		// Attempt MKCOL (create collection); 405 Method Not Allowed means it already exists
		const resp = await fetch(dirUrl, {
			method: "MKCOL",
			headers: { Authorization: auth },
		});
		if (!resp.ok && resp.status !== 405 && resp.status !== 301 && resp.status !== 302) {
			// 405 = already exists, which is fine
			throw new Error(`WebDAV MKCOL ${dirUrl} → ${resp.status} ${resp.statusText}`);
		}
	}

	return {
		async uploadBackup(backupBlob, options = {}) {
			const creds = await requireCreds(options);
			const customPath = options.customPath;

			await ensureDirectory(creds, customPath);

			const fileName = timestampedName();
			const fileUrl = backupUrl(creds, customPath, fileName);
			const auth = authHeader(creds.username, creds.password);

			const bodyData =
				backupBlob instanceof Blob
					? await backupBlob.text()
					: typeof backupBlob === "string"
						? backupBlob
						: JSON.stringify(backupBlob);

			await davRequest("PUT", fileUrl, {
				auth,
				body: bodyData,
				headers: { "Content-Type": "application/json" },
			});

			// Also update continuous backup file
			const continuousUrl = backupUrl(creds, customPath, CONTINUOUS_NAME);
			await davRequest("PUT", continuousUrl, {
				auth,
				body: bodyData,
				headers: { "Content-Type": "application/json" },
			}).catch(() => {}); // best-effort

			return { fileId: fileUrl, fileName };
		},

		async listBackups(options = {}) {
			const creds = await requireCreds(options);
			const customPath = options.customPath;
			const dirUrl = backupUrl(creds, customPath);
			const auth = authHeader(creds.username, creds.password);

			const resp = await davRequest("PROPFIND", dirUrl, {
				auth,
				headers: {
					Depth: "1",
					"Content-Type": "application/xml",
				},
				body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop><displayname/><getlastmodified/><getcontentlength/><resourcetype/></prop>
</propfind>`,
			});

			const xml = await resp.text();
			const files = parsePropfindXml(xml)
				.filter((f) => isBackupFile(f.name))
				.sort((a, b) => b.lastModified.localeCompare(a.lastModified));

			return files.map((f) => ({
				id: backupUrl(creds, customPath, f.name),
				name: f.name,
				modifiedTime: f.lastModified,
				size: f.size,
			}));
		},

		async downloadBackup(fileId, options = {}) {
			const creds = await requireCreds(options);
			const auth = authHeader(creds.username, creds.password);
			// fileId is the full URL for WebDAV
			const url = fileId.startsWith("http") ? fileId : backupUrl(creds, options.customPath, fileId);
			const resp = await davRequest("GET", url, { auth });
			return resp.text();
		},

		async getLatestBackup(options = {}) {
			const backups = await this.listBackups(options);
			return backups.length ? backups[0] : null;
		},

		async getContinuousBackup(options = {}) {
			const creds = await requireCreds(options);
			const customPath = options.customPath;
			const auth = authHeader(creds.username, creds.password);
			const url = backupUrl(creds, customPath, CONTINUOUS_NAME);
			try {
				const resp = await fetch(url, { headers: { Authorization: auth } });
				if (!resp.ok) return null;
				return { id: url, name: CONTINUOUS_NAME };
			} catch (_err) {
				return null;
			}
		},

		async ensureAuth() {
			// WebDAV uses basic auth — verify credentials by doing a PROPFIND on the root
			const creds = await loadCredentials();
			if (!creds?.serverUrl) {
				throw new Error("WebDAV credentials not configured.");
			}
			const auth = authHeader(creds.username, creds.password);
			const resp = await fetch(creds.serverUrl + "/", {
				method: "PROPFIND",
				headers: { Authorization: auth, Depth: "0" },
			});
			if (!resp.ok) {
				throw new Error(
					`WebDAV authentication failed: ${resp.status} ${resp.statusText}`,
				);
			}
			return { success: true };
		},

		async resetAuth() {
			await clearWebdavCredentials();
			return { success: true };
		},
	};
}
