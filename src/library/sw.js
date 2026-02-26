// Service Worker for PWA support in Ranobe Gemini Library
// This enables the library page to be installed as a PWA on mobile browsers

const CACHE_NAME = "rg-library-v1";
const urlsToCache = [
	"library.html",
	"library.css",
	"edit-modal.css",
	"library.js",
	"../icons/icon.png",
];

// Install event - cache resources
self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => {
				console.log("Opened cache");
				return cache.addAll(urlsToCache);
			})
			.catch((err) => {
				console.error("Cache failed:", err);
			}),
	);
});

// Fetch event - serve from cache when offline
self.addEventListener("fetch", (event) => {
	event.respondWith(
		caches.match(event.request).then((response) => {
			// Cache hit - return response
			if (response) {
				return response;
			}
			return fetch(event.request);
		}),
	);
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
	const cacheWhitelist = [CACHE_NAME];
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheWhitelist.indexOf(cacheName) === -1) {
						return caches.delete(cacheName);
					}
				}),
			);
		}),
	);
});
