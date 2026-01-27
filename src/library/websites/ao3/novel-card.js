/**
 * @fileoverview AO3 Novel Card Renderer
 * Custom card rendering for Archive of Our Own novels with simplified text-only display
 * No images, focus on metadata and reading progress
 */

import { NovelCardRenderer, registerCardRenderer } from "../novel-card-base.js";
import { debugLog, debugError } from "../../../utils/logger.js";
import {
	READING_STATUS,
	READING_STATUS_INFO,
	novelLibrary,
} from "../../../utils/novel-library.js";
import { loadImageWithCache } from "../../../utils/image-cache.js";
import { getBaseModalStyles, getAO3Styles } from "../modal-styles.js";

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
								rating,
							)}</span>`
						: ""
				}
				${
					words
						? `<span class="meta-item" title="Word count">📝 ${this.formatNumber(
								words,
							)}</span>`
						: ""
				}
				${
					kudos
						? `<span class="meta-item" title="Kudos">❤️ ${this.formatNumber(
								kudos,
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
						item.text,
					)}</span>
				`,
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

		const enhanced = novel.enhancedChaptersCount ?? 0;
		const chapters = getVal("chapters") || getVal("totalChapters") || 0;
		const progressPercent = chapters
			? Math.min(100, Math.round((enhanced / chapters) * 100))
			: 0;

		// Get essential metadata
		const rating = getVal("rating");
		const language = getVal("language");
		const workStatus = getVal("status");
		const words = getVal("words", 0);
		const kudos = getVal("kudos", 0);
		const hits = getVal("hits", 0);
		const fandoms = metadata.fandoms || [];
		const primaryFandom = fandoms[0] || "";

		// Rating badge with simple text styling
		const ratingClass = this.getRatingClass(rating);
		const ratingBadge = rating
			? `<span class="chip rating-badge ${ratingClass}">${this.escapeHtml(rating)}</span>`
			: "";

		// Status badge
		const isCompleted =
			workStatus &&
			(workStatus.toLowerCase() === "completed" ||
				workStatus.toLowerCase() === "complete");
		const statusBadge = workStatus
			? `<span class="chip ${isCompleted ? "chip-success" : "chip-warning"}">${this.escapeHtml(workStatus)}</span>`
			: "";

		// Simple stats display
		const statsText = [];
		if (chapters) statsText.push(`${this.formatNumber(chapters)} ch`);
		if (words) statsText.push(`${this.formatNumber(words)} words`);
		if (kudos) statsText.push(`${this.formatNumber(kudos)} kudos`);

		const statsHTML =
			statsText.length > 0
				? `<div class="ao3-stats-text">${statsText.join(" • ")}</div>`
				: "";

		// Fandom display
		const fandomHTML = primaryFandom
			? `<div class="ao3-fandom-tag">${this.escapeHtml(this.truncateText(primaryFandom, 40))}</div>`
			: "";

		// Progress display
		const progressHTML =
			chapters > 0
				? `<div class="ao3-progress-bar"><div class="ao3-progress-fill" style="width: ${progressPercent}%;"></div></div>
			   <div class="ao3-progress-text">✨ ${this.formatNumber(enhanced)}/${this.formatNumber(chapters)}</div>`
				: "";

		card.innerHTML = `
			<div class="ao3-card-simple">
				<div class="ao3-card-main">
					<h3 class="ao3-card-title" title="${this.escapeHtml(novel.title)}">${this.escapeHtml(novel.title)}</h3>
					<p class="ao3-card-author">by ${this.escapeHtml(novel.author || "Anonymous")}</p>

					<div class="ao3-card-metadata">
						${ratingBadge}
						${statusBadge}
						${language ? `<span class="chip">${this.escapeHtml(language)}</span>` : ""}
					</div>

					${statsHTML}
					${fandomHTML}

					<div class="ao3-card-progress">
						${progressHTML}
					</div>
				</div>

				<div class="ao3-card-status">
					<span class="ao3-reading-status" style="background-color: ${statusInfo.color};">${statusInfo.label}</span>
					${novel.sourceUrl ? `<a class="ao3-link-btn" href="${this.escapeHtml(novel.sourceUrl)}" target="_blank" rel="noreferrer" title="Open on AO3">↗</a>` : ""}
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
			"img.novel-cover-img[data-fallback]",
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
							item,
						)}</span>`,
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

		const styles = getBaseModalStyles() + getAO3Styles();

		let html = `
			${styles}
			<div class="site-modal-grid ao3-modal-grid">
				<!-- Primary Metadata Row -->
				<div class="site-modal-row primary-meta">
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
				<div class="site-modal-section ao3-modal-section">
					<h4 class="modal-section-title">Statistics</h4>
					<div class="site-stats-grid ao3-stats-grid-large">
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
	 * Show AO3-specific novel detail modal
	 * @param {Object} novel - The novel to show
	 * @returns {Promise<boolean>} True if handled
	 */
	static async showModal(novel) {
		const modal = document.getElementById("novel-modal");
		if (!modal) return false;

		const metadata = novel.metadata || {};
		const rating = metadata.rating || novel.rating || "";

		// Basic Info
		const titleEl = document.getElementById("modal-title");
		if (titleEl) titleEl.textContent = novel.title || "";

		const authorEl = document.getElementById("modal-author");
		if (authorEl) {
			authorEl.textContent = `${novel.author || "Anonymous"}`;
		}

		const descriptionEl = document.getElementById("modal-description");
		if (descriptionEl) descriptionEl.textContent = novel.description || "";

		// Handle cover/placeholder - AO3 has no covers
		const coverContainer = document.getElementById("modal-cover-container");
		const coverImg = document.getElementById("modal-cover");

		if (coverContainer) {
			// Ensure styling is applied
			// Create a placeholder since AO3 has no cover images
			const gradientColors = this.getRatingGradient(rating);
			const shortRating = this.getShortRating(rating);
			const category = metadata.category || "";
			const categoryIcon = this.getCategoryIcon(category);

			const placeholderHTML = `
				<div class="ao3-modal-placeholder" style="background: linear-gradient(145deg, ${gradientColors.primary} 0%, ${gradientColors.secondary} 100%); width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; border-radius: 8px;">
					<div class="ao3-modal-placeholder-pattern"></div>
					<div class="ao3-modal-placeholder-content" style="z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; color: white;">
						<span class="ao3-modal-placeholder-rating" style="font-size: 2rem; font-weight: bold;">${shortRating}</span>
						<span class="ao3-modal-placeholder-category" style="font-size: 1.2rem;">${categoryIcon}</span>
						<span class="ao3-modal-placeholder-icon" style="position: absolute; bottom: 8px; right: 8px; opacity: 0.5;">🏛️</span>
					</div>
				</div>
			`;

			// Check if we need to create a wrapper or just append
			// We want to PRESERVE the existing img element but hide it
			const img = document.getElementById("modal-cover");
			if (img) img.style.display = "none";

			// Remove existing placeholder if any
			const existing = coverContainer.querySelector(
				".ao3-modal-placeholder",
			);
			if (existing) existing.remove();

			// Insert new placeholder
			coverContainer.insertAdjacentHTML("beforeend", placeholderHTML);
		} else if (coverImg) {
			// Fallback to old behavior if container doesn't exist
			coverImg.style.display = "none";
		}

		// Render Metadata
		const metadataContainer = document.getElementById(
			"modal-metadata-container",
		);
		if (metadataContainer) {
			metadataContainer.style.display = "block";
			// Hide generic stats as they duplicate info or are irrelevant
			const genericStats = document.querySelector(".novel-stats");
			if (genericStats) genericStats.style.display = "none";
		}
		if (this.renderModalMetadata) {
			this.renderModalMetadata(novel);
		}

		// Set up action buttons
		const continueBtn = document.getElementById("modal-continue-btn");
		if (continueBtn) {
			// Use last read chapter URL or source URL
			const continueUrl = novel.lastChapterUrl || novel.sourceUrl;
			if (continueUrl) {
				continueBtn.href = continueUrl;
				continueBtn.style.display = "inline-flex";
			} else {
				continueBtn.style.display = "none";
			}
		}

		const readBtn = document.getElementById("modal-source-btn"); // modal-read-btn in shelf-page vs modal-source-btn in library.js
		// library.js elements uses modal-source-btn. shelf-page uses modal-read-btn.
		// I should check library.html IDs.
		// library.js says: modalSourceBtn: document.getElementById("modal-source-btn")
		if (readBtn) {
			if (novel.sourceUrl) {
				readBtn.href = novel.sourceUrl;
				readBtn.style.display = "inline-flex";
			} else {
				readBtn.style.display = "none";
			}
		}

		// Remove button logic is handled by library.js global listeners or needs to be re-attached?
		// library.js attaches generic listeners to some buttons (refresh, remove) BUT in openDefaultNovelDetail it updates their datasets.
		// The modal is single instance. Listeners are attached ONCE in setupEventListeners of library.js usually.
		// Wait, openDefaultNovelDetail re-attaches?
		// openDefaultNovelDetail sets elements.modalRemoveBtn.dataset.novelId = novel.id;
		// library.js setupEventListeners calls handleRemoveNovel which reads dataset.novelId.
		// So I just need to update the dataset.

		const removeBtn = document.getElementById("modal-remove-btn");
		if (removeBtn) {
			removeBtn.dataset.novelId = novel.id;
		}

		const editBtn = document.getElementById("modal-edit-btn");
		if (editBtn) {
			// library.js handles the generic edit button click if we don't override it.
			// But here we're inside showModal, we might have prevented default behavior if we cloned the node or something.
			// But we are just accessing the existing node. The existing listeners from library.js persist unless we replace the node.
			// However, library.js listeners use closure variables like `currentlyOpenNovelId`.
			// `openNovelDetail` in library.js DOES NOT set `currentlyOpenNovelId` or similar global variable seen in `library.js` earlier?
			// Actually, `openDefaultNovelDetail` sets `elements.modalStatus.dataset.novelId = novel.id;` and library.js relies on that dataset id.
			// So if we set dataset attributes correctly, library.js listeners MIGHT work.
			// Let's check library.js listeners again.
		}

		// Critical: Set the dataset ID on the status badge or similar so generic listeners know which novel.
		// In library.js:
		/*
        elements.modalStatus.dataset.novelId = novel.id;
        */
		const modalStatus = document.getElementById("modal-status");
		if (modalStatus) {
			modalStatus.dataset.novelId = novel.id;
		}

		const modalRemoveBtn = document.getElementById("modal-remove-btn");
		if (modalRemoveBtn) {
			modalRemoveBtn.dataset.novelId = novel.id;
		}

		// Setup reading status buttons - these often need re-attaching because
		// library.js might not have attached permanent listeners to them if they are dynamically updated.
		// Wait, library.js `openDefaultNovelDetail` attaches listeners each time.
		// If we don't call `openDefaultNovelDetail`, those listeners are NOT attached.
		// So we MUST attach them.

		// Setup reading status buttons
		const statusButtons = document.querySelectorAll(".status-btn");
		const currentStatus =
			novel.readingStatus || READING_STATUS.PLAN_TO_READ;

		statusButtons.forEach((btn) => {
			const status = btn.getAttribute("data-status");

			// Set active state
			if (status === currentStatus) {
				btn.classList.add("active");
			} else {
				btn.classList.remove("active");
			}

			// Add click handler
			btn.onclick = async () => {
				if (!novelLibrary) return;

				try {
					await novelLibrary.updateNovel(novel.id, {
						readingStatus: status,
					});

					// Update button states
					statusButtons.forEach((b) => {
						if (b.getAttribute("data-status") === status) {
							b.classList.add("active");
						} else {
							b.classList.remove("active");
						}
					});

					// Update status badge text
					if (modalStatus && READING_STATUS_INFO[status]) {
						modalStatus.textContent =
							READING_STATUS_INFO[status].label;
					}
				} catch (err) {
					debugError("Failed to update status", err);
				}
			};
		});

		// Open the modal
		modal.classList.remove("hidden");
		document.body.style.overflow = "hidden";

		return true;
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
