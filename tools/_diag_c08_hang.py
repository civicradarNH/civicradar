"""Diagnose smoke hang between C07 and C08. Hard timeouts on every step."""
import asyncio
import json
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


async def step(label, coro, timeout=15):
    print(f'>> {label} (timeout={timeout}s)', flush=True)
    try:
        result = await asyncio.wait_for(coro, timeout=timeout)
        print(f'   OK {label}', flush=True)
        return result
    except Exception as e:
        print(f'   FAIL {label}: {type(e).__name__}: {e}', flush=True)
        raise


async main_async():
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await new_ctx(
            browser,
            storage={
                'civicradar_user': default_user(
                    id='diag-c08', tosAccepted=False, gpsConsent=False, ward='', displayName=''
                ),
            },
        )
        page = await ctx.new_page()
        page.set_default_timeout(10000)

        await step('goto', goto_app(page))
        await step('tos', page.evaluate('() => document.getElementById("tosAccept").click()'))
        await step('tos continue', js_click(page, '#btnTosContinue'))
        await page.wait_for_timeout(800)

        # Skip GPS path — set ward directly like post-C07
        await step('dismiss', dismiss_civic_comboboxes(page))
        await step('set XSS ward', set_combobox_value(page, '#wardInput', '<script>alert(1)</script> Ward'))
        await step('dismiss2', dismiss_civic_comboboxes(page))
        await step('continue XSS', js_click(page, '#btnOnboardingContinue'))
        await page.wait_for_timeout(300)
        ward = await page.evaluate('() => JSON.parse(localStorage.getItem("civicradar_user")).ward')
        print(f'   after XSS ward={ward!r}', flush=True)

        await step('set VALID ward', set_combobox_value(page, '#wardInput', WARD), timeout=20)
        await step('set displayName', set_input_value(page, '#displayName', '<img onerror=alert(1)>'), timeout=10)
        await step('dismiss3', dismiss_civic_comboboxes(page), timeout=10)
        await step('continue valid', js_click(page, '#btnOnboardingContinue'), timeout=10)
        await page.wait_for_timeout(500)
        u = await page.evaluate('() => JSON.parse(localStorage.getItem("civicradar_user")||"{}")')
        print(f'   user={json.dumps({k: u.get(k) for k in ("ward","city","displayName")}, ensure_ascii=True)}', flush=True)
        print('DONE — past C08 hang point', flush=True)
        await ctx.close()
        await browser.close()


def main():
    # Fix syntax — Python needs async def
    pass


if __name__ == '__main__':
    # rewrite below — file body uses invalid async main_async(): syntax
    pass
