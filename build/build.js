const fs = require("fs");
const path = require("path");

/**
 * Updates the extension version in manifest.json based on package.json
 * @returns {string} The current version
 */
function updateManifestVersion() {
    try {
		// Read package.json to get current version
		const packageJsonPath = path.join(__dirname, "..", "package.json");
		const packageData = JSON.parse(
			fs.readFileSync(packageJsonPath, "utf8")
		);
		const currentVersion = packageData.version;

		// Update manifest.json
		const manifestPath = path.join(__dirname, "..", "src", "manifest.json");
		const manifestData = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
		manifestData.version = currentVersion;
		fs.writeFileSync(
			manifestPath,
			JSON.stringify(manifestData, null, "\t")
		);

		console.log(
			`Manifest version updated successfully to ${currentVersion}`
		);
		return currentVersion;
	} catch (error) {
		console.error("Error updating version in manifest:", error);
		console.error(error.stack);
		throw error;
	}
}

/**
 * Copies necessary files from src to dist for packaging
 */
function copyFilesToDist() {
	const srcDir = path.join(__dirname, "..", "src");
	const distDir = path.join(__dirname, "..", "dist");

	// Ensure dist directory exists
	if (!fs.existsSync(distDir)) {
		fs.mkdirSync(distDir, { recursive: true });
	}

	// Files to copy
	const filesToCopy = [
		{
			from: path.join(srcDir, "manifest.json"),
			to: path.join(distDir, "manifest.json"),
		},
		{ from: path.join(srcDir, "icons"), to: path.join(distDir, "icons") },
		{
			from: path.join(srcDir, "popup", "simple-popup.html"),
			to: path.join(distDir, "popup", "simple-popup.html"),
		},
		{
			from: path.join(srcDir, "popup", "simple-popup.js"),
			to: path.join(distDir, "popup", "simple-popup.js"),
		},
		{
			from: path.join(srcDir, "popup", "popup.js"),
			to: path.join(distDir, "popup", "popup.js"),
		},
		{
			from: path.join(srcDir, "background"),
			to: path.join(distDir, "background"),
		},
		{
			from: path.join(srcDir, "content"),
			to: path.join(distDir, "content"),
		},
		{
			from: path.join(srcDir, "config"),
			to: path.join(distDir, "config"),
		},
		{
			from: path.join(srcDir, "utils"),
			to: path.join(distDir, "utils"),
		},
	];

	filesToCopy.forEach((file) => {
		if (fs.existsSync(file.from) && fs.lstatSync(file.from).isDirectory()) {
			copyDirectory(file.from, file.to);
		} else if (fs.existsSync(file.from)) {
			const parentDir = path.dirname(file.to);
			if (!fs.existsSync(parentDir)) {
				fs.mkdirSync(parentDir, { recursive: true });
			}
			fs.copyFileSync(file.from, file.to);
			console.log(`Copied: ${file.from} -> ${file.to}`);
		} else {
			console.warn(
				`Warning: Source file or directory does not exist: ${file.from}`
			);
		}
	});
}

/**
 * Helper function to copy a directory recursively
 */
function copyDirectory(source, destination) {
	if (!fs.existsSync(destination)) {
		fs.mkdirSync(destination, { recursive: true });
	}

	const entries = fs.readdirSync(source, { withFileTypes: true });

	for (const entry of entries) {
		const sourcePath = path.join(source, entry.name);
		const destPath = path.join(destination, entry.name);

		if (entry.isDirectory()) {
			copyDirectory(sourcePath, destPath);
		} else {
			fs.copyFileSync(sourcePath, destPath);
			console.log(`Copied: ${sourcePath} -> ${destPath}`);
		}
	}
}

/**
 * Packages the extension for distribution
 */
function packageExtension() {
	try {
		// First update the version
		const version = updateManifestVersion();

		// Then copy files to dist directory
		console.log("Copying files to dist directory...");
		copyFilesToDist();

		console.log(
			`Extension packaging completed successfully! Version: ${version}`
		);
		return version;
	} catch (error) {
		console.error("Extension packaging failed:", error);
		throw error;
	}
}

// Run the function if this script is executed directly
if (require.main === module) {
	try {
		packageExtension();
	} catch (error) {
		console.error("Build process failed:", error);
		process.exit(1);
	}
}

module.exports = {
	updateManifestVersion,
	copyFilesToDist,
	packageExtension,
};
