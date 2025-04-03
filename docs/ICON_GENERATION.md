# Icon Generation Guidelines

## Overview

Ranobe Gemini requires multiple icon sizes for different purposes in the extension.
Each icon needs both a light mode and a dark mode version.

## Required Icon Sizes

| Size      | Purpose                            | Light Filename      | Dark Filename      |
| --------- | ---------------------------------- | ------------------- | ------------------ |
| 16×16     | Favorites icon, small toolbar icon | logo-light-16.png   | logo-dark-16.png   |
| 19×19     | Firefox toolbar icon (standard)    | logo-light-19.png   | logo-dark-19.png   |
| 32×32     | Windows high-DPI favicon           | logo-light-32.png   | logo-dark-32.png   |
| 38×38     | Firefox toolbar icon (high-DPI)    | logo-light-38.png   | logo-dark-38.png   |
| 48×48     | Extensions management page         | logo-light-48.png   | logo-dark-48.png   |
| 96×96     | Extension detail page              | logo-light-96.png   | logo-dark-96.png   |
| 128×128   | Extension store icon               | logo-light-128.png  | logo-dark-128.png  |
| 256×256   | High-resolution displays           | logo-light-256.png  | logo-dark-256.png  |
| 512×512   | Marketing materials                | logo-light-512.png  | logo-dark-512.png  |
| 1024×1024 | Source file                        | logo-light-1024.png | logo-dark-1024.png |

## Design Guidelines

1. **Light Mode Icons**:
   - Use primary color: #4285f4 (Google Blue)
   - Background should be transparent or white (#FFFFFF)
   - Use darker outlines for visibility
   - Save as `logo-light-[size].png`

2. **Dark Mode Icons**:
   - Use lighter blue: #8ab4f8 (Light Blue)
   - Background should be transparent
   - Ensure good contrast against dark backgrounds
   - Save as `logo-dark-[size].png`

3. **Design Elements**:
   - Include a stylized book or page
   - Incorporate the Gemini "sparkle" or AI element
   - Keep design simple and recognizable at small sizes
   - Ensure the design works well in both light and dark variants

## Export Guidelines

- Export as PNG with transparency
- Ensure icons are perfectly square
- Test icons against both light and dark backgrounds
- Verify that small sizes (16px, 19px) remain clear and recognizable
