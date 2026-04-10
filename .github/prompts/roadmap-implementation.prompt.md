# Roadmap Implementation Prompt (Ranobe Gemini)

Use this prompt when implementing roadmap work in this repository.

## Source of Truth

- Follow `docs/overview/TECHNICAL_ROADMAP.md` as the authoritative technical roadmap.
- Implement only the requested roadmap phase/sub-scope.

## Execution Rules

1. Confirm current phase and acceptance criteria from `docs/overview/TECHNICAL_ROADMAP.md`.
2. Start with a current-state check: identify what is already done and what still remains.
3. Propose a minimal change set only for remaining gaps in that phase.
4. Implement code changes with no unrelated refactors.
5. Prioritize modularization of active bottlenecks (especially `src/content/content.js`) over reworking already-completed migrations.
6. Run validation steps (build/test/lint as applicable).
7. Update docs touched by implementation.
8. Report what was intentionally not changed.

## Documentation Rules

- Do not use global replacement scripts for version updates.
- Update version-sensitive docs only if mismatched to `package.json` version.
- Keep contributor docs practical for handler/provider/plugin authoring and publishing.
- Do not edit historical release files unless explicitly asked:
    - `docs/release/RELEASE_NOTES_*.md`
    - `docs/release/commit-history.md`

## Architecture Rules

- Preserve local-first design (no mandatory backend dependency).
- Assume user-owned API keys/cloud credentials and optional anonymized telemetry with explicit consent on first library open.
- Use `src/utils/constants.js` as global default configuration source of truth.
- Keep AI integration provider-modular through adapters (do not hard-wire core flow to one provider).
- Keep build-time secret injection via `.env`/build pipeline, never by hardcoding source secrets.

## Required Output

1. Scope completed (phase/sub-scope)
2. Files changed and why
3. Validation results
4. Risks / follow-up tasks

## Done Criteria

- Acceptance criteria for the selected phase are met.
- No unrelated files were modified.
- Build and runtime behavior remain stable.
