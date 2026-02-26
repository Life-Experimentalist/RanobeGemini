/**
 * Library Integration Module
 * Content script module for "Add to Library" functionality
 *
 * Responsibility:
 * - Inject "Add to Library" button on chapter pages
 * - Handle add-to-library clicks
 * - Trigger metadata fetching from background
 * - Update library with new novel entries
 * - Manage library settings for handlers
 *
 * Integration Points:
 * - Content script: Import and initialize this module
 * - Background script: Listens for "fetchNovelMetadata" and "getHandlerSettings" messages
 * - Handler: Provides metadata and proposed settings
 */

import { debugLog, debugError } from "../../utils/logger.js";

class LibraryIntegration {
	constructor() {
		this.isInitialized = false;
		this.handlerDomain = null;
		this.handlerType = null;
		this.buttonElement = null;
	}

	/**
	 * Initialize library integration for current handler
	 * @param {Object} handler - Handler instance for current site
	 * @param {string} handlerDomain - Handler domain identifier
	 * @param {string} handlerType - Handler type (chapter_embedded, dedicated_page, etc.)
	 * @returns {Promise<boolean>} True if initialized successfully
	 */
	async initialize(handler, handlerDomain, handlerType) {
		try {
			if (this.isInitialized) {
				debugLog("[LibraryIntegration] Already initialized");
				return true;
			}

			this.handler = handler;
			this.handlerDomain = handlerDomain;
			this.handlerType = handlerType;

			debugLog(
				`[LibraryIntegration] Initializing for ${handlerDomain} (${handlerType})`,
			);

			// Check if button should be shown
			if (!this.shouldShowButton()) {
				debugLog(
					"[LibraryIntegration] Button disabled for this page type",
				);
				return false;
			}

			// Inject the add-to-library button
			await this.injectButton();

			this.isInitialized = true;
			debugLog("[LibraryIntegration] Initialization complete");
			return true;
		} catch (error) {
			debugError("[LibraryIntegration] Initialization error:", error);
			return false;
		}
	}

	/**
	 * Check if add-to-library button should be shown on current page
	 * @returns {boolean}
	 */
	shouldShowButton() {
		// Only show on chapter pages, not on landing/index pages
		if (this.handler.isNovelPage?.()) {
			debugLog(
				"[LibraryIntegration] Not showing button on novel page (not chapter)",
			);
			return false;
		}

		// Check if handler supports library integration
		if (!this.handler.extractNovelMetadata) {
			debugLog(
				"[LibraryIntegration] Handler does not support metadata extraction",
			);
			return false;
		}

		return true;
	}

	/**
	 * Inject add-to-library button into the page
	 * @returns {Promise<void>}
	 */
	async injectButton() {
		try {
			debugLog("[LibraryIntegration] Injecting button");

			// Create button element
			this.buttonElement = document.createElement("button");
			this.buttonElement.id = "ranobe-gemini-add-to-library-btn";
			this.buttonElement.textContent = "📚 Add to Library";
			this.buttonElement.title = "Add this novel to your library";
			this.buttonElement.style.cssText = `
        padding: 8px 16px;
        margin: 8px 0;
        background-color: #4a7c4e;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s;
      `;

			// Add hover effect
			this.buttonElement.addEventListener("mouseenter", () => {
				this.buttonElement.style.backgroundColor = "#3a6c3e";
			});
			this.buttonElement.addEventListener("mouseleave", () => {
				this.buttonElement.style.backgroundColor = "#4a7c4e";
			});

			// Add click handler
			this.buttonElement.addEventListener("click", () =>
				this.handleAddToLibrary(),
			);

			// Find insertion point
			const insertionPoint =
				this.handler.getNovelPageUIInsertionPoint?.();
			if (insertionPoint?.element) {
				insertionPoint.element.insertAdjacentElement(
					"beforebegin",
					this.buttonElement,
				);
				debugLog("[LibraryIntegration] Button injected successfully");
			} else {
				// Fallback: Insert at the top of the content area
				const contentArea = this.handler.findContentArea?.();
				if (contentArea) {
					contentArea.insertAdjacentElement(
						"beforebegin",
						this.buttonElement,
					);
					debugLog(
						"[LibraryIntegration] Button injected at content area",
					);
				} else {
					debugError(
						"[LibraryIntegration] Could not find insertion point",
					);
				}
			}
		} catch (error) {
			debugError("[LibraryIntegration] Error injecting button:", error);
		}
	}

	/**
	 * Handle "Add to Library" button click
	 * Fetches metadata and adds novel to library
	 * @returns {Promise<void>}
	 */
	async handleAddToLibrary() {
		try {
			debugLog("[LibraryIntegration] Add to library clicked");

			// Show loading state
			this.setButtonState("loading");

			// Extract metadata from current page first
			let metadata = this.handler.extractNovelMetadata();

			if (!metadata) {
				debugError(
					"[LibraryIntegration] Could not extract local metadata",
				);
				this.setButtonState(
					"error",
					"Failed to extract novel metadata",
				);
				return;
			}

			// If handler needs complete metadata from another source, fetch it
			if (
				this.handlerType === "dedicated_page" ||
				this.handlerType === "chapter_embedded_requires_redirect"
			) {
				debugLog(
					"[LibraryIntegration] Fetching complete metadata from source",
				);

				try {
					const response = await this.fetchMetadataFromBackground();

					if (response.success) {
						// Merge background-fetched metadata with local data
						metadata = {
							...metadata,
							...response.metadata,
						};
						debugLog(
							"[LibraryIntegration] Metadata fetch successful",
						);
					} else {
						debugError(
							"[LibraryIntegration] Metadata fetch failed:",
							response.error,
						);
						// Continue with local metadata
					}
				} catch (error) {
					debugError(
						"[LibraryIntegration] Error fetching metadata:",
						error,
					);
					// Continue with local metadata
				}
			}

			// Add novel to library
			const success = await this.addNovelToLibrary(metadata);

			if (success) {
				this.setButtonState("success", "Added to library!");
				setTimeout(() => this.setButtonState("normal"), 3000);
			} else {
				this.setButtonState("error", "Failed to add to library");
			}
		} catch (error) {
			debugError("[LibraryIntegration] Error in add to library:", error);
			this.setButtonState("error", "Error occurred");
		}
	}

	/**
	 * Fetch complete metadata from background script
	 * @returns {Promise<Object>} Response from background
	 */
	async fetchMetadataFromBackground() {
		return new Promise((resolve, reject) => {
			chrome.runtime.sendMessage(
				{
					action: "fetchNovelMetadata",
					url: window.location.href,
					handlerDomain: this.handlerDomain,
					handlerType: this.handlerType,
				},
				(response) => {
					if (chrome.runtime.lastError) {
						reject(new Error(chrome.runtime.lastError.message));
					} else {
						resolve(response);
					}
				},
			);
		});
	}

	/**
	 * Add novel to library
	 * @param {Object} metadata - Novel metadata
	 * @returns {Promise<boolean>} True if added successfully
	 */
	async addNovelToLibrary(metadata) {
		try {
			// Add timestamp
			metadata.addedAt = Date.now();
			metadata.handlerDomain = this.handlerDomain;

			// Store in library (assuming novelLibrary is available globally or imported)
			// This would integrate with the existing novel-library.js system
			debugLog(
				"[LibraryIntegration] Adding novel to library:",
				metadata.title,
			);

			// Send message to background to save to library
			return new Promise((resolve) => {
				chrome.runtime.sendMessage(
					{
						action: "addNovelToLibrary",
						metadata,
					},
					(response) => {
						resolve(response?.success ?? false);
					},
				);
			});
		} catch (error) {
			debugError("[LibraryIntegration] Error adding to library:", error);
			return false;
		}
	}

	/**
	 * Update button UI state
	 * @param {string} state - 'normal', 'loading', 'success', 'error'
	 * @param {string} message - Optional status message to show
	 */
	setButtonState(state, message) {
		if (!this.buttonElement) return;

		switch (state) {
			case "loading":
				this.buttonElement.disabled = true;
				this.buttonElement.textContent = "⏳ Adding...";
				this.buttonElement.style.opacity = "0.7";
				break;

			case "success":
				this.buttonElement.style.backgroundColor = "#22c55e";
				this.buttonElement.textContent = `✅ ${message || "Added!"}`;
				setTimeout(() => {
					if (this.buttonElement) {
						this.buttonElement.style.backgroundColor = "#4a7c4e";
						this.buttonElement.textContent = "📚 Add to Library";
						this.buttonElement.disabled = false;
						this.buttonElement.style.opacity = "1";
					}
				}, 2000);
				break;

			case "error":
				this.buttonElement.style.backgroundColor = "#ef4444";
				this.buttonElement.textContent = `❌ ${message || "Failed"}`;
				setTimeout(() => {
					if (this.buttonElement) {
						this.buttonElement.style.backgroundColor = "#4a7c4e";
						this.buttonElement.textContent = "📚 Add to Library";
						this.buttonElement.disabled = false;
						this.buttonElement.style.opacity = "1";
					}
				}, 3000);
				break;

			case "normal":
			default:
				this.buttonElement.disabled = false;
				this.buttonElement.textContent = "📚 Add to Library";
				this.buttonElement.style.opacity = "1";
				this.buttonElement.style.backgroundColor = "#4a7c4e";
				break;
		}
	}

	/**
	 * Cleanup and remove button
	 */
	destroy() {
		if (this.buttonElement) {
			this.buttonElement.remove();
			this.buttonElement = null;
		}
		this.isInitialized = false;
	}
}

// Singleton instance
export default new LibraryIntegration();
