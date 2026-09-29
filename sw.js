const CACHE="plc-performance-hub-v10-3";
const ASSETS=["./","./index.html","./app.css","./app.js","./manifest.webmanifest","./icon.svg","./locales/en.json","./locales/sk.json","./locales/cs.json","./locales/de.json","./locales/es.json","./locales/pl.json"];
self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener("activate",e=>e.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);
  const isAppAsset=url.origin===self.location.origin&&(
    url.pathname.endsWith("/")||
    /\.(?:html|js|css|json|webmanifest)$/.test(url.pathname)
  );
  if(isAppAsset){
    e.respondWith(
      fetch(e.request)
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(e.request,copy));
          return res;
        })
        .catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html")))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});