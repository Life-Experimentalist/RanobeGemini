# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ranobe Gemini is a cross-browser (Firefox/Chromium/Edge) extension that enhances web novel reading using AI. It is local-first: no backend, user-owned API keys, optional user-owned cloud sync. The current version is whatever `package.json` says — do not restate it here, it goes stale. v5.0.0 is packaged in `releases/`; work since that tag is under "Unreleased" in `docs/release/CHANGELOG.md`.

**Use PowerShell exclusively** — this is a Windows environment. Always use `npm run` scripts, never call `dev/*.js` scripts directly.

## Build Commands

```powershell
npm install               # Install deps
npm run build             # Build both targets to dist/
npm run build:firefox     # Firefox only → dist/dist-firefox/
npm run build:chromium    # Chromium only → dist/dist-chromium/
npm run package           # Build + zip → releases/
npm run watch             # Build then watch src/ for changes
npm run lint              # ESLint src/**/*.js
npm run lint:fix          # Auto-fix lint errors
npm run update-domains    # Regenerate manifest domain match patterns from handlers
npm run docs:graphify     # Regenerate graphify-out/GRAPH_REPORT.md (local AST only, no API cost)
npm run publish           # Write commit history + full package + source zip
```

**Validation**: after any code change, run `npm run lint && npm run build` and fix all errors before finishing. Do not skip this.

## Architecture

### Top-level source layout (`src/`)

| Directory | Purpose |
|---|---|
| `background/` | Service-worker-style background script |
| `background/ai/` | Provider interface + registry; adapters for Gemini, OpenAI-compatible, Ollama |
| `background/storage/` | StorageInterface + orchestrator; GoogleDrive adapter |
| `background/message-handlers/` | Message routing from content/popup |
| `content/` | DOM-injected content script (`content.js`) + CSS |
| `content/modules/` | Modular runtime pieces extracted from `content.js` |
| `utils/website-handlers/` | One file per supported site; auto-registered by build |
| `utils/chunking/` | Large-chapter progressive processing system |
| `popup/` | Extension toolbar popup |
| `library/` | Full-page library app (`library.html`) and per-site shelf pages |
| `lib/` | `browser-polyfill.min.js` (webextension-polyfill) |
| `config/` | `config.js` runtime config loader |
| `icons/` | Extension icons and promotional assets |

### Key architectural facts

- **`src/utils/constants.js`** is the single source of truth for all shared default constants. Handler- or module-level overrides must be explicit and documented.
- **`content.js`** is the DOM-injected entry point (still ~7k lines, top modularization target). It dynamically imports modules via `browser.runtime.getURL()` — no static `import` at the top. All modules live under `src/content/modules/`.
- **`src/background/background.js`** must place the `browser` shim at the very top before any other code. It uses `import` (ES module background script).
- **Handler auto-registration**: `dev/build.js` reads all `*-handler.js` files in `src/utils/website-handlers/` and generates `src/utils/website-handlers/handler-registry.js` and domain match patterns in the manifests. Never edit `handler-registry.js` or the `matches` array in manifests by hand.
- **Manifests**: edit `src/manifest-firefox.json` and `src/manifest-chromium.json` only — the build merges version from `package.json`.
- **Never edit** anything under `dist/` or `releases/` — these are build outputs.

### AI provider pattern

`src/background/ai/provider-interface.js` defines the contract. `provider-registry.js` holds the runtime registry. Adding a new provider: create an adapter in `src/background/ai/providers/`, register it in `background.js`.

### Storage adapter pattern

`src/background/storage/storage-interface.js` defines the contract. `storage-orchestrator.js` selects the active adapter from user settings (`activeSync`). Adding a new sync provider: implement the interface, register in `background.js`.

### Adding a new site handler

1. Create `src/utils/website-handlers/my-site-handler.js` following the shape of existing handlers (see `handler-contract.js` for required exports).
2. Run `npm run build` — handler is auto-registered.
3. Verify `src/utils/website-handlers/handler-registry.js` contains the new entry.

## Roadmap Authority

`docs/overview/TECHNICAL_ROADMAP.md` is the authoritative technical roadmap. Phases 0–15 are all complete as of v5.0.0 — check the phase tables there rather than trusting a summary here.

The active work is `docs/development/PRODUCTION_READINESS_AUDIT.md`, which tracks every open finding with a severity and a resolution note. Read it before starting anything: a finding marked RESOLVED records what was actually done and why, and several original findings turned out to be wrong on investigation — those are corrected in place rather than deleted, so the document is also a record of what was checked.

When resuming roadmap work, use prompts in `.github/prompts/`:
- `get-to-work.prompt.md` — continuous autonomous multi-phase loop
- `roadmap-continue-autonomous.prompt.md` — single-phase resume
- `roadmap-implementation.prompt.md` — targeted single-task execution
- `release-notes.prompt.md` — release generation

## Key Conventions

- **Emoji encoding**: all emoji in source files must be encoded via `npm run emoji:encode:src` before committing. Run `npm run emoji:scan` to check. Inline emoji in HTML/JS will fail emoji-tools validation.
- **Documentation surfaces**: when implementing a user-visible feature, update all three: `README.md`, `landing/*.html`, and `docs/`.
- **Release notes format**: every release requires both a long-form note and a short quick-summary in the same file. See `docs/release/RELEASE_NOTES_4.6.0.md` as the canonical example.
- **Historical records**: never alter `docs/release/RELEASE_NOTES_*.md` or `docs/release/commit-history.md` unless explicitly asked.
- **Mermaid diagrams**: use vertical orientation (`graph TD` / `stateDiagram-v2`) and include a "Diagram elements" list below each diagram.
- **Build secrets**: use `.env` for secrets; the build injects them via placeholder replacement. Never hardcode secrets in source. `npm run build` will fail with an actionable error if required secrets are missing.

## Loading the Extension for Testing

- **Firefox**: `about:debugging` → "Load Temporary Add-on" → point to `src/manifest-firefox.json` (for rapid iteration) or `dist/dist-firefox/manifest.json` (built).
- **Chromium**: `chrome://extensions` → Developer mode → "Load unpacked" → `dist/dist-chromium/`.

## Tech Stack

- Plain HTML/CSS/JS (no framework). `webextension-polyfill` for cross-browser API compatibility.
- ESLint + Prettier for code quality.
- Node.js `dev/` scripts for build, packaging, publish, and tooling.
- Python `graphify` package for codebase topology maps (`npm run docs:graphify`).
