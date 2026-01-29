/**
 * Site Settings Helper
 * Manages per-site enable/disable toggles with defaults sourced from handler metadata.
 */

import { SHELF_REGISTRY } from "./domain-constants.js";

export const SITE_SETTINGS_KEY = "rg_site_settings";
export const DOMAIN_SETTINGS_KEY = "rg_domain_settings";

let cachedDefaults = null;
let cachedDomainDefaults = null;

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

function normalizeHostname(value) {
	if (!value || typeof value !== "string") return "";
	try {
		if (value.includes("://")) {
			return new URL(value).hostname.toLowerCase();
		}
	} catch (_error) {
		// ignore invalid URL parsing
	}
	return value.toLowerCase();
}

function matchesHostname(hostname, pattern) {
	if (!hostname || !pattern) return false;
	const normalizedHostname = hostname.toLowerCase();
	const normalizedPattern = pattern.toLowerCase();
	if (normalizedPattern.startsWith("*")) {
		const suffix = normalizedPattern.replace(/^\*\.?(.*)/, "$1");
		return (
			normalizedHostname === suffix ||
			normalizedHostname.endsWith(`.${suffix}`)
		);
	}
	return (
		normalizedHostname === normalizedPattern ||
		normalizedHostname.endsWith(`.${normalizedPattern}`)
	);
}

function buildDefaultDomainSettings() {
	if (cachedDomainDefaults) return cachedDomainDefaults;

	const defaults = {};
	for (const shelf of Object.values(SHELF_REGISTRY)) {
		const domains = shelf?.domains || [];
		for (const domain of domains) {
			if (!domain) continue;
			defaults[domain] = {
				enabled: true,
				shelfId: shelf.id,
				name: shelf.name || shelf.id,
			};
		}
	}

	cachedDomainDefaults = defaults;
	return defaults;
}

export function getDefaultSiteSettings() {
	return { ...buildDefaultSiteSettings() };
}

export function getDefaultDomainSettings() {
	return { ...buildDefaultDomainSettings() };
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
		isSiteEnabled(merged, shelf.id),
	);
}

export function isDomainEnabled(settings, hostnameOrUrl) {
	const hostname = normalizeHostname(hostnameOrUrl);
	if (!hostname) return true;
	const merged = settings || {};
	const direct = merged[hostname];
	if (direct && typeof direct.enabled === "boolean") {
		return direct.enabled;
	}

	const matchKey = Object.keys(merged).find((key) =>
		matchesHostname(hostname, key),
	);
	if (matchKey && typeof merged[matchKey]?.enabled === "boolean") {
		return merged[matchKey].enabled;
	}

	return true;
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

export async function getDomainSettings() {
	const defaults = buildDefaultDomainSettings();

	try {
		const result = await browser.storage.local.get(DOMAIN_SETTINGS_KEY);
		const stored = result[DOMAIN_SETTINGS_KEY] || {};
		const merged = { ...defaults };

		for (const [domain, value] of Object.entries(stored)) {
			const base = defaults[domain] || { enabled: true };
			merged[domain] = {
				...base,
				...value,
				enabled:
					typeof value.enabled === "boolean"
						? value.enabled
						: base.enabled,
			};
		}

		return merged;
	} catch (error) {
		console.warn("Domain settings: failed to load", error);
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

export async function saveDomainSettings(updates = {}) {
	const defaults = buildDefaultDomainSettings();
	const current = await getDomainSettings();
	const merged = { ...current };

	for (const [domain, value] of Object.entries(updates)) {
		if (!domain) continue;
		const base = current[domain] || defaults[domain] || { enabled: true };
		merged[domain] = {
			...base,
			...value,
			enabled:
				value && typeof value.enabled === "boolean"
					? value.enabled
					: base.enabled,
		};
	}

	await browser.storage.local.set({
		[DOMAIN_SETTINGS_KEY]: merged,
	});

	return merged;
}

export async function setDomainEnabled(domainOrUrl, enabled) {
	const hostname = normalizeHostname(domainOrUrl);
	if (!hostname) return getDomainSettings();
	return saveDomainSettings({
		[hostname]: {
			enabled: Boolean(enabled),
		},
	});
}
