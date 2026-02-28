/**
 * Website-specific settings UI definitions.
 *
 * Settings are auto-discovered from each handler's static SETTINGS_DEFINITION
 * property. To add settings for a new site, simply add SETTINGS_DEFINITION to
 * its handler class — no changes needed here.
 */

import { FanfictionHandler } from "../utils/website-handlers/fanfiction-handler.js";
import { AO3Handler } from "../utils/website-handlers/ao3-handler.js";
import { RanobesHandler } from "../utils/website-handlers/ranobes-handler.js";
import { ScribbleHubHandler } from "../utils/website-handlers/scribblehub-handler.js";
import { WebNovelHandler } from "../utils/website-handlers/webnovel-handler.js";

/**
 * All registered handler classes.
 * Add new handlers here when they are created.
 * @type {typeof import("../utils/website-handlers/base-handler.js").BaseWebsiteHandler[]}
 */
const ALL_HANDLERS = [
	FanfictionHandler,
	AO3Handler,
	RanobesHandler,
	ScribbleHubHandler,
	WebNovelHandler,
];

/**
 * Auto-generated settings definitions built from each handler's SETTINGS_DEFINITION.
 * Only handlers that declare SETTINGS_DEFINITION (non-null) are included.
 *
 * @type {Array<{id: string, label: string, description: string, fields: Array}>}
 */
export const WEBSITE_SETTINGS_DEFINITIONS = ALL_HANDLERS.filter(
	(H) => H.SETTINGS_DEFINITION != null,
).map((H) => {
	const meta = H.SHELF_METADATA;
	return {
		id: meta.id,
		label: meta.name,
		icon: meta.icon || null, // website favicon/logo URL
		invertIconInDarkMode: meta.invertIconInDarkMode || false,
		emoji: meta.emoji || "🌐", // fallback emoji if icon fails or is absent
		description: `Site-specific settings for ${meta.name}.`,
		fields: H.SETTINGS_DEFINITION.fields,
	};
});

/**
 * Look up the settings definition for a specific site by shelf ID.
 * @param {string} shelfId
 * @returns {{ id: string, label: string, description: string, fields: Array } | null}
 */
export function getWebsiteSettingsDefinition(shelfId) {
	return (
		WEBSITE_SETTINGS_DEFINITIONS.find((def) => def.id === shelfId) || null
	);
}

export function renderWebsiteSettingsPanel(definition, settings = {}) {
	if (!definition) return "";

	const fieldsHtml = definition.fields
		.map((field) => {
			// Section separator
			if (field.type === "section") {
				return `<div class="ls-handler-field-section">
					<span class="ls-handler-field-section-label">${field.label}</span>
				</div>`;
			}

			// Text input
			if (field.type === "text") {
				const val = String(
					settings[field.key] ?? field.defaultValue ?? "",
				).replace(/"/g, "&quot;");
				const ph = (field.placeholder || "").replace(/"/g, "&quot;");
				return `
				<div class="ls-handler-field ls-handler-field--text">
					<div class="ls-handler-field-info">
						<div class="ls-handler-field-label">${field.label}</div>
						<div class="ls-handler-field-desc">${field.description || ""}</div>
					</div>
					<input type="text" class="ls-input ls-handler-field-text-input"
						data-shelf="${definition.id}" data-setting="${field.key}"
						value="${val}" placeholder="${ph}" />
				</div>`;
			}

			if (field.type === "select") {
				const currentValue =
					settings[field.key] ?? field.defaultValue ?? "auto";
				const optionsHtml = field.options
					.map(
						(opt) =>
							`<option value="${opt.value}" ${currentValue === opt.value ? "selected" : ""}>${opt.label}</option>`,
					)
					.join("");
				return `
				<div class="ls-handler-field">
					<div class="ls-handler-field-info">
						<div class="ls-handler-field-label">${field.label}</div>
						<div class="ls-handler-field-desc">${field.description}</div>
					</div>
					<select class="ls-select ls-handler-field-select"
						data-shelf="${definition.id}" data-setting="${field.key}">
						${optionsHtml}
					</select>
				</div>`;
			}

			const value = Boolean(settings[field.key]);
			return `
			<div class="ls-handler-field">
				<div class="ls-handler-field-info">
					<div class="ls-handler-field-label">${field.label}</div>
					<div class="ls-handler-field-desc">${field.description}</div>
				</div>
				<label class="ls-toggle">
					<input type="checkbox" data-shelf="${definition.id}" data-setting="${field.key}" ${value ? "checked" : ""} />
					<span class="ls-toggle-track"></span>
				</label>
			</div>`;
		})
		.join("");

	const fieldCount = definition.fields.filter(
		(f) => f.type !== "section",
	).length;
	// Use Google's favicon proxy to avoid hotlink-blocked direct URLs
	const faviconUrl = definition.icon
		? (() => {
				try {
					return `https://www.google.com/s2/favicons?domain=${new URL(definition.icon).hostname}&sz=32`;
				} catch {
					return null;
				}
			})()
		: null;
	const iconHtml = faviconUrl
		? `<img src="${faviconUrl}" class="ls-handler-panel-icon" alt="" data-emoji="${definition.emoji}" ${definition.invertIconInDarkMode ? 'data-invert="true"' : ""} />`
		: `<span class="ls-handler-panel-icon ls-handler-panel-emoji">${definition.emoji}</span>`;

	return `
		<details class="ls-handler-panel">
			<summary class="ls-handler-panel-summary">
				${iconHtml}
				<span class="ls-handler-panel-title">${definition.label}</span>
				<span class="ls-handler-panel-badge">${fieldCount} setting${fieldCount !== 1 ? "s" : ""}</span>
				<span class="ls-handler-panel-chevron">▾</span>
			</summary>
			<div class="ls-handler-panel-body">
				<p class="ls-hint" style="margin-bottom:14px;">${definition.description}</p>
				<div class="ls-handler-fields">
					${fieldsHtml}
				</div>
			</div>
		</details>`;
}
