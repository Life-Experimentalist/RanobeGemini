/**
 * Manifest synchroniser.
 *
 * The manifests are the single source of truth for the extension's identity
 * (version, name, platform-specific keys), but every value that MUST be
 * identical across platforms — or that is derived from the site handlers — is
 * owned by this script. Editing those blocks by hand in the manifests will be
 * overwritten on the next build.
 *
 * Owned here:
 *   - content_scripts[site].matches          (derived from handler SUPPORTED_DOMAINS)
 *   - content_scripts[landing].matches       (derived from OAUTH_REDIRECT_URIS.web)
 *   - web_accessible_resources[0].matches    (same patterns)
 *   - web_accessible_resources[0].resources  (shared list, must not drift)
 *   - optional_host_permissions              (same patterns — kept in lockstep)
 *   - permissions                            (shared list)
 *   - host_permissions                       (shared list)
 *   - content_security_policy.extension_pages
 *
 * Run via `npm run update-domains`, or automatically on every build.
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

/**
 * Permissions required on both platforms. Anything platform-specific is added
 * in `PLATFORM_PERMISSIONS` so the difference is explicit and reviewable.
 *
 * Every entry must have a caller. `activeTab` used to be listed and was
 * removed: it only grants anything in combination with `scripting.executeScript`
 * or a `tabs` field read after a user gesture, and this extension does neither —
 * the content script is declared in `content_scripts` and its host access comes
 * from `optional_host_permissions`. An unused permission is a store-review flag
 * and an install-prompt line the user is asked to accept for nothing.
 *
 * `downloads` is used: `createBackupFile` (background.js) calls `downloadText`,
 * which calls `downloads.download`. The in-page export buttons use an
 * `<a download>` anchor instead, but the rolling background backup has no DOM
 * to hang an anchor off, so the API call is the only way it can work.
 */
const SHARED_PERMISSIONS = [
	"alarms",
	"contextMenus",
	"downloads",
	"identity",
	"notifications",
	"storage",
	"tabs",
];

/**
 * Origins the background script fetches unconditionally, i.e. before the user
 * has granted any optional site access.
 *
 * Deliberately minimal, but it must cover the paths the extension cannot work
 * without. `accounts.google.com` used to be listed and was removed: it is only
 * ever *navigated to* by `identity.launchWebAuthFlow`, never fetched.
 *
 *   generativelanguage.googleapis.com — every Gemini request. This is the
 *     extension's primary function. Google currently serves it with permissive
 *     CORS headers, which is why it worked while undeclared, but resting the
 *     core feature on a third party's CORS policy means it can break without a
 *     line of our code changing.
 *   oauth2.googleapis.com — fetched on every Drive token refresh.
 *   www.googleapis.com — Drive file read/write.
 *
 * Everything else the extension can talk to is deliberately absent, and stays
 * absent:
 *
 *   api.openai.com, an OpenAI-compatible base URL, a local Ollama server, a
 *   WebDAV server, api/content.dropboxapi.com, graph.microsoft.com,
 *   login.microsoftonline.com, counter.vkrishna04.me (opt-in telemetry).
 *
 * All of those are opt-in, several are user-typed and therefore not
 * enumerable in a manifest at all, and all of them are reached from an
 * extension page or the background with CORS. Listing them in
 * `optional_host_permissions` without a `permissions.request()` call behind
 * each connect button would be a declared-but-unused permission — the same
 * defect that got `activeTab` removed above — so if that changes, the request
 * call and the manifest entry land together.
 */
const HOST_PERMISSIONS = [
	"https://generativelanguage.googleapis.com/*",
	"https://oauth2.googleapis.com/*",
	"https://www.googleapis.com/*",
];

const PLATFORM_PERMISSIONS = {
	// Chromium service workers have no DOM, so HTML/XML parsing is delegated to
	// an offscreen document. Firefox's event page can parse inline.
	//
	// `sidePanel` backs the `side_panel` manifest key. Chrome will not register
	// the panel from `default_path` alone — the permission is what makes the key
	// take effect — so the two must ship together. Firefox's equivalent is
	// `sidebar_action`, which needs no permission.
	chromium: ["offscreen", "sidePanel"],
	firefox: [],
};

/**
 * Extension files reachable from a content script (dynamic import / getURL) or
 * from an injected page. Must be identical on both platforms — a module missing
 * here fails to load at runtime with an opaque error.
 */
const WEB_ACCESSIBLE_RESOURCES = [
	"lib/browser-polyfill.min.js",
	"icons/*.png",
	"utils/*.js",
	"utils/website-handlers/*.js",
	"utils/chunking/*.js",
	"content/content.*",
	"content/modules/*.js",
	"config/*.js",
	"popup/*.html",
	"popup/*.js",
	"library/*.html",
	"library/*.css",
	"library/*.js",
	"library/modules/*.js",
	"library/websites/*.js",
	// The reading typefaces. `fonts.css` is injected into the novel page as a
	// content-script stylesheet, and its `url()` references resolve against the
	// extension origin — so the .woff2 files have to be reachable from the host
	// page or every @font-face silently falls back to the site's own face.
	"fonts/*.css",
	"fonts/*.woff2",
];

/**
 * Content Security Policy for extension pages (popup, library, settings).
 *
 * MV3 already enforces `script-src 'self'; object-src 'self'` by default, so
 * this is not a behavioural tightening for scripts — it is declared explicitly
 * so the policy is reviewable, and so the directives MV3 does NOT default
 * (`style-src`, `img-src`, `connect-src`, `frame-ancestors`, `base-uri`,
 * `form-action`) are actually locked down.
 *
 * `style-src` needs `'unsafe-inline'`: the UI sets element `.style.*`
 * properties and interpolates `style="…"` into templates throughout the popup
 * and library. `img-src` needs `https:` and `data:` because novel covers are
 * remote and some are inlined.
 */
const EXTENSION_PAGES_CSP = [
	"default-src 'self'",
	"script-src 'self'",
	"object-src 'none'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: https:",
	"connect-src 'self' https:",
	"frame-ancestors 'none'",
	"base-uri 'none'",
	"form-action 'none'",
].join("; ");

/**
 * The landing-page origin, read out of `src/utils/constants.js`.
 *
 * The same origin is the OAuth redirect target, the `LANDING_ORIGIN` guard in
 * background.js, and the landing-bridge content-script match in both manifests.
 * Only the constant is authored; everything else is stamped from it. This is a
 * regex read rather than an import because this script is CommonJS and
 * constants.js is an ES module — the same approach the handler scan above uses.
 */
function extractLandingOrigin() {
	const constantsPath = path.join(ROOT_DIR, "src", "utils", "constants.js");
	const content = fs.readFileSync(constantsPath, "utf8");

	const block = content.match(
		/export\s+const\s+OAUTH_REDIRECT_URIS\s*=\s*\{([\s\S]*?)\}/,
	);
	const web = block && block[1].match(/web:\s*"([^"]+)"/);
	if (!web) {
		throw new Error(
			"Could not read OAUTH_REDIRECT_URIS.web from src/utils/constants.js — refusing to guess the landing origin.",
		);
	}

	return new URL(web[1]).origin;
}

function extractDomainsFromHandlers() {
	const handlersDir = path.join(ROOT_DIR, "src", "utils", "website-handlers");
	const handlerFiles = fs
		.readdirSync(handlersDir)
		.filter(
			(file) => file.endsWith("-handler.js") && !file.startsWith("base"),
		);

	const explicitDomains = new Set();

	handlerFiles.forEach((file) => {
		const filePath = path.join(handlersDir, file);
		const content = fs.readFileSync(filePath, "utf8");

		const match = content.match(
			/static\s+SUPPORTED_DOMAINS\s*=\s*\[([\s\S]*?)\]/,
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

	if (explicitDomains.size === 0) {
		throw new Error(
			"No SUPPORTED_DOMAINS found in any handler — refusing to write empty match patterns.",
		);
	}

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
	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
	const before = JSON.stringify(manifest);

	const domains = extractDomainsFromHandlers();
	const matches = generateMatchPatterns(domains);

	// Permissions: shared list plus any platform-specific additions.
	manifest.permissions = [
		...SHARED_PERMISSIONS,
		...(PLATFORM_PERMISSIONS[platform] || []),
	].sort();

	// The site content script is the entry whose matches are handler-derived.
	const siteEntry = (manifest.content_scripts || []).find((cs) =>
		(cs.js || []).some((f) => f.endsWith("content/content.js")),
	);
	if (siteEntry) {
		siteEntry.matches = matches;
	}

	// The landing bridge matches exactly one origin, and that origin is also
	// compiled into background.js as the `oauthTabRelay` sender guard. Stamping it
	// here means the two can never drift apart into a bridge that runs where the
	// guard rejects it (or, worse, the reverse).
	const landingEntry = (manifest.content_scripts || []).find((cs) =>
		(cs.js || []).some((f) => f.endsWith("content/landing-bridge.js")),
	);
	if (landingEntry) {
		landingEntry.matches = [`${extractLandingOrigin()}/*`];
	}

	if (manifest.web_accessible_resources?.[0]) {
		manifest.web_accessible_resources[0].matches = matches;
		manifest.web_accessible_resources[0].resources = [
			...WEB_ACCESSIBLE_RESOURCES,
		];
	}

	manifest.host_permissions = [...HOST_PERMISSIONS];

	// Site access is optional and requested at runtime, so these must track the
	// content-script matches exactly or the runtime request will fail.
	manifest.optional_host_permissions = matches;

	manifest.content_security_policy = {
		...(manifest.content_security_policy || {}),
		extension_pages: EXTENSION_PAGES_CSP,
	};

	const after = JSON.stringify(manifest);
	if (before !== after) {
		fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t"));
		console.log(
			`✅ ${platform}: synced ${matches.length} domain patterns, ${manifest.permissions.length} permissions`,
		);
	} else {
		console.log(`✓ ${platform}: already in sync`);
	}
}

try {
	updateManifest(MANIFEST_FIREFOX, "firefox");
	updateManifest(MANIFEST_CHROMIUM, "chromium");
} catch (error) {
	console.error("❌ Error updating manifests:", error.message);
	process.exit(1);
}
