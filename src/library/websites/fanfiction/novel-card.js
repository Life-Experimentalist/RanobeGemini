/**
 * FanFiction.net Novel Card Component
 * Extends base novel card to show FanFiction-specific metadata
 */

import { NovelCardRenderer } from "../novel-card-base.js";
import {
	READING_STATUS,
	READING_STATUS_INFO,
} from "../../../utils/novel-library.js";
import { loadImageWithCache } from "../../../utils/image-cache.js";

const CARD_CANONICAL_LABELS = new Map();

const CARD_DOMAIN_TYPES = [
	"Anime",
	"Books",
	"Cartoons",
	"Comics",
	"Games",
	"Misc",
	"Plays",
	"Movies",
	"TV",
];

const CARD_CATEGORY_LOOKUP = {
	fandoms: new Set(),
	genres: new Set(),
	characters: new Set(),
	tags: new Set(),
	contentTypes: new Set(),
};

const MAX_CARD_FANDOMS = 2;
const MAX_CARD_GENRES = 2;
const MAX_CARD_CHARACTERS = 4;
const MAX_CARD_MISC_TAGS = 2;

export class FanFictionNovelCard extends NovelCardRenderer {
	// Shelf configuration for FanFiction.net
	static get shelfConfig() {
		return {
			id: "fanfiction",
			name: "FanFiction.net",
			icon: "https://www.fanfiction.net/static/icons3/ff-icon-192.png",
			emoji: "✍️",
			color: "#2a4b8d",
		};
	}

	static resetTaxonomy() {
		CARD_CANONICAL_LABELS.clear();
		Object.values(CARD_CATEGORY_LOOKUP).forEach((set) => set.clear());
	}

	static registerLabel(label, category) {
		if (!label) return "";
		const cleaned = label.toString().trim();
		if (!cleaned) return "";
		const lower = cleaned.toLowerCase();
		if (!CARD_CANONICAL_LABELS.has(lower)) {
			CARD_CANONICAL_LABELS.set(lower, cleaned);
		}
		if (category && CARD_CATEGORY_LOOKUP[category]) {
			CARD_CATEGORY_LOOKUP[category].add(lower);
		}
		return CARD_CANONICAL_LABELS.get(lower) || cleaned;
	}

	static canonicalizeLabel(label, category) {
		return this.registerLabel(label, category);
	}

	static normalizeRatingClass(rating) {
		const val = (rating || "").toString().trim().toLowerCase();
		if (!val) return "";
		if (val === "k+") return "rating-kp";
		return `rating-${val}`;
	}

	static isDomainLabel(label) {
		if (!label) return false;
		return CARD_DOMAIN_TYPES.some(
			(domain) =>
				domain.toLowerCase() === label.toString().trim().toLowerCase()
		);
	}

	static categorizeLabel(label) {
		const lower = label.toLowerCase();
		if (CARD_CATEGORY_LOOKUP.fandoms.has(lower)) return "fandoms";
		if (CARD_CATEGORY_LOOKUP.genres.has(lower)) return "genres";
		if (CARD_CATEGORY_LOOKUP.characters.has(lower)) return "characters";
		if (CARD_CATEGORY_LOOKUP.tags.has(lower)) return "tags";
		if (CARD_CATEGORY_LOOKUP.contentTypes.has(lower)) return "contentTypes";
		return null;
	}

	static primeTaxonomy(novels = []) {
		this.resetTaxonomy();
		novels.forEach((novel) => {
			const metadata = novel.metadata || {};
			(metadata.fandoms || []).forEach((f) =>
				this.registerLabel(f, "fandoms")
			);
			(metadata.characters || []).forEach((c) =>
				this.registerLabel(c, "characters")
			);
			(metadata.genres || []).forEach((g) =>
				this.registerLabel(g, "genres")
			);
			(novel.genres || []).forEach((g) =>
				this.registerLabel(g, "genres")
			);
			(metadata.tags || []).forEach((t) => this.registerLabel(t, "tags"));
			(novel.tags || []).forEach((t) => this.registerLabel(t, "tags"));
			(metadata.hierarchy || []).forEach((entry) => {
				if (this.isDomainLabel(entry?.name)) {
					this.registerLabel(entry.name, "contentTypes");
				}
			});
		});
	}

	static buildTagBuckets(novel) {
		const metadata = novel.metadata || {};
		const buckets = {
			fandoms: new Set(),
			genres: new Set(),
			characters: new Set(),
			tags: new Set(),
			contentTypes: new Set(),
		};

		const addValue = (value, forcedCategory) => {
			if (!value) return;
			const canonical = this.canonicalizeLabel(value, forcedCategory);
			const domainCategory = this.isDomainLabel(canonical)
				? "contentTypes"
				: null;
			const category =
				forcedCategory ||
				domainCategory ||
				this.categorizeLabel(canonical) ||
				"tags";
			buckets[category].add(canonical);
		};

		const addList = (list, forcedCategory) => {
			(list || []).forEach((item) => addValue(item, forcedCategory));
		};

		addList(metadata.fandoms, "fandoms");
		addList(metadata.characters, "characters");
		addList(metadata.genres, "genres");
		addList(novel.genres, "genres");
		addList(metadata.tags, "tags");
		addList(novel.tags, "tags");

		(metadata.hierarchy || []).forEach((entry) => {
			if (this.isDomainLabel(entry?.name)) {
				addValue(entry.name, "contentTypes");
			}
		});

		// Only keep misc tags in tags bucket
		[...buckets.tags].forEach((tag) => {
			if (
				buckets.fandoms.has(tag) ||
				buckets.genres.has(tag) ||
				buckets.characters.has(tag) ||
				buckets.contentTypes.has(tag)
			) {
				buckets.tags.delete(tag);
			}
		});

		return buckets;
	}

	static collectTags(novel) {
		const buckets = this.buildTagBuckets(novel);
		return [
			...buckets.fandoms,
			...buckets.genres,
			...buckets.characters,
			...buckets.contentTypes,
			...buckets.tags,
		];
	}

	static renderCard(novel) {
		const card = document.createElement("div");
		card.className = "novel-card fanfic-card";
		card.dataset.novelId = novel.id;

		const config = this.shelfConfig;
		const metadata = novel.metadata || {};
		const statsObj = novel.stats || {};

		// Flexible getters so we can read from top-level, metadata, or stats
		const getVal = (key, fallback = null) => {
			if (novel[key] !== undefined && novel[key] !== null)
				return novel[key];
			if (metadata[key] !== undefined && metadata[key] !== null)
				return metadata[key];
			if (statsObj[key] !== undefined && statsObj[key] !== null)
				return statsObj[key];
			return fallback;
		};
		const coverUrl = novel.coverUrl || "";
		const fallbackCover = this.getFallbackCover(config);
		// Use data attributes instead of inline onerror to avoid CSP violations
		const coverMarkup = coverUrl
			? `<img class="novel-cover-img" src="${this.escapeHtml(
					coverUrl
			  )}" alt="${this.escapeHtml(
					novel.title
			  )}" data-fallback="${fallbackCover}" loading="lazy">`
			: `<div class="novel-cover-placeholder">📚</div>`;

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
		const chapters = getVal("totalChapters") || getVal("chapterCount") || 0;
		const progressPercent = chapters
			? Math.min(100, Math.round((enhanced / chapters) * 100))
			: 0;
		const progressLabel = chapters
			? `${this.formatNumber(enhanced)}/${this.formatNumber(
					chapters
			  )} enhanced`
			: `${this.formatNumber(enhanced)} enhanced`;

		// Build all badge chips
		const rating = getVal("rating");
		const language = getVal("language");
		const isCrossover = !!getVal("isCrossover", false);
		const workStatus = getVal("status");

		const ratingBadge = rating
			? `<span class="chip rating-badge ${this.normalizeRatingClass(
					rating
			  )}" title="Content Rating">${rating}</span>`
			: "";
		const languageBadge = language
			? `<span class="chip chip-ghost" title="Language">${this.escapeHtml(
					language
			  )}</span>`
			: "";
		const typeBadge =
			isCrossover !== undefined
				? `<span class="chip ${
						isCrossover ? "chip-crossover" : "chip-ghost"
				  }" title="Work Type">${
						isCrossover ? "Crossover" : "Single Fandom"
				  }</span>`
				: "";
		const workStatusBadge = workStatus
			? `<span class="chip ${
					workStatus.toLowerCase() === "completed"
						? "chip-success"
						: "chip-warning"
			  }" title="Publication Status">${this.escapeHtml(
					workStatus
			  )}</span>`
			: "";

		// Build comprehensive stats display
		const stats = [];
		if (chapters)
			stats.push({ icon: "📖", label: "Chapters", value: chapters });

		const words = getVal("words", 0);
		const reviews = getVal("reviews", 0);
		const favorites = getVal("favorites", 0);
		const follows = getVal("follows", 0);
		const publishedDate = getVal("publishedDate");
		const updatedDate = getVal("updatedDate");

		if (words) stats.push({ icon: "📝", label: "Words", value: words });
		if (reviews)
			stats.push({
				icon: "💬",
				label: "Reviews",
				value: reviews,
			});
		if (favorites)
			stats.push({
				icon: "⭐",
				label: "Favorites",
				value: favorites,
			});
		if (follows)
			stats.push({
				icon: "👥",
				label: "Follows",
				value: follows,
			});
		if (publishedDate)
			stats.push({
				icon: "📅",
				label: "Published",
				value: this.formatDateShort(publishedDate),
				isDate: true,
			});
		if (updatedDate)
			stats.push({
				icon: "🔄",
				label: "Updated",
				value: this.formatDateShort(updatedDate),
				isDate: true,
			});

		const statMarkup = stats
			.map(
				(stat) => `
					<div class="card-stat-badge" title="${this.escapeHtml(stat.label)}">
						<span class="card-stat-label">${this.escapeHtml(stat.label)}</span>
						<span class="card-stat-value">${this.escapeHtml(
							stat.isDate
								? stat.value
								: this.formatNumber(stat.value)
						)}</span>
					</div>
				`
			)
			.join("");

		// Build fandom, genre, and character tags
		const buckets = this.buildTagBuckets(novel);
		const fandoms = [...buckets.fandoms].slice(0, 3);
		const genres = [...buckets.genres].slice(0, 4);
		const characters = [...buckets.characters].slice(0, 5);

		const renderTagGroup = (label, items, className, max = null) => {
			if (!items || items.length === 0) return "";
			const display = max ? items.slice(0, max) : items;
			const remaining = max ? Math.max(0, items.length - max) : 0;
			const markup = display
				.map(
					(tag) =>
						`<span class="tag ${className}">${this.escapeHtml(
							tag
						)}</span>`
				)
				.join("");
			const moreTag =
				remaining > 0
					? `<span class="tag-more">+${remaining}</span>`
					: "";
			return `
				<div class="tag-group">
					<span class="tag-group-label">${label}</span>
					<div class="tag-group-items">${markup}${moreTag}</div>
				</div>
			`;
		};

		const fandomMarkup = renderTagGroup(
			"Fandoms",
			fandoms,
			"tag-fandom",
			3
		);
		const genreMarkup = renderTagGroup("Genres", genres, "tag-genre", 4);
		const characterMarkup = renderTagGroup(
			"Characters",
			characters,
			"tag-character",
			5
		);

		// Story ID badge
		const storyIdMarkup = metadata.storyId
			? `<div class="story-id-badge">Story ID: <code>${this.escapeHtml(
					metadata.storyId
			  )}</code></div>`
			: "";

		card.innerHTML = `
			<div class="fanfic-card-horizontal">
				${
					coverUrl
						? `<img class="fanfic-bg-blur" src="${this.escapeHtml(
								coverUrl
						  )}" alt="" aria-hidden="true" loading="lazy">`
						: ""
				}
				<div class="fanfic-cover-wrapper">
					${coverMarkup}
					<span class="novel-status-badge ${statusClass}">${statusInfo.label}</span>
				</div>

				<div class="fanfic-main-content">
					<div class="fanfic-head">
						<h3 class="fanfic-title" title="${this.escapeHtml(
							novel.title
						)}">${this.escapeHtml(novel.title)}</h3>
						<div class="fanfic-meta-row">
							<span class="fanfic-author">by <strong>${this.escapeHtml(
								novel.author || "Unknown"
							)}</strong></span>
							<div class="fanfic-badges-inline">
								${ratingBadge}
							</div>
						</div>
						<div class="fanfic-meta-row fanfic-meta-row-secondary">
							<div class="fanfic-badges-inline">
								${languageBadge}${typeBadge}${workStatusBadge}
							</div>
						</div>
					</div>

					<div class="fanfic-enhancement-strip">
						<div class="progress-bar-slim">
							<div class="progress-fill" style="width: ${progressPercent}%;"></div>
						</div>
						<span class="enhancement-text">✨ <strong>${this.formatNumber(
							enhanced
						)}</strong> / ${this.formatNumber(
			chapters
		)} enhanced <span class="dim">(${progressPercent}%)</span></span>
					</div>

					${statMarkup ? `<div class="card-stats-bar">${statMarkup}</div>` : ""}

					<div class="fanfic-tags-area">
						${fandomMarkup}${genreMarkup}${characterMarkup}
					</div>

					<div class="fanfic-foot">
						${storyIdMarkup}
						<div class="fanfic-actions-right">
							<span class="status-pill-small" style="background: ${statusInfo.color}">${
			statusInfo.label
		}</span>
							${
								novel.sourceUrl
									? `<a class="action-btn" href="${this.escapeHtml(
											novel.sourceUrl
									  )}" target="_blank" rel="noreferrer">Open ↗</a>`
									: ""
							}
						</div>
					</div>
				</div>
			</div>
		`;

		card.addEventListener("click", (e) => {
			if (!e.target.closest("button, a")) {
				this.onCardClick(novel);
			}
		});

		// Set up image error handling after card is in DOM
		this.setupImageErrorHandlers(card);

		return card;
	}

	/**
	 * Set up error handlers for images and use caching (avoids CSP inline handler issues)
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
				// If cache loading fails, just use fallback
				if (fallback && img.src !== fallback) {
					img.src = fallback;
				}
			});

			// Also add error handler as backup
			img.addEventListener("error", function () {
				if (fallback && this.src !== fallback) {
					this.src = fallback;
				}
			});
		});
	}

	static renderCardMeta(novel) {
		const metadata = novel.metadata || {};
		const badges = [];
		if (metadata.rating) {
			badges.push(
				`<span class="rating-badge ${this.normalizeRatingClass(
					metadata.rating
				)}">${metadata.rating}</span>`
			);
		}
		if (novel.status || metadata.status) {
			const workStatus = novel.status || metadata.status;
			const statusClass =
				workStatus && workStatus.toLowerCase() === "completed"
					? "status-completed"
					: "status-ongoing";
			badges.push(
				`<span class="meta-badge ${statusClass}">${this.escapeHtml(
					workStatus
				)}</span>`
			);
		}
		if (metadata.language) {
			badges.push(
				`<span class="meta-badge">${this.escapeHtml(
					metadata.language
				)}</span>`
			);
		}

		return badges.join("");
	}

	static buildStatLine(novel) {
		const metadata = novel.metadata || {};
		const statsObj = novel.stats || {};
		const getVal = (key, fallback = null) => {
			if (novel[key] !== undefined && novel[key] !== null)
				return novel[key];
			if (metadata[key] !== undefined && metadata[key] !== null)
				return metadata[key];
			if (statsObj[key] !== undefined && statsObj[key] !== null)
				return statsObj[key];
			return fallback;
		};
		const parts = [];
		const enhanced = novel.enhancedChaptersCount ?? 0;
		parts.push(`✨ ${this.formatNumber(enhanced)} enhanced`);

		const chapters =
			getVal("totalChapters") || getVal("chapterCount") || null;
		if (chapters) {
			parts.push(`📖 ${this.formatNumber(chapters)} ch`);
		}

		const words = getVal("words", 0);
		const favorites = getVal("favorites", 0);
		const follows = getVal("follows", 0);
		const reviews = getVal("reviews", 0);

		if (words) parts.push(`📝 ${this.formatNumber(words)} words`);
		if (favorites) parts.push(`⭐ ${this.formatNumber(favorites)} favs`);
		if (follows) parts.push(`👥 ${this.formatNumber(follows)} follows`);
		if (reviews) parts.push(`💬 ${this.formatNumber(reviews)} reviews`);

		return parts.slice(0, 4).join(" • ");
	}

	static renderCardTags(novel) {
		const buckets = this.buildTagBuckets(novel);
		const fandoms = [...buckets.fandoms].slice(0, MAX_CARD_FANDOMS);
		const genres = [...buckets.genres].slice(0, MAX_CARD_GENRES);
		const characters = [...buckets.characters].slice(
			0,
			MAX_CARD_CHARACTERS
		);
		const contentTypes = [...buckets.contentTypes].slice(0, 2);
		const misc = [...buckets.tags].slice(0, MAX_CARD_MISC_TAGS);

		const displayedCount =
			fandoms.length +
			genres.length +
			characters.length +
			contentTypes.length +
			misc.length;
		const totalCount =
			buckets.fandoms.size +
			buckets.genres.size +
			buckets.characters.size +
			buckets.contentTypes.size +
			buckets.tags.size;
		const remaining = Math.max(0, totalCount - displayedCount);

		const renderTag = (tag, extraClass = "") =>
			`<span class="tag ${extraClass}">${this.escapeHtml(tag)}</span>`;

		const tagsMarkup = [
			...fandoms.map((tag) => renderTag(tag, "tag-fandom")),
			...genres.map((tag) => renderTag(tag)),
			...characters.map((tag) => renderTag(tag, "character-tag")),
			...contentTypes.map((tag) => renderTag(tag, "tag-source")),
			...misc.map((tag) => renderTag(tag)),
		];

		if (!tagsMarkup.length) return "";

		return `
			<div class="novel-tags">
				${tagsMarkup.join("")}
				${remaining > 0 ? `<span class="tag more-tags">+${remaining}</span>` : ""}
			</div>
		`;
	}
	/**
	 * Render FanFiction-specific metadata in the modal
	 * @param {Object} novel - Novel data
	 */
	static renderModalMetadata(novel) {
		const container = document.getElementById("modal-metadata-container");
		if (!container) return;

		// Robust data retrieval: Check top-level, metadata object, and stats object
		const metadata = novel.metadata || {};
		const stats = novel.stats || {};

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

		// Extract values using the robust helper
		const rating = getVal("rating", "Unknown");
		const language = getVal("language", "English");
		const status = getVal("status", "Unknown");
		const isCrossover = getVal("isCrossover", false);
		const totalChapters = getVal("totalChapters", 0);
		const words = getVal("words", 0);
		const reviews = getVal("reviews", 0);
		const favorites = getVal("favorites", 0);
		const follows = getVal("follows", 0);
		const publishedDate = getVal("publishedDate");
		const updatedDate = getVal("updatedDate");
		const storyId = getVal("storyId");

		// Extract arrays
		const fandoms = getArray("fandoms");
		const genres = getArray("genres");
		const characters = getArray("characters");
		const contentTypes = getArray("contentTypes"); // or from hierarchy

		// Fallback for tags if not found in standard keys
		let miscTags = getArray("tags");
		if (miscTags.length === 0 && metadata.tags) {
			miscTags = Array.from(metadata.tags);
		}
		// Filter out duplicates from miscTags that are already in other categories
		const knownTags = new Set([
			...fandoms,
			...genres,
			...characters,
			...contentTypes,
		]);
		miscTags = miscTags.filter((t) => !knownTags.has(t));

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
			<div class="fanfic-modal-grid">
				<!-- Primary Metadata Row -->
				<div class="fanfic-modal-row primary-meta">
					<div class="meta-group">
						<span class="meta-label">Fandom</span>
						<span class="chip chip-primary" title="${this.escapeHtml(
							fandoms.join(" & ")
						)}">${
			fandoms.length > 0
				? this.escapeHtml(
						fandoms.length > 1
							? `${fandoms[0]} +${fandoms.length - 1}`
							: fandoms[0]
				  )
				: "Unknown"
		}</span>
					</div>
					<div class="meta-group">
						<span class="meta-label">Rating</span>
						<span class="chip rating-badge ${this.normalizeRatingClass(rating)}">${
			rating || "Unknown"
		}</span>
					</div>
					<div class="meta-group">
						<span class="meta-label">Language</span>
						<span class="chip chip-ghost">${this.escapeHtml(language || "English")}</span>
					</div>
					<div class="meta-group">
						<span class="meta-label">Status</span>
						<span class="chip ${
							status.toLowerCase() === "completed"
								? "chip-success"
								: "chip-warning"
						}">${this.escapeHtml(status || "Unknown")}</span>
					</div>
					<div class="meta-group">
						<span class="meta-label">Type</span>
						<span class="chip ${isCrossover ? "chip-crossover" : "chip-ghost"}">${
			isCrossover ? "Crossover" : "Single Fandom"
		}</span>
					</div>
				</div>

				<!-- Statistics Grid -->
				<div class="fanfic-modal-section">
					<h4 class="modal-section-title">Statistics</h4>
					<div class="fanfic-stats-grid-large">
						${renderStat("Chapters", this.formatNumber(totalChapters), "📖")}
						${renderStat("Words", this.formatNumber(words), "📝")}
						${renderStat("Reviews", this.formatNumber(reviews), "💬")}
						${renderStat("Favorites", this.formatNumber(favorites), "⭐")}
						${renderStat("Follows", this.formatNumber(follows), "👥")}
						${renderStat("Published", formatDate(publishedDate), "📅")}
						${renderStat("Updated", formatDate(updatedDate), "🔄")}
						${renderStat("Story ID", storyId, "🆔")}
					</div>
				</div>

				<!-- Fandoms -->
				${
					fandoms.length > 0
						? `
				<div class="fanfic-modal-section">
					<h4 class="modal-section-title">Fandoms</h4>
					<div class="tags-list">
						${renderTagList(fandoms, "tag-fandom")}
					</div>
				</div>`
						: ""
				}

				<!-- Genres -->
				${
					genres.length > 0
						? `
				<div class="fanfic-modal-section">
					<h4 class="modal-section-title">Genres</h4>
					<div class="tags-list">
						${renderTagList(genres, "tag-genre")}
					</div>
				</div>`
						: ""
				}

				<!-- Characters -->
				${
					characters.length > 0
						? `
				<div class="fanfic-modal-section">
					<h4 class="modal-section-title">Characters</h4>
					<div class="tags-list">
						${renderTagList(characters, "tag-character")}
					</div>
				</div>`
						: ""
				}

				<!-- Other Tags -->
				${
					miscTags.length > 0 || contentTypes.length > 0
						? `
				<div class="fanfic-modal-section">
					<h4 class="modal-section-title">Tags & Content</h4>
					<div class="tags-list">
						${renderTagList(contentTypes, "tag-source")}
						${renderTagList(miscTags)}
					</div>
				</div>`
						: ""
				}
			</div>
		`;

		container.innerHTML = html;
	}

	/**
	 * Format large numbers with K/M abbreviations for readability
	 */
	static formatNumber(num) {
		if (num === null || num === undefined) return "0";
		const n =
			typeof num === "string" ? parseInt(num.replace(/,/g, ""), 10) : num;
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
	 * Get additional CSS for FanFiction cards
	 */
	static getCustomStyles() {
		return `
			/* Acrylic background for modal */
			.modal-backdrop {
				background: linear-gradient(135deg, rgba(42, 75, 141, 0.1) 0%, rgba(118, 75, 162, 0.08) 100%),
								url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" /></filter></defs><rect width="400" height="400" fill="transparent" filter="url(%23noise)" opacity="0.05" /></svg>');
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
				border: 1px solid rgba(255, 255, 255, 0.1);
			}

			/* Faded FanFiction icon background */
			.modal-bg-icon {
				position: absolute;
				top: 20px;
				right: 20px;
				width: 120px;
				height: 120px;
				opacity: 0.08;
				pointer-events: none;
				background-size: contain;
				background-repeat: no-repeat;
				background-position: center;
				filter: blur(1px);
			}

			.rating-badge {
				display: inline-block;
				padding: 4px 12px;
				border-radius: 6px;
				font-weight: 600;
				font-size: 14px;
				text-transform: uppercase;
			}

			.rating-k { background: #4caf50; color: white; }
			.rating-k\\+ { background: #8bc34a; color: white; }
			.rating-t { background: #ff9800; color: white; }
			.rating-m { background: #f44336; color: white; }

			.tag.crossover {
				background: linear-gradient(135deg, #667eea, #764ba2);
				color: white;
			}

			.tag.tag-fandom {
				background: rgba(92, 124, 250, 0.18);
				color: #5c7cfa;
				border: 1px solid rgba(92, 124, 250, 0.35);
			}

			.tag.tag-source {
				background: rgba(81, 207, 102, 0.12);
				color: #51cf66;
				border: 1px solid rgba(81, 207, 102, 0.35);
			}

			.tag.more-tags {
				background: rgba(92, 124, 250, 0.14);
				color: #5c7cfa;
			}

			.tag.single-fandom {
				background: #2a4b8d;
				color: white;
			}

			.character-tag {
				background: rgba(255, 193, 7, 0.1);
				border: 1px solid rgba(255, 193, 7, 0.3);
				color: #ffc107;
			}

			.dates-container {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}

			.date-item {
				display: flex;
				justify-content: space-between;
				padding: 6px;
				background: rgba(255, 255, 255, 0.03);
				border-radius: 4px;
			}

			.date-label {
				color: var(--text-muted);
				font-size: 13px;
			}

			.date-value {
				color: var(--text-primary);
				font-weight: 500;
			}

			.modal-work-stats {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
				gap: 12px;
			}

			.stat-item {
				display: flex;
				justify-content: space-between;
				padding: 8px 12px;
				background: rgba(255, 255, 255, 0.04);
				border-radius: 6px;
				border: 1px solid rgba(255, 255, 255, 0.1);
			}

			.stat-label {
				color: var(--text-muted);
				font-size: 13px;
			}

			.stat-value {
				color: var(--accent-primary);
				font-weight: 600;
				font-size: 14px;
			}

			.story-id {
				font-family: 'Courier New', monospace;
				background: rgba(255, 255, 255, 0.05);
				padding: 4px 8px;
				font-size: 12px;
			}
		`;
	}
}

// Export class as default
export default FanFictionNovelCard;
