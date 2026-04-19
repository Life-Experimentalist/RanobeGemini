/**
 * Collapsible Sections System
 * Handles fight scenes, R18 content, author notes, and user-defined custom sections
 * that can be collapsed/expanded in the enhanced chapter view.
 *
 * TTS / Read-Aloud integration:
 *   - Collapsed section  → reads the summary text only
 *   - Expanded section   → reads full content text (skips summary block)
 *
 * Gemini produces sections using:
 *   <div class="rg-collapsible-section" data-type="fight|r18|author-note|custom"
 *        data-summary="One-sentence summary" [data-name="Custom Label"]>
 *     ...full content HTML...
 *   </div>
 *
 * Long/off-topic author notes use a variant of the existing rg-author-note class:
 *   <div class="rg-author-note" data-collapse="true" data-summary="Story-relevant part">
 *     ...full note HTML...
 *   </div>
 */

// ─── Built-in type definitions ─────────────────────────────────────────────

export const BUILT_IN_SECTION_TYPES = {
	fight: {
		label: "Fight Scene",
		icon: "⚔️",
		description: "Combat / action sequence",
		color: "rgba(200,60,60,0.7)",
		bgColor: "rgba(60,15,15,0.85)",
		borderColor: "rgba(200,80,80,0.4)",
	},
	r18: {
		label: "Mature Content",
		icon: "🔞",
		description: "Adult / explicit content",
		color: "rgba(180,100,200,0.8)",
		bgColor: "rgba(40,15,55,0.9)",
		borderColor: "rgba(160,80,200,0.45)",
	},
	"author-note": {
		label: "Author's Note",
		icon: "📝",
		description: "Author / translator / editor note",
		color: "rgba(220,175,70,0.85)",
		bgColor: "rgba(45,35,10,0.92)",
		borderColor: "rgba(200,155,50,0.55)",
	},
};

// ─── Default settings ───────────────────────────────────────────────────────

export const DEFAULT_CONTENT_FILTER_SETTINGS = {
	fight: { enabled: true, defaultCollapsed: true },
	r18: { enabled: true, defaultCollapsed: true },
	authorNote: { enabled: true, defaultCollapsed: true },
	/** @type {Array<{id:string, name:string, icon:string, enabled:boolean, defaultCollapsed:boolean}>} */
	custom: [],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve section type settings, mapping "author-note" → settings.authorNote.
 * Falls back to DEFAULT_CONTENT_FILTER_SETTINGS for unknown types.
 * @param {Object} settings
 * @param {string} type
 * @returns {{enabled:boolean, defaultCollapsed:boolean}}
 */
function resolveTypeSettings(settings, type) {
	const merged = { ...DEFAULT_CONTENT_FILTER_SETTINGS, ...settings };
	if (type === "author-note") {
		return {
			...DEFAULT_CONTENT_FILTER_SETTINGS.authorNote,
			...(merged.authorNote || {}),
		};
	}
	if (BUILT_IN_SECTION_TYPES[type]) {
		return {
			...(DEFAULT_CONTENT_FILTER_SETTINGS[type] || {
				enabled: false,
				defaultCollapsed: true,
			}),
			...(merged[type] || {}),
		};
	}
	// Custom type: look up in custom array by id
	const customEntry = (merged.custom || []).find((c) => c.id === type);
	if (customEntry) {
		return {
			enabled: customEntry.enabled !== false,
			defaultCollapsed: customEntry.defaultCollapsed !== false,
		};
	}
	return { enabled: false, defaultCollapsed: true };
}

/**
 * Resolve display metadata (label, icon, colors) for a type.
 * For custom types, checks the custom array and data-name attribute.
 */
function resolveTypeMeta(type, section, settings) {
	if (BUILT_IN_SECTION_TYPES[type]) {
		return BUILT_IN_SECTION_TYPES[type];
	}
	// Custom type
	const dataName = section ? section.getAttribute("data-name") : null;
	const merged = { ...DEFAULT_CONTENT_FILTER_SETTINGS, ...settings };
	const customEntry = (merged.custom || []).find(
		(c) => c.id === type || (dataName && c.name === dataName),
	);
	return {
		label: customEntry?.name || dataName || type,
		icon: customEntry?.icon || "📄",
		color: "rgba(120,180,255,0.8)",
		bgColor: "rgba(10,20,40,0.88)",
		borderColor: "rgba(80,130,220,0.45)",
	};
}

// ─── DOM builder ────────────────────────────────────────────────────────────

/**
 * Build a fully-wired collapsible wrapper element.
 * @param {string} type - Section type id
 * @param {string} summary - Plain-text summary (from data-summary attribute)
 * @param {string} innerHtml - Full inner HTML of the section
 * @param {boolean} startCollapsed - Initial collapsed state
 * @param {{label,icon,color,bgColor,borderColor}} meta - Type display metadata
 * @returns {HTMLElement}
 */
function buildCollapsibleWrapper(
	type,
	summary,
	innerHtml,
	startCollapsed,
	meta,
) {
	const wrapper = document.createElement("div");
	wrapper.className = `rg-collapsible-wrapper rg-collapsible-${type} ${startCollapsed ? "rg-collapsed" : "rg-expanded"}`;
	wrapper.setAttribute("data-rg-collapsible-type", type);

	// Header — always visible, aria-hidden so screen readers / TTS skip it (we expose content directly)
	const header = document.createElement("div");
	header.className = "rg-collapsible-header";
	header.setAttribute("aria-hidden", "true");
	header.style.cssText = [
		`background:${meta.bgColor}`,
		`border:1px solid ${meta.borderColor}`,
		`border-left:3px solid ${meta.color}`,
		"border-radius:6px",
		"padding:10px 14px",
		"margin:12px 0 0 0",
		"display:flex",
		"align-items:center",
		"gap:10px",
		"cursor:pointer",
		"user-select:none",
		"box-sizing:border-box",
		"flex-wrap:wrap",
	].join(";");

	const badge = document.createElement("span");
	badge.className = "rg-collapsible-badge";
	badge.style.cssText = `color:${meta.color};font-weight:700;font-size:12px;letter-spacing:0.6px;text-transform:uppercase;white-space:nowrap;flex-shrink:0;`;
	badge.textContent = `${meta.icon} ${meta.label}`;

	const inlineSummary = document.createElement("span");
	inlineSummary.className = "rg-collapsible-inline-summary";
	inlineSummary.style.cssText =
		"flex:1;font-size:13px;color:rgba(200,195,185,0.85);font-style:italic;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;";
	inlineSummary.title = summary;
	inlineSummary.textContent = summary;

	const toggleBtn = document.createElement("button");
	toggleBtn.className = "rg-collapsible-toggle-btn";
	toggleBtn.setAttribute("aria-hidden", "true");
	toggleBtn.style.cssText = [
		`background:${meta.bgColor}`,
		`color:${meta.color}`,
		`border:1px solid ${meta.borderColor}`,
		"border-radius:4px",
		"padding:3px 10px",
		"font-size:11px",
		"font-weight:600",
		"cursor:pointer",
		"white-space:nowrap",
		"flex-shrink:0",
	].join(";");
	toggleBtn.textContent = startCollapsed ? "▼ Read" : "▲ Collapse";

	header.appendChild(badge);
	header.appendChild(inlineSummary);
	header.appendChild(toggleBtn);

	// Summary block — visible only when collapsed.
	// For TTS, content.js reads this when the section is collapsed.
	const summaryBlock = document.createElement("div");
	summaryBlock.className = "rg-collapsible-summary-block";
	summaryBlock.style.cssText = [
		`background:${meta.bgColor}`,
		`border:1px solid ${meta.borderColor}`,
		`border-top:none`,
		"border-radius:0 0 6px 6px",
		"padding:10px 14px",
		"margin:0 0 12px 0",
		"font-size:13px",
		"font-style:italic",
		`color:rgba(200,195,185,0.8)`,
		"line-height:1.6",
		"display:" + (startCollapsed ? "block" : "none"),
	].join(";");
	summaryBlock.textContent = summary;

	// Content block — visible only when expanded.
	const contentBlock = document.createElement("div");
	contentBlock.className = "rg-collapsible-content";
	contentBlock.style.cssText =
		"margin:0 0 12px 0;display:" +
		(startCollapsed ? "none" : "block") +
		";";
	contentBlock.innerHTML = innerHtml;

	wrapper.appendChild(header);
	wrapper.appendChild(summaryBlock);
	wrapper.appendChild(contentBlock);

	// ── Toggle logic ──────────────────────────────────────────────────────

	function toggle() {
		const isCollapsed = wrapper.classList.contains("rg-collapsed");
		if (isCollapsed) {
			wrapper.classList.remove("rg-collapsed");
			wrapper.classList.add("rg-expanded");
			contentBlock.style.display = "block";
			summaryBlock.style.display = "none";
			toggleBtn.textContent = "▲ Collapse";
		} else {
			wrapper.classList.remove("rg-expanded");
			wrapper.classList.add("rg-collapsed");
			contentBlock.style.display = "none";
			summaryBlock.style.display = "block";
			toggleBtn.textContent = "▼ Read";
		}
	}

	header.addEventListener("click", toggle);

	return wrapper;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Process all collapsible section elements in a container and render them as
 * interactive collapse/expand widgets.
 *
 * Handles two element types:
 *   1. `.rg-collapsible-section[data-type]` — produced by Gemini for fight/R18/author-note/custom
 *   2. `.rg-author-note[data-collapse="true"]` — long/off-topic author notes flagged by Gemini
 *
 * @param {Element} container - DOM element containing rendered enhanced HTML
 * @param {Object} [settings={}] - contentFilterSettings from storage
 */
export function renderCollapsibleSections(container, settings = {}) {
	const mergedSettings = {
		...DEFAULT_CONTENT_FILTER_SETTINGS,
		...settings,
		// Merge nested objects
		fight: {
			...DEFAULT_CONTENT_FILTER_SETTINGS.fight,
			...(settings.fight || {}),
		},
		r18: {
			...DEFAULT_CONTENT_FILTER_SETTINGS.r18,
			...(settings.r18 || {}),
		},
		authorNote: {
			...DEFAULT_CONTENT_FILTER_SETTINGS.authorNote,
			...(settings.authorNote || {}),
		},
		custom: settings.custom || DEFAULT_CONTENT_FILTER_SETTINGS.custom,
	};

	// ── 1. Process .rg-collapsible-section elements ──────────────────────
	const sections = Array.from(
		container.querySelectorAll(".rg-collapsible-section"),
	);
	for (const section of sections) {
		const type = section.getAttribute("data-type") || "custom";
		const summary = section.getAttribute("data-summary") || "";
		const innerHtml = section.innerHTML;

		const typeSettings = resolveTypeSettings(mergedSettings, type);
		if (!typeSettings.enabled) {
			// Disabled: unwrap content inline
			const frag = document.createDocumentFragment();
			const temp = document.createElement("div");
			temp.innerHTML = innerHtml;
			while (temp.firstChild) frag.appendChild(temp.firstChild);
			section.replaceWith(frag);
			continue;
		}

		const meta = resolveTypeMeta(type, section, mergedSettings);

		// data-collapse attribute on the section overrides the global default
		const collapseAttr = section.getAttribute("data-collapse");
		const startCollapsed =
			collapseAttr !== null
				? collapseAttr !== "false"
				: typeSettings.defaultCollapsed;

		const wrapper = buildCollapsibleWrapper(
			type,
			summary,
			innerHtml,
			startCollapsed,
			meta,
		);
		section.replaceWith(wrapper);
	}

	// ── 2. Process long/off-topic rg-author-note elements ────────────────
	const authorNoteSettings = resolveTypeSettings(
		mergedSettings,
		"author-note",
	);
	if (authorNoteSettings.enabled) {
		const longNotes = Array.from(
			container.querySelectorAll(".rg-author-note[data-collapse='true']"),
		);
		for (const note of longNotes) {
			const summary =
				note.getAttribute("data-summary") ||
				"Author's note (long/off-topic)";
			const innerHtml = note.innerHTML;
			const startCollapsed = authorNoteSettings.defaultCollapsed;
			const meta = BUILT_IN_SECTION_TYPES["author-note"];
			const wrapper = buildCollapsibleWrapper(
				"author-note",
				summary,
				innerHtml,
				startCollapsed,
				meta,
			);
			note.replaceWith(wrapper);
		}
	}
}

/**
 * Extract plain text suitable for TTS / read-aloud, honoring collapsed/expanded state.
 *
 * Rules:
 *   - Collapsed `.rg-collapsible-wrapper` → reads the `.rg-collapsible-summary-block` text
 *   - Expanded  `.rg-collapsible-wrapper` → reads the `.rg-collapsible-content` text
 *   - `[aria-hidden="true"]` elements      → skipped entirely
 *   - Everything else                      → read normally
 *
 * @param {Element} container
 * @returns {string} Plain text for TTS
 */
export function getReadAloudText(container) {
	const parts = [];

	function traverse(node) {
		if (node.nodeType === Node.TEXT_NODE) {
			const t = node.textContent.trim();
			if (t) parts.push(t);
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return;

		// Skip TTS-irrelevant UI chrome
		if (node.getAttribute("aria-hidden") === "true") return;

		if (node.classList.contains("rg-collapsible-wrapper")) {
			if (node.classList.contains("rg-collapsed")) {
				const sb = node.querySelector(".rg-collapsible-summary-block");
				if (sb) {
					const t = sb.textContent.trim();
					if (t) parts.push(t);
				}
			} else {
				const cb = node.querySelector(".rg-collapsible-content");
				if (cb) {
					const t = cb.textContent.trim();
					if (t) parts.push(t);
				}
			}
			return;
		}

		// Skip summary blocks outside a wrapper (shouldn't happen, but guard)
		if (node.classList.contains("rg-collapsible-summary-block")) return;

		for (const child of node.childNodes) {
			traverse(child);
		}
	}

	traverse(container);
	return parts
		.join(" ")
		.replace(/\s{2,}/g, " ")
		.trim();
}

/**
 * Build a plain-text summary of custom types that can be appended to the Gemini
 * permanent prompt so the model knows how to tag user-defined section types.
 *
 * @param {Array<{id:string, name:string}>} customTypes
 * @returns {string}
 */
export function buildCustomTypesPromptFragment(customTypes = []) {
	if (!customTypes.length) return "";
	const lines = customTypes.map(
		(ct) =>
			`   - ${ct.name}: <div class="rg-collapsible-section" data-type="${ct.id}" data-name="${ct.name}" data-summary="Brief summary">...</div>`,
	);
	return (
		"\n\n## User-Defined Collapsible Sections\n" +
		"Additionally, wrap the following content types in collapsible sections:\n" +
		lines.join("\n")
	);
}
