(function () {
	const FALLBACK_VERSION = "";
	const CACHE_KEY = "rg-landing-version-cache";
	const CACHE_TTL_MS = 5 * 60 * 1000;
	const VERSION_NODE_SELECTOR = ".version-display";
	const DEFAULT_VERSION_SOURCE =
		"https://raw.githubusercontent.com/Life-Experimentalist/RanobeGemini/main/package.json";
	let initPromise = null;

	function getVersionSource() {
		return String(window.RG_VERSION_SOURCE || DEFAULT_VERSION_SOURCE);
	}

	function readCache() {
		try {
			const raw = localStorage.getItem(CACHE_KEY);
			if (!raw) return "";
			const parsed = JSON.parse(raw);
			if (!parsed?.version || !parsed?.at) return "";
			if (Date.now() - Number(parsed.at) > CACHE_TTL_MS) return "";
			return String(parsed.version);
		} catch (_) {
			return "";
		}
	}

	function writeCache(version) {
		if (!version) return;
		try {
			localStorage.setItem(
				CACHE_KEY,
				JSON.stringify({ version: String(version), at: Date.now() }),
			);
		} catch (_) {
			// Ignore storage failures.
		}
	}

	async function fetchVersion() {
		const source = getVersionSource();
		try {
			const response = await fetch(source, { cache: "no-store" });
			if (response.ok) {
				const data = await response.json();
				if (data?.version) {
					const version = String(data.version);
					writeCache(version);
					return version;
				}
			}
		} catch (_) {
			// Fall back to cache.
		}

		const cached = readCache();
		if (cached) return cached;
		return FALLBACK_VERSION;
	}

	function applyVersion(version) {
		if (!version) return;
		document.querySelectorAll(VERSION_NODE_SELECTOR).forEach((el) => {
			const prefix = el.getAttribute("data-prefix") ?? "v";
			el.textContent = `${prefix}${version}`;
		});
	}

	function initVersionDisplay() {
		if (initPromise) return initPromise;
		initPromise = (async () => {
			const hasVersionNodes = document.querySelector(
				VERSION_NODE_SELECTOR,
			);
			if (!hasVersionNodes) return;
			const version = await fetchVersion();
			applyVersion(version);
		})();
		return initPromise;
	}

	window.RGVersion = Object.assign({}, window.RGVersion, {
		initVersionDisplay,
	});

	if (document.readyState === "loading") {
		document.addEventListener(
			"DOMContentLoaded",
			() => {
				initVersionDisplay();
			},
			{ once: true },
		);
	} else {
		initVersionDisplay();
	}
})();
