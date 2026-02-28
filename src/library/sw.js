// Service Worker for PWA support in Ranobe Gemini Library
// Provides offline caching for the library page so it works as a PWA

const CACHE_VERSION = "v4";
const CACHE_NAME = `rg-library-${CACHE_VERSION}`;
const OFFLINE_URL = "library.html";

const CORE_ASSETS = [
	"library.html",
	"library.css",
	"library.js",
	"edit-modal.css",
	"edit-modal.js",
	"manifest.webmanifest",
	"../icons/icon.png",
	"../lib/browser-polyfill.min.js",
];

// Install: pre-cache core assets, activate immediately
self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) =>
				cache.addAll(CORE_ASSETS).catch((err) => {
					console.warn("[SW] Some assets failed to pre-cache:", err);
				}),
			)
			.then(() => self.skipWaiting()),
	);
});

// Activate: remove old caches, claim all clients immediately
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter(
							(k) =>
								k.startsWith("rg-library-") && k !== CACHE_NAME,
						)
						.map((k) => {
							console.log("[SW] Removing old cache:", k);
							return caches.delete(k);
						}),
				),
			)
			.then(() => self.clients.claim()),
	);
});

// Fetch: stale-while-revalidate for assets, network-first for navigation
self.addEventListener("fetch", (event) => {
	const { request } = event;

	// Only handle GET requests from same origin
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (request.mode === "navigate") {
		// Network-first for page navigation; fall back to cached offline page
		event.respondWith(
			fetch(request)
				.then((response) => {
					if (response.ok) {
						const clone = response.clone();
						caches
							.open(CACHE_NAME)
							.then((cache) => cache.put(request, clone));
					}
					return response;
				})
				.catch(() =>
					caches
						.match(OFFLINE_URL)
						.then((cached) => cached || Response.error()),
				),
		);
	} else {
		// Stale-while-revalidate for static assets
		event.respondWith(
			caches.open(CACHE_NAME).then((cache) =>
				cache.match(request).then((cached) => {
					const networkFetch = fetch(request)
						.then((response) => {
							if (response.ok) {
								cache.put(request, response.clone());
							}
							return response;
						})
						.catch(() => cached);
					// Return cached immediately if available, otherwise wait for network
					return cached || networkFetch;
				}),
			),
		);
	}
});
