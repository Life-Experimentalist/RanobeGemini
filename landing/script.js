// Browser cards and site cards data
const BROWSERS = [
	{
		name: "Firefox",
		status: "ready",
		description: "Desktop + mobile add-on",
		icon: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Firefox_logo%2C_2019.svg",
		extensionId: "33b0347d-8e94-40d6-a169-249716997cc6", // moz-extension IDs rotate; detection via postMessage
		cta: {
			label: "Get it for Firefox",
			href: "https://addons.mozilla.org/en-US/firefox/addon/ranobegemini/",
		},
	},
	{
		name: "Edge",
		status: "ready",
		description: "Desktop sideload; mobile sideload limited",
		icon: "https://upload.wikimedia.org/wikipedia/commons/9/98/Microsoft_Edge_logo_%282019%29.svg",
		extensionId: "agbhdkiciomjlifhlfbjanpnhhokaimn", // set persistent Chromium extension ID if signed with key
		cta: {
			label: "Get it for Edge",
			href: "https://microsoftedge.microsoft.com/addons/detail/ranobe-gemini/agbhdkiciomjlifhlfbjanpnhhokaimn",
		},
	},
	{
		name: "Chrome",
		status: "coming",
		description: "Chromium zip works when sideloaded; store build coming",
		icon: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Google_Chrome_icon_%28February_2022%29.svg",
		cta: {
			label: "Side Load",
			href: "https://github.com/Life-Experimentalist/RanobeGemini/releases/latest/download/dist-chromium.zip",
		},
	},
	{
		name: "Brave",
		status: "coming",
		description: "Supported via Chromium zip; store listing coming",
		icon: "https://upload.wikimedia.org/wikipedia/commons/5/51/Brave_icon_lionface.png",
		cta: {
			label: "Side Load",
			href: "https://github.com/Life-Experimentalist/RanobeGemini/releases/latest/download/dist-chromium.zip",
		},
	},
	// {
	// 	name: "Opera / Vivaldi",
	// 	status: "coming",
	// 	description: "Works with Chromium.zip side-load; store builds planned",
	// 	icon: "https://upload.wikimedia.org/wikipedia/commons/4/49/Opera_2015_icon.svg",
	// 	cta: {
	// 		label: "Side Load",
	// 		href: "https://github.com/Life-Experimentalist/RanobeGemini/releases/latest/download/dist-chromium.zip",
	// 	},
	// },
];

const SITES = [
	{
		id: "ao3",
		name: "Archive of Our Own",
		description: "Primary handler with rich formatting",
		icon: "https://archiveofourown.org/images/ao3_logos/logo_42.png",
		status: "ready",
	},
	{
		id: "fanfiction",
		name: "FanFiction.net",
		description: "Desktop and mobile handlers",
		icon: "https://raw.githubusercontent.com/Life-Experimentalist/RanobeGemini/refs/heads/main/landing/assets/fanfiction.ico",
		status: "ready",
	},
	{
		id: "ranobes",
		name: "Ranobes",
		description: "Dedicated novel pages and chapters",
		icon: "https://raw.githubusercontent.com/Life-Experimentalist/RanobeGemini/refs/heads/main/landing/assets/ranobes.ico",
		status: "ready",
	},
	{
		id: "scribblehub",
		name: "ScribbleHub",
		description: "Optimized for series and chapters",
		icon: "https://www.scribblehub.com/favicon.ico",
		status: "ready",
	},
	{
		id: "webnovel",
		name: "WebNovel",
		description: "Temporarily disabled while we refine",
		icon: "https://www.yueimg.com/en/favicon/favicon.d3f6a.ico",
		status: "paused",
	},
];

function createStatusBadge(status) {
	const badge = document.createElement("span");
	badge.className = `status-badge ${status === "ready" ? "ready" : ""}`;
	badge.textContent =
		status === "ready"
			? "Ready"
			: status === "paused"
				? "Paused"
				: "Coming soon";
	return badge;
}

function renderBrowsers() {
	const grid = document.getElementById("browser-grid");
	if (!grid) return;
	grid.innerHTML = "";

	BROWSERS.forEach((browser) => {
		const card = document.createElement("div");
		card.className = `browser-card ${browser.status}`;

		const iconWrap = document.createElement("div");
		iconWrap.className = "browser-icon";
		const img = document.createElement("img");
		img.src = browser.icon;
		img.alt = `${browser.name} icon`;
		img.style.width = "32px";
		img.style.height = "32px";
		img.loading = "lazy";
		iconWrap.appendChild(img);

		const meta = document.createElement("div");
		meta.className = "browser-meta";
		const title = document.createElement("h4");
		title.textContent = browser.name;
		const desc = document.createElement("p");
		desc.textContent = browser.description;

		const actions = document.createElement("div");
		actions.className = "browser-actions";

		if (browser.cta) {
			const link = document.createElement("a");
			link.className = "btn secondary";
			link.href = browser.cta.href;
			link.target = "_blank";
			link.rel = "noreferrer";
			link.textContent = browser.cta.label;
			actions.appendChild(link);
		} else {
			const btn = document.createElement("button");
			btn.className = "btn ghost";
			btn.textContent = "Coming soon";
			btn.disabled = true;
			actions.appendChild(btn);
		}

		const badge = createStatusBadge(browser.status);
		actions.appendChild(badge);

		meta.appendChild(title);
		meta.appendChild(desc);
		meta.appendChild(actions);

		card.appendChild(iconWrap);
		card.appendChild(meta);
		grid.appendChild(card);
	});
}

function renderSites() {
	const grid = document.getElementById("site-grid");
	if (!grid) return;
	grid.innerHTML = "";

	SITES.forEach((site) => {
		const card = document.createElement("div");
		card.className = `site-card ${site.status}`;

		const iconWrap = document.createElement("div");
		iconWrap.className = "site-icon";
		const img = document.createElement("img");
		img.src = site.icon;
		img.alt = `${site.name} icon`;
		img.loading = "lazy";
		img.onerror = () => (img.style.opacity = "0.5");
		iconWrap.appendChild(img);

		const meta = document.createElement("div");
		meta.className = "site-meta";
		const title = document.createElement("h4");
		title.textContent = site.name;
		const desc = document.createElement("p");
		desc.textContent = site.description;

		const pill = document.createElement("span");
		pill.className = "pill";
		pill.textContent =
			site.status === "ready"
				? "Supported"
				: site.status === "paused"
					? "Disabled"
					: "Coming";

		meta.appendChild(title);
		meta.appendChild(desc);
		meta.appendChild(pill);

		card.appendChild(iconWrap);
		card.appendChild(meta);
		grid.appendChild(card);
	});
}

// Extension detection for library button
const libraryBtn = document.getElementById("library-btn");
const libraryNote = document.getElementById("library-note");
let extensionDetected = false;
let libraryUrl = null;

const EXTENSION_IDS = {
	chromium: [
		...BROWSERS.map((b) => b.extensionId).filter(Boolean),
		...(window.RG_EXTENSION_IDS?.chromium || []),
	],
};

function showLibraryButton() {
	if (!libraryBtn) return;
	libraryBtn.classList.remove("hidden");
	libraryBtn.removeAttribute("disabled");
	libraryBtn.classList.remove("ghost");
	libraryBtn.classList.add("primarysecondary");
	libraryBtn.textContent = "Open Library";
	if (libraryNote) {
		libraryNote.textContent =
			"Extension detected — open your library directly.";
	}
}

function hideLibraryButton() {
	if (!libraryBtn) return;
	libraryBtn.classList.add("hidden");
	libraryBtn.setAttribute("disabled", "disabled");
	libraryBtn.classList.add("ghost");
}

function updateLibraryButton() {
	if (!libraryBtn) return;
	if (!extensionDetected) {
		hideLibraryButton();
		return;
	}
	showLibraryButton();
}

function pingExtension() {
	return new Promise((resolve) => {
		let settled = false;
		const handler = (event) => {
			const data = event?.data || {};
			if (data?.type === "RG_PONG") {
				settled = true;
				extensionDetected = true;
				libraryUrl = data.libraryUrl || data.url || null;
				window.removeEventListener("message", handler);
				updateLibraryButton();
				resolve(true);
			}
		};
		window.addEventListener("message", handler);
		window.postMessage({ source: "ranobe-landing", type: "RG_PING" }, "*");
		setTimeout(() => {
			if (!settled) {
				window.removeEventListener("message", handler);
				resolve(false);
			}
		}, 900);
	});
}

function probeExtensionById(extensionId) {
	return new Promise((resolve) => {
		const iframe = document.createElement("iframe");
		iframe.style.display = "none";
		iframe.referrerPolicy = "no-referrer";
		iframe.src = `chrome-extension://${extensionId}/library/library.html`;
		let done = false;

		const cleanup = () => {
			if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
		};

		iframe.onload = () => {
			if (done) return;
			done = true;
			cleanup();
			resolve({ found: true, url: iframe.src });
		};

		iframe.onerror = () => {
			if (done) return;
			done = true;
			cleanup();
			resolve({ found: false });
		};

		setTimeout(() => {
			if (done) return;
			done = true;
			cleanup();
			resolve({ found: false });
		}, 1200);

		document.body.appendChild(iframe);
	});
}

async function detectExtension() {
	hideLibraryButton();

	const pinged = await pingExtension();
	if (pinged) {
		extensionDetected = true;
		updateLibraryButton();
		updateCtaLibraryButton();
		return;
	}

	for (const id of EXTENSION_IDS.chromium) {
		if (!id) continue;
		// eslint-disable-next-line no-await-in-loop
		const result = await probeExtensionById(id);
		if (result?.found) {
			extensionDetected = true;
			libraryUrl = result.url;
			updateLibraryButton();
			updateCtaLibraryButton();
			return;
		}
	}

	if (libraryNote) {
		libraryNote.textContent =
			"Install the extension, then reload this page to open the library directly.";
	}
}

// Detect browser type
function detectBrowser() {
	const userAgent = navigator.userAgent.toLowerCase();
	if (/firefox/.test(userAgent)) return "firefox";
	if (/edg/.test(userAgent)) return "edge";
	if (/chrome/.test(userAgent)) return "chrome";
	return "unknown";
}

// Build library URL based on browser
function buildLibraryUrl() {
	const browser = detectBrowser();

	if (browser === "firefox") {
		// Firefox uses manifest ID
		return "moz-extension://33b0347d-8e94-40d6-a169-249716997cc6/library/library.html";
	} else if (browser === "edge" || browser === "chrome") {
		// Try to use detected extension ID from BROWSERS array
		const edgeBrowser = BROWSERS.find((b) => b.name === "Edge");
		if (edgeBrowser?.extensionId) {
			return `chrome-extension://${edgeBrowser.extensionId}/library/library.html`;
		}
	}

	return libraryUrl || null;
}

libraryBtn?.addEventListener("click", async () => {
	if (extensionDetected) {
		const target = buildLibraryUrl();
		if (target) {
			window.open(target, "_blank", "noopener,noreferrer");
		} else {
			alert(
				"Could not determine extension URL. Please open the library from the extension popup.",
			);
		}
		return;
	}

	const detected = await pingExtension();
	if (!detected) {
		if (libraryNote) {
			libraryNote.textContent =
				"Install the extension, then reload to unlock the Library button.";
		}
		const browsersSection = document.getElementById("browsers");
		browsersSection?.scrollIntoView({ behavior: "smooth", block: "start" });
	}
});

// Also handle CTA library button
const ctaLibraryBtn = document.getElementById("cta-library-btn");
if (ctaLibraryBtn) {
	ctaLibraryBtn.addEventListener("click", () => {
		const target = buildLibraryUrl();
		if (target) {
			window.open(target, "_blank", "noopener,noreferrer");
		} else {
			alert(
				"Could not determine extension URL. Please open the library from the extension popup.",
			);
		}
	});
}

// Show CTA library button if extension detected
function updateCtaLibraryButton() {
	if (ctaLibraryBtn && extensionDetected) {
		ctaLibraryBtn.style.display = "inline-block";
	}
}

// Simple scroll reveal
const observer = new IntersectionObserver(
	(entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				entry.target.classList.add("visible");
				observer.unobserve(entry.target);
			}
		});
	},
	{ threshold: 0.2 },
);

document.querySelectorAll(".fade-slide").forEach((el) => observer.observe(el));

// Smooth scroll for internal links
const links = document.querySelectorAll('a[href^="#"]');
links.forEach((link) => {
	link.addEventListener("click", (e) => {
		const targetId = link.getAttribute("href").substring(1);
		const target = document.getElementById(targetId);
		if (target) {
			e.preventDefault();
			target.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	});
});

// Initial render
renderBrowsers();
renderSites();
detectExtension();

// Fetch version from package.json
(async () => {
	try {
		// Try fetching from root first (local dev or root-served site)
		let response = await fetch("../package.json");
		if (!response.ok) {
			// Fallback to GitHub raw for hosted landing page if relative fetch fails
			response = await fetch(
				"https://raw.githubusercontent.com/Life-Experimentalist/RanobeGemini/main/package.json",
			);
		}

		if (response.ok) {
			const data = await response.json();
			const versionElements =
				document.querySelectorAll(".version-display");
			versionElements.forEach((el) => {
				el.textContent = `v${data.version}`;
			});
		}
	} catch (e) {
		console.error("Failed to fetch version", e);
	}
})();
