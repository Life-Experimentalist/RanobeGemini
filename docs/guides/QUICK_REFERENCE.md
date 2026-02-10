# Google Drive Backup - Quick Reference

## Table of Contents

- [Google Drive Backup - Quick Reference](#google-drive-backup---quick-reference)
	- [Table of Contents](#table-of-contents)
	- [⚡ Quick Setup](#-quick-setup)
		- [1. Google Cloud Console (5 minutes)](#1-google-cloud-console-5-minutes)
		- [2. Update Extension](#2-update-extension)
		- [3. Build \& Test](#3-build--test)
	- [📊 OAuth Scopes](#-oauth-scopes)
	- [🔐 Token Flow (PKCE)](#-token-flow-pkce)
	- [💾 Backup Modes](#-backup-modes)
		- [Scheduled](#scheduled)
		- [Continuous](#continuous)
	- [📝 Files Modified](#-files-modified)
	- [🧪 Test Checklist](#-test-checklist)
	- [🐛 Common Issues](#-common-issues)
	- [📚 Documentation](#-documentation)
	- [🚀 Ready to Ship?](#-ready-to-ship)
	- [📧 Support URLs](#-support-urls)

## ⚡ Quick Setup

### 1. Google Cloud Console (5 minutes)

```markdown
console.cloud.google.com
  → New Project: "Ranobe Gemini"
  → APIs: Enable "Google Drive API"
  → OAuth Screen: "External"
    - App name: Ranobe Gemini
    - Scope: drive.file
  → Credentials: Create OAuth 2.0 Web Client
    - Redirect URIs:
      https://YOUR_EXTENSION_ID.chromiumapp.org/
      urn:ietf:wg:oauth:2.0:oob
  → Copy Client ID
```

### 2. Update Extension

```javascript
// src/utils/constants.js
export const DEFAULT_DRIVE_CLIENT_ID = "YOUR_CLIENT_ID";
```

Or use built-in default (already configured).

### 3. Build & Test

```powershell
npm run build    # or npm run watch
```

## 📊 OAuth Scopes

| Scope            | What it Allows                 |
| ---------------- | ------------------------------ |
| `drive.file`     | ✅ Create/manage only app files |
| `drive`          | ❌ Full access (don't use)      |
| `drive.readonly` | ⚠️ Can't upload                 |

**We use**: `drive.file` (minimal, safe)

## 🔐 Token Flow (PKCE)

```markdown
User clicks "Connect Drive"
  ↓
Extension opens Google login
  ↓
User authorizes (minimal permissions)
  ↓
Token stored in browser.storage.local
  ↓
Backups upload automatically
```

**Key**: PKCE = No server needed

## 💾 Backup Modes

### Scheduled

```logs
- Runs daily at 2 AM
- Good for: Nightly protection
- Storage: Low (once per day)
```

### Continuous

```logs
- Uploads 5 min after library change
- Good for: Real-time protection
- Storage: Higher (multiple per day)
```

## 📝 Files Modified

| File            | Change                           |
| --------------- | -------------------------------- |
| `constants.js`  | Add `DEFAULT_DRIVE_CLIENT_ID`    |
| `drive.js`      | Add backup functions             |
| `background.js` | Add scheduler + message handlers |
| `popup.html`    | Add Drive UI                     |
| `popup.js`      | Add Drive handlers               |

## 🧪 Test Checklist

- [ ] Connect Drive button works
- [ ] "Backup Now" creates file on Drive
- [ ] Scheduled backups run daily
- [ ] Continuous mode debounces (5 min)
- [ ] View Backups shows list
- [ ] Restore from backup works
- [ ] Disconnect removes access
- [ ] Token refreshes after 1 hour
- [ ] Works on Chrome, Edge, Firefox
- [ ] Errors show user-friendly messages

## 🐛 Common Issues

| Issue                    | Fix                                |
| ------------------------ | ---------------------------------- |
| "Client ID missing"      | Set in `constants.js`              |
| "State mismatch"         | Try again or check redirect URIs   |
| "Folder creation failed" | Enable Drive API in Cloud Console  |
| No backups uploading     | Check connected status, check logs |
| Can't restore            | Check file exists on Drive         |

## 📚 Documentation

- `docs/guides/GOOGLE_DRIVE_BACKUP_SETUP.md` - User guide
- `docs/guides/OAUTH_SETUP_DETAILED.md` - Technical details
- `docs/IMPLEMENTATION_COMPLETE.md` - Full reference

## 🚀 Ready to Ship?

- [ ] All tests pass
- [ ] No errors in console
- [ ] Google Cloud project created
- [ ] Client ID configured
- [ ] Built successfully
- [ ] Tested on all browsers

## 📧 Support URLs

- OAuth 2.0: https://tools.ietf.org/html/rfc7636
- Drive API: https://developers.google.com/drive/api/v3
- Chrome Identity: https://developer.chrome.com/docs/extensions/reference/identity/

---

**Everything is ready! You can now:**

1. Test the backup feature end-to-end
2. Build for production
3. Submit to stores (Chrome Web Store, Firefox Add-ons, Edge Add-ons)
4. Release to users! 🎉
