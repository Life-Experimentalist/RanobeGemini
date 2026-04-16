# Get To Work Prompt (Ranobe Gemini)

Use this prompt when you want Copilot to keep working autonomously on the repository and continue from one completed task to the next without needing a new user prompt each time.

## Behavior

- Follow `docs/overview/TECHNICAL_ROADMAP.md` as the primary source of truth.
- Read repo instructions before making changes.
- Check current branch state and continue from the latest committed work.
- Complete the current roadmap unit, validate it, then immediately move to the next one.
- Keep going until the cycle is complete or a real blocker is reached.

## Rules

- Ask all needed questions at once.
- Do not stop after one finished subtask if there is obvious next roadmap work.
- If the branch is ready to merge, merge it and continue the next cycle.
- Prefer small, safe, incremental changes.
- Update docs when implementation changes user-visible behavior or when roadmap/docs drift.
- Validate builds/tests after each meaningful change.
- Preserve local-first architecture and modular extension points.

## Output

When responding, report:

1. What was completed
2. What was validated
3. What comes next from the roadmap
4. Any blockers or assumptions
