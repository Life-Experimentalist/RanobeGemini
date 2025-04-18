# Ranobe Gemini

![Ranobe Gemini Logo](src/icons/logo-light-96.png)

A Firefox browser extension that enhances web novel translations using Google's Gemini AI. It improves readability, fixes grammar, and can summarize chapters, currently supporting ranobes.top and fanfiction.net.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Features

*   **AI-Powered Enhancement**: Improves grammar, flow, and readability of translated text using Gemini AI.
*   **Chapter Summarization**: Generates concise summaries of chapters, highlighting key plot points.
*   **Website Support**: Currently works on `ranobes.top` and `fanfiction.net`.
*   **Customizable Prompts**: Tailor the enhancement, summarization, and permanent prompts to control AI output.
*   **Large Chapter Handling**: Automatically splits long chapters to avoid API limits.
*   **Multiple Gemini Models**: Choose the best Gemini model for your needs (e.g., Flash for speed, Pro for quality).
*   **User-Friendly Interface**: Simple popup for settings and an integrated FAQ.
*   **Restore Original**: Easily revert to the original chapter text.
*   **Dark Mode Support**: Adapts to your browser's theme.

## Installation (Firefox)

1.  **Download**: Go to the [Releases page](https://github.com/Life-Experimentalist/RanobeGemini/releases) and download the latest `RanobeGemini_vX.X.X.zip` file.
2.  **Install**: Open Firefox, navigate to `about:addons`, click the gear icon, select "Install Add-on From File...", and choose the downloaded ZIP file.

*Alternatively, for development:*
1. Clone the repository: `git clone https://github.com/Life-Experimentalist/RanobeGemini.git`
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..." and select the `manifest.json` file inside the `src` directory.

## Usage

1.  **Configure API Key**: Click the Ranobe Gemini icon in your Firefox toolbar. Go to the "Settings" tab and enter your Gemini API key. You can get a free key from [Google AI Studio](https://makersuite.google.com/app/apikey).
2.  **Navigate**: Go to a chapter page on a supported website (`ranobes.top` or `fanfiction.net`).
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

## Adding New Website Support

Please refer to the [ADDING_NEW_WEBSITES.md](ADDING_NEW_WEBSITES.md) guide for instructions on how to extend the extension to support more websites.

## Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines.

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.

Copyright 2025 VKrishna04

## Acknowledgements

*   Powered by the [Google Gemini API](https://ai.google.dev/)