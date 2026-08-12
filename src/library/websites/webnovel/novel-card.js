/**
 * @fileoverview WebNovel card renderer.
 *
 * WebNovel exposes far less than AO3 or NovelBin — the handler scrapes status,
 * genres, tags and a chapter count and nothing else — so this stays close to
 * the base renderer and only adds what WebNovel actually has.
 */

import { NovelCardRenderer } from "../novel-card-base.js";
import { getBaseModalStyles } from "../modal-styles.js";

/** WebNovel labels chapter counts `chapterCount`, unlike every other site. */
function totalChaptersOf(novel) {
	return (
		novel.totalChapters ||
		novel.metadata?.totalChapters ||
		novel.metadata?.chapterCount ||
		0
	);
}

export class WebNovelNovelCard extends NovelCardRenderer {
	static get shelfConfig() {
		return {
			id: "webnovel",
			name: "WebNovel",
			icon: "https://www.webnovel.com/favicon.ico",
			emoji: "\u{1F4D6}",
			color: "#ff6600",
		};
	}

	static renderCardMeta(novel) {
		const total = totalChaptersOf(novel);
		return `
			<div class="novel-card-meta">
				<span class="meta-item" title="Enhanced chapters">
					&#10024; ${novel.enhancedChaptersCount || 0}
				</span>
				<span class="meta-item" title="Total chapters">
					&#128214; ${total || "?"}
				</span>
			</div>
		`;
	}

	static renderModalMetadata(novel) {
		const container = document.getElementById("modal-metadata-container");
		if (!container) return;

		const metadata = novel.metadata || {};
		const status = metadata.status || novel.status || "";
		const total = totalChaptersOf(novel);
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

		const tagSection = (title, values) =>
			values.length
				? `<div class="site-modal-section">
						<h4 class="modal-section-title">${title}</h4>
						<div class="tags-list">
							${values.map((v) => `<span class="tag">${this.escapeHtml(v)}</span>`).join("")}
						</div>
					</div>`
				: "";

		const statusChipClass =
			status.toLowerCase() === "completed"
				? "chip-success"
				: "chip-ghost";

		container.innerHTML = `
			${getBaseModalStyles()}
			<div class="site-modal-grid">
				<div class="site-modal-row primary-meta">
					${
						status
							? `<div class="meta-group">
									<span class="meta-label">Status</span>
									<span class="chip ${statusChipClass}">${this.escapeHtml(status)}</span>
								</div>`
							: ""
					}
					<div class="meta-group">
						<span class="meta-label">Chapters</span>
						<span class="modal-stat-value">${total ? total.toLocaleString() : "—"}</span>
					</div>
					<div class="meta-group">
						<span class="meta-label">Enhanced</span>
						<span class="modal-stat-value">${(novel.enhancedChaptersCount || 0).toLocaleString()}</span>
					</div>
				</div>
				${tagSection("Genres", genres)}
				${tagSection("Tags", tags)}
			</div>
		`;
	}
}

export default WebNovelNovelCard;
