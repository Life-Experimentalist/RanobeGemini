// Options page script

// Elements
const apiKeyInput = document.getElementById("apiKey");
const showApiKeyButton = document.getElementById("showApiKey");
const testApiKeyButton = document.getElementById("testApiKey");
const promptTextarea = document.getElementById("prompt");
const modelSelect = document.getElementById("model");
const temperatureSlider = document.getElementById("temperature");
const temperatureValue = document.getElementById("temperatureValue");
const debugModeCheckbox = document.getElementById("debugMode");
const saveButton = document.getElementById("saveButton");
const restoreButton = document.getElementById("restoreButton");
const statusMessage = document.getElementById("statusMessage");

// Show/hide API key
showApiKeyButton.addEventListener("click", () => {
	if (apiKeyInput.type === "password") {
		apiKeyInput.type = "text";
		showApiKeyButton.textContent = "Hide";
	} else {
		apiKeyInput.type = "password";
		showApiKeyButton.textContent = "Show";
	}
});

// Update temperature value display
temperatureSlider.addEventListener("input", () => {
	temperatureValue.textContent = temperatureSlider.value;
});

// Test API key
testApiKeyButton.addEventListener("click", async () => {
	const apiKey = apiKeyInput.value.trim();

	if (!apiKey) {
		showStatus("Please enter an API key first", "error");
		return;
	}

	showStatus("Testing API key...", "info");

	try {
		// Simple test request to the Gemini API
		const modelEndpoint =
			"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

		const response = await fetch(`${modelEndpoint}?key=${apiKey}`, {
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
		});

		const data = await response.json();

		if (response.ok) {
			showStatus("API key is valid! ✓", "success");
		} else {
			const errorMessage = data.error?.message || "Unknown API error";
			showStatus(`Error testing API key: ${errorMessage}`, "error");
		}
	} catch (error) {
		console.error("API key test error:", error);
		showStatus(`Error testing API key: ${error.message}`, "error");
	}
});

// Save settings
saveButton.addEventListener("click", async () => {
	try {
		// Import the config module
		const { default: config } = await import("../config/config.js");

		// Create config object with form values
		const updatedConfig = {
			apiKey: apiKeyInput.value.trim(),
			defaultPrompt: promptTextarea.value.trim(),
			selectedModel: modelSelect.value,
			temperature: parseFloat(temperatureSlider.value),
			debugMode: debugModeCheckbox.checked,
		};

		// Save the updated config using saveConfig (do not call saveMultipleConfig)
		const result = await config.saveConfig(updatedConfig);

		if (result) {
			showStatus("Settings saved successfully!", "success");
		} else {
			showStatus("Error saving settings. Please try again.", "error");
		}
	} catch (error) {
		console.error("Error saving settings:", error);
		showStatus("Error saving settings: " + error.message, "error");
	}
});

// Restore default settings
restoreButton.addEventListener("click", async () => {
	try {
		const { default: config } = await import("../config/config.js");

		// Load default config
		const defaultConfig = config.DEFAULT_CONFIG;

		// Update form with default values
		loadConfigToForm(defaultConfig);

		// Show message
		showStatus(
			"Default settings restored. Click Save to apply them.",
			"success"
		);
	} catch (error) {
		console.error("Error restoring defaults:", error);
		showStatus("Error restoring defaults: " + error.message, "error");
	}
});

// Load config values to form
function loadConfigToForm(config) {
	apiKeyInput.value = config.apiKey || "";
	promptTextarea.value = config.defaultPrompt || "";
	modelSelect.value = config.selectedModel || "gemini-1.5-pro";
	temperatureSlider.value = config.temperature || 0.7;
	temperatureValue.textContent = temperatureSlider.value;
	debugModeCheckbox.checked = config.debugMode || false;
}

// Show status message
function showStatus(message, type) {
	statusMessage.textContent = message;
	statusMessage.className = "status-message " + type;

	// Hide after 5 seconds if it's a success message
	if (type === "success") {
		setTimeout(() => {
			statusMessage.className = "status-message";
		}, 5000);
	}
}

// Load saved settings when page loads
async function loadSavedSettings() {
	try {
		const { default: config } = await import("../config/config.js");
		const savedConfig = await config.loadConfig();
		loadConfigToForm(savedConfig);

		// Check if we were opened with a specific request (e.g., missing API key)
		const urlParams = new URLSearchParams(window.location.search);
		if (
			urlParams.has("highlight") &&
			urlParams.get("highlight") === "apiKey"
		) {
			apiKeyInput.focus();
			apiKeyInput.classList.add("highlight-input");
			showStatus(
				"Please enter your Gemini API key to use the extension",
				"info"
			);

			// Remove highlight after 3 seconds
			setTimeout(() => {
				apiKeyInput.classList.remove("highlight-input");
			}, 3000);
		}
	} catch (error) {
		console.error("Error loading saved settings:", error);
		showStatus(
			"Error loading saved settings. Default values loaded.",
			"error"
		);
	}
}

// Initialize the page
loadSavedSettings();
