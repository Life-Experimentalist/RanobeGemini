# Ranobe Gemini v3.8.0 Release Notes

**Release Date**: February 3, 2026
**Type**: Feature Update + Bug Fixes

---

## 🎯 What's New

### OAuth Setup & Google Drive Improvements
This release completely overhauls the Google Drive backup experience with a clearer workflow and better theme integration.

#### **Redesigned OAuth Setup Flow**
- **Step-by-step workflow**: Setup now clearly separates credential entry from Drive connection
- **Dual input methods**: Paste complete JSON file OR manually enter Client ID + Secret
- **New "Parse JSON" button**: Preview credentials before saving
- **New "Save to Storage" button**: Explicitly save credentials after verification
- **Theme-aware styling**: OAuth setup section now fully respects light/dark mode preferences

#### **Google Drive Backup Workflow**
1. **Enter OAuth Credentials** (one-time setup)
   - Paste `client_secret_*.json` OR manually enter credentials
   - Parse to validate format (supports web/installed/direct formats)
   - Save to browser storage
2. **Connect to Google Drive**
   - Click "Connect to Google Drive"
   - Authorize with your Gmail account
   - Start creating backups!

### Backup System Enhancements

#### **Persistent Backup Options**
- Backup checkboxes now remember your preferences
- Settings persist across popup sessions
- Default: Include both API keys AND OAuth credentials

#### **Comprehensive Version Handling**
- Backups now include extension version (e.g., v3.8.0)
- Backups include format version (v3.0)
- Smart compatibility checking when restoring:
  - **Major version warnings**: Alerts when backup is from newer/older extension
  - **Format migration**: Automatically handles legacy backup formats (< v2.0)
  - **Detailed version info**: Shows both extension and format versions
- Version warnings displayed before restore completes

#### **OAuth Credentials in Backups**
- OAuth credentials now **included by default** in comprehensive backups
- Separate checkbox control for including/excluding credentials
- Safer backup restoration: Always asks before overwriting existing credentials

### UI/UX Improvements

#### **Theme Integration**
All form elements now use CSS theme variables:
- `--text-primary` and `--text-secondary` for text colors
- `--input-bg` for input backgrounds
- `--border-color` for borders
- `--accent-primary` and `--accent-secondary` for highlights
- Automatic light/dark mode switching

#### **Better Visual Feedback**
- Larger, more clickable checkboxes (14×14px)
- Cursor changes to pointer on interactive elements
- Improved spacing and padding throughout OAuth section
- Color-coded parsing results:
  - ✅ **Green**: Success
  - ⚠️ **Orange**: Warnings (e.g., redirect URI issues)
  - ❌ **Red**: Errors
  - ℹ️ **Blue**: Info messages

#### **Hidden Features**
- Custom folder ID input temporarily hidden (not working properly yet)
- Will be re-enabled in future release with proper functionality

---

## 🔧 Technical Changes

### Version Management
- Backup format version bumped to **3.0**
- Extension version automatically embedded in backups
- Backward compatible with v2.0 and v1.0 backups
- Forward compatibility warnings for newer backups

### Storage Keys
- **New**: `backupCheckboxSettings` - Stores checkbox preferences
  - `includeApiKeys`: boolean (default: true)
  - `includeCredentials`: boolean (default: true)

### Security
- OAuth credentials stored in `browser.storage.local` only
- Never hardcoded in source code
- `client_secret_*.json` files excluded from version control
- Sample files in `/sample/` directory excluded from releases

---

## 🐛 Bug Fixes

1. **Checkbox persistence**: Backup option checkboxes now properly save state
2. **Theme inheritance**: OAuth setup section now correctly uses theme variables
3. **Parse result display**: Multi-line messages now display properly with wrapping
4. **JSON parsing**: Better error messages for invalid formats
5. **Redirect URI validation**: Warnings now display for missing/invalid redirect URIs

---

## 📦 What's Included

### Backup Contains
When you create a comprehensive backup, it includes:
- ✅ Library data (novels, chapters, reading history)
- ✅ All prompts (enhancement, summary, short summary, permanent)
- ✅ Model configuration (selected model, temperature, top-P, top-K)
- ✅ API keys (Gemini API key + backup keys)
- ✅ OAuth credentials (Client ID + Secret) — **NEW: enabled by default**
- ✅ Site-specific settings
- ✅ Theme preferences
- ✅ All extension settings

### Version Information
Each backup now records:
- Extension version (e.g., "3.8.0")
- Backup format version (e.g., "3.0")
- Creation timestamp (ISO 8601 format)
- Novel count and metadata

---

## 🚀 Getting Started

### First-Time OAuth Setup
1. Open Ranobe Gemini popup
2. Navigate to **Backup** tab
3. Expand **"🔧 OAuth Setup (Required for Google Drive)"**
4. Choose one method:
   - **Method 1**: Paste your `client_secret_*.json` → Click "Parse JSON" → Click "Save to Storage"
   - **Method 2**: Manually enter Client ID + Secret → Click "Save Credentials"
5. Click **"Connect to Google Drive"**
6. Authorize with your Gmail account
7. Done! You can now backup to Google Drive

### Creating Backups
- **Manual Backup**: Click "💾 Full Backup" to download JSON file
- **Google Drive**: Click "💾 Backup Now" (after connecting Drive)
- **Auto Backup**: Enable "automatic rolling backups" for browser-stored backups

### Restoring Backups
1. Click "📂 Restore Full"
2. Select backup file
3. Review version information and contents
4. Confirm restore
5. Extension will reload with restored data

---

## ⚠️ Important Notes

### Breaking Changes
- **None** - This version is fully backward compatible

### Known Issues
- Custom folder ID for Google Drive not functional (hidden in this release)
- Will be fixed in future update

### Recommendations
1. **Create a backup before updating** to v3.8.0
2. **Test OAuth setup** after updating
3. **Verify theme colors** match your preferences
4. **Check checkbox settings** are saved correctly

---

## 🔗 Additional Resources

- **Full Setup Guide**: https://ranobe.vkrishna04.me/drive-setup.html
- **GitHub Repository**: https://github.com/Life-Experimentalist/RanobesGemini
- **Bug Reports**: Open an issue on GitHub

---

## 📊 Statistics

- **Files Changed**: 3
  - `src/utils/comprehensive-backup.js` (version handling)
  - `src/popup/popup.html` (OAuth UI redesign)
  - `src/popup/popup.js` (checkbox persistence + button handlers)
- **Lines Added**: ~200
- **Lines Modified**: ~150
- **New Features**: 6
- **Bug Fixes**: 5

---

## 👥 Credits

Developed by **VKrishna04** (Life Experimentalist)
Website: https://vkrishna04.me

---

## 📅 Upgrade Path

### From v3.7.x
- ✅ Direct upgrade supported
- ✅ All data preserved
- ✅ No manual steps required

### From v3.6.x or older
- ✅ Direct upgrade supported
- ⚠️ Recommended: Create backup first
- ℹ️ OAuth credentials may need re-entry

---

## 🎉 Thank You!

Thank you for using Ranobe Gemini! Your feedback helps make this extension better.

If you encounter any issues, please:
1. Check the **Debug Mode** in Advanced settings
2. Review browser console logs
3. Report on GitHub with logs attached

Happy reading! 📖✨
