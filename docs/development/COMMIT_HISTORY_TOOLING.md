# Commit History Tooling

This repo uses a local commit-history generator script at `dev/commit-history.js` for release reporting.

## Local Script Features

The local script supports:

- full or version-only commit views
- text, markdown, and JSON output
- optional CI summary
- optional charts
- MCP-friendly JSON output
- configurable manifest and package metadata paths

## Current Repo Integration

`npm run publish` now refreshes `docs/release/commit-history.md` before the build/package flow runs.

## Runtime Selection

Use `dev/commit-history-auto.ps1` to invoke the local commit-history script.

Rules:

1. This repository uses `node dev/commit-history.js`.
2. `-Runtime node` is supported for explicit invocation.
3. `-Runtime auto` defaults to Node.

### Example

```powershell
.\dev\commit-history-auto.ps1 --all --ci-summary
.\dev\commit-history-auto.ps1 -Runtime node --versions --format json --mcp-output
```

## CI / CD Notes

Node example:

```yaml
- name: Generate commit history
  run: node dev/commit-history.js --all --format markdown --ci-summary --output docs/release/commit-history.md
```

## MCP Notes

Use `--mcp-output` together with `--format json` to emit a payload that is more convenient for agent or MCP-server ingestion.

## Charts

Charts are always opt-in via `--with-charts`.
The default behavior stays focused on human-readable commit history without extra visual noise.
