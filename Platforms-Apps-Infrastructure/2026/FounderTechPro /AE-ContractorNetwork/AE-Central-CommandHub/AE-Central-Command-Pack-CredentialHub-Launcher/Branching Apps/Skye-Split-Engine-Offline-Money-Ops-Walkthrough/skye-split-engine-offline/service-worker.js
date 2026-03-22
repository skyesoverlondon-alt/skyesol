const CACHE_NAME = 'skye-split-engine-ops-v3';
const ASSETS = [
  './',
  './index.html',
  './engine.html',
  './ops.html',
  './receipts.html',
  './contacts.html',
  './vault.html',
  './settings.html',
  './help.html',
  './walkthrough.html',
  './assets/app.css',
  './assets/db.js',
  './assets/app-core.js',
  './assets/dashboard.js',
  './assets/engine.js',
  './assets/ops.js',
  './assets/receipts.js',
  './assets/contacts.js',
  './assets/vault.js',
  './assets/settings.js',
  './assets/help.js',
  './assets/walkthrough.js',
  './assets/media/skydexia-logo.png',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => cached))
  );
});
