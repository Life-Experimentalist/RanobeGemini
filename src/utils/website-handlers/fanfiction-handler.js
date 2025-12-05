/**
 * FanFiction.net Website Content Handler
 * Specialized handler for extracting content from fanfiction.net
 *
 * This is a PRIMARY handler - it defines the shelf display metadata in the library.
 * Handler Type: "chapter_embedded" - full novel metadata available on chapter pages
 */
import { BaseWebsiteHandler } from "./base-handler.js";
import { debugLog, debugError } from "../logger.js";

export class FanfictionHandler extends BaseWebsiteHandler {
	// Static properties for domain management
	// Explicitly supported domains (documented for clarity)
	// Wildcard at end acts as safety net for any unlisted subdomains
	static SUPPORTED_DOMAINS = [
		"fanfiction.net",
		"www.fanfiction.net",
		"*.fanfiction.net", // Safety net: catches any other subdomains (EXCEPT m.fanfiction.net - handled by mobile handler)
	];

	// Priority for auto-selection (lower number = earlier match)
	static PRIORITY = 20;

	// Shelf metadata for Novel Library - PRIMARY handler
	static SHELF_METADATA = {
		id: "fanfiction",
		isPrimary: true, // This is the primary handler for this shelf
		name: "FanFiction.net",
		icon: "https://www.fanfiction.net/static/icons3/ff-icon-192.png",
		emoji: "✍️",
		color: "#2a4b8d",
		novelIdPattern: /\/s\/(\d+)\//,
		primaryDomain: "www.fanfiction.net",
	};

	// Handler type: Full metadata available on chapter pages (no separate info page needed)
	static HANDLER_TYPE = "chapter_embedded";

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

	/**
	 * Check if current page is a chapter/story page (reading content)
	 * FanFiction.net URLs: /s/[story_id]/[chapter]/[story-name]
	 * @returns {boolean}
	 */
	isChapterPage() {
		const url = window.location.pathname;
		// Story pages have /s/ in the URL
		const isStoryUrl = /^\/s\/\d+/.test(url);
		// Also check for story content
		const hasStoryContent = !!document.getElementById("storytext");
		return isStoryUrl && hasStoryContent;
	}

	/**
	 * Check if current page is a work info page (not reading)
	 * For CHAPTER_EMBEDDED-type handlers like FanFiction.net, details are on the chapter page
	 * @returns {boolean}
	 */
	isNovelPage() {
		// FanFiction.net doesn't have separate novel info pages
		// All details are on the chapter page
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
			return `fanfiction-${match[1]}`;
		}

		// Fallback to URL hash
		const urlPath = new URL(url).pathname;
		const urlHash = btoa(urlPath)
			.substring(0, 16)
			.replace(/[^a-zA-Z0-9]/g, "");
		return `fanfiction-${urlHash}`;
	}

	/**
	 * Get the story details page URL from current page
	 * For FanFiction.net, the chapter page contains all details
	 * @returns {string}
	 */
	getNovelPageUrl() {
		// Extract story ID and return the base story URL (chapter 1)
		const match = window.location.href.match(/\/s\/(\d+)/);
		if (match) {
			return `https://www.fanfiction.net/s/${match[1]}/1/`;
		}
		return window.location.href;
	}

	/**
	 * Get novel controls configuration for FanFiction.net
	 * @returns {Object} Configuration for novel controls UI
	 */
	getNovelControlsConfig() {
		return {
			showControls: this.isChapterPage(),
			insertionPoint: this.getNovelPageUIInsertionPoint(),
			position: "after",
			isChapterPage: true,
			customStyles: {
				background: "linear-gradient(135deg, #1a2540 0%, #16213e 100%)",
				borderColor: "#2a4b8d",
				accentColor: "#4a7c9c",
			},
		};
	}

	/**
	 * Get insertion point for novel controls UI on FanFiction.net
	 * @returns {Object|null} { element, position } or null
	 */
	getNovelPageUIInsertionPoint() {
		// Insert after the profile_top (story info area)
		const profileTop = document.getElementById("profile_top");
		if (profileTop) {
			return { element: profileTop, position: "after" };
		}

		// Fallback to before story content
		const storyContent = document.getElementById("storytext");
		if (storyContent) {
			return { element: storyContent, position: "before" };
		}

		return null;
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
				debugLog(
					"FanFiction: Found storytext child div:",
					childDivs[0].id
				);
				return childDivs[0];
			}

			// Alternative: try finding by class name (the child has class "storytext")
			const storytextClassDivs =
				parentStorytextDiv.querySelectorAll("div.storytext[id]");
			if (storytextClassDivs.length > 0) {
				debugLog(
					"FanFiction: Found storytext via class:",
					storytextClassDivs[0].id
				);
				return storytextClassDivs[0];
			}

			// If no child found, use the parent (fallback)
			debugLog("FanFiction: Using parent storytext div");
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
				debugLog("FanFiction: #profile_top not found");
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
						debugLog(
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
						debugLog(
							"FanFiction: Found description via style:",
							text.substring(0, 100) + "..."
						);
						return text;
					}
				}
			}

			debugLog("FanFiction: No description found in #profile_top");
			return null;
		} catch (error) {
			debugError("FanFiction: Error extracting description:", error);
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
			debugError("FanFiction: Error extracting author:", error);
			return null;
		}
	}

	/**
	 * Extract metadata for novel library storage
	 * @returns {Object} Object containing title, author, description, coverUrl, and more
	 */
	extractNovelMetadata() {
		const metadata = {
			title: this.extractTitle(),
			author: this.extractAuthor(),
			description: this.extractDescription(),
			coverUrl: null,
			mainNovelUrl: this.getNovelPageUrl(), // Chapter 1 URL for chapter_embedded type
			genres: [],
			status: "unknown",
			totalChapters: 0,
			metadataIncomplete: false,
			metadata: {
				isCrossover: false,
				fandoms: [],
				characters: [],
				rating: null,
				language: null,
				words: 0,
				reviews: 0,
				favorites: 0,
				follows: 0,
				publishedDate: null,
				updatedDate: null,
				storyId: null,
			},
		};

		// Detect if this is a crossover based on URL
		const currentUrl = window.location.href;
		metadata.metadata.isCrossover = currentUrl.includes("/crossovers/");

		// Extract story ID from URL
		const storyIdMatch = currentUrl.match(/\/s\/(\d+)\//);
		if (storyIdMatch) {
			metadata.metadata.storyId = storyIdMatch[1];
		}

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
			debugError("FanFiction: Error extracting cover URL:", error);
		}

		// Extract additional metadata from profile
		try {
			const profileTop = document.getElementById("profile_top");
			if (profileTop) {
				// Extract fandom from breadcrumb - captures hierarchy like "Books > Harry Potter"
				// Format in HTML: <a href='/book/'>Books</a> <span>></span> <a href="/book/Harry-Potter/">Harry Potter</a>
				const fandomLinks =
					document.querySelectorAll("#pre_story_links a");
				if (fandomLinks.length > 0) {
					const fandoms = [];
					const fandomHierarchy = [];
					fandomLinks.forEach((link) => {
						const fandomText = link.textContent.trim();
						const href = link.getAttribute("href") || "";
						if (
							fandomText &&
							!fandomText.includes("FanFiction") &&
							!fandomText.includes("Crossover")
						) {
							fandoms.push(fandomText);
							// Capture the category from URL (e.g., /book/, /anime/, /tv/)
							const categoryMatch = href.match(
								/^\/(book|anime|cartoon|comic|game|misc|play|movie|tv)\//i
							);
							if (categoryMatch) {
								fandomHierarchy.push({
									category: categoryMatch[1],
									name: fandomText,
									url: href,
								});
							} else if (href.includes("/crossovers/")) {
								// It's a crossover
								fandomHierarchy.push({
									category: "crossover",
									name: fandomText,
									url: href,
								});
							} else {
								// Sub-fandom (e.g., Harry Potter under Books)
								fandomHierarchy.push({
									category: null,
									name: fandomText,
									url: href,
								});
							}
						}
					});
					metadata.metadata.fandoms = fandoms;
					metadata.metadata.fandomHierarchy = fandomHierarchy;
					// If more than one fandom after category, it's a crossover
					const actualFandoms = fandomHierarchy.filter(
						(f) =>
							f.category !== "book" &&
							f.category !== "anime" &&
							f.category !== "cartoon" &&
							f.category !== "comic" &&
							f.category !== "game" &&
							f.category !== "misc" &&
							f.category !== "play" &&
							f.category !== "movie" &&
							f.category !== "tv"
					);
					if (actualFandoms.length > 1) {
						metadata.metadata.isCrossover = true;
					}
					debugLog(
						"FanFiction: Extracted fandoms:",
						fandoms,
						"hierarchy:",
						fandomHierarchy
					);
				}

				// Extract info from the xgray span
				// Format: Rated: Fiction T - English - Romance/Adventure - Harry P., OC - Chapters: 14 - Words: 17,128 - Reviews: 3 - Favs: 12 - Follows: 4 - Published: 8/25/2011 - Status: Complete - id: 7322782
				const infoSpan = profileTop.querySelector(
					"span.xgray.xcontrast_txt"
				);
				if (infoSpan) {
					const infoText = infoSpan.textContent;
					debugLog("FanFiction: Raw metadata text:", infoText);

					// Extract rating - look for "Fiction K", "Fiction T", "Fiction M", "Fiction K+", etc.
					// Format in text: "Rated: Fiction  T" (may have extra spaces)
					const ratingMatch = infoText.match(
						/Fiction\s+([KTMA]\+?)/i
					);
					if (ratingMatch) {
						metadata.metadata.rating = ratingMatch[1].toUpperCase();
						debugLog(
							"FanFiction: Extracted rating:",
							metadata.metadata.rating
						);
					}

					// Parse the metadata segments more robustly
					// Split by " - " to get segments, accounting for spaces around dashes
					const segments = infoText
						.split(/\s+-\s+/)
						.map((s) => s.trim())
						.filter((s) => s.length > 0);
					debugLog("FanFiction: Metadata segments:", segments);

					// Segment 0 typically contains "Rated: Fiction T"
					// Segment 1 typically contains language (e.g., "English")
					// Segment 2 typically contains genres (e.g., "Romance/Adventure")
					// Remaining segments contain characters, chapters, words, etc.

					// Extract language from segment 1 (usually just the language name)
					if (segments.length > 1) {
						const langSegment = segments[1];
						// Language is usually a single word like "English", "Spanish", etc.
						if (
							/^[A-Za-z]+$/.test(langSegment) &&
							!langSegment.includes(":") &&
							langSegment.length < 20
						) {
							metadata.metadata.language = langSegment;
							debugLog(
								"FanFiction: Extracted language:",
								metadata.metadata.language
							);
						}
					}

					// Extract genres from segment 2 (usually Genre1/Genre2)
					// Note: Sometimes the metadata text has malformed segments where
					// "RomanceChapters: 30" appears without proper " - " separator
					if (segments.length > 2) {
						// Collect genre-looking segments until we hit a stat field
						const stopFields = [
							"chapters:",
							"words:",
							"reviews:",
							"favs:",
							"follows:",
							"published:",
							"updated:",
							"status:",
							"id:",
						];

						const genreSegments = [];
						for (let i = 2; i < segments.length; i++) {
							const segment = segments[i];
							const lower = segment.toLowerCase();

							// Stop once we reach stats-like segment
							const hitStopField = stopFields.find((field) =>
								lower.includes(field)
							);

							// Clean out any stats suffix that got glued to genre text
							const cleaned = segment
								.replace(/Chapters:.*/i, "")
								.replace(/Words:.*/i, "")
								.replace(/Reviews:.*/i, "")
								.replace(/Favs:.*/i, "")
								.replace(/Follows:.*/i, "")
								.replace(/Published:.*/i, "")
								.replace(/Updated:.*/i, "")
								.replace(/Status:.*/i, "")
								.replace(/id:.*/i, "")
								.trim();

							if (cleaned) {
								genreSegments.push(cleaned);
							}

							if (hitStopField) break;
						}

						const genreString = genreSegments.join("/");
						const genres = genreString
							.split(/[\/,&]/)
							.map((g) => g.trim())
							.filter(
								(g) =>
									g.length > 0 &&
									!g.match(/^\d/) &&
									!g.includes(":")
							);

						if (genres.length > 0) {
							metadata.genres = genres;
							debugLog(
								"FanFiction: Extracted genres:",
								metadata.genres
							);
						}
					}

					// Extract chapters - first try from metadata text
					const chaptersMatch = infoText.match(/Chapters:\s*(\d+)/i);
					if (chaptersMatch) {
						metadata.totalChapters = parseInt(chaptersMatch[1], 10);
						debugLog(
							"FanFiction: Extracted chapters from text:",
							metadata.totalChapters
						);
					}

					// Fallback: count options in chapter selector if no chapters found
					if (
						!metadata.totalChapters ||
						metadata.totalChapters === 0
					) {
						const chapSelect =
							document.getElementById("chap_select");
						if (chapSelect) {
							const options =
								chapSelect.querySelectorAll("option");
							if (options.length > 0) {
								metadata.totalChapters = options.length;
								debugLog(
									"FanFiction: Extracted chapters from selector:",
									metadata.totalChapters
								);
							}
						}
						// If still no chapters found, it's likely a one-shot
						if (
							!metadata.totalChapters ||
							metadata.totalChapters === 0
						) {
							metadata.totalChapters = 1;
							debugLog(
								"FanFiction: Assuming one-shot (single chapter)"
							);
						}
					}

					// Extract words
					const wordsMatch = infoText.match(/Words:\s*([\d,]+)/i);
					if (wordsMatch) {
						metadata.metadata.words = parseInt(
							wordsMatch[1].replace(/,/g, ""),
							10
						);
					}

					// Extract reviews
					const reviewsMatch = infoText.match(/Reviews:\s*([\d,]+)/i);
					if (reviewsMatch) {
						metadata.metadata.reviews = parseInt(
							reviewsMatch[1].replace(/,/g, ""),
							10
						);
					}

					// Extract favorites
					const favsMatch = infoText.match(/Favs:\s*([\d,]+)/i);
					if (favsMatch) {
						metadata.metadata.favorites = parseInt(
							favsMatch[1].replace(/,/g, ""),
							10
						);
					}

					// Extract follows
					const followsMatch = infoText.match(/Follows:\s*([\d,]+)/i);
					if (followsMatch) {
						metadata.metadata.follows = parseInt(
							followsMatch[1].replace(/,/g, ""),
							10
						);
					}

					// Normalize stats for UI consumption
					metadata.stats = {
						words: metadata.metadata.words,
						reviews: metadata.metadata.reviews,
						favorites: metadata.metadata.favorites,
						follows: metadata.metadata.follows,
					};

					// Extract published date from data-xutime attribute
					const publishedSpan =
						infoSpan.querySelector("span[data-xutime]");
					if (publishedSpan) {
						const timestamp =
							publishedSpan.getAttribute("data-xutime");
						if (timestamp) {
							metadata.metadata.publishedDate =
								parseInt(timestamp, 10) * 1000; // Convert to milliseconds
						}
					}

					// Detect status
					if (infoText.toLowerCase().includes("complete")) {
						metadata.status = "completed";
					} else {
						metadata.status = "ongoing";
					}

					// Extract characters - text between last genre and "Chapters:"
					// Pattern: "Romance/Adventure - Harry P., OC - Chapters:"
					const charactersMatch = infoText.match(
						/-\s*([A-Za-z\s.,]+(?:\[[^\]]+\])?[A-Za-z\s.,]*)\s*-\s*Chapters:/
					);
					if (charactersMatch) {
						let charText = charactersMatch[1].trim();
						// Filter out genres that might have been captured
						if (
							!charText.includes("/") &&
							!metadata.genres.includes(charText)
						) {
							const characters = charText
								.split(",")
								.map((c) => c.trim())
								.filter((c) => c.length > 0);
							metadata.metadata.characters = characters;
						}
					}

					// Also look for characters in brackets [Harry P., Hermione G.]
					const bracketCharsMatch = infoText.match(/\[([^\]]+)\]/g);
					if (bracketCharsMatch) {
						const characters = [];
						bracketCharsMatch.forEach((match) => {
							const charList = match
								.replace(/[\[\]]/g, "")
								.split(",")
								.map((c) => c.trim())
								.filter((c) => c.length > 0);
							characters.push(...charList);
						});
						if (characters.length > 0) {
							metadata.metadata.characters = characters;
						}
					}

					// Extract story ID from info text
					const idMatch = infoText.match(/id:\s*(\d+)/i);
					if (idMatch && !metadata.metadata.storyId) {
						metadata.metadata.storyId = idMatch[1];
					}
				}
			}
		} catch (error) {
			debugError(
				"FanFiction: Error extracting additional metadata:",
				error
			);
		}

		// Surface useful tags for card/modal rendering
		const combinedTags = new Set();
		(metadata.genres || []).forEach((g) => combinedTags.add(g));
		(metadata.metadata?.characters || []).forEach((c) =>
			combinedTags.add(c)
		);
		(metadata.metadata?.fandoms || []).forEach((f) => combinedTags.add(f));
		metadata.tags = Array.from(combinedTags);

		// Flag metadata that still needs a dedicated refresh
		metadata.metadataIncomplete =
			!metadata.totalChapters ||
			metadata.genres.length === 0 ||
			!metadata.author;

		// Validate that we're on a valid story page, not the home page
		if (!this.isChapterPage()) {
			debugLog(
				"FanFiction: Not on a valid story page, returning null metadata"
			);
			return null;
		}

		// Additional validation: check if we have essential metadata
		if (!metadata.title || metadata.title === "FanFiction") {
			debugLog(
				"FanFiction: Invalid metadata - likely on home/index page"
			);
			return null;
		}

		debugLog("FanFiction: Extracted metadata:", metadata);
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
			debugError("Error getting chapter navigation:", error);
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

		debugLog(
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
				debugLog(
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
			debugLog("FanFiction: Enhanced text contains HTML, parsing...");
			const tempDiv = document.createElement("div");
			tempDiv.innerHTML = enhancedText;

			// Extract text from all <p> tags
			const pTags = tempDiv.querySelectorAll("p");
			enhancedParagraphs = Array.from(pTags)
				.map((p) => p.textContent.trim())
				.filter((text) => text.length > 0);

			debugLog(
				`FanFiction: Extracted ${enhancedParagraphs.length} paragraphs from HTML`
			);
		} else {
			// Plain text - split on double newlines as paragraph boundaries
			debugLog(
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

		debugLog(
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
