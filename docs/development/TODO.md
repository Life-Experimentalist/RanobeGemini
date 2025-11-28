# Development Roadmap

> **Index:**

- [Development Roadmap](#development-roadmap)
	- [✅ Completed Features](#-completed-features)
		- [Version 3.0.0 (Released 2025-11-28)](#version-300-released-2025-11-28)
		- [Version 2.8.0](#version-280)
		- [Version 2.7.x](#version-27x)
		- [Version 2.x](#version-2x)
	- [🚀 Current Sprint (v3.1.0)](#-current-sprint-v310)
		- [High Priority](#high-priority)
		- [Medium Priority](#medium-priority)
		- [Low Priority](#low-priority)
	- [🔮 Future Versions](#-future-versions)
		- [Version 3.2.0 - Enhanced Library](#version-320---enhanced-library)
		- [Version 3.3.0 - Cross-Device Sync](#version-330---cross-device-sync)
		- [Version 3.4.0 - Advanced Enhancement](#version-340---advanced-enhancement)
		- [Version 4.0.0 - Platform Expansion](#version-400---platform-expansion)
	- [🐛 Known Issues](#-known-issues)
		- [Critical](#critical)
		- [High Priority](#high-priority-1)
		- [Medium Priority](#medium-priority-1)
		- [Low Priority](#low-priority-1)
	- [🔧 Technical Debt](#-technical-debt)
		- [Code Quality](#code-quality)
		- [Architecture](#architecture)
		- [Documentation](#documentation)
	- [💡 Feature Requests](#-feature-requests)
		- [From Users](#from-users)
		- [Community Ideas](#community-ideas)
		- [Experimental](#experimental)
	- [📊 Development Metrics](#-development-metrics)
		- [Code Statistics (Estimated)](#code-statistics-estimated)
		- [Test Coverage Goals](#test-coverage-goals)
		- [Performance Targets](#performance-targets)
	- [🗓️ Release Schedule](#️-release-schedule)
		- [Tentative Timeline](#tentative-timeline)
		- [Release Criteria](#release-criteria)
	- [🤝 Contributing](#-contributing)
	- [📞 Resources](#-resources)


**Last Updated:** 2025-11-28
**Current Version:** 3.0.0

---

## ✅ Completed Features

### Version 3.0.0 (Released 2025-11-28)
- [x] **Novel Library System**
  - [x] Full library page with grid layout
  - [x] Search, filter, and sort functionality
  - [x] Novel metadata management
  - [x] Import/export with merge mode
  - [x] Per-novel custom prompts
  - [x] Reading progress tracking
  - [x] Dynamic shelf system
- [x] **Documentation Overhaul**
  - [x] Reorganized into subdirectories
  - [x] Comprehensive ARCHITECTURE.md
  - [x] Gateway README files
  - [x] Updated CHANGELOG.md
  - [x] Consistent formatting

### Version 2.8.0
- [x] Backup API keys with rotation
- [x] Failover and round-robin strategies
- [x] Emoji support in dialogues
- [x] Short summary mode
- [x] Per-novel custom prompts

### Version 2.7.x
- [x] Progressive enhancement with chunking
- [x] Work-in-progress banner
- [x] Chunk-based processing
- [x] Real-time UI updates

### Version 2.x
- [x] Multi-site support (Ranobes, FanFiction, AO3, WebNovel)
- [x] Handler system architecture
- [x] Content extraction framework
- [x] Gemini API integration
- [x] Basic settings popup

---

## 🚀 Current Sprint (v3.1.0)

### High Priority

- [ ] **Feature Documentation**
  - [ ] Create NOVEL_LIBRARY.md in features/
  - [ ] Create BACKUP_API_KEYS.md in features/
  - [ ] Create CHUNKING_SYSTEM.md in features/
  - [ ] Create EMOJI_SUPPORT.md in features/
  - [ ] Create SUMMARY_MODES.md in features/

- [ ] **User Guides**
  - [ ] Create GETTING_STARTED.md in guides/
  - [ ] Create CONFIGURATION.md in guides/
  - [ ] Create TROUBLESHOOTING.md in guides/

- [ ] **Bug Fixes**
  - [ ] Fix WebNovel infinite scroll button injection
  - [ ] Improve error messages for API failures
  - [ ] Handle network timeouts gracefully

### Medium Priority

- [ ] **Library Enhancements**
  - [ ] Add library statistics page
  - [ ] Implement tags system for novels
  - [ ] Add cover image upload option
  - [ ] Library dark mode improvements

- [ ] **Content Enhancement**
  - [ ] Cache management UI (view/clear cache)
  - [ ] Resume failed enhancements
  - [ ] Batch enhancement for multiple chapters

- [ ] **Handler Improvements**
  - [ ] Add Scribble Hub support
  - [ ] Add Wattpad support
  - [ ] Add Royal Road support
  - [ ] Improve AO3 metadata extraction

### Low Priority

- [ ] **UI Polish**
  - [ ] Improve popup loading states
  - [ ] Add tooltips to settings
  - [ ] Better mobile responsive design
  - [ ] Accessibility improvements (ARIA labels)

- [ ] **Performance**
  - [ ] Optimize library page load time
  - [ ] Lazy load novel cards
  - [ ] Implement virtual scrolling for large libraries

---

## 🔮 Future Versions

### Version 3.2.0 - Enhanced Library
**Focus:** Library features and organization**

- [ ] Collections/folders for organizing novels
- [ ] Advanced search with filters
- [ ] Bulk actions (delete, export selected)
- [ ] Novel recommendations based on reading history
- [ ] Reading statistics dashboard
- [ ] Custom shelf creation
- [ ] Shelf color/icon customization

### Version 3.3.0 - Cross-Device Sync
**Focus:** Cloud sync and multi-device support**

- [ ] Firefox Sync integration for library
- [ ] Settings sync across devices
- [ ] Conflict resolution for library data
- [ ] Export/import improvements
- [ ] Sync status indicators

### Version 3.4.0 - Advanced Enhancement
**Focus:** Enhancement quality and options**

- [ ] Multiple enhancement styles (formal, casual, poetic)
- [ ] Character name consistency checker
- [ ] Terminology dictionary per novel
- [ ] Enhancement comparison mode
- [ ] A/B testing different prompts
- [ ] Enhancement quality rating system

### Version 4.0.0 - Platform Expansion
**Focus:** Chrome support and new features**

- [ ] Chrome extension port (Manifest V3)
- [ ] Edge browser support
- [ ] Unified codebase for all browsers
- [ ] Extension API for third-party integrations
- [ ] Plugin system for custom handlers

---

## 🐛 Known Issues

### Critical
- None currently

### High Priority
- [ ] WebNovel handler: Button injection fails on some chapters with infinite scroll
- [ ] Long content (>100k chars) may timeout during chunking
- [ ] Import library: Large libraries (>1000 novels) slow to import

### Medium Priority
- [ ] FanFiction mobile: Cover images sometimes fail to load
- [ ] AO3: Tag extraction misses custom tags
- [ ] Cache: Expired entries not automatically cleaned up
- [ ] Popup: Library preview doesn't update immediately after changes

### Low Priority
- [ ] Some sites with aggressive CSP block button styling
- [ ] Debug panel: Performance metrics occasionally incorrect
- [ ] Library grid: Card height inconsistent with long descriptions

---

## 🔧 Technical Debt

### Code Quality
- [ ] Add comprehensive unit tests
  - [ ] Handler tests with mock DOM
  - [ ] Storage manager tests
  - [ ] Novel library tests

- [ ] Refactor background.js
  - [ ] Split into modules (api.js, chunking.js, storage.js)
  - [ ] Improve error handling consistency
  - [ ] Better logging infrastructure

- [ ] TypeScript migration
  - [ ] Convert utility modules first
  - [ ] Add type definitions for handlers
  - [ ] Improve IDE autocomplete

### Architecture
- [ ] Implement proper state management
  - [ ] Redux or similar for popup state
  - [ ] Event-driven architecture for library updates

- [ ] Modularize content script
  - [ ] Split UI injection code
  - [ ] Separate enhancement logic
  - [ ] Better event handling

- [ ] Build system improvements
  - [ ] Add source maps for debugging
  - [ ] Minification for production builds
  - [ ] Bundle size optimization

### Documentation
- [ ] API documentation for handlers
- [ ] Contributing guidelines
- [ ] Code style guide
- [ ] Architecture decision records (ADRs)

---

## 💡 Feature Requests

### From Users
- [ ] Support for reading offline (store enhanced chapters locally)
- [ ] Dark mode for enhanced content
- [ ] Text-to-speech integration
- [ ] Translation mode (separate from enhancement)
- [ ] Chapter download as EPUB/PDF
- [ ] Browser reading mode integration

### Community Ideas
- [ ] Shared prompt library (community-driven)
- [ ] Enhancement presets for different genres
- [ ] Character glossary generation
- [ ] Plot summary generation for entire novels
- [ ] Author style analysis and matching

### Experimental
- [ ] AI-powered chapter predictions
- [ ] Character dialogue consistency analysis
- [ ] World-building consistency checker
- [ ] Alternative ending generation
- [ ] Interactive story branching

---

## 📊 Development Metrics

### Code Statistics (Estimated)
- Total lines of code: ~8,000
- JavaScript files: ~25
- CSS files: ~5
- Documentation pages: ~15

### Test Coverage Goals
- [ ] Handlers: 80% coverage
- [ ] Storage: 90% coverage
- [ ] Library: 85% coverage
- [ ] Background: 75% coverage

### Performance Targets
- [ ] Extension startup: < 100ms
- [ ] Content injection: < 50ms
- [ ] Library page load: < 500ms (1000 novels)
- [ ] API response: < 3s (per chunk)

---

## 🗓️ Release Schedule

### Tentative Timeline
- **v3.1.0** - Q1 2025 - Documentation & Bug Fixes
- **v3.2.0** - Q2 2025 - Enhanced Library Features
- **v3.3.0** - Q3 2025 - Cross-Device Sync
- **v3.4.0** - Q4 2025 - Advanced Enhancement
- **v4.0.0** - 2026 - Chrome Support & Platform Expansion

### Release Criteria
Each release must have:
- [ ] All high-priority bugs fixed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Tested on all supported sites
- [ ] Firefox review approved (if store release)

---

## 🤝 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

Priority areas for contributions:
1. **New website handlers** - Always welcome!
2. **Documentation improvements** - Help make docs clearer
3. **Bug fixes** - Check issues labeled "good first issue"
4. **Feature implementations** - Discuss in issues first

---

## 📞 Resources

- **GitHub Repository:** [Life-Experimentalist/RanobeGemini](https://github.com/Life-Experimentalist/RanobeGemini)
- **Issue Tracker:** [GitHub Issues](https://github.com/Life-Experimentalist/RanobeGemini/issues)
- **Documentation:** [docs/README.md](../README.md)
- **Architecture:** [docs/architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)

---

**Navigation:** [Back to Development Docs](./README.md) | [Main Docs](../README.md) | [Architecture](../architecture/ARCHITECTURE.md)
```
