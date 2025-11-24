/**
 * Archive of Our Own (AO3) Website Content Handler
 * Specialized handler for extracting content from archiveofourown.org
 */
import { BaseWebsiteHandler } from "./base-handler.js";

export class AO3Handler extends BaseWebsiteHandler {
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

	// Find the content area on AO3
	findContentArea() {
		console.log("AO3: Looking for content area...");

		// AO3's main chapter content is in div.userstuff.module with role="article"
		const mainContent = document.querySelector(
			'div.userstuff.module[role="article"]'
		);
		if (mainContent) {
			console.log("AO3: Found main chapter content with role=article");
			return mainContent;
		}

		// Alternative: look for userstuff module inside chapters div
		const chaptersContent = document.querySelector(
			"#chapters .userstuff.module"
		);
		if (chaptersContent) {
			console.log("AO3: Found chapter content in #chapters");
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
			console.log("AO3: Found general userstuff module");
			return module;
		}

		// Fallback to base implementation
		console.log("AO3: Falling back to base handler");
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
				".chapter.preface h3.title"
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
			console.error("Error getting AO3 chapter navigation:", error);
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
				document.querySelectorAll(".warning.tags a.tag")
			).map((tag) => tag.textContent.trim());
			if (warnings.length > 0) {
				metadata.warnings = warnings;
			}

			// Get relationships
			const relationships = Array.from(
				document.querySelectorAll(".relationship.tags a.tag")
			).map((tag) => tag.textContent.trim());
			if (relationships.length > 0) {
				metadata.relationships = relationships;
			}

			// Get characters
			const characters = Array.from(
				document.querySelectorAll(".character.tags a.tag")
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
			const beginNotes = document.querySelector(
				"#notes .userstuff"
			);
			if (beginNotes) {
				metadata.beginNotes = beginNotes.textContent.trim();
			}

			// Get end notes
			const endNotes = document.querySelector("#endnotes .userstuff");
			if (endNotes) {
				metadata.endNotes = endNotes.textContent.trim();
			}
		} catch (error) {
			console.error("Error extracting AO3 metadata:", error);
		}

		return metadata;
	}

	// Get the best insertion point for UI elements
	getUIInsertionPoint() {
		console.log("AO3: Finding UI insertion point...");

		// Best place is before the chapter content, after chapter preface
		const chapterPreface = document.querySelector(".chapter.preface");
		if (chapterPreface) {
			console.log("AO3: Inserting after chapter preface");
			return {
				element: chapterPreface,
				position: "afterend",
			};
		}

		// Alternative: before the work content
		const workContent = document.querySelector("#workskin");
		if (workContent) {
			console.log("AO3: Inserting at start of workskin");
			return {
				element: workContent,
				position: "afterbegin",
			};
		}

		// Fallback to before content area
		const contentArea = this.findContentArea();
		if (contentArea) {
			console.log("AO3: Inserting before content area");
			return {
				element: contentArea,
				position: "beforebegin",
			};
		}

		// Final fallback
		console.log("AO3: Using base UI insertion point");
		return super.getUIInsertionPoint();
	}

	// Extract content with proper formatting
	extractContent() {
		console.log("AO3: Extracting content...");

		const contentArea = this.findContentArea();
		if (!contentArea) {
			console.error("AO3: Could not find content area");
			return {
				found: false,
				reason: "Could not locate chapter content on this AO3 page.",
			};
		}

		// Get the title
		const title = this.extractTitle();
		console.log("AO3: Extracted title:", title);

		// Clone the content to avoid modifying the original
		const contentClone = contentArea.cloneNode(true);

		// Remove any script tags
		const scripts = contentClone.querySelectorAll("script");
		scripts.forEach((script) => script.remove());

		// Get text content with preserved structure
		let content = contentClone.innerHTML.trim();

		// Get metadata
		const metadata = this.getWorkMetadata();
		const navigation = this.getChapterNavigation();

		console.log("AO3: Content extracted successfully");
		console.log("AO3: Content length:", content.length, "characters");

		return {
			found: true,
			title: title,
			content: content,
			contentArea: contentArea,
			metadata: metadata,
			navigation: navigation,
			wordCount: this.countWords(content),
		};
	}

	// Count words in HTML content
	countWords(content) {
		// Remove HTML tags and count words
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = content;
		const text = tempDiv.textContent || tempDiv.innerText || "";
		const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
		return words.length;
	}

	// Get site-specific prompt enhancement
	getSiteSpecificPrompt() {
		return `This content is from Archive of Our Own (AO3), a popular fanfiction archive.
Please maintain:
- Proper paragraph breaks and formatting
- Author's notes markers (if present)
- Scene breaks and dividers
- Any special formatting like italics or bold for emphasis
- Preserve the narrative flow and pacing
When enhancing, improve readability while respecting the author's original style and voice.`;
	}
}

export default AO3Handler;
