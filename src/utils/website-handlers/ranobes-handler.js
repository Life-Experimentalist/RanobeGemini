/**
 * Ranobes.top Website Content Handler
 * Specialized handler for extracting content from ranobes.top
 */
import { BaseWebsiteHandler } from "./base-handler.js";

export class RanobesHandler extends BaseWebsiteHandler {
	// Static properties for domain management
	// Explicitly supported domains (documented for clarity)
	// Wildcards act as safety net for any unlisted subdomains
	static SUPPORTED_DOMAINS = [
		"ranobes.top",
		"ranobes.net",
		"ranobes.com",
		"*.ranobes.top",
		"*.ranobes.net", // Safety net: catches any other subdomains
		"*.ranobes.com",
	];

	// Shelf metadata for Novel Library
	static SHELF_METADATA = {
		id: "ranobes",
		name: "Ranobes",
		icon: "📖",
		color: "#4a7c4e",
		// Pattern matches: /novel-slug-123456/chapter.html or /novel-slug-123456/ or /read-123.html
		// Captures the ID number (123456 or 123) from the slug or read URL

		// OLD: /\/([a-z0-9-]+-\d+)\/|^\/read-(\d+)\.html/
		// This captured the whole slug including text
		// NEW: /\/[a-z0-9-]+-(\d+)(?:\/|$)|^\/read-(\d+)\.html/
		// This correctly captures ONLY the ID number
		novelIdPattern: /\/([a-z0-9-]+-\d+)\/|^\/read-(\d+)\.html/,
		primaryDomain: "ranobes.top",
	};

	static DEFAULT_SITE_PROMPT = `	// Get site-specific prompt enhancement
	getSiteSpecificPrompt() {
		return RanobesHandler.DEFAULT_SITE_PROMPT;
	}`;

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

	// Return true if this handler can handle the current website
	canHandle() {
		return (
			window.location.hostname.includes("ranobes.net") ||
			window.location.hostname.includes("ranobes.com") ||
			window.location.hostname.includes("ranobes.top")
		);
	}

	// Check if current page is a chapter page (not a listing/index page)
	isChapterPage() {
		// Check if URL contains chapter indicators
		if (
			window.location.pathname.includes("/chapter-") ||
			window.location.pathname.includes("/read-")
		) {
			return true;
		}

		// Check if page has content elements typical for chapter pages
		for (const selector of this.selectors.content) {
			const element = document.querySelector(selector);
			// Content element exists and has substantial text (not just a listing)
			if (element && element.innerText.trim().length > 1000) {
				return true;
			}
		}

		// Check if page has title elements typical for chapter pages
		for (const selector of this.selectors.title) {
			const titleElement = document.querySelector(selector);
			if (titleElement && titleElement.innerText.trim()) {
				// Check if the title indicates a chapter
				const titleText = titleElement.innerText.toLowerCase();
				if (
					titleText.includes("chapter") ||
					titleText.includes("volume")
				) {
					return true;
				}
			}
		}

		// Page doesn't match chapter page criteria
		return false;
	}

	// Find the content area on Ranobes
	findContentArea() {
		// Look for the main arrticle div (note: it's 'arrticle' not 'article' - ranobes typo)
		const contentElement = document.querySelector("#arrticle");
		if (contentElement) {
			console.log("Ranobes: Found #arrticle content area");
			return contentElement;
		}

		// Fallback to .text-chapter
		const textChapter = document.querySelector(".text-chapter");
		if (textChapter) {
			console.log("Ranobes: Found .text-chapter content area");
			return textChapter;
		}

		// Fallback to the base implementation
		console.log("Ranobes: Falling back to base handler");
		return super.findContentArea();
	}

	extractTitle() {
		// Try to find the title from the heading
		const heading = document.querySelector("h1.title");
		if (heading) {
			return heading.textContent.trim();
		}

		// Fallback to the default title extraction (page title)
		return document.title;
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

	// Get chapter navigation info (previous, next, current chapter number)
	getChapterNavigation() {
		try {
			// Try to find current chapter number
			const breadcrumbs = document.querySelector(".options-left");
			if (breadcrumbs) {
				const chapterText = breadcrumbs.textContent;
				const chapterMatch = chapterText.match(/Chapter (\d+)/i);

				// Try to find navigation links
				const prevLink = document.querySelector(".prev-chap");
				const nextLink = document.querySelector(".next-chap");

				if (chapterMatch) {
					const currentChapter = parseInt(chapterMatch[1], 10);
					return {
						hasPrevious: prevLink !== null,
						hasNext: nextLink !== null,
						currentChapter: currentChapter,
						totalChapters: 0, // Total unknown
					};
				}
			}
		} catch (error) {
			console.error("Error getting chapter navigation:", error);
		}

		// Fallback to default
		return super.getChapterNavigation();
	}

	// Get ideal insertion point for UI controls
	getUIInsertionPoint(contentArea) {
		// Look for .text div that wraps the #arrticle
		const textDiv = document.querySelector(".text");
		if (textDiv) {
			console.log("Ranobes: Inserting UI before .text div");
			return {
				element: textDiv,
				position: "before",
			};
		}

		// Look for story_tools div - we want to insert before it (after content, before tools)
		const storyTools = document.querySelector(".story_tools");
		if (storyTools) {
			console.log("Ranobes: Inserting UI before .story_tools");
			return {
				element: storyTools,
				position: "before",
			};
		}

		// Look for a better insertion point - we want to insert before the content
		// but after the title and possibly other elements
		const textChapter = document.querySelector(".text-chapter");
		if (textChapter) {
			console.log("Ranobes: Inserting UI before .text-chapter");
			return {
				element: textChapter,
				position: "before",
			};
		}

		// Fallback to default behavior (before article)
		console.log("Ranobes: Using default UI insertion point");
		return super.getUIInsertionPoint(contentArea);
	}

	// Format content after enhancement
	formatAfterEnhancement(contentArea) {
		// Apply site-specific styling for Ranobes
		if (contentArea) {
			// Use the site's own style for paragraphs
			contentArea.querySelectorAll("p").forEach((p) => {
				p.style.marginBottom = "1em";
				p.style.lineHeight = "1.7";
				p.style.color = "#bab9a0";
			});
		}
	}

	// Implement site-specific default prompt for Ranobes
	getDefaultPrompt() {
		return "This is a novel from Ranobes.top. Please maintain the author's style and any formatting features like section breaks, centered text, italics, etc. Respect any special formatting the author uses for dialogue, thoughts, flashbacks, or scene transitions, and in regards with any author notes please place them in a box and filter out any non plot related content in the author notes which may be placed at the beggining or at the end of the chapter. And then add breaks to signify the sepeation between author notes and actual chapter. Please improve the translation while maintaining the original meaning and flow. Keep any special formatting like section breaks. Korean, Japanese and Chinese names should be properly transliterated.";
	}

	// Get a readable site name for the UI
	getSiteIdentifier() {
		return "Ranobes.top";
	}

	// Get site-specific prompt for Ranobes
	getSiteSpecificPrompt() {
		return (
			"This is a novel from Ranobes.top." +
			"Please maintain the author's style and any formatting features like section breaks, centered text, italics, etc." +
			"Respect any special formatting the author uses for dialogue, thoughts, flashbacks, or scene transitions." +
			"In regards with any author notes please place them in a box and filter out any non plot related content in the author notes which may be placed at the beggining or at the end of the chapter" + " And then add breaks to signify the sepeation between author notes and actual chapter." +
			"Please improve the translation while maintaining the original meaning and flow." +
			"Keep any special formatting like section breaks. Korean, Japanese and Chinese names should be properly transliterated."
		);
	}

	/**
	 * Extract novel metadata for library storage
	 * Works on both chapter pages and main novel pages
	 * @returns {Object} Object containing title, author, description, coverUrl
	 */
	extractNovelMetadata() {
		const metadata = {
			title: null,
			author: null,
			description: null,
			coverUrl: null,
			mainNovelUrl: null,
		};

		try {
			const isChapterPage = this.isChapterPage();

			// Extract novel title (clean, without chapter info)
			if (isChapterPage) {
				// On chapter pages, try breadcrumbs first
				const breadcrumbLinks =
					document.querySelectorAll("#dle-speedbar a");
				if (breadcrumbLinks.length >= 2) {
					// Get the novel link (second breadcrumb)
					const novelLink = breadcrumbLinks[1];
					metadata.title = novelLink.textContent.trim();
					metadata.mainNovelUrl = novelLink.href;
				}

				// Fallback: Extract from page title
				if (!metadata.title) {
					const titleMatch = document.title.match(
						/(.+?)\s*[|\-]\s*Chapter/i
					);
					if (titleMatch) {
						metadata.title = titleMatch[1].trim();
					}
				}

				// Clean up title - remove "# Chapter X" pattern if present
				if (metadata.title) {
					metadata.title = metadata.title
						.replace(/\s*#\s*Chapter\s*\d+\s*$/i, "")
						.trim();
				}

				// Extract description from meta tag on chapter page
				const descMeta = document.querySelector(
					'meta[name="description"]'
				);
				if (descMeta) {
					let desc = descMeta.getAttribute("content")?.trim();
					// Clean up chapter-specific description pattern
					if (desc) {
						// Remove "Novel Title #Chapter X" pattern from start
						desc = desc
							.replace(/^.+?#Chapter\s*\d+\s*/i, "")
							.trim();
						if (desc && desc.length > 20) {
							metadata.description =
								desc.length > 500
									? desc.substring(0, 500) + "..."
									: desc;
						}
					}
				}
			} else {
				// On main novel pages
				const titleSelectors = [
					"h1.entry-title",
					"h1.title",
					".post-title h1",
					'meta[property="og:title"]',
				];

				for (const selector of titleSelectors) {
					const el = document.querySelector(selector);
					if (el) {
						metadata.title = selector.includes("meta")
							? el.getAttribute("content")?.trim()
							: el.textContent.trim();
						if (metadata.title) break;
					}
				}

				// Extract full description from main page
				const descSelectors = [
					'meta[name="description"]',
					'meta[property="og:description"]',
					".summary",
					".entry-content p:first-of-type",
					".synopsis",
					".novel-description",
				];

				for (const selector of descSelectors) {
					const el = document.querySelector(selector);
					if (el) {
						if (selector.includes("meta")) {
							metadata.description = el
								.getAttribute("content")
								?.trim();
						} else {
							const text = el.textContent.trim();
							metadata.description =
								text.length > 500
									? text.substring(0, 500) + "..."
									: text;
						}
						if (metadata.description) break;
					}
				}
			}

			// Extract author
			const authorSelectors = [
				'.info_line a[href*="/author/"]',
				'.tag_list[itemprop="creator"]',
				".author-name",
				".entry-author a",
				'meta[name="author"]',
				'a[rel="author"]',
			];

			for (const selector of authorSelectors) {
				const el = document.querySelector(selector);
				if (el) {
					metadata.author = selector.includes("meta")
						? el.getAttribute("content")?.trim()
						: el.textContent.trim();
					if (metadata.author) break;
				}
			}

			// Extract cover image
			const coverSelectors = [
				'meta[property="og:image"]',
				".post-thumbnail img",
				".novel-cover img",
				".entry-thumb img",
				"img.cover",
				"article img:first-of-type",
			];

			for (const selector of coverSelectors) {
				const el = document.querySelector(selector);
				if (el) {
					const src = selector.includes("meta")
						? el.getAttribute("content")
						: el.getAttribute("src");

					if (
						src &&
						!src.includes("default") &&
						!src.includes("placeholder")
					) {
						// Make absolute URL
						try {
							metadata.coverUrl = new URL(
								src,
								window.location.href
							).href;
							break;
						} catch (e) {
							// Invalid URL, skip
						}
					}
				}
			}
		} catch (error) {
			console.error("Ranobes: Error extracting metadata:", error);
		}

		console.log("Ranobes: Extracted metadata:", metadata);
		return metadata;
	}
}

// Default export
export default new RanobesHandler();
