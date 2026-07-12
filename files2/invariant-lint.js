#!/usr/bin/env node
/**
 * CivicRadar — Invariant Linter
 * ------------------------------------------------------------------
 * Catches the CLASS of bug we keep finding by hand:
 *   • state flags set but never cleared on every exit path  (→ "photo capture never returns")
 *   • async handlers with no error path                     (→ stuck spinners / dead flows)
 *   • Leaflet maps created without invalidateSize()         (→ blank map)
 *   • overlays with no close affordance                     (→ can't get out)
 *   • toasts that can't be dismissed
 *   • flex containers with overflow:hidden and no scroller  (→ unreachable content)
 *   • timers/listeners registered but never cleaned up
 *
 * ZERO dependencies. Run:  node tools/invariant-lint.js
 * Exit code 1 if any ERROR-level finding — wire into CI to prevent regressions.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || '.';
const P = (f) => path.join(ROOT, f);
const read = (f) => { try { return fs.readFileSync(P(f), 'utf8'); } catch { return null; } };

const findings = [];
const add = (level, rule, msg, hint) => findings.push({ level, rule, msg, hint });

const app = read('js/app.js') || read('app.js');
const css = read('css/styles.css') || read('styles.css');
const html = read('index.html');

if (!app) { console.error('Cannot find app.js'); process.exit(2); }

// ── helper: extract a function body by name ──────────────────────────
function fnBody(src, name) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const m = re.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length, depth = 1;
  while (depth > 0 && i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(m.index, i);
}

// ═══════════════════════════════════════════════════════════════════
// RULE 1 — STATE FLAGS: every `X = true` must have a matching `X = false`
// on ALL exit paths. This is the bug class that broke photo capture.
// ═══════════════════════════════════════════════════════════════════
{
  const flags = [...app.matchAll(/\b(\w*(?:Active|Processing|Loading|InFlight|Pending|Busy|Open))\s*=\s*true/g)]
    .map((m) => m[1]);
  const uniq = [...new Set(flags)];
  uniq.forEach((flag) => {
    const sets = (app.match(new RegExp(`\\b${flag}\\s*=\\s*true`, 'g')) || []).length;
    const clears = (app.match(new RegExp(`\\b${flag}\\s*=\\s*false`, 'g')) || []).length;
    if (clears === 0) {
      add('ERROR', 'state-flag-never-cleared',
        `\`${flag}\` is set true (${sets}x) but NEVER set false.`,
        'A flag that is never cleared permanently changes app behaviour. Add a reset on every exit path.');
    } else if (sets > clears) {
      add('WARN', 'state-flag-unbalanced',
        `\`${flag}\`: ${sets} set-true vs ${clears} set-false.`,
        'More sets than clears often means an error path forgets to reset. Check catch/onerror branches.');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// RULE 2 — ASYNC ERROR PATHS: FileReader / Image must have onerror.
// This is EXACTLY what broke photo capture.
// ═══════════════════════════════════════════════════════════════════
{
  const readers = (app.match(/new FileReader\(\)/g) || []).length;
  const readerErr = (app.match(/\.onerror\s*=/g) || []).length;
  const imgs = (app.match(/new Image\(\)/g) || []).length;
  // find FileReader instances whose next 400 chars lack onerror
  let idx = 0;
  while ((idx = app.indexOf('new FileReader()', idx)) !== -1) {
    const win = app.slice(idx, idx + 900);
    if (!/onerror/.test(win)) {
      const line = app.slice(0, idx).split('\n').length;
      add('ERROR', 'filereader-no-onerror',
        `FileReader at line ~${line} has no .onerror handler.`,
        'A failed read leaves any "processing" flag stuck true → the flow hangs forever.');
    }
    idx += 16;
  }
  idx = 0;
  while ((idx = app.indexOf('new Image()', idx)) !== -1) {
    const win = app.slice(idx, idx + 700);
    if (!/onerror/.test(win)) {
      const line = app.slice(0, idx).split('\n').length;
      add('WARN', 'image-no-onerror',
        `Image() at line ~${line} has no .onerror handler.`,
        'A corrupt/oversized image silently kills the decode chain.');
    }
    idx += 11;
  }
}

// ═══════════════════════════════════════════════════════════════════
// RULE 3 — LEAFLET MAPS: every L.map() needs invalidateSize() somewhere,
// or it renders blank when created in a hidden/animating container.
// ═══════════════════════════════════════════════════════════════════
{
  const maps = [...app.matchAll(/(\w+)\s*=\s*L\.map\(/g)].map((m) => m[1]);
  maps.forEach((v) => {
    const hasInval = new RegExp(`${v}\\.invalidateSize`).test(app);
    if (!hasInval) {
      add('ERROR', 'leaflet-no-invalidatesize',
        `Leaflet map \`${v}\` is created but never calls ${v}.invalidateSize().`,
        'If the container is display:none or mid-animation at creation, Leaflet measures 0x0 → BLANK MAP. Call invalidateSize() after layout settles (rAF + a timeout).');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// RULE 4 — SCROLL TRAPS: flex container with overflow:hidden and no
// descendant scroller = unreachable content.  (broke the confirm step)
// ═══════════════════════════════════════════════════════════════════
if (css) {
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)];
  const hiddenFlex = rules.filter(([, sel, body]) =>
    /display:\s*flex/.test(body) && /overflow:\s*hidden/.test(body) && !/overflow-y:\s*(auto|scroll)/.test(body));
  hiddenFlex.forEach(([, sel]) => {
    const s = sel.trim();
    // does ANY rule scope a scroller under this selector?
    // A descendant may legitimately be the scroller. Extract the container's
    // id/class token and see if ANY rule scoping under it declares overflow-y.
    const token = (s.match(/[#.][\w-]+/g) || []).pop() || s;
    const hasChildScroller = rules.some(([, sel2, body2]) => {
      if (!/overflow-y:\s*(auto|scroll)/.test(body2)) return false;
      // same component family (shares the id/class stem) => it's the scroller
      const stem = token.replace(/^[#.]/, '').split('--')[0].split('__')[0];
      return sel2.includes(stem);
    });
    if (!hasChildScroller) {
      add('ERROR', 'scroll-trap',
        `\`${s.slice(0, 60)}\` is display:flex + overflow:hidden with no descendant scroller.`,
        'Content taller than the container becomes UNREACHABLE (no scrollbar anywhere). Give the flex child `flex:1; min-height:0; overflow-y:auto`.');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// RULE 5 — EXIT AFFORDANCES: every overlay needs a way out.
// ═══════════════════════════════════════════════════════════════════
if (html) {
  // Overlays that SHOULD block (legal gate, first-run, destructive confirm)
  const INTENTIONALLY_BLOCKING = ['tosOverlay', 'onboardingOverlay', 'deleteConfirmOverlay'];
  const ids = [...html.matchAll(/id="(\w*(?:Overlay|Modal))"/g)].map((m) => m[1]);
  [...new Set(ids)].forEach((id) => {
    if (INTENTIONALLY_BLOCKING.includes(id)) return;
    const i = html.indexOf(`id="${id}"`);
    const block = html.slice(i, i + 6000);
    const hasClose = /modal__close|overlay__close|aria-label="Close|ph-x(?![-\w])|btn.*Close/i.test(block);
    if (!hasClose) {
      add('WARN', 'overlay-no-close',
        `Overlay \`${id}\` has no visible close (×) affordance.`,
        'Users must be able to exit without hunting for a button at the bottom of a long screen.');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// RULE 6 — TOASTS must be dismissible (not auto-close-only).
// ═══════════════════════════════════════════════════════════════════
{
  const st = fnBody(app, 'showToast');
  if (st) {
    const hasClose = /toast__close|toast-close|dismiss/i.test(st);
    if (!hasClose) {
      const longToasts = [...app.matchAll(/showToast\([^,]+,\s*'[a-z]+',\s*(\d{4,})/g)]
        .map((m) => +m[1]).filter((n) => n >= 5000);
      add('WARN', 'toast-not-dismissible',
        `showToast() creates no close button. ${longToasts.length} toasts last >=5s (max ${Math.max(0, ...longToasts)}ms).`,
        'Users cannot dismiss a toast that is covering content. Add a × to the toast template.');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// RULE 7 — STALE STATE: module-level "last*Id" vars that are assigned
// but never nulled.  (this was the premature-share-nudge bug)
// ═══════════════════════════════════════════════════════════════════
{
  const vars = [...app.matchAll(/\blet\s+(last\w*Id|active\w*Id|current\w*Id|pending\w*Id)\s*=/g)].map((m) => m[1]);
  [...new Set(vars)].forEach((v) => {
    const nulled = new RegExp(`\\b${v}\\s*=\\s*null`).test(app);
    if (!nulled) {
      add('WARN', 'stale-id-never-cleared',
        `\`${v}\` is assigned but never reset to null.`,
        'A stale id makes later code act on the WRONG (previous) record — e.g. firing a prompt for an old report.');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// RULE 8 — TIMER / LISTENER LEAKS
// ═══════════════════════════════════════════════════════════════════
{
  const si = (app.match(/setInterval\(/g) || []).length;
  const ci = (app.match(/clearInterval\(/g) || []).length;
  if (si > ci) add('WARN', 'timer-leak', `setInterval x${si} vs clearInterval x${ci}.`,
    'Uncleared intervals keep running after the view is gone — battery + stale updates.');

  const ael = (app.match(/addEventListener\(/g) || []).length;
  const rel = (app.match(/removeEventListener\(/g) || []).length;
  if (ael > rel * 8) add('INFO', 'listener-imbalance',
    `addEventListener x${ael} vs removeEventListener x${rel}.`,
    'Fine if handlers are bound to elements that get replaced; check any bound to window/document inside render loops.');
}

// ═══════════════════════════════════════════════════════════════════
// RULE 9 — SERVICE WORKER UPDATE PATH (stale-app risk)
// ═══════════════════════════════════════════════════════════════════
{
  if (!/registration\.update\(\)|reg\.update\(\)/.test(app)) {
    add('WARN', 'sw-no-update-check',
      'Service worker is registered but never calls registration.update().',
      'Installed PWAs can run a stale version for days. Call reg.update() on launch + on visibilitychange, and reload on controllerchange.');
  }
}

// ═══════════════════════════════════════════════════════════════════
// RULE 10 — STORAGE SAFETY
// ═══════════════════════════════════════════════════════════════════
{
  const lines = app.split('\n');
  let unguarded = 0;
  lines.forEach((l, i) => {
    if (!l.includes('localStorage.setItem')) return;
    const ctx = lines.slice(Math.max(0, i - 3), i + 2).join('\n');
    if (!/try|safeLocalSet/.test(ctx)) unguarded++;
  });
  if (unguarded) add('WARN', 'unguarded-storage-write',
    `${unguarded} localStorage.setItem call(s) not wrapped in try/catch.`,
    'QuotaExceededError on a full device throws and breaks the enclosing flow.');
}

// ── REPORT ────────────────────────────────────────────────────────
const order = { ERROR: 0, WARN: 1, INFO: 2 };
findings.sort((a, b) => order[a.level] - order[b.level]);
const C = { ERROR: '\x1b[31m', WARN: '\x1b[33m', INFO: '\x1b[36m', R: '\x1b[0m', D: '\x1b[2m' };

console.log('\n══════ CivicRadar Invariant Lint ══════\n');
if (!findings.length) {
  console.log('  ✅ No findings. All invariants hold.\n');
} else {
  findings.forEach((f) => {
    console.log(`${C[f.level]}[${f.level}]${C.R} ${C.D}${f.rule}${C.R}`);
    console.log(`   ${f.msg}`);
    console.log(`   ${C.D}→ ${f.hint}${C.R}\n`);
  });
}
const errors = findings.filter((f) => f.level === 'ERROR').length;
const warns = findings.filter((f) => f.level === 'WARN').length;
console.log(`──────  ${errors} error(s), ${warns} warning(s)  ──────\n`);
process.exit(errors ? 1 : 0);
