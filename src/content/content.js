// Lightweight logger bootstrap for content scripts (no top-level imports allowed here)
let debugLog = console.log.bind(console);
let debugError = console.error.bind(console);
let debugWarn = console.warn.bind(console);
let importedLoggerDebugLog = null;
let importedLoggerDebugError = null;
let importedLoggerDebugWarn = null;
(async () => {
	try {
		if (typeof browser !== "undefined" && browser.runtime?.getURL) {
			const loggerUrl = browser.runtime.getURL("utils/logger.js");
			const mod = await import(loggerUrl);
			importedLoggerDebugLog =
				typeof mod.debugLog === "function" ? mod.debugLog : null;
			importedLoggerDebugError =
				typeof mod.debugError === "function" ? mod.debugError : null;
			importedLoggerDebugWarn =
				typeof mod.debugWarn === "function" ? mod.debugWarn : null;
		}
	} catch (_err) {
		// keep console fallbacks
	}
})();

/**
 * Debounce helper for UI re-injection callbacks.
 */
function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

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
// Reading typeface id, one of the ids in READING_FONTS. Left empty until the
// worker answers with the stored choice: an unknown id resolves to no font
// stack, which is exactly what "Site default" does, so there is no default
// constant to re-type here.
let currentReadingFont = "";
// Replaced by getReadingFontStack() once constants.js loads; until then every
// id maps to "site default", so the page is never styled with a guess.
let resolveReadingFontStack = () => "";
let siteSettings = null; // Per-site enable/disable settings
let siteSettingsModule = null; // Site settings helper module
let extensionBridgesModule = null; // Extension bridge helpers
let readAloudUiModule = null; // Read-aloud UI helper module
let enhancementBannersModule = null; // Enhancement banner helpers
let notificationRuntimeModule = null; // Status / notification helpers
let enhancementToggleBannerModule = null; // Enhancement banner refresh helpers
let enhancedContentBannerModule = null; // Enhanced content banner UI helpers
let enhancementDisplayModule = null; // Enhancement display helper runtime
let enhancementCancelModule = null; // Enhancement cancel runtime
let wipBannerModule = null; // Work-in-progress banner runtime
let enhancementAttributionModule = null; // Model attribution helper runtime
let mainSummaryBannerModule = null; // Main summary banner runtime
let allChunksProcessedModule = null; // All-chunks processed runtime
let finalizePrefixModule = null; // Finalize prefix enhanced content runtime
let aiRuntimeModule = null; // AI actions runtime (Enhance, Summarize)

async function loadAiRuntimeModule() {
	if (aiRuntimeModule) return aiRuntimeModule;
	try {
		const aiUrl = browser.runtime.getURL("content/modules/ai-runtime.js");
		aiRuntimeModule = await import(aiUrl);
		return aiRuntimeModule;
	} catch (error) {
		debugError("Error loading AI runtime module:", error);
		return null;
	}
}
let chunkErrorModule = null; // Chunk error handling runtime
let chunkProcessedModule = null; // Chunk processed handling runtime
let chunkEventsModule = null; // Chunk action handlers runtime
let popupLibraryRuntimeModule = null; // Popup/library actions runtime
let novelContextModule = null; // Novel Context orchestration module
let chunkControlRuntime = null; // Chunk control state/helpers
let uiElementsRuntimeModule = null; // UI elements (buttons, banners) runtime module
let messageRouterModule = null; // Message dispatch router

async function loadMessageRouterModule() {
	if (messageRouterModule) return messageRouterModule;
	try {
		const url = browser.runtime.getURL("content/modules/message-router.js");
		messageRouterModule = await import(url);
		return messageRouterModule;
	} catch (error) {
		debugError("Error loading message-router module:", error);
		return null;
	}
}
let lastChunkModelInfo = null; // Track last model info for chunked banners
const progressPromptState = new Map();
const PROGRESS_PROMPT_COOLDOWN_MS = 10 * 60 * 1000;
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

	// Incognito mode when active, automatic library add/update/progress are suppressed
	let incognitoMode = { enabled: false, expiresAt: null };

	function isIncognitoActive() {
		if (!incognitoMode.enabled) return false;
		if (incognitoMode.expiresAt && Date.now() >= incognitoMode.expiresAt) {
			// Timer has expired auto-disable and persist
			incognitoMode = { enabled: false, expiresAt: null };
			browser.storage.local
				.set({ rg_incognito_mode: incognitoMode })
				.catch(() => {});
			return false;
		}
		return true;
	}

	function applyReadAloudHiding(root = document) {
		loadReadAloudUiModule()
			.then((mod) => mod?.applyReadAloudHiding?.(root))
			.catch(() => {});
	}

	async function loadReadAloudUiSetting() {
		const mod = await loadReadAloudUiModule();
		if (mod?.loadReadAloudUiSetting) {
			return mod.loadReadAloudUiSetting();
		}
		return null;
	}

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
				if (typeof mod.getReadingFontStack === "function") {
					resolveReadingFontStack = mod.getReadingFontStack;
				}
				if (keepAliveHeartbeat) restartKeepAlive();
			}
		} catch (_err) {
			// leave defaults
		}
	})();

	let debugModeEnabled = true; // Default to true for debugging

	// Gate console logging based on stored debugMode so logs are hidden by default unless enabled via popup checkbox.
	const __rgConsoleLog = console.log.bind(console);
	const __rgConsoleError = console.error.bind(console);
	const __rgConsoleWarn = console.warn.bind(console);
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

	async function loadEnhancementDisplayModule() {
		if (enhancementDisplayModule) return enhancementDisplayModule;
		try {
			const displayUrl = browser.runtime.getURL(
				"content/modules/enhancement-display.js",
			);
			const displayModule = await import(displayUrl);
			if (!displayModule?.addWordCountDisplayRuntime) {
				return null;
			}
			enhancementDisplayModule = displayModule;
			return enhancementDisplayModule;
		} catch (error) {
			debugError("Error loading enhancement display module:", error);
			return null;
		}
	}

	async function loadEnhancementCancelModule() {
		if (enhancementCancelModule) return enhancementCancelModule;
		try {
			const cancelUrl = browser.runtime.getURL(
				"content/modules/enhancement-cancel.js",
			);
			const cancelModule = await import(cancelUrl);
			if (!cancelModule?.handleCancelEnhancementRuntime) {
				return null;
			}
			enhancementCancelModule = cancelModule;
			return enhancementCancelModule;
		} catch (error) {
			debugError("Error loading enhancement cancel module:", error);
			return null;
		}
	}

	async function loadWipBannerModule() {
		if (wipBannerModule) return wipBannerModule;
		try {
			const wipUrl = browser.runtime.getURL(
				"content/modules/wip-banner-runtime.js",
			);
			const wipModule = await import(wipUrl);
			if (!wipModule?.createWorkInProgressBannerRuntime) {
				return null;
			}
			wipBannerModule = wipModule;
			return wipBannerModule;
		} catch (error) {
			debugError("Error loading WIP banner module:", error);
			return null;
		}
	}

	async function loadEnhancementAttributionModule() {
		if (enhancementAttributionModule) return enhancementAttributionModule;
		try {
			const attributionUrl = browser.runtime.getURL(
				"content/modules/enhancement-attribution.js",
			);
			const attributionModule = await import(attributionUrl);
			if (!attributionModule?.addModelAttributionRuntime) {
				return null;
			}
			enhancementAttributionModule = attributionModule;
			return enhancementAttributionModule;
		} catch (error) {
			debugError("Error loading enhancement attribution module:", error);
			return null;
		}
	}

	async function loadMainSummaryBannerModule() {
		if (mainSummaryBannerModule) return mainSummaryBannerModule;
		try {
			const bannerUrl = browser.runtime.getURL(
				"content/modules/main-summary-banner.js",
			);
			const bannerModule = await import(bannerUrl);
			if (!bannerModule?.createMainSummaryBannerRuntime) {
				return null;
			}
			mainSummaryBannerModule = bannerModule;
			return mainSummaryBannerModule;
		} catch (error) {
			debugError("Error loading main summary banner module:", error);
			return null;
		}
	}

	async function loadAllChunksProcessedModule() {
		if (allChunksProcessedModule) return allChunksProcessedModule;
		try {
			const moduleUrl = browser.runtime.getURL(
				"content/modules/all-chunks-processed.js",
			);
			const moduleRef = await import(moduleUrl);
			if (!moduleRef?.handleAllChunksProcessedRuntime) {
				return null;
			}
			allChunksProcessedModule = moduleRef;
			return allChunksProcessedModule;
		} catch (error) {
			debugError("Error loading all-chunks-processed module:", error);
			return null;
		}
	}

	async function loadFinalizePrefixModule() {
		if (finalizePrefixModule) return finalizePrefixModule;
		try {
			const moduleUrl = browser.runtime.getURL(
				"content/modules/finalize-prefix.js",
			);
			const moduleRef = await import(moduleUrl);
			if (!moduleRef?.finalizePrefixEnhancedContentRuntime) {
				return null;
			}
			finalizePrefixModule = moduleRef;
			return finalizePrefixModule;
		} catch (error) {
			debugError("Error loading finalize-prefix module:", error);
			return null;
		}
	}

	async function loadChunkErrorModule() {
		if (chunkErrorModule) return chunkErrorModule;
		try {
			const moduleUrl = browser.runtime.getURL(
				"content/modules/chunk-error-runtime.js",
			);
			const moduleRef = await import(moduleUrl);
			if (!moduleRef?.handleChunkErrorRuntime) {
				return null;
			}
			chunkErrorModule = moduleRef;
			return chunkErrorModule;
		} catch (error) {
			debugError("Error loading chunk-error module:", error);
			return null;
		}
	}

	async function loadChunkProcessedModule() {
		if (chunkProcessedModule) return chunkProcessedModule;
		try {
			const moduleUrl = browser.runtime.getURL(
				"content/modules/chunk-processed-runtime.js",
			);
			const moduleRef = await import(moduleUrl);
			if (!moduleRef?.handleChunkProcessedRuntime) {
				return null;
			}
			chunkProcessedModule = moduleRef;
			return chunkProcessedModule;
		} catch (error) {
			debugError("Error loading chunk-processed module:", error);
			return null;
		}
	}

	async function loadChunkEventsModule() {
		if (chunkEventsModule) return chunkEventsModule;
		try {
			const eventsUrl = browser.runtime.getURL(
				"content/modules/chunk-events.js",
			);
			const eventsModule = await import(eventsUrl);
			if (!eventsModule?.toggleChunkViewRuntime) {
				return null;
			}
			chunkEventsModule = eventsModule;
			return chunkEventsModule;
		} catch (error) {
			debugError("Error loading chunk events module:", error);
			return null;
		}
	}

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

	// Local safe stringify + truncation fallback used until the full logger module
	// is available. Keeps console output bounded.
	function localSafeStringify(v) {
		try {
			if (v instanceof Error) return v.stack || v.message || String(v);
			if (typeof v === "object") return JSON.stringify(v);
			return String(v);
		} catch (e) {
			return "[unserializable]";
		}
	}

	function localFormatOutput(value, maxLength = 500) {
		const s = localSafeStringify(value);
		if (s.length > maxLength) {
			return (
				s.substring(0, maxLength) +
				`... [truncated, ${s.length - maxLength} more chars]`
			);
		}
		return s;
	}

	debugLog = (...args) => {
		if (!debugModeEnabled) return;
		if (typeof importedLoggerDebugLog === "function") {
			try {
				importedLoggerDebugLog(...args);
				return;
			} catch (e) {
				// fall through
			}
		}
		try {
			__rgConsoleLog(...args.map((a) => localFormatOutput(a, 500)));
		} catch (e) {
			__rgConsoleLog(...args);
		}
	};

	debugError = (...args) => {
		if (!debugModeEnabled) return;
		if (typeof importedLoggerDebugError === "function") {
			try {
				importedLoggerDebugError(...args);
				return;
			} catch (e) {
				// fall through
			}
		}
		try {
			__rgConsoleError(...args.map((a) => localFormatOutput(a, 500)));
		} catch (e) {
			__rgConsoleError(...args);
		}
	};

	debugWarn = (...args) => {
		if (!debugModeEnabled) return;
		if (typeof importedLoggerDebugWarn === "function") {
			try {
				importedLoggerDebugWarn(...args);
				return;
			} catch (e) {
				// fall through
			}
		}
		try {
			__rgConsoleWarn(...args.map((a) => localFormatOutput(a, 500)));
		} catch (e) {
			__rgConsoleWarn(...args);
		}
	};

	// Lightweight status overlay used by novel-context and other modules before
	// the full UI runtime loads.
	function showStatusOverlay(message, options = {}) {
		try {
			let overlay = document.getElementById("rg-status-overlay");
			if (!overlay) {
				overlay = document.createElement("div");
				overlay.id = "rg-status-overlay";
				overlay.style.cssText =
					"position:fixed;left:10px;bottom:10px;z-index:2147483647;" +
					"background:rgba(20,20,20,0.9);color:#fff;padding:10px 12px;" +
					"border-radius:6px;font-size:13px;max-width:40vw;" +
					"box-shadow:0 2px 8px rgba(0,0,0,0.4);";
				document.documentElement.appendChild(overlay);
			}
			overlay.textContent = message || "";
			if (options.autoHideMs) {
				setTimeout(() => overlay.remove(), options.autoHideMs);
			}
			return overlay;
		} catch (e) {
			// swallow
		}
	}

	function hideStatusOverlay() {
		try {
			const overlay = document.getElementById("rg-status-overlay");
			if (overlay) overlay.remove();
		} catch (e) {
			/* swallow */
		}
	}

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

		let paragraphs;

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
		if (enhancementCancelModule?.handleCancelEnhancementRuntime) {
			enhancementCancelModule.handleCancelEnhancementRuntime({
				documentRef: document,
				windowRef: window,
				debugLog,
				debugError,
				sendMessageWithRetry,
				showStatusMessage,
				cancelEnhanceButton,
				setEnhancementCancelRequested: (value) => {
					enhancementCancelRequested = value;
				},
				showWorkInProgressBanner,
			});
			return;
		}

		// Safety fallback when cancel runtime is unavailable.
		enhancementCancelRequested = true;
		showStatusMessage(
			"Cancelling enhancement... processed chunks will be kept.",
			"info",
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

	const RG_VISIBILITY_KEY = "rg_ui_visibility";

	async function saveVisibilityState(isHidden) {
		try {
			const hostname = window.location.hostname;
			const stored = await browser.storage.local.get(RG_VISIBILITY_KEY);
			const map = stored[RG_VISIBILITY_KEY] || {};
			map[hostname] = isHidden;
			await browser.storage.local.set({ [RG_VISIBILITY_KEY]: map });
		} catch (_e) {
			/* non-critical */
		}
	}

	async function restoreVisibilityState() {
		try {
			const hostname = window.location.hostname;
			const stored = await browser.storage.local.get(RG_VISIBILITY_KEY);
			const map = stored[RG_VISIBILITY_KEY] || {};
			if (hostname in map) {
				const mod = await loadEnhancementBannersModule();
				mod?.applyStoredVisibilityRuntime?.({
					shouldBeHidden: map[hostname],
					documentRef: document,
					currentHandler,
				});
			}
		} catch (_e) {
			/* non-critical */
		}
	}

	async function handleToggleBannersVisibility(callerBtn = null) {
		const mod = await loadEnhancementBannersModule();
		mod?.toggleEnhancedBannersRuntime?.({
			documentRef: document,
			currentHandler,
			showStatusMessage,
			callerBtn,
			onVisibilityChange: (isHidden) => saveVisibilityState(isHidden),
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

		// No initializers: the catch below returns, so nothing reaches the reads
		// past it without having been assigned inside the try.
		let chunks;
		let chunkSummaryCount;
		let chunkSizeWords;

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
		if (!chunkEventsModule?.toggleChunkViewRuntime) return;
		await chunkEventsModule.toggleChunkViewRuntime({
			chunkIndex,
			documentRef: document,
			applyCollapsibleSections,
			findContentArea,
			enableCopyOnContentArea,
			escapeHtml,
		});
	}

	async function handleChunkDelete(chunkIndex) {
		if (!chunkEventsModule?.deleteChunkEnhancementRuntime) return;
		await chunkEventsModule.deleteChunkEnhancementRuntime({
			chunkIndex,
			windowRef: window,
			documentRef: document,
			loadChunkingSystem,
			showStatusMessage,
			escapeHtml,
			buildChunkBanner,
			chunkBehaviorConfig,
			onEnhance: () => handleReenhanceChunk(chunkIndex),
			cacheUrl: getCacheUrl(),
		});
	}

	// ── Skip / Pause helpers ────────────────────────────────────────────────────

	function handleSkipChunk(chunkIndex) {
		chunkEventsModule?.handleSkipChunkRuntime?.({
			chunkIndex,
			chunkControlRuntime,
			debugLog,
		});
	}

	function handlePauseChunk(chunkIndex) {
		chunkEventsModule?.handlePauseChunkRuntime?.({
			chunkIndex,
			chunkControlRuntime,
			debugLog,
		});
	}

	async function handleShowEnhancedChunk(chunkIndex) {
		if (!chunkEventsModule?.handleShowEnhancedChunkRuntime) return;
		await chunkEventsModule.handleShowEnhancedChunkRuntime({
			chunkIndex,
			loadChunkingSystem,
			showStatusMessage,
			applyCollapsibleSections,
			chunkControlRuntime,
			buildChunkBanner,
			chunkBehaviorConfig,
			findContentArea,
			enableCopyOnContentArea,
			cancelEnhanceButton,
			documentRef: document,
			browserRef: browser,
		});
	}

	async function handleDiscardPausedChunk(chunkIndex) {
		if (!chunkEventsModule?.handleDiscardPausedChunkRuntime) return;
		await chunkEventsModule.handleDiscardPausedChunkRuntime({
			chunkIndex,
			loadChunkingSystem,
			buildChunkBanner,
			chunkBehaviorConfig,
			chunkControlRuntime,
			showStatusMessage,
			handleReenhanceChunk,
			documentRef: document,
		});
	}

	// ───────────────────────────────────────────────────────────────────────────

	async function handleReenhanceChunk(chunkIndex) {
		let eventsRuntime = chunkEventsModule;
		if (!eventsRuntime?.handleReenhanceChunkRuntime) {
			eventsRuntime = await loadChunkEventsModule();
		}

		if (!eventsRuntime?.handleReenhanceChunkRuntime) {
			showStatusMessage(
				"Chunk enhancement runtime unavailable. Please reload and try again.",
				"error",
			);
			return;
		}

		await eventsRuntime.handleReenhanceChunkRuntime({
			chunkIndex,
			loadChunkingSystem,
			debugLog,
			debugError,
			showStatusMessage,
			buildChunkBanner,
			showWorkInProgressBanner,
			wakeUpBackgroundWorker,
			sendMessageWithRetry,
			browserRef: browser,
			documentRef: document,
			windowRef: window,
			stripHtmlTags,
			buildCombinedPrompt,
			chunkBehaviorConfig,
			chunkControlRuntime,
			loadDomIntegrationModule,
			shouldBannersBeHidden,
			handleToggleAllChunks,
			handleDeleteAllChunks,
			extractNovelContext,
			addToNovelLibrary,
			findContentArea,
			enableCopyOnContentArea,
			sanitizeHTML,
			applyCollapsibleSections,
			cancelEnhanceButton,
			confirmFn: confirm,
			getFormattingOptions: () => formattingOptions,
			setFormattingOptions: (next) => {
				formattingOptions = next;
			},
			getLastChunkModelInfo: () => lastChunkModelInfo,
			setLastChunkModelInfo: (value) => {
				lastChunkModelInfo = value;
			},
			setHasCachedContent: (value) => {
				hasCachedContent = value;
			},
		});
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
	// 		`Chunks ${startIndex + 1}-${endIndex + 1} enhanced successfully`,
	// 		"success",
	// 		3000,
	// 	);
	// }

	async function handleChunkProcessed(message) {
		if (!chunkProcessedModule?.handleChunkProcessedRuntime) {
			return;
		}

		await chunkProcessedModule.handleChunkProcessedRuntime({
			message,
			loadChunkingSystem,
			findContentArea,
			browserRef: browser,
			chunkBehaviorConfig,
			onChunkModelInfo: (modelInfo) => {
				lastChunkModelInfo = modelInfo;
			},
			getLastChunkModelInfo: () => lastChunkModelInfo,
			sanitizeHTML,
			windowRef: window,
			buildChunkBanner,
			showWorkInProgressBanner,
			cancelEnhanceButton,
			loadDomIntegrationModule,
			shouldBannersBeHidden,
			handleToggleAllChunks,
			handleDeleteAllChunks,
			confirmFn: confirm,
			extractNovelContext,
			addToNovelLibrary,
			debugLog,
			debugError,
			enableCopyOnContentArea,
			documentRef: document,
			cacheUrl: getCacheUrl(),
			// For TTS-safe handlers (e.g. NovelArrow): delegate paragraph injection to
			// the handler's own applyEnhancedContent so its HTML-parsing and gemini-element
			// filtering logic is used (avoids the broken \n{2,} split on AI HTML output).
			applyEnhancedChunkContent:
				currentHandler?.supportsTextOnlyEnhancement?.()
					? (chunkContentEl, enhancedHtml) => {
							if (
								typeof currentHandler?.applyEnhancedContent ===
								"function"
							) {
								const count =
									currentHandler.applyEnhancedContent(
										chunkContentEl,
										enhancedHtml,
									);
								debugLog(
									`[TTS-safe chunk] Handler applied ${count} paragraphs`,
								);
							}
						}
					: null,
		});
	}

	async function handleChunkError(message) {
		if (!chunkErrorModule?.handleChunkErrorRuntime) {
			return;
		}

		await chunkErrorModule.handleChunkErrorRuntime({
			message,
			loadChunkingSystem,
			buildChunkBanner,
			showStatusMessage,
			debugLog,
			documentRef: document,
		});
	}

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
		if (summaryRuntimeModule?.summarizeChunkRangeRuntime) {
			return summaryRuntimeModule.summarizeChunkRangeRuntime({
				chunkIndices,
				isShort,
				groupStartIndex,
				loadSummaryService,
				wakeUpBackgroundWorker,
				sendMessageWithRetry,
				browserRef: browser,
				documentRef: document,
				windowRef: window,
				debugLog,
				debugError,
				showStatusMessage,
				findContentArea,
				extractContent,
				stripHtmlTags,
				getLastKnownNovelData,
				loadNovelLibrary,
			});
		}

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
		const summaryContainerClass = isShort
			? ".gemini-short-summary-text-container"
			: ".gemini-summary-text-container";
		const mainSummaryClass = isShort
			? ".gemini-main-short-summary-text"
			: ".gemini-main-summary-text";

		if (isMainSummary) {
			summaryTextContainer =
				document.querySelector(mainSummaryClass) ||
				document.querySelector(
					`${summaryContainerClass}[data-group-start='0']`,
				);
		} else {
			// Find container within the correct per-chunk group
			summaryTextContainer = document.querySelector(
				`${summaryContainerClass}[data-group-start="${groupStartIndex}"]`,
			);
		}

		// For short summaries, render into the body child div (keeps the "Quick Summary" label intact)
		const summaryRenderTarget = isShort
			? summaryTextContainer?.querySelector(
					".gemini-short-summary-body",
				) || summaryTextContainer
			: summaryTextContainer;

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
				summaryRenderTarget.textContent = `Generating ${summaryType.toLowerCase()} summary…`;
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
					summaryRenderTarget.textContent = msg;
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
			const _cachedNovelDataForSummary = getLastKnownNovelData();
			const response = await sendMessageWithRetry({
				action,
				title: document.title,
				content: contentText,
				novelId: _cachedNovelDataForSummary?.id || null,
				chapterNum: _cachedNovelDataForSummary?.currentChapter || null,
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
				summaryRenderTarget,
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
				summaryRenderTarget.textContent = `Failed to generate summary: ${error.message}`;
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
		if (!wipBannerModule?.createWorkInProgressBannerRuntime) {
			return null;
		}

		return wipBannerModule.createWorkInProgressBannerRuntime({
			completedChunks,
			totalChunks,
			state,
			wordCounts,
			documentRef: document,
			handleCancelEnhancement,
			handleToggleAllChunks,
		});
	}

	function showWorkInProgressBanner(
		completedChunks,
		totalChunks,
		state = "processing",
		wordCounts = null,
	) {
		if (!wipBannerModule?.showWorkInProgressBannerRuntime) {
			return;
		}

		void wipBannerModule.showWorkInProgressBannerRuntime({
			completedChunks,
			totalChunks,
			state,
			wordCounts,
			documentRef: document,
			findContentArea,
			loadDomIntegrationModule,
			createWorkInProgressBanner,
		});
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
			cacheUrl: getCacheUrl(),
		});
	}

	// Handler for all chunks processed notification
	function handleAllChunksProcessed(message) {
		if (!allChunksProcessedModule?.handleAllChunksProcessedRuntime) {
			return;
		}

		allChunksProcessedModule.handleAllChunksProcessedRuntime({
			message,
			debugLog,
			showWorkInProgressBanner,
			showStatusMessage,
			cancelEnhanceButton,
			documentRef: document,
		});
	}

	// Helper function to finalize the progressive content display
	// eslint-disable-next-line no-unused-vars
	async function finalizePrefixEnhancedContent(modelInfo) {
		if (!finalizePrefixModule?.finalizePrefixEnhancedContentRuntime) {
			return;
		}

		await finalizePrefixModule.finalizePrefixEnhancedContentRuntime({
			modelInfo,
			findContentArea,
			stripHtmlTags,
			storageManager,
			windowRef: window,
			documentRef: document,
			debugLog,
			debugError,
			extractNovelContext,
			addToNovelLibrary,
			updateChapterProgression,
			createEnhancedBanner,
			attachDeleteCacheButtonHandler,
			showStatusMessage,
			refreshToggleBanner,
			domIntegrationModule,
			getIsCachedContent: () => isCachedContent,
			onCachedContentSaved: () => {
				isCachedContent = true;
			},
		});
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
			// The fields declared in a handler's SETTINGS_DEFINITION are saved by
			// the Library settings page into the per-site settings store, keyed by
			// shelf id — not into the handler's getProposedLibrarySettings()
			// schema, which is a separate, metadata-only list. Read the store the
			// UI actually writes to; anything else silently reads nothing.
			const handlerSettings =
				(siteSettings && siteSettings[handlerShelfId]) ||
				(siteSettingsModule?.getSiteSettings
					? (await siteSettingsModule.getSiteSettings())[
							handlerShelfId
						]
					: null) ||
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

			// Load per-handler font size. The Ranobes handler names its field
			// `chapterFontSize`; both mean the same thing here.
			const rawFontSize =
				handlerSettings.fontSize ?? handlerSettings.chapterFontSize;
			if (rawFontSize !== undefined) {
				const handlerFontSize = parseInt(rawFontSize, 10);
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

			// Load per-handler reading font. An id this build does not know
			// resolves to the site default rather than to a broken stack, so a
			// setting saved by a newer version degrades quietly.
			if (handlerSettings.readingFont) {
				currentReadingFont = handlerSettings.readingFont;
				debugLog(
					`Using handler-specific reading font: ${currentReadingFont}`,
				);
			}
		} catch (error) {
			// Silently fail for CSS injection - not critical
			debugLog(
				`Could not load custom CSS for ${handlerShelfId}: ${error.message}`,
			);
		}
	}

	async function loadUIElementsRuntimeModule() {
		try {
			const url = browser.runtime.getURL(
				"content/modules/ui-elements-runtime.js",
			);
			return await import(url);
		} catch (err) {
			debugError("Failed to load ui-elements-runtime module", err);
			return null;
		}
	}

	function getUIElementsRuntime() {
		if (uiElementsRuntimeModule?.createUIElementsRuntime) {
			return uiElementsRuntimeModule.createUIElementsRuntime({
				documentRef: document,
				windowRef: window,
				browserRef: browser,
				isMobileDevice,
				protectFromThemeExtensions,
				currentHandler,
				getNovelLibrary: async () => {
					if (!novelLibrary) await loadNovelLibrary();
					return novelLibrary;
				},
				debugLog,
				debugError,
				handlers: {
					onToggleBanners: handleToggleBannersVisibility,
					onCancelEnhance: handleCancelEnhancement,
					onEnhance: handleEnhanceClick,
				},
			});
		}
		return null;
	}

	async function showRereadingBanner(params) {
		if (uiElementsRuntimeModule?.showRereadingBannerRuntime) {
			return uiElementsRuntimeModule.showRereadingBannerRuntime({
				...params,
				documentRef: document,
				windowRef: window,
				progressPromptState,
				shouldShowProgressPrompt,
				onJumpToChapter: (url) => {
					window.location.href = url;
				},
				onStartRereading: async (id) => {
					await novelLibrary.setRereadingFlag(id, true);
					showTimedBanner(
						"Re-reading started. Progress updates enabled.",
						"success",
						bannerConfig.quickMs,
					);
				},
			});
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

	// LoreWeave auto-graphify. Loaded on demand after an enhancement lands; the
	// module itself checks the experimental gate and the auto-graphify flag, so
	// with LoreWeave off this import is the only cost and nothing is sent.
	let loreWeaveModule = null;

	async function notifyLoreWeave(chapterText) {
		try {
			if (!loreWeaveModule) {
				loreWeaveModule = await import(
					browser.runtime.getURL(
						"content/modules/loreweave-integration.js",
					)
				);
			}
			const context = extractNovelContext();
			await loreWeaveModule.maybeSendToLoreWeave(chapterText, {
				chapter: context?.chapterNumber,
			});
		} catch (error) {
			// Never let an optional integration disrupt reading.
			debugError("LoreWeave notification failed:", error);
		}
	}

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

	async function loadPopupLibraryRuntimeModule() {
		if (popupLibraryRuntimeModule) return popupLibraryRuntimeModule;
		try {
			const runtimeUrl = browser.runtime.getURL(
				"content/modules/popup-library-runtime.js",
			);
			popupLibraryRuntimeModule = await import(runtimeUrl);
			return popupLibraryRuntimeModule;
		} catch (error) {
			debugError("Error loading popup-library runtime module:", error);
			return null;
		}
	}

	let novelContextHandlerName = null;
	async function loadNovelContextModule() {
		const handlerName = currentHandler?.constructor?.name || null;
		if (novelContextModule && novelContextHandlerName === handlerName) {
			return novelContextModule;
		}
		try {
			const modUrl = browser.runtime.getURL(
				"content/modules/novel-context.js",
			);
			const mod = await import(modUrl);
			novelContextModule = mod.initNovelContextModule({
				windowRef: window,
				documentRef: document,
				browserRef: browser,
				currentHandler,
				novelLibrary,
				storageManager,
				siteSettingsModule,
				siteSettings,
				bannerConfig,
				debugLog,
				debugError,
				debugWarn,
				showTimedBanner,
				showStatusMessage,
				showStatusOverlay,
				hideStatusOverlay,
				isIncognitoActive,
				getHandlerType,
				HANDLER_TYPES,
				READING_STATUS,
				buildNovelDataFromMetadata,
				cacheNovelData,
				deriveReadingStatusFromProgress:
					uiElementsRuntimeModule?.deriveReadingStatusFromProgressRuntime ??
					(() => null),
				loadNovelLibrary,
				protectFromThemeExtensions,
			});
			novelContextHandlerName = handlerName;
			debugLog("✅ novelContextModule loaded");
			return novelContextModule;
		} catch (err) {
			debugError("❌ Failed to load novelContextModule:", err);
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
			await loadNovelContextModule();
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
		if (novelContextModule?.extractNovelContext) {
			return novelContextModule.extractNovelContext();
		}
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

	async function restoreChunkedContentFromCache(chunking, chunks, metadata) {
		const chunkBatchModule = await loadChunkBatchModule();
		if (!chunkBatchModule?.restoreChunkedContentFromCacheRuntime) {
			return false;
		}

		return chunkBatchModule.restoreChunkedContentFromCacheRuntime({
			chunking,
			chunks,
			metadata,
			findContentArea,
			browserRef: browser,
			chunkBehaviorConfig,
			stripHtmlTags,
			sanitizeHTML,
			buildChunkBanner,
			summarizeChunkRange,
			shouldBannersBeHidden,
			handleToggleAllChunks,
			handleDeleteAllChunks,
			loadDomIntegrationModule,
			documentRef: document,
			windowRef: window,
			confirmFn: confirm,
			onSetLastChunkModelInfo: (info) => {
				lastChunkModelInfo = info;
			},
			onSetCachedFlags: () => {
				isCachedContent = true;
				hasCachedContent = true;
			},
			enableCopyOnContentArea,
			showStatusMessage,
			debugLog,
			applyEnhancedChunkContent:
				currentHandler?.supportsTextOnlyEnhancement?.()
					? (chunkContentEl, enhancedHtml) => {
							if (
								typeof currentHandler?.applyEnhancedContent ===
								"function"
							) {
								const count =
									currentHandler.applyEnhancedContent(
										chunkContentEl,
										enhancedHtml,
									);
								debugLog(
									`[TTS-safe cache restore] Handler applied ${count} paragraphs`,
								);
							}
						}
					: null,
		});
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

		// Use canonical URL so cache saved on novelarrow.com is found on novelbin.com
		// and vice-versa (getCanonicalCacheUrl normalises both to novelbin.com/b/…).
		const url = getCacheUrl();
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
		// Try explicit content selectors first before falling back to paragraph clustering.
		const contentSelectors = [
			"#arrticle", // Ranobes.net
			".text-chapter",
			"#storytext", // fanfiction.net
			".chapter-content",
			".novel-content",
			".chapter-inner",
			"article",
			".article",
			".story-content",
			".entry-content",
			"#content",
			".main-content",
			".post-content",
			".story",
		];

		for (const selector of contentSelectors) {
			const element = document.querySelector(selector);
			if (element && (element.innerText || "").trim().length > 300) {
				return {
					found: true,
					title: document.title || "Unknown Title",
					text: element.innerText.trim(),
					selector: `generic selector: ${selector}`,
				};
			}
		}

		// Paragraph-cluster fallback: group <p> tags by nearest ancestor to avoid
		// pulling in sidebar/footer content.
		const paragraphs = Array.from(document.querySelectorAll("p"));
		if (paragraphs.length > 5) {
			const groups = new Map();
			for (const p of paragraphs) {
				const text = (p.innerText || "").trim();
				if (!text) continue;
				let ancestor = p.parentElement;
				let depth = 0;
				while (ancestor && ancestor !== document.body && depth < 3) {
					if (
						ancestor.id ||
						(ancestor.classList && ancestor.classList.length > 0)
					) {
						break;
					}
					ancestor = ancestor.parentElement;
					depth++;
				}
				if (!ancestor) ancestor = p.parentElement;
				const stats = groups.get(ancestor) || { length: 0, count: 0 };
				stats.length += text.length;
				stats.count += 1;
				groups.set(ancestor, stats);
			}

			let bestEl = null;
			let bestLen = 0;
			for (const [el, stats] of groups.entries()) {
				if (
					el !== document.body &&
					el !== document.documentElement &&
					stats.count >= 3 &&
					stats.length > bestLen
				) {
					bestEl = el;
					bestLen = stats.length;
				}
			}

			if (bestEl && bestLen > 300) {
				const chapterText = Array.from(bestEl.querySelectorAll("p"))
					.map((p) => p.innerText.trim())
					.filter(Boolean)
					.join("\n\n");
				return {
					found: chapterText.length > 200,
					title: document.title || "Unknown Title",
					text: chapterText,
					selector: "generic paragraph-cluster extractor",
				};
			}
		}

		return {
			found: false,
			title: "",
			text: "",
			selector: "",
		};
	}

	/**
	 * Intercepts pushState/replaceState/popstate to detect in-page chapter
	 * navigation (e.g. NovelBin's AJAX chapter loading) and re-init the UI.
	 * Called once at the end of initialize().
	 */
	function setupNavigationObserver() {
		let lastUrl = window.location.href;
		let debounceTimer = null;

		function onNavigationChange() {
			const newUrl = window.location.href;
			if (newUrl === lastUrl) return;

			// Ignore hash-only changes — skip links like <a href="#main-content"> fire
			// hashchange but don't navigate to a new page, and re-initing on them breaks
			// the SPA by tearing down enhancement state mid-read.
			try {
				const oldU = new URL(lastUrl);
				const newU = new URL(newUrl);
				if (
					oldU.pathname + oldU.search ===
					newU.pathname + newU.search
				) {
					lastUrl = newUrl;
					return;
				}
			} catch {
				/* ignore malformed URLs */
			}

			lastUrl = newUrl;

			// Snapshot old content before the debounce so waitForChapterContent
			// can detect when the SPA has actually swapped in new chapter text.
			// Use the handler's own findContentArea() so every site gets the right element.
			const _snapEl =
				(typeof currentHandler?.findContentArea === "function"
					? currentHandler.findContentArea()
					: null) ??
				document.querySelector(
					"#chr-content, .chr-c, article[data-chapter-id]",
				);
			// Prefer data-chapter-id (NovelArrow) — changes the instant React swaps
			// the chapter. Fall back to a text slice for other SPA sites.
			const oldContentFingerprint = _snapEl
				? _snapEl.getAttribute?.("data-chapter-id") ||
					_snapEl.textContent.trim().slice(0, 300)
				: "";

			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(async () => {
				if (!currentHandler) return;

				if (typeof currentHandler.refreshForCurrentUrl === "function") {
					currentHandler.refreshForCurrentUrl();
				}

				if (!currentHandler.isChapterPage()) return;

				debugLog(
					"[NavObserver] Chapter URL changed, re-initialising UI for:",
					newUrl,
				);

				// For SPA-heavy sites (e.g. NovelBin), wait for chapter content
				// to load asynchronously before clearing UI and re-injecting.
				if (
					typeof currentHandler.waitForChapterContent === "function"
				) {
					const found = await currentHandler.waitForChapterContent(
						6000,
						oldContentFingerprint,
					);
					if (!found) {
						debugLog(
							"[NavObserver] Timed out waiting for chapter content on SPA navigation.",
						);
						return;
					}
				}

				const oldControls = document.getElementById("gemini-controls");
				if (oldControls) oldControls.remove();
				const oldChapterControls = document.getElementById(
					"rg-chapter-novel-controls",
				);
				if (oldChapterControls) oldChapterControls.remove();

				if (typeof clearCachedEnhancementState === "function") {
					clearCachedEnhancementState();
				}

				// Reset injection flag so injectUI() can re-run for the new chapter.
				hasExtractButton = false;

				// Restore cached enhancement for the new chapter if available.
				const spaChunkRestored = await tryRestoreChunkedCache();
				if (!spaChunkRestored) {
					const cachedData = await checkCachedContent();
					if (cachedData?.enhancedContent) {
						const spaCa = findContentArea();
						if (spaCa)
							await replaceContentWithEnhancedVersion(cachedData);
					}
				}

				// Re-inject Enhance/Summary controls for the new chapter.
				await injectUI();

				await autoExtractContent();
			}, 400);
		}

		const origPush = history.pushState.bind(history);
		history.pushState = function (...args) {
			origPush(...args);
			onNavigationChange();
		};
		const origReplace = history.replaceState.bind(history);
		history.replaceState = function (...args) {
			origReplace(...args);
			onNavigationChange();
		};

		window.addEventListener("popstate", onNavigationChange);
		window.addEventListener("hashchange", onNavigationChange);
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
		enhancementDisplayModule = await loadEnhancementDisplayModule();
		enhancementCancelModule = await loadEnhancementCancelModule();
		wipBannerModule = await loadWipBannerModule();
		enhancementAttributionModule = await loadEnhancementAttributionModule();
		mainSummaryBannerModule = await loadMainSummaryBannerModule();
		allChunksProcessedModule = await loadAllChunksProcessedModule();
		finalizePrefixModule = await loadFinalizePrefixModule();
		chunkErrorModule = await loadChunkErrorModule();
		chunkProcessedModule = await loadChunkProcessedModule();
		chunkEventsModule = await loadChunkEventsModule();
		uiElementsRuntimeModule = await loadUIElementsRuntimeModule();

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
			if (modelInfo && modelInfo.readingFont) {
				currentReadingFont = modelInfo.readingFont;
				debugLog(`Reading font setting loaded: ${currentReadingFont}`);
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
			// Ensure the novel context module is loaded so autoUpdateNovelOnVisit
			// (and the auto-add-to-library flow) actually runs on every page visit.
			if (!novelContextModule) {
				await loadNovelLibrary();
				await loadNovelContextModule();
			}
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
		// instead of enhance/summarize buttons — but skip entirely if the user has
		// previously hidden the extension on this hostname (no DOM injection at all).
		if (
			!hasExtractButton &&
			isNovelPage &&
			handlerType === HANDLER_TYPES.DEDICATED_PAGE
		) {
			let uiHiddenForHost = false;
			try {
				const stored =
					await browser.storage.local.get(RG_VISIBILITY_KEY);
				const map = stored[RG_VISIBILITY_KEY] || {};
				uiHiddenForHost = map[window.location.hostname] === true;
			} catch {
				/* non-critical, default to inject */
			}
			if (!uiHiddenForHost) {
				injectNovelPageUI();
			}
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

		setupNavigationObserver();
		debugLog("[NavObserver] Navigation observer registered");
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
		if (notificationRuntimeModule?.showTimedBannerRuntime) {
			return notificationRuntimeModule.showTimedBannerRuntime({
				message,
				type,
				duration,
				options,
				documentRef: document,
				windowRef: window,
				bannerConfig,
				protectFromThemeExtensions,
				onLogNotification: logNotification,
			});
		}

		const normalizedType = type === "updating" ? "info" : type;
		const fallbackDuration =
			duration === null ? bannerConfig.defaultMs : duration;
		showStatusMessage(message, normalizedType, fallbackDuration, options);
		return null;
	}

	/**
	 * Update the banner to show which field is being updated
	 * @param {string} field - Field name being updated
	 */
	// eslint-disable-next-line no-unused-vars
	function updateBannerField(field) {
		if (notificationRuntimeModule?.updateBannerFieldRuntime) {
			notificationRuntimeModule.updateBannerFieldRuntime({
				field,
				documentRef: document,
			});
			return;
		}

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

	async function autoUpdateNovelOnVisit() {
		if (novelContextModule?.autoUpdateNovelOnVisit) {
			return novelContextModule.autoUpdateNovelOnVisit();
		}
	}

	/**
	 * Manually check and update novel with change detection and display
	 */
	async function manuallyCheckAndUpdateNovel(existingNovel, currentMetadata) {
		if (novelContextModule?.manuallyCheckAndUpdateNovel) {
			return novelContextModule.manuallyCheckAndUpdateNovel(
				existingNovel,
				currentMetadata,
			);
		}
	}

	/**
	 * Get novel ID from current page using handler
	 * @returns {string|null}
	 */

	function getNovelIdFromCurrentPage() {
		if (novelContextModule?.getNovelIdFromCurrentPage) {
			return novelContextModule.getNovelIdFromCurrentPage();
		}
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
		const runtime = getUIElementsRuntime();
		if (runtime) {
			return runtime.injectNovelPageUI({
				getNovelIdFromCurrentPage,
				getReadingStatusOptions,
				handleNovelAddUpdate,
				manuallyCheckAndUpdateNovel,
				showTimedBanner,
			});
		}
	}

	/**
	 * Handle add/update button click on novel page
	 */

	async function handleNovelAddUpdate() {
		if (novelContextModule?.handleNovelAddUpdate) {
			return novelContextModule.handleNovelAddUpdate();
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

	// Function to inject UI elements (buttons, status area)
	async function injectUI() {
		const runtime = getUIElementsRuntime();
		if (!runtime) return;

		const contentArea = findContentArea();
		if (!contentArea) return;

		const ui = await runtime.injectUI({
			isMobileDevice,
			getHandlerType,
			HANDLER_TYPES,
			loadChunkingSystem,
			initializeChunkedViewForSummaries,
			summarizeChunkRange,
			handleEnhanceClick,
			findContentArea,
		});

		if (!ui) return;

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
				controlsContainer: ui.controlsContainer,
				mainSummaryGroup: ui.mainSummaryGroup,
				siteEnhancementsContainer: ui.siteEnhancementsContainer,
				versionSwitcherContainer: ui.versionSwitcherContainer,
			});
		} else if (insertionPoint?.parentNode) {
			insertionPoint.parentNode.insertBefore(
				ui.controlsContainer,
				insertionPoint,
			);
			if (ui.mainSummaryGroup) {
				insertionPoint.parentNode.insertBefore(
					ui.mainSummaryGroup,
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
				'<span style="font-size: 20px;">👁</span> <span style="font-weight: 600;">Show Ranobe Gemini</span>';
		} else if (toggleBtn) {
			toggleBtn.innerHTML =
				'<span style="font-size: 20px;">👁</span> <span style="font-weight: 600;">Hide Ranobe Gemini</span>';
		}

		// Restore the per-hostname hide/show preference saved from a previous visit.
		restoreVisibilityState();

		// Add novel controls (library management bar) for chapter pages,
		// unless the handler has opted out via getNovelControlsConfig().showControls === false.
		setTimeout(async () => {
			try {
				const runtime = getUIElementsRuntime();
				if (!runtime) return;

				const controlsConfig =
					currentHandler?.getNovelControlsConfig?.() || {};
				if (controlsConfig.showControls === false) return;

				const novelControls =
					await runtime.createChapterPageNovelControls({
						controlsConfig,
						HANDLER_TYPES,
						getHandlerType,
						getNovelIdFromCurrentPage,
						getReadingStatusOptions,
						showTimedBanner: (msg, type, duration) =>
							showStatusMessage(msg, type, duration),
						isIncognitoActive: () =>
							incognitoMode?.enabled === true,
						handleChapterControlsToggleBanners:
							handleToggleBannersVisibility,
						manuallyCheckAndUpdateNovel:
							manuallyCheckAndUpdateNovel,
						handleNovelAddUpdate: handleNovelAddUpdate,
					});

				if (novelControls) {
					runtime.placeChapterNovelControls(
						novelControls,
						controlsConfig,
					);
					debugLog(
						"Ranobe Gemini: Novel controls added for chapter page",
					);
				}
			} catch (err) {
				debugLog("Could not add novel controls:", err);
			}
		}, 100);

		// Keep controls alive in case the site re-renders or strips injected nodes
		setupUIObserver();
	}

	let uiObserver = null;
	function setupUIObserver() {
		if (uiObserver) return;

		const checkAndReinject = debounce(async () => {
			if (!currentHandler) return;

			const isChapter = currentHandler.isChapterPage?.();
			const isNovel = currentHandler.isNovelPage?.();

			if (!document.getElementById("gemini-controls")) {
				if (isChapter) {
					debugWarn(
						"Ranobe Gemini: Main UI missing, re-injecting...",
					);
					await injectUI();
					return;
				} else if (
					isNovel &&
					getHandlerType() === HANDLER_TYPES.DEDICATED_PAGE
				) {
					debugWarn(
						"Ranobe Gemini: Novel Page UI missing, re-injecting...",
					);
					await injectNovelPageUI();
				}
			}

			if (
				isChapter &&
				!document.getElementById("rg-chapter-novel-controls")
			) {
				try {
					const runtime = getUIElementsRuntime();
					if (!runtime) return;

					const controlsConfig =
						currentHandler?.getNovelControlsConfig?.() || {};
					const novelControls =
						await runtime.createChapterPageNovelControls({
							controlsConfig,
							HANDLER_TYPES,
							getHandlerType,
							getNovelIdFromCurrentPage,
							getReadingStatusOptions,
							showTimedBanner: (msg, type, duration) =>
								showStatusMessage(msg, type, duration),
							isIncognitoActive: () =>
								incognitoMode?.enabled === true,
							handleChapterControlsToggleBanners:
								handleToggleBannersVisibility,
							manuallyCheckAndUpdateNovel,
							handleNovelAddUpdate,
						});

					if (novelControls) {
						runtime.placeChapterNovelControls(
							novelControls,
							controlsConfig,
						);
					}
				} catch (err) {
					debugError(
						"Ranobe Gemini: Observer could not re-add controls",
						err,
					);
				}
			}
		}, 500);

		uiObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.removedNodes) {
					if (
						node.id === "gemini-controls" ||
						node.id === "rg-chapter-novel-controls" ||
						(node.classList &&
							node.classList.contains("gemini-ui-container"))
					) {
						checkAndReinject();
						return;
					}
				}
			}
		});

		uiObserver.observe(document.body, { childList: true, subtree: true });
		debugLog("Ranobe Gemini: MutationObserver started for UI persistence.");
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
		await loadAiRuntimeModule();
		if (!aiRuntimeModule?.handleSummarizeClickRuntime) return;

		return aiRuntimeModule.handleSummarizeClickRuntime({
			isShort,
			summarizeChunkRange,
		});
	}

	// Return a canonical URL for cache keying that is shared across novelbin/novelarrow domains.
	function getCacheUrl() {
		return currentHandler?.getCanonicalCacheUrl?.() ?? window.location.href;
	}

	// Helper: Get content area HTML without any Gemini UI elements or noise (ads/iframes)
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

		// Remove ad/noise elements so they never reach Gemini
		const noiseElements = clone.querySelectorAll(
			"script, style, iframe, ins, .ads, .adsbygoogle, " +
				".js-ad-slot, [data-ad-slot], [data-ad], [data-ads], " +
				".google-auto-placed, [class*='advert'], [id*='advert']",
		);
		noiseElements.forEach((el) => el.remove());

		return clone.innerHTML;
	}

	// Handle click event for Enhance button
	async function handleEnhanceClick() {
		await loadAiRuntimeModule();
		if (!aiRuntimeModule?.handleEnhanceClickRuntime) return;

		return aiRuntimeModule.handleEnhanceClickRuntime({
			documentRef: document,
			windowRef: window,
			browserRef: browser,
			loadChunkBatchModule,
			loadChunkingSystem,
			storageManager,
			cancelEnhanceButton,
			showStatusMessage,
			showWorkInProgressBanner,
			handleReenhanceChunk,
			getEnhancementCancelRequested: () => enhancementCancelRequested,
			setEnhancementCancelRequested: (val) => {
				enhancementCancelRequested = val;
			},
			isCachedContent,
			hasCachedContent,
			onResetChunkCacheFlags: () => {
				hasCachedContent = false;
				isCachedContent = false;
			},
			onResetCacheFlags: () => {
				isCachedContent = false;
				hasCachedContent = false;
			},
			onCacheLoaded: () => {
				isCachedContent = true;
				hasCachedContent = true;
			},
			onCacheMiss: () => {
				hasCachedContent = false;
			},
			findContentArea,
			replaceContentWithEnhancedVersion,
			extractContent,
			wakeUpBackgroundWorker,
			setFormattingOptions: (next) => {
				formattingOptions = { ...formattingOptions, ...next };
			},
			debugLog,
			debugError,
			getCleanContentHTML,
			buildChunkBanner,
			stripHtmlTags,
			summarizeChunkRange,
			shouldBannersBeHidden,
			enableCopyOnContentArea,
			novelLibrary,
			buildCombinedPrompt,
			sendMessageWithRetry,
			handleChunkProcessed,
		});
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

			const flowContext =
				enhancementDisplayModule?.prepareEnhancementFlowContextRuntime?.(
					{
						enhancedContent,
						contentArea,
						documentRef: document,
						stripHtmlTags,
						sanitizeHTML,
						debugLog,
						onSetCachedFlags: () => {
							isCachedContent = true;
							hasCachedContent = true;
						},
					},
				) || {};
			const isFromCache = flowContext.isFromCache || false;
			const cacheInfo = flowContext.cacheInfo || null;
			const originalContent =
				flowContext.originalContent || contentArea.innerHTML;
			const originalText =
				flowContext.originalText ||
				contentArea.innerText ||
				contentArea.textContent;
			const modelInfo = flowContext.modelInfo || null;
			const enhancedContentText =
				flowContext.enhancedContentText ?? enhancedContent;
			const sanitizedContent =
				flowContext.sanitizedContent ||
				sanitizeHTML(enhancedContentText);

			const supportsTextOnly = shouldUseTextOnlyEnhancement();
			await enhancementDisplayModule?.runEnhancedReplacementFlowRuntime?.(
				{
					contentArea,
					sanitizedContent,
					originalContent,
					originalText,
					currentHandler,
					supportsTextOnly,
					preserveHtmlElements,
					preserveGameStatsBoxes,
					restoreGameStatsBoxes,
					sanitizeHTML,
					documentRef: document,
					debugLog,
					debugError,
					applyPostEnhancementFormatting,
					currentFontSize,
					currentReadingFontStack:
						resolveReadingFontStack(currentReadingFont),
					removeOriginalWordCount,
					modelInfo,
					isCachedContent,
					cacheInfo,
					enableCopyOnContentArea,
					refreshToggleBanner,
					createEnhancedBanner,
					windowRef: window,
					scrollPosition,
					showStatusMessage,
					isFromCache,
					storageManager,
					enhancedContentText,
					setCachedFlag: () => {
						isCachedContent = true;
					},
					extractNovelContext,
					addToNovelLibrary,
					updateChapterProgression,
				},
			);

			// Fire-and-forget: the reader does not wait on graphify.
			notifyLoreWeave(enhancedContentText);

			return true;
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
		if (!enhancementDisplayModule?.displayEnhancedContentRuntime) {
			showStatusMessage(
				"Enhancement display runtime unavailable",
				"error",
			);
			return false;
		}

		return enhancementDisplayModule.displayEnhancedContentRuntime({
			originalContent,
			enhancedContent,
			findContentArea,
			showStatusMessage,
			windowRef: window,
			sanitizeHTML,
			shouldUseTextOnlyEnhancement,
			getCurrentHandler: () => currentHandler,
			applyPostEnhancementFormatting,
			createEnhancedBanner,
			removeOriginalWordCount,
			refreshToggleBanner,
			enableCopyOnContentArea,
			insertNodeAtContentTop,
			debugLog,
			debugError,
		});
	}

	// Function to display an error message when processing fails
	// eslint-disable-next-line no-unused-vars
	function showProcessingError(errorMessage) {
		if (enhancementDisplayModule?.showProcessingErrorRuntime) {
			enhancementDisplayModule.showProcessingErrorRuntime({
				errorMessage,
				documentRef: document,
				findContentArea,
				insertNodeAtContentTop,
				debugError,
			});
			return;
		}

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
		if (enhancementDisplayModule?.removeOriginalWordCountRuntime) {
			enhancementDisplayModule.removeOriginalWordCountRuntime({
				documentRef: document,
			});
			return;
		}

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
		if (enhancementDisplayModule?.addWordCountDisplayRuntime) {
			enhancementDisplayModule.addWordCountDisplayRuntime({
				contentArea,
				originalCount,
				newCount,
				documentRef: document,
				insertAfterControlsOrTop,
			});
			return;
		}

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
		if (enhancementDisplayModule?.applyDefaultFormattingRuntime) {
			enhancementDisplayModule.applyDefaultFormattingRuntime({
				contentArea,
				formattingOptions,
			});
			return;
		}

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
		if (notificationRuntimeModule?.showStatusMessageRuntime) {
			notificationRuntimeModule.showStatusMessageRuntime({
				message,
				type,
				duration,
				options,
				documentRef: document,
				onLogNotification: logNotification,
			});
			return;
		}

		const messageDiv = document.createElement("div");
		messageDiv.textContent = message;
		messageDiv.style.cssText =
			"position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 2147483647; background: #2c494f; color: #bab9a0; padding: 12px 16px; border-radius: 6px; font: 700 14px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; pointer-events: none;";
		document.documentElement.appendChild(messageDiv);

		logNotification({
			type,
			message,
			title: options.title,
			novelData: options.novelData,
			metadata: options.metadata,
			source: options.source || "content",
		});

		setTimeout(() => messageDiv.remove(), duration);
	}

	/**
	 * Handle getting novel info for popup display
	 * @returns {Promise<Object>} Novel info response
	 */
	async function handleGetNovelInfo() {
		const popupLibraryModule = await loadPopupLibraryRuntimeModule();
		if (popupLibraryModule?.getNovelInfoRuntime) {
			return popupLibraryModule.getNovelInfoRuntime({
				currentHandler,
				browserRef: browser,
				windowRef: window,
				cacheNovelData,
				debugLog,
				debugError,
			});
		}

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
		const popupLibraryModule = await loadPopupLibraryRuntimeModule();
		if (popupLibraryModule?.addCurrentNovelToLibraryRuntime) {
			return popupLibraryModule.addCurrentNovelToLibraryRuntime({
				currentHandler,
				browserRef: browser,
				windowRef: window,
				cacheNovelData,
				logNotification,
				debugError,
			});
		}

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
			const shelfId =
				currentHandler.constructor.SHELF_METADATA?.id || null;
			const novelId =
				metadata.id ||
				(typeof currentHandler.generateNovelId === "function"
					? currentHandler.generateNovelId(window.location.href)
					: null);
			console.log(
				"[RG-Library-Debug] handleAddToLibrary fallback: calling addOrUpdateNovel",
				{
					novelId,
					shelfId,
					title: metadata.title,
					needsDetailPage: metadata.needsDetailPage ?? false,
				},
			);
			const result = await novelLibrary.addOrUpdateNovel({
				id: novelId,
				shelfId,
				title: metadata.title,
				author: metadata.author,
				coverUrl: metadata.coverUrl || metadata.coverImage,
				currentChapter: metadata.currentChapter,
				lastReadChapter: inferredLastReadChapter,
				lastReadUrl: window.location.href,
				readingStatus: inferredReadingStatus,
				totalChapters:
					metadata.totalChapters ||
					metadata.chapterCount ||
					metadata.metadata?.totalChapters,
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

			console.log(
				"[RG-Library-Debug] handleAddToLibrary fallback: SUCCESS",
				{
					id: result?.id,
					shelfId: result?.shelfId,
					title: result?.title,
				},
			);
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

	async function handleUpdateNovelReadingStatus(novelId, readingStatus) {
		const popupLibraryModule = await loadPopupLibraryRuntimeModule();
		if (popupLibraryModule?.updateNovelReadingStatusRuntime) {
			return popupLibraryModule.updateNovelReadingStatusRuntime({
				novelId,
				readingStatus,
				browserRef: browser,
				debugError,
			});
		}

		try {
			const libraryUrl = browser.runtime.getURL("utils/novel-library.js");
			const { novelLibrary } = await import(libraryUrl);
			const result = await novelLibrary.updateNovel(novelId, {
				readingStatus,
			});
			return { success: true, result };
		} catch (error) {
			debugError("Error updating reading status:", error);
			return {
				success: false,
				error: error.message || "Failed to update reading status",
			};
		}
	}

	async function handleGetSiteHandlerInfo() {
		const popupLibraryModule = await loadPopupLibraryRuntimeModule();
		if (popupLibraryModule?.getSiteHandlerInfoRuntime) {
			return popupLibraryModule.getSiteHandlerInfoRuntime({
				currentHandler,
			});
		}

		const response = { success: true, hasHandler: false };
		if (currentHandler) {
			response.hasHandler = true;
			response.siteIdentifier = currentHandler.getSiteIdentifier();
			response.defaultPrompt = currentHandler.getDefaultPrompt();
			response.siteSpecificPrompt =
				currentHandler.getSiteSpecificPrompt();
		}
		return response;
	}

	async function handleTestExtraction() {
		const popupLibraryModule = await loadPopupLibraryRuntimeModule();
		if (popupLibraryModule?.testExtractionRuntime) {
			return popupLibraryModule.testExtractionRuntime({
				extractContent,
			});
		}

		const result = extractContent();
		return {
			success: true,
			foundContent: result.found,
			title: result.title,
			text: result.text.substring(0, 100) + "...",
		};
	}

	function handleProcessingCancelledMessage(message) {
		if (enhancementCancelModule?.handleProcessingCancelledMessageRuntime) {
			enhancementCancelModule.handleProcessingCancelledMessageRuntime({
				message,
				documentRef: document,
				debugLog,
				showStatusMessage,
				cancelEnhanceButton,
				clearTransientEnhancementBanners: () => {
					if (
						domIntegrationModule?.clearTransientEnhancementBannersRuntime
					) {
						domIntegrationModule.clearTransientEnhancementBannersRuntime(
							{
								documentRef: document,
							},
						);
						return;
					}
					const wipBanner =
						document.querySelector(".gemini-wip-banner");
					if (wipBanner) {
						wipBanner.remove();
					}
				},
				continueLabel: "⚡ Continue Enhancement",
			});
			return;
		}

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

		document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
			btn.textContent = "⚡ Continue Enhancement";
			btn.disabled = false;
			btn.classList.remove("loading");
		});
	}

	function handleApiKeyMissingMessage() {
		if (enhancementCancelModule?.handleApiKeyMissingRuntime) {
			enhancementCancelModule.handleApiKeyMissingRuntime({
				documentRef: document,
				debugError,
				showStatusMessage,
				messageText:
					"⚠️ API key is missing. Please configure it in the extension popup.",
				openPopup: () => {
					browser.runtime
						.sendMessage({ action: "openPopup" })
						.catch((err) => {
							console.warn("Could not open popup:", err);
						});
				},
				buttonLabel: "✨ Enhance with Gemini",
			});
			return;
		}

		debugError("[Content] API key is missing, halting processing");
		showStatusMessage(
			"⚠️ API key is missing. Please configure it in the extension popup.",
			"error",
			10000,
		);

		try {
			browser.runtime
				.sendMessage({ action: "openPopup" })
				.catch((err) => {
					console.warn("Could not open popup:", err);
				});
		} catch (err) {
			console.warn("Could not send openPopup message:", err);
		}

		document.querySelectorAll(".gemini-enhance-btn").forEach((btn) => {
			btn.textContent = "✨ Enhance with Gemini";
			btn.disabled = false;
			btn.classList.remove("loading");
		});
	}

	/**
	 * Answer for `getNovelContext`. Story Chat uses `chapterText` as one of its
	 * context sources, so extraction failure has to be survivable: the caller
	 * still gets the identity fields and simply loses that one source.
	 */
	function buildNovelContextResponse() {
		const novelData = getLastKnownNovelData?.();

		let chapterText = "";
		try {
			const extracted = extractContent();
			if (extracted?.found) chapterText = extracted.text || "";
		} catch (err) {
			debugError("getNovelContext: chapter extraction failed", err);
		}

		return {
			novelId: getNovelIdFromCurrentPage?.() || null,
			novelTitle: novelData?.title || document.title || null,
			chapterNum: novelData?.currentChapter || null,
			chapterText,
		};
	}

	// Register all content message handlers via the message-router module
	loadMessageRouterModule().then((router) => {
		if (!router) {
			// Fallback: inline ping-only listener so the extension doesn't go silent
			browser.runtime.onMessage.addListener(
				(message, _sender, sendResponse) => {
					if (message.action === "ping") {
						sendResponse({
							success: true,
							message: "Content script is alive",
						});
						return true;
					}
					if (message.action === "getNovelContext") {
						sendResponse(buildNovelContextResponse());
						return false;
					}
					return false;
				},
			);
			return;
		}
		router.registerContentMessageHandlers({
			handleApiKeyMissingMessage,
			handleChunkProcessed,
			handleChunkError,
			handleAllChunksProcessed,
			handleProcessingCancelledMessage,
			handleGetSiteHandlerInfo,
			handleTestExtraction,
			handleEnhanceClick,
			handleSummarizeClick,
			handleGetNovelInfo,
			handleAddToLibrary,
			handleUpdateNovelReadingStatus,
			handleToggleBannersVisibility,
			handleGetNovelContext(sendResponse) {
				sendResponse(buildNovelContextResponse());
				return false;
			},
		});
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
