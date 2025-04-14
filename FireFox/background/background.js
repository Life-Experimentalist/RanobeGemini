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
			};
		}
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
			processContentWithGemini(
				message.title,
				message.content,
				message.isPart,
				message.partInfo
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
					url: browser.runtime.getURL("popup/simple-popup.html"),
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

	// Process content with Gemini API
	async function processContentWithGemini(
		title,
		content,
		isPart = false,
		partInfo = null
	) {
		try {
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
					`Processing "${title}" - Part ${partInfo.current}/${partInfo.total} with Gemini (${content.length} characters)`
				);
			} else {
				console.log(
					`Processing "${title}" with Gemini (${content.length} characters)`
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

			// Prepare the request for Gemini API with the latest prompt from settings
			let promptPrefix = currentConfig.defaultPrompt;

			// If processing a part, add special instructions
			if (isPart && partInfo) {
				promptPrefix += `\n\nNote: This is part ${partInfo.current} of ${partInfo.total} parts. Please enhance this part while maintaining consistency with other parts.`;
			}

			// Combine base prompt, permanent prompt, title, and content
			const fullPrompt = `${promptPrefix}\n\n${currentConfig.permanentPrompt}\n\nTitle: ${title}\n\n${content}`;

			const requestBody = {
				contents: [
					{
						parts: [
							{
								text: fullPrompt, // Use the combined prompt
							},
						],
					},
				],
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

			// Handle API errors
			if (!response.ok) {
				const errorMessage =
					responseData.error?.message ||
					`API Error: ${response.status} ${response.statusText}`;
				throw new Error(errorMessage);
			}

			// Extract the generated text
			if (responseData.candidates && responseData.candidates.length > 0) {
				const generatedText =
					responseData.candidates[0].content?.parts[0]?.text;
				if (generatedText) {
					return generatedText;
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
			const summarizationBasePrompt =
				currentConfig.summaryPrompt || DEFAULT_SUMMARY_PROMPT;

			// If processing a part, add special instructions
			if (isPart && partInfo) {
				summarizationBasePrompt += `\n\nNote: This is part ${partInfo.current} of ${partInfo.total} parts. Please summarize this part while maintaining consistency with other parts.`;
			}

			// Combine base summarization prompt, permanent prompt, title, and content
			const fullSummarizationPrompt = `${summarizationBasePrompt}\n\n${currentConfig.permanentPrompt}\n\nTitle: ${title}\n\nContent:\n${content}`;

			const requestBody = {
				contents: [
					{
						parts: [
							{
								text: fullSummarizationPrompt, // Use the combined prompt
							},
						],
					},
				],
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
				currentConfig.summaryPrompt || DEFAULT_SUMMARY_PROMPT;

			// Combine base combination prompt, permanent prompt, title, and partial summaries
			const fullCombinationPrompt = `${combinationBasePrompt}\n\n${
				currentConfig.permanentPrompt
			}\n\nTitle: ${title}\n\nPartial Summaries:\n${partSummaries.join(
				"\n\n"
			)}`;

			const requestBody = {
				contents: [
					{
						parts: [
							{
								text: fullCombinationPrompt, // Use the combined prompt
							},
						],
					},
				],
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
				url: browser.runtime.getURL("popup/simple-popup.html"),
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
	// Continue with fallback defaults...
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
			};
		}
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
			processContentWithGemini(
				message.title,
				message.content,
				message.isPart,
				message.partInfo
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
					url: browser.runtime.getURL("popup/simple-popup.html"),
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

	// Process content with Gemini API
	async function processContentWithGemini(
		title,
		content,
		isPart = false,
		partInfo = null
	) {
		try {
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
					`Processing "${title}" - Part ${partInfo.current}/${partInfo.total} with Gemini (${content.length} characters)`
				);
			} else {
				console.log(
					`Processing "${title}" with Gemini (${content.length} characters)`
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

			// Prepare the request for Gemini API with the latest prompt from settings
			let promptPrefix = currentConfig.defaultPrompt;

			// If processing a part, add special instructions
			if (isPart && partInfo) {
				promptPrefix += `\n\nNote: This is part ${partInfo.current} of ${partInfo.total} parts. Please enhance this part while maintaining consistency with other parts.`;
			}

			// Combine base prompt, permanent prompt, title, and content
			const fullPrompt = `${promptPrefix}\n\n${currentConfig.permanentPrompt}\n\nTitle: ${title}\n\n${content}`;

			const requestBody = {
				contents: [
					{
						parts: [
							{
								text: fullPrompt, // Use the combined prompt
							},
						],
					},
				],
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

			// Handle API errors
			if (!response.ok) {
				const errorMessage =
					responseData.error?.message ||
					`API Error: ${response.status} ${response.statusText}`;
				throw new Error(errorMessage);
			}

			// Extract the generated text
			if (responseData.candidates && responseData.candidates.length > 0) {
				const generatedText =
					responseData.candidates[0].content?.parts[0]?.text;
				if (generatedText) {
					return generatedText;
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
			const summarizationBasePrompt =
				currentConfig.summaryPrompt || DEFAULT_SUMMARY_PROMPT;

			// If processing a part, add special instructions
			if (isPart && partInfo) {
				summarizationBasePrompt += `\n\nNote: This is part ${partInfo.current} of ${partInfo.total} parts. Please summarize this part while maintaining consistency with other parts.`;
			}

			// Combine base summarization prompt, permanent prompt, title, and content
			const fullSummarizationPrompt = `${summarizationBasePrompt}\n\n${currentConfig.permanentPrompt}\n\nTitle: ${title}\n\nContent:\n${content}`;

			const requestBody = {
				contents: [
					{
						parts: [
							{
								text: fullSummarizationPrompt, // Use the combined prompt
							},
						],
					},
				],
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
				currentConfig.summaryPrompt || DEFAULT_SUMMARY_PROMPT;

			// Combine base combination prompt, permanent prompt, title, and partial summaries
			const fullCombinationPrompt = `${combinationBasePrompt}\n\n${
				currentConfig.permanentPrompt
			}\n\nTitle: ${title}\n\nPartial Summaries:\n${partSummaries.join(
				"\n\n"
			)}`;

			const requestBody = {
				contents: [
					{
						parts: [
							{
								text: fullCombinationPrompt, // Use the combined prompt
							},
						],
					},
				],
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
				url: browser.runtime.getURL("popup/simple-popup.html"),
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
}
