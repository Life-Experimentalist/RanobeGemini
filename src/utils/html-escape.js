/**
 * HTML escaping and URL sanitisation.
 *
 * This is the single implementation for the whole extension. Twelve local
 * copies previously existed and ten of them built the escaped string with
 * `div.textContent = value; return div.innerHTML`. That idiom is safe for text
 * nodes but NOT for attributes: the HTML serialiser does not escape quotes, so
 * `escapeHtml('" onerror="alert(1)')` returned its input unchanged and any
 * `href="${escapeHtml(value)}"` template was open to attribute breakout.
 *
 * Everything here is pure string manipulation, so it also works in a service
 * worker, where `document` does not exist.
 */

const HTML_ENTITIES = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

/**
 * Escape a value for interpolation into HTML text or a quoted attribute.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
	if (value === null || value === undefined) return "";
	return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

/**
 * Schemes permitted in generated links. Novel metadata is scraped from remote
 * pages, so a hostile `authorUrl` of `javascript:...` would otherwise execute
 * on click — escaping alone does not prevent that, because the payload never
 * needs a quote or an angle bracket.
 */
const SAFE_URL_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/**
 * Return `url` if it is safe to use as a link target, otherwise an empty string.
 *
 * Protocol-relative (`//host/path`) and relative URLs are resolved against the
 * current document so they inherit its scheme.
 *
 * @param {unknown} url
 * @returns {string}
 */
export function safeUrl(url) {
	if (!url) return "";
	const raw = String(url).trim();
	if (!raw) return "";

	const base =
		typeof location !== "undefined"
			? location.href
			: "https://invalid.example";

	let parsed;
	try {
		parsed = new URL(raw, base);
	} catch {
		return "";
	}

	return SAFE_URL_SCHEMES.has(parsed.protocol) ? parsed.href : "";
}

/**
 * Escape a URL for use inside a quoted HTML attribute, dropping it entirely if
 * its scheme is not safe. Use this instead of `escapeHtml` for `href`/`src`.
 *
 * @param {unknown} url
 * @returns {string}
 */
export function escapeUrlAttr(url) {
	return escapeHtml(safeUrl(url));
}

export default { escapeHtml, safeUrl, escapeUrlAttr };
