const fs = require("fs");
const path = require("path");

// Find root directory by looking for package.json
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

/**
 * Updates the extension version in manifest.json based on package.json
 * @returns {string} The current version
 */
function updateManifestVersion() {
	try {
		const packageJsonPath = path.join(ROOT_DIR, "package.json");
		const packageData = JSON.parse(
			fs.readFileSync(packageJsonPath, "utf8")
		);
		const currentVersion = packageData.version;

		const manifestPath = path.join(ROOT_DIR, "src", "manifest.json");
		const manifestData = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

		// Only write if version actually changed
		if (manifestData.version !== currentVersion) {
			manifestData.version = currentVersion;
			fs.writeFileSync(
				manifestPath,
				JSON.stringify(manifestData, null, "\t")
			);
			console.log(
				`Manifest version updated successfully to ${currentVersion}`
			);
		} else {
			console.log(
				`Manifest version already up to date: ${currentVersion}`
			);
		}

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
	const srcDir = path.join(ROOT_DIR, "src");
	const distDir = path.join(ROOT_DIR, "dist");

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
			from: path.join(srcDir, "popup", "popup.html"),
			to: path.join(distDir, "popup", "popup.html"),
		},
		{
			from: path.join(srcDir, "popup", "popup.js"),
			to: path.join(distDir, "popup", "popup.js"),
		},
		{
			from: path.join(srcDir, "popup", "popup.css"),
			to: path.join(distDir, "popup", "popup.css"),
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
		{
			from: path.join(srcDir, "library"),
			to: path.join(distDir, "library"),
		},
		{
			from: path.join(srcDir, "lib"),
			to: path.join(distDir, "lib"),
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
		const version = updateManifestVersion();
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
