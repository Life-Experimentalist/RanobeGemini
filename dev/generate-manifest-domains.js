/**
 * Generate Manifest Domains
 * Automatically updates manifest.json with domains from handlers
 * Run this script when adding new handler domains
 */

const fs = require("fs");
const path = require("path");

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
const MANIFEST_PATH = path.join(ROOT_DIR, "src", "manifest.json");

// Read all handler files and extract SUPPORTED_DOMAINS
// Includes explicit domains + basic wildcards for edge cases
function extractDomainsFromHandlers() {
	const handlersDir = path.join(ROOT_DIR, "src", "utils", "website-handlers");
	const handlerFiles = fs
		.readdirSync(handlersDir)
		.filter(
			(file) => file.endsWith("-handler.js") && !file.startsWith("base")
		);

	const explicitDomains = [];
	const wildcardDomains = [];

	handlerFiles.forEach((file) => {
		const filePath = path.join(handlersDir, file);
		const content = fs.readFileSync(filePath, "utf8");

		// Extract SUPPORTED_DOMAINS array using regex
		const match = content.match(
			/static\s+SUPPORTED_DOMAINS\s*=\s*\[([\s\S]*?)\]/
		);
		if (match) {
			const domainsStr = match[1];
			// Extract quoted strings
			const domains = domainsStr.match(/"([^"]+)"|'([^']+)'/g);
			if (domains) {
				domains.forEach((domain) => {
					const cleanDomain = domain.replace(/["']/g, "");
					// Skip comments and empty strings
					if (cleanDomain && !cleanDomain.startsWith("//")) {
						if (cleanDomain.startsWith("*.")) {
							// Include wildcards for edge cases
							wildcardDomains.push(cleanDomain);
						} else {
							// Include explicit domains
							explicitDomains.push(cleanDomain);
						}
					}
				});
			}
		}
	});

	// Combine explicit domains + unique wildcards
	const allDomains = [...new Set([...explicitDomains, ...wildcardDomains])];
	return allDomains;
}

// Generate match patterns for manifest.json
function generateMatchPatterns(domains) {
	return domains.map((domain) => {
		// Strip wildcard prefix if present (*.domain.com -> domain.com)
		const cleanDomain = domain.startsWith("*.")
			? domain.substring(2)
			: domain;
		return `*://*.${cleanDomain}/*`;
	});
}

// Update manifest.json
function updateManifest() {
	console.log("📝 Reading manifest.json...");
	const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

	console.log("🔍 Extracting domains from handlers...");
	const domains = extractDomainsFromHandlers();
	console.log(`Found ${domains.length} unique domains:`);
	domains.forEach(domain => console.log(`  - ${domain}`));

	console.log("\n🔨 Generating match patterns...");
	const matches = generateMatchPatterns(domains);

	// Update content_scripts matches
	if (manifest.content_scripts && manifest.content_scripts[0]) {
		manifest.content_scripts[0].matches = matches;
		console.log(`✅ Updated content_scripts matches (${matches.length} patterns)`);
	}

	// Update web_accessible_resources matches
	if (manifest.web_accessible_resources && manifest.web_accessible_resources[0]) {
		manifest.web_accessible_resources[0].matches = matches;
		console.log(`✅ Updated web_accessible_resources matches (${matches.length} patterns)`);
	}

	// Write back to manifest.json
	console.log("\n💾 Writing updated manifest.json...");
	fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, "\t"));

	console.log("✨ Manifest updated successfully!\n");
}

// Run the update
try {
	updateManifest();
} catch (error) {
	console.error("❌ Error updating manifest:", error.message);
	process.exit(1);
}
