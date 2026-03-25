# Landing Code Audit

Date: 2026-03-25
Scope: `landing/` code files only (sample directory intentionally excluded)
Goal: verify function behavior, docs representation parity, and add follow-up TODO tracking.

## Audit Coverage

Checked files:
- `landing/index.html`
- `landing/architecture.html`
- `landing/content-styles.html`
- `landing/drive-setup.html`
- `landing/install-guide.html`
- `landing/novel-status.html`
- `landing/privacy.html`
- `landing/terms.html`
- `landing/oauth-redirect.html`
- `landing/script.js`
- `landing/nav.js`
- `landing/drive-setup.js`

## Function Check Summary

### landing/script.js
- `createStatusBadge`: OK
- `renderBrowsers`: OK
- `renderSites`: OK
- `showLibraryButton`: OK
- `hideLibraryButton`: OK
- `updateLibraryButton`: OK
- `pingExtension`: OK
- `probeExtensionById`: OK
- `detectExtension`: OK
- `detectBrowser`: OK
- `buildLibraryUrl`: Fixed to prefer runtime-discovered URL and use safer fallback
- `updateCtaLibraryButton`: OK

### landing/nav.js
- `openMenu`: OK
- `closeMenu`: OK
- click/outside/Escape handlers: OK

### landing/drive-setup.js
- `buildRedirect`: OK
- `setText`: OK
- `applyConfig`: OK
- `applyRuntimeHints`: OK

### landing/install-guide.html (inline IIFE)
- `formatRedirect`: OK
- `sync`: OK

### landing/architecture.html (inline script)
- `initMermaid`: OK
- `showFallback`: OK
- `runMermaid`: OK

### landing/content-styles.html (inline script)
- `setTheme`: OK
- `openLibrarySettings`: OK
- `getExtensionStorage`: OK
- `escapeHtml`: OK
- `buildCustomBoxCss`: OK
- `renderCustomBoxList`: OK
- `loadCustomBoxTypes`: OK
- `applyPlayground`: OK
- `bindPlayground`: OK

### landing/oauth-redirect.html (inline script)
- Entire document structure was invalid and nested incorrectly: fixed
- `detectBrowser`: OK
- `dedupe`: OK
- `probeExtension`: OK
- `tryOpenLibrary`: OK

### Inline openLibrarySettings (HTML pages)
- Present in index/drive-setup/novel-status/privacy/terms/content-styles: behavior consistent

## Landing <-> Docs Parity Notes

Implemented now:
- Added a dedicated Docs section on `landing/index.html` with direct links to canonical docs folders/files.
- Implemented centralized dynamic versioning through `landing/version.js` and wired it into all landing pages.
- Converted footer version labels to `.version-display` placeholders so they always resolve from `package.json` (local or GitHub raw fallback).

## TODO

- [ ] Consolidate duplicated inline `openLibrarySettings()` into one shared script to reduce drift.
- [ ] Replace `javascript:void(0)` nav links with button elements for cleaner semantics and accessibility.
- [x] Add automated/dynamic mechanism to keep landing footer version synchronized with `package.json`.
- [ ] Add CI lint/validation pass for `landing/*.html` to catch malformed documents earlier.
- [ ] Expand docs parity checks to ensure each landing page has at least one canonical docs link.
