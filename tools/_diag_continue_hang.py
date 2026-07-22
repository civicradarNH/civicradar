"""Step through onboarding-complete work to find which call hangs."""
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


async def step(label, page, js, timeout=8):
    print(f'>> {label}', flush=True)
    try:
        result = await asyncio.wait_for(page.evaluate(js), timeout=timeout)
        print(f'   OK {label} -> {result!r}'[:200], flush=True)
        return result
    except Exception as e:
        print(f'   HANG/FAIL {label}: {type(e).__name__}: {e}', flush=True)
        raise


async def main():
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await new_ctx(
            browser,
            storage={
                'civicradar_user': default_user(
                    id='diag2', tosAccepted=True, gpsConsent=True, ward='', displayName=''
                ),
            },
        )
        page = await ctx.new_page()
        page.set_default_timeout(8000)
        await goto_app(page)
        await page.wait_for_timeout(600)
        # Onboarding should be open (tos already accepted, no ward)
        open_ob = await page.evaluate(
            '() => !!(document.getElementById("onboardingOverlay")||{}).classList?.contains("open")'
        )
        print(f'onboarding open={open_ob}', flush=True)
        if not open_ob:
            await page.evaluate('() => { if (typeof openModal==="function") openModal("onboarding"); }')
            await page.wait_for_timeout(300)

        await set_combobox_value(page, '#wardInput', WARD)
        await set_input_value(page, '#displayName', 'TestCitizen')
        await dismiss_civic_comboboxes(page)

        # Probe pieces that continue handler runs (sync)
        probes = [
            ('getOnboardingWard', '() => (typeof getOnboardingWard==="function"?null: document.getElementById("wardInput").value)'),
            ('isValidWard via button path', f'''() => {{
              const ward = (document.getElementById("wardInput").value||"").trim();
              const city = document.getElementById("onboardCity")?.value || "mumbai";
              return {{ ward, city, ready: ward.length>0 }};
            }}'''),
            ('sanitize display', '''() => {
              const el = document.getElementById("displayName");
              return el ? el.value : null;
            }'''),
            ('click continue via DOM (may hang)', '''() => {
              const btn = document.getElementById("btnOnboardingContinue");
              btn.click();
              return "clicked";
            }'''),
        ]
        for label, js in probes[:-1]:
            await step(label, page, js, timeout=5)

        # Final click with short timeout — this is the suspected hang
        await step('click continue', page, probes[-1][1], timeout=12)

        u = await page.evaluate('() => localStorage.getItem("civicradar_user")')
        print(f'user after={u[:200] if u else None}', flush=True)
        await ctx.close()
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
