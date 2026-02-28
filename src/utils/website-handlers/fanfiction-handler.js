/**
 * FanFiction.net Website Content Handler
 * Specialized handler for extracting content from fanfiction.net
 *
 * This is a PRIMARY handler - it defines the shelf display metadata in the library.
 * Handler Type: "chapter_embedded" - full novel metadata available on chapter pages
 */
import { BaseWebsiteHandler } from "./base-handler.js";
import { debugLog, debugError } from "../logger.js";
import { SITE_SETTINGS_KEY } from "../site-settings.js";
import {
	formatNovelInfo,
	DEFAULT_EPUB_TEMPLATE,
} from "../novel-copy-format.js";

export class FanfictionHandler extends BaseWebsiteHandler {
	// Static properties for domain management
	// Explicitly supported domains (documented for clarity)
	// Wildcard at end acts as safety net for any unlisted subdomains
	static SUPPORTED_DOMAINS = [
		"fanfiction.net",
		"www.fanfiction.net",
		"www.fanfiction.ws",
		"*.fanfiction.net", // Safety net: catches any other subdomains (EXCEPT m.fanfiction.net - handled by mobile handler)
	];

	static DEFAULT_ENABLED = true;

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
		// Modular taxonomy definition for library filtering
		taxonomy: [
			{ id: "fandoms", label: "Fandoms", type: "array" },
			{ id: "genres", label: "Genres", type: "array" },
			{
				id: "characters",
				label: "Characters",
				type: "array",
				unique: true,
			},
			{ id: "tags", label: "Tags", type: "array" },
		],
	};

	// Handler type: Full metadata available on chapter pages (no separate info page needed)
	static HANDLER_TYPE = "chapter_embedded";

	/** Configurable settings exposed in the Library Settings page. */
	static SETTINGS_DEFINITION = {
		fields: [
			// ── Navigation ────────────────────────────────────────────────────
			{ key: "_nav", type: "section", label: "🔀 Navigation" },
			{
				key: "domainPreference",
				label: "Domain Preference",
				type: "select",
				defaultValue: "auto",
				description:
					"How to handle bare domain (fanfiction.net) visits.",
				options: [
					{ value: "auto", label: "Auto (device-based)" },
					{ value: "www", label: "Desktop (www)" },
					{ value: "mobile", label: "Mobile (m)" },
				],
			},
			{
				key: "preferredTld",
				label: "Preferred TLD",
				type: "select",
				defaultValue: "net",
				description: "TLD to use when opening FanFiction URLs.",
				options: [
					{ value: "net", label: "fanfiction.net (default)" },
					{ value: "ws", label: "fanfiction.ws" },
				],
			},
			{
				key: "showVersionSwitcher",
				label: "Show Mobile ⇔ Desktop switcher",
				type: "toggle",
				defaultValue: true,
				description:
					"Show a quick-switch button in chapter controls to jump between mobile and desktop views.",
			},
			// ── Enhancement ────────────────────────────────────────────────
			{ key: "_enhance", type: "section", label: "✨ Enhancement" },
			{
				key: "autoEnhanceEnabled",
				label: "Auto-enhance chapters",
				type: "toggle",
				defaultValue: false,
				description:
					"Automatically run Enhance when a FanFiction.net chapter loads.",
			},
			// ── Download & Export ────────────────────────────────────────
			{
				key: "_download",
				type: "section",
				label: "⬇️ Download & Export",
			},
			{
				key: "downloadEnabled",
				label: "Show download button",
				type: "toggle",
				defaultValue: true,
				description:
					"Show a FichHub download button in chapter controls.",
			},
			{
				key: "copyEpubOnDownload",
				label: "Copy .epub filename on download",
				type: "toggle",
				defaultValue: true,
				description:
					"Automatically copy the formatted epub filename to clipboard when Download is clicked.",
			},
			{
				key: "epubTemplate",
				label: "Epub filename template",
				type: "text",
				defaultValue: "",
				placeholder: "{titleSafe} - {authorSafe}.epub",
				description:
					"Filename template for this site. Available tokens: {titleSafe}, {authorSafe}, {title}, {author}, {id}. Leave blank to use the global epub template.",
			},
		],
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

	/**
	 * Normalize FanFiction.net URL - redirect bare domain to preferred subdomain
	 * Implements BaseWebsiteHandler.normalizeURL() for instant redirects
	 * @static
	 * @async
	 * @returns {Promise<boolean>} True if redirect occurred, false otherwise
	 */
	static async normalizeURL() {
		try {
			const { hostname, pathname, search, hash } = window.location;
			const isFanfictionHost =
				hostname.endsWith("fanfiction.net") ||
				hostname.endsWith("fanfiction.ws");
			const isMobile =
				/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
				window.innerWidth <= 768;

			// Only process if on a FanFiction domain that needs normalization
			if (!isFanfictionHost) {
				return false;
			}

			// Get stored domain preference
			let preference = "www"; // Default to www
			let preferredTld = "net"; // Default to .net
			try {
				const result =
					await browser.storage.local.get(SITE_SETTINGS_KEY);
				const settings = result?.[SITE_SETTINGS_KEY] || {};
				const fanfictionSettings = settings?.fanfiction || {};
				preference = fanfictionSettings.domainPreference || "www";
				preferredTld = fanfictionSettings.preferredTld
					? fanfictionSettings.preferredTld
					: fanfictionSettings.convertWsToNet === false
						? "ws"
						: "net";
			} catch (storageErr) {
				debugError("Failed to load domain preference:", storageErr);
				// Use defaults
			}

			const normalizedPreferredTld = preferredTld === "ws" ? "ws" : "net";
			const tldOrder =
				normalizedPreferredTld === "ws" ? ["ws", "net"] : ["net", "ws"];

			// Resolve target subdomain based on preference
			let targetSubdomain;
			switch (preference) {
				case "mobile":
				case "m":
					targetSubdomain = "m";
					break;
				case "desktop":
				case "www":
					targetSubdomain = "www";
					break;
				default:
					targetSubdomain = isMobile ? "m" : "www";
			}

			const isUrlReachable = async (url) => {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => {
					controller.abort();
				}, 2500);
				try {
					await fetch(url, {
						method: "GET",
						mode: "no-cors",
						cache: "no-store",
						signal: controller.signal,
					});
					return true;
				} catch (_err) {
					return false;
				} finally {
					clearTimeout(timeoutId);
				}
			};

			for (const tld of tldOrder) {
				const targetHost = `${targetSubdomain}.fanfiction.${tld}`;
				if (hostname === targetHost) {
					return false;
				}
				const targetURL = `https://${targetHost}${pathname}${search}${hash}`;
				const reachable = await isUrlReachable(targetURL);
				if (reachable) {
					debugLog(
						`FanFiction URL normalization: ${hostname} -> ${targetHost}`,
					);
					window.location.replace(targetURL);
					return true;
				}
			}

			return false;
		} catch (err) {
			debugError("FanFiction URL normalization error:", err);
			return false;
		}
	}

	// Legacy initialize method - now calls normalizeURL
	static initialize() {
		// Redirect to new async normalizeURL method
		this.normalizeURL().catch((err) => {
			debugError("FanFiction initialization error:", err);
		});
	}

	constructor() {
		super();
		this.enhancementMode = "text-only"; // indicates we replace only paragraph text, preserving original DOM/styles
	}

	// Return true if this handler can handle the current website
	canHandle() {
		const hostname = window.location.hostname;
		const path = window.location.pathname;
		// Exclude mobile version (m.fanfiction.net)
		if (hostname === "m.fanfiction.net") {
			return false;
		}
		if (path.startsWith("/u/")) {
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
		if (url.startsWith("/u/")) return false;
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

	/**
	 * Get chapter control buttons: version switcher + FichHub download.
	 * Both buttons are controlled by site settings; async to read preferences.
	 * @returns {Promise<Array>} Resolves to array of button spec objects
	 */
	async getCustomChapterButtons() {
		if (!this.isChapterPage()) return [];

		const hostname = window.location.hostname;
		const isMobile =
			hostname === "m.fanfiction.net" || hostname === "m.fanfiction.ws";
		const isFFSite =
			hostname.includes("fanfiction.net") ||
			hostname.includes("fanfiction.ws");
		if (!isFFSite) return [];

		// Read site settings once at button-creation time
		let siteConf = {};
		try {
			const result = await browser.storage.local.get(SITE_SETTINGS_KEY);
			siteConf = result?.[SITE_SETTINGS_KEY]?.fanfiction || {};
		} catch (_) {
			// Use defaults (all features on)
		}

		const buttons = [];

		// ── Version switcher (on by default) ──────────────────────────────────
		if (siteConf.showVersionSwitcher !== false) {
			buttons.push({
				text: isMobile ? "Desktop" : "Mobile",
				emoji: isMobile ? "🖥️" : "📱",
				color: "#5a9fd4",
				onClick: () => {
					const url = window.location.href;
					if (isMobile) {
						window.location.href = url.replace(
							"m.fanfiction",
							"www.fanfiction",
						);
					} else {
						window.location.href = url.replace(
							/(?:www\.)?fanfiction\.net/,
							"m.fanfiction.net",
						);
					}
				},
			});
		}

		// ── FichHub download (on by default) ────────────────────────────────
		if (siteConf.downloadEnabled !== false) {
			const template =
				siteConf.epubTemplate?.trim() || DEFAULT_EPUB_TEMPLATE;
			const copyEnabled = siteConf.copyEpubOnDownload !== false;

			buttons.push({
				text: "FichHub",
				emoji: "⬇️",
				color: "#ff6b6b",
				onClick: async () => {
					if (copyEnabled) {
						try {
							const title = this.extractTitle();
							const author = this.extractAuthor();
							const storyId =
								window.location.href.match(/\/s\/(\d+)/)?.[1] ||
								"";
							const text = formatNovelInfo(
								{
									title,
									author,
									shelfId: "fanfiction",
									id: `fanfiction-${storyId}`,
								},
								template,
							);
							if (text) await navigator.clipboard.writeText(text);
						} catch (_) {
							// clipboard copy not critical
						}
					}
					window.open(
						`https://fichub.net/?b=1&q=${encodeURIComponent(window.location.href)}`,
						"_blank",
					);
				},
			});
		}

		return buttons;
	}

	/**
	 * Version switcher is now in getCustomChapterButtons(), so this method
	 * intentionally returns an empty array.
	 * @returns {Array}
	 */
	getSiteSpecificEnhancements() {
		return [];
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
				'div[id^="storytext"]:not(#storytext)',
			);
			if (childDivs.length > 0) {
				debugLog(
					"FanFiction: Found storytext child div:",
					childDivs[0].id,
				);
				return childDivs[0];
			}

			// Alternative: try finding by class name (the child has class "storytext")
			const storytextClassDivs =
				parentStorytextDiv.querySelectorAll("div.storytext[id]");
			if (storytextClassDivs.length > 0) {
				debugLog(
					"FanFiction: Found storytext via class:",
					storytextClassDivs[0].id,
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
							text.substring(0, 100) + "...",
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
							text.substring(0, 100) + "...",
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
				"a.xcontrast_txt[href^='/u/']",
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
	 * Extract metadata from enhanced HTML structure (Better Fiction plugin, etc.)
	 * Enhanced structure uses separate spans: .ratedmeta, .languagemeta, .genremeta, .charactersmeta, .statusmeta
	 * @returns {Object|null} Object with enhanced metadata or null if structure not found
	 */
	extractEnhancedMetadata() {
		try {
			const profileTop = document.getElementById("profile_top");
			if (!profileTop) {
				return null;
			}

			// Check if enhanced structure exists
			const ratedMeta = profileTop.querySelector(".ratedmeta");
			if (!ratedMeta) {
				// Not enhanced structure
				return null;
			}

			const enhanced = {};

			// Extract rating from .ratedmeta
			const ratedText = ratedMeta.textContent?.trim() || "";
			const ratingMatch = ratedText.match(
				/Rated:\s*(?:Fiction\s+)?([A-Z](?:\+)?)/i,
			);
			if (ratingMatch) {
				enhanced.rating = ratingMatch[1].toUpperCase();
				debugLog("FanFiction Enhanced: Rating:", enhanced.rating);
			}

			// Extract language from .languagemeta
			const languageMeta = profileTop.querySelector(".languagemeta");
			if (languageMeta) {
				const langText = languageMeta.textContent?.trim() || "";
				// Remove "Language:" prefix if present
				const cleanLang = langText.replace(/^Language:\s*/i, "").trim();
				if (cleanLang && /^[A-Za-z]+$/.test(cleanLang)) {
					enhanced.language = cleanLang;
					debugLog(
						"FanFiction Enhanced: Language:",
						enhanced.language,
					);
				}
			}

			// Extract genres from .genremeta
			const genreMeta = profileTop.querySelector(".genremeta");
			if (genreMeta) {
				const genreText = genreMeta.textContent?.trim() || "";
				// Remove "Genre:" prefix if present
				const cleanGenre = genreText.replace(/^Genre:\s*/i, "").trim();
				if (cleanGenre) {
					const genres = cleanGenre
						.split("/")
						.map((g) => g.trim())
						.filter((g) => g.length > 0 && !g.match(/^\d/));
					if (genres.length > 0) {
						enhanced.genres = genres;
						debugLog(
							"FanFiction Enhanced: Genres:",
							enhanced.genres,
						);
					}
				}
			}

			// Extract status from .statusmeta
			const statusMeta = profileTop.querySelector(".statusmeta");
			if (statusMeta) {
				const statusText = statusMeta.textContent?.trim() || "";
				if (statusText.toLowerCase().includes("complete")) {
					enhanced.status = "completed";
				} else {
					enhanced.status = "ongoing";
				}
				debugLog("FanFiction Enhanced: Status:", enhanced.status);
			}

			// Extract chapters from .chaptersmeta
			const chaptersMeta = profileTop.querySelector(".chaptersmeta");
			if (chaptersMeta) {
				const chaptersText = chaptersMeta.textContent?.trim() || "";
				const chaptersMatch = chaptersText.match(/(\d+)/);
				if (chaptersMatch) {
					enhanced.totalChapters = parseInt(chaptersMatch[1], 10);
					debugLog(
						"FanFiction Enhanced: Chapters:",
						enhanced.totalChapters,
					);
				}
			}

			// Extract words from .wordsmeta
			const wordsMeta = profileTop.querySelector(".wordsmeta");
			if (wordsMeta) {
				const wordsText = wordsMeta.textContent?.trim() || "";
				const wordsMatch = wordsText.match(/([\d,]+)/);
				if (wordsMatch) {
					enhanced.words = parseInt(
						wordsMatch[1].replace(/,/g, ""),
						10,
					);
					debugLog("FanFiction Enhanced: Words:", enhanced.words);
				}
			}

			// Extract characters from .charactersmeta
			const charactersMeta = profileTop.querySelector(".charactersmeta");
			if (charactersMeta) {
				const charsText = charactersMeta.textContent?.trim() || "";
				// Remove "Characters:" prefix if present
				cleanChars = charsText.replace(/^Characters:\s*/i, "").trim();
				if (cleanChars) {
					const allCharacters = new Set();
					const relationships = [];

					// Extract relationship brackets first [Harry P., Hermione G., etc.]
					const bracketMatches = cleanChars.match(/\[([^\]]+)\]/g);
					if (bracketMatches) {
						bracketMatches.forEach((bracket) => {
							const insideBracket = bracket
								.replace(/[[\]]/g, "")
								.trim();
							const charsInBracket = insideBracket
								.split(",")
								.map((c) => c.trim())
								.filter((c) => c.length > 0)
								.slice(0, 4);

							// Store relationship group (with 2+ characters)
							if (charsInBracket.length >= 2) {
								relationships.push(charsInBracket);
							}

							// Add individual characters from the bracket
							charsInBracket.forEach((c) => allCharacters.add(c));
						});

						// Remove brackets from section to process remaining characters
						cleanChars = cleanChars.replace(/\[[^\]]+\]/g, "");
					}

					// Extract remaining non-bracketed characters
					const remainingChars = cleanChars
						.split(",")
						.map((c) => c.trim())
						.filter((c) => c.length > 0 && c !== "-");

					remainingChars.forEach((c) => {
						if (c) allCharacters.add(c);
					});

					if (allCharacters.size > 0) {
						enhanced.characters = [...allCharacters];
						if (relationships.length > 0) {
							enhanced.relationships = relationships;
						}
						debugLog(
							"FanFiction Enhanced: Characters:",
							[...allCharacters],
							"relationships:",
							relationships,
						);
					}
				}
			}

			// Return the enhanced metadata object
			return Object.keys(enhanced).length > 0 ? enhanced : null;
		} catch (error) {
			debugError(
				"FanFiction: Error extracting enhanced metadata:",
				error,
			);
			return null;
		}
	}

	/**
	 * Get custom chapter page control buttons for FanFiction.net
	 * Adds a download button for FichHub integration
	 * Opens in new tab and optionally copies metadata to clipboard
	 * @returns {Array} Array of button specifications
	 */
	getCustomChapterButtons() {
		return [
			{
				text: "Download",
				emoji: "⬇️",
				color: "#ff6b6b",
				onClick: () => {
					// Get library settings to check if clipboard copy is enabled
					try {
						const settingsJson = localStorage.getItem(
							"rg_library_settings",
						);
						const settings = settingsJson
							? JSON.parse(settingsJson)
							: {};
						const enableClipboard =
							settings.enableClipboardCopyOnDownload !== false;

						if (enableClipboard) {
							const clipboardText = this.generateClipboardText();
							if (clipboardText) {
								navigator.clipboard
									.writeText(clipboardText)
									.catch(() => {
										console.log(
											"Could not copy to clipboard",
										);
									});
							}
						}
					} catch (error) {
						console.warn(
							"Error checking clipboard setting:",
							error,
						);
					}

					// FichHub download bookmarklet - open in new tab
					const url = `https://fichub.net/?b=1&q=${encodeURIComponent(window.location.href)}`;
					window.open(url, "_blank");
				},
			},
		];
	}

	/**
	 * Generate clipboard text in format: "Title" by Author StoryId.epub
	 * @returns {string|null} Formatted text or null if unable to generate
	 */
	generateClipboardText() {
		try {
			const title = this.extractTitle();
			const author = this.extractAuthor();
			const storyId = window.location.href.match(/\/s\/(\d+)/)?.[1];

			if (!title || !author || !storyId) {
				return null;
			}

			return `"${title}" by ${author} ${storyId}.epub`;
		} catch (error) {
			console.error("Error generating clipboard text:", error);
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

		// Detect if this is a crossover based on URL (initial check, will be refined below)
		const currentUrl = window.location.href;
		let isCrossoverDetected = currentUrl.includes("/crossovers/");

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
				// ============================================================
				// CROSSOVER DETECTION - Based on FanFiction.net HTML structure
				// ============================================================
				// Crossover format: <a href="/X_and_Y_Crossovers/...">Fandom1 + Fandom2 Crossover</a>
				// Single fandom format: <a href="/book/">Books</a> > <a href="/book/Harry-Potter/">Harry Potter</a>

				const preStoryLinks =
					document.getElementById("pre_story_links");
				const lcLeft =
					preStoryLinks?.querySelector(".lc-left") || preStoryLinks;

				if (lcLeft) {
					const allLinks = lcLeft.querySelectorAll("a");
					const fandoms = [];
					const fandomHierarchy = [];

					// Check each link for crossover pattern
					for (const link of allLinks) {
						const linkText = link.textContent.trim();
						const href = link.getAttribute("href") || "";

						// Skip FanFiction home link
						if (
							linkText === "FanFiction" ||
							href === "/" ||
							href === ""
						)
							continue;

						// CROSSOVER DETECTION: Look for "X + Y Crossover" pattern in link text
						// Example: "Ben 10 + My Hero Academia Crossover"
						const crossoverMatch = linkText.match(
							/^(.+?)\s*\+\s*(.+?)\s+Crossover$/i,
						);
						if (
							crossoverMatch ||
							href.includes("/crossovers/") ||
							(href.includes("_and_") &&
								href.includes("_Crossovers"))
						) {
							isCrossoverDetected = true;

							// Extract both fandom names from the crossover link
							if (crossoverMatch) {
								const fandom1 = crossoverMatch[1].trim();
								const fandom2 = crossoverMatch[2].trim();
								fandoms.push(fandom1, fandom2);
								fandomHierarchy.push(
									{
										category: "crossover",
										name: fandom1,
										url: href,
									},
									{
										category: "crossover",
										name: fandom2,
										url: href,
									},
								);
							} else {
								// Fallback: try to parse from URL like "/Ben-10_and_My-Hero-Academia_Crossovers/"
								const urlMatch = href.match(
									/\/([^/]+)_and_([^/]+)_Crossovers\//i,
								);
								if (urlMatch) {
									const fandom1 = urlMatch[1].replace(
										/-/g,
										" ",
									);
									const fandom2 = urlMatch[2].replace(
										/-/g,
										" ",
									);
									fandoms.push(fandom1, fandom2);
									fandomHierarchy.push(
										{
											category: "crossover",
											name: fandom1,
											url: href,
										},
										{
											category: "crossover",
											name: fandom2,
											url: href,
										},
									);
								}
							}
							debugLog(
								"FanFiction: Detected crossover:",
								linkText,
								fandoms,
							);
							break; // Found crossover, no need to continue
						}

						// SINGLE FANDOM: Category links (Books, Anime, etc.) and fandom links (Harry Potter)
						const categoryMatch = href.match(
							/^\/(book|anime|cartoon|comic|game|misc|play|movie|tv)\/$/i,
						);
						if (categoryMatch) {
							fandomHierarchy.push({
								category: categoryMatch[1].toLowerCase(),
								name: linkText,
								url: href,
							});
							// Don't add category name to fandoms list
							continue;
						}

						// This is the actual fandom name (e.g., Harry Potter, Naruto)
						if (linkText && !categoryMatch) {
							fandoms.push(linkText);
							fandomHierarchy.push({
								category: null,
								name: linkText,
								url: href,
							});
						}
					}

					metadata.metadata.fandoms = fandoms;
					metadata.metadata.fandomHierarchy = fandomHierarchy;
					metadata.metadata.isCrossover = isCrossoverDetected;

					debugLog(
						"FanFiction: Extracted fandoms:",
						fandoms,
						"hierarchy:",
						fandomHierarchy,
						"isCrossover:",
						isCrossoverDetected,
					);
				}

				// Try to extract metadata from enhanced HTML structure first (Better Fiction plugin, etc.)
				const enhancedData = this.extractEnhancedMetadata();
				if (enhancedData) {
					debugLog(
						"FanFiction: Using enhanced HTML metadata:",
						enhancedData,
					);
					// Apply enhanced metadata to the metadata object
					if (enhancedData.rating) {
						metadata.metadata.rating = enhancedData.rating;
					}
					if (enhancedData.language) {
						metadata.metadata.language = enhancedData.language;
					}
					if (enhancedData.genres && enhancedData.genres.length > 0) {
						metadata.genres = enhancedData.genres;
					}
					if (enhancedData.status) {
						metadata.status = enhancedData.status;
					}
					if (enhancedData.totalChapters) {
						metadata.totalChapters = enhancedData.totalChapters;
					}
					if (enhancedData.words) {
						metadata.metadata.words = enhancedData.words;
					}
					if (
						enhancedData.characters &&
						enhancedData.characters.length > 0
					) {
						metadata.metadata.characters = enhancedData.characters;
					}
					if (
						enhancedData.relationships &&
						enhancedData.relationships.length > 0
					) {
						metadata.metadata.relationships =
							enhancedData.relationships;
					}
				}

				// Extract info from the xgray span
				// Format: Rated: Fiction T - English - Romance/Adventure - Harry P., OC - Chapters: 14 - Words: 17,128 - Reviews: 3 - Favs: 12 - Follows: 4 - Published: 8/25/2011 - Status: Complete - id: 7322782
				const infoSpan =
					profileTop.querySelector("span.xgray.xcontrast_txt") ||
					profileTop.querySelector("span.xgray");
				if (infoSpan) {
					const infoText = infoSpan.textContent || "";
					debugLog("FanFiction: Raw metadata text:", infoText);

					// Split by " - " to get segments
					// Improved split to handle cases where " - " might be missing or different
					const segments = infoText
						.split(/\s+-\s+/)
						.map((s) => s.trim())
						.filter((s) => s.length > 0);
					debugLog("FanFiction: Metadata segments:", segments);

					// Extract rating from segment 0 (e.g., "Rated: Fiction T") — only if not already set by enhanced
					if (segments.length > 0 && !metadata.metadata.rating) {
						const ratingMatch = segments[0].match(
							/Rated:\s*(?:Fiction\s+)?([A-Z](?:\+)?)/i,
						);
						if (ratingMatch) {
							metadata.metadata.rating =
								ratingMatch[1].toUpperCase();
							debugLog(
								"FanFiction: Extracted rating:",
								metadata.metadata.rating,
							);
						}
					}

					// Segment 2 typically contains genres (e.g., "Romance/Adventure")
					// Remaining segments contain characters, chapters, words, etc.

					// Extract language from segment 1 (usually just the language name) — only if not already set by enhanced
					if (segments.length > 1 && !metadata.metadata.language) {
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
								metadata.metadata.language,
							);
						}
					} // Extract genres from segment[2] ONLY — always "Genre1/Genre2" format.
					// Segment[3] onwards is the character list, not more genres.
					// Only extract genres if not already set by enhanced metadata
					if (
						segments.length > 2 &&
						(!metadata.genres || metadata.genres.length === 0)
					) {
						const genreRaw = segments[2]
							.replace(/Chapters:.*/i, "")
							.replace(/Words:.*/i, "")
							.trim();
						// Genre segment uses "/" as separator. If it already looks like a character
						// list (comma-separated "First L." abbreviations) then genres are absent.
						const looksLikeCharList =
							/[A-Z][a-z]+\.\s*,|[A-Z][a-z]+\s+[A-Z]\./.test(
								genreRaw,
							);
						if (!genreRaw.includes(":") && !looksLikeCharList) {
							const genres = genreRaw
								.split("/")
								.map((g) => g.trim())
								.filter(
									(g) =>
										g.length > 0 &&
										!g.match(/^\d/) &&
										!g.includes(":"),
								);
							if (genres.length > 0) {
								metadata.genres = genres;
								debugLog(
									"FanFiction: Extracted genres:",
									metadata.genres,
								);
							}
						} else if (looksLikeCharList) {
							// No genres present — segment[2] is already the character list
							debugLog(
								"FanFiction: No genre segment detected; segment[2] looks like characters.",
							);
						}
					}

					// Extract chapters - first try from metadata text — only if not already set by enhanced
					if (
						!metadata.totalChapters ||
						metadata.totalChapters === 0
					) {
						const chaptersMatch =
							infoText.match(/Chapters:\s*(\d+)/i);
						if (chaptersMatch) {
							metadata.totalChapters = parseInt(
								chaptersMatch[1],
								10,
							);
							debugLog(
								"FanFiction: Extracted chapters from text:",
								metadata.totalChapters,
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
										metadata.totalChapters,
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
									"FanFiction: Assuming one-shot (single chapter)",
								);
							}
						}

						// Extract words — only if not already set by enhanced
						if (
							!metadata.metadata.words ||
							metadata.metadata.words === 0
						) {
							const wordsMatch =
								infoText.match(/Words:\s*([\d,]+)/i);
							if (wordsMatch) {
								metadata.metadata.words = parseInt(
									wordsMatch[1].replace(/,/g, ""),
									10,
								);
							}
						}

						// Extract reviews
						const reviewsMatch =
							infoText.match(/Reviews:\s*([\d,]+)/i);
						if (reviewsMatch) {
							metadata.metadata.reviews = parseInt(
								reviewsMatch[1].replace(/,/g, ""),
								10,
							);
						}

						// Extract favorites
						const favsMatch = infoText.match(/Favs:\s*([\d,]+)/i);
						if (favsMatch) {
							metadata.metadata.favorites = parseInt(
								favsMatch[1].replace(/,/g, ""),
								10,
							);
						}

						// Extract follows
						const followsMatch =
							infoText.match(/Follows:\s*([\d,]+)/i);
						if (followsMatch) {
							metadata.metadata.follows = parseInt(
								followsMatch[1].replace(/,/g, ""),
								10,
							);
						}

						// Normalize stats for UI consumption
						metadata.stats = {
							words: metadata.metadata.words,
							reviews: metadata.metadata.reviews,
							favorites: metadata.metadata.favorites,
							follows: metadata.metadata.follows,
						};

						// Extract published date
						// Try to find specific published span first (from user provided structure)
						const publishedMetaSpan = profileTop.querySelector(
							".publishedmeta span[data-xutime]",
						);
						if (publishedMetaSpan) {
							const timestamp =
								publishedMetaSpan.getAttribute("data-xutime");
							if (timestamp) {
								metadata.metadata.publishedDate =
									parseInt(timestamp, 10) * 1000;
							}
						} else {
							// Fallback to standard FF.net structure
							// If "Updated:" is present, the second data-xutime is Published
							// If not, the first data-xutime is Published
							const xutimeSpans =
								infoSpan.querySelectorAll("span[data-xutime]");
							if (infoText.includes("Updated:")) {
								if (xutimeSpans.length > 1) {
									const timestamp =
										xutimeSpans[1].getAttribute(
											"data-xutime",
										);
									if (timestamp) {
										metadata.metadata.publishedDate =
											parseInt(timestamp, 10) * 1000;
									}
								}
							} else if (xutimeSpans.length > 0) {
								const timestamp =
									xutimeSpans[0].getAttribute("data-xutime");
								if (timestamp) {
									metadata.metadata.publishedDate =
										parseInt(timestamp, 10) * 1000;
								}
							}
						}

						// Extract updated date
						// Try to find specific updated span first
						const updatedMetaSpan = profileTop.querySelector(
							".updatedmeta span[data-xutime]",
						);
						if (updatedMetaSpan) {
							const timestamp =
								updatedMetaSpan.getAttribute("data-xutime");
							if (timestamp) {
								metadata.metadata.updatedDate =
									parseInt(timestamp, 10) * 1000;
							}
						} else {
							// Fallback to standard FF.net structure
							// If "Updated:" is present, the first data-xutime is Updated
							if (infoText.includes("Updated:")) {
								const xutimeSpans =
									infoSpan.querySelectorAll(
										"span[data-xutime]",
									);
								if (xutimeSpans.length > 0) {
									const timestamp =
										xutimeSpans[0].getAttribute(
											"data-xutime",
										);
									if (timestamp) {
										metadata.metadata.updatedDate =
											parseInt(timestamp, 10) * 1000;
									}
								}
							}
						}

						// Detect status — only if not already set by enhanced
						if (!metadata.status || metadata.status === "unknown") {
							if (infoText.toLowerCase().includes("complete")) {
								metadata.status = "completed";
							} else {
								metadata.status = "ongoing";
							}
						}

						// Extract characters from the metadata text — only if not already set by enhanced
						// FanFiction format varies but characters typically appear:
						// 1. After Published date: "Published: Apr 19, 2021 Ben T., Izuku M., Momo Y., 1-A Studentsid: 13865360"
						// 2. Or between genres and stats: "Adventure/Sci-Fi - Harry P., OC - Chapters:"
						// Brackets [X, Y] indicate romantic/platonic relationships (max 4 characters)
						// Multiple bracket groups possible: [Harry P., Hermione G.] [Luna L., Neville L.]
						if (
							!metadata.metadata.characters ||
							metadata.metadata.characters.length === 0
						) {
							const allCharacters = new Set();
							const relationships = [];

							// Strategy: Look for character names after the Published date and before "id:"
							// Format: "Published: <date> <characters>id: <id>"
							let charSection = "";

							// Try to find characters after Published date
							const publishedMatch = infoText.match(
								/Published:\s*[A-Za-z]{3}\s+\d{1,2},?\s*\d{4}\s+(.+?)(?:id:|$)/i,
							);
							if (publishedMatch && publishedMatch[1]) {
								charSection = publishedMatch[1].trim();
							}

							// Fallback: try between genre section and stats.
							// Handles both:
							//   "Genre - Char1, Char2 - Chapters:"
							//   "Genre - Char1, Char2 - Complete - Chapters:"  (Complete between chars & stats)
							if (!charSection) {
								const genreCharMatch = infoText.match(
									/(?:Adventure|Romance|Drama|Humor|Angst|Hurt\/Comfort|Fantasy|Sci-Fi|Mystery|Horror|Tragedy|Family|Friendship|General|Supernatural|Crime|Western|Parody|Poetry|Spiritual)[/\w-]*\s+-\s+([^-]+?)\s+-\s*(?:Complete|Status|Chapters|Words)/i,
								);
								if (genreCharMatch && genreCharMatch[1]) {
									charSection = genreCharMatch[1].trim();
								}
							}

							if (charSection && charSection.length > 0) {
								// Extract relationship brackets first [Harry P., Hermione G., etc.]
								// Can have multiple brackets: [Harry P., Hermione G.] [Luna L., Neville L.]
								const bracketMatches =
									charSection.match(/\[([^\]]+)\]/g);
								if (bracketMatches) {
									bracketMatches.forEach((bracket) => {
										const insideBracket = bracket
											.replace(/[[]\]]/g, "")
											.trim();
										const charsInBracket = insideBracket
											.split(",")
											.map((c) => c.trim())
											.filter((c) => c.length > 0)
											.slice(0, 4);

										// Store relationship group (with 2+ characters)
										if (charsInBracket.length >= 2) {
											relationships.push(charsInBracket);
										}

										// Add individual characters from the bracket
										charsInBracket.forEach((c) =>
											allCharacters.add(c),
										);
									});

									// Remove brackets from section to process remaining characters
									charSection = charSection.replace(
										/\[[^\]]+\]/g,
										"",
									);
								}

								// Extract remaining non-bracketed characters
								// This includes individual characters and group names like "1-A Students"
								const remainingChars = charSection
									.split(",")
									.map((c) => c.trim())
									.filter(
										(c) =>
											c.length > 0 &&
											c !== "-" &&
											!c.match(/^\d+$/) &&
											!c.match(/status\s*:/i) &&
											!c.match(
												/^(-\s*)?complete(-\s*)?$/i,
											),
									);

								remainingChars.forEach((c) => {
									if (c) allCharacters.add(c);
								});
							}

							if (allCharacters.size > 0) {
								metadata.metadata.characters = [
									...allCharacters,
								];
								if (relationships.length > 0) {
									metadata.metadata.relationships =
										relationships;
								}
								debugLog(
									"FanFiction: Extracted characters:",
									[...allCharacters],
									"relationships:",
									relationships,
								);
							}
						} // End character extraction block

						// Extract story ID from info text
						const idMatch = infoText.match(/id:\s*(\d+)/i);
						if (idMatch && !metadata.metadata.storyId) {
							metadata.metadata.storyId = idMatch[1];
						}
					}
				}
			}
		} catch (error) {
			debugError(
				"FanFiction: Error extracting additional metadata:",
				error,
			);
		}

		// Promote frequently-used fields to top level so filters/cards stay in sync
		metadata.rating = metadata.metadata.rating || null;
		metadata.language = metadata.metadata.language || null;
		metadata.words = metadata.metadata.words || 0;
		metadata.reviews = metadata.metadata.reviews || 0;
		metadata.favorites = metadata.metadata.favorites || 0;
		metadata.follows = metadata.metadata.follows || 0;
		metadata.publishedDate = metadata.metadata.publishedDate || null;
		metadata.updatedDate = metadata.metadata.updatedDate || null;

		// Ensure stats object is populated for filtering
		metadata.stats = {
			words: metadata.words,
			reviews: metadata.reviews,
			favorites: metadata.favorites,
			follows: metadata.follows,
			publishedDate: metadata.publishedDate,
			updatedDate: metadata.updatedDate,
		};

		// Surface useful tags for card/modal rendering — genres + characters only;
		// fandoms are kept in metadata.metadata.fandoms and shown separately.
		const combinedTags = new Set();
		(metadata.genres || []).forEach((g) => combinedTags.add(g));
		(metadata.metadata?.characters || []).forEach((c) => {
			// Exclude fandom names that leaked into characters during parsing
			const isFandom = (metadata.metadata?.fandoms || []).includes(c);
			if (!isFandom) combinedTags.add(c);
		});
		metadata.tags = Array.from(combinedTags);

		// Flag metadata that still needs a dedicated refresh
		metadata.metadataIncomplete =
			!metadata.totalChapters ||
			metadata.genres.length === 0 ||
			!metadata.author;

		// Validate that we're on a valid story page, not the home page
		if (!this.isChapterPage()) {
			debugLog(
				"FanFiction: Not on a valid story page, returning null metadata",
			);
			return null;
		}

		// Additional validation: check if we have essential metadata
		if (!metadata.title || metadata.title === "FanFiction") {
			debugLog(
				"FanFiction: Invalid metadata - likely on home/index page",
			);
			return null;
		}

		debugLog("FanFiction: Extracted metadata:", metadata);
		return metadata;
	}

	/**
	 * Extract page metadata for content enhancement context
	 * Provides site-specific information for AI during content processing
	 * @returns {Object} Context with author, title, genres, tags, status, description
	 */
	extractPageMetadata() {
		const context = {
			author: null,
			title: null,
			genres: [],
			tags: [],
			status: null,
			description: null,
			originalUrl: window.location.href,
		};

		try {
			// Author from profile link
			const authorLink = document.querySelector(
				'#profile_top a[href^="/u/"]',
			);
			if (authorLink) {
				context.author = authorLink.textContent.trim();
			}

			// Story title (first bold text in profile_top)
			const storyTitle = document.querySelector(
				"#profile_top > b.xcontrast_txt",
			);
			if (storyTitle) {
				context.title = storyTitle.textContent.trim();
			}

			// Get story metadata from info div
			const infoDiv = document.querySelector("#profile_top .xgray");
			if (infoDiv) {
				const infoText = infoDiv.textContent;
				// Extract genres
				const genreMatch = infoText.match(
					/(?:rated|language).*?-\s*([^-]+)\s*-/i,
				);
				if (genreMatch) {
					context.genres = genreMatch[1]
						.split("/")
						.map((g) => g.trim())
						.filter(Boolean);
				}
			}
		} catch (error) {
			debugError("FanFiction: Error extracting page metadata:", error);
		}

		return context;
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
		contentArea;
		pass;
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
			contentArea.className,
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
					childDiv.id,
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
				`FanFiction: Extracted ${enhancedParagraphs.length} paragraphs from HTML`,
			);
		} else {
			// Plain text - split on double newlines as paragraph boundaries
			debugLog(
				"FanFiction: Enhanced text is plain text, splitting by newlines...",
			);
			enhancedParagraphs = enhancedText
				.replace(/\r/g, "")
				.split(/\n\n+/)
				.map((p) => p.trim())
				.filter((p) => p.length > 0);
		}

		const originalParagraphEls = Array.from(
			targetDiv.querySelectorAll("p"),
		);
		const replaceCount = Math.min(
			originalParagraphEls.length,
			enhancedParagraphs.length,
		);

		debugLog(
			`FanFiction: Replacing ${replaceCount} existing paragraphs, adding ${
				enhancedParagraphs.length - replaceCount
			} new ones`,
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

	/**
	 * FanFiction.net doesn't have dark mode
	 * @returns {string} Always 'light'
	 */
	getPageTheme() {
		return "light";
	}

	/**
	 * Propose library settings for FanFiction.net
	 * Allows users to customize domain and metadata preferences
	 */
	getProposedLibrarySettings() {
		return {
			domainPreference: {
				label: "Preferred Domain",
				type: "select",
				options: ["www", "m"],
				default: "www",
				description: "Use desktop (www) or mobile (m) version",
			},
			preferredTld: {
				label: "Preferred TLD",
				type: "select",
				options: ["net", "ws"],
				default: "net",
				description: "FanFiction.net or FanFiction.ws",
			},
			autoRefreshMetadata: {
				label: "Auto Refresh Metadata",
				type: "boolean",
				default: true,
				description: "Automatically refresh story metadata on visits",
			},
			enableClipboardCopyOnDownload: {
				label: "Copy to Clipboard on Download",
				type: "boolean",
				default: true,
				description:
					'Automatically copy "Title" by Author StoryId.epub to clipboard when downloading',
			},
		};
	}

	/**
	 * Get metadata source URL (for mobile -> desktop redirect)
	 */
	getMetadataSourceUrl() {
		// For desktop, metadata is embedded
		const match = window.location.href.match(/\/s\/(\d+)/);
		if (match) {
			return `https://www.fanfiction.net/s/${match[1]}/1/`;
		}
		return null;
	}

	/**
	 * FanFiction.net-specific metadata fields for the library edit modal.
	 * @returns {Array<Object>}
	 */
	static getEditableFields() {
		return [
			{
				key: "fandoms",
				label: "Fandoms",
				type: "tags",
				source: "metadata",
				placeholder: "Harry Potter, Naruto",
			},
			{
				key: "characters",
				label: "Characters",
				type: "tags",
				source: "metadata",
				placeholder: "Harry, Hermione",
			},
			{
				key: "language",
				label: "Language",
				type: "text",
				source: "metadata",
				placeholder: "e.g. English",
			},
			{
				key: "rating",
				label: "Rating",
				type: "select",
				source: "metadata",
				options: [
					{ value: "", label: "Unknown" },
					{ value: "K", label: "K (Kids)" },
					{ value: "K+", label: "K+ (Older Kids)" },
					{ value: "T", label: "T (Teen)" },
					{ value: "M", label: "M (Mature)" },
				],
			},
			{
				key: "isCrossover",
				label: "Crossover",
				type: "toggle",
				source: "metadata",
			},
			{
				key: "words",
				label: "Word Count",
				type: "number",
				source: "metadata",
				min: 0,
			},
			{
				key: "reviews",
				label: "Reviews",
				type: "number",
				source: "metadata",
				min: 0,
			},
			{
				key: "favorites",
				label: "Favorites",
				type: "number",
				source: "metadata",
				min: 0,
			},
			{
				key: "follows",
				label: "Follows",
				type: "number",
				source: "metadata",
				min: 0,
			},
			{
				key: "publishedDate",
				label: "Published Date",
				type: "date",
				source: "metadata",
			},
			{
				key: "updatedDate",
				label: "Last Updated",
				type: "date",
				source: "metadata",
			},
		];
	}
}

// Default export for singleton instance
export default new FanfictionHandler();
