/**
 * NovelArrow Website Content Handler
 *
 * Primary handler for novelarrow.com — the Next.js/React successor to NovelBin.
 * Extends NovelbinHandler and overrides the parts where NovelArrow differs:
 *
 *   URL patterns
 *     Novel detail : /novel/{slug}
 *     Chapter      : /chapter/{novel-slug}/{chapter-slug}   ← different from NovelBin
 *
 *   DOM structure
 *     Chapter content : <article data-chapter-id="...">
 *     Novel title     : h1.classic-novel-detail-title  (signed-in / legacy layout)
 *                       h1 inside .classic-detail-main  (signed-out / new React layout)
 *
 *   TTS safety
 *     Text replacement replaces only p.textContent, never restructures the article,
 *     so NovelArrow's built-in TTS reader keeps working on enhanced paragraphs.
 *
 *   SPA handling
 *     Overrides waitForChapterContent() to fingerprint article[data-chapter-id]
 *     instead of NovelBin's #chr-content — prevents premature re-init before
 *     React has swapped in the new chapter text.
 *
 * Shares the "novelbin" shelf id for backwards-compat with existing library data.
 * Priority 5 — beats NovelbinHandler (10) on novelarrow.com.
 */
import { NovelbinHandler } from "./novelbin-handler.js";
import { debugLog, debugError } from "../logger.js";

export class NovelarrowHandler extends NovelbinHandler {
	static SUPPORTED_DOMAINS = ["novelarrow.com", "www.novelarrow.com"];

	static DEFAULT_ENABLED = true;

	// Lower number = matched first. Must beat NovelbinHandler (10).
	static PRIORITY = 5;

	static SHELF_METADATA = {
		id: "novelbin", // keep for library backwards-compat
		isPrimary: true,
		name: "NovelArrow",
		icon: "https://novelarrow.com/favicon.ico",
		emoji: "🏹",
		color: "#d4a94c",
		novelIdPattern: /\/(?:novel|chapter)\/([a-z0-9-]+)/i,
		primaryDomain: "novelarrow.com",
		importUrlTemplate: "https://novelarrow.com/novel/{id}",
		taxonomy: [
			{ id: "genres", label: "Genres", type: "array" },
			{ id: "tags", label: "Tags", type: "array" },
			{ id: "status", label: "Status", type: "string" },
		],
	};

	static SETTINGS_DEFINITION = {
		fields: [
			{ key: "_nav", type: "section", label: "🌐 Domain" },
			{
				key: "novelBinBackup",
				label: "NovelBin backup domain",
				type: "select",
				defaultValue: "novelbin",
				description:
					"Domain used for NovelBin links when novelarrow.com is unavailable.",
				options: [
					{ value: "novelbin", label: "novelbin.com" },
					{ value: "novelbin-me", label: "novelbin.me" },
				],
			},
			{ key: "_enhance", type: "section", label: "✨ Enhancement" },
			{
				key: "autoEnhanceEnabled",
				label: "Auto-enhance chapters",
				type: "toggle",
				defaultValue: false,
				description: "Automatically run Enhance when a chapter loads.",
			},
		],
	};

	static DEFAULT_SITE_PROMPT =
		"This is a web novel from NovelArrow. Please maintain the author's style while improving the translation quality. Keep paragraph breaks, dialogue formatting, and scene transitions intact. Preserve special formatting for emphasis, flashbacks, or internal monologue. Place any translator notes in a clearly separated box at the end.";

	// No URL normalisation needed — novelarrow.com is always canonical.
	static initialize() {}

	canHandle() {
		const h = window.location.hostname;
		return h === "novelarrow.com" || h === "www.novelarrow.com";
	}

	// -----------------------------------------------------------------------
	// URL detection
	// -----------------------------------------------------------------------

	/** NovelArrow chapter: /chapter/{novel-slug}/{chapter-slug} */
	_isChapterPageUrl(pathname = window.location.pathname) {
		const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
		return parts.length >= 3 && parts[0] === "chapter";
	}

	/** NovelArrow detail: /novel/{slug} */
	_isDetailPageUrl(pathname = window.location.pathname) {
		const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
		return parts.length === 2 && parts[0] === "novel";
	}

	/**
	 * Extract novel slug from:
	 *   /chapter/{novel-slug}/{chapter-slug}
	 *   /novel/{slug}
	 */
	_novelSlug(url = window.location.href) {
		try {
			const path = new URL(url).pathname;
			const chap = path.match(/^\/chapter\/([a-z0-9-]+)\//i);
			if (chap) return chap[1];
			const nov = path.match(/^\/novel\/([a-z0-9-]+)/i);
			if (nov) return nov[1];
		} catch { /* ignore */ }
		return null;
	}

	// -----------------------------------------------------------------------
	// SPA — wait for the right content element to change
	// -----------------------------------------------------------------------

	async waitForChapterContent(timeoutMs = 8000, oldFingerprint = "") {
		const POLL_MS = 150;
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			const article = document.querySelector("article[data-chapter-id]");
			if (article) {
				const chapterId = article.getAttribute("data-chapter-id") || "";
				const text = article.textContent.trim();
				if (text.length > 50) {
					// Use data-chapter-id as primary fingerprint — it changes the moment
					// React swaps the chapter, before the full text is even rendered.
					// Fall back to text comparison if oldFingerprint was a text slice.
					const isNewChapter =
						!oldFingerprint ||
						chapterId !== oldFingerprint ||
						text.slice(0, 300) !== oldFingerprint;
					if (isNewChapter) return true;
				}
			}
			await new Promise((r) => setTimeout(r, POLL_MS));
		}
		return false;
	}

	// -----------------------------------------------------------------------
	// Content area
	// -----------------------------------------------------------------------

	findContentArea() {
		const article = document.querySelector("article[data-chapter-id]");
		if (article && article.textContent.trim().length > 100) {
			debugLog("NovelArrow: found content via article[data-chapter-id]");
			return article;
		}
		return super.findContentArea();
	}

	// -----------------------------------------------------------------------
	// Title extraction
	// -----------------------------------------------------------------------

	extractTitle() {
		if (this._isChapterPageUrl()) {
			// og:novel:novel_name is the clean story title without the chapter suffix
			const novelMeta = document.querySelector(
				'meta[name="og:novel:novel_name"]',
			);
			if (novelMeta?.content) return novelMeta.content;
		}
		// Novel detail page — try both layouts before falling back to parent
		return (
			this._extractNovelDetailTitle() ||
			super.extractTitle()
		);
	}

	/**
	 * Extract the novel title from the detail page.
	 * Handles both the signed-in "legacy-minimal" layout (h1.classic-novel-detail-title)
	 * and the signed-out "default" React layout (generic h1 inside .classic-detail-main).
	 */
	_extractNovelDetailTitle() {
		// Signed-in layout
		const h1Classic = document.querySelector("h1.classic-novel-detail-title");
		if (h1Classic?.textContent?.trim()) return h1Classic.textContent.trim();
		// Signed-out layout — first h1 inside the main detail column
		const h1Main = document.querySelector(".classic-detail-main h1");
		if (h1Main?.textContent?.trim()) return h1Main.textContent.trim();
		return null;
	}

	// -----------------------------------------------------------------------
	// Metadata — handles both signed-in (legacy) and signed-out (new React) layout
	// -----------------------------------------------------------------------

	extractNovelMetadata() {
		const metadata = {
			title: null,
			author: null,
			description: null,
			coverUrl: null,
			mainNovelUrl: null,
			genres: [],
			tags: [],
			status: null,
			chapterCount: null,
			language: null,
			needsDetailPage: false,
			metadataIncomplete: false,
		};

		const getMeta = (attr, val) =>
			document
				.querySelector(`meta[${attr}="${val}"]`)
				?.getAttribute("content") || null;

		try {
			if (this._isChapterPageUrl()) {
				// Chapter page: only meta tags are reliable (React may not have rendered)
				metadata.title = getMeta("name", "og:novel:novel_name");
				metadata.coverUrl = getMeta("property", "og:image");
				metadata.description =
					getMeta("name", "description") ||
					getMeta("property", "og:description");
				metadata.mainNovelUrl = this.getNovelPageUrl();
				this._extractGenreTagsFromDom(metadata);
				metadata.needsDetailPage = !metadata.title;
				metadata.metadataIncomplete = true;
				return metadata;
			}

			// ── Novel detail page ──────────────────────────────────────────────
			// Title: try DOM first (both layouts), then og:title fallback
			metadata.title = this._extractNovelDetailTitle();
			if (!metadata.title) {
				const ogTitle = getMeta("property", "og:title");
				metadata.title = ogTitle
					? ogTitle
							.replace(/\s*[|\-–]\s*Read\s+Online.*$/i, "")
							.replace(/\s+Novel\s*$/i, "")
							.trim()
					: null;
			}

			// Author: same selector works in both layouts
			const authorLink = document.querySelector("a[href^='/author']");
			if (authorLink) metadata.author = authorLink.textContent.trim();

			// Cover image: try legacy selector, then new layout's img, then og:image
			const coverImgLegacy = document.querySelector(
				".classic-detail-cover-book img",
			);
			if (coverImgLegacy) {
				metadata.coverUrl =
					coverImgLegacy.dataset.src || coverImgLegacy.getAttribute("src");
			}
			if (!metadata.coverUrl) {
				// New layout: large cover img inside the hero section
				const coverImgNew = document.querySelector(
					".classic-detail-main img[class*='object-cover'], .classic-detail-main section img",
				);
				if (coverImgNew) {
					metadata.coverUrl =
						coverImgNew.dataset.src || coverImgNew.getAttribute("src");
				}
			}
			if (!metadata.coverUrl) {
				metadata.coverUrl = getMeta("property", "og:image");
			}

			// Description: look for dedicated element, fall back to og:description
			const descEl = document.querySelector(
				".novel-synopsis, .classic-novel-detail-description, [class*='synopsis'], [class*='description']",
			);
			if (descEl) {
				const dc = descEl.cloneNode(true);
				dc.querySelectorAll("button, .showmore, [role='button']").forEach(
					(e) => e.remove(),
				);
				const raw = dc.textContent.trim();
				if (raw.length > 20) metadata.description = raw;
			}
			if (!metadata.description) {
				metadata.description =
					getMeta("name", "description") ||
					getMeta("property", "og:description");
			}

			// Status: SVG badge title ("Completed", "Ongoing", etc.) near the cover
			const statusTitle = document.querySelector(
				"svg title[id*='completed'], svg title[id*='ongoing'], svg title[id*='status']",
			);
			if (statusTitle?.textContent?.trim()) {
				metadata.status = statusTitle.textContent.trim();
			}
			if (!metadata.status) {
				// Fallback: look for text after a "Status:" label
				const allText = document.body.textContent;
				const statusMatch = allText.match(/Status\s*:\s*([^\n\r,]+)/i);
				if (statusMatch) metadata.status = statusMatch[1].trim();
			}

			// Chapter count: badge like "297 Chapters" on the cover image
			const chapterBadge = document.querySelector(
				"[class*='tracking-'] span, span[class*='font-bold']",
			);
			if (chapterBadge) {
				const chMatch = chapterBadge.textContent.match(/(\d+)\s*Chapter/i);
				if (chMatch) metadata.chapterCount = parseInt(chMatch[1], 10);
			}

			// Genres / tags
			this._extractGenreTagsFromDom(metadata);

			// Canonical URL
			const canonical = document.querySelector('link[rel="canonical"]');
			metadata.mainNovelUrl =
				canonical?.getAttribute("href") || window.location.href;
		} catch (err) {
			debugError("NovelArrow: Error extracting metadata:", err);
		}

		if (metadata.chapterCount && !metadata.totalChapters) {
			metadata.totalChapters = metadata.chapterCount;
		}

		debugLog("NovelArrow: Extracted metadata:", metadata);
		return metadata;
	}

	_extractGenreTagsFromDom(metadata) {
		document.querySelectorAll("a[href^='/genre/']").forEach((a) => {
			const g = a.textContent.trim();
			if (g && !metadata.genres.includes(g)) metadata.genres.push(g);
		});
		document.querySelectorAll("a[href^='/tag/']").forEach((a) => {
			const t = a.textContent.trim();
			if (t && !metadata.tags.includes(t)) metadata.tags.push(t);
		});
	}

	// -----------------------------------------------------------------------
	// TTS-safe text replacement
	// Replaces only p.textContent in-place, never restructures the DOM,
	// so NovelArrow's built-in TTS reader still works after enhancement.
	// -----------------------------------------------------------------------

	supportsTextOnlyEnhancement() {
		return true;
	}

	applyEnhancedContent(contentArea, enhancedText) {
		if (!contentArea || !enhancedText?.trim()) return 0;

		// Collect only real content paragraphs — exclude any injected gemini elements
		// so TTS enumeration of <p> nodes is never polluted by banner/button text.
		const GEMINI_SELECTOR = [
			".gemini-master-banner",
			".gemini-main-summary-group",
			".gemini-chunk-banner",
			".gemini-chunk-summary-group",
			".gemini-wip-banner",
			".gemini-enhanced-banner",
			"#gemini-chunked-content",
			"[class^='gemini-']",
			"[id^='gemini-']",
		].join(", ");

		const existingPs = Array.from(
			contentArea.querySelectorAll("div > p, p"),
		).filter((p) => !p.closest(GEMINI_SELECTOR));

		if (!existingPs.length) {
			return super.applyEnhancedContent(contentArea, enhancedText);
		}

		// Extract paragraphs from the enhanced content.
		// Preferred path: parse HTML <p> tags directly (AI often returns them).
		// Fallback: plain-text splitting on any newline sequence.
		let enhancedParas;
		if (/<p[\s>]/i.test(enhancedText)) {
			const tmp = document.createElement("div");
			tmp.innerHTML = enhancedText;
			enhancedParas = Array.from(tmp.querySelectorAll("p"))
				.map((p) => p.textContent.trim())
				.filter((p) => p.length > 0);
		}
		if (!enhancedParas || enhancedParas.length === 0) {
			// Plain-text path: strip HTML then split on any newline run
			const stripped = enhancedText
				.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
				.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
				.replace(/<\/p>|<br\s*\/?>/gi, "\n")
				.replace(/<[^>]+>/g, "")
				.replace(/&amp;/g, "&")
				.replace(/&lt;/g, "<")
				.replace(/&gt;/g, ">")
				.replace(/&quot;/g, '"')
				.replace(/&#039;/g, "'")
				.replace(/&nbsp;/g, " ")
				// Strip markdown markers
				.replace(/^#{1,6}\s+/gm, "")
				.replace(/\*\*\*([^*\n]+)\*\*\*/g, "$1")
				.replace(/\*\*([^*\n]+)\*\*/g, "$1")
				.replace(/__([^_\n]+)__/g, "$1")
				.replace(/\*([^*\n]+)\*/g, "$1")
				.replace(/_([^_\n]+)_/g, "$1")
				.replace(/`([^`\n]+)`/g, "$1")
				.replace(/~~([^~\n]+)~~/g, "$1")
				.replace(/^\s*[-*+]\s+/gm, "")
				.replace(/^\s*\d+\.\s+/gm, "")
				.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
				.replace(/^>\s*/gm, "");
			enhancedParas = stripped
				.split(/\n+/)
				.map((p) => p.trim())
				.filter((p) => p.length > 0);
		}

		if (!enhancedParas.length) return 0;

		let updated = 0;
		const limit = Math.min(enhancedParas.length, existingPs.length);
		for (let i = 0; i < limit; i++) {
			if (existingPs[i].textContent.trim().length > 0) {
				existingPs[i].textContent = enhancedParas[i];
				updated++;
			}
		}

		debugLog(
			`NovelArrow: TTS-safe replacement — ${updated}/${existingPs.length} paragraphs` +
			` (${enhancedParas.length} enhanced paras parsed)`,
		);
		return updated;
	}

	// -----------------------------------------------------------------------
	// UI insertion points
	// -----------------------------------------------------------------------

	getUIInsertionPoint(contentArea) {
		// Insert before the .select-text reader wrapper — this places banners
		// between the decorative chapter header (cover image + dividing line)
		// and the actual paragraph text, so TTS enumeration of <p> nodes is
		// unaffected by our injected elements.
		const readerWrapper = document.querySelector(
			"div.select-text, [class*='select-text']",
		);
		if (readerWrapper) return { element: readerWrapper, position: "before" };

		const article =
			contentArea ?? document.querySelector("article[data-chapter-id]");
		if (article) return { element: article, position: "before" };
		return super.getUIInsertionPoint(contentArea);
	}

	getNovelPageUIInsertionPoint() {
		if (this.isNovelPage()) {
			const cols = document.querySelector(".classic-detail-columns");
			if (cols) return { element: cols, position: "before" };
			const main = document.querySelector(
				"main.classic-novel-detail-shell, main",
			);
			if (main) return { element: main, position: "before" };
		}
		// Chapter page: insert above the full-page reading wrapper
		const wrapper = document.querySelector(
			".min-h-screen.w-full, div.min-h-screen",
		);
		if (wrapper) return { element: wrapper, position: "before" };
		const article = document.querySelector("article[data-chapter-id]");
		if (article) return { element: article, position: "before" };
		return super.getNovelPageUIInsertionPoint();
	}

	// -----------------------------------------------------------------------
	// Chapter navigation
	// -----------------------------------------------------------------------

	getChapterNavigation() {
		try {
			let prevUrl = null;
			let nextUrl = null;

			for (const link of document.querySelectorAll(
				"a[href*='/chapter/']",
			)) {
				const label = (
					link.getAttribute("aria-label") ||
					link.title ||
					link.textContent ||
					""
				).toLowerCase();
				if (!prevUrl && (label.includes("prev") || label.includes("previous"))) {
					prevUrl = link.href;
				}
				if (!nextUrl && (label.includes("next") || label.includes("forward"))) {
					nextUrl = link.href;
				}
				if (prevUrl && nextUrl) break;
			}

			let currentChapter = null;
			const fromUrl = window.location.pathname.match(/chapter-(\d+)/i);
			if (fromUrl) currentChapter = parseInt(fromUrl[1], 10);

			return {
				hasPrevious: !!prevUrl,
				hasNext: !!nextUrl,
				previousUrl: prevUrl,
				nextUrl,
				currentChapter: currentChapter ?? 0,
				totalChapters: 0,
			};
		} catch (err) {
			debugError("NovelArrow: Error getting chapter navigation:", err);
			return super.getChapterNavigation();
		}
	}

	// -----------------------------------------------------------------------
	// Identity
	// -----------------------------------------------------------------------

	getSiteIdentifier() {
		return "NovelArrow";
	}

	getDefaultPrompt() {
		return NovelarrowHandler.DEFAULT_SITE_PROMPT;
	}

	getSiteSpecificPrompt() {
		return NovelarrowHandler.DEFAULT_SITE_PROMPT;
	}
}

export default new NovelarrowHandler();
