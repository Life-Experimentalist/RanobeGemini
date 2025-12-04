# Ranobe Gemini – Chromium / Firefox Extension

>Ranobe Gemini is an advanced Chromium / Firefox extension designed to revolutionize your web novel reading experience. By harnessing the power of Google's Gemini AI, it intelligently refines and enhances translated web novel chapters—correcting grammatical errors, optimizing narrative flow, and preserving the original story's tone and style.

## Key Features

- **One-Click Enhancement:** Easily upgrade raw translations into polished, narrative-rich chapters with a single click.
- **Chapter Summarization:** Generate concise summaries that highlight key plot points and character interactions.
- **Seamless Integration:** Specifically tailored to work with ranobes.top, with optimized selectors for the site.
- **Customizable AI Prompts:** Fine-tune the enhancement and summarization processes with different prompts.
- **Permanent Prompts:** Add formatting rules that apply consistently to all requests.
- **Large Chapter Handling:** Automatically splits and processes lengthy chapters to avoid token limits.
- **Real-Time Processing:** Leverages Google's Gemini API to process and enhance content dynamically while you read.
- **Multiple Gemini Models:** Choose between different models like Gemini 2.5 Flash or Gemini 2.5 Pro based on your needs.
- **User-Friendly Settings Panel:** Access configuration options directly from the Firefox toolbar.
- **Original Content Preservation:** Offers an intuitive "Restore Original" option to revert back to the unmodified version.
- **Dark Mode Support:** Seamless experience in both light and dark themes.
- **Robust Error Handling:** Incorporates real-time API key validation and dynamic feedback.

## Why Use Ranobe Gemini?

Many web translations can lose the unique voice and literary style inherent in the original work. Ranobe Gemini bridges this gap by using state-of-the-art AI to enhance readability and quality—making your reading experience more enjoyable and immersive. Whether you're a casual reader or a dedicated fan of web novels, this extension transforms clunky translations into fluid and engaging narratives without compromising the story's integrity.

## How It Works

Upon activation, Ranobe Gemini scans the webpage for targeted content areas using customized selectors. It then sends the extracted text to Google's Gemini AI, which processes the content based on user-specified configuration settings. Once the refined text is returned, the extension seamlessly integrates the enhanced version back onto the page, complete with an optional notice indicating that the content has been enhanced by advanced AI. This process ensures that the final output not only reads naturally but also closely adheres to the nuances of the source material.

## Installation (Firefox Only)

1. Download or clone the repository:
   ```
   git clone https://github.com/Life-Experimentalist/RanobesGemini.git
   ```
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on" and select any file in this `FireFox` directory

## Usage

- Open a page on ranobes.top
- Look for the "Enhance with Gemini" button and click it to improve readability
- Use the "Summarize Chapter" button to get a concise overview of the chapter
- The enhanced text will be automatically inserted into the page
- Use the "Restore Original" button if you need to revert

## Configuration

- Click the extension icon in the Firefox toolbar
- Enter your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Customize the enhancement prompt, summary prompt, and permanent prompt
- Choose your preferred Gemini model
- Enable "Split large chapters automatically" for longer content

## Version History

- **v2.2.0** (May 25, 2025): Improved theme integration, responsive design, and streamlined API key handling
- **v2.1.0** (April 15, 2025): Enhanced summary feature, improved handling of large chapters, and separate model selection for summaries
- **v2.0.0** (April 13, 2025): Major update with redesigned interface, Gemini 2.0 model support, and chapter summarization feature
- **v1.1.0** (April 10, 2025): Added chapter summarization, permanent prompts, and improved UI
- **v1.0.0** (June 15, 2025): Initial release with basic enhancement functionality

For a complete list of changes, see the [CHANGELOG](../docs/CHANGELOG.md).

## License

MIT License – See LICENSE for details.
