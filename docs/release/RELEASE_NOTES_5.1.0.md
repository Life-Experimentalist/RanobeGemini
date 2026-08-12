# Ranobe Gemini v5.1.0 Release Notes

Release date: August 12, 2026
Branch: main
Status: Stable

---

## Overview

v5.1.0 is the result of a full production-readiness audit of the extension —
every manifest, every message handler, every website handler, the library app,
the build system, the CI, and the documentation. It is a smaller release than
5.0.0 in new surface area and a much larger one in things that were quietly
broken.

Two features are genuinely new: an opt-in encrypted backup format, and a
reading typeface you can choose that ships inside the extension. Everything else
is correctness — including one defect that was corrupting the text of every
Ranobes chapter before it ever reached the model, and one that deleted the wrong
entry when you removed a custom Story Chat type.

One thing was taken away on purpose. 5.0.0 presented LoreWeave as a headline
feature; its content-side integration was not actually wired up. Rather than
leave the claim standing, it is now behind an explicit opt-in and documented as
experimental everywhere it is mentioned.

Quick summary:

- Opt-in encrypted backups (AES-GCM-256), key held on the machine, recovery code
  for moving between browsers
- A reading typeface you can choose — Literata, Merriweather, Atkinson
  Hyperlegible or Inter, all bundled, nothing fetched while you read
- Every Ranobes chapter was being silently mangled before enhancement; fixed
- The five per-site shelf pages are unified behind one shared core
- Story Chat settings now actually take effect — every toggle was previously
  written to storage and read by nothing
- LoreWeave is experimental and off by default, matching what it actually does
- Default model is now Gemini 3 Flash Preview
- A CI quality gate exists, and a tag can no longer reach the add-on stores
  without passing it
- The extension's permissions were narrowed, its CSP tightened, and its
  landing-page message channel closed to arbitrary senders
- 269 tests where there were none, run on every push and pull request

---

## Major Features

### 1. Opt-in encrypted backups

What changed:

- Library -> Settings -> Local Backups -> *Encrypt backup files* wraps exported
  files and cloud backups (Drive, OneDrive, Dropbox, WebDAV) in an authenticated
  AES-GCM-256 envelope.
- The 256-bit key is generated on your machine and never leaves it. A
  Crockford-base32 recovery code carries it to another browser.
- Plaintext export remains the default. Import auto-detects the envelope, and
  backups made before this existed still restore.

Why this matters:

- A backup contains your entire reading history and, depending on your settings,
  chapter text. Cloud backup means that file sits in a third-party account.
- The recovery code exists because `browser.storage.sync` rides your Firefox or
  Chrome account and never crosses between them — without it, encrypting would
  strand your own backups.

Deliberately excluded: native browser sync. It writes to
`browser.storage.sync`, which is where the key lives, so encrypting there would
be decorative rather than protective.

### 2. A reading typeface, bundled

What changed:

- Library -> Settings -> General -> Reading Text offers a typeface for enhanced
  chapter text: Literata, Merriweather, Atkinson Hyperlegible or Inter, all
  shipped inside the extension, plus Georgia, your system's own sans, and the
  site's default for anyone who wants no change at all.
- ScribbleHub and Ranobes can override the choice for that site alone.
- Nothing is downloaded while you read.

Why these four, honestly: there is no font that is simply read faster than
another. Each is described by what it was drawn for — Literata for long-form
screen reading, Merriweather for a large x-height, Atkinson Hyperlegible for
pulling `I`, `l` and `1` apart, Inter for open apertures on screens — and the
choice is left to you, whose own familiarity with a face matters more than any
of it.

Every bundled family is SIL Open Font License 1.1; the licence text ships beside
the files, and the fetch script refuses to write a family whose licence it
cannot verify.

### 3. The five shelf pages are one shelf page

What changed:

- AO3, FanFiction, NovelBin, Ranobes, ScribbleHub and WebNovel shelves now share
  `shelf-core.js` with per-site configuration, so each site keeps only the
  fields it actually has.

Why this matters:

- They were five copies of the same page that had drifted apart. A filtering fix
  landed in one and not the others, and which shelf you were on decided whether
  you got it. Now a fix lands once.

---

## Stability and Correctness Fixes

These are the ones with visible consequences.

**Every Ranobes chapter was corrupted before it reached the model.** The
ad-stripping pass carried the pattern `/\[?\s*ad\s*\]?/gi`. Every part of that
expression except the literal `ad` is optional, and it has no anchors — so it
matched those two letters *anywhere in the text*. "He had already walked the
road ahead, shadowed and afraid." came out as "He halrey walked the roahe,
showed and afraid." The same flaw deleted the words "advertisement" and
"sponsored" out of ordinary prose. Fixed with anchored patterns and pinned by a
regression test that names the old expression.

**Deleting a custom Story Chat box type removed the wrong one.** The index came
from `+a?.b ?? +c` — and unary `+` binds tighter than `??`, so that expression is
`NaN ?? …`, which is `NaN`. The fallback was unreachable, and the resulting
`splice(NaN, 1)` deleted the *first* entry instead of the one you clicked.

**FanFiction chapters were titled wrong.** `BaseHandler.extractContent()` read
`document.title` instead of calling `extractTitle()`, which made every
subclass's override dead code — so the FanFiction handler's logic for digging
the story name out of the page never ran, and chapters were titled
"Story, a fandom fanfic | FanFiction". It also read text off the live element
rather than the cleaned copy, so scripts and ad slots inside the content area
went straight to the model.

**AO3 counted every chapter twice** on a full-work page, because AO3 nests a
preface block inside every chapter block. Reported chapter counts were double,
and a single-chapter work opened with `?view_full_work=true` took the wrong
extraction path.

**A circular import worked only by alphabetical luck.** The FanFiction handler
reached the handler registry through its own imports; the cycle throws whenever
that handler is the first module in the ring to be evaluated, which never
happened in the shipped extension only because another handler happened to sort
first. Any import-order change would have broken FanFiction outright.

**Timers outlived the pages that started them.** The worst was a background
heartbeat sitting just under Chromium's service-worker idle timeout, pinning the
worker awake for the entire browser session — to write a debug line one time in
ten. WebNovel's infinite-scroll monitors also ran on every other supported site.

**Story Chat settings did nothing.** Context sources, history depth and the
LoreWeave gate are honoured now. The web-search toggle, which had no
implementation behind it at all, was removed rather than left to imply a feature
that does not exist.

**Telemetry consent misstated the default**, telling users analytics was
"enabled by default" when it defaults to off. The dialog could not be opened
anyway; its disclosure moved to Library Settings -> Analytics & Diagnostics.

---

## Security and Privacy

- `externally_connectable` accepted messages from any page on the landing
  domain, and the message handler did not verify the sender. Both narrowed and
  checked.
- OAuth flows did not validate the `state` parameter on return.
- Several `innerHTML` sinks took values that can carry site-controlled text;
  they route through a shared escaping helper now.
- CSP tightened on both manifests, and the landing site's inline handlers moved
  into files so its own CSP could tighten too.
- Manifest permissions narrowed to what the extension actually uses.
- The landing site self-hosts its fonts and icons instead of hot-linking them,
  which also makes its "no third-party requests" claim true.
- The debug panel is removed; it was dead code that shipped in the package.

---

## Build, CI, and Tooling

- **A CI quality gate now exists.** Lint, format check, tests, emoji scan,
  backup-contract validation, and a both-target build run on every push to
  `main` and every pull request. The store-submission workflow consumes it as a
  gate, so a tag can no longer reach AMO or the Chrome Web Store without passing.
- **CI was building on an end-of-life runtime.** Every workflow pinned Node 20,
  which reached end-of-life in April 2026. All workflows now use Node 24, the
  Active LTS line, and the minimum supported Node is 22.13.0.
- **Dependabot now watches npm and the GitHub Actions versions.** There was no
  configuration at all, which is how the Node line reached end-of-life
  unnoticed.
- **ESLint 8 -> 10** on flat config, which found two of the bugs listed above.
- **269 tests**, where the repository previously had no test runner, no config
  and no spec files.
- **Release zips are no longer committed.** 676 MB of build artifacts lived at
  HEAD, paid for by every clone. They are GitHub Release assets now, and every
  historical version has been back-filled, so no download link is lost.

---

## Upgrade Notes

- Nothing is required of you. Settings, library data and existing backups carry
  over unchanged.
- **If you used LoreWeave**, it is now off by default. Turn it on again at
  Settings -> Advanced -> Experimental. It is labelled experimental because its
  integration was incomplete in 5.0.0, not because it changed.
- **The Story Chat web-search toggle is gone.** It never did anything.
- **The default model is Gemini 3 Flash Preview**, with Gemini 2.5 Flash as the
  fallback. An explicitly chosen model is not changed.
- Building from source now requires Node 22 or newer.

---

## Documentation Updated

- `README.md`, `REVIEWER NOTES.md` — the build instructions did not work: wrong
  script names, a step that does not exist, and a manifest path with no file
  behind it. Both now describe the real pipeline.
- `docs/development/PRODUCTION_READINESS_AUDIT.md` — new; the working record of
  every finding, including the ones that turned out to be wrong on
  investigation, corrected in place rather than deleted.
- `docs/architecture/DATA_FLOWS.md` — new.
- `docs/implementation/` — declared historical, with each file dated. Several
  read as current guides while being stale since February.
- `docs/release/CHANGELOG.md` — full entry for this release.

---

## Support

- Issues: https://github.com/Life-Experimentalist/RanobeGemini/issues
- Source: https://github.com/Life-Experimentalist/RanobeGemini

---

# Ranobe Gemini v5.1.0 — Quick Release Notes

Release date: August 12, 2026

A correctness release. Two new features, one feature honestly demoted, and a
long list of things that were quietly broken.

## What Is New

- **Encrypted backups, if you want them.** Turn on *Encrypt backup files* in
  Library -> Settings -> Local Backups and your exports and cloud backups are
  wrapped in AES-GCM-256. The key stays on your machine; a recovery code moves
  it to another browser. Off by default, and old backups still restore.
- **Choose your reading typeface.** Literata, Merriweather, Atkinson
  Hyperlegible or Inter — all bundled with the extension, so nothing is
  downloaded while you read — plus Georgia, your system sans, or no change at
  all. ScribbleHub and Ranobes can override it per site.
- **Gemini 3 Flash Preview is the new default model**, with 2.5 Flash as
  fallback.

## Fixes

- **Ranobes chapters were being mangled before enhancement.** An ad-stripping
  rule matched the letters "ad" anywhere in the text, so "he had already" became
  "he halrey". Every Ranobes chapter was affected.
- **Deleting a custom Story Chat type removed the wrong one** — sometimes the
  first in the list instead of the one you clicked.
- **FanFiction chapters were saved with the browser tab's title** instead of the
  story name.
- **AO3 reported double the real chapter count** on full-work pages.
- **Story Chat settings did nothing.** Every toggle was saved and then ignored.
- **A background timer kept the extension awake for your whole browser
  session**, to write one debug line in ten.
- Permissions narrowed, CSP tightened, and the landing-page message channel
  closed to arbitrary senders.

## Changed

- **LoreWeave is now experimental and off by default.** 5.0.0 shipped it as a
  headline feature while it was not actually connected. Re-enable it at
  Settings -> Advanced -> Experimental.
- The Story Chat web-search toggle is removed; it had no implementation.
- The five per-site shelf pages are now one shared page, so a fix lands
  everywhere at once.

## Learn More

- Full notes: `docs/release/RELEASE_NOTES_5.1.0.md`
- Changelog: `docs/release/CHANGELOG.md`
