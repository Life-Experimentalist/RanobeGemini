# @life-experimentalist/commit-history-cli

Cross-platform CLI for generating readable commit history reports from a git repository.
It is designed as a standalone npm package for release notes, agent workflows, CI pipelines, MCP-friendly consumers, and optional chart output without forcing charts by default.

## Features

- Works with `npx` or as a locally installed CLI.
- Prints all commits or only version-related commits.
- Includes package and manifest version details when available.
- Adds a short changed-files summary for each commit.
- Supports writing output to a file for release docs.
- Supports `text`, `markdown`, and `json` output.
- Optional CI summary and optional ASCII charts.
- Optional MCP-friendly JSON payload mode.
- Configurable body/file limits and custom manifest paths.
## Standalone Project Shape

This package is structured to live in its own repository.
It does not require Ranobe Gemini-specific files and works against any git repository that optionally contains package metadata or manifest-like JSON files.

## Usage

```powershell
npx @life-experimentalist/commit-history-cli --all
npx @life-experimentalist/commit-history-cli --versions
npx @life-experimentalist/commit-history-cli --all --output commit-history.md
npx @life-experimentalist/commit-history-cli --versions --format markdown --ci-summary
npx @life-experimentalist/commit-history-cli --all --format json --mcp-output --with-charts
```

## Install Locally

```powershell
npm install --save-dev @life-experimentalist/commit-history-cli
npx commit-history-cli --all
```

## Local Development

```powershell
npm install
npm test
node .\bin\commit-history.js --help
```

## Options

- `--all`: include all commits.
- `--versions`: include only commits whose subject/body contains a semantic version.
- `--output <path>`: write the report to a file instead of stdout.
- `--format <text|markdown|json>`: choose the output format.
- `--body-lines <n>`: cap the number of commit-body lines shown per entry.
- `--max-files <n>`: cap the number of file paths shown per commit.
- `--ci-summary`: include a summary block suitable for CI logs and release jobs.
- `--with-charts`: include optional ASCII charts or chart data.
- `--mcp-output`: emit MCP-friendly JSON payloads for tool/server integration.
- `--manifest-path <path>`: add an extra manifest path to inspect. Repeatable.
- `--package-path <path>`: inspect a different package metadata file instead of `package.json`.
- `--since <git-date>`: pass a lower git date bound.
- `--until <git-date>`: pass an upper git date bound.
- `--limit <n>`: limit the number of commits returned.
- `--log-level <silent|info|debug>`: control stderr logging.
- `--no-merges`: exclude merge commits.

## Example npm script

```json
{
	"scripts": {
		"commits:write": "commit-history-cli --all --ci-summary --output commit-history.md",
		"release:prepare": "npm run commits:write",
		"release:publish": "npm run release:prepare && npm publish --access public"
	}
}
```

## CI / CD Example

```yaml
- name: Generate commit history
	run: npx @life-experimentalist/commit-history-cli --all --format markdown --ci-summary --output commit-history.md

- name: Generate MCP JSON for agents
  run: npx @life-experimentalist/commit-history-cli --versions --format json --mcp-output --output artifacts/commit-history.json
```

## Example Outputs

Text report:

```powershell
npx @life-experimentalist/commit-history-cli --all --body-lines 3 --max-files 5
```

Markdown release appendix:

```powershell
npx @life-experimentalist/commit-history-cli --versions --format markdown --output release-commits.md
```

Machine-readable MCP payload:

```powershell
npx @life-experimentalist/commit-history-cli --all --format json --mcp-output --output commit-history.json
```

## MCP / Agent Integration

Use `--mcp-output` when the report will be consumed by an agent or MCP server. That mode emits JSON with:

- metadata
- summary
- per-commit records
- optional chart data when `--with-charts` is enabled

## Charts

Charts are opt-in. Use `--with-charts` to include commit-type and commit-date summaries.
Nothing chart-related appears unless the flag is set.

## Publishing Notes

1. Sign in to npm with `npm login`.
2. Run `npm test`.
3. From this package directory, run `npm publish --access public`.
4. After publishing, consumers can run it with `npx @life-experimentalist/commit-history-cli --all`.

## Runtime Selection

If you also use the Python/uv package, prefer a small wrapper that selects the runtime based on the current repository type:

- prefer Node for JavaScript/TypeScript repos with `package.json`
- prefer uv for Python repos with `pyproject.toml`
- allow an explicit override when both are available

## Extraction Notes

If you move this package into its own repository, keep these paths at the top level:

- `bin/`
- `lib/`
- `tests/`
- `.gitignore`
- `package.json`
- `README.md`
