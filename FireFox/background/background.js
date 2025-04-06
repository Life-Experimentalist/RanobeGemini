// Background script for Ranobe Gemini
// Use a try-catch for the import to handle potential errors
try {
	// Use a dynamic import with browser.runtime.getURL
	const constantsModule = await import(
		browser.runtime.getURL("utils/constants.js")
	);
	const { DEFAULT_PROMPT, DEFAULT_MODEL_ENDPOINT } = constantsModule;

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

			const fullPrompt = `${promptPrefix}\n\nTitle: ${title}\n\n${content}`;

			const requestBody = {
				contents: [
					{
						parts: [
							{
								text: fullPrompt,
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
	browser.browserAction.onClicked.addListener(() => {
		console.log("Browser action clicked");
		// This is a fallback in case the popup doesn't open
		browser.runtime.openOptionsPage().catch((error) => {
			console.error("Error opening options page:", error);
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

			const fullPrompt = `${promptPrefix}\n\nTitle: ${title}\n\n${content}`;

			const requestBody = {
				contents: [
					{
						parts: [
							{
								text: fullPrompt,
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
	browser.browserAction.onClicked.addListener(() => {
		console.log("Browser action clicked");
		// This is a fallback in case the popup doesn't open
		browser.runtime.openOptionsPage().catch((error) => {
			console.error("Error opening options page:", error);
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
