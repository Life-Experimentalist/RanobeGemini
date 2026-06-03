Mode: all
Format: text
Generated: 2026-06-03T14:04:26.124Z
Total commits: 194

[d8137ea] 2026-05-31 feat: redesign site settings + optional permissions + dynamic model fetching
   feat: redesign site settings + optional permissions + dynamic model fetching
   Site Settings panel (Plan 1):
   - Move all novel-site domains to optional_host_permissions in both manifests
   - Add FORCE_DISABLED flag to base-handler (default false) + WebNovelHandler
   - SHELF_REGISTRY now stores forceDisabled + permissionOrigins per shelf
   - Unified ls-site-card layout replaces separate auto-add list and accordion
   panels: one card per site with enable toggle (requests/revokes browser
   permission), auto-add sub-row, expandable SETTINGS_DEFINITION fields
   Files:
   - src/background/loreweave/graphify-service.js
   - src/library/library-settings.css
   - src/library/library-settings.html
   - src/library/library-settings.js
   - src/manifest-chromium.json
   - src/manifest-firefox.json
   - ... (4 more)
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[26c6d31] 2026-05-30 fix: complete queue+chat implementation — multi-provider support, CORS, writingStyle
   fix: complete queue+chat implementation — multi-provider support, CORS, writingStyle
   - Add novel sites to host_permissions in both manifests so the queue
   service worker can fetch chapter HTML without CORS errors
   - chat-handler: support OpenAI-compatible and Ollama in addition to Gemini;
   convert history format per provider
   - queue-manager: split _generateSummary into provider-specific helpers
   (_summarizeGemini/OpenAI/Ollama) using the configured aiProvider
   - queue popup: read loreWeaveWritingStyle from storage and pass to job;
   Files:
   - src/background/loreweave/queue-manager.js
   - src/background/message-handlers/chat-handler.js
   - src/manifest-chromium.json
   - src/manifest-firefox.json
   - src/popup/popup.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[12d5d70] 2026-05-30 feat: add Chat popup tab — AI story Q&A using chronicle context
   feat: add Chat popup tab — AI story Q&A using chronicle context
   Files:
   - src/popup/popup.html
   - src/popup/popup.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[30521ec] 2026-05-30 feat: add story-chat background handler with chronicle context assembly
   feat: add story-chat background handler with chronicle context assembly
   Files:
   - src/background/message-handlers/chat-handler.js
   - src/background/message-handlers/index.js
   - src/content/content.js
   - src/content/modules/message-router.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[2a670ca] 2026-05-30 feat: add Queue popup tab — job form, live job list, summary view
   feat: add Queue popup tab — job form, live job list, summary view
   Files:
   - src/popup/popup.html
   - src/popup/popup.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[51d27df] 2026-05-30 feat: chapter queue — background fetch, smart chapter grouping, summarize+graphify
   feat: chapter queue — background fetch, smart chapter grouping, summarize+graphify
   Files:
   - src/background/loreweave/queue-manager.js
   - src/background/message-handlers/index.js
   - src/background/message-handlers/queue-handler.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[b20948b] 2026-05-30 feat: save AI summaries to story chronicle when chronicle is enabled
   feat: save AI summaries to story chronicle when chronicle is enabled
   In the summarizeWithGemini and shortSummarizeWithGemini handlers, after
   the summary resolves, attempt a non-blocking write to the per-novel
   chronicle store (rg_chronicle_<novelId>) if loreWeaveChronicleEnabled is
   set. Content script now forwards novelId and chapterNum in the summarize
   message payload so the background can key into the correct chronicle entry.
   Files:
   - src/background/background.js
   - src/content/content.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[1c34ec3] 2026-05-30 feat: add chronicle and writing-style config constants + popup settings
   feat: add chronicle and writing-style config constants + popup settings
   Add LOREWEAVE_CHRONICLE_ENABLED, LOREWEAVE_USE_PRIOR_CONTEXT, and
   LOREWEAVE_WRITING_STYLE constants; wire them into DEFAULT_CONFIG; expose
   all three as checkboxes/select in the LoreWeave popup tab; include the
   new keys in COMPREHENSIVE_BACKUP_KEYS.
   Files:
   - src/config/config.js
   - src/popup/popup.html
   - src/popup/popup.js
   - src/utils/constants.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[8974e38] 2026-05-30 feat: graphify service uses chronicle for prior entity IDs and context
   feat: graphify service uses chronicle for prior entity IDs and context
   Files:
   - src/background/loreweave/graphify-service.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[bfc919f] 2026-05-30 feat: universal 6-entity/10-relation extraction schema with style hints and prior context
   feat: universal 6-entity/10-relation extraction schema with style hints and prior context
   Files:
   - src/background/loreweave/graphify-prompt.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[be2697b] 2026-05-30 feat: add chronicle-storage.js — per-novel story context accumulation
   feat: add chronicle-storage.js — per-novel story context accumulation
   Files:
   - src/background/loreweave/chronicle-storage.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[67172df] 2026-05-30 fix: Show Enhanced warning button — use robust class selector; fix no-op click handler
   fix: Show Enhanced warning button — use robust class selector; fix no-op click handler
   Files:
   - src/content/modules/enhanced-content-banner.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[f61309d] 2026-05-30 fix: remove unused createEnhanceButton param from injectUI
   fix: remove unused createEnhanceButton param from injectUI
   Files:
   - src/content/modules/ui-controls.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[1100b46] 2026-05-30 feat: NovelBin modal — add tags, fix chapter count display, complete metadata
   feat: NovelBin modal — add tags, fix chapter count display, complete metadata
   Files:
   - src/library/websites/modal-styles.js
   - src/library/websites/novelbin/novel-card.js
   - src/utils/website-handlers/novelbin-handler.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[0d8e39f] 2026-05-30 fix: add SPA navigation observer for pushState chapter changes (NovelBin)
   fix: add SPA navigation observer for pushState chapter changes (NovelBin)
   Files:
   - src/content/content.js
   - src/utils/website-handlers/novelbin-handler.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[6d13eff] 2026-05-30 fix: long and short summaries stack instead of replacing each other
   fix: long and short summaries stack instead of replacing each other
   Files:
   - src/content/content.js
   - src/utils/chunking/chunk-summary-ui.js
   - src/utils/summary-service.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[7536e3a] 2026-05-30 fix: remove duplicate wordCountThreshold input — existing slider already covers this setting
   fix: remove duplicate wordCountThreshold input — existing slider already covers this setting
   Files:
   - src/library/library-settings.html
   - src/library/library-settings.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[69ea1ae] 2026-05-30 feat: Show Enhanced button for divergent content; configurable word count threshold in settings
   feat: Show Enhanced button for divergent content; configurable word count threshold in settings
   Files:
   - src/content/modules/enhanced-content-banner.js
   - src/library/library-settings.html
   - src/library/library-settings.js
   - src/utils/chunking/chunk-ui.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[0c2bb85] 2026-05-30 fix: remove unused enhanceButton local variable from injectUI
   fix: remove unused enhanceButton local variable from injectUI
   Files:
   - src/content/modules/ui-controls.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[cd956fc] 2026-05-30 fix: remove duplicate enhance button from top controls bar
   fix: remove duplicate enhance button from top controls bar
   Files:
   - src/content/modules/ui-controls.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[1a78ed8] 2026-05-30 docs: update novelbin plan — replace colour threshold with Show Enhanced button + configurable threshold
   docs: update novelbin plan — replace colour threshold with Show Enhanced button + configurable threshold
   Files:
   - docs/superpowers/plans/2026-05-28-novelbin-ui-fixes.md
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[197579a] 2026-05-30 docs: add implementation plans for story intelligence, chapter queue, story chat, and novelbin fixes
   docs: add implementation plans for story intelligence, chapter queue, story chat, and novelbin fixes
   Files:
   - docs/superpowers/plans/2026-05-28-chapter-queue.md
   - docs/superpowers/plans/2026-05-28-novelbin-ui-fixes.md
   - docs/superpowers/plans/2026-05-28-story-chat.md
   - docs/superpowers/plans/2026-05-28-story-intelligence.md
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[bfa383f] 2026-05-30 docs: add four specs for story intelligence, chapter queue, story chat, and novelbin fixes
   docs: add four specs for story intelligence, chapter queue, story chat, and novelbin fixes
   Files:
   - docs/superpowers/specs/2026-05-28-chapter-queue-design.md
   - docs/superpowers/specs/2026-05-28-novelbin-ui-fixes-design.md
   - docs/superpowers/specs/2026-05-28-story-chat-design.md
   - docs/superpowers/specs/2026-05-28-story-intelligence-design.md
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[1dcf6ce] 2026-05-30 feat: LoreWeave graph integration (graphify pipeline + popup tab)
   feat: LoreWeave graph integration (graphify pipeline + popup tab)
   Adds opt-in LoreWeave entity extraction to the extension. After chapter
   enhancement, story entities (characters, artifacts, locations, factions)
   are extracted via Gemini at temperature=0.1 and POSTed to the user's
   LoreWeave backend as an IngestDelta.
   New files:
   src/background/loreweave/loreweave-client.js  — HTTP client (bearer token auth)
   src/background/loreweave/graphify-prompt.js   — Phase 5 epoch_order:int schema prompt
   Files:
   - src/background/loreweave/graphify-prompt.js
   - src/background/loreweave/graphify-service.js
   - src/background/loreweave/loreweave-client.js
   - src/background/message-handlers/index.js
   - src/background/message-handlers/loreweave-handler.js
   - src/background/message-handlers/loreweave-ping-handler.js
   - ... (5 more)
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[debf3c1] 2026-05-21 fix(popup): novels and stats not rendering
   fix(popup): novels and stats not rendering
   Three bugs prevented the popup from displaying data:
   1. renderNovelsCardList referenced undefined variable
   ovelsList —
   the DOM element is
   ovelsListContainer at all call sites; fixed.
   2. getKeyLink.addEventListener called on null (element removed from HTML) —
   guarded with if (getKeyLink) to prevent crash.
   Files:
   - src/popup/popup.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[d40a5ec] 2026-05-21 feat: popup polish, metadata refresh fix, popup sort defaults
   feat: popup polish, metadata refresh fix, popup sort defaults
   Files:
   - src/content/modules/novel-context.js
   - src/library/library-settings.html
   - src/library/library-settings.js
   - src/library/library.js
   - src/popup/popup.css
   - src/popup/popup.html
   - ... (1 more)
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[88a4ca6] 2026-05-21 release: v5.0.0 artifacts and commit history
   release: v5.0.0 artifacts and commit history
   Files:
   - docs/release/commit-history.md
   - releases/RanobeGemini_v5.0.0_chromium.zip
   - releases/RanobeGemini_v5.0.0_firefox.zip
   - releases/source/Ranobe-gemini_v5.0.0_source.zip
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[8518116] 2026-05-21 feat: polish library modal metadata and update README to v5.0.0
   feat: polish library modal metadata and update README to v5.0.0
   - Add genres section (id=modal-genres-section) and work info section
   (id=modal-work-info-section) to library modal HTML
   - Wire modalGenresSection, modalGenres, modalWorkInfoSection,
   modalWorkInfo into elements cache (remove duplicate modalGenres key)
   - Extend populateNovelMetadata: render genres tag list, work info grid
   (status/translationStatus/language/year/translator/chapterCount/rating),
   and extended stats (views, readers, chaptersPerWeek)
   Files:
   - README.md
   - src/library/library.css
   - src/library/library.html
   - src/library/library.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[6925872] 2026-05-21 fix+feat: popup redesign, handler improvements, 5.0.0 release notes, remove v4.7.0 artifacts
   fix+feat: popup redesign, handler improvements, 5.0.0 release notes, remove v4.7.0 artifacts
   - Fix fatal popup error: add missing shortSummaryPrompt variable declaration
   - Redesign popup.html: remove all inline styles, compact header with stats row,
   clean tab layout, semantic CSS classes throughout
   - Update popup.css: proper blue/purple accent colors, new layout classes for
   header-brand, stats-row, filter-bar, section headings, empty states, etc.
   - Fix orphaned CSS properties in popup.css current-novel-card block
   - Reduce popup min-width from 600px to 380px
   Files:
   - docs/release/RELEASE_NOTES_5.0.0.md
   - releases/RanobeGemini_v4.7.0_chromium.zip
   - releases/RanobeGemini_v4.7.0_firefox.zip
   - releases/source/Ranobe-gemini_v4.7.0_source.zip
   - src/popup/popup.css
   - src/popup/popup.html
   - ... (3 more)
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[03e2cac] 2026-05-21 fix(phase15-u2): OneDrive URL path bug + roadmap housekeeping
   fix(phase15-u2): OneDrive URL path bug + roadmap housekeeping
   - onedrive.js ensureFolder: rewrote to correctly build Graph API paths;
   old loop built double-colon paths like /me/drive/root:/Folder::/${seg}:
   which is invalid; new version checks folder existence first then creates
   each missing segment using the correct parent children endpoint
   - Fixed upload, continuous backup, and getContinuousOnedriveBackup URL
   construction: strip trailing ':' from folderRef before appending filename
   so paths are /me/drive/root:/Folder/file:/content (not double-colon)
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/utils/onedrive.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[87c5e9e] 2026-05-21 feat(phase13): storage adapter expansion — WebDAV, OneDrive, Dropbox + multi-sync
   feat(phase13): storage adapter expansion — WebDAV, OneDrive, Dropbox + multi-sync
   13-U1 Multi-sync orchestrator:
   - storage-orchestrator.js reads syncDestinations array from storage
   - uploadBackup fans out to all configured destinations in parallel
   - Read operations (list/download/latest/continuous) use primary destination
   - Backward compatible: falls back to legacy activeSync string
   13-U2 WebDAV adapter (src/background/storage/adapters/webdav-storage.js):
   - PROPFIND/PUT/GET with HTTP basic auth
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/background/background.js
   - src/background/storage/adapters/dropbox-storage.js
   - src/background/storage/adapters/onedrive-storage.js
   - src/background/storage/adapters/webdav-storage.js
   - src/background/storage/storage-orchestrator.js
   - ... (3 more)
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[ef26d92] 2026-05-21 feat(phase12): add swipe/drag gesture navigation for novel modals
   feat(phase12): add swipe/drag gesture navigation for novel modals
   - bindModalSwipeNavigation() in shared-shelf-helpers: touch + pointer
   drag left/right on modal content triggers prev/next novel navigation
   - Wired alongside bindModalSwipeDismiss in library.js with same cleanup
   pattern; gesture excludes corner-nav buttons, ignores touch pointers
   on the pointer path to avoid double-firing
   - CSS slide-in keyframes (modal-slide-in-from-right/left) animate
   .novel-detail 28px + fade after openNovelDetail resolves
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/library/library.css
   - src/library/library.js
   - src/library/shared-shelf-helpers.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[3b6004a] 2026-05-21 docs: mark Phase 11-U2 and 11-U3 complete in roadmap
   docs: mark Phase 11-U2 and 11-U3 complete in roadmap
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[fbf682f] 2026-05-21 fix: commit handler improvements and popup/constants updates
   fix: commit handler improvements and popup/constants updates
   - base-handler: prefer main landmark, group paragraphs by ancestor,
   add #storytext, guard against body/html, lower threshold 500→300
   - ao3-handler: add newer AO3 content selectors, generateChapterUrl(),
   broaden insertion-point fallbacks for DOM changes
   - ranobes-handler: add ranobes.org host, isChapterPath() helper,
   improved chapter detection, navigation control signal
   - fanfiction/mobile handlers: add generateChapterUrl()
   Files:
   - src/content/content.css
   - src/popup/popup.js
   - src/utils/constants.js
   - src/utils/website-handlers/ao3-handler.js
   - src/utils/website-handlers/base-handler.js
   - src/utils/website-handlers/fanfiction-handler.js
   - ... (2 more)
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[419a723] 2026-05-21 feat(phase11-u3): replace AI provider dropdowns with tab pills
   feat(phase11-u3): replace AI provider dropdowns with tab pills
   Provider selection in Primary/Fallback slots now uses pill-style tabs
   (Gemini | OpenAI-Compatible | Ollama) following the same pattern as
   theme mode pills. Hidden selects kept for save/load compatibility.
   syncProviderTabs() syncs active state on load and on click.
   Files:
   - src/library/library-settings.css
   - src/library/library-settings.html
   - src/library/library-settings.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[37f2570] 2026-05-21 feat(phase11-u2): add Display settings panel with filter visibility controls
   feat(phase11-u2): add Display settings panel with filter visibility controls
   Settings panel in library-settings.html/js allows toggling filter toolbar,
   sort filter, status filter, and active filters visibility. Each shelf page
   (common + ao3/fanfiction/ranobes/scribblehub) reads libraryDisplayOptions
   from storage on init and applies show/hide via inline style.
   Files:
   - src/library/library-settings.html
   - src/library/library-settings.js
   - src/library/websites/ao3/shelf-page.js
   - src/library/websites/fanfiction/shelf-page.js
   - src/library/websites/ranobes/shelf-page.js
   - src/library/websites/scribblehub/shelf-page.js
   - ... (1 more)
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[61e7351] 2026-05-21 fix(phase11-U1): remove duplicate CSS blocks from all site library styles
   fix(phase11-U1): remove duplicate CSS blocks from all site library styles
   Each site CSS (ao3, fanfiction, ranobes, scribblehub) had:
   - A duplicate unindented @media (max-width: 768px) { .filters-section }
   block near the top, identical to the properly-indented one above it
   - A late page-specific .xxx-page .filters-section block with the exact
   same properties as the base .filters-section (no actual overrides),
   followed by another duplicate media query and unscoped .filter-group
   All duplicates removed; base rules in shelf-page.css are authoritative.
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/library/websites/ao3/style.css
   - src/library/websites/fanfiction/style.css
   - src/library/websites/ranobes/style.css
   - src/library/websites/scribblehub/style.css
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[a327d8e] 2026-05-21 feat(phase10-U3): final orchestrator cleanup and parity check
   feat(phase10-U3): final orchestrator cleanup and parity check
   Remove remaining dead code from content.js: addModelAttribution and
   createMainSummaryBanner wrappers (never called), autoCollectMetadataOnPageIfPending
   (orphaned, never called), PROGRESS_PROMPT_TIMEOUT_MS (unused constant),
   and excess blank lines. All remaining functions are thin module-delegation
   wrappers or genuine orchestrator/event-binding code. 0 lint errors.
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/content/content.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[eceb4c8] 2026-05-21 feat(phase10-U2): delete orphaned inline function stubs from content.js
   feat(phase10-U2): delete orphaned inline function stubs from content.js
   Remove all redundant function definitions that merely forwarded to
   module implementations already in ui-controls.js and novel-context.js:
   findNovelPageInsertionPoint, handleNovelDelete, handleRemoveNovelWithBlocklist,
   isNovelBlocklisted, insertAtPosition, resolveNovelControlsInsertion,
   removeChapterNovelControlsFromDOM, placeChapterNovelControls,
   createChapterPageNovelControls, and the __rgCreatingChapterControls guard.
   All callers already use runtime.xxx paths; local stubs were dead weight.
   Files:
   - src/content/content.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[fde8ed7] 2026-05-21 fix: recover logger.js and content.js from corrupted state
   fix: recover logger.js and content.js from corrupted state
   - logger.js: fix parse error (export inside try block); add log
   deduplication, debugWarn export, getStorageLocal helper; remove
   broken console.error/log wrappers; consistent async pattern across
   all three export functions; add debugWarn to globalThis and default export
   - content.js: add debugWarn bootstrap, importedLoggerDebugWarn,
   local truncation fallbacks; add showStatusOverlay/hideStatusOverlay;
   replace 15s setInterval keep-alive with MutationObserver setupUIObserver;
   Files:
   - .gitignore
   - .vscode/mcp.json
   - docs/overview/TECHNICAL_ROADMAP.md
   - package.json
   - src/content/content.js
   - src/popup/popup.html
   - ... (1 more)
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[f262dc5] 2026-04-20 fix: stabilize popup navigation and novel detection logic
   fix: stabilize popup navigation and novel detection logic
   Files:
   - src/background/background.js
   - src/background/message-handlers/metadata-handler.js
   - src/background/message-handlers/settings-handler.js
   - src/background/novel-updater.js
   - src/content/content.js
   - src/content/modules/ai-runtime.js
   - ... (12 more)
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[94f6202] 2026-04-20 Phase 10: Fix popup stability, dual-slot AI persistence, and Ranobe Box injection ReferenceErrors
   Phase 10: Fix popup stability, dual-slot AI persistence, and Ranobe Box injection ReferenceErrors
   Files:
   - .gemini/antigravity/prompts/get-to-work.prompt.md
   - .gemini/antigravity/prompts/release-notes.prompt.md
   - .gemini/antigravity/prompts/roadmap-continue-autonomous.prompt.md
   - .gemini/antigravity/prompts/roadmap-implementation.prompt.md
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/background/message-handlers/metadata-handler.js
   - ... (11 more)
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[d1dc30d] 2026-04-20 docs: update roadmap with phases 10-14 status, budget table, and rolling tracker [10-U1 complete]
   docs: update roadmap with phases 10-14 status, budget table, and rolling tracker [10-U1 complete]
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[8677cfc] 2026-04-20 feat(phase10): extract novel context to novel-context.js module [10-U1]
   feat(phase10): extract novel context to novel-context.js module [10-U1]
   - Moved 12 functions (extractNovelContext, getNovelIdFromCurrentPage, autoUpdateNovelOnVisit, showUpdateAvailableBanner, manuallyCheckAndUpdateNovel, detectMetadataChanges, displayChangeSummary, showChapterRegressionPrompt, handleNovelAddUpdate, handleNovelDelete, handleRemoveNovelWithBlocklist, isNovelBlocklisted) from content.js to src/content/modules/novel-context.js
   - Thinned content.js by ~863 lines (7628 -> 6765)
   - Wired up loadNovelContextModule() with full ctx injection
   - Added .tmp/ to .gitignore for temp extraction scripts
   Files:
   - .gitignore
   - src/content/content.js
   - src/content/modules/novel-context.js
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[d825f0b] 2026-04-20 feat/fix: Complete Phase 14 Popup Overhaul and notification aggregation
   feat/fix: Complete Phase 14 Popup Overhaul and notification aggregation
   Files:
   - .gemini/antigravity/mcp_config.json
   - .gemini/prompts/get-to-work.prompt.md
   - .gemini/prompts/release-notes.prompt.md
   - .gemini/prompts/roadmap-continue-autonomous.prompt.md
   - .gemini/prompts/roadmap-implementation.prompt.md
   - .markdownlint.json
   - ... (20 more)
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[a536b7f] 2026-04-19 feat: update emojis and labels for better clarity and consistency across website handlers
   feat: update emojis and labels for better clarity and consistency across website handlers
   - Changed emojis in AO3, FanFiction, Ranobes, ScribbleHub, and WebNovel handlers for improved visual representation.
   - Updated section labels in settings definitions to use emojis instead of Unicode characters for better readability.
   - Enhanced formatting rules comments to use clearer symbols and language.
   - Adjusted button labels to include emojis for a more engaging user interface.
   Signed-off-by: Krishna GSVV <krishnagsvv@gmail.com>
   Files:
   - dev/emoji-tools.js
   - dev/fix_mojibake_utf8.py
   - dev/list-mojibake-tokens.py
   - dev/repair-text-encoding.js
   - docs/release/RELEASE_NOTES_3.7.0.md
   - landing/content-styles.html
   - ... (70 more)
   Package:
   - name: ranobe-gemini
   - version: 5.0.0
   Manifests:
   - src/manifest-firefox.json: 5.0.0
   - src/manifest-chromium.json: 5.0.0
   - src/library/manifest.webmanifest: 5.0.0

[c054974] 2026-04-19 fix(encoding): escape all non-ascii characters in javascript to prevent browser mojibake on iso-8859-1 host pages
   fix(encoding): escape all non-ascii characters in javascript to prevent browser mojibake on iso-8859-1 host pages
   Files:
   - dev/emoji-report.txt
   - dev/encode-unicode.js
   - dev/fix_all_emojis.py
   - dev/global-fix-emoji.js
   - dev/universal_emoji.js
   - src/background/background.js
   - ... (61 more)
   Package:
   - name: ranobe-gemini
   - version: 4.8.0
   Manifests:
   - src/manifest-firefox.json: 4.8.0
   - src/manifest-chromium.json: 4.8.0
   - src/library/manifest.webmanifest: 4.8.0

[1a6b8b8] 2026-04-19 docs: append phases 10-13 based on user requests (swipe, multi-sync storage, filters, modular settings)
   docs: append phases 10-13 based on user requests (swipe, multi-sync storage, filters, modular settings)
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   Package:
   - name: ranobe-gemini
   - version: 4.8.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[aa56e7a] 2026-04-19 chore: verify and mark phase 2-8 as completed, bump version to 4.8.0
   chore: verify and mark phase 2-8 as completed, bump version to 4.8.0
   - Validated code existence for phases 2 through 8 (e.g. Handler contracts, Provider interface, Storage adapter, OAuth fixes).
   - Updated TECHNICAL_ROADMAP.md budget table to reflect true completion state.
   - Regenerated GRAPH_REPORT.md reflecting the fully modularized Phase 1-9 structure.
   - Version bumped to 4.8.0 per roadmap semver guidelines as all architectural phases are implemented.
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   - package-lock.json
   - package.json
   Package:
   - name: ranobe-gemini
   - version: 4.8.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[a6584bf] 2026-04-19 feat: complete Phase 1 content runtime modularization
   feat: complete Phase 1 content runtime modularization
   Files:
   - src/content/content.js
   - src/content/modules/chunk-batch.js
   - src/content/modules/enhancement-cancel.js
   - src/content/modules/notification-runtime.js
   - src/content/modules/popup-library-runtime.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[603b25a] 2026-04-19 docs: formalize roadmap execution prompts and deprecate old TODOs
   docs: formalize roadmap execution prompts and deprecate old TODOs
   - Updated .github/prompts to instruct AI on version control and tracking (git branch, commit, map updates).
   - Moved legacy agile sprint planning from docs/development/TODO.md to explicitly enforce TECHNICAL_ROADMAP.md as the source of truth.
   - Marked src/TODO.md as an archived backlog proxy.
   - Set prompts to manually leave brief journals in the tracker when completing phases.
   Files:
   - .github/prompts/get-to-work.prompt.md
   - .github/prompts/release-notes.prompt.md
   - .github/prompts/roadmap-continue-autonomous.prompt.md
   - .github/prompts/roadmap-implementation.prompt.md
   - .gitignore
   - docs/development/TODO.md
   - ... (9 more)
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[910b2d5] 2026-04-18 chore normalize chunk processed runtime formatting
   chore normalize chunk processed runtime formatting
   Files:
   - src/content/modules/chunk-processed-runtime.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[2cd4c73] 2026-04-18 refactor extract chunk action handlers
   refactor extract chunk action handlers
   Files:
   - src/content/content.js
   - src/content/modules/chunk-events.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[e262150] 2026-04-18 chore normalize chunk error runtime formatting
   chore normalize chunk error runtime formatting
   Files:
   - src/content/modules/chunk-error-runtime.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[c746d76] 2026-04-18 refactor extract chunk processed runtime
   refactor extract chunk processed runtime
   Files:
   - src/content/content.js
   - src/content/modules/chunk-processed-runtime.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[bf33c05] 2026-04-18 refactor extract chunk error runtime
   refactor extract chunk error runtime
   Files:
   - src/content/content.js
   - src/content/modules/chunk-error-runtime.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[67417a4] 2026-04-18 refactor extract finalize prefix runtime
   refactor extract finalize prefix runtime
   Files:
   - src/content/content.js
   - src/content/modules/finalize-prefix.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[07d8d01] 2026-04-18 refactor simplify wip banner delegates
   refactor simplify wip banner delegates
   Files:
   - src/content/content.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[506443a] 2026-04-18 refactor delegate attribution helper only
   refactor delegate attribution helper only
   Files:
   - src/content/content.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[91a9a3d] 2026-04-18 chore normalize main summary banner formatting
   chore normalize main summary banner formatting
   Files:
   - src/content/modules/main-summary-banner.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[98937f8] 2026-04-18 refactor all-chunks-processed runtime handler
   refactor all-chunks-processed runtime handler
   Files:
   - src/content/content.js
   - src/content/modules/all-chunks-processed.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[7ca0213] 2026-04-18 refactor delegate main summary banner helper
   refactor delegate main summary banner helper
   Files:
   - src/content/content.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[4668c47] 2026-04-18 refactor main summary banner runtime
   refactor main summary banner runtime
   Files:
   - src/content/content.js
   - src/content/modules/main-summary-banner.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[195d17a] 2026-04-18 chore normalize formatting drift
   chore normalize formatting drift
   Files:
   - landing/privacy.html
   - src/content/content.js
   - src/content/modules/enhancement-banners.js
   - src/content/modules/enhancement-cancel.js
   - src/content/modules/enhancement-display.js
   - src/content/modules/enhancement-toggle-banner.js
   - ... (2 more)
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[9a91551] 2026-04-18 refactor enhancement attribution helper
   refactor enhancement attribution helper
   Files:
   - src/content/content.js
   - src/content/modules/enhancement-attribution.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[313b465] 2026-04-18 refactor wip banner runtime
   refactor wip banner runtime
   Files:
   - src/content/content.js
   - src/content/modules/wip-banner-runtime.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[4287285] 2026-04-18 refactor enhancement cancel flow
   refactor enhancement cancel flow
   Files:
   - src/content/content.js
   - src/content/modules/enhancement-cancel.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[6375c62] 2026-04-18 refactor enhancement display helpers
   refactor enhancement display helpers
   Files:
   - src/content/content.js
   - src/content/modules/enhancement-display.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[2dd4455] 2026-04-18 refactor enhanced banner factory
   refactor enhanced banner factory
   Files:
   - src/content/content.js
   - src/content/modules/enhanced-content-banner.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[e057688] 2026-04-18 refactor enhancement toggle helpers
   refactor enhancement toggle helpers
   Files:
   - src/content/content.js
   - src/content/modules/enhancement-toggle-banner.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[71c0272] 2026-04-18 refactor content notifications
   refactor content notifications
   Files:
   - src/content/content.js
   - src/content/modules/notification-runtime.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[c1e8f4a] 2026-04-18 refactor content banner helpers
   refactor content banner helpers
   Files:
   - src/content/content.js
   - src/content/modules/enhancement-banners.js
   - src/content/modules/read-aloud-ui.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[7559e9b] 2026-04-18 Extract read-aloud UI content module
   Extract read-aloud UI content module
   Files:
   - src/content/content.js
   - src/content/modules/read-aloud-ui.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[477c770] 2026-04-18 Sync roadmap and privacy docs
   Sync roadmap and privacy docs
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   - landing/privacy.html
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[e13f126] 2026-04-18 Align privacy policy with opt-in metrics
   Align privacy policy with opt-in metrics
   Files:
   - landing/privacy.html
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[85bbac6] 2026-04-18 Add consent-safe telemetry impact metrics
   Add consent-safe telemetry impact metrics
   Files:
   - README.md
   - docs/backup/RESTORE_SMOKE_CHECKLIST.md
   - docs/overview/TECHNICAL_ROADMAP.md
   - docs/ux/CROSS_DEVICE_PARITY_CHECKLIST.md
   - landing/index.html
   - landing/script.js
   - ... (4 more)
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[9867dbc] 2026-04-18 phase8: add manual restore smoke checklist and roadmap drift sync
   phase8: add manual restore smoke checklist and roadmap drift sync
   Files:
   - docs/backup/CROSS_SURFACE_COMPATIBILITY.md
   - docs/backup/RESTORE_SMOKE_CHECKLIST.md
   - docs/overview/TECHNICAL_ROADMAP.md
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[784c3cb] 2026-04-18 phase8: add cross-device parity checklist and stabilize roadmap progress
   phase8: add cross-device parity checklist and stabilize roadmap progress
   Files:
   - .github/prompts/roadmap-continue-autonomous.prompt.md
   - README.md
   - dev/build.js
   - dev/validate-backup-compat.js
   - docs/backup/BACKUP_GUIDE.md
   - docs/backup/CROSS_SURFACE_COMPATIBILITY.md
   - ... (39 more)
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[46e9830] 2026-04-16 refactor(content): centralize wip banner dom insertion
   refactor(content): centralize wip banner dom insertion
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/content/content.js
   - src/content/modules/dom-integration.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[e25e4ef] 2026-04-16 refactor(content): extract master banner dom integration runtime
   refactor(content): extract master banner dom integration runtime
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/content/content.js
   - src/content/modules/dom-integration.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[0a50d7e] 2026-04-16 refactor(content): extract batch chunk controls runtime
   refactor(content): extract batch chunk controls runtime
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/content/content.js
   - src/content/modules/chunk-batch.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[8c7db39] 2026-04-16 refactor(content): extract chunk toggle/delete event runtime (phase 1-u2)
   refactor(content): extract chunk toggle/delete event runtime (phase 1-u2)
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/content/content.js
   - src/content/modules/chunk-events.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[4ec58cf] 2026-04-16 refactor(content): extract chunk control runtime and add autonomous prompt templates
   refactor(content): extract chunk control runtime and add autonomous prompt templates
   Files:
   - .github/prompts/get-to-work.prompt.md
   - .github/prompts/roadmap-continue-autonomous.prompt.md
   - src/content/content.js
   - src/content/modules/chunk-controls.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[abb207a] 2026-04-16 refactor(content): extract summary runtime orchestration module (phase 1-u1)
   refactor(content): extract summary runtime orchestration module (phase 1-u1)
   Files:
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/content/content.js
   - src/content/modules/summary-runtime.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[270c30e] 2026-04-16 merge: addon store automation and extension bridge cycle
   merge: addon store automation and extension bridge cycle
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[37b29d6] 2026-04-16 docs(release): document modular store publish modes and AMO requirements
   docs(release): document modular store publish modes and AMO requirements
   Files:
   - docs/development/README.md
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[d522030] 2026-04-16 feat(bridge): add modular extension bridge framework and AO3 adapter example
   feat(bridge): add modular extension bridge framework and AO3 adapter example
   Files:
   - docs/development/TODO.md
   - docs/guides/PLUGIN_HANDLER_PUBLISHING.md
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/content/content.js
   - src/utils/extension-bridges.js
   - src/utils/website-handlers/ao3-handler.js
   - ... (1 more)
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[9da88be] 2026-04-16 build(release): harden packaging and simplify store publish requirements
   build(release): harden packaging and simplify store publish requirements
   Files:
   - .github/workflows/publish-addons.yml
   - README.md
   - dev/build.js
   - dev/publish-addon-stores.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[8d6f112] 2026-04-16 Mark mobile nav UX sprint item complete
   Mark mobile nav UX sprint item complete
   Files:
   - docs/development/TODO.md
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[6d16a9e] 2026-04-16 Add mobile bottom navigation and update roadmap budgets
   Add mobile bottom navigation and update roadmap budgets
   Files:
   - docs/development/TODO.md
   - docs/overview/TECHNICAL_ROADMAP.md
   - src/library/library.css
   - src/library/library.html
   - src/library/library.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[bc1691c] 2026-04-16 Add layered roadmap planning and complete mobile modal UX tracking
   Add layered roadmap planning and complete mobile modal UX tracking
   Files:
   - docs/development/TODO.md
   - docs/overview/TECHNICAL_ROADMAP.md
   - docs/overview/VISUAL_JOURNEY.md
   - docs/release/commit-history.md
   - releases/RanobeGemini_v4.7.0_chromium.zip
   - releases/RanobeGemini_v4.7.0_firefox.zip
   - ... (12 more)
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[f91b401] 2026-04-16 Add phase unit sizing and prompt-efficiency tracking to roadmap
   Add phase unit sizing and prompt-efficiency tracking to roadmap
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[634cec0] 2026-04-16 Improve mobile modal touch targets
   Improve mobile modal touch targets
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[6cc50c3] 2026-04-16 Remove hidden description truncation and fix TODO link
   Remove hidden description truncation and fix TODO link
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[93b40d0] 2026-04-16 Align summary typography and roadmap status
   Align summary typography and roadmap status
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[e0ec88e] 2026-04-16 feat: update release notes and manage icon assets
   feat: update release notes and manage icon assets
   Signed-off-by: Krishna GSVV <krishnagsvv@gmail.com>
   Files:
   - docs/release/RELEASE_NOTES_4.1.0.md
   - src/icons/Social Banner.png
   - src/icons/logo-dark-1024.png
   - src/icons/logo-dark-128.png
   - src/icons/logo-dark-16.png
   - src/icons/logo-dark-256.png
   - ... (13 more)
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[54b81dd] 2026-04-16 Add release automation and modal navigation updates
   Add release automation and modal navigation updates
   Files:
   - .eslintrc.json
   - .github/workflows/publish-addons.yml
   - README.md
   - dev/build.js
   - dev/publish-addon-stores.js
   - docs/development/README.md
   - ... (26 more)
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[bcccdab] 2026-04-16 feat: refine URL import flow and AO3 handler behavior
   feat: refine URL import flow and AO3 handler behavior
   Files:
   - src/content/content.js
   - src/library/library-settings.js
   - src/utils/website-handlers/ao3-handler.js
   - src/utils/website-handlers/fanfiction-handler.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[242abe2] 2026-04-16 fix: restore validation by resolving lint toolchain conflict
   fix: restore validation by resolving lint toolchain conflict
   Files:
   - .eslintrc.json
   - package-lock.json
   - package.json
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[8dc9ec0] 2026-04-16 fix(import): skip AO3 series URLs and improve URL import progress/continuation handling
   fix(import): skip AO3 series URLs and improve URL import progress/continuation handling
   Files:
   - src/library/library-settings.js
   - src/utils/novel-library.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[62a6c5e] 2026-04-16 docs+telemetry: inline CFlair badges and enforce consent-gated telemetry
   docs+telemetry: inline CFlair badges and enforce consent-gated telemetry
   Files:
   - src/library/library.js
   - src/utils/telemetry.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[d285b2c] 2026-04-16 docs+telemetry: move CFlair counters to top badges and align counter endpoint
   docs+telemetry: move CFlair counters to top badges and align counter endpoint
   Files:
   - README.md
   - src/utils/telemetry.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[a0ae3c4] 2026-04-16 docs(readme): add CFlair project SVG counters and telemetry disclosure
   docs(readme): add CFlair project SVG counters and telemetry disclosure
   Files:
   - README.md
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[047bb9a] 2026-04-10 feat: formalize modular roadmap, provider-agnostic AI direction, and secure build secrets
   feat: formalize modular roadmap, provider-agnostic AI direction, and secure build secrets
   - Update technical roadmap with verified current state and modular priorities
   - Add provider-agnostic AI adapter phase (Gemini/Ollama/OpenAI-compatible/router)
   - Add cross-device compatibility phase for web app + extension flows
   - Strengthen Copilot and roadmap prompts for local-first modular architecture
   - Add plugin/handler/provider authoring and publishing guide
   - Add dotenv-based build-time secret injection to dist constants only
   - Add guardrail to block hardcoded source secrets in constants
   Files:
   - .env.example
   - .github/copilot-instructions.md
   - .github/prompts/roadmap-implementation.prompt.md
   - .gitignore
   - dev/build.js
   - docs/guides/PLUGIN_HANDLER_PUBLISHING.md
   - ... (3 more)
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[425f5da] 2026-04-10 docs: formalize technical roadmap and prompt-driven execution
   docs: formalize technical roadmap and prompt-driven execution
   Files:
   - .github/copilot-instructions.md
   - .github/prompts/roadmap-implementation.prompt.md
   - docs/overview/TECHNICAL_ROADMAP.md
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[e0b7de0] 2026-04-10 feat: enhance summary service with request caching and improved error handling
   feat: enhance summary service with request caching and improved error handling
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - src/content/content.js
   - src/library/library.css
   - src/utils/summary-service.js
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[91bcd4a] 2026-04-10 Merge pull request #1 from Life-Experimentalist/dependabot/npm_and_yarn/npm_and_yarn-c548022d36
   Merge pull request #1 from Life-Experimentalist/dependabot/npm_and_yarn/npm_and_yarn-c548022d36
   chore(deps-dev): bump the npm_and_yarn group across 1 directory with 2 updates
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[19360f6] 2026-04-10 chore(deps-dev): bump the npm_and_yarn group across 1 directory with 2 updates
   chore(deps-dev): bump the npm_and_yarn group across 1 directory with 2 updates
   Bumps the npm_and_yarn group with 2 updates in the / directory: [flatted](https://github.com/WebReflection/flatted) and [minimatch](https://github.com/isaacs/minimatch).
   Updates `flatted` from 3.3.3 to 3.4.2
   - [Commits](https://github.com/WebReflection/flatted/compare/v3.3.3...v3.4.2)
   Updates `minimatch` from 3.1.2 to 3.1.5
   - [Changelog](https://github.com/isaacs/minimatch/blob/main/changelog.md)
   - [Commits](https://github.com/isaacs/minimatch/compare/v3.1.2...v3.1.5)
   ---
   Files:
   - package-lock.json
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[15ed0b4] 2026-03-26 feat: add PWA testing guide and update version to 4.7.0 with service worker enhancements
   feat: add PWA testing guide and update version to 4.7.0 with service worker enhancements
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - docs/guides/PWA_TESTING_EDGE_TEMP_ADDON.md
   - landing/manifest.webmanifest
   - landing/script.js
   - landing/sw.js
   - package.json
   - src/config/build-version.js
   - ... (3 more)
   Package:
   - name: ranobe-gemini
   - version: 4.7.0
   Manifests:
   - src/manifest-firefox.json: 4.7.0
   - src/manifest-chromium.json: 4.7.0
   - src/library/manifest.webmanifest: 4.7.0

[3df3842] 2026-03-26 docs(prompt): enforce targeted version-sensitive doc updates
   docs(prompt): enforce targeted version-sensitive doc updates
   Files:
   - .github/prompts/release-notes.prompt.md
   Package:
   - name: ranobe-gemini
   - version: 4.6.0
   Manifests:
   - src/manifest-firefox.json: 4.6.0
   - src/manifest-chromium.json: 4.6.0
   - src/library/manifest.webmanifest: 4.6.0

[8439423] 2026-03-26 Revert "chore: automate docs version sync and update to v4.6.0"
   Revert "chore: automate docs version sync and update to v4.6.0"
   This reverts commit 1a3646f7bfd6b096e929248c0b047d2e73748428.
   Files:
   - .github/prompts/release-notes.prompt.md
   - dev/update-doc-versions.js
   - docs/README.md
   - docs/architecture/ARCHITECTURE.md
   - docs/architecture/COLLAPSIBLE_JOURNEY.md
   - docs/architecture/DYNAMIC_DOMAINS.md
   - ... (36 more)
   Package:
   - name: ranobe-gemini
   - version: 4.6.0
   Manifests:
   - src/manifest-firefox.json: 4.6.0
   - src/manifest-chromium.json: 4.6.0
   - src/library/manifest.webmanifest: 4.6.0

[1a3646f] 2026-03-26 chore: automate docs version sync and update to v4.6.0
   chore: automate docs version sync and update to v4.6.0
   - Add npm script 'docs:update-versions' to keep docs version-sensitive files in sync
   - Update release-notes.prompt.md to include docs automation workflow instructions
   - Add dev/update-doc-versions.js script that:
   - Syncs version tokens from package.json to docs
   - Updates 'Last Updated' timestamps across docs
   - Skips release notes and commit history (historic records)
   - Preserves capitalization of 'Last Updated' vs 'Last updated'
   Files:
   - .github/prompts/release-notes.prompt.md
   - dev/update-doc-versions.js
   - docs/README.md
   - docs/architecture/ARCHITECTURE.md
   - docs/architecture/COLLAPSIBLE_JOURNEY.md
   - docs/architecture/DYNAMIC_DOMAINS.md
   - ... (36 more)
   Package:
   - name: ranobe-gemini
   - version: 4.6.0
   Manifests:
   - src/manifest-firefox.json: 4.6.0
   - src/manifest-chromium.json: 4.6.0
   - src/library/manifest.webmanifest: 4.6.0

[1ff85cd] 2026-03-25 Refactor and clean up code across multiple files
   Refactor and clean up code across multiple files
   - Updated method parameters to use underscore prefix for unused parameters in NovelCardRenderer and shelf-page.js.
   - Removed unused fandom navigation functions and related code in ranobes and scribblehub shelf pages.
   - Cleaned up ScribbleHubNovelCard by removing unused variables.
   - Removed redundant variables and functions in popup.js related to theme management and notifications.
   - Simplified chunking UI code by removing unused status colors and variables.
   - Removed unnecessary escapeHtml function from collapsible-sections.js.
   - Cleaned up domain-constants.js and drive.js by removing unused imports.
   Files:
   - .github/copilot-instructions.md
   - .github/prompts/release-notes.prompt.md
   - docs/architecture/ARCHITECTURE.md
   - docs/features/NOVEL_LIBRARY.md
   - docs/overview/VISUAL_DASHBOARD.md
   - docs/release/RELEASE_NOTES_4.6.0.md
   - ... (26 more)
   Package:
   - name: ranobe-gemini
   - version: 4.6.0
   Manifests:
   - src/manifest-firefox.json: 4.6.0
   - src/manifest-chromium.json: 4.6.0
   - src/library/manifest.webmanifest: 4.6.0

[3eaa27e] 2026-03-25 feat: update to version 4.6.0, enhance PWA support, and add automated visual dashboard
   feat: update to version 4.6.0, enhance PWA support, and add automated visual dashboard
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - README.md
   - dev/generate-doc-visualizers.js
   - docs/architecture/ARCHITECTURE.md
   - docs/development/TODO.md
   - docs/features/NOVEL_LIBRARY.md
   - docs/overview/VISUAL_DASHBOARD.md
   - ... (12 more)
   Package:
   - name: ranobe-gemini
   - version: 4.6.0
   Manifests:
   - src/manifest-firefox.json: 4.6.0
   - src/manifest-chromium.json: 4.6.0
   - src/library/manifest.webmanifest: 4.6.0

[ec564f6] 2026-03-25 feat: update version to 4.6.0 and enhance novel sharing functionality
   feat: update version to 4.6.0 and enhance novel sharing functionality
   - Updated version display mechanism across multiple HTML files to dynamically fetch version from package.json.
   - Added a new section in novel-status.html for shareable novel modals with direct links.
   - Improved OAuth redirect handling in oauth-redirect.html for better user experience.
   - Implemented a recovery flow for missing novels in the library, allowing users to auto-import missing novels from shareable links.
   - Refactored shared-shelf-helpers.js to include novel recovery logic.
   - Updated manifest files for both Chromium and Firefox to reflect the new version.
   - Various minor fixes and improvements across library shelf pages to support the new recovery feature.
   Files:
   - README.md
   - docs/development/LANDING_CODE_AUDIT.md
   - docs/development/README.md
   - docs/development/TODO.md
   - docs/features/NOVEL_LIBRARY.md
   - landing/architecture.html
   - ... (26 more)
   Package:
   - name: ranobe-gemini
   - version: 4.6.0
   Manifests:
   - src/manifest-firefox.json: 4.6.0
   - src/manifest-chromium.json: 4.6.0
   - src/library/manifest.webmanifest: 4.6.0

[d3d5176] 2026-03-25 feat: Enhance novel library features and improve search functionality
   feat: Enhance novel library features and improve search functionality
   - Added compact control chips for narrow phones in library CSS.
   - Improved URL import handling in library JS, including deduplication and skipping existing novels.
   - Enhanced search functionality across various websites to include more metadata fields (description, tags, genres).
   - Updated manifest files to version 4.5.0.
   - Introduced canonical import URLs for various website handlers (AO3, Fanfiction, Ranobes, ScribbleHub, WebNovel).
   - Refactored reading list handling and status dropdown options for better user experience.
   - Removed redundant desktop switcher button from mobile handler.
   Files:
   - README.md
   - docs/backup/ranobe-backup.schema.json
   - docs/development/TODO.md
   - docs/release/RELEASE_NOTES_4.5.0.md
   - docs/release/commit-history.md
   - landing/architecture.html
   - ... (28 more)
   Package:
   - name: ranobe-gemini
   - version: 4.5.0
   Manifests:
   - src/manifest-firefox.json: 4.5.0
   - src/manifest-chromium.json: 4.5.0
   - src/library/manifest.webmanifest: 4.5.0

[b872185] 2026-03-20 feat: add architecture documentation and schema endpoint
   feat: add architecture documentation and schema endpoint
   - Introduced a public architecture documentation page with modular runtime, component, and backup flow diagrams.
   - Added a hosted schema endpoint proxy at `https://ranobe.vkrishna04.me/schemas/ranobe-backup.schema.json` referencing the canonical raw schema source.
   fix: enhance drive backup history panel behavior
   - Updated drive backup history panel to reload on every expand/toggle, ensuring users see up-to-date Drive files.
   fix: improve architecture documentation resilience
   - Implemented diagram fallback behavior in architecture docs to prevent blank content if Mermaid runtime loading fails.
   chore: update release notes and changelog for v4.4.0
   Files:
   - docs/backup/BACKUP_GUIDE.md
   - docs/backup/CONTINUOUS_BACKUP_GUIDE.md
   - docs/backup/FIREFOX_DRIVE_SYNC_FIX.md
   - docs/backup/OAUTH_CHECKBOX_FIX.md
   - docs/backup/README_GOOGLE_DRIVE.md
   - docs/backup/ranobe-backup.schema.json
   - ... (15 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[5645535] 2026-03-20 landing: add architecture charts page and wire modular-flow navigation
   landing: add architecture charts page and wire modular-flow navigation
   Files:
   - landing/architecture.html
   - landing/content-styles.html
   - landing/drive-setup.html
   - landing/index.html
   - landing/install-guide.html
   - landing/novel-status.html
   - ... (4 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[25601ce] 2026-03-20 landing: add cross-browser install guide and standardize install UX
   landing: add cross-browser install guide and standardize install UX
   Files:
   - README.md
   - docs/development/TODO.md
   - landing/content-styles.html
   - landing/drive-setup.html
   - landing/drive-setup.js
   - landing/index.html
   - ... (6 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[2fa177e] 2026-03-20 security: remediate OAuth credential exposure and harden Drive UX
   security: remediate OAuth credential exposure and harden Drive UX
   Files:
   - .gitignore
   - docs/guides/FIREFOX_GOOGLE_DRIVE_OAUTH.md
   - docs/guides/OAUTH_SETUP_DETAILED.md
   - docs/implementation/DETAILED_CODE_CHANGES.md
   - docs/implementation/IMPLEMENTATION_COMPLETE.md
   - docs/release/GOOGLE_DRIVE_FIREFOX_FIXES.md
   - ... (5 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[713c6c9] 2026-03-17 feat: remove commit-history-cli and commit-history-uv packages
   feat: remove commit-history-cli and commit-history-uv packages
   - Deleted the `commit-history-cli` package, including its `package.json` and test files.
   - Removed the `commit-history-uv` package, including its README, `.gitignore`, `pyproject.toml`, source files, and tests.
   - Cleaned up associated files and directories to streamline the repository.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/commit-history-auto.ps1
   - dev/commit-history.js
   - docs/development/COMMIT_HISTORY_TOOLING.md
   - docs/release/commit-history.md
   - packages/commit-history-cli/.gitignore
   - packages/commit-history-cli/README.md
   - ... (12 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[a8b7fd6] 2026-03-17 feat(v4.4.0): release 4.4.0 with auto commit-history publish
   feat(v4.4.0): release 4.4.0 with auto commit-history publish
   Files:
   - .gitignore
   - dev/commit-history-auto.ps1
   - dev/commit-history.js
   - dev/fix_emoji.py
   - docs/backup/ranobe-backup.schema.json
   - docs/backups/BACKUP_GUIDE.md
   - ... (35 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[25040ff] 2026-03-17 feat(v4.4.0)!: redesign landing pages with responsive content filters and library navigation
   feat(v4.4.0)!: redesign landing pages with responsive content filters and library navigation
   - Complete rewrite of content-styles.html (500+ lines)
   - Fully responsive design: mobile → tablet → desktop layouts
   - Interactive collapsible demo cards for all filter types
   - SVG flow diagram showing content processing pipeline
   - 6 built-in content type showcase with card grid
   - Library navigation link on all 5 landing pages
   - openLibrarySettings() function for extension integration
   Files:
   - docs/architecture/COLLAPSIBLE_JOURNEY.md
   - docs/features/COLLAPSIBLE_SECTIONS.md
   - docs/overview/VISUAL_JOURNEY.md
   - landing/content-styles.html
   - landing/drive-setup.html
   - landing/index.html
   - ... (3 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[eba1cfa] 2026-03-17 feat(v4.4.0)!: complete collapsible content filters system with comprehensive documentation
   feat(v4.4.0)!: complete collapsible content filters system with comprehensive documentation
   ## Core Features Added
   ### 1. Collapsible Sections System (Content Filters)
   - Intelligent content detection by Gemini (fight scenes, R18 content, author notes)
   - Collapse/expand toggles (not permanent hiding—users control visibility)
   - Summary-first approach: brief summary visible, full content on demand
   - Per-type configuration: toggle each type on/off, set default states
   - Custom types: users can define their own collapsible content categories
   Files:
   - .github/DISCUSSION_TEMPLATE/faq.yml
   - .github/DISCUSSION_TEMPLATE/general.yml
   - .github/DISCUSSION_TEMPLATE/ideas.yml
   - .github/DISCUSSION_TEMPLATE/q-and-a.yml
   - .github/copilot-instructions.md
   - dev/commit-history.js
   - ... (14 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[a73db74] 2026-03-16 feat(4.4.0): improve UX with redesigned landing, collapsible content, reading-lists, and white-space styling
   feat(4.4.0): improve UX with redesigned landing, collapsible content, reading-lists, and white-space styling
   - Redesign Getting Started section in drive-setup.html with modern card-based layout
   - Add CSS styles for setup timeline and step cards with better visual hierarchy
   - Update content.css: change white-space from pre-wrap to pre-line for game stats, system messages, and other special content boxes
   - Add comprehensive documentation in .github/copilot-instructions.md for reading-lists and collapsible sections architecture
   - Verify collapsible sections implementation for fight scenes, R18 content, and author notes
   - Ensure reading-list and custom list features are properly documented for future development
   - All changes tested and build validation successful
   Files:
   - .github/copilot-instructions.md
   - landing/drive-setup.html
   - landing/styles-drive.css
   - src/content/content.css
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[34d6041] 2026-03-16 feat(4.4.0): refactor rereading into reading-list badges
   feat(4.4.0): refactor rereading into reading-list badges
   Files:
   - .github/copilot-instructions.md
   - README.md
   - docs/development/TODO.md
   - docs/overview/Roadmap.md
   - package.json
   - src/config/build-version.js
   - ... (7 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[458ec18] 2026-03-16 docs(4.3.0): finalize landing nav and vertical Mermaid docs
   docs(4.3.0): finalize landing nav and vertical Mermaid docs
   Files:
   - docs/development/TODO.md
   - docs/overview/Roadmap.md
   - landing/content-styles.html
   - landing/drive-setup.html
   - landing/index.html
   - landing/nav.js
   - ... (4 more)
   Package:
   - name: ranobe-gemini
   - version: 4.3.0
   Manifests:
   - src/manifest-firefox.json: 4.3.0
   - src/manifest-chromium.json: 4.3.0
   - src/library/manifest.webmanifest: 4.3.0

[c8778d1] 2026-03-16 Enhance metadata extraction for fanfiction, ranobes, and scribblehub handlers
   Enhance metadata extraction for fanfiction, ranobes, and scribblehub handlers
   - Improved metadata extraction logic in FanfictionMobileHandler to include category, fandom hierarchy, and relationships.
   - Refined regex patterns for extracting metadata fields such as rating, language, and word count.
   - Added support for extracting reviews, favorites, and follows in FanfictionMobileHandler.
   - Enhanced RanobesHandler to extract author information more reliably and ensure main novel URL is set correctly.
   - Updated ScribbleHubHandler to include additional author and genre extraction methods, and improved numeric parsing for statistics.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - README.md
   - docs/release/CHANGELOG.md
   - docs/release/RELEASE_NOTES_4.1.0.md
   - docs/release/RELEASE_NOTES_4.2.0.md
   - docs/release/RELEASE_NOTES_4.3.0.md
   - landing/index.html
   - ... (23 more)
   Package:
   - name: ranobe-gemini
   - version: 4.3.0
   Manifests:
   - src/manifest-firefox.json: 4.3.0
   - src/manifest-chromium.json: 4.3.0
   - src/library/manifest.webmanifest: 4.3.0

[8a6800e] 2026-03-15 feat: Implement Incognito Mode with UI controls and settings
   feat: Implement Incognito Mode with UI controls and settings
   - Added Incognito Mode functionality to pause library tracking.
   - Introduced UI elements in the popup and library settings for enabling/disabling Incognito Mode.
   - Implemented duration settings for Incognito Mode with automatic expiration.
   - Updated background scripts to handle Incognito Mode state and interactions.
   - Enhanced accessibility by managing visibility of Gemini UI elements during Read Aloud.
   - Refactored summary extraction logic to improve quality checks and retries.
   - Added configuration options for hiding Gemini UI from Read Aloud in library settings.
   Files:
   - src/background/background.js
   - src/content/content.js
   - src/library/library-settings.html
   - src/library/library-settings.js
   - src/library/library.html
   - src/library/library.js
   - ... (7 more)
   Package:
   - name: ranobe-gemini
   - version: 4.3.0
   Manifests:
   - src/manifest-firefox.json: 4.3.0
   - src/manifest-chromium.json: 4.3.0
   - src/library/manifest.webmanifest: 4.3.0

[1c64d42] 2026-03-14 feat: Implement collapsible sections for fight scenes, R18 content, and author notes
   feat: Implement collapsible sections for fight scenes, R18 content, and author notes
   - Added a new collapsible sections system to enhance chapter view.
   - Introduced default content filter settings for managing visibility of fight scenes, R18 content, and author notes.
   - Updated popup.js to handle backup model selection and content filter settings.
   - Enhanced chunking logic to accurately extract paragraphs from HTML content.
   - Improved constants.js with new settings for collapsible content sections.
   - Updated novel-library.js to derive story completion status from publication status.
   - Added error handling for theme configuration to ensure compatibility with older runtimes.
   Files:
   - package.json
   - releases/RanobeGemini_v4.3.0_chromium.zip
   - releases/RanobeGemini_v4.3.0_firefox.zip
   - releases/source/Ranobe-gemini_v4.3.0_source.zip
   - src/background/background.js
   - src/config/build-version.js
   - ... (26 more)
   Package:
   - name: ranobe-gemini
   - version: 4.3.0
   Manifests:
   - src/manifest-firefox.json: 4.3.0
   - src/manifest-chromium.json: 4.3.0
   - src/library/manifest.webmanifest: 4.3.0

[be8ecd9] 2026-03-12 feat: v4.2.0 enhance library UI and functionality
   feat: v4.2.0 enhance library UI and functionality
   - Added a new hero eyebrow section in library.html and styled it in library.css for improved visibility of the "Continue Reading" prompt.
   - Refactored character and relationship rendering logic in novel-card.js to separate character and relationship sections for better clarity.
   - Updated shelf-page.js to dynamically build reading status buttons based on available statuses, improving user interaction.
   - Modified chunking UI components to include new pause and skip functionality, enhancing user control during processing.
   - Improved accessibility by adding aria-hidden attributes to non-content UI elements in chunking components.
   - Updated CSS styles for better responsiveness and visual consistency across various components.
   - Introduced new constants for word count thresholds and cache restore retry delays to enhance performance.
   Files:
   - releases/RanobeGemini_v4.2.0_chromium.zip
   - releases/RanobeGemini_v4.2.0_firefox.zip
   - releases/source/Ranobe-gemini_v4.2.0_source.zip
   - src/background/background.js
   - src/background/message-handlers/index.js
   - src/content/content.js
   - ... (12 more)
   Package:
   - name: ranobe-gemini
   - version: 4.2.0
   Manifests:
   - src/manifest-firefox.json: 4.2.0
   - src/manifest-chromium.json: 4.2.0
   - src/library/manifest.webmanifest: 4.2.0

[0ccbaf6] 2026-03-12 feat: Implement database fixes for FanFiction.net character data and enhance library UI with new buttons
   feat: Implement database fixes for FanFiction.net character data and enhance library UI with new buttons
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/watch.js
   - src/background/background.js
   - src/content/content.js
   - src/library/library-settings.html
   - src/library/library-settings.js
   - src/library/library.html
   - ... (9 more)
   Package:
   - name: ranobe-gemini
   - version: 4.2.0
   Manifests:
   - src/manifest-firefox.json: 4.2.0
   - src/manifest-chromium.json: 4.2.0
   - src/library/manifest.webmanifest: 4.2.0

[1c80627] 2026-03-10 feat: Add custom content box types feature with UI for user-defined styles
   feat: Add custom content box types feature with UI for user-defined styles
   - Introduced a new section in library settings for managing custom content boxes.
   - Users can define CSS classes, display names, and styling options for content boxes.
   - Implemented functionality to save and load custom box types from browser storage.
   - Added live preview for custom boxes in the settings UI.
   - Updated CSS styles to ensure proper alignment and presentation of headings and content.
   - Bumped version to 4.2.0 to reflect new feature addition.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - landing/content-styles.html
   - landing/index.html
   - landing/novel-status.html
   - landing/privacy.html
   - landing/terms.html
   - package.json
   - ... (11 more)
   Package:
   - name: ranobe-gemini
   - version: 4.2.0
   Manifests:
   - src/manifest-firefox.json: 4.2.0
   - src/manifest-chromium.json: 4.2.0
   - src/library/manifest.webmanifest: 4.2.0

[5c0d202] 2026-03-08 feat(theme): enhance auto mode functionality with schedule and sun options
   feat(theme): enhance auto mode functionality with schedule and sun options
   - Added autoBehavior, timeCustomStart, and timeCustomEnd to DEFAULT_THEME for better theme management.
   - Implemented schedule and sun-based auto mode detection in resolveMode function.
   - Introduced helper functions for time-based checks and sunrise/sunset estimation.
   - Updated THEME_PRESETS with new creative themes including "tokyo-night", "catppuccin-mocha", "synthwave", and others.
   - Enhanced getThemePalette and setThemeVariables to support new auto mode features.
   refactor(AO3Handler): improve formatting rules for author notes and special content
   - Updated DEFAULT_SITE_PROMPT to clarify formatting rules for author notes, epigraphs, and flashbacks.
   Files:
   - dev/build.js
   - releases/RanobeGemini_v4.1.0_chromium.zip
   - releases/RanobeGemini_v4.1.0_firefox.zip
   - releases/source/Ranobe-gemini_v4.1.0_source.zip
   - src/background/background.js
   - src/config/build-version.js
   - ... (10 more)
   Package:
   - name: ranobe-gemini
   - version: 4.1.0
   Manifests:
   - src/manifest-firefox.json: 4.1.0
   - src/manifest-chromium.json: 4.1.0
   - src/library/manifest.webmanifest: 4.1.0

[bb80576] 2026-03-08 feat: add reading progress bar to novel modals and update export filename templates
   feat: add reading progress bar to novel modals and update export filename templates
   - Implemented a reading progress bar in the novel modals for Ranobes and ScribbleHub, displaying the current chapter and total chapters read.
   - Updated the export filename formatting to include word count and changed the default export extension to EPUB.
   - Removed unused background animation styles and CSS files from the HTML templates.
   - Enhanced the copy functionality for novel information to use a new export template.
   - Updated the manifest version to 4.1.0 for both Chromium and Firefox.
   - Added new theme presets and removed background animation settings from the default theme configuration.
   - Improved the chunking UI to provide better feedback on enhancement status and added new buttons for enhancing chunks directly from the UI.
   Files:
   - .gemini/settings.json
   - dev/build.js
   - docs/release/CHANGELOG.md
   - docs/release/RELEASE_NOTES_4.0.0.md
   - docs/release/RELEASE_NOTES_4.0.0_MARKETPLACE.md
   - landing/drive-setup.html
   - ... (40 more)
   Package:
   - name: ranobe-gemini
   - version: 4.1.0
   Manifests:
   - src/manifest-firefox.json: 4.1.0
   - src/manifest-chromium.json: 4.1.0
   - src/library/manifest.webmanifest: 4.1.0

[0576607] 2026-03-05 v4.0.0 complete Refactor AO3 and Fanfiction handlers to streamline download and copy functionality
   v4.0.0 complete Refactor AO3 and Fanfiction handlers to streamline download and copy functionality
   - Removed custom download settings for AO3 as it supports native downloads.
   - Introduced a "Copy" button in both AO3 and Fanfiction handlers to copy formatted novel info to clipboard.
   - Updated the method for retrieving export templates from library settings.
   - Consolidated chapter UI configuration in BaseWebsiteHandler for better maintainability.
   - Deprecated legacy methods for custom chapter buttons in favor of a unified configuration approach.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/build.js
   - package.json
   - releases/RanobeGemini_v4.0.0_chromium.zip
   - releases/RanobeGemini_v4.0.0_firefox.zip
   - releases/source/Ranobe-gemini_v4.0.0_source.zip
   - scripts/fix_emoji.py
   - ... (41 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[e72701e] 2026-02-28 feat: Enhance site settings UI with section separators and text input fields
   feat: Enhance site settings UI with section separators and text input fields
   feat: Update service worker for improved caching and offline support
   fix: Adjust popup model selection options for clarity and consistency
   refactor: Improve popup.js to utilize DEFAULT_MODEL_ID for model selection
   style: Refine chunking UI styles for better layout and responsiveness
   fix: Update constants.js to change default model ID to "gemini-2.5-flash"
   feat: Add filename template options for novel exports in copy format
   feat: Implement FichHub download button with clipboard functionality in AO3 and Fanfiction handlers
   Files:
   - package.json
   - src/background/background.js
   - src/content/content.css
   - src/content/content.js
   - src/library/library-settings.css
   - src/library/library-settings.html
   - ... (15 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[6421c29] 2026-02-26 feat: Enhance mobile metadata handling and improve readability
   feat: Enhance mobile metadata handling and improve readability
   - Added fetchDesktopMetadata method to retrieve comprehensive metadata from the desktop version of fanfiction.net for mobile pages.
   - Implemented processRemoteMetadata to enrich mobile metadata with desktop data.
   - Created injectMetadataSummary to display a styled summary of the fetched metadata above chapter content.
   - Updated getMetadataSourceUrl to ensure mobile pages redirect to the desktop version for complete metadata.
   refactor: Update handler imports in HandlerManager
   - Changed import method in HandlerManager to use relative paths instead of browser.runtime.getURL for better compatibility.
   feat: Introduce configurable settings for Ranobes and ScribbleHub handlers
   Files:
   - .gitignore
   - .vscode/tasks.json
   - dev/emoji-report.txt
   - docs/backup/ranobe-backup.schema.json
   - docs/features/NOVEL_LIBRARY.md
   - landing/drive-setup.html
   - ... (56 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[b57a058] 2026-02-20 feat: Complete modularization of metadata fetching and handler settings
   feat: Complete modularization of metadata fetching and handler settings
   - Implemented a universal metadata fetching system with three strategies.
   - Developed a handler settings validation system for custom library settings.
   - Modularized background scripts into dedicated message handlers.
   - Created content script modules for improved feature management.
   - Updated base handler with new methods for metadata source and settings.
   - Enhanced existing handlers with proposed settings and validation.
   - Added comprehensive documentation for new systems and architecture.
   Files:
   - .markdownlint.json
   - README.md
   - build-output.txt
   - docs/WHATS_WHERE.md
   - docs/architecture/MODULAR_ARCHITECTURE.md
   - docs/architecture/MODULAR_SYSTEMS_README.md
   - ... (7 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[407e2ea] 2026-02-17 Refactor chunking utility to use simplified emoji regex; enhance debug panel for better tab handling; add new constants for debug output and carousel configuration; improve Drive token management with error handling; update novel library for reading status management and completion marking; refine website handlers for improved parsing and formatting; ensure consistent regex usage across handlers.
   Refactor chunking utility to use simplified emoji regex; enhance debug panel for better tab handling; add new constants for debug output and carousel configuration; improve Drive token management with error handling; update novel library for reading status management and completion marking; refine website handlers for improved parsing and formatting; ensure consistent regex usage across handlers.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .eslintrc.json
   - .prettierrc
   - docs/settings/SETTINGS_SYNC_FIXED.md
   - landing/drive-setup.html
   - landing/index.html
   - landing/novel-status.html
   - ... (32 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[fa67c40] 2026-02-15 feat: Enhance site settings and chunking UI
   feat: Enhance site settings and chunking UI
   - Added a new setting for preferred TLD in site settings UI with options for fanfiction.net and fanfiction.ws.
   - Updated the chunk summary UI to include an enhance button with improved styling and hover effects.
   - Introduced word count display and threshold warning in chunk UI to inform users of significant changes.
   - Enhanced storage manager to normalize URLs for both fanfiction.net and fanfiction.ws.
   - Updated base website handler to include default banner visibility setting.
   - Improved fanfiction handler to support TLD preference and ensure URL normalization based on user settings.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .eslintrc.json
   - .github/copilot-instructions.md
   - .prettierrc
   - build-output.txt
   - package-lock.json
   - package.json
   - ... (14 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[d457c15] 2026-02-13 Refactor popup HTML for improved readability and consistency; add enhance button to summary group in chunking UI
   Refactor popup HTML for improved readability and consistency; add enhance button to summary group in chunking UI
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - src/background/offscreen.html
   - src/content/content.js
   - src/library/library.html
   - src/popup/popup.html
   - src/utils/chunking/chunk-summary-ui.js
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[6c18ae0] 2026-02-12 feat: Revamp popup UI with improved tab navigation and notification handling
   feat: Revamp popup UI with improved tab navigation and notification handling
   - Reorganized popup HTML structure for better user experience.
   - Added a dedicated notifications tab with filtering options.
   - Enhanced visual elements with emojis for better clarity.
   - Updated JavaScript to support new notifications tab and improved tab switching logic.
   - Removed deprecated elements and functions related to modal notifications.
   - Improved chunk caching logic to include metadata updates.
   - Introduced URL normalization for FanFiction.net to redirect to preferred subdomains based on user settings.
   Files:
   - dev/emoji-report.txt
   - package.json
   - src/background/background.js
   - src/content/content.js
   - src/library/library.css
   - src/library/library.html
   - ... (11 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[d735d4f] 2026-02-11 feat(chunking): Implement UI components for chunk management and enhance theme detection
   feat(chunking): Implement UI components for chunk management and enhance theme detection
   - Added chunk-ui.js for creating and managing chunk banners, content containers, and progress indicators.
   - Introduced theme-aware color palettes based on dark/light mode detection.
   - Updated chunking index to include new UI module.
   - Enhanced constants for word-based chunking configuration and summary button frequency.
   - Modified base handler and specific website handlers to support dark mode detection.
   - Improved metadata extraction and content handling in fanfiction, ranobes, and scribblehub handlers.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/build.js
   - src/background/background.js
   - src/content/content.js
   - src/library/library.html
   - src/library/library.js
   - src/manifest-chromium.json
   - ... (16 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[202b9dd] 2026-02-11 feat: update build instructions and add release notes for version 3.9.0
   feat: update build instructions and add release notes for version 3.9.0
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - REVIEWER NOTES.md
   - docs/release/RELEASE_NOTES_3.9.0.md
   - releases/RanobeGemini_v3.9.0_chromium.zip
   - releases/RanobeGemini_v3.9.0_firefox.zip
   - releases/source/Ranobe-gemini_v3.9.0_source.zip
   - src/library/library.js
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 3.9.0
   - src/manifest-chromium.json: 3.9.0

[65ef166] 2026-02-10 feat: add randomized novel suggestions feature and improve site settings management
   feat: add randomized novel suggestions feature and improve site settings management
   - Implemented a new feature to load randomized novel suggestions from enabled sites, enhancing user experience by providing diverse reading options.
   - Updated site settings management to use a new key for per-site settings, improving clarity and maintainability.
   - Enhanced the novel reading progress update logic to automatically adjust reading status based on chapter progress.
   - Refactored the fanfiction handler to support mobile and desktop redirection based on user preferences.
   - Improved the Ranobes handler to map system statuses to reading statuses, providing better integration with user bookmarks.
   - Made various UI improvements for displaying novel information and suggestions in the popup.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/emoji-report.txt
   - dev/fix-emoji.js
   - docs/release/CHANGELOG.md
   - docs/ux/BUTTON_CONSISTENCY.md
   - package.json
   - releases/RanobeGemini_v3.9.0_chromium.zip
   - ... (19 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 3.9.0
   - src/manifest-chromium.json: 3.9.0

[7f9086a] 2026-02-10 feat: Add Table of Contents to various documentation files for improved navigation
   feat: Add Table of Contents to various documentation files for improved navigation
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - docs/settings/LIBRARY_SETTINGS_VISUAL_GUIDE.md
   - docs/ux/ADVANCED_TAB_REORGANIZATION.md
   - docs/ux/BUTTON_CONSISTENCY.md
   - docs/ux/DOMAIN_MANAGEMENT.md
   - docs/ux/FIREFOX_FIXES.md
   Package:
   - name: ranobe-gemini
   - version: 3.9.0
   Manifests:
   - src/manifest-firefox.json: 3.9.0
   - src/manifest-chromium.json: 3.9.0

[2763e35] 2026-02-10 feat: Add visual guide for Library Settings and reorganize Advanced Tab
   feat: Add visual guide for Library Settings and reorganize Advanced Tab
   - Introduced a comprehensive visual guide for Library Settings, detailing layout, interaction patterns, and accessibility considerations.
   - Reorganized the Advanced Tab in popup.html for improved UX, creating 7 distinct sections with clear hierarchy and visual enhancements.
   - Redesigned Library Settings modal in library.html with a modern card-based layout and color coding for better usability.
   - Established a Button Consistency Guide to ensure uniform behavior across interfaces.
   - Implemented a Domain Management system for automatic synchronization of website handlers in browser manifests.
   - Fixed critical errors and warnings for Firefox validation, ensuring compatibility and readiness for submission.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .vscode/extensions.json
   - docs/LIBRARY_SETTINGS_VISUAL_GUIDE.md
   - docs/README.md
   - docs/architecture/ARCHITECTURE.md
   - docs/architecture/DYNAMIC_DOMAINS.md
   - docs/architecture/KEEP_ALIVE.md
   - ... (42 more)
   Package:
   - name: ranobe-gemini
   - version: 3.9.0
   Manifests:
   - src/manifest-firefox.json: 3.9.0
   - src/manifest-chromium.json: 3.9.0

[9c541dd] 2026-02-10 feat: Enhance backup functionality and settings management
   feat: Enhance backup functionality and settings management
   - Added support for comprehensive backup including novel library and settings.
   - Updated backup retention and quota management for Google Drive.
   - Improved restore functionality to include non-sensitive settings.
   - Introduced domain preference handling for Fanfiction site redirection.
   - Enhanced mobile handler to fetch desktop metadata and validate content extraction.
   - Incremented version for expanded backup format to 2.0.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - docs/ADVANCED_TAB_REORGANIZATION.md
   - docs/BUTTON_CONSISTENCY.md
   - docs/FIREFOX_DRIVE_SYNC_FIX.md
   - docs/LIBRARY_SETTINGS_BENTO_LAYOUT.md
   - docs/LIBRARY_SETTINGS_CODE_COMPARISON.md
   - docs/LIBRARY_SETTINGS_IMPLEMENTATION.md
   - ... (19 more)
   Package:
   - name: ranobe-gemini
   - version: 3.9.0
   Manifests:
   - src/manifest-firefox.json: 3.9.0
   - src/manifest-chromium.json: 3.9.0

[596fcbe] 2026-02-10 feat(notification-manager): add grouping for related notifications by novel
   feat(notification-manager): add grouping for related notifications by novel
   - Enhanced getAll method to support grouping of notifications.
   - Implemented groupNotifications method to group related notifications.
   - Added isGroupableNotification, extractNovelId, and createNotificationGroup methods for notification handling.
   fix(fanfiction-handler): support fanfiction.ws domain and improve redirect handling
   - Added support for fanfiction.ws domain in SUPPORTED_DOMAINS.
   - Improved redirect logic to handle errors when redirecting from fanfiction.ws.
   refactor(fanfiction-mobile-handler): remove redundant initialization logic
   Files:
   - package.json
   - src/background/background.js
   - src/content/content.js
   - src/library/library.js
   - src/library/shared-shelf-helpers.js
   - src/library/websites/ao3/shelf-page.js
   - ... (11 more)
   Package:
   - name: ranobe-gemini
   - version: 3.9.0
   Manifests:
   - src/manifest-firefox.json: 3.9.0
   - src/manifest-chromium.json: 3.9.0

[d96699c] 2026-02-03 feat: update comprehensive backup version and enhance version compatibility checks
   feat: update comprehensive backup version and enhance version compatibility checks
   - Bump backup version from 2.0 to 3.0.
   - Introduce function to retrieve extension version from manifest.
   - Modify backup creation options to include credentials by default.
   - Implement comprehensive version checking during backup restoration, including warnings for version mismatches and legacy format detection.
   - Update constants for comprehensive backup keys to include new settings.
   - Refactor log upload function to use existing import instead of dynamic import.
   - Add new reading status "up-to-date" for ongoing novels.
   Files:
   - docs/CONTINUOUS_BACKUP_GUIDE.md
   - docs/OAUTH_CHECKBOX_FIX.md
   - docs/RELEASE_NOTES_3.7.0.md
   - docs/RELEASE_NOTES_3.8.0.md
   - docs/RELEASE_NOTES_3.8.0_MARKETPLACE.md
   - docs/v3.8.0_FINAL_CHECKLIST.md
   - ... (21 more)
   Package:
   - name: ranobe-gemini
   - version: 3.8.0
   Manifests:
   - src/manifest-firefox.json: 3.8.0
   - src/manifest-chromium.json: 3.8.0

[55bf54a] 2026-01-31 feat: enable debug mode by default and update Google Drive OAuth configuration
   feat: enable debug mode by default and update Google Drive OAuth configuration
   - Set DEFAULT_DEBUG_MODE to true for enhanced debugging during development.
   - Removed default Google Drive OAuth client ID and secret; users must configure their own.
   - Added expected redirect URIs for OAuth validation.
   - Introduced comprehensive backup functionality, allowing users to back up all extension data, including library data, settings, and optional Google Drive credentials.
   - Implemented telemetry system for anonymous usage tracking with opt-out capability.
   - Added functions for creating, restoring, and managing rolling backups.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - docs/CHANGELOG.md
   - docs/RELEASE_NOTES_3.7.0.md
   - src/background/background.js
   - src/library/library.html
   - src/library/library.js
   - src/manifest-chromium.json
   - ... (5 more)
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[80ad62f] 2026-01-30 v3.7.0 feat: add release notes for version 3.7.0 with Google Drive OAuth enhancements, notification system improvements, and UI fixes
   v3.7.0 feat: add release notes for version 3.7.0 with Google Drive OAuth enhancements, notification system improvements, and UI fixes
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - docs/CHANGELOG.md
   - docs/RELEASE_NOTES_3.7.0.md
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[981aed6] 2026-01-30 feat: update manifest files for Chromium and Firefox, add new release binaries
   feat: update manifest files for Chromium and Firefox, add new release binaries
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .prettierrc
   - releases/RanobeGemini_v3.7.0_chromium.zip
   - releases/RanobeGemini_v3.7.0_firefox.zip
   - releases/source/Ranobe-gemini_v3.7.0_source.zip
   - src/manifest-chromium.json
   - src/manifest-firefox.json
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[2797029] 2026-01-30 feat: add progress update prompt for reading chapters
   feat: add progress update prompt for reading chapters
   - Implemented a progress update prompt that notifies users when their saved progress is behind the current chapter they are reading.
   - Introduced a cooldown mechanism to prevent spamming the prompt.
   - Enhanced the UI with a banner that allows users to update their progress or ignore the prompt.
   - Updated the logic to check and show the prompt based on the current and stored chapter values.
   style: add new styles for buttons in fanfiction website
   - Added new button styles for secondary, icon, and danger buttons in the fanfiction stylesheet.
   - Improved hover effects for better user interaction.
   Files:
   - docs/BACKUP_GUIDE.md
   - docs/README_GOOGLE_DRIVE.md
   - docs/guides/GOOGLE_DRIVE_BACKUP_SETUP.md
   - docs/guides/OAUTH_SETUP_DETAILED.md
   - landing/drive-setup.html
   - landing/drive-setup.js
   - ... (13 more)
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[ca777b3] 2026-01-29 feat: enhance notification system and domain settings management
   feat: enhance notification system and domain settings management
   - Added logging for notifications in content script with detailed metadata.
   - Implemented caching for novel data to improve notification context.
   - Introduced domain settings management to enable/disable features per domain.
   - Updated site settings utility to handle domain-specific settings.
   - Enhanced popup notifications to display additional metadata.
   - Improved notification loading and badge updating mechanisms in the popup.
   - Added new statistics for single fandom and crossover stories in fanfiction index.
   Files:
   - src/background/background.js
   - src/content/content.js
   - src/library/websites/fanfiction/index.html
   - src/popup/popup.css
   - src/popup/popup.js
   - src/utils/site-settings.js
   - ... (1 more)
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[dd902a7] 2026-01-29 Enhance website handlers for improved navigation and metadata extraction
   Enhance website handlers for improved navigation and metadata extraction
   - Updated AO3 handler to change definition list label from "Gemini" to "Ranobe Gemini".
   - Added initialization logic in Fanfiction handler to redirect bare domain to mobile or desktop versions based on user agent.
   - Enhanced Fanfiction handler to exclude user profile pages and improve chapter page detection.
   - Improved metadata extraction in Fanfiction handler, including better handling of genres, characters, and relationships.
   - Added initialization logic in Fanfiction mobile handler for redirecting to the correct version based on user agent.
   - Updated Handler Manager to ensure handlers are initialized only once, preventing duplicate initializations.
   - Modified Ranobes handler to correctly identify chapter and novel pages, excluding chapter URLs from being treated as novel pages.
   Files:
   - .vscode/bookmarks.json
   - .vscode/settings.json
   - src/content/content.js
   - src/library/library.js
   - src/library/websites/ao3/index.html
   - src/library/websites/ao3/novel-card.js
   - ... (22 more)
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[e153a27] 2026-01-28 feat: add Notification Manager to handle notifications across the extension
   feat: add Notification Manager to handle notifications across the extension
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - .vscode/bookmarks.json
   - .vscode/settings.json
   - src/popup/popup-tabs.js
   - src/popup/popup.css
   - src/popup/popup.html
   - ... (3 more)
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[45c9e94] 2026-01-27 feat: Update author display in novel modals for Ranobes and ScribbleHub
   feat: Update author display in novel modals for Ranobes and ScribbleHub
   - Changed author display to use links in the modal for both Ranobes and ScribbleHub.
   - Enhanced the ScribbleHub novel card to include a detailed modal with improved metadata display.
   - Updated the manifest version to 3.7.0 and changed icon paths for consistency.
   - Added defaultDebugMode constant to constants.js for configuration.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - .vscode/bookmarks.json
   - package.json
   - src/library/library.html
   - src/library/library.js
   - src/library/websites/ao3/index.html
   - ... (15 more)
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[6d3c1ed] 2026-01-27 feat: Add Copilot instructions, enhance build system documentation, and improve notification styles
   feat: Add Copilot instructions, enhance build system documentation, and improve notification styles
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .github/copilot-instructions.md
   - .gitignore
   - .vscode/extensions.json
   - .vscode/settings.json
   - dev/build.js
   - dev/watch.js
   - ... (6 more)
   Package:
   - name: ranobe-gemini
   - version: 3.6.0
   Manifests:
   - src/manifest-firefox.json: 3.6.0
   - src/manifest-chromium.json: 3.6.0

[1e40557] 2025-12-23 feat: Implement platform-specific manifest files for Firefox and Chromium; enhance build process and documentation
   feat: Implement platform-specific manifest files for Firefox and Chromium; enhance build process and documentation
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/build-cross-platform.js
   - dev/build.js
   - dev/generate-manifest-domains.js
   - dev/package-all.js
   - dev/package-chromium.js
   - dev/package-firefox.js
   - ... (15 more)
   Package:
   - name: ranobe-gemini
   - version: 3.6.0
   Manifests:
   - src/manifest-firefox.json: 3.6.0
   - src/manifest-chromium.json: 3.6.0

[62b54af] 2025-12-23 v3.6.0 Implement Drive backup with 3-backup retention and continuous rolling file + reorganize docs
   v3.6.0 Implement Drive backup with 3-backup retention and continuous rolling file + reorganize docs
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - README.md
   - docs/BACKUP_GUIDE.md
   - docs/DETAILED_CODE_CHANGES.md
   - docs/IMPLEMENTATION_COMPLETE.md
   - docs/IMPLEMENTATION_NOTES.md
   - ... (42 more)
   Package:
   - name: ranobe-gemini
   - version: 3.6.0

[756bc7f] 2025-12-23 feat: Update theme variables and styles for dark and light modes
   feat: Update theme variables and styles for dark and light modes
   - Refactored CSS variables for dark mode in shelf-page.css, enhancing color contrast and readability.
   - Introduced light mode variables with improved color palette for shelf-page.css.
   - Updated JavaScript to apply theme settings from storage and listen for changes in shelf-page.js.
   - Adjusted popup styles to align with new theme variables in popup.css.
   - Changed icon references in index.html and popup.html to a unified icon.
   - Bumped version number in manifest.json to 3.5.0 and updated icon paths.
   - Added functionality to auto-adjust stale reading statuses in novel-library.js.
   Files:
   - .gemini/settings.json
   - README.md
   - docs/development/README.md
   - docs/presentation.md
   - landing/index.html
   - landing/terms.html
   - ... (48 more)
   Package:
   - name: ranobe-gemini
   - version: 3.5.0

[f70ca4b] 2025-12-18 feat: Enhance metadata extraction across various handlers
   feat: Enhance metadata extraction across various handlers
   - Added taxonomy definitions for AO3, Fanfiction, Ranobes, and WebNovel handlers to improve filtering capabilities.
   - Implemented robust metadata extraction methods in AO3, Fanfiction, Ranobes, ScribbleHub, and WebNovel handlers to capture author, title, genres, tags, status, and description.
   - Improved character and relationship extraction logic in Fanfiction handler to better identify and categorize characters.
   - Enhanced error handling during metadata extraction to ensure stability and reliability.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .vscode/bookmarks.json
   - README.md
   - docs/CHANGELOG.md
   - docs/architecture/ARCHITECTURE.md
   - docs/architecture/KEEP_ALIVE.md
   - docs/architecture/README.md
   - ... (71 more)
   Package:
   - name: ranobe-gemini
   - version: 3.5.0

[da6a3f8] 2025-12-06 fix: Update paths for icons in index.html and adjust YAML formatting in deploy workflow
   fix: Update paths for icons in index.html and adjust YAML formatting in deploy workflow
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .github/workflows/deploy-landing.yml
   - landing/index.html
   Package:
   - name: ranobe-gemini
   - version: 3.3.0

[58b29d9] 2025-12-06 Add privacy policy, terms of use, sitemap, and robots.txt; implement browser and site cards in script
   Add privacy policy, terms of use, sitemap, and robots.txt; implement browser and site cards in script
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .github/workflows/deploy-landing.yml
   - README.md
   - landing/assets/og-card.svg
   - landing/index.html
   - landing/privacy.html
   - landing/robots.txt
   - ... (4 more)
   Package:
   - name: ranobe-gemini
   - version: 3.3.0

[f8cfd8a] 2025-12-06 feat: Release version 3.3.0 with Google Drive integration and enhanced logging
   feat: Release version 3.3.0 with Google Drive integration and enhanced logging
   - Added Google Drive OAuth support for log backup and management.
   - Implemented persistent logging with IndexedDB for better log handling.
   - Introduced keep-alive mechanisms for improved background script reliability.
   - Updated keyboard shortcuts for library and enhancement actions.
   - Enhanced error handling and user feedback in the popup interface.
   - Added new settings for Google Drive client ID and folder ID.
   - Refactored background and content scripts for better modularity and maintainability.
   Files:
   - .gitignore
   - dev/build-cross-platform.js
   - package.json
   - ranobe-gemini-library-2025-12-05.json
   - releases/RanobeGemini_v3.3.0_chromium.zip
   - releases/RanobeGemini_v3.3.0_firefox.zip
   - ... (11 more)
   Package:
   - name: ranobe-gemini
   - version: 3.3.0

[e41f19e] 2025-12-05 Refactor website handler logging and improve handler loading mechanism
   Refactor website handler logging and improve handler loading mechanism
   - Introduced a centralized logging system using debugLog and debugError across all website handlers for consistency and better debugging.
   - Updated FanfictionMobileHandler to ensure it runs before desktop handlers by setting a PRIORITY.
   - Replaced static handler registration with dynamic loading of handlers from a generated handler registry, allowing for easier addition of new handlers.
   - Enhanced error handling during handler loading and improved deduplication of handlers based on constructor names.
   - Updated metadata handling in RanobesHandler, ScribbleHubHandler, and WebNovelHandler to include flags for incomplete metadata and detail page requirements.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/build.js
   - package.json
   - ranobe-gemini-library-2025-12-05.json
   - releases/RanobeGemini_v3.1.0_chromium.zip
   - releases/RanobeGemini_v3.1.0_firefox.zip
   - releases/RanobeGemini_v3.2.0_chromium.zip
   - ... (36 more)
   Package:
   - name: ranobe-gemini
   - version: 3.2.0

[0e0a694] 2025-12-05 Add dedicated handlers for ScribbleHub and WebNovel
   Add dedicated handlers for ScribbleHub and WebNovel
   - Implement ScribbleHubHandler for extracting content and metadata from ScribbleHub novel and chapter pages.
   - Support for novel metadata extraction, chapter navigation, and UI control insertion points.
   - Enhance WebNovelHandler to improve chapter and novel page detection, metadata extraction, and UI control configuration.
   - Update handler types to indicate dedicated page requirements for metadata retrieval.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - .prettierrc
   - .vscode/bookmarks.json
   - .vscode/settings.json
   - dev/build-cross-platform.js
   - dev/build.js
   - ... (45 more)
   Package:
   - name: ranobe-gemini
   - version: 3.1.0

[a849844] 2025-11-30 feat: Update styling and functionality for library components and improve metadata extraction for Ranobes handler
   feat: Update styling and functionality for library components and improve metadata extraction for Ranobes handler
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - src/library/library.css
   - src/library/library.html
   - src/library/library.js
   - src/popup/popup.html
   - src/utils/website-handlers/fanfiction-handler.js
   - ... (1 more)
   Package:
   - name: ranobe-gemini
   - version: 3.0.0

[39c431d] 2025-11-28 feat: Implement recent novels carousel in library view
   feat: Implement recent novels carousel in library view
   - Added a carousel section to display recently read novels with controls for navigation.
   - Introduced functionality for auto-scrolling and manual navigation of the carousel.
   - Enhanced novel metadata extraction for better library management.
   - Updated styles for carousel and shelf sections for improved UI/UX.
   - Refactored existing code to accommodate new features and improve maintainability.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .vscode/settings.json
   - docs/guides/ADDING_NEW_WEBSITES.md
   - src/content/content.js
   - src/library/library.css
   - src/library/library.html
   - src/library/library.js
   - ... (5 more)
   Package:
   - name: ranobe-gemini
   - version: 3.0.0

[e943213] 2025-11-28 Add comprehensive documentation for features and guide for adding new websites
   Add comprehensive documentation for features and guide for adding new websites
   - Created `README.md` in `docs/features/` detailing major features of the RanobeGemini extension, including Novel Library System, Backup API Keys, Chunking System, Emoji Support, Summary Modes, Progressive Enhancement, and Custom Prompts.
   - Added `ADDING_NEW_WEBSITES.md` in `docs/guides/` to provide a step-by-step process for adding support for new novel websites, including handler system architecture, DOM structure analysis, handler implementation, and testing.
   - Established `README.md` in `docs/guides/` to organize user guides, planned guides, and contribution guidelines for the RanobeGemini extension.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - .vscode/settings.json
   - docs/ARCHITECTURE.md
   - docs/CHANGELOG.md
   - docs/README.md
   - docs/TODO.md
   - ... (11 more)
   Package:
   - name: ranobe-gemini
   - version: 3.0.0

[f12b0c1] 2025-11-28 feat: Enhance popup functionality with new prompts and backup API key management
   feat: Enhance popup functionality with new prompts and backup API key management
   - Added new constants for default prompts including short summary prompt and author notes handling.
   - Implemented UI elements for managing backup API keys, including adding and removing keys.
   - Updated novel library to support custom prompts for individual novels.
   - Enhanced fanfiction handler to extract story descriptions and author names more effectively.
   - Improved the full prompt preview functionality to include site-specific prompts and better formatting.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/generate-manifest-domains.js
   - releases/RanobeGemini_v3.0.0.zip
   - src/background/background.js
   - src/content/content.css
   - src/content/content.js
   - src/library/library.css
   - ... (9 more)
   Package:
   - name: ranobe-gemini
   - version: 3.0.0

[367c433] 2025-11-25 feat: Revamp Novel Library and UI Enhancements
   feat: Revamp Novel Library and UI Enhancements
   - Updated popup.html to improve the layout and add a compact view for recent novels.
   - Introduced a new NovelLibrary class in novel-library.js to manage novels and shelves.
   - Added support for novel statistics and recent novels display in the popup.
   - Implemented shelf metadata for various website handlers to organize novels by site.
   - Enhanced event handling in popup.js for library interactions and novel loading.
   - Updated version number to 3.0.0 in popup.html.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - REVIEWER NOTES.md
   - dev/build.js
   - docs/CHANGELOG.md
   - package.json
   - releases/RanobeGemini_v3.0.0.zip
   - releases/source/Ranobe-gemini_v3.0.0_source.zip
   - ... (16 more)
   Package:
   - name: ranobe-gemini
   - version: 3.0.0

[9c48f0f] 2025-11-25 feat: Bump version to 2.9.0 and enhance functionality
   feat: Bump version to 2.9.0 and enhance functionality
   - Updated package and manifest versions to 2.9.0.
   - Added a new mobile handler for FanFiction.net to support mobile-specific content.
   - Enhanced the existing FanFiction handler to exclude mobile URLs.
   - Improved paragraph extraction and HTML sanitization in content.js.
   - Increased max output tokens for summaries to allow more comprehensive results.
   - Added a version switcher button for FanFiction.net to toggle between mobile and desktop versions.
   - Refactored storage manager to normalize cache keys for mobile and desktop versions.
   Files:
   - .gitignore
   - docs/CHANGELOG.md
   - package.json
   - releases/RanobeGemini_v2.9.0.zip
   - releases/source/Ranobe-gemini_v2.9.0_source.zip
   - src/background/background.js
   - ... (7 more)
   Package:
   - name: ranobe-gemini
   - version: 2.9.0

[d246b54] 2025-11-25 feat: Bump version to 2.8.0 and enhance domain handling
   feat: Bump version to 2.8.0 and enhance domain handling
   - Updated package.json to version 2.8.0 with new scripts and additional files.
   - Added new release zip files for version 2.8.0.
   - Updated manifest.json for versioning and added strict minimum version for Gecko.
   - Refactored domain handling in domain-constants.js to dynamically collect supported domains from website handlers.
   - Introduced new website handlers for AO3, Fanfiction, and WebNovel with specific domain management and prompts.
   - Enhanced RanobesHandler to include wildcard support for subdomains.
   - Implemented WebNovelHandler to manage infinite scroll chapters and dynamic content extraction.
   Files:
   - .github/CONTRIBUTING.md
   - .github/ISSUE_TEMPLATE/bug_report.md
   - .github/ISSUE_TEMPLATE/feature_request.md
   - .github/ISSUE_TEMPLATE/website_support.md
   - .github/PULL_REQUEST_TEMPLATE.md
   - .gitignore
   - ... (23 more)
   Package:
   - name: ranobe-gemini
   - version: 2.8.0

[c55a678] 2025-11-24 feat: Update to version 2.7.1 with enhancements, new features, and improved styling
   feat: Update to version 2.7.1 with enhancements, new features, and improved styling
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - dev/watch.js
   - package.json
   - releases/RanobeGemini_v2.7.0.zip
   - releases/RanobeGemini_v2.7.1.zip
   - src/content/content.css
   - ... (6 more)
   Package:
   - name: ranobe-gemini
   - version: 2.7.1

[d0d69d0] 2025-11-24 feat: Update to version 2.7.0 with new features and improvements
   feat: Update to version 2.7.0 with new features and improvements
   - Added support for caching enhanced content using a new StorageManager class.
   - Implemented caching logic in content.js to check for and load cached enhanced content.
   - Introduced a delete button in the enhanced banner to allow users to remove cached content.
   - Added a new handler for Archive of Our Own (AO3) to extract content from ao3.org.
   - Updated Ranobes handler to support ranobes.top.
   - Enhanced UI in popup with improved styles and resizing capabilities.
   - Updated package.json and manifest.json to reflect version change to 2.7.0.
   Files:
   - .vscode/extensions.json
   - package.json
   - releases/RanobeGemini_v2.7.0.zip
   - src/content/content.js
   - src/manifest.json
   - src/popup/popup.css
   - ... (6 more)
   Package:
   - name: ranobe-gemini
   - version: 2.7.0

[34ae30a] 2025-11-24 feat: Update model versions and enhance novel loading experience
   feat: Update model versions and enhance novel loading experience
   - Updated model ID from "gemini-1.5-pro" to "gemini-2.5-flash" in constants.
   - Modified popup.js to reflect new model names and options, including error handling for model selection.
   - Enhanced novel loading functionality to group novels by domain, providing a clearer organization in the UI.
   - Implemented auto-enhance feature for novels, allowing users to toggle enhancement settings.
   - Improved content handling in FanfictionHandler to support text-only enhancements while preserving original formatting.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .github/CONTRIBUTING.md
   - .gitignore
   - .vscode/tasks.json
   - dev/build.js
   - dev/package-firefox.js
   - dev/watch.js
   - ... (25 more)
   Package:
   - name: ranobe-gemini
   - version: 2.6.0

[ef9ec72] 2025-05-25 feat: Add new version 2.5.0 release and enhance content processing
   feat: Add new version 2.5.0 release and enhance content processing
   - Added RanobeGemini_v2.5.0.zip to releases.
   - Improved content chunking logic in background.js for better performance and handling of large chapters.
   - Enhanced error handling and retry mechanisms during content processing.
   - Updated CSS styles for better mobile responsiveness in content.css.
   - Refactored content.js to support work-in-progress and error banners during content enhancement.
   - Modified manifest.json to streamline background script loading.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - releases/RanobeGemini_v2.5.0.zip
   - src/background/background.js
   - src/content/content.css
   - src/content/content.js
   - src/manifest.json

[17646a5] 2025-05-25 feat: Enhance content processing and styling
   feat: Enhance content processing and styling
   - Added a function to split large content into manageable chunks based on paragraph and sentence boundaries for improved processing.
   - Updated the game stats box styling in CSS for better visual presentation.
   - Enhanced the content script to sanitize HTML and preserve game stats boxes during content enhancement.
   - Modified the popup prompt to include clearer instructions for formatting section headings and game-like status windows.
   - Updated constants for the default prompt to reflect new formatting guidelines for RPG-style information.
   - Improved the handling of preserved HTML elements to ensure proper restoration after content enhancement.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - .vscode/settings.json
   - src/background/background.js
   - src/content/content.css
   - src/content/content.js
   - src/popup/popup.js
   - ... (1 more)

[1f6feef] 2025-05-23 v2.4.0 Working State - feat: Update DEFAULT_PROMPT to include detailed formatting instructions for game-like status windows
   v2.4.0 Working State - feat: Update DEFAULT_PROMPT to include detailed formatting instructions for game-like status windows
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - index.md
   - presentation.pdf
   - releases/RanobeGemini_v2.4.0.zip
   - src/background/background.js
   - src/content/content.css
   - ... (9 more)

[78e4800] 2025-05-17 chore: changed `simple-popup` to use `popup`
   chore: changed `simple-popup` to use `popup`
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - ARCHITECTURE.md
   - build/build.js
   - dist/background/background.js
   - dist/config/config.js
   - dist/content/content.css
   - dist/content/content.js
   - ... (39 more)

[941cf0c] 2025-05-17 feat: Enhance simple-popup.js with advanced settings and chunking options
   feat: Enhance simple-popup.js with advanced settings and chunking options
   - Added advanced settings for temperature, top-p, top-k, and custom endpoint.
   - Implemented chunk size settings with validation and default values.
   - Improved UI for advanced settings with toggle functionality.
   - Updated prompts to include new formatting instructions.
   - Introduced novel loading functionality with improved display and sorting.
   - Added utility functions for date formatting and domain checking.
   fix: Update constants.js with new default chunk size and rate limit
   Files:
   - .editorconfig
   - .vscode/settings.json
   - CHANGELOG.md
   - README.md
   - build/build.js
   - dist/background/background.js
   - ... (46 more)

[6975d60] 2025-04-21 chore: Update architecture documentation, changelog, and license; fix icon references in manifest
   chore: Update architecture documentation, changelog, and license; fix icon references in manifest
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - ARCHITECTURE.md
   - CHANGELOG.md
   - LICENSE.md
   - src/README.md
   - src/icons/logo-light-1024.png
   - src/manifest.json

[132bb95] 2025-04-19 v2.2.0 changed `FireFox` dir to `src` to indicate near future chomium support, added Fanfiction.net Mobile version, Corrected the summary colour scheme.
   v2.2.0 changed `FireFox` dir to `src` to indicate near future chomium support, added Fanfiction.net Mobile version, Corrected the summary colour scheme.
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - .github/workflows/release.yml
   - .gitignore
   - .vscode/mcp.json
   - .vscode/settings.json
   - .vscode/tasks.json
   - ADDING_NEW_WEBSITES.md
   - ... (54 more)

[53c7573] 2025-04-15 chore: Update changelog for version 2.1.0 and modify manifest and constants for improved functionality
   chore: Update changelog for version 2.1.0 and modify manifest and constants for improved functionality
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - CHANGELOG.md
   - FireFox/RanobeGemini_v2.0.0.zip
   - FireFox/RanobeGemini_v2.1.0.zip
   - FireFox/manifest.json
   - FireFox/utils/constants.js

[66a3d65] 2025-04-15 chore: Remove deprecated files and update manifest with additional icon sizes
   chore: Remove deprecated files and update manifest with additional icon sizes
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - Chromium/.editorconfig
   - Chromium/.env
   - Chromium/README.md
   - FireFox/manifest.json
   - FireFox/utils/constants.js

[a805948] 2025-04-14 feat: Add content utility functions for HTML processing and text formatting
   feat: Add content utility functions for HTML processing and text formatting
   feat: Implement base website content handler for generic content extraction
   feat: Create fanfiction handler for extracting content from fanfiction.net
   feat: Develop handler manager to dynamically load website-specific handlers
   feat: Add ranobes handler for extracting content from ranobes.top
   chore: Package extension files into v2.1.0.zip for release
   docs: Add Apache License 2.0 to the project
   docs: Update README with new features, installation instructions, and usage guidelines
   Files:
   - ADDING_NEW_WEBSITES.md
   - CONTRIBUTING.md
   - FireFox/README.md
   - FireFox/background/background.js
   - FireFox/content/content.css
   - FireFox/content/content.js
   - ... (12 more)

[9798e98] 2025-04-10 Remove sensitive API key from environment configuration files
   Remove sensitive API key from environment configuration files
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - .env
   - FireFox/.env

[2a9b04e] 2025-04-10 Refactor Ranobe Gemini extension: - Removed constants.js file and integrated prompts directly into simple-popup.js and utils/constants.js. - Added chapter summarization feature and permanent prompts for consistent formatting. - Enhanced FAQ section in simple-popup.html with interactive elements. - Updated welcome page to streamline API key setup process. - Improved README with new features and usage instructions. - Deleted unused welcome.html and welcome.js files.
   Refactor Ranobe Gemini extension:
   - Removed constants.js file and integrated prompts directly into simple-popup.js and utils/constants.js.
   - Added chapter summarization feature and permanent prompts for consistent formatting.
   - Enhanced FAQ section in simple-popup.html with interactive elements.
   - Updated welcome page to streamline API key setup process.
   - Improved README with new features and usage instructions.
   - Deleted unused welcome.html and welcome.js files.
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - .github/workflows/release.yml
   - CHANGELOG.md
   - FireFox/.env
   - FireFox/README.md
   - FireFox/RanobeGemini.zip
   - FireFox/RanobeGemini_v1.1.0.zip
   - ... (16 more)

[25b6b9a] 2025-04-06 v1.1.0 Extension completed till certain level need to migrate to manifest v3
   v1.1.0 Extension completed till certain level need to migrate to manifest v3
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - .env
   - FireFox/.env
   - FireFox/README.md
   - FireFox/RanobeGemini.zip
   - FireFox/TODO.md
   - FireFox/background/background.js
   - ... (13 more)

[5a50e90] 2025-04-04 v1.0.0 - Rename extension from Ranobe Novel Enhancer to Ranobe Gemini and update related assets and is a MVP
   v1.0.0 - Rename extension from Ranobe Novel Enhancer to Ranobe Gemini and update related assets and is a MVP
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - CHANGELOG.md
   - FireFox/README.md
   - FireFox/background/background.js
   - FireFox/config/config.js
   - FireFox/content/content.css
   - FireFox/content/content.js
   - ... (27 more)

[7aa279c] 2025-04-03 v1.0.0 for Firefox version MVP it works!
   v1.0.0 for Firefox version MVP it works!
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - .gitignore
   - CHANGELOG.md
   - Chromium/.editorconfig
   - Chromium/.env
   - Chromium/README.md
   - FireFox/.editorconfig
   - ... (25 more)

