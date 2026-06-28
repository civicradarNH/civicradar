#!/usr/bin/env python3
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]


async def parse_file(path: Path) -> str:
    code = path.read_text(encoding="utf-8")
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        err = await page.evaluate(
            """(code) => {
              try { new Function(code); return ''; }
              catch (e) { return String(e); }
            }""",
            code,
        )
        await browser.close()
        return err


async def main():
    head = ROOT / "js" / "app.js"
    err = await parse_file(head)
    print("working tree:", err or "OK")
    import subprocess
    committed = subprocess.check_output(["git", "show", "HEAD:js/app.js"], cwd=ROOT)
    committed_path = ROOT / "tests" / "_app_head.js"
    committed_path.write_bytes(committed)
    err2 = await parse_file(committed_path)
    print("HEAD:", err2 or "OK")


if __name__ == "__main__":
    asyncio.run(main())
