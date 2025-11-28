# User Guides

> **Index:**

- [User Guides](#user-guides)
	- [📁 Guides in This Directory](#-guides-in-this-directory)
		- [ADDING\_NEW\_WEBSITES.md](#adding_new_websitesmd)
	- [🔗 Planned Guides](#-planned-guides)
		- [Getting Started Guide](#getting-started-guide)
		- [Configuration Guide](#configuration-guide)
		- [Novel Library Guide](#novel-library-guide)
		- [Troubleshooting Guide](#troubleshooting-guide)
	- [🎯 Quick Guide Navigation](#-quick-guide-navigation)
	- [📚 Related Documentation](#-related-documentation)
	- [🆕 For New Users](#-for-new-users)
	- [🔧 For Contributors](#-for-contributors)
	- [📖 Guide Categories](#-guide-categories)
		- [User Guides](#user-guides-1)
		- [Developer Guides](#developer-guides)
		- [Advanced Guides](#advanced-guides)
	- [🔄 Documentation Status](#-documentation-status)
	- [💡 Contributing to Guides](#-contributing-to-guides)


This directory contains step-by-step guides for using and extending the RanobeGemini extension.

---

## 📁 Guides in This Directory

### [ADDING_NEW_WEBSITES.md](./ADDING_NEW_WEBSITES.md)
**Complete guide for adding support for new web novel websites**

- Prerequisites and setup
- Analyzing website structure
- Creating custom handlers
- Implementing required methods
- Testing and validation
- Submitting contributions

**Key Topics:**
- 🌐 Website DOM analysis
- 🔧 Handler implementation guide
- ✅ Testing checklist
- 📤 Contribution workflow

---

## 🔗 Planned Guides

### Getting Started Guide
**For new users setting up the extension**

Status: ⏳ To be created
Planned file: `GETTING_STARTED.md`

**Will cover:**
- Installing the extension
- Getting a Gemini API key
- Initial configuration
- First enhancement
- Basic troubleshooting

---

### Configuration Guide
**Detailed settings and customization**

Status: ⏳ To be created
Planned file: `CONFIGURATION.md`

**Will cover:**
- API key setup
- Backup key configuration
- Model selection
- Prompt customization
- Advanced parameters (temperature, tokens, etc.)
- Chunking settings
- UI preferences

---

### Novel Library Guide
**Managing your novel collection**

Status: ⏳ To be created
Planned file: `LIBRARY_GUIDE.md`

**Will cover:**
- Adding novels to library
- Editing metadata
- Using custom prompts per novel
- Tracking reading progress
- Searching and filtering
- Import/export
- Organizing with shelves

---

### Troubleshooting Guide
**Common issues and solutions**

Status: ⏳ To be created
Planned file: `TROUBLESHOOTING.md`

**Will cover:**
- API key errors
- Rate limit handling
- Content extraction failures
- Enhancement not working
- Performance issues
- Browser compatibility
- Debug mode usage

---

## 🎯 Quick Guide Navigation

| Task                   | Guide                                              | Section           |
| ---------------------- | -------------------------------------------------- | ----------------- |
| **Add New Website**    | [ADDING_NEW_WEBSITES.md](./ADDING_NEW_WEBSITES.md) | Complete workflow |
| **Install Extension**  | Coming: GETTING_STARTED.md                         | Installation      |
| **Get API Key**        | Coming: GETTING_STARTED.md                         | API Setup         |
| **Configure Settings** | Coming: CONFIGURATION.md                           | All settings      |
| **Manage Library**     | Coming: LIBRARY_GUIDE.md                           | Library features  |
| **Fix Problems**       | Coming: TROUBLESHOOTING.md                         | Common issues     |

---

## 📚 Related Documentation

- **[Main Documentation](../README.md)** - Project overview and features
- **[Architecture Documentation](../architecture/README.md)** - Technical architecture
- **[Features Documentation](../features/README.md)** - Feature details
- **[Development Documentation](../development/README.md)** - Development workflows

---

## 🆕 For New Users

**First time using RanobeGemini?**

1. ~~Read: GETTING_STARTED.md (coming soon)~~ → **Current:** Check [Main README](../README.md)
2. Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
3. Install the extension in Firefox
4. Open extension popup → Settings → Enter API key → Save
5. Visit a supported website and click "Enhance" on a chapter

**Supported websites:**
- ranobes.net and variants (10+ domains)
- fanfiction.net (desktop and mobile)
- archiveofourown.org
- webnovel.com

---

## 🔧 For Contributors

**Want to add support for a new website?**

Follow this workflow:

1. **Read:** [ADDING_NEW_WEBSITES.md](./ADDING_NEW_WEBSITES.md) - Complete guide
2. **Inspect:** Use browser DevTools to analyze the website structure
3. **Create:** Make a new handler in `src/utils/website-handlers/`
4. **Implement:** Code the required methods (`canHandle`, `extractContent`, etc.)
5. **Register:** Add handler to `handler-manager.js` and `domain-constants.js`
6. **Test:** Verify extraction and enhancement work correctly
7. **Submit:** Create a pull request with your changes

**Key files to modify:**
- `src/utils/website-handlers/[your-site]-handler.js` (new file)
- `src/utils/website-handlers/handler-manager.js` (register handler)
- `src/utils/domain-constants.js` (add domains)
- `src/manifest.json` (updated via `npm run update-domains`)

---

## 📖 Guide Categories

### User Guides
> For end users of the extension

- Getting Started (planned)
- Configuration (planned)
- Novel Library Management (planned)
- Troubleshooting (planned)

### Developer Guides
> For contributors and developers

- ✅ Adding New Websites (available)
- Testing and Validation (planned)
- Extension Development Setup (planned)
- Debugging Guide (planned)

### Advanced Guides
> For power users and customization

- Custom Prompt Engineering (planned)
- API Optimization (planned)
- Backup Key Strategies (planned)
- Performance Tuning (planned)

---

## 🔄 Documentation Status

| Guide                  | Status     | Priority | Target Date |
| ---------------------- | ---------- | -------- | ----------- |
| ADDING_NEW_WEBSITES.md | ✅ Complete | High     | Done        |
| GETTING_STARTED.md     | ⏳ Planned  | High     | Q1 2025     |
| CONFIGURATION.md       | ⏳ Planned  | Medium   | Q1 2025     |
| LIBRARY_GUIDE.md       | ⏳ Planned  | Medium   | Q1 2025     |
| TROUBLESHOOTING.md     | ⏳ Planned  | High     | Q1 2025     |

---

## 💡 Contributing to Guides

We welcome contributions to documentation! If you'd like to write a guide:

1. Check the planned guides above
2. Open an issue to discuss the guide content
3. Follow the existing guide structure in ADDING_NEW_WEBSITES.md
4. Include diagrams, tables, and examples
5. Add index placeholder at the top
6. Submit a pull request

**Documentation style:**
- Use clear, step-by-step instructions
- Include code examples where relevant
- Add troubleshooting sections
- Use Mermaid diagrams for workflows
- Create tables for reference information
- Leave index section for manual filling

---

**Navigation:** [Back to Main Docs](../README.md) | [Architecture →](../architecture/README.md) | [Features →](../features/README.md)
