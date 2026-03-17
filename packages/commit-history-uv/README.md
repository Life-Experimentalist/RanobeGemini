# commit-history-uv

Cross-platform git commit-history CLI for Python and uv.
It is designed as a standalone Python package that mirrors the Node package behavior while remaining friendly to `uv run`, `uvx`, CI pipelines, agents, MCP consumers, and optional chart output.

## Features

- Works with `uv run`, `uvx`, or direct Python execution.
- Supports `text`, `markdown`, and `json` output.
- Optional CI summary and optional charts.
- Optional MCP-friendly JSON payloads.
- Gracefully handles missing package or manifest files in older commits.
- Uses only the Python standard library.

## Standalone Project Shape

This package is structured to live in its own repository.
It does not depend on Ranobe Gemini-specific code and works against any git repository with optional package metadata or manifest-like JSON files.

## Usage

```powershell
uv run --project . commit-history-uv --all
uv run --project . commit-history-uv --versions --format markdown --ci-summary
uv run --project . commit-history-uv --all --format json --mcp-output --with-charts
```

After publishing:

```powershell
uvx commit-history-uv --all
```

## Local Development

```powershell
uv sync
uv run python -m unittest discover -s tests -p test_*.py
uv run --project . commit-history-uv --help
```

## Options

- `--all`
- `--versions`
- `--output <path>`
- `--format <text|markdown|json>`
- `--body-lines <n>`
- `--max-files <n>`
- `--ci-summary`
- `--with-charts`
- `--mcp-output`
- `--manifest-path <path>` repeatable
- `--package-path <path>`
- `--since <git-date>`
- `--until <git-date>`
- `--limit <n>`
- `--log-level <silent|info|debug>`
- `--no-merges`

## CI / CD Example

```yaml
- name: Generate commit history with uv
  run: uv run --project . commit-history-uv --all --format markdown --ci-summary --output commit-history.md

- name: Generate MCP payload
  run: uv run --project . commit-history-uv --versions --format json --mcp-output --output artifacts/commit-history.json
```

## Example Outputs

Human-readable report:

```powershell
uv run --project . commit-history-uv --all --body-lines 3 --max-files 5
```

Markdown appendix:

```powershell
uv run --project . commit-history-uv --versions --format markdown --output release-commits.md
```

MCP payload:

```powershell
uv run --project . commit-history-uv --all --format json --mcp-output --output commit-history.json
```

## Publishing

```powershell
uv build
uv publish
```

Run tests before publishing:

```powershell
uv run python -m unittest discover -s tests -p test_*.py
```

## Runtime Selection

If both the Node and uv packages are installed on a machine, use a repo-aware wrapper that prefers:

- Node for repos centered on `package.json`
- uv for repos centered on `pyproject.toml`
- an explicit override when both are present

## Extraction Notes

If you move this package into its own repository, keep these paths at the top level:

- `src/commit_history_uv/`
- `tests/`
- `.gitignore`
- `pyproject.toml`
- `README.md`
