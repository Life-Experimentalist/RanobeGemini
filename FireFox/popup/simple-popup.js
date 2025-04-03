// Simple popup script for Ranobe Gemini that just handles the API key
document.addEventListener("DOMContentLoaded", async function () {
	// DOM elements
	const apiKeyInput = document.getElementById("apiKey");
	const saveApiKeyBtn = document.getElementById("saveApiKey");
	const testApiKeyBtn = document.getElementById("testApiKey");
	const enhancePageBtn = document.getElementById("enhancePageBtn");
	const getKeyLink = document.getElementById("getKeyLink");
	const statusDiv = document.getElementById("status");

	// First ping the background script to ensure it's running
	try {
		console.log("Pinging background script...");
		const pingResponse = await browser.runtime.sendMessage({
			action: "ping",
		});
		console.log("Background script response:", pingResponse);

		if (pingResponse && pingResponse.success) {
			console.log("Background script is active");
		}
	} catch (error) {
		console.error("Error communicating with background script:", error);
		showStatus("Extension error: Please reload the extension", "error");
	}

	// Load API key from storage
	try {
		const data = await browser.storage.local.get("apiKey");
		if (data.apiKey) {
			apiKeyInput.value = data.apiKey;
			showStatus("API key loaded from storage", "success");
		}
	} catch (error) {
		console.error("Error loading API key:", error);
	}

	// Save API key
	saveApiKeyBtn.addEventListener("click", async () => {
		const apiKey = apiKeyInput.value.trim();

		if (!apiKey) {
			showStatus("Please enter a valid API key", "error");
			return;
		}

		try {
			await browser.storage.local.set({
				apiKey: apiKey,
				// Set sensible defaults for other settings
				defaultPrompt:
					"Please review and enhance the following novel chapter translation. Correct grammatical, punctuation, and spelling errors; improve narrative flow and readability; maintain the original tone, style, and plot; ensure consistent gender pronouns; and streamline overly verbose sections. Format your response with proper HTML paragraph tags (<p>) for each paragraph. Do not use markdown formatting at all. Preserve the original meaning while producing a polished version suitable for a high-quality reading experience.",
				temperature: 0.7,
				modelEndpoint:
					"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
				maxOutputTokens: 8192,
				debugMode: false,
			});

			showStatus("API key saved successfully!", "success");
		} catch (error) {
			console.error("Error saving API key:", error);
			showStatus("Error saving API key: " + error.message, "error");
		}
	});

	// Test API key
	testApiKeyBtn.addEventListener("click", async () => {
		const apiKey = apiKeyInput.value.trim();

		if (!apiKey) {
			showStatus("Please enter an API key to test", "error");
			return;
		}

		try {
			showStatus("Testing API key...", "info");
			testApiKeyBtn.disabled = true;

			// Simple test request to Gemini API
			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{
										text: "Hello, please respond with just the word 'SUCCESS' if you can read this.",
									},
								],
							},
						],
						generationConfig: {
							temperature: 0.1,
							maxOutputTokens: 10,
						},
					}),
				}
			);

			const data = await response.json();

			if (response.ok) {
				showStatus("API key is valid! ✓", "success");
				// Save the key automatically if valid
				await browser.storage.local.set({
					apiKey: apiKey,
					defaultPrompt:
						"Please review and enhance the following novel chapter translation. Correct grammatical, punctuation, and spelling errors; improve narrative flow and readability; maintain the original tone, style, and plot; ensure consistent gender pronouns; and streamline overly verbose sections. Format your response with proper HTML paragraph tags (<p>) for each paragraph. Do not use markdown formatting at all. Preserve the original meaning while producing a polished version suitable for a high-quality reading experience.",
					temperature: 0.7,
					modelEndpoint:
						"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
					maxOutputTokens: 8192,
					debugMode: false,
				});
			} else {
				const errorMessage = data.error?.message || "Unknown API error";
				showStatus(`Error testing API key: ${errorMessage}`, "error");
			}
		} catch (error) {
			console.error("API key test error:", error);
			showStatus(`Error testing API key: ${error.message}`, "error");
		} finally {
			testApiKeyBtn.disabled = false;
		}
	});

	// Enhance current page
	enhancePageBtn.addEventListener("click", async () => {
		try {
			const data = await browser.storage.local.get("apiKey");
			if (!data.apiKey) {
				showStatus("Please save an API key first", "error");
				return;
			}

			const tabs = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (tabs[0]) {
				showStatus("Processing page...", "info");

				try {
					// First ping the content script to make sure it's responsive
					const pingResponse = await browser.tabs.sendMessage(
						tabs[0].id,
						{ action: "ping" }
					);
					console.log("Content script response:", pingResponse);

					// Proceed with the actual processing
					const processResponse = await browser.tabs.sendMessage(
						tabs[0].id,
						{ action: "processWithGemini" }
					);
					if (processResponse && processResponse.success) {
						showStatus("Page enhancement started!", "success");
					} else {
						showStatus(
							"Error: " +
								(processResponse?.error || "Unknown error"),
							"error"
						);
					}
				} catch (error) {
					console.error("Communication error:", error);
					showStatus(
						"Error: Content script not available on this page",
						"error"
					);
				}
			}
		} catch (error) {
			console.error("Error enhancing page:", error);
			showStatus("Error enhancing page: " + error.message, "error");
		}
	});

	// Open Google AI Studio link to get API key
	getKeyLink.addEventListener("click", (e) => {
		e.preventDefault();
		browser.tabs.create({
			url: "https://makersuite.google.com/app/apikey",
		});
	});

	// Helper function to show status messages
	function showStatus(message, type) {
		statusDiv.textContent = message;
		statusDiv.className = type || "";

		// Auto clear success messages after 3 seconds
		if (type === "success") {
			setTimeout(() => {
				statusDiv.textContent = "";
				statusDiv.className = "";
			}, 3000);
		}
	}

	// Log that the popup is initialized
	console.log("Ranobe Gemini popup initialized");
});
