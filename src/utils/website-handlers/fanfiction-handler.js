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
	 * Checks if the current page is the mobile version
	 * @returns {boolean} True if this is the mobile version
	 */
	isMobileVersion() {
		return window.location.hostname.startsWith("m.");
	}

	/**
	 * Gets the current chapter text content from fanfiction.net page
	 * @returns {string} The chapter content
	 */
	getChapterContent() {
		try {
			const isMobile = this.isMobileVersion();
			console.log(
				`FanfictionHandler: ${
					isMobile ? "Mobile" : "Desktop"
				} version detected`
			);

			// Find the content container based on version
			let storyContentDiv;

			if (isMobile) {
				// For mobile, try multiple possible selectors in order of preference
				const mobileSelectors = [
					document.getElementById("storycontent"), // by ID
					document.querySelector(".storycontent"), // by class
					document.querySelector("div[class=storycontent]"), // explicit div with class
					document.querySelector(
						"#content > div[class=storycontent]"
					), // with parent context
				];

				// Use the first selector that returns a non-null value
				storyContentDiv = mobileSelectors.find(
					(selector) => selector !== null
				);

				// Enhanced logging for mobile debugging
				console.log("Mobile selectors search results:");
				mobileSelectors.forEach((result, index) => {
					console.log(
						`Selector ${index}: ${result ? "Found" : "Not found"}`
					);
				});
			} else {
				// For desktop, the main content is in the storytext div
				storyContentDiv = document.getElementById("storytext");
			}

			if (!storyContentDiv) {
				console.error("Could not find story content element");
				// Log more detailed debugging information about the DOM structure
				console.log(
					"DOM structure:",
					document.body.innerHTML.substring(0, 1000) + "..."
				);
				return "";
			}

			// Create a deep clone to avoid modifying the actual DOM
			const contentClone = storyContentDiv.cloneNode(true);

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
		const bookTitle = this.getBookTitle();
		const author = this.getAuthor();

		// Add detailed logging for debugging
		console.log(`FanfictionHandler: extracted ${text.length} characters`);
		console.log(`FanfictionHandler: title "${title}"`);
		console.log(`FanfictionHandler: book "${bookTitle}" by ${author}`);
		console.log(
			`FanfictionHandler: first 100 chars: "${text.substring(0, 100)}..."`
		);

		return {
			found: text.length > 0,
			title: title,
			text: text,
			bookTitle: bookTitle,
			author: author,
			selector: "fanfiction.net handler",
		};
	}

	/**
	 * Finds the content area element
	 * @returns {HTMLElement} The content area element
	 */
	findContentArea() {
		const isMobile = this.isMobileVersion();
		console.log(
			`findContentArea for ${isMobile ? "mobile" : "desktop"} version`
		);

		if (isMobile) {
			// For mobile, try multiple possible selectors in order of preference
			const selectors = [
				"#storycontent", // by ID
				".storycontent", // by class
				"#content center", // some mobile layouts use this
				"#content > center", // direct child
				"#content div[align=center]", // aligned center divs inside content
				"div.storycontent", // explicit div with class
			];

			// Try each selector and use the first one that works
			for (const selector of selectors) {
				const element = document.querySelector(selector);
				if (element) {
					console.log(
						`Mobile content area found using selector: ${selector}`
					);
					return element;
				}
			}

			// If we couldn't find a specific content area, look for any content inside #content
			const contentElement = document.getElementById("content");
			if (contentElement) {
				console.log(
					"Mobile: Using generic #content element as fallback"
				);
				return contentElement;
			}

			console.warn("Mobile: Could not find any content area!");
			return null;
		} else {
			// For desktop, find the storytext div
			const element = document.getElementById("storytext");
			console.log(
				`Desktop content area ${element ? "found" : "not found"}`
			);
			return element;
		}
	}

	/**
	 * Gets the title of the current chapter
	 * @returns {string} The chapter title
	 */
	getChapterTitle() {
		const isMobile = this.isMobileVersion();

		if (isMobile) {
			// Mobile version title extraction - try multiple approaches

			// Try to get chapter from select menu first
			const chapterSelect = document.getElementById("jump");
			if (chapterSelect) {
				const selectedOption =
					chapterSelect.options[chapterSelect.selectedIndex];
				if (selectedOption) {
					return selectedOption.text.trim();
				}
			}

			// Try to get title from content area header
			const contentDiv = document.getElementById("content");
			if (contentDiv) {
				// Look for centered content which is often the title
				const centeredDivs =
					contentDiv.querySelectorAll("div[align=center]");
				if (centeredDivs.length > 0) {
					// First centered div often contains the story title
					// Look for chapter text nearby
					for (const div of centeredDivs) {
						const text = div.textContent.trim();
						// Look for Chapter indicator
						if (text.includes("Chapter")) {
							return text;
						}
					}
				}

				// Try to find the first bold text before the story content
				const boldText = contentDiv.querySelector("b");
				if (boldText) {
					return boldText.textContent.trim();
				}
			}
		} else {
			// Desktop version
			const chapterSelect = document.getElementById("chap_select");
			if (chapterSelect) {
				const selectedOption =
					chapterSelect.options[chapterSelect.selectedIndex];
				if (selectedOption) {
					return selectedOption.text.trim();
				}
			}
		}

		// Both mobile and desktop have title element
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
		const isMobile = this.isMobileVersion();

		if (isMobile) {
			// Mobile version - try multiple approaches

			// Try centered div with bold text first (most common)
			const centeredTitle = document.querySelector(
				"#content div[align=center] b"
			);
			if (centeredTitle) {
				return centeredTitle.textContent.trim();
			}

			// Try centered div directly
			const centeredDiv = document.querySelector("#content center");
			if (centeredDiv) {
				const boldText = centeredDiv.querySelector("b");
				if (boldText) {
					return boldText.textContent.trim();
				}
				// If no bold text, use the first line
				return centeredDiv.textContent.trim().split("\n")[0].trim();
			}
		} else {
			// Desktop version
			const storyTitleElement = document.querySelector(
				"#profile_top b.xcontrast_txt"
			);
			if (storyTitleElement) {
				return storyTitleElement.textContent.trim();
			}
		}

		// Fallback to title tag
		const titleTag = document.querySelector("title");
		if (titleTag) {
			const titleText = titleTag.textContent.trim();
			// Remove "Chapter X: " prefix if present
			const chapterMatch = titleText.match(/^Chapter \d+:\s*(.+)$/);
			if (chapterMatch && chapterMatch[1]) {
				return chapterMatch[1];
			}
			return titleText;
		}

		return "Story from fanfiction.net";
	}

	/**
	 * Gets the author of the book/story
	 * @returns {string} The author name
	 */
	getAuthor() {
		const isMobile = this.isMobileVersion();

		if (isMobile) {
			// Mobile version author extraction - try multiple approaches

			// Try to find author link in content div
			const contentDiv = document.getElementById("content");
			if (contentDiv) {
				// Look for author link which has a specific pattern
				const authorLinks =
					contentDiv.querySelectorAll("a[href^='/u/']");
				if (authorLinks.length > 0) {
					return authorLinks[0].textContent.trim();
				}

				// Sometimes it's in a centered div with "By: Author" format
				const centeredDivs =
					contentDiv.querySelectorAll("div[align=center]");
				for (const div of centeredDivs) {
					const text = div.textContent;
					if (text.includes("By:")) {
						const byMatch = text.match(/By:\s*([^,\n]+)/);
						if (byMatch && byMatch[1]) {
							return byMatch[1].trim();
						}
					}
				}
			}
		} else {
			// Desktop version
			const authorElement = document.querySelector(
				"#profile_top a.xcontrast_txt"
			);
			if (authorElement) {
				return authorElement.textContent.trim();
			}
		}

		return "Unknown Author";
	}

	/**
	 * Gets the optimal UI insertion point
	 * @param {HTMLElement} contentArea - The content area element
	 * @returns {Object} Object with element and position properties
	 */
	getUIInsertionPoint(contentArea) {
		const isMobile = this.isMobileVersion();

		if (isMobile) {
			// For mobile, we want to insert before the storycontent or after any centered title
			if (contentArea) {
				// If we found the specific storycontent div, insert before it
				if (
					contentArea.id === "storycontent" ||
					contentArea.classList.contains("storycontent")
				) {
					return {
						element: contentArea,
						position: "before",
					};
				}

				// If we're using the general #content div, find a better insertion point
				if (contentArea.id === "content") {
					// Look for the story content div inside
					const storyContent =
						contentArea.querySelector(".storycontent") ||
						contentArea.querySelector("#storycontent");
					if (storyContent) {
						return {
							element: storyContent,
							position: "before",
						};
					}

					// Try to insert after any centered div that might be a title
					const centeredDivs = contentArea.querySelectorAll(
						"div[align=center], center"
					);
					if (centeredDivs.length > 0) {
						return {
							element: centeredDivs[centeredDivs.length - 1],
							position: "after",
						};
					}
				}
			}
		}

		// Default behavior for both mobile and desktop
		return {
			element: contentArea,
			position: "before",
		};
	}

	/**
	 * Checks if the handler matches the given URL
	 * @param {string} url - The URL to check
	 * @returns {boolean} True if the handler matches the URL
	 */
	matches(url) {
		return url.includes("fanfiction.net");
		// This will match both www.fanfiction.net and m.fanfiction.net
	}
}

// Export singleton instance
export default new FanfictionHandler();
