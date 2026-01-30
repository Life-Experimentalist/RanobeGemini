# Changelog

> **Index:**

- [Changelog](#changelog)
	- [3.7.0 - 2026-01-30](#370---2026-01-30)
		- [🔧 Google Drive OAuth Enhancements \& UI Improvements](#-google-drive-oauth-enhancements--ui-improvements)
		- [Added](#added)
			- [☁️ Google Drive OAuth Improvements](#️-google-drive-oauth-improvements)
			- [📢 Enhanced Notification System](#-enhanced-notification-system)
			- [🎯 Domain-Specific Settings](#-domain-specific-settings)
			- [📖 Reading Progress Tracking](#-reading-progress-tracking)
		- [Changed](#changed)
			- [🖥️ Popup UI Refactoring](#️-popup-ui-refactoring)
			- [🌐 Website Handler Improvements](#-website-handler-improvements)
			- [📚 Library Enhancements](#-library-enhancements)
			- [🏗️ Build System \& Documentation](#️-build-system--documentation)
		- [Fixed](#fixed)
			- [🐛 Bug Fixes](#-bug-fixes)
			- [🔧 Google Drive OAuth](#-google-drive-oauth)
		- [Developer Experience](#developer-experience)
			- [🛠️ Code Quality](#️-code-quality)
		- [Technical Details](#technical-details)
			- [Google Drive OAuth Flow](#google-drive-oauth-flow)
			- [Popup Initialization Fix](#popup-initialization-fix)
		- [Migration Notes](#migration-notes)
		- [Known Issues](#known-issues)
	- [\[3.5.0\] - 2025-12-20](#350---2025-12-20)
		- [🎨 Shelf Pages, Analytics \& UX Improvements](#-shelf-pages-analytics--ux-improvements)
		- [Added](#added-1)
			- [📊 Website Shelf Pages](#-website-shelf-pages)
			- [🎨 Popup Modal Improvements](#-popup-modal-improvements)
			- [🏗️ Keep-Alive Architecture Documentation](#️-keep-alive-architecture-documentation)
		- [Changed](#changed-1)
		- [Fixed](#fixed-1)
		- [Documentation](#documentation)
	- [\[3.0.0\] - 2025-11-28](#300---2025-11-28)
		- [🎉 Major Release: Novel Library System](#-major-release-novel-library-system)
		- [Added](#added-2)
			- [📚 Novel Library System](#-novel-library-system)
			- [🔧 Dynamic Shelf System](#-dynamic-shelf-system)
			- [🎨 UI Enhancements](#-ui-enhancements)
			- [📖 Metadata Extraction](#-metadata-extraction)
			- [📝 Documentation Overhaul](#-documentation-overhaul)
		- [Changed](#changed-2)
			- [🏗️ Architecture Improvements](#️-architecture-improvements)
			- [📚 Documentation](#-documentation)
		- [Fixed](#fixed-2)
		- [Developer Experience](#developer-experience-1)
			- [Adding New Website Support (Simplified)](#adding-new-website-support-simplified)
			- [Build Scripts](#build-scripts)
		- [Technical Details](#technical-details-1)
			- [Novel Library Schema](#novel-library-schema)
			- [Shelf Metadata Schema](#shelf-metadata-schema)
		- [Migration Notes](#migration-notes-1)
	- [\[2.9.0\] - 2025-11-25](#290---2025-11-25)
		- [Summary](#summary)
		- [Added](#added-3)
		- [Changed](#changed-3)
		- [Fixed](#fixed-3)
	- [\[2.8.0\] - 2025-11-25](#280---2025-11-25)
		- [Summary](#summary-1)
		- [Added](#added-4)
		- [Changed](#changed-4)
		- [Fixed](#fixed-4)
		- [Developer Experience](#developer-experience-2)
		- [Migration Notes](#migration-notes-2)
		- [Known Issues](#known-issues-1)
	- [\[2.2.1\] - 2025-04-26](#221---2025-04-26)
		- [Summary](#summary-2)
		- [Added](#added-5)
		- [Changed](#changed-5)
		- [Fixed](#fixed-5)
	- [\[2.2.0\] - 2025-04-19](#220---2025-04-19)
		- [Summary](#summary-3)
		- [Added](#added-6)
		- [Changed](#changed-6)
		- [Fixed](#fixed-6)
	- [\[2.1.0\] - 2025-04-15](#210---2025-04-15)
		- [Summary](#summary-4)
		- [Added](#added-7)
		- [Changed](#changed-7)
		- [Fixed](#fixed-7)
	- [\[2.0.0\] - 2025-04-13](#200---2025-04-13)
		- [Summary](#summary-5)
		- [Added](#added-8)
		- [Changed](#changed-8)
		- [Fixed](#fixed-8)
	- [\[1.1.0\] - 2025-04-10](#110---2025-04-10)
		- [Added](#added-9)
		- [Changed](#changed-9)
		- [Fixed](#fixed-9)
	- [\[1.0.0\] - 2025-06-15](#100---2025-06-15)
		- [Added](#added-10)
		- [Fixed](#fixed-10)


All notable changes to the RanobeGemini extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.7.0](RELEASE_NOTES_3.7.0.md) - 2026-01-30

### 🔧 Google Drive OAuth Enhancements & UI Improvements

Version 3.7.0 introduces support for Web Application OAuth credentials, major popup UI fixes, enhanced notification system, and improved website handler logic.

### Added

#### ☁️ Google Drive OAuth Improvements
- **Client Secret Support**: Added support for "Web application" type OAuth credentials
  - New `driveClientSecret` field in popup Advanced settings
  - Automatic inclusion of client secret in OAuth token exchanges and refresh flows
  - Backwards compatible with "Chrome Extension" type credentials (no secret required)
  - Allows users to use existing Google Cloud projects with web credentials

#### 📢 Enhanced Notification System
- **Notification Manager**: Centralized notification handling across the extension
  - Added logging for all notifications with detailed metadata
  - Implemented novel data caching to improve notification context
  - Enhanced popup notification display with metadata details
  - Improved notification badge updating mechanisms
  - Added notification history clearing functionality

#### 🎯 Domain-Specific Settings
- **Site Settings Management**: Per-domain feature toggles
  - Enable/disable features on specific domains
  - Domain-level configuration for auto-enhancement and other features
  - Improved granular control over extension behavior

#### 📖 Reading Progress Tracking
- **Progress Update Prompts**: Smart chapter progress detection
  - Notifies users when saved progress is behind current reading chapter
  - Cooldown mechanism to prevent spam prompts
  - Banner UI for updating progress or dismissing notifications
  - Automatic status transitions based on chapter progress

### Changed

#### 🖥️ Popup UI Refactoring
- **Major Popup Fixes**:
  - Fixed popup initialization race condition (DOMContentLoaded vs document.readyState)
  - Fixed tab switching mechanism (now properly activates content)
  - Removed legacy Google Drive backup UI elements
  - Cleaned up backup mode handling and event listeners
  - Added defensive guards for missing DOM elements
  - Improved settings loading and display logic

- **Google Drive Settings UI**:
  - Moved Drive backup controls to Advanced tab
  - Added connection status indicators (🟢 Connected, 🔴 Auth failed, ⚫ Disconnected)
  - Improved error message display for authentication issues
  - Added Client Secret input field with helpful descriptions
  - Reorganized Drive settings into collapsible "Advanced setup" section

#### 🌐 Website Handler Improvements
- **AO3 Handler**: Changed enhancement label from "Gemini" to "Ranobe Gemini"

- **Fanfiction Handler**:
  - Added automatic redirection from bare domain to mobile/desktop based on user agent
  - Improved chapter page detection by excluding user profile pages (`/u/`)
  - Enhanced metadata extraction for genres, characters, and relationships
  - Better handling of story descriptions and author names

- **Fanfiction Mobile Handler**:
  - Added initialization redirect logic for bare domain visits

- **Ranobes Handler**:
  - Fixed chapter vs novel page detection
  - Excluded chapter index URLs (`/chapters/{id}`) from being treated as novel pages
  - Improved title extraction (strips author suffix)
  - Enhanced metadata extraction

- **ScribbleHub Handler**:
  - Updated novel modal to display author as clickable link
  - Improved metadata display in detailed modal

- **Handler Manager**:
  - Ensured handlers are initialized only once
  - Prevented duplicate initializations
  - Added static `initialize()` support for handlers

#### 📚 Library Enhancements
- **Novel Modal Improvements**:
  - Enhanced "Continue Reading" button with comprehensive URL selection logic
  - Improved "Read" button to display correct source URLs
  - Better handling of author links in modals

- **Auto-Status Updates**:
  - Modified reading status auto-adjustment based on current chapter
  - Improved status transitions (Reading → Plan to Read, etc.)
  - Enhanced last read chapter tracking

#### 🏗️ Build System & Documentation
- **Build Process**:
  - Split manifest files into `manifest-firefox.json` and `manifest-chromium.json`
  - Enhanced build script for platform-specific packaging
  - Updated icon paths for consistency across all files

- **Documentation**:
  - Added comprehensive Copilot instructions (`.github/copilot-instructions.md`)
  - Enhanced build system documentation
  - Improved domain management guides

### Fixed

#### 🐛 Bug Fixes
- **Popup Initialization**: Fixed critical race condition where `DOMContentLoaded` fired before listener attachment
- **Tab Switching**: Fixed broken tab navigation in popup
- **Drive UI**: Removed references to deleted backup mode variables (`backupModeScheduled`, `backupModeContinuous`)
- **Settings Loading**: Fixed empty fields in popup after page load
- **API Key Saving**: Restored proper API key persistence
- **Prompt Loading**: Fixed prompts not pre-filling in popup

#### 🔧 Google Drive OAuth
- **Token Exchange**: Added client secret support to fix "400 client_secret is missing" errors
- **Token Refresh**: Updated refresh flow to include client secret when required
- **Error Handling**: Improved error messages for OAuth failures

### Developer Experience

#### 🛠️ Code Quality
- **Logging Improvements**: Centralized logging system using `debugLog` and `debugError` across all handlers
- **Handler Registry**: Dynamic handler loading from generated registry
- **Deduplication**: Better handler deduplication based on constructor names
- **Type Safety**: Improved metadata handling flags (`metadataIncomplete`, `requiresDetailPage`)

### Technical Details

#### Google Drive OAuth Flow
```javascript
// New flow supports both Chrome Extension and Web Application credentials
const params = {
  client_id: clientId,
  // ... other params
};
if (clientSecret) {
  params.client_secret = clientSecret; // Only for Web App type
}
```

#### Popup Initialization Fix
```javascript
// Before: Race condition
document.addEventListener("DOMContentLoaded", async () => { ... });

// After: Reliable startup
const startPopup = async () => { ... };
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startPopup);
} else {
  startPopup();
}
```

### Migration Notes
- Users with existing Drive connections may need to reconnect if using Web Application credentials
- No action required for Chrome Extension type credentials
- Local backups continue to work without any changes
- All existing settings and library data are preserved

### Known Issues
- Web Application OAuth credentials expose client secret in extension storage (consider using Chrome Extension type for public distribution)
- Extension ID must be hardcoded in Google Cloud Console for proper OAuth redirect handling

---

## [3.5.0] - 2025-12-20

### 🎨 Shelf Pages, Analytics & UX Improvements

Version 3.5.0 introduces dedicated website shelf pages with advanced filtering, comprehensive analytics, and significant UX improvements across the library system.

### Added

#### 📊 Website Shelf Pages
- **AO3 Shelf Page**: Complete filtering system
  - Browse by Fandom: Clickable fandom cards (top 20 by work count) with auto-filtering
  - Multi-select filters: Fandoms, Relationships, Characters, Additional Tags (NO selection limits)
  - Dynamic filters: Rating, Category, Warnings, Language, Completion Status, Pairing Type, Relationships Type
  - Advanced search: Title, author, description with case-insensitive matching
  - Sorting: Recent visit, date added, total words, kudos, hits, bookmarks, comments
  - **6 Analytics Insights**: Total Works, Enhanced Chapters, Total Words, Average Rating, Reading Progress, Most Kudos, Newest Addition, Most Chapters
  - **Removed AO3 Restrictions**: No longer limits fandoms/characters selection (restrictions were FanFiction.net only)

- **FanFiction.net Shelf Page**: Enhanced filtering
  - Dynamic filters: Genre, language, rating, completion status, crossover filter
  - Character/fandom filters: MAX 2 fandoms, MAX 4 characters (site-specific rules)
  - Advanced search: Title, author, description
  - Sorting: Recent visit, date added, words, favorites, follows, reviews
  - **6 Analytics Insights**: Total Stories, Enhanced Chapters, Total Words, Average Favorites, Reading Progress, Most Favorited, Newest Addition, Most Chapters

- **Ranobes Shelf Page**: Genre-focused filtering
  - Dynamic filters: Genres, tags, language, COO status, translation status
  - Advanced search: Title, author, description
  - Sorting: Recent visit, date added, total words, rating, chapters, views
  - **6 Analytics Insights**: Total Novels, Enhanced Chapters, Total Words, Average Rating, Reading Progress, Most Chapters, Newest Addition, Highest Rated

#### 🎨 Popup Modal Improvements
- **2-Column Layout**: Novel card modal expanded from 1-column to responsive 2-column grid
- **Total Words Stat**: Fixed calculation to sum `novel.metadata.words` across all novels
- **Better Readability**: Increased spacing, improved typography, better visual hierarchy

#### 🏗️ Keep-Alive Architecture Documentation
- **Three-Layer System**: Comprehensive documentation of extension persistence mechanisms
  - **Offscreen Document** (`offscreen.js`): 20s postMessage heartbeat to service worker
  - **Background Alarms** (`background.js`): 30s alarm API + port listener for content scripts
  - **Content Script Port** (`content.js`): Long-lived port connection with 20s heartbeat pings
- **New File**: `docs/architecture/KEEP_ALIVE.md` with full implementation details, timing rationale, debugging tips

### Changed

- **AO3 Selection Limits Removed**: Eliminated `MAX_FANDOMS=2` and `MAX_CHARACTERS=4` constants (these were FanFiction.net restrictions incorrectly applied to AO3)
- **Improved Card Visuals**: Added `cursor: pointer` to Ranobes novel cards for better UX
- **Enhanced Logging**: Ranobes shelf page now logs detailed debugging info (novel count, sources, visibility states)

### Fixed

- **View on Site Button**: Verified correct behavior - button already uses `sourceUrl` to link to main novel details page (not current reading chapter) across all library pages
- **Ranobes Visibility**: Added comprehensive console logging to debug novel grid display issues

### Documentation

- **CHANGELOG.md**: Added v3.5.0 entry with all new features
- **ARCHITECTURE.md**:
  - Added keep-alive system section with mermaid diagram
  - Added `offscreen.js` to background script components
  - Added cross-reference to `KEEP_ALIVE.md`
- **KEEP_ALIVE.md**: New comprehensive guide covering:
  - Three-layer architecture with code samples
  - Timing considerations and browser differences
  - Lifecycle management and debugging tips
  - Common issues and troubleshooting

---

## [3.0.0] - 2025-11-28

### 🎉 Major Release: Novel Library System

Version 3.0.0 introduces the comprehensive Novel Library system - a complete solution for organizing, tracking, and managing your reading across all supported websites. This release also includes extensive documentation improvements and enhanced metadata extraction.

### Added

#### 📚 Novel Library System
- **Full Library Page**: Dedicated library interface accessible via extension menu
  - Grid-based layout with novel cards
  - Search functionality (title, author, description)
  - Filter by shelf (website), status, rating
  - Sort by recent visit, date added, or enhanced chapters
  - Stats display (total novels, enhanced chapters, active shelves)

- **Automatic Organization**:
  - Novels automatically added to library on first enhancement
  - Organized into shelves by website (FanFiction.net, Ranobes, AO3, WebNovel)
  - Mobile and desktop variants share same novel entries
  - Novel ID extraction from URL patterns

- **Novel Management**:
  - Edit metadata: title, author, cover URL, description
  - Update status (reading, completed, on-hold, plan-to-read, dropped)
  - Add genres/tags
  - Set custom per-novel enhancement prompts
  - Add personal notes
  - Track reading progress (chapters enhanced, last visited)

- **Import/Export**:
  - Export entire library as JSON with timestamp
  - Import with merge or replace modes
  - Detailed import results (new, updated, errors)
  - Backup and restore functionality

#### 🔧 Dynamic Shelf System
- **Handler-Based Shelves**:
  - Shelves auto-generated from handler `SHELF_METADATA`
  - Adding new website automatically creates library shelf
  - No manual shelf configuration needed
  - Each shelf has: id, name, icon, color, novelIdPattern, primaryDomain

- **Shelf Registry**:
  - Centralized `SHELF_REGISTRY` in domain-constants.js
  - Dynamically builds `SHELVES` constant
  - Extensible for new website handlers

#### 🎨 UI Enhancements
- **Popup Improvements**:
  - New "Novels" tab with library preview
  - Shows 5 most recently visited novels
  - Library statistics overview
  - "Open Full Library" quick access button

- **Context Menu**:
  - Right-click extension icon for quick actions
  - "Open Novel Library" shortcut
  - "Settings" quick access

#### 📖 Metadata Extraction
- **FanFiction.net Enhanced Extraction**:
  - `extractDescription()`: Extracts story summary from #profile_top
  - `extractAuthor()`: Gets author name and profile link
  - `extractNovelMetadata()`: Returns complete metadata object
  - Cover image URL extraction

- **Improved Title Extraction**:
  - Better desktop/mobile detection
  - Fallback selectors for edge cases

#### 📝 Documentation Overhaul
- **Reorganized Structure**:
  - `docs/architecture/` - Technical architecture docs
  - `docs/features/` - Feature-specific documentation
  - `docs/guides/` - User and contributor guides
  - `docs/development/` - Development workflows

- **New Documentation**:
  - Comprehensive ARCHITECTURE.md with diagrams and component tables
  - Gateway README.md in each subdirectory
  - Updated main docs/README.md as documentation hub
  - Consistent formatting with index placeholders

- **Architecture Documentation**:
  - System architecture with Mermaid diagrams
  - Detailed component breakdowns with tables
  - Content processing pipeline sequences
  - Storage schema documentation
  - API integration architecture
  - Novel library system design
  - Feature architecture (chunking, emoji, backup keys)

### Changed

#### 🏗️ Architecture Improvements
- **Handler System**:
  - All handlers now include static `SHELF_METADATA`
  - Improved domain pattern matching
  - Better separation of concerns

- **Storage**:
  - Library stored in `rg_novel_library` key
  - Novel objects keyed as `[shelfId]_[novelId]`
  - Metadata includes timestamps for sorting

- **Import System**:
  - Changed from replace to merge by default
  - Added mode selection (merge/replace)
  - Better conflict resolution
  - Detailed import reporting

#### 📚 Documentation
- **Naming Convention**: UPPERCASE.md for major docs
- **Structure**: Index placeholders, version metadata, navigation links
- **Diagrams**: All diagrams include detailed component tables below
- **Consistency**: Unified formatting across all documentation

### Fixed

- **Short Summary Handler**: Added missing `shortSummarizeWithGemini` handlers in background.js
- **FanFiction Description**: Fixed extraction for desktop version
- **In-Progress Banner**: Corrected positioning and removal logic
- **Long Enhancement**: Fixed "not working" issue with proper action handling

### Developer Experience

#### Adding New Website Support (Simplified)
1. Create handler in `src/utils/website-handlers/[site]-handler.js`
2. Extend `BaseWebsiteHandler`
3. Add static `SHELF_METADATA` property:
   ```javascript
   static SHELF_METADATA = {
     id: "mysite",
     name: "MySite",
     icon: "📚",
     color: "#4a90e2",
     novelIdPattern: /mysite\.com\/novel\/(\d+)/,
     primaryDomain: "mysite.com"
   };
   ```
4. Implement required methods
5. Import in `handler-manager.js`
6. Export metadata in `domain-constants.js`
7. Run `npm run update-domains`
8. Shelf automatically appears in library!

#### Build Scripts
- `npm run watch` - Watch mode for development
- `npm run build` - Production build
- `npm run package:firefox` - Create .xpi package
- `npm run package:source` - Create source archive
- `npm run update-domains` - Update manifest domains

### Technical Details

#### Novel Library Schema
```javascript
{
  "id": "shelf_novelId",
  "shelfId": "fanfiction",
  "novelId": "12025721",
  "title": "Story Title",
  "author": "Author Name",
  "url": "https://...",
  "description": "Story description...",
  "coverUrl": "https://.../cover.jpg",
  "status": "reading|completed|on-hold|plan-to-read|dropped",
  "genres": ["Genre1", "Genre2"],
  "rating": "K|K+|T|M|MA",
  "addedDate": "2025-11-28T...",
  "lastVisited": "2025-11-28T...",
  "chaptersEnhanced": 5,
  "totalChapters": 20,
  "customPrompt": "Custom instructions...",
  "notes": "Personal notes..."
}
```

#### Shelf Metadata Schema
```javascript
{
  id: "unique-id",
  name: "Display Name",
  icon: "📚",
  color: "#hexcolor",
  novelIdPattern: /regex/,
  primaryDomain: "example.com"
}
```

### Migration Notes

Users upgrading from v2.x to v3.0.0:
- Novel library is new - no migration needed
- All previous settings preserved
- Previously enhanced chapters not automatically added to library
- Re-enhance any chapter to add its novel to library

---

## [2.9.0] - 2025-11-25

### Summary
Version 2.9.0 is a maintenance release that prepares the architecture for the Novel Library feature. It adds mobile FanFiction.net support and improves the handler registration system.

### Added
- **FanFiction Mobile Handler**:
  - Full support for m.fanfiction.net mobile site
  - Shares novel entries with desktop FanFiction.net
  - Optimized selectors for mobile layout

- **Handler System Improvements**:
  - FanfictionMobileHandler properly registered in domain-constants.js
  - Handler manager checks mobile handler before desktop handler
  - Better logging for handler selection

### Changed
- **Domain Constants**:
  - Added FanfictionMobileHandler import
  - Handler classes array now includes all handlers
  - Improved wildcard domain expansion

### Fixed
- Mobile FanFiction.net pages now properly detected
- Handler selection order ensures mobile handlers take priority

---

## [2.8.0] - 2025-11-25

### Summary
Version 2.8.0 is a major architectural update introducing multi-site support, dynamic domain management, and comprehensive documentation improvements. This release adds support for Archive of Our Own (AO3) and WebNovel.com with infinite scroll handling, while implementing a future-proof domain system that eliminates manual maintenance across multiple files.

### Added
- **New Website Support**:
  - Archive of Our Own (AO3) - archiveofourown.org and ao3.org domains
  - WebNovel.com - with infinite scroll chapter support and per-chapter button injection
- **Dynamic Domain Management System**:
  - Automatic domain collection from handler static properties
  - Wildcard domain support (*.domain.com) for subdomain handling
  - Automated manifest.json generation via `npm run update-domains`
  - Single source of truth for domains in handler files
- **Documentation**:
  - Comprehensive Mermaid diagrams in all documentation files
  - Detailed component tables for every diagram
  - GitHub community files (CODE_OF_CONDUCT.md, CONTRIBUTING.md)
  - Issue templates (bug report, feature request, website support)
  - Pull request template with detailed checklist
  - FUNDING.yml for sponsor support
  - DYNAMIC_DOMAINS.md explaining the new domain system
- **Build System**:
  - Automated domain update script runs before packaging
  - Firefox Add-on badges on README (version, users, downloads, rating)
  - Theme-aware logo support for light/dark mode
  - Validation fixes documentation (VALIDATION_FIXES.md)

### Changed
- **Architecture**:
  - Handler classes now export static SUPPORTED_DOMAINS and DEFAULT_SITE_PROMPT
  - Handlers support both explicit domains and wildcard patterns for edge cases
  - Manifest patterns generated automatically from handler domains
  - Reduced from 20+ explicit domains to 15 explicit + 13 wildcards
- **WebNovel Handler**:
  - Per-chapter button injection instead of page-level
  - MutationObserver for dynamic chapter loading
  - Custom events for chapter-specific enhancement/summarization
  - ProcessedChapters Set to prevent duplicate button injection
- **Word Counting**:
  - Optimized AO3 word count to use direct string operations
  - Removed redundant DOM element creation for counting
  - Improved performance with textContent.trim().split() method
- **README**:
  - Updated installation instructions prioritizing Firefox Add-ons store
  - Added note about GitHub releases having latest version
  - Compact badge layout (2 rows instead of 10)
  - Updated supported websites list
  - Fixed repository URLs to use Life-Experimentalist organization

### Fixed
- **AO3 Handler**:
  - Word count bug - now counts plain text instead of HTML content
  - Content extraction reliability improvements
- **Manifest Validation**:
  - Invalid match patterns (130 errors) - wildcards now properly converted
  - Added browser_specific_settings.gecko.strict_min_version (Firefox 109.0+)
  - All match patterns follow valid format: *://*.domain.com/*
- **Package.json**:
  - Fixed circular reference in package script
  - Corrected repository URLs
  - Fixed build script execution order

### Developer Experience
- **New Commands**:
  - `npm run update-domains` - Regenerate manifest from handler domains
  - Automatic domain update on `npm run package`
- **Handler Development**:
  - Base handler template with required methods clearly documented
  - Handler Manager automatically registers new handlers
  - Domain constants dynamically collected at runtime
  - No more manual manifest.json editing for new sites
- **Testing**:
  - Improved error messages and debug logging
  - Better console output for domain detection
  - Validation checklist in documentation

### Migration Notes
- Old domain constants (RANOBES_DOMAINS, etc.) still exported for backward compatibility
- Legacy arrays now automatically generated from handlers via expandWildcards()
- No breaking changes to existing handler interfaces

### Known Issues
- 35 AMO validation warnings about innerHTML usage (expected for AI content rendering)
- 3 warnings about dynamic imports (expected for handler module loading)
- These warnings are safe and necessary for extension functionality

## [2.2.1] - 2025-04-26

### Summary
Version 2.2.1 addresses the domain transition from ranobes.top to ranobes.net, ensuring continued compatibility while maintaining support for all known Ranobes domains. This update clarifies domain documentation and improves site selectors to work reliably across all supported domains.

### Added
- Enhanced domain handling to prioritize ranobes.net as the primary domain
- Improved debugging information for domain detection
- Expanded domain compatibility verification for all known Ranobes domains

### Changed
- Updated documentation to reference ranobes.net as the primary domain instead of ranobes.top
- Refactored content selectors for better cross-domain compatibility
- Enhanced domain detection logic for more reliable site recognition

### Fixed
- Selector issues affecting content identification on some Ranobes domains
- Documentation references to deprecated domain names
- UI references to specific domains in the interface

---

## [2.2.0] - 2025-04-19

### Summary
Version 2.2.0 delivers a significant user experience upgrade focusing on improved theme integration, responsive design, and streamlined API key handling. This update ensures the extension works seamlessly across both desktop and mobile devices while maintaining visual consistency with website themes and popular browser extensions like Dark Reader.

### Added
- Comprehensive theme integration for summary windows with automatic light/dark mode detection
- Fully responsive design with optimized layouts for both mobile and desktop devices
- Intelligent device type detection for automatic UI adjustment
- Enhanced Dark Reader extension compatibility with proper variable handling
- Better integration with various site-specific dark mode implementations
- Memory-efficient content processing for improved performance on mobile devices

### Changed
- Completely redesigned summary display area to match site theming
- Improved mobile experience with touch-optimized controls and spacing
- Enhanced UI layout with better element positioning on smaller screens
- Unified API key handling between enhance and summarize functions
- Simplified user feedback for API key configuration
- Improved error messaging with clearer instructions

### Fixed
- Summary window theming inconsistencies between dark and light modes
- API key handling discrepancies between summarize and enhance features
- UI rendering issues on mobile devices with various screen sizes
- Theme compatibility issues with Dark Reader and other dark mode extensions
- Visual glitches when transitioning between light and dark modes
- Contrast issues with text on certain background colors

---

## [2.1.0] - 2025-04-15

### Summary
Version 2.1.0 brings significant improvements to the summary feature, handling of large chapters, and overall stability. The update introduces a separate model selection for summaries, advanced configurations for managing timeouts, and better content processing for different length chapters.

### Added
- Separate model selection for summaries independent from enhancement model
- Improved summary generation with higher token limits for more detailed summaries
- Enhanced large chapter handling with better chunking and token management
- Advanced timeout settings to configure request timeouts and prevent connection failures
- Cleaner summary formatting with improved text formatting and paragraph handling
- Better error handling with more informative error messages
- Configuration centralization with all model constants moved to a central file

### Changed
- Increased maximum token limits for summaries from 512 to 2048 tokens
- Implemented proportional token allocation for summaries based on chapter size
- Enhanced console logging for debugging prompt and model usage
- Improved emotion detection and contextual emoji placement
- Completely refactored background script for better stability
- Implemented chunking system to process large chapters in parts
- Enhanced markdown to HTML conversion for better formatting
- Added automatic token limit detection for different models

### Fixed
- Connection timeout issues with large chapters (10k+ words)
- Paragraph and section break handling in summary display
- Error recovery when processing extremely large contents

---

## [2.0.0] - 2025-04-13

### Summary
Version 2.0.0 is a major update that introduces a completely redesigned interface, support for Gemini 2.0 models, and a new chapter summarization feature. This release focuses on improved model selection, better handling of novel translation, and enhanced site compatibility.

### Added
- Support for Gemini 2.0 Flash and Gemini 2.0 Pro models
- New chapter summarization feature to generate concise chapter summaries
- Redesigned UI with cleaner interface and basic/advanced tab separation
- Model selection dropdown to easily switch between different Gemini models
- Emotion processing with enhanced display of emotional context using emoji indicators
- Increased site compatibility with better content extraction
- Custom prompt templates for both enhancement and summarization

### Changed
- Completely refactored background script for better stability
- Implemented chunking system to process large chapters in parts
- Enhanced markdown to HTML conversion for better formatting
- Added automatic token limit detection for different models

### Fixed
- Stability issues with large chapters
- Content extraction on dynamically loaded pages
- API error handling and user feedback
- Compatibility with the latest browser versions

---

## [1.1.0] - 2025-04-10

### Added
- Chapter summarization feature with customizable prompt
- Permanent prompt option that applies to all requests
- Added spacing between summary and chapter content
- Better support for Gemini 2.0 models
- Refined settings UI for easier configuration

### Changed
- Focused on ranobes.top as the primary supported site
- Updated default prompts for better outputs
- Improved error handling for large content
- Enhanced dark mode support in the popup interface

### Fixed
- Properly handle HTML formatting in outputs
- Fixed content extraction on dynamically loaded pages
- Improved token count estimation
- Addressed compatibility issues with Firefox 120+

---

## [1.0.0] - 2025-06-15

### Added
- Initial release
- Support for ranobes.top, wuxiaworld.com, and webnovel.com
- One-click enhancement with Gemini AI
- Options page to configure API key and prompts
- Ability to restore original content
- Debug mode for troubleshooting

### Fixed
- Content detection on dynamically loaded pages
- API error handling for invalid keys
