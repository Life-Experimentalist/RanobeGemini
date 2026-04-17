const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const RUNTIME_BACKUP_PATH = path.join(
	ROOT_DIR,
	"src",
	"utils",
	"comprehensive-backup.js",
);
const CANONICAL_SCHEMA_PATH = path.join(
	ROOT_DIR,
	"docs",
	"backup",
	"ranobe-backup.schema.json",
);
const LANDING_SCHEMA_PROXY_PATH = path.join(
	ROOT_DIR,
	"landing",
	"schemas",
	"ranobe-backup.schema.json",
);
const SAMPLE_BACKUP_PATH = path.join(
	ROOT_DIR,
	"sample",
	"ranobe-gemini-backup-2026-03-26.json",
);

const REQUIRED_ENVELOPE_KEYS = [
	"version",
	"type",
	"createdAt",
	"createdAtISO",
	"extensionVersion",
	"browser",
	"data",
];

function fail(message) {
	throw new Error(message);
}

function readJson(filePath) {
	const raw = fs.readFileSync(filePath, "utf8");
	return JSON.parse(raw);
}

function getRuntimeBackupVersion() {
	const source = fs.readFileSync(RUNTIME_BACKUP_PATH, "utf8");
	const versionMatch = source.match(/const\s+BACKUP_VERSION\s*=\s*"([^"]+)"/);
	if (!versionMatch) {
		fail(
			"Could not locate BACKUP_VERSION in src/utils/comprehensive-backup.js",
		);
	}
	return versionMatch[1];
}

function assertCanonicalSchemaEnvelope(schemaJson) {
	if (!Array.isArray(schemaJson.required)) {
		fail("Canonical schema is missing required[]");
	}
	for (const key of REQUIRED_ENVELOPE_KEYS) {
		if (!schemaJson.required.includes(key)) {
			fail(`Canonical schema required[] missing envelope key: ${key}`);
		}
	}
}

function assertLandingProxyRef(landingSchemaJson) {
	const expectedRef =
		"https://raw.githubusercontent.com/Life-Experimentalist/RanobeGemini/refs/heads/main/docs/backup/ranobe-backup.schema.json";
	if (landingSchemaJson.$ref !== expectedRef) {
		fail(
			`Landing schema proxy $ref mismatch. Expected '${expectedRef}', got '${landingSchemaJson.$ref || "<missing>"}'.`,
		);
	}
}

function assertSampleBackup(sampleBackupJson, runtimeVersion) {
	for (const key of REQUIRED_ENVELOPE_KEYS) {
		if (!(key in sampleBackupJson)) {
			fail(`Sample backup missing required key: ${key}`);
		}
	}

	const runtimeFormat = Number.parseFloat(runtimeVersion);
	const sampleFormat = Number.parseFloat(sampleBackupJson.version);

	if (Number.isFinite(runtimeFormat) && Number.isFinite(sampleFormat)) {
		if (sampleFormat > runtimeFormat) {
			fail(
				`Sample backup version ${sampleBackupJson.version} is newer than runtime backup version ${runtimeVersion}.`,
			);
		}
	}
}

function main() {
	console.log("Checking backup compatibility contract...");

	const runtimeVersion = getRuntimeBackupVersion();
	const canonicalSchema = readJson(CANONICAL_SCHEMA_PATH);
	const landingSchemaProxy = readJson(LANDING_SCHEMA_PROXY_PATH);
	const sampleBackup = readJson(SAMPLE_BACKUP_PATH);

	assertCanonicalSchemaEnvelope(canonicalSchema);
	assertLandingProxyRef(landingSchemaProxy);
	assertSampleBackup(sampleBackup, runtimeVersion);

	console.log("Runtime backup version:", runtimeVersion);
	console.log(
		"Canonical schema envelope keys verified:",
		REQUIRED_ENVELOPE_KEYS.length,
	);
	console.log("Landing schema proxy reference is valid.");
	console.log("Sample backup envelope/version checks passed.");
	console.log("Backup compatibility contract validation passed.");
}

try {
	main();
} catch (error) {
	console.error("Backup compatibility contract validation failed.");
	console.error(error.message || error);
	process.exitCode = 1;
}
