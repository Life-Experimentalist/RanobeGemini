/**
 * OAuth tab-flow landing page.
 *
 * Reached only on platforms where `identity.launchWebAuthFlow` is unavailable
 * (notably Firefox for Android), where the authorization flow runs in a plain
 * tab. On every other platform the redirect never comes here.
 *
 * This page does NOT relay the authorization response itself. The extension's
 * content script (`content/landing-bridge.js`) runs on this origin, reads the
 * `code`/`state` from the URL, and posts it to the background script, which
 * matches `state` against the flow it started. The page's only jobs are to tell
 * the user what happened and to offer a link into the library.
 *
 * Previous versions of this file tried to guess the extension ID, probed
 * `chrome-extension://` URLs from hidden iframes, and did
 * `window.opener.postMessage(payload, "*")` with the access token in it. All of
 * that is gone: the bridge knows its own ID, and no token ever reaches this
 * script.
 */

(function () {
	"use strict";

	var statusEl = document.getElementById("status");
	var detailEl = document.getElementById("detail");
	var buttonEl = document.getElementById("open-library");

	var CHANNEL = "ranobe-gemini";
	var query = new URLSearchParams(window.location.search);
	var hash = new URLSearchParams(window.location.hash.slice(1));

	function get(name) {
		return query.get(name) || hash.get(name);
	}

	function setStatus(text, detail) {
		statusEl.textContent = text;
		detailEl.textContent = detail || "";
	}

	// --- Report the outcome of the authorization request -------------------

	var error = get("error");
	var code = get("code");

	if (error) {
		setStatus(
			"Sign-in was not completed.",
			get("error_description") || error,
		);
	} else if (code) {
		setStatus(
			"Sign-in complete. You can close this tab.",
			"Ranobe Gemini has been notified and is finishing setup in the background.",
		);
	} else {
		setStatus(
			"No sign-in response was received.",
			"This page is the redirect target for Ranobe Gemini's sign-in flow. Start the flow from the extension.",
		);
	}

	// Strip the authorization response from the address bar so it is not left in
	// history or copied by the user. The bridge content script runs at
	// document_start and has already read it.
	if (code || error) {
		try {
			window.history.replaceState(
				null,
				"",
				window.location.pathname,
			);
		} catch (e) {
			/* replaceState can fail in some embedded contexts; harmless. */
		}
	}

	// --- Offer the library, but only if the extension is actually here ------

	/**
	 * The bridge sets this attribute at document_start. Reading it needs no
	 * round trip and no knowledge of the extension ID.
	 */
	function installedVersion() {
		return document.documentElement.dataset.ranobeGemini || "";
	}

	var nextRequestId = 0;

	function callBridge(op, timeoutMs) {
		return new Promise(function (resolve, reject) {
			var id = CHANNEL + ":" + nextRequestId++;

			var timer = setTimeout(function () {
				window.removeEventListener("message", onMessage);
				reject(new Error("The extension did not respond."));
			}, timeoutMs || 3000);

			function onMessage(event) {
				if (event.source !== window) return;
				if (event.origin !== window.location.origin) return;
				var data = event.data;
				if (!data || data.channel !== CHANNEL) return;
				if (data.direction !== "from-extension") return;
				if (data.id !== id) return;

				clearTimeout(timer);
				window.removeEventListener("message", onMessage);
				resolve(data);
			}

			window.addEventListener("message", onMessage);
			window.postMessage(
				{
					channel: CHANNEL,
					direction: "to-extension",
					id: id,
					op: op,
				},
				window.location.origin,
			);
		});
	}

	function showLibraryButton() {
		buttonEl.hidden = false;
		buttonEl.addEventListener("click", function () {
			buttonEl.disabled = true;
			callBridge("openLibrary")
				.then(function (reply) {
					if (!reply.success) {
						buttonEl.disabled = false;
						detailEl.textContent =
							reply.error || "Could not open the library.";
					}
				})
				.catch(function (err) {
					buttonEl.disabled = false;
					detailEl.textContent = err.message;
				});
		});
	}

	// The bridge announces presence synchronously at document_start, but this
	// script may run first on a slow load; re-check once on DOM ready.
	if (installedVersion()) {
		showLibraryButton();
	} else {
		document.addEventListener("DOMContentLoaded", function () {
			if (installedVersion()) showLibraryButton();
		});
	}
})();
