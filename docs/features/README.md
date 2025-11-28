# Features Documentation

> **Index:**

- [Features Documentation](#features-documentation)
	- [📁 Feature Documentation (To Be Created)](#-feature-documentation-to-be-created)
		- [Novel Library System](#novel-library-system)
		- [Backup API Keys](#backup-api-keys)
		- [Chunking System](#chunking-system)
		- [Emoji Support](#emoji-support)
		- [Summary Modes](#summary-modes)
		- [Progressive Enhancement](#progressive-enhancement)
		- [Custom Prompts](#custom-prompts)
	- [🔗 Quick Feature Reference](#-quick-feature-reference)
	- [📚 Related Documentation](#-related-documentation)
	- [🎯 For Users](#-for-users)
	- [🔧 For Developers](#-for-developers)
		- [Feature Implementation Locations](#feature-implementation-locations)
	- [🔄 Documentation Roadmap](#-documentation-roadmap)
		- [Phase 1: Core Features (Priority)](#phase-1-core-features-priority)
		- [Phase 2: Enhancement Features](#phase-2-enhancement-features)
		- [Phase 3: Advanced Features](#phase-3-advanced-features)


This directory contains detailed documentation for each major feature of the RanobeGemini extension.

---

## 📁 Feature Documentation (To Be Created)

### Novel Library System
**Comprehensive novel management and tracking**

Status: ⏳ Documentation pending
Planned file: `NOVEL_LIBRARY.md`

**Will cover:**
- Novel metadata storage and structure
- Shelf system and categorization
- Import/export functionality
- Reading progress tracking
- Custom prompts per novel
- Library UI and interactions

---

### Backup API Keys
**Automatic failover and key rotation**

Status: ⏳ Documentation pending
Planned file: `BACKUP_API_KEYS.md`

**Will cover:**
- Primary and backup key configuration
- Rotation strategies (failover vs round-robin)
- Rate limit detection and handling
- Key exhaustion scenarios
- Best practices for key management

---

### Chunking System
**Progressive content processing**

Status: ⏳ Documentation pending
Planned file: `CHUNKING_SYSTEM.md`

**Will cover:**
- Chunk size configuration
- Threshold-based activation
- Paragraph-boundary splitting
- Progressive UI updates
- Work-in-progress banner
- Chunk error handling and recovery

---

### Emoji Support
**Emotional context in dialogues**

Status: ⏳ Documentation pending
Planned file: `EMOJI_SUPPORT.md`

**Will cover:**
- Emoji insertion in dialogue
- Emotional context detection
- Configuration options
- Examples and use cases
- Disabling emoji feature

---

### Summary Modes
**Long and short format summaries**

Status: ⏳ Documentation pending
Planned file: `SUMMARY_MODES.md`

**Will cover:**
- Long summary format
- Short summary format
- Prompt differences
- Use cases for each mode
- Combining partial summaries
- Customizing summary prompts

---

### Progressive Enhancement
**Real-time content enhancement with live updates**

Status: ⏳ Documentation pending
Planned file: `PROGRESSIVE_ENHANCEMENT.md`

**Will cover:**
- Progressive display architecture
- Enhanced content container
- Work-in-progress banner with progress
- Remainder content management
- Finalization process
- Error states and partial results

---

### Custom Prompts
**Per-novel and global prompt customization**

Status: ⏳ Documentation pending
Planned file: `CUSTOM_PROMPTS.md`

**Will cover:**
- Global prompts (default, summary, permanent)
- Per-novel custom prompts
- Prompt combination logic
- Site-specific prompts
- Best practices and examples

---

## 🔗 Quick Feature Reference

| Feature             | Status   | Key Benefit                               | Documentation |
| ------------------- | -------- | ----------------------------------------- | ------------- |
| **Novel Library**   | ✅ Active | Track reading progress, manage novels     | Coming soon   |
| **Backup Keys**     | ✅ Active | Avoid rate limits, continuous service     | Coming soon   |
| **Chunking**        | ✅ Active | Handle long chapters, progressive display | Coming soon   |
| **Emoji Support**   | ✅ Active | Enhanced emotional context                | Coming soon   |
| **Short Summaries** | ✅ Active | Quick chapter overviews                   | Coming soon   |
| **Long Summaries**  | ✅ Active | Detailed chapter recaps                   | Coming soon   |
| **Custom Prompts**  | ✅ Active | Personalized enhancement styles           | Coming soon   |
| **Progressive UI**  | ✅ Active | Real-time feedback during processing      | Coming soon   |

---

## 📚 Related Documentation

- **[Architecture Documentation](../architecture/README.md)** - Technical architecture
- **[Development Guides](../development/README.md)** - Development workflows
- **[User Guides](../guides/README.md)** - How-to guides for users
- **[Main Documentation](../README.md)** - Overview and getting started

---

## 🎯 For Users

**Looking for how to use a feature?**

1. **Novel Library:** Open the extension popup → Novels tab → "Open Full Library"
2. **Backup Keys:** Popup → Settings tab → "Backup API Keys" section
3. **Chunking:** Popup → Advanced tab → Configure chunk size and threshold
4. **Emoji:** Popup → Settings tab → Toggle "Add emotional emojis"
5. **Summaries:** Use "Short Summary" or "Long Summary" buttons on chapter pages
6. **Custom Prompts:** Library page → Edit novel → "Custom Prompt" field

---

## 🔧 For Developers

**Implementing or modifying features?**

### Feature Implementation Locations

| Feature           | Key Files                                        | Components                                 |
| ----------------- | ------------------------------------------------ | ------------------------------------------ |
| **Novel Library** | `utils/novel-library.js`, `library/*`            | NovelLibrary class, shelf system           |
| **API Keys**      | `background/background.js`                       | `getCurrentApiKey()`, `getNextApiKey()`    |
| **Chunking**      | `background/background.js`, `content/content.js` | `processContentInChunks()`, progressive UI |
| **Emoji**         | `utils/constants.js`, `background/background.js` | `useEmoji` setting, prompt modification    |
| **Summaries**     | `background/background.js`, `content/content.js` | `summarizeContentWithGemini()`             |
| **Prompts**       | `utils/constants.js`, `popup/popup.js`           | Prompt defaults, storage management        |

---

## 🔄 Documentation Roadmap

### Phase 1: Core Features (Priority)
- [ ] NOVEL_LIBRARY.md
- [ ] BACKUP_API_KEYS.md
- [ ] CHUNKING_SYSTEM.md

### Phase 2: Enhancement Features
- [ ] EMOJI_SUPPORT.md
- [ ] SUMMARY_MODES.md
- [ ] PROGRESSIVE_ENHANCEMENT.md

### Phase 3: Advanced Features
- [ ] CUSTOM_PROMPTS.md
- [ ] CACHING_SYSTEM.md
- [ ] DEBUG_MODE.md

---

**Navigation:** [Back to Main Docs](../README.md) | [Architecture →](../architecture/README.md) | [Development →](../development/README.md)
