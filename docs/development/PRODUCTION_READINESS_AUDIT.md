# Production Readiness Audit

**Date:** 2026-08-11
**Scope:** `src/` (133 JS files, ~90,400 LOC), `dev/`, `docs/` (94 md), `landing/`, `.github/`
**Baseline:** commit `739ddb1`, working tree with 13 modified + 3 untracked files
**Status:** Findings only — no code changes made.

---

## How to read this

Every finding below was verified by reading the code or running a tool against
the repo. Where a claim depends on browser runtime behaviour I could not execute
here, it is explicitly marked **[needs runtime verification]** rather than
asserted.

Severity:

- **P0** — breaks a shipped feature, or is a security hole reachable by a third party
- **P1** — wrong on one browser, store-review blocker, or data-loss risk
- **P2** — correctness/robustness defect with limited blast radius
- **P3** — maintainability, consistency, UX friction

---

## 1. Security

### SEC-1 (P0) — `externally_connectable.ids: ["*"]` lets any extension message the background

`src/manifest-firefox.json` and `src/manifest-chromium.json`:

```json
"externally_connectable": {
  "ids": ["*"],
  "matches": ["*://ranobe.vkrishna04.me/*"]
}
```

`ids: ["*"]` is a wildcard over **every installed extension**. Combined with
SEC-2 below, this is a reachable path into the OAuth relay.

**Decision taken:** drop `ids`, keep the `matches` entry.

### SEC-2 (P0) — sender guard has an inverted-logic bypass

`src/background/background.js:85-90`:

```js
const senderUrl = sender?.url || sender?.origin || "";
const isLandingPage =
    !senderUrl ||
    senderUrl.startsWith("https://ranobe.vkrishna04.me/") ||
    senderUrl.startsWith("http://ranobe.vkrishna04.me/");

if (!isLandingPage) return;
```

The `!senderUrl` clause means **an empty sender URL passes the check**. Messages
originating from another extension do not carry a page `url`, so they satisfy
`!senderUrl` and fall through to the OAuth-code relay at line 94 and the
`EXTERNAL_PING` info disclosure at line 105.

The guard should be `sender.origin === "https://ranobe.vkrishna04.me"` with no
empty-string escape hatch, and should additionally reject any sender that has an
`id` (i.e. is an extension).

### SEC-3 (P1) — OAuth `state` is generated but never validated

`src/utils/oauth-pkce.js:56` generates `state` and puts it in the auth URL.
`src/utils/oauth-pkce.js:74-82` then reads back only `code`:

```js
const redirectedUrl = new URL(redirected);
const code = redirectedUrl.searchParams.get("code");
```

`state` from the redirect is never compared to the generated value. This is the
CSRF defence PKCE does not provide on its own. `launchOAuthTabFlow` (line 209)
*does* key on `state` via `pendingAuthFlows`, so the fix is only needed in
`launchOAuthPkceFlow`.

### SEC-4 (P1) — unescaped URL interpolated into an `innerHTML` attribute

Three shelf pages interpolate a scraped author URL into an `href` without
escaping, while escaping the adjacent link text:

- `src/library/websites/ranobes/shelf-page.js:566`
- `src/library/websites/scribblehub/shelf-page.js:611`
- `src/library/websites/fanfiction/shelf-page.js:688`

```js
authorEl.innerHTML = `<a href="${authorUrl}" target="_blank" rel="noreferrer">${escapeHtml(...)}</a>`;
```

The equivalent code in `novelbin/shelf-page.js:455` and
`ao3/novel-card.js:70` **does** escape it (`escapeHtml(authorUrl)`), which
confirms these three are an oversight rather than a deliberate choice. A stored
author value containing `"` breaks out of the attribute; a `javascript:` value
executes on click.

### SEC-5 (P2) — unescaped error text into `innerHTML`

`src/library/library-settings.js:4777`:

```js
listEl.innerHTML = `<div style="...">Error: ${err.message}</div>`;
```

`err.message` here can carry a remote response body (WebDAV/Drive/OneDrive error
text is concatenated into thrown messages — see
`src/utils/oauth-pkce.js:116`, `src/background/loreweave/loreweave-client.js:29`).

### SEC-6 (P2) — colour values interpolated into inline `style` via `innerHTML`

`legendItem.innerHTML = \`<span class="legend-swatch" style="background:${...}">\``
in all five shelf pages (`ranobes:1236`, `scribblehub:1359`, `fanfiction:1717`,
`ao3:1763`, `novelbin:854`). Values are theme/config-derived rather than
site-derived, so exploitability is low, but it is the same unsafe pattern.

### SEC-7 (P3) — `target="_blank"` without `rel="noopener"`

`src/library/library.js:4668`, `src/popup/popup.js:2476`, `src/popup/popup.js:6913`.
Most other call sites correctly use `rel="noreferrer"`.

### SEC-8 (P3) — no explicit `content_security_policy` in either manifest

MV3 defaults are already strict, so this is not a live hole, but declaring
`extension_pages` explicitly is worth doing before store review.

**Not found (checked, clean):** no hardcoded API keys or OAuth secrets in `src/`,
`dev/`, or `landing/`; no `eval`, `new Function`, or string-argument `setTimeout`;
no API keys or tokens written to `console`; no `.env` tracked by git.

---

## 2. Cross-browser correctness

### XB-1 (P0) — service-worker-incompatible DOM APIs in the background

Chromium MV3 backgrounds are **service workers**, which have neither `DOMParser`
nor `URL.createObjectURL`. Firefox MV3 backgrounds are event pages and do have
both — which is why these have gone unnoticed.

| Location | API | Feature broken on Chromium |
|---|---|---|
| `src/background/background.js:393` | `URL.createObjectURL` | rolling backup → `downloads` |
| `src/background/background.js:1703` | `DOMParser` | HTML parsing path |
| `src/background/loreweave/queue-manager.js:313` | `DOMParser` | chapter queue fetch/parse |
| `src/background/storage/adapters/webdav-storage.js:66` | `DOMParser` | **all** WebDAV sync (PROPFIND XML) |

Fixes: data-URL or `fetch`-to-blob instead of `createObjectURL`; a small regex/
manual XML reader or an offscreen document for the parsing paths.

### XB-2 (P1) — Firefox `web_accessible_resources` omits directories the code loads

Chromium lists `content/modules/*.js` and `utils/chunking/**/*.js`. Firefox
lists neither, yet `src/content/content.js` loads ~29 modules from
`content/modules/` via `browser.runtime.getURL()` + dynamic `import()`
(lines 82, 102, 260-527, 2300-2770), and `utils/chunking/index.js` at line 2643.

Firefox's glob `content/content.*` matches `content/content.js` and
`content/content.css` only — it does not descend into `content/modules/`.

**[needs runtime verification]** on Firefox: whether a content script's own
dynamic `import()` of a `moz-extension://` URL requires a WAR entry. Regardless
of the answer, the two manifests disagree, so at least one is wrong.

### XB-3 (P1) — `externally_connectable` is not implemented by Firefox

The mobile OAuth tab fallback (`launchOAuthTabFlow`, `src/utils/oauth-pkce.js:160`)
depends on `runtime.onMessageExternal` receiving a message from the landing page.
Firefox does not support `externally_connectable` for web pages, so this fallback
is inert on the exact platform it was written for (`gecko_android`,
`strict_min_version: 120.0`).

### XB-4 (P1) — inline `onerror=` handlers inside `innerHTML` never fire

`src/popup/popup.js:3158, 3200, 3207, 3221`:

```js
`<img src="..." onerror="this.outerHTML='<div class=...>'">`
```

MV3 extension-page CSP forbids inline event handlers, so these image fallbacks
are dead — broken site icons and cover images render as broken `<img>` instead of
the intended emoji placeholder. Note `src/library/library.js:2165-2176` already
does this correctly by attaching handlers in JS; the popup was never updated.

---

## 3. Manifest / permissions hygiene

| ID | Sev | Finding |
|---|---|---|
| MF-1 | P1 | ~~**`host_permissions` do not cover the endpoints actually called.**~~ **RESOLVED** — `https://generativelanguage.googleapis.com/*` is now declared. It was the one genuinely load-bearing omission: every Gemini request goes there, and it only worked undeclared because Google serves that endpoint with permissive CORS headers, which is a third party's policy decision that can change without a line of our code changing. `oauth2.googleapis.com` and `www.googleapis.com` were already correct. The rest of the finding's list is **deliberately still absent, and that is the right answer**: `api.openai.com`, an OpenAI-compatible base URL, a local Ollama server, a WebDAV server, `api`/`content.dropboxapi.com`, `graph.microsoft.com`, `login.microsoftonline.com`, and `counter.vkrishna04.me` are all opt-in, several are URLs the user types and so cannot be enumerated in a manifest at all, and every one is reached over CORS. Listing them in `optional_host_permissions` with no `permissions.request()` behind each connect button would just recreate MF-3. If that changes, the request call and the manifest entry land in the same commit. Reasoning is recorded at the `HOST_PERMISSIONS` constant in `dev/generate-manifest-domains.js`, which owns both manifests' permission blocks. |
| MF-2 | P1 | **The original finding was wrong, and is now doubly wrong.** `downloads` *is* used: `createBackupFile` (`background.js:387`) calls `downloadText` (`src/utils/download-data.js:21`), which calls `downloads.download`. The in-page export buttons do use `<a download>` anchors as the finding says, but the rolling background backup has no DOM to hang an anchor off, so the API call is the only mechanism available to it. The finding also called that path "already broken by XB-1" — XB-1 has since been fixed, and `download-data.js` exists precisely to carry the fix (a `data:` URL where `URL.createObjectURL` is missing). The permission stays. |
| MF-3 | P2 | ~~`activeTab` declared, never used.~~ **RESOLVED** — removed from both manifests. Confirmed unused: `activeTab` only grants anything in combination with `scripting.executeScript` or a post-gesture `tabs` field read, and the codebase contains no `scripting.*` call at all. The content script is declared in `content_scripts` and takes its host access from `optional_host_permissions`. |
| MF-4 | P2 | **The original finding was wrong.** `*://*.novelarrow.com/*` is present in `optional_host_permissions` in both manifests, and always was — that array is generated from the handlers' `SUPPORTED_DOMAINS` by the same code that generates `content_scripts.matches`, so the two cannot diverge by construction. Corrected in place rather than deleted, per this document's convention. |
| MF-5 | P2 | ~~Chromium declares `side_panel` but not the `sidePanel` permission.~~ **RESOLVED** — `sidePanel` added to the Chromium permission list. Chrome does not register a side panel from `default_path` alone; the permission is what makes the manifest key take effect, so the two ship together. The absence of any `chrome.sidePanel.*` call is not a second defect: the manifest key *is* the use, and `library.js:715` already reads `?sidebar=true` and adapts the layout. Firefox's equivalent is `sidebar_action`, which needs no permission and was already correct. |
| MF-6 | P3 | **Verified, no change.** The four declarations map to real behaviour: `websiteContent` is required because chapter text is sent to the configured AI provider — that is the product. `browsingActivity` is required because the library records which novels and chapters you open, and syncs that record if you enable a destination. `authenticationInfo` is optional because OAuth tokens are only stored once you connect a cloud destination. `technicalAndInteraction` is optional because telemetry (`src/utils/telemetry.js`) defaults to `enabled: false` and is gated behind an explicit consent prompt. Nothing is over-declared; nothing needs to move between `required` and `optional`. |

---

## 4. Dead and orphaned code

Reachability was computed from real entry points (HTML `<script src>` +
manifest-declared scripts), following static imports, dynamic `import()`, and
`getURL("…js")` string paths.

### DEAD-1 (P1) — LoreWeave's content-side integration is not wired up — **RESOLVED**

The finding was correct: the background half was registered
(`message-handlers/index.js`) but `content.js` contained zero references to
`loreweave`, so the endpoint and account key had no path to a request.

`content.js:2717` now imports `content/modules/loreweave-integration.js`, gated
behind the experimental flag — LoreWeave is opt-in and off by default until the
sister project is stable, so the feature being quiet is now a decision rather
than a break. `src/config/config.js` is reached through the same path.

The other two files named in this finding turned out to be a separate orphan
that had nothing to do with LoreWeave, and are deleted:

- `src/content/modules/index.js` (140 lines) — a module registry holding
  exactly one entry, imported by nothing. Content modules are loaded on demand
  via `browser.runtime.getURL()`; the registry was never part of that.
- `src/content/modules/library-integration.js` (400 lines) — a second, older
  "Add to Library" implementation reachable only through that registry.
  `ui-controls.js` superseded it and is what actually runs. It also carried
  four raw `console.log("[RG-Library-Debug] …")` calls that would have shipped.

Four architecture docs presented the registry as the live module system
(`WHATS_WHERE.md`, `MODULAR_ARCHITECTURE.md`, `MODULAR_SYSTEMS_README.md`,
`QUICK_START.md`, including a "register your module here" instruction that
would send a contributor to a deleted file). All four now describe the
dynamic-import pattern the code actually uses.

### DEAD-2 (P2) — genuinely unreachable files — **RESOLVED**

Every entry was re-checked against the tree by following real imports rather
than basenames. The list as originally written was partly wrong; both the
removals and the corrections are recorded here.

**Removed:**

| File | Lines | Note |
|---|---|---|
| `src/library/websites/shelf-page.js` | 1178 | superseded by `shelf-core.js` + per-site descriptors (ARCH-1) |
| `src/utils/content.js` | 85 | none of its four exports had an importer; `stripHtmlTags` lives in `content/content.js` and is injected into the runtime modules |
| `src/popup/popup-tabs.js` | 133 | `popup.html` loads only `popup.js` |
| `src/utils/debug-panel.js` | 386 | the debug-panel subsystem below |
| `src/content/debug-integration.js` → `src/content/debug-utils.js` | 32 + 112 | orphan pair. `debug-integration.js` gated on `config.debugPanelEnabled`, a setting that exists nowhere in the tree, so the panel could never be shown. `debug-utils.js` also imported `../utils/ui-utils.js`, which does not exist |
| `src/library/websites/novel-card.css` | 210 | no `<link>` and no importer |

**Corrected — these are live, the original finding was wrong:**

| File | Reached from |
|---|---|
| `src/library/sw.js` | `library.js:1156` — `navigator.serviceWorker.register("sw.js")` |
| `src/library/telemetry-consent.js` | imported by `library.js:110`; the modal is in `library.html:486`. UX-4 below is stale as a result |
| `src/library/modules/status-filters.js` | imported by `library.js:64` |
| `src/utils/handler-settings.js` | imported by `settings-handler.js:41` |
| `src/library/library-settings.js` `downloadBackupAsFile` | 10 call sites across `library-settings.js`, `library.js`, `popup.js` |

**Not dead — wired up instead:** `src/utils/bg-animation.js` (469 lines) was
unreachable, but so was the whole feature around it. Theme presets write
`bgAnimation` (Ocean → `waves`, and two more), `bg-animations.css` implements
the CSS-only animations, and this module implements five canvas ones — but
nothing ever set `body[data-bg-animation]`, which both halves key off. The
attribute is now set by `setThemeVariables()` (`theme-config.js`), the module is
side-effect imported by `library.js` and `shelf-core.js`, and its self-init is
guarded for non-DOM contexts. Pinned by `tests/theme-config.test.mjs`.

**False alarm, checked and cleared:** `novelarrow-handler.js` *is* live — it is
listed in the auto-generated `handler-registry.js` and loaded at runtime by
`handler-manager.js:42`. `edit-modal.js`'s `../../utils/novel-library.js` looks
wrong on disk but resolves correctly because URL resolution clamps at the
extension root; it works, though the path is fragile and should be `../utils/`.

### DEAD-3 (P1) — deleted files kept shipping — **RESOLVED**

`dev/build.js` only cleaned `dist/` when passed `--clean`, which no npm script
does. `build()` copied over whatever the previous build left behind, so a file
deleted from `src/` stayed in `dist/` and in every packaged zip indefinitely —
which would have made every removal above cosmetic. `build()` now empties the
platform's output directory before copying.

The store-listing mockups under `src/icons/` (`promotional-tile-*.html`,
`screenshots-gallery.html`) were also being packaged into the extension users
download; they are now in `BUILD_SKIP_FILES`.

---

## 5. Architecture and duplication

### ARCH-1 (P1) — the five shelf pages are copy-paste forks that have drifted

Functions defined 5-6 times across `src/library/websites/*/shelf-page.js`:

```
renderNovels           applyFiltersAndSort    loadSavedFilters
persistFilters         updateFilterBadge      renderPillList
normalizeModalStatus   setInsightTarget       renderReadingStatusChart
applyDisplaySettings   refreshNovelMetadata   clearFilter
renderActiveFilters    applyFilterStateToUI   canonicalizeLabel
registerLabel          ensureRandomSelectButton
```

Plus `escapeHtml` ×12, `showToast` ×9, `openNovelFromQuery` ×8, `formatNumber` ×7,
`normalizeReadingStatus` ×7, `removeNovelFromLibrary` ×7.

This is not a style complaint — **SEC-4 is a direct consequence**: the same
`authorEl.innerHTML` line is escaped in two forks and unescaped in three. Every
future fix has to be applied five times or it silently drifts again.

`src/library/websites/shelf-utils.js` already exists as the intended shared
module and is unused (DEAD-2).

### ARCH-2 (P2) — four files over 5,000 lines

| File | Lines |
|---|---|
| `src/library/library.js` | 8,223 |
| `src/popup/popup.js` | 7,640 |
| `src/library/library-settings.js` | 5,728 |
| `src/content/content.js` | 5,400 |

23 files exceed 1,000 lines. `docs/overview/TECHNICAL_ROADMAP.md` names content
orchestrator thinning as active Phase 10; `library.js` and `popup.js` are now
larger than `content.js` and are not covered by any roadmap phase.

### ARCH-3 (P2) — dead constant in the storage orchestrator

`src/background/storage/storage-orchestrator.js:3` sets
`DEFAULT_ACTIVE_SYNC_PROVIDER = "google-drive"`, but `background.js:72` passes
`defaultProvider: "native-sync"`. The module constant is never the effective
default and is misleading.

### ARCH-4 (P2) — storage adapters silently drop `options`

`downloadBackup(fileId, options)` in the orchestrator (line 118) passes `options`,
but `google-drive-storage.js:18`, `dropbox-storage.js:18`, `onedrive-storage.js:18`
all declare `downloadBackup(fileId)` and discard it. Same for `listBackups` and
`getLatestBackup` in the Drive adapter.

---

## 6. Data integrity

### DATA-1 (P1) — native sync leaks stale chunks and can corrupt a restore

`src/background/storage/adapters/native-sync-storage.js:52-56`:

`uploadBackup` writes `rg_sync_chunk_0..N-1` and sets `meta.totalChunks = N`. It
**never removes chunks above N-1**. If a backup shrinks from 12 chunks to 6, keys
6-11 persist in `storage.sync` forever.

Consequences: permanent consumption of the 100 KB `storage.sync` quota by garbage,
which will eventually push a legitimate write over `QUOTA_BYTES` and fail the
backup. `resetAuth` only removes up to the *current* `totalChunks`, so the
leaked keys are not cleanable through the UI either.

### DATA-2 (P2) — `storage.sync` write-rate limits are not respected

A 13-chunk write is 14 keys. `chrome.storage.sync` enforces
`MAX_WRITE_OPERATIONS_PER_MINUTE = 120` and `..._PER_HOUR = 1800`. With
continuous backup enabled, this quota is reachable, and the failure mode is a
thrown quota error rather than a graceful degradation.

### DATA-3 (P2) — secondary sync destination failures are swallowed

`src/background/storage/storage-orchestrator.js:100-107` fires secondary uploads
with `.catch(() => {})`. A user with Drive + Dropbox configured whose Dropbox
token expired gets no signal that half their backups have been failing.

### DATA-4 (P3) — serial `await` in loops on network paths

`src/utils/drive.js:588`, `src/utils/onedrive.js:191`,
`src/background/loreweave/queue-manager.js:305`,
`src/background/message-handlers/chat-handler.js:148`.

---

## 7. Resource leaks

| ID | Sev | Finding |
|---|---|---|
| LEAK-1 | P2 | ~~`setInterval` without any `clearInterval` in `background.js`, `background/offscreen.js`, `webnovel-handler.js`.~~ **RESOLVED, and the worst of it was worse than described.** Two real defects, one phantom. **(a)** `background.js` ran a 25s heartbeat whose body wrote a debug log one time in ten. 25s is under Chromium's 30s service-worker idle timeout, so it reset that timer forever and pinned the worker awake for the whole browser session — the precise cost MV3 exists to avoid, paid for a log line. Deleted; `setupKeepAliveAlarm()` was always the real mechanism. **(b)** `webnovel-handler.js` started a 1s URL poll and a `document.body` subtree `MutationObserver` *from its constructor*. `HandlerManager.loadHandlers()` constructs **every** handler class on **every** supported site in order to ask which one can handle the page, so both ran on Ranobes, AO3, FanFiction, NovelBin and the rest — an observer firing on every DOM mutation of the page to query `.cha-content` selectors that exist only on WebNovel. Monitoring is now gated on `canHandle()`, both handles are retained, `startChapterMonitoring()` is idempotent, and `cleanup()` tears both down on `pagehide`. **(c)** `background/offscreen.js` contains no `setInterval` at all and no evidence it ever did — that part of the finding was wrong. |
| LEAK-2 | P2 | **The original finding was wrong; the counts were a naive grep.** The two "unpaired" intervals are the rolling-backup countdowns at `library-settings.js:1536` and `library.js:984`, and both are already guarded (`if (!window._lsRollingCountdown)` / `if (!window.rollingBackupCountdownInterval)`) — idempotent page-lifetime singletons, not leaks. Set/clear counts cannot distinguish those from a real leak. **One real problem was found next to them and fixed:** `initQueueStatusWidget()` (`library.js:2789`) polled the background every 15s for the life of the tab. Each poll is a `sendMessage`, which on Chromium wakes the service worker — four wakeups a minute, forever, per open library tab, to update a badge in a tab that is usually hidden. It now skips the poll while `document.hidden`, refreshes immediately on `visibilitychange` so the badge is never stale when visible, and clears on `pagehide`. |
| LEAK-3 | P3 | **The original finding was wrong.** These are `window`/`document` listeners registered by a content script and by a library page, on the document they belong to. They are torn down with the document; there is no path by which they outlive it. The stated compounding mechanism does not exist either: `content.js` guards re-entry with `__rgInitStarted`, and SPA chapter navigation is handled *within* the existing script instance (`setupNavigationObserver`, called once at the end of `initialize()`) rather than by re-injecting the script — a declared content script is injected once per document, and the codebase contains no `scripting.executeScript` call that could inject a second copy. Removing these by hand at `pagehide` would add code and a new failure mode to solve nothing. |
| LEAK-4 | P3 | **A fourth leak in the same handler, found by the tests written for TEST-1 rather than by reading the code — **RESOLVED**.** `startChapterMonitoring()` also scheduled a one-shot `setTimeout(..., 1000)` for its first button sweep. Being a one-shot it looked harmless, so the LEAK-1 fix retained the interval and the observer but not this handle: a handler torn down inside its first second still fired the sweep a second later, against a document the caller had already discarded. In a browser that is invisible (the DOM is merely gone by then). In the test harness it surfaced at once, as `ReferenceError: document is not defined` raised *after* the test had ended. Now stored as `initialInjectTimer`, cleared in `cleanup()`, and asserted in both directions by the WebNovel monitor tests. |

---

## 8. UX and user-friendliness

### UX-1 (P1) — native `confirm()` / `prompt()` used for 20+ destructive actions

Content script (injected into third-party novel sites):
`content/modules/ui-controls.js:291, 475`, `novel-context.js:1002`,
`enhancement-toggle-banner.js:16`, `main-summary-banner.js:135`.

Extension pages: `library-settings.js` ×13 including `prompt()` at line 4673,
`library.js` ×3.

Problems: browsers offer "prevent this page from creating additional dialogs",
which permanently disables them for the tab; the dialogs are unstyled and clash
with the extension's own theme system; and `prompt()` is unusable on mobile
Firefox. The project already has a modal system (`edit-modal.js`) that these
should route through.

### UX-2 (P2) — a user-visible "not implemented" string ships in the build

`src/content/content.js:4733`: `"Original content restoration is not implemented yet"`.

### UX-3 (P2) — placeholder endpoint shipped as a live default

`src/utils/constants.js:388`: `LOREWEAVE_DEFAULT_URL = ""` with the comment
`// e.g. "https://api.loreweave.example.com"`. Combined with DEAD-1, a user
enabling LoreWeave in settings gets no working behaviour and no error explaining why.

### UX-4 (P2) — telemetry consent — **RESOLVED, and the original finding was wrong**

`src/library/telemetry-consent.js` is *not* unreachable — see the DEAD-2
correction above. Tracing it end-to-end did turn up a real problem, but a
different one.

Two consent surfaces existed. The **banner** (`library.html:110`) is the live
one: shown by `checkFirstRunConsentRuntime` on first library open, worded as a
question ("No, Keep Disabled" / "Yes, Allow Anonymous Metrics"), which matches
`DEFAULT_CONFIG.enabled = false` in `telemetry.js:30` — nothing is sent until
the user says yes, and `trackEvent` returns early while disabled
(`telemetry.js:109`).

The **modal** (`library.html:486`) was referenced only by `closeModal`; no code
path ever opened it. Its copy said analytics was "**enabled by default**" with a
"Keep Enabled" button — a privacy claim that contradicted the code. It has been
deleted along with its two handlers. Its disclosure of what is and is not
collected was the only such statement in the extension, so it now lives in
Library Settings → Analytics & Diagnostics, where the toggles it describes are,
and renders unconditionally rather than behind a JS unhide.

Also fixed while in here:

- `telemetry-toggle` and `send-errors-toggle` shipped `checked` in the markup,
  showing analytics as on for the frame before JS corrected them.
- `library.js` wrote three storage keys — `telemetryEnabled`,
  `sendErrorsEnabled`, `webhookUrl` — that nothing reads. The first two
  defaulted to `?? true` against elements that do not exist on `library.html`,
  so every settings save persisted "telemetry on" regardless of the user's
  answer. Harmless only because the real config lives under
  `TELEMETRY_CONFIG_KEY`; removed before something started reading them.

### UX-5 (P3) — dead settings plumbing in `library.js`

The settings UI moved out to `library-settings.html`, but `library.js` still
carries the element lookups, loaders, and change listeners for it —
`telemetry-toggle`, `send-errors-toggle`, `webhook-url`, `library-debug-mode`,
`rolling-backup-toggle`. None of those ids exist in `library.html`, and
`library.js` is loaded only by `library.html`, so `loadTelemetrySettings()`
there is a no-op and its listeners never bind. `library-settings.js` has
working copies of all of it. Cosmetic rather than a defect — filed for the
`content.js`/`library.js` thinning work (ARCH-2), not fixed here, because
unpicking it touches the shared settings-save path.

### UX-6 (P1) — the whole Story Chat settings panel did nothing — **RESOLVED**

Settings → Chat offered five controls. `library-settings.js` wrote them to
`rg_chat_settings`; **nothing read that key**. The panel had no effect on any
chat request:

| Control | Was | Now |
|---|---|---|
| Current chapter content | never sent — the background has no tab to read a chapter from, and the popup never fetched one | popup fetches it via `getNovelContext` and sends it; `content.js` returns `chapterText` |
| Story chronicle | always used | skipped when off |
| LoreWeave entity index | always used, ignoring the experimental gate | needs both the toggle *and* `isLoreWeaveEnabled()` |
| Conversation history depth | hardcoded `MAX_HISTORY_PAIRS = 6` | read from settings, clamped 2–20 |
| Web search | no implementation anywhere in the tree | toggle removed |

The web-search toggle is the one worth calling out: it promised the AI could
search the web and nothing behind it existed. Removed rather than stubbed —
a control that lies is worse than an absent feature.

`CHAT_SETTINGS_KEY` and the defaults now live in `utils/constants.js`, and both
the settings page and the handler resolve them through
`utils/chat-settings.js`, so the key and its defaults are defined once.
`normalizeChatSettings` clamps on the way in and on the way out, since
`maxHistory` multiplies directly into request size and storage is hand-editable.

With every source switched off the model is now told the context is empty
rather than handed a blank block to fill in. Pinned by
`tests/chat-settings.test.mjs`, which drives the real handler with a stubbed
`fetch` and asserts on the prompt each combination produces.

### UX-7 (P1) — every per-site setting field applied to nothing — **RESOLVED**

Found while wiring the per-site reading typeface. A handler can declare a
`SETTINGS_DEFINITION.fields` list, which the Library renders on that site's card
and saves into the per-site settings store under `SITE_SETTINGS_KEY`, keyed by
**shelf id**. A handler can *also* declare `getProposedLibrarySettings()`, an
unrelated metadata-only schema the background returns for the
`getHandlerSettings` message, keyed by **domain**.

`injectHandlerCustomCSS()` in `content.js` sent that message and then indexed the
response by shelf id. Two independent mismatches stacked:

| | Expected | Actual |
|---|---|---|
| Response key | `settings["scribblehub"]` | response is keyed `settings["www.scribblehub.com"]` |
| Payload | field *values* | `proposed` is a `key → {type, default, label}` schema, and contains none of the declared fields anyway |

Both resolve to `undefined`, so `globalCSS`, `logoCSS` and `fontSize` were read
as absent on every site, every time. There is no error path here — the settings
saved, the UI showed them, and they did nothing. Fixed by reading the store the
Library actually writes to, which `content.js` already loads for the site
enable/disable check, so no new round-trip was added. Ranobes names its field
`chapterFontSize`; that key is honoured alongside `fontSize` rather than renamed,
since renaming would drop a value a user had already set.

`tests/per-site-settings-wiring.test.mjs` pins all three halves: the read is from
the per-site store and not from `getHandlerSettings`, every key `content.js`
consumes is declared by some handler (so a dead branch fails the build), and the
per-site typeface options are built from `READING_FONTS` rather than restated.

---

## 9. Build, tooling, and repo state

| ID | Sev | Finding |
|---|---|---|
| BUILD-1 | P1 | ~~**`npm run lint` is RED**: 10 errors (`no-irregular-whitespace` in `ao3-handler.js` ×5, `edit-modal.js:112`, `ao3/novel-card.js:67`, `comprehensive-backup.js:437`), 14 warnings.~~ **RESOLVED** — lint is clean. |
| BUILD-2 | P0 | ~~**No tests exist.** No runner, no config, no spec files anywhere in the repo.~~ **RESOLVED** — `node --test` over `tests/**/*.test.mjs` — 210 passing when this was closed, 258 now that TEST-1 has landed on top of it. |
| BUILD-3 | P1 | ~~**No CI quality gate.**~~ **RESOLVED** — `.github/workflows/ci.yml` runs lint, tests, emoji scan, and a both-target build on push to `main` and on every PR, and asserts the build does not dirty tracked files under `src/` (which would mean a handler was added without regenerating `handler-registry.js`). It is a `workflow_call` workflow so `publish-addons.yml` consumes it as a `needs:` gate rather than duplicating the steps — a tag push can no longer reach the stores without passing it. |
| BUILD-8 | P2 | ~~**`npm run format:check` is RED across ~100 files.** The tree predates Prettier being enforced. Deliberately left out of CI: a check that fails on day one teaches people to ignore CI. Fix is one dedicated `npm run format` commit — kept separate so it does not bury real changes in whitespace — after which the step goes into `ci.yml`.~~ **RESOLVED** — 156 files normalized, `format:check` is green, and the step is now in `ci.yml`. Two things had to be fixed before the pass could be trusted: **(a)** `npm run format` globs `src/**/*.js`, which swept in the *vendored* `browser-polyfill.min.js` and un-minified it from 6 lines to 556 — a diff nobody can review against upstream, in a file that is not ours to restyle. Reverted, and a `.prettierignore` now excludes it along with `dist/`, `releases/` and `graphify-out/`. **(b)** `.prettierrc` carried an `insertFinalNewline` override, which is an EditorConfig key, not a Prettier one; Prettier had been printing `Ignored unknown option` on every run and doing nothing with it. Removed rather than left to warn forever in CI logs. Verified afterwards that `npm run build` still leaves `src/` byte-identical, so the "generated files are committed" CI step does not start failing on formatting. |
| BUILD-9 | P2 | **`src/library/library.html` had an unclosed `<div>` — found by Prettier refusing to parse it.** `.library-container` opened on line 24 and never closed; the browser's implied-end-tag recovery had been papering over it, so the page rendered and nobody noticed. Real consequences beyond tidiness: `</body>` was being absorbed into the container, which puts the two `<script>` tags inside a positioned flex container rather than at body level, and any CSS or `querySelector` walk that assumes `.library-container` is a sibling of the scripts was working by accident. Closed, and the file reformatted. |
| BUILD-10 | P2 | **The AMO source package included local scratch and omitted the config its own instructions need.** `dev/package-source.js` allowlists *directories* (`src/`, `dev/`, `docs/`, `.github/`), which does not stop untracked working files inside them from being archived — `docs/guides/last prompt.md` alone is 553 KB of local notes, gitignored but very much on disk, and it was going to AMO reviewers. Meanwhile `REVIEWER NOTES.md` tells reviewers to run `npm run lint`, and neither `.eslintrc.json` nor `.prettierrc` was in the archive, so that instruction failed on a clean unzip of the archive itself — the same class of defect as the build instructions already fixed above. Both fixed: the two config files are included, and an entry filter drops scratch, `node_modules`, `.tmp/`, `scratch/`, `sample/`, `.graphify_*` and OS junk. Verified against a freshly built zip: 392 entries, no scratch, both configs present. **Update:** the ESLint config is now `eslint.config.mjs` rather than `.eslintrc.json` (see BUILD-11); the archive allowlist was updated with it, so the reviewer instruction still works on a clean unzip. |
| TEST-1 | P2 | ~~**Website-handler metadata extraction is untested.** The eight handlers in `src/utils/website-handlers/` are the layer most exposed to breakage, since each site can change its markup without warning, and nothing pins their selectors. Needs captured HTML fixtures per site; deferred because the fixtures are the work, not the tests. Now scheduled as roadmap unit **17-U1**.~~ **RESOLVED — and it found four production bugs on the way in, which is the whole argument for having done it.** Ten reduced HTML fixtures under `tests/fixtures/` (one per handler, plus an AO3 full-work page and a Ranobes novel page), a `tests/fixtures/README.md` stating what a fixture is for and the rule that a fixture is updated *in the same commit* as the handler fix it belongs to, and `tests/website-handlers.test.mjs` — 30 tests covering `canHandle`, `isChapterPage`, title extraction, content extraction and per-site cleaning for all eight handlers. Every fixture deliberately carries noise the handler is supposed to strip (an ad block, a `<script>`) and one sentinel sentence of ordinary prose, so a test fails both when extraction loses content and when it mangles it. Suite was 258 tests at that point, all passing. **The four defects found:** see the four rows below. |
| TEST-1a | **P0** | **Every Ranobes chapter was being silently corrupted before it reached the model.** `removeAdRelatedText()` carried `/\[?\s*ad\s*\]?/gi` among its ad-marker patterns. Every part of that expression except the literal `ad` is optional, so with no anchors it matched the letters "ad" *anywhere in the text*: `"He had already walked the road ahead, shadowed and afraid."` came out as `"He halrey walked the roahe, showed and afraid."` The same flaw applied to the sibling `advertisement` and `sponsored` patterns, which deleted those words out of ordinary prose. This ran on every Ranobes extraction. Replaced with two anchored patterns — one whole-line, one bracketed — and pinned by a regression test that names the old expression and asserts the sentinel sentence survives intact. |
| TEST-1b | P1 | **`BaseHandler.extractContent()` did neither of the two things its callers are entitled to assume.** It read `document.title` directly instead of calling `this.extractTitle()`, which made every subclass's `extractTitle()` dead code unless that subclass *also* overrode `extractContent()` — so FanFiction's, which digs the story name out of `#profile_top`, was never reached and chapters were titled `"Story, a fandom fanfic | FanFiction"`. It also read `innerText` off the *live* element rather than the cleaned clone, so scripts, ad slots and `<ins>` blocks inside the content area went straight into the text handed to the model. Both fixed; the two FanFiction handlers are the ones that inherit this path. |
| TEST-1c | P1 | **A circular import that only worked by alphabetical luck.** `fanfiction-handler.js` → `site-settings.js` → `domain-constants.js` → `fanfiction-mobile-handler.js` → `fanfiction-handler.js`. `domain-constants.js` imports every handler class to build `SHELF_REGISTRY`, so anything a handler imports must not transitively reach it. The cycle throws `Cannot access 'FanfictionHandler' before initialization` whenever `fanfiction-handler.js` is the first module in the ring to be evaluated — which never happened in the shipped extension only because the alphabetically first handler pulls `domain-constants.js` in ahead of it. Any import-order change would have broken FanFiction outright. Fixed by moving `SITE_SETTINGS_KEY` and `DOMAIN_SETTINGS_KEY` to `constants.js`, which imports nothing; `site-settings.js` re-exports them so existing importers keep working. All eight handler modules now load standalone. |
| TEST-1d | P2 | **AO3 counted every chapter twice on a full-work page.** AO3 nests a `div.chapter.preface.group` *inside* every `div.chapter`, so `#chapters .chapter` matched both. Two visible effects: reported `totalChapters` was double the real number, and a single-chapter work opened with `?view_full_work=true` passed the "more than one chapter" test and took the full-work extraction path. Both call sites now share one `FULL_WORK_CHAPTER_SELECTOR` constant carrying the `:not(.preface)` exclusion — shared rather than written twice because if the two disagree, one decides a page is a full work and the other finds nothing on it. |
| BUILD-4 | **P1** | **Committed release artifacts dominate the repository, and the fix is the user's call, not mine.** Measured: **67 zip files tracked under `releases/`, 676 MB of blobs at HEAD**, `releases/` on disk 694 MB, `.git` 313 MB. Every `git clone` pays that. Two parts of the original finding were wrong: `dist/` and `.graphify_*` are both correctly gitignored and neither is tracked (`git ls-files` returns zero matches for `.graphify`), so the only real problem is the zips — and they are tracked *deliberately*, via an explicit `!releases/*.zip` whitelist on `.gitignore:5`. <br><br>**Not actioned, on purpose.** The repair is either `git rm --cached` going forward (leaves 313 MB of history, and changes how releases are distributed) or a history rewrite with `git filter-repo` (recovers the 313 MB, but is irreversible, breaks every existing clone, and invalidates commit SHAs referenced from the changelog and release notes). Both are distribution-policy decisions with outward-facing consequences, not bug fixes, so they need an explicit decision. **Recommendation:** publish zips as GitHub Release assets — which is what Releases are for, keeps every download URL working, and costs nothing against clone size — then stop tracking new ones. Leave history alone unless clone size becomes a real complaint. <br><br>**Update — the recommendation was accepted and is now implemented, except for the one irreversible step.** `.gitignore` no longer whitelists `releases/*.zip`, the tracked zips are staged for removal from the index, `publish-addons.yml` attaches every packaged zip to the GitHub Release on a tag push, and `dev/publish-release-assets.js` (`npm run release:archive`) back-fills the historical versions. The release flow is documented in `CONTRIBUTING.md`, `README.md` and `docs/build/BUILD_SYSTEM.md`. **Update 2 — the back-fill has now been run with an explicit go-ahead.** `npm run release:archive -- --yes` covered all 30 versions: **26 tags created, 67 assets uploaded, 675.9 MB**, leaving 33 remote tags and 33 releases. One side effect was expected and checked rather than assumed: pushing tag `v5.0.0` fired `publish-addons.yml` as that commit defined it (run `31602647225`, success, 48 s). That older revision of the workflow has no `gate` job and its "Upload release artifacts" step is `actions/upload-artifact@v4` — a workflow artifact, **not** a release upload — so it could not overwrite the assets the archive had just attached, and the v5.0.0 assets are intact (uploaded 13:40:42, artifact step ran 13:40:59). Store submission was skipped exactly as designed: the run logged `Skipping Firefox (AMO) … Missing: AMO_API_KEY, AMO_API_SECRET` and `Skipping Chrome Web Store … Missing: CWS_*`, because `PUBLISH_* = auto` with `PUBLISH_STRICT = false` skips any store whose credentials are absent, and no repository secrets are configured. The older tags fired nothing, since the workflow file did not exist at those commits. History rewriting remains rejected. The zips are out of the index (`git ls-files releases/*.zip` → 0, 47 files still present on disk and now covered by `.gitignore:9`), so the only step left is committing that removal — after which a fresh clone stops paying for the 676 MB at HEAD. |
| BUILD-5 | P2 | ~~Repo-root clutter that should not ship: `gcm-diagnose.log`, `REVIEWER NOTES.md`, `Changes.md` (gitignored but present), `INSTRUCTIONS.md` (gitignored but present), `scratch/`, `.tmp/`, `sample/`.~~ **RESOLVED, and mostly by checking rather than deleting — the finding overstated the problem and understated where the real leak was.** Verified with `git ls-files`: of everything listed, only `REVIEWER NOTES.md` is tracked, and that one belongs in the repo — AMO requires it and `dev/package-source.js` ships it deliberately. The rest are untracked *and* already matched by `.gitignore`, so they cannot enter a commit; they are the user's local working files and deleting them was never the fix. They also cannot reach a build: `dev/build.js` copies a fixed list of directories out of `src/`. **The one place the clutter did escape is the AMO source zip — see BUILD-10.** |
| BUILD-6 | P3 | `docs/guides/last prompt.md` is untracked working scratch sitting in the docs tree — 553 KB of it. **RESOLVED** by gitignoring the pattern rather than deleting the file: it is the user's scratch and untracked, so it was never a repo problem, only a "one `git add docs/` away from becoming one" problem. `.gitignore` now excludes `docs/**/last prompt.md` and `docs/**/*.scratch.md`. |
| BUILD-11 | **P1** | **The CI gate was running on a Node version that no longer exists, and nothing was watching for it.** All three workflows pinned `node-version: 20`; Node 20 reached end-of-life in **April 2026**, so the build that decides whether a tag may reach AMO and the Chrome Web Store was executing on a runtime that stopped receiving security fixes four months ago. The pinned actions were a matching three-to-four majors behind (`checkout@v4`, `setup-node@v4`, `upload-artifact@v4`, `configure-pages@v4`, `upload-pages-artifact@v3`, `deploy-pages@v4`). The root cause is the second half of the finding: **there was no `.github/dependabot.yml` at all**, so every bump here was manual and therefore never happened. <br><br>**Resolved, and every version claim was grounded rather than guessed** — web search returned self-contradictory results for `actions/checkout` (calling v7 latest while listing v5.1.0 as a July 2026 release), so each action's latest major was confirmed with `gh api repos/<repo>/releases/latest`. Now: Node **24** (Active LTS "Krypton"; 26 is Current, not LTS, and is deliberately not used), `checkout@v7`, `setup-node@v7`, `upload-artifact@v7`, `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`. checkout v7's one breaking change blocks fork-PR checkout for `pull_request_target` and `workflow_run` only; these workflows are `push` and `pull_request`, so it does not apply. `package.json` `engines.node` moved `>=20` -> `>=22.13.0`. `ci.yml` and `publish-addons.yml` carry the same Node version by design, with a comment saying why: a store submission built on a different runtime than the one the gate tested is not actually gated. **Dependabot** now covers npm devDependencies and the actions majors weekly, each grouped into a single PR (they move together — the Node 24 runtime bump took every `actions/*` repo at once) with a 5-day cooldown, 14 for majors, so a version that gets yanked within days never reaches a PR. <br><br>**The dependency upgrade that came with it found two real bugs and one broken build.** ESLint 8 -> 10 required migrating to flat config (`eslint.config.mjs`; 9 dropped the rc format as default, 10 removed the compat path) — and `no-constant-binary-expression` immediately caught a user-visible defect in `library-settings.js`: deleting a custom chat-box type used `+a?.b ?? +c`, where unary `+` binds tighter than `??`, making the expression `NaN ?? …` = `NaN`, so `splice(NaN, 1)` deleted entry 0 instead of the clicked one whenever the click target had no `[data-idx]` ancestor. `preserve-caught-error` found four `catch` blocks re-throwing without `{ cause }`. `no-useless-assignment` cleared eleven dead initializers, each verified by reading the control flow rather than trusting the linter. Separately, archiver 5 -> 8 is ESM-only and dropped its callable default export, so all three packaging scripts now construct `ZipArchive`; and the stale `overrides: { "brace-expansion": "^2.0.3" }` CVE pin had to be **removed**, not re-pinned — it forced 2.1.4 while `minimatch@10.2.6` requires `^5.0.8` and imports its ESM named export, which broke `npm run package` outright. `npm audit` reports 0 vulnerabilities without the override. Full gate re-verified after all of it: lint clean, `format:check` clean, 269/269 tests, emoji scan clean, backup contract valid, both targets build, all three zips package. |
| BUILD-7 | P3 | ~~`package.json` has `"private": true`, which will block any future npm-based distribution and is inconsistent with the `files` array it also declares.~~ **The original finding was wrong on both halves.** There is no `files` array in `package.json` — nothing to be inconsistent with. And `"private": true` is correct here: this is a browser extension distributed through AMO and the Chrome Web Store, not an npm package, and `private` is the flag that stops an accidental `npm publish`. Removing it would create the problem the finding imagined it was describing. Left as is. (`src/package.json` also carries `"private": true`; that file exists only to mark `src/**/*.js` as ES modules for Node's resolver, and says so in a `//` key.) |

---

## 10. Documentation

| ID | Sev | Finding |
|---|---|---|
| DOC-1 | P1 | ~~**Version claims contradict each other.**~~ **RESOLVED** — `VISUAL_DASHBOARD.md` was stale output, regenerated (it also still claimed 7 site handlers; there are 9). `ARCHITECTURE.md` no longer carries a version number at all: a hand-maintained copy of `package.json`'s version in a document nobody remembers to bump is a guaranteed future contradiction, so it now names the 5.x line and points at `package.json` for the exact number. |
| DOC-6 | P1 | **The AMO reviewer build instructions did not work** — **RESOLVED**. `README.md` and `REVIEWER NOTES.md` both told reviewers to run `npm run package-source` (the script is `package:source`), described `npm run package` as calling a nonexistent `npm run archive`, referenced `src/manifest.json` (there are two, neither named that), claimed Node v14, and named the output `RanobeGemini_v4.4.0.zip` (two versions stale, and the wrong filename shape — packages are now per-target). The "Load Temporary Add-on" instruction pointed at `src/manifest.json` too, so following the README verbatim failed at step one. Both documents now describe the real pipeline, and `REVIEWER NOTES.md` additionally documents the three build-time injected constants and every host the extension contacts — neither of which a reviewer could previously learn from us. |
| DOC-7 | P2 | **7 broken relative links across the docs tree** — **RESOLVED**. `README.md` pointed at `LICENSE` (the file is `LICENSE.md`), `CONTRIBUTING.md` at `docs/ADDING_NEW_WEBSITES.md` (it is under `docs/guides/`), and `docs/overview/presentation.md` had six links written as if the file lived one directory higher, including an image path that differed only in case (`UX_FLow.png` vs `UX_Flow.png` — invisible on Windows, broken on the Linux box serving GitHub Pages). |
| DOC-8 | P2 | **The README's supported-site table was missing two sites** — **RESOLVED**. NovelArrow and NovelBin have handlers and manifest match patterns but no README row, so the table understated the supported set by two. Usage step 2 also enumerated four sites inline, including WebNovel, which the same table lists as disabled; it now links to the table instead of repeating it. |
| DOC-9 | P2 | **The README named the wrong default model, and its version badge was hand-pinned** — **RESOLVED**. It said "Gemini 2.0 Flash (recommended)"; `constants.js:135` sets `DEFAULT_MODEL_ID = "gemini-2.5-flash"`, with 2.0 Flash as the *fallback* (`DEFAULT_BACKUP_MODEL_ID`). The recommendation and the fallback had been swapped. The line now names 2.5 Flash as the default and points at the two constants as the authority. Separately, the version badge was a static `badge/version-5.0.0` image that would silently misreport after any bump; it now reads `package.json` live via `shields.io/github/package-json/v`. The Features list also still credited enhancement to "Gemini AI" alone, and the `<!-- GitHub Topics -->` comment carried `gemini-ai`/`google-ai` with no Ollama or OpenAI entry — both now match the three-provider reality and the `keywords` array in `package.json`. |
| DOC-2 | P1 | **96 markdown files with heavy overlap** — **PARTIALLY RESOLVED**. The real defect was not the file count, it was that historical session records were titled as if they were current guides — `IMPLEMENTATION_COMPLETE.md` opens "everything you need to properly set up and ship", and it has been stale since February. Added [`docs/implementation/README.md`](../implementation/README.md) declaring the whole directory historical, dating each file, saying what it covers, and pointing at the current doc for each question; each of the six files now carries a banner saying the same. **Deliberately not merged:** the three Google Drive documents overlap because they were written at three zoom levels across two sessions a month apart, and merging them means picking which of three accounts is authoritative — none is, the code is. The `RELEASE_NOTES_*` files are per-release historical records that CLAUDE.md forbids altering, so the count there is correct by design and not duplication. |
| DOC-3 | P1 | **Docs described LoreWeave as a working feature while the content-side integration was unwired** — **RESOLVED**. The feature is now gated behind `LOREWEAVE_EXPERIMENTAL_ENABLED = false` in `src/utils/constants.js`, enforced by `src/utils/loreweave-gate.js`: no LoreWeave UI renders and no request leaves the browser until the user opts in from Settings → Advanced → Experimental. Both surviving doc references (`MODULAR_ARCHITECTURE.md`, `MODULAR_SYSTEMS_README.md`) now say "Experimental, off by default" rather than presenting it as shipped. The `docs/superpowers/` plan and spec files still describe the fuller intent, which is correct — those are design records, not claims about the current build. |
| DOC-4 | P2 | **No diagrams for the four hardest-to-follow subsystems** — **RESOLVED**. Added [`docs/architecture/DATA_FLOWS.md`](../architecture/DATA_FLOWS.md) with four diagrams read off the source, each with the "Diagram elements" list the house style requires: storage sync fan-out, background message routing, the chunking pipeline, and the OAuth flows. Writing them surfaced three behaviors that were true but undocumented anywhere: secondary sync uploads are fired with `.catch(() => {})` so a dead secondary destination reports success; all six read operations hit the primary destination only, so switching primaries hides backups written to the old one; and `processMessage` substitutes a literal `true` for a returned Promise because a thenable does not hold the message channel open in Firefox. Also fixed the Overview's opening sentence, which called this "a Firefox extension (v3.0.0)" — it is cross-browser and two major versions past that. |
| DOC-5 | P2 | **Roadmap claimed active phases that were finished, and named no successor** — **RESOLVED**. `CLAUDE.md` and `TECHNICAL_ROADMAP.md` both listed phases 10/11/15 as active and 12/13 as queued, while the roadmap's own tables marked every unit of 10 through 15 complete. The roadmap header also carried a hardcoded version and a "Current State (Verified)" bullet calling `content.js` "10k+ lines" — its own Phase 10 table recorded ~5243. Measured on 2026-08-12: `content.js` 5442, `background.js` 4364, `library.js` **8210**, `popup.js` **7336**. So Phase 10 succeeded and the hotspot simply moved, unowned, to the two files nobody had assigned. Added **Phase 16** (library/popup thinning, 4 units) and **Phase 17** (test strategy depth, 4 units — 17-U1 is TEST-1), replaced the hardcoded version with a pointer to `package.json`, and repointed `CLAUDE.md` at this audit as the active work stream. |

---

## 11. Landing site

| ID | Sev | Finding |
|---|---|---|
| LAND-1 | — | **SSR is already satisfied.** `landing/index.html` is static HTML with content in the markup, correct `<title>`, `description`, `canonical`, Open Graph, Twitter card, and JSON-LD `WebApplication`. Search engines do not need JS. No change needed for the SSR requirement as stated. |
| LAND-2 | P2 | ~~Google Fonts is loaded from a third-party origin (`fonts.googleapis.com`), which costs a render-blocking round trip and is a GDPR consideration for EU visitors.~~ **RESOLVED, and extended past the landing site.** All 8 pages now load `landing/assets/fonts/fonts.css`; no page references a Google origin, and `tests/reading-fonts.test.mjs` fails the build if one comes back. `landing/sw.js` precaches the four `latin` faces (cache bumped to `v4`), so the site's own typography survives offline instead of falling back mid-page. The same work made a reader-facing feature possible: `READING_FONTS` in `src/utils/constants.js` now offers a chapter typeface, four of them bundled (Literata, Merriweather, Atkinson Hyperlegible, Inter) and three costing nothing (site default, Georgia, system sans). **On the licensing**, which is the part that cannot be asserted from memory: every bundled family lives under `ofl/` in the `google/fonts` repository, which is that repository's marker for SIL Open Font License 1.1 — verified by fetching each family's `OFL.txt` and matching its text, not by recalling it. `dev/fetch-fonts.js` refuses to write a family whose licence it cannot verify, and the licence ships beside the binaries. **On the reading claim**, deliberately narrow: no font is demonstrably read faster than another, so the settings copy and the constants doc-comment say what each face was drawn for and let the reader choose. |
| LAND-3 | P2 | `landing/index.html` is 24 KB for a product with 7 supported sites, 3 AI providers, and 5 sync backends. The site has 9 indexable pages, so the original "one page" framing was wrong, but the home page is still thin relative to the feature surface. **RESOLVED.** `index.html` gained three feature cards (bring-your-own-AI, story chat, chapter queue), three FAQ entries, an expanded `featureList` in the `WebApplication` JSON-LD, and a new `FAQPage` block mirroring the visible copy. The Gemini-only framing was then swept out of the remaining pages: `terms.html` (third-party services), `architecture.html` (component-map diagram and its fallback text), `content-styles.html` (two "Gemini AI" labels), and `drive-setup.html`. `install-guide.html` and `novel-status.html` were already provider-neutral. |
| LAND-10 | **P1** | **The landing site claimed backups were encrypted. They are not.** `drive-setup.html` said so in three places — the meta description ("Secure, encrypted, automatic backups"), the hero lede, and a feature box asserting "Your data is encrypted and stored only in your personal Google Drive." No encryption exists anywhere in the codebase: `crypto.subtle` appears exactly twice, both times computing the SHA-256 PKCE code challenge (`src/utils/drive.js:35`, `src/utils/oauth-pkce.js:16`). Backups are plaintext JSON. This is the kind of claim a privacy-conscious reader acts on, and it was wrong in the user's favour of trusting us. **RESOLVED** — all three now describe what is actually true (OAuth2 with PKCE, `drive.file` scope only, HTTPS in transit), the "Is my data safe?" FAQ states plainly that the file is unencrypted and that WebDAV on your own server is the alternative, and `privacy.html` carries the same disclosure. **Follow-up, also done:** the claim is no longer merely retracted — opt-in AES-GCM-256 encryption now exists (`src/utils/backup-crypto.js`), covering file export and the four remote cloud destinations. It is off by default and both landing pages now say so, along with what it does and does not protect. Native browser sync is excluded on purpose: that adapter writes to `browser.storage.sync`, the same store the key is mirrored into. |
| LAND-11 | P3 | ~~`drive-setup.html` said "Zero access from Ranobe Gemini servers."~~ **RESOLVED.** True but self-defeating: it implies such servers exist. Reworded to state there are none. |
| LAND-4 | — | ~~`landing/sitemap.xml` predates several pages.~~ **Not a defect** — all 9 indexable pages are listed, and the two that are excluded (`oauth-redirect.html`, `offline.html`) should be. It carries no `<lastmod>`, which is the one thing search engines actually use, but a hand-maintained `<lastmod>` that goes stale is worse than none — Google discards `lastmod` it judges unreliable. Left alone until the site has a generator. |
| LAND-5 | P3 | ~~`favicon` is hot-linked to `raw.githubusercontent.com`.~~ **RESOLVED, and it was worse than the finding said.** 16 references across 8 pages hot-linked `src/icons/icon.png` — a **943 KB** file — for both the favicon and the header logo, on every page load, from an origin that rate-limits and is not a CDN. Now served locally at the sizes actually rendered: 2.5 KB favicon, 16.5 KB logo. |
| LAND-6 | P3 | ~~`landing/oauth-redirect.html` is the relay counterpart to SEC-1/SEC-2 and must be re-reviewed alongside the manifest change.~~ **RESOLVED — reviewed, and the relay itself needed no change.** The re-review confirmed all four properties the SEC-1/SEC-2 model depends on: (1) the page never receives a token — it reads only `code`/`error` for display text, and `code` is stripped from the address bar with `history.replaceState` so it cannot linger in history; (2) `state` is validated, in the background worker, against `pendingAuthFlows` — a code with no matching flow is discarded; (3) the sender is pinned to a full origin (`LANDING_ORIGIN`), so `externally_connectable`'s old `ids: ["*"]` has no successor and a lookalike host cannot match; (4) the page↔bridge postMessage channel rejects anything that is not same-window, same-origin, on the `ranobe-gemini` channel, and one of two allowlisted ops. **One real defect was found next to it**: the landing origin was authored in three places — `OAUTH_REDIRECT_URIS.web`, `LANDING_ORIGIN` in background.js, and the `landing-bridge` match in both manifests — and the generator explicitly left the manifest copies alone. Drift there fails silently in the worst way: the bridge runs on a page the worker then refuses to hear, so the OAuth flow hangs with no error on either side. `LANDING_ORIGIN` is now derived from the constant, `dev/generate-manifest-domains.js` stamps the bridge matches from it, and `tests/manifest-sync.test.mjs` asserts the whole chain plus the absence of `externally_connectable`. |
| LAND-7 | P1 | **The PWA manifest's icons 404 in production** — **RESOLVED**. `manifest.webmanifest` pointed at `../src/icons/logo-128.png` and `../src/icons/logo-512.png`, but `deploy-landing.yml` uploads only `landing/` as the Pages artifact, so both paths resolved outside the deployed root. Its `id` was `/landing/library-hub.html` for a site served from the root. `index.html` and `library-hub.html` had the same `../src/` mistake. Every escaping path is now a local asset, and a link check over the whole site passes. |
| LAND-8 | P3 | **The service worker leaked stale runtime caches** — **RESOLVED**. `activate` pruned old `rg-landing-pwa-*` caches but never `rg-landing-runtime-*`, so every version bump left its predecessor's runtime cache behind permanently. |
| LAND-9 | P3 | **`robots.txt` allowed everything** — **RESOLVED**. The OAuth relay page and the offline shell are now disallowed and carry `noindex`; neither is a page anyone should reach from a search result. |

---

## 12. Recommended feature changes

You asked for an opinion on what to add, change, or remove.

**Remove**

1. **The `downloads` code path** (`background.js:375-405`). It is broken on
   Chromium (XB-1), requires a permission nothing else needs (MF-2), and
   duplicates the working `<a download>` export. Deleting it removes a permission
   from the install prompt.
2. **`src/library/websites/shelf-page.js`** and the other DEAD-2 files. 1,178
   lines of superseded code that reviewers will read as live.
3. **`src/content/debug-integration.js` + `debug-utils.js`** — orphaned and one
   has a broken import.

**Change**

4. **Collapse the five shelf-page forks into `shelf-utils.js` + per-site config.**
   This is the single highest-leverage change in the repo: it deletes roughly
   6,000 duplicated lines, fixes SEC-4 structurally, and makes the remaining
   audit items fixable once instead of five times.
5. **Replace `confirm()`/`prompt()` with the existing modal system** (UX-1).
6. **Finish or remove LoreWeave** (DEAD-1). Half-wired is the worst state: it
   carries the maintenance and review cost of a feature with none of the benefit.
   My recommendation is to gate it behind an explicit "experimental" flag and
   document it as such, rather than ship it as a headline feature.

**Add**

7. **A CI quality gate** (lint + build + tests on PR) before anything else — it
   is what stops this list from regrowing.
8. **A settings "Diagnostics" panel** surfacing which sync destinations last
   succeeded/failed, which would have made DATA-3 visible to users.

---

## 13. Proposed fix sequence

1. **Gate** — CI workflow (lint + build), fix BUILD-1's 10 lint errors. Makes every later step verifiable.
2. **Security** — SEC-1..8. Small, surgical, independently reviewable.
3. **Cross-browser** — XB-1..4, MF-1..6.
4. **Data integrity + leaks** — DATA-1..4, LEAK-1..3.
5. **Dead code removal** — DEAD-1, DEAD-2. Do this *before* writing tests so the tests do not cover code that is about to be deleted.
6. **Shelf-page consolidation** — ARCH-1. The largest single change; deserves its own review.
7. **Tests** — unit coverage for `utils/`, `background/storage/`, `background/ai/`, chunking; integration coverage for the message-handler routes and the backup round-trip.
8. **UX** — UX-1..4.
9. **Docs** — consolidate to a single current release note + archive, fix DOC-1's version contradictions, add the four missing mermaid diagrams, remove LoreWeave overclaims.
10. **Landing** — expand, self-host fonts, regenerate sitemap, add animation.
11. **Repo** — description, topics/tags, templates, release workflow.

Steps 1-5 are mechanical and low-risk. Step 6 is the one that needs your sign-off
on approach before I start.
