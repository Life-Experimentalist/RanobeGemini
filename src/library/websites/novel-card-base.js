/**
 * @fileoverview Base Novel Card Renderer
 * Provides default novel card rendering that can be extended by site-specific handlers
 */

import {
	READING_STATUS,
	READING_STATUS_INFO,
} from "../../utils/novel-library.js";

/**
 * Base novel card renderer class
 * Site-specific handlers can extend this to customize the card appearance
 */
export class NovelCardRenderer {
	/**
	 * Get the shelf/site configuration
	 * @returns {Object} Shelf configuration with id, name, icon, color, etc.
	 */
	static get shelfConfig() {
		return {
			id: "default",
			name: "Unknown Site",
			icon: "📖",
			emoji: "📖",
			color: "#666666",
		};
	}

	/**
	 * Render a novel card
	 * @param {Object} novel - The novel data object
	 * @param {Object} options - Rendering options
	 * @returns {HTMLElement} The rendered card element
	 */
	static renderCard(novel, options = {}) {
		const card = document.createElement("div");
		card.className = "novel-card";
		card.dataset.novelId = novel.id;

		const config = this.shelfConfig;
		const coverUrl = novel.coverUrl || this.getFallbackCover(config);
		const statusInfo =
			READING_STATUS_INFO[novel.readingStatus] ||
			READING_STATUS_INFO[READING_STATUS.PLAN_TO_READ];

		// Build card HTML with optional site-specific background
		card.innerHTML = `
			${this.renderBackgroundIcon(config)}
			<div class="novel-card-cover">
				<img src="${this.escapeHtml(coverUrl)}"
					 alt="${this.escapeHtml(novel.title)}"
					 onerror="this.src='${this.getFallbackCover(config)}'; this.onerror=null;">
				<div class="novel-card-overlay">
					<span class="reading-status-badge" style="background: ${statusInfo.color}">
						${statusInfo.label}
					</span>
				</div>
			</div>
			<div class="novel-card-info">
				<h3 class="novel-card-title">${this.escapeHtml(novel.title)}</h3>
				<p class="novel-card-author">by ${this.escapeHtml(
					novel.author || "Unknown"
				)}</p>
				${this.renderCardMeta(novel, config)}
				${this.renderCardTags(novel)}
			</div>
		`;

		// Add click handler
		card.addEventListener("click", (e) => {
			if (!e.target.closest("button")) {
				this.onCardClick(novel);
			}
		});

		return card;
	}

	/**
	 * Render the faded background icon for the card
	 * @param {Object} config - Shelf configuration
	 * @returns {string} HTML for background icon
	 */
	static renderBackgroundIcon(config) {
		if (!config.icon) return "";

		if (config.icon.startsWith("http")) {
			return `
				<div class="novel-card-bg-icon">
					<img src="${this.escapeHtml(config.icon)}" alt="" aria-hidden="true">
				</div>
			`;
		}

		return `
			<div class="novel-card-bg-icon emoji">
				${config.emoji || config.icon}
			</div>
		`;
	}

	/**
	 * Render card metadata (chapters, enhanced, etc.)
	 * @param {Object} novel - Novel data
	 * @param {Object} config - Shelf configuration
	 * @returns {string} HTML for metadata
	 */
	static renderCardMeta(novel, config) {
		return `
			<div class="novel-card-meta">
				<span class="meta-item" title="Enhanced chapters">
					✨ ${novel.enhancedChaptersCount || 0}
				</span>
				<span class="meta-item" title="Total chapters">
					📖 ${novel.totalChapters || "?"}
				</span>
			</div>
		`;
	}

	/**
	 * Render card tags/genres
	 * @param {Object} novel - Novel data
	 * @returns {string} HTML for tags
	 */
	static renderCardTags(novel) {
		const tags = novel.genres || novel.tags || [];
		if (tags.length === 0) return "";

		const displayTags = tags.slice(0, 3);
		const moreCount = tags.length - 3;

		return `
			<div class="novel-card-tags">
				${displayTags
					.map(
						(tag) =>
							`<span class="card-tag">${this.escapeHtml(
								tag
							)}</span>`
					)
					.join("")}
				${moreCount > 0 ? `<span class="card-tag-more">+${moreCount}</span>` : ""}
			</div>
		`;
	}

	/**
	 * Get fallback cover image URL
	 * @param {Object} config - Shelf configuration
	 * @returns {string} Fallback image URL
	 */
	static getFallbackCover(config) {
		// Try to use shelf icon as fallback, then extension logo
		if (config.icon && config.icon.startsWith("http")) {
			return config.icon;
		}
		// Use browser extension API to get logo
		if (typeof browser !== "undefined" && browser.runtime) {
			return browser.runtime.getURL("icons/logo-light-128.png");
		}
		return "";
	}

	/**
	 * Handle card click event
	 * Override this in subclasses to customize click behavior
	 * @param {Object} novel - The clicked novel
	 */
	static onCardClick(novel) {
		// Default: dispatch custom event for parent to handle
		const event = new CustomEvent("novel-card-click", {
			detail: { novel },
			bubbles: true,
		});
		document.dispatchEvent(event);
	}

	/**
	 * Escape HTML to prevent XSS
	 * @param {string} text - Text to escape
	 * @returns {string} Escaped text
	 */
	static escapeHtml(text) {
		if (!text) return "";
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}
}

/**
 * Registry of site-specific card renderers
 */
export const cardRenderers = new Map();

/**
 * Register a site-specific card renderer
 * @param {string} shelfId - The shelf/site ID
 * @param {typeof NovelCardRenderer} renderer - The renderer class
 */
export function registerCardRenderer(shelfId, renderer) {
	cardRenderers.set(shelfId, renderer);
}

/**
 * Get the appropriate card renderer for a novel
 * @param {string} shelfId - The shelf/site ID
 * @returns {typeof NovelCardRenderer} The renderer class
 */
export function getCardRenderer(shelfId) {
	return cardRenderers.get(shelfId) || NovelCardRenderer;
}

/**
 * Render a novel card using the appropriate renderer
 * @param {Object} novel - The novel data
 * @param {Object} options - Rendering options
 * @returns {HTMLElement} The rendered card
 */
export function renderNovelCard(novel, options = {}) {
	const renderer = getCardRenderer(novel.shelfId);
	return renderer.renderCard(novel, options);
}
