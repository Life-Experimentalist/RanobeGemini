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

## Execution Tracking Model (Prompt Efficiency)

To keep implementation efficient and measurable, each phase is executed in **unit-sized slices**.
One unit should be small enough to complete in a focused implementation window with validation and docs updates.

### Prompt Budget Rules

- `Prompt` = one user->agent implementation request/iteration.
- `Target prompts` = planned prompt budget for a unit.
- `Hard cap` = maximum prompts before scope split or deferral.
- If a unit exceeds cap, split it into `Unit x.a / x.b` and continue without blocking other tracks.

### Progressive Complexity Ladder (Do Goals First)

Every unit should be delivered in layers so core outcomes land before advanced polish.

| Layer            | Purpose                                               | Typical Prompt Cost | Exit Condition                             |
| ---------------- | ----------------------------------------------------- | ------------------- | ------------------------------------------ |
| L0 Foundation    | Minimal viable implementation to make the flow work   | 1                   | Core behavior works in primary path        |
| L1 Stabilization | Error handling + compatibility checks + docs sync     | +1                  | No known breakage in common paths          |
| L2 Hardening     | Edge cases, fallback paths, performance/safety polish | +1 to +2            | Flow is resilient across expected variance |
| L3 Optimization  | Optional UX/perf enhancements and refactors           | +1+                 | Added value without delaying delivery      |

Rule: complete `L0` and `L1` before attempting `L2/L3`, unless a blocker forces deeper work.

### Expected vs Actual Tracking Schema

Track both planned and actual effort per unit.

| Field                | Meaning                                                    |
| -------------------- | ---------------------------------------------------------- |
| Expected Prompts     | Planned range before implementation                        |
| Actual Prompts       | Real prompts consumed to completion                        |
| Variance             | `Actual - Expected midpoint`                               |
| Variance Reason      | Why variance happened (scope, unknowns, regressions, etc.) |
| Assumption Status    | `valid`, `partially-valid`, or `invalid`                   |
| Recalibration Action | Budget/scope/process adjustment for next units             |

### Grouped Workstreams

| Group                 | Purpose                                       | Related Phases |
| --------------------- | --------------------------------------------- | -------------- |
| Runtime Core          | Modularize content/background runtime safely  | 1, 6           |
| Extensibility         | Handler/provider/storage adapter architecture | 2, 3, 4        |
| Release & Ops         | Build, secrets, CI/CD publishing quality      | 5, 9           |
| Surface Compatibility | Landing, extension awareness, cross-device UX | 7, 8           |

### Phase Unit Budget Summary

| Phase                                | Unit Count | Target Prompts | Hard Cap | Status      |
| ------------------------------------ | ---------- | -------------- | -------- | ----------- |
| 0: Baseline Alignment                | 2          | 2-4            | 5        | in-progress |
| 1: Content Runtime Modularization    | 5          | 10-16          | 20       | in-progress |
| 2: Handler Ecosystem Maturity        | 5          | 8-12           | 14       | in-progress |
| 3: AI Provider Modularization        | 4          | 8-12           | 14       | in-progress |
| 4: Storage Adapter Pattern           | 3          | 5-8            | 10       | in-progress |
| 5: Secret Injection & Config Hygiene | 3          | 4-7            | 8        | in-progress |
| 6: OAuth Reliability                 | 3          | 4-6            | 8        | in-progress |
| 7: Landing Awareness                 | 3          | 4-7            | 8        | in-progress |
| 8: Cross-Device Compatibility        | 3          | 5-8            | 10       | in-progress |
| 9: Deployment Automation             | 3          | 4-7            | 8        | in-progress |

### Rolling Prompt Tracker

| Phase-Unit                                                     | Expected Prompts | Actual Prompts | Variance         | Variance Reason                                                                                                                                 | Assumption Status | Recalibration Action                                                              | Last Updated |
| -------------------------------------------------------------- | ---------------- | -------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------- | ------------ |
| 0-U1 Roadmap alignment + drift cleanup                         | 1-2              | 2              | +0.5 vs midpoint | Scope matched expected documentation complexity                                                                                                 | valid             | Keep baseline docs budget unchanged                                               | 2026-04-16   |
| 0-U2 Docs consistency + broken links                           | 1-2              | 1              | -0.5 vs midpoint | Fewer link issues than expected                                                                                                                 | valid             | Reduce simple docs-fix budget to 1 where scoped                                   | 2026-04-16   |
| 1-U1 Summary runtime orchestration extraction (L0-L1)          | 2-3              | 2              | -0.5 vs midpoint | Helper-module boundary + build validation kept scope tight                                                                                      | valid             | Keep summary refactors in helper slices with same-session build checks            | 2026-04-16   |
| 1-U2 Chunk control/event extraction (L0-L1)                    | 2-4              | 3              | +0.0 vs midpoint | Runtime loader pattern kept chunk-event and batch-handler splits stable                                                                         | valid             | Keep chunk controls split into state/events/batch modules                         | 2026-04-16   |
| 1-U3 DOM integration boundary extraction (L0-L6)               | 2-3              | 6              | +3.5 vs midpoint | Reused shared top-insert helper across banner/error/notice flows and reduced repeated content-area insertion branches                           | partially-valid   | Close remaining 1-U3 boundaries quickly, then move to 1-U4 telemetry consent      | 2026-04-16   |
| 1-U4 Telemetry consent modularization (L0-L1)                  | 1-2              | 2              | +0.5 vs midpoint | Consent check and consent-action wiring were isolated and direct runtime invocation replaced local wrapper                                      | valid             | Proceed to 1-U5 orchestrator-thinning passes with parity checks                   | 2026-04-16   |
| 1-U5 Orchestrator thinning + validation (L0-L7)                | 3-4              | 8              | +4.5 vs midpoint | Introduced shared toggle-banner refresh utility and reused it across both enhancement toggle flows                                              | partially-valid   | Split into 1-U5a closure sweep and proceed to Phase 2 once parity sign-off lands  | 2026-04-16   |
| 1-U5a Orchestrator closure parity sweep (L1)                   | 1                | 1              | +0.0 vs midpoint | Applied shared toggle-banner helper in the recursive cached-content flow and revalidated full build parity                                      | valid             | Mark Phase 1 closure and continue with 2-U1 handler contract formalization        | 2026-04-16   |
| 2-U1 Handler capability contract + optional hooks (L0-L1)      | 1-2              | 1              | -0.5 vs midpoint | Added runtime contract validator and documented required/optional handler hooks for contributor onboarding                                      | valid             | Continue to 2-U2 deterministic validation in build/registration path              | 2026-04-16   |
| 2-U2 Deterministic build/registration validation (L0-L1)       | 2-3              | 2              | -0.5 vs midpoint | Added fail-fast handler contract checks to build registry generation and corrected indirect inheritance validation                              | valid             | Move to 2-U5 contributor workflow polish and troubleshooting guidance             | 2026-04-16   |
| 2-U5 Contributor guide refresh (L0)                            | 2-3              | 1              | -1.0 vs midpoint | Added concrete build-failure triage for handler contract violations in publishing guide                                                         | valid             | Continue remaining Phase 2 backlog based on runtime-facing priority               | 2026-04-16   |
| 3-U1 Provider interface + adapter registry (L0)                | 2-3              | 1              | -1.5 vs midpoint | Added provider interface/registry modules and routed enhancement/summary dispatch through provider adapters                                     | valid             | Continue with 3-U2 Gemini parity baseline using dedicated adapter module          | 2026-04-16   |
| 3-U2 Gemini adapter parity baseline (L0-L1)                    | 1-2              | 1              | -0.5 vs midpoint | Extracted Gemini provider adapter to dedicated module and preserved existing enhancement/summary behavior through registry dispatch             | valid             | Proceed to 3-U3 OpenAI-compatible and Ollama adapters through same interface      | 2026-04-16   |
| 3-U3 OpenAI-compatible + Ollama adapters (L0)                  | 3-4              | 1              | -2.5 vs midpoint | Added baseline OpenAI-compatible and Ollama provider adapters and registered both in runtime provider registry                                  | valid             | Continue to 3-U4 provider settings UI wiring and user-facing selector flow        | 2026-04-16   |
| 3-U4 Provider settings UI switch flow (L0)                     | 2-3              | 1              | -1.5 vs midpoint | Added popup provider selector persisted as aiProvider and made save/autosave/model-refresh logic provider-aware with Gemini-only model refresh  | valid             | Continue Phase 3 with provider-specific settings hardening and parity validation  | 2026-04-16   |
| 4-U1 Storage interface + orchestrator boundary (L0)            | 1-2              | 1              | -0.5 vs midpoint | Introduced storage sync interface/orchestrator with activeSync selection and routed background Drive backup/sync calls through adapter boundary | valid             | Continue to 4-U2 by moving Drive auth/control paths behind dedicated adapter APIs | 2026-04-16   |
| 4-U2 Drive behind adapter in runtime path (L0)                 | 2-3              | 1              | -1.5 vs midpoint | Routed remaining background Drive auth entry points through storage orchestrator and Google Drive adapter optional auth methods                 | valid             | Continue to 4-U3 provider selection wiring in settings and validation docs        | 2026-04-16   |
| 4-U3 Provider selection wiring + validation docs (L0)          | 2-3              | 1              | -1.5 vs midpoint | Added popup sync provider selector persisted to activeSync and documented storage adapter contract/wiring paths for contributors                | valid             | Continue to Phase 5-U1 placeholder inventory and required env input mapping       | 2026-04-16   |
| 5-U1 Secret/env input inventory map (L0)                       | 1-2              | 1              | -0.5 vs midpoint | Added explicit build/publish secret environment map with variable purpose, requiredness, and guardrail notes                                    | valid             | Continue to 5-U2 build-time required secret validation checks                     | 2026-04-16   |
| 5-U2 Build-time required secret validation (L0)                | 2-3              | 1              | -1.5 vs midpoint | Added `RG_REQUIRED_BUILD_SECRETS` strict validation in build pipeline with actionable missing-key errors                                        | valid             | Continue to 5-U3 contributor setup flow docs for local and CI paths               | 2026-04-16   |
| 5-U3 Contributor secret setup docs (L0)                        | 1-2              | 1              | -0.5 vs midpoint | Added build docs quickstart for local vs CI secret handling and linked secret map                                                               | valid             | Continue to Phase 6 OAuth reliability path                                        | 2026-04-16   |
| 6-U1 Normalize auth flow abstraction around web auth APIs (L0) | 1-2              | 1              | -0.5 vs midpoint | Consolidated Drive OAuth redirect handling around canonical web callback and shared redirect parsing                                            | valid             | Continue to 6-U2 Edge/mobile callback path reliability pass                       | 2026-04-18   |
| 6-U2 Edge mobile redirect + callback reliability fixes (L0)    | 2-3              | 2              | -0.5 vs midpoint | Stopped oauth-redirect callback flow from extension navigation handoff to prevent launchWebAuthFlow completion races                            | valid             | Continue to 6-U3 by hardening user-facing OAuth error diagnosis                   | 2026-04-18   |
| 6-U3 OAuth error telemetry/messages hardening (L0)             | 1-2              | 1              | -0.5 vs midpoint | Added actionable redirect URI troubleshooting hints to stored Drive auth errors used by popup/library status surfaces                           | valid             | Continue to Phase 7 landing-extension awareness integration path                  | 2026-04-18   |
| 7-U1 Manifest + background EXTERNAL_PING contract (L0)         | 1-2              | 1              | -0.5 vs midpoint | Added externally_connectable allowlist plus external ping response payload with install state, version, and library URL                         | valid             | Continue to 7-U2 landing-side secure ping consumption and compatibility checks    | 2026-04-18   |
| 7-U2 Landing-side ping integration + compatibility checks (L0) | 2-3              | 1              | -1.5 vs midpoint | Landing script now prefers secure runtime sendMessage ping and falls back to existing extension URL probing where runtime messaging is absent   | partially-valid   | Verify Firefox/PWA/mobile compatibility behavior and proceed to Phase 8 contracts | 2026-04-18   |
| 7-U3 Consent-safe public metrics surfacing (L0-L1)             | 1-2              | 1              | -0.5 vs midpoint | Added landing impact metrics cards wired to public CFlair endpoints and tightened explicit consent-first telemetry wording in library + README  | valid             | Continue manual browser parity checks and proceed with remaining Phase 8 work     | 2026-04-18   |
| 8-U1 Compatibility contract + migration policy (L0)            | 1-2              | 1              | -0.5 vs midpoint | Added shared cross-surface contract/migration policy anchored to backup format v3.0 and linked the policy in backup docs                        | valid             | Continue to 8-U2 restore/load parity validation across local and Drive paths      | 2026-04-18   |
| 8-U2 Backup parity validator + fixture checks (L0)             | 2-3              | 1              | -1.5 vs midpoint | Added scripted cross-surface contract parity checks (runtime format, canonical schema envelope, landing schema proxy, sample fixture envelope)  | partially-valid   | Complete manual Firefox/Chromium restore-path smoke checks and continue to 8-U3   | 2026-04-18   |
| 8-U3 Cross-device UX parity checklist + owners (L0)            | 2-3              | 1              | -1.5 vs midpoint | Added mobile/desktop parity matrix with explicit flow ownership, known incompatibilities, and manual smoke checklist for sign-off               | valid             | Close remaining manual 8-U2 restore-path checks to complete Phase 8               | 2026-04-18   |
| 8-U2a Manual restore-path smoke checklist artifact (L0)        | 1-2              | 1              | -0.5 vs midpoint | Added execution checklist for Firefox/Chromium desktop/mobile restore parity, including local replace/merge and Drive latest/continuous flows   | valid             | Execute checklist in real browser runtimes and record results                     | 2026-04-18   |
| 2-U3 Modal navigation + summary fidelity hardening             | 2-3              | 3              | +0.5 vs midpoint | Cross-surface parity and regression checks increased effort                                                                                     | partially-valid   | Budget parity-sensitive UI units at upper bound                                   | 2026-04-16   |
| 2-U4 Extension bridge framework baseline (BetterFiction-first) | 1-2              | 2              | +0.5 vs midpoint | Introduced reusable adapter path across content and handler                                                                                     | valid             | Keep initial bridge work at 2 prompts when touching two runtimes                  | 2026-04-16   |
| 8-U3 Mobile modal UX parity (touch targets + swipe dismiss)    | 2-3              | 2              | -0.5 vs midpoint | Reusable helper reduced per-surface implementation cost                                                                                         | valid             | Prefer shared helpers before per-surface edits                                    | 2026-04-16   |
| 8-U3a Mobile bottom navigation baseline (L0-L1)                | 1-2              | 1              | -0.5 vs midpoint | Existing view-state logic enabled low-cost nav extension                                                                                        | valid             | Keep mobile nav baseline as a thin UI layer over existing handlers                | 2026-04-16   |
| 9-U1 Store publish script + workflow                           | 2-3              | 2              | -0.5 vs midpoint | Existing release scripts lowered integration complexity                                                                                         | valid             | Keep automation baseline budget at 2 prompts                                      | 2026-04-16   |
| 9-U2 Follow-up release automation polish                       | 1-2              | 1              | -0.5 vs midpoint | Small scoped polish with no major regressions                                                                                                   | valid             | Keep follow-up polish as single-prompt unit                                       | 2026-04-16   |
| 9-U3 Modular store gating + manual channel reporting           | 1-2              | 1              | -0.5 vs midpoint | Mode-based store flow avoided credential-blocked failures                                                                                       | valid             | Keep modular publish polish scoped to one prompt when isolated                    | 2026-04-16   |

### Budget Overrun and Assumption Recalibration Protocol

If `Actual > Hard cap` or variance is consistently positive:

1. Record primary reason category:
  - hidden dependency
  - scope creep
  - regression recovery
  - tooling/build friction
  - unclear acceptance criteria
2. Mark assumption as `invalid` or `partially-valid`.
3. Split remaining work into a new unit (`x.a`, `x.b`) with narrower exit criteria.
4. Increase expected budget only for units with matching risk profile.
5. Update grouped workstream budget guidance so future planning inherits the correction.

If `Actual < Expected` for 2+ similar units:

1. Mark assumption `valid`.
2. Reduce future expected prompts for that unit type.
3. Move saved budget to blocked/high-risk units, not optional polish.

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

### Unit breakdown and prompt budget

| Unit | Scope                                        | Target Prompts | Exit Criteria                                     |
| ---- | -------------------------------------------- | -------------- | ------------------------------------------------- |
| 0-U1 | Align roadmap with actual architecture state | 1-2            | Current-state section verified and no false TODOs |
| 0-U2 | Docs consistency checks and dead-link fixes  | 1-2            | No broken internal docs links in touched files    |

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

### Unit breakdown and prompt budget

| Unit | Scope                                                   | Target Prompts | Exit Criteria                                          |
| ---- | ------------------------------------------------------- | -------------- | ------------------------------------------------------ |
| 1-U1 | Extract summary runtime orchestration from `content.js` | 2-3            | Summary entrypoints routed through dedicated module    |
| 1-U2 | Extract chunking runtime controls/events                | 2-4            | Chunk controls no longer depend on large inline blocks |
| 1-U3 | Extract DOM integration and insertion boundaries        | 2-3            | Handler DOM contracts centralized and documented       |
| 1-U4 | Extract telemetry consent wiring into isolated module   | 1-2            | Consent gate logic is self-contained + tested          |
| 1-U5 | Reduce `content.js` to orchestrator + validation pass   | 3-4            | No regressions and measurable line-count reduction     |

## Phase 2: Plugin and Handler Ecosystem Maturity

### Objective

Make handler/provider extension truly modular and contributor-friendly.

### Deliverables

- Define clear handler capability contracts (required exports + optional hooks).
- Document handler publishing/packaging path for community modules.
- Keep registry/discovery workflow deterministic.
- Add a reusable extension-bridge framework for third-party extension signals (BetterFiction-first, adapter-ready for others).
- Add context-aware modal navigation to library and shelf pages so modal traversal respects the active filtered set.
- Harden site handlers such as AO3 so non-work routes do not get treated as importable novels.
- Preserve full-length summaries in stored metadata and only control presentation in the UI layer.

### Acceptance criteria

- New handler can be added with minimal boilerplate and clear docs.
- New extension bridge adapter can be added without changing core content orchestration logic.
- Build pipeline includes/validates handler registration without manual hacks.
- Contributor docs contain concrete examples and troubleshooting.

### Unit breakdown and prompt budget

| Unit | Scope                                                       | Target Prompts | Exit Criteria                                             |
| ---- | ----------------------------------------------------------- | -------------- | --------------------------------------------------------- |
| 2-U1 | Formalize handler capability contract + optional hooks      | 1-2            | Contract documented + consumed in registry logic          |
| 2-U2 | Add deterministic validation in build/registration path     | 2-3            | Build fails fast on invalid handler shape                 |
| 2-U3 | Modal/navigation and metadata fidelity hardening            | 1-2            | Filter-scoped navigation + full-length metadata preserved |
| 2-U4 | Extension bridge framework baseline (BetterFiction-first)   | 1-2            | Shared bridge utility integrated with content + handlers  |
| 2-U5 | Contributor guide refresh for add/test/publish handler path | 2-3            | New handler/bridge can be onboarded from docs only        |

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

### Unit breakdown and prompt budget

| Unit | Scope                                            | Target Prompts | Exit Criteria                                        |
| ---- | ------------------------------------------------ | -------------- | ---------------------------------------------------- |
| 3-U1 | Define provider interface + adapter registry     | 2-3            | Core flow uses interface, not vendor conditionals    |
| 3-U2 | Implement Gemini adapter parity baseline         | 1-2            | Existing Gemini behavior unchanged via adapter       |
| 3-U3 | Add OpenAI-compatible + Ollama adapters          | 3-4            | Both providers callable through same pipeline        |
| 3-U4 | Provider settings UI + docs for adding providers | 2-3            | Provider switch works from settings without refactor |

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

### Unit breakdown and prompt budget

| Unit | Scope                                               | Target Prompts | Exit Criteria                                     |
| ---- | --------------------------------------------------- | -------------- | ------------------------------------------------- |
| 4-U1 | Define `StorageInterface` and orchestrator boundary | 1-2            | Core backup logic depends on interface only       |
| 4-U2 | Move Drive implementation behind adapter            | 2-3            | Drive path uses adapter and passes existing flows |
| 4-U3 | Add provider selection wiring + validation docs     | 2-3            | Active sync provider switch is runtime-safe       |

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

### Unit breakdown and prompt budget

| Unit | Scope                                          | Target Prompts | Exit Criteria                                         |
| ---- | ---------------------------------------------- | -------------- | ----------------------------------------------------- |
| 5-U1 | Inventory placeholders and required env inputs | 1-2            | Required secret map documented                        |
| 5-U2 | Build pipeline injection and validation checks | 2-3            | Missing secrets fail build with actionable errors     |
| 5-U3 | Docs + contributor setup for local/dev/release | 1-2            | Reproducible setup from docs without manual guesswork |

## Phase 6: Cross-Platform OAuth Reliability (Edge/Mobile)

### Objective

Stabilize OAuth on Edge mobile and cross-browser environments.

### Required change

- Prefer `chrome.identity.launchWebAuthFlow` flow in auth module.
- Use the registered project redirect URI under `ranobe.vkrishna04.me`.

### Acceptance criteria

- OAuth succeeds on Firefox/Chromium desktop and Edge mobile path.
- Failure paths return actionable errors to users.

### Unit breakdown and prompt budget

| Unit | Scope                                                | Target Prompts | Exit Criteria                                     |
| ---- | ---------------------------------------------------- | -------------- | ------------------------------------------------- |
| 6-U1 | Normalize auth flow abstraction around web auth APIs | 1-2            | Browser-specific logic wrapped behind common flow |
| 6-U2 | Edge mobile redirect + callback reliability fixes    | 2-3            | Edge mobile success path verified                 |
| 6-U3 | Error telemetry/messages and fallback UX hardening   | 1-2            | Actionable user-facing OAuth error handling       |

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

### Unit breakdown and prompt budget

| Unit | Scope                                                    | Target Prompts | Exit Criteria                        |
| ---- | -------------------------------------------------------- | -------------- | ------------------------------------ |
| 7-U1 | Manifest + background `EXTERNAL_PING` contract           | 1-2            | Ping returns install state + version |
| 7-U2 | Landing-side integration + docs and compatibility checks | 2-3            | Landing surfaces consume ping safely |
| 7-U3 | Consent-safe public metrics surfacing                    | 1-2            | Landing/README expose opt-in metrics |

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

### Unit breakdown and prompt budget

| Unit | Scope                                                      | Target Prompts | Exit Criteria                                  |
| ---- | ---------------------------------------------------------- | -------------- | ---------------------------------------------- |
| 8-U1 | Define compatibility contracts and migration policy        | 1-2            | Shared contract documented and versioned       |
| 8-U2 | Validate backup/recovery parity across extension + web app | 2-3            | Cross-surface restore/load parity verified     |
| 8-U3 | Mobile and desktop UX behavior parity checklist            | 2-3            | Known incompatibilities documented with owners |

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
- Store channels can run conditionally so missing optional credentials do not fail the whole release.
- Edge packaging remains artifact-assisted until Microsoft exposes a public programmatic publish path.

### Unit breakdown and prompt budget

| Unit | Scope                                        | Target Prompts | Exit Criteria                                                 |
| ---- | -------------------------------------------- | -------------- | ------------------------------------------------------------- |
| 9-U1 | Implement workflow + publish script baseline | 2-3            | CI builds, packages, and calls publish entrypoint             |
| 9-U2 | Secret validation + modular store gating     | 1-2            | Optional stores skip cleanly; required stores fail clearly    |
| 9-U3 | Manual-channel reporting + release docs      | 1-2            | Manual channels are reported and release flow is reproducible |

## Product Evolution Track (Non-blocking)

- Expand from novels to broader long-form reading surfaces (research/news/articles).
- Keep WebNovel handler re-enable work deferred and non-blocking until a dedicated validation cycle.
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
