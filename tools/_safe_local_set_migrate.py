#!/usr/bin/env python3
"""Replace unguarded localStorage.setItem with safeLocalSet in js/app.js.

Uses lookback try-enclosure detection (avoids backtick-desync on this file).
Skips saveReports, saveUser, and safeLocalSet entirely.
Does not touch anything already inside a try { ... } body.
"""
from __future__ import annotations

import re
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "js" / "app.js"
LOOKBACK = 2000


def skip_string(text: str, i: int) -> int:
    """Skip a string starting at i; simple (no template ${} nesting)."""
    n = len(text)
    q = text[i]
    i += 1
    while i < n:
        if text[i] == "\\":
            i += 2
            continue
        if text[i] == q:
            return i + 1
        i += 1
    return n


def find_fn_range(text: str, name: str) -> tuple[int, int] | None:
    m = re.search(rf"function {name}\s*\([^)]*\)\s*\{{", text)
    if not m:
        return None
    start = m.start()
    i = m.end() - 1
    depth = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c in ('"', "'", "`"):
            i = skip_string(text, i)
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            i += 2
            while i < n and text[i] not in "\n\r":
                i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i = min(i + 2, n)
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return (start, i + 1)
        i += 1
    return None


def enclosed_in_try(text: str, pos: int) -> bool:
    """True if pos lies inside any try { ... } body (lookback window)."""
    window_start = max(0, pos - LOOKBACK)
    chunk = text[window_start:pos]
    for m in re.finditer(r"\btry\s*\{", chunk):
        abs_brace = window_start + m.end() - 1
        depth = 0
        j = abs_brace
        n = len(text)
        while j < n:
            c = text[j]
            if c in ('"', "'", "`"):
                j = skip_string(text, j)
                continue
            if c == "/" and j + 1 < n and text[j + 1] == "/":
                j += 2
                while j < n and text[j] not in "\n\r":
                    j += 1
                continue
            if c == "/" and j + 1 < n and text[j + 1] == "*":
                j += 2
                while j + 1 < n and not (text[j] == "*" and text[j + 1] == "/"):
                    j += 1
                j = min(j + 2, n)
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    if abs_brace < pos < j:
                        return True
                    break
            j += 1
    return False


def main() -> None:
    text = APP.read_text(encoding="utf-8")
    # Preserve original newline style
    nl = "\r\n" if "\r\n" in text else "\n"

    skip_ranges: list[tuple[int, int]] = []
    for name in ("saveReports", "saveUser", "safeLocalSet"):
        r = find_fn_range(text, name)
        print(f"{name}: {r}")
        if r:
            skip_ranges.append(r)

    def in_skip(pos: int) -> bool:
        return any(a <= pos < b for a, b in skip_ranges)

    matches = list(re.finditer(r"localStorage\.setItem\s*\(", text))
    replacements: list[tuple[int, int]] = []
    for m in matches:
        pos = m.start()
        if in_skip(pos):
            print(f"  SKIP fn  L{text.count(chr(10), 0, pos)+1}")
            continue
        if enclosed_in_try(text, pos):
            continue
        end = m.end() - 1  # keep '('
        replacements.append((m.start(), end))

    print(f"total localStorage.setItem: {len(matches)}")
    print(f"replacements: {len(replacements)}")
    for start, end in replacements:
        line = text.count("\n", 0, start) + 1
        snip = text[start : start + 90].replace("\n", " ")
        print(f"  L{line}: {snip}")

    out = text
    for start, end in reversed(replacements):
        out = out[:start] + "safeLocalSet" + out[end:]

    # Write preserving content; pathlib write_text may normalize newlines —
    # use binary-ish approach via encoding only
    APP.write_text(out, encoding="utf-8", newline="" if nl == "\n" else None)
    # On Windows newline="" means keep \n as written in string
    if nl == "\r\n" and "\r\n" not in out and "\n" in out:
        # original had CRLF but read_text stripped them — re-apply
        APP.write_bytes(out.replace("\n", "\r\n").encode("utf-8"))
    else:
        APP.write_bytes(out.encode("utf-8"))

    print(f"Wrote {APP}")

    # Verify
    remaining = []
    for m in re.finditer(r"localStorage\.setItem\s*\(", out):
        pos = m.start()
        if any(a <= pos < b for a, b in [
            find_fn_range(out, n) for n in ("saveReports", "saveUser", "safeLocalSet") if find_fn_range(out, n)
        ]):
            continue
        if enclosed_in_try(out, pos):
            continue
        remaining.append(out.count("\n", 0, pos) + 1)
    print(f"remaining unguarded: {len(remaining)} {remaining}")


if __name__ == "__main__":
    main()
