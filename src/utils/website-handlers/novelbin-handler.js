/**
 * NovelBin Website Content Handler
 *
 * Covers novelbin.com and clone sites that share the same Bootstrap-based
 * web-novel template (novelbin.me, novelfire.net, etc.).
 *
 * Handler Type: "dedicated_page"
 *   - Full metadata only on /b/{novel-slug} detail pages
 *   - Chapter pages:       /b/{novel-slug}/{chapter-slug}
 *
 * Background metadata fetch note:
 *   MetadataFetcher temporarily swaps document.body with the fetched detail
 *   page HTML while window.location still points to the chapter URL.
 *   extractNovelMetadata() therefore uses DOM-based page-type detection
 *   rather than URL-based, so it works correctly during both scenarios.
 */
import { BaseWebsiteHandler } from "./base-handler.js";
import { debugLog, debugError } from "../logger.js";

export class NovelbinHandler extends BaseWebsiteHandler {
	static SUPPORTED_DOMAINS = [
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
		id: "novelbin",
		isPrimary: true,
		name: "NovelBin",
		icon: "https://novelbin.com/favicon.ico",
		emoji: "\u{1F4DA}",
		color: "#6200ea",
		// Captures the novel slug from /b/{slug} or /b/{slug}/{chapter-slug}
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
			{
				key: "autoEnhanceEnabled",
				label: "Auto-enhance chapters",
				type: "toggle",
				defaultValue: false,
				description:
					"Automatically run Enhance when a NovelBin chapter loads.",
			},
		],
	};

	static DEFAULT_SITE_PROMPT =
		"This is a web novel from NovelBin. Please maintain the author's style while improving the translation quality. Keep paragraph breaks, dialogue formatting, and scene transitions intact. Preserve special formatting for emphasis, flashbacks, or internal monologue. Place any translator notes in a clearly separated box at the end.";

	constructor() {
		super();
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
	 * Detect a detail page via URL: /b/{slug}  (exactly two non-empty segments).
	 * @param {string} [pathname]
	 */
	_isDetailPageUrl(pathname = window.location.pathname) {
		const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
		return parts.length === 2 && parts[0] === "b";
	}

	/**
	 * Detect a chapter page via URL: /b/{slug}/{chapter-slug} (3+ segments).
	 * @param {string} [pathname]
	 */
	_isChapterPageUrl(pathname = window.location.pathname) {
		const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
		return parts.length >= 3 && parts[0] === "b";
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

	/** Extract the novel slug from any novelbin URL. */
	_novelSlug(url = window.location.href) {
		try {
			const match = new URL(url).pathname.match(/\/b\/([a-z0-9-]+)/i);
			return match ? match[1] : null;
		} catch {
			return null;
		}
	}

	/**
	 * Generate a stable library ID from a novelbin URL.
	 * Works on both detail pages (/b/{slug}) and chapter pages (/b/{slug}/{chapter}).
	 * @param {string} url
	 * @returns {string|null}
	 */
	generateNovelId(url = window.location.href) {
		const slug = this._novelSlug(url);
		return slug ? `novelbin-${slug}` : null;
	}

	/** Return the detail page URL (works from chapter pages). */
	getNovelPageUrl() {
		if (this._isDetailPageUrl()) return window.location.href;

		// Build from slug
		const slug = this._novelSlug();
		if (slug) return `${window.location.origin}/b/${slug}`;

		// Fallback: JS object injected by the site on chapter pages
		const cr = window.__CHAPTER_READER__;
		if (cr?.novel?.url) return cr.novel.url;

		// Fallback: DOM link
		const link = document.querySelector("a.novel-title[href]");
		return link ? link.href : null;
	}

	/**
	 * Return the URL from which the background runner should fetch metadata.
	 * Always the detail page, whether we're on a chapter or the detail page itself.
	 */
	getMetadataSourceUrl() {
		return this.getNovelPageUrl();
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
		for (const sel of ["#chr-content", ".chr-c"]) {
			const el = document.querySelector(sel);
			if (el && el.textContent.trim().length > 100) {
				debugLog(`NovelBin: Found content area via '${sel}'`);
				return el;
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

		const clone = contentArea.cloneNode(true);

		// Remove noise elements before text extraction
		for (const sel of [
			"script",
			"style",
			"iframe",
			"ins",
			".ads",
			"[class*='ads']",
			"[id*='ads']",
			".adsbygoogle",
			"[data-ad]",
		]) {
			clone.querySelectorAll(sel).forEach((el) => el.remove());
		}

		const text = (clone.innerText || clone.textContent || "")
			.replace(/\r\n?/g, "\n")
			.split("\n")
			.map((l) => l.replace(/[^\S\r\n]{2,}/g, " ").trimEnd())
			.join("\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim();

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
				prevEl?.dataset?.chapterUrl ||
				cr?.prevChapter?.url ||
				null;
			const nextUrl =
				nextEl?.dataset?.chapterUrl ||
				cr?.nextChapter?.url ||
				null;

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
			for (const sel of [".col-info-desc", ".desc-text", ".novel-info"]) {
				const el = document.querySelector(sel);
				if (el) return { element: el, position: "before" };
			}
		}

		// Chapter page
		for (const sel of ["#chr-content", ".chr-c"]) {
			const el = document.querySelector(sel);
			if (el) return { element: el, position: "before" };
		}

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
			const isDetail = this._isDetailPageDom();
			const isChapter = this._isChapterPageDom();

			if (!isDetail && isChapter) {
				// Chapter page only \u{2014} return minimal partial metadata
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

			// Info-meta list \u{2014} each <li> has an <h3> label and content
			const infoItems = Array.from(
				document.querySelectorAll("ul.info.info-meta li, .info-meta li"),
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
						if (g) metadata.genres.push(g);
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
						if (t) metadata.tags.push(t);
					});
				}
			}

			// Description \u{2014} the site uses a collapsible block; grab the full text
			// Tags may also appear outside the info-meta list
			if (!metadata.tags.length) {
				document.querySelectorAll(".tag-list a, .tag a").forEach((a) => {
					const t = a.textContent.trim();
					if (t && !metadata.genres.includes(t)) metadata.tags.push(t);
				});
			}

			const descEl = document.querySelector(
				"#novel-description-content, .desc-text",
			);
			if (descEl) {
				const dc = descEl.cloneNode(true);
				dc.querySelectorAll("script, style").forEach((e) => e.remove());
				const raw = (dc.textContent || "").trim();
				if (raw) metadata.description = raw;
			}

			// Cover image \u{2014} novelbin lazy-loads via data-src
			const coverImg = document.querySelector(
				".books .book img.lazy, .book img[data-src], .book img",
			);
			if (coverImg) {
				const src =
					coverImg.dataset.src || coverImg.getAttribute("src");
				if (src && !src.includes("placeholder") && !src.includes("default")) {
					try {
						metadata.coverUrl = new URL(src, window.location.href).href;
					} catch {
						// invalid URL \u{2014} ignore
					}
				}
			}

			// Fallback cover from Open Graph tag
			if (!metadata.coverUrl) {
				const og = document.querySelector('meta[property="og:image"]');
				if (og) metadata.coverUrl = og.getAttribute("content") || null;
			}

			// Main novel URL \u{2014} prefer the canonical <link> when present
			const canonical = document.querySelector('link[rel="canonical"]');
			metadata.mainNovelUrl =
				canonical?.getAttribute("href") || window.location.href;
		} catch (error) {
			debugError("NovelBin: Error extracting metadata:", error);
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
		return "NovelBin";
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
		if (!contentArea) return;
		contentArea.querySelectorAll("p").forEach((p) => {
			p.style.marginBottom = "1em";
			p.style.lineHeight = "1.8";
		});
	}

	/** NovelBin renders HTML chapter content — HTML enhancement is preferred. */
	supportsTextOnlyEnhancement() {
		return false;
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
