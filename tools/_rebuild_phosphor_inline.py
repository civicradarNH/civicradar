#!/usr/bin/env python3
"""Rebuild css/phosphor-lite.css with inlined SVG data-URI masks (no network)."""
from __future__ import annotations

import re
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICON_NAMES = ROOT / "tools" / "_icon_names.txt"
ICONS_DIR = ROOT / "vendor" / "icons"
CSS_PATH = ROOT / "css" / "phosphor-lite.css"


def minify_svg(svg: str) -> str:
    svg = re.sub(r"<\?xml[^?]*\?>", "", svg)
    svg = re.sub(r"<!DOCTYPE[^>]*>", "", svg, flags=re.IGNORECASE)
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.DOTALL)
    svg = re.sub(r">\s+<", "><", svg)
    svg = re.sub(r"\s+", " ", svg)
    # Opaque black fill so CSS masks work when currentColor is undefined in SVG docs
    svg = svg.replace('fill="currentColor"', 'fill="black"')
    svg = svg.replace("fill='currentColor'", "fill='black'")
    return svg.strip()


def main() -> int:
    names = [
        line.strip()
        for line in ICON_NAMES.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    ok: list[str] = []
    missing: list[str] = []
    lines = [
        "/* phosphor-lite - subset; inlined SVG masks (tools/_rebuild_phosphor_inline.py) */",
        "i.ph, .ph {",
        "  display: inline-flex;",
        "  align-items: center;",
        "  justify-content: center;",
        "  width: 1em;",
        "  height: 1em;",
        "  line-height: 1;",
        "  speak: never;",
        "  flex-shrink: 0;",
        "  font-style: normal;",
        "}",
        "",
    ]
    for name in names:
        path = ICONS_DIR / f"{name}.svg"
        if not path.exists():
            missing.append(name)
            continue
        uri = f'url("data:image/svg+xml,{urllib.parse.quote(minify_svg(path.read_text(encoding="utf-8")), safe="")}")'
        lines.append(f"i.ph.ph-{name}::before, .ph.ph-{name}::before {{")
        lines.append("  content: '';")
        lines.append("  display: block;")
        lines.append("  width: 1em;")
        lines.append("  height: 1em;")
        lines.append("  background-color: currentColor;")
        lines.append(f"  -webkit-mask-image: {uri};")
        lines.append(f"  mask-image: {uri};")
        lines.append("  -webkit-mask-size: contain;")
        lines.append("  mask-size: contain;")
        lines.append("  -webkit-mask-repeat: no-repeat;")
        lines.append("  mask-repeat: no-repeat;")
        lines.append("  -webkit-mask-position: center;")
        lines.append("  mask-position: center;")
        lines.append("}")
        lines.append("")
        ok.append(name)

    CSS_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"OK {len(ok)} icons -> {CSS_PATH} ({CSS_PATH.stat().st_size / 1024:.1f} KB)")
    if missing:
        print("Missing:", ", ".join(missing))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
