# Ranobe Novel Enhancer

A Firefox extension that enhances novel translations from Ranobes.top using the Gemini API.

## Features

-   One-click processing of novel chapter content
-   Enhances translations using Google's Gemini AI
-   Corrects gender pronouns and translation errors
-   Makes fight scenes more concise
-   Highlights important contextual information
-   Optional auto-navigation to the next chapter
-   Customizable prompt templates

## Installation

### Development Mode

1. Download or clone this repository
2. Open Firefox
3. Navigate to `about:debugging`
4. Click "This Firefox"
5. Click "Load Temporary Add-on"
6. Select the `manifest.json` file from this project

### Production

Coming soon: Firefox Add-on Store link

## Configuration

1. Create a `.env` file in the root directory with your Gemini API key:

    ```
    Gemini_API_KEY=your_api_key_here
    ```

2. Access extension settings by clicking the extension icon in the toolbar
3. Customize the Gemini prompt template as needed
4. Toggle auto-navigation to automatically proceed to next chapters

## Usage

1. Navigate to a chapter on Ranobes.top
2. Locate the "Enhance with Gemini" button near the comment section
3. Click the button to process the current chapter
4. The enhanced text will appear in the comment box
5. Optionally click "Submit" to post the comment

## Development

### Project Structure

-   `/background` - Background scripts for API communication
-   `/content` - Content scripts that interact with web pages
-   `/popup` - Extension popup UI files
-   `/config` - Configuration files
-   `/icons` - Extension icons

### Building

This extension uses plain JavaScript, HTML, and CSS. No build step is required.

## Contributing

Contributions are welcome! Please check the TODO.md file for current tasks.

## License

MIT
