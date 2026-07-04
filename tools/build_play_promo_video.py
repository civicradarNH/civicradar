"""Build a 30s CivicRadar Play Store promo MP4 from feature graphic PNGs."""
from __future__ import annotations

import math
from pathlib import Path

import imageio.v3 as iio
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ASSETS / "play-promo-video-30s.mp4"

SLIDES = [
    ASSETS / "play-feature-graphic-1024x500.png",
    ASSETS / "play-feature-graphic-v2-monsoon.png",
    ASSETS / "play-feature-graphic-v3-map.png",
    ASSETS / "play-feature-graphic-v4-community.png",
    ASSETS / "play-feature-graphic-v5-hero.png",
]

W, H = 1280, 720
FPS = 30
SEC_PER_SLIDE = 6
BG = (99, 102, 241)  # #6366f1


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_slide(path: Path, t: float) -> np.ndarray:
    """t in [0,1] within slide — subtle zoom-in."""
    img = Image.open(path).convert("RGBA")
    scale = 1.0 + 0.06 * t
    tw, th = int(img.width * scale), int(img.height * scale)
    img = img.resize((tw, th), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (W, H), BG)
    x = (W - tw) // 2
    y = (H - th) // 2
    canvas.paste(img, (x, y), img)
    draw = ImageDraw.Draw(canvas)
    font = load_font(22)
    draw.text((24, H - 40), "Independent community app — not official BMC", fill=(255, 255, 255), font=font)
    return np.asarray(canvas)


def main() -> None:
    slides = [p for p in SLIDES if p.exists()]
    if not slides:
        raise SystemExit("No feature graphic PNGs found in assets/")

    frames: list[np.ndarray] = []
    for path in slides:
        n = SEC_PER_SLIDE * FPS
        for i in range(n):
            t = i / max(n - 1, 1)
            frames.append(render_slide(path, t))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    iio.imwrite(
        OUT,
        frames,
        fps=FPS,
        codec="libx264",
        quality=8,
        pixelformat="yuv420p",
    )
    print(f"Wrote {OUT} ({len(frames)} frames, {len(frames)/FPS:.1f}s)")


if __name__ == "__main__":
    main()
