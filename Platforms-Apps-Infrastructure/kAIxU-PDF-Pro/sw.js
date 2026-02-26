const CACHE = "kaixu-suite-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./tool.html",
  "./assets/app.css",
  "./assets/app.js",
  "./assets/skyfx.js",
  "./assets/tutorial.js",
  "./assets/kaixuGateway.js",
  "./assets/tools.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (evt) => {
  evt.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evt) => {
  const req = evt.request;
  const url = new URL(req.url);

  if (url.pathname.startsWith("/.netlify/functions/") && req.method !== "GET") return;

  evt.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        if (req.method === "GET" && url.origin === location.origin) {
          caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(() => cached || new Response("Offline", { status: 200 }));
    })
  );
});
