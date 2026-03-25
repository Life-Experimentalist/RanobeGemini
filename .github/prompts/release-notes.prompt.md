# Release Notes Authoring Prompt (Ranobe Gemini)

Use this prompt whenever preparing a new release in this repository.

## Goal

Write release notes with BOTH:

1. A full detailed section (long form), and
2. A short summary section at the bottom.

Follow the same style as docs/release/RELEASE_NOTES_4.5.0.md and docs/release/RELEASE_NOTES_4.6.0.md.

## Required Inputs

- Version (example: 4.7.0)
- Release date
- Branch
- Stability status
- Main features/changes/fixes
- Validation steps run (lint/build/package/test)
- Docs updated

## Required Output Structure

1. Title with version
2. Metadata: release date, branch, status
3. Overview
4. Major Features
5. Flow Snapshots (Mermaid, vertical orientation only)
6. Stability Fixes and Technical Improvements
7. Upgrade Notes
8. Documentation Updated
9. Support
10. Divider line
11. Quick Release Notes section (short version)

## Formatting Rules

- Use clear headings and concise bullets.
- Include file paths for major code/doc changes when useful.
- Keep Mermaid diagrams vertical only: graph TD, graph TB, or stateDiagram-v2 with direction TB.
- For every Mermaid diagram included or edited, add a Diagram elements list directly under it.
- Ensure the quick section is a true summary and not a copy of the long section.

## Versioning and File Rules

- Update docs/release/RELEASE*NOTES*<VERSION>.md.
- Update docs/release/CHANGELOG.md with matching version entry.
- Keep README feature highlights aligned when release includes user-visible features.

### Docs Automation

- After generating release notes, run the docs version sync script to keep version-sensitive docs consistent:

```bash
npm run docs:update-versions
```

- The script updates common files that contain hard-coded versions/dates, such as:
    - docs/overview/Roadmap.md
    - docs/overview/VISUAL_JOURNEY.md
    - docs/development/TODO.md
    - docs/architecture/COLLAPSIBLE_JOURNEY.md
    - any `**Last updated:**` or `Last updated:` lines in `docs/`

- Ensure you commit the updated docs alongside the release notes.

## Release Readiness Checklist (must include)

- Lint status
- Build status
- Packaging status (firefox/chromium/source)
- Any known caveats

## Output Quality Bar

- Should be publish-ready without extra rewriting.
- Should be understandable to both users and contributors.
- Should clearly separate feature highlights, fixes, and operational release readiness.
