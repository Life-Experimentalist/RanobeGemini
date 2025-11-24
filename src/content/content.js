// Simplified content script to extract chapter content without relying on imports
console.log("Ranobe Gemini: Content script loaded");

// Note: Import statements need to be modified since content scripts don't support direct ES6 imports
// We'll need to dynamically load our handler modules

// Initial constants and global state
let currentHandler = null; // Will store the website-specific handler
let hasExtractButton = false;
let autoExtracted = false;
var isInitialized = false; // Track if the content script is fully initialized (var to avoid redeclaration)
if (window.__RGInitDone) {
	console.log(
		"Ranobe Gemini: Content script already initialized, skipping duplicate load."
	);
} else {
	window.__RGInitDone = true;
	let isBackgroundScriptReady = false; // Track if the background script is ready

	// Device detection for responsive design
	let isMobileDevice = false;

	// Function to detect if user is on a mobile device
	function detectMobileDevice() {
		// Check if using a mobile device based on user agent
		const userAgent =
			navigator.userAgent || navigator.vendor || window.opera;
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

	// Add a minimal HTML sanitizer to remove script tags and code block markers
	function sanitizeHTML(html) {
		if (!html) return html;

		// Remove any <script>...</script> elements
		let sanitized = html.replace(
			/<script[\s\S]*?>[\s\S]*?<\/script>/gi,
			""
		);

		// Remove code block markers like ```html, ```javascript, etc.
		sanitized = sanitized.replace(
			/```(?:html|javascript|css|js|xml|json|md|markdown|)\s*\n?/gi,
			""
		);

		// Remove closing code block markers ```
		sanitized = sanitized.replace(/```\s*\n?/g, "");

		return sanitized;
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
			const response = await browser.runtime.sendMessage({
				action: "ping",
			});
			console.log("Background script connection verified:", response);
			isBackgroundScriptReady = response && response.success;
			return isBackgroundScriptReady;
		} catch (error) {
			console.error("Background script connection failed:", error);
			isBackgroundScriptReady = false;
			return false;
		}
	}

	// Function to identify and protect game stats boxes
	function preserveGameStatsBoxes(content) {
		// Replace game stats boxes with placeholders to protect them
		let preservedBoxes = [];

		// Regex patterns for common game status box formats
		const patterns = [
			// Format with multiple status lines:
			/(\[(?:Status|Attributes|Skills|Stats|Name|Level|HP|MP|SP|Mana|Energy|Class|Strength|Agility|Intelligence|Wisdom|Vitality|Luck|Fame|Title|Achievement)[\s\S]*?\][\s\S]*?(?=\n\n|\n\[|$))/gi,

			// Format with brackets:
			/(\[[\s\S]*?Name:[\s\S]*?Level:[\s\S]*?\])/gi,

			// Format with asterisks or equals signs as borders:
			/((?:\*{3,}|={3,})[\s\S]*?(?:Status|Stats|Attributes|Skills)[\s\S]*?(?:\*{3,}|={3,}))/gi,

			// Format with just indentation:
			/((?:^|\n)[ \t]+Status:[\s\S]*?(?:\n\n|$))/gi,
		];

		// Check for each pattern
		let modifiedContent = content;

		patterns.forEach((pattern) => {
			modifiedContent = modifiedContent.replace(pattern, (match) => {
				const placeholder = `[GAME_STATS_BOX_${preservedBoxes.length}]`;
				// Trim the match and remove leading/trailing empty lines
				const cleanedMatch = match
					.trim()
					.replace(/^\s*[\r\n]+/gm, "")
					.replace(/[\r\n]+\s*$/gm, "");
				preservedBoxes.push(cleanedMatch);
				return placeholder;
			});
		});

		return {
			modifiedContent,
			preservedBoxes,
		};
	}

	// Function to restore game stats boxes after enhancement
	function restoreGameStatsBoxes(content, preservedBoxes) {
		let restoredContent = content;

		// Replace each placeholder with the original game stats box
		preservedBoxes.forEach((box, index) => {
			const placeholder = `[GAME_STATS_BOX_${index}]`;

			// Get the number of lines to help with sizing
			// Thoroughly clean the box content - trim and remove any empty lines at beginning and end
			const cleanedBox = box
				.trim()
				.replace(/^\s*[\r\n]+/gm, "")
				.replace(/[\r\n]+\s*$/gm, "");

			const lineCount = cleanedBox.split("\n").length;
			const longestLine = getLongestLineLength(cleanedBox);

			// Replace placeholder with a properly styled game stats box
			// Using display: flex and justify-content: center for vertical alignment
			// Wrap in a container div to ensure each box is on its own line
			restoredContent = restoredContent.replace(
				placeholder,
				`<div class="game-stats-box-container"><div class="game-stats-box" style="padding-top: 0px; margin-top: 0px; width: auto; min-width: ${Math.min(
					Math.max(longestLine * 8, 300),
					800
				)}px; display: flex; flex-direction: column; justify-content: center;">${cleanedBox}</div></div>`
			);
		});

		return restoredContent;
	}

	// Helper function to get the length of the longest line in a text block
	function getLongestLineLength(text) {
		if (!text) return 0;
		const lines = text.split("\n");
		let maxLength = 0;

		lines.forEach((line) => {
			const lineLength = line.length;
			if (lineLength > maxLength) {
				maxLength = lineLength;
			}
		});

		return maxLength;
	}

	// Function to preserve images and other HTML elements
	function preserveHtmlElements(content) {
		const preservedElements = [];

		// First preserve images with all attributes
		let processedContent = content.replace(
			/<img\s+[^>]*?src=['"]([^'"]*)['"](.*?)?>/gi,
			(match) => {
				const placeholder = `[PRESERVED_IMAGE_${preservedElements.length}]`;
				preservedElements.push(match);
				return placeholder;
			}
		);

		// Then preserve figure elements with any nested images
		processedContent = processedContent.replace(
			/<figure\b[^>]*>[\s\S]*?<\/figure>/gi,
			(match) => {
				const placeholder = `[PRESERVED_FIGURE_${preservedElements.length}]`;
				preservedElements.push(match);
				return placeholder;
			}
		);

		// Preserve other media elements and game stats boxes
		processedContent = processedContent.replace(
			/<(iframe|video|audio|source)\s+[^>]*>|<div class="game-stats-box">[\s\S]*?<\/div>/gi,
			(match) => {
				const placeholder = `[PRESERVED_ELEMENT_${preservedElements.length}]`;
				preservedElements.push(match);
				return placeholder;
			}
		);

		console.log(
			`Preserved ${preservedElements.length} HTML elements (images, figures, and other elements)`
		);

		return {
			modifiedContent: processedContent,
			preservedElements: preservedElements,
		};
	}

	// Function to restore preserved HTML elements
	function restoreHtmlElements(content, preservedElements) {
		if (!preservedElements || preservedElements.length === 0) {
			return content;
		}

		let restoredContent = content;

		// Replace each placeholder with the original preserved element
		preservedElements.forEach((element, index) => {
			const placeholder = `[PRESERVED_ELEMENT_${index}]`;
			restoredContent = restoredContent.replace(
				new RegExp(placeholder, "g"),
				element
			);
		});

		return restoredContent;
	}

	// Create an enhanced banner with word count comparison and model info
	function createEnhancedBanner(originalContent, enhancedContent, modelInfo) {
		// Calculate word counts
		const originalWordCount = countWords(originalContent);
		const enhancedWordCount = countWords(enhancedContent);

		// Calculate percentage change
		const wordDifference = enhancedWordCount - originalWordCount;
		const percentChange =
			originalWordCount > 0
				? Math.round((wordDifference / originalWordCount) * 100)
				: 0;

		// Determine if it's an increase or decrease
		const changeSymbol = wordDifference >= 0 ? "+" : "-";

		// Get model name and provider from modelInfo if available
		const modelName = modelInfo?.name || "AI";
		const modelProvider = modelInfo?.provider || "Ranobe Gemini";
		const modelDisplay = `Enhanced with ${modelProvider}${
			modelName ? ` (${modelName})` : ""
		} by Ranobe Gemini`;

		const banner = document.createElement("div");
		banner.className = "gemini-enhanced-banner";
		banner.style.cssText = `
        margin: 15px 0;
        padding: 15px;
        background-color: #f7f7f7;
        border-radius: 8px;
        border: 1px solid #ddd;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    `;

		// Support dark mode
		if (
			document.querySelector(
				'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth'
			) ||
			window.matchMedia("(prefers-color-scheme: dark)").matches
		) {
			banner.style.backgroundColor = "#2c2c2c";
			banner.style.borderColor = "#444";
			banner.style.color = "#e0e0e0";
		}

		banner.innerHTML = `
        <div style="display: flex; flex-direction: column; width: 100%;">
			<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center;">
                        <span style="font-size: 18px; margin-right: 5px;">✨</span>
                        <span style="font-weight: bold; margin: 0 10px; font-size: 16px;">${modelDisplay}</span>
                    </div>
                    <button class="gemini-toggle-btn">Show Original</button>
                </div>
            <div style="width: 100%; font-size: 14px; color: #555; padding-top: 8px; border-top: 1px solid #eee;">
                <span style="font-family: monospace;">
                    Words: ${originalWordCount.toLocaleString()} → ${enhancedWordCount.toLocaleString()}
                    <span style="color: ${
						wordDifference >= 0 ? "#28a745" : "#dc3545"
					}; font-weight: bold;">
                        (${changeSymbol}${wordDifference.toLocaleString()}, ${changeSymbol}${Math.abs(
			percentChange
		)}%)
                    </span>
                </span>
            </div>
        </div>
    `;

		return banner;
	}

	// Function to create a work-in-progress banner
	function createWorkInProgressBanner(currentChunk, totalChunks) {
		const progressPercent = Math.round((currentChunk / totalChunks) * 100);

		const banner = document.createElement("div");
		banner.className = "gemini-wip-banner";
		banner.style.cssText = `
        margin: 15px 0;
        padding: 15px;
        background-color: #fffbea;
        border-radius: 8px;
        border: 1px solid #f0e0a2;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    `;

		// Support dark mode
		if (
			document.querySelector(
				'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth'
			) ||
			window.matchMedia("(prefers-color-scheme: dark)").matches
		) {
			banner.style.backgroundColor = "#3a3a2c";
			banner.style.borderColor = "#5a5a40";
			banner.style.color = "#e0e0e0";
		}

		banner.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 18px; margin-right: 10px;">⏳</span>
            <span style="font-weight: bold; font-size: 16px;">Enhancing Content: Work in Progress</span>
        </div>
        <div style="width: 100%; margin: 10px 0; background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden;">
            <div style="width: ${progressPercent}%; background: #4285f4; height: 100%;"></div>
        </div>
        <div style="font-size: 14px; color: #555;">
            Processing chunk ${currentChunk} of ${totalChunks} (${progressPercent}% complete). Please wait while the content is being enhanced...
        </div>
    `;

		return banner;
	}

	// Function to create an error disclaimer banner
	function createErrorDisclaimerBanner(error, hasPartialContent = false) {
		const banner = document.createElement("div");
		banner.className = "gemini-error-banner";
		banner.style.cssText = `
        margin: 15px 0;
        padding: 15px;
        background-color: #feeced;
        border-radius: 8px;
        border: 1px solid #f5c2c7;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    `;

		// Support dark mode
		if (
			document.querySelector(
				'.dark-theme, [data-theme="dark"], .dark-mode, .reading_fullwidth'
			) ||
			window.matchMedia("(prefers-color-scheme: dark)").matches
		) {
			banner.style.backgroundColor = "#3a2c2d";
			banner.style.borderColor = "#5a3f3f";
			banner.style.color = "#e0e0e0";
		}

		// Create different message depending on if we have partial content
		const messageText = hasPartialContent
			? "An error occurred during processing, but some content was successfully enhanced. The original content was preserved for the sections that couldn't be processed."
			: "An error occurred during processing. The content below is the original text.";

		const iconClass = hasPartialContent ? "⚠️" : "❌";
		const bannerTitle = hasPartialContent
			? "Partial Content Available"
			: "Processing Error";

		banner.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 18px; margin-right: 10px;">${iconClass}</span>
            <span style="font-weight: bold; font-size: 16px;">${bannerTitle}</span>
        </div>
        <div style="font-size: 14px; margin-bottom: 8px;">
            ${messageText}
        </div>
        <div style="font-size: 13px; color: #842029; background: rgba(220, 53, 69, 0.1); padding: 8px; border-radius: 4px;">
            Error details: ${error}
        </div>
    `;

		return banner;
	}

	// Function to update the work-in-progress banner with real-time progress
	function updateWorkInProgressBanner(
		currentChunk,
		totalChunks,
		progressPercent = null
	) {
		let banner = document.querySelector(".gemini-wip-banner");

		if (!progressPercent) {
			progressPercent = Math.round((currentChunk / totalChunks) * 100);
		}

		if (banner) {
			// Update existing banner
			const progressBar = banner.querySelector(
				"div > div:nth-child(2) > div"
			);
			if (progressBar) {
				progressBar.style.width = `${progressPercent}%`;
			}

			const statusText = banner.querySelector("div:nth-child(3)");
			if (statusText) {
				statusText.textContent = `Processing chunk ${currentChunk} of ${totalChunks} (${progressPercent}% complete). Please wait while the content is being enhanced...`;
			}
		} else {
			if (contentArea && contentArea.firstChild) {
				contentArea.insertBefore(banner, contentArea.firstChild);
			}
		}

		return banner;
	}

	// Function to remove the original word count element
	function removeOriginalWordCount() {
		const originalWordCount = document.querySelector(".gemini-word-count");
		if (originalWordCount) {
			console.log("Removing original word count display");
			originalWordCount.parentNode.removeChild(originalWordCount);
		}
	}

	// Handler for processed chunks from the background script
	function handleChunkProcessed(message) {
		console.log(
			`Received processed chunk ${message.chunkIndex + 1}/${
				message.totalChunks
			}`
		);

		const contentArea = findContentArea();
		if (!contentArea) {
			console.error(
				"Unable to find content area for displaying processed chunk"
			);
			return;
		}

		// First time? Create a special container for progressive updates
		let progressiveContentContainer = document.getElementById(
			"gemini-progressive-content"
		);
		if (!progressiveContentContainer) {
			// Preserve original content
			const originalContent = contentArea.innerHTML;
			contentArea.setAttribute("data-original-content", originalContent);

			// Create container for progressive updates
			progressiveContentContainer = document.createElement("div");
			progressiveContentContainer.id = "gemini-progressive-content";

			// Clear content area and add our container
			contentArea.innerHTML = "";
			contentArea.appendChild(progressiveContentContainer);

			// Add the work in progress banner
			const wipBanner = createWorkInProgressBanner(
				message.chunkIndex + 1,
				message.totalChunks
			);
			contentArea.insertBefore(wipBanner, progressiveContentContainer);
		} else {
			// Update the existing work in progress banner
			updateWorkInProgressBanner(
				message.chunkIndex + 1,
				message.totalChunks
			);
		}

		// Extract and process the chunk's content
		const chunkResult = message.result;
		if (chunkResult && chunkResult.enhancedContent) {
			// Clean up any code block markers and sanitize HTML
			const sanitizedContent = sanitizeHTML(chunkResult.enhancedContent);

			// Create a container for this chunk
			const chunkContainer = document.createElement("div");
			chunkContainer.className = "gemini-chunk";
			chunkContainer.setAttribute("data-chunk-index", message.chunkIndex);
			chunkContainer.innerHTML = sanitizedContent;

			// Add to our progressive content container
			progressiveContentContainer.appendChild(chunkContainer);

			// Check if all chunks are processed
			if (message.isComplete) {
				// Remove the WIP banner
				const wipBanner = document.querySelector(".gemini-wip-banner");
				if (wipBanner) {
					wipBanner.remove();
				}

				// Create the final enhanced banner
				finalizePrefixEnhancedContent(chunkResult.modelInfo);
			}
		}
	}

	// Handler for chunk processing errors
	function handleChunkError(message) {
		console.log(
			`Error processing chunk ${message.chunkIndex + 1}/${
				message.totalChunks
			}:`,
			message.error
		);

		const contentArea = findContentArea();
		if (!contentArea) {
			console.error("Unable to find content area for displaying error");
			return;
		}

		// Check if we have any processed content
		const hasPartialContent =
			document.getElementById("gemini-progressive-content") !== null &&
			document.querySelector(".gemini-chunk") !== null;

		// Update or create the WIP banner to reflect the error
		const wipBanner = document.querySelector(".gemini-wip-banner");
		if (wipBanner) {
			// Replace with error banner
			const errorBanner = createErrorDisclaimerBanner(
				message.error,
				hasPartialContent
			);
			wipBanner.replaceWith(errorBanner);
		} else {
			// Create new error banner
			const errorBanner = createErrorDisclaimerBanner(
				message.error,
				hasPartialContent
			);
			contentArea.insertBefore(errorBanner, contentArea.firstChild);
		}

		// If it's a rate limit error, update the banner with waiting information and allow retry
		if (message.isRateLimit) {
			let waitTimeSeconds = 60; // Default wait time
			if (message.waitTime) {
				waitTimeSeconds = Math.ceil(message.waitTime / 1000);
			}

			// Show status message with retry information
			showStatusMessage(
				`Rate limit reached. Waiting ${waitTimeSeconds} seconds before continuing...`,
				"warning"
			);

			// Create a retry button for rate limit errors
			if (hasPartialContent) {
				const errorBanner = document.querySelector(
					".gemini-error-banner"
				);
				if (errorBanner) {
					const retryButton = document.createElement("button");
					retryButton.textContent = "Retry Processing";
					retryButton.style.cssText = `
					margin-top: 10px;
					padding: 6px 12px;
					background: #4285f4;
					color: white;
					border: none;
					border-radius: 4px;
					cursor: pointer;
				`;
					retryButton.addEventListener("click", () => {
						// Replace error banner with WIP banner
						const wipBanner = createWorkInProgressBanner(
							message.chunkIndex + 1,
							message.totalChunks
						);
						errorBanner.replaceWith(wipBanner);

						// Request resuming processing from where it left off
						browser.runtime
							.sendMessage({
								action: "resumeProcessing",
								startChunkIndex: message.chunkIndex,
								totalChunks: message.totalChunks,
								remainingChunks:
									message.unprocessedChunks || [],
							})
							.catch((error) => {
								console.error(
									"Error requesting to resume processing:",
									error
								);
								showStatusMessage(
									"Failed to resume processing. Please try again later.",
									"error"
								);
							});
					});

					// Add retry button to error banner
					errorBanner.appendChild(retryButton);
				}
			}
		}
	}

	// Handler for all chunks processed notification
	function handleAllChunksProcessed(message) {
		console.log(
			`All chunks processed: ${message.totalProcessed}/${message.totalChunks} successful`
		);

		const contentArea = findContentArea();
		if (!contentArea) {
			console.error("Unable to find content area for finalizing content");
			return;
		}

		// If there were failures, show an error banner
		if (message.failedChunks && message.failedChunks.length > 0) {
			const hasPartialContent = message.totalProcessed > 0;
			const errorMessage = `Failed to process ${message.failedChunks.length} out of ${message.totalChunks} chunks.`;

			// Remove any existing WIP banner
			const wipBanner = document.querySelector(".gemini-wip-banner");
			if (wipBanner) {
				const errorBanner = createErrorDisclaimerBanner(
					errorMessage,
					hasPartialContent
				);
				wipBanner.replaceWith(errorBanner);
			} else {
				// Create error banner if none exists
				const errorBanner = createErrorDisclaimerBanner(
					errorMessage,
					hasPartialContent
				);
				contentArea.insertBefore(errorBanner, contentArea.firstChild);
			}
		} else {
			// Everything processed successfully, finalize the content
			finalizePrefixEnhancedContent();
		}

		// Show status message with detailed information
		if (message.totalProcessed === message.totalChunks) {
			showStatusMessage(
				`Content successfully enhanced with Gemini! (${message.totalProcessed} chunks processed)`,
				"success"
			);
		} else {
			// Calculate percentage of successful chunks
			const successPercentage = Math.round(
				(message.totalProcessed / message.totalChunks) * 100
			);
			showStatusMessage(
				`Partially enhanced ${message.totalProcessed} of ${message.totalChunks} chunks (${successPercentage}% complete).`,
				"warning"
			);
		}

		// If we have a progressive content container, add a class to indicate completion
		const progressiveContainer = document.getElementById(
			"gemini-progressive-content"
		);
		if (progressiveContainer) {
			progressiveContainer.classList.add("gemini-processing-complete");
		}
	}

	// Helper function to finalize the progressive content display
	function finalizePrefixEnhancedContent(modelInfo) {
		const contentArea = findContentArea();
		if (!contentArea) return;

		const progressiveContainer = document.getElementById(
			"gemini-progressive-content"
		);
		if (!progressiveContainer) return;

		// Calculate word counts for banner
		const originalContent = contentArea.getAttribute(
			"data-original-content"
		);
		const originalText = stripHtmlTags(originalContent);
		const enhancedText = stripHtmlTags(progressiveContainer.innerHTML);

		// Create enhanced banner with word count statistics and model info
		const banner = createEnhancedBanner(
			originalText,
			enhancedText,
			modelInfo
		);

		// Get the toggle button from the banner
		const toggleButton = banner.querySelector(".gemini-toggle-btn");
		if (toggleButton) {
			toggleButton.addEventListener("click", function () {
				const isShowingEnhanced =
					contentArea.getAttribute("data-showing-enhanced") ===
					"true";

				if (isShowingEnhanced) {
					// Switch to original
					contentArea.innerHTML = originalContent;
					toggleButton.textContent = "Show Enhanced";
					contentArea.setAttribute("data-showing-enhanced", "false");

					// Show status message
					showStatusMessage(
						"Showing original content. Click 'Show Enhanced' to view the improved version."
					);
				} else {
					// Switch back to enhanced
					// Recreate content structure
					contentArea.innerHTML = "";
					contentArea.appendChild(progressiveContainer);
					contentArea.insertBefore(banner, progressiveContainer);
					toggleButton.textContent = "Show Original";
					contentArea.setAttribute("data-showing-enhanced", "true");

					// Show status message
					showStatusMessage(
						"Showing enhanced content. Click 'Show Original' to view the original version."
					);
				}
			});
		}

		// Store state for toggling
		contentArea.setAttribute("data-showing-enhanced", "true");

		// Add banner to the top of content area
		contentArea.insertBefore(banner, progressiveContainer);

		// Remove any existing WIP banner
		const wipBanner = document.querySelector(".gemini-wip-banner");
		if (wipBanner) {
			wipBanner.remove();
		}

		// Remove any existing error banners since we're done
		const errorBanner = document.querySelector(".gemini-error-banner");
		if (errorBanner) {
			errorBanner.remove();
		}

		// Add a class to indicate processing is complete
		progressiveContainer.classList.add("gemini-processing-complete");
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
			const handlerManagerUrl = browser.runtime.getURL(
				"utils/website-handlers/handler-manager.js"
			);

			// Import specific handlers
			const ranobesHandlerUrl = browser.runtime.getURL(
				"utils/website-handlers/ranobes-handler.js"
			);
			const fanfictionHandlerUrl = browser.runtime.getURL(
				"utils/website-handlers/fanfiction-handler.js"
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

			// Handler manager exports a default instance
			const handlerManager =
				handlerManagerModule.default || handlerManagerModule;

			if (
				handlerManager &&
				typeof handlerManager.getHandlerForCurrentSite === "function"
			) {
				const handler = await handlerManager.getHandlerForCurrentSite();
				console.log(
					"Handler loaded:",
					handler ? handler.constructor.name : "null"
				);
				return handler;
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
			"#arrticle", // Ranobes.net
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
			console.log(
				`Using specific handler for ${window.location.hostname}`
			);
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
			"#arrticle", // Ranobes.net
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

	// Function to add initial word count display below the buttons
	function addInitialWordCountDisplay(contentArea) {
		if (!contentArea) return;

		const originalContent =
			contentArea.innerText || contentArea.textContent;
		const wordCount = countWords(originalContent);

		// Create word count container
		const wordCountContainer = document.createElement("div");
		wordCountContainer.className = "gemini-word-count";
		wordCountContainer.style.cssText = `
		margin: 10px 0 15px 0;
		color: #bab9a0;
		font-size: 14px;
		text-align: left;
	`;

		wordCountContainer.innerHTML = `
		<strong>  Word Count:</strong> ${wordCount} words
	`;

		// Insert right after the controls container
		const controlsContainer = document.getElementById("gemini-controls");
		if (controlsContainer) {
			controlsContainer.parentNode.insertBefore(
				wordCountContainer,
				controlsContainer.nextSibling
			);
		} else {
			// Fallback: insert at the top of the content area
			contentArea.insertBefore(
				wordCountContainer,
				contentArea.firstChild
			);
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
			insertionPoint.parentNode.insertBefore(
				summaryDisplay,
				insertionPoint
			);
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

		// Add the initial word count display
		addInitialWordCountDisplay(contentArea);
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

	// Function to intelligently split content for large chapters
	function splitContentForProcessing(content, maxChunkSize = 10000) {
		// If content is already small enough, return it as a single chunk
		if (content.length <= maxChunkSize) {
			return [content];
		}

		console.log(
			`Content is large (${content.length} chars), splitting into chunks...`
		);

		// First try to split at natural paragraph boundaries
		const paragraphs = content.split(/\n\n+/);
		const chunks = [];
		let currentChunk = "";

		// Group paragraphs into chunks that don't exceed maxChunkSize
		for (const paragraph of paragraphs) {
			// If adding this paragraph would exceed the limit, start a new chunk
			if (
				currentChunk.length + paragraph.length > maxChunkSize &&
				currentChunk.length > 0
			) {
				chunks.push(currentChunk);
				currentChunk = paragraph;
			} else {
				// Otherwise, add to current chunk
				currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
			}
		}

		// Add the last chunk if it has content
		if (currentChunk.length > 0) {
			chunks.push(currentChunk);
		}

		// If we still have any chunks that are too large, split them at sentence boundaries
		const finalChunks = [];

		for (const chunk of chunks) {
			if (chunk.length <= maxChunkSize) {
				finalChunks.push(chunk);
				continue;
			}

			// Split this chunk at sentence boundaries
			const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [chunk];
			let sentenceChunk = "";

			for (const sentence of sentences) {
				if (
					sentenceChunk.length + sentence.length > maxChunkSize &&
					sentenceChunk.length > 0
				) {
					finalChunks.push(sentenceChunk);
					sentenceChunk = sentence;
				} else {
					sentenceChunk += sentence;
				}
			}

			if (sentenceChunk.length > 0) {
				finalChunks.push(sentenceChunk);
			}
		}

		console.log(
			`Split content into ${finalChunks.length} chunks for processing`
		);
		return finalChunks;
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

			console.log(
				`Extracted ${content.length} characters for summarization`
			);
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

		// Use our improved content splitting function
		const parts = splitContentForProcessing(content, charsPerPart);
		console.log(
			`Split content into ${parts.length} parts for summarization`
		);

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
				console.error(
					`Error summarizing part ${currentPartNum}:`,
					error
				);
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
	function handleEnhanceClick() {
		// Extract content
		const extractedContent = extractContent();
		if (!extractedContent.found) {
			showStatusMessage("No content found to process", "error");
			return;
		}

		// Send to background script to process with Gemini
		try {
			// Show processing indicator on the button
			const button = document.querySelector(".gemini-enhance-btn");
			const originalText = button.textContent;
			button.textContent = "Processing...";
			button.disabled = true;

			// Show a status message to indicate processing
			showStatusMessage("Processing content with Gemini AI...", "info");

			// First ping the background script to ensure it's alive
			browser.runtime
				.sendMessage({ action: "ping" })
				.then((pingResponse) => {
					console.log("Ping result: ", pingResponse);

					// Get model info to check token limits
					return browser.runtime.sendMessage({
						action: "getModelInfo",
					});
				})
				.then((modelInfo) => {
					// Estimate token count based on character count
					const estimatedTokens = Math.ceil(
						extractedContent.text.length / 4
					);
					console.log(`Estimated token count: ${estimatedTokens}`);
					console.log(
						`Model max context size: ${modelInfo.maxContextSize}`
					);

					// Send content to background script for processing
					return browser.runtime.sendMessage({
						action: "processWithGemini",
						title: extractedContent.title,
						content: extractedContent.text,
						siteSpecificPrompt: currentHandler
							? currentHandler.getSiteSpecificPrompt()
							: "",
					});
				})
				.then((response) => {
					// Restore button state
					if (button) {
						button.textContent = originalText;
						button.disabled = false;
					}

					if (response && response.success) {
						console.log(
							"==========================================="
						);
						console.log("GEMINI PROCESSED RESULT:");
						console.log(
							"==========================================="
						);

						// Safely extract the enhanced content from response
						if (
							response.result &&
							typeof response.result === "object" &&
							response.result.enhancedContent
						) {
							// Object format with enhancedContent property
							console.log(
								"Using enhancedContent from result object"
							);
							replaceContentWithEnhancedVersion(response.result);
						} else if (
							response.result &&
							typeof response.result === "string"
						) {
							// Direct string result
							console.log("Using string result directly");
							replaceContentWithEnhancedVersion(response.result);
						} else {
							// Handle unexpected format gracefully
							console.error(
								"Unexpected response format:",
								response.result
							);
							throw new Error(
								"Unexpected response format from Gemini API"
							);
						}

						console.log(
							"==========================================="
						);
					} else {
						const errorMessage = response?.error || "Unknown error";
						// Special handling for missing API key
						if (errorMessage.includes("API key is missing")) {
							showStatusMessage(
								"API key is missing. Opening settings page...",
								"error"
							);
							// Open popup for API key input
							browser.runtime.sendMessage({
								action: "openPopup",
							});
						} else {
							showStatusMessage(
								"Error processing with Gemini: " + errorMessage,
								"error"
							);
						}
					}
				})
				.catch((error) => {
					console.error(
						"Error communicating with background script:",
						error
					);
					// Restore button state
					if (button) {
						button.textContent = "Enhance with Gemini";
						button.disabled = false;
					}

					// Special handling for connection errors
					if (
						error.message &&
						error.message.includes("does not exist")
					) {
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
					} else if (
						error.message &&
						error.message.includes("substring is not a function")
					) {
						showStatusMessage(
							"Error processing response format. Please try again.",
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
				});
		} catch (error) {
			console.error("Error in handleEnhanceClick:", error);
			showStatusMessage(`Error: ${error.message}`, "error");

			// Restore button state
			const button = document.querySelector(".gemini-enhance-btn");
			if (button) {
				button.textContent = "Enhance with Gemini";
				button.disabled = false;
			}
		}
	}

	// Updated function to replace content with Gemini-enhanced version
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
			const scrollPosition = window.scrollY;
			const originalContent = contentArea.innerHTML;
			const originalText =
				contentArea.innerText || contentArea.textContent;
			const modelInfo =
				typeof enhancedContent === "object" && enhancedContent.modelInfo
					? enhancedContent.modelInfo
					: null;
			const enhancedContentText =
				typeof enhancedContent === "object" &&
				enhancedContent.enhancedContent
					? enhancedContent.enhancedContent
					: enhancedContent;
			const sanitizedContent = sanitizeHTML(enhancedContentText);

			// Handler-driven enhancement selection
			const supportsTextOnly =
				currentHandler &&
				typeof currentHandler.supportsTextOnlyEnhancement ===
					"function" &&
				currentHandler.supportsTextOnlyEnhancement();

			let newContent;

			if (
				supportsTextOnly &&
				typeof currentHandler.applyEnhancedContent === "function"
			) {
				console.log(
					"Handler provides text-only enhancement; delegating paragraph updates..."
				);
				currentHandler.applyEnhancedContent(
					contentArea,
					sanitizedContent
				);
				newContent = contentArea.innerText || contentArea.textContent;
			} else {
				console.log("Using default full HTML enhancement pathway...");
				const { preservedElements: originalImages } =
					preserveHtmlElements(originalContent);
				console.log(
					`Preserved ${originalImages.length} images from original content`
				);
				const {
					modifiedContent: contentWithPreservedStats,
					preservedBoxes,
				} = preserveGameStatsBoxes(sanitizedContent);
				let contentToDisplay = contentWithPreservedStats;
				if (preservedBoxes.length > 0) {
					console.log(
						`Restoring ${preservedBoxes.length} game stats boxes`
					);
					contentToDisplay = restoreGameStatsBoxes(
						contentToDisplay,
						preservedBoxes
					);
				}
				if (originalImages.length > 0) {
					const imageContainer = document.createElement("div");
					imageContainer.className = "preserved-images-container";
					imageContainer.style.cssText =
						"\n\t\t\t\tmargin: 10px 0;\n\t\t\t\ttext-align: center;\n\t\t\t";
					originalImages.forEach((img) => {
						if (img.includes("<img")) {
							imageContainer.innerHTML += img;
						}
					});
					contentToDisplay =
						imageContainer.outerHTML + contentToDisplay;
				}
				contentArea.innerHTML = sanitizeHTML(contentToDisplay);
				newContent = contentArea.innerText || contentArea.textContent;
			}

			if (
				currentHandler &&
				typeof currentHandler.formatAfterEnhancement === "function"
			) {
				currentHandler.formatAfterEnhancement(contentArea);
			} else {
				applyDefaultFormatting(contentArea);
			}

			contentArea.setAttribute("data-original-content", originalContent);
			contentArea.setAttribute(
				"data-enhanced-content",
				contentArea.innerHTML
			);
			contentArea.setAttribute("data-showing-enhanced", "true");

			const banner = createEnhancedBanner(
				originalText,
				newContent,
				modelInfo
			);
			removeOriginalWordCount();

			const toggleButton = banner.querySelector(".gemini-toggle-btn");
			if (toggleButton) {
				toggleButton.addEventListener("click", function () {
					const isShowingEnhanced =
						contentArea.getAttribute("data-showing-enhanced") ===
						"true";
					if (isShowingEnhanced) {
						contentArea.innerHTML = originalContent;
						toggleButton.textContent = "Show Enhanced";
						contentArea.setAttribute(
							"data-showing-enhanced",
							"false"
						);
					} else {
						contentArea.innerHTML = contentArea.getAttribute(
							"data-enhanced-content"
						);
						toggleButton.textContent = "Show Original";
						contentArea.setAttribute(
							"data-showing-enhanced",
							"true"
						);
						if (
							currentHandler &&
							typeof currentHandler.formatAfterEnhancement ===
								"function"
						) {
							currentHandler.formatAfterEnhancement(contentArea);
						} else {
							applyDefaultFormatting(contentArea);
						}
					}
					if (contentArea.firstChild) {
						contentArea.insertBefore(
							banner,
							contentArea.firstChild
						);
					} else {
						contentArea.appendChild(banner);
					}
				});
			}

			if (contentArea.firstChild) {
				contentArea.insertBefore(banner, contentArea.firstChild);
			} else {
				contentArea.appendChild(banner);
			}

			window.scrollTo(0, scrollPosition);
			showStatusMessage("Content successfully enhanced with Gemini!");
			return true;
		} catch (error) {
			console.error("Error replacing content:", error);
			showStatusMessage(
				`Error replacing content: ${error.message}`,
				"error"
			);
			return false;
		}
	}

	// Function to display enhanced content with toggle ability
	function displayEnhancedContent(originalContent, enhancedContent) {
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

			// Store original content for toggling
			contentArea.setAttribute("data-original-content", originalContent);

			// Clean up any code block markers
			enhancedContent = sanitizeHTML(enhancedContent);

			contentArea.setAttribute("data-enhanced-content", enhancedContent);
			contentArea.setAttribute("data-showing-enhanced", "true");

			// Handler-based enhancement selection for modularity
			const supportsTextOnly =
				currentHandler &&
				typeof currentHandler.supportsTextOnlyEnhancement ===
					"function" &&
				currentHandler.supportsTextOnlyEnhancement();

			if (
				supportsTextOnly &&
				typeof currentHandler.applyEnhancedContent === "function"
			) {
				console.log(
					"Handler provides text-only enhancement for display path; delegating..."
				);
				currentHandler.applyEnhancedContent(
					contentArea,
					enhancedContent
				);
			} else {
				console.log(
					"Using default full HTML replacement in displayEnhancedContent..."
				);
				contentArea.innerHTML = enhancedContent;
			}

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

			// Create enhanced banner with word count comparison
			const banner = createEnhancedBanner(
				originalContent,
				enhancedContent
			);

			// Remove the original word count element
			removeOriginalWordCount();

			// Get the toggle button from the banner
			const toggleButton = banner.querySelector(".gemini-toggle-btn");
			if (toggleButton) {
				toggleButton.addEventListener("click", function () {
					const isShowingEnhanced =
						contentArea.getAttribute("data-showing-enhanced") ===
						"true";

					if (isShowingEnhanced) {
						// Switch to original
						contentArea.innerHTML = sanitizeHTML(originalContent);
						toggleButton.textContent = "Show Enhanced";
						contentArea.setAttribute(
							"data-showing-enhanced",
							"false"
						);
					} else {
						// Switch to enhanced
						contentArea.innerHTML = sanitizeHTML(enhancedContent);
						toggleButton.textContent = "Show Original";
						contentArea.setAttribute(
							"data-showing-enhanced",
							"true"
						);

						// Reapply formatting
						if (
							currentHandler &&
							typeof currentHandler.formatAfterEnhancement ===
								"function"
						) {
							currentHandler.formatAfterEnhancement(contentArea);
						} else {
							applyDefaultFormatting(contentArea);
						}
					}

					// Re-add the banner as the first element
					if (contentArea.firstChild) {
						contentArea.insertBefore(
							banner,
							contentArea.firstChild
						);
					} else {
						contentArea.appendChild(banner);
					}
				});
			}

			// Add banner to the top of content area
			if (contentArea.firstChild) {
				contentArea.insertBefore(banner, contentArea.firstChild);
			} else {
				contentArea.appendChild(banner);
			}

			// Restore scroll position
			window.scrollTo(0, scrollPosition);

			// Show success message
			showStatusMessage("Content successfully enhanced with Gemini!");

			return true;
		} catch (error) {
			console.error("Error displaying enhanced content:", error);
			showStatusMessage(`Error: ${error.message}`, "error");
			return false;
		}
	}

	// Function to display an error message when processing fails
	function showProcessingError(errorMessage) {
		console.error("Processing error:", errorMessage);

		const contentArea = findContentArea();
		if (!contentArea) return;

		// Create error box
		const errorBox = document.createElement("div");
		errorBox.className = "gemini-error-box";
		errorBox.style.cssText = `
        background-color: #fff3cd;
        border: 1px solid #ffeeba;
        color: #856404;
        padding: 15px;
        margin: 15px 0;
        border-radius: 5px;
    `;

		errorBox.innerHTML = `
        <strong>Error processing content with Gemini:</strong>
        <p>${errorMessage}</p>
        <p>Please try again or check your API key and settings.</p>
    `;

		// Insert at the beginning of content area
		if (contentArea.firstChild) {
			contentArea.insertBefore(errorBox, contentArea.firstChild);
		} else {
			contentArea.appendChild(errorBox);
		}
	}

	// Function to count words in text
	function countWords(text) {
		if (!text) return 0;
		// Remove extra whitespace and count words
		return text
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
	}

	// Function to add word count display to the content
	function addWordCountDisplay(contentArea, originalCount, newCount) {
		// Check if there's already a word count display and update it
		const existingWordCount = document.querySelector(".gemini-word-count");
		if (existingWordCount) {
			// Calculate percentage change
			const percentChange = (
				((newCount - originalCount) / originalCount) *
				100
			).toFixed(1);
			const changeText =
				percentChange >= 0
					? `+${percentChange}% increase`
					: `${percentChange}% decrease`;

			existingWordCount.innerHTML = `
			<strong>  Word Count:</strong> ${originalCount} → ${newCount} (${changeText})
		`;
			return;
		}

		// If no existing display, create a new one
		// Create word count container
		const wordCountContainer = document.createElement("div");
		wordCountContainer.className = "gemini-word-count";
		wordCountContainer.style.cssText = `
		margin: 10px 0 15px 0;
		color: #bab9a0;
		font-size: 14px;
		text-align: left;
	`;

		// Calculate percentage change
		const percentChange = (
			((newCount - originalCount) / originalCount) *
			100
		).toFixed(1);
		const changeText =
			percentChange >= 0
				? `+${percentChange}% increase`
				: `${percentChange}% decrease`;

		wordCountContainer.innerHTML = `
		<strong>  Word Count:</strong> ${originalCount} → ${newCount} (${changeText})
	`;

		// Insert right after the controls container
		const controlsContainer = document.getElementById("gemini-controls");
		if (controlsContainer) {
			controlsContainer.parentNode.insertBefore(
				wordCountContainer,
				controlsContainer.nextSibling
			);
		} else {
			// Fallback: insert at the top of the content area
			contentArea.insertBefore(
				wordCountContainer,
				contentArea.firstChild
			);
		}
	}

	// Default formatting to apply after enhancement
	function applyDefaultFormatting(contentArea) {
		// DO NOT modify any styling - preserve original formatting
		// This function is intentionally empty to maintain original styles
	}

	// Function to add the Gemini processed notice banner
	function addGeminiProcessedNotice(contentArea) {
		// Check if notice already exists
		if (contentArea.querySelector(".gemini-processed-notice")) {
			return; // Don't add duplicate notices
		}

		// Create the notice container
		const noticeContainer = document.createElement("div");
		noticeContainer.className = "gemini-processed-notice";

		// Add the notice text
		const noticeText = document.createTextNode(
			"This content has been enhanced by Gemini AI"
		);
		noticeContainer.appendChild(noticeText);

		// Add a restore button to revert to original content if needed
		const restoreButton = document.createElement("button");
		restoreButton.textContent = "Restore Original";
		restoreButton.addEventListener("click", () => {
			// Add functionality to restore original content
			// This would need implementation of content backup and restore logic
			showStatusMessage(
				"Original content restoration is not implemented yet",
				"info"
			);
		});
		noticeContainer.appendChild(restoreButton);

		// Insert at the beginning of the content area
		contentArea.insertBefore(noticeContainer, contentArea.firstChild);
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

		// Handle chunk processing results (new handlers for progressive display)
		if (message.action === "chunkProcessed") {
			handleChunkProcessed(message);
			sendResponse({ success: true });
			return true;
		}

		// Handle chunk processing errors
		if (message.action === "chunkError") {
			handleChunkError(message);
			sendResponse({ success: true });
			return true;
		}

		// Handle all chunks processing completion
		if (message.action === "allChunksProcessed") {
			handleAllChunksProcessed(message);
			sendResponse({ success: true });
			return true;
		}

		if (message.action === "getSiteHandlerInfo") {
			let response = { success: true, hasHandler: false };

			// If we have a handler, get information about it
			if (currentHandler) {
				response.hasHandler = true;
				response.siteIdentifier = currentHandler.getSiteIdentifier();
				response.defaultPrompt = currentHandler.getDefaultPrompt();
				response.siteSpecificPrompt =
					currentHandler.getSiteSpecificPrompt();
			}

			sendResponse(response);
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
						error:
							error.message || "Unknown error processing content",
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
						error:
							error.message ||
							"Unknown error summarizing content",
					});
				});
			return true;
		}

		return false;
	});

	// Handler for processed chunks from the background script
	function handleChunkProcessed(message) {
		console.log(
			`Received processed chunk ${message.chunkIndex + 1}/${
				message.totalChunks
			}`
		);

		const contentArea = findContentArea();
		if (!contentArea) {
			console.error(
				"Unable to find content area for displaying processed chunk"
			);
			return;
		}

		// First time? Create a special container for progressive updates
		let progressiveContentContainer = document.getElementById(
			"gemini-progressive-content"
		);
		if (!progressiveContentContainer) {
			// Preserve original content
			const originalContent = contentArea.innerHTML;
			contentArea.setAttribute("data-original-content", originalContent);

			// Create container for progressive updates
			progressiveContentContainer = document.createElement("div");
			progressiveContentContainer.id = "gemini-progressive-content";

			// Clear content area and add our container
			contentArea.innerHTML = "";
			contentArea.appendChild(progressiveContentContainer);

			// Add the work in progress banner
			const wipBanner = createWorkInProgressBanner(
				message.chunkIndex + 1,
				message.totalChunks
			);
			contentArea.insertBefore(wipBanner, progressiveContentContainer);
		} else {
			// Update the existing work in progress banner
			updateWorkInProgressBanner(
				message.chunkIndex + 1,
				message.totalChunks
			);
		}

		// Extract and process the chunk's content
		const chunkResult = message.result;
		if (chunkResult && chunkResult.enhancedContent) {
			// Clean up any code block markers and sanitize HTML
			const sanitizedContent = sanitizeHTML(chunkResult.enhancedContent);

			// Create a container for this chunk
			const chunkContainer = document.createElement("div");
			chunkContainer.className = "gemini-chunk";
			chunkContainer.setAttribute("data-chunk-index", message.chunkIndex);
			chunkContainer.innerHTML = sanitizedContent;

			// Add to our progressive content container
			progressiveContentContainer.appendChild(chunkContainer);

			// Check if all chunks are processed
			if (message.isComplete) {
				// Remove the WIP banner
				const wipBanner = document.querySelector(".gemini-wip-banner");
				if (wipBanner) {
					wipBanner.remove();
				}

				// Create the final enhanced banner
				finalizePrefixEnhancedContent(chunkResult.modelInfo);
			}
		}
	}

	// Test function for game status boxes (can be triggered from the console for verification)
	window.testGameStatsBox = async function () {
		console.log("Testing game stats box functionality...");

		// Create a sample div to show the test results
		const testContainer = document.createElement("div");
		testContainer.style.padding = "20px";
		testContainer.style.margin = "20px";
		testContainer.style.border = "1px solid #ccc";
		testContainer.style.borderRadius = "5px";
		testContainer.innerHTML =
			"<h3>Testing Game Stats Box Formatting</h3><p>Sending request to background script...</p>";

		// Insert into page for visibility
		const contentArea = findContentArea();
		if (contentArea) {
			contentArea.parentNode.insertBefore(testContainer, contentArea);
		} else {
			document.body.appendChild(testContainer);
		}

		try {
			// Request a test from the background script
			const response = await browser.runtime.sendMessage({
				action: "testGameStatsBox",
			});

			if (response && response.success) {
				console.log("Game stats box test successful:", response);
				testContainer.innerHTML = `
				<h3>Game Stats Box Test Results:</h3>
				<p>Test completed. Game stats box preserved: ${
					response.preservedGameStatsBox ? "✅ Yes" : "❌ No"
				}</p>
				<div style="margin-top: 20px;">
					<h4>Processed Content:</h4>
					${response.result.enhancedContent}
				</div>
			`;
			} else {
				console.error("Game stats box test failed:", response);
				testContainer.innerHTML = `
				<h3>Game Stats Box Test Failed</h3>
				<p>Error: ${response?.error || "Unknown error"}</p>
			`;
			}
		} catch (error) {
			console.error("Error testing game stats box:", error);
			testContainer.innerHTML = `
			<h3>Game Stats Box Test Error</h3>
			<p>Error: ${error.message}</p>
		`;
		}

		return "Test initiated. Check the page for results.";
	};

	// Run initialization immediately in case the page is already loaded
	initializeWithDeviceDetection();
}
