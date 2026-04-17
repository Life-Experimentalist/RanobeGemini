/**
 * Read-aloud UI visibility helpers.
 * Keeps the Gemini overlay hidden from text-to-speech / reader mode unless the
 * user disables the setting in Library preferences.
 */

export function createReadAloudUiRuntime({
	documentRef = document,
	browserRef = browser,
	libraryUiA11yConfig,
	debugLog = () => {},
	debugError = () => {},
}) {
	let readAloudUiObserver = null;
	const READ_ALOUD_UI_SELECTOR =
		".gemini-chunk-banner, .gemini-master-banner, .gemini-wip-banner, .gemini-main-summary-group, .gemini-chunk-summary-group, .gemini-enhanced-banner";

	function releaseAriaHiddenForInteraction(container) {
		if (!container) return;
		container.removeAttribute("aria-hidden");
	}

	function restoreAriaHiddenAfterInteraction(container) {
		if (!container || !libraryUiA11yConfig.hideGeminiUiFromReadAloud) {
			return;
		}
		if (!container.contains(documentRef.activeElement)) {
			container.setAttribute("aria-hidden", "true");
		}
	}

	function applyReadAloudHidingToElement(container) {
		if (!container || !(container instanceof HTMLElement)) return;

		if (!libraryUiA11yConfig.hideGeminiUiFromReadAloud) {
			container.removeAttribute("aria-hidden");
			return;
		}

		container.setAttribute("aria-hidden", "true");

		if (container.dataset.rgReadAloudBound === "1") {
			return;
		}
		container.dataset.rgReadAloudBound = "1";

		container.addEventListener(
			"pointerdown",
			() => releaseAriaHiddenForInteraction(container),
			true,
		);
		container.addEventListener("focusin", () =>
			releaseAriaHiddenForInteraction(container),
		);
		container.addEventListener("focusout", () => {
			setTimeout(() => {
				restoreAriaHiddenAfterInteraction(container);
			}, 0);
		});
		container.addEventListener(
			"click",
			() => {
				setTimeout(() => {
					restoreAriaHiddenAfterInteraction(container);
				}, 0);
			},
			true,
		);
	}

	function applyReadAloudHiding(root = documentRef) {
		if (!root) return;

		if (
			root instanceof HTMLElement &&
			root.matches(READ_ALOUD_UI_SELECTOR)
		) {
			applyReadAloudHidingToElement(root);
		}

		if (typeof root.querySelectorAll !== "function") return;
		root.querySelectorAll(READ_ALOUD_UI_SELECTOR).forEach((el) => {
			applyReadAloudHidingToElement(el);
		});
	}

	async function loadReadAloudUiSetting() {
		try {
			const result = await browserRef.storage.local.get(
				"rg_library_settings",
			);
			const settingValue =
				result?.rg_library_settings?.hideGeminiUiFromReadAloud;
			libraryUiA11yConfig.hideGeminiUiFromReadAloud =
				settingValue !== false;
		} catch (_err) {
			libraryUiA11yConfig.hideGeminiUiFromReadAloud = true;
		}

		applyReadAloudHiding(documentRef);
	}

	function initReadAloudUiObserver() {
		if (readAloudUiObserver || !documentRef.documentElement) return;

		readAloudUiObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (!(node instanceof HTMLElement)) continue;
					applyReadAloudHiding(node);
				}
			}
		});

		readAloudUiObserver.observe(documentRef.documentElement, {
			childList: true,
			subtree: true,
		});

		applyReadAloudHiding(documentRef);
	}

	function destroyReadAloudUiObserver() {
		if (readAloudUiObserver) {
			try {
				readAloudUiObserver.disconnect();
			} catch (error) {
				debugError(
					"Error disconnecting read-aloud UI observer:",
					error,
				);
			}
			readAloudUiObserver = null;
		}
	}

	debugLog("[ReadAloudUi] Runtime created");

	return {
		applyReadAloudHiding,
		loadReadAloudUiSetting,
		initReadAloudUiObserver,
		destroyReadAloudUiObserver,
	};
}

export default {
	createReadAloudUiRuntime,
};
