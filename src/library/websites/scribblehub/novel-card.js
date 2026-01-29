/**
 * ScribbleHub Novel Card Component
 * Extends base novel card to show ScribbleHub-specific metadata
 */

import { NovelCardRenderer } from "../novel-card-base.js";
import {
	READING_STATUS,
	READING_STATUS_INFO,
	novelLibrary,
} from "../../../utils/novel-library.js";
import { loadImageWithCache } from "../../../utils/image-cache.js";
import { getBaseModalStyles, getScribbleHubStyles } from "../modal-styles.js";

const CARD_CANONICAL_LABELS = new Map();

const CARD_CATEGORY_LOOKUP = {
	fandoms: new Set(),
	genres: new Set(),
	characters: new Set(),
	contentTypes: new Set(),
	tags: new Set(),
};

const MAX_CARD_GENRES = 3;
const MAX_CARD_TAGS = 3;

export class ScribbleHubNovelCard extends NovelCardRenderer {
	// Shelf configuration for ScribbleHub
	static get shelfConfig() {
		return {
			id: "scribblehub",
			name: "ScribbleHub",
			icon: "https://www.scribblehub.com/favicon.ico",
			emoji: "✨",
			color: "#6c5ce7",
		};
	}
	/**
	 * Show ScribbleHub-specific novel detail modal
	 * @param {Object} novel - The novel to show
	 * @returns {Promise<boolean>} True if handled
	 */
	static async showModal(novel) {
		const modal = document.getElementById("novel-modal");
		if (!modal) return false;

		const titleEl = document.getElementById("modal-title");
		if (titleEl) titleEl.textContent = novel.title || "";

		const authorEl = document.getElementById("modal-author");
		const authorUrl = novel.metadata?.authorUrl;
		if (authorEl) {
			if (authorUrl) {
				authorEl.innerHTML = `<a href="${this.escapeHtml(authorUrl)}" target="_blank" rel="noreferrer" style="color: inherit; text-decoration: underline;">${this.escapeHtml(
					novel.author || "Unknown",
				)}</a>`;
			} else {
				authorEl.textContent = `${novel.author || "Unknown"}`;
			}
		}

		const descriptionEl = document.getElementById("modal-description");
		if (descriptionEl) descriptionEl.textContent = novel.description || "";

		const coverImg = document.getElementById("modal-cover");
		const coverContainer = document.getElementById("modal-cover-container");

		if (coverContainer) {
			coverContainer.innerHTML = "";
			if (novel.coverUrl && coverImg) {
				coverImg.src = novel.coverUrl;
				coverImg.style.display = "block";
				coverImg.onerror = () => {
					coverImg.src = this.shelfConfig.icon;
				};
				if (!coverContainer.contains(coverImg))
					coverContainer.appendChild(coverImg);
			} else if (coverImg) {
				coverImg.src = this.shelfConfig.icon;
				coverImg.style.display = "block";
			}
		} else if (coverImg) {
			if (novel.coverUrl) {
				coverImg.src = novel.coverUrl;
				coverImg.style.display = "block";
			} else {
				coverImg.src = this.shelfConfig.icon;
				coverImg.style.display = "block";
			}
		}

		// Restore generic stats
		const genericStats = document.querySelector(".novel-stats");
		if (genericStats) genericStats.style.display = "";

		// Hide custom metadata if not used
		const metadataContainer = document.getElementById(
			"modal-metadata-container",
		);
		if (metadataContainer) {
			if (this.renderModalMetadata) {
				metadataContainer.style.display = "block";
				if (genericStats) genericStats.style.display = "none";
				this.renderModalMetadata(novel);
			} else {
				metadataContainer.style.display = "none";
			}
		}

		const continueBtn = document.getElementById("modal-continue-btn");
		if (continueBtn) {
			const lastReadUrl =
				novel.lastReadChapterUrl ||
				novel.currentChapterUrl ||
				novel.sourceUrl;
			if (lastReadUrl) {
				continueBtn.href = lastReadUrl;
				continueBtn.style.display = "inline-flex";
			} else {
				continueBtn.style.display = "none";
			}
		}

		const readBtn = document.getElementById("modal-source-btn");
		if (readBtn && novel.sourceUrl) {
			readBtn.href = novel.sourceUrl;
			readBtn.style.display = "inline-flex";
		}

		const modalRemoveBtn = document.getElementById("modal-remove-btn");
		if (modalRemoveBtn) modalRemoveBtn.dataset.novelId = novel.id;

		const modalStatus = document.getElementById("modal-status");
		if (modalStatus) modalStatus.dataset.novelId = novel.id;

		const statusButtons = document.querySelectorAll(".status-btn");
		const currentStatus =
			novel.readingStatus || READING_STATUS.PLAN_TO_READ;

		statusButtons.forEach((btn) => {
			const status = btn.getAttribute("data-status");
			if (status === currentStatus) {
				btn.classList.add("active");
			} else {
				btn.classList.remove("active");
			}

			btn.onclick = async () => {
				if (!novelLibrary) return;
				try {
					await novelLibrary.updateNovel(novel.id, {
						readingStatus: status,
					});
					statusButtons.forEach((b) => {
						if (b.getAttribute("data-status") === status)
							b.classList.add("active");
						else b.classList.remove("active");
					});
					if (modalStatus && READING_STATUS_INFO[status]) {
						modalStatus.textContent =
							READING_STATUS_INFO[status].label;
					}
				} catch (e) {
					console.error(e);
				}
			};
		});

		modal.classList.remove("hidden");
		modal.classList.add("active");
		document.body.style.overflow = "hidden";

		return true;
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

	static categorizeLabel(label) {
		const lower = label.toLowerCase();
		if (CARD_CATEGORY_LOOKUP.genres.has(lower)) return "genres";
		if (CARD_CATEGORY_LOOKUP.tags.has(lower)) return "tags";
		return null;
	}

	static primeTaxonomy(novels = []) {
		this.resetTaxonomy();
		novels.forEach((novel) => {
			const metadata = novel.metadata || {};
			(metadata.fandoms || []).forEach((f) =>
				this.registerLabel(f, "fandoms"),
			);
			(novel.fandoms || []).forEach((f) =>
				this.registerLabel(f, "fandoms"),
			);
			(metadata.genres || []).forEach((g) =>
				this.registerLabel(g, "genres"),
			);
			(novel.genres || []).forEach((g) =>
				this.registerLabel(g, "genres"),
			);
			(metadata.characters || []).forEach((c) =>
				this.registerLabel(c, "characters"),
			);
			(novel.characters || []).forEach((c) =>
				this.registerLabel(c, "characters"),
			);
			(metadata.contentTypes || []).forEach((ct) =>
				this.registerLabel(ct, "contentTypes"),
			);
			(novel.contentTypes || []).forEach((ct) =>
				this.registerLabel(ct, "contentTypes"),
			);
			(metadata.tags || []).forEach((t) => this.registerLabel(t, "tags"));
			(novel.tags || []).forEach((t) => this.registerLabel(t, "tags"));
		});
	}

	static buildTagBuckets(novel) {
		const metadata = novel.metadata || {};
		const buckets = {
			fandoms: new Set(),
			genres: new Set(),
			characters: new Set(),
			contentTypes: new Set(),
			tags: new Set(),
		};

		const addValue = (value, forcedCategory) => {
			if (!value) return;
			const canonical = this.canonicalizeLabel(value, forcedCategory);
			const category =
				forcedCategory || this.categorizeLabel(canonical) || "tags";
			buckets[category].add(canonical);
		};

		const addList = (list, forcedCategory) => {
			(list || []).forEach((item) => addValue(item, forcedCategory));
		};

		addList(metadata.fandoms, "fandoms");
		addList(novel.fandoms, "fandoms");
		addList(metadata.genres, "genres");
		addList(novel.genres, "genres");
		addList(metadata.characters, "characters");
		addList(novel.characters, "characters");
		addList(metadata.contentTypes, "contentTypes");
		addList(novel.contentTypes, "contentTypes");
		addList(metadata.tags, "tags");
		addList(novel.tags, "tags");

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
		card.className = "novel-card scribblehub-card";
		card.dataset.novelId = novel.id;

		const metadata = novel.metadata || {};
		const statsObj = novel.stats || {};

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
		const chapters = getVal("totalChapters") || getVal("chapterCount") || 0;
		const currentChapter =
			getVal("lastReadChapter") || getVal("currentChapter") || 0;
		const safeCurrent = chapters
			? Math.min(currentChapter || 0, chapters)
			: currentChapter || 0;
		const progressPercent = chapters
			? Math.min(100, Math.round((safeCurrent / chapters) * 100))
			: 0;

		// Essential metadata
		const rating = getVal("rating");
		const language = getVal("language");
		const isCrossover = !!getVal("isCrossover", false);
		const workStatus = getVal("status");
		const words = getVal("words", 0);
		const reviews = getVal("reviews", 0);
		const favorites = getVal("favorites", 0);

		// Get tag buckets
		const buckets = this.buildTagBuckets(novel);
		const primaryGenre = [...buckets.genres][0] || "";

		// Simple rating badge
		const ratingClass = this.normalizeRatingClass(rating);
		const ratingBadge = rating
			? `<span class="chip rating-badge ${ratingClass}">${this.escapeHtml(
					rating,
				)}</span>`
			: "";

		// Status badge
		const isCompleted =
			workStatus && workStatus.toLowerCase() === "completed";
		const statusBadge = workStatus
			? `<span class="chip ${
					isCompleted ? "chip-success" : "chip-warning"
				}">${this.escapeHtml(workStatus)}</span>`
			: "";

		// Quick stats
		const statsText = [];
		if (chapters) statsText.push(`${this.formatNumber(chapters)} ch`);
		if (words) statsText.push(`${this.formatNumber(words)} words`);
		if (favorites) statsText.push(`${this.formatNumber(favorites)} fav`);

		const statsHTML =
			statsText.length > 0
				? `<div class="sh-stats-text">${statsText.join(" • ")}</div>`
				: "";

		// Genre tag
		const genreHTML = primaryGenre
			? `<div class="sh-genre-tag">${this.escapeHtml(
					this.truncateText(primaryGenre, 40),
				)}</div>`
			: "";

		// Progress bar
		const progressLabel = chapters
			? `📖 ${this.formatNumber(safeCurrent)} / ${this.formatNumber(chapters)}`
			: `📖 ${this.formatNumber(safeCurrent)}`;
		const progressHTML =
			chapters > 0 || safeCurrent > 0 || enhanced > 0
				? `<div class="sh-progress-bar"><div class="sh-progress-fill" style="width: ${progressPercent}%;"></div></div>
			   <div class="sh-progress-text">${progressLabel}</div>
			   <div class="sh-progress-subtext">✨ ${this.formatNumber(enhanced)} enhanced</div>`
				: "";

		card.innerHTML = `
			<div class="sh-card-content">
				<div class="sh-card-main">
					<h3 class="sh-card-title" title="${this.escapeHtml(
						novel.title,
					)}">${this.escapeHtml(novel.title)}</h3>
					<p class="sh-card-author">by ${this.escapeHtml(novel.author || "Unknown")}</p>

					<div class="sh-card-metadata">
						${ratingBadge}
						${statusBadge}
						${language ? `<span class="chip">${this.escapeHtml(language)}</span>` : ""}
						${isCrossover ? `<span class="chip">Crossover</span>` : ""}
					</div>

					${statsHTML}
					${genreHTML}

					<div class="sh-card-progress">
						${progressHTML}
					</div>
				</div>

				<div class="sh-card-status">
					<span class="sh-reading-status" style="background-color: ${
						statusInfo.color
					};">${statusInfo.label}</span>
					${
						novel.sourceUrl
							? `<a class="sh-link-btn" href="${this.escapeHtml(
									novel.sourceUrl,
								)}" target="_blank" rel="noreferrer" title="Open on ScribbleHub">↗</a>`
							: ""
					}
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
	 * Set up error handlers for images and use caching (avoids CSP inline handler issues)
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
					metadata.rating,
				)}">${metadata.rating}</span>`,
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
					workStatus,
				)}</span>`,
			);
		}
		if (metadata.language) {
			badges.push(
				`<span class="meta-badge">${this.escapeHtml(
					metadata.language,
				)}</span>`,
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
			MAX_CARD_CHARACTERS,
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
	 * Render ScribbleHub-specific metadata in the modal
	 * @param {Object} novel - Novel data
	 */
	static renderModalMetadata(novel) {
		const container = document.getElementById("modal-metadata-container");
		if (!container) return;

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

		const rating = getVal("rating"); // ScribbleHub doesn't always have explicit "T/M" rating, but metadata might
		const language = getVal("language", "English");
		const status = getVal("status", "Unknown");
		const chapters = getVal("totalChapters") || getVal("chapterCount") || 0;
		const words = getVal("words", 0);
		const views = getVal("views", 0);
		const favorites = getVal("favorites", 0);
		const readers = getVal("readers", 0);
		const reviews = getVal("reviews", 0);
		const publishedDate = getVal("publishedDate");
		const updatedDate = getVal("updatedDate");

		const genres = getArray("genres");
		const tags = getArray("tags");
		const fandoms = getArray("fandoms");

		const renderStat = (label, value, icon = "") => {
			if (value === undefined || value === null) return "";
			return `
				<div class="modal-stat-item">
					<span class="modal-stat-label">${icon} ${label}</span>
					<span class="modal-stat-value">${this.escapeHtml(value.toString())}</span>
				</div>
			`;
		};

		const styles = getBaseModalStyles() + getScribbleHubStyles();

		const html = `
			${styles}
			<div class="site-modal-grid scribblehub-modal-grid">
				<div class="site-modal-row primary-meta">
					${
						rating
							? `<div class="meta-group"><span class="meta-label">Rating</span><span class="chip rating-badge">${this.escapeHtml(rating)}</span></div>`
							: ""
					}
					<div class="meta-group">
						<span class="meta-label">Status</span>
						<span class="chip ${status.toLowerCase() === "completed" ? "chip-success" : "chip-warning"}">${this.escapeHtml(status)}</span>
					</div>
					<div class="meta-group">
						<span class="meta-label">Language</span>
						<span class="chip chip-ghost">${this.escapeHtml(language)}</span>
					</div>
				</div>

				<div class="site-modal-section scribblehub-modal-section">
					<h4 class="modal-section-title">Statistics</h4>
					<div class="site-stats-grid scribblehub-stats-grid">
						${renderStat("Chapters", this.formatNumber(chapters), "📖")}
						${renderStat("Readers", this.formatNumber(readers), "👥")}
						${renderStat("Views", this.formatNumber(views), "👁️")}
						${renderStat("Favorites", this.formatNumber(favorites), "⭐")}
						${renderStat("Reviews", this.formatNumber(reviews), "💬")}
						${publishedDate ? renderStat("Published", new Date(publishedDate).toLocaleDateString(), "📅") : ""}
						${updatedDate ? renderStat("Updated", new Date(updatedDate).toLocaleDateString(), "🔄") : ""}
					</div>
				</div>

				${
					fandoms.length
						? `
					<div class="scribblehub-modal-section">
						<h4 class="modal-section-title">Fandoms</h4>
						<div class="tags-list">
							${fandoms.map((f) => `<span class="tag tag-fandom">${this.escapeHtml(f)}</span>`).join("")}
						</div>
					</div>
				`
						: ""
				}

				${
					genres.length
						? `
					<div class="scribblehub-modal-section">
						<h4 class="modal-section-title">Genres</h4>
						<div class="tags-list">
							${genres.map((g) => `<span class="tag tag-genre">${this.escapeHtml(g)}</span>`).join("")}
						</div>
					</div>
				`
						: ""
				}

				${
					tags.length
						? `
					<div class="scribblehub-modal-section">
						<h4 class="modal-section-title">Tags</h4>
						<div class="tags-list">
							${tags.map((t) => `<span class="tag">${this.escapeHtml(t)}</span>`).join("")}
						</div>
					</div>
				`
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
}

// Export class as default
export default ScribbleHubNovelCard;
