"""Prove C07→C08 no longer hangs."""
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tests'))

from e2e_comprehensive import (  # noqa: E402
    WARD,
    default_user,
    dismiss_civic_comboboxes,
    goto_app,
    js_click,
    new_ctx,
    set_combobox_value,
    set_input_value,
)


async def main():
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await new_ctx(
            browser,
            storage={
                'civicradar_user': default_user(
                    id='proof', tosAccepted=False, gpsConsent=False, ward='', displayName=''
                ),
            },
        )
        page = await ctx.new_page()
        await goto_app(page)
        await page.evaluate('() => document.getElementById("tosAccept").click()')
        await js_click(page, '#btnTosContinue')
        await page.wait_for_timeout(800)

        await set_combobox_value(page, '#wardInput', '<script>alert(1)</script> Ward')
        await dismiss_civic_comboboxes(page)
        await js_click(page, '#btnOnboardingContinue')
        await page.wait_for_timeout(300)
        print('C07 ok', flush=True)

        await set_combobox_value(page, '#wardInput', WARD)
        await set_input_value(page, '#displayName', '<img onerror=alert(1)>')
        await dismiss_civic_comboboxes(page)
        await js_click(page, '#btnOnboardingContinue')
        await page.wait_for_function(
            """() => {
              try {
                const u = JSON.parse(localStorage.getItem('civicradar_user') || '{}');
                return !!u.ward && !document.getElementById('onboardingOverlay').classList.contains('open');
              } catch (e) { return false; }
            }""",
            timeout=10000,
        )
        u = await page.evaluate('() => JSON.parse(localStorage.getItem("civicradar_user"))')
        print(f"C08 PASS ward={u.get('ward')!r} name={u.get('displayName')!r}", flush=True)
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
