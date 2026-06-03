/**
 * Microsoft OneDrive (Microsoft Graph) integration for Ranobe Gemini.
 * Uses PKCE OAuth2 flow via browser.identity.launchWebAuthFlow.
 * User must supply their own Azure app client_id.
 */

import {
	createPkcePair,
	launchOAuthPkceFlow,
	exchangeCodeForTokens,
	refreshAccessToken,
} from "./oauth-pkce.js";
import { OAUTH_REDIRECT_URIS } from "./constants.js";

const TOKEN_KEY = "onedriveAuthTokens";
const AUTH_ERROR_KEY = "onedriveAuthError";
const CONFIG_KEY = "onedriveConfig";

const AUTH_ENDPOINT =
	"https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_ENDPOINT =
	"https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = "Files.ReadWrite offline_access User.Read";

const BACKUP_PREFIX = "ranobegemini_backup_";
const CONTINUOUS_NAME = "ranobegemini_continuous.json";
const DEFAULT_FOLDER = "RanobeGemini";

// \u{2500}\u{2500}\u{2500} Credential / config helpers \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

async function getStored(key) {
	const result = await browser.storage.local.get(key);
	return result?.[key];
}

async function setStored(map) {
	await browser.storage.local.set(map);
}

export async function saveOnedriveConfig({ clientId, folderPath }) {
	await setStored({ [CONFIG_KEY]: { clientId, folderPath: folderPath || DEFAULT_FOLDER } });
}

export async function getOnedriveConfig() {
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
	if (!tokens?.savedAt || !tokens?.expires_in) return true;
	const elapsed = (Date.now() - tokens.savedAt) / 1000;
	return elapsed >= tokens.expires_in - 60;
}

// \u{2500}\u{2500}\u{2500} Auth flow \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

async function getValidAccessToken({ interactive = true } = {}) {
	const config = await getOnedriveConfig();
	if (!config?.clientId) {
		throw new Error(
			"OneDrive client ID not configured. Set it in Library Settings \u{2192} Sync.",
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
		throw new Error("OneDrive authentication required but interactive mode disabled.");
	}

	const { verifier, challenge } = await createPkcePair();
	const redirectUri = OAUTH_REDIRECT_URIS.web;

	const code = await launchOAuthPkceFlow({
		authEndpoint: AUTH_ENDPOINT,
		clientId: config.clientId,
		redirectUri,
		scope: SCOPES,
		challenge,
		extra: { response_mode: "query" },
	});

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

export async function ensureOnedriveAccessToken({ interactive = true } = {}) {
	try {
		const token = await getValidAccessToken({ interactive });
		return token;
	} catch (err) {
		await setStored({
			[AUTH_ERROR_KEY]: { message: err?.message || String(err), at: Date.now() },
		});
		throw err;
	}
}

export async function revokeOnedriveTokens() {
	await clearTokens();
	await setStored({ [AUTH_ERROR_KEY]: null });
}

// \u{2500}\u{2500}\u{2500} Graph API helpers \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

async function graphRequest(method, path, { token, body, headers = {} } = {}) {
	const resp = await fetch(`${GRAPH_BASE}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...headers,
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	if (!resp.ok) {
		const text = await resp.text().catch(() => "");
		throw new Error(`OneDrive Graph ${method} ${path} \u{2192} ${resp.status}: ${text}`);
	}
	return resp;
}

async function ensureFolder(token, folderPath) {
	const pathSegments = folderPath.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
	if (!pathSegments.length) return "/me/drive/root";

	const encodedPath = pathSegments.map(encodeURIComponent).join("/");
	const folderRef = `/me/drive/root:/${encodedPath}:`;

	// Fast path: folder already exists
	const checkResp = await fetch(`${GRAPH_BASE}${folderRef}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (checkResp.ok) return folderRef;

	// Create each path segment in order
	const created = [];
	for (const seg of pathSegments) {
		const parentRef =
			created.length === 0
				? "/me/drive/root/children"
				: `/me/drive/root:/${created.map(encodeURIComponent).join("/")}:/children`;
		created.push(seg);

		const createResp = await fetch(`${GRAPH_BASE}${parentRef}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: seg,
				folder: {},
				"@microsoft.graph.conflictBehavior": "fail",
			}),
		});
		// 409 Conflict means folder already exists \u{2014} OK to continue
		if (!createResp.ok && createResp.status !== 409) {
			const text = await createResp.text().catch(() => "");
			throw new Error(
				`OneDrive folder creation failed ${createResp.status}: ${text}`,
			);
		}
	}
	return folderRef;
}

// \u{2500}\u{2500}\u{2500} Backup name helpers \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

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

// \u{2500}\u{2500}\u{2500} Public API \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}

export async function uploadOnedriveBackup(backupData, options = {}) {
	const token = await ensureOnedriveAccessToken({ interactive: true });
	const config = await getOnedriveConfig();
	const folderPath = options.customPath || config?.folderPath || DEFAULT_FOLDER;

	const folderRef = await ensureFolder(token, folderPath);
	const fileName = timestampedName();

	const content =
		typeof backupData === "string"
			? backupData
			: backupData instanceof Blob
				? await backupData.text()
				: JSON.stringify(backupData);

	// Upload using simple PUT (< 4 MB is fine for library backups)
	// folderRef ends with ":" e.g. "/me/drive/root:/Folder:" \u{2014} strip it to build the file path
	const folderBase = folderRef.replace(/:$/, "");
	const uploadPath = `${folderBase}/${encodeURIComponent(fileName)}:/content`;
	const resp = await fetch(`${GRAPH_BASE}${uploadPath}`, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: content,
	});
	if (!resp.ok) {
		const text = await resp.text().catch(() => "");
		throw new Error(`OneDrive upload failed ${resp.status}: ${text}`);
	}
	const item = await resp.json();

	// Update continuous backup
	const continuousPath = `${folderBase}/${encodeURIComponent(CONTINUOUS_NAME)}:/content`;
	await fetch(`${GRAPH_BASE}${continuousPath}`, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: content,
	}).catch(() => {});

	return { fileId: item.id, fileName };
}

export async function listOnedriveBackups(options = {}) {
	const token = await ensureOnedriveAccessToken({ interactive: false });
	const config = await getOnedriveConfig();
	const folderPath = options.customPath || config?.folderPath || DEFAULT_FOLDER;

	const folderRef = await ensureFolder(token, folderPath);
	const childrenPath = `${folderRef}/children`;

	const resp = await graphRequest("GET", childrenPath, { token });
	const data = await resp.json();

	return (data.value || [])
		.filter((f) => isBackupFile(f.name))
		.sort((a, b) =>
			new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime),
		)
		.map((f) => ({
			id: f.id,
			name: f.name,
			modifiedTime: f.lastModifiedDateTime,
			size: f.size,
		}));
}

export async function downloadOnedriveBackup(fileId) {
	const token = await ensureOnedriveAccessToken({ interactive: false });
	const resp = await graphRequest("GET", `/me/drive/items/${fileId}/content`, {
		token,
	});
	return resp.text();
}

export async function getLatestOnedriveBackup(options = {}) {
	const backups = await listOnedriveBackups(options);
	return backups.length ? backups[0] : null;
}

export async function getContinuousOnedriveBackup(options = {}) {
	const token = await ensureOnedriveAccessToken({ interactive: false });
	const config = await getOnedriveConfig();
	const folderPath = options.customPath || config?.folderPath || DEFAULT_FOLDER;
	const folderRef = await ensureFolder(token, folderPath);

	try {
		const folderBase = folderRef.replace(/:$/, "");
		const resp = await fetch(
			`${GRAPH_BASE}${folderBase}/${encodeURIComponent(CONTINUOUS_NAME)}:`,
			{ headers: { Authorization: `Bearer ${token}` } },
		);
		if (!resp.ok) return null;
		const item = await resp.json();
		return { id: item.id, name: item.name };
	} catch (_err) {
		return null;
	}
}
