/* Offline-First PWA Service Worker
   - Cache-first for all same-origin assets
   - Navigation fallback to cached index.html
*/

const CACHE_VERSION = "sol-kit-offline-v2-2026-02-26";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./assets/logo.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_VERSION ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const fresh = await fetch(request);
  if (fresh) await cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Navigation fallback
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cachedIndex = await cache.match("./index.html", { ignoreSearch: true });
      try {
        const fresh = await fetch(req);
        if (fresh) await cache.put("./index.html", fresh.clone());
        return fresh;
      } catch (_) {
        return cachedIndex || new Response("Offline and no cached shell found.", { status: 503 });
      }
    })());
    return;
  }

  // Same-origin cache-first
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
  }
});
