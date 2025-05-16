// Simplified content script to extract chapter content without relying on imports
console.log("Ranobe Gemini: Content script loaded");

// Note: Import statements need to be modified since content scripts don't support direct ES6 imports
// We'll need to dynamically load our handler modules

// Initial constants and global state
let currentHandler = null; // Will store the website-specific handler
let hasExtractButton = false;
let autoExtracted = false;
let isInitialized = false; // Track if the content script is fully initialized
let isBackgroundScriptReady = false; // Track if the background script is ready

// Device detection for responsive design
let isMobileDevice = false;

// Function to detect if user is on a mobile device
function detectMobileDevice() {
	// Check if using a mobile device based on user agent
	const userAgent = navigator.userAgent || navigator.vendor || window.opera;
	if (
		/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
			userAgent
		) ||
		/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
			userAgent.substr(0, 4)
		)
	) {
		return true;
	}

	// Check viewport width as an additional indicator
	return window.innerWidth <= 768;
}

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
	if (!html) return "";

	console.log("[StripTags Final] Input:", html);

	// Step 1: Use regex to remove all HTML tags before DOM parsing
	let text = html.replace(/<\/?[^>]+(>|$)/g, "");

	console.log("[StripTags Final] After initial regex:", text);

	// Step 2: Create a temporary div element to use the browser's HTML parsing
	const tempDiv = document.createElement("div");
	tempDiv.innerHTML = text;

	// Step 3: Extract text content which automatically removes all HTML tags
	let textOnly = tempDiv.textContent || tempDiv.innerText || "";

	console.log("[StripTags Final] After textContent:", textOnly);

	// Step 4: Additional regex replacement to catch any potential leftover tags
	textOnly = textOnly.replace(/<[^>]*>/g, "");

	// Step 5: Properly decode common HTML entities
	textOnly = textOnly
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'")
		.replace(/&nbsp;/g, " ");

	console.log("[StripTags Final] After entity decoding:", textOnly);

	// Step 6: Clean up any consecutive whitespace but preserve paragraph breaks
	textOnly = textOnly.replace(/\s+/g, " ").trim();

	console.log("[StripTags Final] Final output:", textOnly);

	return textOnly;
}

// Add a verification function to check background script connection
async function verifyBackgroundConnection() {
	try {
		const response = await browser.runtime.sendMessage({ action: "ping" });
		console.log("Background script connection verified:", response);
		isBackgroundScriptReady = response && response.success;
		return isBackgroundScriptReady;
	} catch (error) {
		console.error("Background script connection failed:", error);
		isBackgroundScriptReady = false;
		return false;
	}
}

// Initialize when DOM is fully loaded
window.addEventListener("DOMContentLoaded", initializeWithDeviceDetection);
window.addEventListener("load", initializeWithDeviceDetection); // Backup init in case DOMContentLoaded was missed
window.addEventListener("resize", handleResize); // Handle orientation changes

// Handle window resize events to adjust UI for orientation changes
function handleResize() {
	const wasMobile = isMobileDevice;
	isMobileDevice = detectMobileDevice();

	// If device type changed (e.g., tablet rotation), update UI
	if (wasMobile !== isMobileDevice) {
		adjustUIForDeviceType();
	}
}

// Initialize with device detection
async function initializeWithDeviceDetection() {
	isMobileDevice = detectMobileDevice();
	console.log(
		`Ranobe Gemini: Initializing for ${
			isMobileDevice ? "mobile" : "desktop"
		} device`
	);
	await initialize();
}

// Adjust UI based on device type
function adjustUIForDeviceType() {
	const controlsContainer = document.getElementById("gemini-controls");
	const summaryDisplay = document.getElementById("summary-display");

	if (!controlsContainer) return;

	if (isMobileDevice) {
		// Mobile-specific adjustments
		controlsContainer.classList.add("mobile-view");

		if (summaryDisplay) {
			summaryDisplay.classList.add("mobile-view");
		}
	} else {
		// Desktop-specific adjustments
		controlsContainer.classList.remove("mobile-view");

		if (summaryDisplay) {
			summaryDisplay.classList.remove("mobile-view");
		}
	}
}

// Load handler modules dynamically
async function loadHandlers() {
	try {
		// Import the base handler code
		const baseHandlerUrl = browser.runtime.getURL(
			"utils/website-handlers/base-handler.js"
		);
		const baseHandlerModule = await import(baseHandlerUrl);

		// Import specific handlers
		const ranobesHandlerUrl = browser.runtime.getURL(
			"utils/website-handlers/ranobes-handler.js"
		);
		const fanfictionHandlerUrl = browser.runtime.getURL(
			"utils/website-handlers/fanfiction-handler.js"
		);
		const handlerManagerUrl = browser.runtime.getURL(
			"utils/website-handlers/handler-manager.js"
		);

		// Don't wait for these imports now, we'll use them later when needed
		console.log("Handler URLs loaded:", {
			baseHandlerUrl,
			ranobesHandlerUrl,
			fanfictionHandlerUrl,
			handlerManagerUrl,
		});

		return {
			baseHandlerUrl,
			ranobesHandlerUrl,
			fanfictionHandlerUrl,
			handlerManagerUrl,
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

		const handlerManagerModule = await import(
			handlerUrls.handlerManagerUrl
		);
		if (
			handlerManagerModule &&
			handlerManagerModule.getHandlerForCurrentSite
		) {
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
	const paragraphs = document.querySelectorAll("p");
	if (paragraphs.length > 5) {
		// Get all paragraphs text
		const chapterText = Array.from(paragraphs)
			.map((p) => p.innerText)
			.join("\n\n");

		return {
			found: chapterText.length > 200, // Only consider it found if we have substantial text
			title: document.title || "Unknown Title",
			text: chapterText,
			selector: "generic paragraph extractor",
		};
	}

	// Try to find main content using common article selectors
	const contentSelectors = [
		"article",
		".article",
		".content",
		".story-content",
		".entry-content",
		"#content",
		".main-content",
		".post-content",
		"#storytext", // fanfiction.net
		"#arrticle", // Ranobes.top
		".text-chapter",
		".chapter-content",
		".novel-content",
		".story",
		".chapter-inner",
	];

	for (const selector of contentSelectors) {
		const element = document.querySelector(selector);
		if (element) {
			return {
				found: true,
				title: document.title || "Unknown Title",
				text: element.innerText.trim(),
				selector: `generic selector: ${selector}`,
			};
		}
	}

	// Nothing found
	return {
		found: false,
		title: "",
		text: "",
		selector: "",
	};
}

async function initialize() {
	console.log("Ranobe Gemini: Initializing content script");

	// Verify background script connection
	await verifyBackgroundConnection();

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
	button.addEventListener("click", handleSummarizeButtonClick);
	return button;
}

// Function to create the Enhance button
function createEnhanceButton() {
	const enhanceButton = document.createElement("button");
	enhanceButton.className = "gemini-enhance-btn";

	// Simplify button - remove images and just use text
	enhanceButton.textContent = "Enhance with Gemini";

	// Style to match the sample page buttons
	enhanceButton.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
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
	enhanceButton.addEventListener("click", handleButtonClick);
	enhanceButton.addEventListener("mouseover", () => {
		enhanceButton.style.backgroundColor = "#333";
	});
	enhanceButton.addEventListener("mouseout", () => {
		enhanceButton.style.backgroundColor = "#222";
	});
	return enhanceButton;
}

// Wrapper handler for Enhance button clicks
async function handleButtonClick(event) {
	const button = event.currentTarget;
	const originalText = button.textContent;

	// Check if background script is ready
	if (!isBackgroundScriptReady) {
		try {
			button.disabled = true;
			button.textContent = "Initializing...";
			showStatusMessage("Verifying extension connection...", "info");

			// Try to verify connection
			const isConnected = await verifyBackgroundConnection();

			if (!isConnected) {
				throw new Error(
					"Cannot connect to extension background script"
				);
			}

			// Connection verified, proceed with enhancement
			button.textContent = originalText;
			button.disabled = false;
			await handleEnhanceClick();
		} catch (error) {
			console.error("Connection error:", error);
			showStatusMessage(
				"Error connecting to extension. Please reload the page and try again.",
				"error"
			);
			button.textContent = originalText;
			button.disabled = false;
		}
	} else {
		// Background script is already ready
		await handleEnhanceClick();
	}
}

// Wrapper handler for Summarize button clicks
async function handleSummarizeButtonClick(event) {
	const button = event.currentTarget;
	const originalText = button.textContent;

	// Check if background script is ready
	if (!isBackgroundScriptReady) {
		try {
			button.disabled = true;
			button.textContent = "Initializing...";
			showStatusMessage("Verifying extension connection...", "info");

			// Try to verify connection
			const isConnected = await verifyBackgroundConnection();

			if (!isConnected) {
				throw new Error(
					"Cannot connect to extension background script"
				);
			}

			// Connection verified, proceed with summarization
			button.textContent = originalText;
			button.disabled = false;
			await handleSummarizeClick();
		} catch (error) {
			console.error("Connection error:", error);
			showStatusMessage(
				"Error connecting to extension. Please reload the page and try again.",
				"error"
			);
			button.textContent = originalText;
			button.disabled = false;
		}
	} else {
		// Background script is already ready
		await handleSummarizeClick();
	}
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

	// Apply mobile-specific class if on a mobile device
	if (isMobileDevice) {
		controlsContainer.classList.add("mobile-view");
	}

	const enhanceButton = createEnhanceButton();
	const summarizeButton = createSummarizeButton();
	const statusDiv = document.createElement("div");
	statusDiv.id = "gemini-status";
	statusDiv.style.marginTop = "5px";

	const summaryDisplay = document.createElement("div");
	summaryDisplay.id = "summary-display";
	summaryDisplay.style.marginTop = "10px";
	summaryDisplay.style.padding = "10px";
	summaryDisplay.style.display = "none"; // Initially hidden

	// Apply mobile-specific class if on a mobile device
	if (isMobileDevice) {
		summaryDisplay.classList.add("mobile-view");
	}

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

	console.log(
		`Ranobe Gemini: UI injected successfully for ${
			isMobileDevice ? "mobile" : "desktop"
		} view.`
	);
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
		if (!isBackgroundScriptReady) {
			throw new Error(
				"Background script is not ready. Please reload the page."
			);
		}

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
				// Check for API key missing error
				const errorMessage =
					response?.error || "Failed to generate summary.";
				if (errorMessage.includes("API key is missing")) {
					showStatusMessage(
						"API key is missing. Opening settings page...",
						"error"
					);
					// Open popup for API key input
					browser.runtime.sendMessage({ action: "openPopup" });

					// Clear the summary display area and show appropriate message
					summaryDisplay.textContent =
						"API key is missing. Please add your Gemini API key in the settings.";
					throw new Error("API key is missing");
				} else {
					throw new Error(errorMessage);
				}
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

		// Special handling for API key missing error - already handled above
		if (error.message && error.message.includes("API key is missing")) {
			// Skip adding another error message since we already showed one
			statusDiv.textContent =
				"API key is missing. Please check the settings.";
		} else {
			// For other errors, display the error message
			statusDiv.textContent = `Error: ${error.message}`;
			summaryDisplay.textContent = "Failed to generate summary.";
			summaryDisplay.style.display = "block"; // Keep display visible to show error
		}
	} finally {
		summarizeButton.disabled = false;
		summarizeButton.textContent = "Summarize Chapter";
		// Optionally hide status message after a delay (except for API key missing)
		setTimeout(() => {
			if (
				statusDiv.textContent.includes("Summary generated") &&
				!statusDiv.textContent.includes("API key is missing")
			) {
				statusDiv.textContent = "";
			}
		}, 5000);
	}
}

// Process large content by splitting into parts
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

	if (!isBackgroundScriptReady) {
		showStatusMessage(
			"Background script is not ready. Please reload the page.",
			"error"
		);
		return;
	}

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

	try {
		// Get configuration settings
		const config = await browser.runtime.sendMessage({
			action: "getConfig",
		});

		// Get chunk size from settings, with fallbacks
		const chunkSizeChars = config?.chunkSize || 12000;
		console.log(`Using chunk size of ${chunkSizeChars} characters`);

		// Split content into paragraphs first
		const paragraphs = extractedContent.text.split(/\n\n+/);
		console.log(`Content split into ${paragraphs.length} paragraphs`);

		// Initialize parts with smarter paragraph grouping
		const parts = [];
		let currentPart = "";

		// Group paragraphs into parts, ensuring we don't split in the middle of important sections
		for (const paragraph of paragraphs) {
			// If adding this paragraph would exceed the limit and we already have content, start a new part
			if (
				(currentPart + paragraph).length > chunkSizeChars &&
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

		console.log(`Split content into ${parts.length} parts for processing`);

		// Process each part sequentially
		let allProcessedContent = "";
		let currentPartNum = 1;
		const contentArea = findContentArea(); // Store this once to avoid multiple calls

		// Create a temporary container for incremental updates
		let tempContentContainer = null;

		// Save original content for potential restoration
		const originalContent = contentArea ? contentArea.innerHTML : null;

		// Create a progress bar for visual feedback
		const progressBarContainer = document.createElement("div");
		progressBarContainer.style.cssText = `
			width: 100%;
			margin: 15px 0;
			border: 1px solid #555;
			border-radius: 4px;
			background-color: #222;
			height: 20px;
			position: relative;
			overflow: hidden;
		`;

		const progressBarInner = document.createElement("div");
		progressBarInner.style.cssText = `
			height: 100%;
			background-color: #4285f4;
			width: 0%;
			transition: width 0.5s ease-in-out;
			`;

		const progressText = document.createElement("div");
		progressText.textContent = "Processing...";
		progressText.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			text-align: center;
			color: #bab9a0;
			line-height: 20px;
			font-size: 12px;
			`;

		progressBarContainer.appendChild(progressBarInner);
		progressBarContainer.appendChild(progressText);

		// Add progress bar to page if content area exists
		if (contentArea) {
			// Create temporary container for incremental updates
			tempContentContainer = document.createElement("div");
			tempContentContainer.className =
				"gemini-processed-content-container";
			tempContentContainer.style.cssText = `
				margin-top: 15px;
				line-height: 1.6;
				`;

			// Add the progress bar and container to the content area
			contentArea.innerHTML = "";
			contentArea.appendChild(progressBarContainer);
			contentArea.appendChild(tempContentContainer);
		}

		// Check if we have emoji mode enabled
		const emojiConfig = await browser.runtime.sendMessage({
			action: "getConfig",
		});
		const useEmoji = emojiConfig?.useEmoji === true;

		// Process each part with retry mechanism
		const maxRetries = 2;

		for (let i = 0; i < parts.length; i++) {
			currentPartNum = i + 1;
			const part = parts[i];
			let success = false;
			let retryCount = 0;

			while (!success && retryCount <= maxRetries) {
				// Update button text to show progress
				if (button) {
					button.textContent = `Processing part ${currentPartNum} of ${
						parts.length
					}${retryCount > 0 ? ` (Retry ${retryCount})` : ""}...`;
				}

				// Update progress bar
				const progress = Math.round(
					((currentPartNum - 1) / parts.length) * 100
				);
				progressBarInner.style.width = `${progress}%`;
				progressText.textContent = `Processing part ${currentPartNum} of ${
					parts.length
				} (${progress}%)${
					retryCount > 0 ? ` - Retry ${retryCount}` : ""
				}`;

				// Display progress
				showStatusMessage(
					`Processing part ${currentPartNum} of ${parts.length}${
						retryCount > 0 ? ` (Retry ${retryCount})` : ""
					}...`,
					"info"
				);

				// Create a part-specific title
				const partTitle = `${extractedContent.title} (Part ${currentPartNum}/${parts.length})`;

				try {
					// Make sure the background script is still alive with a ping before processing
					try {
						const pingResponse = await browser.runtime.sendMessage({
							action: "ping",
						});
						if (!pingResponse || !pingResponse.success) {
							throw new Error(
								"Background script not responding properly"
							);
						}
					} catch (pingError) {
						console.error(
							"Lost connection to background script:",
							pingError
						);
						throw new Error(
							"Lost connection to background script. Please reload the page and try again."
						);
					}

					// Add a small delay between parts to prevent rate limiting and give UI time to update
					if (currentPartNum > 1) {
						await new Promise((resolve) =>
							setTimeout(resolve, 1000)
						);
					}

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
						useEmoji: useEmoji,
					});

					if (response && response.success && response.result) {
						console.log(
							`Successfully processed part ${currentPartNum}/${parts.length}`
						);

						// Add this processed part to our accumulated result
						allProcessedContent +=
							(allProcessedContent ? "\n\n" : "") +
							response.result;

						// If we're doing incremental updates, show this part immediately
						if (tempContentContainer) {
							// Process and display this part
							const processedPart = response.result;

							// Create a part separator if this isn't the first part
							if (currentPartNum > 1) {
								const separator = document.createElement("hr");
								separator.style.cssText =
									"border: 0; border-top: 1px dashed #666; margin: 20px 0;";
								tempContentContainer.appendChild(separator);
							}

							// Add a part indicator
							const partIndicator = document.createElement("div");
							partIndicator.textContent = `Part ${currentPartNum} of ${parts.length}`;
							partIndicator.style.cssText =
								"font-size: 0.8em; color: #888; margin-bottom: 10px; font-style: italic;";
							tempContentContainer.appendChild(partIndicator);

							// Add the content based on whether it contains HTML or is plain text
							if (!/<p>|<div>|<span>/.test(processedPart)) {
								// For text content, convert newlines to paragraphs
								const paragraphs = processedPart.split(/\n\n+/);
								paragraphs.forEach((paragraph) => {
									if (paragraph.trim()) {
										const p = document.createElement("p");
										p.textContent = paragraph;
										tempContentContainer.appendChild(p);
									}
								});
							} else {
								// For HTML content, use a parser
								try {
									const parser = new DOMParser();
									const doc = parser.parseFromString(
										processedPart,
										"text/html"
									);

									// Remove any script tags for security
									const scripts =
										doc.querySelectorAll("script");
									scripts.forEach((script) =>
										script.remove()
									);

									// Append each child
									Array.from(doc.body.childNodes).forEach(
										(node) => {
											tempContentContainer.appendChild(
												node.cloneNode(true)
											);
										}
									);
								} catch (parseError) {
									// Fallback if parsing fails
									console.error(
										"Error parsing HTML content:",
										parseError
									);
									const div = document.createElement("div");
									div.textContent = processedPart;
									tempContentContainer.appendChild(div);
								}
							}

							// Scroll to show progress, but not too aggressively
							if (currentPartNum > 1) {
								tempContentContainer.scrollIntoView({
									behavior: "smooth",
									block: "end",
									inline: "nearest",
								});
							}
						}

						// Mark as successful to continue to next part
						success = true;
					} else {
						throw new Error(
							response?.error || "Failed to process part"
						);
					}
				} catch (error) {
					console.error(
						`Error processing part ${currentPartNum}:`,
						error
					);
					retryCount++;

					// Handle different error types
					if (
						error.message &&
						(error.message.includes("rate limit") ||
							error.message.includes("quota") ||
							error.message.includes("too many requests"))
					) {
						const waitTimeMs = Math.min(retryCount * 60000, 300000); // Increase wait time with each retry, max 5 minutes
						const waitTimeMin = waitTimeMs / 60000;

						showStatusMessage(
							`Rate limit reached. Waiting ${waitTimeMin} minute(s) before retrying...`,
							"info"
						);

						if (progressText) {
							progressText.textContent = `Rate limit reached. Waiting ${waitTimeMin} minute(s)...`;
						}

						// Wait for the specified time
						await new Promise((resolve) =>
							setTimeout(resolve, waitTimeMs)
						);

						// Update progress message
						showStatusMessage(
							`Retrying part ${currentPartNum} after waiting...`,
							"info"
						);

						// Continue to retry this part
					} else if (
						error.message &&
						error.message.includes("Lost connection")
					) {
						// Connection error - show clear message and stop processing
						showStatusMessage(
							"Lost connection to extension. Please reload the page and try again.",
							"error"
						);

						// If we have a temp container with partial results, keep it displayed
						if (
							!tempContentContainer ||
							tempContentContainer.childNodes.length === 0
						) {
							// If no partial content, restore original
							if (contentArea && originalContent) {
								contentArea.innerHTML = originalContent;
							}
						}

						// Restore button state
						if (button) {
							button.textContent = originalButtonText;
							button.disabled = false;
						}

						return false;
					} else if (retryCount > maxRetries) {
						// We've exceeded max retries, show error and continue to next part
						showStatusMessage(
							`Failed to process part ${currentPartNum} after ${maxRetries} retries. Continuing with next part...`,
							"warning"
						);

						// Add an error note to the displayed content
						if (tempContentContainer) {
							const errorNote = document.createElement("div");
							errorNote.textContent = `⚠️ Error processing part ${currentPartNum}. Some content may be missing.`;
							errorNote.style.cssText =
								"color: #ff6b6b; margin: 10px 0; font-style: italic;";
							tempContentContainer.appendChild(errorNote);
						}

						// Continue to the next part
						break;
					} else {
						// For other errors, wait a bit and retry
						const waitTime = 3000 * retryCount; // Progressively wait longer
						showStatusMessage(
							`Error processing part ${currentPartNum}. Retrying in ${
								waitTime / 1000
							} seconds...`,
							"warning"
						);
						await new Promise((resolve) =>
							setTimeout(resolve, waitTime)
						);
					}
				}
			}
		}

		// Restore button state
		if (button) {
			button.textContent = originalButtonText;
			button.disabled = false;
		}

		// Remove progress bar
		if (progressBarContainer && progressBarContainer.parentNode) {
			progressBarContainer.parentNode.removeChild(progressBarContainer);
		}

		if (allProcessedContent) {
			console.log("===========================================");
			console.log("ALL PARTS PROCESSED SUCCESSFULLY");
			console.log("===========================================");

			// Show success message
			showStatusMessage(
				`Successfully processed all ${parts.length} parts!`
			);

			// Replace content with enhanced version
			await replaceContentWithEnhancedVersion(allProcessedContent);
			return true;
		} else {
			showStatusMessage("Failed to process content in parts", "error");
			return false;
		}
	} catch (mainError) {
		console.error("Error in processLargeContentInParts:", mainError);
		showStatusMessage(`Error: ${mainError.message}`, "error");

		// Restore button state
		if (button) {
			button.textContent = originalButtonText;
			button.disabled = false;
		}

		return false;
	}
}

// Function to replace content with Gemini-enhanced version
async function replaceContentWithEnhancedVersion(enhancedContent) {
	const contentArea = findContentArea();
	if (!contentArea) {
		showStatusMessage(
			"Unable to find content area for replacement",
			"error"
		);
		return false;
	}

	try {
		// Save the scroll position
		const scrollPosition = window.scrollY;

		// Replace the content
		console.log("Replacing content area with Gemini-enhanced version...");
		contentArea.innerHTML = sanitizeHTML(enhancedContent);

		// Apply site-specific formatting if needed
		if (
			currentHandler &&
			typeof currentHandler.formatAfterEnhancement === "function"
		) {
			currentHandler.formatAfterEnhancement(contentArea);
		} else {
			// Default formatting for all sites
			applyDefaultFormatting(contentArea);
		}

		// Restore scroll position
		window.scrollTo(0, scrollPosition);

		// Don't show a duplicate success message here as it's already shown
		// after processing in the handleEnhanceClick function
		// Remove or comment out the success message to prevent duplication:
		// showStatusMessage("Successfully enhanced with Gemini!");

		return true;
	} catch (error) {
		console.error("Error replacing content:", error);
		showStatusMessage(`Error replacing content: ${error.message}`, "error");
		return false;
	}
}

// Default formatting to apply after enhancement
function applyDefaultFormatting(contentArea) {
	// Make sure paragraphs have proper spacing
	const paragraphs = contentArea.querySelectorAll("p");
	paragraphs.forEach((p) => {
		p.style.marginBottom = "1em";
		p.style.lineHeight = "1.6";
	});

	// Format any headers that might be in the enhanced content
	const headers = contentArea.querySelectorAll("h1, h2, h3, h4, h5, h6");
	headers.forEach((header) => {
		header.style.marginTop = "1em";
		header.style.marginBottom = "0.5em";
	});
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
initializeWithDeviceDetection();
