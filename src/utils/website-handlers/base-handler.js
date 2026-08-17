/**
 * Base Website Content Handler
 * The abstract class that all website-specific handlers should extend
 */
import { debugLog, debugError } from "../logger.js";
import { pageLocation } from "../dom-env.js";
import {
	DEFAULT_BANNERS_VISIBLE,
	UI_MOBILE_BREAKPOINT_PX,
} from "../constants.js";

/** Re-export for handlers to use */
export { UI_MOBILE_BREAKPOINT_PX };

export class BaseWebsiteHandler {
	// Default banner visibility on page load
	// Set to false to hide enhancement banners by default
	// Individual handlers can override this
	static DEFAULT_BANNERS_VISIBLE = DEFAULT_BANNERS_VISIBLE;

	/**
	 * Settings definition for the library settings page.
	 * null = no configurable settings for this handler.
	 * Subclasses override this with a { fields: [...] } object.
	 *
	 * THIS is the one that reaches the reader. The Library renders these fields
	 * on the site's card and saves the values into the per-site settings store
	 * (`SITE_SETTINGS_KEY`, keyed by shelf id), which `content.js` reads.
	 * `getProposedLibrarySettings()` below is a separate, unrelated schema — see
	 * the warning on it before putting a setting there by mistake.
	 */
	static SETTINGS_DEFINITION = null;

	/**
	 * When true, the site card in Library Settings is greyed out and the
	 * enable toggle is locked. Used for handlers that are not yet ready for
	 * general use (e.g. WebNovel). Users cannot enable a force-disabled site.
	 */
	static FORCE_DISABLED = false;

	constructor() {
		// Optional initialization
	}

	// Return true if this handler can handle the current website
	canHandle() {
		throw new Error("Method canHandle() must be implemented by subclass");
	}

	/**
	 * Check if current page is a novel info page (not a chapter)
	 * For DEDICATED_PAGE type sites, this is where full metadata is available
	 * @returns {boolean}
	 */
	isNovelPage() {
		// Default: assume not a novel page (most sites use chapter pages)
		return false;
	}

	/**
	 * Get the novel controls configuration for this handler
	 * Handlers can override this to customize placement and appearance
	 * @returns {Object} Configuration for novel controls UI
	 */
	getNovelControlsConfig() {
		return {
			// Whether to show novel controls on this page type
			showControls: true,
			// Insertion point for the controls
			insertionPoint: this.getNovelPageUIInsertionPoint(),
			// Position relative to insertion point: 'before', 'after', 'prepend', 'append'
			position: "before",
			// Custom CSS styles (optional override)
			customStyles: null,
			// Whether this is a chapter page (vs novel info page)
			isChapterPage: this.isChapterPage(),
		};
	}

	/**
	 * Unified chapter UI configuration.
	 * Returns all UI element configuration from a single method.
	 * Handlers should override this to customize the chapter controls bar.
	 *
	 * @returns {Object} Chapter UI config:
	 *   - insertion: { selector: string|null, position: 'before'|'after'|'prepend'|'append' }
	 *   - showStatusBadge: boolean
	 *   - showReadingStatusSelect: boolean
	 *   - showRemoveButton: boolean
	 *   - showOpenLibraryButton: boolean
	 *   - showToggleGeminiButton: boolean
	 *   - customButtons: Array<{ id, label, emoji, title, bgColor, textColor, onClick }>
	 *   - mobileStackThreshold: number (px width to stack vertically)
	 *   - containerStyles: string|null (additional inline CSS)
	 */
	async getChapterUIConfig() {
		// Merge with legacy methods for backwards compatibility
		const legacyInsertion = this.getNovelPageUIInsertionPoint();
		// getCustomChapterButtons may be sync or async depending on handler
		let legacyButtons = this.getCustomChapterButtons();
		if (legacyButtons instanceof Promise) {
			legacyButtons = await legacyButtons;
		}
		if (!Array.isArray(legacyButtons)) {
			legacyButtons = [];
		}

		return {
			insertion: {
				selector: legacyInsertion?.element
					? null // element reference not serializable, use selector
					: null,
				position: legacyInsertion?.position || "before",
			},
			showStatusBadge: true,
			showReadingStatusSelect: true,
			showRemoveButton: true,
			showOpenLibraryButton: true,
			showToggleGeminiButton: true,
			customButtons: legacyButtons.map((btn, idx) => ({
				id: `custom-${idx}`,
				label: btn.text || "",
				emoji: btn.emoji || "",
				title: btn.text || "",
				bgColor: btn.color || null,
				textColor: null,
				onClick: btn.onClick || null,
			})),
			mobileStackThreshold: UI_MOBILE_BREAKPOINT_PX,
			containerStyles: null,
		};
	}

	/**
	 * Get custom chapter page control buttons for this handler
	 * Handlers can override this to add site-specific buttons (e.g., download buttons)
	 * @deprecated Use getChapterUIConfig().customButtons instead
	 * @returns {Array} Array of button specifications { text, emoji, color, onClick }
	 */
	getCustomChapterButtons() {
		// Default: no custom buttons
		return [];
	}

	/**
	 * Get insertion point for novel controls UI
	 * Handlers should override this for site-specific placement
	 * @returns {Object|null} { element, position } or null
	 */
	getNovelPageUIInsertionPoint() {
		// Common selectors for novel/chapter pages
		const selectors = [
			".story-info",
			".novel-info",
			".book-info",
			".chapter-header",
			".chapter-title",
			"article header",
			"h1",
			".content-wrapper",
		];

		for (const selector of selectors) {
			const element = document.querySelector(selector);
			if (element) {
				return { element, position: "before" };
			}
		}

		return null;
	}

	// Find the main content element of the page
	findContentArea() {
		// Prefer explicit main landmark or role-marked main elements first
		const mainSelectors = ["main[role='main']", "[role='main']", "main"];
		for (const sel of mainSelectors) {
			const el = document.querySelector(sel);
			if (el && (el.textContent || "").trim().length > 200) {
				debugLog(
					`Base handler: Found content using main selector: ${sel}`,
				);
				return el;
			}
		}

		// Common content selectors across many websites (prefer more specific ones)
		const commonSelectors = [
			"article",
			".article",
			".content",
			".main-content",
			".chapter-content",
			"#content",
			".entry-content",
			".post-content",
			"#storytext",
		];

		for (const selector of commonSelectors) {
			const element = document.querySelector(selector);
			if (
				element &&
				element !== document.body &&
				element !== document.documentElement &&
				(element.textContent || "").trim().length > 300
			) {
				debugLog(
					`Base handler: Found content with selector ${selector}`,
				);
				return element;
			}
		}

		// Fallback: group paragraphs by their nearest content parent and pick the
		// parent with the most total paragraph text. This avoids joining every
		// <p> on the page (sidebars, footers) which can cause whole-page extraction.
		const paragraphs = Array.from(document.querySelectorAll("p"));
		const groups = new Map();

		for (const p of paragraphs) {
			const text = (p.textContent || "").trim();
			if (!text) continue;
			// Use the nearest meaningful ancestor (up to 3 levels)
			let ancestor = p.parentElement;
			let depth = 0;
			while (ancestor && ancestor !== document.body && depth < 3) {
				if (!ancestor) break;
				// stop if ancestor is likely a container (has class/id)
				if (
					ancestor.id ||
					(ancestor.classList && ancestor.classList.length > 0)
				) {
					break;
				}
				ancestor = ancestor.parentElement;
				depth++;
			}

			if (!ancestor) ancestor = p.parentElement;

			const key = ancestor;
			const stats = groups.get(key) || { length: 0, count: 0 };
			stats.length += text.length;
			stats.count += 1;
			groups.set(key, stats);
		}

		// Choose the group with the largest combined paragraph length
		let best = null;
		let bestLen = 0;
		for (const [el, stats] of groups.entries()) {
			if (
				el !== document.body &&
				el !== document.documentElement &&
				stats.length > bestLen &&
				stats.count >= 3
			) {
				best = el;
				bestLen = stats.length;
			}
		}

		if (best && bestLen > 300) {
			debugLog(
				"Base handler: Found content using paragraph-cluster method",
			);
			return best;
		}

		debugLog("Base handler: Could not find content area");
		return null;
	}

	// Extract the title of the chapter
	extractTitle() {
		throw new Error(
			"Method extractTitle() must be implemented by subclass",
		);
	}

	/**
	 * Extract the full content of the chapter.
	 *
	 * Handlers that need site-specific cleaning override this; the ones that
	 * don't (FanFiction desktop and mobile) get this path, so it has to do the
	 * two things a caller is entitled to assume. It used to do neither:
	 *
	 * - It read `document.title` directly instead of calling `this.extractTitle()`,
	 *   which made every subclass's carefully-written `extractTitle()` dead code
	 *   unless that subclass also overrode `extractContent()`. FanFiction's, which
	 *   digs the story name out of `#profile_top`, was never reached — chapters
	 *   were titled "Story, a fandom fanfic | FanFiction" instead.
	 * - It read `innerText` off the live element, so scripts, ad slots and
	 *   `<ins>` blocks sitting inside the content area went straight into the
	 *   text handed to the model.
	 */
	extractContent() {
		let title;
		try {
			title = this.extractTitle();
		} catch {
			// `extractTitle()` is abstract. A subclass that never implemented it
			// should still get content back rather than an exception.
			title = document.title;
		}

		const contentArea = this.findContentArea();
		if (!contentArea) {
			return {
				found: false,
				title: title,
				text: "",
				selector: "No content found",
			};
		}

		const clone = this.cloneAndCleanContent(contentArea);
		const content = this.cleanExtractedText(
			clone.innerText || clone.textContent || "",
		);

		return {
			found: content.length > 100,
			title: title,
			text: content,
			selector: "generic",
		};
	}

	// Get chapter navigation info (previous, next, current chapter number)
	getChapterNavigation() {
		// Default implementation - subclasses can override
		return {
			hasPrevious: false,
			hasNext: false,
			currentChapter: 1,
			totalChapters: 1,
		};
	}

	// Check if current page is a chapter page (not a listing/index page)
	// Subclasses should override for site-specific detection
	isChapterPage() {
		// Default: assume all pages are chapter pages
		// This prevents the extension from incorrectly hiding UI on unknown sites
		return true;
	}

	// Get ideal insertion point for UI controls
	getUIInsertionPoint(contentArea) {
		// Default behavior: Insert before the content area
		return {
			element: contentArea,
			position: "before",
		};
	}

	// Get site-specific prompt for this handler
	// This can be overridden by website-specific handlers
	getSiteSpecificPrompt() {
		// Get stored prompt for this site if it exists
		const hostname = pageLocation().hostname;
		const storedPrompt = this.getStoredSitePrompt(hostname);

		if (storedPrompt) {
			return storedPrompt;
		}

		// Return the default prompt for this handler
		return this.getDefaultPrompt();
	}

	// Get default prompt for this site (to be overridden by specific handlers)
	getDefaultPrompt() {
		// Base implementation returns empty string
		return "";
	}

	// Get stored site-specific prompt
	getStoredSitePrompt(hostname) {
		try {
			// Try to get stored site prompts from localStorage
			const storedPrompts = localStorage.getItem("siteSpecificPrompts");
			if (storedPrompts) {
				const promptsObj = JSON.parse(storedPrompts);
				return promptsObj[hostname] || "";
			}
		} catch (error) {
			debugError("Error retrieving stored site prompt:", error);
		}
		return "";
	}

	// Get site identifier for the prompt UI
	getSiteIdentifier() {
		// Default implementation returns hostname
		return pageLocation().hostname;
	}

	/**
	 * Extract page metadata for content enhancement context
	 * Used for providing site-specific information to AI during processing
	 * Subclasses should override for site-specific metadata extraction
	 * @returns {Object} Context with author, title, genres, tags, status, description, etc.
	 */
	extractPageMetadata() {
		// Default implementation: returns basic context
		return {
			author: null,
			title: document.title || null,
			genres: [],
			tags: [],
			status: null,
			description: null,
			originalUrl: pageLocation().href,
		};
	}

	/**
	 * Detect the page's dark/light mode theme
	 * Subclasses should override for site-specific dark mode detection
	 * @returns {string} 'dark', 'light', or 'auto' (let extension decide)
	 */
	getPageTheme() {
		// Default: Let extension use its own theme detection
		return "auto";
	}

	/**
	 * Normalize/redirect URL for site-specific requirements
	 * Static method called BEFORE handler instantiation
	 * Use for instant redirects (e.g., fanfiction.net -> www.fanfiction.net)
	 * @static
	 * @async
	 * @returns {Promise<boolean>} True if redirect occurred, false otherwise
	 */
	static async normalizeURL() {
		// Default: No normalization needed
		return false;
	}

	/**
	 * Get custom buttons to add to controls
	 * Handlers can add site-specific buttons (e.g., mobile/desktop toggle)
	 * @returns {Array<{text: string, icon: string, onClick: function, position: string}>}
	 */
	getCustomButtons() {
		// Default: No custom buttons
		return [];
	}

	/**
	 * Inject custom UI elements into the control container
	 * Called after main controls are created
	 * @param {HTMLElement} container - Control container element
	 * @async
	 */
	async injectCustomUI(container) {
		container;
		// Default: No custom UI
	}

	/**
	 * Get default enhancement display mode preference for this site
	 * @returns {string} 'button' (show button to trigger) or 'direct' (show banners immediately)
	 */
	getDefaultDisplayMode() {
		// Default: Button mode (less intrusive)
		return "button";
	}

	/**
	 * Get handler-proposed library settings.
	 *
	 * WARNING — this is NOT how you add a user-facing setting. Nothing in the
	 * shipped extension currently consumes this. It is returned by the
	 * `getHandlerSettings` background message, keyed by *domain*, as a schema
	 * (`key -> {type, default, label}`) rather than as values. It is not
	 * rendered by the Library and it is not read by `content.js`.
	 *
	 * Declaring a setting here and expecting it to take effect is exactly the
	 * bug recorded as UX-7 in PRODUCTION_READINESS_AUDIT.md — it fails silently,
	 * because the lookup simply returns undefined. Use the static
	 * `SETTINGS_DEFINITION` above instead.
	 *
	 * @returns {Object} Settings schema as { key: { type, enum, default, label, description, ... } }
	 *                   Empty object means no custom settings for this handler
	 */
	getProposedLibrarySettings() {
		// Default: No custom settings
		return {};
	}

	/**
	 * Get the URL where metadata should be fetched from
	 * Used for dedicated_page and redirect handler types
	 * @returns {string|null} URL to fetch metadata from, or null if metadata is on current page
	 */
	getMetadataSourceUrl() {
		// Default: Metadata is on current page (chapter_embedded type)
		return null;
	}

	/**
	 * Process remotely-fetched metadata before returning
	 * Allows handlers to normalize or enrich metadata from other sources
	 * @param {Object} metadata - Metadata fetched from remote source
	 * @returns {Object} Processed metadata
	 */
	processRemoteMetadata(metadata) {
		// Default: Return metadata as-is
		return metadata;
	}

	/**
	 * Get handler-specific editable fields for the library edit modal.
	 * These are shown BELOW the common fields (title, author, cover, etc.) in a
	 * site-specific section so users can edit metadata unique to this website.
	 *
	 * Field spec object shape:
	 *   { key, label, type, source, options?, placeholder?, min?, max? }
	 *
	 *  key      - property name inside novel.metadata (or novel[key] if source='top')
	 *  label    - human-readable label
	 *  type     - 'text' | 'number' | 'select' | 'tags' | 'toggle' | 'date'
	 *  source   - 'metadata' (default, reads/writes novel.metadata[key])
	 *             'top' (reads/writes novel[key] directly)
	 *  options  - array of { value, label } for 'select' type
	 *  placeholder - optional hint text
	 *
	 * @returns {Array<Object>} Array of field spec objects. Empty = no site-specific fields.
	 */
	static getEditableFields() {
		return [];
	}

	// ─── Shared utility methods ──────────────────────────────────────────────────
	// These were previously duplicated across every handler. All handlers inherit
	// them from here. Handlers may still override any of these for site-specific
	// behaviour; call super.method() when you want the base logic plus extras.

	/**
	 * Noise element selectors removed from cloned content before text extraction.
	 * Handlers that need to strip additional site-specific elements should pass
	 * those selectors as `extraSelectors` to cloneAndCleanContent().
	 */
	static NOISE_SELECTORS = [
		"script",
		"style",
		"iframe",
		"ins",
		".ads",
		".adsbygoogle",
		"[class*='ads']",
		"[id*='ads']",
		"[data-ad]",
		"[data-ads]",
		".google-auto-placed",
		"[class*='advert']",
		"[id*='advert']",
	];

	/**
	 * Clone a DOM element and strip all standard noise (scripts, ads, iframes).
	 * Handlers should use this instead of writing their own cloneNode+cleanup.
	 * @param {Element} element - The DOM element to clone
	 * @param {string[]} [extraSelectors=[]] - Additional selectors to remove
	 * @returns {Element} A cleaned deep clone
	 */
	cloneAndCleanContent(element, extraSelectors = []) {
		const clone = element.cloneNode(true);
		const selectors = [
			...this.constructor.NOISE_SELECTORS,
			...extraSelectors,
		];
		for (const sel of selectors) {
			clone.querySelectorAll(sel).forEach((el) => el.remove());
		}
		return clone;
	}

	/**
	 * Normalise raw extracted text: collapse runs of spaces within lines,
	 * normalise line-endings, and collapse 3+ blank lines to 2.
	 * @param {string} rawText
	 * @returns {string}
	 */
	cleanExtractedText(rawText) {
		return (rawText || "")
			.replace(/\r\n?/g, "\n")
			.split("\n")
			.map((line) => line.replace(/[^\S\r\n]{2,}/g, " ").trimEnd())
			.join("\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim();
	}

	/**
	 * Resolve a possibly-relative URL against the current page (or an explicit base).
	 * Returns null if the input is falsy; returns the input unchanged on error.
	 * @param {string|null} url
	 * @param {string} [base=pageLocation().href]
	 * @returns {string|null}
	 */
	normalizeUrl(url, base = pageLocation().href) {
		if (!url) return null;
		try {
			return new URL(url, base).href;
		} catch {
			return url;
		}
	}

	/**
	 * Extract a cover image URL from a DOM element, trying multiple selectors in order.
	 * Falls back to the Open Graph image meta tag when nothing else matches.
	 * Lazy-loaded images are handled by checking `data-src` before `src`.
	 *
	 * @param {string[]} selectors - CSS selectors for <img> or container elements
	 * @param {Element} [root=document] - Root element to search within
	 * @param {string[]} [skipPatterns=['placeholder','default','no-image']] - src substrings to skip
	 * @returns {string|null}
	 */
	extractCoverUrl(
		selectors,
		root = document,
		skipPatterns = ["placeholder", "default", "no-image", "blank."],
	) {
		for (const sel of selectors) {
			const el = root.querySelector(sel);
			if (!el) continue;
			const src =
				el.dataset?.src ||
				el.getAttribute("src") ||
				el.getAttribute("data-original") ||
				"";
			if (!src) continue;
			if (skipPatterns.some((p) => src.includes(p))) continue;
			return this.normalizeUrl(src) || null;
		}
		// Open Graph fallback — reliable on most sites
		const og = document.querySelector('meta[property="og:image"]');
		return og?.getAttribute("content") || null;
	}

	/**
	 * Count the number of words in a plain-text string.
	 * @param {string} text
	 * @returns {number}
	 */
	countWords(text) {
		return (text || "").trim().split(/\s+/).filter(Boolean).length;
	}

	/**
	 * Parse compact human-readable numbers ("1.2K", "5M", "3.4B") to integers.
	 * Returns null when the input cannot be parsed.
	 * @param {string} text
	 * @returns {number|null}
	 */
	parseCompactNumber(text) {
		if (!text) return null;
		const cleaned = String(text).trim().replace(/,/g, "").toLowerCase();
		const match = cleaned.match(/([\d.]+)\s*([kmb])?/i);
		if (!match) return null;
		const base = parseFloat(match[1]);
		if (Number.isNaN(base)) return null;
		switch ((match[2] || "").toLowerCase()) {
			case "k":
				return Math.round(base * 1_000);
			case "m":
				return Math.round(base * 1_000_000);
			case "b":
				return Math.round(base * 1_000_000_000);
			default:
				return Math.round(base);
		}
	}

	/**
	 * Convert simple Markdown emphasis markers inside an HTML string to tags.
	 * Existing HTML tags are preserved unchanged.
	 * Handles ***bold-italic***, **bold**, and *italic*.
	 * @param {string} html
	 * @returns {string}
	 */
	convertMarkdownFormatting(html) {
		if (!html) return html;
		// Temporarily replace HTML tags with unique placeholders so they are not affected
		const tags = [];
		const PH = "￾TAG"; // Private-use code point, safe in strings, won't appear in HTML
		let out = html.replace(/<[^>]+>/g, (tag) => {
			tags.push(tag);
			return `${PH}${tags.length - 1}|`;
		});
		out = out
			.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
			.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
			.replace(/\*([^\s*][^*]*[^\s*])\*/g, "<em>$1</em>")
			.replace(/\*([^\s*]+)\*/g, "<em>$1</em>");
		// Restore HTML tags — escape PH for use in regex
		return out.replace(
			new RegExp(`${PH}(\\d+)\\|`, "g"),
			(_, i) => tags[parseInt(i)],
		);
	}

	/**
	 * Apply standard post-enhancement paragraph styling to a content area.
	 * Handlers that want site-specific styles should override this method.
	 * @param {Element} contentArea
	 */
	formatAfterEnhancement(contentArea) {
		if (!contentArea) return;
		contentArea.querySelectorAll("p").forEach((p) => {
			p.style.marginBottom = "1em";
			p.style.lineHeight = "1.7";
		});
	}

	/**
	 * Check whether the current viewport is narrower than the given breakpoint.
	 * @param {number} [breakpointPx=768]
	 * @returns {boolean}
	 */
	isMobileViewport(breakpointPx = UI_MOBILE_BREAKPOINT_PX) {
		return window.innerWidth <= breakpointPx;
	}

	/**
	 * Get a fallback novel ID by base-64-hashing the URL path.
	 * Handlers should prefer their own ID schemes; use this only as a last resort.
	 * @param {string} [url=pageLocation().href]
	 * @param {string} prefix - Handler-specific prefix, e.g. "mysite"
	 * @returns {string}
	 */
	generateFallbackNovelId(url = pageLocation().href, prefix = "novel") {
		try {
			const pathname = new URL(url).pathname;
			const hash = btoa(pathname)
				.substring(0, 16)
				.replace(/[^a-zA-Z0-9]/g, "");
			return `${prefix}-${hash}`;
		} catch {
			return `${prefix}-${Date.now()}`;
		}
	}
}
