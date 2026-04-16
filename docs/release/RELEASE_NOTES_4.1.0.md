# Ranobe Gemini v4.1.0 Release Notes

**Release Date**: March 8, 2026
**Type**: Feature Update — Themes, Reading Progress Bar & Chunking UX

## Table of Contents

- [Ranobe Gemini v4.1.0 Release Notes](#ranobe-gemini-v410-release-notes)
	- [Table of Contents](#table-of-contents)
	- [Overview](#overview)
	- [Highlights](#highlights)
	- [✨ What's New](#-whats-new)
		- [🎨 Enhanced Theme System](#-enhanced-theme-system)
		- [📊 Reading Progress Bar](#-reading-progress-bar)
		- [⚡ Chunking UI Improvements](#-chunking-ui-improvements)
		- [📤 Export Template Updates](#-export-template-updates)
	- [🌐 Website Handler Updates](#-website-handler-updates)
		- [AO3 Handler](#ao3-handler)
		- [FanFiction Handler](#fanfiction-handler)
		- [FanFiction Mobile Handler](#fanfiction-mobile-handler)
	- [🐛 Bug Fixes](#-bug-fixes)
	- [📥 Getting This Update](#-getting-this-update)

---

## Overview

Version 4.1.0 brings a significantly expanded theme engine, a per-novel reading progress bar in novel modals, and substantial improvements to the chunking UI with live feedback and direct chunk enhancement. Export filename templates now include word count and default to EPUB. Site-specific prompts were refined across all handlers.

---

## Highlights

- **5 new creative themes** added: Tokyo Night, Catppuccin Mocha, Synthwave, and more.
- **Auto theme mode** extended with schedule-based and sun-position (sunrise/sunset) switching.
- **Reading progress bar** in Ranobes and ScribbleHub novel modals, showing current / total chapters read.
- **Chunking UI overhaul** — pause/skip buttons, status feedback, and a new "Enhance Chunk" button per chunk.
- **Export template** updated: word count included; default extension changed to EPUB.

---

## ✨ What's New

### 🎨 Enhanced Theme System

- `DEFAULT_THEME` gains three new fields: `autoBehavior`, `timeCustomStart`, `timeCustomEnd` for schedule-based auto switching.
- `resolveMode()` now supports `schedule` and `sun` strategies in addition to the existing `system` detection.
- Helper utilities for time-based checks and sunrise/sunset estimation (latitude-approximate).
- **New theme presets added to `THEME_PRESETS`**:
  - `tokyo-night`
  - `catppuccin-mocha`
  - `synthwave`
  - Additional creative themes

### 📊 Reading Progress Bar

- Novel modals for **Ranobes** and **ScribbleHub** now show a visual reading progress bar.
- Displays the current chapter read vs. total chapters as a percentage bar with a label.
- Updates live when progress is saved.

### ⚡ Chunking UI Improvements

- Added **Pause** and **Skip** buttons to the chunk progress banner for mid-process control.
- New **Enhance Chunk** button per completed chunk, allowing individual chunk re-enhancement without re-running the full chapter.
- Status feedback improved: banner now shows current chunk number and estimated completion.
- Improved `aria-hidden` attributes on decorative elements for better screen-reader compatibility.
- `extractParagraphsFromHTML()` in chunking.js refined for more accurate paragraph boundary detection.

### 📤 Export Template Updates

- Word count is now included in the default export filename template.
- Default export extension changed from generic to **EPUB**.
- `novel-copy-format.js` updated with the new template variables and resolution logic.
- **Copy button** in AO3 and FanFiction handlers uses the new template; FicHub download button no longer includes a duplicate "Copy Title" step.

---

## 🌐 Website Handler Updates

### AO3 Handler

- Updated default site prompt with clearer formatting rules for author notes, epigraphs, and flashbacks.

### FanFiction Handler

- Refined default site prompt with specific rules for author notes, quote boxes, and flashback scenes.
- "Copy Title" button removed from chapter toolbar; replaced by compact green **Copy** badge (`badgeStyle: true`).

### FanFiction Mobile Handler

- Default site prompt updated to match desktop handler formatting guidance.

---

## 🐛 Bug Fixes

- Background animation import removed from pages that previously caused a console error on load.
- `getThemePalette` and `setThemeVariables` updated to respect new auto-mode fields without breaking backward compatibility with old stored themes.
- Chunking word-count threshold constants (`WORD_COUNT_THRESHOLD`, `CACHE_RESTORE_RETRY_DELAY`) added to `constants.js`.

---

## 📥 Getting This Update

- **Firefox (AMO)**: Update automatically or visit [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/).
- **Edge/Chromium**: Download `RanobeGemini_chromium_v4.1.0.zip` from the [Releases page](https://github.com/Life-Experimentalist/RanobeGemini/releases) and sideload.
- **Build from source**: `npm run package` (requires Node.js 14+).
