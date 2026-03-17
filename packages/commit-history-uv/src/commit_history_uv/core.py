from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

VERSION_PATTERN = __import__("re").compile(
    r"\bv?\d+\.\d+\.\d+\b", __import__("re").IGNORECASE
)
DEFAULT_PACKAGE_PATH = "package.json"
DEFAULT_MANIFEST_PATHS = [
    "src/manifest-firefox.json",
    "src/manifest-chromium.json",
    "src/library/manifest.webmanifest",
]
LOG_LEVELS = {"silent": 0, "info": 1, "debug": 2}


@dataclass
class CommitRecord:
    hash: str
    short_hash: str
    date: str
    subject: str
    body: str
    type: str
    body_preview: list[str]
    changed_files: list[str]
    package_info: dict | None
    manifest_versions: list[dict]


def parse_commit_type(subject: str) -> str:
    import re

    match = re.match(r"^([a-zA-Z]+)(?:\([^)]*\))?!?:", subject)
    return match.group(1).lower() if match else "other"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="commit-history-uv")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--versions", action="store_true")
    parser.add_argument("--output")
    parser.add_argument(
        "--format", choices=["text", "markdown", "json"], default="text"
    )
    parser.add_argument("--body-lines", type=int, default=8)
    parser.add_argument("--max-files", type=int, default=6)
    parser.add_argument("--ci-summary", action="store_true")
    parser.add_argument("--with-charts", action="store_true")
    parser.add_argument("--mcp-output", action="store_true")
    parser.add_argument("--manifest-path", action="append", default=[])
    parser.add_argument("--package-path", default=DEFAULT_PACKAGE_PATH)
    parser.add_argument("--since")
    parser.add_argument("--until")
    parser.add_argument("--limit", type=int)
    parser.add_argument(
        "--log-level", choices=["silent", "info", "debug"], default="info"
    )
    parser.add_argument("--no-merges", action="store_true")
    args = parser.parse_args(argv)
    args.mode = "versions" if args.versions else "all"
    if args.mcp_output:
        args.format = "json"
    args.manifest_paths = [*DEFAULT_MANIFEST_PATHS, *args.manifest_path]
    return args


def emit_log(options: argparse.Namespace, level: str, message: str) -> None:
    if LOG_LEVELS[level] <= LOG_LEVELS[options.log_level]:
        sys.stderr.write(f"[commit-history:{level}] {message}\n")


def default_run_git(args: list[str], cwd: str | None = None) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return completed.stdout


def try_run_git(
    run_git: Callable[[list[str], str | None], str], args: list[str], cwd: str | None
) -> str | None:
    try:
        return run_git(args, cwd)
    except Exception:
        return None


def parse_json_safe(text: str | None) -> dict | None:
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def build_log_args(options: argparse.Namespace) -> list[str]:
    args = ["log"]
    if options.no_merges:
        args.append("--no-merges")
    if options.since:
        args.append(f"--since={options.since}")
    if options.until:
        args.append(f"--until={options.until}")
    if options.limit:
        args.append(f"--max-count={options.limit}")
    args.extend(["--date=short", "--pretty=format:%H%x1f%h%x1f%ad%x1f%s%x1f%B%x1e"])
    return args


def read_commits(
    run_git: Callable[[list[str], str | None], str],
    options: argparse.Namespace,
    cwd: str | None,
) -> list[dict]:
    raw = run_git(build_log_args(options), cwd)
    commits = []
    for entry in [part.strip() for part in raw.split("\x1e") if part.strip()]:
        hash_value, short_hash, date, subject, body = entry.split("\x1f")
        commits.append(
            {
                "hash": hash_value,
                "short_hash": short_hash,
                "date": date,
                "subject": subject.strip(),
                "body": body.strip(),
                "type": parse_commit_type(subject.strip()),
            }
        )
    return commits


def build_body_preview(body: str, line_limit: int) -> list[str]:
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    return lines[:line_limit]


def get_changed_files(
    run_git: Callable[[list[str], str | None], str], commit_hash: str, cwd: str | None
) -> list[str]:
    output = try_run_git(
        run_git,
        ["diff-tree", "--no-commit-id", "--name-only", "-r", commit_hash],
        cwd,
    )
    return [line.strip() for line in (output or "").splitlines() if line.strip()]


def read_file_at_commit(
    run_git: Callable[[list[str], str | None], str],
    commit_hash: str,
    file_path: str,
    cwd: str | None,
) -> str | None:
    return try_run_git(run_git, ["show", f"{commit_hash}:{file_path}"], cwd)


def get_package_info(
    run_git: Callable[[list[str], str | None], str],
    commit_hash: str,
    package_path: str,
    cwd: str | None,
) -> dict | None:
    package_json = parse_json_safe(
        read_file_at_commit(run_git, commit_hash, package_path, cwd)
    )
    if not package_json:
        return None
    return {"name": package_json.get("name"), "version": package_json.get("version")}


def get_manifest_versions(
    run_git: Callable[[list[str], str | None], str],
    commit_hash: str,
    manifest_paths: list[str],
    cwd: str | None,
) -> list[dict]:
    versions = []
    for manifest_path in manifest_paths:
        manifest_json = parse_json_safe(
            read_file_at_commit(run_git, commit_hash, manifest_path, cwd)
        )
        if manifest_json and manifest_json.get("version"):
            versions.append(
                {"path": manifest_path, "version": manifest_json["version"]}
            )
    return versions


def filter_commits(commits: list[dict], options: argparse.Namespace) -> list[dict]:
    if options.mode != "versions":
        return commits
    return [
        commit
        for commit in commits
        if VERSION_PATTERN.search(f"{commit['subject']}\n{commit['body']}")
    ]


def materialize_commits(
    commits: list[dict],
    options: argparse.Namespace,
    run_git: Callable[[list[str], str | None], str],
    cwd: str | None,
) -> list[CommitRecord]:
    records = []
    for commit in commits:
        records.append(
            CommitRecord(
                hash=commit["hash"],
                short_hash=commit["short_hash"],
                date=commit["date"],
                subject=commit["subject"],
                body=commit["body"],
                type=commit["type"],
                body_preview=build_body_preview(commit["body"], options.body_lines),
                changed_files=get_changed_files(run_git, commit["hash"], cwd),
                package_info=get_package_info(
                    run_git, commit["hash"], options.package_path, cwd
                ),
                manifest_versions=get_manifest_versions(
                    run_git, commit["hash"], options.manifest_paths, cwd
                ),
            )
        )
    return records


def summarize_commits(commits: list[CommitRecord]) -> dict:
    commit_types: dict[str, int] = {}
    commits_by_date: dict[str, int] = {}
    touched_files: set[str] = set()
    version_commits = 0
    for commit in commits:
        commit_types[commit.type] = commit_types.get(commit.type, 0) + 1
        commits_by_date[commit.date] = commits_by_date.get(commit.date, 0) + 1
        touched_files.update(commit.changed_files)
        if VERSION_PATTERN.search(f"{commit.subject}\n{commit.body}"):
            version_commits += 1
    return {
        "total_commits": len(commits),
        "version_commits": version_commits,
        "commit_types": commit_types,
        "commits_by_date": commits_by_date,
        "unique_files_touched": len(touched_files),
    }


def build_chart_lines(title: str, entries: list[tuple[str, int]]) -> list[str]:
    if not entries:
        return []
    max_value = max(value for _, value in entries)
    lines = [title]
    for label, value in entries:
        bar_length = 0 if max_value == 0 else max(1, round((value / max_value) * 20))
        lines.append(f"- {label.ljust(14)} {'#' * bar_length} ({value})")
    return lines


def build_charts(summary: dict) -> dict:
    by_type = sorted(
        summary["commit_types"].items(), key=lambda item: item[1], reverse=True
    )
    by_date = sorted(summary["commits_by_date"].items(), key=lambda item: item[0])
    return {
        "by_type": [{"label": label, "value": value} for label, value in by_type],
        "by_date": [{"label": label, "value": value} for label, value in by_date],
        "ascii": {
            "by_type": build_chart_lines("Commit Types", by_type),
            "by_date": build_chart_lines("Commits By Date", by_date),
        },
    }


def create_report(
    options: argparse.Namespace,
    run_git: Callable[[list[str], str | None], str] | None = None,
    cwd: str | None = None,
) -> dict:
    run_git_impl = run_git or default_run_git
    repo_cwd = cwd or str(Path.cwd())
    raw_commits = read_commits(run_git_impl, options, repo_cwd)
    filtered = filter_commits(raw_commits, options)
    commits = materialize_commits(filtered, options, run_git_impl, repo_cwd)
    summary = summarize_commits(commits)
    charts = build_charts(summary) if options.with_charts else None
    return {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "cwd": repo_cwd,
            "mode": options.mode,
            "format": options.format,
        },
        "summary": summary,
        "commits": [commit.__dict__ for commit in commits],
        "charts": charts,
    }


def render_summary_lines(report: dict) -> list[str]:
    lines = [
        f"Summary: {report['summary']['total_commits']} commit(s)",
        f"Version commits: {report['summary']['version_commits']}",
        f"Unique files touched: {report['summary']['unique_files_touched']}",
    ]
    for commit_type, count in sorted(report["summary"]["commit_types"].items()):
        lines.append(f"Type {commit_type}: {count}")
    return lines


def visible_files(files: list[str], max_files: int) -> list[str]:
    trimmed = [f"   - {item}" for item in files[:max_files]]
    if len(files) > max_files:
        trimmed.append(f"   - ... ({len(files) - max_files} more)")
    return trimmed


def render_text(report: dict, options: argparse.Namespace) -> str:
    lines = [
        f"Mode: {report['metadata']['mode']}",
        "Format: text",
        f"Generated: {report['metadata']['generated_at']}",
        f"Total commits: {report['summary']['total_commits']}",
        "",
    ]
    if options.ci_summary:
        lines.extend(render_summary_lines(report))
        lines.append("")
    for commit in report["commits"]:
        lines.append(f"[{commit['short_hash']}] {commit['date']} {commit['subject']}")
        for body_line in commit["body_preview"]:
            lines.append(f"   {body_line}")
        if commit["changed_files"]:
            lines.append("   Files:")
            lines.extend(visible_files(commit["changed_files"], options.max_files))
        if commit["package_info"]:
            lines.append("   Package:")
            if commit["package_info"].get("name"):
                lines.append(f"   - name: {commit['package_info']['name']}")
            if commit["package_info"].get("version"):
                lines.append(f"   - version: {commit['package_info']['version']}")
        if commit["manifest_versions"]:
            lines.append("   Manifests:")
            for manifest in commit["manifest_versions"]:
                lines.append(f"   - {manifest['path']}: {manifest['version']}")
        lines.append("")
    if report["charts"]:
        lines.extend(report["charts"]["ascii"]["by_type"])
        lines.append("")
        lines.extend(report["charts"]["ascii"]["by_date"])
        lines.append("")
    return "\n".join(lines) + "\n"


def render_markdown(report: dict, options: argparse.Namespace) -> str:
    lines = [
        "# Commit History Report",
        "",
        f"- Mode: {report['metadata']['mode']}",
        f"- Generated: {report['metadata']['generated_at']}",
        f"- Total commits: {report['summary']['total_commits']}",
        "",
    ]
    if options.ci_summary:
        lines.extend(["## Summary", ""])
        lines.extend([f"- {line}" for line in render_summary_lines(report)])
        lines.append("")
    for commit in report["commits"]:
        lines.extend(
            [f"## [{commit['short_hash']}] {commit['date']} {commit['subject']}", ""]
        )
        lines.extend([f"- {line}" for line in commit["body_preview"]])
        if commit["changed_files"]:
            lines.extend(["", "Files:"])
            lines.extend(
                [
                    line.replace("   ", "- ", 1)
                    for line in visible_files(
                        commit["changed_files"], options.max_files
                    )
                ]
            )
        if commit["package_info"]:
            lines.extend(["", "Package:"])
            if commit["package_info"].get("name"):
                lines.append(f"- name: {commit['package_info']['name']}")
            if commit["package_info"].get("version"):
                lines.append(f"- version: {commit['package_info']['version']}")
        if commit["manifest_versions"]:
            lines.extend(["", "Manifests:"])
            lines.extend(
                [
                    f"- {manifest['path']}: {manifest['version']}"
                    for manifest in commit["manifest_versions"]
                ]
            )
        lines.append("")
    if report["charts"]:
        lines.extend(["## Charts", "", "```text"])
        lines.extend(report["charts"]["ascii"]["by_type"])
        lines.append("")
        lines.extend(report["charts"]["ascii"]["by_date"])
        lines.extend(["```", ""])
    return "\n".join(lines) + "\n"


def render_json(report: dict, options: argparse.Namespace) -> str:
    payload = {
        "tool": "commit-history-uv",
        "version": "1.0",
        "metadata": report["metadata"],
        "summary": report["summary"],
        "commits": report["commits"],
    }
    if report["charts"]:
        payload["charts"] = report["charts"]
    if options.mcp_output:
        payload["mcp"] = {
            "resource": "commit-history-report",
            "content_type": "application/json",
        }
    return json.dumps(payload, indent=2) + "\n"


def render_report(report: dict, options: argparse.Namespace) -> str:
    if options.format == "markdown":
        return render_markdown(report, options)
    if options.format == "json":
        return render_json(report, options)
    return render_text(report, options)


def write_output(text: str, output_file: str | None) -> None:
    if not output_file:
        sys.stdout.write(text)
        return
    output_path = Path(output_file).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(text, encoding="utf-8")
    sys.stdout.write(f"Wrote commit history to {output_path}\n")


def main(argv: list[str] | None = None) -> int:
    options = parse_args(argv)
    emit_log(
        options, "debug", f"Generating {options.mode} report in {options.format} format"
    )
    report = create_report(options)
    output = render_report(report, options)
    write_output(output, options.output)
    return 0
