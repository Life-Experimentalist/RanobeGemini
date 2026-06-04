/**
 * novel-context.js
 * Phase 10-U1: Novel Context & Lifecycle orchestration runtime.
 * Auto-extracted from content.js — do not hand-edit.
 */

export function initNovelContextModule(ctx) {
    const {
        windowRef,
        documentRef,
        browserRef,
        currentHandler,
        novelLibrary,
        storageManager,
        siteSettingsModule,
        siteSettings,
        bannerConfig = {},
        debugLog = () => {},
        debugError = () => {},
        debugWarn = () => {},
        showTimedBanner = () => {},
        showStatusMessage = () => {},
        isIncognitoActive = () => false,
        getHandlerType = () => null,
        HANDLER_TYPES = {},
        READING_STATUS = {},
        buildNovelDataFromMetadata = (v) => v,
        cacheNovelData = () => {},
        deriveReadingStatusFromProgress = () => null,
        refreshLibraryUI = () => {},
        loadNovelLibrary = async () => {},
        protectFromThemeExtensions = (el) => el,
        updateLibraryUIState = () => {},
        removeActionOverlay = () => {},
        showStatusOverlay = () => {},
        hideStatusOverlay = () => {},
        removeChapterNovelControlsFromDOM = () => {},
        createChapterPageNovelControls = async () => {},
        placeChapterNovelControls = () => {},
    } = ctx;
    const window  = windowRef  ?? globalThis.window;
    const document = documentRef ?? globalThis.document;
    const browser  = browserRef  ?? globalThis.browser;

function extractNovelContext() {
	const context = {
		url: window.location.href,
		title: document.title,
		chapterNumber: null,
		chapterTitle: null,
		author: null,
		coverUrl: null,
		description: null,
		totalChapters: null,
		status: null,
		genres: [],
		tags: [],
		metadata: {},
	};

	// Try to extract chapter number from navigation
	if (
		currentHandler &&
		typeof currentHandler.getChapterNavigation === "function"
	) {
		const nav = currentHandler.getChapterNavigation();
		if (nav) {
			context.chapterNumber = nav.currentChapter || 1;
			context.totalChapters = nav.totalChapters || 0;
		}
	}

	// Try to extract chapter title
	if (
		currentHandler &&
		typeof currentHandler.extractTitle === "function"
	) {
		try {
			context.chapterTitle = currentHandler.extractTitle();
		} catch (e) {
			// Fallback to document title
		}
	}

	// Site-specific metadata extraction - delegate to handler
	if (
		currentHandler &&
		typeof currentHandler.extractPageMetadata === "function"
	) {
		try {
			const pageMetadata = currentHandler.extractPageMetadata();
			if (pageMetadata) {
				// Merge handler-provided metadata into context
				context.author = pageMetadata.author || context.author;
				context.title = pageMetadata.title || context.title;
				context.genres = [
					...(pageMetadata.genres || []),
					...(context.genres || []),
				];
				context.tags = [
					...(pageMetadata.tags || []),
					...(context.tags || []),
				];
				context.status = pageMetadata.status || context.status;
				context.description =
					pageMetadata.description || context.description;
			}
		} catch (error) {
			debugError(
				"Error extracting page metadata from handler:",
				error,
			);
		}
	}

	return context;
}

function getNovelIdFromCurrentPage() {
	if (!currentHandler) return null;

	if (typeof currentHandler.generateNovelId === "function") {
		return currentHandler.generateNovelId(window.location.href);
	}
	return null;
}

async function autoUpdateNovelOnVisit() {
	console.log("[RG-Library-Debug] autoUpdateNovelOnVisit called", { url: window.location.href });

	if (!currentHandler) {
		console.log("[RG-Library-Debug] ABORT: no currentHandler");
		return;
	}

	// Incognito mode — suppress all automatic tracking
	if (isIncognitoActive()) {
		console.log("[RG-Library-Debug] ABORT: incognito mode active");
		debugLog(
			"🕵️ Incognito mode active — skipping autoUpdateNovelOnVisit",
		);
		return;
	}

	// Load novel library if not already loaded
	if (!novelLibrary) {
		await loadNovelLibrary();
	}

	if (!novelLibrary) {
		console.log("[RG-Library-Debug] ABORT: novelLibrary not available after loadNovelLibrary()");
		debugLog("Novel library not available");
		return;
	}

	try {
		// Get handler type and page context
		const handlerType = getHandlerType();
		const isChapter = currentHandler.isChapterPage();
		const isNovelPage = currentHandler.isNovelPage?.() || false;

		console.log("[RG-Library-Debug] page context", {
			handlerType,
			isChapter,
			isNovelPage,
			handler: currentHandler?.constructor?.name,
			shelfId: currentHandler?.constructor?.SHELF_METADATA?.id,
		});

		// For DEDICATED_PAGE-type sites on chapter pages, show banner with link to novel details
		if (
			handlerType === HANDLER_TYPES.DEDICATED_PAGE &&
			isChapter &&
			!isNovelPage
		) {
			const novelPageUrl = currentHandler.getNovelPageUrl?.();
			console.log("[RG-Library-Debug] dedicated_page chapter: novelPageUrl =", novelPageUrl);
			if (novelPageUrl) {
				const novelId = getNovelIdFromCurrentPage();
				const existingNovels =
					await novelLibrary.getRecentNovels(0);
				const existingNovel = novelId
					? existingNovels.find((n) => n.id === novelId)
					: null;

				console.log("[RG-Library-Debug] dedicated_page chapter: novelId =", novelId, "existingNovel =", existingNovel?.title ?? null);

				if (!existingNovel) {
					showTimedBanner(
						"Add this novel to your library?",
						"action",
						8000,
						{
							actionButton: {
								text: "📖 View Novel Details",
								url: novelPageUrl,
							},
						},
					);
				}
			}
		}

		// Check if handler supports metadata extraction
		if (typeof currentHandler.extractNovelMetadata !== "function") {
			console.log("[RG-Library-Debug] ABORT: handler has no extractNovelMetadata()");
			debugLog("Handler does not support metadata extraction");
			return;
		}

		// Extract metadata
		const metadata = currentHandler.extractNovelMetadata();
		console.log("[RG-Library-Debug] extractNovelMetadata result", {
			title: metadata?.title ?? null,
			author: metadata?.author ?? null,
			needsDetailPage: metadata?.needsDetailPage ?? false,
			metadataIncomplete: metadata?.metadataIncomplete ?? false,
			hasCoverUrl: !!metadata?.coverUrl,
			hasDescription: !!metadata?.description,
		});

		if (!metadata || !metadata.title) {
			console.log("[RG-Library-Debug] ABORT: metadata.title is empty/null — cannot auto-add");
			debugLog("Could not extract novel metadata");
			return;
		}
		cacheNovelData(buildNovelDataFromMetadata(metadata));

		// Get novel ID
		let novelId = getNovelIdFromCurrentPage();
		const novelIdSource = novelId ? "handler.generateNovelId()" : "url-hash fallback";
		if (!novelId) {
			const shelfId =
				currentHandler.constructor.SHELF_METADATA?.id || "unknown";
			const urlPath = window.location.pathname;
			const urlHash = btoa(urlPath)
				.substring(0, 16)
				.replace(/[^a-zA-Z0-9]/g, "");
			novelId = `${shelfId}-${urlHash}`;
		}
		console.log("[RG-Library-Debug] novelId =", novelId, "(source:", novelIdSource + ")");

		// Get chapter info
		const chapterNav = currentHandler.getChapterNavigation?.() || {};
		const currentChapterNum = chapterNav.currentChapter;
		const totalChapterCount =
			metadata.totalChapters || metadata.chapterCount || null;

		// Check if novel exists in library
		const existingNovels = await novelLibrary.getRecentNovels(0);
		const existingNovel = existingNovels.find((n) => n.id === novelId);
		console.log("[RG-Library-Debug] library check: totalNovels =", existingNovels.length, "existingNovel =", existingNovel?.title ?? "(not found)");

		// SILENT: Only update total chapters if it's additive OR if site setting allows
		// MANUAL ONLY: User must click "Check for Updates" button to update metadata
		if (existingNovel) {
			// If the library explicitly requested a full refresh, honor it unconditionally
			if (existingNovel.pendingRefresh === true) {
				debugLog(`📚 pendingRefresh flag set — forcing full metadata update for ${existingNovel.title}`);
				const updatedData = buildNovelDataFromMetadata(metadata);
				await novelLibrary.updateNovelMetadata(novelId, updatedData);
				// Clear the flag
				await novelLibrary.updateNovel(novelId, {
					pendingRefresh: false,
					lastMetadataUpdate: Date.now(),
				});
				showTimedBanner(
					`✅ Metadata refreshed: ${existingNovel.title}`,
					"success",
					4000,
				);
				return;
			}

			// Check per-site auto-update settings
			const shelfId =
				currentHandler.constructor.SHELF_METADATA?.id || "unknown";
			const defaultSiteSettings =
				siteSettingsModule?.getDefaultSiteSettings?.() || {};
			const siteAutoUpdateSettings =
				siteSettings?.[shelfId] ||
				defaultSiteSettings[shelfId] ||
				{};

			// Determine if auto-update is enabled for this site
			const autoUpdateEnabled =
				siteAutoUpdateSettings.autoUpdateMetadata === true;
			const totalChaptersOnlyMode =
				siteAutoUpdateSettings.autoUpdateTotalChaptersOnly !==
				false;
			const showUpdateBanner =
				siteAutoUpdateSettings.autoUpdateShowBanner !== false;

			// Auto-update metadata if enabled for this site
			if (autoUpdateEnabled && !totalChaptersOnlyMode) {
				// Full metadata auto-update
				const changes = detectMetadataChanges(
					existingNovel,
					metadata,
				);
				if (Object.keys(changes).length > 0) {
					debugLog(
						`📚 Auto-updating ${Object.keys(changes).length} metadata fields for ${existingNovel.title}`,
					);
					const updatedData =
						buildNovelDataFromMetadata(metadata);
					await novelLibrary.updateNovelMetadata(
						novelId,
						updatedData,
					);

					// Show update banner with changes
					displayChangeSummary(existingNovel.title, changes);
				}
			} else {
				// Only update total chapters (default mode)
				if (
					totalChapterCount &&
					(!existingNovel.totalChapters ||
						totalChapterCount > existingNovel.totalChapters)
				) {
					debugLog(
						`📚 Auto-updating total chapters to ${totalChapterCount}`,
					);
					await novelLibrary.updateNovel(novelId, {
						totalChapters: totalChapterCount,
					});
				}

				// Show "Check for Updates" button in banner if enabled
				if (showUpdateBanner) {
					showUpdateAvailableBanner(existingNovel, metadata);
				}
			}

			// Handle chapter progression / regression
			if (isChapter && currentChapterNum) {
				const storedChapter = existingNovel.lastReadChapter || 0;
				if (
					storedChapter > 0 &&
					currentChapterNum < storedChapter
				) {
					// Chapter went backward - ask if user wants to go back
					await showChapterRegressionPrompt({
						novelId,
						novelTitle: existingNovel.title,
						currentChapter: currentChapterNum,
						storedChapter: storedChapter,
						totalChapters: totalChapterCount,
						lastReadUrl: existingNovel.lastReadUrl || null,
					});
				} else if (
					currentChapterNum > storedChapter ||
					!existingNovel.lastReadUrl
				) {
					// Chapter progressed, or URL not yet recorded — update reading progress
					await novelLibrary.updateReadingProgress(
						novelId,
						currentChapterNum,
						window.location.href,
						{ totalChapters: totalChapterCount },
					);
				}
			}
		} else {
			// New novel - auto-add with auto-add settings
			const shelfId =
				currentHandler.constructor.SHELF_METADATA?.id || "unknown";
			const defaultSiteSettings =
				siteSettingsModule?.getDefaultSiteSettings?.() || {};
			const siteAutoAddSettings =
				siteSettings?.[shelfId] ||
				defaultSiteSettings[shelfId] ||
				{};
			const autoAddEnabled =
				siteAutoAddSettings.autoAddEnabled !== false;
			const autoAddStatus = isChapter
				? siteAutoAddSettings.autoAddStatusChapter ||
					READING_STATUS.READING
				: siteAutoAddSettings.autoAddStatusNovel ||
					READING_STATUS.PLAN_TO_READ;

			const blocklisted = isNovelBlocklisted(novelId);
			console.log("[RG-Library-Debug] new-novel auto-add gate", {
				autoAddEnabled,
				hasTitle: !!metadata.title,
				blocklisted,
				shelfId,
				siteAutoAddSettings,
			});

			if (
				autoAddEnabled &&
				metadata.title &&
				!blocklisted
			) {
				// Build novel data
				const progressStatus = deriveReadingStatusFromProgress(
					currentChapterNum,
					totalChapterCount,
				);
				const novelData = {
					id: novelId,
					title: metadata.title,
					author: metadata.author || "Unknown",
					description: metadata.description || "",
					coverUrl: metadata.coverUrl || "",
					sourceUrl:
						metadata.mainNovelUrl || window.location.href,
					sourceSite: window.location.hostname,
					shelfId: shelfId,
					genres: metadata.genres || [],
					tags: metadata.tags || [],
					status: metadata.status || null,
					totalChapters: totalChapterCount,
					metadata: {
						...(metadata.metadata || {}),
						...(metadata.rating && { rating: metadata.rating }),
						...(metadata.language && {
							language: metadata.language,
						}),
						...(metadata.publishedDate && {
							publishedDate: metadata.publishedDate,
						}),
						...(metadata.updatedDate && {
							updatedDate: metadata.updatedDate,
						}),
					},
					stats: {
						...(metadata.stats || {}),
						...(metadata.words && { words: metadata.words }),
						...(metadata.reviews && {
							reviews: metadata.reviews,
						}),
						...(metadata.favorites && {
							favorites: metadata.favorites,
						}),
						...(metadata.follows && {
							follows: metadata.follows,
						}),
					},
					readingStatus:
						(isChapter && progressStatus) || autoAddStatus,
					...(isChapter && currentChapterNum
						? {
								lastReadChapter: currentChapterNum,
								lastReadUrl: window.location.href,
							}
						: {}),
				};

				console.log("[RG-Library-Debug] calling addOrUpdateNovel", { id: novelData.id, shelfId: novelData.shelfId, title: novelData.title });
				await novelLibrary.addOrUpdateNovel(novelData);
				console.log("[RG-Library-Debug] addOrUpdateNovel SUCCESS — novel auto-added:", novelData.title);
				debugLog("📚 Auto-added novel to library:", metadata.title);
				showTimedBanner(
					`Added to library: ${metadata.title}`,
					"success",
					3000,
				);
			}
		}
	} catch (error) {
		console.log("[RG-Library-Debug] ERROR in autoUpdateNovelOnVisit:", error?.message, error);
		debugError("Error in auto-update novel:", error);
	}
}

function showUpdateAvailableBanner(existingNovel, currentMetadata) {
	showTimedBanner(
		`🔗 Updates may be available for "${existingNovel.title}"`,
		"info",
		bannerConfig.updateNotifyMs || 8000,
		{
			title: "Novel Update Available",
			actionButton: {
				text: "🔄 Update Now",
				onClick: () => {
					manuallyCheckAndUpdateNovel(
						existingNovel,
						currentMetadata,
					);
				},
			},
			source: "novel-library",
		},
	);
}

async function manuallyCheckAndUpdateNovel(existingNovel, currentMetadata) {
	if (!novelLibrary || !currentHandler) return;

	try {
		// Get novel ID
		let novelId = existingNovel.id;

		// Detect what changed
		const changes = detectMetadataChanges(
			existingNovel,
			currentMetadata,
		);

		if (Object.keys(changes).length === 0) {
			// No changes detected
			showTimedBanner(
				"✅ No updates available (metadata is current)",
				"success",
				4000,
			);
			debugLog("📚 No metadata changes detected");
			return;
		}

		// Show "Updating..." message
		showTimedBanner(
			`🔄 Checking: ${existingNovel.title}`,
			"updating",
			1500,
		);

		// Update the novel
		const updatedData = buildNovelDataFromMetadata(currentMetadata);
		await novelLibrary.updateNovelMetadata(novelId, updatedData);

		debugLog("📚 Manually updated novel, changes:", changes);

		// Display what changed
		displayChangeSummary(existingNovel.title, changes);
	} catch (error) {
		debugError("Error in manual update:", error);
		showTimedBanner(
			`❌ Error updating: ${error.message}`,
			"error",
			5000,
		);
	}
}

function detectMetadataChanges(oldNovel, newMetadata) {
	const changes = {};

	const fieldsToCheck = [
		{ old: "description", new: "description", label: "Summary" },
		{ old: "author", new: "author", label: "Author" },
		{ old: "status", new: "status", label: "Status" },
		{ old: "totalChapters", new: "totalChapters", label: "Chapters" },
		{ old: "genres", new: "genres", label: "Genres" },
		{
			old: ["metadata", "rating"],
			new: ["metadata", "rating"],
			label: "Rating",
		},
		{
			old: ["metadata", "language"],
			new: ["metadata", "language"],
			label: "Language",
		},
		{
			old: ["metadata", "words"],
			new: ["stats", "words"],
			label: "Word Count",
		},
		{
			old: ["metadata", "publishedDate"],
			new: ["metadata", "publishedDate"],
			label: "Published",
		},
	];

	for (const field of fieldsToCheck) {
		const oldPath = Array.isArray(field.old) ? field.old : [field.old];
		const newPath = Array.isArray(field.new) ? field.new : [field.new];

		// Get old and new values
		let oldValue = oldNovel;
		for (const key of oldPath) {
			oldValue = oldValue?.[key];
		}

		let newValue = newMetadata;
		for (const key of newPath) {
			newValue = newValue?.[key];
		}

		// Normalize for comparison
		const oldStr = Array.isArray(oldValue)
			? oldValue.join(", ")
			: String(oldValue || "");
		const newStr = Array.isArray(newValue)
			? newValue.join(", ")
			: String(newValue || "");

		// Detect change
		if (oldStr !== newStr && newStr) {
			changes[field.label] = {
				old: oldStr || "(not set)",
				new: newStr,
			};
		}
	}

	return changes;
}

function displayChangeSummary(novelTitle, changes) {
	// Create a styled modal div for showing changes
	const modalId = `rg-changes-modal-${Date.now()}`;
	const modal = document.createElement("div");
	modal.id = modalId;
	protectFromThemeExtensions(modal);
	modal.style.cssText = `
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: linear-gradient(135deg, #1a2942 0%, #0f3460 100%);
		border: 2px solid #4a7c9c;
		border-radius: 12px;
		padding: 20px;
		color: white;
		font-family: system-ui, -apple-system, sans-serif;
		z-index: 999999;
		box-shadow: 0 8px 32px rgba(0,0,0,0.5);
		max-width: 500px;
		max-height: 70vh;
		overflow-y: auto;
	`;

	// Title
	const title = document.createElement("h3");
	title.textContent = `✨ Updated: ${novelTitle}`;
	title.style.cssText =
		"margin-top: 0; margin-bottom: 16px; color: #88bbff;";
	modal.appendChild(title);

	// Changes
	const changesDiv = document.createElement("div");
	for (const [field, change] of Object.entries(changes)) {
		const fieldDiv = document.createElement("div");
		fieldDiv.style.cssText = `
			margin: 8px 0;
			padding: 12px;
			background: #0a1f35;
			border-left: 3px solid #4a7c9c;
			border-radius: 4px;
		`;

		const fieldName = document.createElement("div");
		fieldName.style.cssText = "font-weight: bold; margin-bottom: 6px;";
		fieldName.textContent = field;
		fieldDiv.appendChild(fieldName);

		const oldValue = document.createElement("div");
		oldValue.style.cssText = `
			margin: 6px 0;
			font-size: 0.9em;
			color: #cc6666;
			text-decoration: line-through;
		`;
		oldValue.textContent = `↚ ${change.old}`;
		fieldDiv.appendChild(oldValue);

		const newValue = document.createElement("div");
		newValue.style.cssText = `
			margin: 6px 0;
			font-size: 0.9em;
			color: #66dd66;
		`;
		newValue.textContent = `↦ ${change.new}`;
		fieldDiv.appendChild(newValue);

		changesDiv.appendChild(fieldDiv);
	}
	modal.appendChild(changesDiv);

	// Summary
	const summary = document.createElement("div");
	summary.style.cssText = `
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid #3a5a7a;
		font-size: 0.85em;
		color: #aaa;
	`;
	summary.textContent = `${Object.keys(changes).length} field(s) updated`;
	modal.appendChild(summary);

	// Close button
	const closeBtn = document.createElement("button");
	closeBtn.textContent = "✅ Got it";
	closeBtn.style.cssText = `
		margin-top: 16px;
		width: 100%;
		padding: 10px;
		background: #4a7c9c;
		border: 1px solid #3a6a8c;
		color: white;
		border-radius: 6px;
		cursor: pointer;
		font-weight: bold;
		transition: all 0.2s;
	`;
	closeBtn.addEventListener("click", () => modal.remove());
	closeBtn.addEventListener("mouseenter", () => {
		closeBtn.style.background = "#5a8cac";
	});
	closeBtn.addEventListener("mouseleave", () => {
		closeBtn.style.background = "#4a7c9c";
	});
	modal.appendChild(closeBtn);

	document.body.appendChild(modal);

	// Auto-close after 8 seconds
	setTimeout(() => {
		if (modal.parentElement) {
			modal.style.opacity = "0";
			modal.style.transition = "opacity 0.3s ease-out";
			setTimeout(() => modal.remove(), 300);
		}
	}, 8000);
}

async function showChapterRegressionPrompt(options) {
	const {
		novelId,
		novelTitle,
		currentChapter,
		storedChapter,
		totalChapters,
		lastReadUrl,
	} = options;

	return new Promise((resolve) => {
		// Create modal overlay
		const overlay = document.createElement("div");
		protectFromThemeExtensions(overlay);
		overlay.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.7);
			z-index: 999998;
			display: flex;
			align-items: center;
			justify-content: center;
		`;

		// Create modal
		const modal = document.createElement("div");
		protectFromThemeExtensions(modal);
		modal.style.cssText = `
			background: linear-gradient(135deg, #1a2942 0%, #0f3460 100%);
			border: 2px solid #ff9800;
			border-radius: 12px;
			padding: 24px;
			color: white;
			font-family: system-ui, -apple-system, sans-serif;
			max-width: 450px;
			box-shadow: 0 8px 32px rgba(0,0,0,0.6);
		`;

		// Title
		const title = document.createElement("div");
		title.style.cssText = `
			font-size: 1.1em;
			font-weight: bold;
			margin-bottom: 12px;
			color: #ffbb88;
		`;
		title.textContent = "⚠️ Chapter Regression Detected";
		modal.appendChild(title);

		// Info message
		const infoDiv = document.createElement("div");
		infoDiv.style.cssText = `
			margin-bottom: 16px;
			line-height: 1.5;
			color: #ddd;
		`;
		infoDiv.innerHTML = `
			<div style="margin-bottom: 8px;">Your library shows you're at <strong style="color: #88ff88;">Chapter ${storedChapter}</strong></div>
			<div>But you're now reading <strong style="color: #ffbb88;">Chapter ${currentChapter}</strong></div>
		`;
		modal.appendChild(infoDiv);

		// Buttons container
		const buttonsDiv = document.createElement("div");
		buttonsDiv.style.cssText = `
			display: flex;
			gap: 10px;
			margin-top: 16px;
		`;

		// Keep button
		const keepBtn = document.createElement("button");
		keepBtn.textContent = `↩️ Keep Reading Ch. ${currentChapter}`;
		keepBtn.style.cssText = `
			flex: 1;
			padding: 12px;
			background: #4a7c9c;
			border: 1px solid #2a5b8d;
			color: white;
			border-radius: 6px;
			cursor: pointer;
			font-weight: bold;
			transition: all 0.2s;
		`;
		keepBtn.addEventListener("click", async () => {
			debugLog(
				`💾 Keeping chapter ${currentChapter} for ${novelTitle}`,
			);
			// User is choosing to read from this (earlier) chapter — update progress to here
			await novelLibrary.updateReadingProgress(
				novelId,
				currentChapter,
				window.location.href,
				{ totalChapters },
			);
			overlay.remove();
			resolve({ action: "keep" });
		});
		keepBtn.addEventListener("mouseenter", () => {
			keepBtn.style.background = "#5a8cac";
		});
		keepBtn.addEventListener("mouseleave", () => {
			keepBtn.style.background = "#4a7c9c";
		});
		buttonsDiv.appendChild(keepBtn);

		// Resume button
		const resumeBtn = document.createElement("button");
		resumeBtn.textContent = `📖 Go Back to Ch. ${storedChapter}`;
		resumeBtn.style.cssText = `
			flex: 1;
			padding: 12px;
			background: #c2655b;
			border: 1px solid #a0453a;
			color: white;
			border-radius: 6px;
			cursor: pointer;
			font-weight: bold;
			transition: all 0.2s;
		`;
		resumeBtn.addEventListener("click", async () => {
			debugLog(
				`↩️ Resuming chapter ${storedChapter} for ${novelTitle}`,
			);

			if (lastReadUrl) {
				overlay.remove();
				resolve({ action: "resume" });
				// Navigate to the saved chapter URL
				window.location.href = lastReadUrl;
			} else {
				showTimedBanner(
					"No saved URL for that chapter",
					"warning",
					2000,
				);
				overlay.remove();
				resolve({ action: "resume" });
			}
		});
		resumeBtn.addEventListener("mouseenter", () => {
			resumeBtn.style.background = "#d17566";
		});
		resumeBtn.addEventListener("mouseleave", () => {
			resumeBtn.style.background = "#c2655b";
		});
		buttonsDiv.appendChild(resumeBtn);

		modal.appendChild(buttonsDiv);
		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		// Close on overlay click (outside modal)
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) {
				overlay.remove();
				resolve({ action: "keep" });
			}
		});
	});
}

async function handleNovelAddUpdate() {
	if (!currentHandler || !novelLibrary) {
		showTimedBanner("Library not available", "warning", 3000);
		return;
	}

	try {
		showTimedBanner("Saving novel...", "updating", 0, {
			field: "metadata",
		});

		const metadata = currentHandler.extractNovelMetadata();
		if (!metadata || !metadata.title) {
			showTimedBanner(
				"Could not extract novel metadata",
				"warning",
				3000,
			);
			return;
		}

		const novelId = getNovelIdFromCurrentPage();
		if (!novelId) {
			showTimedBanner("Could not generate novel ID", "warning", 3000);
			return;
		}

		const novelData = {
			id: novelId,
			title: metadata.title,
			author: metadata.author || "Unknown",
			description: metadata.description || "",
			coverUrl: metadata.coverUrl || "",
			sourceUrl: metadata.mainNovelUrl || window.location.href,
			sourceSite: window.location.hostname,
			shelfId:
				currentHandler.constructor.SHELF_METADATA?.id || "unknown",
			genres: metadata.genres || [],
			tags: metadata.tags || [],
			status: metadata.status || null,
			totalChapters: metadata.chapterCount || null,
			lastUpdated: Date.now(),
		};

		const savedNovel = await novelLibrary.addOrUpdateNovel(novelData);
		if (!savedNovel) {
			showTimedBanner(
				"Failed to save novel to library",
				"warning",
				4000,
			);
			return;
		}

		// Also update with extracted metadata
		await novelLibrary.updateNovelMetadata(novelId, metadata);

		// If on mobile, fetch desktop version metadata in background
		if (
			currentHandler?.constructor?.name === "FanfictionMobileHandler"
		) {
			debugLog("[Mobile] Fetching desktop metadata in background...");
			try {
				const desktopMetadata =
					await currentHandler.fetchDesktopMetadata();
				if (desktopMetadata) {
					debugLog(
						"[Mobile] Desktop metadata fetched successfully",
					);
					showTimedBanner(
						`Saved with full metadata: ${metadata.title}`,
						"success",
						3000,
					);
				} else {
					showTimedBanner(
						`Saved: ${metadata.title}`,
						"success",
						3000,
					);
				}
			} catch (err) {
				debugError(
					"[Mobile] Failed to fetch desktop metadata:",
					err,
				);
				showTimedBanner(
					`Saved: ${metadata.title}`,
					"success",
					3000,
				);
			}
		} else {
			showTimedBanner(`Saved: ${metadata.title}`, "success", 3000);
		}
		// UI refresh is handled by the caller (ui-controls.js refreshUI)
	} catch (error) {
		debugError("Error saving novel:", error);
		showTimedBanner(
			`Error saving novel${error?.message ? ": " + error.message : ""}`,
			"warning",
			4000,
		);
	}
}

async function handleNovelDelete() {
	if (!novelLibrary) return;

	const novelId = getNovelIdFromCurrentPage();
	if (!novelId) return;

	// Confirm deletion
	if (!confirm("Remove this novel from your library?")) {
		return;
	}

	try {
		await novelLibrary.removeNovel(novelId);
		showTimedBanner("Novel removed from library", "success", 3000);
		// UI refresh is handled by the caller (ui-controls.js refreshUI)
	} catch (error) {
		debugError("Error removing novel:", error);
		showTimedBanner("Error removing novel", "warning", 3000);
	}
}

async function handleRemoveNovelWithBlocklist(novelId) {
	if (!novelLibrary || !novelId) return;

	try {
		// Delete from library
		await novelLibrary.removeNovel(novelId);

		// Add to blocklist to prevent auto-add
		try {
			const blocklistJson = localStorage.getItem(
				"rg_auto_add_blocklist",
			);
			const blocklist = blocklistJson
				? JSON.parse(blocklistJson)
				: [];

			// Add novel ID if not already in blocklist
			if (!blocklist.includes(novelId)) {
				blocklist.push(novelId);
				localStorage.setItem(
					"rg_auto_add_blocklist",
					JSON.stringify(blocklist),
				);
				debugLog(
					"Ranobe Gemini: Added novelId to blocklist:",
					novelId,
				);
			}
		} catch (storageError) {
			debugWarn(
				"Ranobe Gemini: Error writing to blocklist:",
				storageError,
			);
			// Continue even if blocklist write fails
		}

		showTimedBanner(
			"Novel removed from library (won't auto-add)",
			"success",
			3000,
		);

		// Refresh the controls – remove first so the DOM guard allows re-creation.
		removeChapterNovelControlsFromDOM();
		const config = currentHandler?.getNovelControlsConfig?.() || {};
		const newControls = await createChapterPageNovelControls(config);
		if (newControls) {
			placeChapterNovelControls(newControls, config);
		}
	} catch (error) {
		debugError("Error removing novel with blocklist:", error);
		showTimedBanner("Error removing novel", "warning", 3000);
	}
}

function isNovelBlocklisted(novelId) {
	try {
		const blocklistJson = localStorage.getItem("rg_auto_add_blocklist");
		const blocklist = blocklistJson ? JSON.parse(blocklistJson) : [];
		return blocklist.includes(novelId);
	} catch (error) {
		debugWarn("Ranobe Gemini: Error checking blocklist:", error);
		return false;
	}
}

    return {
        extractNovelContext,
        getNovelIdFromCurrentPage,
        autoUpdateNovelOnVisit,
        handleNovelAddUpdate,
        handleNovelDelete,
        handleRemoveNovelWithBlocklist,
        isNovelBlocklisted,
    };
}
