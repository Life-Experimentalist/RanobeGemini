# Ranobe Gemini v4.2.0 Release Notes

**Release Date**: March 10–12, 2026
**Type**: Feature Update — Custom Content Boxes, Library UI & FanFiction DB Fixes

## Table of Contents

- [Ranobe Gemini v4.2.0 Release Notes](#ranobe-gemini-v420-release-notes)
	- [Table of Contents](#table-of-contents)
	- [Overview](#overview)
	- [Highlights](#highlights)
	- [✨ What's New](#-whats-new)
		- [🗂️ Custom Content Box Types](#️-custom-content-box-types)
		- [📚 Library UI Enhancements](#-library-ui-enhancements)
		- [🔧 FanFiction Character Database Fixes](#-fanfiction-character-database-fixes)
		- [📖 Novel Library Logic](#-novel-library-logic)
	- [🌐 Website Handler Updates](#-website-handler-updates)
	- [🐛 Bug Fixes](#-bug-fixes)
	- [📥 Getting This Update](#-getting-this-update)

---

## Overview

Version 4.2.0 adds a fully user-configurable **Custom Content Box** system so you can define your own CSS classes and styles for special content types without touching extension source code. The library homepage gets a new hero "Continue Reading" eyebrow, character/relationship rendering is cleanly separated in novel cards, and the shelf reading-status buttons are now dynamically generated. FanFiction character data inconsistencies are repaired through a new database repair pass, and story completion status is now correctly derived from the publication status field.

---

## Highlights

- **Custom Content Box Types** — define arbitrary CSS classes, display names, and styling from Library Settings with a live preview.
- **Library hero eyebrow** — new "Continue Reading" prompt at the top of the library homepage.
- **Character vs. relationship separation** — novel cards now render character lists and relationship groups in distinct sections.
- **Dynamic reading-status buttons** — `shelf-page.js` builds status buttons from available statuses rather than hardcoding them.
- **FanFiction DB repair** — new database fix pass resolves malformed character/relationship data stored from earlier versions.

---

## ✨ What's New

### 🗂️ Custom Content Box Types

A new **Custom Content Boxes** section in Library Settings lets readers define their own content box types:

- Enter a **CSS class name** (e.g. `my-system-box`), **display name**, and optional styling overrides.
- Custom boxes are saved to browser storage under a dedicated key and loaded on every chapter page.
- **Live preview** in settings shows exactly how a box will appear before saving.
- Complements the built-in box types (`rg-author-note`, `game-stats-box`, `rg-system-msg`, `rg-skill-box`, `rg-quote-box`, `rg-flashback`).

### 📚 Library UI Enhancements

- **Hero eyebrow section** (`library.html`) with a new "Continue Reading" heading and styled prompt for readers with active novels.
- **CSS updated** (`library.css`) for improved visibility of the hero eyebrow across all themes.
- **Novel card character rendering** (`novel-card.js`) refactored: the character list and relationship groups are now separated into labelled sections, making dense metadata easier to scan.
- **Shelf reading-status buttons** (`shelf-page.js`) now dynamically build from `AVAILABLE_STATUSES`, removing hardcoded HTML and making future status additions automatic.

### 🔧 FanFiction Character Database Fixes

- A targeted repair pass recalculates characters and relationships for all FanFiction shelf novels that stored malformed data (single comma-joined string inside a relationship group).
- Triggered via **Library Settings → Repair DB** or automatically on the next `getLibrary()` call.
- Characters from relationships are now correctly mirrored into the top-level character list.

### 📖 Novel Library Logic

- Story completion status is now **derived from publication status** when an explicit status value is absent.
- `novel-library.js` updated: if `metadata.publicationStatus` indicates "Completed", the novel status follows.
- Prevents "Ongoing" being shown for novels the site marks as finished.

---

## 🌐 Website Handler Updates

None — handler logic unchanged in this release. FanFiction character improvements are confined to the `novel-library.js` normalization layer.

---

## 🐛 Bug Fixes

- Word count threshold constants applied correctly to chunking configuration.
- Cache restore retry delay constant (`CACHE_RESTORE_RETRY_DELAY`) wired into chunking retry logic.
- Popup backup model selection correctly resolves to the stored/defaulted model ID.
- Content filter settings (fight scenes, R18, author notes) now persist and reload correctly.

---

## 📥 Getting This Update

- **Firefox (AMO)**: Update automatically or visit [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/).
- **Edge/Chromium**: Download `RanobeGemini_chromium_v4.2.0.zip` from the [Releases page](https://github.com/Life-Experimentalist/RanobeGemini/releases) and sideload.
- **Build from source**: `npm run package` (requires Node.js 14+).
