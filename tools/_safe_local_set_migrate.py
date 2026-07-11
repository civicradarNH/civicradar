#!/usr/bin/env python3
"""Replace unguarded localStorage.setItem with safeLocalSet in js/app.js."""
from __future__ import annotations

import re
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "js" / "app.js"


def skip_string_or_comment(text: str, i: int) -> int | None:
    n = len(text)
    c = text[i]
    if c in ('"', "'", "`"):
        quote = c
        i += 1
        while i < n:
            if text[i] == "\\":
                i += 2
                continue
            if text[i] == quote:
                return i + 1
            if quote == "`" and text[i] == "$" and i + 1 < n and text[i + 1] == "{":
                i += 2
                depth = 1
                while i < n and depth:
                    ch = text[i]
                    if ch in ('"', "'"):
                        q = ch
                        i += 1
                        while i < n:
                            if text[i] == "\\":
                                i += 2
                                continue
                            if text[i] == q:
                                i += 1
                                break
                            i += 1
                        continue
                    if ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                    i += 1
                continue
            i += 1
        return n
    if c == "/" and i + 1 < n and text[i + 1] == "/":
        i += 2
        while i < n and text[i] not in "\n\r":
            i += 1
        return i
    if c == "/" and i + 1 < n and text[i + 1] == "*":
        i += 2
        while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
            i += 1
        return min(i + 2, n)
    return None


def find_fn_range(text: str, name: str) -> tuple[int, int] | None:
    m = re.search(rf"function {name}\s*\([^)]*\)\s*\{{", text)
    if not m:
        return None
    start = m.start()
    i = m.end() - 1
    depth = 0
    n = len(text)
    while i < n:
        skipped = skip_string_or_comment(text, i)
        if skipped is not None:
            i = skipped
            continue
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return (start, i + 1)
        i += 1
    return None


def positions_inside_try(text: str) -> set[int]:
    """Return character offsets that lie inside any try { ... } body."""
    inside: set[int] = set()
    brace_stack: list[bool] = []
    i = 0
    n = len(text)
    while i < n:
        skipped = skip_string_or_comment(text, i)
        if skipped is not None:
            i = skipped
            continue
        if (
            text.startswith("try", i)
            and (i == 0 or not (text[i - 1].isalnum() or text[i - 1] in "_$"))
            and (i + 3 >= n or not (text[i + 3].isalnum() or text[i + 3] in "_$"))
        ):
            j = i + 3
            while j < n and text[j].isspace():
                j += 1
            if j < n and text[j] == "{":
                brace_stack.append(True)
                i = j + 1
                continue
        c = text[i]
        if c == "{":
            brace_stack.append(False)
            i += 1
            continue
        if c == "}":
            if brace_stack:
                brace_stack.pop()
            i += 1
            continue
        if any(brace_stack):
            inside.add(i)
        i += 1
    return inside


def main() -> None:
    text = APP.read_text(encoding="utf-8")
    skip_ranges = []
    for name in ("saveReports", "saveUser", "safeLocalSet"):
        r = find_fn_range(text, name)
        print(f"{name}: {r}")
        if r:
            skip_ranges.append(r)

    inside_try = positions_inside_try(text)
    pattern = re.compile(r"localStorage\.setItem\s*\(")
    matches = list(pattern.finditer(text))

    def in_skip(pos: int) -> bool:
        return any(a <= pos < b for a, b in skip_ranges)

    replacements: list[tuple[int, int, str]] = []
    for m in matches:
        pos = m.start()
        if in_skip(pos):
            continue
        if pos in inside_try:
            continue
        # Replace only the callee name, preserve args exactly
        end = m.end() - 1  # keep '('
        old = text[m.start() : end]
        assert old.startswith("localStorage.setItem")
        replacements.append((m.start(), end, "safeLocalSet"))

    print(f"total localStorage.setItem: {len(matches)}")
    print(f"replacements: {len(replacements)}")
    for start, end, _ in replacements:
        line = text.count("\n", 0, start) + 1
        snip = text[start : start + 90].replace("\n", " ")
        print(f"  L{line}: {snip}")

    # Apply from end to start
    out = text
    for start, end, new in reversed(replacements):
        out = out[:start] + new + out[end:]

    APP.write_text(out, encoding="utf-8", newline="\n")
    print(f"Wrote {APP}")

    # Verify remaining unguarded
    inside_try2 = positions_inside_try(out)
    skip_ranges2 = []
    for name in ("saveReports", "saveUser", "safeLocalSet"):
        r = find_fn_range(out, name)
        if r:
            skip_ranges2.append(r)
    remaining = []
    for m in re.finditer(r"localStorage\.setItem\s*\(", out):
        pos = m.start()
        if any(a <= pos < b for a, b in skip_ranges2):
            continue
        if pos in inside_try2:
            continue
        line = out.count("\n", 0, pos) + 1
        remaining.append(line)
    print(f"remaining unguarded (excl saveReports/saveUser/safeLocalSet): {len(remaining)}")
    if remaining:
        print("  lines:", remaining)


if __name__ == "__main__":
    main()
