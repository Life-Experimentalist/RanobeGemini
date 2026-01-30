const DRIVE_SETUP_CONFIG = {
	brandName: "Ranobe Gemini",
	homepage: "https://ranobe.vkrishna04.me",
	chromiumExtensionId: "achemoeefcaafoiepmikeiocahcjkjop",
	firefoxExtensionId: "your-firefox-addon-id",
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
			"moz-extension.org",
			DRIVE_SETUP_CONFIG.firefoxExtensionId,
		),
	);
}

applyConfig();
