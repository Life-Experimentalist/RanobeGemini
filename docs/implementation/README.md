# Implementation Records (Historical)

**Everything in this directory is a historical record of a past implementation
session. None of it is current documentation, and none of it is maintained.**

The titles do not say so — several are phrased as if they were setup guides
("everything you need to properly set up and ship…") — which is why this index
exists. They were accurate when written; some of the code they describe has since
been moved, renamed, or replaced. Read them to understand *why* a decision was
made, not to learn how the system works today.

For how the system works today:

| Question | Read this instead |
| --- | --- |
| How is the extension structured? | [`../architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) |
| How does data move through it? | [`../architecture/DATA_FLOWS.md`](../architecture/DATA_FLOWS.md) |
| How do I build or package it? | [`../../README.md`](../../README.md), [`../build/`](../build/) |
| How do backup and sync work? | [`../backup/`](../backup/) |
| What changed in a release? | [`../release/CHANGELOG.md`](../release/CHANGELOG.md) |
| What is being worked on? | [`../development/PRODUCTION_READINESS_AUDIT.md`](../development/PRODUCTION_READINESS_AUDIT.md), [`../overview/TECHNICAL_ROADMAP.md`](../overview/TECHNICAL_ROADMAP.md) |

## What is in here

| File | Session date | Subject |
| --- | --- | --- |
| [`IMPLEMENTATION_SUMMARY.md`](./IMPLEMENTATION_SUMMARY.md) | Feb 2026 | Google Drive backup — what was delivered, at a high level |
| [`IMPLEMENTATION_COMPLETE.md`](./IMPLEMENTATION_COMPLETE.md) | Feb 2026 | Google Drive backup — OAuth scopes, Cloud Console setup, shipping checklist |
| [`DETAILED_CODE_CHANGES.md`](./DETAILED_CODE_CHANGES.md) | Mar 2026 | Google Drive backup — file-by-file diff narrative with rationale |
| [`IMPLEMENTATION_NOTES.md`](./IMPLEMENTATION_NOTES.md) | Feb 2026 | Novels tab redesign and the library backup/restore merge logic |
| [`METADATA_AND_SETTINGS_GUIDE.md`](./METADATA_AND_SETTINGS_GUIDE.md) | Feb 2026 | Metadata fetcher and per-handler settings — how they were designed to work |
| [`SYSTEMS_IMPLEMENTATION_COMPLETE.md`](./SYSTEMS_IMPLEMENTATION_COMPLETE.md) | Feb 20, 2026 | Session summary for the metadata/settings/modularization work |

The first three all cover the same Google Drive work at three different zoom
levels, written across two sessions a month apart. They are kept separate rather
than merged because a merge would have to pick which of three overlapping
accounts is authoritative, and none of them is — the code is. The OAuth flow as
it actually runs today is diagrammed in
[`../architecture/DATA_FLOWS.md`](../architecture/DATA_FLOWS.md#oauth-flows).

## If you are adding a document here

Don't, unless it is a record of a session that is now finished. Living
documentation belongs in `architecture/`, `guides/`, or `features/`. If you do
add one, date it in the table above and say in its own opening lines that it is
a record, not a guide.
