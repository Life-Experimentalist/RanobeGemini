/**
 * Core Chunking Logic - Word-based splitting with paragraph awareness
 * Splits content on paragraph boundaries to avoid cutting sentences
 */

import { DEFAULT_CHUNK_SIZE_WORDS, MIN_CHUNK_WORDS } from "./chunk-config.js";
import { findOutermost, outerHTML, parseMarkup } from "../mini-dom.js";

/** Block-level tags treated as paragraph boundaries. */
const BLOCK_TAGS = [
	"p",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"li",
	"blockquote",
	"pre",
];
const BLOCK_SELECTOR = BLOCK_TAGS.join(", ");
const BLOCK_TAG_SET = new Set(BLOCK_TAGS);

/**
 * Count words in text (HTML-aware, emoji-aware)
 * Removes emojis before counting to get accurate word count
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
export function countWords(text) {
	if (!text || typeof text !== "string") return 0;
	// Comprehensive emoji regex (covers most common emoji ranges)
	const emojiRegex = /\p{Extended_Pictographic}/gu;
	// Remove HTML tags and emojis for accurate word count
	const plainText = text.replace(/<[^>]*>/g, " ").replace(emojiRegex, "");
	return plainText
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0).length;
}

/**
 * Detect if content is HTML
 * @param {string} content - Content to check
 * @returns {boolean} True if HTML detected
 */
function isHTML(content) {
	if (!content) return false;
	// Check for common HTML tags
	return /<p\b[^>]*>|<div\b[^>]*>|<br\s*\/?>|<span\b[^>]*>/i.test(content);
}

/**
 * Extract paragraphs from HTML content.
 * Uses DOMParser as the primary method (accurately handles nested structures)
 * with a regex fallback for non-browser environments.
 * Only returns the outermost block elements so that nested blocks (e.g. a
 * <p> inside a <blockquote>) are not double-counted.
 * @param {string} htmlContent - HTML content to parse
 * @returns {Array<{content: string, wordCount: number}>} Array of paragraph objects
 */
function extractParagraphs(htmlContent) {
	if (!htmlContent) return [];

	// ── Primary: DOMParser (browser / extension service-worker context) ───────
	if (typeof DOMParser !== "undefined") {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(
				`<body>${htmlContent}</body>`,
				"text/html",
			);
			const allBlocks = Array.from(
				doc.body.querySelectorAll(BLOCK_SELECTOR),
			);

			// Keep only blocks that have no block-element ancestor (avoids
			// double-counting a <p> that is a child of a matched <blockquote>).
			const outerBlocks = allBlocks.filter((el) => {
				let parent = el.parentElement;
				while (parent && parent !== doc.body) {
					if (parent.matches(BLOCK_SELECTOR)) return false;
					parent = parent.parentElement;
				}
				return true;
			});

			if (outerBlocks.length > 0) {
				return outerBlocks
					.map((block) => ({
						content: block.outerHTML,
						wordCount: countWords(block.outerHTML),
					}))
					.filter((p) => p.wordCount > 0);
			}
		} catch (e) {
			console.warn(
				"[ChunkCore] DOMParser extraction failed, falling back to regex:",
				e,
			);
		}
	}

	// ── Fallback: mini-dom extraction (no DOM required) ──────────────────────
	// Chromium's MV3 background is a service worker, so DOMParser is absent
	// there. mini-dom understands nesting, so a wrapper <div> no longer
	// swallows the <p> tags inside it the way the old regex did.
	const paragraphs = [];
	const push = (content) => {
		const trimmed = content.trim();
		if (!trimmed) return;
		const wordCount = countWords(trimmed);
		if (wordCount > 0) paragraphs.push({ content: trimmed, wordCount });
	};

	const root = parseMarkup(htmlContent);
	const blocks = findOutermost(root, BLOCK_TAG_SET);

	let cursor = 0;
	for (const block of blocks) {
		if (block.start > cursor) {
			push(htmlContent.slice(cursor, block.start));
		}
		push(outerHTML(block, htmlContent));
		cursor = block.end;
	}
	if (cursor < htmlContent.length) {
		push(htmlContent.slice(cursor));
	}

	return paragraphs;
}

/**
 * Split any chunk that still exceeds the target, and renumber the result.
 *
 * A paragraph is indivisible at a block boundary, so one enormous paragraph can
 * carry a chunk far past the target — which is how a chapter ends up exceeding
 * the model's context and failing the whole request. Those chunks are split
 * again on word boundaries in their plain text.
 *
 * Every return path of `splitByParagraphs` goes through here. The two-way split
 * used to return directly, so a chapter of one short paragraph followed by one
 * very long one produced a chunk nearly twice the target.
 *
 * @param {Array<{content: string, wordCount: number, paragraphCount?: number}>} chunks
 * @param {number} chunkSizeWords
 * @returns {Array<{index: number, content: string, wordCount: number, paragraphCount: number}>}
 */
function enforceChunkSize(chunks, chunkSizeWords) {
	const finalChunks = [];
	for (const chunk of chunks) {
		if (chunk.wordCount > chunkSizeWords) {
			const plainText = chunk.content
				.replace(/<[^>]*>/g, " ")
				.replace(/\s+/g, " ")
				.trim();
			for (const sub of splitPlainTextByWords(
				plainText,
				chunkSizeWords,
			)) {
				finalChunks.push({
					index: finalChunks.length,
					content: sub.content,
					wordCount: sub.wordCount,
					paragraphCount: 1,
				});
			}
		} else {
			finalChunks.push({ ...chunk, index: finalChunks.length });
		}
	}
	return finalChunks;
}

/**
 * Split content by paragraphs, grouped to target chunk size
 * Ensures no chunk splits mid-paragraph or mid-sentence
 * @param {string} content - HTML content to split
 * @param {number} chunkSizeWords - Target chunk size in words
 * @returns {Array<{index: number, content: string, wordCount: number, paragraphCount: number}>}
 */
function splitByParagraphs(content, chunkSizeWords) {
	const paragraphs = extractParagraphs(content);

	if (paragraphs.length === 0) {
		return [];
	}

	const totalWords = paragraphs.reduce((sum, p) => sum + p.wordCount, 0);

	console.log(
		`[ChunkCore] HTML content: ${paragraphs.length} paragraphs, ${totalWords} words`,
	);

	// Rule 1: If total < chunk size, return all as single chunk
	if (totalWords <= chunkSizeWords) {
		return enforceChunkSize(
			[
				{
					index: 0,
					content: content.trim(),
					wordCount: totalWords,
					paragraphCount: paragraphs.length,
				},
			],
			chunkSizeWords,
		);
	}

	// Rule 2: If total < 2x chunk size, split into 2 balanced chunks
	if (totalWords < 2 * chunkSizeWords) {
		const targetPerChunk = Math.ceil(totalWords / 2);
		const chunks = [];
		let currentChunk = [];
		let currentWords = 0;

		for (const para of paragraphs) {
			if (
				currentWords > 0 &&
				currentWords + para.wordCount > targetPerChunk &&
				chunks.length === 0
			) {
				// Start second chunk
				chunks.push({
					index: 0,
					content: currentChunk.map((p) => p.content).join("\n\n"),
					wordCount: currentWords,
					paragraphCount: currentChunk.length,
				});
				currentChunk = [para];
				currentWords = para.wordCount;
			} else {
				currentChunk.push(para);
				currentWords += para.wordCount;
			}
		}

		// Add final chunk
		if (currentChunk.length > 0) {
			chunks.push({
				index: chunks.length,
				content: currentChunk.map((p) => p.content).join("\n\n"),
				wordCount: currentWords,
				paragraphCount: currentChunk.length,
			});
		}

		return enforceChunkSize(chunks, chunkSizeWords);
	}

	// Rule 3: Multiple chunks - group paragraphs until reaching target size
	const chunks = [];
	let currentChunk = [];
	let currentWords = 0;

	for (let i = 0; i < paragraphs.length; i++) {
		const para = paragraphs[i];
		const remainingWords = paragraphs
			.slice(i + 1)
			.reduce((sum, p) => sum + p.wordCount, 0);

		// If adding this paragraph would exceed chunk size AND either (a) there
		// is more content after it, or (b) the paragraph itself is oversized —
		// in the latter case we must still flush the accumulated content so the
		// big paragraph can be post-processed into sub-chunks.
		if (
			currentWords > 0 &&
			currentWords + para.wordCount > chunkSizeWords &&
			(remainingWords > 0 || para.wordCount >= chunkSizeWords)
		) {
			// Check if remaining content would create balanced last two chunks
			const totalRemaining = remainingWords + para.wordCount;

			if (totalRemaining < 2 * chunkSizeWords) {
				// Finish current chunk and split remaining into 2 balanced chunks
				chunks.push({
					index: chunks.length,
					content: currentChunk.map((p) => p.content).join("\n\n"),
					wordCount: currentWords,
					paragraphCount: currentChunk.length,
				});

				// Apply Rule 2 to remaining paragraphs - split into exactly 2 balanced chunks
				const remainingParas = paragraphs.slice(i);
				const targetPerChunk = Math.ceil(totalRemaining / 2);
				const numChunksBeforeSplit = chunks.length; // Remember where we started
				currentChunk = [];
				currentWords = 0;

				for (const rPara of remainingParas) {
					// Only create ONE split - when we exceed target AND haven't split yet
					if (
						currentWords > 0 &&
						currentWords + rPara.wordCount > targetPerChunk &&
						chunks.length === numChunksBeforeSplit // Haven't created penultimate chunk yet
					) {
						// Push the penultimate chunk
						chunks.push({
							index: chunks.length,
							content: currentChunk
								.map((p) => p.content)
								.join("\n\n"),
							wordCount: currentWords,
							paragraphCount: currentChunk.length,
						});
						// Start the final chunk
						currentChunk = [rPara];
						currentWords = rPara.wordCount;
					} else {
						currentChunk.push(rPara);
						currentWords += rPara.wordCount;
					}
				}

				// Add final chunk (the last of the two balanced chunks)
				if (currentChunk.length > 0) {
					chunks.push({
						index: chunks.length,
						content: currentChunk
							.map((p) => p.content)
							.join("\n\n"),
						wordCount: currentWords,
						paragraphCount: currentChunk.length,
					});
					// Clear so the post-loop guard below does not push a duplicate chunk
					currentChunk = [];
					currentWords = 0;
				}

				break; // Done processing - no more paragraphs to process
			} else {
				// Create a new chunk with current paragraphs
				chunks.push({
					index: chunks.length,
					content: currentChunk.map((p) => p.content).join("\n\n"),
					wordCount: currentWords,
					paragraphCount: currentChunk.length,
				});
				currentChunk = [para];
				currentWords = para.wordCount;
			}
		} else {
			// Add paragraph to current chunk
			currentChunk.push(para);
			currentWords += para.wordCount;
		}
	}

	// Add any remaining paragraphs as final chunk
	if (currentChunk.length > 0) {
		chunks.push({
			index: chunks.length,
			content: currentChunk.map((p) => p.content).join("\n\n"),
			wordCount: currentWords,
			paragraphCount: currentChunk.length,
		});
	}

	return enforceChunkSize(chunks, chunkSizeWords);
}

/**
 * Split plain text into chunks by word boundaries
 * Fallback for non-HTML content
 * @param {string} text - Plain text to split
 * @param {number} chunkSizeWords - Target chunk size in words
 * @returns {Array<{index: number, content: string, wordCount: number}>}
 */
function splitPlainTextByWords(text, chunkSizeWords) {
	const words = text
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0);
	const totalWords = words.length;

	if (totalWords <= chunkSizeWords) {
		return [
			{
				index: 0,
				content: text.trim(),
				wordCount: totalWords,
			},
		];
	}

	if (totalWords < 2 * chunkSizeWords) {
		const midPoint = Math.ceil(totalWords / 2);
		return [
			{
				index: 0,
				content: words.slice(0, midPoint).join(" "),
				wordCount: midPoint,
			},
			{
				index: 1,
				content: words.slice(midPoint).join(" "),
				wordCount: totalWords - midPoint,
			},
		];
	}

	// Multiple chunks with balanced last two
	const chunks = [];
	let wordIndex = 0;

	while (totalWords - wordIndex >= 2 * chunkSizeWords) {
		const chunkWords = words.slice(wordIndex, wordIndex + chunkSizeWords);
		chunks.push({
			index: chunks.length,
			content: chunkWords.join(" "),
			wordCount: chunkWords.length,
		});
		wordIndex += chunkSizeWords;
	}

	// Handle remaining words
	const remainingWords = totalWords - wordIndex;
	if (remainingWords > 0) {
		if (remainingWords <= chunkSizeWords) {
			chunks.push({
				index: chunks.length,
				content: words.slice(wordIndex).join(" "),
				wordCount: remainingWords,
			});
		} else {
			// Split remaining into 2 balanced chunks
			const midPoint = wordIndex + Math.ceil(remainingWords / 2);
			chunks.push({
				index: chunks.length,
				content: words.slice(wordIndex, midPoint).join(" "),
				wordCount: midPoint - wordIndex,
			});
			chunks.push({
				index: chunks.length,
				content: words.slice(midPoint).join(" "),
				wordCount: totalWords - midPoint,
			});
		}
	}

	return chunks;
}

/**
 * Split content into chunks based on word count with smart balancing
 * Automatically detects HTML and splits on paragraph boundaries
 *
 * Rules:
 * 1. If chapter size < chunk_size → single chunk
 * 2. If chapter size < 2 * chunk_size → split into 2 roughly equal chunks
 * 3. If chapter size > chunk_size → split into chunks, but last two chunks are balanced
 *
 * HTML Content: Splits on <p>, <div>, <h1-6>, <li>, <blockquote> boundaries
 * Plain Text: Splits on word boundaries
 *
 * @param {string} content - Content to split (HTML or plain text)
 * @param {number} chunkSizeWords - Target chunk size in words (default: 3200)
 * @returns {Array<{index: number, content: string, wordCount: number}>} Array of chunk objects
 */
export function splitContentByWords(
	content,
	chunkSizeWords = DEFAULT_CHUNK_SIZE_WORDS,
) {
	if (!content || typeof content !== "string") {
		console.warn("[ChunkCore] Invalid content provided");
		return [];
	}

	// Detect if content is HTML
	if (isHTML(content)) {
		console.log(
			"[ChunkCore] HTML detected - using paragraph-aware splitting",
		);
		const chunks = splitByParagraphs(content, chunkSizeWords);
		console.log(
			`[ChunkCore] Created ${chunks.length} chunks:`,
			chunks
				.map(
					(c) =>
						`[${c.index}]=${c.wordCount}w/${c.paragraphCount || 0}p`,
				)
				.join(", "),
		);
		return chunks;
	} else {
		console.log(
			"[ChunkCore] Plain text detected - using word-based splitting",
		);
		const chunks = splitPlainTextByWords(content, chunkSizeWords);
		console.log(
			`[ChunkCore] Created ${chunks.length} chunks:`,
			chunks.map((c) => `[${c.index}]=${c.wordCount}w`).join(", "),
		);
		return chunks;
	}
}

/**
 * Validate and sanitize chunk size
 * @param {number} chunkSize - Requested chunk size
 * @returns {number} Validated chunk size
 */
export function validateChunkSize(chunkSize) {
	const size = parseInt(chunkSize, 10);
	if (isNaN(size) || size < MIN_CHUNK_WORDS) {
		console.warn(
			`Invalid chunk size ${chunkSize}, using minimum ${MIN_CHUNK_WORDS}`,
		);
		return MIN_CHUNK_WORDS;
	}
	return size;
}

export default {
	splitContentByWords,
	countWords,
	validateChunkSize,
};
