// @ts-check
/**
 * CivicRadar focused Playwright smoke (JS layer of the two-layer test system).
 *
 * Complements tests/e2e_comprehensive.py (200+ scenarios, CI deploy gate).
 * This file guards ship-glitch regressions with fast, readable specs:
 * photo→confirm, hazard viewport, pin-map Leaflet, share-nudge timing,
 * console errors, offline shell, GPS denied, i18n, overlay dismiss.
 *
 * Run: npm run test:playwright  (needs: npm install && npx playwright install chromium)
 * CI:  keep e2e_comprehensive.py as gate; optionally add npm run lint:invariants pre-step.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const WARD = 'G/N Ward — Dadar, Shivaji Park';

const INIT_BYPASS_SW = `
navigator.serviceWorker.register = () => Promise.reject(new Error('sw blocked for tests'));
window.CIVICRADAR_CONFIG = Object.assign({}, window.CIVICRADAR_CONFIG || {}, {
  moderation: { enabled: false },
  analytics: { enabled: true, debug: false },
  supabaseUrl: '',
  supabaseAnonKey: '',
});
`;

const GEO_SCRIPT = `
(() => {
  const lat = window.__testLat ?? 19.0760;
  const lng = window.__testLng ?? 72.8777;
  const pos = { coords: { latitude: lat, longitude: lng, accuracy: 8 } };
  navigator.geolocation.getCurrentPosition = (ok, err) => {
    if (window.__geoDenied) { if (err) err({ code: 1, message: 'denied' }); return; }
    setTimeout(() => ok(pos), 10);
  };
  let watchSeq = 0;
  navigator.geolocation.watchPosition = (ok, err) => {
    if (window.__geoDenied) { if (err) err({ code: 1, message: 'denied' }); return -1; }
    setTimeout(() => ok(pos), 10);
    setTimeout(() => ok(pos), 40);
    setTimeout(() => ok(pos), 80);
    watchSeq += 1;
    return watchSeq;
  };
  navigator.geolocation.clearWatch = () => {};
})();
`;

/** @param {import('@playwright/test').BrowserContext} context */
async function newTestContext(context, opts = {}) {
  const {
    lat = 19.076,
    lng = 72.8777,
    geoDenied = false,
    storage = null,
  } = opts;

  await context.route('**/*', async (route) => {
    if (route.request().url().includes('supabase.co')) await route.abort();
    else await route.continue();
  });
  await context.addInitScript(INIT_BYPASS_SW);
  await context.addInitScript(
    `window.__testLat = ${lat}; window.__testLng = ${lng}; window.__geoDenied = ${JSON.stringify(geoDenied)};`
  );
  await context.addInitScript(GEO_SCRIPT);
  if (storage) {
    await context.addInitScript((data) => {
      Object.entries(data).forEach(([k, v]) => {
        localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      });
    }, storage);
  }
}

function defaultUser(overrides = {}) {
  return {
    id: `pw-${Date.now()}`,
    tosAccepted: true,
    gpsConsent: true,
    city: 'mumbai',
    ward: WARD,
    displayName: 'PlaywrightUser',
    pledges: [],
    ...overrides,
  };
}

/** @param {import('@playwright/test').Page} page */
async function ensureLocalMode(page) {
  await page.evaluate(() => {
    if (window.CIVICRADAR_CONFIG) {
      window.CIVICRADAR_CONFIG.supabaseUrl = '';
      window.CIVICRADAR_CONFIG.supabaseAnonKey = '';
    }
    if (window.Backend) window.Backend.enabled = false;
    if (typeof updateAuthMode === 'function') updateAuthMode();
  });
}

/** @param {import('@playwright/test').Page} page */
async function gotoApp(page, waitMap = false) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await ensureLocalMode(page);
  await page.waitForFunction(() => typeof window.openReportModal === 'function', { timeout: 45_000 });
  await page.evaluate(() => {
    if (window.CIVICRADAR_CONFIG) window.CIVICRADAR_CONFIG.moderation = { enabled: false };
  });
  if (waitMap) {
    await page.waitForFunction(
      () => typeof L !== 'undefined' && !!document.querySelector('#map .leaflet-container'),
      { timeout: 20_000 }
    ).catch(() => {});
  }
  await page.waitForTimeout(400);
}

/** @param {import('@playwright/test').Page} page */
async function injectPhoto(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('imageCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 240;
    canvas.height = 180;
    for (let y = 0; y < canvas.height; y += 4) {
      for (let x = 0; x < canvas.width; x += 4) {
        const r = 60 + ((x * 7 + y * 3) % 80);
        const g = 90 + ((x + y * 5) % 70);
        const b = 30 + ((x * y) % 50);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    canvas.classList.add('visible');
    document.getElementById('photoConfirmGroup')?.classList.remove('hidden');
    if (typeof window.syncReportPhotoReturn === 'function') window.syncReportPhotoReturn();
  });
}

/** @param {import('@playwright/test').Page} page */
async function openReport(page) {
  await page.evaluate(() => window.openReportModal(false));
  await page.waitForSelector('#reportOverlay.open', { state: 'visible', timeout: 8_000 });
}

/** @param {import('@playwright/test').Page} page */
function attachConsoleGuard(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

test.describe('CivicRadar smoke (JS layer)', () => {
  test.beforeEach(async ({ context }) => {
    await newTestContext(context, {
      storage: {
        civicradar_user: defaultUser({ id: 'pw-base' }),
        civicradar_coach_seen: '1',
        civicradar_report_geo_explainer: '1',
      },
    });
  });

  test('photo capture advances to confirm step', async ({ page }) => {
    const consoleErrors = attachConsoleGuard(page);
    await gotoApp(page);
    await openReport(page);
    await injectPhoto(page);
    await page.waitForTimeout(600);

    const state = await page.evaluate(() => {
      const overlay = document.getElementById('reportOverlay');
      const confirm = document.getElementById('reportStepConfirm');
      const modal = document.getElementById('reportModal');
      const canvas = document.getElementById('imageCanvas');
      return {
        overlayOpen: overlay?.classList.contains('open'),
        confirmVisible: confirm && !confirm.hidden,
        confirmActive: confirm?.classList.contains('report-step--active'),
        modalConfirm: modal?.classList.contains('report-modal--confirm'),
        canvasVisible: canvas?.classList.contains('visible'),
      };
    });

    expect(state.overlayOpen).toBe(true);
    expect(state.confirmVisible).toBe(true);
    expect(state.confirmActive).toBe(true);
    expect(state.modalConfirm).toBe(true);
    expect(state.canvasVisible).toBe(true);
    expect(consoleErrors).toEqual([]);
  });

  test('corrupt photo fails gracefully back to capture', async ({ page }) => {
    const consoleErrors = attachConsoleGuard(page);
    await gotoApp(page);
    await openReport(page);

    const corruptPath = path.join(__dirname, '_tmp_corrupt.jpg');
    fs.writeFileSync(corruptPath, 'not-a-real-image');

    try {
      await page.click('#btnTakePhoto');
      await page.setInputFiles('#photoInput', corruptPath);
      await page.waitForTimeout(1000);

      const state = await page.evaluate(() => {
        const capture = document.getElementById('reportStepCapture');
        const confirm = document.getElementById('reportStepConfirm');
        const toast = document.getElementById('toastContainer')?.textContent || '';
        return {
          captureActive: capture?.classList.contains('report-step--active'),
          confirmHidden: confirm?.hidden,
          toast,
        };
      });

      expect(state.captureActive).toBe(true);
      expect(state.confirmHidden).toBe(true);
      expect(state.toast.length).toBeGreaterThan(0);
    } finally {
      fs.unlinkSync(corruptPath);
    }
    expect(consoleErrors).toEqual([]);
  });

  test('hazard tiles stay in viewport on confirm step', async ({ page }) => {
    await gotoApp(page);
    await openReport(page);
    await injectPhoto(page);
    await page.waitForTimeout(600);

    const layout = await page.evaluate(() => {
      const panel = document.getElementById('reportStepConfirm');
      const tiles = [...document.querySelectorAll('#hazardGrid .hazard-tile[data-live="true"]')];
      const style = panel ? window.getComputedStyle(panel) : null;
      const panelRect = panel?.getBoundingClientRect();
      const firstTile = tiles[0]?.getBoundingClientRect();
      const firstVisible = !!(panelRect && firstTile && firstTile.top < panelRect.bottom);
      return {
        tileCount: tiles.length,
        firstVisible,
        overflowY: style?.overflowY,
        scrollable: /(auto|scroll)/.test(style?.overflowY || ''),
        tallerThanViewport: panel ? panel.scrollHeight > panel.clientHeight + 8 : false,
      };
    });

    expect(layout.tileCount).toBeGreaterThanOrEqual(4);
    expect(layout.scrollable).toBe(true);
    expect(layout.firstVisible).toBe(true);
  });

  test('pin map Leaflet tiles are sized not blank', async ({ page }) => {
    await gotoApp(page);
    await openReport(page);
    await injectPhoto(page);
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      if (typeof window.civicTestSetConfirmPin === 'function') {
        window.civicTestSetConfirmPin(19.076, 72.8777, 5, false);
      }
    });
    await page.waitForTimeout(300);

    const pinMap = await page.evaluate(() => {
      const mapEl = document.getElementById('reportPinMap');
      if (!mapEl) return { ok: false, reason: 'no-host' };
      const leaf = mapEl.querySelector('.leaflet-container') || mapEl;
      const rect = leaf.getBoundingClientRect();
      const hasPane = !!mapEl.querySelector('.leaflet-pane, .leaflet-map-pane');
      const sized = !!(rect && rect.width >= 80 && rect.height >= 80);
      const confirm = document.getElementById('reportStepConfirm');
      const overlay = document.getElementById('reportOverlay');
      const modal = document.getElementById('reportModal');
      const confirmOk = !!(overlay && overlay.classList.contains('open')
        && confirm && !confirm.hidden
        && modal && modal.classList.contains('report-modal--confirm'));
      return { ok: sized && confirmOk && hasPane, sized, confirmOk, hasPane, w: rect.width, h: rect.height };
    });

    expect(pinMap.ok, JSON.stringify(pinMap)).toBe(true);
  });

  test('no neighbour share nudge while report sheet is open', async ({ page }) => {
    await gotoApp(page);

    // Seed a prior report so share nudge logic may fire.
    await page.evaluate(() => {
      const uid = JSON.parse(localStorage.getItem('civicradar_user')).id;
      const reports = [{
        id: 'nudge-seed',
        reporterId: uid,
        hazard: 'stagnant-water',
        ward: 'G/N Ward — Dadar, Shivaji Park',
        city: 'mumbai',
        reporter: 'Test',
        lat: 19.076,
        lng: 72.877,
        status: 'pending',
        timestamp: new Date().toISOString(),
      }];
      localStorage.setItem('mosquiTrackReports', JSON.stringify(reports));
    });

    await openReport(page);
    await page.waitForTimeout(700);

    const blocked = await page.evaluate(() => {
      const overlayOpen = document.getElementById('reportOverlay')?.classList.contains('open');
      const texts = [...document.querySelectorAll('#toastContainer .toast span')]
        .map((el) => (el.textContent || '').toLowerCase());
      const hasNudge = texts.some((t) =>
        t.includes('may not know') || t.includes('पड़ोसियों को अभी') || t.includes('माहीत नसेल') || t.includes('ખબર ન હોય')
      );
      return { overlayOpen, hasNudge };
    });

    expect(blocked.overlayOpen).toBe(true);
    expect(blocked.hasNudge).toBe(false);
  });

  test('happy path submit stores report', async ({ page }) => {
    const consoleErrors = attachConsoleGuard(page);
    await gotoApp(page);
    await openReport(page);
    await injectPhoto(page);
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      if (typeof window.civicTestSetConfirmPin === 'function') {
        window.civicTestSetConfirmPin(19.0761, 72.8778, 5, true);
      }
      document.getElementById('reportNotes').value = 'playwright happy path';
    });

    await page.click('#btnSubmitReport');
    await page.waitForFunction(
      () => document.getElementById('successOverlay')?.classList.contains('open'),
      { timeout: 12_000 }
    );

    const saved = await page.evaluate(() => {
      const reports = JSON.parse(localStorage.getItem('mosquiTrackReports') || '[]');
      return reports.some((r) => r.notes === 'playwright happy path');
    });
    expect(saved).toBe(true);
    expect(consoleErrors).toEqual([]);
  });

  test('offline shell loads from service worker precache list', async ({ page, context }) => {
    const swText = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
    const versionMatch = swText.match(/civicradar-(v\d+)/);
    expect(versionMatch).toBeTruthy();

    await gotoApp(page);
    const assets = await page.evaluate(async () => {
      const res = await fetch(`sw.js?pw=${Date.now()}`, { cache: 'no-store' });
      return res.text();
    });
    expect(assets).toContain(versionMatch[0]);
    expect(assets).toContain("'index.html'");
    expect(assets).not.toContain("'/index.html'");
  });

  test('GPS denied still allows manual report flow', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: 'block',
      geolocation: { latitude: 19.076, longitude: 72.8777 },
      permissions: [],
    });
    await newTestContext(context, {
      geoDenied: true,
      storage: {
        civicradar_user: defaultUser({ id: 'pw-gps-denied', gpsConsent: false }),
        civicradar_coach_seen: '1',
      },
    });
    const page = await context.newPage();
    const consoleErrors = attachConsoleGuard(page);
    await gotoApp(page);
    await openReport(page);
    await expect(page.locator('#btnTakePhoto')).toBeVisible();
    expect(consoleErrors).toEqual([]);
    await context.close();
  });

  test('four languages switch without crash', async ({ page }) => {
    const consoleErrors = attachConsoleGuard(page);
    await gotoApp(page);

    const langs = ['en', 'hi', 'mr', 'gu'];
    for (const code of langs) {
      await page.evaluate((lang) => {
        if (typeof setLanguage === 'function') setLanguage(lang);
      }, code);
      await page.waitForTimeout(200);
      const label = await page.evaluate(() => document.getElementById('reportTitle')?.textContent || '');
      expect(label.length).toBeGreaterThan(2);
    }
    expect(consoleErrors).toEqual([]);
  });

  test('lang overlay is closeable', async ({ page }) => {
    await gotoApp(page);
    await page.click('#btnLang');
    await page.waitForSelector('#langOverlay.open', { state: 'visible' });
    await page.click('#langOverlay .modal__close');
    await page.waitForFunction(() => !document.getElementById('langOverlay')?.classList.contains('open'));
    const open = await page.evaluate(() => document.getElementById('langOverlay')?.classList.contains('open'));
    expect(open).toBe(false);
  });
});
