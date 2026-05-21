# Ranobe Gemini v5.0.0 Release Notes

Release date: May 21, 2026
Branch: main
Status: Stable

---

## Overview

v5.0.0 is the most substantial update since the extension's first public release. It completes the content-runtime modularization effort started in v4.7, ships a full cloud-sync expansion with three new storage providers, introduces swipe navigation for library modals, overhauls the UI filter and AI provider configuration panels, redesigns the popup, and includes a wide range of handler, stability, and security improvements.

Quick summary:

- Content runtime broken into focused modules (Phase 10); `content.js` significantly thinned
- UI/UX filter panel overhaul and AI provider configuration redesign (Phase 11)
- Swipe and drag gesture navigation for novel modals in the library (Phase 12)
- Storage adapter expansion: WebDAV, OneDrive (MS Graph), and Dropbox support with multi-sync fan-out (Phase 13)
- Shared OAuth PKCE infrastructure; OneDrive URL path bug fixes (Phase 15)
- Popup redesigned to be compact, stats-aware, and minimal
- ScribbleHub and Ranobes handlers improved with better metadata extraction
- Popup fatal error (`shortSummaryPrompt is not defined`) fixed

---

## Major Features

### 1. Content Runtime Modularization (Phase 10)

What changed:

- Extracted novel context management into `src/content/modules/novel-context.js`.
- Deleted orphaned inline function stubs from `content.js` that were already delegated to modules.
- Final orchestrator cleanup: `content.js` reduced by several thousand lines.
- Full `background.js` reduction was also completed in prior minor iterations.

Why this matters:

- Smaller, focused files are easier to maintain and audit.
- Module boundaries make it safe to add new reading intelligence features without touching the monolith.
- Clears the way for future extraction of enhancement, summarization, and read-aloud runtime blocks.

### 2. UI Filter Panel and AI Provider Configuration Overhaul (Phase 11)

What changed:

- All site library CSS now has deduplicated blocks (Phase 11-U1).
- Added a Display settings panel with per-filter visibility controls, allowing users to hide unwanted filter chips (Phase 11-U2).
- Replaced AI provider and backup provider dropdowns with tab-style pill selectors throughout the library settings panel (Phase 11-U3).

Why this matters:

- Pill selectors are more visually scannable and reduce accidental selection of the wrong provider.
- Filter visibility controls make the library toolbar less cluttered for users with focused reading workflows.

### 3. Swipe and Drag Navigation for Novel Modals (Phase 12)

What changed:

- Horizontal swipe on mobile and horizontal drag on desktop now navigate to the previous or next novel in the library modal.
- Works independently of the existing vertical swipe-to-dismiss gesture — horizontal and vertical axes are separated by angle threshold.
- Slide-in animation plays in the appropriate direction when navigating.
- Navigation state is bound to the modal lifecycle and cleaned up on close.

Why this matters:

- Browsing a novel list without returning to the shelf grid is now natural on touch devices.
- Reduces tap depth for users comparing novels.

### 4. Cloud Sync Expansion — WebDAV, OneDrive, Dropbox (Phase 13)

What changed:

- Added `src/utils/oauth-pkce.js`: shared PKCE OAuth2 helpers used by all new cloud providers.
- Added `src/utils/onedrive.js`: full Microsoft Graph API integration (PKCE OAuth2, folder creation, file upload/download, continuous backup).
- Added `src/utils/dropbox.js`: Dropbox API v2 integration (PKCE OAuth2, offline refresh tokens, paginated folder listing, upload/download).
- Added `src/background/storage/adapters/webdav-storage.js`: WebDAV protocol adapter (PROPFIND, PUT, GET, MKCOL, Basic Auth).
- Added `src/background/storage/adapters/onedrive-storage.js` and `dropbox-storage.js`: thin adapter wrappers.
- Rewrote `src/background/storage/storage-orchestrator.js`: supports a `syncDestinations` array for fan-out writes to multiple providers simultaneously, with primary-only reads and fire-and-forget secondary writes.

All three providers follow the same StorageInterface contract — they are drop-in replacements for each other.

Why this matters:

- Users who do not use Google Drive can now sync to Microsoft OneDrive, Dropbox, or any self-hosted WebDAV server (Nextcloud, Seafile, etc.).
- Multi-sync lets users back up to two destinations simultaneously (e.g., Drive + WebDAV) without extra manual steps.

### 5. OAuth PKCE Infrastructure and OneDrive Bug Fixes (Phase 15)

What changed:

- Extracted shared PKCE pair, flow launch, and token exchange helpers into `oauth-pkce.js` so all OAuth providers share one implementation.
- Fixed OneDrive `ensureFolder` double-colon URL construction bug that caused folder creation to fail on first use.
- Fixed accumulated path segment bug in the old folder-creation loop.

Why this matters:

- Consistent, audited OAuth2 implementation across all providers reduces security risk.
- OneDrive sync now works correctly from first use without silent failures.

### 6. Popup Redesign

What changed:

- Removed all inline styles from `popup.html` — layout is now entirely CSS-class-driven.
- Compacted the header: small 22px logo, 14px title, minimal library shortcut button.
- Added a stats row below the header showing live Novels, Chapters, and Shelves counts (wired to existing `statNovels`, `statChapters`, `statShelves` ids in popup.js).
- Fixed accent color variables: the popup now uses blue (#3b82f6) and purple (#8b5cf6) as accents instead of gray.
- Minimum width reduced from 600px to 380px for a more standard popup form factor.
- Config tab: cleaner section structure, no inline styles.
- Novels tab: cleaner filter bar, section headings, empty states.

### 7. Handler Improvements

**ScribbleHub:**

- Added word count (`words`) extraction from stats items.
- Added status field extraction from novel pages.
- Added author fallback from `#authorid` on novel pages.

**Ranobes:**

- `getSiteIdentifier()` now returns "Ranobes" (not "Ranobes.top").
- `getDefaultPrompt()` and `getSiteSpecificPrompt()` both use the single `DEFAULT_SITE_PROMPT` constant (no more duplicated strings).
- `getMetadataSourceUrl()` uses the current hostname so ranobes.net, ranobes.top, ranobes.com, and ranobes.org all work correctly.
- Shelf icon updated to use ranobes.net favicon (with top fallback).
- `DEFAULT_SITE_PROMPT` corrected for grammar and consistency.

### 8. Bug Fixes

- **Popup fatal error fixed**: `shortSummaryPrompt is not defined` — missing `const shortSummaryPrompt = document.getElementById("shortSummaryPrompt")` declaration added.
- **Popup stability fixes** (from Phase 10): dual-slot AI persistence and novel detection logic stabilized.
- **Content runtime corruption recovery** (Phase 10): recovered `logger.js` and `content.js` from a corrupted state.
- **Background.js emoji encoding** (Phase 10): all non-ASCII characters escaped to prevent mojibake on ISO-8859-1 host pages.

---

## Breaking Changes

None. All changes are additive or internal refactors. Existing settings and library data carry forward without migration.

---

## Storage Provider Setup Notes

The three new sync providers require user-supplied credentials:

| Provider  | What to provide                                | Where                             |
|-----------|------------------------------------------------|-----------------------------------|
| OneDrive  | Azure App (Entra) client ID                    | Library Settings &#8594; Sync &#8594; OneDrive  |
| Dropbox   | Dropbox App Key (OAuth app)                    | Library Settings &#8594; Sync &#8594; Dropbox   |
| WebDAV    | Server URL + username + password               | Library Settings &#8594; Sync &#8594; WebDAV    |

None of these credentials leave the browser. Auth tokens are stored in `browser.storage.local`.

---

## File Inventory (New Files)

```
src/utils/oauth-pkce.js
src/utils/onedrive.js
src/utils/dropbox.js
src/background/storage/adapters/webdav-storage.js
src/background/storage/adapters/onedrive-storage.js
src/background/storage/adapters/dropbox-storage.js
src/content/modules/novel-context.js
docs/release/RELEASE_NOTES_5.0.0.md
```

---

## Quick Summary

v5.0.0 completes the content runtime modularization, ships three new cloud sync providers (WebDAV / OneDrive / Dropbox), adds horizontal swipe navigation in library modals, overhauls the UI filter and AI provider panels, redesigns the popup for a minimal and compact feel, fixes a fatal popup boot error, and improves the ScribbleHub and Ranobes site handlers.
