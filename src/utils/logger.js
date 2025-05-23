// Utility for structured logging and tracing in RanobesGemini

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

// Default export for easier importing
export default { createLogger, LogLevel };
