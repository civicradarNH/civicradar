#!/usr/bin/env python3
import asyncio

async def main():
    from playwright.async_api import async_playwright
    text = open(r'C:\civicradar\tests\_app_recovered.js', encoding='utf-8').read()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        r = await page.evaluate(
            """(src) => { try { new Function(src); return 'OK'; } catch (e) { return String(e.message); } }""",
            text,
        )
        print(r)
        await browser.close()

asyncio.run(main())
