# Ranobe Gemini v4.0.0 — Store Release Notes

**Release Date**: March 6, 2026

---

## Firefox Add-ons Store (Short)

Ranobe Gemini 4.0.0 — Major release. New canvas background animations (particles, snow, rain, fireflies, falling leaves) for library pages, a full library card renderer overhaul with modals from the main page, a Notifications tab in the popup, per-novel auto-enhance toggles, and a Backup Download Manager. FanFiction and Ranobes handlers improved with better redirects and richer metadata. Gemini UI toggle fixed across all summary groups. No data migration needed.

---

## Edge Add-ons Store (Short)

Ranobe Gemini 4.0.0 — Major update with stunning new library animations, a redesigned card renderer, popup Notifications tab, and per-novel auto-enhance controls. FanFiction and Ranobes site support improved. Full backward compatibility with your existing library and settings.

---

## Chrome Web Store (Short, ≤ 132 chars per paragraph)

**What's new in 4.0.0:**

✨ Canvas background animations — particles, snow, rain, falling leaves, and fireflies for your library.

📚 Library card renderer rebuilt: async, site-specific designs, modals accessible from the main page.

🔔 Notifications tab in the popup — browse and clear your notification history at a glance.

⚡ Auto-enhance toggles per novel directly in the popup history list.

💾 Backup Download Manager — list, download, and restore snapshots from the browser.

🌐 FanFiction: bare-domain redirect, profile-page filtering, improved mobile support.

🌐 Ranobes: chapter-index pages excluded, richer metadata extraction.

🐛 Gemini UI toggle now correctly hides all summary groups. No breaking changes.

---

## GitHub Release Body (Markdown, medium length)

### Ranobe Gemini v4.0.0 🎉

**Release Date**: March 6, 2026

#### Highlights

- 🎨 **Canvas animations** — 5 new animated backgrounds for library pages (Particles, Snow, Rain, Falling Leaves, Fireflies) that auto-color-match your theme
- 📚 **Library card renderer overhaul** — async site-specific card designs, novel modals available from the main library page
- 🔔 **Popup Notifications tab** — full notification history, icons, timestamps, clear button
- ⚡ **Auto-enhance per novel** — toggle Gemini auto-enhancement directly from the popup
- 💾 **Backup Download Manager** — new `backup-download.js` for listing, downloading, and restoring snapshots
- 🌐 **FanFiction improvements** — bare-domain redirect, `/u/` profile filtering, better mobile handling
- 🌐 **Ranobes improvements** — chapter-index page exclusion, richer metadata

#### Bug Fixes

- Gemini UI toggle now hides all summary groups and summary containers correctly
- AO3 card renderer stray-code duplication fixed
- Notification bell modal click-outside behavior restored
- Handler deduplication in handler-manager prevents double initialization

#### Migration

No data migration needed. All v3.x library data, API keys, and settings are fully compatible.

**[Full Release Notes](RELEASE_NOTES_4.0.0.md)** · **[Changelog](CHANGELOG.md)**
