/**
 * NovelBin Website Content Handler
 *
 * Covers novelbin.com (legacy), novelbin.me (mirror), and NovelBin-template
 * clones. novelarrow.com is handled by the dedicated NovelarrowHandler
 * (novelarrow-handler.js) which extends this class.
 *
 * URL patterns:
 *   NovelBin:    /b/{slug}                   (detail)
 *                /b/{slug}/{chapter-slug}    (chapter)
 *
 * Handler Type: "dedicated_page"
 * Library shelfId stays "novelbin" for backwards compatibility with existing data.
 */
import { BaseWebsiteHandler } from "./base-handler.js";
import { debugLog, debugError } from "../logger.js";

export class NovelbinHandler extends BaseWebsiteHandler {
	static SUPPORTED_DOMAINS = [
		// NovelBin legacy
		"novelbin.com",
		"www.novelbin.com",
		"novelbin.me",
		"www.novelbin.me",
		"*.novelbin.com",
		"*.novelbin.me",
	];

	static DEFAULT_ENABLED = true;

	static PRIORITY = 10;

	static SHELF_METADATA = {
		// Keep "novelbin" as shelfId — changing it would break existing library data.
		id: "novelbin",
		isPrimary: true,
		name: "NovelBin",
		icon: "https://novelbin.com/favicon.ico",
		emoji: "📚",
		color: "#6200ea",
		novelIdPattern: /\/b\/([a-z0-9-]+)/i,
		primaryDomain: "novelbin.com",
		importUrlTemplate: "https://novelbin.com/b/{id}",
		taxonomy: [
			{ id: "genres", label: "Genres", type: "array" },
			{ id: "tags", label: "Tags", type: "array" },
			{ id: "status", label: "Status", type: "string" },
			{ id: "language", label: "Language", type: "string" },
		],
	};

	// Handler type: metadata only available on dedicated detail page
	static HANDLER_TYPE = "dedicated_page";

	static SETTINGS_DEFINITION = {
		fields: [
			{ key: "_nav", type: "section", label: "🌐 Domain" },
			{
				key: "preferredDomain",
				label: "Preferred Domain",
				type: "select",
				defaultValue: "novelarrow",
				description:
					"Which domain to open when following novel links. novelarrow.com is the current primary site.",
				options: [
					{
						value: "novelarrow",
						label: "novelarrow.com (primary ★)",
					},
					{ value: "novelbin", label: "novelbin.com (legacy)" },
					{ value: "novelbin-me", label: "novelbin.me (mirror)" },
				],
			},
			{ key: "_enhance", type: "section", label: "✨ Enhancement" },
			{
				key: "autoEnhanceEnabled",
				label: "Auto-enhance chapters",
				type: "toggle",
				defaultValue: false,
				description: "Automatically run Enhance when a chapter loads.",
			},
			{
				key: "htmlEnhancementMode",
				label: "HTML enhancement mode",
				type: "toggle",
				defaultValue: true,
				description:
					"Use HTML-aware enhancement to preserve paragraph formatting, italics, and line breaks. Disable for plain-text mode.",
			},
			{
				key: "injectEnhancedStyles",
				label: "Inject enhanced reading styles",
				type: "toggle",
				defaultValue: true,
				description:
					"Apply typography improvements (line height, spacing) to enhanced chapter text.",
			},
		],
	};

	static DEFAULT_SITE_PROMPT =
		"This is a web novel from NovelArrow. Please maintain the author's style while improving the translation quality. Keep paragraph breaks, dialogue formatting, and scene transitions intact. Preserve special formatting for emphasis, flashbacks, or internal monologue. Place any translator notes in a clearly separated box at the end.";

	constructor() {
		super();
	}

	/**
	 * Called once by handler-manager on every page load.
	 * Redirects novelbin.me (and any other mirror TLD) to novelbin.com,
	 * matching the pattern used by fanfiction.ws → fanfiction.net.
	 */
	static initialize() {
		NovelbinHandler.normalizeURL().catch(() => {});
	}

	/**
	 * Normalises mirror TLD domains (novelbin.me → novelbin.com).
	 * novelarrow.com is canonical and is NOT redirected.
	 * @returns {Promise<boolean>}
	 */
	static async normalizeURL() {
		const hostname = window.location.hostname;
		// novelarrow.com — primary canonical domain, never redirect
		if (hostname === "novelarrow.com" || hostname === "www.novelarrow.com")
			return false;
		// novelbin.com — legacy canonical, no redirect needed
		if (hostname === "novelbin.com" || hostname === "www.novelbin.com")
			return false;
		// novelbin.me and other TLD mirrors → redirect to novelbin.com
		if (!hostname.includes("novelbin.")) return false;
		const canonical = hostname.replace(/novelbin\.[a-z]+$/, "novelbin.com");
		if (canonical === hostname) return false;
		const target = window.location.href.replace(hostname, canonical);
		window.location.replace(target);
		return true;
	}

	canHandle() {
		const h = window.location.hostname;
		return NovelbinHandler.SUPPORTED_DOMAINS.some((d) => {
			if (d.startsWith("*.")) return h.endsWith(d.slice(1));
			return h === d;
		});
	}

	// -------------------------------------------------------------------------
	// Page-type detection (URL-based, used from content script context)
	// -------------------------------------------------------------------------

	/**
	 * Detect a detail page via URL.
	 *   NovelBin:   /b/{slug}       (2 segments, first = "b")
	 *   NovelArrow: /novel/{slug}   (2 segments, first = "novel")
	 */
	_isDetailPageUrl(pathname = window.location.pathname) {
		const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
		return parts.length === 2 && (parts[0] === "b" || parts[0] === "novel");
	}

	/**
	 * Detect a chapter page via URL.
	 *   NovelBin:   /b/{slug}/{chapter-slug}     (3+ segments, first = "b")
	 *   NovelArrow: /novel/{slug}/{chapter-id}   (3+ segments, first = "novel")
	 */
	_isChapterPageUrl(pathname = window.location.pathname) {
		const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
		return parts.length >= 3 && (parts[0] === "b" || parts[0] === "novel");
	}

	// -------------------------------------------------------------------------
	// Page-type detection (DOM-based, safe during background DOM swap)
	// -------------------------------------------------------------------------

	/**
	 * DOM-based detail page detection.
	 * The detail page has the info-meta list and description container.
	 * This is called by extractNovelMetadata() so it works even when the
	 * background runner has swapped in the detail page body.
	 */
	_isDetailPageDom() {
		return !!(
			document.querySelector("ul.info.info-meta") ||
			document.querySelector("#novel-description-content") ||
			document.querySelector(".books .book")
		);
	}

	/** DOM-based chapter page detection. */
	_isChapterPageDom() {
		return !!(
			document.querySelector("#chr-content") ||
			document.querySelector(".chr-c")
		);
	}

	// BaseWebsiteHandler overrides

	isChapterPage() {
		return this._isChapterPageUrl();
	}

	/**
	 * Called after pushState/replaceState navigation to allow the handler to
	 * reset any cached page-type state. isChapterPage() re-evaluates from
	 * window.location.pathname on each call, so no reset is needed here.
	 */
	refreshForCurrentUrl() {
		return this.isChapterPage();
	}

	isNovelPage() {
		return this._isDetailPageUrl();
	}

	// -------------------------------------------------------------------------
	// URL helpers
	// -------------------------------------------------------------------------

	/** True when running on novelarrow.com. */
	get _isNovelarrow() {
		const h = window.location.hostname;
		return h === "novelarrow.com" || h === "www.novelarrow.com";
	}

	/**
	 * Extract the novel slug from any supported URL.
	 * Handles both /b/{slug} (NovelBin) and /novel/{slug} (NovelArrow).
	 */
	_novelSlug(url = window.location.href) {
		try {
			const match = new URL(url).pathname.match(
				/\/(?:b|novel)\/([a-z0-9-]+)/i,
			);
			return match ? match[1] : null;
		} catch {
			return null;
		}
	}

	/**
	 * Generate a stable library ID.
	 * Always uses "novelbin-{slug}" regardless of which domain was visited,
	 * so novelarrow.com visits merge into existing novelbin library entries.
	 */
	generateNovelId(url = window.location.href) {
		const slug = this._novelSlug(url);
		return slug ? `novelbin-${slug}` : null;
	}

	/**
	 * Return a domain-agnostic canonical URL for cache keying.
	 * Both novelbin.com and novelarrow.com chapter pages share the same cache
	 * so enhancement done on one domain is visible on the other.
	 *
	 * Format: https://novelbin.com/b/{novelSlug}/{chapterSlug}
	 */
	getCanonicalCacheUrl(url = window.location.href) {
		try {
			const path = new URL(url).pathname.replace(/\/$/, "");
			const parts = path.split("/").filter(Boolean);
			// NovelBin: /b/{novel}/{chapter}  → parts = ["b", novel, chapter]
			// NovelArrow: /chapter/{novel}/{chapter} → parts = ["chapter", novel, chapter]
			let novelSlug, chapterSlug;
			if (parts[0] === "b" && parts.length >= 3) {
				[, novelSlug, chapterSlug] = parts;
			} else if (parts[0] === "chapter" && parts.length >= 3) {
				[, novelSlug, chapterSlug] = parts;
			} else {
				return url;
			}
			return `https://novelbin.com/b/${novelSlug}/${chapterSlug}`;
		} catch {
			return url;
		}
	}

	/** Build a novel detail URL for the given slug using the preferred domain setting. */
	_makeNovelUrl(slug, preferredDomain = "novelarrow") {
		if (!slug) return null;
		switch (preferredDomain) {
			case "novelbin":
				return `https://novelbin.com/b/${slug}`;
			case "novelbin-me":
				return `https://novelbin.me/b/${slug}`;
			case "novelarrow":
			default:
				return `https://novelarrow.com/novel/${slug}`;
		}
	}

	/**
	 * Return the canonical detail page URL.
	 * Respects the preferredDomain setting from Library Settings > Sites.
	 */
	getNovelPageUrl(preferredDomain = "novelarrow") {
		const slug = this._novelSlug();
		if (slug) return this._makeNovelUrl(slug, preferredDomain);

		// Fallback for NovelBin chapter pages: JS object injected by the site
		const cr = window.__CHAPTER_READER__;
		if (cr?.novel?.url) {
			try {
				const u = new URL(cr.novel.url);
				const s = this._novelSlug(u.href);
				if (s) return this._makeNovelUrl(s, preferredDomain);
			} catch {
				/* ignore */
			}
		}

		// Fallback: DOM link on novelbin chapter pages
		const link = document.querySelector("a.novel-title[href]");
		if (link?.href) {
			try {
				const s = this._novelSlug(link.href);
				if (s) return this._makeNovelUrl(s, preferredDomain);
			} catch {
				/* ignore */
			}
		}
		return null;
	}

	/**
	 * Wait for chapter content to appear in the DOM after SPA navigation.
	 * NovelBin loads chapter text asynchronously; the content script must
	 * wait before trying to extract or inject UI.
	 * @param {number} [timeoutMs=6000]
	 * @returns {Promise<boolean>} Resolves true when content found, false on timeout.
	 */
	async waitForChapterContent(timeoutMs = 8000, oldFingerprint = "") {
		const POLL_MS = 150;
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			const el = this.findContentArea();
			if (el && el.textContent.trim().length > 50) {
				if (
					!oldFingerprint ||
					el.textContent.trim().slice(0, 300) !== oldFingerprint
				) {
					return true;
				}
			}
			await new Promise((r) => setTimeout(r, POLL_MS));
		}
		return false;
	}

	/**
	 * Return the URL from which the background runner should fetch metadata.
	 * Always the canonical novelbin.com detail page.
	 */
	getMetadataSourceUrl() {
		return this.getNovelPageUrl();
	}

	/** Normalize lastReadUrl before it is stored. */
	getLastReadUrl() {
		return this._normalizeDomain(window.location.href);
	}

	// -------------------------------------------------------------------------
	// Core extraction
	// -------------------------------------------------------------------------

	extractTitle() {
		if (this._isChapterPageUrl()) {
			// Try site-injected JS object first (most reliable)
			const cr = window.__CHAPTER_READER__;
			if (cr?.chapter?.name) return cr.chapter.name;

			// DOM selectors for chapter title
			for (const sel of [
				"h2 .chr-text",
				".chr-title .chr-text",
				"a.chr-title .chr-text",
				"h2",
			]) {
				const el = document.querySelector(sel);
				if (el?.textContent?.trim()) return el.textContent.trim();
			}
		}

		// Detail page or fallback
		const titleEl = document.querySelector(
			'h3.title[itemprop="name"], .col-info-desc h3.title, h3.title',
		);
		if (titleEl) return titleEl.textContent.trim();

		return document.title;
	}

	findContentArea() {
		// NovelBin (Bootstrap/jQuery site)
		for (const sel of ["#chr-content", ".chr-c"]) {
			const el = document.querySelector(sel);
			if (el && el.textContent.trim().length > 100) {
				debugLog(`NovelBin: Found content area via '${sel}'`);
				return el;
			}
		}
		// NovelArrow (Next.js/React SPA) — try common React chapter content patterns
		for (const sel of [
			"#chapter-content",
			"[data-testid='chapter-content']",
			".chapter-content",
			".chapter-body",
			"[class*='chapter-content']",
			"[class*='chapter-body']",
			".prose",
			"[class*='prose']",
			"article",
		]) {
			try {
				const el = document.querySelector(sel);
				if (el && el.textContent.trim().length > 100) {
					debugLog(`NovelArrow: Found content area via '${sel}'`);
					return el;
				}
			} catch {
				/* invalid selector, skip */
			}
		}
		return super.findContentArea();
	}

	extractContent() {
		if (!this.isChapterPage()) {
			return {
				found: false,
				title: this.extractTitle(),
				text: "",
				selector: "novelbin-not-chapter",
			};
		}

		const contentArea = this.findContentArea();
		if (!contentArea) {
			return {
				found: false,
				title: this.extractTitle(),
				text: "",
				selector: "novelbin-no-content",
			};
		}

		const clone = this.cloneAndCleanContent(contentArea);
		const text = this.cleanExtractedText(
			clone.innerText || clone.textContent || "",
		);

		return {
			found: text.length > 100,
			title: this.extractTitle(),
			text,
			selector: "novelbin-chr-content",
		};
	}

	getChapterNavigation() {
		try {
			const cr = window.__CHAPTER_READER__;

			const prevEl = document.querySelector(
				'a.js-chapter-nav[data-chapter-nav="prev"]',
			);
			const nextEl = document.querySelector(
				'a.js-chapter-nav[data-chapter-nav="next"]',
			);

			const prevUrl =
				prevEl?.dataset?.chapterUrl || cr?.prevChapter?.url || null;
			const nextUrl =
				nextEl?.dataset?.chapterUrl || cr?.nextChapter?.url || null;

			// Try to parse chapter number from title or URL
			let currentChapter = null;
			const titleText = this.extractTitle();
			const fromTitle = titleText.match(/chapter[- _]*(\d+)/i);
			const fromUrl = window.location.pathname.match(/chapter-(\d+)/i);
			const numMatch = fromTitle || fromUrl;
			if (numMatch) currentChapter = parseInt(numMatch[1], 10);

			return {
				hasPrevious: !!prevUrl,
				hasNext: !!nextUrl,
				previousUrl: prevUrl,
				nextUrl,
				currentChapter: currentChapter ?? 0,
				totalChapters: 0,
			};
		} catch (error) {
			debugError("NovelBin: Error getting chapter navigation:", error);
			return super.getChapterNavigation();
		}
	}

	getNovelPageUIInsertionPoint() {
		if (this.isNovelPage()) {
			// NovelBin detail page
			for (const sel of [".col-info-desc", ".desc-text", ".novel-info"]) {
				const el = document.querySelector(sel);
				if (el) return { element: el, position: "before" };
			}
			// NovelArrow detail page (React)
			for (const sel of ["main", "#main-content", "h1"]) {
				const el = document.querySelector(sel);
				if (el) return { element: el, position: "before" };
			}
		}

		// Chapter page — use the content area as insertion point
		const contentEl = this.findContentArea();
		if (contentEl) return { element: contentEl, position: "before" };

		return null;
	}

	// -------------------------------------------------------------------------
	// Metadata extraction (DOM-based detection for background fetch compatibility)
	// -------------------------------------------------------------------------

	/**
	 * Extract novel metadata.
	 *
	 * Called in two contexts:
	 *   1. From the content script on the current page
	 *   2. From the background MetadataFetcher after it has swapped document.body
	 *      with the fetched detail-page HTML (window.location still points to the
	 *      chapter URL in context 2, so we use DOM-based detection here).
	 */
	extractNovelMetadata() {
		const metadata = {
			title: null,
			author: null,
			description: null,
			coverUrl: null,
			mainNovelUrl: null,
			genres: [],
			tags: [],
			status: null,
			chapterCount: null,
			language: null,
			needsDetailPage: false,
			metadataIncomplete: false,
		};

		try {
			// ── NovelArrow (Next.js React) meta-tag extraction path ──────────────
			// When the background fetcher swaps in a novelarrow.com detail page, the
			// React components aren't rendered — only static <meta> tags are present.
			// Detect this by checking og:site_name or the canonical URL.
			const ogSiteName =
				document
					.querySelector('meta[property="og:site_name"]')
					?.getAttribute("content") || "";
			const canonicalHref =
				document
					.querySelector('link[rel="canonical"]')
					?.getAttribute("href") || "";
			const isNovelarrowPage =
				ogSiteName.toLowerCase().includes("novel arrow") ||
				canonicalHref.includes("novelarrow.com") ||
				(window.location?.hostname || "").includes("novelarrow");

			if (isNovelarrowPage) {
				const getMeta = (attr, val) =>
					document
						.querySelector(`meta[${attr}="${val}"]`)
						?.getAttribute("content") || null;
				const ogTitle = getMeta("property", "og:title");
				metadata.title = ogTitle
					? ogTitle
							.replace(/\s*[|\-–]\s*Read\s+Online.*$/i, "")
							.replace(/\s*on\s+Novel\s*Arrow\s*$/i, "")
							.trim()
					: null;
				metadata.author = getMeta("name", "author");
				metadata.description =
					getMeta("name", "description") ||
					getMeta("property", "og:description");
				metadata.coverUrl = getMeta("property", "og:image");
				metadata.mainNovelUrl = canonicalHref || this.getNovelPageUrl();
				// Genres/tags from React-rendered links (available when user is on the page)
				document.querySelectorAll("a[href^='/genre/']").forEach((a) => {
					const g = a.textContent.trim();
					if (g && !metadata.genres.includes(g))
						metadata.genres.push(g);
				});
				document.querySelectorAll("a[href^='/tag/']").forEach((a) => {
					const t = a.textContent.trim();
					if (t && !metadata.tags.includes(t)) metadata.tags.push(t);
				});
				if (metadata.title) return metadata;
				// Fall through to novelbin DOM extraction if meta tags are empty
			}

			const isDetail = this._isDetailPageDom();
			const isChapter = this._isChapterPageDom();

			if (!isDetail && isChapter) {
				// Chapter page only — return minimal partial metadata
				metadata.needsDetailPage = true;
				metadata.metadataIncomplete = true;

				const cr = window.__CHAPTER_READER__;
				metadata.title =
					cr?.novel?.name ||
					document
						.querySelector("a.novel-title")
						?.textContent?.trim() ||
					null;
				metadata.mainNovelUrl = this.getNovelPageUrl();
				return metadata;
			}

			// Full extraction from detail page DOM
			// ------------------------------------------------------------------

			// Title
			const titleEl = document.querySelector(
				'h3.title[itemprop="name"], .col-info-desc h3.title, h3.title',
			);
			metadata.title = titleEl?.textContent?.trim() || null;

			// Force-unhide the info-meta section so CSS-collapsed items are accessible
			document
				.querySelectorAll(
					"ul.info.info-meta, .info-meta, .tag-container",
				)
				.forEach((el) => {
					el.style.maxHeight = "";
					el.style.overflow = "";
					el.style.display = "";
					el.querySelectorAll(
						"[style*='display:none'], [style*='visibility:hidden']",
					).forEach((child) => {
						child.style.display = "";
						child.style.visibility = "";
					});
				});

			// Info-meta list — each <li> has an <h3> label and content
			const infoItems = Array.from(
				document.querySelectorAll(
					"ul.info.info-meta li, .info-meta li",
				),
			);
			for (const li of infoItems) {
				const label =
					li.querySelector("h3")?.textContent?.trim().toLowerCase() ||
					"";
				if (label.includes("author")) {
					metadata.author =
						li.querySelector("a")?.textContent?.trim() || null;
				} else if (label.includes("genre")) {
					li.querySelectorAll("a").forEach((a) => {
						const g = a.textContent.trim();
						if (
							g &&
							!g.includes("»") &&
							g.toLowerCase() !== "see more"
						)
							metadata.genres.push(g);
					});
				} else if (label.includes("status")) {
					metadata.status =
						li.querySelector("a")?.textContent?.trim() || null;
				} else if (label.includes("language")) {
					metadata.language =
						li.querySelector("a")?.textContent?.trim() || null;
				} else if (
					label.includes("chapter") ||
					label.includes("latest")
				) {
					const numMatch = li.textContent.match(/(\d[\d,]*)/);
					if (numMatch) {
						metadata.chapterCount = parseInt(
							numMatch[1].replace(/,/g, ""),
							10,
						);
					}
				} else if (label.includes("tag")) {
					li.querySelectorAll("a").forEach((a) => {
						const t = a.textContent.trim();
						if (
							t &&
							!t.includes("»") &&
							t.toLowerCase() !== "see more"
						)
							metadata.tags.push(t);
					});
				}
			}

			// Tags may also appear outside the info-meta list
			if (!metadata.tags.length) {
				document
					.querySelectorAll(".tag-list a, .tag a, .tag-container a")
					.forEach((a) => {
						const t = a.textContent.trim();
						if (
							t &&
							!t.includes("»") &&
							t.toLowerCase() !== "see more" &&
							!metadata.genres.includes(t)
						)
							metadata.tags.push(t);
					});
			}

			// Description — force-unhide before cloning so CSS-truncated content is captured
			const descEl = document.querySelector(
				"#novel-description-content, .desc-text",
			);
			if (descEl) {
				const dc = descEl.cloneNode(true);
				// Strip UI elements and remove CSS truncation state
				dc.querySelectorAll(
					"script, style, .btn-desc-toggle, #novel-description-toggle, .showmore",
				).forEach((e) => e.remove());
				dc.classList.remove("desc-text-collapsed");
				dc.style.maxHeight = "";
				dc.style.overflow = "";
				// Reveal any display:none children (defensive against future changes)
				dc.querySelectorAll("[style*='display']").forEach((el) => {
					el.style.display = "";
				});
				const raw = (dc.textContent || "").trim();
				if (raw) metadata.description = raw;
			}

			// Cover image — novelbin lazy-loads via data-src
			const coverImg = document.querySelector(
				".books .book img.lazy, .book img[data-src], .book img",
			);
			metadata.coverUrl = this.extractCoverUrl([
				".books .book img.lazy",
				".book img[data-src]",
				".book img",
			]);

			// Main novel URL — prefer the canonical <link> when present
			const canonical = document.querySelector('link[rel="canonical"]');
			metadata.mainNovelUrl =
				canonical?.getAttribute("href") || window.location.href;
		} catch (error) {
			debugError("NovelBin: Error extracting metadata:", error);
		}

		// Normalise: library expects `totalChapters`, handler extracts `chapterCount`
		if (metadata.chapterCount && !metadata.totalChapters) {
			metadata.totalChapters = metadata.chapterCount;
		}

		debugLog("NovelBin: Extracted metadata:", metadata);
		return metadata;
	}

	extractPageMetadata() {
		return {
			author: null,
			title: this.extractTitle(),
			genres: [],
			tags: [],
			status: null,
			description: null,
			originalUrl: window.location.href,
		};
	}

	// -------------------------------------------------------------------------
	// Site identity & prompts
	// -------------------------------------------------------------------------

	getSiteIdentifier() {
		return this._isNovelarrow ? "NovelArrow" : "NovelBin";
	}

	getDefaultPrompt() {
		return NovelbinHandler.DEFAULT_SITE_PROMPT;
	}

	getSiteSpecificPrompt() {
		return NovelbinHandler.DEFAULT_SITE_PROMPT;
	}

	// -------------------------------------------------------------------------
	// Enhancement & display
	// -------------------------------------------------------------------------

	getDefaultDisplayMode() {
		return "button";
	}

	formatAfterEnhancement(contentArea) {
		super.formatAfterEnhancement(contentArea);
		// NovelBin uses slightly wider line-height than the base default
		contentArea?.querySelectorAll("p").forEach((p) => {
			p.style.lineHeight = "1.8";
		});
	}

	/** NovelBin renders HTML chapter content — HTML enhancement is preferred. */
	supportsTextOnlyEnhancement() {
		return false;
	}

	/**
	 * On NovelBin/NovelArrow chapter pages the library management bar is redundant
	 * and clutters the reading experience — only show it on the novel detail page.
	 */
	getNovelControlsConfig() {
		if (this.isChapterPage()) {
			return { showControls: false };
		}
		return super.getNovelControlsConfig();
	}

	// -------------------------------------------------------------------------
	// Library settings
	// -------------------------------------------------------------------------

	getProposedLibrarySettings() {
		return {
			preferredDomain: {
				type: "string",
				enum: NovelbinHandler.SUPPORTED_DOMAINS.filter(
					(d) => !d.startsWith("*"),
				),
				default: "novelbin.com",
				label: "Preferred Domain",
				description:
					"Which NovelBin-compatible domain to use for library links",
			},
		};
	}

	static getEditableFields() {
		return [
			{
				key: "status",
				label: "Novel Status",
				type: "select",
				source: "metadata",
				options: [
					{ value: "", label: "Unknown" },
					{ value: "Ongoing", label: "Ongoing" },
					{ value: "Completed", label: "Completed" },
					{ value: "Hiatus", label: "Hiatus" },
					{ value: "Dropped", label: "Dropped" },
				],
			},
			{
				key: "language",
				label: "Language",
				type: "text",
				source: "metadata",
				placeholder: "e.g. Korean, Chinese, Japanese",
			},
		];
	}
}

export default new NovelbinHandler();
