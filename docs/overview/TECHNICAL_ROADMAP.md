# Ranobe Gemini Technical Roadmap

This file is the authoritative technical roadmap for evolving Ranobe Gemini.
It is written as an execution guide for contributors and AI agents.

> **Last Updated:** 2026-04-16
> **Current Version:** 4.7.0

## Current State (Verified)

- Runtime is already organized under `src/`.
- `src/background/background.js` has already been reduced significantly (about 4k lines) compared to earlier state.
- The major remaining hotspot is `src/content/content.js` (10k+ lines) and must be the top modularization target.
- Core behavior is local-first: no backend processing owned by this project.
- User data and processing stay on user devices/browser context, user Gemini keys, and user cloud storage (for backups).
- Telemetry is optional, anonymized, and only active with explicit user consent (shown at first library open).

## Scope and Outcome

- Improve maintainability by splitting large runtime files into focused modules.
- Keep cross-browser behavior stable (Firefox, Chromium, Edge, mobile variants).
- Prepare storage and AI architecture for future provider expansion.
- Preserve user trust with secure key handling, explicit consent, and reliable OAuth flows.
- Keep release and deployment paths reproducible.
- Keep extension architecture plugin-friendly so community contributors can add handlers/providers easily.
- Expand from AI enhancement + library management toward a broader reading intelligence tool (novels, articles, and long-form web content).
- Make AI model integration fully provider-modular (Gemini, Ollama, OpenAI-compatible, Claude, DeepSeek, Router-style gateways, and future providers).

## Execution Principles

- Prefer incremental refactors over full rewrites.
- Keep generated outputs out of manual edits.
- Do not change historical release records unless explicitly requested.
- Treat `package.json` version as source of truth for current-version docs.
- Avoid broad search-and-replace scripts for version updates.
- Keep a single source of truth for default constants in `src/utils/constants.js`, with explicit module/handler-level overrides only via documented contracts.
- Every new modular feature must expose clear extension points (interfaces, adapters, or registry entries) to avoid hard-coding.

## Architecture Tenets

1. Local-first and user-owned data.
2. No mandatory backend service for core functionality.
3. Model-agnostic AI integration driven by user-provided keys/endpoints.
4. Provider-agnostic sync/storage via adapters.
5. Plugin-first extensibility for handlers and future feature modules.
6. Documentation-first contributor experience.
7. Cross-device compatibility across extension + web app surfaces.

## Phase Plan

## Phase 0: Baseline Alignment and Documentation Hardening

### Objective

Align roadmap tasks with real current state and make contribution paths explicit.

### Deliverables

- Keep this roadmap synchronized with implemented architecture.
- Maintain contributor-facing guides for handler/provider/plugin onboarding.
- Ensure AI prompts/instructions reference this roadmap as source of truth.

### Acceptance criteria

- No roadmap task duplicates already completed work.
- Contributor can identify where to add a handler/provider without reading entire codebase.

## Phase 1: Content Runtime Modularization (Top Priority)

### Objective

Refactor oversized content runtime into cohesive ES modules while preserving behavior.

### Target modules

- `src/content/enhancer.js`: chapter enhancement orchestration.
- `src/content/summary.js`: summary generation/render lifecycle.
- `src/content/chunking-runtime.js`: per-chunk UI/runtime wiring.
- `src/content/dom-integration.js`: DOM targeting/injection boundaries.
- `src/content/telemetry-consent.js`: consent gate wiring for telemetry-related UX.

### Existing stable modules to preserve

- `src/background/background.js` remains central background message router.
- `src/utils/website-handlers/` remains handler-based site adaptation layer.

### Required pattern

- `content.js` should become thin orchestration entrypoint that delegates to feature modules.
- Cross-module communication must use explicit APIs and typed payload contracts (even in JS via JSDoc typedefs).

### Acceptance criteria

- No behavior regressions in enhance, summary, backup, and settings flows.
- Build/package scripts continue to succeed unchanged.
- New modules have clear ownership and minimal cross-coupling.
- `content.js` line count trends downward with each sub-phase (target: sub-4k over time).

## Phase 2: Plugin and Handler Ecosystem Maturity

### Objective

Make handler/provider extension truly modular and contributor-friendly.

### Deliverables

- Define clear handler capability contracts (required exports + optional hooks).
- Document handler publishing/packaging path for community modules.
- Keep registry/discovery workflow deterministic.
- Add context-aware modal navigation to library and shelf pages so modal traversal respects the active filtered set.
- Harden site handlers such as AO3 so non-work routes do not get treated as importable novels.
- Preserve full-length summaries in stored metadata and only control presentation in the UI layer.

### Acceptance criteria

- New handler can be added with minimal boilerplate and clear docs.
- Build pipeline includes/validates handler registration without manual hacks.
- Contributor docs contain concrete examples and troubleshooting.

## Phase 3: AI Provider Modularization (Model Adapter Pattern)

### Objective

Decouple AI requests from any single vendor and allow contributors/users to add providers.

### Deliverables

- Define a provider interface (generateEnhancement, generateSummary, health/status, model-list capability where available).
- Add adapter modules for baseline providers:
  - Google Gemini
  - OpenAI-compatible API
  - Local Ollama
  - Router gateway providers
- Keep provider selection and per-provider settings in user configuration.
- Ensure UI can display provider name/model consistently.

### Acceptance criteria

- Switching providers does not require core pipeline rewrites.
- Existing Gemini behavior remains stable and backwards-compatible.
- Adding a new provider follows documented adapter workflow.

## Phase 4: Multi-Provider Storage Sync (Adapter Pattern)

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

## Phase 5: Build-Time Secret Injection and Config Hygiene

### Objective

Keep secrets out of repository while supporting official default builds.

### Required workflow

1. Load `.env` values during build.
2. Keep placeholders in source (example: `%%GEMINI_API_KEY%%`).
3. Replace placeholders in build pipeline before final packaging.

### Constraints

- No hardcoded production secrets in repository.
- Build fails with clear message when required secrets are missing.

## Phase 6: Cross-Platform OAuth Reliability (Edge/Mobile)

### Objective

Stabilize OAuth on Edge mobile and cross-browser environments.

### Required change

- Prefer `chrome.identity.launchWebAuthFlow` flow in auth module.
- Use the registered project redirect URI under `ranobe.vkrishna04.me`.

### Acceptance criteria

- OAuth succeeds on Firefox/Chromium desktop and Edge mobile path.
- Failure paths return actionable errors to users.

## Phase 7: Landing and Extension Awareness

### Objective

Allow first-party landing pages to detect extension presence safely.

### Required manifest and runtime changes

- Add `externally_connectable` with `*://ranobe.vkrishna04.me/*`.
- Add background listener for `EXTERNAL_PING`.
- Return install status and extension version in response payload.
- This will work for both Temporary Addons or store installed versions.

### Acceptance criteria

- Landing page can detect install state without exposing privileged APIs.

## Phase 8: Cross-Device Compatibility (Web App + Extension)

### Objective

Keep user experience consistent across extension runtime and first-party web app surfaces.

### Deliverables

- Define shared compatibility contracts for data shape and sync semantics.
- Maintain PWA/web entry compatibility for library and recovery flows.
- Ensure key flows work on desktop and mobile browser contexts.

### Acceptance criteria

- User can move between supported devices/surfaces without data model breakage.
- Web app surfaces remain compatible with extension-generated data.

## Phase 9: Deployment Automation (CI/CD)

### Objective

Reduce manual store publishing work and release drift.

### Required workflow

- Add `.github/workflows/publish-addons.yml` for tag-based release publishing.
- Build extension artifacts and submit automatically to:
  - AMO (Firefox)
  - Chrome Web Store
- Package a Chromium/Edge-ready artifact for Partner Center upload when a public Edge submission API is unavailable.

### Acceptance criteria

- Tag push triggers build, package, and publish workflow.
- Supported store uploads run from GitHub Actions secrets only.
- Edge packaging remains artifact-assisted until Microsoft exposes a public programmatic publish path.

## Product Evolution Track (Non-blocking)

- Expand from novels to broader long-form reading surfaces (research/news/articles).
- Explore AI memory/context features (RAG-like chapter memory).
- Keep local AI option as a strategic differentiator when feasible.
- Keep all future expansion local-first with user-owned credentials and optional sync providers.

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
6. Always verify whether work is already done before planning refactors.
7. Prefer extending existing modular contracts over introducing parallel patterns.

## Release-Linked Documentation Rules

- Update version-sensitive docs only when version mismatch exists.
- Keep release history docs unchanged unless explicitly requested:
  - `docs/release/RELEASE_NOTES_*.md`
  - `docs/release/commit-history.md`
- Update file dates only for files actually modified in the release task.
