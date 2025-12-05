/**
 * Simple configuration module for Ranobe Novel Enhancer
 */

import {
	DEFAULT_PROMPT,
	DEFAULT_MODEL_ENDPOINT,
	DEFAULT_MODEL_ID,
	DEFAULT_CHUNK_SIZE,
} from "../utils/constants.js";
import { debugLog, debugError } from "../utils/logger.js";

// Default configuration values
const DEFAULT_CONFIG = {
	apiKey: "", // will be auto-set from ENV if not stored
	defaultPrompt: DEFAULT_PROMPT,
	temperature: 0.7,
	maxOutputTokens: 8192,
	debugMode: false,
	modelEndpoint: DEFAULT_MODEL_ENDPOINT,
	selectedModelId: DEFAULT_MODEL_ID,
	chunkingEnabled: true, // Enable chunking by default
	chunkSize: DEFAULT_CHUNK_SIZE, // Default chunk size
};

// Load configuration from storage
async function loadConfig() {
	try {
		const data = await browser.storage.local.get();
		const config = { ...DEFAULT_CONFIG, ...data };

		// Try to find an API key from environment if not in storage
		// This is now directly handled in storage mechanism

		return config;
	} catch (error) {
		debugError("Error loading configuration:", error);
		return { ...DEFAULT_CONFIG };
	}
}

// Save configuration to storage
async function saveConfig(config) {
	try {
		// Make sure we're not trying to save null or undefined values
		const cleanConfig = {};
		for (const [key, value] of Object.entries(config)) {
			if (value !== null && value !== undefined) {
				cleanConfig[key] = value;
			}
		}

		// Save directly to storage
		await browser.storage.local.set(cleanConfig);
		return true;
	} catch (error) {
		debugError("Error saving configuration:", error);
		return false;
	}
}

// Module exports
export default {
	DEFAULT_CONFIG,
	loadConfig,
	saveConfig,
};
