/**
 * Constants for Ranobe Gemini
 * Centralized configuration values used throughout the extension
 */

export const DEFAULT_BANNERS_VISIBLE = true;
export const DEFAULT_DEBUG_MODE = true;
export const DEFAULT_DEBUG_TRUNCATE_OUTPUT = true; // Truncate console output by default
export const DEFAULT_DEBUG_TRUNCATE_LENGTH = 500; // Max characters per log entry when truncated
export const MAX_DEBUG_LOG_ENTRIES = 1000; // Max entries in debug log buffer

// Font size configuration (percent)
export const FONT_SIZE_DEFAULT = 100;
export const FONT_SIZE_MIN = 80;
export const FONT_SIZE_MAX = 150;
export const FONT_SIZE_STEP = 5;

// Notification banner durations (milliseconds)
export const BANNER_DURATION_DEFAULT_MS = 3000; // Standard notifications
export const BANNER_DURATION_QUICK_MS = 2000; // Quick confirmations
export const BANNER_DURATION_UPDATE_NOTIFY_MS = 8000; // "Check for updates" banner
export const BANNER_DURATION_PERSISTENT = 0; // No auto-dismiss

// Mobile responsive UI breakpoint (px)
export const UI_MOBILE_BREAKPOINT_PX = 600;

// Copy/export format configuration
export const COPY_EXPORT_EXTENSIONS = ["txt", "epub", "html"];
export const COPY_EXPORT_DEFAULT_EXTENSION = "epub";
/** Default copy template. Uses {lastRead}/{chapters} for reading progress,
 *  falling back gracefully when those fields are empty. */
export const DEFAULT_COPY_TEMPLATE =
	"{title} by {author} | Ch.{lastRead}/{chapters}";
export const DEFAULT_EXPORT_FILENAME_TEMPLATE =
	"{titleSafe} by {authorSafe} {words}";

// Carousel Configuration
export const CAROUSEL_ACTIVE_SITE_BONUS = 5; // Add this many novels per active website
export const CAROUSEL_MIN_COUNT = 10; // Minimum number of novels to show in carousel
export const CAROUSEL_DEFAULT_MANUAL_COUNT = null; // Manual override count (null = use dynamic calculation)

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
10. **IMPORTANT \u{2014} Structured Content Boxes:** Use these specific HTML classes to mark different types of special content. Do NOT use markdown for any of these:

    **a) Full Stat Sheets** \u{2192} \`<div class="game-stats-box">\`: Multi-line character status windows, player sheets, inventory lists, attribute tables, or any block of tabular RPG data (\u{2265}3 lines, mostly name:value pairs). Preserve all line breaks exactly. Example:
    <div class="game-stats-box">
    Player: Mike
    Level: 5 \u{2192} Warrior
    HP: 120/120  MP: 60/60
    Skills: [Iron Skin] [War Cry]
    </div>

    **b) System Notifications** \u{2192} \`<div class="rg-system-msg">\`: Short in-world pop-ups, level-up banners, quest notifications, achievement unlocks, skill acquisition announcements, and other brief "System:" or "[\u{2026}]" style messages (typically 1\u{2013}5 lines). These read like UI toasts, not full stat sheets. Example:
    <div class="rg-system-msg">[Achievement Unlocked: First Kill!]
    +500 EXP \u{B7} Title acquired: Rookie Hunter</div>

    **c) Skill / Ability Cards** \u{2192} \`<div class="rg-skill-box">\`: Individual skill, spell, technique, or ability descriptions that have a name and a block of descriptive text. Use when a single named ability is being described in detail rather than a full stat list. Example:
    <div class="rg-skill-box">\u{3010}Fireball \u{2014} Rank C\u{3011}
    Launches a compressed sphere of fire. Deals 80 fire damage on impact.
    Cooldown: 8 s  \u{B7}  MP Cost: 30</div>

    For \`[ square bracket ]\` system text: classify as stat-sheet (\u{2192} \`game-stats-box\`), short notification (\u{2192} \`rg-system-msg\`), or skill card (\u{2192} \`rg-skill-box\`) based on length and structure. Merge consecutive same-type blocks into one div.
11. Remove any advertising code snippets or irrelevant promotional content
12. **Author Notes / Translator Notes / Editor Notes:** Identify A/N:, AN:, T/N:, TN:, E/N:, "Author's Note", "Translator's Note", or any meta-commentary not part of the story. Two cases:
    - **Short notes (\u{2264}150 words) that contain plot-relevant info** (world-building clarifications, character name explanations, translation notes about the story) \u{2192} Format as \`<div class="rg-author-note">\` with \`<hr class="section-divider">\` before and after.
    - **Long notes (>150 words) OR notes primarily about release schedules, Patreon, social media, personal life, or other off-topic content** \u{2192} Use \`<div class="rg-author-note" data-collapse="true" data-summary="[1-sentence story-relevant extract, or 'Off-topic author note']">[full note content]</div>\` with \`<hr class="section-divider">\` before and after. Extract any story-relevant parts into data-summary.
13. **Poetry, Song Lyrics & Epigraphs:** Wrap any in-text poem, song lyric, incantation, chapter-opening quote, or verse in \`<div class="rg-quote-box">\`. Preserve all original line breaks exactly. Do not alter the wording. Example: a stanza at the top of the chapter \u{2192} \`<div class="rg-quote-box">Verse line 1\nVerse line 2</div>\`.
14. **Flashback & Memory Scenes:** When a clearly marked flashback or memory scene spans one or more paragraphs \u{2014} identified by markers like "\u{2014} Flashback \u{2014}", "Memory:", "Three Years Ago", italicised past-tense inserts within a present-tense narrative, or explicit scene breaks introducing a recalled event \u{2014} wrap the entire flashback block in \`<div class="rg-flashback">\` so it is visually distinct from the main narrative.
15. **Fight / Action Scenes:** When a fight, battle, duel, or extended action sequence spans 3 or more paragraphs, wrap the ENTIRE fight block (from first strike to scene resolution) in: \`<div class="rg-collapsible-section" data-type="fight" data-summary="[1\u{2013}2 sentences: who fought, key moments, outcome]">[full fight content HTML]</div>\`. The data-summary must be a clear, spoiler-inclusive description. Do NOT split a single fight across multiple wrappers.
16. **Mature / R-18 Content:** When explicit sexual content or graphic adult material is present, wrap each distinct scene in: \`<div class="rg-collapsible-section" data-type="r18" data-summary="[1 sentence describing the scene without explicit details]">[full scene HTML]</div>\`. Use tasteful, non-graphic language in the summary. Apply this only to explicitly sexual or highly graphic violent scenes \u{2014} not to romance, mild violence, or suggestive content.

Keep the core meaning of the original text intact while making it feel like a professionally translated novel. Preserve all original story elements including character names, locations, and plot points precisely.

**REMINDER:** Only enhance the text provided below. Do not create or add any new story content.
`;

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
	"Ensure body text is wrapped in HTML paragraph tags (<p>) for each paragraph. For special content (stat blocks, system notifications, skill cards, author notes, quotes, flashbacks) use the designated div classes as specified in the main prompt \u{2014} do NOT wrap those in <p> tags. Handle dialogue formatting with appropriate punctuation and paragraph breaks. Do not use markdown formatting in your response.";

// Default model ID
export const DEFAULT_MODEL_ID = "gemini-2.5-flash";

// Default backup / fallback model ID \u{2500} used when the primary model is overloaded
export const DEFAULT_BACKUP_MODEL_ID = "gemini-2.0-flash";

// Default model endpoint
export const DEFAULT_MODEL_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL_ID}:generateContent`;

// New word-based chunking configuration
// Default chunk size in words (3200 words \u{2248} 15-20k characters)
export const DEFAULT_CHUNK_SIZE_WORDS = 3200;

// Default number of chunks after which summary buttons repeat
export const DEFAULT_CHUNK_SUMMARY_COUNT = 2;

// Minimum chunk size in words (for validation)
export const MIN_CHUNK_WORDS = 100;

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
	firefox:
		"https://118c432092a1998774ae13e72eca8365acc21858.extensions.allizom.org/drive",
};

// Google OAuth scopes required for backup functionality
// https://www.googleapis.com/auth/drive.file - Create/modify/delete only files created by this app (safest)
export const GOOGLE_OAUTH_SCOPES = [
	"https://www.googleapis.com/auth/drive.file",
];

// Backup configuration constants
export const DEFAULT_BACKUP_RETENTION_DAYS = 7; // Keep backups for 7 days
export const DEFAULT_BACKUP_SCHEDULE_HOUR = 2; // Default daily backup at 2 AM
export const CONTINUOUS_BACKUP_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minute debounce for continuous mode
export const DRIVE_BACKUP_MAX_COUNT = 4; // Keep at most 4 manual backups per Google Account (daily auto + user-created)
export const DRIVE_BACKUP_PREFIX = "ranobe-library-"; // Prefix for Drive backup files
export const DRIVE_CONTINUOUS_BACKUP_BASENAME =
	"ranobe-library-continuous.json"; // Single rolling file for continuous mode (separate from manual quota)

// Auto "On Hold" settings
export const DEFAULT_AUTO_HOLD_ENABLED = true;
export const DEFAULT_AUTO_HOLD_DAYS = 7;

// Chunk banner word-count-difference percentage threshold (default value when not set in storage)
export const DEFAULT_WORD_COUNT_THRESHOLD = 25;

// Delay (ms) before retrying tryRestoreChunkedCache when the DOM content area
// is not yet available on first load (e.g. slow-rendering pages).
export const CACHE_RESTORE_RETRY_MS = 600;

// Periodic novel chapter-count check
// Checks novels with status "up-to-date" to detect new chapters
export const NOVEL_PERIODIC_UPDATE_ENABLED = true;
export const NOVEL_PERIODIC_UPDATE_INTERVAL_MINUTES = 60; // How often to run the check alarm (internal)
export const NOVEL_PERIODIC_UPDATE_STALENESS_MINUTES = 30; // Min time since last check before re-checking a novel
export const NOVEL_CHAPTER_CHECK_ALARM_NAME = "rg-novel-chapter-check";
export const DEFAULT_NOVEL_UPDATE_INTERVAL_DAYS = 3; // User-configurable: check novels every N days (1-30)

// Telemetry settings (opt-in only)
export const TELEMETRY_ENDPOINT = ""; // User must configure if they want telemetry
export const TELEMETRY_ENABLED_DEFAULT = false;

// Default settings for collapsible content sections (fight scenes, R18, author notes, custom)
export const DEFAULT_CONTENT_FILTER_SETTINGS = {
	/** Fight / action scenes: wrap \u{2265}3-paragraph battles in a collapsible block */
	fight: { enabled: true, defaultCollapsed: true },
	/** R-18 / explicit adult content: wrap in a collapsible block */
	r18: { enabled: true, defaultCollapsed: true },
	/** Long / off-topic author notes: collapse notes >150 words or unrelated to story */
	authorNote: { enabled: true, defaultCollapsed: true },
	/**
	 * User-defined custom section types.
	 * Each entry: { id: string, name: string, icon: string, enabled: boolean, defaultCollapsed: boolean }
	 */
	custom: [],
};

// Comprehensive backup includes these storage keys
export const COMPREHENSIVE_BACKUP_KEYS = [
	"rg_novel_library", // Library data (current)
	"apiKey", // Gemini API key
	"backupApiKeys", // Backup API keys
	"selectedModelId", // Selected model ID
	"backupModelId", // Fallback model ID (used when primary is overloaded)
	"customEndpoint", // Custom endpoint
	"customModelEndpoint", // Custom endpoint (legacy)
	"promptTemplate", // Main prompt
	"summaryPrompt", // Summary prompt
	"shortSummaryPrompt", // Short summary prompt
	"permanentPrompt", // Permanent prompt
	"siteSpecificPrompts", // Site-specific prompts
	"chunkingEnabled", // Chunking setting
	"chunkSizeWords", // Chunk size (words)
	"chunkSummaryCount", // Summary button frequency
	"useEmoji", // Emoji setting
	"maxOutputTokens", // Max tokens
	"temperature", // Temperature (legacy)
	"customTemperature", // Temperature
	"topP", // Top P
	"topK", // Top K
	"debugMode", // Debug mode
	"driveClientId", // OAuth client ID (if user wants to backup)
	"driveClientSecret", // OAuth client secret (if user wants to backup)
	"driveFolderId", // Drive folder ID
	"backupMode", // Backup mode
	"driveAutoRestoreEnabled", // Drive auto-restore
	"driveAutoRestoreMergeMode", // Drive auto-restore merge mode
	"continuousBackupCheckIntervalMinutes", // Drive continuous check interval
	"driveSyncIntervalMinutes", // Drive sync interval
	"siteSettingsApi", // Per-site settings
	"autoHoldEnabled", // Auto hold enabled
	"autoHoldDays", // Auto hold days
	"rg_library_settings", // Library settings
	"themeSettings", // Theme settings
	"fontSize", // Font size
	"autoEnhanceNovels", // Auto-enhance per novel
	"backupIncludeApiKeys", // Backup include API keys
	"backupIncludeCredentials", // Backup include OAuth credentials
	"rg_rolling_backup_enabled", // Rolling backup enabled
	"rollingBackupIntervalMinutes", // Rolling backup interval
	"rg_rolling_backup_meta", // Rolling backup metadata
	"rg_backup_config", // Quick backup config
	"backupHistory", // Backup history (Drive)
	"lastBackupAt", // Last backup timestamp
	"backupFolder", // Backup folder
	"backupRetention", // Backup retention
	"backupIntervalDays", // Auto backup interval
	"rg_domain_settings", // Per-domain toggle settings
	"novelUpdateEnabled", // Periodic novel update enabled
	"novelUpdateIntervalDays", // Periodic novel update interval (days)
	"contentFilterSettings", // Collapsible content sections settings
	"rg_custom_box_types", // User-defined custom content box types
];

// Emotion emoji mapping for enhancing text with emotional indicators
export const EMOTION_EMOJIS = {
	happy: "\u{1F60A}",
	sad: "\u{1F622}",
	angry: "\u{1F620}",
	confused: "\u{1F615}",
	surprised: "\u{1F632}",
	shocked: "\u{1F631}",
	crying: "\u{1F62D}",
	laugh: "\u{1F604}",
	laughing: "\u{1F604}",
	smile: "\u{1F642}",
	smiling: "\u{1F60A}",
	grin: "\u{1F601}",
	sigh: "\u{1F614}",
	worried: "\u{1F61F}",
	nervous: "\u{1F630}",
	fear: "\u{1F628}",
	scared: "\u{1F628}",
	excited: "\u{1F603}",
	bored: "\u{1F612}",
	tired: "\u{1F634}",
	sleepy: "\u{1F62A}",
	annoyed: "\u{1F624}",
	frustrated: "\u{1F624}",
	calm: "\u{1F60C}",
	relief: "\u{1F60C}",
	wink: "\u{1F609}",
	love: "\u{2764}\u{FE0F}",
	heart: "\u{2764}\u{FE0F}",
	thinking: "\u{1F914}",
	thoughtful: "\u{1F914}",
	suspicious: "\u{1F928}",
	proud: "\u{1F60C}",
	embarrassed: "\u{1F633}",
	blush: "\u{1F60A}",
	blushing: "\u{1F60A}",
	shy: "\u{1F633}",
	confident: "\u{1F60E}",
	cool: "\u{1F60E}",
	serious: "\u{1F610}",
	neutral: "\u{1F610}",
	meh: "\u{1F612}",
	satisfied: "\u{1F60C}",
	pleased: "\u{1F60C}",
	disappointed: "\u{1F61E}",
	regretful: "\u{1F614}",
	hopeful: "\u{1F64F}",
	praying: "\u{1F64F}",
	determined: "\u{1F624}",
	mad: "\u{1F621}",
	furious: "\u{1F92C}",
	rage: "\u{1F621}",
	eyeroll: "\u{1F644}",
	teasing: "\u{1F60F}",
	smirk: "\u{1F60F}",
	sneer: "\u{1F60F}",
	contempt: "\u{1F612}",
	disgust: "\u{1F922}",
	distaste: "\u{1F616}",
	chuckle: "\u{1F60F}",
	giggle: "\u{1F92D}",
	ecstatic: "\u{1F606}",
	joyful: "\u{1F604}",
	cheerful: "\u{1F604}",
	depressed: "\u{1F61E}",
	upset: "\u{1F622}",
	hurt: "\u{1F622}",
	doubtful: "\u{1F914}",
	uncertain: "\u{1F615}",
	puzzled: "\u{1F914}",
	anxious: "\u{1F630}",
	terrified: "\u{1F631}",
	horrified: "\u{1F631}",
	trembling: "\u{1F628}",
	shaking: "\u{1F628}",
};
