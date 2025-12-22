/**
 * ScribbleHub Website Content Handler
 * Specialized handler for extracting content from scribblehub.com
 *
 * Supported URLs:
 * - Novel page: https://www.scribblehub.com/series/{id}/{slug}/
 * - Chapter page: https://www.scribblehub.com/read/{id}-{slug}/chapter/{chapterId}/
 *
 * Handler Type: "dedicated_page" - novel metadata fully available on /series/ pages
 * Chapter pages have enough info to add to library
 */
import { BaseWebsiteHandler } from "./base-handler.js";
import { debugLog, debugError } from "../logger.js";

export class ScribbleHubHandler extends BaseWebsiteHandler {
	// Static properties for domain management
	static SUPPORTED_DOMAINS = [
		"www.scribblehub.com",
		"scribblehub.com",
		"*.scribblehub.com",
	];

	static DEFAULT_ENABLED = true;

	static PRIORITY = 40;

	// Shelf metadata for Novel Library - PRIMARY handler
	static SHELF_METADATA = {
		id: "scribblehub",
		isPrimary: true,
		name: "ScribbleHub",
		icon: "https://www.scribblehub.com/favicon.ico",
		emoji: "✨",
		color: "#6c5ce7",
		novelIdPattern: /\/series\/(\d+)\/|\/read\/(\d+)-/,
		primaryDomain: "www.scribblehub.com",
	};

	// Handler type: Metadata requires visiting dedicated novel info page
	static HANDLER_TYPE = "dedicated_page";

	static DEFAULT_SITE_PROMPT = `This is a novel from ScribbleHub. Please maintain the author's style and any formatting features. Respect any special formatting for dialogue, thoughts, or scene transitions. Please improve grammar and readability while maintaining the original meaning and flow.`;

	constructor() {
		super();
		this.selectors = {
			// Chapter page selectors
			chapterContent: ["#chp_raw", "#chp_contents", ".chp_raw"],
			chapterTitle: [".chapter-title"],
			chapterNav: [".prenext", ".btn-prev", ".btn-next"],
			// Novel page selectors
			novelTitle: [".fic_title"],
			novelCover: [".fic_image img"],
			novelDescription: [".wi_fic_desc"],
			novelGenres: [".fic_genre"],
			novelTags: [".wi_fic_showtags a.stag"],
			novelStats: [".st_item"],
			novelRating: [".fic_rate span span"],
			novelAuthor: ["#authorid", 'a[href*="/profile/"]'],
			breadcrumb: [".wi_breadcrumb.chapter a[href*='/series/']"],
		};
	}

	// Return true if this handler can handle the current website
	canHandle() {
		const hostname = window.location.hostname;
		return (
			hostname.includes("scribblehub.com") ||
			hostname === "scribblehub.com"
		);
	}

	/**
	 * Check if current page is a chapter page
	 * Chapter pages: /read/{id}-{slug}/chapter/{chapterId}/
	 * @returns {boolean}
	 */
	isChapterPage() {
		const pathname = window.location.pathname;

		// Check URL pattern for chapter pages
		if (pathname.includes("/read/") && pathname.includes("/chapter/")) {
			debugLog("ScribbleHub: Detected chapter page via URL pattern");
			return true;
		}

		// Fallback: Check for chapter-specific DOM elements
		const chapterContent = document.querySelector(
			"#chp_raw, #chp_contents, .chp_raw"
		);
		const chapterTitle = document.querySelector(".chapter-title");

		if (chapterContent && chapterTitle) {
			debugLog("ScribbleHub: Detected chapter page via DOM elements");
			return true;
		}

		// Check for chapter navigation buttons
		const hasChapterNav = document.querySelector(
			".btn-prev, .btn-next, .prenext"
		);
		if (hasChapterNav && chapterContent) {
			debugLog("ScribbleHub: Detected chapter page via navigation");
			return true;
		}

		return false;
	}

	/**
	 * Check if current page is a novel/series info page
	 * Novel pages: /series/{id}/{slug}/
	 * @returns {boolean}
	 */
	isNovelPage() {
		const pathname = window.location.pathname;

		// Check URL pattern for novel/series pages
		if (pathname.includes("/series/") && !pathname.includes("/chapter/")) {
			// Make sure it's not a stats or glossary subpage
			if (
				!pathname.includes("/stats") &&
				!pathname.includes("/glossary")
			) {
				debugLog("ScribbleHub: Detected novel page via URL pattern");
				return true;
			}
		}

		// Fallback: Check for novel-specific DOM elements
		const ficTitle = document.querySelector(".fic_title");
		const ficDesc = document.querySelector(".wi_fic_desc");
		const ficImage = document.querySelector(".fic_image img");

		if (ficTitle && ficDesc && ficImage) {
			debugLog("ScribbleHub: Detected novel page via DOM elements");
			return true;
		}

		return false;
	}

	/**
	 * Find the main content area for chapter pages
	 * @returns {Element|null}
	 */
	findContentArea() {
		// Look for chapter content in order of preference
		const selectors = ["#chp_raw", "#chp_contents", ".chp_raw"];

		for (const selector of selectors) {
			const element = document.querySelector(selector);
			if (element) {
				const text = element.innerText?.trim() || "";
				if (text.length > 100) {
					debugLog(
						`ScribbleHub: Found content area with ${selector}`
					);
					return element;
				}
			}
		}

		// Fallback to base implementation
		debugLog("ScribbleHub: Falling back to base handler for content area");
		return super.findContentArea();
	}

	/**
	 * Extract the chapter title
	 * @returns {string}
	 */
	extractTitle() {
		// For chapter pages
		const chapterTitle = document.querySelector(".chapter-title");
		if (chapterTitle) {
			return chapterTitle.textContent.trim();
		}

		// For novel pages
		const ficTitle = document.querySelector(".fic_title");
		if (ficTitle) {
			return ficTitle.textContent.trim();
		}

		// Fallback to page title
		const pageTitle = document.title;
		const match = pageTitle.match(/(.+?)\s*\|\s*Scribble Hub/);
		if (match) {
			return match[1].trim();
		}

		return pageTitle;
	}

	/**
	 * Extract chapter content
	 * @returns {Object} { found, title, text, selector }
	 */
	extractContent() {
		const contentArea = this.findContentArea();
		if (!contentArea) {
			return {
				found: false,
				title: "",
				text: "",
				selector: "",
			};
		}

		const chapterTitle = this.extractTitle();

		// Clone to prevent modifying DOM
		const contentClone = contentArea.cloneNode(true);

		// Remove unwanted elements
		const elementsToRemove = contentClone.querySelectorAll(
			".ta_c_bm, .chapter_stats, .c_set, #my_popupreading, .nav_chp_fi, .prenext, .next_nav_links, script, style, .ad_336, .align_banner, [id^='div-gpt']"
		);
		elementsToRemove.forEach((el) => el.remove());

		// Get clean text content
		let chapterText = contentClone.innerText
			.trim()
			.replace(/\n\s+/g, "\n")
			.replace(/\s{2,}/g, " ")
			.replace(/Previous\s*Next/gi, "")
			.trim();

		return {
			found: chapterText.length > 100,
			title: chapterTitle,
			text: chapterText,
			selector: "scribblehub-handler",
		};
	}

	/**
	 * Get chapter navigation info
	 * @returns {Object}
	 */
	getChapterNavigation() {
		try {
			const prevLink = document.querySelector(
				"a.btn-prev:not(.disabled)"
			);
			const nextLink = document.querySelector(
				"a.btn-next:not(.disabled)"
			);

			let currentChapter = 1;
			const titleEl = document.querySelector(".chapter-title");
			if (titleEl) {
				const titleMatch =
					titleEl.textContent.match(/Chapter\s*(\d+)/i);
				if (titleMatch) {
					currentChapter = parseInt(titleMatch[1], 10);
				}
			}

			return {
				hasPrevious: !!prevLink,
				hasNext: !!nextLink,
				previousUrl: prevLink?.href || null,
				nextUrl: nextLink?.href || null,
				currentChapter: currentChapter,
				totalChapters: 0,
			};
		} catch (error) {
			debugError("ScribbleHub: Error getting chapter navigation:", error);
		}

		return super.getChapterNavigation();
	}

	/**
	 * Get ideal insertion point for UI controls (enhance/summarize buttons)
	 * @param {Element} contentArea
	 * @returns {Object} { element, position }
	 */
	getUIInsertionPoint(contentArea) {
		// Insert before the chapter content
		const chpContents = document.querySelector("#chp_contents");
		if (chpContents) {
			return { element: chpContents, position: "before" };
		}

		const chpRaw = document.querySelector("#chp_raw, .chp_raw");
		if (chpRaw) {
			return { element: chpRaw, position: "before" };
		}

		// Try after chapter title
		const chapterTitle = document.querySelector(".chapter-title");
		if (chapterTitle) {
			return { element: chapterTitle, position: "after" };
		}

		return super.getUIInsertionPoint(contentArea);
	}

	/**
	 * Get novel controls configuration for ScribbleHub
	 * @returns {Object}
	 */
	getNovelControlsConfig() {
		const isChapter = this.isChapterPage();
		const isNovel = this.isNovelPage();

		return {
			showControls: isChapter || isNovel,
			insertionPoint: isChapter
				? this.getChapterUIInsertionPoint()
				: this.getNovelPageUIInsertionPoint(),
			position: "before",
			isChapterPage: isChapter,
			isNovelPage: isNovel,
			customStyles: {
				background: "linear-gradient(135deg, #2d2d2d 0%, #1a1a2e 100%)",
				borderColor: "#6c5ce7",
				accentColor: "#a29bfe",
			},
		};
	}

	/**
	 * Get insertion point for controls on chapter pages
	 * @returns {Object|null}
	 */
	getChapterUIInsertionPoint() {
		const chpContents = document.querySelector("#chp_contents");
		if (chpContents) {
			return { element: chpContents, position: "before" };
		}

		const chpRaw = document.querySelector("#chp_raw, .chp_raw");
		if (chpRaw) {
			return { element: chpRaw, position: "before" };
		}

		const chapterStats = document.querySelector(".chapter_stats");
		if (chapterStats) {
			return { element: chapterStats, position: "after" };
		}

		return null;
	}

	/**
	 * Get insertion point for novel page UI
	 * @returns {Object|null}
	 */
	getNovelPageUIInsertionPoint() {
		const novelTitle = document.querySelector(".wi_novel_title");
		if (novelTitle) {
			return { element: novelTitle, position: "before" };
		}

		const readButtons = document.querySelector(".read_buttons");
		if (readButtons) {
			return { element: readButtons, position: "after" };
		}

		const novelContainer = document.querySelector(".novel-container");
		if (novelContainer) {
			return { element: novelContainer, position: "after" };
		}

		const ficRow = document.querySelector(".fic_row.details");
		if (ficRow) {
			return { element: ficRow, position: "before" };
		}

		return null;
	}

	/**
	 * Format content after enhancement
	 * @param {Element} contentArea
	 */
	formatAfterEnhancement(contentArea) {
		if (contentArea) {
			contentArea.querySelectorAll("p").forEach((p) => {
				p.style.marginBottom = "1em";
				p.style.lineHeight = "1.7";
			});
		}
	}

	getDefaultPrompt() {
		return ScribbleHubHandler.DEFAULT_SITE_PROMPT;
	}

	getSiteIdentifier() {
		return "ScribbleHub";
	}

	getSiteSpecificPrompt() {
		return ScribbleHubHandler.DEFAULT_SITE_PROMPT;
	}

	/**
	 * Extract novel metadata for library storage
	 * @returns {Object}
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
			fandoms: [],
			status: null,
			chapters: null,
			totalChapters: null,
			views: null,
			favorites: null,
			readers: null,
			rating: null,
			ratingCount: null,
			chaptersPerWeek: null,
			needsDetailPage: false,
			metadataIncomplete: false,
		};

		try {
			const isOnChapterPage = this.isChapterPage();
			const isOnNovelPage = this.isNovelPage();

			debugLog(
				`ScribbleHub: Extracting metadata (chapter: ${isOnChapterPage}, novel: ${isOnNovelPage})`
			);

			if (isOnChapterPage) {
				metadata.needsDetailPage = true; // Chapter pages lack full metadata
				// ===== CHAPTER PAGE EXTRACTION =====
				const breadcrumbLink = document.querySelector(
					".wi_breadcrumb.chapter a[href*='/series/']"
				);
				if (breadcrumbLink) {
					metadata.title = breadcrumbLink.textContent.trim();
					metadata.mainNovelUrl = breadcrumbLink.href;
				}

				const novelLink = document.querySelector(
					".chp_byauthor a[href*='/series/']"
				);
				if (!metadata.title && novelLink) {
					metadata.title = novelLink.textContent.trim();
					metadata.mainNovelUrl = novelLink.href;
				}

				const authorLink = document.querySelector(
					".chp_byauthor a[href*='/profile/']"
				);
				if (authorLink) {
					metadata.author = authorLink.textContent.trim();
				}

				const chapterCover = document.querySelector(".s_novel_img img");
				if (chapterCover) {
					const src = chapterCover.getAttribute("src");
					if (src && !src.includes("noimagefound")) {
						metadata.coverUrl = this.normalizeUrl(src);
					}
				}

				const chapterTitle = document.querySelector(".chapter-title");
				if (chapterTitle) {
					const chapterMatch =
						chapterTitle.textContent.match(/Chapter\s*(\d+)/i);
					if (chapterMatch) {
						metadata.chapters = parseInt(chapterMatch[1], 10);
					}
				}

				// Try to get total chapters from chapter selector dropdown
				const chapterSelector = document.querySelector(
					"#chp_select, .chapter_select select"
				);
				if (chapterSelector) {
					const options = chapterSelector.querySelectorAll("option");
					if (options.length > 0) {
						metadata.totalChapters = options.length;
						debugLog(
							`ScribbleHub: Found ${options.length} chapters from selector`
						);
					}
				}

				// Alternative: look for chapter count in page elements
				if (!metadata.totalChapters) {
					// Check for "Chapter X of Y" pattern
					const pageText = document.body.innerText;
					const chapterOfMatch = pageText.match(
						/Chapter\s*\d+\s*(?:of|\/)\s*(\d+)/i
					);
					if (chapterOfMatch) {
						metadata.totalChapters = parseInt(
							chapterOfMatch[1],
							10
						);
					}
				}

				// Check stats section if visible on chapter page
				if (!metadata.totalChapters) {
					const statsText =
						document.querySelector(".s_sinfo, .story_stats")
							?.textContent || "";
					const chaptersMatch = statsText.match(
						/(\d+)\s*(?:Chapter|Chapters)/i
					);
					if (chaptersMatch) {
						metadata.totalChapters = parseInt(chaptersMatch[1], 10);
					}
				}
			} else if (isOnNovelPage) {
				// ===== NOVEL PAGE EXTRACTION =====
				const titleEl = document.querySelector(".fic_title");
				if (titleEl) {
					metadata.title = titleEl.textContent.trim();
				}

				const authorLinks = document.querySelectorAll(
					'a[href*="/profile/"]'
				);
				for (const link of authorLinks) {
					const text = link.textContent.trim();
					if (text && text.length < 50) {
						metadata.author = text;
						break;
					}
				}

				const descEl = document.querySelector(".wi_fic_desc");
				if (descEl) {
					const text = descEl.textContent.trim();
					metadata.description =
						text.length > 1000
							? text.substring(0, 1000) + "..."
							: text;
				}

				const coverEl = document.querySelector(".fic_image img");
				if (coverEl) {
					const src = coverEl.getAttribute("src");
					if (src && !src.includes("noimagefound")) {
						metadata.coverUrl = this.normalizeUrl(src);
					}
				}

				const genreLinks = document.querySelectorAll(".fic_genre");
				genreLinks.forEach((link) => {
					const genre = link.textContent.trim();
					if (genre && !metadata.genres.includes(genre)) {
						metadata.genres.push(genre);
					}
				});

				const fandomLinks = document.querySelectorAll(
					".wi_fic_genre a.stag[href*='/fandom/']"
				);
				fandomLinks.forEach((link) => {
					const fandom = link.textContent.trim();
					if (fandom && !metadata.fandoms.includes(fandom)) {
						metadata.fandoms.push(fandom);
					}
				});

				const tagLinks = document.querySelectorAll(
					".wi_fic_showtags a.stag"
				);
				tagLinks.forEach((link) => {
					const tag = link.textContent.trim();
					if (tag && !metadata.tags.includes(tag)) {
						metadata.tags.push(tag);
					}
				});

				const statsItems = document.querySelectorAll(".st_item");
				statsItems.forEach((item) => {
					const text = item.textContent.toLowerCase();
					const numberMatch = item.textContent.match(/([\d,.]+k?)/i);

					if (numberMatch) {
						const valueStr = numberMatch[1].replace(/,/g, "");
						let value;

						if (valueStr.toLowerCase().endsWith("k")) {
							value = parseFloat(valueStr) * 1000;
						} else {
							value = parseFloat(valueStr);
						}

						if (text.includes("views")) {
							metadata.views = Math.round(value);
						} else if (text.includes("favorite")) {
							metadata.favorites = Math.round(value);
						} else if (text.includes("chapters/week")) {
							metadata.chaptersPerWeek = value;
						} else if (text.includes("chapter")) {
							metadata.totalChapters = Math.round(value);
						} else if (text.includes("reader")) {
							metadata.readers = Math.round(value);
						}
					}
				});

				const ratingEl = document.querySelector(".fic_rate span span");
				if (ratingEl) {
					const ratingText = ratingEl.textContent.trim();
					metadata.rating = parseFloat(ratingText) || null;
				}

				const ratingCountEl = document.querySelector(".rate_more");
				if (ratingCountEl) {
					const countMatch =
						ratingCountEl.textContent.match(/(\d+)\s*ratings/i);
					if (countMatch) {
						metadata.ratingCount = parseInt(countMatch[1], 10);
					}
				}

				metadata.mainNovelUrl = window.location.href;
			}

			// Mark incomplete metadata when we only had access to a chapter page
			if (isOnChapterPage && !isOnNovelPage) {
				metadata.metadataIncomplete =
					!metadata.totalChapters ||
					metadata.genres.length === 0 ||
					metadata.tags.length === 0;
			}

			// Fallback title from page title
			if (!metadata.title) {
				const pageTitle = document.title;
				const match = pageTitle.match(/^(.+?)\s*(?:-|\|)/);
				if (match) {
					metadata.title = match[1].trim();
				}
			}

			// Fallback mainNovelUrl
			if (!metadata.mainNovelUrl) {
				metadata.mainNovelUrl = this.getNovelPageUrl();
			}
		} catch (error) {
			debugError("ScribbleHub: Error extracting metadata:", error);
		}

		// Validate that we're on a valid page (chapter or novel page)
		if (!this.isChapterPage() && !this.isNovelPage()) {
			debugLog(
				"ScribbleHub: Not on a valid novel or chapter page, returning null"
			);
			return null;
		}

		// Additional validation: check if we have essential metadata
		if (!metadata.title || metadata.title === "Scribble Hub") {
			debugLog(
				"ScribbleHub: Invalid metadata - likely on home/index page"
			);
			return null;
		}

		debugLog("ScribbleHub: Extracted metadata:", metadata);
		return metadata;
	}

	/**
	 * Extract page metadata for content enhancement context
	 * Provides site-specific information for AI during content processing
	 * @returns {Object} Context with author, title, genres, tags, status, description
	 */
	extractPageMetadata() {
		const context = {
			author: null,
			title: null,
			genres: [],
			tags: [],
			status: null,
			description: null,
			originalUrl: window.location.href,
		};

		try {
			// Title from breadcrumb link to series
			const seriesLink = document.querySelector(
				'.wi_breadcrumb.chapter a[href*="/series/"]'
			);
			if (seriesLink) {
				context.title = seriesLink.textContent.trim();
			}

			// Author
			const authorLink = document.querySelector(
				".auth a[href*='/profile/'], .auth_name a, a[rel='author']"
			);
			if (authorLink) {
				context.author = authorLink.textContent.trim();
			}

			// Description (only available on series pages, but capture if present)
			const description = document.querySelector(".wi_fic_desc");
			if (description) {
				context.description = description.textContent.trim();
			}

			// Genres/Tags on series pages
			const genreEls = document.querySelectorAll(".fic_genre a");
			if (genreEls.length) {
				context.genres = Array.from(genreEls).map((el) =>
					el.textContent.trim()
				);
			}

			const tagEls = document.querySelectorAll(".wi_fic_showtags a.stag");
			if (tagEls.length) {
				context.tags = Array.from(tagEls).map((el) =>
					el.textContent.trim()
				);
			}
		} catch (error) {
			debugError("ScribbleHub: Error extracting page metadata:", error);
		}

		return context;
	}

	/**
	 * Normalize URL to absolute
	 * @param {string} url
	 * @returns {string}
	 */
	normalizeUrl(url) {
		if (!url) return null;
		try {
			return new URL(url, window.location.href).href;
		} catch (e) {
			return url;
		}
	}

	/**
	 * Generate a unique novel ID from URL
	 * @param {string} url
	 * @returns {string}
	 */
	generateNovelId(url = window.location.href) {
		const seriesMatch = url.match(/\/series\/(\d+)\//);
		if (seriesMatch) {
			return `scribblehub-${seriesMatch[1]}`;
		}

		const readMatch = url.match(/\/read\/(\d+)-/);
		if (readMatch) {
			return `scribblehub-${readMatch[1]}`;
		}

		const urlHash = btoa(url)
			.substring(0, 16)
			.replace(/[^a-zA-Z0-9]/g, "");
		return `scribblehub-${urlHash}`;
	}

	/**
	 * Get the novel details page URL from a chapter page
	 * @returns {string|null}
	 */
	getNovelPageUrl() {
		if (this.isNovelPage()) {
			return window.location.href;
		}

		// Primary: Extract from .chp_byauthor (most reliable on chapter pages)
		// <div class="chp_byauthor"><a href="https://www.scribblehub.com/series/1499718/...">Novel Title</a> by ...</div>
		const novelLink = document.querySelector(
			".chp_byauthor a[href*='/series/']"
		);
		if (novelLink) {
			return novelLink.href;
		}

		// Fallback: Try breadcrumb
		const breadcrumbLink = document.querySelector(
			".wi_breadcrumb.chapter a[href*='/series/']"
		);
		if (breadcrumbLink) {
			return breadcrumbLink.href;
		}

		// Last resort: Construct from URL pattern
		const readMatch = window.location.pathname.match(
			/\/read\/(\d+)-([^/]+)\//
		);
		if (readMatch) {
			const [, id, slug] = readMatch;
			return `https://www.scribblehub.com/series/${id}/${slug}/`;
		}

		return null;
	}

	/**
	 * Get current chapter URL
	 * @returns {string|null}
	 */
	getCurrentChapterUrl() {
		if (this.isChapterPage()) {
			return window.location.href;
		}
		return null;
	}

	/**
	 * Get current chapter info for progress tracking
	 * @returns {Object|null}
	 */
	getCurrentChapterInfo() {
		if (!this.isChapterPage()) {
			return null;
		}

		const chapterTitle = document.querySelector(".chapter-title");
		const titleText = chapterTitle?.textContent.trim() || "";

		const chapterMatch = titleText.match(/Chapter\s*(\d+)/i);
		const chapterNumber = chapterMatch
			? parseInt(chapterMatch[1], 10)
			: null;

		return {
			url: window.location.href,
			title: titleText,
			chapterNumber: chapterNumber,
			timestamp: Date.now(),
		};
	}
}

// Default export - singleton instance
export default new ScribbleHubHandler();
