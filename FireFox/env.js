/**
 * Environment variables loader
 *
 * DEVELOPMENT USE ONLY:
 * This file should be removed or disabled in production builds
 */

// Default empty environment
const ENV = {
	GEMINI_API_KEY: "",
};

// Try to load environment from .env file
try {
	// Attempt to fetch and parse the .env file
	fetch(browser.runtime.getURL(".env"))
		.then((response) => response.text())
		.then((text) => {
			// Parse each line of the .env file
			text.split("\n").forEach((line) => {
				// Clean the line and check if it's a valid key-value pair
				const cleanLine = line.trim();
				if (
					!cleanLine ||
					cleanLine.startsWith("//") ||
					cleanLine.startsWith("#")
				) {
					return; // Skip comments and empty lines
				}

				// Split by the first equals sign
				const separatorIndex = cleanLine.indexOf("=");
				if (separatorIndex <= 0) return; // Invalid line

				const key = cleanLine.slice(0, separatorIndex).trim();
				let value = cleanLine.slice(separatorIndex + 1).trim();

				// Remove quotes if present
				if (
					(value.startsWith("'") && value.endsWith("'")) ||
					(value.startsWith('"') && value.endsWith('"'))
				) {
					value = value.slice(1, -1);
				}

				// Normalize key naming (Gemini_API_KEY → GEMINI_API_KEY)
				const normalizedKey = key.toUpperCase();
				ENV[normalizedKey] = value;
			});
			console.log("Environment variables loaded for development");
		})
		.catch((error) => {
			console.warn("Could not load .env file:", error);
		});
} catch (error) {
	console.warn("Error loading environment variables:", error);
}

export default ENV;
