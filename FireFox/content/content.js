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

function initialize() {
	console.log("Ranobe Gemini: Initializing content script");

	// Create extract button if it doesn't exist
	if (!hasExtractButton) {
		createExtractButton();

		// Also look for content periodically in case the page loads dynamically
		const checkInterval = setInterval(() => {
			const contentArea = findContentArea();
			const button = document.querySelector(".gemini-enhance-btn");

			if (contentArea && !button) {
				console.log("Content area found in interval check");
				createExtractButton();
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

// Create a button styled like the ones in the sample page
function createExtractButton() {
	// Find the chapter content area
	const contentArea = findContentArea();

	if (!contentArea) {
		console.log(
			"Chapter content area not found. This might not be a chapter page."
		);
		return;
	}

	console.log("Creating extract button");

	// Create button with icons for both light and dark mode
	const enhanceButton = document.createElement("button");
	enhanceButton.className = "gemini-enhance-btn";
	enhanceButton.innerHTML = `
        <img src="${browser.runtime.getURL(
			"icons/logo-light-16.png"
		)}" class="light-mode-icon" alt="">
        <img src="${browser.runtime.getURL(
			"icons/logo-dark-16.png"
		)}" class="dark-mode-icon" alt="">
        Enhance with Gemini
    `;

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
	enhanceButton.addEventListener("click", processWithGemini);
	enhanceButton.addEventListener("mouseover", () => {
		enhanceButton.style.backgroundColor = "#333";
	});
	enhanceButton.addEventListener("mouseout", () => {
		enhanceButton.style.backgroundColor = "#222";
	});
	// Insert button before the content area
	contentArea.parentNode.insertBefore(enhanceButton, contentArea);
	hasExtractButton = true;
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
			chapterTitle =
				document.querySelector("h1.title, .story-title, .chapter-title")
					?.innerText ||
				document.title ||
				"Unknown Title";
			// Get clean text content - preserve full text
			chapterText = element.innerText
				.trim()
				.replace(/\n\s+/g, "\n") // Preserve paragraph breaks but remove excess whitespace
				.replace(/\s{2,}/g, " "); // Replace multiple spaces with a single space
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

// Process the content with Gemini
async function processWithGemini() {
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
					"API key is missing. Please set it in the options page that has opened.",
					"error"
				);
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
				"API key is missing. Please set it in the options page that has opened.",
				"error"
			);
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

// Function to replace page content with enhanced version
async function replaceContentWithEnhancedVersion(enhancedText) {
	const contentArea = findContentArea();
	if (!contentArea) return;

	// Save original content
	const originalContent = contentArea.innerHTML;

	// Process the HTML received from Gemini - check if it already has HTML tags
	let processedHtml = enhancedText;
	// If there are no paragraph tags, convert newlines to paragraph tags
	if (!/<p>|<div>|<span>/.test(processedHtml)) {
		processedHtml = enhancedText
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

	// Replace content
	contentArea.innerHTML = processedHtml;

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
	console.log("Received message:", message);

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
			text: result.text,
		});
		return true;
	}

	if (message.action === "getRawText") {
		const result = extractContent();
		sendResponse({
			success: result.found,
			text: result.text,
			title: result.title,
		});
		return true;
	}

	if (message.action === "processWithGemini") {
		processWithGemini();
		sendResponse({ success: true });
		return true;
	}

	return false;
});

// Run initialization immediately in case the page is already loaded
initialize();
