/* ═══════════════════════════════════════════
   SOLEnterprises Service Worker
   Cache strategy:
   - Static assets (css/js/fonts) → Cache First
   - HTML pages                   → Network First with offline fallback
   - API calls (/.netlify/)       → Network Only
═══════════════════════════════════════════ */

const CACHE_NAME = 'sol-v2';
const OFFLINE_URL = '/404.html';

const PRECACHE = [
  '/',
  '/index.html',
  '/about.html',
  '/blog.html',
  '/platforms.html',
  '/network.html',
  '/credibility.html',
  '/contact.html',
  '/status.html',
  '/dashboard.html',
  '/vault.html',
  '/admin.html',
  '/post.html',
  '/404.html',
  '/manifest.json',
  '/Platforms-Apps-Infrastructure/BrandID-Offline-PWA/assets/icon-512.png',
  '/css/style.css',
  '/js/main.js',
  '/js/growth.js',
  '/js/three-bg.js',
  '/SkyeDocx/homepage.html',
];

// ── Install: pre-cache core assets ──────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ──────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ───────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Netlify function calls entirely
  if (request.method !== 'GET' || url.pathname.startsWith('/.netlify/')) return;

  // Static assets: cache first
  if (/\.(css|js|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return res;
      }))
    );
    return;
  }

  // HTML pages: network first, fallback to cache, then offline page
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match(OFFLINE_URL)))
  );
});
