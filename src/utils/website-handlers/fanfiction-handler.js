/**
 * FanFiction.net Website Content Handler
 * Specialized handler for extracting content from fanfiction.net
 */
import { BaseWebsiteHandler } from "./base-handler.js";

export class FanfictionHandler extends BaseWebsiteHandler {
	// Static properties for domain management
	// Explicitly supported domains (documented for clarity)
	// Wildcard at end acts as safety net for any unlisted subdomains
	static SUPPORTED_DOMAINS = [
		"fanfiction.net",
		"www.fanfiction.net",
		"*.fanfiction.net", // Safety net: catches any other subdomains (EXCEPT m.fanfiction.net - handled by mobile handler)
	];

	// Shelf metadata for Novel Library
	static SHELF_METADATA = {
		id: "fanfiction", // Same ID as mobile to share shelf
		name: "FanFiction.net",
		icon: "📚",
		color: "#2a4b8d",
		novelIdPattern: /\/s\/(\d+)\//,
		primaryDomain: "www.fanfiction.net",
	};

	static DEFAULT_SITE_PROMPT = `This content is from FanFiction.net, a fanfiction archive.
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
				"#storytext", // Main content area for FanFiction.net
				".storytext",
				"#story_text",
			],
			title: [
				"#profile_top b.xcontrast_txt", // FanFiction.net story title
				"#content b",
				"h1.title",
			],
		};

		// Enhancement mode specific to fanfiction.net
		this.enhancementMode = "text-only"; // indicates we replace only paragraph text, preserving original DOM/styles
	}

	// Return true if this handler can handle the current website
	canHandle() {
		const hostname = window.location.hostname;
		// Exclude mobile version (m.fanfiction.net)
		if (hostname === "m.fanfiction.net") {
			return false;
		}
		return hostname.includes("fanfiction.net");
	}

	// Find the content area on Fanfiction.net
	findContentArea() {
		// First, try to find the actual content div storytextN (e.g., storytext1, storytext2)
		// Pattern: <div id="storytextN" class="storytext xcontrast_txt nocopy">
		// This is a child of the parent <div id="storytext">

		const parentStorytextDiv = document.getElementById("storytext");
		if (parentStorytextDiv) {
			// Look for child div with id matching storytext + number (storytext1, storytext2, etc.)
			// Use :not(#storytext) to exclude the parent itself
			const childDivs = parentStorytextDiv.querySelectorAll(
				'div[id^="storytext"]:not(#storytext)'
			);
			if (childDivs.length > 0) {
				console.log(
					"FanFiction: Found storytext child div:",
					childDivs[0].id
				);
				return childDivs[0];
			}

			// Alternative: try finding by class name (the child has class "storytext")
			const storytextClassDivs =
				parentStorytextDiv.querySelectorAll("div.storytext[id]");
			if (storytextClassDivs.length > 0) {
				console.log(
					"FanFiction: Found storytext via class:",
					storytextClassDivs[0].id
				);
				return storytextClassDivs[0];
			}

			// If no child found, use the parent (fallback)
			console.log("FanFiction: Using parent storytext div");
			return parentStorytextDiv;
		}

		// Final fallback to the base implementation
		return super.findContentArea();
	}

	// Extract the title of the chapter
	extractTitle() {
		// Try to find the title - it's usually in a heading with class "m-story-header"
		const storyHeader = document.querySelector(".m-story-header");
		if (storyHeader) {
			const title = storyHeader.querySelector("h1")?.textContent.trim();
			if (title) return title;
		}

		// Try the profile_top area for desktop
		const profileTop = document.getElementById("profile_top");
		if (profileTop) {
			const titleEl = profileTop.querySelector("b.xcontrast_txt");
			if (titleEl) {
				return titleEl.textContent.trim();
			}
		}

		// Fallback to the default title extraction (page title)
		return document.title;
	}

	/**
	 * Extract the story description/summary from FanFiction.net
	 * The description is typically in the #profile_top area
	 * @returns {string|null} The story description or null if not found
	 */
	extractDescription() {
		try {
			const profileTop = document.getElementById("profile_top");
			if (!profileTop) {
				console.log("FanFiction: #profile_top not found");
				return null;
			}

			// The description is in a div with class 'xcontrast_txt' and style 'margin-top:2px'
			// It comes after the author link
			const descriptionDivs =
				profileTop.querySelectorAll("div.xcontrast_txt");
			for (const div of descriptionDivs) {
				// Skip empty divs or divs that are just spacing
				const text = div.textContent.trim();
				if (text && text.length > 20 && !text.startsWith("By:")) {
					// Check if this looks like a description (not metadata)
					if (!text.includes("Rated:") && !text.includes("Words:")) {
						console.log(
							"FanFiction: Found description:",
							text.substring(0, 100) + "..."
						);
						return text;
					}
				}
			}

			// Alternative: look for the div that follows the author info
			// The structure is: title (b), author link (a), then description (div with margin-top:2px)
			const allDivs = profileTop.querySelectorAll("div");
			for (const div of allDivs) {
				const style = div.getAttribute("style") || "";
				if (
					style.includes("margin-top") &&
					div.classList.contains("xcontrast_txt")
				) {
					const text = div.textContent.trim();
					if (text && text.length > 20) {
						console.log(
							"FanFiction: Found description via style:",
							text.substring(0, 100) + "..."
						);
						return text;
					}
				}
			}

			console.log("FanFiction: No description found in #profile_top");
			return null;
		} catch (error) {
			console.error("FanFiction: Error extracting description:", error);
			return null;
		}
	}

	/**
	 * Extract the author name from FanFiction.net
	 * @returns {string|null} The author name or null if not found
	 */
	extractAuthor() {
		try {
			const profileTop = document.getElementById("profile_top");
			if (!profileTop) {
				return null;
			}

			// Author is in an anchor tag with class 'xcontrast_txt' and href starting with '/u/'
			const authorLink = profileTop.querySelector(
				"a.xcontrast_txt[href^='/u/']"
			);
			if (authorLink) {
				return authorLink.textContent.trim();
			}

			return null;
		} catch (error) {
			console.error("FanFiction: Error extracting author:", error);
			return null;
		}
	}

	/**
	 * Extract metadata for novel library storage
	 * @returns {Object} Object containing title, author, description, coverUrl
	 */
	extractNovelMetadata() {
		const metadata = {
			title: this.extractTitle(),
			author: this.extractAuthor(),
			description: this.extractDescription(),
			coverUrl: null,
		};

		// Try to extract cover image URL
		try {
			const profileTop = document.getElementById("profile_top");
			if (profileTop) {
				const coverImg = profileTop.querySelector("img.cimage");
				if (coverImg) {
					// The src might be a thumbnail, try to get full image from data-original
					const imgLarge = document.querySelector("#img_large img");
					if (imgLarge) {
						let src =
							imgLarge.getAttribute("data-original") ||
							imgLarge.src;
						if (src && src.startsWith("/")) {
							src = window.location.origin + src;
						}
						metadata.coverUrl = src;
					} else {
						let src = coverImg.src;
						if (src && src.startsWith("/")) {
							src = window.location.origin + src;
						}
						metadata.coverUrl = src;
					}
				}
			}
		} catch (error) {
			console.error("FanFiction: Error extracting cover URL:", error);
		}

		console.log("FanFiction: Extracted metadata:", metadata);
		return metadata;
	}

	// Get chapter navigation info (previous, next, current chapter number)
	getChapterNavigation() {
		try {
			// Try to find chapter navigation
			const selectBox = document.getElementById("chap_select");
			if (selectBox) {
				const options = selectBox.querySelectorAll("option");
				const selectedIndex = selectBox.selectedIndex;

				return {
					hasPrevious: selectedIndex > 0,
					hasNext: selectedIndex < options.length - 1,
					currentChapter: selectedIndex + 1,
					totalChapters: options.length,
				};
			}
		} catch (error) {
			console.error("Error getting chapter navigation:", error);
		}

		// Fallback to default
		return super.getChapterNavigation();
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
	 * Apply enhanced content in a text-only manner.
	 * Replaces the textual content of existing <p> elements sequentially.
	 * Appends new <p> elements if enhanced content has more paragraphs.
	 * Does NOT alter existing inline styles or other DOM structure.
	 * @param {HTMLElement} contentArea - The story content root element
	 * @param {string} enhancedText - The enhanced content (plain or lightly formatted)
	 * @returns {number} total paragraphs updated/appended
	 */
	applyEnhancedContent(contentArea, enhancedText) {
		if (!contentArea || typeof enhancedText !== "string") return 0;

		console.log(
			"FanFiction applyEnhancedContent: contentArea is",
			contentArea.id,
			contentArea.className
		);

		// Make sure we're working with the storytextN div, not the parent storytext div
		let targetDiv = contentArea;

		// If we got the parent storytext div, find the child storytextN div
		if (
			contentArea.id === "storytext" &&
			!contentArea.className.includes("storytext")
		) {
			const childDiv = contentArea.querySelector('div[id^="storytext"]');
			if (childDiv) {
				console.log(
					"FanFiction: Switching from parent to child div:",
					childDiv.id
				);
				targetDiv = childDiv;
			}
		}

		// Check if the enhanced text contains HTML tags (like <p>...</p>)
		const hasHTMLTags = /<p>|<\/p>|<br>|<div>/.test(enhancedText);

		let enhancedParagraphs = [];

		if (hasHTMLTags) {
			// Parse HTML content to extract paragraph text
			console.log("FanFiction: Enhanced text contains HTML, parsing...");
			const tempDiv = document.createElement("div");
			tempDiv.innerHTML = enhancedText;

			// Extract text from all <p> tags
			const pTags = tempDiv.querySelectorAll("p");
			enhancedParagraphs = Array.from(pTags)
				.map((p) => p.textContent.trim())
				.filter((text) => text.length > 0);

			console.log(
				`FanFiction: Extracted ${enhancedParagraphs.length} paragraphs from HTML`
			);
		} else {
			// Plain text - split on double newlines as paragraph boundaries
			console.log(
				"FanFiction: Enhanced text is plain text, splitting by newlines..."
			);
			enhancedParagraphs = enhancedText
				.replace(/\r/g, "")
				.split(/\n\n+/)
				.map((p) => p.trim())
				.filter((p) => p.length > 0);
		}

		const originalParagraphEls = Array.from(
			targetDiv.querySelectorAll("p")
		);
		const replaceCount = Math.min(
			originalParagraphEls.length,
			enhancedParagraphs.length
		);

		console.log(
			`FanFiction: Replacing ${replaceCount} existing paragraphs, adding ${
				enhancedParagraphs.length - replaceCount
			} new ones`
		);

		for (let i = 0; i < replaceCount; i++) {
			// Replace only textual content; preserve existing style attribute
			originalParagraphEls[i].textContent = enhancedParagraphs[i];
			// Ensure user-select style is set
			if (!originalParagraphEls[i].style.userSelect) {
				originalParagraphEls[i].style.userSelect = "text";
			}
		}

		// For any additional paragraphs, create new ones with the same style
		// Append them to the targetDiv (storytextN), not the parent
		for (let i = replaceCount; i < enhancedParagraphs.length; i++) {
			const p = document.createElement("p");
			p.textContent = enhancedParagraphs[i];
			// Match the style of existing paragraphs
			p.style.userSelect = "text";
			targetDiv.appendChild(p);
		}

		return enhancedParagraphs.length; // total processed paragraphs
	}

	// Implement site-specific default prompt for Fanfiction.net
	getDefaultPrompt() {
		return "This is a fanfiction from Fanfiction.net. Please maintain the author's style and any formatting features like section breaks, centered text, italics, etc. Respect any special formatting the author uses for dialogue, thoughts, flashbacks, or scene transitions.";
	}

	// Get a readable site name for the UI
	getSiteIdentifier() {
		return "Fanfiction.net";
	}

	// Get site-specific prompt enhancement
	getSiteSpecificPrompt() {
		return FanfictionHandler.DEFAULT_SITE_PROMPT;
	}
}

// Default export
export default new FanfictionHandler();
