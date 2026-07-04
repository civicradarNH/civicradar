const CACHE = 'civicradar-v111';
// Runtime config — never precache; always fetch fresh (see network-first below).
const NETWORK_FIRST = ['/js/config.js'];
// Relative paths resolve against the SW scope, so precache works both at the
// site root (local/dev/tests) and on a GitHub Pages project subpath (/civicradar/).
const ASSETS = [
  './',
  'index.html',
  'privacy.html',
  'terms.html',
  'css/styles.css',
  'css/legal.css',
  'js/analytics.js',
  'js/image-moderation.js',
  'js/wards/mumbai.js',
  'js/wards/pune.js',
  'js/wards/thane.js',
  'js/ward-detect.js',
  'js/society-suggestions-data.js',
  'js/searchable-select.js',
  'js/app.js',
  'js/demo-tour.js',
  'js/demo-tour-v2.js',
  'manifest.json',
  'robots.txt',
  'assets/og-civicradar.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png',
  'assets/favicon-32.png',
];

self.addEventListener('install', (e) => {
  // Cache best-effort: a single failed asset must not abort the whole install
  // (addAll rejects atomically), which would leave the app with no offline shell.
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        ASSETS.map((url) =>
          c.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      )
    )
  );
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
  // Only handle GET (never cache POST/PUT to Supabase, analytics, etc.).
  if (e.request.method !== 'GET') return;

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
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).catch(() => {
        // Offline + uncached: fall back to the app shell for navigations
        // so deep links / refreshes still open instead of a browser error.
        // Relative match resolves against scope (root or /civicradar/ subpath).
        if (e.request.mode === 'navigate') {
          return caches.match('index.html').then((shell) => shell || caches.match('./'));
        }
        return Response.error();
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = (event.notification && event.notification.data) || {};
  const reportId = data.reportId || '';
  const target = data.url || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'nbh-alert-focus', reportId });
          return client.focus();
        }
      }
      const url = reportId ? `${target}${target.includes('?') ? '&' : '?'}report=${encodeURIComponent(reportId)}` : target;
      return self.clients.openWindow(url);
    })
  );
});
