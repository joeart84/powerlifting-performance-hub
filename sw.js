const CACHE="plc-performance-hub-v16.1-ux-play";
const CACHE_PREFIX="plc-performance-hub-";
const ASSETS=["./","./index.html","./app.css","./app.js","./hub-data.js","./scoring.js","./ux.js","./account-deletion.html","./app-privacy.html","./firebase-config.js","./firebase-auth.js","./manifest.webmanifest","./mark.svg","./logo.svg","./icon.svg","./icon-192.png","./icon-512.png","./locales/en.json","./locales/sk.json","./locales/cs.json","./locales/de.json","./locales/es.json","./locales/pl.json"];
const ASSET_URLS=new Set(ASSETS.map(path=>new URL(path,self.location.href).href));
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>e.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);
  url.search="";
  // Only the app shell is cached; API responses and other applications are untouched.
  if(!ASSET_URLS.has(url.href))return;
  const navigation=e.request.mode==="navigate";
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(e.request);
      if(response.ok){await cache.put(url.href,response.clone());return response}
      return await cache.match(url.href)||response;
    }catch(error){
      const cached=await cache.match(url.href);
      if(cached)return cached;
      if(navigation){const shell=await cache.match(new URL("./index.html",self.location.href).href);if(shell)return shell}
      // Never return HTML for a missing script, stylesheet or JSON file.
      return Response.error();
    }
  })());
});
