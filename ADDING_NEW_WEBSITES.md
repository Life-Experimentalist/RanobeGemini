# Adding Support for New Websites to Ranobe Gemini

This document outlines the process for adding support for new web novel websites to the Ranobe Gemini Firefox extension. The extension uses a modular handler system to manage website-specific logic for content extraction and UI integration.

## Architecture Overview

1.  **`content.js`**: The main content script that runs on supported websites. It initializes the process.
2.  **`utils/website-handlers/handler-manager.js`**: This module dynamically detects the current website's hostname and loads the appropriate handler module.
3.  **`utils/website-handlers/base-handler.js`**: Defines the `BaseWebsiteHandler` class, which all specific website handlers must extend. It provides a common interface and fallback methods.
4.  **`utils/website-handlers/<website>-handler.js`**: Individual JavaScript files, each containing a class that extends `BaseWebsiteHandler` and implements logic specific to one website (e.g., `ranobes-handler.js`, `fanfiction-handler.js`).

## Steps to Add a New Website Handler

1.  **Create a New Handler File**:
    *   In the `FireFox/utils/website-handlers/` directory, create a new JavaScript file named after the website (e.g., `newsite-handler.js`).

2.  **Implement the Handler Class**:
    *   Import the `BaseWebsiteHandler` class:
        ```javascript
        import { BaseWebsiteHandler } from "./base-handler.js";
        ```
    *   Create a new class that extends `BaseWebsiteHandler`:
        ```javascript
        export class NewSiteHandler extends BaseWebsiteHandler {
            constructor() {
                super();
                // Define website-specific selectors here (optional but recommended)
                this.selectors = {
                    content: ["#main-content-selector", ".article-body"],
                    title: ["h1.entry-title", ".post-title"]
                    // Add other selectors as needed (e.g., for navigation)
                };
            }

            // Implement required methods below...
        }
        ```
    *   **Implement `canHandle()`**: This method should return `true` if the current page's hostname matches the website this handler supports.
        ```javascript
        canHandle() {
            // Example: Check if hostname includes 'newsite.com'
            return window.location.hostname.includes('newsite.com');
        }
        ```
    *   **Implement `findContentArea()`**: This method should return the main DOM element containing the chapter text. Use `document.querySelector()` with appropriate CSS selectors for the target website.
        ```javascript
        findContentArea() {
            for (const selector of this.selectors.content) {
                const element = document.querySelector(selector);
                if (element) {
                    console.log(`NewSite: Content area found using selector: ${selector}`);
                    return element;
                }
            }
            // Optional: Fallback to base implementation or return null
            // return super.findContentArea();
            return null;
        }
        ```
    *   **Implement `extractTitle()`**: This method should return the chapter title as a string. Extract it from relevant elements (e.g., `<h1>`, `<title>` tag).
        ```javascript
        extractTitle() {
            for (const selector of this.selectors.title) {
                const titleElement = document.querySelector(selector);
                if (titleElement && titleElement.innerText.trim()) {
                    return titleElement.innerText.trim();
                }
            }
            // Fallback
            return document.title || "Unknown Title";
        }
        ```
    *   **Implement `extractContent()`**: This method should find the content area and return an object containing the extracted text and other details. Clean the extracted text as needed (e.g., remove unwanted elements, normalize whitespace).
        ```javascript
        extractContent() {
            const contentArea = this.findContentArea();
            if (!contentArea) {
                return { found: false, title: "", text: "", selector: "" };
            }

            const chapterTitle = this.extractTitle();
            const contentClone = contentArea.cloneNode(true);

            // --- Add website-specific cleaning logic here ---
            // Example: Remove ad elements, navigation links, etc.
            // contentClone.querySelectorAll('.ad-banner').forEach(el => el.remove());
            // ------------------------------------------------

            let chapterText = contentClone.innerText.trim();
            // Normalize whitespace
            chapterText = chapterText.replace(/\n\s+/g, "\n").replace(/\s{2,}/g, " ");
            // Convert multiple line breaks into double line breaks for paragraphs
            chapterText = chapterText.replace(/\n{3,}/g, "\n\n");

            return {
                found: chapterText.length > 100, // Basic check if content seems valid
                title: chapterTitle,
                text: chapterText,
                selector: "newsite-handler" // Identifier for this handler
            };
        }
        ```
    *   **Implement `getUIInsertionPoint()` (Optional but Recommended)**: Define where the "Enhance" and "Summarize" buttons should be injected relative to the `contentArea`. Return an object like `{ element: someElement, position: 'before' }`. Valid positions are `'before'`, `'after'`, `'prepend'`, `'append'`.
        ```javascript
        getUIInsertionPoint(contentArea) {
            // Example: Insert controls before the main content div
            return {
                element: contentArea,
                position: 'before'
            };
        }
        ```
    *   **Implement `getChapterNavigation()` (Optional)**: If the site has clear next/previous chapter links or a chapter list, implement this to return an object like `{ hasPrevious: boolean, hasNext: boolean, currentChapter: number, totalChapters: number }`.

3.  **Export the Handler Instance**:
    *   At the end of your handler file, export a new instance of your class as the default export:
        ```javascript
        export default new NewSiteHandler();
        ```

4.  **Update the Handler Manager**:
    *   Open `FireFox/utils/website-handlers/handler-manager.js`.
    *   Add an `else if` condition within the `getHandlerForCurrentSite` function to check for the new website's hostname and dynamically import your new handler file.
        ```javascript
        export async function getHandlerForCurrentSite() {
            const hostname = window.location.hostname;

            try {
                if (hostname.includes('ranobes')) {
                    // ... existing ranobes code ...
                } else if (hostname.includes('fanfiction.net')) {
                    // ... existing fanfiction code ...
                }
                // --- Add your new condition here ---
                else if (hostname.includes('newsite.com')) {
                    const newSiteHandlerUrl = browser.runtime.getURL("utils/website-handlers/newsite-handler.js");
                    const newSiteModule = await import(newSiteHandlerUrl);
                    console.log("Loaded newsite handler");
                    return newSiteModule.default;
                }
                // ------------------------------------

                // ... rest of the function (fallback/generic handler) ...
            } catch (error) {
                // ... error handling ...
            }
        }
        ```

5.  **Update Manifest File**:
    *   Open `FireFox/manifest.json`.
    *   Add the new website's URL pattern(s) to the `matches` array within the `content_scripts` section.
        ```json
        "content_scripts": [
            {
                "matches": [
                    "*://*.ranobes.top/*",
                    "*://*.fanfiction.net/*",
                    "*://*.newsite.com/*" // Add new site match pattern
                ],
                // ... rest of content_scripts ...
            }
        ],
        ```
    *   Add the new website's URL pattern(s) to the `matches` array within the `web_accessible_resources` section to allow access to icons and utility scripts.
        ```json
         "web_accessible_resources": [
            {
                "resources": [
                    "icons/*.png",
                    "utils/*.js",
                    "utils/website-handlers/*.js"
                ],
                "matches": [
                    "*://*.ranobes.top/*",
                    "*://*.fanfiction.net/*",
                    "*://*.newsite.com/*" // Add new site match pattern
                ]
            }
        ]
        ```

6.  **Test Thoroughly**:
    *   Load the extension temporarily in Firefox (`about:debugging`).
    *   Navigate to various pages on the new website (chapter pages, index pages, etc.).
    *   Verify that the "Enhance" and "Summarize" buttons appear correctly.
    *   Test content extraction – ensure the correct text is selected and unwanted elements are removed.
    *   Test enhancement and summarization features.
    *   Check the browser console (Ctrl+Shift+J) for any errors logged by your handler or the content script.

By following these steps, you can extend Ranobe Gemini to support additional web novel sites in a structured and maintainable way.
