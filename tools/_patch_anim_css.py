# -*- coding: utf-8 -*-
"""Move replayCertMedal to after openModal; add CSS for 8.x / 8.7 / 8.8."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
app_path = ROOT / "js" / "app.js"
css_path = ROOT / "css" / "styles.css"

app = app_path.read_text(encoding="utf-8")

# Move replay out of icon setup — fire after openModal so spin starts when visible
old = """    if (icon) {

      icon.style.setProperty('--cert-badge', badge.fill);

      icon.classList.remove('cert-badge--pop');

      replayCertMedal(icon);

    }



    if (previewWrap) previewWrap.hidden = true;

    if (previewImg) previewImg.removeAttribute('src');



    if (actions) actions.forEach((el) => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });



    openModal('certificate');"""

new = """    if (icon) {

      icon.style.setProperty('--cert-badge', badge.fill);

      icon.classList.remove('cert-badge--pop');

    }



    if (previewWrap) previewWrap.hidden = true;

    if (previewImg) previewImg.removeAttribute('src');



    if (actions) actions.forEach((el) => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });



    openModal('certificate');

    replayCertMedal(icon);"""

if old in app:
    app = app.replace(old, new, 1)
    print("replayCertMedal moved after openModal")
elif "openModal('certificate');\n\n    replayCertMedal(icon);" in app:
    print("already after openModal")
else:
    print("WARN: could not move replayCertMedal")

app_path.write_text(app, encoding="utf-8")

css = css_path.read_text(encoding="utf-8")

# --- Certificate coin-flip (after .success-icon--cert.cert-badge--pop block) ---
if ".cert-medal-shine" not in css:
    cert_css = """
/* 8.6 Certificate coin-flip medal unlock */
.cert-medal {
  position: relative;
  transform-style: preserve-3d;
  animation: cert-coin-spin 1.1s var(--ease-out-soft) both;
}

.cert-medal-shine {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  overflow: hidden;
  pointer-events: none;
}

.cert-medal-shine::after {
  content: '';
  position: absolute;
  top: -20%;
  left: -60%;
  width: 40%;
  height: 140%;
  background: linear-gradient(75deg, transparent, rgba(255, 255, 255, 0.85), transparent);
  animation: cert-shine-sweep 1.1s ease-out 0.35s both;
}

@keyframes cert-coin-spin {
  0% { transform: rotateY(0deg) scale(0.6); opacity: 0; }
  55% { transform: rotateY(720deg) scale(1.08); opacity: 1; }
  100% { transform: rotateY(1080deg) scale(1); }
}

@keyframes cert-shine-sweep {
  from { left: -60%; }
  to { left: 120%; }
}

"""
    marker = ".success-icon--cert.cert-badge--pop {\n  animation: cert-badge-pop 0.55s var(--ease-spring) both;\n}"
    if marker in css:
        css = css.replace(marker, marker + "\n" + cert_css, 1)
        print("cert CSS inserted")
    else:
        # insert before .certificate-preview
        marker2 = ".certificate-preview {\n  margin: 8px 0 14px;\n}"
        if marker2 in css:
            css = css.replace(marker2, cert_css + marker2, 1)
            print("cert CSS inserted before preview")
        else:
            raise SystemExit("cert CSS marker not found")

    # Update reduced-motion block near cert
    old_rm = """@media (prefers-reduced-motion: reduce) {
  .success-icon--cert.cert-badge--pop,
  .cert-actions--reveal {
    animation: none !important;
  }
}"""
    new_rm = """@media (prefers-reduced-motion: reduce) {
  .success-icon--cert.cert-badge--pop,
  .cert-medal,
  .cert-medal-shine::after,
  .cert-actions--reveal {
    animation: none !important;
  }
}"""
    if old_rm in css:
        css = css.replace(old_rm, new_rm, 1)
        print("cert reduced-motion updated")
    else:
        print("WARN: cert reduced-motion block not exact match")
else:
    print("cert CSS already present")

# --- Leaderboard FLIP ---
if ".leaderboard-row.is-rising" not in css:
    lb_css = """
/* 8.7 Leaderboard rank-swap FLIP */
.leaderboard-row {
  transition: transform 0.5s var(--ease-out-soft), box-shadow 0.4s;
}

.leaderboard-row.is-rising {
  box-shadow: 0 0 0 2px var(--primary), 0 8px 20px rgba(79, 70, 229, 0.28);
  animation: row-glow 1.1s ease-out;
  z-index: 1;
  position: relative;
}

@keyframes row-glow {
  0% { box-shadow: 0 0 0 2px var(--accent), 0 8px 26px rgba(34, 211, 238, 0.4); }
  100% { box-shadow: 0 0 0 2px transparent, 0 0 0 transparent; }
}

@media (prefers-reduced-motion: reduce) {
  .leaderboard-row {
    transition: box-shadow 0.4s;
  }
}

"""
    marker = ".leaderboard-list {\n  list-style: none;\n}"
    if marker in css:
        css = css.replace(marker, marker + "\n" + lb_css, 1)
        print("leaderboard CSS inserted")
    else:
        raise SystemExit("leaderboard marker not found")
else:
    print("leaderboard CSS already present")

# --- Camera shutter ---
if ".camera-shutter-flash" not in css:
    shutter_css = """
/* 8.8 Camera shutter flash */
.camera-area--capture {
  overflow: hidden;
}

.camera-shutter-flash {
  position: absolute;
  inset: 0;
  background: #fff;
  opacity: 0;
  pointer-events: none;
  z-index: 5;
  border-radius: var(--radius-md, var(--radius));
}

.camera-shutter-flash.is-flashing {
  animation: shutter-flash 0.38s ease-out;
}

@keyframes shutter-flash {
  0% { opacity: 0; }
  12% { opacity: 0.95; }
  100% { opacity: 0; }
}

.camera-area.is-bounce {
  animation: shutter-bounce 0.38s ease-out;
}

@keyframes shutter-bounce {
  0% { transform: scale(1); }
  30% { transform: scale(0.96); }
  100% { transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .camera-area.is-bounce {
    animation: none;
  }
}

"""
    marker = ".camera-area--capture {\n  position: relative;\n  padding: 8px 0 4px;"
    if marker in css:
        # Don't duplicate .camera-area--capture rule — append shutter block after the capture block
        # Find end of .camera-area--capture rule
        idx = css.find(marker)
        # find closing brace of that rule
        brace = css.find("}", idx)
        insert_at = brace + 1
        css = css[:insert_at] + "\n" + shutter_css + css[insert_at:]
        print("shutter CSS inserted after camera-area--capture")
    else:
        raise SystemExit("camera-area--capture marker not found")
else:
    print("shutter CSS already present")

css_path.write_text(css, encoding="utf-8")
print("css written")
