/**
 * Centralized Theme Configuration for Ranobe Gemini
 *
 * Single source of truth for all theme definitions, preset skins, and
 * application logic. Used by: popup, library, library-settings, shelf-page,
 * and chunk-ui (content script context).
 *
 * Theme settings are stored in `browser.storage.local` under `"themeSettings"`.
 *
 * @module theme-config
 */

// ─────────────────────────────────────────────────────────────
// Default theme settings object (stored in browser.storage)
// ─────────────────────────────────────────────────────────────

export const DEFAULT_THEME = {
	mode: "dark",
	/**
	 * The currently selected preset ID in the UI dropdown.
	 * Can be a built-in preset ID (e.g. "material-dark") OR a custom preset ID
	 * (e.g. "custom-my-theme"). Use `basePreset` for the THEME_PRESETS lookup.
	 */
	preset: "material-dark",
	/**
	 * The THEME_PRESETS key used for the base palette/colors.
	 * Always a valid built-in preset ID. Set automatically when a custom preset
	 * is selected so `preset` can hold the custom ID while `basePreset` still
	 * maps to a real THEME_PRESETS entry.
	 * Leave empty string for built-in presets (falls back to `preset`).
	 */
	basePreset: "",
	accentPrimary: "#bb86fc",
	accentSecondary: "#6b7280",
	bgColor: "#0f172a",
	/** If set, overrides the preset's bg-secondary (surface) color */
	bgSecondary: "",
	/** If set, overrides the preset's bg-tertiary (card/elevated) color */
	bgTertiary: "",
	textColor: "#e5e7eb",
	/** Background animation identifier:
	 * CSS: "none" | "waves" | "leaves" | "shimmer"
	 * Canvas (bg-animation.js): "particles" | "falling-leaves" | "snow" | "rain" | "fireflies"
	 */
	bgAnimation: "none",
	/** User-saved custom theme presets: { id: { name, emoji, accentPrimary, ... } } */
	customPresets: {},
};

// ─────────────────────────────────────────────────────────────
// Preset Theme Skins
// ─────────────────────────────────────────────────────────────

/**
 * Each preset defines both dark and light variants of CSS custom properties.
 * The `meta` block holds human-readable info for the UI selector.
 * The `dark`/`light` blocks map directly to CSS custom properties.
 * The `content` block provides colors for the content-script level UI
 * (chunk banners, summary buttons, etc.).
 */
export const THEME_PRESETS = {
	"material-dark": {
		meta: {
			name: "Material Dark",
			emoji: "🌑",
			group: "default",
			animation: "none",
		},
		dark: {
			"primary-color": "#bb86fc",
			"primary-hover": "#9b66dc",
			"secondary-color": "#9ca3af",
			"danger-color": "#ef4444",
			"success-color": "#22c55e",
			"bg-primary": "#0f172a",
			"bg-secondary": "#111827",
			"bg-tertiary": "#1f2937",
			"bg-card": "#1f2937",
			"bg-card-hover": "#2b3544",
			"text-primary": "#e5e7eb",
			"text-secondary": "#9ca3af",
			"text-muted": "#6b7280",
			"border-color": "#2f3644",
			"border-light": "#3b4454",
		},
		light: {
			"primary-color": "#6200ee",
			"primary-hover": "#5000cc",
			"secondary-color": "#6b7280",
			"danger-color": "#ef4444",
			"success-color": "#22c55e",
			"bg-primary": "#f3f4f6",
			"bg-secondary": "#ffffff",
			"bg-tertiary": "#e5e7eb",
			"bg-card": "#ffffff",
			"bg-card-hover": "#f3f4f6",
			"text-primary": "#111827",
			"text-secondary": "#374151",
			"text-muted": "#6b7280",
			"border-color": "#e5e7eb",
			"border-light": "#d1d5db",
		},
		content: {
			dark: {
				primary: "#bb86fc",
				onPrimary: "#ffffff",
				onSurface: "#e1e1e1",
				onSurfaceVariant: "#b3b3b3",
				surface: "#121212",
				surfaceVariant: "#1e1e1e",
				outline: "#3a3a3a",
				outlineVariant: "#4a4a4a",
				overlay: "rgba(255, 255, 255, 0.08)",
				overlayHover: "rgba(255, 255, 255, 0.12)",
				error: "#cf6679",
				success: "#81c784",
			},
			light: {
				primary: "#6200ee",
				onPrimary: "#ffffff",
				onSurface: "#1c1c1c",
				onSurfaceVariant: "#5f5f5f",
				surface: "#ffffff",
				surfaceVariant: "#f5f5f5",
				outline: "#d0d0d0",
				outlineVariant: "#e0e0e0",
				overlay: "rgba(0, 0, 0, 0.05)",
				overlayHover: "rgba(0, 0, 0, 0.08)",
				error: "#b00020",
				success: "#4caf50",
			},
		},
	},

	"material-light": {
		meta: {
			name: "Material Light",
			emoji: "☀️",
			group: "default",
			animation: "none",
		},
		dark: {
			"primary-color": "#7c4dff",
			"primary-hover": "#651fff",
			"secondary-color": "#9ca3af",
			"danger-color": "#ef4444",
			"success-color": "#22c55e",
			"bg-primary": "#1a1a2e",
			"bg-secondary": "#16213e",
			"bg-tertiary": "#1f2937",
			"bg-card": "#1f2937",
			"bg-card-hover": "#2b3544",
			"text-primary": "#e5e7eb",
			"text-secondary": "#9ca3af",
			"text-muted": "#6b7280",
			"border-color": "#2f3644",
			"border-light": "#3b4454",
		},
		light: {
			"primary-color": "#7c4dff",
			"primary-hover": "#651fff",
			"secondary-color": "#6b7280",
			"danger-color": "#ef4444",
			"success-color": "#22c55e",
			"bg-primary": "#fafafa",
			"bg-secondary": "#ffffff",
			"bg-tertiary": "#f0f0f0",
			"bg-card": "#ffffff",
			"bg-card-hover": "#f5f5f5",
			"text-primary": "#212121",
			"text-secondary": "#616161",
			"text-muted": "#9e9e9e",
			"border-color": "#e0e0e0",
			"border-light": "#eeeeee",
		},
		content: {
			dark: {
				primary: "#7c4dff",
				onPrimary: "#ffffff",
				onSurface: "#e1e1e1",
				onSurfaceVariant: "#b3b3b3",
				surface: "#1a1a2e",
				surfaceVariant: "#16213e",
				outline: "#2f3644",
				outlineVariant: "#3b4454",
				overlay: "rgba(255, 255, 255, 0.08)",
				overlayHover: "rgba(255, 255, 255, 0.12)",
				error: "#cf6679",
				success: "#81c784",
			},
			light: {
				primary: "#7c4dff",
				onPrimary: "#ffffff",
				onSurface: "#212121",
				onSurfaceVariant: "#616161",
				surface: "#fafafa",
				surfaceVariant: "#f0f0f0",
				outline: "#e0e0e0",
				outlineVariant: "#eeeeee",
				overlay: "rgba(0, 0, 0, 0.04)",
				overlayHover: "rgba(0, 0, 0, 0.08)",
				error: "#b00020",
				success: "#4caf50",
			},
		},
	},

	ocean: {
		meta: { name: "Ocean", emoji: "🌊", group: "skin", animation: "waves" },
		dark: {
			"primary-color": "#00bcd4",
			"primary-hover": "#00acc1",
			"secondary-color": "#80deea",
			"danger-color": "#ef5350",
			"success-color": "#66bb6a",
			"bg-primary": "#0a1628",
			"bg-secondary": "#0d1f3c",
			"bg-tertiary": "#132d50",
			"bg-card": "#132d50",
			"bg-card-hover": "#1a3a64",
			"text-primary": "#e0f7fa",
			"text-secondary": "#80cbc4",
			"text-muted": "#4db6ac",
			"border-color": "#1a3a64",
			"border-light": "#245080",
		},
		light: {
			"primary-color": "#0097a7",
			"primary-hover": "#00838f",
			"secondary-color": "#00838f",
			"danger-color": "#ef5350",
			"success-color": "#66bb6a",
			"bg-primary": "#e0f7fa",
			"bg-secondary": "#ffffff",
			"bg-tertiary": "#b2ebf2",
			"bg-card": "#ffffff",
			"bg-card-hover": "#e0f7fa",
			"text-primary": "#004d40",
			"text-secondary": "#00695c",
			"text-muted": "#80cbc4",
			"border-color": "#b2ebf2",
			"border-light": "#e0f7fa",
		},
		content: {
			dark: {
				primary: "#00bcd4",
				onPrimary: "#000000",
				onSurface: "#e0f7fa",
				onSurfaceVariant: "#80cbc4",
				surface: "#0a1628",
				surfaceVariant: "#0d1f3c",
				outline: "#1a3a64",
				outlineVariant: "#245080",
				overlay: "rgba(0, 188, 212, 0.08)",
				overlayHover: "rgba(0, 188, 212, 0.12)",
				error: "#ef5350",
				success: "#66bb6a",
			},
			light: {
				primary: "#0097a7",
				onPrimary: "#ffffff",
				onSurface: "#004d40",
				onSurfaceVariant: "#00695c",
				surface: "#e0f7fa",
				surfaceVariant: "#b2ebf2",
				outline: "#b2ebf2",
				outlineVariant: "#e0f7fa",
				overlay: "rgba(0, 151, 167, 0.06)",
				overlayHover: "rgba(0, 151, 167, 0.1)",
				error: "#ef5350",
				success: "#66bb6a",
			},
		},
	},

	forest: {
		meta: {
			name: "Forest",
			emoji: "🌲",
			group: "skin",
			animation: "leaves",
		},
		dark: {
			"primary-color": "#66bb6a",
			"primary-hover": "#4caf50",
			"secondary-color": "#a5d6a7",
			"danger-color": "#ef5350",
			"success-color": "#81c784",
			"bg-primary": "#0d1a0d",
			"bg-secondary": "#1a2e1a",
			"bg-tertiary": "#234223",
			"bg-card": "#234223",
			"bg-card-hover": "#2e562e",
			"text-primary": "#e8f5e9",
			"text-secondary": "#a5d6a7",
			"text-muted": "#66bb6a",
			"border-color": "#2e562e",
			"border-light": "#3a6b3a",
		},
		light: {
			"primary-color": "#388e3c",
			"primary-hover": "#2e7d32",
			"secondary-color": "#4caf50",
			"danger-color": "#ef5350",
			"success-color": "#66bb6a",
			"bg-primary": "#e8f5e9",
			"bg-secondary": "#ffffff",
			"bg-tertiary": "#c8e6c9",
			"bg-card": "#ffffff",
			"bg-card-hover": "#e8f5e9",
			"text-primary": "#1b5e20",
			"text-secondary": "#2e7d32",
			"text-muted": "#66bb6a",
			"border-color": "#c8e6c9",
			"border-light": "#e8f5e9",
		},
		content: {
			dark: {
				primary: "#66bb6a",
				onPrimary: "#000000",
				onSurface: "#e8f5e9",
				onSurfaceVariant: "#a5d6a7",
				surface: "#0d1a0d",
				surfaceVariant: "#1a2e1a",
				outline: "#2e562e",
				outlineVariant: "#3a6b3a",
				overlay: "rgba(102, 187, 106, 0.08)",
				overlayHover: "rgba(102, 187, 106, 0.12)",
				error: "#ef5350",
				success: "#81c784",
			},
			light: {
				primary: "#388e3c",
				onPrimary: "#ffffff",
				onSurface: "#1b5e20",
				onSurfaceVariant: "#2e7d32",
				surface: "#e8f5e9",
				surfaceVariant: "#c8e6c9",
				outline: "#c8e6c9",
				outlineVariant: "#e8f5e9",
				overlay: "rgba(56, 142, 60, 0.06)",
				overlayHover: "rgba(56, 142, 60, 0.1)",
				error: "#ef5350",
				success: "#66bb6a",
			},
		},
	},

	sunset: {
		meta: {
			name: "Sunset",
			emoji: "🌅",
			group: "skin",
			animation: "shimmer",
		},
		dark: {
			"primary-color": "#ff7043",
			"primary-hover": "#ff5722",
			"secondary-color": "#ffab91",
			"danger-color": "#ef5350",
			"success-color": "#66bb6a",
			"bg-primary": "#1a0f0a",
			"bg-secondary": "#2d1a0f",
			"bg-tertiary": "#3e2415",
			"bg-card": "#3e2415",
			"bg-card-hover": "#4f2f1b",
			"text-primary": "#fbe9e7",
			"text-secondary": "#ffab91",
			"text-muted": "#ff8a65",
			"border-color": "#4f2f1b",
			"border-light": "#5d3a22",
		},
		light: {
			"primary-color": "#e64a19",
			"primary-hover": "#bf360c",
			"secondary-color": "#ff5722",
			"danger-color": "#ef5350",
			"success-color": "#66bb6a",
			"bg-primary": "#fbe9e7",
			"bg-secondary": "#ffffff",
			"bg-tertiary": "#ffccbc",
			"bg-card": "#ffffff",
			"bg-card-hover": "#fbe9e7",
			"text-primary": "#bf360c",
			"text-secondary": "#d84315",
			"text-muted": "#ff8a65",
			"border-color": "#ffccbc",
			"border-light": "#fbe9e7",
		},
		content: {
			dark: {
				primary: "#ff7043",
				onPrimary: "#000000",
				onSurface: "#fbe9e7",
				onSurfaceVariant: "#ffab91",
				surface: "#1a0f0a",
				surfaceVariant: "#2d1a0f",
				outline: "#4f2f1b",
				outlineVariant: "#5d3a22",
				overlay: "rgba(255, 112, 67, 0.08)",
				overlayHover: "rgba(255, 112, 67, 0.12)",
				error: "#ef5350",
				success: "#66bb6a",
			},
			light: {
				primary: "#e64a19",
				onPrimary: "#ffffff",
				onSurface: "#bf360c",
				onSurfaceVariant: "#d84315",
				surface: "#fbe9e7",
				surfaceVariant: "#ffccbc",
				outline: "#ffccbc",
				outlineVariant: "#fbe9e7",
				overlay: "rgba(230, 74, 25, 0.06)",
				overlayHover: "rgba(230, 74, 25, 0.1)",
				error: "#ef5350",
				success: "#66bb6a",
			},
		},
	},

	"sepia-reader": {
		meta: {
			name: "Sepia Reader",
			emoji: "📜",
			group: "skin",
			animation: "none",
		},
		dark: {
			"primary-color": "#d4a574",
			"primary-hover": "#c4915e",
			"secondary-color": "#bfa882",
			"danger-color": "#e57373",
			"success-color": "#81c784",
			"bg-primary": "#1a150e",
			"bg-secondary": "#2a2118",
			"bg-tertiary": "#3a2e22",
			"bg-card": "#3a2e22",
			"bg-card-hover": "#4a3c2e",
			"text-primary": "#f5e6d3",
			"text-secondary": "#d4bfa0",
			"text-muted": "#a89070",
			"border-color": "#4a3c2e",
			"border-light": "#5a4a3a",
		},
		light: {
			"primary-color": "#8d6e63",
			"primary-hover": "#795548",
			"secondary-color": "#a1887f",
			"danger-color": "#e57373",
			"success-color": "#81c784",
			"bg-primary": "#faf0e6",
			"bg-secondary": "#fff8f0",
			"bg-tertiary": "#f0e0d0",
			"bg-card": "#fff8f0",
			"bg-card-hover": "#faf0e6",
			"text-primary": "#3e2723",
			"text-secondary": "#5d4037",
			"text-muted": "#8d6e63",
			"border-color": "#d7ccc8",
			"border-light": "#efebe9",
		},
		content: {
			dark: {
				primary: "#d4a574",
				onPrimary: "#000000",
				onSurface: "#f5e6d3",
				onSurfaceVariant: "#d4bfa0",
				surface: "#1a150e",
				surfaceVariant: "#2a2118",
				outline: "#4a3c2e",
				outlineVariant: "#5a4a3a",
				overlay: "rgba(212, 165, 116, 0.08)",
				overlayHover: "rgba(212, 165, 116, 0.12)",
				error: "#e57373",
				success: "#81c784",
			},
			light: {
				primary: "#8d6e63",
				onPrimary: "#ffffff",
				onSurface: "#3e2723",
				onSurfaceVariant: "#5d4037",
				surface: "#faf0e6",
				surfaceVariant: "#f0e0d0",
				outline: "#d7ccc8",
				outlineVariant: "#efebe9",
				overlay: "rgba(141, 110, 99, 0.06)",
				overlayHover: "rgba(141, 110, 99, 0.1)",
				error: "#e57373",
				success: "#81c784",
			},
		},
	},
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Convert hex colour to rgba string
 * @param {string} hex - 6-digit hex colour (e.g. "#bb86fc")
 * @param {number} alpha - Opacity (0-1)
 * @returns {string|null}
 */
/**
 * Adjust a hex color's brightness by adding `amount` to each RGB channel.
 * Positive amount = lighter, negative = darker. Clamps to [0, 255].
 * @param {string} hex - #rrggbb hex color
 * @param {number} amount - Amount to add per channel
 * @returns {string} Adjusted hex color
 */
function adjustHexBrightness(hex, amount) {
	if (!/^#([0-9A-Fa-f]{6})$/.test(hex || "")) return hex;
	const clamp = (v) => Math.max(0, Math.min(255, v));
	const r = clamp(parseInt(hex.slice(1, 3), 16) + amount);
	const g = clamp(parseInt(hex.slice(3, 5), 16) + amount);
	const b = clamp(parseInt(hex.slice(5, 7), 16) + amount);
	return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function hexToRgba(hex, alpha = 0.8) {
	if (!/^#([0-9A-Fa-f]{6})$/.test(hex || "")) return null;
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Resolve the effective mode ("dark" or "light") taking "auto" into account.
 * @param {string} mode - "dark", "light", or "auto"
 * @returns {"dark"|"light"}
 */
export function resolveMode(mode) {
	if (mode === "light") return "light";
	if (mode === "auto") {
		if (typeof window !== "undefined" && window.matchMedia) {
			return window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light";
		}
	}
	return "dark";
}

/**
 * Get the CSS palette for a given theme settings object.
 * Merges preset palette with any user overrides.
 *
 * @param {Object} theme - Stored themeSettings object
 * @returns {Object} CSS custom property map (key → value)
 */
export function getThemePalette(theme) {
	// `basePreset` is set when a custom preset is selected so that `preset`
	// can hold the custom ID (e.g. "custom-my-theme") while still resolving
	// to a real THEME_PRESETS entry for the palette base.
	const builtInKey = theme?.basePreset || theme?.preset || "material-dark";
	const preset = THEME_PRESETS[builtInKey] || THEME_PRESETS["material-dark"];
	const effectiveMode = resolveMode(theme?.mode || "dark");
	const palette = { ...(preset[effectiveMode] || preset.dark) };

	// Apply user overrides on top of preset
	if (theme?.accentPrimary) palette["primary-color"] = theme.accentPrimary;
	if (theme?.accentSecondary)
		palette["primary-hover"] = theme.accentSecondary;
	if (theme?.bgColor) {
		palette["bg-primary"] = theme.bgColor;
		// Auto-derive secondary/tertiary from bgColor if not explicitly set
		if (!theme?.bgSecondary) {
			palette["bg-secondary"] = adjustHexBrightness(theme.bgColor, 10);
			palette["bg-card"] = adjustHexBrightness(theme.bgColor, 20);
		}
		if (!theme?.bgTertiary) {
			palette["bg-tertiary"] = adjustHexBrightness(theme.bgColor, 20);
		}
	}
	if (theme?.bgSecondary) {
		palette["bg-secondary"] = theme.bgSecondary;
		palette["bg-card"] = theme.bgSecondary;
	}
	if (theme?.bgTertiary) {
		palette["bg-tertiary"] = theme.bgTertiary;
		palette["bg-card"] = theme.bgTertiary;
	}
	if (theme?.textColor) palette["text-primary"] = theme.textColor;

	return palette;
}

/**
 * Get content-level theme colors (for chunk banners, summary buttons, etc.)
 * These mirror the Material Design palette used in chunk-ui.js
 *
 * @param {Object} [theme] - Stored themeSettings; if omitted, reads from data-theme
 * @returns {Object} Color palette for content-script UI
 */
export function getContentThemeColors(theme) {
	const preset =
		THEME_PRESETS[theme?.preset] || THEME_PRESETS["material-dark"];
	const effectiveMode = resolveMode(theme?.mode || "dark");
	return {
		...(preset.content?.[effectiveMode] ||
			preset.content?.dark ||
			THEME_PRESETS["material-dark"].content.dark),
	};
}

// ─────────────────────────────────────────────────────────────
// Core: Apply theme to DOM
// ─────────────────────────────────────────────────────────────

/**
 * Apply theme settings to the document root.
 * Sets `data-theme` attribute and CSS custom properties.
 *
 * Works in any context: popup, library, library-settings, shelf-page.
 *
 * @param {Object} theme - Stored themeSettings object
 */
export function setThemeVariables(theme) {
	const root = document.documentElement;
	const effectiveMode = resolveMode(theme?.mode || "dark");
	const palette = getThemePalette(theme);

	// Set data-theme for CSS selectors
	if (effectiveMode === "light") {
		root.setAttribute("data-theme", "light");
	} else {
		root.removeAttribute("data-theme");
	}

	// Set data-theme-preset for CSS selectors if needed
	root.setAttribute("data-theme-preset", theme?.preset || "material-dark");

	// Apply palette as CSS custom properties
	Object.entries(palette).forEach(([key, value]) => {
		root.style.setProperty(`--${key}`, value);
	});

	// Derived variables for popup compatibility
	const primaryText = palette["text-primary"] || "#e5e7eb";
	const secondaryText =
		hexToRgba(primaryText, 0.78) ||
		palette["text-secondary"] ||
		primaryText;

	root.style.setProperty("--accent-primary", palette["primary-color"]);
	root.style.setProperty("--accent-secondary", palette["primary-hover"]);
	root.style.setProperty(
		"--container-bg",
		palette["bg-secondary"] || palette["bg-primary"],
	);
	root.style.setProperty("--text-primary", primaryText);
	root.style.setProperty("--text-secondary", secondaryText);
	root.style.setProperty(
		"--text-muted",
		palette["text-muted"] || secondaryText,
	);

	// Apply background animation
	const animation = theme?.bgAnimation || "none";
	document.body?.setAttribute("data-bg-animation", animation);
}

/**
 * Load theme from storage and apply it.
 * Safe to call from any page context that has `browser.storage`.
 *
 * @returns {Promise<Object>} The resolved theme settings
 */
export async function applyThemeFromStorage() {
	let theme = DEFAULT_THEME;
	try {
		if (typeof browser !== "undefined" && browser.storage?.local) {
			const result = await browser.storage.local.get("themeSettings");
			theme = result.themeSettings || DEFAULT_THEME;
		}
	} catch (_err) {
		// storage unavailable — use defaults
	}
	setThemeVariables(theme);
	return theme;
}

/**
 * Listen for theme changes in storage and auto-reapply.
 */
export function setupThemeListener() {
	if (typeof browser === "undefined" || !browser.storage?.onChanged) return;
	browser.storage.onChanged.addListener((changes, area) => {
		if (area !== "local" || !changes.themeSettings) return;
		setThemeVariables(changes.themeSettings.newValue || DEFAULT_THEME);
	});
}

/**
 * Get a flat list of all preset IDs and their display metadata.
 * Useful for rendering the preset selector dropdown.
 *
 * @returns {Array<{id: string, name: string, emoji: string, group: string}>}
 */
/**
 * Get a flat list of all preset IDs and their display metadata.
 * Includes user-saved custom presets when `customPresets` is provided.
 *
 * @param {Object} [customPresets] - Optional map of id → { name, emoji, palette }
 * @returns {Array<{id: string, name: string, emoji: string, group: string, custom?: boolean}>}
 */
export function getPresetList(customPresets = {}) {
	const builtIn = Object.entries(THEME_PRESETS).map(([id, preset]) => ({
		id,
		name: preset.meta.name,
		emoji: preset.meta.emoji,
		group: preset.meta.group,
		custom: false,
	}));
	const custom = Object.entries(customPresets || {}).map(([id, preset]) => ({
		id,
		name: preset.name || id,
		emoji: preset.emoji || "🎨",
		group: "custom",
		custom: true,
	}));
	return [...builtIn, ...custom];
}

// Default export for convenience
export default {
	DEFAULT_THEME,
	THEME_PRESETS,
	getThemePalette,
	getContentThemeColors,
	setThemeVariables,
	applyThemeFromStorage,
	setupThemeListener,
	getPresetList,
	resolveMode,
	hexToRgba,
};
