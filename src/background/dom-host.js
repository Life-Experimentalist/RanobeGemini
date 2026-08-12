/**
 * DOM host — runs a DOM job wherever a document is actually available.
 *
 *   Firefox   background is an event page → run the job inline.
 *   Chromium  background is a service worker (no `document`, no `DOMParser`)
 *             → run the job in an offscreen document.
 *
 * Callers just `await runDomJob(op, payload)` and never branch on engine.
 */

import { debugError, debugLog } from "../utils/logger.js";
import { hasDom } from "../utils/dom-env.js";
import { OFFSCREEN_TARGET, runJob } from "./dom-jobs.js";

const OFFSCREEN_PATH = "background/offscreen.html";
const OFFSCREEN_REASONS = ["DOM_PARSER"];
const OFFSCREEN_JUSTIFICATION =
	"Parse fetched novel pages so site handlers can read chapter counts and metadata.";

/** Close the offscreen document once it has been idle this long. */
const IDLE_CLOSE_MS = 30000;

/** In-flight createDocument() call, shared so concurrent jobs do not race. */
let creating = null;
let idleTimer = null;

function offscreenApi() {
	return globalThis.chrome?.offscreen;
}

async function offscreenDocumentExists() {
	const getContexts = globalThis.chrome?.runtime?.getContexts;
	if (!getContexts) return false;
	const contexts = await globalThis.chrome.runtime.getContexts({
		contextTypes: ["OFFSCREEN_DOCUMENT"],
	});
	return contexts.length > 0;
}

async function ensureOffscreenDocument() {
	if (await offscreenDocumentExists()) return;
	if (creating) {
		await creating;
		return;
	}
	creating = offscreenApi()
		.createDocument({
			url: OFFSCREEN_PATH,
			reasons: OFFSCREEN_REASONS,
			justification: OFFSCREEN_JUSTIFICATION,
		})
		.catch((error) => {
			// Chrome allows exactly one offscreen document. Losing the race with
			// another caller is fine — the document we wanted now exists.
			if (!/single offscreen document/i.test(error?.message || "")) {
				throw error;
			}
		})
		.finally(() => {
			creating = null;
		});
	await creating;
}

function scheduleIdleClose() {
	if (idleTimer) clearTimeout(idleTimer);
	idleTimer = setTimeout(() => {
		idleTimer = null;
		offscreenApi()
			?.closeDocument()
			.catch((error) => {
				// Already gone, or the worker was torn down first. Harmless.
				debugLog("[DomHost] Offscreen close skipped:", error?.message);
			});
	}, IDLE_CLOSE_MS);
}

/**
 * Run a DOM job. See `background/dom-jobs.js` for the available operations.
 *
 * @param {string} op - Job name.
 * @param {object} [payload] - JSON-serialisable payload.
 * @returns {Promise<unknown>} The job's JSON-serialisable result.
 */
export async function runDomJob(op, payload = {}) {
	if (hasDom()) return runJob(op, payload);

	if (!offscreenApi()) {
		throw new Error(
			`DOM job "${op}" needs a document, but this context has neither a DOM nor the offscreen API.`,
		);
	}

	await ensureOffscreenDocument();
	scheduleIdleClose();

	const response = await globalThis.chrome.runtime.sendMessage({
		target: OFFSCREEN_TARGET,
		op,
		payload,
	});

	if (!response) {
		throw new Error(`Offscreen document did not respond to "${op}"`);
	}
	if (!response.success) {
		debugError(`[DomHost] Offscreen job "${op}" failed:`, response.error);
		throw new Error(response.error || `Offscreen job "${op}" failed`);
	}
	return response.result;
}
