/**
 * Simple configuration module for Ranobe Novel Enhancer
 */

import ENV from "../env.js";

// Default configuration values
const DEFAULT_CONFIG = {
	apiKey: "", // will be auto-set from ENV if not stored
	defaultPrompt:
		"Please review and enhance the following novel chapter translation. Correct grammatical, punctuation, and spelling errors; improve narrative flow and readability; maintain the original tone, style, and plot; ensure consistent gender pronouns; and streamline overly verbose sections. Format your response with proper HTML paragraph tags (<p>) for each paragraph. Do not use markdown formatting at all. Preserve the original meaning while producing a polished version suitable for a high-quality reading experience.",
	temperature: 0.7,
	maxOutputTokens: 8192,
	debugMode: false,
	modelEndpoint:
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
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
		console.error("Error loading configuration:", error);
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
		console.error("Error saving configuration:", error);
		return false;
	}
}

// Module exports
export default {
	DEFAULT_CONFIG,
	loadConfig,
	saveConfig,
};
