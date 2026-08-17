/**
 * NovelBin Novel Card Component
 * Extends base novel card to show NovelBin-specific metadata
 */

import { NovelCardRenderer } from "../novel-card-base.js";
import {
	READING_STATUS,
	READING_STATUS_INFO,
} from "../../../utils/novel-library.js";
import { loadImageWithCache } from "../../../utils/image-cache.js";
import { getBaseModalStyles, getNovelbinStyles } from "../modal-styles.js";

const MAX_CARD_GENRES = 4;

export class NovelbinNovelCard extends NovelCardRenderer {
	static get shelfConfig() {
		return {
			id: "novelbin",
			name: "NovelBin (NovelArrow)",
			icon: "https://novelbin.com/favicon.ico",
			emoji: "📚",
			color: "#6200ea",
		};
	}

	static renderCard(novel) {
		const card = document.createElement("div");
		card.className = "nb-card";
		card.dataset.novelId = novel.id;

		const metadata = novel.metadata || {};

		const getVal = (key, fallback = null) => {
			if (novel[key] !== undefined && novel[key] !== null)
				return novel[key];
			if (metadata[key] !== undefined && metadata[key] !== null)
				return metadata[key];
			return fallback;
		};

		const coverUrl = novel.coverUrl || getVal("coverUrl") || "";
		const workStatus = getVal("status") || "";
		const language = getVal("language") || "";
		const totalChapters = getVal("totalChapters") || 0;
		const lastRead =
			novel.lastReadChapter || getVal("lastReadChapter") || 0;
		const enhanced = novel.enhancedChaptersCount ?? 0;
		const genres = Array.isArray(metadata.genres)
			? metadata.genres
			: Array.isArray(novel.genres)
				? novel.genres
				: [];

		const readingKeyRaw =
			novel.readingStatus || READING_STATUS.PLAN_TO_READ;
		const normalizedKey = readingKeyRaw.replace(/_/g, "-");
		const statusInfo =
			READING_STATUS_INFO[normalizedKey] ||
			READING_STATUS_INFO[READING_STATUS.PLAN_TO_READ];

		const safeRead = totalChapters
			? Math.min(lastRead, totalChapters)
			: lastRead;
		const progressPct = totalChapters
			? Math.min(100, Math.round((safeRead / totalChapters) * 100))
			: 0;

		const workStatusClass =
			workStatus.toLowerCase() === "ongoing"
				? "status-ongoing"
				: workStatus.toLowerCase() === "completed"
					? "status-completed"
					: workStatus.toLowerCase() === "hiatus"
						? "status-hiatus"
						: "";

		const coverHtml = coverUrl
			? `<img class="nb-cover-img" src="${this.escapeUrlAttr(coverUrl)}" alt="${this.escapeHtml(novel.title)}" loading="lazy" data-fallback="${this.escapeHtml(this.getFallbackCover(this.shelfConfig))}">`
			: `<div class="nb-cover-placeholder">📚</div>`;

		const genreHtml = genres
			.slice(0, MAX_CARD_GENRES)
			.map((g) => `<span class="nb-genre">${this.escapeHtml(g)}</span>`)
			.join("");

		const chapterText = totalChapters
			? `Ch. <strong>${safeRead}</strong> / ${totalChapters}`
			: `<strong>${enhanced}</strong> enhanced`;

		card.innerHTML = `
			${coverUrl ? `<img class="nb-card-bg" src="${this.escapeUrlAttr(coverUrl)}" alt="" aria-hidden="true" loading="lazy">` : ""}
			<div class="nb-cover-wrap">
				${coverHtml}
				<span class="nb-reading-badge" style="background:${statusInfo.color};">${statusInfo.label}</span>
			</div>
			<div class="nb-body">
				<h3 class="nb-title" title="${this.escapeHtml(novel.title)}">${this.escapeHtml(novel.title)}</h3>
				<p class="nb-author">by <strong>${this.escapeHtml(novel.author || "Unknown")}</strong></p>
				<div class="nb-meta-row">
					${workStatus ? `<span class="nb-badge ${workStatusClass}">${this.escapeHtml(workStatus)}</span>` : ""}
					${language ? `<span class="nb-badge nb-language">${this.escapeHtml(language)}</span>` : ""}
				</div>
				${genreHtml ? `<div class="nb-genres-row">${genreHtml}</div>` : ""}
				<div class="nb-enhance-strip">
					<div class="nb-progress-bar">
						<div class="nb-progress-fill" style="width:${progressPct}%"></div>
					</div>
					<span class="nb-enhance-text">${chapterText} • ✨ <strong>${this.formatNumber(enhanced)}</strong> enhanced</span>
				</div>
			</div>
		`;

		card.addEventListener("click", (e) => {
			if (!e.target.closest("button, a")) {
				this.onCardClick(novel);
			}
		});

		this._setupImageErrorHandlers(card);

		return card;
	}

	static _setupImageErrorHandlers(container) {
		container
			.querySelectorAll("img.nb-cover-img[data-fallback]")
			.forEach((img) => {
				const fallback = img.getAttribute("data-fallback");
				loadImageWithCache(img, img.src, fallback).catch(() => {
					if (fallback && img.src !== fallback) img.src = fallback;
				});
				img.addEventListener("error", function () {
					if (fallback && this.src !== fallback) this.src = fallback;
				});
			});
	}

	static renderModalMetadata(novel) {
		const container = document.getElementById("modal-metadata-container");
		if (!container) return;

		const metadata = novel.metadata || {};

		const getVal = (key, fallback = null) => {
			if (novel[key] !== undefined && novel[key] !== null)
				return novel[key];
			if (metadata[key] !== undefined && metadata[key] !== null)
				return metadata[key];
			return fallback;
		};

		const status = getVal("status", "Unknown");
		const language = getVal("language", "");
		const totalChapters = getVal("totalChapters") ?? null;
		const genres = Array.isArray(metadata.genres)
			? metadata.genres
			: Array.isArray(novel.genres)
				? novel.genres
				: [];
		const tags = Array.isArray(metadata.tags)
			? metadata.tags
			: Array.isArray(novel.tags)
				? novel.tags
				: [];
		const views = getVal("views", 0);
		const rating = getVal("rating", "");
		const updatedAt = getVal("updatedAt") || getVal("updateTime") || "";
		const source = getVal("source") || "";

		const statusLower = status.toLowerCase();
		const statusChipClass =
			statusLower === "completed"
				? "chip-completed"
				: statusLower === "hiatus"
					? "chip-hiatus"
					: "chip-ongoing";

		const renderStat = (label, value, icon = "") => {
			if (!value && value !== 0) return "";
			return `
				<div class="modal-stat-item">
					<span class="modal-stat-label">${icon} ${label}</span>
					<span class="modal-stat-value">${this.escapeHtml(String(value))}</span>
				</div>
			`;
		};

		const updatedText = updatedAt
			? (() => {
					try {
						return new Date(updatedAt).toLocaleDateString();
					} catch {
						return updatedAt;
					}
				})()
			: "";

		container.innerHTML = `
			${getBaseModalStyles()}${getNovelbinStyles()}
			<div class="novelbin-modal-grid">
				<div class="novelbin-primary-row">
					<div class="novelbin-meta-group">
						<span class="novelbin-meta-label">Status</span>
						<span class="novelbin-chip ${statusChipClass}">${this.escapeHtml(status)}</span>
					</div>
					${
						language
							? `
					<div class="novelbin-meta-group">
						<span class="novelbin-meta-label">Language</span>
						<span class="novelbin-meta-value">${this.escapeHtml(language)}</span>
					</div>`
							: ""
					}
					<div class="novelbin-meta-group">
						<span class="novelbin-meta-label">Chapters</span>
						<span class="novelbin-meta-value">${totalChapters != null ? this.formatNumber(totalChapters) : "—"}</span>
					</div>
					${
						rating
							? `
					<div class="novelbin-meta-group">
						<span class="novelbin-meta-label">Rating</span>
						<span class="novelbin-chip">${this.escapeHtml(rating)}</span>
					</div>`
							: ""
					}
					${
						source
							? `
					<div class="novelbin-meta-group">
						<span class="novelbin-meta-label">Source</span>
						<span class="novelbin-meta-value">${this.escapeHtml(source)}</span>
					</div>`
							: ""
					}
				</div>

				${
					views || updatedText
						? `
				<div class="site-modal-section">
					<h4 class="novelbin-section-title">Statistics</h4>
					<div class="site-stats-grid">
						${renderStat("Views", this.formatNumber(views), "👁️")}
						${updatedText ? renderStat("Updated", updatedText, "🔄") : ""}
					</div>
				</div>`
						: ""
				}

				${
					genres.length
						? `
				<div class="site-modal-section">
					<h4 class="novelbin-section-title">Genres</h4>
					<div class="novelbin-genres-row">
						${genres.map((g) => `<span class="novelbin-genre-tag">${this.escapeHtml(g)}</span>`).join("")}
					</div>
				</div>`
						: ""
				}
				${
					tags.length
						? `
				<div class="site-modal-section">
					<h4 class="novelbin-section-title">Tags</h4>
					<div class="novelbin-genres-row">
						${tags.map((t) => `<span class="novelbin-genre-tag novelbin-tag">${this.escapeHtml(t)}</span>`).join("")}
					</div>
				</div>`
						: ""
				}
			</div>
		`;
	}

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
}

export default NovelbinNovelCard;
