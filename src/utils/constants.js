/**
 * Constants for Ranobe Gemini
 * Centralized configuration values used throughout the extension
 */

export const DEFAULT_DEBUG_MODE = true;
export const MAX_DEBUG_LOG_ENTRIES = 1000; // Max entries in debug log buffer

// Default prompt template for Gemini AI
export const DEFAULT_PROMPT = `**CRITICAL INSTRUCTION:** You are enhancing EXISTING text only. You must NEVER generate new content, create new stories, or add content that doesn't exist in the provided text. Your ONLY task is to improve the writing quality of the EXACT content given to you below. If no content is provided or the content is empty, respond with "ERROR: No content provided for enhancement."

Please enhance this novel chapter translation with the following improvements:

1. Fix grammatical errors, punctuation mistakes, and spelling issues
2. Improve the narrative flow and overall readability
3. Ensure consistent character voice, tone, and gender pronouns throughout
4. Make dialogue sound more natural and conversational
5. Refine descriptions to be more vivid and engaging
6. Maintain the original plot points, character development, and story elements exactly
7. Streamline overly verbose sections while preserving important details
8. Ensure proper transitioning between scenes and ideas
9. Add bold section headings at scene changes, POV shifts, or topic transitions. If the original text already has section headings, incorporate them seamlessly and consistently. Make sure that the section headings are not too long, and do not use any special characters or symbols in the headings. Use only standard English letters and numbers.
10. **IMPORTANT:** Format game-like status windows, character stats, skill lists, or RPG system information into styled HTML boxes. Use a div with class="game-stats-box" to contain the exact text. For example, a status window like:
    Player: Mike
    Level: 0
    Equipment: None
    Skills: None
    Class: Unspecialized
    Experience: 0
    Overall Combat Power: 5

    Should be formatted as:
    <div class="game-stats-box">
		Player: Mike
		Level: 0
		Equipment: None
		Skills: None
		Class: Unspecialized
		Experience: 0
		Overall Combat Power: 5
	</div>

    Preserve all line breaks, formatting, and exact data within these status windows. if there are any text in [ square brackets ] please pay attention to if they sound like system announcements or game-like status windows, and format them accordingly. If there are any consecutive [ square boxes ] then combine then into a single div. Be especially attentive to identifying stat blocks, status screens, system messages, skill descriptions, or any RPG-game-like information that should be formatted this way.
11. Remove any advertising code snippets or irrelevant promotional content
12. **Author Notes Handling:** Identify author notes, translator notes, or any meta-content not part of the story. Format them inside a styled HTML box using <div class="game-stats-box">. Insert a visible horizontal divider line using <hr class="section-divider"> before and after author notes to clearly separate them from the main story content. Summarize lengthy author notes by keeping only plot-relevant explanations (e.g., world-building clarifications, character context) while removing disclaimers, credits, update schedules, Patreon links, and other non-story content.

Keep the core meaning of the original text intact while making it feel like a professionally translated novel. Preserve all original story elements including character names, locations, and plot points precisely.

**REMINDER:** Only enhance the text provided below. Do not create or add any new story content.`;

// Default summary prompt
export const DEFAULT_SUMMARY_PROMPT = `Please generate a comprehensive summary of the provided novel chapter, ensuring the following aspects are covered:

1.  **Major Plot Points:** Detail the main sequence of events and key developments that advance the story within this chapter.
2.  **Character Interactions & Development:** Describe significant interactions between characters, notable character introductions, important decisions made by characters, and any expressed motivations or changes in character state.
3.  **Key Reveals & Information:** Clearly mention any crucial information revealed, secrets uncovered, unique abilities or concepts introduced (like 'Sacred Gear'), prophecies, or significant plot twists occurring in this chapter.
4.  **Setting & Atmosphere:** Briefly incorporate significant details about the setting(s) and any notable shifts in mood, tone, or atmosphere relevant to the chapter's events.
5.  **Thematic Elements:** Touch upon any central themes that are prominent or introduced within this specific chapter (e.g., survival, fear, destiny, adjustment).
6.  **Character Dynamics:** Highlight any changes in relationships or dynamics between characters, including alliances, rivalries, or emotional shifts.
7.  **Foreshadowing & Future Implications:** Note any hints or foreshadowing of future events, character arcs, or plot developments that are introduced in this chapter.
8.  **Conflict & Tension:** Identify any conflicts (internal or external) that arise in this chapter, including character struggles, interpersonal conflicts, or larger narrative tensions.
9.  **Symbolism & Motifs:** Mention any recurring symbols, motifs, or imagery that are significant to the chapter's content.
10. **Narrative Style & Tone:** Comment on the narrative style, tone, and perspective used in this chapter, including any shifts or unique stylistic choices.
11. **Cultural References:** If applicable, include any cultural references or allusions that are relevant to the chapter's context.
12. **Character Names & Titles:** Ensure all character names and titles are accurately represented, including any honorifics or specific titles used in the original text.
13. **Important Objects or Artifacts:** Note any significant objects, artifacts, or items introduced in this chapter that may have relevance to the plot or character development.
14. **Dialogue Highlights:** Include any particularly impactful or memorable lines of dialogue that encapsulate character emotions or plot points, but ensure they are not the main focus of the summary.

**Overall Requirements:**
* The summary must be thorough, capturing the essential substance and depth of the chapter, rather than just a minimal outline.
* Ensure accuracy and rely *only* on information explicitly present within the provided chapter text.
* Maintain clarity and readability for someone needing to understand the chapter's core content.`;

// Short summary prompt for quick summaries
export const DEFAULT_SHORT_SUMMARY_PROMPT = `Please provide a concise summary of this novel chapter in 2-4 paragraphs:

1. **Main Events:** What are the key events that happened in this chapter?
2. **Character Focus:** Who are the main characters involved and what did they do?
3. **Key Takeaways:** What is the most important information the reader should remember?

Keep the summary brief but informative. Focus only on the most essential plot points and character actions.`;

// Default permanent prompt
export const DEFAULT_PERMANENT_PROMPT =
	"Ensure the output is formatted using only HTML paragraph tags (<p>) for each paragraph. Handle dialogue formatting with appropriate punctuation and paragraph breaks. Do not use markdown formatting in your response.";

// Default model ID
export const DEFAULT_MODEL_ID = "gemini-3-flash";

// Default model endpoint
export const DEFAULT_MODEL_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL_ID}:generateContent`;

// Default chunk size for large chapters (characters per segment)
// Content larger than this will be split into chunks of this size
export const DEFAULT_CHUNK_SIZE = 20000;

// Default rate limit wait time (in milliseconds)
export const RATE_LIMIT_WAIT_TIME = 300000; // 5 minutes

// Keep-alive tuning knobs
export const KEEP_ALIVE_ALARM_INTERVAL_MINUTES = 0.5; // chrome floors to 1 minute
export const KEEP_ALIVE_HEARTBEAT_MS = 20000; // content->background ping
export const KEEP_ALIVE_HEARTBEAT_JITTER_MS = 3000; // spread heartbeats across tabs
export const KEEP_ALIVE_RECONNECT_DELAY_MS = 7000; // wait before re-opening port after drop
export const KEEP_ALIVE_MAX_PORT_RETRIES = 4; // cap reconnect attempts before giving up until next user action

// Chunking + request throttling
export const CHUNK_STAGGER_MS = 800; // delay between chunk sends to reduce burst
export const CHUNK_RETRY_BACKOFF_MS = 5000; // wait before retrying failed chunk

// Google Drive OAuth - No default credentials, user must configure their own
// See docs/guides/GOOGLE_DRIVE_BACKUP_SETUP.md for setup instructions
export const DEFAULT_DRIVE_CLIENT_ID = "";
export const DEFAULT_DRIVE_CLIENT_SECRET = "";

// Expected redirect URIs for OAuth validation
export const OAUTH_REDIRECT_URIS = {
	web: "https://ranobe.vkrishna04.me/oauth-redirect.html",
	chrome: "https://achemoeefcaafoiepmikeiocahcjkjop.chromiumapp.org/drive",
	firefox: "https://118c432092a1998774ae13e72eca8365acc21858.extensions.allizom.org/drive"
};

// Google OAuth scopes required for backup functionality
// https://www.googleapis.com/auth/drive.file - Create/modify/delete only files created by this app (safest)
export const GOOGLE_OAUTH_SCOPES = ["https://www.googleapis.com/auth/drive.file"];

// Backup configuration constants
export const DEFAULT_BACKUP_RETENTION_DAYS = 7; // Keep backups for 7 days
export const DEFAULT_BACKUP_SCHEDULE_HOUR = 2; // Default daily backup at 2 AM
export const CONTINUOUS_BACKUP_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minute debounce for continuous mode
export const DRIVE_BACKUP_MAX_COUNT = 3; // Keep at most 3 backups on Drive
export const DRIVE_BACKUP_PREFIX = "ranobe-library-"; // Prefix for Drive backup files
export const DRIVE_CONTINUOUS_BACKUP_BASENAME = "ranobe-library-continuous.json"; // Single rolling file for continuous mode

// Auto "On Hold" settings
export const DEFAULT_AUTO_HOLD_ENABLED = true;
export const DEFAULT_AUTO_HOLD_DAYS = 7;

// Telemetry settings (opt-in only)
export const TELEMETRY_ENDPOINT = ""; // User must configure if they want telemetry
export const TELEMETRY_ENABLED_DEFAULT = false;

// Comprehensive backup includes these storage keys
export const COMPREHENSIVE_BACKUP_KEYS = [
	"novelHistory",           // Library data
	"apiKey",                 // Gemini API key
	"backupApiKeys",          // Backup API keys
	"selectedModel",          // Selected model
	"customModelEndpoint",    // Custom endpoint
	"promptTemplate",         // Main prompt
	"summaryPrompt",          // Summary prompt
	"shortSummaryPrompt",     // Short summary prompt
	"permanentPrompt",        // Permanent prompt
	"siteSpecificPrompts",    // Site-specific prompts
	"chunkingEnabled",        // Chunking setting
	"chunkSize",              // Chunk size
	"useEmoji",               // Emoji setting
	"maxOutputTokens",        // Max tokens
	"temperature",            // Temperature
	"topP",                   // Top P
	"topK",                   // Top K
	"debugMode",              // Debug mode
	"driveClientId",          // OAuth client ID (if user wants to backup)
	"driveClientSecret",      // OAuth client secret (if user wants to backup)
	"driveFolderId",          // Drive folder ID
	"backupMode",             // Backup mode
	"siteSettings",           // Per-site settings
	"autoHoldEnabled",        // Auto hold enabled
	"autoHoldDays",           // Auto hold days
	"librarySettings",        // Library settings
	"themeSettings",          // Theme settings
	"fontSize",               // Font size
];

// Emotion emoji mapping for enhancing text with emotional indicators
export const EMOTION_EMOJIS = {
	happy: "😊",
	sad: "😢",
	angry: "😠",
	confused: "😕",
	surprised: "😲",
	shocked: "😱",
	crying: "😭",
	laugh: "😄",
	laughing: "😄",
	smile: "🙂",
	smiling: "😊",
	grin: "😁",
	sigh: "😔",
	worried: "😟",
	nervous: "😰",
	fear: "😨",
	scared: "😨",
	excited: "😃",
	bored: "😒",
	tired: "😴",
	sleepy: "😪",
	annoyed: "😤",
	frustrated: "😤",
	calm: "😌",
	relief: "😌",
	wink: "😉",
	love: "❤️",
	heart: "❤️",
	thinking: "🤔",
	thoughtful: "🤔",
	suspicious: "🤨",
	proud: "😌",
	embarrassed: "😳",
	blush: "😊",
	blushing: "😊",
	shy: "😳",
	confident: "😎",
	cool: "😎",
	serious: "😐",
	neutral: "😐",
	meh: "😒",
	satisfied: "😌",
	pleased: "😌",
	disappointed: "😞",
	regretful: "😔",
	hopeful: "🙏",
	praying: "🙏",
	determined: "😤",
	mad: "😡",
	furious: "🤬",
	rage: "😡",
	eyeroll: "🙄",
	teasing: "😏",
	smirk: "😏",
	sneer: "😏",
	contempt: "😒",
	disgust: "🤢",
	distaste: "😖",
	chuckle: "😏",
	giggle: "🤭",
	ecstatic: "😆",
	joyful: "😄",
	cheerful: "😄",
	depressed: "😞",
	upset: "😢",
	hurt: "😢",
	doubtful: "🤔",
	uncertain: "😕",
	puzzled: "🤔",
	anxious: "😰",
	terrified: "😱",
	horrified: "😱",
	trembling: "😨",
	shaking: "😨",
};
