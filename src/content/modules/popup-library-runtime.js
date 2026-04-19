/**
 * Popup/library runtime helpers extracted from content.js.
 *
 * This module centralizes popup message actions that query or update
 * library state from content runtime context.
 */

export async function getNovelInfoRuntime({
	currentHandler,
	browserRef = browser,
	windowRef = window,
	cacheNovelData,
	debugLog = () => {},
	debugError = () => {},
}) {
	try {
		if (!currentHandler) {
			debugLog("getNovelInfo: No handler available");
			return {
				success: false,
				error: "No handler available for this page",
			};
		}

		debugLog("getNovelInfo: Extracting metadata...");
		const metadata = await currentHandler.extractNovelMetadata();
		debugLog("getNovelInfo: Raw metadata:", metadata);

		if (!metadata || !metadata.title) {
			debugLog("getNovelInfo: No valid metadata found");
			return {
				success: false,
				error: "Could not extract novel metadata",
			};
		}

		const chapterNav = currentHandler.getChapterNavigation?.() || {};
		const currentReadingChapter = chapterNav.currentChapter;

		const isOnChapterPage = currentHandler.isChapterPage?.() || false;
		const isOnNovelPage = currentHandler.isNovelPage?.() || false;

		const libraryUrl = browserRef.runtime.getURL("utils/novel-library.js");
		const { novelLibrary } = await import(libraryUrl);
		const library = await novelLibrary.getLibrary();
		const novelId =
			metadata.id ||
			currentHandler.generateNovelId(windowRef.location.href);
		const isInLibrary =
			novelId && library.novels && library.novels[novelId] !== undefined;

		const libraryNovel = isInLibrary ? library.novels[novelId] : null;

		const novelInfo = {
			novelId,
			title: metadata.title,
			author: metadata.author,
			description:
				metadata.description ||
				(libraryNovel ? libraryNovel.description : null),
			coverUrl:
				metadata.coverUrl ||
				metadata.coverImage ||
				(libraryNovel ? libraryNovel.coverUrl : null),
			currentChapter:
				currentReadingChapter ||
				(libraryNovel ? libraryNovel.lastReadChapter : null),
			totalChapters:
				metadata.totalChapters ||
				(libraryNovel ? libraryNovel.totalChapters : null),
			chapterTitle: metadata.chapterTitle,
			source: metadata.source || currentHandler.getSiteIdentifier(),
			sourceUrl: metadata.sourceUrl || windowRef.location.href,
			mainNovelUrl:
				metadata.mainNovelUrl ||
				(libraryNovel ? libraryNovel.sourceUrl : null),
			isInLibrary,
			isChapterPage: isOnChapterPage,
			isNovelPage: isOnNovelPage,
			shelfId: libraryNovel
				? libraryNovel.shelfId
				: currentHandler.constructor.SHELF_METADATA?.id || null,
			...(isInLibrary && libraryNovel
				? {
						readingStatus: libraryNovel.readingStatus || "reading",
						lastReadChapter: libraryNovel.lastReadChapter,
						lastReadUrl: libraryNovel.lastReadUrl,
						dateAdded: libraryNovel.dateAdded,
						lastUpdated: libraryNovel.lastUpdated,
						genres: libraryNovel.genres || metadata.genres || [],
						tags: libraryNovel.tags || metadata.tags || [],
						status: libraryNovel.status || metadata.status,
						enhancedChapters:
							libraryNovel.enhancedChaptersCount || 0,
					}
				: {
						genres: metadata.genres || [],
						tags: metadata.tags || [],
						status: metadata.status,
					}),
		};

		debugLog("getNovelInfo: Returning novelInfo:", novelInfo);
		cacheNovelData?.(novelInfo);
		return {
			success: true,
			novelInfo,
		};
	} catch (error) {
		debugError("Error in getNovelInfoRuntime:", error);
		return { success: false, error: error.message };
	}
}

export async function addCurrentNovelToLibraryRuntime({
	currentHandler,
	browserRef = browser,
	windowRef = window,
	cacheNovelData,
	logNotification,
	debugError = () => {},
}) {
	try {
		if (!currentHandler) {
			return {
				success: false,
				error: "No handler available for this page",
			};
		}

		const metadata = await currentHandler.extractNovelMetadata();
		if (!metadata) {
			return {
				success: false,
				error: "Could not extract novel metadata",
			};
		}

		const libraryUrl = browserRef.runtime.getURL("utils/novel-library.js");
		const { novelLibrary, READING_STATUS } = await import(libraryUrl);

		const inferredLastReadChapter = Number.isFinite(
			Number(metadata.currentChapter),
		)
			? Number(metadata.currentChapter)
			: 0;
		const inferredReadingStatus =
			inferredLastReadChapter > 0 ? READING_STATUS.READING : undefined;

		const result = await novelLibrary.addOrUpdateNovel({
			title: metadata.title,
			author: metadata.author,
			coverUrl: metadata.coverUrl || metadata.coverImage,
			currentChapter: metadata.currentChapter,
			lastReadChapter: inferredLastReadChapter,
			lastReadUrl: windowRef.location.href,
			readingStatus: inferredReadingStatus,
			totalChapters:
				metadata.totalChapters || metadata.metadata?.totalChapters,
			chapterTitle: metadata.chapterTitle,
			source: metadata.source || currentHandler.getSiteIdentifier(),
			sourceUrl: metadata.sourceUrl || windowRef.location.href,
			mainNovelUrl:
				metadata.mainNovelUrl ||
				metadata.sourceUrl ||
				windowRef.location.href,
			lastChapterUrl: windowRef.location.href,
			tags: metadata.tags || [],
			genres: metadata.genres || [],
			status: metadata.status,
			metadata: metadata.metadata || metadata,
			metadataIncomplete:
				metadata.metadataIncomplete ||
				metadata.needsDetailPage ||
				false,
			description: metadata.description,
		});

		const cachedNovel = cacheNovelData?.(result);
		logNotification?.({
			type: "success",
			message: "Novel saved to library",
			title: metadata.title,
			novelData: cachedNovel,
			metadata: {
				action: "library-save",
				source: metadata.source || currentHandler.getSiteIdentifier(),
			},
		});

		return { success: true, novel: result };
	} catch (error) {
		debugError("Error in addCurrentNovelToLibraryRuntime:", error);
		logNotification?.({
			type: "error",
			message: `Failed to save novel: ${error.message}`,
			metadata: {
				action: "library-save",
			},
		});
		return { success: false, error: error.message };
	}
}

export async function updateNovelReadingStatusRuntime({
	novelId,
	readingStatus,
	browserRef = browser,
	debugError = () => {},
}) {
	try {
		const libraryUrl = browserRef.runtime.getURL("utils/novel-library.js");
		const { novelLibrary } = await import(libraryUrl);
		const result = await novelLibrary.updateNovel(novelId, {
			readingStatus,
		});
		return { success: true, result };
	} catch (error) {
		debugError("Error updating reading status:", error);
		return {
			success: false,
			error: error.message || "Failed to update reading status",
		};
	}
}

export function getSiteHandlerInfoRuntime({ currentHandler }) {
	const response = { success: true, hasHandler: false };

	if (currentHandler) {
		response.hasHandler = true;
		response.siteIdentifier = currentHandler.getSiteIdentifier();
		response.defaultPrompt = currentHandler.getDefaultPrompt();
		response.siteSpecificPrompt = currentHandler.getSiteSpecificPrompt();
	}

	return response;
}

export function testExtractionRuntime({ extractContent }) {
	const result = extractContent();
	return {
		success: true,
		foundContent: result.found,
		title: result.title,
		text: result.text.substring(0, 100) + "...",
	};
}

export default {
	getNovelInfoRuntime,
	addCurrentNovelToLibraryRuntime,
	updateNovelReadingStatusRuntime,
	getSiteHandlerInfoRuntime,
	testExtractionRuntime,
};
