// Background script for Ranobe Novel Enhancer
console.log("Ranobe Novel Enhancer: Background script loaded");

// Global configuration
let currentConfig = null;

// Initialize configuration
async function initConfig() {
	try {
		// Try to load config module
		const { default: configModule } = await import(
			"../config/config.js"
		).catch((error) => {
			console.error("Error importing config module:", error);
			// Return a simple default config if import fails
			return {
				default: {
					loadConfig: () => ({
						apiKey: "",
						defaultPrompt:
							"Please fix grammar and improve readability of this text while maintaining original meaning.",
						temperature: 0.7,
						maxOutputTokens: 8192,
					}),
				},
			};
		});

		currentConfig = await configModule.loadConfig();

		// Set up listener for config changes
		browser.storage.onChanged.addListener(async (changes) => {
			if (changes.config) {
				currentConfig = await configModule.loadConfig();
			}
		});

		return configModule;
	} catch (error) {
		console.error("Error initializing config:", error);
		return null;
	}
}

// Handle messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log("Background received message:", message);

	if (message.action === "ping") {
		sendResponse({ success: true, message: "Background script is alive" });
		return true;
	}

	if (message.action === "processWithGemini") {
		processContentWithGemini(message.title, message.content)
			.then((result) => {
				sendResponse({ success: true, result: result });
			})
			.catch((error) => {
				console.error("Error processing with Gemini:", error);
				sendResponse({
					success: false,
					error:
						error.message || "Unknown error processing with Gemini",
				});
			});

		return true; // Indicates we'll send a response asynchronously
	}

	return false;
});

// Process content with Gemini API (actual implementation)
async function processContentWithGemini(title, content) {
	try {
		// Check if we have a configuration loaded
		if (!currentConfig) {
			const config = await initConfig();
			if (!config) {
				throw new Error("Failed to initialize configuration");
			}
			currentConfig = await config.loadConfig();
		}

		// Check if we have an API key
		if (!currentConfig.apiKey) {
			// Try to open the popup; if that fails, then open the options page
			browser.browserAction.openPopup().catch(() => {
				browser.runtime.openOptionsPage();
			});
			throw new Error(
				"API key is missing. Please set it in the popup that has been opened."
			);
		}

		console.log(
			`Processing "${title}" with Gemini (${content.length} characters)`
		);

		// Prepare the request for Gemini API
		const fullPrompt = `${currentConfig.defaultPrompt}\n\nTitle: ${title}\n\n${content}`;

		// Default to Gemini 1.5 Pro if no model specified
		const modelEndpoint =
			currentConfig.modelEndpoint ||
			"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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

		throw new Error("No valid response content returned from Gemini API");
	} catch (error) {
		console.error("Gemini API error:", error);
		throw error;
	}
}

// Initialize when background script loads
initConfig().catch((error) =>
	console.error("Config initialization error:", error)
);
