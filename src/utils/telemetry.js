/**
 * Telemetry System for Ranobe Gemini
 * Opt-out analytics using CFlair-Counter
 *
 * PRIVACY NOTICE:
 * - Enabled by default (opt-out)
 * - Only tracks anonymous view counts
 * - No personal information or reading data collected
 * - User can disable anytime in settings
 */

import { debugLog, debugError } from "./logger.js";

const TELEMETRY_CONFIG_KEY = "rg_telemetry_config";
const FIRST_RUN_KEY = "rg_first_run_complete";

// CFlair-Counter API configuration
const CFLAIR_API_BASE = "https://cflaircounter.pages.dev";
const PROJECT_NAME = "ranobe-gemini";

/**
 * Default telemetry configuration
 * NOTE: Enabled by default (opt-out model)
 */
const DEFAULT_CONFIG = {
	enabled: true, // Opt-out: enabled by default
	consentShown: false,
	consentDate: null,
	customWebhookUrl: "", // Optional custom webhook for advanced users
	sendUsageStats: true,
	sendErrorReports: true,
	installId: null, // Anonymous installation identifier
};

/**
 * Get telemetry configuration
 */
export async function getTelemetryConfig() {
	try {
		const result = await browser.storage.local.get(TELEMETRY_CONFIG_KEY);
		return { ...DEFAULT_CONFIG, ...result[TELEMETRY_CONFIG_KEY] };
	} catch (error) {
		debugError("Failed to get telemetry config:", error);
		return DEFAULT_CONFIG;
	}
}

/**
 * Save telemetry configuration
 */
export async function saveTelemetryConfig(config) {
	try {
		const current = await getTelemetryConfig();
		const updated = { ...current, ...config };
		await browser.storage.local.set({ [TELEMETRY_CONFIG_KEY]: updated });
		debugLog("Telemetry config saved:", updated);
		return true;
	} catch (error) {
		debugError("Failed to save telemetry config:", error);
		return false;
	}
}

/**
 * Check if this is first run (for showing consent dialog)
 */
export async function isFirstRun() {
	try {
		const result = await browser.storage.local.get(FIRST_RUN_KEY);
		return !result[FIRST_RUN_KEY];
	} catch (error) {
		debugError("Failed to check first run:", error);
		return true;
	}
}

/**
 * Mark first run as complete
 */
export async function markFirstRunComplete() {
	try {
		await browser.storage.local.set({ [FIRST_RUN_KEY]: Date.now() });
		return true;
	} catch (error) {
		debugError("Failed to mark first run complete:", error);
		return false;
	}
}

/**
 * Generate anonymous installation ID
 * This is NOT linked to any personal information
 */
function generateInstallId() {
	const array = new Uint8Array(16);
	crypto.getRandomValues(array);
	return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Initialize telemetry (should be called once on extension load)
 */
export async function initializeTelemetry() {
	const config = await getTelemetryConfig();

	// Generate install ID if not exists
	if (!config.installId) {
		config.installId = generateInstallId();
		await saveTelemetryConfig(config);
	}

	return config;
}

/**
 * Send telemetry ping using CFlair-Counter API
 * Only sends if user has NOT opted out
 * @param {string} eventType - Type of event (used as feature suffix)
 * @param {Object} data - Event data (no personal info)
 */
export async function sendTelemetryPing(eventType, data = {}) {
	try {
		const config = await getTelemetryConfig();

		if (!config.enabled) {
			return false;
		}

		// Send view to CFlair-Counter
		const projectKey = `${PROJECT_NAME}-${eventType}`;
		const response = await fetch(
			`${CFLAIR_API_BASE}/api/views/${projectKey}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			},
		);

		if (!response.ok) {
			debugError("Telemetry ping failed:", response.status);
			return false;
		}

		debugLog("Telemetry ping sent:", eventType);

		// Also send to custom webhook if configured
		if (config.customWebhookUrl) {
			await sendToCustomWebhook(config, eventType, data);
		}

		return true;
	} catch (error) {
		// Silently fail - telemetry should never break the app
		debugError("Telemetry error (silent):", error.message);
		return false;
	}
}

/**
 * Send to custom webhook (for advanced users)
 */
async function sendToCustomWebhook(config, eventType, data) {
	try {
		const payload = {
			event: eventType,
			timestamp: new Date().toISOString(),
			installId: config.installId,
			version: browser.runtime.getManifest?.()?.version || "unknown",
			browser: detectBrowser(),
			...data,
		};

		await fetch(config.customWebhookUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});
	} catch (error) {
		debugError("Custom webhook error:", error.message);
	}
}

/**
 * Track extension installation/update
 */
export async function trackInstall(isUpdate = false) {
	return sendTelemetryPing(
		isUpdate ? "extension_update" : "extension_install",
		{
			action: isUpdate ? "update" : "install",
		},
	);
}

/**
 * Track feature usage (anonymous)
 */
export async function trackFeatureUsage(feature) {
	return sendTelemetryPing("feature_usage", {
		feature,
	});
}

/**
 * Track errors (for diagnostics, no personal data)
 */
export async function trackError(errorType, context = {}) {
	const config = await getTelemetryConfig();

	if (!config.sendErrorReports) {
		return false;
	}

	return sendTelemetryPing("error", {
		errorType,
		context: sanitizeContext(context),
	});
}

/**
 * Sanitize context to remove any potential personal data
 */
function sanitizeContext(context) {
	const sanitized = {};
	const safeKeys = ["type", "code", "status", "handler", "feature"];

	for (const key of safeKeys) {
		if (context[key] !== undefined) {
			sanitized[key] = String(context[key]).substring(0, 100);
		}
	}

	return sanitized;
}

/**
 * Detect browser
 */
function detectBrowser() {
	if (typeof browser !== "undefined" && browser.runtime?.getBrowserInfo) {
		return "firefox";
	}
	if (navigator.userAgent.includes("Edg/")) {
		return "edge";
	}
	if (navigator.userAgent.includes("Chrome")) {
		return "chrome";
	}
	return "unknown";
}

/**
 * Opt-in to telemetry (re-enable after opting out)
 */
export async function optInTelemetry(customWebhookUrl = "") {
	await saveTelemetryConfig({
		enabled: true,
		consentShown: true,
		consentDate: Date.now(),
		customWebhookUrl,
		sendUsageStats: true,
		sendErrorReports: true,
	});

	// Send initial ping
	await sendTelemetryPing("opt_in", {});
}

/**
 * Opt-out of telemetry (disable tracking)
 */
export async function optOutTelemetry() {
	// Send final ping before disabling
	await sendTelemetryPing("opt_out", {});

	await saveTelemetryConfig({
		enabled: false,
		consentShown: true,
		consentDate: Date.now(),
		sendUsageStats: false,
		sendErrorReports: false,
	});
}

/**
 * Get view statistics from CFlair-Counter
 */
export async function getViewStats() {
	try {
		const response = await fetch(
			`${CFLAIR_API_BASE}/api/views/${PROJECT_NAME}`,
		);
		if (!response.ok) {
			return null;
		}
		return await response.json();
	} catch (error) {
		debugError("Failed to get view stats:", error);
		return null;
	}
}

/**
 * Get badge URL for embedding
 * @param {string} color - Badge color (blue, green, purple, etc.)
 * @param {string} label - Badge label
 */
export function getBadgeUrl(color = "purple", label = "users") {
	return `${CFLAIR_API_BASE}/api/views/${PROJECT_NAME}/badge?color=${color}&label=${label}`;
}

/**
 * Show consent recorded (user saw the dialog)
 */
export async function markConsentShown() {
	await saveTelemetryConfig({
		consentShown: true,
	});
}
