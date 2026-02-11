/**
 * Core Chunking Logic - Word-based splitting with paragraph awareness
 * Splits content on paragraph boundaries to avoid cutting sentences
 */

import { DEFAULT_CHUNK_SIZE_WORDS, MIN_CHUNK_WORDS } from "./chunk-config.js";

/**
 * Count words in text (HTML-aware)
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
export function countWords(text) {
	if (!text || typeof text !== "string") return 0;
	// Remove HTML tags for accurate word count
	const plainText = text.replace(/<[^>]*>/g, " ");
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
 * Extract paragraphs from HTML content
 * Respects block-level elements: p, div, h1-h6, li, blockquote
 * @param {string} htmlContent - HTML content to parse
 * @returns {Array<{content: string, wordCount: number}>} Array of paragraph objects
 */
function extractParagraphs(htmlContent) {
	if (!htmlContent) return [];

	const paragraphs = [];

	// Match block-level elements and their content
	// Includes: <p>, <div>, <h1-6>, <li>, <blockquote>, <pre>
	const blockRegex =
		/<(p|div|h[1-6]|li|blockquote|pre|section|article)\b[^>]*>([\s\S]*?)<\/\1>|<br\s*\/?>/gi;

	let lastIndex = 0;
	let match;

	while ((match = blockRegex.exec(htmlContent)) !== null) {
		// Capture text before this tag (if any)
		if (match.index > lastIndex) {
			const textBefore = htmlContent
				.substring(lastIndex, match.index)
				.trim();
			if (textBefore && textBefore.length > 0) {
				const wordCount = countWords(textBefore);
				if (wordCount > 0) {
					paragraphs.push({
						content: textBefore,
						wordCount: wordCount,
					});
				}
			}
		}

		// Add the matched block element
		const fullTag = match[0];
		const tagContent = match[2] || ""; // Content inside the tag (if not <br>)

		if (fullTag.toLowerCase().startsWith("<br")) {
			// Treat <br> as paragraph separator, don't include it
			// Already captured surrounding text above
		} else {
			const wordCount = countWords(fullTag);
			if (wordCount > 0) {
				paragraphs.push({
					content: fullTag,
					wordCount: wordCount,
				});
			}
		}

		lastIndex = blockRegex.lastIndex;
	}

	// Capture any remaining text after the last tag
	if (lastIndex < htmlContent.length) {
		const textAfter = htmlContent.substring(lastIndex).trim();
		if (textAfter && textAfter.length > 0) {
			const wordCount = countWords(textAfter);
			if (wordCount > 0) {
				paragraphs.push({
					content: textAfter,
					wordCount: wordCount,
				});
			}
		}
	}

	return paragraphs;
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
		return [
			{
				index: 0,
				content: content.trim(),
				wordCount: totalWords,
				paragraphCount: paragraphs.length,
			},
		];
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

		return chunks;
	}

	// Rule 3: Multiple chunks - group paragraphs until reaching target size
	const chunks = [];
	let currentChunk = [];
	let currentWords = 0;

	for (let i = 0; i < paragraphs.length; i++) {
		const para = paragraphs[i];
		const remainingParas = paragraphs.length - i - 1;
		const remainingWords = paragraphs
			.slice(i + 1)
			.reduce((sum, p) => sum + p.wordCount, 0);

		// If adding this paragraph would exceed chunk size AND we have more content
		if (
			currentWords > 0 &&
			currentWords + para.wordCount > chunkSizeWords &&
			remainingWords > 0
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

				// Apply Rule 2 to remaining paragraphs
				const remainingParas = paragraphs.slice(i);
				const targetPerChunk = Math.ceil(totalRemaining / 2);
				currentChunk = [];
				currentWords = 0;

				for (const rPara of remainingParas) {
					if (
						currentWords > 0 &&
						currentWords + rPara.wordCount > targetPerChunk &&
						chunks.length === chunks.length
					) {
						chunks.push({
							index: chunks.length,
							content: currentChunk
								.map((p) => p.content)
								.join("\n\n"),
							wordCount: currentWords,
							paragraphCount: currentChunk.length,
						});
						currentChunk = [rPara];
						currentWords = rPara.wordCount;
					} else {
						currentChunk.push(rPara);
						currentWords += rPara.wordCount;
					}
				}

				// Add final chunk
				if (currentChunk.length > 0) {
					chunks.push({
						index: chunks.length,
						content: currentChunk
							.map((p) => p.content)
							.join("\n\n"),
						wordCount: currentWords,
						paragraphCount: currentChunk.length,
					});
				}

				break; // Done processing
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

	return chunks;
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
