# -*- coding: utf-8 -*-
"""Apply CivicRadar v238 JS/SW/E2E patches. Do not commit."""
from __future__ import annotations

import importlib.util
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "js" / "app.js"
SW = ROOT / "sw.js"
E2E = ROOT / "tests" / "e2e_comprehensive.py"


def flex(pattern: str) -> str:
    """Turn a logical code snippet into a whitespace-flexible regex."""
    parts = [re.escape(line.rstrip()) for line in pattern.strip("\n").split("\n") if line.strip() != ""]
    return r"\s*".join(parts)


def sub_once(t: str, logical: str, replacement: str, label: str) -> str:
    pat = flex(logical)
    m = re.search(pat, t)
    if not m:
        raise SystemExit(f"Missing pattern: {label}")
    # Keep surrounding style: use replacement with same newline density as match
    matched = m.group(0)
    # If file uses blank lines between statements, expand replacement similarly
    if "\n\n" in matched:
        lines = [ln for ln in replacement.strip("\n").split("\n")]
        repl = "\n\n".join(lines)
        # preserve leading indent/newlines from match start
        if matched.startswith("\n"):
            repl = "\n" + repl
    else:
        repl = replacement
    return t[: m.start()] + repl + t[m.end() :]


def extract_i18n(t: str, key: str) -> list[str]:
    return re.findall(rf"'{re.escape(key)}': '((?:\\\\'|[^'])*)'", t)


def main() -> None:
    t = APP.read_text(encoding="utf-8")
    t = t.replace("const CIVIC_APP_VERSION = 'v237';", "const CIVIC_APP_VERSION = 'v238';", 1)
    t = t.replace("mapMarkerDebounceMs: 250,", "mapMarkerDebounceMs: 280,", 1)

    geo_vals = extract_i18n(t, "report.geoExplainerBody")
    cam_vals = extract_i18n(t, "report.cameraDisclosureBody")
    if len(geo_vals) < 4 or len(cam_vals) < 4:
        raise SystemExit(f"Expected 4 geo/cam strings, got {len(geo_vals)}/{len(cam_vals)}")

    _i18n_path = Path(__file__).with_name("_v238_i18n.py")
    _spec = importlib.util.spec_from_file_location("v238i18n", _i18n_path)
    _mod = importlib.util.module_from_spec(_spec)
    assert _spec and _spec.loader
    _spec.loader.exec_module(_mod)
    for old, new in zip(geo_vals[:4], [_mod.strengthen_geo(o, i) for i, o in enumerate(geo_vals[:4])]):
        needle = f"'report.geoExplainerBody': '{old}'"
        if needle not in t:
            raise SystemExit("geo needle missing")
        t = t.replace(needle, f"'report.geoExplainerBody': '{new}'", 1)
    for old, new in zip(cam_vals[:4], [_mod.strengthen_cam(o, i) for i, o in enumerate(cam_vals[:4])]):
        needle = f"'report.cameraDisclosureBody': '{old}'"
        if needle not in t:
            raise SystemExit("cam needle missing")
        t = t.replace(needle, f"'report.cameraDisclosureBody': '{new}'", 1)

    if "function syncSheetDepthClass()" not in t:
        t = sub_once(
            t,
            "/* ---------- Modals ---------- */",
            """/* ---------- Modals ---------- */

  const SHEET_DEPTH_BLOCKING = new Set(['tos', 'onboarding']);

  function syncSheetDepthClass() {
    try {
      const open = modalOpenOrder.filter((n) => overlays[n] && overlays[n].classList.contains('open'));
      const hasBlocking = open.some((n) => SHEET_DEPTH_BLOCKING.has(n));
      const hasContent = open.some((n) => !SHEET_DEPTH_BLOCKING.has(n));
      const depth = hasContent && !hasBlocking;
      document.body.classList.toggle('sheet-depth', depth);
      document.body.classList.toggle('sheet-depth-blocking', hasBlocking);
      document.documentElement.classList.toggle('sheet-depth', depth);
      document.documentElement.classList.toggle('sheet-depth-blocking', hasBlocking);
      if (!open.length) {
        document.body.classList.remove('sheet-depth', 'sheet-depth-blocking');
        document.documentElement.classList.remove('sheet-depth', 'sheet-depth-blocking');
      }
    } catch { /* ignore */ }
  }
""",
            "modals marker",
        )

    t = sub_once(
        t,
        """const el = overlays[name];
    if (!el) return;
    if (shouldPushModalHistory(name)) pushNavModalHistory();""",
        """const el = overlays[name];
    if (!el || !el.classList) return;
    if (shouldPushModalHistory(name)) pushNavModalHistory();""",
        "openModal guard",
    )

    if "try { focusModalLanding(name, el); }" not in t:
        t = sub_once(
            t,
            """focusModalLanding(name, el);
    bindFocusTrapForOverlay(el);
    if (name === 'onboarding') {""",
            """try { focusModalLanding(name, el); } catch { /* ignore */ }
    try { bindFocusTrapForOverlay(el); } catch { /* ignore */ }
    syncSheetDepthClass();
    if (name === 'onboarding') {""",
            "openModal focus",
        )

    t = sub_once(
        t,
        """function focusModalLanding(name, overlayEl) {
    const modal = overlayEl.querySelector('.modal') || overlayEl;""",
        """function focusModalLanding(name, overlayEl) {
    if (!overlayEl) return;
    const modal = overlayEl.querySelector('.modal') || overlayEl;""",
        "focusModalLanding null",
    )

    t = sub_once(
        t,
        """function closeModal(name) {
    debugLog('MODAL', 'closeModal', { name });
    const el = overlays[name];
    if (!el) return;""",
        """function closeModal(name) {
    debugLog('MODAL', 'closeModal', { name });
    const el = overlays[name];
    if (!el || !el.classList) {
      modalOpenOrder = modalOpenOrder.filter((n) => n !== name);
      syncSheetDepthClass();
      return;
    }""",
        "closeModal guard",
    )

    if "syncSheetDepthClass();\n\n  }\n\n  function getTopmostOpenModalName" not in t and "syncSheetDepthClass();" not in t[t.find("function closeModal") : t.find("function getTopmostOpenModalName")]:
        t = sub_once(
            t,
            """} else {
      // Rebind trap + move focus into the still-open parent (e.g. success ← escalation).
      restoreFocusTrapToTopmost();
    }
  }
  function getTopmostOpenModalName() {""",
            """} else {
      // Rebind trap + move focus into the still-open parent (e.g. success ← escalation).
      try { restoreFocusTrapToTopmost(); } catch { /* ignore */ }
    }
    syncSheetDepthClass();
  }
  function getTopmostOpenModalName() {""",
            "closeModal sync",
        )

    if "console.warn('dismissOverlayByName'" not in t:
        t = sub_once(
            t,
            """function dismissOverlayByName(name) {
    if (!name || isBlockingOverlay(name)) return false;
    if (name === 'report' && !canDismissReportOverlay()) {""",
            """function dismissOverlayByName(name) {
    if (!name || isBlockingOverlay(name)) return false;
    try {
    if (name === 'report' && !canDismissReportOverlay()) {""",
            "dismiss try start",
        )
        t = sub_once(
            t,
            """return true;
  }
  // Push a history entry when opening main sheets so Android back closes them""",
            """return true;
    } catch (err) {
      try { console.warn('dismissOverlayByName', name, err); } catch { /* ignore */ }
      return false;
    }
  }
  // Push a history entry when opening main sheets so Android back closes them""",
            "dismiss try end",
        )

    t = sub_once(
        t,
        """Object.entries(overlays).forEach(([name, el]) => {
      el.addEventListener('click', (e) => {
        if (e.target !== el) return;
        if (isBlockingOverlay(name)) return;
        dismissOverlayByName(name);
      });
    });""",
        """Object.entries(overlays).forEach(([name, el]) => {
      if (!el) return;
      el.addEventListener('click', (e) => {
        if (e.target !== el) return;
        if (isBlockingOverlay(name)) return;
        try { dismissOverlayByName(name); } catch { /* ignore */ }
      });
    });""",
        "overlay bind",
    )

    t = sub_once(
        t,
        """$('#tosAccept').addEventListener('change', (e) => {
      $('#btnTosContinue').disabled = !e.target.checked;
    });""",
        """const tosAcceptEl = $('#tosAccept');
    if (tosAcceptEl) tosAcceptEl.addEventListener('change', (e) => {
      const btn = $('#btnTosContinue');
      if (btn) btn.disabled = !e.target.checked;
    });""",
        "tosAccept",
    )

    t = sub_once(
        t,
        "$('#btnTosContinue').addEventListener('click', () => {",
        """const btnTosContinue = $('#btnTosContinue');
    if (btnTosContinue) btnTosContinue.addEventListener('click', () => {""",
        "btnTosContinue",
    )

    t = sub_once(
        t,
        "$('#btnDeleteData').addEventListener('click', () => { deleteMyData(); });",
        """const btnDeleteData = $('#btnDeleteData');
    if (btnDeleteData) btnDeleteData.addEventListener('click', () => { deleteMyData(); });""",
        "btnDeleteData",
    )

    t = sub_once(
        t,
        """$('#btnEnableLocation').addEventListener('click', () => {
      // Tapping "Enable" is an explicit opt-in to GPS collection.
      enableLocationFromUser();
    });""",
        """const btnEnableLocation = $('#btnEnableLocation');
    if (btnEnableLocation) btnEnableLocation.addEventListener('click', () => {
      // Tapping "Enable" is an explicit opt-in to GPS collection.
      enableLocationFromUser();
    });""",
        "btnEnableLocation",
    )

    t = sub_once(
        t,
        "$('#btnTakePhoto').addEventListener('click', () => openReportPhotoPicker());",
        """const btnTakePhotoEl = $('#btnTakePhoto');
    if (btnTakePhotoEl) btnTakePhotoEl.addEventListener('click', () => openReportPhotoPicker());""",
        "btnTakePhoto",
    )

    t = sub_once(
        t,
        """function reportsInViewport(reports) {
    if (!map) return reports;
    try {
      const bounds = map.getBounds().pad(0.12);
      return reports.filter((r) => bounds.contains([r.lat, r.lng]));
    } catch {
      return reports;
    }
  }""",
        """function reportsInViewport(reports) {
    if (!map) return reports;
    try {
      const bounds = map.getBounds().pad(0.2);
      return reports.filter((r) => {
        if (r.lat == null || r.lng == null) return false;
        try { return bounds.contains([r.lat, r.lng]); } catch { return false; }
      });
    } catch {
      return reports;
    }
  }""",
        "viewport",
    )

    t = sub_once(
        t,
        """let pool = reportsForMap();
    if (map) pool = reportsInViewport(pool);
    pool = prioritizeMapReports(pool).slice(0, SCALE_CFG.maxMapMarkers);
    const nextIds = new Set(pool.map((r) => r.id));""",
        """let pool = reportsForMap();
    if (map) pool = reportsInViewport(pool);
    // Keep an open popup pin mounted even if it briefly leaves the padded bounds.
    if (reopenId != null && !pool.some((r) => r.id === reopenId)) {
      const keep = reportsForMap().find((r) => r.id === reopenId);
      if (keep) pool = [keep, ...pool];
    }
    pool = prioritizeMapReports(pool).slice(0, SCALE_CFG.maxMapMarkers);
    if (reopenId != null && !pool.some((r) => r.id === reopenId)) {
      const keep = reportsForMap().find((r) => r.id === reopenId);
      if (keep) pool = [keep, ...pool.slice(0, Math.max(0, SCALE_CFG.maxMapMarkers - 1))];
    }
    const nextIds = new Set(pool.map((r) => r.id));""",
        "marker pool",
    )

    if "let markerRefreshRaf = 0;" not in t:
        t = sub_once(
            t,
            """function scheduleRefreshReportMarkers() {
    if (!reportMarkerLayer) return;
    clearTimeout(markerRefreshTimer);
    markerRefreshTimer = setTimeout(refreshReportMarkers, SCALE_CFG.mapMarkerDebounceMs);
  }""",
            """let markerRefreshRaf = 0;
  function scheduleRefreshReportMarkers() {
    if (!reportMarkerLayer) return;
    clearTimeout(markerRefreshTimer);
    if (markerRefreshRaf) cancelAnimationFrame(markerRefreshRaf);
    markerRefreshRaf = requestAnimationFrame(() => {
      markerRefreshRaf = 0;
      markerRefreshTimer = setTimeout(refreshReportMarkers, SCALE_CFG.mapMarkerDebounceMs);
    });
  }""",
            "marker schedule",
        )

    t = sub_once(
        t,
        """if (openEl) openEl.textContent = String(stats.open);
    if (fixedEl) fixedEl.textContent = String(stats.fixedWeek);
    if (meTooEl) meTooEl.textContent = String(stats.meToo);
    el.setAttribute('aria-label', t('pulse.aria'));
  }""",
        """if (openEl) openEl.textContent = String(stats.open);
    if (fixedEl) fixedEl.textContent = String(stats.fixedWeek);
    if (meTooEl) meTooEl.textContent = String(stats.meToo);
    const meterOpen = $('#wardPulseMeterOpen');
    const meterFixed = $('#wardPulseMeterFixed');
    const total = Math.max(1, (stats.open || 0) + (stats.fixedWeek || 0));
    if (meterOpen) meterOpen.style.width = `${Math.round(((stats.open || 0) / total) * 100)}%`;
    if (meterFixed) meterFixed.style.width = `${Math.round(((stats.fixedWeek || 0) / total) * 100)}%`;
    el.setAttribute('aria-label', t('pulse.aria'));
  }""",
        "ward pulse meter",
    )

    if "async function startOnboardingWardDetect()" not in t:
        t = sub_once(
            t,
            """function startOnboardingWardDetect() {
    onboardingDetectedWard = '';""",
            """async function startOnboardingWardDetect() {
    try { if (typeof wardDetectReady !== 'undefined') await wardDetectReady; } catch { /* ignore */ }
    onboardingDetectedWard = '';""",
            "onboard await",
        )

    t = sub_once(
        t,
        """const granted = await queryGeolocationPermission();
    if (!granted && !hasSeenReportGeoExplainer()) {
      const choice = await showReportGeoExplainerModal();""",
        """const granted = await queryGeolocationPermission();
    // Play: in-app disclosure must complete before the system location prompt.
    if (!granted) {
      const choice = await showReportGeoExplainerModal();""",
        "geo disclosure",
    )

    if "loadScriptOnce('js/ward-detect.js')" not in t:
        t = sub_once(
            t,
            """loadScriptOnce('js/image-moderation.js');
    loadScriptOnce('js/society-suggestions-data.js');
  });""",
            """loadScriptOnce('js/image-moderation.js');
    loadScriptOnce('js/society-suggestions-data.js');
  });

  // Off HTML critical path — still SW-precached for offline.
  const wardDetectReady = loadScriptOnce('js/ward-detect.js').then(() => {
    try { populateWardDatalists(); } catch { /* ignore */ }
  });
  loadScriptOnce('js/analytics.js').then(() => {
    try {
      if (window.CivicAnalytics && user) CivicAnalytics.setConsent(!!user.analyticsConsent);
    } catch { /* ignore */ }
  });""",
            "idle ward-detect",
        )

    APP.write_text(t, encoding="utf-8")

    SW.write_text(
        Path(__file__).with_name("_v238_sw.js").read_text(encoding="utf-8")
        if Path(__file__).with_name("_v238_sw.js").exists()
        else _SW_FALLBACK,
        encoding="utf-8",
    )

    e2e = E2E.read_text(encoding="utf-8").replace("civicradar-v237", "civicradar-v238")
    E2E.write_text(e2e, encoding="utf-8")

    t3 = APP.read_text(encoding="utf-8")
    checks = {
        "version": "CIVIC_APP_VERSION = 'v238'" in t3,
        "sheet_depth": "function syncSheetDepthClass()" in t3,
        "viewport_pad": "pad(0.2)" in t3,
        "ward_detect": "loadScriptOnce('js/ward-detect.js')" in t3,
        "geo_disclose": "Play: in-app disclosure must complete" in t3,
        "sw": "civicradar-v238" in SW.read_text(encoding="utf-8"),
        "e2e": "civicradar-v238" in E2E.read_text(encoding="utf-8"),
        "marketing_en": "not sold or used for marketing" in t3,
        "meter": "wardPulseMeterOpen" in t3,
        "debounce": "mapMarkerDebounceMs: 280" in t3,
    }
    print(checks)
    bad = [k for k, v in checks.items() if not v]
    if bad:
        raise SystemExit(f"Failed: {bad}")
    print("OK v238")


_SW_FALLBACK = r"""const CACHE = 'civicradar-v238';
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
"""


if __name__ == "__main__":
    main()
