#!/usr/bin/env python3
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

LINES = Path(__file__).resolve().parents[1].joinpath("js", "app.js").read_text(encoding="utf-8").splitlines()


async def parses(code: str) -> bool:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        err = await page.evaluate(
            """(code) => { try { new Function(code); return ''; } catch (e) { return String(e); } }""",
            code,
        )
        await browser.close()
        return not err


def with_tail_disabled(end_line: int) -> str:
    """Keep lines [0:end_line), comment out rest including final }); then re-add close."""
    if end_line >= len(LINES):
        return "\n".join(LINES)
    head = LINES[:end_line]
    tail = LINES[end_line:]
    # drop trailing }); from head if we're commenting the rest
    out = head + ["/*__DISABLED__"] + tail + ["*/"]
    return "\n".join(out)


async def main():
    lo, hi = 100, len(LINES)
    # verify full file fails
    full_ok = await parses("\n".join(LINES))
    print("full file parses:", full_ok)
    while lo + 50 < hi:
        mid = (lo + hi) // 2
        ok = await parses(with_tail_disabled(mid))
        print(f"disable after {mid}: {'OK' if ok else 'FAIL'}")
        if ok:
            lo = mid
        else:
            hi = mid
    print(f"error region: lines {lo+1} to {hi}")
    for i in range(lo, min(len(LINES), lo + 12)):
        print(f"  {i+1}: {LINES[i][:100]}")


if __name__ == "__main__":
    asyncio.run(main())
