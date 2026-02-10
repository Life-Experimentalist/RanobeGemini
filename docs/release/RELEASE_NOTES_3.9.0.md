# Ranobe Gemini — Release 3.9.0

Release date: 2026-02-10

Overview
--------

Version 3.9.0 focuses on smarter reading-progress handling, stronger site handler stability, and a handful of quality-of-life and backup improvements. This release introduces progress-aware reading-status rules (so the app can infer "reading" vs "completed" from chapters), improves the Ranobes handler to respect site bookmarks as a reading-status signal, fixes FanFiction redirect behavior and initialization issues, and moves several prompts and site settings into centralized library/site-settings flows that are included in backups.

Highlights
----------

- Progress-aware reading status: the extension now derives reading status from current chapter and total chapters (auto-mark completed when you reach the last chapter, prefer "plan to read" for 0 progress, etc.). This logic is applied when adding novels, updating progress on visit, and during the quick progress prompt.
- Ranobes handler: reads the site bookmark/tab state and maps site-side bookmark tabs to library reading-status (e.g., "reading now" → `reading`, "plan to read" → `plan-to-read`).
- FanFiction handler: fixed the www vs mobile redirect preference and wrapped initialization to avoid parse/runtime issues in content script contexts.
- Library API: `updateReadingProgress` accepts an optional `totalChapters` option; `createNovelFromContext` and add/update flows use a unified derive-reading-status helper so status decisions are consistent across handlers.
- UI & Backup: prompts were moved into Library settings, site settings are now included in backups, and the notification bell click issue was fixed.

Detailed changes
----------------

Added
- Progress-derived status helper: the content script and library include a `deriveReadingStatusFromProgress(currentChapter, totalChapters)` helper used to compute the next logical status when progress changes.
- Automatic site-reading-status mapping for Ranobes via bookmark/tab metadata extraction.
- Backup support for site settings so users' per-site preferences are preserved in backups.

Changed
- `updateReadingProgress(novelId, chapterNumber, chapterUrl, options)` now accepts an `options.totalChapters` value to improve decision-making when handlers provide different chapter counts.
- Auto-add/add-on-visit flows now prefer progress-derived or site-provided `readingStatus` and respect `editedFields` protection when merging updates.
- Moved progress prompts and related toggles into the Library settings UI for clearer control and fewer in-page interruptions.

Fixed
- FanFiction redirect logic (www-only preference) and initialization errors that could cause parse/runtime issues in some pages.
- Notification bell click handler that previously failed on some pages.
- Several small handler extraction edge-cases across Ranobes and other websites.

Developer / Internal
- Handler initialization pattern hardened: handlers that run in content contexts are more defensive (try/catch) to avoid breaking page parsing.
- Build-time changelog and release notes added for 3.9.0.

Upgrade and migration notes
-------------------------

- No database migration is required. However, because reading-status inference is now automatic, users may see a handful of novels mark as `completed` or `reading` after the first auto-update if the stored chapter counts indicate completion — this is intentional and can be reversed via the library UI.
- If you modified any handler code or site-settings manually, ensure those preferences are included in your next backup export (site settings are now backed up automatically).

QA and verification checklist
---------------------------

- Run the build/watch scripts and load the extension in a browser for smoke tests.
- Visit a Ranobes novel page and confirm the bookmark→status mapping applies as expected.
- Visit a FanFiction chapter page and confirm no redirect loops occur and the redirect preference (www vs mobile) behaves correctly.
- Use the Library settings to confirm prompts and site-settings are present and included in the backup export.

Credits
-------

Thanks to the contributors and maintainers who helped diagnose handler initialization issues and refine the progress→status rules.

Store Copy — Short versions
--------------------------

Firefox Add-on store (short):

Ranobe Gemini 3.9.0 — Smarter progress tracking and stability. Auto-detect reading status from chapters, improved Ranobes & FanFiction support, and backup-friendly site settings.

Edge Add-on store (short):

Ranobe Gemini 3.9.0 — Smarter reading progress, improved site handlers (Ranobes, FanFiction), and reliability fixes for a smoother reading experience.
