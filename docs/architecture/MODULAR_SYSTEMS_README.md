# Background & Content Script Modular Architecture

## Quick Reference

### Directory Structure

```filetree
src/
├── background/
│   ├── background.js              # Main service worker (3500+ lines)
│   └── message-handlers/           # NEW: Modular message handlers
│       ├── index.js                # Handler registry & dispatcher
│       ├── metadata-handler.js      # Handle "fetchNovelMetadata" action
│       ├── settings-handler.js      # Handle "getHandlerSettings" action
│       └── [future-handlers].js     # Add new handlers here
│
└── content/
    ├── content.js                   # Main content script
    └── modules/                     # NEW: Modular content features
        ├── index.js                 # Module registry & initializer
        ├── library-integration.js    # "Add to Library" button
        └── [future-modules].js       # Add new features here
```

---

## Background Script Modularization

### Problem Solved

- `background.js` was getting very large (3500+ lines)
- Message handlers were inline, hard to find and modify
- Adding new features required editing core orchestrator

### Solution

- **Separate directory**: `src/background/message-handlers/`
- **Each message type gets own file**
- **Central registry**: `message-handlers/index.js`

### Current Message Handlers

| Handler             | File                  | Action               |
| ------------------- | --------------------- | -------------------- |
| Metadata Fetching   | `metadata-handler.js` | `fetchNovelMetadata` |
| Settings Management | `settings-handler.js` | `getHandlerSettings` |
| *(existing inline)* | `background.js`       | All other actions    |

### How Content Script Uses It

```javascript
// Old way (before modularization):
// - Action processed inline in background.js
// - Found by searching through hundreds of lines of code

// New way (modularized):
chrome.runtime.sendMessage({
  action: "fetchNovelMetadata",  // → Automatically dispatched to metadata-handler.js
  url: "...",
  handlerDomain: "...",
  handlerType: "..."
});

chrome.runtime.sendMessage({
  action: "getHandlerSettings",  // → Automatically dispatched to settings-handler.js
  handlerDomain: "..."
});
```

---

## Content Script Modularization

### Problem Solved

- Content script grows as new features (metadata fetching, settings, etc.) are added
- Different features need different initialization logic
- Features should be independently testable and disableable

### Solution

- **Separate directory**: `src/content/modules/`
- **Each feature gets own module**
- **Central orchestrator**: `modules/index.js`

### Current Content Modules

| Module              | File                     | Purpose                                     |
| ------------------- | ------------------------ | ------------------------------------------- |
| Library Integration | `library-integration.js` | "Add to Library" button + metadata fetching |
| *(more coming)*     | `*.js`                   | Other features...                           |

### How Main Content Script Uses Modules

```javascript
// Instead of: content.js containing 1000+ lines of logic
// Each feature is: self-contained module

import { initializeModules } from "./modules/index.js";

// When handler detected on current page:
const results = await initializeModules(
  handler,
  handlerDomain,
  handlerType
);

// Returns status of each module:
// {
//   "library-integration": { enabled: true, success: true },
//   ... (more modules)
// }
```

---

## Adding New Features

### New Message Handler (Background)

**File**: `src/background/message-handlers/my-feature-handler.js`

```javascript
import { debugLog, debugError } from "../../utils/logger.js";

/**
 * Handle my custom message action
 */
export async function handleMyFeature(message, sendResponse) {
  try {
    debugLog("[MyFeatureHandler] Processing request");

    // Your logic here
    const result = await doSomething(message.data);

    sendResponse({ success: true, data: result });
    return false; // Will respond synchronously
  } catch (error) {
    debugError("[MyFeatureHandler] Error:", error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
}

export default {
  action: "myFeatureAction",  // What content scripts send
  handler: handleMyFeature,
};
```

**Register it**: Add to `src/background/message-handlers/index.js`

```javascript
import myFeatureHandler from "./my-feature-handler.js";

const handlers = [
  metadataHandler,
  settingsHandler,
  myFeatureHandler,  // ← Add here
];
```

**Use from content script**:

```javascript
chrome.runtime.sendMessage(
  { action: "myFeatureAction", data: {...} },
  (response) => { ... }
);
```

---

### New Content Module

**File**: `src/content/modules/my-feature.js`

```javascript
import { debugLog, debugError } from "../../utils/logger.js";

class MyFeature {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Called when handler detected on page
   */
  async initialize(handler, handlerDomain, handlerType) {
    try {
      debugLog("[MyFeature] Initializing");

      // Setup logic here
      this.setupUI();
      this.attachEventListeners();

      this.isInitialized = true;
      return true; // Success
    } catch (error) {
      debugError("[MyFeature] Init error:", error);
      return false; // Failed
    }
  }

  /**
   * Called on navigation or unload
   */
  destroy() {
    if (this.isInitialized) {
      // Cleanup: remove eventListeners, DOM elements, etc.
      this.isInitialized = false;
    }
  }

  // Your feature methods
  setupUI() { ... }
  attachEventListeners() { ... }
}

export default new MyFeature();
```

**Register it**: Add to `src/content/modules/index.js`

```javascript
import myFeature from "./my-feature.js";

const modules = [
  { name: "library-integration", instance: libraryIntegration, enabled: true },
  { name: "my-feature", instance: myFeature, enabled: true },  // ← Add here
];
```

**Auto-initialized** when handler detected in content script.

---

## Key Benefits

✅ **Maintainability**
- Each feature in its own file
- Clear separation of concerns
- Easier to find and modify code

✅ **Scalability**
- Add new features without touching core scripts
- Old features remain unaffected

✅ **Testability**
- Each handler/module can be tested independently
- Mock implementations easier

✅ **Debuggability**
- Debug logs prefixed with `[HandlerName]`
- Easy to filter console by feature

✅ **Extensibility**
- Handlers and modules follow consistent patterns
- New developers understand immediately

---

## File Organization Rules

### ✅ DO

- Put new message handlers in `src/background/message-handlers/`
- Put new content features in `src/content/modules/`
- Register in corresponding `index.js` file
- Use consistent naming: `kebab-case` for files, `CamelCase` for classes
- Add `// NEW:` comments where new code is called

### ❌ DON'T

- Edit old files without reason (they stay where they are)
- Put new handlers/modules directly in background.js or content.js
- Create new directories without discussing first
- Forget to register handlers/modules in index.js

---

## Testing from Console

```javascript
// Test metadata handler
chrome.runtime.sendMessage({
  action: "fetchNovelMetadata",
  url: "https://www.fanfiction.net/s/12345/1/",
  handlerDomain: "fanfiction.net",
  handlerType: "chapter_embedded"
}, (response) => {
  console.log("Result:", response);
});

// Test settings handler
chrome.runtime.sendMessage({
  action: "getHandlerSettings",
  includeAllHandlers: true
}, (response) => {
  console.log("Settings:", response.settings);
});
```

---

## Documentation

- **Architecture Details**: See `docs/architecture/MODULAR_ARCHITECTURE.md`
- **Implementation Guide**: See `docs/implementation/METADATA_AND_SETTINGS_GUIDE.md`
- **Code Comments**: Each file has detailed JSDoc comments

---

## Quick Checklist for New Handler

- [ ] Create `src/background/message-handlers/my-handler.js`
- [ ] Implement `handleMyAction()` function
- [ ] Export with `action` and `handler` properties
- [ ] Add import to `message-handlers/index.js`
- [ ] Add to `handlers` array
- [ ] Add JSDoc comments
- [ ] Test with `chrome.runtime.sendMessage()`

---

## Quick Checklist for New Content Module

- [ ] Create `src/content/modules/my-module.js`
- [ ] Implement class with `initialize()` and `destroy()`
- [ ] Export as singleton `export default new MyModule()`
- [ ] Add import to `modules/index.js`
- [ ] Add to `modules` array
- [ ] Add JSDoc comments
- [ ] Test initialization in browser
