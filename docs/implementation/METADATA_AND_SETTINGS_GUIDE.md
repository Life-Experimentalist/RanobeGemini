# Implementation Guide: Metadata Fetching & Handler Settings

## Overview

This guide explains how the new metadata fetching and handler settings systems work, and how to integrate them into your workflow.

---

## Part 1: Metadata Fetcher System

### What It Does

The `MetadataFetcher` utility provides a unified interface for fetching novel metadata regardless of how the handler stores that metadata.

### Three Strategies

#### 1. Chapter Embedded

**For**: Sites where all metadata is on the chapter/reading page
**Example**: FanFiction.net desktop

```javascript
// Handler declares no redirect needed
getMetadataSourceUrl() {
  return null;
}

// Content script sends
chrome.runtime.sendMessage({
  action: "fetchNovelMetadata",
  url: "https://www.fanfiction.net/s/12345/1/",
  handlerDomain: "fanfiction.net",
  handlerType: "chapter_embedded"  // ← Local extraction
});

// Background automatically calls:
const metadata = await MetadataFetcher.fetchMetadata(
  "chapter_embedded",  // ← Knows to extract from current page
  url,
  handler
);
```

**What happens:**
1. Fetcher calls `handler.extractNovelMetadata()`
2. Uses DOM already loaded in memory
3. Returns immediately (no network request)
4. **Best for**: Fast, reliable metadata

#### 2. Dedicated Page

**For**: Sites where metadata is on a separate novel/series page
**Example**: Ranobes.top, ScribbleHub

```javascript
// Handler specifies where metadata is
getMetadataSourceUrl() {
  // Extract novel ID and return novel page URL
  return `https://ranobes.top/novels/${novelId}/`;
}

// Content script sends
chrome.runtime.sendMessage({
  action: "fetchNovelMetadata",
  url: "https://ranobes.top/my-novel-12345/chapter/1.html",
  handlerDomain: "ranobes.top",
  handlerType: "dedicated_page"  // ← Fetch & extract
});

// Background automatically:
const metadataUrl = handler.getMetadataSourceUrl(); // "https://ranobes.top/novels/12345/"
const response = await fetch(metadataUrl);
const html = await response.text();
const tempDiv = document.createElement("div");
tempDiv.innerHTML = html;
document.body = tempDiv;  // Temporary context swap
const metadata = handler.extractNovelMetadata();
```

**What happens:**
1. Fetcher asks handler for metadata URL
2. Fetches that URL in background
3. Creates temporary DOM context
4. Calls `handler.extractNovelMetadata()` on the fetched DOM
5. Restores original DOM
6. **Best for**: Complete metadata from canonical pages

#### 3. Redirect (URL Rewrite)

**For**: Alternative versions need data from primary version
**Example**: FanFiction.net mobile → desktop

```javascript
// Mobile handler knows to fetch from desktop
getMetadataSourceUrl() {
  // Convert m.fanfiction.net → www.fanfiction.net
  return "https://www.fanfiction.net/s/12345/1/";
}

// Content script sends from mobile site
chrome.runtime.sendMessage({
  action: "fetchNovelMetadata",
  url: "https://m.fanfiction.net/s/12345/1/",
  handlerDomain: "fanfiction.net",
  handlerType: "chapter_embedded_requires_redirect"  // ← Redirect & extract
});

// Background automatically:
const metadataUrl = handler.getMetadataSourceUrl(); // Returns desktop URL
const response = await fetch(metadataUrl);
const metadata = handler.extractNovelMetadata();  // Extracts from desktop HTML
```

**What happens:**
1. Fetcher asks handler for alternate URL
2. Fetches from that URL
3. Extracts using handler's normal logic
4. Returns enriched metadata
5. **Best for**: Mobile sites getting desktop metadata

### Validation

All metadata is validated with essential fields check:

```javascript
// Required fields
validateMetadata(metadata) {
  return metadata?.title && metadata?.author;
}
```

If validation fails, request returns error instead of partial data.

### Error Handling

All three strategies include:
- **15-second timeout** (prevents hanging on slow/broken sites)
- **Error logging** (all failures logged with details)
- **Fallback** (returns null, content script can continue with local metadata)

---

## Part 2: Handler Settings System

### What It Does

The `HandlerSettings` utility manages handler-proposed settings with validation and persistence.

### How Settings Work

#### 1. Handler Proposes Settings

```javascript
class MyHandler extends BaseWebsiteHandler {
  getProposedLibrarySettings() {
    return {
      // Setting key → Setting definition
      preferredDomain: {
        type: "string",
        enum: ["site1.com", "site2.com"],
        default: "site1.com",
        label: "Preferred Domain",
        description: "Which domain to use for links",
        required: true,
      },

      fetchDescription: {
        type: "boolean",
        default: true,
        label: "Fetch Full Description",
        description: "Automatically fetch detailed description",
      },

      chapterListSize: {
        type: "number",
        default: 50,
        min: 10,
        max: 500,
        label: "Recent Chapters to Store",
        description: "How many recent chapters to keep",
      },
    };
  }
}
```

**Setting Field Types:**
- `type`: "string", "number", "boolean", "array", "object"
- `enum`: Array of allowed values
- `default`: Fallback if user doesn't set
- `label`: Human-readable name
- `description`: What the setting does
- `required`: Must be set? (uses default if not)
- `min`/`max`: For numbers
- `minLength`/`maxLength`: For strings

#### 2. Library UI Requests Settings

```javascript
// Get all handlers' proposed settings
chrome.runtime.sendMessage(
  { action: "getHandlerSettings", includeAllHandlers: true },
  (response) => {
    const settings = response.settings;
    // {
    //   "fanfiction.net": {
    //     handlerName: "FanFiction.net",
    //     settings: { ... proposed settings ... }
    //   },
    //   "ranobes.top": { ... }
    // }
  }
);

// Or get specific handler
chrome.runtime.sendMessage(
  { action: "getHandlerSettings", handlerDomain: "ranobes.top" },
  (response) => {
    // Just ranobes.top settings
  }
);
```

#### 3. Settings Handler Validates

```javascript
// Example: User enters settings
const userSettings = {
  preferredDomain: "site2.com",  // Valid enum
  fetchDescription: "true",       // Will be converted to boolean
  chapterListSize: 250,           // Valid range (10-500)
};

const validated = HandlerSettings.validateHandlerSettings(
  handler,
  userSettings
);

// Returns:
// {
//   preferredDomain: "site2.com",    // ✅ Valid
//   fetchDescription: true,           // ✅ Converted
//   chapterListSize: 250,             // ✅ In range
// }

// Invalid values use defaults:
const badSettings = {
  chapterListSize: 1000,  // ❌ Exceeds max (500)
};

const validated = HandlerSettings.validateHandlerSettings(
  handler,
  badSettings
);

// Returns:
// {
//   chapterListSize: 50,  // ← Uses default instead
// }
```

#### 4. Settings Stored Persistently

```javascript
// Save settings
import { saveHandlerSettings } from "../background/message-handlers/settings-handler.js";

await saveHandlerSettings("ranobes.top", {
  preferredDomain: "ranobes.top",
  fetchDescription: true,
  includeChapterList: false,
});

// Load settings
import { loadHandlerSettings } from "../background/message-handlers/settings-handler.js";

const savedSettings = await loadHandlerSettings("ranobes.top");
// { preferredDomain: "ranobes.top", ... }
```

---

## Integration Examples

### Example 1: Add Novel to Library

```javascript
// 1. User clicks "Add to Library" button
// 2. Get local metadata
const localMetadata = handler.extractNovelMetadata();

// 3. If needed, fetch complete metadata
if (handler_type === "dedicated_page") {
  const response = await chrome.runtime.sendMessage({
    action: "fetchNovelMetadata",
    url: window.location.href,
    handlerDomain: "ranobes.top",
    handlerType: "dedicated_page"
  });

  if (response.success) {
    metadata = { ...localMetadata, ...response.metadata };
  }
}

// 4. Add to library with all metadata
await addToLibrary(metadata);
```

### Example 2: Apply Handler Settings

```javascript
// 1. Load saved settings for handler
const settings = await loadHandlerSettings("ranobes.top");

// 2. Apply settings to behavior
if (settings.preferredDomain === "ranobes.top") {
  // Use ranobes.top for links
} else {
  // Use other domain
}

if (settings.fetchDescription) {
  // Enhanced metadata fetch
}
```

### Example 3: Custom Handler Implementation

```javascript
class MyCustomHandler extends BaseWebsiteHandler {
  // Declare what settings this handler needs
  getProposedLibrarySettings() {
    return {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Optional API key for enhanced metadata",
        default: "",
      },
    };
  }

  // Tell system where metadata lives
  getMetadataSourceUrl() {
    // Option 1: Metadata on current page
    return null;  // ← chapter_embedded type

    // Option 2: Metadata on separate page
    return `https://mysite.com/novel/${novelId}/`;  // ← dedicated_page type

    // Option 3: Need to redirect URL
    return this.currentUrl.replace("m.", "www.");  // ← redirect type
  }

  // Post-process metadata from remote source
  processRemoteMetadata(metadata) {
    // Handler can enrich/modify metadata
    metadata.customField = "processed";
    return metadata;
  }

  // Main extraction logic
  extractNovelMetadata() {
    // Your extraction logic
    const title = ...;
    const author = ...;
    return { title, author, ... };
  }
}
```

---

## Message Flow Diagram

```markdown
Content Script
  ↓
chrome.runtime.sendMessage("fetchNovelMetadata")
  ↓
Background (message-handlers/metadata-handler.js)
  ├─ Validate message
  ├─ Get handler from registry
  ├─ Call MetadataFetcher.fetchMetadata()
  │  ├─ Determine strategy from handlerType
  │  ├─ Execute strategy (local/fetch/redirect)
  │  └─ Validate result
  ├─ Call handler.processRemoteMetadata()
  └─ sendResponse with metadata
  ↑
Content Script receives metadata
  ↓
Use metadata or add to library
```

---

## Common Patterns

### Pattern 1: Metadata with Optional Enhancement

```javascript
// Library-integration module
async handleAddToLibrary() {
  let metadata = handler.extractNovelMetadata();

  // Try to get complete metadata, but don't fail if it doesn't work
  try {
    if (this.handlerType !== "chapter_embedded") {
      const response = await this.fetchMetadataFromBackground();
      if (response.success) {
        metadata = { ...metadata, ...response.metadata };
      }
    }
  } catch (error) {
    // Continue with local metadata
  }

  await this.addNovelToLibrary(metadata);
}
```

### Pattern 2: Conditional Behavior Based on Settings

```javascript
// Handler applies its own settings
async applyLibrarySetting(key, value) {
  if (key === "preferredDomain") {
    this.preferredDomain = value;
    this.updateAllLinks();
  }

  if (key === "fetchDescription") {
    this.enableFullDescriptionFetch = value;
  }
}
```

### Pattern 3: Settings-Driven Configuration

```javascript
// Content module uses settings
async initialize(handler, handlerDomain, handlerType) {
  // Get settings for this handler
  const response = await chrome.runtime.sendMessage({
    action: "getHandlerSettings",
    handlerDomain: handlerDomain
  });

  const settings = response.settings[handlerDomain].proposed;

  // Apply to behavior
  if (settings.trackUpdates?.default) {
    this.enableUpdateTracking();
  }
}
```

---

## Debugging

### Test Metadata Fetching:

```javascript
// In DevTools console
chrome.runtime.sendMessage({
  action: "fetchNovelMetadata",
  url: "https://www.fanfiction.net/s/12345/1/",
  handlerDomain: "fanfiction.net",
  handlerType: "chapter_embedded"
}, (response) => {
  console.log("Metadata response:", response);
});
```

### Test Settings:

```javascript
// In DevTools console
chrome.runtime.sendMessage({
  action: "getHandlerSettings",
  includeAllHandlers: true
}, (response) => {
  console.log("All handler settings:", response.settings);
});
```

### Check Logs:

```javascript
// Open background script DevTools
// Filter console for "[MetadataHandler]" or "[SettingsHandler]"
// Look for debugLog/debugError messages
```

---

## Performance Tips

1. **Metadata Fetching**:
   - Only fetch when necessary (user initiates)
   - 15-second timeout prevents endless waits
   - Use chapter_embedded strategy when possible (no network)

2. **Settings Management**:
   - Load once, cache in memory
   - Validate on save, not on every use
   - Use storage API for persistence

3. **Content Modules**:
   - Initialize only enabled modules
   - Lazy-load handler methods
   - Clean up on navigation

---

## Next Steps

1. **Implement in Library UI**: Use settings to customize library display
2. **Add More Handlers**: Implement settings for remaining handlers
3. **Create Custom Modules**: Build domain-specific content features
4. **User Testing**: Gather feedback on settings usefulness
