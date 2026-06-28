#!/usr/bin/env python3
"""Bisect which diff hunk introduces JS syntax error."""
import asyncio
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]


def get_head_app() -> str:
    return subprocess.check_output(["git", "show", "HEAD:js/app.js"], cwd=ROOT).decode("utf-8")


def get_hunks() -> list[str]:
    diff = subprocess.check_output(["git", "diff", "js/app.js"], cwd=ROOT).decode("utf-8", errors="replace")
    hunks = []
    cur = []
    for line in diff.splitlines():
        if line.startswith("@@"):
            if cur:
                hunks.append("\n".join(cur))
            cur = [line]
        elif cur and (line.startswith("+") or line.startswith("-") or line.startswith(" ")):
            cur.append(line)
    if cur:
        hunks.append("\n".join(cur))
    return hunks


def apply_hunk(base_lines: list[str], hunk: str) -> list[str]:
    lines = base_lines[:]
    parts = hunk.splitlines()
    header = parts[0]
    # @@ -start,count +start,count @@
    import re
    m = re.search(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", header)
    if not m:
        return lines
    old_start = int(m.group(1))
    new_start = int(m.group(3))
    idx = old_start - 1
    for row in parts[1:]:
        if row.startswith("-"):
            if idx < len(lines) and lines[idx] == row[1:]:
                del lines[idx]
            elif idx < len(lines):
                del lines[idx]
        elif row.startswith("+"):
            lines.insert(idx, row[1:])
            idx += 1
        elif row.startswith(" "):
            idx += 1
    return lines


async def parse(code: str) -> str:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        err = await page.evaluate(
            """(code) => { try { new Function(code); return ''; } catch (e) { return String(e); } }""",
            code,
        )
        await browser.close()
        return err


async def main():
    base = get_head_app().splitlines()
    hunks = get_hunks()
    print(f"hunks: {len(hunks)}")
    applied = base[:]
    for i, hunk in enumerate(hunks, 1):
        applied = apply_hunk(applied, hunk)
        err = await parse("\n".join(applied))
        status = "OK" if not err else err[:60]
        print(f"hunk {i}: {status}")
        if err:
            print("first line of hunk:", hunk.splitlines()[0])
            print(hunk.splitlines()[1:6])
            break


if __name__ == "__main__":
    asyncio.run(main())
