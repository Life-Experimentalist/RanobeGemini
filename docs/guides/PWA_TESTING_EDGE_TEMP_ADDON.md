# PWA Testing Guide (Edge + Temporary Extension Add-on)

This guide helps verify Ranobe Gemini Web PWA behavior while you are testing the extension as a temporary/sideload add-on in Edge.

## Goal

Validate that:
- The landing web app installs and launches correctly.
- Offline fallback works.
- Service worker updates apply cleanly.
- Extension detection and "Open Library" behavior work as expected in temporary add-on mode.

## Important Constraint

A temporary/sideload extension can have changing IDs between reloads.
That means direct ID-based detection can fail after reloading/unpacking again.
The current landing page uses both ping-based and ID-based checks, so ping path is the reliable one in temp mode.

## Test Matrix

### 1. Installability and Manifest

1. Open landing index on HTTPS or localhost.
2. In Edge address bar, check for install app icon.
3. Install the app.
4. Confirm app opens with standalone window at library hub start URL.
5. In DevTools Application > Manifest, verify:
   - name and short_name present
   - start_url points to library-hub
   - icons load successfully

Pass criteria:
- App installs without manifest errors.
- Launches in standalone window.

### 2. Service Worker and Offline

1. Open DevTools > Application > Service Workers.
2. Confirm sw.js is active and running.
3. With app open, switch network to Offline.
4. Refresh the app and navigate to a cached page.
5. Navigate to an uncached route and verify offline page fallback.

Pass criteria:
- Cached pages load offline.
- Offline fallback page appears for uncached navigation.

### 3. Service Worker Update Flow

1. Keep app open with DevTools > Service Workers.
2. Make a small change to sw.js cache version (or rebuild when version changed).
3. Reload page.
4. Confirm waiting worker activates (skip waiting path).
5. Confirm page refreshes once and new worker controls page.

Pass criteria:
- No infinite reload loop.
- New SW version takes control cleanly.

### 4. Extension Detection in Temp Add-on Mode

1. Load temporary extension in Edge from built output folder.
2. Open landing library hub page.
3. Verify "Open Library" button becomes visible.
4. Click Open Library and confirm extension library opens.
5. Reload extension (temporary add-on refresh) and repeat.

Pass criteria:
- Ping-based detection succeeds after fresh load.
- Library button works after extension reload.

### 5. Deep-Link and Recovery Sanity

1. Open library deep link like `library/websites/<site>/index.html?novel=<id>&openModal=1`.
2. Verify modal opens if novel exists.
3. Test missing novel ID link.
4. Verify recovery prompt appears and can rehydrate entry.

Pass criteria:
- Existing novel opens directly.
- Missing novel flow recovers correctly.

## Edge DevTools Quick Checklist

Use these panels:
- Application > Manifest
- Application > Service Workers
- Application > Cache Storage
- Network (Offline toggle)

Watch for:
- Manifest icon 404 errors
- SW install/activate errors
- Failed cache puts
- Repeated controllerchange reloads

## Production-Readiness Exit Criteria (v4.7.0 target)

- PWA install works on Edge stable.
- Offline fallback works on at least index + library hub routes.
- SW update flow is stable in 3 consecutive update tests.
- Temporary add-on extension detection works after reload cycles.
- No console errors in landing pages during install and offline tests.

## Recommended Command Flow Before Each Test Round

```powershell
npm run lint
npm run build
npm run package
```

Then reload temporary extension in Edge and re-run the matrix above.
