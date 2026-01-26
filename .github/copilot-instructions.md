<!-- Copilot / AI agent instructions for Ranobe Gemini -->

# Ranobe Gemini — Copilot instructions

Purpose: make AI coding agents productive quickly when editing, building, and packaging this browser-extension.

-   **Big picture**: this is a cross-browser (Firefox/Chromium) browser extension. Runtime pieces live under `src/`:

    -   `src/background/` — service-worker-style background logic (keep-alive, backups, message handlers).
    -   `content/` — DOM injection and page-specific parsing/UX (`content.js`, styles).
    -   `src/utils/website-handlers/` — one handler per site; filenames end with `-handler.js` and are auto-registered.
    -   `popup/`, `library/`, `icons/` — UI and assets.

-   **Build & release flow** (authoritative): use the `dev` scripts.

    -   Local dev: `npm install` then `npm run watch` (runs `dev/watch.js` to auto-build on changes).
    -   Full build: `npm run build` or `npm run package` (see `package.json` scripts).
    -   Packaging: `dev/package-firefox.js` and `dev/package-chromium.js` package `dist/dist-firefox` and `dist/dist-chromium` into `releases/`.
    -   Manifest generation: `dev/build.js` produces `dist/*/manifest.json` from `src/manifest-*.json` and the `version` in `package.json`.
    -   Domain generation & handler registry: `dev/generate-manifest-domains.js` and `dev/build.js` auto-generate domain match patterns and `handler-registry.js` from `src/utils/website-handlers/`.

-   **Conventions & patterns** (do not break):

    -   Handlers: Add a new `*-handler.js` in `src/utils/website-handlers/`; the build auto-registers them.
    -   Editing generated files: do not edit files in `dist/` or `releases/` — change sources under `src/` and run the build.
    -   Background script: `src/background/background.js` contains cross-browser shims (must place `browser` shim at top). Use `browser`-safe APIs.
    -   Chunking: large-chapter processing uses `src/utils/chunking.js`; prefer to follow that pattern for progressive processing.

-   **Key files to reference when coding**:

    -   `dev/build.js` — canonical build steps, asset copy list, manifest/version handling.
    -   `dev/generate-manifest-domains.js` — domain extraction logic used to update content script `matches`.
    -   `src/utils/website-handlers/` — site-specific selectors and extraction logic.
    -   `src/background/background.js` — message handlers, keep-alive, backup scheduling.
    -   `src/manifest-firefox.json` and `src/manifest-chromium.json` — source manifests maintained by devs.

-   **Developer workflows & debugging**:

    -   Run `npm run watch` while developing; it rebuilds on `src/` changes using `dev/watch.js` which invokes `npm run build`.
    -   Load the extension for testing via Firefox `about:debugging` → "Load Temporary Add-on" pointing at `src/manifest.json` (or use built `dist/dist-firefox`).
    -   Packaging expects built dist directories: `dist/dist-firefox` and `dist/dist-chromium` — ensure `npm run build -- --package` or `npm run package` was run first.

-   **Integration & external dependencies**:

    -   Google Gemini API usage and models are configured via constants in `src/utils/constants.js` and used in `src/background/` and `utils/` modules.
    -   Google Drive OAuth (PKCE) and backup flows live in `src/utils/drive.js`, with the OAuth redirect in `landing/oauth-redirect.html`. Do not hardcode secrets.

-   **What AI agents should avoid changing**:

    -   Never modify code in `dist/` or artifacts in `releases/` — these are build outputs.
    -   Do not change packaging scripts without updating `dev/package-*.js` and validating zip contents.
    -   Avoid changing the `manifest-*` templates in ways that the `dev/build.js` will overwrite unexpectedly (e.g., `version` and `matches`).

-   **Quick examples**:
    -   Add a handler: create `src/utils/website-handlers/my-site-handler.js` exporting the same shape as other handlers; run `npm run build` and verify `src/utils/website-handlers/handler-registry.js` includes it.
    -   Update domains: edit handlers, then run `npm run update-domains` (calls `dev/generate-manifest-domains.js`) before packaging.

If something here is unclear or you need an expanded rule (e.g., handler API shape or background messaging conventions), tell me which area to expand.

I want this project to be easy to contribute to and maintain!
I want this project to be very modular and can be easily add new website handlers and other features.
