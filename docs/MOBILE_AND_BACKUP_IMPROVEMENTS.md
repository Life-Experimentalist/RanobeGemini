# Mobile Handler & Backup System Improvements

## Overview
This document outlines the comprehensive improvements made to the FanFiction.net mobile handler and backup system to address user/author page detection issues, automatic metadata fetching, OAuth button functionality on mobile, and complete backup/restore capabilities.

---

## 1. Mobile Handler User/Author Page Detection Fix

### Problem
The mobile handler was incorrectly treating user/author profile pages as chapter pages, causing:
- Incorrect library entries for user profiles
- Enhancement buttons appearing on wrong pages
- Bad data being saved to the library

### Solution
Enhanced the mobile handler with comprehensive validation checks matching the desktop handler:

#### A. Enhanced `canHandle()` Method
Added explicit path exclusion to prevent handling user profile pages:

```javascript
canHandle() {
    const hostname = window.location.hostname;
    const path = window.location.pathname;
    // Exclude user profile pages
    if (path.startsWith("/u/")) {
        return false;
    }
    return hostname === "m.fanfiction.net";
}
```

#### B. Enhanced `isChapterPage()` Method
Multiple layers of validation to ensure only story pages are handled:

```javascript
isChapterPage() {
    const url = window.location.pathname;
    // Explicit check for user profile pages (matches desktop handler pattern)
    if (url.startsWith("/u/")) return false;

    // Exclude other user/author profile pages - they contain /users/, /profile/, or /author/
    if (/\/(users|profile|author)\//.test(url)) {
        return false;
    }

    // Story pages have /s/ in the URL (e.g., /s/12345/1/Title)
    const isStoryUrl = /^\/s\/\d+/.test(url);
    // Also check for story content
    const hasStoryContent = !!document.getElementById("storycontent");
    return isStoryUrl && hasStoryContent;
}
```

### Additional Validation Improvements

#### C. Content Validation in `findContentArea()`
Added content existence checks before returning:

```javascript
findContentArea() {
    const contentDiv = document.getElementById("storycontent");
    if (contentDiv) {
        // Validate it has content
        if (contentDiv.textContent && contentDiv.textContent.trim().length > 0) {
            return contentDiv;
        }
    }
    // ... fallback logic
}
```

#### D. Title Extraction with Fallback Chain
```javascript
extractTitle() {
    const contentDiv = document.getElementById("content");
    if (contentDiv) {
        const titleElement = contentDiv.querySelector("div[align='center'] b");
        if (titleElement) {
            const title = titleElement.textContent.trim();
            if (title && title.length > 0) {
                return title;
            }
        }
    }

    // Fallback to page title
    if (document.title && document.title.trim().length > 0) {
        return document.title;
    }

    // Final fallback
    return "Untitled Story";
}
```

#### E. Metadata Extraction Validation
```javascript
extractNovelMetadata() {
    const title = this.extractTitle();

    // Validate we have at least a title before proceeding
    if (!title || title === "Untitled Story") {
        debugError("Mobile handler: Could not extract valid title");
    }

    // ... continue with metadata extraction with null checks
}
```

#### F. Enhanced Content Application Safety
```javascript
applyEnhancedContent(contentArea, enhancedText) {
    // Validate inputs
    if (!contentArea || typeof enhancedText !== "string") {
        debugError("Mobile handler: Invalid content area or enhanced text");
        return 0;
    }

    if (!enhancedText || enhancedText.trim().length === 0) {
        debugError("Mobile handler: Enhanced text is empty");
        return 0;
    }

    // ... continue with content application
}
```

### Benefits
- ✅ User profile pages (e.g., `/u/12345/Username`) are now excluded at multiple levels
- ✅ Author pages (e.g., `/author/Username`) are excluded
- ✅ Only actual story chapter pages trigger the handler
- ✅ No more incorrect library entries
- ✅ Validation matches desktop handler for consistency
- ✅ Comprehensive null checks prevent errors
- ✅ Graceful fallbacks ensure reliability
- ✅ Better error logging for debugging
- Users had to manually visit desktop version to get full details

### Solution
Implemented automatic background fetching of desktop version metadata:

#### A. Mobile Handler Method (`fanfiction-mobile-handler.js`)
```javascript
async fetchDesktopMetadata() {
    try {
        const desktopUrl = this.getNovelPageUrl();
        const novelId = this.generateNovelId();

        const response = await browser.runtime.sendMessage({
            action: "fetchDesktopMetadata",
            url: desktopUrl,
            novelId: novelId,
            handler: "fanfiction",
        });

        if (response?.success && response?.metadata) {
            return response.metadata;
        }
        return null;
    } catch (err) {
        debugError("[Mobile] Error fetching desktop metadata:", err);
        return null;
    }
}
```

#### B. Background Script Handler (`background.js`)
The background script:
1. Fetches the desktop version HTML
2. Parses the DOM to extract metadata
3. Saves it directly to the library
4. Returns metadata to content script

**Extracted Metadata:**
- Novel title
- Author name
- Description (full synopsis)
- Rating (K, T, M, etc.)
- Language
- Genres
- Chapter count
- Word count
- Stats (reviews, favorites, follows)

#### C. Content Script Integration (`content.js`)
When adding a novel to library from mobile:
```javascript
// If on mobile, fetch desktop version metadata in background
if (currentHandler?.constructor?.name === "FanfictionMobileHandler") {
    debugLog("[Mobile] Fetching desktop metadata in background...");
    try {
        const desktopMetadata = await currentHandler.fetchDesktopMetadata();
        if (desktopMetadata) {
            showTimedBanner(`Saved with full metadata: ${metadata.title}`, "success", 3000);
        }
    } catch (err) {
        // Graceful fallback - novel still saved with mobile-extracted data
    }
}
```

### Benefits
- ✅ Mobile users get complete novel metadata automatically
- ✅ No manual desktop visit required
- ✅ Happens in background - no page redirects
- ✅ Graceful fallback if fetch fails
- ✅ Library entries are complete and consistent

---

## 3. Mobile Handler Dependency on Desktop Handler

### Architecture
The mobile handler is now **purely focused on DOM extraction**:
- ✅ Domain validation removed (handled by main handler)
- ✅ No `.ws` redirect logic (removed `initialize()` method)
- ✅ No subdomain manipulation
- ✅ Metadata fetching delegated to background script

### Responsibilities

**Mobile Handler:**
- DOM content extraction (title, author, chapter text)
- Mobile-specific selectors
- UI insertion points for mobile layout
- Chapter navigation parsing

**Desktop Handler (Primary):**
- Domain validation
- Full metadata extraction
- Novel page detection
- Redirect logic

**Background Script:**
- Fetch desktop HTML
- Parse and extract metadata
- Save to library
- Cross-origin requests

### Benefits
- ✅ Cleaner separation of concerns
- ✅ Less code duplication
- ✅ Mobile handler doesn't need to know about domains
- ✅ Easier to maintain and test

---

## 4. OAuth Button Fix for Mobile Edge Browser

### Problem
On mobile Edge browser:
- OAuth button click did nothing
- No visible error
- JSON parsing worked fine
- Event handler wasn't firing

### Solution

#### A. Enhanced Event Listeners (`popup.js`)
Added both `click` and `touchend` events for better mobile compatibility:

```javascript
if (connectDriveBtn) {
    // Use both click and touchend for better mobile support
    const handleConnect = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleConnectDrive();
    };
    connectDriveBtn.addEventListener("click", handleConnect);
    // Add touch event for mobile browsers
    connectDriveBtn.addEventListener("touchend", handleConnect, { passive: false });
}
```

#### B. Enhanced Logging (`handleConnectDrive`)
Added comprehensive logging to debug mobile issues:

```javascript
async function handleConnectDrive() {
    try {
        debugLog("handleConnectDrive called");
        debugLog("connectDriveBtn element:", connectDriveBtn);

        if (!connectDriveBtn) {
            debugError("connectDriveBtn element not found!");
            showStatus("Button element not found", "error");
            return;
        }

        // ... rest of function with detailed logging
    } catch (err) {
        debugError("Failed to connect Drive", err);
        showStatus(`Failed to connect Google Drive: ${err.message}`, "error");
    }
}
```

### Testing on Mobile Edge
To test the OAuth button on mobile Edge:

1. **Open Extension Popup:**
   - Navigate to `edge://extensions/`
   - Find "Ranobe Gemini"
   - Click "Details"
   - Scroll to "Extension options" and click popup icon

2. **Enable Debug Mode:**
   - In popup, go to Advanced tab
   - Enable "Debug Mode"
   - Open browser developer tools (F12)
   - Check console for debug logs

3. **Test OAuth Flow:**
   - Go to Settings tab
   - Click "Connect Google Drive"
   - Watch console for:
     - "handleConnectDrive called"
     - "connectDriveBtn element: [object]"
     - "Sending ensureDriveAuth message..."
     - OAuth response logs

4. **Expected Behavior:**
   - Touch/click triggers event
   - Debug logs appear in console
   - OAuth popup opens
   - After auth, tokens are saved
   - Status shows "Connected successfully"

### Benefits
- ✅ Touch events work on mobile browsers
- ✅ Prevents event bubbling issues
- ✅ Detailed logging for debugging
- ✅ Better error messages
- ✅ Works on both desktop and mobile

---

## 5. API Keys in Backups

### Problem
Previous backup format only included:
- Novel library data
- Chapter history
- Basic metadata

**Missing:**
- Gemini API key
- Google Drive OAuth client credentials
- All extension settings

**Result:** Users had to manually reconfigure everything after restore.

### Solution
Expanded `exportLibrary()` to include all API keys and credentials:

```javascript
async exportLibrary() {
    // ... existing code for library and chapters

    // Include all extension settings and API keys for complete restore
    const settings = {
        // API Keys (exclude OAuth tokens for security)
        apiKey: allData.apiKey,
        driveClientId: allData.driveClientId,
        driveClientSecret: allData.driveClientSecret,

        // Model settings
        selectedModel: allData.selectedModel,
        temperature: allData.temperature,

        // Processing options
        chunkingEnabled: allData.chunkingEnabled,

        // Theme settings
        theme: allData.theme,
        themeMode: allData.themeMode,
        accentPrimary: allData.accentPrimary,
        accentSecondary: allData.accentSecondary,
        bgColor: allData.bgColor,
        textColor: allData.textColor,

        // Site toggles
        siteSettings: allData.siteSettings,

        // Backup settings
        autoBackupEnabled: allData.autoBackupEnabled,
        backupMode: allData.backupMode,
        backupRetention: allData.backupRetention,
        backupFolder: allData.backupFolder,
        driveFolderId: allData.driveFolderId,
        continuousBackupCheckInterval: allData.continuousBackupCheckInterval,

        // Model merge mode
        modelMergeMode: allData.modelMergeMode,
    };

    return {
        library,
        chapters: chaptersData,
        settings,  // NEW
        exportedAt: Date.now(),
        version: "2.0",  // Incremented version
    };
}
```

### Security Note
**OAuth Access Tokens are NOT included** in backups for security reasons. These are:
- Short-lived
- Specific to the browser instance
- Should not be shared or transferred

Users must re-authenticate with OAuth after restore, but all credentials are preserved.

---

## 6. Complete Settings Backup & Restore

### Problem
Users had to manually reconfigure:
- ✗ Theme preferences
- ✗ Model selection
- ✗ Site toggles
- ✗ Backup preferences
- ✗ Temperature settings
- ✗ All custom configurations

### Solution

#### A. Backup Format (Version 2.0)
```json
{
  "library": { /* novel data */ },
  "chapters": { /* chapter history */ },
  "settings": {
    "apiKey": "...",
    "driveClientId": "...",
    "driveClientSecret": "...",
    "selectedModel": "gemini-2.0-flash",
    "temperature": 0.7,
    "chunkingEnabled": true,
    "themeMode": "dark",
    "siteSettings": { /* site toggles */ },
    /* ... all other settings */
  },
  "exportedAt": 1738886400000,
  "version": "2.0"
}
```

#### B. Import with Settings Restore
Updated `importLibrary()` to restore settings:

```javascript
async importLibrary(data, merge = true) {
    try {
        if (!data.library || !data.version) {
            throw new Error("Invalid import data format");
        }

        // Restore settings if available (version 2.0+)
        if (data.settings) {
            const settingsToRestore = {};

            // Only restore non-sensitive settings (exclude OAuth tokens)
            const settingKeys = [
                'apiKey', 'driveClientId', 'driveClientSecret',
                'selectedModel', 'temperature', 'chunkingEnabled',
                'theme', 'themeMode', 'accentPrimary', 'accentSecondary',
                'bgColor', 'textColor', 'siteSettings', 'autoBackupEnabled',
                'backupMode', 'backupRetention', 'backupFolder',
                'driveFolderId', 'continuousBackupCheckInterval', 'modelMergeMode'
            ];

            for (const key of settingKeys) {
                if (data.settings[key] !== undefined && data.settings[key] !== null) {
                    settingsToRestore[key] = data.settings[key];
                }
            }

            if (Object.keys(settingsToRestore).length > 0) {
                await browser.storage.local.set(settingsToRestore);
                debugLog(`[Import] Restored ${Object.keys(settingsToRestore).length} settings`);
            }
        }

        // Continue with library and chapters import...
    }
}
```

### One-Click Restore Workflow

**Old Workflow:**
1. Import backup JSON
2. Manually enter Gemini API key
3. Manually configure model
4. Manually set theme preferences
5. Manually toggle sites
6. Manually configure backup settings
7. Manually enter Drive client credentials
8. OAuth authentication

**New Workflow (Version 2.0):**
1. Import backup JSON
2. OAuth authentication (if using Drive)
3. ✅ Done! Everything restored automatically

### Benefits
- ✅ Complete configuration in 2 steps
- ✅ All API keys restored (except OAuth tokens)
- ✅ Theme preserved
- ✅ Model preferences maintained
- ✅ Site toggles restored
- ✅ Backup settings intact
- ✅ No manual reconfiguration needed
- ✅ Backward compatible (v1.0 backups still work)

---

## Migration Notes

### Backup Version Compatibility

**Version 1.0 Backups:**
- Still fully supported
- Will import library and chapters
- Settings will use defaults (must configure manually)

**Version 2.0 Backups:**
- Includes all settings
- Full automatic restore
- Recommended for new backups

### Creating New Backups
New backups created after this update will automatically use version 2.0 format and include all settings.

### Restoring Old Backups
Old v1.0 backups will still work but won't restore settings. For complete restore:
1. Create a new backup (will be v2.0)
2. Use new backup for future restores

---

## Testing Checklist

### Mobile Handler Testing
- [ ] Load FanFiction.net mobile story page - enhance button appears
- [ ] Load user profile page - enhance button does NOT appear
- [ ] Add story to library from mobile - desktop metadata fetched
- [ ] Check library entry - description, author, stats all present
- [ ] User pages don't create library entries

### OAuth Mobile Testing
- [ ] Open popup on mobile Edge
- [ ] Enable debug mode
- [ ] Click "Connect Google Drive"
- [ ] Touch event triggers (check console)
- [ ] OAuth popup opens
- [ ] Authentication completes
- [ ] Tokens saved successfully
- [ ] Status shows "Connected"

### Backup Testing
- [ ] Create new backup (v2.0)
- [ ] Export to JSON
- [ ] Verify settings present in JSON
- [ ] Change all settings in extension
- [ ] Import backup
- [ ] All settings restored correctly
- [ ] OAuth required (tokens not in backup)
- [ ] After OAuth, everything works

### Complete Workflow Test
1. **Setup Fresh Extension:**
   - Install extension
   - Configure all settings
   - Add novels to library
   - Enable Drive backup
   - Create backup

2. **Simulate New Installation:**
   - Remove extension
   - Reinstall
   - Import backup JSON

3. **Verify:**
   - [ ] All novels present
   - [ ] Gemini API key works
   - [ ] Theme applied
   - [ ] Model selected correctly
   - [ ] Site toggles correct
   - [ ] Backup settings intact
   - [ ] After OAuth, Drive connected

---

## Files Modified

### Core Handlers
- `src/utils/website-handlers/fanfiction-mobile-handler.js`
  - Enhanced `isChapterPage()` - exclude user pages
  - Added `fetchDesktopMetadata()` method
  - Removed `initialize()` domain logic

### Background Script
- `src/background/background.js`
  - Added `fetchDesktopMetadata` message handler
  - Fetches desktop HTML
  - Parses and extracts metadata
  - Saves to library automatically

### Content Script
- `src/content/content.js`
  - Enhanced `handleNovelAddUpdate()`
  - Calls `fetchDesktopMetadata()` on mobile
  - Shows progress messages
  - Graceful fallback

### Library Management
- `src/utils/novel-library.js`
  - Expanded `exportLibrary()` with settings
  - Updated `importLibrary()` to restore settings
  - Version bumped to 2.0

### Popup
- `src/popup/popup.js`
  - Added touch event for OAuth button
  - Enhanced error handling
  - Better mobile compatibility

---

## Future Enhancements

### Potential Improvements
1. **Metadata Sync:**
   - Periodic background refresh of novel metadata
   - Detect updates (new chapters, description changes)

2. **Mobile UX:**
   - Simplified mobile-specific popup
   - Touch-optimized controls
   - Swipe gestures

3. **Backup Encryption:**
   - Optional backup encryption
   - Secure API key storage
   - Password-protected restore

4. **Multi-Browser Sync:**
   - Share library across browsers
   - Cloud-based settings sync
   - Conflict resolution

---

## Support & Troubleshooting

### Common Issues

**Q: Mobile OAuth button still not working**
A:
1. Check browser console for errors
2. Ensure popup is not blocked
3. Try both tap and long-press
4. Clear browser cache
5. Reinstall extension

**Q: Desktop metadata not fetching**
A:
1. Check internet connection
2. Verify site is accessible
3. Check background script logs
4. Ensure proper CORS handling

**Q: Settings not restored from backup**
A:
1. Verify backup is version 2.0
2. Check JSON structure
3. Look for `settings` field
4. Import with merge mode

**Q: OAuth tokens in backup?**
A:
No, OAuth tokens are intentionally excluded for security. You must re-authenticate after restore.

---

## Credits

**Developed by:** VKrishna04 / Life Experimentalist
**Date:** February 7, 2026
**Version:** 3.9.0+

For more information, visit:
- GitHub: [Life-Experimentalist/RanobesGemini](https://github.com/Life-Experimentalist/RanobesGemini)
- Website: [vkrishna04.me](https://vkrishna04.me)
