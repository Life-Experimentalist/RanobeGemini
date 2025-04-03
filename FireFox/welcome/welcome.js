import ENV from "../env.js"; // Import environment variables

document.addEventListener("DOMContentLoaded", async () => {
	const apiKeyInput = document.getElementById("api-key");
	const saveKeyBtn = document.getElementById("save-key");
	const statusDiv = document.getElementById("status");

	// If API key is already set in env file for development, auto-fill it
	if (ENV.GEMINI_API_KEY) {
		apiKeyInput.value = ENV.GEMINI_API_KEY;
		statusDiv.textContent =
			"API key loaded from environment (development mode)";
		statusDiv.className = "status success";
		statusDiv.classList.remove("hidden");
	} else {
		// Load saved API key from storage
		const { apiKey } = (await browser.storage.local.get("apiKey")) || {};
		if (apiKey) {
			apiKeyInput.value = apiKey;
			statusDiv.textContent = "API key is set";
			statusDiv.className = "status success";
			statusDiv.classList.remove("hidden");
		}
	}

	// Show loading indicator
	function showLoading() {
		saveKeyBtn.textContent = "Validating...";
		saveKeyBtn.disabled = true;
		statusDiv.textContent = "Checking your API key with Google...";
		statusDiv.className = "status";
		statusDiv.classList.remove("hidden");
	}

	// Reset button state
	function resetButton() {
		saveKeyBtn.textContent = "Save API Key & Continue";
		saveKeyBtn.disabled = false;
	}

	// Show status message
	function showStatus(message, isSuccess) {
		statusDiv.textContent = message;
		statusDiv.className = `status ${isSuccess ? "success" : "error"}`;
		statusDiv.classList.remove("hidden");

		if (isSuccess) {
			// Visually indicate success
			saveKeyBtn.textContent = "✓ Success! Redirecting...";
			saveKeyBtn.style.backgroundColor = "#34A853"; // Google green

			// Close the welcome page and open the extension popup after a delay
			setTimeout(() => {
				window.close();
			}, 2000);
		}
	}

	// Validate API key with Gemini and fetch available models
	async function validateApiKey(key) {
		try {
			// First try to fetch models to validate key and get available models
			const modelApiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

			const modelsResponse = await fetch(modelApiUrl);

			if (!modelsResponse.ok) {
				const errorData = await modelsResponse.json();
				throw new Error(
					errorData.error?.message ||
						`HTTP error: ${modelsResponse.status}`
				);
			}

			// Process the models - make sure we have at least one Gemini model
			const data = await modelsResponse.json();
			const textModels = data.models
				.filter(
					(model) =>
						model.supportedGenerationMethods &&
						model.supportedGenerationMethods.includes(
							"generateContent"
						) &&
						model.name.includes("gemini")
				)
				.map((model) => {
					const id = model.name.split("/").pop();
					const displayName = formatModelName(id);
					return {
						id,
						name: displayName,
						url: `https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`,
						supportedGenerationMethods:
							model.supportedGenerationMethods,
					};
				});

			// Check if we have any valid models
			if (textModels.length === 0) {
				throw new Error("No Gemini models available with this API key");
			}

			// Sort models to prioritize newer ones
			textModels.sort((a, b) => {
				if (a.id.includes("2.0") && !b.id.includes("2.0")) return -1;
				if (!a.id.includes("2.0") && b.id.includes("2.0")) return 1;
				if (a.id.includes("1.5") && !b.id.includes("1.5")) return -1;
				if (!a.id.includes("1.5") && b.id.includes("1.5")) return 1;
				return a.name.localeCompare(b.name);
			});

			return {
				valid: true,
				models: textModels,
			};
		} catch (error) {
			console.error("API key validation error:", error);
			return { valid: false, error: error.message };
		}
	}

	// Format model name for display
	function formatModelName(modelId) {
		// Convert kebab-case to title case
		let name = modelId
			.replace(/-/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());

		// Add version information if available
		if (modelId.includes("gemini")) {
			if (modelId.includes("2.0")) {
				name = name.replace("Gemini", "Gemini 2.0");
			} else if (modelId.includes("1.5")) {
				name = name.replace("Gemini", "Gemini 1.5");
			} else if (modelId.includes("pro")) {
				name = name.replace("Gemini", "Gemini 1.0");
			}
		}

		return name;
	}

	// Handle save button click
	saveKeyBtn.addEventListener("click", async () => {
		const apiKey = apiKeyInput.value.trim();

		if (!apiKey) {
			showStatus("Please enter an API key", false);
			return;
		}

		showLoading();

		// Test if the API key is valid
		const validationResult = await validateApiKey(apiKey);

		if (validationResult.valid) {
			// Save the valid API key
			await browser.storage.local.set({ apiKey });

			// Save the fetched models
			if (validationResult.models && validationResult.models.length > 0) {
				// Find the best default model - prefer newest version
				const defaultModel = validationResult.models[0]; // First is already sorted to be newest
				await browser.storage.local.set({
					availableModels: validationResult.models,
					model: defaultModel.id,
					modelsLastFetched: Date.now(),
				});
			}

			showStatus("API key is valid! Redirecting to extension...", true);
		} else {
			resetButton();

			if (validationResult.error.includes("API key not valid")) {
				showStatus(
					"Invalid API key. Please check your key and try again.",
					false
				);
			} else {
				showStatus(
					`Error validating API key: ${validationResult.error}`,
					false
				);
			}
		}
	});

	// Also validate when the user presses Enter in the input field
	apiKeyInput.addEventListener("keypress", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			saveKeyBtn.click();
		}
	});
});
