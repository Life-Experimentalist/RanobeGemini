/**
 * FanFiction.net Mobile Website Content Handler
 * Specialized handler for mobile version (m.fanfiction.net)
 *
 * This is a SECONDARY handler that shares a shelf with the primary FanfictionHandler.
 * It inherits robust validation logic from the primary handler and only overrides
 * mobile-specific DOM selectors and content finding.
 *
 * Design principles:
 * 1. Inherit all validation logic from FanfictionHandler to ensure consistency
 * 2. Never classify non-chapter pages as novels
 * 3. Validate both URL pattern AND actual DOM content presence
 * 4. Use same robust error handling as desktop version
 */
import { FanfictionHandler } from "./fanfiction-handler.js";
import { debugLog, debugError } from "../logger.js";

export class FanfictionMobileHandler extends FanfictionHandler {
	// Static properties for domain management
	static SUPPORTED_DOMAINS = [
		"m.fanfiction.net", // Mobile-specific domain only
		"m.fanfiction.ws",
	];

	static DEFAULT_ENABLED = false;

	// Ensure mobile handler runs before desktop and validates properly
	static PRIORITY = 10;

	// Shelf metadata - SECONDARY handler, shares shelf with desktop FanFiction.net
	// Only id and novelIdPattern are required for secondary handlers
	static SHELF_METADATA = {
		id: "fanfiction", // Must match primary handler's shelf ID
		isPrimary: false, // Mark as secondary handler
		novelIdPattern: /\/s\/(\d+)\//, // Same pattern as primary
	};

	// Inherit HANDLER_TYPE from parent - chapter_embedded works on mobile too
	// (Mobile has full metadata on chapter pages just like desktop)

	static DEFAULT_SITE_PROMPT = `This content is from FanFiction.net mobile, a fanfiction archive.
Please maintain:
- Proper paragraph breaks and formatting
- Character personalities and relationships from the original work
- Fandom-specific terminology and references
- Scene breaks and dividers (preserve *** / --- / horizontal rules exactly)
- Original narrative flow, pacing, and the author's creative voice

**FanFiction-Specific Formatting Rules:**
- **Author Notes** (A/N:, AN:, T/N:, E/N:, "Author's Note", "Translator's Note"): Wrap in \`<div class="rg-author-note">\` with \`<hr class="section-divider">\` before and after. Keep only plot-relevant context; remove disclaimers, Patreon prompts, update notices, and social-media links.
- **Chapter Epigraphs, Quotes & Lyrics**: Wrap any opening/closing poem, song lyric, or chapter quote in \`<div class="rg-quote-box">\`, preserving all line breaks exactly.
- **Crossover / Game-mechanic Content** (e.g. SAO, LitRPG, RPG-mechanic crossovers): Full multi-line stat windows → \`<div class="game-stats-box">\`; brief level-up/quest pop-ups → \`<div class="rg-system-msg">\`; individual skill/ability cards → \`<div class="rg-skill-box">\`.
- **Flashback Scenes**: When a flashback is clearly marked ("— Flashback —", "X Years Ago", italicised memory inserts), wrap the full block in \`<div class="rg-flashback">\`.

When enhancing, improve readability while fully respecting the author's creative voice and the source material's original intent.`;

	constructor() {
		super();
		// Override enhancement mode for mobile ONLY
		this.enhancementMode = "text-only";
	}

	/**
	 * Check if handler can manage this domain
	 * Only handles m.fanfiction.net - desktop takes care of www and other subdomains
	 * @returns {boolean}
	 */
	canHandle() {
		const hostname = window.location.hostname;
		// ONLY handle m.fanfiction.net
		return hostname === "m.fanfiction.net";
	}

	/**
	 * ROBUST isChapterPage() - inherited validation from parent with mobile content check
	 * Ensures we NEVER classify non-chapter pages as novels
	 *
	 * Validation rules (MUST ALL BE TRUE):
	 * 1. URL must match /^\/s\/\d+/ (story URL pattern)
	 * 2. URL must NOT start with /u/ (user profile pages)
	 * 3. Must find #storycontent element containing actual story text
	 *
	 * @returns {boolean} True only if on an actual chapter page
	 */
	isChapterPage() {
		const url = window.location.pathname;

		// Rule 1: Exclude user profile pages
		if (url.startsWith("/u/")) {
			debugLog(
				"[Mobile] Not a chapter page: matched user profile pattern",
			);
			return false;
		}

		// Rule 2: Check URL is a story URL (/s/12345/...)
		const isStoryUrl = /^\/s\/\d+/.test(url);
		if (!isStoryUrl) {
			debugLog(
				"[Mobile] Not a chapter page: URL does not match story pattern",
			);
			return false;
		}

		// Rule 3: MUST have actual story content element
		// This is the critical check that prevents misclassifying non-chapter pages
		const storyContent = document.getElementById("storycontent");
		if (!storyContent) {
			debugLog(
				"[Mobile] Not a chapter page: storycontent element not found",
			);
			return false;
		}

		// Rule 4: Content element must have actual text (not empty)
		const hasText = storyContent.textContent?.trim().length > 0;
		if (!hasText) {
			debugLog("[Mobile] Not a chapter page: storycontent has no text");
			return false;
		}

		debugLog("[Mobile] Validated as chapter page");
		return true;
	}

	/**
	 * Inherit isNovelPage() from parent
	 * FanFiction.net doesn't have separate novel info pages
	 * All details are embedded on the chapter page
	 * No need to override
	 */

	/**
	 * Find the content area on mobile FanFiction.net
	 * Mobile uses #storycontent instead of desktop's #storytext
	 *
	 * Robust validation:
	 * 1. Check element exists
	 * 2. Validate it contains actual text content
	 * 3. Fall back to parent's method if needed
	 *
	 * @returns {HTMLElement|null} The story content container
	 */
	findContentArea() {
		// Primary target: #storycontent (mobile's main story container)
		const storyContent = document.getElementById("storycontent");
		if (storyContent && storyContent.textContent?.trim().length > 0) {
			debugLog("[Mobile] Found story content in #storycontent");
			return storyContent;
		}

		// Fallback: try class-based selector if ID doesn't work
		const byClass = document.querySelector(".storycontent");
		if (byClass && byClass.textContent?.trim().length > 0) {
			debugLog("[Mobile] Found story content by .storycontent class");
			return byClass;
		}

		// Last resort: use parent's implementation
		// This might find it via base handler's selectors
		const parentResult = super.findContentArea();
		if (parentResult) {
			debugLog("[Mobile] Using parent handler's content area");
		}
		return parentResult;
	}

	/**
	 * Extract title from mobile page
	 * Mobile layout differs from desktop - title is in different location
	 *
	 * @returns {string} Story title or fallback
	 */
	extractTitle() {
		try {
			// Mobile structure: <div align=center><b>Story Title</b> by <a>author</a></div>
			const contentDiv = document.getElementById("content");
			if (contentDiv) {
				const titleEl = contentDiv.querySelector(
					"div[align='center'] b",
				);
				if (titleEl) {
					const title = titleEl.textContent?.trim();
					if (title && title.length > 0) {
						debugLog("[Mobile] Extracted title from content div");
						return title;
					}
				}
			}

			// Fallback: try page title
			if (
				document.title &&
				document.title.trim().length > 0 &&
				document.title !== "FanFiction"
			) {
				debugLog("[Mobile] Using page title as fallback");
				return document.title;
			}

			debugError("[Mobile] Could not extract valid title");
			return null;
		} catch (err) {
			debugError("[Mobile] Error extracting title:", err);
			return null;
		}
	}

	/**
	 * Extract author from mobile page
	 * Author link is in the title area
	 *
	 * @returns {string|null} Author name or null
	 */
	extractAuthor() {
		try {
			const contentDiv = document.getElementById("content");
			if (!contentDiv) return null;

			// Author is in an anchor tag with href starting with /u/
			const authorLink = contentDiv.querySelector("a[href^='/u/']");
			if (authorLink) {
				const author = authorLink.textContent?.trim();
				if (author && author.length > 0) {
					debugLog("[Mobile] Extracted author from link");
					return author;
				}
			}

			return null;
		} catch (err) {
			debugError("[Mobile] Error extracting author:", err);
			return null;
		}
	}

	/**
	 * Extract description from mobile page
	 * Mobile chapter pages don't typically show story description
	 * Description is not visible on the chapter reading view
	 *
	 * @returns {null} Always returns null on mobile (not available)
	 */
	extractDescription() {
		// Mobile doesn't expose description on chapter pages
		// It would need to be fetched from a separate mobile info page (if available)
		// For now, return null - users should visit desktop for full description
		debugLog("[Mobile] Description not available on mobile chapter pages");
		return null;
	}

	/**
	 * Extract metadata for novel library storage - MOBILE SPECIFIC
	 * Mobile DOM structure is different from desktop
	 * Mobile: Simple <div align=center> with title and author
	 * Desktop: Complex <div id=profile_top> with full metadata
	 *
	 * Validation:
	 * 1. Must be on a confirmed chapter page (isChapterPage validation)
	 * 2. Extract what's available from mobile's simpler DOM
	 *
	 * @returns {Object} Novel metadata
	 */
	extractNovelMetadata() {
		// CRITICAL VALIDATION: Must be on a confirmed chapter page
		if (!this.isChapterPage()) {
			debugError(
				"[Mobile] extractNovelMetadata called on non-chapter page",
			);
			return null;
		}

		try {
			// Start with core metadata
			const metadata = {
				title: this.extractTitle(),
				author: this.extractAuthor(),
				description: null, // Mobile typically doesn't show description on chapter page
				coverUrl: null, // Mobile doesn't show cover on chapter page
				mainNovelUrl: this.getNovelPageUrl(),
				genres: [],
				status: "unknown",
				totalChapters: 0,
				metadataIncomplete: true, // Mobile lacks some metadata
				metadata: {
					isCrossover: false,
					fandoms: [],
					characters: [],
					rating: null,
					language: null,
					words: 0,
					reviews: 0,
					favorites: 0,
					follows: 0,
					publishedDate: null,
					updatedDate: null,
					storyId: null,
				},
			};

			// Validation: must have at least title
			if (!metadata.title) {
				debugError("[Mobile] Failed to extract required title");
				return null;
			}

			// Extract story ID from URL
			const storyIdMatch = window.location.href.match(/\/s\/(\d+)/);
			if (storyIdMatch) {
				metadata.metadata.storyId = storyIdMatch[1];
			}

			// Extract chapter count from page info
			// Mobile shows: "Ch 1 of 14" or similar
			try {
				const contentDiv = document.getElementById("content");
				if (contentDiv) {
					// Look for chapter info like "Chapter 1" or "Ch 1 of 14"
					const chapterText = contentDiv.textContent || "";
					const chapterMatch = chapterText.match(
						/Ch(?:apter)?\s+\d+\s+of\s+(\d+)/i,
					);
					if (chapterMatch) {
						metadata.totalChapters = parseInt(chapterMatch[1], 10);
						debugLog(
							`[Mobile] Extracted chapter count: ${metadata.totalChapters}`,
						);
					}
				}
			} catch (err) {
				debugLog("[Mobile] Could not extract chapter count:", err);
			}

			// Extract metadata from text content
			// Mobile metadata line: "Rated: T, English, Romance & Adventure, Harry P., OC, Words: 17k+, Favs: 12, Follows: 4, Published: 8/25/2011"
			try {
				const contentDiv = document.getElementById("content");
				if (contentDiv) {
					const fullText = contentDiv.textContent || "";

					// Extract rating (T, M, etc)
					const ratingMatch =
						fullText.match(/Rated:\s*Fiction\s*([A-Z])/i) ||
						fullText.match(/Rated:\s*([A-Z])/i) ||
						fullText.match(/Fiction\s+([TMK])\s*-/i);
					if (ratingMatch) {
						metadata.metadata.rating = ratingMatch[1];
						metadata.rating = ratingMatch[1];
					}

					// Extract language (English, Spanish, etc)
					const langMatch = fullText.match(
						/(English|Spanish|French|German|Japanese|Chinese|Russian)/i,
					);
					if (langMatch) {
						metadata.metadata.language = langMatch[1];
						metadata.language = langMatch[1];
					}

					// Extract word count
					const wordsMatch =
						fullText.match(/Words?:\s*([\d.]+[kmb]*)/i) ||
						fullText.match(/([\d,]+)\s*words?/i);
					if (wordsMatch) {
						const wordStr = wordsMatch[1].toLowerCase();
						let wordCount = parseInt(
							wordStr.replace(/[,kmb]/g, ""),
							10,
						);
						if (wordStr.includes("k")) wordCount *= 1000;
						if (wordStr.includes("m")) wordCount *= 1000000;
						metadata.metadata.words = wordCount;
						metadata.words = wordCount;
					}

					// Extract genre/categories
					const genreMatch = fullText.match(
						/([A-Za-z]+(?:\s+&\s+[A-Za-z]+)?)\s*-\s*/,
					);
					if (genreMatch) {
						const genres = genreMatch[1].split(/\s*&\s*/);
						metadata.genres = genres.map((g) => g.trim());
					}

					// Extract published date
					const pubMatch = fullText.match(
						/Published:\s*<span[^>]*>([^<]+)</,
					);
					if (pubMatch) {
						metadata.metadata.publishedDate = pubMatch[1].trim();
						metadata.publishedDate = pubMatch[1].trim();
					}

					debugLog("[Mobile] Extracted metadata from text content");
				}
			} catch (err) {
				debugError("[Mobile] Error extracting text metadata:", err);
			}

			// Detect fandom from URL or breadcrumbs if available
			try {
				const contentDiv = document.getElementById("content");
				if (contentDiv) {
					// Look for fandom links like: Books › Harry Potter
					const breadcrumbs = contentDiv.querySelectorAll(
						"a[href*='/book/'], a[href*='/anime/'], a[href*='/tv/']",
					);
					if (breadcrumbs.length > 0) {
						metadata.metadata.fandoms = Array.from(breadcrumbs)
							.slice(1) // Skip the first 'Books' or 'TV' link
							.map((a) => a.textContent.trim())
							.filter((f) => f && f.length > 0);
						debugLog(
							`[Mobile] Extracted fandoms: ${metadata.metadata.fandoms.join(", ")}`,
						);
					}
				}
			} catch (err) {
				debugLog("[Mobile] Could not extract fandoms:", err);
			}

			// Surface frequently-used fields to top level
			metadata.tags = [...metadata.genres, ...metadata.metadata.fandoms];

			// Create stats object for filtering
			metadata.stats = {
				words: metadata.words || 0,
				reviews: metadata.reviews || 0,
				favorites: metadata.favorites || 0,
				follows: metadata.follows || 0,
				publishedDate: metadata.publishedDate || null,
				updatedDate: metadata.updatedDate || null,
			};

			debugLog("[Mobile] Extracted metadata successfully", metadata);
			return metadata;
		} catch (error) {
			debugError("[Mobile] Error in extractNovelMetadata:", error);
			return null;
		}
	}

	/**
	 * Get insertion point for novel controls UI on FanFiction mobile
	 * Insert before story content for mobile UX
	 *
	 * @returns {Object|null} { element, position } or null
	 */
	getNovelPageUIInsertionPoint() {
		const storyContent = document.getElementById("storycontent");
		if (storyContent) {
			return { element: storyContent, position: "before" };
		}

		// Fallback to before content div
		const contentDiv = document.getElementById("content");
		if (contentDiv) {
			const titleArea = contentDiv.querySelector("div[align='center']");
			if (titleArea) {
				return { element: titleArea, position: "after" };
			}
		}

		return null;
	}

	/**
	 * Override UIInsertionPoint to also fire the summary banner injection.
	 * Controls are placed before #storycontent;  the summary banner is placed
	 * between #content (title/metadata) and div[role='main'] (story body).
	 * @param {HTMLElement} contentArea
	 * @returns {{ element: HTMLElement, position: string }}
	 */
	getUIInsertionPoint(contentArea) {
		// Fire-and-forget — non-critical, never blocks rendering
		this._injectSummaryBanner().catch(() => {});

		const storyContent =
			document.getElementById("storycontent") || contentArea;
		return { element: storyContent, position: "before" };
	}

	/**
	 * Fetch and inject a description banner between the #content metadata block
	 * and the story body on mobile FanFiction.net chapter pages.
	 *
	 * Priority:
	 *   1. Description already saved in rg_novel_library (instant)
	 *   2. Fetch the desktop chapter page and parse #profile_top (slow path)
	 *
	 * The banner is inserted once; subsequent calls are no-ops.
	 */
	async _injectSummaryBanner() {
		if (document.getElementById("rg-ff-mobile-summary")) return;
		if (!this.isChapterPage()) return;

		// Insertion point: before div[role="main"] (which wraps #storycontent)
		const storyMainDiv = document.querySelector('div[role="main"]');
		if (!storyMainDiv) return;

		const summaryEl = document.createElement("div");
		summaryEl.id = "rg-ff-mobile-summary";
		summaryEl.style.cssText = [
			"margin: 4px 0.5em 6px",
			"padding: 9px 12px",
			"border-left: 3px solid #5F99C9",
			"background: rgba(95,153,201,0.08)",
			"border-radius: 0 4px 4px 0",
			"font-size: 0.9em",
			"line-height: 1.55",
		].join(";");

		// Insert placeholder before we await anything so layout doesn't jump later
		storyMainDiv.parentNode.insertBefore(summaryEl, storyMainDiv);

		const storyId = window.location.href.match(/\/s\/(\d+)/)?.[1];
		if (!storyId) {
			summaryEl.remove();
			return;
		}

		let description = null;

		// 1. Fast path — library storage
		try {
			const stored = await browser.storage.local.get("rg_novel_library");
			const novels = stored?.rg_novel_library?.novels ?? {};
			description = novels[`fanfiction-${storyId}`]?.description ?? null;
		} catch (_) {
			/* non-critical */
		}

		// 2. Slow path — fetch desktop page
		if (!description) {
			try {
				const resp = await fetch(
					`https://www.fanfiction.net/s/${storyId}/1/`,
					{ cache: "default" },
				);
				if (resp.ok) {
					const doc = new DOMParser().parseFromString(
						await resp.text(),
						"text/html",
					);
					description = this._extractDescriptionFromDesktopDoc(doc);
				}
			} catch (_) {
				/* non-critical */
			}
		}

		if (!description) {
			summaryEl.remove();
			return;
		}

		// Render — use textContent for the body to prevent XSS
		const label = document.createElement("strong");
		label.style.cssText =
			"display:block;margin-bottom:4px;color:#5F99C9;font-size:0.82em;text-transform:uppercase;letter-spacing:0.04em";
		label.textContent = "📖 Summary";

		const body = document.createElement("span");
		body.textContent = description;

		summaryEl.append(label, body);
		debugLog("[Mobile] Injected summary banner");
	}

	/**
	 * Parse the description from a DOMParser-produced desktop-page document.
	 * Mirrors the logic in the parent class's extractDescription() but operates
	 * on an arbitrary Document rather than the live window.document.
	 * @param {Document} doc
	 * @returns {string|null}
	 */
	_extractDescriptionFromDesktopDoc(doc) {
		const profileTop = doc.getElementById("profile_top");
		if (!profileTop) return null;

		for (const div of profileTop.querySelectorAll("div.xcontrast_txt")) {
			const text = div.textContent.trim();
			if (
				text.length > 20 &&
				!text.includes("Rated:") &&
				!text.includes("Words:")
			) {
				return text;
			}
		}

		// Fallback: look for margin-top-styled divs (original extractDescription logic)
		for (const div of profileTop.querySelectorAll("div")) {
			if (
				(div.getAttribute("style") || "").includes("margin-top") &&
				div.classList.contains("xcontrast_txt")
			) {
				const text = div.textContent.trim();
				if (text.length > 20) return text;
			}
		}

		return null;
	}

	/**
	 * Get site-specific enhancement buttons for FanFiction.net mobile
	 * Provides a desktop version switcher for users wanting full view
	 *
	 * @returns {Array<HTMLElement>} Array of button elements
	 */
	getSiteSpecificEnhancements() {
		// Only show on confirmed chapter pages - CRITICAL VALIDATION
		if (!this.isChapterPage()) {
			return [];
		}

		const button = document.createElement("button");
		button.id = "fanfiction-version-switcher";
		button.textContent = "🖥️ Desktop";
		button.title = "Switch to desktop version";

		// Match desktop button styling
		button.style.cssText = `
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 8px 12px;
			margin: 0;
			background-color: #222;
			color: #bab9a0;
			border: 1px solid #ffffff21;
			box-shadow: inset 0 0 0 1px #5a5a5a4d;
			border-radius: 4px;
			cursor: pointer;
			font-weight: bold;
			font-size: 12px;
			z-index: 1000;
		`;

		button.addEventListener("click", () => {
			const currentUrl = window.location.href;
			const newUrl = currentUrl.replace(
				"m.fanfiction.net",
				"www.fanfiction.net",
			);
			window.location.href = newUrl;
		});

		button.addEventListener("mouseover", () => {
			button.style.backgroundColor = "#333";
		});
		button.addEventListener("mouseout", () => {
			button.style.backgroundColor = "#222";
		});

		return [button];
	}

	/**
	 * Apply enhanced content in text-only manner for mobile
	 * Mobile has simpler paragraphs than desktop
	 * Reuse parent's logic but with mobile content area
	 *
	 * @param {HTMLElement} contentArea - The story content root element
	 * @param {string} enhancedText - The enhanced content
	 * @returns {number} Total paragraphs updated/appended
	 */
	applyEnhancedContent(contentArea, enhancedText) {
		if (!contentArea || typeof enhancedText !== "string") {
			debugError("[Mobile] Invalid content area or enhanced text");
			return 0;
		}

		if (!enhancedText || enhancedText.trim().length === 0) {
			debugError("[Mobile] Enhanced text is empty");
			return 0;
		}

		// Use parent's robust implementation
		// It handles both HTML and plain text cases
		const result = super.applyEnhancedContent(contentArea, enhancedText);
		debugLog(`[Mobile] Applied enhancement to ${result} paragraphs`);
		return result;
	}

	/**
	 * Inherit remaining methods from parent:
	 * - generateNovelId() - same story ID pattern
	 * - getNovelPageUrl() - same structure
	 * - getPageTheme() - same theme detection
	 * - getDefaultPrompt() - override below if needed
	 * - getSiteIdentifier() - override below if needed
	 * - supportsTextOnlyEnhancement() - return true (mobile prefers text-only)
	 * - formatAfterEnhancement() - parent's no-op is fine
	 * - getNovelControlsConfig() - customize for mobile if needed
	 */

	/**
	 * Override to return true for mobile
	 * Mobile prefers text-only enhancement to avoid rendering issues
	 * @returns {boolean}
	 */
	supportsTextOnlyEnhancement() {
		return true;
	}

	/**
	 * Mobile-specific default prompt
	 * Inherits parent's philosophy but emphasizes mobile constraints
	 * @returns {string}
	 */
	getDefaultPrompt() {
		return FanfictionMobileHandler.DEFAULT_SITE_PROMPT;
	}

	/**
	 * Mobile-specific site identifier for UI
	 * @returns {string}
	 */
	getSiteIdentifier() {
		return "Fanfiction.net (Mobile)";
	}

	/**
	 * Mobile-specific site prompt
	 * @returns {string}
	 */
	getSiteSpecificPrompt() {
		return FanfictionMobileHandler.DEFAULT_SITE_PROMPT;
	}

	/**
	 * Fetch and process metadata from desktop version
	 * Mobile pages lack full metadata, so we fetch from www.fanfiction.net
	 * @returns {Promise<Object|null>} Processed metadata or null
	 */
	async fetchDesktopMetadata() {
		try {
			const desktopUrl = this.getMetadataSourceUrl();
			if (!desktopUrl) {
				debugLog("[Mobile] No desktop metadata URL available");
				return null;
			}

			const response = await fetch(desktopUrl);
			if (!response.ok) {
				debugError(
					`[Mobile] Failed to fetch desktop metadata: ${response.status}`,
				);
				return null;
			}

			const html = await response.text();
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// Create a temporary container with desktop HTML
			// Then use parent handler's extraction methods
			const originalDoc = document;
			window.document = doc;

			// Extract full metadata using parent handler's methods
			const metadata = new FanfictionHandler().extractNovelMetadata();

			// Restore original document
			window.document = originalDoc;

			if (metadata) {
				debugLog("[Mobile] Successfully fetched desktop metadata");
			}
			return metadata;
		} catch (error) {
			debugError("[Mobile] Error fetching desktop metadata:", error);
			return null;
		}
	}

	/**
	 * Process remotely-fetched metadata (from desktop version)
	 * Enriches mobile metadata with desktop's comprehensive data
	 * @param {Object} metadata - Metadata from desktop version
	 * @returns {Object} Enhanced metadata
	 */
	processRemoteMetadata(metadata) {
		if (!metadata) return this.extractNovelMetadata();

		try {
			// Enrich mobile metadata with desktop data
			const mobileMetadata = this.extractNovelMetadata();

			// Keep mobile's confirmed title/author, but enhance with desktop's additional metadata
			return {
				...metadata,
				title: mobileMetadata?.title || metadata.title,
				author: mobileMetadata?.author || metadata.author,
				mainNovelUrl:
					mobileMetadata?.mainNovelUrl || metadata.mainNovelUrl,
				metadataIncomplete: false, // Now complete with desktop metadata
			};
		} catch (error) {
			debugError("[Mobile] Error processing remote metadata:", error);
			return metadata;
		}
	}

	/**
	 * Inject desktop metadata summary into mobile view
	 * Creates a styled summary section above the chapter content
	 * @param {Object} metadata - Desktop metadata to display
	 */
	injectMetadataSummary(metadata) {
		if (!metadata) return;

		try {
			const contentDiv = document.getElementById("content");
			if (!contentDiv) return;

			// Find the story content area
			const storyContent = contentDiv.querySelector("#storycontent");
			if (!storyContent) return;

			// Create summary section
			const summarySection = document.createElement("div");
			summarySection.id = "rg-mobile-metadata-summary";
			summarySection.style.cssText = `
				background: linear-gradient(135deg, #2a3a4a 0%, #1a2a3a 100%);
				border: 1px solid #3a5a7a;
				border-radius: 6px;
				padding: 15px;
				margin: 15px 0;
				color: #d0d0d0;
				font-size: 0.95em;
				line-height: 1.6;
			`;

			// Build metadata display
			let html =
				'<div style="margin-bottom: 10px; font-weight: bold; color: #88bbff; border-bottom: 1px solid #3a5a7a; padding-bottom: 8px;">📖 Story Details</div>';

			if (metadata.description) {
				html += `<div style="margin: 10px 0;"><strong>Summary:</strong><br/>${metadata.description}</div>`;
			}

			if (
				metadata.metadata?.fandoms &&
				metadata.metadata.fandoms.length > 0
			) {
				html += `<div style="margin: 8px 0;"><strong>Fandoms:</strong> ${metadata.metadata.fandoms.join(", ")}</div>`;
			}

			if (metadata.metadata?.rating) {
				html += `<div style="margin: 8px 0;"><strong>Rating:</strong> ${metadata.metadata.rating}</div>`;
			}

			if (metadata.metadata?.language) {
				html += `<div style="margin: 8px 0;"><strong>Language:</strong> ${metadata.metadata.language}</div>`;
			}

			if (metadata.genres && metadata.genres.length > 0) {
				html += `<div style="margin: 8px 0;"><strong>Genres:</strong> ${metadata.genres.join(", ")}</div>`;
			}

			if (metadata.metadata?.words) {
				html += `<div style="margin: 8px 0;"><strong>Words:</strong> ${metadata.metadata.words.toLocaleString()}</div>`;
			}

			if (metadata.totalChapters) {
				html += `<div style="margin: 8px 0;"><strong>Chapters:</strong> ${metadata.totalChapters}</div>`;
			}

			if (metadata.metadata?.publishedDate) {
				html += `<div style="margin: 8px 0;"><strong>Published:</strong> ${metadata.metadata.publishedDate}</div>`;
			}

			summarySection.innerHTML = html;

			// Insert before story content
			storyContent.parentNode.insertBefore(summarySection, storyContent);
			debugLog("[Mobile] Injected metadata summary into mobile view");
		} catch (error) {
			debugError("[Mobile] Error injecting metadata summary:", error);
		}
	}

	/**
	 * Mobile specifically needs desktop metadata source
	 * Redirect m.fanfiction.net -> www.fanfiction.net for full metadata
	 */
	getMetadataSourceUrl() {
		const match = window.location.href.match(/\/s\/(\d+)/);
		if (match) {
			// Always fetch from desktop version for complete metadata
			return `https://www.fanfiction.net/s/${match[1]}/1/`;
		}
		return super.getMetadataSourceUrl?.();
	}
}

// Default export
export default new FanfictionMobileHandler();
