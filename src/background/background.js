// Background script for Ranobe Gemini
// Use a try-catch for the import to handle potential errors
try {
	// Use a dynamic import with browser.runtime.getURL
	const constantsModule = await import(
		browser.runtime.getURL("utils/constants.js")
	);
	const {
		DEFAULT_PROMPT,
		DEFAULT_MODEL_ENDPOINT,
		DEFAULT_PERMANENT_PROMPT,
		DEFAULT_SUMMARY_PROMPT,
	} = constantsModule;

	console.log("Ranobe Gemini: Background script loaded");

	// Global configuration
	let currentConfig = null;

	// Initialize configuration
	async function initConfig() {
		try {
			// Get settings directly from storage
			const data = await browser.storage.local.get();
			return {
				apiKey: data.apiKey || "",
				defaultPrompt: data.defaultPrompt || DEFAULT_PROMPT,
				summaryPrompt: data.summaryPrompt || DEFAULT_SUMMARY_PROMPT, // Load summary prompt
				permanentPrompt:
					data.permanentPrompt || DEFAULT_PERMANENT_PROMPT, // Load permanent prompt
				temperature: data.temperature || 0.7,
				maxOutputTokens: data.maxOutputTokens || 8192,
				debugMode: data.debugMode || false,
				modelEndpoint: data.modelEndpoint || DEFAULT_MODEL_ENDPOINT,
				chunkingEnabled: data.chunkingEnabled !== false, // Default to true
				chunkSize: data.chunkSize || 12000, // Default chunk size
				useEmoji: data.useEmoji || false, // Load emoji setting
			};
		} catch (error) {
			console.error("Error loading configuration:", error);
			return {
				apiKey: "",
				defaultPrompt:
					"Please fix grammar and improve readability of this text while maintaining original meaning.",
				summaryPrompt: DEFAULT_SUMMARY_PROMPT, // Default summary prompt on error
				permanentPrompt: DEFAULT_PERMANENT_PROMPT, // Default permanent prompt on error
				temperature: 0.7,
				maxOutputTokens: 8192,
				chunkingEnabled: true,
				chunkSize: 12000,
				useEmoji: false,
			};
		}
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
				"\n\n## Always Follow These Instructions:\n" + permanentPrompt;
		}

		return combinedPrompt;
	}

	// Handle messages from content script
	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
		console.log("Background received message:", message);

		if (message.action === "ping") {
			sendResponse({
				success: true,
				message: "Background script is alive",
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
							error.message || "Unknown error getting model info",
						// Provide safe defaults
						maxContextSize: 16000,
						maxOutputTokens: 8192,
					});
				});
			return true;
		}

		if (message.action === "processWithGemini") {
			// For longer content, use chunk processing with progressive rendering
			if (message.content && message.content.length > 4000) {
				processContentInChunks(
					message.title,
					message.content,
					message.useEmoji
				)
					.then((result) => {
						sendResponse({ success: true, result: result });
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
				processContentWithGemini(
					message.title,
					message.content,
					message.isPart,
					message.partInfo,
					message.useEmoji
				)
					.then((result) => {
						sendResponse({ success: true, result: result });
					})
					.catch((error) => {
						console.error("Error processing with Gemini:", error);
						sendResponse({
							success: false,
							error:
								error.message ||
								"Unknown error processing with Gemini",
						});
					});
			}
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
							const chunkIndex = message.startChunkIndex + i;
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
							const result = await processContentWithGemini(
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
							browser.runtime
								.sendMessage({
									action: "chunkProcessed",
									chunkIndex: chunkIndex,
									totalChunks: message.totalChunks,
									result: {
										originalContent: chunk,
										enhancedContent: result.enhancedContent,
									},
									isResumed: true,
									isComplete:
										i === totalChunksRemaining - 1 &&
										failedChunks.length === 0,
								})
								.catch((error) =>
									console.error(
										"Error sending resumed chunk result:",
										error
									)
								);
						} catch (error) {
							console.error(
								`Error processing resumed chunk:`,
								error
							);

							const chunkIndex = message.startChunkIndex + i;
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
								browser.runtime
									.sendMessage({
										action: "chunkError",
										chunkIndex: chunkIndex,
										totalChunks: message.totalChunks,
										error: error.message,
										isRateLimit: true,
										remainingChunks:
											message.totalChunks - chunkIndex,
										unprocessedChunks:
											remainingChunks.slice(i),
										isResumed: true,
									})
									.catch((error) =>
										console.error(
											"Error sending rate limit notification during resume:",
											error
										)
									);

								// Stop processing remaining chunks
								break;
							} else {
								// For other errors, notify but continue processing
								browser.runtime
									.sendMessage({
										action: "chunkError",
										chunkIndex: chunkIndex,
										totalChunks: message.totalChunks,
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

					// Notify that all resumed processing is complete
					browser.runtime
						.sendMessage({
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

		if (message.action === "summarizeWithGemini") {
			summarizeContentWithGemini(
				message.title,
				message.content,
				message.isPart,
				message.partInfo
			)
				.then((summary) => {
					sendResponse({ success: true, summary: summary });
				})
				.catch((error) => {
					console.error("Error summarizing with Gemini:", error);
					sendResponse({
						success: false,
						error:
							error.message ||
							"Unknown error summarizing with Gemini",
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
					sendResponse({ success: true, combinedSummary: summary });
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
	});

	// Get model information based on current configuration
	async function getModelInfo() {
		try {
			// Load latest config
			currentConfig = await initConfig();

			// Default values
			let maxContextSize = 16000; // Default for gemini-1.5-flash
			let maxOutputTokens = currentConfig.maxOutputTokens || 8192;

			// Model-specific values
			const modelId =
				currentConfig.selectedModelId ||
				currentConfig.modelEndpoint?.split("/").pop().split(":")[0] ||
				"gemini-1.5-flash";

			// Set appropriate context sizes based on model
			if (modelId.includes("gemini-1.5-pro")) {
				maxContextSize = 1000000; // 1M token context for Gemini 1.5 Pro
			} else if (modelId.includes("gemini-1.5-flash")) {
				maxContextSize = 16000; // 16k token context for Gemini 1.5 Flash
			} else if (modelId.includes("gemini-2.0-flash")) {
				maxContextSize = 32000; // 32k token context for Gemini 2.0 Flash
			}

			return {
				modelId,
				maxContextSize,
				maxOutputTokens,
			};
		} catch (error) {
			console.error("Error determining model info:", error);
			// Return safe defaults
			return {
				modelId: "unknown",
				maxContextSize: 16000,
				maxOutputTokens: 8192,
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
	function splitContentForProcessing(content, maxChunkSize = 12000) {
		// First try to split on paragraph markers
		let chunks = [];
		let paragraphs = content.split(/\n\s*\n/);
		let currentChunk = "";

		// Aim for chunks of approximately 4000 words (~20,000 characters)
		const targetWordCount = 4000;
		const approxCharsPerWord = 5;
		const targetChunkSize = targetWordCount * approxCharsPerWord;

		// Use either the target size or the provided max size, whichever is smaller
		const effectiveMaxSize = Math.min(maxChunkSize, targetChunkSize);

		console.log(
			`Splitting content with target size of ~${effectiveMaxSize} characters (${targetWordCount} words)`
		);

		for (const paragraph of paragraphs) {
			// If adding this paragraph would exceed the limit, finalize the current chunk
			if (
				currentChunk.length + paragraph.length + 2 > effectiveMaxSize &&
				currentChunk.length > 0
			) {
				chunks.push(currentChunk);
				currentChunk = paragraph;
			} else {
				// Otherwise add it to the current chunk
				if (currentChunk.length > 0) {
					currentChunk += "\n\n" + paragraph;
				} else {
					currentChunk = paragraph;
				}
			}
		}

		// Add the final chunk if there's anything left
		if (currentChunk.length > 0) {
			chunks.push(currentChunk);
		}

		// If we have no chunks or only one chunk, return the original content
		if (chunks.length <= 1) {
			return [content];
		}

		console.log(
			`Split content into ${chunks.length} chunks for processing`
		);
		return chunks;
	}

	// Process content in chunks, handling one at a time with rate limit awareness
	async function processContentInChunks(
		title,
		content,
		useEmoji = false,
		siteSpecificPrompt = ""
	) {
		try {
			// Load latest config directly from storage for most up-to-date settings
			currentConfig = await initConfig();

			// Check if chunking is enabled
			if (!currentConfig.chunkingEnabled) {
				console.log(
					"Chunking is disabled. Processing content as a single piece."
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

			// Get or use default chunk size (in characters)
			const chunkSize = currentConfig.chunkSize || 12000;
			console.log(`Using chunk size of ${chunkSize} characters`);

			// Only split if content exceeds the chunk size
			if (content.length <= chunkSize) {
				console.log(
					"Content is small enough to process as a single piece."
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

			// Split content for processing - improved method with better chunking
			const contentChunks = splitContentForProcessing(content, chunkSize);
			const totalChunks = contentChunks.length;

			console.log(`Processing content in ${totalChunks} chunks`);

			// Array to store results for each chunk
			let results = [];
			let failedChunks = [];

			// For maintaining conversation context between chunks
			let conversationHistory = null;

			// Process each chunk one by one
			for (let i = 0; i < totalChunks; i++) {
				let retryCount = 0;
				let processed = false;

				while (!processed && retryCount < 3) {
					try {
						console.log(`Processing chunk ${i + 1}/${totalChunks}`);

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
						const partInfo = { current: i + 1, total: totalChunks };

						// Process with Gemini, passing conversation history for context
						const result = await processContentWithGemini(
							title,
							chunk,
							true,
							partInfo,
							useEmoji,
							conversationHistory,
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
						browser.runtime
							.sendMessage({
								action: "chunkProcessed",
								chunkIndex: i,
								totalChunks: totalChunks,
								result: {
									originalContent: chunk,
									enhancedContent: result.enhancedContent,
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
									"Error sending chunk result:",
									error
								)
							);

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
							browser.runtime
								.sendMessage({
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

							// Wait for the specified time
							await new Promise((resolve) =>
								setTimeout(resolve, waitTime)
							);

							// Increment retry count and try again
							retryCount++;
						} else if (retryCount < 2) {
							// For non-rate limit errors, retry with exponential backoff
							const backoffTime = Math.pow(2, retryCount) * 3000;
							console.log(
								`Error processing chunk. Retrying in ${
									backoffTime / 1000
								} seconds...`
							);

							// Notify content script
							browser.runtime
								.sendMessage({
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

							// Wait and retry
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
							browser.runtime
								.sendMessage({
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

							processed = true; // Move on to next chunk
						}
					}
				}
			}

			// Notify that all processing is complete
			console.log("All chunks processed. Notifying content script.");

			// Send complete notification to content script
			browser.runtime
				.sendMessage({
					action: "allChunksProcessed",
					totalProcessed: results.length,
					totalFailed: failedChunks.length,
					totalChunks: totalChunks,
					failedChunks: failedChunks.map((chunk) => chunk.chunkIndex),
					hasPartialContent: results.length > 0,
				})
				.catch((error) =>
					console.error(
						"Error sending completion notification:",
						error
					)
				);

			// Combine results and return
			const combinedResult = {
				originalContent: content,
				enhancedContent: results.map((r) => r.enhancedContent).join(""),
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
			// Add debugging to verify content is received
			console.log(
				`Processing content with length: ${
					content?.length || 0
				} characters. First 100 chars: ${content?.substring(0, 100)}...`
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

			// Check if we have an API key
			if (!currentConfig.apiKey) {
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

			// If we have conversation history, use it to maintain context
			if (conversationHistory && conversationHistory.length > 0) {
				requestContents = conversationHistory;

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
					topP: 0.95,
					topK: 40,
				},
			};

			// Log the request if debug mode is enabled
			if (currentConfig.debugMode) {
				console.log("Gemini API Request:", {
					url: modelEndpoint,
					requestBody: JSON.parse(JSON.stringify(requestBody)),
				});
			}

			// Make the API call
			const response = await fetch(
				`${modelEndpoint}?key=${currentConfig.apiKey}`,
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

			// Log the response if debug mode is enabled
			if (currentConfig.debugMode) {
				console.log("Gemini API Response:", responseData);
			}

			// Check for rate limiting
			if (response.status === 429) {
				const retryAfter = response.headers.get("retry-after");
				const waitTime = retryAfter
					? parseInt(retryAfter) * 1000
					: 60000; // Default to 1 minute if no header

				console.log(
					`Rate limit hit. Will retry after ${
						waitTime / 1000
					} seconds.`
				);

				throw new Error(
					`Rate limit reached. Please try again in ${Math.ceil(
						waitTime / 1000
					)} seconds.`
				);
			}

			// Handle other API errors
			if (!response.ok) {
				const errorMessage =
					responseData.error?.message ||
					`API Error: ${response.status} ${response.statusText}`;
				throw new Error(errorMessage);
			}

			// Extract the generated text
			if (responseData.candidates && responseData.candidates.length > 0) {
				let generatedText =
					responseData.candidates[0].content?.parts[0]?.text;

				// Capture conversation history for future chunks
				const updatedConversationHistory = [...requestContents];

				// Add the assistant response to conversation history
				if (generatedText) {
					updatedConversationHistory.push({
						role: "assistant",
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
						const gameBoxCount = preservedElements.filter((el) =>
							el.includes('class="game-stats-box"')
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
		partInfo = null
	) {
		try {
			// Load latest config
			currentConfig = await initConfig();

			if (!currentConfig.apiKey) {
				throw new Error(
					"API key is missing. Please set it in the extension popup."
				);
			}

			if (isPart && partInfo) {
				console.log(
					`Summarizing "${title}" - Part ${partInfo.current}/${partInfo.total} with Gemini (${content.length} characters)`
				);
			} else {
				console.log(
					`Summarizing "${title}" with Gemini (${content.length} characters)`
				);
			}

			const modelEndpoint =
				currentConfig.modelEndpoint ||
				`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

			// Use the summary prompt from settings
			let summarizationBasePrompt =
				currentConfig.summaryPrompt || DEFAULT_SUMMARY_PROMPT;

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
					maxOutputTokens: 512, // Limit summary length
					topP: 0.95,
					topK: 40,
				},
			};

			if (currentConfig.debugMode) {
				console.log("Gemini Summarization Request:", {
					url: modelEndpoint,
					requestBody: JSON.parse(JSON.stringify(requestBody)),
				});
			}

			const response = await fetch(
				`${modelEndpoint}?key=${currentConfig.apiKey}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				}
			);

			const responseData = await response.json();

			if (currentConfig.debugMode) {
				console.log("Gemini Summarization Response:", responseData);
			}

			if (!response.ok) {
				const errorMessage =
					responseData.error?.message ||
					`API Error: ${response.status} ${response.statusText}`;
				throw new Error(errorMessage);
			}

			if (responseData.candidates && responseData.candidates.length > 0) {
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
	async function combinePartialSummaries(title, partSummaries, partCount) {
		try {
			// Load latest config
			currentConfig = await initConfig();

			if (!currentConfig.apiKey) {
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
					topP: 0.95,
					topK: 40,
				},
			};

			if (currentConfig.debugMode) {
				console.log("Gemini Combination Request:", {
					url: modelEndpoint,
					requestBody: JSON.parse(JSON.stringify(requestBody)),
				});
			}

			const response = await fetch(
				`${modelEndpoint}?key=${currentConfig.apiKey}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				}
			);

			const responseData = await response.json();

			if (currentConfig.debugMode) {
				console.log("Gemini Combination Response:", responseData);
			}

			if (!response.ok) {
				const errorMessage =
					responseData.error?.message ||
					`API Error: ${response.status} ${response.statusText}`;
				throw new Error(errorMessage);
			}

			if (responseData.candidates && responseData.candidates.length > 0) {
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

	// Initialize when background script loads
	initConfig()
		.then((config) => {
			currentConfig = config;
			console.log("Configuration loaded:", config);
		})
		.catch((error) => console.error("Config initialization error:", error));

	// Log the extension startup
	console.log("Ranobe Gemini extension initialized");

	// Set up a heartbeat to keep the background script active
	setInterval(() => {
		console.log("Background script heartbeat");
	}, 25000);
} catch (error) {
	console.error("Error importing constants in background script:", error);
	// Defining fallback constants
	const DEFAULT_PROMPT = `Please enhance this novel chapter translation with the following improvements: [...]`;
	const DEFAULT_MODEL_ENDPOINT =
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
	const DEFAULT_PERMANENT_PROMPT = `Ensure the translation maintains cultural nuances and original tone.`;
	const DEFAULT_SUMMARY_PROMPT = `Please provide a concise summary of the following novel chapter content. Focus on the main plot points and character interactions. Keep the summary brief and easy to understand.`;

	console.log("Ranobe Gemini: Background script loaded");

	// Global configuration
	let currentConfig = null;

	// Initialize configuration
	async function initConfig() {
		try {
			// Get settings directly from storage
			const data = await browser.storage.local.get();
			return {
				apiKey: data.apiKey || "",
				defaultPrompt: data.defaultPrompt || DEFAULT_PROMPT,
				summaryPrompt: data.summaryPrompt || DEFAULT_SUMMARY_PROMPT, // Load summary prompt
				permanentPrompt:
					data.permanentPrompt || DEFAULT_PERMANENT_PROMPT, // Load permanent prompt
				temperature: data.temperature || 0.7,
				maxOutputTokens: data.maxOutputTokens || 8192,
				debugMode: data.debugMode || false,
				modelEndpoint: data.modelEndpoint || DEFAULT_MODEL_ENDPOINT,
				chunkingEnabled: data.chunkingEnabled !== false, // Default to true
				chunkSize: data.chunkSize || 12000, // Default chunk size
				useEmoji: data.useEmoji || false, // Load emoji setting
			};
		} catch (error) {
			console.error("Error loading configuration:", error);
			return {
				apiKey: "",
				defaultPrompt:
					"Please fix grammar and improve readability of this text while maintaining original meaning.",
				summaryPrompt: DEFAULT_SUMMARY_PROMPT, // Default summary prompt on error
				permanentPrompt: DEFAULT_PERMANENT_PROMPT, // Default permanent prompt on error
				temperature: 0.7,
				maxOutputTokens: 8192,
				chunkingEnabled: true,
				chunkSize: 12000,
				useEmoji: false,
			};
		}
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
				"\n\n## Always Follow These Instructions:\n" + permanentPrompt;
		}

		return combinedPrompt;
	}

	// Handle messages from content script
	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
		console.log("Background received message:", message);

		if (message.action === "ping") {
			sendResponse({
				success: true,
				message: "Background script is alive",
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
							error.message || "Unknown error getting model info",
						// Provide safe defaults
						maxContextSize: 16000,
						maxOutputTokens: 8192,
					});
				});
			return true;
		}

		if (message.action === "processWithGemini") {
			// For longer content, use chunk processing with progressive rendering
			if (message.content && message.content.length > 4000) {
				processContentInChunks(
					message.title,
					message.content,
					message.useEmoji
				)
					.then((result) => {
						sendResponse({ success: true, result: result });
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
				processContentWithGemini(
					message.title,
					message.content,
					message.isPart,
					message.partInfo,
					message.useEmoji
				)
					.then((result) => {
						sendResponse({ success: true, result: result });
					})
					.catch((error) => {
						console.error("Error processing with Gemini:", error);
						sendResponse({
							success: false,
							error:
								error.message ||
								"Unknown error processing with Gemini",
						});
					});
			}
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
							const chunkIndex = message.startChunkIndex + i;
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
							const result = await processContentWithGemini(
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
							browser.runtime
								.sendMessage({
									action: "chunkProcessed",
									chunkIndex: chunkIndex,
									totalChunks: message.totalChunks,
									result: {
										originalContent: chunk,
										enhancedContent: result.enhancedContent,
									},
									isResumed: true,
									isComplete:
										i === totalChunksRemaining - 1 &&
										failedChunks.length === 0,
								})
								.catch((error) =>
									console.error(
										"Error sending resumed chunk result:",
										error
									)
								);
						} catch (error) {
							console.error(
								`Error processing resumed chunk:`,
								error
							);

							const chunkIndex = message.startChunkIndex + i;
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
								browser.runtime
									.sendMessage({
										action: "chunkError",
										chunkIndex: chunkIndex,
										totalChunks: message.totalChunks,
										error: error.message,
										isRateLimit: true,
										remainingChunks:
											message.totalChunks - chunkIndex,
										unprocessedChunks:
											remainingChunks.slice(i),
										isResumed: true,
									})
									.catch((error) =>
										console.error(
											"Error sending rate limit notification during resume:",
											error
										)
									);

								// Stop processing remaining chunks
								break;
							} else {
								// For other errors, notify but continue processing
								browser.runtime
									.sendMessage({
										action: "chunkError",
										chunkIndex: chunkIndex,
										totalChunks: message.totalChunks,
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

					// Notify that all resumed processing is complete
					browser.runtime
						.sendMessage({
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

		if (message.action === "summarizeWithGemini") {
			summarizeContentWithGemini(
				message.title,
				message.content,
				message.isPart,
				message.partInfo
			)
				.then((summary) => {
					sendResponse({ success: true, summary: summary });
				})
				.catch((error) => {
					console.error("Error summarizing with Gemini:", error);
					sendResponse({
						success: false,
						error:
							error.message ||
							"Unknown error summarizing with Gemini",
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
					sendResponse({ success: true, combinedSummary: summary });
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
	});

	// Get model information based on current configuration
	async function getModelInfo() {
		try {
			// Load latest config
			currentConfig = await initConfig();

			// Default values
			let maxContextSize = 16000; // Default for gemini-1.5-flash
			let maxOutputTokens = currentConfig.maxOutputTokens || 8192;

			// Model-specific values
			const modelId =
				currentConfig.selectedModelId ||
				currentConfig.modelEndpoint?.split("/").pop().split(":")[0] ||
				"gemini-1.5-flash";

			// Set appropriate context sizes based on model
			if (modelId.includes("gemini-1.5-pro")) {
				maxContextSize = 1000000; // 1M token context for Gemini 1.5 Pro
			} else if (modelId.includes("gemini-1.5-flash")) {
				maxContextSize = 16000; // 16k token context for Gemini 1.5 Flash
			} else if (modelId.includes("gemini-2.0-flash")) {
				maxContextSize = 32000; // 32k token context for Gemini 2.0 Flash
			}

			return {
				modelId,
				maxContextSize,
				maxOutputTokens,
			};
		} catch (error) {
			console.error("Error determining model info:", error);
			// Return safe defaults
			return {
				modelId: "unknown",
				maxContextSize: 16000,
				maxOutputTokens: 8192,
			};
		}
	}
}
