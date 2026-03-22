const CACHE = 'skye-lead-vault-v3-cache';
const ASSETS = [
  './',
  './index.html',
  './leads.html',
  './pipeline.html',
  './contacts.html',
  './playbooks.html',
  './quick-capture.html',
  './routes.html',
  './analytics.html',
  './backups.html',
  './settings.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './assets/style.css',
  './assets/app.js',
  './assets/media/skydexia-logo.png'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const clone = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, clone)).catch(() => {});
    return response;
  }).catch(() => caches.match('./index.html'))));
});
