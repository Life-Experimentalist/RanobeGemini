// Shared chunking utilities for background and content scripts
// Provides consistent splitting and merging logic for large chapter text

import { debugLog, debugError } from "./logger.js";

const DEFAULT_MAX_CHUNK_SIZE = 20000;
export const MIN_CHUNK_LENGTH = 200;

function getLoggers(options = {}) {
	const logger = options.logger || console;
	const logEnabled = options.logEnabled !== false;
	const log = logEnabled && logger?.log ? logger.log.bind(logger) : () => {};
	const warn = logger?.warn ? logger.warn.bind(logger) : () => {};
	const error = logger?.error ? logger.error.bind(logger) : () => {};
	const logPrefix = options.logPrefix || "[Chunking]";

	return { log, warn, error, logPrefix };
}

function mergeSmallChunks(
	chunks,
	minChunkLength = MIN_CHUNK_LENGTH,
	maxChunkSize = DEFAULT_MAX_CHUNK_SIZE
) {
	// Normalize and trim inputs
	const workingChunks = chunks
		.map((c) => (typeof c === "string" ? c.trim() : ""))
		.filter((c) => c.length > 0);

	const mergedChunks = [];

	for (let i = 0; i < workingChunks.length; i++) {
		const chunk = workingChunks[i];

		// Merge tiny leading chunk into the next chunk to avoid zero/near-zero chunks
		if (i === 0 && chunk.length < minChunkLength && workingChunks[i + 1]) {
			workingChunks[i + 1] = `${chunk} ${workingChunks[i + 1]}`.trim();
			continue;
		}

		// Standard merge for small intermediate chunks
		if (mergedChunks.length > 0 && chunk.length < minChunkLength) {
			mergedChunks[mergedChunks.length - 1] = (
				mergedChunks[mergedChunks.length - 1] +
				" " +
				chunk
			).trim();
			continue;
		}

		mergedChunks.push(chunk);
	}

	// Merge trailing small chunk into the previous chunk
	if (
		mergedChunks.length > 1 &&
		mergedChunks[mergedChunks.length - 1].length < minChunkLength
	) {
		mergedChunks[mergedChunks.length - 2] = (
			mergedChunks[mergedChunks.length - 2] +
			" " +
			mergedChunks.pop()
		).trim();
	}

	// Rebalance if the final chunk is far smaller than its predecessor; split the combined
	// tail into two roughly even parts to avoid tiny trailing chunks.
	if (mergedChunks.length >= 2) {
		const last = mergedChunks[mergedChunks.length - 1];
		const prev = mergedChunks[mergedChunks.length - 2];
		const ratio = last.length / Math.max(prev.length, 1);
		if (ratio < 0.4 && prev.length > maxChunkSize * 0.6) {
			const combined = `${prev} ${last}`.trim();
			const words = combined.split(/\s+/);
			const mid = Math.ceil(words.length / 2);
			const first = words.slice(0, mid).join(" ").trim();
			const second = words.slice(mid).join(" ").trim();
			if (first && second) {
				mergedChunks.splice(mergedChunks.length - 2, 2, first, second);
			}
		}
	}

	// Enforce hard cap: if anything still exceeds, split by words conservatively
	const capped = [];
	for (const chunk of mergedChunks) {
		if (chunk.length <= maxChunkSize) {
			capped.push(chunk);
			continue;
		}
		const words = chunk.split(/\s+/);
		let cur = "";
		for (const w of words) {
			const sep = cur ? " " : "";
			if (cur.length + sep.length + w.length > maxChunkSize && cur) {
				capped.push(cur.trim());
				cur = w;
			} else {
				cur += sep + w;
			}
		}
		if (cur.trim()) capped.push(cur.trim());
	}

	return capped;
}

function splitOversizedSegment(segment, maxChunkSize, log, logPrefix) {
	// First try sentence boundaries
	let parts = segment.split(/(?<=[.!?])\s+/);
	if (parts.length <= 1) {
		// Fallback: split by words
		parts = segment.split(/\s+/);
	}

	const chunks = [];
	let current = "";
	for (const part of parts) {
		const piece = part.trim();
		if (!piece) continue;
		const sep = current ? " " : "";
		if (current.length + sep.length + piece.length > maxChunkSize) {
			if (current) {
				chunks.push(current.trim());
				current = piece;
			} else {
				// Single piece larger than max: hard split
				chunks.push(piece.slice(0, maxChunkSize));
				current = piece.slice(maxChunkSize);
			}
		} else {
			current += sep + piece;
		}
	}
	if (current.trim()) chunks.push(current.trim());
	if (chunks.length > 1) {
		log(`${logPrefix} Split oversized segment into ${chunks.length} parts`);
	}
	return chunks;
}

function buildChunks(segments, maxChunkSize, log, logPrefix) {
	const chunks = [];
	let current = "";

	for (const raw of segments) {
		const seg = (raw || "").trim();
		if (!seg) continue;

		// If a single segment exceeds max, break it down before appending
		if (seg.length > maxChunkSize) {
			const splitSegs = splitOversizedSegment(
				seg,
				maxChunkSize,
				log,
				logPrefix
			);
			for (const s of splitSegs) {
				const sep = current ? " " : "";
				if (
					current.length + sep.length + s.length > maxChunkSize &&
					current.length > 0
				) {
					chunks.push(current.trim());
					current = s;
				} else {
					current += sep + s;
				}
			}
			continue;
		}

		const sep = current ? " " : "";
		if (current.length + sep.length + seg.length > maxChunkSize) {
			// Close current chunk and start new with this paragraph
			chunks.push(current.trim());
			current = seg;
		} else {
			current += sep + seg;
		}
	}

	if (current.trim()) chunks.push(current.trim());
	return chunks;
}

export function splitContentForProcessing(
	content,
	maxChunkSize = DEFAULT_MAX_CHUNK_SIZE,
	options = {}
) {
	const { log, warn, error, logPrefix } = getLoggers(options);

	log(
		`${logPrefix} Starting splitContentForProcessing with maxChunkSize=${maxChunkSize}`
	);
	log(`${logPrefix} Content length: ${content?.length || 0} chars`);

	if (!content || typeof content !== "string") {
		error(`${logPrefix} Invalid content provided`);
		return [content || ""];
	}

	if (content.length <= maxChunkSize) {
		log(`${logPrefix} Content is small enough, no splitting needed`);
		return [content];
	}

	// Paragraph-first strategy so chunks align with <p> boundaries and never exceed maxChunkSize
	let paragraphParts = content.split(/\n\s*\n+/);
	log(
		`${logPrefix} Strategy paragraphs (blank-line separated): ${paragraphParts.length} parts`
	);

	if (paragraphParts.length <= 1) {
		paragraphParts = content.split(/\n/);
		log(
			`${logPrefix} Strategy single-line paragraphs: ${paragraphParts.length} parts`
		);
	}

	// Build chunks without exceeding maxChunkSize
	let builtChunks = buildChunks(paragraphParts, maxChunkSize, log, logPrefix);

	// If still only one chunk and it exceeds size, fall back to sentence splits
	if (builtChunks.length === 1 && builtChunks[0].length > maxChunkSize) {
		warn(`${logPrefix} Single chunk still too large, splitting by sentences`);
		const sentences = content.split(/(?<=[.!?])\s+/);
		builtChunks = buildChunks(sentences, maxChunkSize, log, logPrefix);
	}

	// Clean up and merge small chunks
	const mergedChunks = mergeSmallChunks(
		builtChunks,
		options.minChunkLength || MIN_CHUNK_LENGTH,
		maxChunkSize
	);

	// Enforce hard limit: if anything exceeds, split by words conservatively
	const finalChunks = [];
	for (const chunk of mergedChunks) {
		if (chunk.length <= maxChunkSize) {
			finalChunks.push(chunk);
			continue;
		}
		warn(
			`${logPrefix} Chunk exceeded limit after merge (${chunk.length}), word-splitting to respect cap`
		);
		const words = chunk.split(/\s+/);
		let cur = "";
		for (const word of words) {
			const sep = cur ? " " : "";
			if (cur.length + sep.length + word.length > maxChunkSize && cur) {
				finalChunks.push(cur.trim());
				cur = word;
			} else {
				cur += sep + word;
			}
		}
		if (cur.trim()) finalChunks.push(cur.trim());
	}

	log(`${logPrefix} Final result: ${finalChunks.length} chunks`);
	log(
		`${logPrefix} Chunk sizes: ${finalChunks
			.map((c, i) => `[${i}]=${c.length}`)
			.join(", ")}`
	);

	finalChunks.forEach((chunk, idx) => {
		log(
			`${logPrefix} Chunk ${idx} preview: "${chunk.substring(0, 100)}..."`
		);
	});

	return finalChunks.length > 0 ? finalChunks : [content];
}

export const chunkingDefaults = {
	DEFAULT_MAX_CHUNK_SIZE,
	MIN_CHUNK_LENGTH,
};

export default {
	splitContentForProcessing,
	MIN_CHUNK_LENGTH,
	chunkingDefaults,
};
