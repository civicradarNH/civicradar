"""Build ~4 min CivicRadar promo with motion + procedural background music."""
from __future__ import annotations

import math
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path

import imageio.v3 as iio
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT_VIDEO = ASSETS / "play-promo-video-4min.mp4"
OUT_AUDIO = ASSETS / "promo-bg-music.wav"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

W, H = 1280, 720
FPS = 30
DURATION = 240.0
BG = (99, 102, 241)
BG_DARK = (30, 27, 75)
WHITE = (255, 255, 255)
MUTED = (226, 232, 240)
ACCENT = (251, 191, 36)
PINK = (236, 72, 153)


@dataclass
class Scene:
    builder: str
    seconds: float
    caption: str = ""
    asset: str = ""


def load_font(size: int, bold: bool = False):
    names = ("segoeuib.ttf", "arialbd.ttf") if bold else ("segoeui.ttf", "arial.ttf")
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def gradient(c1=BG, c2=BG_DARK) -> Image.Image:
    img = Image.new("RGB", (W, H), c1)
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        col = tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3))
        draw.line([(0, y), (W, y)], fill=col)
    return img


def wrap(draw, text, font, max_w):
    words = text.split()
    lines, cur = [], []
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


def draw_text_slide(eyebrow, headline, body, accent=ACCENT) -> Image.Image:
    img = gradient()
    d = ImageDraw.Draw(img)
    y = 64
    d.text((56, y), eyebrow.upper(), fill=accent, font=load_font(26, True))
    y += 46
    for line in wrap(d, headline, load_font(54, True), W - 112):
        d.text((56, y), line, fill=WHITE, font=load_font(54, True))
        y += 62
    y += 12
    for line in wrap(d, body, load_font(32), W - 112):
        d.text((56, y), line, fill=MUTED, font=load_font(32))
        y += 42
    d.rounded_rectangle((56, H - 92, 430, H - 38), radius=16, fill=(255, 255, 255, 30))
    d.text((78, H - 78), "Map it · Snap it · Report it", fill=WHITE, font=load_font(22, True))
    d.text((56, H - 28), "Independent community app — not official BMC", fill=(180, 180, 220), font=load_font(20))
    return img


def draw_asset_slide(asset_path: Path, caption: str) -> Image.Image:
    img = gradient(BG_DARK, (15, 23, 42))
    d = ImageDraw.Draw(img)
    base = Image.open(asset_path).convert("RGBA")
    max_w, max_h = W - 100, H - 210
    scale = min(max_w / base.width, max_h / base.height)
    tw, th = int(base.width * scale), int(base.height * scale)
    base = base.resize((tw, th), Image.Resampling.LANCZOS)
    x, y = (W - tw) // 2, 72 + (max_h - th) // 2
    shadow = Image.new("RGBA", (tw + 40, th + 40), (0, 0, 0, 0))
    sh_draw = ImageDraw.Draw(shadow)
    sh_draw.rounded_rectangle((10, 10, tw + 30, th + 30), radius=24, fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    img.paste(shadow, (x - 10, y - 6), shadow)
    img.paste(base, (x, y), base)
    f = load_font(28, True)
    for i, line in enumerate(wrap(d, caption, f, W - 80)):
        d.text((40, H - 118 + i * 34), line, fill=WHITE, font=f)
    return img


def draw_cta() -> Image.Image:
    img = gradient((79, 70, 229), (49, 46, 129))
    d = ImageDraw.Draw(img)
    d.text((56, 110), "DOWNLOAD FREE ON GOOGLE PLAY", fill=ACCENT, font=load_font(28, True))
    d.text((56, 170), "CivicRadar", fill=WHITE, font=load_font(86, True))
    d.text((56, 270), "Mumbai · Pune · Thane", fill=MUTED, font=load_font(34))
    bullets = [
        "Free for citizens · No ads · 4 languages",
        "Me Too · Neighbourhood alerts · Civic Hero XP",
        "Share hazard pins on WhatsApp with your society",
    ]
    y = 360
    for b in bullets:
        d.text((56, y), f"✓  {b}", fill=WHITE, font=load_font(28))
        y += 44
    d.text((56, H - 34), "Independent community app — not official BMC", fill=(190, 190, 220), font=load_font(20))
    return img


def draw_count_slide(number: str, label: str) -> Image.Image:
    img = gradient((67, 56, 202), (30, 27, 75))
    d = ImageDraw.Draw(img)
    d.text((W // 2 - 40, 180), number, fill=ACCENT, font=load_font(160, True))
    for i, line in enumerate(wrap(d, label, load_font(42, True), W - 120)):
        lw = d.textlength(line, font=load_font(42, True))
        d.text(((W - lw) // 2, 390 + i * 52), line, fill=WHITE, font=load_font(42, True))
    return img


def build_scene_image(scene: Scene) -> Image.Image:
    if scene.builder == "cta":
        return draw_cta()
    if scene.builder == "asset":
        return draw_asset_slide(ASSETS / scene.asset, scene.caption)
    if scene.builder == "count":
        num, label = scene.caption.split("|", 1)
        return draw_count_slide(num, label)
    eyebrow, headline, body = scene.caption.split("|", 2)
    return draw_text_slide(eyebrow, headline, body)


def animate_scene(base: Image.Image, seconds: float, mode: str) -> list[np.ndarray]:
    n = max(1, int(seconds * FPS))
    arr = np.asarray(base.convert("RGB"))
    h, w = arr.shape[:2]
    frames: list[np.ndarray] = []

    for i in range(n):
        t = i / max(n - 1, 1)
        img = Image.fromarray(arr)

        if mode == "zoom":
            scale = 1.0 + 0.08 * t
            nw, nh = int(w * scale), int(h * scale)
            img = img.resize((nw, nh), Image.Resampling.LANCZOS)
            x0, y0 = (nw - w) // 2, (nh - h) // 2
            img = img.crop((x0, y0, x0 + w, y0 + h))
        elif mode == "slide_left":
            offset = int((1 - min(t * 1.4, 1)) * 120)
            canvas = Image.new("RGB", (w, h), BG_DARK)
            canvas.paste(img, (-offset, 0))
            img = canvas
        elif mode == "pulse":
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(1.0 + 0.12 * math.sin(t * math.pi * 4))
        elif mode == "kenburns_up":
            scale = 1.05 + 0.1 * t
            nw, nh = int(w * scale), int(h * scale)
            img = img.resize((nw, nh), Image.Resampling.LANCZOS)
            x0 = (nw - w) // 2
            y0 = int((nh - h) * t * 0.35)
            img = img.crop((x0, y0, x0 + w, y0 + h))
        elif mode == "flash":
            if t < 0.08:
                img = Image.new("RGB", (w, h), WHITE)
            elif t < 0.16:
                img = Image.fromarray(arr)
                img = ImageEnhance.Brightness(img).enhance(1.35)
        frames.append(np.asarray(img))
    return frames


def crossfade(a: np.ndarray, b: np.ndarray, steps: int = 15) -> list[np.ndarray]:
    out = []
    for i in range(steps):
        t = (i + 1) / steps
        out.append((a.astype(np.float32) * (1 - t) + b.astype(np.float32) * t).astype(np.uint8))
    return out


def build_scenes() -> list[tuple[Scene, str]]:
    files = [
        "play-feature-graphic-1024x500.png",
        "play-feature-graphic-v2-monsoon.png",
        "play-feature-graphic-v3-map.png",
        "play-feature-graphic-v4-community.png",
        "play-feature-graphic-v5-hero.png",
        "civicradar-reveal-onepager-16x9.png",
        "civicradar-reveal-onepager-9x16.png",
    ]
    existing = [f for f in files if (ASSETS / f).exists()]

    return [
        (Scene("text", 14, "Monsoon 2026|Barish aayi? Ab sirf complain nahi.|Pin stagnant water on a live ward map. Rally neighbours. Track fixes."), "flash"),
        (Scene("count", 8, "30 sec|One photo. One pin. Done."), "pulse"),
        (Scene("text", 12, "The problem|WhatsApp pe 200 messages. Zero map.|CivicRadar turns every hazard into proof your whole area can see."), "slide_left"),
        (Scene("asset", 14, "Live ward hazard map for Mumbai, Pune & Thane", existing[2] if len(existing) > 2 else files[2]), "kenburns_up"),
        (Scene("text", 12, "Map it|See hazards near you|Open the map — stagnant water, blocked drains, and local issues pinned in your ward."), "zoom"),
        (Scene("asset", 12, "Built for monsoon season", existing[1] if len(existing) > 1 else files[1]), "zoom"),
        (Scene("text", 12, "Snap it|Photo evidence in one tap|Camera on. EXIF stripped for privacy. Your report stays tied to the exact spot."), "slide_left"),
        (Scene("count", 8, "4|Languages — English, Hindi, Marathi, Gujarati"), "pulse"),
        (Scene("text", 12, "Report it|Three taps — ward, photo, submit|No email login for citizens. Set your ward once and start reporting."), "zoom"),
        (Scene("asset", 12, "Pin it on the community map", existing[0] if existing else files[0]), "kenburns_up"),
        (Scene("text", 12, "Me Too|Neighbours corroborate|Same problem? Tap Me Too. One pin becomes many witnesses — stronger voice."), "pulse"),
        (Scene("asset", 12, "Share pins in your RWA WhatsApp group", existing[3] if len(existing) > 3 else files[3]), "zoom"),
        (Scene("text", 10, "Alerts|Neighbourhood notifications|Opt in when neighbours report new hazards or when spots get resolved nearby."), "slide_left"),
        (Scene("text", 10, "Track fixes|Before & after wins|See resolved hazards and share community cleanup wins."), "zoom"),
        (Scene("asset", 12, "Civic Hero XP — level up as you help", existing[4] if len(existing) > 4 else files[4]), "kenburns_up"),
        (Scene("text", 10, "Optional filing|File with BMC / PMC / TMC if you choose|CivicRadar is independent — not an official municipal app."), "slide_left"),
        (Scene("asset", 10, "Barish aayi? PIN karo.", existing[6] if len(existing) > 6 else (existing[5] if len(existing) > 5 else files[0])), "pulse"),
        (Scene("cta", 16, ""), "zoom"),
    ]


def render_video() -> Path:
    scenes = build_scenes()
    total_sec = sum(s.seconds for s, _ in scenes)
    scale = DURATION / total_sec
    frames: list[np.ndarray] = []

    for idx, (scene, mode) in enumerate(scenes):
        img = build_scene_image(scene)
        chunk = animate_scene(img, scene.seconds * scale, mode)
        if idx == 0:
            frames.extend(chunk)
        else:
            frames.extend(crossfade(frames[-1], chunk[0]))
            frames.extend(chunk[1:])

    target = int(DURATION * FPS)
    if len(frames) < target:
        last = frames[-1]
        frames.extend([last.copy() for _ in range(target - len(frames))])
    else:
        frames = frames[:target]

    silent = ASSETS / "play-promo-video-4min-silent.mp4"
    iio.imwrite(silent, frames, fps=FPS, codec="libx264", quality=8, pixelformat="yuv420p")
    return silent


def synth_music(path: Path, duration: float) -> None:
    sr = 44100
    n = int(duration * sr)
    t = np.linspace(0, duration, n, endpoint=False)

    # Upbeat 118 BPM electronic bed (procedural, royalty-free)
    bpm = 118
    beat = (t * bpm / 60) % 1
    kick = np.where(beat < 0.08, np.sin(2 * np.pi * 60 * t) * np.exp(-18 * beat), 0)
    kick *= 0.35

    chords = [(220, 261.63, 329.63), (174.61, 220, 261.63), (196, 246.94, 293.66), (164.81, 207.65, 246.94)]
    bar_len = 60 / bpm * 4
    pad = np.zeros(n)
    arp = np.zeros(n)
    for i, (r, m3, p5) in enumerate(chords):
        start = int(i * bar_len * sr)
        end = int(min((i + 1) * bar_len * sr, n))
        seg = end - start
        if seg <= 0:
            continue
        tt = t[start:end]
        env = np.linspace(0.8, 0.55, seg)
        pad[start:end] += (0.06 * np.sin(2 * np.pi * r * tt) + 0.045 * np.sin(2 * np.pi * m3 * tt) + 0.04 * np.sin(2 * np.pi * p5 * tt)) * env
        step = int(0.5 * sr / 2)
        for j in range(0, seg, step):
            j2 = min(j + step, seg)
            freq = [r * 2, m3 * 2, p5 * 2, m3 * 2][(j // step) % 4]
            arp[start + j:start + j2] += 0.05 * np.sin(2 * np.pi * freq * tt[j:j2])

    fade = np.ones(n)
    fade_in = int(2 * sr)
    fade_out = int(3 * sr)
    fade[:fade_in] = np.linspace(0, 1, fade_in)
    fade[-fade_out:] = np.linspace(1, 0, fade_out)

    audio = (kick + pad + arp) * fade
    audio = audio / (np.max(np.abs(audio)) + 1e-9) * 0.82
    pcm = (audio * 32767).astype(np.int16)

    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())


def mux(video: Path, audio: Path, out: Path) -> None:
    cmd = [
        FFMPEG, "-y",
        "-i", str(video),
        "-i", str(audio),
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(out),
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    silent = render_video()
    synth_music(OUT_AUDIO, DURATION)
    mux(silent, OUT_AUDIO, OUT_VIDEO)
    print(f"Wrote {OUT_VIDEO} ({DURATION}s) with music {OUT_AUDIO}")


if __name__ == "__main__":
    main()
