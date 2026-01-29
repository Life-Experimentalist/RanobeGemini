/**
 * FanFiction.net Mobile Website Content Handler
 * Specialized handler for mobile version (m.fanfiction.net)
 *
 * This is a SECONDARY handler that shares a shelf with the primary FanfictionHandler.
 * Shelf display metadata (name, icon, color, primaryDomain) is inherited from primary.
 */
import { BaseWebsiteHandler } from "./base-handler.js";
import { debugLog, debugError } from "../logger.js";

export class FanfictionMobileHandler extends BaseWebsiteHandler {
	// Static properties for domain management
	static SUPPORTED_DOMAINS = [
		"m.fanfiction.net", // Mobile-specific domain
	];

	static DEFAULT_ENABLED = false;

	// Ensure mobile handler runs before desktop
	static PRIORITY = 10;

	// Shelf metadata - SECONDARY handler, shares shelf with desktop FanFiction.net
	// Only id and novelIdPattern are required for secondary handlers
	// Other display properties are inherited from the PRIMARY handler (FanfictionHandler)
	static SHELF_METADATA = {
		id: "fanfiction", // Must match primary handler's shelf ID
		isPrimary: false, // Mark as secondary handler
		novelIdPattern: /\/s\/(\d+)\//, // Same pattern as primary
	};

	// Handler type: Metadata requires visiting dedicated novel info page
	// For mobile users, we need to redirect to www subdomain for full novel details
	static HANDLER_TYPE = "dedicated_page";
	static DETAILS_DOMAIN = "www.fanfiction.net";

	static DEFAULT_SITE_PROMPT = `This content is from FanFiction.net mobile, a fanfiction archive.
Please maintain:
- Proper paragraph breaks and formatting
- Character personalities and relationships from the original work
- Fandom-specific terminology and references
- Author's notes markers (if present)
- Scene breaks and dividers
- Any special formatting for emphasis
- Preserve the narrative flow and pacing
When enhancing, improve readability while respecting the author's creative voice and the source material.`;

	static initialize() {
		try {
			const { hostname, pathname, search, hash } = window.location;
			const isBareDomain = hostname === "fanfiction.net";
			const isStoryPath = /^\/s\/\d+/.test(pathname);
			const isMobileUA =
				/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
				window.innerWidth <= 768;
			if (isBareDomain && isStoryPath && isMobileUA) {
				const target = `https://m.fanfiction.net${pathname}${search}${hash}`;
				if (window.location.href !== target) {
					window.location.replace(target);
				}
			}
		} catch (_err) {
			// no-op
		}
	}

	constructor() {
		super();
		this.selectors = {
			content: [
				"#storycontent", // Main content area for mobile FanFiction.net
				".storycontent",
				"div[role='main'] .storycontent",
			],
			title: [
				"#content b", // Story title in mobile version
				"div[align='center'] b",
			],
		};

		// Enhancement mode specific to mobile fanfiction.net
		this.enhancementMode = "text-only";
	}

	// Return true if this handler can handle the mobile version
	canHandle() {
		return window.location.hostname === "m.fanfiction.net";
	}

	/**
	 * Check if current page is a chapter/story page (reading content)
	 * @returns {boolean}
	 */
	isChapterPage() {
		const url = window.location.pathname;
		// Story pages have /s/ in the URL
		const isStoryUrl = /^\/s\/\d+/.test(url);
		// Also check for story content
		const hasStoryContent = !!document.getElementById("storycontent");
		return isStoryUrl && hasStoryContent;
	}

	/**
	 * Check if current page is a novel info page
	 * Mobile version doesn't have detailed novel info pages
	 * Users should visit desktop version for full details
	 * @returns {boolean}
	 */
	isNovelPage() {
		return false;
	}

	/**
	 * Generate a unique novel ID from URL
	 * @param {string} url - The story URL
	 * @returns {string} Unique novel ID
	 */
	generateNovelId(url = window.location.href) {
		// Extract story ID from URL: /s/12345/...
		const match = url.match(/\/s\/(\d+)/);
		if (match) {
			return `fanfiction-${match[1]}`; // Same as desktop version for shared shelf
		}

		const urlPath = new URL(url).pathname;
		const urlHash = btoa(urlPath)
			.substring(0, 16)
			.replace(/[^a-zA-Z0-9]/g, "");
		return `fanfiction-${urlHash}`;
	}

	/**
	 * Get the story details page URL - redirects to desktop version for full details
	 * @returns {string}
	 */
	getNovelPageUrl() {
		// Redirect to desktop version for full story details
		const match = window.location.href.match(/\/s\/(\d+)/);
		if (match) {
			return `https://www.fanfiction.net/s/${match[1]}/1/`;
		}
		return window.location.href.replace(
			"m.fanfiction.net",
			"www.fanfiction.net",
		);
	}

	/**
	 * Get novel controls configuration for FanFiction mobile
	 * @returns {Object} Configuration for novel controls UI
	 */
	getNovelControlsConfig() {
		return {
			showControls: this.isChapterPage(),
			insertionPoint: this.getNovelPageUIInsertionPoint(),
			position: "before",
			isChapterPage: true,
			customStyles: {
				background: "linear-gradient(135deg, #1a2540 0%, #16213e 100%)",
				borderColor: "#2a4b8d",
				accentColor: "#4a7c9c",
			},
		};
	}

	/**
	 * Get insertion point for novel controls UI on FanFiction mobile
	 * @returns {Object|null} { element, position } or null
	 */
	getNovelPageUIInsertionPoint() {
		// Insert before story content on mobile
		const storyContent = document.getElementById("storycontent");
		if (storyContent) {
			return { element: storyContent, position: "before" };
		}

		// Fallback to content div
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
	 * Get site-specific enhancement buttons for FanFiction.net mobile
	 * These buttons are injected into the control panel alongside enhance/summarize
	 * @returns {Array<HTMLElement>} Array of button elements
	 */
	getSiteSpecificEnhancements() {
		// Only show on chapter pages
		if (!this.isChapterPage()) {
			return [];
		}

		const button = document.createElement("button");
		button.id = "fanfiction-version-switcher";
		button.textContent = "🖥️ Desktop";
		button.title = "Switch to desktop version";

		// Match the same styling as enhance/summarize buttons but compact
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
			// Switch from m.fanfiction.net to www.fanfiction.net
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
	 * Extract basic metadata from mobile page
	 * Note: Mobile version has limited metadata, prefer desktop for full details
	 * @returns {Object}
	 */
	extractNovelMetadata() {
		const metadata = {
			title: this.extractTitle(),
			author: null,
			description: null,
			coverUrl: null,
			genres: [],
			tags: [],
			status: null,
			chapterCount: null,
			mainNovelUrl: this.getNovelPageUrl(),
			needsDetailPage: true,
			metadataIncomplete: true,
		};

		// Try to extract author from mobile page
		const contentDiv = document.getElementById("content");
		if (contentDiv) {
			const authorLink = contentDiv.querySelector("a[href*='/u/']");
			if (authorLink) {
				metadata.author = authorLink.textContent.trim();
			}
		}

		return metadata;
	}

	// Find the content area on mobile Fanfiction.net
	findContentArea() {
		// Mobile version uses div#storycontent with class="storycontent nocopy"
		const contentDiv = document.getElementById("storycontent");
		if (contentDiv) {
			debugLog("FanFiction Mobile: Found storycontent div");
			return contentDiv;
		}

		// Fallback: try finding by class
		const storyContentByClass = document.querySelector(".storycontent");
		if (storyContentByClass) {
			debugLog("FanFiction Mobile: Found content by class");
			return storyContentByClass;
		}

		// Final fallback to base implementation
		return super.findContentArea();
	}

	// Extract the title of the chapter
	extractTitle() {
		// Mobile version has title in: <div align=center><b>Story Title</b> by <a>author</a></div>
		const contentDiv = document.getElementById("content");
		if (contentDiv) {
			const titleElement = contentDiv.querySelector(
				"div[align='center'] b",
			);
			if (titleElement) {
				return titleElement.textContent.trim();
			}
		}

		// Fallback to page title
		return document.title;
	}

	// Format content after enhancement - DO NOT MODIFY STYLING
	formatAfterEnhancement(contentArea) {
		// Leave all styling as-is from original content
		// No modifications to preserve original formatting
	}

	/**
	 * Indicates this site prefers text-only enhancement (no structural/style changes)
	 */
	supportsTextOnlyEnhancement() {
		return true;
	}

	/**
	 * Apply enhanced content in a text-only manner for mobile version.
	 * Mobile version has simpler structure with direct <p> tags in #storycontent
	 * @param {HTMLElement} contentArea - The story content root element
	 * @param {string} enhancedText - The enhanced content (plain or lightly formatted)
	 * @returns {number} total paragraphs updated/appended
	 */
	applyEnhancedContent(contentArea, enhancedText) {
		if (!contentArea || typeof enhancedText !== "string") return 0;

		debugLog(
			"FanFiction Mobile applyEnhancedContent: contentArea is",
			contentArea.id,
			contentArea.className,
		);

		// Check if the enhanced text contains HTML tags
		const hasHTMLTags = /<p>|<\/p>|<br>|<div>/.test(enhancedText);

		let enhancedParagraphs = [];

		if (hasHTMLTags) {
			// Parse HTML content to extract paragraph text
			debugLog(
				"FanFiction Mobile: Enhanced text contains HTML, parsing...",
			);
			const tempDiv = document.createElement("div");
			tempDiv.innerHTML = enhancedText;

			// Extract text from all <p> tags
			const pTags = tempDiv.querySelectorAll("p");
			enhancedParagraphs = Array.from(pTags)
				.map((p) => p.textContent.trim())
				.filter((text) => text.length > 0);

			debugLog(
				`FanFiction Mobile: Extracted ${enhancedParagraphs.length} paragraphs from HTML`,
			);
		} else {
			// Plain text - split on double newlines as paragraph boundaries
			debugLog(
				"FanFiction Mobile: Enhanced text is plain text, splitting by newlines...",
			);
			enhancedParagraphs = enhancedText
				.replace(/\r/g, "")
				.split(/\n\n+/)
				.map((p) => p.trim())
				.filter((p) => p.length > 0);
		}

		// Get all existing paragraphs
		const originalParagraphEls = Array.from(
			contentArea.querySelectorAll("p"),
		);
		const replaceCount = Math.min(
			originalParagraphEls.length,
			enhancedParagraphs.length,
		);

		debugLog(
			`FanFiction Mobile: Replacing ${replaceCount} existing paragraphs, adding ${
				enhancedParagraphs.length - replaceCount
			} new ones`,
		);

		// Replace existing paragraphs
		for (let i = 0; i < replaceCount; i++) {
			// Preserve existing inline styles (like text-align:center)
			const existingStyle = originalParagraphEls[i].getAttribute("style");
			originalParagraphEls[i].textContent = enhancedParagraphs[i];

			// Restore original style if it existed
			if (existingStyle) {
				originalParagraphEls[i].setAttribute("style", existingStyle);
			}

			// Ensure user-select is enabled
			if (!originalParagraphEls[i].style.userSelect) {
				originalParagraphEls[i].style.userSelect = "text";
			}
		}

		// Add new paragraphs if enhanced content has more
		for (let i = replaceCount; i < enhancedParagraphs.length; i++) {
			const p = document.createElement("p");
			p.textContent = enhancedParagraphs[i];
			p.style.userSelect = "text";
			contentArea.appendChild(p);
		}

		return enhancedParagraphs.length;
	}

	// Implement site-specific default prompt
	getDefaultPrompt() {
		return "This is a fanfiction from FanFiction.net mobile. Please maintain the author's style and any formatting features like section breaks, centered text, italics, etc. Respect any special formatting the author uses for dialogue, thoughts, flashbacks, or scene transitions.";
	}

	// Get a readable site name for the UI
	getSiteIdentifier() {
		return "Fanfiction.net (Mobile)";
	}

	// Get site-specific prompt enhancement
	getSiteSpecificPrompt() {
		return FanfictionMobileHandler.DEFAULT_SITE_PROMPT;
	}
}

// Default export
export default new FanfictionMobileHandler();
