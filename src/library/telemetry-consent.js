/**
 * Telemetry consent helpers for library runtime.
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
	closeModal,
	showNotification,
}) {
	if (elements.telemetryAcceptBtn) {
		elements.telemetryAcceptBtn.addEventListener("click", async () => {
			await optInTelemetry();
			await markFirstRunComplete();
			closeModal(elements.telemetryConsentModal);
			showNotification(
				"Thank you for helping improve Ranobe Gemini!",
				"success",
			);
		});
	}

	if (elements.telemetryDeclineBtn) {
		elements.telemetryDeclineBtn.addEventListener("click", async () => {
			await optOutTelemetry();
			await markFirstRunComplete();
			if (elements.telemetryToggle) {
				elements.telemetryToggle.checked = false;
			}
			closeModal(elements.telemetryConsentModal);
			showNotification(
				"Analytics disabled. You can re-enable anytime in Settings.",
				"info",
			);
		});
	}

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
