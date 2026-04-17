// Lightweight logger bootstrap for content scripts (no top-level imports allowed here)
let debugLog = console.log.bind(console);
let debugError = console.error.bind(console);
(async () => {
	try {
		if (typeof browser !== "undefined" && browser.runtime?.getURL) {
			const loggerUrl = browser.runtime.getURL("utils/logger.js");
			const mod = await import(loggerUrl);
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
let storageManager = null; // Storage manager instance for caching
let isCachedContent = false; // Track if cached content is currently applied
let hasCachedContent = false; // Track if cached content exists
let enhancementCancelRequested = false; // Track if user cancels enhancement
let cancelEnhanceButton = null;
let currentFontSize = 100; // Font size percentage (default 100%)
let siteSettings = null; // Per-site enable/disable settings
let siteSettingsModule = null; // Site settings helper module
let extensionBridgesModule = null; // Extension bridge helpers
let readAloudUiModule = null; // Read-aloud UI helper module
let enhancementBannersModule = null; // Enhancement banner helpers
let notificationRuntimeModule = null; // Status / notification helpers
let enhancementToggleBannerModule = null; // Enhancement banner refresh helpers
let enhancedContentBannerModule = null; // Enhanced content banner UI helpers
let chunkControlRuntime = null; // Chunk control state/helpers
let lastChunkModelInfo = null; // Track last model info for chunked banners
const progressPromptState = new Map();
const PROGRESS_PROMPT_COOLDOWN_MS = 10 * 60 * 1000;
const PROGRESS_PROMPT_TIMEOUT_MS = 30000; // 30 s — user needs time to decide
if (window.__RGInitDone) {
	debugLog(
		"Ranobe Gemini: Content script already initialized, skipping duplicate load.",
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

	// Banner duration + UI config defaults (loaded from constants.js)
	const bannerConfigDefaults = {
		defaultMs: 3000,
		quickMs: 2000,
		updateNotifyMs: 8000,
		persistent: 0,
		mobileBreakpointPx: 600,
	};
	let bannerConfig = { ...bannerConfigDefaults };

	// Chunk-processing behaviour defaults (keep in sync with utils/constants.js)
	const chunkBehaviorDefaults = {
		wordCountThreshold: 25, // DEFAULT_WORD_COUNT_THRESHOLD
		cacheRestoreRetryMs: 600, // CACHE_RESTORE_RETRY_MS
	};
	let chunkBehaviorConfig = { ...chunkBehaviorDefaults };

	const libraryUiA11yDefaults = {
		hideGeminiUiFromReadAloud: true,
	};
	let libraryUiA11yConfig = { ...libraryUiA11yDefaults };

	// Incognito mode — when active, automatic library add/update/progress are suppressed
	let incognitoMode = { enabled: false, expiresAt: null };

	// eslint-disable-next-line no-inner-declarations
	function isIncognitoActive() {
		if (!incognitoMode.enabled) return false;
		if (incognitoMode.expiresAt && Date.now() >= incognitoMode.expiresAt) {
			// Timer has expired — auto-disable and persist
			incognitoMode = { enabled: false, expiresAt: null };
			browser.storage.local
				.set({ rg_incognito_mode: incognitoMode })
				.catch(() => {});
			return false;
		}
		return true;
	}
	// eslint-disable-next-line no-inner-declarations
	function applyReadAloudHiding(root = document) {
		loadReadAloudUiModule()
			.then((mod) => mod?.applyReadAloudHiding?.(root))
			.catch(() => {});
	}

	// eslint-disable-next-line no-inner-declarations
	async function loadReadAloudUiSetting() {
		const mod = await loadReadAloudUiModule();
		if (mod?.loadReadAloudUiSetting) {
			return mod.loadReadAloudUiSetting();
		}
		return null;
	}

	// eslint-disable-next-line no-inner-declarations
	function initReadAloudUiObserver() {
		loadReadAloudUiModule()
			.then((mod) => mod?.initReadAloudUiObserver?.())
			.catch(() => {});
	}

	// Load shared constants for keep-alive tuning and banner durations when available
	(async () => {
		try {
			if (typeof browser !== "undefined" && browser.runtime?.getURL) {
				const constantsUrl =
					browser.runtime.getURL("utils/constants.js");
				const mod = await import(constantsUrl);
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
				bannerConfig = {
					...bannerConfigDefaults,
					defaultMs:
						mod.BANNER_DURATION_DEFAULT_MS ||
						bannerConfigDefaults.defaultMs,
					quickMs:
						mod.BANNER_DURATION_QUICK_MS ||
						bannerConfigDefaults.quickMs,
					updateNotifyMs:
						mod.BANNER_DURATION_UPDATE_NOTIFY_MS ||
						bannerConfigDefaults.updateNotifyMs,
					persistent:
						mod.BANNER_DURATION_PERSISTENT ??
						bannerConfigDefaults.persistent,
					mobileBreakpointPx:
						mod.UI_MOBILE_BREAKPOINT_PX ||
						bannerConfigDefaults.mobileBreakpointPx,
				};
				chunkBehaviorConfig = {
					...chunkBehaviorDefaults,
					wordCountThreshold:
						mod.DEFAULT_WORD_COUNT_THRESHOLD ??
						chunkBehaviorDefaults.wordCountThreshold,
					cacheRestoreRetryMs:
						mod.CACHE_RESTORE_RETRY_MS ||
						chunkBehaviorDefaults.cacheRestoreRetryMs,
				};
				if (keepAliveHeartbeat) restartKeepAlive();
			}
		} catch (_err) {
			// leave defaults
		}
	})();
	let debugModeEnabled = true; // Default to true for debugging

	// Gate console logging based on stored debugMode so logs are hidden by default unless enabled via popup checkbox.
	const __rgOriginalLog = debugLog.bind(console);
	async function loadReadAloudUiModule() {
		if (readAloudUiModule) return readAloudUiModule;
		try {
			const readAloudUrl = browser.runtime.getURL(
				"content/modules/read-aloud-ui.js",
			);
			const readAloudModule = await import(readAloudUrl);
			if (!readAloudModule?.createReadAloudUiRuntime) {
				return null;
			}
			readAloudUiModule = readAloudModule.createReadAloudUiRuntime({
				documentRef: document,
				browserRef: browser,
				libraryUiA11yConfig,
				debugLog,
				debugError,
			});
			return readAloudUiModule;
		} catch (error) {
			debugError("Error loading read-aloud UI module:", error);
			return null;
		}
	}

	async function loadEnhancementBannersModule() {
		if (enhancementBannersModule) return enhancementBannersModule;
		try {
			const bannersUrl = browser.runtime.getURL(
				"content/modules/enhancement-banners.js",
			);
			const bannersModule = await import(bannersUrl);
			if (!bannersModule?.toggleEnhancedBannersRuntime) {
				return null;
			}
			enhancementBannersModule = bannersModule;
			return enhancementBannersModule;
		} catch (error) {
			debugError("Error loading enhancement banner module:", error);
			return null;
		}
	}

	async function loadNotificationRuntimeModule() {
		if (notificationRuntimeModule) return notificationRuntimeModule;
		try {
			const notificationUrl = browser.runtime.getURL(
				"content/modules/notification-runtime.js",
			);
			const notificationModule = await import(notificationUrl);
			if (!notificationModule?.createNotificationRuntime) {
				return null;
			}
			notificationRuntimeModule =
				notificationModule.createNotificationRuntime({
					documentRef: document,
					browserRef: browser,
					windowRef: window,
					getNovelLibrary: () => novelLibrary,
				});
			return notificationRuntimeModule;
		} catch (error) {
			debugError("Error loading notification runtime module:", error);
			return null;
		}
	}

	async function loadEnhancementToggleBannerModule() {
		if (enhancementToggleBannerModule) return enhancementToggleBannerModule;
		try {
			const toggleUrl = browser.runtime.getURL(
				"content/modules/enhancement-toggle-banner.js",
			);
			const toggleModule = await import(toggleUrl);
			if (!toggleModule?.refreshToggleBannerRuntime) {
				return null;
			}
			enhancementToggleBannerModule = toggleModule;
			return enhancementToggleBannerModule;
		} catch (error) {
			debugError(
				"Error loading enhancement toggle banner module:",
				error,
			);
			return null;
		}
	}

	async function loadEnhancedContentBannerModule() {
		if (enhancedContentBannerModule) return enhancedContentBannerModule;
		try {
			const bannerUrl = browser.runtime.getURL(
				"content/modules/enhanced-content-banner.js",
			);
			const bannerModule = await import(bannerUrl);
			if (!bannerModule?.createEnhancedBannerRuntime) {
				return null;
			}
			enhancedContentBannerModule = bannerModule;
			return enhancedContentBannerModule;
		} catch (error) {
			debugError("Error loading enhanced content banner module:", error);
			return null;
		}
	}

	const __rgOriginalError = debugError.bind(console);

	// eslint-disable-next-line no-inner-declarations
	function applyDebugFlag(enabled) {
		debugModeEnabled = !!enabled;
	}

	try {
		browser.storage.local
			.get(["debugMode", "rg_library_settings", "rg_incognito_mode"])
			.then((data) => {
				// Only apply if debugMode is explicitly set in storage
				if (data.debugMode !== undefined) {
					applyDebugFlag(data.debugMode);
				} else {
					// Set default value in storage
					browser.storage.local.set({ debugMode: true });
				}

				const uiA11ySetting =
					data?.rg_library_settings?.hideGeminiUiFromReadAloud;
				libraryUiA11yConfig.hideGeminiUiFromReadAloud =
					uiA11ySetting !== false;
				applyReadAloudHiding(document);

				// Load incognito mode
				if (data.rg_incognito_mode) {
					incognitoMode = data.rg_incognito_mode;
				}
			})
			.catch(() => {});
		initReadAloudUiObserver();
		loadReadAloudUiSetting().catch(() => {});
		browser.storage.onChanged.addListener((changes, area) => {
			if (area !== "local") return;

			if (changes.debugMode) {
				applyDebugFlag(changes.debugMode.newValue);
			}

			if (changes.rg_library_settings) {
				const next =
					changes.rg_library_settings.newValue
						?.hideGeminiUiFromReadAloud;
				libraryUiA11yConfig.hideGeminiUiFromReadAloud = next !== false;
				applyReadAloudHiding(document);
			}

			if (changes.rg_incognito_mode) {
				incognitoMode = changes.rg_incognito_mode.newValue || {
					enabled: false,
					expiresAt: null,
				};
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

	// eslint-disable-next-line no-inner-declarations
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

	// eslint-disable-next-line no-inner-declarations
	function scheduleReconnect(reason) {
		if (keepAliveReconnectTimer) return;
		if (keepAliveRetryCount >= keepAliveConfig.maxRetries) return;
		keepAliveRetryCount += 1;
		const delay = keepAliveConfig.reconnectDelayMs;
		keepAliveReconnectTimer = setTimeout(
			() => {
				keepAliveReconnectTimer = null;
				startKeepAlivePort(reason || "retry");
			},
			delay +
				Math.floor(
					Math.random() * (keepAliveConfig.heartbeatJitterMs || 0),
				),
		);
	}

	// eslint-disable-next-line no-inner-declarations
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
				base + Math.floor(Math.random() * jitter),
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

	// eslint-disable-next-line no-inner-declarations
	function restartKeepAlive() {
		keepAlivePort = null;
		keepAliveRetryCount = 0;
		clearKeepAliveTimers();
		startKeepAlivePort("config-change");
	}

	// eslint-disable-next-line no-inner-declarations
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
	// eslint-disable-next-line no-inner-declarations, no-useless-escape
	function detectMobileDevice() {
		// Check if using a mobile device based on user agent
		const userAgent =
			navigator.userAgent || navigator.vendor || window.opera;
		if (
			/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
				userAgent,
			) ||
			// eslint-disable-next-line no-useless-escape
			/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
				userAgent.substr(0, 4),
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
			"",
		);

		// Remove code block markers like ```html, ```javascript, etc.
		sanitized = sanitized.replace(
			/```(?:html|javascript|css|js|xml|json|md|markdown|)\s*\n?/gi,
			"",
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
			"pre, .game-stats-box, .rg-author-note, .rg-system-msg, .rg-quote-box, .rg-skill-box, .rg-flashback, .stat-block",
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
						l.match(/^\s+/) ? l.match(/^\s+/)[0].length : 0,
					),
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
				`.game-stats-box[data-uid="${wrapper.dataset.uid}"]`,
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
			"",
		);
		text = text.replace(/```/g, "");

		// Create a temporary div to parse HTML
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = text;

		const decodeEntities = (value) => {
			if (!value) return "";
			const decoder = document.createElement("textarea");
			decoder.innerHTML = value;
			return decoder.value;
		};

		const blockSelector =
			"p, div, li, blockquote, pre, section, article, h1, h2, h3, h4, h5, h6";
		const blockNodes = Array.from(tempDiv.querySelectorAll(blockSelector));

		let paragraphs = [];

		if (blockNodes.length > 0) {
			paragraphs = blockNodes
				.map((node) => node.textContent.trim())
				.filter((content) => content.length > 0);
		} else {
			// Plain text fallback: normalize breaks and split on blank lines.
			let normalized = text.replace(/<br\s*\/?\s*>/gi, "\n");
			normalized = normalized.replace(/<[^>]*>/g, "");
			normalized = decodeEntities(normalized)
				.replace(/\r\n?/g, "\n")
				.replace(/[ \t]+\n/g, "\n");

			paragraphs = normalized
				.split(/\n\s*\n+/)
				.map((p) => p.trim())
				.filter((p) => p.length > 0);

			if (paragraphs.length <= 1) {
				paragraphs = normalized
					.split(/\n+/)
					.map((p) => p.trim())
					.filter((p) => p.length > 0);
			}
		}

		return paragraphs.map((p) => decodeEntities(p));
	}

	/**
	 * Make an element immune to Dark Reader and other theme extensions
	 * @param {HTMLElement} element - The element to protect
	 */
	function protectFromThemeExtensions(element) {
		if (!element) return;
		// Dark Reader isolation
		element.setAttribute("data-darkreader-lock", "");
		// Prevent other theme extensions
		element.setAttribute("data-theme-lock", "true");
		// Add class marker for styling
		element.classList.add("rg-protected");
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
			"",
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

	/**
	 * Remove copy-blocking applied by sites (e.g. .nocopy class on FF.net).
	 * Idempotent — safe to call multiple times.
	 * @param {Element} contentArea
	 */
	function enableCopyOnContentArea(contentArea) {
		if (!contentArea) return;
		// Always re-apply — site scripts may have re-added blocking handlers since last call
		// (e.g. after innerHTML replacement or toggle back to enhanced view).
		contentArea.dataset.rgCopyEnabled = "true";
		// Walk up ancestors to remove inline copy-blocking handlers, nocopy class,
		// and any user-select:none — unconditionally force text on every ancestor
		// (FanFiction sets user-select:none inline on the #storytext parent; checking
		// only === "none" is unreliable across browsers due to vendor-prefix normalisation)
		let el = contentArea;
		for (
			let i = 0;
			i < 10 && el && el !== document.documentElement;
			i++, el = el.parentElement
		) {
			el.classList.remove("nocopy");
			el.oncopy = null;
			el.removeAttribute("oncopy");
			el.onselectstart = null;
			el.removeAttribute("onselectstart");
			// Patchwork for FF.net (and similar sites): REMOVE the user-select
			// inline property entirely first so any !important: none can't block
			// re-application, then set our text !important.  removeProperty()
			// is the only reliable way to clear an inline !important value
			// before replacing it.
			if (el.style) {
				el.style.removeProperty("user-select");
				el.style.removeProperty("-webkit-user-select");
				el.style.removeProperty("-moz-user-select");
				el.style.setProperty("user-select", "text", "important");
				el.style.setProperty(
					"-webkit-user-select",
					"text",
					"important",
				);
			}
		}
		// Clear document/window level inline handlers — the most common anti-copy pattern
		document.onselectstart = null;
		document.oncopy = null;
		window.onselectstart = null;
		window.oncopy = null;
		// Force text selection with !important on the container itself
		contentArea.style.setProperty("user-select", "text", "important");
		contentArea.style.setProperty(
			"-webkit-user-select",
			"text",
			"important",
		);
		// Inject a persistent stylesheet rule (once per page-load) so site scripts
		// that re-apply user-select:none via MutationObserver or setInterval cannot
		// suppress text selection within the enhanced area after our inline-style
		// fixes run.  A stylesheet !important beats a non-!important inline style,
		// and appending our <style> last wins any same-specificity ties.
		// We use the element's own ID (e.g. #storytext1 for FF.net) to match the
		// specificity of any ID-based site rules; fallback to attribute selector.
		if (!document.getElementById("rg-select-override")) {
			const s = document.createElement("style");
			s.id = "rg-select-override";
			const idSel = contentArea.id
				? `#${CSS.escape(contentArea.id)}`
				: "[data-rg-copy-enabled]";
			s.textContent =
				`${idSel}, ${idSel} * {` +
				" user-select: text !important;" +
				" -webkit-user-select: text !important;" +
				" -moz-user-select: text !important;" +
				"}";
			(document.head || document.documentElement).appendChild(s);
		}
		// Register bubble-phase listeners only once (stored on element to prevent stacking)
		if (!contentArea._rgCopyListeners) {
			const stopCopy = (e) => e.stopImmediatePropagation();
			const stopSelect = (e) => e.stopImmediatePropagation();
			contentArea.addEventListener("copy", stopCopy, false);
			contentArea.addEventListener("selectstart", stopSelect, false);
			contentArea._rgCopyListeners = true;
		}
	}

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
						}/${maxRetries})`,
					);
					isBackgroundScriptReady = true;
					return true;
				}
			} catch (error) {
				console.warn(
					`Background wake-up attempt ${i + 1}/${maxRetries} failed:`,
					error.message,
				);
				if (i < maxRetries - 1) {
					// Wait before retry (except on last attempt)
					await new Promise((resolve) =>
						setTimeout(resolve, delayMs),
					);
				}
			}
		}
		debugError(
			"Background worker failed to wake up after",
			maxRetries,
			"attempts",
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
		retryDelayMs = 1000,
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
						`[sendMessageWithRetry] Attempt ${attempt}/${maxRetries} failed: ${errorMessage}`,
					);
					debugLog(
						"[sendMessageWithRetry] Waking up background worker before retry...",
					);
					ensureKeepAlivePort();

					// Wake up the background worker
					const workerReady = await wakeUpBackgroundWorker(2, 300);

					if (workerReady) {
						debugLog(
							`[sendMessageWithRetry] Worker woken up, retrying in ${retryDelayMs}ms...`,
						);
						await new Promise((resolve) =>
							setTimeout(resolve, retryDelayMs),
						);
						continue; // Retry the message
					} else {
						debugError(
							"[sendMessageWithRetry] Could not wake up background worker",
						);
					}
				}

				// If not a disconnection error or last attempt, throw the error
				if (attempt >= maxRetries) {
					debugError(
						`[sendMessageWithRetry] All ${maxRetries} attempts failed. Last error:`,
						lastError,
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
		showDeleteButton = false,
		cacheInfo = null,
	) {
		if (enhancedContentBannerModule?.createEnhancedBannerRuntime) {
			return enhancedContentBannerModule.createEnhancedBannerRuntime({
				originalContent,
				enhancedContent,
				modelInfo,
				showDeleteButton,
				cacheInfo,
				documentRef: document,
				windowRef: window,
				countWords,
			});
		}

		// Safety fallback if dynamic module loading failed.
		const fallback = document.createElement("div");
		fallback.className = "gemini-enhanced-banner";
		fallback.textContent = "✨ Content enhanced with Ranobe Gemini";
		return fallback;
	}

	function escapeHtml(str) {
		if (!str) return "";
		return String(str)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function handleCancelEnhancement() {
		debugLog("Cancelling enhancement process...");
		enhancementCancelRequested = true;

		sendMessageWithRetry({ action: "cancelEnhancement" }).catch((error) => {
			debugError("Failed to send cancel request:", error);
		});

		showStatusMessage(
			"Cancelling enhancement... processed chunks will be kept.",
			"info",
		);

		// Reset button states
		if (cancelEnhanceButton) {
			cancelEnhanceButton.style.display = "none";
		}

		document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
			btn.textContent = "⚡ Enhance Chapter";
			btn.disabled = false;
			btn.classList.remove("loading");
		});

		// Update WIP banner to paused state
		const chunkedContainer = document.getElementById(
			"gemini-chunked-content",
		);
		const totalChunks = chunkedContainer
			? chunkedContainer.querySelectorAll(".gemini-chunk-content").length
			: 1;
		const completedChunks = chunkedContainer
			? chunkedContainer.querySelectorAll(
					'.gemini-chunk-content[data-chunk-enhanced="true"]',
				).length
			: 0;

		// Calculate word counts for paused state
		let wordCounts = null;
		const chunking = window.chunkingSystemCache;
		if (chunkedContainer && chunking?.core?.countWords) {
			const allChunks = chunkedContainer.querySelectorAll(
				".gemini-chunk-content",
			);
			let totalOriginalWords = 0;
			let totalEnhancedWords = 0;

			allChunks.forEach((chunk) => {
				const originalContent =
					chunk.getAttribute("data-original-chunk-content") || "";
				const enhancedContent = chunk.innerHTML;
				totalOriginalWords += chunking.core.countWords(originalContent);
				totalEnhancedWords += chunking.core.countWords(enhancedContent);
			});

			wordCounts = {
				original: totalOriginalWords,
				enhanced: totalEnhancedWords,
			};
		}

		showWorkInProgressBanner(
			completedChunks,
			totalChunks,
			"paused",
			wordCounts,
		);
	}

	async function shouldBannersBeHidden() {
		const mod = await loadEnhancementBannersModule();
		return (
			mod?.shouldBannersBeHiddenRuntime?.({
				documentRef: document,
				currentHandler,
			}) ?? false
		);
	}

	async function handleToggleBannersVisibility() {
		const mod = await loadEnhancementBannersModule();
		mod?.toggleEnhancedBannersRuntime?.({
			documentRef: document,
			currentHandler,
			showStatusMessage,
		});
	}

	/**
	 * Dedicated toggle function for Show/Hide button in chapter novel controls
	 * ONLY hides enhancement banners, NEVER hides the controls container itself.
	 * @param {HTMLElement|null} callerBtn - The button that triggered the toggle (optional)
	 */
	async function handleChapterControlsToggleBanners(callerBtn = null) {
		const mod = await loadEnhancementBannersModule();
		mod?.toggleEnhancedBannersRuntime?.({
			documentRef: document,
			currentHandler,
			showStatusMessage,
			callerBtn,
		});
	}

	function buildChunkBanner(
		chunking,
		chunkIndex,
		totalChunks,
		status,
		errorMessage = null,
		cacheInfo = null,
		wordCounts = null,
		threshold = chunkBehaviorConfig.wordCountThreshold,
		onEnhance = null,
		isBatchMode = false,
	) {
		return chunking.ui.createChunkBanner(
			chunkIndex,
			totalChunks,
			status,
			errorMessage,
			{
				onRegenerate: handleReenhanceChunk,
				onToggle: handleChunkToggle,
				onDelete: handleChunkDelete,
				onEnhance,
				isBatchMode,
				onSkip: (idx) => handleSkipChunk(idx),
				onPause: (idx) => handlePauseChunk(idx),
				onShowEnhanced: (idx) => handleShowEnhancedChunk(idx),
				onDiscardPaused: (idx) => handleDiscardPausedChunk(idx),
			},
			cacheInfo,
			wordCounts,
			threshold,
		);
	}

	async function initializeChunkedViewForSummaries(contentArea, chunking) {
		if (!contentArea || !chunking?.core || !chunking?.summaryUI) {
			return 1;
		}

		const existingChunkedContainer = contentArea.querySelector(
			"#gemini-chunked-content",
		);
		if (existingChunkedContainer) {
			const existingTotal = parseInt(
				contentArea.getAttribute("data-total-chunks") || "0",
				10,
			);
			return existingTotal > 0 ? existingTotal : 1;
		}

		const extracted = extractContent();
		if (!extracted?.text?.trim()) {
			return 1;
		}

		let chunks = [];
		let chunkSummaryCount = 2;
		let chunkSizeWords = chunking?.config?.DEFAULT_CHUNK_SIZE_WORDS || 2000;

		try {
			const chunkConfig = await chunking.config.getChunkConfig();
			chunkSizeWords = chunkConfig.chunkSizeWords;
			chunkSummaryCount = chunkConfig.chunkSummaryCount;

			const sourceHtml =
				contentArea.getAttribute("data-original-html") ||
				getCleanContentHTML(contentArea);
			chunks = chunking.core.splitContentByWords(
				sourceHtml,
				chunkSizeWords,
			);
		} catch (error) {
			debugError("Failed to pre-initialize chunked view:", error);
			return 1;
		}

		if (!chunks || chunks.length === 0) {
			return 1;
		}

		const sourceHtml =
			contentArea.getAttribute("data-original-html") ||
			getCleanContentHTML(contentArea);
		contentArea.setAttribute("data-original-html", sourceHtml);
		contentArea.setAttribute("data-original-text", extracted.text || "");
		contentArea.setAttribute("data-total-chunks", String(chunks.length));

		const chunkedContentContainer = document.createElement("div");
		chunkedContentContainer.id = "gemini-chunked-content";
		chunkedContentContainer.style.width = "100%";

		for (let i = 0; i < chunks.length; i++) {
			const chunkWrapper = document.createElement("div");
			chunkWrapper.className = "gemini-chunk-wrapper";
			chunkWrapper.setAttribute("data-chunk-index", i);

			const banner = buildChunkBanner(
				chunking,
				i,
				chunks.length,
				"pending",
				null,
				null,
				null,
				chunkBehaviorConfig.wordCountThreshold,
				(
					(idx) => () =>
						handleReenhanceChunk(idx)
				)(i),
			);
			chunkWrapper.appendChild(banner);

			const chunkContent = document.createElement("div");
			chunkContent.className = "gemini-chunk-content";
			chunkContent.setAttribute("data-chunk-index", i);
			chunkContent.setAttribute(
				"data-original-chunk-html",
				chunks[i].content,
			);
			chunkContent.setAttribute(
				"data-original-chunk-content",
				stripHtmlTags(chunks[i].content),
			);
			chunkContent.innerHTML = chunks[i].content;
			chunkWrapper.appendChild(chunkContent);

			chunkedContentContainer.appendChild(chunkWrapper);
		}

		contentArea.innerHTML = "";
		contentArea.appendChild(chunkedContentContainer);

		const chunkWrappers = Array.from(
			chunkedContentContainer.querySelectorAll(".gemini-chunk-wrapper"),
		);
		if (chunks.length > 1) {
			chunking.summaryUI.insertSummaryGroups(
				chunkedContentContainer,
				chunkWrappers,
				chunkSummaryCount,
				(indices) => summarizeChunkRange(indices, false),
				(indices) => summarizeChunkRange(indices, true),
			);

			// Chunk summary groups are always visible for easy access to summaries
		}

		if (shouldBannersBeHidden()) {
			const chunkBanners = chunkedContentContainer.querySelectorAll(
				".gemini-chunk-banner",
			);
			chunkBanners.forEach((banner) => {
				banner.style.display = "none";
			});
		}

		debugLog(
			`Initialized pre-enhancement chunk view with ${chunks.length} chunks (${chunkSizeWords} words target)`,
		);

		enableCopyOnContentArea(contentArea);
		return chunks.length;
	}

	async function handleChunkToggle(chunkIndex) {
		const chunkWrapper = document.querySelector(
			`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
		);
		if (!chunkWrapper) return;

		const chunkContent = chunkWrapper.querySelector(
			".gemini-chunk-content",
		);
		const toggleBtn = chunkWrapper.querySelector(
			".gemini-chunk-toggle-btn",
		);
		if (!chunkContent || !toggleBtn) return;

		const isShowingEnhanced =
			toggleBtn.getAttribute("data-showing") === "enhanced";
		const originalHtml = chunkContent.getAttribute(
			"data-original-chunk-html",
		);
		const originalContent = chunkContent.getAttribute(
			"data-original-chunk-content",
		);
		const enhancedContent =
			chunkContent.getAttribute("data-enhanced-chunk-content") ||
			chunkContent.innerHTML;

		if (isShowingEnhanced) {
			chunkContent.setAttribute(
				"data-enhanced-chunk-content",
				chunkContent.innerHTML,
			);
			if (originalHtml) {
				chunkContent.innerHTML = originalHtml;
			} else {
				chunkContent.innerHTML = `<div style="white-space: pre-wrap;">${escapeHtml(originalContent || "")}</div>`;
			}
			toggleBtn.textContent = "✨ Show Enhanced";
			toggleBtn.setAttribute("data-showing", "original");
		} else {
			chunkContent.innerHTML = enhancedContent;
			applyCollapsibleSections(chunkContent);
			toggleBtn.textContent = "👁 Show Original";
			toggleBtn.setAttribute("data-showing", "enhanced");
			// Re-enable text selection after switching to enhanced view
			const caForToggle = findContentArea();
			if (caForToggle) enableCopyOnContentArea(caForToggle);
		}
	}

	async function handleChunkDelete(chunkIndex) {
		const chunking = await loadChunkingSystem();
		if (!chunking) return;

		const chunkWrapper = document.querySelector(
			`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
		);
		if (!chunkWrapper) return;

		const chunkContent = chunkWrapper.querySelector(
			".gemini-chunk-content",
		);
		if (!chunkContent) return;

		const originalHtml = chunkContent.getAttribute(
			"data-original-chunk-html",
		);
		const originalContent = chunkContent.getAttribute(
			"data-original-chunk-content",
		);

		if (!originalContent && !originalHtml) {
			showStatusMessage(
				"Original content not available for this chunk.",
				"error",
			);
			return;
		}

		await chunking.cache.deleteChunkFromCache(
			window.location.href,
			chunkIndex,
		);

		if (originalHtml) {
			chunkContent.innerHTML = originalHtml;
		} else {
			chunkContent.innerHTML = `<div style="white-space: pre-wrap;">${escapeHtml(originalContent)}</div>`;
		}
		chunkContent.removeAttribute("data-chunk-enhanced");
		chunkContent.removeAttribute("data-enhanced-chunk-content");

		const banner = chunkWrapper.querySelector(".gemini-chunk-banner");
		if (banner) {
			const totalChunks = document.querySelectorAll(
				".gemini-chunk-banner",
			).length;
			const newBanner = buildChunkBanner(
				chunking,
				chunkIndex,
				totalChunks,
				"pending",
				null,
				null,
				null,
				chunkBehaviorConfig.wordCountThreshold,
				() => handleReenhanceChunk(chunkIndex),
			);
			banner.replaceWith(newBanner);
		}

		showStatusMessage(
			`Chunk ${chunkIndex + 1} reverted to original.`,
			"info",
			2000,
		);
	}

	// ── Skip / Pause helpers ────────────────────────────────────────────────────

	function handleSkipChunk(chunkIndex) {
		chunkControlRuntime?.markSkip(chunkIndex);
		debugLog(
			`Chunk ${chunkIndex} marked for skip — will discard result on arrival.`,
		);
	}

	function handlePauseChunk(chunkIndex) {
		chunkControlRuntime?.markPause(chunkIndex);
		debugLog(
			`Chunk ${chunkIndex} marked for pause — will store result without applying.`,
		);
	}

	async function handleShowEnhancedChunk(chunkIndex) {
		const chunking = await loadChunkingSystem();
		if (!chunking) return;

		const chunkWrapper = document.querySelector(
			`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
		);
		if (!chunkWrapper) return;

		const chunkContent = chunkWrapper.querySelector(
			".gemini-chunk-content",
		);
		if (!chunkContent) return;

		const enhancedContent = chunkContent.getAttribute(
			"data-enhanced-chunk-content",
		);
		if (!enhancedContent) {
			showStatusMessage(
				`No pending enhanced content for chunk ${chunkIndex + 1}.`,
				"error",
			);
			return;
		}

		// Apply the held-back enhanced content
		chunkContent.innerHTML = enhancedContent;
		applyCollapsibleSections(chunkContent);
		chunkContent.setAttribute("data-chunk-enhanced", "true");
		chunkControlRuntime?.clearPause(chunkIndex);

		// Build a completed banner with word counts
		const nTotalChunks = document.querySelectorAll(
			".gemini-chunk-banner",
		).length;
		const settingsData = await browser.storage.local.get([
			"wordCountThreshold",
		]);
		const wct =
			settingsData.wordCountThreshold !== undefined
				? settingsData.wordCountThreshold
				: chunkBehaviorConfig.wordCountThreshold;
		const originalText =
			chunkContent.getAttribute("data-original-chunk-content") || "";
		const origWords = chunking.core.countWords(originalText);
		const enhWords = chunking.core.countWords(enhancedContent);
		const completedBanner = buildChunkBanner(
			chunking,
			chunkIndex,
			nTotalChunks,
			"completed",
			null,
			null,
			{ original: origWords, enhanced: enhWords },
			wct,
		);
		const freshBanner = document.querySelector(
			`.chunk-banner-${chunkIndex}`,
		);
		if (freshBanner) freshBanner.replaceWith(completedBanner);

		// Check if all chunks are now done
		const allChunkEls = document.querySelectorAll(".gemini-chunk-content");
		const doneEls = document.querySelectorAll(
			'.gemini-chunk-content[data-chunk-enhanced="true"]',
		);
		const allDone =
			doneEls.length === allChunkEls.length && allChunkEls.length > 0;

		if (allDone) {
			document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
				btn.textContent = "🔄 Re-enhance with Gemini";
				btn.disabled = false;
				btn.classList.remove("loading");
			});
			if (cancelEnhanceButton) cancelEnhanceButton.style.display = "none";
		}

		const contentAreaForCopy = findContentArea();
		if (contentAreaForCopy) {
			contentAreaForCopy.setAttribute("data-showing-enhanced", "true");
			enableCopyOnContentArea(contentAreaForCopy);
		}

		showStatusMessage(
			`Chunk ${chunkIndex + 1} enhancement applied! ✨`,
			"success",
			2000,
		);
	}

	async function handleDiscardPausedChunk(chunkIndex) {
		const chunking = await loadChunkingSystem();
		if (!chunking) return;

		const chunkWrapper = document.querySelector(
			`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
		);
		if (!chunkWrapper) return;

		const chunkContent = chunkWrapper.querySelector(
			".gemini-chunk-content",
		);
		if (!chunkContent) return;

		// Clear the stored (but un-applied) enhanced content
		chunkContent.removeAttribute("data-enhanced-chunk-content");
		chunkControlRuntime?.clearPause(chunkIndex);

		// Reset banner back to pending so the user can re-enhance later
		const nTotalChunks = document.querySelectorAll(
			".gemini-chunk-banner",
		).length;
		const pendingBanner = buildChunkBanner(
			chunking,
			chunkIndex,
			nTotalChunks,
			"pending",
			null,
			null,
			null,
			chunkBehaviorConfig.wordCountThreshold,
			() => handleReenhanceChunk(chunkIndex),
		);
		const freshBanner = document.querySelector(
			`.chunk-banner-${chunkIndex}`,
		);
		if (freshBanner) freshBanner.replaceWith(pendingBanner);

		showStatusMessage(
			`Chunk ${chunkIndex + 1} enhancement discarded.`,
			"info",
			2000,
		);
	}

	// ───────────────────────────────────────────────────────────────────────────

	async function handleReenhanceChunk(chunkIndex) {
		const chunking = await loadChunkingSystem();
		if (!chunking) return;

		debugLog(`Re-enhancing chunk ${chunkIndex}...`);

		const chunkContent = document.querySelector(
			`.gemini-chunk-content[data-chunk-index="${chunkIndex}"]`,
		);

		// Prefer the original HTML (preserves formatting); fall back to plain text
		const contentForEnhancement =
			chunkContent?.getAttribute("data-original-chunk-html") ||
			chunkContent?.getAttribute("data-original-chunk-content");
		// Plain text used only for word counting
		const originalText =
			chunkContent?.getAttribute("data-original-chunk-content") ||
			stripHtmlTags(contentForEnhancement || "");

		if (!contentForEnhancement) {
			debugError("No original content found for chunk", chunkIndex);
			showStatusMessage(
				`Cannot re-enhance chunk ${
					chunkIndex + 1
				}: Original content not found`,
				"error",
			);
			return;
		}

		// Immediately show processing state so the user gets visual feedback
		const nTotalChunksNow =
			document.querySelectorAll(".gemini-chunk-banner").length || 1;

		// Detect whether the Enhance Chapter button was already locked by an outer batch loop.
		// When called standalone (⚡ Enhance Chunk click), we own the button and must release it;
		// when called from the continue-loop in handleEnhanceClick, we must leave it alone.
		// Must be calculated BEFORE we build the banner so isBatchMode is available.
		const wasBtnAlreadyDisabled = Array.from(
			document.querySelectorAll(".gemini-enhance-btn"),
		).some((btn) => btn.disabled);

		const processingBanner = buildChunkBanner(
			chunking,
			chunkIndex,
			nTotalChunksNow,
			"processing",
			null,
			null,
			null,
			chunkBehaviorConfig.wordCountThreshold,
			null,
			wasBtnAlreadyDisabled, // isBatchMode — shows Skip in batch, Pause in single mode
		);
		const existingBannerPre = document.querySelector(
			`.chunk-banner-${chunkIndex}`,
		);
		if (existingBannerPre) {
			existingBannerPre.replaceWith(processingBanner);
		}

		if (!wasBtnAlreadyDisabled) {
			// Standalone individual enhance — lock the top button so the user can't
			// accidentally fire a concurrent batch enhancement.
			document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
				btn.disabled = true;
				btn.classList.add("loading");
			});
		}

		// Show / update the WIP banner immediately so the user sees live progress.
		const doneAtStart = document.querySelectorAll(
			'.gemini-chunk-content[data-chunk-enhanced="true"]',
		).length;
		const totalForWip =
			document.querySelectorAll(".gemini-chunk-content").length ||
			nTotalChunksNow;
		showWorkInProgressBanner(doneAtStart, totalForWip, "processing", null);

		try {
			await wakeUpBackgroundWorker();

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

			const combinedPrompt = await buildCombinedPrompt();

			const response = await sendMessageWithRetry({
				action: "reenhanceChunk",
				chunkIndex: chunkIndex,
				content: contentForEnhancement,
				title: document.title,
				siteSpecificPrompt: combinedPrompt,
				useEmoji: useEmoji,
			});

			if (response && response.success && response.result) {
				const modelInfo = response.result?.modelInfo || null;
				if (modelInfo) {
					lastChunkModelInfo = modelInfo;
				}

				// Check if user pressed Skip while this chunk was processing
				if (chunkControlRuntime?.consumeSkip(chunkIndex)) {
					debugLog(
						`Chunk ${chunkIndex} was skipped — discarding result.`,
					);
					// Reset banner to pending so user can enhance it later
					const nTotalForSkip = document.querySelectorAll(
						".gemini-chunk-banner",
					).length;
					const pendingBanner = buildChunkBanner(
						chunking,
						chunkIndex,
						nTotalForSkip,
						"pending",
						null,
						null,
						null,
						chunkBehaviorConfig.wordCountThreshold,
						() => handleReenhanceChunk(chunkIndex),
					);
					const skippedBannerEl = document.querySelector(
						`.chunk-banner-${chunkIndex}`,
					);
					if (skippedBannerEl)
						skippedBannerEl.replaceWith(pendingBanner);
					// Update WIP banner and release button if standalone
					const allForSkip =
						document.querySelectorAll(".gemini-chunk-content")
							.length || nTotalForSkip;
					const doneForSkip = document.querySelectorAll(
						'.gemini-chunk-content[data-chunk-enhanced="true"]',
					).length;
					showWorkInProgressBanner(
						doneForSkip,
						allForSkip,
						"paused",
						null,
					);
					if (!wasBtnAlreadyDisabled) {
						document
							.querySelectorAll(".gemini-enhance-btn")
							.forEach((btn) => {
								btn.textContent = "✨ Enhance with Gemini";
								btn.disabled = false;
								btn.classList.remove("loading");
							});
					}
					showStatusMessage(
						`Chunk ${chunkIndex + 1} skipped.`,
						"info",
						2000,
					);
					return;
				}

				if (chunkContent) {
					const sanitizedContent = sanitizeHTML(
						response.result.enhancedContent,
					);

					// Check if user pressed Pause while this chunk was processing
					if (chunkControlRuntime?.consumePause(chunkIndex)) {
						// Store enhanced content but don't apply it — user uses "Show Enhanced"
						chunkContent.setAttribute(
							"data-enhanced-chunk-content",
							sanitizedContent,
						);
						const nTotalForPause = document.querySelectorAll(
							".gemini-chunk-banner",
						).length;
						const pausedBanner = buildChunkBanner(
							chunking,
							chunkIndex,
							nTotalForPause,
							"paused",
						);
						const pausedBannerEl = document.querySelector(
							`.chunk-banner-${chunkIndex}`,
						);
						if (pausedBannerEl)
							pausedBannerEl.replaceWith(pausedBanner);
						// Update WIP banner (chunk not yet fully applied)
						const allForPause =
							document.querySelectorAll(".gemini-chunk-content")
								.length || nTotalForPause;
						const doneForPause = document.querySelectorAll(
							'.gemini-chunk-content[data-chunk-enhanced="true"]',
						).length;
						showWorkInProgressBanner(
							doneForPause,
							allForPause,
							"paused",
							null,
						);
						if (!wasBtnAlreadyDisabled) {
							document
								.querySelectorAll(".gemini-enhance-btn")
								.forEach((btn) => {
									btn.textContent = "✨ Enhance with Gemini";
									btn.disabled = false;
									btn.classList.remove("loading");
								});
						}
						showStatusMessage(
							`Chunk ${chunkIndex + 1} enhancement ready — click "✨ Show Enhanced" to apply.`,
							"info",
							4000,
						);
						return;
					}

					chunkContent.innerHTML = sanitizedContent;
					applyCollapsibleSections(chunkContent);
					chunkContent.setAttribute("data-chunk-enhanced", "true");
					// Store enhanced content so toggle can restore it later
					chunkContent.setAttribute(
						"data-enhanced-chunk-content",
						sanitizedContent,
					);

					// Update the banner to "completed" state.
					// The await below yields execution, so we query the banner
					// AFTER the await (fresh reference) to avoid a stale-node
					// situation where the banner was replaced during the yield.
					const nTotalChunks = document.querySelectorAll(
						".gemini-chunk-banner",
					).length;
					const settingsData = await browser.storage.local.get([
						"wordCountThreshold",
					]);
					const wct =
						settingsData.wordCountThreshold !== undefined
							? settingsData.wordCountThreshold
							: chunkBehaviorConfig.wordCountThreshold;
					const origWords = chunking.core.countWords(
						originalText || "",
					);
					const enhWords = chunking.core.countWords(sanitizedContent);
					const completedBanner = buildChunkBanner(
						chunking,
						chunkIndex,
						nTotalChunks,
						"completed",
						null,
						null,
						{ original: origWords, enhanced: enhWords },
						wct,
					);
					// Re-query after the await so we hold a live DOM reference
					const freshBanner = document.querySelector(
						`.chunk-banner-${chunkIndex}`,
					);
					if (freshBanner) {
						freshBanner.replaceWith(completedBanner);
					}
				}

				const nWrappers = document.querySelectorAll(
					".gemini-chunk-wrapper",
				).length;
				// Re-declare to avoid shadowing issues with the outer totalChunks var
				totalChunks = nWrappers;
				await chunking.cache.saveChunkToCache(
					window.location.href,
					chunkIndex,
					{
						originalContent: contentForEnhancement,
						enhancedContent: response.result.enhancedContent,
						wordCount: response.result.wordCount || 0,
						timestamp: Date.now(),
						totalChunks: nWrappers || undefined,
						modelInfo: modelInfo,
					},
				);

				// ── Update overall chapter UI state ──────────────────────────────────────
				const allChunkEls = document.querySelectorAll(
					".gemini-chunk-content",
				);
				const doneEls = document.querySelectorAll(
					'.gemini-chunk-content[data-chunk-enhanced="true"]',
				);
				const allDoneNow =
					doneEls.length === allChunkEls.length &&
					allChunkEls.length > 0;

				// Recalculate word counts across all chunks
				const chunkWordCounts = chunking.core?.countWords
					? {
							original: Array.from(allChunkEls).reduce(
								(s, c) =>
									s +
									chunking.core.countWords(
										c.getAttribute(
											"data-original-chunk-content",
										) || "",
									),
								0,
							),
							enhanced: Array.from(doneEls).reduce(
								(s, c) =>
									s + chunking.core.countWords(c.innerHTML),
								0,
							),
						}
					: null;

				// Update the WIP banner to reflect current completion
				showWorkInProgressBanner(
					doneEls.length,
					allChunkEls.length,
					allDoneNow ? "complete" : "paused",
					chunkWordCounts,
				);

				// Mark the chapter as having cached content so the top button is sensible
				hasCachedContent = true;

				if (allDoneNow) {
					// All chunks are now enhanced — update the top Enhance Chapter button
					document
						.querySelectorAll(".gemini-enhance-btn")
						.forEach((btn) => {
							btn.textContent = "🔄 Re-enhance with Gemini";
							btn.disabled = false;
							btn.classList.remove("loading");
						});
					if (cancelEnhanceButton)
						cancelEnhanceButton.style.display = "none";

					// Add master banner if not already present (individual chunk enhance path)
					const contentAreaForMaster = findContentArea();
					if (contentAreaForMaster && chunking?.ui) {
						const domIntegration = await loadDomIntegrationModule();
						domIntegration?.ensureMasterBannerRuntime?.({
							documentRef: document,
							contentArea: contentAreaForMaster,
							chunking,
							totalChunks: null,
							lastChunkModelInfo,
							shouldBannersBeHidden,
							onToggleAll: handleToggleAllChunks,
							onDeleteAll: handleDeleteAllChunks,
							confirmFn: confirm,
						});
					}

					// Update novel library now that all chunks are individually complete
					try {
						const novelContext = extractNovelContext();
						await addToNovelLibrary(novelContext);
					} catch (libraryError) {
						debugError(
							"Failed to update novel library after all chunks done:",
							libraryError,
						);
					}
					showStatusMessage(
						"Content fully enhanced with Gemini! ✨",
						"success",
					);
				} else {
					// Some chunks still unenhanced.
					// Only release the Enhance Chapter button if WE acquired it
					// (standalone individual enhancement). When called from the
					// batch continue-loop the outer loop owns the button state.
					if (!wasBtnAlreadyDisabled) {
						document
							.querySelectorAll(".gemini-enhance-btn")
							.forEach((btn) => {
								btn.textContent = "✨ Enhance with Gemini";
								btn.disabled = false;
								btn.classList.remove("loading");
							});
					}
					showStatusMessage(
						`Chunk ${chunkIndex + 1} re-enhanced successfully!`,
						"success",
					);
				}

				// Ensure the content area is marked as enhanced and text is selectable
				const contentAreaForCopy = findContentArea();
				if (contentAreaForCopy) {
					contentAreaForCopy.setAttribute(
						"data-showing-enhanced",
						"true",
					);
					enableCopyOnContentArea(contentAreaForCopy);
				}
				// ─────────────────────────────────────────────────────────────────────────
			} else {
				const errorMsg = response?.error || "Unknown error";
				const existingBanner = document.querySelector(
					`.chunk-banner-${chunkIndex}`,
				);
				if (existingBanner) {
					const totalChunks = document.querySelectorAll(
						".gemini-chunk-banner",
					).length;
					const errorBanner = buildChunkBanner(
						chunking,
						chunkIndex,
						totalChunks,
						"error",
						errorMsg,
					);
					existingBanner.replaceWith(errorBanner);
				}
				// Update WIP banner to show paused state (API returned error)
				const allChErr =
					document.querySelectorAll(".gemini-chunk-content").length ||
					nTotalChunksNow;
				const doneChErr = document.querySelectorAll(
					'.gemini-chunk-content[data-chunk-enhanced="true"]',
				).length;
				showWorkInProgressBanner(doneChErr, allChErr, "paused", null);
				if (!wasBtnAlreadyDisabled) {
					document
						.querySelectorAll(".gemini-enhance-btn")
						.forEach((btn) => {
							btn.textContent = "✨ Enhance with Gemini";
							btn.disabled = false;
							btn.classList.remove("loading");
						});
				}
				showStatusMessage(
					`Failed to re-enhance chunk ${chunkIndex + 1}: ${errorMsg}`,
					"error",
				);
			}
		} catch (error) {
			// Restore banner to error state so the user can retry
			const existingBanner = document.querySelector(
				`.chunk-banner-${chunkIndex}`,
			);
			if (existingBanner) {
				const totalChunks = document.querySelectorAll(
					".gemini-chunk-banner",
				).length;
				const errorBanner = buildChunkBanner(
					chunking,
					chunkIndex,
					totalChunks,
					"error",
					error.message || "Unknown error",
				);
				existingBanner.replaceWith(errorBanner);
			}
			// Update WIP banner to show paused state (exception thrown)
			const allChCatch =
				document.querySelectorAll(".gemini-chunk-content").length ||
				nTotalChunksNow;
			const doneChCatch = document.querySelectorAll(
				'.gemini-chunk-content[data-chunk-enhanced="true"]',
			).length;
			showWorkInProgressBanner(doneChCatch, allChCatch, "paused", null);
			if (!wasBtnAlreadyDisabled) {
				document
					.querySelectorAll(".gemini-enhance-btn")
					.forEach((btn) => {
						btn.textContent = "✨ Enhance with Gemini";
						btn.disabled = false;
						btn.classList.remove("loading");
					});
			}
			debugError("Error re-enhancing chunk:", error);
			showStatusMessage(
				`Error re-enhancing chunk ${chunkIndex + 1}: ${error.message}`,
				"error",
			);
		}
	}

	/**
	 * Enhance a specific chunk range (for per-chunk summary group enhance buttons)
	 */
	// async function handleEnhanceChunkRange(chunkIndices, startIndex, endIndex) {
	// 	debugLog(`Enhancing chunk range ${startIndex}-${endIndex}...`);

	// 	// Enhance each chunk one by one
	// 	for (const chunkIndex of chunkIndices) {
	// 		await handleReenhanceChunk(chunkIndex);
	// 	}

	// 	showStatusMessage(
	// 		`Chunks ${startIndex + 1}–${endIndex + 1} enhanced successfully`,
	// 		"success",
	// 		3000,
	// 	);
	// }

	async function handleChunkProcessed(message) {
		const chunking = await loadChunkingSystem();
		if (!chunking) return;

		const contentArea = findContentArea();
		if (!contentArea) return;

		// Get word count threshold for chunk warnings
		const settingsData = await browser.storage.local.get([
			"wordCountThreshold",
		]);
		const wordCountThreshold =
			settingsData.wordCountThreshold !== undefined
				? settingsData.wordCountThreshold
				: chunkBehaviorConfig.wordCountThreshold;

		const chunkIndex = message.chunkIndex;
		const totalChunks = message.totalChunks;
		const chunkResult = message.result;
		const chunkModelInfo = chunkResult?.modelInfo || null;
		if (chunkModelInfo) {
			lastChunkModelInfo = chunkModelInfo;
		}

		const chunkedContainer = document.getElementById(
			"gemini-chunked-content",
		);
		if (!chunkedContainer) return;

		const chunkWrapper = chunkedContainer.querySelector(
			`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
		);
		if (!chunkWrapper) {
			debugLog(
				`[handleChunkProcessed] WARNING: No DOM wrapper for chunk ${chunkIndex}/${totalChunks}. ` +
					"Background may have split into more chunks than content script expected.",
			);
			// Even if the wrapper is missing, honour the isComplete signal so the
			// enhance button is re-enabled and the WIP banner shows "complete".
			if (message.isComplete) {
				const completedInDom = document.querySelectorAll(
					'.gemini-chunk-content[data-chunk-enhanced="true"]',
				).length;
				showWorkInProgressBanner(
					completedInDom,
					totalChunks,
					"complete",
					null,
				);
				if (cancelEnhanceButton)
					cancelEnhanceButton.style.display = "none";
				document
					.querySelectorAll(".gemini-enhance-btn")
					.forEach((btn) => {
						btn.textContent = "🔄 Re-enhance with Gemini";
						btn.disabled = false;
						btn.classList.remove("loading");
					});
			}
			return;
		}

		if (chunkResult && chunkResult.enhancedContent) {
			const chunkContent = chunkWrapper.querySelector(
				".gemini-chunk-content",
			);
			if (chunkContent) {
				const sanitizedContent = sanitizeHTML(
					chunkResult.enhancedContent,
				);
				chunkContent.innerHTML = sanitizedContent;
				chunkContent.setAttribute("data-chunk-enhanced", "true");
				// Store enhanced content so toggle can restore it later
				chunkContent.setAttribute(
					"data-enhanced-chunk-content",
					sanitizedContent,
				);
			}

			await chunking.cache.saveChunkToCache(
				window.location.href,
				chunkIndex,
				{
					originalContent: chunkResult.originalContent || "",
					enhancedContent: chunkResult.enhancedContent,
					wordCount: chunkResult.wordCount || 0,
					timestamp: Date.now(),
					totalChunks: totalChunks,
					modelInfo: chunkModelInfo,
				},
			);
			const existingBanner = chunkWrapper.querySelector(
				".gemini-chunk-banner",
			);
			if (existingBanner) {
				// Calculate word counts for the updated chunk
				const chunkContent = chunkWrapper.querySelector(
					".gemini-chunk-content",
				);
				const originalContent =
					chunkContent?.getAttribute("data-original-chunk-content") ||
					"";
				const enhancedContent = chunkContent?.innerHTML || "";
				const originalWords = chunking.core.countWords(originalContent);
				const enhancedWords = chunking.core.countWords(enhancedContent);
				const wordCounts = {
					original: originalWords,
					enhanced: enhancedWords,
				};

				const newBanner = buildChunkBanner(
					chunking,
					chunkIndex,
					totalChunks,
					"completed",
					null,
					null,
					wordCounts,
					wordCountThreshold,
				);
				existingBanner.replaceWith(newBanner);
			}
		}

		const completedChunks = chunkedContainer.querySelectorAll(
			'.gemini-chunk-content[data-chunk-enhanced="true"]',
		).length;

		// Calculate running totals for word counts
		let wordCounts = null;
		if (chunking?.core?.countWords) {
			const allChunks = chunkedContainer.querySelectorAll(
				".gemini-chunk-content",
			);
			let totalOriginalWords = 0;
			let totalEnhancedWords = 0;

			allChunks.forEach((chunk) => {
				const originalContent =
					chunk.getAttribute("data-original-chunk-content") || "";
				const isEnhanced =
					chunk.getAttribute("data-chunk-enhanced") === "true";
				const content = isEnhanced ? chunk.innerHTML : originalContent;

				totalOriginalWords += chunking.core.countWords(originalContent);
				if (isEnhanced) {
					totalEnhancedWords += chunking.core.countWords(content);
				}
			});

			wordCounts = {
				original: totalOriginalWords,
				enhanced: totalEnhancedWords,
			};
		}

		showWorkInProgressBanner(
			completedChunks,
			totalChunks,
			"processing",
			wordCounts,
		);

		if (message.isComplete) {
			showWorkInProgressBanner(
				totalChunks,
				totalChunks,
				"complete",
				wordCounts,
			);
			if (cancelEnhanceButton) {
				cancelEnhanceButton.style.display = "none";
			}

			document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
				btn.textContent = "🔄 Re-enhance with Gemini";
				btn.disabled = false;
				btn.classList.remove("loading");
			});

			if (contentArea && chunking?.ui) {
				const domIntegration = await loadDomIntegrationModule();
				domIntegration?.ensureMasterBannerRuntime?.({
					documentRef: document,
					contentArea,
					chunking,
					totalChunks,
					lastChunkModelInfo,
					shouldBannersBeHidden,
					onToggleAll: handleToggleAllChunks,
					onDeleteAll: handleDeleteAllChunks,
					confirmFn: confirm,
				});

				// Update the main summary text container's data-group-end to match the
				// real total so summarizeChunkRange can find it by index range matching.
				const mainSummaryText = document.querySelector(
					".gemini-main-summary-text",
				);
				if (mainSummaryText) {
					mainSummaryText.setAttribute(
						"data-group-end",
						String(totalChunks - 1),
					);
				}
			}

			// Update novel library when all chunks are complete (batch path)
			try {
				const novelContext = extractNovelContext();
				await addToNovelLibrary(novelContext);
			} catch (libraryError) {
				debugError(
					"Failed to update novel library after batch chunk completion:",
					libraryError,
				);
			}
		}

		// Re-enable text selection after each chunk update (batch enhancement path)
		if (contentArea) enableCopyOnContentArea(contentArea);
	}

	async function handleChunkError(message) {
		const chunking = await loadChunkingSystem();
		if (!chunking) return;

		const chunkIndex = message.chunkIndex;
		const totalChunks = message.totalChunks;

		const chunkedContainer = document.getElementById(
			"gemini-chunked-content",
		);
		if (!chunkedContainer) return;

		const chunkWrapper = chunkedContainer.querySelector(
			`.gemini-chunk-wrapper[data-chunk-index="${chunkIndex}"]`,
		);
		if (!chunkWrapper) return;

		// Guard: if this chunk has already been successfully enhanced (e.g. a
		// stale or late-arriving error message from the batch run that arrived
		// after a manual re-enhance succeeded), do NOT replace the completed
		// banner with an error banner.
		const chunkContent = chunkWrapper.querySelector(
			".gemini-chunk-content",
		);
		if (chunkContent?.getAttribute("data-chunk-enhanced") === "true") {
			debugLog(
				`[handleChunkError] Chunk ${chunkIndex} is already enhanced — ignoring late error: ${message.error}`,
			);
			return;
		}

		const existingBanner = chunkWrapper.querySelector(
			".gemini-chunk-banner",
		);
		if (existingBanner) {
			// Use the actual DOM wrapper count so nav arrows reflect reality
			// (message.totalChunks can be stale/off-by-one when batches overlap)
			const actualTotalChunks =
				chunkedContainer.querySelectorAll(".gemini-chunk-wrapper")
					.length || totalChunks;
			const errorBanner = buildChunkBanner(
				chunking,
				chunkIndex,
				actualTotalChunks,
				"error",
				message.error,
			);
			existingBanner.replaceWith(errorBanner);
		}

		showStatusMessage(
			`Error processing chunk ${chunkIndex + 1}: ${message.error}`,
			"error",
		);
	}

	// eslint-disable-next-line no-unused-vars
	function renderSummaryOutput(container, summary, summaryType) {
		if (summaryRuntimeModule?.renderSummaryOutputRuntime) {
			summaryRuntimeModule.renderSummaryOutputRuntime({
				container,
				summary,
				summaryType,
				summaryService: summaryServiceModule,
				findContentArea,
				stripHtmlTags,
				documentRef: document,
				windowRef: window,
			});
			return;
		}

		// Safety fallback while the runtime module is unavailable.
		if (summaryServiceModule?.renderSummaryInContainer) {
			summaryServiceModule.renderSummaryInContainer(
				container,
				summary,
				summaryType,
			);
			return;
		}

		if (!container) return;
		container.style.display = "block";
		container.style.textAlign = "left";
		container.textContent = stripHtmlTags(summary);
	}

	const PENDING_SUMMARY_REVIEW_KEY = "rg_pending_summary_reviews";

	async function queueSummaryReviewRecommendation({ isShort, chunkIndices }) {
		if (!summaryRuntimeModule?.queueSummaryReviewRecommendationRuntime) {
			return;
		}

		await summaryRuntimeModule.queueSummaryReviewRecommendationRuntime({
			storageApi: browser.storage.local,
			pendingKey: PENDING_SUMMARY_REVIEW_KEY,
			isShort,
			chunkIndices,
			lastKnownNovelData: getLastKnownNovelData(),
			documentRef: document,
			windowRef: window,
		});
	}

	async function summarizeChunkRange(
		chunkIndices,
		isShort,
		groupStartIndex = null,
	) {
		// Try the dedicated summary-service module first
		try {
			const svc = await loadSummaryService();
			if (svc) {
				debugLog(
					`Summary service loaded — delegating ${isShort ? "short" : "long"} summary for chunks`,
					chunkIndices,
				);
				const result = await svc.summarize(chunkIndices, isShort);
				await queueSummaryReviewRecommendation({
					isShort,
					chunkIndices,
				});
				return result;
			}
		} catch (svcErr) {
			debugError("Summary service threw during summarize:", svcErr);
		}

		// ── Inline fallback — runs when the ES-module import fails ──
		debugLog(
			"Summary service unavailable — using inline fallback for",
			isShort ? "short" : "long",
			"summary",
		);

		const summaryType = isShort ? "Short" : "Long";
		const statusDiv = document.getElementById("gemini-status");

		// Determine if this is main (full chapter) or per-chunk summary
		const isMainSummary =
			groupStartIndex === null ||
			(groupStartIndex === 0 && chunkIndices.length > 1);

		// Locate button to give feedback
		let btn = null;
		if (isMainSummary) {
			const btnClass = isShort
				? ".gemini-main-short-summary-btn"
				: ".gemini-main-long-summary-btn";
			btn = document.querySelector(btnClass);
		} else {
			// Find the per-chunk summary button within the correct group
			const group = document.querySelector(
				`.gemini-chunk-summary-group[data-start-index="${groupStartIndex}"]`,
			);
			if (group) {
				const btnClass = isShort
					? ".gemini-chunk-short-summary-btn"
					: ".gemini-chunk-long-summary-btn";
				btn = group.querySelector(btnClass);
			}
		}
		const originalBtnText = btn?.textContent || "";

		// Locate or create summary text container
		let summaryTextContainer;
		if (isMainSummary) {
			summaryTextContainer =
				document.querySelector(".gemini-main-summary-text") ||
				document.querySelector(
					".gemini-summary-text-container[data-group-start='0']",
				);
		} else {
			// Find container within the correct per-chunk group
			summaryTextContainer = document.querySelector(
				`.gemini-summary-text-container[data-group-start="${groupStartIndex}"]`,
			);
		}

		try {
			// 1. Wake up background
			if (btn) {
				btn.disabled = true;
				btn.textContent = "Waking up AI…";
			}
			if (statusDiv) statusDiv.textContent = "Waking up AI service…";

			const isReady = await wakeUpBackgroundWorker();
			if (!isReady) {
				throw new Error(
					"Background service is not responding. Please try again.",
				);
			}

			// 2. Collect content (three-tier fallback)
			if (btn) btn.textContent = "Extracting content…";
			if (statusDiv) statusDiv.textContent = "Extracting content…";
			if (summaryTextContainer) {
				summaryTextContainer.style.display = "block";
				summaryTextContainer.textContent = `Generating ${summaryType.toLowerCase()} summary…`;
			}

			let contentText = null;
			let contentSource = "none";

			// 2a. Chunk DOM elements
			const chunkTexts = chunkIndices
				.map((index) => {
					const el = document.querySelector(
						`.gemini-chunk-content[data-chunk-index="${index}"]`,
					);
					if (!el) return "";
					const isEnhanced =
						el.getAttribute("data-chunk-enhanced") === "true";
					const html = isEnhanced
						? el.innerHTML
						: el.getAttribute("data-original-chunk-html") ||
							el.innerHTML;
					return stripHtmlTags(html || "");
				})
				.filter((t) => t?.trim().length > 0);

			if (chunkTexts.length > 0) {
				contentText = chunkTexts.join("\n\n");
				contentSource = "chunks";
			}

			// 2b. Stored original text
			if (!contentText) {
				const contentArea = findContentArea();
				const storedOriginal = contentArea
					?.getAttribute("data-original-text")
					?.trim();
				if (storedOriginal) {
					contentText = storedOriginal;
					contentSource = "data-original-text";
				}
			}

			// 2c. Live extraction
			if (!contentText) {
				const extracted = extractContent();
				if (extracted && extracted.text?.trim()) {
					contentText = extracted.text.trim();
					contentSource = "live-extraction";
				}
			}

			if (!contentText) {
				const msg =
					"No content found on this page. Make sure a chapter page is loaded.";
				showStatusMessage(msg, "warning", 5000);
				if (summaryTextContainer) {
					summaryTextContainer.style.display = "block";
					summaryTextContainer.textContent = msg;
				}
				return;
			}

			debugLog(
				`Inline fallback collected ${contentText.length} chars from ${contentSource}`,
			);

			// 3. Send to background for summarisation
			if (btn) btn.textContent = "Summarising…";
			if (statusDiv) {
				statusDiv.textContent = `Sending to Gemini for ${summaryType.toLowerCase()} summary…`;
			}

			const action = isShort
				? "shortSummarizeWithGemini"
				: "summarizeWithGemini";
			const response = await sendMessageWithRetry({
				action,
				title: document.title,
				content: contentText,
			});

			if (!response?.success || !response.summary) {
				const errMsg = response?.error || "Failed to generate summary.";
				if (errMsg.includes("API key is missing")) {
					showStatusMessage(
						"API key is missing. Opening settings page…",
						"error",
					);
					browser.runtime.sendMessage({ action: "openPopup" });
				}
				throw new Error(errMsg);
			}

			// 4. Render result
			renderSummaryOutput(
				summaryTextContainer,
				response.summary,
				summaryType,
			);
			if (statusDiv) {
				statusDiv.textContent = "Summary generated successfully!";
			}
			showStatusMessage(
				`${summaryType} summary generated!`,
				"success",
				3000,
			);
			await queueSummaryReviewRecommendation({
				isShort,
				chunkIndices,
			});
			// Track chapter as summarized in the library
			try {
				const cachedNovelData = getLastKnownNovelData();
				const novelId = cachedNovelData?.id;
				const chapterNumber = cachedNovelData?.currentChapter;
				if (novelId && chapterNumber != null) {
					if (!novelLibrary) await loadNovelLibrary();
					if (novelLibrary) {
						const totalChunkEls = document.querySelectorAll(
							".gemini-chunk-content",
						);
						await novelLibrary.updateChapter(novelId, {
							chapterNumber,
							url: window.location.href,
							isSummarized: true,
							summaryType: isShort ? "short" : "long",
							totalChunksForChapter: totalChunkEls.length || 1,
							summarizedAt: Date.now(),
						});
					}
				}
			} catch (_e) {
				/* silent */
			}
		} catch (error) {
			debugError("Inline summary fallback error:", error);
			if (statusDiv) {
				statusDiv.textContent = error.message.includes("API key")
					? "API key is missing. Please check the settings."
					: `Error: ${error.message}`;
			}
			if (summaryTextContainer) {
				summaryTextContainer.style.display = "block";
				summaryTextContainer.textContent = `Failed to generate summary: ${error.message}`;
			}
		} finally {
			if (btn) {
				btn.disabled = false;
				btn.textContent = originalBtnText;
			}
			setTimeout(() => {
				if (statusDiv?.textContent?.includes("Summary generated")) {
					statusDiv.textContent = "";
				}
			}, 5000);
		}
	}

	// Function to create a work-in-progress banner
	function createWorkInProgressBanner(
		completedChunks,
		totalChunks,
		state = "processing",
		wordCounts = null,
	) {
		const safeTotal = Math.max(totalChunks, 1);
		const clampedCompleted = Math.min(
			Math.max(completedChunks, 0),
			safeTotal,
		);
		const progressPercent = Math.round(
			(clampedCompleted / safeTotal) * 100,
		);
		const isComplete =
			state === "complete" || clampedCompleted >= safeTotal;
		const isPaused = state === "paused";

		const titleText = isComplete
			? "Enhancement Complete"
			: isPaused
				? "Enhancement Paused"
				: "Enhancing Content";
		// ? "⏸️ Enhancement Paused"
		// : "⏳ Enhancing Content";

		const statusLine = isComplete
			? `All ${safeTotal} chunk${safeTotal > 1 ? "s" : ""} completed.`
			: isPaused
				? `Enhancement paused at ${clampedCompleted} of ${safeTotal} chunks.`
				: `Completed ${clampedCompleted} of ${safeTotal} chunks.`;

		// Word count display
		let wordCountHTML = "";
		if (
			wordCounts &&
			typeof wordCounts.original === "number" &&
			typeof wordCounts.enhanced === "number"
		) {
			const diff = wordCounts.enhanced - wordCounts.original;
			const diffPercent =
				wordCounts.original > 0
					? Math.round((diff / wordCounts.original) * 100)
					: 0;
			const diffColor =
				diff > 0 ? "#4ade80" : diff < 0 ? "#f87171" : "#94a3b8";
			const diffSign = diff > 0 ? "+" : "";

			wordCountHTML = `
				<div style="margin: 12px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 13px;">
					<div style="display: flex; justify-content: space-around; text-align: center; flex-wrap: wrap; gap: 10px;">
						<div>
							<div style="color: #94a3b8; font-size: 11px; margin-bottom: 4px;">Original</div>
							<div style="font-weight: 600;">${wordCounts.original.toLocaleString()} words</div>
						</div>
						<div>
							<div style="color: #94a3b8; font-size: 11px; margin-bottom: 4px;">Enhanced</div>
							<div style="font-weight: 600;">${wordCounts.enhanced.toLocaleString()} words</div>
						</div>
						<div>
							<div style="color: #94a3b8; font-size: 11px; margin-bottom: 4px;">Difference</div>
							<div style="font-weight: 600; color: ${diffColor};">${diffSign}${diff.toLocaleString()} (${diffSign}${diffPercent}%)</div>
						</div>
					</div>
				</div>
			`;
		}

		const banner = document.createElement("div");
		banner.className = "gemini-wip-banner";
		banner.style.cssText = `
			background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
			border: 1px solid #475569;
			border-radius: 8px;
			padding: 16px;
			margin: 16px 0;
			box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
			color: #e5e7eb;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
			box-sizing: border-box;
			width: 100%;
			max-width: 100%;
			overflow: hidden;
		`;

		banner.innerHTML = `
			<div style="display: flex; align-items: center; margin-bottom: 8px;">
				<span style="font-size: 18px; margin-right: 10px;">${isComplete ? "✅" : isPaused ? "⏸️" : "⏳"}</span>
				<span style="font-weight: bold; font-size: 16px;">${titleText}</span>
			</div>
			<div style="width: 100%; margin: 10px 0; background: #475569; height: 10px; border-radius: 5px; overflow: hidden;">
				<div class="progress-bar" style="width: ${progressPercent}%; background: ${isComplete ? "#4ade80" : isPaused ? "#fb923c" : "#3b82f6"}; height: 100%; transition: width 0.3s ease;"></div>
			</div>
			<div class="progress-text" style="font-size: 14px; color: #cbd5e1;">
				${statusLine}
			</div>
			${wordCountHTML}
			${
				isComplete
					? ""
					: `
				<button class="gemini-cancel-btn" style="margin-top: 10px; padding: 8px 14px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; transition: background 0.2s; font-weight: 600; min-height: 40px; max-width: 100%;">
					Cancel Enhancement
				</button>
			`
			}
			${
				isComplete || isPaused
					? `
				<button class="gemini-wip-show-original-btn" style="margin-top: 10px; padding: 8px 14px; background: #334155; color: #e2e8f0; border: 1px solid #475569; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; min-height: 40px; max-width: 100%;">
					👁 Show Original
				</button>
			`
					: ""
			}
		`;

		// Add cancel button handler
		if (!isComplete) {
			const cancelBtn = banner.querySelector(".gemini-cancel-btn");
			if (cancelBtn) {
				cancelBtn.addEventListener("click", handleCancelEnhancement);
				cancelBtn.addEventListener("mouseenter", () => {
					cancelBtn.style.background = "#b91c1c";
				});
				cancelBtn.addEventListener("mouseleave", () => {
					cancelBtn.style.background = "#dc3545";
				});
			}
		}

		// Show Original / Show Enhanced toggle — syncs with the master banner toggle
		const showOrigBtn = banner.querySelector(
			".gemini-wip-show-original-btn",
		);
		if (showOrigBtn) {
			showOrigBtn.addEventListener("click", () => {
				handleToggleAllChunks();
				// Mirror the master banner's new state so both buttons stay in sync
				const masterToggle = document.querySelector(
					".gemini-master-toggle-all-btn",
				);
				const isNowOriginal =
					masterToggle?.getAttribute("data-showing") === "original";
				showOrigBtn.textContent = isNowOriginal
					? "✨ Show Enhanced"
					: "👁 Show Original";
			});
		}

		return banner;
	}

	function showWorkInProgressBanner(
		completedChunks,
		totalChunks,
		state = "processing",
		wordCounts = null,
	) {
		const newBanner = createWorkInProgressBanner(
			completedChunks,
			totalChunks,
			state,
			wordCounts,
		);
		void (async () => {
			const domIntegration = await loadDomIntegrationModule();
			if (domIntegration?.upsertWorkInProgressBannerRuntime) {
				domIntegration.upsertWorkInProgressBannerRuntime({
					documentRef: document,
					newBanner,
					findContentArea,
				});
				return;
			}

			const existingBanner = document.querySelector(".gemini-wip-banner");
			if (existingBanner && existingBanner.parentNode) {
				existingBanner.parentNode.replaceChild(
					newBanner,
					existingBanner,
				);
				return;
			}

			const contentArea = findContentArea();
			if (!contentArea) return;

			const chunkedContainer = document.getElementById(
				"gemini-chunked-content",
			);
			if (chunkedContainer) {
				contentArea.insertBefore(newBanner, chunkedContainer);
				return;
			}

			contentArea.insertBefore(newBanner, contentArea.firstChild);
		})();
	}

	/**
	 * Add model attribution to the content area
	 * @param {Object} modelInfo - Information about the model used
	 */
	// eslint-disable-next-line no-unused-vars
	function addModelAttribution(modelInfo) {
		if (!modelInfo) return;

		const contentArea = findContentArea();
		if (!contentArea) return;

		// Check if attribution already exists
		if (document.querySelector(".gemini-model-attribution")) return;

		const isDarkMode =
			document.querySelector(
				'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth',
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
	// eslint-disable-next-line no-unused-vars
	function createMainSummaryBanner(modelInfo, totalChunks, completedChunks) {
		const contentArea = findContentArea();
		const originalText =
			contentArea?.getAttribute("data-original-text") || "";

		// Calculate total enhanced word count from all chunks
		let totalEnhancedWords = 0;
		const allChunkContents = document.querySelectorAll(
			".gemini-chunk-content",
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
				'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth',
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
								wordDifference,
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
						"Are you sure you want to delete all cached enhanced content for this chapter?",
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
		void (async () => {
			const batch = await loadChunkBatchModule();
			if (!batch?.toggleAllChunksRuntime) return;
			batch.toggleAllChunksRuntime({
				documentRef: document,
				escapeHtml,
			});
		})();
	}

	/**
	 * Delete all cached chunk data and revert to original
	 */
	async function handleDeleteAllChunks() {
		const batch = await loadChunkBatchModule();
		if (!batch?.deleteAllChunksRuntime) return;

		await batch.deleteAllChunksRuntime({
			findContentArea,
			loadChunkingSystem,
			storageManager,
			windowRef: window,
			documentRef: document,
			showStatusMessage,
			onResetCacheFlags: () => {
				isCachedContent = false;
				hasCachedContent = false;
			},
		});
	}

	// Handler for all chunks processed notification
	function handleAllChunksProcessed(message) {
		debugLog(
			`All chunks processed: ${message.totalProcessed}/${message.totalChunks} successful`,
		);

		document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
			btn.textContent = "🔄 Re-enhance with Gemini";
			btn.disabled = false;
			btn.classList.remove("loading");
		});

		if (message.failedChunks && message.failedChunks.length > 0) {
			// Race-condition guard: a stale allChunksProcessed message can arrive
			// after the user has already manually re-enhanced those chunks.
			// Filter to only the chunks that are *actually* still unenhanced.
			const actuallyStillFailed = message.failedChunks.filter((i) => {
				const cc = document.querySelector(
					`.gemini-chunk-content[data-chunk-index="${i}"]`,
				);
				return cc?.getAttribute("data-chunk-enhanced") !== "true";
			});

			if (actuallyStillFailed.length === 0) {
				// Every "failed" chunk has since been re-enhanced — check if
				// the whole chapter is now complete and show that state instead.
				const allChunkEls = document.querySelectorAll(
					".gemini-chunk-content",
				);
				const doneEls = document.querySelectorAll(
					'.gemini-chunk-content[data-chunk-enhanced="true"]',
				);
				if (
					doneEls.length === allChunkEls.length &&
					allChunkEls.length > 0
				) {
					showWorkInProgressBanner(
						doneEls.length,
						allChunkEls.length,
						"complete",
						null,
					);
					return;
				}
			}

			// Update WIP banner to paused state so it no longer shows "Enhancing..."
			const completedInDom = document.querySelectorAll(
				'.gemini-chunk-content[data-chunk-enhanced="true"]',
			).length;
			showWorkInProgressBanner(
				completedInDom,
				message.totalChunks,
				"paused",
				null,
			);
			if (cancelEnhanceButton) cancelEnhanceButton.style.display = "none";
			const successPercentage = Math.round(
				(message.totalProcessed / message.totalChunks) * 100,
			);
			showStatusMessage(
				`Partially enhanced ${message.totalProcessed} of ${message.totalChunks} chunks (${successPercentage}% complete). You can re-enhance failed chunks.`,
				"warning",
			);
			return;
		}

		showStatusMessage(
			`Content successfully enhanced with Gemini! (${message.totalProcessed} chunks processed)`,
			"success",
		);
	}

	// Helper function to finalize the progressive content display
	// eslint-disable-next-line no-unused-vars
	async function finalizePrefixEnhancedContent(modelInfo) {
		const contentArea = findContentArea();
		if (!contentArea) return;

		// Get the enhanced container (where chunks were added)
		const enhancedContainer = document.getElementById(
			"gemini-enhanced-container",
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
					saveError,
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
			isCachedContent,
		);

		attachDeleteCacheButtonHandler(banner);

		// Get the toggle button from the banner
		const toggleButton = banner.querySelector(".gemini-toggle-btn");
		if (toggleButton) {
			const toggleContent = function () {
				const isShowingEnhanced =
					contentArea.getAttribute("data-showing-enhanced") ===
					"true";
				if (isShowingEnhanced) {
					// Switch to original
					contentArea.innerHTML = originalContent;
					contentArea.setAttribute("data-showing-enhanced", "false");
					showStatusMessage(
						"Showing original content. Click 'Show Enhanced' to view the improved version.",
					);
					refreshToggleBanner({
						contentArea,
						createBanner: () =>
							createEnhancedBanner(
								originalText,
								enhancedText,
								modelInfo,
								isCachedContent,
							),
						toggleLabel: "Show Enhanced",
						onToggleClick: toggleContent,
						insertBeforeNode: contentArea.firstChild,
						wireDeleteCache: true,
					});
				} else {
					// Switch back to enhanced
					contentArea.innerHTML = "";
					contentArea.appendChild(enhancedContainer);
					contentArea.setAttribute("data-showing-enhanced", "true");
					showStatusMessage(
						"Showing enhanced content. Click 'Show Original' to view the original version.",
					);
					refreshToggleBanner({
						contentArea,
						createBanner: () =>
							createEnhancedBanner(
								originalText,
								enhancedText,
								modelInfo,
								isCachedContent,
							),
						toggleLabel: "Show Original",
						onToggleClick: toggleContent,
						insertBeforeNode: enhancedContainer,
						wireDeleteCache: true,
					});
				}
			};
			toggleButton.addEventListener("click", toggleContent);
		}

		// Store state for toggling
		contentArea.setAttribute("data-showing-enhanced", "true");

		// Remove any existing enhanced banner before inserting a new one
		const existingBanner = contentArea.querySelector(
			".gemini-enhanced-banner",
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

		if (domIntegrationModule?.clearTransientEnhancementBannersRuntime) {
			domIntegrationModule.clearTransientEnhancementBannersRuntime({
				documentRef: document,
				removeErrorBanner: true,
			});
		} else {
			const wipBanner = document.querySelector(".gemini-wip-banner");
			if (wipBanner) {
				wipBanner.remove();
			}

			// Remove any existing error banners since we're done
			const errorBanner = document.querySelector(".gemini-error-banner");
			if (errorBanner) {
				errorBanner.remove();
			}
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

	// Guard flag to prevent double-initialization from DOMContentLoaded + load firing together
	let __rgInitStarted = false;

	// Initialize with device detection
	async function initializeWithDeviceDetection() {
		if (__rgInitStarted) {
			debugLog(
				"Ranobe Gemini: Initialization already in progress, skipping duplicate call.",
			);
			return;
		}
		__rgInitStarted = true;
		isMobileDevice = detectMobileDevice();
		debugLog(
			`Ranobe Gemini: Initializing for ${
				isMobileDevice ? "mobile" : "desktop"
			} device`,
		);
		await initialize();
	}

	// Adjust UI based on device type
	function adjustUIForDeviceType() {
		const containers = [
			document.getElementById("gemini-controls"),
			document.getElementById("rg-novel-controls"),
		].filter(Boolean);

		containers.forEach((container) => {
			if (isMobileDevice) {
				container.classList.add("mobile-view");
			} else {
				container.classList.remove("mobile-view");
			}
		});
	}

	// Load handler modules dynamically
	async function loadHandlers() {
		// Handlers are loaded directly by relative import, no URL needed
		return { handlersLoaded: true };
	}

	// Get the appropriate handler for the current site
	async function getHandlerForCurrentSite() {
		try {
			const handlerUrls = await loadHandlers();
			if (!handlerUrls) return null;

			// Import handler manager using extension URL
			const handlerManagerUrl = browser.runtime.getURL(
				"utils/website-handlers/handler-manager.js",
			);
			const handlerManagerModule = await import(handlerManagerUrl);

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
					handler ? handler.constructor.name : "null",
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
				"utils/storage-manager.js",
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
	// eslint-disable-next-line no-unused-vars
	let SHELVES = null;
	let READING_STATUS = null;
	let READING_STATUS_INFO = null;

	// Load site settings helpers
	async function loadSiteSettingsModule() {
		try {
			// Site settings module is in utils/site-settings.js
			const settingsUrl = browser.runtime.getURL(
				"utils/site-settings.js",
			);
			const settingsModule = await import(settingsUrl);
			return settingsModule;
		} catch (error) {
			debugError("Error loading site settings:", error);
			return null;
		}
	}

	// Load extension bridge helpers
	async function loadExtensionBridgesModule() {
		try {
			const bridgesUrl = browser.runtime.getURL(
				"utils/extension-bridges.js",
			);
			const bridgesModule = await import(bridgesUrl);
			return bridgesModule;
		} catch (error) {
			debugError("Error loading extension bridge helpers:", error);
			return null;
		}
	}

	async function loadChunkControlRuntime() {
		if (chunkControlRuntime) return chunkControlRuntime;
		try {
			const controlsUrl = browser.runtime.getURL(
				"content/modules/chunk-controls.js",
			);
			const controlsModule = await import(controlsUrl);
			if (!controlsModule?.createChunkControlRuntime) return null;
			chunkControlRuntime = controlsModule.createChunkControlRuntime();
			return chunkControlRuntime;
		} catch (error) {
			debugError("Error loading chunk control runtime:", error);
			return null;
		}
	}

	// Inject handler-specific custom CSS from settings
	async function injectHandlerCustomCSS() {
		if (!currentHandler) return;

		const handlerShelfId = currentHandler?.constructor?.SHELF_METADATA?.id;
		if (!handlerShelfId) return;

		try {
			// Fetch handler settings from background
			const response = await sendMessageWithRetry(
				{
					action: "getHandlerSettings",
					handlerDomain: handlerShelfId,
				},
				2,
				500,
			); // Reduced retries and delay for non-critical operation

			if (!response || !response.success || !response.settings) {
				debugLog(
					`No custom CSS settings available for ${handlerShelfId}`,
				);
				return;
			}

			const handlerSettings =
				response.settings[handlerShelfId]?.validated ||
				response.settings[handlerShelfId]?.proposed ||
				{};

			// Extract CSS fields
			const globalCSS = handlerSettings.globalCSS?.trim() || "";
			const logoCSS = handlerSettings.logoCSS?.trim() || "";

			// Inject globalCSS if provided
			if (globalCSS) {
				const globalStyleId = `rg-handler-global-css-${handlerShelfId}`;
				if (!document.getElementById(globalStyleId)) {
					const styleTag = document.createElement("style");
					styleTag.id = globalStyleId;
					styleTag.textContent = globalCSS;
					document.head.appendChild(styleTag);
					debugLog(
						`Injected global CSS for handler: ${handlerShelfId}`,
					);
				}
			}

			// Inject logoCSS if provided
			if (logoCSS) {
				const logoStyleId = `rg-handler-logo-css-${handlerShelfId}`;
				if (!document.getElementById(logoStyleId)) {
					const styleTag = document.createElement("style");
					styleTag.id = logoStyleId;
					styleTag.textContent = logoCSS;
					document.head.appendChild(styleTag);
					debugLog(
						`Injected logo CSS for handler: ${handlerShelfId}`,
					);
				}
			}

			// Load per-handler font size
			if (handlerSettings.fontSize !== undefined) {
				const handlerFontSize = parseInt(handlerSettings.fontSize, 10);
				if (
					!isNaN(handlerFontSize) &&
					handlerFontSize >= 50 &&
					handlerFontSize <= 200
				) {
					currentFontSize = handlerFontSize;
					debugLog(
						`Using handler-specific font size: ${currentFontSize}%`,
					);
				}
			}
		} catch (error) {
			// Silently fail for CSS injection - not critical
			debugLog(
				`Could not load custom CSS for ${handlerShelfId}: ${error.message}`,
			);
		}
	}

	// ── Custom box type CSS injection ──────────────────────────────────────────
	let customBoxTypesModule = null;

	async function loadCustomBoxTypesModule() {
		if (customBoxTypesModule) return customBoxTypesModule;
		try {
			const url = browser.runtime.getURL("utils/custom-box-types.js");
			customBoxTypesModule = await import(url);
			return customBoxTypesModule;
		} catch (_err) {
			return null;
		}
	}

	/**
	 * Inject (or refresh) a <style> tag for user-defined custom content box types.
	 * Idempotent — updates the existing tag on subsequent calls.
	 */
	async function injectCustomBoxCSS() {
		try {
			const mod = await loadCustomBoxTypesModule();
			if (!mod) return;
			const boxTypes = await mod.getCustomBoxTypes();
			const css = mod.generateCSSForBoxTypes(boxTypes);
			const styleId = "rg-custom-box-styles";
			let tag = document.getElementById(styleId);
			if (!tag) {
				tag = document.createElement("style");
				tag.id = styleId;
				document.head.appendChild(tag);
			}
			tag.textContent = css;
		} catch (_err) {
			// non-critical
		}
	}

	// Refresh custom box CSS whenever the user changes settings
	try {
		browser.storage.onChanged.addListener((changes, area) => {
			if (area === "local" && changes.rg_custom_box_types) {
				injectCustomBoxCSS();
			}
		});
	} catch (_err) {
		// non-critical
	}

	/**
	 * Build the combined prompt for a Gemini request:
	 * site-specific + optional novel-custom + custom box types appendix.
	 * @param {string} [novelCustomPrompt]
	 * @returns {Promise<string>}
	 */
	async function buildCombinedPrompt(novelCustomPrompt) {
		let prompt = currentHandler
			? currentHandler.getSiteSpecificPrompt()
			: "";
		if (novelCustomPrompt) {
			prompt = prompt
				? `${prompt}\n\n${novelCustomPrompt}`
				: novelCustomPrompt;
		}
		try {
			const mod = await loadCustomBoxTypesModule();
			if (mod) {
				const boxTypes = await mod.getCustomBoxTypes();
				const appendix = mod.buildCustomBoxPromptAppendix(boxTypes);
				if (appendix) {
					prompt = prompt ? `${prompt}\n\n${appendix}` : appendix;
				}
			}
		} catch (_err) {
			// non-critical — fall back to prompt without custom boxes
		}
		return prompt;
	}

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

	// Shared chunking system loader - NEW WORD-BASED MODULAR SYSTEM
	let chunkingSystem = null;
	async function loadChunkingSystem() {
		if (chunkingSystem) return chunkingSystem;
		try {
			// Load new modular chunking system
			const chunkingUrl = browser.runtime.getURL(
				"utils/chunking/index.js",
			);
			const chunkingModule = await import(chunkingUrl);
			// Store default export with namespaces: { config, core, cache, ui, summaryUI }
			chunkingSystem = chunkingModule.default;
			return chunkingSystem;
		} catch (error) {
			debugError("Error loading chunking system:", error);
			return null;
		}
	}

	// ── Collapsible sections module ──────────────────────────────
	let collapsibleSectionsModule = null;

	async function loadCollapsibleSectionsModule() {
		if (collapsibleSectionsModule) return collapsibleSectionsModule;
		try {
			const url = browser.runtime.getURL("utils/collapsible-sections.js");
			collapsibleSectionsModule = await import(url);
			return collapsibleSectionsModule;
		} catch (err) {
			debugError("Error loading collapsible-sections module:", err);
			return null;
		}
	}

	/**
	 * Post-process an enhanced chunk container: transform any
	 * rg-collapsible-section / rg-author-note[data-collapse] elements into
	 * interactive collapse/expand widgets according to the user's settings.
	 * @param {Element} chunkContent
	 */
	async function applyCollapsibleSections(chunkContent) {
		if (!chunkContent) return;
		// Quick bail-out if no collapsible sections present
		if (
			!chunkContent.querySelector(".rg-collapsible-section") &&
			!chunkContent.querySelector(".rg-author-note[data-collapse='true']")
		) {
			return;
		}
		try {
			const mod = await loadCollapsibleSectionsModule();
			if (!mod) return;
			const stored = await browser.storage.local.get([
				"contentFilterSettings",
			]);
			const settings =
				stored.contentFilterSettings ||
				mod.DEFAULT_CONTENT_FILTER_SETTINGS;
			mod.renderCollapsibleSections(chunkContent, settings);
		} catch (err) {
			debugError("Error applying collapsible sections:", err);
		}
	}

	// ── Summary service (unified summary pipeline) ──────────────
	let summaryServiceModule = null;
	let summaryRuntimeModule = null;
	let chunkBatchModule = null;
	let domIntegrationModule = null;

	async function loadChunkBatchModule() {
		if (chunkBatchModule) return chunkBatchModule;
		try {
			const batchUrl = browser.runtime.getURL(
				"content/modules/chunk-batch.js",
			);
			chunkBatchModule = await import(batchUrl);
			return chunkBatchModule;
		} catch (error) {
			debugError("Error loading chunk batch module:", error);
			return null;
		}
	}

	async function loadDomIntegrationModule() {
		if (domIntegrationModule) return domIntegrationModule;
		try {
			const domIntegrationUrl = browser.runtime.getURL(
				"content/modules/dom-integration.js",
			);
			domIntegrationModule = await import(domIntegrationUrl);
			return domIntegrationModule;
		} catch (error) {
			debugError("Error loading dom integration module:", error);
			return null;
		}
	}

	async function loadSummaryRuntimeModule() {
		if (summaryRuntimeModule) return summaryRuntimeModule;
		try {
			const runtimeUrl = browser.runtime.getURL(
				"content/modules/summary-runtime.js",
			);
			summaryRuntimeModule = await import(runtimeUrl);
			return summaryRuntimeModule;
		} catch (error) {
			debugError("Error loading summary runtime module:", error);
			return null;
		}
	}

	async function loadSummaryService() {
		if (summaryServiceModule) return summaryServiceModule;
		const runtime = await loadSummaryRuntimeModule();
		if (!runtime?.loadSummaryServiceRuntime) return null;

		summaryServiceModule = await runtime.loadSummaryServiceRuntime({
			browserRef: browser,
			debugLog,
			debugError,
			initContext: {
				sendMessageWithRetry,
				wakeUpBackgroundWorker,
				extractContent,
				findContentArea,
				stripHtmlTags,
				extractParagraphsFromHtml,
				showStatusMessage,
				logNotification,
				resolveNovelDataForNotification,
				loadChunkingSystem,
				debugLog,
				debugError,
				getCurrentFontSize: () => currentFontSize,
			},
		});

		return summaryServiceModule;
	}

	// Clear old chunk cache format once per page load
	(async function initChunkCacheMigration() {
		try {
			const chunking = await loadChunkingSystem();
			if (chunking?.cache?.clearOldCache) {
				await chunking.cache.clearOldCache();
			}
		} catch (error) {
			debugError("Chunk cache migration failed:", error);
		}
	})();

	/**
	 * Generate reading status dropdown options from READING_STATUS_INFO
	 * @returns {Array} Array of {value, label} objects
	 */
	function getReadingStatusOptions() {
		if (!READING_STATUS || !READING_STATUS_INFO) {
			return [
				{ value: "reading", label: "Reading" },
				{ value: "completed", label: "Completed" },
				{ value: "plan-to-read", label: "Plan to Read" },
				{ value: "on-hold", label: "On Hold" },
				{ value: "dropped", label: "Dropped" },
			];
		}

		return Object.entries(READING_STATUS_INFO)
			.filter(([value]) => value !== "re-reading")
			.map(([value, info]) => ({
				value,
				label: info.label,
			}));
	}

	// Add novel to library when content is enhanced
	async function addToNovelLibrary(context) {
		if (!currentHandler || !currentHandler.isChapterPage?.()) {
			debugLog(
				"Skipping library add: Not a chapter page or no valid handler",
			);
			return;
		}

		if (isIncognitoActive()) {
			debugLog(
				"Incognito mode active - skipping automatic library registration",
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
			const novelData = novelLibrary.createNovelFromContext(
				context,
				currentHandler,
			);

			if (!novelData) {
				debugLog("Could not create novel data from context");
				return;
			}

			novelData.readingStatus = READING_STATUS.READING;

			await novelLibrary.addOrUpdateNovel(novelData);

			const metadata = currentHandler.extractNovelMetadata?.() || {};
			if (metadata && Object.keys(metadata).length > 0) {
				await novelLibrary.updateNovelMetadata(novelData.id, metadata);
			}

			const enhancedChunkEls = document.querySelectorAll(
				'.gemini-chunk-content[data-chunk-enhanced="true"]',
			);
			const totalChunkEls = document.querySelectorAll(
				".gemini-chunk-content",
			);
			await novelLibrary.updateChapter(novelData.id, {
				chapterNumber: context.chapterNumber || 1,
				title: context.chapterTitle || document.title,
				url: window.location.href,
				isEnhanced: true,
				enhancedChunkCount: enhancedChunkEls.length || 1,
				totalChunksForChapter: totalChunkEls.length || 1,
				enhancedAt: Date.now(),
				readAt: Date.now(),
			});

			debugLog("Novel and chapter added to library:", novelData.title);
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
					error,
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
				window.location.href,
			);
			if (cached && cached.enhancedContent) {
				debugLog("Found cached enhanced content");
				hasCachedContent = true;
				return cached;
			}
			hasCachedContent = false;
			isCachedContent = false;
			return null;
		} catch (error) {
			debugError("Error checking cached content:", error);
			isCachedContent = false;
			hasCachedContent = false;
			return null;
		}
	}

	function isChunkCacheComplete(chunks, totalChunks) {
		if (!chunks || chunks.length === 0) return false;
		const indices = chunks
			.map((chunk) => chunk?.chunkIndex)
			.filter((idx) => Number.isInteger(idx))
			.sort((a, b) => a - b);
		if (indices.length === 0) return false;
		const maxIndex = indices[indices.length - 1];
		const expectedTotal = Number.isInteger(totalChunks)
			? totalChunks
			: maxIndex + 1;
		if (indices.length !== expectedTotal) return false;
		for (let i = 0; i < expectedTotal; i++) {
			if (indices[i] !== i) return false;
		}
		return true;
	}

	function getChunkCacheTimestamp(metadata, chunks) {
		if (metadata?.lastUpdated) return metadata.lastUpdated;
		const timestamps = (chunks || [])
			.map((chunk) => chunk?.timestamp)
			.filter((ts) => Number.isFinite(ts));
		if (timestamps.length === 0) return null;
		return Math.max(...timestamps);
	}

	function getChunkCacheModelInfo(metadata, chunks) {
		if (metadata?.modelInfo) return metadata.modelInfo;
		const withModel = (chunks || []).find((chunk) => chunk?.modelInfo);
		return withModel?.modelInfo || null;
	}

	async function restoreChunkedContentFromCache(chunking, chunks, metadata) {
		const contentArea = findContentArea();
		if (!contentArea) return false;

		// Get word count threshold for chunk warnings
		const settingsData = await browser.storage.local.get([
			"wordCountThreshold",
		]);
		const wordCountThreshold =
			settingsData.wordCountThreshold !== undefined
				? settingsData.wordCountThreshold
				: chunkBehaviorConfig.wordCountThreshold;

		const totalChunks = Number.isInteger(metadata?.totalChunks)
			? metadata.totalChunks
			: chunks.length;
		const cacheTimestamp = getChunkCacheTimestamp(metadata, chunks);
		const modelInfo = getChunkCacheModelInfo(metadata, chunks);
		if (modelInfo) {
			lastChunkModelInfo = modelInfo;
		}

		const originalHtmlSnapshot = contentArea.innerHTML;
		const originalText = chunks
			.map((chunk) => stripHtmlTags(chunk?.originalContent || ""))
			.join("\n\n");

		contentArea.setAttribute("data-original-html", originalHtmlSnapshot);
		contentArea.setAttribute("data-original-text", originalText);
		contentArea.setAttribute("data-total-chunks", totalChunks);

		const chunkedContentContainer = document.createElement("div");
		chunkedContentContainer.id = "gemini-chunked-content";
		chunkedContentContainer.style.width = "100%";

		const sortedChunks = [...chunks].sort(
			(a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0),
		);

		sortedChunks.forEach((chunk, fallbackIndex) => {
			const chunkIndex = Number.isInteger(chunk.chunkIndex)
				? chunk.chunkIndex
				: fallbackIndex;
			const chunkWrapper = document.createElement("div");
			chunkWrapper.className = "gemini-chunk-wrapper";
			chunkWrapper.setAttribute("data-chunk-index", chunkIndex);

			const chunkTimestamp = chunk?.timestamp || cacheTimestamp;
			const cacheInfo = chunkTimestamp
				? { fromCache: true, timestamp: chunkTimestamp }
				: { fromCache: true };

			// Calculate word counts from content
			const originalContent = chunk?.originalContent || "";
			const enhancedContent = chunk?.enhancedContent || "";
			const originalWords = stripHtmlTags(originalContent)
				.split(/\s+/)
				.filter((w) => w).length;
			const enhancedWords = stripHtmlTags(enhancedContent)
				.split(/\s+/)
				.filter((w) => w).length;
			const wordCounts = {
				original: originalWords,
				enhanced: enhancedWords,
			};

			const banner = buildChunkBanner(
				chunking,
				chunkIndex,
				totalChunks,
				"cached",
				null,
				cacheInfo,
				wordCounts,
				wordCountThreshold,
			);
			chunkWrapper.appendChild(banner);

			const chunkContent = document.createElement("div");
			chunkContent.className = "gemini-chunk-content";
			chunkContent.setAttribute("data-chunk-index", chunkIndex);
			chunkContent.setAttribute(
				"data-original-chunk-content",
				chunk?.originalContent || "",
			);
			if (/<[^>]+>/.test(chunk?.originalContent || "")) {
				chunkContent.setAttribute(
					"data-original-chunk-html",
					chunk.originalContent,
				);
			}

			const sanitizedContent = sanitizeHTML(chunk?.enhancedContent || "");
			chunkContent.innerHTML = sanitizedContent;
			chunkContent.setAttribute("data-chunk-enhanced", "true");
			chunkContent.setAttribute("data-showing", "enhanced");
			chunkContent.setAttribute(
				"data-enhanced-chunk-content",
				sanitizedContent,
			);
			chunkWrapper.appendChild(chunkContent);

			chunkedContentContainer.appendChild(chunkWrapper);
		});

		contentArea.innerHTML = "";
		contentArea.appendChild(chunkedContentContainer);

		const chunkWrappers = Array.from(
			chunkedContentContainer.querySelectorAll(".gemini-chunk-wrapper"),
		);
		if (chunking?.summaryUI) {
			const summarySettings = await browser.storage.local.get([
				"chunkSummaryCount",
			]);
			const chunkSummaryCount =
				summarySettings.chunkSummaryCount ||
				chunking?.config?.DEFAULT_CHUNK_SUMMARY_COUNT ||
				2;

			// Remove any existing placeholder mainSummaryGroup (created upfront in
			// createChapterPageNovelControls with totalChunks=1 before chunk count was known).
			document
				.querySelectorAll(".gemini-main-summary-group")
				.forEach((el) => el.remove());

			const mainSummaryGroup = chunking.summaryUI.createMainSummaryGroup(
				totalChunks,
				(indices) => summarizeChunkRange(indices, false),
				(indices) => summarizeChunkRange(indices, true),
			);

			// Apply current visibility state
			if (shouldBannersBeHidden()) {
				mainSummaryGroup.style.display = "none";
			}

			contentArea.insertBefore(mainSummaryGroup, chunkedContentContainer);

			if (totalChunks > 1) {
				chunking.summaryUI.insertSummaryGroups(
					chunkedContentContainer,
					chunkWrappers,
					chunkSummaryCount,
					(indices) => summarizeChunkRange(indices, false),
					(indices) => summarizeChunkRange(indices, true),
				);

				// Chunk summary groups are always visible for easy access to summaries
			}
		}

		if (chunking?.ui) {
			const originalWords = chunking.core.countWords(originalText);
			const enhancedWords = sortedChunks.reduce((sum, chunk) => {
				return (
					sum + chunking.core.countWords(chunk?.enhancedContent || "")
				);
			}, 0);
			const domIntegration = await loadDomIntegrationModule();
			domIntegration?.ensureMasterBannerRuntime?.({
				documentRef: document,
				contentArea,
				chunking,
				totalChunks,
				originalWords,
				enhancedWords,
				isCached: true,
				lastChunkModelInfo: modelInfo,
				cacheMeta: cacheTimestamp
					? { timestamp: cacheTimestamp }
					: null,
				shouldBannersBeHidden,
				onToggleAll: handleToggleAllChunks,
				onDeleteAll: handleDeleteAllChunks,
				confirmFn: confirm,
			});
		}

		isCachedContent = true;
		hasCachedContent = true;
		contentArea.setAttribute("data-showing-enhanced", "true");

		const domIntegration = await loadDomIntegrationModule();
		if (domIntegration?.clearTransientEnhancementBannersRuntime) {
			domIntegration.clearTransientEnhancementBannersRuntime({
				documentRef: document,
			});
		} else {
			const wipBanner = document.querySelector(".gemini-wip-banner");
			if (wipBanner) wipBanner.remove();
		}

		document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
			btn.textContent = "♻ Regenerate with Gemini";
			btn.disabled = false;
			btn.classList.remove("loading");
		});

		// Re-enable text selection on restored cached content
		enableCopyOnContentArea(contentArea);

		showStatusMessage("Loaded cached enhanced content.", "success", 3000);

		return true;
	}

	async function tryRestoreChunkedCache() {
		const contentArea = findContentArea();
		if (!contentArea) {
			debugLog(
				"[Cache Restore] No content area found — scheduling retry.",
			);
			// Content area may not be ready yet (DOM still loading).
			// Schedule one retry so chunked cache is still restored reliably.
			const chunking0 = await loadChunkingSystem();
			if (chunking0?.cache?.hasChunksInCache) {
				const url0 = window.location.href;
				const has0 = await chunking0.cache.hasChunksInCache(url0);
				if (has0) {
					requestAnimationFrame(() => {
						setTimeout(async () => {
							if (
								!document.getElementById(
									"gemini-chunked-content",
								)
							) {
								await tryRestoreChunkedCache();
							}
						}, chunkBehaviorConfig.cacheRestoreRetryMs);
					});
				}
			}
			return false;
		}
		if (document.getElementById("gemini-chunked-content")) {
			debugLog(
				"[Cache Restore] Chunked content container already exists — skipping.",
			);
			return false;
		}

		const chunking = await loadChunkingSystem();
		if (!chunking?.cache?.hasChunksInCache) {
			debugLog(
				"[Cache Restore] Chunking system or cache unavailable — skipping.",
			);
			return false;
		}

		const url = window.location.href;
		const hasChunks = await chunking.cache.hasChunksInCache(url);
		if (!hasChunks) {
			debugLog("[Cache Restore] No chunks found in cache for this URL.");
			return false;
		}

		const metadata = chunking.cache.getChunkMetadata
			? await chunking.cache.getChunkMetadata(url)
			: null;
		let chunks = await chunking.cache.getAllChunksFromCache(url);
		if (!chunks || chunks.length === 0) {
			debugLog("[Cache Restore] getAllChunksFromCache returned empty.");
			return false;
		}

		debugLog(
			`[Cache Restore] Found ${chunks.length} cached chunks, metadata totalChunks: ${metadata?.totalChunks}`,
		);

		const isComplete = isChunkCacheComplete(chunks, metadata?.totalChunks);
		if (!isComplete) {
			debugLog(
				`[Cache Restore] Chunk cache incomplete — have ${chunks.length} chunks, expected ${metadata?.totalChunks ?? "unknown"}. Skipping.`,
			);
			return false;
		}

		// Validate cached chunk count against a fresh split of the current page content.
		// A stale cache (e.g. from a previous buggy run that produced duplicate chunks)
		// can have more entries than the corrected splitter would produce — trim them.
		if (
			chunking.core?.splitContentByWords &&
			chunking.config?.getChunkConfig
		) {
			try {
				const chunkConfig = await chunking.config.getChunkConfig();
				const sourceHtml = getCleanContentHTML(contentArea);
				const freshChunks = chunking.core.splitContentByWords(
					sourceHtml,
					chunkConfig.chunkSizeWords,
				);
				if (freshChunks.length < chunks.length) {
					debugLog(
						`[Cache Restore] Stale cache detected — cached ${chunks.length} chunks but fresh split gives ${freshChunks.length}. Trimming extras.`,
					);
					const extraChunks = chunks.slice(freshChunks.length);
					for (const extraChunk of extraChunks) {
						if (typeof extraChunk.chunkIndex === "number") {
							await chunking.cache.deleteChunkFromCache(
								url,
								extraChunk.chunkIndex,
							);
						}
					}
					chunks = chunks.slice(0, freshChunks.length);
					if (metadata) metadata.totalChunks = freshChunks.length;
					if (chunks.length === 0) {
						debugLog(
							"[Cache Restore] All chunks trimmed — nothing to restore.",
						);
						return false;
					}
					// Persist the corrected totalChunks to storage.
					// deleteChunkFromCache only removes the index from chunkIndices
					// but never updates totalChunks, so the next page load would
					// see chunkIndices.length (3) !== totalChunks (4) and refuse to
					// restore. Re-saving the first remaining chunk causes
					// saveChunkToCache → updateChunkMetadata("add", {totalChunks: N})
					// which writes the correct value to storage.
					const firstChunk = chunks[0];
					await chunking.cache.saveChunkToCache(
						url,
						firstChunk.chunkIndex,
						{
							...firstChunk,
							totalChunks: freshChunks.length,
						},
					);
				}
			} catch (validateErr) {
				debugLog(
					"[Cache Restore] Could not validate chunk count against fresh split:",
					validateErr,
				);
			}
		}

		const allEnhanced = chunks.every(
			(chunk) => chunk?.enhancedContent && chunk.enhancedContent.length,
		);
		if (!allEnhanced) {
			debugLog(
				"[Cache Restore] One or more chunks missing enhanced content — skipping.",
			);
			return false;
		}

		debugLog(
			`[Cache Restore] Cache complete with ${chunks.length} enhanced chunks. Restoring...`,
		);
		return restoreChunkedContentFromCache(chunking, chunks, metadata);
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

		// Load per-site settings
		siteSettingsModule = await loadSiteSettingsModule();
		if (siteSettingsModule?.getSiteSettings) {
			siteSettings = await siteSettingsModule.getSiteSettings();
		}
		extensionBridgesModule = await loadExtensionBridgesModule();
		chunkControlRuntime = await loadChunkControlRuntime();
		notificationRuntimeModule = await loadNotificationRuntimeModule();
		enhancementToggleBannerModule =
			await loadEnhancementToggleBannerModule();
		enhancedContentBannerModule = await loadEnhancedContentBannerModule();

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

		// Load handler FIRST so findContentArea() can use site-specific selectors
		currentHandler = await getHandlerForCurrentSite();

		if (!currentHandler) {
			debugLog(
				"Site disabled or unsupported; skipping UI injection for this page",
			);
			return;
		}

		const handlerShelfId = currentHandler?.constructor?.SHELF_METADATA?.id;
		if (
			siteSettingsModule?.isSiteEnabled &&
			handlerShelfId &&
			siteSettings &&
			!siteSettingsModule.isSiteEnabled(siteSettings, handlerShelfId)
		) {
			debugLog(
				`Site ${handlerShelfId} disabled in settings; skipping UI injection`,
			);
			return;
		}

		extensionBridgesModule?.applyExtensionBridgeFlags?.({
			siteSettings,
			activeShelfId: handlerShelfId,
			documentRef: document,
		});

		debugLog(`Using handler for ${window.location.hostname}`);

		// Inject custom CSS from handler settings (if any)
		await injectHandlerCustomCSS();
		// Inject user-defined custom content box type CSS
		await injectCustomBoxCSS();

		// Now that handler is loaded, attempt to restore cached content
		let cacheRestored = false;
		const restoredChunkedCache = await tryRestoreChunkedCache();
		if (restoredChunkedCache) {
			cacheRestored = true;
		} else {
			const cachedData = await checkCachedContent();
			if (cachedData && cachedData.enhancedContent) {
				debugLog("Found cached enhanced content, auto-loading...");
				// Restore cached content synchronously now that the handler is ready
				const contentArea = findContentArea();
				if (contentArea) {
					const restored =
						await replaceContentWithEnhancedVersion(cachedData);
					if (restored) {
						// eslint-disable-next-line no-unused-vars
						cacheRestored = true;
						debugLog("Cached content successfully restored");
					} else {
						debugLog(
							"Failed to restore cached content, will show original",
						);
					}
				} else {
					debugLog(
						"Content area not found for cache restore, scheduling retry...",
					);
					// Fallback: wait for DOM to be ready and retry once
					requestAnimationFrame(() => {
						setTimeout(async () => {
							const retryArea = findContentArea();
							if (retryArea) {
								await replaceContentWithEnhancedVersion(
									cachedData,
								);
							}
						}, 500);
					});
				}
			}
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

			// For mobile fanfiction handler, inject desktop metadata summary
			if (
				currentHandler.constructor.name === "FanfictionMobileHandler" &&
				currentHandler.isChapterPage?.()
			) {
				try {
					// Fetch metadata from desktop version asynchronously
					setTimeout(async () => {
						if (
							typeof currentHandler.fetchDesktopMetadata ===
							"function"
						) {
							const metadata =
								await currentHandler.fetchDesktopMetadata();
							if (
								metadata &&
								typeof currentHandler.injectMetadataSummary ===
									"function"
							) {
								currentHandler.injectMetadataSummary(metadata);
							}
						}
					}, 500);
				} catch (error) {
					debugLog(
						"Ranobe Gemini: Error injecting mobile metadata summary:",
						error,
					);
				}
			}
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
			await injectUI();
		} else if (!isChapterPage && !isNovelPage) {
			debugLog(
				"Ranobe Gemini: Not a chapter or novel page, skipping UI injection",
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
	 * @param {number|null} duration - How long to show (ms), 0 = until dismissed, null = default
	 * @param {Object} options - Additional options (actionButton, etc.)
	 * @returns {HTMLElement} The banner element
	 */
	function showTimedBanner(
		message,
		type = "info",
		duration = null,
		options = {},
	) {
		// Resolve duration from config if not specified
		if (duration === null) {
			duration = bannerConfig.defaultMs;
		}

		// Remove any existing banner
		const existingBanner = document.getElementById(
			"rg-notification-banner",
		);
		if (existingBanner) {
			existingBanner.remove();
		}

		const banner = document.createElement("div");
		banner.id = "rg-notification-banner";
		banner.className = `rg-banner rg-banner-${type}`;

		// Protect from Dark Reader and other theme extensions
		protectFromThemeExtensions(banner);

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

				/* Mobile responsive styles */
				@media (max-width: ${bannerConfig.mobileBreakpointPx}px) {
					#rg-notification-banner {
						top: 10px !important;
						right: 10px !important;
						left: 10px !important;
						max-width: none !important;
						font-size: 13px !important;
					}
					.gemini-main-summary-group {
						flex-direction: column !important;
						align-items: stretch !important;
						gap: 8px !important;
					}
					.gemini-main-summary-group button {
						min-height: 44px !important;
						font-size: 14px !important;
					}
					.gemini-chunk-banner {
						flex-wrap: wrap !important;
						gap: 6px !important;
						padding: 8px !important;
					}
					.gemini-chunk-banner button {
						min-height: 40px !important;
						flex: 1 1 calc(50% - 4px) !important;
					}
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

		logNotification({
			type,
			message,
			title: options.title,
			novelData: options.novelData,
			metadata: {
				bannerType: type,
				duration,
				field: options.field,
				actionText: options.actionButton?.text || null,
				actionUrl: options.actionButton?.url || null,
			},
			source: options.source || "content",
		});

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
	// eslint-disable-next-line no-unused-vars
	function updateBannerField(field) {
		const banner = document.getElementById("rg-notification-banner");
		if (banner) {
			const fieldText = banner.querySelector("div > div:nth-child(2)");
			if (fieldText) {
				fieldText.textContent = `Updating: ${field}`;
			}
		}
	}

	function shouldShowProgressPrompt(novelId) {
		if (!novelId) return false;
		const lastPrompt = progressPromptState.get(novelId);
		if (!lastPrompt) return true;
		return Date.now() - lastPrompt > PROGRESS_PROMPT_COOLDOWN_MS;
	}

	function deriveReadingStatusFromProgress(currentChapter, totalChapters) {
		if (!READING_STATUS || !currentChapter) return null;
		const total = Number(totalChapters) || 0;

		if (total > 0 && total <= 1) {
			return READING_STATUS.READING;
		}
		if (total > 0 && currentChapter >= total) {
			return READING_STATUS.COMPLETED;
		}
		if (currentChapter >= 2) {
			return READING_STATUS.READING;
		}
		if (currentChapter === 1) {
			return total > 1
				? READING_STATUS.PLAN_TO_READ
				: READING_STATUS.READING;
		}
		return null;
	}

	// eslint-disable-next-line no-unused-vars
	async function showProgressUpdatePrompt({
		novelId,
		currentChapter,
		storedChapter,
		totalChapters,
		novelTitle,
	}) {
		if (!shouldShowProgressPrompt(novelId)) return;
		progressPromptState.set(novelId, Date.now());

		const existing = document.getElementById("rg-progress-banner");
		if (existing) existing.remove();

		const banner = document.createElement("div");
		banner.id = "rg-progress-banner";
		banner.style.cssText = `
			position: fixed;
			bottom: 24px;
			right: 24px;
			background: #0f172a;
			border: 1px solid #3949ab;
			border-left: 4px solid #6366f1;
			border-radius: 10px;
			padding: 14px 16px;
			color: #e2e8f0;
			font-family: system-ui, -apple-system, sans-serif;
			font-size: 13px;
			z-index: 999999;
			box-shadow: 0 8px 32px rgba(0,0,0,0.6);
			max-width: 380px;
			min-width: 280px;
			display: flex;
			flex-direction: column;
			gap: 10px;
			animation: rg-slide-in 0.25s ease;
		`;

		// Inject keyframe animation once
		if (!document.getElementById("rg-banner-style")) {
			const style = document.createElement("style");
			style.id = "rg-banner-style";
			style.textContent = `
				@keyframes rg-slide-in {
					from { opacity: 0; transform: translateY(12px); }
					to   { opacity: 1; transform: translateY(0); }
				}
			`;
			document.head.appendChild(style);
		}

		// Header row
		const header = document.createElement("div");
		header.style.cssText =
			"display:flex;align-items:flex-start;justify-content:space-between;gap:8px;";

		const titleEl = document.createElement("div");
		titleEl.style.cssText =
			"font-weight:700;font-size:13px;color:#818cf8;flex:1;";
		titleEl.textContent = "📖 Reading Progress";

		const closeBtn = document.createElement("button");
		closeBtn.textContent = "×";
		closeBtn.style.cssText =
			"background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1;padding:0;";
		closeBtn.addEventListener("click", () => banner.remove());

		header.appendChild(titleEl);
		header.appendChild(closeBtn);
		banner.appendChild(header);

		// Novel title if provided
		if (novelTitle) {
			const nTitle = document.createElement("div");
			nTitle.style.cssText =
				"font-size:12px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px;";
			nTitle.textContent = novelTitle;
			banner.appendChild(nTitle);
		}

		const message = document.createElement("div");
		message.style.cssText = "font-size:13px;color:#cbd5e1;line-height:1.5;";
		if (storedChapter) {
			message.textContent = `Saved progress: Chapter ${storedChapter}. You are now on Chapter ${currentChapter}.${totalChapters ? ` (of ${totalChapters})` : ""} Update progress?`;
		} else {
			message.textContent = `No saved progress. You are on Chapter ${currentChapter}.${totalChapters ? ` (of ${totalChapters})` : ""} Save progress?`;
		}
		banner.appendChild(message);

		const actions = document.createElement("div");
		actions.style.cssText = "display:flex;gap:8px;";

		const updateBtn = document.createElement("button");
		updateBtn.textContent = storedChapter
			? `Update to Ch. ${currentChapter}`
			: `Save Ch. ${currentChapter}`;
		updateBtn.style.cssText =
			"background:#6366f1;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;transition:background 0.15s;";
		updateBtn.addEventListener("mouseover", () => {
			updateBtn.style.background = "#4f46e5";
		});
		updateBtn.addEventListener("mouseout", () => {
			updateBtn.style.background = "#6366f1";
		});

		const ignoreBtn = document.createElement("button");
		ignoreBtn.textContent = "Dismiss";
		ignoreBtn.style.cssText =
			"background:transparent;color:#94a3b8;border:1px solid rgba(148,163,184,0.3);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;";

		updateBtn.addEventListener("click", async () => {
			try {
				await novelLibrary.updateReadingProgress(
					novelId,
					currentChapter,
					window.location.href,
					{ totalChapters: totalChapters },
				);
				showTimedBanner(
					`Progress updated to Chapter ${currentChapter}`,
					"success",
					bannerConfig.quickMs,
				);
			} catch (err) {
				debugError("Failed to update progress", err);
				showTimedBanner(
					"Failed to update progress",
					"warning",
					bannerConfig.quickMs,
				);
			} finally {
				banner.remove();
			}
		});

		ignoreBtn.addEventListener("click", () => {
			banner.remove();
		});

		actions.appendChild(updateBtn);
		actions.appendChild(ignoreBtn);
		banner.appendChild(actions);

		document.body.appendChild(banner);

		setTimeout(() => {
			if (banner.parentElement) banner.remove();
		}, PROGRESS_PROMPT_TIMEOUT_MS);
	}

	/**
	 * Show a re-reading detection banner when the user visits an earlier chapter.
	 * Offers: "Continue to Ch. X" (jump to last-read) or "Start re-reading" (set overlay flag).
	 */
	async function showRereadingBanner({
		novelId,
		currentChapter,
		lastReadChapter,
		lastReadUrl,
		novelTitle,
	}) {
		if (!shouldShowProgressPrompt(novelId)) return;
		progressPromptState.set(novelId, Date.now());

		const existing = document.getElementById("rg-progress-banner");
		if (existing) existing.remove();

		const banner = document.createElement("div");
		banner.id = "rg-progress-banner";
		banner.style.cssText = `
			position: fixed;
			bottom: 24px;
			right: 24px;
			background: #1a0a2e;
			border: 1px solid #7c3aed;
			border-left: 4px solid #9c27b0;
			border-radius: 10px;
			padding: 14px 16px;
			color: #e2e8f0;
			font-family: system-ui, -apple-system, sans-serif;
			font-size: 13px;
			z-index: 999999;
			box-shadow: 0 8px 32px rgba(0,0,0,0.6);
			max-width: 380px;
			min-width: 280px;
			display: flex;
			flex-direction: column;
			gap: 10px;
			animation: rg-slide-in 0.25s ease;
		`;

		// Inject keyframe animation once (shared with progress banner)
		if (!document.getElementById("rg-banner-style")) {
			const style = document.createElement("style");
			style.id = "rg-banner-style";
			style.textContent = `
				@keyframes rg-slide-in {
					from { opacity: 0; transform: translateY(12px); }
					to   { opacity: 1; transform: translateY(0); }
				}
			`;
			document.head.appendChild(style);
		}

		// Header row
		const header = document.createElement("div");
		header.style.cssText =
			"display:flex;align-items:flex-start;justify-content:space-between;gap:8px;";

		const titleEl = document.createElement("div");
		titleEl.style.cssText =
			"font-weight:700;font-size:13px;color:#c084fc;flex:1;";
		titleEl.textContent = "🔁 Re-reading Detected";

		const closeBtn = document.createElement("button");
		closeBtn.textContent = "×";
		closeBtn.style.cssText =
			"background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1;padding:0;";
		closeBtn.addEventListener("click", () => banner.remove());

		header.appendChild(titleEl);
		header.appendChild(closeBtn);
		banner.appendChild(header);

		// Novel title
		if (novelTitle) {
			const nTitle = document.createElement("div");
			nTitle.style.cssText =
				"font-size:12px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px;";
			nTitle.textContent = novelTitle;
			banner.appendChild(nTitle);
		}

		// Message
		const message = document.createElement("div");
		message.style.cssText = "font-size:13px;color:#cbd5e1;line-height:1.5;";
		message.textContent = `You're on Chapter ${currentChapter}, but your last read was Chapter ${lastReadChapter}. Are you re-reading?`;
		banner.appendChild(message);

		// Action buttons
		const actions = document.createElement("div");
		actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";

		// "Start Re-reading" button — sets overlay flag
		const rereadBtn = document.createElement("button");
		rereadBtn.textContent = "🔁 Start Re-reading";
		rereadBtn.style.cssText =
			"background:#9c27b0;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;transition:background 0.15s;";
		rereadBtn.addEventListener("mouseover", () => {
			rereadBtn.style.background = "#7b1fa2";
		});
		rereadBtn.addEventListener("mouseout", () => {
			rereadBtn.style.background = "#9c27b0";
		});
		rereadBtn.addEventListener("click", async () => {
			try {
				await novelLibrary.toggleNovelReadingList(novelId, "rereading");
				showTimedBanner(
					"📖 Re-reading mode started",
					"success",
					bannerConfig.quickMs,
				);
			} catch (err) {
				debugError("Failed to set re-reading overlay", err);
				showTimedBanner(
					"Failed to start re-reading",
					"warning",
					bannerConfig.quickMs,
				);
			} finally {
				banner.remove();
			}
		});

		// "Continue to Ch. X" button — navigate to last-read URL
		const continueBtn = document.createElement("button");
		continueBtn.textContent = `Continue to Ch. ${lastReadChapter}`;
		continueBtn.style.cssText =
			"background:#6366f1;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;transition:background 0.15s;";
		continueBtn.addEventListener("mouseover", () => {
			continueBtn.style.background = "#4f46e5";
		});
		continueBtn.addEventListener("mouseout", () => {
			continueBtn.style.background = "#6366f1";
		});
		continueBtn.addEventListener("click", () => {
			banner.remove();
			if (lastReadUrl) {
				window.location.href = lastReadUrl;
			} else {
				showTimedBanner(
					"No saved URL for that chapter",
					"warning",
					2000,
				);
			}
		});

		// "Start from Here" button — resets progress to current chapter, no re-reading overlay
		const startHereBtn = document.createElement("button");
		startHereBtn.textContent = `📍 Start from Ch. ${currentChapter}`;
		startHereBtn.style.cssText =
			"background:#0e7490;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;transition:background 0.15s;";
		startHereBtn.addEventListener("mouseover", () => {
			startHereBtn.style.background = "#0c6380";
		});
		startHereBtn.addEventListener("mouseout", () => {
			startHereBtn.style.background = "#0e7490";
		});
		startHereBtn.addEventListener("click", async () => {
			try {
				await novelLibrary.updateReadingProgress(
					novelId,
					currentChapter,
					window.location.href,
					{},
				);
				showTimedBanner(
					`📍 Progress reset to Chapter ${currentChapter}`,
					"success",
					bannerConfig.quickMs,
				);
			} catch (err) {
				debugError("Failed to reset reading progress", err);
				showTimedBanner(
					"Failed to reset progress",
					"warning",
					bannerConfig.quickMs,
				);
			} finally {
				banner.remove();
			}
		});

		// Dismiss button
		const dismissBtn = document.createElement("button");
		dismissBtn.textContent = "Dismiss";
		dismissBtn.style.cssText =
			"background:transparent;color:#94a3b8;border:1px solid rgba(148,163,184,0.3);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;";
		dismissBtn.addEventListener("click", () => banner.remove());

		actions.appendChild(rereadBtn);
		actions.appendChild(continueBtn);
		actions.appendChild(startHereBtn);
		actions.appendChild(dismissBtn);
		banner.appendChild(actions);

		document.body.appendChild(banner);

		// Auto-dismiss after timeout
		setTimeout(() => {
			if (banner.parentElement) banner.remove();
		}, PROGRESS_PROMPT_TIMEOUT_MS);
	}

	/**
	 * Auto-update novel metadata when visiting any supported novel page
	 * This ensures the library stays up-to-date without requiring user action
	 */
	async function autoUpdateNovelOnVisit() {
		if (!currentHandler) return;

		// Incognito mode — suppress all automatic tracking
		if (isIncognitoActive()) {
			debugLog(
				"🕵️ Incognito mode active — skipping autoUpdateNovelOnVisit",
			);
			return;
		}

		// Load novel library if not already loaded
		if (!novelLibrary) {
			await loadNovelLibrary();
		}

		if (!novelLibrary) {
			debugLog("Novel library not available");
			return;
		}

		try {
			// Get handler type and page context
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
					const novelId = getNovelIdFromCurrentPage();
					const existingNovels =
						await novelLibrary.getRecentNovels(0);
					const existingNovel = novelId
						? existingNovels.find((n) => n.id === novelId)
						: null;

					if (!existingNovel) {
						showTimedBanner(
							"Add this novel to your library?",
							"action",
							8000,
							{
								actionButton: {
									text: "📖 View Novel Details",
									url: novelPageUrl,
								},
							},
						);
					}
				}
			}

			// Check if handler supports metadata extraction
			if (typeof currentHandler.extractNovelMetadata !== "function") {
				debugLog("Handler does not support metadata extraction");
				return;
			}

			// Extract metadata
			const metadata = currentHandler.extractNovelMetadata();
			if (!metadata || !metadata.title) {
				debugLog("Could not extract novel metadata");
				return;
			}
			cacheNovelData(buildNovelDataFromMetadata(metadata));

			// Get novel ID
			let novelId = getNovelIdFromCurrentPage();
			if (!novelId) {
				const shelfId =
					currentHandler.constructor.SHELF_METADATA?.id || "unknown";
				const urlPath = window.location.pathname;
				const urlHash = btoa(urlPath)
					.substring(0, 16)
					.replace(/[^a-zA-Z0-9]/g, "");
				novelId = `${shelfId}-${urlHash}`;
			}

			// Get chapter info
			const chapterNav = currentHandler.getChapterNavigation?.() || {};
			const currentChapterNum = chapterNav.currentChapter;
			const totalChapterCount =
				metadata.totalChapters || metadata.chapterCount || null;

			// Check if novel exists in library
			const existingNovels = await novelLibrary.getRecentNovels(0);
			const existingNovel = existingNovels.find((n) => n.id === novelId);

			// SILENT: Only update total chapters if it's additive OR if site setting allows
			// MANUAL ONLY: User must click "Check for Updates" button to update metadata
			if (existingNovel) {
				// Check per-site auto-update settings
				const shelfId =
					currentHandler.constructor.SHELF_METADATA?.id || "unknown";
				const defaultSiteSettings =
					siteSettingsModule?.getDefaultSiteSettings?.() || {};
				const siteAutoUpdateSettings =
					siteSettings?.[shelfId] ||
					defaultSiteSettings[shelfId] ||
					{};

				// Determine if auto-update is enabled for this site
				const autoUpdateEnabled =
					siteAutoUpdateSettings.autoUpdateMetadata === true;
				const totalChaptersOnlyMode =
					siteAutoUpdateSettings.autoUpdateTotalChaptersOnly !==
					false;
				const showUpdateBanner =
					siteAutoUpdateSettings.autoUpdateShowBanner !== false;

				// Auto-update metadata if enabled for this site
				if (autoUpdateEnabled && !totalChaptersOnlyMode) {
					// Full metadata auto-update
					const changes = detectMetadataChanges(
						existingNovel,
						metadata,
					);
					if (Object.keys(changes).length > 0) {
						debugLog(
							`📚 Auto-updating ${Object.keys(changes).length} metadata fields for ${existingNovel.title}`,
						);
						const updatedData =
							buildNovelDataFromMetadata(metadata);
						await novelLibrary.updateNovelMetadata(
							novelId,
							updatedData,
						);

						// Show update banner with changes
						displayChangeSummary(existingNovel.title, changes);
					}
				} else {
					// Only update total chapters (default mode)
					if (
						totalChapterCount &&
						(!existingNovel.totalChapters ||
							totalChapterCount > existingNovel.totalChapters)
					) {
						debugLog(
							`📚 Auto-updating total chapters to ${totalChapterCount}`,
						);
						await novelLibrary.updateNovel(novelId, {
							totalChapters: totalChapterCount,
						});
					}

					// Show "Check for Updates" button in banner if enabled
					if (showUpdateBanner) {
						showUpdateAvailableBanner(existingNovel, metadata);
					}
				}

				// Handle chapter progression / regression
				if (isChapter && currentChapterNum) {
					const storedChapter = existingNovel.lastReadChapter || 0;
					if (
						storedChapter > 0 &&
						currentChapterNum < storedChapter
					) {
						// Chapter went backward - ask if user wants to go back
						await showChapterRegressionPrompt({
							novelId,
							novelTitle: existingNovel.title,
							currentChapter: currentChapterNum,
							storedChapter: storedChapter,
							totalChapters: totalChapterCount,
							lastReadUrl: existingNovel.lastReadUrl || null,
						});
					} else if (
						currentChapterNum > storedChapter ||
						!existingNovel.lastReadUrl
					) {
						// Chapter progressed, or URL not yet recorded — update reading progress
						await novelLibrary.updateReadingProgress(
							novelId,
							currentChapterNum,
							window.location.href,
							{ totalChapters: totalChapterCount },
						);
					}
				}
			} else {
				// New novel - auto-add with auto-add settings
				const shelfId =
					currentHandler.constructor.SHELF_METADATA?.id || "unknown";
				const defaultSiteSettings =
					siteSettingsModule?.getDefaultSiteSettings?.() || {};
				const siteAutoAddSettings =
					siteSettings?.[shelfId] ||
					defaultSiteSettings[shelfId] ||
					{};
				const autoAddEnabled =
					siteAutoAddSettings.autoAddEnabled !== false;
				const autoAddStatus = isChapter
					? siteAutoAddSettings.autoAddStatusChapter ||
						READING_STATUS.READING
					: siteAutoAddSettings.autoAddStatusNovel ||
						READING_STATUS.PLAN_TO_READ;

				if (
					autoAddEnabled &&
					metadata.title &&
					!isNovelBlocklisted(novelId)
				) {
					// Build novel data
					const progressStatus = deriveReadingStatusFromProgress(
						currentChapterNum,
						totalChapterCount,
					);
					const novelData = {
						id: novelId,
						title: metadata.title,
						author: metadata.author || "Unknown",
						description: metadata.description || "",
						coverUrl: metadata.coverUrl || "",
						sourceUrl:
							metadata.mainNovelUrl || window.location.href,
						sourceSite: window.location.hostname,
						shelfId: shelfId,
						genres: metadata.genres || [],
						tags: metadata.tags || [],
						status: metadata.status || null,
						totalChapters: totalChapterCount,
						metadata: {
							...(metadata.metadata || {}),
							...(metadata.rating && { rating: metadata.rating }),
							...(metadata.language && {
								language: metadata.language,
							}),
							...(metadata.publishedDate && {
								publishedDate: metadata.publishedDate,
							}),
							...(metadata.updatedDate && {
								updatedDate: metadata.updatedDate,
							}),
						},
						stats: {
							...(metadata.stats || {}),
							...(metadata.words && { words: metadata.words }),
							...(metadata.reviews && {
								reviews: metadata.reviews,
							}),
							...(metadata.favorites && {
								favorites: metadata.favorites,
							}),
							...(metadata.follows && {
								follows: metadata.follows,
							}),
						},
						readingStatus:
							(isChapter && progressStatus) || autoAddStatus,
						...(isChapter && currentChapterNum
							? {
									lastReadChapter: currentChapterNum,
									lastReadUrl: window.location.href,
								}
							: {}),
					};

					await novelLibrary.addOrUpdateNovel(novelData);
					debugLog("📚 Auto-added novel to library:", metadata.title);
					showTimedBanner(
						`Added to library: ${metadata.title}`,
						"success",
						3000,
					);
				}
			}
		} catch (error) {
			debugError("Error in auto-update novel:", error);
		}
	}

	/**
	 * Show "Check for Updates" banner for existing novels.
	 * Auto-dismisses after updateNotifyMs — user does NOT need to interact.
	 * The "Update" button in the chapter controls handles manual updates.
	 */
	function showUpdateAvailableBanner(existingNovel, currentMetadata) {
		showTimedBanner(
			`🔗 Updates may be available for "${existingNovel.title}"`,
			"info",
			bannerConfig.updateNotifyMs || 8000,
			{
				title: "Novel Update Available",
				actionButton: {
					text: "🔄 Update Now",
					onClick: () => {
						manuallyCheckAndUpdateNovel(
							existingNovel,
							currentMetadata,
						);
					},
				},
				source: "novel-library",
			},
		);
	}

	/**
	 * Manually check and update novel with change detection and display
	 */
	async function manuallyCheckAndUpdateNovel(existingNovel, currentMetadata) {
		if (!novelLibrary || !currentHandler) return;

		try {
			// Get novel ID
			let novelId = existingNovel.id;

			// Detect what changed
			const changes = detectMetadataChanges(
				existingNovel,
				currentMetadata,
			);

			if (Object.keys(changes).length === 0) {
				// No changes detected
				showTimedBanner(
					"✓ No updates available (metadata is current)",
					"success",
					4000,
				);
				debugLog("📚 No metadata changes detected");
				return;
			}

			// Show "Updating..." message
			showTimedBanner(
				`🔄 Checking: ${existingNovel.title}`,
				"updating",
				1500,
			);

			// Update the novel
			const updatedData = buildNovelDataFromMetadata(currentMetadata);
			await novelLibrary.updateNovelMetadata(novelId, updatedData);

			debugLog("📚 Manually updated novel, changes:", changes);

			// Display what changed
			displayChangeSummary(existingNovel.title, changes);
		} catch (error) {
			debugError("Error in manual update:", error);
			showTimedBanner(
				`❌ Error updating: ${error.message}`,
				"error",
				5000,
			);
		}
	}

	/**
	 * Detect what metadata changed between old and new
	 */
	function detectMetadataChanges(oldNovel, newMetadata) {
		const changes = {};

		const fieldsToCheck = [
			{ old: "description", new: "description", label: "Summary" },
			{ old: "author", new: "author", label: "Author" },
			{ old: "status", new: "status", label: "Status" },
			{ old: "totalChapters", new: "totalChapters", label: "Chapters" },
			{ old: "genres", new: "genres", label: "Genres" },
			{
				old: ["metadata", "rating"],
				new: ["metadata", "rating"],
				label: "Rating",
			},
			{
				old: ["metadata", "language"],
				new: ["metadata", "language"],
				label: "Language",
			},
			{
				old: ["metadata", "words"],
				new: ["stats", "words"],
				label: "Word Count",
			},
			{
				old: ["metadata", "publishedDate"],
				new: ["metadata", "publishedDate"],
				label: "Published",
			},
		];

		for (const field of fieldsToCheck) {
			const oldPath = Array.isArray(field.old) ? field.old : [field.old];
			const newPath = Array.isArray(field.new) ? field.new : [field.new];

			// Get old and new values
			let oldValue = oldNovel;
			for (const key of oldPath) {
				oldValue = oldValue?.[key];
			}

			let newValue = newMetadata;
			for (const key of newPath) {
				newValue = newValue?.[key];
			}

			// Normalize for comparison
			const oldStr = Array.isArray(oldValue)
				? oldValue.join(", ")
				: String(oldValue || "");
			const newStr = Array.isArray(newValue)
				? newValue.join(", ")
				: String(newValue || "");

			// Detect change
			if (oldStr !== newStr && newStr) {
				changes[field.label] = {
					old: oldStr || "(not set)",
					new: newStr,
				};
			}
		}

		return changes;
	}

	/**
	 * Display changes in a change modal
	 */
	function displayChangeSummary(novelTitle, changes) {
		// Create a styled modal div for showing changes
		const modalId = `rg-changes-modal-${Date.now()}`;
		const modal = document.createElement("div");
		modal.id = modalId;
		protectFromThemeExtensions(modal);
		modal.style.cssText = `
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			background: linear-gradient(135deg, #1a2942 0%, #0f3460 100%);
			border: 2px solid #4a7c9c;
			border-radius: 12px;
			padding: 20px;
			color: white;
			font-family: system-ui, -apple-system, sans-serif;
			z-index: 999999;
			box-shadow: 0 8px 32px rgba(0,0,0,0.5);
			max-width: 500px;
			max-height: 70vh;
			overflow-y: auto;
		`;

		// Title
		const title = document.createElement("h3");
		title.textContent = `✨ Updated: ${novelTitle}`;
		title.style.cssText =
			"margin-top: 0; margin-bottom: 16px; color: #88bbff;";
		modal.appendChild(title);

		// Changes
		const changesDiv = document.createElement("div");
		for (const [field, change] of Object.entries(changes)) {
			const fieldDiv = document.createElement("div");
			fieldDiv.style.cssText = `
				margin: 8px 0;
				padding: 12px;
				background: #0a1f35;
				border-left: 3px solid #4a7c9c;
				border-radius: 4px;
			`;

			const fieldName = document.createElement("div");
			fieldName.style.cssText = "font-weight: bold; margin-bottom: 6px;";
			fieldName.textContent = field;
			fieldDiv.appendChild(fieldName);

			const oldValue = document.createElement("div");
			oldValue.style.cssText = `
				margin: 6px 0;
				font-size: 0.9em;
				color: #cc6666;
				text-decoration: line-through;
			`;
			oldValue.textContent = `↚ ${change.old}`;
			fieldDiv.appendChild(oldValue);

			const newValue = document.createElement("div");
			newValue.style.cssText = `
				margin: 6px 0;
				font-size: 0.9em;
				color: #66dd66;
			`;
			newValue.textContent = `↦ ${change.new}`;
			fieldDiv.appendChild(newValue);

			changesDiv.appendChild(fieldDiv);
		}
		modal.appendChild(changesDiv);

		// Summary
		const summary = document.createElement("div");
		summary.style.cssText = `
			margin-top: 16px;
			padding-top: 12px;
			border-top: 1px solid #3a5a7a;
			font-size: 0.85em;
			color: #aaa;
		`;
		summary.textContent = `${Object.keys(changes).length} field(s) updated`;
		modal.appendChild(summary);

		// Close button
		const closeBtn = document.createElement("button");
		closeBtn.textContent = "✓ Got it";
		closeBtn.style.cssText = `
			margin-top: 16px;
			width: 100%;
			padding: 10px;
			background: #4a7c9c;
			border: 1px solid #3a6a8c;
			color: white;
			border-radius: 6px;
			cursor: pointer;
			font-weight: bold;
			transition: all 0.2s;
		`;
		closeBtn.addEventListener("click", () => modal.remove());
		closeBtn.addEventListener("mouseenter", () => {
			closeBtn.style.background = "#5a8cac";
		});
		closeBtn.addEventListener("mouseleave", () => {
			closeBtn.style.background = "#4a7c9c";
		});
		modal.appendChild(closeBtn);

		document.body.appendChild(modal);

		// Auto-close after 8 seconds
		setTimeout(() => {
			if (modal.parentElement) {
				modal.style.opacity = "0";
				modal.style.transition = "opacity 0.3s ease-out";
				setTimeout(() => modal.remove(), 300);
			}
		}, 8000);
	}

	/**
	 * Prompt user if library chapter is higher than current (chapter regression)
	 */
	async function showChapterRegressionPrompt(options) {
		const {
			novelId,
			novelTitle,
			currentChapter,
			storedChapter,
			totalChapters,
			lastReadUrl,
		} = options;

		return new Promise((resolve) => {
			// Create modal overlay
			const overlay = document.createElement("div");
			protectFromThemeExtensions(overlay);
			overlay.style.cssText = `
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(0, 0, 0, 0.7);
				z-index: 999998;
				display: flex;
				align-items: center;
				justify-content: center;
			`;

			// Create modal
			const modal = document.createElement("div");
			protectFromThemeExtensions(modal);
			modal.style.cssText = `
				background: linear-gradient(135deg, #1a2942 0%, #0f3460 100%);
				border: 2px solid #ff9800;
				border-radius: 12px;
				padding: 24px;
				color: white;
				font-family: system-ui, -apple-system, sans-serif;
				max-width: 450px;
				box-shadow: 0 8px 32px rgba(0,0,0,0.6);
			`;

			// Title
			const title = document.createElement("div");
			title.style.cssText = `
				font-size: 1.1em;
				font-weight: bold;
				margin-bottom: 12px;
				color: #ffbb88;
			`;
			title.textContent = "⚠️ Chapter Regression Detected";
			modal.appendChild(title);

			// Info message
			const infoDiv = document.createElement("div");
			infoDiv.style.cssText = `
				margin-bottom: 16px;
				line-height: 1.5;
				color: #ddd;
			`;
			infoDiv.innerHTML = `
				<div style="margin-bottom: 8px;">Your library shows you're at <strong style="color: #88ff88;">Chapter ${storedChapter}</strong></div>
				<div>But you're now reading <strong style="color: #ffbb88;">Chapter ${currentChapter}</strong></div>
			`;
			modal.appendChild(infoDiv);

			// Buttons container
			const buttonsDiv = document.createElement("div");
			buttonsDiv.style.cssText = `
				display: flex;
				gap: 10px;
				margin-top: 16px;
			`;

			// Keep button
			const keepBtn = document.createElement("button");
			keepBtn.textContent = `↩️ Keep Reading Ch. ${currentChapter}`;
			keepBtn.style.cssText = `
				flex: 1;
				padding: 12px;
				background: #4a7c9c;
				border: 1px solid #2a5b8d;
				color: white;
				border-radius: 6px;
				cursor: pointer;
				font-weight: bold;
				transition: all 0.2s;
			`;
			keepBtn.addEventListener("click", async () => {
				debugLog(
					`💾 Keeping chapter ${currentChapter} for ${novelTitle}`,
				);
				// User is choosing to read from this (earlier) chapter — update progress to here
				await novelLibrary.updateReadingProgress(
					novelId,
					currentChapter,
					window.location.href,
					{ totalChapters },
				);
				overlay.remove();
				resolve({ action: "keep" });
			});
			keepBtn.addEventListener("mouseenter", () => {
				keepBtn.style.background = "#5a8cac";
			});
			keepBtn.addEventListener("mouseleave", () => {
				keepBtn.style.background = "#4a7c9c";
			});
			buttonsDiv.appendChild(keepBtn);

			// Resume button
			const resumeBtn = document.createElement("button");
			resumeBtn.textContent = `📖 Go Back to Ch. ${storedChapter}`;
			resumeBtn.style.cssText = `
				flex: 1;
				padding: 12px;
				background: #c2655b;
				border: 1px solid #a0453a;
				color: white;
				border-radius: 6px;
				cursor: pointer;
				font-weight: bold;
				transition: all 0.2s;
			`;
			resumeBtn.addEventListener("click", async () => {
				debugLog(
					`↩️ Resuming chapter ${storedChapter} for ${novelTitle}`,
				);

				if (lastReadUrl) {
					overlay.remove();
					resolve({ action: "resume" });
					// Navigate to the saved chapter URL
					window.location.href = lastReadUrl;
				} else {
					showTimedBanner(
						"No saved URL for that chapter",
						"warning",
						2000,
					);
					overlay.remove();
					resolve({ action: "resume" });
				}
			});
			resumeBtn.addEventListener("mouseenter", () => {
				resumeBtn.style.background = "#d17566";
			});
			resumeBtn.addEventListener("mouseleave", () => {
				resumeBtn.style.background = "#c2655b";
			});
			buttonsDiv.appendChild(resumeBtn);

			modal.appendChild(buttonsDiv);
			overlay.appendChild(modal);
			document.body.appendChild(overlay);

			// Close on overlay click (outside modal)
			overlay.addEventListener("click", (e) => {
				if (e.target === overlay) {
					overlay.remove();
					resolve({ action: "keep" });
				}
			});
		});
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
					`Generic: Content area found using selector: ${selector}`,
				);
				return element;
			}
		}

		return null;
	}

	// Function to create the Toggle Banners button (show/hide banners for enhanced content)
	function createToggleBannersButton() {
		const toggleButton = document.createElement("button");
		toggleButton.className = "gemini-toggle-banners-btn";
		toggleButton.innerHTML =
			'<span style="font-size: 20px;">⚡</span> <span style="font-weight: 600;">Show Ranobe Gemini</span>';
		toggleButton.title =
			"Toggle visibility of Ranobe Gemini enhancement UI";

		// Style to match the sample page buttons
		toggleButton.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 15px;
        margin: 15px 0;
        background-color: #2a2a2a;
        color: #8a8a7d;
        border: 1px solid #444444;
        box-shadow: inset 0 0 0 1px #5a5a5a4d;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        font-size: 13px;
        z-index: 1000;
    `;
		toggleButton.addEventListener("click", handleToggleBannersVisibility);
		toggleButton.addEventListener("mouseover", () => {
			toggleButton.style.backgroundColor = "#353535";
		});
		toggleButton.addEventListener("mouseout", () => {
			toggleButton.style.backgroundColor = "#2a2a2a";
		});
		return toggleButton;
	}

	function createCancelEnhanceButton() {
		const cancelButton = document.createElement("button");
		cancelButton.className = "gemini-cancel-enhance-btn";
		cancelButton.textContent = "Cancel";
		cancelButton.style.cssText = `
        display: none;
        align-items: center;
        justify-content: center;
        padding: 10px 15px;
        margin: 15px 0 15px 8px;
        background-color: #b91c1c;
        color: #ffffff;
        border: 1px solid #7f1d1d;
        box-shadow: inset 0 0 0 1px #5a5a5a4d;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
        z-index: 1000;
    `;
		cancelButton.addEventListener("click", handleCancelEnhancement);
		cancelButton.addEventListener("mouseover", () => {
			cancelButton.style.backgroundColor = "#991b1b";
		});
		cancelButton.addEventListener("mouseout", () => {
			cancelButton.style.backgroundColor = "#b91c1c";
		});
		return cancelButton;
	}

	function createEnhanceButton() {
		const btn = document.createElement("button");
		btn.className = "gemini-enhance-btn";
		btn.innerHTML =
			'<span style="font-size: 20px;">⚡</span> <span style="font-weight: 600;">Enhance with Gemini</span>';
		btn.title = "Enhance chapter text with Gemini AI";
		btn.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 15px;
        margin: 15px 0;
        background-color: #1a73e8;
        color: #ffffff;
        border: 1px solid #1557b0;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        font-size: 13px;
        z-index: 1000;
    `;
		btn.addEventListener("click", handleEnhanceClick);
		btn.addEventListener("mouseover", () => {
			btn.style.backgroundColor = "#1557b0";
		});
		btn.addEventListener("mouseout", () => {
			btn.style.backgroundColor = "#1a73e8";
		});
		return btn;
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

		insertAfterControlsOrTop(contentArea, wordCountContainer);
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
				"Ranobe Gemini: Could not find insertion point for novel page UI",
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
		protectFromThemeExtensions(controlsContainer);
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

		// Apply mobile class if on mobile device
		if (isMobileDevice) {
			controlsContainer.classList.add("mobile-view");
		}

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
				if (existingNovel) {
					// Same behaviour as "Update Now" in the notification banner:
					// detect changes, show summary, then persist.
					const currentMeta =
						currentHandler?.extractNovelMetadata?.() || {};
					await manuallyCheckAndUpdateNovel(
						existingNovel,
						currentMeta,
					);
					// Refresh UI so badges/counts reflect saved state
					const controls =
						document.getElementById("rg-novel-controls");
					if (controls) {
						controls.remove();
						hasExtractButton = false;
						await injectNovelPageUI();
					}
				} else {
					await handleNovelAddUpdate();
				}
			},
		);
		buttonRow.appendChild(addUpdateBtn);

		// Helper to handle status changes
		const handleReadingStatusChange = async (newStatus) => {
			if (!novelLibrary || !existingNovel) return;
			try {
				const updated = await novelLibrary.updateReadingStatus(
					existingNovel.id,
					newStatus,
				);
				if (!updated) {
					showTimedBanner("Failed to change status", "warning", 3000);
					return;
				}
				existingNovel.readingStatus = newStatus;
				showTimedBanner(
					`Status changed to: ${newStatus}`,
					"success",
					2000,
				);
				debugLog(`📖 Reading status changed to: ${newStatus}`);

				// Always refresh the UI so the dropdown reflects the saved status.
				// Do NOT gate this on finding the element – the element may have
				// been temporarily absent during the async storage round-trip.
				const controls = document.getElementById("rg-novel-controls");
				if (controls) controls.remove();
				hasExtractButton = false;
				await injectNovelPageUI();
			} catch (error) {
				debugError("Error changing reading status:", error);
				showTimedBanner("Failed to change status", "warning", 3000);
			}
		};

		// Helper to handle novel deletion
		const handleNovelDelete = async () => {
			if (!novelLibrary || !existingNovel) return;
			const confirmed = confirm(
				`Remove "${existingNovel.title}" from library?`,
			);
			if (!confirmed) return;

			try {
				await novelLibrary.removeNovel(existingNovel.id);
				showTimedBanner("Novel removed from library", "success", 3000);

				// Refresh UI
				const controls = document.getElementById("rg-novel-controls");
				if (controls) {
					controls.remove();
					hasExtractButton = false;
					await injectNovelPageUI();
				}
			} catch (error) {
				debugError("Error removing novel:", error);
				showTimedBanner("Failed to remove novel", "warning", 3000);
			}
		};

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
				},
			);
			buttonRow.appendChild(deleteBtn);
		}

		// Open Library button — pass novel ID so the library auto-opens the modal
		const libraryBtn = createButton("Open Library", "📚", "#7b1fa2", () => {
			const base = browser.runtime.getURL("library/library.html");
			const novelId = existingNovel?.id ?? null;
			const libraryUrl = novelId
				? `${base}?novel=${encodeURIComponent(novelId)}`
				: base;
			window.open(libraryUrl, "_blank");
		});
		buttonRow.appendChild(libraryBtn);

		// Handler-supplied extra buttons (after defaults)
		if (typeof currentHandler?.getCustomChapterButtons === "function") {
			const extraBtns = await Promise.resolve(
				currentHandler.getCustomChapterButtons(),
			);
			if (Array.isArray(extraBtns)) {
				extraBtns.forEach((spec) => {
					if (spec?.text && typeof spec.onClick === "function") {
						const btn = createButton(
							spec.text,
							spec.emoji || "",
							spec.color || "#1976d2",
							spec.onClick,
						);
						buttonRow.appendChild(btn);
					}
				});
			}
		}

		controlsContainer.appendChild(buttonRow);

		// Insert the controls
		insertionPoint.element.parentNode.insertBefore(
			controlsContainer,
			insertionPoint.element,
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
					3000,
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

			const savedNovel = await novelLibrary.addOrUpdateNovel(novelData);
			if (!savedNovel) {
				showTimedBanner(
					"Failed to save novel to library",
					"warning",
					4000,
				);
				return;
			}

			// Also update with extracted metadata
			await novelLibrary.updateNovelMetadata(novelId, metadata);

			// If on mobile, fetch desktop version metadata in background
			if (
				currentHandler?.constructor?.name === "FanfictionMobileHandler"
			) {
				debugLog("[Mobile] Fetching desktop metadata in background...");
				try {
					const desktopMetadata =
						await currentHandler.fetchDesktopMetadata();
					if (desktopMetadata) {
						debugLog(
							"[Mobile] Desktop metadata fetched successfully",
						);
						showTimedBanner(
							`Saved with full metadata: ${metadata.title}`,
							"success",
							3000,
						);
					} else {
						showTimedBanner(
							`Saved: ${metadata.title}`,
							"success",
							3000,
						);
					}
				} catch (err) {
					debugError(
						"[Mobile] Failed to fetch desktop metadata:",
						err,
					);
					showTimedBanner(
						`Saved: ${metadata.title}`,
						"success",
						3000,
					);
				}
			} else {
				showTimedBanner(`Saved: ${metadata.title}`, "success", 3000);
			}

			// Refresh the UI
			const controls = document.getElementById("rg-novel-controls");
			if (controls) {
				controls.remove();
				hasExtractButton = false;
				await injectNovelPageUI();
			}
		} catch (error) {
			debugError("Error saving novel:", error);
			showTimedBanner(
				`Error saving novel${error?.message ? ": " + error.message : ""}`,
				"warning",
				4000,
			);
		}
	}

	/**
	 * Update chapter progression in library
	 * Automatically tracks when user reads/enhances chapters
	 */
	async function updateChapterProgression() {
		if (!novelLibrary || !currentHandler) return;

		// Incognito mode — skip automatic progress tracking
		if (isIncognitoActive()) {
			debugLog(
				"🕵️ Incognito mode active — skipping updateChapterProgression",
			);
			return;
		}

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
				window.location.href,
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
					window.location.href,
					{
						totalChapters: novel.totalChapters,
					},
				);
				debugLog(
					`📖 Chapter progression updated: Chapter ${chapterNav.currentChapter}`,
				);
				showTimedBanner(
					`Progress saved: Chapter ${chapterNav.currentChapter}`,
					"success",
					2000,
				);
			} else if (
				novel.lastReadChapter &&
				chapterNav.currentChapter < novel.lastReadChapter
			) {
				// User is reading an earlier chapter — offer re-reading prompt
				await showRereadingBanner({
					novelId,
					currentChapter: chapterNav.currentChapter,
					lastReadChapter: novel.lastReadChapter,
					lastReadUrl: novel.lastReadUrl,
					novelTitle: novel.title,
				});
			}
		} catch (error) {
			debugError("Error updating chapter progression:", error);
		}
	}

	/**
	 * Handle delete button click
	 */
	// eslint-disable-next-line no-unused-vars
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
	 * Remove a novel from library and add its ID to the auto-add blocklist
	 * This prevents the novel from being automatically re-added on reload
	 * @param {string} novelId - The novel ID to remove and blocklist
	 */
	// eslint-disable-next-line no-unused-vars
	async function handleRemoveNovelWithBlocklist(novelId) {
		if (!novelLibrary || !novelId) return;

		try {
			// Delete from library
			await novelLibrary.removeNovel(novelId);

			// Add to blocklist to prevent auto-add
			try {
				const blocklistJson = localStorage.getItem(
					"rg_auto_add_blocklist",
				);
				const blocklist = blocklistJson
					? JSON.parse(blocklistJson)
					: [];

				// Add novel ID if not already in blocklist
				if (!blocklist.includes(novelId)) {
					blocklist.push(novelId);
					localStorage.setItem(
						"rg_auto_add_blocklist",
						JSON.stringify(blocklist),
					);
					debugLog(
						"Ranobe Gemini: Added novelId to blocklist:",
						novelId,
					);
				}
			} catch (storageError) {
				debugWarn(
					"Ranobe Gemini: Error writing to blocklist:",
					storageError,
				);
				// Continue even if blocklist write fails
			}

			showTimedBanner(
				"Novel removed from library (won't auto-add)",
				"success",
				3000,
			);

			// Refresh the controls – remove first so the DOM guard allows re-creation.
			removeChapterNovelControlsFromDOM();
			const config = currentHandler?.getNovelControlsConfig?.() || {};
			const newControls = await createChapterPageNovelControls(config);
			if (newControls) {
				placeChapterNovelControls(newControls, config);
			}
		} catch (error) {
			debugError("Error removing novel with blocklist:", error);
			showTimedBanner("Error removing novel", "warning", 3000);
		}
	}

	/**
	 * Check if a novel should be added to library (not blocklisted)
	 * @param {string} novelId - The novel ID to check
	 * @returns {boolean} True if novel can be auto-added, false if blocklisted
	 */
	function isNovelBlocklisted(novelId) {
		try {
			const blocklistJson = localStorage.getItem("rg_auto_add_blocklist");
			const blocklist = blocklistJson ? JSON.parse(blocklistJson) : [];
			return blocklist.includes(novelId);
		} catch (error) {
			debugWarn("Ranobe Gemini: Error checking blocklist:", error);
			return false;
		}
	}

	/**
	 * Check and collect metadata for a novel if it was pending collection
	 * This is called when visiting a novel page after a failed metadata update
	 * @param {string} novelId - The novel ID to potentially collect metadata for
	 */
	// eslint-disable-next-line no-unused-vars
	async function autoCollectMetadataOnPageIfPending(novelId) {
		if (!novelId || !novelLibrary || !currentHandler) return;

		try {
			const pendingJson = localStorage.getItem(
				"rg_pending_metadata_collect",
			);
			if (!pendingJson) return;

			const pending = JSON.parse(pendingJson);
			// Check if this is the pending novel and within 10-minute window
			if (
				pending.novelId === novelId &&
				Date.now() - pending.timestamp < 600000
			) {
				debugLog(
					"Ranobe Gemini: Collecting pending metadata for novelId:",
					novelId,
				);

				// Extract metadata from current page
				const metadata = currentHandler.extractNovelMetadata();
				if (metadata) {
					// Update the novel in library with the newly collected metadata
					await novelLibrary.updateNovel(novelId, metadata);
					debugLog(
						"Ranobe Gemini: Updated pending metadata for:",
						novelId,
					);
					showTimedBanner(
						"Metadata synchronized from page",
						"success",
						2000,
					);
				}

				// Clear the pending flag
				localStorage.removeItem("rg_pending_metadata_collect");
			}
		} catch (error) {
			debugWarn("Ranobe Gemini: Error auto-collecting metadata:", error);
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

	/**
	 * Remove the chapter novel controls container AND its DT/DD wrapper from the DOM.
	 * Calling .remove() on just #rg-chapter-novel-controls leaves orphaned
	 * dt.rg-gemini-controls-label + dd.rg-gemini-controls shells in the page,
	 * causing duplicate label/wrapper pairs each time the controls are refreshed.
	 */
	function removeChapterNovelControlsFromDOM() {
		const existing = document.getElementById("rg-chapter-novel-controls");
		if (!existing) return;
		const wrapper = existing.closest(".rg-gemini-controls");
		if (wrapper) {
			const maybeLabel = wrapper.previousElementSibling;
			if (maybeLabel?.classList.contains("rg-gemini-controls-label")) {
				maybeLabel.remove();
			}
			wrapper.remove();
		} else {
			existing.remove();
		}
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

		// Hide the old toggle banners button since we have the Show/Hide button in novel controls now
		const oldToggleBtn = document.querySelector(
			".gemini-toggle-banners-btn",
		);
		if (oldToggleBtn) {
			oldToggleBtn.style.display = "none";
		}

		const insertion = resolveNovelControlsInsertion(controlsConfig);
		if (insertion?.element) {
			let target = insertion.element;
			let position = insertion.position;

			if (controlsConfig.wrapInDefinitionList) {
				const labelText = controlsConfig.dlLabel || "Ranobe Gemini";
				const dtLabel = document.createElement("dt");
				dtLabel.className = "rg-gemini-controls-label";
				const labelLink = document.createElement("a");
				labelLink.href = "https://ranobe.vkrishna04.me/";
				labelLink.textContent = labelText;
				labelLink.target = "_blank";
				labelLink.rel = "noopener noreferrer";
				dtLabel.appendChild(labelLink);

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

	// Concurrency guard: prevent two simultaneous createChapterPageNovelControls calls
	let __rgCreatingChapterControls = false;

	async function createChapterPageNovelControls(controlsConfig = {}) {
		const handlerType = getHandlerType();

		// Only for CHAPTER_EMBEDDED handlers on chapter pages
		if (handlerType !== HANDLER_TYPES.CHAPTER_EMBEDDED) {
			return null;
		}

		if (!currentHandler?.isChapterPage?.()) {
			return null;
		}

		// Prevent concurrent calls from creating two containers simultaneously
		if (__rgCreatingChapterControls) {
			debugLog(
				"Chapter controls already being created, skipping concurrent call.",
			);
			return null;
		}
		__rgCreatingChapterControls = true;

		// DOM guard: if controls are already in the page, skip creation to prevent duplicates.
		// Callers that want a forced refresh must remove the existing element first.
		const existingDOMControls = document.getElementById(
			"rg-chapter-novel-controls",
		);
		if (existingDOMControls?.isConnected) {
			debugLog(
				"Chapter novel controls already exist in DOM – skipping creation to prevent duplicates.",
			);
			__rgCreatingChapterControls = false;
			return null;
		}

		try {
			if (!novelLibrary) {
				await loadNovelLibrary();
			}

			if (!novelLibrary) {
				debugLog(
					"Novel library not available for chapter page controls",
				);
				return null;
			}

			// Get novel ID and check if it exists in library
			const novelId = getNovelIdFromCurrentPage();
			const existingNovels = await novelLibrary.getRecentNovels(0);
			const existingNovel = novelId
				? existingNovels.find((n) => n.id === novelId)
				: null;

			// Define helper functions early so they're available to all UI elements
			const handleReadingStatusChange = async (newStatus) => {
				if (!novelLibrary || !existingNovel) return;
				try {
					const updated = await novelLibrary.updateReadingStatus(
						existingNovel.id,
						newStatus,
					);
					if (!updated) {
						showTimedBanner(
							"Failed to change status",
							"warning",
							3000,
						);
						return;
					}
					existingNovel.readingStatus = newStatus;
					showTimedBanner(
						`Status changed to: ${newStatus}`,
						"success",
						2000,
					);
					debugLog(`📖 Reading status changed to: ${newStatus}`);

					// Always refresh controls – remove-then-recreate pattern.
					// removeChapterNovelControlsFromDOM also cleans up the DT/DD
					// wrapper so no orphaned shells are left in the page.
					removeChapterNovelControlsFromDOM();
					const newControls =
						await createChapterPageNovelControls(controlsConfig);
					if (newControls) {
						placeChapterNovelControls(newControls, controlsConfig);
					}
				} catch (error) {
					debugError("Error changing reading status:", error);
					showTimedBanner("Failed to change status", "warning", 3000);
				}
			};

			const handleRemoveNovelWithBlocklist = async (novelId) => {
				if (!novelLibrary || !novelId) return;

				try {
					await novelLibrary.removeNovel(novelId);
					showTimedBanner(
						"Novel removed from library",
						"success",
						3000,
					);

					// Refresh controls – also strips the DT/DD wrapper to prevent orphaned shells.
					removeChapterNovelControlsFromDOM();
				} catch (error) {
					debugError("Error removing novel:", error);
					showTimedBanner("Failed to remove novel", "warning", 3000);
				}
			};

			// Create the compact controls container
			const controlsContainer = document.createElement("div");
			controlsContainer.id = "rg-chapter-novel-controls";
			protectFromThemeExtensions(controlsContainer);
			controlsContainer.style.cssText = `
			display: flex;
			flex-wrap: nowrap;
			align-items: center;
			gap: 6px;
			padding: 8px 10px;
			margin: 10px 0;
			background: linear-gradient(135deg, #1a2540 0%, #16213e 100%);
			border: 1px solid #2a4b8d;
			border-radius: 6px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
		`;

			if (controlsConfig.wrapInDefinitionList) {
				controlsContainer.style.justifyContent = "center";
				controlsContainer.style.width = "100%";
				controlsContainer.style.textAlign = "center";
			}

			// Allow handler to customize styling (e.g., AO3/FanFiction specific palettes)
			if (controlsConfig?.customStyles) {
				Object.assign(
					controlsContainer.style,
					controlsConfig.customStyles,
				);
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
				white-space: nowrap;
				flex: 0 0 auto;
			`;
				btn.addEventListener("mouseover", () => {
					btn.style.filter = "brightness(1.1)";
				});
				btn.addEventListener("mouseout", () => {
					btn.style.filter = "brightness(1)";
				});
				// Enforce compact sizing with highest inline priority to avoid host/mobile CSS width:100% rules.
				btn.style.setProperty("width", "auto", "important");
				btn.style.setProperty("max-width", "max-content", "important");
				btn.style.setProperty("min-width", "auto", "important");
				btn.style.setProperty("flex", "0 0 auto", "important");
				btn.addEventListener("click", onClick);
				return btn;
			};

			// Add/Update button
			const addUpdateBtn = createCompactButton(
				existingNovel ? "Update" : "Add to Library",
				existingNovel ? "🔄" : "➕",
				existingNovel ? "#00695c" : "#1976d2",
				async () => {
					if (existingNovel) {
						// Same behaviour as "Update Now" in the notification banner
						const currentMeta =
							currentHandler?.extractNovelMetadata?.() || {};
						await manuallyCheckAndUpdateNovel(
							existingNovel,
							currentMeta,
						);
					} else {
						await handleNovelAddUpdate();
					}
					// Refresh controls
					removeChapterNovelControlsFromDOM();
					const newControls =
						await createChapterPageNovelControls(controlsConfig);
					if (newControls) {
						placeChapterNovelControls(newControls, controlsConfig);
					}
				},
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
				min-width: 140px;
				max-width: 180px;
				white-space: nowrap;
				text-overflow: ellipsis;
				overflow: hidden;
				flex: 0 0 auto;
			`;
				statusSelect.style.setProperty("width", "auto", "important");
				statusSelect.style.setProperty(
					"max-width",
					"180px",
					"important",
				);
				statusSelect.style.setProperty(
					"min-width",
					"140px",
					"important",
				);
				statusSelect.style.setProperty("flex", "0 0 auto", "important");

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
						// Confirm deletion
						if (!confirm("Remove this novel from your library?")) {
							return;
						}
						await handleRemoveNovelWithBlocklist(existingNovel.id);
					},
				);
				controlsContainer.appendChild(removeBtn);

				// --- Reading Lists Dropdown ---
				const readingLists = new Set(existingNovel.readingLists || []);
				const readingListBadgeDefs = [
					{ id: "rereading", label: "🔁 Rereading" },
					{ id: "favourites", label: "⭐ Favourites" },
				];

				const readingListSelect = document.createElement("select");
				readingListSelect.title = "Manage Reading Lists";
				readingListSelect.style.cssText = `
					padding: 6px 8px;
					background: #2f2f2f;
					color: white;
					border: 1px solid #666;
					border-radius: 4px;
					cursor: pointer;
					font-size: 12px;
					min-width: 140px;
					max-width: 180px;
					white-space: nowrap;
					text-overflow: ellipsis;
					overflow: hidden;
					flex: 0 0 auto;
				`;
				readingListSelect.style.setProperty(
					"width",
					"auto",
					"important",
				);
				readingListSelect.style.setProperty(
					"max-width",
					"180px",
					"important",
				);
				readingListSelect.style.setProperty(
					"min-width",
					"140px",
					"important",
				);
				readingListSelect.style.setProperty(
					"flex",
					"0 0 auto",
					"important",
				);

				// Default/Prompt Option
				const defaultOpt = document.createElement("option");
				defaultOpt.value = "";
				defaultOpt.textContent = "📑 Add to List...";
				defaultOpt.disabled = true;
				defaultOpt.selected = true;
				readingListSelect.appendChild(defaultOpt);

				// List Options
				for (const listDef of readingListBadgeDefs) {
					const isActive = readingLists.has(listDef.id);
					const option = document.createElement("option");
					option.value = listDef.id;
					option.textContent =
						(isActive ? "✓ " : "  ") + listDef.label;
					readingListSelect.appendChild(option);
				}

				readingListSelect.addEventListener("change", async (e) => {
					const listId = e.target.value;
					if (!listId) return;

					const listDef = readingListBadgeDefs.find(
						(l) => l.id === listId,
					);
					try {
						const updated =
							await novelLibrary.toggleNovelReadingList(
								existingNovel.id,
								listId,
							);
						if (updated) {
							showTimedBanner(
								`${listDef.label} updated`,
								"success",
								1800,
							);
						}
						removeChapterNovelControlsFromDOM();
						const newControls =
							await createChapterPageNovelControls(
								controlsConfig,
							);
						if (newControls) {
							placeChapterNovelControls(
								newControls,
								controlsConfig,
							);
						}
					} catch (err) {
						debugError("Failed to update reading list", err);
						showTimedBanner(
							"Failed to update reading list",
							"warning",
							2000,
						);
					}
				});

				controlsContainer.appendChild(readingListSelect);
			}

			// Open Library button — pass novel ID so the library auto-opens the modal
			const libraryBtn = createCompactButton(
				"Library",
				"📚",
				"#7b1fa2",
				() => {
					const base = browser.runtime.getURL("library/library.html");
					const novelId = existingNovel?.id ?? null;
					const libraryUrl = novelId
						? `${base}?novel=${encodeURIComponent(novelId)}`
						: base;
					window.open(libraryUrl, "_blank");
				},
			);
			controlsContainer.appendChild(libraryBtn);

			// Incognito mode badge — shown when incognito is active
			if (isIncognitoActive()) {
				const incogBadge = document.createElement("span");
				const expiresAt = incognitoMode.expiresAt;
				const timeLabel = expiresAt
					? ` until ${new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
					: " (indefinite)";
				incogBadge.innerHTML = `🕵️ Incognito${timeLabel}`;
				incogBadge.title =
					"Incognito mode is active — library tracking is paused";
				incogBadge.style.cssText = `
					padding: 4px 8px;
					background: #37474f;
					color: #b0bec5;
					border-radius: 4px;
					font-size: 11px;
					font-weight: 600;
					white-space: nowrap;
					flex: 0 0 auto;
					border: 1px solid #546e7a;
				`;
				controlsContainer.appendChild(incogBadge);
			}

			// Add toggle banners button (except for dedicated_page handler types)
			// which don't need to hide/show enhancement banners
			if (handlerType !== HANDLER_TYPES.DEDICATED_PAGE) {
				const toggleBannersBtnLabel = shouldBannersBeHidden()
					? "Show Gemini UI"
					: "Hide Gemini UI";
				const toggleBannersBtn = createCompactButton(
					toggleBannersBtnLabel,
					"⚡",
					"#ff9800",
					() => {
						handleChapterControlsToggleBanners(toggleBannersBtn);
					},
				);
				toggleBannersBtn.className += " gemini-chapter-toggle-btn";
				controlsContainer.appendChild(toggleBannersBtn);
			}

			// Add custom handler buttons (e.g., FicHub download for FF.net and AO3)
			if (
				currentHandler &&
				typeof currentHandler.getCustomChapterButtons === "function"
			) {
				const customButtons = await Promise.resolve(
					currentHandler.getCustomChapterButtons(),
				);
				if (customButtons && Array.isArray(customButtons)) {
					customButtons.forEach((btnSpec) => {
						if (
							btnSpec &&
							btnSpec.text &&
							btnSpec.emoji &&
							btnSpec.color &&
							btnSpec.onClick
						) {
							if (btnSpec.badgeStyle) {
								// Render as a badge (like the "In Library" status indicator)
								const badge = document.createElement("span");
								badge.innerHTML = `${btnSpec.emoji} ${btnSpec.text}`;
								badge.style.cssText = `
									padding: 4px 8px;
									background: ${btnSpec.color};
									color: white;
									border-radius: 4px;
									font-size: 11px;
									font-weight: 600;
									cursor: pointer;
									white-space: nowrap;
									flex: 0 0 auto;

								`;
								const origText = badge.innerHTML;
								badge.addEventListener("click", async () => {
									await btnSpec.onClick();
									badge.innerHTML = "✅ Copied!";
									setTimeout(() => {
										badge.innerHTML = origText;
									}, 2000);
								});
								controlsContainer.appendChild(badge);
							} else {
								const customBtn = createCompactButton(
									btnSpec.text,
									btnSpec.emoji,
									btnSpec.color,
									btnSpec.onClick,
								);
								controlsContainer.appendChild(customBtn);
							}
						}
					});
				}
			}

			return controlsContainer;
		} finally {
			__rgCreatingChapterControls = false;
		}
	}

	// Function to inject UI elements (buttons, status area)
	async function injectUI() {
		const contentArea = findContentArea();
		if (!contentArea) {
			console.warn(
				"Ranobe Gemini: Target element for UI injection not found.",
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
		protectFromThemeExtensions(controlsContainer);
		controlsContainer.style.marginBottom = "10px"; // Add some space below buttons

		// Apply mobile-specific class if on a mobile device
		if (isMobileDevice) {
			controlsContainer.classList.add("mobile-view");
		}

		const toggleBannersButton = createToggleBannersButton();
		const enhanceButton = createEnhanceButton();
		cancelEnhanceButton = createCancelEnhanceButton();

		const statusDiv = document.createElement("div");
		statusDiv.id = "gemini-status";
		statusDiv.style.marginTop = "5px";

		// For chapter_embedded handlers ALL three controls (toggle/enhance/cancel) live
		// inside #rg-chapter-novel-controls and the chunk banners already — #gemini-controls
		// would duplicate them.  dedicated_page (and any future) handlers keep all three here.
		if (getHandlerType() !== HANDLER_TYPES.CHAPTER_EMBEDDED) {
			controlsContainer.appendChild(toggleBannersButton);
			controlsContainer.appendChild(enhanceButton);
			controlsContainer.appendChild(cancelEnhanceButton);
		}

		// Create summary/chunk controls upfront so users can summarize/select chunks before enhancement
		const chunking = await loadChunkingSystem();
		let mainSummaryGroup = null;
		let totalSummaryChunks = 1;
		if (chunking?.summaryUI) {
			totalSummaryChunks = await initializeChunkedViewForSummaries(
				contentArea,
				chunking,
			);

			mainSummaryGroup = chunking.summaryUI.createMainSummaryGroup(
				totalSummaryChunks,
				(indices) => summarizeChunkRange(indices, false),
				(indices) => summarizeChunkRange(indices, true),
				handleEnhanceClick,
			);

			// Apply handler-level default visibility setting
			if (
				currentHandler?.constructor?.DEFAULT_BANNERS_VISIBLE === false
			) {
				mainSummaryGroup.style.display = "none";
			}
		}

		// Get optimal insertion point based on the handler
		let insertionPoint = contentArea;
		let insertionPosition = "before";

		if (currentHandler) {
			const uiInfo = currentHandler.getUIInsertionPoint(contentArea);
			insertionPoint = uiInfo.element || contentArea;
			insertionPosition = uiInfo.position || "before";
		}

		const domIntegration = await loadDomIntegrationModule();
		if (domIntegration?.insertMainUiBlocksRuntime) {
			domIntegration.insertMainUiBlocksRuntime({
				insertionPoint,
				insertionPosition,
				controlsContainer,
				mainSummaryGroup,
				siteEnhancementsContainer,
				versionSwitcherContainer,
			});
		} else if (insertionPoint?.parentNode) {
			insertionPoint.parentNode.insertBefore(
				controlsContainer,
				insertionPoint,
			);
			if (mainSummaryGroup) {
				insertionPoint.parentNode.insertBefore(
					mainSummaryGroup,
					insertionPoint,
				);
			}
		}

		debugLog(
			`Ranobe Gemini: UI injected successfully for ${
				isMobileDevice ? "mobile" : "desktop"
			} view.`,
		);

		// Add the initial word count display
		addInitialWordCountDisplay(contentArea);

		// Update toggle button text to match initial visibility state
		const toggleBtn = document.querySelector(".gemini-toggle-banners-btn");
		if (
			toggleBtn &&
			currentHandler?.constructor?.DEFAULT_BANNERS_VISIBLE === false
		) {
			toggleBtn.innerHTML =
				'<span style="font-size: 20px;">⚡</span> <span style="font-weight: 600;">Show Ranobe Gemini</span>';
		} else if (toggleBtn) {
			toggleBtn.innerHTML =
				'<span style="font-size: 20px;">⚡</span> <span style="font-weight: 600;">Hide Ranobe Gemini</span>';
		}

		// Add novel controls for CHAPTER_EMBEDDED type sites (like FanFiction.net)
		// These are added asynchronously after main UI
		setTimeout(async () => {
			try {
				const controlsConfig =
					currentHandler?.getNovelControlsConfig?.() || {};
				const novelControls =
					await createChapterPageNovelControls(controlsConfig);
				if (novelControls) {
					placeChapterNovelControls(novelControls, controlsConfig);
					debugLog(
						"Ranobe Gemini: Novel controls added for chapter page",
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
					"Ranobe Gemini: controls missing, re-injecting UI",
				);
				await injectUI();
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
					const novelControls =
						await createChapterPageNovelControls(controlsConfig);
					if (novelControls) {
						placeChapterNovelControls(
							novelControls,
							controlsConfig,
						);
					}
				} catch (heartbeatError) {
					debugLog(
						"Ranobe Gemini: keep-alive could not re-add controls",
						heartbeatError,
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
							window.location.href,
						);
						const stored = await browser.storage.local.get([
							"autoEnhanceNovels",
						]);
						const autoEnhanceNovels =
							stored.autoEnhanceNovels || [];
						const handlerShelfId =
							currentHandler?.constructor?.SHELF_METADATA?.id;
						const siteAutoEnhance =
							handlerShelfId &&
							siteSettings?.[handlerShelfId]
								?.autoEnhanceEnabled === true;
						const shouldAutoEnhance =
							(novel && novel.autoEnhance === true) ||
							(novel && autoEnhanceNovels.includes(novel.id)) ||
							siteAutoEnhance;

						if (shouldAutoEnhance) {
							debugLog(
								"🚀 Auto-enhance enabled for this novel, starting enhancement...",
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
				"data-original-content",
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

	// Handle click event for Summarize button (used by message handler for non-chunked content)
	// Delegates to the unified summary service which handles both chunked and non-chunked pages.
	async function handleSummarizeClick(isShort = false) {
		// Use [0] as a single-chunk placeholder — the summary service's collectContent()
		// correctly falls through to live extraction when no chunk DOM elements exist.
		return summarizeChunkRange([0], isShort);
	}

	// Helper: Get content area HTML without any Gemini UI elements
	function getCleanContentHTML(contentArea) {
		if (!contentArea) return "";

		// Clone the content area to avoid modifying the actual DOM
		const clone = contentArea.cloneNode(true);

		// Remove all Gemini UI elements from the clone
		const geminiElements = clone.querySelectorAll(
			".gemini-main-summary-group, .gemini-chunk-summary-group, " +
				".gemini-chunk-banner, .gemini-master-banner, .gemini-wip-banner, " +
				".gemini-enhanced-banner, #gemini-chunked-content",
		);
		geminiElements.forEach((el) => el.remove());

		return clone.innerHTML;
	}

	// Handle click event for Enhance button
	async function handleEnhanceClick() {
		// Prevent concurrent invocations (e.g. auto-enhance fires while user
		// is already manually enhancing, or button clicked twice quickly).
		const firstBtn = document.querySelector(".gemini-enhance-btn");
		if (firstBtn?.disabled) return;

		enhancementCancelRequested = false;

		// Check if there's a chunked container with individually-enhanced chunks that
		// has NOT gone through the normal "Regenerate" path (hasCachedContent=true but
		// isCachedContent=false means chunk-level cache only, not whole-page cache).
		// Treat this the same as the Regenerate path: clear chunk caches and re-enhance.
		const existingChunkedOnClick = document.getElementById(
			"gemini-chunked-content",
		);
		if (existingChunkedOnClick && !isCachedContent) {
			const allChunkEls = existingChunkedOnClick.querySelectorAll(
				".gemini-chunk-content",
			);
			const enhancedChunkEls = existingChunkedOnClick.querySelectorAll(
				'.gemini-chunk-content[data-chunk-enhanced="true"]',
			);
			// Error chunks: banners whose status attribute is "error" and chunk not enhanced
			const errorBanners = existingChunkedOnClick.querySelectorAll(
				'.gemini-chunk-banner[data-chunk-status="error"]',
			);
			const hasErrorChunks = errorBanners.length > 0;

			// Continue/re-enhance path:
			//  (a) SOME but not ALL chunks are enhanced (partial batch), OR
			//  (b) ANY chunk is in error state (even if nothing else was enhanced)
			const isPartial =
				allChunkEls.length > 0 &&
				enhancedChunkEls.length > 0 &&
				enhancedChunkEls.length < allChunkEls.length;
			if (isPartial || (allChunkEls.length > 0 && hasErrorChunks)) {
				// Re-enhance all unenhanced chunks (covers both error and pending states)
				const remainingIndices = Array.from(allChunkEls)
					.filter(
						(el) =>
							el.getAttribute("data-chunk-enhanced") !== "true",
					)
					.map((el) =>
						parseInt(el.getAttribute("data-chunk-index"), 10),
					)
					.filter((idx) => !isNaN(idx));

				document
					.querySelectorAll(".gemini-enhance-btn")
					.forEach((btn) => {
						btn.textContent = "Processing...";
						btn.disabled = true;
						btn.classList.add("loading");
					});
				if (cancelEnhanceButton)
					cancelEnhanceButton.style.display = "inline-flex";

				const statusMsg =
					hasErrorChunks && enhancedChunkEls.length === 0
						? `Re-generating ${errorBanners.length} failed chunk(s)...`
						: `Continuing enhancement: ${remainingIndices.length} chunk(s) remaining...`;
				showStatusMessage(statusMsg, "info", 3000);
				showWorkInProgressBanner(
					enhancedChunkEls.length,
					allChunkEls.length,
					"processing",
				);

				for (const chunkIndex of remainingIndices) {
					if (enhancementCancelRequested) break;
					await handleReenhanceChunk(chunkIndex);
				}

				if (cancelEnhanceButton)
					cancelEnhanceButton.style.display = "none";
				// Ensure button is reset if still loading (e.g. after cancel or chunk error)
				document
					.querySelectorAll(".gemini-enhance-btn")
					.forEach((btn) => {
						if (btn.disabled || btn.classList.contains("loading")) {
							const allNow =
								existingChunkedOnClick.querySelectorAll(
									".gemini-chunk-content",
								);
							const doneNow =
								existingChunkedOnClick.querySelectorAll(
									'.gemini-chunk-content[data-chunk-enhanced="true"]',
								);
							const allCompleted =
								doneNow.length === allNow.length &&
								allNow.length > 0;
							btn.textContent = allCompleted
								? "🔄 Re-enhance with Gemini"
								: "✨ Enhance with Gemini";
							btn.disabled = false;
							btn.classList.remove("loading");
						}
					});
				return;
			}

			// All chunks enhanced (re-enhance from scratch) or nothing enhanced yet (fresh start)
			if (
				enhancedChunkEls.length > 0 &&
				enhancedChunkEls.length === allChunkEls.length
			) {
				// All chunks were individually enhanced — user confirmed re-enhance from scratch
				showStatusMessage(
					"All chunks already enhanced — re-enhancing from scratch...",
					"info",
					3000,
				);
			}
			const chunkingForCleanup = await loadChunkingSystem();
			if (chunkingForCleanup?.cache?.deleteAllChunksForUrl) {
				await chunkingForCleanup.cache
					.deleteAllChunksForUrl(window.location.href)
					.catch(() => {});
			}
			hasCachedContent = false;
			isCachedContent = false;
			// Fall through to fresh enhancement below
		}

		// Check cache first
		if (storageManager && (isCachedContent || hasCachedContent)) {
			const enhanceBtns = document.querySelectorAll(
				".gemini-enhance-btn",
			);
			const originalText = enhanceBtns[0]?.textContent ?? "";

			if (isCachedContent && originalText.includes("Regenerate")) {
				// Clear ALL caches before regeneration but continue to process
				await storageManager.removeEnhancedContent(
					window.location.href,
				);
				// Also clear chunked cache if it exists
				const chunking = await loadChunkingSystem();
				if (chunking?.cache?.deleteAllChunksForUrl) {
					await chunking.cache.deleteAllChunksForUrl(
						window.location.href,
					);
				}
				isCachedContent = false;
				hasCachedContent = false;
				// Update button text immediately
				enhanceBtns.forEach(
					(b) => (b.textContent = "✨ Enhance with Gemini"),
				);
				const contentArea = findContentArea();
				if (contentArea) {
					// Remove ALL Gemini UI elements before regenerating
					const chunkedContainer = document.getElementById(
						"gemini-chunked-content",
					);
					if (chunkedContainer) chunkedContainer.remove();

					const masterBanner = contentArea.querySelector(
						".gemini-master-banner",
					);
					if (masterBanner) masterBanner.remove();

					// Remove placeholder summary group
					const placeholderSummary = contentArea.querySelector(
						".gemini-main-summary-group",
					);
					if (placeholderSummary) placeholderSummary.remove();

					const originalHtml =
						contentArea.getAttribute("data-original-html");
					const originalContent = contentArea.getAttribute(
						"data-original-content",
					);
					const isShowingEnhanced =
						contentArea.getAttribute("data-showing-enhanced") ===
						"true";

					if (isShowingEnhanced) {
						if (originalHtml) {
							// Restore from chunked cache original HTML
							contentArea.innerHTML = originalHtml;
							contentArea.removeAttribute("data-original-html");
							contentArea.removeAttribute("data-original-text");
							contentArea.removeAttribute("data-total-chunks");
						} else if (originalContent) {
							contentArea.innerHTML = originalContent;
						}
						contentArea.setAttribute(
							"data-showing-enhanced",
							"false",
						);
						const banner = contentArea.querySelector(
							".gemini-enhanced-banner",
						);
						if (banner) banner.remove();
					}
				}
			} else {
				// Try loading cached content
				try {
					const cachedData = await storageManager.loadEnhancedContent(
						window.location.href,
					);
					if (cachedData && cachedData.enhancedContent) {
						showStatusMessage(
							"Loading cached enhanced content...",
							"info",
						);
						replaceContentWithEnhancedVersion(cachedData);
						isCachedContent = true;
						hasCachedContent = true;
						if (button) {
							button.textContent = originalText;
							button.disabled = false;
							button.classList.remove("loading");
						}
						if (cancelEnhanceButton) {
							cancelEnhanceButton.style.display = "none";
						}
						return;
					} else {
						showStatusMessage(
							"Cached enhanced content is invalid or missing.",
							"error",
						);
						hasCachedContent = false;
					}
				} catch (err) {
					showStatusMessage(
						"Failed to load cached enhanced content.",
						"error",
					);
					hasCachedContent = false;
				}
			}
		}

		// Extract content
		const extractedContent = extractContent();
		if (!extractedContent.found) {
			showStatusMessage("No content found to process", "error");
			return;
		}

		try {
			// Disable UI and show status
			document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
				btn.textContent = "Waking up AI...";
				btn.disabled = true;
			});
			if (cancelEnhanceButton) {
				cancelEnhanceButton.style.display = "inline-flex";
			}
			showStatusMessage("Waking up AI service...", "info");

			// Wake up background worker with retry logic
			const isReady = await wakeUpBackgroundWorker();
			if (!isReady) {
				throw new Error(
					"Background service is not responding. Please try again.",
				);
			}

			document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
				btn.textContent = "Processing...";
			});
			showStatusMessage("Processing content with Gemini AI...", "info");

			// Load config values from storage to match chunking configuration
			const settings = await browser.storage.local.get([
				"chunkingEnabled",
				"chunkSizeWords", // NEW: word-based chunk size
				"chunkSummaryCount", // NEW: summary repeat count
				"useEmoji",
				"formatGameStats",
				"centerSceneHeadings",
			]);
			const chunkingEnabled = settings.chunkingEnabled !== false;
			const useEmoji = settings.useEmoji === true;
			formattingOptions.useEmoji = useEmoji;
			formattingOptions.formatGameStats =
				settings.formatGameStats !== false; // default true
			formattingOptions.centerSceneHeadings =
				settings.centerSceneHeadings !== false; // default true

			// Load chunking system (new modular word-based system)
			const chunking = chunkingEnabled
				? await loadChunkingSystem()
				: null;
			if (chunkingEnabled && !chunking) {
				showStatusMessage(
					"Chunking system unavailable. Proceeding without chunking.",
					"warning",
					3000,
				);
			}

			// If chunking is enabled, use word-based chunking
			const contentArea = findContentArea();
			if (!contentArea)
				throw new Error("Unable to find content area for enhancement");

			let shouldChunk =
				chunkingEnabled && chunking && extractedContent.text;

			let chunks = []; // Array of {index, content, wordCount}
			let chunkSummaryCount = 2;
			let contentToSend = extractedContent.text; // Default to text, will be HTML if chunking

			if (shouldChunk) {
				try {
					const chunkConfig = await chunking.config.getChunkConfig();
					const chunkSizeWords = chunkConfig.chunkSizeWords;
					chunkSummaryCount = chunkConfig.chunkSummaryCount;

					// Get clean HTML without Gemini UI elements for accurate chunking
					const originalHTML =
						contentArea.getAttribute("data-original-html") ||
						getCleanContentHTML(contentArea);
					contentToSend = originalHTML; // Use HTML for chunking to match background
					chunks = chunking.core.splitContentByWords(
						originalHTML,
						chunkSizeWords,
					);
					debugLog(
						`[Chunking] Split content into ${chunks.length} chunks (word-based, ${chunkSizeWords} words per chunk)`,
					);
				} catch (splitError) {
					debugError(
						"Failed to split content for chunking:",
						splitError,
					);
					showStatusMessage(
						"Chunking failed; proceeding without chunking.",
						"warning",
						4000,
					);
					shouldChunk = false;
				}

				// Always enable chunking UI if we have chunks array (even for single chunk)
				// This ensures summary buttons appear for all chapters
				if (!chunks || chunks.length === 0) {
					shouldChunk = false;
				}

				if (shouldChunk) {
					// Remove ALL existing Gemini UI elements before creating new ones
					// This prevents duplicate banners (especially the placeholder summary group from injectUI)
					const existingChunkedContainer = document.getElementById(
						"gemini-chunked-content",
					);
					if (existingChunkedContainer)
						existingChunkedContainer.remove();

					const existingMasterBanner = contentArea.querySelector(
						".gemini-master-banner",
					);
					if (existingMasterBanner) existingMasterBanner.remove();

					// Remove placeholder summary group created in injectUI
					const existingPlaceholderGroup =
						contentArea.parentNode?.querySelector(
							".gemini-main-summary-group",
						);
					if (existingPlaceholderGroup)
						existingPlaceholderGroup.remove();

					// Preserve original source content when pre-chunk view already exists
					const originalHTML =
						contentArea.getAttribute("data-original-html") ||
						getCleanContentHTML(contentArea);
					const originalText =
						contentArea.getAttribute("data-original-text") ||
						extractedContent.text;
					try {
						contentArea.setAttribute(
							"data-original-html",
							originalHTML,
						);
						contentArea.setAttribute(
							"data-original-text",
							originalText,
						);
						contentArea.setAttribute(
							"data-total-chunks",
							chunks.length,
						);

						const chunkedContentContainer =
							document.createElement("div");
						chunkedContentContainer.id = "gemini-chunked-content";
						chunkedContentContainer.style.width = "100%";

						for (let i = 0; i < chunks.length; i++) {
							const chunkWrapper = document.createElement("div");
							chunkWrapper.className = "gemini-chunk-wrapper";
							chunkWrapper.setAttribute("data-chunk-index", i);

							const initialStatus =
								i === 0 ? "processing" : "pending";
							const banner = buildChunkBanner(
								chunking,
								i,
								chunks.length,
								initialStatus,
							);
							chunkWrapper.appendChild(banner);

							const chunkContent = document.createElement("div");
							chunkContent.className = "gemini-chunk-content";
							chunkContent.setAttribute("data-chunk-index", i);
							chunkContent.setAttribute(
								"data-original-chunk-html",
								chunks[i].content,
							);
							chunkContent.setAttribute(
								"data-original-chunk-content",
								stripHtmlTags(chunks[i].content),
							);
							chunkContent.innerHTML = chunks[i].content;
							chunkWrapper.appendChild(chunkContent);

							chunkedContentContainer.appendChild(chunkWrapper);
						}

						contentArea.innerHTML = "";
						contentArea.appendChild(chunkedContentContainer);

						const chunkWrappers = Array.from(
							chunkedContentContainer.querySelectorAll(
								".gemini-chunk-wrapper",
							),
						);
						if (chunking?.summaryUI) {
							// The placeholder summary group (totalChunks=1) was already removed above.
							// Remove any remaining stale copies then create a fresh one with the
							// correct chunk count so summary buttons work immediately.
							document
								.querySelectorAll(".gemini-main-summary-group")
								.forEach((el) => el.remove());

							const newMainSummaryGroup =
								chunking.summaryUI.createMainSummaryGroup(
									chunks.length,
									(indices) =>
										summarizeChunkRange(indices, false),
									(indices) =>
										summarizeChunkRange(indices, true),
								);
							if (shouldBannersBeHidden()) {
								newMainSummaryGroup.style.display = "none";
							}
							contentArea.insertBefore(
								newMainSummaryGroup,
								chunkedContentContainer,
							);

							// Only insert per-chunk summary groups if we have multiple chunks
							if (chunks.length > 1) {
								chunking.summaryUI.insertSummaryGroups(
									chunkedContentContainer,
									chunkWrappers,
									chunkSummaryCount,
									(indices) =>
										summarizeChunkRange(indices, false),
									(indices) =>
										summarizeChunkRange(indices, true),
								);

								// Chunk summary groups are always visible for easy access to summaries
							}
						}

						// Apply current visibility state to chunk banners
						if (shouldBannersBeHidden()) {
							const chunkBanners =
								chunkedContentContainer.querySelectorAll(
									".gemini-chunk-banner",
								);
							chunkBanners.forEach((banner) => {
								banner.style.display = "none";
							});
						}

						debugLog(
							`Prepared ${chunks.length} chunks for inline replacement with preserved HTML`,
						);
						showWorkInProgressBanner(0, chunks.length);
						// Enable text selection on the freshly created chunk content
						enableCopyOnContentArea(contentArea);
					} catch (prepError) {
						debugError(
							"Failed to prepare chunked view:",
							prepError,
						);
						contentArea.innerHTML = originalHTML;
						contentArea.removeAttribute("data-original-html");
						contentArea.removeAttribute("data-original-text");
						contentArea.removeAttribute("data-total-chunks");
						shouldChunk = false;
						showStatusMessage(
							"Could not prepare chunked content. Proceeding without chunking.",
							"warning",
							4000,
						);
					}
				}
			}
			// Get novel-specific custom prompt if available
			let novelCustomPrompt = "";
			if (novelLibrary) {
				try {
					const novel = await novelLibrary.getNovelByUrl(
						window.location.href,
					);
					if (novel && novel.customPrompt) {
						novelCustomPrompt = novel.customPrompt;
						debugLog(
							`Using novel-specific prompt for: ${novel.title}`,
						);
					}
				} catch (err) {
					debugLog("Could not get novel custom prompt:", err);
				}
			}

			// Combine site-specific, novel-specific, and custom box type prompts
			const combinedPrompt = await buildCombinedPrompt(
				novelCustomPrompt || undefined,
			);

			// Send content to background for processing (background will stream chunkProcessed messages)
			// Using sendMessageWithRetry to handle service worker sleep issues
			if (!shouldChunk) {
				showWorkInProgressBanner(0, 1);
			}
			const response = await sendMessageWithRetry({
				action: "processWithGemini",
				title: extractedContent.title,
				content: contentToSend, // Send HTML when chunking, text otherwise
				siteSpecificPrompt: combinedPrompt,
				useEmoji: useEmoji,
				forceChunking: Boolean(shouldChunk),
			});

			if (enhancementCancelRequested) {
				debugLog("Enhancement cancelled; ignoring response");
				const wipBanner = document.querySelector(".gemini-wip-banner");
				if (wipBanner) {
					wipBanner.remove();
				}
				const cancelButton = document.querySelector(
					".gemini-enhance-btn",
				);
				if (cancelButton) {
					cancelButton.textContent = "✨ Enhance with Gemini";
					cancelButton.disabled = false;
					cancelButton.classList.remove("loading");
				}
				if (cancelEnhanceButton) {
					cancelEnhanceButton.style.display = "none";
				}
				return;
			}

			if (response && response.success) {
				// If background returned a combined result (non-chunked), handle it here
				// Skip if we've already been handling chunks progressively
				if (response.result && response.result.enhancedContent) {
					const isChunkedUiActive = Boolean(
						document.getElementById("gemini-chunked-content"),
					);
					if (isChunkedUiActive) {
						const chunking = await loadChunkingSystem();
						const totalChunks = chunks.length || 1;
						const wordCount = chunking?.core?.countWords
							? chunking.core.countWords(
									response.result.enhancedContent,
								)
							: 0;
						await handleChunkProcessed({
							chunkIndex: 0,
							totalChunks: totalChunks,
							result: {
								originalContent: extractedContent.text,
								enhancedContent:
									response.result.enhancedContent,
								wordCount: wordCount,
							},
							isComplete: true,
						});
					} else {
						showWorkInProgressBanner(1, 1, "complete");
						replaceContentWithEnhancedVersion(response.result);
					}
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
						"error",
					);
					// Try to open the popup
					try {
						await browser.runtime.sendMessage({
							action: "openPopup",
						});
					} catch (popupError) {
						console.warn(
							"Could not open popup automatically:",
							popupError,
						);
						showStatusMessage(
							"⚠️ API key is missing. Please click the extension icon to configure it.",
							"error",
							10000, // Show for 10 seconds
						);
					}
				} else {
					showStatusMessage(
						"Error processing with Gemini: " + errorMessage,
						"error",
					);
				}
			}
			if (cancelEnhanceButton) {
				cancelEnhanceButton.style.display = "none";
			}
		} catch (error) {
			debugError("Error in handleEnhanceClick:", error);
			showStatusMessage(`Error: ${error.message}`, "error");
			document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
				if (btn.disabled || btn.classList.contains("loading")) {
					btn.textContent = "✨ Enhance with Gemini";
					btn.disabled = false;
					btn.classList.remove("loading");
				}
			});
			if (cancelEnhanceButton) {
				cancelEnhanceButton.style.display = "none";
			}
		}
	}

	// Updated function to replace content with Gemini-enhanced version
	async function replaceContentWithEnhancedVersion(enhancedContent) {
		const contentArea = findContentArea();
		if (!contentArea) {
			showStatusMessage(
				"Unable to find content area for replacement",
				"error",
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
			const cacheInfo = isFromCache
				? {
						fromCache: true,
						timestamp: enhancedContent.timestamp,
					}
				: null;

			if (isFromCache) {
				isCachedContent = true;
				hasCachedContent = true;
				document
					.querySelectorAll(".gemini-enhance-btn")
					.forEach((btn) => {
						btn.textContent = "♻ Regenerate with Gemini";
					});
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
					originalContent?.length || 0,
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
						"Enhanced content missing <p> tags, converting newlines to paragraphs",
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
				const supportsTextOnly = shouldUseTextOnlyEnhancement();

				let newContent;

				if (
					supportsTextOnly &&
					typeof currentHandler.applyEnhancedContent === "function"
				) {
					debugLog(
						"Handler provides text-only enhancement; delegating paragraph updates...",
					);
					currentHandler.applyEnhancedContent(
						contentArea,
						sanitizedContent,
					);
					newContent =
						contentArea.innerText || contentArea.textContent;
				} else {
					debugLog("Using default full HTML enhancement pathway...");
					const { preservedElements: originalImages } =
						preserveHtmlElements(originalContent);
					debugLog(
						`Preserved ${originalImages.length} images from original content`,
					);
					const {
						modifiedContent: contentWithPreservedStats,
						preservedBoxes,
					} = preserveGameStatsBoxes(sanitizedContent);
					let contentToDisplay = contentWithPreservedStats;
					if (preservedBoxes.length > 0) {
						debugLog(
							`Restoring ${preservedBoxes.length} game stats boxes`,
						);
						contentToDisplay = restoreGameStatsBoxes(
							contentToDisplay,
							preservedBoxes,
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
					newContent =
						contentArea.innerText || contentArea.textContent;
				}

				applyPostEnhancementFormatting(contentArea);

				// Apply font size setting to enhanced content
				if (currentFontSize && currentFontSize !== 100) {
					contentArea.style.fontSize = `${currentFontSize}%`;
				}

				contentArea.setAttribute(
					"data-original-content",
					originalContent,
				);
				contentArea.setAttribute(
					"data-enhanced-content",
					contentArea.innerHTML,
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
					enhancedHasPTags,
				);
				// Log first 500 chars of original to see structure
				debugLog(
					"Original HTML preview:",
					originalContent
						? originalContent.substring(0, 500)
						: "null",
				);

				removeOriginalWordCount();

				// Helper function to create and attach toggle functionality
				const setupToggleBanner = (showingEnhanced) => {
					// Remove any existing banner first
					const existingBanners = contentArea.querySelectorAll(
						".gemini-enhanced-banner",
					);
					existingBanners.forEach((b) => b.remove());

					debugLog(
						"Toggle button found, attaching click handler. showingEnhanced:",
						showingEnhanced,
					);

					const onToggleBannerClick = function (e) {
						debugLog("Toggle button clicked!");
						e.preventDefault();
						e.stopPropagation();

						const currentlyShowingEnhanced =
							contentArea.getAttribute(
								"data-showing-enhanced",
							) === "true";
						debugLog(
							"currentlyShowingEnhanced:",
							currentlyShowingEnhanced,
						);

						if (currentlyShowingEnhanced) {
							// Switch to original - restore original HTML
							const storedOriginal = contentArea.getAttribute(
								"data-original-content",
							);
							debugLog(
								"Switching to original. storedOriginal length:",
								storedOriginal ? storedOriginal.length : 0,
								"Has <p> tags:",
								storedOriginal
									? /<p[\s>]/i.test(storedOriginal)
									: false,
							);
							debugLog(
								"Restoring HTML preview:",
								storedOriginal
									? storedOriginal.substring(0, 500)
									: "null",
							);
							if (storedOriginal) {
								contentArea.innerHTML =
									sanitizeHTML(storedOriginal);
								contentArea.setAttribute(
									"data-showing-enhanced",
									"false",
								);
								debugLog(
									"Switched to original content. Actual innerHTML has <p> tags:",
									/<p[\s>]/i.test(contentArea.innerHTML),
								);
							} else {
								debugError("No stored original content found!");
							}
						} else {
							// Switch to enhanced - restore enhanced HTML
							const storedEnhanced = contentArea.getAttribute(
								"data-enhanced-content",
							);
							debugLog(
								"Switching to enhanced. storedEnhanced length:",
								storedEnhanced ? storedEnhanced.length : 0,
							);
							if (storedEnhanced) {
								contentArea.innerHTML =
									sanitizeHTML(storedEnhanced);
								contentArea.setAttribute(
									"data-showing-enhanced",
									"true",
								);

								// Reapply formatting
								applyPostEnhancementFormatting(contentArea);
								// Re-enable copy on the freshly set content
								enableCopyOnContentArea(contentArea);
								debugLog("Switched to enhanced content");
							} else {
								debugError("No stored enhanced content found!");
							}
						}

						// Recursively setup the banner for the new state
						debugLog(
							"Setting up toggle banner for state:",
							!currentlyShowingEnhanced,
						);
						setupToggleBanner(!currentlyShowingEnhanced);
					};

					const newBanner = refreshToggleBanner({
						contentArea,
						createBanner: () =>
							createEnhancedBanner(
								originalText,
								newContent,
								modelInfo,
								isCachedContent,
								cacheInfo,
							),
						toggleLabel: showingEnhanced
							? "Show Original"
							: "Show Enhanced",
						onToggleClick: onToggleBannerClick,
						wireDeleteCache: true,
					});

					debugLog(
						"Banner inserted. contentArea:",
						contentArea.id,
						"Banner parent:",
						newBanner?.parentNode
							? newBanner.parentNode.id
							: "null",
					);
				};

				// Ensure text can be selected/copied from enhanced content
				enableCopyOnContentArea(contentArea);

				// Initial banner setup
				setupToggleBanner(true);

				window.scrollTo(0, scrollPosition);
				showStatusMessage(
					"Content successfully enhanced with Gemini!",
					"success",
					5000,
					{
						metadata: {
							source: isFromCache ? "cache" : "fresh",
							model:
								modelInfo?.name ||
								modelInfo?.model ||
								modelInfo?.id ||
								null,
							contentLength: newContent?.length || null,
						},
					},
				);

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
							},
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
			}
		} catch (error) {
			debugError("Error replacing content:", error);
			showStatusMessage(
				`Error replacing content: ${error.message}`,
				"error",
			);
			return false;
		}
	}

	function insertNodeAtContentTop(contentArea, node) {
		if (!contentArea || !node) return false;
		if (domIntegrationModule?.insertAtContentTopRuntime) {
			return domIntegrationModule.insertAtContentTopRuntime({
				contentArea,
				node,
			});
		}
		if (contentArea.firstChild) {
			contentArea.insertBefore(node, contentArea.firstChild);
		} else {
			contentArea.appendChild(node);
		}
		return true;
	}

	function insertAfterControlsOrTop(contentArea, node) {
		if (!contentArea || !node) return false;
		if (domIntegrationModule?.insertAfterControlsOrTopRuntime) {
			return domIntegrationModule.insertAfterControlsOrTopRuntime({
				documentRef: document,
				contentArea,
				node,
			});
		}

		const controlsContainer = document.getElementById("gemini-controls");
		if (controlsContainer?.parentNode) {
			controlsContainer.parentNode.insertBefore(
				node,
				controlsContainer.nextSibling,
			);
			return true;
		}

		return insertNodeAtContentTop(contentArea, node);
	}

	function refreshToggleBanner({
		contentArea,
		createBanner,
		toggleLabel,
		onToggleClick,
		insertBeforeNode = null,
		wireDeleteCache = false,
	}) {
		return (
			enhancementToggleBannerModule?.refreshToggleBannerRuntime?.({
				contentArea,
				createBanner,
				toggleLabel,
				onToggleClick,
				insertBeforeNode,
				wireDeleteCache,
				documentRef: document,
				windowRef: window,
				storageManager,
				showStatusMessage,
				insertNodeAtContentTop,
			}) || null
		);
	}

	function attachDeleteCacheButtonHandler(banner) {
		enhancementToggleBannerModule?.attachDeleteCacheButtonHandlerRuntime?.({
			banner,
			storageManager,
			windowRef: window,
			showStatusMessage,
			onDeleted: () => {
				isCachedContent = false;
			},
		});
	}

	function shouldUseTextOnlyEnhancement() {
		return Boolean(
			currentHandler &&
			typeof currentHandler.supportsTextOnlyEnhancement === "function" &&
			currentHandler.supportsTextOnlyEnhancement(),
		);
	}

	function applyPostEnhancementFormatting(contentArea) {
		if (!contentArea) return;
		if (
			currentHandler &&
			typeof currentHandler.formatAfterEnhancement === "function"
		) {
			currentHandler.formatAfterEnhancement(contentArea);
			return;
		}
		applyDefaultFormatting(contentArea);
	}

	// Function to display enhanced content with toggle ability
	// eslint-disable-next-line no-unused-vars
	function displayEnhancedContent(originalContent, enhancedContent) {
		const contentArea = findContentArea();
		if (!contentArea) {
			showStatusMessage(
				"Unable to find content area for replacement",
				"error",
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
			const supportsTextOnly = shouldUseTextOnlyEnhancement();

			if (
				supportsTextOnly &&
				typeof currentHandler.applyEnhancedContent === "function"
			) {
				debugLog(
					"Handler provides text-only enhancement for display path; delegating...",
				);
				currentHandler.applyEnhancedContent(
					contentArea,
					enhancedContent,
				);
			} else {
				debugLog(
					"Using default full HTML replacement in displayEnhancedContent...",
				);
				contentArea.innerHTML = enhancedContent;
			}

			// Apply site-specific formatting if needed
			applyPostEnhancementFormatting(contentArea);

			// Create enhanced banner with word count comparison
			const banner = createEnhancedBanner(
				originalContent,
				enhancedContent,
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
					if (isShowingEnhanced) {
						// Switch to original
						contentArea.innerHTML = sanitizeHTML(originalContent);
						contentArea.setAttribute(
							"data-showing-enhanced",
							"false",
						);
						refreshToggleBanner({
							contentArea,
							createBanner: () =>
								createEnhancedBanner(
									originalContent,
									enhancedContent,
								),
							toggleLabel: "Show Enhanced",
							onToggleClick: toggleContent,
						});
					} else {
						// Switch to enhanced
						contentArea.innerHTML = sanitizeHTML(enhancedContent);
						contentArea.setAttribute(
							"data-showing-enhanced",
							"true",
						);

						// Reapply formatting
						applyPostEnhancementFormatting(contentArea);
						// Re-enable copy after innerHTML switch
						enableCopyOnContentArea(contentArea);
						refreshToggleBanner({
							contentArea,
							createBanner: () =>
								createEnhancedBanner(
									originalContent,
									enhancedContent,
								),
							toggleLabel: "Show Original",
							onToggleClick: toggleContent,
						});
					}
				};
				toggleButton.addEventListener("click", toggleContent);
			}

			// Remove any existing enhanced banner before inserting a new one
			const existingBanner = contentArea.querySelector(
				".gemini-enhanced-banner",
			);
			if (existingBanner) {
				existingBanner.remove();
			}

			// Add banner to the top of content area
			insertNodeAtContentTop(contentArea, banner);

			// Ensure text can be selected/copied from enhanced content
			enableCopyOnContentArea(contentArea);

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
	// eslint-disable-next-line no-unused-vars
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
		insertNodeAtContentTop(contentArea, errorBox);
	}

	// Remove the initial word count display (called after enhancement replaces content)
	function removeOriginalWordCount() {
		const existingWordCount = document.querySelector(".gemini-word-count");
		if (existingWordCount) {
			existingWordCount.remove();
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
	// eslint-disable-next-line no-unused-vars
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

		insertAfterControlsOrTop(contentArea, wordCountContainer);
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
	// eslint-disable-next-line no-unused-vars
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
			"This content has been enhanced by Gemini AI",
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
				"info",
			);
		});
		noticeContainer.appendChild(restoreButton);

		insertNodeAtContentTop(contentArea, noticeContainer);
	}

	function normalizeNotificationType(type) {
		if (notificationRuntimeModule?.normalizeNotificationTypeRuntime) {
			return notificationRuntimeModule.normalizeNotificationTypeRuntime(
				type,
			);
		}
		switch (type) {
			case "success":
				return "success";
			case "error":
				return "error";
			case "warning":
				return "warning";
			case "action":
			case "banner":
				return "banner";
			case "updating":
				return "info";
			default:
				return "info";
		}
	}

	function buildNovelDataFromMetadata(metadata) {
		if (notificationRuntimeModule?.buildNovelDataFromMetadataRuntime) {
			return notificationRuntimeModule.buildNovelDataFromMetadataRuntime(
				metadata,
			);
		}
		if (!metadata) return null;
		return {
			id: metadata.id,
			novelId: metadata.id,
			shelfId: metadata.shelfId,
			bookTitle: metadata.title,
			title: metadata.title,
			author: metadata.author,
			currentChapter: metadata.currentChapter,
			totalChapters: metadata.totalChapters,
			source: metadata.source,
			sourceUrl: metadata.sourceUrl,
			mainNovelUrl: metadata.mainNovelUrl,
		};
	}

	function cacheNovelData(novelData) {
		if (notificationRuntimeModule?.cacheNovelDataRuntime) {
			return notificationRuntimeModule.cacheNovelDataRuntime(novelData);
		}
		return novelData;
	}

	function getLastKnownNovelData() {
		return (
			notificationRuntimeModule?.getLastKnownNovelDataRuntime?.() || null
		);
	}

	async function resolveNovelDataForNotification() {
		if (notificationRuntimeModule?.resolveNovelDataForNotificationRuntime) {
			return notificationRuntimeModule.resolveNovelDataForNotificationRuntime();
		}
		return null;
	}

	async function logNotification({
		type,
		message,
		title,
		novelData,
		metadata,
		source,
	}) {
		if (notificationRuntimeModule?.logNotificationRuntime) {
			return notificationRuntimeModule.logNotificationRuntime({
				type,
				message,
				title,
				novelData,
				metadata,
				source,
			});
		}
		try {
			await browser.runtime.sendMessage({
				action: "logNotification",
				type: normalizeNotificationType(type),
				message,
				title: title || document.title,
				url: window.location.href,
				novelData:
					novelData || (await resolveNovelDataForNotification()),
				metadata,
				source: source || "content",
			});
		} catch (_error) {
			// Avoid breaking page flow if notification logging fails
		}
	}

	// Shows a status message on the page
	function showStatusMessage(
		message,
		type = "info",
		duration = 5000,
		options = {},
	) {
		const bgColor = type === "error" ? "#622020" : "#2c494f";
		const textColor = "#bab9a0";

		let host = document.getElementById("rg-status-host");
		let root = host && host.shadowRoot ? host.shadowRoot : null;

		if (!host) {
			host = document.createElement("div");
			host.id = "rg-status-host";
			host.style.cssText =
				"position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 2147483647; pointer-events: none;";
			try {
				root = host.attachShadow({ mode: "open" });
			} catch (_err) {
				root = host;
			}
			document.documentElement.appendChild(host);
		}

		const messageDiv = document.createElement("div");
		messageDiv.textContent = message;
		messageDiv.classList.add("extraction-message");
		messageDiv.style.cssText = `
    all: initial;
    display: block;
    background-color: ${bgColor};
    color: ${textColor};
    padding: 14px 18px;
    margin: 0;
    border-radius: 6px;
    font-weight: 700;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    font-size: 14px;
    text-align: center;
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    max-width: 80vw;
    border: 1px solid #ffffff21;
    pointer-events: none;
  `;

		if (root) {
			root.appendChild(messageDiv);
		} else {
			document.documentElement.appendChild(messageDiv);
		}

		logNotification({
			type,
			message,
			title: options.title,
			novelData: options.novelData,
			metadata: options.metadata,
			source: options.source || "content",
		});

		setTimeout(() => {
			if (messageDiv.parentNode) {
				messageDiv.parentNode.removeChild(messageDiv);
			}
		}, duration);
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
								libraryNovel.enhancedChaptersCount || 0,
						}
					: {
							genres: metadata.genres || [],
							tags: metadata.tags || [],
							status: metadata.status,
						}),
			};

			debugLog("📚 getNovelInfo: Returning novelInfo:", novelInfo);
			cacheNovelData(novelInfo);
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
			const { novelLibrary, READING_STATUS } = await import(libraryUrl);

			const inferredLastReadChapter = Number.isFinite(
				Number(metadata.currentChapter),
			)
				? Number(metadata.currentChapter)
				: 0;
			const inferredReadingStatus =
				inferredLastReadChapter > 0
					? READING_STATUS.READING
					: undefined;

			// Add/update novel in library
			const result = await novelLibrary.addOrUpdateNovel({
				title: metadata.title,
				author: metadata.author,
				coverUrl: metadata.coverUrl || metadata.coverImage,
				currentChapter: metadata.currentChapter,
				lastReadChapter: inferredLastReadChapter,
				lastReadUrl: window.location.href,
				readingStatus: inferredReadingStatus,
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

			const cachedNovel = cacheNovelData(result);
			logNotification({
				type: "success",
				message: "Novel saved to library",
				title: metadata.title,
				novelData: cachedNovel,
				metadata: {
					action: "library-save",
					source:
						metadata.source || currentHandler.getSiteIdentifier(),
				},
			});

			return { success: true, novel: result };
		} catch (error) {
			debugError("Error in handleAddToLibrary:", error);
			logNotification({
				type: "error",
				message: `Failed to save novel: ${error.message}`,
				metadata: {
					action: "library-save",
				},
			});
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
				10000,
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
			document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
				btn.textContent = "✨ Enhance with Gemini";
				btn.disabled = false;
				btn.classList.remove("loading");
			});

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
				`Processing cancelled. ${message.processedChunks} chunks completed, ${message.remainingChunks} remaining.`,
			);
			showStatusMessage(
				`Enhancement cancelled. ${message.processedChunks} of ${message.totalChunks} chunks were enhanced.`,
				"info",
			);

			if (domIntegrationModule?.clearTransientEnhancementBannersRuntime) {
				domIntegrationModule.clearTransientEnhancementBannersRuntime({
					documentRef: document,
				});
			} else {
				const wipBanner = document.querySelector(".gemini-wip-banner");
				if (wipBanner) {
					wipBanner.remove();
				}
			}
			if (cancelEnhanceButton) {
				cancelEnhanceButton.style.display = "none";
			}

			// Reset button state
			document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
				btn.textContent = "🔄 Continue Enhancement";
				btn.disabled = false;
				btn.classList.remove("loading");
			});

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

		if (
			message.action === "processWithGemini" ||
			message.action === "enhanceChapter"
		) {
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

		if (
			message.action === "summarizeWithGemini" ||
			message.action === "summarizeChapter"
		) {
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
						"utils/novel-library.js",
					);
					const { novelLibrary } = await import(libraryUrl);
					const result = await novelLibrary.updateNovel(
						message.novelId,
						{
							readingStatus: message.readingStatus,
						},
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
