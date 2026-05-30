# AI Story Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Chat" tab to the popup that lets users ask questions about a novel using the local story chronicle and LoreWeave entity graph as context. Answers come from Gemini at temperature 0.3 using assembled prior chapter summaries + entity excerpts.

**Architecture:** `chat-handler.js` in background assembles context from `chronicle-storage.js`, calls Gemini directly (same pattern as `graphify-service.js`), and keeps a conversation history for follow-up questions. The popup Chat tab handles message display and the send flow. Novel context (which novel is currently open) is detected from the active tab via a message to the content script.

**Tech Stack:** Plain JS, `browser.storage.local`, Gemini REST API, popup DOM.

---

### Task 1: Create chat-handler.js

**Files:**
- Create: `src/background/message-handlers/chat-handler.js`

- [ ] **Step 1: Create the file**

```js
/**
 * Background handler for story chat.
 *
 * Message: { action: "story-chat", question, novelId, conversationHistory }
 * Response: { success, answer, conversationHistory }
 */

import { loadChronicle, getEntityIndex } from "../loreweave/chronicle-storage.js";

const MAX_CONTEXT_CHARS = 12_000;
const MAX_HISTORY_PAIRS = 6;

export default {
    action: "story-chat",

    handler(message, sendResponse) {
        const { question, novelId, conversationHistory = [] } = message;

        _buildResponse(question, novelId, conversationHistory)
            .then(({ answer, updatedHistory }) =>
                sendResponse({ success: true, answer, conversationHistory: updatedHistory })
            )
            .catch((err) => sendResponse({ success: false, error: err.message }));

        return true;
    },
};

async function _buildResponse(question, novelId, history) {
    const config = await browser.storage.local.get();

    const apiKey = config.apiKey;
    if (!apiKey) throw new Error("No Gemini API key configured.");

    const novelTitle = config.lw_novel_title || "this novel";
    const contextBlock = novelId
        ? await _assembleContext(novelId, question)
        : "(No story context available — enhance or queue some chapters first.)";

    const modelEndpoint =
        config.modelEndpoint ||
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    const systemPrompt = `You are a story assistant for "${novelTitle}".
Answer questions using ONLY the provided story context.
If the answer is not in the context, say so clearly.
Keep answers concise (2-4 sentences unless detail is needed).

## Story context
${contextBlock}`;

    // Build conversation turns (keep last N pairs)
    const trimmedHistory = history.slice(-(MAX_HISTORY_PAIRS * 2));
    const contents = [
        ...trimmedHistory,
        { role: "user", parts: [{ text: question }] },
    ];

    const res = await fetch(`${modelEndpoint}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Gemini error ${res.status}: ${body.slice(0, 100)}`);
    }

    const data = await res.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No answer generated.";

    const updatedHistory = [
        ...trimmedHistory,
        { role: "user", parts: [{ text: question }] },
        { role: "model", parts: [{ text: answer }] },
    ];

    return { answer, updatedHistory };
}

async function _assembleContext(novelId, question) {
    const chronicle = await loadChronicle(novelId);
    if (!chronicle) return "(No chronicle data found for this novel.)";

    const chapters = Object.values(chronicle.chapters || {})
        .filter((c) => c.summary)
        .sort((a, b) => a.chapterNum - b.chapterNum);

    if (!chapters.length) return "(No chapter summaries found yet.)";

    // If question mentions chapter numbers, prefer those chapters
    const chapterMentions = [...(question.matchAll(/ch(?:apter)?\s*(\d+)/gi) || [])].map((m) =>
        parseInt(m[1], 10)
    );

    let selectedChapters;
    if (chapterMentions.length > 0) {
        // Include mentioned chapters + 2 context chapters around each
        const expanded = new Set();
        for (const num of chapterMentions) {
            for (let n = num - 2; n <= num + 2; n++) expanded.add(n);
        }
        selectedChapters = chapters.filter((c) => expanded.has(c.chapterNum));
        // Fallback to recent if no matches
        if (!selectedChapters.length) selectedChapters = chapters.slice(-10);
    } else {
        // No specific chapters mentioned — use 10 most recent + 5 earliest for world context
        const earliest = chapters.slice(0, 5);
        const recent = chapters.slice(-10);
        const combined = [...new Map([...earliest, ...recent].map((c) => [c.chapterNum, c])).values()];
        selectedChapters = combined.sort((a, b) => a.chapterNum - b.chapterNum);
    }

    // Build context string up to MAX_CONTEXT_CHARS
    let context = "";
    for (const ch of selectedChapters) {
        const line = `[${ch.chapterLabel}] ${ch.summary}\n`;
        if ((context + line).length > MAX_CONTEXT_CHARS) break;
        context += line;
    }

    // Append relevant entity names from entity index
    const entityIndex = await getEntityIndex(novelId);
    const entityNames = Object.values(entityIndex)
        .slice(0, 30)
        .map((e) => `${e.name} (${e.type})`)
        .join(", ");
    if (entityNames) {
        context += `\n\n## Known entities\n${entityNames}`;
    }

    return context || "(Chronicle exists but no summaries available.)";
}
```

- [ ] **Step 2: Register in index.js**

In `src/background/message-handlers/index.js`, add:

```js
import chatHandler from "./chat-handler.js";

const handlers = [
    metadataHandler,
    settingsHandler,
    updateHandler,
    loreWeaveHandler,
    loreWeavePingHandler,
    queueHandler,
    chatHandler,
];
```

- [ ] **Step 3: Build and lint**

```powershell
cd V:\Code\ProjectCode\RanobesGemini
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```powershell
git add src/background/message-handlers/chat-handler.js src/background/message-handlers/index.js
git commit -m "feat: add story-chat background handler with chronicle context assembly"
```

---

### Task 2: Add Chat tab to popup

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.js`

- [ ] **Step 1: Add Chat tab button in popup.html**

After the Queue tab button, add:

```html
<button class="tab-btn" data-tab="chat" id="chatTabBtn">Chat</button>
```

- [ ] **Step 2: Add Chat tab panel in popup.html**

Before the `<!-- Resize -->` comment, after the Queue panel, add:

```html
<!-- Chat Tab -->
<div class="tab-content" id="chat">
    <div class="config-section" style="display:flex;flex-direction:column;height:100%;">
        <h3 class="config-section-title">Story Chat</h3>

        <div id="chatContextInfo" class="settings-hint" style="margin-bottom:6px">
            No novel context loaded.
        </div>

        <div id="chatMessages" style="
            flex:1;
            min-height:200px;
            max-height:260px;
            overflow-y:auto;
            border:1px solid #333;
            border-radius:4px;
            padding:8px;
            font-size:12px;
            line-height:1.5;
            margin-bottom:8px;
        "></div>

        <div style="display:flex;gap:6px">
            <input type="text" id="chatInput" class="config-input"
                placeholder="Ask about this novel..." style="flex:1" />
            <button id="chatSendBtn" class="btn-secondary">Send</button>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:4px">
            <button id="chatClearBtn" class="btn-secondary" style="font-size:11px">
                Clear Chat
            </button>
        </div>
    </div>
</div>
```

- [ ] **Step 3: Add Chat tab logic to popup.js**

At the end of the popup initialization function, add:

```js
// ── Chat tab ──────────────────────────────────────────────────────────────────
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const chatClearBtn = document.getElementById("chatClearBtn");
const chatContextInfo = document.getElementById("chatContextInfo");

let _chatHistory = [];
let _chatNovelId = null;

async function loadChatContext() {
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        const resp = await browser.tabs.sendMessage(tab.id, { action: "getNovelContext" }).catch(() => null);
        if (resp?.novelId) {
            _chatNovelId = resp.novelId;
            // Count chapters in chronicle
            const key = `rg_chronicle_${resp.novelId}`;
            const stored = await browser.storage.local.get(key);
            const count = Object.keys(stored[key]?.chapters || {}).length;
            if (chatContextInfo) {
                chatContextInfo.textContent = count > 0
                    ? `Context: ${resp.novelTitle || "Novel"} · ${count} chapters loaded`
                    : `Novel detected but no chronicle yet. Enhance or queue chapters first.`;
            }
        } else {
            if (chatContextInfo) chatContextInfo.textContent = "No novel detected on current tab.";
        }
    } catch {
        if (chatContextInfo) chatContextInfo.textContent = "Could not detect current novel.";
    }
}

function appendChatMessage(role, text) {
    if (!chatMessages) return;
    const div = document.createElement("div");
    div.style.cssText = `
        margin-bottom: 8px;
        padding: 6px 8px;
        border-radius: 4px;
        background: ${role === "user" ? "#1a2540" : "#1e3a1e"};
        text-align: ${role === "user" ? "right" : "left"};
        white-space: pre-wrap;
        word-break: break-word;
    `;
    const label = document.createElement("small");
    label.style.cssText = "display:block;font-weight:600;margin-bottom:3px;color:#999;";
    label.textContent = role === "user" ? "You" : "AI";
    div.appendChild(label);
    const body = document.createElement("span");
    body.textContent = text;
    div.appendChild(body);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage() {
    const question = chatInput?.value?.trim();
    if (!question) return;

    if (chatInput) chatInput.value = "";
    appendChatMessage("user", question);

    const thinking = document.createElement("div");
    thinking.style.cssText = "font-size:11px;color:#666;margin-bottom:6px;";
    thinking.textContent = "Thinking…";
    chatMessages?.appendChild(thinking);

    try {
        const resp = await browser.runtime.sendMessage({
            action: "story-chat",
            question,
            novelId: _chatNovelId,
            conversationHistory: _chatHistory,
        });

        thinking.remove();

        if (resp?.success) {
            _chatHistory = resp.conversationHistory || _chatHistory;
            appendChatMessage("model", resp.answer);
        } else {
            appendChatMessage("model", `Error: ${resp?.error || "Unknown error"}`);
        }
    } catch (err) {
        thinking.remove();
        appendChatMessage("model", `Error: ${err.message}`);
    }
}

if (chatSendBtn) {
    chatSendBtn.addEventListener("click", sendChatMessage);
}
if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
}
if (chatClearBtn) {
    chatClearBtn.addEventListener("click", () => {
        _chatHistory = [];
        if (chatMessages) chatMessages.textContent = "";
    });
}

// Load context when Chat tab is opened
document.querySelectorAll(".tab-btn[data-tab='chat']").forEach((btn) => {
    btn.addEventListener("click", loadChatContext);
});
```

- [ ] **Step 4: Add getNovelContext message handler in content.js**

In `src/content/content.js`, find where other content-side message handlers are registered (search for `action.*ping` or the message listener). Add a handler for `getNovelContext`:

```js
case "getNovelContext": {
    const id = getNovelIdFromCurrentPage?.() || null;
    const title = lastKnownNovelData?.title || document.title || null;
    const chapterNum = lastKnownNovelData?.currentChapter || null;
    sendResponse({ novelId: id, novelTitle: title, chapterNum });
    return false;
}
```

- [ ] **Step 5: Build, lint, emoji scan**

```powershell
npm run lint && npm run build && npm run emoji:scan
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```powershell
git add src/popup/popup.html src/popup/popup.js src/content/content.js
git commit -m "feat: add AI story chat popup tab using chronicle context"
```

---

### Task 3: Final validation

- [ ] **Step 1: Build and lint**

```powershell
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 2: Manual smoke test**

1. Load `dist/dist-chromium/` in `chrome://extensions`.
2. Open a NovelBin chapter page for a novel you have enhanced previously (or queue chapters 1–5 first).
3. Open the popup → Chat tab.
4. Expected: "Context: Novel Title · N chapters loaded" appears.
5. Type "Who is the main character?" and press Send.
6. Expected: AI answers using the chapter summaries, referencing character names from the chronicle.
7. Type a follow-up question ("What is their goal?") — expected: AI maintains conversation context.
8. Click "Clear Chat" — expected: messages cleared, history reset.
