#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { platform } = require("os");

// Configuration
const SOURCE_DIR = "../dist/dist-chromium";
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

		if (!fs.existsSync(manifestPath)) {
			throw new Error(
				`Manifest not found. Please run 'npm run build' first to create the dist-chromium folder.`
			);
		}

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
	const packageName = `${name}_v${version}_chromium.zip`;
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
🎉 Successfully packaged for Chromium/Chrome/Edge!
Name:    ${name}
Version: ${version}
Path:    ${outputPath}
Size:    ${sizeMB} MB
OS:      ${platform()}

📝 Next steps for Chrome Web Store:
1. Go to https://chrome.google.com/webstore/devconsole
2. Upload ${packageName}
3. Fill in store listing details
4. Submit for review
			`);
			resolve();
		});

		output.on("error", (err) => reject(err));
		archive.on("error", (err) => reject(err));
		archive.on("warning", (err) => {
			if (err.code !== "ENOENT") reject(err);
		});

		archive.pipe(output);
		archive.glob("**/*", {
			cwd: resolvePath(SOURCE_DIR),
			ignore: EXCLUDE_PATTERNS,
			dot: true,
		});
		archive.finalize();
	});
}

// Run if executed directly
if (require.main === module) {
	packageExtension().catch((error) => {
		console.error("❌ Packaging failed:", error);
		process.exit(1);
	});
}

module.exports = { packageExtension };
