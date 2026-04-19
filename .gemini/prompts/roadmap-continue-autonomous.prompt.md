# Roadmap Continue Autonomous Prompt (Ranobe Gemini)

Use this prompt to resume autonomous roadmap execution. It enforces continuous, non-destructive progress that heavily optimizes for prompt and token conservation.

## Directives

- **Target:** `docs/overview/TECHNICAL_ROADMAP.md`
- **Active Batches:** Read the Rolling Prompt Tracker. Identify the current Phase-Unit that is in-progress. If not already on an isolated branch, create one (`git checkout -b feature/phase-unit`).
- **Maximize Trajectory:** Group small, related tasks and complete solid functional blocks in a single pass to save tokens and avoid excessive back-and-forth. Balance velocity with stability.
- **Commit Continually:** Run `git add` and `git commit` as sub-units stabilize.
- **Validation-Driven:** Every code modification MUST be followed by `npm run lint` and `npm run build`. You must autonomously fix any linting or build errors you introduce before proceeding.
- **Continuous Momentum:** Do not ask for permission to proceed. If the batched unit passes validation, immediately begin executing the next part of the roadmap.
- **Journaling & Graphify Check:** When completing a unit, mark it as `Done` in `TECHNICAL_ROADMAP.md` along with a very brief sentence explaining what was done. Also refresh `graphify-out/GRAPH_REPORT.md` by directly executing `npm run docs:graphify` before closing the cycle to reflect real-world code architecture. Update any outdated lists like `TODO.md` accordingly.

## Strict Guidelines

- **Backwards Compatibility:** Any new modularization (especially out of content.js) must preserve exact existing behavior and feature flags.
- **Safe but Fast Iteration:** You are trusted to do comprehensive functional chunks. Aim for speed and accuracy without introducing breaking rewrites.
- **Zero-Drift Documentation**: Update architecture and landing docs in the same cycle if a feature changes. **You MUST mark tasks in `docs/overview/TECHNICAL_ROADMAP.md` as Done immediately.** Never alter historical RELEASE_NOTES\*.md files.
- **Graphify Reporting**: Whenever you add or change files/functions, you must run `npm run docs:graphify` to continuously sync `graphify-out/GRAPH_REPORT.md` so it accurately maps your changes.
- **Tracker Hygiene:** Update docs/overview/TECHNICAL_ROADMAP.md after each validated prompt cycle so the rolling tracker stays current.

## Output Reporting

When pausing is unavoidable or a cycle completes:

1. **Units Cleared:** [List of batched roadmap units completed]
2. **Validation State:** [Lint/Build status]
3. **Active/Next Unit:** [What is currently being worked on]
