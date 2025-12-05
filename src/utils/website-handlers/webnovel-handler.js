/**
 * WebNovel.com Website Content Handler
 * Specialized handler for extracting content from webnovel.com
 * Handles infinite scroll chapters with dynamic URL changes
 *
 * IMPORTANT: This site uses infinite scroll where multiple chapters are loaded
 * on the same page. Each chapter gets its own enhance/summarize buttons.
 *
 * Handler Type: "dedicated_page" - novel metadata only on separate /book/ pages
 */
import { BaseWebsiteHandler } from "./base-handler.js";
import { debugLog, debugError } from "../logger.js";

export class WebNovelHandler extends BaseWebsiteHandler {
	// Static properties for domain management
	// Explicitly supported domains (documented for clarity)
	// Wildcard at end acts as safety net for any unlisted subdomains
	static SUPPORTED_DOMAINS = [
		"webnovel.com",
		"www.webnovel.com",
		"m.webnovel.com",
		"*.webnovel.com", // Safety net: catches any other subdomains
	];

	static PRIORITY = 50;

	// Shelf metadata for Novel Library - PRIMARY handler
	static SHELF_METADATA = {
		id: "webnovel",
		isPrimary: true,
		name: "WebNovel",
		icon: "https://www.yueimg.com/en/favicon/favicon.d3f6a.ico",
		emoji: "🌎",
		color: "#ff6600",
		novelIdPattern: /\/book\/(\d+)/,
		primaryDomain: "www.webnovel.com",
	};

	// Handler type: Metadata requires visiting dedicated novel info page
	static HANDLER_TYPE = "dedicated_page";

	static DEFAULT_SITE_PROMPT = `This content is from WebNovel.com, a web novel platform.
Please maintain:
- Proper paragraph breaks and formatting
- Dialogue quotation marks and formatting
- Scene breaks and dividers
- Any special formatting for emphasis
- Preserve the narrative flow and pacing
When enhancing, improve readability and grammar while respecting the author's original style.`;

	constructor() {
		super();
		this.selectors = {
			content: [
				".cha-content .cha-words", // Main chapter content
				".cha-words", // Alternative
			],
			title: [
				".cha-tit h1", // Chapter title
				".cha-tit h3",
				"h1.cha-tit",
			],
		};

		// Enhancement mode - WebNovel has paragraphs we want to preserve
		this.enhancementMode = "html";

		// Track processed chapters to avoid duplicate buttons
		this.processedChapters = new Set();

		// Track current chapter for URL monitoring
		this.lastUrl = window.location.href;

		// Start monitoring for new chapters (infinite scroll)
		this.startChapterMonitoring();
	}

	// Return true if this handler can handle the current website
	canHandle() {
		return (
			window.location.hostname.includes("webnovel.com") ||
			window.location.hostname.includes("webnovel.co")
		);
	}

	/**
	 * Check if current page is a chapter page (reading content)
	 * @returns {boolean}
	 */
	isChapterPage() {
		// Chapter URLs contain /chapter/ or have .cha-content elements
		const url = window.location.pathname;
		if (url.includes("/chapter/")) {
			return true;
		}
		// Also check for chapter content elements
		const chapterContent = document.querySelector(".cha-content");
		return !!chapterContent;
	}

	/**
	 * Check if current page is a novel info/details page
	 * @returns {boolean}
	 */
	isNovelPage() {
		const url = window.location.pathname;
		// Novel pages have /book/NUMBER format without /chapter/
		const isBookPage =
			/^\/book\/\d+/.test(url) && !url.includes("/chapter/");

		// Also check for novel info elements
		const novelInfo = document.querySelector(
			".g_thumb, .det-info, .book-info"
		);

		return isBookPage || (!!novelInfo && !this.isChapterPage());
	}

	/**
	 * Generate a unique novel ID from URL
	 * @param {string} url - The novel or chapter URL
	 * @returns {string} Unique novel ID
	 */
	generateNovelId(url = window.location.href) {
		// Extract book ID from URL: /book/12345
		const match = url.match(/\/book\/(\d+)/);
		if (match) {
			return `webnovel-${match[1]}`;
		}

		// Fallback to URL hash
		const urlPath = new URL(url).pathname;
		const urlHash = btoa(urlPath)
			.substring(0, 16)
			.replace(/[^a-zA-Z0-9]/g, "");
		return `webnovel-${urlHash}`;
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

		// Extract book ID from chapter URL
		const match = window.location.href.match(/\/book\/(\d+)/);
		if (match) {
			return `https://www.webnovel.com/book/${match[1]}`;
		}

		// Try to find link to novel page on chapter page
		const novelLink = document.querySelector(
			'a[href*="/book/"][href$=".html"], .det-title a, .book-title a'
		);
		if (novelLink) {
			return novelLink.href;
		}

		return null;
	}

	/**
	 * Get novel controls configuration for WebNovel
	 * @returns {Object} Configuration for novel controls UI
	 */
	getNovelControlsConfig() {
		const isNovel = this.isNovelPage();
		const isChapter = this.isChapterPage();

		return {
			showControls: isNovel || isChapter,
			insertionPoint: this.getNovelPageUIInsertionPoint(),
			position: isNovel ? "after" : "before",
			isChapterPage: isChapter,
			customStyles: {
				background: "linear-gradient(135deg, #1a1a2e 0%, #1c1c2e 100%)",
				borderColor: "#ff6600",
				accentColor: "#ff8c33",
			},
		};
	}

	/**
	 * Get insertion point for novel controls UI on WebNovel
	 * @returns {Object|null} { element, position } or null
	 */
	getNovelPageUIInsertionPoint() {
		// For novel info pages
		if (this.isNovelPage()) {
			const detInfo = document.querySelector(".det-info, .g_thumb");
			if (detInfo) {
				return { element: detInfo, position: "after" };
			}
		}

		// For chapter pages
		const chapterHeader = document.querySelector(".cha-tit");
		if (chapterHeader) {
			return { element: chapterHeader, position: "after" };
		}

		const chapterContent = document.querySelector(".cha-content");
		if (chapterContent) {
			return { element: chapterContent, position: "before" };
		}

		return null;
	}

	/**
	 * Extract novel metadata from current page
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
			chapterCount: null,
			mainNovelUrl: this.getNovelPageUrl(),
		};

		// Title
		const titleEl = document.querySelector(
			".det-title h2, .book-title, .g_thumb h1, .cha-tit h1 a"
		);
		if (titleEl) {
			metadata.title = titleEl.textContent.trim();
		}

		// Author
		const authorEl = document.querySelector(
			".det-hd-detail a, .author-name, .g_thumb .g_author a"
		);
		if (authorEl) {
			metadata.author = authorEl.textContent.trim();
		}

		// Cover image
		const coverEl = document.querySelector(
			".g_thumb img, .det-pic img, .book-cover img"
		);
		if (coverEl) {
			metadata.coverUrl = coverEl.src || coverEl.getAttribute("data-src");
		}

		// Description
		const descEl = document.querySelector(
			".det-abt, .book-intro, .g_thumb_intro"
		);
		if (descEl) {
			metadata.description = descEl.textContent.trim().substring(0, 500);
		}

		// Genres/Tags
		const tagEls = document.querySelectorAll(
			".det-hd-detail .g_grey, .tag-item, .genre-item"
		);
		tagEls.forEach((el) => {
			const text = el.textContent.trim();
			if (text) {
				metadata.tags.push(text);
			}
		});

		// Chapter count
		const chapterCountEl = document.querySelector(
			".det-hd-detail .g_grey:last-child, .chapter-count"
		);
		if (chapterCountEl) {
			const match = chapterCountEl.textContent.match(/(\d+)/);
			if (match) {
				metadata.chapterCount = parseInt(match[1], 10);
			}
		}

		// Status (Ongoing/Completed)
		const statusEl = document.querySelector(
			".det-hd-detail .g_status, .book-status"
		);
		if (statusEl) {
			metadata.status = statusEl.textContent.trim().toLowerCase();
		}

		return metadata;
	}

	/**
	 * Get insertion point for novel page UI
	 */
	getNovelPageUIInsertionPoint() {
		const selectors = [".det-info", ".g_thumb", ".book-info", ".det-hd"];

		for (const selector of selectors) {
			const el = document.querySelector(selector);
			if (el) {
				return { element: el, position: "after" };
			}
		}

		return null;
	}

	/**
	 * Start monitoring for new chapters being loaded (infinite scroll)
	 * This finds ALL chapter containers on the page and injects buttons for each
	 */
	startChapterMonitoring() {
		// Initial check after a delay to ensure DOM is ready
		setTimeout(() => {
			this.injectButtonsForAllChapters();
		}, 1000);

		// Monitor for new chapters being added (infinite scroll)
		const observer = new MutationObserver(() => {
			this.injectButtonsForAllChapters();
		});

		// Observe the main content area for new chapters
		const contentArea =
			document.querySelector(".g_ad_scroll_area") || document.body;
		observer.observe(contentArea, {
			childList: true,
			subtree: true,
		});

		// Also monitor URL changes to detect manual navigation
		setInterval(() => {
			const currentUrl = window.location.href;
			if (currentUrl !== this.lastUrl) {
				debugLog("WebNovel: URL changed via navigation");
				this.lastUrl = currentUrl;
				// Clear processed chapters on URL change
				this.processedChapters.clear();
				this.injectButtonsForAllChapters();
			}
		}, 1000);
	}

	/**
	 * Inject enhance/summarize buttons for all chapters currently on the page
	 */
	injectButtonsForAllChapters() {
		const allChapters = document.querySelectorAll(".cha-content");

		allChapters.forEach((chapterContainer) => {
			const chapterId = chapterContainer.getAttribute("data-cid");
			if (!chapterId) return;

			// Skip if already processed
			if (this.processedChapters.has(chapterId)) return;

			debugLog(`WebNovel: Injecting buttons for chapter ${chapterId}`);
			this.injectButtonsForChapter(chapterContainer, chapterId);
			this.processedChapters.add(chapterId);
		});
	}

	/**
	 * Inject enhance/summarize buttons for a specific chapter
	 */
	injectButtonsForChapter(chapterContainer, chapterId) {
		// Find the title area to insert buttons after
		const titleArea = chapterContainer.querySelector(".cha-tit");
		if (!titleArea) return;

		// Check if buttons already exist
		const existingButtons = chapterContainer.querySelector(
			".webnovel-gemini-controls"
		);
		if (existingButtons) return;

		// Create button container
		const buttonContainer = document.createElement("div");
		buttonContainer.className = "webnovel-gemini-controls";
		buttonContainer.setAttribute("data-chapter-id", chapterId);
		buttonContainer.style.cssText = `
			display: flex;
			gap: 10px;
			margin: 15px 0;
			padding: 10px;
			background: #f8f9fa;
			border-radius: 8px;
			user-select: none;
			-webkit-user-select: none;
		`;

		// Create enhance button
		const enhanceBtn = document.createElement("button");
		enhanceBtn.className = "gemini-enhance-btn";
		enhanceBtn.textContent = "✨ Enhance Chapter";
		enhanceBtn.setAttribute("data-chapter-id", chapterId);
		enhanceBtn.style.cssText = `
			flex: 1;
			padding: 10px 15px;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			border: none;
			border-radius: 6px;
			font-weight: 600;
			cursor: pointer;
			transition: transform 0.2s;
			user-select: none;
			-webkit-user-select: none;
		`;
		enhanceBtn.addEventListener("mouseenter", () => {
			enhanceBtn.style.transform = "translateY(-2px)";
		});
		enhanceBtn.addEventListener("mouseleave", () => {
			enhanceBtn.style.transform = "translateY(0)";
		});
		enhanceBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.handleEnhanceClick(chapterId);
		});

		// Create summarize button
		const summarizeBtn = document.createElement("button");
		summarizeBtn.className = "gemini-summarize-btn";
		summarizeBtn.textContent = "📝 Summarize Chapter";
		summarizeBtn.setAttribute("data-chapter-id", chapterId);
		summarizeBtn.style.cssText = `
			flex: 1;
			padding: 10px 15px;
			background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
			color: white;
			border: none;
			border-radius: 6px;
			font-weight: 600;
			cursor: pointer;
			transition: transform 0.2s;
			user-select: none;
			-webkit-user-select: none;
		`;
		summarizeBtn.addEventListener("mouseenter", () => {
			summarizeBtn.style.transform = "translateY(-2px)";
		});
		summarizeBtn.addEventListener("mouseleave", () => {
			summarizeBtn.style.transform = "translateY(0)";
		});
		summarizeBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.handleSummarizeClick(chapterId);
		});

		buttonContainer.appendChild(enhanceBtn);
		buttonContainer.appendChild(summarizeBtn);

		// Insert after title
		titleArea.parentNode.insertBefore(
			buttonContainer,
			titleArea.nextSibling
		);
	}

	/**
	 * Handle enhance button click for a specific chapter
	 */
	handleEnhanceClick(chapterId) {
		debugLog(`WebNovel: Enhance clicked for chapter ${chapterId}`);

		// Extract content for this specific chapter
		const chapterData = this.extractChapterContent(chapterId);
		if (!chapterData.found) {
			debugError("Failed to extract chapter content");
			alert("Failed to extract chapter content. Please try again.");
			return;
		}

		// Dispatch event to main content script with chapter data
		window.dispatchEvent(
			new CustomEvent("webnovel-enhance-chapter", {
				detail: {
					chapterId: chapterId,
					...chapterData,
				},
			})
		);
	}

	/**
	 * Handle summarize button click for a specific chapter
	 */
	handleSummarizeClick(chapterId) {
		debugLog(`WebNovel: Summarize clicked for chapter ${chapterId}`);

		// Extract content for this specific chapter
		const chapterData = this.extractChapterContent(chapterId);
		if (!chapterData.found) {
			debugError("Failed to extract chapter content");
			alert("Failed to extract chapter content. Please try again.");
			return;
		}

		// Dispatch event to main content script with chapter data
		window.dispatchEvent(
			new CustomEvent("webnovel-summarize-chapter", {
				detail: {
					chapterId: chapterId,
					...chapterData,
				},
			})
		);
	}

	/**
	 * Find the content area for a SPECIFIC chapter ID
	 * This is used when buttons are clicked to ensure we get the right chapter
	 */
	findContentArea(chapterId = null) {
		debugLog("WebNovel: Looking for content area...");

		// If chapterId provided, find that specific chapter
		if (chapterId) {
			const specificChapter = document.querySelector(
				`.cha-content[data-cid="${chapterId}"] .cha-words`
			);
			if (specificChapter) {
				debugLog(`WebNovel: Found chapter ${chapterId} content`);
				return specificChapter;
			}
		}

		// Fallback: find the first visible chapter in viewport
		const allChapterContainers = document.querySelectorAll(".cha-content");
		for (const container of allChapterContainers) {
			const rect = container.getBoundingClientRect();
			// Check if chapter title is visible in viewport
			if (rect.top >= -100 && rect.top <= window.innerHeight / 2) {
				const words = container.querySelector(".cha-words");
				if (words) {
					const cid = container.getAttribute("data-cid");
					debugLog(`WebNovel: Found visible chapter ${cid} content`);
					return words;
				}
			}
		}

		// Last fallback: just get first chapter
		const firstChapter = document.querySelector(".cha-words");
		if (firstChapter) {
			debugLog("WebNovel: Found first chapter content");
			return firstChapter;
		}

		debugLog("WebNovel: Falling back to base handler");
		return super.findContentArea();
	}

	// Extract the title of the chapter
	extractTitle(chapterId = null) {
		// If chapterId provided, get title from that specific chapter
		if (chapterId) {
			const chapterContainer = document.querySelector(
				`.cha-content[data-cid="${chapterId}"]`
			);
			if (chapterContainer) {
				const titleElement = chapterContainer.querySelector(
					".cha-tit h1, .cha-tit h3"
				);
				if (titleElement) {
					return titleElement.textContent.trim();
				}
			}
		}

		// Fallback: get first visible chapter title
		const titleElement = document.querySelector(".cha-tit h1, .cha-tit h3");
		if (titleElement) {
			return titleElement.textContent.trim();
		}

		// Last fallback to page title
		return document.title.replace(/\s*-\s*WebNovel$/, "").trim();
	}

	/**
	 * Extract content for a SPECIFIC chapter ID
	 * This ensures we always get the right chapter, not just the first visible one
	 */
	extractChapterContent(chapterId) {
		debugLog(`WebNovel: Extracting content for chapter ${chapterId}...`);

		const chapterContainer = document.querySelector(
			`.cha-content[data-cid="${chapterId}"]`
		);

		if (!chapterContainer) {
			debugError(
				`WebNovel: Could not find chapter container ${chapterId}`
			);
			return {
				found: false,
				reason: `Could not locate chapter ${chapterId} on this page.`,
			};
		}

		const contentArea = chapterContainer.querySelector(".cha-words");
		if (!contentArea) {
			debugError(
				`WebNovel: Could not find content area for chapter ${chapterId}`
			);
			return {
				found: false,
				reason: `Could not locate content for chapter ${chapterId}.`,
			};
		}

		// Get the title from this specific chapter
		const titleElement = chapterContainer.querySelector(
			".cha-tit h1, .cha-tit h3"
		);
		const title = titleElement
			? titleElement.textContent.trim()
			: `Chapter ${chapterId}`;
		debugLog("WebNovel: Extracted title:", title);

		// Clone the content to avoid modifying the original
		const contentClone = contentArea.cloneNode(true);

		// Remove any script tags
		const scripts = contentClone.querySelectorAll("script");
		scripts.forEach((script) => script.remove());

		// Remove any ads or unwanted elements
		const ads = contentClone.querySelectorAll(".ad, .advertisement");
		ads.forEach((ad) => ad.remove());

		// Get HTML content with preserved structure
		let htmlContent = contentClone.innerHTML.trim();

		// Also get plain text for token counting and processing
		let textContent =
			contentClone.textContent || contentClone.innerText || "";
		textContent = textContent.trim();

		// Get metadata
		const metadata = {
			chapterId: chapterId,
		};

		debugLog("WebNovel: Content extracted successfully");
		debugLog(
			"WebNovel: HTML content length:",
			htmlContent.length,
			"characters"
		);
		debugLog(
			"WebNovel: Text content length:",
			textContent.length,
			"characters"
		);

		return {
			found: true,
			title: title,
			text: textContent, // Plain text for processing
			content: htmlContent, // HTML for preservation
			contentArea: contentArea,
			chapterContainer: chapterContainer, // Include container for targeted updates
			metadata: metadata,
			wordCount: textContent
				.trim()
				.split(/\s+/)
				.filter((word) => word.length > 0).length,
		};
	}

	/**
	 * Legacy extractContent for compatibility with base system
	 * Extracts the first visible chapter
	 */
	extractContent() {
		debugLog("WebNovel: Extracting content (legacy method)...");

		// Find first visible chapter
		const allChapterContainers = document.querySelectorAll(".cha-content");
		for (const container of allChapterContainers) {
			const rect = container.getBoundingClientRect();
			if (rect.top >= -100 && rect.top <= window.innerHeight / 2) {
				const chapterId = container.getAttribute("data-cid");
				if (chapterId) {
					return this.extractChapterContent(chapterId);
				}
			}
		}

		// Fallback to first chapter
		const firstChapter = document.querySelector(".cha-content");
		if (firstChapter) {
			const chapterId = firstChapter.getAttribute("data-cid");
			if (chapterId) {
				return this.extractChapterContent(chapterId);
			}
		}

		return {
			found: false,
			reason: "Could not locate any chapter content on this WebNovel page.",
		};
	}

	/**
	 * Get UI insertion point for a SPECIFIC chapter
	 * Used by the base system if needed, but we handle our own button injection
	 */
	getUIInsertionPoint(chapterId = null) {
		debugLog("WebNovel: Finding UI insertion point...");

		// If chapterId provided, find that specific chapter's insertion point
		if (chapterId) {
			const chapterContainer = document.querySelector(
				`.cha-content[data-cid="${chapterId}"]`
			);
			if (chapterContainer) {
				const title = chapterContainer.querySelector(".cha-tit");
				if (title) {
					debugLog(
						`WebNovel: Inserting after chapter ${chapterId} title`
					);
					return {
						element: title,
						position: "afterend",
					};
				}
			}
		}

		// Fallback: find first visible chapter title
		const allTitles = document.querySelectorAll(".cha-tit");
		for (const title of allTitles) {
			const rect = title.getBoundingClientRect();
			if (rect.top >= -100 && rect.top <= window.innerHeight / 2) {
				debugLog("WebNovel: Inserting after visible chapter title");
				return {
					element: title,
					position: "afterend",
				};
			}
		}

		// Last fallback
		const firstTitle = document.querySelector(".cha-tit");
		if (firstTitle) {
			return {
				element: firstTitle,
				position: "afterend",
			};
		}

		debugLog("WebNovel: Using base UI insertion point");
		return super.getUIInsertionPoint();
	}

	/**
	 * Override: WebNovel handles its own UI injection per chapter
	 * Return false to prevent base system from injecting global buttons
	 */
	shouldInjectGlobalUI() {
		return false;
	}

	// Get site-specific prompt enhancement
	getSiteSpecificPrompt() {
		return WebNovelHandler.DEFAULT_SITE_PROMPT;
	}
}

// Default export - create an instance
export default new WebNovelHandler();
