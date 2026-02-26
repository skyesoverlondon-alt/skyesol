/* Business Launch Kit (AZ) Pack — service worker */
const CACHE = "blk-az-BLK-AZ-P13.1-v1.1.0";
const ASSETS = [
  "/",
  "/index.html",
  "/assets/svs.css",
  "/assets/app.js",
  "/assets/zip.js",
  "/assets/logo.png",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE) ? caches.delete(k) : Promise.resolve()));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only cache same-origin GETs
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    // Try cache-first for app shell
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      // Cache basic assets opportunistically
      if (fresh && fresh.status === 200 && (req.destination === "script" || req.destination === "style" || req.destination === "image" || req.destination === "document")) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      // Offline fallback to index for navigations
      if (req.mode === "navigate") {
        const shell = await cache.match("/index.html");
        if (shell) return shell;
      }
      throw e;
    }
  })());
});
