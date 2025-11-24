# Pull Request

## Description
<!-- Provide a brief description of your changes -->

## Type of Change
<!-- Mark the relevant option with an [x] -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Website support addition
- [ ] Performance improvement
- [ ] Code refactoring

## Related Issue
<!-- Link to the issue this PR addresses -->
Fixes #(issue number)

## Changes Made
<!-- List the main changes in bullet points -->
-
-
-

## Testing Performed
<!-- Describe the testing you've done -->

### Test Environment
- **Firefox Version**:
- **OS**:
- **Extension Version**:

### Test Cases
<!-- Check all that apply -->
- [ ] Extension loads without errors
- [ ] Buttons appear correctly
- [ ] Enhancement functionality works
- [ ] Summarization functionality works
- [ ] Restore original works
- [ ] No console errors
- [ ] Dark mode displays correctly
- [ ] Mobile version works (if applicable)
- [ ] Settings save/load properly

### Websites Tested
<!-- List the websites you tested on -->
- [ ] ranobes.net
- [ ] fanfiction.net
- [ ] archiveofourown.org
- [ ] webnovel.com
- [ ] Other: ___________

## Screenshots
<!-- If applicable, add screenshots showing your changes -->

### Before
<!-- Screenshot of the behavior before your changes -->

### After
<!-- Screenshot of the behavior after your changes -->

## Checklist
<!-- Mark completed items with an [x] -->

- [ ] My code follows the project's coding style
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have updated the documentation accordingly
- [ ] My changes generate no new warnings or errors
- [ ] I have run `npm run update-domains` if I modified handler domains
- [ ] I have tested my changes in Firefox
- [ ] I have checked for console errors

## For Website Support PRs
<!-- Only fill out if adding new website support -->

- [ ] Created new handler extending `BaseWebsiteHandler`
- [ ] Added `SUPPORTED_DOMAINS` and `DEFAULT_SITE_PROMPT` static properties
- [ ] Registered handler in `domain-constants.js`
- [ ] Tested on multiple chapters
- [ ] Tested dynamic content loading (if applicable)
- [ ] Added documentation in handler file
- [ ] Updated `README.md` if needed

## Additional Notes
<!-- Any additional information that reviewers should know -->

## Breaking Changes
<!-- If this PR includes breaking changes, describe them here -->

## Performance Impact
<!-- Describe any performance implications of your changes -->

---

By submitting this pull request, I confirm that my contribution is made under the terms of the Apache 2.0 license.
