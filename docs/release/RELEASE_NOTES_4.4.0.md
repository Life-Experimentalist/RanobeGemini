# Ranobe Gemini v4.4.0 Release Notes

**Release Date**: March 17, 2026
**Type**: Feature Update — Reading Lists, Content-Style Docs, Backup Coverage & UX Polish

## Table of Contents

- [Overview](#overview)
- [Highlights](#highlights)
- [✨ What's New](#-whats-new)
  - [🏷️ Reading Lists](#️-reading-lists)
  - [🧩 Content Styles & Collapsible Documentation](#-content-styles--collapsible-documentation)
  - [🗣️ Community & Contributor Workflow Updates](#️-community--contributor-workflow-updates)
- [🔄 Changed](#-changed)
- [🛡️ Backup & Restore Improvements](#️-backup--restore-improvements)
- [🐛 Fixes](#-fixes)
- [⬆️ Migration Notes](#️-migration-notes)
- [📥 Getting This Update](#-getting-this-update)

---

## Overview

Version 4.4.0 turns several v4.2.0 and v4.3.0 systems into a more coherent experience. Reading Lists are now treated as first-class badges separate from the primary reading status, the public documentation pages now show how content boxes and collapsible sections actually behave in a chapter, and backup coverage has been tightened so the new content filter and custom content box settings survive comprehensive exports, Drive sync backups, and rolling backups.

This release also cleans up landing-page consistency, improves special-content text rendering, and expands contributor/community documentation so the project stays easier to maintain as more sites and reading workflows are added.

---

## Highlights

- **Reading Lists** are now distinct from the main reading status, allowing badges like `rereading`, `favourites`, `r18`, and custom lists without overloading the core status field.
- **Content-style documentation** now shows real chapter-like previews, built-in box types, saved custom content boxes, and Mermaid diagrams for the collapsible-content flow.
- **Backup coverage** now preserves both `contentFilterSettings` and `rg_custom_box_types`, so your Library Settings customizations restore correctly across backup methods.
- **Landing polish** standardizes Library navigation, install CTAs, footer structure, and light-theme readability across docs pages.

---

## ✨ What's New

### 🏷️ Reading Lists

Reading Lists have been elevated into a dedicated part of the library model:

- Built-in lists like `rereading`, `favourites`, and `r18` now coexist with the primary reading status instead of competing with it.
- Custom lists can be added and managed without changing the underlying status pipeline.
- Contributor documentation now explicitly documents the distinction between primary statuses and reading-list badges so future work stays consistent.

### 🧩 Content Styles & Collapsible Documentation

The content styles documentation page was substantially redesigned to reflect the real product experience:

- Built-in special-content box styles are shown with realistic samples.
- An **Actual Chapter Preview** demonstrates how prose, summaries, and collapsible sections appear together.
- Saved custom content boxes are detected from Library Settings and rendered directly in the docs page when available.
- A live playground lets users experiment with box styling and preview structure.
- Mermaid diagrams now explain the flow from library settings to rendered chapter output.

### 🗣️ Community & Contributor Workflow Updates

- GitHub discussion templates were added for FAQ, ideas, Q&A, and general discussions.
- Project instructions were expanded to document reading lists, collapsible sections, white-space styling rules, and documentation maintenance expectations.
- Commit-history tooling and release-doc workflows were improved to make version changes easier to audit.

---

## 🔄 Changed

- Landing pages now share a more consistent top-level navigation model, including direct Library access where relevant.
- Install call-to-action sections and footer layouts are now standardized across the public docs pages.
- Special content boxes now use `white-space: pre-line` for cleaner rendering of system messages, stat blocks, quote-style boxes, and similar formatted content.
- `landing/content-styles.html` now presents collapse behavior as **collapsed by default** where configured, rather than framing the feature as permanently hidden content.

---

## 🛡️ Backup & Restore Improvements

Backup coverage was tightened specifically for the new content-filter and custom-box systems:

- **Comprehensive backups** now include saved custom content box definitions (`rg_custom_box_types`).
- **Drive/download library backups** now include both `contentFilterSettings` and `rg_custom_box_types` in the exported settings payload.
- **Restore flows** now write those settings back into extension storage so the same collapsible preferences and custom box presets reappear after import.
- Backup schema documentation has been updated so the documented payload matches the actual stored data more closely.

This means moving between browsers or restoring from backup no longer drops the custom presentation work users configured in Library Settings.

---

## 🐛 Fixes

- Fixed a backup omission where user-defined custom content box types were not reliably included in full backup payloads.
- Fixed Drive/library backup exports so collapsible content filter settings and custom content box definitions restore correctly.
- Fixed light-theme readability issues in the chapter-preview prose and collapsible summary cards on the content styles docs page.

---

## ⬆️ Migration Notes

- No manual migration is required.
- Existing libraries continue to work as-is.
- After upgrading, newly created backups will preserve the current collapsible-content and custom-box configuration.
- Older backups created before this release may not include the new content filter or custom content box settings.

---

## 📥 Getting This Update

- **Firefox (AMO)**: Update automatically or visit [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/).
- **Edge/Chromium**: Download the latest package from the [Releases page](https://github.com/Life-Experimentalist/RanobeGemini/releases) and sideload it.
- **Build from source**: `npm run package`
