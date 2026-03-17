const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const VERSION_PATTERN = /\bv?\d+\.\d+\.\d+\b/i;
const DEFAULT_PACKAGE_PATH = "package.json";
const DEFAULT_MANIFEST_PATHS = [
	"src/manifest-firefox.json",
	"src/manifest-chromium.json",
	"src/library/manifest.webmanifest",
];
const LOG_LEVELS = {
	silent: 0,
	info: 1,
	debug: 2,
};
const HELP_TEXT = `commit-history-cli

Usage:
  commit-history-cli --all [options]
  commit-history-cli --versions [options]

Options:
  --all                      Include all commits
  --versions                 Include only version-related commits
  --output <path>            Write the report to a file
  --format <text|markdown|json>
  --body-lines <n>           Commit body lines per entry
  --max-files <n>            Changed files per entry
  --ci-summary               Include CI-friendly summary block
  --with-charts              Include optional charts/chart data
  --mcp-output               Emit MCP-friendly JSON payload
  --manifest-path <path>     Additional manifest path to inspect
  --package-path <path>      Alternate package metadata path
  --since <git-date>         Lower date bound for git log
  --until <git-date>         Upper date bound for git log
  --limit <n>                Limit the number of commits
  --log-level <silent|info|debug>
  --no-merges                Exclude merge commits
  --help                     Show help
`;

function parseInteger(value, fallback) {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function parseArgs(argv) {
	const options = {
		mode: "all",
		outputFile: null,
		format: "text",
		bodyLines: 8,
		maxFiles: 6,
		ciSummary: false,
		withCharts: false,
		mcpOutput: false,
		manifestPaths: [...DEFAULT_MANIFEST_PATHS],
		packagePath: DEFAULT_PACKAGE_PATH,
		since: null,
		until: null,
		limit: null,
		logLevel: "info",
		includeMerges: true,
		help: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const current = argv[index];
		switch (current) {
			case "--all":
				options.mode = "all";
				break;
			case "--versions":
				options.mode = "versions";
				break;
			case "--output":
				options.outputFile = argv[index + 1] || null;
				index += 1;
				break;
			case "--format":
				options.format = argv[index + 1] || options.format;
				index += 1;
				break;
			case "--body-lines":
				options.bodyLines = parseInteger(
					argv[index + 1],
					options.bodyLines,
				);
				index += 1;
				break;
			case "--max-files":
				options.maxFiles = parseInteger(
					argv[index + 1],
					options.maxFiles,
				);
				index += 1;
				break;
			case "--ci-summary":
				options.ciSummary = true;
				break;
			case "--with-charts":
				options.withCharts = true;
				break;
			case "--mcp-output":
				options.mcpOutput = true;
				options.format = "json";
				break;
			case "--manifest-path":
				if (argv[index + 1]) {
					options.manifestPaths.push(argv[index + 1]);
				}
				index += 1;
				break;
			case "--package-path":
				options.packagePath = argv[index + 1] || options.packagePath;
				index += 1;
				break;
			case "--since":
				options.since = argv[index + 1] || null;
				index += 1;
				break;
			case "--until":
				options.until = argv[index + 1] || null;
				index += 1;
				break;
			case "--limit":
				options.limit = parseInteger(argv[index + 1], null);
				index += 1;
				break;
			case "--log-level":
				options.logLevel = argv[index + 1] || options.logLevel;
				index += 1;
				break;
			case "--no-merges":
				options.includeMerges = false;
				break;
			case "--help":
				options.help = true;
				break;
			default:
				break;
		}
	}

	if (!["text", "markdown", "json"].includes(options.format)) {
		options.format = "text";
	}

	if (!Object.prototype.hasOwnProperty.call(LOG_LEVELS, options.logLevel)) {
		options.logLevel = "info";
	}

	return options;
}

function emitLog(options, level, message) {
	if (LOG_LEVELS[level] <= LOG_LEVELS[options.logLevel]) {
		process.stderr.write(`[commit-history:${level}] ${message}\n`);
	}
}

function defaultRunGit(args, cwd) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
}

function tryRunGit(runGit, args, cwd) {
	try {
		return runGit(args, cwd);
	} catch {
		return null;
	}
}

function parseJsonSafe(text) {
	if (!text) {
		return null;
	}

	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function parseCommitType(subject) {
	const match = subject.match(/^([a-zA-Z]+)(?:\([^)]*\))?!?:/);
	return match ? match[1].toLowerCase() : "other";
}

function readFileAtCommit(runGit, commitHash, filePath, cwd) {
	return tryRunGit(runGit, ["show", `${commitHash}:${filePath}`], cwd);
}

function getChangedFiles(runGit, commitHash, cwd) {
	const output = tryRunGit(
		runGit,
		["diff-tree", "--no-commit-id", "--name-only", "-r", commitHash],
		cwd,
	);

	return (output || "")
		.split(/\r?\n/)
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function getPackageDetails(runGit, commitHash, packagePath, cwd) {
	const packageJsonText = readFileAtCommit(
		runGit,
		commitHash,
		packagePath,
		cwd,
	);
	const packageJson = parseJsonSafe(packageJsonText);
	if (!packageJson) {
		return null;
	}

	return {
		name: packageJson.name || null,
		version: packageJson.version || null,
	};
}

function getManifestVersions(runGit, commitHash, manifestPaths, cwd) {
	const versions = [];
	for (const manifestPath of manifestPaths) {
		const manifestText = readFileAtCommit(
			runGit,
			commitHash,
			manifestPath,
			cwd,
		);
		const manifestJson = parseJsonSafe(manifestText);
		if (manifestJson?.version) {
			versions.push({
				path: manifestPath,
				version: manifestJson.version,
			});
		}
	}
	return versions;
}

function buildGitLogArgs(options) {
	const args = ["log"];
	if (!options.includeMerges) {
		args.push("--no-merges");
	}
	if (options.since) {
		args.push(`--since=${options.since}`);
	}
	if (options.until) {
		args.push(`--until=${options.until}`);
	}
	if (options.limit) {
		args.push(`--max-count=${options.limit}`);
	}
	args.push(
		"--date=short",
		"--pretty=format:%H%x1f%h%x1f%ad%x1f%s%x1f%B%x1e",
	);
	return args;
}

function readCommits(runGit, options, cwd) {
	const raw = runGit(buildGitLogArgs(options), cwd);
	return raw
		.split("\x1e")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => {
			const [hash, shortHash, date, subject, body] = entry.split("\x1f");
			return {
				hash,
				shortHash,
				date,
				subject: (subject || "").trim(),
				body: (body || "").trim(),
				type: parseCommitType((subject || "").trim()),
			};
		});
}

function buildCommitBodyPreview(body, lineLimit) {
	return body
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, lineLimit);
}

function summarizeCommits(commits) {
	const byType = {};
	const byDate = {};
	const touchedFiles = new Set();

	for (const commit of commits) {
		byType[commit.type] = (byType[commit.type] || 0) + 1;
		byDate[commit.date] = (byDate[commit.date] || 0) + 1;
		for (const filePath of commit.changedFiles) {
			touchedFiles.add(filePath);
		}
	}

	return {
		totalCommits: commits.length,
		versionCommits: commits.filter((commit) =>
			VERSION_PATTERN.test(`${commit.subject}\n${commit.body}`),
		).length,
		commitTypes: byType,
		commitsByDate: byDate,
		uniqueFilesTouched: touchedFiles.size,
	};
}

function buildChartLines(title, entries) {
	if (!entries.length) {
		return [];
	}

	const maxValue = Math.max(...entries.map((entry) => entry.value));
	const lines = [title];
	for (const entry of entries) {
		const barLength =
			maxValue === 0
				? 0
				: Math.max(1, Math.round((entry.value / maxValue) * 20));
		lines.push(
			`- ${entry.label.padEnd(14, " ")} ${"#".repeat(barLength)} (${entry.value})`,
		);
	}
	return lines;
}

function buildCharts(summary) {
	const typeEntries = Object.entries(summary.commitTypes)
		.sort((left, right) => right[1] - left[1])
		.map(([label, value]) => ({ label, value }));
	const dateEntries = Object.entries(summary.commitsByDate)
		.sort((left, right) => left[0].localeCompare(right[0]))
		.map(([label, value]) => ({ label, value }));

	return {
		byType: typeEntries,
		byDate: dateEntries,
		ascii: {
			byType: buildChartLines("Commit Types", typeEntries),
			byDate: buildChartLines("Commits By Date", dateEntries),
		},
	};
}

function materializeCommitDetails(rawCommits, options, dependencies) {
	return rawCommits.map((commit) => {
		const changedFiles = getChangedFiles(
			dependencies.runGit,
			commit.hash,
			dependencies.cwd,
		);
		return {
			...commit,
			bodyPreview: buildCommitBodyPreview(commit.body, options.bodyLines),
			changedFiles,
			packageInfo: getPackageDetails(
				dependencies.runGit,
				commit.hash,
				options.packagePath,
				dependencies.cwd,
			),
			manifestVersions: getManifestVersions(
				dependencies.runGit,
				commit.hash,
				options.manifestPaths,
				dependencies.cwd,
			),
		};
	});
}

function filterCommits(commits, options) {
	if (options.mode !== "versions") {
		return commits;
	}
	return commits.filter((commit) =>
		VERSION_PATTERN.test(`${commit.subject}\n${commit.body}`),
	);
}

function createReport(options, dependencies = {}) {
	const resolvedDependencies = {
		runGit: dependencies.runGit || defaultRunGit,
		cwd: dependencies.cwd || process.cwd(),
		now: dependencies.now || (() => new Date().toISOString()),
	};

	const rawCommits = readCommits(
		resolvedDependencies.runGit,
		options,
		resolvedDependencies.cwd,
	);
	const filtered = filterCommits(rawCommits, options);
	const commits = materializeCommitDetails(
		filtered,
		options,
		resolvedDependencies,
	);
	const summary = summarizeCommits(commits);
	const charts = options.withCharts ? buildCharts(summary) : null;

	return {
		metadata: {
			generatedAt: resolvedDependencies.now(),
			cwd: resolvedDependencies.cwd,
			mode: options.mode,
			format: options.format,
		},
		summary,
		commits,
		charts,
	};
}

function formatVisibleFiles(files, maxFiles) {
	const visible = files.slice(0, maxFiles);
	const lines = visible.map((filePath) => `   - ${filePath}`);
	if (files.length > maxFiles) {
		lines.push(`   - ... (${files.length - maxFiles} more)`);
	}
	return lines;
}

function renderSummaryLines(report) {
	const lines = [];
	lines.push(`Summary: ${report.summary.totalCommits} commit(s)`);
	lines.push(`Version commits: ${report.summary.versionCommits}`);
	lines.push(`Unique files touched: ${report.summary.uniqueFilesTouched}`);
	for (const [type, count] of Object.entries(
		report.summary.commitTypes,
	).sort()) {
		lines.push(`Type ${type}: ${count}`);
	}
	return lines;
}

function renderText(report, options) {
	const lines = [];
	lines.push(`Mode: ${report.metadata.mode}`);
	lines.push(`Format: text`);
	lines.push(`Generated: ${report.metadata.generatedAt}`);
	lines.push(`Total commits: ${report.summary.totalCommits}`);
	lines.push("");

	if (options.ciSummary) {
		lines.push(...renderSummaryLines(report));
		lines.push("");
	}

	for (const commit of report.commits) {
		lines.push(`[${commit.shortHash}] ${commit.date} ${commit.subject}`);
		for (const line of commit.bodyPreview) {
			lines.push(`   ${line}`);
		}
		if (commit.changedFiles.length > 0) {
			lines.push("   Files:");
			lines.push(
				...formatVisibleFiles(commit.changedFiles, options.maxFiles),
			);
		}
		if (commit.packageInfo?.name || commit.packageInfo?.version) {
			lines.push("   Package:");
			if (commit.packageInfo.name) {
				lines.push(`   - name: ${commit.packageInfo.name}`);
			}
			if (commit.packageInfo.version) {
				lines.push(`   - version: ${commit.packageInfo.version}`);
			}
		}
		if (commit.manifestVersions.length > 0) {
			lines.push("   Manifests:");
			for (const manifestVersion of commit.manifestVersions) {
				lines.push(
					`   - ${manifestVersion.path}: ${manifestVersion.version}`,
				);
			}
		}
		lines.push("");
	}

	if (report.charts) {
		lines.push(
			...report.charts.ascii.byType,
			"",
			...report.charts.ascii.byDate,
			"",
		);
	}

	return `${lines.join("\n")}\n`;
}

function renderMarkdown(report, options) {
	const lines = [];
	lines.push("# Commit History Report");
	lines.push("");
	lines.push(`- Mode: ${report.metadata.mode}`);
	lines.push(`- Generated: ${report.metadata.generatedAt}`);
	lines.push(`- Total commits: ${report.summary.totalCommits}`);
	lines.push("");

	if (options.ciSummary) {
		lines.push("## Summary");
		lines.push("");
		for (const line of renderSummaryLines(report)) {
			lines.push(`- ${line}`);
		}
		lines.push("");
	}

	for (const commit of report.commits) {
		lines.push(`## [${commit.shortHash}] ${commit.date} ${commit.subject}`);
		lines.push("");
		for (const line of commit.bodyPreview) {
			lines.push(`- ${line}`);
		}
		if (commit.changedFiles.length > 0) {
			lines.push("");
			lines.push("Files:");
			for (const fileLine of formatVisibleFiles(
				commit.changedFiles,
				options.maxFiles,
			)) {
				lines.push(fileLine.replace(/^\s*/, "- "));
			}
		}
		if (commit.packageInfo?.name || commit.packageInfo?.version) {
			lines.push("");
			lines.push("Package:");
			if (commit.packageInfo.name) {
				lines.push(`- name: ${commit.packageInfo.name}`);
			}
			if (commit.packageInfo.version) {
				lines.push(`- version: ${commit.packageInfo.version}`);
			}
		}
		if (commit.manifestVersions.length > 0) {
			lines.push("");
			lines.push("Manifests:");
			for (const manifestVersion of commit.manifestVersions) {
				lines.push(
					`- ${manifestVersion.path}: ${manifestVersion.version}`,
				);
			}
		}
		lines.push("");
	}

	if (report.charts) {
		lines.push("## Charts");
		lines.push("");
		lines.push("```text");
		lines.push(
			...report.charts.ascii.byType,
			"",
			...report.charts.ascii.byDate,
		);
		lines.push("```");
		lines.push("");
	}

	return `${lines.join("\n")}\n`;
}

function renderJson(report, options) {
	const payload = {
		tool: "commit-history-cli",
		version: "1.0",
		metadata: report.metadata,
		summary: report.summary,
		commits: report.commits,
	};
	if (report.charts) {
		payload.charts = report.charts;
	}
	if (options.mcpOutput) {
		payload.mcp = {
			resource: "commit-history-report",
			contentType: "application/json",
		};
	}
	return `${JSON.stringify(payload, null, 2)}\n`;
}

function renderReport(report, options) {
	if (options.format === "markdown") {
		return renderMarkdown(report, options);
	}
	if (options.format === "json") {
		return renderJson(report, options);
	}
	return renderText(report, options);
}

function writeOutput(text, outputFile) {
	if (!outputFile) {
		process.stdout.write(text);
		return;
	}

	const absolutePath = path.resolve(outputFile);
	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	fs.writeFileSync(absolutePath, text, "utf8");
	process.stdout.write(`Wrote commit history to ${absolutePath}\n`);
}

function main(argv, dependencies = {}) {
	const options = parseArgs(argv);
	if (options.help) {
		process.stdout.write(HELP_TEXT);
		return { options, report: null, output: HELP_TEXT };
	}

	emitLog(
		options,
		"debug",
		`Generating ${options.mode} report in ${options.format} format`,
	);
	const report = createReport(options, dependencies);
	const output = renderReport(report, options);
	writeOutput(output, options.outputFile);
	return { options, report, output };
}

module.exports = {
	DEFAULT_MANIFEST_PATHS,
	DEFAULT_PACKAGE_PATH,
	HELP_TEXT,
	buildCharts,
	createReport,
	defaultRunGit,
	main,
	parseArgs,
	parseCommitType,
	renderReport,
	summarizeCommits,
	writeOutput,
};
