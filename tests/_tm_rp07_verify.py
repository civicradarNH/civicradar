#!/usr/bin/env python3
"""Verify RP07 path using patched e2e helpers."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import e2e_comprehensive as e2e


async def main():
    e2e.PORT = 8095
    e2e.BASE = "http://127.0.0.1:8095/"
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await e2e.new_ctx(
            browser,
            storage={
                "civicradar_user": e2e.default_user(id="rp07v"),
                "civicradar_coach_seen": "1",
            },
        )
        page = await ctx.new_page()
        await e2e.goto_app(page)
        # Prior report like RP20
        await page.evaluate("() => window.openReportModal(false)")
        rid0 = await e2e.submit_report_via_api(page, 19.0763, 72.8780, "garbage launch test")
        print("prior_rid", rid0)
        await e2e.close_all_modals(page)
        success_closed = await page.evaluate(
            '() => !document.getElementById("successOverlay")?.classList.contains("open")'
        )
        print("success_closed_after_close_all", success_closed)
        # Draft restore like RP21
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
        draft_ok = await page.evaluate(
            """() => {
          const open = document.getElementById('reportOverlay').classList.contains('open');
          const hazard = document.getElementById('hazardType').value;
          const notes = document.getElementById('reportNotes').value;
          return open && hazard === 'garbage' && notes === 'camera reload test';
        }"""
        )
        print("draft_ok", draft_ok)
        mod_off = await page.evaluate(
            "() => !(window.CIVICRADAR_CONFIG?.moderation?.enabled)"
        )
        sb_off = await page.evaluate("() => !window.CIVICRADAR_CONFIG?.supabaseUrl")
        print("mod_off", mod_off, "supabase_off", sb_off)
        await page.evaluate('() => sessionStorage.removeItem("civicradar_report_draft")')
        await e2e.close_all_modals(page)
        rid = await e2e.submit_report_via_api(page, 19.0762, 72.8779, "extended test")
        stored = await page.evaluate(
            '() => JSON.parse(localStorage.getItem("mosquiTrackReports")||"[]").some(r => r.notes === "extended test")'
        )
        success = await page.evaluate(
            '() => document.getElementById("successOverlay")?.classList.contains("open")'
        )
        print("RP07", {"rid": rid, "stored": stored, "success": success})
        ok = bool(rid) or stored
        await browser.close()
        raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    asyncio.run(main())
