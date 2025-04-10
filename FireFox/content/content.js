// Simplified content script to extract chapter content without relying on imports
console.log("Ranobe Gemini: Content script loaded");

// Add Ranobes.top specific selector to our content selectors
const CONTENT_SELECTORS = [
	"#arrticle", // Ranobes.top specific main content area
	".text-chapter",
	".chapter-content",
	".novel-content",
	".story",
	".chapter-inner", // Additional common selectors
	".article-content",
	".post-content",
];

// Initialize when DOM is fully loaded
window.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("load", initialize); // Backup init in case DOMContentLoaded was missed

// Global state
let hasExtractButton = false;
let autoExtracted = false;

// Add a minimal HTML sanitizer to remove script tags (adjust as needed)
function sanitizeHTML(html) {
	// Remove any <script>...</script> elements.
	return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

function initialize() {
	console.log("Ranobe Gemini: Initializing content script");

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

// Find the content area using various possible selectors
function findContentArea() {
	for (const selector of CONTENT_SELECTORS) {
		const element = document.querySelector(selector);
		if (element) {
			console.log(`Content area found using selector: ${selector}`);
			return element;
		}
	}

	// If standard selectors don't work, try a fallback approach for ranobes.top
	if (window.location.hostname.includes("ranobes")) {
		const storyContainer = document.querySelector(".story");
		if (storyContainer) {
			console.log("Found story container via fallback method");
			return storyContainer;
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
	// Instead of directly setting innerHTML, wrap the HTML through sanitizeHTML
	const btnHTML = `
        <img src="${browser.runtime.getURL(
			"icons/logo-light-16.png"
		)}" class="light-mode-icon" alt="">
        <img src="${browser.runtime.getURL(
			"icons/logo-dark-16.png"
		)}" class="dark-mode-icon" alt="">
        Enhance with Gemini
    `;
	// Instead of directly assigning innerHTML, create a safe fragment
	const fragment = document
		.createRange()
		.createContextualFragment(sanitizeHTML(btnHTML));
	enhanceButton.textContent = ""; // Clear any text
	enhanceButton.appendChild(fragment);

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

	// Insert controls before the content area
	contentArea.parentNode.insertBefore(controlsContainer, contentArea);
	// Insert summary display before the content area as well
	contentArea.parentNode.insertBefore(summaryDisplay, contentArea);

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

// Extract content and log the entire chapter text
function extractContent() {
	let foundContent = false;
	let chapterText = "";
	let chapterTitle = "";
	let sourceSelector = "";

	// Try each selector
	for (const selector of CONTENT_SELECTORS) {
		const element = document.querySelector(selector);
		if (element) {
			foundContent = true;
			sourceSelector = selector;

			// Extract title if available
			const titleElement = document.querySelector(
				"h1.title, .story-title, .chapter-title"
			);
			chapterTitle =
				titleElement?.innerText || document.title || "Unknown Title";

			// Create a deep clone of the content element to manipulate
			const contentClone = element.cloneNode(true);

			// Remove title elements from the content if they exist
			const titlesToRemove = contentClone.querySelectorAll(
				"h1, h2, h3.title, .story-title, .chapter-title"
			);
			titlesToRemove.forEach((title) => {
				title.remove();
			});

			// Get clean text content - preserve full text
			chapterText = contentClone.innerText
				.trim()
				.replace(/\n\s+/g, "\n") // Preserve paragraph breaks but remove excess whitespace
				.replace(/\s{2,}/g, " "); // Replace multiple spaces with a single space

			// Additional cleaning - ONLY check the first 5 lines for titles
			const titleParts = chapterTitle.split(/[:\-–—]/);
			const lines = chapterText.split("\n");
			const headLines = lines.slice(0, 5); // Only look at first 5 lines
			const filteredHeadLines = headLines.filter((line) => {
				const trimmedLine = line.trim();
				// Skip empty lines
				if (trimmedLine === "") return true;

				// Check if line is just the title or part of the title
				for (const titlePart of titleParts) {
					const cleanTitlePart = titlePart.trim();
					if (
						cleanTitlePart.length > 3 && // Avoid filtering out lines with short matches
						(trimmedLine === cleanTitlePart ||
							trimmedLine.startsWith(`${cleanTitlePart}:`) ||
							trimmedLine.startsWith(`${cleanTitlePart} -`))
					) {
						return false;
					}
				}

				// Check for common book name patterns at the start of content
				if (
					document.location.hostname.includes("ranobes") &&
					/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmedLine)
				) {
					return false;
				}

				return true;
			});

			// Recombine the filtered head lines with the rest of the content
			chapterText = [...filteredHeadLines, ...lines.slice(5)].join("\n");

			// Log the entire text
			console.log(`FULL CHAPTER TEXT: ${chapterText.length} characters`);
			break; // Stop after finding the first valid content
		}
	}

	// Try to find content another way if nothing was found
	if (!foundContent) {
		const paragraphs = document.querySelectorAll("p");
		if (paragraphs.length > 5) {
			// Get all paragraphs text
			chapterText = Array.from(paragraphs)
				.map((p) => p.innerText)
				.join("\n\n");
			foundContent = chapterText.length > 200; // Only consider it found if we have substantial text
			sourceSelector = "p tags";
		}
	}

	return {
		found: foundContent,
		title: chapterTitle,
		text: chapterText,
		selector: sourceSelector,
	};
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

		const { title, text: content } = extractContent();

		if (!content) {
			throw new Error("Could not extract chapter content.");
		}

		statusDiv.textContent =
			"Sending content to Gemini for summarization...";

		// Send message to background script for summarization
		const response = await browser.runtime.sendMessage({
			action: "summarizeWithGemini",
			title: title,
			content: content,
		});

		if (response && response.success) {
			summaryDisplay.innerHTML = `<h3>Chapter Summary:</h3><p>${response.summary.replace(
				/\n/g,
				"<br>"
			)}</p><br>`; // Display summary with a break tag for spacing
			statusDiv.textContent = "Summary generated successfully!";
		} else {
			throw new Error(
				response?.error ||
					"Failed to get summary from background script."
			);
		}
	} catch (error) {
		console.error("Error during summarization:", error);
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
	console.log("CONTENT: " + extractedContent.text);
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
			console.log(response.result);
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

	// Save original content
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

	// If there are no paragraph tags, convert newlines to paragraph tags
	if (!/<p>|<div>|<span>/.test(processedHtml)) {
		processedHtml = processedHtml
			.split("\n\n")
			.filter((paragraph) => paragraph.trim() !== "")
			.map((paragraph) => `<p>${paragraph}</p>`)
			.join("");
	}

	// Add a notice converting to enhanced content
	processedHtml = `
    <div class="gemini-processed-notice" style="
      background-color: transparent;
      padding: 10px;
      margin-bottom: 20px;
      border-left: 4px solid #4285f4;
      font-style: italic;
      color: #bab9a0;
    ">
      <img src="${browser.runtime.getURL("icons/logo-light-16.png")}"
           class="light-mode-icon"
           alt=""
           style="vertical-align: middle; margin-right: 6px;">
      <img src="${browser.runtime.getURL("icons/logo-dark-16.png")}"
           class="dark-mode-icon"
           alt=""
           style="vertical-align: middle; margin-right: 6px;">
      This content has been enhanced by Gemini AI
      <button id="restore-original" style="
        float: right;
        background: transparent;
        color: #bab9a0;
        border: 1px solid #bab9a0;
        padding: 3px 8px;
        border-radius: 4px;
        cursor: pointer;
      ">Restore Original</button>
    </div>
    ${processedHtml}
  `;

	// Use createContextualFragment for safe insertion
	const safeFragment = document
		.createRange()
		.createContextualFragment(sanitizeHTML(processedHtml));
	contentArea.innerHTML = "";
	contentArea.appendChild(safeFragment);

	// Add event listener to restore button
	document
		.getElementById("restore-original")
		?.addEventListener("click", () => {
			contentArea.innerHTML = originalContent;
			showStatusMessage("Original content restored");
		});

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
