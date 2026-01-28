import MAX_DEBUG_LOG_ENTRIES from "../constants.js";

(function () {
	"use strict";

	const MAX_DEBUG_LOG_ENTRIES = 400;
	var debugLogBuffer = [];
	var originalLog = console.log.bind(console);
	var originalWarn = console.warn.bind(console);
	var originalError = console.error.bind(console);

	function pushLog(level, args) {
		try {
			debugLogBuffer.push({
				ts: new Date().toISOString(),
				level: level,
				message: Array.prototype.slice.call(args).map(String).join(" "),
			});
			if (debugLogBuffer.length > MAX_DEBUG_LOG_ENTRIES) {
				debugLogBuffer.shift();
			}
		} catch (_err) {
			// ignore
		}
	}

	console.log = function () {
		pushLog("log", arguments);
		originalLog.apply(console, arguments);
	};
	console.warn = function () {
		pushLog("warn", arguments);
		originalWarn.apply(console, arguments);
	};
	console.error = function () {
		pushLog("error", arguments);
		originalError.apply(console, arguments);
	};

	function setStatus(message) {
		var status = document.getElementById("status");
		if (status) {
			status.textContent = message;
			status.className = "error";
		}
	}

	function setupTabs() {
		var buttons = document.querySelectorAll(".tab-btn");
		var contents = document.querySelectorAll(".tab-content");

		if (!buttons.length || !contents.length) {
			setStatus("Popup UI failed to load.");
			return;
		}

		buttons.forEach(function (button) {
			button.addEventListener("click", function () {
				buttons.forEach(function (btn) {
					btn.classList.remove("active");
				});
				contents.forEach(function (content) {
					content.classList.remove("active");
				});

				button.classList.add("active");

				var tabId = button.getAttribute("data-tab");
				var target = document.getElementById(tabId);
				if (target) {
					target.classList.add("active");
				}
			});
		});
	}

	window.addEventListener("error", function (event) {
		pushLog("error", [event.message || "Unknown error"]);
		setStatus("Popup error: " + (event.message || "Unknown error"));
	});

	window.addEventListener("unhandledrejection", function (event) {
		pushLog("error", [
			event.reason && event.reason.message
				? event.reason.message
				: "Unhandled promise rejection",
		]);
		setStatus(
			"Popup error: " +
				(event.reason && event.reason.message
					? event.reason.message
					: "Unhandled promise rejection"),
		);
	});

	try {
		window.__popupDebugLog = debugLogBuffer;
		window.getPopupDebugLog = function () {
			return debugLogBuffer
				.map(function (entry) {
					return (
						"[" +
						entry.ts +
						"] " +
						entry.level.toUpperCase() +
						": " +
						entry.message
					);
				})
				.join("\n");
		};
	} catch (_err) {
		// ignore
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", setupTabs);
	} else {
		setupTabs();
	}

	setTimeout(function () {
		try {
			if (!window.__popupJsReady) {
				setStatus(
					"Popup script failed to initialize. Reload the extension and check console for errors.",
				);
			}
		} catch (_err) {
			setStatus(
				"Popup script failed to initialize. Reload the extension and check console for errors.",
			);
		}
	}, 800);
})();
