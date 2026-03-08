# Ranobe Gemini v4.0.0 Release Notes

**Release Date**: March 6, 2026
**Type**: Major Release — Library Experience, Animations & Popup Overhaul

## Table of Contents

- [Ranobe Gemini v4.0.0 Release Notes](#ranobe-gemini-v400-release-notes)
	- [Table of Contents](#table-of-contents)
	- [Overview](#overview)
	- [Highlights](#highlights)
	- [✨ What's New](#-whats-new)
		- [🎨 Background Animation System](#-background-animation-system)
		- [📚 Library Card Renderer Overhaul](#-library-card-renderer-overhaul)
		- [🔔 Popup Notifications Tab](#-popup-notifications-tab)
		- [⚡ Auto-Enhance Per Novel](#-auto-enhance-per-novel)
		- [💾 Backup Download Manager](#-backup-download-manager)
		- [🌐 Handler Manager Improvements](#-handler-manager-improvements)
	- [🌐 Website Handler Improvements](#-website-handler-improvements)
		- [FanFiction.net](#fanfictionnet)
		- [Ranobes.net](#ranobesnet)
	- [🖥️ Chapter Controls \& UI Fixes](#️-chapter-controls--ui-fixes)
	- [🎨 Theme System Improvements](#-theme-system-improvements)
	- [⚙️ Site / Domain Settings](#️-site--domain-settings)
	- [🔧 Background \& Notification Plumbing](#-background--notification-plumbing)
	- [🐛 Bug Fixes](#-bug-fixes)
	- [⚠️ Breaking Changes \& Migration Notes](#️-breaking-changes--migration-notes)
	- [📥 Getting This Update](#-getting-this-update)
	- [🙏 Credits](#-credits)

---

## Overview

Version 4.0.0 is a major release that significantly expands the visual and functional depth of Ranobe Gemini. The headline additions are a canvas-based **background animation engine** for library pages, a complete **library card renderer overhaul** with site-specific card designs and unified modal access, a dedicated **Notifications tab** in the popup, and per-novel **auto-enhance toggles**. Under the hood, the handler manager, backup system, and notification infrastructure received substantial hardening.

---

## Highlights

- **5 new canvas animations** for library pages: Particles, Falling Leaves, Snow, Rain, and Fireflies — all color-synced with your chosen theme.
- **Library card rendering** fully overhauled with async site-specific renderers; novel modals are now accessible from the main library homepage.
- **Popup Notifications tab** — view, browse, and clear your notification history without leaving the popup.
- **Auto-enhance toggles** per novel in the popup, backed by `novelLibrary` integration.
- **Backup Download Manager** — a new module for listing, downloading, and restoring backup files directly from the browser.
- FanFiction.net handler now handles bare-domain redirects, filters out profile pages, and has improved mobile support.
- Ranobes handler excludes chapter-index pages and extracts richer metadata.
- Gemini UI toggle now correctly hides all summary groups and summary containers.

---

## ✨ What's New

### 🎨 Background Animation System

A brand-new canvas-based animation engine (`bg-animation.js`) brings life to all library pages. Animations are chosen per-theme or via the new Library Settings controls.

**Canvas Animations (5 new):**
- ✨ **Particles** — floating colored orbs that drift around the page
- 🍂 **Falling Leaves** — seasonal leaf-fall with rotation and gentle sway
- ❄️ **Snow** — soft snowflakes drifting downward
- 🌧️ **Rain** — diagonal rain streaks with configurable density
- 🟡 **Fireflies** — glowing dots that pulse and wander

**CSS Animations (existing, now grouped in settings):**
- Waves, Leaves, Shimmer

All canvas animations automatically sync their color palette to the current `--primary-color` CSS variable so they always match your chosen theme. The `bg-animations.css` is now linked in all five site-specific shelf pages (AO3, FanFiction, ScribbleHub, Ranobes, Webnovel).

The Library Settings > **Background Animation** picker now groups options into "Canvas Animations" and "CSS Animations" optgroups for clarity.

---

### 📚 Library Card Renderer Overhaul

The entire novel card rendering pipeline in the main library was rewritten for better maintainability, correctness, and visual results.

**Changes:**
- A `novel-card-template` HTML element in `library.html` powers consistent card structure across all views.
- Card rendering is now **async**: each site shelf loads its own renderer module (from `novel-card.js`) on demand, with a generic fallback card when no site-specific renderer exists.
- A unified `novel-card-click` event wires card clicks directly to the novel detail modal — the modal is now accessible from the **main library homepage**, not just individual site shelves.
- Renderer modules are cached after first load so navigating between shelves stays snappy.
- AO3 shelf: fandom grid styles consolidated into `style.css`; stray code outside the renderer class cleaned up.
- FanFiction shelf: renderer now imports and registers correctly with image fallback logic kept CSP-safe.

---

### 🔔 Popup Notifications Tab

A fully new **Notifications** tab has been added to the popup alongside the existing History and Settings tabs.

**Features:**
- Browse all logged notifications with icons, timestamps, and context
- Clear notification history with a single button
- Badge on the Notifications tab icon updates with unread count
- Powered by the new `getNotifications` / `clearNotifications` background messages

---

### ⚡ Auto-Enhance Per Novel

Each novel in the popup's recent/library list now shows an **auto-enhance toggle** so you can enable or disable automatic Gemini enhancement chapter-by-chapter without visiting the full library settings.

- Reads and writes the `autoEnhance` flag in `novelLibrary`
- Recent novels list is now sourced from `novelLibrary.getRecentNovels()` for accurate, real-time data
- Popup history now includes a **"More from this site"** grid to discover related tracked novels
- The **Open Library** button now closes the popup automatically after navigating

---

### 💾 Backup Download Manager

A new `backup-download.js` module centralises all backup file operations that were previously scattered.

**Capabilities:**
- List available backup snapshots stored in browser storage
- Download any snapshot as a JSON file instantly
- Restore a backup from a downloaded file
- Delete individual snapshots
- Integrates with the popup backup buttons and the library UI

---

### 🌐 Handler Manager Improvements

`handler-manager.js` received important lifecycle improvements:

- Now **tracks handler class references** alongside instances, allowing introspection and future hot-swapping.
- Calls static `initialize()` on each handler class before sorting by `PRIORITY`, ensuring site-level setup (redirects, DOM mutations) runs reliably before any content script logic fires.

---

## 🌐 Website Handler Improvements

### FanFiction.net

- **Bare-domain redirect**: Visiting `fanfiction.net` (no path) now redirects correctly to the preferred subdomain (www / mobile / auto) instead of staying on the ambiguous root.
- **Profile page filtering**: URLs matching `/u/` (user profile pages) are now excluded from chapter and novel detection, preventing spurious UI injection on non-content pages.
- **Mobile handler**: `fanfiction-mobile-handler.js` gains the same bare-domain redirect logic via a static `initialize()` call.
- **Parsing improvements**: Metadata extraction for chapter title, story title, and author is more robust against edge-case HTML structures.

### Ranobes.net

- **Chapter-index exclusion**: URLs matching `/chapters/{id}` (the per-novel chapter listing pages) are no longer treated as chapter pages, fixing incorrect UI injection on those pages.
- **Metadata extraction**: The handler now extracts title, author, cover image, description, genres, tags, reading status from the site's bookmark system, and chapter counts — providing richer library entries when adding novels from Ranobes.

---

## 🖥️ Chapter Controls & UI Fixes

- **FanFiction "Copy Title" removed**: The "Copy Title" button was removed from the FanFiction chapter controls toolbar; it was redundant with browser clipboard actions.
- **FanFiction "Copy" as badge**: The "Copy" action is now rendered as a compact green badge rather than a full-size button, reducing toolbar clutter.
- **Gemini UI toggle extended**: The "⚡ Hide Gemini UI" toggle now correctly hides all of:
  - `.gemini-main-summary-group`
  - `.gemini-chunk-summary-group`
  - `.gemini-summary-text-container`
  - `.gemini-chunk-banner`
  - `.gemini-master-banner`

  The toggle uses a `data-rg-saved-display` attribute to save and restore each element's original `display` value, preventing elements from getting stuck with the wrong layout after toggling back on.

---

## 🎨 Theme System Improvements

- Theme variables (`--primary-color`, `--bg-color`, etc.) are now applied to **all five site-specific shelf pages** (AO3, FanFiction, ScribbleHub, Ranobes, Webnovel) via imports in their respective `shelf-page.js` files.
- The `bg-animation.js` canvas engine reads the page's `--primary-color` CSS variable at animation start time so particle/snow/firefly colors always match the active theme without requiring a reload.
- `library.js`, `library-settings.js`, and the shared `shelf-page.js` all import `bg-animation.js` so the animation canvas is available everywhere in the library.

---

## ⚙️ Site / Domain Settings

- Added domain-level **enable/disable** utility functions to `site-settings.js`, allowing per-domain feature toggling that's more granular than the previous site-wide flags.
- Domain settings are already included in comprehensive backups (from v3.9.0) so these new toggles are preserved across reinstalls.

---

## 🔧 Background & Notification Plumbing

New message handlers in `background.js`:

| Message action       | Description                                                                        |
| -------------------- | ---------------------------------------------------------------------------------- |
| `logNotification`    | Records a notification event with metadata to a capped in-memory + storage history |
| `getNotifications`   | Returns the stored notification history to the popup                               |
| `clearNotifications` | Wipes notification history and resets the badge count                              |

- History is capped at a configurable maximum to prevent unbounded storage growth.
- All three handlers return `true` for async response correctness.

---

## 🐛 Bug Fixes

- **Notification bell modal**: Fixed overlay and click-outside-to-close behavior in the popup notification bell (regression from 3.9.0).
- **AO3 renderer**: Removed stray code block outside the `AO3CardRenderer` class that caused duplicate rendering on some shelf views.
- **FanFiction mobile init**: `fanfiction-mobile-handler.js` no longer throws on pages where the DOM hasn't finished building when `initialize()` is called.
- **Handler deduplication**: `handler-manager.js` now deduplicates handler instances so the same handler can't run twice if multiple content script contexts fire.
- **Summary groups toggle**: The toggle previously left `.gemini-summary-text-container` visible after hiding other groups — now all containers hide and restore together.

---

## ⚠️ Breaking Changes & Migration Notes

- **No data migration required.** All library, settings, and backup data from v3.x is fully compatible with v4.0.0.
- The `novelLibrary.getRecentNovels()` API replaces the previous raw store reads in the popup — plugin integrations that bypass this API should migrate to it.
- Handlers that rely on `handler-manager.js` without exposing a static `initialize()` method will still work; the manager simply skips the call if the method doesn't exist.

---

## 📥 Getting This Update

The extension updates automatically through the Firefox Add-ons store and the Chrome Web Store. If you have automatic updates disabled, visit your browser's extension management page and check for updates manually.

After updating, your library, API keys, and settings are preserved. If you use Google Drive backups, no reconnection is needed.

---

## 🙏 Credits

Developed and maintained by [VKrishna04](https://github.com/VKrishna04) under the [Life Experimentalist](https://github.com/orgs/Life-Experimentalist/repositories) organisation. Thank you to everyone who filed issues, suggested features, and tested pre-release builds.

---

*Full changelog: [docs/release/CHANGELOG.md](CHANGELOG.md)*
*Project repository: [Life-Experimentalist/RanobesGemini](https://github.com/Life-Experimentalist/RanobesGemini)*
