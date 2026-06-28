#!/usr/bin/env python3
import asyncio
import subprocess
import socket
import time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 8097


def port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex(("127.0.0.1", port)) == 0


async def main():
    if not port_open(PORT):
        subprocess.Popen(
            ["python", "-m", "http.server", str(PORT)],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(1)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        errors = []
        console_msgs = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda msg: console_msgs.append(msg.text) if msg.type == "error" else None)
        await page.goto(f"http://localhost:{PORT}/index.html")
        await page.wait_for_timeout(2000)
        scripts = await page.evaluate("""() => Array.from(document.scripts).map(s => s.src.split('/').pop())""")
        src = await page.evaluate("""async () => {
          const r = await fetch('js/app.js');
          return await r.text();
        }""")
        parse_err = await page.evaluate("""(code) => {
          try { new Function(code); return ''; }
          catch (e) { return String(e); }
        }""", src)
        print("parse:", parse_err[:200] if parse_err else 'ok')
        ok = await page.evaluate("() => typeof window.openReportModal === 'function'")
        society = await page.evaluate("() => !!(window.CIVICRADAR_SOCIETY_BY_WARD && window.refreshSocietyDatalist)")
        print("scripts:", scripts[-6:])
        print("openReportModal:", ok)
        print("society exports:", society)
        print("errors:", errors[:5])
        print("console:", console_msgs[:5])
        await browser.close()
        return 0 if ok and not errors else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
