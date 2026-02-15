// Utility for structured logging and tracing in RanobesGemini
import * as logStore from "./log-store.js";

/**
 * LogLevel enum - defines the different logging levels
 */
export const LogLevel = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
	NONE: 4,
};

// Simple debug logger gated by the extension's debug mode setting. This is lightweight so callers
// can safely replace console.log with debugLog without worrying about availability.
let debugModeCache = null;
let lastDebugCheck = 0;
const DEBUG_CACHE_TTL_MS = 3000;
// Caching for debug truncation settings
let debugTruncateCache = null;
let debugLengthCache = 500;
let lastTruncateCheck = 0;
const originalConsoleError = console.error.bind(console);
const originalConsoleLog = console.log.bind(console);
let persistentLoggingEnabled = true;
const MAX_LOG_MESSAGE_LENGTH = 8000;

function isPopupDebugEnabledSync() {
	try {
		if (typeof window !== "undefined" && window.debugModeCheckbox) {
			return !!window.debugModeCheckbox.checked;
		}
	} catch (err) {
		// ignore and fall through to async storage read
	}
	return null;
}

async function isDebugEnabledAsync() {
	try {
		// Return cached value if it is fresh
		if (
			debugModeCache !== null &&
			Date.now() - lastDebugCheck < DEBUG_CACHE_TTL_MS
		) {
			return debugModeCache;
		}

		if (
			typeof browser !== "undefined" &&
			browser.storage &&
			browser.storage.local
		) {
			const { debugMode } = await browser.storage.local.get("debugMode");
			debugModeCache = !!debugMode;
			lastDebugCheck = Date.now();
			return debugModeCache;
		}
	} catch (err) {
		// ignore errors; default to false below
	}
	return false;
}

/**
 * Get debug truncation settings from storage
 * @returns {Promise<{enabled: boolean, length: number}>}
 */
async function getTruncationSettings() {
	try {
		// Return cached values if recently checked
		const now = Date.now();
		if (lastTruncateCheck && now - lastTruncateCheck < DEBUG_CACHE_TTL_MS) {
			return { enabled: debugTruncateCache, length: debugLengthCache };
		}

		const result = await browser.storage.local.get([
			"debugTruncateOutput",
			"debugTruncateLength",
		]);
		debugTruncateCache =
			result.debugTruncateOutput !== false ? true : false;
		debugLengthCache = result.debugTruncateLength || 500;
		lastTruncateCheck = now;

		return { enabled: debugTruncateCache, length: debugLengthCache };
	} catch (err) {
		// Return defaults on error
		return { enabled: true, length: 500 };
	}
}

/**
 * Format and optionally truncate output
 * @param {*} value - Value to format
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string}
 */
function formatOutput(value, maxLength = 500) {
	const str = safeStringify(value);
	if (str.length > maxLength) {
		return str.substring(0, maxLength) + `... [truncated, ${str.length - maxLength} more chars]`;
	}
	return str;
}

/**
 * Debug-only logger. Replace console.log with this to respect the user's debug mode toggle.
 * Works in popup (sync checkbox) and other extension contexts (async storage lookup).
 * @param  {...any} args - Arguments to log
 */
export function debugLog(...args) {
	const immediate = isPopupDebugEnabledSync();
	if (immediate !== null) {
		if (immediate) {
			// Apply truncation synchronously for popup context
			getTruncationSettings()
				.then((settings) => {
					const truncatedArgs = settings.enabled
						? args.map((arg) => formatOutput(arg, settings.length))
						: args;
					originalConsoleLog(...truncatedArgs);
					recordPersistent("debug", truncatedArgs);
				})
				.catch(() => {
					originalConsoleLog(...args);
					recordPersistent("debug", args);
				});
		}
		return;
	}

	// Fallback to async storage check for background/content/library contexts
	isDebugEnabledAsync()
		.then((enabled) => {
			if (enabled) {
				getTruncationSettings()
					.then((settings) => {
						const truncatedArgs = settings.enabled
							? args.map((arg) =>
									formatOutput(arg, settings.length),
								)
							: args;
						originalConsoleLog(...truncatedArgs);
						recordPersistent("debug", truncatedArgs);
					})
					.catch(() => {
						originalConsoleLog(...args);
						recordPersistent("debug", args);
					});
			}
		})
		.catch(() => {
			/* swallow logging errors */
		});
}

function shouldLogNowSync() {
	const immediate = isPopupDebugEnabledSync();
	if (immediate !== null) return immediate;
	return !!debugModeCache;
}

function safeStringify(value) {
	try {
		if (value instanceof Error) {
			return value.stack || value.message || String(value);
		}
		if (typeof value === "object") {
			return JSON.stringify(value);
		}
		return String(value);
	} catch (err) {
		return "[unserializable]";
	}
}

function buildLogEntry(level, args) {
	const message = args
		.map((arg) => safeStringify(arg))
		.join(" ")
		.slice(0, MAX_LOG_MESSAGE_LENGTH);
	return {
		id:
			typeof crypto !== "undefined" && crypto.randomUUID
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		ts: Date.now(),
		level,
		message,
	};
}

function recordPersistent(level, args) {
	if (!persistentLoggingEnabled) return;
	try {
		const entry = buildLogEntry(level, args);
		logStore.appendLog(entry);
	} catch (err) {
		// do not break caller on log persistence failure
	}
}

/**
 * Error-only logger that honors the debug toggle. Replace console.error with this when you want
 * errors hidden unless debug is on.
 * @param  {...any} args - Arguments to log as errors
 */
export function debugError(...args) {
	if (shouldLogNowSync()) {
		getTruncationSettings()
			.then((settings) => {
				const truncatedArgs = settings.enabled
					? args.map((arg) => formatOutput(arg, settings.length))
					: args;
				originalConsoleError(...truncatedArgs);
				recordPersistent("error", truncatedArgs);
			})
			.catch(() => {
				originalConsoleError(...args);
				recordPersistent("error", args);
			});
		return;
	}

	// Refresh cache asynchronously so future calls can log promptly when enabled
	isDebugEnabledAsync().catch(() => {});
}

// Optional global gating of console.error so that existing error logs also respect debug mode.
try {
	if (!console.__rgErrorWrapped) {
		console.error = (...args) => debugError(...args);
		console.__rgErrorWrapped = true;
		// Prime cache asynchronously without forcing output
		isDebugEnabledAsync().catch(() => {});
	}
} catch (err) {
	// ignore
}

// Gate console.log as well so existing logs are hidden unless debug is enabled.
try {
	if (!console.__rgLogWrapped) {
		console.log = (...args) => {
			if (shouldLogNowSync()) {
				originalConsoleLog(...args);
				recordPersistent("debug", args);
				return;
			}
			isDebugEnabledAsync().catch(() => {});
		};
			console.__rgLogWrapped = true;
			isDebugEnabledAsync().catch(() => {});
		}
} catch (err) {
	// ignore
}

// Expose globally for non-module scripts that still want a shared debugLog helper.
try {
	if (typeof globalThis !== "undefined" && !globalThis.debugLog) {
		globalThis.debugLog = debugLog;
	}
} catch (err) {
	// ignore
}

/**
 * Logger class for RanobesGemini extension
 * Provides consistent logging with context, timestamps, and log levels
 */
export class Logger {
	constructor(context, minLevel = LogLevel.INFO) {
		this.context = context;
		this.minLevel = minLevel;
		this.traceEnabled = false;
		this.traceSteps = [];
		this.startTime = null;
		this.lastStepTime = null;
	}

	/**
	 * Set the minimum log level
	 * @param {LogLevel} level - Minimum level to log
	 */
	setLogLevel(level) {
		this.minLevel = level;
	}

	/**
	 * Enable or disable trace mode
	 * @param {boolean} enabled - Whether tracing is enabled
	 */
	setTraceEnabled(enabled) {
		this.traceEnabled = enabled;
		if (enabled && !this.startTime) {
			this.startTime = performance.now();
			this.lastStepTime = this.startTime;
		}
	}

	/**
	 * Log a message at the DEBUG level
	 * @param {string} message - Message to log
	 * @param {any} data - Optional data to include in the log
	 */
	debug(message, data) {
		this._log(LogLevel.DEBUG, message, data);
	}

	/**
	 * Log a message at the INFO level
	 * @param {string} message - Message to log
	 * @param {any} data - Optional data to include in the log
	 */
	info(message, data) {
		this._log(LogLevel.INFO, message, data);
	}

	/**
	 * Log a message at the WARN level
	 * @param {string} message - Message to log
	 * @param {any} data - Optional data to include in the log
	 */
	warn(message, data) {
		this._log(LogLevel.WARN, message, data);
	}

	/**
	 * Log a message at the ERROR level
	 * @param {string} message - Message to log
	 * @param {any} data - Optional data to include in the log
	 */
	error(message, data) {
		this._log(LogLevel.ERROR, message, data);
	}

	/**
	 * Add a trace step with timing information
	 * @param {string} step - Description of the step
	 * @param {any} data - Optional data to include in the trace
	 */
	traceStep(step, data = null) {
		if (!this.traceEnabled) return;

		const now = performance.now();
		const sinceStart = now - this.startTime;
		const sinceLast = now - this.lastStepTime;

		const traceData = {
			step,
			time: {
				total: sinceStart.toFixed(2) + "ms",
				sinceLast: sinceLast.toFixed(2) + "ms",
			},
			...(data && { data }),
		};

		this.traceSteps.push(traceData);
		this.lastStepTime = now;

		// Also log the trace step immediately as INFO
		const timeInfo = `[+${sinceStart.toFixed(0)}ms | +${sinceLast.toFixed(
			0
		)}ms]`;
		this._log(LogLevel.INFO, `TRACE STEP: ${step} ${timeInfo}`, data);
	}

	/**
	 * Get the complete trace as a formatted string
	 * @returns {string} - Formatted trace log
	 */
	getFormattedTrace() {
		if (!this.traceEnabled || this.traceSteps.length === 0) {
			return "No trace data available";
		}

		let output = `===== TRACE REPORT: ${this.context} =====\n`;
		output += `Total execution time: ${(
			performance.now() - this.startTime
		).toFixed(2)}ms\n`;
		output += "Steps:\n";

		this.traceSteps.forEach((step, index) => {
			output += `${index + 1}. ${step.step} (${step.time.total}, +${
				step.time.sinceLast
			})\n`;
			if (step.data) {
				const dataStr =
					typeof step.data === "object"
						? JSON.stringify(step.data, null, 2)
						: step.data.toString();
				output += `   Data: ${dataStr}\n`;
			}
		});

		output += "=====================================";
		return output;
	}

	/**
	 * Reset the trace data
	 */
	resetTrace() {
		this.traceSteps = [];
		this.startTime = this.traceEnabled ? performance.now() : null;
		this.lastStepTime = this.startTime;
	}

	/**
	 * Internal method to handle logging
	 * @private
	 */
	_log(level, message, data) {
		if (level < this.minLevel) return;

		const timestamp = new Date().toISOString();
		const prefix = `[${timestamp}][${this._getLevelName(level)}][${
			this.context
		}]`;

		if (data !== undefined) {
			let dataToLog;
			try {
				dataToLog =
					typeof data === "object" ? JSON.stringify(data) : data;
			} catch (e) {
				dataToLog = "[Circular or large object]";
			}

			// Choose appropriate logging method based on level
			switch (level) {
				case LogLevel.ERROR:
					console.error(prefix, message, dataToLog);
					break;
				case LogLevel.WARN:
					console.warn(prefix, message, dataToLog);
					break;
				case LogLevel.INFO:
					console.info(prefix, message, dataToLog);
					break;
				case LogLevel.DEBUG:
				default:
					console.debug(prefix, message, dataToLog);
					break;
			}
		} else {
			// Choose appropriate logging method based on level
			switch (level) {
				case LogLevel.ERROR:
					console.error(prefix, message);
					break;
				case LogLevel.WARN:
					console.warn(prefix, message);
					break;
				case LogLevel.INFO:
					console.info(prefix, message);
					break;
				case LogLevel.DEBUG:
				default:
					console.debug(prefix, message);
					break;
			}
		}
	}

	/**
	 * Get the name of a log level
	 * @private
	 */
	_getLevelName(level) {
		switch (level) {
			case LogLevel.DEBUG:
				return "DEBUG";
			case LogLevel.INFO:
				return "INFO";
			case LogLevel.WARN:
				return "WARN";
			case LogLevel.ERROR:
				return "ERROR";
			default:
				return "UNKNOWN";
		}
	}
}

/**
 * Create a new logger instance
 * @param {string} context - The context for the logger
 * @param {LogLevel} minLevel - Minimum level to log
 * @returns {Logger} - A new logger instance
 */
export function createLogger(context, minLevel = LogLevel.INFO) {
	return new Logger(context, minLevel);
}

export function setPersistentLoggingEnabled(enabled) {
	persistentLoggingEnabled = !!enabled;
}

export function setMaxPersistentEntries(limit) {
	if (typeof limit === "number" && limit > 100) {
		logStore.setMaxEntries(limit);
	}
}

export async function getStoredLogs(limit = 1000) {
	return logStore.getLogs(limit);
}

export async function exportLogsBlob(options = {}) {
	return logStore.exportLogsBlob(options);
}

export async function downloadLogs(options = {}) {
	return logStore.downloadLogs(options);
}

export async function clearStoredLogs() {
	return logStore.clearLogs();
}

export async function uploadLogsWithAdapter(adapter, options = {}) {
	return logStore.uploadWithAdapter(adapter, options);
}

// Default export for easier importing
export default {
	createLogger,
	LogLevel,
	debugLog,
	debugError,
	setPersistentLoggingEnabled,
	setMaxPersistentEntries,
	getStoredLogs,
	exportLogsBlob,
	downloadLogs,
	clearStoredLogs,
	uploadLogsWithAdapter,
};
