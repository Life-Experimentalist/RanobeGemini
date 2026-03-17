Mode: all
Total commits: 70

[a73db74] 2026-03-16 feat(4.4.0): improve UX with redesigned landing, collapsible content, reading-lists, and white-space styling
feat(4.4.0): improve UX with redesigned landing, collapsible content, reading-lists, and white-space styling

- Redesign Getting Started section in drive-setup.html with modern card-based layout
- Add CSS styles for setup timeline and step cards with better visual hierarchy
- Update content.css: change white-space from pre-wrap to pre-line for game stats, system messages, and other special content boxes
- Add comprehensive documentation in .github/copilot-instructions.md for reading-lists and collapsible sections architecture
- Verify collapsible sections implementation for fight scenes, R18 content, and author notes
- Ensure reading-list and custom list features are properly documented for future development
- All changes tested and build validation successful
---
[34d6041] 2026-03-16 feat(4.4.0): refactor rereading into reading-list badges
feat(4.4.0): refactor rereading into reading-list badges
---
[458ec18] 2026-03-16 docs(4.3.0): finalize landing nav and vertical Mermaid docs
docs(4.3.0): finalize landing nav and vertical Mermaid docs
---
[c8778d1] 2026-03-16 Enhance metadata extraction for fanfiction, ranobes, and scribblehub handlers
Enhance metadata extraction for fanfiction, ranobes, and scribblehub handlers

- Improved metadata extraction logic in FanfictionMobileHandler to include category, fandom hierarchy, and relationships.
- Refined regex patterns for extracting metadata fields such as rating, language, and word count.
- Added support for extracting reviews, favorites, and follows in FanfictionMobileHandler.
- Enhanced RanobesHandler to extract author information more reliably and ensure main novel URL is set correctly.
- Updated ScribbleHubHandler to include additional author and genre extraction methods, and improved numeric parsing for statistics.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[8a6800e] 2026-03-15 feat: Implement Incognito Mode with UI controls and settings
feat: Implement Incognito Mode with UI controls and settings

- Added Incognito Mode functionality to pause library tracking.
- Introduced UI elements in the popup and library settings for enabling/disabling Incognito Mode.
- Implemented duration settings for Incognito Mode with automatic expiration.
- Updated background scripts to handle Incognito Mode state and interactions.
- Enhanced accessibility by managing visibility of Gemini UI elements during Read Aloud.
- Refactored summary extraction logic to improve quality checks and retries.
- Added configuration options for hiding Gemini UI from Read Aloud in library settings.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[1c64d42] 2026-03-14 feat: Implement collapsible sections for fight scenes, R18 content, and author notes
feat: Implement collapsible sections for fight scenes, R18 content, and author notes

- Added a new collapsible sections system to enhance chapter view.
- Introduced default content filter settings for managing visibility of fight scenes, R18 content, and author notes.
- Updated popup.js to handle backup model selection and content filter settings.
- Enhanced chunking logic to accurately extract paragraphs from HTML content.
- Improved constants.js with new settings for collapsible content sections.
- Updated novel-library.js to derive story completion status from publication status.
- Added error handling for theme configuration to ensure compatibility with older runtimes.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[be8ecd9] 2026-03-12 feat: v4.2.0 enhance library UI and functionality
feat: v4.2.0 enhance library UI and functionality

- Added a new hero eyebrow section in library.html and styled it in library.css for improved visibility of the "Continue Reading" prompt.
- Refactored character and relationship rendering logic in novel-card.js to separate character and relationship sections for better clarity.
- Updated shelf-page.js to dynamically build reading status buttons based on available statuses, improving user interaction.
- Modified chunking UI components to include new pause and skip functionality, enhancing user control during processing.
- Improved accessibility by adding aria-hidden attributes to non-content UI elements in chunking components.
- Updated CSS styles for better responsiveness and visual consistency across various components.
- Introduced new constants for word count thresholds and cache restore retry delays to enhance performance.
- Released new versions for Chromium and Firefox with the latest updates and features.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[0ccbaf6] 2026-03-12 feat: Implement database fixes for FanFiction.net character data and enhance library UI with new buttons
feat: Implement database fixes for FanFiction.net character data and enhance library UI with new buttons

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[1c80627] 2026-03-10 feat: Add custom content box types feature with UI for user-defined styles
feat: Add custom content box types feature with UI for user-defined styles

- Introduced a new section in library settings for managing custom content boxes.
- Users can define CSS classes, display names, and styling options for content boxes.
- Implemented functionality to save and load custom box types from browser storage.
- Added live preview for custom boxes in the settings UI.
- Updated CSS styles to ensure proper alignment and presentation of headings and content.
- Bumped version to 4.2.0 to reflect new feature addition.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[5c0d202] 2026-03-08 feat(theme): enhance auto mode functionality with schedule and sun options
feat(theme): enhance auto mode functionality with schedule and sun options

- Added autoBehavior, timeCustomStart, and timeCustomEnd to DEFAULT_THEME for better theme management.
- Implemented schedule and sun-based auto mode detection in resolveMode function.
- Introduced helper functions for time-based checks and sunrise/sunset estimation.
- Updated THEME_PRESETS with new creative themes including "tokyo-night", "catppuccin-mocha", "synthwave", and others.
- Enhanced getThemePalette and setThemeVariables to support new auto mode features.

refactor(AO3Handler): improve formatting rules for author notes and special content

- Updated DEFAULT_SITE_PROMPT to clarify formatting rules for author notes, epigraphs, and flashbacks.
- Enhanced readability while preserving the author's style and intent.

refactor(FanFictionHandler): refine formatting guidelines for fanfiction content

- Revised DEFAULT_SITE_PROMPT to include specific formatting rules for author notes, quotes, and flashbacks.
- Emphasized the importance of maintaining the author's creative voice.

refactor(FanFictionMobileHandler): enhance formatting instructions for mobile fanfiction

- Updated DEFAULT_SITE_PROMPT to specify formatting rules for author notes, quotes, and flashbacks.
- Improved clarity on preserving the author's creative voice.

chore(release): prepare version 4.1.0 with new features and enhancements

- Added new release files for Chromium and Firefox versions.
- Included source code zip for version 4.1.0.
- Auto-generated build version file for tracking.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[bb80576] 2026-03-08 feat: add reading progress bar to novel modals and update export filename templates
feat: add reading progress bar to novel modals and update export filename templates

- Implemented a reading progress bar in the novel modals for Ranobes and ScribbleHub, displaying the current chapter and total chapters read.
- Updated the export filename formatting to include word count and changed the default export extension to EPUB.
- Removed unused background animation styles and CSS files from the HTML templates.
- Enhanced the copy functionality for novel information to use a new export template.
- Updated the manifest version to 4.1.0 for both Chromium and Firefox.
- Added new theme presets and removed background animation settings from the default theme configuration.
- Improved the chunking UI to provide better feedback on enhancement status and added new buttons for enhancing chunks directly from the UI.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[0576607] 2026-03-05 v4.0.0 complete Refactor AO3 and Fanfiction handlers to streamline download and copy functionality
v4.0.0 complete Refactor AO3 and Fanfiction handlers to streamline download and copy functionality

- Removed custom download settings for AO3 as it supports native downloads.
- Introduced a "Copy" button in both AO3 and Fanfiction handlers to copy formatted novel info to clipboard.
- Updated the method for retrieving export templates from library settings.
- Consolidated chapter UI configuration in BaseWebsiteHandler for better maintainability.
- Deprecated legacy methods for custom chapter buttons in favor of a unified configuration approach.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[e72701e] 2026-02-28 feat: Enhance site settings UI with section separators and text input fields
feat: Enhance site settings UI with section separators and text input fields

feat: Update service worker for improved caching and offline support

fix: Adjust popup model selection options for clarity and consistency

refactor: Improve popup.js to utilize DEFAULT_MODEL_ID for model selection

style: Refine chunking UI styles for better layout and responsiveness

fix: Update constants.js to change default model ID to "gemini-2.5-flash"

feat: Add filename template options for novel exports in copy format

feat: Implement FichHub download button with clipboard functionality in AO3 and Fanfiction handlers
Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[6421c29] 2026-02-26 feat: Enhance mobile metadata handling and improve readability
feat: Enhance mobile metadata handling and improve readability

- Added fetchDesktopMetadata method to retrieve comprehensive metadata from the desktop version of fanfiction.net for mobile pages.
- Implemented processRemoteMetadata to enrich mobile metadata with desktop data.
- Created injectMetadataSummary to display a styled summary of the fetched metadata above chapter content.
- Updated getMetadataSourceUrl to ensure mobile pages redirect to the desktop version for complete metadata.

refactor: Update handler imports in HandlerManager

- Changed import method in HandlerManager to use relative paths instead of browser.runtime.getURL for better compatibility.

feat: Introduce configurable settings for Ranobes and ScribbleHub handlers

- Added SETTINGS_DEFINITION for RanobesHandler and ScribbleHubHandler to expose configurable options in the Library Settings page.
- Implemented getProposedLibrarySettings method in both handlers to define user-customizable settings.

fix: Improve content extraction in Ranobes and ScribbleHub handlers

- Updated content extraction logic to include document title and provide a reason when chapter content is not found.

feat: Add metadata source URL methods for Ranobes and ScribbleHub

- Implemented getMetadataSourceUrl in both handlers to fetch metadata from the appropriate novel pages.

chore: Enhance WebNovelHandler with configurable settings

- Added SETTINGS_DEFINITION for WebNovelHandler to allow auto-enhance feature in Library Settings.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[b57a058] 2026-02-20 feat: Complete modularization of metadata fetching and handler settings
feat: Complete modularization of metadata fetching and handler settings

- Implemented a universal metadata fetching system with three strategies.
- Developed a handler settings validation system for custom library settings.
- Modularized background scripts into dedicated message handlers.
- Created content script modules for improved feature management.
- Updated base handler with new methods for metadata source and settings.
- Enhanced existing handlers with proposed settings and validation.
- Added comprehensive documentation for new systems and architecture.
- Ensured backward compatibility with existing handlers and message structures.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[407e2ea] 2026-02-17 Refactor chunking utility to use simplified emoji regex; enhance debug panel for better tab handling; add new constants for debug output and carousel configuration; improve Drive token management with error handling; update novel library for reading status management and completion marking; refine website handlers for improved parsing and formatting; ensure consistent regex usage across handlers.
Refactor chunking utility to use simplified emoji regex; enhance debug panel for better tab handling; add new constants for debug output and carousel configuration; improve Drive token management with error handling; update novel library for reading status management and completion marking; refine website handlers for improved parsing and formatting; ensure consistent regex usage across handlers.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[fa67c40] 2026-02-15 feat: Enhance site settings and chunking UI
feat: Enhance site settings and chunking UI

- Added a new setting for preferred TLD in site settings UI with options for fanfiction.net and fanfiction.ws.
- Updated the chunk summary UI to include an enhance button with improved styling and hover effects.
- Introduced word count display and threshold warning in chunk UI to inform users of significant changes.
- Enhanced storage manager to normalize URLs for both fanfiction.net and fanfiction.ws.
- Updated base website handler to include default banner visibility setting.
- Improved fanfiction handler to support TLD preference and ensure URL normalization based on user settings.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[d457c15] 2026-02-13 Refactor popup HTML for improved readability and consistency; add enhance button to summary group in chunking UI
Refactor popup HTML for improved readability and consistency; add enhance button to summary group in chunking UI

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[6c18ae0] 2026-02-12 feat: Revamp popup UI with improved tab navigation and notification handling
feat: Revamp popup UI with improved tab navigation and notification handling

- Reorganized popup HTML structure for better user experience.
- Added a dedicated notifications tab with filtering options.
- Enhanced visual elements with emojis for better clarity.
- Updated JavaScript to support new notifications tab and improved tab switching logic.
- Removed deprecated elements and functions related to modal notifications.
- Improved chunk caching logic to include metadata updates.
- Introduced URL normalization for FanFiction.net to redirect to preferred subdomains based on user settings.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[d735d4f] 2026-02-11 feat(chunking): Implement UI components for chunk management and enhance theme detection
feat(chunking): Implement UI components for chunk management and enhance theme detection

- Added chunk-ui.js for creating and managing chunk banners, content containers, and progress indicators.
- Introduced theme-aware color palettes based on dark/light mode detection.
- Updated chunking index to include new UI module.
- Enhanced constants for word-based chunking configuration and summary button frequency.
- Modified base handler and specific website handlers to support dark mode detection.
- Improved metadata extraction and content handling in fanfiction, ranobes, and scribblehub handlers.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[202b9dd] 2026-02-11 feat: update build instructions and add release notes for version 3.9.0
feat: update build instructions and add release notes for version 3.9.0

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[65ef166] 2026-02-10 feat: add randomized novel suggestions feature and improve site settings management
feat: add randomized novel suggestions feature and improve site settings management

- Implemented a new feature to load randomized novel suggestions from enabled sites, enhancing user experience by providing diverse reading options.
- Updated site settings management to use a new key for per-site settings, improving clarity and maintainability.
- Enhanced the novel reading progress update logic to automatically adjust reading status based on chapter progress.
- Refactored the fanfiction handler to support mobile and desktop redirection based on user preferences.
- Improved the Ranobes handler to map system statuses to reading statuses, providing better integration with user bookmarks.
- Made various UI improvements for displaying novel information and suggestions in the popup.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[7f9086a] 2026-02-10 feat: Add Table of Contents to various documentation files for improved navigation
feat: Add Table of Contents to various documentation files for improved navigation

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[2763e35] 2026-02-10 feat: Add visual guide for Library Settings and reorganize Advanced Tab
feat: Add visual guide for Library Settings and reorganize Advanced Tab

- Introduced a comprehensive visual guide for Library Settings, detailing layout, interaction patterns, and accessibility considerations.
- Reorganized the Advanced Tab in popup.html for improved UX, creating 7 distinct sections with clear hierarchy and visual enhancements.
- Redesigned Library Settings modal in library.html with a modern card-based layout and color coding for better usability.
- Established a Button Consistency Guide to ensure uniform behavior across interfaces.
- Implemented a Domain Management system for automatic synchronization of website handlers in browser manifests.
- Fixed critical errors and warnings for Firefox validation, ensuring compatibility and readiness for submission.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[9c541dd] 2026-02-10 feat: Enhance backup functionality and settings management
feat: Enhance backup functionality and settings management

- Added support for comprehensive backup including novel library and settings.
- Updated backup retention and quota management for Google Drive.
- Improved restore functionality to include non-sensitive settings.
- Introduced domain preference handling for Fanfiction site redirection.
- Enhanced mobile handler to fetch desktop metadata and validate content extraction.
- Incremented version for expanded backup format to 2.0.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[596fcbe] 2026-02-10 feat(notification-manager): add grouping for related notifications by novel
feat(notification-manager): add grouping for related notifications by novel

- Enhanced getAll method to support grouping of notifications.
- Implemented groupNotifications method to group related notifications.
- Added isGroupableNotification, extractNovelId, and createNotificationGroup methods for notification handling.

fix(fanfiction-handler): support fanfiction.ws domain and improve redirect handling

- Added support for fanfiction.ws domain in SUPPORTED_DOMAINS.
- Improved redirect logic to handle errors when redirecting from fanfiction.ws.

refactor(fanfiction-mobile-handler): remove redundant initialization logic

- Removed unnecessary initialization logic for mobile handler.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[d96699c] 2026-02-03 feat: update comprehensive backup version and enhance version compatibility checks
feat: update comprehensive backup version and enhance version compatibility checks

- Bump backup version from 2.0 to 3.0.
- Introduce function to retrieve extension version from manifest.
- Modify backup creation options to include credentials by default.
- Implement comprehensive version checking during backup restoration, including warnings for version mismatches and legacy format detection.
- Update constants for comprehensive backup keys to include new settings.
- Refactor log upload function to use existing import instead of dynamic import.
- Add new reading status "up-to-date" for ongoing novels.
- Enhance site settings to include auto-add options for chapters and novels.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[55bf54a] 2026-01-31 feat: enable debug mode by default and update Google Drive OAuth configuration
feat: enable debug mode by default and update Google Drive OAuth configuration

- Set DEFAULT_DEBUG_MODE to true for enhanced debugging during development.
- Removed default Google Drive OAuth client ID and secret; users must configure their own.
- Added expected redirect URIs for OAuth validation.
- Introduced comprehensive backup functionality, allowing users to back up all extension data, including library data, settings, and optional Google Drive credentials.
- Implemented telemetry system for anonymous usage tracking with opt-out capability.
- Added functions for creating, restoring, and managing rolling backups.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[80ad62f] 2026-01-30 v3.7.0 feat: add release notes for version 3.7.0 with Google Drive OAuth enhancements, notification system improvements, and UI fixes
v3.7.0 feat: add release notes for version 3.7.0 with Google Drive OAuth enhancements, notification system improvements, and UI fixes

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[981aed6] 2026-01-30 feat: update manifest files for Chromium and Firefox, add new release binaries
feat: update manifest files for Chromium and Firefox, add new release binaries

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[2797029] 2026-01-30 feat: add progress update prompt for reading chapters
feat: add progress update prompt for reading chapters

- Implemented a progress update prompt that notifies users when their saved progress is behind the current chapter they are reading.
- Introduced a cooldown mechanism to prevent spamming the prompt.
- Enhanced the UI with a banner that allows users to update their progress or ignore the prompt.
- Updated the logic to check and show the prompt based on the current and stored chapter values.

style: add new styles for buttons in fanfiction website

- Added new button styles for secondary, icon, and danger buttons in the fanfiction stylesheet.
- Improved hover effects for better user interaction.

fix: improve novel modal continue and read button logic

- Updated the continue button to use a more comprehensive URL selection logic for better user experience.
- Enhanced the read button to ensure it displays the correct source URL.

chore: refactor Google Drive integration in popup

- Removed deprecated elements related to Google Drive authentication and backup settings.
- Added new UI elements for Google Drive connection, including error handling for authentication issues.
- Updated the logic for connecting to Google Drive, including client ID and secret handling.

refactor: streamline backup mode handling in popup

- Simplified the backup mode selection logic and removed unnecessary event listeners.
- Improved the handling of backup preferences and status updates.

fix: adjust reading status logic in novel library

- Modified the logic for auto-adjusting reading statuses based on the current chapter and last read chapter.
- Ensured that the reading status transitions correctly based on user interactions.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[ca777b3] 2026-01-29 feat: enhance notification system and domain settings management
feat: enhance notification system and domain settings management

- Added logging for notifications in content script with detailed metadata.
- Implemented caching for novel data to improve notification context.
- Introduced domain settings management to enable/disable features per domain.
- Updated site settings utility to handle domain-specific settings.
- Enhanced popup notifications to display additional metadata.
- Improved notification loading and badge updating mechanisms in the popup.
- Added new statistics for single fandom and crossover stories in fanfiction index.
- Refactored notification rendering to include metadata details.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[dd902a7] 2026-01-29 Enhance website handlers for improved navigation and metadata extraction
Enhance website handlers for improved navigation and metadata extraction

- Updated AO3 handler to change definition list label from "Gemini" to "Ranobe Gemini".
- Added initialization logic in Fanfiction handler to redirect bare domain to mobile or desktop versions based on user agent.
- Enhanced Fanfiction handler to exclude user profile pages and improve chapter page detection.
- Improved metadata extraction in Fanfiction handler, including better handling of genres, characters, and relationships.
- Added initialization logic in Fanfiction mobile handler for redirecting to the correct version based on user agent.
- Updated Handler Manager to ensure handlers are initialized only once, preventing duplicate initializations.
- Modified Ranobes handler to correctly identify chapter and novel pages, excluding chapter URLs from being treated as novel pages.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[e153a27] 2026-01-28 feat: add Notification Manager to handle notifications across the extension
feat: add Notification Manager to handle notifications across the extension

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[45c9e94] 2026-01-27 feat: Update author display in novel modals for Ranobes and ScribbleHub
feat: Update author display in novel modals for Ranobes and ScribbleHub

- Changed author display to use links in the modal for both Ranobes and ScribbleHub.
- Enhanced the ScribbleHub novel card to include a detailed modal with improved metadata display.
- Updated the manifest version to 3.7.0 and changed icon paths for consistency.
- Added defaultDebugMode constant to constants.js for configuration.

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[6d3c1ed] 2026-01-27 feat: Add Copilot instructions, enhance build system documentation, and improve notification styles
feat: Add Copilot instructions, enhance build system documentation, and improve notification styles

Signed-off-by: Krishna GSVV <75069043+VKrishna04@users.noreply.github.com>
---
[1e40557] 2025-12-23 feat: Implement platform-specific manifest files for Firefox and Chromium; enhance build process and documentation
feat: Implement platform-specific manifest files for Firefox and Chromium; enhance build process and documentation

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[62b54af] 2025-12-23 v3.6.0 Implement Drive backup with 3-backup retention and continuous rolling file + reorganize docs
v3.6.0 Implement Drive backup with 3-backup retention and continuous rolling file + reorganize docs

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[756bc7f] 2025-12-23 feat: Update theme variables and styles for dark and light modes
feat: Update theme variables and styles for dark and light modes

- Refactored CSS variables for dark mode in shelf-page.css, enhancing color contrast and readability.
- Introduced light mode variables with improved color palette for shelf-page.css.
- Updated JavaScript to apply theme settings from storage and listen for changes in shelf-page.js.
- Adjusted popup styles to align with new theme variables in popup.css.
- Changed icon references in index.html and popup.html to a unified icon.
- Bumped version number in manifest.json to 3.5.0 and updated icon paths.
- Added functionality to auto-adjust stale reading statuses in novel-library.js.
- Enhanced FanFiction handler to conditionally show version switcher on chapter pages.
- Improved Ranobes handler to strip author suffix from titles.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[f70ca4b] 2025-12-18 feat: Enhance metadata extraction across various handlers
feat: Enhance metadata extraction across various handlers

- Added taxonomy definitions for AO3, Fanfiction, Ranobes, and WebNovel handlers to improve filtering capabilities.
- Implemented robust metadata extraction methods in AO3, Fanfiction, Ranobes, ScribbleHub, and WebNovel handlers to capture author, title, genres, tags, status, and description.
- Improved character and relationship extraction logic in Fanfiction handler to better identify and categorize characters.
- Enhanced error handling during metadata extraction to ensure stability and reliability.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[da6a3f8] 2025-12-06 fix: Update paths for icons in index.html and adjust YAML formatting in deploy workflow
fix: Update paths for icons in index.html and adjust YAML formatting in deploy workflow

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[58b29d9] 2025-12-06 Add privacy policy, terms of use, sitemap, and robots.txt; implement browser and site cards in script
Add privacy policy, terms of use, sitemap, and robots.txt; implement browser and site cards in script

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[f8cfd8a] 2025-12-06 feat: Release version 3.3.0 with Google Drive integration and enhanced logging
feat: Release version 3.3.0 with Google Drive integration and enhanced logging

- Added Google Drive OAuth support for log backup and management.
- Implemented persistent logging with IndexedDB for better log handling.
- Introduced keep-alive mechanisms for improved background script reliability.
- Updated keyboard shortcuts for library and enhancement actions.
- Enhanced error handling and user feedback in the popup interface.
- Added new settings for Google Drive client ID and folder ID.
- Refactored background and content scripts for better modularity and maintainability.
- Updated manifest version and permissions for new features.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[e41f19e] 2025-12-05 Refactor website handler logging and improve handler loading mechanism
Refactor website handler logging and improve handler loading mechanism

- Introduced a centralized logging system using debugLog and debugError across all website handlers for consistency and better debugging.
- Updated FanfictionMobileHandler to ensure it runs before desktop handlers by setting a PRIORITY.
- Replaced static handler registration with dynamic loading of handlers from a generated handler registry, allowing for easier addition of new handlers.
- Enhanced error handling during handler loading and improved deduplication of handlers based on constructor names.
- Updated metadata handling in RanobesHandler, ScribbleHubHandler, and WebNovelHandler to include flags for incomplete metadata and detail page requirements.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[0e0a694] 2025-12-05 Add dedicated handlers for ScribbleHub and WebNovel
Add dedicated handlers for ScribbleHub and WebNovel

- Implement ScribbleHubHandler for extracting content and metadata from ScribbleHub novel and chapter pages.
- Support for novel metadata extraction, chapter navigation, and UI control insertion points.
- Enhance WebNovelHandler to improve chapter and novel page detection, metadata extraction, and UI control configuration.
- Update handler types to indicate dedicated page requirements for metadata retrieval.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[a849844] 2025-11-30 feat: Update styling and functionality for library components and improve metadata extraction for Ranobes handler
feat: Update styling and functionality for library components and improve metadata extraction for Ranobes handler

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[39c431d] 2025-11-28 feat: Implement recent novels carousel in library view
feat: Implement recent novels carousel in library view

- Added a carousel section to display recently read novels with controls for navigation.
- Introduced functionality for auto-scrolling and manual navigation of the carousel.
- Enhanced novel metadata extraction for better library management.
- Updated styles for carousel and shelf sections for improved UI/UX.
- Refactored existing code to accommodate new features and improve maintainability.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[e943213] 2025-11-28 Add comprehensive documentation for features and guide for adding new websites
Add comprehensive documentation for features and guide for adding new websites

- Created `README.md` in `docs/features/` detailing major features of the RanobeGemini extension, including Novel Library System, Backup API Keys, Chunking System, Emoji Support, Summary Modes, Progressive Enhancement, and Custom Prompts.
- Added `ADDING_NEW_WEBSITES.md` in `docs/guides/` to provide a step-by-step process for adding support for new novel websites, including handler system architecture, DOM structure analysis, handler implementation, and testing.
- Established `README.md` in `docs/guides/` to organize user guides, planned guides, and contribution guidelines for the RanobeGemini extension.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[f12b0c1] 2025-11-28 feat: Enhance popup functionality with new prompts and backup API key management
feat: Enhance popup functionality with new prompts and backup API key management

- Added new constants for default prompts including short summary prompt and author notes handling.
- Implemented UI elements for managing backup API keys, including adding and removing keys.
- Updated novel library to support custom prompts for individual novels.
- Enhanced fanfiction handler to extract story descriptions and author names more effectively.
- Improved the full prompt preview functionality to include site-specific prompts and better formatting.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[367c433] 2025-11-25 feat: Revamp Novel Library and UI Enhancements
feat: Revamp Novel Library and UI Enhancements

- Updated popup.html to improve the layout and add a compact view for recent novels.
- Introduced a new NovelLibrary class in novel-library.js to manage novels and shelves.
- Added support for novel statistics and recent novels display in the popup.
- Implemented shelf metadata for various website handlers to organize novels by site.
- Enhanced event handling in popup.js for library interactions and novel loading.
- Updated version number to 3.0.0 in popup.html.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[9c48f0f] 2025-11-25 feat: Bump version to 2.9.0 and enhance functionality
feat: Bump version to 2.9.0 and enhance functionality

- Updated package and manifest versions to 2.9.0.
- Added a new mobile handler for FanFiction.net to support mobile-specific content.
- Enhanced the existing FanFiction handler to exclude mobile URLs.
- Improved paragraph extraction and HTML sanitization in content.js.
- Increased max output tokens for summaries to allow more comprehensive results.
- Added a version switcher button for FanFiction.net to toggle between mobile and desktop versions.
- Refactored storage manager to normalize cache keys for mobile and desktop versions.
- Removed deprecated domain entries from manifest.
- Added detailed comments and logging for better debugging and maintenance.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[d246b54] 2025-11-25 feat: Bump version to 2.8.0 and enhance domain handling
feat: Bump version to 2.8.0 and enhance domain handling

- Updated package.json to version 2.8.0 with new scripts and additional files.
- Added new release zip files for version 2.8.0.
- Updated manifest.json for versioning and added strict minimum version for Gecko.
- Refactored domain handling in domain-constants.js to dynamically collect supported domains from website handlers.
- Introduced new website handlers for AO3, Fanfiction, and WebNovel with specific domain management and prompts.
- Enhanced RanobesHandler to include wildcard support for subdomains.
- Implemented WebNovelHandler to manage infinite scroll chapters and dynamic content extraction.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[c55a678] 2025-11-24 feat: Update to version 2.7.1 with enhancements, new features, and improved styling
feat: Update to version 2.7.1 with enhancements, new features, and improved styling

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[d0d69d0] 2025-11-24 feat: Update to version 2.7.0 with new features and improvements
feat: Update to version 2.7.0 with new features and improvements

- Added support for caching enhanced content using a new StorageManager class.
- Implemented caching logic in content.js to check for and load cached enhanced content.
- Introduced a delete button in the enhanced banner to allow users to remove cached content.
- Added a new handler for Archive of Our Own (AO3) to extract content from ao3.org.
- Updated Ranobes handler to support ranobes.top.
- Enhanced UI in popup with improved styles and resizing capabilities.
- Updated package.json and manifest.json to reflect version change to 2.7.0.
- Added recommended VSCode extensions for improved development experience.
- Included binary release for version 2.7.0.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[34ae30a] 2025-11-24 feat: Update model versions and enhance novel loading experience
feat: Update model versions and enhance novel loading experience

- Updated model ID from "gemini-1.5-pro" to "gemini-2.5-flash" in constants.
- Modified popup.js to reflect new model names and options, including error handling for model selection.
- Enhanced novel loading functionality to group novels by domain, providing a clearer organization in the UI.
- Implemented auto-enhance feature for novels, allowing users to toggle enhancement settings.
- Improved content handling in FanfictionHandler to support text-only enhancements while preserving original formatting.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[ef9ec72] 2025-05-25 feat: Add new version 2.5.0 release and enhance content processing
feat: Add new version 2.5.0 release and enhance content processing

- Added RanobeGemini_v2.5.0.zip to releases.
- Improved content chunking logic in background.js for better performance and handling of large chapters.
- Enhanced error handling and retry mechanisms during content processing.
- Updated CSS styles for better mobile responsiveness in content.css.
- Refactored content.js to support work-in-progress and error banners during content enhancement.
- Modified manifest.json to streamline background script loading.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[17646a5] 2025-05-25 feat: Enhance content processing and styling
feat: Enhance content processing and styling

- Added a function to split large content into manageable chunks based on paragraph and sentence boundaries for improved processing.
- Updated the game stats box styling in CSS for better visual presentation.
- Enhanced the content script to sanitize HTML and preserve game stats boxes during content enhancement.
- Modified the popup prompt to include clearer instructions for formatting section headings and game-like status windows.
- Updated constants for the default prompt to reflect new formatting guidelines for RPG-style information.
- Improved the handling of preserved HTML elements to ensure proper restoration after content enhancement.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[1f6feef] 2025-05-23 v2.4.0 Working State - feat: Update DEFAULT_PROMPT to include detailed formatting instructions for game-like status windows
v2.4.0 Working State - feat: Update DEFAULT_PROMPT to include detailed formatting instructions for game-like status windows

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[78e4800] 2025-05-17 chore: changed `simple-popup` to use `popup`
chore: changed `simple-popup` to use `popup`

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[941cf0c] 2025-05-17 feat: Enhance simple-popup.js with advanced settings and chunking options
feat: Enhance simple-popup.js with advanced settings and chunking options

- Added advanced settings for temperature, top-p, top-k, and custom endpoint.
- Implemented chunk size settings with validation and default values.
- Improved UI for advanced settings with toggle functionality.
- Updated prompts to include new formatting instructions.
- Introduced novel loading functionality with improved display and sorting.
- Added utility functions for date formatting and domain checking.

fix: Update constants.js with new default chunk size and rate limit

- Set default chunk size for large chapters to 12000 characters.
- Added rate limit wait time constant for API requests.

feat: Create domain-constants.js for centralized domain handling

- Added lists of known Ranobes and Fanfiction domains.
- Implemented utility functions to check if a hostname belongs to these domains.

refactor: Optimize fanfiction-handler.js with caching mechanism

- Introduced caching for content area to reduce redundant lookups.
- Enhanced version checking to optimize content area retrieval.

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[6975d60] 2025-04-21 chore: Update architecture documentation, changelog, and license; fix icon references in manifest
chore: Update architecture documentation, changelog, and license; fix icon references in manifest

Signed-off-by: VKrishna04 <75069043+VKrishna04@users.noreply.github.com>
---
[132bb95] 2025-04-19 v2.2.0 changed `FireFox` dir to `src` to indicate near future chomium support, added Fanfiction.net Mobile version, Corrected the summary colour scheme.
v2.2.0 changed `FireFox` dir to `src` to indicate near future chomium support, added Fanfiction.net Mobile version, Corrected the summary colour scheme.

Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
---
[53c7573] 2025-04-15 chore: Update changelog for version 2.1.0 and modify manifest and constants for improved functionality
chore: Update changelog for version 2.1.0 and modify manifest and constants for improved functionality

Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
---
[66a3d65] 2025-04-15 chore: Remove deprecated files and update manifest with additional icon sizes
chore: Remove deprecated files and update manifest with additional icon sizes

Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
---
[a805948] 2025-04-14 feat: Add content utility functions for HTML processing and text formatting
feat: Add content utility functions for HTML processing and text formatting

feat: Implement base website content handler for generic content extraction

feat: Create fanfiction handler for extracting content from fanfiction.net

feat: Develop handler manager to dynamically load website-specific handlers

feat: Add ranobes handler for extracting content from ranobes.top

chore: Package extension files into v2.1.0.zip for release

docs: Add Apache License 2.0 to the project

docs: Update README with new features, installation instructions, and usage guidelines
Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
---
[9798e98] 2025-04-10 Remove sensitive API key from environment configuration files
Remove sensitive API key from environment configuration files

Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
---
[2a9b04e] 2025-04-10 Refactor Ranobe Gemini extension: - Removed constants.js file and integrated prompts directly into simple-popup.js and utils/constants.js. - Added chapter summarization feature and permanent prompts for consistent formatting. - Enhanced FAQ section in simple-popup.html with interactive elements. - Updated welcome page to streamline API key setup process. - Improved README with new features and usage instructions. - Deleted unused welcome.html and welcome.js files.
Refactor Ranobe Gemini extension:
- Removed constants.js file and integrated prompts directly into simple-popup.js and utils/constants.js.
- Added chapter summarization feature and permanent prompts for consistent formatting.
- Enhanced FAQ section in simple-popup.html with interactive elements.
- Updated welcome page to streamline API key setup process.
- Improved README with new features and usage instructions.
- Deleted unused welcome.html and welcome.js files.

Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
---
[25b6b9a] 2025-04-06 v1.1.0 Extension completed till certain level need to migrate to manifest v3
v1.1.0 Extension completed till certain level need to migrate to manifest v3

Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
---
[5a50e90] 2025-04-04 v1.0.0 - Rename extension from Ranobe Novel Enhancer to Ranobe Gemini and update related assets and is a MVP
v1.0.0 - Rename extension from Ranobe Novel Enhancer to Ranobe Gemini and update related assets and is a MVP

Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
---
[7aa279c] 2025-04-03 v1.0.0 for Firefox version MVP it works!
v1.0.0 for Firefox version MVP it works!

Signed-off-by: VKrishna04 <krishnagsvv@gmail.com>
---
sd