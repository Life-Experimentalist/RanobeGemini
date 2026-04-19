# Development Roadmap (Deprecated - Refer to TECHNICAL_ROADMAP.md)

> **Last Updated:** 2026-04-19
> **Current Version:** 4.7.0

## ⚠️ Important Note for Contributors & AI Agents

This file previously served as the primary sprint tracker (through versions up to v4.4.0).
As of v4.7.0, **all active sprint planning, phase delegation, and execution unit tracking have been permanently moved to `docs/overview/TECHNICAL_ROADMAP.md`.**

Please consult `TECHNICAL_ROADMAP.md` before making architectural decisions or picking up a new task. The below lists are preserved for historical backlog context but are no longer the source of truth.

---

## 🔮 Future Versions Backlog (Unscheduled)

### Product Expansion
- [ ] Multiple enhancement styles (formal, casual, poetic)
- [ ] Per-site prompt presets
- [ ] Enhancement comparison (split-screen)
- [ ] Character glossary generation per novel
- [ ] Terminology dictionary integration

### Platform Expansion
- [ ] Migrate popup and library to React
- [ ] Firefox Sync integration for library
- [ ] Plugin system for custom handlers
- [ ] REST API for third-party integrations
- [ ] Dropbox / OneDrive backup adapters

## 🐛 Known Issues (Backlog)

### High Priority
- [ ] Long chapters (> 100 k chars) may time out during chunking on slow connections

### Medium Priority
- [ ] FanFiction mobile: Cover images sometimes fail to load due to CORS
- [ ] AO3: Custom tags beyond the first 20 are not extracted
- [ ] Cache entries are never automatically evicted; manual clear required

### Low Priority
- [ ] Sites with strict CSP partially block injected button styles
- [ ] Library grid card height inconsistent with very long tag lists

## 🔧 Technical Debt (Backlog)
- [ ] Background service worker (`background.js`) is very large — split into `api.js`, `chunking.js`, `drive.js`, `storage.js`
- [ ] Add unit tests for handlers (mock DOM), storage manager, novel library
- [ ] TypeScript migration — start with utility modules; add JSDoc types in the interim
- [ ] Build system: add source maps for debug builds; minify production bundles

## 💡 Feature Requests
- [ ] Offline reading — store enhanced chapters in IndexedDB
- [ ] EPUB/PDF export from library
- [ ] Text-to-speech integration with Incognito Mode
- [ ] Shared community prompt library
- [ ] AI-powered chapter predictions (experimental)
- [ ] Wattpad handler
- [ ] Royal Road handler

---

**Navigation:** [Back to Main Docs](../README.md) | [Architecture](../architecture/ARCHITECTURE.md) | [ROADMAP SOURCE OF TRUTH](../overview/TECHNICAL_ROADMAP.md)
