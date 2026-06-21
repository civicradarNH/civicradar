const CACHE = 'civicradar-v48';
// Runtime config — never precache; always fetch fresh (see network-first below).
const NETWORK_FIRST = ['/js/config.js'];
const ASSETS = [
  '/',
  '/index.html',
  '/privacy.html',
  '/terms.html',
  '/css/styles.css',
  '/css/legal.css',
  '/js/analytics.js',
  '/js/image-moderation.js',
  '/js/wards/mumbai.js',
  '/js/wards/pune.js',
  '/js/wards/thane.js',
  '/js/ward-detect.js',
  '/js/app.js',
  '/js/demo-tour.js',
  '/manifest.json',
  '/robots.txt',
  '/assets/og-civicradar.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isNetworkFirst(url) {
  return NETWORK_FIRST.some((p) => url.pathname === p || url.pathname.endsWith(p));
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (isNetworkFirst(url)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
