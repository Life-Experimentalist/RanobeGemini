/**
 * Status Machine for Ranobe Gemini
 *
 * Provides a configurable rule engine that drives reading-status transitions.
 * Built-in rules replicate the original hardcoded behaviour and can be
 * toggled on/off without deleting them. Users can also create custom rules.
 *
 * Rule evaluation order: rules are sorted by `priority` (descending) and the
 * first matching rule wins for a given trigger.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Schema overview
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Rule shape:
 * {
 *   id          : string       - unique identifier
 *   name        : string       - human-readable name
 *   description : string       - longer description shown in UI
 *   builtIn     : boolean      - true → can be disabled but not deleted
 *   enabled     : boolean      - evaluated only when true
 *   trigger     : "chapterRead" | "inactivity"
 *   fromStatuses: string[]     - ["*"] = any status; otherwise list of keys
 *   excludeStatuses: string[]  - statuses always skipped by this rule
 *   toStatus    : string       - target status key
 *   priority    : number       - higher = evaluated first
 *   conditions  : {
 *     // inactivity trigger conditions
 *     inactivityDays?  : number  - min days of inactivity required
 *     chaptersReadMin? : number  - min chapters read (inclusive), null = skip
 *     chaptersReadMax? : number  - max chapters read (inclusive), null = skip
 *     // chapterRead trigger conditions
 *     requireLatestChapter? : boolean  - null = skip check
 *     requireStoryComplete? : boolean  - null = skip check
 *   }
 * }
 *
 * librarySettings.stateMachineRules stores saved overrides/additions.
 * Built-in rules are merged at runtime — only the mutable fields
 * (enabled, name, description, conditions, priority) are overrideable.
 *
 * librarySettings.customStatuses: Array of extra status objects:
 * { id, label, color, order }
 *
 * librarySettings.rereadingOverlay:
 * { enabled, label, color, autoClearOn: string[] }
 * ─────────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

/**
 * Canonical built-in status key strings.
 * Defined here (not imported) to avoid a circular dependency with novel-library.js.
 */
export const RS = {
	READING: "reading",
	UP_TO_DATE: "up-to-date",
	COMPLETED: "completed",
	PLAN_TO_READ: "plan-to-read",
	ON_HOLD: "on-hold",
	DROPPED: "dropped",
	RE_READING: "re-reading",
};

/** IDs for built-in rules. Used to detect/merge saved overrides. */
export const BUILTIN_RULE_IDS = {
	INACTIVITY_HOLD: "builtin-inactivity-hold",
	INACTIVITY_PLAN: "builtin-inactivity-plan",
	CHAPTER_COMPLETE: "builtin-chapter-complete",
	CHAPTER_UPTODATE: "builtin-chapter-uptodate",
	CHAPTER_FROM_UTD: "builtin-chapter-from-utd",
};

/** The six primary built-in status keys (RE_READING is overlay-only). */
export const BUILTIN_STATUS_KEYS = [
	RS.READING,
	RS.UP_TO_DATE,
	RS.COMPLETED,
	RS.PLAN_TO_READ,
	RS.ON_HOLD,
	RS.DROPPED,
	RS.RE_READING, // kept for backward compat; shown as overlay in UI
];

// ─────────────────────────────────────────────────────────────────────────
// Built-in rule definitions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns a fresh copy of the default built-in rules.
 * The inactivity rules intentionally leave `inactivityDays` as a
 * placeholder (0) — callers replace it with `settings.autoHoldDays`.
 *
 * @returns {Array<Object>}
 */
export function getBuiltInRules() {
	return [
		// ── Inactivity rules ──────────────────────────────────────────────
		{
			id: BUILTIN_RULE_IDS.INACTIVITY_HOLD,
			name: "Auto Hold on Inactivity",
			description:
				"Move to 'On Hold' if the novel hasn't been opened for the configured days and at least 2 chapters have been read.",
			builtIn: true,
			enabled: true,
			trigger: "inactivity",
			fromStatuses: [RS.READING],
			excludeStatuses: [],
			toStatus: RS.ON_HOLD,
			priority: 20,
			conditions: {
				inactivityDays: 0, // replaced at runtime from settings.autoHoldDays
				chaptersReadMin: 2,
				chaptersReadMax: null,
			},
		},
		{
			id: BUILTIN_RULE_IDS.INACTIVITY_PLAN,
			name: "Auto Plan-to-Read on Inactivity",
			description:
				"Move to 'Plan to Read' if the novel hasn't been opened for the configured days and 1 or fewer chapters have been read (effectively not started).",
			builtIn: true,
			enabled: true,
			trigger: "inactivity",
			fromStatuses: [RS.READING],
			excludeStatuses: [],
			toStatus: RS.PLAN_TO_READ,
			priority: 10,
			conditions: {
				inactivityDays: 0, // replaced at runtime
				chaptersReadMin: null,
				chaptersReadMax: 1,
			},
		},

		// ── Chapter-read rules ────────────────────────────────────────────
		{
			id: BUILTIN_RULE_IDS.CHAPTER_COMPLETE,
			name: "Complete When Caught Up on Finished Story",
			description:
				"Mark Completed when reading the latest chapter of a story the author has finished publishing.",
			builtIn: true,
			enabled: true,
			trigger: "chapterRead",
			fromStatuses: [RS.READING, RS.UP_TO_DATE],
			excludeStatuses: [RS.COMPLETED, RS.DROPPED],
			toStatus: RS.COMPLETED,
			priority: 30,
			conditions: {
				requireLatestChapter: true,
				requireStoryComplete: true,
			},
		},
		{
			id: BUILTIN_RULE_IDS.CHAPTER_UPTODATE,
			name: "Up to Date on Latest Chapter (Ongoing Story)",
			description:
				"Mark Up to Date when reading the latest chapter of an ongoing story.",
			builtIn: true,
			enabled: true,
			trigger: "chapterRead",
			fromStatuses: [RS.READING],
			excludeStatuses: [],
			toStatus: RS.UP_TO_DATE,
			priority: 20,
			conditions: {
				requireLatestChapter: true,
				requireStoryComplete: false,
			},
		},
		{
			id: BUILTIN_RULE_IDS.CHAPTER_FROM_UTD,
			name: "Back to Reading When Not at Latest Chapter",
			description:
				"Move from Up to Date back to Reading if the user reads an older chapter (e.g. after a new chapter is released).",
			builtIn: true,
			enabled: true,
			trigger: "chapterRead",
			fromStatuses: [RS.UP_TO_DATE],
			excludeStatuses: [],
			toStatus: RS.READING,
			priority: 10,
			conditions: {
				requireLatestChapter: false,
				requireStoryComplete: null,
			},
		},
	];
}

// ─────────────────────────────────────────────────────────────────────────
// Re-reading overlay defaults
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns the default re-reading overlay configuration.
 * @returns {Object}
 */
export function getDefaultRereadingOverlay() {
	return {
		enabled: true,
		label: "🔁 Re-reading",
		color: "#9c27b0",
		autoClearOn: [RS.DROPPED],
	};
}

// ─────────────────────────────────────────────────────────────────────────
// Rule merging
// ─────────────────────────────────────────────────────────────────────────

/**
 * Merge built-in rules with saved overrides and custom rules from settings.
 *
 * - Built-in rules always exist; saved overrides can modify mutable fields.
 * - Custom rules (from user) are appended after built-ins.
 * - Only these fields are overrideable on built-in rules:
 *   enabled, name, description, priority, conditions
 *
 * @param {Array<Object>} savedRules - array from librarySettings.stateMachineRules
 * @param {Object}        settings   - full librarySettings (for autoHoldDays etc.)
 * @returns {Array<Object>} Merged rule list, sorted by priority descending
 */
export function mergeRules(savedRules, settings = {}) {
	const autoHoldDays =
		typeof settings.autoHoldDays === "number" ? settings.autoHoldDays : 7;
	const autoHoldEnabled = settings.autoHoldEnabled !== false;

	const builtIns = getBuiltInRules().map((rule) => {
		// Patch inactivity conditions with runtime settings value
		if (rule.trigger === "inactivity") {
			rule = {
				...rule,
				conditions: {
					...rule.conditions,
					inactivityDays: autoHoldDays,
				},
			};
			// Honour legacy autoHoldEnabled flag for built-in inactivity rules
			if (!autoHoldEnabled) {
				rule = { ...rule, enabled: false };
			}
		}
		return rule;
	});

	const saved = Array.isArray(savedRules) ? savedRules : [];
	const OVERRIDEABLE = [
		"enabled",
		"name",
		"description",
		"priority",
		"conditions",
	];

	// Apply saved overrides to built-ins
	const merged = builtIns.map((builtIn) => {
		const override = saved.find((s) => s.id === builtIn.id);
		if (!override) return builtIn;
		const patch = {};
		for (const field of OVERRIDEABLE) {
			if (override[field] !== undefined) patch[field] = override[field];
		}
		return { ...builtIn, ...patch, builtIn: true };
	});

	// Append fully custom rules (those without a matching built-in ID)
	const builtInIds = new Set(builtIns.map((b) => b.id));
	const customRules = saved.filter((s) => !builtInIds.has(s.id));
	const result = [...merged, ...customRules];

	// Sort highest-priority first for evaluation
	result.sort((a, b) => (b.priority || 0) - (a.priority || 0));
	return result;
}

// ─────────────────────────────────────────────────────────────────────────
// Status registry helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Import lazily to avoid circular deps — call this where READING_STATUS_INFO is available.
 * Returns merged status list: [{ id, label, color, builtIn, order }, ...]
 *
 * @param {Object} settings          - full librarySettings
 * @param {Object} readingStatusInfo - READING_STATUS_INFO from novel-library.js
 * @returns {Array<Object>}
 */
export function getAllStatuses(settings = {}, readingStatusInfo = {}) {
	const statusConfig = settings.statusConfig || {};
	const custom = Array.isArray(settings.customStatuses)
		? settings.customStatuses
		: [];

	// Built-in statuses (ordered by preference)
	const ORDERED_BUILTIN = [
		RS.READING,
		RS.UP_TO_DATE,
		RS.COMPLETED,
		RS.PLAN_TO_READ,
		RS.ON_HOLD,
		RS.DROPPED,
		RS.RE_READING,
	];

	const builtins = ORDERED_BUILTIN.map((id, idx) => {
		const defaults = readingStatusInfo[id] || {
			label: id,
			color: "#666666",
		};
		const override = statusConfig[id] || {};
		return {
			id,
			label: override.label ?? defaults.label,
			color: override.color ?? defaults.color,
			builtIn: true,
			isRereadingOverlay: id === RS.RE_READING,
			order: idx,
		};
	});

	// Custom statuses
	const customList = custom.map((cs, idx) => ({
		id: cs.id,
		label: statusConfig[cs.id]?.label ?? cs.label,
		color: statusConfig[cs.id]?.color ?? cs.color,
		builtIn: false,
		isRereadingOverlay: false,
		order: typeof cs.order === "number" ? cs.order : 100 + idx,
	}));

	return [...builtins, ...customList].sort((a, b) => a.order - b.order);
}

// ─────────────────────────────────────────────────────────────────────────
// Condition matching helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Check whether a novel's current status matches the rule's fromStatuses /
 * excludeStatuses constraints.
 */
function matchesFromStatus(currentStatus, fromStatuses, excludeStatuses = []) {
	if (excludeStatuses.includes(currentStatus)) return false;
	if (fromStatuses.includes("*")) return true;
	return fromStatuses.includes(currentStatus);
}

/**
 * Evaluate conditions for a "chapterRead" trigger.
 *
 * @param {Object} conditions
 * @param {{ isLatestChapter: boolean, isStoryComplete: boolean }} context
 */
function matchesChapterReadConditions(conditions, context) {
	if (!conditions) return true;
	const { requireLatestChapter, requireStoryComplete } = conditions;
	const { isLatestChapter, isStoryComplete } = context;

	if (requireLatestChapter !== null && requireLatestChapter !== undefined) {
		if (Boolean(isLatestChapter) !== Boolean(requireLatestChapter))
			return false;
	}
	if (requireStoryComplete !== null && requireStoryComplete !== undefined) {
		if (Boolean(isStoryComplete) !== Boolean(requireStoryComplete))
			return false;
	}
	return true;
}

/**
 * Evaluate conditions for an "inactivity" trigger.
 *
 * @param {Object} conditions
 * @param {{ daysSinceLastAccess: number, chaptersRead: number }} context
 */
function matchesInactivityConditions(conditions, context) {
	if (!conditions) return true;
	const { inactivityDays, chaptersReadMin, chaptersReadMax } = conditions;
	const { daysSinceLastAccess, chaptersRead } = context;

	if (
		typeof inactivityDays === "number" &&
		daysSinceLastAccess < inactivityDays
	) {
		return false;
	}
	if (typeof chaptersReadMin === "number" && chaptersRead < chaptersReadMin) {
		return false;
	}
	if (typeof chaptersReadMax === "number" && chaptersRead > chaptersReadMax) {
		return false;
	}
	return true;
}

// ─────────────────────────────────────────────────────────────────────────
// Public evaluators
// ─────────────────────────────────────────────────────────────────────────

/**
 * Evaluate chapter-read transitions for a novel.
 *
 * @param {Object} novel   - novel record (readingStatus, rereadingStatus, …)
 * @param {{ isLatestChapter: boolean, isStoryComplete: boolean }} context
 * @param {Array<Object>} rules - merged rules (from mergeRules())
 * @returns {string|null} target status key, or null if no rule matched
 */
export function evaluateChapterReadTransitions(novel, context, rules) {
	const applicable = rules
		.filter((r) => r.enabled && r.trigger === "chapterRead")
		.filter((r) =>
			matchesFromStatus(
				novel.readingStatus,
				r.fromStatuses,
				r.excludeStatuses || [],
			),
		)
		.filter((r) => matchesChapterReadConditions(r.conditions, context));

	if (applicable.length === 0) return null;
	// Rules are already sorted high-priority first (from mergeRules)
	return applicable[0].toStatus;
}

/**
 * Evaluate inactivity transitions for a novel.
 *
 * @param {Object} novel   - novel record (readingStatus, lastAccessedAt, …)
 * @param {Array<Object>} rules - merged rules (from mergeRules())
 * @returns {string|null} target status key, or null if no rule matched
 */
export function evaluateInactivityTransitions(novel, rules) {
	const now = Date.now();
	const lastActivity =
		novel.lastAccessedAt || novel.lastUpdated || novel.addedAt || now;
	const daysSinceLastAccess = (now - lastActivity) / (24 * 60 * 60 * 1000);

	const lastReadChapter = novel.lastReadChapter || 0;
	const currentChapter =
		novel.currentChapter || novel.metadata?.currentChapter || 0;
	const chaptersRead = Math.max(lastReadChapter, currentChapter);

	const context = { daysSinceLastAccess, chaptersRead };

	const applicable = rules
		.filter((r) => r.enabled && r.trigger === "inactivity")
		.filter((r) =>
			matchesFromStatus(
				novel.readingStatus,
				r.fromStatuses,
				r.excludeStatuses || [],
			),
		)
		.filter((r) => matchesInactivityConditions(r.conditions, context));

	if (applicable.length === 0) return null;
	return applicable[0].toStatus;
}

/**
 * Apply re-reading overlay auto-clear logic:
 * If a novel's new status is in `rereadingOverlay.autoClearOn`, clear the flag.
 *
 * @param {Object} novel
 * @param {string} newStatus
 * @param {Object} rereadingOverlay - from librarySettings.rereadingOverlay
 * @returns {boolean} whether rereadingStatus was cleared
 */
export function applyRereadingAutoClear(novel, newStatus, rereadingOverlay) {
	if (!novel.rereadingStatus) return false;
	if (!rereadingOverlay?.enabled) return false;
	const autoClearOn = rereadingOverlay.autoClearOn || [];
	if (autoClearOn.includes(newStatus)) {
		novel.rereadingStatus = false;
		return true;
	}
	return false;
}

/**
 * Generate a short unique ID for custom rules / statuses.
 * (Not cryptographically secure, but fine for UI identifiers.)
 * @returns {string}
 */
export function generateId(prefix = "custom") {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
