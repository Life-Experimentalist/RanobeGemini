---
name: native-sync-design
description: Spec for browser.storage.sync adapter — zero-config cross-device settings sync within the same browser ecosystem — June 2026
metadata:
  type: project
---

# Native Browser Sync — Design Spec

**Date:** 2026-06-04  
**Status:** Approved for implementation

---

## Context

Currently all sync providers (Google Drive, Dropbox, OneDrive, WebDAV) require users to configure API keys or OAuth credentials before they can sync. A significant portion of users only want to sync their reading preferences and novel library between two devices using the same browser (e.g., Chrome on desktop + Chrome on laptop, or Firefox desktop + Firefox Android). `browser.storage.sync` provides exactly this at zero cost and zero configuration.

The storage orchestrator already supports multiple providers and can slot in a new adapter with no changes to the orchestration layer.

---

## Constraints

`browser.storage.sync` has hard browser-enforced quotas:

| Limit | Value |
|-------|-------|
| Total quota | ~100 KB |
| Per-item quota | ~8 KB |
| Max keys | 512 |
| Max writes/hour | 1,800 |

The full novel library (chapter cache, enhanced content) is stored in `browser.storage.local` and is measured in megabytes — it cannot fit in sync storage. The adapter must sync only the essential user settings and novel metadata (not chapter enhancement cache).

---

## What to Sync

Only data small enough to fit within the 100KB total budget:

| Data | Approximate size | Included |
|------|-----------------|---------|
| User settings (API keys, model choice, theme) | ~2 KB | Yes |
| Novel library metadata (titles, URLs, read status, progress) | ~20–40 KB for typical library | Yes (compressed) |
| Chapter enhancement cache | Megabytes | No — stays in `storage.local` only |

The sync payload is a single JSON object called `rg_sync_payload`, chunked across multiple keys if it exceeds 8KB per item.

---

## What to Build

### 1. `src/background/storage/adapters/native-sync-storage.js`

A new adapter implementing the standard storage interface:

**`uploadBackup(backupBlob)`:**
1. Deserialize `backupBlob` to a JSON string
2. Compress with a simple UTF-16 → base64 encoding (or lz-string if bundled) to reduce size
3. Check size — if compressed payload exceeds 90KB, throw with a clear error message ("Library too large for native sync — use Google Drive or Dropbox instead")
4. Chunk into 7KB slices (below the 8KB per-item limit): keys `rg_sync_chunk_0`, `rg_sync_chunk_1`, ...
5. Write a metadata key `rg_sync_meta` = `{ totalChunks, timestamp, version: 1 }`
6. Write all chunks + meta to `browser.storage.sync` atomically (batched `set` call)
7. Return `{ fileId: "native-sync", fileName: "native-sync" }`

**`listBackups()`:**
1. Read `rg_sync_meta`
2. If present, return `[{ id: "native-sync", name: "Native Sync Backup", modifiedTime: meta.timestamp }]`
3. Otherwise return `[]`

**`downloadBackup(fileId)`:**
1. Read `rg_sync_meta` to get `totalChunks`
2. Read all chunk keys in one `browser.storage.sync.get([...chunkKeys])`
3. Reassemble and decompress
4. Return the JSON string

**`getLatestBackup()`:**
- Delegates to `listBackups()`, returns first item or null

**`getContinuousBackup()`:**
- Same as `getLatestBackup()` — native sync has only one slot

**`ensureAuth()`:**
- No-op; `browser.storage.sync` is always authenticated via browser account
- Returns `{ success: true }` immediately

**`resetAuth()`:**
- Clears all `rg_sync_*` keys from `browser.storage.sync`
- Returns `{ success: true }`

### 2. Register in `src/background/background.js`

Add `"native-sync": createNativeSyncStorageAdapter()` to the adapters map passed to `createStorageSyncOrchestrator`.

### 3. No UI changes needed

The provider selection dropdown in Library Settings already lists providers by ID from the orchestrator's `getRegisteredProviders()`. Once `"native-sync"` is registered it will appear automatically.

Display name in UI should be "Native Browser Sync" — verify that the UI renders provider IDs with a friendly label mapping. If the mapping doesn't exist, add `"native-sync": "Native Browser Sync"` to the label map in the settings component.

---

## Chunking Strategy

The JSON payload is chunked as follows:

```
compressed = lzCompress(JSON.stringify(payload))  // or btoa(unescape(encodeURIComponent(json)))
chunks = splitInto(compressed, 7000)              // 7000 chars < 8192 byte limit
storage.sync.set({
  rg_sync_meta: { totalChunks: chunks.length, timestamp: Date.now(), version: 1 },
  rg_sync_chunk_0: chunks[0],
  rg_sync_chunk_1: chunks[1],
  ...
})
```

On retrieval:
```
meta = storage.sync.get("rg_sync_meta")
chunks = storage.sync.get([rg_sync_chunk_0 ... rg_sync_chunk_N])
assembled = chunks.join("")
payload = JSON.parse(lzDecompress(assembled))
```

**Compression choice:** Use the simple `encodeURIComponent` + `btoa` trick (no external library needed) rather than lz-string, to avoid adding a dependency. This gives ~30–40% size reduction for typical JSON. If the payload is still too large, fail with a clear user-facing message.

---

## Conflict Resolution

`browser.storage.sync` doesn't provide server-side conflict resolution — last write wins. The orchestrator's `timestamp`-based logic (already in `storage-orchestrator.js`) handles this: before restoring, compare the remote backup timestamp against the local last-modified timestamp; only restore if remote is newer.

---

## Cross-Ecosystem Limitation

Native sync is strictly within one browser vendor's ecosystem:
- Chrome ↔ Chrome (via Google Account)
- Firefox ↔ Firefox (via Firefox Account, including Firefox for Android)
- Edge ↔ Edge (via Microsoft Account)

This must be clearly communicated in the UI: "Works only between devices using the same browser."

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/background/storage/adapters/native-sync-storage.js` | Create — full adapter implementation |
| `src/background/background.js` | Register `"native-sync"` adapter |
| `src/popup/` or `src/library/` (settings UI) | Add friendly label for `"native-sync"` provider if label map exists |

---

## Out of Scope

- Syncing chapter enhancement cache (too large)
- Cross-browser sync (requires an external service)
- Delta sync / diff-based updates (overkill — payload is small enough to overwrite completely)
- Automatic sync on change (users trigger sync manually via the existing Backup/Restore buttons)
