# Ranobe Gemini Architecture - Modular Systems

## Overview

This document describes the modular architecture for the Ranobe Gemini extension, focusing on separating concerns and improving code maintainability as features grow.

---

## Background Script Modularization

### Structure

```filetree
src/background/
├── background.js              # Main service worker (orchestrator)
└── message-handlers/          # Message handler modules
    ├── index.js               # Handler registry and dispatcher
    ├── metadata-handler.js     # Metadata fetching handler
    ├── settings-handler.js     # Settings management handler
    └── [new-handlers].js       # Add new handlers here
```

### Purpose

The background script is the service worker that handles:
- Keep-alive mechanisms
- Backup/restoration scheduling
- Message routing from content scripts
- Long-running async operations

By separating message handlers into individual modules, the main background script remains manageable while new features can be added without modifying the core orchestrator.

### How It Works

1. **Handler Registration** (`message-handlers/index.js`):

   ```javascript
   const handlers = [
     metadataHandler,    // Handles "fetchNovelMetadata"
     settingsHandler,    // Handles "getHandlerSettings"
   ];
   ```

2. **Message Dispatch** (`background.js`):

   ```javascript
   browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
     // First check if a new modular handler exists
     if (['fetchNovelMetadata', 'getHandlerSettings'].includes(message.action)) {
       return processMessage(message, sender, sendResponse);
     }
     // ... existing handlers continue here
   });
   ```

3. **Handler Implementation** (`message-handlers/metadata-handler.js`):

   ```javascript
   export function handleFetchMetadata(message, sendResponse) {
     // Implementation
   }

   export default {
     action: "fetchNovelMetadata",
     handler: handleFetchMetadata,
   };
   ```

### Adding a New Message Handler

1. Create file: `src/background/message-handlers/my-feature-handler.js`
2. Implement two exports:

   ```javascript
   export async function handleMyFeature(message, sendResponse) {
     // Your implementation
     sendResponse({ success: true, data: result });
     return false; // false = synchronous, true = asynchronous
   }

   export default {
     action: "myFeatureAction",
     handler: handleMyFeature,
   };
   ```

3. Register in `message-handlers/index.js`:

   ```javascript
   import myFeatureHandler from "./my-feature-handler.js";

   const handlers = [
     metadataHandler,
     settingsHandler,
     myFeatureHandler,  // Add here
   ];
   ```

4. Content scripts send messages:

   ```javascript
   chrome.runtime.sendMessage(
     { action: "myFeatureAction", data: ... },
     (response) => { ... }
   );
   ```

---

## Content Script Modularization

### Structure

```filetree
src/content/
├── content.js                 # Main content script (orchestrator)
└── modules/                   # Content feature modules
    ├── index.js               # Module registry and initializer
    ├── library-integration.js  # Add to Library functionality
    └── [new-modules].js       # Add new modules here
```

### Purpose

The content script runs on every page and handles:
- Metadata extraction via handlers
- DOM enhancement and UI injection
- User interaction handling

Content modules allow different features to be independently initialized, disabled, or extended without cluttering the main script.

### How It Works

1. **Module Registration** (`modules/index.js`):

   ```javascript
   const modules = [
     {
       name: "library-integration",
       instance: libraryIntegration,
       enabled: true,
     },
   ];
   ```

2. **Module Initialization** (in main `content.js`):

   ```javascript
   import { initializeModules } from "./modules/index.js";

   // When handler is detected
   const results = await initializeModules(
     handler,
     handlerDomain,
     handlerType
   );
   ```

3. **Module Implementation** (`modules/library-integration.js`):

   ```javascript
   class LibraryIntegration {
     async initialize(handler, handlerDomain, handlerType) {
       // Setup logic
       return true; // initialization successful
     }

     destroy() {
       // Cleanup logic
     }
   }

   export default new LibraryIntegration();
   ```

### Adding a New Content Module

1. Create file: `src/content/modules/my-feature.js`
2. Implement the module class:

   ```javascript
   class MyFeature {
     constructor() {
       this.isInitialized = false;
     }

     async initialize(handler, handlerDomain, handlerType) {
       // Feature setup
       this.isInitialized = true;
       return true;
     }

     destroy() {
       // Cleanup
       this.isInitialized = false;
     }
   }

   export default new MyFeature();
   ```

3. Register in `modules/index.js`:

   ```javascript
   import myFeature from "./my-feature.js";

   const modules = [
     { name: "library-integration", instance: libraryIntegration, enabled: true },
     { name: "my-feature", instance: myFeature, enabled: true },  // Add here
   ];
   ```

---

## System Interaction Diagram

```ui
┌─────────────────────────────────────────────────────────────┐
│                    Content Script                           │
│                   (content.js)                              │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │      Modules Manager (modules/index.js)            │   │
│  │                                                    │   │
│  │  ├─ library-integration                           │   │
│  │  │   ├─ Inject "Add to Library" button            │   │
│  │  │   └─ Handle click → fetch metadata             │   │
│  │  │                                                │   │
│  │  └─ [more modules]                               │   │
│  └────────────────────────────────────────────────────┘   │
│                       ↓                                    │
│          chrome.runtime.sendMessage()                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Background Script (background.js)             │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │   Message Router (message-handlers/index.js)        │   │
│  │                                                    │   │
│  │   ├─ fetchNovelMetadata                           │   │
│  │   │   → metadata-handler.js                       │   │
│  │   │      ├─ MetadataFetcher                       │   │
│  │   │      └─ Handler.processRemoteMetadata()       │   │
│  │   │                                               │   │
│  │   ├─ getHandlerSettings                           │   │
│  │   │   → settings-handler.js                       │   │
│  │   │      ├─ HandlerSettings validator             │   │
│  │   │      └─ Persistent storage access             │   │
│  │   │                                               │   │
│  │   └─ [more handlers]                              │   │
│  │                                                    │   │
│  │  Existing handlers (inline):                      │   │
│  │  ├─ openPopup, createLibraryBackup, ...           │   │
│  │  └─ [all original functionality]                  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  External Services/APIs:                                  │
│  ├─ Google Drive (backups)                                │
│  ├─ Chunking System (content processing)                  │
│  ├─ Notification Manager                                  │
│  └─ Telemetry                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Handler Architecture

### Handler Types

Handlers are website-specific adapters that know how to extract metadata from different sites.

### Handler Metadata Retrieval Strategies

Each handler declares how its metadata should be fetched via `getMetadataSourceUrl()`:

1. **chapter_embedded** - Full metadata on chapter pages

   ```javascript
   // Example: FanFiction.net desktop
   // Metadata is already on the page where user is reading
   extractNovelMetadata() { ... }
   getMetadataSourceUrl() { return null; } // No redirect needed
   ```

2. **dedicated_page** - Metadata only on novel pages

   ```javascript
   // Example: Ranobes.top
   // User reads on chapter page, but novel info is on separate page
   getMetadataSourceUrl() {
     return `https://ranobes.top/novels/${novelId}/`;
   }
   ```

3. **chapter_embedded_requires_redirect** - Needs URL redirect

   ```javascript
   // Example: FanFiction.net mobile
   // Mobile site has limited metadata, need desktop version
   getMetadataSourceUrl() {
     return "https://www.fanfiction.net/s/12345/1/";
   }
   ```

### Handler Settings

Handlers can propose custom settings via `getProposedLibrarySettings()`:

```javascript
class MyHandler extends BaseWebsiteHandler {
  getProposedLibrarySettings() {
    return {
      preferredDomain: {
        type: "string",
        enum: ["site1.com", "site2.com"],
        default: "site1.com",
        label: "Preferred Domain",
        description: "Which domain to use for links",
      },
      fetchDescription: {
        type: "boolean",
        default: true,
        label: "Fetch Description",
      },
    };
  }
}
```

These settings are:
- **Proposed**: Handler suggests what settings it needs
- **Validated**: HandlerSettings ensures types are correct
- **Persistent**: SettingsHandler stores them via storage API
- **UI-Generated**: Library UI renders appropriate controls automatically

---

## Data Flow Example: "Add to Library"

### Step 1: User clicks "Add to Library" button

```logs
Content Script (library-integration module)
  → Button is clicked
  → handleAddToLibrary() called
  → Extract local metadata via handler
```

### Step 2: Fetch complete metadata if needed

```logs
Content Script
  → chrome.runtime.sendMessage({
      action: "fetchNovelMetadata",
      url: "...",
      handlerDomain: "fanfiction.net",
      handlerType: "chapter_embedded"
    })
```

### Step 3: Background processes request

```logs
Background (message-handlers/metadata-handler.js)
  → Receives message
  → Gets handler from registry
  → Calls MetadataFetcher.fetchMetadata()
    → Selects strategy based on handlerType
    → Fetches, validates, processes metadata
  → sendResponse({ success: true, metadata: {...} })
```

### Step 4: Content script receives metadata

```logs
Content Script (library-integration module)
  → Receives response
  → Merges with local metadata
  → Sends "addNovelToLibrary" message to background
  → Updates button state (success/error)
```

---

## Testing New Modules

### Test message handler

```javascript
// In content script or popup
chrome.runtime.sendMessage(
  {
    action: "fetchNovelMetadata",
    url: window.location.href,
    handlerDomain: "fanfiction.net",
    handlerType: "chapter_embedded",
  },
  (response) => {
    console.log("Response:", response);
  }
);
```

### Test content module

```javascript
// In content script after handler detection
import { initializeModules } from "./modules/index.js";

const results = await initializeModules(
  handler,
  handlerDomain,
  handlerType
);

console.log("Module initialization results:", results);
```

---

## Performance Considerations

### Message Handler Performance

- Handlers use dynamic imports to avoid loading unused code
- Each handler is independent and can fail without affecting others
- Metadata fetching happens in background so UI doesn't block

### Content Module Performance

- Modules are lazy-initialized only when needed
- Each module is self-contained and can be disabled
- DOM operations are minimal and optimized

---

## Future Extensions

### New Message Handlers

- `updateNovelProgress` - Track reading progress
- `getSyncStatus` - Check cloud sync status
- `generateSummary` - Local/AI summary generation
- Handler-specific custom handlers

### New Content Modules

- `reading-enhancement` - Reader mode improvements
- `progress-tracking` - Auto-save reading position
- `recommendation-engine` - Suggest similar novels
- `dark-mode-optimizer` - Enhanced dark mode support

---

## Troubleshooting

### "Handler not registered" error

1. Check handler is in `handler-registry.js`
2. Verify handler's domain matches request

### Message handler timeout

1. Check async operations in handler
2. Verify sendResponse is called
3. Check for import errors in dynamic imports

### Content module not initializing

1. Check module's `initialize()` returns true
2. Verify handler method exists
3. Check browser console for errors

---

## Summary

This modular architecture:
- ✅ Keeps main scripts maintainable
- ✅ Allows independent feature development
- ✅ Enables easy testing of modules
- ✅ Follows separation of concerns
- ✅ Scales well as extension grows
- ✅ Makes debugging easier
