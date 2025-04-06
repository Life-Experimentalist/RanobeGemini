/**
 * Constants for Ranobe Gemini popup
 * This is a non-module version of the constants to ensure compatibility with the popup
 */

// Default prompt template for Gemini AI
const DEFAULT_PROMPT = `Please enhance this novel chapter translation with the following improvements:

1. Fix grammatical errors, punctuation mistakes, and spelling issues
2. Improve the narrative flow and overall readability
3. Ensure consistent character voice, tone, and gender pronouns throughout
4. Make dialogue sound more natural and conversational
5. Refine descriptions to be more vivid and engaging
6. Maintain the original plot points, character development, and story elements exactly
7. Format paragraphs properly with HTML paragraph tags (<p>) for each paragraph
8. Handle dialogue formatting with appropriate punctuation and paragraph breaks
9. Streamline overly verbose sections while preserving important details
10. Ensure proper transitioning between scenes and ideas

Do not use markdown formatting in your response. Present the enhanced text using only HTML paragraph tags. Keep the core meaning of the original text intact while making it feel like a professionally translated novel. Preserve all original story elements including character names, locations, and plot points precisely.`;

// Default model endpoint
const DEFAULT_MODEL_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Default model ID
const DEFAULT_MODEL_ID = "gemini-2.0-flash";
