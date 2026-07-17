const CACHE = 'civicradar-v243';
const NETWORK_FIRST = ['/js/config.js', 'js/config.js'];
const SHELL_ASSETS = [
  'index.html', './', 'css/styles.css', 'css/phosphor-lite.css',
  'vendor/leaflet/leaflet.css', 'vendor/leaflet/leaflet.js',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/favicon-32.png',
  'manifest.json', 'js/app.js',
];
const SECONDARY_ASSETS = [
  'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-icon-2x.png',
  'vendor/leaflet/images/marker-shadow.png', 'vendor/leaflet/images/layers.png',
  'vendor/leaflet/images/layers-2x.png', 'vendor/supabase/supabase.js',
  'assets/icon-maskable-512.png', 'assets/apple-touch-icon.png',
  'privacy.html', 'terms.html', 'delete-account.html', 'official-sources.html',
  'child-safety-standards.html', 'css/legal.css', 'js/analytics.js',
  'js/image-moderation.js', 'js/wards/mumbai.js', 'js/wards/pune.js', 'js/wards/thane.js',
  'js/ward-detect.js', 'js/society-suggestions-data.js', 'js/searchable-select.js',
  'js/demo-tour-v2.js', 'robots.txt', 'assets/og-civicradar.svg',
];
const ASSETS = SHELL_ASSETS.concat(SECONDARY_ASSETS);
function cacheUrls(cache, urls) {
  return Promise.all(urls.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
}
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => { await cacheUrls(c, SHELL_ASSETS); await cacheUrls(c, SECONDARY_ASSETS); }));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
function isNetworkFirst(url) {
  return NETWORK_FIRST.some((p) => url.pathname === p || url.pathname.endsWith(p));
}
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (isNetworkFirst(url)) {
    e.respondWith(fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then((cached) => {
    if (cached) return cached;
    return fetch(e.request).then((res) => {
      if (res && res.ok && url.origin === self.location.origin) {
        const path = url.pathname;
        if (path.includes('/vendor/') || path.includes('/css/phosphor-lite')) {
          const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
      }
      return res;
    }).catch(() => {
      if (e.request.mode === 'navigate') {
        return caches.match('index.html').then((shell) => shell || caches.match('./'));
      }
      return Response.error();
    });
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = (event.notification && event.notification.data) || {};
  const reportId = data.reportId || '';
  const target = data.url || './';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if ('focus' in client) { client.postMessage({ type: 'nbh-alert-focus', reportId }); return client.focus(); }
    }
    const url = reportId ? `${target}${target.includes('?') ? '&' : '?'}report=${encodeURIComponent(reportId)}` : target;
    return self.clients.openWindow(url);
  }));
});
