# Ranobe Gemini

A cross-browser extension that enhances web novel translations using Google's Gemini AI. The project currently offers a Firefox version with plans to support Chrome and Edge in future releases.

![Ranobe Gemini Logo](FireFox/icons/logo-light-96.png)

## Features

- **One-Click Enhancement**: Transform poorly translated or low-quality web novels with a single click
- **Chapter Summarization**: Generate concise summaries of chapter content with key plot points
- **HTML-Aware Output**: Produces properly formatted paragraphs with HTML tags
- **Large Chapter Support**: Automatically splits and processes lengthy chapters
- **Customizable AI Prompts**: Configure exactly how you want Gemini to enhance your content
- **Permanent Prompts**: Add formatting rules that apply to all requests
- **Restore Original**: Easily switch back to the original text if needed
- **Dark Mode Support**: Seamless experience in both light and dark themes

## Installation

### Firefox (Current Release)

1. Clone the repository:
   ```
   git clone https://github.com/Life-Experimentalist/RanobeGemini.git
   ```
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on" and select any file from the `FireFox` directory

### Chrome/Edge (Coming Soon)

The extension will soon be available in the Chrome and Edge Web Stores. Stay tuned for further instructions.

## Usage

1. Navigate to ranobes.top.
2. You'll see new buttons added to the page:
   - "Enhance with Gemini" - Improves the text quality and readability
   - "Summarize Chapter" - Creates a concise summary of the chapter
3. Wait for the processing to complete.
4. Use the "Restore Original" button if required.

## Configuration

- Click the extension icon in your browser toolbar.
- Enter your Gemini API key (get one from [Google AI Studio](https://ai.google.dev/)).
- Adjust the enhancement prompt, summary prompt, and permanent prompt in the Settings tab.
- Choose between different Gemini models based on your needs.

## Development

- See the [Project Structure](#project-structure) for details.
- The repository contains a Firefox-specific implementation; Chrome/Edge versions will follow.

### Project Structure

- `FireFox/` – Firefox extension files (current implementation)
- Other directories pertain to shared code and future implementations.

## Version History

For a complete list of changes, see the [CHANGELOG](CHANGELOG.md).

## License

MIT License – See LICENSE for details.

## Acknowledgements

- [Google Gemini API](https://ai.google.dev/)