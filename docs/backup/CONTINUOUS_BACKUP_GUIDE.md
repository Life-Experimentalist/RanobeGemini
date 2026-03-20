# Continuous Backup with Change Detection — Implementation Guide

## Overview

Your extension now features **intelligent continuous backup** that monitors your novel library for changes and automatically backs up to Google Drive whenever modifications are detected. The backup interval is **fully configurable** by the user (1-60 minutes).

## Table of Contents

- [Continuous Backup with Change Detection — Implementation Guide](#continuous-backup-with-change-detection--implementation-guide)
	- [Overview](#overview)
	- [Table of Contents](#table-of-contents)
	- [How It Works](#how-it-works)
		- [Change Detection System](#change-detection-system)
		- [When Backups Happen](#when-backups-happen)
	- [User Configuration](#user-configuration)
		- [UI Controls (Popup Settings)](#ui-controls-popup-settings)
			- [1. Backup Mode Radio Buttons](#1-backup-mode-radio-buttons)
			- [2. Check Interval Slider (appears when Continuous or Both is selected)](#2-check-interval-slider-appears-when-continuous-or-both-is-selected)
			- [3. Description](#3-description)
		- [Setting Persistence](#setting-persistence)
	- [Technical Architecture](#technical-architecture)
		- [Storage Keys](#storage-keys)
		- [Background Script Changes](#background-script-changes)
			- [New Constants](#new-constants)
			- [New Functions](#new-functions)
			- [Library Hash Algorithm](#library-hash-algorithm)
		- [Event Handling](#event-handling)
	- [Performance Considerations](#performance-considerations)
		- [CPU Usage](#cpu-usage)
		- [Network Usage](#network-usage)
		- [Storage](#storage)
	- [Configuration Examples](#configuration-examples)
		- [Light Usage (checks frequently)](#light-usage-checks-frequently)
		- [Balanced (default)](#balanced-default)
		- [Heavy Library Management](#heavy-library-management)
		- [Low Power / Slow Connection](#low-power--slow-connection)
	- [Error Handling](#error-handling)
		- [If Library Fetch Fails](#if-library-fetch-fails)
		- [If Backup Upload Fails](#if-backup-upload-fails)
		- [If Drive Disconnected](#if-drive-disconnected)
	- [UI Behavior](#ui-behavior)
		- [Initial State](#initial-state)
		- [When Continuous Selected](#when-continuous-selected)
		- [When Scheduled Selected](#when-scheduled-selected)
		- [Slider Input](#slider-input)
	- [Testing Checklist](#testing-checklist)
	- [Future Enhancements](#future-enhancements)
	- [Backward Compatibility](#backward-compatibility)

## How It Works

### Change Detection System

- **Library Hash**: The background script calculates a hash of your current library state on startup
- **Polling Loop**: Every N minutes (configurable, default 2 minutes), the system:
  1. Recalculates the library hash
  2. Compares it with the previous hash
  3. **If changes detected**: Immediately triggers a backup to Google Drive
  4. **If no changes**: Waits for the next check interval

### When Backups Happen

Continuous backups trigger automatically when:
- ✅ You **add a novel** to your library
- ✅ You **change reading status** (Reading → Completed, etc.)
- ✅ You **update notes** on a novel
- ✅ You **modify any metadata** (rating, last chapter read, etc.)
- ✅ You **delete a novel** from your library
- ❌ Nothing happens if the library hasn't changed

## User Configuration

### UI Controls (Popup Settings)

Located under **"Backup & Sync"** → **"Backup Mode"** section:

#### 1. Backup Mode Radio Buttons

- **Scheduled**: Daily automatic backups only
- **Continuous**: Change-detection backups only (appears below when selected)
- **Both**: Daily + change-detection backups

#### 2. Check Interval Slider (appears when Continuous or Both is selected)

- **Range**: 1 to 60 minutes
- **Default**: 2 minutes
- **Real-time update**: Slider shows current value as you adjust

#### 3. Description

```logs
Scheduled: Daily versions | Continuous: Detects changes every N minutes | Both: Daily + Continuous
```

### Setting Persistence

- User's chosen check interval is stored in `browser.storage.local`
- Persists across browser sessions
- Can be changed anytime without restarting extension

## Technical Architecture

### Storage Keys

```javascript
{
  "backupMode": "continuous" | "scheduled" | "both",
  "continuousBackupCheckIntervalMinutes": 1-60, // User-configurable
  "continuousBackupDelayMinutes": 5, // Legacy, kept for compatibility
}
```

### Background Script Changes

#### New Constants

```javascript
const CONTINUOUS_BACKUP_CHECK_ALARM_NAME = "ranobe-gemini-continuous-backup-check";
const CONTINUOUS_BACKUP_CHECK_DEFAULT_INTERVAL_MINUTES = 2;
```

#### New Functions

- `getLibraryHash()`: Calculates hash of current library state
- `hasLibraryChanged()`: Compares current hash with stored hash
- `scheduleContinuousBackupCheck()`: Sets up polling interval loop

#### Library Hash Algorithm

- Uses simple 32-bit hash of stringified library JSON
- Fast and lightweight
- Detects any change to any novel property

### Event Handling

When backup mode changes:
1. Storage listener detects change
2. Calls `scheduleContinuousBackupCheck()` to reschedule
3. Shows/hides the check interval slider in UI

## Performance Considerations

### CPU Usage

- **Minimal**: Hash calculation is fast (few milliseconds)
- **Interval-based**: Only checks when timer fires, not continuous polling
- **No impact** when interval is set high (e.g., 30-60 minutes)

### Network Usage

- **Only on change**: Backup only uploads when library changes
- **Minimal bandwidth**: JSON backups are 50KB-500KB each
- **No redundant uploads**: Same hash prevents duplicate backups

### Storage

- Existing backup retention policies apply
- "Ranobe Gemini Backups" folder continues to hold all backups
- User can manually delete old backups to reclaim space

## Configuration Examples

### Light Usage (checks frequently)

- **Interval**: 2 minutes
- **Use case**: Active reading, want immediate backups
- **CPU impact**: Negligible

### Balanced (default)

- **Interval**: 2-5 minutes
- **Use case**: Regular reading with occasional changes
- **Best for**: Most users

### Heavy Library Management

- **Interval**: 1 minute
- **Use case**: Bulk importing, organizing multiple novels
- **CPU impact**: Still very light

### Low Power / Slow Connection

- **Interval**: 15-30 minutes
- **Use case**: Mobile users, limited bandwidth
- **Trade-off**: Slight delay before changes are backed up

## Error Handling

### If Library Fetch Fails

- Hash calculation returns `null`
- Change detection skips this cycle
- Retries on next interval
- No exception thrown, continues normally

### If Backup Upload Fails

- Error is logged to console (debugError)
- Timer continues, retries on next change detection
- Doesn't stop the polling loop

### If Drive Disconnected

- Polling continues but backups fail silently
- When reconnected, next change triggers backup immediately

## UI Behavior

### Initial State

- Container hidden (display: none)
- Radio buttons visible

### When Continuous Selected

```javascript
continuousContainer.style.display = "block";
```

- Slider appears
- Shows current interval value
- Real-time updates as you adjust

### When Scheduled Selected

```javascript
continuousContainer.style.display = "none";
```

- Slider hidden
- Continuous checks disabled
- Only daily scheduled backups run

### Slider Input

- **Range**: `<input type="range" min="1" max="60">`
- **Both** change and input events trigger handler
- Display updates immediately (no page refresh needed)

## Testing Checklist

✅ Add a novel → Should back up within configured interval
✅ Change status (Reading → Completed) → Should back up immediately
✅ Change interval slider → Should update display and reschedule
✅ Switch to Scheduled mode → Should hide slider, disable continuous checks
✅ Switch back to Continuous → Should show slider, resume checks
✅ Disconnect Drive → Continuous checks continue (backups fail silently)
✅ Reconnect Drive → Next change triggers backup
✅ Change multiple novels in quick succession → Only one backup after check interval
✅ Wait longer than interval without changes → No backup (correct behavior)

## Future Enhancements

Possible improvements:
- 📊 Show last backup timestamp in UI
- 🔔 Notification when backup completes
- 📈 Backup statistics (frequency, size, errors)
- ⏱️ Manual "backup now" button with status indicator
- 🎯 "Back up in X seconds" countdown display
- 🧹 Auto-cleanup of old backups beyond retention limit

## Backward Compatibility

- Existing `continuousBackupDelayMinutes` setting preserved (unused)
- Old backups remain accessible
- Settings migration automatic on first update
- No breaking changes to existing backup files
