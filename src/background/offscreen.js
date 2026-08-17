/**
 * Offscreen document host (Chromium/Edge only).
 *
 * Chromium's MV3 background is a service worker, so it has no `document` and no
 * `DOMParser`. This offscreen page provides the missing DOM: the worker sends a
 * job here, we run it against a real document, and send plain JSON back.
 *
 * Firefox has no `chrome.offscreen` and does not need it — its MV3 background
 * is an event page, so `background/dom-host.js` runs the same jobs inline.
 *
 * The document is created lazily on the first job and closed again once idle;
 * see `background/dom-host.js`.
 */

import { debugError } from "../utils/logger.js";
import { OFFSCREEN_TARGET, runJob } from "./dom-jobs.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (!message || message.target !== OFFSCREEN_TARGET) return false;

	runJob(message.op, message.payload)
		.then((result) => sendResponse({ success: true, result }))
		.catch((error) => {
			debugError(`[Offscreen] Job "${message.op}" failed:`, error);
			sendResponse({
				success: false,
				error: error?.message || String(error),
			});
		});

	return true; // response is async
});
