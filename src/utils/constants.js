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

Keep the core meaning of the original text intact while making it feel like a professionally translated novel. Preserve all original story elements including character names, locations, and plot points precisely.`;

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

// Default permanent prompt
export const DEFAULT_PERMANENT_PROMPT =
	"Ensure the output is formatted using only HTML paragraph tags (<p>) for each paragraph. Handle dialogue formatting with appropriate punctuation and paragraph breaks. Do not use markdown formatting in your response.";

// Default model ID
export const DEFAULT_MODEL_ID = "gemini-2.5-flash";

// Default model endpoint
export const DEFAULT_MODEL_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL_ID}:generateContent`;

// Default chunk size for large chapters (characters per segment)
export const DEFAULT_CHUNK_SIZE = 12000;

// Default rate limit wait time (in milliseconds)
export const RATE_LIMIT_WAIT_TIME = 300000; // 5 minutes

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
