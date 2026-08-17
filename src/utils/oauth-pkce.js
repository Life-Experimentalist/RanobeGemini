/**
 * Shared OAuth2 PKCE helpers used by storage provider adapters.
 * Mirrors the pattern in drive.js but extracted for reuse.
 */

export const pendingAuthFlows = new Map();

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

	const error = redirectedUrl.searchParams.get("error");
	if (error) {
		const description =
			redirectedUrl.searchParams.get("error_description") || "";
		throw new Error(
			`OAuth flow was rejected: ${error}${description ? ` — ${description}` : ""}`,
		);
	}

	// The authorization server must echo back the exact `state` we generated.
	// Without this check a redirect crafted by a third party could inject an
	// authorization code belonging to an attacker-controlled account, and the
	// token it mints would be silently stored as the user's own.
	const returnedState = redirectedUrl.searchParams.get("state");
	if (returnedState !== state) {
		throw new Error(
			"OAuth state mismatch — the response did not come from the request we started. Aborting.",
		);
	}

	const code = redirectedUrl.searchParams.get("code");
	if (!code) {
		// The raw redirect can carry tokens in the fragment, so it is not safe
		// to include in an error message that may be logged or displayed.
		throw new Error("OAuth flow did not return an authorization code.");
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

/**
 * Tab-based OAuth flow for mobile/environments where browser.identity is unavailable.
 * Opens a new tab, appends ext_id to redirect so landing page can sendMessage back.
 * Resolves with the auth code once onMessageExternal delivers it.
 *
 * @param {Object} params
 * @param {string} params.authEndpoint
 * @param {string} params.clientId
 * @param {string} params.redirectUri
 * @param {string} params.scope
 * @param {string} params.challenge - PKCE code_challenge
 * @param {Object} [params.extra]
 * @param {number} [params.timeoutMs]
 * @returns {Promise<string>} authorization code
 */
export async function launchOAuthTabFlow({
	authEndpoint,
	clientId,
	redirectUri,
	scope,
	challenge,
	extra = {},
	timeoutMs = 120_000,
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

	// The redirect lands on the project site, where content/landing-bridge.js
	// forwards the code back to the background script. The bridge knows its own
	// extension ID, so nothing needs to be smuggled through the redirect URI.
	const tab = await browser.tabs.create({
		url: `${authEndpoint}?${query.toString()}`,
	});

	return new Promise((resolve, reject) => {
		const cleanup = (tabId) => {
			pendingAuthFlows.delete(state);
			if (tabId !== undefined) {
				browser.tabs.remove(tabId).catch(() => {});
			}
		};

		const timer = setTimeout(() => {
			cleanup(tab.id);
			reject(new Error("OAuth tab flow timed out."));
		}, timeoutMs);

		pendingAuthFlows.set(state, (payload) => {
			clearTimeout(timer);
			const code = payload.authorizationCode;
			cleanup(tab.id);
			if (code) {
				resolve(code);
			} else {
				reject(
					new Error(
						"OAuth tab flow: no authorization code received.",
					),
				);
			}
		});
	});
}
