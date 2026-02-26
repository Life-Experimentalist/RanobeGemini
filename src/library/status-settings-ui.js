/**
 * Status Settings UI — Ranobe Gemini
 *
 * Renders a configurable panel inside the library settings modal with
 * four sub-sections:
 *
 *  1. Status Appearance    — label & colour for every status
 *  2. Custom Statuses      — add / delete user-defined statuses
 *  3. Re-reading Overlay   — configure the re-reading checkbox feature
 *  4. Transition Rules     — enable / disable / edit / add state-machine rules
 *
 * Called from library.js:
 *   import { initStatusSettingsTab, applyStatusConfig } from "./status-settings-ui.js";
 *   initStatusSettingsTab(getSettings, saveSettings);
 *   applyStatusConfig(librarySettings.statusConfig);
 */

import {
	READING_STATUS,
	READING_STATUS_INFO,
	novelLibrary,
} from "../utils/novel-library.js";
import {
	generateId,
	BUILTIN_RULE_IDS,
	getBuiltInRules,
	mergeRules,
	getAllStatuses,
	getDefaultRereadingOverlay,
} from "./status-machine.js";

// ─────────────────────────────────────────────────────────────────────────
// Public: apply saved status config to in-memory READING_STATUS_INFO
// ─────────────────────────────────────────────────────────────────────────

/**
 * Apply a saved statusConfig onto the in-memory READING_STATUS_INFO map
 * so that labels + colours take effect immediately across the UI.
 * @param {Object} statusConfig – map of statusKey → { label, color }
 */
export function applyStatusConfig(statusConfig = {}) {
	if (!statusConfig) return;
	for (const [key, cfg] of Object.entries(statusConfig)) {
		if (READING_STATUS_INFO[key]) {
			if (cfg.label) READING_STATUS_INFO[key].label = cfg.label;
			if (cfg.color) READING_STATUS_INFO[key].color = cfg.color;
		}
	}
}

/**
 * Merge saved statusConfig with built-in defaults.
 * @param {Object} saved
 * @returns {Object} full map of statusKey → { label, color }
 */
export function mergeStatusConfig(saved = {}) {
	const merged = {};
	for (const [key, def] of Object.entries(READING_STATUS_INFO)) {
		merged[key] = {
			label: saved[key]?.label ?? def.label,
			color: saved[key]?.color ?? def.color,
		};
	}
	return merged;
}

// ─────────────────────────────────────────────────────────────────────────
// High-level init (entry point from library.js)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Initialise the status settings tab inside #status-settings.
 * Re-renders whenever the tab container becomes visible.
 * @param {Function} getSettings  – () => librarySettings (sync)
 * @param {Function} saveSettings – async (patch) => void
 */
export function initStatusSettingsTab(getSettings, saveSettings) {
	const container = document.getElementById("status-settings");
	if (!container) return;

	renderStatusSettingsTab(container, getSettings, saveSettings);
	_refreshAllCounts(container);

	const observer = new MutationObserver(() => {
		if (container.offsetParent !== null) {
			renderStatusSettingsTab(container, getSettings, saveSettings);
			_refreshAllCounts(container);
			observer.disconnect();
		}
	});
	const modalBody = container.closest(".modal-body") || document.body;
	observer.observe(modalBody, { attributes: true, subtree: true });
}

// ─────────────────────────────────────────────────────────────────────────
// Main render
// ─────────────────────────────────────────────────────────────────────────

/**
 * Render all four sections into the container element.
 * @param {HTMLElement} container
 * @param {Function} getSettings
 * @param {Function} saveSettings
 */
export function renderStatusSettingsTab(container, getSettings, saveSettings) {
	if (!container) return;

	const settings = getSettings() || {};
	const statuses = getAllStatuses(settings, READING_STATUS_INFO);
	const rereadingOverlay = {
		...getDefaultRereadingOverlay(),
		...(settings.rereadingOverlay || {}),
	};
	const rules = mergeRules(settings.stateMachineRules, settings);
	const allStatusIds = statuses.map((s) => s.id);

	container.innerHTML = `
		<div class="status-settings-root" style="display:flex;flex-direction:column;gap:18px;">
		<div style="display:flex;justify-content:flex-end;gap:8px;padding-top:4px;">
		<button id="ssu-save-all-btn" class="btn btn-primary" style="font-size:13px;padding:7px 18px;">
			💾 Save All Settings
		</button>
		</div>
			${_renderAppearanceSection(statuses)}
			${_renderCustomStatusSection(settings.customStatuses || [])}
			${_renderRereadingOverlaySection(rereadingOverlay, statuses)}
			${_renderRulesSection(rules, allStatusIds)}

			<p id="ssu-feedback" style="text-align:right;font-size:11px;color:#22c55e;display:none;margin:0;"></p>
		</div>`;

	_wireAll(container, getSettings, saveSettings, statuses);
}

// ─────────────────────────────────────────────────────────────────────────
// Section renderers
// ─────────────────────────────────────────────────────────────────────────

function _renderAppearanceSection(statuses) {
	const rows = statuses
		.filter((s) => !s.isRereadingOverlay)
		.map(
			(s) => `
		<div class="ssu-status-row" data-status-id="${s.id}"
			style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-color,#2d3748);">
			<span class="ssu-preview-badge" data-preview="${s.id}"
				style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;
					white-space:nowrap;min-width:110px;text-align:center;
					background:${s.color}22;color:${s.color};border:1px solid ${s.color}55;"
			>${s.label}</span>
			<span class="ssu-count-badge" data-count-id="${s.id}"
				title="Novels with this status"
				style="display:inline-block;min-width:26px;padding:2px 7px;border-radius:10px;font-size:10px;
					font-weight:600;text-align:center;background:var(--bg-tertiary,#1f2937);
					color:var(--text-secondary,#9ca3af);border:1px solid var(--border-color,#374151);"
			>…</span>
			<input type="text" class="ssu-label-input" data-sid="${s.id}"
				value="${_esc(s.label)}"
				style="flex:1;padding:5px 8px;border-radius:4px;border:1px solid var(--border-color,#374151);
					background:var(--bg-tertiary,#1f2937);color:var(--text-primary,#e5e7eb);font-size:12px;"
			/>
			<div style="display:flex;align-items:center;gap:4px;">
				<input type="color" class="ssu-color-picker" data-sid="${s.id}" value="${s.color}"
					style="width:34px;height:28px;border:none;border-radius:4px;cursor:pointer;background:none;"
				/>
				<input type="text" class="ssu-color-text" data-sid="${s.id}" value="${s.color}" maxlength="7"
					style="width:76px;padding:5px 6px;border-radius:4px;border:1px solid var(--border-color,#374151);
						background:var(--bg-tertiary,#1f2937);color:var(--text-primary,#e5e7eb);font-size:11px;"
				/>
			</div>
			${
				!s.builtIn
					? `<button class="ssu-delete-status-btn btn btn-secondary" data-sid="${s.id}"
					title="Delete custom status" style="font-size:11px;padding:4px 8px;flex-shrink:0;color:#f87171;">✕</button>`
					: `<button class="ssu-reset-btn btn btn-secondary" data-sid="${s.id}"
					title="Reset to default" style="font-size:11px;padding:4px 8px;flex-shrink:0;">↩</button>`
			}
		</div>`,
		)
		.join("");

	return `
	<div class="ssu-section" style="background:var(--bg-secondary,#1e293b);padding:16px;border-radius:8px;border-left:3px solid #a855f7;">
		<h3 style="margin:0 0 6px;font-size:15px;font-weight:600;color:#a855f7;">📋 Status Appearance</h3>
		<p style="margin:0 0 12px;font-size:12px;color:var(--text-secondary,#9ca3af);">
			Customise the label and badge colour for every reading status.
		</p>
		<div id="ssu-appearance-rows">${rows}</div>
	</div>`;
}

function _renderCustomStatusSection(customStatuses) {
	const list =
		customStatuses.length === 0
			? `<p style="font-size:12px;color:var(--text-secondary);font-style:italic;">No custom statuses yet.</p>`
			: customStatuses
					.map(
						(cs) => `
			<div class="ssu-custom-row" data-csid="${cs.id}"
				style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border-color,#2d3748);">
				<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;
					background:${cs.color}22;color:${cs.color};border:1px solid ${cs.color}55;min-width:90px;text-align:center;"
				>${_esc(cs.label)}</span>
				<span style="flex:1;font-size:12px;color:var(--text-secondary);">${_esc(cs.id)}</span>
				<button class="ssu-delete-custom-btn btn btn-secondary" data-csid="${cs.id}"
					title="Delete this custom status"
					style="font-size:11px;padding:4px 10px;color:#f87171;">✕ Delete</button>
			</div>`,
					)
					.join("");

	return `
	<div class="ssu-section" style="background:var(--bg-secondary,#1e293b);padding:16px;border-radius:8px;border-left:3px solid #06b6d4;">
		<h3 style="margin:0 0 6px;font-size:15px;font-weight:600;color:#06b6d4;">✨ Custom Statuses</h3>
		<p style="margin:0 0 12px;font-size:12px;color:var(--text-secondary,#9ca3af);">
			Add your own statuses (e.g. "Stalled", "Waiting for Translation"). They appear in filters and can be
			used in transition rules. Deleting a custom status keeps the novels' data intact.
		</p>
		<div id="ssu-custom-list" style="display:flex;flex-direction:column;gap:4px;">${list}</div>
		<div style="display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border-color,#374151);">
			<input type="text" id="ssu-new-status-label" placeholder="Label, e.g. Stalled"
				style="flex:1;padding:6px 10px;border-radius:4px;border:1px solid var(--border-color,#374151);
					background:var(--bg-tertiary,#1f2937);color:var(--text-primary,#e5e7eb);font-size:12px;"
			/>
			<input type="color" id="ssu-new-status-color" value="#60a5fa"
				style="width:36px;height:32px;border:none;border-radius:4px;cursor:pointer;"
			/>
			<button id="ssu-add-custom-btn" class="btn btn-primary" style="font-size:12px;padding:6px 12px;">
				+ Add Status
			</button>
		</div>
	</div>`;
}

function _renderRereadingOverlaySection(overlay, statuses) {
	const autoClearOptions = statuses
		.filter((s) => !s.isRereadingOverlay)
		.map(
			(s) =>
				`<option value="${s.id}" ${(overlay.autoClearOn || []).includes(s.id) ? "selected" : ""}>${_esc(s.label)}</option>`,
		)
		.join("");

	return `
	<div class="ssu-section" style="background:var(--bg-secondary,#1e293b);padding:16px;border-radius:8px;border-left:3px solid #9c27b0;">
		<h3 style="margin:0 0 6px;font-size:15px;font-weight:600;color:#9c27b0;">🔁 Re-reading Overlay</h3>
		<p style="margin:0 0 12px;font-size:12px;color:var(--text-secondary,#9ca3af);">
			Re-reading is a <em>checkbox overlay</em> that sits on top of any primary status — a novel can be
			"On Hold" <em>and</em> re-reading at the same time. Toggle it on any novel card.
		</p>
		<div style="display:flex;flex-direction:column;gap:10px;">
			<label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;">
				<input type="checkbox" id="ssu-rereading-enabled" ${overlay.enabled ? "checked" : ""}
					style="width:16px;height:16px;accent-color:#9c27b0;"
				/>
				Enable Re-reading overlay feature
			</label>
			<div style="display:flex;align-items:center;gap:10px;">
				<span style="font-size:12px;color:var(--text-secondary);min-width:60px;">Label</span>
				<input type="text" id="ssu-rereading-label" value="${_esc(overlay.label)}"
					style="flex:1;padding:5px 8px;border-radius:4px;border:1px solid var(--border-color,#374151);
						background:var(--bg-tertiary,#1f2937);color:var(--text-primary,#e5e7eb);font-size:12px;"
				/>
			</div>
			<div style="display:flex;align-items:center;gap:10px;">
				<span style="font-size:12px;color:var(--text-secondary);min-width:60px;">Colour</span>
				<input type="color" id="ssu-rereading-color" value="${overlay.color}"
					style="width:36px;height:28px;border:none;border-radius:4px;cursor:pointer;"
				/>
				<input type="text" id="ssu-rereading-color-text" value="${overlay.color}" maxlength="7"
					style="width:80px;padding:5px 6px;border-radius:4px;border:1px solid var(--border-color,#374151);
						background:var(--bg-tertiary,#1f2937);color:var(--text-primary,#e5e7eb);font-size:11px;"
				/>
			</div>
			<div style="display:flex;align-items:flex-start;gap:10px;">
				<span style="font-size:12px;color:var(--text-secondary);min-width:60px;padding-top:4px;">Auto-clear on</span>
				<div style="flex:1;">
					<select id="ssu-rereading-autoclear" multiple size="4"
						style="width:100%;padding:4px;border-radius:4px;border:1px solid var(--border-color,#374151);
							background:var(--bg-tertiary,#1f2937);color:var(--text-primary,#e5e7eb);font-size:12px;">
						${autoClearOptions}
					</select>
					<p style="font-size:10px;color:var(--text-secondary);margin:4px 0 0;">
						Ctrl/Cmd+click to select multiple. When a novel moves to a selected
						status the re-reading flag is automatically cleared.
					</p>
				</div>
			</div>
		</div>
	</div>`;
}

function _renderRulesSection(rules, allStatusIds) {
	const ruleRows = rules
		.map((rule) => _renderRuleRow(rule, allStatusIds))
		.join("");

	return `
	<div class="ssu-section" style="background:var(--bg-secondary,#1e293b);padding:16px;border-radius:8px;border-left:3px solid #22c55e;">
		<h3 style="margin:0 0 6px;font-size:15px;font-weight:600;color:#22c55e;">⚙️ Transition Rules</h3>
		<p style="margin:0 0 12px;font-size:12px;color:var(--text-secondary,#9ca3af);">
			Rules control how a novel's status changes automatically. Higher priority = evaluated first.
			Built-in rules 🔒 can be disabled but not deleted. Ctrl+click for multiple "From" selections.
		</p>
		<div id="ssu-rules-list">${ruleRows}</div>
		<button id="ssu-add-rule-btn" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;margin-top:4px;">
			+ Add Custom Rule
		</button>
	</div>`;
}

function _renderRuleRow(rule, allStatusIds) {
	const conditions = _renderConditions(rule);
	const fromOptions = allStatusIds
		.concat(["*"])
		.map(
			(id) =>
				`<option value="${id}" ${(rule.fromStatuses || []).includes(id) ? "selected" : ""}>${
					id === "*" ? "Any (*)" : id
				}</option>`,
		)
		.join("");
	const toOptions = allStatusIds
		.map(
			(id) =>
				`<option value="${id}" ${rule.toStatus === id ? "selected" : ""}>${id}</option>`,
		)
		.join("");

	return `
	<div class="ssu-rule-row" data-rule-id="${rule.id}"
		style="background:var(--bg-tertiary,#1f2937);border-radius:6px;padding:10px;
			border:1px solid var(--border-color,#374151);margin-bottom:8px;">
		<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
			<input type="checkbox" class="ssu-rule-enabled" data-rule-id="${rule.id}" ${rule.enabled ? "checked" : ""}
				style="width:15px;height:15px;accent-color:#a855f7;flex-shrink:0;" title="Enable/disable rule"
			/>
			<input type="text" class="ssu-rule-name" data-rule-id="${rule.id}" value="${_esc(rule.name)}"
				style="flex:1;min-width:120px;padding:4px 8px;border-radius:4px;border:1px solid var(--border-color,#374151);
					background:var(--bg-secondary,#1e293b);color:var(--text-primary,#e5e7eb);font-size:13px;font-weight:600;"
			/>
			<select class="ssu-rule-trigger" data-rule-id="${rule.id}"
				style="padding:4px 8px;border-radius:4px;border:1px solid var(--border-color,#374151);
					background:var(--bg-secondary,#1e293b);color:var(--text-primary,#e5e7eb);font-size:12px;">
				<option value="chapterRead" ${rule.trigger === "chapterRead" ? "selected" : ""}>Chapter Read</option>
				<option value="inactivity" ${rule.trigger === "inactivity" ? "selected" : ""}>Inactivity</option>
			</select>
			<input type="number" class="ssu-rule-priority" data-rule-id="${rule.id}" value="${rule.priority || 10}" min="1" max="1000"
				title="Priority (higher = first)"
				style="width:60px;padding:4px 6px;border-radius:4px;border:1px solid var(--border-color,#374151);
					background:var(--bg-secondary,#1e293b);color:var(--text-primary,#e5e7eb);font-size:12px;"
			/>
			${
				rule.builtIn
					? `<span title="Built-in — cannot be deleted" style="font-size:18px;color:#9ca3af;">🔒</span>`
					: `<button class="ssu-delete-rule-btn btn btn-secondary" data-rule-id="${rule.id}"
						style="font-size:11px;padding:4px 8px;color:#f87171;flex-shrink:0;">✕</button>`
			}
		</div>
		<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;">
			<span style="color:var(--text-secondary);">From:</span>
			<select class="ssu-rule-from" data-rule-id="${rule.id}" multiple size="3"
				style="min-width:130px;padding:3px;border-radius:4px;border:1px solid var(--border-color,#374151);
					background:var(--bg-secondary,#1e293b);color:var(--text-primary,#e5e7eb);font-size:12px;">
				${fromOptions}
			</select>
			<span style="color:var(--text-secondary);">→ To:</span>
			<select class="ssu-rule-to" data-rule-id="${rule.id}"
				style="padding:4px 8px;border-radius:4px;border:1px solid var(--border-color,#374151);
					background:var(--bg-secondary,#1e293b);color:var(--text-primary,#e5e7eb);font-size:12px;">
				${toOptions}
			</select>
		</div>
		<div class="ssu-rule-conditions" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:12px;">
			${conditions}
		</div>
	</div>`;
}

function _renderConditions(rule) {
	if (rule.trigger === "inactivity") {
		const c = rule.conditions || {};
		return `
		<label style="display:flex;align-items:center;gap:6px;">
			Inactive ≥ <input type="number" class="ssu-cond-inactivityDays" data-rule-id="${rule.id}"
				value="${c.inactivityDays ?? 7}" min="1" max="365"
				style="width:55px;padding:3px 6px;border-radius:4px;border:1px solid var(--border-color,#374151);
					background:var(--bg-secondary,#1e293b);color:var(--text-primary,#e5e7eb);font-size:12px;"
			/> days
		</label>
		<label style="display:flex;align-items:center;gap:6px;">
			Chapters read ≥ <input type="number" class="ssu-cond-chaptersReadMin" data-rule-id="${rule.id}"
				value="${c.chaptersReadMin ?? ""}" min="0" placeholder="any"
				style="width:55px;padding:3px 6px;border-radius:4px;border:1px solid var(--border-color,#374151);
					background:var(--bg-secondary,#1e293b);color:var(--text-primary,#e5e7eb);font-size:12px;"
			/>
		</label>
		<label style="display:flex;align-items:center;gap:6px;">
			Chapters read ≤ <input type="number" class="ssu-cond-chaptersReadMax" data-rule-id="${rule.id}"
				value="${c.chaptersReadMax ?? ""}" min="0" placeholder="any"
				style="width:55px;padding:3px 6px;border-radius:4px;border:1px solid var(--border-color,#374151);
					background:var(--bg-secondary,#1e293b);color:var(--text-primary,#e5e7eb);font-size:12px;"
			/>
		</label>`;
	}

	if (rule.trigger === "chapterRead") {
		const c = rule.conditions || {};
		const latestVal =
			c.requireLatestChapter === true
				? "true"
				: c.requireLatestChapter === false
					? "false"
					: "any";
		const completeVal =
			c.requireStoryComplete === true
				? "true"
				: c.requireStoryComplete === false
					? "false"
					: "any";
		return `
		<label style="display:flex;align-items:center;gap:6px;">
			Latest chapter:
			<select class="ssu-cond-requireLatestChapter" data-rule-id="${rule.id}"
				style="padding:3px 6px;border-radius:4px;border:1px solid var(--border-color,#374151);
					background:var(--bg-secondary,#1e293b);color:var(--text-primary,#e5e7eb);font-size:12px;">
				<option value="any" ${latestVal === "any" ? "selected" : ""}>Any</option>
				<option value="true" ${latestVal === "true" ? "selected" : ""}>Yes (at latest)</option>
				<option value="false" ${latestVal === "false" ? "selected" : ""}>No (not at latest)</option>
			</select>
		</label>
		<label style="display:flex;align-items:center;gap:6px;">
			Story complete:
			<select class="ssu-cond-requireStoryComplete" data-rule-id="${rule.id}"
				style="padding:3px 6px;border-radius:4px;border:1px solid var(--border-color,#374151);
					background:var(--bg-secondary,#1e293b);color:var(--text-primary,#e5e7eb);font-size:12px;">
				<option value="any" ${completeVal === "any" ? "selected" : ""}>Any</option>
				<option value="true" ${completeVal === "true" ? "selected" : ""}>Yes (author done)</option>
				<option value="false" ${completeVal === "false" ? "selected" : ""}>No (ongoing)</option>
			</select>
		</label>`;
	}

	return "";
}

// ─────────────────────────────────────────────────────────────────────────
// Event wiring
// ─────────────────────────────────────────────────────────────────────────

function _wireAll(container, getSettings, saveSettings, statuses) {
	// ── Appearance: live badge preview ───────────────────────────────────
	container.querySelectorAll(".ssu-color-picker").forEach((picker) => {
		const sid = picker.dataset.sid;
		const tf = container.querySelector(
			`.ssu-color-text[data-sid="${sid}"]`,
		);
		picker.addEventListener("input", () => {
			if (tf) tf.value = picker.value;
			_refreshBadge(container, sid, null, picker.value);
		});
	});
	container.querySelectorAll(".ssu-color-text").forEach((tf) => {
		const sid = tf.dataset.sid;
		const picker = container.querySelector(
			`.ssu-color-picker[data-sid="${sid}"]`,
		);
		tf.addEventListener("input", () => {
			if (/^#[0-9a-fA-F]{6}$/.test(tf.value.trim())) {
				if (picker) picker.value = tf.value.trim();
				_refreshBadge(container, sid, null, tf.value.trim());
			}
		});
	});
	container.querySelectorAll(".ssu-label-input").forEach((inp) => {
		inp.addEventListener("input", () =>
			_refreshBadge(container, inp.dataset.sid, inp.value, null),
		);
	});
	// Per-row reset (built-in statuses)
	container.querySelectorAll(".ssu-reset-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const sid = btn.dataset.sid;
			const def = READING_STATUS_INFO[sid];
			if (!def) return;
			const li = container.querySelector(
				`.ssu-label-input[data-sid="${sid}"]`,
			);
			const cp = container.querySelector(
				`.ssu-color-picker[data-sid="${sid}"]`,
			);
			const ct = container.querySelector(
				`.ssu-color-text[data-sid="${sid}"]`,
			);
			if (li) li.value = def.label;
			if (cp) cp.value = def.color;
			if (ct) ct.value = def.color;
			_refreshBadge(container, sid, def.label, def.color);
		});
	});

	// ── Custom statuses ──────────────────────────────────────────────────
	const addCustomBtn = container.querySelector("#ssu-add-custom-btn");
	if (addCustomBtn) {
		addCustomBtn.addEventListener("click", async () => {
			const labelInput = container.querySelector("#ssu-new-status-label");
			const colorPicker = container.querySelector(
				"#ssu-new-status-color",
			);
			const label = (labelInput?.value || "").trim();
			if (!label) {
				labelInput?.focus();
				return;
			}
			const color = colorPicker?.value || "#60a5fa";
			const id = generateId("status");
			const settings = getSettings() || {};
			const custom = [
				...(settings.customStatuses || []),
				{
					id,
					label,
					color,
					order: 100 + (settings.customStatuses?.length || 0),
				},
			];
			await saveSettings({ customStatuses: custom });
			if (labelInput) labelInput.value = "";
			renderStatusSettingsTab(container, getSettings, saveSettings);
			_refreshAllCounts(container);
		});
	}

	container.querySelectorAll(".ssu-delete-custom-btn").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const csid = btn.dataset.csid;
			if (
				!confirm(
					`Delete custom status "${csid}"?\n\nNovels using this status will keep the status ID but it will no longer appear in filters until you reassign them.`,
				)
			)
				return;
			const settings = getSettings() || {};
			const custom = (settings.customStatuses || []).filter(
				(cs) => cs.id !== csid,
			);
			await saveSettings({ customStatuses: custom });
			renderStatusSettingsTab(container, getSettings, saveSettings);
			_refreshAllCounts(container);
		});
	});

	// ── Re-reading overlay colour sync ───────────────────────────────────
	const rrCP = container.querySelector("#ssu-rereading-color");
	const rrCT = container.querySelector("#ssu-rereading-color-text");
	if (rrCP && rrCT) {
		rrCP.addEventListener("input", () => {
			rrCT.value = rrCP.value;
		});
		rrCT.addEventListener("input", () => {
			if (/^#[0-9a-fA-F]{6}$/.test(rrCT.value.trim()))
				rrCP.value = rrCT.value.trim();
		});
	}

	// ── Rules: add custom rule ───────────────────────────────────────────
	const addRuleBtn = container.querySelector("#ssu-add-rule-btn");
	if (addRuleBtn) {
		addRuleBtn.addEventListener("click", async () => {
			const settings = getSettings() || {};
			const allStatuses = getAllStatuses(settings, READING_STATUS_INFO);
			const newRule = {
				id: generateId("rule"),
				name: "New Rule",
				description: "",
				builtIn: false,
				enabled: true,
				trigger: "chapterRead",
				fromStatuses: ["reading"],
				excludeStatuses: [],
				toStatus: allStatuses[0]?.id || "reading",
				priority: 10,
				conditions: {},
			};
			const savedRules = settings.stateMachineRules || [];
			await saveSettings({ stateMachineRules: [...savedRules, newRule] });
			renderStatusSettingsTab(container, getSettings, saveSettings);
		});
	}

	// Delete custom rule
	container.querySelectorAll(".ssu-delete-rule-btn").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const ruleId = btn.dataset.ruleId;
			if (!confirm(`Delete rule "${ruleId}"?`)) return;
			const settings = getSettings() || {};
			const savedRules = (settings.stateMachineRules || []).filter(
				(r) => r.id !== ruleId,
			);
			await saveSettings({ stateMachineRules: savedRules });
			renderStatusSettingsTab(container, getSettings, saveSettings);
		});
	});

	// ── Save All ─────────────────────────────────────────────────────────
	const saveAllBtn = container.querySelector("#ssu-save-all-btn");
	if (saveAllBtn) {
		saveAllBtn.addEventListener("click", () =>
			_handleSaveAll(container, getSettings, saveSettings, statuses),
		);
	}
}

// ─────────────────────────────────────────────────────────────────────────
// Save handler
// ─────────────────────────────────────────────────────────────────────────

async function _handleSaveAll(container, getSettings, saveSettings, statuses) {
	const feedback = container.querySelector("#ssu-feedback");
	try {
		const settings = getSettings() || {};

		// 1. Status appearance
		const statusConfig = { ...(settings.statusConfig || {}) };
		for (const s of statuses.filter((s) => !s.isRereadingOverlay)) {
			const li = container.querySelector(
				`.ssu-label-input[data-sid="${s.id}"]`,
			);
			const cp = container.querySelector(
				`.ssu-color-picker[data-sid="${s.id}"]`,
			);
			if (!li || !cp) continue;
			statusConfig[s.id] = {
				label: li.value.trim() || s.label,
				color: cp.value || s.color,
			};
		}

		// 2. Re-reading overlay
		const rrEnabled = container.querySelector("#ssu-rereading-enabled");
		const rrLabel = container.querySelector("#ssu-rereading-label");
		const rrColor = container.querySelector("#ssu-rereading-color");
		const rrAutoClear = container.querySelector("#ssu-rereading-autoclear");
		const rereadingOverlay = {
			...getDefaultRereadingOverlay(),
			...(settings.rereadingOverlay || {}),
			enabled: rrEnabled?.checked ?? true,
			label: rrLabel?.value?.trim() || "🔁 Re-reading",
			color: rrColor?.value || "#9c27b0",
			autoClearOn: rrAutoClear
				? Array.from(rrAutoClear.selectedOptions).map((o) => o.value)
				: [READING_STATUS.DROPPED],
		};

		// 3. Rules
		const builtInIds = new Set(Object.values(BUILTIN_RULE_IDS));
		const stateMachineRules = [];
		container.querySelectorAll(".ssu-rule-row").forEach((row) => {
			const ruleId = row.dataset.ruleId;
			const isBuiltIn = builtInIds.has(ruleId);
			const enabled =
				row.querySelector(".ssu-rule-enabled")?.checked ?? true;
			const name =
				row.querySelector(".ssu-rule-name")?.value?.trim() || ruleId;
			const trigger =
				row.querySelector(".ssu-rule-trigger")?.value || "chapterRead";
			const priority =
				parseInt(row.querySelector(".ssu-rule-priority")?.value, 10) ||
				10;
			const fromSel = row.querySelector(".ssu-rule-from");
			const fromStatuses = fromSel
				? Array.from(fromSel.selectedOptions).map((o) => o.value)
				: ["*"];
			const toStatus =
				row.querySelector(".ssu-rule-to")?.value || "reading";

			const conditions = {};
			if (trigger === "inactivity") {
				const days = row.querySelector(".ssu-cond-inactivityDays");
				const min = row.querySelector(".ssu-cond-chaptersReadMin");
				const max = row.querySelector(".ssu-cond-chaptersReadMax");
				if (days)
					conditions.inactivityDays = parseInt(days.value, 10) || 7;
				conditions.chaptersReadMin =
					min?.value !== "" ? parseInt(min.value, 10) : null;
				conditions.chaptersReadMax =
					max?.value !== "" ? parseInt(max.value, 10) : null;
			} else {
				const latestSel = row.querySelector(
					".ssu-cond-requireLatestChapter",
				);
				const completeSel = row.querySelector(
					".ssu-cond-requireStoryComplete",
				);
				const lv = latestSel?.value || "any";
				const cv = completeSel?.value || "any";
				conditions.requireLatestChapter =
					lv === "any" ? null : lv === "true";
				conditions.requireStoryComplete =
					cv === "any" ? null : cv === "true";
			}

			if (isBuiltIn) {
				stateMachineRules.push({
					id: ruleId,
					enabled,
					name,
					priority,
					conditions,
					builtIn: true,
				});
			} else {
				const orig = (settings.stateMachineRules || []).find(
					(r) => r.id === ruleId,
				);
				stateMachineRules.push({
					...(orig || {}),
					id: ruleId,
					name,
					enabled,
					trigger,
					fromStatuses,
					excludeStatuses: orig?.excludeStatuses || [],
					toStatus,
					priority,
					conditions,
					builtIn: false,
				});
			}
		});

		await saveSettings({
			statusConfig,
			rereadingOverlay,
			stateMachineRules,
		});
		applyStatusConfig(statusConfig);

		if (feedback) {
			feedback.textContent = "✓ All status settings saved.";
			feedback.style.color = "#22c55e";
			feedback.style.display = "block";
			setTimeout(() => {
				feedback.style.display = "none";
			}, 3000);
		}
	} catch (err) {
		if (feedback) {
			feedback.textContent = `⚠️ Failed to save: ${err.message}`;
			feedback.style.color = "#f87171";
			feedback.style.display = "block";
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────
// Count badge refresh
// ─────────────────────────────────────────────────────────────────────────

async function _refreshAllCounts(container) {
	if (!container) return;
	try {
		const stats = await novelLibrary.getReadingStatusStats();
		if (!stats?.byStatus) return;
		for (const [key, count] of Object.entries(stats.byStatus)) {
			const badge = container.querySelector(`[data-count-id="${key}"]`);
			if (badge) badge.textContent = String(count);
		}
	} catch (_) {
		// decorative — ignore
	}
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function _refreshBadge(container, sid, label, color) {
	const badge = container.querySelector(`[data-preview="${sid}"]`);
	if (!badge) return;
	const li = container.querySelector(`.ssu-label-input[data-sid="${sid}"]`);
	const cp = container.querySelector(`.ssu-color-picker[data-sid="${sid}"]`);
	const finalLabel = label ?? li?.value ?? badge.textContent;
	const finalColor = color ?? cp?.value ?? "#666";
	badge.textContent = finalLabel;
	badge.style.color = finalColor;
	badge.style.background = `${finalColor}22`;
	badge.style.borderColor = `${finalColor}55`;
}

function _esc(str) {
	return String(str ?? "")
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}
