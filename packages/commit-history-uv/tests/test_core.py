from __future__ import annotations

import argparse
import json
import unittest

from src.commit_history_uv.core import (
    build_charts,
    create_report,
    parse_args,
    parse_commit_type,
    render_report,
)


def fake_git(args: list[str], cwd: str | None = None) -> str:
    key = "|".join(args)
    responses = {
        "log|--date=short|--pretty=format:%H%x1f%h%x1f%ad%x1f%s%x1f%B%x1e": (
            "1111111111111111111111111111111111111111\x1fa1b2c3d\x1f2026-03-17\x1ffeat: add charts\x1fAdded optional chart mode\x1e"
            "2222222222222222222222222222222222222222\x1fd4e5f6g\x1f2026-03-16\x1ffix: stabilize parser\x1fHandle missing manifest files\x1e"
        ),
        "diff-tree|--no-commit-id|--name-only|-r|1111111111111111111111111111111111111111": "package.json\nsrc/manifest-firefox.json",
        "diff-tree|--no-commit-id|--name-only|-r|2222222222222222222222222222222222222222": "src/index.py\nsrc/core.py",
        "show|1111111111111111111111111111111111111111:package.json": '{"name": "demo-tool", "version": "1.2.3"}',
        "show|1111111111111111111111111111111111111111:src/manifest-firefox.json": '{"version": "1.2.3"}',
        "show|1111111111111111111111111111111111111111:src/manifest-chromium.json": '{"version": "1.2.3"}',
        "show|1111111111111111111111111111111111111111:src/library/manifest.webmanifest": '{"version": "1.2.3"}',
    }
    return responses.get(key, "")


class CommitHistoryCoreTests(unittest.TestCase):
    def test_parse_args(self) -> None:
        options = parse_args(
            [
                "--versions",
                "--format",
                "markdown",
                "--with-charts",
                "--ci-summary",
                "--body-lines",
                "3",
                "--max-files",
                "4",
                "--manifest-path",
                "custom.json",
            ]
        )
        self.assertEqual(options.mode, "versions")
        self.assertEqual(options.format, "markdown")
        self.assertTrue(options.with_charts)
        self.assertTrue(options.ci_summary)
        self.assertEqual(options.body_lines, 3)
        self.assertEqual(options.max_files, 4)
        self.assertIn("custom.json", options.manifest_paths)

    def test_parse_commit_type(self) -> None:
        self.assertEqual(parse_commit_type("feat(parser): improve output"), "feat")
        self.assertEqual(parse_commit_type("Release 4.4.0"), "other")

    def test_create_report(self) -> None:
        options = argparse.Namespace(
            mode="all",
            output=None,
            format="text",
            body_lines=4,
            max_files=6,
            ci_summary=True,
            with_charts=True,
            mcp_output=False,
            manifest_path=[],
            manifest_paths=[
                "src/manifest-firefox.json",
                "src/manifest-chromium.json",
                "src/library/manifest.webmanifest",
            ],
            package_path="package.json",
            since=None,
            until=None,
            limit=None,
            log_level="silent",
            no_merges=False,
            all=True,
            versions=False,
        )
        report = create_report(options, run_git=fake_git, cwd="V:/repo")
        self.assertEqual(report["summary"]["total_commits"], 2)
        self.assertEqual(report["summary"]["commit_types"]["feat"], 1)
        self.assertEqual(report["commits"][0]["package_info"]["version"], "1.2.3")
        self.assertEqual(len(report["commits"][0]["manifest_versions"]), 3)
        self.assertTrue(report["charts"]["ascii"]["by_type"])

    def test_render_report_json_with_mcp(self) -> None:
        options = argparse.Namespace(format="json", mcp_output=True)
        report = {
            "metadata": {
                "generated_at": "2026-03-17T00:00:00+00:00",
                "mode": "all",
                "format": "json",
            },
            "summary": {
                "total_commits": 1,
                "version_commits": 0,
                "commit_types": {"feat": 1},
                "commits_by_date": {"2026-03-17": 1},
                "unique_files_touched": 2,
            },
            "commits": [],
            "charts": build_charts(
                {"commit_types": {"feat": 1}, "commits_by_date": {"2026-03-17": 1}}
            ),
        }
        payload = json.loads(render_report(report, options))
        self.assertEqual(payload["tool"], "commit-history-uv")
        self.assertEqual(payload["mcp"]["resource"], "commit-history-report")


if __name__ == "__main__":
    unittest.main()
