#!/usr/bin/env node
/**
 * CivicRadar structural invariant linter (zero dependencies).
 * Run: node tools/invariant-lint.js .
 *
 * Complements tests/e2e_comprehensive.py (Python Playwright, CI gate) and
 * tests/civicradar.spec.js (focused JS Playwright smoke). Catches ship-glitch
 * classes before browser tests: FileReader hangs, scroll traps, overlay dismiss,
 * SW version drift, unguarded storage writes.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '.');

/** @type {{ level: 'ERROR'|'WARN', rule: string, file: string, line?: number, message: string }[]} */
const findings = [];

function add(level, rule, file, message, line) {
  findings.push({ level, rule, file, message, line });
}

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf8');
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// --- FileReader without onerror (photo hang class) ---
function checkFileReaders() {
  const files = ['js/app.js'];
  for (const rel of files) {
    const src = read(rel);
    if (!src) continue;
    const re = /new\s+FileReader\s*\(\s*\)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const start = m.index;
      const window = src.slice(start, start + 1200);
      if (!/reader\.onerror\s*=/.test(window) && !/\.onerror\s*=/.test(window)) {
        add('ERROR', 'filereader-no-onerror', rel,
          'FileReader() block missing reader.onerror — can hang photo flow on corrupt reads',
          lineOf(src, start));
      }
    }
  }
}

// --- SW / app version parity ---
function checkSwVersion() {
  const app = read('js/app.js');
  const sw = read('sw.js');
  if (!app || !sw) return;
  const appVer = (app.match(/CIVIC_APP_VERSION\s*=\s*['"](v\d+)['"]/) || [])[1];
  const swVer = (sw.match(/const\s+CACHE\s*=\s*['"]civicradar-(v\d+)['"]/) || [])[1];
  if (!appVer || !swVer) {
    add('ERROR', 'sw-version-missing', 'js/app.js', 'Could not parse CIVIC_APP_VERSION or sw.js CACHE');
    return;
  }
  if (appVer !== swVer) {
    add('ERROR', 'sw-version-gap', 'sw.js',
      `CIVIC_APP_VERSION (${appVer}) !== CACHE (${swVer}) — bump both on ship`);
  }
}

// --- Unguarded localStorage writes in app.js ---
function checkStorageWrites() {
  const rel = 'js/app.js';
  const src = read(rel);
  if (!src) return;
  const re = /localStorage\.setItem\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const line = lineOf(src, m.index);
    const ctxStart = Math.max(0, m.index - 400);
    const ctx = src.slice(ctxStart, m.index + 80);
    if (/function\s+safeLocalSet/.test(ctx) && ctx.indexOf('localStorage.setItem') > ctx.indexOf('function safeLocalSet')) {
      continue; // inside safeLocalSet itself
    }
    if (/function\s+saveReports/.test(ctx)) {
      const fnBody = src.slice(m.index - 200, m.index + 600);
      if (/try\s*\{[\s\S]*localStorage\.setItem/.test(fnBody)) continue;
    }
    add('WARN', 'storage-unguarded', rel,
      'localStorage.setItem outside safeLocalSet — prefer safeLocalSet or try/catch quota handling',
      line);
  }
}

// --- Overlays without dismiss control (index.html) ---
function checkOverlayDismiss() {
  const rel = 'index.html';
  const html = read(rel);
  if (!html) return;
  const blocking = new Set([
    'tosOverlay', 'onboardingOverlay', 'deleteConfirmOverlay',
    'coachMark', 'tourOverlay',
  ]);
  const overlayRe = /<div[^>]+id="([^"]+Overlay)"[^>]*>/g;
  let m;
  while ((m = overlayRe.exec(html)) !== null) {
    const id = m[1];
    if (blocking.has(id)) continue;
    const start = m.index;
    const chunk = html.slice(start, start + 2500);
    const hasClose = /modal__close|data-close=|__dismiss|btnTourSkip|btnDismissCoach/.test(chunk);
    if (!hasClose) {
      add('ERROR', 'overlay-no-close', rel, `#${id} has no modal__close / dismiss control`, lineOf(html, start));
    }
  }
}

// --- Toast dismissability (showToast must create .toast__close) ---
function checkToastDismiss() {
  const rel = 'js/app.js';
  const src = read(rel);
  if (!src) return;
  const fnMatch = src.match(/function\s+showToast\s*\([^)]*\)\s*\{([\s\S]*?)\n  \}/);
  if (!fnMatch) {
    add('WARN', 'toast-fn-missing', rel, 'showToast() not found');
    return;
  }
  const body = fnMatch[1];
  if (!body.includes('toast__close')) {
    add('ERROR', 'toast-undismissable', rel, 'showToast() does not create .toast__close button');
  }
  if (!body.includes('hideTimer = setTimeout(dismissToast')) {
    add('WARN', 'toast-no-autohide', rel, 'showToast() may lack auto-dismiss for non-action toasts');
  }
}

// --- Scroll trap: flex modal + overflow:hidden needs inner scroller ---
function checkScrollTrap() {
  const rel = 'css/styles.css';
  const css = read(rel);
  if (!css) return;
  const trap = css.match(/#reportModal\.report-modal--confirm\s*\{[^}]+\}/);
  if (!trap) {
    add('WARN', 'scroll-trap', rel, '#reportModal.report-modal--confirm rule not found');
    return;
  }
  if (!/overflow:\s*hidden/.test(trap[0])) {
    add('WARN', 'scroll-trap', rel, 'Confirm modal should clip overflow on sheet');
  }
  const scrollerBlocks = [...css.matchAll(/#reportStepConfirm[^{]*\{[^}]+\}/g)].map((m) => m[0]);
  const hasScroller = scrollerBlocks.some((b) => /overflow-y:\s*auto/.test(b));
  if (!hasScroller) {
    add('ERROR', 'scroll-trap', rel,
      '#reportStepConfirm must be overflow-y:auto when parent uses overflow:hidden');
  }
}

// --- Timer leaks: module-level *Timer = setTimeout without prior clearTimeout ---
function checkTimerLeaks() {
  const rel = 'js/app.js';
  const src = read(rel);
  if (!src) return;
  if (/setInterval\s*\(/.test(src)) {
    add('ERROR', 'timer-leak', rel, 'setInterval found — prefer debounced setTimeout with clear');
  }
  const timerVars = [...src.matchAll(/\b(\w+Timer)\s*=\s*setTimeout/g)].map((m) => m[1]);
  const unique = [...new Set(timerVars)];
  for (const name of unique) {
    const assigns = (src.match(new RegExp(`\\b${name}\\s*=\\s*setTimeout`, 'g')) || []).length;
    const clears = (src.match(new RegExp(`clearTimeout\\(\\s*${name}\\s*\\)`, 'g')) || []).length;
    if (assigns > 0 && clears === 0) {
      add('ERROR', 'timer-leak', rel,
        `${name} assigned setTimeout ${assigns}x but never clearTimeout(${name})`);
    } else if (assigns > clears + 1) {
      add('WARN', 'timer-leak', rel,
        `${name}: ${assigns} setTimeout vs ${clears} clearTimeout — verify debounce clears before re-arm`);
    }
  }
}

// --- E2E cache string sync ---
function checkE2eSw06() {
  const e2e = read('tests/e2e_comprehensive.py');
  const sw = read('sw.js');
  if (!e2e || !sw) return;
  const swVer = (sw.match(/civicradar-(v\d+)/) || [])[1];
  if (!swVer) return;
  const count = (e2e.match(new RegExp(`civicradar-${swVer}`, 'g')) || []).length;
  if (count < 2) {
    add('WARN', 'e2e-sw06-drift', 'tests/e2e_comprehensive.py',
      `Expected civicradar-${swVer} in SW06 checks (found ${count})`);
  }
}

function main() {
  checkFileReaders();
  checkSwVersion();
  checkStorageWrites();
  checkOverlayDismiss();
  checkToastDismiss();
  checkScrollTrap();
  checkTimerLeaks();
  checkE2eSw06();

  const errors = findings.filter((f) => f.level === 'ERROR');
  const warns = findings.filter((f) => f.level === 'WARN');

  if (!findings.length) {
    console.log('invariant-lint: OK (no issues)');
    process.exit(0);
  }

  for (const f of findings) {
    const loc = f.line ? `${f.file}:${f.line}` : f.file;
    console.log(`${f.level} [${f.rule}] ${loc} — ${f.message}`);
  }
  console.log(`\ninvariant-lint: ${errors.length} error(s), ${warns.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}

main();
