/**
 * Novel Info Copy-to-Clipboard Format Utility
 *
 * Provides a configurable template engine for copying novel information
 * to the clipboard. Templates use {token} placeholders that are replaced
 * with real novel data at copy time.
 *
 * Available tokens:
 *   {title}       - Novel title
 *   {author}      - Author name
 *   {titleSafe}   - Title with filesystem-illegal characters removed
 *   {authorSafe}  - Author with filesystem-illegal characters removed
 *   {wordCount}   - Total word count (plain integer, 0 = omitted)
 *   {chapters}    - Total chapter count
 *   {lastRead}    - Last read chapter number
 *   {status}      - Reading status key (e.g. "reading")
 *   {site}        - Shelf / source site ID (e.g. "ao3", "fanfiction")
 *   {id}          - Library novel ID
 *   {url}         - Source URL
 *   {description} - Novel description (first 200 chars unless :N limit added)
 *
 * Limit syntax: {description:100} trims the value to the first 100 characters.
 *
 * @example
 *   formatNovelInfo(novel, "{title} by {author} {wordCount}")
 *   // → "Partners? by ReluctantSidekick 288578"
 *   formatExportFilename(novel, "{titleSafe} - {authorSafe}", "epub")
 *   // → "Partners - ReluctantSidekick.epub"
 */

import {
	DEFAULT_COPY_TEMPLATE as _DEFAULT_COPY_TEMPLATE,
	DEFAULT_EXPORT_FILENAME_TEMPLATE,
	COPY_EXPORT_EXTENSIONS,
	COPY_EXPORT_DEFAULT_EXTENSION,
} from "./constants.js";

// Re-export constants for backward compatibility
export const DEFAULT_COPY_TEMPLATE = _DEFAULT_COPY_TEMPLATE;
export { COPY_EXPORT_EXTENSIONS, COPY_EXPORT_DEFAULT_EXTENSION };

/**
 * Default export filename template (without extension).
 * Uses filesystem-safe tokens so the result is usable as a real filename.
 */
export const DEFAULT_EXPORT_TEMPLATE = DEFAULT_EXPORT_FILENAME_TEMPLATE;

/**
 * Strip characters that are illegal in Windows / macOS / Linux filenames.
 * Collapses multiple spaces and trims.
 * @param {string} str
 * @returns {string}
 */
export function toFilenameSafe(str) {
	return (
		String(str || "")
			// eslint-disable-next-line no-control-regex
			.replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // illegal chars
			.replace(/\s+/g, " ") // collapse whitespace
			.trim()
			.replace(/\.+$/, "") || // no trailing dots
		"Unknown"
	);
}

/**
 * Human-readable token reference shown in the settings UI.
 */
export const COPY_FORMAT_TOKENS = [
	{ token: "{title}", desc: "Novel title", example: "Partners?" },
	{
		token: "{author}",
		desc: "Author name",
		example: "ReluctantSidekick",
	},
	{
		token: "{titleSafe}",
		desc: "Title, filesystem-safe (no special chars)",
		example: "Partners",
	},
	{
		token: "{authorSafe}",
		desc: "Author, filesystem-safe",
		example: "ReluctantSidekick",
	},
	{
		token: "{wordCount}",
		desc: "Total word count (from stored stats)",
		example: "288578",
	},
	{ token: "{chapters}", desc: "Total chapter count", example: "102" },
	{ token: "{lastRead}", desc: "Last read chapter number", example: "45" },
	{
		token: "{status}",
		desc: "Reading status key",
		example: "reading",
	},
	{
		token: "{site}",
		desc: "Source site / shelf ID",
		example: "ao3",
	},
	{ token: "{id}", desc: "Library novel ID", example: "ao3-1234567" },
	{ token: "{url}", desc: "Source URL", example: "https://..." },
	{
		token: "{description}",
		desc: "Description (first 200 chars; use {description:N} for custom limit)",
		example: "A story about...",
	},
];

/**
 * Unified token reference for export filenames (txt, epub, html).
 * Contains all tokens useful for file naming.
 */
export const EXPORT_TOKENS = [
	{
		token: "{titleSafe}",
		desc: "Title, filesystem-safe (recommended for filenames)",
		example: "Partners",
		recommended: true,
	},
	{
		token: "{authorSafe}",
		desc: "Author, filesystem-safe (recommended for filenames)",
		example: "ReluctantSidekick",
		recommended: true,
	},
	{
		token: "{title}",
		desc: "Title (raw, may contain special chars)",
		example: "Partners?",
	},
	{ token: "{author}", desc: "Author (raw)", example: "ReluctantSidekick" },
	{ token: "{site}", desc: "Source site ID", example: "ao3" },
	{ token: "{chapters}", desc: "Total chapter count", example: "102" },
	{ token: "{id}", desc: "Library novel ID", example: "ao3-1234567" },
	{ token: "{status}", desc: "Reading status", example: "reading" },
	{ token: "{lastRead}", desc: "Last read chapter", example: "45" },
	{
		token: "{words}",
		desc: "Word count (alias for {wordCount})",
		example: "288578",
		recommended: true,
	},
];

/**
 * A sample novel used to render the live preview in settings
 * when the library is empty. Uses snake_case token names so the
 * user can immediately see which token maps to which value.
 */
export const PREVIEW_NOVEL = {
	title: "novel_title",
	author: "novel_author",
	totalChapters: 102,
	lastReadChapter: 45,
	readingStatus: "reading",
	shelfId: "site_id",
	id: "site_id-novel_id",
	sourceUrl: "https://example.com/works/novel_id",
	description:
		"novel_description — add your novel to the library to preview with real data.",
	stats: { wordCount: 123456 },
};

/**
 * Format a novel object using a template string.
 *
 * @param {Object} novel     - Novel data from the library.
 * @param {string} template  - Template string with {token} placeholders.
 * @returns {string} Formatted result.
 */
export function formatNovelInfo(novel, template) {
	if (!template || typeof template !== "string") return "";
	if (!novel) return template;

	// Resolve word count from several possible locations
	const rawWordCount =
		novel.stats?.wordCount ??
		novel.metadata?.wordCount ??
		novel.metadata?.words ??
		0;
	const wordCountStr = rawWordCount > 0 ? String(rawWordCount) : "";

	const rawTitle = novel.title || "Unknown";
	const rawAuthor = novel.author || "Unknown";

	/** @type {Record<string, string>} */
	const replacements = {
		title: rawTitle,
		author: rawAuthor,
		titleSafe: toFilenameSafe(rawTitle),
		authorSafe: toFilenameSafe(rawAuthor),
		wordCount: wordCountStr,
		words: wordCountStr, // alias
		chapters:
			novel.totalChapters != null ? String(novel.totalChapters) : "",
		lastRead:
			novel.lastReadChapter != null ? String(novel.lastReadChapter) : "",
		status: novel.readingStatus || "",
		site: novel.shelfId || "",
		id: novel.id || "",
		url: novel.sourceUrl || novel.lastReadUrl || "",
		description: (novel.description || "").substring(0, 200),
	};

	// Replace {token} and {token:N} (N = character limit)
	return template.replace(
		/\{(\w+)(?::(\d+))?\}/g,
		(_match, key, limitStr) => {
			const value = Object.hasOwn(replacements, key)
				? replacements[key]
				: _match;
			if (limitStr) {
				const limit = parseInt(limitStr, 10);
				return isNaN(limit)
					? String(value)
					: String(value).substring(0, limit);
			}
			return String(value);
		},
	);
}

/**
 * Resolve which copy-info template to use for a novel, respecting site overrides.
 *
 * @param {Object} novelCopyFormats - The `novelCopyFormats` settings object.
 * @param {string|null} shelfId     - The novel's shelf/site ID.
 * @returns {string|null} Resolved template string, or null if feature is disabled.
 */
export function resolveTemplate(novelCopyFormats, shelfId) {
	if (!novelCopyFormats?.enabled) return null;
	if (shelfId && novelCopyFormats.siteOverrides?.[shelfId]?.trim()) {
		return novelCopyFormats.siteOverrides[shelfId].trim();
	}
	return novelCopyFormats.globalTemplate?.trim() || DEFAULT_COPY_TEMPLATE;
}

/**
 * Resolve which export filename template to use, respecting site overrides.
 *
 * @param {Object} novelCopyFormats - The `novelCopyFormats` settings object.
 * @param {string|null} shelfId     - The novel's shelf/site ID.
 * @returns {string} Resolved template string (without extension).
 */
export function resolveExportTemplate(novelCopyFormats, shelfId) {
	// Check site-specific override first
	if (shelfId && novelCopyFormats?.exportSiteOverrides?.[shelfId]?.trim()) {
		return novelCopyFormats.exportSiteOverrides[shelfId].trim();
	}
	// Fall back to global export template
	return novelCopyFormats?.exportTemplate?.trim() || DEFAULT_EXPORT_TEMPLATE;
}

/**
 * Resolve which file extension to use for export, respecting site overrides.
 *
 * @param {Object} novelCopyFormats - The `novelCopyFormats` settings object.
 * @param {string|null} shelfId     - The novel's shelf/site ID.
 * @returns {string} File extension (e.g., "txt", "epub", "html").
 */
export function resolveExportExtension(novelCopyFormats, shelfId) {
	// Check site-specific extension override
	if (shelfId && novelCopyFormats?.exportSiteExtensions?.[shelfId]) {
		return novelCopyFormats.exportSiteExtensions[shelfId];
	}
	// Fall back to global extension
	return novelCopyFormats?.exportExtension || COPY_EXPORT_DEFAULT_EXTENSION;
}

/**
 * Format a novel's export filename with template and extension.
 *
 * @param {Object} novel      - Novel data from the library.
 * @param {string} template   - Template string with {token} placeholders.
 * @param {string} extension  - File extension (without dot, e.g., "epub").
 * @returns {string} Complete filename with extension.
 */
export function formatExportFilename(novel, template, extension) {
	const formattedName = formatNovelInfo(novel, template);
	// Ensure the filename is filesystem-safe
	const safeName = toFilenameSafe(formattedName);
	// Add extension only if provided
	return extension ? `${safeName}.${extension}` : safeName;
}
