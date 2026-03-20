# Google Drive Backup & Firefox OAuth Fixes - Summary

## Changes Implemented

### 1. ✅ Auto-Refresh Backup List After "Backup Now"
**Location**: `src/library/library-settings.js` (Backup button handler)

When you click **"📤 Backup Now"**, the backup list now automatically refreshes after 500ms to show the newly created backup without requiring a manual page reload.

```javascript
if (response?.success) {
    showToast("✅ Backed up to Google Drive!", "success");
    // Auto-refresh the backup list after successful backup
    setTimeout(() => loadDriveBackupsList(), 500);
}
```

**Result**: After backing up, you'll immediately see your new backup appear in the list.

---

### 2. ✅ Token Revocation Detection & Reconnect Banner
**Location**: `src/library/library-settings.js` (updateDriveUI function)

When Google Drive access is revoked or tokens expire:
- A **red banner** appears with message: "⛔ Google Drive access was revoked"
- **"🔐 Reconnect Google Drive"** button is shown for easy re-authentication
- Status shows **"🔴 Access Revoked"** instead of generic "Auth failed"

```javascript
if (isRevoked) {
    // Show revocation banner with reconnect button
    authErr.innerHTML = `
        <div style="background:#fca5a5;border:2px solid #dc2626;...">
            <button class="ls-btn ls-btn-primary" id="reconnectDriveBtn">
                🔐 Reconnect Google Drive
            </button>
        </div>
    `;
}
```

**Result**: Clear, actionable error messaging when you need to reconnect.

---

### 3. ✅ Firefox OAuth Issue Documentation & In-App Guidance
**Locations**:
- `src/library/library-settings.js` (Redirect URI section)
- `docs/guides/FIREFOX_GOOGLE_DRIVE_OAUTH.md` (New guide)

### What's the Issue?

When you login in **Firefox**, you see:
- **"Login to Alizom"** ❌ (instead of "Ranobe Gemini")

When you login in **Edge**, you see:
- **"Login to Ranobe Gemini"** ✅

### Why?

Firefox uses a different OAuth redirect domain format:
- **Firefox**: `https://alizomXXXXX.extensions.allizom.org/`
- **Edge/Chrome**: `https://[extension-id].chromiumapp.org/`

**This is NOT a bug. It's a Firefox security design.** The login is fully secure and will work correctly once your redirect URI is registered in Google Cloud Console.

### In-App Firefox Warning

The Library Settings page now shows a warning **only in Firefox**:

```
⚠️ Firefox Note: Google Cloud may show "Alizom" instead of the app name.
This is a Firefox extension system limitation. Make sure the redirect URI
above is registered in Google Cloud Console OAuth for logins to work.
```

### How to Fix for Firefox

1. **Open**: Library Settings → Backups Tab
2. **Copy**: Your Redirect URI (the Firefox-specific one starting with `https://alizom...`)
3. **Go to**: [Google Cloud Console](https://console.cloud.google.com/)
4. **Find**: Your project → APIs & Services → Credentials
5. **Edit**: OAuth 2.0 Client ID (type: Web)
6. **Add** to "Authorized redirect URIs":
   ```
   https://alizomcf6xpjzb6r67ojzddh3dv53vvb.extensions.allizom.org/
   https://magcpgkibkbmcbicndoeheogkkohknib.chromiumapp.org/
   ```
   (Use your actual URIs - copy from the app)
7. **Save** and wait 1-2 minutes
8. **Try** connecting again

---

## Backup Mode Default Fixes (Completed Earlier)

All `backupMode` fallbacks now default to **"both"** instead of **"scheduled"**:
- ✅ `src/background/background.js` (2 locations)
- ✅ `src/popup/popup.js` (3 locations)
- ✅ `src/library/library.js` (1 location)

This ensures consistent backup behavior across all interfaces.

---

## Testing Checklist

### For Backup Auto-Refresh
- [ ] Click **"📤 Backup Now"** in Library Settings
- [ ] Verify the backup list updates automatically without refresh

### For Firefox OAuth
- [ ] Open Firefox → Library Settings
- [ ] See the Firefox warning note about "Alizom"
- [ ] Copy the redirect URI shown
- [ ] Add it to Google Cloud Console
- [ ] Try connecting to Google Drive
- [ ] You'll see "Alizom" login (this is expected and normal)
- [ ] After login, Drive should work normally

### For Token Revocation
- [ ] Revoke access in Google Account Settings
- [ ] Refresh Library Settings page
- [ ] You should see red banner: "⛔ Google Drive access was revoked"
- [ ] Click **"🔐 Reconnect Google Drive"**
- [ ] Complete OAuth flow again
- [ ] Status should change back to "🟢 Connected"

---

## Files Modified/Created

| File                                        | Change                                        | Lines |
| ------------------------------------------- | --------------------------------------------- | ----- |
| `src/library/library-settings.js`           | Auto-refresh, Firefox note, revocation banner | +72   |
| `src/background/background.js`              | Default mode fallbacks                        | +39   |
| `src/popup/popup.js`                        | Default mode fallbacks                        | +7    |
| `src/library/library.js`                    | Default mode fallback                         | +2    |
| `docs/guides/FIREFOX_GOOGLE_DRIVE_OAUTH.md` | **NEW**: Complete Firefox OAuth setup guide   | --    |

---

## Key Behavioral Changes

1. **Backup List**: Now auto-refreshes after manual backup (no more stale list)
2. **Error Handling**: Clear distinction between revoked (red banner) vs. disconnected (grey)
3. **Firefox UX**: Informative warning about expected "Alizom" text in Google login
4. **Reconnect Flow**: Single-click reconnection when tokens are revoked

---

## Next Steps for Users

1. **Test in Firefox**: Follow the redirect URI setup guide
2. **Report Issues**: If you still can't connect after adding redirect URI, check:
   - URI copied exactly (no extra spaces)
   - Waited 1-2 minutes after saving
   - Using correct Google Account
   - Browser cookies enabled for google.com

3. **Verify Backups**: After testing, ensure backups are creating and syncing properly

---

## Additional Resources

- **Full Firefox Guide**: `docs/guides/FIREFOX_GOOGLE_DRIVE_OAUTH.md`
- **Google Cloud Console**: https://console.cloud.google.com/
- **Troubleshooting**: Check the Firefox guide "Troubleshooting" section

---

## Build Status

✅ **Clean build**: All changes compile successfully
✅ **Firefox manifest**: Includes all necessary permissions
✅ **Chromium manifest**: No regressions
✅ **Content scripts**: No changes to injection logic
