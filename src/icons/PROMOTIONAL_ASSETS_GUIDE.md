# Mozilla Add-ons Submission Assets Guide

## Overview
This guide documents all required promotional assets for Mozilla Add-ons (AMO) Firefox extension submission for **Ranobe Gemini**.

---

## 1. Small Promotional Tile
**File**: `promotional-tile-440x280.html`
**Dimensions**: 440 × 280 pixels
**Format**: HTML (render to PNG for submission)
**Purpose**: Featured placement on AMO store
**Specifications**:
- Clean, dark theme matching brand
- Logo image (light variant)
- Brand name + tagline
- Feature badges (AI Enhancement, Summaries, Library)

**Export Instructions**:
1. Open `promotional-tile-440x280.html` in browser
2. Take screenshot at exact 440×280px
3. Export as PNG
4. Upload to AMO

---

## 2. Large Promotional Tile
**File**: `promotional-tile-1400x560.html`
**Dimensions**: 1400 × 560 pixels
**Format**: HTML (render to PNG for submission)
**Purpose**: Featured placement on AMO homepage
**Specifications**:
- Larger layout with more breathing room
- Logo image (light variant)
- Full feature description
- Call-to-action buttons (visual only)
- 4 feature badges

**Export Instructions**:
1. Open `promotional-tile-1400x560.html` in browser
2. Take screenshot at exact 1400×560px
3. Export as PNG
4. Upload to AMO

---

## 3. Screenshots Gallery
**File**: `screenshots-gallery.html`
**Dimensions**:
- Primary: 1280 × 800 pixels
- Secondary: 640 × 400 pixels (responsive)

**Format**: HTML with 4 showcase screenshots
**Purpose**: Show extension features to users
**Included Screenshots**:

### Screenshot 1: Main Interface
- Shows core features in grid layout
- Enhancement, Summaries, Library, Settings sections
- Call-to-action buttons
- **Size**: 1280×800px

### Screenshot 2: Features Overview
- AI Enhancement
- Fast Summaries
- Unified Library
- Privacy First
- **Size**: 1280×800px

### Screenshot 3: Supported Sites
- Ranobes support
- FanFiction.net support
- Archive of Our Own (AO3)
- ScribbleHub support
- **Size**: 1280×800px

### Screenshot 4: Configuration & Settings
- API Configuration
- Model Selection
- Custom Prompts
- Advanced Options
- **Size**: 1280×800px

**Export Instructions**:
1. Open `screenshots-gallery.html` in browser
2. For each screenshot section, take individual 1280×800px captures
3. Export each as PNG
4. For mobile variants, scale down to 640×400px
5. Upload up to 6 images to AMO (max 6 allowed)

---

## 4. YouTube Video URL
**Status**: Optional but recommended
**Where**: Link to demo/tutorial video
**Requirements**: Valid YouTube URL
**Suggestions**:
- Create a 1-2 minute demo showing:
  - Installation process
  - Using Enhance feature
  - Using Summarize feature
  - Library management
  - Settings configuration

---

## 5. Search Terms
**Limit**: Up to 7 terms
**Character Limit**: 30 characters per term
**Word Limit**: Max 21 separate words across all terms

**Recommended Search Terms**:
1. `web novel extension` (18 chars)
2. `AI text enhancement` (19 chars)
3. `chapter summarizer` (17 chars)
4. `fanfiction reader` (16 chars)
5. `translation polish` (17 chars)
6. `Gemini API tools` (15 chars)
7. `reading companion` (16 chars)

**Total Words**: 20 (within 21-word limit)

---

## File Structure
```
src/icons/
├── promotional-tile-440x280.html       # Small tile (440×280px)
├── promotional-tile-1400x560.html      # Large tile (1400×560px)
├── screenshots-gallery.html             # 4 screenshots (1280×800px each)
├── logo-256.png                   # Logo asset (referenced in tiles)
└── [exported PNGs]                      # After rendering HTML files
```

---

## Submission Checklist

- [ ] Small Promotional Tile (440×280px PNG)
- [ ] Large Promotional Tile (1400×560px PNG)
- [ ] Screenshot 1: Main Interface (1280×800px PNG)
- [ ] Screenshot 2: Features Overview (1280×800px PNG)
- [ ] Screenshot 3: Supported Sites (1280×800px PNG)
- [ ] Screenshot 4: Configuration (1280×800px PNG)
- [ ] YouTube Video URL (optional)
- [ ] Search Terms (7 terms, ≤21 words total)
- [ ] Extension Description (from README)
- [ ] Privacy Policy Link
- [ ] Source Code (in releases folder)

---

## Notes for Reviewers

### Design System
All promotional assets use the Ranobe Gemini brand palette:
- **Primary Gradient**: Orange (#f4a261) to Teal (#2dd4bf)
- **Background**: Dark blue (#050b14 to #0b1628)
- **Text**: Light gray (#e8eef7)
- **Accents**: Orange (#ffb86c)

### Asset Generation
1. HTML files are self-contained and can be rendered to PNG via:
   - Browser DevTools screenshot (recommended)
   - Headless Chrome/Puppeteer
   - Online HTML-to-PNG converters

2. For precise sizing:
   - Set browser window to exact dimensions
   - Disable scrollbars
   - Take full page screenshot
   - Crop to specified dimensions

### Logo References
- All tiles reference `logo-256.png` from the icons directory
- Light variant ensures visibility on dark background
- Alternative: Use `logo-256.png` for light backgrounds

---

## Contact & Support
For questions about these assets or submission process, refer to:
- [Mozilla Add-ons Developer Hub](https://addons.mozilla.org/en-US/developers/)
- [AMO Policy & Guidelines](https://extensionworkshop.com/documentation/publish/add-on-policies/)
- Project Repository: https://github.com/Life-Experimentalists/RanobeGemini
