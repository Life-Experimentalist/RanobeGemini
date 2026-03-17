const test = require("node:test");
const assert = require("node:assert/strict");

const {
	buildCharts,
	createReport,
	parseArgs,
	parseCommitType,
	renderReport,
} = require("../lib/core.js");

function createFakeGitRunner() {
	const responses = new Map([
		[
			[
				"log",
				"--date=short",
				"--pretty=format:%H%x1f%h%x1f%ad%x1f%s%x1f%B%x1e",
			].join("|"),
			[
				"1111111111111111111111111111111111111111\x1fa1b2c3d\x1f2026-03-17\x1ffeat: add charts\x1fAdded optional chart mode\x1e",
				"2222222222222222222222222222222222222222\x1fd4e5f6g\x1f2026-03-16\x1ffix: stabilize parser\x1fHandle missing manifest files\x1e",
			].join(""),
		],
		[
			[
				"diff-tree",
				"--no-commit-id",
				"--name-only",
				"-r",
				"1111111111111111111111111111111111111111",
			].join("|"),
			"package.json\nsrc/manifest-firefox.json\ndocs/release/CHANGELOG.md",
		],
		[
			[
				"diff-tree",
				"--no-commit-id",
				"--name-only",
				"-r",
				"2222222222222222222222222222222222222222",
			].join("|"),
			"src/index.js\nsrc/parser.js",
		],
		[
			[
				"show",
				"1111111111111111111111111111111111111111:package.json",
			].join("|"),
			'{"name":"demo-tool","version":"1.2.3"}',
		],
		[
			[
				"show",
				"1111111111111111111111111111111111111111:src/manifest-firefox.json",
			].join("|"),
			'{"version":"1.2.3"}',
		],
		[
			[
				"show",
				"1111111111111111111111111111111111111111:src/manifest-chromium.json",
			].join("|"),
			'{"version":"1.2.3"}',
		],
		[
			[
				"show",
				"1111111111111111111111111111111111111111:src/library/manifest.webmanifest",
			].join("|"),
			'{"version":"1.2.3"}',
		],
	]);

	return (args) => responses.get(args.join("|")) || "";
}

test("parseArgs supports richer options", () => {
	const options = parseArgs([
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
		"custom-manifest.json",
	]);

	assert.equal(options.mode, "versions");
	assert.equal(options.format, "markdown");
	assert.equal(options.withCharts, true);
	assert.equal(options.ciSummary, true);
	assert.equal(options.bodyLines, 3);
	assert.equal(options.maxFiles, 4);
	assert.equal(options.manifestPaths.includes("custom-manifest.json"), true);
});

test("parseCommitType falls back to other", () => {
	assert.equal(parseCommitType("feat(parser): improve output"), "feat");
	assert.equal(parseCommitType("Release 4.4.0"), "other");
});

test("createReport builds summary and commit details", () => {
	const report = createReport(
		{
			mode: "all",
			format: "text",
			bodyLines: 4,
			maxFiles: 6,
			ciSummary: true,
			withCharts: true,
			mcpOutput: false,
			manifestPaths: [
				"src/manifest-firefox.json",
				"src/manifest-chromium.json",
				"src/library/manifest.webmanifest",
			],
			packagePath: "package.json",
			since: null,
			until: null,
			limit: null,
			logLevel: "silent",
			includeMerges: true,
		},
		{
			runGit: createFakeGitRunner(),
			cwd: "V:/repo",
			now: () => "2026-03-17T00:00:00.000Z",
		},
	);

	assert.equal(report.summary.totalCommits, 2);
	assert.equal(report.summary.commitTypes.feat, 1);
	assert.equal(report.summary.commitTypes.fix, 1);
	assert.equal(report.commits[0].packageInfo.version, "1.2.3");
	assert.equal(report.commits[0].manifestVersions.length, 3);
	assert.ok(report.charts.ascii.byType.some((line) => line.includes("feat")));
});

test("renderReport emits mcp-friendly json", () => {
	const report = {
		metadata: {
			generatedAt: "2026-03-17T00:00:00.000Z",
			mode: "all",
			format: "json",
		},
		summary: {
			totalCommits: 1,
			versionCommits: 0,
			commitTypes: { feat: 1 },
			commitsByDate: { "2026-03-17": 1 },
			uniqueFilesTouched: 2,
		},
		commits: [],
		charts: buildCharts({
			commitTypes: { feat: 1 },
			commitsByDate: { "2026-03-17": 1 },
		}),
	};
	const output = renderReport(report, { format: "json", mcpOutput: true });
	const parsed = JSON.parse(output);

	assert.equal(parsed.tool, "commit-history-cli");
	assert.equal(parsed.mcp.resource, "commit-history-report");
	assert.ok(Array.isArray(parsed.charts.byType));
});
