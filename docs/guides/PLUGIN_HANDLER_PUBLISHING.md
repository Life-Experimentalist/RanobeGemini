# Plugin and Handler Authoring Guide

This guide documents how contributors can add new handlers/providers and prepare them for community sharing.

## Goals

- Make extensions to Ranobe Gemini modular and predictable.
- Keep contribution flow simple for website handlers and future providers.
- Ensure each contribution can be validated and packaged without touching unrelated systems.

## Core Rules

- Keep defaults centralized in `src/utils/constants.js`.
- Use explicit handler/provider overrides only where needed.
- Avoid hardcoded per-site literals outside the handler contract.
- Keep implementation local-first with no required backend service.

## Add a Website Handler

1. Create `src/utils/website-handlers/<site>-handler.js`.
2. Export the same handler shape used by existing handlers.
3. Implement selectors/extractors only for that site.
4. Run `npm run build` and verify handler auto-registration output.
5. Run `npm run update-domains` if domain patterns changed.
6. Verify enhancement and summary flows on real sample pages.

## Add a Provider Adapter (Storage/Sync)

1. Implement adapter methods expected by sync orchestration (`upload`, `download`, `list`, `delete` as applicable).
2. Keep provider auth/config isolated from core runtime.
3. Wire provider into settings selection path.
4. Ensure switching providers does not break existing Google Drive flow.

## Add an AI Provider Adapter

1. Implement provider adapter methods expected by AI orchestration (enhance, summarize, model metadata/capabilities).
2. Keep provider-specific auth headers/endpoints inside the adapter layer.
3. Avoid provider-specific branching in core enhancement/summary pipelines.
4. Add provider settings schema and safe defaults through existing configuration paths.
5. Validate with at least one enhancement and one summary flow end-to-end.

### AI Provider Contract (Runtime)

Provider adapters are validated against the runtime contract and registered through the background provider registry:

- Contract helpers: `src/background/ai/provider-interface.js`
- Registry: `src/background/ai/provider-registry.js`
- Current registration path: `src/background/background.js` (`ensureProviderRegistry`)
- Gemini adapter baseline: `src/background/ai/providers/gemini-provider.js`
- OpenAI-compatible baseline: `src/background/ai/providers/openai-compatible-provider.js`
- Ollama baseline: `src/background/ai/providers/ollama-provider.js`

Required adapter methods:

| Method                         | Purpose                                         |
| ------------------------------ | ----------------------------------------------- |
| `generateEnhancement(payload)` | Return enhanced chapter content                 |
| `generateSummary(payload)`     | Return long/short summary output                |
| `getHealthStatus()`            | Report provider readiness and key/config health |

Optional adapter methods:

| Method         | Purpose                                              |
| -------------- | ---------------------------------------------------- |
| `listModels()` | Return model metadata for provider/model UI surfaces |

Implementation note:

- Core message handlers should dispatch through provider wrappers, not directly call vendor-specific functions.

Provider IDs and baseline config keys:

| Provider ID         | Primary Config Keys                                                      |
| ------------------- | ------------------------------------------------------------------------ |
| `gemini`            | `modelEndpoint`, `apiKey`, `backupApiKeys`, `selectedModelId`            |
| `openai-compatible` | `openAiEndpoint`, `openAiModel`, `openAiApiKey` (falls back to `apiKey`) |
| `ollama`            | `ollamaEndpoint`, `ollamaModel`                                          |

Popup settings integration (baseline):

- `src/popup/popup.html` exposes an `AI Provider` selector (`aiProviderSelect`) used to switch active providers.
- `src/popup/popup.js` persists the selected value to `browser.storage.local.aiProvider` during save/autosave.
- Gemini model refresh in popup remains Gemini-only; OpenAI-compatible and Ollama rely on adapter defaults unless provider-specific settings are supplied.

## Add a Storage Sync Adapter

Storage sync providers are routed through a runtime orchestrator and selected via the `activeSync` setting.

- Storage contract helpers: `src/background/storage/storage-interface.js`
- Storage orchestrator: `src/background/storage/storage-orchestrator.js`
- Google Drive adapter baseline: `src/background/storage/adapters/google-drive-storage.js`
- Background runtime wiring: `src/background/background.js`
- Popup setting control: `src/popup/popup.html` (`syncProviderSelect`) + `src/popup/popup.js`

Required storage adapter methods:

| Method                              | Purpose                                           |
| ----------------------------------- | ------------------------------------------------- |
| `uploadBackup(backupBlob, options)` | Upload backup payload to provider                 |
| `listBackups(options)`              | List available backups for restore UI/sync checks |
| `downloadBackup(fileId, options)`   | Fetch a selected backup payload                   |
| `getLatestBackup(options)`          | Resolve latest provider backup for auto-restore   |
| `getContinuousBackup(options)`      | Resolve provider rolling/continuous backup        |

Optional storage adapter methods:

| Method                | Purpose                                |
| --------------------- | -------------------------------------- |
| `ensureAuth(options)` | Interactive provider auth/connect flow |
| `resetAuth(options)`  | Revoke/reset provider auth state       |

## Add an Extension Bridge Adapter

Use extension bridges when a third-party extension can expose page-level signals (for example reading status) that Ranobe Gemini should consume.

1. Add a bridge entry in `src/utils/extension-bridges.js` with:
	- `id`
	- `shelfId`
	- `settingKey`
	- `datasetKey`
	- `statusSelector` (and optional `statusAttribute`)
2. Keep `defaultEnabled: false` for new/experimental bridges.
3. Add a corresponding site setting toggle in the matching handler `SETTINGS_DEFINITION`.
4. Consume bridge status from handler code using `readExtensionBridgeStatus(<bridge-id>)` before legacy fallback logic.
5. Verify `applyExtensionBridgeFlags()` is called from content runtime initialization for the active shelf.
6. Validate both toggle states:
	- disabled: bridge has no effect
	- enabled: bridge value is read and normalized correctly

Current baseline adapters:

- `betterfiction` (FanFiction)
- `ao3-experimental-status` (AO3, opt-in example behind feature toggle)

## Packaging and Validation Checklist

- Build: `npm run build`
- Package: `npm run package`
- Verify handler/provider behavior in Firefox and Chromium build outputs.
- Confirm no changes in `dist/` are manually edited.

### Handler Contract Failure Triage

`npm run build` now fails fast if a handler does not meet the required contract.

Typical failures and fixes:

| Build Error Signal                                     | Likely Cause                                    | Fix                                               |
| ------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------- |
| `missing required method: canHandle()`                 | Handler class does not implement a site matcher | Add `canHandle()` to the handler class            |
| `missing required method: extractTitle()`              | Title extraction method is missing              | Add `extractTitle()` with site-specific selectors |
| `missing required static field: SUPPORTED_DOMAINS[]`   | No domain list declared on the handler class    | Add non-empty `static SUPPORTED_DOMAINS = [...]`  |
| `SUPPORTED_DOMAINS[] must contain at least one domain` | Domain list exists but is empty                 | Add at least one concrete domain string           |

Notes:

- Indirect inheritance is valid (for example, mobile handlers extending an existing site handler).
- Optional hooks such as `formatAfterEnhancement()` and `supportsTextOnlyEnhancement()` are warning-only and do not fail the build.

## Publishing Notes for Community Contributors

- Include clear README usage notes for any new handler/provider.
- Include known limitations and supported domains.
- Keep changes phase-scoped and avoid broad refactors in the same patch.
- Update roadmap-linked docs when adding new extension points.
- Document provider-specific prerequisites (API key format, local runtime dependencies such as Ollama, endpoint examples).
