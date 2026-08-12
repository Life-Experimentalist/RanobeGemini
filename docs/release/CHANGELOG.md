# Changelog

> **Index:**

- [Changelog](#changelog)
  - [Unreleased](#unreleased)
  - [5.0.0 - 2026-06-03](#500---2026-06-03)
  - [4.6.0 - 2026-03-25](#460---2026-03-25)
    - [Highlights](#highlights)
    - [Added](#added)
    - [Changed](#changed)
    - [Fixed](#fixed)
	- [4.4.0 - 2026-03-17](#440---2026-03-17)
		- [Highlights](#highlights)
		- [Added](#added)
		- [Changed](#changed)
		- [Fixed](#fixed)
	- [4.3.0 - 2026-03-15](#430---2026-03-15)
		- [Highlights](#highlights-1)
		- [Added](#added-1)
		- [Changed](#changed-1)
		- [Fixed](#fixed-1)
	- [4.2.0 - 2026-03-12](#420---2026-03-12)
		- [Highlights](#highlights-2)
		- [Added](#added-2)
		- [Changed](#changed-2)
		- [Fixed](#fixed-2)
	- [4.1.0 - 2026-03-08](#410---2026-03-08)
		- [Highlights](#highlights-3)
		- [Added](#added-3)
		- [Changed](#changed-3)
		- [Fixed](#fixed-3)
	- [4.0.0 - 2026-03-06](#400---2026-03-06)
		- [Highlights](#highlights-4)
		- [Added](#added-4)
		- [Changed](#changed-4)
		- [Fixed](#fixed-4)
	- [3.9.0 - 2026-02-10](#390---2026-02-10)
		- [Highlights](#highlights-5)
		- [Added](#added-5)
		- [Changed](#changed-5)
		- [Fixed](#fixed-5)
	- [3.7.0 - 2026-01-30](#370---2026-01-30)
		- [🔧 Google Drive OAuth Enhancements \& UI Improvements](#-google-drive-oauth-enhancements--ui-improvements)
		- [Added](#added-6)
			- [☁️ Google Drive OAuth Improvements](#️-google-drive-oauth-improvements)
			- [💾 Comprehensive Backup System](#-comprehensive-backup-system)
			- [📊 Anonymous Analytics (Opt-Out)](#-anonymous-analytics-opt-out)
			- [📢 Enhanced Notification System](#-enhanced-notification-system)
			- [🎯 Domain-Specific Settings](#-domain-specific-settings)
			- [📖 Reading Progress Tracking](#-reading-progress-tracking)
		- [Changed](#changed-6)
			- [🖥️ Popup UI Refactoring](#️-popup-ui-refactoring)
			- [🌐 Website Handler Improvements](#-website-handler-improvements)
			- [📚 Library Enhancements](#-library-enhancements)
			- [🏗️ Build System \& Documentation](#️-build-system--documentation)
		- [Fixed](#fixed-6)
			- [🐛 Bug Fixes](#-bug-fixes)
			- [🔧 Google Drive OAuth](#-google-drive-oauth)
		- [Developer Experience](#developer-experience)
			- [🛠️ Code Quality](#️-code-quality)
		- [Technical Details](#technical-details)
			- [Google Drive OAuth Flow](#google-drive-oauth-flow)
			- [Popup Initialization Fix](#popup-initialization-fix)
		- [Migration Notes](#migration-notes)
		- [Known Issues](#known-issues)
	- [3.5.0 - 2025-12-20](#350---2025-12-20)
		- [🎨 Shelf Pages, Analytics \& UX Improvements](#-shelf-pages-analytics--ux-improvements)
		- [Added](#added-7)
			- [📊 Website Shelf Pages](#-website-shelf-pages)
			- [🎨 Popup Modal Improvements](#-popup-modal-improvements)
			- [🏗️ Keep-Alive Architecture Documentation](#️-keep-alive-architecture-documentation)
		- [Changed](#changed-7)
		- [Fixed](#fixed-7)
		- [Documentation](#documentation)
	- [3.0.0 - 2025-11-28](#300---2025-11-28)
		- [🎉 Major Release: Novel Library System](#-major-release-novel-library-system)
		- [Added](#added-8)
			- [📚 Novel Library System](#-novel-library-system)
			- [🔧 Dynamic Shelf System](#-dynamic-shelf-system)
			- [🎨 UI Enhancements](#-ui-enhancements)
			- [📖 Metadata Extraction](#-metadata-extraction)
			- [📝 Documentation Overhaul](#-documentation-overhaul)
		- [Changed](#changed-8)
			- [🏗️ Architecture Improvements](#️-architecture-improvements)
			- [📚 Documentation](#-documentation)
		- [Fixed](#fixed-8)
		- [Developer Experience](#developer-experience-1)
			- [Adding New Website Support (Simplified)](#adding-new-website-support-simplified)
			- [Build Scripts](#build-scripts)
		- [Technical Details](#technical-details-1)
			- [Novel Library Schema](#novel-library-schema)
			- [Shelf Metadata Schema](#shelf-metadata-schema)
		- [Migration Notes](#migration-notes-1)
	- [2.9.0 - 2025-11-25](#290---2025-11-25)
		- [Summary](#summary)
		- [Added](#added-9)
		- [Changed](#changed-9)
		- [Fixed](#fixed-9)
	- [2.8.0 - 2025-11-25](#280---2025-11-25)
		- [Summary](#summary-1)
		- [Added](#added-10)
		- [Changed](#changed-10)
		- [Fixed](#fixed-10)
		- [Developer Experience](#developer-experience-2)
		- [Migration Notes](#migration-notes-2)
		- [Known Issues](#known-issues-1)
	- [2.2.1 - 2025-04-26](#221---2025-04-26)
		- [Summary](#summary-2)
		- [Added](#added-11)
		- [Changed](#changed-11)
		- [Fixed](#fixed-11)
	- [2.2.0 - 2025-04-19](#220---2025-04-19)
		- [Summary](#summary-3)
		- [Added](#added-12)
		- [Changed](#changed-12)
		- [Fixed](#fixed-12)
	- [2.1.0 - 2025-04-15](#210---2025-04-15)
		- [Summary](#summary-4)
		- [Added](#added-13)
		- [Changed](#changed-13)
		- [Fixed](#fixed-13)
	- [2.0.0 - 2025-04-13](#200---2025-04-13)
		- [Summary](#summary-5)
		- [Added](#added-14)
		- [Changed](#changed-14)
		- [Fixed](#fixed-14)
	- [1.1.0 - 2025-04-10](#110---2025-04-10)
		- [Added](#added-15)
		- [Changed](#changed-15)
		- [Fixed](#fixed-15)
	- [1.0.0 - 2025-06-15](#100---2025-06-15)
		- [Added](#added-16)
		- [Fixed](#fixed-16)

All notable changes to the RanobeGemini extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## Unreleased

Work since the 5.0.0 tag, from a full production-readiness audit. Findings and
their resolutions are recorded in
[PRODUCTION_READINESS_AUDIT.md](../development/PRODUCTION_READINESS_AUDIT.md).

### Changed

- **LoreWeave is now experimental and off by default.** 5.0.0 shipped it as a
  headline feature while its content-side integration was not actually wired up.
  It is now behind an explicit opt-in (Settings -> Experimental) and documented as
  experimental everywhere it is mentioned, rather than presented as finished.
- **Story Chat settings now take effect.** Every toggle in the Chat settings
  panel was previously written to storage and read by nothing — see UX-6 in the
  audit. Context sources, history depth, and the LoreWeave gate are all honoured;
  the web-search toggle, which had no implementation behind it at all, was
  removed.
- **Telemetry consent no longer misstates the default.** A dialog that could not
  be opened told users analytics was "enabled by default" when it defaults to
  off. Removed, and its collect/never-collect disclosure moved to Library
  Settings -> Analytics & Diagnostics, which previously had toggles but no
  statement of what is sent.
- **The five per-site shelf pages are unified** behind a shared core with
  per-site configuration, so each site keeps the fields it actually has.
- **The default model is now Gemini 3 Flash Preview**, with Gemini 2.5 Flash as
  the fallback. The model list itself moved into `src/utils/constants.js`: the
  same three `<option>` blocks had been pasted across four files and had already
  drifted apart, and the per-model context budget was an if/else chain in
  `background.js` that silently dropped any unlisted model to the default. Both
  now travel with the model definition. This list is only the no-API-key
  fallback — once a key is saved the dropdowns are filled from Google's live
  `models` endpoint.
- **CI now builds on a Node version that still exists.** Every workflow pinned
  Node 20, which reached end-of-life in April 2026 — the gate that decides
  whether a release may ship to the stores was running on a runtime that no
  longer receives security fixes. All three workflows now use Node 24, the
  Active LTS line, and `package.json` raises its `engines.node` floor to
  `>=22.13.0` (the oldest line still supported, and the oldest ESLint 10
  accepts). Node 26 is Current rather than LTS, so it is deliberately not used.
  The pinned action majors were bumped alongside it and each version was
  verified against the GitHub API rather than assumed: `actions/checkout@v7`,
  `actions/setup-node@v7`, `actions/upload-artifact@v7`, `configure-pages@v6`,
  `upload-pages-artifact@v5`, `deploy-pages@v5`. checkout v7's breaking change
  only affects fork-PR checkout under `pull_request_target` / `workflow_run`,
  neither of which these workflows use.
- **Dependabot now watches both things CI depends on.** There was no
  `.github/dependabot.yml` at all, which is how the Node line went end-of-life
  unnoticed. It now tracks npm devDependencies and the GitHub Actions majors on
  a weekly schedule, grouped so the toolchain arrives as one reviewable PR
  rather than six, with a cooldown so a freshly published version has time to be
  yanked or patched before it reaches a PR.
- **ESLint 8 -> 10, on flat config.** `.eslintrc.json` is replaced by
  `eslint.config.mjs`; ESLint 9 dropped the rc format as the default and 10
  removed the compatibility path, so this was a migration rather than a bump.
  `env` became explicit `languageOptions.globals` and `ignorePatterns` became a
  global `ignores` block. The upgrade paid for itself immediately — see Fixed.
  `caughtErrors` is pinned back to ESLint 8's `"none"` deliberately: the 9
  default flags every `catch (e) { return null; }`, and ~150 of those would have
  buried the warnings that mean something.
- **Dependency upgrades**: archiver 5 -> 8 (ESM-only, and it dropped the callable
  default export, so all three packaging scripts now construct `ZipArchive`
  directly), dotenv 16 -> 17, prettier 3.9, globals 17, linkedom 0.18. The stale
  `brace-expansion` override was removed rather than re-pinned — it forced 2.1.4
  while `minimatch@10` needs `^5.0.8` and its ESM named export, which broke
  `npm run package` outright. `npm audit` reports 0 vulnerabilities without it.

### Added

- **A reading typeface you can choose, bundled with the extension.** Library ->
  Settings -> General -> Reading Text now offers a typeface for enhanced
  chapter text: Literata, Merriweather, Atkinson Hyperlegible or Inter, all
  shipped inside the extension, plus Georgia, your system's own sans, and the
  site's default for anyone who wants no change at all. Nothing is downloaded
  while you read. The honest version of why these four: there is no font that is
  simply read faster than another, so each is described by what it was actually
  drawn for — Literata for long-form screen reading, Merriweather for a large
  x-height, Atkinson Hyperlegible for pulling `I`, `l` and `1` apart, Inter for
  open apertures on screens — and the choice is left to the reader, whose own
  familiarity with a face matters more than any of it. Every bundled family is
  SIL Open Font License 1.1; the licence text ships beside the files and
  `dev/fetch-fonts.js` refuses to write a family whose licence it cannot verify.
  ScribbleHub and Ranobes can also override the choice for that site alone, from
  their cards in Library -> Settings -> Sites.
- **Optional encrypted backups (AES-GCM-256), off by default.** Turning on
  Library -> Settings -> Local Backups -> *Encrypt backup files* wraps exported
  files and cloud backups (Drive, OneDrive, Dropbox, WebDAV) in an authenticated
  envelope. The 256-bit key is generated on the machine and never leaves it; a
  Crockford-base32 recovery code carries it to another browser, because
  `browser.storage.sync` rides the Firefox or Chrome account and never crosses
  between them. Plaintext export stays the default, import auto-detects the
  envelope, and backups made before this existed still restore. Native browser
  sync is deliberately excluded: it writes to `browser.storage.sync`, which is
  where the key lives, so encrypting there would be decorative.
- **A test suite.** 266 tests under `tests/`, run with `node --test`. That now
  includes extraction tests for all eight website handlers, driven by reduced
  HTML fixtures in `tests/fixtures/` — the layer most exposed to a site changing
  its markup, and previously the layer with nothing pinning it. Each fixture
  deliberately carries markup the handler is meant to strip plus one sentence of
  ordinary prose, so a test fails both when extraction loses content and when it
  mangles it.
- **A CI quality gate** (`.github/workflows/ci.yml`) running lint, format check,
  tests, emoji scan, and a both-target build on every push and pull request. A
  release tag can no longer publish without passing it.
- **A `.prettierignore`**, so formatting stops at the edge of vendored and
  generated code — `npm run format` had been un-minifying the bundled
  `browser-polyfill.min.js`.
- **`SECURITY.md`** — private vulnerability reporting, and an explicit statement
  of what data leaves the browser and where it goes.

### Fixed

- **Per-site settings did nothing.** The custom CSS, font size, and any other
  field a site card exposes in Library -> Settings -> Sites were saved correctly
  and then read from the wrong place: the content script asked the background for
  the handler's proposed-settings schema, which is a different, metadata-only
  list keyed by domain rather than by shelf id. Both mismatches resolved to
  `undefined`, so the settings applied silently to nothing and nothing was
  logged. The content script now reads the same per-site store the Library writes
  to, and a test fails the build if the two ever diverge again. Ranobes' font
  size field, which uses a different key name, is honoured too.
- **The landing origin was authored in three places that had to agree.** The
  OAuth redirect URI, the background worker's sender guard, and the
  landing-bridge match pattern in both manifests were each typed out separately,
  and the manifest synchroniser deliberately skipped the bridge entry. If they
  drifted, the bridge would run on a page the worker then refused to hear — an
  OAuth sign-in that hangs on mobile with no error on either side. The guard and
  both manifests are now derived from the single constant, and the chain is
  asserted by tests.
- **Ranobes chapters were being corrupted before the model ever saw them.** The
  ad-stripping pass carried an unanchored pattern whose every part except the
  letters `ad` was optional, so it matched "ad" anywhere in the text: *"He had
  already walked the road ahead"* was handed over as *"He halrey walked the
  roahe"*. The neighbouring "advertisement" and "sponsored" patterns had the same
  flaw and quietly deleted those words out of prose. Markers must now be anchored
  to a whole line or to a bracket pair.
- **FanFiction chapters were titled from the browser tab.** The shared
  `extractContent()` read `document.title` instead of calling the handler's own
  `extractTitle()`, so every handler that did not also override `extractContent()`
  had its title logic bypassed — chapters came through as *"Story, a fandom
  fanfic | FanFiction"*. The same method also read text off the live element
  rather than the cleaned copy, so ad slots and inline scripts sitting inside the
  content area were sent to the model as part of the chapter.
- **An import cycle that only worked by alphabetical accident.** The FanFiction
  handler reached `domain-constants.js`, which imports every handler class,
  which reached the FanFiction handler again. It threw on load whenever that
  module happened to be evaluated first; nothing but import ordering was keeping
  FanFiction working.
- **AO3 reported double the chapter count on full-work pages**, and opened
  single-chapter works down the multi-chapter path, because AO3 nests a
  `.chapter.preface` block inside every `.chapter`.
- **Permissions the extension asked for but did not need** have been dropped from
  both manifests, and the ones it does need are now declared in one place rather
  than being kept in step by hand.
- **Several timers and observers outlived the page that started them.** The worst
  was a background heartbeat that sat just under Chromium's service-worker idle
  timeout and so pinned the worker awake for the entire browser session — to
  write a debug line one time in ten. The WebNovel handler's infinite-scroll
  monitors also ran on every other supported site, because the handler registry
  constructs every handler on every page to ask which one fits.
- **The library page had an unclosed `<div>`**, which browsers were silently
  recovering from — it swallowed `</body>`, so the page's scripts sat inside a
  positioned flex container rather than at body level.
- **The AMO source package shipped local scratch files and left out the config
  its own reviewer instructions need.** It archived whole directories, so
  untracked working notes inside `docs/` went along for the ride, while the
  ESLint config was absent even though the reviewer notes say to run
  `npm run lint`.
- **The PWA manifest's icons 404'd in production** — they pointed outside the
  deployed Pages root.
- **The landing site hot-linked a 943 KB image** from `raw.githubusercontent.com`
  as its favicon, on every page.
- **The AMO reviewer build instructions did not work** — wrong script names, a
  nonexistent step, and a manifest path that does not exist.
- **Deleting a custom Story Chat box type removed the wrong one.** The index was
  read as `+e.target.closest("[data-idx]")?.dataset.idx ?? +e.target.dataset.idx`
  — but unary `+` binds tighter than `??`, so that is `NaN ?? …`, which is `NaN`.
  The fallback was unreachable, and whenever the click landed on a child with no
  `[data-idx]` ancestor the resulting `splice(NaN, 1)` deleted the *first* entry
  instead of the one clicked. Found by ESLint 10's
  `no-constant-binary-expression`.
- **Four `catch` blocks threw away the error they were reporting on.** Each
  wrapped a failure in a new `Error` without passing `{ cause }`, so the
  underlying reason — a crypto failure in `backup-crypto.js`, a restore failure
  in `comprehensive-backup.js`, a graphify call, a native-sync write — was
  unavailable to anyone debugging from the message alone.

---

## [5.0.0](RELEASE_NOTES_5.0.0.md) - 2026-06-03

### Highlights

Largest release since the initial library launch. Completes the Phase 10–15 roadmap: content runtime modularization, UI/filter redesign, swipe navigation, multi-cloud sync (WebDAV, OneDrive, Dropbox), OAuth PKCE infrastructure, popup redesign, Chapter Queue, Story Chat, LoreWeave graph, and a dedicated NovelArrow handler with full SPA support.

### Added

- **Chapter Queue** — background chapter fetch pipeline with smart grouping, progress tracking, and queue management UI in the popup
- **Story Chat** — AI Q&A panel in the popup tab, powered by the chronicle context assembled from enhanced chapters
- **LoreWeave** — character/world knowledge graph built from chapter summaries; background service, queue manager, client, and popup integration
- **NovelArrow handler** — dedicated handler for `novelarrow.com` (Next.js SPA): `/chapter/{slug}/{chapter}` URL detection, `article[data-chapter-id]` content extraction, TTS-safe in-place `p.textContent` replacement with full HTML+markdown stripping, proper `waitForChapterContent` fingerprinting so SPA navigation doesn't re-init on stale content
- **WebDAV storage adapter** — PROPFIND/PUT/GET/MKCOL with Basic Auth; works with Nextcloud, Seafile, and any RFC 4918 server
- **OneDrive storage adapter** — Microsoft Graph API integration, PKCE OAuth2, folder creation, upload/download, continuous backup
- **Dropbox storage adapter** — Dropbox API v2, PKCE OAuth2, offline refresh tokens, paginated folder listing
- **Multi-sync fan-out** — `storage-orchestrator.js` accepts a `syncDestinations` array; writes go to all destinations in parallel, reads come from the primary
- **Shared OAuth PKCE helpers** — `oauth-pkce.js` used by all cloud providers
- **Hide/Show Gemini UI toggle** — button in popup header (always visible); covers all on-page extension elements: controls bar, library bar, chunk banners, summary groups, notification banners
- **Now Reading card in popup** — title, chapter info, progress bar, library status, reading-status selector, genre tags, Add/Open/Toggle UI actions
- **`geminiUIHidden` in `getNovelInfo` response** — popup reads current state on open so the toggle button shows the correct label
- **Swipe/drag navigation for novel modals** — horizontal swipe (mobile) / drag (desktop) navigates between novels; separated from vertical swipe-to-dismiss by angle threshold
- **Display settings panel** — per-filter visibility controls let users hide unwanted filter chips in the library toolbar
- **Pill-style provider selectors** — AI provider and backup provider dropdowns replaced with tab-style pill selectors in library settings
- **NovelBin shelf page** — `src/library/websites/novelbin/` shelf page, card, and styles added
- **`resetSummaryPromptBtn`** — missing `getElementById` declaration added; resolves fatal popup init crash

### Changed

- **NovelBin handler** — `novelarrow.com` removed from `SUPPORTED_DOMAINS`; shelf name updated to "NovelBin"; `novelbin.com` as primary domain; `novelarrow.com` fully owned by the new dedicated handler
- **SPA navigation observer** — hash-only URL changes (e.g. skip-link `#main-content`) are now filtered out and no longer trigger a chapter re-init; content fingerprint uses `currentHandler.findContentArea()` instead of hardcoded `#chr-content` selectors
- **Main summary group persistence** — `.gemini-main-summary-group` (with the Enhance button) is no longer removed on re-enhancement; only inner duplicates inside `contentArea` are cleared
- **Banner selector expanded** — Hide/Show UI now covers `#gemini-controls`, `#rg-chapter-novel-controls`, `#rg-notification-banner`, `.gemini-main-summary-banner`, `.gemini-short-summary-text-container`; default state is "show"
- **Popup header** — toggle Gemini UI button added beside gear and library icons
- **Hide/Show UI button removed from all chapter control bars** — no longer appended to `#gemini-controls` or `rg-chapter-novel-controls` on any site
- **Chat `loadChatContext`** — uses `getNovelInfo` (same source as Now Reading) instead of `getNovelContext`; reliable novel ID on all supported sites
- **`debugError` / `debugWarn` synchronous** — now call `console.error`/`console.warn` directly so DevTools shows the actual caller file and line, not `logger.js`
- **Settings handler graceful fallback** — returns `{ success: true, settings: {} }` instead of an error when `getHandlerByDomain` can't find a handler in the background realm
- **Build pipeline** — `dev/build.js` skips `desktop.ini`, `thumbs.db`, `.ds_store` when copying source directories
- **Summary rendering** — `summary-service.js` strips markdown syntax (`**bold**`, `# headings`, `- lists`, etc.) from AI-generated paragraphs before `p.textContent` assignment
- **NovelArrow UI insertion** — controls inserted before `div.select-text` (between chapter header/divider and content area) so TTS paragraph enumeration is unaffected
- **`toggleGeminiUI` message** — returns `{ nowHidden }` in response so popup button state is authoritative and correct after toggle

### Fixed

- **`resetSummaryPromptBtn is not defined`** fatal popup crash — variable was used but never declared
- **Show/Hide UI toggle not restoring** — `shouldBannersBeHiddenRuntime` now reads `body.hasAttribute("data-rg-ui-hidden")` as the primary state source; toggle correctly alternates between hide and show
- **Summary group removed by cache restore** — `restoreChunkedContentFromCacheRuntime` was calling `documentRef.querySelectorAll(".gemini-main-summary-group").forEach(el => el.remove())` globally; now scoped to `contentArea` only
- **Stray markdown in enhanced/summary text** — `**bold**`, `*italic*`, `# headings`, etc. stripped via `stripMarkdown()` in `summary-service.js` and via regex HTML+markdown pipeline in `novelarrow-handler.js`
- **NovelArrow chapter URL detection** — `/chapter/{slug}/{chapter-slug}` path correctly detected; `isChapterPage()` no longer returns false for all novelarrow chapter pages
- **SPA hash navigation re-init** — clicking the "Skip to main content" accessibility link no longer tears down the enhancement state
- **Chat popup "no novel detected"** — fixed by switching from `getNovelContext` to `getNovelInfo`
- **`[SettingsHandler] Handler not found` console spam** — graceful fallback; also tries `www.`-stripped domain as secondary lookup
- **OneDrive `ensureFolder` URL double-colon bug** — folder creation no longer fails on first use
- **Popup fatal `shortSummaryPrompt is not defined`** — missing declaration added
- **ScribbleHub word count, status, author fallback** extraction added
- **Ranobes metadata consistency** — `getSiteIdentifier()`, `getDefaultPrompt()`, `getMetadataSourceUrl()` unified
- **Background emoji encoding** — non-ASCII characters escaped to prevent mojibake on ISO-8859-1 host pages

---

## [4.6.0](RELEASE_NOTES_4.6.0.md) - 2026-03-25

### Highlights

- Shareable modal deep-links now open reliably across main library and site shelf pages.
- Missing deep-link IDs now recover via prompt + timed auto-open/add flow.
- True web PWA foundation added with installable landing app entry and offline fallback.
- Automated Mermaid visual dashboard pipeline added for doc status visibility.

### Added

- `landing/manifest.webmanifest`, `landing/sw.js`, `landing/offline.html`, and `landing/library-hub.html` for web PWA entry.
- `dev/generate-doc-visualizers.js` and `npm run docs:visualize` for generated doc charts/tables.
- `docs/overview/VISUAL_DASHBOARD.md` automated visualization output.
- v4.6.0 release documentation and architecture/update references.

### Changed

- Query deep-link handling now preserves shareable params for modal flows.
- Mobile RG controls no longer force full-width for primary control groups on narrow screens.
- Landing PWA install flow now exposes install state and browser fallback messaging.

### Fixed

- Timer declaration-order and cleanup safety in deep-link recovery prompt path.
- Tab wait listener lifecycle cleanup for both success and timeout paths.

---

## [4.4.0](RELEASE_NOTES_4.4.0.md) - 2026-03-17

### Highlights

- Reading Lists split out from primary reading status so badges like `rereading`, `favourites`, and custom lists can coexist cleanly.
- Content-style documentation and landing pages were redesigned with real chapter previews, custom-box showcases, Mermaid journeys, and consistent install/footer patterns.
- Backup coverage now preserves collapsible content filter preferences and custom content box definitions across comprehensive, Drive, and rolling backup flows.
- Special content boxes now use `white-space: pre-line` for cleaner rendering of system messages, stats, quotes, and skill-style blocks.

### Added

- Reading Lists architecture and UI coverage across docs and contributor instructions.
- Public content-styles documentation page showing built-in boxes, custom boxes, actual chapter rendering, and a live playground.
- GitHub discussion templates for FAQ, ideas, Q&A, and general discussions.
- 4.4.0 release documentation covering reading lists, collapsible sections, landing improvements, and backup persistence.
- Public architecture documentation page with modular runtime, component, and backup flow diagrams.
- Hosted schema endpoint proxy at `https://ranobe.vkrishna04.me/schemas/ranobe-backup.schema.json` referencing the canonical raw schema source.

### Changed

- Landing pages now share a consistent Library navigation path, install CTA, and footer structure.
- `landing/content-styles.html` now reflects actual chapter behavior instead of abstract samples, including custom box discovery from saved library settings.
- `content.css` special content blocks now prefer `white-space: pre-line` for more natural paragraph flow without losing intentional line breaks.
- Commit-history tooling and docs were expanded to make version-relevant changes easier to review.

### Fixed

- Full/comprehensive backups now include user-defined custom content box definitions.
- Drive/download library backups now restore collapsible section preferences and custom content box types alongside the library.
- Light-theme chapter preview text and collapsible summaries on the landing docs page now maintain readable contrast.
- Drive backup history panel now reloads on every expand/toggle so users always see up-to-date Drive files.
- Architecture docs page now includes diagram fallback behavior to avoid blank content if Mermaid runtime loading fails.

---

## [4.3.0](RELEASE_NOTES_4.3.0.md) - 2026-03-15

### Highlights

- Incognito Mode — pause library tracking with configurable auto-expiry duration.
- Collapsible content sections for fight scenes, R18 content, and author notes.
- FanFiction redirect fix: Mobile ↔ Desktop switch now writes `domainPreference` to storage so `normalizeURL()` respects the user's explicit choice on every load.
- Relationship→Characters mirroring fix for all historical malformed data.
- Summary quality detection and automatic retry (`isLowQualityLongSummary`, `getSummaryOutputBudget`).

### Added

- Incognito Mode with UI controls in popup and Library Settings; configurable auto-expiry.
- Collapsible sections system for fight scenes, R18 content, and author notes; default visibility is user-configurable.
- "Hide Gemini UI during Read Aloud" toggle in Library Settings.
- `isLowQualityLongSummary()` and `getSummaryOutputBudget()` helpers in `background.js`.
- Backup model selector in popup (used automatically on primary model quota errors).
- `SITE_SETTINGS_KEY` import added to `fanfiction-mobile-handler.js`.

### Changed

- FanFiction Desktop/Mobile switcher button now saves `domainPreference` to storage instead of appending `?rgffswitch=1`.
- FanFiction Mobile Desktop button made async; saves `domainPreference = "www"` before navigating.
- `normalizeURL()` no longer checks for `rgffswitch` token — reads stored preference directly.
- `addRelationshipGroup` in `novel-library.js` replaces `flatMap` expansion with a targeted single-element repair that only splits when exactly one comma-joined entry is present.

### Fixed

- Malformed relationship data (single comma-joined string in a one-element group) now repaired on first `getLibrary()` call.
- Theme configuration error on older runtimes (new theme preset keys guarded).
- `completionStatus` no longer overwrites an explicit user-set status.
- AO3 metadata selectors broadened with `#workskin` prefix; document title fallback added.
- Ranobes pseudo-author (`ranobes.top`) filtered out of `metadata.author`.
- ScribbleHub compact numbers (`1.2k`) and comma-separated rating counts now parsed correctly.

---

## [4.2.0](RELEASE_NOTES_4.2.0.md) - 2026-03-12

### Highlights

- Custom Content Box Types — define your own CSS classes and styling for special content blocks from Library Settings with a live preview.
- Library homepage hero "Continue Reading" eyebrow section.
- Character and relationship sections cleanly separated in novel cards.
- Dynamic reading-status buttons built from `AVAILABLE_STATUSES` in shelf pages.
- FanFiction character database repair pass for malformed historical data.

### Added

- **Custom Content Boxes** section in Library Settings: user-defined CSS class, display name, and styling with live preview.
- Hero eyebrow section in `library.html` with "Continue Reading" styling in `library.css`.
- Pause and Skip buttons in chunking banner; per-chunk Enhance button.
- `WORD_COUNT_THRESHOLD` and `CACHE_RESTORE_RETRY_DELAY` constants in `constants.js`.

### Changed

- `novel-card.js` character/relationship rendering refactored into separate sections.
- `shelf-page.js` reading-status buttons now built dynamically from `AVAILABLE_STATUSES`.
- `extractParagraphsFromHTML()` refined for more accurate paragraph boundary detection.
- Popup backup model selection uses `DEFAULT_MODEL_ID` as fallback.

### Fixed

- Story completion status now correctly derived from `publicationStatus` when no explicit status is set.
- Cache restore retry delay correctly wired into chunking retry logic.
- Content filter settings (fight scenes, R18, author notes) now persist and reload correctly.

---

## [4.1.0](RELEASE_NOTES_4.1.0.md) - 2026-03-08

### Highlights

- Five new creative themes: Tokyo Night, Catppuccin Mocha, Synthwave, and more.
- Auto theme mode extended with schedule-based and sun-position (sunrise/sunset) switching.
- Reading progress bar in Ranobes and ScribbleHub novel modals.
- Chunking UI overhaul with pause/skip controls and per-chunk enhance button.
- Export template updated: word count included; default extension changed to EPUB.

### Added

- `autoBehavior`, `timeCustomStart`, `timeCustomEnd` fields in `DEFAULT_THEME`.
- Schedule and sun-based auto mode strategies in `resolveMode()`.
- New theme presets: `tokyo-night`, `catppuccin-mocha`, `synthwave`, and additional creative themes.
- Reading progress bar in Ranobes and ScribbleHub novel modals.
- Chunking banner: Pause, Skip, and per-chunk Enhance buttons.
- Word count display and threshold warning in chunk UI.

### Changed

- `getThemePalette` and `setThemeVariables` updated to support new auto-mode fields (backward compatible).
- FanFiction, AO3, and mobile handler default site prompts refined with specific formatting rules.
- "Copy Title" button removed from FanFiction chapter toolbar; replaced by compact green **Copy** badge.
- Export filename template includes word count; default extension is now EPUB.

### Fixed

- Background animation import error on pages that don't use animations.
- Chunking word-count threshold constants correctly applied.

---

## [4.0.0](RELEASE_NOTES_4.0.0.md) - 2026-03-06

### Highlights

- Canvas-based background animations (Particles, Snow, Rain, Falling Leaves, Fireflies) for all library pages, color-synced to the active theme.
- Library card renderer completely overhauled: async, site-specific designs, novel modals now accessible from the main library homepage.
- Dedicated Notifications tab in the popup with notification history and clear button.
- Per-novel auto-enhance toggles directly in the popup history list.
- Backup Download Manager module for listing, downloading, and restoring backup snapshots.

### Added

- `bg-animation.js` canvas animation engine with 5 canvas types (particles, falling-leaves, snow, rain, fireflies).
- `bg-animations.css` linked in all five site-specific shelf pages (AO3, FanFiction, ScribbleHub, Ranobes, Webnovel).
- Library Settings > Background Animation picker grouped into Canvas and CSS animation optgroups.
- `novel-card-template` HTML element in `library.html` for consistent card structure.
- Async card renderer loading in `library.js` with site-specific modules and a generic fallback.
- `novel-card-click` unified event for opening novel detail modals from any library view.
- Popup Notifications tab: `getNotifications` and `clearNotifications` message round-trips to background.
- Per-novel `autoEnhance` toggle in the popup, read from `novelLibrary`.
- "More from this site" grid in the popup history view.
- Open-Library popup button now auto-closes the popup after navigating.
- `backup-download.js` module: list, download, restore, and delete backup snapshots.
- Background message handlers: `logNotification`, `getNotifications`, `clearNotifications` with capped history.
- Handler manager now tracks handler class references and calls static `initialize()` before sorting by `PRIORITY`.
- FanFiction bare-domain redirect in desktop and mobile handlers via static `initialize()`.
- Ranobes metadata extraction: title, author, cover, description, genres, tags, status, chapter counts.
- Domain-level enable/disable utility functions in `site-settings.js`.
- ScribbleHub badge in the popup.

### Changed

- Popup recent-novels list sourced from `novelLibrary.getRecentNovels()` instead of raw store reads.
- FanFiction `/u/` profile URLs excluded from chapter and novel detection.
- Ranobes `/chapters/{id}` chapter-index URLs excluded from chapter/novel detection.
- FanFiction card renderer registers correctly; CSP-safe image fallback preserved.
- AO3 shelf fandom-grid styles consolidated into `style.css`; stray code outside the renderer class removed.
- `bg-animation.js` imported in `library.js`, `library-settings.js`, shared `shelf-page.js`, and all four site-specific `shelf-page.js` files.
- Gemini UI toggle (`⚡ Hide Gemini UI`) now targets `.gemini-main-summary-group`, `.gemini-chunk-summary-group`, `.gemini-summary-text-container`, `.gemini-chunk-banner`, and `.gemini-master-banner`; uses `data-rg-saved-display` for correct display restoration.
- FanFiction chapter toolbar: "Copy Title" button removed; "Copy" rendered as a compact green badge (`badgeStyle: true`).

### Fixed

- Notification bell modal overlay and click-outside-to-close behavior in the popup.
- AO3 card renderer: duplicate rendering caused by code outside the class body.
- FanFiction mobile handler no longer throws on pages where the DOM hasn't finished building.
- Handler deduplication prevents the same handler running twice in overlapping content script contexts.
- Summary groups and summary containers now all correctly hide and restore together via the Gemini UI toggle.

---

## [3.9.0](RELEASE_NOTES_3.9.0.md) - 2026-02-10

### Highlights

- Auto-update reading progress and status on every supported novel page reload.
- Per-site settings and redirects consolidated with a single FanFiction.net domain preference.
- Library-first configuration: processing options and prompts live in Library Settings.

### Added

- Per-site settings panels in Library settings and website shelf pages.
- URL import tool to batch-add novels from pasted links.
- Per-site status mapping for Ranobes novel pages using bookmark list data when available.
- Progress-aware status rules for chapter-embedded sites (single chapter -> Reading, first of many -> Plan to Read, final -> Completed).

### Changed

- Site settings storage key moved to `siteSettingsApi` and included in backups.
- Processing options and prompt configuration moved out of popup into Library Settings.
- Suggested reads and library cards in the popup improved for metadata density.
- FanFiction.net domain redirect now uses a single preference (www, mobile, auto).

### Fixed

- Notification bell modal overlay and click behavior in the popup.
- Auto-update logic now refreshes in-library novels on page reloads.

## [3.7.0](RELEASE_NOTES_3.7.0.md) - 2026-01-30

### 🔧 Google Drive OAuth Enhancements & UI Improvements

Version 3.7.0 introduces support for Web Application OAuth credentials, major popup UI fixes, enhanced notification system, and improved website handler logic.

### Added

#### ☁️ Google Drive OAuth Improvements

- **Client Secret Support**: Added support for "Web application" type OAuth credentials
  - New `driveClientSecret` field in popup Advanced settings
  - Automatic inclusion of client secret in OAuth token exchanges and refresh flows
  - Backwards compatible with "Chrome Extension" type credentials (no secret required)
  - Allows users to use existing Google Cloud projects with web credentials

- **User-Configured OAuth**: Removed default credentials for better security
  - Users now configure their own Google Cloud OAuth credentials
  - Paste JSON credentials directly from Google Cloud Console
  - Automatic parsing of "Web application" or "Desktop app" credential JSON
  - Smart redirect URI validation per browser type (Chrome, Firefox, Edge)

#### 💾 Comprehensive Backup System

- **Full Extension Backup**: New `comprehensive-backup.js` utility
  - Complete backups including library, API keys, prompts, and all settings
  - Site-specific prompts and per-novel custom prompts
  - Theme preferences and model configuration
  - Google Drive OAuth credentials

- **Rolling Auto-Backups**: Automatic protection with browser storage
  - Keeps up to 5 recent backups in browser storage
  - Triggered automatically when library changes
  - Quick restore from popup without external files
  - Toggle auto-backups on/off per preference

#### 📊 Anonymous Analytics (Opt-Out)

- **CFlair-Counter Integration**: New `telemetry.js` module
  - Uses [CFlair-Counter](https://github.com/Life-Experimentalist/CFlair-Counter) API
  - **Enabled by default** (opt-out model)
  - First-run dialog informs users about analytics
  - Anonymous view counts per feature
  - Error reporting (optional, separate toggle)
  - Custom webhook support for additional self-hosted debugging

#### 📢 Enhanced Notification System

- **Notification Manager**: Centralized notification handling across the extension
  - Added logging for all notifications with detailed metadata
  - Implemented novel data caching to improve notification context
  - Enhanced popup notification display with metadata details
  - Improved notification badge updating mechanisms
  - Added notification history clearing functionality

#### 🎯 Domain-Specific Settings

- **Site Settings Management**: Per-domain feature toggles
  - Enable/disable features on specific domains
  - Domain-level configuration for auto-enhancement and other features
  - Improved granular control over extension behavior

#### 📖 Reading Progress Tracking

- **Progress Update Prompts**: Smart chapter progress detection
  - Notifies users when saved progress is behind current reading chapter
  - Cooldown mechanism to prevent spam prompts
  - Banner UI for updating progress or dismissing notifications
  - Automatic status transitions based on chapter progress

### Changed

#### 🖥️ Popup UI Refactoring

- **Major Popup Fixes**:
  - Fixed popup initialization race condition (DOMContentLoaded vs document.readyState)
  - Fixed tab switching mechanism (now properly activates content)
  - Removed legacy Google Drive backup UI elements
  - Cleaned up backup mode handling and event listeners
  - Added defensive guards for missing DOM elements
  - Improved settings loading and display logic

- **Google Drive Settings UI**:
  - Moved Drive backup controls to Advanced tab
  - Added connection status indicators (🟢 Connected, 🔴 Auth failed, ⚫ Disconnected)
  - Improved error message display for authentication issues
  - Added Client Secret input field with helpful descriptions
  - Reorganized Drive settings into collapsible "Advanced setup" section

#### 🌐 Website Handler Improvements

- **AO3 Handler**: Changed enhancement label from "Gemini" to "Ranobe Gemini"

- **Fanfiction Handler**:
  - Added automatic redirection from bare domain to mobile/desktop based on user agent
  - Improved chapter page detection by excluding user profile pages (`/u/`)
  - Enhanced metadata extraction for genres, characters, and relationships
  - Better handling of story descriptions and author names

- **Fanfiction Mobile Handler**:
  - Added initialization redirect logic for bare domain visits

- **Ranobes Handler**:
  - Fixed chapter vs novel page detection
  - Excluded chapter index URLs (`/chapters/{id}`) from being treated as novel pages
  - Improved title extraction (strips author suffix)
  - Enhanced metadata extraction

- **ScribbleHub Handler**:
  - Updated novel modal to display author as clickable link
  - Improved metadata display in detailed modal

- **Handler Manager**:
  - Ensured handlers are initialized only once
  - Prevented duplicate initializations
  - Added static `initialize()` support for handlers

#### 📚 Library Enhancements

- **Novel Modal Improvements**:
  - Enhanced "Continue Reading" button with comprehensive URL selection logic
  - Improved "Read" button to display correct source URLs
  - Better handling of author links in modals

- **Auto-Status Updates**:
  - Modified reading status auto-adjustment based on current chapter
  - Improved status transitions (Reading → Plan to Read, etc.)
  - Enhanced last read chapter tracking

#### 🏗️ Build System & Documentation

- **Build Process**:
  - Split manifest files into `manifest-firefox.json` and `manifest-chromium.json`
  - Enhanced build script for platform-specific packaging
  - Updated icon paths for consistency across all files

- **Documentation**:
  - Added comprehensive Copilot instructions (`.github/copilot-instructions.md`)
  - Enhanced build system documentation
  - Improved domain management guides

### Fixed

#### 🐛 Bug Fixes

- **Popup Initialization**: Fixed critical race condition where `DOMContentLoaded` fired before listener attachment
- **Tab Switching**: Fixed broken tab navigation in popup
- **Drive UI**: Removed references to deleted backup mode variables (`backupModeScheduled`, `backupModeContinuous`)
- **Settings Loading**: Fixed empty fields in popup after page load
- **API Key Saving**: Restored proper API key persistence
- **Prompt Loading**: Fixed prompts not pre-filling in popup

#### 🔧 Google Drive OAuth

- **Token Exchange**: Added client secret support to fix "400 client_secret is missing" errors
- **Token Refresh**: Updated refresh flow to include client secret when required
- **Error Handling**: Improved error messages for OAuth failures

### Developer Experience

#### 🛠️ Code Quality

- **Logging Improvements**: Centralized logging system using `debugLog` and `debugError` across all handlers
- **Handler Registry**: Dynamic handler loading from generated registry
- **Deduplication**: Better handler deduplication based on constructor names
- **Type Safety**: Improved metadata handling flags (`metadataIncomplete`, `requiresDetailPage`)

### Technical Details

#### Google Drive OAuth Flow

```javascript
// New flow supports both Chrome Extension and Web Application credentials
const params = {
  client_id: clientId,
  // ... other params
};
if (clientSecret) {
  params.client_secret = clientSecret; // Only for Web App type
}
```

#### Popup Initialization Fix

```javascript
// Before: Race condition
document.addEventListener("DOMContentLoaded", async () => { ... });

// After: Reliable startup
const startPopup = async () => { ... };
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startPopup);
} else {
  startPopup();
}
```

### Migration Notes

- Users with existing Drive connections may need to reconnect if using Web Application credentials
- No action required for Chrome Extension type credentials
- Local backups continue to work without any changes
- All existing settings and library data are preserved

### Known Issues

- Web Application OAuth credentials expose client secret in extension storage (consider using Chrome Extension type for public distribution)
- Extension ID must be hardcoded in Google Cloud Console for proper OAuth redirect handling

---

## [3.5.0]() - 2025-12-20

### 🎨 Shelf Pages, Analytics & UX Improvements

Version 3.5.0 introduces dedicated website shelf pages with advanced filtering, comprehensive analytics, and significant UX improvements across the library system.

### Added

#### 📊 Website Shelf Pages

- **AO3 Shelf Page**: Complete filtering system
  - Browse by Fandom: Clickable fandom cards (top 20 by work count) with auto-filtering
  - Multi-select filters: Fandoms, Relationships, Characters, Additional Tags (NO selection limits)
  - Dynamic filters: Rating, Category, Warnings, Language, Completion Status, Pairing Type, Relationships Type
  - Advanced search: Title, author, description with case-insensitive matching
  - Sorting: Recent visit, date added, total words, kudos, hits, bookmarks, comments
  - **6 Analytics Insights**: Total Works, Enhanced Chapters, Total Words, Average Rating, Reading Progress, Most Kudos, Newest Addition, Most Chapters
  - **Removed AO3 Restrictions**: No longer limits fandoms/characters selection (restrictions were FanFiction.net only)

- **FanFiction.net Shelf Page**: Enhanced filtering
  - Dynamic filters: Genre, language, rating, completion status, crossover filter
  - Character/fandom filters: MAX 2 fandoms, MAX 4 characters (site-specific rules)
  - Advanced search: Title, author, description
  - Sorting: Recent visit, date added, words, favorites, follows, reviews
  - **6 Analytics Insights**: Total Stories, Enhanced Chapters, Total Words, Average Favorites, Reading Progress, Most Favorited, Newest Addition, Most Chapters

- **Ranobes Shelf Page**: Genre-focused filtering
  - Dynamic filters: Genres, tags, language, COO status, translation status
  - Advanced search: Title, author, description
  - Sorting: Recent visit, date added, total words, rating, chapters, views
  - **6 Analytics Insights**: Total Novels, Enhanced Chapters, Total Words, Average Rating, Reading Progress, Most Chapters, Newest Addition, Highest Rated

#### 🎨 Popup Modal Improvements

- **2-Column Layout**: Novel card modal expanded from 1-column to responsive 2-column grid
- **Total Words Stat**: Fixed calculation to sum `novel.metadata.words` across all novels
- **Better Readability**: Increased spacing, improved typography, better visual hierarchy

#### 🏗️ Keep-Alive Architecture Documentation

- **Three-Layer System**: Comprehensive documentation of extension persistence mechanisms
  - **Offscreen Document** (`offscreen.js`): 20s postMessage heartbeat to service worker
  - **Background Alarms** (`background.js`): 30s alarm API + port listener for content scripts
  - **Content Script Port** (`content.js`): Long-lived port connection with 20s heartbeat pings
- **New File**: `docs/architecture/KEEP_ALIVE.md` with full implementation details, timing rationale, debugging tips

### Changed

- **AO3 Selection Limits Removed**: Eliminated `MAX_FANDOMS=2` and `MAX_CHARACTERS=4` constants (these were FanFiction.net restrictions incorrectly applied to AO3)
- **Improved Card Visuals**: Added `cursor: pointer` to Ranobes novel cards for better UX
- **Enhanced Logging**: Ranobes shelf page now logs detailed debugging info (novel count, sources, visibility states)

### Fixed

- **View on Site Button**: Verified correct behavior - button already uses `sourceUrl` to link to main novel details page (not current reading chapter) across all library pages
- **Ranobes Visibility**: Added comprehensive console logging to debug novel grid display issues

### Documentation

- **CHANGELOG.md**: Added v3.5.0 entry with all new features
- **ARCHITECTURE.md**:
  - Added keep-alive system section with mermaid diagram
  - Added `offscreen.js` to background script components
  - Added cross-reference to `KEEP_ALIVE.md`
- **KEEP_ALIVE.md**: New comprehensive guide covering:
  - Three-layer architecture with code samples
  - Timing considerations and browser differences
  - Lifecycle management and debugging tips
  - Common issues and troubleshooting

---

## [3.0.0]() - 2025-11-28

### 🎉 Major Release: Novel Library System

Version 3.0.0 introduces the comprehensive Novel Library system - a complete solution for organizing, tracking, and managing your reading across all supported websites. This release also includes extensive documentation improvements and enhanced metadata extraction.

### Added

#### 📚 Novel Library System

- **Full Library Page**: Dedicated library interface accessible via extension menu
  - Grid-based layout with novel cards
  - Search functionality (title, author, description)
  - Filter by shelf (website), status, rating
  - Sort by recent visit, date added, or enhanced chapters
  - Stats display (total novels, enhanced chapters, active shelves)

- **Automatic Organization**:
  - Novels automatically added to library on first enhancement
  - Organized into shelves by website (FanFiction.net, Ranobes, AO3, WebNovel)
  - Mobile and desktop variants share same novel entries
  - Novel ID extraction from URL patterns

- **Novel Management**:
  - Edit metadata: title, author, cover URL, description
  - Update status (reading, completed, on-hold, plan-to-read, dropped)
  - Add genres/tags
  - Set custom per-novel enhancement prompts
  - Add personal notes
  - Track reading progress (chapters enhanced, last visited)

- **Import/Export**:
  - Export entire library as JSON with timestamp
  - Import with merge or replace modes
  - Detailed import results (new, updated, errors)
  - Backup and restore functionality

#### 🔧 Dynamic Shelf System

- **Handler-Based Shelves**:
  - Shelves auto-generated from handler `SHELF_METADATA`
  - Adding new website automatically creates library shelf
  - No manual shelf configuration needed
  - Each shelf has: id, name, icon, color, novelIdPattern, primaryDomain

- **Shelf Registry**:
  - Centralized `SHELF_REGISTRY` in domain-constants.js
  - Dynamically builds `SHELVES` constant
  - Extensible for new website handlers

#### 🎨 UI Enhancements

- **Popup Improvements**:
  - New "Novels" tab with library preview
  - Shows 5 most recently visited novels
  - Library statistics overview
  - "Open Full Library" quick access button

- **Context Menu**:
  - Right-click extension icon for quick actions
  - "Open Novel Library" shortcut
  - "Settings" quick access

#### 📖 Metadata Extraction

- **FanFiction.net Enhanced Extraction**:
  - `extractDescription()`: Extracts story summary from #profile_top
  - `extractAuthor()`: Gets author name and profile link
  - `extractNovelMetadata()`: Returns complete metadata object
  - Cover image URL extraction

- **Improved Title Extraction**:
  - Better desktop/mobile detection
  - Fallback selectors for edge cases

#### 📝 Documentation Overhaul

- **Reorganized Structure**:
  - `docs/architecture/` - Technical architecture docs
  - `docs/features/` - Feature-specific documentation
  - `docs/guides/` - User and contributor guides
  - `docs/development/` - Development workflows

- **New Documentation**:
  - Comprehensive ARCHITECTURE.md with diagrams and component tables
  - Gateway README.md in each subdirectory
  - Updated main docs/README.md as documentation hub
  - Consistent formatting with index placeholders

- **Architecture Documentation**:
  - System architecture with Mermaid diagrams
  - Detailed component breakdowns with tables
  - Content processing pipeline sequences
  - Storage schema documentation
  - API integration architecture
  - Novel library system design
  - Feature architecture (chunking, emoji, backup keys)

### Changed

#### 🏗️ Architecture Improvements

- **Handler System**:
  - All handlers now include static `SHELF_METADATA`
  - Improved domain pattern matching
  - Better separation of concerns

- **Storage**:
  - Library stored in `rg_novel_library` key
  - Novel objects keyed as `[shelfId]_[novelId]`
  - Metadata includes timestamps for sorting

- **Import System**:
  - Changed from replace to merge by default
  - Added mode selection (merge/replace)
  - Better conflict resolution
  - Detailed import reporting

#### 📚 Documentation

- **Naming Convention**: UPPERCASE.md for major docs
- **Structure**: Index placeholders, version metadata, navigation links
- **Diagrams**: All diagrams include detailed component tables below
- **Consistency**: Unified formatting across all documentation

### Fixed

- **Short Summary Handler**: Added missing `shortSummarizeWithGemini` handlers in background.js
- **FanFiction Description**: Fixed extraction for desktop version
- **In-Progress Banner**: Corrected positioning and removal logic
- **Long Enhancement**: Fixed "not working" issue with proper action handling

### Developer Experience

#### Adding New Website Support (Simplified)

1. Create handler in `src/utils/website-handlers/[site]-handler.js`
2. Extend `BaseWebsiteHandler`
3. Add static `SHELF_METADATA` property:

   ```javascript
   static SHELF_METADATA = {
     id: "mysite",
     name: "MySite",
     icon: "📚",
     color: "#4a90e2",
     novelIdPattern: /mysite\.com\/novel\/(\d+)/,
     primaryDomain: "mysite.com"
   };
   ```

4. Implement required methods
5. Import in `handler-manager.js`
6. Export metadata in `domain-constants.js`
7. Run `npm run update-domains`
8. Shelf automatically appears in library!

#### Build Scripts

- `npm run watch` - Watch mode for development
- `npm run build` - Production build
- `npm run package:firefox` - Create .xpi package
- `npm run package:source` - Create source archive
- `npm run update-domains` - Update manifest domains

### Technical Details

#### Novel Library Schema

```javascript
{
  "id": "shelf_novelId",
  "shelfId": "fanfiction",
  "novelId": "12025721",
  "title": "Story Title",
  "author": "Author Name",
  "url": "https://...",
  "description": "Story description...",
  "coverUrl": "https://.../cover.jpg",
  "status": "reading|completed|on-hold|plan-to-read|dropped",
  "genres": ["Genre1", "Genre2"],
  "rating": "K|K+|T|M|MA",
  "addedDate": "2025-11-28T...",
  "lastVisited": "2025-11-28T...",
  "chaptersEnhanced": 5,
  "totalChapters": 20,
  "customPrompt": "Custom instructions...",
  "notes": "Personal notes..."
}
```

#### Shelf Metadata Schema

```javascript
{
  id: "unique-id",
  name: "Display Name",
  icon: "📚",
  color: "#hexcolor",
  novelIdPattern: /regex/,
  primaryDomain: "example.com"
}
```

### Migration Notes

Users upgrading from v2.x to v3.0.0:
- Novel library is new - no migration needed
- All previous settings preserved
- Previously enhanced chapters not automatically added to library
- Re-enhance any chapter to add its novel to library

---

## [2.9.0]() - 2025-11-25

### Summary

Version 2.9.0 is a maintenance release that prepares the architecture for the Novel Library feature. It adds mobile FanFiction.net support and improves the handler registration system.

### Added

- **FanFiction Mobile Handler**:
  - Full support for m.fanfiction.net mobile site
  - Shares novel entries with desktop FanFiction.net
  - Optimized selectors for mobile layout

- **Handler System Improvements**:
  - FanfictionMobileHandler properly registered in domain-constants.js
  - Handler manager checks mobile handler before desktop handler
  - Better logging for handler selection

### Changed

- **Domain Constants**:
  - Added FanfictionMobileHandler import
  - Handler classes array now includes all handlers
  - Improved wildcard domain expansion

### Fixed

- Mobile FanFiction.net pages now properly detected
- Handler selection order ensures mobile handlers take priority

---

## [2.8.0]() - 2025-11-25

### Summary

Version 2.8.0 is a major architectural update introducing multi-site support, dynamic domain management, and comprehensive documentation improvements. This release adds support for Archive of Our Own (AO3) and WebNovel.com with infinite scroll handling, while implementing a future-proof domain system that eliminates manual maintenance across multiple files.

### Added

- **New Website Support**:
  - Archive of Our Own (AO3) - archiveofourown.org and ao3.org domains
  - WebNovel.com - with infinite scroll chapter support and per-chapter button injection
- **Dynamic Domain Management System**:
  - Automatic domain collection from handler static properties
  - Wildcard domain support (*.domain.com) for subdomain handling
  - Automated manifest.json generation via `npm run update-domains`
  - Single source of truth for domains in handler files
- **Documentation**:
  - Comprehensive Mermaid diagrams in all documentation files
  - Detailed component tables for every diagram
  - GitHub community files (CODE_OF_CONDUCT.md, CONTRIBUTING.md)
  - Issue templates (bug report, feature request, website support)
  - Pull request template with detailed checklist
  - FUNDING.yml for sponsor support
  - DYNAMIC_DOMAINS.md explaining the new domain system
- **Build System**:
  - Automated domain update script runs before packaging
  - Firefox Add-on badges on README (version, users, downloads, rating)
  - Theme-aware logo support for light/dark mode
  - Validation fixes documentation (VALIDATION_FIXES.md)

### Changed

- **Architecture**:
  - Handler classes now export static SUPPORTED_DOMAINS and DEFAULT_SITE_PROMPT
  - Handlers support both explicit domains and wildcard patterns for edge cases
  - Manifest patterns generated automatically from handler domains
  - Reduced from 20+ explicit domains to 15 explicit + 13 wildcards
- **WebNovel Handler**:
  - Per-chapter button injection instead of page-level
  - MutationObserver for dynamic chapter loading
  - Custom events for chapter-specific enhancement/summarization
  - ProcessedChapters Set to prevent duplicate button injection
- **Word Counting**:
  - Optimized AO3 word count to use direct string operations
  - Removed redundant DOM element creation for counting
  - Improved performance with textContent.trim().split() method
- **README**:
  - Updated installation instructions prioritizing Firefox Add-ons store
  - Added note about GitHub releases having latest version
  - Compact badge layout (2 rows instead of 10)
  - Updated supported websites list
  - Fixed repository URLs to use Life-Experimentalist organization

### Fixed

- **AO3 Handler**:
  - Word count bug - now counts plain text instead of HTML content
  - Content extraction reliability improvements
- **Manifest Validation**:
  - Invalid match patterns (130 errors) - wildcards now properly converted
  - Added browser_specific_settings.gecko.strict_min_version (Firefox 109.0+)
  - All match patterns follow valid format: *://*.domain.com/*
- **Package.json**:
  - Fixed circular reference in package script
  - Corrected repository URLs
  - Fixed build script execution order

### Developer Experience

- **New Commands**:
  - `npm run update-domains` - Regenerate manifest from handler domains
  - Automatic domain update on `npm run package`
- **Handler Development**:
  - Base handler template with required methods clearly documented
  - Handler Manager automatically registers new handlers
  - Domain constants dynamically collected at runtime
  - No more manual manifest.json editing for new sites
- **Testing**:
  - Improved error messages and debug logging
  - Better console output for domain detection
  - Validation checklist in documentation

### Migration Notes

- Old domain constants (RANOBES_DOMAINS, etc.) still exported for backward compatibility
- Legacy arrays now automatically generated from handlers via expandWildcards()
- No breaking changes to existing handler interfaces

### Known Issues

- 35 AMO validation warnings about innerHTML usage (expected for AI content rendering)
- 3 warnings about dynamic imports (expected for handler module loading)
- These warnings are safe and necessary for extension functionality

## [2.2.1]() - 2025-04-26

### Summary

Version 2.2.1 addresses the domain transition from ranobes.top to ranobes.net, ensuring continued compatibility while maintaining support for all known Ranobes domains. This update clarifies domain documentation and improves site selectors to work reliably across all supported domains.

### Added

- Enhanced domain handling to prioritize ranobes.net as the primary domain
- Improved debugging information for domain detection
- Expanded domain compatibility verification for all known Ranobes domains

### Changed

- Updated documentation to reference ranobes.net as the primary domain instead of ranobes.top
- Refactored content selectors for better cross-domain compatibility
- Enhanced domain detection logic for more reliable site recognition

### Fixed

- Selector issues affecting content identification on some Ranobes domains
- Documentation references to deprecated domain names
- UI references to specific domains in the interface

---

## [2.2.0]() - 2025-04-19

### Summary

Version 2.2.0 delivers a significant user experience upgrade focusing on improved theme integration, responsive design, and streamlined API key handling. This update ensures the extension works seamlessly across both desktop and mobile devices while maintaining visual consistency with website themes and popular browser extensions like Dark Reader.

### Added

- Comprehensive theme integration for summary windows with automatic light/dark mode detection
- Fully responsive design with optimized layouts for both mobile and desktop devices
- Intelligent device type detection for automatic UI adjustment
- Enhanced Dark Reader extension compatibility with proper variable handling
- Better integration with various site-specific dark mode implementations
- Memory-efficient content processing for improved performance on mobile devices

### Changed

- Completely redesigned summary display area to match site theming
- Improved mobile experience with touch-optimized controls and spacing
- Enhanced UI layout with better element positioning on smaller screens
- Unified API key handling between enhance and summarize functions
- Simplified user feedback for API key configuration
- Improved error messaging with clearer instructions

### Fixed

- Summary window theming inconsistencies between dark and light modes
- API key handling discrepancies between summarize and enhance features
- UI rendering issues on mobile devices with various screen sizes
- Theme compatibility issues with Dark Reader and other dark mode extensions
- Visual glitches when transitioning between light and dark modes
- Contrast issues with text on certain background colors

---

## [2.1.0]() - 2025-04-15

### Summary

Version 2.1.0 brings significant improvements to the summary feature, handling of large chapters, and overall stability. The update introduces a separate model selection for summaries, advanced configurations for managing timeouts, and better content processing for different length chapters.

### Added

- Separate model selection for summaries independent from enhancement model
- Improved summary generation with higher token limits for more detailed summaries
- Enhanced large chapter handling with better chunking and token management
- Advanced timeout settings to configure request timeouts and prevent connection failures
- Cleaner summary formatting with improved text formatting and paragraph handling
- Better error handling with more informative error messages
- Configuration centralization with all model constants moved to a central file

### Changed

- Increased maximum token limits for summaries from 512 to 2048 tokens
- Implemented proportional token allocation for summaries based on chapter size
- Enhanced console logging for debugging prompt and model usage
- Improved emotion detection and contextual emoji placement
- Completely refactored background script for better stability
- Implemented chunking system to process large chapters in parts
- Enhanced markdown to HTML conversion for better formatting
- Added automatic token limit detection for different models

### Fixed

- Connection timeout issues with large chapters (10k+ words)
- Paragraph and section break handling in summary display
- Error recovery when processing extremely large contents

---

## [2.0.0]() - 2025-04-13

### Summary

Version 2.0.0 is a major update that introduces a completely redesigned interface, support for Gemini 2.0 models, and a new chapter summarization feature. This release focuses on improved model selection, better handling of novel translation, and enhanced site compatibility.

### Added

- Support for Gemini 2.0 Flash and Gemini 2.0 Pro models
- New chapter summarization feature to generate concise chapter summaries
- Redesigned UI with cleaner interface and basic/advanced tab separation
- Model selection dropdown to easily switch between different Gemini models
- Emotion processing with enhanced display of emotional context using emoji indicators
- Increased site compatibility with better content extraction
- Custom prompt templates for both enhancement and summarization

### Changed

- Completely refactored background script for better stability
- Implemented chunking system to process large chapters in parts
- Enhanced markdown to HTML conversion for better formatting
- Added automatic token limit detection for different models

### Fixed

- Stability issues with large chapters
- Content extraction on dynamically loaded pages
- API error handling and user feedback
- Compatibility with the latest browser versions

---

## [1.1.0]() - 2025-04-10

### Added

- Chapter summarization feature with customizable prompt
- Permanent prompt option that applies to all requests
- Added spacing between summary and chapter content
- Better support for Gemini 2.0 models
- Refined settings UI for easier configuration

### Changed

- Focused on ranobes.top as the primary supported site
- Updated default prompts for better outputs
- Improved error handling for large content
- Enhanced dark mode support in the popup interface

### Fixed

- Properly handle HTML formatting in outputs
- Fixed content extraction on dynamically loaded pages
- Improved token count estimation
- Addressed compatibility issues with Firefox 120+

---

## [1.0.0]() - 2025-06-15

### Added

- Initial release
- Support for ranobes.top, wuxiaworld.com, and webnovel.com
- One-click enhancement with Gemini AI
- Options page to configure API key and prompts
- Ability to restore original content
- Debug mode for troubleshooting

### Fixed

- Content detection on dynamically loaded pages
- API error handling for invalid keys
