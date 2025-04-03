// Import config module
import config from "../config/config.js";
import ENV from "../env.js"; // Import environment variables

// DOM elements - Basic Settings
const promptTextarea = document.getElementById("promptTemplate");
const apiKeyInput = document.getElementById("apiKey");
const modelSelect = document.getElementById("modelSelect");
const refreshModelsBtn = document.getElementById("refreshModels");
const autoNavigateCheckbox = document.getElementById("autoNavigate");
const showWatermarksCheckbox = document.getElementById("showWatermarks");
const showPageWatermarkCheckbox = document.getElementById("showPageWatermark");
const showChapterWatermarkCheckbox = document.getElementById(
	"showChapterWatermark"
);
const watermarkOptionsDiv = document.getElementById("watermarkOptions");
const debugModeCheckbox = document.getElementById("debugMode");
const saveBasicSettingsBtn = document.getElementById("saveBasicSettings");
const resetPromptBtn = document.getElementById("resetPrompt");

// DOM elements - Advanced Settings
const temperatureSlider = document.getElementById("temperature");
const temperatureValue = document.getElementById("temperatureValue");
const topKSlider = document.getElementById("topK");
const topKValue = document.getElementById("topKValue");
const topPSlider = document.getElementById("topP");
const topPValue = document.getElementById("topPValue");
const maxTokensSlider = document.getElementById("maxTokens");
const maxTokensValue = document.getElementById("maxTokensValue");
const contentSelectorsTextarea = document.getElementById("contentSelectors");
const saveAdvancedSettingsBtn = document.getElementById("saveAdvancedSettings");
const resetAdvancedSettingsBtn = document.getElementById(
	"resetAdvancedSettings"
);

// DOM elements - Tabs and Status
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const statusDiv = document.getElementById("status");

// DOM elements - About links
const viewReadmeLink = document.getElementById("viewReadme");
const viewTodoLink = document.getElementById("viewTodo");

// DOM elements - FAQ links
const getApiKeyLink = document.getElementById("get-api-key-link");

// Initialize popup
document.addEventListener("DOMContentLoaded", () => {
	// Load settings
	loadAllSettings();

	// Set up event listeners - Basic Settings
	saveBasicSettingsBtn.addEventListener("click", saveBasicSettings);
	resetPromptBtn.addEventListener("click", resetPrompt);

	// Validate API key on blur
	apiKeyInput.addEventListener("blur", validateApiKeyOnBlur);

	// Add test API key button event listener
	const apiKeyTestButton = document.createElement("button");
	apiKeyTestButton.id = "testApiKey";
	apiKeyTestButton.className = "small-btn";
	apiKeyTestButton.textContent = "Test Key";
	apiKeyTestButton.style.margin = "5px 0";
	apiKeyTestButton.addEventListener("click", testApiKeyDirectly);

	// Add test button after API key input
	apiKeyInput.parentNode.appendChild(apiKeyTestButton);

	if (refreshModelsBtn) {
		refreshModelsBtn.addEventListener("click", refreshAvailableModels);
	}

	// Set up watermark toggles
	showWatermarksCheckbox.addEventListener("change", toggleWatermarkOptions);

	// Set up event listeners - Advanced Settings
	saveAdvancedSettingsBtn.addEventListener("click", saveAdvancedSettings);
	resetAdvancedSettingsBtn.addEventListener("click", resetAdvancedSettings);

	// Set up event listeners - Sliders
	setupSlider(temperatureSlider, temperatureValue);
	setupSlider(topKSlider, topKValue);
	setupSlider(topPSlider, topPValue);
	setupSlider(maxTokensSlider, maxTokensValue);

	// Set up event listeners - Tabs
	tabButtons.forEach((button) => {
		button.addEventListener("click", () => {
			// Remove active class from all buttons and contents
			tabButtons.forEach((btn) => btn.classList.remove("active"));
			tabContents.forEach((content) =>
				content.classList.remove("active")
			);

			// Add active class to current button and content
			button.classList.add("active");
			document.getElementById(button.dataset.tab).classList.add("active");
		});
	});

	// Set up event listeners - About links
	viewReadmeLink.addEventListener("click", () => {
		browser.tabs.create({ url: browser.runtime.getURL("README.md") });
	});

	viewTodoLink.addEventListener("click", () => {
		browser.tabs.create({ url: browser.runtime.getURL("TODO.md") });
	});

	// Set up event listeners - FAQ links
	getApiKeyLink.addEventListener("click", () => {
		browser.tabs.create({
			url: "https://makersuite.google.com/app/apikey",
		});
	});

	// Add a test extraction button to the popup
	const testExtractionButton = document.createElement("button");
	testExtractionButton.textContent = "Test Content Extraction";
	testExtractionButton.className = "test-btn";
	testExtractionButton.style.marginTop = "20px";
	testExtractionButton.style.backgroundColor = "#34A853"; // Google green

	testExtractionButton.addEventListener("click", async () => {
		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (tabs[0]) {
			browser.tabs
				.sendMessage(tabs[0].id, { action: "testExtraction" })
				.then((response) => {
					if (response && response.success) {
						showStatus(
							"Test started! Check the console on the webpage",
							"success"
						);
					}
				})
				.catch((error) => {
					showStatus("Error: " + error.message, "error");
				});
		}
	});

	// Add to DOM - you can adjust this to fit your popup's structure
	document.getElementById("faq").appendChild(testExtractionButton);
});

// Test API key directly from the popup
async function testApiKeyDirectly() {
	const apiKey = apiKeyInput.value.trim();
	if (!apiKey) {
		showStatus("Please enter an API key to test", "error");
		return;
	}

	const validationContainer = createApiKeyValidationContainer();
	validationContainer.textContent = "Testing API key...";
	validationContainer.className = "validating";

	try {
		// Disable the test button during validation
		document.getElementById("testApiKey").disabled = true;

		// Test the key
		const validationResult = await validateApiKey(apiKey);

		if (validationResult.valid) {
			// If valid, save the key immediately
			await config.saveConfig("apiKey", apiKey);

			// Save fetched models if available
			if (validationResult.models && validationResult.models.length > 0) {
				await config.saveMultipleConfig({
					availableModels: validationResult.models,
					modelsLastFetched: Date.now(),
				});

				// Refresh the model selector with new models
				populateModelSelector(
					validationResult.models,
					validationResult.models[0].id
				);
			}

			validationContainer.textContent = "✅ Valid API key - Saved!";
			validationContainer.className = "valid";
			showStatus("API key verified and saved!", "success");
		} else {
			validationContainer.textContent =
				"❌ Invalid API key: " + validationResult.error;
			validationContainer.className = "invalid";

			// Add Google AI Studio link for convenience
			addGetApiKeyLink(validationContainer);
		}
	} catch (error) {
		validationContainer.textContent =
			"Error testing API key: " + error.message;
		validationContainer.className = "invalid";
	} finally {
		// Re-enable the test button
		document.getElementById("testApiKey").disabled = false;
	}
}

// Add a container for API key validation messages
function createApiKeyValidationContainer() {
	// Check if container already exists
	let validationContainer = document.getElementById("api-key-validation");
	if (!validationContainer) {
		// Create validation message container
		validationContainer = document.createElement("div");
		validationContainer.id = "api-key-validation";
		validationContainer.style.fontSize = "12px";
		validationContainer.style.marginTop = "5px";
		validationContainer.style.marginBottom = "10px";

		// Insert after API key input
		const apiKeyParent = apiKeyInput.parentNode;
		apiKeyParent.appendChild(validationContainer);
	}
	return validationContainer;
}

// Helper function to add API key link to a container
function addGetApiKeyLink(container) {
	// Clear any existing links first
	const existingLinks = container.querySelectorAll("a");
	existingLinks.forEach((link) => link.remove());

	// Add line break
	container.appendChild(document.createElement("br"));

	// Add link to get API key
	const getApiLink = document.createElement("a");
	getApiLink.href = "https://makersuite.google.com/app/apikey";
	getApiLink.textContent = "Get a Gemini API key from Google AI Studio";
	getApiLink.target = "_blank";
	getApiLink.style.display = "inline-block";
	getApiLink.style.marginTop = "5px";
	getApiLink.style.color = "#4285f4";
	getApiLink.style.textDecoration = "none";
	getApiLink.addEventListener("click", (e) => {
		e.preventDefault();
		browser.tabs.create({ url: getApiLink.href });
	});

	container.appendChild(getApiLink);
}

// Validate API key when focus leaves the input field
async function validateApiKeyOnBlur() {
	const apiKey = apiKeyInput.value.trim();
	if (!apiKey) return; // Skip validation if empty

	const validationContainer = createApiKeyValidationContainer();

	// Show validating message
	validationContainer.textContent = "Validating API key...";
	validationContainer.className = "validating";
	validationContainer.style.color = "#666";

	// Validate the key
	const validationResult = await validateApiKey(apiKey);

	if (validationResult.valid) {
		validationContainer.textContent = "✓ Valid API key";
		validationContainer.className = "valid";
		validationContainer.style.color = "green";

		// Clear any link that might have been added
		while (validationContainer.childElementCount > 0) {
			validationContainer.removeChild(validationContainer.lastChild);
		}
	} else {
		// Show error message and link to Google AI Studio
		validationContainer.textContent =
			"✗ Invalid API key: " + validationResult.error;
		validationContainer.className = "invalid";
		validationContainer.style.color = "red";

		// Add line break
		validationContainer.appendChild(document.createElement("br"));

		// Add link to get API key
		const getApiLink = document.createElement("a");
		getApiLink.href = "https://makersuite.google.com/app/apikey";
		getApiLink.textContent = "Get a Gemini API key from Google AI Studio";
		getApiLink.target = "_blank";
		getApiLink.style.display = "inline-block";
		getApiLink.style.marginTop = "5px";
		getApiLink.style.color = "#4285f4";
		getApiLink.style.textDecoration = "none";
		getApiLink.addEventListener("click", (e) => {
			e.preventDefault();
			browser.tabs.create({ url: getApiLink.href });
		});

		validationContainer.appendChild(getApiLink);
	}
}

// Toggle watermark sub-options based on main watermark toggle
function toggleWatermarkOptions() {
	if (showWatermarksCheckbox.checked) {
		watermarkOptionsDiv.classList.remove("disabled");
		showPageWatermarkCheckbox.disabled = false;
		showChapterWatermarkCheckbox.disabled = false;
	} else {
		watermarkOptionsDiv.classList.add("disabled");
		showPageWatermarkCheckbox.disabled = true;
		showChapterWatermarkCheckbox.disabled = true;
	}
}

// Set up a slider with its display value
function setupSlider(slider, valueDisplay) {
	slider.addEventListener("input", () => {
		valueDisplay.textContent = slider.value;
	});
}

// Load all settings from storage
async function loadAllSettings() {
	try {
		const currentConfig = await config.loadConfig();

		// Basic settings
		promptTextarea.value = currentConfig.defaultPrompt;

		// Show a development notice if using env API key
		if (currentConfig.apiKey === ENV.GEMINI_API_KEY && ENV.GEMINI_API_KEY) {
			apiKeyInput.value = currentConfig.apiKey;
			showStatus(
				"Using API key from environment file (development mode)",
				"success",
				3000
			);
		} else {
			apiKeyInput.value = currentConfig.apiKey;
		}

		// Watermark settings
		showWatermarksCheckbox.checked = currentConfig.showWatermarks;
		showPageWatermarkCheckbox.checked = currentConfig.showPageWatermark;
		showChapterWatermarkCheckbox.checked =
			currentConfig.showChapterWatermark;
		toggleWatermarkOptions(); // Initialize the UI state

		// Debug mode
		debugModeCheckbox.checked = currentConfig.debugMode;

		// Populate model selector
		populateModelSelector(
			currentConfig.availableModels,
			currentConfig.model
		);

		// Advanced settings
		temperatureSlider.value = currentConfig.temperature;
		temperatureValue.textContent = currentConfig.temperature;

		topKSlider.value = currentConfig.topK;
		topKValue.textContent = currentConfig.topK;

		topPSlider.value = currentConfig.topP;
		topPValue.textContent = currentConfig.topP;

		maxTokensSlider.value = currentConfig.maxOutputTokens;
		maxTokensValue.textContent = currentConfig.maxOutputTokens;

		// Content selectors
		contentSelectorsTextarea.value =
			currentConfig.contentSelectors.join("\n");
	} catch (error) {
		showStatus("Error loading settings: " + error.message, "error");
	}
}

// Populate the model selector dropdown
function populateModelSelector(models, selectedModelId) {
	modelSelect.innerHTML = "";

	// Sort models to show newest first
	models.sort((a, b) => {
		// Prioritize Gemini 2.0 models
		if (a.id.includes("2.0") && !b.id.includes("2.0")) return -1;
		if (!a.id.includes("2.0") && b.id.includes("2.0")) return 1;
		// Then Gemini 1.5 models
		if (a.id.includes("1.5") && !b.id.includes("1.5")) return -1;
		if (!a.id.includes("1.5") && b.id.includes("1.5")) return 1;
		// Fall back to alphabetical
		return a.name.localeCompare(b.name);
	});

	models.forEach((model) => {
		const option = document.createElement("option");
		option.value = model.id;
		option.textContent = model.name;
		if (model.id === selectedModelId) {
			option.selected = true;
		}
		modelSelect.appendChild(option);
	});
}

// Refresh the available models list
async function refreshAvailableModels() {
	try {
		refreshModelsBtn.disabled = true;
		refreshModelsBtn.textContent = "Refreshing...";

		const models = await config.refreshModels();
		if (models) {
			// Get current selected model
			const currentModel = modelSelect.value;

			// Re-populate the dropdown
			populateModelSelector(models, currentModel);
			showStatus("Models refreshed successfully!", "success");
		} else {
			showStatus("No models found or API key invalid", "error");
		}
	} catch (error) {
		showStatus("Error refreshing models: " + error.message, "error");
	} finally {
		refreshModelsBtn.disabled = false;
		refreshModelsBtn.textContent = "Refresh Models";
	}
}

// Save basic settings
async function saveBasicSettings() {
	try {
		// Validate API key if changed
		const currentConfig = await config.loadConfig();
		if (apiKeyInput.value !== currentConfig.apiKey) {
			saveBasicSettingsBtn.textContent = "Validating API Key...";
			saveBasicSettingsBtn.disabled = true;

			const validationResult = await validateApiKey(apiKeyInput.value);

			if (!validationResult.valid) {
				showStatus(
					`Invalid API Key: ${validationResult.error}`,
					"error"
				);
				saveBasicSettingsBtn.textContent = "Save Settings";
				saveBasicSettingsBtn.disabled = false;

				// Show validation message with link
				const validationContainer = createApiKeyValidationContainer();
				validationContainer.textContent =
					"✗ Invalid API key: " + validationResult.error;
				validationContainer.className = "invalid";
				validationContainer.style.color = "red";

				// Add link to get API key
				validationContainer.appendChild(document.createElement("br"));
				const getApiLink = document.createElement("a");
				getApiLink.href = "https://makersuite.google.com/app/apikey";
				getApiLink.textContent =
					"Get a Gemini API key from Google AI Studio";
				getApiLink.target = "_blank";
				getApiLink.style.display = "inline-block";
				getApiLink.style.marginTop = "5px";
				getApiLink.style.color = "#4285f4";
				getApiLink.addEventListener("click", (e) => {
					e.preventDefault();
					browser.tabs.create({ url: getApiLink.href });
				});
				validationContainer.appendChild(getApiLink);

				return;
			}
		}

		// Continue with saving if valid
		await config.saveMultipleConfig({
			apiKey: apiKeyInput.value,
			customPrompt: promptTextarea.value,
			autoNavigate: autoNavigateCheckbox.checked,
			showWatermarks: showWatermarksCheckbox.checked,
			showPageWatermark: showPageWatermarkCheckbox.checked,
			showChapterWatermark: showChapterWatermarkCheckbox.checked,
			debugMode: debugModeCheckbox.checked,
			model: modelSelect.value,
		});

		// Notify content scripts of settings update
		browser.tabs
			.query({ active: true, currentWindow: true })
			.then((tabs) => {
				if (tabs[0]) {
					browser.tabs.sendMessage(tabs[0].id, {
						action: "settingsUpdated",
						autoNavigate: autoNavigateCheckbox.checked,
						showWatermarks: showWatermarksCheckbox.checked,
						showPageWatermark: showPageWatermarkCheckbox.checked,
						showChapterWatermark:
							showChapterWatermarkCheckbox.checked,
						debugMode: debugModeCheckbox.checked,
					});
				}
			});

		showStatus("Basic settings saved!", "success");
	} catch (error) {
		showStatus("Error saving settings: " + error.message, "error");
	} finally {
		saveBasicSettingsBtn.textContent = "Save Settings";
		saveBasicSettingsBtn.disabled = false;
	}
}

// Save advanced settings
async function saveAdvancedSettings() {
	try {
		// Parse content selectors from textarea
		const contentSelectors = contentSelectorsTextarea.value
			.split("\n")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		await config.saveMultipleConfig({
			temperature: parseFloat(temperatureSlider.value),
			topK: parseInt(topKSlider.value),
			topP: parseFloat(topPSlider.value),
			maxOutputTokens: parseInt(maxTokensSlider.value),
			contentSelectors: contentSelectors,
		});

		showStatus("Advanced settings saved!", "success");
	} catch (error) {
		showStatus("Error saving settings: " + error.message, "error");
	}
}

// Reset prompt to default
async function resetPrompt() {
	promptTextarea.value = config.DEFAULT_CONFIG.defaultPrompt;
	await config.saveConfig(
		"customPrompt",
		config.DEFAULT_CONFIG.defaultPrompt
	);
	showStatus("Prompt reset to default!", "success");
}

// Reset advanced settings to default
async function resetAdvancedSettings() {
	try {
		// Reset sliders
		temperatureSlider.value = config.DEFAULT_CONFIG.temperature;
		temperatureValue.textContent = config.DEFAULT_CONFIG.temperature;

		topKSlider.value = config.DEFAULT_CONFIG.topK;
		topKValue.textContent = config.DEFAULT_CONFIG.topK;

		topPSlider.value = config.DEFAULT_CONFIG.topP;
		topPValue.textContent = config.DEFAULT_CONFIG.topP;

		maxTokensSlider.value = config.DEFAULT_CONFIG.maxOutputTokens;
		maxTokensValue.textContent = config.DEFAULT_CONFIG.maxOutputTokens;

		// Reset content selectors
		contentSelectorsTextarea.value =
			config.DEFAULT_CONFIG.contentSelectors.join("\n");

		// Save to storage
		await config.saveMultipleConfig({
			temperature: config.DEFAULT_CONFIG.temperature,
			topK: config.DEFAULT_CONFIG.topK,
			topP: config.DEFAULT_CONFIG.topP,
			maxOutputTokens: config.DEFAULT_CONFIG.maxOutputTokens,
			contentSelectors: config.DEFAULT_CONFIG.contentSelectors,
		});

		showStatus("Advanced settings reset to default!", "success");
	} catch (error) {
		showStatus("Error resetting settings: " + error.message, "error");
	}
}

// Show status message
function showStatus(message, type) {
	statusDiv.textContent = message;
	statusDiv.className = `status ${type}`;

	// Clear status after 3 seconds
	setTimeout(() => {
		statusDiv.className = "status";
	}, 3000);
}

// Validate API key before saving
async function validateApiKey(apiKey) {
	if (!apiKey || apiKey.trim() === "") {
		return { valid: false, error: "API key cannot be empty" };
	}

	try {
		// First try to just list available models - this is less likely to fail
		// and gives us useful info about what models are available
		const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

		// Show that we're validating in the UI
		const validationContainer =
			document.getElementById("api-key-validation");
		if (validationContainer) {
			validationContainer.textContent = "Validating...";
			validationContainer.className = "validating";
			validationContainer.style.color = "#666";
		}

		// First, test if we can list models (simpler check)
		const response = await fetch(modelsUrl);

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(
				errorData.error?.message || `HTTP error: ${response.status}`
			);
		}

		// If we get here, the API key is valid for accessing the models list
		const data = await response.json();

		// Process the models for return
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

		// Make sure there's at least one valid Gemini model
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
		}
	}

	return name;
}

document.addEventListener("DOMContentLoaded", async () => {
	const apiKeyInput = document.getElementById("api-key");
	const saveApiKeyBtn = document.getElementById("save-api-key");
	const apiStatus = document.getElementById("api-status");
	const promptSelect = document.getElementById("prompt-select");
	const usePromptBtn = document.getElementById("use-prompt");
	const promptEditor = document.getElementById("prompt-editor");
	const addPromptBtn = document.getElementById("add-prompt");
	const savePromptBtn = document.getElementById("save-prompt");
	const deletePromptBtn = document.getElementById("delete-prompt");
	const enhanceChapterBtn = document.getElementById("enhance-chapter");
	const restoreOriginalBtn = document.getElementById("restore-original");
	const statusMessage = document.getElementById("status-message");

	// Load saved API key
	const { apiKey } = (await browser.storage.local.get("apiKey")) || {};
	if (apiKey) {
		apiKeyInput.value = apiKey;
		apiStatus.textContent = "API key is set";
		apiStatus.classList.add("success");
	}

	// Save API key
	saveApiKeyBtn.addEventListener("click", async () => {
		const key = apiKeyInput.value.trim();
		if (key) {
			await browser.storage.local.set({ apiKey: key });
			apiStatus.textContent = "API key saved successfully";
			apiStatus.classList.add("success");
			apiStatus.classList.remove("error");
		} else {
			apiStatus.textContent = "API key cannot be empty";
			apiStatus.classList.add("error");
			apiStatus.classList.remove("success");
		}
	});

	// Load prompts
	async function loadPrompts() {
		const { prompts, activePromptId } = (await browser.storage.local.get([
			"prompts",
			"activePromptId",
		])) || { prompts: [] };

		// Clear existing options
		promptSelect.innerHTML = "";

		// Add default prompt if none exist
		if (!prompts || prompts.length === 0) {
			const defaultPrompts = [
				{
					id: "default",
					name: "Default Enhancement",
					template:
						"Enhance this novel chapter translation by fixing grammar, making the text flow naturally, correcting gender pronouns if needed, and making fight scenes more concise. Preserve the story content exactly as is.",
				},
				{
					id: "detailed",
					name: "Detailed Enhancement",
					template:
						"Enhance this novel chapter translation by fixing grammar, making the text flow naturally, correcting gender pronouns if needed, and adding more detail to descriptions. Preserve the story content exactly as is.",
				},
			];

			await browser.storage.local.set({
				prompts: defaultPrompts,
				activePromptId: "default",
			});
			return loadPrompts(); // Reload after setting defaults
		}

		// Populate select dropdown
		prompts.forEach((prompt) => {
			const option = document.createElement("option");
			option.value = prompt.id;
			option.textContent = prompt.name;
			if (prompt.id === activePromptId) {
				option.selected = true;
				promptEditor.value = prompt.template;
			}
			promptSelect.appendChild(option);
		});
	}

	// Load prompts on startup
	await loadPrompts();

	// Change prompt in editor when selected from dropdown
	promptSelect.addEventListener("change", async () => {
		const { prompts } = await browser.storage.local.get("prompts");
		const selectedPrompt = prompts.find((p) => p.id === promptSelect.value);
		if (selectedPrompt) {
			promptEditor.value = selectedPrompt.template;
		}
	});

	// Set active prompt
	usePromptBtn.addEventListener("click", async () => {
		await browser.storage.local.set({ activePromptId: promptSelect.value });
		statusMessage.textContent = "Prompt selected for use";
		setTimeout(() => {
			statusMessage.textContent = "";
		}, 2000);
	});

	// Save edited prompt
	savePromptBtn.addEventListener("click", async () => {
		const { prompts } = await browser.storage.local.get("prompts");
		const promptId = promptSelect.value;
		const updatedPrompts = prompts.map((p) => {
			if (p.id === promptId) {
				return { ...p, template: promptEditor.value };
			}
			return p;
		});

		await browser.storage.local.set({ prompts: updatedPrompts });
		statusMessage.textContent = "Prompt saved successfully";
		setTimeout(() => {
			statusMessage.textContent = "";
		}, 2000);
	});

	// Add new prompt
	addPromptBtn.addEventListener("click", async () => {
		const promptName = prompt(
			"Enter name for the new prompt:",
			"New Prompt"
		);
		if (!promptName) return;

		const { prompts } = await browser.storage.local.get("prompts");
		const newId = "prompt_" + Date.now();
		const newPrompt = {
			id: newId,
			name: promptName,
			template:
				promptEditor.value || "Enter your prompt template here...",
		};

		prompts.push(newPrompt);
		await browser.storage.local.set({ prompts });
		await loadPrompts();

		// Select the new prompt
		promptSelect.value = newId;

		statusMessage.textContent = "New prompt created";
		setTimeout(() => {
			statusMessage.textContent = "";
		}, 2000);
	});

	// Delete prompt
	deletePromptBtn.addEventListener("click", async () => {
		const promptId = promptSelect.value;

		if (promptId === "default") {
			statusMessage.textContent = "Cannot delete the default prompt";
			statusMessage.classList.add("error");
			setTimeout(() => {
				statusMessage.textContent = "";
				statusMessage.classList.remove("error");
			}, 2000);
			return;
		}

		if (confirm("Are you sure you want to delete this prompt?")) {
			const { prompts, activePromptId } = await browser.storage.local.get(
				["prompts", "activePromptId"]
			);
			const updatedPrompts = prompts.filter((p) => p.id !== promptId);

			// If we're deleting the active prompt, switch to default
			let newActiveId = activePromptId;
			if (activePromptId === promptId) {
				newActiveId = "default";
			}

			await browser.storage.local.set({
				prompts: updatedPrompts,
				activePromptId: newActiveId,
			});
			await loadPrompts();

			statusMessage.textContent = "Prompt deleted";
			setTimeout(() => {
				statusMessage.textContent = "";
			}, 2000);
		}
	});

	// Enhance current chapter
	enhanceChapterBtn.addEventListener("click", async () => {
		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (tabs[0]) {
			statusMessage.textContent = "Processing chapter...";
			browser.tabs
				.sendMessage(tabs[0].id, { action: "enhanceChapter" })
				.then((response) => {
					if (response && response.success) {
						statusMessage.textContent =
							"Chapter enhanced successfully";
					} else {
						statusMessage.textContent =
							"Error: " + (response?.error || "Unknown error");
						statusMessage.classList.add("error");
						setTimeout(
							() => statusMessage.classList.remove("error"),
							3000
						);
					}
				})
				.catch((error) => {
					statusMessage.textContent = "Error: " + error.message;
					statusMessage.classList.add("error");
					setTimeout(
						() => statusMessage.classList.remove("error"),
						3000
					);
				});
		}
	});

	// Restore original chapter content
	restoreOriginalBtn.addEventListener("click", async () => {
		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (tabs[0]) {
			browser.tabs
				.sendMessage(tabs[0].id, { action: "restoreOriginal" })
				.then((response) => {
					if (response && response.success) {
						statusMessage.textContent = "Original content restored";
					} else {
						statusMessage.textContent =
							"Error: No original content saved";
						statusMessage.classList.add("error");
						setTimeout(
							() => statusMessage.classList.remove("error"),
							3000
						);
					}
				})
				.catch((error) => {
					statusMessage.textContent = "Error: " + error.message;
					statusMessage.classList.add("error");
					setTimeout(
						() => statusMessage.classList.remove("error"),
						3000
					);
				});
		}
	});
});
