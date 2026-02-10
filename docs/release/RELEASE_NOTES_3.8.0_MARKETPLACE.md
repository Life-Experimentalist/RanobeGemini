# Ranobe Gemini v3.8.0 - OAuth Setup Overhaul & Backup Improvements

**Release Date**: February 3, 2026

## Table of Contents

- [Ranobe Gemini v3.8.0 - OAuth Setup Overhaul \& Backup Improvements](#ranobe-gemini-v380---oauth-setup-overhaul--backup-improvements)
	- [Table of Contents](#table-of-contents)
	- [🎯 What's New](#-whats-new)
		- [Complete OAuth Setup Redesign](#complete-oauth-setup-redesign)
		- [Smart Backup System](#smart-backup-system)
		- [UI/UX Polish](#uiux-polish)
	- [🐛 Bug Fixes](#-bug-fixes)
	- [🔧 Technical Details](#-technical-details)
	- [📝 Important Notes](#-important-notes)
	- [🔗 Resources](#-resources)
	- [🎉 What's in a Comprehensive Backup?](#-whats-in-a-comprehensive-backup)

---

## 🎯 What's New

### Complete OAuth Setup Redesign

We've completely redesigned the Google Drive backup setup for a clearer, more intuitive experience:

**New Two-Step Workflow:**
1. **Enter Credentials** (one-time): Paste your `client_secret_*.json` OR manually enter Client ID + Secret → Parse → Save
2. **Connect to Drive**: Click "Connect to Google Drive" → Authorize with Gmail → Start backing up!

**Improvements:**
- Separate "Parse JSON" and "Save to Storage" buttons for better control
- Full light/dark theme support with CSS variables
- Color-coded feedback (✅ green success, ⚠️ orange warnings, ❌ red errors)
- Preview credentials before saving
- Clearer error messages for invalid JSON

### Smart Backup System

**Persistent Preferences:**
- Backup checkboxes now remember your choices across sessions
- Default: Include both API keys AND OAuth credentials

**Comprehensive Version Handling:**
- Backups now include extension version (e.g., v3.8.0) + format version (v3.0)
- Smart compatibility checking when restoring
- Version warnings for backups from newer/older extension versions
- Automatic migration for legacy backup formats
- Detailed version info shown before restore

**OAuth in Backups:**
- OAuth credentials now **included by default** in comprehensive backups
- Separate checkbox to include/exclude credentials
- Always asks before overwriting existing credentials on restore

### UI/UX Polish

- Larger, more clickable checkboxes (14×14px with cursor pointer)
- All form elements now respect light/dark theme
- Better spacing and visual hierarchy
- Multi-line parsing results with proper word wrapping
- Redirect URI validation with helpful warnings

## 🐛 Bug Fixes

1. Checkbox states now persist correctly between popup opens
2. OAuth setup section properly inherits theme colors
3. JSON parsing displays multi-line error messages
4. Better validation for redirect URIs
5. Improved error handling throughout

## 🔧 Technical Details

- Backup format: **v3.0** (backward compatible with v2.0 and v1.0)
- New storage key: `backupCheckboxSettings`
- Extension version embedded in all new backups
- Smart version compatibility checking with warnings

## 📝 Important Notes

- **No breaking changes** - fully backward compatible
- Custom folder ID temporarily hidden (will return in future release)
- Create a backup before updating (recommended)

## 🔗 Resources

**Full release notes & setup guide:**
https://github.com/Life-Experimentalist/RanobesGemini/blob/main/docs/RELEASE_NOTES_3.8.0.md

**OAuth Setup Tutorial:**
https://ranobe.vkrishna04.me/drive-setup.html

## 🎉 What's in a Comprehensive Backup?

✅ Library data (novels, chapters, reading history)
✅ All prompts & model configuration
✅ API keys (Gemini + backups)
✅ OAuth credentials (NEW: default enabled)
✅ Theme preferences & site settings
✅ Version information for compatibility

---

**Developed by VKrishna04 (Life Experimentalist)**
Website: https://vkrishna04.me

Happy reading! 📖✨
