/**
 * UI Banners Module
 * Handles creation and management of banners (progress, re-reading, etc.)
 */

export function createToggleBannersButton({
	documentRef = document,
	onToggleBanners = null,
} = {}) {
	const toggleButton = documentRef.createElement("button");
	toggleButton.className = "gemini-toggle-banners-btn";
	toggleButton.innerHTML =
		'<span style="font-size: 20px;">👁</span> <span style="font-weight: 600;">Hide Ranobe Gemini</span>';
	toggleButton.title = "Toggle visibility of Ranobe Gemini enhancement UI";

	toggleButton.style.cssText = `
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 10px 15px;
		margin: 15px 0;
		background-color: #2a2a2a;
		color: #8a8a7d;
		border: 1px solid #444444;
		box-shadow: inset 0 0 0 1px #5a5a5a4d;
		border-radius: 4px;
		cursor: pointer;
		font-weight: bold;
		font-size: 13px;
		z-index: 1000;
	`;

	if (onToggleBanners) {
		toggleButton.addEventListener("click", onToggleBanners);
	}

	toggleButton.addEventListener("mouseover", () => {
		toggleButton.style.backgroundColor = "#353535";
	});
	toggleButton.addEventListener("mouseout", () => {
		toggleButton.style.backgroundColor = "#2a2a2a";
	});

	return toggleButton;
}

export function showProgressUpdatePromptRuntime({
	novelId,
	currentChapter,
	storedChapter,
	totalChapters,
	novelTitle,
	documentRef = document,
	windowRef = window,
	progressPromptState,
	shouldShowProgressPrompt,
	PROGRESS_PROMPT_TIMEOUT_MS,
	onUpdateProgress,
	showTimedBanner,
	bannerConfig,
}) {
	if (!shouldShowProgressPrompt(novelId)) return;
	progressPromptState.set(novelId, Date.now());

	const existing = documentRef.getElementById("rg-progress-banner");
	if (existing) existing.remove();

	const banner = documentRef.createElement("div");
	banner.id = "rg-progress-banner";
	banner.style.cssText = `
		position: fixed; bottom: 24px; right: 24px; background: #0f172a; border: 1px solid #3949ab;
		border-left: 4px solid #6366f1; border-radius: 10px; padding: 14px 16px; color: #e2e8f0;
		font-family: system-ui, -apple-system, sans-serif; font-size: 13px; z-index: 999999;
		box-shadow: 0 8px 32px rgba(0,0,0,0.6); max-width: 380px; min-width: 280px; display: flex;
		flex-direction: column; gap: 10px; animation: rg-slide-in 0.25s ease;
	`;

	if (!documentRef.getElementById("rg-banner-style")) {
		const style = documentRef.createElement("style");
		style.id = "rg-banner-style";
		style.textContent = `
			@keyframes rg-slide-in {
				from { opacity: 0; transform: translateY(12px); }
				to   { opacity: 1; transform: translateY(0); }
			}
		`;
		documentRef.head.appendChild(style);
	}

	const header = documentRef.createElement("div");
	header.style.cssText = "display:flex;align-items:flex-start;justify-content:space-between;gap:8px;";
	const titleEl = documentRef.createElement("div");
	titleEl.style.cssText = "font-weight:700;font-size:13px;color:#818cf8;flex:1;";
	titleEl.textContent = "📖 Reading Progress";
	const closeBtn = documentRef.createElement("button");
	closeBtn.textContent = "×"; closeBtn.style.cssText = "background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1;padding:0;";
	closeBtn.addEventListener("click", () => banner.remove());
	header.appendChild(titleEl); header.appendChild(closeBtn); banner.appendChild(header);

	if (novelTitle) {
		const nTitle = documentRef.createElement("div");
		nTitle.style.cssText = "font-size:12px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px;";
		nTitle.textContent = novelTitle;
		banner.appendChild(nTitle);
	}

	const message = documentRef.createElement("div");
	message.style.cssText = "font-size:13px;color:#cbd5e1;line-height:1.5;";
	message.textContent = storedChapter 
		? `Saved progress: Chapter ${storedChapter}. You are now on Chapter ${currentChapter}.${totalChapters ? ` (of ${totalChapters})` : ""} Update progress?`
		: `No saved progress. You are on Chapter ${currentChapter}.${totalChapters ? ` (of ${totalChapters})` : ""} Save progress?`;
	banner.appendChild(message);

	const actions = documentRef.createElement("div");
	actions.style.cssText = "display:flex;gap:8px;";
	const updateBtn = documentRef.createElement("button");
	updateBtn.textContent = storedChapter ? `Update to Ch. ${currentChapter}` : `Save Ch. ${currentChapter}`;
	updateBtn.style.cssText = "background:#6366f1;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;transition:background 0.15s;";
	
	updateBtn.addEventListener("click", async () => {
		try {
			await onUpdateProgress?.(novelId, currentChapter, windowRef.location.href, totalChapters);
			showTimedBanner?.(`Progress updated to Chapter ${currentChapter}`, "success", bannerConfig?.quickMs);
		} catch (err) {
			showTimedBanner?.("Failed to update progress", "warning", bannerConfig?.quickMs);
		} finally {
			banner.remove();
		}
	});

	const ignoreBtn = documentRef.createElement("button");
	ignoreBtn.textContent = "Dismiss";
	ignoreBtn.style.cssText = "background:transparent;color:#94a3b8;border:1px solid rgba(148,163,184,0.3);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;";
	ignoreBtn.addEventListener("click", () => banner.remove());

	actions.appendChild(updateBtn); actions.appendChild(ignoreBtn); banner.appendChild(actions);
	documentRef.body.appendChild(banner);

	setTimeout(() => { if (banner.parentElement) banner.remove(); }, PROGRESS_PROMPT_TIMEOUT_MS);
}

export function showRereadingBannerRuntime({
	novelId,
	currentChapter,
	lastReadChapter,
	lastReadUrl,
	novelTitle,
	documentRef = document,
	progressPromptState,
	shouldShowProgressPrompt,
	onJumpToChapter,
	onStartRereading,
}) {
	if (!shouldShowProgressPrompt(novelId)) return;
	progressPromptState.set(novelId, Date.now());

	const existing = documentRef.getElementById("rg-progress-banner");
	if (existing) existing.remove();

	const banner = documentRef.createElement("div");
	banner.id = "rg-progress-banner";
	banner.style.cssText = `
		position: fixed; bottom: 24px; right: 24px; background: #1a0a2e; border: 1px solid #7c3aed;
		border-left: 4px solid #9c27b0; border-radius: 10px; padding: 14px 16px; color: #e2e8f0;
		font-family: system-ui, -apple-system, sans-serif; font-size: 13px; z-index: 999999;
		box-shadow: 0 8px 32px rgba(0,0,0,0.6); max-width: 380px; min-width: 280px; display: flex;
		flex-direction: column; gap: 10px; animation: rg-slide-in 0.25s ease;
	`;

	const header = documentRef.createElement("div");
	header.style.cssText = "display:flex;align-items:flex-start;justify-content:space-between;gap:8px;";
	const titleEl = documentRef.createElement("div");
	titleEl.style.cssText = "font-weight:700;font-size:13px;color:#a855f7;flex:1;";
	titleEl.textContent = "♻️ Re-reading Detection";
	const closeBtn = documentRef.createElement("button");
	closeBtn.textContent = "×"; closeBtn.style.cssText = "background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1;padding:0;";
	closeBtn.addEventListener("click", () => banner.remove());
	header.appendChild(titleEl); header.appendChild(closeBtn); banner.appendChild(header);

	if (novelTitle) {
		const nTitle = documentRef.createElement("div");
		nTitle.style.cssText = "font-size:12px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px;";
		nTitle.textContent = novelTitle;
		banner.appendChild(nTitle);
	}

	const message = documentRef.createElement("div");
	message.style.cssText = "font-size:13px;color:#cbd5e1;line-height:1.5;";
	message.textContent = `You previously reached Chapter ${lastReadChapter}. You are now on Chapter ${currentChapter}. What would you like to do?`;
	banner.appendChild(message);

	const actions = documentRef.createElement("div");
	actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
	const jumpBtn = documentRef.createElement("button");
	jumpBtn.textContent = `Continue Ch. ${lastReadChapter}`;
	jumpBtn.style.cssText = "background:#7c3aed;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;";
	const rereadingBtn = documentRef.createElement("button");
	rereadingBtn.textContent = "Start Re-reading";
	rereadingBtn.style.cssText = "background:transparent;color:#d8b4fe;border:1px solid #7c3aed;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;";

	jumpBtn.addEventListener("click", () => { onJumpToChapter?.(lastReadUrl); banner.remove(); });
	rereadingBtn.addEventListener("click", () => { onStartRereading?.(novelId); banner.remove(); });

	actions.appendChild(jumpBtn); actions.appendChild(rereadingBtn); banner.appendChild(actions);
	documentRef.body.appendChild(banner);
}

export function deriveReadingStatusFromProgressRuntime(current, total) {
	if (!total) return "READING";
	const ratio = current / total;
	if (ratio >= 0.98) return "COMPLETED";
	if (ratio > 0) return "READING";
	return "PLAN_TO_READ";
}

export function shouldShowProgressPromptRuntime(novelId, progressPromptState, TIMEOUT_MS) {
	const lastShown = progressPromptState.get(novelId);
	if (!lastShown) return true;
	return Date.now() - lastShown > TIMEOUT_MS;
}
