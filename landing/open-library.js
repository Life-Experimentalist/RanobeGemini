/**
 * "Open Library" bridge for the marketing site.
 *
 * Any element carrying `data-open-library` asks the installed extension to open
 * its library page. Detection and the request both go through the extension's
 * content script (`content/landing-bridge.js`), which runs on this origin.
 *
 * This replaces the previous approach of calling
 * `chrome.runtime.sendMessage({action: "openLibrary"})` from the page. That only
 * ever worked on Chromium, and only while the extension declared
 * `externally_connectable` for this site — a declaration that granted the whole
 * origin a message channel into the extension and that Gecko ignores entirely.
 * A page-scoped content script needs neither.
 */

(function () {
	"use strict";

	var CHANNEL = "ranobe-gemini";
	var STORE_URL = "https://github.com/Life-Experimentalist/RanobeGemini";
	var nextRequestId = 0;

	/** The bridge writes the installed version here at document_start. */
	function installedVersion() {
		return document.documentElement.dataset.ranobeGemini || "";
	}

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

	function notInstalled() {
		window.alert(
			"📚 The library lives inside the Ranobe Gemini extension.\n\n" +
				"Install it for Firefox, Chrome or Edge to get your reading library, " +
				"novel status board and content filters.\n\n" +
				STORE_URL,
		);
	}

	function openLibrary() {
		if (!installedVersion()) {
			notInstalled();
			return;
		}
		callBridge("openLibrary").catch(function () {
			notInstalled();
		});
	}

	/**
	 * Reflect install state in the DOM so pages can style themselves. Elements
	 * with `data-requires-extension` are hidden when nothing is installed.
	 */
	function reflectInstallState() {
		var version = installedVersion();
		document.body.classList.toggle("has-extension", Boolean(version));
		if (version) return;
		var gated = document.querySelectorAll("[data-requires-extension]");
		for (var i = 0; i < gated.length; i++) {
			gated[i].hidden = true;
		}
	}

	function init() {
		reflectInstallState();

		// Delegated so it also covers markup injected after load.
		document.addEventListener("click", function (event) {
			var trigger = event.target.closest
				? event.target.closest("[data-open-library]")
				: null;
			if (!trigger) return;
			event.preventDefault();
			openLibrary();
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}

	// Kept for any inline caller that has not been migrated yet.
	window.openLibrarySettings = openLibrary;
})();
