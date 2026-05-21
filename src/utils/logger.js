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
let debugLengthCache = 300;
let lastTruncateCheck = 0;
const originalConsoleError = console.error.bind(console);
const originalConsoleLog = console.log.bind(console);
let persistentLoggingEnabled = true;
const MAX_LOG_MESSAGE_LENGTH = 8000;

// Deduplication window to suppress near-identical logs that occur in quick
// succession (e.g., duplicate debug calls from different modules).
const DEDUPE_WINDOW_MS = 1000;
const _recentLogMap = new Map();
let _dedupePruneCounter = 0;
const _DEDUPE_PRUNE_INTERVAL = 500;

function _safeKeyFromArgs(args) {
	try {
		return args.map((a) => (typeof a === "string" ? a : safeStringify(a))).join(" || ");
	} catch (e) {
		return String(args);
	}
}

function _isDuplicateAndRecord(key) {
	const now = Date.now();
	const last = _recentLogMap.get(key);
	if (last && now - last < DEDUPE_WINDOW_MS) {
		return true;
	}
	_recentLogMap.set(key, now);
	_dedupePruneCounter += 1;
	if (_dedupePruneCounter % _DEDUPE_PRUNE_INTERVAL === 0) {
		const cutoff = now - DEDUPE_WINDOW_MS * 2;
		for (const [k, v] of _recentLogMap) {
			if (v < cutoff) _recentLogMap.delete(k);
		}
	}
	return false;
}

function getStorageLocal() {
	try {
		if (typeof browser !== "undefined" && browser?.storage?.local) {
			return browser.storage.local;
		}
	} catch (err) {
		// ignore
	}
	try {
		if (typeof chrome !== "undefined" && chrome?.storage?.local) {
			return chrome.storage.local;
		}
	} catch (err) {
		// ignore
	}
	return null;
}

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
		if (
			debugModeCache !== null &&
			Date.now() - lastDebugCheck < DEBUG_CACHE_TTL_MS
		) {
			return debugModeCache;
		}

		const storageLocal = getStorageLocal();
		if (storageLocal) {
			const { debugMode } = await storageLocal.get("debugMode");
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
		const now = Date.now();
		if (lastTruncateCheck && now - lastTruncateCheck < DEBUG_CACHE_TTL_MS) {
			return { enabled: debugTruncateCache, length: debugLengthCache };
		}

		const storageLocal = getStorageLocal();
		if (!storageLocal) {
			return { enabled: true, length: 300 };
		}
		const result = await storageLocal.get([
			"debugTruncateOutput",
			"debugTruncateLength",
		]);
		debugTruncateCache = result.debugTruncateOutput !== false;
		debugLengthCache = result.debugTruncateLength || 300;
		lastTruncateCheck = now;

		return { enabled: debugTruncateCache, length: debugLengthCache };
	} catch (err) {
		return { enabled: true, length: 300 };
	}
}

/**
 * Format and optionally truncate output
 * @param {*} value - Value to format
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string}
 */
function formatOutput(value, maxLength = 300) {
	const str = safeStringify(value);
	if (str.length > maxLength) {
		return (
			str.substring(0, maxLength) +
			`... [truncated, ${str.length - maxLength} more chars]`
		);
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

	function _logNow(truncatedArgs) {
		try {
			const key = _safeKeyFromArgs(truncatedArgs);
			if (_isDuplicateAndRecord(key)) return;
			originalConsoleLog(...truncatedArgs);
			recordPersistent("debug", truncatedArgs);
		} catch (e) {
			try {
				originalConsoleLog(...truncatedArgs);
				recordPersistent("debug", truncatedArgs);
			} catch (_) { /* swallow */ }
		}
	}

	if (immediate !== null) {
		if (immediate) {
			getTruncationSettings()
				.then((settings) => {
					const truncatedArgs = settings.enabled
						? args.map((arg) => formatOutput(arg, settings.length))
						: args;
					_logNow(truncatedArgs);
				})
				.catch(() => {
					_logNow(args);
				});
		}
		return;
	}

	isDebugEnabledAsync()
		.then((enabled) => {
			if (enabled) {
				getTruncationSettings()
					.then((settings) => {
						const truncatedArgs = settings.enabled
							? args.map((arg) => formatOutput(arg, settings.length))
							: args;
						_logNow(truncatedArgs);
					})
					.catch(() => {
						_logNow(args);
					});
			}
		})
		.catch(() => {
			/* swallow logging errors */
		});
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
 * Error-only logger that honors the debug toggle.
 * @param  {...any} args - Arguments to log as errors
 */
export function debugError(...args) {
	const immediate = isPopupDebugEnabledSync();

	function _errorNow(truncatedArgs) {
		try {
			const key = _safeKeyFromArgs(truncatedArgs);
			if (_isDuplicateAndRecord(key)) return;
			originalConsoleError(...truncatedArgs);
			recordPersistent("error", truncatedArgs);
		} catch (e) {
			try {
				originalConsoleError(...truncatedArgs);
				recordPersistent("error", truncatedArgs);
			} catch (_) { /* swallow */ }
		}
	}

	if (immediate !== null) {
		if (immediate) {
			getTruncationSettings()
				.then((settings) => {
					const truncatedArgs = settings.enabled
						? args.map((arg) => formatOutput(arg, settings.length))
						: args;
					_errorNow(truncatedArgs);
				})
				.catch(() => {
					_errorNow(args);
				});
		}
		return;
	}

	isDebugEnabledAsync()
		.then((enabled) => {
			if (enabled) {
				getTruncationSettings()
					.then((settings) => {
						const truncatedArgs = settings.enabled
							? args.map((arg) => formatOutput(arg, settings.length))
							: args;
						_errorNow(truncatedArgs);
					})
					.catch(() => {
						_errorNow(args);
					});
			}
		})
		.catch(() => {
			/* swallow logging errors */
		});
}

/**
 * Warning-only logger that honors the debug toggle.
 * @param  {...any} args
 */
export function debugWarn(...args) {
	const immediate = isPopupDebugEnabledSync();

	function _warnNow(truncatedArgs) {
		try {
			const key = _safeKeyFromArgs(truncatedArgs);
			if (_isDuplicateAndRecord(key)) return;
			console.warn(...truncatedArgs);
			recordPersistent("warn", truncatedArgs);
		} catch (e) {
			try {
				console.warn(...truncatedArgs);
				recordPersistent("warn", truncatedArgs);
			} catch (_) { /* swallow */ }
		}
	}

	if (immediate !== null) {
		if (immediate) {
			getTruncationSettings()
				.then((settings) => {
					const truncatedArgs = settings.enabled
						? args.map((arg) => formatOutput(arg, settings.length))
						: args;
					_warnNow(truncatedArgs);
				})
				.catch(() => {
					_warnNow(args);
				});
		}
		return;
	}

	isDebugEnabledAsync()
		.then((enabled) => {
			if (enabled) {
				getTruncationSettings()
					.then((settings) => {
						const truncatedArgs = settings.enabled
							? args.map((arg) => formatOutput(arg, settings.length))
							: args;
						_warnNow(truncatedArgs);
					})
					.catch(() => {
						_warnNow(args);
					});
			}
		})
		.catch(() => {
			/* swallow logging errors */
		});
}

// Expose globally for non-module scripts that still want a shared debugLog helper.
try {
	if (typeof globalThis !== "undefined" && !globalThis.debugLog) {
		globalThis.debugLog = debugLog;
	}
	if (typeof globalThis !== "undefined" && !globalThis.debugWarn) {
		globalThis.debugWarn = debugWarn;
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

	setLogLevel(level) {
		this.minLevel = level;
	}

	setTraceEnabled(enabled) {
		this.traceEnabled = enabled;
		if (enabled && !this.startTime) {
			this.startTime = performance.now();
			this.lastStepTime = this.startTime;
		}
	}

	debug(message, data) {
		this._log(LogLevel.DEBUG, message, data);
	}

	info(message, data) {
		this._log(LogLevel.INFO, message, data);
	}

	warn(message, data) {
		this._log(LogLevel.WARN, message, data);
	}

	error(message, data) {
		this._log(LogLevel.ERROR, message, data);
	}

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

		const timeInfo = `[+${sinceStart.toFixed(0)}ms | +${sinceLast.toFixed(0)}ms]`;
		this._log(LogLevel.INFO, `TRACE STEP: ${step} ${timeInfo}`, data);
	}

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

	resetTrace() {
		this.traceSteps = [];
		this.startTime = this.traceEnabled ? performance.now() : null;
		this.lastStepTime = this.startTime;
	}

	_log(level, message, data) {
		if (level < this.minLevel) return;

		const timestamp = new Date().toISOString();
		const prefix = `[${timestamp}][${this._getLevelName(level)}][${this.context}]`;

		if (data !== undefined) {
			let dataToLog;
			try {
				dataToLog = typeof data === "object" ? JSON.stringify(data) : data;
			} catch (e) {
				dataToLog = "[Circular or large object]";
			}

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

export default {
	createLogger,
	LogLevel,
	debugLog,
	debugError,
	debugWarn,
	setPersistentLoggingEnabled,
	setMaxPersistentEntries,
	getStoredLogs,
	exportLogsBlob,
	downloadLogs,
	clearStoredLogs,
	uploadLogsWithAdapter,
};
