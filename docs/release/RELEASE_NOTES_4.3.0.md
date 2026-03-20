# Ranobe Gemini v4.3.0 Release Notes

**Release Date**: March 15, 2026
**Type**: Feature Update — Incognito Mode, Collapsible Sections & Summary Quality

## Table of Contents

- [Ranobe Gemini v4.3.0 Release Notes](#ranobe-gemini-v430-release-notes)
	- [Table of Contents](#table-of-contents)
	- [Overview](#overview)
	- [Highlights](#highlights)
	- [✨ What's New](#-whats-new)
		- [🕵️ Incognito Mode](#️-incognito-mode)
		- [🔽 Collapsible Content Sections](#-collapsible-content-sections)
		- [🔇 Hide Gemini UI During Read Aloud](#-hide-gemini-ui-during-read-aloud)
		- [🗂️ Summary Quality Improvements](#️-summary-quality-improvements)
		- [🔑 Popup Backup Model Selection](#-popup-backup-model-selection)
	- [🌐 Website Handler Updates](#-website-handler-updates)
		- [FanFiction.net — Redirect Fix](#fanfictionnet--redirect-fix)
		- [Metadata Extraction Hardening](#metadata-extraction-hardening)
	- [🐛 Bug Fixes](#-bug-fixes)
	- [⬆️ Migration Notes](#️-migration-notes)
	- [📥 Getting This Update](#-getting-this-update)

---

## Overview

Version 4.3.0 introduces **Incognito Mode** for temporary privacy while reading, **collapsible content sections** for fight scenes / R18 content / author notes, and a suite of summary extraction quality improvements. FanFiction.net redirects are now correct and persistent — clicking Mobile/Desktop saves your preference to storage so the preference survives page loads. Relationship-to-character mirroring is fixed for all historical data. Theme error handling is hardened for older runtimes.

---

## Highlights

- **Incognito Mode** — pause library tracking with a configurable auto-expiry duration. Toggle from popup or Library Settings.
- **Collapsible sections** — fight scenes, R18 content, and author notes can be toggled visible/hidden per chapter. Default visibility is user-configurable.
- **FanFiction redirect fix** — Mobile ↔ Desktop switch now writes `domainPreference` to storage, so `normalizeURL()` respects the user's explicit choice on every subsequent load.
- **Relationship→Characters fix** — malformed historical relationship entries (single comma-joined string) are repaired; all relationship members now appear in the Characters section.
- **Summary quality checks** — `isLowQualityLongSummary()` and `getSummaryOutputBudget()` added to background.js to detect and retry low-quality summaries.

---

## ✨ What's New

### 🕵️ Incognito Mode

A new **Incognito Mode** lets you read without adding visits to your novel library:

- Toggle from the **popup** (new Incognito button) or **Library Settings**.
- Configurable **auto-expiry duration**: 30 minutes, 1 hour, 2 hours, or "until manually disabled".
- When active, a visual indicator appears in the popup header.
- Background script handles Incognito state checks before any library write.
- All existing library data is preserved — Incognito Mode only pauses new tracking.

### 🔽 Collapsible Content Sections

Chapter content can now be organized into collapsible sections:

- **Fight scenes**, **R18 content**, and **author notes** are automatically detected based on enhanced content markers.
- Default visibility is configurable per content type in **Library Settings → Content Filters**.
- Uses a consistent disclosure widget with smooth CSS transitions.
- Works with all supported sites; detection relies on the existing `rg-author-note`, `rg-flashback`, and related class markers injected by the enhancer.

### 🔇 Hide Gemini UI During Read Aloud

- **Library Settings** now includes a toggle: "Hide Gemini UI during Read Aloud".
- When the browser's Read Aloud feature activates, the Gemini enhancement banner, summary groups, and chunk banners are hidden to avoid interfering with narration.
- Uses `document.body.dataset.rgReadAloud` to detect Read Aloud state.

### 🗂️ Summary Quality Improvements

- `isLowQualityLongSummary(text)` — new helper in `background.js` that detects summaries likely cut short (ends mid-sentence, very low word density, etc.).
- `getSummaryOutputBudget(chapterLength)` — calculates a safe `maxOutputTokens` budget proportional to chapter length.
- Automatic retry (up to 2 times) when a low-quality summary is detected.
- `MAX_TOKENS` is now capped per request to prevent runaway generation.

### 🔑 Popup Backup Model Selection

- Popup now surfaces a **backup model** selector (separate from the primary model).
- When the primary model hits a rate limit or quota error, the backup model is used automatically.
- Both primary and backup model selections use `DEFAULT_MODEL_ID` as the fallback.

---

## 🌐 Website Handler Updates

### FanFiction.net — Redirect Fix

The previous `?rgffswitch=1` token approach was removed in favour of a proper preference-persistence fix:

- **Desktop Mobile/Desktop button**: now writes `domainPreference = "mobile"` (or `"www"`) to `SITE_SETTINGS_KEY` in storage before navigating.
- **Mobile Desktop button**: now writes `domainPreference = "www"` to storage and correctly handles `.ws` TLD.
- `normalizeURL()` reads the stored `domainPreference` on every load — so the user's explicit switch is respected without a one-shot bypass token.
- Both handlers import `SITE_SETTINGS_KEY`; the mobile handler now carries its own import.

### Metadata Extraction Hardening

**AO3 Handler**:
- Selectors broadened with `#workskin` prefix to catch content inside the AO3 container.
- `dl.work.meta.group` added as fallback for work metadata.
- Document title fallback strips "Chapter X" and "[Archive of Our Own]" patterns.

**Ranobes Handler**:
- `specItems` pre-scan added for author extraction from spec list.
- Pseudo-author filter rejects `^ranobes(\.top)?$` variations.
- `mainNovelUrl` fallback ensures novels without explicit novel-page URLs are still linked.

**ScribbleHub Handler**:
- `parseCompactNumber()` helper handles `k`/`m`/`b` suffixed stat values (e.g. `1.2k` reviews).
- Tighter author selectors for both chapter and novel pages.
- Description meta fallback from `<meta name="description">` / `<meta property="og:description">`.
- Genre extraction now traverses nested `<a>` links inside `.fic_genre`.
- Rating count parsing strips commas from numbers like `1,234 ratings`.

---

## 🐛 Bug Fixes

- **`normalizeFanfictionMetadata()`**: `addRelationshipGroup` now correctly repairs single-element comma-joined relationship groups stored by earlier versions.
- **Theme configuration**: error handler added for older runtimes that don't support newer theme preset keys.
- **`novel-library.js` status derivation**: `completionStatus` properly derived from `publicationStatus` without overwriting an explicit user-set status.
- **Chunking paragraph extraction**: `extractParagraphsFromHTML()` edge case fixed for chapters with no `<p>` tags.

---

## ⬆️ Migration Notes

- No breaking changes to the library data schema.
- Existing `domainPreference` values (`"auto"`, `"www"`, `"mobile"`) continue to work.
- Old relationship data with malformed comma-joined entries will be repaired automatically on the first `getLibrary()` call after updating.
- Incognito Mode starts disabled; no action required to preserve existing behaviour.

---

## 📥 Getting This Update

- **Firefox (AMO)**: Update automatically or visit [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/).
- **Edge/Chromium**: Download `RanobeGemini_chromium_v4.3.0.zip` from the [Releases page](https://github.com/Life-Experimentalist/RanobeGemini/releases) and sideload.
- **Build from source**: `npm run package` (requires Node.js 14+).
