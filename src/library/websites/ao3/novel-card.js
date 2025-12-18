/**
 * @fileoverview AO3 Novel Card Renderer
 * Custom card rendering for Archive of Our Own novels with rich metadata display
 */

import { NovelCardRenderer, registerCardRenderer } from "../novel-card-base.js";
import { debugLog, debugError } from "../../../utils/logger.js";
import {
	READING_STATUS,
	READING_STATUS_INFO,
} from "../../../utils/novel-library.js";
import { loadImageWithCache } from "../../../utils/image-cache.js";

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
	 * Get rating CSS class for AO3 ratings
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
	 * Format large numbers with K/M abbreviations
	 * @param {number} num - Number to format
	 * @returns {string} Formatted string
	 */
	static formatNumber(num) {
		if (num === null || num === undefined) return "0";
		const n =
			typeof num === "string"
				? parseInt(num.replace(/[,\s\u00A0]/g, ""), 10)
				: num;
		if (isNaN(n)) return "0";
		if (n >= 1_000_000)
			return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
		if (n >= 10_000)
			return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
		if (n >= 1_000) return n.toLocaleString();
		return n.toString();
	}

	/**
	 * Format date to short readable format
	 */
	static formatDateShort(dateStr) {
		if (!dateStr) return "";
		try {
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return dateStr;
			const now = new Date();
			const diff = now.getTime() - date.getTime();
			const days = Math.floor(diff / (1000 * 60 * 60 * 24));

			if (days === 0) return "Today";
			if (days === 1) return "Yesterday";
			if (days < 7) return `${days}d ago`;
			if (days < 30) return `${Math.floor(days / 7)}w ago`;
			if (days < 365) return `${Math.floor(days / 30)}m ago`;
			return `${Math.floor(days / 365)}y ago`;
		} catch {
			return dateStr;
		}
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
	 * Get rating-based gradient colors for placeholder
	 * @param {string} rating - The rating string
	 * @returns {Object} Colors for gradient
	 */
	static getRatingGradient(rating) {
		const ratingLower = (rating || "").toLowerCase();

		if (ratingLower.includes("general") || ratingLower === "g") {
			return {
				primary: "#4a7c59",
				secondary: "#2d4a35",
				accent: "#8bc34a",
			};
		}
		if (ratingLower.includes("teen") || ratingLower === "t") {
			return {
				primary: "#c4a000",
				secondary: "#7a6200",
				accent: "#ffd54f",
			};
		}
		if (ratingLower.includes("mature") || ratingLower === "m") {
			return {
				primary: "#bf5700",
				secondary: "#7a3800",
				accent: "#ff9800",
			};
		}
		if (ratingLower.includes("explicit") || ratingLower === "e") {
			return {
				primary: "#9e1414",
				secondary: "#5c0d0d",
				accent: "#ef5350",
			};
		}
		// Not rated - neutral gray/blue
		return { primary: "#455a64", secondary: "#263238", accent: "#78909c" };
	}

	/**
	 * Get category icon for AO3 categories
	 * @param {string} category - The category string
	 * @returns {string} Icon character
	 */
	static getCategoryIcon(category) {
		const cat = (category || "").toUpperCase();
		if (cat.includes("M/M")) return "♂♂";
		if (cat.includes("F/F")) return "♀♀";
		if (cat.includes("F/M") || cat.includes("M/F")) return "♀♂";
		if (cat.includes("GEN")) return "✦";
		if (cat.includes("MULTI")) return "⚭";
		if (cat.includes("OTHER")) return "◇";
		return "📖";
	}

	/**
	 * Get short rating label
	 * @param {string} rating - The rating string
	 * @returns {string} Short label
	 */
	static getShortRating(rating) {
		const ratingLower = (rating || "").toLowerCase();
		if (ratingLower.includes("general")) return "G";
		if (ratingLower.includes("teen")) return "T";
		if (ratingLower.includes("mature")) return "M";
		if (ratingLower.includes("explicit")) return "E";
		return "NR";
	}

	/**
	 * Render complete novel card for AO3
	 * @param {Object} novel - Novel data
	 * @returns {HTMLElement} Card element
	 */
	static renderCard(novel) {
		const card = document.createElement("div");
		card.className = "novel-card ao3-card";
		card.dataset.novelId = novel.id;

		const metadata = novel.metadata || {};
		const statsObj = metadata.stats || {};

		// Flexible getters
		const getVal = (key, fallback = null) => {
			if (novel[key] !== undefined && novel[key] !== null)
				return novel[key];
			if (metadata[key] !== undefined && metadata[key] !== null)
				return metadata[key];
			if (statsObj[key] !== undefined && statsObj[key] !== null)
				return statsObj[key];
			return fallback;
		};

		const readingKeyRaw =
			novel.readingStatus ||
			READING_STATUS.PLAN_TO_READ ||
			"plan-to-read";
		const normalizedReadingKey = readingKeyRaw.replace(/_/g, "-");
		const statusInfo =
			READING_STATUS_INFO[normalizedReadingKey] ||
			READING_STATUS_INFO[READING_STATUS.PLAN_TO_READ];
		const statusClass = `status-${normalizedReadingKey.replace(/-/g, "_")}`;

		const enhanced = novel.enhancedChaptersCount ?? 0;
		const chapters = getVal("chapters") || getVal("totalChapters") || 0;
		const progressPercent = chapters
			? Math.min(100, Math.round((enhanced / chapters) * 100))
			: 0;

		// Build all badge chips
		const rating = getVal("rating");
		const language = getVal("language");
		const category = getVal("category");
		const workStatus = getVal("status");

		// Get rating gradient for placeholder
		const gradientColors = this.getRatingGradient(rating);
		const categoryIcon = this.getCategoryIcon(category);
		const shortRating = this.getShortRating(rating);

		// Create beautiful placeholder for AO3 (no cover images)
		const placeholderMarkup = `
			<div class="ao3-cover-placeholder" style="background: linear-gradient(145deg, ${gradientColors.primary} 0%, ${gradientColors.secondary} 100%);">
				<div class="ao3-placeholder-pattern"></div>
				<div class="ao3-placeholder-content">
					<span class="ao3-placeholder-rating">${shortRating}</span>
					<span class="ao3-placeholder-category">${categoryIcon}</span>
				</div>
				<div class="ao3-placeholder-icon">🏛️</div>
			</div>
		`;

		const ratingBadge = rating
			? `<span class="chip rating-badge ${this.getRatingClass(
					rating
			  )}" title="Content Rating">${this.escapeHtml(rating)}</span>`
			: "";
		const languageBadge = language
			? `<span class="chip chip-ghost" title="Language">${this.escapeHtml(
					language
			  )}</span>`
			: "";
		const categoryBadge = category
			? `<span class="chip chip-ghost" title="Category">${this.escapeHtml(
					category
			  )}</span>`
			: "";
		const workStatusBadge = workStatus
			? `<span class="chip ${
					workStatus.toLowerCase() === "completed" ||
					workStatus.toLowerCase() === "complete"
						? "chip-success"
						: "chip-warning"
			  }" title="Publication Status">${this.escapeHtml(
					workStatus
			  )}</span>`
			: "";

		// Build stats display - prioritize key stats
		const words = getVal("words", 0);
		const kudos = getVal("kudos", 0);
		const hits = getVal("hits", 0);
		const comments = getVal("comments", 0);
		const bookmarks = getVal("bookmarks", 0);

		// Compact stats for card
		const quickStats = [];
		if (chapters)
			quickStats.push({ icon: "📖", value: chapters, label: "ch" });
		if (words)
			quickStats.push({ icon: "📝", value: words, label: "words" });
		if (kudos)
			quickStats.push({ icon: "❤️", value: kudos, label: "kudos" });
		if (hits) quickStats.push({ icon: "👁️", value: hits, label: "hits" });

		const quickStatsMarkup = quickStats
			.slice(0, 4)
			.map(
				(stat) => `
					<span class="ao3-quick-stat" title="${stat.label}">
						${stat.icon} ${this.formatNumber(stat.value)}
					</span>
				`
			)
			.join("");

		// Build tags - show primary fandom and relationship
		const fandoms = metadata.fandoms || [];
		const relationships = metadata.relationships || [];
		const primaryFandom = fandoms[0] || "";
		const primaryRelationship = relationships[0] || "";

		const tagsMarkup = `
			${
				primaryFandom
					? `<span class="ao3-tag ao3-tag-fandom" title="${this.escapeHtml(
							fandoms.join(", ")
					  )}">${this.escapeHtml(
							this.truncateText(primaryFandom, 25)
					  )}${
							fandoms.length > 1 ? ` +${fandoms.length - 1}` : ""
					  }</span>`
					: ""
			}
			${
				primaryRelationship
					? `<span class="ao3-tag ao3-tag-relationship" title="${this.escapeHtml(
							relationships.join(", ")
					  )}">${this.escapeHtml(
							this.truncateText(primaryRelationship, 30)
					  )}${
							relationships.length > 1
								? ` +${relationships.length - 1}`
								: ""
					  }</span>`
					: ""
			}
		`;

		card.innerHTML = `
			<div class="ao3-card-layout">
				<div class="ao3-card-left">
					${placeholderMarkup}
					<span class="ao3-reading-badge ${statusClass}">${statusInfo.label}</span>
				</div>
				<div class="ao3-card-right">
					<div class="ao3-card-header">
						<h3 class="ao3-card-title" title="${this.escapeHtml(
							novel.title
						)}">${this.escapeHtml(novel.title)}</h3>
						<span class="ao3-card-author">by <strong>${this.escapeHtml(
							novel.author || "Anonymous"
						)}</strong></span>
					</div>

					<div class="ao3-card-badges">
						${ratingBadge}${categoryBadge}${workStatusBadge}${languageBadge}
					</div>

					<div class="ao3-card-stats">
						${quickStatsMarkup}
					</div>

					<div class="ao3-card-tags">
						${tagsMarkup}
					</div>

					<div class="ao3-card-footer">
						<div class="ao3-progress-section">
							<div class="ao3-progress-bar">
								<div class="ao3-progress-fill" style="width: ${progressPercent}%;"></div>
							</div>
							<span class="ao3-progress-text">✨ ${this.formatNumber(
								enhanced
							)}/${this.formatNumber(
			chapters
		)} (${progressPercent}%)</span>
						</div>
						${
							novel.sourceUrl
								? `<a class="ao3-open-btn" href="${this.escapeHtml(
										novel.sourceUrl
								  )}" target="_blank" rel="noreferrer" title="Open on AO3">↗</a>`
								: ""
						}
					</div>
				</div>
			</div>
		`;

		card.addEventListener("click", (e) => {
			if (!e.target.closest("button, a")) {
				this.onCardClick(novel);
			}
		});

		return card;
	}

	/**
	 * Truncate text with ellipsis
	 * @param {string} text - Text to truncate
	 * @param {number} maxLength - Maximum length
	 * @returns {string} Truncated text
	 */
	static truncateText(text, maxLength) {
		if (!text || text.length <= maxLength) return text;
		return text.substring(0, maxLength - 1) + "…";
	}

	/**
	 * Set up error handlers for images (avoids CSP inline handler issues)
	 * @param {HTMLElement} container - Container to find images in
	 */
	static setupImageErrorHandlers(container) {
		const images = container.querySelectorAll(
			"img.novel-cover-img[data-fallback]"
		);
		images.forEach((img) => {
			const originalSrc = img.src;
			const fallback = img.getAttribute("data-fallback");

			// Use image cache for loading
			loadImageWithCache(img, originalSrc, fallback).catch(() => {
				if (fallback && img.src !== fallback) {
					img.src = fallback;
				}
			});

			img.addEventListener("error", function () {
				if (fallback && this.src !== fallback) {
					this.src = fallback;
				}
			});
		});
	}

	/**
	 * Render AO3-specific metadata in the modal
	 * @param {Object} novel - Novel data
	 */
	static renderModalMetadata(novel) {
		const container = document.getElementById("modal-metadata-container");
		if (!container) return;

		const metadata = novel.metadata || {};
		const stats = metadata.stats || {};

		const getVal = (key, fallback = null) => {
			if (novel[key] !== undefined && novel[key] !== null)
				return novel[key];
			if (metadata[key] !== undefined && metadata[key] !== null)
				return metadata[key];
			if (stats[key] !== undefined && stats[key] !== null)
				return stats[key];
			return fallback;
		};

		const getArray = (key) => {
			const val = getVal(key);
			if (Array.isArray(val)) return val;
			if (metadata[key] && Array.isArray(metadata[key]))
				return metadata[key];
			return [];
		};

		// Extract values
		const rating = getVal("rating", "Not Rated");
		const language = getVal("language", "English");
		const status = getVal("status", "Unknown");
		const category = getVal("category", "");
		const chapters = getVal("chapters") || getVal("totalChapters", 0);
		const words = getVal("words", 0);
		const kudos = getVal("kudos", 0);
		const hits = getVal("hits", 0);
		const comments = getVal("comments", 0);
		const bookmarks = getVal("bookmarks", 0);
		const publishedDate = getVal("publishedDate") || getVal("published");
		const updatedDate = getVal("updatedDate") || getVal("updated");
		const workId = getVal("workId");

		// Extract arrays
		const fandoms = getArray("fandoms");
		const relationships = getArray("relationships");
		const characters = getArray("characters");
		const warnings = getArray("warnings");
		const additionalTags = getArray("additionalTags");

		// Helper to render a tag list
		const renderTagList = (items, extraClass = "") => {
			if (!items || items.length === 0)
				return '<span class="no-data">None</span>';
			return items
				.map(
					(item) =>
						`<span class="tag ${extraClass}">${this.escapeHtml(
							item
						)}</span>`
				)
				.join("");
		};

		// Helper to render a stat item
		const renderStat = (label, value, icon = "") => {
			if (value === undefined || value === null) return "";
			return `
				<div class="modal-stat-item">
					<span class="modal-stat-label">${icon} ${label}</span>
					<span class="modal-stat-value">${this.escapeHtml(value.toString())}</span>
				</div>
			`;
		};

		// Format dates
		const formatDate = (dateStr) => {
			if (!dateStr) return "Unknown";
			try {
				return new Date(dateStr).toLocaleDateString(undefined, {
					year: "numeric",
					month: "long",
					day: "numeric",
				});
			} catch (e) {
				return dateStr;
			}
		};

		let html = `
			<div class="ao3-modal-grid">
				<!-- Primary Metadata Row -->
				<div class="ao3-modal-row primary-meta">
					<div class="meta-group">
						<span class="meta-label">Rating</span>
						<span class="chip rating-badge ${this.getRatingClass(rating)}">${
			rating || "Not Rated"
		}</span>
					</div>
					<div class="meta-group">
						<span class="meta-label">Category</span>
						<span class="chip chip-ghost">${this.escapeHtml(category || "None")}</span>
					</div>
					<div class="meta-group">
						<span class="meta-label">Language</span>
						<span class="chip chip-ghost">${this.escapeHtml(language || "English")}</span>
					</div>
					<div class="meta-group">
						<span class="meta-label">Status</span>
						<span class="chip ${
							status.toLowerCase() === "completed" ||
							status.toLowerCase() === "complete"
								? "chip-success"
								: "chip-warning"
						}">${this.escapeHtml(status || "Unknown")}</span>
					</div>
				</div>

				<!-- Statistics Grid -->
				<div class="ao3-modal-section">
					<h4 class="modal-section-title">Statistics</h4>
					<div class="ao3-stats-grid-large">
						${renderStat("Chapters", this.formatNumber(chapters), "📖")}
						${renderStat("Words", this.formatNumber(words), "📝")}
						${renderStat("Kudos", this.formatNumber(kudos), "❤️")}
						${renderStat("Hits", this.formatNumber(hits), "👁️")}
						${renderStat("Comments", this.formatNumber(comments), "💬")}
						${renderStat("Bookmarks", this.formatNumber(bookmarks), "🔖")}
						${renderStat("Published", formatDate(publishedDate), "📅")}
						${renderStat("Updated", formatDate(updatedDate), "🔄")}
						${renderStat("Work ID", workId, "🆔")}
					</div>
				</div>

				<!-- Fandoms -->
				${
					fandoms.length > 0
						? `
				<div class="ao3-modal-section">
					<h4 class="modal-section-title">Fandoms</h4>
					<div class="tags-list">
						${renderTagList(fandoms, "tag-fandom")}
					</div>
				</div>`
						: ""
				}

				<!-- Relationships -->
				${
					relationships.length > 0
						? `
				<div class="ao3-modal-section">
					<h4 class="modal-section-title">Relationships</h4>
					<div class="tags-list">
						${renderTagList(relationships, "tag-relationship")}
					</div>
				</div>`
						: ""
				}

				<!-- Characters -->
				${
					characters.length > 0
						? `
				<div class="ao3-modal-section">
					<h4 class="modal-section-title">Characters</h4>
					<div class="tags-list">
						${renderTagList(characters, "tag-character")}
					</div>
				</div>`
						: ""
				}

				<!-- Warnings -->
				${
					warnings.length > 0
						? `
				<div class="ao3-modal-section">
					<h4 class="modal-section-title">Warnings</h4>
					<div class="tags-list">
						${renderTagList(warnings, "tag-warning")}
					</div>
				</div>`
						: ""
				}

				<!-- Additional Tags -->
				${
					additionalTags.length > 0
						? `
				<div class="ao3-modal-section">
					<h4 class="modal-section-title">Additional Tags</h4>
					<div class="tags-list">
						${renderTagList(additionalTags, "tag-additional")}
					</div>
				</div>`
						: ""
				}
			</div>
		`;

		container.innerHTML = html;
	}

	/**
	 * Get additional CSS for AO3 cards
	 */
	static getCustomStyles() {
		return `
			/* AO3 Card Layout - Optimized for no cover images */
			.ao3-card {
				background: var(--bg-card, #2c2e33);
				border-radius: 12px;
				overflow: hidden;
				transition: transform 0.2s ease, box-shadow 0.2s ease;
				cursor: pointer;
				border: 1px solid var(--border-color, #373a40);
			}

			.ao3-card:hover {
				transform: translateY(-2px);
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
				border-color: var(--primary-color, #990000);
			}

			.ao3-card-layout {
				display: flex;
				min-height: 180px;
			}

			/* Left side - Placeholder */
			.ao3-card-left {
				position: relative;
				width: 100px;
				flex-shrink: 0;
			}

			.ao3-cover-placeholder {
				width: 100%;
				height: 100%;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				position: relative;
				overflow: hidden;
			}

			.ao3-placeholder-pattern {
				position: absolute;
				inset: 0;
				background-image:
					linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%),
					linear-gradient(-45deg, rgba(255,255,255,0.03) 25%, transparent 25%),
					linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.03) 75%),
					linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.03) 75%);
				background-size: 20px 20px;
				background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
			}

			.ao3-placeholder-content {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 8px;
				z-index: 1;
			}

			.ao3-placeholder-rating {
				font-size: 1.5rem;
				font-weight: 700;
				color: rgba(255, 255, 255, 0.95);
				text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
			}

			.ao3-placeholder-category {
				font-size: 1.1rem;
				color: rgba(255, 255, 255, 0.8);
			}

			.ao3-placeholder-icon {
				position: absolute;
				bottom: 8px;
				right: 8px;
				font-size: 1rem;
				opacity: 0.4;
			}

			.ao3-reading-badge {
				position: absolute;
				bottom: 0;
				left: 0;
				right: 0;
				padding: 4px 6px;
				font-size: 0.65rem;
				font-weight: 600;
				text-align: center;
				text-transform: uppercase;
				letter-spacing: 0.5px;
				background: rgba(0, 0, 0, 0.7);
				color: #fff;
				backdrop-filter: blur(4px);
			}

			/* Right side - Content */
			.ao3-card-right {
				flex: 1;
				padding: 12px 14px;
				display: flex;
				flex-direction: column;
				gap: 8px;
				min-width: 0;
			}

			.ao3-card-header {
				display: flex;
				flex-direction: column;
				gap: 2px;
			}

			.ao3-card-title {
				margin: 0;
				font-size: 0.95rem;
				font-weight: 600;
				color: var(--text-primary, #e9ecef);
				line-height: 1.3;
				display: -webkit-box;
				-webkit-line-clamp: 2;
				-webkit-box-orient: vertical;
				overflow: hidden;
			}

			.ao3-card-author {
				font-size: 0.8rem;
				color: var(--text-secondary, #adb5bd);
			}

			.ao3-card-author strong {
				color: var(--text-primary, #e9ecef);
			}

			.ao3-card-badges {
				display: flex;
				flex-wrap: wrap;
				gap: 4px;
			}

			.ao3-card-badges .chip {
				font-size: 0.65rem;
				padding: 2px 6px;
				border-radius: 4px;
			}

			.ao3-card-stats {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
			}

			.ao3-quick-stat {
				font-size: 0.75rem;
				color: var(--text-secondary, #adb5bd);
				display: flex;
				align-items: center;
				gap: 3px;
			}

			.ao3-card-tags {
				display: flex;
				flex-wrap: wrap;
				gap: 4px;
				margin-top: auto;
			}

			.ao3-tag {
				font-size: 0.7rem;
				padding: 2px 8px;
				border-radius: 12px;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				max-width: 180px;
			}

			.ao3-tag-fandom {
				background: rgba(153, 0, 0, 0.2);
				color: #ff8a80;
				border: 1px solid rgba(153, 0, 0, 0.3);
			}

			.ao3-tag-relationship {
				background: rgba(156, 39, 176, 0.2);
				color: #ce93d8;
				border: 1px solid rgba(156, 39, 176, 0.3);
			}

			.ao3-card-footer {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
				margin-top: 4px;
			}

			.ao3-progress-section {
				flex: 1;
				display: flex;
				flex-direction: column;
				gap: 3px;
			}

			.ao3-progress-bar {
				height: 4px;
				background: rgba(255, 255, 255, 0.1);
				border-radius: 2px;
				overflow: hidden;
			}

			.ao3-progress-fill {
				height: 100%;
				background: linear-gradient(90deg, #990000, #cc3333);
				border-radius: 2px;
				transition: width 0.3s ease;
			}

			.ao3-progress-text {
				font-size: 0.65rem;
				color: var(--text-muted, #868e96);
			}

			.ao3-open-btn {
				width: 28px;
				height: 28px;
				display: flex;
				align-items: center;
				justify-content: center;
				background: var(--primary-color, #990000);
				color: #fff;
				border-radius: 6px;
				text-decoration: none;
				font-size: 0.85rem;
				transition: background 0.2s ease;
				flex-shrink: 0;
			}

			.ao3-open-btn:hover {
				background: var(--primary-hover, #bb0000);
			}

			/* AO3 Rating Colors */
			.rating-badge.rating-general { background: #77a02e; color: #fff; }
			.rating-badge.rating-teen { background: #d4a90a; color: #000; }
			.rating-badge.rating-mature { background: #d4650a; color: #fff; }
			.rating-badge.rating-explicit { background: #9e1414; color: #fff; }
			.rating-badge.rating-not-rated { background: #666; color: #fff; }

			/* Status badges on placeholder */
			.ao3-reading-badge.status-plan_to_read { background: rgba(92, 124, 250, 0.9); }
			.ao3-reading-badge.status-reading { background: rgba(81, 207, 102, 0.9); }
			.ao3-reading-badge.status-completed { background: rgba(153, 0, 0, 0.9); }
			.ao3-reading-badge.status-on_hold { background: rgba(252, 196, 25, 0.9); color: #000; }
			.ao3-reading-badge.status-dropped { background: rgba(255, 107, 107, 0.9); }
			.ao3-reading-badge.status-re_reading { background: rgba(156, 39, 176, 0.9); }

			/* Chip styles */
			.chip {
				display: inline-flex;
				align-items: center;
				padding: 2px 8px;
				border-radius: 4px;
				font-size: 0.7rem;
				font-weight: 500;
			}

			.chip-ghost {
				background: rgba(255, 255, 255, 0.1);
				color: var(--text-secondary, #adb5bd);
			}

			.chip-success {
				background: rgba(81, 207, 102, 0.2);
				color: #51cf66;
			}

			.chip-warning {
				background: rgba(252, 196, 25, 0.2);
				color: #fcc419;
			}

			/* Light mode adjustments */
			@media (prefers-color-scheme: light) {
				.ao3-card {
					background: #ffffff;
					border-color: #dee2e6;
				}

				.ao3-card:hover {
					border-color: #990000;
				}

				.ao3-card-title {
					color: #212529;
				}

				.ao3-card-author {
					color: #495057;
				}

				.ao3-card-author strong {
					color: #212529;
				}

				.ao3-quick-stat {
					color: #495057;
				}

				.ao3-progress-bar {
					background: rgba(0, 0, 0, 0.1);
				}

				.ao3-progress-text {
					color: #868e96;
				}

				.chip-ghost {
					background: rgba(0, 0, 0, 0.05);
					color: #495057;
				}
			}
		`;
	}
}

// Register the AO3 renderer
registerCardRenderer("ao3", AO3CardRenderer);
