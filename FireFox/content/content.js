// Simplified content script to extract chapter content without relying on imports
console.log("Ranobe Gemini: Content script loaded");

// Note: Import statements need to be modified since content scripts don't support direct ES6 imports
// We'll need to dynamically load our handler modules

// Initial constants and global state
let currentHandler = null; // Will store the website-specific handler
let hasExtractButton = false;
let autoExtracted = false;

// Add a minimal HTML sanitizer to remove script tags (adjust as needed)
function sanitizeHTML(html) {
	// Remove any <script>...</script> elements.
	return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

/**
 * Thoroughly strips all HTML tags and properly decodes HTML entities from text
 * @param {string} html - The HTML string to clean
 * @returns {string} - Clean text with all HTML tags removed and entities decoded
 */
function stripHtmlTags(html) {
    if (!html) return '';

    console.log("[StripTags Final] Input:", html);

    // Step 1: Use regex to remove all HTML tags before DOM parsing
    let text = html.replace(/<\/?[^>]+(>|$)/g, "");

    console.log("[StripTags Final] After initial regex:", text);

    // Step 2: Create a temporary div element to use the browser's HTML parsing
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;

    // Step 3: Extract text content which automatically removes all HTML tags
    let textOnly = tempDiv.textContent || tempDiv.innerText || '';

    console.log("[StripTags Final] After textContent:", textOnly);

    // Step 4: Additional regex replacement to catch any potential leftover tags
    textOnly = textOnly.replace(/<[^>]*>/g, '');

    // Step 5: Properly decode common HTML entities
    textOnly = textOnly.replace(/&amp;/g, '&')
                       .replace(/&lt;/g, '<')
                       .replace(/&gt;/g, '>')
                       .replace(/&quot;/g, '"')
                       .replace(/&#039;/g, "'")
                       .replace(/&nbsp;/g, ' ');

    console.log("[StripTags Final] After entity decoding:", textOnly);

    // Step 6: Clean up any consecutive whitespace but preserve paragraph breaks
    textOnly = textOnly.replace(/\s+/g, ' ').trim();

    console.log("[StripTags Final] Final output:", textOnly);

    return textOnly;
}

// Initialize when DOM is fully loaded
window.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("load", initialize); // Backup init in case DOMContentLoaded was missed

// Load handler modules dynamically
async function loadHandlers() {
	try {
		// Import the base handler code
		const baseHandlerUrl = browser.runtime.getURL("utils/website-handlers/base-handler.js");
		const baseHandlerModule = await import(baseHandlerUrl);

		// Import specific handlers
		const ranobesHandlerUrl = browser.runtime.getURL("utils/website-handlers/ranobes-handler.js");
		const fanfictionHandlerUrl = browser.runtime.getURL("utils/website-handlers/fanfiction-handler.js");
		const handlerManagerUrl = browser.runtime.getURL("utils/website-handlers/handler-manager.js");

		// Don't wait for these imports now, we'll use them later when needed
		console.log("Handler URLs loaded:",
			{ baseHandlerUrl, ranobesHandlerUrl, fanfictionHandlerUrl, handlerManagerUrl });

		return {
			baseHandlerUrl,
			ranobesHandlerUrl,
			fanfictionHandlerUrl,
			handlerManagerUrl
		};
	} catch (error) {
		console.error("Error loading handlers:", error);
		return null;
	}
}

// Get the appropriate handler for the current site
async function getHandlerForCurrentSite() {
	try {
		const handlerUrls = await loadHandlers();
		if (!handlerUrls) return null;

		const handlerManagerModule = await import(handlerUrls.handlerManagerUrl);
		if (handlerManagerModule && handlerManagerModule.getHandlerForCurrentSite) {
			return handlerManagerModule.getHandlerForCurrentSite();
		}
		return null;
	} catch (error) {
		console.error("Error getting handler for current site:", error);
		return null;
	}
}

// Generic content extraction that works across different websites
// This serves as a fallback when no specific handler is available
function extractContentGeneric() {
	// Find paragraphs - works on most novel/fiction sites
	const paragraphs = document.querySelectorAll('p');
	if (paragraphs.length > 5) {
		// Get all paragraphs text
		const chapterText = Array.from(paragraphs)
			.map(p => p.innerText)
			.join('\n\n');

		return {
			found: chapterText.length > 200, // Only consider it found if we have substantial text
			title: document.title || "Unknown Title",
			text: chapterText,
			selector: "generic paragraph extractor"
		};
	}

	// Try to find main content using common article selectors
	const contentSelectors = [
		'article',
		'.article',
		'.content',
		'.story-content',
		'.entry-content',
		'#content',
		'.main-content',
		'.post-content',
		'#storytext',          // fanfiction.net
		'#arrticle',           // Ranobes.top
		'.text-chapter',
		'.chapter-content',
		'.novel-content',
		'.story',
		'.chapter-inner'
	];

	for (const selector of contentSelectors) {
		const element = document.querySelector(selector);
		if (element) {
			return {
				found: true,
				title: document.title || "Unknown Title",
				text: element.innerText.trim(),
				selector: `generic selector: ${selector}`
			};
		}
	}

	// Nothing found
	return {
		found: false,
		title: "",
		text: "",
		selector: ""
	};
}

async function initialize() {
	console.log("Ranobe Gemini: Initializing content script");

	// Get the appropriate handler for this website
	currentHandler = await getHandlerForCurrentSite();

	if (currentHandler) {
		console.log(`Using specific handler for ${window.location.hostname}`);
	} else {
		console.log(
			"No specific handler found, using generic extraction methods"
		);
	}

	// Create extract button if it doesn't exist
	if (!hasExtractButton) {
		injectUI();

		// Also look for content periodically in case the page loads dynamically
		const checkInterval = setInterval(() => {
			const contentArea = findContentArea();
			const button = document.querySelector(".gemini-enhance-btn");

			if (contentArea && !button) {
				console.log("Content area found in interval check");
				injectUI();
				clearInterval(checkInterval);
			}
		}, 2000);
	}

	// Automatically extract content once the page is loaded
	if (!autoExtracted) {
		setTimeout(() => {
			autoExtractContent();
		}, 1500);
	}
}

// Find the content area using handlers or generic approach
function findContentArea() {
	if (currentHandler) {
		return currentHandler.findContentArea();
	}

	// Generic fallback approach - try common content selectors
	const commonSelectors = [
		"#storytext", // fanfiction.net
		"#arrticle", // Ranobes.top
		".text-chapter",
		".chapter-content",
		".novel-content",
		".story",
		".chapter-inner",
		".article-content",
		".post-content",
		"article",
		".content",
	];

	for (const selector of commonSelectors) {
		const element = document.querySelector(selector);
		if (element) {
			console.log(
				`Generic: Content area found using selector: ${selector}`
			);
			return element;
		}
	}

	return null;
}

// Function to create the Summarize button
function createSummarizeButton() {
	const button = document.createElement("button");
	button.id = "summarize-button";
	button.textContent = "Summarize Chapter";
	button.classList.add("gemini-button"); // Use the same class for styling
	button.addEventListener("click", handleSummarizeClick);
	return button;
}

// Function to create the Enhance button
function createEnhanceButton() {
	const enhanceButton = document.createElement("button");
	enhanceButton.className = "gemini-enhance-btn";

	// Create elements safely instead of using innerHTML or createContextualFragment
	const lightModeImg = document.createElement("img");
	lightModeImg.src = browser.runtime.getURL("icons/logo-light-16.png");
	lightModeImg.className = "light-mode-icon";
	lightModeImg.alt = "";

	const darkModeImg = document.createElement("img");
	darkModeImg.src = browser.runtime.getURL("icons/logo-dark-16.png");
	darkModeImg.className = "dark-mode-icon";
	darkModeImg.alt = "";

	// Add image elements + text to button using DOM methods
	enhanceButton.appendChild(lightModeImg);
	enhanceButton.appendChild(darkModeImg);
	enhanceButton.appendChild(document.createTextNode(" Enhance with Gemini"));

	// Style to match the sample page buttons
	enhanceButton.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 15px;
        margin: 15px 0;
        background-color: #222;
        color: #bab9a0;
        border: 1px solid #ffffff21;
        box-shadow: inset 0 0 0 1px #5a5a5a4d;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
        z-index: 1000;
    `;
	enhanceButton.addEventListener("click", handleEnhanceClick);
	enhanceButton.addEventListener("mouseover", () => {
		enhanceButton.style.backgroundColor = "#333";
	});
	enhanceButton.addEventListener("mouseout", () => {
		enhanceButton.style.backgroundColor = "#222";
	});
	return enhanceButton;
}

// Function to inject UI elements (buttons, status area)
function injectUI() {
	const contentArea = findContentArea();
	if (!contentArea) {
		console.warn(
			"Ranobe Gemini: Target element for UI injection not found."
		);
		return;
	}

	// Check if UI already injected
	if (document.getElementById("gemini-controls")) {
		console.log("Ranobe Gemini: UI already injected.");
		return;
	}

	const controlsContainer = document.createElement("div");
	controlsContainer.id = "gemini-controls";
	controlsContainer.style.marginBottom = "10px"; // Add some space below buttons

	const enhanceButton = createEnhanceButton();
	const summarizeButton = createSummarizeButton();
	const statusDiv = document.createElement("div");
	statusDiv.id = "gemini-status";
	statusDiv.style.marginTop = "5px";

	const summaryDisplay = document.createElement("div");
	summaryDisplay.id = "summary-display";
	summaryDisplay.style.marginTop = "10px";
	summaryDisplay.style.padding = "10px";
	summaryDisplay.style.border = "1px solid #ccc";
	summaryDisplay.style.display = "none"; // Initially hidden

	controlsContainer.appendChild(enhanceButton);
	controlsContainer.appendChild(summarizeButton);
	controlsContainer.appendChild(statusDiv);

	// Get optimal insertion point based on the handler
	let insertionPoint = contentArea;
	let insertionPosition = "before";

	if (currentHandler) {
		const uiInfo = currentHandler.getUIInsertionPoint(contentArea);
		insertionPoint = uiInfo.element || contentArea;
		insertionPosition = uiInfo.position || "before";
	}

	// Insert elements based on the recommended position
	if (insertionPosition === "before") {
		insertionPoint.parentNode.insertBefore(
			controlsContainer,
			insertionPoint
		);
		insertionPoint.parentNode.insertBefore(summaryDisplay, insertionPoint);
	} else if (insertionPosition === "after") {
		insertionPoint.parentNode.insertBefore(
			controlsContainer,
			insertionPoint.nextSibling
		);
		insertionPoint.parentNode.insertBefore(
			summaryDisplay,
			controlsContainer.nextSibling
		);
	} else if (insertionPosition === "prepend") {
		insertionPoint.prepend(controlsContainer);
		insertionPoint.prepend(summaryDisplay);
	} else if (insertionPosition === "append") {
		insertionPoint.appendChild(controlsContainer);
		insertionPoint.appendChild(summaryDisplay);
	}

	console.log("Ranobe Gemini: UI injected successfully.");
}

// Automatically extract content once the page is loaded
function autoExtractContent() {
	const contentArea = findContentArea();

	if (contentArea) {
		console.log("Auto-extracting content...");
		const result = extractContent();

		if (result.found) {
			console.log("Content automatically extracted:");
			console.log(`Title: ${result.title}`);
			console.log(`Content length: ${result.text.length} characters`);
			autoExtracted = true;
		}
	}
}

// Extract content using the appropriate handler
function extractContent() {
	// If we have a specific handler for this website, use it
	if (currentHandler) {
		return currentHandler.extractContent();
	}

	// Otherwise use generic extraction method
	return extractContentGeneric();
}

// Handle click event for Summarize button
async function handleSummarizeClick() {
	const summarizeButton = document.getElementById("summarize-button");
	const summaryDisplay = document.getElementById("summary-display");
	const statusDiv = document.getElementById("gemini-status");

	if (!summarizeButton || !summaryDisplay || !statusDiv) return;

	try {
		summarizeButton.disabled = true;
		summarizeButton.textContent = "Summarizing...";
		statusDiv.textContent = "Extracting content for summary...";
		summaryDisplay.style.display = "block"; // Show the display area
		summaryDisplay.textContent = "Generating summary...";

		const extractedContent = extractContent();
		const { title, text: content } = extractedContent;

		if (!content) {
			throw new Error("Could not extract chapter content.");
		}

		console.log(`Extracted ${content.length} characters for summarization`);
		statusDiv.textContent =
			"Sending content to Gemini for summarization...";

		// Get model info to determine if we need to split the content
		const modelInfoResponse = await browser.runtime.sendMessage({
			action: "getModelInfo",
		});

		const maxContextSize = modelInfoResponse.maxContextSize || 16000; // Default if not available
		console.log(
			`Model max context size for summarization: ${maxContextSize}`
		);

		// Get approximate token count (rough estimate: 4 chars per token)
		const estimatedTokenCount = Math.ceil(content.length / 4);
		console.log(
			`Estimated token count for summarization: ${estimatedTokenCount}`
		);

		let summary = "";

		// Check if content exceeds 60% of the model's context size (leaving room for prompts)
		if (estimatedTokenCount > maxContextSize * 0.6) {
			// Process large content in parts
			summary = await summarizeLargeContentInParts(
				title,
				content,
				maxContextSize,
				statusDiv
			);
		} else {
			// Process as a single chunk
			const response = await browser.runtime.sendMessage({
				action: "summarizeWithGemini",
				title: title,
				content: content,
			});

			if (response && response.success && response.summary) {
				summary = response.summary;
			} else {
				throw new Error(
					response?.error || "Failed to generate summary."
				);
			}
		}

		// Display the summary
		if (summary) {
			// Clear the summary display area
			while (summaryDisplay.firstChild) {
				summaryDisplay.removeChild(summaryDisplay.firstChild);
			}

			const summaryHeader = document.createElement("h3");
			summaryHeader.textContent = "Chapter Summary:";
			summaryDisplay.appendChild(summaryHeader);

			// Create a container for the summary text
			const summaryContentContainer = document.createElement("div");
			summaryContentContainer.className = "summary-text-content";

			// Apply our enhanced HTML tag stripping
			const cleanSummary = stripHtmlTags(summary);
			console.log("[Render] Clean summary to display:", cleanSummary);

			// Enhanced paragraph handling - properly preserve line breaks
			summaryContentContainer.style.whiteSpace = "pre-wrap";

			// Split by double newlines to create paragraphs
			const paragraphs = cleanSummary.split(/\n\n+/);
			if (paragraphs.length > 1) {
				// Multiple paragraphs - render each as a separate element
				paragraphs.forEach((paragraph) => {
					if (paragraph.trim()) {
						const p = document.createElement("p");
						// Handle any single line breaks within paragraphs
						p.textContent = paragraph.replace(/\n/g, " ");
						p.style.marginBottom = "1em";
						summaryContentContainer.appendChild(p);
					}
				});
			} else {
				// Single block - preserve all line breaks
				summaryContentContainer.textContent = cleanSummary;
			}

			summaryDisplay.appendChild(summaryContentContainer);
			statusDiv.textContent = "Summary generated successfully!";
		} else {
			throw new Error("Failed to generate summary.");
		}
	} catch (error) {
		console.error("Error in handleSummarizeClick:", error);
		statusDiv.textContent = `Error: ${error.message}`;
		summaryDisplay.textContent = "Failed to generate summary.";
		summaryDisplay.style.display = "block"; // Keep display visible to show error
	} finally {
		summarizeButton.disabled = false;
		summarizeButton.textContent = "Summarize Chapter";
		// Optionally hide status message after a delay
		setTimeout(() => {
			if (statusDiv.textContent.includes("Summary generated"))
				statusDiv.textContent = "";
		}, 5000);
	}
}

// Process large content by splitting into parts for summarization
async function summarizeLargeContentInParts(
	title,
	content,
	maxContextSize,
	statusDiv
) {
	console.log("Content is large, summarizing in multiple parts...");
	if (statusDiv) {
		statusDiv.textContent =
			"Content is large, summarizing in multiple parts...";
	}

	// Approximately how many characters per part (rough estimate: 4 chars per token, using 60% of context size)
	const charsPerPart = Math.floor(maxContextSize * 0.6 * 4);

	// Split content into paragraphs
	const paragraphs = content.split(/\n\n+/);
	console.log(`Split content into ${paragraphs.length} paragraphs`);

	// Initialize parts
	const parts = [];
	let currentPart = "";

	// Group paragraphs into parts
	for (const paragraph of paragraphs) {
		// If adding this paragraph would exceed the limit, start a new part
		if (
			(currentPart + paragraph).length > charsPerPart &&
			currentPart.length > 0
		) {
			parts.push(currentPart);
			currentPart = paragraph;
		} else {
			// Otherwise, add to current part
			currentPart += (currentPart ? "\n\n" : "") + paragraph;
		}
	}

	// Add the last part if it's not empty
	if (currentPart.trim()) {
		parts.push(currentPart);
	}

	console.log(`Split content into ${parts.length} parts for summarization`);

	// Process each part sequentially
	let allPartSummaries = [];
	let currentPartNum = 1;

	for (const part of parts) {
		// Update status
		if (statusDiv) {
			statusDiv.textContent = `Summarizing part ${currentPartNum} of ${parts.length}...`;
		}

		console.log(
			`Summarizing part ${currentPartNum}/${parts.length} (${part.length} characters)`
		);

		// Create a part-specific title
		const partTitle = `${title} (Part ${currentPartNum}/${parts.length})`;

		try {
			// Process this part
			const response = await browser.runtime.sendMessage({
				action: "summarizeWithGemini",
				title: partTitle,
				content: part,
				isPart: true,
				partInfo: {
					current: currentPartNum,
					total: parts.length,
				},
			});

			if (response && response.success && response.summary) {
				console.log(
					`Successfully summarized part ${currentPartNum}/${parts.length}`
				);
				allPartSummaries.push(response.summary);
			} else {
				console.error(
					`Error summarizing part ${currentPartNum}:`,
					response?.error || "Unknown error"
				);
				// Continue with other parts even if one fails
			}
		} catch (error) {
			console.error(`Error summarizing part ${currentPartNum}:`, error);
			// Continue with other parts even if one fails
		}

		currentPartNum++;
	}

	// If we have multiple part summaries, combine them
	if (allPartSummaries.length > 1) {
		// Try to combine the summaries with an additional API call
		try {
			if (statusDiv) {
				statusDiv.textContent = "Combining part summaries...";
			}

			// Join the part summaries with clear separators
			const combinedPartSummaries = allPartSummaries
				.map((summary, index) => {
					return `Part ${index + 1} summary:\n${summary}`;
				})
				.join("\n\n");

			// Make a final API call to combine the summaries
			const finalResponse = await browser.runtime.sendMessage({
				action: "combinePartialSummaries",
				title: title,
				partSummaries: combinedPartSummaries,
				partCount: parts.length,
			});

			if (
				finalResponse &&
				finalResponse.success &&
				finalResponse.combinedSummary
			) {
				return finalResponse.combinedSummary;
			} else {
				// If the combination failed, just join the summaries with separators
				console.log("Using fallback approach to combine summaries");
				return (
					`Complete summary of "${title}":\n\n` +
					allPartSummaries.join("\n\n")
				);
			}
		} catch (error) {
			// If there's an error combining, just join them
			console.error("Error combining summaries:", error);
			return (
				`Complete summary of "${title}":\n\n` +
				allPartSummaries.join("\n\n")
			);
		}
	} else if (allPartSummaries.length === 1) {
		// Just return the single summary if there's only one part
		return allPartSummaries[0];
	} else {
		throw new Error("Failed to generate any part summaries");
	}
}

// Handle click event for Enhance button
async function handleEnhanceClick() {
	showStatusMessage("Extracting content and sending to Gemini...");

	const extractedContent = extractContent();
	if (!extractedContent.found) {
		showStatusMessage("No content found to process", "error");
		return;
	}

	console.log("===========================================");
	console.log("EXTRACTED CHAPTER FOR GEMINI:");
	console.log("===========================================");
	console.log("TITLE: " + extractedContent.title);
	console.log("===========================================");
	console.log(
		"CONTENT LENGTH: " + extractedContent.text.length + " characters"
	);
	console.log(
		"CONTENT WORD COUNT: " +
			extractedContent.text.split(/\s+/).length +
			" words"
	);
	console.log("===========================================");
	// Log the extracted content
	console.log("CONTENT: " + extractedContent.text.substring(0, 300) + "..."); // Log just a preview
	console.log("===========================================");
	// Log the source selector
	console.log("SOURCE: " + extractedContent.selector);
	console.log("===========================================");

	// Send to background script to process with Gemini
	try {
		// Show processing indicator on the button
		const button = document.querySelector(".gemini-enhance-btn");
		const originalText = button.textContent;
		button.textContent = "Processing...";
		button.disabled = true;

		// First ping the background script to ensure it's alive
		let pingResult;
		try {
			pingResult = await browser.runtime.sendMessage({ action: "ping" });
			console.log("Ping result:", pingResult);
		} catch (pingError) {
			console.error("Error pinging background script:", pingError);
			// If ping fails, try reloading the extension
			showStatusMessage(
				"Connection error. Please reload the page or extension.",
				"error"
			);
			if (button) {
				button.textContent = originalText;
				button.disabled = false;
			}
			return;
		}

		// Get approximate token count (rough estimate: 4 chars per token)
		const estimatedTokenCount = Math.ceil(extractedContent.text.length / 4);
		console.log(`Estimated token count: ${estimatedTokenCount}`);

		// Get model max context size from the background script
		const modelInfoResponse = await browser.runtime.sendMessage({
			action: "getModelInfo",
		});

		const maxContextSize = modelInfoResponse.maxContextSize || 16000; // Default if not available
		console.log(`Model max context size: ${maxContextSize}`);

		// If the content is too large, split it into parts
		if (estimatedTokenCount > maxContextSize * 0.7) {
			// Use 70% of max as safety margin
			return await processLargeContentInParts(
				extractedContent,
				button,
				originalText,
				maxContextSize
			);
		}

		// For normal-sized content, process as usual
		const response = await browser.runtime.sendMessage({
			action: "processWithGemini",
			title: extractedContent.title,
			content: extractedContent.text,
		});

		// Restore button state
		if (button) {
			button.textContent = originalText;
			button.disabled = false;
		}

		if (response && response.success) {
			console.log("===========================================");
			console.log("GEMINI PROCESSED RESULT:");
			console.log("===========================================");
			console.log(response.result.substring(0, 300) + "..."); // Log just a preview
			console.log("===========================================");
			// Show success message
			showStatusMessage("Successfully processed with Gemini!");
			console.log("===========================================");
			// Replace content with enhanced version
			await replaceContentWithEnhancedVersion(response.result);
		} else {
			const errorMessage = response?.error || "Unknown error";
			// Special handling for missing API key
			if (errorMessage.includes("API key is missing")) {
				showStatusMessage(
					"API key is missing. Opening settings page...",
					"error"
				);
				// Open popup for API key input
				browser.runtime.sendMessage({ action: "openPopup" });
			} else {
				showStatusMessage(
					"Error processing with Gemini: " + errorMessage,
					"error"
				);
			}
		}
	} catch (error) {
		console.error("Error communicating with background script:", error);
		// Restore button state
		const button = document.querySelector(".gemini-enhance-btn");
		if (button) {
			button.textContent = "Enhance with Gemini";
			button.disabled = false;
		}
		// Special handling for connection errors
		if (error.message && error.message.includes("does not exist")) {
			showStatusMessage(
				"Connection to extension failed. Please reload the page and try again.",
				"error"
			);
		} else if (
			error.message &&
			error.message.includes("API key is missing")
		) {
			showStatusMessage(
				"API key is missing. Opening settings page...",
				"error"
			);
			// Open popup for API key input
			browser.runtime.sendMessage({ action: "openPopup" });
		} else {
			showStatusMessage(
				`Error communicating with Gemini: ${
					error.message || "Connection error"
				}`,
				"error"
			);
		}
	}
}

// Process large content by splitting into parts
async function processLargeContentInParts(
	extractedContent,
	button,
	originalButtonText,
	maxContextSize
) {
	// Show split processing notification
	showStatusMessage(
		"Content is large, processing in multiple parts...",
		"info"
	);

	// Approximately how many characters per part (rough estimate: 4 chars per token)
	const charsPerPart = Math.floor(maxContextSize * 0.7 * 4); // 70% of max tokens

	// Split content into paragraphs first
	const paragraphs = extractedContent.text.split(/\n\n+/);

	// Initialize parts
	const parts = [];
	let currentPart = "";

	// Group paragraphs into parts
	for (const paragraph of paragraphs) {
		// If adding this paragraph would exceed the limit, start a new part
		if (
			(currentPart + paragraph).length > charsPerPart &&
			currentPart.length > 0
		) {
			parts.push(currentPart);
			currentPart = paragraph;
		} else {
			// Otherwise, add to current part
			currentPart += (currentPart ? "\n\n" : "") + paragraph;
		}
	}

	// Add the last part if it's not empty
	if (currentPart.trim()) {
		parts.push(currentPart);
	}

	console.log(`Split content into ${parts.length} parts`);

	// Process each part sequentially
	let allProcessedContent = "";
	let currentPartNum = 1;

	for (const part of parts) {
		// Update button text to show progress
		if (button) {
			button.textContent = `Processing part ${currentPartNum}/${parts.length}...`;
		}

		// Display progress
		showStatusMessage(
			`Processing part ${currentPartNum} of ${parts.length}...`,
			"info"
		);

		// Create a part-specific title
		const partTitle = `${extractedContent.title} (Part ${currentPartNum}/${parts.length})`;

		try {
			// Process this part
			const response = await browser.runtime.sendMessage({
				action: "processWithGemini",
				title: partTitle,
				content: part,
				isPart: true,
				partInfo: {
					current: currentPartNum,
					total: parts.length,
				},
			});

			if (response && response.success) {
				console.log(
					`Successfully processed part ${currentPartNum}/${parts.length}`
				);

				// Add this processed part to our accumulated result
				allProcessedContent +=
					(allProcessedContent ? "\n\n" : "") + response.result;
			} else {
				throw new Error(response?.error || "Failed to process part");
			}
		} catch (error) {
			console.error(`Error processing part ${currentPartNum}:`, error);
			showStatusMessage(
				`Error processing part ${currentPartNum}: ${error.message}`,
				"error"
			);

			// Restore button state
			if (button) {
				button.textContent = originalButtonText;
				button.disabled = false;
			}

			return;
		}

		currentPartNum++;
	}

	// Restore button state
	if (button) {
		button.textContent = originalButtonText;
		button.disabled = false;
	}

	if (allProcessedContent) {
		console.log("===========================================");
		console.log("ALL PARTS PROCESSED SUCCESSFULLY");
		console.log("===========================================");

		// Show success message
		showStatusMessage(`Successfully processed all ${parts.length} parts!`);

		// Replace content with enhanced version
		await replaceContentWithEnhancedVersion(allProcessedContent);
		return true;
	} else {
		showStatusMessage("Failed to process content in parts", "error");
		return false;
	}
}

// Function to replace page content with enhanced version
async function replaceContentWithEnhancedVersion(enhancedText) {
	const contentArea = findContentArea();
	if (!contentArea) return;

	// Save original content for restoration
	const originalContent = contentArea.innerHTML;

	// Clean up Markdown artifacts
	let processedHtml = enhancedText;

	// Remove code block syntax
	processedHtml = processedHtml.replace(
		/```(?:html|javascript|css|js|)\n?/g,
		""
	);
	processedHtml = processedHtml.replace(/```/g, "");

	// Remove inline code backticks
	processedHtml = processedHtml.replace(/`([^`]+)`/g, "$1");

	// Remove markdown heading syntax
	processedHtml = processedHtml.replace(/^#+\s+(.+)$/gm, "$1");

	// Remove markdown bold/italic syntax
	processedHtml = processedHtml.replace(/\*\*([^*]+)\*\*/g, "$1");
	processedHtml = processedHtml.replace(/\*([^*]+)\*/g, "$1");
	processedHtml = processedHtml.replace(/__([^_]+)__/g, "$1");
	processedHtml = processedHtml.replace(/_([^_]+)_/g, "$1");

	// Clear existing content
	while (contentArea.firstChild) {
		contentArea.removeChild(contentArea.firstChild);
	}

	// Create the notification container using DOM methods instead of innerHTML
	const noticeContainer = document.createElement("div");
	noticeContainer.className = "gemini-processed-notice";
	noticeContainer.style.cssText = `
		background-color: transparent;
		padding: 10px;
		margin-bottom: 20px;
		border-left: 4px solid #4285f4;
		font-style: italic;
		color: #bab9a0;
	`;

	// Add images
	const lightModeImg = document.createElement("img");
	lightModeImg.src = browser.runtime.getURL("icons/logo-light-16.png");
	lightModeImg.className = "light-mode-icon";
	lightModeImg.alt = "";
	lightModeImg.style.cssText = "vertical-align: middle; margin-right: 6px;";

	const darkModeImg = document.createElement("img");
	darkModeImg.src = browser.runtime.getURL("icons/logo-dark-16.png");
	darkModeImg.className = "dark-mode-icon";
	darkModeImg.alt = "";
	darkModeImg.style.cssText = "vertical-align: middle; margin-right: 6px;";

	// Add text
	const noticeText = document.createTextNode(
		"This content has been enhanced by Gemini AI"
	);

	// Create restore button
	const restoreBtn = document.createElement("button");
	restoreBtn.id = "restore-original";
	restoreBtn.textContent = "Restore Original";
	restoreBtn.style.cssText = `
		float: right;
		background: transparent;
		color: #bab9a0;
		border: 1px solid #bab9a0;
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
	`;

	// Add event listener to restore button
	restoreBtn.addEventListener("click", () => {
		contentArea.innerHTML = originalContent;
		showStatusMessage("Original content restored");
	});

	// Assemble notice
	noticeContainer.appendChild(lightModeImg);
	noticeContainer.appendChild(darkModeImg);
	noticeContainer.appendChild(noticeText);
	noticeContainer.appendChild(restoreBtn);

	// Add notice to content area
	contentArea.appendChild(noticeContainer);

	// Process content
	if (!/<p>|<div>|<span>/.test(processedHtml)) {
		// If there are no HTML tags, convert newlines to paragraph elements
		const paragraphs = processedHtml.split("\n\n");
		paragraphs.forEach((paragraph) => {
			if (paragraph.trim() !== "") {
				const p = document.createElement("p");
				p.textContent = paragraph;
				contentArea.appendChild(p);
			}
		});
	} else {
		// For HTML content, use a parser to safely extract and add each element
		const parser = new DOMParser();
		const doc = parser.parseFromString(processedHtml, "text/html");

		// Remove any script tags from the parsed content for security
		const scripts = doc.querySelectorAll("script");
		scripts.forEach((script) => script.remove());

		// Append each child from the body to our content area
		Array.from(doc.body.childNodes).forEach((node) => {
			contentArea.appendChild(node.cloneNode(true));
		});
	}

	showStatusMessage("Content enhanced with Gemini AI");
}

// Shows a status message on the page
function showStatusMessage(message, type = "info") {
	// Create message element
	const messageDiv = document.createElement("div");
	messageDiv.textContent = message;
	messageDiv.classList.add("extraction-message");

	// Style based on message type - match sample page styling
	const bgColor = type === "error" ? "#622020" : "#2c494f";
	const textColor = "#bab9a0";

	messageDiv.style.cssText = `
    background-color: ${bgColor};
    color: ${textColor};
    padding: 15px;
    margin: 15px 0;
    border-radius: 4px;
    font-weight: bold;
    text-align: center;
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    max-width: 80%;
    border: 1px solid #ffffff21;
  `;

	document.body.appendChild(messageDiv);

	// Remove the message after 5 seconds
	setTimeout(() => {
		if (messageDiv.parentNode) {
			messageDiv.parentNode.removeChild(messageDiv);
		}
	}, 5000);
}

// Listen for messages from the extension popup or background
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log("Content script received message:", message);

	if (message.action === "ping") {
		sendResponse({ success: true, message: "Content script is alive" });
		return true;
	}

	if (message.action === "testExtraction") {
		const result = extractContent();
		sendResponse({
			success: true,
			foundContent: result.found,
			title: result.title,
			text: result.text.substring(0, 100) + "...", // Show only start for test
		});
		return true;
	}

	if (message.action === "processWithGemini") {
		handleEnhanceClick()
			.then(() => {
				sendResponse({ success: true });
			})
			.catch((error) => {
				sendResponse({
					success: false,
					error: error.message || "Unknown error processing content",
				});
			});
		return true;
	}

	if (message.action === "settingsUpdated") {
		// Update any local settings
		console.log("Settings updated:", message);
		sendResponse({ success: true });
		return true;
	}

	if (message.action === "summarizeWithGemini") {
		handleSummarizeClick()
			.then(() => {
				sendResponse({ success: true });
			})
			.catch((error) => {
				sendResponse({
					success: false,
					error: error.message || "Unknown error summarizing content",
				});
			});
		return true;
	}

	return false;
});

// Run initialization immediately in case the page is already loaded
initialize();
