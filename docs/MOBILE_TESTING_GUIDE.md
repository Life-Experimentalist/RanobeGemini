# Mobile Testing Guide for Ranobe Gemini

This guide explains how to test the Ranobe Gemini browser extension on mobile devices (Firefox Mobile and Edge Mobile).

---

## Table of Contents

- [Firefox Mobile (Android)](#firefox-mobile-android)
- [Edge Mobile (Android)](#edge-mobile-android)
- [iOS Limitations](#ios-limitations)
- [Testing Checklist](#testing-checklist)
- [Known Mobile Issues](#known-mobile-issues)

---

## Firefox Mobile (Android)

Firefox for Android supports browser extensions, making it the best platform for mobile testing of Ranobe Gemini.

### Prerequisites

- Android device or emulator (Android 5.0+)
- Firefox for Android installed ([Google Play Store](https://play.google.com/store/apps/details?id=org.mozilla.firefox))
- Extension built for Firefox (see [Build System](BUILD_SYSTEM.md))

### Installation Steps

#### Method 1: Firefox Nightly (Recommended for Development)

Firefox Nightly allows loading temporary extensions for testing:

1. **Install Firefox Nightly**
   - Download from [Google Play Store](https://play.google.com/store/apps/details?id=org.mozilla.fenix)
   - Or direct APK from [Mozilla's website](https://www.mozilla.org/en-US/firefox/channel/android/)

2. **Enable Debug Mode**
   - Open Firefox Nightly
   - Go to Settings → About Firefox Nightly
   - Tap the Firefox logo 5 times to enable debug menu
   - Go back to Settings → Advanced → Remote debugging via USB (enable it)

3. **Connect to Desktop Firefox**
   - On your computer, open Firefox Developer Edition or Firefox
   - Connect your Android device via USB
   - Enable USB Debugging on Android (Developer Options)
   - In desktop Firefox, navigate to `about:debugging#/setup`
   - Click "Enable USB Devices"
   - Your Android device should appear in the list

4. **Load Extension**
   - Click on your device name in `about:debugging`
   - Click "Load Temporary Add-on"
   - Navigate to `dist/dist-firefox/manifest.json` from your build
   - The extension will load on your mobile Firefox Nightly

5. **Test the Extension**
   - Open a supported novel site (e.g., royalroad.com, scribblehub.com)
   - Test chapter summarization, library features, backups
   - Check responsive layout and touch interactions

#### Method 2: Firefox for Android (Stable) - Custom Collection

For stable Firefox, you need to create a custom add-on collection:

1. **Create Mozilla Account**
   - Go to [addons.mozilla.org](https://addons.mozilla.org)
   - Sign in or create an account

2. **Create Custom Collection**
   - Visit [Collections page](https://addons.mozilla.org/collections/)
   - Click "Create a collection"
   - Name it (e.g., "RanobeGemini-Testing")
   - Make it public

3. **Add Your Extension (Requires Publishing)**
   - Note: This method requires your extension to be submitted to AMO
   - See [Firefox Submission Guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)

4. **Configure Firefox Mobile**
   - Open Firefox for Android
   - Go to Settings → About Firefox
   - Tap logo 5 times to enable debug menu
   - Go to Settings → Advanced → Custom Add-on collection
   - Enter your collection user ID and collection name
   - Restart Firefox
   - Your collection will appear in Add-ons menu

### Testing Features on Firefox Mobile

**✅ Supported:**
- Content script injection on novel pages
- Summarization with Gemini API
- Library management (add/remove novels)
- Reading history tracking
- Local rolling backups
- Google Drive backups (with OAuth)
- Settings sync

**⚠️ Limited:**
- Popup UI may be cramped on small screens
- Library grid view requires horizontal scrolling
- Backup modal dialogs may need scrolling

**❌ Not Supported:**
- Desktop-only keyboard shortcuts
- Multi-window features

---

## Edge Mobile (Android)

Microsoft Edge for Android has **extremely limited extension support**. As of early 2025, only specific Microsoft-approved extensions are available.

### Current Status

**Edge Mobile does NOT support arbitrary extension installation** like Firefox. The Edge mobile extension store only includes a curated list of approved extensions.

### Workaround Options

#### Option 1: Wait for Official Edge Mobile Extension Support

Microsoft is gradually expanding Edge Mobile extension support. Check:
- [Microsoft Edge Insider Channels](https://www.microsoftedgeinsider.com/en-us/download/android)
- [Edge Add-ons Developer Portal](https://microsoftedge.microsoft.com/addons/developer/dashboard)

#### Option 2: Test on Edge Desktop (Windows/Mac/Linux)

Since Edge Mobile doesn't support custom extensions yet:

1. **Build for Chromium**
   ```powershell
   npm run build
   npm run package
   ```

2. **Load in Edge Desktop**
   - Open `edge://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `dist/dist-chromium/`

3. **Simulate Mobile View**
   - Press `F12` to open DevTools
   - Click device toolbar icon (Ctrl+Shift+M)
   - Select mobile device (e.g., Galaxy S20, iPhone 12)
   - Test responsive layouts

4. **Test Touch Events (Approximate)**
   - Use mouse to simulate touch
   - Test button sizes (minimum 44x44px touch targets)
   - Check scrolling behavior

#### Option 3: Kiwi Browser (Chromium-based Alternative)

Kiwi Browser supports Chrome extensions on Android:

1. **Install Kiwi Browser**
   - Download from [Google Play Store](https://play.google.com/store/apps/details?id=com.kiwibrowser.browser)

2. **Load Extension**
   - Open Kiwi Browser
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" (requires extracting zip to device storage)
   - Or install from `.crx` file

3. **Test Extension**
   - Works similarly to Chrome Desktop
   - Full extension API support

---

## iOS Limitations

### Safari iOS

**Apple does not allow browser extensions on iOS** outside of Safari's limited extension framework. Firefox and Edge on iOS are WebView wrappers and cannot run browser extensions.

### Current Status

- ❌ Firefox iOS: No extension support
- ❌ Edge iOS: No extension support
- ⚠️ Safari iOS: Requires complete rewrite as Safari Web Extension (different API)

### Potential Future Solution

If you want to support iOS Safari:
1. Convert extension to [Safari Web Extension](https://developer.apple.com/documentation/safariservices/safari_web_extensions)
2. Package as iOS app with extension
3. Submit to App Store

This requires:
- Apple Developer Account ($99/year)
- Xcode and macOS for development
- Significant code refactoring

---

## Testing Checklist

Use this checklist when testing on mobile:

### Basic Functionality
- [ ] Extension loads without errors
- [ ] Popup opens and displays correctly
- [ ] Content scripts inject on supported sites
- [ ] Chapter detection works
- [ ] Summarization requests complete successfully

### UI/UX Mobile-Specific
- [ ] All buttons are at least 44x44px (touch-friendly)
- [ ] Text is readable (minimum 14px font size)
- [ ] No horizontal overflow/scrolling issues
- [ ] Modals fit within viewport
- [ ] Forms and inputs work with mobile keyboard
- [ ] Dropdowns and selects are accessible

### Library Features
- [ ] Add novel to library
- [ ] Remove novel from library
- [ ] Mark chapters as read
- [ ] Update reading status
- [ ] View novel details
- [ ] Search and filter work

### Backup & Sync
- [ ] Local rolling backups create successfully
- [ ] Google Drive OAuth flow works on mobile browser
- [ ] Manual backups upload to Drive
- [ ] Restore from backup works
- [ ] Backup list displays correctly

### Performance
- [ ] No lag when scrolling library
- [ ] Summarization doesn't freeze UI
- [ ] Background backups don't impact browsing
- [ ] Memory usage stays reasonable (<200MB)

### Offline Functionality
- [ ] Library accessible offline
- [ ] Reading history persists
- [ ] Cached chapters readable
- [ ] Settings saved locally

---

## Known Mobile Issues

### Layout Issues

**Problem:** Library grid may overflow on small screens (< 360px width)

**Workaround:** Use list view instead of grid view

**Fix:** Planned responsive breakpoints in v3.9.0

---

### Touch Target Sizes

**Problem:** Some buttons/links < 44x44px (iOS guideline)

**Status:** Fixed in Settings modal (v3.8.0), remaining in chapter navigation

**Fix:** Planned for v3.9.0

---

### Google Drive OAuth on Mobile

**Problem:** OAuth redirect may open in new tab/window instead of returning to extension

**Workaround:**
1. Complete OAuth in popup
2. If redirect opens new tab, close it manually
3. Return to extension popup
4. Check connection status

**Status:** Investigating better mobile OAuth flow

---

### Popup Width on Small Screens

**Problem:** Popup fixed width (400px) may be too wide for phones < 400px screen width

**Workaround:** Use library page instead of popup for settings

**Fix:** Dynamic popup width planned for v3.9.0

---

## Debugging on Mobile

### Firefox Mobile Debugging

1. **Connect via USB**
   - Enable USB debugging on Android
   - Connect device to computer
   - Open `about:debugging` in desktop Firefox

2. **View Console Logs**
   - Select your device → Your extension
   - Click "Inspect" to open DevTools
   - View Console, Network, Storage tabs

3. **Test Storage**
   - DevTools → Storage → Extension Storage
   - Verify backups, settings, library data

### Edge Mobile Debugging (via Kiwi Browser)

1. **Enable Remote Debugging**
   - Kiwi Browser → Settings → Developer → USB Debugging

2. **Connect via Chrome DevTools**
   - Open `chrome://inspect` on desktop Chrome/Edge
   - Device should appear
   - Click "inspect" on extension background page

---

## Performance Testing

### Memory Profiling

1. **Firefox Mobile**
   - Desktop Firefox → `about:debugging` → Inspect
   - Performance tab → Start recording
   - Interact with extension on mobile
   - Stop recording and analyze

2. **Kiwi Browser**
   - Chrome DevTools → Performance
   - Record mobile interaction
   - Check for memory leaks

### Network Profiling

1. **Monitor API Calls**
   - DevTools → Network tab
   - Filter by `googleapis.com` for Gemini API
   - Check request/response times

2. **Check Offline Behavior**
   - Enable airplane mode
   - Test library access
   - Verify cached data loads

---

## Reporting Mobile-Specific Issues

When reporting mobile bugs, include:

1. **Device Info**
   - Device model (e.g., Samsung Galaxy S21)
   - Android version (e.g., Android 13)
   - Screen size/resolution

2. **Browser Info**
   - Browser name and version (e.g., Firefox Nightly 116.0a1)
   - Extension version (e.g., Ranobe Gemini 3.8.0)

3. **Steps to Reproduce**
   - Specific actions taken
   - Expected vs actual behavior
   - Screenshots/screen recordings

4. **Console Logs**
   - Export from `about:debugging` (Firefox)
   - Include full error stack traces

---

## Additional Resources

- [Firefox Mobile Extension Development](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/)
- [Chrome Extension on Android (Kiwi)](https://github.com/kiwibrowser/src/wiki/Loading-Chrome-Extensions)
- [Mobile Web Best Practices](https://www.w3.org/TR/mobile-bp/)
- [Touch Target Sizes (Material Design)](https://material.io/design/usability/accessibility.html#layout-and-typography)

---

## Contributing Mobile Fixes

If you fix a mobile-specific issue:

1. Test on actual device (not just emulator)
2. Test both portrait and landscape orientations
3. Test on different screen sizes (small phone, tablet)
4. Update this guide with any new findings
5. Add mobile-specific test cases to `docs/v3.8.0_FINAL_CHECKLIST.md`

---

**Last Updated:** 2025-02-08
**Tested On:**
- Firefox Nightly 116.0a1 (Android 13, Pixel 6)
- Kiwi Browser 116.0 (Android 12, Galaxy S21)
- Edge Desktop Mobile Emulation (Windows 11)
