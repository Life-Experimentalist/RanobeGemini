# Collapsible Sections System Documentation

## Overview

The **Collapsible Sections System** is a core feature that allows Ranobe Gemini to intelligently hide lengthy or tangential content (fight scenes, R18 content, author notes) behind clickable summaries. This keeps the reading experience focused while allowing users to access full content on demand.

### Key Features

- **Intelligent Content Detection**: Gemini analyzes chapter content and marks sections for collapsing
- **Per-Type Configuration**: Separate settings for fight scenes, R18 content, author notes, and custom types
- **TTS/Read-Aloud Integration**: Respects collapsed state—reads summaries when collapsed, full content when expanded
- **Nested Content Support**: Collapsible sections can contain other content elements (flashbacks, quote boxes, system messages)
- **Accessibility**: Proper ARIA attributes, semantic HTML, keyboard navigation

---

## What Gets Collapsed and Why

### Fight Scenes (`⚔️ Fight Scene`)
**Collapsed by default** because:
- Action sequences can be lengthy (5-20+ lines)
- Many readers want plot progression, not detailed combat mechanics
- Summary allows readers to quickly understand outcome without deep dive

**Example Summary:**
```
⚔️ Fight Scene: Kael defeats the corrupted knight in a duel lasting 30 seconds.
```

**When to leave expanded:**
- Combat mechanics are emotionally significant (hero's breakthrough)
- Character abilities or power-ups are revealed
- Fight outcome directly impacts story

---

### R18 / Mature Content (`🔞 Mature Content`)
**Collapsed by default** because:
- Users may read in public or around others
- Not everyone wants explicit scenes
- Summary provides context without graphic details

**Example Summary:**
```
🔞 Mature Content: Intimate scene between characters (+18 content)
```

**Content **captured** before collapsing:**
- Explicit sexual content
- Graphic violence (without combat context)
- Drug use, self-harm descriptions

---

### Author's Notes (`📝 Author's Note`)
**Collapsed by default** only if flagged as "long/off-topic" because:
- Many notes are story-relevant and should be visible
- Long tangential notes (author rambling, schedule updates) break reading flow
- Summary prevents pacing interruption

**Example Summary (Long Author Note):**
```
📝 Author's Note: Update on publishing schedule and thanks to patrons
```

**Relevant notes** (NOT collapsed):
- Character name clarifications
- Series canon notes
- Translation notes
- Short story context

---

### Custom Types (User-Defined)
Users can create custom collapsible types for:
- Flashback sequences with heavy description
- System notifications / status screens
- Lore dumps or world-building exposition
- Side character subplot asides

**Configuration:**
```javascript
custom: [
  {
    id: "flashback",
    name: "Flashback",
    icon: "⏮️",
    enabled: true,
    defaultCollapsed: true
  }
]
```

---

## Technical Implementation

### DOM Structure

#### Raw Gemini Output
```html
<!-- Gemini produces this structure -->
<div class="rg-collapsible-section" data-type="fight" data-summary="Kael wins the duel">
  <!-- Full fight content here -->
  <div class="rg-system-msg">Combat Log:...</div>
  <div class="rg-quote-box">Enemy says: "...retreat"</div>
</div>
```

#### After Processing
```html
<!-- renderCollapsibleSections() transforms it to: -->
<div class="rg-collapsible-wrapper rg-collapsible-fight rg-collapsed">
  <!-- Header (always visible) -->
  <div class="rg-collapsible-header">
    <span class="rg-collapsible-badge">⚔️ Fight Scene</span>
    <span class="rg-collapsible-inline-summary">Kael wins the duel</span>
    <button class="rg-collapsible-toggle-btn">▼ Read</button>
  </div>

  <!-- Summary block (visible when collapsed) -->
  <div class="rg-collapsible-summary-block">
    Kael wins the duel
  </div>

  <!-- Content block (visible when expanded) -->
  <div class="rg-collapsible-content">
    <!-- Original Gemini HTML: system messages, quotes, etc. -->
    <div class="rg-system-msg">Combat Log:...</div>
    <div class="rg-quote-box">Enemy says: "...retreat"</div>
  </div>
</div>
```

### Key Classes & Attributes

| Class/Attribute                                 | Purpose                                |
| ----------------------------------------------- | -------------------------------------- |
| `.rg-collapsible-wrapper`                       | Root container for collapsible section |
| `.rg-collapsible-fight` / `r18` / `author-note` | Type-specific styling                  |
| `.rg-collapsed` / `.rg-expanded`                | State tracking                         |
| `.rg-collapsible-header`                        | Clickable header with summary & toggle |
| `.rg-collapsible-summary-block`                 | Summary text (hidden when expanded)    |
| `.rg-collapsible-content`                       | Full content (hidden when collapsed)   |
| `data-rg-collapsible-type`                      | Type identifier for querying           |

### Processing Flow

```
Chapter HTML from Gemini
         ↓
[renderCollapsibleSections(container, settings)]
         ↓
Query all .rg-collapsible-section elements
         ↓
For each section:
  - Extract type, summary, content
  - Check settings (enabled? defaultCollapsed?)
  - Build wrapper with header/summary/content blocks
  - Add toggle event listener
  - Replace original element with wrapper
         ↓
Enhanced chapter ready for display
```

---

## Settings & Configuration

### Storage Structure
```javascript
// Stored in browser storage under 'contentFilterSettings'
{
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
    defaultCollapsed: false  // Most author notes should show
  },
  custom: [
    {
      id: "flashback",
      name: "Flashback",
      icon: "⏮️",
      enabled: true,
      defaultCollapsed: true
    }
  ]
}
```

### UI Location
**Settings → Content Filters**

Users can:
1. **Toggle each type on/off** — Disabled types unwrap their content inline
2. **Set default state** — Collapsed or expanded by default
3. **Add custom types** — Define new collapsible categories
4. **Preview changes** — Playground section shows real examples

---

## Integration Points

### 1. Content Processing (`src/content/content.js`)
```javascript
import { renderCollapsibleSections } from '../utils/collapsible-sections.js';

// After Gemini injects enhanced HTML:
renderCollapsibleSections(chapterContainer, settings);
```

### 2. Settings UI (`src/library/library-settings.html` + `.js`)
```html
<!-- Content Filters Panel -->
<section class="ls-panel" id="panel-content-filters">
  <!-- Toggles for fight/r18/author-note -->
  <!-- Default state selectors -->
  <!-- Custom type editor -->
  <!-- Playground preview -->
</section>
```

### 3. Playground Examples (`src/library/library-settings.html`)
```html
<!-- Show live collapsible examples with toggle -->
<div class="collapsible-playground">
  <div class="rg-collapsible-wrapper rg-collapsible-fight rg-collapsed">
    <!-- Live example users can interact with -->
  </div>
</div>
```

### 4. Landing Page Showcase (`landing/content-styles.html`)
```html
<!-- Public documentation -->
<section id="collapsible">
  <h2>Collapsible Content Types</h2>
  <!-- Interactive examples -->
  <details class="cs-collapsible-card cs-collapsible-fight">
    <summary>⚔️ Fight Scene Example</summary>
    <!-- Example content -->
  </details>
</section>
```

---

## TTS / Read-Aloud Behavior

The system respects collapsed/expanded state during text-to-speech:

```javascript
export function getReadAloudText(container) {
  // For each .rg-collapsible-wrapper:
  //   - If collapsed: read only .rg-collapsible-summary-block
  //   - If expanded: read .rg-collapsible-content

  if (wrapper.classList.contains('rg-collapsed')) {
    include(summaryBlock.textContent);
  } else {
    include(contentBlock.textContent);
  }
}
```

**Example:**
- User collapses fight scene, reads aloud
  → TTS reads: "⚔️ Kael defeats the knight in 30 seconds"
- User expands fight scene, reads aloud
  → TTS reads: Full combat sequence with all details

---

## Gemini Prompt Integration

The system backend sends instructions to Gemini:

```
For the following content sections, use this structure:

- **Fight Scene** — Use <div class="rg-collapsible-section" data-type="fight"
  data-summary="[one sentence summary]">…</div>

- **R18 Content** — Use data-type="r18" with summary explaining what's being hidden

- **Author's Note** (if long/off-topic) — Use .rg-author-note with data-collapse="true"

Custom types available:
[...user-defined custom types...]
```

---

## Accessibility & UX Considerations

- **Keyboard Navigation**: Header is focusable, Enter/Space toggles
- **Screen Readers**: Headers are exposed; content blocks marked appropriately
- **Semantic HTML**: Proper role attributes for collapsible patterns
- **Visual Feedback**: Clear state indicators (▼ Read / ▲ Collapse)
- **Color + Icons**: Not relying on color alone to distinguish types
- **Mobile**: Full-width headers, tap targets are 44px minimum

---

## Troubleshooting

### Sections aren't collapsing
1. Check `contentFilterSettings` in storage (DevTools → Storage)
2. Verify `enabled: true` for the type
3. Ensure `renderCollapsibleSections()` called after Gemini injection

### Text-to-speech reading wrong content
1. Toggle collapsed/expanded state with header
2. Check that `.rg-collapsible-summary-block` and `.rg-collapsible-content` have correct content

### Custom types not appearing
1. Navigate to Settings → Content Filters
2. Click "+ Add Type"
3. Ensure `id`, `name`, `icon` are filled
4. Save settings
5. Refresh chapter page

---

## Future Enhancements

- [ ] Animated transitions for collapse/expand
- [ ] per-chapter collapse history ("remember my choices on this chapter")
- [ ] Keyboard shortcut to toggle all collapsibles
- [ ] Stats dashboard ("this chapter had 3 fights, 2 R18 sections")
- [ ] Export collapsed reading vs. expanded reading (two versions)
- [ ] Inline CSS integration for color themes

---

## Related Files

- **Core Logic**: [`src/utils/collapsible-sections.js`](src/utils/collapsible-sections.js)
- **Content Integration**: [`src/content/content.js`](src/content/content.js)
- **Settings UI**: [`src/library/library-settings.html`](src/library/library-settings.html), [`src/library/library-settings.js`](src/library/library-settings.js)
- **Landing Showcase**: [`landing/content-styles.html`](landing/content-styles.html)
- **CSS Styling**: [`src/content/content.css`](src/content/content.css)
