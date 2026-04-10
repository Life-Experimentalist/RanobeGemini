# Roadmap Implementation Prompt (Ranobe Gemini)

Use this prompt when implementing roadmap work in this repository.

## Source of Truth

- Follow `docs/overview/TECHNICAL_ROADMAP.md` as the authoritative technical roadmap.
- Implement only the requested roadmap phase/sub-scope.

## Execution Rules

1. Confirm current phase and acceptance criteria from `docs/overview/TECHNICAL_ROADMAP.md`.
2. Propose a minimal change set for that phase only.
3. Implement code changes with no unrelated refactors.
4. Run validation steps (build/test/lint as applicable).
5. Update docs touched by implementation.
6. Report what was intentionally not changed.

## Documentation Rules

- Do not use global replacement scripts for version updates.
- Update version-sensitive docs only if mismatched to `package.json` version.
- Do not edit historical release files unless explicitly asked:
  - `docs/release/RELEASE_NOTES_*.md`
  - `docs/release/commit-history.md`

## Required Output

1. Scope completed (phase/sub-scope)
2. Files changed and why
3. Validation results
4. Risks / follow-up tasks

## Done Criteria

- Acceptance criteria for the selected phase are met.
- No unrelated files were modified.
- Build and runtime behavior remain stable.
