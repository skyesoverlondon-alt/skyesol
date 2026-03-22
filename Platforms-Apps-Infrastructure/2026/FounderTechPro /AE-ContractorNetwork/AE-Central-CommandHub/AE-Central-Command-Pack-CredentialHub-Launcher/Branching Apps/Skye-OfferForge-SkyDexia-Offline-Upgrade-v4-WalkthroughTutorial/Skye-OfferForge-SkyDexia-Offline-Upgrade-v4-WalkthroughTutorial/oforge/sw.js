
const CACHE = 'skye-offerforge-offline-v3';
const ASSETS = [
  './',
  './index.html',
  './contacts.html',
  './offers.html',
  './templates.html',
  './tasks.html',
  './docs.html',
  './backup.html',
  './settings.html',
  './about.html',
  './manifest.json',
  './assets/style.css',
  './assets/app.js',
  './assets/media/skydexia-logo.png',
  './assets/media/founder.png',
  './icon-192.png',
  './icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
