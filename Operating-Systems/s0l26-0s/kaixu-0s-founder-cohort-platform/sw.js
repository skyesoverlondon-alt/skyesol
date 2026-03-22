const CACHE_NAME = 'os-founder-cohort-v9';
const BASE = self.location.pathname.replace(/sw\.js$/, '');
const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'pages/pricing.html',
  BASE + 'pages/curriculum.html',
  BASE + 'pages/proof.html',
  BASE + 'pages/founder.html',
  BASE + 'pages/trust.html',
  BASE + 'pages/mercy-home.html',
  BASE + 'pages/homebase-youth-services.html',
  BASE + 'pages/new-pathways-for-youth.html',
  BASE + 'pages/arizona-center-for-youth-resources.html',
  BASE + 'pages/youth-partners.html',
  BASE + 'pages/host-a-cohort.html',
  BASE + 'pages/apply.html',
  BASE + 'pages/editorials/index.html',
  BASE + 'pages/editorials/community-pillar.html',
  BASE + 'pages/editorials/rising-stars.html',
  BASE + 'pages/editorials/accounting-close-ops-case-study.html',
  BASE + 'pages/editorials/directory-authority-portal-case-study.html',
  BASE + 'pages/editorials/governed-ai-support-case-study.html',
  BASE + 'pages/editorials/logistics-lane-intelligence-case-study.html',
  BASE + 'pages/editorials/phoenix-service-acquisition-case-study.html',
  BASE + 'assets/style.css',
  BASE + 'assets/background.js',
  BASE + 'assets/intro.js',
  BASE + 'assets/app.js',
  BASE + 'assets/media/founder.png',
  BASE + 'assets/media/skydexia-dual-logo.png',
  BASE + 'assets/media/skydexia-logo.png',
  BASE + 'assets/media/skyes-primary-logo.png',
  BASE + 'assets/media/kaixu-logo.png',
  BASE + 'assets/media/bg-ledger.png',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
  BASE + 'manifest.webmanifest',
  BASE + 'robots.txt',
  BASE + 'sitemap.xml',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match(BASE + 'index.html')))
  );
});
