# Changelog

All notable changes to the Ranobe Gemini extension will be documented in this file.

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

## [1.0.0] - 2023-06-15

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
