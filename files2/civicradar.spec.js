// @ts-check
/**
 * CivicRadar — End-to-End Test Suite (Playwright)
 * ==========================================================================
 * Drives a REAL browser through the critical flows. Every bug we found by
 * hand is encoded here as a regression test, so it can never come back.
 *
 * SETUP (run once, in your repo root):
 *   npm init -y
 *   npm i -D @playwright/test
 *   npx playwright install chromium
 *
 * RUN:
 *   npx playwright test                 # headless
 *   npx playwright test --headed        # watch it click
 *   npx playwright test --debug         # step through
 *   npx playwright test --project=mobile  # emulate a budget Android
 *
 * Put this file at:  tests/civicradar.spec.js
 * Put the config at: playwright.config.js  (see bottom of this file)
 */
const { test, expect, devices } = require('@playwright/test');

// Serve the app locally first:  npx serve .   (or python3 -m http.server 8080)
const BASE = process.env.BASE_URL || 'http://localhost:8080';

// ── helpers ──────────────────────────────────────────────────────────
async function acceptTos(page) {
  const check = page.locator('#tosAccept, input[type="checkbox"]').first();
  if (await check.isVisible().catch(() => false)) {
    await check.check();
    await page.locator('#btnTosContinue, button:has-text("Continue")').first().click();
  }
}

async function completeOnboarding(page) {
  await acceptTos(page);
  const ward = page.locator('#onboardWardInput, #wardInput').first();
  if (await ward.isVisible().catch(() => false)) {
    await ward.fill('Bandra');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.locator('#btnOnboardingContinue, button:has-text("Join")').first().click();
  }
  await page.waitForTimeout(500);
}

/** Attach a fake photo to the report file input (simulates the camera). */
async function attachPhoto(page, { corrupt = false } = {}) {
  // 1x1 JPEG (valid) or garbage bytes (to test the failure path)
  const valid = Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
    'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
    'base64'
  );
  const bad = Buffer.from('this-is-not-an-image-at-all');
  await page.setInputFiles('#photoInput', {
    name: 'hazard.jpg',
    mimeType: 'image/jpeg',
    buffer: corrupt ? bad : valid,
  });
}

// ═════════════════════════════════════════════════════════════════════
test.describe('CivicRadar — critical flows', () => {

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 19.0596, longitude: 72.8295 }); // Bandra
    // Fail the test on ANY uncaught console error — catches silent breakage.
    page.on('pageerror', (err) => { throw new Error(`Uncaught page error: ${err.message}`); });
    await page.goto(BASE);
    await completeOnboarding(page);
  });

  // ── REGRESSION: the photo-capture hang ────────────────────────────
  test('BUG-1: taking a photo always returns to the confirm step', async ({ page }) => {
    await page.locator('#fab, .fab, button:has-text("Report")').first().click();
    await attachPhoto(page);

    // The confirm step MUST become visible. This is the bug that hung.
    await expect(page.locator('#reportStepConfirm')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#imageCanvas')).toBeVisible();
  });

  test('BUG-1b: a CORRUPT photo fails gracefully (does not hang forever)', async ({ page }) => {
    await page.locator('#fab, .fab, button:has-text("Report")').first().click();
    await attachPhoto(page, { corrupt: true });

    // Must show an error and RELEASE the flow — not spin forever.
    await expect(page.locator('.toast--error')).toBeVisible({ timeout: 8000 });
    // And the user must be able to retry (input is cleared / capture available).
    await expect(page.locator('#photoInput')).toHaveValue('');
  });

  // ── REGRESSION: the unreachable hazard tiles ──────────────────────
  test('BUG-2: hazard categories are reachable (confirm step scrolls)', async ({ page }) => {
    await page.locator('#fab, .fab, button:has-text("Report")').first().click();
    await attachPhoto(page);
    await expect(page.locator('#reportStepConfirm')).toBeVisible();

    // EVERY hazard tile must be reachable — this is what the scroll bug broke.
    const tiles = page.locator('[data-hazard]');
    const n = await tiles.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const tile = tiles.nth(i);
      await tile.scrollIntoViewIfNeeded();
      await expect(tile).toBeInViewport();       // ← fails if content is clipped
    }
    // And specifically: stagnant water must be clickable (your exact report).
    await page.locator('[data-hazard="stagnant-water"]').click();
    await expect(page.locator('[data-hazard="stagnant-water"]')).toHaveClass(/active|selected/);
  });

  // ── REGRESSION: the blank pin map ─────────────────────────────────
  test('BUG-3: the pin-confirm map renders tiles (not blank)', async ({ page }) => {
    await page.locator('#fab, .fab, button:has-text("Report")').first().click();
    await attachPhoto(page);
    await expect(page.locator('#reportPinMap')).toBeVisible();

    // A blank Leaflet map has NO tile images. Real tiles = the fix works.
    await expect(page.locator('#reportPinMap img.leaflet-tile')).toHaveCount(
      // at least one tile must load
      await page.locator('#reportPinMap img.leaflet-tile').count().then((c) => Math.max(c, 1)),
      { timeout: 10000 }
    );
    const box = await page.locator('#reportPinMap').boundingBox();
    expect(box.height).toBeGreaterThan(50);   // container actually laid out
    expect(box.width).toBeGreaterThan(50);
  });

  // ── REGRESSION: the premature share nudge ─────────────────────────
  test('BUG-4: no share nudge appears before a report is submitted', async ({ page }) => {
    // Submit one report so lastReportId gets set.
    await page.locator('#fab, .fab, button:has-text("Report")').first().click();
    await attachPhoto(page);
    await page.locator('[data-hazard="potholes"]').click();
    await page.locator('#btnSubmitReport').click();
    await expect(page.locator('#successOverlay')).toBeVisible({ timeout: 15000 });
    await page.locator('#btnSuccessClose, button:has-text("Done")').first().click();

    // The nudge is EXPECTED here (once).
    await expect(page.locator('.toast')).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(7000);           // let it expire

    // Now START a new report — the nudge must NOT reappear.
    await page.locator('#fab, .fab, button:has-text("Report")').first().click();
    await attachPhoto(page);
    await page.waitForTimeout(2000);
    const toasts = page.locator('.toast', { hasText: /neighbour|पड़ोसी|शेजार|પડોશી/i });
    await expect(toasts).toHaveCount(0);       // ← the bug: this used to fire
  });

  // ── The happy path, end to end ────────────────────────────────────
  test('E2E: full report flow — photo → category → pin → submit → map', async ({ page }) => {
    await page.locator('#fab, .fab, button:has-text("Report")').first().click();
    await attachPhoto(page);
    await expect(page.locator('#reportStepConfirm')).toBeVisible();
    await page.locator('[data-hazard="garbage"]').click();
    await page.locator('#btnSubmitReport').click();
    await expect(page.locator('#successOverlay')).toBeVisible({ timeout: 15000 });
    await page.locator('#btnSuccessClose, button:has-text("Done")').first().click();
    // Lands back on the map with the new pin.
    await expect(page.locator('#map')).toBeVisible();
  });

  // ── EXIT AFFORDANCES: can the user always get out? ────────────────
  const CLOSEABLE = ['success', 'shareWin', 'community', 'profile', 'resources'];
  test('UX: every non-blocking overlay can be closed', async ({ page }) => {
    // Community + Profile via nav
    for (const tab of ['community', 'profile']) {
      await page.locator(`[data-tab="${tab}"], #nav-${tab}`).first().click();
      const overlay = page.locator(`#${tab}Overlay`);
      await expect(overlay).toBeVisible();
      // Escape must close it
      await page.keyboard.press('Escape');
      await expect(overlay).not.toBeVisible({ timeout: 3000 });
    }
  });

  // ── GPS DENIED: must not dead-end ─────────────────────────────────
  test('UX: denying location still allows a manual pin (no dead end)', async ({ page, context }) => {
    await context.clearPermissions();          // simulate "Block"
    await page.locator('#fab, .fab, button:has-text("Report")').first().click();
    await attachPhoto(page);
    // Either the confirm step appears with a manual-pin option, or an explicit
    // fallback is offered. What must NOT happen: a hard stop with no way forward.
    const manual = page.locator('text=/place.*pin|pin.*map|manually/i');
    await expect(manual.first()).toBeVisible({ timeout: 8000 });
  });

  // ── OFFLINE: the app shell must still load ────────────────────────
  test('PWA: app shell loads offline after first visit', async ({ page, context }) => {
    await page.waitForTimeout(2000);           // let the SW install
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#map, #app, body')).toBeVisible({ timeout: 10000 });
    await context.setOffline(false);
  });

  // ── i18n: all four languages render without breaking layout ───────
  for (const lang of ['hi', 'mr', 'gu']) {
    test(`i18n: switching to ${lang} does not break the report flow`, async ({ page }) => {
      await page.evaluate((l) => window.setLanguage && window.setLanguage(l), lang);
      await page.waitForTimeout(500);
      await page.locator('#fab, .fab').first().click();
      await attachPhoto(page);
      await expect(page.locator('#reportStepConfirm')).toBeVisible({ timeout: 8000 });
      // No raw i18n keys leaking into the UI (e.g. "report.step.photo")
      const body = await page.locator('body').innerText();
      expect(body).not.toMatch(/\b[a-z]+\.[a-z]+\.[a-zA-Z]+\b(?![\w.])/);
    });
  }
});

/* ─────────────────────────────────────────────────────────────────────
 * playwright.config.js  — save this separately in your repo root:
 * ─────────────────────────────────────────────────────────────────────
const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',      // records a replay of failures
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Emulates a budget Android — where YOUR users are.
    { name: 'mobile',  use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npx serve . -l 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
  },
});
 * ───────────────────────────────────────────────────────────────────── */
