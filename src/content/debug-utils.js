import { extractContent } from "./content.js";
import { showStatusMessage } from "../utils/ui-utils.js";

// Debug utility function to verify content extraction and API requests

// Function to debug content extraction and API parameters
export function debugContentExtraction() {
	try {
		// Extract content
		const extractedContent = extractContent();

		if (!extractedContent.found) {
			console.error(
				"DEBUG: Content extraction failed - no content found"
			);
			showStatusMessage(
				"Debug: Content extraction failed - no content found",
				"error"
			);
			return;
		}

		// Get word count
		const wordCount = extractedContent.text.split(/\s+/).length;

		// Create debug info display
		const debugInfo = {
			title: extractedContent.title,
			wordCount: wordCount,
			contentPreview: extractedContent.text.substring(0, 200) + "...",
			selector: extractedContent.selector,
			timestamp: new Date().toISOString(),
		};

		// Log to console
		console.log("DEBUG CONTENT EXTRACTION:", debugInfo);

		// Create visual debug display
		const debugDiv = document.createElement("div");
		debugDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            max-height: 500px;
            overflow: auto;
            background-color: #333;
            color: #fff;
            padding: 10px;
            border-radius: 5px;
            z-index: 10000;
            font-family: monospace;
            font-size: 12px;
            border: 1px solid #555;
        `;

		debugDiv.innerHTML = `
            <h3>Content Extraction Debug</h3>
            <p><strong>Title:</strong> ${extractedContent.title}</p>
            <p><strong>Word Count:</strong> ${wordCount}</p>
            <p><strong>Selector:</strong> ${extractedContent.selector}</p>
            <p><strong>Preview:</strong><br>${extractedContent.text
				.substring(0, 200)
				.replace(/\n/g, "<br>")}...</p>
            <button id="close-debug">Close</button>
        `;

		document.body.appendChild(debugDiv);

		// Add close button functionality
		document.getElementById("close-debug").addEventListener("click", () => {
			document.body.removeChild(debugDiv);
		});

		// Show success message
		showStatusMessage(
			"Debug: Content extraction information displayed",
			"info"
		);
	} catch (error) {
		console.error("Debug content extraction error:", error);
		showStatusMessage(
			"Debug: Error during content extraction debugging",
			"error"
		);
	}
}

// Add a debug button to the UI
export function addDebugButton() {
	const controlsContainer = document.getElementById("gemini-controls");
	if (!controlsContainer) return;

	// Check if debug button already exists
	if (document.getElementById("gemini-debug-btn")) return;

	const debugButton = document.createElement("button");
	debugButton.id = "gemini-debug-btn";
	debugButton.textContent = "Debug Extraction";
	debugButton.style.cssText = `
        padding: 5px 10px;
        margin-top: 10px;
        background-color: #444;
        color: #bab9a0;
        border: 1px solid #ffffff21;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    `;

	debugButton.addEventListener("click", debugContentExtraction);
	controlsContainer.appendChild(debugButton);
}
