const CACHE_VERSION = "v2";
const CACHE_NAME = `rg-landing-pwa-${CACHE_VERSION}`;
const RUNTIME_CACHE = `rg-landing-runtime-${CACHE_VERSION}`;
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
			.then(
				() =>
					self.registration?.navigationPreload?.enable?.() ||
					Promise.resolve(),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("message", (event) => {
	if (event?.data?.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});

function isCoreAsset(requestUrl) {
	const pathname = requestUrl.pathname;
	return CORE_ASSETS.some((asset) =>
		pathname.endsWith(asset.replace("./", "/")),
	);
}

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;
	if (request.cache === "only-if-cached" && request.mode !== "same-origin")
		return;

	const requestUrl = new URL(request.url);
	if (requestUrl.origin !== self.location.origin) return;

	if (request.mode === "navigate") {
		event.respondWith(
			(async () => {
				try {
					const preloadResponse = await event.preloadResponse;
					if (preloadResponse) {
						const cache = await caches.open(RUNTIME_CACHE);
						cache.put(request, preloadResponse.clone());
						return preloadResponse;
					}

					const networkResponse = await fetch(request);
					if (networkResponse && networkResponse.ok) {
						const cache = await caches.open(RUNTIME_CACHE);
						cache.put(request, networkResponse.clone());
					}
					return networkResponse;
				} catch (_err) {
					const cached = await caches.match(request);
					if (cached) return cached;
					return caches.match(OFFLINE_URL);
				}
			})(),
		);
		return;
	}

	event.respondWith(
		(async () => {
			const fromCache = await caches.match(request);
			if (fromCache) {
				if (isCoreAsset(requestUrl)) {
					fetch(request)
						.then(async (response) => {
							if (response && response.ok) {
								const cache = await caches.open(CACHE_NAME);
								cache.put(request, response.clone());
							}
						})
						.catch(() => {
							// Silent stale-while-revalidate failure.
						});
				}
				return fromCache;
			}

			const response = await fetch(request);
			if (response && response.ok) {
				const targetCache = isCoreAsset(requestUrl)
					? CACHE_NAME
					: RUNTIME_CACHE;
				const cache = await caches.open(targetCache);
				cache.put(request, response.clone());
			}
			return response;
		})(),
	);
});
