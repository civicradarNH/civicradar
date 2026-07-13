"""C19b diagnostic."""
import asyncio
import json
import sys
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:8095/'
GEO = """
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
    return ++watchSeq;
  };
  navigator.geolocation.clearWatch = () => {};
})();
"""

USER = {
    'id': 'c16diag',
    'tosAccepted': True,
    'gpsConsent': True,
    'city': 'mumbai',
    'ward': 'G/N Ward — Dadar, Shivaji Park',
    'displayName': 'TestCitizen',
    'pledges': [],
}

def dump(label, obj):
    print(label, json.dumps(obj, ensure_ascii=True), flush=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            geolocation={'latitude': 19.0761, 'longitude': 72.8778},
            permissions=['geolocation'],
            service_workers='block',
        )
        await ctx.route('**/*', lambda route: route.abort() if 'supabase.co' in route.request.url else route.continue_())
        await ctx.add_init_script('window.__testLat=19.0761; window.__testLng=72.8778; window.__geoDenied=false;')
        await ctx.add_init_script(GEO)
        storage = {
            'civicradar_user': USER,
            'civicradar_coach_seen': '1',
            'civicradar_tour_seen': '1',
            'civicradar_home_hero_dismissed': '1',
            'civicradar_report_geo_explainer': '1',
        }
        payload = json.dumps(storage)
        await ctx.add_init_script(f"""(() => {{
          const data = {payload};
          Object.entries(data).forEach(([k, v]) => {{
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          }});
        }})();""")
        page = await ctx.new_page()
        await page.goto(BASE, wait_until='domcontentloaded', timeout=60000)
        await page.evaluate("""() => {
          if (window.CIVICRADAR_CONFIG) {
            window.CIVICRADAR_CONFIG.supabaseUrl = '';
            window.CIVICRADAR_CONFIG.supabaseAnonKey = '';
          }
        }""")
        await page.wait_for_timeout(1500)
        await page.evaluate('() => window.openReportModal(false)')
        await page.wait_for_timeout(300)
        info = await page.evaluate("""async () => {
          const canvas = document.getElementById('imageCanvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 240; canvas.height = 180;
          for (let y = 0; y < canvas.height; y += 4) {
            for (let x = 0; x < canvas.width; x += 4) {
              ctx.fillStyle = `rgb(${60+(x*7+y*3)%80},${90+(x+y*5)%70},${30+(x*y)%50})`;
              ctx.fillRect(x, y, 4, 4);
            }
          }
          canvas.classList.add('visible');
          document.getElementById('photoConfirmGroup')?.classList.remove('hidden');
          document.getElementById('reportNotes').value = 'Playwright test report';
          const geoPos = { coords: { latitude: 19.0761, longitude: 72.8778, accuracy: 5 } };
          navigator.geolocation.getCurrentPosition = (ok) => ok(geoPos);
          navigator.geolocation.watchPosition = (ok) => { ok(geoPos); return 1; };
          navigator.geolocation.clearWatch = () => {};
          if (typeof window.syncReportPhotoReturn === 'function') window.syncReportPhotoReturn();
          if (typeof window.civicTestSetConfirmPin === 'function') {
            window.civicTestSetConfirmPin(19.0761, 72.8778, 5, true);
          }
          const beforeClick = {
            confirmHidden: document.getElementById('reportStepConfirm')?.hidden,
            canvasVisible: canvas.classList.contains('visible'),
            pinOk: typeof window.civicTestSetConfirmPin,
          };
          document.getElementById('btnSubmitReport').click();
          await new Promise(r => setTimeout(r, 2200));
          return {
            beforeClick,
            successOpen: document.getElementById('successOverlay')?.classList.contains('open'),
            reportOpen: document.getElementById('reportOverlay')?.classList.contains('open'),
            nudgeHidden: document.getElementById('pwaInstallNudge')?.classList.contains('hidden'),
            toastCount: document.querySelectorAll('#toastContainer .toast').length,
            toasts: [...document.querySelectorAll('#toastContainer .toast')].map(t => (t.textContent||'').trim().slice(0,100)),
            reportCount: (JSON.parse(localStorage.getItem('civicradar_reports')||'[]')).length,
            user: JSON.parse(localStorage.getItem('civicradar_user')||'null'),
          };
        }""")
        dump('AFTER_SUBMIT', info)
        if not info.get('successOpen'):
            await browser.close()
            return
        await page.evaluate("() => document.getElementById('btnSuccessClose').click()")
        prev = 0
        for wait in (100, 500, 1000, 2800, 4000):
            await page.wait_for_timeout(wait - prev)
            prev = wait
            st = await page.evaluate("""() => ({
              nudgeVisible: !document.getElementById('pwaInstallNudge')?.classList.contains('hidden'),
              body: document.body.classList.contains('pwa-nudge-visible'),
              toastCount: document.querySelectorAll('#toastContainer .toast').length,
              toasts: [...document.querySelectorAll('#toastContainer .toast')].map(t => (t.textContent||'').trim().slice(0,80)),
              dismissKey: localStorage.getItem('civicradar_pwa_nudge_dismissed'),
            })""")
            dump(f'close+{wait}ms', st)
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
