/**
 * Trigger a file download of in-memory text from any extension context.
 *
 * `URL.createObjectURL` does not exist in a Chromium MV3 service worker, so the
 * background could not produce a download URL there at all. Where it is missing
 * we fall back to a `data:` URL, which `downloads.download()` accepts on both
 * engines. Percent-encoding (rather than base64) is used so non-Latin-1 novel
 * titles survive the round-trip without a manual UTF-8 dance.
 */

import { debugLog } from "./logger.js";

/**
 * @param {object} options
 * @param {string} options.text - File contents.
 * @param {string} options.filename - Path relative to the downloads folder.
 * @param {string} [options.type] - MIME type.
 * @param {boolean} [options.saveAs] - Show the "save as" dialog.
 * @returns {Promise<number>} The download id.
 */
export async function downloadText({
	text,
	filename,
	type = "application/json",
	saveAs = false,
}) {
	const downloadsApi =
		globalThis.browser?.downloads || globalThis.chrome?.downloads;
	if (!downloadsApi) {
		throw new Error("Downloads API not available");
	}

	const canRevoke = typeof URL.createObjectURL === "function";
	const url = canRevoke
		? URL.createObjectURL(new Blob([text], { type }))
		: `data:${type};charset=utf-8,${encodeURIComponent(text)}`;

	try {
		const downloadId = await downloadsApi.download({
			url,
			filename,
			saveAs,
		});
		debugLog(`[Download] Started ${filename} (id ${downloadId})`);
		return downloadId;
	} finally {
		// The download has been handed to the browser by now, but Chromium reads
		// the blob lazily, so give it a grace period before releasing it.
		if (canRevoke) setTimeout(() => URL.revokeObjectURL(url), 30000);
	}
}
