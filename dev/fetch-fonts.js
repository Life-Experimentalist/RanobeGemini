/**
 * Self-hosted webfont fetcher.
 *
 * Run manually (`npm run fonts:fetch`), NOT as part of the build. It needs the
 * network, and a build that silently depends on fonts.gstatic.com being up is
 * exactly the third-party coupling this script exists to remove. The fetched
 * .woff2 files and the generated fonts.css are committed; nothing at build time
 * or run time ever touches a Google origin again.
 *
 * Why self-host at all:
 *   - `<link>` to fonts.googleapis.com is render-blocking and sits ahead of the
 *     site's own stylesheet, so a slow or blocked Google request delays first
 *     paint of the whole page.
 *   - Loading it hands every visitor's IP and User-Agent to a third party on
 *     every page view, with no consent prompt — a GDPR problem for EU visitors
 *     and flatly at odds with a local-first extension.
 *   - Inside the extension there is no choice: an MV3 page cannot fetch a
 *     remote stylesheet under its own CSP.
 *
 * Licensing: every family below lives under `ofl/` in the google/fonts
 * repository, which is that repository's marker for SIL Open Font License 1.1.
 * The OFL permits redistribution, bundling with software, and commercial use;
 * the only real conditions are that the fonts are not sold on their own and
 * that the licence text travels with them. This script therefore downloads each
 * family's OFL.txt alongside its .woff2 files, and refuses to write a family
 * whose OFL.txt it cannot fetch — an unlicensed font must never reach the
 * package by accident.
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

/**
 * Google serves the CSS split by script. Only these two are kept: everything
 * the extension's supported sites and the landing copy actually render is
 * covered by Latin, and pulling Cyrillic/Greek/Vietnamese would roughly triple
 * the byte count for glyphs nothing asks for.
 */
const SUBSETS = new Set(["latin", "latin-ext"]);

/** A desktop UA is required — Google serves .ttf to anything it does not know. */
const UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * `slug` is the directory name under `ofl/` in google/fonts, used to fetch the
 * licence. `axis` is the css2 API's tuple syntax.
 */
const FAMILIES = [
	// ── Landing site ──────────────────────────────────────────────────────────
	{
		target: "landing",
		family: "Space Grotesk",
		slug: "spacegrotesk",
		axis: "wght@400;500;600;700",
	},

	// ── Extension reading surfaces ────────────────────────────────────────────
	// Regular, italic and bold only. Chapter prose needs emphasis and strong;
	// it has no use for six weights, and every unused weight is dead bytes in
	// the store package.
	//
	// Note the axis strings pin discrete weights and never name an optical-size
	// range. Asking for `opsz@7..72` makes the API hand back the whole variable
	// font for every subset — Merriweather alone came to 777 KB that way, versus
	// 50 KB for the static instances actually used here.
	{
		target: "extension",
		family: "Literata",
		slug: "literata",
		axis: "ital,wght@0,400;0,700;1,400",
	},
	{
		target: "extension",
		family: "Merriweather",
		slug: "merriweather",
		axis: "ital,wght@0,400;0,700;1,400",
	},
	{
		target: "extension",
		family: "Atkinson Hyperlegible",
		slug: "atkinsonhyperlegible",
		axis: "ital,wght@0,400;0,700;1,400",
	},
	{
		target: "extension",
		family: "Inter",
		slug: "inter",
		axis: "ital,wght@0,400;0,700;1,400",
	},
];

const TARGETS = {
	landing: {
		dir: path.join(ROOT_DIR, "landing", "assets", "fonts"),
		note: "Used by every page in landing/. Referenced from landing/styles.css.",
	},
	extension: {
		dir: path.join(ROOT_DIR, "src", "fonts"),
		note: "Reading fonts offered by the appearance settings. Referenced from src/content/content.css and the extension pages.",
	},
};

async function fetchText(url) {
	const response = await fetch(url, { headers: { "User-Agent": UA } });
	if (!response.ok) {
		throw new Error(`GET ${url} -> ${response.status}`);
	}
	return response.text();
}

async function fetchBinary(url) {
	const response = await fetch(url, { headers: { "User-Agent": UA } });
	if (!response.ok) {
		throw new Error(`GET ${url} -> ${response.status}`);
	}
	return Buffer.from(await response.arrayBuffer());
}

/**
 * Split Google's stylesheet into per-subset @font-face blocks.
 *
 * The response labels each block with a `/* subset *\/` comment immediately
 * before it, which is the only place the subset name appears — `unicode-range`
 * alone would have to be reverse-engineered.
 */
function parseFontFaces(css) {
	const blocks = [];
	const pattern = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;

	let match;
	while ((match = pattern.exec(css)) !== null) {
		const [, subset, block] = match;
		const read = (property) =>
			block.match(new RegExp(`${property}:\\s*([^;]+);`))?.[1].trim();

		const url = block.match(/url\(([^)]+)\)/)?.[1];
		if (!url) continue;

		blocks.push({
			subset,
			url,
			style: read("font-style") || "normal",
			weight: read("font-weight") || "400",
			unicodeRange: read("unicode-range"),
		});
	}

	return blocks;
}

/** `literata-400i-latin-ext.woff2` — readable in a diff and in devtools. */
function fileNameFor(slug, face) {
	const suffix = face.style === "italic" ? "i" : "";
	return `${slug}-${face.weight}${suffix}-${face.subset}.woff2`;
}

async function fetchFamily(spec, outDir) {
	const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
		spec.family,
	).replace(/%20/g, "+")}:${spec.axis}&display=swap`;

	const faces = parseFontFaces(await fetchText(url)).filter((f) =>
		SUBSETS.has(f.subset),
	);

	if (faces.length === 0) {
		throw new Error(
			`${spec.family}: no ${[...SUBSETS].join("/")} faces came back — the css2 axis string is probably wrong.`,
		);
	}

	// Licence first. A family whose OFL.txt cannot be fetched is not written at
	// all, so a network hiccup cannot leave unlicensed binaries on disk.
	const licence = await fetchText(
		`https://raw.githubusercontent.com/google/fonts/main/ofl/${spec.slug}/OFL.txt`,
	);
	if (!/SIL OPEN FONT LICENSE/i.test(licence)) {
		throw new Error(
			`${spec.family}: ofl/${spec.slug}/OFL.txt does not read as the SIL OFL — refusing to bundle it.`,
		);
	}

	const rules = [];
	let bytes = 0;

	for (const face of faces) {
		const fileName = fileNameFor(spec.slug, face);
		const data = await fetchBinary(face.url);
		fs.writeFileSync(path.join(outDir, fileName), data);
		bytes += data.length;

		rules.push(
			[
				`/* ${spec.family} ${face.weight}${face.style === "italic" ? " italic" : ""} — ${face.subset} */`,
				`@font-face {`,
				`\tfont-family: "${spec.family}";`,
				`\tfont-style: ${face.style};`,
				`\tfont-weight: ${face.weight};`,
				`\tfont-display: swap;`,
				`\tsrc: url("./${fileName}") format("woff2");`,
				`\tunicode-range: ${face.unicodeRange};`,
				`}`,
			].join("\n"),
		);
	}

	fs.writeFileSync(
		path.join(outDir, `OFL-${spec.slug}.txt`),
		licence.replace(/\r\n/g, "\n"),
	);

	console.log(
		`  ✓ ${spec.family}: ${faces.length} files, ${(bytes / 1024).toFixed(1)} KB`,
	);

	return { rules, bytes, files: faces.length };
}

async function main() {
	for (const [targetName, target] of Object.entries(TARGETS)) {
		const specs = FAMILIES.filter((f) => f.target === targetName);
		if (specs.length === 0) continue;

		fs.mkdirSync(target.dir, { recursive: true });
		console.log(
			`\n🔤 ${targetName} → ${path.relative(ROOT_DIR, target.dir)}`,
		);

		// Purge before writing. Filenames encode weight and subset, so dropping a
		// family or changing an axis would otherwise leave orphaned .woff2 files
		// behind — shipped in the package, referenced by nothing.
		for (const existing of fs.readdirSync(target.dir)) {
			if (/\.woff2$/.test(existing) || /^OFL-.*\.txt$/.test(existing)) {
				fs.unlinkSync(path.join(target.dir, existing));
			}
		}

		const rules = [];
		let bytes = 0;
		let files = 0;

		for (const spec of specs) {
			const result = await fetchFamily(spec, target.dir);
			rules.push(...result.rules);
			bytes += result.bytes;
			files += result.files;
		}

		const header = [
			"/*",
			" * Self-hosted webfonts. GENERATED by dev/fetch-fonts.js — do not edit.",
			" * Regenerate with `npm run fonts:fetch`.",
			" *",
			` * ${target.note}`,
			" *",
			" * Every family here is SIL Open Font License 1.1; each one's licence text",
			" * sits beside it as OFL-<family>.txt and must ship with the files.",
			" * Subsets: latin, latin-ext.",
			" */",
			"",
		].join("\n");

		fs.writeFileSync(
			path.join(target.dir, "fonts.css"),
			`${header}\n${rules.join("\n\n")}\n`,
		);

		console.log(
			`  → ${files} files, ${(bytes / 1024).toFixed(1)} KB total, fonts.css written`,
		);
	}

	console.log("\n🏁 Fonts fetched.");
}

main().catch((error) => {
	console.error("❌ Font fetch failed:", error.message);
	process.exit(1);
});
