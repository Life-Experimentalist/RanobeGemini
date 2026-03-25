const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const docsDir = path.join(repoRoot, "docs");
const pkg = require(path.join(repoRoot, "package.json"));
const version = pkg.version || "0.0.0";
const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function walk(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const e of entries) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) walk(full);
		else if (e.isFile() && full.endsWith(".md")) updateFile(full);
	}
}

function updateFile(filePath) {
	const rel = path.relative(docsDir, filePath).replace(/\\/g, "/");
	// Skip release notes and commit history files (historic records)
	if (
		rel.startsWith("release/") ||
		/RELEASE_NOTES_/i.test(path.basename(filePath)) ||
		/commit-history/i.test(path.basename(filePath))
	) {
		return;
	}
	let src = fs.readFileSync(filePath, "utf8");
	let out = src;

	// Replace specific historical version tokens (v4.4.0) -> current version
	out = out.replace(/v4\.4\.0/g, `v${version}`);
	out = out.replace(/v4\.4/g, `v${version.replace(/\.\d+$/, "")}`);

	// Replace Last updated patterns (preserve original capitalization)
	out = out.replace(/\*\*Last Updated:\*\*\s*.*$/im, `**Last Updated:** ${today}`);
	out = out.replace(/\*\*Last updated:\*\*\s*.*$/im, `**Last updated:** ${today}`);
	out = out.replace(/Last Updated:\s*.*$/im, `Last Updated: ${today}`);
	out = out.replace(/Last updated:\s*.*$/im, `Last updated: ${today}`);

	if (out !== src) {
		fs.writeFileSync(filePath, out, "utf8");
		console.log(`Updated ${path.relative(repoRoot, filePath)}`);
	}
}

console.log("Running docs version sync...");
console.log("Target version:", version);
console.log("Date stamp:", today);
walk(docsDir);
console.log("Done. Please review changes and commit.");
