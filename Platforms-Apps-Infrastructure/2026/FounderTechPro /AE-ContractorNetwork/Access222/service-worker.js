const CACHE = "skyesol-access-222-f500-v2";
const BASE = "/access-222/";
const ASSETS = [
  BASE,
  `${BASE}index.html`,
  `${BASE}offline.html`,
  `${BASE}404.html`,
  `${BASE}robots.txt`,
  `${BASE}sitemap.xml`,
  `${BASE}buildInfo.json`,
  `${BASE}assets/app.js`,
  `${BASE}manifest.json`,
  `${BASE}service-worker.js`,
  `${BASE}assets/site.css`,
  `${BASE}assets/site.js`,
  `${BASE}assets/sky3d.js`,
  `${BASE}assets/logo.png`,
  `${BASE}assets/icon-192.png`,
  `${BASE}assets/icon-512.png`,
  `${BASE}services/access-222/`,
  `${BASE}services/access-222/index.html`,
  `${BASE}checkout/`,
  `${BASE}checkout/index.html`,
  `${BASE}thanks/`,
  `${BASE}thanks/index.html`,
  `${BASE}ae/`,
  `${BASE}ae/index.html`,
  `${BASE}ae/portal/`,
  `${BASE}ae/portal/index.html`,
  `${BASE}ae/portal/portal.js`,
  `${BASE}ae/sop/`,
  `${BASE}ae/sop/index.html`,
  `${BASE}ae/sop/sop.js`
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => (key === CACHE ? null : caches.delete(key))))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(`${BASE}index.html`)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached)
    )
  );
});
