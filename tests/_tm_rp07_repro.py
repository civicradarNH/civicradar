#!/usr/bin/env python3
"""Minimal repro for RP07 (report stored after draft restore + submit_report_via_api)."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8095/"
GEO = """
(() => {
  const pos = { coords: { latitude: 19.0762, longitude: 72.8779, accuracy: 5 } };
  navigator.geolocation.getCurrentPosition = (ok, err) => setTimeout(() => ok(pos), 10);
  let w = 0;
  navigator.geolocation.watchPosition = (ok) => {
    setTimeout(() => ok(pos), 10);
    setTimeout(() => ok(pos), 40);
    w += 1;
    return w;
  };
  navigator.geolocation.clearWatch = () => {};
})();
"""
INIT = """
navigator.serviceWorker.register = () => Promise.reject(new Error('sw blocked'));
window.CIVICRADAR_CONFIG = Object.assign({}, window.CIVICRADAR_CONFIG || {}, {
  moderation: { enabled: false }, analytics: { enabled: false },
  supabaseUrl: '', supabaseAnonKey: '',
});
"""


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            geolocation={"latitude": 19.0760, "longitude": 72.8777},
            permissions=["geolocation"],
        )
        await ctx.add_init_script(GEO)
        await ctx.add_init_script(INIT)
        await ctx.add_init_script(
            """() => {
          localStorage.setItem('civicradar_user', JSON.stringify({
            id:'rp07', tosAccepted:true, gpsConsent:true,
            ward:'G/N Ward — Dadar, Shivaji Park',
            city:'mumbai', displayName:'Tester', language:'en', analyticsConsent:false
          }));
          localStorage.setItem('civicradar_coach_seen','1');
          localStorage.setItem('civicradar_report_camera_disclosure','1');
          localStorage.setItem('civicradar_report_geo_explainer','1');
        }"""
        )
        page = await ctx.new_page()
        page.on(
            "console",
            lambda m: print("CONSOLE", m.type, m.text[:300])
            if m.type in ("error", "warning")
            else None,
        )
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        await page.evaluate(
            """() => {
          sessionStorage.setItem('civicradar_report_draft', JSON.stringify({
            hazardType: 'garbage', step: 'photo', notes: 'camera reload test',
            awaitingPhoto: true, ts: Date.now()
          }));
        }"""
        )
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        draft_open = await page.evaluate(
            '() => document.getElementById("reportOverlay")?.classList.contains("open")'
        )
        print("draft_open", draft_open)
        await page.evaluate('() => sessionStorage.removeItem("civicradar_report_draft")')
        await page.evaluate(
            """() => {
          document.querySelectorAll('.modal.open, .overlay.open, [class*="overlay"].open').forEach((el) => {
            el.classList.remove('open');
            el.setAttribute('aria-hidden', 'true');
          });
        }"""
        )
        diag = await page.evaluate(
            """async () => {
          try { localStorage.setItem('civicradar_report_camera_disclosure','1'); } catch(_){}
          if (typeof window.openReportModal === 'function') window.openReportModal(false);
          await new Promise((r) => setTimeout(r, 200));
          const canvas = document.getElementById('imageCanvas');
          const cctx = canvas.getContext('2d');
          canvas.width = 240; canvas.height = 180;
          for (let y = 0; y < canvas.height; y += 4) {
            for (let x = 0; x < canvas.width; x += 4) {
              cctx.fillStyle = `rgb(${60+(x*7+y*3)%80},${90+(x+y*5)%70},${30+(x*y)%50})`;
              cctx.fillRect(x, y, 4, 4);
            }
          }
          canvas.classList.add('visible');
          document.getElementById('photoConfirmGroup')?.classList.remove('hidden');
          document.getElementById('reportNotes').value = 'extended test';
          const geoPos = { coords: { latitude: 19.0762, longitude: 72.8779, accuracy: 5 } };
          navigator.geolocation.getCurrentPosition = (ok) => ok(geoPos);
          navigator.geolocation.watchPosition = (ok) => { ok(geoPos); return 1; };
          navigator.geolocation.clearWatch = () => {};
          const beforeFlags = window.__civicTestReportPhotoFlags
            ? window.__civicTestReportPhotoFlags() : null;
          if (typeof window.syncReportPhotoReturn === 'function') window.syncReportPhotoReturn();
          const afterSync = window.__civicTestReportPhotoFlags
            ? window.__civicTestReportPhotoFlags() : null;
          const pinOk = typeof window.civicTestSetConfirmPin === 'function'
            ? window.civicTestSetConfirmPin(19.0762, 72.8779, 5, true) : null;
          const step = document.querySelector('#reportFlowSteps .flow-step.is-active')?.dataset?.step;
          const confirmHidden = !!document.getElementById('reportStepConfirm')?.hidden;
          const submitDisabled = !!document.getElementById('btnSubmitReport')?.disabled;
          document.getElementById('btnSubmitReport').click();
          await new Promise((r) => setTimeout(r, 2000));
          const reps = JSON.parse(localStorage.getItem('mosquiTrackReports') || '[]');
          const toast = document.getElementById('toastContainer')?.textContent || '';
          const success = document.getElementById('successOverlay')?.classList.contains('open');
          const warn = document.getElementById('inlineDuplicateWarning');
          return {
            beforeFlags, afterSync, pinOk, step, confirmHidden, submitDisabled, success,
            stored: reps.some((r) => r.notes === 'extended test'),
            count: reps.length,
            toast: toast.slice(0, 240),
            dupe: !!(warn && !warn.hidden && !warn.classList.contains('hidden')),
            overlayOpen: document.getElementById('reportOverlay')?.classList.contains('open'),
            hasPreview: !!beforeFlags?.hasPreview || !!afterSync?.hasPreview,
          };
        }"""
        )
        print("DIAG", json.dumps(diag, indent=2, default=str))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
