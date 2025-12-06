# Ranobe Gemini

> **NOTICE FOR REVIEWERS:** Please check this [Reviewer Notes](REVIEWER%20NOTES.md)

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="src/icons/logo-light-256.png">
  <source media="(prefers-color-scheme: light)" srcset="src/icons/logo-dark-256.png">
  <img src="src/icons/logo-light-256.png" alt="Ranobe Gemini Logo" width="256"/>
</picture>

<br/>

---

### A Firefox browser extension that enhances web novel translations using Google's Gemini AI. It improves readability, fixes grammar, and can summarize chapters, supporting multiple web novel platforms.
<br/>


[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) [![GitHub Issues](https://img.shields.io/github/issues/Life-Experimentalist/RanobeGemini?style=flat&logo=github)](https://github.com/Life-Experimentalist/RanobeGemini/issues) [![GitHub Pull Requests](https://img.shields.io/github/issues-pr/Life-Experimentalist/RanobeGemini?style=flat&logo=github)](https://github.com/Life-Experimentalist/RanobeGemini/pulls) [![Mozilla Add-on Users](https://img.shields.io/amo/users/ranobegemini?style=flat&logo=firefox&label=Users)](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/) [![Mozilla Add-on](https://img.shields.io/amo/v/ranobegemini?style=flat&logo=firefox&label=Firefox%20Add-on)](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/)  [![Mozilla Add-on Downloads](https://img.shields.io/amo/dw/ranobegemini?style=flat&logo=firefox&label=Downloads)](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/) [![Mozilla Add-on Rating](https://img.shields.io/amo/rating/ranobegemini?style=flat&logo=firefox&label=Rating)](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/) [![GitHub Stars](https://img.shields.io/github/stars/Life-Experimentalist/RanobeGemini?style=flat&logo=github)](https://github.com/Life-Experimentalist/RanobeGemini/stargazers) [![GitHub Forks](https://img.shields.io/github/forks/Life-Experimentalist/RanobeGemini?style=flat&logo=github)](https://github.com/Life-Experimentalist/RanobeGemini/network/members)

</div>

## Features

*   **AI-Powered Enhancement**: Improves grammar, flow, and readability of translated text using Gemini AI.
*   **Chapter Summarization**: Generates concise summaries of chapters, highlighting key plot points.
*   **Multi-Site Support**: Works on `ranobes.net`, `fanfiction.net`, `archiveofourown.org` (AO3), and `webnovel.com`.
*   **Customizable Prompts**: Tailor the enhancement, summarization, and permanent prompts to control AI output.
*   **Large Chapter Handling**: Automatically splits long chapters to avoid API limits.
*   **Multiple Gemini Models**: Choose the best Gemini model for your needs (e.g., Flash for speed, Pro for quality).
*   **User-Friendly Interface**: Simple popup for settings and an integrated FAQ.
*   **Restore Original**: Easily revert to the original chapter text.
*   **Dark Mode Support**: Adapts to your browser's theme.
*   **Dynamic Domain System**: Automatically handles subdomains and new site variations.

## Installation (Firefox)

**From Firefox Add-ons (Recommended)**:
1. Visit the [Firefox Add-ons page](https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/)
2. Click "Add to Firefox"
3. Confirm the installation when prompted

**Latest Version from GitHub Releases (If AMO is pending update)**:
> ⚠️ **Note**: The GitHub [Releases page](https://github.com/Life-Experimentalist/RanobeGemini/releases) always contains the latest official build. If the Firefox Add-ons store hasn't been updated yet with the newest version, download from GitHub releases.

1.  **Download**: Go to the [Releases page](https://github.com/Life-Experimentalist/RanobeGemini/releases) and download the latest `RanobeGemini_vX.X.X.zip` file.
2.  **Install**: Open Firefox, navigate to `about:addons`, click the gear icon, select "Install Add-on From File...", and choose the downloaded ZIP file.

**For Development**:
1. Clone the repository: `git clone https://github.com/Life-Experimentalist/RanobeGemini.git`
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..." and select the `manifest.json` file inside the `src` directory.

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

**Output**: `releases/RanobeGemini_v2.8.0.zip`

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

1.  **Configure API Key**: Click the Ranobe Gemini icon in your Firefox toolbar. Go to the "Settings" tab and enter your Gemini API key. You can get a free key from [Google AI Studio](https://makersuite.google.com/app/apikey).
2.  **Navigate**: Go to a chapter page on any supported website (Ranobes, FanFiction.net, AO3, or WebNovel).
3.  **Enhance/Summarize**: Click the "Enhance with Gemini" or "Summarize Chapter" buttons that appear near the chapter content.
4.  **View Results**: Wait for the processing to complete. The enhanced text will replace the original, or the summary will appear.
5.  **Restore**: Use the "Restore Original" button if needed.

## Configuration

Access the extension's settings via the toolbar icon:

*   **API Key**: Essential for the extension to function.
*   **Gemini Model**: Select the desired AI model.
*   **Prompts**: Customize the Enhancement, Summary, and Permanent prompts.
*   **Chunking**: Enable/disable automatic splitting of large chapters.
*   **Debug Mode**: Enable console logging for troubleshooting.

## Supported Websites

- **Ranobes**: ranobes.net, ranobes.com, ranobes.top, ranobes.org, and more
- **FanFiction.net**: fanfiction.net (including www and mobile versions)
- **Archive of Our Own (AO3)**: archiveofourown.org, ao3.org
- **WebNovel**: webnovel.com (with infinite scroll support)

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

*   Powered by the [Google Gemini API](https://ai.google.dev/)
