const CACHE = 'aud-v3';
const ASSETS = ['icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // API calls: never cache
  if (url.hostname === 'api.anthropic.com' || url.hostname === 'generativelanguage.googleapis.com') return;

  // Static assets (icons): cache-first
  if (ASSETS.some(a => url.pathname.endsWith(a))) {
    e.respondWith(
      caches.match(e.request).then(c => c || fetch(e.request))
    );
    return;
  }

  // HTML and everything else: network-first, fallback to cache
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
