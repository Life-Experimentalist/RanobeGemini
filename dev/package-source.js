#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

// Check and install archiver if needed.
// Returns the ZipArchive class: archiver 8 is ESM and dropped the callable
// `archiver("zip", opts)` default export in favour of named format classes.
function ensureArchiver() {
	try {
		return require("archiver").ZipArchive;
	} catch (e) {
		console.log("⚠️  archiver not found. Installing...");
		const { execSync } = require("child_process");
		execSync("npm install archiver --save-dev", { stdio: "inherit" });
		console.log("✅ archiver installed successfully");
		return require("archiver").ZipArchive;
	}
}

// Find root directory
function findRootDir() {
	let currentDir = __dirname;
	while (currentDir !== path.dirname(currentDir)) {
		if (fs.existsSync(path.join(currentDir, "package.json"))) {
			return currentDir;
		}
		currentDir = path.dirname(currentDir);
	}
	throw new Error("Could not find project root");
}

const ROOT_DIR = findRootDir();
const RELEASES_DIR = path.join(ROOT_DIR, "releases/source");

// Get version and name from package.json
function getExtensionInfo() {
	const packagePath = path.join(ROOT_DIR, "package.json");
	const packageData = JSON.parse(fs.readFileSync(packagePath, "utf8"));
	return {
		version: packageData.version,
		name: packageData.name.replace(/\s+/g, ""),
	};
}

// Create source package zip
async function packageSource() {
	const ZipArchive = ensureArchiver();

	console.log("📦 Packaging source code for AMO submission...\n");

	const { version, name } = getExtensionInfo();
	console.log(`Name:    ${name}`);
	console.log(`Version: ${version}`);

	// Ensure releases directory exists
	if (!fs.existsSync(RELEASES_DIR)) {
		fs.mkdirSync(RELEASES_DIR, { recursive: true });
	}

	const outputFileName = `${
		name.charAt(0).toUpperCase() + name.slice(1)
	}_v${version}_source.zip`;
	const outputPath = path.join(RELEASES_DIR, outputFileName);

	// Remove existing source zip if present
	if (fs.existsSync(outputPath)) {
		fs.unlinkSync(outputPath);
		console.log(`♻️  Removed previous source package: ${outputFileName}`);
	}

	// Files and directories to include
	const includes = [
		"src/",
		"dev/",
		".github/",
		"docs/",
		"package.json",
		"package-lock.json",
		"LICENSE.md",
		"README.md",
		".editorconfig",
		// REVIEWER NOTES.md tells reviewers to run `npm run lint`, which is
		// `eslint src/**/*.js` and reads its rules from eslint.config.mjs (the
		// flat config that replaced .eslintrc.json in the ESLint 10 upgrade).
		// Without these two the instruction fails on a clean unzip of this
		// very archive.
		"eslint.config.mjs",
		".prettierrc",
		"REVIEWER NOTES.md",
	];

	// The include list is an allowlist of *directories*, which does not stop
	// untracked working files living inside one of them from being swept in —
	// `docs/guides/last prompt.md` is half a megabyte of local scratch sitting in
	// `docs/`, gitignored but very much on disk. These are the same patterns
	// .gitignore excludes, applied again here because a source archive built from
	// a working tree is not the same thing as a git export.
	const isScratch = (entryName) => {
		const p = entryName.replace(/\\/g, "/");
		return (
			/(^|\/)last prompt\.md$/i.test(p) ||
			/\.scratch\.md$/i.test(p) ||
			/(^|\/)(node_modules|\.tmp|scratch|sample)(\/|$)/.test(p) ||
			/(^|\/)\.(DS_Store|graphify_.*)$/i.test(p) ||
			/(^|\/)(desktop\.ini|Thumbs\.db)$/i.test(p)
		);
	};

	return new Promise((resolve, reject) => {
		const output = fs.createWriteStream(outputPath);
		const archive = new ZipArchive({ zlib: { level: 9 } });

		output.on("close", () => {
			const sizeInMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
			console.log("\n🎉 Source code packaged successfully!");
			console.log(`Name:    ${outputFileName}`);
			console.log(`Path:    ${outputPath}`);
			console.log(`Size:    ${sizeInMB} MB`);
			console.log(
				"\n💡 Upload this ZIP file when AMO asks for source code submission."
			);
			resolve();
		});

		archive.on("error", (err) => {
			reject(err);
		});

		archive.pipe(output);

		console.log("\n📋 Adding files to source package...");

		// Add each item
		includes.forEach((item) => {
			const itemPath = path.join(ROOT_DIR, item);
			if (fs.existsSync(itemPath)) {
				const stats = fs.statSync(itemPath);
				if (stats.isDirectory()) {
					archive.directory(itemPath, item, (entry) =>
						isScratch(entry.name) ? false : entry,
					);
					console.log(`  ✓ ${item}`);
				} else {
					archive.file(itemPath, { name: item });
					console.log(`  ✓ ${item}`);
				}
			} else {
				console.log(`  ⚠ ${item} not found, skipping`);
			}
		});

		archive.finalize();
	});
}

// Run if executed directly
if (require.main === module) {
	packageSource().catch((error) => {
		console.error("❌ Error packaging source:", error.message);
		process.exit(1);
	});
}

module.exports = { packageSource };
