/**
 * Ranobes.top Website Content Handler
 * Specialized handler for extracting content from ranobes.top
 */
import { BaseWebsiteHandler } from "./base-handler.js";

export class RanobesHandler extends BaseWebsiteHandler {
	constructor() {
		super();
		this.selectors = {
			content: [
				"#arrticle", // Ranobes.top specific main content area
				".text-chapter",
				".story",
			],
			title: ["h1.title", ".story-title", ".chapter-title"],
		};
	}

	canHandle() {
		return window.location.hostname.includes("ranobes");
	}

	findContentArea() {
		// Try each content selector
		for (const selector of this.selectors.content) {
			const element = document.querySelector(selector);
			if (element) {
				console.log(
					`Ranobes: Content area found using selector: ${selector}`
				);
				return element;
			}
		}

		// Fallback method
		const storyContainer = document.querySelector(".story");
		if (storyContainer) {
			console.log("Ranobes: Found story container via fallback method");
			return storyContainer;
		}

		return null;
	}

	extractTitle() {
		// Try each title selector
		for (const selector of this.selectors.title) {
			const titleElement = document.querySelector(selector);
			if (titleElement && titleElement.innerText.trim()) {
				return titleElement.innerText.trim();
			}
		}

		// Fallback to document title
		return document.title || "Unknown Title";
	}

	extractContent() {
		const contentArea = this.findContentArea();
		if (!contentArea) {
			return {
				found: false,
				title: "",
				text: "",
				selector: "",
			};
		}

		const chapterTitle = this.extractTitle();
		let sourceSelector = "";

		// Create a deep clone to prevent modifying the actual DOM
		const contentClone = contentArea.cloneNode(true);

		// Remove title elements from the content if they exist
		const titlesToRemove = contentClone.querySelectorAll(
			"h1, h2, h3.title, .story-title, .chapter-title"
		);
		titlesToRemove.forEach((title) => {
			title.remove();
		});

		// Get clean text content
		let chapterText = contentClone.innerText
			.trim()
			.replace(/\n\s+/g, "\n") // Preserve paragraph breaks but remove excess whitespace
			.replace(/\s{2,}/g, " "); // Replace multiple spaces with a single space

		// Additional cleaning - check the first few lines for titles
		const titleParts = chapterTitle.split(/[:\-–—]/);
		const lines = chapterText.split("\n");
		const headLines = lines.slice(0, 5); // Only look at first 5 lines
		const filteredHeadLines = headLines.filter((line) => {
			const trimmedLine = line.trim();
			// Skip empty lines
			if (trimmedLine === "") return true;

			// Check if line is just the title or part of the title
			for (const titlePart of titleParts) {
				const cleanTitlePart = titlePart.trim();
				if (
					cleanTitlePart.length > 3 && // Avoid filtering out lines with short matches
					(trimmedLine === cleanTitlePart ||
						trimmedLine.startsWith(`${cleanTitlePart}:`) ||
						trimmedLine.startsWith(`${cleanTitlePart} -`))
				) {
					return false;
				}
			}

			// Check for common book name patterns at the start of content
			if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmedLine)) {
				return false;
			}

			return true;
		});

		// Recombine the filtered head lines with the rest of the content
		chapterText = [...filteredHeadLines, ...lines.slice(5)].join("\n");

		return {
			found: true,
			title: chapterTitle,
			text: chapterText,
			selector: sourceSelector || "ranobes-handler",
		};
	}

	getChapterNavigation() {
		// Try to find previous and next chapter links
		const prevLink = document.querySelector(
			'.chapter-nav a.prev, a[rel="prev"]'
		);
		const nextLink = document.querySelector(
			'.chapter-nav a.next, a[rel="next"]'
		);

		// Try to determine current chapter from URL or breadcrumbs
		let currentChapter = 1;
		let totalChapters = 1;

		// Attempt to extract chapter number from URL
		const chapterMatch = window.location.pathname.match(/chapter-(\d+)/i);
		if (chapterMatch && chapterMatch[1]) {
			currentChapter = parseInt(chapterMatch[1], 10);
		}

		return {
			hasPrevious: !!prevLink,
			hasNext: !!nextLink,
			currentChapter,
			totalChapters,
		};
	}
}

// Default export
export default new RanobesHandler();
