#!/usr/bin/env node

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_BODY_LINES = 8;
const DEFAULT_MAX_FILES = 6;
const VERSION_PATTERN = /\bv?\d+\.\d+\.\d+\b/i;
const DEFAULT_MANIFEST_PATHS = [
	"src/manifest-firefox.json",
	"src/manifest-chromium.json",
	"src/library/manifest.webmanifest",
];

function toNumber(value, fallback) {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv) {
	const options = {
		mode: "all",
		format: "text",
		output: null,
		limit: null,
		since: null,
		until: null,
		bodyLines: DEFAULT_BODY_LINES,
		maxFiles: DEFAULT_MAX_FILES,
		packagePath: "package.json",
		manifestPaths: [...DEFAULT_MANIFEST_PATHS],
		noMerges: false,
		mcpOutput: false,
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--all") {
			options.mode = "all";
			continue;
		}
		if (arg === "--versions") {
			options.mode = "versions";
			continue;
		}
		if (arg === "--output" && argv[i + 1]) {
			options.output = argv[++i];
			continue;
		}
		if (arg === "--format" && argv[i + 1]) {
			const value = argv[++i].toLowerCase();
			if (["text", "markdown", "json"].includes(value)) {
				options.format = value;
			}
			continue;
		}
		if (arg === "--limit" && argv[i + 1]) {
			options.limit = toNumber(argv[++i], null);
			continue;
		}
		if (arg === "--since" && argv[i + 1]) {
			options.since = argv[++i];
			continue;
		}
		if (arg === "--until" && argv[i + 1]) {
			options.until = argv[++i];
			continue;
		}
		if (arg === "--body-lines" && argv[i + 1]) {
			options.bodyLines = toNumber(argv[++i], DEFAULT_BODY_LINES);
			continue;
		}
		if (arg === "--max-files" && argv[i + 1]) {
			options.maxFiles = toNumber(argv[++i], DEFAULT_MAX_FILES);
			continue;
		}
		if (arg === "--package-path" && argv[i + 1]) {
			options.packagePath = argv[++i];
			continue;
		}
		if (arg === "--manifest-path" && argv[i + 1]) {
			options.manifestPaths.push(argv[++i]);
			continue;
		}
		if (arg === "--no-merges") {
			options.noMerges = true;
			continue;
		}
		if (arg === "--mcp-output") {
			options.mcpOutput = true;
			continue;
		}
	}

	return options;
}

function tryRunGit(command) {
	try {
		return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
	} catch {
		return "";
	}
}

function readJsonAtCommit(commitHash, filePath) {
	const safePath = filePath.replace(/"/g, "");
	const output = tryRunGit(`git show ${commitHash}:${safePath}`);
	if (!output.trim()) {
		return null;
	}
	try {
		return JSON.parse(output);
	} catch {
		return null;
	}
}

function getChangedFiles(commitHash) {
	const output = tryRunGit(`git show --name-only --pretty="" ${commitHash}`);
	return output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

function getCommits(options) {
	const logParts = [
		"git log",
		'--date=short',
		'--pretty=format:"%H%x1f%h%x1f%ad%x1f%s%x1f%B%x1e"',
	];
	if (options.noMerges) {
		logParts.push("--no-merges");
	}
	if (options.since) {
		logParts.push(`--since="${options.since.replace(/"/g, "")}"`);
	}
	if (options.until) {
		logParts.push(`--until="${options.until.replace(/"/g, "")}"`);
	}
	if (options.limit) {
		logParts.push(`-n ${options.limit}`);
	}

	const raw = tryRunGit(logParts.join(" "));
	const commits = raw
		.split("\x1e")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => {
			const [hash, shortHash, date, subject, body] = entry.split("\x1f");
			const packageJson = readJsonAtCommit(hash, options.packagePath);
			const manifestVersions = {};
			for (const manifestPath of options.manifestPaths) {
				const manifest = readJsonAtCommit(hash, manifestPath);
				if (manifest && typeof manifest.version === "string") {
					manifestVersions[manifestPath] = manifest.version;
				}
			}

			return {
				hash,
				shortHash,
				date,
				subject: (subject || "").trim(),
				body: (body || "").trim(),
				files: getChangedFiles(hash),
				packageInfo:
					packageJson && (packageJson.name || packageJson.version)
						? {
							name: packageJson.name || null,
							version: packageJson.version || null,
						}
						: null,
				manifestVersions,
			};
		});

	if (options.mode === "versions") {
		return commits.filter((commit) => VERSION_PATTERN.test(`${commit.subject}\n${commit.body}`));
	}

	return commits;
}

function renderText(commits, options) {
	const lines = [];
	lines.push(`Mode: ${options.mode}`);
	lines.push(`Format: text`);
	lines.push(`Generated: ${new Date().toISOString()}`);
	lines.push(`Total commits: ${commits.length}`);
	lines.push("");

	for (const commit of commits) {
		lines.push(`[${commit.shortHash}] ${commit.date} ${commit.subject}`);

		if (commit.body) {
			const bodyLines = commit.body
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(Boolean)
				.slice(0, options.bodyLines);
			for (const line of bodyLines) {
				lines.push(`   ${line}`);
			}
		}

		if (commit.files.length > 0) {
			lines.push("   Files:");
			const shown = commit.files.slice(0, options.maxFiles);
			for (const file of shown) {
				lines.push(`   - ${file}`);
			}
			if (commit.files.length > shown.length) {
				lines.push(`   - ... (${commit.files.length - shown.length} more)`);
			}
		}

		if (commit.packageInfo) {
			lines.push("   Package:");
			if (commit.packageInfo.name) lines.push(`   - name: ${commit.packageInfo.name}`);
			if (commit.packageInfo.version) lines.push(`   - version: ${commit.packageInfo.version}`);
		}

		const manifests = Object.entries(commit.manifestVersions);
		if (manifests.length > 0) {
			lines.push("   Manifests:");
			for (const [manifestPath, version] of manifests) {
				lines.push(`   - ${manifestPath}: ${version}`);
			}
		}

		lines.push("");
	}

	return `${lines.join("\n")}\n`;
}

function renderMarkdown(commits, options) {
	const lines = [];
	lines.push(`# Commit History`);
	lines.push("");
	lines.push(`- Mode: ${options.mode}`);
	lines.push(`- Format: markdown`);
	lines.push(`- Generated: ${new Date().toISOString()}`);
	lines.push(`- Total commits: ${commits.length}`);
	lines.push("");

	for (const commit of commits) {
		lines.push(`## ${commit.shortHash} - ${commit.date}`);
		lines.push("");
		lines.push(`**${commit.subject}**`);
		lines.push("");

		const bodyLines = commit.body
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)
			.slice(0, options.bodyLines);
		for (const line of bodyLines) {
			lines.push(`- ${line}`);
		}

		if (commit.files.length > 0) {
			lines.push("");
			lines.push(`### Files`);
			for (const file of commit.files.slice(0, options.maxFiles)) {
				lines.push(`- ${file}`);
			}
		}

		lines.push("");
	}

	return `${lines.join("\n")}\n`;
}

function buildJsonPayload(commits, options) {
	const payload = {
		mode: options.mode,
		format: "json",
		generated: new Date().toISOString(),
		totalCommits: commits.length,
		commits,
	};

	if (options.mcpOutput) {
		return {
			schema: "ranobe-gemini.commit-history.v1",
			generated: payload.generated,
			data: payload,
		};
	}

	return payload;
}

function writeOutput(content, outputPath) {
	if (!outputPath) {
		process.stdout.write(content);
		return;
	}
	const absolute = path.resolve(outputPath);
	fs.mkdirSync(path.dirname(absolute), { recursive: true });
	fs.writeFileSync(absolute, content, "utf8");
	console.log(`Wrote commit history to ${absolute}`);
}

function main(argv) {
	const options = parseArgs(argv);
	const commits = getCommits(options);

	if (options.format === "json") {
		const jsonText = `${JSON.stringify(buildJsonPayload(commits, options), null, 2)}\n`;
		writeOutput(jsonText, options.output);
		return;
	}

	if (options.format === "markdown") {
		writeOutput(renderMarkdown(commits, options), options.output);
		return;
	}

	writeOutput(renderText(commits, options), options.output);
}

main(process.argv.slice(2));
