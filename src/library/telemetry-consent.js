/**
 * Telemetry consent helpers for library runtime.
 *
 * Consent is asked once, inline, via the banner at the top of the library.
 * Analytics stays off until it is answered — `getTelemetryConfig` defaults
 * `enabled` to false — so the banner offers a choice rather than announcing
 * something already happening.
 */

export async function checkFirstRunConsentRuntime({
	isFirstRun,
	getTelemetryConfig,
	elements,
	debugError,
}) {
	try {
		const firstRun = await isFirstRun();
		const config = await getTelemetryConfig();

		if (firstRun && !config.consentShown) {
			if (elements.telemetryBanner) {
				elements.telemetryBanner.classList.remove("hidden");
			}
		} else if (elements.telemetryBanner) {
			elements.telemetryBanner.classList.add("hidden");
		}
	} catch (error) {
		debugError("Failed to check first run consent:", error);
	}
}

export function bindTelemetryConsentHandlers({
	elements,
	optInTelemetry,
	optOutTelemetry,
	saveTelemetryConfig,
	markFirstRunComplete,
	showNotification,
}) {
	if (elements.telemetryBannerDisable) {
		elements.telemetryBannerDisable.addEventListener("click", async () => {
			await optOutTelemetry();
			await saveTelemetryConfig({
				consentShown: true,
				consentDate: Date.now(),
			});
			await markFirstRunComplete();
			if (elements.telemetryToggle) {
				elements.telemetryToggle.checked = false;
			}
			if (elements.telemetryBanner) {
				elements.telemetryBanner.classList.add("hidden");
			}
			showNotification(
				"Analytics disabled. You can re-enable anytime in Settings.",
				"info",
			);
		});
	}

	if (elements.telemetryBannerKeep) {
		elements.telemetryBannerKeep.addEventListener("click", async () => {
			await optInTelemetry();
			await markFirstRunComplete();
			if (elements.telemetryToggle) {
				elements.telemetryToggle.checked = true;
			}
			if (elements.telemetryBanner) {
				elements.telemetryBanner.classList.add("hidden");
			}
			showNotification(
				"Thanks for helping improve Ranobe Gemini!",
				"success",
			);
		});
	}
}
