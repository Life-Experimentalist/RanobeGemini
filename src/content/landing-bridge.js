/**
 * Landing-page bridge.
 *
 * Runs only on the project's own site. It replaces the previous
 * `externally_connectable` + `runtime.onMessageExternal` channel, which had two
 * problems: it required the web page to *guess* the extension ID, and Gecko does
 * not support `externally_connectable` for web pages at all, so the mobile OAuth
 * relay could never work on Firefox.
 *
 * A content script has none of those limits — it is same-origin with the page,
 * it knows its own extension ID, and it behaves identically on both engines.
 *
 * Two capabilities are exposed to the page:
 *   1. Presence — `document.documentElement.dataset.ranobeGemini` is set to the
 *      installed version, so detection needs no round trip at all.
 *   2. A narrow postMessage RPC for "open the library" and OAuth code relay.
 *
 * The page is trusted only as far as the operations below allow; nothing here
 * forwards arbitrary messages into the extension.
 */

const CHANNEL = "ranobe-gemini";

/** Operations the page is allowed to trigger. Anything else is ignored. */
const ALLOWED_OPS = new Set(["ping", "openLibrary"]);

function reply(id, payload) {
	window.postMessage(
		{ channel: CHANNEL, direction: "from-extension", id, ...payload },
		window.location.origin,
	);
}

/**
 * Relay an OAuth authorization code back to the background script.
 *
 * Only reached on platforms where `identity.launchWebAuthFlow` is unavailable
 * (notably Firefox for Android), where the flow runs in a plain tab instead.
 * The background script matches `state` against its pending flows, so a code
 * that does not correspond to a flow this extension started is discarded.
 */
async function relayOAuthResponse() {
	const query = new URLSearchParams(window.location.search);
	const hash = new URLSearchParams(window.location.hash.slice(1));

	const state = query.get("state") || hash.get("state");
	const authorizationCode = query.get("code") || hash.get("code");
	if (!state || !authorizationCode) return;

	try {
		await browser.runtime.sendMessage({
			action: "oauthTabRelay",
			state,
			authorizationCode,
		});
	} catch {
		// Background may be asleep or the flow already timed out; the OAuth page
		// shows its own status text, so there is nothing useful to surface here.
	}
}

function announcePresence() {
	try {
		const { version } = browser.runtime.getManifest();
		document.documentElement.dataset.ranobeGemini = version;
	} catch {
		// getManifest can throw if the extension context was invalidated by an
		// update while the page was open. Presence simply stays unannounced.
	}
}

window.addEventListener("message", (event) => {
	// Only accept messages this page posted to itself. Cross-origin frames and
	// other windows are rejected outright.
	if (event.source !== window) return;
	if (event.origin !== window.location.origin) return;

	const data = event.data;
	if (!data || data.channel !== CHANNEL) return;
	if (data.direction !== "to-extension") return;
	if (!ALLOWED_OPS.has(data.op)) return;

	if (data.op === "ping") {
		let manifest;
		try {
			manifest = browser.runtime.getManifest();
		} catch {
			return;
		}
		reply(data.id, {
			op: "ping",
			installed: true,
			version: manifest.version,
			libraryUrl: browser.runtime.getURL("library/library.html"),
		});
		return;
	}

	if (data.op === "openLibrary") {
		browser.runtime
			.sendMessage({ action: "openLibrary" })
			.then(() => reply(data.id, { op: "openLibrary", success: true }))
			.catch((error) =>
				reply(data.id, {
					op: "openLibrary",
					success: false,
					error: String(error?.message || error),
				}),
			);
	}
});

announcePresence();
relayOAuthResponse();
