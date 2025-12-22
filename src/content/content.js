// Lightweight logger bootstrap for content scripts (no top-level imports allowed here)
let debugLog = console.log.bind(console);
let debugError = console.error.bind(console);
(async () => {
	try {
		if (typeof browser !== "undefined" && browser.runtime?.getURL) {
			const url = browser.runtime.getURL("utils/logger.js");
			const mod = await import(url);
			debugLog = mod.debugLog || debugLog;
			debugError = mod.debugError || debugError;
		}
	} catch (_err) {
		// keep console fallbacks
	}
})();

// Simplified content script to extract chapter content without relying on imports

debugLog("Ranobe Gemini: Content script loaded");

// Note: Import statements need to be modified since content scripts don't support direct ES6 imports
// We'll need to dynamically load our handler modules

// Initial constants and global state
let currentHandler = null; // Will store the website-specific handler
let formattingOptions = {
	useEmoji: false,
	formatGameStats: true,
	centerSceneHeadings: true,
};
let hasExtractButton = false;
let autoExtracted = false;
var isInitialized = false; // Track if the content script is fully initialized (var to avoid redeclaration)
let storageManager = null; // Storage manager instance for caching
let isCachedContent = false; // Track if current page has cached enhanced content
let currentFontSize = 100; // Font size percentage (default 100%)
if (window.__RGInitDone) {
	debugLog(
		"Ranobe Gemini: Content script already initialized, skipping duplicate load."
	);
} else {
	window.__RGInitDone = true;
	let isBackgroundScriptReady = false; // Track if the background script is ready
	const KEEP_ALIVE_PORT_NAME = "rg-keepalive";
	let keepAlivePort = null;
	let keepAliveHeartbeat = null;
	let keepAliveReconnectTimer = null;
	let keepAliveRetryCount = 0;
	const keepAliveConfigDefaults = {
		heartbeatMs: 20000,
		heartbeatJitterMs: 3000,
		reconnectDelayMs: 7000,
		maxRetries: 4,
	};
	let keepAliveConfig = { ...keepAliveConfigDefaults };

	// Load shared constants for keep-alive tuning when available
	(async () => {
		try {
			if (typeof browser !== "undefined" && browser.runtime?.getURL) {
				const mod = await import(
					browser.runtime.getURL("utils/constants.js")
				);
				keepAliveConfig = {
					...keepAliveConfigDefaults,
					heartbeatMs:
						mod.KEEP_ALIVE_HEARTBEAT_MS ||
						keepAliveConfigDefaults.heartbeatMs,
					heartbeatJitterMs:
						mod.KEEP_ALIVE_HEARTBEAT_JITTER_MS ||
						keepAliveConfigDefaults.heartbeatJitterMs,
					reconnectDelayMs:
						mod.KEEP_ALIVE_RECONNECT_DELAY_MS ||
						keepAliveConfigDefaults.reconnectDelayMs,
					maxRetries:
						mod.KEEP_ALIVE_MAX_PORT_RETRIES ||
						keepAliveConfigDefaults.maxRetries,
				};
				if (keepAliveHeartbeat) restartKeepAlive();
			}
		} catch (_err) {
			// leave defaults
		}
	})();
	let debugModeEnabled = false;

	// Gate console logging based on stored debugMode so logs are hidden by default unless enabled via popup checkbox.
	const __rgOriginalLog = debugLog.bind(console);
	const __rgOriginalError = debugError.bind(console);

	function applyDebugFlag(enabled) {
		debugModeEnabled = !!enabled;
	}

	try {
		browser.storage.local
			.get("debugMode")
			.then((data) => applyDebugFlag(data.debugMode))
			.catch(() => {});
		browser.storage.onChanged.addListener((changes, area) => {
			if (area === "local" && changes.debugMode) {
				applyDebugFlag(changes.debugMode.newValue);
			}
		});
	} catch (_err) {
		// ignore storage access errors
	}

	debugLog = (...args) => {
		if (debugModeEnabled) __rgOriginalLog(...args);
	};
	debugError = (...args) => {
		if (debugModeEnabled) __rgOriginalError(...args);
	};

	function clearKeepAliveTimers() {
		if (keepAliveHeartbeat) {
			clearInterval(keepAliveHeartbeat);
			keepAliveHeartbeat = null;
		}
		if (keepAliveReconnectTimer) {
			clearTimeout(keepAliveReconnectTimer);
			keepAliveReconnectTimer = null;
		}
	}

	function scheduleReconnect(reason) {
		if (keepAliveReconnectTimer) return;
		if (keepAliveRetryCount >= keepAliveConfig.maxRetries) return;
		keepAliveRetryCount += 1;
		const delay = keepAliveConfig.reconnectDelayMs;
		keepAliveReconnectTimer = setTimeout(() => {
			keepAliveReconnectTimer = null;
			startKeepAlivePort(reason || "retry");
		}, delay + Math.floor(Math.random() * (keepAliveConfig.heartbeatJitterMs || 0)));
	}

	function startKeepAlivePort(trigger = "initial") {
		if (keepAlivePort) return;
		clearKeepAliveTimers();
		try {
			keepAlivePort = browser.runtime.connect({
				name: KEEP_ALIVE_PORT_NAME,
			});
			keepAlivePort.onDisconnect.addListener(() => {
				keepAlivePort = null;
				clearKeepAliveTimers();
				scheduleReconnect("disconnect");
			});
			keepAlivePort.onMessage.addListener((msg) => {
				if (msg?.type === "pong") {
					isBackgroundScriptReady = true;
					keepAliveRetryCount = 0;
				}
			});
			const base = keepAliveConfig.heartbeatMs;
			const jitter = keepAliveConfig.heartbeatJitterMs || 0;
			const interval = Math.max(
				5000,
				base + Math.floor(Math.random() * jitter)
			);
			keepAliveHeartbeat = setInterval(() => {
				try {
					keepAlivePort?.postMessage({
						type: "ping",
						ts: Date.now(),
						trigger,
					});
				} catch (_err) {
					keepAlivePort = null;
					scheduleReconnect("postMessage-error");
				}
			}, interval);
		} catch (_err) {
			keepAlivePort = null;
			scheduleReconnect("connect-error");
		}
	}

	function restartKeepAlive() {
		keepAlivePort = null;
		keepAliveRetryCount = 0;
		clearKeepAliveTimers();
		startKeepAlivePort("config-change");
	}

	function ensureKeepAlivePort() {
		if (!keepAlivePort) {
			startKeepAlivePort();
		}
	}

	// Establish keep-alive immediately to reduce first-call failures
	ensureKeepAlivePort();

	// Device detection for responsive design
	let isMobileDevice = false;

	// Function to detect if user is on a mobile device
	function detectMobileDevice() {
		// Check if using a mobile device based on user agent
		const userAgent =
			navigator.userAgent || navigator.vendor || window.opera;
		if (
			/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
				userAgent
			) ||
			/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
				userAgent.substr(0, 4)
			)
		) {
			return true;
		}

		// Check viewport width as an additional indicator
		return window.innerWidth <= 768;
	}

	// Add a minimal HTML sanitizer to remove script tags and code block markers
	function sanitizeHTML(html) {
		if (!html) return html;

		// Remove any <script>...</script> elements
		let sanitized = html.replace(
			/<script[\s\S]*?>[\s\S]*?<\/script>/gi,
			""
		);

		// Remove code block markers like ```html, ```javascript, etc.
		sanitized = sanitized.replace(
			/```(?:html|javascript|css|js|xml|json|md|markdown|)\s*\n?/gi,
			""
		);

		// Remove closing code block markers ```
		sanitized = sanitized.replace(/```\s*\n?/g, "");

		return sanitized;
	}

	// Preserve selected HTML elements (e.g., images) while allowing content replacement
	function preserveHtmlElements(html) {
		if (!html) return { preservedElements: [] };

		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = html;

		const preservedElements = Array.from(tempDiv.querySelectorAll("img"))
			.map((el) => el.outerHTML)
			.filter(Boolean);

		return { preservedElements };
	}

	// Placeholder preservation for structured stat/game boxes used by some sites
	function preserveGameStatsBoxes(html) {
		if (!html || !formattingOptions.formatGameStats) {
			return { modifiedContent: html || "", preservedBoxes: [] };
		}

		const temp = document.createElement("div");
		temp.innerHTML = html;

		const preservedBoxes = [];

		const candidates = temp.querySelectorAll(
			"pre, .game-stats-box, .stat-block"
		);
		candidates.forEach((node) => {
			const text = node.textContent || "";
			if (!text || text.length < 20) return;

			// Heuristic: contains multiple colon-separated lines (stats) or table-like spacing
			const lines = text.split(/\n+/).filter((l) => l.trim().length > 0);
			const hasStatLines =
				lines.filter((l) => l.includes(":")).length >= 2;
			if (!hasStatLines) return;

			// Normalize leading indentation
			const minIndent = Math.min(
				...lines
					.filter((l) => l.trim().length > 0)
					.map((l) =>
						l.match(/^\s+/) ? l.match(/^\s+/)[0].length : 0
					)
			);
			const normalized = lines.map((l) => l.slice(minIndent)).join("\n");

			const wrapper = document.createElement("div");
			wrapper.className = "game-stats-box";
			wrapper.dataset.uid = `gsb-${preservedBoxes.length}-${Date.now()}`;
			wrapper.textContent = normalized;

			preservedBoxes.push({ original: node, wrapper });
			node.replaceWith(wrapper);
		});

		return { modifiedContent: temp.innerHTML, preservedBoxes };
	}

	function restoreGameStatsBoxes(html, preservedBoxes = []) {
		if (!html || preservedBoxes.length === 0) return html || "";
		const temp = document.createElement("div");
		temp.innerHTML = html;
		preservedBoxes.forEach(({ wrapper }) => {
			const placeholder = temp.querySelector(
				`.game-stats-box[data-uid="${wrapper.dataset.uid}"]`
			);
			if (!placeholder) return;
			placeholder.replaceWith(wrapper);
		});
		return temp.innerHTML;
	}

	/**
	 * Sanitizes HTML content while preserving paragraph structure
	 * Converts <p> tags to proper paragraphs and removes other HTML
	 * @param {string} html - The HTML string to clean
	 * @returns {Array<string>} - Array of paragraph texts
	 */
	function extractParagraphsFromHtml(html) {
		if (!html) return [];

		// Remove code block markers first
		let text = html.replace(
			/```(?:html|javascript|css|js|xml|json|md|markdown|python|java|cpp|c\+\+)?\s*\n?/gi,
			""
		);
		text = text.replace(/```/g, "");

		// Create a temporary div to parse HTML
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = text;

		// Check if content has <p> tags
		const pTags = tempDiv.querySelectorAll("p");

		let paragraphs = [];

		if (pTags.length > 0) {
			// Extract text from each <p> tag
			paragraphs = Array.from(pTags)
				.map((p) => p.textContent.trim())
				.filter((text) => text.length > 0);
		} else {
			// No <p> tags - split by double newlines or <br><br>
			// First normalize <br> tags to newlines
			let normalized = text.replace(/<br\s*\/?\?>/gi, "\n");
			// Remove remaining HTML tags
			normalized = normalized.replace(/<[^>]*>/g, "");
			// Split by double newlines
			paragraphs = normalized
				.split(/\n\n+/)
				.map((p) => p.trim())
				.filter((p) => p.length > 0);
		}

		// Decode HTML entities in each paragraph
		return paragraphs.map((p) => {
			return p
				.replace(/&amp;/g, "&")
				.replace(/&lt;/g, "<")
				.replace(/&gt;/g, ">")
				.replace(/&quot;/g, '"')
				.replace(/&#039;/g, "'")
				.replace(/&nbsp;/g, " ");
		});
	}

	/**
	 * Thoroughly strips all HTML tags and properly decodes HTML entities from text
	 * @param {string} html - The HTML string to clean
	 * @returns {string} - Clean text with all HTML tags removed and entities decoded
	 */
	function stripHtmlTags(html) {
		if (!html) return "";

		debugLog("[StripTags Final] Input:", html);

		// Step 0: Remove code block markers first (```html, ```js, etc.)
		let text = html.replace(
			/```(?:html|javascript|css|js|xml|json|md|markdown|python|java|cpp|c\+\+)?\s*\n?/gi,
			""
		);
		// Remove any remaining backtick markers
		text = text.replace(/```/g, "");

		// Step 1: Use regex to remove all HTML tags before DOM parsing
		text = text.replace(/<\/?[^>]+(>|$)/g, "");

		debugLog("[StripTags Final] After initial regex:", text);

		// Step 2: Create a temporary div element to use the browser's HTML parsing
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = text;

		// Step 3: Extract text content which automatically removes all HTML tags
		let textOnly = tempDiv.textContent || tempDiv.innerText || "";

		debugLog("[StripTags Final] After textContent:", textOnly);

		// Step 4: Additional regex replacement to catch any potential leftover tags
		textOnly = textOnly.replace(/<[^>]*>/g, "");

		// Step 5: Properly decode common HTML entities
		textOnly = textOnly
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#039;/g, "'")
			.replace(/&nbsp;/g, " ");

		debugLog("[StripTags Final] After entity decoding:", textOnly);

		// Step 6: Clean up any consecutive whitespace but preserve paragraph breaks
		textOnly = textOnly.replace(/\s+/g, " ").trim();

		debugLog("[StripTags Final] Final output:", textOnly);

		return textOnly;
	}

	// Add a verification function to check background script connection
	async function verifyBackgroundConnection() {
		try {
			const response = await browser.runtime.sendMessage({
				action: "ping",
			});
			debugLog("Background script connection verified:", response);
			isBackgroundScriptReady = response && response.success;
			return isBackgroundScriptReady;
		} catch (error) {
			debugError("Background script connection failed:", error);
			isBackgroundScriptReady = false;
			return false;
		}
	}

	/**
	 * Wake up background service worker with retry logic
	 * Fixes the issue where first click fails because worker is sleeping
	 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
	 * @param {number} delayMs - Delay between retries in milliseconds (default: 500)
	 * @returns {Promise<boolean>} True if background worker is ready
	 */
	async function wakeUpBackgroundWorker(maxRetries = 3, delayMs = 500) {
		for (let i = 0; i < maxRetries; i++) {
			try {
				const response = await browser.runtime.sendMessage({
					action: "ping",
				});
				if (response && response.success) {
					debugLog(
						`Background worker ready (attempt ${
							i + 1
						}/${maxRetries})`
					);
					isBackgroundScriptReady = true;
					return true;
				}
			} catch (error) {
				console.warn(
					`Background wake-up attempt ${i + 1}/${maxRetries} failed:`,
					error.message
				);
				if (i < maxRetries - 1) {
					// Wait before retry (except on last attempt)
					await new Promise((resolve) =>
						setTimeout(resolve, delayMs)
					);
				}
			}
		}
		debugError(
			"Background worker failed to wake up after",
			maxRetries,
			"attempts"
		);
		isBackgroundScriptReady = false;
		return false;
	}

	/**
	 * Send a message to the background script with automatic retry and wake-up logic
	 * This handles the MV3 service worker sleep issue gracefully
	 * @param {object} message - The message to send
	 * @param {number} maxRetries - Maximum retry attempts (default: 3)
	 * @param {number} retryDelayMs - Delay between retries in ms (default: 1000)
	 * @returns {Promise<any>} The response from the background script
	 */
	async function sendMessageWithRetry(
		message,
		maxRetries = 3,
		retryDelayMs = 1000
	) {
		let lastError = null;
		ensureKeepAlivePort();

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				// Try sending the message
				const response = await browser.runtime.sendMessage(message);

				// Check if we got a valid response
				if (response !== undefined) {
					return response;
				}

				// If response is undefined, the worker might have just woken up
				// Try to wake it up explicitly
				throw new Error("Empty response - worker may be waking up");
			} catch (error) {
				lastError = error;
				const errorMessage = error.message || String(error);

				// Check for common service worker disconnection errors
				const isDisconnectionError =
					errorMessage.includes("Extension context invalidated") ||
					errorMessage.includes("Receiving end does not exist") ||
					errorMessage.includes("The message port closed") ||
					errorMessage.includes("Could not establish connection") ||
					errorMessage.includes("Empty response");

				if (isDisconnectionError && attempt < maxRetries) {
					console.warn(
						`[sendMessageWithRetry] Attempt ${attempt}/${maxRetries} failed: ${errorMessage}`
					);
					debugLog(
						`[sendMessageWithRetry] Waking up background worker before retry...`
					);
					ensureKeepAlivePort();

					// Wake up the background worker
					const workerReady = await wakeUpBackgroundWorker(2, 300);

					if (workerReady) {
						debugLog(
							`[sendMessageWithRetry] Worker woken up, retrying in ${retryDelayMs}ms...`
						);
						await new Promise((resolve) =>
							setTimeout(resolve, retryDelayMs)
						);
						continue; // Retry the message
					} else {
						debugError(
							"[sendMessageWithRetry] Could not wake up background worker"
						);
					}
				}

				// If not a disconnection error or last attempt, throw the error
				if (attempt >= maxRetries) {
					debugError(
						`[sendMessageWithRetry] All ${maxRetries} attempts failed. Last error:`,
						lastError
					);
					throw lastError;
				}
			}
		}

		throw lastError || new Error("Failed to send message after retries");
	}

	// Create an enhanced banner with word count comparison and model info
	function createEnhancedBanner(
		originalContent,
		enhancedContent,
		modelInfo,
		showDeleteButton = false
	) {
		// Calculate word counts
		const originalWordCount = countWords(originalContent);
		const enhancedWordCount = countWords(enhancedContent);

		// Calculate percentage change
		const wordDifference = enhancedWordCount - originalWordCount;
		const percentChange =
			originalWordCount > 0
				? Math.round((wordDifference / originalWordCount) * 100)
				: 0;

		// Determine if it's an increase or decrease
		const changeSymbol = wordDifference >= 0 ? "+" : "-";

		// Get model name and provider from modelInfo if available
		const modelName = modelInfo?.name || "AI";
		const modelProvider = modelInfo?.provider || "Ranobe Gemini";
		const cachedLabel = showDeleteButton ? " [ Cached ]" : "";
		const modelDisplay = `Enhanced with ${modelProvider}${
			modelName !== "AI" ? ` (${modelName})` : ""
		}${cachedLabel}`;

		const banner = document.createElement("div");
		banner.className = "gemini-enhanced-banner";
		banner.style.cssText = `
        margin: 15px 0;
        padding: 15px;
        background-color: #f7f7f7;
        border-radius: 8px;
        border: 1px solid #ddd;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    `;

		// Support dark mode
		if (
			document.querySelector(
				'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth'
			) ||
			window.matchMedia("(prefers-color-scheme: dark)").matches
		) {
			banner.style.backgroundColor = "#2c2c2c";
			banner.style.borderColor = "#444";
			banner.style.color = "#e0e0e0";
		}

		const deleteButtonHtml = showDeleteButton
			? `<button class="gemini-delete-cache-btn" title="Delete cached enhanced content" aria-label="Delete cached enhanced content" style="padding: 8px 12px; margin-left: 8px; background-color: #d32f2f; color: white; border: 1px solid #b71c1c; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px;">🗑️</button>`
			: "";

		banner.innerHTML = `
        <div style="display: flex; flex-direction: column; width: 100%;">
			<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center;">
                        <span style="font-size: 18px; margin-right: 5px;">✨</span>
                        <span style="font-weight: bold; margin: 0 10px; font-size: 16px;">${modelDisplay}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="gemini-toggle-btn">Show Original</button>
                        ${deleteButtonHtml}
                    </div>
                </div>
            <div style="width: 100%; font-size: 14px; color: #555; padding-top: 8px; border-top: 1px solid #eee;">
                <span style="font-family: monospace;">
                    Words: ${originalWordCount.toLocaleString()} → ${enhancedWordCount.toLocaleString()}
                    <span style="color: ${
						wordDifference >= 0 ? "#28a745" : "#dc3545"
					}; font-weight: bold;">
                        (${changeSymbol}${wordDifference.toLocaleString()}, ${changeSymbol}${Math.abs(
			percentChange
		)}%)
                    </span>
                </span>
            </div>
        </div>
    `;

		return banner;
	}

	// Function to create a work-in-progress banner
	function createWorkInProgressBanner(currentChunk, totalChunks) {
		const progressPercent = Math.round((currentChunk / totalChunks) * 100);

		const banner = document.createElement("div");
		banner.className = "gemini-wip-banner";
		banner.style.cssText = `
        margin: 15px 0;
        padding: 15px;
        background-color: #fffbea;
        border-radius: 8px;
        border: 1px solid #f0e0a2;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    `;

		// Support dark mode
		if (
			document.querySelector(
				'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth'
			) ||
			window.matchMedia("(prefers-color-scheme: dark)").matches
		) {
			banner.style.backgroundColor = "#3a3a2c";
			banner.style.borderColor = "#5a5a40";
			banner.style.color = "#e0e0e0";
		}

		banner.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 18px; margin-right: 10px;">⏳</span>
            <span style="font-weight: bold; font-size: 16px;">Enhancing Content: Work in Progress</span>
        </div>
        <div style="width: 100%; margin: 10px 0; background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden;">
            <div class="progress-bar" style="width: ${progressPercent}%; background: linear-gradient(90deg, #4285f4, #34a853); height: 100%; transition: width 0.3s ease;"></div>
        </div>
        <div class="progress-text" style="font-size: 14px; color: #555;">
            Processing chunk ${currentChunk} of ${totalChunks} (${progressPercent}% complete). Please wait while the content is being enhanced...
        </div>
        <button class="gemini-cancel-btn" style="margin-top: 10px; padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
            Cancel Enhancement
        </button>
    `;

		// Add cancel button handler
		const cancelBtn = banner.querySelector(".gemini-cancel-btn");
		if (cancelBtn) {
			cancelBtn.addEventListener("click", () => {
				handleCancelEnhancement();
			});
		}

		return banner;
	}

	/**
	 * Create a chunk divider banner with status and full control buttons
	 * @param {number} chunkIndex - Index of the chunk (0-based)
	 * @param {number} totalChunks - Total number of chunks
	 * @param {string} status - 'pending', 'processing', 'completed', 'error'
	 * @param {string} errorMessage - Error message if status is 'error'
	 * @returns {HTMLElement} The chunk banner element
	 */
	function createChunkBanner(
		chunkIndex,
		totalChunks,
		status = "pending",
		errorMessage = null
	) {
		const banner = document.createElement("div");
		banner.className = `gemini-chunk-banner chunk-banner-${chunkIndex}`;
		banner.setAttribute("data-chunk-index", chunkIndex);
		banner.setAttribute("data-chunk-status", status);

		const isDarkMode =
			document.querySelector(
				'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth'
			) || window.matchMedia("(prefers-color-scheme: dark)").matches;

		let bgColor,
			borderColor,
			textColor,
			statusIcon,
			statusText,
			statusBgColor;

		switch (status) {
			case "processing":
				bgColor = isDarkMode ? "#2c3a3a" : "#e3f2fd";
				borderColor = isDarkMode ? "#4a6a6a" : "#90caf9";
				statusBgColor = isDarkMode ? "#1a2a2a" : "#bbdefb";
				statusIcon = "⏳";
				statusText = "Processing...";
				break;
			case "completed":
				bgColor = isDarkMode ? "#2c3a2c" : "#e8f5e9";
				borderColor = isDarkMode ? "#4a6a4a" : "#a5d6a7";
				statusBgColor = isDarkMode ? "#1a2a1a" : "#c8e6c9";
				statusIcon = "✅";
				statusText = "Enhanced";
				break;
			case "error":
				bgColor = isDarkMode ? "#3a2c2c" : "#ffebee";
				borderColor = isDarkMode ? "#6a4a4a" : "#ef9a9a";
				statusBgColor = isDarkMode ? "#2a1a1a" : "#ffcdd2";
				statusIcon = "❌";
				statusText = "Error";
				break;
			default: // pending
				bgColor = isDarkMode ? "#3a3a2c" : "#fff8e1";
				borderColor = isDarkMode ? "#5a5a40" : "#ffcc80";
				statusBgColor = isDarkMode ? "#2a2a1a" : "#ffe0b2";
				statusIcon = "⏸️";
				statusText = "Pending";
		}

		textColor = isDarkMode ? "#e0e0e0" : "#333";
		const buttonBg = isDarkMode ? "#444" : "#f0f0f0";
		const buttonColor = isDarkMode ? "#fff" : "#333";

		banner.style.cssText = `
			margin: 1em 0;
			padding: 10px 12px;
			background-color: ${bgColor};
			border: 1px solid ${borderColor};
			border-radius: 6px;
			box-shadow: 0 1px 4px rgba(0,0,0,0.08);
		`;

		let errorHtml = "";
		if (status === "error" && errorMessage) {
			errorHtml = `
				<div style="margin-top: 8px; padding: 8px; background: rgba(220, 53, 69, 0.1); border-radius: 4px; font-size: 11px; color: ${
					isDarkMode ? "#ff8a80" : "#c62828"
				};">
					Error: ${errorMessage}
				</div>
			`;
		}

		// Build action buttons based on status
		let actionButtons = "";

		// Always show Enhance/Re-enhance button (except during processing)
		if (status !== "processing") {
			const enhanceBtnText =
				status === "completed"
					? "🔄 Re-enhance"
					: status === "error"
					? "🔄 Retry"
					: "✨ Enhance";
			actionButtons += `
				<button class="gemini-chunk-enhance-btn" data-chunk-index="${chunkIndex}" title="Enhance this chunk" style="
					padding: 4px 8px;
					background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
					color: white;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					font-size: 11px;
					font-weight: 600;
				">${enhanceBtnText}</button>
			`;
		}

		// Show Original/Enhanced toggle button (only when completed)
		if (status === "completed") {
			actionButtons += `
				<button class="gemini-chunk-toggle-btn" data-chunk-index="${chunkIndex}" data-showing="enhanced" title="Toggle original/enhanced" style="
					padding: 4px 8px;
					background: ${buttonBg};
					color: ${buttonColor};
					border: 1px solid ${borderColor};
					border-radius: 4px;
					cursor: pointer;
					font-size: 11px;
				">📄 Original</button>
			`;
			// Delete button for this chunk's enhanced data
			actionButtons += `
				<button class="gemini-chunk-delete-btn" data-chunk-index="${chunkIndex}" title="Delete enhanced data for this chunk" style="
					padding: 4px 8px;
					background: #d32f2f;
					color: white;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					font-size: 11px;
				">🗑️</button>
			`;
		}

		banner.innerHTML = `
			<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
				<div style="display: flex; align-items: center; gap: 8px;">
					<span style="font-size: 14px;">${statusIcon}</span>
					<span style="font-weight: 600; font-size: 13px; color: ${textColor};">
						Chunk ${chunkIndex + 1}/${totalChunks}
					</span>
					<span style="padding: 2px 6px; background: ${statusBgColor}; border-radius: 10px; font-size: 10px; font-weight: 500; color: ${textColor};">
						${statusText}
					</span>
				</div>
				<div style="display: flex; align-items: center; gap: 6px;">
					${actionButtons}
				</div>
			</div>
			${errorHtml}
		`;

		// Attach button handlers
		const enhanceBtn = banner.querySelector(".gemini-chunk-enhance-btn");
		if (enhanceBtn) {
			enhanceBtn.addEventListener("click", async (e) => {
				e.preventDefault();
				e.stopPropagation();
				await handleReenhanceChunk(chunkIndex);
			});
		}

		const toggleBtn = banner.querySelector(".gemini-chunk-toggle-btn");
		if (toggleBtn) {
			toggleBtn.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				handleChunkToggle(chunkIndex);
			});
		}

		const deleteBtn = banner.querySelector(".gemini-chunk-delete-btn");
		if (deleteBtn) {
			deleteBtn.addEventListener("click", async (e) => {
				e.preventDefault();
				e.stopPropagation();
				await handleChunkDelete(chunkIndex, totalChunks);
			});
		}

		return banner;
	}

	/**
	 * Toggle between original and enhanced content for a specific chunk
	 * @param {number} chunkIndex - The chunk index to toggle
	 */
	function handleChunkToggle(chunkIndex) {
		const chunkWrapper = document.querySelector(
			`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`
		);
		if (!chunkWrapper) return;

		const chunkContent = chunkWrapper.querySelector(
			".gemini-chunk-content"
		);
		const toggleBtn = chunkWrapper.querySelector(
			".gemini-chunk-toggle-btn"
		);
		if (!chunkContent || !toggleBtn) return;

		const isShowingEnhanced =
			toggleBtn.getAttribute("data-showing") === "enhanced";
		// Use HTML chunk if available, fall back to formatted text
		const originalHtml = chunkContent.getAttribute(
			"data-original-chunk-html"
		);
		const originalContent = chunkContent.getAttribute(
			"data-original-chunk-content"
		);
		const enhancedContent =
			chunkContent.getAttribute("data-enhanced-chunk-content") ||
			chunkContent.innerHTML;

		if (isShowingEnhanced) {
			// Switch to original - use preserved HTML if available
			chunkContent.setAttribute(
				"data-enhanced-chunk-content",
				chunkContent.innerHTML
			);
			if (originalHtml) {
				chunkContent.innerHTML = `<div class="gemini-original-chunk">${originalHtml}</div>`;
			} else {
				chunkContent.innerHTML = `<div class="gemini-original-chunk">${formatOriginalChunkContent(
					originalContent
				)}</div>`;
			}
			toggleBtn.textContent = "✨ Enhanced";
			toggleBtn.setAttribute("data-showing", "original");
		} else {
			// Switch to enhanced
			const savedEnhanced = chunkContent.getAttribute(
				"data-enhanced-chunk-content"
			);
			if (savedEnhanced) {
				chunkContent.innerHTML = savedEnhanced;
			}
			toggleBtn.textContent = "📄 Original";
			toggleBtn.setAttribute("data-showing", "enhanced");
		}
	}

	/**
	 * Delete enhanced data for a specific chunk and revert to original
	 * @param {number} chunkIndex - The chunk index
	 * @param {number} totalChunks - Total number of chunks
	 */
	async function handleChunkDelete(chunkIndex, totalChunks) {
		const chunkWrapper = document.querySelector(
			`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`
		);
		if (!chunkWrapper) return;

		const chunkContent = chunkWrapper.querySelector(
			".gemini-chunk-content"
		);
		if (!chunkContent) return;

		// Use HTML chunk if available, fall back to formatted text
		const originalHtml = chunkContent.getAttribute(
			"data-original-chunk-html"
		);
		const originalContent = chunkContent.getAttribute(
			"data-original-chunk-content"
		);
		if (!originalContent && !originalHtml) {
			showStatusMessage(
				"Original content not available for this chunk.",
				"error"
			);
			return;
		}

		// Revert to original content with preserved HTML if available
		if (originalHtml) {
			chunkContent.innerHTML = originalHtml;
		} else {
			chunkContent.innerHTML =
				formatOriginalChunkContent(originalContent);
		}
		chunkContent.removeAttribute("data-chunk-enhanced");
		chunkContent.removeAttribute("data-enhanced-chunk-content");

		// Update banner to pending state
		const banner = chunkWrapper.querySelector(".gemini-chunk-banner");
		if (banner) {
			const newBanner = createChunkBanner(
				chunkIndex,
				totalChunks,
				"pending"
			);
			banner.replaceWith(newBanner);
		}

		// Update cache - save current state
		await saveCurrentChunkedState();
		showStatusMessage(
			`Chunk ${chunkIndex + 1} reverted to original.`,
			"info",
			2000
		);
	}

	/**
	 * Save current chunked content state to cache
	 */
	async function saveCurrentChunkedState() {
		if (!storageManager) return;

		const allChunks = document.querySelectorAll(".gemini-chunk-content");
		if (allChunks.length === 0) return;

		const hasAnyEnhanced = Array.from(allChunks).some(
			(c) => c.getAttribute("data-chunk-enhanced") === "true"
		);
		if (!hasAnyEnhanced) {
			// All chunks are original, remove from cache
			await storageManager.removeEnhancedContent(window.location.href);
			isCachedContent = false;
			return;
		}

		// Collect current state
		const chunkContents = Array.from(allChunks)
			.sort(
				(a, b) =>
					parseInt(a.getAttribute("data-chunk-index")) -
					parseInt(b.getAttribute("data-chunk-index"))
			)
			.map((c) => c.innerHTML);

		const combinedContent = chunkContents.join("\n\n");
		const originalContent =
			findContentArea()?.getAttribute("data-original-html") || "";

		try {
			await storageManager.saveEnhancedContent(window.location.href, {
				title: document.title,
				originalContent: originalContent,
				enhancedContent: combinedContent,
				timestamp: Date.now(),
				isChunked: true,
				chunkCount: allChunks.length,
			});
			isCachedContent = true;
		} catch (error) {
			debugError("Failed to save chunked state:", error);
		}
	}

	/**
	 * Handle cancellation of enhancement process
	 */
	function handleCancelEnhancement() {
		debugLog("Cancelling enhancement process...");

		// Send cancel message to background
		browser.runtime
			.sendMessage({ action: "cancelEnhancement" })
			.catch(debugerror);

		// Restore original content
		const contentArea = findContentArea();
		if (contentArea) {
			const originalContent =
				contentArea.getAttribute("data-original-html") ||
				contentArea.getAttribute("data-original-content");
			if (originalContent) {
				contentArea.innerHTML = originalContent;
				showStatusMessage(
					"Enhancement cancelled. Original content restored.",
					"info"
				);
			}
		}

		// Reset button state
		const button = document.querySelector(".gemini-enhance-btn");
		if (button) {
			button.textContent = "✨ Enhance with Gemini";
			button.disabled = false;
			button.classList.remove("loading");
		}
	}

	/**
	 * Handle re-enhancement of a specific chunk
	 * @param {number} chunkIndex - The index of the chunk to re-enhance
	 */
	async function handleReenhanceChunk(chunkIndex) {
		debugLog(`Re-enhancing chunk ${chunkIndex}...`);

		const banner = document.querySelector(`.chunk-banner-${chunkIndex}`);
		if (banner) {
			// Update banner to processing state
			banner.setAttribute("data-chunk-status", "processing");
			const statusSpan = banner.querySelector("span:nth-child(2)");
			if (statusSpan) {
				const parent = statusSpan.parentElement;
				const iconSpan = parent.querySelector("span:first-child");
				if (iconSpan) iconSpan.textContent = "⏳";
				const statusBadge = parent.querySelector("span:nth-child(3)");
				if (statusBadge) statusBadge.textContent = "Processing...";
			}
			const btn = banner.querySelector(".gemini-chunk-reenhance-btn");
			if (btn) btn.style.display = "none";
		}

		// Get the original content for this chunk
		const chunkContent = document.querySelector(
			`.gemini-chunk-content[data-chunk-index="${chunkIndex}"]`
		);
		const originalContent = chunkContent?.getAttribute(
			"data-original-chunk-content"
		);

		if (!originalContent) {
			debugError("No original content found for chunk", chunkIndex);
			showStatusMessage(
				`Cannot re-enhance chunk ${
					chunkIndex + 1
				}: Original content not found`,
				"error"
			);
			return;
		}

		try {
			// Wake up background worker
			await wakeUpBackgroundWorker();

			// Get settings
			const settings = await browser.storage.local.get([
				"useEmoji",
				"formatGameStats",
				"centerSceneHeadings",
			]);
			const useEmoji = settings.useEmoji === true;
			formattingOptions.useEmoji = useEmoji;
			formattingOptions.formatGameStats =
				settings.formatGameStats !== false;
			formattingOptions.centerSceneHeadings =
				settings.centerSceneHeadings !== false;

			// Get prompts
			let combinedPrompt = currentHandler
				? currentHandler.getSiteSpecificPrompt()
				: "";

			// Send single chunk for processing
			const response = await sendMessageWithRetry({
				action: "reenhanceChunk",
				chunkIndex: chunkIndex,
				content: originalContent,
				title: document.title,
				siteSpecificPrompt: combinedPrompt,
				useEmoji: useEmoji,
			});

			if (response && response.success && response.result) {
				// Update the chunk content
				if (chunkContent) {
					const sanitizedContent = sanitizeHTML(
						response.result.enhancedContent
					);
					chunkContent.innerHTML = sanitizedContent;
					chunkContent.setAttribute("data-chunk-enhanced", "true");
				}

				// Update banner to completed
				updateChunkBannerStatus(chunkIndex, "completed");
				showStatusMessage(
					`Chunk ${chunkIndex + 1} re-enhanced successfully!`,
					"success"
				);

				// Check if all chunks are now complete and save to cache
				await checkAndSaveAllChunks();
			} else {
				const errorMsg = response?.error || "Unknown error";
				updateChunkBannerStatus(chunkIndex, "error", errorMsg);
				showStatusMessage(
					`Failed to re-enhance chunk ${chunkIndex + 1}: ${errorMsg}`,
					"error"
				);
			}
		} catch (error) {
			debugError("Error re-enhancing chunk:", error);
			updateChunkBannerStatus(chunkIndex, "error", error.message);
			showStatusMessage(
				`Error re-enhancing chunk ${chunkIndex + 1}: ${error.message}`,
				"error"
			);
		}
	}

	/**
	 * Update a chunk banner's status
	 * @param {number} chunkIndex - The chunk index
	 * @param {string} status - New status
	 * @param {string} errorMessage - Error message if applicable
	 */
	function updateChunkBannerStatus(chunkIndex, status, errorMessage = null) {
		const existingBanner = document.querySelector(
			`.chunk-banner-${chunkIndex}`
		);
		if (existingBanner) {
			const contentArea = findContentArea();
			const totalChunks = parseInt(
				existingBanner
					.closest("[data-total-chunks]")
					?.getAttribute("data-total-chunks") ||
					document.querySelectorAll(".gemini-chunk-banner").length
			);
			const newBanner = createChunkBanner(
				chunkIndex,
				totalChunks,
				status,
				errorMessage
			);
			existingBanner.replaceWith(newBanner);
		}
	}

	/**
	 * Check if all chunks are completed and save combined content to cache
	 */
	async function checkAndSaveAllChunks() {
		const allBanners = document.querySelectorAll(".gemini-chunk-banner");
		const allCompleted = Array.from(allBanners).every(
			(b) => b.getAttribute("data-chunk-status") === "completed"
		);

		if (allCompleted) {
			const button = document.querySelector(".gemini-enhance-btn");
			if (button) {
				button.textContent = "🔄 Re-enhance with Gemini";
				button.disabled = false;
				button.classList.remove("loading");
			}
		}

		if (allCompleted && storageManager) {
			debugLog(
				"All chunks completed, saving combined content to cache..."
			);

			// Collect all enhanced content
			const chunkContents = Array.from(
				document.querySelectorAll(".gemini-chunk-content")
			)
				.sort(
					(a, b) =>
						parseInt(a.getAttribute("data-chunk-index")) -
						parseInt(b.getAttribute("data-chunk-index"))
				)
				.map((c) => c.innerHTML);

			const combinedEnhancedContent = chunkContents.join("\n\n");
			const originalContent =
				findContentArea()?.getAttribute("data-original-html") || "";

			try {
				await storageManager.saveEnhancedContent(window.location.href, {
					title: document.title,
					originalContent: originalContent,
					enhancedContent: combinedEnhancedContent,
					timestamp: Date.now(),
					isChunked: true,
					chunkCount: allBanners.length,
				});
				isCachedContent = true;
				debugLog("Combined chunked content saved to cache");
				showStatusMessage(
					"Enhanced content saved to cache!",
					"success",
					3000
				);
			} catch (saveError) {
				debugError("Failed to save combined content:", saveError);
			}
		}
	}

	// Simple HTML escape for inserting original text chunks safely
	function escapeHtml(str) {
		if (!str) return "";
		return String(str)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	/**
	 * Format original chunk content for display
	 * Converts plain text to readable HTML paragraphs
	 * @param {string} content - The plain text chunk content
	 * @returns {string} HTML formatted content
	 */
	function formatOriginalChunkContent(content) {
		if (!content)
			return '<p style="color: #999; font-style: italic;">No content available</p>';

		// Split by double newlines for paragraphs, escape HTML
		const paragraphs = content
			.split(/\n\n+/)
			.map((p) => p.trim())
			.filter((p) => p.length > 0)
			.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
			.join("\n");

		return paragraphs || `<p>${escapeHtml(content)}</p>`;
	}

	// Normalize chunk parts by merging tiny leading/trailing pieces into neighbors
	function normalizeChunkParts(parts, minChunkLength = 200) {
		const cleanedParts = (parts || [])
			.map((p) => (typeof p === "string" ? p.trim() : ""))
			.filter((p) => p.length > 0);

		for (let i = 0; i < cleanedParts.length; i++) {
			const chunk = cleanedParts[i];
			if (chunk.length < minChunkLength && cleanedParts[i + 1]) {
				cleanedParts[i + 1] = `${chunk} ${cleanedParts[i + 1]}`.trim();
				cleanedParts.splice(i, 1);
				i -= 1;
			}
		}

		if (
			cleanedParts.length > 1 &&
			cleanedParts[cleanedParts.length - 1].length < minChunkLength
		) {
			cleanedParts[cleanedParts.length - 2] = `${
				cleanedParts[cleanedParts.length - 2]
			} ${cleanedParts.pop()}`.trim();
		}

		return cleanedParts;
	}

	/**
	 * Split HTML content into chunks that correspond to text chunks
	 * Preserves the original HTML structure (p tags, divs, etc.)
	 * @param {HTMLElement} contentArea - The content area element
	 * @param {string[]} textChunks - Array of plain text chunks
	 * @returns {string[]} Array of HTML chunks corresponding to text chunks
	 */
	function splitHTMLIntoChunks(contentArea, textChunks) {
		if (!contentArea || !textChunks || textChunks.length === 0) {
			return [];
		}

		// Get all paragraph-level elements (p, div with text, br-separated text blocks)
		const childElements = Array.from(contentArea.children);
		const htmlChunks = [];

		// If there are no child elements or only one chunk needed, return original HTML
		if (childElements.length === 0 || textChunks.length <= 1) {
			return [contentArea.innerHTML];
		}

		// Calculate character length for each text chunk (NOT cumulative)
		const chunkSizes = textChunks.map((chunk) => chunk.length);
		const totalTextLength = chunkSizes.reduce((sum, len) => sum + len, 0);

		debugLog(
			`[splitHTMLIntoChunks] Total text: ${totalTextLength} chars, ${textChunks.length} chunks`
		);
		debugLog(`[splitHTMLIntoChunks] Chunk sizes: ${chunkSizes.join(", ")}`);

		// Calculate total HTML text length
		let totalHtmlTextLength = 0;
		const elementTextLengths = [];
		for (const el of childElements) {
			const elTextLen = el.textContent.trim().replace(/\s+/g, " ").length;
			elementTextLengths.push(elTextLen);
			totalHtmlTextLength += elTextLen;
		}

		debugLog(
			`[splitHTMLIntoChunks] HTML has ${childElements.length} elements, ${totalHtmlTextLength} chars of text`
		);

		// Calculate the target size for each HTML chunk based on proportion of text chunks
		// Scale factor accounts for any difference between HTML text and plain text lengths
		const scaleFactor = totalHtmlTextLength / totalTextLength;
		const targetHtmlChunkSizes = chunkSizes.map((size) =>
			Math.round(size * scaleFactor)
		);

		debugLog(
			`[splitHTMLIntoChunks] Target HTML chunk sizes: ${targetHtmlChunkSizes.join(
				", "
			)}`
		);

		// Build HTML chunks by distributing elements according to target sizes
		let currentChunkElements = [];
		let currentChunkTextLen = 0;
		let targetChunkIndex = 0;
		let elementIndex = 0;

		while (
			elementIndex < childElements.length &&
			targetChunkIndex < textChunks.length
		) {
			const el = childElements[elementIndex];
			const elTextLen = elementTextLengths[elementIndex];
			const targetSize = targetHtmlChunkSizes[targetChunkIndex];
			const isLastChunk = targetChunkIndex === textChunks.length - 1;

			// For the last chunk, just add all remaining elements
			if (isLastChunk) {
				currentChunkElements.push(el);
				currentChunkTextLen += elTextLen;
				elementIndex++;
				continue;
			}

			// Check if adding this element would exceed the target size significantly
			const wouldExceed = currentChunkTextLen + elTextLen > targetSize;
			const hasMinContent = currentChunkTextLen > 0;

			if (wouldExceed && hasMinContent) {
				// Finalize current chunk WITHOUT adding this element
				const chunkDiv = document.createElement("div");
				currentChunkElements.forEach((elem) => {
					chunkDiv.appendChild(elem.cloneNode(true));
				});
				htmlChunks.push(chunkDiv.innerHTML);

				debugLog(
					`[splitHTMLIntoChunks] Created chunk ${htmlChunks.length}: ${currentChunkElements.length} elements, ${currentChunkTextLen} chars (target: ${targetSize})`
				);

				// Reset for next chunk - DON'T increment elementIndex, process this element in next chunk
				currentChunkElements = [];
				currentChunkTextLen = 0;
				targetChunkIndex++;
			} else {
				// Add element to current chunk
				currentChunkElements.push(el);
				currentChunkTextLen += elTextLen;
				elementIndex++;
			}
		}

		// Add remaining elements as the last chunk
		if (currentChunkElements.length > 0) {
			// Also add any remaining elements we haven't processed
			while (elementIndex < childElements.length) {
				currentChunkElements.push(childElements[elementIndex]);
				currentChunkTextLen += elementTextLengths[elementIndex];
				elementIndex++;
			}

			const chunkDiv = document.createElement("div");
			currentChunkElements.forEach((elem) => {
				chunkDiv.appendChild(elem.cloneNode(true));
			});
			htmlChunks.push(chunkDiv.innerHTML);

			debugLog(
				`[splitHTMLIntoChunks] Created final chunk ${htmlChunks.length}: ${currentChunkElements.length} elements, ${currentChunkTextLen} chars`
			);
		}

		// Ensure we have the right number of chunks
		// If we have fewer HTML chunks than text chunks, pad with formatted text
		while (htmlChunks.length < textChunks.length) {
			const missingIndex = htmlChunks.length;
			debugLog(
				`[splitHTMLIntoChunks] Padding missing chunk ${
					missingIndex + 1
				} with formatted text`
			);
			htmlChunks.push(
				formatOriginalChunkContent(textChunks[missingIndex])
			);
		}

		debugLog(
			`[splitHTMLIntoChunks] Created ${htmlChunks.length} HTML chunks from ${childElements.length} child elements`
		);

		return htmlChunks;
	}

	// Function to create an error disclaimer banner
	function createErrorDisclaimerBanner(error, hasPartialContent = false) {
		const banner = document.createElement("div");
		banner.className = "gemini-error-banner";
		banner.style.cssText = `
        margin: 15px 0;
        padding: 15px;
        background-color: #feeced;
        border-radius: 8px;
        border: 1px solid #f5c2c7;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    `;

		// Support dark mode
		if (
			document.querySelector(
				'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth'
			) ||
			window.matchMedia("(prefers-color-scheme: dark)").matches
		) {
			banner.style.backgroundColor = "#3a2c2d";
			banner.style.borderColor = "#5a3f3f";
			banner.style.color = "#e0e0e0";
		}

		// Create different message depending on if we have partial content
		const messageText = hasPartialContent
			? "An error occurred during processing, but some content was successfully enhanced. The original content was preserved for the sections that couldn't be processed."
			: "An error occurred during processing. The content below is the original text.";

		const iconClass = hasPartialContent ? "⚠️" : "❌";
		const bannerTitle = hasPartialContent
			? "Partial Content Available"
			: "Processing Error";

		banner.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 18px; margin-right: 10px;">${iconClass}</span>
            <span style="font-weight: bold; font-size: 16px;">${bannerTitle}</span>
        </div>
        <div style="font-size: 14px; margin-bottom: 8px;">
            ${messageText}
        </div>
        <div style="font-size: 13px; color: #842029; background: rgba(220, 53, 69, 0.1); padding: 8px; border-radius: 4px;">
            Error details: ${error}
        </div>
    `;

		return banner;
	}

	// Function to update the work-in-progress banner with real-time progress
	function updateWorkInProgressBanner(
		currentChunk,
		totalChunks,
		progressPercent = null
	) {
		let banner = document.querySelector(".gemini-wip-banner");

		if (!progressPercent) {
			progressPercent = Math.round((currentChunk / totalChunks) * 100);
		}

		if (banner) {
			// Update existing banner
			const progressBar = banner.querySelector(
				"div > div:nth-child(2) > div"
			);
			if (progressBar) {
				progressBar.style.width = `${progressPercent}%`;
			}

			const statusText = banner.querySelector("div:nth-child(3)");
			if (statusText) {
				statusText.textContent = `Processing chunk ${currentChunk} of ${totalChunks} (${progressPercent}% complete). Please wait while the content is being enhanced...`;
			}
		} else {
			if (contentArea && contentArea.firstChild) {
				// Remove any existing enhanced banner before inserting a new one
				const existingBanner = contentArea.querySelector(
					".gemini-enhanced-banner"
				);
				if (existingBanner) {
					existingBanner.remove();
				}
				contentArea.insertBefore(banner, contentArea.firstChild);
			}
		}

		return banner;
	}

	// Function to remove the original word count element
	function removeOriginalWordCount() {
		const originalWordCount = document.querySelector(".gemini-word-count");
		if (originalWordCount) {
			debugLog("Removing original word count display");
			originalWordCount.parentNode.removeChild(originalWordCount);
		}
	}

	// Handler for processed chunks from the background script
	function handleChunkProcessed(message) {
		debugLog(
			`Received processed chunk ${message.chunkIndex + 1}/${
				message.totalChunks
			}`
		);
		const contentArea = findContentArea();
		if (!contentArea) {
			debugError(
				"Unable to find content area for displaying processed chunk"
			);
			return;
		}

		const chunkIndex = message.chunkIndex;
		const totalChunks = message.totalChunks;
		const chunkResult = message.result;

		// Try to find the new inline chunk structure first
		const chunkedContainer = document.getElementById(
			"gemini-chunked-content"
		);

		if (chunkedContainer) {
			// New inline replacement system
			const chunkWrapper = chunkedContainer.querySelector(
				`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`
			);

			if (chunkWrapper && chunkResult && chunkResult.enhancedContent) {
				// Update the banner to completed status
				const existingBanner = chunkWrapper.querySelector(
					".gemini-chunk-banner"
				);
				if (existingBanner) {
					const newBanner = createChunkBanner(
						chunkIndex,
						totalChunks,
						"completed"
					);
					existingBanner.replaceWith(newBanner);
				}

				// Replace the chunk content with enhanced version
				const chunkContent = chunkWrapper.querySelector(
					".gemini-chunk-content"
				);
				if (chunkContent) {
					const sanitizedContent = sanitizeHTML(
						chunkResult.enhancedContent
					);
					chunkContent.innerHTML = sanitizedContent;
					chunkContent.setAttribute("data-chunk-enhanced", "true");
				}

				debugLog(
					`Chunk ${
						chunkIndex + 1
					} replaced inline with enhanced content`
				);
			}

			// Update next chunk banner to "processing" if there's more
			if (chunkIndex + 1 < totalChunks) {
				const nextWrapper = chunkedContainer.querySelector(
					`.gemini-chunk-wrapper[data-chunk-index="${
						chunkIndex + 1
					}"]`
				);
				if (nextWrapper) {
					const nextBanner = nextWrapper.querySelector(
						".gemini-chunk-banner"
					);
					if (
						nextBanner &&
						nextBanner.getAttribute("data-chunk-status") ===
							"pending"
					) {
						const processingBanner = createChunkBanner(
							chunkIndex + 1,
							totalChunks,
							"processing"
						);
						nextBanner.replaceWith(processingBanner);
					}
				}
			}

			// If all chunks are processed, finalize
			if (message.isComplete) {
				finalizeChunkedContent(chunkResult.modelInfo);
			}

			return;
		}

		// Fallback to old progressive system for backwards compatibility
		const enhancedContainer = document.getElementById(
			"gemini-enhanced-container"
		);
		let wipBanner = document.querySelector(".gemini-wip-banner");

		// If neither new nor old container exists, create fallback structure
		if (!enhancedContainer) {
			let progressiveContentContainer = document.getElementById(
				"gemini-progressive-content"
			);
			if (!progressiveContentContainer) {
				const originalContent = contentArea.innerHTML;
				contentArea.setAttribute(
					"data-original-content",
					originalContent
				);
				progressiveContentContainer = document.createElement("div");
				progressiveContentContainer.id = "gemini-progressive-content";
				if (currentFontSize && currentFontSize !== 100) {
					progressiveContentContainer.style.fontSize = `${currentFontSize}%`;
				}
				contentArea.innerHTML = "";
				contentArea.appendChild(progressiveContentContainer);
				const banner = createWorkInProgressBanner(
					chunkIndex + 1,
					totalChunks
				);
				contentArea.insertBefore(banner, progressiveContentContainer);
				wipBanner = banner;
			}

			if (chunkResult && chunkResult.enhancedContent) {
				const sanitizedContent = sanitizeHTML(
					chunkResult.enhancedContent
				);
				const chunkContainer = document.createElement("div");
				chunkContainer.className = "gemini-chunk";
				chunkContainer.setAttribute("data-chunk-index", chunkIndex);
				chunkContainer.innerHTML = sanitizedContent;
				progressiveContentContainer.appendChild(chunkContainer);

				if (message.isComplete) {
					const existingWip =
						document.querySelector(".gemini-wip-banner");
					if (existingWip) existingWip.remove();
					finalizePrefixEnhancedContent(chunkResult.modelInfo);
				}
			}
			return;
		}

		// Old progressive flow with enhanced container
		if (chunkResult && chunkResult.enhancedContent) {
			const sanitizedContent = sanitizeHTML(chunkResult.enhancedContent);

			const enhancedChunk = document.createElement("div");
			enhancedChunk.className = "gemini-chunk";
			enhancedChunk.setAttribute("data-chunk-index", chunkIndex);

			// Add chunk divider banner if not the first chunk
			if (chunkIndex > 0) {
				const divider = document.createElement("div");
				divider.className = "gemini-chunk-divider";
				divider.style.cssText = `
					margin: 2em 0;
					padding: 0.8em;
					background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
					color: white;
					font-weight: 600;
					text-align: center;
					border-radius: 8px;
					font-size: 0.9em;
					box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
				`;
				divider.innerHTML = `✨ Chunk ${
					chunkIndex + 1
				} of ${totalChunks} ✨`;
				enhancedChunk.appendChild(divider);
			}

			const contentDiv = document.createElement("div");
			contentDiv.innerHTML = sanitizedContent;
			enhancedChunk.appendChild(contentDiv);

			enhancedContainer.appendChild(enhancedChunk);

			wipBanner = document.querySelector(".gemini-wip-banner");
			if (wipBanner) {
				const progressText = wipBanner.querySelector(".progress-text");
				if (progressText) {
					progressText.textContent = `Processing chunk ${
						chunkIndex + 2
					} of ${totalChunks}...`;
				}
			}

			if (message.isComplete) {
				const wip = document.querySelector(".gemini-wip-banner");
				if (wip) wip.remove();
				finalizePrefixEnhancedContent(chunkResult.modelInfo);
			} else {
				updateWorkInProgressBanner(
					chunkIndex + 1,
					totalChunks,
					message.progressPercent
				);
			}
		}
	}

	/**
	 * Add model attribution to the content area
	 * @param {Object} modelInfo - Information about the model used
	 */
	function addModelAttribution(modelInfo) {
		if (!modelInfo) return;

		const contentArea = findContentArea();
		if (!contentArea) return;

		// Check if attribution already exists
		if (document.querySelector(".gemini-model-attribution")) return;

		const isDarkMode =
			document.querySelector(
				'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth'
			) || window.matchMedia("(prefers-color-scheme: dark)").matches;

		const attribution = document.createElement("div");
		attribution.className = "gemini-model-attribution";
		attribution.style.cssText = `
			margin: 1.5em 0;
			padding: 8px 12px;
			background: ${isDarkMode ? "#2a2a2a" : "#f5f5f5"};
			border-radius: 6px;
			font-size: 12px;
			color: ${isDarkMode ? "#999" : "#666"};
			text-align: center;
		`;

		const modelName = modelInfo.name || modelInfo.modelId || "Gemini AI";
		attribution.innerHTML = `
			<span style="opacity: 0.7;">Enhanced by</span>
			<span style="font-weight: 600;">${escapeHtml(modelName)}</span>
			<span style="opacity: 0.7;">via Ranobe Gemini</span>
		`;

		contentArea.appendChild(attribution);
	}

	/**
	 * Create a main summary banner for completed chunked enhancement
	 * Shows overall word count comparison and global controls
	 * @param {Object} modelInfo - Information about the model used
	 * @param {number} totalChunks - Total number of chunks
	 * @param {number} completedChunks - Number of successfully enhanced chunks
	 * @returns {HTMLElement} The main summary banner
	 */
	function createMainSummaryBanner(modelInfo, totalChunks, completedChunks) {
		const contentArea = findContentArea();
		const originalText =
			contentArea?.getAttribute("data-original-text") || "";

		// Calculate total enhanced word count from all chunks
		let totalEnhancedWords = 0;
		const allChunkContents = document.querySelectorAll(
			".gemini-chunk-content"
		);
		allChunkContents.forEach((chunk) => {
			const enhancedContent =
				chunk.getAttribute("data-enhanced-chunk-content") ||
				chunk.innerHTML;
			totalEnhancedWords += countWords(enhancedContent);
		});

		const originalWordCount = countWords(originalText);
		const wordDifference = totalEnhancedWords - originalWordCount;
		const percentChange =
			originalWordCount > 0
				? Math.round((wordDifference / originalWordCount) * 100)
				: 0;
		const changeSymbol = wordDifference >= 0 ? "+" : "-";

		const modelName = modelInfo?.name || "AI";
		const modelProvider = modelInfo?.provider || "Ranobe Gemini";
		const modelDisplay = `Enhanced with ${modelProvider}${
			modelName !== "AI" ? ` (${modelName})` : ""
		}`;

		// Determine banner color based on completion status
		const allSuccess = completedChunks === totalChunks;
		const statusEmoji = allSuccess ? "✨" : "⚠️";
		const statusText = allSuccess
			? `All ${totalChunks} chunks enhanced`
			: `${completedChunks}/${totalChunks} chunks enhanced`;

		const banner = document.createElement("div");
		banner.className = "gemini-main-summary-banner";
		banner.id = "gemini-main-summary-banner";

		// Check dark mode
		const isDarkMode =
			document.querySelector(
				'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth'
			) || window.matchMedia("(prefers-color-scheme: dark)").matches;

		const bgColor = isDarkMode ? "#2a2a3c" : "#f0f8ff";
		const borderColor = isDarkMode ? "#4a4a5c" : "#a8d4f0";
		const textColor = isDarkMode ? "#e0e0e0" : "#333";
		const subtleColor = isDarkMode ? "#aaa" : "#666";

		banner.style.cssText = `
			margin: 15px 0;
			padding: 15px 18px;
			background: ${bgColor};
			border-radius: 10px;
			border: 2px solid ${borderColor};
			box-shadow: 0 3px 10px rgba(0,0,0,0.1);
		`;

		banner.innerHTML = `
			<div style="display: flex; flex-direction: column; gap: 12px;">
				<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
					<div style="display: flex; align-items: center; gap: 10px;">
						<span style="font-size: 22px;">${statusEmoji}</span>
						<div>
							<div style="font-weight: bold; font-size: 16px; color: ${textColor};">${modelDisplay}</div>
							<div style="font-size: 12px; color: ${subtleColor};">${statusText}</div>
						</div>
					</div>
					<div style="display: flex; align-items: center; gap: 8px;">
						<button class="gemini-main-toggle-btn" data-showing="enhanced" style="
							padding: 6px 12px;
							background: #4285f4;
							color: white;
							border: none;
							border-radius: 6px;
							cursor: pointer;
							font-size: 12px;
							font-weight: 600;
						">📄 Show All Original</button>
						<button class="gemini-main-delete-btn" title="Delete all cached enhanced content" style="
							padding: 6px 12px;
							background: #d32f2f;
							color: white;
							border: none;
							border-radius: 6px;
							cursor: pointer;
							font-size: 12px;
							font-weight: 600;
						">🗑️ Delete Cache</button>
					</div>
				</div>
				<div style="padding-top: 10px; border-top: 1px solid ${
					isDarkMode ? "#444" : "#ddd"
				};">
					<div style="font-size: 14px; color: ${textColor}; font-family: monospace;">
						Total Words: ${originalWordCount.toLocaleString()} → ${totalEnhancedWords.toLocaleString()}
						<span style="color: ${
							wordDifference >= 0 ? "#28a745" : "#dc3545"
						}; font-weight: bold; margin-left: 8px;">
							(${changeSymbol}${Math.abs(
			wordDifference
		).toLocaleString()}, ${changeSymbol}${Math.abs(percentChange)}%)
						</span>
					</div>
				</div>
			</div>
		`;

		// Add toggle all button handler
		const toggleAllBtn = banner.querySelector(".gemini-main-toggle-btn");
		if (toggleAllBtn) {
			toggleAllBtn.addEventListener("click", (e) => {
				e.preventDefault();
				handleToggleAllChunks();
			});
		}

		// Add delete all button handler
		const deleteAllBtn = banner.querySelector(".gemini-main-delete-btn");
		if (deleteAllBtn) {
			deleteAllBtn.addEventListener("click", async (e) => {
				e.preventDefault();
				if (
					confirm(
						"Are you sure you want to delete all cached enhanced content for this chapter?"
					)
				) {
					await handleDeleteAllChunks();
				}
			});
		}

		return banner;
	}

	/**
	 * Toggle all chunks between original and enhanced
	 */
	function handleToggleAllChunks() {
		const mainBanner = document.getElementById(
			"gemini-main-summary-banner"
		);
		const toggleBtn = mainBanner?.querySelector(".gemini-main-toggle-btn");
		if (!toggleBtn) return;

		const isShowingEnhanced =
			toggleBtn.getAttribute("data-showing") === "enhanced";
		const allChunkContents = document.querySelectorAll(
			".gemini-chunk-content"
		);
		const allChunkToggleBtns = document.querySelectorAll(
			".gemini-chunk-toggle-btn"
		);

		allChunkContents.forEach((chunkContent, idx) => {
			if (chunkContent.getAttribute("data-chunk-enhanced") !== "true")
				return;

			const originalHtml = chunkContent.getAttribute(
				"data-original-chunk-html"
			);
			const originalContent = chunkContent.getAttribute(
				"data-original-chunk-content"
			);
			const enhancedContent =
				chunkContent.getAttribute("data-enhanced-chunk-content") ||
				chunkContent.innerHTML;

			if (isShowingEnhanced) {
				// Switch all to original
				chunkContent.setAttribute(
					"data-enhanced-chunk-content",
					chunkContent.innerHTML
				);
				if (originalHtml) {
					chunkContent.innerHTML = `<div class="gemini-original-chunk">${originalHtml}</div>`;
				} else {
					chunkContent.innerHTML = `<div class="gemini-original-chunk">${formatOriginalChunkContent(
						originalContent
					)}</div>`;
				}
			} else {
				// Switch all to enhanced
				const savedEnhanced = chunkContent.getAttribute(
					"data-enhanced-chunk-content"
				);
				if (savedEnhanced) {
					chunkContent.innerHTML = savedEnhanced;
				}
			}
		});

		// Update all individual toggle buttons
		allChunkToggleBtns.forEach((btn) => {
			if (isShowingEnhanced) {
				btn.textContent = "✨ Enhanced";
				btn.setAttribute("data-showing", "original");
			} else {
				btn.textContent = "📄 Original";
				btn.setAttribute("data-showing", "enhanced");
			}
		});

		// Update main toggle button
		if (isShowingEnhanced) {
			toggleBtn.textContent = "✨ Show All Enhanced";
			toggleBtn.setAttribute("data-showing", "original");
		} else {
			toggleBtn.textContent = "📄 Show All Original";
			toggleBtn.setAttribute("data-showing", "enhanced");
		}
	}

	/**
	 * Delete all cached chunk data and revert to original
	 */
	async function handleDeleteAllChunks() {
		const contentArea = findContentArea();
		if (!contentArea) return;

		const originalHtml = contentArea.getAttribute("data-original-html");
		if (originalHtml) {
			contentArea.innerHTML = originalHtml;
			contentArea.removeAttribute("data-original-html");
			contentArea.removeAttribute("data-original-text");
			contentArea.removeAttribute("data-total-chunks");
		}

		// Clear from storage
		if (storageManager) {
			await storageManager.removeEnhancedContent(window.location.href);
		}

		isCachedContent = false;
		showStatusMessage(
			"All enhanced content deleted. Reverted to original.",
			"info",
			3000
		);

		// Reset enhance button
		const button = document.querySelector(".gemini-enhance-btn");
		if (button) {
			button.textContent = "✨ Enhance with Gemini";
			button.disabled = false;
		}
	}

	/**
	 * Finalize chunked content processing - remove pending banners, save to cache, add summary banner
	 * @param {Object} modelInfo - Information about the model used
	 */
	async function finalizeChunkedContent(modelInfo) {
		debugLog("Finalizing chunked content...");

		// Remove any remaining "pending" or "processing" states
		const allBanners = document.querySelectorAll(".gemini-chunk-banner");
		const totalChunks = allBanners.length;
		let completedChunks = 0;

		allBanners.forEach((banner, idx) => {
			const status = banner.getAttribute("data-chunk-status");
			if (status === "completed") {
				completedChunks++;
			} else if (status !== "error") {
				// Check if the corresponding content was actually enhanced
				const wrapper = banner.closest(".gemini-chunk-wrapper");
				const content = wrapper?.querySelector(".gemini-chunk-content");
				if (
					content &&
					content.getAttribute("data-chunk-enhanced") === "true"
				) {
					const newBanner = createChunkBanner(
						idx,
						totalChunks,
						"completed"
					);
					banner.replaceWith(newBanner);
					completedChunks++;
				}
			}
		});

		// Show completion message
		const successMsg =
			completedChunks === totalChunks
				? "✅ All chunks enhanced successfully!"
				: `⚠️ Enhancement complete: ${completedChunks}/${totalChunks} chunks successful`;
		showStatusMessage(
			successMsg,
			completedChunks === totalChunks ? "success" : "warning",
			5000
		);

		// Add model attribution if available (at the end)
		if (modelInfo) {
			addModelAttribution(modelInfo);
		}

		// Reset button state
		const button = document.querySelector(".gemini-enhance-btn");
		if (button) {
			button.textContent = "🔄 Re-enhance with Gemini";
			button.disabled = false;
			button.classList.remove("loading");
		}

		// Save combined content to cache
		await checkAndSaveAllChunks();
	}

	// Handler for chunk processing errors
	function handleChunkError(message) {
		debugLog(
			`Error processing chunk ${message.chunkIndex + 1}/${
				message.totalChunks
			}:`,
			message.error
		);

		const contentArea = findContentArea();
		if (!contentArea) {
			debugError("Unable to find content area for displaying error");
			return;
		}

		const chunkIndex = message.chunkIndex;
		const totalChunks = message.totalChunks;

		// Try new inline chunk system first
		const chunkedContainer = document.getElementById(
			"gemini-chunked-content"
		);
		if (chunkedContainer) {
			// Update the specific chunk banner to error state with re-enhance button
			const chunkWrapper = chunkedContainer.querySelector(
				`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`
			);

			if (chunkWrapper) {
				const existingBanner = chunkWrapper.querySelector(
					".gemini-chunk-banner"
				);
				if (existingBanner) {
					const errorBanner = createChunkBanner(
						chunkIndex,
						totalChunks,
						"error",
						message.error
					);
					existingBanner.replaceWith(errorBanner);
				}

				// Keep the original content visible - don't replace it
				debugLog(
					`Chunk ${
						chunkIndex + 1
					} marked as error - original content preserved`
				);
			}

			// If this is a rate limit, show status message
			if (message.isRateLimit) {
				let waitTimeSeconds = 60;
				if (message.waitTime) {
					waitTimeSeconds = Math.ceil(message.waitTime / 1000);
				}
				showStatusMessage(
					`Rate limit reached on chunk ${
						chunkIndex + 1
					}. Waiting ${waitTimeSeconds} seconds before continuing...`,
					"warning"
				);
			} else {
				showStatusMessage(
					`Error processing chunk ${chunkIndex + 1}: ${
						message.error
					}`,
					"error"
				);
			}

			// If all chunks are done (including this error), update button
			if (message.isComplete) {
				const button = document.querySelector(".gemini-enhance-btn");
				if (button) {
					button.textContent = "🔄 Re-enhance with Gemini";
					button.disabled = false;
					button.classList.remove("loading");
				}
			}
			// If background reported a final failure, still re-enable controls
			if (message.finalFailure && !message.isComplete) {
				const button = document.querySelector(".gemini-enhance-btn");
				if (button) {
					button.textContent = "🔄 Re-enhance with Gemini";
					button.disabled = false;
					button.classList.remove("loading");
				}
				showStatusMessage(
					"Enhancement stopped after an error. You can retry individual chunks.",
					"warning",
					5000
				);
			}

			return;
		}

		// Fallback to old system
		const enhancedContainer = document.getElementById(
			"gemini-enhanced-container"
		);
		const hasPartialContent =
			enhancedContainer &&
			enhancedContainer.querySelector(".gemini-chunk");

		const wipBanner = document.querySelector(".gemini-wip-banner");
		if (wipBanner) {
			const errorBanner = createErrorDisclaimerBanner(
				message.error,
				hasPartialContent
			);
			wipBanner.replaceWith(errorBanner);
		} else {
			const errorBanner = createErrorDisclaimerBanner(
				message.error,
				hasPartialContent
			);
			contentArea.insertBefore(errorBanner, contentArea.firstChild);
		}

		// If it's a rate limit error, update the banner with waiting information and allow retry
		if (message.isRateLimit) {
			let waitTimeSeconds = 60;
			if (message.waitTime) {
				waitTimeSeconds = Math.ceil(message.waitTime / 1000);
			}

			showStatusMessage(
				`Rate limit reached. Waiting ${waitTimeSeconds} seconds before continuing...`,
				"warning"
			);

			if (hasPartialContent) {
				const errorBanner = document.querySelector(
					".gemini-error-banner"
				);
				if (errorBanner) {
					const retryButton = document.createElement("button");
					retryButton.textContent = "Retry Processing";
					retryButton.style.cssText = `
					margin-top: 10px;
					padding: 6px 12px;
					background: #4285f4;
					color: white;
					border: none;
					border-radius: 4px;
					cursor: pointer;
				`;
					retryButton.addEventListener("click", () => {
						const wipBanner = createWorkInProgressBanner(
							message.chunkIndex + 1,
							message.totalChunks
						);
						errorBanner.replaceWith(wipBanner);

						browser.runtime
							.sendMessage({
								action: "resumeProcessing",
								startChunkIndex: message.chunkIndex,
								totalChunks: message.totalChunks,
								remainingChunks:
									message.unprocessedChunks || [],
							})
							.catch((error) => {
								debugError(
									"Error requesting to resume processing:",
									error
								);
								showStatusMessage(
									"Failed to resume processing. Please try again later.",
									"error"
								);
							});
					});

					errorBanner.appendChild(retryButton);
				}
			}
		}
	}

	// Handler for all chunks processed notification
	function handleAllChunksProcessed(message) {
		debugLog(
			`All chunks processed: ${message.totalProcessed}/${message.totalChunks} successful`
		);

		const contentArea = findContentArea();
		if (!contentArea) {
			debugError("Unable to find content area for finalizing content");
			return;
		}

		// If there were failures, show an error banner
		if (message.failedChunks && message.failedChunks.length > 0) {
			const hasPartialContent = message.totalProcessed > 0;
			const errorMessage = `Failed to process ${message.failedChunks.length} out of ${message.totalChunks} chunks.`;

			// Remove any existing WIP banner
			const wipBanner = document.querySelector(".gemini-wip-banner");
			if (wipBanner) {
				const errorBanner = createErrorDisclaimerBanner(
					errorMessage,
					hasPartialContent
				);
				wipBanner.replaceWith(errorBanner);
			} else {
				// Create error banner if none exists
				const errorBanner = createErrorDisclaimerBanner(
					errorMessage,
					hasPartialContent
				);
				contentArea.insertBefore(errorBanner, contentArea.firstChild);
			}
		} else {
			// Everything processed successfully, finalize the content
			finalizePrefixEnhancedContent();
		}

		// Show status message with detailed information
		if (message.totalProcessed === message.totalChunks) {
			showStatusMessage(
				`Content successfully enhanced with Gemini! (${message.totalProcessed} chunks processed)`,
				"success"
			);
		} else {
			// Calculate percentage of successful chunks
			const successPercentage = Math.round(
				(message.totalProcessed / message.totalChunks) * 100
			);
			showStatusMessage(
				`Partially enhanced ${message.totalProcessed} of ${message.totalChunks} chunks (${successPercentage}% complete).`,
				"warning"
			);
		}

		// If we have a progressive content container, add a class to indicate completion
		const progressiveContainer = document.getElementById(
			"gemini-progressive-content"
		);
		if (progressiveContainer) {
			progressiveContainer.classList.add("gemini-processing-complete");
		}
	}

	// Helper function to finalize the progressive content display
	async function finalizePrefixEnhancedContent(modelInfo) {
		const contentArea = findContentArea();
		if (!contentArea) return;

		// Get the enhanced container (where chunks were added)
		const enhancedContainer = document.getElementById(
			"gemini-enhanced-container"
		);
		if (!enhancedContainer) {
			debugError("No enhanced container found for finalization");
			return;
		}

		// Get original content from stored attribute
		const originalContent =
			contentArea.getAttribute("data-original-html") ||
			contentArea.getAttribute("data-original-content") ||
			document.getElementById("gemini-original-content")?.innerHTML ||
			"";

		const originalText = stripHtmlTags(originalContent);
		const enhancedContent = enhancedContainer.innerHTML;
		const enhancedText = stripHtmlTags(enhancedContent);

		// Save to cache so it persists on reload (always overwrite with latest)
		if (storageManager && enhancedContent) {
			try {
				await storageManager.saveEnhancedContent(window.location.href, {
					title: document.title,
					originalContent: originalContent,
					enhancedContent: enhancedContent,
					modelInfo: modelInfo,
					timestamp: Date.now(),
					isChunked: true,
				});
				isCachedContent = true;
				debugLog("Chunked enhanced content saved to cache");
			} catch (saveError) {
				debugError(
					"Failed to save chunked content to cache:",
					saveError
				);
			}
		}

		// Add novel to library and update chapter progression
		try {
			const novelContext = extractNovelContext();
			await addToNovelLibrary(novelContext);
			await updateChapterProgression();
		} catch (libraryError) {
			debugError("Failed to update novel library:", libraryError);
		}

		// Create enhanced banner with word count statistics and model info
		const banner = createEnhancedBanner(
			originalText,
			enhancedText,
			modelInfo,
			isCachedContent
		);

		// Add delete button handler if present
		const deleteButton = banner.querySelector(".gemini-delete-cache-btn");
		if (deleteButton) {
			deleteButton.addEventListener("click", async () => {
				if (confirm("Delete cached enhanced content for this page?")) {
					if (storageManager) {
						await storageManager.removeEnhancedContent(
							window.location.href
						);
						isCachedContent = false;
						showStatusMessage(
							"Cached content deleted. Reloading page...",
							"info"
						);
						setTimeout(() => location.reload(), 1000);
					}
				}
			});
		}

		// Get the toggle button from the banner
		const toggleButton = banner.querySelector(".gemini-toggle-btn");
		if (toggleButton) {
			const toggleContent = function () {
				const isShowingEnhanced =
					contentArea.getAttribute("data-showing-enhanced") ===
					"true";
				let newBanner;
				if (isShowingEnhanced) {
					// Switch to original
					contentArea.innerHTML = originalContent;
					contentArea.setAttribute("data-showing-enhanced", "false");
					showStatusMessage(
						"Showing original content. Click 'Show Enhanced' to view the improved version."
					);
					// Re-create banner for original view
					newBanner = createEnhancedBanner(
						originalText,
						enhancedText,
						modelInfo,
						isCachedContent
					);
					const newToggleButton =
						newBanner.querySelector(".gemini-toggle-btn");
					if (newToggleButton) {
						newToggleButton.textContent = "Show Enhanced";
						newToggleButton.addEventListener(
							"click",
							toggleContent
						);
					}
					// Re-attach delete button handler
					const newDeleteButton = newBanner.querySelector(
						".gemini-delete-cache-btn"
					);
					if (newDeleteButton) {
						newDeleteButton.addEventListener("click", async () => {
							if (
								confirm(
									"Delete cached enhanced content for this page?"
								)
							) {
								if (storageManager) {
									await storageManager.removeEnhancedContent(
										window.location.href
									);
									isCachedContent = false;
									showStatusMessage(
										"Cached content deleted. Reloading page...",
										"info"
									);
									setTimeout(() => location.reload(), 1000);
								}
							}
						});
					}
					contentArea.insertBefore(newBanner, contentArea.firstChild);
				} else {
					// Switch back to enhanced
					contentArea.innerHTML = "";
					contentArea.appendChild(enhancedContainer);
					contentArea.setAttribute("data-showing-enhanced", "true");
					showStatusMessage(
						"Showing enhanced content. Click 'Show Original' to view the original version."
					);
					// Re-create banner for enhanced view
					newBanner = createEnhancedBanner(
						originalText,
						enhancedText,
						modelInfo,
						isCachedContent
					);
					const newToggleButton =
						newBanner.querySelector(".gemini-toggle-btn");
					if (newToggleButton) {
						newToggleButton.textContent = "Show Original";
						newToggleButton.addEventListener(
							"click",
							toggleContent
						);
					}
					// Re-attach delete button handler
					const newDeleteButton = newBanner.querySelector(
						".gemini-delete-cache-btn"
					);
					if (newDeleteButton) {
						newDeleteButton.addEventListener("click", async () => {
							if (
								confirm(
									"Delete cached enhanced content for this page?"
								)
							) {
								if (storageManager) {
									await storageManager.removeEnhancedContent(
										window.location.href
									);
									isCachedContent = false;
									showStatusMessage(
										"Cached content deleted. Reloading page...",
										"info"
									);
									setTimeout(() => location.reload(), 1000);
								}
							}
						});
					}
					contentArea.insertBefore(newBanner, enhancedContainer);
				}
			};
			toggleButton.addEventListener("click", toggleContent);
		}

		// Store state for toggling
		contentArea.setAttribute("data-showing-enhanced", "true");

		// Remove any existing enhanced banner before inserting a new one
		const existingBanner = contentArea.querySelector(
			".gemini-enhanced-banner"
		);
		if (existingBanner) {
			existingBanner.remove();
		}

		// Add banner to the top of content area
		contentArea.insertBefore(banner, enhancedContainer);
		// For chunked content, skip the main enhanced banner since each chunk has its own banner
		// Just clean up WIP/error banners and mark processing as complete

		// Store state for toggling (individual chunks handle their own toggle)
		contentArea.setAttribute("data-showing-enhanced", "true");

		// Remove any existing WIP banner
		const wipBanner = document.querySelector(".gemini-wip-banner");
		if (wipBanner) {
			wipBanner.remove();
		}

		// Remove any existing error banners since we're done
		const errorBanner = document.querySelector(".gemini-error-banner");
		if (errorBanner) {
			errorBanner.remove();
		}

		// Add a class to indicate processing is complete
		enhancedContainer.classList.add("gemini-processing-complete");
	}

	// Initialize when DOM is fully loaded
	window.addEventListener("DOMContentLoaded", initializeWithDeviceDetection);
	window.addEventListener("load", initializeWithDeviceDetection); // Backup init in case DOMContentLoaded was missed
	window.addEventListener("resize", handleResize); // Handle orientation changes

	// Handle window resize events to adjust UI for orientation changes
	function handleResize() {
		const wasMobile = isMobileDevice;
		isMobileDevice = detectMobileDevice();

		// If device type changed (e.g., tablet rotation), update UI
		if (wasMobile !== isMobileDevice) {
			adjustUIForDeviceType();
		}
	}

	// Initialize with device detection
	async function initializeWithDeviceDetection() {
		isMobileDevice = detectMobileDevice();
		debugLog(
			`Ranobe Gemini: Initializing for ${
				isMobileDevice ? "mobile" : "desktop"
			} device`
		);
		await initialize();
	}

	// Adjust UI based on device type
	function adjustUIForDeviceType() {
		const controlsContainer = document.getElementById("gemini-controls");
		const summaryDisplayLong = document.getElementById(
			"summary-display-long"
		);
		const summaryDisplayShort = document.getElementById(
			"summary-display-short"
		);

		if (!controlsContainer) return;

		if (isMobileDevice) {
			// Mobile-specific adjustments
			controlsContainer.classList.add("mobile-view");
			if (summaryDisplayLong)
				summaryDisplayLong.classList.add("mobile-view");
			if (summaryDisplayShort)
				summaryDisplayShort.classList.add("mobile-view");
		} else {
			// Desktop-specific adjustments
			controlsContainer.classList.remove("mobile-view");
			if (summaryDisplayLong)
				summaryDisplayLong.classList.remove("mobile-view");
			if (summaryDisplayShort)
				summaryDisplayShort.classList.remove("mobile-view");
		}
	}

	// Load handler modules dynamically
	async function loadHandlers() {
		try {
			const handlerManagerUrl = browser.runtime.getURL(
				"utils/website-handlers/handler-manager.js"
			);

			return { handlerManagerUrl };
		} catch (error) {
			debugError("Error loading handlers:", error);
			return null;
		}
	}

	// Get the appropriate handler for the current site
	async function getHandlerForCurrentSite() {
		try {
			const handlerUrls = await loadHandlers();
			if (!handlerUrls) return null;

			const handlerManagerModule = await import(
				handlerUrls.handlerManagerUrl
			);

			// Handler manager exports a default instance
			const handlerManager =
				handlerManagerModule.default || handlerManagerModule;

			if (
				handlerManager &&
				typeof handlerManager.getHandlerForCurrentSite === "function"
			) {
				const handler = await handlerManager.getHandlerForCurrentSite();
				debugLog(
					"Handler loaded:",
					handler ? handler.constructor.name : "null"
				);
				return handler;
			}
			return null;
		} catch (error) {
			debugError("Error getting handler for current site:", error);
			return null;
		}
	}

	// Load storage manager for caching
	async function loadStorageManager() {
		try {
			const storageUrl = browser.runtime.getURL(
				"utils/storage-manager.js"
			);
			const storageModule = await import(storageUrl);
			return storageModule.default || storageModule;
		} catch (error) {
			debugError("Error loading storage manager:", error);
			return null;
		}
	}

	// Novel library instance
	let novelLibrary = null;
	let SHELVES = null;
	let READING_STATUS = null;
	let READING_STATUS_INFO = null;

	// Load novel library for tracking novels
	async function loadNovelLibrary() {
		try {
			const libraryUrl = browser.runtime.getURL("utils/novel-library.js");
			const libraryModule = await import(libraryUrl);
			novelLibrary = libraryModule.novelLibrary || libraryModule.default;
			SHELVES = libraryModule.SHELVES;
			READING_STATUS = libraryModule.READING_STATUS;
			READING_STATUS_INFO = libraryModule.READING_STATUS_INFO;
			return novelLibrary;
		} catch (error) {
			debugError("Error loading novel library:", error);
			return null;
		}
	}

	// Shared chunking utilities loader
	let chunkingUtils = null;
	async function loadChunkingUtils() {
		if (chunkingUtils) return chunkingUtils;
		try {
			const chunkingUrl = browser.runtime.getURL("utils/chunking.js");
			const chunkingModule = await import(chunkingUrl);
			chunkingUtils = {
				...chunkingModule,
				splitContentForProcessing:
					chunkingModule.splitContentForProcessing ||
					chunkingModule.default?.splitContentForProcessing,
			};
			return chunkingUtils;
		} catch (error) {
			debugError("Error loading chunking utils:", error);
			return null;
		}
	}

	/**
	 * Generate reading status dropdown options from READING_STATUS_INFO
	 * @returns {Array} Array of {value, label} objects
	 */
	function getReadingStatusOptions() {
		if (!READING_STATUS || !READING_STATUS_INFO) {
			// Fallback if constants aren't loaded yet
			return [
				{ value: "reading", label: "📖 Reading" },
				{ value: "completed", label: "✅ Completed" },
				{ value: "plan-to-read", label: "📋 Plan to Read" },
				{ value: "on-hold", label: "⏸️ On Hold" },
				{ value: "dropped", label: "❌ Dropped" },
				{ value: "re-reading", label: "🔁 Re-reading" },
			];
		}

		// Generate options from constants
		return Object.entries(READING_STATUS_INFO).map(([value, info]) => ({
			value: value,
			label: info.label,
		}));
	}

	// Add novel to library when content is enhanced
	async function addToNovelLibrary(context) {
		// Validate that this is a valid chapter page (not user/author profile)
		if (!currentHandler || !currentHandler.isChapterPage?.()) {
			debugLog(
				"Skipping library add: Not a chapter page or no valid handler"
			);
			return;
		}

		if (!novelLibrary) {
			await loadNovelLibrary();
		}

		if (!novelLibrary) {
			console.warn("Novel library not available");
			return;
		}

		try {
			// Create novel data from context
			const novelData = novelLibrary.createNovelFromContext(
				context,
				currentHandler
			);

			if (!novelData) {
				debugLog("Could not create novel data from context");
				return;
			}

			// When enhancing a chapter, user is actively reading
			// Set status to READING if it's a new novel or still PLAN_TO_READ
			novelData.readingStatus = READING_STATUS.READING;

			// Add or update the novel in the library
			await novelLibrary.addOrUpdateNovel(novelData);

			// Try retroactive metadata update
			const metadata = currentHandler.extractNovelMetadata?.() || {};
			if (metadata && Object.keys(metadata).length > 0) {
				await novelLibrary.updateNovelMetadata(novelData.id, metadata);
			}

			// Update chapter tracking
			await novelLibrary.updateChapter(novelData.id, {
				chapterNumber: context.chapterNumber || 1,
				title: context.chapterTitle || document.title,
				url: window.location.href,
				isEnhanced: true,
				enhancedAt: Date.now(),
				readAt: Date.now(),
			});

			debugLog("📚 Novel and chapter added to library:", novelData.title);
		} catch (error) {
			debugError("Error adding to novel library:", error);
		}
	}

	// Extract context for novel library from current page
	function extractNovelContext() {
		const context = {
			url: window.location.href,
			title: document.title,
			chapterNumber: null,
			chapterTitle: null,
			author: null,
			coverUrl: null,
			description: null,
			totalChapters: null,
			status: null,
			genres: [],
			tags: [],
			metadata: {},
		};

		// Try to extract chapter number from navigation
		if (
			currentHandler &&
			typeof currentHandler.getChapterNavigation === "function"
		) {
			const nav = currentHandler.getChapterNavigation();
			if (nav) {
				context.chapterNumber = nav.currentChapter || 1;
				context.totalChapters = nav.totalChapters || 0;
			}
		}

		// Try to extract chapter title
		if (
			currentHandler &&
			typeof currentHandler.extractTitle === "function"
		) {
			try {
				context.chapterTitle = currentHandler.extractTitle();
			} catch (e) {
				// Fallback to document title
			}
		}

		// Site-specific metadata extraction - delegate to handler
		if (
			currentHandler &&
			typeof currentHandler.extractPageMetadata === "function"
		) {
			try {
				const pageMetadata = currentHandler.extractPageMetadata();
				if (pageMetadata) {
					// Merge handler-provided metadata into context
					context.author = pageMetadata.author || context.author;
					context.title = pageMetadata.title || context.title;
					context.genres = [
						...(pageMetadata.genres || []),
						...(context.genres || []),
					];
					context.tags = [
						...(pageMetadata.tags || []),
						...(context.tags || []),
					];
					context.status = pageMetadata.status || context.status;
					context.description =
						pageMetadata.description || context.description;
				}
			} catch (error) {
				debugError(
					"Error extracting page metadata from handler:",
					error
				);
			}
		}

		return context;
	}

	// Check if current page has cached enhanced content
	async function checkCachedContent() {
		if (!storageManager) return false;

		try {
			const cached = await storageManager.loadEnhancedContent(
				window.location.href
			);
			if (cached) {
				debugLog("Found cached enhanced content");
				isCachedContent = true;
				return cached;
			}
			isCachedContent = false;
			return null;
		} catch (error) {
			debugError("Error checking cached content:", error);
			isCachedContent = false;
			return null;
		}
	}

	// Generic content extraction that works across different websites
	// This serves as a fallback when no specific handler is available
	function extractContentGeneric() {
		// Find paragraphs - works on most novel/fiction sites
		const paragraphs = document.querySelectorAll("p");
		if (paragraphs.length > 5) {
			// Get all paragraphs text
			const chapterText = Array.from(paragraphs)
				.map((p) => p.innerText)
				.join("\n\n");

			return {
				found: chapterText.length > 200, // Only consider it found if we have substantial text
				title: document.title || "Unknown Title",
				text: chapterText,
				selector: "generic paragraph extractor",
			};
		}

		// Try to find main content using common article selectors
		const contentSelectors = [
			"article",
			".article",
			".content",
			".story-content",
			".entry-content",
			"#content",
			".main-content",
			".post-content",
			"#storytext", // fanfiction.net
			"#arrticle", // Ranobes.net
			".text-chapter",
			".chapter-content",
			".novel-content",
			".story",
			".chapter-inner",
		];

		for (const selector of contentSelectors) {
			const element = document.querySelector(selector);
			if (element) {
				return {
					found: true,
					title: document.title || "Unknown Title",
					text: element.innerText.trim(),
					selector: `generic selector: ${selector}`,
				};
			}
		}

		// Nothing found
		return {
			found: false,
			title: "",
			text: "",
			selector: "",
		};
	}

	async function initialize() {
		debugLog("Ranobe Gemini: Initializing content script");

		// Verify background script connection
		await verifyBackgroundConnection();

		// Load storage manager
		storageManager = await loadStorageManager();

		// Fetch font size setting from background script
		// Using sendMessageWithRetry to handle service worker sleep issues
		try {
			const modelInfo = await sendMessageWithRetry({
				action: "getModelInfo",
			});
			if (modelInfo && modelInfo.fontSize) {
				currentFontSize = modelInfo.fontSize;
				debugLog(`Font size setting loaded: ${currentFontSize}%`);
			}
		} catch (error) {
			debugLog("Could not load font size setting:", error);
		}

		// Check for cached content
		const cachedData = await checkCachedContent();
		if (cachedData && cachedData.enhancedContent) {
			debugLog("Found cached enhanced content, auto-loading...");
			// Auto-load the cached content after UI is injected and content area is ready
			// Use requestAnimationFrame to ensure DOM is fully rendered
			requestAnimationFrame(() => {
				setTimeout(() => {
					replaceContentWithEnhancedVersion(cachedData);
				}, 250);
			});
		}

		// Get the appropriate handler for this website
		currentHandler = await getHandlerForCurrentSite();

		if (currentHandler) {
			debugLog(`Using specific handler for ${window.location.hostname}`);
		} else {
			debugLog(
				"No specific handler found, using generic extraction methods"
			);
		}

		// Determine page type
		const isChapterPage = currentHandler
			? currentHandler.isChapterPage()
			: true;
		const isNovelPage = currentHandler?.isNovelPage?.() || false;
		const handlerType = getHandlerType();

		// Auto-update novel metadata when visiting any supported novel page
		// This happens regardless of whether it's a chapter or novel info page
		if (currentHandler) {
			await autoUpdateNovelOnVisit();
		}

		// For DEDICATED_PAGE-type handlers on novel info pages, show novel management UI
		// instead of enhance/summarize buttons
		if (
			!hasExtractButton &&
			isNovelPage &&
			handlerType === HANDLER_TYPES.DEDICATED_PAGE
		) {
			injectNovelPageUI();
		}
		// Create enhance/summarize UI if it doesn't exist and we're on a chapter page
		else if (!hasExtractButton && isChapterPage) {
			injectUI();
		} else if (!isChapterPage && !isNovelPage) {
			debugLog(
				"Ranobe Gemini: Not a chapter or novel page, skipping UI injection"
			);
		}

		// Automatically extract content once the page is loaded
		if (!autoExtracted) {
			setTimeout(() => {
				autoExtractContent();
			}, 1500);
		}
	}

	/**
	 * Handler type constants for metadata extraction strategy
	 *
	 * CHAPTER_EMBEDDED: Full novel metadata available on chapter pages
	 *   - Sites: FanFiction.net (desktop), AO3
	 *   - Can auto-add novels when visiting any chapter
	 *   - No need to visit a separate info page
	 *
	 * DEDICATED_PAGE: Novel metadata only available on dedicated info pages
	 *   - Sites: Ranobes, ScribbleHub, WebNovel, FanFiction.net (mobile)
	 *   - Must visit the novel's info page to get full details
	 *   - Chapter pages only have partial info (title, current chapter)
	 */
	const HANDLER_TYPES = {
		CHAPTER_EMBEDDED: "chapter_embedded",
		DEDICATED_PAGE: "dedicated_page",
	};

	/**
	 * Get the current handler's type
	 * @returns {"chapter_embedded" | "dedicated_page" | null}
	 */
	function getHandlerType() {
		if (!currentHandler) return null;
		return (
			currentHandler.constructor.HANDLER_TYPE?.toLowerCase() ||
			"chapter_embedded"
		);
	}

	/**
	 * Create and show a timed notification banner
	 * @param {string} message - Message to display
	 * @param {string} type - Banner type: 'info', 'success', 'warning', 'action'
	 * @param {number} duration - How long to show (ms), 0 = until dismissed
	 * @param {Object} options - Additional options (actionButton, etc.)
	 * @returns {HTMLElement} The banner element
	 */
	function showTimedBanner(
		message,
		type = "info",
		duration = 3000,
		options = {}
	) {
		// Remove any existing banner
		const existingBanner = document.getElementById(
			"rg-notification-banner"
		);
		if (existingBanner) {
			existingBanner.remove();
		}

		const banner = document.createElement("div");
		banner.id = "rg-notification-banner";
		banner.className = `rg-banner rg-banner-${type}`;

		// Banner styles
		const colors = {
			info: { bg: "#1a237e", border: "#3949ab", icon: "📚" },
			success: { bg: "#1b5e20", border: "#43a047", icon: "✅" },
			warning: { bg: "#e65100", border: "#ff9800", icon: "⚠️" },
			action: { bg: "#4a148c", border: "#7b1fa2", icon: "🔗" },
			updating: { bg: "#00695c", border: "#26a69a", icon: "🔄" },
		};

		const color = colors[type] || colors.info;

		banner.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			background: ${color.bg};
			border: 2px solid ${color.border};
			border-radius: 8px;
			padding: 12px 20px;
			color: white;
			font-family: system-ui, -apple-system, sans-serif;
			font-size: 14px;
			z-index: 999999;
			box-shadow: 0 4px 20px rgba(0,0,0,0.4);
			display: flex;
			align-items: center;
			gap: 12px;
			max-width: 400px;
			animation: rg-slide-in 0.3s ease-out;
		`;

		// Add animation keyframes if not already added
		if (!document.getElementById("rg-banner-styles")) {
			const styleSheet = document.createElement("style");
			styleSheet.id = "rg-banner-styles";
			styleSheet.textContent = `
				@keyframes rg-slide-in {
					from { transform: translateX(100%); opacity: 0; }
					to { transform: translateX(0); opacity: 1; }
				}
				@keyframes rg-slide-out {
					from { transform: translateX(0); opacity: 1; }
					to { transform: translateX(100%); opacity: 0; }
				}
				@keyframes rg-spin {
					from { transform: rotate(0deg); }
					to { transform: rotate(360deg); }
				}
				.rg-banner-updating .rg-banner-icon {
					animation: rg-spin 1s linear infinite;
				}
			`;
			document.head.appendChild(styleSheet);
		}

		// Icon
		const iconSpan = document.createElement("span");
		iconSpan.className = "rg-banner-icon";
		iconSpan.textContent = color.icon;
		iconSpan.style.fontSize = "18px";
		banner.appendChild(iconSpan);

		// Message container
		const msgContainer = document.createElement("div");
		msgContainer.style.flex = "1";

		const msgText = document.createElement("div");
		msgText.textContent = message;
		msgContainer.appendChild(msgText);

		// Field being updated (for updating banners)
		if (options.field) {
			const fieldText = document.createElement("div");
			fieldText.style.cssText =
				"font-size: 12px; opacity: 0.8; margin-top: 4px;";
			fieldText.textContent = `Updating: ${options.field}`;
			msgContainer.appendChild(fieldText);
		}

		banner.appendChild(msgContainer);

		// Action button (for DEDICATED_PAGE-type sites)
		if (options.actionButton) {
			const actionBtn = document.createElement("button");
			actionBtn.textContent = options.actionButton.text;
			actionBtn.style.cssText = `
				background: white;
				color: ${color.bg};
				border: none;
				padding: 6px 12px;
				border-radius: 4px;
				cursor: pointer;
				font-weight: bold;
				font-size: 12px;
				white-space: nowrap;
			`;
			actionBtn.addEventListener("click", () => {
				if (options.actionButton.url) {
					window.open(options.actionButton.url, "_blank");
				} else if (options.actionButton.onClick) {
					options.actionButton.onClick();
				}
				banner.remove();
			});
			banner.appendChild(actionBtn);
		}

		// Close button
		const closeBtn = document.createElement("button");
		closeBtn.textContent = "×";
		closeBtn.style.cssText = `
			background: transparent;
			border: none;
			color: white;
			font-size: 20px;
			cursor: pointer;
			padding: 0 4px;
			opacity: 0.7;
		`;
		closeBtn.addEventListener("click", () => banner.remove());
		banner.appendChild(closeBtn);

		document.body.appendChild(banner);

		// Auto-dismiss after duration (if not 0)
		if (duration > 0) {
			setTimeout(() => {
				if (banner.parentElement) {
					banner.style.animation =
						"rg-slide-out 0.3s ease-in forwards";
					setTimeout(() => banner.remove(), 300);
				}
			}, duration);
		}

		return banner;
	}

	/**
	 * Update the banner to show which field is being updated
	 * @param {string} field - Field name being updated
	 */
	function updateBannerField(field) {
		const banner = document.getElementById("rg-notification-banner");
		if (banner) {
			const fieldText = banner.querySelector("div > div:nth-child(2)");
			if (fieldText) {
				fieldText.textContent = `Updating: ${field}`;
			}
		}
	}

	/**
	 * Auto-update novel metadata when visiting any supported novel page
	 * This ensures the library stays up-to-date without requiring user action
	 */
	async function autoUpdateNovelOnVisit() {
		if (!currentHandler) return;

		// Load novel library if not already loaded
		if (!novelLibrary) {
			await loadNovelLibrary();
		}

		if (!novelLibrary) {
			debugLog("Novel library not available for auto-update");
			return;
		}

		try {
			// Get handler type
			const handlerType = getHandlerType();
			const isChapter = currentHandler.isChapterPage();
			const isNovelPage = currentHandler.isNovelPage?.() || false;

			// For DEDICATED_PAGE-type sites on chapter pages, show banner with link to novel details
			if (
				handlerType === HANDLER_TYPES.DEDICATED_PAGE &&
				isChapter &&
				!isNovelPage
			) {
				const novelPageUrl = currentHandler.getNovelPageUrl?.();
				if (novelPageUrl) {
					// Check if we have the novel in library
					const novelId = getNovelIdFromCurrentPage();
					const existingNovels = await novelLibrary.getRecentNovels(
						0
					);
					const existingNovel = novelId
						? existingNovels.find((n) => n.id === novelId)
						: null;

					if (!existingNovel) {
						// Novel not in library, show banner to visit novel page
						showTimedBanner(
							"Add this novel to your library?",
							"action",
							8000,
							{
								actionButton: {
									text: "📖 View Novel Details",
									url: novelPageUrl,
								},
							}
						);
					}
				}
			}

			// Check if handler supports metadata extraction
			if (typeof currentHandler.extractNovelMetadata !== "function") {
				debugLog("Handler does not support metadata extraction");
				return;
			}

			// Extract metadata from current page
			const metadata = currentHandler.extractNovelMetadata();
			if (!metadata || !metadata.title) {
				debugLog("Could not extract novel metadata");
				return;
			}

			// Generate novel ID using handler or fallback method
			let novelId = getNovelIdFromCurrentPage();
			if (!novelId) {
				// Fallback: use shelf ID + URL-based ID
				const shelfId =
					currentHandler.constructor.SHELF_METADATA?.id || "unknown";
				const urlPath = window.location.pathname;
				const urlHash = btoa(urlPath)
					.substring(0, 16)
					.replace(/[^a-zA-Z0-9]/g, "");
				novelId = `${shelfId}-${urlHash}`;
			}

			// Determine if we're on a chapter page to set proper initial progress
			const chapterNav = currentHandler.getChapterNavigation?.() || {};
			const currentChapterNum = chapterNav.currentChapter;

			// Create novel data object
			// CRITICAL: For dedicated_page handlers, sourceUrl MUST be mainNovelUrl (novel details page)
			// NOT the current chapter URL, so "View on Site" and "Refresh Metadata" go to the right place
			const novelData = {
				id: novelId,
				title: metadata.title,
				author: metadata.author || "Unknown",
				description: metadata.description || "",
				coverUrl: metadata.coverUrl || "",
				// For dedicated_page: Always use mainNovelUrl if available (extracted from breadcrumbs/links)
				// For chapter_embedded: mainNovelUrl will be the same as current URL on chapter pages
				sourceUrl: metadata.mainNovelUrl || window.location.href,
				sourceSite: window.location.hostname,
				shelfId:
					currentHandler.constructor.SHELF_METADATA?.id || "unknown",
				genres: metadata.genres || [],
				tags: metadata.tags || [],
				status: metadata.status || null,
				// CRITICAL: Ensure totalChapters is set from chapterCount or totalChapters
				totalChapters:
					metadata.totalChapters || metadata.chapterCount || null,
				// Ensure nested metadata and stats are preserved for site-specific features
				// Merge top-level metadata fields into nested metadata object for consistency
				metadata: {
					...(metadata.metadata || {}),
					// Also copy top-level fields that belong in metadata
					...(metadata.rating && { rating: metadata.rating }),
					...(metadata.language && { language: metadata.language }),
					...(metadata.publishedDate && {
						publishedDate: metadata.publishedDate,
					}),
					...(metadata.updatedDate && {
						updatedDate: metadata.updatedDate,
					}),
				},
				// Build stats from both nested stats object and top-level stat fields
				stats: {
					...(metadata.stats || {}),
					// Also copy top-level stat fields for FanFiction compatibility
					...(metadata.words && { words: metadata.words }),
					...(metadata.reviews && { reviews: metadata.reviews }),
					...(metadata.favorites && {
						favorites: metadata.favorites,
					}),
					...(metadata.follows && { follows: metadata.follows }),
				},
				lastUpdated: Date.now(),
				// Only set progress if on a chapter page, otherwise let library set defaults
				...(isChapter && currentChapterNum
					? {
							lastReadChapter: currentChapterNum,
							lastReadUrl: window.location.href,
							readingStatus: READING_STATUS.READING,
					  }
					: {}),
			}; // Check if this novel already exists in the library
			const existingNovels = await novelLibrary.getRecentNovels(0);
			const existingNovel = existingNovels.find((n) => n.id === novelId);

			// Auto-add logic:
			// - For CHAPTER_EMBEDDED-type sites: auto-add/update on chapter pages (full metadata available)
			// - For DEDICATED_PAGE-type sites:
			//   - On novel info pages: auto-add/update (full metadata available)
			//   - On chapter pages: auto-add with partial metadata (will be updated when visiting novel page)
			// This ensures users don't miss tracking novels they're reading
			const hasGoodMetadata =
				handlerType === HANDLER_TYPES.CHAPTER_EMBEDDED ||
				(handlerType === HANDLER_TYPES.DEDICATED_PAGE && isNovelPage);

			// Always allow auto-add if we have some metadata (title at minimum)
			const shouldAutoAdd = metadata.title && metadata.title.length > 0;

			if (existingNovel) {
				// Check if this novel has pending refresh (from library refresh button)
				const hasPendingRefresh = existingNovel.pendingRefresh === true;

				if (hasPendingRefresh) {
					// Force update - user requested refresh, skip editedFields protection
					showTimedBanner(
						`Refreshing: ${metadata.title}`,
						"updating",
						2000,
						{ field: "all metadata" }
					);

					// Clear the pending refresh flag and reset edited fields
					const library = await novelLibrary.getLibrary();
					if (library.novels[novelId]) {
						library.novels[novelId].pendingRefresh = false;
						library.novels[novelId].editedFields = {};
						// Apply all new metadata directly
						Object.assign(library.novels[novelId], novelData);
						library.novels[novelId].lastMetadataUpdate = Date.now();
						library.novels[novelId].lastAccessedAt = Date.now();
						await novelLibrary.saveLibrary(library);
					}

					debugLog(
						"📚 Force-refreshed novel metadata:",
						metadata.title
					);
					showTimedBanner(
						`Refreshed: ${metadata.title}`,
						"success",
						3000
					);
				} else {
					// Normal update - respects editedFields
					if (hasGoodMetadata) {
						showTimedBanner(
							`Updating: ${metadata.title}`,
							"updating",
							2000,
							{
								field: "metadata",
							}
						);
					}
					await novelLibrary.updateNovelMetadata(novelId, novelData);
					debugLog("📚 Auto-updated novel metadata:", metadata.title);
					if (hasGoodMetadata) {
						showTimedBanner(
							`Updated: ${metadata.title}`,
							"success",
							2000
						);
					}
				}
			} else if (shouldAutoAdd) {
				// Add new novel to library
				const addMessage = hasGoodMetadata
					? `Adding: ${metadata.title}`
					: `Tracking: ${metadata.title}`;
				showTimedBanner(addMessage, "updating", 2000, {
					field: "new novel",
				});
				await novelLibrary.addOrUpdateNovel(novelData);
				debugLog("📚 Auto-added novel to library:", metadata.title);

				const successMessage = hasGoodMetadata
					? `Added to library: ${metadata.title}`
					: `Now tracking: ${metadata.title}`;
				showTimedBanner(successMessage, "success", 3000);

				// For DEDICATED_PAGE type on chapter pages, remind user to visit novel page for full details
				if (
					handlerType === HANDLER_TYPES.DEDICATED_PAGE &&
					isChapter &&
					!isNovelPage
				) {
					const novelPageUrl = currentHandler.getNovelPageUrl?.();
					if (novelPageUrl) {
						setTimeout(() => {
							showTimedBanner(
								"Visit novel page for full details",
								"action",
								5000,
								{
									actionButton: {
										text: "📖 View Details",
										url: novelPageUrl,
									},
								}
							);
						}, 3500);
					}
				}
			}

			// If on a chapter page, also update chapter tracking
			if (isChapter) {
				const chapterNav =
					currentHandler.getChapterNavigation?.() || {};
				await novelLibrary.updateChapter(novelId, {
					chapterNumber: chapterNav.currentChapter || 1,
					title: document.title,
					url: window.location.href,
					readAt: Date.now(),
				});
				debugLog("📖 Updated chapter tracking");
			}
		} catch (error) {
			debugError("Error in auto-update novel:", error);
		}
	}

	/**
	 * Get novel ID from current page using handler
	 * @returns {string|null}
	 */
	function getNovelIdFromCurrentPage() {
		if (!currentHandler) return null;

		if (typeof currentHandler.generateNovelId === "function") {
			return currentHandler.generateNovelId(window.location.href);
		}
		return null;
	}

	// Find the content area using handlers or generic approach
	function findContentArea() {
		if (currentHandler) {
			return currentHandler.findContentArea();
		}

		// Generic fallback approach - try common content selectors
		const commonSelectors = [
			"#storytext", // fanfiction.net
			"#arrticle", // Ranobes.net
			".text-chapter",
			".chapter-content",
			".novel-content",
			".story",
			".chapter-inner",
			".article-content",
			".post-content",
			"article",
			".content",
		];

		for (const selector of commonSelectors) {
			const element = document.querySelector(selector);
			if (element) {
				debugLog(
					`Generic: Content area found using selector: ${selector}`
				);
				return element;
			}
		}

		return null;
	}

	// Function to create the Long Summary button
	function createSummarizeButton() {
		const button = document.createElement("button");
		button.id = "summarize-button";
		button.textContent = "📝 Long Summary";
		button.title = "Generate a detailed summary of the chapter";
		button.classList.add("gemini-button"); // Use the same class for styling
		button.addEventListener("click", (event) =>
			handleSummarizeButtonClick(event, false)
		);
		return button;
	}

	// Function to create the Short Summary button
	function createShortSummarizeButton() {
		const button = document.createElement("button");
		button.id = "short-summarize-button";
		button.textContent = "📋 Short Summary";
		button.title = "Generate a brief summary of the chapter";
		button.classList.add("gemini-button"); // Use the same class for styling
		button.addEventListener("click", (event) =>
			handleSummarizeButtonClick(event, true)
		);
		return button;
	}

	// // Function to create the FanFiction version switcher button (mobile ⟷ desktop)
	// function createFanfictionVersionSwitcher() {
	// 	const hostname = window.location.hostname;
	// 	const isMobile = hostname === "m.fanfiction.net";
	// 	const isDesktop =
	// 		hostname === "www.fanfiction.net" || hostname === "fanfiction.net";

	// 	// Only show switcher on FanFiction.net sites
	// 	if (!isMobile && !isDesktop) {
	// 		return null;
	// 	}

	// 	const button = document.createElement("button");
	// 	button.id = "fanfiction-version-switcher";
	// 	button.textContent = isMobile ? "🖥️ Desktop" : "📱 Mobile";
	// 	button.title = isMobile
	// 		? "Switch to desktop version"
	// 		: "Switch to mobile version";

	// 	// Match the same styling as enhance/summarize buttons but compact
	// 	button.style.cssText = `
	// 		display: inline-flex;
	// 		align-items: center;
	// 		justify-content: center;
	// 		padding: 8px 12px;
	// 		margin: 0;
	// 		background-color: #222;
	// 		color: #bab9a0;
	// 		border: 1px solid #ffffff21;
	// 		box-shadow: inset 0 0 0 1px #5a5a5a4d;
	// 		border-radius: 4px;
	// 		cursor: pointer;
	// 		font-weight: bold;
	// 		font-size: 12px;
	// 		z-index: 1000;
	// 	`;

	// 	button.addEventListener("click", () => {
	// 		const currentUrl = window.location.href;
	// 		let newUrl;

	// 		if (isMobile) {
	// 			// Switch to desktop: m.fanfiction.net → www.fanfiction.net
	// 			newUrl = currentUrl.replace(
	// 				"m.fanfiction.net",
	// 				"www.fanfiction.net"
	// 			);
	// 		} else {
	// 			// Switch to mobile: www.fanfiction.net → m.fanfiction.net
	// 			newUrl = currentUrl.replace(
	// 				/(?:www\.)?fanfiction\.net/,
	// 				"m.fanfiction.net"
	// 			);
	// 		}

	// 		window.location.href = newUrl;
	// 	});

	// 	button.addEventListener("mouseover", () => {
	// 		button.style.backgroundColor = "#333";
	// 	});
	// 	button.addEventListener("mouseout", () => {
	// 		button.style.backgroundColor = "#222";
	// 	});

	// 	return button;
	// }

	// Function to create the Enhance button
	function createEnhanceButton() {
		const enhanceButton = document.createElement("button");
		enhanceButton.className = "gemini-enhance-btn";

		// Change button text based on whether content is cached
		enhanceButton.textContent = isCachedContent
			? "♻ Regenerate with Gemini"
			: "✨ Enhance with Gemini";

		// Style to match the sample page buttons
		enhanceButton.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 15px;
        margin: 15px 0;
        background-color: #222;
        color: #bab9a0;
        border: 1px solid #ffffff21;
        box-shadow: inset 0 0 0 1px #5a5a5a4d;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
        z-index: 1000;
    `;
		enhanceButton.addEventListener("click", handleButtonClick);
		enhanceButton.addEventListener("mouseover", () => {
			enhanceButton.style.backgroundColor = "#333";
		});
		enhanceButton.addEventListener("mouseout", () => {
			enhanceButton.style.backgroundColor = "#222";
		});
		return enhanceButton;
	}

	// Wrapper handler for Enhance button clicks
	async function handleButtonClick(event) {
		const button = event.currentTarget;
		const originalText = button.textContent;

		// Check if background script is ready
		if (!isBackgroundScriptReady) {
			try {
				button.disabled = true;
				button.textContent = "Initializing...";
				showStatusMessage("Verifying extension connection...", "info");

				// Try to verify connection
				const isConnected = await verifyBackgroundConnection();

				if (!isConnected) {
					throw new Error(
						"Cannot connect to extension background script"
					);
				}

				// Connection verified, proceed with enhancement
				button.textContent = originalText;
				button.disabled = false;
				await handleEnhanceClick();
			} catch (error) {
				debugError("Connection error:", error);
				showStatusMessage(
					"Error connecting to extension. Please reload the page and try again.",
					"error"
				);
				button.textContent = originalText;
				button.disabled = false;
			}
		} else {
			// Background script is already ready
			await handleEnhanceClick();
		}
	}

	// Wrapper handler for Summarize button clicks
	async function handleSummarizeButtonClick(event, isShort = false) {
		const button = event.currentTarget;
		const originalText = button.textContent;

		// Check if background script is ready
		if (!isBackgroundScriptReady) {
			try {
				button.disabled = true;
				button.textContent = "Initializing...";
				showStatusMessage("Verifying extension connection...", "info");

				// Try to verify connection
				const isConnected = await verifyBackgroundConnection();

				if (!isConnected) {
					throw new Error(
						"Cannot connect to extension background script"
					);
				}

				// Connection verified, proceed with summarization
				button.textContent = originalText;
				button.disabled = false;
				await handleSummarizeClick(isShort);
			} catch (error) {
				debugError("Connection error:", error);
				showStatusMessage(
					"Error connecting to extension. Please reload the page and try again.",
					"error"
				);
				button.textContent = originalText;
				button.disabled = false;
			}
		} else {
			// Background script is already ready
			await handleSummarizeClick(isShort);
		}
	}

	// Function to add initial word count display below the buttons
	function addInitialWordCountDisplay(contentArea) {
		if (!contentArea) return;

		const originalContent =
			contentArea.innerText || contentArea.textContent;
		const wordCount = countWords(originalContent);

		// Create word count container
		const wordCountContainer = document.createElement("div");
		wordCountContainer.className = "gemini-word-count";
		wordCountContainer.style.cssText = `
		margin: 10px 0 15px 0;
		color: #bab9a0;
		font-size: 14px;
		text-align: left;
	`;

		wordCountContainer.innerHTML = `
		<strong>  Word Count:</strong> ${wordCount} words
	`;

		// Insert right after the controls container
		const controlsContainer = document.getElementById("gemini-controls");
		if (controlsContainer) {
			controlsContainer.parentNode.insertBefore(
				wordCountContainer,
				controlsContainer.nextSibling
			);
		} else {
			// Fallback: insert at the top of the content area
			contentArea.insertBefore(
				wordCountContainer,
				contentArea.firstChild
			);
		}
	}

	/**
	 * Inject novel management UI for novel info pages (DEDICATED_PAGE-type sites)
	 * Shows Add/Update/Delete/View Library buttons instead of enhance/summarize
	 */
	async function injectNovelPageUI() {
		if (!currentHandler) return;

		// Find a good insertion point for the UI
		const insertionPoint = findNovelPageInsertionPoint();
		if (!insertionPoint) {
			console.warn(
				"Ranobe Gemini: Could not find insertion point for novel page UI"
			);
			return;
		}

		// Check if UI already injected (dedupe any accidental duplicates)
		const existingNovelControls =
			document.querySelectorAll("#rg-novel-controls");
		if (existingNovelControls.length) {
			const [primary, ...extras] = existingNovelControls;
			extras.forEach((el) => el.remove());
			if (primary.isConnected) {
				debugLog("Ranobe Gemini: Novel page UI already injected.");
				return;
			}
		}

		// Load novel library
		if (!novelLibrary) {
			await loadNovelLibrary();
		}

		// Get novel ID and check if it exists in library
		const novelId = getNovelIdFromCurrentPage();
		const existingNovels = novelLibrary
			? await novelLibrary.getRecentNovels(0)
			: [];
		const existingNovel = novelId
			? existingNovels.find((n) => n.id === novelId)
			: null;

		// Create the controls container
		const controlsContainer = document.createElement("div");
		controlsContainer.id = "rg-novel-controls";
		controlsContainer.style.cssText = `
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
			padding: 15px;
			margin: 15px 0;
			background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
			border: 1px solid #0f3460;
			border-radius: 8px;
			box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
		`;

		// Create header
		const header = document.createElement("div");
		header.style.cssText = `
			width: 100%;
			display: flex;
			align-items: center;
			gap: 10px;
			margin-bottom: 10px;
			padding-bottom: 10px;
			border-bottom: 1px solid #0f3460;
		`;

		const logo = document.createElement("span");
		logo.textContent = "📚";
		logo.style.fontSize = "24px";

		const title = document.createElement("span");
		title.textContent = "Ranobe Gemini Library";
		title.style.cssText = `
			color: #e94560;
			font-weight: bold;
			font-size: 16px;
		`;

		const status = document.createElement("span");
		status.id = "rg-novel-status";
		status.textContent = existingNovel
			? "✅ In Library"
			: "📖 Not in Library";
		status.style.cssText = `
			margin-left: auto;
			padding: 4px 10px;
			background: ${existingNovel ? "#1b5e20" : "#424242"};
			color: white;
			border-radius: 4px;
			font-size: 12px;
		`;

		header.appendChild(logo);
		header.appendChild(title);
		header.appendChild(status);
		controlsContainer.appendChild(header);

		// Create button row - centered for uniformity
		const buttonRow = document.createElement("div");
		buttonRow.style.cssText = `
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
			width: 100%;
			justify-content: center;
			align-items: center;
		`;

		// Button style helper
		const createButton = (text, icon, color, onClick) => {
			const btn = document.createElement("button");
			btn.textContent = `${icon} ${text}`;
			btn.style.cssText = `
				padding: 10px 16px;
				background: ${color};
				color: white;
				border: none;
				border-radius: 6px;
				cursor: pointer;
				font-weight: bold;
				font-size: 14px;
				transition: all 0.2s ease;
				flex: 1;
				min-width: 120px;
			`;
			btn.addEventListener("mouseover", () => {
				btn.style.transform = "translateY(-2px)";
				btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
			});
			btn.addEventListener("mouseout", () => {
				btn.style.transform = "translateY(0)";
				btn.style.boxShadow = "none";
			});
			btn.addEventListener("click", onClick);
			return btn;
		};

		// Add/Update button
		const addUpdateBtn = createButton(
			existingNovel ? "Update Novel" : "Add to Library",
			existingNovel ? "🔄" : "➕",
			existingNovel ? "#00695c" : "#1976d2",
			async () => {
				await handleNovelAddUpdate();
			}
		);
		buttonRow.appendChild(addUpdateBtn);

		// Reading status dropdown (if novel exists)
		if (existingNovel) {
			const statusSelect = document.createElement("select");
			statusSelect.id = "rg-reading-status";
			statusSelect.style.cssText = `
				padding: 10px 16px;
				background: #424242;
				color: white;
				border: 1px solid #666;
				border-radius: 6px;
				cursor: pointer;
				font-size: 14px;
				flex: 1;
				min-width: 140px;
			`;

			const statusOptions = getReadingStatusOptions();

			statusOptions.forEach((opt) => {
				const option = document.createElement("option");
				option.value = opt.value;
				option.textContent = opt.label;
				if (existingNovel.readingStatus === opt.value) {
					option.selected = true;
				}
				statusSelect.appendChild(option);
			});

			statusSelect.addEventListener("change", async (e) => {
				await handleReadingStatusChange(e.target.value);
			});

			buttonRow.appendChild(statusSelect);

			// Delete button
			const deleteBtn = createButton(
				"Remove",
				"🗑️",
				"#c62828",
				async () => {
					await handleNovelDelete();
				}
			);
			buttonRow.appendChild(deleteBtn);
		}

		// Open Library button
		const libraryBtn = createButton("Open Library", "📚", "#7b1fa2", () => {
			const libraryUrl = browser.runtime.getURL("library/library.html");
			window.open(libraryUrl, "_blank");
		});
		buttonRow.appendChild(libraryBtn);

		controlsContainer.appendChild(buttonRow);

		// Insert the controls
		insertionPoint.element.parentNode.insertBefore(
			controlsContainer,
			insertionPoint.element
		);

		hasExtractButton = true; // Prevent duplicate injection
		debugLog("Ranobe Gemini: Novel page UI injected successfully");
	}

	/**
	 * Find the best insertion point for novel page UI
	 */
	function findNovelPageInsertionPoint() {
		if (!currentHandler) return null;

		// Try handler-specific insertion point
		if (typeof currentHandler.getNovelPageUIInsertionPoint === "function") {
			return currentHandler.getNovelPageUIInsertionPoint();
		}

		// Common novel page selectors across sites
		const selectors = [
			".r-fullstory-spec", // Ranobes
			".fic_row", // ScribbleHub
			".g_thumb", // WebNovel
			".story-info", // Generic
			".novel-info",
			".book-info",
			"article header",
			"h1",
		];

		for (const selector of selectors) {
			const element = document.querySelector(selector);
			if (element) {
				return { element, position: "before" };
			}
		}

		// Fallback to body
		return { element: document.body.firstChild, position: "before" };
	}

	/**
	 * Handle add/update button click on novel page
	 */
	async function handleNovelAddUpdate() {
		if (!currentHandler || !novelLibrary) {
			showTimedBanner("Library not available", "warning", 3000);
			return;
		}

		try {
			showTimedBanner("Saving novel...", "updating", 0, {
				field: "metadata",
			});

			const metadata = currentHandler.extractNovelMetadata();
			if (!metadata || !metadata.title) {
				showTimedBanner(
					"Could not extract novel metadata",
					"warning",
					3000
				);
				return;
			}

			const novelId = getNovelIdFromCurrentPage();
			if (!novelId) {
				showTimedBanner("Could not generate novel ID", "warning", 3000);
				return;
			}

			const novelData = {
				id: novelId,
				title: metadata.title,
				author: metadata.author || "Unknown",
				description: metadata.description || "",
				coverUrl: metadata.coverUrl || "",
				sourceUrl: metadata.mainNovelUrl || window.location.href,
				sourceSite: window.location.hostname,
				shelfId:
					currentHandler.constructor.SHELF_METADATA?.id || "unknown",
				genres: metadata.genres || [],
				tags: metadata.tags || [],
				status: metadata.status || null,
				totalChapters: metadata.chapterCount || null,
				lastUpdated: Date.now(),
			};

			await novelLibrary.addOrUpdateNovel(novelData);

			// Also update with extracted metadata
			await novelLibrary.updateNovelMetadata(novelId, metadata);

			showTimedBanner(`Saved: ${metadata.title}`, "success", 3000);

			// Refresh the UI
			const controls = document.getElementById("rg-novel-controls");
			if (controls) {
				controls.remove();
				hasExtractButton = false;
				await injectNovelPageUI();
			}
		} catch (error) {
			debugError("Error saving novel:", error);
			showTimedBanner("Error saving novel", "warning", 3000);
		}
	}

	/**
	 * Handle reading status change
	 */
	async function handleReadingStatusChange(newStatus) {
		if (!novelLibrary) return;

		const novelId = getNovelIdFromCurrentPage();
		if (!novelId) return;

		try {
			await novelLibrary.updateNovelMetadata(novelId, {
				readingStatus: newStatus,
			});
			showTimedBanner(`Status updated: ${newStatus}`, "success", 2000);
		} catch (error) {
			debugError("Error updating reading status:", error);
			showTimedBanner("Error updating status", "warning", 3000);
		}
	}

	/**
	 * Update chapter progression in library
	 * Automatically tracks when user reads/enhances chapters
	 */
	async function updateChapterProgression() {
		if (!novelLibrary || !currentHandler) return;

		const novelId = getNovelIdFromCurrentPage();
		if (!novelId) return;

		try {
			// Get current chapter info from handler
			const chapterNav = currentHandler.getChapterNavigation();
			if (!chapterNav || chapterNav.currentChapter === null) {
				debugLog("No chapter info available from handler");
				return;
			}

			// Get the novel from library
			const novel = await novelLibrary.getNovelByUrl(
				window.location.href
			);
			if (!novel) {
				debugLog("Novel not in library, skipping progression update");
				return;
			}

			// Only update if this chapter is newer than last read
			if (
				!novel.lastReadChapter ||
				chapterNav.currentChapter > novel.lastReadChapter
			) {
				// Use updateReadingProgress for auto-status updates
				await novelLibrary.updateReadingProgress(
					novelId,
					chapterNav.currentChapter,
					window.location.href
				);
				debugLog(
					`📖 Chapter progression updated: Chapter ${chapterNav.currentChapter}`
				);
				showTimedBanner(
					`Progress saved: Chapter ${chapterNav.currentChapter}`,
					"success",
					2000
				);
			}
		} catch (error) {
			debugError("Error updating chapter progression:", error);
		}
	}

	/**
	 * Handle delete button click
	 */
	async function handleNovelDelete() {
		if (!novelLibrary) return;

		const novelId = getNovelIdFromCurrentPage();
		if (!novelId) return;

		// Confirm deletion
		if (!confirm("Remove this novel from your library?")) {
			return;
		}

		try {
			await novelLibrary.removeNovel(novelId);
			showTimedBanner("Novel removed from library", "success", 3000);

			// Refresh the UI
			const controls = document.getElementById("rg-novel-controls");
			if (controls) {
				controls.remove();
				hasExtractButton = false;
				await injectNovelPageUI();
			}
		} catch (error) {
			debugError("Error removing novel:", error);
			showTimedBanner("Error removing novel", "warning", 3000);
		}
	}

	/**
	 * Create compact novel controls for CHAPTER_EMBEDDED type sites
	 * These appear inline with enhance/summarize controls on chapter pages
	 * @returns {HTMLElement|null} The novel controls container or null if not applicable
	 */
	function insertAtPosition(target, node, position = "before") {
		if (!target || !node) return;
		switch (position) {
			case "after":
			case "afterend":
				target.parentNode.insertBefore(node, target.nextSibling);
				break;
			case "prepend":
			case "afterbegin":
				target.prepend(node);
				break;
			case "append":
			case "beforeend":
				target.appendChild(node);
				break;
			default:
				target.parentNode.insertBefore(node, target);
		}
	}

	function resolveNovelControlsInsertion(config = {}) {
		let targetElement =
			config?.insertionPoint?.element ||
			config?.insertionPoint?.target ||
			config?.insertionPoint ||
			null;
		let position =
			config?.insertionPoint?.position || config?.position || "after";

		// Fallback: reuse handler-provided novel page insertion point when available
		if (
			!targetElement &&
			typeof currentHandler?.getNovelPageUIInsertionPoint === "function"
		) {
			const handlerPoint = currentHandler.getNovelPageUIInsertionPoint();
			targetElement = handlerPoint?.element || targetElement;
			position = handlerPoint?.position || position;
		}

		// Last resort: place below Gemini controls or before content area
		if (!targetElement) {
			const mainControls = document.getElementById("gemini-controls");
			if (mainControls) {
				targetElement = mainControls;
				position = "after";
			} else {
				targetElement = findContentArea() || document.body.firstChild;
				position = "before";
			}
		}

		return { element: targetElement, position };
	}

	function placeChapterNovelControls(novelControls, controlsConfig = {}) {
		if (!novelControls) return;

		const existing = document.getElementById("rg-chapter-novel-controls");
		if (existing && existing !== novelControls) {
			const wrapper = existing.closest(".rg-gemini-controls");
			if (wrapper) {
				const maybeLabel = wrapper.previousElementSibling;
				if (
					maybeLabel &&
					maybeLabel.classList.contains("rg-gemini-controls-label")
				) {
					maybeLabel.remove();
				}
				wrapper.remove();
			} else {
				existing.remove();
			}
		}

		const insertion = resolveNovelControlsInsertion(controlsConfig);
		if (insertion?.element) {
			let target = insertion.element;
			let position = insertion.position;

			if (controlsConfig.wrapInDefinitionList) {
				const labelText = controlsConfig.dlLabel || "Gemini";
				const dtLabel = document.createElement("dt");
				dtLabel.className = "rg-gemini-controls-label";
				dtLabel.textContent = labelText;

				const ddWrapper = document.createElement("dd");
				ddWrapper.className = "rg-gemini-controls";
				novelControls.classList.add("rg-dl-embedded");
				ddWrapper.appendChild(novelControls);

				if (position === "after" || position === "afterend") {
					insertAtPosition(target, dtLabel, "after");
					insertAtPosition(dtLabel, ddWrapper, "after");
				} else if (position === "beforeend" || position === "append") {
					target.appendChild(dtLabel);
					target.appendChild(ddWrapper);
				} else {
					insertAtPosition(target, dtLabel, position || "before");
					insertAtPosition(dtLabel, ddWrapper, "after");
				}
			} else {
				insertAtPosition(target, novelControls, position);
			}
		}
	}

	async function createChapterPageNovelControls(controlsConfig = {}) {
		const handlerType = getHandlerType();

		// Only for CHAPTER_EMBEDDED handlers on chapter pages
		if (handlerType !== HANDLER_TYPES.CHAPTER_EMBEDDED) {
			return null;
		}

		if (!currentHandler?.isChapterPage?.()) {
			return null;
		}

		// Load novel library if needed
		if (!novelLibrary) {
			await loadNovelLibrary();
		}

		if (!novelLibrary) {
			debugLog("Novel library not available for chapter page controls");
			return null;
		}

		// Get novel ID and check if it exists in library
		const novelId = getNovelIdFromCurrentPage();
		const existingNovels = await novelLibrary.getRecentNovels(0);
		const existingNovel = novelId
			? existingNovels.find((n) => n.id === novelId)
			: null;

		// Create the compact controls container
		const controlsContainer = document.createElement("div");
		controlsContainer.id = "rg-chapter-novel-controls";
		controlsContainer.style.cssText = `
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 8px;
			padding: 10px 12px;
			margin: 10px 0;
			background: linear-gradient(135deg, #1a2540 0%, #16213e 100%);
			border: 1px solid #2a4b8d;
			border-radius: 6px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		`;

		if (controlsConfig.wrapInDefinitionList) {
			controlsContainer.style.justifyContent = "center";
			controlsContainer.style.width = "100%";
			controlsContainer.style.textAlign = "center";
		}

		// Allow handler to customize styling (e.g., AO3/FanFiction specific palettes)
		if (controlsConfig?.customStyles) {
			Object.assign(controlsContainer.style, controlsConfig.customStyles);
		}

		// Status indicator
		const statusBadge = document.createElement("span");
		statusBadge.style.cssText = `
			padding: 4px 8px;
			background: ${existingNovel ? "#1b5e20" : "#424242"};
			color: white;
			border-radius: 4px;
			font-size: 11px;
			font-weight: 600;
		`;
		statusBadge.textContent = existingNovel
			? "📚 In Library"
			: "📖 Not Saved";
		controlsContainer.appendChild(statusBadge);

		// Separator
		const separator = document.createElement("span");
		separator.textContent = "•";
		separator.style.cssText = "color: #666; margin: 0 4px;";
		controlsContainer.appendChild(separator);

		// Button style helper
		const createCompactButton = (text, icon, color, onClick) => {
			const btn = document.createElement("button");
			btn.innerHTML = `${icon} ${text}`;
			btn.style.cssText = `
				padding: 6px 10px;
				background: ${color};
				color: white;
				border: none;
				border-radius: 4px;
				cursor: pointer;
				font-weight: 600;
				font-size: 12px;
				transition: all 0.2s ease;
			`;
			btn.addEventListener("mouseover", () => {
				btn.style.filter = "brightness(1.1)";
			});
			btn.addEventListener("mouseout", () => {
				btn.style.filter = "brightness(1)";
			});
			btn.addEventListener("click", onClick);
			return btn;
		};

		// Add/Update button
		const addUpdateBtn = createCompactButton(
			existingNovel ? "Update" : "Add to Library",
			existingNovel ? "🔄" : "➕",
			existingNovel ? "#00695c" : "#1976d2",
			async () => {
				await handleNovelAddUpdate();
				// Refresh the controls
				const oldControls = document.getElementById(
					"rg-chapter-novel-controls"
				);
				if (oldControls) {
					const newControls = await createChapterPageNovelControls();
					if (newControls) {
						oldControls.replaceWith(newControls);
					}
				}
			}
		);
		controlsContainer.appendChild(addUpdateBtn);

		// Reading status dropdown (if novel exists)
		if (existingNovel) {
			const statusSelect = document.createElement("select");
			statusSelect.id = "rg-chapter-reading-status";
			statusSelect.style.cssText = `
				padding: 6px 8px;
				background: #424242;
				color: white;
				border: 1px solid #666;
				border-radius: 4px;
				cursor: pointer;
				font-size: 12px;
			`;

			const statusOptions = getReadingStatusOptions();

			statusOptions.forEach((opt) => {
				const option = document.createElement("option");
				option.value = opt.value;
				option.textContent = opt.label;
				if (existingNovel.readingStatus === opt.value) {
					option.selected = true;
				}
				statusSelect.appendChild(option);
			});

			statusSelect.addEventListener("change", async (e) => {
				await handleReadingStatusChange(e.target.value);
			});

			controlsContainer.appendChild(statusSelect);

			// Remove button
			const removeBtn = createCompactButton(
				"Remove",
				"🗑️",
				"#c62828",
				async () => {
					await handleNovelDelete();
					// Refresh the controls
					const oldControls = document.getElementById(
						"rg-chapter-novel-controls"
					);
					if (oldControls) {
						const newControls =
							await createChapterPageNovelControls();
						if (newControls) {
							oldControls.replaceWith(newControls);
						}
					}
				}
			);
			controlsContainer.appendChild(removeBtn);
		}

		// Open Library button
		const libraryBtn = createCompactButton(
			"Library",
			"📚",
			"#7b1fa2",
			() => {
				const libraryUrl = browser.runtime.getURL(
					"library/library.html"
				);
				window.open(libraryUrl, "_blank");
			}
		);
		controlsContainer.appendChild(libraryBtn);

		return controlsContainer;
	}

	// Function to inject UI elements (buttons, status area)
	function injectUI() {
		const contentArea = findContentArea();
		if (!contentArea) {
			console.warn(
				"Ranobe Gemini: Target element for UI injection not found."
			);
			return;
		}

		// Check if UI already injected
		if (document.getElementById("gemini-controls")) {
			debugLog("Ranobe Gemini: UI already injected.");
			return;
		}

		// Get site-specific enhancement buttons from handler (if available)
		const siteEnhancements =
			currentHandler &&
			typeof currentHandler.getSiteSpecificEnhancements === "function"
				? currentHandler.getSiteSpecificEnhancements()
				: [];

		// Create version switcher container (right-aligned, above main controls) if we have site enhancements
		let siteEnhancementsContainer = null;
		if (siteEnhancements && siteEnhancements.length > 0) {
			siteEnhancementsContainer = document.createElement("div");
			siteEnhancementsContainer.id = "gemini-site-enhancements-container";
			siteEnhancementsContainer.style.cssText = `
			display: flex;
			justify-content: flex-end;
			gap: 8px;
			margin-bottom: 8px;
		`;
			siteEnhancements.forEach((btn) => {
				siteEnhancementsContainer.appendChild(btn);
			});
		}
		const controlsContainer = document.createElement("div");
		controlsContainer.id = "gemini-controls";
		controlsContainer.style.marginBottom = "10px"; // Add some space below buttons

		// Apply mobile-specific class if on a mobile device
		if (isMobileDevice) {
			controlsContainer.classList.add("mobile-view");
		}

		const enhanceButton = createEnhanceButton();
		const summarizeButton = createSummarizeButton();
		const shortSummarizeButton = createShortSummarizeButton();

		const statusDiv = document.createElement("div");
		statusDiv.id = "gemini-status";
		statusDiv.style.marginTop = "5px";

		const summaryDisplayLong = document.createElement("div");
		summaryDisplayLong.id = "summary-display-long";
		summaryDisplayLong.style.marginTop = "10px";
		summaryDisplayLong.style.padding = "10px";
		summaryDisplayLong.style.display = "none"; // Initially hidden

		const summaryDisplayShort = document.createElement("div");
		summaryDisplayShort.id = "summary-display-short";
		summaryDisplayShort.style.marginTop = "10px";
		summaryDisplayShort.style.padding = "10px";
		summaryDisplayShort.style.display = "none"; // Initially hidden

		// Apply mobile-specific class if on a mobile device
		if (isMobileDevice) {
			summaryDisplayLong.classList.add("mobile-view");
			summaryDisplayShort.classList.add("mobile-view");
		}

		controlsContainer.appendChild(enhanceButton);
		controlsContainer.appendChild(summarizeButton);
		controlsContainer.appendChild(shortSummarizeButton);
		controlsContainer.appendChild(statusDiv);

		// Get optimal insertion point based on the handler
		let insertionPoint = contentArea;
		let insertionPosition = "before";

		if (currentHandler) {
			const uiInfo = currentHandler.getUIInsertionPoint(contentArea);
			insertionPoint = uiInfo.element || contentArea;
			insertionPosition = uiInfo.position || "before";
		}

		// Insert elements based on the recommended position
		if (
			insertionPosition === "before" ||
			insertionPosition === "beforebegin"
		) {
			if (siteEnhancementsContainer) {
				insertionPoint.parentNode.insertBefore(
					siteEnhancementsContainer,
					insertionPoint
				);
			}
			insertionPoint.parentNode.insertBefore(
				controlsContainer,
				insertionPoint
			);
			insertionPoint.parentNode.insertBefore(
				summaryDisplayLong,
				insertionPoint
			);
			insertionPoint.parentNode.insertBefore(
				summaryDisplayShort,
				insertionPoint
			);
		} else if (
			insertionPosition === "after" ||
			insertionPosition === "afterend"
		) {
			if (siteEnhancementsContainer) {
				insertionPoint.parentNode.insertBefore(
					siteEnhancementsContainer,
					insertionPoint.nextSibling
				);
			}
			insertionPoint.parentNode.insertBefore(
				controlsContainer,
				siteEnhancementsContainer
					? siteEnhancementsContainer.nextSibling
					: insertionPoint.nextSibling
			);
			insertionPoint.parentNode.insertBefore(
				summaryDisplayLong,
				controlsContainer.nextSibling
			);
			insertionPoint.parentNode.insertBefore(
				summaryDisplayShort,
				controlsContainer.nextSibling
			);
		} else if (
			insertionPosition === "prepend" ||
			insertionPosition === "afterbegin"
		) {
			if (versionSwitcherContainer) {
				insertionPoint.prepend(versionSwitcherContainer);
			}
			insertionPoint.prepend(controlsContainer);
			insertionPoint.prepend(summaryDisplay);
		} else if (
			insertionPosition === "append" ||
			insertionPosition === "beforeend"
		) {
			if (versionSwitcherContainer) {
				insertionPoint.appendChild(versionSwitcherContainer);
			}
			insertionPoint.appendChild(controlsContainer);
			insertionPoint.appendChild(summaryDisplay);
		} else {
			// Default fallback to before
			insertionPoint.parentNode.insertBefore(
				controlsContainer,
				insertionPoint
			);
			insertionPoint.parentNode.insertBefore(
				summaryDisplay,
				insertionPoint
			);
		}

		debugLog(
			`Ranobe Gemini: UI injected successfully for ${
				isMobileDevice ? "mobile" : "desktop"
			} view.`
		);

		// Add the initial word count display
		addInitialWordCountDisplay(contentArea);

		// Add novel controls for CHAPTER_EMBEDDED type sites (like FanFiction.net)
		// These are added asynchronously after main UI
		setTimeout(async () => {
			try {
				const controlsConfig =
					currentHandler?.getNovelControlsConfig?.() || {};
				const novelControls = await createChapterPageNovelControls(
					controlsConfig
				);
				if (novelControls) {
					placeChapterNovelControls(novelControls, controlsConfig);
					debugLog(
						"Ranobe Gemini: Novel controls added for chapter page"
					);
				}
			} catch (err) {
				debugLog("Could not add novel controls:", err);
			}
		}, 100);

		// Keep controls alive in case the site re-renders or strips injected nodes
		startUIKeepAlive();
	}

	let uiKeepAliveTimer = null;
	function startUIKeepAlive() {
		if (uiKeepAliveTimer) return;
		uiKeepAliveTimer = setInterval(async () => {
			// Re-inject main controls if the host page wipes them out
			if (!document.getElementById("gemini-controls")) {
				console.warn(
					"Ranobe Gemini: controls missing, re-injecting UI"
				);
				injectUI();
				return;
			}

			// Recreate chapter-level novel controls if they disappear
			if (
				currentHandler?.isChapterPage?.() &&
				!document.getElementById("rg-chapter-novel-controls")
			) {
				try {
					const controlsConfig =
						currentHandler?.getNovelControlsConfig?.() || {};
					const novelControls = await createChapterPageNovelControls(
						controlsConfig
					);
					if (novelControls) {
						placeChapterNovelControls(
							novelControls,
							controlsConfig
						);
					}
				} catch (heartbeatError) {
					debugLog(
						"Ranobe Gemini: keep-alive could not re-add controls",
						heartbeatError
					);
				}
			}
		}, 15000);
	}

	// Automatically extract content once the page is loaded
	async function autoExtractContent() {
		const contentArea = findContentArea();

		if (contentArea) {
			debugLog("Auto-extracting content...");
			const result = extractContent();

			if (result.found) {
				debugLog("Content automatically extracted:");
				debugLog(`Title: ${result.title}`);
				debugLog(`Content length: ${result.text.length} characters`);
				autoExtracted = true;

				// Update chapter progression when content is loaded
				await updateChapterProgression();

				// Check if auto-enhance is enabled for this novel
				if (novelLibrary) {
					try {
						const novel = await novelLibrary.getNovelByUrl(
							window.location.href
						);
						if (novel && novel.autoEnhance === true) {
							debugLog(
								"🚀 Auto-enhance enabled for this novel, starting enhancement..."
							);
							// Wait a bit for page to stabilize
							setTimeout(() => {
								handleEnhanceClick();
							}, 1000);
						}
					} catch (err) {
						debugLog("Could not check auto-enhance setting:", err);
					}
				}
			}
		}
	}
	// Extract content using the appropriate handler
	function extractContent() {
		// Check if content area has enhanced content showing
		const contentArea = findContentArea();
		if (contentArea) {
			const isShowingEnhanced =
				contentArea.getAttribute("data-showing-enhanced") === "true";
			const originalContent = contentArea.getAttribute(
				"data-original-content"
			);

			// If showing enhanced, extract from stored original content
			// WITHOUT modifying the DOM (which would destroy event listeners)
			if (isShowingEnhanced && originalContent) {
				// Create a temporary element to parse the original content
				// This avoids modifying the actual DOM
				const tempDiv = document.createElement("div");
				tempDiv.innerHTML = originalContent;

				// Extract from the temporary element
				let result;
				if (
					currentHandler &&
					typeof currentHandler.extractFromElement === "function"
				) {
					// If handler has extractFromElement, use it
					result = currentHandler.extractFromElement(tempDiv);
				} else if (currentHandler) {
					// Fallback: temporarily use the handler's extractContent
					// by extracting text from our temp div
					const paragraphs = tempDiv.querySelectorAll("p");
					if (paragraphs.length > 0) {
						const text = Array.from(paragraphs)
							.map((p) => p.innerText)
							.join("\n\n");
						result = {
							found: true,
							title: document.title,
							text: text,
							selector: "extracted from cached original",
						};
					} else {
						result = {
							found: true,
							title: document.title,
							text: tempDiv.innerText || tempDiv.textContent,
							selector:
								"extracted from cached original (no paragraphs)",
						};
					}
				} else {
					result = {
						found: true,
						title: document.title,
						text: tempDiv.innerText || tempDiv.textContent,
						selector: "generic extraction from cached original",
					};
				}
				return result;
			}
		}

		// Normal extraction path
		if (currentHandler) {
			return currentHandler.extractContent();
		}

		// Otherwise use generic extraction method
		return extractContentGeneric();
	}

	// Handle click event for Summarize button
	async function handleSummarizeClick(isShort = false) {
		const summarizeButton = isShort
			? document.getElementById("short-summarize-button")
			: document.getElementById("summarize-button");
		const summaryDisplayLong = document.getElementById(
			"summary-display-long"
		);
		const summaryDisplayShort = document.getElementById(
			"summary-display-short"
		);
		const statusDiv = document.getElementById("gemini-status");

		if (!summarizeButton || !statusDiv) return;

		const summaryDisplay = isShort
			? summaryDisplayShort
			: summaryDisplayLong;

		const summaryType = isShort ? "Short" : "Long";
		const originalButtonText = summarizeButton.textContent;

		try {
			// Wake up background worker first
			summarizeButton.disabled = true;
			summarizeButton.textContent = "Waking up AI...";
			statusDiv.textContent = "Waking up AI service...";

			const isReady = await wakeUpBackgroundWorker();
			if (!isReady) {
				throw new Error(
					"Background service is not responding. Please try summarizing again."
				);
			}

			// Now proceed with summarization
			summarizeButton.textContent = "Summarizing...";
			statusDiv.textContent = `Extracting content for ${summaryType.toLowerCase()} summary...`;
			if (summaryDisplay) {
				summaryDisplay.style.display = "block"; // Show the specific display area
				// Do not clear the other summary display - keep long and short independent
				summaryDisplay.textContent = `Generating ${summaryType.toLowerCase()} summary...`;
			}
			const extractedContent = extractContent();
			const { title, text: content } = extractedContent;

			if (!content) {
				throw new Error("Could not extract chapter content.");
			}

			debugLog(
				`Extracted ${
					content.length
				} characters for ${summaryType.toLowerCase()} summarization`
			);
			statusDiv.textContent = `Sending content to Gemini for ${summaryType.toLowerCase()} summarization...`;

			// Get model info to determine if we need to split the content
			// Using sendMessageWithRetry to handle service worker sleep issues
			const modelInfoResponse = await sendMessageWithRetry({
				action: "getModelInfo",
			});

			const maxContextSize = modelInfoResponse.maxContextSize || 16000; // Default if not available
			debugLog(
				`Model max context size for summarization: ${maxContextSize}`
			);

			// Get approximate token count (rough estimate: 4 chars per token)
			const estimatedTokenCount = Math.ceil(content.length / 4);
			debugLog(
				`Estimated token count for summarization: ${estimatedTokenCount}`
			);

			let summary = "";

			// For short summaries, we can process larger content as a single request
			// because the output is much smaller
			const contextThreshold = isShort
				? maxContextSize * 0.8
				: maxContextSize * 0.6;

			// Check if content exceeds the threshold
			if (estimatedTokenCount > contextThreshold) {
				// Process large content in parts
				summary = await summarizeLargeContentInParts(
					title,
					content,
					maxContextSize,
					statusDiv,
					isShort
				);
			} else {
				// Process as a single chunk - use appropriate action
				const action = isShort
					? "shortSummarizeWithGemini"
					: "summarizeWithGemini";
				// Using sendMessageWithRetry to handle service worker sleep issues
				const response = await sendMessageWithRetry({
					action: action,
					title: title,
					content: content,
				});

				if (response && response.success && response.summary) {
					summary = response.summary;
				} else {
					// Check for API key missing error
					const errorMessage =
						response?.error || "Failed to generate summary.";
					if (errorMessage.includes("API key is missing")) {
						showStatusMessage(
							"API key is missing. Opening settings page...",
							"error"
						);
						// Open popup for API key input
						browser.runtime.sendMessage({ action: "openPopup" });

						// Show appropriate message in the target display
						if (summaryDisplay) {
							summaryDisplay.textContent =
								"API key is missing. Please add your Gemini API key in the settings.";
						}
						throw new Error("API key is missing");
					} else {
						throw new Error(errorMessage);
					}
				}
			}

			// Display the summary
			if (summary) {
				if (summaryDisplay) {
					// Clear only the target summary display area
					while (summaryDisplay.firstChild) {
						summaryDisplay.removeChild(summaryDisplay.firstChild);
					}

					const summaryHeader = document.createElement("h3");
					summaryHeader.textContent = `${summaryType} Chapter Summary:`;
					summaryDisplay.appendChild(summaryHeader);

					// Create a container for the summary text
					const summaryContentContainer =
						document.createElement("div");
					summaryContentContainer.className = "summary-text-content";

					// Use the new paragraph extraction function to preserve structure
					const paragraphs = extractParagraphsFromHtml(summary);
					debugLog(
						"[Render] Extracted paragraphs for summary:",
						paragraphs.length
					);

					if (paragraphs.length > 0) {
						// Render each paragraph as a separate <p> element
						paragraphs.forEach((paragraphText) => {
							const p = document.createElement("p");
							p.textContent = paragraphText;
							p.style.marginBottom = "1em";
							p.style.lineHeight = "1.6";
							summaryContentContainer.appendChild(p);
						});
					} else {
						// Fallback - just display as text
						const cleanSummary = stripHtmlTags(summary);
						summaryContentContainer.textContent = cleanSummary;
					}

					// Apply font size setting to summary content
					if (currentFontSize && currentFontSize !== 100) {
						summaryContentContainer.style.fontSize = `${currentFontSize}%`;
					}

					summaryDisplay.appendChild(summaryContentContainer);
				}
				statusDiv.textContent = "Summary generated successfully!";
			} else {
				throw new Error("Failed to generate summary.");
			}
		} catch (error) {
			debugError("Error in handleSummarizeClick:", error);

			// Special handling for API key missing error - already handled above
			if (error.message && error.message.includes("API key is missing")) {
				statusDiv.textContent =
					"API key is missing. Please check the settings.";
			} else {
				// For other errors, display the error message
				statusDiv.textContent = `Error: ${error.message}`;
				if (summaryDisplay) {
					summaryDisplay.textContent = "Failed to generate summary.";
					summaryDisplay.style.display = "block"; // Keep display visible to show error
				}
			}
		} finally {
			summarizeButton.disabled = false;
			summarizeButton.textContent = originalButtonText; // restore original label
			// Optionally hide status message after a delay (except for API key missing)
			setTimeout(() => {
				if (
					statusDiv.textContent.includes("Summary generated") &&
					!statusDiv.textContent.includes("API key is missing")
				) {
					statusDiv.textContent = "";
				}
			}, 5000);
		}
	}

	// Process large content by splitting into parts
	async function summarizeLargeContentInParts(
		title,
		content,
		maxContextSize,
		statusDiv,
		isShort = false
	) {
		const summaryType = isShort ? "short" : "long";
		debugLog(
			`Content is large, creating ${summaryType} summary in multiple parts...`
		);
		if (statusDiv) {
			statusDiv.textContent = `Content is large, summarizing in multiple parts...`;
		}

		// Approximately how many characters per part (rough estimate: 4 chars per token, using 60% of context size)
		const charsPerPart = Math.floor(maxContextSize * 0.6 * 4);

		// Use shared content splitting helper
		const chunkingModule = await loadChunkingUtils();
		const splitContentForProcessing =
			chunkingModule?.splitContentForProcessing;
		if (!splitContentForProcessing) {
			console.warn(
				"Chunking utils unavailable, summarizing content without splitting."
			);
		}

		const parts = splitContentForProcessing?.(content, charsPerPart, {
			logPrefix: "[splitContentForProcessing]",
		}) || [content];
		debugLog(
			`Split content into ${parts.length} parts for ${summaryType} summarization`
		);

		// Use the appropriate action based on isShort
		const action = isShort
			? "shortSummarizeWithGemini"
			: "summarizeWithGemini";

		// Process each part sequentially
		let allPartSummaries = [];
		let currentPartNum = 1;

		for (const part of parts) {
			// Update status
			if (statusDiv) {
				statusDiv.textContent = `Summarizing part ${currentPartNum} of ${parts.length}...`;
			}

			debugLog(
				`Creating ${summaryType} summary for part ${currentPartNum}/${parts.length} (${part.length} characters)`
			);

			// Create a part-specific title
			const partTitle = `${title} (Part ${currentPartNum}/${parts.length})`;

			try {
				// Process this part using sendMessageWithRetry for service worker resilience
				const response = await sendMessageWithRetry({
					action: action,
					title: partTitle,
					content: part,
					isPart: true,
					partInfo: {
						current: currentPartNum,
						total: parts.length,
					},
				});

				if (response && response.success && response.summary) {
					debugLog(
						`Successfully summarized part ${currentPartNum}/${parts.length}`
					);
					allPartSummaries.push(response.summary);
				} else {
					debugError(
						`Error summarizing part ${currentPartNum}:`,
						response?.error || "Unknown error"
					);
					// Continue with other parts even if one fails
				}
			} catch (error) {
				debugError(`Error summarizing part ${currentPartNum}:`, error);
				// Continue with other parts even if one fails
			}

			currentPartNum++;
		}

		// If we have multiple part summaries, combine them
		if (allPartSummaries.length > 1) {
			// Try to combine the summaries with an additional API call
			try {
				if (statusDiv) {
					statusDiv.textContent = "Combining part summaries...";
				}

				// Join the part summaries with clear separators
				const combinedPartSummaries = allPartSummaries
					.map((summary, index) => {
						return `Part ${index + 1} summary:\n${summary}`;
					})
					.join("\n\n");

				// Make a final API call to combine the summaries using retry wrapper
				const finalResponse = await sendMessageWithRetry({
					action: "combinePartialSummaries",
					title: title,
					partSummaries: combinedPartSummaries,
					partCount: parts.length,
					isShort: isShort,
				});

				if (
					finalResponse &&
					finalResponse.success &&
					finalResponse.combinedSummary
				) {
					return finalResponse.combinedSummary;
				} else {
					// If the combination failed, just join the summaries with separators
					debugLog("Using fallback approach to combine summaries");
					return (
						`Complete summary of "${title}":\n\n` +
						allPartSummaries.join("\n\n")
					);
				}
			} catch (error) {
				// If there's an error combining, just join them
				debugError("Error combining summaries:", error);
				return (
					`Complete summary of "${title}":\n\n` +
					allPartSummaries.join("\n\n")
				);
			}
		} else if (allPartSummaries.length === 1) {
			// Just return the single summary if there's only one part
			return allPartSummaries[0];
		} else {
			throw new Error("Failed to generate any part summaries");
		}
	}

	// Handle click event for Enhance button
	async function handleEnhanceClick() {
		// Check cache first
		if (storageManager && isCachedContent) {
			const button = document.querySelector(".gemini-enhance-btn");
			if (!button) return;
			const originalText = button.textContent;
			if (!originalText) return;

			if (originalText.includes("Regenerate")) {
				// Clear cache before regeneration but continue to process
				await storageManager.removeEnhancedContent(
					window.location.href
				);
				isCachedContent = false;
				// Update button text immediately
				button.textContent = "✨ Enhance with Gemini";
				const contentArea = findContentArea();
				if (contentArea) {
					const isShowingEnhanced =
						contentArea.getAttribute("data-showing-enhanced") ===
						"true";
					const originalContent = contentArea.getAttribute(
						"data-original-content"
					);
					if (isShowingEnhanced && originalContent) {
						contentArea.innerHTML = originalContent;
						contentArea.setAttribute(
							"data-showing-enhanced",
							"false"
						);
						const banner = contentArea.querySelector(
							".gemini-enhanced-banner"
						);
						if (banner) banner.remove();
					}
				}
			} else {
				// Try loading cached content
				try {
					const cachedData = await storageManager.loadEnhancedContent(
						window.location.href
					);
					if (cachedData && cachedData.enhancedContent) {
						showStatusMessage(
							"Loading cached enhanced content...",
							"info"
						);
						replaceContentWithEnhancedVersion(cachedData);
						if (button) {
							button.textContent = originalText;
							button.disabled = false;
							button.classList.remove("loading");
						}
						return;
					} else {
						showStatusMessage(
							"Cached enhanced content is invalid or missing.",
							"error"
						);
					}
				} catch (err) {
					showStatusMessage(
						"Failed to load cached enhanced content.",
						"error"
					);
				}
			}
		}

		// Extract content
		const extractedContent = extractContent();
		if (!extractedContent.found) {
			showStatusMessage("No content found to process", "error");
			return;
		}

		const button = document.querySelector(".gemini-enhance-btn");
		if (!button) return;
		const originalButtonText = button.textContent;
		try {
			// Disable UI and show status
			button.textContent = "Waking up AI...";
			button.disabled = true;
			showStatusMessage("Waking up AI service...", "info");

			// Wake up background worker with retry logic
			const isReady = await wakeUpBackgroundWorker();
			if (!isReady) {
				throw new Error(
					"Background service is not responding. Please try again."
				);
			}

			button.textContent = "Processing...";
			showStatusMessage("Processing content with Gemini AI...", "info");

			// Load config values from storage to match background's chunking
			// NOTE: We use chunkSize as BOTH the threshold and chunk size (simplified)
			const settings = await browser.storage.local.get([
				"chunkingEnabled",
				"chunkSize",
				"useEmoji",
				"formatGameStats",
				"centerSceneHeadings",
			]);
			const chunkingEnabled = settings.chunkingEnabled !== false;
			const chunkSize = settings.chunkSize || 20000; // Same default as background
			const chunkThreshold = chunkSize; // Use same value for threshold (simplified)
			const useEmoji = settings.useEmoji === true;
			formattingOptions.useEmoji = useEmoji;
			formattingOptions.formatGameStats =
				settings.formatGameStats !== false; // default true
			formattingOptions.centerSceneHeadings =
				settings.centerSceneHeadings !== false; // default true

			// Load chunking helpers (may fall back to single-pass if unavailable)
			const chunkingModule = chunkingEnabled
				? await loadChunkingUtils()
				: null;
			const splitContentForProcessing =
				chunkingModule?.splitContentForProcessing;
			const minChunkLength = chunkingModule?.MIN_CHUNK_LENGTH || 200;
			if (chunkingEnabled && !splitContentForProcessing) {
				showStatusMessage(
					"Chunking helper unavailable. Proceeding without chunking.",
					"warning",
					3000
				);
			}

			// If chunking is enabled and content is large enough, prepare progressive containers
			const contentArea = findContentArea();
			if (!contentArea)
				throw new Error("Unable to find content area for enhancement");

			let shouldChunk =
				chunkingEnabled &&
				splitContentForProcessing &&
				extractedContent.text.length > chunkThreshold;

			if (shouldChunk) {
				let parts;
				try {
					parts = splitContentForProcessing(
						extractedContent.text,
						chunkSize,
						{ logPrefix: "[splitContentForProcessing]" }
					);
				} catch (splitError) {
					debugError(
						"Failed to split content for chunking:",
						splitError
					);
					showStatusMessage(
						"Chunking failed; proceeding without chunking.",
						"warning",
						4000
					);
					shouldChunk = false;
				}

				if (shouldChunk) {
					parts = normalizeChunkParts(parts, minChunkLength);
				}

				if (!parts || parts.length <= 1) {
					shouldChunk = false;
				}

				if (shouldChunk) {
					const originalHTML = contentArea.innerHTML;
					try {
						// Store original HTML for restoration/caching
						contentArea.setAttribute(
							"data-original-html",
							originalHTML
						);
						contentArea.setAttribute(
							"data-original-text",
							extractedContent.text
						);
						contentArea.setAttribute(
							"data-total-chunks",
							parts.length
						);

						// Split HTML into chunks that match text chunks (preserves original formatting)
						let htmlChunks;
						try {
							htmlChunks = splitHTMLIntoChunks(
								contentArea,
								parts
							);
						} catch (htmlSplitError) {
							debugError(
								"Failed to split HTML into chunks:",
								htmlSplitError
							);
							htmlChunks = parts.map((p) =>
								formatOriginalChunkContent(p)
							);
						}

						// Ensure htmlChunks aligns with parts length
						if (
							!Array.isArray(htmlChunks) ||
							htmlChunks.length === 0
						) {
							htmlChunks = parts.map((p) =>
								formatOriginalChunkContent(p)
							);
						}
						while (htmlChunks.length < parts.length) {
							htmlChunks.push(
								formatOriginalChunkContent(
									parts[htmlChunks.length]
								)
							);
						}
						if (htmlChunks.length > parts.length) {
							htmlChunks = htmlChunks.slice(0, parts.length);
						}

						// Create new structure with inline chunk replacement:
						// For each chunk, we show a banner + content area that will be replaced in place
						const chunkedContentContainer =
							document.createElement("div");
						chunkedContentContainer.id = "gemini-chunked-content";
						chunkedContentContainer.style.width = "100%";

						for (let i = 0; i < parts.length; i++) {
							const chunkWrapper = document.createElement("div");
							chunkWrapper.className = "gemini-chunk-wrapper";
							chunkWrapper.setAttribute("data-chunk-index", i);

							// Add chunk banner (first chunk starts as 'processing', rest as 'pending')
							const initialStatus =
								i === 0 ? "processing" : "pending";
							const banner = createChunkBanner(
								i,
								parts.length,
								initialStatus
							);
							chunkWrapper.appendChild(banner);

							// Add chunk content area with original content (preserving HTML structure)
							const chunkContent = document.createElement("div");
							chunkContent.className = "gemini-chunk-content";
							chunkContent.setAttribute("data-chunk-index", i);
							chunkContent.setAttribute(
								"data-original-chunk-content",
								parts[i]
							);
							// Store original HTML chunk for show/hide toggle
							chunkContent.setAttribute(
								"data-original-chunk-html",
								htmlChunks[i] ||
									formatOriginalChunkContent(parts[i])
							);
							// Display original content with preserved HTML structure
							chunkContent.innerHTML =
								htmlChunks[i] ||
								formatOriginalChunkContent(parts[i]);
							chunkWrapper.appendChild(chunkContent);

							chunkedContentContainer.appendChild(chunkWrapper);
						}

						// Clear and replace content area
						contentArea.innerHTML = "";
						contentArea.appendChild(chunkedContentContainer);

						debugLog(
							`Prepared ${parts.length} chunks for inline replacement with preserved HTML`
						);
					} catch (prepError) {
						debugError(
							"Failed to prepare chunked view:",
							prepError
						);
						// Restore original content and fall back to non-chunked processing
						contentArea.innerHTML = originalHTML;
						contentArea.removeAttribute("data-original-html");
						contentArea.removeAttribute("data-original-text");
						contentArea.removeAttribute("data-total-chunks");
						shouldChunk = false;
						showStatusMessage(
							"Could not prepare chunked content. Proceeding without chunking.",
							"warning",
							4000
						);
					}
				}
			}
			// Get novel-specific custom prompt if available
			let novelCustomPrompt = "";
			if (novelLibrary) {
				try {
					const novel = await novelLibrary.getNovelByUrl(
						window.location.href
					);
					if (novel && novel.customPrompt) {
						novelCustomPrompt = novel.customPrompt;
						debugLog(
							`Using novel-specific prompt for: ${novel.title}`
						);
					}
				} catch (err) {
					debugLog("Could not get novel custom prompt:", err);
				}
			}

			// Combine site-specific and novel-specific prompts
			let combinedPrompt = currentHandler
				? currentHandler.getSiteSpecificPrompt()
				: "";
			if (novelCustomPrompt) {
				combinedPrompt = combinedPrompt
					? `${combinedPrompt}\n\n${novelCustomPrompt}`
					: novelCustomPrompt;
			}

			// Send content to background for processing (background will stream chunkProcessed messages)
			// Using sendMessageWithRetry to handle service worker sleep issues
			const response = await sendMessageWithRetry({
				action: "processWithGemini",
				title: extractedContent.title,
				content: extractedContent.text,
				siteSpecificPrompt: combinedPrompt,
				useEmoji: useEmoji,
			});

			// Restore button state
			button.textContent = originalButtonText;
			button.disabled = false;

			if (response && response.success) {
				// If background returned a combined result (non-chunked), handle it here
				// Skip if we've already been handling chunks progressively
				const enhancedContainer = document.getElementById(
					"gemini-enhanced-container"
				);
				const hasProgressiveChunks =
					enhancedContainer &&
					enhancedContainer.querySelector(".gemini-chunk");

				if (
					response.result &&
					response.result.enhancedContent &&
					!hasProgressiveChunks
				) {
					replaceContentWithEnhancedVersion(response.result);
				} else if (hasProgressiveChunks) {
					debugLog(
						"Skipping replaceContentWithEnhancedVersion - chunks already displayed progressively"
					);
				}
			} else if (!response || !response.success) {
				const errorMessage = response?.error || "Unknown error";

				// Handle API key missing scenario
				if (
					response?.needsApiKey ||
					errorMessage.includes("API key is missing")
				) {
					showStatusMessage(
						"⚠️ API key is missing. Please configure it in the extension popup.",
						"error"
					);
					// Try to open the popup
					try {
						await browser.runtime.sendMessage({
							action: "openPopup",
						});
					} catch (popupError) {
						console.warn(
							"Could not open popup automatically:",
							popupError
						);
						showStatusMessage(
							"⚠️ API key is missing. Please click the extension icon to configure it.",
							"error",
							10000 // Show for 10 seconds
						);
					}
				} else {
					showStatusMessage(
						"Error processing with Gemini: " + errorMessage,
						"error"
					);
				}
			}
		} catch (error) {
			debugError("Error in handleEnhanceClick:", error);
			showStatusMessage(`Error: ${error.message}`, "error");
			if (button) {
				button.textContent = "✨ Enhance with Gemini";
				button.disabled = false;
			}
		}
	}

	// Updated function to replace content with Gemini-enhanced version
	async function replaceContentWithEnhancedVersion(enhancedContent) {
		const contentArea = findContentArea();
		if (!contentArea) {
			showStatusMessage(
				"Unable to find content area for replacement",
				"error"
			);
			return false;
		}

		try {
			const scrollPosition = window.scrollY;

			// Determine if this is cached content based on the presence of a timestamp
			// (which is only added when saving to cache) to distinguish from fresh API responses
			const isFromCache =
				typeof enhancedContent === "object" &&
				enhancedContent.originalContent &&
				enhancedContent.timestamp; // Timestamp indicates it's from cache

			// For fresh enhancements, always use contentArea.innerHTML to preserve HTML structure
			// For cached content, use the stored originalContent (which was saved with HTML)
			const originalContent = isFromCache
				? enhancedContent.originalContent
				: contentArea.innerHTML;
			const originalText = isFromCache
				? stripHtmlTags(enhancedContent.originalContent)
				: contentArea.innerText || contentArea.textContent;

			// Debug logging to verify HTML structure preservation
			debugLog(
				"replaceContentWithEnhancedVersion: isFromCache =",
				isFromCache,
				", originalContent has <p> tags =",
				/<p[\s>]/i.test(originalContent),
				", originalContent length =",
				originalContent?.length || 0
			);

			const modelInfo =
				typeof enhancedContent === "object" &&
				(enhancedContent.modelInfo || enhancedContent.modelUsed)
					? enhancedContent.modelInfo || {
							name: enhancedContent.modelUsed,
							provider: "Google Gemini",
					  }
					: null;
			const enhancedContentText =
				typeof enhancedContent === "object" &&
				enhancedContent.enhancedContent
					? enhancedContent.enhancedContent
					: enhancedContent;
			let sanitizedContent = sanitizeHTML(enhancedContentText);

			// If content doesn't have <p> tags, convert newlines to paragraphs
			if (!/<p[\s>]/i.test(sanitizedContent)) {
				debugLog(
					"Enhanced content missing <p> tags, converting newlines to paragraphs"
				);
				// Split by double newlines (paragraph breaks)
				const paragraphs = sanitizedContent
					.split(/\n\n+/)
					.map((p) => p.trim())
					.filter((p) => p.length > 0);
				// Wrap each paragraph in <p> tags
				sanitizedContent = paragraphs
					.map((p) => `<p>${p}</p>`)
					.join("\n");
			}

			// Handler-driven enhancement selection
			const supportsTextOnly =
				currentHandler &&
				typeof currentHandler.supportsTextOnlyEnhancement ===
					"function" &&
				currentHandler.supportsTextOnlyEnhancement();

			let newContent;

			if (
				supportsTextOnly &&
				typeof currentHandler.applyEnhancedContent === "function"
			) {
				debugLog(
					"Handler provides text-only enhancement; delegating paragraph updates..."
				);
				currentHandler.applyEnhancedContent(
					contentArea,
					sanitizedContent
				);
				newContent = contentArea.innerText || contentArea.textContent;
			} else {
				debugLog("Using default full HTML enhancement pathway...");
				const { preservedElements: originalImages } =
					preserveHtmlElements(originalContent);
				debugLog(
					`Preserved ${originalImages.length} images from original content`
				);
				const {
					modifiedContent: contentWithPreservedStats,
					preservedBoxes,
				} = preserveGameStatsBoxes(sanitizedContent);
				let contentToDisplay = contentWithPreservedStats;
				if (preservedBoxes.length > 0) {
					debugLog(
						`Restoring ${preservedBoxes.length} game stats boxes`
					);
					contentToDisplay = restoreGameStatsBoxes(
						contentToDisplay,
						preservedBoxes
					);
				}
				if (originalImages.length > 0) {
					const imageContainer = document.createElement("div");
					imageContainer.className = "preserved-images-container";
					imageContainer.style.cssText =
						"\n\t\t\t\tmargin: 10px 0;\n\t\t\t\ttext-align: center;\n\t\t\t";
					originalImages.forEach((img) => {
						if (img.includes("<img")) {
							imageContainer.innerHTML += img;
						}
					});
					contentToDisplay =
						imageContainer.outerHTML + contentToDisplay;
				}
				contentArea.innerHTML = sanitizeHTML(contentToDisplay);
				newContent = contentArea.innerText || contentArea.textContent;
			}

			if (
				currentHandler &&
				typeof currentHandler.formatAfterEnhancement === "function"
			) {
				currentHandler.formatAfterEnhancement(contentArea);
			} else {
				applyDefaultFormatting(contentArea);
			}

			// Apply font size setting to enhanced content
			if (currentFontSize && currentFontSize !== 100) {
				contentArea.style.fontSize = `${currentFontSize}%`;
			}

			contentArea.setAttribute("data-original-content", originalContent);
			contentArea.setAttribute(
				"data-enhanced-content",
				contentArea.innerHTML
			);
			contentArea.setAttribute("data-showing-enhanced", "true");

			// Debug: Check if original has <p> tags
			const originalHasPTags = /<p[\s>]/i.test(originalContent);
			const enhancedHasPTags = /<p[\s>]/i.test(contentArea.innerHTML);
			debugLog(
				"Stored data attributes. Original length:",
				originalContent ? originalContent.length : 0,
				"Enhanced length:",
				contentArea.innerHTML ? contentArea.innerHTML.length : 0,
				"contentArea id:",
				contentArea.id,
				"Original has <p> tags:",
				originalHasPTags,
				"Enhanced has <p> tags:",
				enhancedHasPTags
			);
			// Log first 500 chars of original to see structure
			debugLog(
				"Original HTML preview:",
				originalContent ? originalContent.substring(0, 500) : "null"
			);

			removeOriginalWordCount();

			// Helper function to create and attach toggle functionality
			const setupToggleBanner = (showingEnhanced) => {
				// Remove any existing banner first
				const existingBanners = contentArea.querySelectorAll(
					".gemini-enhanced-banner"
				);
				existingBanners.forEach((b) => b.remove());

				// Create new banner
				const newBanner = createEnhancedBanner(
					originalText,
					newContent,
					modelInfo,
					isCachedContent
				);

				// Update toggle button text based on current state
				const newToggleButton =
					newBanner.querySelector(".gemini-toggle-btn");
				if (newToggleButton) {
					newToggleButton.textContent = showingEnhanced
						? "Show Original"
						: "Show Enhanced";
					debugLog(
						"Toggle button found, attaching click handler. showingEnhanced:",
						showingEnhanced
					);
					newToggleButton.addEventListener("click", function (e) {
						debugLog("Toggle button clicked!");
						e.preventDefault();
						e.stopPropagation();

						const currentlyShowingEnhanced =
							contentArea.getAttribute(
								"data-showing-enhanced"
							) === "true";
						debugLog(
							"currentlyShowingEnhanced:",
							currentlyShowingEnhanced
						);

						if (currentlyShowingEnhanced) {
							// Switch to original - restore original HTML
							const storedOriginal = contentArea.getAttribute(
								"data-original-content"
							);
							debugLog(
								"Switching to original. storedOriginal length:",
								storedOriginal ? storedOriginal.length : 0,
								"Has <p> tags:",
								storedOriginal
									? /<p[\s>]/i.test(storedOriginal)
									: false
							);
							debugLog(
								"Restoring HTML preview:",
								storedOriginal
									? storedOriginal.substring(0, 500)
									: "null"
							);
							if (storedOriginal) {
								contentArea.innerHTML =
									sanitizeHTML(storedOriginal);
								contentArea.setAttribute(
									"data-showing-enhanced",
									"false"
								);
								debugLog(
									"Switched to original content. Actual innerHTML has <p> tags:",
									/<p[\s>]/i.test(contentArea.innerHTML)
								);
							} else {
								debugError("No stored original content found!");
							}
						} else {
							// Switch to enhanced - restore enhanced HTML
							const storedEnhanced = contentArea.getAttribute(
								"data-enhanced-content"
							);
							debugLog(
								"Switching to enhanced. storedEnhanced length:",
								storedEnhanced ? storedEnhanced.length : 0
							);
							if (storedEnhanced) {
								contentArea.innerHTML =
									sanitizeHTML(storedEnhanced);
								contentArea.setAttribute(
									"data-showing-enhanced",
									"true"
								);

								// Reapply formatting
								if (
									currentHandler &&
									typeof currentHandler.formatAfterEnhancement ===
										"function"
								) {
									currentHandler.formatAfterEnhancement(
										contentArea
									);
								} else {
									applyDefaultFormatting(contentArea);
								}
								debugLog("Switched to enhanced content");
							} else {
								debugError("No stored enhanced content found!");
							}
						}

						// Recursively setup the banner for the new state
						debugLog(
							"Setting up toggle banner for state:",
							!currentlyShowingEnhanced
						);
						setupToggleBanner(!currentlyShowingEnhanced);
					});
				}

				// Setup delete button handler if present
				const newDeleteButton = newBanner.querySelector(
					".gemini-delete-cache-btn"
				);
				if (newDeleteButton) {
					newDeleteButton.addEventListener("click", async () => {
						if (
							confirm(
								"Delete cached enhanced content for this page?"
							)
						) {
							if (storageManager) {
								await storageManager.removeEnhancedContent(
									window.location.href
								);
								isCachedContent = false;
								showStatusMessage(
									"Cached content deleted. Reloading page...",
									"info"
								);
								setTimeout(() => location.reload(), 1000);
							}
						}
					});
				}

				// Insert banner at the top
				if (contentArea.firstChild) {
					contentArea.insertBefore(newBanner, contentArea.firstChild);
				} else {
					contentArea.appendChild(newBanner);
				}
				debugLog(
					"Banner inserted. contentArea:",
					contentArea.id,
					"Banner parent:",
					newBanner.parentNode ? newBanner.parentNode.id : "null"
				);
			};

			// Initial banner setup
			setupToggleBanner(true);

			window.scrollTo(0, scrollPosition);
			showStatusMessage("Content successfully enhanced with Gemini!");

			// Save to cache if storage manager is available (always overwrite with latest)
			if (storageManager) {
				try {
					await storageManager.saveEnhancedContent(
						window.location.href,
						{
							title: document.title,
							originalContent: originalContent,
							enhancedContent: enhancedContentText,
							modelInfo: modelInfo,
							timestamp: Date.now(),
						}
					);
					isCachedContent = true;
					debugLog("Enhanced content saved to cache");
				} catch (saveError) {
					debugError("Failed to save to cache:", saveError);
				}
			}

			// Add novel to library
			try {
				const novelContext = extractNovelContext();
				await addToNovelLibrary(novelContext);
			} catch (libraryError) {
				debugError("Failed to add to novel library:", libraryError);
			}

			// Update chapter progression after successful enhancement
			await updateChapterProgression();

			return true;
		} catch (error) {
			debugError("Error replacing content:", error);
			showStatusMessage(
				`Error replacing content: ${error.message}`,
				"error"
			);
			return false;
		}
	}

	// Function to display enhanced content with toggle ability
	function displayEnhancedContent(originalContent, enhancedContent) {
		const contentArea = findContentArea();
		if (!contentArea) {
			showStatusMessage(
				"Unable to find content area for replacement",
				"error"
			);
			return false;
		}

		try {
			// Save the scroll position
			const scrollPosition = window.scrollY;

			// Store original content for toggling
			contentArea.setAttribute("data-original-content", originalContent);

			// Clean up any code block markers
			enhancedContent = sanitizeHTML(enhancedContent);

			contentArea.setAttribute("data-enhanced-content", enhancedContent);
			contentArea.setAttribute("data-showing-enhanced", "true");

			// Handler-based enhancement selection for modularity
			const supportsTextOnly =
				currentHandler &&
				typeof currentHandler.supportsTextOnlyEnhancement ===
					"function" &&
				currentHandler.supportsTextOnlyEnhancement();

			if (
				supportsTextOnly &&
				typeof currentHandler.applyEnhancedContent === "function"
			) {
				debugLog(
					"Handler provides text-only enhancement for display path; delegating..."
				);
				currentHandler.applyEnhancedContent(
					contentArea,
					enhancedContent
				);
			} else {
				debugLog(
					"Using default full HTML replacement in displayEnhancedContent..."
				);
				contentArea.innerHTML = enhancedContent;
			}

			// Apply site-specific formatting if needed
			if (
				currentHandler &&
				typeof currentHandler.formatAfterEnhancement === "function"
			) {
				currentHandler.formatAfterEnhancement(contentArea);
			} else {
				// Default formatting for all sites
				applyDefaultFormatting(contentArea);
			}

			// Create enhanced banner with word count comparison
			const banner = createEnhancedBanner(
				originalContent,
				enhancedContent
			);

			// Remove the original word count element
			removeOriginalWordCount();

			// Get the toggle button from the banner
			const toggleButton = banner.querySelector(".gemini-toggle-btn");
			if (toggleButton) {
				const toggleContent = function () {
					const isShowingEnhanced =
						contentArea.getAttribute("data-showing-enhanced") ===
						"true";
					let newBanner;
					if (isShowingEnhanced) {
						// Switch to original
						contentArea.innerHTML = sanitizeHTML(originalContent);
						contentArea.setAttribute(
							"data-showing-enhanced",
							"false"
						);
						// Re-create banner for original view
						newBanner = createEnhancedBanner(
							originalContent,
							enhancedContent
						);
						const newToggleButton =
							newBanner.querySelector(".gemini-toggle-btn");
						if (newToggleButton) {
							newToggleButton.textContent = "Show Enhanced";
							newToggleButton.addEventListener(
								"click",
								toggleContent
							);
						}
						if (contentArea.firstChild) {
							contentArea.insertBefore(
								newBanner,
								contentArea.firstChild
							);
						} else {
							contentArea.appendChild(newBanner);
						}
					} else {
						// Switch to enhanced
						contentArea.innerHTML = sanitizeHTML(enhancedContent);
						contentArea.setAttribute(
							"data-showing-enhanced",
							"true"
						);

						// Reapply formatting
						if (
							currentHandler &&
							typeof currentHandler.formatAfterEnhancement ===
								"function"
						) {
							currentHandler.formatAfterEnhancement(contentArea);
						} else {
							applyDefaultFormatting(contentArea);
						}
						// Re-create banner for enhanced view
						newBanner = createEnhancedBanner(
							originalContent,
							enhancedContent
						);
						const newToggleButton =
							newBanner.querySelector(".gemini-toggle-btn");
						if (newToggleButton) {
							newToggleButton.textContent = "Show Original";
							newToggleButton.addEventListener(
								"click",
								toggleContent
							);
						}
						if (contentArea.firstChild) {
							contentArea.insertBefore(
								newBanner,
								contentArea.firstChild
							);
						} else {
							contentArea.appendChild(newBanner);
						}
					}
				};
				toggleButton.addEventListener("click", toggleContent);
			}

			// Remove any existing enhanced banner before inserting a new one
			const existingBanner = contentArea.querySelector(
				".gemini-enhanced-banner"
			);
			if (existingBanner) {
				existingBanner.remove();
			}

			// Add banner to the top of content area
			if (contentArea.firstChild) {
				contentArea.insertBefore(banner, contentArea.firstChild);
			} else {
				contentArea.appendChild(banner);
			}

			// Restore scroll position
			window.scrollTo(0, scrollPosition);

			// Show success message
			showStatusMessage("Content successfully enhanced with Gemini!");

			return true;
		} catch (error) {
			debugError("Error displaying enhanced content:", error);
			showStatusMessage(`Error: ${error.message}`, "error");
			return false;
		}
	}

	// Function to display an error message when processing fails
	function showProcessingError(errorMessage) {
		debugError("Processing error:", errorMessage);

		const contentArea = findContentArea();
		if (!contentArea) return;

		// Create error box
		const errorBox = document.createElement("div");
		errorBox.className = "gemini-error-box";
		errorBox.style.cssText = `
        background-color: #fff3cd;
        border: 1px solid #ffeeba;
        color: #856404;
        padding: 15px;
        margin: 15px 0;
        border-radius: 5px;
    `;

		errorBox.innerHTML = `
        <strong>Error processing content with Gemini:</strong>
        <p>${errorMessage}</p>
        <p>Please try again or check your API key and settings.</p>
    `;

		// Insert at the beginning of content area
		if (contentArea.firstChild) {
			contentArea.insertBefore(errorBox, contentArea.firstChild);
		} else {
			contentArea.appendChild(errorBox);
		}
	}

	// Function to count words in text
	function countWords(text) {
		if (!text) return 0;
		// Remove extra whitespace and count words
		return text
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
	}

	// Function to add word count display to the content
	function addWordCountDisplay(contentArea, originalCount, newCount) {
		// Check if there's already a word count display and update it
		const existingWordCount = document.querySelector(".gemini-word-count");
		if (existingWordCount) {
			// Calculate percentage change
			const percentChange = (
				((newCount - originalCount) / originalCount) *
				100
			).toFixed(1);
			const changeText =
				percentChange >= 0
					? `+${percentChange}% increase`
					: `${percentChange}% decrease`;

			existingWordCount.innerHTML = `
			<strong>  Word Count:</strong> ${originalCount} → ${newCount} (${changeText})
		`;
			return;
		}

		// If no existing display, create a new one
		// Create word count container
		const wordCountContainer = document.createElement("div");
		wordCountContainer.className = "gemini-word-count";
		wordCountContainer.style.cssText = `
		margin: 10px 0 15px 0;
		color: #bab9a0;
		font-size: 14px;
		text-align: left;
	`;

		// Calculate percentage change
		const percentChange = (
			((newCount - originalCount) / originalCount) *
			100
		).toFixed(1);
		const changeText =
			percentChange >= 0
				? `+${percentChange}% increase`
				: `${percentChange}% decrease`;

		wordCountContainer.innerHTML = `
		<strong>  Word Count:</strong> ${originalCount} → ${newCount} (${changeText})
	`;

		// Insert right after the controls container
		const controlsContainer = document.getElementById("gemini-controls");
		if (controlsContainer) {
			controlsContainer.parentNode.insertBefore(
				wordCountContainer,
				controlsContainer.nextSibling
			);
		} else {
			// Fallback: insert at the top of the content area
			contentArea.insertBefore(
				wordCountContainer,
				contentArea.firstChild
			);
		}
	}

	// Default formatting to apply after enhancement
	function applyDefaultFormatting(contentArea) {
		if (!contentArea) return;

		// Center scene headings/dividers when enabled
		if (formattingOptions.centerSceneHeadings) {
			const headingSelectors =
				"h2, h3, h4, .section-divider, hr.section-divider";
			contentArea.querySelectorAll(headingSelectors).forEach((el) => {
				if (el.tagName === "HR") {
					el.style.marginLeft = "auto";
					el.style.marginRight = "auto";
					el.style.width = "60%";
					return;
				}
				el.style.textAlign = "center";
				el.style.marginLeft = "auto";
				el.style.marginRight = "auto";
			});
		}
	}

	// Function to add the Gemini processed notice banner
	function addGeminiProcessedNotice(contentArea) {
		// Check if notice already exists
		if (contentArea.querySelector(".gemini-processed-notice")) {
			return; // Don't add duplicate notices
		}

		// Create the notice container
		const noticeContainer = document.createElement("div");
		noticeContainer.className = "gemini-processed-notice";

		// Add the notice text
		const noticeText = document.createTextNode(
			"This content has been enhanced by Gemini AI"
		);
		noticeContainer.appendChild(noticeText);

		// Add a restore button to revert to original content if needed
		const restoreButton = document.createElement("button");
		restoreButton.textContent = "Restore Original";
		restoreButton.addEventListener("click", () => {
			// Add functionality to restore original content
			// This would need implementation of content backup and restore logic
			showStatusMessage(
				"Original content restoration is not implemented yet",
				"info"
			);
		});
		noticeContainer.appendChild(restoreButton);

		// Insert at the beginning of the content area
		contentArea.insertBefore(noticeContainer, contentArea.firstChild);
	}

	// Shows a status message on the page
	function showStatusMessage(message, type = "info") {
		// Create message element
		const messageDiv = document.createElement("div");
		messageDiv.textContent = message;
		messageDiv.classList.add("extraction-message");

		// Style based on message type - match sample page styling
		const bgColor = type === "error" ? "#622020" : "#2c494f";
		const textColor = "#bab9a0";

		messageDiv.style.cssText = `
    background-color: ${bgColor};
    color: ${textColor};
    padding: 15px;
    margin: 15px 0;
    border-radius: 4px;
    font-weight: bold;
    text-align: center;
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    max-width: 80%;
    border: 1px solid #ffffff21;
  `;

		document.body.appendChild(messageDiv);

		// Remove the message after 5 seconds
		setTimeout(() => {
			if (messageDiv.parentNode) {
				messageDiv.parentNode.removeChild(messageDiv);
			}
		}, 5000);
	}

	/**
	 * Handle getting novel info for popup display
	 * @returns {Promise<Object>} Novel info response
	 */
	async function handleGetNovelInfo() {
		try {
			if (!currentHandler) {
				debugLog("📚 getNovelInfo: No handler available");
				return {
					success: false,
					error: "No handler available for this page",
				};
			}

			// Get novel metadata from handler
			debugLog("📚 getNovelInfo: Extracting metadata...");
			const metadata = await currentHandler.extractNovelMetadata();
			debugLog("📚 getNovelInfo: Raw metadata:", metadata);

			if (!metadata || !metadata.title) {
				debugLog("📚 getNovelInfo: No valid metadata found");
				return {
					success: false,
					error: "Could not extract novel metadata",
				};
			}

			// Get current chapter from navigation (the chapter user is actually reading)
			const chapterNav = currentHandler.getChapterNavigation?.() || {};
			const currentReadingChapter = chapterNav.currentChapter;

			// Check page type
			const isOnChapterPage = currentHandler.isChapterPage?.() || false;
			const isOnNovelPage = currentHandler.isNovelPage?.() || false;

			// Check if novel is in library
			const libraryUrl = browser.runtime.getURL("utils/novel-library.js");
			const { novelLibrary } = await import(libraryUrl);
			const library = await novelLibrary.getLibrary();
			const novelId =
				metadata.id ||
				currentHandler.generateNovelId(window.location.href);
			const isInLibrary =
				novelId &&
				library.novels &&
				library.novels[novelId] !== undefined;

			// Get library novel data for additional info
			const libraryNovel = isInLibrary ? library.novels[novelId] : null;

			// Build comprehensive response
			const novelInfo = {
				novelId: novelId,
				title: metadata.title,
				author: metadata.author,
				description:
					metadata.description ||
					(libraryNovel ? libraryNovel.description : null),
				coverUrl:
					metadata.coverUrl ||
					metadata.coverImage ||
					(libraryNovel ? libraryNovel.coverUrl : null),
				// Priority: current reading chapter from navigation > library record > null
				currentChapter:
					currentReadingChapter ||
					(libraryNovel ? libraryNovel.lastReadChapter : null),
				totalChapters:
					metadata.totalChapters ||
					(libraryNovel ? libraryNovel.totalChapters : null),
				chapterTitle: metadata.chapterTitle,
				source: metadata.source || currentHandler.getSiteIdentifier(),
				sourceUrl: metadata.sourceUrl || window.location.href,
				mainNovelUrl:
					metadata.mainNovelUrl ||
					(libraryNovel ? libraryNovel.sourceUrl : null),
				isInLibrary: isInLibrary,
				isChapterPage: isOnChapterPage,
				isNovelPage: isOnNovelPage,
				shelfId: libraryNovel
					? libraryNovel.shelfId
					: currentHandler.constructor.SHELF_METADATA?.id || null,
				// Library-specific data when novel is in library
				...(isInLibrary && libraryNovel
					? {
							readingStatus:
								libraryNovel.readingStatus || "reading",
							lastReadChapter: libraryNovel.lastReadChapter,
							lastReadUrl: libraryNovel.lastReadUrl,
							dateAdded: libraryNovel.dateAdded,
							lastUpdated: libraryNovel.lastUpdated,
							genres:
								libraryNovel.genres || metadata.genres || [],
							tags: libraryNovel.tags || metadata.tags || [],
							status: libraryNovel.status || metadata.status,
							enhancedChapters:
								libraryNovel.enhancedChapters || 0,
					  }
					: {
							genres: metadata.genres || [],
							tags: metadata.tags || [],
							status: metadata.status,
					  }),
			};

			debugLog("📚 getNovelInfo: Returning novelInfo:", novelInfo);
			return {
				success: true,
				novelInfo: novelInfo,
			};
		} catch (error) {
			debugError("Error in handleGetNovelInfo:", error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Handle adding current novel to library
	 * @returns {Promise<Object>} Add result
	 */
	async function handleAddToLibrary() {
		try {
			if (!currentHandler) {
				return {
					success: false,
					error: "No handler available for this page",
				};
			}

			// Get novel metadata from handler
			const metadata = await currentHandler.extractNovelMetadata();
			if (!metadata) {
				return {
					success: false,
					error: "Could not extract novel metadata",
				};
			}

			// Import novel library
			const libraryUrl = browser.runtime.getURL("utils/novel-library.js");
			const { novelLibrary } = await import(libraryUrl);

			// Add/update novel in library
			const result = await novelLibrary.addOrUpdateNovel({
				title: metadata.title,
				author: metadata.author,
				coverUrl: metadata.coverUrl || metadata.coverImage,
				currentChapter: metadata.currentChapter,
				totalChapters:
					metadata.totalChapters || metadata.metadata?.totalChapters,
				chapterTitle: metadata.chapterTitle,
				source: metadata.source || currentHandler.getSiteIdentifier(),
				sourceUrl: metadata.sourceUrl || window.location.href,
				mainNovelUrl:
					metadata.mainNovelUrl ||
					metadata.sourceUrl ||
					window.location.href,
				lastChapterUrl: window.location.href,
				tags: metadata.tags || [],
				genres: metadata.genres || [],
				status: metadata.status,
				metadata: metadata.metadata || metadata,
				metadataIncomplete:
					metadata.metadataIncomplete ||
					metadata.needsDetailPage ||
					false,
				description: metadata.description,
			});

			return { success: true, novel: result };
		} catch (error) {
			debugError("Error in handleAddToLibrary:", error);
			return { success: false, error: error.message };
		}
	}

	// Listen for messages from the extension popup or background
	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
		debugLog("Content script received message:", message);

		if (message.action === "ping") {
			sendResponse({ success: true, message: "Content script is alive" });
			return true;
		}

		// Handle API key missing message - stop everything immediately
		if (message.action === "apiKeyMissing") {
			debugError("[Content] API key is missing, halting processing");
			showStatusMessage(
				"⚠️ API key is missing. Please configure it in the extension popup.",
				"error",
				10000
			);

			// Try to open the popup
			try {
				browser.runtime
					.sendMessage({ action: "openPopup" })
					.catch((err) => {
						console.warn("Could not open popup:", err);
					});
			} catch (err) {
				console.warn("Could not send openPopup message:", err);
			}

			// Reset UI state
			const button = document.querySelector(".gemini-enhance-btn");
			if (button) {
				button.textContent = "✨ Enhance with Gemini";
				button.disabled = false;
				button.classList.remove("loading");
			}

			sendResponse({ success: true });
			return true;
		}

		// Handle chunk processing results (new handlers for progressive display)
		if (message.action === "chunkProcessed") {
			handleChunkProcessed(message);
			sendResponse({ success: true });
			return true;
		}

		// Handle chunk processing errors
		if (message.action === "chunkError") {
			handleChunkError(message);
			sendResponse({ success: true });
			return true;
		}

		// Handle all chunks processing completion
		if (message.action === "allChunksProcessed") {
			handleAllChunksProcessed(message);
			sendResponse({ success: true });
			return true;
		}

		// Handle processing cancellation
		if (message.action === "processingCancelled") {
			debugLog(
				`Processing cancelled. ${message.processedChunks} chunks completed, ${message.remainingChunks} remaining.`
			);
			showStatusMessage(
				`Enhancement cancelled. ${message.processedChunks} of ${message.totalChunks} chunks were enhanced.`,
				"info"
			);

			// Reset button state
			const button = document.querySelector(".gemini-enhance-btn");
			if (button) {
				button.textContent = "🔄 Continue Enhancement";
				button.disabled = false;
				button.classList.remove("loading");
			}

			sendResponse({ success: true });
			return true;
		}

		if (message.action === "getSiteHandlerInfo") {
			let response = { success: true, hasHandler: false };

			// If we have a handler, get information about it
			if (currentHandler) {
				response.hasHandler = true;
				response.siteIdentifier = currentHandler.getSiteIdentifier();
				response.defaultPrompt = currentHandler.getDefaultPrompt();
				response.siteSpecificPrompt =
					currentHandler.getSiteSpecificPrompt();
			}

			sendResponse(response);
			return true;
		}

		if (message.action === "testExtraction") {
			const result = extractContent();
			sendResponse({
				success: true,
				foundContent: result.found,
				title: result.title,
				text: result.text.substring(0, 100) + "...", // Show only start for test
			});
			return true;
		}

		if (message.action === "processWithGemini") {
			handleEnhanceClick()
				.then(() => {
					sendResponse({ success: true });
				})
				.catch((error) => {
					sendResponse({
						success: false,
						error:
							error.message || "Unknown error processing content",
					});
				});
			return true;
		}

		if (message.action === "settingsUpdated") {
			// Update any local settings
			debugLog("Settings updated:", message);
			sendResponse({ success: true });
			return true;
		}

		if (message.action === "summarizeWithGemini") {
			handleSummarizeClick()
				.then(() => {
					sendResponse({ success: true });
				})
				.catch((error) => {
					sendResponse({
						success: false,
						error:
							error.message ||
							"Unknown error summarizing content",
					});
				});
			return true;
		}

		// Get novel info for popup display
		if (message.action === "getNovelInfo") {
			handleGetNovelInfo()
				.then((result) => {
					sendResponse(result);
				})
				.catch((error) => {
					sendResponse({
						success: false,
						error: error.message || "Failed to get novel info",
					});
				});
			return true;
		}

		// Add current novel to library
		if (message.action === "addToLibrary") {
			handleAddToLibrary()
				.then((result) => {
					sendResponse(result);
				})
				.catch((error) => {
					sendResponse({
						success: false,
						error: error.message || "Failed to add to library",
					});
				});
			return true;
		}

		// Update novel reading status
		if (message.action === "updateNovelReadingStatus") {
			(async () => {
				try {
					const libraryUrl = browser.runtime.getURL(
						"utils/novel-library.js"
					);
					const { novelLibrary } = await import(libraryUrl);
					const result = await novelLibrary.updateNovel(
						message.novelId,
						{
							readingStatus: message.readingStatus,
						}
					);
					sendResponse({ success: true, result });
				} catch (error) {
					debugError("Error updating reading status:", error);
					sendResponse({
						success: false,
						error:
							error.message || "Failed to update reading status",
					});
				}
			})();
			return true;
		}

		return false;
	});

	// Test function for game status boxes (can be triggered from the console for verification)
	window.testGameStatsBox = async function () {
		debugLog("Testing game stats box functionality...");

		// Create a sample div to show the test results
		const testContainer = document.createElement("div");
		testContainer.style.padding = "20px";
		testContainer.style.margin = "20px";
		testContainer.style.border = "1px solid #ccc";
		testContainer.style.borderRadius = "5px";
		testContainer.innerHTML =
			"<h3>Testing Game Stats Box Formatting</h3><p>Sending request to background script...</p>";

		// Insert into page for visibility
		const contentArea = findContentArea();
		if (contentArea) {
			contentArea.parentNode.insertBefore(testContainer, contentArea);
		} else {
			document.body.appendChild(testContainer);
		}

		try {
			// Request a test from the background script
			const response = await browser.runtime.sendMessage({
				action: "testGameStatsBox",
			});

			if (response && response.success) {
				debugLog("Game stats box test successful:", response);
				testContainer.innerHTML = `
				<h3>Game Stats Box Test Results:</h3>
				<p>Test completed. Game stats box preserved: ${
					response.preservedGameStatsBox ? "✅ Yes" : "❌ No"
				}</p>
				<div style="margin-top: 20px;">
					<h4>Processed Content:</h4>
					${response.result.enhancedContent}
				</div>
			`;
			} else {
				debugError("Game stats box test failed:", response);
				testContainer.innerHTML = `
				<h3>Game Stats Box Test Failed</h3>
				<p>Error: ${response?.error || "Unknown error"}</p>
			`;
			}
		} catch (error) {
			debugError("Error testing game stats box:", error);
			testContainer.innerHTML = `
			<h3>Game Stats Box Test Error</h3>
			<p>Error: ${error.message}</p>
		`;
		}

		return "Test initiated. Check the page for results.";
	};

	// Run initialization immediately in case the page is already loaded
	initializeWithDeviceDetection();
}
