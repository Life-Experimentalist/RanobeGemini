/**
 * Base Website Content Handler
 * The abstract class that all website-specific handlers should extend
 */
import { debugLog, debugError } from "../logger.js";
import { DEFAULT_BANNERS_VISIBLE } from "../constants.js";
export class BaseWebsiteHandler {
	// Default banner visibility on page load
	// Set to false to hide enhancement banners by default
	// Individual handlers can override this
	static DEFAULT_BANNERS_VISIBLE = DEFAULT_BANNERS_VISIBLE;

	/**
	 * Settings definition for the library settings page.
	 * null = no configurable settings for this handler.
	 * Subclasses override this with a { fields: [...] } object.
	 */
	static SETTINGS_DEFINITION = null;

	constructor() {
		// Optional initialization
	}

	// Return true if this handler can handle the current website
	canHandle() {
		throw new Error("Method canHandle() must be implemented by subclass");
	}

	/**
	 * Check if current page is a novel info page (not a chapter)
	 * For DEDICATED_PAGE type sites, this is where full metadata is available
	 * @returns {boolean}
	 */
	isNovelPage() {
		// Default: assume not a novel page (most sites use chapter pages)
		return false;
	}

	/**
	 * Get the novel controls configuration for this handler
	 * Handlers can override this to customize placement and appearance
	 * @returns {Object} Configuration for novel controls UI
	 */
	getNovelControlsConfig() {
		return {
			// Whether to show novel controls on this page type
			showControls: true,
			// Insertion point for the controls
			insertionPoint: this.getNovelPageUIInsertionPoint(),
			// Position relative to insertion point: 'before', 'after', 'prepend', 'append'
			position: "before",
			// Custom CSS styles (optional override)
			customStyles: null,
			// Whether this is a chapter page (vs novel info page)
			isChapterPage: this.isChapterPage(),
		};
	}

	/**
	 * Get custom chapter page control buttons for this handler
	 * Handlers can override this to add site-specific buttons (e.g., download buttons)
	 * @returns {Array} Array of button specifications { text, emoji, color, onClick }
	 */
	getCustomChapterButtons() {
		// Default: no custom buttons
		return [];
	}

	/**
	 * Get insertion point for novel controls UI
	 * Handlers should override this for site-specific placement
	 * @returns {Object|null} { element, position } or null
	 */
	getNovelPageUIInsertionPoint() {
		// Common selectors for novel/chapter pages
		const selectors = [
			".story-info",
			".novel-info",
			".book-info",
			".chapter-header",
			".chapter-title",
			"article header",
			"h1",
			".content-wrapper",
		];

		for (const selector of selectors) {
			const element = document.querySelector(selector);
			if (element) {
				return { element, position: "before" };
			}
		}

		return null;
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
				debugLog(
					`Base handler: Found content with selector ${selector}`,
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
			debugLog(
				"Base handler: Found content using largest text block method",
			);
			return bestCandidate;
		}

		debugLog("Base handler: Could not find content area");
		return null;
	}

	// Extract the title of the chapter
	extractTitle() {
		throw new Error(
			"Method extractTitle() must be implemented by subclass",
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

	// Check if current page is a chapter page (not a listing/index page)
	// Subclasses should override for site-specific detection
	isChapterPage() {
		// Default: assume all pages are chapter pages
		// This prevents the extension from incorrectly hiding UI on unknown sites
		return true;
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
			debugError("Error retrieving stored site prompt:", error);
		}
		return "";
	}

	// Get site identifier for the prompt UI
	getSiteIdentifier() {
		// Default implementation returns hostname
		return window.location.hostname;
	}

	/**
	 * Extract page metadata for content enhancement context
	 * Used for providing site-specific information to AI during processing
	 * Subclasses should override for site-specific metadata extraction
	 * @returns {Object} Context with author, title, genres, tags, status, description, etc.
	 */
	extractPageMetadata() {
		// Default implementation: returns basic context
		return {
			author: null,
			title: document.title || null,
			genres: [],
			tags: [],
			status: null,
			description: null,
			originalUrl: window.location.href,
		};
	}

	/**
	 * Detect the page's dark/light mode theme
	 * Subclasses should override for site-specific dark mode detection
	 * @returns {string} 'dark', 'light', or 'auto' (let extension decide)
	 */
	getPageTheme() {
		// Default: Let extension use its own theme detection
		return "auto";
	}

	/**
	 * Normalize/redirect URL for site-specific requirements
	 * Static method called BEFORE handler instantiation
	 * Use for instant redirects (e.g., fanfiction.net -> www.fanfiction.net)
	 * @static
	 * @async
	 * @returns {Promise<boolean>} True if redirect occurred, false otherwise
	 */
	static async normalizeURL() {
		// Default: No normalization needed
		return false;
	}

	/**
	 * Get custom buttons to add to controls
	 * Handlers can add site-specific buttons (e.g., mobile/desktop toggle)
	 * @returns {Array<{text: string, icon: string, onClick: function, position: string}>}
	 */
	getCustomButtons() {
		// Default: No custom buttons
		return [];
	}

	/**
	 * Inject custom UI elements into the control container
	 * Called after main controls are created
	 * @param {HTMLElement} container - Control container element
	 * @async
	 */
	async injectCustomUI(container) {
		container;
		// Default: No custom UI
	}

	/**
	 * Get default enhancement display mode preference for this site
	 * @returns {string} 'button' (show button to trigger) or 'direct' (show banners immediately)
	 */
	getDefaultDisplayMode() {
		// Default: Button mode (less intrusive)
		return "button";
	}

	/**
	 * Get handler-proposed library settings
	 * Handlers can propose custom settings that appear in library UI
	 * Settings are only shown when the handler is enabled for a novel
	 * @returns {Object} Settings schema as { key: { type, enum, default, label, description, ... } }
	 *                   Empty object means no custom settings for this handler
	 */
	getProposedLibrarySettings() {
		// Default: No custom settings
		return {};
	}

	/**
	 * Get the URL where metadata should be fetched from
	 * Used for dedicated_page and redirect handler types
	 * @returns {string|null} URL to fetch metadata from, or null if metadata is on current page
	 */
	getMetadataSourceUrl() {
		// Default: Metadata is on current page (chapter_embedded type)
		return null;
	}

	/**
	 * Process remotely-fetched metadata before returning
	 * Allows handlers to normalize or enrich metadata from other sources
	 * @param {Object} metadata - Metadata fetched from remote source
	 * @returns {Object} Processed metadata
	 */
	processRemoteMetadata(metadata) {
		// Default: Return metadata as-is
		return metadata;
	}

	/**
	 * Get handler-specific editable fields for the library edit modal.
	 * These are shown BELOW the common fields (title, author, cover, etc.) in a
	 * site-specific section so users can edit metadata unique to this website.
	 *
	 * Field spec object shape:
	 *   { key, label, type, source, options?, placeholder?, min?, max? }
	 *
	 *  key      - property name inside novel.metadata (or novel[key] if source='top')
	 *  label    - human-readable label
	 *  type     - 'text' | 'number' | 'select' | 'tags' | 'toggle' | 'date'
	 *  source   - 'metadata' (default, reads/writes novel.metadata[key])
	 *             'top' (reads/writes novel[key] directly)
	 *  options  - array of { value, label } for 'select' type
	 *  placeholder - optional hint text
	 *
	 * @returns {Array<Object>} Array of field spec objects. Empty = no site-specific fields.
	 */
	static getEditableFields() {
		return [];
	}
}
