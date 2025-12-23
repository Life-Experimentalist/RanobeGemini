/**
 * Generate Manifest Domains
 * Automatically updates both Firefox and Chromium manifest files with domains from handlers
 * Run this script when adding new handler domains
 */

const fs = require("fs");
const path = require("path");

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
const MANIFEST_FIREFOX = path.join(ROOT_DIR, "src", "manifest-firefox.json");
const MANIFEST_CHROMIUM = path.join(ROOT_DIR, "src", "manifest-chromium.json");

function extractDomainsFromHandlers() {
	const handlersDir = path.join(ROOT_DIR, "src", "utils", "website-handlers");
	const handlerFiles = fs
		.readdirSync(handlersDir)
		.filter(
			(file) => file.endsWith("-handler.js") && !file.startsWith("base")
		);

	const explicitDomains = new Set();

	handlerFiles.forEach((file) => {
		const filePath = path.join(handlersDir, file);
		const content = fs.readFileSync(filePath, "utf8");

		const match = content.match(
			/static\s+SUPPORTED_DOMAINS\s*=\s*\[([\s\S]*?)\]/
		);
		if (match) {
			const domainsStr = match[1];
			const domains = domainsStr.match(/"([^"]+)"|'([^']+)'/g);
			if (domains) {
				domains.forEach((domain) => {
					const cleanDomain = domain.replace(/["']/g, "").trim();
					if (
						cleanDomain &&
						!cleanDomain.startsWith("//") &&
						!cleanDomain.startsWith("*")
					) {
						explicitDomains.add(cleanDomain);
					}
				});
			}
		}
	});

	return [...explicitDomains].sort();
}

function generateMatchPatterns(domains) {
	const patterns = new Set();

	domains.forEach((domain) => {
		const baseDomain = domain.replace(/^www\./, "").replace(/^m\./, "");
		patterns.add(`*://*.${baseDomain}/*`);
	});

	return [...patterns].sort();
}

function updateManifest(manifestPath, platform) {
	console.log(`\n📝 Reading ${platform} manifest...`);
	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

	console.log(`🔍 Extracting domains from handlers...`);
	const domains = extractDomainsFromHandlers();
	console.log(`Found ${domains.length} unique domains`);

	console.log(`🔨 Generating match patterns...`);
	const matches = generateMatchPatterns(domains);

	if (manifest.content_scripts && manifest.content_scripts[0]) {
		manifest.content_scripts[0].matches = matches;
		console.log(`✅ Updated content_scripts (${matches.length} patterns)`);
	}

	if (manifest.web_accessible_resources && manifest.web_accessible_resources[0]) {
		manifest.web_accessible_resources[0].matches = matches;
		console.log(`✅ Updated web_accessible_resources (${matches.length} patterns)`);
	}

	console.log(`💾 Writing ${platform} manifest...`);
	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t"));
	console.log(`✨ ${platform} manifest updated`);
}

try {
	console.log("🔄 Updating manifest domains for all platforms...");

	updateManifest(MANIFEST_FIREFOX, "Firefox");
	updateManifest(MANIFEST_CHROMIUM, "Chromium");

	console.log("\n✨ All manifests updated successfully!");
} catch (error) {
	console.error("❌ Error updating manifests:", error.message);
	process.exit(1);
}

