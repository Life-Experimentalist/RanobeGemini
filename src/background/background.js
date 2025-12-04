// Background script for Ranobe Gemini

// Browser API compatibility shim - Chrome uses 'chrome', Firefox uses 'browser'
// This must be at the very top before any other code
if (typeof browser === "undefined") {
	globalThis.browser = chrome;
}

// Wrap in async IIFE to allow top-level await in service workers
(async () => {
	// Ensure browser API is available within the IIFE scope
	const browser =
		typeof globalThis.browser !== "undefined" ? globalThis.browser : chrome;

	// Use a try-catch for the import to handle potential errors
	try {
		// Use a dynamic import with browser.runtime.getURL
		const api = typeof browser !== "undefined" ? browser : chrome;
		const constantsModule = await import(
			api.runtime.getURL("utils/constants.js")
		);
		const {
			DEFAULT_PROMPT,
			DEFAULT_MODEL_ENDPOINT,
			DEFAULT_PERMANENT_PROMPT,
			DEFAULT_SUMMARY_PROMPT,
			DEFAULT_SHORT_SUMMARY_PROMPT,
		} = constantsModule;

		console.log("Ranobe Gemini: Background script loaded");

		// ============================================================
		// CROSS-BROWSER KEEP-ALIVE MECHANISM (MV3)
		// ============================================================
		// Chrome MV3: Service workers sleep after ~30 seconds of inactivity
		// Firefox MV3: Uses event pages which are more persistent but can still unload
		// This mechanism works for both browsers to ensure responsiveness

		const KEEP_ALIVE_ALARM_NAME = "ranobe-gemini-keep-alive";
		const DEFAULT_KEEP_ALIVE_INTERVAL_MINUTES = 0.5; // 30 seconds

		// Detect browser type
		const isFirefox =
			typeof browser !== "undefined" &&
			browser.runtime?.getBrowserInfo !== undefined;
		const isChrome = !isFirefox && typeof chrome !== "undefined";

		// Set up the keep-alive alarm (works in both Chrome and Firefox)
		async function setupKeepAliveAlarm() {
			try {
				const api = typeof browser !== "undefined" ? browser : chrome;

				// Check if alarms API is available
				if (!api.alarms) {
					console.warn(
						"Alarms API not available, using setInterval fallback only"
					);
					return false;
				}

				// Get user-configured interval from storage
				const data = await api.storage.local.get(
					"keepAliveIntervalMinutes"
				);
				let intervalMinutes =
					data.keepAliveIntervalMinutes ||
					DEFAULT_KEEP_ALIVE_INTERVAL_MINUTES;

				// Chrome enforces minimum of 1 minute for alarms
				// Firefox allows shorter intervals
				if (isChrome) {
					intervalMinutes = Math.max(1, intervalMinutes);
				} else {
					// Firefox: can use shorter intervals, minimum 0.5 minutes (30 seconds)
					intervalMinutes = Math.max(0.5, intervalMinutes);
				}

				// Clear any existing alarm first
				try {
					await api.alarms.clear(KEEP_ALIVE_ALARM_NAME);
				} catch (e) {
					// Ignore errors when clearing non-existent alarms
				}

				// Create a new periodic alarm
				await api.alarms.create(KEEP_ALIVE_ALARM_NAME, {
					periodInMinutes: intervalMinutes,
				});

				console.log(
					`[Keep-Alive] Alarm set with interval: ${intervalMinutes} minutes (${
						isFirefox ? "Firefox" : "Chrome"
					})`
				);
				return true;
			} catch (error) {
				console.error("Error setting up keep-alive alarm:", error);
				return false;
			}
		}

		// Handle alarm events (cross-browser)
		const alarmApi =
			typeof browser !== "undefined" ? browser.alarms : chrome?.alarms;
		if (alarmApi?.onAlarm) {
			alarmApi.onAlarm.addListener((alarm) => {
				if (alarm.name === KEEP_ALIVE_ALARM_NAME) {
					// Simple heartbeat - just log to keep the background script alive
					console.log(
						`[Keep-Alive] Background script heartbeat at ${new Date().toISOString()}`
					);
				}
			});
		}

		// Initialize the keep-alive system
		setupKeepAliveAlarm();

		// Service worker events (Chrome only - Firefox uses event pages)
		if (isChrome && typeof self !== "undefined" && self.addEventListener) {
			self.addEventListener("install", () => {
				console.log("Service worker installed");
				self.skipWaiting?.();
			});

			self.addEventListener("activate", (event) => {
				console.log("Service worker activated");
				event.waitUntil(self.clients?.claim?.());
				setupKeepAliveAlarm();
			});
		}

		// Firefox event page: use runtime.onStartup and runtime.onInstalled
		if (isFirefox) {
			browser.runtime.onStartup?.addListener(() => {
				console.log("Firefox: Extension started");
				setupKeepAliveAlarm();
			});

			browser.runtime.onInstalled?.addListener(() => {
				console.log("Firefox: Extension installed/updated");
				setupKeepAliveAlarm();
			});
		}

		// ============================================================
		// END KEEP-ALIVE MECHANISM
		// ============================================================

		// Global configuration
		let currentConfig = null;

		// Cancellation flag for chunk processing
		let isCancellationRequested = false;

		// Initialize configuration
		async function initConfig() {
			try {
				// Get settings directly from storage
				const data = await browser.storage.local.get();
				return {
					apiKey: data.apiKey || "",
					backupApiKeys: data.backupApiKeys || [], // Array of backup API keys
					apiKeyRotation: data.apiKeyRotation || "failover", // "failover" or "round-robin"
					currentApiKeyIndex: data.currentApiKeyIndex || 0, // Current API key index for round-robin
					defaultPrompt: data.defaultPrompt || DEFAULT_PROMPT,
					summaryPrompt: data.summaryPrompt || DEFAULT_SUMMARY_PROMPT,
					shortSummaryPrompt:
						data.shortSummaryPrompt || DEFAULT_SHORT_SUMMARY_PROMPT,
					permanentPrompt:
						data.permanentPrompt || DEFAULT_PERMANENT_PROMPT,
					temperature: data.temperature || 0.7,
					topP: data.topP !== undefined ? data.topP : 0.95,
					topK: data.topK !== undefined ? data.topK : 40,
					maxOutputTokens: data.maxOutputTokens || 8192,
					debugMode: data.debugMode || false,
					modelEndpoint: data.modelEndpoint || DEFAULT_MODEL_ENDPOINT,
					chunkingEnabled: data.chunkingEnabled !== false,
					chunkSize: data.chunkSize || 20000, // Used for both threshold AND chunk size
					chunkThreshold: data.chunkSize || 20000, // Same as chunkSize (simplified)
					useEmoji: data.useEmoji || false,
					fontSize: data.fontSize || 100, // Font size percentage (default 100%)
				};
			} catch (error) {
				console.error("Error loading configuration:", error);
				return {
					apiKey: "",
					backupApiKeys: [],
					apiKeyRotation: "failover",
					currentApiKeyIndex: 0,
					defaultPrompt:
						"Please fix grammar and improve readability of this text while maintaining original meaning.",
					summaryPrompt: DEFAULT_SUMMARY_PROMPT,
					shortSummaryPrompt:
						DEFAULT_SHORT_SUMMARY_PROMPT ||
						"Provide a brief 2-3 paragraph summary.",
					permanentPrompt: DEFAULT_PERMANENT_PROMPT,
					temperature: 0.7,
					topP: 0.95,
					topK: 40,
					maxOutputTokens: 8192,
					chunkingEnabled: true,
					chunkSize: 20000,
					chunkThreshold: 20000,
					useEmoji: false,
					fontSize: 100,
				};
			}
		}

		// Get the current API key based on rotation strategy
		function getCurrentApiKey(config, forceNext = false) {
			const allKeys = [config.apiKey, ...config.backupApiKeys].filter(
				(k) => k && k.trim()
			);
			if (allKeys.length === 0) return null;

			if (config.apiKeyRotation === "round-robin") {
				let index = config.currentApiKeyIndex || 0;
				if (forceNext) {
					index = (index + 1) % allKeys.length;
					// Save the new index
					browser.storage.local.set({ currentApiKeyIndex: index });
				}
				return { key: allKeys[index], index, total: allKeys.length };
			} else {
				// Failover mode - try primary first, then backups
				return { key: allKeys[0], index: 0, total: allKeys.length };
			}
		}

		// Get next API key for failover
		async function getNextApiKey(config, currentIndex) {
			const allKeys = [config.apiKey, ...config.backupApiKeys].filter(
				(k) => k && k.trim()
			);
			const nextIndex = currentIndex + 1;
			if (nextIndex >= allKeys.length) {
				return null; // No more keys available
			}
			return {
				key: allKeys[nextIndex],
				index: nextIndex,
				total: allKeys.length,
			};
		}

		// Make API call with automatic key rotation on rate limit errors
		async function makeApiCallWithRotation(
			modelEndpoint,
			requestBody,
			config
		) {
			const allKeys = [config.apiKey, ...config.backupApiKeys].filter(
				(k) => k && k.trim()
			);

			if (allKeys.length === 0) {
				throw new Error(
					"No API keys configured. Please set an API key in the extension popup."
				);
			}

			let currentKeyInfo = getCurrentApiKey(config);
			let attempts = 0;
			const maxAttempts = allKeys.length;

			while (attempts < maxAttempts) {
				const apiKey = currentKeyInfo.key;
				console.log(
					`Attempting API call with key ${currentKeyInfo.index + 1}/${
						currentKeyInfo.total
					}`
				);

				try {
					const response = await fetch(
						`${modelEndpoint}?key=${apiKey}`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify(requestBody),
						}
					);

					// Parse the response
					const responseData = await response.json();

					// Check for rate limiting
					if (response.status === 429) {
						const retryAfter = response.headers.get("retry-after");
						const waitTime = retryAfter
							? parseInt(retryAfter) * 1000
							: 60000;

						console.log(
							`Rate limit hit on key ${
								currentKeyInfo.index + 1
							}. Will try next key.`
						);

						// Try next key
						if (config.apiKeyRotation === "round-robin") {
							currentKeyInfo = getCurrentApiKey(config, true); // Force next key
						} else {
							// Failover mode
							const nextKey = await getNextApiKey(
								config,
								currentKeyInfo.index
							);
							if (nextKey) {
								currentKeyInfo = nextKey;
							} else {
								// No more keys, throw rate limit error
								throw new Error(
									`Rate limit reached on all ${
										allKeys.length
									} API keys. Please try again in ${Math.ceil(
										waitTime / 1000
									)} seconds.`
								);
							}
						}
						attempts++;
						continue;
					}

					// Return both response and data for further processing
					return {
						response,
						responseData,
						keyUsed: currentKeyInfo.index,
					};
				} catch (fetchError) {
					// Network error or other fetch failure
					console.error(
						`API call failed with key ${currentKeyInfo.index + 1}:`,
						fetchError
					);

					// Try next key for network errors too
					if (config.apiKeyRotation === "round-robin") {
						currentKeyInfo = getCurrentApiKey(config, true);
					} else {
						const nextKey = await getNextApiKey(
							config,
							currentKeyInfo.index
						);
						if (nextKey) {
							currentKeyInfo = nextKey;
						} else {
							throw fetchError; // Re-throw if no more keys
						}
					}
					attempts++;
				}
			}

			throw new Error(
				`All ${allKeys.length} API keys exhausted. Please check your API keys or try again later.`
			);
		}

		// Helper function to combine prompts for Gemini
		function combinePrompts(
			mainPrompt,
			permanentPrompt,
			siteSpecificPrompt = ""
		) {
			let combinedPrompt = mainPrompt;

			// Add site-specific prompt if available
			if (siteSpecificPrompt && siteSpecificPrompt.length > 0) {
				combinedPrompt +=
					"\n\n## Site-Specific Context:\n" + siteSpecificPrompt;
			}

			// Add permanent prompt if available
			if (permanentPrompt && permanentPrompt.length > 0) {
				combinedPrompt +=
					"\n\n## Always Follow These Instructions:\n" +
					permanentPrompt;
			}

			return combinedPrompt;
		}

		// Handle messages from content script
		browser.runtime.onMessage.addListener(
			(message, sender, sendResponse) => {
				console.log("Background received message:", message);

				if (message.action === "ping") {
					sendResponse({
						success: true,
						message: "Background script is alive",
					});
					return true;
				}

				// Handle cancel enhancement request
				if (message.action === "cancelEnhancement") {
					console.log("Enhancement cancellation requested");
					// Set a flag that can be checked during chunk processing
					isCancellationRequested = true;
					sendResponse({
						success: true,
						message: "Cancellation requested",
					});
					return true;
				}

				if (message.action === "getModelInfo") {
					getModelInfo()
						.then((modelInfo) => {
							sendResponse({
								success: true,
								maxContextSize: modelInfo.maxContextSize,
								maxOutputTokens: modelInfo.maxOutputTokens,
							});
						})
						.catch((error) => {
							console.error("Error getting model info:", error);
							sendResponse({
								success: false,
								error:
									error.message ||
									"Unknown error getting model info",
								// Provide safe defaults
								maxContextSize: 16000,
								maxOutputTokens: 8192,
							});
						});
					return true;
				}

				if (message.action === "processWithGemini") {
					// DEBUG: Log incoming message content
					console.log(
						`[processWithGemini] Received message. Content length: ${
							message.content?.length || 0
						}`
					);
					console.log(
						`[processWithGemini] Content preview (first 200 chars): "${message.content?.substring(
							0,
							200
						)}"`
					);

					// CRITICAL: Check if API key exists before attempting to process
					// Load config to check API key and get settings
					initConfig()
						.then(async (config) => {
							// Check if we have any API key (primary or backup)
							const allKeys = [
								config.apiKey,
								...(config.backupApiKeys || []),
							].filter((k) => k && k.trim());

							if (allKeys.length === 0) {
								console.error(
									"[processWithGemini] No API key found. Opening popup for configuration."
								);
								// Open the popup for user to add API key
								try {
									await browser.action.openPopup();
								} catch (popupError) {
									// If popup fails (e.g., on Android), send notification
									console.warn(
										"Failed to open popup, sending notification instead:",
										popupError
									);
									await browser.notifications.create({
										type: "basic",
										title: "Ranobe Gemini",
										message:
											"Please configure your API key in the extension settings.",
										iconUrl: browser.runtime.getURL(
											"icons/logo-light-48.png"
										),
									});
								}
								// Send error response to content script
								sendResponse({
									success: false,
									error: "API key is missing. Please configure it in the extension popup.",
									needsApiKey: true,
								});
								return;
							}

							// Use chunkSize as both the threshold and chunk size (simplified)
							const chunkSize = config.chunkSize || 20000;

							// For longer content, use chunk processing with progressive rendering
							if (
								message.content &&
								message.content.length > chunkSize
							) {
								console.log(
									`Content length ${message.content.length} exceeds chunk size ${chunkSize}, using chunked processing`
								);
								processContentInChunks(
									message.title,
									message.content,
									message.useEmoji,
									message.siteSpecificPrompt || "",
									sender.tab?.id
								)
									.then((result) => {
										sendResponse({
											success: true,
											result: result,
										});
									})
									.catch((error) => {
										console.error(
											"Error processing with Gemini in chunks:",
											error
										);
										sendResponse({
											success: false,
											error:
												error.message ||
												"Unknown error processing with Gemini",
										});
									});
							} else {
								// For shorter content, process as a single piece
								console.log(
									`Content length ${
										message.content?.length || 0
									} is under chunk size ${chunkSize}, processing as single piece`
								);
								processContentWithGemini(
									message.title,
									message.content,
									message.isPart,
									message.partInfo,
									message.useEmoji,
									null,
									message.siteSpecificPrompt || ""
								)
									.then((result) => {
										sendResponse({
											success: true,
											result: result,
										});
									})
									.catch((error) => {
										console.error(
											"Error processing with Gemini:",
											error
										);
										sendResponse({
											success: false,
											error:
												error.message ||
												"Unknown error processing with Gemini",
										});
									});
							}
						})
						.catch((error) => {
							console.error("Error loading config:", error);
							sendResponse({
								success: false,
								error: "Failed to load configuration",
							});
						});
					return true; // Indicates we'll send a response asynchronously
				}

				// Handler for resuming chunk processing after a rate limit pause
				if (message.action === "resumeProcessing") {
					console.log(
						"Resuming processing from chunk",
						message.startChunkIndex
					);

					// Create an array of chunks to process
					const remainingChunks = message.remainingChunks || [];
					const totalChunksRemaining = remainingChunks.length;

					if (totalChunksRemaining === 0) {
						sendResponse({
							success: false,
							error: "No chunks to resume processing",
						});
						return true;
					}

					// Process the remaining chunks sequentially
					(async () => {
						try {
							let results = [];
							let failedChunks = [];

							// Process each remaining chunk
							for (let i = 0; i < totalChunksRemaining; i++) {
								try {
									const chunkIndex =
										message.startChunkIndex + i;
									console.log(
										`Resuming chunk ${chunkIndex + 1}/${
											message.totalChunks
										}`
									);

									// Add delay between chunks to avoid rate limits
									if (i > 0) {
										const delay = 1000; // 1 second delay between resumed chunks
										await new Promise((resolve) =>
											setTimeout(resolve, delay)
										);
									}

									const chunk = remainingChunks[i];
									const partInfo = {
										current: chunkIndex + 1,
										total: message.totalChunks,
									};

									// Process this chunk
									const result =
										await processContentWithGemini(
											message.title,
											chunk,
											true,
											partInfo,
											message.useEmoji
										);

									// Store and send the result immediately
									results.push({
										originalContent: chunk,
										enhancedContent: result.enhancedContent,
										chunkIndex: chunkIndex,
										processed: true,
									});

									// Send this chunk result back to content script
									// Must use tabs.sendMessage to reach content scripts
									const resumeTabId = sender.tab?.id;
									if (resumeTabId) {
										browser.tabs
											.sendMessage(resumeTabId, {
												action: "chunkProcessed",
												chunkIndex: chunkIndex,
												totalChunks:
													message.totalChunks,
												result: {
													originalContent: chunk,
													enhancedContent:
														result.enhancedContent,
												},
												isResumed: true,
												isComplete:
													i ===
														totalChunksRemaining -
															1 &&
													failedChunks.length === 0,
											})
											.catch((error) =>
												console.error(
													"Error sending resumed chunk result to tab:",
													error
												)
											);
									}
								} catch (error) {
									console.error(
										`Error processing resumed chunk:`,
										error
									);

									const chunkIndex =
										message.startChunkIndex + i;
									// Store information about the failed chunk
									failedChunks.push({
										originalContent: remainingChunks[i],
										chunkIndex: chunkIndex,
										error: error.message || "Unknown error",
										processed: false,
									});

									// Check if this is a rate limit error
									const isRateLimitError =
										error.message &&
										(error.message.includes("rate limit") ||
											error.message.includes("quota") ||
											error.message.includes("429"));

									if (isRateLimitError) {
										console.log(
											"Rate limit detected during resume. Pausing processing."
										);

										// Notify about the rate limit
										if (resumeTabId) {
											browser.tabs
												.sendMessage(resumeTabId, {
													action: "chunkError",
													chunkIndex: chunkIndex,
													totalChunks:
														message.totalChunks,
													error: error.message,
													isRateLimit: true,
													remainingChunks:
														message.totalChunks -
														chunkIndex,
													unprocessedChunks:
														remainingChunks.slice(
															i
														),
													isResumed: true,
												})
												.catch((error) =>
													console.error(
														"Error sending rate limit notification during resume:",
														error
													)
												);
										}

										// Stop processing remaining chunks
										break;
									} else {
										// For other errors, notify but continue processing
										if (resumeTabId) {
											browser.tabs
												.sendMessage(resumeTabId, {
													action: "chunkError",
													chunkIndex: chunkIndex,
													totalChunks:
														message.totalChunks,
													error: error.message,
													isRateLimit: false,
													isResumed: true,
												})
												.catch((error) =>
													console.error(
														"Error sending chunk error notification during resume:",
														error
													)
												);
										}
									}
								}
							}

							// Notify that all resumed processing is complete
							if (resumeTabId) {
								browser.tabs
									.sendMessage(resumeTabId, {
										action: "resumeProcessingComplete",
										totalProcessed: results.length,
										totalFailed: failedChunks.length,
										totalChunks: message.totalChunks,
										failedChunks: failedChunks.map(
											(chunk) => chunk.chunkIndex
										),
									})
									.catch((error) =>
										console.error(
											"Error sending resume completion notification:",
											error
										)
									);
							}

							sendResponse({
								success: true,
								processedChunks: results.length,
								failedChunks: failedChunks.length,
							});
						} catch (error) {
							console.error("Error in resume processing:", error);
							sendResponse({
								success: false,
								error:
									error.message ||
									"Unknown error in resume processing",
							});
						}
					})();

					return true; // Indicates we'll send a response asynchronously
				}

				// Handler for re-enhancing a single chunk
				if (message.action === "reenhanceChunk") {
					console.log(`Re-enhancing chunk ${message.chunkIndex}`);

					(async () => {
						try {
							// Load config to check API key
							const config = await initConfig();
							const allKeys = [
								config.apiKey,
								...(config.backupApiKeys || []),
							].filter((k) => k && k.trim());

							if (allKeys.length === 0) {
								sendResponse({
									success: false,
									error: "API key is missing. Please configure it in the extension popup.",
									needsApiKey: true,
								});
								return;
							}

							const partInfo = {
								current: message.chunkIndex + 1,
								total: message.totalChunks || 1,
							};

							// Process this single chunk
							const result = await processContentWithGemini(
								message.title || "Content",
								message.content,
								true, // isPart
								partInfo,
								message.useEmoji || false,
								null,
								message.siteSpecificPrompt || ""
							);

							sendResponse({
								success: true,
								result: {
									originalContent: message.content,
									enhancedContent: result.enhancedContent,
									modelInfo: result.modelInfo,
								},
							});
						} catch (error) {
							console.error(
								`Error re-enhancing chunk ${message.chunkIndex}:`,
								error
							);
							sendResponse({
								success: false,
								error:
									error.message ||
									"Unknown error re-enhancing chunk",
							});
						}
					})();

					return true; // Indicates we'll send a response asynchronously
				}

				if (message.action === "summarizeWithGemini") {
					summarizeContentWithGemini(
						message.title,
						message.content,
						message.isPart,
						message.partInfo,
						false // isShort = false for long summaries
					)
						.then((summary) => {
							sendResponse({ success: true, summary: summary });
						})
						.catch((error) => {
							console.error(
								"Error summarizing with Gemini:",
								error
							);
							sendResponse({
								success: false,
								error:
									error.message ||
									"Unknown error summarizing with Gemini",
							});
						});
					return true; // Indicates we'll send a response asynchronously
				}

				// Handle short summary requests
				if (message.action === "shortSummarizeWithGemini") {
					summarizeContentWithGemini(
						message.title,
						message.content,
						message.isPart,
						message.partInfo,
						true // isShort = true for short summaries
					)
						.then((summary) => {
							sendResponse({ success: true, summary: summary });
						})
						.catch((error) => {
							console.error(
								"Error creating short summary with Gemini:",
								error
							);
							sendResponse({
								success: false,
								error:
									error.message ||
									"Unknown error creating short summary",
							});
						});
					return true; // Indicates we'll send a response asynchronously
				}

				if (message.action === "combinePartialSummaries") {
					combinePartialSummaries(
						message.title,
						message.partSummaries,
						message.partCount
					)
						.then((summary) => {
							sendResponse({
								success: true,
								combinedSummary: summary,
							});
						})
						.catch((error) => {
							console.error("Error combining summaries:", error);
							sendResponse({
								success: false,
								error:
									error.message ||
									"Unknown error combining summaries",
							});
						});
					return true; // Indicates we'll send a response asynchronously
				}

				// Handle request to open the popup window
				if (message.action === "openPopup") {
					browser.windows
						.create({
							url: browser.runtime.getURL("popup/popup.html"),
							type: "popup",
							width: 400,
							height: 550,
						})
						.catch((error) => {
							console.error("Error opening popup:", error);
						});
					// Send response
					sendResponse({ success: true });
					return true;
				}

				return false;
			}
		);

		// Get model information based on current configuration
		async function getModelInfo() {
			try {
				// Load latest config
				currentConfig = await initConfig();

				// Default values
				let maxContextSize = 16000; // Default for gemini-2.5-flash
				let maxOutputTokens = currentConfig.maxOutputTokens || 8192;

				// Model-specific values
				const modelId =
					currentConfig.selectedModelId ||
					currentConfig.modelEndpoint
						?.split("/")
						.pop()
						.split(":")[0] ||
					"gemini-2.5-flash";

				// Set appropriate context sizes based on model
				if (modelId.includes("gemini-2.5-pro")) {
					maxContextSize = 1000000; // 1M token context for Gemini 2.5 Pro
				} else if (modelId.includes("gemini-2.5-flash")) {
					maxContextSize = 16000; // 16k token context for Gemini 2.5 Flash
				} else if (modelId.includes("gemini-2.0-flash")) {
					maxContextSize = 32000; // 32k token context for Gemini 2.0 Flash
				}

				// Get font size setting (default 100%)
				const fontSize = currentConfig.fontSize || 100;

				return {
					modelId,
					maxContextSize,
					maxOutputTokens,
					fontSize,
				};
			} catch (error) {
				console.error("Error determining model info:", error);
				// Return safe defaults
				return {
					modelId: "unknown",
					maxContextSize: 16000,
					maxOutputTokens: 8192,
					fontSize: 100,
				};
			}
		}

		// Function to split content at natural paragraph boundaries
		function splitContentAtNaturalBoundaries(content, maxChunkSize) {
			// Start by trying to split at paragraph tags
			const paragraphs = content.split(
				/<\/(p|div|section|article|header|h[1-6])>\s*(?=<)/i
			);

			let chunks = [];
			let currentChunk = "";

			for (let i = 0; i < paragraphs.length; i++) {
				const paragraph = paragraphs[i];

				// Skip empty paragraphs
				if (!paragraph.trim()) continue;

				// If adding this paragraph would exceed the chunk size and we already have content,
				// finalize the current chunk and start a new one
				if (
					currentChunk.length + paragraph.length > maxChunkSize &&
					currentChunk.length > 0
				) {
					chunks.push(currentChunk);
					currentChunk = paragraph;
				} else {
					// Otherwise, add this paragraph to the current chunk
					currentChunk += paragraph;
				}

				// If this is not the last paragraph, add the closing tag back
				if (i < paragraphs.length - 1) {
					currentChunk += "</p>";
				}
			}

			// Add the last chunk if it has content
			if (currentChunk.length > 0) {
				chunks.push(currentChunk);
			}

			// If we couldn't make multiple chunks with paragraph boundaries, try sentence boundaries
			if (chunks.length <= 1 && content.length > maxChunkSize) {
				chunks = [];
				currentChunk = "";

				// Split by sentences (roughly)
				const sentences = content.split(/(?<=[.!?])\s+/);

				for (const sentence of sentences) {
					// If adding this sentence would exceed the chunk size and we already have content,
					// finalize the current chunk and start a new one
					if (
						currentChunk.length + sentence.length > maxChunkSize &&
						currentChunk.length > 0
					) {
						chunks.push(currentChunk);
						currentChunk = sentence;
					} else {
						// Otherwise, add this sentence to the current chunk
						if (currentChunk.length > 0) {
							currentChunk += " ";
						}
						currentChunk += sentence;
					}
				}

				// Add the last chunk if it has content
				if (currentChunk.length > 0) {
					chunks.push(currentChunk);
				}
			}

			console.log(
				`Split content into ${chunks.length} chunks at natural boundaries`
			);
			return chunks;
		}

		// Function to split content for processing large chapters
		function splitContentForProcessing(content, maxChunkSize = 20000) {
			console.log(
				`[Chunking] Starting splitContentForProcessing with maxChunkSize=${maxChunkSize}`
			);
			console.log(
				`[Chunking] Content length: ${content?.length || 0} chars`
			);

			// Validate input
			if (!content || typeof content !== "string") {
				console.error("[Chunking] Invalid content provided");
				return [content || ""];
			}

			// If content is already small enough, return as is
			if (content.length <= maxChunkSize) {
				console.log(
					"[Chunking] Content is small enough, no splitting needed"
				);
				return [content];
			}

			let chunks = [];
			let splitParts = [];

			// Try multiple splitting strategies in order of preference
			// Strategy 1: Split on double newlines (paragraph breaks)
			splitParts = content.split(/\n\s*\n/);
			console.log(
				`[Chunking] Strategy 1 (double newlines): ${splitParts.length} parts`
			);

			// Strategy 2: If no double newlines, try single newlines
			if (splitParts.length <= 1) {
				splitParts = content.split(/\n/);
				console.log(
					`[Chunking] Strategy 2 (single newlines): ${splitParts.length} parts`
				);
			}

			// Strategy 3: If still no luck, try splitting on sentence endings
			// This handles AO3's plain text which has no line breaks
			if (splitParts.length <= 1) {
				// Split on sentence endings (.!?) followed by space and capital letter
				splitParts = content.split(/(?<=[.!?])\s+(?=[A-Z])/);
				console.log(
					`[Chunking] Strategy 3 (sentence boundaries): ${splitParts.length} parts`
				);
			}

			// Strategy 4: If still just one part, split on any sentence ending
			if (splitParts.length <= 1) {
				splitParts = content.split(/(?<=[.!?])\s+/);
				console.log(
					`[Chunking] Strategy 4 (any sentence ending): ${splitParts.length} parts`
				);
			}

			// Build chunks from split parts
			let currentChunk = "";

			for (let i = 0; i < splitParts.length; i++) {
				const part = splitParts[i];
				if (!part) continue;

				const separator = currentChunk ? " " : "";

				// If adding this part would exceed the limit, finalize current chunk
				if (
					currentChunk.length + separator.length + part.length >
						maxChunkSize &&
					currentChunk.length > 0
				) {
					chunks.push(currentChunk.trim());
					currentChunk = part;
				} else {
					currentChunk += separator + part;
				}
			}

			// Add the final chunk
			if (currentChunk.trim()) {
				chunks.push(currentChunk.trim());
			}

			console.log(
				`[Chunking] After part-based splitting: ${chunks.length} chunks`
			);

			// If we have chunks that are still too big, force split them
			const finalChunks = [];
			for (const chunk of chunks) {
				if (chunk.length <= maxChunkSize) {
					finalChunks.push(chunk);
				} else {
					// Force split by words
					console.log(
						`[Chunking] Chunk too large (${chunk.length} chars), force splitting by words`
					);
					const words = chunk.split(/\s+/);
					let subChunk = "";

					for (const word of words) {
						if (
							subChunk.length + word.length + 1 > maxChunkSize &&
							subChunk.length > 0
						) {
							finalChunks.push(subChunk.trim());
							subChunk = word;
						} else {
							subChunk += (subChunk ? " " : "") + word;
						}
					}

					if (subChunk.trim()) {
						finalChunks.push(subChunk.trim());
					}
				}
			}

			// Filter out any empty chunks
			const validChunks = finalChunks.filter(
				(c) => c && c.trim().length > 0
			);

			console.log(
				`[Chunking] Final result: ${validChunks.length} chunks`
			);
			console.log(
				`[Chunking] Chunk sizes: ${validChunks
					.map((c, i) => `[${i}]=${c.length}`)
					.join(", ")}`
			);

			// Log first 100 chars of each chunk for debugging
			validChunks.forEach((chunk, idx) => {
				console.log(
					`[Chunking] Chunk ${idx} preview: "${chunk.substring(
						0,
						100
					)}..."`
				);
			});

			return validChunks.length > 0 ? validChunks : [content];
		}

		// Process content in chunks, handling one at a time with rate limit awareness
		async function processContentInChunks(
			title,
			content,
			useEmoji = false,
			siteSpecificPrompt = "",
			tabId = null
		) {
			console.log(
				`[processContentInChunks] Starting. Content length: ${content?.length}, tabId: ${tabId}`
			);
			try {
				// Load latest config directly from storage for most up-to-date settings
				currentConfig = await initConfig();
				console.log(
					`[processContentInChunks] Config loaded. chunkingEnabled: ${currentConfig.chunkingEnabled}, chunkSize: ${currentConfig.chunkSize}`
				);

				// Check if chunking is enabled
				if (!currentConfig.chunkingEnabled) {
					console.log(
						"[processContentInChunks] Chunking is DISABLED. Processing content as a single piece."
					);
					return await processContentWithGemini(
						title,
						content,
						false,
						null,
						useEmoji,
						null,
						siteSpecificPrompt
					);
				}

				// Get model info to determine appropriate chunk size
				const modelInfo = await getModelInfo();
				const modelContextSize = modelInfo.maxContextSize || 16000;

				// Calculate safe chunk size based on model context
				// Reserve space for: system prompt (~1500 tokens), conversation history (~2000 tokens), output (~maxOutputTokens)
				// Average word = ~1.3 tokens, average character = ~0.25 tokens
				const promptOverheadTokens = 1500;
				const historyOverheadTokens = 2000;
				const outputTokens = currentConfig.maxOutputTokens || 8192;
				const availableInputTokens =
					modelContextSize -
					promptOverheadTokens -
					historyOverheadTokens -
					outputTokens;

				// Convert tokens to characters (roughly 4 chars per token for English text)
				const maxCharsForInput = Math.max(
					availableInputTokens * 4,
					4000
				);

				// Use the smaller of: configured chunk size, calculated safe size, or 20000 default
				// NOTE: Default 20000 MUST match content.js and other references for consistency
				const configuredChunkSize = currentConfig.chunkSize || 20000;
				const effectiveChunkSize = Math.min(
					configuredChunkSize,
					maxCharsForInput
				);

				console.log(
					`[processContentInChunks] Model: ${modelInfo.modelId}, Context: ${modelContextSize} tokens`
				);
				console.log(
					`[processContentInChunks] Available for input: ~${availableInputTokens} tokens (~${maxCharsForInput} chars)`
				);
				console.log(
					`[processContentInChunks] Using effective chunk size: ${effectiveChunkSize} characters`
				);
				console.log(
					`[processContentInChunks] Content length: ${content.length}, effectiveChunkSize: ${effectiveChunkSize}`
				);

				// Only split if content exceeds the chunk size
				if (content.length <= effectiveChunkSize) {
					console.log(
						`[processContentInChunks] Content (${content.length}) <= effectiveChunkSize (${effectiveChunkSize}), processing as single piece.`
					);
					return await processContentWithGemini(
						title,
						content,
						false,
						null,
						useEmoji,
						null,
						siteSpecificPrompt
					);
				}

				console.log(
					`[processContentInChunks] Content exceeds chunk size, calling splitContentForProcessing...`
				);
				// Split content for processing - improved method with better chunking
				const contentChunks = splitContentForProcessing(
					content,
					effectiveChunkSize
				);
				const totalChunks = contentChunks.length;

				console.log(
					`[processContentInChunks] Split into ${totalChunks} chunks`
				);

				// DEBUG: Log each chunk's size and first 100 chars
				contentChunks.forEach((chunk, idx) => {
					console.log(
						`[processContentInChunks] Chunk ${idx}: ${
							chunk?.length || 0
						} chars, empty=${!chunk || chunk.trim().length === 0}`
					);
					console.log(
						`[processContentInChunks] Chunk ${idx} preview: "${chunk?.substring(
							0,
							100
						)}..."`
					);
				});

				// CRITICAL: Check API key BEFORE processing any chunks
				// This prevents wasting time and showing misleading error messages
				const allKeys = [
					currentConfig.apiKey,
					...(currentConfig.backupApiKeys || []),
				].filter((k) => k && k.trim());

				if (allKeys.length === 0) {
					const error = new Error(
						"API key is missing. Please set it in the extension popup."
					);
					console.error(
						"[processContentInChunks] No API key found. Aborting chunk processing."
					);

					// Notify user via content script
					if (tabId) {
						try {
							await browser.tabs.sendMessage(tabId, {
								action: "apiKeyMissing",
								error: error.message,
							});
						} catch (msgError) {
							console.error(
								"Error sending API key missing message:",
								msgError
							);
						}
					}

					// Try to open popup
					try {
						await browser.action.openPopup();
					} catch (popupError) {
						// Fallback notification
						await browser.notifications.create({
							type: "basic",
							title: "Ranobe Gemini",
							message:
								"Please configure your API key in the extension settings.",
							iconUrl: browser.runtime.getURL(
								"icons/logo-light-48.png"
							),
						});
					}

					throw error;
				}

				// Array to store results for each chunk
				let results = [];
				let failedChunks = [];

				// For maintaining conversation context between chunks
				let conversationHistory = null;

				// Reset cancellation flag at start of new processing
				isCancellationRequested = false;

				// Process each chunk one by one
				for (let i = 0; i < totalChunks; i++) {
					// Check for cancellation before processing each chunk
					if (isCancellationRequested) {
						console.log(
							`[processContentInChunks] Cancellation requested at chunk ${
								i + 1
							}/${totalChunks}`
						);
						if (tabId) {
							browser.tabs
								.sendMessage(tabId, {
									action: "processingCancelled",
									processedChunks: results.length,
									remainingChunks: totalChunks - i,
									totalChunks: totalChunks,
								})
								.catch(console.error);
						}
						break;
					}

					let retryCount = 0;
					let processed = false;

					while (!processed && retryCount < 3) {
						// Check cancellation in retry loop too
						if (isCancellationRequested) {
							console.log(
								`[processContentInChunks] Cancellation during retry`
							);
							break;
						}

						try {
							console.log(
								`Processing chunk ${i + 1}/${totalChunks}`
							);

							// Wait a bit between chunks to avoid rate limiting
							if (i > 0 || retryCount > 0) {
								const delay = 1000 * (retryCount + 1); // Increased delay between retries
								console.log(
									`Waiting ${delay}ms before processing next chunk...`
								);
								await new Promise((resolve) =>
									setTimeout(resolve, delay)
								);
							}

							// Process this chunk
							const chunk = contentChunks[i];
							const partInfo = {
								current: i + 1,
								total: totalChunks,
							};

							// DEBUG: Log chunk content before processing
							console.log(
								`[DEBUG] Chunk ${i} content length: ${
									chunk?.length || 0
								}`
							);
							console.log(
								`[DEBUG] Chunk ${i} first 200 chars: "${chunk?.substring(
									0,
									200
								)}"`
							);
							console.log(
								`[DEBUG] Chunk ${i} is empty: ${
									!chunk || chunk.trim().length === 0
								}`
							);

							// CRITICAL: Validate chunk has actual content before sending
							if (!chunk || chunk.trim().length < 50) {
								console.error(
									`[ERROR] Chunk ${i} is empty or too short (${
										chunk?.length || 0
									} chars). Skipping.`
								);
								throw new Error(
									`Chunk ${i} has no content to process`
								);
							}

							// Process with Gemini, passing conversation history for context
							// NOTE: For first chunk, don't pass conversation history to avoid pollution
							const result = await processContentWithGemini(
								title,
								chunk,
								true,
								partInfo,
								useEmoji,
								i === 0 ? null : conversationHistory, // First chunk always starts fresh
								siteSpecificPrompt
							);

							// Store the result for this chunk
							results.push({
								originalContent: chunk,
								enhancedContent: result.enhancedContent,
								chunkIndex: i,
								processed: true,
							});

							// Update conversation history for next chunk
							conversationHistory = result.conversationHistory;

							// Immediately send this processed chunk back to the content script
							// Include streaming information for progressive updates
							// Must use tabs.sendMessage to reach content scripts
							if (tabId) {
								browser.tabs
									.sendMessage(tabId, {
										action: "chunkProcessed",
										chunkIndex: i,
										totalChunks: totalChunks,
										result: {
											originalContent: chunk,
											enhancedContent:
												result.enhancedContent,
											isResumed: retryCount > 0,
											modelInfo: result.modelInfo,
										},
										isComplete:
											i === totalChunks - 1 &&
											failedChunks.length === 0,
										progressPercent: Math.round(
											((i + 1) / totalChunks) * 100
										),
									})
									.catch((error) =>
										console.error(
											"Error sending chunk result to tab:",
											error
										)
									);
							}

							processed = true;
						} catch (error) {
							console.error(
								`Error processing chunk ${
									i + 1
								}/${totalChunks} (attempt ${retryCount + 1}):`,
								error
							);

							// Check if this is a rate limit error
							const isRateLimitError =
								error.message &&
								(error.message.includes("rate limit") ||
									error.message.includes("quota") ||
									error.message.includes("429"));

							if (isRateLimitError) {
								// Parse retry time from error message if available
								let waitTime = 60000; // Default 1 minute
								const timeMatch =
									error.message.match(/(\d+) seconds/);
								if (timeMatch && timeMatch[1]) {
									waitTime = parseInt(timeMatch[1]) * 1000;
								}

								console.log(
									`Rate limit detected. Waiting ${
										waitTime / 1000
									} seconds before retrying...`
								);

								// Notify the content script about the rate limit and wait
								if (tabId) {
									browser.tabs
										.sendMessage(tabId, {
											action: "chunkError",
											chunkIndex: i,
											totalChunks: totalChunks,
											error: error.message,
											isRateLimit: true,
											waitTime: waitTime,
											retryCount: retryCount,
										})
										.catch((error) =>
											console.error(
												"Error sending rate limit notification:",
												error
											)
										);
								}

								// Wait for the specified time with periodic keep-alive pings
								// to prevent service worker from sleeping during long waits
								const startTime = Date.now();
								while (Date.now() - startTime < waitTime) {
									// Keep alive ping every 25 seconds
									const remainingWait = Math.min(
										25000,
										waitTime - (Date.now() - startTime)
									);
									if (remainingWait > 0) {
										await new Promise((resolve) =>
											setTimeout(resolve, remainingWait)
										);
									}
									// Log to keep the service worker active
									console.log(
										`[Keep-Alive] Rate limit wait: ${Math.round(
											(waitTime -
												(Date.now() - startTime)) /
												1000
										)}s remaining`
									);
								}

								// Increment retry count and try again
								retryCount++;
							} else if (retryCount < 2) {
								// For non-rate limit errors, retry with exponential backoff
								const backoffTime =
									Math.pow(2, retryCount) * 3000;
								console.log(
									`Error processing chunk. Retrying in ${
										backoffTime / 1000
									} seconds...`
								);

								// Notify content script
								if (tabId) {
									browser.tabs
										.sendMessage(tabId, {
											action: "chunkError",
											chunkIndex: i,
											totalChunks: totalChunks,
											error: error.message,
											isRateLimit: false,
											retryCount: retryCount,
										})
										.catch((error) =>
											console.error(
												"Error sending chunk error notification:",
												error
											)
										);
								} // Wait and retry
								await new Promise((resolve) =>
									setTimeout(resolve, backoffTime)
								);
								retryCount++;
							} else {
								// If we've exhausted retries, mark as failed and move on
								failedChunks.push({
									originalContent: contentChunks[i],
									chunkIndex: i,
									error: error.message || "Unknown error",
									processed: false,
								});

								// Notify content script about failure
								if (tabId) {
									browser.tabs
										.sendMessage(tabId, {
											action: "chunkError",
											chunkIndex: i,
											totalChunks: totalChunks,
											error: error.message,
											isRateLimit: false,
											isResumed: false,
											finalFailure: true,
										})
										.catch((error) =>
											console.error(
												"Error sending chunk error notification:",
												error
											)
										);
								}
								processed = true; // Move on to next chunk
							}
						}
					}
				}

				// Notify that all processing is complete
				console.log("All chunks processed. Notifying content script.");

				// Send complete notification to content script
				if (tabId) {
					browser.tabs
						.sendMessage(tabId, {
							action: "allChunksProcessed",
							totalProcessed: results.length,
							totalFailed: failedChunks.length,
							totalChunks: totalChunks,
							failedChunks: failedChunks.map(
								(chunk) => chunk.chunkIndex
							),
							hasPartialContent: results.length > 0,
						})
						.catch((error) =>
							console.error(
								"Error sending completion notification:",
								error
							)
						);
				}

				// Combine results and return
				const combinedResult = {
					originalContent: content,
					enhancedContent: results
						.map((r) => r.enhancedContent)
						.join(""),
					processedChunks: results.length,
					totalChunks: totalChunks,
					failedChunks: failedChunks.length,
					isComplete: failedChunks.length === 0,
					unprocessedContent: failedChunks
						.map((f) => f.originalContent)
						.join(""),
				};

				return combinedResult;
			} catch (error) {
				console.error("Error in chunk processing:", error);
				throw error;
			}
		}

		// Process content with Gemini API
		async function processContentWithGemini(
			title,
			content,
			isPart = false,
			partInfo = null,
			useEmoji = false,
			conversationHistory = null,
			siteSpecificPrompt = ""
		) {
			try {
				// CRITICAL: Validate content exists and has substance
				if (!content || typeof content !== "string") {
					throw new Error("No content provided for enhancement");
				}

				const trimmedContent = content.trim();
				if (trimmedContent.length < 50) {
					throw new Error(
						`Content too short for enhancement (${trimmedContent.length} chars)`
					);
				}

				// Add debugging to verify content is received
				console.log(
					`[processContentWithGemini] Processing content with length: ${
						content?.length || 0
					} characters.`
				);
				console.log(
					`[processContentWithGemini] First 200 chars: "${content?.substring(
						0,
						200
					)}..."`
				);
				console.log(
					`[processContentWithGemini] Last 200 chars: "...${content?.substring(
						content.length - 200
					)}"`
				);

				// Extract and preserve HTML tags like images and game stats boxes before sending to Gemini
				const preservedElements = [];
				const contentWithPlaceholders = content.replace(
					/<img[^>]+>|<iframe[^>]+>|<video[^>]+>|<audio[^>]+>|<source[^>]+>|<div class="game-stats-box">[\s\S]*?<\/div>/gi,
					(match) => {
						const placeholder = `[PRESERVED_ELEMENT_${preservedElements.length}]`;
						preservedElements.push(match);
						return placeholder;
					}
				);

				console.log(
					`Preserved ${preservedElements.length} HTML elements (images and game stats boxes)`
				);

				// Debug log if any game stats boxes were found
				if (preservedElements.length > 0) {
					const gameBoxCount = preservedElements.filter((el) =>
						el.includes('class="game-stats-box"')
					).length;
					if (gameBoxCount > 0) {
						console.log(
							`Found ${gameBoxCount} game stats boxes to preserve`
						);
					}
				}

				// Load latest config directly from storage for most up-to-date settings
				currentConfig = await initConfig();

				// Check if we have any API key (primary or backup)
				const allKeys = [
					currentConfig.apiKey,
					...(currentConfig.backupApiKeys || []),
				].filter((k) => k && k.trim());
				if (allKeys.length === 0) {
					throw new Error(
						"API key is missing. Please set it in the extension popup."
					);
				}

				// Log part information if processing in parts
				if (isPart && partInfo) {
					console.log(
						`Processing "${title}" - Part ${partInfo.current}/${partInfo.total} with Gemini (${contentWithPlaceholders.length} characters)`
					);
				} else {
					console.log(
						`Processing "${title}" with Gemini (${contentWithPlaceholders.length} characters)`
					);
				}

				// Get model endpoint from settings - use the selected model endpoint or fall back to default
				const modelEndpoint =
					currentConfig.modelEndpoint ||
					`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

				console.log(`Using model endpoint: ${modelEndpoint}`);

				// Get model name for logging
				const modelName =
					currentConfig.selectedModelId ||
					modelEndpoint.split("/").pop().split(":")[0];
				console.log(`Using model: ${modelName}`);

				// Store model info to pass back to content script
				const modelInfo = {
					name: modelName,
					provider: modelName.includes("gemini")
						? "Google Gemini"
						: modelName.includes("gpt")
						? "OpenAI"
						: "AI",
				};

				// Get emoji setting - from parameter or config
				const shouldUseEmoji =
					useEmoji !== undefined ? useEmoji : currentConfig.useEmoji;
				if (shouldUseEmoji) {
					console.log(
						"Emoji mode is enabled - adding emojis to dialogue"
					);
				}

				// Prepare the request for Gemini API with the latest prompt from settings
				let promptPrefix = currentConfig.defaultPrompt;

				// If processing a part, add special instructions
				if (isPart && partInfo) {
					promptPrefix += `\n\nNote: This is part ${partInfo.current} of ${partInfo.total} parts. Please enhance this part while maintaining consistency with other parts.`;
				}

				// Add emoji instructions if enabled
				if (shouldUseEmoji) {
					promptPrefix += `\n\nAdditional instruction: Add appropriate emojis next to dialogues to enhance emotional expressions. Place the emoji immediately after the quotation marks that end the dialogue. For example: "I'm so happy!" 😊 she said. Or "This is terrible." 😠 he growled. Choose emojis that fit the emotion being expressed in the dialogue.`;
				}

				// Combine base prompt, permanent prompt, title, and content
				const fullPrompt = combinePrompts(
					promptPrefix,
					currentConfig.permanentPrompt,
					siteSpecificPrompt // Use the site-specific prompt parameter
				);

				// Create the full system instruction
				const systemInstruction = `${fullPrompt}\n\n### Title:\n${title}`;

				// Create request body with proper system instruction format for Gemini
				let requestContents = [];

				// If we have conversation history, validate and use it to maintain context
				if (conversationHistory && conversationHistory.length > 0) {
					// Filter out any invalid entries (empty text, wrong roles)
					const validHistory = conversationHistory.filter((entry) => {
						if (
							!entry ||
							!entry.role ||
							!entry.parts ||
							!entry.parts[0]
						)
							return false;
						if (
							!entry.parts[0].text ||
							entry.parts[0].text.trim() === ""
						)
							return false;
						// Gemini only accepts 'user' and 'model' roles
						if (entry.role !== "user" && entry.role !== "model") {
							// Convert 'assistant' to 'model'
							if (entry.role === "assistant") {
								entry.role = "model";
							} else {
								return false;
							}
						}
						return true;
					});

					// Ensure alternating roles (user, model, user, model...)
					const cleanedHistory = [];
					let lastRole = null;
					for (const entry of validHistory) {
						// Skip if same role as previous (no consecutive same roles)
						if (entry.role === lastRole) continue;
						cleanedHistory.push(entry);
						lastRole = entry.role;
					}

					// If history ends with 'user', we need to ensure we don't add another user message
					// The last entry should be 'model' before we add a new 'user' message
					if (
						cleanedHistory.length > 0 &&
						cleanedHistory[cleanedHistory.length - 1].role ===
							"user"
					) {
						// Remove the last user message since we're about to add a new one
						cleanedHistory.pop();
					}

					requestContents = cleanedHistory;

					// Add the current content as a new user message
					requestContents.push({
						role: "user",
						parts: [
							{
								text: `### Content to Enhance:\n${contentWithPlaceholders}`,
							},
						],
					});
				} else {
					// Start a new conversation with proper user message
					requestContents = [
						{
							role: "user",
							parts: [
								{
									text: `### Content to Enhance:\n${contentWithPlaceholders}`,
								},
							],
						},
					];
				}

				// Create the request body with system_instruction separate from contents
				const requestBody = {
					system_instruction: {
						parts: [
							{
								text: systemInstruction,
							},
						],
					},
					contents: requestContents,
					generationConfig: {
						temperature: currentConfig.temperature || 0.7,
						maxOutputTokens: currentConfig.maxOutputTokens || 8192,
						topP:
							currentConfig.topP !== undefined
								? currentConfig.topP
								: 0.95,
						topK:
							currentConfig.topK !== undefined
								? currentConfig.topK
								: 40,
					},
				};

				// Log the request if debug mode is enabled
				if (currentConfig.debugMode) {
					console.log("Gemini API Request:", {
						url: modelEndpoint,
						requestBody: JSON.parse(JSON.stringify(requestBody)),
					});
				}

				// Make the API call with automatic key rotation
				const { response, responseData, keyUsed } =
					await makeApiCallWithRotation(
						modelEndpoint,
						requestBody,
						currentConfig
					);

				// Log the response if debug mode is enabled
				if (currentConfig.debugMode) {
					console.log("Gemini API Response:", responseData);
					if (keyUsed > 0) {
						console.log(`Used backup API key ${keyUsed}`);
					}
				}

				// Handle other API errors
				if (!response.ok) {
					let errorMessage =
						responseData.error?.message ||
						`API Error: ${response.status} ${response.statusText}`;

					// Provide helpful error messages for common issues
					if (
						errorMessage.includes("exceeds the maximum") ||
						errorMessage.includes("token limit") ||
						errorMessage.includes("context length") ||
						errorMessage.includes("too long")
					) {
						errorMessage = `Content exceeds model's context limit. The chapter may be too long. Try using a model with larger context (like Gemini Pro) or enable chunking in settings. Original error: ${errorMessage}`;
					} else if (
						errorMessage.includes("invalid") &&
						errorMessage.includes("key")
					) {
						errorMessage = `Invalid API key. Please check your API key in the extension settings. Original error: ${errorMessage}`;
					}

					throw new Error(errorMessage);
				}

				// Check for content safety blocks
				if (
					responseData.candidates &&
					responseData.candidates.length > 0
				) {
					const candidate = responseData.candidates[0];

					// Check if content was blocked by safety filters
					if (
						candidate.finishReason === "SAFETY" ||
						candidate.finishReason === "BLOCKED_REASON_UNSPECIFIED"
					) {
						console.error(
							"Content blocked by safety filters:",
							candidate.safetyRatings
						);
						throw new Error(
							"Content was blocked by Gemini's safety filters. The content may contain sensitive themes. Try adjusting your content or prompt."
						);
					}

					// Check if content is missing
					if (
						!candidate.content ||
						!candidate.content.parts ||
						candidate.content.parts.length === 0
					) {
						console.error(
							"No content parts in response:",
							candidate
						);
						throw new Error(
							"Gemini returned no content. This may be due to safety filters or an API issue."
						);
					}
				}

				// Extract the generated text
				if (
					responseData.candidates &&
					responseData.candidates.length > 0
				) {
					let generatedText =
						responseData.candidates[0].content?.parts[0]?.text;

					// Capture conversation history for future chunks
					const updatedConversationHistory = [...requestContents];

					// Add the model response to conversation history (Gemini uses 'model' not 'assistant')
					if (generatedText) {
						updatedConversationHistory.push({
							role: "model",
							parts: [{ text: generatedText }],
						});
					}

					if (generatedText) {
						// Restore preserved HTML elements if they exist
						if (preservedElements && preservedElements.length > 0) {
							console.log(
								`Restoring ${preservedElements.length} HTML elements`
							);
							preservedElements.forEach((element, index) => {
								const placeholder = `[PRESERVED_ELEMENT_${index}]`;
								generatedText = generatedText.replace(
									new RegExp(placeholder, "g"),
									element
								);
							});

							// Log restoration of game stats boxes if any were present
							const gameBoxCount = preservedElements.filter(
								(el) => el.includes('class="game-stats-box"')
							).length;
							if (gameBoxCount > 0) {
								console.log(
									`Restored ${gameBoxCount} game stats boxes in processed text`
								);
							}
						}

						return {
							originalContent: content,
							enhancedContent: generatedText,
							modelInfo: modelInfo, // Include model info in the response
							conversationHistory:
								updatedConversationHistory.slice(-4), // Keep last 4 messages for context
						};
					}
				}

				throw new Error(
					"No valid response content returned from Gemini API"
				);
			} catch (error) {
				console.error("Gemini API error:", error);
				throw error;
			}
		}

		// Summarize content with Gemini API
		async function summarizeContentWithGemini(
			title,
			content,
			isPart = false,
			partInfo = null,
			isShort = false
		) {
			try {
				// Load latest config
				currentConfig = await initConfig();

				// Check if we have any API key (primary or backup)
				const allKeys = [
					currentConfig.apiKey,
					...(currentConfig.backupApiKeys || []),
				].filter((k) => k && k.trim());
				if (allKeys.length === 0) {
					throw new Error(
						"API key is missing. Please set it in the extension popup."
					);
				}

				const summaryType = isShort ? "short" : "long";
				if (isPart && partInfo) {
					console.log(
						`Creating ${summaryType} summary of "${title}" - Part ${partInfo.current}/${partInfo.total} with Gemini (${content.length} characters)`
					);
				} else {
					console.log(
						`Creating ${summaryType} summary of "${title}" with Gemini (${content.length} characters)`
					);
				}

				const modelEndpoint =
					currentConfig.modelEndpoint ||
					`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

				// Use the appropriate summary prompt based on isShort flag
				let summarizationBasePrompt;
				if (isShort) {
					summarizationBasePrompt =
						currentConfig.shortSummaryPrompt ||
						DEFAULT_SHORT_SUMMARY_PROMPT;
				} else {
					summarizationBasePrompt =
						currentConfig.summaryPrompt || DEFAULT_SUMMARY_PROMPT;
				}

				// If processing a part, add special instructions
				if (isPart && partInfo) {
					summarizationBasePrompt += `\n\nNote: This is part ${partInfo.current} of ${partInfo.total} parts. Please summarize this part while maintaining consistency with other parts.`;
				}

				// Combine base summarization prompt, permanent prompt, title, and content
				const fullSummarizationPrompt = combinePrompts(
					summarizationBasePrompt,
					currentConfig.permanentPrompt,
					"" // Site-specific prompt can be added here if needed
				);

				// Create proper role-based content for summarization
				const requestContents = [
					{
						role: "user",
						parts: [
							{
								text: `### Content to Summarize:\n${content}`,
							},
						],
					},
				];

				// Use smaller output tokens for short summaries
				const maxOutputTokens = isShort ? 512 : 2048;

				const requestBody = {
					system_instruction: {
						parts: [
							{
								text: `${fullSummarizationPrompt}\n\n### Title:\n${title}`,
							},
						],
					},
					contents: requestContents,
					generationConfig: {
						temperature: 0.5, // Lower temperature for more focused summary
						maxOutputTokens: maxOutputTokens,
						topP:
							currentConfig.topP !== undefined
								? currentConfig.topP
								: 0.95,
						topK:
							currentConfig.topK !== undefined
								? currentConfig.topK
								: 40,
					},
				};

				if (currentConfig.debugMode) {
					console.log("Gemini Summarization Request:", {
						url: modelEndpoint,
						requestBody: JSON.parse(JSON.stringify(requestBody)),
					});
				}

				// Make the API call with automatic key rotation
				const { response, responseData, keyUsed } =
					await makeApiCallWithRotation(
						modelEndpoint,
						requestBody,
						currentConfig
					);

				if (currentConfig.debugMode) {
					console.log("Gemini Summarization Response:", responseData);
					if (keyUsed > 0) {
						console.log(`Used backup API key ${keyUsed}`);
					}
				}

				if (!response.ok) {
					const errorMessage =
						responseData.error?.message ||
						`API Error: ${response.status} ${response.statusText}`;
					throw new Error(errorMessage);
				}

				if (
					responseData.candidates &&
					responseData.candidates.length > 0
				) {
					const generatedSummary =
						responseData.candidates[0].content?.parts[0]?.text;
					if (generatedSummary) {
						return generatedSummary;
					}
				}

				throw new Error("No valid summary returned from Gemini API");
			} catch (error) {
				console.error("Gemini API summarization error:", error);
				throw error;
			}
		}

		// Combine partial summaries into a single summary
		async function combinePartialSummaries(
			title,
			partSummaries,
			partCount
		) {
			try {
				// Load latest config
				currentConfig = await initConfig();

				// Check if we have any API key (primary or backup)
				const allKeys = [
					currentConfig.apiKey,
					...(currentConfig.backupApiKeys || []),
				].filter((k) => k && k.trim());
				if (allKeys.length === 0) {
					throw new Error(
						"API key is missing. Please set it in the extension popup."
					);
				}

				console.log(
					`Combining ${partCount} partial summaries for "${title}" with Gemini`
				);

				const modelEndpoint =
					currentConfig.modelEndpoint ||
					`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

				// Use the summary prompt from settings
				const combinationBasePrompt =
					"Please combine the following partial summaries into a coherent, comprehensive summary of the entire chapter:";

				// Combine base combination prompt, permanent prompt, title, and partial summaries
				const fullCombinationPrompt = combinePrompts(
					combinationBasePrompt,
					currentConfig.permanentPrompt,
					"" // Site-specific prompt can be added here if needed
				);

				// Create full content with all part summaries
				const allPartSummaries = partSummaries
					.map(
						(summary, index) =>
							`Part ${index + 1}/${partCount}:\n${summary}`
					)
					.join("\n\n");

				// Create proper role-based content for summary combination
				const requestContents = [
					{
						role: "user",
						parts: [
							{
								text: `### Partial Summaries:\n${allPartSummaries}`,
							},
						],
					},
				];

				const requestBody = {
					system_instruction: {
						parts: [
							{
								text: `${fullCombinationPrompt}\n\n### Title:\n${title}`,
							},
						],
					},
					contents: requestContents,
					generationConfig: {
						temperature: 0.5, // Lower temperature for more focused summary
						maxOutputTokens: 512, // Limit summary length
						topP:
							currentConfig.topP !== undefined
								? currentConfig.topP
								: 0.95,
						topK:
							currentConfig.topK !== undefined
								? currentConfig.topK
								: 40,
					},
				};

				if (currentConfig.debugMode) {
					console.log("Gemini Combination Request:", {
						url: modelEndpoint,
						requestBody: JSON.parse(JSON.stringify(requestBody)),
					});
				}

				// Make the API call with automatic key rotation
				const { response, responseData, keyUsed } =
					await makeApiCallWithRotation(
						modelEndpoint,
						requestBody,
						currentConfig
					);

				if (currentConfig.debugMode) {
					console.log("Gemini Combination Response:", responseData);
					if (keyUsed > 0) {
						console.log(`Used backup API key ${keyUsed}`);
					}
				}

				if (!response.ok) {
					const errorMessage =
						responseData.error?.message ||
						`API Error: ${response.status} ${response.statusText}`;
					throw new Error(errorMessage);
				}

				if (
					responseData.candidates &&
					responseData.candidates.length > 0
				) {
					const combinedSummary =
						responseData.candidates[0].content?.parts[0]?.text;
					if (combinedSummary) {
						return combinedSummary;
					}
				}

				throw new Error(
					"No valid combined summary returned from Gemini API"
				);
			} catch (error) {
				console.error("Gemini API combination error:", error);
				throw error;
			}
		}

		// Listen for storage changes to ensure our config is always up-to-date
		browser.storage.onChanged.addListener(async (changes) => {
			// Refresh our configuration when storage changes
			currentConfig = await initConfig();
			console.log("Configuration updated due to storage changes");

			// Log the key that changed
			const changedKeys = Object.keys(changes);
			console.log("Changed settings:", changedKeys);
		});

		// Setup browser action (icon) click handler
		browser.action.onClicked.addListener(() => {
			console.log("Browser action clicked");
			// Open the simple popup directly if popup doesn't open
			browser.windows
				.create({
					url: browser.runtime.getURL("popup/popup.html"),
					type: "popup",
					width: 400,
					height: 550,
				})
				.catch((error) => {
					console.error("Error opening popup:", error);
				});
		});

		// Handle keyboard commands
		browser.commands.onCommand.addListener(async (command) => {
			console.log("Command received:", command);

			switch (command) {
				case "open-library":
					browser.tabs.create({
						url: browser.runtime.getURL("library/library.html"),
					});
					break;

				case "enhance-page":
					// Send enhance message to active tab
					try {
						const [activeTab] = await browser.tabs.query({
							active: true,
							currentWindow: true,
						});
						if (activeTab) {
							browser.tabs.sendMessage(activeTab.id, {
								action: "enhanceChapter",
							});
						}
					} catch (error) {
						console.error("Error sending enhance command:", error);
					}
					break;

				case "summarize-page":
					// Send summarize message to active tab
					try {
						const [activeTab] = await browser.tabs.query({
							active: true,
							currentWindow: true,
						});
						if (activeTab) {
							browser.tabs.sendMessage(activeTab.id, {
								action: "summarizeChapter",
							});
						}
					} catch (error) {
						console.error(
							"Error sending summarize command:",
							error
						);
					}
					break;
			}
		});

		// Initialize when background script loads
		initConfig()
			.then((config) => {
				currentConfig = config;
				console.log("Configuration loaded:", config);
			})
			.catch((error) =>
				console.error("Config initialization error:", error)
			);

		// Create context menu items for right-click on extension icon
		try {
			// Remove existing menus first to avoid duplicates on reload
			browser.contextMenus
				.removeAll()
				.then(() => {
					// Add Novel Library shortcut
					browser.contextMenus.create({
						id: "openNovelLibrary",
						title: "📚 Open Novel Library",
						contexts: ["action"], // Shows when right-clicking extension icon
					});

					// Add separator
					browser.contextMenus.create({
						id: "separator1",
						type: "separator",
						contexts: ["action"],
					});

					// Add quick settings access
					browser.contextMenus.create({
						id: "openSettings",
						title: "⚙️ Settings",
						contexts: ["action"],
					});

					console.log("Context menus created successfully");
				})
				.catch((err) =>
					console.error("Error creating context menus:", err)
				);
		} catch (error) {
			console.error("Context menus API not available:", error);
		}

		// Handle context menu clicks
		browser.contextMenus.onClicked.addListener((info, tab) => {
			switch (info.menuItemId) {
				case "openNovelLibrary":
					browser.tabs.create({
						url: browser.runtime.getURL("library/library.html"),
					});
					break;
				case "openSettings":
					browser.tabs.create({
						url: browser.runtime.getURL("popup/popup.html"),
					});
					break;
			}
		});

		// Log the extension startup
		console.log("Ranobe Gemini extension initialized");

		// Fallback heartbeat using setInterval (less reliable in MV3, but works as backup)
		// Primary keep-alive is handled by chrome.alarms above
		setInterval(() => {
			// Only log occasionally to reduce noise
			if (Math.random() < 0.1) {
				console.log(
					"[Fallback] Background script heartbeat (setInterval)"
				);
			}
		}, 25000);
	} catch (error) {
		console.error("Error importing constants in background script:", error);

		// Ensure browser API is available in catch block
		if (typeof browser === "undefined" && typeof chrome !== "undefined") {
			globalThis.browser = chrome;
		}

		// Defining fallback constants
		const DEFAULT_PROMPT = `Please enhance this novel chapter translation with the following improvements: [...]`;
		const DEFAULT_MODEL_ENDPOINT =
			"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
		const DEFAULT_PERMANENT_PROMPT = `Ensure the translation maintains cultural nuances and original tone.`;
		const DEFAULT_SUMMARY_PROMPT = `Please provide a concise summary of the following novel chapter content. Focus on the main plot points and character interactions. Keep the summary brief and easy to understand.`;
		const DEFAULT_SHORT_SUMMARY_PROMPT = `Provide a brief 2-3 paragraph summary focusing on the main events and key character moments.`;

		console.log("Ranobe Gemini: Background script loaded");

		// Global configuration
		let currentConfig = null;

		// Initialize configuration
		async function initConfig() {
			try {
				// Get settings directly from storage
				const api = typeof browser !== "undefined" ? browser : chrome;
				const data = await api.storage.local.get();
				return {
					apiKey: data.apiKey || "",
					backupApiKeys: data.backupApiKeys || [],
					apiKeyRotation: data.apiKeyRotation || "failover",
					currentApiKeyIndex: data.currentApiKeyIndex || 0,
					defaultPrompt: data.defaultPrompt || DEFAULT_PROMPT,
					summaryPrompt: data.summaryPrompt || DEFAULT_SUMMARY_PROMPT,
					shortSummaryPrompt:
						data.shortSummaryPrompt || DEFAULT_SHORT_SUMMARY_PROMPT,
					permanentPrompt:
						data.permanentPrompt || DEFAULT_PERMANENT_PROMPT,
					temperature: data.temperature || 0.7,
					topP: data.topP !== undefined ? data.topP : 0.95,
					topK: data.topK !== undefined ? data.topK : 40,
					maxOutputTokens: data.maxOutputTokens || 8192,
					debugMode: data.debugMode || false,
					modelEndpoint: data.modelEndpoint || DEFAULT_MODEL_ENDPOINT,
					chunkingEnabled: data.chunkingEnabled !== false,
					chunkSize: data.chunkSize || 20000,
					chunkThreshold: data.chunkSize || 20000,
					useEmoji: data.useEmoji || false,
					fontSize: data.fontSize || 100, // Font size percentage (default 100%)
				};
			} catch (error) {
				console.error("Error loading configuration:", error);
				return {
					apiKey: "",
					backupApiKeys: [],
					apiKeyRotation: "failover",
					currentApiKeyIndex: 0,
					defaultPrompt:
						"Please fix grammar and improve readability of this text while maintaining original meaning.",
					summaryPrompt: DEFAULT_SUMMARY_PROMPT,
					shortSummaryPrompt:
						DEFAULT_SHORT_SUMMARY_PROMPT ||
						"Provide a brief 2-3 paragraph summary.",
					permanentPrompt: DEFAULT_PERMANENT_PROMPT,
					temperature: 0.7,
					topP: 0.95,
					topK: 40,
					maxOutputTokens: 8192,
					chunkingEnabled: true,
					chunkSize: 20000,
					chunkThreshold: 20000,
					useEmoji: false,
					fontSize: 100,
				};
			}
		}

		// Get the current API key based on rotation strategy
		function getCurrentApiKey(config, forceNext = false) {
			const allKeys = [config.apiKey, ...config.backupApiKeys].filter(
				(k) => k && k.trim()
			);
			if (allKeys.length === 0) return null;

			if (config.apiKeyRotation === "round-robin") {
				let index = config.currentApiKeyIndex || 0;
				if (forceNext) {
					index = (index + 1) % allKeys.length;
					const api =
						typeof browser !== "undefined" ? browser : chrome;
					api.storage.local.set({ currentApiKeyIndex: index });
				}
				return { key: allKeys[index], index, total: allKeys.length };
			} else {
				return { key: allKeys[0], index: 0, total: allKeys.length };
			}
		}

		// Get next API key for failover
		async function getNextApiKey(config, currentIndex) {
			const allKeys = [config.apiKey, ...config.backupApiKeys].filter(
				(k) => k && k.trim()
			);
			const nextIndex = currentIndex + 1;
			if (nextIndex >= allKeys.length) {
				return null;
			}
			return {
				key: allKeys[nextIndex],
				index: nextIndex,
				total: allKeys.length,
			};
		}

		// Helper function to combine prompts for Gemini
		function combinePrompts(
			mainPrompt,
			permanentPrompt,
			siteSpecificPrompt = ""
		) {
			let combinedPrompt = mainPrompt;

			// Add site-specific prompt if available
			if (siteSpecificPrompt && siteSpecificPrompt.length > 0) {
				combinedPrompt +=
					"\n\n## Site-Specific Context:\n" + siteSpecificPrompt;
			}

			// Add permanent prompt if available
			if (permanentPrompt && permanentPrompt.length > 0) {
				combinedPrompt +=
					"\n\n## Always Follow These Instructions:\n" +
					permanentPrompt;
			}

			return combinedPrompt;
		}

		// Get model information based on current configuration
		async function getModelInfo() {
			try {
				// Load latest config
				currentConfig = await initConfig();

				// Default values
				let maxContextSize = 16000; // Default for gemini-2.5-flash
				let maxOutputTokens = currentConfig.maxOutputTokens || 8192;

				// Model-specific values
				const modelId =
					currentConfig.selectedModelId ||
					currentConfig.modelEndpoint
						?.split("/")
						.pop()
						.split(":")[0] ||
					"gemini-2.5-flash";

				// Set appropriate context sizes based on model
				if (modelId.includes("gemini-2.5-pro")) {
					maxContextSize = 1000000; // 1M token context for Gemini 2.5 Pro
				} else if (modelId.includes("gemini-2.5-flash")) {
					maxContextSize = 16000; // 16k token context for Gemini 2.5 Flash
				} else if (modelId.includes("gemini-2.0-flash")) {
					maxContextSize = 32000; // 32k token context for Gemini 2.0 Flash
				}

				// Get font size setting (default 100%)
				const fontSize = currentConfig.fontSize || 100;

				return {
					modelId,
					maxContextSize,
					maxOutputTokens,
					fontSize,
				};
			} catch (error) {
				console.error("Error determining model info:", error);
				// Return safe defaults
				return {
					modelId: "unknown",
					maxContextSize: 16000,
					maxOutputTokens: 8192,
					fontSize: 100,
				};
			}
		}
	}
})();
