# NovelBin + UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five concrete problems: remove duplicate Enhance button from the controls bar, make long and short summaries stack instead of replace, add "Show Enhanced" button + configurable threshold when word count diverges, fix NovelBin SPA navigation staleness, and complete the NovelBin library modal (chapter count, tags, metadata). Keep existing green/red word count colour behaviour unchanged.

**Architecture:** Each fix targets one or two files in isolation. The summary stacking fix touches `chunk-summary-ui.js` (DOM creation), `summary-service.js` (container lookup), and `content.js` (container selection). The SPA fix intercepts `history.pushState`/`replaceState` and triggers a lightweight re-init. NovelBin modal completion extends the existing `extractNovelMetadata()` and `renderModalMetadata()` without changing their contracts.

**Tech Stack:** Plain JS (no framework), browser extension content script, DOM manipulation, `window.location`, `history` API.

---

### Task 1: Remove duplicate Enhance Chapter button

**Files:**
- Modify: `src/content/modules/ui-controls.js:560-564`

The `injectUI()` function adds both a toggle-banners button and an enhance button to the top `#gemini-controls` bar. The enhance button already exists inside the main summary group (created by `createMainSummaryGroup`). This task removes the enhance button from the top bar.

- [ ] **Step 1: Locate the duplicate**

Open `src/content/modules/ui-controls.js` and read lines 555–570. You will see:

```js
if (getHandlerType() !== HANDLER_TYPES.CHAPTER_EMBEDDED) {
    if (toggleBannersButton) controlsContainer.appendChild(toggleBannersButton);
    if (enhanceButton) controlsContainer.appendChild(enhanceButton);
    if (cancelButton) controlsContainer.appendChild(cancelButton);
}
```

- [ ] **Step 2: Remove the enhance button from the controls bar**

Replace those lines with:

```js
if (getHandlerType() !== HANDLER_TYPES.CHAPTER_EMBEDDED) {
    if (toggleBannersButton) controlsContainer.appendChild(toggleBannersButton);
    // enhance button lives in the main summary group — not duplicated here
    if (cancelButton) controlsContainer.appendChild(cancelButton);
}
```

- [ ] **Step 3: Build and verify no lint errors**

```powershell
cd V:\Code\ProjectCode\RanobesGemini
npm run lint && npm run build
```

Expected: 0 errors, both firefox and chromium builds succeed.

- [ ] **Step 4: Commit**

```powershell
git add src/content/modules/ui-controls.js
git commit -m "fix: remove duplicate enhance button from top controls bar"
```

---

### Task 2: "Show Enhanced" button + configurable threshold

**Files:**
- Modify: `src/utils/chunking/chunk-ui.js:209-227` (add button to threshold warning)
- Modify: `src/library/library-settings.html` (add threshold input)
- Modify: `src/library/library-settings.js` (load/save threshold)
- Modify: `src/content/modules/enhanced-content-banner.js` (guard for >200% expansion)

The threshold warning exists in `chunk-ui.js` but only shows text. When content exceeds the threshold:
1. Add a "Show Enhanced Anyway" button inside the warning box.
2. Expose the `wordCountThreshold` value as a configurable setting in library settings.
3. In the full-chapter (non-chunked) banner, guard against suspiciously large expansions (>200%) by showing a warning and adding a "Show Enhanced" toggle.

**Note: Keep existing green/red colour behaviour unchanged.** The colours in `enhanced-content-banner.js` stay as-is (`wordDifference >= 0 ? "#28a745" : "#dc3545"`).

- [ ] **Step 1: Add "Show Enhanced Anyway" button in chunk-ui.js threshold warning**

Find the `thresholdWarning` variable in `chunk-ui.js` (around line 210-226). It currently renders:

```js
thresholdWarning = `
    <div style="...">
        <span style="font-size: 16px;">⚠️</span>
        <span>Word count change (${percentChange}%) exceeds threshold (${threshold}%)</span>
    </div>
`;
```

Replace with:

```js
const showEnhancedBtnId = `rg-show-enhanced-${Math.random().toString(36).slice(2, 7)}`;
thresholdWarning = `
    <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(239, 68, 68, 0.1);
        border-left: 3px solid #ef4444;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        color: #fca5a5;
        flex-wrap: wrap;
    ">
        <span style="font-size: 16px;">⚠️</span>
        <span>Word count change (${percentChange}%) exceeds threshold (${threshold}%). Content may be unusually long.</span>
        <button id="${showEnhancedBtnId}" style="
            padding: 3px 10px;
            background: #374151;
            color: #e5e7eb;
            border: 1px solid #6b7280;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            white-space: nowrap;
        ">Show Enhanced</button>
    </div>
`;
```

After the banner HTML is inserted into the DOM, wire up the button. The `createChunkBanner` function returns a banner element. Add this after creating the banner element (find the `return banner` statement and add before it):

```js
// Wire up Show Enhanced button after DOM insertion via delegated click
banner.addEventListener("click", (e) => {
    if (e.target && e.target.id && e.target.id.startsWith("rg-show-enhanced-")) {
        // Find the chunk content in the same wrapper
        const wrapper = banner.closest(".gemini-chunk-wrapper");
        if (!wrapper) return;
        const chunkContent = wrapper.querySelector(".gemini-chunk-content");
        if (!chunkContent) return;
        const toggleBtn = banner.querySelector(".rg-chunk-toggle-btn");
        if (toggleBtn) {
            const showing = chunkContent.style.display !== "none";
            if (!showing) {
                chunkContent.style.display = "";
                toggleBtn.textContent = "Hide";
            }
        } else {
            chunkContent.style.display = "";
        }
        // Remove the warning so user doesn't see it again
        e.target.closest("[style*='rgba(239']")?.remove();
    }
});
```

- [ ] **Step 2: Add large-expansion guard to enhanced-content-banner.js**

In `src/content/modules/enhanced-content-banner.js`, find the word count display area inside the banner's `innerHTML` template (around line 103-114). After the word count span, add:

```js
const largeExpansionWarning = percentChange > 200
    ? `<div style="margin-top:6px;padding:6px 10px;background:rgba(239,68,68,0.1);border-left:3px solid #ef4444;border-radius:4px;font-size:12px;color:#fca5a5;">
        ⚠️ Very large expansion (+${Math.abs(percentChange)}%). Check if enhanced content is correct.
        <button class="rg-force-show-enhanced-btn" style="margin-left:8px;padding:2px 8px;background:#374151;color:#e5e7eb;border:1px solid #6b7280;border-radius:4px;cursor:pointer;font-size:11px;">Show Enhanced</button>
       </div>`
    : "";
```

Add `${largeExpansionWarning}` to the banner's `innerHTML` template after the word count span.

Then after the banner is created, add an event listener:

```js
const forceShowBtn = banner.querySelector(".rg-force-show-enhanced-btn");
if (forceShowBtn) {
    forceShowBtn.addEventListener("click", () => {
        // Trigger "Show Enhanced" — same as clicking the toggle btn when showing original
        const toggleBtn = banner.querySelector(".gemini-toggle-btn");
        if (toggleBtn && toggleBtn.textContent.includes("Show Enhanced")) {
            toggleBtn.click();
        }
        forceShowBtn.closest("[style*='rgba(239']")?.remove();
    });
}

return banner;
```

(This function currently ends with `return banner` — add these lines before it.)

- [ ] **Step 3: Add wordCountThreshold setting to library-settings.html**

Open `src/library/library-settings.html`. Find the AI settings section (search for "chunk" or "chunkSize"). Add this setting near the chunk size setting:

```html
<div class="setting-row">
    <label for="wordCountThreshold" class="setting-label">
        Word count change threshold (%)
        <span class="setting-hint">Show warning when enhanced content changes word count by more than this amount. Default: 25</span>
    </label>
    <input type="number" id="wordCountThreshold" class="setting-input"
           min="5" max="500" step="5" value="25" />
</div>
```

- [ ] **Step 4: Wire threshold setting in library-settings.js**

In `src/library/library-settings.js`, find where chunk settings are loaded (search for `chunkSizeWords` or `chunkSize`). Add the load/save for `wordCountThreshold`:

```js
// In the load function (where settings are read from storage):
const { wordCountThreshold = 25 } = await browser.storage.local.get("wordCountThreshold");
const thresholdInput = document.getElementById("wordCountThreshold");
if (thresholdInput) thresholdInput.value = wordCountThreshold;

// In the save function (where settings are written):
const newThreshold = parseInt(document.getElementById("wordCountThreshold")?.value || "25", 10);
if (!isNaN(newThreshold) && newThreshold >= 5) {
    await browser.storage.local.set({ wordCountThreshold: newThreshold });
}
```

- [ ] **Step 5: Build and lint**

```powershell
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```powershell
git add src/utils/chunking/chunk-ui.js src/content/modules/enhanced-content-banner.js src/library/library-settings.html src/library/library-settings.js
git commit -m "feat: Show Enhanced button for divergent content; configurable word count threshold in settings"
```

---

### Task 3: Long + Short summary stacking

**Files:**
- Modify: `src/utils/chunking/chunk-summary-ui.js:111-131` (add short container)
- Modify: `src/utils/summary-service.js:217-232` (container lookup)
- Modify: `src/content/content.js:1855-1867` (container selection)

Currently both long and short summaries write to the same `.gemini-summary-text-container`, so short overwrites long. The fix adds a sibling short-summary slot that the short path writes to while the long slot is untouched.

- [ ] **Step 1: Add the short-summary container in chunk-summary-ui.js**

Find the `buildTextContainer` function (line 111). After it, add:

```js
function buildShortTextContainer(groupStart, groupEnd, colors, extraClass = "") {
	const div = document.createElement("div");
	div.className =
		"gemini-short-summary-text-container" + (extraClass ? " " + extraClass : "");
	div.setAttribute("data-group-start", String(groupStart));
	div.setAttribute("data-group-end", String(groupEnd));
	div.style.cssText = `
		display: none;
		box-sizing: border-box;
		width: 100%;
		margin-top: 8px;
		padding: 10px 14px;
		border: 1px dashed ${colors.outline};
		border-radius: 4px;
		font-family: inherit;
		font-size: 0.93em;
		line-height: 1.6;
		color: ${colors.onSurface};
		text-align: left;
		word-break: break-word;
	`;

	const label = document.createElement("div");
	label.textContent = "Quick Summary";
	label.style.cssText = `font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: ${colors.primary}; margin-bottom: 6px;`;
	div.appendChild(label);

	const body = document.createElement("div");
	body.className = "gemini-short-summary-body";
	div.appendChild(body);

	return div;
}
```

- [ ] **Step 2: Append the short container in createSummaryButtonGroup**

Find the end of `createSummaryButtonGroup` (around line 195-197) where it reads:

```js
card.appendChild(row);
card.appendChild(buildTextContainer(startIndex, endIndex, colors));

return card;
```

Replace with:

```js
card.appendChild(row);
card.appendChild(buildTextContainer(startIndex, endIndex, colors));
card.appendChild(buildShortTextContainer(startIndex, endIndex, colors));

return card;
```

- [ ] **Step 3: Append the short container in createMainSummaryGroup**

Find the end of `createMainSummaryGroup` (around line 261-270) where it reads:

```js
card.appendChild(row);
card.appendChild(
    buildTextContainer(
        0,
        totalChunks - 1,
        colors,
        "gemini-main-summary-text",
    ),
);

return card;
```

Replace with:

```js
card.appendChild(row);
card.appendChild(
    buildTextContainer(0, totalChunks - 1, colors, "gemini-main-summary-text"),
);
card.appendChild(
    buildShortTextContainer(0, totalChunks - 1, colors, "gemini-main-short-summary-text"),
);

return card;
```

- [ ] **Step 4: Update findSummaryContainer in summary-service.js**

Find `findSummaryContainer` (line 217) which reads:

```js
function findSummaryContainer(startIdx, endIdx) {
    const all = document.querySelectorAll(".gemini-summary-text-container");
    for (const el of all) {
        const gs = parseInt(el.getAttribute("data-group-start"), 10);
        const ge = parseInt(el.getAttribute("data-group-end"), 10);
        if (gs === startIdx && ge === endIdx) return el;
    }
    return (
        document.querySelector(".gemini-main-summary-text") ||
        document.querySelector(
            ".gemini-summary-text-container[data-group-start='0']",
        ) ||
        null
    );
}
```

Replace with:

```js
function findSummaryContainer(startIdx, endIdx, isShort = false) {
    const cls = isShort
        ? ".gemini-short-summary-text-container"
        : ".gemini-summary-text-container";
    const all = document.querySelectorAll(cls);
    for (const el of all) {
        const gs = parseInt(el.getAttribute("data-group-start"), 10);
        const ge = parseInt(el.getAttribute("data-group-end"), 10);
        if (gs === startIdx && ge === endIdx) return el;
    }
    // Fallback
    if (isShort) {
        return (
            document.querySelector(".gemini-main-short-summary-text") ||
            document.querySelector(".gemini-short-summary-text-container[data-group-start='0']") ||
            null
        );
    }
    return (
        document.querySelector(".gemini-main-summary-text") ||
        document.querySelector(".gemini-summary-text-container[data-group-start='0']") ||
        null
    );
}
```

- [ ] **Step 5: Find where findSummaryContainer is called in summary-service.js**

```powershell
Select-String -Path "src\utils\summary-service.js" -Pattern "findSummaryContainer"
```

Update every call to pass the `isShort` value. The function signature in summary-service.js accepts `isShort` as a parameter already — look for the `summarize(chunkIndices, isShort)` export function and trace how it reaches `findSummaryContainer`. The call will look like:

```js
// Before:
const container = findSummaryContainer(startIdx, endIdx);
// After:
const container = findSummaryContainer(startIdx, endIdx, isShort);
```

- [ ] **Step 6: Update container selection in content.js**

In `src/content/content.js` at lines 1855–1867, find the `summaryTextContainer` assignment block:

```js
let summaryTextContainer;
if (isMainSummary) {
    summaryTextContainer =
        document.querySelector(".gemini-main-summary-text") ||
        document.querySelector(
            ".gemini-summary-text-container[data-group-start='0']",
        );
} else {
    summaryTextContainer = document.querySelector(
        `.gemini-summary-text-container[data-group-start="${groupStartIndex}"]`,
    );
}
```

Replace with:

```js
let summaryTextContainer;
const summaryContainerClass = isShort
    ? ".gemini-short-summary-text-container"
    : ".gemini-summary-text-container";
const mainSummaryClass = isShort
    ? ".gemini-main-short-summary-text"
    : ".gemini-main-summary-text";

if (isMainSummary) {
    summaryTextContainer =
        document.querySelector(mainSummaryClass) ||
        document.querySelector(
            `${summaryContainerClass}[data-group-start='0']`,
        );
} else {
    summaryTextContainer = document.querySelector(
        `${summaryContainerClass}[data-group-start="${groupStartIndex}"]`,
    );
}
```

- [ ] **Step 7: For the short container, render into the body child**

When writing text to the short container, the text goes into the `.gemini-short-summary-body` child, not the container directly (since the container has a "Quick Summary" label child). In `content.js`, after the `summaryTextContainer` assignment, add:

```js
// For short containers, render into the body div to avoid overwriting the label
const summaryRenderTarget = isShort
    ? (summaryTextContainer?.querySelector(".gemini-short-summary-body") || summaryTextContainer)
    : summaryTextContainer;
```

Then replace all subsequent uses of `summaryTextContainer` that write content with `summaryRenderTarget`. (The `style.display = "block"` still goes on `summaryTextContainer`.)

- [ ] **Step 8: Build and lint**

```powershell
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```powershell
git add src/utils/chunking/chunk-summary-ui.js src/utils/summary-service.js src/content/content.js
git commit -m "fix: long and short summaries stack instead of replacing each other"
```

---

### Task 4: NovelBin SPA navigation fix

**Files:**
- Modify: `src/content/content.js` — add navigation observer
- Modify: `src/utils/website-handlers/novelbin-handler.js` — add `refreshForCurrentUrl()`

When NovelBin uses pushState-style navigation (clicking Next Chapter changes the URL without a full reload), the content script is not re-executed and all buttons go stale.

- [ ] **Step 1: Add refreshForCurrentUrl to novelbin-handler.js**

Find the `isChapterPage()` method in `novelbin-handler.js` (around line 133). Add this method immediately after it:

```js
/**
 * Reset cached page-type state so isChapterPage() re-evaluates against
 * the current URL after a pushState/replaceState navigation.
 */
refreshForCurrentUrl() {
    // No cached state to clear in this handler — isChapterPage() always
    // reads window.location.pathname fresh.
    return this.isChapterPage();
}
```

- [ ] **Step 2: Add setupNavigationObserver to content.js**

Find the `initialize()` function in content.js (search for `async function initialize(`). Near the end of `initialize()`, before it returns, add a call to `setupNavigationObserver()`.

Add this function somewhere near `initialize` (before or after it, not inside):

```js
/**
 * Intercepts pushState/replaceState/popstate to detect in-page chapter
 * navigation (e.g. NovelBin's AJAX chapter loading) and re-init the UI.
 */
function setupNavigationObserver() {
    let lastUrl = window.location.href;
    let debounceTimer = null;

    function onNavigationChange() {
        const newUrl = window.location.href;
        if (newUrl === lastUrl) return;
        lastUrl = newUrl;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            if (!currentHandler) return;

            // Let the handler update its own state for the new URL
            if (typeof currentHandler.refreshForCurrentUrl === "function") {
                currentHandler.refreshForCurrentUrl();
            }

            if (!currentHandler.isChapterPage()) return;

            debugLog("[NavObserver] Chapter URL changed, re-initialising UI for:", newUrl);

            // Remove stale gemini UI before re-injecting
            const oldControls = document.getElementById("gemini-controls");
            if (oldControls) oldControls.remove();
            const oldChapterControls = document.getElementById("rg-chapter-novel-controls");
            if (oldChapterControls) oldChapterControls.remove();

            // Clear per-chapter state
            clearCachedEnhancementState?.();

            // Re-run the chapter UI setup path
            await autoExtractContent();
        }, 400);
    }

    // Patch history methods so pushState/replaceState fire our hook
    const origPush = history.pushState.bind(history);
    history.pushState = function (...args) {
        origPush(...args);
        onNavigationChange();
    };
    const origReplace = history.replaceState.bind(history);
    history.replaceState = function (...args) {
        origReplace(...args);
        onNavigationChange();
    };

    window.addEventListener("popstate", onNavigationChange);
    window.addEventListener("hashchange", onNavigationChange);
}
```

- [ ] **Step 3: Call setupNavigationObserver in initialize()**

Search for where `initialize()` ends (find `debugLog("Content script initialized")` or similar near the end). Add the call there:

```js
setupNavigationObserver();
debugLog("Navigation observer registered");
```

- [ ] **Step 4: Build and lint**

```powershell
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```powershell
git add src/content/content.js src/utils/website-handlers/novelbin-handler.js
git commit -m "fix: add SPA navigation observer for pushState chapter changes (NovelBin)"
```

---

### Task 5: NovelBin library modal — chapter count, tags, metadata

**Files:**
- Modify: `src/utils/website-handlers/novelbin-handler.js` — add tag extraction
- Modify: `src/library/websites/novelbin/novel-card.js` — render tags, chapter count

The NovelBin handler already extracts `chapterCount` from the info-meta list (lines 426-435 of the handler). It does NOT extract tags. The modal renders status, language, chapters, rating, source, views, updated — but is missing tags.

- [ ] **Step 1: Add tag extraction in novelbin-handler.js**

In `extractNovelMetadata()`, find the loop over `infoItems` (around line 404). The loop currently handles `author`, `genre`, `status`, `language`, `chapter`/`latest`. Add a `tag` handler inside the loop:

```js
} else if (label.includes("tag")) {
    li.querySelectorAll("a").forEach((a) => {
        const t = a.textContent.trim();
        if (t) metadata.tags.push(t);
    });
}
```

Also add tag extraction from the tag section that sometimes appears outside the info-meta list. After the `infoItems` loop, add:

```js
// Tags may also appear in a separate .tag-list or .genres section
if (!metadata.tags.length) {
    document.querySelectorAll(".tag-list a, .tag a, [class*='tag'] a").forEach((a) => {
        const t = a.textContent.trim();
        if (t && !metadata.genres.includes(t)) metadata.tags.push(t);
    });
}
```

- [ ] **Step 2: Add tags to SHELF_METADATA taxonomy**

In `NovelbinHandler.SHELF_METADATA` (around line 45), update the `taxonomy` array:

```js
taxonomy: [
    { id: "genres", label: "Genres", type: "array" },
    { id: "tags", label: "Tags", type: "array" },
    { id: "status", label: "Status", type: "string" },
    { id: "language", label: "Language", type: "string" },
],
```

- [ ] **Step 3: Render chapter count and tags in novel-card.js**

In `renderModalMetadata` in `src/library/websites/novelbin/novel-card.js`, find the `container.innerHTML = \`` block. The current modal HTML ends after the genres section. 

First, update the data extraction block near the top of `renderModalMetadata` (around line 122–136) to also get tags:

```js
const tags = Array.isArray(metadata.tags) ? metadata.tags : (Array.isArray(novel.tags) ? novel.tags : []);
```

Then add the tags section to the modal HTML, after the genres section:

```js
${tags.length ? `
<div class="site-modal-section">
    <h4 class="novelbin-section-title">Tags</h4>
    <div class="novelbin-genres-row">
        ${tags.map((t) => `<span class="novelbin-genre-tag novelbin-tag">${this.escapeHtml(t)}</span>`).join("")}
    </div>
</div>` : ""}
```

Also update the chapters section to show `?` only when `totalChapters` is 0 or null:

```js
// In the novelbin-primary-row — replace the totalChapters conditional:
<div class="novelbin-meta-group">
    <span class="novelbin-meta-label">Chapters</span>
    <span class="novelbin-meta-value">${totalChapters ? this.formatNumber(totalChapters) : "?"}</span>
</div>
```

(Remove the `${totalChapters ? ...}` wrapper so the Chapters field always shows, displaying `?` when unknown.)

- [ ] **Step 4: Add a subtle visual distinction for tags vs genres**

In `src/library/websites/novelbin/shelf-page.js`, find where `getNovelbinStyles()` is called or where NovelBin CSS is defined. Add this to differentiate tag chips from genre chips:

```js
// In the CSS (inside getNovelbinStyles or inline in modal-styles.js):
`.novelbin-tag {
    background: rgba(255, 152, 0, 0.15) !important;
    border-color: rgba(255, 152, 0, 0.4) !important;
    color: #ff9800 !important;
}`
```

Check where `getNovelbinStyles` is defined — it's in `src/library/websites/modal-styles.js`. Add this rule there.

- [ ] **Step 5: Build and lint**

```powershell
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```powershell
git add src/utils/website-handlers/novelbin-handler.js src/library/websites/novelbin/novel-card.js src/library/websites/modal-styles.js
git commit -m "feat: NovelBin modal — add tags, fix chapter count display, complete metadata"
```

---

### Task 6: Final validation

- [ ] **Step 1: Run emoji scan**

```powershell
npm run emoji:scan
```

Expected: `No suspicious mojibake tokens found.`

- [ ] **Step 2: Run lint and build**

```powershell
npm run lint && npm run build
```

Expected: 0 errors, both targets built.

- [ ] **Step 3: Load in Chromium and manually verify**

Load `dist/dist-chromium/` in `chrome://extensions` (Developer mode → Load unpacked).

Verify:
1. Open a NovelBin chapter page. The `#gemini-controls` bar has only "Hide Gemini UI" and (hidden) cancel button — NO "Enhance Chapter" button beside it. The enhance button appears only inside the summary banner.
2. On any chapter page: generate a Long Summary, then generate a Short Summary. Both appear — long stays, short appears below with "Quick Summary" label.
3. Run enhancement on a chapter that returns >100% expansion. Word count shows orange percentage.
4. On NovelBin, if Next Chapter uses pushState, buttons update after navigation. (Test: open browser devtools console, run `history.pushState({}, '', '/b/test-novel/chapter-2')`, wait 400ms — UI should attempt re-init.)
5. Open library, click a NovelBin novel. Modal shows Chapters as a number (not blank), and if the novel has tags, they appear in orange.

- [ ] **Step 4: Tag the build**

```powershell
git tag novelbin-ui-fixes-v1
```
