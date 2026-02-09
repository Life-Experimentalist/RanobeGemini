/**
 * Notification Manager
 * Tracks all notifications, banners, errors, and events across the extension
 */

import { debugLog, debugError } from "./logger.js";

const MAX_NOTIFICATIONS = 500; // Keep last 500 notifications

/**
 * Notification types
 */
export const NotificationType = {
	SUCCESS: "success",
	ERROR: "error",
	INFO: "info",
	WARNING: "warning",
	BANNER: "banner",
};

/**
 * Notification manager class
 */
class NotificationManager {
	constructor() {
		this.notifications = [];
		this.initialized = false;
	}

	/**
	 * Initialize notification manager
	 */
	async initialize() {
		if (this.initialized) return;

		try {
			const result = await browser.storage.local.get([
				"notificationHistory",
			]);
			this.notifications = result.notificationHistory || [];
			this.initialized = true;
			debugLog(
				"Notification manager initialized with",
				this.notifications.length,
				"notifications",
			);
		} catch (error) {
			debugError("Failed to initialize notification manager:", error);
			this.notifications = [];
			this.initialized = true;
		}
	}

	/**
	 * Add a notification
	 * @param {Object} options - Notification options
	 * @param {string} options.type - Notification type (success, error, info, warning, banner)
	 * @param {string} options.message - Notification message
	 * @param {string} [options.title] - Optional title
	 * @param {string} [options.url] - URL where notification occurred
	 * @param {Object} [options.novelData] - Associated novel data
	 * @param {Object} [options.metadata] - Additional metadata
	 * @param {string} [options.source] - Source of notification (popup, content, background)
	 * @returns {Promise<string>} Notification ID
	 */
	async add({
		type = NotificationType.INFO,
		message,
		title = null,
		url = null,
		novelData = null,
		metadata = null,
		source = "unknown",
	}) {
		if (!this.initialized) {
			await this.initialize();
		}

		const notification = {
			id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
			type,
			message,
			title,
			url,
			novelData,
			metadata,
			source,
			timestamp: new Date().toISOString(),
			read: false,
		};

		this.notifications.unshift(notification); // Add to beginning

		// Trim to max size
		if (this.notifications.length > MAX_NOTIFICATIONS) {
			this.notifications = this.notifications.slice(0, MAX_NOTIFICATIONS);
		}

		// Save to storage
		await this.save();

		debugLog("Notification added:", notification);
		return notification.id;
	}

	/**
	 * Mark notification as read
	 * @param {string} id - Notification ID
	 */
	async markAsRead(id) {
		const notification = this.notifications.find((n) => n.id === id);
		if (notification) {
			notification.read = true;
			await this.save();
		}
	}

	/**
	 * Mark all notifications as read
	 */
	async markAllAsRead() {
		this.notifications.forEach((n) => {
			n.read = true;
		});
		await this.save();
	}

	/**
	 * Get all notifications
	 * @param {Object} options - Filter options
	 * @param {string} [options.type] - Filter by type
	 * @param {boolean} [options.unreadOnly] - Only unread notifications
	 * @param {number} [options.limit] - Limit number of results
	 * @param {boolean} [options.grouped] - Group related notifications by novel
	 * @returns {Array} Notifications
	 */
	getAll({
		type = null,
		unreadOnly = false,
		limit = null,
		grouped = false,
	} = {}) {
		let filtered = this.notifications;

		if (type) {
			filtered = filtered.filter((n) => n.type === type);
		}

		if (unreadOnly) {
			filtered = filtered.filter((n) => !n.read);
		}

		if (grouped) {
			filtered = this.groupNotifications(filtered);
		}

		if (limit) {
			filtered = filtered.slice(0, limit);
		}

		return filtered;
	}

	/**
	 * Group related notifications by novel
	 * Groups "updating" and "success" notifications for the same novel
	 * @param {Array} notifications - Notifications to group
	 * @returns {Array} Grouped notifications
	 */
	groupNotifications(notifications) {
		const grouped = [];
		const processedIds = new Set();
		const novelGroups = new Map(); // novelId -> group of related notifications

		// First pass: identify novel-based groups
		notifications.forEach((notif) => {
			const novelId = this.extractNovelId(notif);
			if (novelId && this.isGroupableNotification(notif)) {
				if (!novelGroups.has(novelId)) {
					novelGroups.set(novelId, []);
				}
				novelGroups.get(novelId).push(notif);
			}
		});

		// Second pass: create grouped notifications
		notifications.forEach((notif) => {
			if (processedIds.has(notif.id)) return;

			const novelId = this.extractNovelId(notif);
			if (
				novelId &&
				novelGroups.has(novelId) &&
				novelGroups.get(novelId).length > 1
			) {
				const group = novelGroups.get(novelId);
				// Only create group once (on first encounter)
				if (!group.some((n) => processedIds.has(n.id))) {
					grouped.push(this.createNotificationGroup(group));
					group.forEach((n) => processedIds.add(n.id));
				}
			} else {
				// Not groupable - add as-is
				grouped.push(notif);
				processedIds.add(notif.id);
			}
		});

		return grouped;
	}

	/**
	 * Check if notification should be grouped
	 * @param {Object} notif - Notification
	 * @returns {boolean}
	 */
	isGroupableNotification(notif) {
		const groupableTypes = ["info", "success"];
		const groupableMessages = [
			/updating/i,
			/updated/i,
			/tracking/i,
			/added/i,
		];
		return (
			groupableTypes.includes(notif.type) &&
			groupableMessages.some((regex) => regex.test(notif.message))
		);
	}

	/**
	 * Extract novel ID from notification
	 * @param {Object} notif - Notification
	 * @returns {string|null}
	 */
	extractNovelId(notif) {
		if (notif.novelData?.novelId) return notif.novelData.novelId;
		if (notif.novelData?.id) return notif.novelData.id;
		if (notif.novelData?.bookTitle) return notif.novelData.bookTitle;
		if (notif.metadata?.novelId) return notif.metadata.novelId;
		// Try to extract from URL
		if (notif.url) {
			const match = notif.url.match(/\/s\/(\d+)/); // FanFiction pattern
			if (match) return match[1];
		}
		return null;
	}

	/**
	 * Create a grouped notification from multiple notifications
	 * @param {Array} notifications - Notifications to group
	 * @returns {Object} Grouped notification
	 */
	createNotificationGroup(notifications) {
		// Sort by timestamp (newest first)
		const sorted = [...notifications].sort(
			(a, b) => new Date(b.timestamp) - new Date(a.timestamp),
		);
		const latest = sorted[0];
		const earliest = sorted[sorted.length - 1];

		return {
			id: `group_${latest.id}`,
			type: latest.type,
			message: latest.message,
			title: latest.title,
			url: latest.url,
			novelData: latest.novelData,
			metadata: latest.metadata,
			source: latest.source,
			timestamp: latest.timestamp,
			read: sorted.every((n) => n.read),
			isGroup: true,
			groupedNotifications: sorted,
			groupCount: sorted.length,
			timeRange: {
				start: earliest.timestamp,
				end: latest.timestamp,
			},
		};
	}

	/**
	 * Get unread count
	 * @returns {number} Unread count
	 */
	getUnreadCount() {
		return this.notifications.filter((n) => !n.read).length;
	}

	/**
	 * Clear all notifications
	 */
	async clearAll() {
		this.notifications = [];
		await this.save();
	}

	/**
	 * Delete a specific notification
	 * @param {string} id - Notification ID
	 */
	async delete(id) {
		this.notifications = this.notifications.filter((n) => n.id !== id);
		await this.save();
	}

	/**
	 * Save notifications to storage
	 */
	async save() {
		try {
			await browser.storage.local.set({
				notificationHistory: this.notifications,
			});
		} catch (error) {
			debugError("Failed to save notifications:", error);
		}
	}

	/**
	 * Get statistics
	 */
	getStats() {
		return {
			total: this.notifications.length,
			unread: this.getUnreadCount(),
			byType: {
				success: this.notifications.filter(
					(n) => n.type === NotificationType.SUCCESS,
				).length,
				error: this.notifications.filter(
					(n) => n.type === NotificationType.ERROR,
				).length,
				info: this.notifications.filter(
					(n) => n.type === NotificationType.INFO,
				).length,
				warning: this.notifications.filter(
					(n) => n.type === NotificationType.WARNING,
				).length,
				banner: this.notifications.filter(
					(n) => n.type === NotificationType.BANNER,
				).length,
			},
		};
	}
}

// Create singleton instance
export const notificationManager = new NotificationManager();

/**
 * Helper function to add notification from anywhere in the extension
 * @param {string} type - Notification type
 * @param {string} message - Message
 * @param {Object} options - Additional options
 */
export async function notify(type, message, options = {}) {
	return await notificationManager.add({
		type,
		message,
		...options,
	});
}

// Export convenience functions
export const notifySuccess = (message, options = {}) =>
	notify(NotificationType.SUCCESS, message, options);
export const notifyError = (message, options = {}) =>
	notify(NotificationType.ERROR, message, options);
export const notifyInfo = (message, options = {}) =>
	notify(NotificationType.INFO, message, options);
export const notifyWarning = (message, options = {}) =>
	notify(NotificationType.WARNING, message, options);
export const notifyBanner = (message, options = {}) =>
	notify(NotificationType.BANNER, message, options);
