/**
 * Offscreen Document Script for Ranobe Gemini
 *
 * This script runs in an offscreen document (Chrome/Edge 109+) and sends
 * periodic messages to keep the service worker alive during long operations.
 *
 * The offscreen document approach is more reliable than alarms because:
 * 1. It doesn't depend on minimum alarm intervals
 * 2. It can send messages more frequently (every 20 seconds)
 * 3. It persists as long as the document exists
 */

const KEEPALIVE_INTERVAL = 20000; // 20 seconds - well under the 30 second timeout
import { debugLog, debugError } from "../utils/logger.js";
/**
 * Send keepalive message to service worker
 * Uses postMessage to the service worker registration
 */
async function sendKeepAlive() {
	try {
		const registration = await navigator.serviceWorker.ready;
		if (registration.active) {
			registration.active.postMessage({
				type: "keepAlive",
				timestamp: Date.now(),
			});
		}
	} catch (error) {
		// Service worker might not be ready yet, that's okay
		debugLog("[Offscreen] Service worker not ready:", error.message);
	}
}

// Start the keepalive interval
debugLog("[Offscreen] Keep-alive document loaded, starting heartbeat...");
setInterval(sendKeepAlive, KEEPALIVE_INTERVAL);

// Send initial keepalive immediately
sendKeepAlive();

// Listen for messages from service worker (for potential commands)
navigator.serviceWorker.addEventListener("message", (event) => {
	if (event.data?.type === "ping") {
		// Respond to ping with pong
		event.source?.postMessage({ type: "pong", timestamp: Date.now() });
	}
});
