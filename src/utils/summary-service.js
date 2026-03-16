/**
 * Summary Service — Unified content-summary pipeline for Ranobe Gemini
 *
 * Single entry point for both pre-enhancement (raw page) and post-enhancement
 * (chunked) summaries.  Replaces the two divergent code paths that previously
 * lived in content.js (`summarizeChunkRange` and `handleSummarizeClick`).
 *
 * Because all page-level helpers (DOM queries, messaging, status divs) live
 * inside content.js's IIFE, this module uses a one-time `init()` call to
 * receive those dependencies instead of importing them directly.
 *
 * Usage from content.js:
 *
 *   import summaryService from "../utils/summary-service.js";
 *
 *   summaryService.init({
 *     sendMessageWithRetry,
 *     wakeUpBackgroundWorker,
 *     extractContent,
 *     findContentArea,
 *     stripHtmlTags,
 *     extractParagraphsFromHtml,
 *     showStatusMessage,
 *     logNotification,
 *     resolveNovelDataForNotification,
 *     loadChunkingSystem,
 *     debugLog,
 *     debugError,
 *     getCurrentFontSize,
 *   });
 *
 *   // Then wire buttons:
 *   summaryService.summarize(chunkIndices, isShort);
 */

// ─────────────────────────────────────────────────────────────
// Private state (set once via init)
// ─────────────────────────────────────────────────────────────

let deps = null;

function getSummaryReferenceNode() {
	if (!deps) return document.body;

	const contentArea = deps.findContentArea?.();
	if (!contentArea) {
		return document.querySelector(".gemini-chunk-content") || document.body;
	}

	return (
		contentArea.querySelector(
			"#gemini-enhanced-content p, #gemini-enhanced-content div, p, article p, .gemini-chunk-content p, .gemini-chunk-content div, div, span",
		) || contentArea
	);
}

function getSummaryReferenceStyles() {
	const node = getSummaryReferenceNode();
	const computed = window.getComputedStyle(node);
	return {
		fontFamily: computed.fontFamily || "inherit",
		fontSize: computed.fontSize || "inherit",
		fontWeight: computed.fontWeight || "400",
		lineHeight: computed.lineHeight || "1.7",
		color: computed.color || "inherit",
		textAlign:
			computed.textAlign && computed.textAlign !== "center"
				? computed.textAlign
				: "left",
		letterSpacing: computed.letterSpacing || "normal",
		wordSpacing: computed.wordSpacing || "normal",
		paragraphMarginBottom:
			computed.marginBottom && computed.marginBottom !== "0px"
				? computed.marginBottom
				: "1em",
	};
}

function splitOversizedTextParts(parts, maxCharsPerPart) {
	const normalizedParts = [];
	for (const part of parts) {
		if (!part || part.length <= maxCharsPerPart) {
			normalizedParts.push(part);
			continue;
		}

		const paragraphs = part
			.split(/\n{2,}/)
			.map((segment) => segment.trim())
			.filter(Boolean);

		if (paragraphs.length <= 1) {
			for (let index = 0; index < part.length; index += maxCharsPerPart) {
				normalizedParts.push(
					part.slice(index, index + maxCharsPerPart).trim(),
				);
			}
			continue;
		}

		let currentPart = "";
		for (const paragraph of paragraphs) {
			const candidate = currentPart
				? `${currentPart}\n\n${paragraph}`
				: paragraph;
			if (candidate.length > maxCharsPerPart && currentPart) {
				normalizedParts.push(currentPart.trim());
				currentPart = paragraph;
			} else {
				currentPart = candidate;
			}
		}
		if (currentPart.trim()) {
			normalizedParts.push(currentPart.trim());
		}
	}

	return normalizedParts.filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────

/**
 * Inject all content-script-level dependencies.
 * Must be called exactly once before any other function.
 *
 * @param {Object} d - dependency bag
 */
function init(d) {
	deps = d;
}

// ─────────────────────────────────────────────────────────────
// Content Collection
// ─────────────────────────────────────────────────────────────

/**
 * Collect text content for summarisation from the best available source.
 *
 * Priority:
 *  1. Chunk DOM elements matching the requested `chunkIndices`
 *  2. `data-original-text` attribute on the content area
 *  3. Live extraction via the handler's `extractContent()`
 *
 * @param {number[]} chunkIndices - requested chunk indices
 * @returns {{ text: string|null, source: string, error?: string }}
 */
function collectContent(chunkIndices) {
	const { stripHtmlTags, findContentArea, extractContent } = deps;

	// --- 1. Try chunk DOM elements for the REQUESTED indices only ---
	const texts = chunkIndices
		.map((index) => {
			const el = document.querySelector(
				`.gemini-chunk-content[data-chunk-index="${index}"]`,
			);
			if (!el) return "";
			const isEnhanced =
				el.getAttribute("data-chunk-enhanced") === "true";
			const html = isEnhanced
				? el.innerHTML
				: el.getAttribute("data-original-chunk-html") || el.innerHTML;
			return stripHtmlTags(html || "");
		})
		.filter((t) => t && t.trim().length > 0);

	if (texts.length > 0) {
		return { text: texts.join("\n\n"), source: "chunks" };
	}

	// --- 2. Stored original text (set during cache restore / enhancement) ---
	const contentArea = findContentArea();
	const storedOriginal = contentArea
		?.getAttribute("data-original-text")
		?.trim();
	if (storedOriginal) {
		return { text: storedOriginal, source: "data-original-text" };
	}

	// --- 3. Live extraction from page DOM ---
	const extracted = extractContent();
	if (extracted && extracted.text?.trim()) {
		return { text: extracted.text.trim(), source: "live-extraction" };
	}

	return {
		text: null,
		source: "none",
		error:
			extracted?.reason ||
			"No content found on this page. If the page hasn't fully loaded, wait a moment and try again.",
	};
}

// ─────────────────────────────────────────────────────────────
// Container lookup
// ─────────────────────────────────────────────────────────────

/**
 * Find the `.gemini-summary-text-container` whose data-group-start/end
 * matches the given range.  Falls back to the main summary text container.
 *
 * @param {number} startIdx
 * @param {number} endIdx
 * @returns {HTMLElement|null}
 */
function findSummaryContainer(startIdx, endIdx) {
	const all = document.querySelectorAll(".gemini-summary-text-container");
	for (const el of all) {
		const gs = parseInt(el.getAttribute("data-group-start"), 10);
		const ge = parseInt(el.getAttribute("data-group-end"), 10);
		if (gs === startIdx && ge === endIdx) return el;
	}
	// Fallback — use the main summary container
	return (
		document.querySelector(".gemini-main-summary-text") ||
		document.querySelector(
			".gemini-summary-text-container[data-group-start='0']",
		) ||
		null
	);
}

// ─────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────

/**
 * Render a summary string (potentially containing HTML paragraphs) into a container.
 *
 * @param {HTMLElement|null} container
 * @param {string}           summary
 * @param {string}           summaryType - "Long" or "Short"
 */
function renderSummaryInContainer(container, summary, summaryType) {
	if (!container) return;

	const { extractParagraphsFromHtml, stripHtmlTags, getCurrentFontSize } =
		deps;
	const referenceStyles = getSummaryReferenceStyles();

	container.style.display = "block";
	container.style.textAlign = "left";
	while (container.firstChild) container.removeChild(container.firstChild);

	// Header
	const header = document.createElement("h4");
	header.textContent = `${summaryType} Summary:`;
	header.style.cssText = `
		margin: 0 0 12px 0;
		font-size: 0.98em;
		font-weight: 700;
		font-family: ${referenceStyles.fontFamily};
		line-height: 1.4;
		color: ${referenceStyles.color};
		text-align: left;
	`;
	container.appendChild(header);

	// Content
	const contentDiv = document.createElement("div");
	contentDiv.style.cssText = `
		font-family: ${referenceStyles.fontFamily};
		font-size: ${referenceStyles.fontSize};
		font-weight: ${referenceStyles.fontWeight};
		line-height: ${referenceStyles.lineHeight};
		color: ${referenceStyles.color};
		text-align: ${referenceStyles.textAlign};
		letter-spacing: ${referenceStyles.letterSpacing};
		word-spacing: ${referenceStyles.wordSpacing};
	`;

	const paragraphs = extractParagraphsFromHtml(summary);
	if (paragraphs.length > 0) {
		paragraphs.forEach((text) => {
			const p = document.createElement("p");
			p.textContent = text;
			p.style.margin = `0 0 ${referenceStyles.paragraphMarginBottom} 0`;
			p.style.lineHeight = referenceStyles.lineHeight;
			p.style.fontFamily = referenceStyles.fontFamily;
			p.style.fontSize = referenceStyles.fontSize;
			p.style.fontWeight = referenceStyles.fontWeight;
			p.style.color = referenceStyles.color;
			p.style.textAlign = referenceStyles.textAlign;
			contentDiv.appendChild(p);
		});
	} else {
		contentDiv.textContent = stripHtmlTags(summary);
		contentDiv.style.whiteSpace = "pre-wrap";
	}

	const fontSize = getCurrentFontSize();
	if (fontSize && fontSize !== 100) {
		contentDiv.style.fontSize = `${fontSize}%`;
	}

	container.appendChild(contentDiv);
}

// ─────────────────────────────────────────────────────────────
// Large-content splitting
// ─────────────────────────────────────────────────────────────

/**
 * When content exceeds the model context window, split into parts, summarise
 * each independently, then combine them.
 *
 * @param {string}  title
 * @param {string}  content
 * @param {number}  maxContextSize
 * @param {HTMLElement|null} statusDiv
 * @param {boolean} isShort
 * @returns {Promise<string>}
 */
async function summariseLargeContent(
	title,
	content,
	maxContextSize,
	statusDiv,
	isShort,
) {
	const { sendMessageWithRetry, loadChunkingSystem, debugLog, debugError } =
		deps;

	const summaryType = isShort ? "short" : "long";
	debugLog(
		`Content is large, creating ${summaryType} summary in multiple parts…`,
	);

	if (statusDiv) {
		statusDiv.textContent =
			"Content is large, summarising in multiple parts…";
	}

	const charsPerPart = Math.floor(maxContextSize * 0.6 * 4);
	const wordsPerPart = Math.floor(charsPerPart / 7);

	let parts = [content];
	const chunking = await loadChunkingSystem();
	if (chunking) {
		const chunks = chunking.core.splitContentByWords(content, wordsPerPart);
		parts = chunks.map((c) => c.content);
	}
	parts = splitOversizedTextParts(parts, charsPerPart);

	debugLog(
		`Split into ${parts.length} parts for ${summaryType} summarisation`,
	);

	const action = isShort ? "shortSummarizeWithGemini" : "summarizeWithGemini";
	const partSummaries = [];
	let idx = 1;

	for (const part of parts) {
		if (statusDiv) {
			statusDiv.textContent = `Summarising part ${idx} of ${parts.length}…`;
		}

		try {
			const response = await sendMessageWithRetry({
				action,
				title: `${title} (Part ${idx}/${parts.length})`,
				content: part,
				isPart: true,
				partInfo: { current: idx, total: parts.length },
			});
			if (response?.success && response.summary) {
				partSummaries.push(response.summary);
			}
		} catch (err) {
			debugError(`Error summarising part ${idx}:`, err);
		}
		idx++;
	}

	if (partSummaries.length === 0) {
		throw new Error("Failed to generate any part summaries.");
	}

	if (partSummaries.length === 1) return partSummaries[0];

	// Combine multiple part summaries
	try {
		if (statusDiv) statusDiv.textContent = "Combining part summaries…";

		const finalResp = await sendMessageWithRetry({
			action: "combinePartialSummaries",
			title,
			partSummaries,
			partCount: parts.length,
			isShort,
		});

		if (finalResp?.success && finalResp.combinedSummary) {
			return finalResp.combinedSummary;
		}
	} catch (err) {
		debugError("Error combining summaries:", err);
	}

	// Fallback: concatenate
	return `Complete summary of "${title}":\n\n` + partSummaries.join("\n\n");
}

// ─────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────

/**
 * Unified summary function — works for both chunked and non-chunked pages,
 * pre- and post-enhancement.
 *
 * @param {number[]} chunkIndices - chunk indices to summarise
 * @param {boolean}  isShort      - true → short summary, false → long summary
 */
async function summarize(chunkIndices, isShort) {
	const {
		sendMessageWithRetry,
		wakeUpBackgroundWorker,
		showStatusMessage,
		logNotification,
		resolveNovelDataForNotification,
		debugLog,
		debugError,
	} = deps;

	const summaryType = isShort ? "Short" : "Long";
	const statusDiv = document.getElementById("gemini-status");

	// Determine container
	const startIdx = Math.min(...chunkIndices);
	const endIdx = Math.max(...chunkIndices);
	const summaryTextContainer = findSummaryContainer(startIdx, endIdx);

	// Find the relevant button (to disable during processing)
	const btnClass = isShort
		? chunkIndices.length === 1 && chunkIndices[0] === 0
			? ".gemini-main-short-summary-btn"
			: ".gemini-main-short-summary-btn, .gemini-chunk-short-summary-btn"
		: chunkIndices.length === 1 && chunkIndices[0] === 0
			? ".gemini-main-long-summary-btn"
			: ".gemini-main-long-summary-btn, .gemini-chunk-long-summary-btn";
	const btn = document.querySelector(btnClass);
	const originalBtnText = btn?.textContent || "";

	try {
		// Wake up background worker
		if (btn) {
			btn.disabled = true;
			btn.textContent = "Waking up AI…";
		}
		if (statusDiv) statusDiv.textContent = "Waking up AI service…";

		const isReady = await wakeUpBackgroundWorker();
		if (!isReady) {
			throw new Error(
				"Background service is not responding. Please try again.",
			);
		}

		// Collect content
		if (btn) btn.textContent = "Extracting content…";
		if (statusDiv) {
			statusDiv.textContent = `Extracting content for ${summaryType.toLowerCase()} summary…`;
		}
		if (summaryTextContainer) {
			summaryTextContainer.style.display = "block";
			summaryTextContainer.textContent = `Generating ${summaryType.toLowerCase()} summary…`;
		}

		const collected = collectContent(chunkIndices);

		if (!collected.text) {
			const msg = collected.error || "No content available for summary.";
			showStatusMessage(msg, "warning", 3000);
			if (summaryTextContainer) {
				summaryTextContainer.style.display = "block";
				summaryTextContainer.textContent = msg;
			}
			return;
		}

		debugLog(
			`Collected ${collected.text.length} chars from ${collected.source}`,
		);

		// Get model info for context-window logic
		if (btn) btn.textContent = "Summarising…";
		if (statusDiv) {
			statusDiv.textContent = `Sending content to Gemini for ${summaryType.toLowerCase()} summary…`;
		}

		const modelInfo = await sendMessageWithRetry({
			action: "getModelInfo",
		});
		const maxContextSize = modelInfo.maxContextSize || 16000;
		const estimatedTokens = Math.ceil(collected.text.length / 4);
		const threshold = isShort ? maxContextSize * 0.8 : maxContextSize * 0.6;

		let summary = "";

		if (estimatedTokens > threshold) {
			summary = await summariseLargeContent(
				document.title,
				collected.text,
				maxContextSize,
				statusDiv,
				isShort,
			);
		} else {
			const action = isShort
				? "shortSummarizeWithGemini"
				: "summarizeWithGemini";
			const response = await sendMessageWithRetry({
				action,
				title: document.title,
				content: collected.text,
			});

			if (response?.success && response.summary) {
				summary = response.summary;
			} else {
				const errMsg = response?.error || "Failed to generate summary.";
				if (errMsg.includes("API key is missing")) {
					showStatusMessage(
						"API key is missing. Opening settings page…",
						"error",
					);
					// eslint-disable-next-line no-undef
					browser.runtime.sendMessage({ action: "openPopup" });
					if (summaryTextContainer) {
						summaryTextContainer.textContent =
							"API key is missing. Please add your Gemini API key in the settings.";
					}
					throw new Error("API key is missing");
				}
				throw new Error(errMsg);
			}
		}

		// Render
		if (summary) {
			renderSummaryInContainer(
				summaryTextContainer,
				summary,
				summaryType,
			);
			if (statusDiv) {
				statusDiv.textContent = "Summary generated successfully!";
			}
			logNotification({
				type: "success",
				message: `${summaryType} summary generated`,
				title: `${summaryType} summary`,
				novelData: await resolveNovelDataForNotification(),
				metadata: { summaryType, isShort, length: summary.length },
			});
		} else {
			throw new Error("Failed to generate summary.");
		}
	} catch (error) {
		debugError("Error in summarize:", error);
		if (statusDiv) {
			statusDiv.textContent = error.message.includes("API key")
				? "API key is missing. Please check the settings."
				: `Error: ${error.message}`;
		}
		if (summaryTextContainer) {
			summaryTextContainer.textContent = "Failed to generate summary.";
			summaryTextContainer.style.display = "block";
		}
		logNotification({
			type: "error",
			message: `${summaryType} summary failed: ${error.message}`,
			title: `${summaryType} summary failed`,
			novelData: await resolveNovelDataForNotification(),
			metadata: { summaryType, isShort },
		});
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.textContent = originalBtnText;
		}
		setTimeout(() => {
			if (
				statusDiv?.textContent?.includes("Summary generated") &&
				!statusDiv.textContent.includes("API key is missing")
			) {
				statusDiv.textContent = "";
			}
		}, 5000);
	}
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export default {
	init,
	summarize,
	collectContent,
	findSummaryContainer,
	renderSummaryInContainer,
};
