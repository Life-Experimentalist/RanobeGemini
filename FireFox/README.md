# Ranobe Gemini – Firefox Extension

Ranobe Gemini is an advanced Firefox extension designed to revolutionize your web novel reading experience. By harnessing the power of Google’s Gemini AI, it intelligently refines and enhances translated web novel chapters—correcting grammatical errors, optimizing narrative flow, and preserving the original story’s tone and style.

## Key Features

- **One-Click Enhancement:** Easily upgrade raw translations into polished, narrative-rich chapters with a single click.
- **Seamless Integration:** Specifically tailored to work with popular web novel websites such as Ranobes.top, WuxiaWorld, and Webnovel.
- **Customizable AI Prompts:** Fine-tune the enhancement process by adjusting the transformation prompts, ensuring stylistic consistency across chapters.
- **Real-Time Processing:** Leverages Google’s Gemini API to process and enhance content dynamically while you read.
- **User-Friendly Settings Panel:** Access advanced configuration options directly from the Firefox toolbar. Adjust parameters such as temperature, token limits, and more, to match your preferred reading style.
- **Original Content Preservation:** Offers an intuitive "Restore Original" option so you can always revert back to the unmodified version of your text.
- **Robust Error Handling:** Incorporates real-time API key validation and dynamic feedback, ensuring a smooth and error-free user experience.
- **Adaptive Content Detection:** Automatically identifies and extracts the main content from a webpage, even on dynamically loaded pages.

## Why Use Ranobe Gemini?

Many web translations can lose the unique voice and literary style inherent in the original work. Ranobe Gemini bridges this gap by using state-of-the-art AI to enhance readability and quality—making your reading experience more enjoyable and immersive. Whether you’re a casual reader or a dedicated fan of web novels, this extension transforms clunky translations into fluid and engaging narratives without compromising the story's integrity.

## How It Works

Upon activation, Ranobe Gemini scans the webpage for targeted content areas using customized selectors. It then sends the extracted text to Google’s Gemini AI, which processes the content based on user-specified configuration settings. Once the refined text is returned, the extension seamlessly integrates the enhanced version back onto the page, complete with an optional notice indicating that the content has been enhanced by advanced AI. This process ensures that the final output not only reads naturally but also closely adheres to the nuances of the source material.

## Installation (Firefox Only)

1. Download or clone the repository:
   ```
   git clone https://github.com/Life-Experimentalist/RanobesGemini.git
   ```
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on" and select any file in this `FireFox` directory

## Usage

- Open a supported novel page.
- Look for the "Enhance with Gemini" button and click it.
- The enhanced text will be automatically inserted into the page.
- Use the "Restore Original" button if you need to revert.

## Configuration

- Click the extension icon in the Firefox toolbar.
- Enter your Gemini API key and adjust AI prompt settings on the options page.

## Development

- The Firefox extension is located under the `FireFox` folder.
- For details on configuration and code structure, see the other documentation files.

## Packaging and Publishing

1. **Clean Directory:** Remove unnecessary files (e.g., `.git`, `.gitignore`).
2. **Create ZIP:** Create a ZIP archive of the remaining files in the `FireFox` directory (manifest.json, background/, content/, icons/, options/, popup/, utils/, welcome/, etc.). Do not include the `FireFox` directory itself in the zip.
3. **Test:** Load the ZIP as a temporary add-on in Firefox to ensure it works.
4. **Publish:** Submit the ZIP file to the Firefox Add-ons (AMO) website.

## License

MIT License – See LICENSE for details.
