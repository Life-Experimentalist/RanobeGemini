# Release Notes Authoring Prompt (Ranobe Gemini)

Use this prompt to prepare a comprehensive, publish-ready release package for the Ranobe Gemini repository based on the docs/overview/TECHNICAL_ROADMAP.md completed sections.

## Objective

Generate release notes that are identical in structure to v4.5.0/v4.6.0, cleanly separating user-facing highlights from technical refactors.

## Formatting Rules

- **Two Sections:** A long-form detailed body and a short-form quick summary at the bottom.
- **Visuals First:** Use vertically oriented Mermaid diagrams (graph TD / stateDiagram-v2) and follow every diagram with a bulleted 'Diagram elements' summary.
- **Accurate Paths:** Include paths for major files edited without hallucinating structure.

## Versioning & Docs Routine

1. **Source of Truth:** Read package.json for the official version string.
2. **Selective Update:** Only update version-sensitive tracking docs (e.g., Roadmap.md, TODO.md, VISUAL_JOURNEY.md) IF they disagree with the package.json version.
3. **Immutable History:** Never edit or overwrite historical release docs (e.g., RELEASE*NOTES*<old_version>.md, commit-history.md).
4. **Validation Checklist:** State the
   pm run lint and
   pm run build successes as proof of release stability.
5. **Structural Audit:** If the release includes significant modularization or architecture reshaping, cross-check graphify-out/GRAPH_REPORT.md before writing the architecture section.

## Required Output

- Title, Metadata (Version, Date, Stability)
- Overview & Major Features
- Architecture Changes (Flow Snapshots / Mermaid)
- Fixes, Performance, Extensibility Notes
- Validation & Support Details
- [Divider]
- High-level Quick Summary
