/**
 * UI Controls Module
 * Handles creation and management of control elements (buttons, selectors, etc.)
 */

let __rgCreatingChapterControls = false;

/**
 * Internal helper to insert a node at a target position
 */
export function insertAtPosition(target, node, position = "before", documentRef = document) {
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

/**
 * Internal helper to resolve the insertion point for novel controls
 */
export function resolveNovelControlsInsertion({
	config = {},
	currentHandler = null,
	documentRef = document,
} = {}) {
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

export function createEnhanceButton({
	documentRef = document,
	onEnhance = null,
} = {}) {
	const enhanceButton = documentRef.createElement("button");
	enhanceButton.className = "gemini-enhance-btn";
	enhanceButton.innerHTML =
		'<span style="font-size: 20px;">\u{26A1}</span> <span style="font-weight: 600;">Enhance Chapter</span>';
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

	if (onEnhance) {
		enhanceButton.addEventListener("click", onEnhance);
	}

	enhanceButton.addEventListener("mouseover", () => {
		enhanceButton.style.backgroundColor = "#283593";
	});
	enhanceButton.addEventListener("mouseout", () => {
		enhanceButton.style.backgroundColor = "#1a237e";
	});

	return enhanceButton;
}

export function createCancelEnhanceButton({
	documentRef = document,
	onCancelEnhance = null,
} = {}) {
	const cancelButton = documentRef.createElement("button");
	cancelButton.id = "gemini-cancel-enhance-btn";
	cancelButton.innerHTML =
		'<span style="font-size: 20px;">\u{23F9}</span> <span style="font-weight: 600;">Cancel</span>';
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

	if (onCancelEnhance) {
		cancelButton.addEventListener("click", onCancelEnhance);
	}

	cancelButton.addEventListener("mouseover", () => {
		cancelButton.style.backgroundColor = "#552222";
	});
	cancelButton.addEventListener("mouseout", () => {
		cancelButton.style.backgroundColor = "#442222";
	});

	return cancelButton;
}

export function removeChapterNovelControlsFromDOM(documentRef = document) {
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

export function placeChapterNovelControls(novelControls, {
	controlsConfig = {},
	documentRef = document,
	currentHandler = null,
} = {}) {
	if (!novelControls) return;
	removeChapterNovelControlsFromDOM(documentRef);

	const insertion = resolveNovelControlsInsertion({ config: controlsConfig, currentHandler, documentRef });
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
				insertAtPosition(target, dtLabel, "after", documentRef);
				insertAtPosition(dtLabel, ddWrapper, "after", documentRef);
			} else {
				insertAtPosition(target, dtLabel, position || "before", documentRef);
				insertAtPosition(dtLabel, ddWrapper, "after", documentRef);
			}
		} else {
			insertAtPosition(target, novelControls, position, documentRef);
		}
	}
}

export async function createChapterPageNovelControls({
	documentRef = document,
	browserRef = browser,
	windowRef = window,
	currentHandler = null,
	getNovelLibrary = async () => null,
	protectFromThemeExtensions = (el) => el,
	isIncognitoActive = () => false,
	debugError = () => {},
	controlsConfig = {},
	HANDLER_TYPES = {},
	getHandlerType = () => "",
	getNovelIdFromCurrentPage = () => "",
	getReadingStatusOptions = () => [],
	showTimedBanner = () => {},
	shouldBannersBeHidden = () => false,
	handleChapterControlsToggleBanners = () => {},
	manuallyCheckAndUpdateNovel = () => {},
	handleNovelAddUpdate = () => {},
} = {}) {
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
		const library = await novelLibrary.getLibrary();
		const existingNovel = novelId && library.novels ? library.novels[novelId] : null;

		const refresh = async () => {
			removeChapterNovelControlsFromDOM(documentRef);
			const nc = await createChapterPageNovelControls({
				documentRef, browserRef, windowRef, currentHandler, getNovelLibrary,
				protectFromThemeExtensions, isIncognitoActive, debugError,
				controlsConfig, HANDLER_TYPES, getHandlerType, getNovelIdFromCurrentPage,
				getReadingStatusOptions, showTimedBanner, shouldBannersBeHidden,
				handleChapterControlsToggleBanners, manuallyCheckAndUpdateNovel, handleNovelAddUpdate
			});
			if (nc) placeChapterNovelControls(nc, { controlsConfig, documentRef, currentHandler });
		};

		const controlsContainer = documentRef.createElement("div");
		controlsContainer.id = "rg-chapter-novel-controls";
		protectFromThemeExtensions(controlsContainer);
		controlsContainer.style.cssText = `
			display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 5px; padding: 6px 8px; margin: 6px 0;
			background: #141c30; border: 1px solid #243660; border-radius: 5px; box-shadow: 0 1px 4px rgba(0,0,0,0.25);
		`;

		const statusBadge = documentRef.createElement("span");
		statusBadge.style.cssText = `padding: 4px 8px; background: ${existingNovel ? "#1b5e20" : "#424242"}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;`;
		statusBadge.textContent = existingNovel ? "\u{1F4DA} In Library" : "\u{1F4D6} Not Saved";
		controlsContainer.appendChild(statusBadge);

		const createCompactButton = (text, icon, color, onClick, extraTitle = "") => {
			const btn = documentRef.createElement("button");
			btn.textContent = icon ? `${icon}\u{A0}${text}` : text;
			if (extraTitle) btn.title = extraTitle;
			btn.style.cssText = `padding: 4px 9px; background: ${color}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 11px; white-space: nowrap; flex: 0 0 auto; line-height: 1.4;`;
			btn.addEventListener("click", onClick);
			return btn;
		};

		controlsContainer.appendChild(createCompactButton(existingNovel ? "Update" : "Add to Library", existingNovel ? "\u{1F504}" : "\u{2795}", existingNovel ? "#00695c" : "#1976d2", async () => {
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

			controlsContainer.appendChild(createCompactButton("Remove", "\u{1F5D1}\u{FE0F}", "#c62828", async () => {
				if (confirm("Remove this novel from your library?")) {
					await novelLibrary.removeNovel(existingNovel.id);
					showTimedBanner("Novel removed from library", "success", 3000);
					removeChapterNovelControlsFromDOM(documentRef);
				}
			}));

			const readingListSelect = documentRef.createElement("select");
			readingListSelect.style.cssText = "padding: 6px 8px; background: #2f2f2f; color: white; border: 1px solid #666; border-radius: 4px; cursor: pointer; font-size: 12px; min-width: 140px;";
			const dOpt = documentRef.createElement("option"); dOpt.textContent = "\u{1F4D1} Add to List..."; dOpt.disabled = true; dOpt.selected = true;
			readingListSelect.appendChild(dOpt);
			const lists = [{id: "rereading", label: "\u{1F501} Rereading"}, {id: "favourites", label: "\u{2764}\u{FE0F} Favourites"}];
			const currentLists = new Set(existingNovel.readingLists || []);
			lists.forEach(l => {
				const o = documentRef.createElement("option"); o.value = l.id;
				o.textContent = (currentLists.has(l.id) ? "\u{2705} " : "  ") + l.label;
				readingListSelect.appendChild(o);
			});
			readingListSelect.addEventListener("change", async (e) => {
				if (!e.target.value) return;
				await novelLibrary.toggleNovelReadingList(existingNovel.id, e.target.value);
				await refresh();
			});
			controlsContainer.appendChild(readingListSelect);
		}

		controlsContainer.appendChild(createCompactButton("Library", "\u{1F4DA}", "#7b1fa2", () => {
			const base = browserRef.runtime.getURL("library/library.html");
			windowRef.open(existingNovel ? `${base}?novel=${encodeURIComponent(existingNovel.id)}` : base, "_blank");
		}));

		// Handler-provided custom buttons (site-specific functionality).
		// Handlers override getChapterUIConfig().customButtons or getCustomChapterButtons().
		try {
			const handlerConfig = currentHandler?.getChapterUIConfig
				? await currentHandler.getChapterUIConfig()
				: null;
			const customButtons = handlerConfig?.customButtons ?? [];
			for (const btnDef of customButtons) {
				if (!btnDef?.label && !btnDef?.emoji) continue;
				const label = [btnDef.emoji, btnDef.label].filter(Boolean).join("\u{A0}");
				const btn = documentRef.createElement("button");
				btn.textContent = label;
				if (btnDef.title) btn.title = btnDef.title;
				btn.style.cssText = `padding: 4px 9px; background: ${btnDef.bgColor || "#555"}; color: ${btnDef.textColor || "white"}; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 11px; white-space: nowrap; flex: 0 0 auto; line-height: 1.4;`;
				if (typeof btnDef.onClick === "function") {
					btn.addEventListener("click", () => btnDef.onClick({ novelId: getNovelIdFromCurrentPage(), existingNovel, refresh }));
				}
				controlsContainer.appendChild(btn);
			}
		} catch (_e) { /* non-critical — custom buttons are optional */ }

		if (isIncognitoActive()) {
			const badge = documentRef.createElement("span");
			badge.textContent = "\u{1F575}\u{FE0F} Incognito";
			badge.style.cssText = "padding: 4px 8px; background: #37474f; color: #b0bec5; border-radius: 4px; font-size: 11px; font-weight: 600;";
			controlsContainer.appendChild(badge);
		}

		// The Hide/Show UI toggle has moved to the popup "Now Reading" section.
		// Do not add it to the in-page controls bar on any site.

		__rgCreatingChapterControls = false;
		return controlsContainer;
	} catch (error) {
		debugError("Error creating chapter controls:", error);
		__rgCreatingChapterControls = false;
		return null;
	}
}

export async function injectNovelPageUI({
	documentRef = document,
	browserRef = browser,
	windowRef = window,
	currentHandler = null,
	getNovelLibrary = async () => null,
	protectFromThemeExtensions = (el) => el,
	isMobileDevice = false,
	getNovelIdFromCurrentPage = () => "",
	getReadingStatusOptions = () => [],
	handleNovelAddUpdate = () => {},
	manuallyCheckAndUpdateNovel = () => {},
	showTimedBanner = () => {},
} = {}) {
	if (!currentHandler) return;

	// Internal helper to find insertion point
	const findNovelPageInsertionPoint = () => {
		if (typeof currentHandler.getNovelPageUIInsertionPoint === "function") {
			return currentHandler.getNovelPageUIInsertionPoint();
		}
		const selectors = [".r-fullstory-spec", ".fic_row", ".g_thumb", ".story-info", ".novel-info", ".book-info", "article header", "h1"];
		for (const selector of selectors) {
			const element = documentRef.querySelector(selector);
			if (element) return { element, position: "before" };
		}
		return { element: documentRef.body.firstChild, position: "before" };
	};

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
	const logo = documentRef.createElement("span"); logo.textContent = "\u{1F4DA}"; logo.style.fontSize = "24px";
	const title = documentRef.createElement("span"); title.textContent = "Ranobe Gemini Library";
	title.style.cssText = "color:#e94560; font-weight:bold; font-size:16px;";
	const statusBadge = documentRef.createElement("span");
	statusBadge.textContent = existingNovel ? "\u{2705} In Library" : "\u{1F4D6} Not in Library";
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
		await injectNovelPageUI({
			documentRef, browserRef, windowRef, currentHandler, getNovelLibrary,
			protectFromThemeExtensions, isMobileDevice, getNovelIdFromCurrentPage,
			getReadingStatusOptions, handleNovelAddUpdate, manuallyCheckAndUpdateNovel, showTimedBanner
		});
	};

	buttonRow.appendChild(createButton(existingNovel ? "Update Novel" : "Add to Library", existingNovel ? "\u{1F504}" : "\u{2795}", existingNovel ? "#00695c" : "#1976d2", async () => {
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

		buttonRow.appendChild(createButton("Remove", "\u{1F5D1}\u{FE0F}", "#c62828", async () => {
			if (confirm(`Remove "${existingNovel.title}" from library?`)) {
				await novelLibrary.removeNovel(existingNovel.id);
				showTimedBanner("Novel removed from library", "success", 3000);
				await refreshUI();
			}
		}));
	}

	buttonRow.appendChild(createButton("Open Library", "\u{1F4DA}", "#7b1fa2", () => {
		const base = browserRef.runtime.getURL("library/library.html");
		windowRef.open(existingNovel ? `${base}?novel=${encodeURIComponent(existingNovel.id)}` : base, "_blank");
	}));

	// Novel-specific prompt button (only for novels already in library)
	if (existingNovel) {
		buttonRow.appendChild(createButton("Set Prompt", "\u{270D}\u{FE0F}", "#00838f", () => {
			// Build inline modal overlay
			const overlay = documentRef.createElement("div");
			overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;";

			const modal = documentRef.createElement("div");
			modal.style.cssText = "background:#1a1a2e;border:1px solid #0f3460;border-radius:10px;padding:20px;width:min(520px,90vw);box-shadow:0 8px 32px rgba(0,0,0,0.6);display:flex;flex-direction:column;gap:12px;";

			const modalTitle = documentRef.createElement("div");
			modalTitle.textContent = "\u{270D}\u{FE0F} Novel-Specific Prompt";
			modalTitle.style.cssText = "color:#e94560;font-weight:bold;font-size:15px;";

			const hint = documentRef.createElement("p");
			hint.textContent = 'This prompt is appended to the main enhancement prompt for this novel only. Use it to set tone, style, or special instructions (e.g. "This is a high-quality translation \u{2014} make only light grammar corrections.").';
			hint.style.cssText = "color:#9ca3af;font-size:12px;line-height:1.5;margin:0;";

			const textarea = documentRef.createElement("textarea");
			textarea.value = existingNovel.customPrompt || "";
			textarea.placeholder = "Enter novel-specific instructions for the AI\u{2026}";
			textarea.style.cssText = "width:100%;box-sizing:border-box;height:120px;background:#0f172a;color:#e5e7eb;border:1px solid #0f3460;border-radius:6px;padding:10px;font-size:13px;resize:vertical;font-family:inherit;";

			const btnRow = documentRef.createElement("div");
			btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";

			const cancelBtn = documentRef.createElement("button");
			cancelBtn.textContent = "Cancel";
			cancelBtn.style.cssText = "padding:8px 16px;background:#424242;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;";
			cancelBtn.addEventListener("click", () => overlay.remove());

			const saveBtn = documentRef.createElement("button");
			saveBtn.textContent = "\u{1F4BE} Save";
			saveBtn.style.cssText = "padding:8px 16px;background:#00838f;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;";
			saveBtn.addEventListener("click", async () => {
				if (!novelLibrary) return;
				await novelLibrary.updateNovelCustomPrompt(existingNovel.id, textarea.value.trim());
				showTimedBanner("Novel prompt saved!", "success", 2000);
				overlay.remove();
			});

			btnRow.appendChild(cancelBtn);
			btnRow.appendChild(saveBtn);
			modal.appendChild(modalTitle);
			modal.appendChild(hint);
			modal.appendChild(textarea);
			modal.appendChild(btnRow);
			overlay.appendChild(modal);

			// Close on backdrop click
			overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
			documentRef.body.appendChild(overlay);
			textarea.focus();
		}));
	}

	controlsContainer.appendChild(buttonRow);
	insertionPoint.element.parentNode.insertBefore(controlsContainer, insertionPoint.element);
}

export async function injectUI({
	documentRef = document,
	protectFromThemeExtensions = (el) => el,
	createToggleBannersButton = () => null,
	createCancelEnhanceButton = () => null,
	isMobileDevice = false,
	getHandlerType = () => "",
	HANDLER_TYPES = {},
	loadChunkingSystem = async () => null,
	initializeChunkedViewForSummaries = async () => 0,
	summarizeChunkRange = () => {},
	handleEnhanceClick = () => {},
	findContentArea = () => null,
} = {}) {
	const contentArea = findContentArea();
	if (!contentArea || documentRef.getElementById("gemini-controls")) return null;

	const controlsContainer = documentRef.createElement("div");
	controlsContainer.id = "gemini-controls";
	protectFromThemeExtensions(controlsContainer);
	controlsContainer.style.marginBottom = "10px";
	if (isMobileDevice) controlsContainer.classList.add("mobile-view");

	const toggleBannersButton = createToggleBannersButton();
	const cancelButton = createCancelEnhanceButton();

	// The toggle-banners button has been moved to the popup "Now Reading" section
	// so it doesn't clutter the chapter reading area. Only keep the cancel button here.
	if (cancelButton) controlsContainer.appendChild(cancelButton);

	let mainSummaryGroup = null;
	const chunking = await loadChunkingSystem();
	if (chunking?.summaryUI) {
		const totalChunks = await initializeChunkedViewForSummaries(contentArea, chunking);
		mainSummaryGroup = chunking.summaryUI.createMainSummaryGroup(
			totalChunks,
			(indices) => summarizeChunkRange(indices, false),
			(indices) => summarizeChunkRange(indices, true),
			handleEnhanceClick
		);
	}

	// Return elements to caller — DOM insertion is handled by insertMainUiBlocksRuntime
	// in content.js, which honours the handler's getUIInsertionPoint() for correct placement.
	return { controlsContainer, mainSummaryGroup };
}
