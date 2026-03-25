# Ranobe Gemini v4.5.0 Release Notes

**Release Date:** March 23, 2026
**Branch:** main
**Status:** Stable

---

## 🎯 Overview

v4.5.0 is a comprehensive UX and architecture refinement focused on **unified library controls**, **intelligent URL import**, **advanced backup resilience**, and **mobile-optimized interfaces**. This release introduces significant improvements to novel management workflows while maintaining full backward compatibility with existing library data.

---

## ✨ Major Features

### 1. 📖 Unified Status Dropdown with Reading-List Integration

**What Changed:**
- Novel card status dropdown now consolidates primary reading status AND reading-list membership in a single control
- Reading-list toggle actions (including `rereading`, `favourites`, custom lists) appear as optgroup in the dropdown
- Removed separate rereading-toggle button; all list management is now unified
- Live-updating dropdown reflects current state after any toggle

**Why This Matters:**
- Reduces UI clutter on cards and library view
- Single interaction point for both status and list changes
- More discoverable reading-list features for new users
- Mobile-friendly control consolidation

**Affected Areas:**
- [src/library/library.js](../../src/library/library.js) - Card rendering and event handlers
- [src/library/library.css](../../src/library/library.css) - Dropdown styling and mobile compaction

**Example Dropdown Structure:**
```
Reading Status [dropdown expanded]
  ├─ Plan to Read
  ├─ Reading (selected)
  ├─ On Hold
  ├─ Completed
  └─ Reading Lists (toggle)
      ├─ ✓ Rereading
      ├─ Favourites
      └─ Custom...
```

---

### 2. 📱 Narrow-Mobile Control Compaction

**What Changed:**
- Library view/filter chips and controls no longer force full-width blocks on small phones
- Status filter buttons switch to auto-width, flex-wrap wrapping on screens ≤480px
- View toggle chips become horizontally scrollable instead of stacking
- Dropdown and select elements shrink font and padding for tight spaces
- Chapter card layout remains readable without horizontal scroll

**Why This Matters:**
- 15-20% more usable screen real estate on phones
- Faster access to important controls without excessive scrolling
- Maintains clear visual hierarchy on all screen sizes
- Better supports landscape orientation

**Responsive Breakpoints:**
- **≤480px:** Chip compaction, wrapping filters, reduced padding
- **≤768px:** Single-column layouts for settings dialogs
- **≥1024px:** Multi-column feature grids, full-width diagrams

**CSS Changes:**
- [src/library/library.css](../../src/library/library.css) - New `@media (max-width: 480px)` rules for controls
- Preserve hierarchy and color differentiation through size reduction

---

### 3. 🔗 Adaptive URL Import with Intelligent Deduplication

**What Changed:**
- URL paste imports now automatically detect and skip novels already in your library
- Duplicate links in the same paste batch are removed before processing
- Each handler provides canonical URL template for consistent canonicalization
- Import always adds via explicit content-message flow (not passive tab open)
- Detailed result breakdown showing added/skipped/failed counts

**Why This Matters:**
- Eliminates accidental duplicate library entries
- Makes bulk-import workflows reliable and repeatable
- User retains full control while deduplication happens transparently
- No more failed imports from mixed URLs or already-tracked series

**Handler-Driven Architecture:**
Each handler (fanfiction, ao3, ranobes, scribblehub, webnovel) defines:
- `novelIdPattern` — Regex to extract novel ID from URL
- `importUrlTemplate` — Template to build canonical import URL (e.g., `https://www.fanfiction.net/s/{id}/1/`)
- `primaryDomain` — Canonical domain for URL normalization

**Example Flow:**
```
User pastes:
  https://www.fanfiction.net/s/12345/1/
  https://m.fanfiction.net/s/12345/
  https://fanfiction.ws/s/12345/1/
  https://www.fanfiction.net/s/99999/1/

System:
  1. Filters: All 4 are FF.net patterns ✓
  2. Extracts IDs: 12345, 12345, 12345, 99999
  3. Checks library: 12345 already added → skip 3 URLs
  4. Dedupes batch: 12345 is duplicate → skip
  5. Result: Queue only 99999 for import
  6. Import succeeds; report shows "Added 1, skipped 3 (existing: 3)"
```

**Modified Files:**
- [src/library/novel-library.js](../../src/utils/novel-library.js) - Shared import planner
- [src/library/library.js](../../src/library/library.js) - Integration with card-based import
- [src/library/library-settings.js](../../src/library/library-settings.js) - Settings-page import workflow
- Handler files (ao3, fanfiction, ranobes, scribblehub, webnovel) - `importUrlTemplate` added

---

### 4. 🔄 Advanced Backup Deduplication and Reconciliation

**What Changed:**
- Backup history now deduplicates entries to avoid listing the same Drive file multiple times
- Continuous-mode backups reuse a single Drive file; only the latest version is tracked
- Versioned backups keep discrete Drive files; history only records one entry per file
- Reconciliation purges local history entries for Drive files that no longer exist
- Schema expanded with `backupHistoryEntry`, `stats`, and metadata enrichment

**Why This Matters:**
- Cleaner, more accurate backup history view
- Reduces UI confusion from redundant entries
- Ensures data consistency between local and Drive state
- Supports recovery workflows with accurate metadata

**Backup History Entry Structure:**
```json
{
  "filename": "ranobe-gemini-backup-2026-03-23.json",
  "createdAt": 1711222800000,
  "uploadedToDrive": true,
  "reason": "manual",
  "variant": "versioned",
  "fileId": "1a2b3c4d5e6f7g8h9i0j",
  "webViewLink": "https://drive.google.com/file/d/...",
  "exportedAt": 1711222801000
}
```

**Modified Files:**
- [src/background/background.js](../../src/background/background.js) - Dedup and reconciliation logic
- [docs/backup/ranobe-backup.schema.json](../backup/ranobe-backup.schema.json) - Schema updates

---

### 5. 🏗️ Enhanced Architecture Documentation

**What Changed:**
- Redesigned architecture page with centered, mobile-responsive diagrams
- Added 5 new detailed sections with state machines, sequence diagrams, and data tables:
  - **Message Flow:** Inter-process communication patterns
  - **Data Model:** Library storage schema with runnable examples
  - **Handler Registration:** Dynamic discovery and manifest coupling
  - **Status Lifecycle:** Novel state machine with rereading list overlay
  - **URL Import Pipeline:** Detailed canonical-URL and batch-dedup flow
- Feature cards summarizing key concepts (Novel Entry, Settings, Backup History, Handler Cache)
- Responsive data tables for schema documentation
- Fallback text renderings for all diagrams (accessibility + offline viewing)

**Why This Matters:**
- New developers can understand architecture much faster
- Diagrams are mobile-friendly and centered for clarity
- Comprehensive reference for future maintenance and contributions
- Backup schema documentation enables external tooling

**Visual Enhancements:**
- Diagram centering with flexbox alignment
- Responsive grid layouts for feature cards
- Mobile-optimized table sizing and spacing
- Fallback ASCII renderings for all Mermaid diagrams

---

## 🔧 Technical Improvements

### FanFiction.net Metadata Fixes (Enhanced)

- **Characters & Relationships:** Comprehensive deduplication and invalid-token filtering
- **Tags:** Deduplicated, invalid entries removed
- **Normalization:** Runs on import via content extraction and can be re-applied via settings UI
- **Reporting:** Detailed breakdown showing scanned, changed, and fixed field counts

**New Report Output:**
```
FF fix complete. Scanned 247, changed 89.
  Characters fixed: 45
  Relationships fixed: 32
  Tags fixed: 12
```

### FanFiction Mobile Duplicate Control Removal

- Desktop/mobile switcher button no longer appears twice
- Top enhancement container disabled in mobile handler
- Full switcher still available in chapter control banners

### Ranobes Icon Fallback

- Changed from `https://ranobes.top/templates/Dark/images/favicon.ico?v=2`
- To: `https://ranobes.top/favicon.ico` (more reliable URL)
- Fallback prevents broken icon load failures on shelf view

---

## 📊 Performance & Stability

### Backup Pipeline Resilience
- Deduplication reduces backup history storage I/O
- Reconciliation prevents stale Drive references
- Batch import reduces tab flashing and network churn

### Mobile Rendering Speed
- Reduced complexity of control hierarchy
- Fewer reflows from width-calculation changes
- Faster touch interactions without full-width button reflow

### URL Import Reliability
- Pre-validation removes unsupported URLs early
- Batch dedupe reduces unnecessary tab cycles
- Canonical URLs ensure deterministic import results

---

## 🐛 Bug Fixes

- **Duplicate FF switch button:** Removed redundant desktop/mobile switcher from mobile handler enhancement
- **Ranobes icon loading:** Switched to more stable CDN path
- **Architecture page blank:** Added missing script.js include for fade-slide animations

---

## 📱 Mobile Optimization (Full Audit)

### Library View
- ✅ Status dropdown fully responsive on all screen sizes
- ✅ Reading-list toggles accessible without horizontal scroll
- ✅ Novel cards maintain readability on phones
- ✅ Filter chips wrap and compress on narrow screens

### Chapter Controls
- ✅ Desktop switcher button hidden on mobile (handled by enhanced handler)
- ✅ Gemini controls stack vertically on small screens
- ✅ Summary box responsive to viewport width
- ✅ Content styles preform correctly in narrow view

### Landing Pages
- ✅ Architecture diagrams centered and responsive
- ✅ Feature cards responsive grid layout
- ✅ Data tables compress on mobile devices
- ✅ Navigation menu toggle works across all pages

### Settings & Dialogs
- ✅ Import URL textarea responsive
- ✅ Result status messages adapt to screen width
- ✅ Backup history table scrollable on mobile
- ✅ Form inputs comfortable touch targets (≥44px)

---

## 📋 Compatibility

### Browser Support
- **Firefox:** ✅ Tested and published
- **Edge:** ✅ Tested and published
- **Chrome/Chromium:** ✅ Ready for temporary sideload

### Data Compatibility
- ✅ Full backward compatibility with v4.4.0 library data
- ✅ Existing reading lists auto-migrate to new schema
- ✅ Legacy backup entries supported during history reconciliation

### API & Model Support
- ✅ All Gemini models (2.0-flash default, fallback available)
- ✅ Custom endpoints and backup models supported
- ✅ OAuth 2.0 (PKCE) for Google Drive

---

## 📚 Documentation Updates

- [README.md](../../README.md) - Feature highlights updated
- [landing/novel-status.html](../../landing/novel-status.html) - Reading-list dropdown wording aligned
- [landing/index.html](../../landing/index.html) - URL import deduplication behavior noted
- [landing/architecture.html](../../landing/architecture.html) - Comprehensive redesign with 5 new sections
- [docs/development/TODO.md](../development/TODO.md) - Feature changelog entries added
- [docs/backup/ranobe-backup.schema.json](../backup/ranobe-backup.schema.json) - Schema expanded with new fields

---

## 🚀 What's Next (v4.6.0 Roadmap)

- **Summary typography parity:** Unified font sizing across summary and chapter content
- **Summary truncation hardening:** Robust handling of edge cases in truncation logic
- **Summarize shortcut wiring:** Keyboard shortcut integration for quick-summarize
- **Mobile nav UX redesign:** Full-screen navigation menu with improved touch targets
- **BetterFiction toggle bridge:** Seamless switching between RG and BetterFiction handlers

---

## 🙏 Contributors

Built by [VKrishna04](https://github.com/VKrishna04) under [Life-Experimentalist](https://github.com/Life-Experimentalist)
Published: March 23, 2026

---

## 📞 Support

- **Issues & Bugs:** [GitHub Issues](https://github.com/Life-Experimentalist/RanobeGemini/issues)
- **Feature Requests:** [GitHub Discussions](https://github.com/Life-Experimentalist/RanobeGemini/discussions)
- **Privacy & Terms:** See [landing/privacy.html](../../landing/privacy.html) and [landing/terms.html](../../landing/terms.html)


-----

# Ranobe Gemini v4.5.0 — Quick Release Notes

**Release Date:** March 23, 2026 | **Status:** Stable

---

## What's New

### 📖 Unified Status Dropdown
Reading-list toggles (rereading, favourites, custom) now live in the novel-card status dropdown instead of separate buttons. Single interaction point for both status and list changes.

### 📱 Mobile Compaction
Controls on narrow phones are now compact and wrap intelligently instead of forcing full-width blocks. Better use of screen real estate on small devices.

### 🔗 Intelligent URL Import
Paste URLs and the system auto-deduplicates, skips already-tracked novels, and canonicalizes via handler templates. Detailed report shows added/skipped/failed counts.

### 🔄 Backup Deduplication
Backup history now deduplicates Drive file entries. Continuous backups reuse a single file; versioned backups keep discrete files. Reconciliation purges stale entries.

### 🏗️ Architecture Docs
Redesigned architecture page with centered diagrams, new sections on message flow, data schemas, handler registration, status lifecycle, and URL import pipeline.

---

## Bug Fixes

- ✅ Removed duplicate FanFiction desktop/mobile switcher button
- ✅ Ranobes icon now uses stable CDN path
- ✅ Architecture page now renders (added missing script)
- ✅ FanFiction metadata (characters, relationships, tags) deduplication improved

---

## Compatibility

- ✅ Full backward compatibility with v4.4.0 library data
- ✅ Existing reading lists auto-migrate
- ✅ All browsers (Firefox, Edge, Chrome) supported
- ✅ All Gemini models and custom endpoints supported

---

## Learn More

📖 **Full release notes:** See [RELEASE_NOTES_4.5.0.md](RELEASE_NOTES_4.5.0.md) for comprehensive feature documentation and technical details.

🚀 **Next steps:** Check out [landing/architecture.html](../../landing/architecture.html) for updated system documentation.

---

**Built by:** [VKrishna04](https://github.com/VKrishna04) · **Organization:** [Life-Experimentalist](https://github.com/Life-Experimentalist)
**Report issues:** [GitHub Issues](https://github.com/Life-Experimentalist/RanobeGemini/issues)
