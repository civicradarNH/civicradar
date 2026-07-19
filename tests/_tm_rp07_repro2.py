#!/usr/bin/env python3
"""Deeper RP07 diag: capture submitReport internals after click."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8095/"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            geolocation={"latitude": 19.0760, "longitude": 72.8777},
            permissions=["geolocation"],
        )
        await ctx.add_init_script(
            """
(() => {
  const pos = { coords: { latitude: 19.0762, longitude: 72.8779, accuracy: 5 } };
  navigator.geolocation.getCurrentPosition = (ok) => setTimeout(() => ok(pos), 10);
  let w = 0;
  navigator.geolocation.watchPosition = (ok) => {
    setTimeout(() => ok(pos), 10); setTimeout(() => ok(pos), 40); return ++w;
  };
  navigator.geolocation.clearWatch = () => {};
  navigator.serviceWorker.register = () => Promise.reject(new Error('sw blocked'));
  window.CIVICRADAR_CONFIG = Object.assign({}, window.CIVICRADAR_CONFIG || {}, {
    moderation: { enabled: false }, analytics: { enabled: false },
    supabaseUrl: '', supabaseAnonKey: '',
  });
})();
"""
        )
        await ctx.add_init_script(
            """() => {
          localStorage.setItem('civicradar_user', JSON.stringify({
            id:'rp07b', tosAccepted:true, gpsConsent:true,
            ward:'G/N Ward — Dadar, Shivaji Park',
            city:'mumbai', displayName:'Tester', language:'en', analyticsConsent:false
          }));
          localStorage.setItem('civicradar_coach_seen','1');
          localStorage.setItem('civicradar_report_camera_disclosure','1');
          localStorage.setItem('civicradar_report_geo_explainer','1');
        }"""
        )
        page = await ctx.new_page()
        logs = []
        page.on("console", lambda m: logs.append(f"{m.type}:{m.text[:400]}"))
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)

        # Path A: clean submit (no draft)
        diag_a = await page.evaluate(
            """async () => {
          localStorage.removeItem('mosquiTrackReports');
          window.openReportModal(false);
          await new Promise((r) => setTimeout(r, 300));
          const canvas = document.getElementById('imageCanvas');
          const cctx = canvas.getContext('2d');
          canvas.width = 240; canvas.height = 180;
          cctx.fillStyle = '#336655';
          cctx.fillRect(0, 0, 240, 180);
          canvas.classList.add('visible');
          document.getElementById('reportNotes').value = 'clean submit';
          window.syncReportPhotoReturn();
          window.civicTestSetConfirmPin(19.0762, 72.8779, 5, true);
          const btn = document.getElementById('btnSubmitReport');
          const before = {
            disabled: btn.disabled,
            loading: btn.classList.contains('is-loading'),
            inFlight: !!window.__civicSubmitInFlightProbe,
          };
          // Probe internals if exposed
          const probe = {};
          try {
            // Call click and also try awaiting a patched path
            btn.click();
          } catch (e) { probe.clickErr = String(e); }
          await new Promise((r) => setTimeout(r, 2500));
          const reps = JSON.parse(localStorage.getItem('mosquiTrackReports') || '[]');
          return {
            before,
            stored: reps.some((r) => r.notes === 'clean submit'),
            count: reps.length,
            success: document.getElementById('successOverlay')?.classList.contains('open'),
            toast: (document.getElementById('toastContainer')?.textContent || '').slice(0, 200),
            btnAfter: {
              disabled: btn.disabled,
              loading: btn.classList.contains('is-loading'),
              text: (btn.textContent || '').trim().slice(0, 80),
            },
            confirmHidden: !!document.getElementById('reportStepConfirm')?.hidden,
            canvasVisible: canvas.classList.contains('visible'),
          };
        }"""
        )
        print("PATH_A", json.dumps(diag_a, indent=2))

        # Path B: draft restore then submit (RP07 sequence)
        await page.evaluate(
            """() => {
          sessionStorage.setItem('civicradar_report_draft', JSON.stringify({
            hazardType: 'garbage', step: 'photo', notes: 'camera reload test',
            awaitingPhoto: true, ts: Date.now()
          }));
        }"""
        )
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        diag_b = await page.evaluate(
            """async () => {
          const draftOpen = document.getElementById('reportOverlay')?.classList.contains('open');
          sessionStorage.removeItem('civicradar_report_draft');
          document.querySelectorAll('.open').forEach((el) => {
            if (el.id && /overlay|modal/i.test(el.id + el.className)) {
              el.classList.remove('open');
              el.setAttribute('aria-hidden', 'true');
            }
          });
          localStorage.removeItem('mosquiTrackReports');
          window.openReportModal(false);
          await new Promise((r) => setTimeout(r, 300));
          const canvas = document.getElementById('imageCanvas');
          const cctx = canvas.getContext('2d');
          canvas.width = 240; canvas.height = 180;
          for (let y = 0; y < 180; y += 4) for (let x = 0; x < 240; x += 4) {
            cctx.fillStyle = `rgb(${60+(x*7+y*3)%80},${90+(x+y*5)%70},${30+(x*y)%50})`;
            cctx.fillRect(x, y, 4, 4);
          }
          canvas.classList.add('visible');
          document.getElementById('photoConfirmGroup')?.classList.remove('hidden');
          document.getElementById('reportNotes').value = 'extended test';
          window.syncReportPhotoReturn();
          const pinOk = window.civicTestSetConfirmPin(19.0762, 72.8779, 5, true);
          const btn = document.getElementById('btnSubmitReport');
          const pre = {
            draftOpen,
            pinOk,
            disabled: btn.disabled,
            loading: btn.classList.contains('is-loading'),
            step: document.querySelector('#reportFlowSteps .flow-step.is-active')?.dataset?.step,
            canvasVisible: canvas.classList.contains('visible'),
          };
          btn.click();
          await new Promise((r) => setTimeout(r, 3000));
          const reps = JSON.parse(localStorage.getItem('mosquiTrackReports') || '[]');
          return {
            pre,
            stored: reps.some((r) => r.notes === 'extended test'),
            count: reps.length,
            success: document.getElementById('successOverlay')?.classList.contains('open'),
            toast: (document.getElementById('toastContainer')?.textContent || '').slice(0, 240),
            dupe: !!(document.getElementById('inlineDuplicateWarning') &&
              !document.getElementById('inlineDuplicateWarning').hidden),
            btnAfter: {
              disabled: btn.disabled,
              loading: btn.classList.contains('is-loading'),
              text: (btn.textContent || '').trim().slice(0, 80),
            },
          };
        }"""
        )
        print("PATH_B", json.dumps(diag_b, indent=2))
        interesting = [x for x in logs if "error" in x.lower() or "REPORT" in x or "submit" in x.lower() or "PIN" in x]
        print("LOGS", "\n".join(interesting[-40:]))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
