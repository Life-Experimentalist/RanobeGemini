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
 */

/** Default global copy template. */
export const DEFAULT_COPY_TEMPLATE = "{title} by {author} {wordCount}";

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
 * A sample novel used to render the live preview in settings.
 */
export const PREVIEW_NOVEL = {
	title: "Partners?",
	author: "ReluctantSidekick",
	totalChapters: 102,
	lastReadChapter: 45,
	readingStatus: "reading",
	shelfId: "ao3",
	id: "ao3-1234567",
	sourceUrl: "https://archiveofourown.org/works/1234567",
	description: "A story about unlikely allies who become much more.",
	stats: { wordCount: 288578 },
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

	/** @type {Record<string, string>} */
	const replacements = {
		title: novel.title || "Unknown",
		author: novel.author || "Unknown",
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
 * Resolve which template to use for a novel, respecting site overrides.
 *
 * @param {Object} novelCopyFormats - The `novelCopyFormats` settings object.
 * @param {string|null} shelfId     - The novel's shelf/site ID.
 * @returns {string} Resolved template string.
 */
export function resolveTemplate(novelCopyFormats, shelfId) {
	if (!novelCopyFormats?.enabled) return null;
	if (shelfId && novelCopyFormats.siteOverrides?.[shelfId]?.trim()) {
		return novelCopyFormats.siteOverrides[shelfId].trim();
	}
	return novelCopyFormats.globalTemplate?.trim() || DEFAULT_COPY_TEMPLATE;
}
