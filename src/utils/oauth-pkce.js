/**
 * Shared OAuth2 PKCE helpers used by storage provider adapters.
 * Mirrors the pattern in drive.js but extracted for reuse.
 */

export function getRandomString(length = 64) {
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(base) {
	const data = new TextEncoder().encode(base);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return new Uint8Array(hash);
}

export function base64UrlEncode(buffer) {
	return btoa(String.fromCharCode(...buffer))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export async function createPkcePair() {
	const verifier = base64UrlEncode(
		new TextEncoder().encode(getRandomString(43)),
	);
	const challengeBytes = await sha256(verifier);
	const challenge = base64UrlEncode(challengeBytes);
	return { verifier, challenge };
}

/**
 * Launch the OAuth2 PKCE flow using browser.identity.launchWebAuthFlow.
 * Returns the auth code from the redirect URL.
 *
 * @param {Object} params
 * @param {string} params.authEndpoint
 * @param {string} params.clientId
 * @param {string} params.redirectUri
 * @param {string} params.scope
 * @param {string} params.challenge - PKCE code_challenge
 * @param {Object} [params.extra] - Extra query params for the auth URL
 * @returns {Promise<string>} authorization code
 */
export async function launchOAuthPkceFlow({
	authEndpoint,
	clientId,
	redirectUri,
	scope,
	challenge,
	extra = {},
}) {
	const state = getRandomString(16);
	const query = new URLSearchParams({
		response_type: "code",
		client_id: clientId,
		redirect_uri: redirectUri,
		scope,
		state,
		code_challenge: challenge,
		code_challenge_method: "S256",
		...extra,
	});

	const authUrl = `${authEndpoint}?${query.toString()}`;
	const redirected = await browser.identity.launchWebAuthFlow({
		url: authUrl,
		interactive: true,
	});

	const redirectedUrl = new URL(redirected);
	const code = redirectedUrl.searchParams.get("code");
	if (!code) {
		throw new Error(
			`OAuth flow did not return a code. Response: ${redirected}`,
		);
	}
	return code;
}

/**
 * Exchange an authorization code for tokens using the token endpoint.
 *
 * @param {Object} params
 * @param {string} params.tokenEndpoint
 * @param {string} params.clientId
 * @param {string} params.redirectUri
 * @param {string} params.code
 * @param {string} params.verifier - PKCE code_verifier
 * @returns {Promise<{access_token, refresh_token, expires_in}>}
 */
export async function exchangeCodeForTokens({
	tokenEndpoint,
	clientId,
	redirectUri,
	code,
	verifier,
}) {
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		client_id: clientId,
		redirect_uri: redirectUri,
		code,
		code_verifier: verifier,
	});

	const resp = await fetch(tokenEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});

	if (!resp.ok) {
		const text = await resp.text().catch(() => "");
		throw new Error(`Token exchange failed ${resp.status}: ${text}`);
	}
	return resp.json();
}

/**
 * Refresh an access token using a refresh token.
 *
 * @param {Object} params
 * @param {string} params.tokenEndpoint
 * @param {string} params.clientId
 * @param {string} params.refreshToken
 * @returns {Promise<{access_token, refresh_token?, expires_in}>}
 */
export async function refreshAccessToken({
	tokenEndpoint,
	clientId,
	refreshToken,
}) {
	const body = new URLSearchParams({
		grant_type: "refresh_token",
		client_id: clientId,
		refresh_token: refreshToken,
	});

	const resp = await fetch(tokenEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});

	if (!resp.ok) {
		const text = await resp.text().catch(() => "");
		throw new Error(`Token refresh failed ${resp.status}: ${text}`);
	}
	return resp.json();
}
