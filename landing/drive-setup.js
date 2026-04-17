const DRIVE_SETUP_CONFIG = {
	brandName: "Ranobe Gemini",
	homepage: "https://ranobe.vkrishna04.me",
	redirectUri: "https://ranobe.vkrishna04.me/oauth-redirect.html",
};

function setText(id, value) {
	const el = document.getElementById(id);
	if (el) el.textContent = value;
}

function applyConfig() {
	setText("brandName", DRIVE_SETUP_CONFIG.brandName);
	setText("oauthRedirect", DRIVE_SETUP_CONFIG.redirectUri);
	setText("chromiumRedirect", DRIVE_SETUP_CONFIG.redirectUri);
	setText("firefoxRedirect", DRIVE_SETUP_CONFIG.redirectUri);
}

function applyRuntimeHints() {
	// No runtime hints needed for the canonical web redirect URI.
}

applyRuntimeHints();
applyConfig();
