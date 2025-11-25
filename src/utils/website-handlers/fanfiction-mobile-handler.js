/**
 * FanFiction.net Mobile Website Content Handler
 * Specialized handler for mobile version (m.fanfiction.net)
 */
import { BaseWebsiteHandler } from "./base-handler.js";

export class FanfictionMobileHandler extends BaseWebsiteHandler {
	// Static properties for domain management
	static SUPPORTED_DOMAINS = [
		"m.fanfiction.net", // Mobile-specific domain
	];

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

	// Find the content area on mobile Fanfiction.net
	findContentArea() {
		// Mobile version uses div#storycontent with class="storycontent nocopy"
		const contentDiv = document.getElementById("storycontent");
		if (contentDiv) {
			console.log("FanFiction Mobile: Found storycontent div");
			return contentDiv;
		}

		// Fallback: try finding by class
		const storyContentByClass = document.querySelector(".storycontent");
		if (storyContentByClass) {
			console.log("FanFiction Mobile: Found content by class");
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
				"div[align='center'] b"
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

		console.log(
			"FanFiction Mobile applyEnhancedContent: contentArea is",
			contentArea.id,
			contentArea.className
		);

		// Check if the enhanced text contains HTML tags
		const hasHTMLTags = /<p>|<\/p>|<br>|<div>/.test(enhancedText);

		let enhancedParagraphs = [];

		if (hasHTMLTags) {
			// Parse HTML content to extract paragraph text
			console.log(
				"FanFiction Mobile: Enhanced text contains HTML, parsing..."
			);
			const tempDiv = document.createElement("div");
			tempDiv.innerHTML = enhancedText;

			// Extract text from all <p> tags
			const pTags = tempDiv.querySelectorAll("p");
			enhancedParagraphs = Array.from(pTags)
				.map((p) => p.textContent.trim())
				.filter((text) => text.length > 0);

			console.log(
				`FanFiction Mobile: Extracted ${enhancedParagraphs.length} paragraphs from HTML`
			);
		} else {
			// Plain text - split on double newlines as paragraph boundaries
			console.log(
				"FanFiction Mobile: Enhanced text is plain text, splitting by newlines..."
			);
			enhancedParagraphs = enhancedText
				.replace(/\r/g, "")
				.split(/\n\n+/)
				.map((p) => p.trim())
				.filter((p) => p.length > 0);
		}

		// Get all existing paragraphs
		const originalParagraphEls = Array.from(
			contentArea.querySelectorAll("p")
		);
		const replaceCount = Math.min(
			originalParagraphEls.length,
			enhancedParagraphs.length
		);

		console.log(
			`FanFiction Mobile: Replacing ${replaceCount} existing paragraphs, adding ${
				enhancedParagraphs.length - replaceCount
			} new ones`
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
