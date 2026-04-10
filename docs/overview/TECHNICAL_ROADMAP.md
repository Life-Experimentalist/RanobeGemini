# Ranobe Gemini Technical Roadmap

This file is the authoritative technical roadmap for evolving Ranobe Gemini.
It is written as an execution guide for contributors and AI agents.

## Scope and Outcome

- Improve maintainability by splitting large runtime files into focused modules.
- Keep cross-browser behavior stable (Firefox, Chromium, Edge, mobile variants).
- Prepare storage and AI architecture for future provider expansion.
- Preserve user trust with secure key handling and reliable OAuth flows.
- Keep release and deployment paths reproducible.

## Execution Principles

- Prefer incremental refactors over full rewrites.
- Keep generated outputs out of manual edits.
- Do not change historical release records unless explicitly requested.
- Treat `package.json` version as source of truth for current-version docs.
- Avoid broad search-and-replace scripts for version updates.

## Phase Plan

## Phase 1: Structural Refactor (8k-line reduction)

### Objective

Refactor oversized runtime files into cohesive ES modules while preserving behavior.

### Target modules

- `src/background/sync.js`: sync-provider coordination.
- `src/background/auth.js`: OAuth and auth helpers.
- `src/background/ai.js`: Gemini API orchestration and model routing.
- `src/content/enhancer.js`: chapter enhancement DOM pipeline.
- `src/utils/connectors/`: site connector modules as ES exports.

### Required pattern

- `src/background/background.js` remains the central message router and lifecycle entrypoint.
- Background delegates to feature modules through explicit APIs.

### Acceptance criteria

- No behavior regressions in enhance, summary, backup, and settings flows.
- Build/package scripts continue to succeed unchanged.
- New modules have clear ownership and minimal cross-coupling.

## Phase 2: Multi-Provider Storage Sync (Adapter Pattern)

### Objective

Decouple storage provider logic from core backup/sync orchestration.

### Required abstractions

- `StorageInterface` contract with methods like `upload`, `download`, `list`, `delete`.
- `GoogleDriveAdapter` as first implementation.
- Runtime `activeSync` chosen from user settings.

### UI/Settings requirements

- Settings exposes provider selection.
- Provider selection updates active adapter without restart.

### Acceptance criteria

- Existing Google Drive behavior remains stable.
- Provider switch is non-breaking and testable.

## Phase 3: Build-Time Secret Injection

### Objective

Keep secrets out of repository while supporting official default builds.

### Required workflow

1. Load `.env` values during build.
2. Keep placeholders in source (example: `%%GEMINI_API_KEY%%`).
3. Replace placeholders in build pipeline before final packaging.

### Constraints

- No hardcoded production secrets in repository.
- Build fails with clear message when required secrets are missing.

## Phase 4: Cross-Platform OAuth Reliability (Edge/Mobile)

### Objective

Stabilize OAuth on Edge mobile and cross-browser environments.

### Required change

- Prefer `chrome.identity.launchWebAuthFlow` flow in auth module.
- Use the registered project redirect URI under `ranobe.vkrishna04.me`.

### Acceptance criteria

- OAuth succeeds on Firefox/Chromium desktop and Edge mobile path.
- Failure paths return actionable errors to users.

## Phase 5: Landing and Extension Awareness

### Objective

Allow first-party landing pages to detect extension presence safely.

### Required manifest and runtime changes

- Add `externally_connectable` with `*://ranobe.vkrishna04.me/*`.
- Add background listener for `EXTERNAL_PING`.
- Return install status and extension version in response payload.

### Acceptance criteria

- Landing page can detect install state without exposing privileged APIs.

## Phase 6: Deployment Automation (CI/CD)

### Objective

Reduce manual store publishing work and release drift.

### Required workflow

- Add `.github/workflows/publish.yml` for tag-based release publishing.
- Build extension artifacts and submit to:
  - AMO (Firefox)
  - Edge Add-ons Store

### Acceptance criteria

- Tag push triggers build, package, and publish workflow.
- Secrets are sourced from GitHub Actions secrets only.

## Product Evolution Track (Non-blocking)

- Expand from novels to broader long-form reading surfaces (research/news).
- Explore AI memory/context features (RAG-like chapter memory).
- Keep local AI option as a strategic differentiator when feasible.

## UI Architecture Decision Gate

Current baseline is HTML/CSS/JS and is acceptable.

- Keep current stack if UI complexity remains manageable.
- Evaluate framework migration only when complexity threshold is reached.
- If migration is approved, prefer Vue 3 for contributor friendliness and scoped styles.
- Keep site connectors in simple JS/TS modules regardless of UI framework choice.

## AI Agent Execution Rules

When an AI agent works on this roadmap:

1. Implement one phase or sub-scope per change.
2. Include tests/validation steps in the same change.
3. Update relevant docs touched by the implementation.
4. Do not rewrite unrelated files.
5. If requested scope is already satisfied, return no-op with verification evidence.

## Release-Linked Documentation Rules

- Update version-sensitive docs only when version mismatch exists.
- Keep release history docs unchanged unless explicitly requested:
  - `docs/release/RELEASE_NOTES_*.md`
  - `docs/release/commit-history.md`
- Update file dates only for files actually modified in the release task.
