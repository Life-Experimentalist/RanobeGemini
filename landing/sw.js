const CACHE_NAME = "rg-landing-pwa-v1";
const OFFLINE_URL = "./offline.html";

const CORE_ASSETS = [
	"./index.html",
	"./library-hub.html",
	"./install-guide.html",
	"./offline.html",
	"./styles.css",
	"./script.js",
	"./nav.js",
	"./version.js",
	"./manifest.webmanifest",
	"./assets/og-card.svg",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(CORE_ASSETS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter(
							(key) =>
								key.startsWith("rg-landing-pwa-") &&
								key !== CACHE_NAME,
						)
						.map((key) => caches.delete(key)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	const requestUrl = new URL(request.url);
	if (requestUrl.origin !== self.location.origin) return;

	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const clone = response.clone();
					caches
						.open(CACHE_NAME)
						.then((cache) => cache.put(request, clone));
					return response;
				})
				.catch(() =>
					caches.match(request).then((cached) => {
						if (cached) return cached;
						return caches.match(OFFLINE_URL);
					}),
				),
		);
		return;
	}

	event.respondWith(
		caches.match(request).then((cached) => {
			if (cached) return cached;
			return fetch(request).then((response) => {
				if (response && response.ok) {
					const clone = response.clone();
					caches
						.open(CACHE_NAME)
						.then((cache) => cache.put(request, clone));
				}
				return response;
			});
		}),
	);
});
