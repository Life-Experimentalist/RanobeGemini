// Background script for Ranobe Gemini
console.log("Ranobe Gemini: Background script loaded");

// Global configuration
let currentConfig = null;

// Initialize configuration
async function initConfig() {
    try {
        // Get settings directly from storage
        const data = await browser.storage.local.get();
        return {
            apiKey: data.apiKey || "",
            defaultPrompt: data.defaultPrompt ||
                "Please review and enhance the following novel chapter translation. Correct grammatical, punctuation, and spelling errors; improve narrative flow and readability; maintain the original tone, style, and plot; ensure consistent gender pronouns; and streamline overly verbose sections. Format your response with proper HTML paragraph tags (<p>) for each paragraph. Do not use markdown formatting at all. Preserve the original meaning while producing a polished version suitable for a high-quality reading experience.",
            temperature: data.temperature || 0.7,
            maxOutputTokens: data.maxOutputTokens || 8192,
            debugMode: data.debugMode || false,
            modelEndpoint: data.modelEndpoint ||
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
        };
    } catch (error) {
        console.error("Error loading configuration:", error);
        return {
            apiKey: "",
            defaultPrompt: "Please fix grammar and improve readability of this text while maintaining original meaning.",
            temperature: 0.7,
            maxOutputTokens: 8192,
        };
    }
}

// Handle messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Background received message:", message);

    if (message.action === "ping") {
        sendResponse({ success: true, message: "Background script is alive" });
        return true;
    }

    if (message.action === "processWithGemini") {
        processContentWithGemini(message.title, message.content)
            .then((result) => {
                sendResponse({ success: true, result: result });
            })
            .catch((error) => {
                console.error("Error processing with Gemini:", error);
                sendResponse({
                    success: false,
                    error: error.message || "Unknown error processing with Gemini",
                });
            });

        return true; // Indicates we'll send a response asynchronously
    }

    return false;
});

// Process content with Gemini API
async function processContentWithGemini(title, content) {
    try {
        // Load latest config
        currentConfig = await initConfig();

        // Check if we have an API key
        if (!currentConfig.apiKey) {
            throw new Error("API key is missing. Please set it in the extension popup.");
        }

        console.log(`Processing "${title}" with Gemini (${content.length} characters)`);

        // Prepare the request for Gemini API
        const fullPrompt = `${currentConfig.defaultPrompt}\n\nTitle: ${title}\n\n${content}`;

        // Set model endpoint
        const modelEndpoint = currentConfig.modelEndpoint ||
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: fullPrompt,
                        },
                    ],
                },
            ],
            generationConfig: {
                temperature: currentConfig.temperature || 0.7,
                maxOutputTokens: currentConfig.maxOutputTokens || 8192,
                topP: 0.95,
                topK: 40,
            },
        };

        // Log the request if debug mode is enabled
        if (currentConfig.debugMode) {
            console.log("Gemini API Request:", {
                url: modelEndpoint,
                requestBody: JSON.parse(JSON.stringify(requestBody)),
            });
        }

        // Make the API call
        const response = await fetch(
            `${modelEndpoint}?key=${currentConfig.apiKey}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            }
        );

        // Parse the response
        const responseData = await response.json();

        // Log the response if debug mode is enabled
        if (currentConfig.debugMode) {
            console.log("Gemini API Response:", responseData);
        }

        // Handle API errors
        if (!response.ok) {
            const errorMessage =
                responseData.error?.message ||
                `API Error: ${response.status} ${response.statusText}`;
            throw new Error(errorMessage);
        }

        // Extract the generated text
        if (responseData.candidates && responseData.candidates.length > 0) {
            const generatedText =
                responseData.candidates[0].content?.parts[0]?.text;
            if (generatedText) {
                return generatedText;
            }
        }

        throw new Error("No valid response content returned from Gemini API");
    } catch (error) {
        console.error("Gemini API error:", error);
        throw error;
    }
}

// Setup browser action (icon) click handler
browser.browserAction.onClicked.addListener(() => {
    console.log("Browser action clicked");
    // This is a fallback in case the popup doesn't open
    browser.runtime.openOptionsPage().catch(error => {
        console.error("Error opening options page:", error);
    });
});

// Initialize when background script loads
initConfig()
    .then(config => {
        currentConfig = config;
        console.log("Configuration loaded:", config);
    })
    .catch(error => console.error("Config initialization error:", error));

// Log the extension startup
console.log("Ranobe Gemini extension initialized");

// Set up a heartbeat to keep the background script active
setInterval(() => {
    console.log("Background script heartbeat");
}, 25000);
