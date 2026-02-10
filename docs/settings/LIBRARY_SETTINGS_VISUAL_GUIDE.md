# Library Settings — Visual Guide

This document presents a polished, accessible reference for the Library Settings modal. It covers layout patterns (desktop, tablet, mobile), component behavior, color usages, and accessibility considerations.

## Summary

- Purpose: Provide a clear, consistent UI for data management, backups, preferences, and developer options.
- Layout principle: A responsive "bento" grid that scales from 4 columns (desktop) to a single column (mobile).
- Primary areas: Data Management, Backups, Auto-Hold, Theme, AI Model, Font Size, Analytics, Developer tools, and Auto-Add by Site.

## Table of Contents

- [Library Settings — Visual Guide](#library-settings--visual-guide)
	- [Summary](#summary)
	- [Table of Contents](#table-of-contents)
	- [Key UI Areas](#key-ui-areas)
	- [Layouts](#layouts)
		- [Desktop — 4-column grid](#desktop--4-column-grid)
		- [Tablet — 2–3 column grid](#tablet--23-column-grid)
		- [Mobile — single-column stack](#mobile--single-column-stack)
	- [Interaction Patterns](#interaction-patterns)
	- [Color \& Visual Encoding](#color--visual-encoding)
	- [Responsive Breakpoints (recommended)](#responsive-breakpoints-recommended)
	- [Accessibility \& UX](#accessibility--ux)
	- [Implementation Guidance](#implementation-guidance)
	- [Design Rationale — Space \& Efficiency](#design-rationale--space--efficiency)

## Key UI Areas

- Data Management — Export / Import / Clear controls.
- Full Backup — Create, Restore, and Auto-rolling settings.
- Auto-Hold — Toggle with retention days.
- Theme — Theme mode selector and quick preview.
- AI Model — Temperature slider and model controls.
- Font Size — Live-adjustment slider with preview.
- Analytics — Usage and error-reporting toggles.
- Developer — Webhook URL and diagnostic tools.
- Auto-Add by Site — Full-width, scrollable site configuration.

## Layouts

### Desktop — 4-column grid

Layout: 4 columns × 2 rows plus one full-width section for site configuration.

- Top row: Data Management | Full Backup | Auto-Hold | Theme
- Second row: AI Model | Font Size | Analytics | Developer
- Full-width: Auto-Add by Site (configures each supported site individually)

Design goals: maximize information density while keeping controls discoverable and touch-friendly for larger trackpads.

### Tablet — 2–3 column grid

Layout adapts to 2–3 columns depending on width. Controls retain ample target sizes for touch.

### Mobile — single-column stack

All sections stack vertically in logical order (Data Management first, Auto-Add last). Controls use full width with large touch targets.

## Interaction Patterns

- Sliders (Temperature, Font Size): live-preview while dragging; value persists on change.
- Toggles (Theme, Analytics, Auto-Hold): immediate state change and background persistence.
- Dropdowns (Theme Mode): immediate application and UI preview.
- Full-width site configuration: expands/collapses per-site settings; supports keyboard navigation and screen reader announcements.

## Color & Visual Encoding

Use color to support quick scanning; do not rely on color alone for state:

| Section          | Color (hex) | Purpose                         |
| ---------------- | ----------: | ------------------------------- |
| Data Management  |     #667ee6 | Primary actions (export/import) |
| Full Backup      |     #34a853 | Success / backup actions        |
| Auto-Hold        |     #f59e0b | Warning / attention             |
| Theme            |     #f97316 | Visual configuration            |
| AI Model         |     #3b82f6 | Model / AI controls             |
| Font Size        |     #ec4899 | UI/display controls             |
| Analytics        |     #06b6d4 | Metrics / telemetry             |
| Developer        |     #64748b | Technical / admin tools         |
| Auto-Add by Site |     #8b5cf6 | Configuration scope             |

Accessibility notes: pair colors with icons and labels; include sufficient contrast and focus outlines for keyboard users.

## Responsive Breakpoints (recommended)

- Desktop: ≥ 1400px — 4 columns
- Large tablet: 1200–1400px — 3 columns
- Small tablet: 768–1200px — 2 columns
- Mobile: < 768px — 1 column

## Accessibility & UX

- All controls must have keyboard focus and ARIA labels where appropriate.
- Provide text equivalents for icons and include tooltip descriptions.
- Ensure color contrast meets WCAG AA for text and UI elements.

## Implementation Guidance

- Persist control values to local storage on change; apply minimal debounce for sliders to avoid excessive writes.
- Keep the Auto-Add by Site area lazy-loaded if the site list is large.
- Group related settings within semantic fieldsets; provide a single "Save All Settings" action and inline autosave for safe defaults.

## Design Rationale — Space & Efficiency

- The 4-column bento layout groups related functions, reducing cognitive load while keeping advanced options accessible.
- The full-width Auto-Add section provides room for many per-site controls without overwhelming the main grid.

---

If you would like, I can also generate a simplified HTML/CSS prototype or a component checklist for implementation. Which would you prefer?
