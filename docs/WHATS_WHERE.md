# Where Things Are: Quick Reference

A quick index of where everything is located and what it does.

---

## Metadata Fetching

**Need to fetch novel metadata?** → `src/utils/metadata-fetcher.js`

```markdown
What: Unified metadata fetching with 3 strategies
Strategy 1: chapter_embedded → Local extraction (no network)
Strategy 2: dedicated_page → Fetch & extract from novel page
Strategy 3: chapter_embedded_requires_redirect → Fetch alternate URL

Usage: await MetadataFetcher.fetchMetadata(handlerType, url, handler)

Validates: title and author required
Timeout: 15 seconds
```

---

## Handler Settings Management

**Need to validate or store handler settings?** → `src/utils/handler-settings.js`

```markdown
What: Settings validation and storage
- Type checking (string, number, boolean, array, object)
- Enum, range, length validation
- Default application
- Persistence via browser.storage.local
- Multi-handler settings aggregation

Usage:
  HandlerSettings.validateHandlerSettings(handler, userValues)
  HandlerSettings.saveHandlerSettings(domain, settings)
  HandlerSettings.loadHandlerSettings(domain)
```

---

## Background Message Handlers

**Need to handle a message from content script?**

→ Create file in `src/background/message-handlers/`

### Current Handlers

#### Metadata Handler

**File**: `src/background/message-handlers/metadata-handler.js`
**Action**: `fetchNovelMetadata`
**What**: Receives metadata request, uses MetadataFetcher to fetch, validates, returns

**Message Format**:

```javascript
{
  action: "fetchNovelMetadata",
  url: "...",
  handlerDomain: "...",
  handlerType: "chapter_embedded" | "dedicated_page" | "chapter_embedded_requires_redirect"
}
```

**Response**:

```javascript
{ success: true, metadata: {...} }  // or
{ success: false, error: "..." }
```

#### Settings Handler

**File**: `src/background/message-handlers/settings-handler.js`
**Action**: `getHandlerSettings`
**What**: Receives settings request, returns handler's proposed settings schema

**Message Format**:

```javascript
{ action: "getHandlerSettings", handlerDomain: "ranobes.top" }  // or
{ action: "getHandlerSettings", includeAllHandlers: true }
```

**Response**:

```javascript
{
  success: true,
  settings: {
    "ranobes.top": {
      handlerName: "Ranobes",
      proposed: { ... settings schema ... },
      validated: { ... optional validated user values ... }
    }
  }
}
```

### How to Add New Handler

1. Create: `src/background/message-handlers/my-handler.js`
2. Implement:

   ```javascript
   export async function handleMyAction(message, sendResponse) {
     // Your logic
     sendResponse({ success: true, data: ... });
     return false; // or true if async
   }

   export default { action: "myAction", handler: handleMyAction };
   ```

3. Register in: `src/background/message-handlers/index.js`

   ```javascript
   import myHandler from "./my-handler.js";
   const handlers = [..., myHandler];
   ```

### Router/Dispatcher

**File**: `src/background/message-handlers/index.js`
**What**: Registers all handlers, imports in background.js, routes messages

Usage in `background.js`:

```javascript
if (['fetchNovelMetadata', 'getHandlerSettings'].includes(message.action)) {
  return processMessage(message, sender, sendResponse);
}
```

---

## Content Script Modules

**Need to add a content feature?**

→ Create file in `src/content/modules/`

### Current Modules

#### Library Integration

**File**: `src/content/modules/library-integration.js`
**What**:
- Injects "Add to Library" button on chapter pages
- Handles button clicks
- Fetches metadata from background
- Adds novel to library
- Provides status feedback (loading, success, error)

**Lifecycle**:

```logs
initialize() → Inject button, setup listeners
handleAddToLibrary() → Fetch metadata, add to library
setButtonState() → Update button UI
destroy() → Cleanup and remove button
```

### How to Add New Module

1. Create: `src/content/modules/my-feature.js`
2. Implement:

   ```javascript
   class MyFeature {
     async initialize(handler, handlerDomain, handlerType) {
       // Setup
       return true; // Success
     }

     destroy() {
       // Cleanup
     }
   }

   export default new MyFeature();
   ```

3. Register in: `src/content/modules/index.js`

   ```javascript
   import myFeature from "./my-feature.js";
   const modules = [..., {name: "my-feature", instance: myFeature, enabled: true}];
   ```

### Module Registry/Initializer

**File**: `src/content/modules/index.js`
**What**:
- Manages all content modules
- Auto-initializes modules when handler detected
- Can enable/disable modules
- Handles cleanup

**Functions**:

```javascript
initializeModules(handler, domain, type)  // Goes through all enabled modules
getModuleStatus()                          // Returns status of each
toggleModule(name, enable)                 // Enable/disable specific module
cleanupAllModules()                        // Cleanup all
```

---

## Handler Base Class & Methods

**Need to implement handler logic?**

→ Extend `src/utils/website-handlers/base-handler.js`

### Handler Types

| Type                               | Metadata Location      | Example                  |
| ---------------------------------- | ---------------------- | ------------------------ |
| chapter_embedded                   | On chapter page        | FanFiction.net (desktop) |
| dedicated_page                     | On separate novel page | Ranobes, ScribbleHub     |
| chapter_embedded_requires_redirect | Need different URL     | FanFiction.net (mobile)  |

### New Handler Methods to Implement

#### getProposedLibrarySettings()

**Returns**: Settings schema
**Example**:

```javascript
return {
  preferredDomain: {
    type: "string",
    enum: ["site1.com", "site2.com"],
    default: "site1.com",
    label: "Preferred Domain",
    description: "Which domain to use",
    required: true
  }
}
```

#### getMetadataSourceUrl()

**Returns**: URL to fetch metadata from (or null)
**Examples**:

```javascript
// chapter_embedded - metadata on current page
return null;

// dedicated_page - fetch from novel page
return `https://ranobes.top/novels/${novelId}/`;

// redirect - fetch from alternate URL
return "https://www.fanfiction.net/s/12345/1/";
```

#### processRemoteMetadata(metadata)

**Returns**: Processed metadata
**Example**:

```javascript
// Cleanup or enhance metadata from remote fetch
metadata.description = metadata.description?.trim();
return metadata;
```

#### extractNovelMetadata()

**Returns**: Metadata object with title, author, etc.
**Example**:

```javascript
return {
  title: document.querySelector("h1").textContent,
  author: document.querySelector(".author").textContent,
  genres: [...],
  //... more fields
}
```

---

## Handler Implementations

### By Site

| Site                   | File                                                      | Type                               | Settings     |
| ---------------------- | --------------------------------------------------------- | ---------------------------------- | ------------ |
| FanFiction.net Desktop | `src/utils/website-handlers/fanfiction-handler.js`        | chapter_embedded                   | ✅ 3 settings |
| FanFiction.net Mobile  | `src/utils/website-handlers/fanfiction-mobile-handler.js` | chapter_embedded_requires_redirect | ✅ Inherited  |
| Ranobes                | `src/utils/website-handlers/ranobes-handler.js`           | dedicated_page                     | ✅ 3 settings |
| ScribbleHub            | `src/utils/website-handlers/scribblehub-handler.js`       | dedicated_page                     | ✅ 3 settings |
| AO3                    | `src/utils/website-handlers/ao3-handler.js`               | chapter_embedded                   | -            |
| WebNovel               | `src/utils/website-handlers/webnovel-handler.js`          | -                                  | -            |

---

## Documentation (Where to Learn More)

### Architecture & Design

- **MODULAR_SYSTEMS_README.md** - Overview, file organization, quick start
- **MODULAR_ARCHITECTURE.md** - Detailed architecture, design patterns, dataflow

### Implementation & Examples

- **METADATA_AND_SETTINGS_GUIDE.md** - Implementation guide with examples
- **QUICK_START.md** - Developer quick start for adding features
- **SYSTEMS_IMPLEMENTATION_COMPLETE.md** - This session's implementation summary

### In-Code Documentation

- Each file has JSDoc comments at top
- Functions have detailed JSDoc signatures
- Complex logic has inline comments explaining strategy

---

## Testing

### Test from Console

**Metadata Handler**:

```javascript
chrome.runtime.sendMessage({
  action: "fetchNovelMetadata",
  url: "https://www.fanfiction.net/s/12345/1/",
  handlerDomain: "fanfiction.net",
  handlerType: "chapter_embedded"
}, (response) => console.log(response));
```

**Settings Handler**:

```javascript
chrome.runtime.sendMessage({
  action: "getHandlerSettings",
  includeAllHandlers: true
}, (response) => console.log(response.settings));
```

**Library Integration Module**:

```javascript
// Just navigate to any supported site
// "Add to Library" button should appear
// Check console for [LibraryIntegration] logs
```

---

## Common Tasks & Where to Do Them

### I need to

**Fetch metadata from any source**
→ Use `MetadataFetcher.fetchMetadata()` in `src/utils/metadata-fetcher.js`

**Validate user-entered settings**
→ Use `HandlerSettings.validateHandlerSettings()` in `src/utils/handler-settings.js`

**Save/load settings persistently**
→ Use `saveHandlerSettings()`/`loadHandlerSettings()` in `src/background/message-handlers/settings-handler.js`

**Handle a new message type**
→ Create new file in `src/background/message-handlers/` and register in `index.js`

**Add a new content feature**
→ Create new file in `src/content/modules/` and register in `index.js`

**Define settings for my handler**
→ Add `getProposedLibrarySettings()` to handler class

**Tell the system where metadata is**
→ Add `getMetadataSourceUrl()` to handler class

**Process fetched metadata**
→ Add `processRemoteMetadata()` to handler class (optional)

**Extract metadata from page**
→ Implement `extractNovelMetadata()` in handler class

**Add a new website handler**
→ Create class extending `BaseWebsiteHandler` in `src/utils/website-handlers/`
→ Implement required methods
→ Register in `handler-registry.js`

**Debug metadata fetching**
→ Check browser console for `[MetadataHandler]` logs
→ Check background script DevTools console
→ Look in `src/background/message-handlers/metadata-handler.js`

**Debug settings validation**
→ Check browser console for `[SettingsHandler]` logs
→ Look in `src/utils/handler-settings.js` for validation rules
→ Check `src/background/message-handlers/settings-handler.js`

**Debug content modules**
→ Check browser console for `[ContentModules]` logs
→ Look in `src/content/modules/index.js`
→ Check individual module logs `[LibraryIntegration]` etc.

---

## File Sizes

| File                                 | Lines | Purpose                         |
| ------------------------------------ | ----- | ------------------------------- |
| background.js                        | 2,354 | Main service worker (was 3,534) |
| metadata-fetcher.js                  | 150   | Metadata fetching utility       |
| handler-settings.js                  | 185   | Settings validation utility     |
| message-handlers/index.js            | 70    | Handler router                  |
| message-handlers/metadata-handler.js | 120   | Metadata message handler        |
| message-handlers/settings-handler.js | 160   | Settings message handler        |
| modules/index.js                     | 90    | Module registry                 |
| library-integration.js               | 320   | Library integration module      |

---

## Build Output

After `npm run build`:

```filetree
dist/dist-firefox/    → Firefox build
dist/dist-chromium/   → Chromium build
```

Both include copies of:
- All source files from `src/`
- Generated manifest.json
- All assets and icons

---

## Key Concepts

### MetadataFetcher Strategies

- **Embedded**: Content on current page → Call `extractNovelMetadata()` directly
- **Dedicated Page**: Content on different page → Fetch page, call `extractNovelMetadata()` in temp DOM
- **Redirect**: Content on alternate URL → Fetch alternate URL, extract

### Handler Settings

- Handlers **propose** schemas (what they need)
- HandlerSettings **validates** schemas (type/range/enum)
- SettingsHandler **persists** via storage API
- UI **renders** controls based on schema

### Message Handler Pattern

- Each handler handles one message action
- Central router dispatches to right handler
- Handlers are independent, can fail without affecting others
- Async handlers return true, sync return false

### Content Module Pattern

- Each module has `initialize()` and `destroy()`
- Modules are initialized automatically when handler detected
- Can be independently enabled/disabled
- Failed module doesn't break other modules

---

## Status Dashboard

| System                    | Status     | Location                                      |
| ------------------------- | ---------- | --------------------------------------------- |
| MetadataFetcher           | ✅ Complete | `src/utils/metadata-fetcher.js`               |
| HandlerSettings           | ✅ Complete | `src/utils/handler-settings.js`               |
| Background Modularization | ✅ Complete | `src/background/message-handlers/`            |
| Content Modularization    | ✅ Complete | `src/content/modules/`                        |
| Handler Methods           | ✅ Complete | BaseWebsiteHandler + all handlers             |
| Handler Settings          | ✅ Complete | All handlers implemented                      |
| Documentation             | ✅ Complete | `docs/architecture/` + `docs/implementation/` |
| Build                     | ✅ Passing  | Both Firefox and Chromium                     |

---

## Next Reading

1. **First time here?** → Read `QUICK_START.md`
2. **Implementing feature?** → Read `METADATA_AND_SETTINGS_GUIDE.md`
3. **Understanding design?** → Read `MODULAR_ARCHITECTURE.md`
4. **Want full details?** → Read `SYSTEMS_IMPLEMENTATION_COMPLETE.md`
