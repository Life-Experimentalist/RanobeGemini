# Contributing to Ranobe Gemini

First off, thank you for considering contributing to Ranobe Gemini! It's people like you that make this extension better for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [github@vkrishna04.me](mailto:github@vkrishna04.me).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as many details as possible.
* **Provide specific examples to demonstrate the steps**.
* **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
* **Explain which behavior you expected to see instead and why.**
* **Include screenshots or animated GIFs** if possible.
* **Include your Firefox version and extension version**.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title** for the issue to identify the suggestion.
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
* **Provide specific examples to demonstrate the steps** or provide mockups.
* **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
* **Explain why this enhancement would be useful** to most Ranobe Gemini users.

### Adding New Website Support

We welcome additions of new website support! Please refer to our [Adding New Websites Guide](docs/guides/ADDING_NEW_WEBSITES.md) for detailed instructions. In summary:

1. Create a new handler class extending `BaseWebsiteHandler`
2. Add the handler to `domain-constants.js`
3. Test thoroughly on the target website
4. Update documentation

### Pull Requests

1. **Fork the repository** and create your branch from `main`.
2. **Follow the coding style** of the project (JavaScript ES6+, proper JSDoc comments).
3. **Test your changes** thoroughly:
   - Load the extension in Firefox
   - Test on relevant websites
   - Verify no console errors
4. **Update documentation** if needed (README.md, docs/, etc.).
5. **Run `npm run update-domains`** if you modified handler domains.
6. **Create a pull request** with a clear title and description.

### Development Setup

```powershell
# Clone your fork
git clone https://github.com/YOUR_USERNAME/RanobeGemini.git
cd RanobeGemini

# Install dependencies
npm install

# Start watch mode for development
npm run watch

# Load in Firefox
# Navigate to about:debugging#/runtime/this-firefox
# Click "Load Temporary Add-on..." and select src/manifest.json
```

## Project Structure

```
RanobesGemini/
├── src/
│   ├── background/        # Background scripts
│   ├── content/          # Content scripts
│   ├── popup/            # Extension popup UI
│   ├── utils/            # Utility modules
│   │   └── website-handlers/  # Site-specific handlers
│   ├── config/           # Configuration
│   ├── manifest-firefox.json    # Firefox manifest (edit this, not dist/)
│   └── manifest-chromium.json   # Chromium/Edge manifest
├── dev/                  # Build scripts
├── docs/                 # Documentation
├── tests/                # node --test suites and HTML fixtures
├── dist/                 # Build output (gitignored)
└── releases/             # Packaged zips (gitignored; published as Release assets)
```

## Coding Guidelines

### JavaScript Style

- Use ES6+ features (const/let, arrow functions, async/await)
- Use JSDoc comments for functions and classes
- Keep functions small and focused
- Use descriptive variable names
- Handle errors gracefully with try-catch

### Website Handlers

When creating new handlers:

- Extend `BaseWebsiteHandler`
- Implement required methods (`canHandle`, `findContentArea`, etc.)
- Add static `SUPPORTED_DOMAINS` and `DEFAULT_SITE_PROMPT`
- Test with multiple chapters and edge cases
- Handle dynamic content (infinite scroll, lazy loading, etc.)

### Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit first line to 72 characters
- Reference issues and pull requests when relevant

Example:
```
Add WebNovel.com support with infinite scroll

- Create WebNovelHandler extending BaseWebsiteHandler
- Implement per-chapter button injection
- Handle dynamic chapter loading with MutationObserver
- Add comprehensive tests for infinite scroll

Fixes #123
```

## Testing Checklist

Before submitting a PR, verify:

- [ ] Extension loads without errors in Firefox
- [ ] All buttons appear correctly on target websites
- [ ] Enhancement works properly
- [ ] Summarization works properly
- [ ] Restore original works
- [ ] No console errors or warnings
- [ ] Works on both desktop and mobile versions of websites
- [ ] Dark mode displays correctly
- [ ] Settings save and load properly
- [ ] Large chapters are handled correctly

## Release Process

Releases are managed by project maintainers:

1. Update the version in `package.json`. That is the only place it lives — the
   build stamps it into both manifests, so do not edit `src/manifest-firefox.json`
   or `src/manifest-chromium.json` by hand.
2. Move the "Unreleased" section of `docs/release/CHANGELOG.md` under the new
   version, and write `docs/release/RELEASE_NOTES_<version>.md` (long-form note
   plus a short quick-summary in the same file).
3. Run `npm run publish` — writes the commit history, builds and zips both
   store packages, and builds the AMO source archive.
4. Push the `vX.Y.Z` tag. `.github/workflows/publish-addons.yml` takes it from
   there: it runs the CI gate, rebuilds the packages, submits them to AMO and
   the Chrome Web Store, and attaches the zips to the GitHub Release.

**Where the zips live.** `releases/` is a local build output and is gitignored —
the zips are *not* committed. Every published build is a GitHub Release asset,
which is outside git object storage, has a stable public download URL, and never
expires. Nothing about a release requires a commit containing a binary.

To back-fill assets for older versions still sitting in a local `releases/`
folder, `npm run release:archive` prints the plan and changes nothing. Add
`-- --yes` to actually create the tags and releases — that is public and
irreversible, so read the plan first.

## Questions?

Feel free to:
- Open an issue with the `question` label
- Contact the maintainer at github@vkrishna04.me
- Check existing issues and documentation

## Recognition

Contributors will be recognized in:
- GitHub contributors page
- Release notes (for significant contributions)
- README.md (for major features)

Thank you for contributing to Ranobe Gemini! 🎉
