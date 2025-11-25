# Changelog

All notable changes to the Ranobe Gemini extension will be documented in this file.

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
