# Button Consistency Guide

This document details how buttons are wired and consistent between the **Advanced Tab** (popup.html/popup.js) and **Library Settings Modal** (library.html/library.js).

## Overview

Both interfaces provide comprehensive settings management with consistent button behaviors:
- **Popup**: Detailed controls with confirmations and granular options
- **Library Modal**: Simplified controls with auto-save on change and batch save button

## Table of Contents

- [Button Consistency Guide](#button-consistency-guide)
	- [Overview](#overview)
	- [Table of Contents](#table-of-contents)
	- [Button Categories](#button-categories)
		- [1. Data Management Buttons](#1-data-management-buttons)
			- [Export Library](#export-library)
			- [Import Library](#import-library)
			- [Clear Library](#clear-library)
		- [2. Comprehensive Backup Buttons](#2-comprehensive-backup-buttons)
			- [Create Comprehensive Backup](#create-comprehensive-backup)
			- [Restore Comprehensive Backup](#restore-comprehensive-backup)
		- [3. Rolling Backup Toggle](#3-rolling-backup-toggle)
			- [Enable/Disable Rolling Backups](#enabledisable-rolling-backups)
		- [4. Model Settings (Popup Only)](#4-model-settings-popup-only)
			- [Save Advanced Settings](#save-advanced-settings)
			- [Reset All Advanced Settings](#reset-all-advanced-settings)
		- [5. Theme Settings (Popup Only)](#5-theme-settings-popup-only)
			- [Save Theme](#save-theme)
			- [Reset Theme](#reset-theme)
		- [6. Site Toggles (Popup Only)](#6-site-toggles-popup-only)
			- [Enable/Disable Sites](#enabledisable-sites)
			- [Restore Site Defaults](#restore-site-defaults)
		- [7. Google Drive Buttons](#7-google-drive-buttons)
			- [Connect Drive (OAuth)](#connect-drive-oauth)
			- [Disconnect Drive](#disconnect-drive)
			- [Manual Drive Backup](#manual-drive-backup)
			- [View Backup History](#view-backup-history)
			- [Manual Drive Sync](#manual-drive-sync)
			- [Enable/Disable Auto-Restore](#enabledisable-auto-restore)
		- [8. Library Settings Save Button (NEW)](#8-library-settings-save-button-new)
			- [Save All Settings](#save-all-settings)
	- [Consistency Rules](#consistency-rules)
		- [✅ CONSISTENT ACROSS BOTH INTERFACES](#-consistent-across-both-interfaces)
		- [⚠️ DIFFERENCES (BY DESIGN)](#️-differences-by-design)
	- [Testing Checklist](#testing-checklist)
	- [Implementation Notes](#implementation-notes)
		- [Adding New Settings Button](#adding-new-settings-button)
	- [File References](#file-references)

## Button Categories

### 1. Data Management Buttons

#### Export Library

- **Popup**: Not in popup (library-only feature)
- **Library Modal**: `export-btn` → `handleExport()`
  - Exports all novel data as JSON
  - Downloads file with timestamp
  - Uses `exportLibrary()` utility

#### Import Library

- **Popup**: Not in popup (library-only feature)
- **Library Modal**: `import-btn` → `import-file` input → `handleImport()`
  - Opens file picker for JSON import
  - Merges with existing data
  - Reloads UI after import

#### Clear Library

- **Popup**: Not in popup (library-only feature)
- **Library Modal**: `clear-btn` → `handleClearLibrary()`
  - Clears all novels from library
  - Requires confirmation
  - Resets UI state

---

### 2. Comprehensive Backup Buttons

These buttons have **identical behavior** across both interfaces:

#### Create Comprehensive Backup

- **Popup**: `createComprehensiveBackupBtn` (line 238)
  - Handler: Lines 5159-5185
  - Creates full backup with:
    - API keys (if `backupIncludeApiKeys` checked)
    - OAuth credentials (if `backupIncludeCredentials` checked)
    - All novels, settings, and configuration
  - Shows button state during creation: "⏳ Creating..." → "💾 Full Backup"
  - Downloads backup file automatically
  - Notification: `✅ Full backup downloaded (X novels)`

- **Library Modal**: `comprehensiveBackupBtn` (line 236)
  - Handler: `handleComprehensiveBackup()` (line 2855)
  - Creates full backup with:
    - Default: includes API keys and credentials
    - No user confirmation (simpler UX for modal)
  - Downloads backup file automatically
  - Notification: `✅ Comprehensive backup created successfully!`
  - **Consistency**: Both use same `createComprehensiveBackup()` function

#### Restore Comprehensive Backup

- **Popup**: `restoreComprehensiveBackupBtn` → `comprehensiveBackupFile` input (lines 239)
  - Handler: Lines 5187-5230
  - Shows detailed confirmation dialog with:
    - Backup version info
    - Novel count
    - API key status
    - Drive credentials status
    - Merge mode confirmation
  - Requires explicit user confirmation before restore
  - Notification: `✅ X items recovered`

- **Library Modal**: `comprehensiveRestoreBtn` → `comprehensiveRestoreFile` input (line 237)
  - Handler: `handleComprehensiveRestore()` (line 2873)
  - Shows detailed confirmation dialog with:
    - Creation timestamp
    - Novel count
    - Items included (APIs, prompts, drive settings)
    - Merge mode confirmation
  - Requires explicit user confirmation before restore
  - Reloads library, settings, and telemetry after restore
  - Notification: `✅ Backup restored! X items recovered.`
  - **Consistency**: Same format, slightly different message wording

---

### 3. Rolling Backup Toggle

#### Enable/Disable Rolling Backups

- **Popup**: `rollingBackupToggle` (line ~230)
  - Handler: Auto-saves via individual change listener
  - Saves to: `rg_rolling_backup_enabled`
  - Notification: "Rolling backups enabled" or "Rolling backups disabled"

- **Library Modal**: `rollingBackupToggle` (line 245)
  - Handler: Lines 1161-1171 (individual change listener)
  - Saves to: `rg_rolling_backup_enabled`
  - Notification: "Rolling backups enabled" or "Rolling backups disabled"
  - **Consistency**: ✅ Identical behavior

---

### 4. Model Settings (Popup Only)

These settings are in the **Popup Advanced Tab** only:

#### Save Advanced Settings

- **Location**: Popup Advanced Tab (lines 371-600)
- **Element**: `saveAdvancedSettings` button (line 238)
- **Handler**: Lines 1430-1455
- **Saves**:
  - Temperature (if customTemperature enabled)
  - TopP, TopK (if custom values)
  - Endpoint (if custom)
  - Font size
  - Prompt templates
  - Site toggle settings
- **Notification**: `✅ Settings saved successfully!`
- **Storage**: Direct to `browser.storage.local`

#### Reset All Advanced Settings

- **Location**: Popup Advanced Tab
- **Element**: `resetAllAdvanced` button (line 241)
- **Handler**: Lines 1463-1490
- **Resets**: Temperature, TopP, TopK, endpoint, fontSize, prompts, site toggles
- **Notification**: `✅ All settings reset to defaults`
- **Storage**: Direct to `browser.storage.local`

---

### 5. Theme Settings (Popup Only)

#### Save Theme

- **Location**: Popup Advanced Tab (🎨 Theme Settings section)
- **Handler**: Auto-saves on color change
- **Saves**: Theme mode, color values
- **Notification**: Auto-notification shown

#### Reset Theme

- **Location**: Popup Advanced Tab
- **Handler**: Resets all colors to defaults
- **Notification**: `✅ Theme reset to defaults`

---

### 6. Site Toggles (Popup Only)

#### Enable/Disable Sites

- **Location**: Popup Advanced Tab (🌐 Site Toggles section)
- **Handler**: Auto-saves individual site states
- **Saves**: `siteSettings` object

#### Restore Site Defaults

- **Location**: Popup Advanced Tab
- **Handler**: Resets all sites to default enabled state
- **Notification**: `✅ Site toggles restored to defaults`

---

### 7. Google Drive Buttons

#### Connect Drive (OAuth)

- **Popup**: `connectDriveBtn` (line 229)
  - Handler: Lines 4371-4500 (enhanced)
  - **Key Enhancement**: After OAuth succeeds:
    1. Sets `driveAutoRestoreEnabled: true`
    2. Triggers `syncDriveNow()` immediately
    3. Shows: `✅ Drive connected successfully!`
  - Creates initial backup automatically

#### Disconnect Drive

- **Popup**: `disconnectDriveBtn`
  - Handler: Removes OAuth credentials
  - Notification: `✅ Google Drive disconnected`

#### Manual Drive Backup

- **Popup**: `backupNowBtn` (line 4856)
  - Handler: Creates manual backup to Drive
  - Notification: `✅ Backup created on Drive`

#### View Backup History

- **Popup**: `viewBackupsBtn` (line 4859)
  - Handler: Fetches and displays Drive backup list
  - Shows timestamps and file sizes

#### Manual Drive Sync

- **Popup**: `driveSyncNowBtn`
  - Handler: Triggers `syncDriveNow()`
  - Notification: `✅ Drive sync completed`

#### Enable/Disable Auto-Restore

- **Popup**: `driveAutoRestoreToggle`
  - Handler: Saves `driveAutoRestoreEnabled` setting
  - Auto-saves on change

---

### 8. Library Settings Save Button (NEW)

#### Save All Settings

- **Location**: Library Settings Modal (line 825)
- **Element**: `settingsSaveBtn` (line 232)
- **Handler**: Lines 1108-1140 (just added)
- **Saves**:
  - `autoHoldEnabled` (from toggle)
  - `autoHoldDays` (from input)
  - `rg_rolling_backup_enabled` (from toggle)
  - `telemetryEnabled` (from toggle)
  - `sendErrorsEnabled` (from toggle)
  - `webhookUrl` (from input)
- **Notification**: `✅ All settings saved successfully!`
- **Purpose**: Batch save in case settings were modified but not saved
- **Note**: Individual settings already auto-save on change, so this is a safety button

---

## Consistency Rules

### ✅ CONSISTENT ACROSS BOTH INTERFACES

1. **Comprehensive Backup/Restore**
   - Uses same utility functions
   - Shows confirmation dialogs
   - Includes metadata validation
   - Same backup v2.0 format

2. **Rolling Backup Toggle**
   - Saves to same storage key
   - Same notification messages
   - Auto-saves on change

3. **Error Handling**
   - Both show error notifications
   - Both include error messages in notifications
   - Both use try/catch blocks

4. **User Confirmations**
   - Backup restore requires explicit confirmation
   - Clear library requires confirmation
   - Both show detailed info before proceeding

### ⚠️ DIFFERENCES (BY DESIGN)

1. **Save Buttons**
   - **Popup**: Explicit save button for model settings
   - **Library**: Individual auto-save + batch save button
   - **Reason**: Popup has many more settings requiring batch control

2. **Confirmations**
   - **Popup**: More detailed dialogs with more options
   - **Library**: Simpler dialogs focused on core action
   - **Reason**: Popup is advanced, library is simplified UI

3. **Notifications**
   - **Popup**: `showStatus()` with color coding
   - **Library**: `showNotification()` with emoji icons
   - **Reason**: Different UI frameworks

---

## Testing Checklist

- [ ] Comprehensive backup creates file in both locations
- [ ] Comprehensive restore loads file in both locations
- [ ] Rolling backup toggle auto-saves in both
- [ ] Library settings save button saves all 6 settings
- [ ] Auto-hold toggle saves immediately
- [ ] Auto-hold days validates minimum of 1
- [ ] All error notifications display properly
- [ ] All success notifications display properly
- [ ] Confirmations require explicit user action
- [ ] Settings persist after page reload
- [ ] Settings persist after browser restart

---

## Implementation Notes

### Adding New Settings Button

If adding a new settings button to library modal:

1. Add element to `library.html`: `<button id="my-setting-btn">...</button>`
2. Add element reference to `library.js` elements object: `mySettingBtn: document.getElementById("my-setting-btn")`
3. Add event listener after line 1140:

   ```javascript
   if (elements.mySettingBtn) {
       elements.mySettingBtn.addEventListener("click", async () => {
           try {
               // Perform action
               await browser.storage.local.set({ myKey: value });
               showNotification("✅ Success message", "success");
           } catch (error) {
               showNotification(`❌ Error: ${error.message}`, "error");
           }
       });
   }
   ```

4. Ensure storage key matches what loads in `loadLibrarySettings()`
5. Run build and test

---

## File References

- Advanced Tab HTML: [src/popup/popup.html](../src/popup/popup.html#L371)
- Advanced Tab Handlers: [src/popup/popup.js](../src/popup/popup.js#L1430)
- Library Settings HTML: [src/library/library.html](../src/library/library.html#L660)
- Library Settings Handlers: [src/library/library.js](../src/library/library.js#L1102)
- Backup Utilities: [src/utils/backup-utils.js](../src/utils/backup-utils.js)
