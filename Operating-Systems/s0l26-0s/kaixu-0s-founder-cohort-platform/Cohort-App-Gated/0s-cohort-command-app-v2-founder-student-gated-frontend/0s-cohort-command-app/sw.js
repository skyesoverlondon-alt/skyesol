const CACHE = '0s-cohort-command-v2';
const ASSETS = [
  './',
  './index.html',
  './founder-login.html',
  './student-login.html',
  './founder-dashboard.html',
  './instructor-book.html',
  './student-portal.html',
  './assets/style.css',
  './assets/app.js',
  './assets/media/bg-ledger.png',
  './assets/media/founder.png',
  './assets/media/kaixu-logo.png',
  './assets/media/skydexia-dual-logo.png',
  './assets/media/skydexia-logo.png',
  './assets/media/skyes-primary-logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.webmanifest'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
});
self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
