# Secret and Environment Input Map

This document inventories the environment variables used by build and release tooling.

## Build-time secret injection (`dev/build.js`)

These values are loaded from `.env` and injected into `dist/*/utils/constants.js` during `npm run build`:

| Env var                  | Injected target constant      | Purpose                                                              | Required |
| ------------------------ | ----------------------------- | -------------------------------------------------------------------- | -------- |
| `RG_DRIVE_CLIENT_ID`     | `DEFAULT_DRIVE_CLIENT_ID`     | Optional default Google Drive OAuth client ID in built artifacts     | No       |
| `RG_DRIVE_CLIENT_SECRET` | `DEFAULT_DRIVE_CLIENT_SECRET` | Optional default Google Drive OAuth client secret in built artifacts | No       |
| `RG_TELEMETRY_ENDPOINT`  | `TELEMETRY_ENDPOINT`          | Optional telemetry endpoint override for official builds             | No       |

Guardrail:

- Source `src/utils/constants.js` must not contain hardcoded secret values for these constants.
- `dev/build.js` fails if a non-placeholder/non-empty hardcoded value is detected.
- To enforce required build secrets in CI/release builds, set `RG_REQUIRED_BUILD_SECRETS` with comma-separated env keys (for example: `RG_REQUIRED_BUILD_SECRETS=RG_DRIVE_CLIENT_ID,RG_DRIVE_CLIENT_SECRET`).

## Store publishing secrets (`dev/publish-addon-stores.js`)

These variables control automated store publishing flows.

### Firefox (AMO)

| Env var                  | Purpose                                           | Required when publishing Firefox |
| ------------------------ | ------------------------------------------------- | -------------------------------- |
| `AMO_API_KEY`            | AMO JWT issuer/key                                | Yes                              |
| `AMO_API_SECRET`         | AMO JWT secret                                    | Yes                              |
| `AMO_METADATA_FILE`      | Optional metadata payload path for `web-ext sign` | No                               |
| `AMO_UPLOAD_SOURCE_CODE` | Toggle source upload behavior                     | No                               |

### Chrome Web Store

| Env var             | Purpose                         | Required when publishing Chrome |
| ------------------- | ------------------------------- | ------------------------------- |
| `CWS_CLIENT_ID`     | OAuth client ID for CWS API     | Yes                             |
| `CWS_CLIENT_SECRET` | OAuth client secret for CWS API | Yes                             |
| `CWS_REFRESH_TOKEN` | OAuth refresh token for CWS API | Yes                             |
| `CWS_PUBLISHER_ID`  | CWS publisher identifier        | Yes                             |
| `CWS_EXTENSION_ID`  | CWS extension identifier        | Yes                             |

### Publishing mode toggles

| Env var                  | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `PUBLISH_STRICT`         | Fail when an enabled store is missing required credentials |
| `PUBLISH_FIREFOX`        | Firefox publish mode (`auto`, `on`, `off`)                 |
| `PUBLISH_CHROME`         | Chrome publish mode (`auto`, `on`, `off`)                  |
| `PUBLISH_EDGE_MANUAL`    | Edge manual-channel reporting mode (`auto`, `on`, `off`)   |
| `PUBLISH_BRAVE_MANUAL`   | Brave manual-channel reporting toggle                      |
| `PUBLISH_OPERA_MANUAL`   | Opera manual-channel reporting toggle                      |
| `PUBLISH_VIVALDI_MANUAL` | Vivaldi manual-channel reporting toggle                    |
| `PUBLISH_ULAA_MANUAL`    | Ulaa manual-channel reporting toggle                       |
| `PUBLISH_ARC_MANUAL`     | Arc manual-channel reporting toggle                        |

## Notes

- Keep secrets in local `.env` or CI secret storage only.
- Do not hardcode secret material in source files under `src/`.
- If a new secret is added to tooling, update this map in the same change.
