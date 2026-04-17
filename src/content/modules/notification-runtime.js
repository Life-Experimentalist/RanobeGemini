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
					novelData || (await resolveNovelDataForNotificationRuntime()),
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
	};
}

export default {
	createNotificationRuntime,
};
