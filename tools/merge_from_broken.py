#!/usr/bin/env python3
"""Apply diff hunks from _app_broken.js onto HEAD app.js; stop at first parse failure."""
import asyncio
import re
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
HEAD = ROOT / "js" / "app.js"
BROKEN = ROOT / "tests" / "_app_broken.js"


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


def unified_diff():
    return subprocess.run(
        ["git", "diff", "--no-index", str(HEAD), str(BROKEN)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    ).stdout


def parse_hunks(diff_text: str) -> list[str]:
    hunks = []
    cur = []
    for line in diff_text.splitlines():
        if line.startswith("@@"):
            if cur:
                hunks.append("\n".join(cur))
            cur = [line]
        elif cur and (line.startswith("+") or line.startswith("-") or line.startswith(" ")):
            cur.append(line)
    if cur:
        hunks.append("\n".join(cur))
    return hunks


def apply_hunk(lines: list[str], hunk: str) -> list[str]:
    rows = hunk.splitlines()
    header = rows[0]
    m = re.search(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", header)
    if not m:
        return lines
    old_start = int(m.group(1))
    idx = old_start - 1
    for row in rows[1:]:
        if row.startswith("-"):
            if idx < len(lines):
                del lines[idx]
        elif row.startswith("+"):
            lines.insert(idx, row[1:])
            idx += 1
        elif row.startswith(" "):
            idx += 1
    return lines


async def main():
    base = HEAD.read_text(encoding="utf-8").splitlines()
    diff = unified_diff()
    hunks = parse_hunks(diff)
    print(f"hunks: {len(hunks)}")
    applied = base[:]
    failed_at = None
    for i, hunk in enumerate(hunks, 1):
        trial = apply_hunk(applied[:], hunk)
        err = await parse("\n".join(trial))
        if err:
            print(f"hunk {i} FAIL: {err[:80]}")
            print(hunk.splitlines()[0])
            print("\n".join(hunk.splitlines()[1:8]))
            failed_at = i
            break
        applied = trial
        if i % 10 == 0 or i <= 8:
            print(f"hunk {i}: OK")
    if failed_at is None:
        HEAD.write_text("\n".join(applied) + "\n", encoding="utf-8")
        print("All hunks applied successfully")
    else:
        print(f"Stopped at hunk {failed_at}; saved {failed_at - 1} hunks")
        HEAD.write_text("\n".join(applied) + "\n", encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
