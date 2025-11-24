#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { platform } = require("os");

// Configuration
const SOURCE_DIR = "../src";
const RELEASES_DIR = "../releases";
const EXCLUDE_PATTERNS = ["node_modules/**", "*.tmp", "*.log", ".DS_Store"];

// Check and install dependencies automatically
function ensureDependencies() {
	try {
		require.resolve("archiver");
	} catch (e) {
		console.log("⚠️  archiver not found. Installing...");
		try {
			execSync("npm install archiver --save-dev", { stdio: "inherit" });
			console.log("✅ archiver installed successfully");
			// Re-require after installation
			return require("archiver");
		} catch (installError) {
			console.error(
				"❌ Failed to install archiver:",
				installError.message
			);
			process.exit(1);
		}
	}
	return require("archiver");
}

// Cross-platform path handling
const resolvePath = (...segments) => path.resolve(__dirname, ...segments);

// Get extension info from manifest
function getExtensionInfo() {
	try {
		const manifestPath = resolvePath(SOURCE_DIR, "manifest.json");
		const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

		if (!manifest.version) throw new Error("Version missing in manifest");
		if (!manifest.name) throw new Error("Name missing in manifest");

		return {
			version: manifest.version,
			name: manifest.name.replace(/\s+/g, ""), // Remove spaces
		};
	} catch (error) {
		console.error(`❌ Error reading manifest: ${error.message}`);
		process.exit(1);
	}
}

// Main packaging function
async function packageExtension() {
	const archiver = ensureDependencies();
	const { name, version } = getExtensionInfo();
	const packageName = `${name}_v${version}.zip`;
	const outputPath = resolvePath(RELEASES_DIR, packageName);

	// Ensure releases directory exists
	if (!fs.existsSync(resolvePath(RELEASES_DIR))) {
		fs.mkdirSync(resolvePath(RELEASES_DIR), { recursive: true });
	}

	// Remove existing package if present
	if (fs.existsSync(outputPath)) {
		fs.unlinkSync(outputPath);
		console.log(`♻️  Removed previous package: ${packageName}`);
	}

	const output = fs.createWriteStream(outputPath);
	const archive = archiver("zip", { zlib: { level: 9 } });

	return new Promise((resolve, reject) => {
		output.on("close", () => {
			const sizeMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
			console.log(`
            🎉 Successfully packaged!
            Name:    ${name}
            Version: ${version}
            Path:    ${outputPath}
            Size:    ${sizeMB} MB
            OS:      ${platform()}
            `);
			resolve();
		});

		archive.on("error", (err) => reject(err));
		archive.pipe(output);
		archive.glob("**/*", {
			cwd: resolvePath(SOURCE_DIR),
			ignore: EXCLUDE_PATTERNS,
			dot: true,
		});
		archive.finalize();
	});
}

// Run with error handling
packageExtension().catch((err) => {
	console.error("❌ Packaging failed:", err.message);
	process.exit(1);
});
