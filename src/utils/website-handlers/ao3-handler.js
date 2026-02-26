/**
 * Archive of Our Own (AO3) Website Content Handler
 * Specialized handler for extracting content from archiveofourown.org
 *
 * Handler Type: "chapter_embedded" - full novel metadata available on chapter pages
 */
import { BaseWebsiteHandler } from "./base-handler.js";
import { debugLog, debugError } from "../logger.js";

export class AO3Handler extends BaseWebsiteHandler {
	// Static properties for domain management
	// Explicitly supported domains (documented for clarity)
	// Wildcard at end acts as safety net for any unlisted subdomains
	static SUPPORTED_DOMAINS = [
		"archiveofourown.org",
		"www.archiveofourown.org",
		"ao3.org",
		"www.ao3.org",
		"*.archiveofourown.org", // Safety net: catches any other subdomains
		"*.ao3.org", // Safety net: catches any other subdomains
	];

	static DEFAULT_ENABLED = true;

	// Priority for auto-selection (lower number = earlier match)
	static PRIORITY = 30;

	// Shelf metadata for Novel Library - PRIMARY handler
	static SHELF_METADATA = {
		id: "ao3",
		isPrimary: true,
		name: "Archive of Our Own",
		icon: "https://archiveofourown.org/images/ao3_logos/logo_42.png",
		emoji: "📚",
		color: "#990000",
		novelIdPattern: /\/works\/(\d+)/,
		primaryDomain: "archiveofourown.org",
		// Path to custom card renderer (relative to src/library/websites/)
		cardRenderer: "ao3/novel-card.js",
		// Taxonomy for filtering system
		taxonomy: [
			{ id: "fandoms", label: "Fandoms", type: "array" },
			{ id: "relationships", label: "Relationships", type: "array" },
			{ id: "characters", label: "Characters", type: "array" },
			{ id: "additionalTags", label: "Additional Tags", type: "array" },
		],
	};

	// Handler type: Full metadata available on chapter pages (no separate info page needed)
	static HANDLER_TYPE = "chapter_embedded";

	/** Configurable settings exposed in the Library Settings page. */
	static SETTINGS_DEFINITION = {
		fields: [
			{
				key: "autoEnhanceEnabled",
				label: "Auto-enhance chapters",
				type: "toggle",
				defaultValue: false,
				description:
					"Automatically run Enhance when an AO3 chapter loads.",
			},
		],
	};

	static DEFAULT_SITE_PROMPT = `This content is from Archive of Our Own (AO3), a popular fanfiction archive.
Please maintain:
- Proper paragraph breaks and formatting
- Author's notes markers (if present) put them in a box
- Scene breaks and dividers
- Any special formatting like italics or bold for emphasis
- Preserve the narrative flow and pacing
When enhancing, improve readability while respecting the author's original style and voice.`;

	constructor() {
		super();
		this.selectors = {
			content: [
				"div.userstuff.module[role='article']", // Main chapter content
				"#chapters .userstuff.module", // Alternative chapter content
				".userstuff.module",
			],
			title: [
				"h2.title.heading", // Work title
				".preface h2.title",
				"title",
			],
		};

		// Enhancement mode specific to AO3
		this.enhancementMode = "html"; // AO3 has rich formatting we want to preserve
	}

	// Return true if this handler can handle the current website
	canHandle() {
		return (
			window.location.hostname.includes("archiveofourown.org") ||
			window.location.hostname.includes("ao3.org")
		);
	}

	/**
	 * Check if current page is a chapter/work page (reading content)
	 * AO3 chapters have /works/ID/chapters/ID or just /works/ID for single-chapter works
	 * @returns {boolean}
	 */
	isChapterPage() {
		const url = window.location.pathname;
		// Work or chapter pages
		const isWork = /^\/works\/\d+/.test(url);
		// Check for chapter content on page
		const hasContent = !!document.querySelector(
			'div.userstuff.module[role="article"], #chapters .userstuff.module, .userstuff.module',
		);
		return isWork && hasContent;
	}

	/**
	 * Check if current page is a single-chapter work (all content on one page)
	 * These are works without /chapters/ in the URL but with content
	 * @returns {boolean}
	 */
	isSingleChapterWork() {
		const url = window.location.pathname;
		// Works without /chapters/ but with content
		const isSingleWork =
			/^\/works\/\d+\/?$/.test(url) || /^\/works\/\d+\?/.test(url);
		const hasContent = !!document.querySelector(
			'div.userstuff.module[role="article"], .userstuff.module',
		);

		// Check if there's a chapter selector (means multi-chapter)
		const hasChapterSelector = !!document.getElementById("selected_id");

		return isSingleWork && hasContent && !hasChapterSelector;
	}

	/**
	 * Check if current page is specifically a work info page (not reading)
	 * For CHAPTER_EMBEDDED-type handlers like AO3, details are on the chapter page itself
	 * This returns false since we don't have separate novel info pages
	 * @returns {boolean}
	 */
	isNovelPage() {
		// AO3 doesn't have separate novel info pages - info is on chapter pages
		// Return false so we don't show the novel management UI
		return false;
	}

	/**
	 * Generate a unique novel ID from URL
	 * @param {string} url - The work or chapter URL
	 * @returns {string} Unique novel ID
	 */
	generateNovelId(url = window.location.href) {
		// Extract work ID from URL: /works/12345 or /works/12345/chapters/67890
		const match = url.match(/\/works\/(\d+)/);
		if (match) {
			return `ao3-${match[1]}`;
		}

		// Fallback to URL hash
		const urlPath = new URL(url).pathname;
		const urlHash = btoa(urlPath)
			.substring(0, 16)
			.replace(/[^a-zA-Z0-9]/g, "");
		return `ao3-${urlHash}`;
	}

	/**
	 * Get the work details page URL from current page
	 * For AO3, the chapter page itself contains all the details
	 * @returns {string}
	 */
	getNovelPageUrl() {
		// Extract work ID and return the base work URL
		const match = window.location.href.match(/\/works\/(\d+)/);
		if (match) {
			return `https://archiveofourown.org/works/${match[1]}`;
		}
		return window.location.href;
	}

	/**
	 * Get novel controls configuration for AO3
	 * @returns {Object} Configuration for novel controls UI
	 */
	getNovelControlsConfig() {
		return {
			showControls: this.isChapterPage(),
			insertionPoint: this.getNovelPageUIInsertionPoint(),
			position: "after",
			wrapInDefinitionList: true,
			dlLabel: "Ranobe Gemini",
			isChapterPage: true,
			customStyles: {
				background: "linear-gradient(135deg, #1a1a1a 0%, #2d1f1f 100%)",
				borderColor: "#990000",
				accentColor: "#c62828",
			},
		};
	}

	/**
	 * Get insertion point for novel controls UI on AO3
	 * @returns {Object|null} { element, position } or null
	 */
	getNovelPageUIInsertionPoint() {
		// Insert at the end of the work metadata block, after stats
		const workMeta = document.querySelector("dl.work.meta");
		if (workMeta) {
			const statsRow = workMeta.querySelector("dd.stats");
			if (statsRow?.parentElement === workMeta) {
				return { element: statsRow, position: "after" };
			}

			// Fallback: append inside the metadata list
			return { element: workMeta, position: "beforeend" };
		}

		// Fallback to preface section
		const preface = document.querySelector(".preface.group");
		if (preface) {
			return { element: preface, position: "after" };
		}

		// Fallback to before chapter content
		const chapterContent = document.querySelector(
			'.userstuff.module[role="article"]',
		);
		if (chapterContent) {
			return { element: chapterContent, position: "before" };
		}

		return null;
	}

	/**
	 * Get custom chapter page control buttons for AO3
	 * Adds a download button for FichHub integration
	 * Opens in new tab and optionally copies metadata to clipboard
	 * @returns {Array} Array of button specifications
	 */
	getCustomChapterButtons() {
		return [
			{
				text: "Download",
				emoji: "⬇️",
				color: "#ff6b6b",
				onClick: () => {
					// Get library settings to check if clipboard copy is enabled
					try {
						const settingsJson = localStorage.getItem(
							"rg_library_settings",
						);
						const settings = settingsJson
							? JSON.parse(settingsJson)
							: {};
						const enableClipboard =
							settings.enableClipboardCopyOnDownload !== false;

						if (enableClipboard) {
							const clipboardText = this.generateClipboardText();
							if (clipboardText) {
								navigator.clipboard
									.writeText(clipboardText)
									.catch(() => {
										console.log(
											"Could not copy to clipboard",
										);
									});
							}
						}
					} catch (error) {
						console.warn(
							"Error checking clipboard setting:",
							error,
						);
					}

					// FichHub download bookmarklet - open in new tab
					const url = `https://fichub.net/?b=1&q=${encodeURIComponent(window.location.href)}`;
					window.open(url, "_blank");
				},
			},
		];
	}

	/**
	 * Generate clipboard text in format: "Title" by Author WorkId.epub
	 * @returns {string|null} Formatted text or null if unable to generate
	 */
	generateClipboardText() {
		try {
			const title = this.extractTitle();
			const author = this.extractAuthor();
			const workId = window.location.href.match(/works\/(\d+)/)?.[1];

			if (!title || !author || !workId) {
				return null;
			}

			return `"${title}" by ${author} ${workId}.epub`;
		} catch (error) {
			console.error("Error generating clipboard text:", error);
			return null;
		}
	}

	/**
	 * Extract novel/work metadata from current page
	 * AO3 has rich metadata in the work header
	 * @returns {Object} Novel metadata
	 */
	extractNovelMetadata() {
		const metadata = {
			title: null,
			author: null,
			description: null,
			coverUrl: null,
			genres: [],
			tags: [],
			status: null,
			totalChapters: null,
			mainNovelUrl: this.getNovelPageUrl(),
			metadata: {
				rating: null,
				warnings: [],
				categories: [],
				fandoms: [],
				relationships: [],
				characters: [],
				additionalTags: [],
				language: null,
				publishedDate: null,
				completedDate: null,
				words: 0,
				chapters: null,
				totalChapters: null,
				comments: 0,
				kudos: 0,
				bookmarks: 0,
				hits: 0,
				workId: null,
			},
		};

		// Extract work ID from URL
		const workIdMatch = window.location.href.match(/works\/(\d+)/);
		if (workIdMatch) {
			metadata.metadata.workId = workIdMatch[1];
		}

		// Title
		const titleEl = document.querySelector(
			".preface h2.title.heading, .work h2.title",
		);
		if (titleEl) {
			metadata.title = titleEl.textContent.trim();
		}

		// Author(s)
		const authorEls = document.querySelectorAll(
			".preface .byline a[rel='author'], .byline a[rel='author']",
		);
		if (authorEls.length > 0) {
			metadata.author = Array.from(authorEls)
				.map((a) => a.textContent.trim())
				.join(", ");
		}

		// Summary/Description
		const summaryEl = document.querySelector(
			".summary .userstuff blockquote, .summary .userstuff",
		);
		if (summaryEl) {
			metadata.description = summaryEl.textContent
				.trim()
				.substring(0, 500);
		}

		// ==========================================
		// Extract from work meta dl (rating, warnings, etc.)
		// ==========================================
		const workMeta = document.querySelector("dl.work.meta");
		if (workMeta) {
			// Rating
			const ratingEl = workMeta.querySelector("dd.rating a.tag");
			if (ratingEl) {
				metadata.metadata.rating = ratingEl.textContent.trim();
				metadata.tags.push(`Rating: ${metadata.metadata.rating}`);
			}

			// Archive Warnings
			const warningEls = workMeta.querySelectorAll("dd.warning a.tag");
			warningEls.forEach((el) => {
				const warning = el.textContent.trim();
				metadata.metadata.warnings.push(warning);
				metadata.tags.push(`Warning: ${warning}`);
			});

			// Categories (F/M, M/M, Gen, etc.)
			const categoryEls = workMeta.querySelectorAll("dd.category a.tag");
			categoryEls.forEach((el) => {
				const category = el.textContent.trim();
				metadata.metadata.categories.push(category);
				metadata.tags.push(`Category: ${category}`);
			});

			// Fandoms — stored in metadata.fandoms and tags but NOT merged into genres
			const fandomEls = workMeta.querySelectorAll("dd.fandom a.tag");
			fandomEls.forEach((el) => {
				const fandom = el.textContent.trim();
				metadata.metadata.fandoms.push(fandom);
				metadata.tags.push(fandom);
			});

			// Relationships
			const relationshipEls = workMeta.querySelectorAll(
				"dd.relationship a.tag",
			);
			relationshipEls.forEach((el) => {
				const relationship = el.textContent.trim();
				metadata.metadata.relationships.push(relationship);
				metadata.tags.push(relationship);
			});

			// Characters
			const characterEls =
				workMeta.querySelectorAll("dd.character a.tag");
			characterEls.forEach((el) => {
				const character = el.textContent.trim();
				metadata.metadata.characters.push(character);
				metadata.tags.push(character);
			});

			// Additional (Freeform) Tags
			const freeformEls = workMeta.querySelectorAll("dd.freeform a.tag");
			freeformEls.forEach((el) => {
				const tag = el.textContent.trim();
				metadata.metadata.additionalTags.push(tag);
				metadata.tags.push(tag);
			});

			// Language
			const languageEl = workMeta.querySelector("dd.language");
			if (languageEl) {
				metadata.metadata.language = languageEl.textContent.trim();
			}

			// Remove duplicate tags
			metadata.tags = [...new Set(metadata.tags)];
		}

		// ==========================================
		// Extract stats (chapters, words, kudos, etc.)
		// ==========================================
		const statsDl = document.querySelector("dl.stats");
		if (statsDl) {
			// Published date
			const publishedEl = statsDl.querySelector("dd.published");
			if (publishedEl) {
				const dateStr = publishedEl.textContent.trim();
				const date = new Date(dateStr);
				if (!isNaN(date.getTime())) {
					metadata.metadata.publishedDate = date.getTime();
				}
			}

			// Completed/Updated date
			const statusEl = statsDl.querySelector("dd.status");
			if (statusEl) {
				const dateStr = statusEl.textContent.trim();
				const date = new Date(dateStr);
				if (!isNaN(date.getTime())) {
					metadata.metadata.completedDate = date.getTime();
				}
			}

			// Words
			const wordsEl = statsDl.querySelector("dd.words");
			if (wordsEl) {
				// First try the data-ao3e-original attribute (from AO3 Enhancements extension)
				// which has the unmodified number, then fall back to text content
				const originalWords =
					wordsEl.getAttribute("data-ao3e-original");
				const wordsText = (originalWords || wordsEl.textContent)
					.trim()
					.replace(/[,\s\u00A0]/g, ""); // Remove commas, spaces, and non-breaking spaces
				metadata.metadata.words = parseInt(wordsText, 10) || 0;
			}

			// Chapters - format: "5/10" or "5/?" or just a number for single-chapter
			const chaptersEl = statsDl.querySelector("dd.chapters");
			if (chaptersEl) {
				const chaptersText = chaptersEl.textContent.trim();

				// Try to match "X/Y" or "X/?" format first
				// X = published chapters, Y = total planned chapters (or ? if unknown)
				const match = chaptersText.match(/(\d+)\/(\d+|\?)/);
				if (match) {
					const publishedChapters = parseInt(match[1], 10);
					metadata.metadata.chapters = publishedChapters;
					// Note: currentChapter (the chapter being read) will be set separately
					// from getChapterNavigation(), not from this stats value

					if (match[2] !== "?") {
						// Has explicit total chapter count (e.g., "5/10")
						metadata.metadata.totalChapters = parseInt(
							match[2],
							10,
						);
						metadata.totalChapters =
							metadata.metadata.totalChapters;
						// Determine status from chapters
						if (
							metadata.metadata.chapters ===
							metadata.metadata.totalChapters
						) {
							metadata.status = "completed";
						} else {
							metadata.status = "ongoing";
						}
					} else {
						// Format is X/? - work is ongoing, use published as available count
						// Important: For "41/?", 41 is the total available chapters to read
						// so we set totalChapters to publishedChapters (e.g., 41)
						metadata.metadata.totalChapters = publishedChapters;
						metadata.totalChapters = publishedChapters;
						metadata.status = "ongoing";
						debugLog(
							`AO3: Work ongoing with ${publishedChapters} published chapters (totalChapters = ${publishedChapters})`,
						);
					}
				} else {
					// Single number - likely a single-chapter work
					const singleMatch = chaptersText.match(/^(\d+)$/);
					if (singleMatch) {
						const chapterCount = parseInt(singleMatch[1], 10);
						metadata.metadata.chapters = chapterCount;
						metadata.metadata.totalChapters = chapterCount;
						metadata.totalChapters = chapterCount;
						metadata.status =
							chapterCount === 1 ? "completed" : "unknown";
					}
				}
			}

			// If no chapters found but this is clearly a single-chapter work
			if (!metadata.totalChapters && this.isSingleChapterWork?.()) {
				metadata.metadata.chapters = 1;
				metadata.metadata.totalChapters = 1;
				metadata.totalChapters = 1;
				metadata.status = "completed";
			}

			// Comments
			const commentsEl = statsDl.querySelector("dd.comments");
			if (commentsEl) {
				const originalComments =
					commentsEl.getAttribute("data-ao3e-original");
				const commentsText = (
					originalComments || commentsEl.textContent
				)
					.trim()
					.replace(/[,\s\u00A0]/g, "");
				metadata.metadata.comments = parseInt(commentsText, 10) || 0;
			}

			// Kudos
			const kudosEl = statsDl.querySelector("dd.kudos");
			if (kudosEl) {
				const originalKudos =
					kudosEl.getAttribute("data-ao3e-original");
				const kudosText = (originalKudos || kudosEl.textContent)
					.trim()
					.replace(/[,\s\u00A0]/g, "");
				metadata.metadata.kudos = parseInt(kudosText, 10) || 0;
			}

			// Bookmarks
			const bookmarksEl = statsDl.querySelector("dd.bookmarks");
			if (bookmarksEl) {
				const originalBookmarks =
					bookmarksEl.getAttribute("data-ao3e-original");
				const bookmarksText = (
					originalBookmarks || bookmarksEl.textContent
				)
					.trim()
					.replace(/[,\s\u00A0]/g, "");
				metadata.metadata.bookmarks = parseInt(bookmarksText, 10) || 0;
			}

			// Hits
			const hitsEl = statsDl.querySelector("dd.hits");
			if (hitsEl) {
				// First try the data-ao3e-original attribute (from AO3 Enhancements extension)
				const originalHits = hitsEl.getAttribute("data-ao3e-original");
				const hitsText = (originalHits || hitsEl.textContent)
					.trim()
					.replace(/[,\s\u00A0]/g, ""); // Remove commas, spaces, and non-breaking spaces
				metadata.metadata.hits = parseInt(hitsText, 10) || 0;
			}

			// Normalize stats into a single object for UI rendering
			metadata.stats = {
				words: metadata.metadata.words,
				kudos: metadata.metadata.kudos,
				bookmarks: metadata.metadata.bookmarks,
				hits: metadata.metadata.hits,
				comments: metadata.metadata.comments,
			};
		}

		// Sync current chapter info from navigation
		const nav = this.getChapterNavigation?.();
		if (nav) {
			if (nav.currentChapter) {
				metadata.currentChapter = nav.currentChapter;
			}
			if (!metadata.totalChapters && nav.totalChapters) {
				metadata.totalChapters = nav.totalChapters;
				metadata.metadata.totalChapters = nav.totalChapters;
			}
		}

		// Check for explicit status label
		const statusLabelEl = document.querySelector("dt.status");
		if (statusLabelEl) {
			const labelText = statusLabelEl.textContent.trim().toLowerCase();
			if (labelText.includes("completed")) {
				metadata.status = "completed";
			} else if (labelText.includes("updated")) {
				metadata.status = "ongoing";
			}
		}

		// Try to get cover from any embedded image (fanworks sometimes have them)
		// AO3 doesn't have official cover images, but some works embed them
		const coverEl = document.querySelector(".userstuff img:first-of-type");
		if (coverEl && coverEl.src && !coverEl.src.includes("icon")) {
			metadata.coverUrl = coverEl.src;
		}

		debugLog("AO3: Extracted metadata:", metadata);
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
			// Author
			const authorLink = document.querySelector(
				'.byline a[rel="author"]',
			);
			if (authorLink) {
				context.author = authorLink.textContent.trim();
			}

			// Title
			const titleEl = document.querySelector(".title.heading");
			if (titleEl) {
				context.title = titleEl.textContent.trim();
			}

			// Tags/Genres
			const tagLinks = document.querySelectorAll(
				".fandom.tags a.tag, .freeform.tags a.tag",
			);
			context.tags = Array.from(tagLinks).map((a) =>
				a.textContent.trim(),
			);

			// Status
			const statusEl = document.querySelector("dd.status");
			if (statusEl) {
				context.status = statusEl.textContent.trim().toLowerCase();
			}
		} catch (error) {
			debugError("AO3: Error extracting page metadata:", error);
		}

		return context;
	}

	// Find the content area on AO3
	findContentArea() {
		debugLog("AO3: Looking for content area...");

		// AO3's main chapter content is in div.userstuff.module with role="article"
		const mainContent = document.querySelector(
			'div.userstuff.module[role="article"]',
		);
		if (mainContent) {
			debugLog("AO3: Found main chapter content with role=article");
			return mainContent;
		}

		// Alternative: look for userstuff module inside chapters div
		const chaptersContent = document.querySelector(
			"#chapters .userstuff.module",
		);
		if (chaptersContent) {
			debugLog("AO3: Found chapter content in #chapters");
			return chaptersContent;
		}

		// Try any userstuff module that's not in notes or summary
		const userStuffModules = document.querySelectorAll(".userstuff.module");
		for (const module of userStuffModules) {
			// Skip if it's inside notes or summary sections
			if (
				module.closest("#notes") ||
				module.closest(".summary") ||
				module.closest(".preface")
			) {
				continue;
			}
			debugLog("AO3: Found general userstuff module");
			return module;
		}

		// Fallback to base implementation
		debugLog("AO3: Falling back to base handler");
		return super.findContentArea();
	}

	// Extract the title of the work/chapter
	extractTitle() {
		// Try to get the work title from the preface
		const workTitle = document.querySelector(".preface h2.title.heading");
		if (workTitle) {
			const titleText = workTitle.textContent.trim();

			// Check if there's a chapter title
			const chapterTitle = document.querySelector(
				".chapter.preface h3.title",
			);
			if (chapterTitle) {
				const chapterText = chapterTitle.textContent.trim();
				return `${titleText} - ${chapterText}`;
			}

			return titleText;
		}

		// Fallback to page title
		const pageTitle = document.title;
		// AO3 titles are format: "Title - Chapter X - Author - Fandom [Archive of Our Own]"
		// Remove the AO3 suffix
		return pageTitle.replace(/\s*\[Archive of Our Own\]$/, "").trim();
	}

	// Get chapter navigation info
	getChapterNavigation() {
		try {
			// Check for chapter navigation
			const chapterSelect = document.getElementById("selected_id");
			if (chapterSelect) {
				const options = chapterSelect.querySelectorAll("option");
				const selectedIndex = chapterSelect.selectedIndex;

				return {
					hasPrevious: selectedIndex > 0,
					hasNext: selectedIndex < options.length - 1,
					currentChapter: selectedIndex + 1,
					totalChapters: options.length,
				};
			}

			// Check for previous/next chapter links
			const prevLink = document.querySelector('a[rel="prev"]');
			const nextLink = document.querySelector('a[rel="next"]');

			return {
				hasPrevious: !!prevLink,
				hasNext: !!nextLink,
				currentChapter: null,
				totalChapters: null,
			};
		} catch (error) {
			debugError("Error getting AO3 chapter navigation:", error);
			return {
				hasPrevious: false,
				hasNext: false,
				currentChapter: null,
				totalChapters: null,
			};
		}
	}

	// Get work metadata specific to AO3
	getWorkMetadata() {
		const metadata = {};

		try {
			// Get author
			const author = document.querySelector(".byline a[rel='author']");
			if (author) {
				metadata.author = author.textContent.trim();
			}

			// Get fandom
			const fandom = document.querySelector(".fandom.tags a.tag");
			if (fandom) {
				metadata.fandom = fandom.textContent.trim();
			}

			// Get rating
			const rating = document.querySelector(".rating.tags a.tag");
			if (rating) {
				metadata.rating = rating.textContent.trim();
			}

			// Get warnings
			const warnings = Array.from(
				document.querySelectorAll(".warning.tags a.tag"),
			).map((tag) => tag.textContent.trim());
			if (warnings.length > 0) {
				metadata.warnings = warnings;
			}

			// Get relationships
			const relationships = Array.from(
				document.querySelectorAll(".relationship.tags a.tag"),
			).map((tag) => tag.textContent.trim());
			if (relationships.length > 0) {
				metadata.relationships = relationships;
			}

			// Get characters
			const characters = Array.from(
				document.querySelectorAll(".character.tags a.tag"),
			).map((tag) => tag.textContent.trim());
			if (characters.length > 0) {
				metadata.characters = characters;
			}

			// Get summary
			const summary = document.querySelector(".summary .userstuff");
			if (summary) {
				metadata.summary = summary.textContent.trim();
			}

			// Get word count
			const stats = document.querySelector(".stats");
			if (stats) {
				const wordCountElement = stats.querySelector("dd.words");
				if (wordCountElement) {
					metadata.wordCount = wordCountElement.textContent.trim();
				}

				const chaptersElement = stats.querySelector("dd.chapters");
				if (chaptersElement) {
					metadata.chapters = chaptersElement.textContent.trim();
				}
			}

			// Get notes (author's notes at beginning)
			const beginNotes = document.querySelector("#notes .userstuff");
			if (beginNotes) {
				metadata.beginNotes = beginNotes.textContent.trim();
			}

			// Get end notes
			const endNotes = document.querySelector("#endnotes .userstuff");
			if (endNotes) {
				metadata.endNotes = endNotes.textContent.trim();
			}
		} catch (error) {
			debugError("Error extracting AO3 metadata:", error);
		}

		return metadata;
	}

	// Get the best insertion point for UI elements
	getUIInsertionPoint() {
		debugLog("AO3: Finding UI insertion point...");

		// Best place is before the chapter content, after chapter preface
		const chapterPreface = document.querySelector(".chapter.preface");
		if (chapterPreface) {
			debugLog("AO3: Inserting after chapter preface");
			return {
				element: chapterPreface,
				position: "afterend",
			};
		}

		// Alternative: before the work content
		const workContent = document.querySelector("#workskin");
		if (workContent) {
			debugLog("AO3: Inserting at start of workskin");
			return {
				element: workContent,
				position: "afterbegin",
			};
		}

		// Fallback to before content area
		const contentArea = this.findContentArea();
		if (contentArea) {
			debugLog("AO3: Inserting before content area");
			return {
				element: contentArea,
				position: "beforebegin",
			};
		}

		// Final fallback
		debugLog("AO3: Using base UI insertion point");
		return super.getUIInsertionPoint();
	}

	// Extract content with proper formatting
	extractContent() {
		debugLog("AO3: Extracting content...");

		const contentArea = this.findContentArea();
		if (!contentArea) {
			debugError("AO3: Could not find content area");
			return {
				found: false,
				title: document.title,
				text: "",
				selector: "ao3-no-content",
				reason: "Could not locate chapter content on this AO3 page.",
			};
		}

		// Get the title
		const title = this.extractTitle();
		debugLog("AO3: Extracted title:", title);

		// Clone the content to avoid modifying the original
		const contentClone = contentArea.cloneNode(true);

		// Remove any script tags
		const scripts = contentClone.querySelectorAll("script");
		scripts.forEach((script) => script.remove());

		// Get HTML content with preserved structure
		let htmlContent = contentClone.innerHTML.trim();

		// Convert markdown-style formatting to HTML
		// Authors sometimes use **text** for bold and *text* for italics
		htmlContent = this.convertMarkdownFormatting(htmlContent);

		// Also get plain text for token counting and processing
		let textContent =
			contentClone.textContent || contentClone.innerText || "";
		textContent = textContent.trim();

		// Get metadata
		const metadata = this.getWorkMetadata();
		const navigation = this.getChapterNavigation();

		debugLog("AO3: Content extracted successfully");
		debugLog("AO3: HTML content length:", htmlContent.length, "characters");
		debugLog("AO3: Text content length:", textContent.length, "characters");

		return {
			found: true,
			title: title,
			text: textContent, // Plain text for processing
			content: htmlContent, // HTML for preservation
			contentArea: contentArea,
			metadata: metadata,
			navigation: navigation,
			wordCount: textContent
				.trim()
				.split(/\s+/)
				.filter((word) => word.length > 0).length,
		};
	}

	// Count words in HTML content
	countWords(content) {
		// Remove HTML tags and count words
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = content;
		const text = tempDiv.textContent || tempDiv.innerText || "";
		const words = text
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0);
		return words.length;
	}

	/**
	 * Convert markdown-style formatting to HTML
	 * Handles **bold**, *italic*, and ***bold italic*** patterns
	 * @param {string} content - HTML content that may contain markdown-style text
	 * @returns {string} - Content with markdown converted to proper HTML tags
	 */
	convertMarkdownFormatting(content) {
		if (!content) return content;

		// Process in a way that doesn't break existing HTML tags
		// We need to be careful not to match asterisks inside HTML attributes

		// First, temporarily protect HTML tags
		const htmlTagPlaceholders = [];
		let protectedContent = content.replace(/<[^>]+>/g, (match) => {
			htmlTagPlaceholders.push(match);
			return `__HTML_TAG_${htmlTagPlaceholders.length - 1}__`;
		});

		// Convert ***text*** to <strong><em>text</em></strong> (bold italic)
		protectedContent = protectedContent.replace(
			/\*\*\*([^*]+)\*\*\*/g,
			"<strong><em>$1</em></strong>",
		);

		// Convert **text** to <strong>text</strong> (bold)
		protectedContent = protectedContent.replace(
			/\*\*([^*]+)\*\*/g,
			"<strong>$1</strong>",
		);

		// Convert *text* to <em>text</em> (italic)
		// Be more careful here - only match if not preceded/followed by space after/before asterisk
		protectedContent = protectedContent.replace(
			/\*([^\s*][^*]*[^\s*])\*/g,
			"<em>$1</em>",
		);
		// Also handle single word italics like *word*
		protectedContent = protectedContent.replace(
			/\*([^\s*]+)\*/g,
			"<em>$1</em>",
		);

		// Restore HTML tags
		protectedContent = protectedContent.replace(
			/__HTML_TAG_(\d+)__/g,
			(_, index) => htmlTagPlaceholders[parseInt(index)],
		);

		return protectedContent;
	}

	// Get site-specific prompt enhancement
	getSiteSpecificPrompt() {
		return AO3Handler.DEFAULT_SITE_PROMPT;
	}

	/**
	 * Get handler-proposed library settings
	 * @returns {Object} Settings schema
	 */
	getProposedLibrarySettings() {
		return {
			enableClipboardCopyOnDownload: {
				label: "Copy to Clipboard on Download",
				type: "boolean",
				default: true,
				description:
					'Automatically copy "Title" by Author WorkId.epub to clipboard when downloading',
			},
		};
	}

	/**
	 * AO3-specific metadata fields for the library edit modal.
	 * @returns {Array<Object>}
	 */
	static getEditableFields() {
		return [
			{
				key: "fandoms",
				label: "Fandoms",
				type: "tags",
				source: "metadata",
				placeholder: "Harry Potter, Marvel",
			},
			{
				key: "relationships",
				label: "Relationships",
				type: "tags",
				source: "metadata",
				placeholder: "Harry/Ginny",
			},
			{
				key: "characters",
				label: "Characters",
				type: "tags",
				source: "metadata",
				placeholder: "Harry Potter",
			},
			{
				key: "additionalTags",
				label: "Additional Tags",
				type: "tags",
				source: "metadata",
				placeholder: "Fluff, Angst",
			},
			{
				key: "language",
				label: "Language",
				type: "text",
				source: "metadata",
				placeholder: "e.g. English",
			},
			{
				key: "rating",
				label: "Rating",
				type: "select",
				source: "metadata",
				options: [
					{ value: "", label: "Unknown" },
					{ value: "General Audiences", label: "General Audiences" },
					{ value: "Teen And Up Audiences", label: "Teen And Up" },
					{ value: "Mature", label: "Mature" },
					{ value: "Explicit", label: "Explicit" },
					{ value: "Not Rated", label: "Not Rated" },
				],
			},
			{
				key: "words",
				label: "Word Count",
				type: "number",
				source: "metadata",
				min: 0,
			},
			{
				key: "kudos",
				label: "Kudos",
				type: "number",
				source: "metadata",
				min: 0,
			},
			{
				key: "comments",
				label: "Comments",
				type: "number",
				source: "metadata",
				min: 0,
			},
			{
				key: "bookmarks",
				label: "Bookmarks",
				type: "number",
				source: "metadata",
				min: 0,
			},
			{
				key: "publishedDate",
				label: "Published Date",
				type: "date",
				source: "metadata",
			},
			{
				key: "updatedDate",
				label: "Last Updated",
				type: "date",
				source: "metadata",
			},
		];
	}
}

// Default export - create an instance
export default new AO3Handler();
