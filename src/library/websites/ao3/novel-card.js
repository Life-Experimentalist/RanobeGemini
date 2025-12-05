/**
 * @fileoverview AO3 Novel Card Renderer
 * Custom card rendering for Archive of Our Own novels with rich metadata display
 */

import { NovelCardRenderer, registerCardRenderer } from "../novel-card-base.js";
import { debugLog, debugError } from "../../../utils/logger.js";
/**
 * AO3-specific novel card renderer
 * Displays rich fanfic metadata like ratings, relationships, and fandoms
 */
export class AO3CardRenderer extends NovelCardRenderer {
	/**
	 * Get the AO3 shelf configuration
	 */
	static get shelfConfig() {
		return {
			id: "ao3",
			name: "Archive of Our Own",
			icon: "🏛️",
			emoji: "🏛️",
			color: "#990000",
		};
	}

	/**
	 * Render card metadata with AO3-specific info
	 * @param {Object} novel - Novel data
	 * @param {Object} config - Shelf configuration
	 * @returns {string} HTML for metadata
	 */
	static renderCardMeta(novel, config) {
		const metadata = novel.metadata || {};
		const stats = metadata.stats || {};

		// AO3-specific: show rating, word count, and kudos
		const rating = metadata.rating || "";
		const words = stats.words || 0;
		const kudos = stats.kudos || 0;

		// Get rating class
		const ratingClass = this.getRatingClass(rating);

		return `
			<div class="novel-card-meta ao3-meta">
				${
					rating
						? `<span class="rating-badge-small ${ratingClass}">${this.escapeHtml(
								rating
						  )}</span>`
						: ""
				}
				${
					words
						? `<span class="meta-item" title="Word count">📝 ${this.formatNumber(
								words
						  )}</span>`
						: ""
				}
				${
					kudos
						? `<span class="meta-item" title="Kudos">❤️ ${this.formatNumber(
								kudos
						  )}</span>`
						: ""
				}
			</div>
		`;
	}

	/**
	 * Render AO3-specific tags (fandoms, relationships)
	 * @param {Object} novel - Novel data
	 * @returns {string} HTML for tags
	 */
	static renderCardTags(novel) {
		const metadata = novel.metadata || {};

		// Prioritize showing relationships, then fandoms, then regular tags
		const relationships = metadata.relationships || [];
		const fandoms = metadata.fandoms || [];
		const additionalTags =
			metadata.additionalTags || novel.genres || novel.tags || [];

		// Build tag display: 1 fandom, 1 relationship, 1 additional tag
		const displayItems = [];

		if (fandoms.length > 0) {
			displayItems.push({ text: fandoms[0], type: "fandom" });
		}

		if (relationships.length > 0) {
			displayItems.push({ text: relationships[0], type: "relationship" });
		}

		if (additionalTags.length > 0) {
			displayItems.push({ text: additionalTags[0], type: "additional" });
		}

		// Count remaining
		const totalTags =
			fandoms.length + relationships.length + additionalTags.length;
		const remainingCount = Math.max(0, totalTags - displayItems.length);

		if (displayItems.length === 0) return "";

		return `
			<div class="novel-card-tags ao3-tags">
				${displayItems
					.map(
						(item) => `
					<span class="card-tag card-tag-${item.type}">${this.escapeHtml(
							item.text
						)}</span>
				`
					)
					.join("")}
				${
					remainingCount > 0
						? `<span class="card-tag-more">+${remainingCount}</span>`
						: ""
				}
			</div>
		`;
	}

	/**
	 * Get rating CSS class
	 * @param {string} rating - The rating string
	 * @returns {string} CSS class name
	 */
	static getRatingClass(rating) {
		const ratingLower = (rating || "").toLowerCase();

		if (ratingLower.includes("general") || ratingLower === "g") {
			return "rating-general";
		}
		if (ratingLower.includes("teen") || ratingLower === "t") {
			return "rating-teen";
		}
		if (ratingLower.includes("mature") || ratingLower === "m") {
			return "rating-mature";
		}
		if (ratingLower.includes("explicit") || ratingLower === "e") {
			return "rating-explicit";
		}
		return "rating-not-rated";
	}

	/**
	 * Format large numbers
	 * @param {number} num - Number to format
	 * @returns {string} Formatted string
	 */
	static formatNumber(num) {
		if (!num) return "0";
		if (num >= 1000000) {
			return (num / 1000000).toFixed(1) + "M";
		}
		if (num >= 1000) {
			return (num / 1000).toFixed(1) + "K";
		}
		return num.toString();
	}
}

// Register the AO3 renderer
registerCardRenderer("ao3", AO3CardRenderer);
