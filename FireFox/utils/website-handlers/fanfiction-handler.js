/**
 * FanfictionHandler
 * Handler for fanfiction.net website content extraction
 */

import { BaseWebsiteHandler } from "./base-handler.js";

class FanfictionHandler extends BaseWebsiteHandler {
	constructor() {
		super();
		this.siteName = "fanfiction.net";
	}

	/**
	 * Gets the current chapter text content from fanfiction.net page
	 * @returns {string} The chapter content
	 */
	getChapterContent() {
		try {
			// For fanfiction.net, the main content is in the storytext div
			const storyTextDiv = document.getElementById("storytext");

			if (!storyTextDiv) {
				console.error("Could not find storytext element");
				return "";
			}

			// Create a deep clone to avoid modifying the actual DOM
			const contentClone = storyTextDiv.cloneNode(true);

			// Handle different DOM structures in fanfiction.net
			// Some stories use paragraph tags, others use divs, some use direct text nodes

			// First try: extract all paragraph elements
			const paragraphs = contentClone.querySelectorAll("p");
			if (paragraphs.length > 0) {
				console.log(
					`Found ${paragraphs.length} paragraph elements in fanfiction.net content`
				);
				let extractedText = "";
				paragraphs.forEach((p) => {
					extractedText += p.textContent.trim() + "\n\n";
				});
				return extractedText;
			}

			// Second try: look for div elements that might contain paragraphs
			const divs = contentClone.querySelectorAll("div");
			if (divs.length > 0) {
				console.log(
					`Found ${divs.length} div elements in fanfiction.net content`
				);
				let extractedText = "";
				divs.forEach((div) => {
					const text = div.textContent.trim();
					if (text.length > 0) {
						extractedText += text + "\n\n";
					}
				});
				if (extractedText.length > 0) {
					return extractedText;
				}
			}

			// Third try: just get all the text and process it into paragraphs
			let rawText = contentClone.textContent.trim();

			// Split by double newlines or series of line breaks to detect paragraphs
			const textParagraphs = rawText.split(/\n\n+|\r\n\r\n+/);
			if (textParagraphs.length > 1) {
				console.log(
					`Extracted ${textParagraphs.length} paragraphs from raw text`
				);
				return textParagraphs.join("\n\n");
			}

			// Last resort: return the raw text with some minimal processing
			// Try to identify paragraph breaks with period+space+capital letter pattern
			rawText = rawText.replace(/\.(\s+)([A-Z])/g, ".\n\n$2");

			console.log(
				"Using last resort extraction method for fanfiction.net"
			);
			return rawText;
		} catch (error) {
			console.error(
				"Error extracting content from fanfiction.net:",
				error
			);
			return "";
		}
	}

	/**
	 * Extracts content from the page
	 * @returns {Object} Object with found, title, text, and selector properties
	 */
	extractContent() {
		console.log("FanfictionHandler: extracting content");
		const text = this.getChapterContent();
		const title = this.getChapterTitle();

		// Add detailed logging for debugging
		console.log(`FanfictionHandler: extracted ${text.length} characters`);
		console.log(
			`FanfictionHandler: first 100 chars: "${text.substring(0, 100)}..."`
		);

		return {
			found: text.length > 0,
			title: title,
			text: text,
			selector: "fanfiction.net handler",
		};
	}

	/**
	 * Finds the content area element
	 * @returns {HTMLElement} The content area element
	 */
	findContentArea() {
		return document.getElementById("storytext");
	}

	/**
	 * Gets the title of the current chapter
	 * @returns {string} The chapter title
	 */
	getChapterTitle() {
		// Try to find the chapter title
		const titleElement = document.querySelector("title");
		if (titleElement) {
			return titleElement.textContent.trim();
		}
		return "Chapter from fanfiction.net";
	}

	/**
	 * Gets the title of the book/story
	 * @returns {string} The book title
	 */
	getBookTitle() {
		const storyTitleElement = document.querySelector(
			"#profile_top b.xcontrast_txt"
		);
		if (storyTitleElement) {
			return storyTitleElement.textContent.trim();
		}
		return "Story from fanfiction.net";
	}

	/**
	 * Gets the author of the book/story
	 * @returns {string} The author name
	 */
	getAuthor() {
		const authorElement = document.querySelector(
			"#profile_top a.xcontrast_txt"
		);
		if (authorElement) {
			return authorElement.textContent.trim();
		}
		return "Unknown Author";
	}

	/**
	 * Gets the optimal UI insertion point
	 * @param {HTMLElement} contentArea - The content area element
	 * @returns {Object} Object with element and position properties
	 */
	getUIInsertionPoint(contentArea) {
		// For fanfiction.net, insert before the storytext element
		return {
			element: contentArea,
			position: "before",
		};
	}
}

// Export singleton instance
export default new FanfictionHandler();
