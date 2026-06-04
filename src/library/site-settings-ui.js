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
import { NovelbinHandler } from "../utils/website-handlers/novelbin-handler.js";

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
	NovelbinHandler,
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

			if (field.type === "number") {
				const numVal = settings[field.key] ?? field.defaultValue ?? 0;
				const minAttr = field.min != null ? ` min="${field.min}"` : "";
				const maxAttr = field.max != null ? ` max="${field.max}"` : "";
				const stepAttr = field.step != null ? ` step="${field.step}"` : "";
				return `
				<div class="ls-handler-field">
					<div class="ls-handler-field-info">
						<div class="ls-handler-field-label">${field.label}</div>
						<div class="ls-handler-field-desc">${field.description || ""}</div>
					</div>
					<input type="number" class="ls-input ls-handler-field-number"
						data-shelf="${definition.id}" data-setting="${field.key}"
						value="${numVal}"${minAttr}${maxAttr}${stepAttr}
						style="width:100px;" />
				</div>`;
			}

			if (field.type === "textarea") {
				const rawTa = settings[field.key];
				// Guard: a boolean means the field was previously saved as a toggle
				// (old renderer didn't support textarea). Treat that as empty.
				const taVal = String(
					typeof rawTa === "boolean" || rawTa === undefined || rawTa === null
						? (field.defaultValue ?? "")
						: rawTa,
				).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
				const ph = (field.placeholder || "").replace(/"/g, "&quot;");
				return `
				<div class="ls-handler-field ls-handler-field--wide">
					<div class="ls-handler-field-info">
						<div class="ls-handler-field-label">${field.label}</div>
						<div class="ls-handler-field-desc">${field.description || ""}</div>
					</div>
					<textarea class="ls-textarea ls-handler-field-textarea"
						data-shelf="${definition.id}" data-setting="${field.key}"
						rows="4" placeholder="${ph}"
						style="margin-top:6px;font-size:12px;font-family:monospace;">${taVal}</textarea>
				</div>`;
			}

			// Default: toggle
			const value = Boolean(settings[field.key] ?? field.defaultValue);
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

	// Render flat — no inner <details> wrapper. The site card's own
	// expand/collapse is already one click; a second nested toggle was
	// making settings invisible.
	return `<div class="ls-handler-fields">${fieldsHtml}</div>`;
}
