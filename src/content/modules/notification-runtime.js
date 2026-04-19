/**
 * Notification and status-data helpers extracted from content.js.
 */

export function createNotificationRuntime({
	documentRef = document,
	browserRef = browser,
	windowRef = window,
	getNovelLibrary = () => null,
}) {
	let lastKnownNovelData = null;

	function normalizeNotificationTypeRuntime(type) {
		switch (type) {
			case "success":
				return "success";
			case "error":
				return "error";
			case "warning":
				return "warning";
			case "action":
			case "banner":
				return "banner";
			case "updating":
				return "info";
			default:
				return "info";
		}
	}

	function buildNovelDataFromMetadataRuntime(metadata) {
		if (!metadata) return null;
		return {
			id: metadata.id,
			novelId: metadata.id,
			shelfId: metadata.shelfId,
			bookTitle: metadata.title,
			title: metadata.title,
			author: metadata.author,
			currentChapter: metadata.currentChapter,
			totalChapters: metadata.totalChapters,
			source: metadata.source,
			sourceUrl: metadata.sourceUrl,
			mainNovelUrl: metadata.mainNovelUrl,
		};
	}

	function cacheNovelDataRuntime(novelData) {
		if (!novelData) return lastKnownNovelData;
		const cached = {
			id: novelData.id,
			novelId: novelData.novelId || novelData.id,
			shelfId: novelData.shelfId,
			bookTitle: novelData.bookTitle || novelData.title,
			title: novelData.title,
			author: novelData.author,
			currentChapter: novelData.currentChapter,
			totalChapters: novelData.totalChapters,
			source: novelData.source,
			sourceUrl: novelData.sourceUrl,
			mainNovelUrl: novelData.mainNovelUrl,
		};
		lastKnownNovelData = cached;
		return cached;
	}

	function getLastKnownNovelDataRuntime() {
		return lastKnownNovelData;
	}

	async function resolveNovelDataForNotificationRuntime() {
		if (lastKnownNovelData) return lastKnownNovelData;
		const novelLibrary = getNovelLibrary?.();
		if (novelLibrary && typeof novelLibrary.getNovelByUrl === "function") {
			try {
				const novel = await novelLibrary.getNovelByUrl(
					windowRef.location.href,
				);
				if (novel) {
					return cacheNovelDataRuntime(novel);
				}
			} catch (_err) {
				// ignore lookup failures
			}
		}
		return null;
	}

	async function logNotificationRuntime({
		type,
		message,
		title,
		novelData,
		metadata,
		source,
	}) {
		try {
			await browserRef.runtime.sendMessage({
				action: "logNotification",
				type: normalizeNotificationTypeRuntime(type),
				message,
				title: title || documentRef.title,
				url: windowRef.location.href,
				novelData:
					novelData ||
					(await resolveNovelDataForNotificationRuntime()),
				metadata,
				source: source || "content",
			});
		} catch (_error) {
			// Avoid breaking page flow if notification logging fails
		}
	}

	return {
		normalizeNotificationTypeRuntime,
		buildNovelDataFromMetadataRuntime,
		cacheNovelDataRuntime,
		getLastKnownNovelDataRuntime,
		resolveNovelDataForNotificationRuntime,
		logNotificationRuntime,
		showStatusMessageRuntime,
		showTimedBannerRuntime,
		updateBannerFieldRuntime,
	};
}

export function showTimedBannerRuntime({
	message,
	type = "info",
	duration = null,
	options = {},
	documentRef = document,
	windowRef = window,
	bannerConfig = { defaultMs: 4000, mobileBreakpointPx: 768 },
	protectFromThemeExtensions,
	onLogNotification,
}) {
	if (duration === null) {
		duration = bannerConfig.defaultMs;
	}

	const existingBanner = documentRef.getElementById("rg-notification-banner");
	if (existingBanner) {
		existingBanner.remove();
	}

	const banner = documentRef.createElement("div");
	banner.id = "rg-notification-banner";
	banner.className = `rg-banner rg-banner-${type}`;

	protectFromThemeExtensions?.(banner);

	const colors = {
		info: { bg: "#1a237e", border: "#3949ab", icon: "ℹ️" },
		success: { bg: "#1b5e20", border: "#43a047", icon: "✅" },
		warning: { bg: "#e65100", border: "#ff9800", icon: "⚠️" },
		action: { bg: "#4a148c", border: "#7b1fa2", icon: "📙" },
		updating: { bg: "#00695c", border: "#26a69a", icon: "🔄" },
	};

	const color = colors[type] || colors.info;

	banner.style.cssText = `
		position: fixed;
		top: 20px;
		right: 20px;
		background: ${color.bg};
		border: 2px solid ${color.border};
		border-radius: 8px;
		padding: 12px 20px;
		color: white;
		font-family: system-ui, -apple-system, sans-serif;
		font-size: 14px;
		z-index: 999999;
		box-shadow: 0 4px 20px rgba(0,0,0,0.4);
		display: flex;
		align-items: center;
		gap: 12px;
		max-width: 400px;
		animation: rg-slide-in 0.3s ease-out;
	`;

	if (!documentRef.getElementById("rg-banner-styles")) {
		const styleSheet = documentRef.createElement("style");
		styleSheet.id = "rg-banner-styles";
		styleSheet.textContent = `
			@keyframes rg-slide-in {
				from { transform: translateX(100%); opacity: 0; }
				to { transform: translateX(0); opacity: 1; }
			}
			@keyframes rg-slide-out {
				from { transform: translateX(0); opacity: 1; }
				to { transform: translateX(100%); opacity: 0; }
			}
			@keyframes rg-spin {
				from { transform: rotate(0deg); }
				to { transform: rotate(360deg); }
			}
			.rg-banner-updating .rg-banner-icon {
				animation: rg-spin 1s linear infinite;
			}

			@media (max-width: ${bannerConfig.mobileBreakpointPx}px) {
				#rg-notification-banner {
					top: 10px !important;
					right: 10px !important;
					left: 10px !important;
					max-width: none !important;
					font-size: 13px !important;
				}
				.gemini-main-summary-group {
					flex-direction: column !important;
					align-items: stretch !important;
					gap: 8px !important;
				}
				.gemini-main-summary-group button {
					min-height: 44px !important;
					font-size: 14px !important;
				}
				.gemini-chunk-banner {
					flex-wrap: wrap !important;
					gap: 6px !important;
					padding: 8px !important;
				}
				.gemini-chunk-banner button {
					min-height: 40px !important;
					flex: 1 1 calc(50% - 4px) !important;
				}
			}
		`;
		documentRef.head.appendChild(styleSheet);
	}

	const iconSpan = documentRef.createElement("span");
	iconSpan.className = "rg-banner-icon";
	iconSpan.textContent = color.icon;
	iconSpan.style.fontSize = "18px";
	banner.appendChild(iconSpan);

	const msgContainer = documentRef.createElement("div");
	msgContainer.style.flex = "1";

	const msgText = documentRef.createElement("div");
	msgText.textContent = message;
	msgContainer.appendChild(msgText);

	if (options.field) {
		const fieldText = documentRef.createElement("div");
		fieldText.style.cssText =
			"font-size: 12px; opacity: 0.8; margin-top: 4px;";
		fieldText.textContent = `Updating: ${options.field}`;
		msgContainer.appendChild(fieldText);
	}

	banner.appendChild(msgContainer);

	if (options.actionButton) {
		const actionBtn = documentRef.createElement("button");
		actionBtn.textContent = options.actionButton.text;
		actionBtn.style.cssText = `
			background: white;
			color: ${color.bg};
			border: none;
			padding: 6px 12px;
			border-radius: 4px;
			cursor: pointer;
			font-weight: bold;
			font-size: 12px;
			white-space: nowrap;
		`;
		actionBtn.addEventListener("click", () => {
			if (options.actionButton.url) {
				windowRef.open(options.actionButton.url, "_blank");
			} else if (options.actionButton.onClick) {
				options.actionButton.onClick();
			}
			banner.remove();
		});
		banner.appendChild(actionBtn);
	}

	const closeBtn = documentRef.createElement("button");
	closeBtn.textContent = "×";
	closeBtn.style.cssText = `
		background: transparent;
		border: none;
		color: white;
		font-size: 20px;
		cursor: pointer;
		padding: 0 4px;
		opacity: 0.7;
	`;
	closeBtn.addEventListener("click", () => banner.remove());
	banner.appendChild(closeBtn);

	documentRef.body.appendChild(banner);

	onLogNotification?.({
		type,
		message,
		title: options.title,
		novelData: options.novelData,
		metadata: {
			bannerType: type,
			duration,
			field: options.field,
			actionText: options.actionButton?.text || null,
			actionUrl: options.actionButton?.url || null,
		},
		source: options.source || "content",
	});

	if (duration > 0) {
		setTimeout(() => {
			if (banner.parentElement) {
				banner.style.animation = "rg-slide-out 0.3s ease-in forwards";
				setTimeout(() => banner.remove(), 300);
			}
		}, duration);
	}

	return banner;
}

export function showStatusMessageRuntime({
	message,
	type = "info",
	duration = 5000,
	options = {},
	documentRef = document,
	onLogNotification,
}) {
	const bgColor = type === "error" ? "#622020" : "#2c494f";
	const textColor = "#bab9a0";

	let host = documentRef.getElementById("rg-status-host");
	let root = host && host.shadowRoot ? host.shadowRoot : null;

	if (!host) {
		host = documentRef.createElement("div");
		host.id = "rg-status-host";
		host.style.cssText =
			"position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 2147483647; pointer-events: none;";
		try {
			root = host.attachShadow({ mode: "open" });
		} catch (_err) {
			root = host;
		}
		documentRef.documentElement.appendChild(host);
	}

	const messageDiv = documentRef.createElement("div");
	messageDiv.textContent = message;
	messageDiv.classList.add("extraction-message");
	messageDiv.style.cssText = `
    all: initial;
    display: block;
    background-color: ${bgColor};
    color: ${textColor};
    padding: 14px 18px;
    margin: 0;
    border-radius: 6px;
    font-weight: 700;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    font-size: 14px;
    text-align: center;
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    max-width: 80vw;
    border: 1px solid #ffffff21;
    pointer-events: none;
  `;

	if (root) {
		root.appendChild(messageDiv);
	} else {
		documentRef.documentElement.appendChild(messageDiv);
	}

	onLogNotification?.({
		type,
		message,
		title: options.title,
		novelData: options.novelData,
		metadata: options.metadata,
		source: options.source || "content",
	});

	setTimeout(() => {
		if (messageDiv.parentNode) {
			messageDiv.parentNode.removeChild(messageDiv);
		}
	}, duration);
}

export function updateBannerFieldRuntime({ field, documentRef = document }) {
	const banner = documentRef.getElementById("rg-notification-banner");
	if (!banner) return;

	const fieldText = banner.querySelector("div > div:nth-child(2)");
	if (fieldText) {
		fieldText.textContent = `Updating: ${field}`;
	}
}

export default {
	createNotificationRuntime,
	showStatusMessageRuntime,
	showTimedBannerRuntime,
	updateBannerFieldRuntime,
};
