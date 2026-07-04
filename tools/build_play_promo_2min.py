"""Build a ~2 minute CivicRadar promo MP4 for YouTube / Play Store."""
from __future__ import annotations

import textwrap
from pathlib import Path

import imageio.v3 as iio
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ASSETS / "play-promo-video-2min.mp4"

W, H = 1280, 720
FPS = 30
BG = (99, 102, 241)
BG_DARK = (67, 56, 202)
WHITE = (255, 255, 255)
MUTED = (226, 232, 240)
ACCENT = (251, 191, 36)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = (
        ("segoeuib.ttf", "arialbd.ttf") if bold else ("segoeui.ttf", "arial.ttf", "DejaVuSans.ttf")
    )
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def gradient_bg() -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        r = int(BG[0] * (1 - t) + BG_DARK[0] * t)
        g = int(BG[1] * (1 - t) + BG_DARK[1] * t)
        b = int(BG[2] * (1 - t) + BG_DARK[2] * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    return img


def wrap(draw: ImageDraw.ImageDraw, text: str, font, max_w: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur: list[str] = []
    for w in words:
        trial = " ".join(cur + [w])
        if draw.textlength(trial, font=font) <= max_w:
            cur.append(w)
        else:
            if cur:
                lines.append(" ".join(cur))
            cur = [w]
    if cur:
        lines.append(" ".join(cur))
    return lines or [text]


def text_slide(
    eyebrow: str,
    headline: str,
    body: str,
    footer: str = "Independent community app — not official BMC",
) -> Image.Image:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    f_eye = load_font(28)
    f_head = load_font(58, bold=True)
    f_body = load_font(34)
    f_foot = load_font(22)

    y = 72
    draw.text((64, y), eyebrow.upper(), fill=ACCENT, font=f_eye)
    y += 52
    for line in wrap(draw, headline, f_head, W - 128):
        draw.text((64, y), line, fill=WHITE, font=f_head)
        y += 68

    y += 18
    for line in wrap(draw, body, f_body, W - 128):
        draw.text((64, y), line, fill=MUTED, font=f_body)
        y += 46

    draw.rounded_rectangle((64, H - 88, 420, H - 36), radius=18, fill=(255, 255, 255, 40))
    draw.text((88, H - 76), "Map it · Snap it · Report it", fill=WHITE, font=load_font(24, bold=True))
    draw.text((64, H - 28), footer, fill=(200, 200, 230), font=f_foot)
    return img


def asset_slide(path: Path, caption: str) -> Image.Image:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    base = Image.open(path).convert("RGBA")
    max_w, max_h = W - 120, H - 220
    scale = min(max_w / base.width, max_h / base.height)
    tw, th = int(base.width * scale), int(base.height * scale)
    base = base.resize((tw, th), Image.Resampling.LANCZOS)
    x, y = (W - tw) // 2, 90 + (max_h - th) // 2
    img.paste(base, (x, y), base)
    f = load_font(30, bold=True)
    for i, line in enumerate(wrap(draw, caption, f, W - 100)):
        draw.text((50, H - 110 + i * 38), line, fill=WHITE, font=f)
    draw.text((50, H - 34), "CivicRadar · Mumbai · Pune · Thane", fill=MUTED, font=load_font(22))
    return img


def cta_slide() -> Image.Image:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    draw.text((64, 120), "DOWNLOAD FREE", fill=ACCENT, font=load_font(34, bold=True))
    for i, line in enumerate(
        wrap(draw, "CivicRadar on Google Play", load_font(72, bold=True), W - 128)
    ):
        draw.text((64, 190 + i * 82), line, fill=WHITE, font=load_font(72, bold=True))
    bullets = [
        "Free for citizens · No ads",
        "English · Hindi · Marathi · Gujarati",
        "Share pins on WhatsApp with your society",
    ]
    y = 420
    for b in bullets:
        draw.text((64, y), f"✓  {b}", fill=MUTED, font=load_font(30))
        y += 48
    draw.text((64, H - 40), "Independent community app — not official BMC", fill=(200, 200, 230), font=load_font(22))
    return img


def slide_frames(img: Image.Image, seconds: float, zoom: bool = True) -> list[np.ndarray]:
    n = int(seconds * FPS)
    arr = np.asarray(img.convert("RGB"))
    h, w = arr.shape[:2]
    out: list[np.ndarray] = []
    for i in range(n):
        if not zoom:
            out.append(arr.copy())
            continue
        t = i / max(n - 1, 1)
        scale = 1.0 + 0.04 * t
        nw, nh = int(w * scale), int(h * scale)
        frame = Image.fromarray(arr).resize((nw, nh), Image.Resampling.LANCZOS)
        x0 = (nw - w) // 2
        y0 = (nh - h) // 2
        cropped = frame.crop((x0, y0, x0 + w, y0 + h))
        out.append(np.asarray(cropped))
    return out


def crossfade(a: np.ndarray, b: np.ndarray, steps: int = 12) -> list[np.ndarray]:
    frames: list[np.ndarray] = []
    for i in range(steps):
        t = (i + 1) / steps
        mixed = (a.astype(np.float32) * (1 - t) + b.astype(np.float32) * t).astype(np.uint8)
        frames.append(mixed)
    return frames


def main() -> None:
    slides: list[tuple[Image.Image, float]] = [
        (text_slide("Monsoon 2026", "Barish aayi? Ab sirf complain nahi.", "Pin stagnant water on a live ward map in 30 seconds. Rally neighbours. Track fixes."), 10),
        (text_slide("The problem", "WhatsApp pe shor. Map pe proof nahi.", "CivicRadar turns every hazard into a photo pin your whole area can see."), 10),
        (asset_slide(ASSETS / "play-feature-graphic-v3-map.png", "Live ward hazard map — Mumbai, Pune & Thane"), 12),
        (text_slide("Map it", "See hazards near you", "Open the map. Pins show stagnant water, blocked drains, and local issues in your ward."), 10),
        (text_slide("Snap it", "Photo evidence in one tap", "Camera on. EXIF stripped for privacy. Your report stays tied to the exact spot."), 10),
        (asset_slide(ASSETS / "play-feature-graphic-v2-monsoon.png", "Built for monsoon — stagnant water, floods, blocked drains"), 10),
        (text_slide("Report it", "Three taps — ward, photo, done", "No email login for citizens. Set your ward once and start reporting."), 10),
        (text_slide("Me Too", "Neighbours corroborate", "Same problem? Tap Me Too. One pin becomes ten witnesses — stronger community voice."), 10),
        (asset_slide(ASSETS / "play-feature-graphic-v4-community.png", "Share pins in your RWA / society WhatsApp group"), 10),
        (text_slide("Stay alerted", "Neighbourhood alerts", "Opt in when neighbours report new hazards or when spots get resolved nearby."), 8),
        (text_slide("Civic Hero", "Level up as you help", "Earn Civic Hero XP and shareable certificates as you map and fix your area."), 8),
        (asset_slide(ASSETS / "play-feature-graphic-v5-hero.png", "Civic Hero XP — from Local Observer to Neighbourhood Ninja"), 10),
        (text_slide("For India", "4 languages · Free · No ads", "English, Hindi, Marathi, Gujarati. Always free for residents."), 8),
        (cta_slide(), 12),
    ]

    frames: list[np.ndarray] = []
    for idx, (slide, sec) in enumerate(slides):
        chunk = slide_frames(slide, sec)
        if idx == 0:
            frames.extend(chunk)
        else:
            fade = crossfade(frames[-1], chunk[0])
            frames.extend(fade)
            frames.extend(chunk[1:])

    target = 120 * FPS
    if len(frames) < target:
        last = frames[-1]
        frames.extend([last.copy() for _ in range(target - len(frames))])
    elif len(frames) > target:
        frames = frames[:target]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    iio.imwrite(OUT, frames, fps=FPS, codec="libx264", quality=8, pixelformat="yuv420p")
    print(f"Wrote {OUT} — {len(frames)/FPS:.1f}s, {len(frames)} frames")


if __name__ == "__main__":
    main()
