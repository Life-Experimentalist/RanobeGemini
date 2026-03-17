#!/usr/bin/env node

/**
 * Print commit history with version details, matching file changes.
 * Usage:
 *   node dev/commit-history.js --all
 *   node dev/commit-history.js --versions (show commits with version changes + package/manifest diffs)
 *   node dev/commit-history.js --all --output commits.md
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = new Set(process.argv.slice(2));
const mode = args.has("--versions") ? "versions" : "all";

let outputFile = null;
for (let i = 2; i < process.argv.length; i += 1) {
	if (process.argv[i] === "--output" && process.argv[i + 1]) {
		outputFile = process.argv[i + 1];
		break;
	}
}

const raw = execSync(
	'git log --date=short --pretty=format:"%H%x1f%h%x1f%ad%x1f%s%x1f%B%x1e"',
	{ encoding: "utf8" },
);

const versionPattern = /\bv?\d+\.\d+\.\d+\b/i;

const commits = raw
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
		};
	});

const filtered =
	mode === "versions"
		? commits.filter((c) => versionPattern.test(`${c.subject}\n${c.body}`))
		: commits;

const lines = [];
lines.push(`Mode: ${mode}`);
lines.push(`Total commits: ${filtered.length}`);
lines.push("");

function extractPackageJsonVersion(commitHash) {
	try {
		const pkgJson = execSync(
			`git show ${commitHash}:package.json 2>/dev/null || echo ""`,
			{
				encoding: "utf8",
			},
		).trim();
		if (!pkgJson) return null;
		const match = pkgJson.match(/"version":\s*"([^"]+)"/);
		return match ? match[1] : null;
	} catch {
		return null;
	}
}

function getPackageJsonDiff(commitHash) {
	try {
		const diff = execSync(
			`git show ${commitHash}:package.json 2>/dev/null | grep -E '"(version|name)"' || echo ""`,
			{
				encoding: "utf8",
			},
		).trim();
		return diff ? diff.split("\n").slice(0, 3).join("\n") : null;
	} catch {
		return null;
	}
}

function getManifestInfo(commitHash) {
	try {
		// Try to get Firefox manifest version
		const firefoxManifest = execSync(
			`git show ${commitHash}:src/manifest-firefox.json 2>/dev/null | grep -i '"version"' || echo ""`,
			{ encoding: "utf8" },
		).trim();
		return firefoxManifest || null;
	} catch {
		return null;
	}
}

for (const commit of filtered) {
	lines.push(`\n📌 [${commit.shortHash}] ${commit.date} ${commit.subject}`);

	if (commit.body) {
		// Show first few lines of body
		const bodyLines = commit.body.split("\n");
		for (let i = 0; i < Math.min(bodyLines.length, 8); i++) {
			if (bodyLines[i].trim()) {
				lines.push(`   ${bodyLines[i]}`);
			}
		}
		if (bodyLines.length > 8) {
			lines.push(`   ... (${bodyLines.length - 8} more lines)`);
		}
	}

	// Extract version info for version-related commits
	const version = extractPackageJsonVersion(commit.hash);
	if (version) {
		lines.push(`\n   📦 Version: ${version}`);

		const pkgDiff = getPackageJsonDiff(commit.hash);
		if (pkgDiff) {
			lines.push(`   Package.json changes:`);
			lines.push(`   ${pkgDiff.split("\n").join("\n   ")}`);
		}

		const manifestInfo = getManifestInfo(commit.hash);
		if (manifestInfo) {
			lines.push(`   Manifest updated: ${manifestInfo.trim()}`);
		}
	}

	lines.push("");
}

const text = `${lines.join("\n")}\n`;

if (outputFile) {
	const abs = path.resolve(outputFile);
	fs.mkdirSync(path.dirname(abs), { recursive: true });
	fs.writeFileSync(abs, text, "utf8");
	console.log(`Wrote commit history to ${abs}`);
} else {
	process.stdout.write(text);
}
