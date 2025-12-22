/**
 * Site Settings Helper
 * Manages per-site enable/disable toggles with defaults sourced from handler metadata.
 */

import { SHELF_REGISTRY } from "./domain-constants.js";

export const SITE_SETTINGS_KEY = "rg_site_settings";

let cachedDefaults = null;

function buildDefaultSiteSettings() {
	if (cachedDefaults) return cachedDefaults;

	const defaults = {};
	for (const shelf of Object.values(SHELF_REGISTRY)) {
		if (!shelf?.id) continue;
		defaults[shelf.id] = {
			enabled: shelf.enabledByDefault !== false,
			name: shelf.name || shelf.id,
			domains: shelf.domains || [],
			icon: shelf.icon,
			emoji: shelf.emoji,
			color: shelf.color,
		};
	}

	cachedDefaults = defaults;
	return defaults;
}

export function getDefaultSiteSettings() {
	return { ...buildDefaultSiteSettings() };
}

export function isSiteEnabled(settings, shelfId) {
	if (!shelfId) return true;
	const defaults = buildDefaultSiteSettings();
	const merged = settings || {};
	const setting = merged[shelfId];
	if (setting && typeof setting.enabled === "boolean") {
		return setting.enabled;
	}
	return defaults[shelfId]?.enabled !== false;
}

export function filterEnabledShelves(settings) {
	const merged = settings || {};
	return Object.values(SHELF_REGISTRY).filter((shelf) =>
		isSiteEnabled(merged, shelf.id)
	);
}

export async function getSiteSettings() {
	const defaults = buildDefaultSiteSettings();

	try {
		const result = await browser.storage.local.get(SITE_SETTINGS_KEY);
		const stored = result[SITE_SETTINGS_KEY] || {};
		const merged = {};

		for (const [id, def] of Object.entries(defaults)) {
			const userSetting = stored[id] || {};
			merged[id] = {
				...def,
				...userSetting,
				enabled:
					typeof userSetting.enabled === "boolean"
						? userSetting.enabled
						: def.enabled,
			};
		}

		return merged;
	} catch (error) {
		console.warn("Site settings: failed to load", error);
		return { ...defaults };
	}
}

export async function saveSiteSettings(updates = {}) {
	const defaults = buildDefaultSiteSettings();
	const current = await getSiteSettings();
	const merged = { ...current };

	for (const [id, value] of Object.entries(updates)) {
		const base = current[id] || defaults[id] || { enabled: true };
		merged[id] = {
			...base,
			...value,
			enabled:
				value && typeof value.enabled === "boolean"
					? value.enabled
					: base.enabled,
		};
	}

	await browser.storage.local.set({
		[SITE_SETTINGS_KEY]: merged,
	});

	return merged;
}
