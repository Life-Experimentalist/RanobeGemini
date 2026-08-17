/**
 * Constants for Ranobe Gemini
 * Centralized configuration values used throughout the extension
 */

export const DEFAULT_BANNERS_VISIBLE = true;
export const DEFAULT_DEBUG_MODE = true;
export const DEFAULT_DEBUG_TRUNCATE_OUTPUT = true; // Truncate console output by default
export const DEFAULT_DEBUG_TRUNCATE_LENGTH = 150; // Max characters per log entry when truncated
export const MAX_DEBUG_LOG_ENTRIES = 1000; // Max entries in debug log buffer

// Font size configuration (percent)
export const FONT_SIZE_DEFAULT = 100;
export const FONT_SIZE_MIN = 80;
export const FONT_SIZE_MAX = 150;
export const FONT_SIZE_STEP = 5;

/**
 * Typefaces offered for the enhanced chapter text.
 *
 * The single source of truth: the settings dropdowns, the content script that
 * applies the choice, and the tests that check the bundled files all read this
 * list. Adding a face means adding it here and to `FAMILIES` in
 * dev/fetch-fonts.js — nothing else.
 *
 * On the honest reading of the evidence: there is no font that is simply "read
 * faster" than the others. What the research does support is that legibility
 * rises with x-height, with unambiguous letterforms (I/l/1, O/0, rn/m), with
 * generous spacing — and, more strongly than any of those, with the reader's
 * own familiarity. So this list offers faces designed for sustained screen
 * reading and lets the reader pick; `note` says what each was actually built
 * for, and does not promise a speed-up nobody can demonstrate.
 *
 * `bundled: false` means a system font — no download, no licence to carry.
 * Every bundled face is SIL Open Font License 1.1 (see src/fonts/OFL-*.txt).
 */
export const READING_FONTS = [
	{
		id: "site",
		label: "Site default",
		stack: "",
		bundled: false,
		note: "Inherit whatever the novel site uses. No webfont is downloaded.",
	},
	{
		id: "literata",
		label: "Literata",
		stack: '"Literata", Georgia, "Times New Roman", serif',
		bundled: true,
		note: "Serif commissioned for Google Play Books and drawn for long-form screen reading.",
	},
	{
		id: "merriweather",
		label: "Merriweather",
		stack: '"Merriweather", Georgia, "Times New Roman", serif',
		bundled: true,
		note: "Screen serif with a large x-height and sturdy strokes; one of the most widely used reading faces on the web.",
	},
	{
		id: "atkinson",
		label: "Atkinson Hyperlegible",
		stack: '"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif',
		bundled: true,
		note: "Drawn by the Braille Institute for low vision — letterforms are pulled apart so I, l and 1 cannot be confused.",
	},
	{
		id: "inter",
		label: "Inter",
		stack: '"Inter", "Segoe UI", system-ui, sans-serif',
		bundled: true,
		note: "Sans-serif designed for screens, with a tall x-height and open apertures.",
	},
	{
		id: "georgia",
		label: "Georgia (system)",
		stack: 'Georgia, "Times New Roman", Times, serif',
		bundled: false,
		note: "Installed on virtually every machine and drawn for screens before webfonts existed.",
	},
	{
		id: "system-sans",
		label: "System sans-serif",
		stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
		bundled: false,
		note: "Whatever this device uses for its own interface — the face the reader sees most.",
	},
];

export const READING_FONT_DEFAULT = "site";

/** Resolve a stored id to a CSS stack. Unknown ids fall back to the default. */
export function getReadingFontStack(id) {
	return READING_FONTS.find((f) => f.id === id)?.stack ?? "";
}

/**
 * Populate a reading-font <select> in place, previewing each face in itself so
 * the reader can see the difference without applying it first.
 *
 * @param {HTMLSelectElement|null} select
 * @param {string} [selectedId]
 */
export function fillReadingFontSelect(select, selectedId) {
	if (!select) return;
	const want = selectedId || select.value || READING_FONT_DEFAULT;
	select.replaceChildren();
	for (const font of READING_FONTS) {
		const opt = document.createElement("option");
		opt.value = font.id;
		opt.textContent = font.label;
		opt.title = font.note;
		if (font.stack) opt.style.fontFamily = font.stack;
		if (font.id === want) opt.selected = true;
		select.appendChild(opt);
	}
}

// Notification banner durations (milliseconds)
export const BANNER_DURATION_DEFAULT_MS = 3000; // Standard notifications
export const BANNER_DURATION_QUICK_MS = 2000; // Quick confirmations
export const BANNER_DURATION_UPDATE_NOTIFY_MS = 8000; // "Check for updates" banner
export const BANNER_DURATION_PERSISTENT = 0; // No auto-dismiss

// Mobile responsive UI breakpoint (px)
export const UI_MOBILE_BREAKPOINT_PX = 600;

// Copy/export format configuration
export const COPY_EXPORT_EXTENSIONS = [
	"txt",
	"epub",
	"html",
	"pdf",
	"awz3",
	"docx",
	"mobi",
];
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
10. **IMPORTANT — Structured Content Boxes:** Use these specific HTML classes to mark different types of special content. Do NOT use markdown for any of these:

    **a) Full Stat Sheets** → \`<div class="game-stats-box">\`: Multi-line character status windows, player sheets, inventory lists, attribute tables, or any block of tabular RPG data (≥3 lines, mostly name:value pairs). Preserve all line breaks exactly. Example:
    <div class="game-stats-box">
    Player: Mike
    Level: 5 → Warrior
    HP: 120/120  MP: 60/60
    Skills: [Iron Skin] [War Cry]
    </div>

    **b) System Notifications** → \`<div class="rg-system-msg">\`: Short in-world pop-ups, level-up banners, quest notifications, achievement unlocks, skill acquisition announcements, and other brief "System:" or "[…]" style messages (typically 1–5 lines). These read like UI toasts, not full stat sheets. Example:
    <div class="rg-system-msg">[Achievement Unlocked: First Kill!]
    +500 EXP · Title acquired: Rookie Hunter</div>

    **c) Skill / Ability Cards** → \`<div class="rg-skill-box">\`: Individual skill, spell, technique, or ability descriptions that have a name and a block of descriptive text. Use when a single named ability is being described in detail rather than a full stat list. Example:
    <div class="rg-skill-box">【Fireball — Rank C】
    Launches a compressed sphere of fire. Deals 80 fire damage on impact.
    Cooldown: 8 s  ·  MP Cost: 30</div>

    For \`[ square bracket ]\` system text: classify as stat-sheet (→ \`game-stats-box\`), short notification (→ \`rg-system-msg\`), or skill card (→ \`rg-skill-box\`) based on length and structure. Merge consecutive same-type blocks into one div.
11. Remove any advertising code snippets or irrelevant promotional content
12. **Author Notes / Translator Notes / Editor Notes:** Identify A/N:, AN:, T/N:, TN:, E/N:, "Author's Note", "Translator's Note", or any meta-commentary not part of the story. Two cases:
    - **Short notes (≤150 words) that contain plot-relevant info** (world-building clarifications, character name explanations, translation notes about the story) → Format as \`<div class="rg-author-note">\` with \`<hr class="section-divider">\` before and after.
    - **Long notes (>150 words) OR notes primarily about release schedules, Patreon, social media, personal life, or other off-topic content** → Use \`<div class="rg-author-note" data-collapse="true" data-summary="[1-sentence story-relevant extract, or 'Off-topic author note']">[full note content]</div>\` with \`<hr class="section-divider">\` before and after. Extract any story-relevant parts into data-summary.
13. **Poetry, Song Lyrics & Epigraphs:** Wrap any in-text poem, song lyric, incantation, chapter-opening quote, or verse in \`<div class="rg-quote-box">\`. Preserve all original line breaks exactly. Do not alter the wording. Example: a stanza at the top of the chapter → \`<div class="rg-quote-box">Verse line 1\nVerse line 2</div>\`.
14. **Flashback & Memory Scenes:** When a clearly marked flashback or memory scene spans one or more paragraphs — identified by markers like "— Flashback —", "Memory:", "Three Years Ago", italicised past-tense inserts within a present-tense narrative, or explicit scene breaks introducing a recalled event — wrap the entire flashback block in \`<div class="rg-flashback">\` so it is visually distinct from the main narrative.
15. **Fight / Action Scenes:** When a fight, battle, duel, or extended action sequence spans 3 or more paragraphs, wrap the ENTIRE fight block (from first strike to scene resolution) in: \`<div class="rg-collapsible-section" data-type="fight" data-summary="[1–2 sentences: who fought, key moments, outcome]">[full fight content HTML]</div>\`. The data-summary must be a clear, spoiler-inclusive description. Do NOT split a single fight across multiple wrappers.
16. **Mature / R-18 Content:** When explicit sexual content or graphic adult material is present, wrap each distinct scene in: \`<div class="rg-collapsible-section" data-type="r18" data-summary="[1 sentence describing the scene without explicit details]">[full scene HTML]</div>\`. Use tasteful, non-graphic language in the summary. Apply this only to explicitly sexual or highly graphic violent scenes — not to romance, mild violence, or suggestive content.

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
	"Ensure body text is wrapped in HTML paragraph tags (<p>) for each paragraph. For special content (stat blocks, system notifications, skill cards, author notes, quotes, flashbacks) use the designated div classes as specified in the main prompt — do NOT wrap those in <p> tags. Handle dialogue formatting with appropriate punctuation and paragraph breaks. Do not use markdown formatting in your response.";

// The Gemini models offered in every model dropdown.
//
// This list is the ONLY place they are enumerated. The dropdowns in the popup
// and in Library Settings are built from it at runtime — before this existed
// the same three <option> blocks were pasted in seven places across four files,
// and they had already drifted apart (the README recommended a model that the
// code used only as a fallback).
//
// It is a fallback list, not an authority: as soon as an API key is present the
// UI replaces it with the live result of the Gemini `models` endpoint. Its job
// is to give a sensible choice on a fresh install with no key yet.
// `contextTokens` is the working budget this extension will fill, NOT the
// model's advertised context window — they are deliberately different. The
// values for the 2.x models are carried over unchanged from the old if/else
// chain in background.js so switching the default does not quietly re-tune
// everyone's chunking. Gemini 3 Flash inherits 2.5 Flash's budget for the same
// reason: this change is about which model runs, not how much we feed it.
export const GEMINI_MODELS = [
	{
		id: "gemini-3-flash-preview",
		label: "Gemini 3 Flash Preview",
		note: "Recommended",
		contextTokens: 16000,
	},
	{
		id: "gemini-3-pro-preview",
		label: "Gemini 3 Pro Preview",
		note: "Highest quality",
		contextTokens: 1000000,
	},
	{
		id: "gemini-2.5-flash",
		label: "Gemini 2.5 Flash",
		note: "Fallback",
		contextTokens: 16000,
	},
	{ id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", contextTokens: 1000000 },
	{
		id: "gemini-2.0-flash",
		label: "Gemini 2.0 Flash",
		contextTokens: 32000,
		legacy: true,
	},
];

// Budget used when a model id matches nothing in GEMINI_MODELS — an
// OpenAI-compatible endpoint, an Ollama model, or a Gemini model newer than
// this list. Same value the old fallthrough used.
export const DEFAULT_MODEL_CONTEXT_TOKENS = 16000;

/**
 * Working context budget for a model id.
 *
 * Matches on substring, not equality, because stored ids sometimes carry a
 * suffix (`models/` prefixes, dated preview variants) and the old code this
 * replaces used `.includes()` for the same reason.
 *
 * @param {string} modelId
 * @returns {number} token budget
 */
export function getModelContextTokens(modelId) {
	if (!modelId) return DEFAULT_MODEL_CONTEXT_TOKENS;
	const hit = GEMINI_MODELS.find((m) => modelId.includes(m.id));
	return hit ? hit.contextTokens : DEFAULT_MODEL_CONTEXT_TOKENS;
}

// Default model ID
export const DEFAULT_MODEL_ID = "gemini-3-flash-preview";

// Default backup / fallback model ID ─ used when the primary model is overloaded
export const DEFAULT_BACKUP_MODEL_ID = "gemini-2.5-flash";

/**
 * The models worth offering in a dropdown.
 *
 * Legacy entries stay in GEMINI_MODELS so their context budget still resolves
 * for anyone who selected one before, but they are hidden from the list unless
 * that is what the user currently has — pulling an option out from under a
 * saved setting would blank the select.
 *
 * @param {string} [selectedId] currently stored id, always kept on offer
 * @returns {Array<object>} models to show
 */
export function selectableGeminiModels(selectedId) {
	return GEMINI_MODELS.filter((m) => !m.legacy || m.id === selectedId);
}

/**
 * Build the <option> markup for a Gemini model <select>.
 *
 * Safe to interpolate: every id and label comes from GEMINI_MODELS above, which
 * is a literal in this file. Nothing user-supplied reaches this string.
 *
 * @param {string} [selectedId] id to mark selected
 * @returns {string} option markup
 */
export function geminiModelOptionsHtml(selectedId) {
	return selectableGeminiModels(selectedId)
		.map((m) => {
			const text = m.note ? `${m.label} (${m.note})` : m.label;
			const sel = m.id === selectedId ? " selected" : "";
			return `<option value="${m.id}"${sel}>${text}</option>`;
		})
		.join("");
}

/**
 * Populate a model <select> in place, preserving the current selection when it
 * is still on offer. Used for the static <select> elements in HTML, which
 * cannot be templated.
 *
 * @param {HTMLSelectElement|null} select
 * @param {string} [selectedId]
 */
export function fillGeminiModelSelect(select, selectedId) {
	if (!select) return;
	const want = selectedId || select.value || DEFAULT_MODEL_ID;
	select.replaceChildren();
	for (const m of selectableGeminiModels(want)) {
		const opt = document.createElement("option");
		opt.value = m.id;
		opt.textContent = m.note ? `${m.label} (${m.note})` : m.label;
		if (m.id === want) opt.selected = true;
		select.appendChild(opt);
	}
}

// Default model endpoint
export const DEFAULT_MODEL_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL_ID}:generateContent`;

// AI Provider slot defaults
// Each slot config: { provider: "gemini"|"openai"|"ollama", modelId?, baseUrl?, endpoint?, apiKey? }
export const DEFAULT_PRIMARY_PROVIDER = "gemini";
export const DEFAULT_FALLBACK_PROVIDER = "gemini";
export const DEFAULT_FALLBACK_MODEL_ENABLED = false;

// New word-based chunking configuration
// Default chunk size in words (3200 words ≈ 15-20k characters)
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

// Enhanced-chapter cache configuration
// Surfaced to users on the landing page's privacy policy ("cached locally for
// 7 days"). Changing this number changes that claim — update landing/privacy.html
// with it.
export const ENHANCED_CACHE_EXPIRY_DAYS = 7;

// Backup configuration constants
export const DEFAULT_BACKUP_RETENTION_DAYS = 7; // Keep backups for 7 days
export const DEFAULT_BACKUP_SCHEDULE_HOUR = 2; // Default daily backup at 2 AM
export const CONTINUOUS_BACKUP_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minute debounce for continuous mode
export const DRIVE_BACKUP_MAX_COUNT = 4; // Keep at most 4 manual backups per Google Account (daily auto + user-created)
export const DRIVE_BACKUP_PREFIX = "ranobe-library-"; // Prefix for Drive backup files
export const DRIVE_CONTINUOUS_BACKUP_BASENAME =
	"ranobe-library-continuous.json"; // Single rolling file for continuous mode (separate from manual quota)

// Native browser sync (browser.storage.sync) — the default backup destination.
export const NATIVE_SYNC_META_KEY = "rg_sync_meta";
export const NATIVE_SYNC_CHUNK_PREFIX = "rg_sync_chunk_";
export const NATIVE_SYNC_SCHEMA_VERSION = 1;
// Browser-enforced storage.sync limits. Chrome and Firefox publish the same numbers.
export const NATIVE_SYNC_QUOTA_BYTES = 102_400; // whole-area budget
export const NATIVE_SYNC_QUOTA_BYTES_PER_ITEM = 8_192; // key + JSON value, per key
export const NATIVE_SYNC_MAX_ITEMS = 512; // keys in the whole area
// Held back from the whole-area budget so a full library never starves the
// other synced keys (loreWeaveAccountKey) or trips the browser's own slack.
export const NATIVE_SYNC_RESERVED_BYTES = 8_192;
// Per-key accounting overhead: key name + JSON quotes + headroom. Subtracted
// from QUOTA_BYTES_PER_ITEM to size a chunk.
export const NATIVE_SYNC_KEY_OVERHEAD_BYTES = 32;
// storage.sync allows ~1 write every 2s sustained (120/minute, 1800/hour).
export const NATIVE_SYNC_MIN_WRITE_INTERVAL_MS = 2_000;

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
	/** Fight / action scenes: wrap ≥3-paragraph battles in a collapsible block */
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
	"readingFont", // Reading typeface id (see READING_FONTS)
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
	// AI provider slot configs (v5.0.0+)
	"primaryModelConfig", // Primary model slot { provider, modelId, baseUrl?, apiKey?, endpoint? }
	"fallbackModelConfig", // Fallback model slot (null = disabled)
	"fallbackModelEnabled", // Whether fallback slot is active
	// LoreWeave integration settings
	"loreWeaveUrl",
	"loreWeaveDomainId",
	"loreWeaveAutoGraphify",
	"loreWeaveChronicleEnabled",
	"loreWeaveUsePriorContext",
	"loreWeaveWritingStyle",
	// Note: loreWeaveToken intentionally excluded from backup (treat like API key)
];

// Opt-in backup encryption (see src/utils/backup-crypto.js).
//
// Both keys are deliberately absent from COMPREHENSIVE_BACKUP_KEYS above.
// Storing the encryption key inside the file it encrypts would make the
// encryption decorative, and the enabled flag travels with the key, so
// restoring it onto a browser that has no key would just produce backups
// nobody can read.
export const BACKUP_ENCRYPTION_ENABLED_KEY = "rg_backup_encrypt_enabled";
export const BACKUP_ENCRYPTION_KEY_STORAGE = "rg_backup_encryption_key";

// ── Site and domain settings storage keys ─────────────────────────────────────
// These live here, and not in `site-settings.js` next to the code that reads
// them, to break an import cycle. `site-settings.js` builds its defaults from
// `SHELF_REGISTRY`, and `domain-constants.js` builds that registry by importing
// every handler class — so a handler importing a key from `site-settings.js`
// closed the loop:
//
//   fanfiction-handler → site-settings → domain-constants
//                      → fanfiction-mobile-handler → fanfiction-handler
//
// which throws `Cannot access 'FanfictionHandler' before initialization` the
// moment `fanfiction-handler.js` is the first module in that ring to be
// evaluated. It only worked in the shipped extension because the alphabetically
// first handler happens to pull `domain-constants.js` in ahead of it. Both keys
// are bare strings with no dependencies, so `constants.js` — which imports
// nothing — is where they belong.
export const SITE_SETTINGS_KEY = "siteSettingsApi";
export const DOMAIN_SETTINGS_KEY = "rg_domain_settings";

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

// ── LoreWeave integration ─────────────────────────────────────────────────────
// LoreWeave is a separate, still-maturing sister project. The integration ships
// switched off behind this master flag: no LoreWeave UI is shown and no request
// ever leaves the browser for a LoreWeave backend until the user opts in from
// Settings -> Advanced -> Experimental. See src/utils/loreweave-gate.js.
export const LOREWEAVE_EXPERIMENTAL_ENABLED = false;

// The remaining values are opt-in defaults — empty = unconfigured.
export const LOREWEAVE_DEFAULT_URL = ""; // e.g. "https://api.loreweave.example.com"
export const LOREWEAVE_DEFAULT_DOMAIN_ID = ""; // e.g. "lw_dom_my_novel"
export const LOREWEAVE_DEFAULT_TOKEN = ""; // Legacy — use LOREWEAVE_DEFAULT_ACCOUNT_KEY instead
export const LOREWEAVE_DEFAULT_ACCOUNT_KEY = ""; // Single secret: both identity and auth (synced via browser account)
export const LOREWEAVE_AUTO_GRAPHIFY = false; // opt-in: send to LoreWeave after every enhancement
export const LOREWEAVE_CHRONICLE_ENABLED = false; // opt-in: accumulate story chronicle
export const LOREWEAVE_USE_PRIOR_CONTEXT = false; // inject chronicle into summaries
export const LOREWEAVE_WRITING_STYLE = "other"; // hint for extraction prompt

// ── Story Chat ────────────────────────────────────────────────────────────────
// Settings page writes this key; the background chat handler reads it. Both
// import the defaults from here so a change lands on both sides at once.
export const CHAT_SETTINGS_KEY = "rg_chat_settings";
export const CHAT_SETTINGS_DEFAULTS = {
	useCurrentChapter: true, // send the open chapter's text along with the question
	useChronicle: true, // accumulated chapter summaries
	useLoreWeave: true, // entity index — also requires the experimental gate
	maxHistory: 6, // conversation turns kept, as user/model pairs
};

// Bounds enforced on maxHistory wherever it is read, so a hand-edited storage
// value cannot blow up the request size.
export const CHAT_MAX_HISTORY_MIN = 2;
export const CHAT_MAX_HISTORY_MAX = 20;

// Character budget for the assembled story context in a chat request.
export const CHAT_MAX_CONTEXT_CHARS = 12_000;
// Of that budget, the most the current chapter's text may take.
export const CHAT_MAX_CHAPTER_CHARS = 6_000;
