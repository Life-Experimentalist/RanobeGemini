# Restore Smoke Checklist (Phase 8-U2)

Use this checklist to complete the remaining manual parity verification across extension and web-entry surfaces.

## Test Matrix

| Surface           | Browser          | Status    | Tester | Date | Notes |
| ----------------- | ---------------- | --------- | ------ | ---- | ----- |
| Extension runtime | Firefox Desktop  | ☐ Pending |        |      |       |
| Extension runtime | Chromium Desktop | ☐ Pending |        |      |       |
| Extension runtime | Firefox Android  | ☐ Pending |        |      |       |
| Landing/PWA entry | Chromium Mobile  | ☐ Pending |        |      |       |

## Preconditions

1. Build and load latest extension package for target browser.
2. Ensure Google Drive credentials are valid for test account.
3. Keep one known-good backup fixture available for import.

## Test Cases

### Case 1: Local Backup Import (Replace)

1. Open Library settings backup section.
2. Import backup file from local disk.
3. Use replace mode.
4. Verify novel count and key settings after restore.

Expected:

- Restore completes without fatal errors.
- Library and settings match imported payload.
- No schema mismatch warnings for valid payload.

### Case 2: Local Backup Import (Merge)

1. Prepare existing library data and import same fixture.
2. Use merge mode.
3. Verify records merge without wiping unrelated entries.

Expected:

- Merge preserves existing unrelated records.
- Duplicate entries resolve according to existing merge behavior.

### Case 3: Drive Restore (Latest)

1. Connect Google Drive sync.
2. Trigger restore from latest Drive backup.
3. Reload library page.

Expected:

- Latest backup is discovered and restored.
- Restored data matches Drive payload.

### Case 4: Drive Restore (Continuous)

1. Set backup mode to continuous (or both).
2. Trigger continuous restore path.
3. Verify final state and sync metadata.

Expected:

- Continuous backup file resolves correctly.
- Restore completes and data is usable immediately.

### Case 5: Landing to Extension Recovery Handoff

1. Open landing page and verify extension detection.
2. Launch library from landing button.
3. Run one restore action from opened library.

Expected:

- Handoff does not break restore workflow.
- User can reach restore flows from web entry without dead ends.

## Result Summary

- Overall verdict: ☐ Pass ☐ Partial ☐ Fail
- Blocking issues:
- Follow-up owner:
