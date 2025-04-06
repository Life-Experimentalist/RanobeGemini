// Simple popup script for Ranobe Gemini

// Define default prompt in case constants can't be loaded
const DEFAULT_PROMPT = `Please enhance this novel chapter translation with the following improvements:

1. Fix grammatical errors, punctuation mistakes, and spelling issues
2. Improve the narrative flow and overall readability
3. Ensure consistent character voice, tone, and gender pronouns throughout
4. Make dialogue sound more natural and conversational
5. Refine descriptions to be more vivid and engaging
6. Maintain the original plot points, character development, and story elements exactly
7. Format paragraphs properly with HTML paragraph tags (<p>) for each paragraph
8. Handle dialogue formatting with appropriate punctuation and paragraph breaks
9. Streamline overly verbose sections while preserving important details
10. Ensure proper transitioning between scenes and ideas

Do not use markdown formatting in your response. Present the enhanced text using only HTML paragraph tags. Keep the core meaning of the original text intact while making it feel like a professionally translated novel. Preserve all original story elements including character names, locations, and plot points precisely.`;

document.addEventListener("DOMContentLoaded", async function () {
	// DOM elements
	const apiKeyInput = document.getElementById("apiKey");
	const saveApiKeyBtn = document.getElementById("saveApiKey");
	const testApiKeyBtn = document.getElementById("testApiKey");
	const enhancePageBtn = document.getElementById("enhancePageBtn");
	const getKeyLink = document.getElementById("getKeyLink");
	const statusDiv = document.getElementById("status");
	const modelSelect = document.getElementById("modelSelect");
	const promptTemplate = document.getElementById("promptTemplate");
	const resetPromptBtn = document.getElementById("resetPrompt");
	const debugModeCheckbox = document.getElementById("debugMode");
	const saveSettingsBtn = document.getElementById("saveSettings");
	const tabButtons = document.querySelectorAll(".tab-btn");
	const tabContents = document.querySelectorAll(".tab-content");
	const chunkingEnabledCheckbox = document.getElementById("chunkingEnabled");

	// Enable resizing of the popup
	setupResizing();
	const resizeHandle = document.getElementById("resize-handle");
	let isResizing = false;
	let startX, startY, startWidth, startHeight;

	// Function to fetch available Gemini models
	async function fetchAvailableModels(apiKey) {
		if (!apiKey) return null;

		try {
			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
			);

			if (!response.ok) {
				throw new Error(`HTTP error ${response.status}`);
			}

			const data = await response.json();

			// Filter for Gemini models that support text generation
			const geminiModels = data.models
				.filter(
					(model) =>
						model.name.includes("gemini") &&
						model.supportedGenerationMethods &&
						model.supportedGenerationMethods.includes(
							"generateContent"
						)
				)
				.map((model) => {
					// Extract the model name from the full path
					const id = model.name.split("/").pop();
					return {
						id: id,
						displayName: formatModelName(id),
						endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`,
					};
				});

			return geminiModels;
		} catch (error) {
			console.error("Error fetching models:", error);
			return null;
		}
	}

	// Format model name for display
	function formatModelName(modelId) {
		// Convert model IDs like "gemini-1.5-flash" to "Gemini 1.5 Flash"
		return modelId
			.replace("gemini-", "Gemini ")
			.replace(/-/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	// Update model selector with available models
	async function updateModelSelector(apiKey) {
		try {
			// Show loading state
			modelSelect.innerHTML =
				'<option value="">Loading models...</option>';
			modelSelect.disabled = true;

			// Fetch models
			const models = await fetchAvailableModels(apiKey);

			if (!models || models.length === 0) {
				modelSelect.innerHTML =
					'<option value="">No models available</option>';
				return;
			}

			// Get current selection if any
			const currentSettings = await browser.storage.local.get([
				"selectedModelId",
				"modelEndpoint",
			]);
			let selectedModelId = currentSettings.selectedModelId || "";

			// Sort models with Gemini 2.0 models first, then 1.5, then others
			models.sort((a, b) => {
				if (a.id.includes("2.0") && !b.id.includes("2.0")) return -1;
				if (!a.id.includes("2.0") && b.id.includes("2.0")) return 1;
				if (a.id.includes("1.5") && !b.id.includes("1.5")) return -1;
				if (!a.id.includes("1.5") && b.id.includes("1.5")) return 1;
				return a.displayName.localeCompare(b.displayName);
			});

			// Clear and populate the select
			modelSelect.innerHTML = "";

			models.forEach((model) => {
				const option = document.createElement("option");
				option.value = model.id;
				option.textContent = model.displayName;

				// If there's no selection yet, prefer gemini-2.0-flash as default
				if (!selectedModelId && model.id === "gemini-2.0-flash") {
					selectedModelId = model.id;
				}

				modelSelect.appendChild(option);
			});

			// Set selection based on previous setting or default
			if (selectedModelId) {
				modelSelect.value = selectedModelId;
			} else if (currentSettings.modelEndpoint) {
				// Try to match from endpoint if no direct ID
				const modelId = currentSettings.modelEndpoint
					.split("/")
					.pop()
					.split(":")[0];
				if (
					modelId &&
					modelSelect.querySelector(`option[value="${modelId}"]`)
				) {
					modelSelect.value = modelId;
				} else {
					// Default to first option if no match found
					modelSelect.selectedIndex = 0;
				}
			} else {
				// Default to first option if no previous selection
				modelSelect.selectedIndex = 0;
			}

			// Save the available models for later use
			await browser.storage.local.set({
				availableModels: models,
				selectedModelId: modelSelect.value,
				modelsLastFetched: Date.now(),
			});
		} catch (error) {
			console.error("Error updating model selector:", error);
			modelSelect.innerHTML =
				'<option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option><option value="gemini-1.5-flash">Gemini 1.5 Flash</option><option value="gemini-1.5-pro">Gemini 1.5 Pro</option>';
		} finally {
			modelSelect.disabled = false;
		}
	}

	// Make textareas automatically resize to fit content
	const textareas = document.querySelectorAll("textarea");
	textareas.forEach((textarea) => {
		// Function to adjust height
		function adjustHeight() {
			textarea.style.height = "auto";
			textarea.style.height = textarea.scrollHeight + "px";
		}

		// Set initial height
		adjustHeight();

		// Add event listeners
		textarea.addEventListener("input", adjustHeight);
		textarea.addEventListener("focus", adjustHeight);
	});

	// Function to handle the resizing
	function handleResize(e) {
		if (!isResizing) return;

		// Calculate new dimensions
		const newWidth = startWidth + (e.clientX - startX);
		const newHeight = startHeight + (e.clientY - startY);

		// Apply minimum dimensions
		const width = Math.max(320, newWidth);
		const height = Math.max(400, newHeight);

		// Set the dimensions
		document.body.style.width = width + "px";
		document.body.style.height = height + "px";

		// Save dimensions to storage for persistence
		browser.storage.local.set({
			popupWidth: width,
			popupHeight: height,
		});
	}

	// Start resizing
	resizeHandle.addEventListener("mousedown", (e) => {
		isResizing = true;
		startX = e.clientX;
		startY = e.clientY;
		startWidth = document.body.offsetWidth;
		startHeight = document.body.offsetHeight;

		// Add event listeners for resize tracking
		document.addEventListener("mousemove", handleResize);
		document.addEventListener("mouseup", () => {
			isResizing = false;
			document.removeEventListener("mousemove", handleResize);
		});

		e.preventDefault();
	});

	// Load saved dimensions
	browser.storage.local.get(["popupWidth", "popupHeight"]).then((result) => {
		if (result.popupWidth && result.popupHeight) {
			document.body.style.width = result.popupWidth + "px";
			document.body.style.height = result.popupHeight + "px";
		}
	});

	// Tab switching functionality
	tabButtons.forEach((button) => {
		button.addEventListener("click", () => {
			// Remove active class from all buttons and contents
			tabButtons.forEach((btn) => btn.classList.remove("active"));
			tabContents.forEach((content) =>
				content.classList.remove("active")
			);

			// Add active class to clicked button
			button.classList.add("active");

			// Show corresponding content
			const tabId = button.getAttribute("data-tab");
			document.getElementById(tabId).classList.add("active");
		});
	});

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

	// Load settings from storage
	try {
		const data = await browser.storage.local.get();

		if (data.apiKey) {
			apiKeyInput.value = data.apiKey;

			// If we have an API key, load available models
			await updateModelSelector(data.apiKey);
		} else {
			// No API key, use static default options
			modelSelect.innerHTML = `
				<option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option>
				<option value="gemini-1.5-flash">Gemini 1.5 Flash (Faster)</option>
				<option value="gemini-1.5-pro">Gemini 1.5 Pro (Better quality)</option>
			`;
		}

		// Always set the prompt template - this fixes the empty box issue
		promptTemplate.value = data.defaultPrompt || DEFAULT_PROMPT;

		// Set model selection based on saved endpoint
		if (data.modelEndpoint) {
			if (data.modelEndpoint.includes("gemini-2.0-flash")) {
				modelSelect.value = "gemini-2.0-flash";
			} else if (data.modelEndpoint.includes("gemini-1.5-pro")) {
				modelSelect.value = "gemini-1.5-pro";
			} else if (data.modelEndpoint.includes("gemini-1.5-flash")) {
				modelSelect.value = "gemini-1.5-flash";
			} else {
				// Default to gemini-2.0-flash if endpoint doesn't match any known model
				modelSelect.value = "gemini-2.0-flash";
			}
		} else {
			// Default to gemini-2.0-flash if no endpoint is specified
			modelSelect.value = "gemini-2.0-flash";
		}

		// Set debug mode checkbox
		debugModeCheckbox.checked = data.debugMode || false;

		// Set chunking checkbox state
		chunkingEnabledCheckbox.checked = data.chunkingEnabled !== false; // Default to true
	} catch (error) {
		console.error("Error loading settings:", error);
		// If settings fail to load, at least set the default prompt
		if (promptTemplate && !promptTemplate.value) {
			promptTemplate.value = DEFAULT_PROMPT;
		}
	}

	// Save individual API key and refresh models
	saveApiKeyBtn.addEventListener("click", async () => {
		const apiKey = apiKeyInput.value.trim();

		if (!apiKey) {
			showStatus("Please enter a valid API key", "error");
			return;
		}

		try {
			await browser.storage.local.set({ apiKey });
			showStatus("API key saved successfully!", "success");

			// Refresh model list with new API key
			await updateModelSelector(apiKey);
		} catch (error) {
			console.error("Error saving API key:", error);
			showStatus("Error saving API key: " + error.message, "error");
		}
	});

	// Test API key and update models list
	testApiKeyBtn.addEventListener("click", async () => {
		const apiKey = apiKeyInput.value.trim();

		if (!apiKey) {
			showStatus("Please enter an API key to test", "error");
			return;
		}

		try {
			showStatus("Testing API key and fetching models...", "info");
			testApiKeyBtn.disabled = true;

			// Fetch models first to validate API key
			const models = await fetchAvailableModels(apiKey);

			if (models && models.length > 0) {
				// Update model dropdown
				await updateModelSelector(apiKey);

				// Auto-save the API key if valid
				await browser.storage.local.set({ apiKey });

				showStatus("API key is valid! Models loaded ✓", "success");
			} else {
				showStatus(
					"API key appears invalid or no models available",
					"error"
				);
			}
		} catch (error) {
			console.error("API key test error:", error);
			showStatus(`Error testing API key: ${error.message}`, "error");
		} finally {
			testApiKeyBtn.disabled = false;
		}
	});

	// Save all settings including model selection
	saveSettingsBtn.addEventListener("click", async () => {
		const apiKey = apiKeyInput.value.trim();
		const selectedModelId = modelSelect.value;

		if (!apiKey) {
			showStatus("Please enter a valid API key", "error");
			return;
		}

		try {
			// Determine model endpoint based on selection
			let modelEndpoint;

			// Try to find the model endpoint from stored available models
			const storedData = await browser.storage.local.get(
				"availableModels"
			);
			if (storedData.availableModels) {
				const selectedModel = storedData.availableModels.find(
					(m) => m.id === selectedModelId
				);
				if (selectedModel) {
					modelEndpoint = selectedModel.endpoint;
				}
			}

			// Fallback to constructing the endpoint if not found
			if (!modelEndpoint) {
				modelEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModelId}:generateContent`;
			}

			await browser.storage.local.set({
				apiKey: apiKey,
				defaultPrompt: promptTemplate.value,
				modelEndpoint: modelEndpoint,
				selectedModelId: selectedModelId,
				debugMode: debugModeCheckbox.checked,
				chunkingEnabled: chunkingEnabledCheckbox.checked, // Save the chunking setting
				maxOutputTokens: 8192, // Default value
				temperature: 0.7, // Default value
			});

			showStatus("All settings saved successfully!", "success");
		} catch (error) {
			console.error("Error saving settings:", error);
			showStatus("Error saving settings: " + error.message, "error");
		}
	});

	// Reset prompt to default
	resetPromptBtn.addEventListener("click", () => {
		promptTemplate.value = DEFAULT_PROMPT;
		showStatus("Prompt reset to default", "info");
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

					if (
						error.message?.includes(
							"could not establish connection"
						)
					) {
						showStatus(
							"Error: This page is not supported by the extension.",
							"error"
						);
					} else {
						showStatus("Error: " + error.message, "error");
					}
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

	// Add refresh models button functionality
	const refreshModelsBtn = document.getElementById("refreshModels");
	if (refreshModelsBtn) {
		refreshModelsBtn.addEventListener("click", async () => {
			const apiKey = apiKeyInput.value.trim();
			if (!apiKey) {
				showStatus("Please enter an API key first", "error");
				return;
			}

			try {
				refreshModelsBtn.disabled = true;
				refreshModelsBtn.textContent = "⟳";
				await updateModelSelector(apiKey);
				showStatus("Models refreshed successfully", "success");
			} catch (error) {
				showStatus(
					"Error refreshing models: " + error.message,
					"error"
				);
			} finally {
				refreshModelsBtn.disabled = false;
				refreshModelsBtn.textContent = "↻";
			}
		});
	}

	// Add auto-refresh of models list when dropdown is clicked
	modelSelect.addEventListener("mousedown", async function (e) {
		// Only check if we haven't refreshed models recently
		const data = await browser.storage.local.get([
			"modelsLastFetched",
			"apiKey",
		]);
		const lastFetched = data.modelsLastFetched || 0;
		const now = Date.now();

		// Refresh models if it's been more than 1 hour since last fetch
		if (now - lastFetched > 3600000 && data.apiKey) {
			e.preventDefault(); // Prevent default dropdown behavior
			await updateModelSelector(data.apiKey);
			// Now allow the dropdown to open
			setTimeout(() => modelSelect.click(), 100);
		}
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

// Improved resizing functionality
function setupResizing() {
	const resizeHandle = document.getElementById("resize-handle");
	const sizeIndicator = document.getElementById("sizeIndicator");
	let isResizing = false;
	let startX, startY, startWidth, startHeight;

	// Default popup dimensions
	const DEFAULT_WIDTH = 380;
	const DEFAULT_HEIGHT = 500;
	const MIN_WIDTH = 320;
	const MIN_HEIGHT = 400;
	const MAX_WIDTH = 800;
	const MAX_HEIGHT = 900;

	// Load saved dimensions on startup
	browser.storage.local.get(["popupWidth", "popupHeight"]).then((result) => {
		if (result.popupWidth && result.popupHeight) {
			setSize(result.popupWidth, result.popupHeight);
		} else {
			// Set default size
			setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
		}
	});

	// Handle resize start
	resizeHandle.addEventListener("mousedown", (e) => {
		isResizing = true;
		startX = e.clientX;
		startY = e.clientY;
		startWidth = document.body.offsetWidth;
		startHeight = document.body.offsetHeight;

		// Display size indicator
		updateSizeIndicator(startWidth, startHeight);
		sizeIndicator.classList.add("visible");

		// Add event listeners for tracking
		document.addEventListener("mousemove", handleResize);
		document.addEventListener("mouseup", stopResize);

		// Prevent default behavior
		e.preventDefault();
	});

	// Handle resizing
	function handleResize(e) {
		if (!isResizing) return;

		// Calculate new dimensions
		let newWidth = startWidth + (e.clientX - startX);
		let newHeight = startHeight + (e.clientY - startY);

		// Apply constraints
		newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
		newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, newHeight));

		// Apply new size
		setSize(newWidth, newHeight);

		// Update size indicator
		updateSizeIndicator(newWidth, newHeight);
	}

	// Stop resizing
	function stopResize() {
		if (isResizing) {
			isResizing = false;

			// Save current dimensions
			browser.storage.local.set({
				popupWidth: document.body.offsetWidth,
				popupHeight: document.body.offsetHeight,
			});

			// Hide size indicator with a delay
			setTimeout(() => {
				sizeIndicator.classList.remove("visible");
			}, 800);

			// Remove event listeners
			document.removeEventListener("mousemove", handleResize);
			document.removeEventListener("mouseup", stopResize);
		}
	}

	// Set size with safety checks
	function setSize(width, height) {
		document.body.style.width = width + "px";
		document.body.style.height = height + "px";
	}

	// Update size indicator
	function updateSizeIndicator(width, height) {
		sizeIndicator.textContent = `${Math.round(width)} × ${Math.round(
			height
		)}`;
	}

	// Double-click to reset size
	resizeHandle.addEventListener("dblclick", () => {
		setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
		browser.storage.local.set({
			popupWidth: DEFAULT_WIDTH,
			popupHeight: DEFAULT_HEIGHT,
		});
		updateSizeIndicator(DEFAULT_WIDTH, DEFAULT_HEIGHT);
		sizeIndicator.classList.add("visible");
		setTimeout(() => {
			sizeIndicator.classList.remove("visible");
		}, 800);
	});
}
