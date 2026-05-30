# Spec 4: NovelBin + UI Fixes
> Date: 2026-05-28  
> Status: Approved

---

## Goal
Fix four concrete problems: (1) NovelBin SPA navigation leaves stale buttons, (2) duplicate Enhance Chapter button in the controls bar, (3) long + short summaries replace each other instead of stacking, (4) NovelBin library modals are incomplete. Also fix the 150% word-count colour threshold.

---

## 1. NovelBin SPA Navigation Fix

### Problem
When a user clicks "Next Chapter" on NovelBin, the URL changes and content updates via AJAX without a full page reload. The extension only initialises on page load, so enhancement buttons, cached content, and chapter detection all go stale.

### Solution: Navigation observer in content.js

Add a `setupNavigationObserver()` function called once during `initialize()` that attaches:

```js
// URL change detection (pushState / replaceState / popstate)
const _origPushState = history.pushState.bind(history);
history.pushState = function (...args) {
  _origPushState(...args);
  onNavigationChange();
};
const _origReplaceState = history.replaceState.bind(history);
history.replaceState = function (...args) {
  _origReplaceState(...args);
  onNavigationChange();
};
window.addEventListener("popstate", onNavigationChange);
window.addEventListener("hashchange", onNavigationChange);
```

`onNavigationChange()`:
1. Debounce 400ms (to let the new chapter DOM settle)
2. Call `currentHandler.refreshForCurrentUrl()` — a new optional method handlers can implement
3. If `currentHandler.isChapterPage()` is true for the new URL: call a trimmed-down re-init that:
   - Removes old `#gemini-controls` and summary banners
   - Clears cached enhancement state for the old chapter
   - Re-runs `autoExtractContent()` for the new chapter
   - Re-injects the UI controls
4. If the URL leaves the chapter: call `handleNonChapterPage()` as usual

### NovelBin handler addition

Add `refreshForCurrentUrl()` to `novelbin-handler.js`:
```js
refreshForCurrentUrl() {
  // Re-parse chapter info from the new URL without a page reload
  this._chapterPageDetected = null;
  return this.isChapterPage(); // re-evaluates
}
```

---

## 2. Remove Duplicate Enhance Chapter Button

### Problem
`injectUI()` in `ui-controls.js` (line 557–563) adds an `enhanceButton` to `controlsContainer` alongside the toggle-banners button. The chunking summary banner (`createMainSummaryGroup`) also has an Enhance button. This creates two Enhance buttons.

### Fix
In `injectUI()`, **always omit** the `enhanceButton` and `cancelButton` from `controlsContainer`. They already exist in the summary group banner. Only the `toggleBannersButton` stays in the top controls bar.

```js
// Before (lines 560-564):
if (getHandlerType() !== HANDLER_TYPES.CHAPTER_EMBEDDED) {
  if (toggleBannersButton) controlsContainer.appendChild(toggleBannersButton);
  if (enhanceButton) controlsContainer.appendChild(enhanceButton);
  if (cancelButton) controlsContainer.appendChild(cancelButton);
}

// After:
if (getHandlerType() !== HANDLER_TYPES.CHAPTER_EMBEDDED) {
  if (toggleBannersButton) controlsContainer.appendChild(toggleBannersButton);
  // enhanceButton and cancelButton live in the summary banner — not duplicated here
}
```

The `cancelButton` still needs to be accessible when enhancement is running. **Solution:** the cancel button is moved into the summary banner section (inside `createMainSummaryGroup`). When enhancement starts, the summary banner shows the cancel button; when it completes, it goes back to the enhance button.

---

## 3. Long + Short Summary Stacking

### Problem
When a user first generates a long summary and then generates a short one, `summary-runtime.js` calls `replaceSummaryContent()` which overwrites the long summary container with the short one.

### Fix
Change the summary display to use two distinct DOM slots within the same summary container:

```html
<div class="rg-summary-container">
  <div class="rg-long-summary" hidden></div>
  <div class="rg-short-summary" hidden></div>
</div>
```

When a long summary arrives → populate `rg-long-summary`, show it. Short summary stays hidden.  
When a short summary arrives → populate `rg-short-summary`, show it **below** the long one. If long is already visible, both are shown simultaneously with a visual separator.

**In `summary-runtime.js`:** split `setSummaryContent(text, isShort)` logic into `setLongSummary(text)` and `setShortSummary(text)`. Each writes to its own slot without touching the other.

The existing `clearSummary()` clears both.

Visual treatment: the short summary block gets a header "Quick Summary" in a lighter style; the long summary gets "Full Summary". A thin divider separates them when both are present.

---

## 4. NovelBin Library Modal Completion

### Currently missing vs Ranobes
- Chapter numbers in modal (show `?` currently)
- Tags system (NovelBin site does have tags — need to scrape)
- Translation status field
- Word count
- Published / updated dates
- Views count
- Word-count and tag filtering in shelf page
- Additional sort options (favourites, follows, updated)

### Implementation plan

#### 4a. Chapter number extraction
`novelbin-handler.js` `getChapterNavigation()` always returns `totalChapters: 0`. Fix: scrape chapter count from the novel page (not chapter page). The novel page at `/b/{slug}` has a chapter list or a chapter count element.

Add `extractTotalChapterCount()` to the handler that fetches the novel page lazily if not already fetched and extracts the chapter count.

In `novelbin/novel-card.js`: display the actual chapter count instead of `?`.

#### 4b. Tags
The NovelBin novel page contains genre tags in `.tag-list` or similar selector. Add `extractTags()` to the handler. Store alongside `genres` in novel metadata.

In `novelbin/shelf-page.js`: add tag filter UI matching the Ranobes pattern.

#### 4c. Metadata fields
Add to `extractNovelMetadata()` in `novelbin-handler.js`:
- `translationStatus` — parse "Ongoing" / "Completed" / "Hiatus"
- `wordCount` — parse if shown on site, else `null`
- `publishedDate` — parse if shown
- `updatedDate` — parse from "Latest Chapter" timestamp
- `views` — parse if shown on site, else `null`

In `novelbin/novel-card.js`: render new fields in the modal matching Ranobes layout.

#### 4d. Additional sort options
In `novelbin/shelf-page.js`: add sort options for `updated`, `added` (already there), and `title` (already there). Add `chapters` sort (already there). Missing: `updated` sort — add using `updatedDate` metadata.

---

## 5. Word Count Colour Threshold Fix

### Problem
`enhanced-content-banner.js` (line 107): any positive word count change is shown in green (`#28a745`). A +150% expansion (2.5x content) may indicate AI padding, not quality improvement.

### Fix: Three-tier colour coding

```js
function wordCountColor(percentChange) {
  if (percentChange < 0) return "#dc3545";     // red: content removed
  if (percentChange <= 40) return "#28a745";   // green: normal expansion
  if (percentChange <= 100) return "#ff9800";  // orange: notable expansion
  return "#ef5350";                            // red-orange: >100% — possible padding
}
```

Also add a tooltip title on the word count span:
- ≤40%: "Normal enhancement"
- ≤100%: "Significant expansion — review quality"
- >100%: "Very large expansion — may indicate AI padding"

---

## Files to modify

| File | Change |
|---|---|
| `src/content/content.js` | Add `setupNavigationObserver()`, call in `initialize()` |
| `src/utils/website-handlers/novelbin-handler.js` | Add `refreshForCurrentUrl()`, fix `totalChapters`, add `extractTags()`, add metadata fields |
| `src/content/modules/ui-controls.js` | Remove enhance + cancel from top controls bar |
| `src/content/modules/summary-runtime.js` | Split into long/short slots, no replace |
| `src/content/modules/enhanced-content-banner.js` | Three-tier word count colour |
| `src/library/websites/novelbin/novel-card.js` | Add chapter count, tags, metadata fields |
| `src/library/websites/novelbin/shelf-page.js` | Add tag filter, additional sort options |
