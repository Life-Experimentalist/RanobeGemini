/**
 * Ranobes.top Website Content Handler
 * Specialized handler for extracting content from ranobes.top
 *
 * Handler Type: "dedicated_page" - novel metadata only on separate /novels/ pages
 */
import { BaseWebsiteHandler } from "./base-handler.js";
import { debugLog, debugError } from "../logger.js";

export class RanobesHandler extends BaseWebsiteHandler {
	// Static properties for domain management
	// Explicitly supported domains (documented for clarity)
	// Wildcards act as safety net for any unlisted subdomains
	static SUPPORTED_DOMAINS = [
		"ranobes.top",
		"ranobes.net",
		"ranobes.com",
		"ranobes.org",
		"*.ranobes.top", // Safety net: catches any other subdomains
		"*.ranobes.net",
		"*.ranobes.com",
		"*.ranobes.org",
	];

	static DEFAULT_ENABLED = true;

	// Shelf metadata for Novel Library - PRIMARY handler
	static SHELF_METADATA = {
		id: "ranobes",
		isPrimary: true,
		name: "Ranobes",
		icon: "https://ranobes.top/templates/Dark/images/favicon.ico?v=2",
		emoji: "🍃",
		color: "#4a7c4e",
		// Pattern matches various ranobes URL formats and extracts the numeric novel ID:
		// Novel page:  /novels/1206917-my-yandere-female-tycoon-wife.html → captures 1206917
		// Chapter page: /my-yandere-female-tycoon-wife-1206917/2964516.html → captures 1206917

		// Read page: /read-1206917.html → captures 1206917
		// Chapters list: /chapters/1206917/ → captures 1206917
		novelIdPattern:
			/\/novels\/(\d+)-|\/[a-z0-9-]+-(\d+)\/|^\/read-(\d+)\.html|\/chapters\/(\d+)/,
		primaryDomain: "ranobes.top",
		// Taxonomy for shelf page filtering
		taxonomy: [
			{ id: "genres", label: "Genres", type: "array" },
			{ id: "tags", label: "Tags", type: "array" },
			{ id: "language", label: "Language", type: "string" },
			{ id: "status", label: "Status (COO)", type: "string" },
			{
				id: "translationStatus",
				label: "Translation Status",
				type: "string",
			},
		],
	};

	static PRIORITY = 5;

	// Handler type: Metadata requires visiting dedicated novel info page
	static HANDLER_TYPE = "dedicated_page";

	static DEFAULT_SITE_PROMPT = `This is a novel from Ranobes.top. Please maintain the author's style and any formatting features like section breaks, centered text, italics, etc. Respect any special formatting the author uses for dialogue, thoughts, flashbacks, or scene transitions. In regards with any author notes please place them in a box and filter out any non plot related content in the author notes which may be placed at the beginning or at the end of the chapter. And then add breaks to signify the separation between author notes and actual chapter. Please improve the translation while maintaining the original meaning and flow. Keep any special formatting like section breaks. Korean, Japanese and Chinese names should be properly transliterated.`;

	constructor() {
		super();
		this.selectors = {
			content: [
				"#arrticle", // Ranobes.top specific main content area
				".text-chapter",
				".story",
			],
			title: ["h1.title", ".story-title", ".chapter-title"],
		};
	}

	// Return true if this handler can handle the current website
	canHandle() {
		return (
			window.location.hostname.includes("ranobes.net") ||
			window.location.hostname.includes("ranobes.com") ||
			window.location.hostname.includes("ranobes.top")
		);
	}

	// Check if current page is a chapter page (not a listing/index page)
	isChapterPage() {
		// Check if URL contains chapter indicators
		if (
			window.location.pathname.includes("/chapter-") ||
			window.location.pathname.includes("/read-")
		) {
			return true;
		}

		// Check if this is a novel info page (NOT a chapter page)
		// Novel pages have .r-fullstory structure
		if (document.querySelector(".r-fullstory")) {
			return false;
		}

		// Check if page has content elements typical for chapter pages
		for (const selector of this.selectors.content) {
			const element = document.querySelector(selector);
			// Content element exists and has substantial text (not just a listing)
			if (element && element.innerText.trim().length > 1000) {
				return true;
			}
		}

		// Check if page has title elements typical for chapter pages
		for (const selector of this.selectors.title) {
			const titleElement = document.querySelector(selector);
			if (titleElement && titleElement.innerText.trim()) {
				// Check if the title indicates a chapter
				const titleText = titleElement.innerText.toLowerCase();
				if (
					titleText.includes("chapter") ||
					titleText.includes("volume")
				) {
					return true;
				}
			}
		}

		// Page doesn't match chapter page criteria
		return false;
	}

	/**
	 * Check if current page is a novel info page (not a chapter)
	 * @returns {boolean} True if this is a novel info/description page
	 */
	isNovelPage() {
		// Novel info pages typically have the .r-fullstory structure
		if (document.querySelector(".r-fullstory")) {
			return true;
		}

		// Check URL pattern for novel pages
		// e.g., /novels/123456-novel-name.html
		if (window.location.pathname.match(/\/novels\/\d+-[^/]+\.html$/)) {
			return true;
		}

		return false;
	}

	/**
	 * Generate a unique novel ID from URL
	 * Extracts numeric ID from various Ranobes URL formats
	 * @param {string} url - The novel or chapter URL
	 * @returns {string} Unique novel ID
	 */
	generateNovelId(url = window.location.href) {
		// Try multiple patterns to extract novel ID
		const patterns = [
			/\/novels\/(\d+)-/, // /novels/1206917-my-yandere-female-tycoon-wife.html
			/\/[a-z0-9-]+-(\d+)\//, // /my-yandere-female-tycoon-wife-1206917/
			/^\/read-(\d+)\.html/, // /read-1206917.html
			/\/chapters\/(\d+)/, // /chapters/1206917/
		];

		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match) {
				return `ranobes-${match[1]}`;
			}
		}

		// Fallback to URL hash
		const urlPath = new URL(url).pathname;
		const urlHash = btoa(urlPath)
			.substring(0, 16)
			.replace(/[^a-zA-Z0-9]/g, "");
		return `ranobes-${urlHash}`;
	}

	/**
	 * Get the novel details page URL from current page
	 * @returns {string|null}
	 */
	getNovelPageUrl() {
		// If already on novel page, return current URL
		if (this.isNovelPage()) {
			return window.location.href;
		}

		// Primary: Extract from category breadcrumb (most reliable on chapter pages)
		// <div class="category grey ellipses"><a href="/novels/1206962-...-name.html" rel="up">Novel Title</a></div>
		const categoryLink = document.querySelector(
			".category.grey.ellipses a[rel='up'][href*='/novels/']"
		);
		if (categoryLink) {
			return categoryLink.href;
		}

		// Fallback: Try to find link to novel page on chapter page
		const novelLink = document.querySelector(
			".r-chapter-info a[href*='/novels/'], .breadcrumb a[href*='/novels/'], a.btn-primary[href*='/novels/']"
		);
		if (novelLink) {
			return novelLink.href;
		}

		// Try extracting from page metadata or breadcrumb
		const breadcrumbs = document.querySelectorAll(".breadcrumb li a");
		for (const crumb of breadcrumbs) {
			if (crumb.href.includes("/novels/")) {
				return crumb.href;
			}
		}

		// Try to construct URL from novel ID
		const novelId = this.generateNovelId();
		if (novelId && novelId.startsWith("ranobes-")) {
			const numericId = novelId.replace("ranobes-", "");
			if (/^\d+$/.test(numericId)) {
				// We have a numeric ID, but we need the slug for the full URL
				// Return null if we can't construct the full URL
			}
		}

		return null;
	}

	/**
	 * Get novel controls configuration for Ranobes
	 * @returns {Object} Configuration for novel controls UI
	 */
	getNovelControlsConfig() {
		const isNovelPage = this.isNovelPage();
		const isChapter = this.isChapterPage();

		return {
			showControls: isNovelPage || isChapter,
			insertionPoint: this.getNovelPageUIInsertionPoint(),
			position: isNovelPage ? "after" : "before",
			isChapterPage: isChapter,
			customStyles: {
				background: "linear-gradient(135deg, #1a2634 0%, #0d1b2a 100%)",
				borderColor: "#4a7c4e",
				accentColor: "#4a7c4e",
			},
		};
	}

	/**
	 * Get insertion point for novel page UI
	 */
	getNovelPageUIInsertionPoint() {
		// For novel info pages
		if (this.isNovelPage()) {
			const selectors = [
				".r-fullstory-spec",
				".r-fullstory-info",
				".story-title",
			];
			for (const selector of selectors) {
				const el = document.querySelector(selector);
				if (el) {
					return { element: el, position: "after" };
				}
			}
		}

		// For chapter pages
		const chapterSelectors = ["h1.title", ".chapter-header", "#arrticle"];
		for (const selector of chapterSelectors) {
			const el = document.querySelector(selector);
			if (el) {
				return { element: el, position: "before" };
			}
		}

		return null;
	}

	// Find the content area on Ranobes
	findContentArea() {
		// Look for the main arrticle div (note: it's 'arrticle' not 'article' - ranobes typo)
		const contentElement = document.querySelector("#arrticle");
		if (contentElement) {
			debugLog("Ranobes: Found #arrticle content area");
			return contentElement;
		}

		// Fallback to .text-chapter
		const textChapter = document.querySelector(".text-chapter");
		if (textChapter) {
			debugLog("Ranobes: Found .text-chapter content area");
			return textChapter;
		}

		// Fallback to the base implementation
		debugLog("Ranobes: Falling back to base handler");
		return super.findContentArea();
	}

	extractTitle() {
		// Try to find the title from the heading
		const heading = document.querySelector("h1.title");
		if (heading) {
			// Ranobes headings sometimes include " by Author"; strip the author suffix
			return heading.textContent.trim().replace(/\s+by\s+.+$/i, "");
		}

		// Fallback to the default title extraction (page title)
		return document.title;
	}

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
		let sourceSelector = "";

		// Create a deep clone to prevent modifying the actual DOM
		const contentClone = contentArea.cloneNode(true);

		// Remove title elements from the content if they exist
		const titlesToRemove = contentClone.querySelectorAll(
			"h1, h2, h3.title, .story-title, .chapter-title"
		);
		titlesToRemove.forEach((title) => {
			title.remove();
		});

		// Remove ad-related elements before extracting text
		const adSelectors = [
			"script",
			"style",
			"iframe",
			"ins.adsbygoogle",
			"[class*='ads']",
			"[class*='advert']",
			"[id*='ads']",
			"[id*='advert']",
			".google-auto-placed",
			".adsbygoogle",
			"[data-ad]",
			"[data-ads]",
		];
		adSelectors.forEach((selector) => {
			contentClone
				.querySelectorAll(selector)
				.forEach((el) => el.remove());
		});

		// Get clean text content
		let chapterText = contentClone.innerText
			.trim()
			.replace(/\n\s+/g, "\n") // Preserve paragraph breaks but remove excess whitespace
			.replace(/\s{2,}/g, " "); // Replace multiple spaces with a single space

		// Remove ad-related text patterns from the content
		chapterText = this.removeAdRelatedText(chapterText);

		// Additional cleaning - check the first few lines for titles
		const titleParts = chapterTitle.split(/[:\-–—]/);
		const lines = chapterText.split("\n");
		const headLines = lines.slice(0, 5); // Only look at first 5 lines
		const filteredHeadLines = headLines.filter((line) => {
			const trimmedLine = line.trim();
			// Skip empty lines
			if (trimmedLine === "") return true;

			// Check if line is just the title or part of the title
			for (const titlePart of titleParts) {
				const cleanTitlePart = titlePart.trim();
				if (
					cleanTitlePart.length > 3 && // Avoid filtering out lines with short matches
					(trimmedLine === cleanTitlePart ||
						trimmedLine.startsWith(`${cleanTitlePart}:`) ||
						trimmedLine.startsWith(`${cleanTitlePart} -`))
				) {
					return false;
				}
			}

			// Check for common book name patterns at the start of content
			if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmedLine)) {
				return false;
			}

			return true;
		});

		// Recombine the filtered head lines with the rest of the content
		chapterText = [...filteredHeadLines, ...lines.slice(5)].join("\n");

		return {
			found: true,
			title: chapterTitle,
			text: chapterText,
			selector: sourceSelector || "ranobes-handler",
		};
	}

	// Get chapter navigation info (previous, next, current chapter number)
	getChapterNavigation() {
		try {
			// Try to find current chapter number
			const breadcrumbs = document.querySelector(".options-left");
			if (breadcrumbs) {
				const chapterText = breadcrumbs.textContent;
				const chapterMatch = chapterText.match(/Chapter (\d+)/i);

				// Try to find navigation links
				const prevLink = document.querySelector(".prev-chap");
				const nextLink = document.querySelector(".next-chap");

				if (chapterMatch) {
					const currentChapter = parseInt(chapterMatch[1], 10);
					return {
						hasPrevious: prevLink !== null,
						hasNext: nextLink !== null,
						currentChapter: currentChapter,
						totalChapters: 0, // Total unknown
					};
				}
			}
		} catch (error) {
			debugError("Error getting chapter navigation:", error);
		}

		// Fallback to default
		return super.getChapterNavigation();
	}

	// Get ideal insertion point for UI controls
	getUIInsertionPoint(contentArea) {
		// Look for .text div that wraps the #arrticle
		const textDiv = document.querySelector(".text");
		if (textDiv) {
			debugLog("Ranobes: Inserting UI before .text div");
			return {
				element: textDiv,
				position: "before",
			};
		}

		// Look for story_tools div - we want to insert before it (after content, before tools)
		const storyTools = document.querySelector(".story_tools");
		if (storyTools) {
			debugLog("Ranobes: Inserting UI before .story_tools");
			return {
				element: storyTools,
				position: "before",
			};
		}

		// Look for a better insertion point - we want to insert before the content
		// but after the title and possibly other elements
		const textChapter = document.querySelector(".text-chapter");
		if (textChapter) {
			debugLog("Ranobes: Inserting UI before .text-chapter");
			return {
				element: textChapter,
				position: "before",
			};
		}

		// Fallback to default behavior (before article)
		debugLog("Ranobes: Using default UI insertion point");
		return super.getUIInsertionPoint(contentArea);
	}

	/**
	 * Remove ad-related text patterns from content
	 * @param {string} text - The text content to clean
	 * @returns {string} Cleaned text without ad-related content
	 */
	removeAdRelatedText(text) {
		if (!text) return text;

		// Patterns to remove - ad-related code snippets and promotional text
		const adPatterns = [
			// Google Ads related
			/\(adsbygoogle\s*=\s*window\.adsbygoogle\s*\|\|\s*\[\]\)\.push\(\{[^}]*\}\);?/gi,
			/window\.adsbygoogle[^;]*;/gi,
			/googletag\.[^;]*;/gi,
			/<ins\s+class="adsbygoogle"[^>]*>.*?<\/ins>/gi,

			// Common ad placeholder text
			/\[?\s*advertisement\s*\]?/gi,
			/\[?\s*sponsored\s*(content|link|post)?\s*\]?/gi,
			/\[?\s*ad\s*\]?/gi,

			// Script-like content that may leak into text
			/function\s*\([^)]*\)\s*\{[^}]*adsbygoogle[^}]*\}/gi,
			/var\s+\w+\s*=\s*document\.(createElement|getElementById)[^;]*;/gi,

			// Translator notes about ads (but keep meaningful translator notes)
			/translator['']?s?\s*note:?\s*.*?ad[s\-]?.*?(removed|deleted|filtered).*?\.?\n?/gi,
			/\[?\s*TL\s*note:?\s*\]?\s*.*?ad[s]?\s*.*?(removed|omitted).*?\.?\n?/gi,

			// Common ad network snippets
			/data-ad-client\s*=\s*["'][^"']*["']/gi,
			/data-ad-slot\s*=\s*["'][^"']*["']/gi,

			// Inline ad markers
			/---\s*advertisement\s*---/gi,
			/\*\*\*\s*ad\s*\*\*\*/gi,

			// Common promotional phrases often injected
			/click\s+here\s+to\s+(read|view)\s+more\s+ads?/gi,
			/support\s+us\s+by\s+(clicking|viewing)\s+ads?/gi,

			// Code snippets that leak into content
			/\.push\(\s*\{\s*google_ad_client[^}]*\}\s*\)/gi,
			/enable_page_level_ads:\s*(true|false)/gi,
		];

		let cleanedText = text;

		// Apply each pattern
		for (const pattern of adPatterns) {
			cleanedText = cleanedText.replace(pattern, "");
		}

		// Clean up any leftover artifacts
		cleanedText = cleanedText
			.replace(/\n{3,}/g, "\n\n") // Remove excessive line breaks
			.replace(/^\s*[\r\n]/gm, "") // Remove empty lines at start
			.replace(/\s{3,}/g, " ") // Remove excessive spaces
			.trim();

		return cleanedText;
	}

	// Format content after enhancement
	formatAfterEnhancement(contentArea) {
		// Apply site-specific styling for Ranobes
		if (contentArea) {
			// Use the site's own style for paragraphs
			contentArea.querySelectorAll("p").forEach((p) => {
				p.style.marginBottom = "1em";
				p.style.lineHeight = "1.7";
				p.style.color = "#bab9a0";
			});
		}
	}

	// Implement site-specific default prompt for Ranobes
	getDefaultPrompt() {
		return "This is a novel from Ranobes.top. Please maintain the author's style and any formatting features like section breaks, centered text, italics, etc. Respect any special formatting the author uses for dialogue, thoughts, flashbacks, or scene transitions, and in regards with any author notes please place them in a box and filter out any non plot related content in the author notes which may be placed at the beggining or at the end of the chapter. And then add breaks to signify the sepeation between author notes and actual chapter. Please improve the translation while maintaining the original meaning and flow. Keep any special formatting like section breaks. Korean, Japanese and Chinese names should be properly transliterated.";
	}

	// Get a readable site name for the UI
	getSiteIdentifier() {
		return "Ranobes.top";
	}

	// Get site-specific prompt for Ranobes
	getSiteSpecificPrompt() {
		return (
			"This is a novel from Ranobes.top." +
			"Please maintain the author's style and any formatting features like section breaks, centered text, italics, etc." +
			"Respect any special formatting the author uses for dialogue, thoughts, flashbacks, or scene transitions." +
			"In regards with any author notes please place them in a box and filter out any non plot related content in the author notes which may be placed at the beggining or at the end of the chapter" +
			" And then add breaks to signify the sepeation between author notes and actual chapter." +
			"Please improve the translation while maintaining the original meaning and flow." +
			"Keep any special formatting like section breaks. Korean, Japanese and Chinese names should be properly transliterated."
		);
	}

	/**
	 * Extract novel metadata for library storage
	 * Works on both chapter pages and main novel pages
	 * @returns {Object} Object containing comprehensive metadata
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
			translationStatus: null,
			chapterCount: null,
			language: null,
			year: null,
			translator: null,
			publisher: null,
			needsDetailPage: false,
			metadataIncomplete: false,
		};

		try {
			const isChapterPage = this.isChapterPage();

			// Extract novel title (clean, without chapter info)
			if (isChapterPage) {
				metadata.needsDetailPage = true; // Chapter pages do not expose full metadata
				// Primary: Extract from category link (most reliable)
				const categoryLink = document.querySelector(
					".category.grey.ellipses a[rel='up'][href*='/novels/']"
				);
				if (categoryLink) {
					metadata.title = categoryLink.textContent.trim();
					metadata.mainNovelUrl = categoryLink.href;
				}

				// Fallback: try breadcrumbs
				if (!metadata.title) {
					const breadcrumbLinks =
						document.querySelectorAll("#dle-speedbar a");
					if (breadcrumbLinks.length >= 2) {
						// Get the novel link (second breadcrumb)
						const novelLink = breadcrumbLinks[1];
						metadata.title = novelLink.textContent.trim();
						metadata.mainNovelUrl = novelLink.href;
					}
				}

				// Fallback: Extract from page title
				if (!metadata.title) {
					const titleMatch = document.title.match(
						/(.+?)\s*[|\-]\s*Chapter/i
					);
					if (titleMatch) {
						metadata.title = titleMatch[1].trim();
					}
				}

				// Clean up title - remove "# Chapter X" pattern if present
				if (metadata.title) {
					metadata.title = metadata.title
						.replace(/\s*#\s*Chapter\s*\d+\s*$/i, "")
						.trim();
				}

				// Extract description from meta tag on chapter page
				const descMeta = document.querySelector(
					'meta[name="description"]'
				);
				if (descMeta) {
					let desc = descMeta.getAttribute("content")?.trim();
					// Clean up chapter-specific description pattern
					if (desc) {
						// Remove "Novel Title #Chapter X" pattern from start
						desc = desc
							.replace(/^.+?#Chapter\s*\d+\s*/i, "")
							.trim();
						if (desc && desc.length > 20) {
							metadata.description =
								desc.length > 500
									? desc.substring(0, 500) + "..."
									: desc;
						}
					}
				}
			} else {
				// On main novel pages - extract comprehensive metadata

				// Extract title from h1.title
				const titleEl = document.querySelector("h1.title");
				if (titleEl) {
					// Get just the main title, not the subtitle span
					const titleText =
						titleEl.childNodes[0]?.textContent?.trim();
					metadata.title = titleText || titleEl.textContent.trim();
					// Remove subtitle if present
					metadata.title = metadata.title.split("•")[0].trim();
				}

				// Fallback title selectors
				if (!metadata.title) {
					const titleSelectors = [
						"h1.entry-title",
						".post-title h1",
						'meta[property="og:title"]',
					];
					for (const selector of titleSelectors) {
						const el = document.querySelector(selector);
						if (el) {
							metadata.title = selector.includes("meta")
								? el.getAttribute("content")?.trim()
								: el.textContent.trim();
							if (metadata.title) break;
						}
					}
				}

				// Extract full description from .moreless__full
				const fullDesc = document.querySelector(".moreless__full");
				if (fullDesc) {
					// Get text content, clean up
					let desc = fullDesc.textContent
						.replace(/Collapse\s*$/i, "")
						.replace(/Read more\s*$/i, "")
						.trim();
					metadata.description =
						desc.length > 1000
							? desc.substring(0, 1000) + "..."
							: desc;
				} else {
					// Fallback to meta description
					const descMeta = document.querySelector(
						'meta[name="description"], meta[property="og:description"]'
					);
					if (descMeta) {
						metadata.description = descMeta
							.getAttribute("content")
							?.trim();
					}
				}

				// Extract genres from .links[itemprop="genre"]
				const genreContainer =
					document.querySelector('[itemprop="genre"]');
				if (genreContainer) {
					const genreLinks = genreContainer.querySelectorAll("a");
					genreLinks.forEach((a) => {
						const genre = a.textContent.trim();
						if (genre) metadata.genres.push(genre);
					});
				}

				// Extract tags/events from [itemprop="keywords"]
				const keywordsContainer = document.querySelector(
					'[itemprop="keywords"]'
				);
				if (keywordsContainer) {
					const tagLinks = keywordsContainer.querySelectorAll("a");
					tagLinks.forEach((a) => {
						const tag = a.textContent.trim();
						if (tag) metadata.tags.push(tag);
					});
				}

				// Extract status info from .r-fullstory-spec
				const specList = document.querySelector(".r-fullstory-spec");
				if (specList) {
					const listItems = specList.querySelectorAll("li");
					listItems.forEach((li) => {
						const text = li.textContent.toLowerCase();
						if (text.includes("status in coo")) {
							const link = li.querySelector("a");
							metadata.status = link?.textContent?.trim() || null;
						} else if (text.includes("translation")) {
							const link = li.querySelector("a");
							metadata.translationStatus =
								link?.textContent?.trim() || null;
						} else if (
							text.includes("in original") ||
							text.includes("translated")
						) {
							const match =
								li.textContent.match(/(\d+)\s*chapters?/i);
							if (match) {
								metadata.chapterCount = parseInt(match[1], 10);
							}
						} else if (text.includes("year of publishing")) {
							const link = li.querySelector("a");
							metadata.year = link?.textContent?.trim() || null;
						} else if (text.includes("language")) {
							const link = li.querySelector("a");
							metadata.language =
								link?.textContent?.trim() || null;
						}
					});
				}

				// Set main novel URL to current page for novel pages
				metadata.mainNovelUrl = window.location.href;
			}

			// Mark partial metadata when we only saw a chapter page
			if (isChapterPage && !this.isNovelPage()) {
				metadata.metadataIncomplete =
					!metadata.chapterCount ||
					metadata.genres.length === 0 ||
					metadata.tags.length === 0;
			}

			// Extract author - works on both page types
			// Prioritize actual author links over generic tag_list which may contain site name
			const authorSelectors = [
				'.info_line a[href*="/author/"]', // Most specific - author profile links
				".author-name",
				".entry-author a",
				'a[rel="author"]',
				'[itemprop="creator"] a:not([href*="ranobes"])', // Creator but not site name
				'.tag_list[itemprop="creator"] a:not([href*="ranobes"])', // Avoid site name links
				'.tag_list[itemprop="creator"]', // Fallback to tag_list content
				'meta[name="author"]',
			];

			for (const selector of authorSelectors) {
				const el = document.querySelector(selector);
				if (el) {
					metadata.author = selector.includes("meta")
						? el.getAttribute("content")?.trim()
						: el.textContent.trim();
					if (metadata.author) break;
				}
			}

			// Extract translator
			const translatorEl = document.querySelector(
				'[itemprop="translator"] a'
			);
			if (translatorEl) {
				metadata.translator = translatorEl.textContent.trim();
			}

			// Extract publisher
			const publisherEl = document.querySelector(
				'[itemprop="publisher"] a'
			);
			if (publisherEl) {
				metadata.publisher = publisherEl.textContent.trim();
			}

			// Extract cover image
			// First try the poster image
			const posterImg = document.querySelector(
				".r-fullstory-poster .poster img"
			);
			if (posterImg) {
				const src = posterImg.getAttribute("src");
				if (
					src &&
					!src.includes("default") &&
					!src.includes("placeholder")
				) {
					try {
						metadata.coverUrl = new URL(
							src,
							window.location.href
						).href;
					} catch (e) {
						// Invalid URL
					}
				}
			}

			// Try background-image from .cover figure
			if (!metadata.coverUrl) {
				const coverFigure = document.querySelector(
					".poster figure.cover"
				);
				if (coverFigure) {
					const bgStyle = coverFigure.style.backgroundImage;
					const match = bgStyle.match(/url\(['"]?([^'"]+)['"]?\)/);
					if (match && match[1]) {
						try {
							metadata.coverUrl = new URL(
								match[1],
								window.location.href
							).href;
						} catch (e) {
							// Invalid URL
						}
					}
				}
			}

			// Fallback cover selectors
			if (!metadata.coverUrl) {
				const coverSelectors = [
					'meta[property="og:image"]',
					".post-thumbnail img",
					".novel-cover img",
					".entry-thumb img",
					"img.cover",
					"article img:first-of-type",
				];

				for (const selector of coverSelectors) {
					const el = document.querySelector(selector);
					if (el) {
						const src = selector.includes("meta")
							? el.getAttribute("content")
							: el.getAttribute("src");

						if (
							src &&
							!src.includes("default") &&
							!src.includes("placeholder")
						) {
							try {
								metadata.coverUrl = new URL(
									src,
									window.location.href
								).href;
								break;
							} catch (e) {
								// Invalid URL, skip
							}
						}
					}
				}
			}
		} catch (error) {
			debugError("Ranobes: Error extracting metadata:", error);
		}

		debugLog("Ranobes: Extracted metadata:", metadata);
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
			// Extract novel title from breadcrumbs (second link is the novel)
			const breadcrumbLinks =
				document.querySelectorAll("#dle-speedbar a");
			if (breadcrumbLinks.length >= 2) {
				context.title = breadcrumbLinks[1].textContent.trim();
			}

			// Fallback: Extract from page title
			if (!context.title) {
				const titleMatch = document.title.match(
					/(.+?)\s*[|\-]\s*Chapter/i
				);
				if (titleMatch) {
					context.title = titleMatch[1].trim();
				}
			}

			// Try to extract author if available
			const authorEl = document.querySelector(
				'.tag_list[itemprop="creator"], .info_line a[href*="/author/"]'
			);
			if (authorEl) {
				context.author = authorEl.textContent.trim();
			}

			// Extract description from meta tag
			const descriptionMeta = document.querySelector(
				'meta[name="description"]'
			);
			if (descriptionMeta) {
				context.description = descriptionMeta
					.getAttribute("content")
					.trim();
			}
		} catch (error) {
			debugError("Ranobes: Error extracting page metadata:", error);
		}

		return context;
	}
}

// Default export
export default new RanobesHandler();
