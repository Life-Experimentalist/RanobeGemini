# Ranobe Gemini

> **NOTICE FOR REVIEWERS:** Please check this [Reviewer Notes](REVIEWER%20NOTES.md)

<div align="center">

<picture>
  <img src="src/icons/logo-256.png" alt="Ranobe Gemini Logo" width="256"/>
</picture>

<br/>

---

## A Cross-Platform browser extension that enhances web novel translations using Google's Gemini AI. It improves readability, fixes grammar, and can summarize chapters, supporting multiple web novel platforms

<br/>

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Version](https://img.shields.io/badge/version-4.6.0-blueviolet?style=flat)](https://github.com/Life-Experimentalist/RanobeGemini/releases)
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
[![vkrishna04-portfolio](https://counter.vkrishna04.me/api/views/vkrishna04-portfolio/badge?style=flat-square&color=blue&label=vkrishna04-portfolio)](https://counter.vkrishna04.me/api/views/vkrishna04-portfolio)
[![ranobe-startup](https://counter.vkrishna04.me/api/views/ranobe-gemini-startup/badge?style=flat-square&color=brightgreen&label=rg-startup)](https://counter.vkrishna04.me/api/views/ranobe-gemini-startup)
[![rg-update](https://counter.vkrishna04.me/api/views/ranobe-gemini-extension_update/badge?style=flat-square&color=orange&label=rg-update)](https://counter.vkrishna04.me/api/views/ranobe-gemini-extension_update)
[![rg-install](https://counter.vkrishna04.me/api/views/ranobe-gemini-extension_install/badge?style=flat-square&color=purple&label=rg-install)](https://counter.vkrishna04.me/api/views/ranobe-gemini-extension_install)
[![rg-feature-usage](https://counter.vkrishna04.me/api/views/ranobe-gemini-feature_usage/badge?style=flat-square&color=teal&label=rg-feature-usage)](https://counter.vkrishna04.me/api/views/ranobe-gemini-feature_usage)
[![Eldritchify](https://counter.vkrishna04.me/api/views/Eldritchify/badge?style=flat-square&color=red&label=Eldritchify)](https://counter.vkrishna04.me/api/views/Eldritchify)
[![rg-opt-out](https://counter.vkrishna04.me/api/views/ranobe-gemini-opt_out/badge?style=flat-square&color=yellow&label=rg-opt-out)](https://counter.vkrishna04.me/api/views/ranobe-gemini-opt_out)

</div>

<!-- GitHub Topics: browser-extension firefox-extension chrome-extension edge-extension gemini-ai web-novel fanfiction ao3 ranobes scribblehub reading-tracker novel-library javascript manifest-v3 google-ai ai-enhancement -->

## Features

- **AI-Powered Enhancement**: Improves grammar, flow, and readability of translated text using Gemini AI.
- **Chapter Summarization**: Generates concise or detailed summaries for long chapters without leaving the page.
- **Multi-Site Support**: Works on `ranobes.top`, `fanfiction.net` (desktop + mobile), `archiveofourown.org` (AO3), `scribblehub.com`, and more.
- **Novel Library**: Track novels across all supported sites with shelf-aware metadata, reading status, characters, relationships, genres, and tags.
- **Shareable Library Deep Links**: Open and share direct modal links like `library.html?novel=<id>&openModal=1` (including per-site shelf pages).
- **Missing-ID Recovery Flow**: If a shared modal link points to a novel not yet in your library, Ranobe Gemini can regenerate the source URL, open it, and auto-add the entry.
- **Reading Lists & Badges**: Apply list badges independent of status (`🔁 Rereading`, `⭐ Favourites`, plus custom labels like `R18`).
- **Unified Status Dropdown**: Manage primary status and toggle reading-list membership directly from each novel card dropdown.
- **Compact Mobile Controls**: Narrow-screen library chips and filters stay compact instead of forcing full-width buttons.
- **Adaptive URL Import**: Import URLs now canonicalize per-handler templates, skip novels already in your library, and suppress duplicate links in the same paste batch.
- **Collapsible Content Sections**: Fight scenes, R18 content, and author notes can be hidden/shown on demand.
- **Incognito Mode**: Temporarily pause library tracking without disabling the extension.
- **Custom Content Box Types**: Define your own CSS classes and styling for special content blocks.
- **Smart Chunking**: Automatically splits large chapters (10 K+ words) to avoid API timeouts, with pause/skip controls.
- **Canvas Background Animations**: Five animation types (particles, snow, rain, falling leaves, fireflies) for library pages, color-synced to your theme.
- **Theme System**: Multiple built-in themes (Tokyo Night, Catppuccin Mocha, Synthwave, and more) with auto dark/light scheduling.
- **Rolling Backups**: Automatic backup rotation (up to 5 snapshots) in browser storage; one-click restore.
- **Google Drive Sync**: Optional OAuth-based backup to Google Drive with configurable retention.
- **True Web PWA Entry**: Installable landing web app (Android/Windows supported browsers) with library hub and extension handoff.
- **Customizable Prompts**: Per-site and per-novel prompts for enhancement, summarization, and permanent instructions.
- **Multiple Gemini Models**: Gemini 2.0 Flash (recommended), 2.5 Flash (fastest), 2.5 Pro (highest quality), with backup key rotation.
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

1. **Download**: Go to the [Releases page](https://github.com/Life-Experimentalist/RanobeGemini/releases) and download the latest `RanobeGemini_vX.X.X.zip` file.
2. **Install**: Open Firefox, navigate to `about:addons`, click the gear icon, select "Install Add-on From File...", and choose the downloaded ZIP file.

**For Development**:

1. Clone the repository: `git clone https://github.com/Life-Experimentalist/RanobeGemini.git`
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..." and select the `manifest.json` file inside the `src` directory.

## Installation (Edge + Other Browsers)

- Edge (published): https://microsoftedge.microsoft.com/addons/detail/ranobe-gemini/agbhdkiciomjlifhlfbjanpnhhokaimn
- Firefox (published): https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/
- Chrome / Brave / Opera / Vivaldi / Ulaa / Arc: temporary/sideload install from the latest Chromium package.

For full browser-specific steps and Google Drive OAuth redirect ID guidance, use:

- Landing install guide: https://ranobe.vkrishna04.me/install-guide.html

## Build Instructions (For AMO Reviewers)

### Build Environment

- **Operating System**: Cross-platform (Windows/Linux/macOS compatible)
- **Node.js**: v14 or higher (tested with Node.js 22 LTS)
- **npm**: v6 or higher (tested with npm 10)
- **Architecture**: x64 or ARM64
- **Disk Space**: ~50MB for dependencies and build

### Prerequisites

```bash
# Install Node.js and npm (if not already installed)
# Visit https://nodejs.org/ for installation instructions

# Verify installation
node --version
npm --version
```

### Building from Source

```bash
# 1. Install dependencies
npm install

# 2. Build the extension
npm run package
```

**Output**: `releases/RanobeGemini_v4.4.0.zip`

### Build Process Details

The `npm run package` command executes:

1. **`npm run update-domains`** - Runs `dev/generate-manifest-domains.js` to extract domains from handler files and update `src/manifest.json` match patterns
2. **`npm run archive`** - Runs `dev/package-firefox.js` to create a zip archive of the `src/` directory

### Source Code Verification

The extension is built directly from the `src/` directory with:

- **No minification** - All code remains in readable form
- **No obfuscation** - Variable and function names are preserved
- **No transpilation** - Pure JavaScript ES6+ without compilation
- **No bundling** - Files are packaged as-is without webpack or similar tools

Only processing performed:

- Automatic generation of `manifest.json` match patterns from handler domain arrays (see `dev/generate-manifest-domains.js`)

### Additional Build Commands

```bash
# Generate source code package for submission
npm run package-source

# Update manifest domains without building
npm run update-domains

# Development watch mode
npm run watch
```

## Usage

1. **Configure API Key**: Click the Ranobe Gemini icon in your Firefox toolbar. Go to the "Settings" tab and enter your Gemini API key. You can get a free key from [Google AI Studio](https://makersuite.google.com/app/apikey).
2. **Navigate**: Go to a chapter page on any supported website (Ranobes, FanFiction.net, AO3, or WebNovel).
3. **Enhance/Summarize**: Click the "Enhance with Gemini" or "Summarize Chapter" buttons that appear near the chapter content.
4. **View Results**: Wait for the processing to complete. The enhanced text will replace the original, or the summary will appear.
5. **Restore**: Use the "Restore Original" button if needed.

## Configuration

Access the extension's settings via the toolbar icon:

- **API Key**: Essential for the extension to function.
- **Gemini Model**: Select the desired AI model.
- **Prompts**: Customize the Enhancement, Summary, and Permanent prompts.
- **Chunking**: Enable/disable automatic splitting of large chapters.
- **Debug Mode**: Enable console logging for troubleshooting.

## Supported Websites

| Site                         | Domains                                                      | Notes                                                         |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| **Ranobes**                  | ranobes.top, ranobes.net, ranobes.com, ranobes.org, and more | Novel + chapter pages                                         |
| **FanFiction.net**           | www.fanfiction.net, m.fanfiction.net, fanfiction.ws          | Desktop + mobile handlers                                     |
| **Archive of Our Own (AO3)** | archiveofourown.org, ao3.org                                 | Work + chapter pages                                          |
| **ScribbleHub**              | scribblehub.com                                              | Series + chapter pages                                        |
| **WebNovel**                 | webnovel.com                                                 | Temporarily disabled — infinite scroll refinement in progress |

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

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.

Copyright 2025 VKrishna04

## Acknowledgements

- Powered by the [Google Gemini API](https://ai.google.dev/)
- EPUB/MOBI downloads via [FicHub](https://fichub.net/)
- OAuth backup support for [Google Drive](https://drive.google.com/)

---

## Project Topics

`browser-extension` `firefox-extension` `chrome-extension` `edge-extension` `gemini-ai` `web-novel` `fanfiction` `archiveofourown` `ranobes` `scribblehub` `reading-tracker` `novel-library` `javascript` `manifest-v3` `google-ai` `ai-enhancement` `light-novel` `translation`

> Stats note: Anonymous aggregate usage counters are powered by CFlair Counter and only run after telemetry consent in the Library.
