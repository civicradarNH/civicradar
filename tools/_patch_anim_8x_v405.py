# -*- coding: utf-8 -*-
"""Patch: cert coin-flip medal, leaderboard FLIP, camera shutter — bump to v405."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
app_path = ROOT / "js" / "app.js"
sw_path = ROOT / "sw.js"
e2e_path = ROOT / "tests" / "e2e_comprehensive.py"
css_path = ROOT / "css" / "styles.css"
html_path = ROOT / "index.html"

app = app_path.read_text(encoding="utf-8")
ver_m = re.search(r"CIVIC_APP_VERSION = '(v\d+)'", app)
assert ver_m, "no version"
cur = ver_m.group(1)
print("current version:", cur)
# Bump once from whatever concurrent work left (expect v404)
num = int(cur[1:])
new_ver = f"v{num + 1}"
print("bumping to:", new_ver)

# ── Helpers after fireMeTooPing / getReportMarkerIconEl block ──────────
HELPERS = r'''
  /** Classic FLIP: First → insertFn (Last) → Invert → Play + rising glow. */
  function animateRowReorder(list, row, insertFn) {
    if (!row || typeof insertFn !== 'function') return;
    let first;
    try { first = row.getBoundingClientRect(); } catch (_) { return; }
    insertFn();
    let last;
    try { last = row.getBoundingClientRect(); } catch (_) { return; }
    const dy = first.top - last.top;
    if (prefersReducedMotion() || dy === 0) {
      row.classList.add('is-rising');
      setTimeout(() => row.classList.remove('is-rising'), 1100);
      return;
    }
    row.style.transition = 'none';
    row.style.transform = 'translateY(' + dy + 'px)';
    requestAnimationFrame(() => {
      row.style.transition = '';
      row.style.transform = '';
      row.classList.add('is-rising');
    });
    setTimeout(() => row.classList.remove('is-rising'), 1200);
  }

  /** FLIP after a full list re-render (keyed by data-lb-key). */
  function captureLeaderboardFirst(listEl) {
    const map = new Map();
    if (!listEl) return map;
    listEl.querySelectorAll('li[data-lb-key]').forEach((row) => {
      const key = row.getAttribute('data-lb-key');
      if (!key) return;
      let top = 0;
      try { top = row.getBoundingClientRect().top; } catch (_) { /* ignore */ }
      map.set(key, { top: top, rank: row.getAttribute('data-lb-rank') || '' });
    });
    return map;
  }

  function playLeaderboardFlips(listEl, firstMap) {
    if (!listEl || !firstMap || !firstMap.size) return;
    listEl.querySelectorAll('li[data-lb-key]').forEach((row) => {
      const key = row.getAttribute('data-lb-key');
      const prev = firstMap.get(key);
      if (!prev) return;
      let lastTop = 0;
      try { lastTop = row.getBoundingClientRect().top; } catch (_) { return; }
      const dy = prev.top - lastTop;
      const rankChanged = String(prev.rank) !== String(row.getAttribute('data-lb-rank') || '');
      if (!rankChanged && Math.abs(dy) < 0.5) return;
      // Same invert/play as animateRowReorder (DOM already at Last).
      if (prefersReducedMotion() || dy === 0) {
        row.classList.add('is-rising');
        setTimeout(() => row.classList.remove('is-rising'), 1100);
        return;
      }
      row.style.transition = 'none';
      row.style.transform = 'translateY(' + dy + 'px)';
      requestAnimationFrame(() => {
        row.style.transition = '';
        row.style.transform = '';
        row.classList.add('is-rising');
      });
      setTimeout(() => row.classList.remove('is-rising'), 1200);
    });
  }

  /** Re-trigger certificate coin-flip + shine when the modal opens. */
  function replayCertMedal(el) {
    if (!el || !el.classList) return;
    el.classList.remove('cert-medal');
    void el.offsetWidth;
    el.classList.add('cert-medal');
  }

  /** White flash + shutter bounce when a capture photo is decoded ready. */
  function playShutterEffect(cameraAreaEl, flashEl) {
    if (!cameraAreaEl || !flashEl) return;
    try { Haptics.tap(); } catch (_) { /* ignore */ }
    flashEl.classList.remove('is-flashing');
    cameraAreaEl.classList.remove('is-bounce');
    void flashEl.offsetWidth;
    flashEl.classList.add('is-flashing');
    if (!prefersReducedMotion()) cameraAreaEl.classList.add('is-bounce');
    const clear = () => {
      flashEl.classList.remove('is-flashing');
      cameraAreaEl.classList.remove('is-bounce');
      flashEl.removeEventListener('animationend', clear);
    };
    flashEl.addEventListener('animationend', clear);
    setTimeout(clear, 450);
  }

  function triggerCaptureShutter() {
    const area = document.querySelector('#reportStepCapture .camera-area--capture')
      || document.querySelector('.camera-area--capture');
    if (!area) return;
    const flash = area.querySelector('.camera-shutter-flash');
    if (flash) playShutterEffect(area, flash);
  }

'''

# Insert helpers after getReportMarkerIconEl function (before countUp tokens)
anchor = "  /** Per-element token so a newer countUp cancels an in-flight tick (no fighting rAFs). */"
if "function animateRowReorder(" in app:
    print("helpers already present — skip insert")
else:
    if anchor not in app:
        raise SystemExit("anchor for helpers not found")
    app = app.replace(anchor, HELPERS + "\n" + anchor, 1)
    print("helpers inserted")

# ── showCertificateModal: replay cert medal instead of / in addition to cert-badge--pop ──
# Pattern A: double-spaced version
old_icon_a = """    if (icon) {

      icon.style.setProperty('--cert-badge', badge.fill);

      icon.classList.remove('cert-badge--pop');

    }"""

new_icon_a = """    if (icon) {

      icon.style.setProperty('--cert-badge', badge.fill);

      icon.classList.remove('cert-badge--pop');

      replayCertMedal(icon);

    }"""

old_reveal = """      if (icon) icon.classList.add('cert-badge--pop');"""
# Keep badge pop as soft fallback for non-medal; coin-flip is primary via replayCertMedal at open.
# Still add cert-badge--pop on reveal for legacy CSS layering only when reduced-motion (static).
new_reveal = """      if (icon && prefersReducedMotion()) icon.classList.add('cert-badge--pop');"""

if old_icon_a in app:
    app = app.replace(old_icon_a, new_icon_a, 1)
    print("showCertificateModal icon hook (spaced)")
elif "replayCertMedal(icon)" in app:
    print("replayCertMedal already hooked")
else:
    # try compact
    old_icon_b = """    if (icon) {
      icon.style.setProperty('--cert-badge', badge.fill);
      icon.classList.remove('cert-badge--pop');
    }"""
    new_icon_b = """    if (icon) {
      icon.style.setProperty('--cert-badge', badge.fill);
      icon.classList.remove('cert-badge--pop');
      replayCertMedal(icon);
    }"""
    if old_icon_b in app:
        app = app.replace(old_icon_b, new_icon_b, 1)
        print("showCertificateModal icon hook (compact)")
    else:
        raise SystemExit("could not find icon setup in showCertificateModal")

if old_reveal in app:
    app = app.replace(old_reveal, new_reveal, 1)
    print("revealCard: skip spin pop when reduced-motion only")
elif "prefersReducedMotion()) icon.classList.add('cert-badge--pop')" in app:
    print("revealCard already updated")
else:
    print("WARN: revealCard cert-badge--pop not found")

# ── Leaderboard: add data keys + FLIP after render ──
# Wards list HTML template
wards_li_old = """          <li class="${w.isUser ? 'lb-highlight' : ''}${w.isDemo ? ' lb-demo-row' : ''}">

            <span class="lb-rank ${rankClass(i)}">${i + 1}</span>"""

wards_li_new = """          <li class="leaderboard-row${w.isUser ? ' lb-highlight' : ''}${w.isDemo ? ' lb-demo-row' : ''}" data-lb-key="${escapeHtml(String(w.name || i))}" data-lb-rank="${i + 1}">

            <span class="lb-rank ${rankClass(i)}">${i + 1}</span>"""

# Also handle compact (no blank lines)
wards_li_old_c = """          <li class="${w.isUser ? 'lb-highlight' : ''}${w.isDemo ? ' lb-demo-row' : ''}">
            <span class="lb-rank ${rankClass(i)}">${i + 1}</span>"""
wards_li_new_c = """          <li class="leaderboard-row${w.isUser ? ' lb-highlight' : ''}${w.isDemo ? ' lb-demo-row' : ''}" data-lb-key="${escapeHtml(String(w.name || i))}" data-lb-rank="${i + 1}">
            <span class="lb-rank ${rankClass(i)}">${i + 1}</span>"""

if "data-lb-key=" in app and "leaderboard-row" in app and "playLeaderboardFlips" in app and app.count("playLeaderboardFlips(") >= 2:
    print("leaderboard FLIP already wired")
else:
    if wards_li_old in app:
        app = app.replace(wards_li_old, wards_li_new, 1)
        print("wards li markup (spaced)")
    elif wards_li_old_c in app:
        app = app.replace(wards_li_old_c, wards_li_new_c, 1)
        print("wards li markup (compact)")
    else:
        raise SystemExit("wards li template not found")

    # Citizens — find similar pattern. Need to read current citizens template.
    cit_m = re.search(
        r'<li class="\$\{c\.isUser \? \'lb-highlight\' : \'\'\}\$\{c\.isDemo \? \' lb-demo-row\' : \'\'\}">',
        app,
    )
    if not cit_m:
        raise SystemExit("citizens li template not found")
    # Replace that opening tag only (first occurrence after wards — citizens)
    # There should be one for citizens
    old_cit_open = cit_m.group(0)
    # Build key: prefer id, else you/name
    new_cit_open = (
        '<li class="leaderboard-row${c.isUser ? \' lb-highlight\' : \'\'}${c.isDemo ? \' lb-demo-row\' : \'\'}" '
        'data-lb-key="${escapeHtml(String(c.id || (c.isUser ? \'__you__\' : c.name) || i))}" '
        'data-lb-rank="${i + 1}">'
    )
    # Note: original had lb-highlight without leading space when isUser — keep class list valid
    new_cit_open = (
        '<li class="leaderboard-row${c.isUser ? \' lb-highlight\' : \'\'}${c.isDemo ? \' lb-demo-row\' : \'\'}" '
        'data-lb-key="${escapeHtml(String(c.id != null ? c.id : (c.isUser ? \'__you__\' : c.name) || i))}" '
        'data-lb-rank="${i + 1}">'
    )
    # Fix: when isUser, class should be "leaderboard-row lb-highlight" — with space before lb-highlight
    # Original: `${c.isUser ? 'lb-highlight' : ''}` without leading space on first class.
    # With leaderboard-row always first, need space: `${c.isUser ? ' lb-highlight' : ''}`
    app = app.replace(old_cit_open, new_cit_open, 1)
    print("citizens li markup")

    # Insert capture + play around wards innerHTML assignment
    # Before: const listEl = $('#wardsList');
    # After empty returns, before listEl.innerHTML = wards
    wards_block_old = """      const listEl = $('#wardsList');

      if (liveBackend && realWards.length === 0) {"""
    wards_block_new = """      const listEl = $('#wardsList');

      const lbFirst = captureLeaderboardFirst(listEl);

      if (liveBackend && realWards.length === 0) {"""
    wards_block_old_c = """      const listEl = $('#wardsList');
      if (liveBackend && realWards.length === 0) {"""
    wards_block_new_c = """      const listEl = $('#wardsList');
      const lbFirst = captureLeaderboardFirst(listEl);
      if (liveBackend && realWards.length === 0) {"""

    if wards_block_old in app:
        app = app.replace(wards_block_old, wards_block_new, 1)
        print("wards capture first (spaced)")
    elif wards_block_old_c in app:
        app = app.replace(wards_block_old_c, wards_block_new_c, 1)
        print("wards capture first (compact)")
    else:
        raise SystemExit("wards listEl block not found")

    wards_after_old = """      countUpMounted(listEl, '.js-lb-pts', {
        format: (n) => Math.round(n).toLocaleString(),
      });

    }



    if (type === 'citizens') {"""
    wards_after_new = """      countUpMounted(listEl, '.js-lb-pts', {
        format: (n) => Math.round(n).toLocaleString(),
      });
      playLeaderboardFlips(listEl, lbFirst);

    }



    if (type === 'citizens') {"""
    wards_after_old_c = """      countUpMounted(listEl, '.js-lb-pts', {
        format: (n) => Math.round(n).toLocaleString(),
      });
    }

    if (type === 'citizens') {"""
    wards_after_new_c = """      countUpMounted(listEl, '.js-lb-pts', {
        format: (n) => Math.round(n).toLocaleString(),
      });
      playLeaderboardFlips(listEl, lbFirst);
    }

    if (type === 'citizens') {"""

    if wards_after_old in app:
        app = app.replace(wards_after_old, wards_after_new, 1)
        print("wards play flips (spaced)")
    elif wards_after_old_c in app:
        app = app.replace(wards_after_old_c, wards_after_new_c, 1)
        print("wards play flips (compact)")
    else:
        # try looser: first countUpMounted after wards
        m = re.search(
            r"(countUpMounted\(listEl, '\.js-lb-pts', \{\s*format: \(n\) => Math\.round\(n\)\.toLocaleString\(\),\s*\}\);)",
            app,
        )
        if not m:
            raise SystemExit("wards countUpMounted not found")
        # only first occurrence (wards)
        app = app.replace(m.group(1), m.group(1) + "\n      playLeaderboardFlips(listEl, lbFirst);", 1)
        print("wards play flips (regex)")

    # Citizens capture
    cit_list_old = """      const listEl = $('#citizensList');

      const realCitizens = citizens.filter((c) => !c.isDemo && !c.isUser);"""
    cit_list_new = """      const listEl = $('#citizensList');

      const lbFirst = captureLeaderboardFirst(listEl);

      const realCitizens = citizens.filter((c) => !c.isDemo && !c.isUser);"""
    cit_list_old_c = """      const listEl = $('#citizensList');
      const realCitizens = citizens.filter((c) => !c.isDemo && !c.isUser);"""
    cit_list_new_c = """      const listEl = $('#citizensList');
      const lbFirst = captureLeaderboardFirst(listEl);
      const realCitizens = citizens.filter((c) => !c.isDemo && !c.isUser);"""

    if cit_list_old in app:
        app = app.replace(cit_list_old, cit_list_new, 1)
        print("citizens capture first (spaced)")
    elif cit_list_old_c in app:
        app = app.replace(cit_list_old_c, cit_list_new_c, 1)
        print("citizens capture first (compact)")
    else:
        raise SystemExit("citizens listEl block not found")

    # Second countUpMounted (citizens) — add playLeaderboardFlips
    # Find remaining countUpMounted for listEl without playLeaderboardFlips after it
    parts = app.split("countUpMounted(listEl, '.js-lb-pts'")
    if len(parts) < 3:
        # may already have one play after wards; citizens still needs it
        pass
    # Find last countUpMounted that isn't followed by playLeaderboardFlips
    idx = 0
    added = 0
    while True:
        i = app.find("countUpMounted(listEl, '.js-lb-pts'", idx)
        if i < 0:
            break
        end = app.find("});", i)
        if end < 0:
            break
        end += 3
        after = app[end:end + 80]
        if "playLeaderboardFlips" not in after:
            app = app[:end] + "\n      playLeaderboardFlips(listEl, lbFirst);" + app[end:]
            added += 1
            print("added playLeaderboardFlips at", i)
            idx = end + 60
        else:
            idx = end + 1
    if added == 0 and "playLeaderboardFlips(listEl, lbFirst)" in app:
        # check count
        n = app.count("playLeaderboardFlips(listEl, lbFirst)")
        print("playLeaderboardFlips count:", n)
        if n < 2:
            raise SystemExit("citizens playLeaderboardFlips not added")
    elif added == 0:
        raise SystemExit("no playLeaderboardFlips added for citizens")

# ── Shutter hook on successful decode ──
if "triggerCaptureShutter()" in app:
    print("shutter already hooked")
else:
    # After canvas draw succeeds — right after canvasOk = true path continues past draw,
    # before moderation. Spec: when decoded image is ready.
    # Hook 1: after successful canvas draw (canvasOk true path) — insert after releaseDecoded
    # and the !canvasOk block, at start of moderation section is late; better right after
    # we know w/h and canvasOk.

    # Raw fallback success — before finishReportPhotoFlow raw
    raw_hook_old = """          reportPhotoModerationPassed = true;
          finishReportPhotoFlow('handlePhotoCaptureRawFallback');"""
    raw_hook_new = """          reportPhotoModerationPassed = true;
          triggerCaptureShutter();
          finishReportPhotoFlow('handlePhotoCaptureRawFallback');"""
    raw_hook_old_s = """          reportPhotoModerationPassed = true;

          finishReportPhotoFlow('handlePhotoCaptureRawFallback');"""
    raw_hook_new_s = """          reportPhotoModerationPassed = true;

          triggerCaptureShutter();

          finishReportPhotoFlow('handlePhotoCaptureRawFallback');"""

    if raw_hook_old in app:
        app = app.replace(raw_hook_old, raw_hook_new, 1)
        print("raw fallback shutter")
    elif raw_hook_old_s in app:
        app = app.replace(raw_hook_old_s, raw_hook_new_s, 1)
        print("raw fallback shutter (spaced)")
    else:
        print("WARN: raw fallback finish not found")

    # Main success: after canvas drawn OK — insert after `if (!canvasOk) { ... return; }` block ends
    # and before ImageModeration. Also on final success after dataUrl validated.
    # Prefer: right after canvas draw success confirmed — when leaving the !canvasOk early path.
    main_hook_old = """        canvas.classList.add('visible');
        let dataUrl;"""
    main_hook_new = """        canvas.classList.add('visible');
        triggerCaptureShutter();
        let dataUrl;"""
    main_hook_old_s = """        canvas.classList.add('visible');

        let dataUrl;"""
    main_hook_new_s = """        canvas.classList.add('visible');

        triggerCaptureShutter();

        let dataUrl;"""

    if main_hook_old in app:
        app = app.replace(main_hook_old, main_hook_new, 1)
        print("main path shutter (at visible)")
    elif main_hook_old_s in app:
        app = app.replace(main_hook_old_s, main_hook_new_s, 1)
        print("main path shutter (at visible spaced)")
    else:
        # fallback: after successful dataUrl before finishReportPhotoFlow handlePhotoCapture
        fin_old = """        finishReportPhotoFlow('handlePhotoCapture');
        reportPhotoDismissGuard = Date.now();
        advanceReportPhotoReady();"""
        fin_new = """        triggerCaptureShutter();
        finishReportPhotoFlow('handlePhotoCapture');
        reportPhotoDismissGuard = Date.now();
        advanceReportPhotoReady();"""
        if fin_old in app:
            app = app.replace(fin_old, fin_new, 1)
            print("main path shutter (at finish)")
        else:
            raise SystemExit("could not hook shutter on main capture path")

# Fix wards lb-highlight spacing (leaderboard-row + lb-highlight)
# Template used: leaderboard-row${w.isUser ? 'lb-highlight' — missing space
app = app.replace(
    "leaderboard-row${w.isUser ? 'lb-highlight' : ''}",
    "leaderboard-row${w.isUser ? ' lb-highlight' : ''}",
)
app = app.replace(
    "leaderboard-row${c.isUser ? 'lb-highlight' : ''}",
    "leaderboard-row${c.isUser ? ' lb-highlight' : ''}",
)

# Version bump
app = app.replace(f"CIVIC_APP_VERSION = '{cur}'", f"CIVIC_APP_VERSION = '{new_ver}'", 1)
app_path.write_text(app, encoding="utf-8")
print("app.js written")

# sw.js
sw = sw_path.read_text(encoding="utf-8")
sw_m = re.search(r"CACHE = 'civicradar-(v\d+)'", sw)
assert sw_m
sw_cur = sw_m.group(1)
sw = sw.replace(f"civicradar-{sw_cur}", f"civicradar-{new_ver}", 1)
sw_path.write_text(sw, encoding="utf-8")
print("sw.js", sw_cur, "->", new_ver)

# e2e
e2e = e2e_path.read_text(encoding="utf-8")
# replace any recent cache string expectations
for old in (sw_cur, cur, "v403", "v404"):
    e2e = e2e.replace(f"civicradar-{old}", f"civicradar-{new_ver}")
e2e_path.write_text(e2e, encoding="utf-8")
print("e2e SW06 ->", new_ver)

print("DONE app/sw/e2e; HTML/CSS next")
print("NEW_VER", new_ver)
