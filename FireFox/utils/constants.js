/**
 * Constants for Ranobe Gemini
 * Centralized configuration values used throughout the extension
 */

// Default prompt template for Gemini AI
export const DEFAULT_PROMPT = `Please enhance this novel chapter translation with the following improvements:

1. Fix grammatical errors, punctuation mistakes, and spelling issues
2. Improve the narrative flow and overall readability
3. Ensure consistent character voice, tone, and gender pronouns throughout
4. Make dialogue sound more natural and conversational
5. Refine descriptions to be more vivid and engaging
6. Maintain the original plot points, character development, and story elements exactly
7. Streamline overly verbose sections while preserving important details
8. Ensure proper transitioning between scenes and ideas

Keep the core meaning of the original text intact while making it feel like a professionally translated novel. Preserve all original story elements including character names, locations, and plot points precisely.`;

// Default summary prompt
export const DEFAULT_SUMMARY_PROMPT = `Summarize the following chapter by highlighting the main plot points, key character interactions, and significant events. Keep the summary concise, clear, and easy to understand.`;

// Default permanent prompt
export const DEFAULT_PERMANENT_PROMPT =
	"Ensure the output is formatted using only HTML paragraph tags (<p>) for each paragraph. Handle dialogue formatting with appropriate punctuation and paragraph breaks. Do not use markdown formatting in your response.";

// Default model endpoint
export const DEFAULT_MODEL_ENDPOINT =
	"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Default model ID
export const DEFAULT_MODEL_ID = "gemini-2.0-flash";

// Other constants can be added here as needed
