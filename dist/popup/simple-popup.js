// Simple popup script for Ranobe Gemini

import { DEFAULT_CHUNK_SIZE } from "../utils/constants.js";

// Define default prompt in case constants can't be loaded
const DEFAULT_PROMPT = `Please enhance this novel chapter translation with the following improvements:

1. Fix grammatical errors, punctuation mistakes, and spelling issues
2. Improve the narrative flow and overall readability
3. Ensure consistent character voice, tone, and gender pronouns throughout
4. Make dialogue sound more natural and conversational
5. Refine descriptions to be more vivid and engaging
6. Maintain the original plot points, character development, and story elements exactly
7. Streamline overly verbose sections while preserving important details
8. Ensure proper transitioning between scenes and ideas

Keep the core meaning of the original text intact while making it feel like a professionally translated novel. Preserve all original story elements including character names, locations, and plot points precisely.`;

// Define default summary prompt
const DEFAULT_SUMMARY_PROMPT = `Please generate a comprehensive summary of the provided novel chapter, ensuring the following aspects are covered:
1.  **Major Plot Points:** Detail the main sequence of events and key developments that advance the story within this chapter.
2.  **Character Interactions & Development:** Describe significant interactions between characters, notable character introductions, important decisions made by characters, and any expressed motivations or changes in character state.
3.  **Key Reveals & Information:** Clearly mention any crucial information revealed, secrets uncovered, unique abilities or concepts introduced (like 'Sacred Gear'), prophecies, or significant plot twists occurring in this chapter.
4.  **Setting & Atmosphere:** Briefly incorporate significant details about the setting(s) and any notable shifts in mood, tone, or atmosphere relevant to the chapter's events.
5.  **Thematic Elements:** Touch upon any central themes that are prominent or introduced within this specific chapter (e.g., survival, fear, destiny, adjustment).
6.  **Character Dynamics:** Highlight any changes in relationships or dynamics between characters, including alliances, rivalries, or emotional shifts.
7.  **Foreshadowing & Future Implications:** Note any hints or foreshadowing of future events, character arcs, or plot developments that are introduced in this chapter.
8.  **Conflict & Tension:** Identify any conflicts (internal or external) that arise in this chapter, including character struggles, interpersonal conflicts, or larger narrative tensions.
9.  **Symbolism & Motifs:** Mention any recurring symbols, motifs, or imagery that are significant to the chapter's content.
10. **Narrative Style & Tone:** Comment on the narrative style, tone, and perspective used in this chapter, including any shifts or unique stylistic choices.
11. **Cultural References:** If applicable, include any cultural references or allusions that are relevant to the chapter's context.
12. **Character Names & Titles:** Ensure all character names and titles are accurately represented, including any honorifics or specific titles used in the original text.
13. **Important Objects or Artifacts:** Note any significant objects, artifacts, or items introduced in this chapter that may have relevance to the plot or character development.
14. **Dialogue Highlights:** Include any particularly impactful or memorable lines of dialogue that encapsulate character emotions or plot points, but ensure they are not the main focus of the summary.

**Overall Requirements:**
* The summary must be thorough, capturing the essential substance and depth of the chapter, rather than just a minimal outline.
* Ensure accuracy and rely *only* on information explicitly present within the provided chapter text.
* Maintain clarity and readability for someone needing to understand the chapter's core content.`;

// Define default permanent prompt
const DEFAULT_PERMANENT_PROMPT =
	"Ensure the output is formatted using only HTML paragraph tags (<p>) for each paragraph. Handle dialogue formatting with appropriate punctuation and paragraph breaks. Do not use markdown formatting in your response.";

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
	const summaryPrompt = document.getElementById("summaryPrompt"); // Get summary prompt textarea
	const resetSummaryPromptBtn = document.getElementById("resetSummaryPrompt"); // Get summary prompt reset button
	const permanentPrompt = document.getElementById("permanentPrompt"); // Get permanent prompt textarea
	const resetPermanentPromptBtn = document.getElementById(
		"resetPermanentPrompt"
	); // Get permanent prompt reset button
	const debugModeCheckbox = document.getElementById("debugMode");
	const saveSettingsBtn = document.getElementById("saveSettings");
	const tabButtons = document.querySelectorAll(".tab-btn");
	const tabContents = document.querySelectorAll(".tab-content");
	const chunkingEnabledCheckbox = document.getElementById("chunkingEnabled");
	const chunkSizeContainer = document.getElementById("chunkSizeContainer");
	const chunkSizeInput = document.getElementById("chunkSize");
	const maxOutputTokensInput = document.getElementById("maxOutputTokens");
	const temperatureSlider = document.getElementById("temperatureSlider");
	const temperatureValue = document.getElementById("temperatureValue");
	const topPSlider = document.getElementById("topPSlider");
	const topPValue = document.getElementById("topPValue");
	const topKSlider = document.getElementById("topKSlider");
	const topKValue = document.getElementById("topKValue");
	const customEndpointInput = document.getElementById("customEndpoint");
	const saveAdvancedSettingsBtn = document.getElementById(
		"saveAdvancedSettings"
	);
	const resetAllAdvancedBtn = document.getElementById("resetAllAdvanced");
	const toggleAdvancedParamsBtn = document.getElementById(
		"toggleAdvancedParams"
	);
	const advancedParamsContent = document.getElementById(
		"advancedParamsContent"
	);

	// Novels tab elements
	const refreshNovelsBtn = document.getElementById("refreshNovels");
	const novelsListContainer = document.getElementById("novelsList");

	// Initialize sliders
	if (temperatureSlider && temperatureValue) {
		temperatureSlider.addEventListener("input", () => {
			temperatureValue.textContent = temperatureSlider.value;
		});
	}

	if (topPSlider && topPValue) {
		topPSlider.addEventListener("input", () => {
			topPValue.textContent = topPSlider.value;
		});
	}

	if (topKSlider && topKValue) {
		topKSlider.addEventListener("input", () => {
			topKValue.textContent = topKSlider.value;
		});
	}

	// Toggle advanced parameters section
	if (toggleAdvancedParamsBtn && advancedParamsContent) {
		toggleAdvancedParamsBtn.addEventListener("click", () => {
			toggleAdvancedParamsBtn.classList.toggle("active");
			advancedParamsContent.classList.toggle("active");
		});
	}

	// Set up chunking settings toggle
	function toggleChunkSizeVisibility() {
		chunkSizeContainer.style.display = chunkingEnabledCheckbox.checked
			? "block"
			: "none";
	}

	// Add event listener for chunking checkbox
	chunkingEnabledCheckbox.addEventListener(
		"change",
		toggleChunkSizeVisibility
	);

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

			// Special handling for novels tab
			if (tabId === "novels") {
				loadNovels();
			}
		});
	});

	// FAQ functionality
	const faqQuestions = document.querySelectorAll(".faq-question");
	faqQuestions.forEach((question) => {
		question.addEventListener("click", () => {
			// Toggle active class on the question
			question.classList.toggle("active");

			// Toggle active class on the answer
			const answer = question.nextElementSibling;
			answer.classList.toggle("active");

			// Close other open FAQs (optional, uncomment if you want accordion behavior)
			// faqQuestions.forEach(q => {
			//   if (q !== question && q.classList.contains('active')) {
			//     q.classList.remove('active');
			//     q.nextElementSibling.classList.remove('active');
			//   }
			// });
		});
	});

	// Make FAQ "Get API key" link work the same as the main one
	const faqGetKeyLink = document.getElementById("faqGetKeyLink");
	if (faqGetKeyLink) {
		faqGetKeyLink.addEventListener("click", (e) => {
			e.preventDefault();
			browser.tabs.create({
				url: "https://makersuite.google.com/app/apikey",
			});
		});
	}

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

		// Load summary prompt
		summaryPrompt.value = data.summaryPrompt || DEFAULT_SUMMARY_PROMPT;

		// Load permanent prompt
		permanentPrompt.value =
			data.permanentPrompt || DEFAULT_PERMANENT_PROMPT;

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

		// Set chunk size input value
		chunkSizeInput.value = data.chunkSize || DEFAULT_CHUNK_SIZE;

		// Set emoji checkbox state
		const useEmojiCheckbox = document.getElementById("useEmoji");
		if (useEmojiCheckbox) {
			useEmojiCheckbox.checked = data.useEmoji || false; // Default to false
		}

		// Set max output tokens
		if (maxOutputTokensInput) {
			maxOutputTokensInput.value = data.maxOutputTokens || 8192;
		}

		// Set temperature slider
		if (temperatureSlider && temperatureValue) {
			const temp =
				data.temperature !== undefined ? data.temperature : 0.7;
			temperatureSlider.value = temp;
			temperatureValue.textContent = temp;
		}

		// Set top-p slider
		if (topPSlider && topPValue) {
			const topP = data.topP !== undefined ? data.topP : 0.95;
			topPSlider.value = topP;
			topPValue.textContent = topP;
		}

		// Set top-k slider
		if (topKSlider && topKValue) {
			const topK = data.topK !== undefined ? data.topK : 40;
			topKSlider.value = topK;
			topKValue.textContent = topK;
		}

		// Set custom endpoint
		if (customEndpointInput) {
			customEndpointInput.value = data.customEndpoint || "";
		}

		// Set initial chunk size container visibility
		toggleChunkSizeVisibility();
	} catch (error) {
		console.error("Error loading settings:", error);
		// If settings fail to load, at least set the default prompt
		if (promptTemplate && !promptTemplate.value) {
			promptTemplate.value = DEFAULT_PROMPT;
		}
		// Set default summary prompt on error
		if (summaryPrompt && !summaryPrompt.value) {
			summaryPrompt.value = DEFAULT_SUMMARY_PROMPT;
		}
		// Set default permanent prompt on error
		if (permanentPrompt && !permanentPrompt.value) {
			permanentPrompt.value = DEFAULT_PERMANENT_PROMPT;
		}
		// Set default chunk size on error
		if (chunkSizeInput && !chunkSizeInput.value) {
			chunkSizeInput.value = DEFAULT_CHUNK_SIZE;
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

	// Save all basic settings
	saveSettingsBtn.addEventListener("click", async () => {
		const apiKey = apiKeyInput.value.trim();
		const selectedModelId = modelSelect.value;
		const chunkSize = parseInt(chunkSizeInput.value, 10);
		const useEmojiCheckbox = document.getElementById("useEmoji");
		const maxTokens = parseInt(maxOutputTokensInput.value, 10) || 8192;
		const temperature = parseFloat(temperatureSlider.value);

		if (!apiKey) {
			showStatus("Please enter a valid API key", "error");
			return;
		}

		// Validate chunk size
		if (isNaN(chunkSize) || chunkSize < 5000) {
			showStatus(
				"Please enter a valid chunk size (minimum 5000)",
				"error"
			);
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
				selectedModelId: selectedModelId,
				modelEndpoint: modelEndpoint,
				debugMode: debugModeCheckbox.checked,
				chunkingEnabled: chunkingEnabledCheckbox.checked, // Save the chunking setting
				chunkSize: chunkSize, // Save the chunk size
				useEmoji: useEmojiCheckbox ? useEmojiCheckbox.checked : false, // Save emoji setting
				maxOutputTokens: maxTokens,
				temperature: temperature,
			});

			showStatus("Basic settings saved successfully!", "success");
		} catch (error) {
			console.error("Error saving settings:", error);
			showStatus("Error saving settings: " + error.message, "error");
		}
	});

	// Save advanced settings
	if (saveAdvancedSettingsBtn) {
		saveAdvancedSettingsBtn.addEventListener("click", async () => {
			try {
				const topP = parseFloat(topPSlider.value);
				const topK = parseInt(topKSlider.value, 10);
				const customEndpoint = customEndpointInput.value.trim();

				await browser.storage.local.set({
					defaultPrompt: promptTemplate.value,
					summaryPrompt: summaryPrompt.value,
					permanentPrompt: permanentPrompt.value,
					topP: topP,
					topK: topK,
					customEndpoint: customEndpoint,
				});

				showStatus("Advanced settings saved successfully!", "success");
			} catch (error) {
				console.error("Error saving advanced settings:", error);
				showStatus(
					"Error saving advanced settings: " + error.message,
					"error"
				);
			}
		});
	}

	// Reset all advanced settings
	if (resetAllAdvancedBtn) {
		resetAllAdvancedBtn.addEventListener("click", async () => {
			try {
				// Reset prompts
				promptTemplate.value = DEFAULT_PROMPT;
				summaryPrompt.value = DEFAULT_SUMMARY_PROMPT;
				permanentPrompt.value = DEFAULT_PERMANENT_PROMPT;

				// Reset sliders
				if (topPSlider && topPValue) {
					topPSlider.value = 0.95;
					topPValue.textContent = "0.95";
				}

				if (topKSlider && topKValue) {
					topKSlider.value = 40;
					topKValue.textContent = "40";
				}

				if (customEndpointInput) {
					customEndpointInput.value = "";
				}

				// Save the reset values
				await browser.storage.local.set({
					defaultPrompt: DEFAULT_PROMPT,
					summaryPrompt: DEFAULT_SUMMARY_PROMPT,
					permanentPrompt: DEFAULT_PERMANENT_PROMPT,
					topP: 0.95,
					topK: 40,
					customEndpoint: "",
				});

				showStatus("Advanced settings reset to defaults", "info");
			} catch (error) {
				console.error("Error resetting advanced settings:", error);
				showStatus(
					"Error resetting settings: " + error.message,
					"error"
				);
			}
		});
	}

	// Reset prompt to default
	resetPromptBtn.addEventListener("click", () => {
		promptTemplate.value = DEFAULT_PROMPT;
		showStatus("Enhancement prompt reset to default", "info");
	});

	// Reset summary prompt to default
	resetSummaryPromptBtn.addEventListener("click", () => {
		summaryPrompt.value = DEFAULT_SUMMARY_PROMPT;
		showStatus("Summary prompt reset to default", "info");
	});

	// Reset permanent prompt to default
	resetPermanentPromptBtn.addEventListener("click", () => {
		permanentPrompt.value = DEFAULT_PERMANENT_PROMPT;
		showStatus("Permanent prompt reset to default", "info");
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

	// Novels Tab Functionality

	/**
	 * Format a date string as a relative time (e.g., "2 days ago")
	 * @param {string} dateStr - ISO date string
	 * @returns {string} - Formatted relative time
	 */
	function formatRelativeTime(dateStr) {
		const date = new Date(dateStr);
		const now = new Date();
		const diffTime = Math.abs(now - date);
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
		const diffMinutes = Math.floor(diffTime / (1000 * 60));

		if (diffDays > 30) {
			const months = Math.floor(diffDays / 30);
			return `${months} month${months > 1 ? "s" : ""} ago`;
		} else if (diffDays > 0) {
			return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
		} else if (diffHours > 0) {
			return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
		} else {
			return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
		}
	}

	/**
	 * Format a complete date
	 * @param {string} dateStr - ISO date string
	 * @returns {string} - Formatted date string
	 */
	function formatCompleteDate(dateStr) {
		const date = new Date(dateStr);
		return date.toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	/**
	 * Extract domain from URL
	 * @param {string} url - Full URL
	 * @returns {string} - Domain name
	 */
	function extractDomain(url) {
		try {
			const urlObj = new URL(url);
			return urlObj.hostname.replace("www.", "");
		} catch (e) {
			return "unknown";
		}
	}

	/**
	 * Load novels from storage and display them
	 */
	async function loadNovels() {
		showStatus("Loading novels...", "info");

		try {
			// Get novels from storage
			const result = await browser.storage.local.get(["novelHistory"]);
			const novels = result.novelHistory || {};

			if (Object.keys(novels).length === 0) {
				novelsListContainer.innerHTML =
					'<div class="no-novels">No novels found in your reading history.</div>';
				showStatus("No novels found in your reading history.", "info");
				return;
			}

			// Clear the novels list
			novelsListContainer.innerHTML = "";

			// Sort novels by last read date (most recent first)
			const sortedNovels = Object.entries(novels).sort((a, b) => {
				const lastReadA = a[1].lastRead || "1970-01-01T00:00:00.000Z";
				const lastReadB = b[1].lastRead || "1970-01-01T00:00:00.000Z";
				return new Date(lastReadB) - new Date(lastReadA);
			});

			// Create and append novel items
			sortedNovels.forEach(([novelId, novel]) => {
				const novelItem = createNovelItem(novelId, novel);
				novelsListContainer.appendChild(novelItem);
			});

			showStatus(
				`Loaded ${sortedNovels.length} novels from your reading history.`,
				"success"
			);

			// Add event listeners for chapter toggles
			document
				.querySelectorAll(".novel-chapters-toggle")
				.forEach((toggle) => {
					toggle.addEventListener("click", function () {
						const chapters =
							this.closest(".novel-item").querySelector(
								".novel-chapters"
							);
						chapters.classList.toggle("active");
						this.textContent = chapters.classList.contains("active")
							? "▲ Hide Chapters"
							: "▼ Show Chapters";
					});
				});
		} catch (error) {
			console.error("Error loading novels:", error);
			showStatus("Error loading novels. Please try again.", "error");
		}
	}

	/**
	 * Create a novel item element
	 * @param {string} novelId - Novel ID
	 * @param {Object} novel - Novel data
	 * @returns {HTMLElement} - The novel item element
	 */
	function createNovelItem(novelId, novel) {
		const novelItem = document.createElement("div");
		novelItem.className = "novel-item";

		const bookTitle = novel.bookTitle || "Unknown Title";
		const author = novel.author || "Unknown Author";
		const source = extractDomain(novel.url || "");
		const lastRead = novel.lastRead
			? formatRelativeTime(novel.lastRead)
			: "Never";

		// Create chapters list
		const chaptersHtml =
			novel.chapters && novel.chapters.length > 0
				? createChaptersListHtml(novel.chapters, novel.url)
				: '<div style="padding: 10px; font-style: italic;">No chapter history available</div>';

		novelItem.innerHTML = `
			<div class="novel-meta">
				<span class="novel-source">${source}</span>
				<span class="novel-last-read">Last read: ${lastRead}</span>
			</div>
			<div class="novel-title">${bookTitle}</div>
			<div class="novel-info">
				<span>Author: ${author}</span>
				<div>Chapters read: ${novel.chapters ? novel.chapters.length : 0}</div>
			</div>
			<div class="novel-actions">
				<button class="novel-chapters-toggle">▼ Show Chapters</button>
				${
					novel.currentChapterUrl
						? `<a href="${novel.currentChapterUrl}" target="_blank" style="text-decoration: none;"><button>Continue Reading</button></a>`
						: ""
				}
			</div>
			<div class="novel-chapters">${chaptersHtml}</div>
		`;

		return novelItem;
	}

	/**
	 * Create HTML for chapters list
	 * @param {Array} chapters - Array of chapter objects
	 * @param {string} novelUrl - Base URL of the novel
	 * @returns {string} - HTML string for chapters list
	 */
	function createChaptersListHtml(chapters, novelUrl) {
		// Sort chapters by read date (most recent first)
		const sortedChapters = [...chapters].sort((a, b) => {
			return new Date(b.date || 0) - new Date(a.date || 0);
		});

		// Limit to 10 most recent chapters
		const recentChapters = sortedChapters.slice(0, 10);

		if (recentChapters.length === 0) {
			return '<div style="padding: 10px; font-style: italic;">No chapter history available</div>';
		}

		return recentChapters
			.map((chapter) => {
				const chapterTitle = chapter.title || "Unnamed Chapter";
				const chapterDate = chapter.date
					? formatCompleteDate(chapter.date)
					: "Unknown date";
				const chapterUrl = chapter.url || novelUrl;

				return `
				<div class="chapter-item">
					<a href="${chapterUrl}" class="chapter-link" target="_blank">${chapterTitle}</a>
					<span class="chapter-date">${chapterDate}</span>
				</div>
			`;
			})
			.join("");
	}

	// Add event listener for refresh novels button
	if (refreshNovelsBtn) {
		refreshNovelsBtn.addEventListener("click", loadNovels);
	}

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
		browser.storage.local
			.get(["popupWidth", "popupHeight"])
			.then((result) => {
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

	// Log that the popup is initialized
	console.log("Ranobe Gemini popup initialized");
});
