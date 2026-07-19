#!/usr/bin/env python3
"""Re-run the three previously failing scenarios + RP07 on current v292 workspace."""
import asyncio
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import e2e_comprehensive as e2e


async def main():
    e2e.PORT = 8095
    e2e.BASE = "http://127.0.0.1:8095/"
    from playwright.async_api import async_playwright

    results = []

    # SW06
    sw_ok = False
    try:
        sw_url = f"{e2e.BASE}sw.js?e2e={int(time.time() * 1000)}"
        with urllib.request.urlopen(sw_url, timeout=5) as resp:
            sw_src = resp.read().decode("utf-8")
        sw_ok = (
            "civicradar-v292" in sw_src
            and "'/index.html'" not in sw_src
            and "'/js/app.js'" not in sw_src
            and "'index.html'" in sw_src
        )
    except Exception as ex:
        print("SW06 err", ex)
    results.append(("SW06", sw_ok))

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # C34c
        ctx = await e2e.new_ctx(
            browser,
            storage={
                "civicradar_user": e2e.default_user(
                    id="c34c", city="pune", ward=e2e.PUNE_WARD
                ),
                "civicradar_coach_seen": "1",
            },
        )
        page = await ctx.new_page()
        await e2e.goto_app(page)
        c34c = await page.evaluate(
            """() => {
              window.openCommunityModal();
              const el = document.getElementById('communitySubtitle');
              const txt = (el ? el.textContent : '').trim();
              const wardBit = (JSON.parse(localStorage.getItem('civicradar_user')||'{}').ward || '').split('—')[0].trim();
              return txt.length > 8 && (!wardBit || txt.includes(wardBit)) && !/\\bBMC\\b/.test(txt);
            }"""
        )
        results.append(("C34c", c34c))
        await ctx.close()

        # RP12b (with prior photo like RP11) + RP07
        ctx = await e2e.new_ctx(
            browser,
            storage={
                "civicradar_user": e2e.default_user(id="rp12b"),
                "civicradar_coach_seen": "1",
            },
        )
        page = await ctx.new_page()
        await e2e.goto_app(page)
        # Seed leftover preview like RP11
        await page.evaluate(
            """() => {
              window.openReportModal(false);
              const canvas = document.getElementById('imageCanvas');
              const ctx2 = canvas.getContext('2d');
              canvas.width = 240; canvas.height = 180;
              for (let y = 0; y < 180; y += 4) for (let x = 0; x < 240; x += 4) {
                ctx2.fillStyle = `rgb(${60+(x*7+y*3)%80},${90+(x+y*5)%70},${30+(x*y)%50})`;
                ctx2.fillRect(x, y, 4, 4);
              }
              canvas.classList.add('visible');
            }"""
        )
        cancel_guard_ok = await page.evaluate(
            """() => {
              try { localStorage.setItem('civicradar_report_camera_disclosure', '1'); } catch (_) {}
              const canvas = document.getElementById('imageCanvas');
              if (canvas) {
                canvas.classList.remove('visible');
                try { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); } catch (_) {}
              }
              try { document.getElementById('photoInput').value = ''; } catch (_) {}
              window.openReportModal(false);
              document.getElementById('btnTakePhoto')?.click();
              const input = document.getElementById('photoInput');
              if (input) {
                try { input.dispatchEvent(new Event('cancel', { bubbles: true })); } catch (_) {}
              }
              if (input) {
                try {
                  const dt = new DataTransfer();
                  input.files = dt.files;
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (_) {}
              }
              document.querySelector('#bottomNav .nav-tab[data-tab=map]')?.click();
              const overlay = document.getElementById('reportOverlay');
              const captureStep = document.querySelector('#reportFlowSteps .flow-step[data-step=capture]');
              return !!(overlay && overlay.classList.contains('open')
                && captureStep && captureStep.classList.contains('is-active'));
            }"""
        )
        results.append(("RP12b", cancel_guard_ok))

        await e2e.close_all_modals(page)
        await page.evaluate(
            """() => {
              sessionStorage.setItem('civicradar_report_draft', JSON.stringify({
                hazardType: 'garbage', step: 'photo', notes: 'camera reload test',
                awaitingPhoto: true, ts: Date.now()
              }));
            }"""
        )
        await page.reload()
        await e2e.apply_test_runtime_overrides(page)
        await page.wait_for_selector("#reportOverlay.open", state="visible", timeout=5000)
        await page.evaluate('() => sessionStorage.removeItem("civicradar_report_draft")')
        await e2e.close_all_modals(page)
        rid = await e2e.submit_report_via_api(page, 19.0762, 72.8779, "extended test")
        stored = await page.evaluate(
            '() => JSON.parse(localStorage.getItem("mosquiTrackReports")||"[]").some(r => r.notes === "extended test")'
        )
        results.append(("RP07", bool(rid) or stored))
        await browser.close()

    for cid, ok in results:
        print(f"[{'PASS' if ok else 'FAIL'}] {cid}")
    raise SystemExit(0 if all(ok for _, ok in results) else 1)


if __name__ == "__main__":
    asyncio.run(main())
