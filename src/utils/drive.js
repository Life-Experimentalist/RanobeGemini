// Google Drive auth + upload helper for RanobeGemini
// Uses identity.launchWebAuthFlow with PKCE and stores tokens in extension storage.

import { debugLog, debugError } from "./logger.js";
import { DEFAULT_DRIVE_CLIENT_ID } from "./constants.js";

const TOKEN_KEY = "driveAuthTokens";
const CLIENT_ID_KEY = "driveClientId";
const FOLDER_ID_KEY = "driveFolderId";
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
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

export async function saveDriveClientId(clientId) {
	await setStored({ [CLIENT_ID_KEY]: clientId || "" });
}

export async function getDriveClientId() {
	const stored = await getStored(CLIENT_ID_KEY);
	return stored || DEFAULT_DRIVE_CLIENT_ID;
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

async function exchangeAuthCode({ code, redirectUri, codeVerifier, clientId }) {
	const body = new URLSearchParams({
		client_id: clientId,
		code,
		code_verifier: codeVerifier,
		grant_type: "authorization_code",
		redirect_uri: redirectUri,
	});
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

async function refreshAccessToken({ refreshToken, clientId }) {
	const body = new URLSearchParams({
		client_id: clientId,
		refresh_token: refreshToken,
		grant_type: "refresh_token",
	});
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
}

export async function ensureDriveAccessToken({ interactive = false } = {}) {
	const clientId = (await getDriveClientId())?.trim();
	if (!clientId) throw new Error("Drive client ID missing");

	const redirectUri = browser.identity.getRedirectURL("drive");
	let tokens = await getTokens();
	if (isTokenValid(tokens)) return tokens.access_token;

	if (tokens?.refresh_token) {
		try {
			const refreshed = await refreshAccessToken({
				refreshToken: tokens.refresh_token,
				clientId,
			});
			const merged = {
				...refreshed,
				refresh_token: refreshed.refresh_token || tokens.refresh_token,
			};
			await storeTokens(merged);
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
		throw new Error("State mismatch during Drive auth");
	}
	const code = parsed.searchParams.get("code");
	if (!code) throw new Error("No auth code returned from Drive");
	const exchanged = await exchangeAuthCode({
		code,
		redirectUri,
		codeVerifier: verifier,
		clientId,
	});
	await storeTokens(exchanged);
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
	const { uploadLogsWithAdapter } = await import("./logger.js");
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
