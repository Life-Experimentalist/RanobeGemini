/**
 * Dropbox integration for Ranobe Gemini.
 * Uses PKCE OAuth2 flow via browser.identity.launchWebAuthFlow.
 * User must supply their own Dropbox app key (client_id).
 */

import {
	createPkcePair,
	launchOAuthPkceFlow,
	launchOAuthTabFlow,
	exchangeCodeForTokens,
	refreshAccessToken,
} from "./oauth-pkce.js";
import { OAUTH_REDIRECT_URIS } from "./constants.js";

const TOKEN_KEY = "dropboxAuthTokens";
const AUTH_ERROR_KEY = "dropboxAuthError";
const CONFIG_KEY = "dropboxConfig";

const AUTH_ENDPOINT = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_ENDPOINT = "https://api.dropboxapi.com/oauth2/token";
const API_BASE = "https://api.dropboxapi.com/2";
const CONTENT_BASE = "https://content.dropboxapi.com/2";

const BACKUP_PREFIX = "ranobegemini_backup_";
const CONTINUOUS_NAME = "ranobegemini_continuous.json";
const DEFAULT_FOLDER = "/RanobeGemini";

// ─── Config helpers ────────────────────────────────────────────────────────────

async function getStored(key) {
	const result = await browser.storage.local.get(key);
	return result?.[key];
}

async function setStored(map) {
	await browser.storage.local.set(map);
}

export async function saveDropboxConfig({ clientId, folderPath }) {
	const normalized = (folderPath || DEFAULT_FOLDER).replace(/\/+$/, "");
	await setStored({ [CONFIG_KEY]: { clientId, folderPath: normalized || DEFAULT_FOLDER } });
}

export async function getDropboxConfig() {
	return (await getStored(CONFIG_KEY)) || null;
}

async function getTokens() {
	return (await getStored(TOKEN_KEY)) || null;
}

async function saveTokens(tokens) {
	await setStored({ [TOKEN_KEY]: { ...tokens, savedAt: Date.now() } });
}

async function clearTokens() {
	await setStored({ [TOKEN_KEY]: null });
}

function isExpired(tokens) {
	if (!tokens?.savedAt || !tokens?.expires_in) return false; // offline tokens don't expire
	const elapsed = (Date.now() - tokens.savedAt) / 1000;
	return elapsed >= tokens.expires_in - 60;
}

// ─── Auth flow ─────────────────────────────────────────────────────────────────

async function getValidAccessToken({ interactive = true } = {}) {
	const config = await getDropboxConfig();
	if (!config?.clientId) {
		throw new Error(
			"Dropbox app key not configured. Set it in Library Settings → Sync.",
		);
	}

	let tokens = await getTokens();

	if (tokens?.access_token && !isExpired(tokens)) {
		return tokens.access_token;
	}

	if (tokens?.refresh_token) {
		try {
			const refreshed = await refreshAccessToken({
				tokenEndpoint: TOKEN_ENDPOINT,
				clientId: config.clientId,
				refreshToken: tokens.refresh_token,
			});
			const merged = { ...tokens, ...refreshed };
			await saveTokens(merged);
			return merged.access_token;
		} catch (_err) {
			await clearTokens();
		}
	}

	if (!interactive) {
		throw new Error("Dropbox authentication required but interactive mode disabled.");
	}

	const { verifier, challenge } = await createPkcePair();
	const redirectUri = OAUTH_REDIRECT_URIS.web;

	let code;
	try {
		code = await launchOAuthPkceFlow({
			authEndpoint: AUTH_ENDPOINT,
			clientId: config.clientId,
			redirectUri,
			scope: "files.content.read files.content.write account_info.read",
			challenge,
			extra: { token_access_type: "offline" },
		});
	} catch (_webAuthErr) {
		code = await launchOAuthTabFlow({
			authEndpoint: AUTH_ENDPOINT,
			clientId: config.clientId,
			redirectUri,
			scope: "files.content.read files.content.write account_info.read",
			challenge,
			extra: { token_access_type: "offline" },
		});
	}

	const newTokens = await exchangeCodeForTokens({
		tokenEndpoint: TOKEN_ENDPOINT,
		clientId: config.clientId,
		redirectUri,
		code,
		verifier,
	});

	await saveTokens(newTokens);
	await setStored({ [AUTH_ERROR_KEY]: null });
	return newTokens.access_token;
}

export async function ensureDropboxAccessToken({ interactive = true } = {}) {
	try {
		return await getValidAccessToken({ interactive });
	} catch (err) {
		await setStored({
			[AUTH_ERROR_KEY]: { message: err?.message || String(err), at: Date.now() },
		});
		throw err;
	}
}

export async function revokeDropboxTokens() {
	const tokens = await getTokens();
	if (tokens?.access_token) {
		await fetch(`${API_BASE}/auth/token/revoke`, {
			method: "POST",
			headers: { Authorization: `Bearer ${tokens.access_token}` },
		}).catch(() => {});
	}
	await clearTokens();
	await setStored({ [AUTH_ERROR_KEY]: null });
}

// ─── Dropbox API helpers ───────────────────────────────────────────────────────

async function dbxRequest(path, body, token) {
	const resp = await fetch(`${API_BASE}${path}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!resp.ok) {
		const text = await resp.text().catch(() => "");
		throw new Error(`Dropbox API ${path} → ${resp.status}: ${text}`);
	}
	return resp.json();
}

// ─── Backup name helpers ───────────────────────────────────────────────────────

function timestampedName() {
	const ts = new Date()
		.toISOString()
		.replace(/[:.]/g, "-")
		.replace("T", "_")
		.slice(0, 19);
	return `${BACKUP_PREFIX}${ts}.json`;
}

function isBackupFile(name) {
	return name.startsWith(BACKUP_PREFIX) && name.endsWith(".json");
}

function folderPrefix(customPath) {
	const folder = (customPath || DEFAULT_FOLDER).replace(/\/+$/, "");
	return folder.startsWith("/") ? folder : `/${folder}`;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function uploadDropboxBackup(backupData, options = {}) {
	const token = await ensureDropboxAccessToken({ interactive: true });
	const folder = folderPrefix(options.customPath);
	const fileName = timestampedName();
	const path = `${folder}/${fileName}`;

	const content =
		typeof backupData === "string"
			? backupData
			: backupData instanceof Blob
				? await backupData.text()
				: JSON.stringify(backupData);

	// Use Dropbox upload API (files/upload)
	const uploadResp = await fetch(`${CONTENT_BASE}/files/upload`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/octet-stream",
			"Dropbox-API-Arg": JSON.stringify({
				path,
				mode: "add",
				autorename: true,
				mute: true,
			}),
		},
		body: content,
	});
	if (!uploadResp.ok) {
		const text = await uploadResp.text().catch(() => "");
		throw new Error(`Dropbox upload failed ${uploadResp.status}: ${text}`);
	}
	const item = await uploadResp.json();

	// Update continuous backup
	const continuousPath = `${folder}/${CONTINUOUS_NAME}`;
	await fetch(`${CONTENT_BASE}/files/upload`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/octet-stream",
			"Dropbox-API-Arg": JSON.stringify({
				path: continuousPath,
				mode: "overwrite",
				mute: true,
			}),
		},
		body: content,
	}).catch(() => {});

	return { fileId: item.id || path, fileName };
}

export async function listDropboxBackups(options = {}) {
	const token = await ensureDropboxAccessToken({ interactive: false });
	const folder = folderPrefix(options.customPath);

	let entries = [];
	try {
		const data = await dbxRequest("/files/list_folder", { path: folder }, token);
		entries = data.entries || [];
		// Handle pagination
		let cursor = data.cursor;
		while (data.has_more && cursor) {
			const more = await dbxRequest("/files/list_folder/continue", { cursor }, token);
			entries = entries.concat(more.entries || []);
			cursor = more.cursor;
			if (!more.has_more) break;
		}
	} catch (err) {
		if (err?.message?.includes("not_found") || err?.message?.includes("path/not_found")) {
			return [];
		}
		throw err;
	}

	return entries
		.filter((e) => e[".tag"] === "file" && isBackupFile(e.name))
		.sort((a, b) => new Date(b.server_modified) - new Date(a.server_modified))
		.map((f) => ({
			id: f.id,
			name: f.name,
			modifiedTime: f.server_modified,
			size: f.size,
			path: f.path_lower,
		}));
}

export async function downloadDropboxBackup(fileId) {
	const token = await ensureDropboxAccessToken({ interactive: false });
	// fileId can be a Dropbox file id or a path
	const arg = fileId.startsWith("/") ? { path: fileId } : { path: `id:${fileId}` };
	const resp = await fetch(`${CONTENT_BASE}/files/download`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Dropbox-API-Arg": JSON.stringify(arg),
		},
	});
	if (!resp.ok) {
		const text = await resp.text().catch(() => "");
		throw new Error(`Dropbox download failed ${resp.status}: ${text}`);
	}
	return resp.text();
}

export async function getLatestDropboxBackup(options = {}) {
	const backups = await listDropboxBackups(options);
	return backups.length ? backups[0] : null;
}

export async function getContinuousDropboxBackup(options = {}) {
	const token = await ensureDropboxAccessToken({ interactive: false });
	const folder = folderPrefix(options.customPath);
	const path = `${folder}/${CONTINUOUS_NAME}`;

	try {
		const data = await dbxRequest("/files/get_metadata", { path }, token);
		return data ? { id: data.id || path, name: data.name } : null;
	} catch (_err) {
		return null;
	}
}
