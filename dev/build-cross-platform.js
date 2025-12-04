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
 * Copy directory recursively
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
		}
	}
}

/**
 * Create Firefox-compatible manifest
 */
function createFirefoxManifest(baseManifest) {
	const manifest = JSON.parse(JSON.stringify(baseManifest)); // Deep clone

	// Firefox supports both service_worker and scripts, keep as is
	// Ensure browser_specific_settings is present
	if (!manifest.browser_specific_settings) {
		manifest.browser_specific_settings = {
			gecko: {
				id: "{33b0347d-8e94-40d6-a169-249716997cc6}",
				strict_min_version: "109.0",
			},
			gecko_android: {
				strict_min_version: "120.0",
			},
		};
	}

	return manifest;
}

/**
 * Create Chrome-compatible manifest
 */
function createChromeManifest(baseManifest) {
	const manifest = JSON.parse(JSON.stringify(baseManifest)); // Deep clone

	// Remove Firefox-specific settings
	delete manifest.browser_specific_settings;

	// Chrome MV3 only supports service_worker, not scripts array
	if (manifest.background && manifest.background.scripts) {
		delete manifest.background.scripts;
	}

	// Remove browser_style if present (Firefox-specific)
	if (manifest.action && manifest.action.browser_style !== undefined) {
		delete manifest.action.browser_style;
	}

	// Remove theme_icons (Firefox-specific)
	if (manifest.action && manifest.action.theme_icons) {
		delete manifest.action.theme_icons;
	}

	return manifest;
}

/**
 * Build for a specific platform
 */
function buildForPlatform(platform) {
	console.log(`\n🔨 Building for ${platform}...`);

	const srcDir = path.join(ROOT_DIR, "src");
	const distDir = path.join(ROOT_DIR, "dist", `dist-${platform}`);

	// Clean and create dist directory
	if (fs.existsSync(distDir)) {
		fs.rmSync(distDir, { recursive: true, force: true });
	}
	fs.mkdirSync(distDir, { recursive: true });

	// Read version from package.json
	const packageJson = JSON.parse(
		fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8")
	);
	const version = packageJson.version;

	// Read base manifest
	const baseManifestPath = path.join(srcDir, "manifest.json");
	const baseManifest = JSON.parse(fs.readFileSync(baseManifestPath, "utf8"));

	// Update version
	baseManifest.version = version;

	// Create platform-specific manifest
	const platformManifest =
		platform === "firefox"
			? createFirefoxManifest(baseManifest)
			: createChromeManifest(baseManifest);

	// Write manifest
	fs.writeFileSync(
		path.join(distDir, "manifest.json"),
		JSON.stringify(platformManifest, null, "\t")
	);
	console.log(`✅ Created ${platform} manifest.json`);

	// Copy all directories and files except manifest.json
	const itemsToCopy = [
		"icons",
		"popup",
		"background",
		"content",
		"config",
		"utils",
		"library",
		"lib", // Include browser-polyfill
	];

	itemsToCopy.forEach((item) => {
		const sourcePath = path.join(srcDir, item);
		const destPath = path.join(distDir, item);

		if (fs.existsSync(sourcePath)) {
			if (fs.lstatSync(sourcePath).isDirectory()) {
				copyDirectory(sourcePath, destPath);
				console.log(`✅ Copied ${item}/ directory`);
			} else {
				const parentDir = path.dirname(destPath);
				if (!fs.existsSync(parentDir)) {
					fs.mkdirSync(parentDir, { recursive: true });
				}
				fs.copyFileSync(sourcePath, destPath);
				console.log(`✅ Copied ${item} file`);
			}
		} else {
			console.warn(`⚠️  ${item} not found, skipping...`);
		}
	});

	console.log(`✅ ${platform} build completed: ${distDir}`);
	return distDir;
}

/**
 * Clean the dist directory before building
 */
function cleanDist() {
	const distDir = path.join(ROOT_DIR, "dist");
	if (fs.existsSync(distDir)) {
		fs.rmSync(distDir, { recursive: true, force: true });
		console.log("🧹 Cleaned dist/ directory");
	}
}

/**
 * Build for all platforms
 */
function buildAll() {
	console.log("🚀 Starting cross-platform build...\n");

	try {
		// Clean dist folder first
		cleanDist();

		const firefoxDist = buildForPlatform("firefox");
		const chromiumDist = buildForPlatform("chromium");

		console.log("\n✨ Cross-platform build completed successfully!");
		console.log(`\nFirefox build:  ${firefoxDist}`);
		console.log(`Chromium build: ${chromiumDist}`);
		console.log("\n🧪 To test in Edge/Chrome (load unpacked extension):");
		console.log(`   ${chromiumDist}`);
		console.log("\n🧪 To test in Firefox (load temporary add-on):");
		console.log(`   ${firefoxDist}`);
		console.log("\n📦 To package for distribution:");
		console.log("   npm run package-all");
		console.log("   npm run package-firefox");
		console.log("   npm run package-chromium");

		return { firefox: firefoxDist, chromium: chromiumDist };
	} catch (error) {
		console.error("\n❌ Build failed:", error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

// Run if called directly
if (require.main === module) {
	buildAll();
}

module.exports = {
	buildForPlatform,
	buildAll,
	createFirefoxManifest,
	createChromeManifest,
};
