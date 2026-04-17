# Cross-Surface Compatibility Contract

This document defines the shared data contract and migration policy used by the extension runtime and landing web app surfaces.

## Contract Version

- Contract ID: `rg-cross-surface-compat`
- Contract Revision: `1.0`
- Current backup format version: `3.0`

## Canonical Schema and Data Sources

- Canonical backup schema source: `docs/backup/ranobe-backup.schema.json`
- Landing schema proxy: `landing/schemas/ranobe-backup.schema.json`
- Runtime backup producer/consumer: `src/utils/comprehensive-backup.js`

## Shared Backup Envelope Contract

All cross-surface backup payloads must preserve this top-level envelope:

- `version` (string): backup format version (current `3.0`)
- `type` (string): `library|settings|full|custom`
- `createdAt` (number): unix timestamp ms
- `createdAtISO` (string): ISO-8601 timestamp
- `extensionVersion` (string): extension build version that created backup
- `browser` (string): runtime producer browser
- `data` (object): persisted storage payload

Recommended fields when available:

- `$schema` (string): schema URL
- `chapters` (object): chunked chapter payloads
- `metadata` (object): restore diagnostics and summary

## Compatibility Rules

1. Reader tolerance:
- Readers must ignore unknown fields at all levels.
- Readers must not fail restore only because optional keys are missing.

2. Writer stability:
- Writers must not rename or remove required top-level envelope keys within the same major backup format.
- Writers may add new optional keys without format-major changes.

3. Version interpretation:
- `version` is the backup data-format version and is authoritative for restore compatibility.
- `extensionVersion` is informational and used for diagnostics, not hard rejection.

## Migration Policy

1. Non-breaking changes:
- Adding optional fields or metadata keeps the same backup format major.
- Schema docs should be updated in the same change as runtime producer updates.

2. Breaking changes:
- Removing/renaming required fields or changing required field types requires a backup format major bump.
- Breaking format changes must update all three in one change set:
  - `src/utils/comprehensive-backup.js`
  - `docs/backup/ranobe-backup.schema.json`
  - `landing/schemas/ranobe-backup.schema.json`

3. Backward read support:
- Runtime restore paths should continue supporting at least `current` and `current - 1` format major versions where feasible.
- If older backups are no longer fully restorable, warnings must be surfaced before destructive operations.

## Cross-Surface Validation Checklist

Use this checklist for compatibility-sensitive releases:

1. Export backup from extension and validate required envelope keys exist.
2. Validate payload against `docs/backup/ranobe-backup.schema.json`.
3. Import same payload through each restore path (local restore and cloud restore) and verify library/settings parity.
4. Confirm landing schema proxy still points to the canonical schema path.
5. Confirm restore warnings are actionable for version mismatches.

Automation command:

- `npm run validate:backup-contract`

Related UX parity checklist:

- `docs/ux/CROSS_DEVICE_PARITY_CHECKLIST.md`

Manual restore parity execution checklist:

- `docs/backup/RESTORE_SMOKE_CHECKLIST.md`
