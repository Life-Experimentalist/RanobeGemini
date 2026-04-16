#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const RELEASES_DIR = path.join(ROOT_DIR, "releases");
const FIREFOX_DIST_DIR = path.join(DIST_DIR, "dist-firefox");
const CHROMIUM_RELEASES_DIR = RELEASES_DIR;
const SOURCE_RELEASES_DIR = path.join(RELEASES_DIR, "source");
const WEB_EXT_VERSION = "8.6.0";

function toBoolean(value, defaultValue = false) {
	if (value === undefined || value === null || value === "") {
		return defaultValue;
	}
	return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function getPublishMode(value, defaultMode = "auto") {
	const normalized = String(value || defaultMode).trim().toLowerCase();
	if (["off", "false", "0", "no"].includes(normalized)) return "off";
	if (["on", "true", "1", "yes"].includes(normalized)) return "on";
	return "auto";
}

function hasAllEnv(names) {
	return names.every((name) => Boolean(process.env[name]));
}

function missingEnv(names) {
	return names.filter((name) => !process.env[name]);
}

function collectFiles(dirPath) {
	if (!fs.existsSync(dirPath)) {
		return [];
	}

	const entries = fs.readdirSync(dirPath, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const entryPath = path.join(dirPath, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectFiles(entryPath));
			continue;
		}
		files.push(entryPath);
	}

	return files;
}

function findLatestFile(dirPath, matcher) {
	const files = collectFiles(dirPath).filter((filePath) => matcher(filePath));
	if (files.length === 0) {
		return null;
	}

	return files
		.map((filePath) => ({
			filePath,
			mtime: fs.statSync(filePath).mtimeMs,
		}))
		.sort((left, right) => right.mtime - left.mtime)[0].filePath;
}

function requireEnv(name) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function shouldRunStore({
	storeLabel,
	mode,
	requiredVars = [],
	strict = false,
}) {
	if (mode === "off") {
		console.log(`Skipping ${storeLabel} publication (mode=off).`);
		return false;
	}

	if (requiredVars.length === 0) return true;

	if (hasAllEnv(requiredVars)) return true;

	const missing = missingEnv(requiredVars);
	const message = `${storeLabel} is not configured. Missing: ${missing.join(", ")}`;

	if (strict && mode === "on") {
		throw new Error(message);
	}

	console.log(`Skipping ${storeLabel}: ${message}`);
	return false;
}

function runCommand(command, args) {
	const result = spawnSync(command, args, {
		cwd: ROOT_DIR,
		stdio: "inherit",
		shell: process.platform === "win32",
	});

	if (result.error) {
		throw result.error;
	}

	if (result.status !== 0) {
		throw new Error(`${command} exited with status ${result.status}`);
	}
}

async function readResponseJson(response, context) {
	const responseText = await response.text();
	let parsed = {};

	if (responseText) {
		try {
			parsed = JSON.parse(responseText);
		} catch (_error) {
			parsed = { raw: responseText };
		}
	}

	if (!response.ok) {
		const details =
			parsed && Object.keys(parsed).length > 0
				? JSON.stringify(parsed, null, 2)
				: responseText;
		throw new Error(
			`${context} failed with HTTP ${response.status} ${response.statusText}${details ? `\n${details}` : ""}`,
		);
	}

	return parsed;
}

async function delay(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function resolveOptionalPath(envName) {
	const value = process.env[envName];
	if (!value) {
		return null;
	}
	return path.isAbsolute(value) ? value : path.resolve(ROOT_DIR, value);
}

async function publishFirefox() {
	if (!fs.existsSync(FIREFOX_DIST_DIR)) {
		throw new Error(
			`Firefox build output not found at ${path.relative(ROOT_DIR, FIREFOX_DIST_DIR)}. Run npm run package first.`,
		);
	}

	const args = [
		"--yes",
		`web-ext@${WEB_EXT_VERSION}`,
		"sign",
		"--source-dir",
		FIREFOX_DIST_DIR,
		"--channel",
		"listed",
		"--api-key",
		requireEnv("AMO_API_KEY"),
		"--api-secret",
		requireEnv("AMO_API_SECRET"),
		"--timeout",
		"300000",
		"--approval-timeout",
		"0",
		"--artifacts-dir",
		path.join(RELEASES_DIR, "amo"),
		"--no-input",
	];

	const amoMetadataFile = resolveOptionalPath("AMO_METADATA_FILE");
	if (amoMetadataFile && fs.existsSync(amoMetadataFile)) {
		args.push("--amo-metadata", amoMetadataFile);
	}

	const uploadSourceEnabled = toBoolean(
		process.env.AMO_UPLOAD_SOURCE_CODE,
		true,
	);
	if (uploadSourceEnabled) {
		const sourceArchive = findLatestFile(SOURCE_RELEASES_DIR, (filePath) =>
			filePath.endsWith("_source.zip"),
		);
		if (sourceArchive) {
			args.push("--upload-source-code", sourceArchive);
		}
	}

	console.log("Publishing Firefox add-on via web-ext sign...");
	runCommand(process.platform === "win32" ? "npx.cmd" : "npx", args);
}

async function refreshChromeAccessToken() {
	const clientId = requireEnv("CWS_CLIENT_ID");
	const clientSecret = requireEnv("CWS_CLIENT_SECRET");
	const refreshToken = requireEnv("CWS_REFRESH_TOKEN");

	const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token: refreshToken,
			grant_type: "refresh_token",
		}),
	});

	const tokenJson = await readResponseJson(
		tokenResponse,
		"Chrome access token refresh",
	);
	if (!tokenJson.access_token) {
		throw new Error(
			"Chrome access token response did not include an access_token field.",
		);
	}

	return tokenJson.access_token;
}

async function requestChromeJson(url, accessToken, options = {}) {
	const response = await fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			...(options.headers || {}),
		},
	});

	return readResponseJson(response, url);
}

async function waitForChromeUpload(accessToken, publisherId, extensionId) {
	const fetchStatusUrl = `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:fetchStatus`;

	for (let attempt = 1; attempt <= 12; attempt += 1) {
		const status = await requestChromeJson(fetchStatusUrl, accessToken, {
			method: "GET",
		});

		if (status.uploadState !== "UPLOAD_IN_PROGRESS") {
			return status;
		}

		console.log(
			`Waiting for Chrome Web Store upload to finish (${attempt}/12)...`,
		);
		await delay(5000);
	}

	throw new Error("Timed out waiting for Chrome Web Store upload to finish.");
}

async function publishChrome() {
	const zipPath = findLatestFile(CHROMIUM_RELEASES_DIR, (filePath) =>
		filePath.endsWith("_chromium.zip"),
	);

	if (!zipPath) {
		throw new Error(
			`Chromium package not found in ${path.relative(ROOT_DIR, CHROMIUM_RELEASES_DIR)}. Run npm run package first.`,
		);
	}

	const publisherId = requireEnv("CWS_PUBLISHER_ID");
	const extensionId = requireEnv("CWS_EXTENSION_ID");
	const accessToken = await refreshChromeAccessToken();
	const zipBuffer = fs.readFileSync(zipPath);
	const uploadUrl = `https://chromewebstore.googleapis.com/upload/v2/publishers/${publisherId}/items/${extensionId}:upload`;

	console.log(`Uploading Chrome package: ${path.basename(zipPath)}`);
	const uploadResponse = await requestChromeJson(uploadUrl, accessToken, {
		method: "POST",
		headers: {
			"Content-Type": "application/zip",
		},
		body: zipBuffer,
	});

	if (uploadResponse.uploadState === "UPLOAD_IN_PROGRESS") {
		await waitForChromeUpload(accessToken, publisherId, extensionId);
	}

	const publishUrl = `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:publish`;
	await requestChromeJson(publishUrl, accessToken, {
		method: "POST",
	});

	console.log(
		`Requested Chrome Web Store publish for ${path.basename(zipPath)}.`,
	);
}

function reportEdgeStatus() {
	const zipPath = findLatestFile(CHROMIUM_RELEASES_DIR, (filePath) =>
		filePath.endsWith("_chromium.zip"),
	);

	if (!zipPath) {
		console.log("Edge Add-ons package not found yet.");
		return;
	}

	console.log(
		`Edge Add-ons still requires Partner Center submission. Use ${path.relative(ROOT_DIR, zipPath)} as the upload package.`,
	);
}

function reportManualStoreStatus(storeLabel, envPrefix) {
	const mode = getPublishMode(process.env[`PUBLISH_${envPrefix}`], "off");
	if (mode === "off") {
		return;
	}

	const zipPath = findLatestFile(CHROMIUM_RELEASES_DIR, (filePath) =>
		filePath.endsWith("_chromium.zip"),
	);

	if (!zipPath) {
		console.log(`${storeLabel}: package not found yet.`);
		return;
	}

	console.log(
		`${storeLabel}: manual upload enabled. Use ${path.relative(ROOT_DIR, zipPath)}.`,
	);
}

async function main() {
	const strictPublishing = toBoolean(process.env.PUBLISH_STRICT, false);
	const firefoxMode = getPublishMode(process.env.PUBLISH_FIREFOX, "auto");
	const chromeMode = getPublishMode(process.env.PUBLISH_CHROME, "auto");
	const edgeManualMode = getPublishMode(
		process.env.PUBLISH_EDGE_MANUAL,
		"auto",
	);

	const noPrimaryStores =
		firefoxMode === "off" &&
		chromeMode === "off" &&
		edgeManualMode === "off";

	if (noPrimaryStores) {
		console.log("No store publishing actions enabled.");
	} else {
		if (
			shouldRunStore({
				storeLabel: "Firefox (AMO)",
				mode: firefoxMode,
				requiredVars: ["AMO_API_KEY", "AMO_API_SECRET"],
				strict: strictPublishing,
			})
		) {
			await publishFirefox();
		}

		if (
			shouldRunStore({
				storeLabel: "Chrome Web Store",
				mode: chromeMode,
				requiredVars: [
					"CWS_CLIENT_ID",
					"CWS_CLIENT_SECRET",
					"CWS_REFRESH_TOKEN",
					"CWS_PUBLISHER_ID",
					"CWS_EXTENSION_ID",
				],
				strict: strictPublishing,
			})
		) {
			await publishChrome();
		}

		if (edgeManualMode !== "off") {
			reportEdgeStatus();
		}
	}

	// Additional Chromium-family manual channels (optional, non-blocking)
	reportManualStoreStatus("Brave Add-ons", "BRAVE_MANUAL");
	reportManualStoreStatus("Opera Add-ons", "OPERA_MANUAL");
	reportManualStoreStatus("Vivaldi", "VIVALDI_MANUAL");
	reportManualStoreStatus("Ulaa", "ULAA_MANUAL");
	reportManualStoreStatus("Arc", "ARC_MANUAL");
}

main().catch((error) => {
	console.error(`Store publishing failed: ${error.message}`);
	process.exit(1);
});
