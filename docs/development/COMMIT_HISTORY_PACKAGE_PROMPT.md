# Commit History Package Prompt

Use this prompt when you want an AI agent to build or extend reusable commit-history tooling for both npm and uv ecosystems.

## Prompt

Create production-ready commit-history tooling in two package forms:

1. An npm CLI package named `@life-experimentalist/commit-history-cli` that works with `npx`.
2. A Python package named `commit-history-uv` that works with `uv run`, `uvx`, or direct Python execution.

### Core goal

Both packages must generate readable commit-history reports from the current git repository, with first-class support for release workflows, agent consumption, CI logs, MCP-friendly JSON, and optional charts that are disabled by default.

### Functional requirements

1. The CLIs must work cross-platform on Windows, macOS, and Linux.
2. Do not use shell-only tools such as `grep`, `sed`, `awk`, Bash redirection tricks, or Unix-only pipelines.
3. Use runtime-native subprocess calls to `git` so the tools work from PowerShell, npm scripts, uv scripts, CI jobs, and agents.
4. Support at least these flags:
   - `--all`
   - `--versions`
   - `--output <path>`
   - `--format <text|markdown|json>`
   - `--ci-summary`
   - `--with-charts`
   - `--mcp-output`
   - `--body-lines <n>`
   - `--max-files <n>`
   - `--manifest-path <path>` repeatable
   - `--package-path <path>`
   - `--since <git-date>`
   - `--until <git-date>`
   - `--limit <n>`
   - `--log-level <silent|info|debug>`
   - `--no-merges`
5. Each commit entry should include:
   - short hash
   - date
   - subject
   - trimmed body preview
   - changed-files summary
   - package metadata when available
   - manifest versions when available
6. The tools should provide optional chart data and optional ASCII charts when requested, but never by default.
7. The tools should support MCP-friendly JSON payloads so they can plug into agents or MCP servers later.
8. Missing files in older commits must be handled gracefully.

### Runtime-selection requirements

1. Include a small runtime-selection helper or example wrapper.
2. If both npm and uv tools are available, choose the runtime intelligently:
   - prefer npm/Node when the target repo is primarily JavaScript or TypeScript
   - prefer uv/Python when the target repo is primarily Python
   - allow an explicit override
3. Document the runtime-selection rules clearly.

### Package requirements

1. Include complete metadata for both packages.
2. Include package-level `.gitignore` files so they can be moved into separate repos later without cleanup work.
3. Include tests for both implementations.
4. Include detailed READMEs with:
   - local install instructions
   - `npx` / `uvx` examples
   - option reference
   - CI/CD examples
   - MCP/agent usage examples
   - chart examples
5. Keep the implementation modular so core parsing/formatting logic is separated from thin CLI wrappers.

### Integration requirements

1. Show how to integrate the Node CLI into an npm `publish` flow so commit history is refreshed before packaging.
2. Show how to integrate the Python CLI into a uv-based release workflow.
3. Include examples for GitHub Actions or similar CI usage.
4. Keep logging and JSON output suitable for automation.

### Quality bar

1. Keep the code readable and maintainable.
2. Prefer pure functions for parsing and formatting.
3. Avoid unnecessary dependencies.
4. Preserve ASCII-only source unless there is a strong reason not to.
5. Add brief comments only where the logic is not obvious.

### Deliverables

1. npm CLI package source
2. uv/Python package source
3. tests for both
4. README/docs for both
5. runtime-selection helper/example
6. CI/CD integration examples
7. a short explanation of the design tradeoffs and why the implementation is cross-platform and automation-friendly
