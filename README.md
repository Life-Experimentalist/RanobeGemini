# Ranobe Novel Enhancer

A cross-browser extension that enhances web novel translations using Google's Gemini AI. The project currently offers a Firefox version with plans to support Chrome and Edge in future releases.

![Ranobe Novel Enhancer Logo](FireFox/icons/icon-96.png)

## Features

- **One-Click Enhancement**: Transform poorly translated or low-quality web novels with a single click
- **HTML-Aware Output**: Produces properly formatted paragraphs with HTML tags
- **Multiple Site Support**: Works with popular novel sites like Ranobes.top, WuxiaWorld, and Webnovel
- **Customizable AI Prompts**: Configure exactly how you want Gemini to enhance your content
- **Restore Original**: Easily switch back to the original text if needed
- **Auto-Detection**: Automatically finds novel content on supported pages

## Installation

### Firefox (Current Release)

1. Clone the repository:
   ```
   git clone https://github.com/Life-Experimentalist/RanobesGemini.git
   ```
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on" and select any file from the `FireFox` directory

### Chrome/Edge (Coming Soon)

The extension will soon be available in the Chrome and Edge Web Stores. Stay tuned for further instructions.

## Usage

1. Navigate to a supported novel site.
2. Click the "Enhance with Gemini" button that the extension adds to the page.
3. Wait for the enhanced version to appear.
4. Use the "Restore Original" button if required.

## Configuration

- Click the extension icon in your browser toolbar.
- Enter your Gemini API key (get one from [Google AI Studio](https://ai.google.dev/)).
- Adjust the AI prompt and advanced settings via the settings page.

## Development

- See the [Project Structure](#project-structure) for details.
- The repository contains a Firefox-specific implementation; Chrome/Edge versions will follow.

### Project Structure

- `FireFox/` – Firefox extension files (current implementation)
- Other directories pertain to shared code and future implementations.

## License

MIT License – See LICENSE for details.

## Acknowledgements

- [Google Gemini API](https://ai.google.dev/)