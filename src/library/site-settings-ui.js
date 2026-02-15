/**
 * Website-specific settings UI definitions
 */

export const WEBSITE_SETTINGS_DEFINITIONS = [
	{
		id: "fanfiction",
		label: "✍️ FanFiction.net",
		description:
			"FanFiction.net preferences for redirects and auto enhancements.",
		fields: [
			{
				key: "domainPreference",
				label: "Domain Preference",
				description:
					"Choose how to handle bare domain (fanfiction.net) visits.",
				type: "select",
				defaultValue: "auto",
				options: [
					{ value: "auto", label: "Auto (device-based)" },
					{ value: "www", label: "Desktop (www)" },
					{ value: "mobile", label: "Mobile (m)" },
				],
			},
			{
				key: "preferredTld",
				label: "Preferred TLD",
				description:
					"Default TLD to use when visiting FanFiction URLs.",
				type: "select",
				defaultValue: "net",
				options: [
					{ value: "net", label: "fanfiction.net (default)" },
					{ value: "ws", label: "fanfiction.ws" },
				],
			},
			{
				key: "autoEnhanceEnabled",
				label: "Auto-enhance chapters",
				description:
					"Automatically run Enhance when a FanFiction.net chapter loads.",
				type: "toggle",
			},
		],
	},
];

export function getWebsiteSettingsDefinition(shelfId) {
	return (
		WEBSITE_SETTINGS_DEFINITIONS.find((def) => def.id === shelfId) || null
	);
}

export function renderWebsiteSettingsPanel(definition, settings = {}) {
	if (!definition) return "";

	const fieldsHtml = definition.fields
		.map((field) => {
			if (field.type === "select") {
				const currentValue =
					settings[field.key] ?? field.defaultValue ?? "auto";
				const optionsHtml = field.options
					.map(
						(opt) => `
					<option value="${opt.value}" ${
						currentValue === opt.value ? "selected" : ""
					}>${opt.label}</option>
				`,
					)
					.join("");
				return `
					<div class="website-setting-item">
						<div class="website-setting-text">
							<div class="website-setting-label">${field.label}</div>
							<div class="settings-desc">${field.description}</div>
						</div>
						<select class="website-setting-select" data-shelf="${definition.id}" data-setting="${field.key}" style="padding: 6px 10px; border: 1px solid var(--border-color, #334155); border-radius: 4px; background: var(--bg-tertiary, #1f2937); color: var(--text-primary, #e5e7eb); font-size: 13px;">
							${optionsHtml}
						</select>
					</div>
				`;
			}

			const value = Boolean(settings[field.key]);
			return `
				<div class="website-setting-item">
					<div class="website-setting-text">
						<div class="website-setting-label">${field.label}</div>
						<div class="settings-desc">${field.description}</div>
					</div>
					<label class="toggle-switch toggle-switch-sm">
						<input type="checkbox" data-shelf="${definition.id}" data-setting="${field.key}" ${
							value ? "checked" : ""
						} />
						<span class="toggle-slider"></span>
					</label>
				</div>
			`;
		})
		.join("");

	return `
		<div class="settings-grid">
			<div class="settings-section" data-full-width="true" style="background: var(--bg-secondary, #1e293b); padding: 16px; border-radius: 8px; border-left: 3px solid #38bdf8;">
				<h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #38bdf8;">
					${definition.label} Settings
				</h3>
				<p class="settings-desc" style="margin-bottom: 12px; font-size: 12px;">
					${definition.description}
				</p>
				<div class="website-settings-list">
					${fieldsHtml}
				</div>
			</div>
		</div>
	`;
}
