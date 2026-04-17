# Cross-Device UX Parity Checklist

This checklist tracks desktop/mobile parity across extension and first-party web app surfaces.

## Scope

- Desktop browsers: Firefox, Chromium-based browsers
- Mobile browsers: Firefox Android, Chromium mobile where supported
- Surfaces: extension runtime UI, landing/PWA web UI, backup/recovery flows

## Ownership Model

- Runtime owner: `src/background/**`, `src/content/**`, `src/library/**`
- Landing owner: `landing/**`
- Backup contract owner: `src/utils/comprehensive-backup.js`, `docs/backup/**`

## Parity Matrix

| Flow                                                           | Desktop Status               | Mobile Status                                    | Surface Owner         | Notes                                                                       |
| -------------------------------------------------------------- | ---------------------------- | ------------------------------------------------ | --------------------- | --------------------------------------------------------------------------- |
| Landing extension detection (`EXTERNAL_PING` + fallback probe) | ✅ Baseline implemented       | ✅ Baseline implemented                           | Landing owner         | `landing/script.js` prefers secure ping, fallback retained.                 |
| Open extension library from landing                            | ✅ Baseline implemented       | ⚠️ Verify in Firefox Android extension context    | Landing owner         | Depends on browser support for extension URL launch.                        |
| Google Drive OAuth via canonical web redirect                  | ✅ Baseline implemented       | ⚠️ Verify callback reliability on mobile browsers | Runtime owner         | Canonical callback uses `https://ranobe.vkrishna04.me/oauth-redirect.html`. |
| Local backup export/import envelope compatibility              | ✅ Scripted checks in place   | ✅ Scripted checks in place                       | Backup contract owner | Covered by `npm run validate:backup-contract`.                              |
| Drive backup restore (latest/continuous)                       | ⚠️ Manual smoke check pending | ⚠️ Manual smoke check pending                     | Runtime owner         | Final 8-U2 manual verification gate.                                        |
| Library/PWA install UX messaging                               | ✅ Baseline implemented       | ✅ Baseline implemented                           | Landing owner         | Install hints and extension-detected state are surfaced.                    |

## Known Incompatibilities

1. Extension library deep-link opening can differ by mobile browser policy.
Owner: Landing owner
Action: Keep install/setup fallback guidance visible when direct open is blocked.

2. OAuth popup flow behavior differs across mobile browsers when third-party cookies/popups are restricted.
Owner: Runtime owner
Action: Preserve actionable auth error text and fallback reconnect steps.

3. Drive auto-restore parity still requires manual verification on real mobile browser runtimes.
Owner: Runtime owner
Action: Complete manual 8-U2 smoke checklist before phase sign-off.

## Manual Smoke Checklist

1. Desktop Firefox: landing detects extension and opens library.
2. Desktop Chromium: landing detects extension and opens library.
3. Mobile Firefox: OAuth connect, backup upload, backup restore complete.
4. Mobile Chromium: landing/PWA install guidance and backup import messaging stay usable.
5. Confirm no schema or envelope mismatch warnings on valid backup imports.

## Exit Criteria Mapping (Phase 8-U3)

- Known incompatibilities are documented with explicit owners.
- Desktop/mobile parity checklist exists in repo and is maintained with roadmap updates.
