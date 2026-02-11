/**
 * Chunking System - Main Export
 * Modular chunking system for content enhancement
 */

export * from "./chunk-config.js";
export * from "./chunk-core.js";
export * from "./chunk-cache.js";
export * from "./chunk-ui.js";
export * from "./chunk-summary-ui.js";

// Re-export default objects for convenience
import chunkConfig from "./chunk-config.js";
import chunkCore from "./chunk-core.js";
import chunkCache from "./chunk-cache.js";
import chunkUI from "./chunk-ui.js";
import chunkSummaryUI from "./chunk-summary-ui.js";

export default {
	config: chunkConfig,
	core: chunkCore,
	cache: chunkCache,
	ui: chunkUI,
	summaryUI: chunkSummaryUI,
};
