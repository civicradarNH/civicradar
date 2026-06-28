#!/usr/bin/env python3
from pathlib import Path

lines = Path(__file__).resolve().parents[1].joinpath("js", "app.js").read_text(encoding="utf-8").splitlines()
for i in range(len(lines) - 1):
    s = lines[i].strip()
    n = lines[i + 1].strip()
    if s.startswith("const ") and "=" not in s.split("//")[0] and n.startswith("/"):
        print(i + 1, s[:80])
        print(i + 2, n[:80])
    if s.startswith("const ") and s.endswith(",") and not s.endswith("= {"):
        print("comma const", i + 1, s[:80])
    if s == "const" or s.startswith("const ") and s.rstrip().endswith("const"):
        print("bare const", i + 1, s)
