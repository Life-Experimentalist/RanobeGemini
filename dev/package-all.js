#!/usr/bin/env node
const { buildAll } = require("./build-cross-platform.js");
const { packageExtension: packageFirefox } = require("./package-firefox.js");
const { packageExtension: packageChromium } = require("./package-chromium.js");
const { packageSource } = require("./package-source.js");

async function packageAll() {
	console.log("📦 Building and packaging for all platforms...\n");

	try {
		// First build both versions
		console.log("═══════════════════════════════════════");
		console.log("🔨 Building...");
		console.log("═══════════════════════════════════════");
		buildAll();

		console.log("\n═══════════════════════════════════════");
		console.log("📦 Packaging Firefox version...");
		console.log("═══════════════════════════════════════");
		await packageFirefox();

		console.log("\n═══════════════════════════════════════");
		console.log("📦 Packaging Chromium version...");
		console.log("═══════════════════════════════════════");
		await packageChromium();

		console.log("\n═══════════════════════════════════════");
		console.log("📦 Packaging source code for review...");
		console.log("═══════════════════════════════════════");
		await packageSource();

		console.log("\n✨ All platforms packaged successfully!");
		console.log(
			"\n📂 Check the 'releases' folder for your packaged extensions."
		);
	} catch (error) {
		console.error("\n❌ Packaging failed:", error);
		process.exit(1);
	}
}

if (require.main === module) {
	packageAll();
}

module.exports = { packageAll };
