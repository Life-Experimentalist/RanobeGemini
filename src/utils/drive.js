// Google Drive auth + upload helper for RanobeGemini
// Uses identity.launchWebAuthFlow with PKCE and stores tokens in extension storage.

import { debugLog, debugError, uploadLogsWithAdapter } from "./logger.js";
import {
	DEFAULT_DRIVE_CLIENT_ID,
	DRIVE_BACKUP_MAX_COUNT,
	DRIVE_BACKUP_PREFIX,
	DRIVE_CONTINUOUS_BACKUP_BASENAME,
	GOOGLE_OAUTH_SCOPES,
} from "./constants.js";

const TOKEN_KEY = "driveAuthTokens";
const AUTH_ERROR_KEY = "driveAuthError";
const CLIENT_ID_KEY = "driveClientId";
const CLIENT_SECRET_KEY = "driveClientSecret";
const FOLDER_ID_KEY = "driveFolderId";
const SCOPES = GOOGLE_OAUTH_SCOPES;
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

function getRandomString(length = 64) {
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(base) {
	const data = new TextEncoder().encode(base);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return new Uint8Array(hash);
}

function base64UrlEncode(buffer) {
	return btoa(String.fromCharCode(...buffer))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

async function createPkcePair() {
	const verifier = base64UrlEncode(
		new TextEncoder().encode(getRandomString(43))
	);
	const challengeBytes = await sha256(verifier);
	const challenge = base64UrlEncode(challengeBytes);
	return { verifier, challenge };
}

async function getStored(key) {
	const result = await browser.storage.local.get(key);
	return result?.[key];
}

async function setStored(map) {
	await browser.storage.local.set(map);
}

async function setAuthError(error) {
	if (!error) return;
	await setStored({
		[AUTH_ERROR_KEY]: {
			message: error?.message || String(error),
			at: Date.now(),
		},
	});
}

async function clearAuthError() {
	await setStored({ [AUTH_ERROR_KEY]: null });
}

export async function saveDriveClientId(clientId) {
	await setStored({ [CLIENT_ID_KEY]: clientId || "" });
}

export async function getDriveClientId() {
	const stored = await getStored(CLIENT_ID_KEY);
	return stored || DEFAULT_DRIVE_CLIENT_ID;
}

export async function saveDriveClientSecret(clientSecret) {
	await setStored({ [CLIENT_SECRET_KEY]: clientSecret || "" });
}

export async function getDriveClientSecret() {
	return getStored(CLIENT_SECRET_KEY);
}

export async function saveDriveFolderId(folderId) {
	await setStored({ [FOLDER_ID_KEY]: folderId || "" });
}

export async function getDriveFolderId() {
	return getStored(FOLDER_ID_KEY);
}

async function storeTokens(tokens) {
	if (!tokens) return;
	const expiresAt = tokens.expires_in
		? Date.now() + tokens.expires_in * 1000 - 60000 // renew 1 min early
		: Date.now() + 45 * 60 * 1000;
	await setStored({
		[TOKEN_KEY]: {
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			expires_at: expiresAt,
			token_type: tokens.token_type || "Bearer",
		},
	});
}

async function getTokens() {
	return getStored(TOKEN_KEY);
}

function isTokenValid(token) {
	return (
		token?.access_token &&
		token?.expires_at &&
		token.expires_at > Date.now()
	);
}

async function exchangeAuthCode({
	code,
	redirectUri,
	codeVerifier,
	clientId,
	clientSecret,
}) {
	const params = {
		client_id: clientId,
		code,
		code_verifier: codeVerifier,
		grant_type: "authorization_code",
		redirect_uri: redirectUri,
	};
	if (clientSecret) {
		params.client_secret = clientSecret;
	}
	const body = new URLSearchParams(params);
	const resp = await fetch(TOKEN_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});
	if (!resp.ok) {
		const errorText = await resp.text();
		throw new Error(`Token exchange failed: ${resp.status} ${errorText}`);
	}
	return resp.json();
}

async function refreshAccessToken({ refreshToken, clientId, clientSecret }) {
	const params = {
		client_id: clientId,
		refresh_token: refreshToken,
		grant_type: "refresh_token",
	};
	if (clientSecret) {
		params.client_secret = clientSecret;
	}
	const body = new URLSearchParams(params);
	const resp = await fetch(TOKEN_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});
	if (!resp.ok) {
		const errorText = await resp.text();
		throw new Error(`Refresh failed: ${resp.status} ${errorText}`);
	}
	return resp.json();
}

export async function revokeDriveTokens() {
	await setStored({ [TOKEN_KEY]: null });
	await clearAuthError();
}

export async function ensureDriveAccessToken({ interactive = false } = {}) {
	const clientId = (await getDriveClientId())?.trim();
	if (!clientId) throw new Error("Drive client ID missing");
	const clientSecret = (await getDriveClientSecret())?.trim();

	const redirectUri = browser.identity.getRedirectURL("drive");
	let tokens = await getTokens();
	if (isTokenValid(tokens)) return tokens.access_token;

	if (tokens?.refresh_token) {
		try {
			const refreshed = await refreshAccessToken({
				refreshToken: tokens.refresh_token,
				clientId,
				clientSecret,
			});
			const merged = {
				...refreshed,
				refresh_token: refreshed.refresh_token || tokens.refresh_token,
			};
			await storeTokens(merged);
			await clearAuthError();
			return merged.access_token;
		} catch (err) {
			debugError("Drive token refresh failed", err);
		}
	}

	if (!interactive) throw new Error("Drive auth required");

	const { verifier, challenge } = await createPkcePair();
	const state = getRandomString(16);
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: "code",
		scope: SCOPES.join(" "),
		access_type: "offline",
		prompt: "consent",
		state,
		code_challenge: challenge,
		code_challenge_method: "S256",
	});
	const authUrl = `${AUTH_ENDPOINT}?${params.toString()}`;
	const redirectUrl = await browser.identity.launchWebAuthFlow({
		url: authUrl,
		interactive: true,
	});
	const parsed = new URL(redirectUrl);
	if (parsed.searchParams.get("state") !== state) {
		const err = new Error("State mismatch during Drive auth");
		await setAuthError(err);
		throw err;
	}
	const code = parsed.searchParams.get("code");
	if (!code) {
		const err = new Error("No auth code returned from Drive");
		await setAuthError(err);
		throw err;
	}
	let exchanged;
	try {
		exchanged = await exchangeAuthCode({
			code,
			redirectUri,
			codeVerifier: verifier,
			clientId,
			clientSecret,
		});
	} catch (err) {
		await setAuthError(err);
		throw err;
	}
	await storeTokens(exchanged);
	await clearAuthError();
	return exchanged.access_token;
}

export async function uploadBlobToDrive(
	blob,
	{
		filename = "ranobe-logs.json",
		mimeType = "application/json",
		folderId,
	} = {}
) {
	const accessToken = await ensureDriveAccessToken({ interactive: true });
	const meta = { name: filename };
	const resolvedFolder = folderId || (await getDriveFolderId());
	if (resolvedFolder) meta.parents = [resolvedFolder];

	const boundary = `rgdrive-${Date.now()}`;
	const delimiter = `--${boundary}`;
	const closeDelimiter = `--${boundary}--`;
	const metadataPart = `${delimiter}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
		meta
	)}\r\n`;
	const dataPartHeader = `${delimiter}\r\nContent-Type: ${mimeType}\r\n\r\n`;
	const body = new Blob([
		metadataPart,
		dataPartHeader,
		blob,
		`\r\n${closeDelimiter}`,
	]);

	const resp = await fetch(
		"https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": `multipart/related; boundary=${boundary}`,
			},
			body,
		}
	);

	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`Drive upload failed: ${resp.status} ${text}`);
	}
	const json = await resp.json();
	return json;
}

export async function uploadLogsToDriveWithAdapter(adapterOptions = {}) {
	return uploadLogsWithAdapter(async (blob, meta) => {
		const filename =
			adapterOptions.filename || meta.filename || "ranobe-logs.json";
		const folderId = adapterOptions.folderId || (await getDriveFolderId());
		await uploadBlobToDrive(blob, {
			filename,
			mimeType: blob.type,
			folderId,
		});
	}, adapterOptions);
}

// Create or get Ranobe Gemini backup folder on Drive
export async function ensureBackupFolder() {
	const accessToken = await ensureDriveAccessToken({ interactive: false });
	let folderId = await getDriveFolderId();

	// If folder ID already stored, return it
	if (folderId) return folderId;

	try {
		// Search for existing Ranobe Gemini backup folder
		const searchQuery = encodeURIComponent(
			`name='Ranobe Gemini Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false`
		);
		const searchResp = await fetch(
			`https://www.googleapis.com/drive/v3/files?q=${searchQuery}&spaces=drive&fields=files(id,name)&pageSize=1`,
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			}
		);

		if (searchResp.ok) {
			const searchData = await searchResp.json();
			if (searchData.files && searchData.files.length > 0) {
				folderId = searchData.files[0].id;
				await saveDriveFolderId(folderId);
				return folderId;
			}
		}
	} catch (err) {
		debugError("Error searching for backup folder", err);
	}

	// Create new backup folder
	try {
		const createResp = await fetch(
			"https://www.googleapis.com/drive/v3/files?fields=id,name",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: "Ranobe Gemini Backups",
					mimeType: "application/vnd.google-apps.folder",
				}),
			}
		);

		if (!createResp.ok) {
			const err = await createResp.text();
			throw new Error(
				`Folder creation failed: ${createResp.status} ${err}`
			);
		}

		const createData = await createResp.json();
		folderId = createData.id;
		await saveDriveFolderId(folderId);
		return folderId;
	} catch (err) {
		debugError("Failed to create backup folder", err);
		throw err;
	}
}

// Find an existing backup by name within the Drive folder
async function findDriveBackupByName(folderId, filename) {
	const accessToken = await ensureDriveAccessToken({ interactive: false });
	const safeName = filename.replace(/'/g, "\\'");
	const query = encodeURIComponent(
		`'${folderId}' in parents and name='${safeName}' and trashed=false`
	);

	const resp = await fetch(
		`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime,webViewLink)&pageSize=1`,
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		}
	);

	if (!resp.ok) return null;
	const data = await resp.json();
	return data.files?.[0] || null;
}

async function updateDriveFile(fileId, blob, { filename, mimeType }) {
	const accessToken = await ensureDriveAccessToken({ interactive: false });
	const boundary = `rgdrive-update-${Date.now()}`;
	const delimiter = `--${boundary}`;
	const closeDelimiter = `--${boundary}--`;
	const metadataPart = `${delimiter}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
		{
			name: filename,
		}
	)}\r\n`;
	const dataPartHeader = `${delimiter}\r\nContent-Type: ${mimeType}\r\n\r\n`;
	const body = new Blob([
		metadataPart,
		dataPartHeader,
		blob,
		`\r\n${closeDelimiter}`,
	]);

	const resp = await fetch(
		`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,webViewLink,modifiedTime`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": `multipart/related; boundary=${boundary}`,
			},
			body,
		}
	);

	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`Drive update failed: ${resp.status} ${text}`);
	}

	return resp.json();
}

// Delete oldest backups to maintain a fixed count (excludes the continuous file)
async function enforceBackupLimit(folderId) {
	// Fixed quota per Google Account: 4 manual backups (daily auto + user-created)
	// Continuous backup is handled separately and not counted here
	const MAX_MANUAL_BACKUPS = 4;

	const accessToken = await ensureDriveAccessToken({ interactive: false });
	const query = encodeURIComponent(
		`'${folderId}' in parents and name contains '${DRIVE_BACKUP_PREFIX}' and trashed=false`,
	);

	const resp = await fetch(
		`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=50`,
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);

	if (!resp.ok) return;
	const data = await resp.json();

	// Filter out continuous backup file - it has separate lifecycle
	const manualBackups = (data.files || []).filter(
		(file) => file.name !== DRIVE_CONTINUOUS_BACKUP_BASENAME,
	);

	debugLog(
		`📦 Google Drive backups: ${manualBackups.length} manual backups found (max: ${MAX_MANUAL_BACKUPS})`,
	);

	// If we're within the limit, no cleanup needed
	if (manualBackups.length <= MAX_MANUAL_BACKUPS) return;

	// Delete oldest manual backups exceeding the quota
	const toDelete = manualBackups.slice(MAX_MANUAL_BACKUPS);
	debugLog(
		`🗑️ Deleting ${toDelete.length} old backup(s) to enforce quota (4 manual per account)`,
	);

	for (const file of toDelete) {
		try {
			await fetch(
				`https://www.googleapis.com/drive/v3/files/${file.id}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${accessToken}` },
				},
			);
			debugLog(`✅ Deleted old backup: ${file.name}`);
		} catch (delErr) {
			debugError(`Failed to delete old backup ${file.id}`, delErr);
		}
	}
}

// Upload library backup with version naming and fixed-count retention
export async function uploadLibraryBackupToDrive(backupBlob, options = {}) {
	const folderId = options.folderId || (await ensureBackupFolder());
	const variant =
		options.variant === "continuous" ? "continuous" : "versioned";
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const filename =
		variant === "continuous"
			? DRIVE_CONTINUOUS_BACKUP_BASENAME
			: `${DRIVE_BACKUP_PREFIX}${timestamp}.json`;

	try {
		if (variant === "continuous") {
			const existing = await findDriveBackupByName(folderId, filename);
			if (existing?.id) {
				return updateDriveFile(existing.id, backupBlob, {
					filename,
					mimeType: "application/json",
				});
			}
		}

		const result = await uploadBlobToDrive(backupBlob, {
			filename,
			mimeType: "application/json",
			folderId,
		});

		if (variant !== "continuous") {
			await enforceBackupLimit(folderId);
		}

		return result;
	} catch (err) {
		debugError("Drive backup upload failed", err);
		throw err;
	}
}

// List all backups in the folder (includes continuous file)
export async function listDriveBackups() {
	const accessToken = await ensureDriveAccessToken({ interactive: false });
	const folderId = await getDriveFolderId();

	if (!folderId) return [];

	try {
		const query = encodeURIComponent(
			`'${folderId}' in parents and name contains '${DRIVE_BACKUP_PREFIX}' and trashed=false`
		);
		const resp = await fetch(
			`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,createdTime,modifiedTime,size,webViewLink)&orderBy=modifiedTime%20desc&pageSize=50`,
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			}
		);

		if (!resp.ok) return [];
		const data = await resp.json();
		return data.files || [];
	} catch (err) {
		debugError("Failed to list backups", err);
		return [];
	}
}

export async function getContinuousDriveBackup() {
	const folderId = await getDriveFolderId();
	if (!folderId) return null;
	try {
		return await findDriveBackupByName(
			folderId,
			DRIVE_CONTINUOUS_BACKUP_BASENAME,
		);
	} catch (err) {
		debugError("Failed to find continuous backup", err);
		return null;
	}
}

export async function getLatestDriveBackup() {
	try {
		const backups = await listDriveBackups();
		return backups?.[0] || null;
	} catch (err) {
		debugError("Failed to find latest backup", err);
		return null;
	}
}

// Download a specific backup
export async function downloadDriveBackup(fileId) {
	const accessToken = await ensureDriveAccessToken({ interactive: false });
	try {
		const resp = await fetch(
			`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			}
		);

		if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
		return resp.json();
	} catch (err) {
		debugError("Failed to download backup", err);
		throw err;
	}
}
