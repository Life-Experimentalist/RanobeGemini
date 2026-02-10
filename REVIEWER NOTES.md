## BUILD INSTRUCTIONS

### Prerequisites

- Node.js (v14 or higher)
- npm

### Build Steps

1. Install dependencies:
   npm install

2. Generate final package:
   npm run package

### This will

- Run generate-manifest-domains.js to update manifest.json with handler domains
- Create releases/RanobeGemini_vX.X.X.zip from src/ directory

### Build Scripts

- dev/generate-manifest-domains.js - Extracts domains from handler files, generates manifest.json match patterns
- dev/package-firefox.js - Creates zip archive of src/ directory
- dev/build.js - Updates manifest version from package.json
- dev/watch.js - Development file watcher (not used for production builds)

The final extension is built from the src/ directory with no minification or obfuscation.
All source code is included in its original, readable form.
