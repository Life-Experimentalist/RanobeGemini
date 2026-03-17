# Development Documentation

## Table of Contents

- [Development Documentation](#development-documentation)
	- [Table of Contents](#table-of-contents)
	- [📁 Documents in This Directory](#-documents-in-this-directory)
		- [TODO.md](#todomd)
	- [🔗 Quick Development Navigation](#-quick-development-navigation)
	- [📚 Related Documentation](#-related-documentation)
	- [🔧 Development Workflow](#-development-workflow)
		- [Getting Started with Development](#getting-started-with-development)
		- [Development Tasks](#development-tasks)
		- [File Structure for Developers](#file-structure-for-developers)
	- [🎯 Development Guidelines](#-development-guidelines)
		- [Code Style](#code-style)
		- [Adding New Features](#adding-new-features)
		- [Adding New Website Support](#adding-new-website-support)
		- [Testing](#testing)
	- [🐛 Bug Reporting](#-bug-reporting)
		- [Bug Report Template](#bug-report-template)
	- [📊 Performance Considerations](#-performance-considerations)
		- [Optimization Guidelines](#optimization-guidelines)
		- [Performance Monitoring](#performance-monitoring)
	- [🔐 Security Guidelines](#-security-guidelines)
		- [API Key Handling](#api-key-handling)
		- [Content Security](#content-security)
		- [Best Practices](#best-practices)
	- [📦 Release Process](#-release-process)
		- [Creating a Release](#creating-a-release)
		- [Version Numbering](#version-numbering)
	- [🤝 Contributing](#-contributing)
		- [Contribution Workflow](#contribution-workflow)
		- [Pull Request Guidelines](#pull-request-guidelines)
	- [📞 Developer Resources](#-developer-resources)
		- [Key Files for Common Tasks](#key-files-for-common-tasks)
		- [Architecture References](#architecture-references)

This directory contains documentation for developers working on the RanobeGemini extension codebase.

---

## 📁 Documents in This Directory

### [TODO.md](./TODO.md)

Development roadmap, planned features, and known issues

- Feature backlog
- Bug tracking
- Enhancement ideas
- Priority items
- Completed items

**Key Topics:**
- 📋 Upcoming features
- 🐛 Known bugs
- 💡 Enhancement proposals
- ✅ Completed work

---

## 🔗 Quick Development Navigation

| Topic                | Document                                                             | Purpose           |
| -------------------- | -------------------------------------------------------------------- | ----------------- |
| **Feature Planning** | [TODO.md](./TODO.md)                                                 | What's next       |
| **Bug Tracking**     | [TODO.md](./TODO.md)                                                 | Current issues    |
| **Architecture**     | [../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)   | System design     |
| **Adding Features**  | [../guides/ADDING_NEW_WEBSITES.md](../guides/ADDING_NEW_WEBSITES.md) | Development guide |

---

## 📚 Related Documentation

- **[Architecture Documentation](../architecture/README.md)** - System architecture and design
- **[Features Documentation](../features/README.md)** - Feature specifications
- **[User Guides](../guides/README.md)** - Usage and contribution guides
- **[Main Documentation](../README.md)** - Project overview

---

## 🔧 Development Workflow

### Getting Started with Development

1. **Clone the repository**

   ```powershell
   git clone https://github.com/Life-Experimentalist/RanobeGemini.git
   cd RanobeGemini
   ```

2. **Install dependencies**

   ```powershell
   npm install
   ```

3. **Run development build**

   ```powershell
   npm run watch  # Watches for changes and rebuilds
   ```

4. **Load extension in Firefox**
   - Navigate to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select `src/manifest.json`

### Development Tasks

| Task                 | Command                    | Purpose                                                 |
| -------------------- | -------------------------- | ------------------------------------------------------- |
| **Watch & Build**    | `npm run watch`            | Auto-rebuild on file changes                            |
| **Build Once**       | `npm run build`            | Single production build                                 |
| **Package Firefox**  | `npm run package-firefox`  | Create distributable .xpi                               |
| **Package Chromium** | `npm run package-chromium` | Create distributable .zip                               |
| **Package Source**   | `npm run package-source`   | Create source code archive                              |
| **Package All**      | `npm run package`          | Refresh domains + build all                             |
| **Update Domains**   | `npm run update-domains`   | Regenerate manifest domains                             |
| **All Commits**      | `npm run commits:all`      | Print all commit messages                               |
| **Version Commits**  | `npm run commits:versions` | Print commits mentioning versions (`2.x`, `3.x`, `4.x`) |

### File Structure for Developers

```file-structure
src/
├── background/          # Background service worker
│   └── background.js    # API integration, chunking, message handling
├── content/             # Content scripts (injected into pages)
│   ├── content.js       # Main content script logic
│   ├── content.css      # Content script styles
│   ├── gemini-styles.css # Enhanced content styles
│   ├── debug-integration.js # Debug panel integration
│   └── debug-utils.js   # Debug utilities
├── popup/               # Extension popup UI
│   ├── popup.html       # Popup structure
│   ├── popup.js         # Popup logic
│   └── popup.css        # Popup styles
├── library/             # Novel library page
│   ├── library.html     # Library page structure
│   ├── library.js       # Library management logic
│   └── library.css      # Library page styles
├── utils/               # Shared utilities
│   ├── constants.js     # Constants and defaults
│   ├── domain-constants.js # Domain registry
│   ├── storage-manager.js  # Storage abstraction
│   ├── logger.js        # Logging utilities
│   ├── content.js       # Content utilities
│   ├── debug-panel.js   # Debug panel
│   ├── novel-library.js # Novel library manager
│   └── website-handlers/   # Site-specific handlers
│       ├── base-handler.js
│       ├── handler-manager.js
│       ├── ranobes-handler.js
│       ├── fanfiction-handler.js
│       ├── fanfiction-mobile-handler.js
│       ├── ao3-handler.js
│       └── webnovel-handler.js
├── config/              # Configuration
│   └── config.js
├── icons/               # Extension icons
└── manifest.json        # Extension manifest
```

---

## 🎯 Development Guidelines

### Code Style

- Use **ES6+** JavaScript features
- Prefer `const` and `let` over `var`
- Use **async/await** for asynchronous operations
- Add **JSDoc comments** for functions
- Follow **camelCase** for variables and functions
- Use **PascalCase** for classes

### Adding New Features

1. **Plan:** Update [TODO.md](./TODO.md) with feature specification
2. **Implement:** Write code following existing patterns
3. **Test:** Verify on all supported websites
4. **Document:** Update relevant documentation
5. **Commit:** Use clear, descriptive commit messages

### Adding New Website Support

Follow the comprehensive guide: [Adding New Websites](../guides/ADDING_NEW_WEBSITES.md)

**Quick checklist:**
- [ ] Create handler class extending `BaseWebsiteHandler`
- [ ] Implement required methods (`canHandle`, `extractContent`, etc.)
- [ ] Add `SUPPORTED_DOMAINS` static property
- [ ] Add `SHELF_METADATA` static property
- [ ] Register in `handler-manager.js`
- [ ] Add domains to `domain-constants.js`
- [ ] Run `npm run update-domains`
- [ ] Test extraction and enhancement
- [ ] Update documentation

### Testing

**Manual Testing Checklist:**
- [ ] Content extraction works correctly
- [ ] Enhance button appears in correct location
- [ ] Enhancement preserves formatting
- [ ] Summarize buttons generate summaries
- [ ] Progressive enhancement displays correctly (for long content)
- [ ] Work-in-progress banner updates
- [ ] Novel library entry created/updated
- [ ] Cache functionality works
- [ ] Error states display properly

**Test on Multiple Sites:**
- [ ] ranobes.net
- [ ] fanfiction.net (desktop and mobile)
- [ ] archiveofourown.org
- [ ] webnovel.com

---

## 🐛 Bug Reporting

When you find a bug:

1. **Check [TODO.md](./TODO.md)** to see if it's already tracked
2. **Add to TODO.md** with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Affected websites/components
3. **Fix** and document the solution

### Bug Report Template

```markdown
### [BUG] Short Description

**Component:** Background Script / Content Script / Handler / Popup

**Severity:** Critical / High / Medium / Low

**Description:**
Clear description of the issue

**Steps to Reproduce:**
1. Go to...
2. Click on...
3. Observe...

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Affected Sites:**
- ranobes.net
- fanfiction.net
```

---

## 📊 Performance Considerations

### Optimization Guidelines

- **Minimize DOM Manipulation:** Batch changes when possible
- **Lazy Load:** Load handlers only when needed
- **Cache Results:** Use 7-day cache for enhanced content
- **Chunk Large Content:** Split into 12k character chunks
- **Progressive UI:** Show results as they arrive
- **Efficient Selectors:** Use specific CSS selectors

### Performance Monitoring

Enable debug mode to see:
- Content extraction time
- API call duration
- Chunk processing times
- Cache hit/miss rates

**Enable debug mode:**

```javascript
// In browser console on any supported page
localStorage.setItem('rg_debug', 'true');
```

---

## 🔐 Security Guidelines

### API Key Handling

- **Never log API keys** in console or errors
- **Use `browser.storage.local`** for storage (encrypted by browser)
- **Validate keys** before making API calls
- **Implement rate limiting** to protect keys

### Content Security

- **Sanitize input** before processing
- **Use CSP headers** in manifest
- **Validate URLs** before handler selection
- **Escape HTML** when injecting content

### Best Practices

- All API calls must use **HTTPS**
- No telemetry or external data transmission
- Minimal required permissions in manifest
- Regular security audits of dependencies

---

## 📦 Release Process

### Creating a Release

1. **Update version** in `manifest.json` and `package.json`
2. **Update [CHANGELOG.md](../release/CHANGELOG.md)** with changes
3. **Run build:** `npm run build`
4. **Test thoroughly** on all supported sites
5. **Package:** `npm run package` (runs domain refresh + multi-target) or target builds via `npm run package-firefox`, `npm run package-chromium`
6. **Package source:** `npm run package-source`
7. **Create GitHub release** with packages
8. **Submit to Firefox Add-ons** if needed

**Packaging order (npm):**
- `npm run update-domains`
- `npm run package` (or `npm run package-firefox` / `npm run package-chromium` for single-target rebuilds)
- `npm run package-source`

### Version Numbering

Follow **Semantic Versioning (SemVer):**
- **Major (X.0.0):** Breaking changes that may be incompatible with previous versions
- **Minor (x.Y.0):** Backwards-compatible new features and improvements
- **Patch (x.y.Z):** Backwards-compatible bug fixes, small fixes and optimizations

---

## 🤝 Contributing

### Contribution Workflow

1. **Fork** the repository
2. **Create branch:** `git checkout -b feature/your-feature-name`
3. **Make changes** and test thoroughly
4. **Update documentation** as needed
5. **Commit:** Use clear, descriptive messages
6. **Push:** `git push origin feature/your-feature-name`
7. **Open Pull Request** with detailed description

### Pull Request Guidelines

- Reference related issues
- Include screenshots for UI changes
- Add tests if applicable
- Update documentation
- Keep PRs focused and atomic

---

## 📞 Developer Resources

### Key Files for Common Tasks

| Task                   | Primary Files                                 |
| ---------------------- | --------------------------------------------- |
| **API Integration**    | `src/background/background.js`                |
| **Content Extraction** | `src/utils/website-handlers/*.js`             |
| **UI Changes**         | `src/content/content.js`, `src/content/*.css` |
| **Storage Schema**     | `src/utils/storage-manager.js`                |
| **Settings UI**        | `src/popup/*`                                 |
| **Library System**     | `src/library/*`, `src/utils/novel-library.js` |

### Architecture References

- **Message Passing:** [Architecture - API Integration](../architecture/ARCHITECTURE.md#api-integration-architecture)
- **Storage:** [Architecture - Storage](../architecture/ARCHITECTURE.md#storage-architecture)
- **Processing:** [Architecture - Processing Pipeline](../architecture/ARCHITECTURE.md#content-processing-pipeline)

---

**Navigation:** [Back to Main Docs](../README.md) | [Architecture →](../architecture/README.md) | [Features →](../features/README.md)
