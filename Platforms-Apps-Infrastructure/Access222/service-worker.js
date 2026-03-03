const CACHE = "skyesol-access-222-f500";
const ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/404.html",
  "/robots.txt",
  "/sitemap.xml",
  "/buildInfo.json",
  "/assets/app.js",
  "/manifest.json",
  "/service-worker.js",
  "/assets/site.css",
  "/assets/site.js",
  "/assets/sky3d.js",
  "/assets/logo.png",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/services/access-222/",
  "/services/access-222/index.html",
  "/checkout/",
  "/checkout/index.html",
  "/thanks/",
  "/thanks/index.html",
  "/ae/",
  "/ae/index.html",
  "/ae/portal/",
  "/ae/portal/index.html",
  "/ae/portal/portal.js",
  "/ae/sop/",
  "/ae/sop/index.html",
  "/ae/sop/sop.js"
];
self.addEventListener("install",(e)=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()).catch(()=>{})));
self.addEventListener("activate",(e)=>e.waitUntil(caches.keys().then(k=>Promise.all(k.map(x=>x===CACHE?null:caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",(e)=>{
  const req=e.request; const url=new URL(req.url);
  if(url.origin!==location.origin) return;
  if(req.mode==="navigate"){
    e.respondWith(fetch(req).then(res=>{ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); return res; })
      .catch(()=>caches.match(req).then(r=>r||caches.match("/index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); return res; }).catch(()=>cached)));
});
