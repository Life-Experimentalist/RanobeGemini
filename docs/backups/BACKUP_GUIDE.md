# Quick Reference: Novels Tab & Library Backup

## Table of Contents

- [Quick Reference: Novels Tab \& Library Backup](#quick-reference-novels-tab--library-backup)
	- [Table of Contents](#table-of-contents)
	- [User Guide](#user-guide)
		- [Novels Tab Features](#novels-tab-features)
			- [1. Currently Reading](#1-currently-reading)
			- [2. Suggested Reads](#2-suggested-reads)
			- [3. Your Library](#3-your-library)
		- [Library Backup System](#library-backup-system)
			- [Creating Backups](#creating-backups)
			- [Restoring Backups](#restoring-backups)
			- [Managing Backups](#managing-backups)
		- [Backup Settings](#backup-settings)
		- [Technical Details](#technical-details)
			- [Backup Storage](#backup-storage)
			- [What Gets Backed Up](#what-gets-backed-up)
			- [What Doesn't Get Backed Up](#what-doesnt-get-backed-up)
			- [Merge Algorithm Details](#merge-algorithm-details)
		- [Troubleshooting](#troubleshooting)
		- [Tips \& Best Practices](#tips--best-practices)
		- [Keyboard Shortcuts](#keyboard-shortcuts)
		- [Status Messages](#status-messages)

## User Guide

### Novels Tab Features

#### 1. Currently Reading

- Shows novel you're currently reading
- Displays when you're on a novel page
- Shows title, author, status, and chapter count
- Updates automatically as you browse

#### 2. Suggested Reads

- AI-generated recommendations based on your reading history
- Suggests novels with similar genres/tags to recently read books
- Shows up to 5 recommendations
- Appears after you've read at least 2 novels

#### 3. Your Library

- Complete list of all novels in your library
- Grouped by website/domain
- Shows when each was last read
- Refresh button to update the list

### Library Backup System

#### Creating Backups

**Manual Backup:**
1. Go to Settings → Advanced → Library Backup & Restore
2. Click "📚 Create Backup Now"
3. See confirmation "Backup created: X novels backed up"
4. Backup appears in history below

**Automatic Backup:**
1. Enable "Enable automatic backups" checkbox
2. System creates a backup daily (once per 24 hours)
3. Oldest automatic backups are automatically deleted when limit (3) is reached

**Google Drive Sync (Cross-Browser):**
1. Settings → Advanced → Library Backup & Restore → Connect Google Drive
2. Set Backup Mode to **Continuous**
3. Enable **Auto-restore from Drive (merge latest)**
4. Repeat on your second browser with the same Google account

#### Restoring Backups

**Choose Merge Mode First:**
- **🔄 Smart Merge** (Recommended): Combines data intelligently
  - Keeps newer novels
  - Preserves your manual edits
  - Merges genres/tags

- **↩️ Replace Current**: Full restore
  - Overwrites all current data
  - Use if corrupted
  - WARNING: Loses current unsaved data

- **➕ Append Only**: Safe import
  - Adds only new novels
  - Never overwrites existing
  - Good for merging libraries

**To Restore:**
1. Select merge mode
2. Find backup in history
3. Click "Restore" button
4. Wait for completion message
5. Novel list updates automatically

#### Managing Backups

- **View Details**: Hover over backup entry
  - Date and time
  - Number of novels
  - Size in KB
  - (Auto) or (Manual) tag

- **Delete**: Click "Delete" button
  - Confirmation required
  - Cannot be undone
  - Makes room for new backups

- **Storage Limit**: Maximum 3 backups
  - Oldest automatic backups deleted first when full
  - Manual backups kept as long as possible

### Backup Settings

| Setting                  | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| Enable automatic backups | Schedule daily backups                     |
| Backup Location          | Where files are stored (info only)         |
| Create Backup Now        | Manual backup button                       |
| Restore Backup           | Opens restore process                      |
| Backup History           | View/manage all backups                    |
| Merge Mode               | Choose how to combine data                 |
| Drive Auto-restore       | Merge newest Drive backup every 10 minutes |
| Drive Backup Mode        | Scheduled / Continuous / Both              |

### Technical Details

#### Backup Storage

- Uses browser local storage (not in files yet)
- Max 3 backups kept at a time
- Metadata separate from backup data
- Version tracked for compatibility

#### What Gets Backed Up

- Novel titles and authors
- Reading status (reading/completed/etc)
- Last read timestamps
- Enhanced chapter counts
- Genres and tags
- Reading progress
- Cover URLs
- Novel descriptions

#### What Doesn't Get Backed Up

- Cache of enhanced content
- Debug logs
- API keys (stored separately)
- Settings/preferences

#### Merge Algorithm Details

**Smart Merge Logic:**

```markdown
For each novel in backup:
1. If not in current library
   → Add it completely
2. If already exists
   → Keep the newer version (by timestamp)
   → But keep any edits you made
   → Take the higher enhanced chapter count
   → Combine genres and tags
```

This means:
- You never lose manually created data
- Recent reading is always preserved
- Better information is kept
- No duplicate genres

**Example:**

```logs
Current: Novel "A" - last read Dec 15, enhanced 5 chapters
Backup: Novel "A" - last read Dec 20, enhanced 3 chapters
Result: Novel "A" - last read Dec 20, enhanced 5 chapters
         (newer timestamp + better edit count)
```

### Troubleshooting

| Issue                     | Solution                                |
| ------------------------- | --------------------------------------- |
| No suggestions appearing  | Read at least 2 novels, wait 10 seconds |
| Current novel not showing | Make sure you're on a supported site    |
| Can't create backup       | Check storage space in browser          |
| Backup disappeared        | Check if auto-rotate deleted it (max 3) |
| Restore didn't work       | Try "Replace Current" mode instead      |
| Data looks corrupted      | Use backup to restore clean version     |

### Tips & Best Practices

1. **Regular Backups**: Enable auto-backup for daily safety
2. **Test Restores**: Occasionally test restore to verify backups work
3. **Before Major Changes**: Create manual backup before bulk edits
4. **Review Merge Mode**: Choose appropriate mode for your use case
5. **Monitor Storage**: Check backup count (max 3)
6. **Export Important Data**: Consider downloading backups regularly
7. **Multiple Devices**: Backup before switching browsers/devices

### Keyboard Shortcuts

Currently available in main content, not popup:
- Ctrl+Alt+N: Open full library (from settings)

### Status Messages

**Success Messages:**
- "Backup created: X novels backed up" - Manual backup done
- "Backup restored with X mode!" - Restore complete
- "Backup deleted successfully!" - Delete complete

**Error Messages:**
- "Failed to create backup" - Storage issue
- "Failed to restore backup" - Data corruption
- "Error loading novels" - Content script not responding

---

**Version**: 1.0
**Last Updated**: December 20, 2025
**Backup System**: LibraryBackupManager
**Max Backups**: 3
**Auto-Backup Interval**: 24 hours
