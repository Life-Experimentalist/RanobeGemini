# Metadata & Settings Systems - Developer Quick Start

## TL;DR - What Changed?

### Before

- `background.js`: 3500+ lines with all message handlers inline
- `content.js`: Would grow as features added
- Hard to find where features are, hard to add new features

### After

- `background/message-handlers/`: Separate files for each message type
- `content/modules/`: Separate modules for each feature
- Easy to add new features without touching core scripts

---

## The Three New Utility Systems

### 1. MetadataFetcher (Universal Metadata System)

**What**: Unified way to get novel metadata regardless of site structure

**Location**: `src/utils/metadata-fetcher.js`

**Three Strategies**:

```javascript
// Strategy 1: Data on current page
MetadataFetcher.fetchMetadata("chapter_embedded", url, handler)

// Strategy 2: Data on separate page
MetadataFetcher.fetchMetadata("dedicated_page", url, handler)

// Strategy 3: Data on different domain (e.g., mobile→desktop)
MetadataFetcher.fetchMetadata("chapter_embedded_requires_redirect", url, handler)
```

**Key Point**: Content script doesn't need to know which strategy to use → handler declares it via `getMetadataSourceUrl()`

---

### 2. HandlerSettings (Customizable Library Settings)

**What**: Handlers propose settings that customize library behavior

**Location**: `src/utils/handler-settings.js`

**How It Works**:
1. Handler proposes: `{ preferredDomain: {...}, fetchDescription: {...} }`
2. Library UI shows controls for those settings
3. User configures settings
4. HandlerSettings validates the values
5. SettingsHandler stores persistently
6. Handler uses settings to customize behavior

**Key Point**: Each handler can have custom settings without coding UI

---

### 3. Message Handler Architecture (Background Modularity)

**What**: Organize background message handlers into separate files

**Location**: `src/background/message-handlers/`

**Two new handlers**:
- `metadata-handler.js`: Handles `fetchNovelMetadata` messages
- `settings-handler.js`: Handles `getHandlerSettings` messages

**How It Works**:

```markdown
Content sends message
  ↓
background.js receives via onMessage listener
  ↓
Calls processMessage() from message-handlers/index.js
  ↓
Router finds right handler by action name
  ↓
Handler executes, sends response
```

---

## The New Handler Methods

Every handler now can/should implement these:

```javascript
class MyHandler extends BaseWebsiteHandler {
  // NEW: Declare what settings this handler needs
  getProposedLibrarySettings() {
    return {
      preferredDomain: {
        type: "string",
        enum: ["domain1.com", "domain2.com"],
        default: "domain1.com",
        label: "Preferred Domain",
        description: "Which domain to use for library links",
      },
      // ... more settings
    };
  }

  // NEW: Tell system where to fetch metadata from
  getMetadataSourceUrl() {
    // Return null if metadata is on current page (chapter_embedded)
    // Return URL to fetch from (dedicated_page or redirect)
    return null;  // Or: "https://site.com/novels/123/"
  }

  // NEW (Optional): Process metadata after remote fetch
  processRemoteMetadata(metadata) {
    // Handler can fix/enhance metadata before returning
    return metadata;
  }

  // EXISTING: Extract metadata from DOM (called by MetadataFetcher)
  extractNovelMetadata() {
    // Your existing logic
  }
}
```

---

## The New Content Modules System

**What**: Organize content script features into modules

**Location**: `src/content/modules/`

**Current Module**:
- `library-integration.js`: Injects "Add to Library" button, handles clicks, triggers metadata fetching

**How It Works**:

```javascript
// In content.js, when handler detected:
import { initializeModules } from "./modules/index.js";

const results = await initializeModules(handler, handlerDomain, handlerType);

// All modules initialize automatically, independently
// Each module can fail without affecting others
```

---

## File Locations Summary

### Utilities (Unchanged location)

```filetree
src/utils/
├── metadata-fetcher.js     ← Metadata fetching logic
├── handler-settings.js     ← Settings validation & persistence
└── (other utilities...)
```

### Background (Reorganized)

```filetree
src/background/
├── background.js           ← Orchestrator (imports from message-handlers)
└── message-handlers/       ← NEW DIRECTORY
    ├── index.js            ← Message router
    ├── metadata-handler.js  ← fetchNovelMetadata action
    ├── settings-handler.js  ← getHandlerSettings action
    └── [future handlers]
```

### Content (Reorganized)

```filetree
src/content/
├── content.js              ← Main script (imports from modules)
└── modules/                ← NEW DIRECTORY
    ├── index.js            ← Module registry & initializer
    ├── library-integration.js ← Add to Library feature
    └── [future modules]
```

---

## Quick Flow Diagrams

### Adding Novel to Library

```markdown
User clicks "Add to Library"
              ↓
LibraryIntegration module (content/modules/library-integration.js)
  1. Extract local metadata
  2. If needed, send "fetchNovelMetadata" message
              ↓
Background receives message
  ↓
message-handlers/metadata-handler.js
  1. Get handler
  2. Use MetadataFetcher with appropriate strategy
  3. Validate metadata
  4. Send response with complete metadata
              ↓
LibraryIntegration module
  3. Merge with local metadata
  4. Send "addNovelToLibrary" message
  5. Update button state
```

### Getting Handler Settings

```markdown
Library UI needs to show handler settings
              ↓
Send "getHandlerSettings" message
              ↓
Background receives message
  ↓
message-handlers/settings-handler.js
  1. Get handler
  2. Call handler.getProposedLibrarySettings()
  3. Return schema to UI
              ↓
Library UI
  1. Render controls based on schema
  2. User configures values
  3. Send back values for validation
```

---

## For Different Roles

### If you're adding a feature...

1. Check if it needs **background processing**:
   - YES → Create `src/background/message-handlers/my-feature.js`
   - Register in `message-handlers/index.js`

2. Check if it needs **content script UI**:
   - YES → Create `src/content/modules/my-feature.js`
   - Register in `modules/index.js`

3. Check if handler needs **custom settings**:
   - YES → Add `getProposedLibrarySettings()` to handler

### If you're working with handlers...

1. Implement `extractNovelMetadata()` (you prob already do)
2. Add `getMetadataSourceUrl()` (tells system where metadata lives)
3. Add `getProposedLibrarySettings()` (what settings this handler needs)
4. Optional: `processRemoteMetadata()` to post-process fetched data

### If you're building the library UI...

1. Request all handler settings: `{action: "getHandlerSettings", includeAllHandlers: true}`
2. For each handler's proposed settings, render appropriate UI:
   - `type: "string", enum: [...]` → Dropdown
   - `type: "boolean"` → Checkbox
   - `type: "number", min, max` → Input slider
3. When user saves, send back to background for validation
4. Settings automatically stored persistently

---

## Code Patterns

### Message Handler Pattern

```javascript
export async function handleMyAction(message, sendResponse) {
  try {
    // Validate input
    if (!message.required_field) {
      sendResponse({ success: false, error: "Missing field" });
      return false;
    }

    // Do work
    const result = await doSomething(message.data);

    // Send response
    sendResponse({ success: true, data: result });
    return false; // or true if async
  } catch (error) {
    sendResponse({ success: false, error: error.message });
    return false;
  }
}

export default { action: "myAction", handler: handleMyAction };
```

### Content Module Pattern

```javascript
class MyModule {
  async initialize(handler, handlerDomain, handlerType) {
    if (this.isInitialized) return true;

    try {
      // Setup
      this.isInitialized = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  destroy() {
    // Cleanup
    this.isInitialized = false;
  }
}

export default new MyModule();
```

### Handler Settings Pattern

```javascript
class MyHandler extends BaseWebsiteHandler {
  getProposedLibrarySettings() {
    return {
      mySetting: {
        type: "boolean",
        default: true,
        label: "My Setting",
        description: "What it does"
      }
    };
  }

  getMetadataSourceUrl() {
    // null = chapter_embedded
    // url = dedicated_page or redirect
    return null;
  }

  extractNovelMetadata() {
    // Existing logic
  }
}
```

---

## Key Files to Know

| File                                                  | Purpose                          |
| ----------------------------------------------------- | -------------------------------- |
| `src/utils/metadata-fetcher.js`                       | Universal metadata fetching      |
| `src/utils/handler-settings.js`                       | Settings validation & management |
| `src/utils/website-handlers/base-handler.js`          | Base class with new methods      |
| `src/background/message-handlers/index.js`            | Message router                   |
| `src/background/message-handlers/metadata-handler.js` | Metadata message handler         |
| `src/background/message-handlers/settings-handler.js` | Settings message handler         |
| `src/content/modules/index.js`                        | Module initializer               |
| `src/content/modules/library-integration.js`          | Add to Library feature           |
| `docs/architecture/MODULAR_SYSTEMS_README.md`         | System overview                  |
| `docs/architecture/MODULAR_ARCHITECTURE.md`           | Detailed architecture            |
| `docs/implementation/METADATA_AND_SETTINGS_GUIDE.md`  | Implementation examples          |

---

## Testing Checklist

- [ ] Build succeeds: `npm run build`
- [ ] Firefox extension loads without errors
- [ ] Chromium extension loads without errors
- [ ] Test metadata handler from console (see guide)
- [ ] Test settings handler from console (see guide)
- [ ] Navigate to supported site, "Add to Library" button appears
- [ ] Click button, metadata fetches in background
- [ ] Got to library UI, handler settings appear
- [ ] Can configure settings, persistence works

---

## Documentation

Three docs cover everything:

1. **MODULAR_SYSTEMS_README.md** (this is the quickstart)
   - What changed and why
   - File organization
   - Quick checklist for adding features

2. **MODULAR_ARCHITECTURE.md**
   - Complete system design
   - Handler types and metadata strategies
   - Settings schema details
   - Data flow examples

3. **METADATA_AND_SETTINGS_GUIDE.md**
   - Deep implementation details
   - Each strategy explained with examples
   - Integration patterns
   - Common pitfalls and solutions

---

## What's Left?

These are already done:
- ✅ MetadataFetcher utility
- ✅ HandlerSettings utility
- ✅ Background message handlers (metadata, settings)
- ✅ Content module for library integration
- ✅ Handler method additions (base-handler.js)
- ✅ Handler settings (ranobes, scribblehub, fanfiction)
- ✅ Full documentation

Still TODO (when ready):
- [ ] Library UI for configuring handler settings
- [ ] Persistent storage/retrieval of user settings
- [ ] "Add to Library" button styling
- [ ] Background handler for "addNovelToLibrary" action
- [ ] More content modules (reading track, recommendations, etc.)
