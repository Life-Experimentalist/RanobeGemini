# Google OAuth 2.0 Setup for Ranobe Gemini

Complete guide to set up Google Drive backup with proper OAuth 2.0 authentication.

## Quick Summary

| Item                    | Value                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **OAuth Flow**          | Authorization Code with PKCE (Proof Key for Code Exchange)                          |
| **Scopes Required**     | `https://www.googleapis.com/auth/drive.file`                                        |
| **Token Type**          | Bearer token                                                                        |
| **Redirect Scheme**     | `https://*.chromiumapp.org/` (Chrome/Edge) or `urn:ietf:wg:oauth:2.0:oob` (Firefox) |
| **JS Origin (Landing)** | `https://ranobe.vkrishna04.me` (landing OAuth page)                                 |
| **Configuration**       | No server backend needed - browser-native flow                                      |

## Why PKCE?

The extension uses **PKCE** (RFC 7636) because:
1. ✅ No server backend needed
2. ✅ Secure for installed applications (desktop/browser extensions)
3. ✅ Works offline
4. ✅ Prevents auth code interception attacks

## Why `drive.file` Scope?

```
Scope: https://www.googleapis.com/auth/drive.file
```

This scope means:
- ✅ Create files on behalf of the app
- ✅ View and manage only files created by this app
- ✅ **Cannot** access other files on the user's Drive
- ✅ **Cannot** change sharing settings
- ✅ Safest for users - minimal permissions

**Alternative scopes** (not recommended):
- `drive` - Full access to all files (too permissive)
- `drive.readonly` - Read-only (good but can't upload)
- `drive.appdata` - Hidden app-only storage (keeps files invisible to the user and complicates restore/debug flows)

## Google Cloud Console Setup

### Step 1: Create OAuth Consent Screen

```
Google Cloud Console
  ↓
APIs & Services
  ↓
OAuth Consent Screen
  ↓
Choose "External" (for users)
  ↓
Fill in:
  - App name: "Ranobe Gemini"
  - User support email: (your email)
  - Developer contact: (your email)
  ↓
Scopes: Add "https://www.googleapis.com/auth/drive.file"
  ↓
Test users: (optional - add your accounts if testing)
  ↓
Save and Continue
```

### Step 2: Create OAuth 2.0 Credentials

```
Google Cloud Console
  ↓
APIs & Services
  ↓
Credentials
  ↓
+ Create Credentials
  ↓
OAuth client ID
  ↓
Application type: "Web application"
  ↓
Name: "Ranobe Gemini OAuth Client"
  ↓
Authorized JavaScript origins:
  - https://ranobe.vkrishna04.me
  ↓
Authorized redirect URIs:
  - https://YOUR_EXTENSION_ID.chromiumapp.org/
  - urn:ietf:wg:oauth:2.0:oob
  ↓
Create
```

### Step 3: Copy Client ID

```
You should see:
{
  "client_id": "123456789-xxxxx.apps.googleusercontent.com",
  "project_id": "your-project",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://...",
  "client_secret": "xxxxx" (not used in this flow)
}
```

**You only need**: `client_id`

## Finding Your Extension ID

### Chrome/Chromium

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Your extension ID is shown in the blue box

Example:
```
ID: agbhdkiciomjlifhlfbjanpnhhokaimn
```

Add to Google Cloud redirect URIs:
```
https://agbhdkiciomjlifhlfbjanpnhhokaimn.chromiumapp.org/
```

### Edge

1. Open `edge://extensions/`
2. Enable "Developer mode"
3. Copy ID
4. Add to Google Cloud redirect URIs:
```
https://YOUR_ID.chromiumapp.org/
```

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Look for Ranobe Gemini extension
3. Copy the UUID (long string)
4. This flow doesn't use redirect URIs for Firefox (uses `urn:ietf:wg:oauth:2.0:oob`)

## Implementation Details

### Code Flow

```
User clicks "Connect Google Drive"
         ↓
popup.js opens oauth-redirect.html in new tab
         ↓
oauth-redirect.html generates PKCE pair:
  - code_verifier (128 chars, random)
  - code_challenge (SHA256 of verifier, base64url)
         ↓
Redirects to Google OAuth endpoint:
  GET https://accounts.google.com/o/oauth2/v2/auth?
    client_id=YOUR_CLIENT_ID
    redirect_uri=https://your-ext-id.chromiumapp.org/
    response_type=code
    scope=https://www.googleapis.com/auth/drive.file
    access_type=offline              // ← for refresh token
    prompt=consent
    code_challenge=XXXXX
    code_challenge_method=S256
         ↓
User sees Google login page
User clicks "Allow"
         ↓
Google redirects back to:
  https://your-ext-id.chromiumapp.org/?code=AUTH_CODE&state=random
         ↓
oauth-redirect.html:
  - Extracts code from URL
  - Sends postMessage to popup with code
  - popup.js receives and stores code
         ↓
popup.js exchanges code for tokens:
  POST https://oauth2.googleapis.com/token
  {
    "client_id": "YOUR_CLIENT_ID",
    "code": "AUTH_CODE",
    "code_verifier": "YOUR_VERIFIER",
    "grant_type": "authorization_code"
  }
         ↓
Response:
  {
    "access_token": "ya29.xxx",
    "expires_in": 3600,
    "refresh_token": "1//0xxx",
    "scope": "https://www.googleapis.com/auth/drive.file",
    "token_type": "Bearer"
  }
         ↓
Stored in browser.storage.local.driveAuthTokens
         ↓
Now backup library to Google Drive
```

### Token Refresh

Tokens expire in 3600 seconds (1 hour). When expired:

```
drive.js detects expired token
         ↓
Calls ensureDriveAccessToken()
         ↓
If token expired AND refresh_token exists:
  POST https://oauth2.googleapis.com/token
  {
    "client_id": "YOUR_CLIENT_ID",
    "refresh_token": "REFRESH_TOKEN",
    "grant_type": "refresh_token"
  }
         ↓
Gets new access_token (refresh_token stays same)
         ↓
Updates storage
         ↓
Makes API call with new token
```

### API Calls

All Drive API calls use the access token:

```
Authorization: Bearer <access_token>
```

Example: List backups
```
GET https://www.googleapis.com/drive/v3/files
  ?q='FOLDER_ID' in parents
  &spaces=drive
  &fields=files(id,name,createdTime,size)
  &pageSize=50

Headers:
  Authorization: Bearer ya29.xxx
```

### Backup Retention Rules

- Drive keeps the newest **3 versioned backups**; older versioned files are pruned automatically.
- Continuous mode writes to a single rolling file (`ranobe-library-continuous.json`) instead of creating new files.

## File Structure

### Landing Page (OAuth Redirect)
```
landing/oauth-redirect.html
├── Minimal UI
├── Detects browser
├── Probes for extension using known IDs
├── Redirects to library.html if found
└── Posts OAuth token to popup via postMessage
```

### Drive Utils
```
src/utils/drive.js
├── PKCE helper functions
├── ensureDriveAccessToken()     // Get/refresh token
├── uploadBlobToDrive()           // Upload file
├── ensureBackupFolder()          // Create "Ranobe Gemini Backups" folder
├── uploadLibraryBackupToDrive()  // Versioned backups + rolling continuous file, fixed max count
├── listDriveBackups()            // Get list of backups (includes continuous)
└── downloadDriveBackup()         // Download specific backup
```

### Popup UI
```
src/popup/popup.html
├── Backup Tab
│   ├── Google Drive section
│   │   ├── Connect/Disconnect buttons
│   │   ├── Backup mode (Scheduled/Continuous)
│   │   ├── Backup Now button
│   │   └── View Backups button
│   └── Local file backup section
```

### Background Service
```
src/background/background.js
├── Auto-backup scheduler
│   ├── Scheduled mode: daily alarm
│   ├── Continuous mode: storage listener
│   └── 5-minute debounce (writes to single rolling file)
├── Message handlers
│   ├── uploadLibraryBackupToDrive
│   ├── listDriveBackups
│   └── downloadDriveBackup
└── Folder & retention management
```

## Security Considerations

### Token Storage

Tokens stored in `browser.storage.local`:
- **Firefox**: Encrypted by browser
- **Chrome**: Stored in profile directory
- **Edge**: Similar to Chrome

⚠️ **Not recommended**: Don't store in `sessionStorage` (lost on refresh)

### PKCE Flow Benefits

1. **No server needed**: Extension is standalone
2. **No client secret**: Auth code can't be used without verifier
3. **Protection against**: Code interception, code injection attacks

### Scope Limitation

The `drive.file` scope ensures:
- Extension only creates its own files
- Can't access user's other Drive files
- Can't share files (can't change permissions)
- User can revoke access in one place

### Revocation

Users can revoke access:
1. Open extension popup
2. Click "Disconnect Drive"
3. Or visit [https://myaccount.google.com/permissions](https://myaccount.google.com/permissions)

## Troubleshooting

### "Client ID missing" Error

```javascript
// Check in constants.js
export const DEFAULT_DRIVE_CLIENT_ID =
  "123456789-xxxxx.apps.googleusercontent.com";
```

If empty, set in popup Settings or use default.

### "State mismatch" Error

The `state` parameter is used to prevent CSRF attacks:

```javascript
// oauth-redirect.html generates state
const state = getRandomString(16);

// After redirect, verifies:
if (parsed.searchParams.get("state") !== state) {
  throw new Error("State mismatch");
}
```

If you see this:
- Browser was redirected during auth
- Try again - likely a temporary glitch
- Check that you're using HTTPS (or extension scheme)

### Token Refresh Failed

```javascript
// If refresh fails, extension requests new auth
// User will see "Connect Google Drive" button again
```

Common causes:
- Refresh token revoked by user
- Google security policy
- Time sync issues on device

Fix: Click "Disconnect Drive" then "Connect Drive" again

### Backup Upload Failed

Check:
1. Google Drive API enabled in Cloud Console
2. Backup folder exists and accessible
3. User has free space on Drive
4. Network connectivity

## Default Client ID

The extension includes a default Google OAuth Client ID:
```javascript
// src/utils/constants.js
export const DEFAULT_DRIVE_CLIENT_ID =
  "1009134964226-9qblnrbhvo8brs7u18p1d268pvt0111a.apps.googleusercontent.com";
```

This works out of the box for all browsers. If you want to use your own:

1. Follow "Google Cloud Console Setup" above
2. Update `constants.js` with your Client ID
3. Rebuild extension

## Testing the Flow

### Unit Test (Node.js)

```javascript
import { createPkcePair } from "./drive.js";

const { verifier, challenge } = await createPkcePair();
console.log("Verifier length:", verifier.length);
console.log("Challenge length:", challenge.length);
```

### Integration Test (Browser)

1. Open popup
2. Go to Backup tab
3. Click "Connect Google Drive"
4. Complete Google login
5. Check popup shows "Connected"
6. Click "Backup Now"
7. Should see "Backup uploaded"

## References

- [OAuth 2.0 PKCE Spec](https://tools.ietf.org/html/rfc7636)
- [Google Drive API Docs](https://developers.google.com/drive/api/v3/about-sdk)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
- [Chrome Extension API for Identity](https://developer.chrome.com/docs/extensions/reference/identity/)
