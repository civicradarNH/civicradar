#!/usr/bin/env python3
import asyncio
from pathlib import Path

ROOT = Path(r'C:\civicradar\js')
files = [
    'config.js', 'analytics.js', 'image-moderation.js',
    'wards/mumbai.js', 'wards/pune.js', 'wards/thane.js',
    'ward-detect.js', 'society-suggestions-data.js', 'app.js',
]

async def check(name, src):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        ok = await page.evaluate(
            """(src) => { try { new Function(src); return null; } catch (e) { return String(e.message); } }""",
            src,
        )
        await browser.close()
        return ok

async def main():
    for f in files:
        src = (ROOT / f).read_text(encoding='utf-8-sig')
        err = await check(f, src)
        print(f, 'OK' if err is None else err)

asyncio.run(main())
