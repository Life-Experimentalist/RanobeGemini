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

/**
 * Create a modal navigation controller for shelf pages.
 * Keeps prev/next traversal scoped to the current visible novel set.
 *
 * @param {Object} options
 * @param {Function} options.getContextIds - Returns ordered novel IDs for the current modal context.
 * @param {Function} options.findNovelById - Resolves a novel object by ID.
 * @param {Function} options.onOpenNovel - Opens the modal for a novel.
 * @param {string} [options.prevButtonId='modal-prev-btn'] - Previous button element ID.
 * @param {string} [options.nextButtonId='modal-next-btn'] - Next button element ID.
 * @returns {Object} Controller with bind/update/sync helpers.
 */
export function createModalNavigationController({
	getContextIds,
	findNovelById,
	onOpenNovel,
	prevButtonId = "modal-prev-btn",
	nextButtonId = "modal-next-btn",
}) {
	let currentContextIds = [];
	let currentContextIndex = -1;

	function updateButtons() {
		const prevBtn = document.getElementById(prevButtonId);
		const nextBtn = document.getElementById(nextButtonId);
		const hasContext =
			currentContextIds.length > 1 && currentContextIndex >= 0;

		if (prevBtn) {
			prevBtn.disabled = !hasContext || currentContextIndex <= 0;
			prevBtn.style.display = hasContext ? "" : "none";
		}
		if (nextBtn) {
			nextBtn.disabled =
				!hasContext || currentContextIndex >= currentContextIds.length - 1;
			nextBtn.style.display = hasContext ? "" : "none";
		}
	}

	function syncContext(novelId, explicitContextIds = null) {
		const resolvedIds = Array.isArray(explicitContextIds)
			? explicitContextIds.filter(Boolean)
			: (typeof getContextIds === "function" ? getContextIds(novelId) : [])
				.filter(Boolean);

		currentContextIds = resolvedIds;
		currentContextIndex = novelId ? currentContextIds.indexOf(novelId) : -1;

		if (currentContextIndex < 0 && novelId && currentContextIds.length) {
			const resolvedIndex = currentContextIds.indexOf(novelId);
			if (resolvedIndex >= 0) {
				currentContextIndex = resolvedIndex;
			}
		}

		updateButtons();
	}

	async function navigate(offset) {
		if (!currentContextIds.length || currentContextIndex < 0) return;

		const targetIndex = currentContextIndex + offset;
		if (targetIndex < 0 || targetIndex >= currentContextIds.length) return;

		const targetId = currentContextIds[targetIndex];
		if (!targetId || typeof findNovelById !== "function") return;

		const targetNovel = findNovelById(targetId);
		if (!targetNovel || typeof onOpenNovel !== "function") return;

		await onOpenNovel(targetNovel, {
			contextIds: currentContextIds,
			index: targetIndex,
			source: "modal-nav",
		});
	}

	function bind() {
		const prevBtn = document.getElementById(prevButtonId);
		const nextBtn = document.getElementById(nextButtonId);

		if (prevBtn && !prevBtn.dataset.rgModalNavBound) {
			prevBtn.dataset.rgModalNavBound = "1";
			prevBtn.addEventListener("click", () => {
				void navigate(-1);
			});
		}
		if (nextBtn && !nextBtn.dataset.rgModalNavBound) {
			nextBtn.dataset.rgModalNavBound = "1";
			nextBtn.addEventListener("click", () => {
				void navigate(1);
			});
		}

		updateButtons();
	}

	return {
		bind,
		navigate,
		syncContext,
		updateButtons,
		getContextIds: () => [...currentContextIds],
		getContextIndex: () => currentContextIndex,
	};
}

/**
 * Bind a touch swipe-down gesture to dismiss a modal on mobile devices.
 * The gesture is ignored on desktop widths and when modal body is scrolled.
 *
 * @param {Object} options
 * @param {HTMLElement|string} options.modal - Modal element or modal element id.
 * @param {Function} options.onDismiss - Called when swipe threshold is met.
 * @param {string} [options.contentSelector='.modal-content'] - Selector for swipe target container.
 * @param {number} [options.minSwipeDistance=96] - Minimum downward travel to dismiss.
 * @param {number} [options.maxHorizontalDrift=72] - Maximum horizontal movement to still count as dismiss gesture.
 * @param {number} [options.mobileBreakpoint=900] - Max viewport width where swipe dismiss is active.
 * @returns {Function} cleanup function.
 */
export function bindModalSwipeDismiss({
	modal,
	onDismiss,
	contentSelector = ".modal-content",
	minSwipeDistance = 96,
	maxHorizontalDrift = 72,
	mobileBreakpoint = 900,
}) {
	const modalEl =
		typeof modal === "string" ? document.getElementById(modal) : modal;
	if (!modalEl || typeof onDismiss !== "function") {
		return () => {};
	}

	const swipeSurface =
		modalEl.querySelector(contentSelector) ||
		modalEl.querySelector(".modal-content") ||
		modalEl;
	if (!swipeSurface) {
		return () => {};
	}

	let startX = 0;
	let startY = 0;
	let active = false;
	let dragging = false;

	const isModalOpen = () => {
		if (modalEl.classList?.contains("hidden")) return false;
		const style = window.getComputedStyle(modalEl);
		return style.display !== "none" && style.visibility !== "hidden";
	};

	const resetSurface = () => {
		swipeSurface.style.transition = "transform 160ms ease, opacity 160ms ease";
		swipeSurface.style.transform = "";
		swipeSurface.style.opacity = "";
	};

	const isEligibleTouchTarget = (eventTarget) => {
		if (!eventTarget || !(eventTarget instanceof Element)) return true;
		if (
			eventTarget.closest(
				"input, textarea, select, button, a, [role='button'], .modal-header-controls, .modal-corner-nav",
			)
		) {
			return false;
		}
		const body = modalEl.querySelector(".modal-body");
		if (body && body.scrollTop > 0) return false;
		return true;
	};

	const handleTouchStart = (event) => {
		if (window.innerWidth > mobileBreakpoint) return;
		if (!isModalOpen()) return;
		if (event.touches.length !== 1) return;
		if (!isEligibleTouchTarget(event.target)) return;

		const touch = event.touches[0];
		startX = touch.clientX;
		startY = touch.clientY;
		active = true;
		dragging = false;
	};

	const handleTouchMove = (event) => {
		if (!active || event.touches.length !== 1) return;
		const touch = event.touches[0];
		const deltaX = touch.clientX - startX;
		const deltaY = touch.clientY - startY;

		if (deltaY <= 0) return;
		if (Math.abs(deltaX) > maxHorizontalDrift) {
			active = false;
			resetSurface();
			return;
		}

		dragging = true;
		swipeSurface.style.transition = "none";
		swipeSurface.style.transform = `translateY(${Math.min(deltaY, 140)}px)`;
		swipeSurface.style.opacity = `${Math.max(0.76, 1 - deltaY / 520)}`;
	};

	const handleTouchEnd = (event) => {
		if (!active) return;
		active = false;

		const touch = event.changedTouches?.[0];
		const endX = touch ? touch.clientX : startX;
		const endY = touch ? touch.clientY : startY;
		const deltaX = endX - startX;
		const deltaY = endY - startY;

		if (
			dragging &&
			deltaY >= minSwipeDistance &&
			Math.abs(deltaX) <= maxHorizontalDrift
		) {
			swipeSurface.style.transition = "transform 120ms ease, opacity 120ms ease";
			swipeSurface.style.transform = "translateY(160px)";
			swipeSurface.style.opacity = "0";
			setTimeout(() => {
				resetSurface();
				onDismiss();
			}, 120);
			return;
		}

		resetSurface();
	};

	swipeSurface.addEventListener("touchstart", handleTouchStart, {
		passive: true,
	});
	swipeSurface.addEventListener("touchmove", handleTouchMove, {
		passive: true,
	});
	swipeSurface.addEventListener("touchend", handleTouchEnd, {
		passive: true,
	});
	swipeSurface.addEventListener("touchcancel", handleTouchEnd, {
		passive: true,
	});

	return () => {
		swipeSurface.removeEventListener("touchstart", handleTouchStart);
		swipeSurface.removeEventListener("touchmove", handleTouchMove);
		swipeSurface.removeEventListener("touchend", handleTouchEnd);
		swipeSurface.removeEventListener("touchcancel", handleTouchEnd);
	};
}
