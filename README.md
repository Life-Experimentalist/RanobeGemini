# Ranobe Gemini

> **NOTICE FOR REVIEWERS:** Please check this [Reviewer Notes](REVIEWER%20NOTES.md)

<div align="center">

<picture>
  <img src="src/icons/logo-256.png" alt="Ranobe Gemini Logo" width="256"/>
</picture>

<br/>

---

## Cross-platform AI reading companion for web novels and fanfiction

Ranobe Gemini is a local-first browser extension that enhances chapter readability, generates summaries, and manages a full reading library across multiple sites.

<br/>

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Version](https://img.shields.io/github/package-json/v/Life-Experimentalist/RanobeGemini?style=flat&color=blueviolet)](https://github.com/Life-Experimentalist/RanobeGemini/releases)
[![GitHub Issues](https://img.shields.io/github/issues/Life-Experimentalist/RanobeGemini?style=flat&logo=github)](https://github.com/Life-Experimentalist/RanobeGemini/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/Life-Experimentalist/RanobeGemini?style=flat&logo=github)](https://github.com/Life-Experimentalist/RanobeGemini/pulls)
[![Mozilla Add-on Users](https://img.shields.io/amo/users/ranobegemini?style=flat&logo=firefox&label=Users)](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/)
[![Mozilla Add-on](https://img.shields.io/amo/v/ranobegemini?style=flat&logo=firefox&label=Firefox%20Add-on)](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/)
[![Mozilla Add-on Downloads](https://img.shields.io/amo/dw/ranobegemini?style=flat&logo=firefox&label=Downloads)](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/)
[![Mozilla Add-on Rating](https://img.shields.io/amo/rating/ranobegemini?style=flat&logo=firefox&label=Rating)](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/)
[![GitHub Stars](https://img.shields.io/github/stars/Life-Experimentalist/RanobeGemini?style=flat&logo=github)](https://github.com/Life-Experimentalist/RanobeGemini/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Life-Experimentalist/RanobeGemini?style=flat&logo=github)](https://github.com/Life-Experimentalist/RanobeGemini/network/members)
[![MV3](https://img.shields.io/badge/Manifest-V3-orange?style=flat)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Gemini AI](https://img.shields.io/badge/Powered%20by-Gemini%20AI-4285F4?style=flat&logo=google)](https://ai.google.dev/)
[![Edge Add-on](https://img.shields.io/badge/Microsoft%20Edge-Add--on-0078d7?style=flat&logo=microsoftedge)](https://microsoftedge.microsoft.com/addons/detail/ranobe-gemini/agbhdkiciomjlifhlfbjanpnhhokaimn)
[![ranobe-startup](https://counter.vkrishna04.me/api/views/ranobe-gemini-startup/badge?style=flat-square&color=brightgreen&label=rg-startup)](https://counter.vkrishna04.me/api/views/ranobe-gemini-startup)
[![rg-update](https://counter.vkrishna04.me/api/views/ranobe-gemini-extension_update/badge?style=flat-square&color=orange&label=rg-update)](https://counter.vkrishna04.me/api/views/ranobe-gemini-extension_update)
[![rg-install](https://counter.vkrishna04.me/api/views/ranobe-gemini-extension_install/badge?style=flat-square&color=purple&label=rg-install)](https://counter.vkrishna04.me/api/views/ranobe-gemini-extension_install)
[![rg-feature-usage](https://counter.vkrishna04.me/api/views/ranobe-gemini-feature_usage/badge?style=flat-square&color=teal&label=rg-feature-usage)](https://counter.vkrishna04.me/api/views/ranobe-gemini-feature_usage)
[![rg-opt-in](https://counter.vkrishna04.me/api/views/ranobe-gemini-opt_in/badge?style=flat-square&color=00b894&label=rg-opt-in)](https://counter.vkrishna04.me/api/views/ranobe-gemini-opt_in)

</div>

## Privacy-safe impact metrics

- Metrics are collected only after explicit consent on first Library open.
- Telemetry records anonymous event counts only (startup/install/feature usage/opt-in/out).
- No chapter text, reading history payloads, API keys, OAuth tokens, or personal identifiers are sent.
- Public counters are visible on the landing page: https://ranobe.vkrishna04.me/#impact

<!-- GitHub Topics (keep in sync with the `keywords` array in package.json):
     browser-extension firefox-addon chrome-extension edge-extension manifest-v3
     web-novels fanfiction ao3 scribblehub ranobes novel-library reading-tracker
     gemini openai-compatible ollama local-first summarization grammar-correction -->

## Features

- **AI-Powered Enhancement**: Improves grammar, flow, and readability of translated text using the AI provider you configure — Gemini, any OpenAI-compatible endpoint, or a local Ollama model that keeps every word on your machine.
- **Chapter Summarization**: Generates concise or detailed summaries for long chapters without leaving the page.
- **Multi-Site Support**: Works on `ranobes.top`, `fanfiction.net` (desktop + mobile), `archiveofourown.org` (AO3), `scribblehub.com`, and more.
- **Novel Library**: Track novels across all supported sites with shelf-aware metadata, reading status, characters, relationships, genres, and tags.
- **Shareable Library Deep Links**: Open and share direct modal links like `library.html?novel=<id>&openModal=1` with context-aware prev/next modal navigation on the library and per-site shelf pages.
- **Missing-ID Recovery Flow**: If a shared modal link points to a novel not yet in your library, Ranobe Gemini can regenerate the source URL, open it, and auto-add the entry.
- **Reading Lists & Badges**: Apply list badges independent of status (`🔁 Rereading`, `⭐ Favourites`, plus custom labels like `R18`).
- **Unified Status Dropdown**: Manage primary status and toggle reading-list membership directly from each novel card dropdown.
- **Compact Mobile Controls**: Narrow-screen library chips and filters stay compact instead of forcing full-width buttons.
- **Adaptive URL Import**: Import URLs now canonicalize per-handler templates, skip novels already in your library, and suppress duplicate links in the same paste batch.
- **Reading Typeface**: Pick the font enhanced chapters are set in — Literata, Merriweather, Atkinson Hyperlegible or Inter, all bundled with the extension so nothing is fetched while you read — or keep the site's own font, Georgia, or your system's sans-serif. No claim is made that any of them is read faster; each is described by what it was drawn for, and the choice is yours. Every bundled family is SIL Open Font License 1.1 and its licence ships with it.
- **Collapsible Content Sections**: Fight scenes, R18 content, and author notes can be hidden/shown on demand.
- **Incognito Mode**: Temporarily pause library tracking without disabling the extension.
- **Custom Content Box Types**: Define your own CSS classes and styling for special content blocks.
- **Smart Chunking**: Automatically splits large chapters (10 K+ words) to avoid API timeouts, with pause/skip controls.
- **Canvas Background Animations**: Five animation types (particles, snow, rain, falling leaves, fireflies) for library pages, color-synced to your theme.
- **Theme System**: Multiple built-in themes (Tokyo Night, Catppuccin Mocha, Synthwave, and more) with auto dark/light scheduling.
- **Rolling Backups**: Automatic backup rotation (up to 5 snapshots) in browser storage; one-click restore.
- **Optional Encrypted Backups**: Off by default. When enabled, exported files and cloud backups are wrapped in AES-GCM-256 with a 256-bit key generated on your machine — no server, no account, nothing transmitted. A recovery code carries the key to another browser, since Firefox and Chrome do not share extension storage. Plaintext export remains available, and pre-existing plaintext backups still restore. Native browser sync is intentionally left unencrypted: it writes to `browser.storage.sync`, which is where the key lives.
- **Cloud Sync — Native, Google Drive, OneDrive, Dropbox, WebDAV**: Zero-config Native Browser Sync via `browser.storage.sync` (default, no credentials needed); OAuth-based backup to Google Drive or Microsoft OneDrive (PKCE); Dropbox API v2 with offline refresh tokens; any self-hosted WebDAV server (Nextcloud, Seafile, etc.). Multi-sync fan-out lets you write to two providers simultaneously. All OAuth providers include a tab-based fallback for Android and restricted environments.
- **True Web PWA Entry**: Installable landing web app (Android/Windows supported browsers) with secure extension presence detection and library handoff.
- **Customizable Prompts**: Per-site and per-novel prompts for enhancement, summarization, and permanent instructions.
- **Provider Selection**: Switch the active AI provider in popup settings (`Gemini`, `OpenAI-compatible`, `Ollama`) without changing core workflows.
- **Multiple Gemini Models**: Gemini 3 Flash Preview is the default; 2.5 Flash is the built-in fallback, and Gemini 3 Pro Preview is available for the highest quality. Once an API key is saved the model dropdowns are populated from Google's live `models` endpoint, so new models appear without an extension update. Backup key rotation is supported. (The offline fallback list and both defaults live in `src/utils/constants.js` — `GEMINI_MODELS`, `DEFAULT_MODEL_ID`, and `DEFAULT_BACKUP_MODEL_ID` are the authority if this line ever drifts.)
- **Export Templates**: Configurable filename templates for novel copy/download operations.
- **FicHub Integration**: One-click download button for EPUB/MOBI via FicHub.
- **Restore Original**: Revert to the original chapter text at any time.
- **Dynamic Domain System**: Automatically handles subdomains and new site variations via build-time manifest generation.

## Installation (Firefox)

**From Firefox Add-ons (Recommended)**:

1. Visit the [Firefox Add-ons page](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/)
2. Click "Add to Firefox"
3. Confirm the installation when prompted

**Latest Version from GitHub Releases (If AMO is pending update)**:

> ⚠️ **Note**: The GitHub [Releases page](https://github.com/Life-Experimentalist/RanobeGemini/releases) always contains the latest official build. If the Firefox Add-ons store hasn't been updated yet with the newest version, download from GitHub releases.

1. **Download**: Go to the [Releases page](https://github.com/Life-Experimentalist/RanobeGemini/releases) and download the latest `RanobeGemini_vX.X.X_firefox.zip` file.
2. **Install**: Open Firefox, navigate to `about:addons`, click the gear icon, select "Install Add-on From File...", and choose the downloaded ZIP file.

**For Development**:

1. Clone the repository: `git clone https://github.com/Life-Experimentalist/RanobeGemini.git`
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..." and select `src/manifest-firefox.json`.

Loading straight from `src/` skips the build, which is what makes it fast to
iterate on — but it also skips the generated handler registry and domain match
patterns. After adding or changing a site handler, run `npm run build` and load
`dist/dist-firefox/manifest.json` instead.

## Installation (Edge + Other Browsers)

- Edge (published): https://microsoftedge.microsoft.com/addons/detail/ranobe-gemini/agbhdkiciomjlifhlfbjanpnhhokaimn
- Firefox (published): https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/
- Chrome / Brave / Opera / Vivaldi / Ulaa / Arc: temporary/sideload install from the latest Chromium package.

For the canonical Google Drive OAuth redirect URI setup, use:

- Landing install guide: https://ranobe.vkrishna04.me/install-guide.html

The landing page checks for an installed extension through a safe external ping before showing the direct library button.

## Build Instructions (For AMO Reviewers)

Full reviewer documentation, including what is injected at build time and where
the extension sends data, is in [REVIEWER NOTES.md](REVIEWER%20NOTES.md). The
short version follows.

### Build Environment

- **Operating System**: cross-platform (Windows, Linux, macOS)
- **Node.js**: 22 or newer — CI builds on **24**, the Active LTS line. 22 is
  the floor because it is the oldest release still receiving security fixes;
  Node 20 reached end-of-life in April 2026.
- **npm**: 10 or newer
- **Architecture**: x64 or ARM64
- **Disk space**: ~50 MB for dependencies and build output

No other toolchain is required — no native modules, no Python, no Docker.

### Building from Source

```bash
npm ci && npm run package
```

**Output**, with the version taken from `package.json`:

- `releases/RanobeGemini_v<version>_firefox.zip`
- `releases/RanobeGemini_v<version>_chromium.zip`

Both `dist/` and `releases/` are local build outputs and are gitignored.
Published builds are attached to their
[GitHub Release](https://github.com/Life-Experimentalist/RanobeGemini/releases)
rather than committed, so cloning this repository does not download every zip
ever shipped.

### Build Process Details

`dev/build.js` is the whole build. `npm run package` runs it with `--package`,
which:

1. Generates `src/utils/website-handlers/handler-registry.js` and the `matches`
   patterns in both manifests from the handler files
   (`dev/generate-manifest-domains.js`). Supported-site lists are never hand-edited.
2. Copies `src/` into `dist/dist-firefox/` and `dist/dist-chromium/`, picking the
   matching manifest for each and injecting the version from `package.json`.
3. Substitutes build-time configuration placeholders in `src/utils/constants.js`
   from environment variables — see `.env.example`. All are optional; the build
   and the extension both work with none of them set.
4. Zips each output directory into `releases/`.

### Source Code Verification

The extension is built directly from `src/` with:

- **No minification** — all code remains in readable form
- **No obfuscation** — variable and function names are preserved
- **No transpilation** — plain ES2020+, no compile step
- **No bundling** — files are packaged as-is, no webpack or equivalent

The only transformations are the generated registry and match patterns in step 1
and the placeholder substitution in step 3. Everything else in the package is
byte-identical to the corresponding file in `src/`.

### Additional Build Commands

```bash
npm run package:source   # source archive for AMO submission
npm run update-domains   # regenerate manifest domains without a full build
npm run watch            # build, then rebuild on changes to src/
npm run lint             # ESLint over src/
npm test                 # node --test over tests/
```

### Store Publishing

For release automation, use `npm run publish:stores` after the build artifacts are ready.

- Publishing is now **modular**: stores run only when configured.
- Missing credentials are skipped by default (no hard failure).
- Set `PUBLISH_STRICT=true` to fail when an explicitly enabled store is missing required credentials.

Environment modes per store:

- `PUBLISH_FIREFOX=auto|on|off`
- `PUBLISH_CHROME=auto|on|off`
- `PUBLISH_EDGE_MANUAL=auto|on|off`
- Optional Chromium-manual channels:
  - `PUBLISH_BRAVE_MANUAL=on`
  - `PUBLISH_OPERA_MANUAL=on`
  - `PUBLISH_VIVALDI_MANUAL=on`
  - `PUBLISH_ULAA_MANUAL=on`
  - `PUBLISH_ARC_MANUAL=on`

Required credentials:

- Firefox AMO API: `AMO_API_KEY`, `AMO_API_SECRET`
- Chrome Web Store API: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`

Optional Firefox publish extras (not required for standard version submission):

- `AMO_METADATA_FILE` (when you need to submit metadata payload via `web-ext sign`)
- `AMO_UPLOAD_SOURCE_CODE=true|false` (defaults to enabled if a source zip exists)

### Edge Add-ons API Credentials (What Key to Use)

Edge Add-ons publishing does not use a single "store key" like AMO. Use Partner Center API credentials:

1. Open Microsoft Partner Center and go to your Edge Add-ons product.
2. Open API access / credentials for the product.
3. Create an app credential set (client app).
4. Save values securely (tenant/app identifiers and secret values provided by Partner Center/Azure setup flow).
5. Keep these in CI secrets only.

Until a stable automated path is enabled in this repo, `PUBLISH_EDGE_MANUAL` keeps Edge in artifact-assisted manual submission mode.

## Usage

1. **Configure Provider**: Click the Ranobe Gemini icon in your Firefox toolbar. In popup settings, select your AI provider and configure credentials (Gemini API key, OpenAI-compatible key/endpoint, or local Ollama runtime as needed).
2. **Navigate**: Go to a chapter page on any supported site — see [Supported Websites](#supported-websites) below.
3. **Enhance/Summarize**: Click the "Enhance with Gemini" or "Summarize Chapter" buttons that appear near the chapter content.
4. **View Results**: Wait for the processing to complete. The enhanced text will replace the original, or the summary will appear.
5. **Restore**: Use the "Restore Original" button if needed.

## Configuration

Access the extension's settings via the toolbar icon:

- **API Key**: Essential for the extension to function.
- **AI Provider**: Select `Gemini`, `OpenAI-compatible`, or `Ollama` as the active runtime provider.
- **Sync Provider**: Select the active storage sync backend (`Native Browser Sync` is the default, no credentials required; `Google Drive`, `OneDrive`, `Dropbox`, and `WebDAV` are also available).
- **Gemini Model**: Select the desired AI model.
- **Prompts**: Customize the Enhancement, Summary, and Permanent prompts.
- **Chunking**: Enable/disable automatic splitting of large chapters.
- **Reading Text**: Font size and typeface for enhanced chapters (Library -> Settings -> General).
- **Debug Mode**: Enable console logging for troubleshooting.

## Supported Websites

The authoritative list is the set of `*-handler.js` files in
`src/utils/website-handlers/`; the build derives the manifest match patterns
from them. This table is maintained alongside those files.

| Site                         | Domains                                             | Notes                                                         |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| **Ranobes**                  | ranobes.top, ranobes.net, ranobes.com, ranobes.org  | Novel + chapter pages                                         |
| **FanFiction.net**           | fanfiction.net, fanfiction.ws (desktop and mobile)  | Separate desktop and mobile handlers                          |
| **Archive of Our Own (AO3)** | archiveofourown.org, ao3.org                        | Work + chapter pages                                          |
| **ScribbleHub**              | scribblehub.com                                     | Series + chapter pages                                        |
| **NovelArrow**               | novelarrow.com                                      | SPA navigation supported                                      |
| **NovelBin**                 | novelbin.com, novelbin.me                           | SPA navigation supported                                      |
| **WebNovel**                 | webnovel.com                                        | Temporarily disabled — infinite scroll refinement in progress |

## Architecture & Development

For developers extending or contributing to Ranobe Gemini:

- **[Architecture Documentation](docs/architecture/MODULAR_SYSTEMS_README.md)** — Detailed system design and modular architecture
- **[Quick Reference](docs/WHATS_WHERE.md)** — Index of all systems and where things are located
- **[Implementation Guide](docs/implementation/METADATA_AND_SETTINGS_GUIDE.md)** — Metadata fetching and handler settings API
- **[Build System](docs/build/BUILD_SYSTEM.md)** — Complete build process, scripts, and manifest generation
- **[Visual Dashboard](docs/overview/VISUAL_DASHBOARD.md)** — Auto-generated Mermaid charts for browser/site support and delivery topology
- **[Changelog](docs/release/CHANGELOG.md)** — Full version history

## Adding New Website Support

Please refer to the [docs/ADDING_NEW_WEBSITES.md](docs/guides/ADDING_NEW_WEBSITES.md) guide for instructions on how to extend the extension to support more websites.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) and check out the [Contributing Guidelines](CONTRIBUTING.md) before getting started.

## License

This project is licensed under the Apache License, Version 2.0. See [LICENSE.md](LICENSE.md) for details.

Copyright 2025 VKrishna04

## Acknowledgements

- [Google Gemini API](https://ai.google.dev/) — the default provider, and the
  one the extension is named after; OpenAI-compatible endpoints and local
  [Ollama](https://ollama.com/) are equally supported
- EPUB/MOBI downloads via [FicHub](https://fichub.net/)
- OAuth backup support for [Google Drive](https://drive.google.com/) via the canonical `ranobe.vkrishna04.me/oauth-redirect.html` flow

---

## Project Topics

`browser-extension` `firefox-extension` `chrome-extension` `edge-extension` `gemini-ai` `web-novel` `fanfiction` `archiveofourown` `ranobes` `scribblehub` `reading-tracker` `novel-library` `javascript` `manifest-v3` `google-ai` `ai-enhancement` `light-novel` `translation`

> Stats note: Anonymous aggregate usage counters are powered by CFlair Counter and only run after telemetry consent in the Library.
