# Spec 3: AI Story Chat
> Date: 2026-05-28  
> Status: Approved

---

## Goal
A chat widget in the popup that lets users ask questions about a novel using the local story chronicle and LoreWeave entity graph as context. "What happened to Li Wei in chapters 40–50?" "Who are the members of the Azure Dragon Sect?" "What is the Heavenly Sword technique?"

---

## 1. Where it lives

New **"Chat"** tab in the popup (6th tab, after Queue).

The tab is only active when the user is on a chapter page for a novel that has chronicle data. If no chronicle data exists, it shows an empty state: "Enhance or queue some chapters first to build story context."

---

## 2. Context assembly

Before each AI call, the background assembles a context block:

### 2a. Chronicle context
Load the chronicle for the current novel:
- If user's question mentions chapter numbers → load those specific chapter summaries
- Otherwise → load the 10 most recent chapter summaries + the 10 earliest (for world-building context)
- Cap total context at ~12,000 characters to stay within a reasonable token budget

### 2b. LoreWeave entity context (optional)
If LoreWeave URL is configured, query the backend's `get_entity_context` tool via a simple GET or MCP call to fetch entity details. This is best-effort — if LoreWeave is unreachable, fall back to chronicle-only context.

In practice: search the local `entityIndex` from the chronicle first (available offline), then optionally enrich with a LoreWeave backend call.

### 2c. System prompt

```
You are a story assistant for the novel "{novelTitle}".
You have access to chapter summaries and a story knowledge graph.
Answer the user's question using ONLY the provided context.
If the answer is not in the context, say so clearly.

## Story context
{chronical summaries}

## Known entities
{entityIndex excerpts relevant to the question}
```

---

## 3. Chat message handler

New file: `src/background/message-handlers/chat-handler.js`

Action: `story-chat`

Payload: `{ question: string, novelId: string, conversationHistory: [...] }`

Response: `{ success: true, answer: string }` or `{ success: false, error: string }`

Uses the Gemini API directly (like graphify-service.js) at temperature 0.3.
Maintains a `conversationHistory` array (last 6 exchanges) for follow-up question support — sent in the message and echoed back in the response.

---

## 4. Popup Chat UI

```
┌─ Story Chat ──────────────────────────────── [Clear] ─┐
│ Novel: The Undying Sword Master                        │
│ Context: 47 chapters loaded                            │
│                                                        │
│  ┌──────────────────────────────────────────────┐      │
│  │ You: What is Li Wei's current cultivation    │      │
│  │       stage?                                 │      │
│  │                                              │      │
│  │ AI: As of Chapter 45, Li Wei has just        │      │
│  │     broken through to the Foundation         │      │
│  │     Establishment stage after...             │      │
│  └──────────────────────────────────────────────┘      │
│                                                        │
│  [Ask about this novel...]              [Send]         │
└────────────────────────────────────────────────────────┘
```

- Messages rendered as alternating user/AI bubbles (simple HTML, no framework)
- Scrollable message history within the popup
- "Clear" wipes the conversation history (not the chronicle)
- Enter key sends message
- Loading spinner while AI is processing

---

## 5. Novel context detection

The chat tab shows context for the novel currently open in the active tab (derived from the content script's `getNovelIdFromCurrentPage()`). A new message `get-current-novel-context` is sent to the active tab to retrieve `{ novelId, novelTitle, chapterCount }`.

If no novel is detected, the tab still works but the user must select a novel from a dropdown of novels in their library that have chronicle data.

---

## 6. Conversation persistence

Conversations are NOT persisted across popup opens (popup is ephemeral). The `conversationHistory` lives in popup.js memory only and resets when the popup is closed. This avoids storage bloat and privacy concerns.

---

## Files to create/modify

| Action | File |
|---|---|
| Create | `src/background/message-handlers/chat-handler.js` |
| Modify | `src/background/message-handlers/index.js` — register chat-handler |
| Modify | `src/popup/popup.html` — add Chat tab button + panel |
| Modify | `src/popup/popup.js` — chat UI: message display, send, history |
