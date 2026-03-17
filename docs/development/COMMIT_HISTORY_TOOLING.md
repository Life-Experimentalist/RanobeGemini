# Commit History Tooling

This repo now includes two reusable commit-history packages that are structured to be split into their own repositories without carrying Ranobe Gemini-specific implementation details.

## Packages

- `packages/commit-history-cli` — npm / `npx` package
- `packages/commit-history-uv` — Python / `uv` package

Both support:

- full or version-only commit views
- text, markdown, and JSON output
- optional CI summary
- optional charts
- MCP-friendly JSON output
- configurable manifest and package metadata paths

## Current Repo Integration

`npm run publish` now refreshes `docs/release/commit-history.md` before the build/package flow runs.

## Runtime Selection

Use `dev/commit-history-auto.ps1` when both runtimes are installed and you want the machine to choose intelligently.

Rules:

1. Prefer Node when the target repo has `package.json` but not `pyproject.toml`.
2. Prefer uv when the target repo has `pyproject.toml` but not `package.json`.
3. If both exist, prefer Node unless you explicitly override with `-Runtime uv`.

### Example

```powershell
.\dev\commit-history-auto.ps1 --all --ci-summary
.\dev\commit-history-auto.ps1 -Runtime uv --versions --format json --mcp-output
```

## CI / CD Notes

Node example:

```yaml
- name: Generate commit history
  run: npx @life-experimentalist/commit-history-cli --all --format markdown --ci-summary --output docs/release/commit-history.md
```

uv example:

```yaml
- name: Generate commit history
  run: uv run --project packages/commit-history-uv commit-history-uv --all --format markdown --ci-summary --output docs/release/commit-history.md
```

## MCP Notes

Use `--mcp-output` together with `--format json` to emit a payload that is more convenient for agent or MCP-server ingestion.

## Charts

Charts are always opt-in via `--with-charts`.
The default behavior stays focused on human-readable commit history without extra visual noise.
