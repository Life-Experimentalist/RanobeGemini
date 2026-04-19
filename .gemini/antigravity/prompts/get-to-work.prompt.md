# Get To Work Prompt (Ranobe Gemini)

Use this prompt when you want the AI to enter a highly autonomous, recursive execution loop. The AI will continue from one roadmap task to the next without waiting for individual prompts, optimizing for speed, token conservation, and non-destructive progress.

## Source of Truth

- **Primary:** docs/overview/TECHNICAL_ROADMAP.md
- **Secondary:** .github/copilot-instructions.md and package.json

## Use When

- **When to Use `get-to-work`**: When you want continuous, highly autonomous, multi-phase loops of implementation with high token expenditure. Use this for tackling large portions of the roadmap automatically.
- **When to Use `roadmap-continue-autonomous`**: When you want an agent to read the roadmap and perform a tighter, single-phase loop or pick up from a paused state.
- **When to Use `roadmap-implementation`**: When you want highly controlled, single-task execution with manual review boundaries.
- **Graphify Reporting:** Whenever you add or change files/functions, you must run `npm run docs:graphify` to continuously sync `graphify-out/GRAPH_REPORT.md` so it accurately maps your changes.

## Autonomous Execution Loop

1. **Version Control (Branching):** If you are starting a new Phase or Unit, create a new branch (e.g., `git checkout -b feature/phase-2-unit-3`).
2. **Analyze:** Read `TECHNICAL_ROADMAP.md`. Identify the current active Phase and Unit.
3. **Implement (Batch & Balance):** Execute cohesive, logical chunks of work. Group related small fixes and tasks together to minimize total turn count and conserve tokens. Balance speed and comprehensive progress with safety. Avoid overly fragmented micro-commits if they can be safely clustered.
4. **Commit Progress:** Use standard git commands to commit your work as it stabilizes (`git add .` and `git commit -m "feat/fix: ..."`).
5. **Validate (Mandatory):** Run `npm run lint` and `npm run build` (or relevant dev scripts). Automatically fix any newly introduced errors. Do not stop until validation passes.
6. **Document & Journal:** Sync `docs/overview/TECHNICAL_ROADMAP.md` as soon as a unit is completed. You MUST update the roadmap tracker statuses to `Done` AND append a brief 1-2 sentence explanation of what was achieved so a history is preserved. Continuously clear out/update legacy trackers like `docs/development/TODO.md` and `src/TODO.md`.
7. **Graphify Sync:** Run `npm run docs:graphify` to dynamically regenerate `graphify-out/GRAPH_REPORT.md` so that the topology map reflects your latest codebase additions. Include these graph updates in your commits.
8. **Version Bump:** If a major Phase is completed, bump the package version according to semver and prepare for the next phase.
9. **Recurse:** Once validated, committed, and complete, immediately begin the next roadmap unit.

## Rules of Engagement

- **Token Efficiency:** Get the work done as fast and properly as possible. Combine steps where it makes sense over being overly cautious with tiny edits.
- **Fail-Fast:** If a genuine blocker occurs (e.g., missing credentials, complex architectural ambiguity), document the blocker clearly and pivot to the next unblocked roadmap item.
- **Non-Destructive:** Maintain backwards compatibility. Do not break existing local-first behavior. Ensure existing plugins/handlers remain functional.
- **Ask Once:** If user input is absolutely necessary, batch all questions into a single request.

## Output Format

At the end of a major cycle or when forced to pause, output:

1. **Completed:** [List of Phase-Units finished and batched]
2. **Validated:** [Proof of lint/build success]
3. **Graphify Sync:** [Proof that `npm run docs:graphify` has rebuilt the graph]
4. **Next Up:** [Immediate next steps queued]
5. **Blockers/Assumptions:** [Any required user decisions]
