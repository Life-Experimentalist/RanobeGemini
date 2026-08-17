/**
 * Simple configuration module for Ranobe Novel Enhancer
 *
 * Storage split:
 *   browser.storage.sync  — loreWeaveAccountKey (follows user across Chrome/Firefox sign-in)
 *   browser.storage.local — everything else (device-specific config, chronicle, etc.)
 */

import {
	DEFAULT_PROMPT,
	DEFAULT_MODEL_ENDPOINT,
	DEFAULT_MODEL_ID,
	DEFAULT_CHUNK_SIZE,
	LOREWEAVE_DEFAULT_URL,
	LOREWEAVE_DEFAULT_DOMAIN_ID,
	LOREWEAVE_DEFAULT_ACCOUNT_KEY,
	LOREWEAVE_AUTO_GRAPHIFY,
	LOREWEAVE_CHRONICLE_ENABLED,
	LOREWEAVE_USE_PRIOR_CONTEXT,
	LOREWEAVE_WRITING_STYLE,
} from "../utils/constants.js";
import { debugError } from "../utils/logger.js";

// Keys stored in browser.storage.sync (cross-device)
const SYNC_KEYS = ["loreWeaveAccountKey"];

// Default configuration values
const DEFAULT_CONFIG = {
	apiKey: "", // will be auto-set from ENV if not stored
	defaultPrompt: DEFAULT_PROMPT,
	temperature: 0.7,
	maxOutputTokens: 8192,
	debugMode: false,
	modelEndpoint: DEFAULT_MODEL_ENDPOINT,
	selectedModelId: DEFAULT_MODEL_ID,
	chunkingEnabled: true,
	chunkSize: DEFAULT_CHUNK_SIZE,
	// LoreWeave integration
	loreWeaveUrl: LOREWEAVE_DEFAULT_URL,
	loreWeaveDomainId: LOREWEAVE_DEFAULT_DOMAIN_ID,
	// Single secret key — identity AND auth. Synced via browser.storage.sync.
	loreWeaveAccountKey: LOREWEAVE_DEFAULT_ACCOUNT_KEY,
	loreWeaveAutoGraphify: LOREWEAVE_AUTO_GRAPHIFY,
	loreWeaveChronicleEnabled: LOREWEAVE_CHRONICLE_ENABLED,
	loreWeaveUsePriorContext: LOREWEAVE_USE_PRIOR_CONTEXT,
	loreWeaveWritingStyle: LOREWEAVE_WRITING_STYLE,
};

// Load configuration from storage (merges local + sync)
async function loadConfig() {
	try {
		const [localData, syncData] = await Promise.all([
			browser.storage.local.get(),
			browser.storage.sync.get(SYNC_KEYS),
		]);
		// Migrate legacy loreWeaveToken → loreWeaveAccountKey (one-time, silent)
		const legacy = localData.loreWeaveToken;
		if (legacy && !syncData.loreWeaveAccountKey) {
			syncData.loreWeaveAccountKey = legacy;
			await browser.storage.sync.set({ loreWeaveAccountKey: legacy });
			await browser.storage.local.remove("loreWeaveToken");
		}
		return { ...DEFAULT_CONFIG, ...localData, ...syncData };
	} catch (error) {
		debugError("Error loading configuration:", error);
		return { ...DEFAULT_CONFIG };
	}
}

// Save configuration to storage (routes sync keys to browser.storage.sync)
async function saveConfig(config) {
	try {
		const syncConfig = {};
		const localConfig = {};

		for (const [key, value] of Object.entries(config)) {
			if (value === null || value === undefined) continue;
			if (SYNC_KEYS.includes(key)) {
				syncConfig[key] = value;
			} else {
				localConfig[key] = value;
			}
		}

		await Promise.all([
			Object.keys(localConfig).length
				? browser.storage.local.set(localConfig)
				: Promise.resolve(),
			Object.keys(syncConfig).length
				? browser.storage.sync.set(syncConfig)
				: Promise.resolve(),
		]);
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
