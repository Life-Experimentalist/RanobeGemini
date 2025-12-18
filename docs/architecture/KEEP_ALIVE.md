# Keep-Alive Architecture

## Overview

The Ranobe Gemini extension implements a three-layer keep-alive system to maintain persistent background functionality in modern browser environments, particularly Chrome's Manifest V3 which terminates service workers after 30 seconds of inactivity.

## Architecture Layers

### Layer 1: Offscreen Document (`src/background/offscreen.js`)

**Purpose**: Primary keep-alive mechanism for Chrome MV3 service workers

**Mechanism**:
- Creates an invisible offscreen document that persists alongside the service worker
- Sends periodic `postMessage` heartbeats to the service worker
- Interval: **20 seconds** (`KEEPALIVE_INTERVAL = 20000`)

**Implementation**:
```javascript
const KEEPALIVE_INTERVAL = 20000; // 20 seconds

function sendKeepAlive() {
    chrome.runtime.sendMessage({ type: 'keepalive' })
        .catch(() => { /* Service worker may be inactive */ });
}

setInterval(sendKeepAlive, KEEPALIVE_INTERVAL);
```

**Why 20 seconds?**
- Chrome MV3 service workers terminate after 30s of inactivity
- 20s interval provides a 10s safety buffer
- Prevents aggressive reconnection attempts

---

### Layer 2: Background Service Worker (`src/background/background.js`)

**Purpose**: Alarm-based keep-alive and port management

**Mechanisms**:

#### A. Alarm API
- Schedules periodic wakeup events for the service worker
- Interval: **30 seconds minimum** for Chrome
- Configurable via `KEEP_ALIVE_INTERVAL_MINUTES` (default: 0.5 minutes = 30s)

```javascript
const KEEP_ALIVE_ALARM_NAME = "rg-keepalive";
const KEEP_ALIVE_INTERVAL_MINUTES = 0.5; // 30 seconds

function setupKeepAliveAlarm() {
    chrome.alarms.create(KEEP_ALIVE_ALARM_NAME, {
        periodInMinutes: KEEP_ALIVE_INTERVAL_MINUTES
    });
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === KEEP_ALIVE_ALARM_NAME) {
        console.log('[Background] Keep-alive alarm triggered');
    }
});
```

#### B. Port Listener
- Accepts long-lived port connections from content scripts
- Port name: `"rg-keepalive"`
- Listens for heartbeat messages from content scripts

```javascript
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === KEEP_ALIVE_PORT_NAME) {
        port.onMessage.addListener((msg) => {
            if (msg.type === 'heartbeat') {
                // Keep-alive ping received
            }
        });
    }
});
```

---

### Layer 3: Content Script (`src/content/content.js`)

**Purpose**: Long-lived port connection with heartbeat pings

**Mechanism**:
- Establishes persistent port connection to background script
- Sends periodic heartbeat messages
- Interval: **20 seconds** (`HEARTBEAT_INTERVAL = 20000`)
- Port name: `"rg-keepalive"`

**Implementation**:
```javascript
const KEEP_ALIVE_PORT_NAME = "rg-keepalive";
const HEARTBEAT_INTERVAL = 20000; // 20 seconds

let keepAlivePort = null;
let heartbeatTimer = null;

function startKeepAlivePort() {
    try {
        keepAlivePort = browser.runtime.connect({ name: KEEP_ALIVE_PORT_NAME });

        keepAlivePort.onDisconnect.addListener(() => {
            console.log('[Content] Keep-alive port disconnected, reconnecting...');
            stopKeepAlivePort();
            setTimeout(startKeepAlivePort, 1000);
        });

        // Send periodic heartbeats
        heartbeatTimer = setInterval(() => {
            if (keepAlivePort) {
                keepAlivePort.postMessage({ type: 'heartbeat' });
            }
        }, HEARTBEAT_INTERVAL);

    } catch (error) {
        console.error('[Content] Failed to establish keep-alive port:', error);
    }
}

function stopKeepAlivePort() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    if (keepAlivePort) {
        keepAlivePort.disconnect();
        keepAlivePort = null;
    }
}
```

**Auto-Reconnection**:
- Automatically reconnects on port disconnect
- 1-second delay before reconnection attempt
- Prevents rapid reconnection loops

---

## Why Three Layers?

1. **Redundancy**: Multiple mechanisms ensure at least one keep-alive path remains active
2. **Browser Compatibility**: Different browsers handle service worker lifecycle differently
3. **Context Coverage**: Covers all execution contexts (offscreen, background, content)
4. **Graceful Degradation**: If one layer fails, others continue functioning

## Timing Considerations

| Layer | Interval | Reason |
|-------|----------|--------|
| Offscreen | 20s | Below Chrome's 30s termination threshold |
| Background Alarm | 30s | Chrome's minimum alarm interval |
| Content Script | 20s | Matches offscreen timing, ensures frequent pings |

All intervals are deliberately set below Chrome MV3's 30-second service worker timeout.

## Browser Differences

### Chrome (Manifest V3)
- Service workers terminate after 30s inactivity
- Requires offscreen document + alarm API
- All three layers active

### Firefox
- Event pages more persistent than Chrome service workers
- Alarm intervals configurable (can be less than 30s)
- Primarily relies on background alarm + content port

## Lifecycle

### Extension Startup
1. Background service worker loads
2. `setupKeepAliveAlarm()` creates alarm
3. Offscreen document created (Chrome only)
4. Content scripts inject on compatible pages
5. Content scripts establish port connections

### Normal Operation
- **Every 20s**: Offscreen sends postMessage
- **Every 20s**: Content scripts send heartbeat
- **Every 30s**: Background alarm fires
- All messages prevent service worker termination

### Page Navigation
- Content script may be destroyed
- Port disconnects
- Auto-reconnection after 1s delay

### Extension Update/Reload
- All connections severed
- Alarm cleared
- System reinitializes on next startup

## Debugging

### Console Messages
```javascript
// Offscreen
[Offscreen] Keep-alive heartbeat sent

// Background
[Background] Keep-alive alarm triggered
[Background] Heartbeat received from content script

// Content
[Content] Keep-alive port established
[Content] Keep-alive port disconnected, reconnecting...
```

### Common Issues

1. **Service Worker Still Terminating**
   - Check if offscreen document is created successfully
   - Verify alarm permissions in `manifest.json`
   - Ensure content scripts are injecting properly

2. **Port Connection Failures**
   - Content Security Policy blocking connections
   - Background script not listening for port connections
   - Extension context invalidated

3. **Excessive Reconnections**
   - Check for rapid port disconnect/reconnect loops
   - Verify 1s reconnection delay is in place
   - Look for errors in port message handling

## Related Files

- `src/background/offscreen.js` - Offscreen document keep-alive
- `src/background/offscreen.html` - Offscreen document HTML
- `src/background/background.js` - Alarm + port listener
- `src/content/content.js` - Content script port connection
- `src/manifest.json` - Permissions and background configuration

## Permissions Required

```json
{
  "permissions": [
    "alarms",      // Background alarm API
    "offscreen"    // Offscreen document (Chrome only)
  ]
}
```

## Future Improvements

1. **Dynamic Interval Adjustment**: Adapt keep-alive frequency based on user activity
2. **Battery Optimization**: Reduce frequency when device is on battery power
3. **Selective Activation**: Only activate keep-alive when background tasks are needed
4. **Telemetry**: Track keep-alive effectiveness and service worker uptime
