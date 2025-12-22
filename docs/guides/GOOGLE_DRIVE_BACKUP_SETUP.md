# Google Drive Backup Setup Guide

This guide explains how to set up Google Drive backups for Ranobe Gemini, enabling automatic backup of your novel library to Google Drive (like WhatsApp backups).

## Overview

The backup system provides:
- **Automatic daily backups** to Google Drive
- **Continuous mode** for always-on backup after library changes (5-minute debounce)
- **Version history** with automatic cleanup (keeps the latest 3 Drive backups + 1 rolling continuous file)
- **One-click restore** from any previous backup
- **Secure OAuth 2.0 authentication** with PKCE
- **Scope isolation** - Only app-created files (safest for users)

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project"
3. Name it (e.g., "Ranobe Gemini Backup")
4. Click "Create"

## Step 2: Enable Google Drive API

1. In the left sidebar, click "APIs & Services" → "Library"
2. Search for **"Google Drive API"**
3. Click on it and select **"Enable"**
4. Wait for it to enable (should be quick)

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → **"Credentials"**
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
3. If prompted, first configure the OAuth consent screen:
   - Click **"Configure Consent Screen"**
   - Choose **"External"** for user type
   - Fill in:
     - **App name**: "Ranobe Gemini"
     - **User support email**: your email
     - **Developer contact**: your email
   - Click **"Save and Continue"** → **"Save and Continue"** → **"Save and Continue"**
   - Go back to Credentials

4. Click **"+ Create Credentials"** → **"OAuth client ID"** again
5. Select **"Web application"**
6. Add Authorized JavaScript origins (to host the landing OAuth page):

   ```
   https://ranobe.vkrishna04.me
   ```

7. Add Redirect URIs (important for different browsers):

   ### For Chrome/Edge:
   ```
   https://YOUR_EXTENSION_ID.chromiumapp.org/
   ```

   ### For Firefox:
   ```
   urn:ietf:wg:oauth:2.0:oob
   ```

   **Note**: You can find your extension ID in:
   - **Chrome**: `chrome://extensions/` (in Developer mode)
   - **Edge**: `edge://extensions/` (in Developer mode)
   - **Firefox**: `about:debugging#/runtime/this-firefox` (look for the UUID)

8. Click **"Create"**

## Step 4: Copy Your Client ID

You should see a modal with:
```
Client ID: 123456789-xxxxxxxxxxxxx.apps.googleusercontent.com
Client Secret: (not needed for this implementation)
```

**Copy the Client ID** - you'll need this for the extension.

## Step 5: Configure Extension

### Option A: Use Default Client ID (Easiest)
If you're using the bundled Client ID in the extension, you're done! The extension comes with a default Client ID that works for Chrome/Edge/Firefox.

### Option B: Use Your Own Client ID (Recommended for Private Builds)
1. Open the extension popup (click Ranobe Gemini icon)
2. Go to **Settings** tab
3. Find **"Google Drive Client ID"**
4. Paste your Client ID from Step 4
5. Click **"Save"**

## Step 6: First Backup

1. Open the extension popup
2. Go to **Backup** tab
3. Check **"Backup Mode"**:
   - **Scheduled**: Daily backup at your chosen time
   - **Continuous**: Real-time backup after library changes
4. Click **"Connect Google Drive"**
5. Google will ask for permission to access files created by this app
   - Click **"Allow"**
6. The extension automatically creates a folder called **"Ranobe Gemini Backups"** on your Drive and keeps the newest 3 backups plus a single rolling continuous backup file

## Step 7: Restore from Backup

1. Open extension popup
2. Go to **Backup** tab
3. Click **"View Backups"**
4. Select a backup from the list
5. Click **"Restore"**
6. Confirm the restore (this replaces your current library)

## Backup Modes Explained

### Scheduled Mode
- Backs up automatically at your chosen time (default: 2 AM)
- Keeps the latest 3 scheduled backups (oldest is pruned automatically)
- Less frequent → smaller Drive quota usage
- Good for users who don't add many novels

**Setting**: Daily backup time (e.g., 2:00 AM)

### Continuous Mode
- Uploads backup whenever you change your library (add/remove novels, change tags, etc.)
- Uses a single rolling file that gets updated (no extra Drive clutter)
- Has 5-minute debounce (won't upload more than once every 5 minutes)
- Great for users who actively manage library
- Real-time protection against data loss

**Setting**: Automatic

## Configuration Options

### In Extension Settings:

| Setting             | Default   | Description                                                      |
| ------------------- | --------- | ---------------------------------------------------------------- |
| Backup Mode         | Scheduled | Choose scheduled or continuous                                   |
| Backup Time         | 2:00 AM   | When to run daily backup (scheduled mode only)                   |
| Drive Retention     | Fixed 3   | Drive keeps the latest 3 backups automatically (plus continuous) |
| Google Drive Folder | Auto      | Auto-created "Ranobe Gemini Backups" folder                      |
| Client ID           | Built-in  | Your Google OAuth Client ID                                      |

### Command-Line / Manual:

All settings are stored in `browser.storage.local` with keys:
- `backupMode` - "scheduled" or "continuous"
- `backupScheduleHour` - Hour of day (0-23) for scheduled backups
- `backupRetentionDays` - Days to keep local file backups (Drive keeps 3 automatically)
- `driveFolderId` - Auto-created backup folder ID
- `driveClientId` - Your OAuth Client ID
- `driveAuthTokens` - Tokens (managed automatically)

## Troubleshooting

### "Client ID missing" Error
- Make sure you added your Client ID in Settings
- Or use the default built-in Client ID

### "State mismatch" Error
- Your browser was redirected during OAuth
- Try again, or check that your redirect URIs match exactly

### "Folder creation failed"
- Make sure Google Drive API is enabled in your Google Cloud project
- Check that your OAuth scopes include `https://www.googleapis.com/auth/drive.file`

### Backups Not Uploading
- Check that you clicked "Connect Google Drive" and authorized
- Check that you have free space in Google Drive
- Check extension logs: `F12` → `Extensions` tab → Ranobe Gemini → check background errors

### Can't Restore from Backup
- Make sure you're logged into the same Google account
- Check that the backup file still exists in your Google Drive (hasn't been deleted/moved)
- Try downloading the backup file manually from Drive to verify it's not corrupted

## Security Notes

1. **OAuth Scopes**: The extension only requests `https://www.googleapis.com/auth/drive.file`
   - Can only create/modify/delete files *created by this app*
   - Cannot access other files on your Drive
   - Cannot share files or change permissions
   - `drive.appdata` is intentionally avoided here so backups remain visible/downloadable to you

2. **Token Storage**: Tokens are stored encrypted in browser's local storage
   - Firefox: Encrypted by browser
   - Chrome: Managed by browser's storage API

3. **No Server**: All uploads go directly to Google Drive
   - No intermediary servers
   - No one else can access your backups

4. **Revoke Access Anytime**:
   - Open extension popup → Settings → "Disconnect Google Drive"
   - Or revoke at [Google Account Permissions](https://myaccount.google.com/permissions)

## Advanced: Custom Google Cloud Project

If you're building a private extension or releasing to stores, consider:

1. Create your own Google Cloud project (steps above)
2. Submit for OAuth consent screen approval (usually instant for simple apps)
3. Update `DEFAULT_DRIVE_CLIENT_ID` in [src/utils/constants.js](../../src/utils/constants.js)
4. Build and release your custom version

This way:
- You control the credentials
- Users see your app name in Google permissions
- You can customize OAuth prompts

## Architecture

```
User Opens Popup
    ↓
User Clicks "Connect Drive" or Enables Backup
    ↓
popup.js requests oauth-redirect.html in new window
    ↓
oauth-redirect.html detects extension and redirects to extension library
    ↓
Extension receives OAuth token via postMessage
    ↓
popup.js stores token in browser.storage.local
    ↓
background.js uses token to:
    - Create/get "Ranobe Gemini Backups" folder
   - Upload library as versioned JSON files
   - Keep the newest 3 backups (plus a rolling continuous file)
    - Listen to library changes for continuous mode
    ↓
User can restore from any backup in popup UI
```

## OAuth Flow Details

The implementation uses:
- **PKCE** (Proof Key for Code Exchange) for security without server backend
- **Google's OAuth 2.0** with `authorization_code` grant
- **Automatic token refresh** when expired
- **Browser-native `identity.launchWebAuthFlow`** (no extra libraries)

Tokens are stored with:
- `access_token` - Used for API calls
- `refresh_token` - Used to get new access tokens when expired
- `expires_at` - Timestamp when token expires
- `token_type` - Usually "Bearer"

## Files Involved

- [landing/oauth-redirect.html](../../landing/oauth-redirect.html) - OAuth receiver page
- [src/utils/drive.js](../../src/utils/drive.js) - Drive API wrapper
- [src/background/background.js](../../src/background/background.js) - Backup scheduler
- [src/popup/popup.js](../../src/popup/popup.js) - Popup UI logic
- [src/utils/constants.js](../../src/utils/constants.js) - Configuration
