const DRIVE_SETUP_CONFIG = {
	brandName: "Ranobe Gemini",
	homepage: "https://ranobe.vkrishna04.me",
	chromiumExtensionId: "agbhdkiciomjlifhlfbjanpnhhokaimn",
	firefoxExtensionId: "33b0347d-8e94-40d6-a169-249716997cc6",
};

function buildRedirect(domain, extensionId) {
	if (!extensionId || extensionId.includes("your-")) {
		return `https://<extension-id>.${domain}/drive`;
	}
	return `https://${extensionId}.${domain}/drive`;
}

function setText(id, value) {
	const el = document.getElementById(id);
	if (el) el.textContent = value;
}

function applyConfig() {
	const savedChromium = localStorage.getItem("rg-landing-chromium-id");
	const savedFirefox = localStorage.getItem("rg-landing-firefox-id");

	if (savedChromium) {
		DRIVE_SETUP_CONFIG.chromiumExtensionId = savedChromium;
	}
	if (savedFirefox) {
		DRIVE_SETUP_CONFIG.firefoxExtensionId = savedFirefox;
	}

	setText("brandName", DRIVE_SETUP_CONFIG.brandName);
	setText("chromiumExtensionId", DRIVE_SETUP_CONFIG.chromiumExtensionId);
	setText("firefoxExtensionId", DRIVE_SETUP_CONFIG.firefoxExtensionId);

	setText(
		"chromiumRedirect",
		buildRedirect(
			"chromiumapp.org",
			DRIVE_SETUP_CONFIG.chromiumExtensionId,
		),
	);
	setText(
		"firefoxRedirect",
		buildRedirect(
			"extensions.allizom.org",
			DRIVE_SETUP_CONFIG.firefoxExtensionId,
		),
	);
}

function applyRuntimeHints() {
	// If this page ever runs in extension context, use runtime.id automatically.
	try {
		if (typeof chrome !== "undefined" && chrome.runtime?.id) {
			localStorage.setItem("rg-landing-chromium-id", chrome.runtime.id);
		}
	} catch (_) {
		// ignore
	}
}

applyRuntimeHints();
applyConfig();
