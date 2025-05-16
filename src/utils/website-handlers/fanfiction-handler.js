/**
 * FanFiction.net Website Content Handler
 * Specialized handler for extracting content from fanfiction.net
 */
import { BaseWebsiteHandler } from "./base-handler.js";

export class FanfictionHandler extends BaseWebsiteHandler {
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
	}

	// Return true if this handler can handle the current website
	canHandle() {
		return window.location.hostname.includes("fanfiction.net");
	}

	// Find the content area on Fanfiction.net
	findContentArea() {
		// Look for the story content element with ID "storytext"
		const storyText = document.getElementById("storytext");
		if (storyText) {
			return storyText;
		}

		// Fallback to the base implementation
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

		// Fallback to the default title extraction (page title)
		return document.title;
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

	// Format content after enhancement
	formatAfterEnhancement(contentArea) {
		// Apply fanfiction.net specific styling
		if (contentArea) {
			// Ensure proper spacing between paragraphs
			const paragraphs = contentArea.querySelectorAll("p");
			paragraphs.forEach((p) => {
				p.style.marginBottom = "1.5em";
			});

			// Handle any center-aligned text (common in fanfiction)
			const centerTags = contentArea.querySelectorAll("center");
			centerTags.forEach((center) => {
				center.style.margin = "1.5em 0";
				center.style.fontStyle = "italic";
			});
		}
	}

	// Implement site-specific default prompt for Fanfiction.net
	getDefaultPrompt() {
		return "This is a fanfiction from Fanfiction.net. Please maintain the author's style and any formatting features like section breaks, centered text, italics, etc. Respect any special formatting the author uses for dialogue, thoughts, flashbacks, or scene transitions.";
	}

	// Get a readable site name for the UI
	getSiteIdentifier() {
		return "Fanfiction.net";
	}
}

// Default export
export default new FanfictionHandler();
