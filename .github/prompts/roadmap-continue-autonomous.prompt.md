# Roadmap Continue Autonomous Prompt (Ranobe Gemini)

Use this prompt when you want Copilot to continue implementation work in this repository without re-prompting after every subtask.

## Purpose

Continue roadmap-driven work until the current cycle is complete or a genuine blocker is reached.

## Source of Truth

- Follow `docs/overview/TECHNICAL_ROADMAP.md` first.
- Then follow repo instructions, especially:
  - `.github/copilot-instructions.md`
  - `docs/development/README.md`
  - `docs/guides/PLUGIN_HANDLER_PUBLISHING.md`
  - `docs/guides/ADDING_NEW_WEBSITES.md`
- Treat `package.json` as the version source of truth.
- Respect the current branch state and only merge when the cycle is actually complete.

## Autonomous Work Loop

1. Read the roadmap and identify the next concrete unit or subtask.
2. Check what is already implemented before editing anything.
3. Make the smallest useful change set for that unit.
4. Validate the change with build/lint/tests as applicable.
5. Update docs only when the implementation changes user-visible behavior or the roadmap/docs are out of sync.
6. If the unit is finished, immediately continue with the next roadmap unit or subtask.
7. Repeat until:
   - the requested branch of work is complete,
   - the next step is blocked by a real dependency, or
   - a user decision is genuinely required.

## Question Policy

- If questions are needed, ask them all at once.
- Do not ask one question at a time unless the answer to the first question determines the rest.
- If work can proceed safely with a reasonable assumption, proceed and note the assumption.

## Merge and Continuation Rules

- If the current branch is complete and clean, merge it back to `main` when appropriate.
- After merging, start the next roadmap cycle without waiting for a new prompt if the roadmap already identifies the next unit.
- Do not stop after a successful build if there is clear next work in the roadmap.
- Do not rewrite unrelated completed work just to keep moving.

## Implementation Rules

- Prefer phase-scoped, incremental changes over broad rewrites.
- Keep `src/content/content.js` modularization moving first when it is still a hotspot.
- Keep extensions, handlers, providers, and storage adapters modular and plugin-friendly.
- Keep local-first behavior intact.
- Preserve existing user-facing behavior unless the roadmap explicitly requires a change.
- Use feature flags, settings toggles, or adapter boundaries when adding experimental integrations.

## Validation Rules

- Run build/package/lint/tests that match the change.
- Fix newly introduced errors before moving on.
- If a build fails because of an environment issue, record the blocker and continue with other safe roadmap work if possible.

## Documentation Rules

- Update all relevant docs in the same change when a user-visible feature changes.
- Keep release notes historical files untouched unless explicitly requested.
- Keep roadmap and TODO files synchronized with actual implementation status.

## Output Expectations

When responding, give:

1. What was completed in this cycle
2. What was validated
3. What remains next in the roadmap
4. Any blockers or assumptions

## Operating Style

- Continue proactively.
- Prefer action over discussion.
- Re-check the roadmap after each completed unit.
- Keep going until the current cycle is genuinely done.
