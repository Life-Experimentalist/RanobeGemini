# Release Notes - Ranobe Gemini v3.7.0

**Release Date**: January 30, 2026

## 🎉 Overview

Version 3.7.0 introduces major improvements to Google Drive OAuth support, critical popup UI fixes, enhanced notification system, and improved website handler logic. This release focuses on reliability, user experience, and better integration with Google Cloud services.

---

## Table of Contents

- [Release Notes - Ranobe Gemini v3.7.0](#release-notes---ranobe-gemini-v370)
	- [🎉 Overview](#-overview)
	- [Table of Contents](#table-of-contents)
	- [✨ What's New](#-whats-new)
		- [☁️ Google Drive OAuth Enhancements](#️-google-drive-oauth-enhancements)
			- [Client Secret Support](#client-secret-support)
			- [Why This Matters](#why-this-matters)
			- [User-Configured OAuth (NEW!)](#user-configured-oauth-new)
		- [💾 Comprehensive Backup System (NEW!)](#-comprehensive-backup-system-new)
			- [Full Extension Backup](#full-extension-backup)
			- [Rolling Auto-Backups](#rolling-auto-backups)
			- [Easy Migration](#easy-migration)
		- [📊 Anonymous Analytics (Opt-Out) (NEW!)](#-anonymous-analytics-opt-out-new)
			- [CFlair-Counter Integration](#cflair-counter-integration)
			- [What's Collected](#whats-collected)
			- [What's NEVER Collected](#whats-never-collected)
			- [Custom Webhook Support](#custom-webhook-support)
		- [📢 Enhanced Notification System](#-enhanced-notification-system)
			- [Centralized Notification Manager](#centralized-notification-manager)
			- [Smart Progress Tracking](#smart-progress-tracking)
		- [🎯 Domain-Specific Settings](#-domain-specific-settings)
			- [Per-Domain Feature Control](#per-domain-feature-control)
	- [🔧 Major Fixes](#-major-fixes)
		- [Popup UI Critical Fixes](#popup-ui-critical-fixes)
		- [Google Drive OAuth](#google-drive-oauth)
	- [🌐 Website Handler Improvements](#-website-handler-improvements)
		- [All Handlers](#all-handlers)
		- [FanFiction.net](#fanfictionnet)
		- [Ranobes.net](#ranobesnet)
		- [Archive of Our Own (AO3)](#archive-of-our-own-ao3)
		- [ScribbleHub](#scribblehub)
		- [Handler Manager](#handler-manager)
	- [📚 Library \& UI Improvements](#-library--ui-improvements)
		- [Novel Modal Enhancements](#novel-modal-enhancements)
		- [Reading Status](#reading-status)
	- [🏗️ Build System \& Platform Support](#️-build-system--platform-support)
		- [Platform-Specific Builds](#platform-specific-builds)
		- [Documentation](#documentation)
	- [🔄 Migration Guide](#-migration-guide)
		- [For Existing Users](#for-existing-users)
			- [If You Use Google Drive Backup](#if-you-use-google-drive-backup)
			- [Settings \& Data](#settings--data)
	- [🛠️ Technical Details](#️-technical-details)
		- [OAuth Flow Enhancement](#oauth-flow-enhancement)
		- [Popup Initialization Fix](#popup-initialization-fix)
	- [📝 Known Issues](#-known-issues)
		- [Google Drive OAuth](#google-drive-oauth-1)
		- [Workarounds](#workarounds)
	- [🙏 Acknowledgments](#-acknowledgments)
	- [📥 Download](#-download)
	- [📖 Full Changelog](#-full-changelog)
	- [🐛 Bug Reports](#-bug-reports)
	- [Ranobe Gemini v3.7.0 — Firefox Release Notes (Short)](#ranobe-gemini-v370--firefox-release-notes-short)
		- [Highlights](#highlights)
		- [Major Fixes](#major-fixes)
		- [Notes](#notes)

---

## ✨ What's New

### ☁️ Google Drive OAuth Enhancements

#### Client Secret Support

- **Web Application OAuth Credentials**: Full support for "Web application" type OAuth credentials from Google Cloud Console
  - New `Client Secret` input field in Advanced settings
  - Automatic secret handling in token exchange and refresh flows
  - Backwards compatible with "Chrome Extension" type credentials (no secret required)
  - Enables users to use existing Google Cloud projects

#### Why This Matters

Previously, the extension only worked with "Chrome Extension" type OAuth credentials. Now users can:
- Use existing Google Cloud projects with web credentials
- Have more flexibility in OAuth setup
- Choose the credential type that fits their needs

#### User-Configured OAuth (NEW!)

- **No Default Credentials**: Users now configure their own Google Cloud OAuth credentials
  - Paste JSON credentials directly from Google Cloud Console
  - Automatic parsing of "Web application" or "Desktop app" credential JSON
  - Smart redirect URI validation per browser type
  - Clear setup instructions in the popup

---

### 💾 Comprehensive Backup System (NEW!)

#### Full Extension Backup

- **Everything in One File**: Create complete backups including:
  - Novel library with all reading progress
  - All Gemini API keys (primary and backup)
  - Custom prompts (main, summary, short summary, permanent)
  - Site-specific prompts and settings
  - Theme preferences
  - Model configuration
  - Google Drive OAuth credentials (encrypted)
  - Library settings (auto-hold, etc.)

#### Rolling Auto-Backups

- **Automatic Protection**: Browser storage keeps up to 5 recent backups
  - Triggered automatically when library changes
  - Quick restore without needing external files
  - View, restore, or delete individual backups from popup
  - Toggle auto-backups on/off per preference

#### Easy Migration

- Export from one browser, import to another
- Share settings across devices
- Recover from accidental data loss

---

### 📊 Anonymous Analytics (Opt-Out) (NEW!)

#### CFlair-Counter Integration

- **Anonymous View Tracking**: Uses [CFlair-Counter](https://github.com/Life-Experimentalist/CFlair-Counter) for simple view counts
  - **Enabled by default** (opt-out model)
  - First-run dialog informs users about analytics
  - Can be disabled anytime in Library Settings

#### What's Collected

- Anonymous view counts per feature (via CFlair-Counter API)
- Error reports (if enabled separately)

#### What's NEVER Collected

- ❌ API keys or credentials
- ❌ Novel reading history or library data
- ❌ Personal information of any kind

#### Custom Webhook Support

- Send diagnostics to your own endpoint (in addition to CFlair-Counter)
- Useful for self-hosted debugging
- Fully transparent data flow

---

### 📢 Enhanced Notification System

#### Centralized Notification Manager

- **Unified Notification Handling**: All notifications now go through a centralized manager
  - Detailed logging with metadata
  - Novel data caching for better context
  - Enhanced display in popup with rich metadata
  - Improved badge updating
  - Notification history clearing

#### Smart Progress Tracking

- **Progress Update Prompts**: Automatic detection when your saved progress is behind
  - Banner UI for quick progress updates
  - Cooldown mechanism prevents spam
  - Smart status transitions (Reading → Plan to Read, etc.)
  - Dismiss functionality with "don't show again" option

---

### 🎯 Domain-Specific Settings

#### Per-Domain Feature Control

- **Site Settings Management**: Toggle features on specific websites
  - Enable/disable auto-enhancement per domain
  - Domain-level configuration storage
  - Granular control over extension behavior
  - Independent settings for each supported site

---

## 🔧 Major Fixes

### Popup UI Critical Fixes

- ✅ **Fixed initialization race condition** - Popup now loads reliably every time
- ✅ **Fixed broken tab switching** - All tabs now activate properly
- ✅ **Fixed empty fields** - Settings and API keys now load correctly
- ✅ **Fixed prompt loading** - Prompts pre-fill as expected
- ✅ **Removed legacy UI** - Cleaned up old Drive backup controls

### Google Drive OAuth

- ✅ **Fixed "client_secret is missing" error** - Web app credentials now work
- ✅ **Improved error handling** - Better error messages for OAuth failures
- ✅ **Enhanced token management** - Proper refresh flow with secrets

---

## 🌐 Website Handler Improvements

### All Handlers

- Centralized logging system (`debugLog` and `debugError`)
- Better error handling during metadata extraction
- Improved initialization logic

### FanFiction.net

- Auto-redirect from bare domain to mobile/desktop based on user agent
- Excluded user profile pages from chapter detection
- Enhanced metadata extraction (genres, characters, relationships)
- Better story description and author name handling

### Ranobes.net

- Fixed chapter vs novel page detection
- Excluded chapter index URLs from novel page treatment
- Improved title extraction (strips author suffix)
- Enhanced metadata extraction

### Archive of Our Own (AO3)

- Changed enhancement label from "Gemini" to "Ranobe Gemini"

### ScribbleHub

- Author displayed as clickable link in modal
- Improved metadata display

### Handler Manager

- Ensured single initialization per handler
- Prevented duplicate handler loading
- Added static `initialize()` support

---

## 📚 Library & UI Improvements

### Novel Modal Enhancements

- Better "Continue Reading" button logic with comprehensive URL selection
- Improved "Read" button to show correct source URLs
- Enhanced author link handling

### Reading Status

- Auto-adjustment based on current chapter
- Improved status transitions
- Better last read chapter tracking

---

## 🏗️ Build System & Platform Support

### Platform-Specific Builds

- Split manifests: `manifest-firefox.json` and `manifest-chromium.json`
- Enhanced build script for platform-specific packaging
- Consistent icon paths across all files

### Documentation

- Comprehensive Copilot instructions
- Enhanced build system documentation
- Improved domain management guides

---

## 🔄 Migration Guide

### For Existing Users

#### If You Use Google Drive Backup

1. **Chrome Extension Type Credentials**: No action required - everything works as before
2. **Web Application Type Credentials**:
   - Open popup → Advanced tab
   - Expand "Advanced setup (optional)"
   - Enter your Client Secret (starts with `GOCSPX-`)
   - Click "Connect Google Drive"

#### Settings & Data

- ✅ All existing settings preserved
- ✅ Library data intact
- ✅ Saved novels and progress unchanged
- ✅ Local backups continue to work

---

## 🛠️ Technical Details

### OAuth Flow Enhancement

```javascript
// Now supports both credential types
const params = {
  client_id: clientId,
  // ... other OAuth params
};

// Web Application type includes secret
if (clientSecret) {
  params.client_secret = clientSecret;
}
```

### Popup Initialization Fix

```javascript
// Fixed race condition
const startPopup = async () => {
  await initializePopup();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startPopup);
} else {
  startPopup(); // Already loaded
}
```

---

## 📝 Known Issues

### Google Drive OAuth

- **Security Note**: Web Application credentials expose client secret in extension storage. For public distribution, consider using Chrome Extension type credentials instead.
- **Extension ID**: Must be hardcoded in Google Cloud Console for proper OAuth redirect handling

### Workarounds

- For maximum security, use "Chrome Extension" type OAuth credentials
- Keep client secrets private if using Web Application credentials
- See documentation for detailed OAuth setup guide

---

## 🙏 Acknowledgments

Special thanks to all users who reported issues and provided feedback that made this release possible!

---

## 📥 Download

- **Firefox**: [Firefox Add-ons Store](https://addons.mozilla.org/firefox/addon/ranobegemini/)
- **Chrome/Edge**: [GitHub Releases](https://github.com/Life-Experimentalist/RanobeGemini/releases)

---

## 📖 Full Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

---

## 🐛 Bug Reports

Found an issue? [Report it on GitHub](https://github.com/Life-Experimentalist/RanobeGemini/issues)

---

**Happy Reading! 📚✨**

---

Here’s a **short Firefox release note (≤2500 chars)**. I included the full version link on GitHub as requested.

**Full version:** https://github.com/Life-Experimentalist/RanobeGemini/blob/main/docs/RELEASE_NOTES_3.7.0.md

---

## Ranobe Gemini v3.7.0 — Firefox Release Notes (Short)

**Release Date:** Jan 30, 2026

### Highlights

- **Google Drive OAuth enhanced**
  Supports **Web Application** credentials with client secret, while staying compatible with **Chrome Extension** creds. Users can now paste OAuth JSON directly in Advanced settings.

- **Comprehensive Backup System**
  Full backups include library, progress, API keys, prompts, settings, theme, model config, and encrypted Drive OAuth. Includes **auto-rolling backups** (up to 5) with restore and delete controls.

- **Anonymous Analytics (Opt‑Out)**
  Uses **CFlair‑Counter** for anonymous view counts. No personal data or keys collected. Optional custom webhook support.

- **Notification System Overhaul**
  Centralized manager with better logging, badge updates, notification history, and smart progress prompts with cooldowns.

- **Domain-Specific Settings**
  Per-site feature toggles for granular control.

### Major Fixes

- Popup UI reliability fixes: initialization, tabs, settings fields, prompt loading.
- Google Drive OAuth error fixes (“client_secret missing”), improved refresh handling.
- Website handlers: better detection, metadata extraction, and stability across sites (FanFiction.net, Ranobes.net, AO3, ScribbleHub).

### Notes

- Web App OAuth credentials store client secrets in extension storage; **Chrome Extension credentials are safer** for public use.
- Extension ID must be set in Google Cloud for proper redirects.

**Full release notes:** https://github.com/Life-Experimentalist/RanobeGemini/blob/main/docs/RELEASE_NOTES_3.7.0.md
