/* SkyeLeticX PWA Service Worker — network-first navigations, cache-first assets */
const CACHE_NAME = "skyeletix-pwa-20260224063421";

// Precache site shell (static pages + icons + nav JS)
const PRECACHE_URLS = [
  "/404.html",
  "/about.html",
  "/apple-touch-icon.png",
  "/arizona-hq.html",
  "/blog-building-team-chemistry.html",
  "/blog-championship-payouts.html",
  "/blog-first-season.html",
  "/blog-height-verification.html",
  "/blog-media-experience.html",
  "/blog-skills-that-win.html",
  "/blog-team-owner-playbook.html",
  "/blog-why-under-6ft.html",
  "/championships.html",
  "/favicon-16.png",
  "/favicon-32.png",
  "/home.html",
  "/how-it-works.html",
  "/icon-192.png",
  "/icon-512.png",
  "/index.html",
  "/intro.html",
  "/logo.png",
  "/manifest.json",
  "/offline.html",
  "/owner-dashboard.html",
  "/owners-intake.html",
  "/players.html",
  "/robots.txt",
  "/sitemap.html",
  "/sitemap.xml",
  "/skyeletes-editorial.html",
  "/sw.js",
  "/assets/global-nav.js"
];

const ROUTE_MAP = {
  "/home": "/home.html",
  "/app": "/home.html",
  "/about": "/about.html",
  "/how-it-works": "/how-it-works.html",
  "/championships": "/championships.html",
  "/players": "/players.html",
  "/owners": "/owners-intake.html",
  "/editorial": "/skyeletes-editorial.html",
  "/arizona-hq": "/arizona-hq.html",
  "/blog": "/skyeletes-editorial.html",
  "/blog/team-owner-playbook": "/blog-team-owner-playbook.html",
  "/blog/first-season": "/blog-first-season.html",
  "/blog/why-under-6ft": "/blog-why-under-6ft.html",
  "/blog/media-experience": "/blog-media-experience.html",
  "/blog/height-verification": "/blog-height-verification.html",
  "/blog/building-team-chemistry": "/blog-building-team-chemistry.html",
  "/blog/championship-payouts": "/blog-championship-payouts.html",
  "/blog/skills-that-win": "/blog-skills-that-win.html",
  "/sitemap": "/sitemap.html"
};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

function normalizeNavPath(pathname) {
  // strip trailing slash except for root
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Network-first for page navigations so new deploys show immediately (prevents stale "/" bugs)
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const path = normalizeNavPath(url.pathname);

      // Map clean URLs to their HTML equivalents (useful offline)
      const mapped = ROUTE_MAP[path];
      const navUrl = mapped ? new URL(mapped, url.origin).toString() : req.url;

      try {
        const fresh = await fetch(navUrl, { cache: "no-store" });
        // Cache the latest copy of the navigated page
        const cache = await caches.open(CACHE_NAME);
        cache.put(navUrl, fresh.clone());
        return fresh;
      } catch (err) {
        // Offline fallback
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(navUrl) || await cache.match("/index.html") || await cache.match("/offline.html");
        return cached || Response.error();
      }
    })());
    return;
  }

  // Cache-first for static assets
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // Only cache OK same-origin GET responses
      if (req.method === "GET" && res && res.ok) {
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      // If asset fetch fails, provide offline page for HTML requests
      if (req.headers.get("accept") && req.headers.get("accept").includes("text/html")) {
        return (await cache.match("/offline.html")) || Response.error();
      }
      return Response.error();
    }
  })());
});
