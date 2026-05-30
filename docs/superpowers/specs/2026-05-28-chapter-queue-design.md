# Spec 2: Chapter Queue + Multi-Summary View
> Date: 2026-05-28  
> Status: Approved

---

## Goal
Let users queue a chapter range on any supported novel. The extension fetches each chapter in the background (no visible tabs), chunks the content intelligently (grouping short chapters together), summarizes each unit, extracts entities, and sends to LoreWeave. A combined multi-chapter summary view is shown at the end, allowing users to skip "rough patches" without reading them.

---

## 1. Architecture Overview

```
User sets queue (novel URL + chapter range)
  → QueueManager stores jobs in browser.storage.local
  → Background service worker processes jobs sequentially
    → For each job: fetch HTML → DOMParser → handler.findContentArea()
    → Smart grouping: accumulate short chapters until batch fills chunk size
    → For each batch: summarize → extract entities → chronicle → (optional) LoreWeave
  → Queue progress tracked per-job
  → When all done: fire "queue-complete" notification
  → Popup "Queue" tab shows combined summary
```

**Key design decision: DOMParser not tabs.** Chapters are fetched with `fetch()` and parsed with `new DOMParser().parseFromString(html, 'text/html')`. The extension's existing handler methods (`findContentArea()`, `getChapterNavigation()`) work fine against a parsed document. No visible background tabs are created.

---

## 2. Smart Chapter Grouping

### Problem
Some chapters are very short (1000–1500 words) — far below the `DEFAULT_CHUNK_SIZE_WORDS` (3200). Processing each individually wastes API calls and produces thin summaries.

### Algorithm

```
SHORT_CHAPTER_THRESHOLD = Math.floor(DEFAULT_CHUNK_SIZE_WORDS / 2)  // 1600 words

pending_buffer = []
pending_word_count = 0

for each chapter in range:
  content = fetch + extract
  words = countWords(content)
  
  if words < SHORT_CHAPTER_THRESHOLD:
    pending_buffer.push({ chapterNum, content, words })
    pending_word_count += words
    
    if pending_word_count >= DEFAULT_CHUNK_SIZE_WORDS:
      flush(pending_buffer)  // process as one unit
      pending_buffer = []
      pending_word_count = 0
  else:
    if pending_buffer.length > 0:
      flush(pending_buffer)  // flush accumulated short chapters first
      pending_buffer = []
      pending_word_count = 0
    flush([{ chapterNum, content, words }])  // process full chapter standalone

// End of range: flush whatever remains (remainder handling)
if pending_buffer.length > 0:
  flush(pending_buffer)
```

### Flush unit output

`flush(batch)` produces:
- A combined summary covering all chapters in the batch
- Entity extraction across the combined text
- Chronicle records saved for each individual chapter in the batch (with the combined summary marked as a "batch summary", and the batch range noted)

---

## 3. Queue Storage

### Storage key: `rg_queue`

```js
{
  jobs: [
    {
      id: string,             // uuid
      novelId: string,
      novelTitle: string,
      novelUrl: string,       // base URL to derive chapter URLs from
      siteHandler: string,    // handler name for URL construction
      startChapter: number,
      endChapter: number,
      status: "pending"|"running"|"paused"|"done"|"error",
      progress: {
        current: number,      // last processed chapter
        total: number,
        processedChapters: number[],
        failedChapters: number[],
      },
      options: {
        sendToLoreWeave: boolean,
        writingStyle: string,
      },
      createdAt: number,
      completedAt: number | null,
      error: string | null,
    }
  ],
  activeJobId: string | null,
}
```

---

## 4. Queue Manager Module

New file: `src/background/loreweave/queue-manager.js`

Exports:
- `enqueueJob(jobConfig)` → adds to queue, returns jobId
- `startQueue()` → begins processing (called by background on startup and when job added)
- `pauseQueue()` → suspends after current chapter
- `resumeQueue()` → resumes from where paused
- `cancelJob(jobId)` → removes job, cleans up
- `getQueueStatus()` → returns current queue state
- `getJobResult(jobId)` → returns completed job's chapter summaries from chronicle

Processing happens in `processNextChapter()` called in a loop. Between chapters, the service worker checks for pause/cancel signals from storage.

---

## 5. Chapter URL Construction

Handler-based URL generation. Each handler that supports queuing implements:

```js
getChapterUrl(baseNovelUrl, chapterNumber)
```

For `novelbin-handler.js`: pattern is `/b/{slug}/chapter-{N}` or `/b/{slug}/{chapter-slug}` — requires fetching chapter list or using the prev/next navigation from the fetched page.

**Navigation approach:** For unknown chapter URL patterns, the queue follows `getChapterNavigation().nextUrl` from each fetched chapter. Starting from chapter `startChapter`'s URL, it follows `nextUrl` until reaching `endChapter` or running out. This works for any handler without needing URL template logic.

**Starting chapter URL**: the user provides the URL of the first chapter when creating the queue job. Subsequent chapters are discovered via `nextUrl`.

---

## 6. Multi-Chapter Summary View

### Where it lives

New panel in the existing popup "Queue" tab (new tab button in popup.html).

### Display structure

```
┌─ Novel Title ─────────────────────────────────────── [Export] ─┐
│ Chapters 42–67 · 26 chapters · queued 2 hours ago               │
│                                                                  │
│ [▼ Ch 42–44  (grouped · 3 short)]  The Sect Elder's Challenge…  │
│ [▼ Ch 45]    Li Wei awakens his secondary meridian…             │
│ [▼ Ch 46–47  (grouped)]  Tournament arc begins…                 │
│ ...                                                              │
│ [Show All Summaries] [Copy All] [Retry Failed]                   │
└──────────────────────────────────────────────────────────────────┘
```

Each entry is collapsible. Expanded shows the full chapter summary text.

"Export" button copies the combined summary as plain text to clipboard.

---

## 7. Queue UI in Popup

New tab: **"Queue"** (5th tab button in popup, after "Graph").

### Queue creation form

```
Novel URL (first chapter): [input]
Chapter range:  [start] to [end]
Send to LoreWeave: [checkbox]
Writing style: [dropdown]
[Add to Queue]
```

### Queue status list

Shows each job with progress bar (chapters done / total), status badge, and action buttons (pause / cancel / view results).

---

## 8. Background Processing Messages

New message actions for background ↔ popup communication:

| Action | Direction | Payload |
|---|---|---|
| `queue-add` | popup → bg | jobConfig |
| `queue-pause` | popup → bg | — |
| `queue-resume` | popup → bg | — |
| `queue-cancel` | popup → bg | { jobId } |
| `queue-status` | popup → bg | — |
| `queue-status-update` | bg → popup (push via port or storage watch) | status |

---

## 9. Error Handling

- **Fetch failure**: retry 2 times with 2s backoff, then mark chapter as `failed` and continue
- **AI error**: retry once, then mark failed
- **Short/empty content**: chapter < 100 words → skip + log as skipped
- **Service worker sleep**: queue state is in storage, so on wake-up `startQueue()` resumes from last processed chapter
- **Remainder chapters**: always flushed at end of range regardless of word count

---

## Files to create/modify

| Action | File |
|---|---|
| Create | `src/background/loreweave/queue-manager.js` |
| Create | `src/background/message-handlers/queue-handler.js` |
| Modify | `src/background/message-handlers/index.js` — register queue-handler |
| Modify | `src/popup/popup.html` — add Queue tab button + panel |
| Modify | `src/popup/popup.js` — Queue tab UI: form + job list + results view |
| Modify | `src/utils/website-handlers/novelbin-handler.js` — add `getChapterUrl()` or confirm nav-following works |
