/**
 * Shared helper functions for shelf pages across all website handlers
 * Reduces code duplication in individual shelf-page.js files
 */

import { SHELVES } from "../utils/novel-library.js";

/**
 * Open a novel from query parameters
 * @param {Array} allNovels - Array of all novels to search
 * @param {Function} onOpenNovel - Callback function to open the novel (e.g., showNovelModal or openNovelDetails)
 * @param {Function} showToast - Toast notification function
 */
export function openNovelFromQuery(
	allNovels,
	onOpenNovel,
	showToast = () => {},
) {
	try {
		const params = new URLSearchParams(window.location.search);
		const novelId = params.get("novel");
		if (!novelId) return;

		const novel = allNovels.find((n) => n && n.id === novelId);
		if (novel) {
			onOpenNovel(novel);
		} else {
			showToast("Novel not found in this shelf", "info");
		}
	} catch (_err) {
		// ignore
	}
}

function parseNovelIdIdentity(novelId) {
	const safe = String(novelId || "").trim();
	if (!safe.includes("-")) return null;
	const dashIndex = safe.indexOf("-");
	const shelfId = safe.slice(0, dashIndex);
	const siteNovelId = safe.slice(dashIndex + 1);
	if (!shelfId || !siteNovelId) return null;
	return { shelfId, siteNovelId };
}

function buildImportUrlFromNovelId(novelId) {
	const identity = parseNovelIdIdentity(novelId);
	if (!identity) return null;
	const shelf = SHELVES?.[identity.shelfId];
	const template = shelf?.importUrlTemplate;
	if (!template) return null;
	return {
		...identity,
		generatedUrl: template.replace(
			"{id}",
			encodeURIComponent(identity.siteNovelId),
		),
	};
}

function waitForTabComplete(tabId, timeoutMs = 20000) {
	return new Promise((resolve, reject) => {
		let timeoutId = null;
		let done = false;
		let onUpdated = null;

		const cleanup = () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			if (onUpdated) {
				try {
					browser.tabs.onUpdated.removeListener(onUpdated);
				} catch (_err) {
					// ignore cleanup errors
				}
			}
		};

		onUpdated = (updatedTabId, info) => {
			if (done) return;
			if (updatedTabId !== tabId || info.status !== "complete") return;
			done = true;
			cleanup();
			resolve();
		};

		browser.tabs.onUpdated.addListener(onUpdated);

		try {
			timeoutId = setTimeout(() => {
				if (done) return;
				done = true;
				cleanup();
				reject(new Error("Timed out waiting for tab load"));
			}, timeoutMs);
		} catch (err) {
			if (!done) {
				done = true;
				cleanup();
				reject(err);
			}
		}
	});
}

async function sendAddToLibraryMessage(tabId) {
	const maxAttempts = 3;
	for (let i = 0; i < maxAttempts; i += 1) {
		try {
			const resp = await browser.tabs.sendMessage(tabId, {
				action: "addToLibrary",
			});
			if (resp?.success) return true;
		} catch (_err) {
			// retry
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	return false;
}

function showAutoImportPrompt({
	novelId,
	generatedUrl,
	autoDelayMs,
	onProceed,
	onCancel,
}) {
	const existing = document.getElementById("rg-deeplink-recovery-prompt");
	if (existing) existing.remove();

	const prompt = document.createElement("div");
	prompt.id = "rg-deeplink-recovery-prompt";
	prompt.style.cssText = `
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 2147483646;
		max-width: 420px;
		background: #111827;
		color: #f3f4f6;
		border: 1px solid #374151;
		border-radius: 10px;
		box-shadow: 0 10px 25px rgba(0,0,0,0.35);
		padding: 12px;
		font-size: 13px;
		line-height: 1.45;
	`;

	const countdownId = "rg-deeplink-countdown";
	prompt.innerHTML = `
		<div style="font-weight:700;margin-bottom:6px;">Novel Not Found In Library</div>
		<div style="margin-bottom:8px;">
			Could not find <strong>${novelId}</strong>. Should Ranobe Gemini open the generated source URL and auto-add it to your library?
		</div>
		<div style="margin-bottom:10px;color:#9ca3af;word-break:break-all;">${generatedUrl}</div>
		<div id="${countdownId}" style="margin-bottom:10px;color:#fbbf24;">Auto-open in ${Math.ceil(
			autoDelayMs / 1000,
		)}s...</div>
		<div style="display:flex;gap:8px;justify-content:flex-end;">
			<button id="rg-deeplink-cancel" type="button" style="padding:6px 10px;border-radius:6px;border:1px solid #4b5563;background:#1f2937;color:#e5e7eb;cursor:pointer;">Cancel</button>
			<button id="rg-deeplink-open" type="button" style="padding:6px 10px;border-radius:6px;border:1px solid #2563eb;background:#2563eb;color:#fff;cursor:pointer;">Open and Add</button>
		</div>
	`;

	document.body.appendChild(prompt);

	let finished = false;
	let remaining = Math.ceil(autoDelayMs / 1000);
	const countdownEl = prompt.querySelector(`#${countdownId}`);
	let tickInterval = null;
	let autoTimer = null;

	const cleanup = () => {
		if (finished) return;
		finished = true;
		if (tickInterval) clearInterval(tickInterval);
		if (autoTimer) clearTimeout(autoTimer);
		prompt.remove();
	};

	const proceed = async () => {
		cleanup();
		await onProceed();
	};

	const cancel = () => {
		cleanup();
		onCancel();
	};

	tickInterval = setInterval(() => {
		remaining -= 1;
		if (!countdownEl || finished) return;
		countdownEl.textContent = `Auto-open in ${Math.max(remaining, 0)}s...`;
	}, 1000);

	autoTimer = setTimeout(() => {
		proceed();
	}, autoDelayMs);

	prompt
		.querySelector("#rg-deeplink-open")
		?.addEventListener("click", proceed);
	prompt
		.querySelector("#rg-deeplink-cancel")
		?.addEventListener("click", cancel);
}

/**
 * Attempt recovery when a deep-link points to a novel ID not present in library.
 * Shows a prompt and auto-proceeds after 7 seconds by default.
 */
export async function recoverMissingNovelById(
	novelId,
	{
		showToast = () => {},
		onImported = async () => {},
		autoDelayMs = 7000,
	} = {},
) {
	const candidate = buildImportUrlFromNovelId(novelId);
	if (!candidate) {
		showToast(
			"Novel not found and no import template available for this ID",
			"error",
		);
		return false;
	}

	showAutoImportPrompt({
		novelId,
		generatedUrl: candidate.generatedUrl,
		autoDelayMs,
		onProceed: async () => {
			try {
				const tab = await browser.tabs.create({
					url: candidate.generatedUrl,
					active: true,
				});
				await waitForTabComplete(tab.id);
				const added = await sendAddToLibraryMessage(tab.id);
				if (added) {
					showToast(
						"Opened source URL and added novel to library",
						"success",
					);
				} else {
					showToast(
						"Opened source URL, but auto-add did not confirm. You can add manually.",
						"info",
					);
				}
				await onImported({
					novelId,
					shelfId: candidate.shelfId,
					generatedUrl: candidate.generatedUrl,
					added,
				});
			} catch (err) {
				showToast(
					`Failed to auto-open/import: ${err.message}`,
					"error",
				);
			}
		},
		onCancel: () => {
			showToast("Auto-import cancelled", "info");
		},
	});

	return true;
}

/**
 * Ensure a random select button exists in the filter area
 * Creates the button if it doesn't exist and attaches event listener
 * @param {Function} onRandomPicked - Callback when random novel is selected
 * @param {Array} filteredNovels - Currently filtered novels
 * @param {Array} allNovels - All available novels
 * @param {Function} showToast - Toast notification function
 */
export function ensureRandomSelectButton(
	onRandomPicked,
	filteredNovels,
	allNovels,
	showToast = () => {},
) {
	// Find the search input element - works for both generic and site-specific pages
	const searchInput =
		document.getElementById("search-input") ||
		document.getElementById("shelf-search");

	if (!searchInput) return;

	// Check if button already exists
	if (document.getElementById("random-select-btn")) return;

	const container = searchInput.parentElement;
	if (!container) return;

	const button = document.createElement("button");
	button.type = "button";
	button.id = "random-select-btn";
	button.className = "btn btn-secondary random-select-btn";
	button.textContent = "🎲 Random";
	button.title = "Pick a random novel from current filters";

	button.addEventListener("click", () => {
		const pool =
			filteredNovels && filteredNovels.length > 0
				? filteredNovels
				: allNovels;
		if (!pool.length) {
			showToast("No novels available for random pick", "info");
			return;
		}
		const pick = pool[Math.floor(Math.random() * pool.length)];
		onRandomPicked(pick);
	});

	// Insert before the search input so the button appears to its left
	container.insertBefore(button, searchInput);
}
