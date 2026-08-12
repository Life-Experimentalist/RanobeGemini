#!/usr/bin/env node

/**
 * Move the release zip archive out of git and into GitHub Release assets.
 *
 * Why: `releases/` is ~694 MB of build output tracked in git. Every clone pays
 * for all of it, forever. An orphan branch does not help — a default
 * `git clone` fetches every branch and the blobs sit in the same object
 * database either way. Release assets are stored outside git object storage,
 * cost nothing, and give each zip a stable public download URL.
 *
 * What this does, per version found in `releases/`:
 *   1. Ensures a `vX.Y.Z` tag exists. Most versions have no tag — the tag is
 *      created on the commit that first added that version's zip, which is the
 *      closest honest answer to "when was this released".
 *   2. Ensures a GitHub release exists for that tag.
 *   3. Uploads the version's zips as assets, replacing any already there.
 *
 * Dry run by default. Nothing is pushed, created, or uploaded without --yes,
 * because tags and releases on a public repo are visible to everyone the
 * moment they exist.
 *
 *   node dev/publish-release-assets.js                 # show the plan
 *   node dev/publish-release-assets.js --version 5.0.0 # one version
 *   node dev/publish-release-assets.js --yes           # actually do it
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const RELEASES_DIR = path.join(ROOT_DIR, "releases");
const SOURCE_DIR = path.join(RELEASES_DIR, "source");

const args = process.argv.slice(2);
const APPLY = args.includes("--yes");
const versionFilter = (() => {
	const i = args.indexOf("--version");
	return i >= 0 ? args[i + 1] : null;
})();

function run(cmd, cmdArgs, { allowFailure = false } = {}) {
	const result = spawnSync(cmd, cmdArgs, {
		cwd: ROOT_DIR,
		encoding: "utf8",
		shell: false,
	});
	if (result.error) {
		if (allowFailure) return { ok: false, stdout: "", stderr: String(result.error) };
		throw result.error;
	}
	const ok = result.status === 0;
	if (!ok && !allowFailure) {
		throw new Error(
			`${cmd} ${cmdArgs.join(" ")} failed (${result.status}):\n${result.stderr || result.stdout}`,
		);
	}
	return { ok, stdout: (result.stdout || "").trim(), stderr: (result.stderr || "").trim() };
}

/** Every zip under releases/, grouped by the version in its filename. */
function collectZips() {
	const byVersion = new Map();

	const scan = (dir) => {
		if (!fs.existsSync(dir)) return;
		for (const name of fs.readdirSync(dir)) {
			if (!name.toLowerCase().endsWith(".zip")) continue;
			const match = name.match(/v(\d+\.\d+\.\d+)/i);
			if (!match) {
				console.warn(`  ! skipped (no version in name): ${name}`);
				continue;
			}
			const version = match[1];
			if (!byVersion.has(version)) byVersion.set(version, []);
			byVersion.get(version).push(path.join(dir, name));
		}
	};

	scan(RELEASES_DIR);
	scan(SOURCE_DIR);

	return new Map(
		[...byVersion.entries()].sort((a, b) =>
			a[0].localeCompare(b[0], undefined, { numeric: true }),
		),
	);
}

function tagExists(tag) {
	return run("git", ["rev-parse", "--verify", `refs/tags/${tag}`], {
		allowFailure: true,
	}).ok;
}

/**
 * The commit that first added any of this version's zips. That is when the
 * build was actually cut, which beats tagging everything at HEAD.
 */
function commitThatAdded(files) {
	for (const file of files) {
		const rel = path.relative(ROOT_DIR, file).replace(/\\/g, "/");
		const { ok, stdout } = run(
			"git",
			// No --follow: these are build artifacts that were never renamed,
			// and --follow on a 40-file sweep of a large history is slow enough
			// to look like a hang.
			["log", "--diff-filter=A", "--format=%H", "-1", "--", rel],
			{ allowFailure: true },
		);
		if (ok && stdout) return stdout.split("\n")[0].trim();
	}
	return null;
}

function releaseExists(tag) {
	return run("gh", ["release", "view", tag, "--json", "tagName"], {
		allowFailure: true,
	}).ok;
}

function ensureGhAuth() {
	const { ok } = run("gh", ["auth", "status"], { allowFailure: true });
	if (!ok) {
		console.error(
			"gh is not authenticated. Run `gh auth login` first, or pass --dry-run only.",
		);
		process.exit(1);
	}
}

function humanSize(bytes) {
	const mb = bytes / (1024 * 1024);
	return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function main() {
	const byVersion = collectZips();
	if (byVersion.size === 0) {
		console.log("No zips found under releases/. Nothing to do.");
		return;
	}

	if (APPLY) ensureGhAuth();

	const versions = versionFilter
		? [...byVersion.keys()].filter((v) => v === versionFilter)
		: [...byVersion.keys()];

	if (versionFilter && versions.length === 0) {
		console.error(`No zips found for version ${versionFilter}.`);
		process.exit(1);
	}

	console.log(
		APPLY
			? "Publishing release assets to GitHub.\n"
			: "DRY RUN — nothing will be created or uploaded. Re-run with --yes to apply.\n",
	);

	let totalBytes = 0;
	let created = 0;
	let uploaded = 0;

	for (const version of versions) {
		const files = byVersion.get(version);
		const tag = `v${version}`;
		const bytes = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
		totalBytes += bytes;

		console.log(`${tag}  (${files.length} asset(s), ${humanSize(bytes)})`);

		const hasTag = tagExists(tag);
		let target = null;
		if (!hasTag) {
			target = commitThatAdded(files);
			if (!target) {
				console.log(
					`  ! no tag and no commit found that added these files — skipping ${tag}`,
				);
				continue;
			}
			console.log(`  tag ${tag} -> ${target.slice(0, 8)} (commit that added the zip)`);
			if (APPLY) {
				run("git", ["tag", tag, target]);
				run("git", ["push", "origin", tag]);
				created++;
			}
		}

		const hasRelease = APPLY || hasTag ? releaseExists(tag) : false;
		if (!hasRelease) {
			console.log(`  create release ${tag}`);
			if (APPLY) {
				run("gh", [
					"release",
					"create",
					tag,
					"--title",
					tag,
					"--notes",
					`Build archive for ${tag}. See docs/release/CHANGELOG.md for what changed.`,
				]);
			}
		}

		for (const file of files) {
			console.log(`  upload ${path.basename(file)}`);
		}
		if (APPLY) {
			run("gh", ["release", "upload", tag, ...files, "--clobber"]);
			uploaded += files.length;
		}
	}

	console.log(
		`\n${versions.length} version(s), ${humanSize(totalBytes)} total.`,
	);
	if (APPLY) {
		console.log(`Created ${created} tag(s), uploaded ${uploaded} asset(s).`);
		console.log(
			"\nThe zips are now in Releases. `releases/` is gitignored, so new builds\n" +
				"stay out of git. The copies already in history remain there — removing\n" +
				"them would rewrite every commit SHA the changelog references.",
		);
	} else {
		console.log("Re-run with --yes to apply.");
	}
}

main();
