const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

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
const srcDir = path.join(ROOT_DIR, "src");

// Function to get formatted local timestamp
function getTimestamp() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	const seconds = String(now.getSeconds()).padStart(2, "0");
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

console.log("🔍 Watching for file changes in src/ directory...");
console.log('📦 Will run "npm run build" when changes are detected\n');

let buildInProgress = false;
let pendingBuild = false;
let debounceTimer = null;
let ignoreChangesUntil = 0;
const lastModifiedTimes = new Map();
const DEBOUNCE_DELAY = 500;
const IGNORE_COOLDOWN = 5000;

function runBuild() {
	if (buildInProgress) {
		pendingBuild = true;
		return;
	}

	buildInProgress = true;
	console.log(`\n[${getTimestamp()}]	🔨 Change detected! Building... `);

	const startTime = Date.now();

	exec("npm run build", { cwd: ROOT_DIR }, (error, stdout, stderr) => {
		const duration = ((Date.now() - startTime) / 1000).toFixed(2);

		if (error) {
			console.error(`❌ Build failed (${duration}s):`, error.message);
			buildInProgress = false;
			return;
		}

		if (stderr && !stderr.includes("npm WARN")) {
			console.error("⚠️ Build warnings:", stderr);
		}

		console.log(
			`[${getTimestamp()}]	✅ Build completed successfully (${duration}s) `
		);
		console.log(`[${getTimestamp()}]	🔍 Watching for changes...`);
		console.log(`___________________________\n`);

		ignoreChangesUntil = Date.now() + IGNORE_COOLDOWN;

		buildInProgress = false;

		if (pendingBuild) {
			pendingBuild = false;
			setTimeout(runBuild, IGNORE_COOLDOWN);
		}
	});
}

function handleFileChange(filename) {
	if (!filename) return;

	if (Date.now() < ignoreChangesUntil) {
		return;
	}

	if (
		filename.includes("node_modules") ||
		filename.includes(".git") ||
		filename.includes("releases") ||
		filename.includes("dist") ||
		filename.endsWith(".tmp") ||
		filename.endsWith("docs") ||
		filename.endsWith("history") ||
		filename.endsWith(".log") ||
		filename.endsWith(".swp")
	) {
		return;
	}

	const ext = path.extname(filename);
	if (![".js", ".css", ".html", ".json"].includes(ext)) {
		return;
	}

	const fullPath = path.join(srcDir, filename);

	try {
		const stats = fs.statSync(fullPath);
		const lastModified = stats.mtimeMs;
		const previousModified = lastModifiedTimes.get(fullPath);

		if (previousModified && lastModified - previousModified < 1000) {
			return;
		}

		lastModifiedTimes.set(fullPath, lastModified);
	} catch (err) {
		return;
	}

	console.log(`[${getTimestamp()}]	📝 Changed: ${filename}`);

	if (debounceTimer) {
		clearTimeout(debounceTimer);
	}

	debounceTimer = setTimeout(() => {
		runBuild();
	}, DEBOUNCE_DELAY);
}

function watchDirectory(dir) {
	try {
		fs.watch(dir, { recursive: true }, (eventType, filename) => {
			handleFileChange(filename);
		});

		console.log(`✓ Watching: ${dir}\n`);
	} catch (err) {
		console.error(`Error watching ${dir}:`, err.message);
	}
}

watchDirectory(srcDir);

process.on("SIGINT", () => {
	console.log("\n\n👋 Stopping file watcher...");
	process.exit(0);
});
