/**
 * Base Website Content Handler
 * The abstract class that all website-specific handlers should extend
 */

export class BaseWebsiteHandler {
	constructor() {
		// Optional initialization
	}

	// Return true if this handler can handle the current website
	canHandle() {
		throw new Error("Method canHandle() must be implemented by subclass");
	}

	// Find the main content element of the page
	findContentArea() {
		// Common content selectors across many websites
		const commonSelectors = [
			"article",
			".article",
			".content",
			".main-content",
			".chapter-content",
			"#content",
			".entry-content",
			".post-content",
		];

		for (const selector of commonSelectors) {
			const element = document.querySelector(selector);
			if (element && element.textContent.length > 500) {
				console.log(
					`Base handler: Found content with selector ${selector}`
				);
				return element;
			}
		}

		// Fallback: Look for the largest text block on the page
		const paragraphs = document.querySelectorAll("p");
		let bestCandidate = null;
		let maxLength = 0;

		// Find the paragraph with the most content, likely part of the main text
		for (const p of paragraphs) {
			const text = p.textContent.trim();
			if (text.length > maxLength) {
				maxLength = text.length;
				bestCandidate = p.parentElement;
			}
		}

		if (bestCandidate && maxLength > 200) {
			console.log(
				"Base handler: Found content using largest text block method"
			);
			return bestCandidate;
		}

		console.log("Base handler: Could not find content area");
		return null;
	}

	// Extract the title of the chapter
	extractTitle() {
		throw new Error(
			"Method extractTitle() must be implemented by subclass"
		);
	}

	// Extract the full content of the chapter
	extractContent() {
		// Get title from the page
		const title = document.title;

		// Find the content area
		const contentArea = this.findContentArea();
		if (!contentArea) {
			return {
				found: false,
				title: title,
				text: "",
				selector: "No content found",
			};
		}

		// Extract text content
		const content = contentArea.innerText;

		return {
			found: content.length > 100,
			title: title,
			text: content,
			selector: "generic",
		};
	}

	// Get chapter navigation info (previous, next, current chapter number)
	getChapterNavigation() {
		// Default implementation - subclasses can override
		return {
			hasPrevious: false,
			hasNext: false,
			currentChapter: 1,
			totalChapters: 1,
		};
	}

	// Get ideal insertion point for UI controls
	getUIInsertionPoint(contentArea) {
		// Default behavior: Insert before the content area
		return {
			element: contentArea,
			position: "before",
		};
	}

	// Get site-specific prompt for this handler
	// This can be overridden by website-specific handlers
	getSiteSpecificPrompt() {
		// Get stored prompt for this site if it exists
		const hostname = window.location.hostname;
		const storedPrompt = this.getStoredSitePrompt(hostname);

		if (storedPrompt) {
			return storedPrompt;
		}

		// Return the default prompt for this handler
		return this.getDefaultPrompt();
	}

	// Get default prompt for this site (to be overridden by specific handlers)
	getDefaultPrompt() {
		// Base implementation returns empty string
		return "";
	}

	// Get stored site-specific prompt
	getStoredSitePrompt(hostname) {
		try {
			// Try to get stored site prompts from localStorage
			const storedPrompts = localStorage.getItem("siteSpecificPrompts");
			if (storedPrompts) {
				const promptsObj = JSON.parse(storedPrompts);
				return promptsObj[hostname] || "";
			}
		} catch (error) {
			console.error("Error retrieving stored site prompt:", error);
		}
		return "";
	}

	// Get site identifier for the prompt UI
	getSiteIdentifier() {
		// Default implementation returns hostname
		return window.location.hostname;
	}
}
