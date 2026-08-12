/**
 * Page-environment shim for website handlers.
 *
 * WHY THIS EXISTS
 * ---------------
 * Website handlers were written for the content-script context, where
 * `window.location` *is* the novel's URL. They are also used from the
 * background (metadata refresh, chapter-count polling), where that assumption
 * breaks in two different ways:
 *
 *   - Chromium MV3 background is a service worker: there is no `window` at all,
 *     so every `window.location.hostname` read throws.
 *   - Firefox MV3 background is an event page: `window.location` exists but
 *     points at the extension's own background page, so handlers silently
 *     derive novel IDs and canonical URLs from the wrong origin.
 *
 * `pageLocation()` returns whatever URL the code is *currently reasoning about*:
 * the real `window.location` on a page, or the override set by
 * `background/dom-sandbox.js` while a fetched document is being scraped.
 *
 * Only read accessors are shimmed. Navigation (`location.replace(...)`,
 * `location.href = ...`) still goes through the real `window.location`, because
 * navigating is only ever meaningful on a live page.
 */

/** Shape returned when there is no real location and no override. */
const BLANK_LOCATION = Object.freeze({
	href: "",
	protocol: "",
	host: "",
	hostname: "",
	port: "",
	pathname: "",
	search: "",
	hash: "",
	origin: "",
});

let override = null;

/**
 * Point `pageLocation()` at an arbitrary URL. Used by the DOM sandbox while a
 * fetched page is mounted; pass `null` to fall back to the real location.
 *
 * @param {string|URL|null} url
 */
export function setPageUrlOverride(url) {
	if (!url) {
		override = null;
		return;
	}
	try {
		override = new URL(String(url));
	} catch {
		override = null;
	}
}

/**
 * The URL currently being reasoned about.
 *
 * @returns {Location|URL|typeof BLANK_LOCATION} A `Location`-compatible object.
 */
export function pageLocation() {
	if (override) return override;
	if (typeof window !== "undefined" && window.location)
		return window.location;
	return BLANK_LOCATION;
}

/**
 * Convenience accessor — `pageLocation().href` without the intermediate object.
 *
 * @returns {string}
 */
export function pageUrl() {
	return pageLocation().href || "";
}

/**
 * True when this context can build and query a real DOM (content script,
 * extension page, Firefox background event page). False in a Chromium MV3
 * service worker.
 *
 * @returns {boolean}
 */
export function hasDom() {
	return typeof document !== "undefined" && typeof DOMParser !== "undefined";
}
