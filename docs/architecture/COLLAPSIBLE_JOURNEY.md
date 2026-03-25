# Ranobe Gemini v4.4.0+ — Architecture Journey & Implementation Guide

## Executive Summary

This document traces the evolution of Ranobe Gemini's most sophisticated feature system: **Collapsible Content Sections**. From initial conception through multi-layer integration, this guide explains how fight scenes, mature content, and author notes are intelligently managed to give readers control over their reading experience.

---

## Part 1: The Problem Statement

### Original Challenge

When Gemini enhances chapters by injecting detailed descriptions, readers encounter:

1. **Long Combat Sequences** (5-30 lines)
   - Problem: Readers wanting plot progression must scroll through battle mechanics
   - Missed Details: Combat outcomes, power-ups, character revelations buried in fight descriptions

2. **Explicit/Mature Content**
   - Problem: Readers in public, around others, or who prefer to skip such content still miss story context
   - Missed Details: Relationship developments,emotional beats hidden behind explicit scenes

3. **Author Tangents**
   - Problem: Schedule updates, author commentary, thank-yous interrupt reading flow
   - Missed Details: Rarely: story-relevant notes, lore clarifications, translation notes get caught up

### Solution Architecture

Rather than a simple hide/show toggle, Ranobe Gemini implements **intelligent collapsible sections** with:

- **Smart Summaries**: Gemini produces one-sentence summaries capturing outcome/context
- **Respects Settings**: Users can enable/disable each type individually
- **Accessibility**: TTS/read-aloud follows collapsed/expanded state
- **Extensibility**: Users can create custom collapsible types
- **Persistence**: Settings saved across sessions

---

## Part 2: System Architecture

### End-to-End Data Flow

```
User Requests Chapter Enhancement
         ↓
[Gemini Processes + Wraps Content]
    Uses: <div class="rg-collapsible-section"
                data-type="fight|r18|author-note"
                data-summary="...">
         ↓
[Enhanced HTML Returned to Content Script]
         ↓
[renderCollapsibleSections() Invoked]
    Reads: contentFilterSettings from storage
    Loads: DEFAULT + custom type metadata
         ↓
[Transform Sections → Interactive Wrappers]
    Creates: rg-collapsible-wrapper DOM structure
    Binds: Toggle event listeners
    Applies: Type-specific styling & colors
         ↓
[Rendered in Chapter Container]
    Display: Headers with summaries (always visible)
    Toggle: Expand to see full content on demand
         ↓
[TTS Integration]
    getReadAloudText() respects state:
    ├─ Collapsed: reads summary block only
    └─ Expanded: reads full content block
```

### Storage Layer

```javascript
browser.storage.local
└── contentFilterSettings: {
    fight: {
      enabled: true,
      defaultCollapsed: true
    },
    r18: {
      enabled: true,
      defaultCollapsed: true
    },
    authorNote: {
      enabled: true,
      defaultCollapsed: false  // Most are story-relevant
    },
    custom: [
      {
        id: "flashback",
        name: "Flashback",
        icon: "⏮️",
        enabled: true,
        defaultCollapsed: true,
        hint: "Scenes with heavy worldbuilding description"
      }
    ]
  }
```

### DOM Transformation Example

**Input from Gemini:**
```html
<div class="rg-collapsible-section"
     data-type="fight"
     data-summary="Kael defeats the shadow warrior">
  <div class="rg-system-msg">Combat log: ...</div>
  <div class="rg-quote-box">Enemy: "Impossible..."</div>
</div>
```

**After renderCollapsibleSections():**
```html
<div class="rg-collapsible-wrapper rg-collapsible-fight rg-collapsed">
  <!-- Always visible -->
  <div class="rg-collapsible-header">
    <span class="rg-collapsible-badge">⚔️ FIGHT SCENE</span>
    <span class="rg-collapsible-inline-summary">Kael defeats the shadow warrior</span>
    <button class="rg-collapsible-toggle-btn">▼ Read</button>
  </div>

  <!-- Visible when collapsed -->
  <div class="rg-collapsible-summary-block">
    Kael defeats the shadow warrior
  </div>

  <!-- Visible when expanded -->
  <div class="rg-collapsible-content" style="display:none;">
    <div class="rg-system-msg">Combat log: ...</div>
    <div class="rg-quote-box">Enemy: "Impossible..."</div>
  </div>
</div>
```

---

## Part 3: File Structure & Responsibilities

### Core Files

#### `src/utils/collapsible-sections.js` (330 lines)
**Responsibility:** The heart of the system

```javascript
export const BUILT_IN_SECTION_TYPES = {
  fight: { label: "Fight Scene", icon: "⚔️", color: "..." },
  r18: { label: "Mature Content", icon: "🔞", color: "..." },
  "author-note": { label: "Author's Note", icon: "📝", color: "..." }
}

export const DEFAULT_CONTENT_FILTER_SETTINGS = {
  fight: { enabled: true, defaultCollapsed: true },
  r18: { enabled: true, defaultCollapsed: true },
  authorNote: { enabled: true, defaultCollapsed: false },
  custom: []
}

// Main entry points:
export function renderCollapsibleSections(container, settings)
export function getReadAloudText(container)
```

**Key Functions:**
- `buildCollapsibleWrapper()` — Creates DOM with header, summary, content blocks
- `resolveTypeSettings()` — Merges storage settings with defaults
- `resolveTypeMeta()` — Gets display name, icon, colors for a type
- `renderCollapsibleSections()` — Main processor for all `.rg-collapsible-section` elements
- `getReadAloudText()` — Extracts text respecting collapsed/expanded state

#### `src/content/content.js` (Main integration point)
**Responsibility:** Invoke rendering after Gemini injection

```javascript
import { renderCollapsibleSections } from '../utils/collapsible-sections.js';

// When enhanced HTML is injected:
const settings = await getContentFilterSettings();
renderCollapsibleSections(chapterContainer, settings);
```

#### `src/library/library-settings.html` + `library-settings.js`
**Responsibility:** UI for users to configure collapsible behavior

```html
<!-- New Panel: Content Filters -->
<section class="ls-panel" id="panel-content-filters">
  <!-- Toggle switches for fight/r18/author-note -->
  <!-- Default state dropdowns -->
  <!-- Custom type editor -->
  <!-- Live playground with examples -->
</section>
```

**JavaScript Handlers:**
```javascript
async function initContentFiltersTab() {
  // Load contentFilterSettings from storage
  // Wire toggles, dropdowns, custom type editor
  // Handle playground toggle events
  // Save on button click
}
```

#### `landing/content-styles.html`
**Responsibility:** Public-facing showcase of all collapsible types

```html
<section id="collapsible">
  <h2>Collapsible Content Types</h2>

  <!-- Interactive examples using <details>/<summary> -->
  <details class="cs-collapsible-card cs-collapsible-fight">
    <summary>⚔️ Fight Scene Example</summary>
    [Example content]
  </details>
</section>
```

#### `dev/commit-history.js` (Enhanced)
**Responsibility:** Show version changes with package.json/manifest diffs

```bash
$ npm run commits:versions | grep -A3 "4.4.0"

📌 [a73db74] 2026-03-16 feat(4.4.0): improve UX...
   📦 Version: 4.4.0
   Manifest updated: "version": "4.4.0"
```

---

## Part 4: Integration Points

### 1. Content Processing Pipeline

```
src/background/background.js
  ↓ (sends enhanced HTML message)
src/content/content.js (injected in page context)
  ├─ Creates DOM container
  ├─ Sets innerHTML to Gemini response
  ├─ Calls renderCollapsibleSections(container, settings)
  └─ Renders in chapter view
```

### 2. Settings System

```
Library Settings (UI)
   └─ panel-content-filters
      ├─ toggles: fight, r18, author
      ├─ dropdowns: defaultCollapsed states
      ├─ editor: custom types
      └─ playground: interactive examples
   └─ onClick Save → browser.storage.local.set()
        ↓
src/content/content.js
   ├─ Loads from storage on chapter load
   ├─ Passes to renderCollapsibleSections()
   └─ Applied immediately
```

### 3. Gemini Integration

The system backend includes instructions:

```
Ranobe Gemini uses these HTML structures:

For fight scenes:
<div class="rg-collapsible-section" data-type="fight"
     data-summary="[brief outcome/result]">...full fight...</div>

For R18 content:
<div class="rg-collapsible-section" data-type="r18"
     data-summary="[what's hidden, e.g., 'Explicit scene (+18)']">...content...</div>

For long author notes:
<div class="rg-author-note" data-collapse="true"
     data-summary="[summary of off-topic note]">...note...</div>

Custom types [from user settings]:
<div class="rg-collapsible-section" data-type="[custom id]"
     data-summary="...">...content...</div>
```

### 4. TTS / Read-Aloud Integration

```javascript
// In read-aloud module:
import { getReadAloudText } from '../utils/collapsible-sections.js';

const fullText = getReadAloudText(chapterContainer);
// Rules applied:
// - Collapsed sections: read summary block only
// - Expanded sections: read full content block
// - aria-hidden="true" elements: skip entirely
```

---

## Part 5: User Workflows

### Workflow 1: Disabling Fight Scenes

1. **Library → Settings ⚙️**
2. **Settings Sidebar → Content Filters 🔽**
3. **Toggle: ⚔️ Fight Scenes → OFF**
4. **Click: 💾 Save**
5. **Reload chapter → Fight content unwrapped inline** (no collapsible box)

### Workflow 2: Creating Custom Type

1. **Content Filters 🔽**
2. **Click: + Add Custom Type**
3. **Fill:**
   - Name: "Flashback"
   - Icon: "⏮️"
   - Hint for Gemini: "Flashback scenes with heavy worldbuilding"
   - Default: Collapsed
   - Enabled: ✓
4. **Click: 💾 Save**
5. **In prompt/settings, Gemini now knows:** "Wrap flashbanks in `<div class="rg-collapsible-section" data-type="flashback"...>"`
6. **Next enhanced chapter → Flashbacks appear collapsible**

### Workflow 3: Test Drive with Playground

1. **Content Filters → Playground 🎮 section**
2. **Click fight/R18/author note headers** → Toggle collapsed/expanded
3. **See how your settings affect display**
4. **Adjust settings, click Save, test again**

---

## Part 6: Technical Deep Dive

### Settings Merging Strategy

```javascript
// When renderCollapsibleSections() is called:

// 1. Defaults
const defaults = DEFAULT_CONTENT_FILTER_SETTINGS;

// 2. User's storage settings
const stored = await browser.storage.local.get("contentFilterSettings");

// 3. Deep merge (nested objects)
const merged = {
  ...defaults,
  ...stored.contentFilterSettings,
  fight: {
    ...defaults.fight,
    ...(stored.contentFilterSettings?.fight || {})
  },
  r18: {
    ...defaults.r18,
    ...(stored.contentFilterSettings?.r18 || {})
  },
  // ... etc
}
```

**Why?** Allows upgrading without breaking when new fields added

### Type Resolution Pipeline

For each `.rg-collapsible-section` element:

```
1. Extract: type = element.getAttribute("data-type")
2. Lookup: settings.[type] or settings.custom find(c.id === type)
3. Check: If not enabled → unwrap content inline, skip
4. Load Meta: BUILT_IN_SECTION_TYPES[type] or custom[...].meta
5. Build Wrapper: Call buildCollapsibleWrapper(type, summary, html, startCollapsed, meta)
6. Replace: element.replaceWith(wrapper)
```

### Styling Strategy

Each type has color palette:

```javascript
fight: {
  color: "rgba(200,60,60,0.7)",       // Accent
  bgColor: "rgba(60,15,15,0.85)",     // Background
  borderColor: "rgba(200,80,80,0.4)",  // Border
}
```

Applied inline to header, summary, button:

```css
header {
  background: bgColor;
  border: 1px solid borderColor;
  border-left: 3px solid color;
}
badge {
  color: color;
  font-weight: 700;
}
button {
  color: color;
  background: bgColor;
  border: 1px solid borderColor;
}
```

---

## Part 7: Troubleshooting & Common Issues

### Issue: Sections Not Collapsing

**Check:**
1. Open DevTools → Storage → Local Storage
2. Look for `contentFilterSettings` key
3. Verify `fight: { enabled: true }`
4. Check Console for errors in renderCollapsibleSections()

**Solution:**
```javascript
// Force re-process:
const contentFilter = await browser.storage.local.get("contentFilterSettings");
renderCollapsibleSections(document.body, contentFilter.contentFilterSettings);
```

### Issue: TTS Reading Wrong Content

**Check:**
1. Toggle collapsed/expanded → confirm CSS changes
2. Open DevTools → Elements → inspect `.rg-collapsible-summary-block` and `.rg-collapsible-content`
3. Verify one has `display: block` and other has `display: none`

**Solution:** TTS module needs updated to use `getReadAloudText()` from collapsible-sections.js

### Issue: Custom Type Not Appearing

**Check:**
1. Open Library Settings → Content Filters
2. Look for custom type in the list
3. Ensure `enabled: true` checkbox is checked
4. Click Save button

**Common mistake:** Adding type in settings but Gemini doesn't know about it yet
- Solution: Settings are sent to Gemini in next request; test with new chapter

---

## Part 8: Testing Checklist

- [ ] **Unit Tests**
  - [ ] `resolveTypeSettings()` merges correctly
  - [ ] `buildCollapsibleWrapper()` creates proper DOM
  - [ ] `getReadAloudText()` respects state

- [ ] **Integration Tests**
  - [ ] Settings page loads without errors
  - [ ] Custom type add/remove works
  - [ ] Save button persists to storage
  - [ ] Content pages load and render collapsibles

- [ ] **UX Tests**
  - [ ] Toggle headers work (click, keyboard, mobile)
  - [ ] Summaries fit and don't overflow
  - [ ] Playground examples show/hide correctly
  - [ ] Colors are readable on dark/light themes

- [ ] **Accessibility Tests**
  - [ ] Screen readers announced sections properly
  - [ ] Keyboard Tab navigation works
  - [ ] ARIA labels appropriate
  - [ ] Color contrast passes WCAG AA

---

## Part 9: Future Enhancements

| Feature                                | Status | Difficulty |
| -------------------------------------- | ------ | ---------- |
| Animated collapse/expand transitions   | 🔲 TODO | Low        |
| Per-chapter state persistence          | 🔲 TODO | Medium     |
| Global toggle all sections             | 🔲 TODO | Low        |
| Stats dashboard (fights/R18 count)     | 🔲 TODO | Medium     |
| Keyboard shortcut (Ctrl+K)             | 🔲 TODO | Low        |
| Custom section CSS theming             | 🔲 TODO | High       |
| Export collapsed vs. expanded versions | 🔲 TODO | Hard       |

---

## Part 10: Related Documentation

- [**COLLAPSIBLE_SECTIONS.md**](../features/COLLAPSIBLE_SECTIONS.md) — Standard documentation
- [**src/utils/collapsible-sections.js**](../../src/utils/collapsible-sections.js) — Implementation
- [**src/library/library-settings.html**](../../src/library/library-settings.html) — Settings UI
- [**landing/content-styles.html**](../../landing/content-styles.html) — Public showcase
- [**README.md**](../../README.md) — Main project documentation

---

## Appendix A: Code Examples

### Example 1: Use in Custom Extensions

```javascript
// If building a custom script that needs collapsible support:

import { renderCollapsibleSections, DEFAULT_CONTENT_FILTER_SETTINGS } from "path/to/collapsible-sections.js";

const userSettings = await browser.storage.local.get("contentFilterSettings");
const container = document.getElementById("my-content");

renderCollapsibleSections(container, {
  ...DEFAULT_CONTENT_FILTER_SETTINGS,
  ...userSettings.contentFilterSettings,
  fight: { enabled: false }  // Override: disable fights for this context
});
```

### Example 2: Customize Styling

```css
/* Add to content.css for custom styling */

.rg-collapsible-fight .rg-collapsible-header {
  background: linear-gradient(135deg, rgba(60,15,15,0.85), rgba(100,20,20,0.8));
  box-shadow: 0 2px 6px rgba(200,60,60,0.2);
}

.rg-collapsible-fight.rg-expanded .rg-collapsible-toggle-btn {
  animation: rotate-up 0.3s ease;
}

@keyframes rotate-up {
  from { transform: rotateZ(0deg); }
  to { transform: rotateZ(180deg); }
}
```

### Example 3: Custom Type for Your Needs

```javascript
// In Library Settings → Content Filters → Add Custom Type

{
  id: "dialogue-scene",
  name: "Dialogue Heavy Scene",
  icon: "💬",
  enabled: true,
  defaultCollapsed: false,  // Keep visible by default
  hint: "Scenes with heavy dialogue back-and-forth between characters, long conversations, negotiations"
}
```

---

## Changelog

| Version | Change                                                                 |
| ------- | ---------------------------------------------------------------------- |
| v4.4.0  | Initial collapsible sections system with fight/r18/author-note support |
| v4.4.0  | Added settings UI panel with toggles, dropdowns, custom type editor    |
| v4.4.0  | Added playground examples in settings                                  |
| v4.4.0  | Enhanced commit-history.js to show version/manifest changes            |
| v4.4.0  | Created issue/discussion templates on GitHub                           |
| TBD     | Animated transitions for collapse/expand                               |
| TBD     | Per-chapter collapse state history                                     |

---

**Last Updated:** March 17, 2026
**Maintainers:** @Vkrishna27
**License:** MIT
