#!/usr/bin/env python3
"""Find JS syntax error line in app.js using V8 + proper wrapper."""
import asyncio
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LINES = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8').splitlines()
BODY_START = 6
BODY_END = len(LINES) - 1


def wrap(body_lines):
    return (
        "document.addEventListener('DOMContentLoaded', function () {\n"
        "  'use strict';\n"
        + '\n'.join(body_lines)
        + '\n});\n'
    )


async def check(end_line: int) -> bool:
    from playwright.async_api import async_playwright
    body = LINES[BODY_START:end_line]
    src = wrap(body)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        ok = await page.evaluate(
            """(src) => { try { new Function(src); return true; } catch (e) { return false; } }""",
            src,
        )
        await browser.close()
        return ok


async def main():
    lo, hi = 522, BODY_END
    while lo + 1 < hi:
        mid = (lo + hi) // 2
        good = await check(mid)
        print(f'body lines {BODY_START+1}..{mid}:', 'OK' if good else 'FAIL')
        if good:
            lo = mid
        else:
            hi = mid
    print('\nFirst bad line:', hi)
    for i in range(max(1, hi - 5), min(len(LINES), hi + 5)):
        print(f'{i}: {LINES[i-1][:160]}')


asyncio.run(main())
