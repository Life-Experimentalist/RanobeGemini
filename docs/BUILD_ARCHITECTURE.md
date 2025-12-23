# Build Architecture

## Overview

The build system is designed to efficiently package Ranobe Gemini for multiple browser platforms (Firefox and Chromium-based browsers) with platform-specific manifest optimization.

## Source Structure

```
src/
├── manifest-firefox.json       # Firefox-specific manifest
├── manifest-chromium.json      # Chromium-specific manifest
├── background/                 # Service worker code
├── content/                    # Content scripts
├── popup/                      # Extension popup UI
├── library/                    # Novel library panel
├── icons/                      # Extension icons
├── config/                     # Configuration files
├── utils/                      # Utility modules
└── lib/                        # Browser polyfills
```

## Build Process

### Step 1: Clean
- Removes previous `dist/` directory

### Step 2: Load Platform Manifest
- **Firefox**: Loads `src/manifest-firefox.json`
- **Chromium**: Loads `src/manifest-chromium.json`

### Step 3: Update Version
- Reads version from `package.json`
- Injects into manifest.json

### Step 4: Copy Assets
Copies all source directories (icons, popup, background, content, etc.) to platform-specific dist folder:
- `dist/dist-firefox/`
- `dist/dist-chromium/`

### Step 5: Package
- Firefox: `npm run package-firefox` → `releases/RanobeGemini_v3.6.0_firefox.zip`
- Chromium: `npm run package-chromium` → `releases/RanobeGemini_v3.6.0_chromium.zip`

## Platform-Specific Features

### Firefox Manifest (`manifest-firefox.json`)
**Includes:**
- `browser_specific_settings` - Gecko ID and version requirements
- `data_collection_permissions` - Required for Firefox data collection
- `sidebar_action` - Firefox sidebar UI
- `theme_icons` - Firefox theme icon variants

**Excludes:**
- `side_panel` (Chromium-only)
- `sidepanel` permission (Chromium-only)

**Icon Strategy:** Uses properly sized `logo-*.png` files for all sizes

### Chromium Manifest (`manifest-chromium.json`)
**Includes:**
- `side_panel` - Chrome/Edge side panel configuration
- `sidepanel` permission

**Excludes:**
- `browser_specific_settings` (Firefox-only)
- `data_collection_permissions` (Firefox-only)
- `sidebar_action` (Firefox-only)
- `theme_icons` (Firefox-only)
- `browser_style` (Firefox-only)

**Icon Strategy:** Uses smaller `icon.png` for sizes 16/32/48, `logo-*.png` for larger sizes

## Common Features

Both platforms share:
- Base manifest structure (manifest_version, name, description, version)
- Same icons directory
- Same permissions (except sidepanel)
- Same host permissions (Google APIs)
- Same background service worker
- Same content scripts and matches
- Same commands
- Same web accessible resources
- Same oauth2 configuration

## Commands

```bash
# Full build (both platforms)
npm run build

# Package for distribution
npm run package-firefox      # Creates Firefox ZIP
npm run package-chromium     # Creates Chromium ZIP

# Both packaging commands
npm run package-firefox && npm run package-chromium
```

## File Changes Flow

```
src/manifest-*.json
        ↓
    [loadManifestForPlatform()]
        ↓
    [updateVersion from package.json]
        ↓
dist/dist-{platform}/manifest.json
        ↓
    [copyDirectory for assets]
        ↓
dist/dist-{platform}/ (complete extension)
        ↓
    [archiver ZIP creation]
        ↓
releases/RanobeGemini_v*.*.*.zip
```

## Design Principles

1. **Source of Truth**: Each platform has its own manifest source file
2. **No Runtime Modification**: Manifests are used as-is, no transformation
3. **Clean Separation**: Firefox-specific and Chromium-specific properties are never mixed
4. **Efficient**: Single copy of shared assets, fast build process
5. **Maintainable**: Clear structure makes it easy to add new features or platforms

## Adding a New Platform

1. Create `src/manifest-{platform}.json` with appropriate properties
2. Update `dev/build-cross-platform.js` `loadManifestForPlatform()` if needed
3. Create packaging script `dev/package-{platform}.js`
4. Add npm script to `package.json`

## Troubleshooting

**Manifest validation errors?**
- Check the platform-specific source manifest for correct syntax
- Ensure version numbers are compatible with target browser

**Missing assets in ZIP?**
- Verify source directories exist in `src/`
- Check `itemsToCopy` in build script includes all needed directories

**ZIP creation fails?**
- Ensure `releases/` directory exists
- Check disk space and file permissions
