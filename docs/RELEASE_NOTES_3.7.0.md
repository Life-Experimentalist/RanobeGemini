# Release Notes - Ranobe Gemini v3.7.0

**Release Date**: January 30, 2026

## 🎉 Overview

Version 3.7.0 introduces major improvements to Google Drive OAuth support, critical popup UI fixes, enhanced notification system, and improved website handler logic. This release focuses on reliability, user experience, and better integration with Google Cloud services.

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

See [CHANGELOG.md](docs/CHANGELOG.md) for complete version history.

---

## 🐛 Bug Reports

Found an issue? [Report it on GitHub](https://github.com/Life-Experimentalist/RanobeGemini/issues)

---

**Happy Reading! 📚✨**
