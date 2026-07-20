/* CivicRadar service worker.
 *
 * Ship checklist (any HTML/CSS/JS change):
 *   1. Bump CIVIC_APP_VERSION in js/app.js (e.g. v271)
 *   2. Set CACHE below to the same suffix: 'civicradar-v280'
 *   3. Update SW06 expected string in tests/e2e_comprehensive.py
 *
 * Testers stuck on a stale build: open
 *   …/civicradar/?clearSw=1
 * (unregisters SW, clears caches, reloads once). Or Chrome → Clear site data.
 * GitHub Pages cannot set custom Cache-Control headers; versioned CACHE is the update lever.
 */
const CACHE = 'civicradar-v312';
const NETWORK_FIRST = [
  '/js/config.js', 'js/config.js',
  // Leaflet must not stick on a stale/broken cache entry (map empty state).
  'vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css', '/vendor/leaflet/leaflet.css',
];
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
  'js/demo-cloud-v2.js', 'robots.txt', 'assets/og-civicradar.svg',
  'assets/channel-icons/app-civic.svg', 'assets/channel-icons/chat-filing.svg',
  'assets/channel-icons/web-portal.svg', 'assets/channel-icons/helpline.svg',
  'assets/channel-icons/sanitation.svg', 'assets/channel-icons/govt-emblem.svg',
  'assets/channel-icons/verified-gov.svg',
  'assets/nav-icons/nav-map.svg', 'assets/nav-icons/nav-community.svg',
  'assets/nav-icons/nav-resources.svg', 'assets/nav-icons/nav-profile.svg',
  'assets/hazard-icons/hazard-water.svg', 'assets/hazard-icons/hazard-garbage.svg',
  'assets/hazard-icons/hazard-potholes.svg', 'assets/hazard-icons/hazard-streetlight.svg',
  'assets/brand/radar-mark.svg', 'assets/brand/fab-camera.svg', 'assets/brand/empty-pin.svg',
  'assets/map-pins/pin-open-water.svg', 'assets/map-pins/pin-open-garbage.svg',
  'assets/map-pins/pin-open-potholes.svg', 'assets/map-pins/pin-open-streetlight.svg',
  'assets/map-pins/pin-open-default.svg', 'assets/map-pins/pin-fixed.svg',
  'assets/map-pins/user-location.svg',
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
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
function isNetworkFirst(url) {
  return NETWORK_FIRST.some((p) => url.pathname === p || url.pathname.endsWith(p));
}
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Same-origin only — never wrap OSM tiles / CDN (TF.js, Turnstile) in SW.
  // Intercepting cross-origin under memory pressure returned Response.error()
  // and made online devices look "offline".
  if (url.origin !== self.location.origin) return;
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
  // Same-origin relative paths only — never open absolute/external URLs from notification data.
  let target = typeof data.url === 'string' ? data.url : './';
  if (!target || /^[a-z]+:/i.test(target) || target.startsWith('//')) target = './';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if ('focus' in client) { client.postMessage({ type: 'nbh-alert-focus', reportId }); return client.focus(); }
    }
    const url = reportId ? `${target}${target.includes('?') ? '&' : '?'}report=${encodeURIComponent(reportId)}` : target;
    return self.clients.openWindow(url);
  }));
});
