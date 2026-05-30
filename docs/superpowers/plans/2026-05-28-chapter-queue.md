# Chapter Queue + Multi-Summary View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users queue a chapter range on any supported novel. The extension fetches each chapter using `fetch()` + `DOMParser` (no visible tabs), groups short chapters together until they fill one chunk, summarizes each batch, extracts entities, saves to the chronicle, and shows a combined multi-chapter summary in a new popup "Queue" tab.

**Architecture:** `queue-manager.js` owns all state (stored in `browser.storage.local` under `rg_queue`) and sequential processing. `queue-handler.js` bridges popup ↔ background. Smart grouping accumulates chapters below half-chunk-size until the buffer fills. Navigation follows the handler's `nextUrl` chain starting from the user-supplied first-chapter URL. The popup Queue tab shows job list and per-job combined summary.

**Tech Stack:** Plain JS, browser extension service worker, `fetch()` + `DOMParser`, `browser.storage.local`, existing handler system.

---

### Task 1: Create queue-manager.js

**Files:**
- Create: `src/background/loreweave/queue-manager.js`

- [ ] **Step 1: Create the file**

```js
/**
 * Queue Manager — processes chapter ranges in the background.
 *
 * Storage key: rg_queue
 * {
 *   jobs: [{ id, novelId, novelTitle, firstChapterUrl, siteHandlerName,
 *             startChapter, endChapter, status, progress, options,
 *             createdAt, completedAt, error }],
 *   activeJobId: string|null
 * }
 */

import { graphifyChapter } from "./graphify-service.js";
import {
    saveChapterRecord,
    getRecentSummaries,
} from "./chronicle-storage.js";

const QUEUE_KEY = "rg_queue";
const SHORT_CHAPTER_THRESHOLD_WORDS = 1600; // half of DEFAULT_CHUNK_SIZE_WORDS (3200)
const CHAPTER_FETCH_RETRY = 2;
const CHAPTER_FETCH_BACKOFF_MS = 2000;
const MIN_CHAPTER_WORDS = 100; // chapters below this are skipped

let _processing = false;

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function loadQueue() {
    const stored = await browser.storage.local.get(QUEUE_KEY);
    return stored[QUEUE_KEY] || { jobs: [], activeJobId: null };
}

async function saveQueue(queue) {
    await browser.storage.local.set({ [QUEUE_KEY]: queue });
}

async function updateJob(jobId, patch) {
    const queue = await loadQueue();
    const idx = queue.jobs.findIndex((j) => j.id === jobId);
    if (idx === -1) return;
    queue.jobs[idx] = { ...queue.jobs[idx], ...patch };
    await saveQueue(queue);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function enqueueJob(jobConfig) {
    const id = `rg_job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job = {
        id,
        novelId: jobConfig.novelId || "",
        novelTitle: jobConfig.novelTitle || "Unknown Novel",
        firstChapterUrl: jobConfig.firstChapterUrl,
        siteHandlerName: jobConfig.siteHandlerName || "",
        startChapter: jobConfig.startChapter || 1,
        endChapter: jobConfig.endChapter || 1,
        status: "pending",
        progress: {
            current: 0,
            total: (jobConfig.endChapter || 1) - (jobConfig.startChapter || 1) + 1,
            processedChapters: [],
            failedChapters: [],
            skippedChapters: [],
        },
        options: {
            sendToLoreWeave: jobConfig.sendToLoreWeave !== false,
            writingStyle: jobConfig.writingStyle || "other",
            domainId: jobConfig.domainId || "",
        },
        createdAt: Date.now(),
        completedAt: null,
        error: null,
    };

    const queue = await loadQueue();
    queue.jobs.push(job);
    await saveQueue(queue);

    // Start processing if not already running
    if (!_processing) {
        startQueue().catch(console.error);
    }

    return id;
}

export async function startQueue() {
    if (_processing) return;
    _processing = true;
    try {
        await _processLoop();
    } finally {
        _processing = false;
    }
}

export async function pauseQueue() {
    const queue = await loadQueue();
    if (queue.activeJobId) {
        await updateJob(queue.activeJobId, { status: "paused" });
    }
    _processing = false;
}

export async function resumeQueue() {
    if (!_processing) {
        startQueue().catch(console.error);
    }
}

export async function cancelJob(jobId) {
    const queue = await loadQueue();
    const idx = queue.jobs.findIndex((j) => j.id === jobId);
    if (idx === -1) return;
    queue.jobs.splice(idx, 1);
    if (queue.activeJobId === jobId) queue.activeJobId = null;
    await saveQueue(queue);
}

export async function getQueueStatus() {
    return loadQueue();
}

// ─── Processing loop ─────────────────────────────────────────────────────────

async function _processLoop() {
    while (true) {
        const queue = await loadQueue();
        const nextJob = queue.jobs.find(
            (j) => j.status === "pending" || j.status === "running",
        );
        if (!nextJob) break;

        // Check for pause/cancel signal
        if (nextJob.status === "paused") break;

        await _processJob(nextJob);
    }
}

async function _processJob(job) {
    await updateJob(job.id, { status: "running" });
    const queue = await loadQueue();
    queue.activeJobId = job.id;
    await saveQueue(queue);

    try {
        const config = await _loadConfig();
        await _processChapters(job, config);
        await updateJob(job.id, { status: "done", completedAt: Date.now() });
    } catch (err) {
        await updateJob(job.id, { status: "error", error: err.message });
    }

    const q = await loadQueue();
    q.activeJobId = null;
    await saveQueue(q);
}

async function _processChapters(job, config) {
    let currentUrl = job.firstChapterUrl;
    let chapterNum = job.startChapter;
    let buffer = []; // { chapterNum, content, words }
    let bufferWords = 0;

    while (chapterNum <= job.endChapter && currentUrl) {
        // Check for pause/cancel
        const q = await loadQueue();
        const current = q.jobs.find((j) => j.id === job.id);
        if (!current || current.status === "paused") return;

        const { content, nextUrl, words } = await _fetchChapter(currentUrl, chapterNum);

        if (!content || words < MIN_CHAPTER_WORDS) {
            await updateJob(job.id, {
                "progress.skippedChapters": [
                    ...(current.progress.skippedChapters || []),
                    chapterNum,
                ],
            });
        } else if (words < SHORT_CHAPTER_THRESHOLD_WORDS) {
            // Accumulate short chapter into buffer
            buffer.push({ chapterNum, content, words });
            bufferWords += words;

            if (bufferWords >= 3200 || chapterNum === job.endChapter) {
                await _flushBuffer(buffer, job, config);
                buffer = [];
                bufferWords = 0;
            }
        } else {
            // Flush any pending short chapters first
            if (buffer.length > 0) {
                await _flushBuffer(buffer, job, config);
                buffer = [];
                bufferWords = 0;
            }
            await _flushBuffer([{ chapterNum, content, words }], job, config);
        }

        await updateJob(job.id, {
            progress: {
                ...(await loadQueue()).jobs.find((j) => j.id === job.id)?.progress,
                current: chapterNum,
                processedChapters: [
                    ...(current.progress.processedChapters || []),
                    chapterNum,
                ],
            },
        });

        currentUrl = nextUrl;
        chapterNum++;
    }

    // Flush remainder
    if (buffer.length > 0) {
        await _flushBuffer(buffer, job, config);
    }
}

async function _flushBuffer(batch, job, config) {
    if (!batch.length) return;

    const combinedText = batch.map((b) => b.content).join("\n\n---\n\n");
    const firstChapter = batch[0].chapterNum;
    const lastChapter = batch[batch.length - 1].chapterNum;
    const epochLabel =
        batch.length === 1
            ? `Chapter ${String(firstChapter).padStart(4, "0")}`
            : `Chapters ${firstChapter}–${lastChapter}`;

    // Summarize
    let summary = "";
    try {
        summary = await _generateSummary(combinedText, config, epochLabel);
    } catch (err) {
        console.warn(`[Queue] Summary failed for ${epochLabel}:`, err.message);
    }

    // Graphify + save to chronicle
    if (job.options.sendToLoreWeave && job.novelId) {
        try {
            const graphifyConfig = {
                ...config,
                loreWeaveUrl: job.options.loreWeaveUrl || config.loreWeaveUrl,
                loreWeaveDomainId: job.options.domainId || config.loreWeaveDomainId,
                loreWeaveWritingStyle: job.options.writingStyle,
                loreWeaveChronicleEnabled: true,
                loreWeaveNovelId: job.novelId,
            };
            await graphifyChapter(combinedText, graphifyConfig, firstChapter, epochLabel);
        } catch (err) {
            console.warn(`[Queue] Graphify failed for ${epochLabel}:`, err.message);
        }
    }

    // Save summaries for each individual chapter in the batch
    for (const { chapterNum } of batch) {
        await saveChapterRecord(job.novelId, chapterNum, {
            chapterLabel: `Chapter ${String(chapterNum).padStart(4, "0")}`,
            summary: batch.length > 1 ? `[Part of batch ${epochLabel}] ${summary}` : summary,
            shortSummary: "",
            entities: [],
            edges: [],
            graphified: job.options.sendToLoreWeave,
            domainId: job.options.domainId || config.loreWeaveDomainId,
        });
    }
}

// ─── Chapter fetching ─────────────────────────────────────────────────────────

async function _fetchChapter(url, chapterNum) {
    let lastErr;
    for (let attempt = 0; attempt <= CHAPTER_FETCH_RETRY; attempt++) {
        try {
            if (attempt > 0) {
                await new Promise((r) => setTimeout(r, CHAPTER_FETCH_BACKOFF_MS));
            }
            const res = await fetch(url, { credentials: "omit" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, "text/html");

            // Extract content using the same selectors the handler uses
            const contentEl =
                doc.querySelector("#chr-content") ||
                doc.querySelector(".chr-c") ||
                doc.querySelector("article") ||
                doc.querySelector(".chapter-content") ||
                doc.body;

            // Remove noise
            contentEl?.querySelectorAll("script,style,ins,[class*=ads],[id*=ads]")
                .forEach((el) => el.remove());

            const content = (contentEl?.innerText || contentEl?.textContent || "").trim();
            const words = content.split(/\s+/).filter(Boolean).length;

            // Find next chapter URL
            const nextEl =
                doc.querySelector('a.js-chapter-nav[data-chapter-nav="next"]') ||
                doc.querySelector('a[rel="next"]') ||
                doc.querySelector(".chr-nav a:last-child");
            let nextUrl = nextEl?.getAttribute("data-chapter-url") || nextEl?.href || null;
            if (nextUrl && !nextUrl.startsWith("http")) {
                nextUrl = new URL(nextUrl, url).href;
            }

            return { content, nextUrl, words };
        } catch (err) {
            lastErr = err;
        }
    }
    console.warn(`[Queue] Failed to fetch chapter ${chapterNum} after retries:`, lastErr?.message);
    return { content: "", nextUrl: null, words: 0 };
}

// ─── AI summary ───────────────────────────────────────────────────────────────

async function _generateSummary(text, config, epochLabel) {
    const apiKey = config.apiKey;
    if (!apiKey) return "";

    const modelEndpoint =
        config.modelEndpoint ||
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    const prompt = `Summarise the following novel chapter(s) in 2–4 paragraphs covering: main events, character actions, key reveals, and any important world-building. Label: ${epochLabel}.\n\n${text.slice(0, 80_000)}`;

    const res = await fetch(`${modelEndpoint}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
    });

    if (!res.ok) return "";
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

// ─── Config helper ────────────────────────────────────────────────────────────

async function _loadConfig() {
    const data = await browser.storage.local.get();
    return data || {};
}
```

- [ ] **Step 2: Build and lint**

```powershell
cd V:\Code\ProjectCode\RanobesGemini
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```powershell
git add src/background/loreweave/queue-manager.js
git commit -m "feat: add queue-manager.js — background chapter fetch, smart grouping, summarize+graphify"
```

---

### Task 2: Create queue-handler.js and register it

**Files:**
- Create: `src/background/message-handlers/queue-handler.js`
- Modify: `src/background/message-handlers/index.js`

- [ ] **Step 1: Create queue-handler.js**

```js
import {
    enqueueJob,
    pauseQueue,
    resumeQueue,
    cancelJob,
    getQueueStatus,
    startQueue,
} from "../loreweave/queue-manager.js";

export default {
    action: "queue",

    handler(message, sendResponse) {
        const { subAction } = message;

        const p = (() => {
            switch (subAction) {
                case "add":    return enqueueJob(message.job);
                case "pause":  return pauseQueue();
                case "resume": return resumeQueue();
                case "cancel": return cancelJob(message.jobId);
                case "status": return getQueueStatus();
                case "start":  return startQueue();
                default:       return Promise.resolve({ error: `Unknown subAction: ${subAction}` });
            }
        })();

        p.then((result) => sendResponse({ success: true, result }))
            .catch((err) => sendResponse({ success: false, error: err.message }));

        return true;
    },
};
```

- [ ] **Step 2: Register in index.js**

In `src/background/message-handlers/index.js`, add the import and register:

```js
import queueHandler from "./queue-handler.js";

// In the handlers array:
const handlers = [
    metadataHandler,
    settingsHandler,
    updateHandler,
    loreWeaveHandler,
    loreWeavePingHandler,
    queueHandler,
];
```

- [ ] **Step 3: Build and lint**

```powershell
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```powershell
git add src/background/message-handlers/queue-handler.js src/background/message-handlers/index.js
git commit -m "feat: add queue message handler and register it"
```

---

### Task 3: Add Queue tab to popup

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.js`

- [ ] **Step 1: Add Queue tab button in popup.html**

Find the existing tab buttons (Graph tab is the last one). Add after it:

```html
<button class="tab-btn" data-tab="queue" id="queueTabBtn">Queue</button>
```

- [ ] **Step 2: Add Queue tab panel in popup.html**

Before the `<!-- Resize -->` comment, add:

```html
<!-- Queue Tab -->
<div class="tab-content" id="queue">
    <div class="config-section">
        <h3 class="config-section-title">Chapter Queue</h3>
        <div class="config-section-content">
            <p class="settings-desc">
                Queue a chapter range to fetch, summarise, and graphify in the background.
            </p>

            <div class="config-item">
                <label for="qFirstUrl">First Chapter URL</label>
                <input type="url" id="qFirstUrl" class="config-input" placeholder="https://novelbin.com/b/novel-slug/chapter-1" />
            </div>

            <div class="config-item" style="display:flex;gap:8px">
                <div style="flex:1">
                    <label for="qStart">Start Chapter</label>
                    <input type="number" id="qStart" class="config-input" placeholder="1" min="1" />
                </div>
                <div style="flex:1">
                    <label for="qEnd">End Chapter</label>
                    <input type="number" id="qEnd" class="config-input" placeholder="50" min="1" />
                </div>
            </div>

            <div class="config-item">
                <label class="check-label">
                    <input type="checkbox" id="qSendToLW" checked />
                    <span>Send to LoreWeave</span>
                </label>
            </div>

            <button id="qAddBtn" class="btn-primary-full">Add to Queue</button>

            <div id="qJobList" style="margin-top:10px"></div>
        </div>
    </div>

    <!-- Result view -->
    <div id="qResultView" class="config-section" style="display:none">
        <h3 class="config-section-title" id="qResultTitle">Queue Results</h3>
        <div id="qResultContent" style="max-height:300px;overflow-y:auto;font-size:12px;line-height:1.5"></div>
        <button id="qResultClose" class="btn-secondary" style="margin-top:8px">Back to Queue</button>
    </div>
</div>
```

- [ ] **Step 3: Add Queue tab logic to popup.js**

At the end of the popup initialization function (just before the closing `}`), add:

```js
// ── Queue tab ─────────────────────────────────────────────────────────────────
const qFirstUrl = document.getElementById("qFirstUrl");
const qStart = document.getElementById("qStart");
const qEnd = document.getElementById("qEnd");
const qSendToLW = document.getElementById("qSendToLW");
const qAddBtn = document.getElementById("qAddBtn");
const qJobList = document.getElementById("qJobList");
const qResultView = document.getElementById("qResultView");
const qResultTitle = document.getElementById("qResultTitle");
const qResultContent = document.getElementById("qResultContent");
const qResultClose = document.getElementById("qResultClose");

async function refreshQueueList() {
    if (!qJobList) return;
    const resp = await browser.runtime.sendMessage({ action: "queue", subAction: "status" });
    const jobs = resp?.result?.jobs || [];
    qJobList.textContent = "";

    if (!jobs.length) {
        qJobList.textContent = "No jobs queued.";
        return;
    }

    for (const job of jobs) {
        const row = document.createElement("div");
        row.style.cssText = "padding:6px 0;border-bottom:1px solid #333;font-size:12px;";
        const done = job.progress?.processedChapters?.length ?? 0;
        const total = job.progress?.total ?? 0;
        const pct = total ? Math.round((done / total) * 100) : 0;

        const titleSpan = document.createElement("div");
        titleSpan.style.fontWeight = "bold";
        titleSpan.textContent = `${job.novelTitle} · Ch ${job.startChapter}–${job.endChapter}`;

        const statusSpan = document.createElement("span");
        statusSpan.style.cssText = "margin-left:6px;font-size:11px;";
        statusSpan.textContent = `[${job.status}] ${done}/${total} (${pct}%)`;

        const actions = document.createElement("div");
        actions.style.marginTop = "4px";

        if (job.status === "running") {
            const pauseBtn = document.createElement("button");
            pauseBtn.className = "btn-secondary";
            pauseBtn.style.fontSize = "11px";
            pauseBtn.textContent = "Pause";
            pauseBtn.addEventListener("click", async () => {
                await browser.runtime.sendMessage({ action: "queue", subAction: "pause" });
                setTimeout(refreshQueueList, 500);
            });
            actions.appendChild(pauseBtn);
        } else if (job.status === "paused") {
            const resumeBtn = document.createElement("button");
            resumeBtn.className = "btn-secondary";
            resumeBtn.style.fontSize = "11px";
            resumeBtn.textContent = "Resume";
            resumeBtn.addEventListener("click", async () => {
                await browser.runtime.sendMessage({ action: "queue", subAction: "resume" });
                setTimeout(refreshQueueList, 500);
            });
            actions.appendChild(resumeBtn);
        } else if (job.status === "done") {
            const viewBtn = document.createElement("button");
            viewBtn.className = "btn-secondary";
            viewBtn.style.fontSize = "11px";
            viewBtn.textContent = "View Summaries";
            viewBtn.addEventListener("click", () => showResults(job));
            actions.appendChild(viewBtn);
        }

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "btn-secondary";
        cancelBtn.style.cssText = "font-size:11px;margin-left:6px;color:#ef5350;";
        cancelBtn.textContent = "Remove";
        cancelBtn.addEventListener("click", async () => {
            await browser.runtime.sendMessage({
                action: "queue",
                subAction: "cancel",
                jobId: job.id,
            });
            setTimeout(refreshQueueList, 200);
        });
        actions.appendChild(cancelBtn);

        row.appendChild(titleSpan);
        row.appendChild(statusSpan);
        row.appendChild(actions);
        qJobList.appendChild(row);
    }
}

async function showResults(job) {
    if (!qResultView || !qResultContent || !qResultTitle) return;
    qResultTitle.textContent = `${job.novelTitle} · Ch ${job.startChapter}–${job.endChapter}`;
    qResultContent.textContent = "Loading summaries…";
    qResultView.style.display = "block";

    const key = `rg_chronicle_${job.novelId}`;
    const stored = await browser.storage.local.get(key);
    const chronicle = stored[key];
    if (!chronicle?.chapters) {
        qResultContent.textContent = "No summaries found in chronicle.";
        return;
    }

    qResultContent.textContent = "";
    const chapters = Object.values(chronicle.chapters)
        .filter((c) => c.chapterNum >= job.startChapter && c.chapterNum <= job.endChapter)
        .sort((a, b) => a.chapterNum - b.chapterNum);

    for (const ch of chapters) {
        const block = document.createElement("div");
        block.style.cssText = "margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #333;";

        const heading = document.createElement("strong");
        heading.textContent = ch.chapterLabel;
        block.appendChild(heading);

        if (ch.summary) {
            const p = document.createElement("p");
            p.style.cssText = "margin:4px 0 0;white-space:pre-wrap;";
            p.textContent = ch.summary;
            block.appendChild(p);
        }

        qResultContent.appendChild(block);
    }
}

if (qAddBtn) {
    qAddBtn.addEventListener("click", async () => {
        const firstUrl = qFirstUrl?.value?.trim();
        const start = parseInt(qStart?.value, 10);
        const end = parseInt(qEnd?.value, 10);

        if (!firstUrl || isNaN(start) || isNaN(end) || start > end) {
            alert("Please fill in a valid first chapter URL and chapter range.");
            return;
        }

        const stored = await browser.storage.local.get(["loreWeaveUrl", "loreWeaveDomainId", "loreWeaveToken"]);
        const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

        await browser.runtime.sendMessage({
            action: "queue",
            subAction: "add",
            job: {
                novelId: `queue_${Date.now()}`,
                novelTitle: activeTab?.title || "Novel",
                firstChapterUrl: firstUrl,
                startChapter: start,
                endChapter: end,
                sendToLoreWeave: qSendToLW?.checked !== false,
                loreWeaveUrl: stored.loreWeaveUrl || "",
                domainId: stored.loreWeaveDomainId || "",
            },
        });

        if (qFirstUrl) qFirstUrl.value = "";
        setTimeout(refreshQueueList, 300);
    });
}

if (qResultClose) {
    qResultClose.addEventListener("click", () => {
        if (qResultView) qResultView.style.display = "none";
    });
}

// Refresh job list when Queue tab is opened
document.querySelectorAll(".tab-btn[data-tab='queue']").forEach((btn) => {
    btn.addEventListener("click", refreshQueueList);
});
```

- [ ] **Step 4: Build, lint, emoji scan**

```powershell
npm run lint && npm run build && npm run emoji:scan
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```powershell
git add src/popup/popup.html src/popup/popup.js
git commit -m "feat: add Queue tab to popup with job management and summary view"
```

---

### Task 4: Final validation

- [ ] **Step 1: Build and lint**

```powershell
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 2: Manual smoke test**

Load `dist/dist-chromium/`. Open the popup → Queue tab. Fill in a NovelBin first chapter URL, chapters 1–3, click Add to Queue. In DevTools → Application → Storage → Local Storage, watch for `rg_queue` key updating as chapters are fetched. After completion, click View Summaries to confirm chapter summaries appear.
