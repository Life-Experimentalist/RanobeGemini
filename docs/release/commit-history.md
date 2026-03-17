Mode: all
Format: text
Generated: 2026-03-17T15:16:57.869Z
Total commits: 73

[a8b7fd6] 2026-03-17 feat(v4.4.0): release 4.4.0 with auto commit-history publish
   feat(v4.4.0): release 4.4.0 with auto commit-history publish
   Files:
   - .gitignore
   - dev/commit-history-auto.ps1
   - dev/commit-history.js
   - dev/fix_emoji.py
   - docs/backup/ranobe-backup.schema.json
   - docs/backups/BACKUP_GUIDE.md
   - ... (35 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[25040ff] 2026-03-17 feat(v4.4.0)!: redesign landing pages with responsive content filters and library navigation
   feat(v4.4.0)!: redesign landing pages with responsive content filters and library navigation
   - Complete rewrite of content-styles.html (500+ lines)
   - Fully responsive design: mobile → tablet → desktop layouts
   - Interactive collapsible demo cards for all filter types
   - SVG flow diagram showing content processing pipeline
   - 6 built-in content type showcase with card grid
   - Library navigation link on all 5 landing pages
   - openLibrarySettings() function for extension integration
   Files:
   - docs/architecture/COLLAPSIBLE_JOURNEY.md
   - docs/features/COLLAPSIBLE_SECTIONS.md
   - docs/overview/VISUAL_JOURNEY.md
   - landing/content-styles.html
   - landing/drive-setup.html
   - landing/index.html
   - ... (3 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[eba1cfa] 2026-03-17 feat(v4.4.0)!: complete collapsible content filters system with comprehensive documentation
   feat(v4.4.0)!: complete collapsible content filters system with comprehensive documentation
   ## Core Features Added
   ### 1. Collapsible Sections System (Content Filters)
   - Intelligent content detection by Gemini (fight scenes, R18 content, author notes)
   - Collapse/expand toggles (not permanent hiding—users control visibility)
   - Summary-first approach: brief summary visible, full content on demand
   - Per-type configuration: toggle each type on/off, set default states
   - Custom types: users can define their own collapsible content categories
   Files:
   - .github/DISCUSSION_TEMPLATE/faq.yml
   - .github/DISCUSSION_TEMPLATE/general.yml
   - .github/DISCUSSION_TEMPLATE/ideas.yml
   - .github/DISCUSSION_TEMPLATE/q-and-a.yml
   - .github/copilot-instructions.md
   - dev/commit-history.js
   - ... (14 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[a73db74] 2026-03-16 feat(4.4.0): improve UX with redesigned landing, collapsible content, reading-lists, and white-space styling
   feat(4.4.0): improve UX with redesigned landing, collapsible content, reading-lists, and white-space styling
   - Redesign Getting Started section in drive-setup.html with modern card-based layout
   - Add CSS styles for setup timeline and step cards with better visual hierarchy
   - Update content.css: change white-space from pre-wrap to pre-line for game stats, system messages, and other special content boxes
   - Add comprehensive documentation in .github/copilot-instructions.md for reading-lists and collapsible sections architecture
   - Verify collapsible sections implementation for fight scenes, R18 content, and author notes
   - Ensure reading-list and custom list features are properly documented for future development
   - All changes tested and build validation successful
   Files:
   - .github/copilot-instructions.md
   - landing/drive-setup.html
   - landing/styles-drive.css
   - src/content/content.css
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[34d6041] 2026-03-16 feat(4.4.0): refactor rereading into reading-list badges
   feat(4.4.0): refactor rereading into reading-list badges
   Files:
   - .github/copilot-instructions.md
   - README.md
   - docs/development/TODO.md
   - docs/overview/Roadmap.md
   - package.json
   - src/config/build-version.js
   - ... (7 more)
   Package:
   - name: ranobe-gemini
   - version: 4.4.0
   Manifests:
   - src/manifest-firefox.json: 4.4.0
   - src/manifest-chromium.json: 4.4.0
   - src/library/manifest.webmanifest: 4.4.0

[458ec18] 2026-03-16 docs(4.3.0): finalize landing nav and vertical Mermaid docs
   docs(4.3.0): finalize landing nav and vertical Mermaid docs
   Files:
   - docs/development/TODO.md
   - docs/overview/Roadmap.md
   - landing/content-styles.html
   - landing/drive-setup.html
   - landing/index.html
   - landing/nav.js
   - ... (4 more)
   Package:
   - name: ranobe-gemini
   - version: 4.3.0
   Manifests:
   - src/manifest-firefox.json: 4.3.0
   - src/manifest-chromium.json: 4.3.0
   - src/library/manifest.webmanifest: 4.3.0

[c8778d1] 2026-03-16 Enhance metadata extraction for fanfiction, ranobes, and scribblehub handlers
   Enhance metadata extraction for fanfiction, ranobes, and scribblehub handlers
   - Improved metadata extraction logic in FanfictionMobileHandler to include category, fandom hierarchy, and relationships.
   - Refined regex patterns for extracting metadata fields such as rating, language, and word count.
   - Added support for extracting reviews, favorites, and follows in FanfictionMobileHandler.
   - Enhanced RanobesHandler to extract author information more reliably and ensure main novel URL is set correctly.
   - Updated ScribbleHubHandler to include additional author and genre extraction methods, and improved numeric parsing for statistics.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - README.md
   - docs/release/CHANGELOG.md
   - docs/release/RELEASE_NOTES_4.1.0.md
   - docs/release/RELEASE_NOTES_4.2.0.md
   - docs/release/RELEASE_NOTES_4.3.0.md
   - landing/index.html
   - ... (23 more)
   Package:
   - name: ranobe-gemini
   - version: 4.3.0
   Manifests:
   - src/manifest-firefox.json: 4.3.0
   - src/manifest-chromium.json: 4.3.0
   - src/library/manifest.webmanifest: 4.3.0

[8a6800e] 2026-03-15 feat: Implement Incognito Mode with UI controls and settings
   feat: Implement Incognito Mode with UI controls and settings
   - Added Incognito Mode functionality to pause library tracking.
   - Introduced UI elements in the popup and library settings for enabling/disabling Incognito Mode.
   - Implemented duration settings for Incognito Mode with automatic expiration.
   - Updated background scripts to handle Incognito Mode state and interactions.
   - Enhanced accessibility by managing visibility of Gemini UI elements during Read Aloud.
   - Refactored summary extraction logic to improve quality checks and retries.
   - Added configuration options for hiding Gemini UI from Read Aloud in library settings.
   Files:
   - src/background/background.js
   - src/content/content.js
   - src/library/library-settings.html
   - src/library/library-settings.js
   - src/library/library.html
   - src/library/library.js
   - ... (7 more)
   Package:
   - name: ranobe-gemini
   - version: 4.3.0
   Manifests:
   - src/manifest-firefox.json: 4.3.0
   - src/manifest-chromium.json: 4.3.0
   - src/library/manifest.webmanifest: 4.3.0

[1c64d42] 2026-03-14 feat: Implement collapsible sections for fight scenes, R18 content, and author notes
   feat: Implement collapsible sections for fight scenes, R18 content, and author notes
   - Added a new collapsible sections system to enhance chapter view.
   - Introduced default content filter settings for managing visibility of fight scenes, R18 content, and author notes.
   - Updated popup.js to handle backup model selection and content filter settings.
   - Enhanced chunking logic to accurately extract paragraphs from HTML content.
   - Improved constants.js with new settings for collapsible content sections.
   - Updated novel-library.js to derive story completion status from publication status.
   - Added error handling for theme configuration to ensure compatibility with older runtimes.
   Files:
   - package.json
   - releases/RanobeGemini_v4.3.0_chromium.zip
   - releases/RanobeGemini_v4.3.0_firefox.zip
   - releases/source/Ranobe-gemini_v4.3.0_source.zip
   - src/background/background.js
   - src/config/build-version.js
   - ... (26 more)
   Package:
   - name: ranobe-gemini
   - version: 4.3.0
   Manifests:
   - src/manifest-firefox.json: 4.3.0
   - src/manifest-chromium.json: 4.3.0
   - src/library/manifest.webmanifest: 4.3.0

[be8ecd9] 2026-03-12 feat: v4.2.0 enhance library UI and functionality
   feat: v4.2.0 enhance library UI and functionality
   - Added a new hero eyebrow section in library.html and styled it in library.css for improved visibility of the "Continue Reading" prompt.
   - Refactored character and relationship rendering logic in novel-card.js to separate character and relationship sections for better clarity.
   - Updated shelf-page.js to dynamically build reading status buttons based on available statuses, improving user interaction.
   - Modified chunking UI components to include new pause and skip functionality, enhancing user control during processing.
   - Improved accessibility by adding aria-hidden attributes to non-content UI elements in chunking components.
   - Updated CSS styles for better responsiveness and visual consistency across various components.
   - Introduced new constants for word count thresholds and cache restore retry delays to enhance performance.
   Files:
   - releases/RanobeGemini_v4.2.0_chromium.zip
   - releases/RanobeGemini_v4.2.0_firefox.zip
   - releases/source/Ranobe-gemini_v4.2.0_source.zip
   - src/background/background.js
   - src/background/message-handlers/index.js
   - src/content/content.js
   - ... (12 more)
   Package:
   - name: ranobe-gemini
   - version: 4.2.0
   Manifests:
   - src/manifest-firefox.json: 4.2.0
   - src/manifest-chromium.json: 4.2.0
   - src/library/manifest.webmanifest: 4.2.0

[0ccbaf6] 2026-03-12 feat: Implement database fixes for FanFiction.net character data and enhance library UI with new buttons
   feat: Implement database fixes for FanFiction.net character data and enhance library UI with new buttons
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/watch.js
   - src/background/background.js
   - src/content/content.js
   - src/library/library-settings.html
   - src/library/library-settings.js
   - src/library/library.html
   - ... (9 more)
   Package:
   - name: ranobe-gemini
   - version: 4.2.0
   Manifests:
   - src/manifest-firefox.json: 4.2.0
   - src/manifest-chromium.json: 4.2.0
   - src/library/manifest.webmanifest: 4.2.0

[1c80627] 2026-03-10 feat: Add custom content box types feature with UI for user-defined styles
   feat: Add custom content box types feature with UI for user-defined styles
   - Introduced a new section in library settings for managing custom content boxes.
   - Users can define CSS classes, display names, and styling options for content boxes.
   - Implemented functionality to save and load custom box types from browser storage.
   - Added live preview for custom boxes in the settings UI.
   - Updated CSS styles to ensure proper alignment and presentation of headings and content.
   - Bumped version to 4.2.0 to reflect new feature addition.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - landing/content-styles.html
   - landing/index.html
   - landing/novel-status.html
   - landing/privacy.html
   - landing/terms.html
   - package.json
   - ... (11 more)
   Package:
   - name: ranobe-gemini
   - version: 4.2.0
   Manifests:
   - src/manifest-firefox.json: 4.2.0
   - src/manifest-chromium.json: 4.2.0
   - src/library/manifest.webmanifest: 4.2.0

[5c0d202] 2026-03-08 feat(theme): enhance auto mode functionality with schedule and sun options
   feat(theme): enhance auto mode functionality with schedule and sun options
   - Added autoBehavior, timeCustomStart, and timeCustomEnd to DEFAULT_THEME for better theme management.
   - Implemented schedule and sun-based auto mode detection in resolveMode function.
   - Introduced helper functions for time-based checks and sunrise/sunset estimation.
   - Updated THEME_PRESETS with new creative themes including "tokyo-night", "catppuccin-mocha", "synthwave", and others.
   - Enhanced getThemePalette and setThemeVariables to support new auto mode features.
   refactor(AO3Handler): improve formatting rules for author notes and special content
   - Updated DEFAULT_SITE_PROMPT to clarify formatting rules for author notes, epigraphs, and flashbacks.
   Files:
   - dev/build.js
   - releases/RanobeGemini_v4.1.0_chromium.zip
   - releases/RanobeGemini_v4.1.0_firefox.zip
   - releases/source/Ranobe-gemini_v4.1.0_source.zip
   - src/background/background.js
   - src/config/build-version.js
   - ... (10 more)
   Package:
   - name: ranobe-gemini
   - version: 4.1.0
   Manifests:
   - src/manifest-firefox.json: 4.1.0
   - src/manifest-chromium.json: 4.1.0
   - src/library/manifest.webmanifest: 4.1.0

[bb80576] 2026-03-08 feat: add reading progress bar to novel modals and update export filename templates
   feat: add reading progress bar to novel modals and update export filename templates
   - Implemented a reading progress bar in the novel modals for Ranobes and ScribbleHub, displaying the current chapter and total chapters read.
   - Updated the export filename formatting to include word count and changed the default export extension to EPUB.
   - Removed unused background animation styles and CSS files from the HTML templates.
   - Enhanced the copy functionality for novel information to use a new export template.
   - Updated the manifest version to 4.1.0 for both Chromium and Firefox.
   - Added new theme presets and removed background animation settings from the default theme configuration.
   - Improved the chunking UI to provide better feedback on enhancement status and added new buttons for enhancing chunks directly from the UI.
   Files:
   - .gemini/settings.json
   - dev/build.js
   - docs/release/CHANGELOG.md
   - docs/release/RELEASE_NOTES_4.0.0.md
   - docs/release/RELEASE_NOTES_4.0.0_MARKETPLACE.md
   - landing/drive-setup.html
   - ... (40 more)
   Package:
   - name: ranobe-gemini
   - version: 4.1.0
   Manifests:
   - src/manifest-firefox.json: 4.1.0
   - src/manifest-chromium.json: 4.1.0
   - src/library/manifest.webmanifest: 4.1.0

[0576607] 2026-03-05 v4.0.0 complete Refactor AO3 and Fanfiction handlers to streamline download and copy functionality
   v4.0.0 complete Refactor AO3 and Fanfiction handlers to streamline download and copy functionality
   - Removed custom download settings for AO3 as it supports native downloads.
   - Introduced a "Copy" button in both AO3 and Fanfiction handlers to copy formatted novel info to clipboard.
   - Updated the method for retrieving export templates from library settings.
   - Consolidated chapter UI configuration in BaseWebsiteHandler for better maintainability.
   - Deprecated legacy methods for custom chapter buttons in favor of a unified configuration approach.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/build.js
   - package.json
   - releases/RanobeGemini_v4.0.0_chromium.zip
   - releases/RanobeGemini_v4.0.0_firefox.zip
   - releases/source/Ranobe-gemini_v4.0.0_source.zip
   - scripts/fix_emoji.py
   - ... (41 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[e72701e] 2026-02-28 feat: Enhance site settings UI with section separators and text input fields
   feat: Enhance site settings UI with section separators and text input fields
   feat: Update service worker for improved caching and offline support
   fix: Adjust popup model selection options for clarity and consistency
   refactor: Improve popup.js to utilize DEFAULT_MODEL_ID for model selection
   style: Refine chunking UI styles for better layout and responsiveness
   fix: Update constants.js to change default model ID to "gemini-2.5-flash"
   feat: Add filename template options for novel exports in copy format
   feat: Implement FichHub download button with clipboard functionality in AO3 and Fanfiction handlers
   Files:
   - package.json
   - src/background/background.js
   - src/content/content.css
   - src/content/content.js
   - src/library/library-settings.css
   - src/library/library-settings.html
   - ... (15 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[6421c29] 2026-02-26 feat: Enhance mobile metadata handling and improve readability
   feat: Enhance mobile metadata handling and improve readability
   - Added fetchDesktopMetadata method to retrieve comprehensive metadata from the desktop version of fanfiction.net for mobile pages.
   - Implemented processRemoteMetadata to enrich mobile metadata with desktop data.
   - Created injectMetadataSummary to display a styled summary of the fetched metadata above chapter content.
   - Updated getMetadataSourceUrl to ensure mobile pages redirect to the desktop version for complete metadata.
   refactor: Update handler imports in HandlerManager
   - Changed import method in HandlerManager to use relative paths instead of browser.runtime.getURL for better compatibility.
   feat: Introduce configurable settings for Ranobes and ScribbleHub handlers
   Files:
   - .gitignore
   - .vscode/tasks.json
   - dev/emoji-report.txt
   - docs/backup/ranobe-backup.schema.json
   - docs/features/NOVEL_LIBRARY.md
   - landing/drive-setup.html
   - ... (56 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[b57a058] 2026-02-20 feat: Complete modularization of metadata fetching and handler settings
   feat: Complete modularization of metadata fetching and handler settings
   - Implemented a universal metadata fetching system with three strategies.
   - Developed a handler settings validation system for custom library settings.
   - Modularized background scripts into dedicated message handlers.
   - Created content script modules for improved feature management.
   - Updated base handler with new methods for metadata source and settings.
   - Enhanced existing handlers with proposed settings and validation.
   - Added comprehensive documentation for new systems and architecture.
   Files:
   - .markdownlint.json
   - README.md
   - build-output.txt
   - docs/WHATS_WHERE.md
   - docs/architecture/MODULAR_ARCHITECTURE.md
   - docs/architecture/MODULAR_SYSTEMS_README.md
   - ... (7 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[407e2ea] 2026-02-17 Refactor chunking utility to use simplified emoji regex; enhance debug panel for better tab handling; add new constants for debug output and carousel configuration; improve Drive token management with error handling; update novel library for reading status management and completion marking; refine website handlers for improved parsing and formatting; ensure consistent regex usage across handlers.
   Refactor chunking utility to use simplified emoji regex; enhance debug panel for better tab handling; add new constants for debug output and carousel configuration; improve Drive token management with error handling; update novel library for reading status management and completion marking; refine website handlers for improved parsing and formatting; ensure consistent regex usage across handlers.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .eslintrc.json
   - .prettierrc
   - docs/settings/SETTINGS_SYNC_FIXED.md
   - landing/drive-setup.html
   - landing/index.html
   - landing/novel-status.html
   - ... (32 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[fa67c40] 2026-02-15 feat: Enhance site settings and chunking UI
   feat: Enhance site settings and chunking UI
   - Added a new setting for preferred TLD in site settings UI with options for fanfiction.net and fanfiction.ws.
   - Updated the chunk summary UI to include an enhance button with improved styling and hover effects.
   - Introduced word count display and threshold warning in chunk UI to inform users of significant changes.
   - Enhanced storage manager to normalize URLs for both fanfiction.net and fanfiction.ws.
   - Updated base website handler to include default banner visibility setting.
   - Improved fanfiction handler to support TLD preference and ensure URL normalization based on user settings.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .eslintrc.json
   - .github/copilot-instructions.md
   - .prettierrc
   - build-output.txt
   - package-lock.json
   - package.json
   - ... (14 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[d457c15] 2026-02-13 Refactor popup HTML for improved readability and consistency; add enhance button to summary group in chunking UI
   Refactor popup HTML for improved readability and consistency; add enhance button to summary group in chunking UI
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - src/background/offscreen.html
   - src/content/content.js
   - src/library/library.html
   - src/popup/popup.html
   - src/utils/chunking/chunk-summary-ui.js
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[6c18ae0] 2026-02-12 feat: Revamp popup UI with improved tab navigation and notification handling
   feat: Revamp popup UI with improved tab navigation and notification handling
   - Reorganized popup HTML structure for better user experience.
   - Added a dedicated notifications tab with filtering options.
   - Enhanced visual elements with emojis for better clarity.
   - Updated JavaScript to support new notifications tab and improved tab switching logic.
   - Removed deprecated elements and functions related to modal notifications.
   - Improved chunk caching logic to include metadata updates.
   - Introduced URL normalization for FanFiction.net to redirect to preferred subdomains based on user settings.
   Files:
   - dev/emoji-report.txt
   - package.json
   - src/background/background.js
   - src/content/content.js
   - src/library/library.css
   - src/library/library.html
   - ... (11 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[d735d4f] 2026-02-11 feat(chunking): Implement UI components for chunk management and enhance theme detection
   feat(chunking): Implement UI components for chunk management and enhance theme detection
   - Added chunk-ui.js for creating and managing chunk banners, content containers, and progress indicators.
   - Introduced theme-aware color palettes based on dark/light mode detection.
   - Updated chunking index to include new UI module.
   - Enhanced constants for word-based chunking configuration and summary button frequency.
   - Modified base handler and specific website handlers to support dark mode detection.
   - Improved metadata extraction and content handling in fanfiction, ranobes, and scribblehub handlers.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/build.js
   - src/background/background.js
   - src/content/content.js
   - src/library/library.html
   - src/library/library.js
   - src/manifest-chromium.json
   - ... (16 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 4.0.0
   - src/manifest-chromium.json: 4.0.0

[202b9dd] 2026-02-11 feat: update build instructions and add release notes for version 3.9.0
   feat: update build instructions and add release notes for version 3.9.0
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - REVIEWER NOTES.md
   - docs/release/RELEASE_NOTES_3.9.0.md
   - releases/RanobeGemini_v3.9.0_chromium.zip
   - releases/RanobeGemini_v3.9.0_firefox.zip
   - releases/source/Ranobe-gemini_v3.9.0_source.zip
   - src/library/library.js
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 3.9.0
   - src/manifest-chromium.json: 3.9.0

[65ef166] 2026-02-10 feat: add randomized novel suggestions feature and improve site settings management
   feat: add randomized novel suggestions feature and improve site settings management
   - Implemented a new feature to load randomized novel suggestions from enabled sites, enhancing user experience by providing diverse reading options.
   - Updated site settings management to use a new key for per-site settings, improving clarity and maintainability.
   - Enhanced the novel reading progress update logic to automatically adjust reading status based on chapter progress.
   - Refactored the fanfiction handler to support mobile and desktop redirection based on user preferences.
   - Improved the Ranobes handler to map system statuses to reading statuses, providing better integration with user bookmarks.
   - Made various UI improvements for displaying novel information and suggestions in the popup.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/emoji-report.txt
   - dev/fix-emoji.js
   - docs/release/CHANGELOG.md
   - docs/ux/BUTTON_CONSISTENCY.md
   - package.json
   - releases/RanobeGemini_v3.9.0_chromium.zip
   - ... (19 more)
   Package:
   - name: ranobe-gemini
   - version: 4.0.0
   Manifests:
   - src/manifest-firefox.json: 3.9.0
   - src/manifest-chromium.json: 3.9.0

[7f9086a] 2026-02-10 feat: Add Table of Contents to various documentation files for improved navigation
   feat: Add Table of Contents to various documentation files for improved navigation
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - docs/settings/LIBRARY_SETTINGS_VISUAL_GUIDE.md
   - docs/ux/ADVANCED_TAB_REORGANIZATION.md
   - docs/ux/BUTTON_CONSISTENCY.md
   - docs/ux/DOMAIN_MANAGEMENT.md
   - docs/ux/FIREFOX_FIXES.md
   Package:
   - name: ranobe-gemini
   - version: 3.9.0
   Manifests:
   - src/manifest-firefox.json: 3.9.0
   - src/manifest-chromium.json: 3.9.0

[2763e35] 2026-02-10 feat: Add visual guide for Library Settings and reorganize Advanced Tab
   feat: Add visual guide for Library Settings and reorganize Advanced Tab
   - Introduced a comprehensive visual guide for Library Settings, detailing layout, interaction patterns, and accessibility considerations.
   - Reorganized the Advanced Tab in popup.html for improved UX, creating 7 distinct sections with clear hierarchy and visual enhancements.
   - Redesigned Library Settings modal in library.html with a modern card-based layout and color coding for better usability.
   - Established a Button Consistency Guide to ensure uniform behavior across interfaces.
   - Implemented a Domain Management system for automatic synchronization of website handlers in browser manifests.
   - Fixed critical errors and warnings for Firefox validation, ensuring compatibility and readiness for submission.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .vscode/extensions.json
   - docs/LIBRARY_SETTINGS_VISUAL_GUIDE.md
   - docs/README.md
   - docs/architecture/ARCHITECTURE.md
   - docs/architecture/DYNAMIC_DOMAINS.md
   - docs/architecture/KEEP_ALIVE.md
   - ... (42 more)
   Package:
   - name: ranobe-gemini
   - version: 3.9.0
   Manifests:
   - src/manifest-firefox.json: 3.9.0
   - src/manifest-chromium.json: 3.9.0

[9c541dd] 2026-02-10 feat: Enhance backup functionality and settings management
   feat: Enhance backup functionality and settings management
   - Added support for comprehensive backup including novel library and settings.
   - Updated backup retention and quota management for Google Drive.
   - Improved restore functionality to include non-sensitive settings.
   - Introduced domain preference handling for Fanfiction site redirection.
   - Enhanced mobile handler to fetch desktop metadata and validate content extraction.
   - Incremented version for expanded backup format to 2.0.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - docs/ADVANCED_TAB_REORGANIZATION.md
   - docs/BUTTON_CONSISTENCY.md
   - docs/FIREFOX_DRIVE_SYNC_FIX.md
   - docs/LIBRARY_SETTINGS_BENTO_LAYOUT.md
   - docs/LIBRARY_SETTINGS_CODE_COMPARISON.md
   - docs/LIBRARY_SETTINGS_IMPLEMENTATION.md
   - ... (19 more)
   Package:
   - name: ranobe-gemini
   - version: 3.9.0
   Manifests:
   - src/manifest-firefox.json: 3.9.0
   - src/manifest-chromium.json: 3.9.0

[596fcbe] 2026-02-10 feat(notification-manager): add grouping for related notifications by novel
   feat(notification-manager): add grouping for related notifications by novel
   - Enhanced getAll method to support grouping of notifications.
   - Implemented groupNotifications method to group related notifications.
   - Added isGroupableNotification, extractNovelId, and createNotificationGroup methods for notification handling.
   fix(fanfiction-handler): support fanfiction.ws domain and improve redirect handling
   - Added support for fanfiction.ws domain in SUPPORTED_DOMAINS.
   - Improved redirect logic to handle errors when redirecting from fanfiction.ws.
   refactor(fanfiction-mobile-handler): remove redundant initialization logic
   Files:
   - package.json
   - src/background/background.js
   - src/content/content.js
   - src/library/library.js
   - src/library/shared-shelf-helpers.js
   - src/library/websites/ao3/shelf-page.js
   - ... (11 more)
   Package:
   - name: ranobe-gemini
   - version: 3.9.0
   Manifests:
   - src/manifest-firefox.json: 3.9.0
   - src/manifest-chromium.json: 3.9.0

[d96699c] 2026-02-03 feat: update comprehensive backup version and enhance version compatibility checks
   feat: update comprehensive backup version and enhance version compatibility checks
   - Bump backup version from 2.0 to 3.0.
   - Introduce function to retrieve extension version from manifest.
   - Modify backup creation options to include credentials by default.
   - Implement comprehensive version checking during backup restoration, including warnings for version mismatches and legacy format detection.
   - Update constants for comprehensive backup keys to include new settings.
   - Refactor log upload function to use existing import instead of dynamic import.
   - Add new reading status "up-to-date" for ongoing novels.
   Files:
   - docs/CONTINUOUS_BACKUP_GUIDE.md
   - docs/OAUTH_CHECKBOX_FIX.md
   - docs/RELEASE_NOTES_3.7.0.md
   - docs/RELEASE_NOTES_3.8.0.md
   - docs/RELEASE_NOTES_3.8.0_MARKETPLACE.md
   - docs/v3.8.0_FINAL_CHECKLIST.md
   - ... (21 more)
   Package:
   - name: ranobe-gemini
   - version: 3.8.0
   Manifests:
   - src/manifest-firefox.json: 3.8.0
   - src/manifest-chromium.json: 3.8.0

[55bf54a] 2026-01-31 feat: enable debug mode by default and update Google Drive OAuth configuration
   feat: enable debug mode by default and update Google Drive OAuth configuration
   - Set DEFAULT_DEBUG_MODE to true for enhanced debugging during development.
   - Removed default Google Drive OAuth client ID and secret; users must configure their own.
   - Added expected redirect URIs for OAuth validation.
   - Introduced comprehensive backup functionality, allowing users to back up all extension data, including library data, settings, and optional Google Drive credentials.
   - Implemented telemetry system for anonymous usage tracking with opt-out capability.
   - Added functions for creating, restoring, and managing rolling backups.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - docs/CHANGELOG.md
   - docs/RELEASE_NOTES_3.7.0.md
   - src/background/background.js
   - src/library/library.html
   - src/library/library.js
   - src/manifest-chromium.json
   - ... (5 more)
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[80ad62f] 2026-01-30 v3.7.0 feat: add release notes for version 3.7.0 with Google Drive OAuth enhancements, notification system improvements, and UI fixes
   v3.7.0 feat: add release notes for version 3.7.0 with Google Drive OAuth enhancements, notification system improvements, and UI fixes
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - docs/CHANGELOG.md
   - docs/RELEASE_NOTES_3.7.0.md
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[981aed6] 2026-01-30 feat: update manifest files for Chromium and Firefox, add new release binaries
   feat: update manifest files for Chromium and Firefox, add new release binaries
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .prettierrc
   - releases/RanobeGemini_v3.7.0_chromium.zip
   - releases/RanobeGemini_v3.7.0_firefox.zip
   - releases/source/Ranobe-gemini_v3.7.0_source.zip
   - src/manifest-chromium.json
   - src/manifest-firefox.json
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[2797029] 2026-01-30 feat: add progress update prompt for reading chapters
   feat: add progress update prompt for reading chapters
   - Implemented a progress update prompt that notifies users when their saved progress is behind the current chapter they are reading.
   - Introduced a cooldown mechanism to prevent spamming the prompt.
   - Enhanced the UI with a banner that allows users to update their progress or ignore the prompt.
   - Updated the logic to check and show the prompt based on the current and stored chapter values.
   style: add new styles for buttons in fanfiction website
   - Added new button styles for secondary, icon, and danger buttons in the fanfiction stylesheet.
   - Improved hover effects for better user interaction.
   Files:
   - docs/BACKUP_GUIDE.md
   - docs/README_GOOGLE_DRIVE.md
   - docs/guides/GOOGLE_DRIVE_BACKUP_SETUP.md
   - docs/guides/OAUTH_SETUP_DETAILED.md
   - landing/drive-setup.html
   - landing/drive-setup.js
   - ... (13 more)
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[ca777b3] 2026-01-29 feat: enhance notification system and domain settings management
   feat: enhance notification system and domain settings management
   - Added logging for notifications in content script with detailed metadata.
   - Implemented caching for novel data to improve notification context.
   - Introduced domain settings management to enable/disable features per domain.
   - Updated site settings utility to handle domain-specific settings.
   - Enhanced popup notifications to display additional metadata.
   - Improved notification loading and badge updating mechanisms in the popup.
   - Added new statistics for single fandom and crossover stories in fanfiction index.
   Files:
   - src/background/background.js
   - src/content/content.js
   - src/library/websites/fanfiction/index.html
   - src/popup/popup.css
   - src/popup/popup.js
   - src/utils/site-settings.js
   - ... (1 more)
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[dd902a7] 2026-01-29 Enhance website handlers for improved navigation and metadata extraction
   Enhance website handlers for improved navigation and metadata extraction
   - Updated AO3 handler to change definition list label from "Gemini" to "Ranobe Gemini".
   - Added initialization logic in Fanfiction handler to redirect bare domain to mobile or desktop versions based on user agent.
   - Enhanced Fanfiction handler to exclude user profile pages and improve chapter page detection.
   - Improved metadata extraction in Fanfiction handler, including better handling of genres, characters, and relationships.
   - Added initialization logic in Fanfiction mobile handler for redirecting to the correct version based on user agent.
   - Updated Handler Manager to ensure handlers are initialized only once, preventing duplicate initializations.
   - Modified Ranobes handler to correctly identify chapter and novel pages, excluding chapter URLs from being treated as novel pages.
   Files:
   - .vscode/bookmarks.json
   - .vscode/settings.json
   - src/content/content.js
   - src/library/library.js
   - src/library/websites/ao3/index.html
   - src/library/websites/ao3/novel-card.js
   - ... (22 more)
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[e153a27] 2026-01-28 feat: add Notification Manager to handle notifications across the extension
   feat: add Notification Manager to handle notifications across the extension
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - .vscode/bookmarks.json
   - .vscode/settings.json
   - src/popup/popup-tabs.js
   - src/popup/popup.css
   - src/popup/popup.html
   - ... (3 more)
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[45c9e94] 2026-01-27 feat: Update author display in novel modals for Ranobes and ScribbleHub
   feat: Update author display in novel modals for Ranobes and ScribbleHub
   - Changed author display to use links in the modal for both Ranobes and ScribbleHub.
   - Enhanced the ScribbleHub novel card to include a detailed modal with improved metadata display.
   - Updated the manifest version to 3.7.0 and changed icon paths for consistency.
   - Added defaultDebugMode constant to constants.js for configuration.
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - .vscode/bookmarks.json
   - package.json
   - src/library/library.html
   - src/library/library.js
   - src/library/websites/ao3/index.html
   - ... (15 more)
   Package:
   - name: ranobe-gemini
   - version: 3.7.0
   Manifests:
   - src/manifest-firefox.json: 3.7.0
   - src/manifest-chromium.json: 3.7.0

[6d3c1ed] 2026-01-27 feat: Add Copilot instructions, enhance build system documentation, and improve notification styles
   feat: Add Copilot instructions, enhance build system documentation, and improve notification styles
   Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .github/copilot-instructions.md
   - .gitignore
   - .vscode/extensions.json
   - .vscode/settings.json
   - dev/build.js
   - dev/watch.js
   - ... (6 more)
   Package:
   - name: ranobe-gemini
   - version: 3.6.0
   Manifests:
   - src/manifest-firefox.json: 3.6.0
   - src/manifest-chromium.json: 3.6.0

[1e40557] 2025-12-23 feat: Implement platform-specific manifest files for Firefox and Chromium; enhance build process and documentation
   feat: Implement platform-specific manifest files for Firefox and Chromium; enhance build process and documentation
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/build-cross-platform.js
   - dev/build.js
   - dev/generate-manifest-domains.js
   - dev/package-all.js
   - dev/package-chromium.js
   - dev/package-firefox.js
   - ... (15 more)
   Package:
   - name: ranobe-gemini
   - version: 3.6.0
   Manifests:
   - src/manifest-firefox.json: 3.6.0
   - src/manifest-chromium.json: 3.6.0

[62b54af] 2025-12-23 v3.6.0 Implement Drive backup with 3-backup retention and continuous rolling file + reorganize docs
   v3.6.0 Implement Drive backup with 3-backup retention and continuous rolling file + reorganize docs
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - README.md
   - docs/BACKUP_GUIDE.md
   - docs/DETAILED_CODE_CHANGES.md
   - docs/IMPLEMENTATION_COMPLETE.md
   - docs/IMPLEMENTATION_NOTES.md
   - ... (42 more)
   Package:
   - name: ranobe-gemini
   - version: 3.6.0

[756bc7f] 2025-12-23 feat: Update theme variables and styles for dark and light modes
   feat: Update theme variables and styles for dark and light modes
   - Refactored CSS variables for dark mode in shelf-page.css, enhancing color contrast and readability.
   - Introduced light mode variables with improved color palette for shelf-page.css.
   - Updated JavaScript to apply theme settings from storage and listen for changes in shelf-page.js.
   - Adjusted popup styles to align with new theme variables in popup.css.
   - Changed icon references in index.html and popup.html to a unified icon.
   - Bumped version number in manifest.json to 3.5.0 and updated icon paths.
   - Added functionality to auto-adjust stale reading statuses in novel-library.js.
   Files:
   - .gemini/settings.json
   - README.md
   - docs/development/README.md
   - docs/presentation.md
   - landing/index.html
   - landing/terms.html
   - ... (48 more)
   Package:
   - name: ranobe-gemini
   - version: 3.5.0

[f70ca4b] 2025-12-18 feat: Enhance metadata extraction across various handlers
   feat: Enhance metadata extraction across various handlers
   - Added taxonomy definitions for AO3, Fanfiction, Ranobes, and WebNovel handlers to improve filtering capabilities.
   - Implemented robust metadata extraction methods in AO3, Fanfiction, Ranobes, ScribbleHub, and WebNovel handlers to capture author, title, genres, tags, status, and description.
   - Improved character and relationship extraction logic in Fanfiction handler to better identify and categorize characters.
   - Enhanced error handling during metadata extraction to ensure stability and reliability.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .vscode/bookmarks.json
   - README.md
   - docs/CHANGELOG.md
   - docs/architecture/ARCHITECTURE.md
   - docs/architecture/KEEP_ALIVE.md
   - docs/architecture/README.md
   - ... (71 more)
   Package:
   - name: ranobe-gemini
   - version: 3.5.0

[da6a3f8] 2025-12-06 fix: Update paths for icons in index.html and adjust YAML formatting in deploy workflow
   fix: Update paths for icons in index.html and adjust YAML formatting in deploy workflow
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .github/workflows/deploy-landing.yml
   - landing/index.html
   Package:
   - name: ranobe-gemini
   - version: 3.3.0

[58b29d9] 2025-12-06 Add privacy policy, terms of use, sitemap, and robots.txt; implement browser and site cards in script
   Add privacy policy, terms of use, sitemap, and robots.txt; implement browser and site cards in script
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .github/workflows/deploy-landing.yml
   - README.md
   - landing/assets/og-card.svg
   - landing/index.html
   - landing/privacy.html
   - landing/robots.txt
   - ... (4 more)
   Package:
   - name: ranobe-gemini
   - version: 3.3.0

[f8cfd8a] 2025-12-06 feat: Release version 3.3.0 with Google Drive integration and enhanced logging
   feat: Release version 3.3.0 with Google Drive integration and enhanced logging
   - Added Google Drive OAuth support for log backup and management.
   - Implemented persistent logging with IndexedDB for better log handling.
   - Introduced keep-alive mechanisms for improved background script reliability.
   - Updated keyboard shortcuts for library and enhancement actions.
   - Enhanced error handling and user feedback in the popup interface.
   - Added new settings for Google Drive client ID and folder ID.
   - Refactored background and content scripts for better modularity and maintainability.
   Files:
   - .gitignore
   - dev/build-cross-platform.js
   - package.json
   - ranobe-gemini-library-2025-12-05.json
   - releases/RanobeGemini_v3.3.0_chromium.zip
   - releases/RanobeGemini_v3.3.0_firefox.zip
   - ... (11 more)
   Package:
   - name: ranobe-gemini
   - version: 3.3.0

[e41f19e] 2025-12-05 Refactor website handler logging and improve handler loading mechanism
   Refactor website handler logging and improve handler loading mechanism
   - Introduced a centralized logging system using debugLog and debugError across all website handlers for consistency and better debugging.
   - Updated FanfictionMobileHandler to ensure it runs before desktop handlers by setting a PRIORITY.
   - Replaced static handler registration with dynamic loading of handlers from a generated handler registry, allowing for easier addition of new handlers.
   - Enhanced error handling during handler loading and improved deduplication of handlers based on constructor names.
   - Updated metadata handling in RanobesHandler, ScribbleHubHandler, and WebNovelHandler to include flags for incomplete metadata and detail page requirements.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/build.js
   - package.json
   - ranobe-gemini-library-2025-12-05.json
   - releases/RanobeGemini_v3.1.0_chromium.zip
   - releases/RanobeGemini_v3.1.0_firefox.zip
   - releases/RanobeGemini_v3.2.0_chromium.zip
   - ... (36 more)
   Package:
   - name: ranobe-gemini
   - version: 3.2.0

[0e0a694] 2025-12-05 Add dedicated handlers for ScribbleHub and WebNovel
   Add dedicated handlers for ScribbleHub and WebNovel
   - Implement ScribbleHubHandler for extracting content and metadata from ScribbleHub novel and chapter pages.
   - Support for novel metadata extraction, chapter navigation, and UI control insertion points.
   - Enhance WebNovelHandler to improve chapter and novel page detection, metadata extraction, and UI control configuration.
   - Update handler types to indicate dedicated page requirements for metadata retrieval.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - .prettierrc
   - .vscode/bookmarks.json
   - .vscode/settings.json
   - dev/build-cross-platform.js
   - dev/build.js
   - ... (45 more)
   Package:
   - name: ranobe-gemini
   - version: 3.1.0

[a849844] 2025-11-30 feat: Update styling and functionality for library components and improve metadata extraction for Ranobes handler
   feat: Update styling and functionality for library components and improve metadata extraction for Ranobes handler
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - src/library/library.css
   - src/library/library.html
   - src/library/library.js
   - src/popup/popup.html
   - src/utils/website-handlers/fanfiction-handler.js
   - ... (1 more)
   Package:
   - name: ranobe-gemini
   - version: 3.0.0

[39c431d] 2025-11-28 feat: Implement recent novels carousel in library view
   feat: Implement recent novels carousel in library view
   - Added a carousel section to display recently read novels with controls for navigation.
   - Introduced functionality for auto-scrolling and manual navigation of the carousel.
   - Enhanced novel metadata extraction for better library management.
   - Updated styles for carousel and shelf sections for improved UI/UX.
   - Refactored existing code to accommodate new features and improve maintainability.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .vscode/settings.json
   - docs/guides/ADDING_NEW_WEBSITES.md
   - src/content/content.js
   - src/library/library.css
   - src/library/library.html
   - src/library/library.js
   - ... (5 more)
   Package:
   - name: ranobe-gemini
   - version: 3.0.0

[e943213] 2025-11-28 Add comprehensive documentation for features and guide for adding new websites
   Add comprehensive documentation for features and guide for adding new websites
   - Created `README.md` in `docs/features/` detailing major features of the RanobeGemini extension, including Novel Library System, Backup API Keys, Chunking System, Emoji Support, Summary Modes, Progressive Enhancement, and Custom Prompts.
   - Added `ADDING_NEW_WEBSITES.md` in `docs/guides/` to provide a step-by-step process for adding support for new novel websites, including handler system architecture, DOM structure analysis, handler implementation, and testing.
   - Established `README.md` in `docs/guides/` to organize user guides, planned guides, and contribution guidelines for the RanobeGemini extension.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - .vscode/settings.json
   - docs/ARCHITECTURE.md
   - docs/CHANGELOG.md
   - docs/README.md
   - docs/TODO.md
   - ... (11 more)
   Package:
   - name: ranobe-gemini
   - version: 3.0.0

[f12b0c1] 2025-11-28 feat: Enhance popup functionality with new prompts and backup API key management
   feat: Enhance popup functionality with new prompts and backup API key management
   - Added new constants for default prompts including short summary prompt and author notes handling.
   - Implemented UI elements for managing backup API keys, including adding and removing keys.
   - Updated novel library to support custom prompts for individual novels.
   - Enhanced fanfiction handler to extract story descriptions and author names more effectively.
   - Improved the full prompt preview functionality to include site-specific prompts and better formatting.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - dev/generate-manifest-domains.js
   - releases/RanobeGemini_v3.0.0.zip
   - src/background/background.js
   - src/content/content.css
   - src/content/content.js
   - src/library/library.css
   - ... (9 more)
   Package:
   - name: ranobe-gemini
   - version: 3.0.0

[367c433] 2025-11-25 feat: Revamp Novel Library and UI Enhancements
   feat: Revamp Novel Library and UI Enhancements
   - Updated popup.html to improve the layout and add a compact view for recent novels.
   - Introduced a new NovelLibrary class in novel-library.js to manage novels and shelves.
   - Added support for novel statistics and recent novels display in the popup.
   - Implemented shelf metadata for various website handlers to organize novels by site.
   - Enhanced event handling in popup.js for library interactions and novel loading.
   - Updated version number to 3.0.0 in popup.html.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - REVIEWER NOTES.md
   - dev/build.js
   - docs/CHANGELOG.md
   - package.json
   - releases/RanobeGemini_v3.0.0.zip
   - releases/source/Ranobe-gemini_v3.0.0_source.zip
   - ... (16 more)
   Package:
   - name: ranobe-gemini
   - version: 3.0.0

[9c48f0f] 2025-11-25 feat: Bump version to 2.9.0 and enhance functionality
   feat: Bump version to 2.9.0 and enhance functionality
   - Updated package and manifest versions to 2.9.0.
   - Added a new mobile handler for FanFiction.net to support mobile-specific content.
   - Enhanced the existing FanFiction handler to exclude mobile URLs.
   - Improved paragraph extraction and HTML sanitization in content.js.
   - Increased max output tokens for summaries to allow more comprehensive results.
   - Added a version switcher button for FanFiction.net to toggle between mobile and desktop versions.
   - Refactored storage manager to normalize cache keys for mobile and desktop versions.
   Files:
   - .gitignore
   - docs/CHANGELOG.md
   - package.json
   - releases/RanobeGemini_v2.9.0.zip
   - releases/source/Ranobe-gemini_v2.9.0_source.zip
   - src/background/background.js
   - ... (7 more)
   Package:
   - name: ranobe-gemini
   - version: 2.9.0

[d246b54] 2025-11-25 feat: Bump version to 2.8.0 and enhance domain handling
   feat: Bump version to 2.8.0 and enhance domain handling
   - Updated package.json to version 2.8.0 with new scripts and additional files.
   - Added new release zip files for version 2.8.0.
   - Updated manifest.json for versioning and added strict minimum version for Gecko.
   - Refactored domain handling in domain-constants.js to dynamically collect supported domains from website handlers.
   - Introduced new website handlers for AO3, Fanfiction, and WebNovel with specific domain management and prompts.
   - Enhanced RanobesHandler to include wildcard support for subdomains.
   - Implemented WebNovelHandler to manage infinite scroll chapters and dynamic content extraction.
   Files:
   - .github/CONTRIBUTING.md
   - .github/ISSUE_TEMPLATE/bug_report.md
   - .github/ISSUE_TEMPLATE/feature_request.md
   - .github/ISSUE_TEMPLATE/website_support.md
   - .github/PULL_REQUEST_TEMPLATE.md
   - .gitignore
   - ... (23 more)
   Package:
   - name: ranobe-gemini
   - version: 2.8.0

[c55a678] 2025-11-24 feat: Update to version 2.7.1 with enhancements, new features, and improved styling
   feat: Update to version 2.7.1 with enhancements, new features, and improved styling
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - dev/watch.js
   - package.json
   - releases/RanobeGemini_v2.7.0.zip
   - releases/RanobeGemini_v2.7.1.zip
   - src/content/content.css
   - ... (6 more)
   Package:
   - name: ranobe-gemini
   - version: 2.7.1

[d0d69d0] 2025-11-24 feat: Update to version 2.7.0 with new features and improvements
   feat: Update to version 2.7.0 with new features and improvements
   - Added support for caching enhanced content using a new StorageManager class.
   - Implemented caching logic in content.js to check for and load cached enhanced content.
   - Introduced a delete button in the enhanced banner to allow users to remove cached content.
   - Added a new handler for Archive of Our Own (AO3) to extract content from ao3.org.
   - Updated Ranobes handler to support ranobes.top.
   - Enhanced UI in popup with improved styles and resizing capabilities.
   - Updated package.json and manifest.json to reflect version change to 2.7.0.
   Files:
   - .vscode/extensions.json
   - package.json
   - releases/RanobeGemini_v2.7.0.zip
   - src/content/content.js
   - src/manifest.json
   - src/popup/popup.css
   - ... (6 more)
   Package:
   - name: ranobe-gemini
   - version: 2.7.0

[34ae30a] 2025-11-24 feat: Update model versions and enhance novel loading experience
   feat: Update model versions and enhance novel loading experience
   - Updated model ID from "gemini-1.5-pro" to "gemini-2.5-flash" in constants.
   - Modified popup.js to reflect new model names and options, including error handling for model selection.
   - Enhanced novel loading functionality to group novels by domain, providing a clearer organization in the UI.
   - Implemented auto-enhance feature for novels, allowing users to toggle enhancement settings.
   - Improved content handling in FanfictionHandler to support text-only enhancements while preserving original formatting.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .github/CONTRIBUTING.md
   - .gitignore
   - .vscode/tasks.json
   - dev/build.js
   - dev/package-firefox.js
   - dev/watch.js
   - ... (25 more)
   Package:
   - name: ranobe-gemini
   - version: 2.6.0

[ef9ec72] 2025-05-25 feat: Add new version 2.5.0 release and enhance content processing
   feat: Add new version 2.5.0 release and enhance content processing
   - Added RanobeGemini_v2.5.0.zip to releases.
   - Improved content chunking logic in background.js for better performance and handling of large chapters.
   - Enhanced error handling and retry mechanisms during content processing.
   - Updated CSS styles for better mobile responsiveness in content.css.
   - Refactored content.js to support work-in-progress and error banners during content enhancement.
   - Modified manifest.json to streamline background script loading.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - releases/RanobeGemini_v2.5.0.zip
   - src/background/background.js
   - src/content/content.css
   - src/content/content.js
   - src/manifest.json

[17646a5] 2025-05-25 feat: Enhance content processing and styling
   feat: Enhance content processing and styling
   - Added a function to split large content into manageable chunks based on paragraph and sentence boundaries for improved processing.
   - Updated the game stats box styling in CSS for better visual presentation.
   - Enhanced the content script to sanitize HTML and preserve game stats boxes during content enhancement.
   - Modified the popup prompt to include clearer instructions for formatting section headings and game-like status windows.
   - Updated constants for the default prompt to reflect new formatting guidelines for RPG-style information.
   - Improved the handling of preserved HTML elements to ensure proper restoration after content enhancement.
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - .vscode/settings.json
   - src/background/background.js
   - src/content/content.css
   - src/content/content.js
   - src/popup/popup.js
   - ... (1 more)

[1f6feef] 2025-05-23 v2.4.0 Working State - feat: Update DEFAULT_PROMPT to include detailed formatting instructions for game-like status windows
   v2.4.0 Working State - feat: Update DEFAULT_PROMPT to include detailed formatting instructions for game-like status windows
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - .gitignore
   - index.md
   - presentation.pdf
   - releases/RanobeGemini_v2.4.0.zip
   - src/background/background.js
   - src/content/content.css
   - ... (9 more)

[78e4800] 2025-05-17 chore: changed `simple-popup` to use `popup`
   chore: changed `simple-popup` to use `popup`
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - ARCHITECTURE.md
   - build/build.js
   - dist/background/background.js
   - dist/config/config.js
   - dist/content/content.css
   - dist/content/content.js
   - ... (39 more)

[941cf0c] 2025-05-17 feat: Enhance simple-popup.js with advanced settings and chunking options
   feat: Enhance simple-popup.js with advanced settings and chunking options
   - Added advanced settings for temperature, top-p, top-k, and custom endpoint.
   - Implemented chunk size settings with validation and default values.
   - Improved UI for advanced settings with toggle functionality.
   - Updated prompts to include new formatting instructions.
   - Introduced novel loading functionality with improved display and sorting.
   - Added utility functions for date formatting and domain checking.
   fix: Update constants.js with new default chunk size and rate limit
   Files:
   - .editorconfig
   - .vscode/settings.json
   - CHANGELOG.md
   - README.md
   - build/build.js
   - dist/background/background.js
   - ... (46 more)

[6975d60] 2025-04-21 chore: Update architecture documentation, changelog, and license; fix icon references in manifest
   chore: Update architecture documentation, changelog, and license; fix icon references in manifest
   Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
   Files:
   - ARCHITECTURE.md
   - CHANGELOG.md
   - LICENSE.md
   - src/README.md
   - src/icons/logo-light-1024.png
   - src/manifest.json

[132bb95] 2025-04-19 v2.2.0 changed `FireFox` dir to `src` to indicate near future chomium support, added Fanfiction.net Mobile version, Corrected the summary colour scheme.
   v2.2.0 changed `FireFox` dir to `src` to indicate near future chomium support, added Fanfiction.net Mobile version, Corrected the summary colour scheme.
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - .github/workflows/release.yml
   - .gitignore
   - .vscode/mcp.json
   - .vscode/settings.json
   - .vscode/tasks.json
   - ADDING_NEW_WEBSITES.md
   - ... (54 more)

[53c7573] 2025-04-15 chore: Update changelog for version 2.1.0 and modify manifest and constants for improved functionality
   chore: Update changelog for version 2.1.0 and modify manifest and constants for improved functionality
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - CHANGELOG.md
   - FireFox/RanobeGemini_v2.0.0.zip
   - FireFox/RanobeGemini_v2.1.0.zip
   - FireFox/manifest.json
   - FireFox/utils/constants.js

[66a3d65] 2025-04-15 chore: Remove deprecated files and update manifest with additional icon sizes
   chore: Remove deprecated files and update manifest with additional icon sizes
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - Chromium/.editorconfig
   - Chromium/.env
   - Chromium/README.md
   - FireFox/manifest.json
   - FireFox/utils/constants.js

[a805948] 2025-04-14 feat: Add content utility functions for HTML processing and text formatting
   feat: Add content utility functions for HTML processing and text formatting
   feat: Implement base website content handler for generic content extraction
   feat: Create fanfiction handler for extracting content from fanfiction.net
   feat: Develop handler manager to dynamically load website-specific handlers
   feat: Add ranobes handler for extracting content from ranobes.top
   chore: Package extension files into v2.1.0.zip for release
   docs: Add Apache License 2.0 to the project
   docs: Update README with new features, installation instructions, and usage guidelines
   Files:
   - ADDING_NEW_WEBSITES.md
   - CONTRIBUTING.md
   - FireFox/README.md
   - FireFox/background/background.js
   - FireFox/content/content.css
   - FireFox/content/content.js
   - ... (12 more)

[9798e98] 2025-04-10 Remove sensitive API key from environment configuration files
   Remove sensitive API key from environment configuration files
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - .env
   - FireFox/.env

[2a9b04e] 2025-04-10 Refactor Ranobe Gemini extension: - Removed constants.js file and integrated prompts directly into simple-popup.js and utils/constants.js. - Added chapter summarization feature and permanent prompts for consistent formatting. - Enhanced FAQ section in simple-popup.html with interactive elements. - Updated welcome page to streamline API key setup process. - Improved README with new features and usage instructions. - Deleted unused welcome.html and welcome.js files.
   Refactor Ranobe Gemini extension:
   - Removed constants.js file and integrated prompts directly into simple-popup.js and utils/constants.js.
   - Added chapter summarization feature and permanent prompts for consistent formatting.
   - Enhanced FAQ section in simple-popup.html with interactive elements.
   - Updated welcome page to streamline API key setup process.
   - Improved README with new features and usage instructions.
   - Deleted unused welcome.html and welcome.js files.
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - .github/workflows/release.yml
   - CHANGELOG.md
   - FireFox/.env
   - FireFox/README.md
   - FireFox/RanobeGemini.zip
   - FireFox/RanobeGemini_v1.1.0.zip
   - ... (16 more)

[25b6b9a] 2025-04-06 v1.1.0 Extension completed till certain level need to migrate to manifest v3
   v1.1.0 Extension completed till certain level need to migrate to manifest v3
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - .env
   - FireFox/.env
   - FireFox/README.md
   - FireFox/RanobeGemini.zip
   - FireFox/TODO.md
   - FireFox/background/background.js
   - ... (13 more)

[5a50e90] 2025-04-04 v1.0.0 - Rename extension from Ranobe Novel Enhancer to Ranobe Gemini and update related assets and is a MVP
   v1.0.0 - Rename extension from Ranobe Novel Enhancer to Ranobe Gemini and update related assets and is a MVP
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - CHANGELOG.md
   - FireFox/README.md
   - FireFox/background/background.js
   - FireFox/config/config.js
   - FireFox/content/content.css
   - FireFox/content/content.js
   - ... (27 more)

[7aa279c] 2025-04-03 v1.0.0 for Firefox version MVP it works!
   v1.0.0 for Firefox version MVP it works!
   Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
   Files:
   - .gitignore
   - CHANGELOG.md
   - Chromium/.editorconfig
   - Chromium/.env
   - Chromium/README.md
   - FireFox/.editorconfig
   - ... (25 more)

