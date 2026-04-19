/**
 * UI Element creation helpers extracted from content.js.
 */

export function createUIElementsRuntime({
	documentRef = document,
	windowRef = window,
	browserRef = browser,
	isMobileDevice = false,
	protectFromThemeExtensions = (el) => el,
	currentHandler = null,
	getNovelLibrary = async () => null,
	debugLog = () => {},
	debugError = () => {},
	handlers = {},
} = {}) {
	// --- Internal Helpers ---
	function insertAtPosition(target, node, position = "before") {
		if (!target || !node) return;
		switch (position) {
			case "after":
			case "afterend":
				target.parentNode.insertBefore(node, target.nextSibling);
				break;
			case "prepend":
			case "afterbegin":
				target.prepend(node);
				break;
			case "append":
			case "beforeend":
				target.appendChild(node);
				break;
			default:
				target.parentNode.insertBefore(node, target);
		}
	}

	function resolveNovelControlsInsertion(config = {}) {
		let targetElement = config?.insertionPoint?.element || config?.insertionPoint?.target || config?.insertionPoint || null;
		let position = config?.insertionPoint?.position || config?.position || "after";

		if (!targetElement && typeof currentHandler?.getNovelPageUIInsertionPoint === "function") {
			const handlerPoint = currentHandler.getNovelPageUIInsertionPoint();
			targetElement = handlerPoint?.element || targetElement;
			position = handlerPoint?.position || position;
		}

		if (!targetElement) {
			const mainControls = documentRef.getElementById("gemini-controls");
			if (mainControls) {
				targetElement = mainControls;
				position = "after";
			} else {
				targetElement = documentRef.body.firstChild;
				position = "before";
			}
		}

		return { element: targetElement, position };
	}

	// --- Public UI Creators ---

	function createToggleBannersButton() {
		const toggleButton = documentRef.createElement("button");
		toggleButton.className = "gemini-toggle-banners-btn";
		toggleButton.innerHTML =
			'<span style="font-size: 20px;">👁</span> <span style="font-weight: 600;">Show Ranobe Gemini</span>';
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

		if (handlers.onToggleBanners) {
			toggleButton.addEventListener("click", handlers.onToggleBanners);
		}

		toggleButton.addEventListener("mouseover", () => {
			toggleButton.style.backgroundColor = "#353535";
		});
		toggleButton.addEventListener("mouseout", () => {
			toggleButton.style.backgroundColor = "#2a2a2a";
		});

		return toggleButton;
	}

	function createCancelEnhanceButton() {
		const cancelButton = documentRef.createElement("button");
		cancelButton.id = "gemini-cancel-enhance-btn";
		cancelButton.innerHTML =
			'<span style="font-size: 20px;">⏹</span> <span style="font-weight: 600;">Cancel</span>';
		cancelButton.title = "Cancel active enhancement";
		cancelButton.style.display = "none";

		cancelButton.style.cssText = `
			display: none;
			align-items: center;
			justify-content: center;
			padding: 10px 15px;
			margin: 15px 0 15px 10px;
			background-color: #442222;
			color: #e0e0e0;
			border: 1px solid #663333;
			box-shadow: inset 0 0 0 1px #8844444d;
			border-radius: 4px;
			cursor: pointer;
			font-weight: bold;
			font-size: 13px;
			z-index: 1000;
		`;

		if (handlers.onCancelEnhance) {
			cancelButton.addEventListener("click", handlers.onCancelEnhance);
		}

		cancelButton.addEventListener("mouseover", () => {
			cancelButton.style.backgroundColor = "#552222";
		});
		cancelButton.addEventListener("mouseout", () => {
			cancelButton.style.backgroundColor = "#442222";
		});

		return cancelButton;
	}

	function createEnhanceButton() {
		const enhanceButton = documentRef.createElement("button");
		enhanceButton.className = "gemini-enhance-btn";
		enhanceButton.innerHTML =
			'<span style="font-size: 20px;">⚡</span> <span style="font-weight: 600;">Enhance Chapter</span>';
		enhanceButton.title = "Enhance readability using AI (Gemini)";

		enhanceButton.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 10px 15px;
			margin: 15px 0 15px 10px;
			background-color: #1a237e;
			color: #e8eaf6;
			border: 1px solid #3949ab;
			box-shadow: inset 0 0 0 1px #5c6bc04d;
			border-radius: 4px;
			cursor: pointer;
			font-weight: bold;
			font-size: 13px;
			z-index: 1000;
		`;

		if (handlers.onEnhance) {
			enhanceButton.addEventListener("click", handlers.onEnhance);
		}

		enhanceButton.addEventListener("mouseover", () => {
			enhanceButton.style.backgroundColor = "#283593";
		});
		enhanceButton.addEventListener("mouseout", () => {
			enhanceButton.style.backgroundColor = "#1a237e";
		});

		return enhanceButton;
	}

	function findNovelPageInsertionPoint() {
		if (!currentHandler) return null;

		if (typeof currentHandler.getNovelPageUIInsertionPoint === "function") {
			return currentHandler.getNovelPageUIInsertionPoint();
		}

		const selectors = [".r-fullstory-spec", ".fic_row", ".g_thumb", ".story-info", ".novel-info", ".book-info", "article header", "h1"];
		for (const selector of selectors) {
			const element = documentRef.querySelector(selector);
			if (element) return { element, position: "before" };
		}
		return { element: documentRef.body.firstChild, position: "before" };
	}

	async function injectNovelPageUI({
		getNovelIdFromCurrentPage,
		getReadingStatusOptions,
		handleNovelAddUpdate,
		manuallyCheckAndUpdateNovel,
		showTimedBanner,
	} = {}) {
		if (!currentHandler) return;

		const insertionPoint = findNovelPageInsertionPoint();
		if (!insertionPoint) return;

		const existingNovelControls = documentRef.querySelectorAll("#rg-novel-controls");
		if (existingNovelControls.length) {
			const [primary, ...extras] = existingNovelControls;
			extras.forEach((el) => el.remove());
			if (primary.isConnected) return;
		}

		const novelLibrary = await getNovelLibrary();
		const novelId = getNovelIdFromCurrentPage();
		const existingNovels = novelLibrary ? await novelLibrary.getRecentNovels(0) : [];
		const existingNovel = novelId ? existingNovels.find((n) => n.id === novelId) : null;

		const controlsContainer = documentRef.createElement("div");
		controlsContainer.id = "rg-novel-controls";
		protectFromThemeExtensions(controlsContainer);
		controlsContainer.style.cssText = `
			display: flex; flex-wrap: wrap; gap: 10px; padding: 15px; margin: 15px 0;
			background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
			border: 1px solid #0f3460; border-radius: 8px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
		`;
		if (isMobileDevice) controlsContainer.classList.add("mobile-view");

		const header = documentRef.createElement("div");
		header.style.cssText = "width:100%; display:flex; align-items:center; gap:10px; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #0f3460;";
		const logo = documentRef.createElement("span"); logo.textContent = "📚"; logo.style.fontSize = "24px";
		const title = documentRef.createElement("span"); title.textContent = "Ranobe Gemini Library";
		title.style.cssText = "color:#e94560; font-weight:bold; font-size:16px;";
		const statusBadge = documentRef.createElement("span");
		statusBadge.textContent = existingNovel ? "✅ In Library" : "📖 Not in Library";
		statusBadge.style.cssText = `margin-left:auto; padding:4px 10px; background:${existingNovel ? "#1b5e20" : "#424242"}; color:white; border-radius:4px; font-size:12px;`;
		header.appendChild(logo); header.appendChild(title); header.appendChild(statusBadge);
		controlsContainer.appendChild(header);

		const buttonRow = documentRef.createElement("div");
		buttonRow.style.cssText = "display:flex; flex-wrap:wrap; gap:10px; width:100%; justify-content:center; align-items:center;";

		const createButton = (text, icon, color, onClick) => {
			const btn = documentRef.createElement("button");
			btn.textContent = `${icon} ${text}`;
			btn.style.cssText = `padding:10px 16px; background:${color}; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; flex:1; min-width:120px;`;
			btn.addEventListener("click", onClick);
			return btn;
		};

		const refreshUI = async () => {
			controlsContainer.remove();
			await injectNovelPageUI({ getNovelIdFromCurrentPage, getReadingStatusOptions, handleNovelAddUpdate, manuallyCheckAndUpdateNovel, showTimedBanner });
		};

		buttonRow.appendChild(createButton(existingNovel ? "Update Novel" : "Add to Library", existingNovel ? "🔄" : "➕", existingNovel ? "#00695c" : "#1976d2", async () => {
			if (existingNovel) {
				const meta = currentHandler?.extractNovelMetadata?.() || {};
				await manuallyCheckAndUpdateNovel(existingNovel, meta);
				await refreshUI();
			} else {
				await handleNovelAddUpdate();
				await refreshUI();
			}
		}));

		if (existingNovel) {
			const statusSelect = documentRef.createElement("select");
			statusSelect.style.cssText = "padding:10px 16px; background:#424242; color:white; border:1px solid #666; border-radius:6px; cursor:pointer; font-size:14px; flex:1; min-width:140px;";
			getReadingStatusOptions().forEach(opt => {
				const o = documentRef.createElement("option"); o.value = opt.value; o.textContent = opt.label;
				if (existingNovel.readingStatus === opt.value) o.selected = true;
				statusSelect.appendChild(o);
			});
			statusSelect.addEventListener("change", async (e) => {
				if (!novelLibrary) return;
				await novelLibrary.updateReadingStatus(existingNovel.id, e.target.value);
				showTimedBanner(`Status changed to: ${e.target.value}`, "success", 2000);
				await refreshUI();
			});
			buttonRow.appendChild(statusSelect);

			buttonRow.appendChild(createButton("Remove", "🗑️", "#c62828", async () => {
				if (confirm(`Remove "${existingNovel.title}" from library?`)) {
					await novelLibrary.removeNovel(existingNovel.id);
					showTimedBanner("Novel removed from library", "success", 3000);
					await refreshUI();
				}
			}));
		}

		buttonRow.appendChild(createButton("Open Library", "📚", "#7b1fa2", () => {
			const base = browserRef.runtime.getURL("library/library.html");
			windowRef.open(existingNovel ? `${base}?novel=${encodeURIComponent(existingNovel.id)}` : base, "_blank");
		}));

		controlsContainer.appendChild(buttonRow);
		insertionPoint.element.parentNode.insertBefore(controlsContainer, insertionPoint.element);
	}

	function removeChapterNovelControlsFromDOM() {
		const existing = documentRef.getElementById("rg-chapter-novel-controls");
		if (!existing) return;
		const wrapper = existing.closest(".rg-gemini-controls");
		if (wrapper) {
			const maybeLabel = wrapper.previousElementSibling;
			if (maybeLabel?.classList.contains("rg-gemini-controls-label")) maybeLabel.remove();
			wrapper.remove();
		} else {
			existing.remove();
		}
	}

	function placeChapterNovelControls(novelControls, controlsConfig = {}) {
		if (!novelControls) return;
		removeChapterNovelControlsFromDOM();
		const oldToggleBtn = documentRef.querySelector(".gemini-toggle-banners-btn");
		if (oldToggleBtn) oldToggleBtn.style.display = "none";

		const insertion = resolveNovelControlsInsertion(controlsConfig);
		if (insertion?.element) {
			const { element: target, position } = insertion;
			if (controlsConfig.wrapInDefinitionList) {
				const dtLabel = documentRef.createElement("dt");
				dtLabel.className = "rg-gemini-controls-label";
				const labelLink = documentRef.createElement("a");
				labelLink.href = "https://ranobe.vkrishna04.me/";
				labelLink.textContent = controlsConfig.dlLabel || "Ranobe Gemini";
				labelLink.target = "_blank"; labelLink.rel = "noopener noreferrer";
				dtLabel.appendChild(labelLink);

				const ddWrapper = documentRef.createElement("dd");
				ddWrapper.className = "rg-gemini-controls";
				novelControls.classList.add("rg-dl-embedded");
				ddWrapper.appendChild(novelControls);

				if (position === "after" || position === "afterend") {
					insertAtPosition(target, dtLabel, "after");
					insertAtPosition(dtLabel, ddWrapper, "after");
				} else {
					insertAtPosition(target, dtLabel, position || "before");
					insertAtPosition(dtLabel, ddWrapper, "after");
				}
			} else {
				insertAtPosition(target, novelControls, position);
			}
		}
	}

	let __rgCreatingChapterControls = false;
	async function createChapterPageNovelControls({
		controlsConfig = {},
		HANDLER_TYPES = {},
		getHandlerType = () => "",
		getNovelIdFromCurrentPage = () => "",
		getReadingStatusOptions = () => [],
		showTimedBanner = () => {},
		isIncognitoActive = () => false,
		incognitoMode = {},
		shouldBannersBeHidden = () => false,
		handleChapterControlsToggleBanners = () => {},
		manuallyCheckAndUpdateNovel = () => {},
		handleNovelAddUpdate = () => {},
	} = {}) {
		if (getHandlerType() !== HANDLER_TYPES.CHAPTER_EMBEDDED) return null;
		if (!currentHandler?.isChapterPage?.()) return null;
		if (__rgCreatingChapterControls) return null;
		__rgCreatingChapterControls = true;

		if (documentRef.getElementById("rg-chapter-novel-controls")?.isConnected) {
			__rgCreatingChapterControls = false; return null;
		}

		try {
			const novelLibrary = await getNovelLibrary();
			if (!novelLibrary) { __rgCreatingChapterControls = false; return null; }

			const novelId = getNovelIdFromCurrentPage();
			const existingNovels = await novelLibrary.getRecentNovels(0);
			const existingNovel = novelId ? existingNovels.find((n) => n.id === novelId) : null;

			const refresh = async () => {
				removeChapterNovelControlsFromDOM();
				const nc = await createChapterPageNovelControls({
					controlsConfig, HANDLER_TYPES, getHandlerType, getNovelIdFromCurrentPage,
					getReadingStatusOptions, showTimedBanner, isIncognitoActive, incognitoMode,
					shouldBannersBeHidden, handleChapterControlsToggleBanners, manuallyCheckAndUpdateNovel, handleNovelAddUpdate
				});
				if (nc) placeChapterNovelControls(nc, controlsConfig);
			};

			const controlsContainer = documentRef.createElement("div");
			controlsContainer.id = "rg-chapter-novel-controls";
			protectFromThemeExtensions(controlsContainer);
			controlsContainer.style.cssText = `
				display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; padding: 8px 10px; margin: 10px 0;
				background: linear-gradient(135deg, #1a2540 0%, #16213e 100%); border: 1px solid #2a4b8d; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
			`;

			const statusBadge = documentRef.createElement("span");
			statusBadge.style.cssText = `padding: 4px 8px; background: ${existingNovel ? "#1b5e20" : "#424242"}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;`;
			statusBadge.textContent = existingNovel ? "📚 In Library" : "📖 Not Saved";
			controlsContainer.appendChild(statusBadge);

			const createCompactButton = (text, icon, color, onClick) => {
				const btn = documentRef.createElement("button");
				btn.innerHTML = `${icon} ${text}`;
				btn.style.cssText = `padding: 6px 10px; background: ${color}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px; white-space: nowrap; flex: 0 0 auto;`;
				btn.addEventListener("click", onClick);
				return btn;
			};

			controlsContainer.appendChild(createCompactButton(existingNovel ? "Update" : "Add to Library", existingNovel ? "🔄" : "➕", existingNovel ? "#00695c" : "#1976d2", async () => {
				if (existingNovel) {
					await manuallyCheckAndUpdateNovel(existingNovel, currentHandler?.extractNovelMetadata?.() || {});
				} else {
					await handleNovelAddUpdate();
				}
				await refresh();
			}));

			if (existingNovel) {
				const statusSelect = documentRef.createElement("select");
				statusSelect.style.cssText = "padding: 6px 8px; background: #424242; color: white; border: 1px solid #666; border-radius: 4px; cursor: pointer; font-size: 12px; min-width: 140px;";
				getReadingStatusOptions().forEach(opt => {
					const o = documentRef.createElement("option"); o.value = opt.value; o.textContent = opt.label;
					if (existingNovel.readingStatus === opt.value) o.selected = true;
					statusSelect.appendChild(o);
				});
				statusSelect.addEventListener("change", async (e) => {
					await novelLibrary.updateReadingStatus(existingNovel.id, e.target.value);
					showTimedBanner(`Status changed to: ${e.target.value}`, "success", 2000);
					await refresh();
				});
				controlsContainer.appendChild(statusSelect);

				controlsContainer.appendChild(createCompactButton("Remove", "🗑️", "#c62828", async () => {
					if (confirm("Remove this novel from your library?")) {
						await novelLibrary.removeNovel(existingNovel.id);
						showTimedBanner("Novel removed from library", "success", 3000);
						removeChapterNovelControlsFromDOM();
					}
				}));

				const readingListSelect = documentRef.createElement("select");
				readingListSelect.style.cssText = "padding: 6px 8px; background: #2f2f2f; color: white; border: 1px solid #666; border-radius: 4px; cursor: pointer; font-size: 12px; min-width: 140px;";
				const dOpt = documentRef.createElement("option"); dOpt.textContent = "📑 Add to List..."; dOpt.disabled = true; dOpt.selected = true;
				readingListSelect.appendChild(dOpt);
				const lists = [{id: "rereading", label: "🔁 Rereading"}, {id: "favourites", label: "❤️ Favourites"}];
				const currentLists = new Set(existingNovel.readingLists || []);
				lists.forEach(l => {
					const o = documentRef.createElement("option"); o.value = l.id;
					o.textContent = (currentLists.has(l.id) ? "✅ " : "  ") + l.label;
					readingListSelect.appendChild(o);
				});
				readingListSelect.addEventListener("change", async (e) => {
					if (!e.target.value) return;
					await novelLibrary.toggleNovelReadingList(existingNovel.id, e.target.value);
					await refresh();
				});
				controlsContainer.appendChild(readingListSelect);
			}

			controlsContainer.appendChild(createCompactButton("Library", "📚", "#7b1fa2", () => {
				const base = browserRef.runtime.getURL("library/library.html");
				windowRef.open(existingNovel ? `${base}?novel=${encodeURIComponent(existingNovel.id)}` : base, "_blank");
			}));

			if (isIncognitoActive()) {
				const badge = documentRef.createElement("span");
				badge.textContent = "🕵️ Incognito";
				badge.style.cssText = "padding: 4px 8px; background: #37474f; color: #b0bec5; border-radius: 4px; font-size: 11px; font-weight: 600;";
				controlsContainer.appendChild(badge);
			}

			if (getHandlerType() !== HANDLER_TYPES.DEDICATED_PAGE) {
				const btnLabel = shouldBannersBeHidden() ? "Show Gemini UI" : "Hide Gemini UI";
				const toggleBtn = createCompactButton(btnLabel, "👁", "#ff9800", () => handleChapterControlsToggleBanners(toggleBtn));
				controlsContainer.appendChild(toggleBtn);
			}

			__rgCreatingChapterControls = false;
			return controlsContainer;
		} catch (error) {
			debugError("Error creating chapter controls:", error);
			__rgCreatingChapterControls = false;
			return null;
		}
	}

	async function injectUI({
		isMobileDevice,
		getHandlerType,
		HANDLER_TYPES,
		loadChunkingSystem,
		initializeChunkedViewForSummaries,
		summarizeChunkRange,
		handleEnhanceClick,
		findContentArea = () => documentRef.body,
	} = {}) {
		const contentArea = findContentArea();
		if (!contentArea || documentRef.getElementById("gemini-controls")) return;

		const controlsContainer = documentRef.createElement("div");
		controlsContainer.id = "gemini-controls";
		protectFromThemeExtensions(controlsContainer);
		controlsContainer.style.marginBottom = "10px";
		if (isMobileDevice) controlsContainer.classList.add("mobile-view");

		const toggleBannersButton = createToggleBannersButton();
		const enhanceButton = createEnhanceButton();
		const cancelButton = createCancelEnhanceButton();

		if (getHandlerType() !== HANDLER_TYPES.CHAPTER_EMBEDDED) {
			controlsContainer.appendChild(toggleBannersButton);
			controlsContainer.appendChild(enhanceButton);
			controlsContainer.appendChild(cancelButton);
		}

		const chunking = await loadChunkingSystem();
		if (chunking?.summaryUI) {
			const totalChunks = await initializeChunkedViewForSummaries(contentArea, chunking);
			const mainSummaryGroup = chunking.summaryUI.createMainSummaryGroup(
				totalChunks,
				(indices) => summarizeChunkRange(indices, false),
				(indices) => summarizeChunkRange(indices, true),
				handleEnhanceClick
			);
			controlsContainer.appendChild(mainSummaryGroup);
		}

		contentArea.parentNode.insertBefore(controlsContainer, contentArea);
	}

	return {
		createToggleBannersButton,
		createCancelEnhanceButton,
		createEnhanceButton,
		injectNovelPageUI,
		createChapterPageNovelControls,
		injectUI,
		removeChapterNovelControlsFromDOM,
		placeChapterNovelControls,
	};
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

export default {
	createUIElementsRuntime,
	showProgressUpdatePromptRuntime,
	showRereadingBannerRuntime,
	deriveReadingStatusFromProgressRuntime,
	shouldShowProgressPromptRuntime,
};
