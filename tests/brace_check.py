#!/usr/bin/env python3
from pathlib import Path

text = Path(__file__).resolve().parents[1].joinpath("js", "app.js").read_text(encoding="utf-8")
depth = 0
in_s = None
in_c = False
esc = False
for i, ch in enumerate(text):
    if in_c:
        if ch == "\n":
            in_c = False
        continue
    if in_s:
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == in_s:
            in_s = None
        continue
    if ch == "/" and i + 1 < len(text) and text[i + 1] == "/":
        in_c = True
        continue
    if ch in "'\"":
        in_s = ch
        continue
    if ch == "{":
        depth += 1
    elif ch == "}":
        depth -= 1
        if depth < 0:
            line = text[:i].count("\n") + 1
            print("extra } at line", line)
            break
else:
    print("final depth", depth)
