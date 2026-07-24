# -*- coding: utf-8 -*-
"""Animation polish 9.1–9.8 — bump CIVIC_APP_VERSION once."""
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
num = int(cur[1:])
new_ver = f"v{num + 1}"
print(f"version {cur} -> {new_ver}")

# ── 9.1 HTML: wrap .cr-section__body children in .cr-section__body-inner ──
html = html_path.read_text(encoding="utf-8")

BODY_IDS = [
    "communityWardImpactBody",
    "communityLeaderboardBody",
    "getInvolvedBody",
    "profileActivityBody",
    "profileNotificationsBody",
]


def wrap_section_body(html_src: str, body_id: str) -> str:
    # Match opening tag with optional hidden class
    open_pat = re.compile(
        rf'(<div class="cr-section__body(?:\s+hidden)?" id="{body_id}">)(.*?)(</div>\s*\n\s*</div>)',
        re.DOTALL,
    )

    def repl(m):
        open_tag = m.group(1).replace(" cr-section__body hidden", " cr-section__body").replace(
            'class="cr-section__body hidden"', 'class="cr-section__body"'
        )
        inner = m.group(2)
        # Avoid double-wrap
        if 'cr-section__body-inner' in inner[:80]:
            return m.group(0)
        # Close body + parent section — keep trailing structure
        # m.group(3) is </div>\n</div> where first closes body, second closes section
        # But our pattern may be too greedy. Use a more precise approach.
        return m.group(0)

    # More precise: find open tag, then find matching close by depth
    open_re = re.compile(
        rf'<div class="cr-section__body(?:\s+hidden)?" id="{re.escape(body_id)}">'
    )
    m = open_re.search(html_src)
    if not m:
        print(f"WARN: body {body_id} not found")
        return html_src
    start = m.start()
    open_end = m.end()
    open_tag = m.group(0).replace(" cr-section__body hidden", " cr-section__body").replace(
        'class="cr-section__body hidden"', 'class="cr-section__body"'
    )
    # Walk from open_end to find matching closing </div>
    i = open_end
    depth = 1
    while i < len(html_src) and depth > 0:
        next_open = html_src.find("<div", i)
        next_close = html_src.find("</div>", i)
        if next_close < 0:
            raise RuntimeError(f"unclosed {body_id}")
        if next_open >= 0 and next_open < next_close:
            # could be <div or something else starting with <div
            depth += 1
            i = next_open + 4
        else:
            depth -= 1
            if depth == 0:
                close_start = next_close
                break
            i = next_close + 6
    else:
        raise RuntimeError(f"unclosed {body_id}")

    content = html_src[open_end:close_start]
    if "cr-section__body-inner" in content[:120]:
        print(f"skip wrap {body_id} (already)")
        # still strip hidden from open tag if needed
        if m.group(0) != open_tag:
            return html_src[:start] + open_tag + html_src[open_end:]
        return html_src

    # Preserve leading newline indent of content
    wrapped = (
        open_tag
        + '\n          <div class="cr-section__body-inner">'
        + content.rstrip()
        + "\n          </div>\n        "
    )
    return html_src[:start] + wrapped + html_src[close_start:]


for bid in BODY_IDS:
    html = wrap_section_body(html, bid)
    print(f"wrapped {bid}")

html_path.write_text(html, encoding="utf-8")

# ── CSS append ──
css = css_path.read_text(encoding="utf-8")
CSS_BLOCK = """

/* ============================================================
   Animation polish Round 3 (9.1–9.8) — accordion, meters, toggles,
   recenter, sync breathe, esc ladder, lang swap, badge stagger.
   All motion gated by prefers-reduced-motion.
   ============================================================ */

/* 9.1 Accordion expand/collapse */
.cr-section__body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s var(--ease-out-soft);
  padding-top: 0;
}
.cr-section__body-inner {
  overflow: hidden;
  min-height: 0;
  padding-top: 14px;
}
.cr-section--expanded .cr-section__body {
  grid-template-rows: 1fr;
}
.cr-section__toggle .ph-caret-down {
  transition: transform 0.3s var(--ease-out-soft);
}
.cr-section__toggle[aria-expanded="true"] .ph-caret-down {
  transform: rotate(180deg);
}
.cr-section__body.hidden { display: none; } /* legacy safety */

/* 9.2 Ward pulse meter fill */
.ward-pulse__meter-open,
.ward-pulse__meter-fixed {
  transition: width 0.6s var(--ease-out-soft);
  position: relative;
  overflow: hidden;
}
.ward-pulse__meter-open.is-updated::after,
.ward-pulse__meter-fixed.is-updated::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  animation: meter-sweep 0.6s ease-out;
  pointer-events: none;
}
@keyframes meter-sweep {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}

/* 9.3 Toggle switch spring-pop (knob travel matches translateX(18px)) */
.toggle-row__switch::after {
  transition: transform 0.28s var(--ease-spring), background 0.2s;
}
.toggle-row__input:checked ~ .toggle-row__switch::after {
  transform: translateX(18px);
  animation: toggle-knob-pop 0.28s var(--ease-spring);
}
@keyframes toggle-knob-pop {
  0% { transform: translateX(0) scale(1); }
  55% { transform: translateX(20px) scale(1.15); }
  100% { transform: translateX(18px) scale(1); }
}

/* 9.4 Recenter compass spin */
#btnRecenter.is-locating i {
  animation: compass-spin 1s linear infinite;
}
#btnRecenter.is-located i {
  animation: compass-settle 0.4s var(--ease-spring) both;
}
@keyframes compass-spin { to { transform: rotate(360deg); } }
@keyframes compass-settle {
  from { transform: rotate(45deg); }
  to { transform: rotate(0deg); }
}

/* 9.5 Live sync-status breathing dot */
.header__sync {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.header__sync::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ink-400, #94a3b8);
  flex: none;
}
.header__sync--syncing::before {
  background: var(--primary);
  animation: sync-breathe 1.6s ease-in-out infinite;
}
.header__sync--live::before {
  background: var(--success);
  animation: none;
  opacity: 1;
}
@keyframes sync-breathe {
  0%, 100% { opacity: 0.45; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.15); }
}

/* 9.6 Escalation ladder timeline */
.esc-ladder {
  position: relative;
  padding-left: 24px;
  --ladder-fill: 0%;
}
.esc-ladder::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--border);
  border-radius: 1px;
}
.esc-ladder::after {
  content: '';
  position: absolute;
  left: 8px;
  top: 4px;
  width: 2px;
  background: var(--success);
  height: var(--ladder-fill, 0%);
  transition: height 0.5s var(--ease-out-soft);
  border-radius: 1px;
  pointer-events: none;
  z-index: 0;
}
.esc-ladder > .esc-step {
  position: relative;
}
.esc-ladder > .esc-step::before {
  content: '';
  position: absolute;
  left: -20px;
  top: 16px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border);
  transition: background 0.3s, transform 0.3s var(--ease-spring);
  z-index: 1;
}
.esc-ladder > .esc-step.is-complete::before {
  background: var(--success);
  animation: ladder-dot-pop 0.3s var(--ease-spring);
}
@keyframes ladder-dot-pop {
  0% { transform: scale(0.4); }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

/* 9.7 Language switch cross-fade */
.lang-swap {
  animation: lang-cross-fade 0.28s ease-out;
}
@keyframes lang-cross-fade {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 9.8 Profile badge grid stagger-in */
.profile-card__badges > * {
  opacity: 0;
  transform: translateY(6px) scale(0.9);
  animation: badge-pop-in 0.35s var(--ease-spring) both;
  animation-delay: calc(var(--i, 0) * 45ms);
}
@keyframes badge-pop-in {
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .cr-section__body { transition: none; }
  .ward-pulse__meter-open,
  .ward-pulse__meter-fixed { transition: none; }
  .ward-pulse__meter-open.is-updated::after,
  .ward-pulse__meter-fixed.is-updated::after { animation: none; }
  .toggle-row__switch::after { transition: none; animation: none !important; }
  #btnRecenter.is-locating i,
  #btnRecenter.is-located i { animation: none; }
  .header__sync--syncing::before { animation: none; opacity: 0.8; }
  .esc-ladder::after { transition: none; }
  .esc-ladder > .esc-step.is-complete::before { animation: none; }
  .lang-swap { animation: none; }
  .profile-card__badges > * {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
"""

if "Animation polish Round 3 (9.1–9.8)" not in css:
    # Soften older chevron rule so aria-expanded wins (keep collapsed fallback)
    css = css.replace(
        ".cr-section:not(.cr-section--collapsed) .cr-section__toggle i.ph-caret-down { transform: rotate(180deg); }",
        "/* chevron rotate: see Round 3 aria-expanded rule */\n"
        ".cr-section:not(.cr-section--collapsed):not(.cr-section--expanded) .cr-section__toggle i.ph-caret-down,"
        "\n.cr-section--expanded .cr-section__toggle i.ph-caret-down { transform: rotate(180deg); }",
        1,
    )
    # Disable v310 cloud pulse when live/syncing classes manage the dot
    css = css.replace(
        ".header__sync--cloud::before {\n  animation: sync-live-dot 2.6s ease-in-out infinite;\n}",
        ".header__sync--cloud:not(.header__sync--live):not(.header__sync--syncing)::before {\n"
        "  animation: sync-live-dot 2.6s ease-in-out infinite;\n}",
        1,
    )
    css = css + CSS_BLOCK
    css_path.write_text(css, encoding="utf-8")
    print("CSS appended")
else:
    print("CSS already present")

# ── JS patches ──
app = app_path.read_text(encoding="utf-8")

# Version bump
app = app.replace(
    f"const CIVIC_APP_VERSION = '{cur}';",
    f"const CIVIC_APP_VERSION = '{new_ver}';",
    1,
)

# Collapsible section helpers (9.1)
OLD_WIRE = """  // Generic collapsible-section toggle (Community modal's "Get involved" /
  // "Resources" groups) — mirrors the existing official-channels accordion
  // pattern (button + .hidden body + --collapsed modifier + aria-expanded).
  function wireCollapsibleSection(toggleId, bodyId, sectionId) {
    const btn = $('#' + toggleId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const body = $('#' + bodyId);
      const section = $('#' + sectionId);
      const open = body && body.classList.toggle('hidden') === false;
      if (section) section.classList.toggle('cr-section--collapsed', !open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function setCollapsibleSectionOpen(sectionId, bodyId, toggleId, open) {
    const section = $('#' + sectionId);
    const body = $('#' + bodyId);
    const btn = $('#' + toggleId);
    if (!section || !body || !btn) return;
    body.classList.toggle('hidden', !open);
    section.classList.toggle('cr-section--collapsed', !open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }"""

NEW_WIRE = """  // Generic collapsible-section toggle — grid-rows expand via .cr-section--expanded
  // (no instant .hidden cut). Chevron follows aria-expanded.
  function wireCollapsibleSection(toggleId, bodyId, sectionId) {
    const btn = $('#' + toggleId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const section = $('#' + sectionId);
      if (!section) return;
      const open = !section.classList.contains('cr-section--expanded');
      setCollapsibleSectionOpen(sectionId, bodyId, toggleId, open);
    });
  }

  function setCollapsibleSectionOpen(sectionId, bodyId, toggleId, open) {
    const section = $('#' + sectionId);
    const body = $('#' + bodyId);
    const btn = $('#' + toggleId);
    if (!section || !btn) return;
    section.classList.toggle('cr-section--expanded', !!open);
    section.classList.toggle('cr-section--collapsed', !open);
    if (body) body.classList.remove('hidden');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }"""

assert OLD_WIRE in app, "wireCollapsibleSection block not found"
app = app.replace(OLD_WIRE, NEW_WIRE, 1)

# 9.2 pulseMeterUpdate + renderWardPulse
OLD_PULSE = """  function renderWardPulse() {
    const el = $('#wardPulse');
    if (!el) return;
    const nameEl = $('#wardPulseName');
    const openEl = $('#wardPulseOpen');
    const fixedEl = $('#wardPulseFixed');
    const meTooEl = $('#wardPulseMeToo');
    const wardLabel = (user && user.ward)
      ? getWardShortName(user.ward)
      : t('pulse.yourWard');
    if (nameEl) nameEl.textContent = wardLabel;
    const stats = getUserWardPulseStats();
    // Roll count changes only (Me too bump path already animates; this covers Open/Fixed + full refresh).
    countUp(openEl, stats.open || 0);
    countUp(fixedEl, stats.fixedWeek || 0);
    countUp(meTooEl, stats.meToo || 0);
    const meterOpen = $('#wardPulseMeterOpen');
    const meterFixed = $('#wardPulseMeterFixed');
    const total = Math.max(1, (stats.open || 0) + (stats.fixedWeek || 0));
    if (meterOpen) meterOpen.style.width = `${Math.round(((stats.open || 0) / total) * 100)}%`;
    if (meterFixed) meterFixed.style.width = `${Math.round(((stats.fixedWeek || 0) / total) * 100)}%`;
    el.setAttribute('aria-label', t('pulse.aria'));
  }"""

NEW_PULSE = """  function pulseMeterUpdate(el) {
    if (!el || !el.classList || prefersReducedMotion()) return;
    el.classList.remove('is-updated');
    void el.offsetWidth;
    el.classList.add('is-updated');
  }

  function renderWardPulse() {
    const el = $('#wardPulse');
    if (!el) return;
    const nameEl = $('#wardPulseName');
    const openEl = $('#wardPulseOpen');
    const fixedEl = $('#wardPulseFixed');
    const meTooEl = $('#wardPulseMeToo');
    const wardLabel = (user && user.ward)
      ? getWardShortName(user.ward)
      : t('pulse.yourWard');
    if (nameEl) nameEl.textContent = wardLabel;
    const stats = getUserWardPulseStats();
    // Roll count changes only (Me too bump path already animates; this covers Open/Fixed + full refresh).
    countUp(openEl, stats.open || 0);
    countUp(fixedEl, stats.fixedWeek || 0);
    countUp(meTooEl, stats.meToo || 0);
    const meterOpen = $('#wardPulseMeterOpen');
    const meterFixed = $('#wardPulseMeterFixed');
    const total = Math.max(1, (stats.open || 0) + (stats.fixedWeek || 0));
    if (meterOpen) {
      meterOpen.style.width = `${Math.round(((stats.open || 0) / total) * 100)}%`;
      pulseMeterUpdate(meterOpen);
    }
    if (meterFixed) {
      meterFixed.style.width = `${Math.round(((stats.fixedWeek || 0) / total) * 100)}%`;
      pulseMeterUpdate(meterFixed);
    }
    el.setAttribute('aria-label', t('pulse.aria'));
  }"""

assert OLD_PULSE in app, "renderWardPulse not found"
app = app.replace(OLD_PULSE, NEW_PULSE, 1)

# 9.5 updateSyncStatus
OLD_SYNC = """  function updateSyncStatus() {
    const el = $('#syncStatus');
    if (!el) return;
    const connected = Backend.enabled;
    el.classList.toggle('header__sync--cloud', connected);
    el.classList.toggle('header__sync--local', !connected);
    el.textContent = connected ? t('sync.cloud') : t('sync.local');
    el.title = connected ? t('sync.cloudTitle') : t('sync.localTitle');
  }"""

NEW_SYNC = """  function updateSyncStatus(opts) {
    const el = $('#syncStatus');
    if (!el) return;
    const syncing = !!(opts && opts.syncing);
    const connected = Backend.enabled;
    el.classList.toggle('header__sync--syncing', syncing);
    el.classList.toggle('header__sync--live', connected && !syncing);
    el.classList.toggle('header__sync--cloud', connected);
    el.classList.toggle('header__sync--local', !connected);
    el.textContent = connected || syncing ? t('sync.cloud') : t('sync.local');
    el.title = connected || syncing ? t('sync.cloudTitle') : t('sync.localTitle');
  }"""

assert OLD_SYNC in app, "updateSyncStatus not found"
app = app.replace(OLD_SYNC, NEW_SYNC, 1)

# Backend.init: mark syncing around pull
OLD_INIT_PULL = """        this.enabled = true;
        await this.pullAll();
        await this.pushLocalOwned();
        this.flushPendingFeedback();
        this.flushPendingAccessRequests();
        this.subscribe();
        updateAuthMode();
        updateSyncStatus();"""

NEW_INIT_PULL = """        this.enabled = true;
        updateSyncStatus({ syncing: true });
        await this.pullAll();
        await this.pushLocalOwned();
        this.flushPendingFeedback();
        this.flushPendingAccessRequests();
        this.subscribe();
        updateAuthMode();
        updateSyncStatus();"""

assert OLD_INIT_PULL in app, "Backend.init pull block not found"
app = app.replace(OLD_INIT_PULL, NEW_INIT_PULL, 1)

# 9.7 flashLangSwap + setLanguage
OLD_SET_LANG = """  function setLanguage(code) {
    if (!I18N[code]) return;
    const prev = currentLang;
    currentLang = code;
    safeLocalSet(LANG_KEY, currentLang);
    applyTranslations();
    updatePersonaUI();
    if (prev !== code && window.CivicAnalytics) {
      CivicAnalytics.track('language_change', { from: prev, to: code });
    }
    rerenderDynamicViews();
  }"""

NEW_SET_LANG = """  function flashLangSwap(root) {
    if (!root || !root.classList || prefersReducedMotion()) return;
    root.classList.remove('lang-swap');
    void root.offsetWidth;
    root.classList.add('lang-swap');
  }

  function setLanguage(code) {
    if (!I18N[code]) return;
    const prev = currentLang;
    currentLang = code;
    safeLocalSet(LANG_KEY, currentLang);
    applyTranslations();
    updatePersonaUI();
    if (prev !== code) {
      const header = document.querySelector('.header');
      if (header) flashLangSwap(header);
      const openModal = document.querySelector('.modal-overlay.open .modal');
      if (openModal) flashLangSwap(openModal);
      if (window.CivicAnalytics) {
        CivicAnalytics.track('language_change', { from: prev, to: code });
      }
    }
    rerenderDynamicViews();
  }"""

assert OLD_SET_LANG in app, "setLanguage not found"
app = app.replace(OLD_SET_LANG, NEW_SET_LANG, 1)

# 9.4 recenter — replace click handler
OLD_RECENTER = """    $('#btnRecenter').addEventListener('click', () => {

      // Re-acquire GPS — panning to a stale WiFi fix keeps the half-mile error.

      requestLocation(true, true);

    });"""

NEW_RECENTER = """    $('#btnRecenter').addEventListener('click', () => {

      // Re-acquire GPS — panning to a stale WiFi fix keeps the half-mile error.

      const btn = $('#btnRecenter');
      if (btn) {
        btn.classList.add('is-locating');
        btn.classList.remove('is-located');
      }
      const clearLocating = () => {
        if (!btn) return;
        btn.classList.remove('is-locating');
        btn.classList.add('is-located');
        setTimeout(() => btn.classList.remove('is-located'), 500);
      };
      const prevThen = Promise.prototype.then;
      try {
        requestLocation(true, true);
      } finally {
        /* requestLocation is sync-start; settle classes when geolocation finishes via hook below */
      }
      // Pair with one-shot listeners on the shared locate promise path:
      const finish = () => clearLocating();
      // Soft timeout so spinner never sticks if GPS is denied/throttled.
      setTimeout(finish, 8000);
      const onDone = () => {
        finish();
        window.removeEventListener('civicradar:locate-done', onDone);
      };
      window.addEventListener('civicradar:locate-done', onDone, { once: true });

    });"""

# Simpler recenter: patch requestLocation instead to emit event, and keep handler clean
NEW_RECENTER = """    $('#btnRecenter').addEventListener('click', () => {

      // Re-acquire GPS — panning to a stale WiFi fix keeps the half-mile error.
      const btn = $('#btnRecenter');
      if (btn) {
        btn.classList.add('is-locating');
        btn.classList.remove('is-located');
      }
      const settle = () => {
        if (!btn) return;
        btn.classList.remove('is-locating');
        if (!prefersReducedMotion()) {
          btn.classList.add('is-located');
          setTimeout(() => btn.classList.remove('is-located'), 450);
        }
      };
      const onDone = () => {
        settle();
        window.removeEventListener('civicradar:locate-done', onDone);
      };
      window.addEventListener('civicradar:locate-done', onDone, { once: true });
      setTimeout(onDone, 10000);
      requestLocation(true, true);

    });"""

assert OLD_RECENTER in app, "btnRecenter handler not found"
app = app.replace(OLD_RECENTER, NEW_RECENTER, 1)

# Hook requestLocation resolve/reject to emit locate-done
OLD_REQ_LOC_THEN = """    getPrecisePosition({

      fresh: true,

      watchMaxMs: forceFresh ? 35000 : GEO_WATCH_MAX_MS,

      minSamples: GEO_STABLE_SAMPLES,

    })

      .then((pos) => {

        applyLocationFromPosition(pos, { recenter, showAccuracyFeedback: true });

      })

      .catch(() => {

        showLocationBanner(t('location.bannerNearby'));

      });

  }"""

NEW_REQ_LOC_THEN = """    getPrecisePosition({

      fresh: true,

      watchMaxMs: forceFresh ? 35000 : GEO_WATCH_MAX_MS,

      minSamples: GEO_STABLE_SAMPLES,

    })

      .then((pos) => {

        applyLocationFromPosition(pos, { recenter, showAccuracyFeedback: true });

      })

      .catch(() => {

        showLocationBanner(t('location.bannerNearby'));

      })

      .finally(() => {

        try { window.dispatchEvent(new CustomEvent('civicradar:locate-done')); } catch (_) { /* ignore */ }

      });

  }"""

assert OLD_REQ_LOC_THEN in app, "requestLocation then/catch not found"
app = app.replace(OLD_REQ_LOC_THEN, NEW_REQ_LOC_THEN, 1)

# Early return path should also fire locate-done when recenter was requested
OLD_EARLY = """    if (!forceFresh && now - lastGeoRequest < SCALE_CFG.geoThrottleMs && currentLat != null && currentLng != null) {

      if (recenter && map) map.setView([currentLat, currentLng], zoomForAccuracy(GEO_ACCURACY_POOR_M));

      return;

    }"""

NEW_EARLY = """    if (!forceFresh && now - lastGeoRequest < SCALE_CFG.geoThrottleMs && currentLat != null && currentLng != null) {

      if (recenter && map) map.setView([currentLat, currentLng], zoomForAccuracy(GEO_ACCURACY_POOR_M));

      try { window.dispatchEvent(new CustomEvent('civicradar:locate-done')); } catch (_) { /* ignore */ }

      return;

    }"""

assert OLD_EARLY in app, "requestLocation early return not found"
app = app.replace(OLD_EARLY, NEW_EARLY, 1)

# 9.6 esc ladder — add is-complete + fill height after innerHTML
# Find the join and add post-processing
OLD_LADDER_END = """      })

      .join('');

  }



  function escalationFileCall() {"""

NEW_LADDER_END = """      })

      .join('');

    const ladderEl = $('#escLadder');
    if (ladderEl) {
      const doneCount = tiers.filter((tobj) => (tierStates[tobj.key] || 'locked') === 'done').length;
      const pct = tiers.length ? Math.round((doneCount / tiers.length) * 100) : 0;
      ladderEl.style.setProperty('--ladder-fill', pct + '%');
      ladderEl.querySelectorAll('.esc-step').forEach((li) => {
        li.classList.toggle('is-complete', li.classList.contains('esc-step--done'));
      });
    }

  }



  function escalationFileCall() {"""

assert OLD_LADDER_END in app, "esc ladder end not found"
app = app.replace(OLD_LADDER_END, NEW_LADDER_END, 1)

# Also add is-complete in the li class during render
OLD_LI = """          <li class="esc-step esc-step--${state}" data-esc-tier="${escapeHtml(tobj.key)}">"""
NEW_LI = """          <li class="esc-step esc-step--${state}${state === 'done' ? ' is-complete' : ''}" data-esc-tier="${escapeHtml(tobj.key)}">"""
assert OLD_LI in app, "esc-step li template not found"
app = app.replace(OLD_LI, NEW_LI, 1)

# 9.8 badges stagger
OLD_BADGES = """      if (badges.length) {

        badgesEl.classList.remove('hidden');

        badgesEl.innerHTML = badges

          .map((b) => `<span class="profile-badge"><i class="ph ${b.icon}"></i> ${escapeHtml(t(b.key))}</span>`)

          .join('');

      } else {"""

NEW_BADGES = """      if (badges.length) {

        badgesEl.classList.remove('hidden');

        badgesEl.innerHTML = badges

          .map((b) => `<span class="profile-badge"><i class="ph ${b.icon}"></i> ${escapeHtml(t(b.key))}</span>`)

          .join('');

        Array.from(badgesEl.children).forEach((child, i) => {
          child.style.setProperty('--i', String(i));
        });

      } else {"""

assert OLD_BADGES in app, "profile badges render not found"
app = app.replace(OLD_BADGES, NEW_BADGES, 1)

app_path.write_text(app, encoding="utf-8")
print("app.js patched")

# sw.js + e2e
sw = sw_path.read_text(encoding="utf-8")
sw = sw.replace(f"civicradar-{cur}", f"civicradar-{new_ver}")
sw_path.write_text(sw, encoding="utf-8")
print("sw.js patched")

e2e = e2e_path.read_text(encoding="utf-8")
if f"civicradar-{cur}" in e2e:
    e2e = e2e.replace(f"civicradar-{cur}", f"civicradar-{new_ver}")
    e2e_path.write_text(e2e, encoding="utf-8")
    print("e2e SW06 patched")
else:
    print("WARN: e2e cache string not updated")

# Soft-fix E2E that assume section body .hidden for expand state
# Look for patterns checking cr-section bodies
for needle in [
    "getInvolvedBody",
    "communityLeaderboardBody",
    "profileActivityBody",
    "communityWardImpactBody",
    "profileNotificationsBody",
]:
    if needle in e2e:
        print(f"note: e2e mentions {needle}")

print("DONE", new_ver)
