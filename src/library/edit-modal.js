/**
 * Inline Edit Modal Engine
 *
 * Provides a reusable, in-page edit modal for library novels.
 * Usage:
 *   import { openInlineEditModal } from "../../edit-modal.js";
 *   openInlineEditModal(novel, HandlerClass, { onSaved, showToast });
 *
 * The modal is injected into a container element with id="shelf-edit-modal"
 * (which must exist in the page's HTML).
 */

import {
	NovelLibrary,
	READING_STATUS,
	READING_STATUS_INFO,
} from "../../utils/novel-library.js";

const novelLibrary = new NovelLibrary();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Open the inline edit modal for a novel.
 *
 * @param {Object} novel          - The novel object from the library.
 * @param {Function} HandlerClass - The static handler class (NOT an instance).
 * @param {Object}  [opts]
 * @param {Function} [opts.onSaved]    - Called with the updated novel after save.
 * @param {Function} [opts.onClose]    - Called when the modal is dismissed.
 * @param {Function} [opts.showToast]  - Toast function `(msg, type)`.
 */
export function openInlineEditModal(novel, HandlerClass, opts = {}) {
	const {
		onSaved = () => {},
		onClose = () => {},
		showToast = () => {},
	} = opts;

	const container = document.getElementById("shelf-edit-modal");
	if (!container) {
		showToast("Edit modal container not found in page", "error");
		return;
	}

	const handlerFields =
		HandlerClass && typeof HandlerClass.getEditableFields === "function"
			? HandlerClass.getEditableFields()
			: [];

	container.innerHTML = buildModalHTML(novel, handlerFields);
	container.style.display = "flex";

	// Populate dynamic fields (tags, toggles) after DOM insertion
	populateHandlerFields(novel, handlerFields);

	// Wire close / backdrop
	const overlay = container.querySelector(".edit-modal-overlay");
	const closeBtn = container.querySelector(".edit-modal-close");

	const close = () => {
		container.innerHTML = "";
		container.style.display = "none";
		onClose();
	};

	closeBtn?.addEventListener("click", close);
	overlay?.addEventListener("click", (e) => {
		if (e.target === overlay) close();
	});

	// Wire save
	const form = container.querySelector("#edit-modal-form");
	form?.addEventListener("submit", async (e) => {
		e.preventDefault();
		await handleSave(novel, handlerFields, form, container, {
			onSaved,
			showToast,
			close,
		});
	});

	// Wire cancel
	const cancelBtn = container.querySelector(".edit-modal-cancel");
	cancelBtn?.addEventListener("click", close);
}

// ---------------------------------------------------------------------------
// HTML Builder
// ---------------------------------------------------------------------------

/**
 * Build the full modal HTML string.
 * @param {Object} novel
 * @param {Array}  handlerFields
 * @returns {string}
 */
function buildModalHTML(novel, handlerFields) {
	const coverHtml = novel.coverUrl
		? `<div class="edit-modal-cover">
			<img src="${escapeAttr(novel.coverUrl)}" alt="Cover" onerror="this.parentElement.style.display='none'" />
		</div>`
		: "";

	return `
		<div class="edit-modal-overlay" role="dialog" aria-modal="true" aria-label="Edit Novel">
			<div class="edit-modal-panel">
				<div class="edit-modal-header">
					<h2 class="edit-modal-title">Edit Novel</h2>
					<button class="edit-modal-close btn-icon" type="button" aria-label="Close">✕</button>
				</div>
				<div class="edit-modal-body">
					${coverHtml}
					<form id="edit-modal-form" autocomplete="off">
						<div class="edit-modal-section-label">Core Info</div>
						<div class="edit-modal-grid">
							${buildTextField("title", "Title", novel.title || "", true)}
							${buildTextField("author", "Author", novel.author || "")}
							${buildTextareaField("description", "Description", novel.description || "")}
							${buildTextField("coverUrl", "Cover URL", novel.coverUrl || "", false, "https://...")}
							${buildTextField("sourceUrl", "Novel URL", novel.sourceUrl || "", false, "https://...")}
						</div>

						<div class="edit-modal-section-label">Reading Progress</div>
						<div class="edit-modal-grid">
							${buildReadingStatusSelect(novel.readingStatus)}
							${buildNumberField("lastReadChapter", "Last Read Chapter", novel.lastReadChapter || 0, 0)}
							${buildNumberField("totalChapters", "Total Chapters", novel.totalChapters || 0, 0)}
						</div>

						${buildTagsSection("genres", "Genres", novel.genres || [])}
						${buildTagsSection("tags", "Tags", novel.tags || [])}

						${handlerFields.length > 0 ? buildHandlerFieldsHTML(handlerFields) : ""}

						<div class="edit-modal-actions">
							<button type="button" class="btn btn-secondary edit-modal-cancel">Cancel</button>
							<button type="submit" class="btn btn-primary">Save Changes</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	`;
}

/**
 * Build HTML for all handler-specific fields.
 * @param {Array} fields
 * @returns {string}
 */
function buildHandlerFieldsHTML(fields) {
	const rows = fields
		.map((field) => {
			switch (field.type) {
				case "number":
					return buildNumberField(
						`hf_${field.key}`,
						field.label,
						"",
						field.min ?? 0,
						field.max,
					);
				case "select":
					return buildSelectField(
						`hf_${field.key}`,
						field.label,
						field.options || [],
						"",
					);
				case "date":
					return buildDateField(`hf_${field.key}`, field.label, "");
				case "toggle":
					return buildToggleField(
						`hf_${field.key}`,
						field.label,
						false,
					);
				case "tags":
					return buildTagsSection(
						`hf_${field.key}`,
						field.label,
						[],
						field.placeholder,
					);
				default:
					return buildTextField(
						`hf_${field.key}`,
						field.label,
						"",
						false,
						field.placeholder,
					);
			}
		})
		.join("");

	return `
		<div class="edit-modal-section-label">Site-Specific Fields</div>
		<div class="edit-modal-grid">
			${rows}
		</div>
	`;
}

// ---------------------------------------------------------------------------
// Field Builders
// ---------------------------------------------------------------------------

function buildTextField(id, label, value, required = false, placeholder = "") {
	const req = required ? " required" : "";
	return `
		<label class="edit-field">
			<span class="edit-field-label">${escapeHtml(label)}</span>
			<input type="text" id="${id}" name="${id}" class="edit-input"
				value="${escapeAttr(value)}"
				placeholder="${escapeAttr(placeholder)}"${req} />
		</label>`;
}

function buildTextareaField(id, label, value) {
	return `
		<label class="edit-field edit-field-wide">
			<span class="edit-field-label">${escapeHtml(label)}</span>
			<textarea id="${id}" name="${id}" class="edit-input edit-textarea"
				rows="4">${escapeHtml(value)}</textarea>
		</label>`;
}

function buildNumberField(id, label, value, min = 0, max = undefined) {
	const minAttr = min !== undefined ? ` min="${min}"` : "";
	const maxAttr = max !== undefined ? ` max="${max}"` : "";
	return `
		<label class="edit-field">
			<span class="edit-field-label">${escapeHtml(label)}</span>
			<input type="number" id="${id}" name="${id}" class="edit-input"
				value="${escapeAttr(String(value ?? ""))}"${minAttr}${maxAttr} />
		</label>`;
}

function buildSelectField(id, label, options, currentValue) {
	const optionsHtml = options
		.map(
			(o) =>
				`<option value="${escapeAttr(o.value)}"${o.value === currentValue ? " selected" : ""}>${escapeHtml(o.label)}</option>`,
		)
		.join("");
	return `
		<label class="edit-field">
			<span class="edit-field-label">${escapeHtml(label)}</span>
			<select id="${id}" name="${id}" class="edit-input">${optionsHtml}</select>
		</label>`;
}

function buildReadingStatusSelect(currentStatus) {
	const options = Object.entries(READING_STATUS_INFO).map(
		([value, info]) => ({
			value,
			label: info.label,
		}),
	);
	return buildSelectField(
		"readingStatus",
		"Reading Status",
		options,
		currentStatus || READING_STATUS.PLAN_TO_READ,
	);
}

function buildDateField(id, label, value) {
	// Normalize various date formats to YYYY-MM-DD for the input
	let dateVal = "";
	if (value) {
		try {
			const d = new Date(value);
			if (!isNaN(d)) {
				dateVal = d.toISOString().slice(0, 10);
			}
		} catch (_) {
			// ignore
		}
	}
	return `
		<label class="edit-field">
			<span class="edit-field-label">${escapeHtml(label)}</span>
			<input type="date" id="${id}" name="${id}" class="edit-input" value="${dateVal}" />
		</label>`;
}

function buildToggleField(id, label, checked = false) {
	return `
		<label class="edit-field edit-field-toggle">
			<span class="edit-field-label">${escapeHtml(label)}</span>
			<label class="toggle-switch">
				<input type="checkbox" id="${id}" name="${id}" ${checked ? "checked" : ""} />
				<span class="toggle-slider"></span>
			</label>
		</label>`;
}

function buildTagsSection(id, label, initialTags = [], placeholder = "") {
	// The actual tag input is constructed via JS in populateHandlerFields
	const tagsJson = escapeAttr(JSON.stringify(initialTags));
	return `
		<div class="edit-field edit-field-wide edit-field-tags" data-field-id="${id}">
			<span class="edit-field-label">${escapeHtml(label)}</span>
			<div class="tags-container" id="tags-container-${id}">
				<!-- chips rendered by JS -->
			</div>
			<div class="tags-input-row">
				<input type="text" class="edit-input tags-input" id="tags-input-${id}"
					placeholder="${escapeAttr(placeholder || "Add tag…")}" />
				<button type="button" class="btn btn-secondary tags-add-btn" data-target="${id}">+</button>
			</div>
			<input type="hidden" id="${id}" name="${id}" value="${tagsJson}" />
		</div>`;
}

// ---------------------------------------------------------------------------
// Post-render population
// ---------------------------------------------------------------------------

/**
 * After the HTML is in the DOM, initialise tag & toggle fields from novel data.
 * @param {Object} novel
 * @param {Array}  handlerFields
 */
function populateHandlerFields(novel, handlerFields) {
	for (const field of handlerFields) {
		const domId = `hf_${field.key}`;
		const rawValue = getFieldValue(novel, field);

		if (field.type === "toggleField") {
			const el = document.getElementById(domId);
			if (el) el.checked = Boolean(rawValue);
		} else if (field.type === "tags") {
			const tagList = Array.isArray(rawValue) ? rawValue : [];
			renderTagChips(domId, tagList);
		} else if (field.type === "date") {
			const el = document.getElementById(domId);
			if (el && rawValue) {
				try {
					const d = new Date(rawValue);
					if (!isNaN(d)) el.value = d.toISOString().slice(0, 10);
				} catch (dateErr) {
					// ignore invalid date values
					console.debug("[EditModal] Invalid date:", dateErr.message);
				}
			}
		} else {
			const el = document.getElementById(domId);
			if (el != null && rawValue != null) {
				el.value = String(rawValue);
			}
		}
	}

	// Populate core genres / tags chip fields
	renderTagChips("genres", Array.isArray(novel.genres) ? novel.genres : []);
	renderTagChips("tags", Array.isArray(novel.tags) ? novel.tags : []);

	// Wire up all tag-add buttons
	wireTagInputs();
}

/**
 * Render chip elements for a tag-type field.
 * @param {string} fieldId
 * @param {Array<string|Array>} tags
 */
function renderTagChips(fieldId, tags) {
	const container = document.getElementById(`tags-container-${fieldId}`);
	const hidden = document.getElementById(fieldId);
	if (!container) return;

	// Flatten nested arrays (e.g., relationships [[a,b],[c,d]])
	const flatTags = tags.flatMap((t) => (Array.isArray(t) ? t : [String(t)]));
	container.innerHTML = flatTags
		.map(
			(tag, i) =>
				`<span class="tag-chip">
					${escapeHtml(tag)}
					<button type="button" class="tag-chip-remove" data-field="${fieldId}" data-index="${i}" aria-label="Remove ${escapeHtml(tag)}">×</button>
				</span>`,
		)
		.join("");

	// Update hidden value
	if (hidden) hidden.value = JSON.stringify(flatTags);

	// Wire chip remove buttons
	container.querySelectorAll(".tag-chip-remove").forEach((btn) => {
		btn.addEventListener("click", () => {
			const current = getTagsFromField(fieldId);
			const idx = parseInt(btn.dataset.index, 10);
			current.splice(idx, 1);
			renderTagChips(fieldId, current);
		});
	});
}

function wireTagInputs() {
	document.querySelectorAll(".tags-add-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const target = btn.dataset.target;
			const input = document.getElementById(`tags-input-${target}`);
			if (!input) return;
			const val = input.value.trim();
			if (!val) return;
			const current = getTagsFromField(target);
			current.push(val);
			renderTagChips(target, current);
			input.value = "";
			input.focus();
		});
	});

	// Also submit on Enter in tag inputs
	document.querySelectorAll(".tags-input").forEach((input) => {
		const fieldId = input.id.replace("tags-input-", "");
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				const val = input.value.trim();
				if (!val) return;
				const current = getTagsFromField(fieldId);
				current.push(val);
				renderTagChips(fieldId, current);
				input.value = "";
			}
		});
	});
}

function getTagsFromField(fieldId) {
	const hidden = document.getElementById(fieldId);
	if (!hidden) return [];
	try {
		const parsed = JSON.parse(hidden.value);
		return Array.isArray(parsed) ? parsed : [];
	} catch (_) {
		return [];
	}
}

// ---------------------------------------------------------------------------
// Save Logic
// ---------------------------------------------------------------------------

async function handleSave(novel, handlerFields, form, container, opts) {
	const { onSaved, showToast, close } = opts;
	const saveBtn = form.querySelector("[type=submit]");
	if (saveBtn) {
		saveBtn.disabled = true;
		saveBtn.textContent = "Saving…";
	}

	try {
		const updates = collectFormValues(novel, handlerFields, form);
		const updated = await novelLibrary.addOrUpdateNovel(updates, true);
		showToast("Novel updated!", "success");
		close();
		onSaved(updated || updates);
	} catch (err) {
		console.error("[EditModal] Save failed:", err);
		showToast("Failed to save changes", "error");
		if (saveBtn) {
			saveBtn.disabled = false;
			saveBtn.textContent = "Save Changes";
		}
	}
}

/**
 * Collect all form values into an update object compatible with addOrUpdateNovel.
 * @param {Object} novel
 * @param {Array}  handlerFields
 * @param {HTMLElement} form
 * @returns {Object}
 */
function collectFormValues(novel, handlerFields, form) {
	const get = (id) => {
		const el = form.querySelector(`#${id}`);
		return el ? el.value : undefined;
	};
	const getNum = (id) => {
		const v = get(id);
		return v !== "" && v !== undefined ? Number(v) : undefined;
	};
	const getBool = (id) => {
		const el = form.querySelector(`#${id}`);
		return el ? el.checked : false;
	};
	const getTags = (id) => {
		const el = form.querySelector(`#${id}`);
		if (!el) return undefined;
		try {
			return JSON.parse(el.value);
		} catch (_) {
			return [];
		}
	};

	// Core fields
	const updates = {
		...novel, // keep all existing
		title: get("title") || novel.title,
		author: get("author") || novel.author,
		description: get("description") ?? novel.description,
		coverUrl: get("coverUrl") || novel.coverUrl,
		sourceUrl: get("sourceUrl") || novel.sourceUrl,
		readingStatus: get("readingStatus") || novel.readingStatus,
		lastReadChapter:
			getNum("lastReadChapter") ?? novel.lastReadChapter ?? 0,
		totalChapters: getNum("totalChapters") ?? novel.totalChapters ?? 0,
		genres: getTags("genres") ?? novel.genres ?? [],
		tags: getTags("tags") ?? novel.tags ?? [],
	};

	// Handler-specific fields → merged into updates.metadata
	const metadataUpdates = { ...(novel.metadata || {}) };
	for (const field of handlerFields) {
		const domId = `hf_${field.key}`;
		let value;
		switch (field.type) {
			case "number":
				value = getNum(domId);
				break;
			case "toggle":
				value = getBool(domId);
				break;
			case "tags":
				value = getTags(domId);
				break;
			default:
				value = get(domId);
				break;
		}
		if (value === undefined || value === null) continue;

		if (field.source === "top") {
			updates[field.key] = value;
		} else {
			// default: source === "metadata"
			metadataUpdates[field.key] = value;
		}
	}

	updates.metadata = metadataUpdates;
	return updates;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the current value of a handler field from the novel data.
 * @param {Object} novel
 * @param {Object} field
 * @returns {*}
 */
function getFieldValue(novel, field) {
	if (field.source === "top") {
		return novel[field.key];
	}
	return novel.metadata?.[field.key];
}

function escapeHtml(str) {
	return String(str ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttr(str) {
	return escapeHtml(str);
}
