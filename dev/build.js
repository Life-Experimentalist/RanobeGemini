/**
 * Unified Build System for Ranobe Gemini
 * Handles domain updates, registry generation, building, and packaging.
 *
 * Usage:
 *   node dev/build.js [options]
 *
 * Options:
 *   --firefox      Build for Firefox
 *   --chromium     Build for Chromium
 *   --all          Build for all platforms (default)
 *   --package      Package the build into a ZIP file
 *   --source       Package the source code
 *   --update       Update manifest domains from handlers
 *   --clean        Clean dist and releases folders
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const dotenv = require("dotenv");

// Configuration
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const RELEASES_DIR = path.join(ROOT_DIR, "releases");
const HANDLERS_DIR = path.join(SRC_DIR, "utils", "website-handlers");
const CONSTANTS_FILE = path.join(SRC_DIR, "utils", "constants.js");

// Load local environment variables for build-time secret injection.
dotenv.config({ path: path.join(ROOT_DIR, ".env") });

const ASSETS_TO_COPY = [
	"icons",
	"popup",
	"background",
	"content",
	"config",
	"utils",
	"library",
	"lib",
];

const BUILD_SECRET_ENV_MAP = [
	{
		envKey: "RG_DRIVE_CLIENT_ID",
		constName: "DEFAULT_DRIVE_CLIENT_ID",
	},
	{
		envKey: "RG_DRIVE_CLIENT_SECRET",
		constName: "DEFAULT_DRIVE_CLIENT_SECRET",
	},
	{
		envKey: "RG_TELEMETRY_ENDPOINT",
		constName: "TELEMETRY_ENDPOINT",
	},
];

const REQUIRED_BUILD_SECRET_ENV_KEYS = (
	process.env.RG_REQUIRED_BUILD_SECRETS || ""
)
	.split(",")
	.map((key) => key.trim())
	.filter(Boolean);

const TRANSIENT_COPY_ERRORS = new Set(["EPERM", "EBUSY", "EACCES"]);

function copyFileWithRetries(srcPath, destPath, maxAttempts = 5) {
	let lastError = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			fs.copyFileSync(srcPath, destPath);
			return;
		} catch (error) {
			lastError = error;

			if (
				!TRANSIENT_COPY_ERRORS.has(error?.code) ||
				attempt >= maxAttempts
			) {
				break;
			}

			try {
				if (fs.existsSync(destPath)) {
					fs.rmSync(destPath, { force: true });
				}
			} catch (_cleanupError) {
				// Best-effort cleanup for transient file locks.
			}

			try {
				const buffer = fs.readFileSync(srcPath);
				fs.writeFileSync(destPath, buffer);
				return;
			} catch (_fallbackError) {
				// Continue retry loop.
			}
		}
	}

	if (lastError) {
		throw lastError;
	}
}

// Helper: Copy directory recursively
function copyDir(src, dest) {
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}
	const entries = fs.readdirSync(src, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDir(srcPath, destPath);
		} else {
			copyFileWithRetries(srcPath, destPath);
		}
	}
}

function validateHandlerFileContract(handlerFileName) {
	const filePath = path.join(HANDLERS_DIR, handlerFileName);
	const source = fs.readFileSync(filePath, "utf8");
	const issues = [];

	if (!/class\s+[A-Za-z_$][\w$]*\s+extends\s+[A-Za-z_$][\w$]*/.test(source)) {
		issues.push(
			"must define a handler class that extends a parent handler class",
		);
	}

	if (!/canHandle\s*\(/.test(source)) {
		issues.push("missing required method: canHandle()");
	}

	if (!/extractTitle\s*\(/.test(source)) {
		issues.push("missing required method: extractTitle()");
	}

	const supportedDomainsMatch = source.match(
		/static\s+SUPPORTED_DOMAINS\s*=\s*\[([\s\S]*?)\]/,
	);
	if (!supportedDomainsMatch) {
		issues.push("missing required static field: SUPPORTED_DOMAINS[]");
	} else {
		const domainLiterals =
			supportedDomainsMatch[1].match(/"([^"]+)"|'([^']+)'/g) || [];
		if (domainLiterals.length === 0) {
			issues.push("SUPPORTED_DOMAINS[] must contain at least one domain");
		}
	}

	if (issues.length > 0) {
		return {
			file: handlerFileName,
			issues,
		};
	}

	return null;
}

function validateHandlerContracts(handlerFiles) {
	const failures = [];

	for (const handlerFileName of handlerFiles) {
		const failure = validateHandlerFileContract(handlerFileName);
		if (failure) {
			failures.push(failure);
		}
	}

	if (failures.length === 0) {
		console.log(
			`✅ Handler contract validation passed for ${handlerFiles.length} handler(s).`,
		);
		return;
	}

	console.error("❌ Handler contract validation failed:");
	for (const failure of failures) {
		console.error(`  - ${failure.file}`);
		for (const issue of failure.issues) {
			console.error(`    • ${issue}`);
		}
	}

	throw new Error(
		`Handler validation failed for ${failures.length} file(s). Fix contract issues before building.`,
	);
}

// Task: Generate Handler Registry
function generateHandlerRegistry() {
	console.log("📂 Generating handler registry...");
	const handlerFiles = fs
		.readdirSync(HANDLERS_DIR)
		.filter(
			(file) =>
				file.endsWith("-handler.js") && file !== "base-handler.js",
		)
		.sort();

	validateHandlerContracts(handlerFiles);

	const registryPath = path.join(HANDLERS_DIR, "handler-registry.js");
	const registryContent = `// AUTO-GENERATED LIST OF WEBSITE HANDLER MODULE PATHS
// Generated by dev/build.js
export const HANDLER_MODULES = [
${handlerFiles.map((f) => `	"${f}",`).join("\n")}
];
`;

	fs.writeFileSync(registryPath, registryContent, "utf8");
	console.log(
		`✅ Handler registry updated: ${handlerFiles.length} handler(s) registered.`,
	);
}

// Task: Update Domains
function updateDomains() {
	console.log("🔍 Updating manifest domains...");
	try {
		// We run the script directly to ensure it uses its own logic
		execSync(
			`node "${path.join(__dirname, "generate-manifest-domains.js")}"`,
			{ stdio: "inherit" },
		);
		console.log("✅ Domains updated successfully.");
	} catch (error) {
		console.error("❌ Failed to update domains:", error.message);
	}
}

// Task: Clean
function clean() {
	console.log("🧹 Cleaning build folders...");
	if (fs.existsSync(DIST_DIR)) {
		fs.rmSync(DIST_DIR, { recursive: true, force: true });
		console.log("✅ Cleaned dist/");
	}
}

// Guardrail: source constants should not contain hardcoded secrets.
function assertNoHardcodedSecretsInSource() {
	if (!fs.existsSync(CONSTANTS_FILE)) return;
	const source = fs.readFileSync(CONSTANTS_FILE, "utf8");

	for (const item of BUILD_SECRET_ENV_MAP) {
		const re = new RegExp(
			`export const ${item.constName} = "([^"]*)";`,
			"m",
		);
		const match = source.match(re);
		if (!match) continue;

		const value = match[1] || "";
		if (value && !value.startsWith("%%")) {
			throw new Error(
				`Potential hardcoded secret in src/utils/constants.js for ${item.constName}. Keep source value empty or placeholder and use .env for build-time injection.`,
			);
		}
	}
}

function injectBuildSecrets(platformDist) {
	const distConstantsPath = path.join(platformDist, "utils", "constants.js");
	if (!fs.existsSync(distConstantsPath)) return;

	let content = fs.readFileSync(distConstantsPath, "utf8");
	let injectedCount = 0;

	for (const item of BUILD_SECRET_ENV_MAP) {
		const envValue = process.env[item.envKey];
		if (!envValue) continue;

		const escaped = JSON.stringify(envValue);
		const re = new RegExp(`export const ${item.constName} = "[^"]*";`, "m");
		if (!re.test(content)) continue;

		content = content.replace(
			re,
			`export const ${item.constName} = ${escaped};`,
		);
		injectedCount += 1;
	}

	if (injectedCount > 0) {
		fs.writeFileSync(distConstantsPath, content, "utf8");
		console.log(
			`✅ Injected ${injectedCount} build-time secret value(s) into dist constants for ${path.basename(platformDist)}.`,
		);
	}
}

function validateRequiredBuildSecrets() {
	if (REQUIRED_BUILD_SECRET_ENV_KEYS.length === 0) return;

	const missing = REQUIRED_BUILD_SECRET_ENV_KEYS.filter(
		(key) => !process.env[key],
	);

	if (missing.length === 0) return;

	throw new Error(
		`Missing required build secret env key(s): ${missing.join(", ")}. Provide them in .env/CI or adjust RG_REQUIRED_BUILD_SECRETS.`,
	);
}

// Task: Build for Platform
function build(platform) {
	console.log(`\n🔨 Building for ${platform}...`);
	const platformDist = path.join(DIST_DIR, `dist-${platform}`);
	const manifestFile =
		platform === "firefox"
			? "manifest-firefox.json"
			: "manifest-chromium.json";
	const manifestPath = path.join(SRC_DIR, manifestFile);

	if (!fs.existsSync(platformDist)) {
		fs.mkdirSync(platformDist, { recursive: true });
	}

	// Load and update manifest
	const packageJson = JSON.parse(
		fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"),
	);
	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
	manifest.version = packageJson.version;

	fs.writeFileSync(
		path.join(platformDist, "manifest.json"),
		JSON.stringify(manifest, null, "\t"),
	);
	console.log("✅ Generated manifest.json");

	// Copy assets
	ASSETS_TO_COPY.forEach((item) => {
		const srcPath = path.join(SRC_DIR, item);
		const destPath = path.join(platformDist, item);
		if (fs.existsSync(srcPath)) {
			if (fs.lstatSync(srcPath).isDirectory()) {
				copyDir(srcPath, destPath);
				console.log(`✅ Copied ${item}/`);
			} else {
				fs.copyFileSync(srcPath, destPath);
				console.log(`✅ Copied ${item}`);
			}
		}
	});

	injectBuildSecrets(platformDist);

	console.log(`✨ ${platform} build complete.`);
	return platformDist;
}

// Task: Package
async function packagePlatform(platform, version) {
	console.log(`\n📦 Packaging ${platform} (v${version})...`);
	try {
		const scriptPath = path.join(__dirname, `package-${platform}.js`);
		execSync(`node "${scriptPath}" --version "${version}"`, {
			stdio: "inherit",
		});
		console.log(`✅ ${platform} packaged successfully.`);
	} catch (error) {
		console.error(`❌ Failed to package ${platform}:`, error.message);
	}
}

// Task: Sync source manifest files with package.json version
function syncSourceManifests(version) {
	try {
		console.log(`🔁 Syncing source manifests to v${version}...`);
		const firefoxPath = path.join(SRC_DIR, "manifest-firefox.json");
		const chromiumPath = path.join(SRC_DIR, "manifest-chromium.json");
		const webmanifestPath = path.join(
			SRC_DIR,
			"library",
			"manifest.webmanifest",
		);

		if (fs.existsSync(firefoxPath)) {
			const m = JSON.parse(fs.readFileSync(firefoxPath, "utf8"));
			m.version = version;
			fs.writeFileSync(
				firefoxPath,
				JSON.stringify(m, null, "\t"),
				"utf8",
			);
			console.log("✅ Updated src/manifest-firefox.json");
		}

		if (fs.existsSync(chromiumPath)) {
			const m = JSON.parse(fs.readFileSync(chromiumPath, "utf8"));
			m.version = version;
			fs.writeFileSync(
				chromiumPath,
				JSON.stringify(m, null, "\t"),
				"utf8",
			);
			console.log("✅ Updated src/manifest-chromium.json");
		}

		if (fs.existsSync(webmanifestPath)) {
			const m = JSON.parse(fs.readFileSync(webmanifestPath, "utf8"));
			m.version = version;
			fs.writeFileSync(
				webmanifestPath,
				JSON.stringify(m, null, "\t"),
				"utf8",
			);
			console.log("✅ Updated src/library/manifest.webmanifest");
		}

		// Write build-time version constant for the settings UI
		const buildVersionPath = path.join(
			SRC_DIR,
			"config",
			"build-version.js",
		);
		fs.writeFileSync(
			buildVersionPath,
			`// AUTO-GENERATED by dev/build.js — do not edit manually\nexport const BUILD_VERSION = "${version}";\n`,
			"utf8",
		);
		console.log(`✅ Updated src/config/build-version.js (v${version})`);
	} catch (err) {
		console.error("❌ Failed to sync source manifests:", err.message);
	}
}

// Main Execution
async function main() {
	const args = process.argv.slice(2);
	const options = {
		firefox: args.includes("--firefox"),
		chromium: args.includes("--chromium"),
		all:
			args.includes("--all") ||
			args.length === 0 ||
			(!args.includes("--firefox") && !args.includes("--chromium")),
		package: args.includes("--package"),
		source: args.includes("--source"),
		update: args.includes("--update"),
		clean: args.includes("--clean"),
	};

	if (options.clean) clean();

	// Always generate handler registry, but only update domains if explicitly requested or during packaging
	generateHandlerRegistry();
	if (options.update || options.package) updateDomains();

	const platforms = [];
	if (options.all || options.firefox) platforms.push("firefox");
	if (options.all || options.chromium) platforms.push("chromium");

	const packageJson = JSON.parse(
		fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"),
	);

	// Always sync source manifests with package.json version on every build
	syncSourceManifests(packageJson.version);
	assertNoHardcodedSecretsInSource();
	validateRequiredBuildSecrets();

	for (const platform of platforms) {
		build(platform);
		if (options.package) {
			await packagePlatform(platform, packageJson.version);
		}
	}

	if (options.source) {
		console.log("\n📦 Packaging source code...");
		try {
			execSync(`node "${path.join(__dirname, "package-source.js")}"`, {
				stdio: "inherit",
			});
			console.log("✅ Source code packaged successfully.");
		} catch (error) {
			console.error("❌ Failed to package source:", error.message);
		}
	}

	console.log("\n🏁 Build process finished.");
}

main().catch((err) => {
	console.error("\n💥 Fatal error:", err);
	process.exit(1);
});
