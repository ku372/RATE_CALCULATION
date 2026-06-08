const CACHE_NAME = 'pccs-rate-v5.2';
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(LOCAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Share Target: WhatsApp/any app PDF share ──────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // POST /share-target → store PDF → redirect to app
  if (e.request.method === 'POST' && url.pathname === '/share-target') {
    e.respondWith((async () => {
      try {
        const formData = await e.request.formData();
        const file = formData.get('pdf');
        if (file && file.size > 0) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/__shared_pdf__', new Response(file, {
            headers: {
              'Content-Type': 'application/pdf',
              'X-File-Name': file.name || 'shared.pdf'
            }
          }));
        }
      } catch(err) {
        console.warn('Share target error:', err);
      }
      return Response.redirect('/?shared=1', 303);
    })());
    return;
  }

  // CDN resources: network-first, cache fallback
  if (url.origin !== location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Local: cache-first
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request))
  );
});
