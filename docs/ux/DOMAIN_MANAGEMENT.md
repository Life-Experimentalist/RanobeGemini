# Website Handlers & Domain Management

## Overview

The website handler system automatically manages domain permissions across all browser manifests. When you add or update website handlers, the `update-domains` script synchronizes all manifest files.

## Table of Contents

- [Website Handlers \& Domain Management](#website-handlers--domain-management)
	- [Overview](#overview)
	- [Table of Contents](#table-of-contents)
	- [How It Works](#how-it-works)
		- [1. Website Handlers](#1-website-handlers)
		- [2. Domain Extraction](#2-domain-extraction)
		- [3. Pattern Generation](#3-pattern-generation)
		- [4. Manifest Synchronization](#4-manifest-synchronization)
	- [Usage](#usage)
		- [Adding a New Website](#adding-a-new-website)
		- [Publishing with Domain Updates](#publishing-with-domain-updates)
	- [Scripts](#scripts)
		- [`npm run update-domains`](#npm-run-update-domains)
		- [`npm run build`](#npm-run-build)
		- [`npm run package-firefox`](#npm-run-package-firefox)
		- [`npm run package-chromium`](#npm-run-package-chromium)
	- [File Structure](#file-structure)
	- [Domain Pattern Examples](#domain-pattern-examples)
	- [Key Points](#key-points)
	- [Troubleshooting](#troubleshooting)
	- [Best Practices](#best-practices)

## How It Works

### 1. Website Handlers

Each supported website has a handler file in `src/utils/website-handlers/`:

```javascript
// Example: src/utils/website-handlers/ranobes-handler.js
export class RanobesHandler extends BaseHandler {
  static SUPPORTED_DOMAINS = [
    "ranobes.com",
    "ranobes.net",
    "ranobes.org",
    "ranobes.top"
  ];
  // ... handler code
}
```

### 2. Domain Extraction

The `generate-manifest-domains.js` script:
- Reads all `*-handler.js` files
- Extracts `SUPPORTED_DOMAINS` arrays
- Skips duplicate domains automatically
- Generates browser-compatible wildcard patterns

### 3. Pattern Generation

Converts explicit domains to wildcard patterns:

```regex
ranobes.com  →  *://*.ranobes.com/*
```

This pattern matches:
- `https://ranobes.com/`
- `https://www.ranobes.com/`
- `https://m.ranobes.com/`
- `https://any-subdomain.ranobes.com/`

### 4. Manifest Synchronization

Updates both platform-specific manifests:
- `src/manifest-firefox.json`
- `src/manifest-chromium.json`

Both files receive identical domain patterns in:
- `content_scripts[0].matches`
- `web_accessible_resources[0].matches`

## Usage

### Adding a New Website

1. Create handler file:

```bash
# src/utils/website-handlers/newsite-handler.js
export class NewsiteHandler extends BaseHandler {
  static SUPPORTED_DOMAINS = [
    "newsite.com",
    "www.newsite.com"
  ];
  // ... implementation
}
```

1. Update domains:

```bash
npm run update-domains
```

1. Rebuild and test:

```bash
npm run build
npm run package-firefox
npm run package-chromium
```

### Publishing with Domain Updates

```bash
npm run publish
```

This automatically:
1. Runs `npm run update-domains` - Updates both manifests
2. Runs `npm run package` - Builds and packages both versions
3. Runs `npm run package-source` - Packages source for review

## Scripts

### `npm run update-domains`

Extracts domains from all handlers and updates both manifests.

**Output:**

```console
🔄 Updating manifest domains for all platforms...

📝 Reading Firefox manifest...
🔍 Extracting domains from handlers...
Found 16 unique domains
🔨 Generating match patterns...
✅ Updated content_scripts (9 patterns)
✅ Updated web_accessible_resources (9 patterns)
💾 Writing Firefox manifest...
✨ Firefox manifest updated

📝 Reading Chromium manifest...
...
```

### `npm run build`

Generates `dist/` folders for both platforms with synced manifests.

### `npm run package-firefox`

Creates Firefox ZIP from latest manifest state.

### `npm run package-chromium`

Creates Chromium ZIP from latest manifest state.

## File Structure

```file-structure
src/
├── manifest-firefox.json      ← Auto-updated by generate-manifest-domains.js
├── manifest-chromium.json     ← Auto-updated by generate-manifest-domains.js
└── utils/website-handlers/
    ├── ao3-handler.js
    ├── fanfiction-handler.js
    ├── ranobes-handler.js
    ├── scribblehub-handler.js
    ├── webnovel-handler.js
    └── base-handler.js

dev/
├── generate-manifest-domains.js   ← Updates manifest domain permissions
├── build-cross-platform.js        ← Builds both platforms
├── package-firefox.js             ← Packages Firefox
├── package-chromium.js            ← Packages Chromium
├── package-source.js              ← Packages source for review
└── package-all.js                 ← Orchestrates full workflow
```

## Domain Pattern Examples

| Explicit Domain | Generated Pattern      | Matches                                                      |
| --------------- | ---------------------- | ------------------------------------------------------------ |
| ranobes.com     | *://*.ranobes.com/*    | ranobes.com, www.ranobes.com, m.ranobes.com, any.ranobes.com |
| ao3.org         | *://*.ao3.org/*        | ao3.org, archiveofourown.org (via handler)                   |
| fanfiction.net  | *://*.fanfiction.net/* | fanfiction.net, www.fanfiction.net                           |

## Key Points

1. **Source of Truth**: Handler `SUPPORTED_DOMAINS` arrays
2. **Automatic Sync**: Both Firefox and Chromium manifests get identical patterns
3. **No Manual Editing**: Update handlers, run `npm run update-domains`
4. **Browser Compatible**: Patterns work across all supported browsers
5. **Wildcard Safe**: Prevents duplicate wildcard entries

## Troubleshooting

**Domains not updating?**

```bash
npm run update-domains
npm run build
```

**Script can't find handler?**
- Ensure file ends with `-handler.js`
- Ensure `SUPPORTED_DOMAINS` is a static array
- Run from project root

**ZIP doesn't have new domains?**

```bash
npm run build         # Rebuild with latest manifests
npm run package-*     # Repackage
```

## Best Practices

1. Always run `npm run update-domains` after adding/changing handlers
2. Test locally with `npm run build` before packaging
3. Run full `npm run publish` for AMO/Chrome Web Store submissions
4. Keep domain names consistent across handlers and manifests
