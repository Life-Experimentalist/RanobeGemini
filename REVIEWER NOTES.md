# Notes for add-on store reviewers

The extension is plain JavaScript, HTML, and CSS. There is no minification,
bundling, obfuscation, or transpilation anywhere in the pipeline — every file in
the submitted package is byte-identical to the corresponding file in `src/`,
apart from the generated files listed under "What the build does" below. You can
diff the package against the source archive to confirm this.

## Prerequisites

- Node.js 22 or newer (CI builds on 24, the Active LTS line)
- npm 10 or newer

No other toolchain is needed. No native modules, no Python, no Docker.

## Build steps

```
npm ci
npm run package
```

That produces both store packages under `releases/`:

- `releases/RanobeGemini_v<version>_firefox.zip` — for AMO
- `releases/RanobeGemini_v<version>_chromium.zip` — for Chrome Web Store and
  Edge Add-ons

Both are Manifest V3. They differ only in the manifest: Firefox gets
`browser_specific_settings` and `sidebar_action` with a background `scripts`
array; Chromium gets `side_panel` with a `service_worker`. The code is identical
between the two, with `webextension-polyfill` smoothing over the API
differences.

The version number comes from `package.json`; it is injected into both manifests
at build time rather than maintained in three places.

To reproduce the source archive submitted alongside the Firefox package:

```
npm run package:source
```

## What the build does

`dev/build.js` is the entire build. It:

1. Scans `src/utils/website-handlers/*-handler.js` and generates two things from
   them — `src/utils/website-handlers/handler-registry.js`, and the `matches`
   patterns in both manifests. This is why supported-site lists are never edited
   by hand. (`dev/generate-manifest-domains.js`.)
2. Copies `src/` into `dist/dist-firefox/` and `dist/dist-chromium/`, selecting
   the matching manifest for each and dropping the store-listing authoring pages
   under `src/icons/` that are not part of the shipped extension.
3. Substitutes build-time configuration placeholders in
   `src/utils/constants.js` — see "Build-time values" below.
4. Zips each `dist/` directory into `releases/`.

## Build-time values

Three constants are empty in the source and filled in from environment
variables at build time, so that credentials are not committed to a public
repository:

| Constant | Environment variable | Purpose |
|---|---|---|
| `DEFAULT_DRIVE_CLIENT_ID` | `RG_DRIVE_CLIENT_ID` | Google Drive OAuth client ID for the optional backup feature |
| `DEFAULT_DRIVE_CLIENT_SECRET` | `RG_DRIVE_CLIENT_SECRET` | Paired secret for the same client |
| `TELEMETRY_ENDPOINT` | `RG_TELEMETRY_ENDPOINT` | Endpoint for opt-in anonymous usage counts |

All three are optional. With none of them set the build succeeds and the
extension runs; the Google Drive sync option asks the user for their own OAuth
client, and telemetry has nowhere to send to. `.env.example` documents the
format. This means **you can reproduce a functionally complete build without any
credentials from us** — the resulting package differs from the published one only
in those three string literals.

## Network access

The extension talks to:

- The AI provider the user configured, with the user's own API key — Google
  Gemini, any OpenAI-compatible endpoint, or a local Ollama instance. There is no
  intermediary server of ours.
- The cloud storage provider the user configured for optional backup — Google
  Drive, OneDrive, Dropbox, any WebDAV server, or the browser's own built-in
  sync. Optional; off by default.
- The supported novel sites themselves, as content scripts on pages the user is
  already viewing.

There is no first-party backend. Chapter text, library contents, reading
history, and API keys stay in `browser.storage.local` and are never transmitted
anywhere except to the provider the user chose.

Anonymous usage telemetry is **off by default** and requires the user to turn it
on; see Library Settings -> Analytics & Diagnostics for the exact list of what is
and is not sent.

## Verification

```
npm run lint
npm test
```

The same checks run in CI (`.github/workflows/ci.yml`) on every push and pull
request, and a release tag cannot publish without passing them.
