/**
 * CivicRadar report-flow ad capture (?demo=report&autostart=1)
 * Single continuous stagnant-water report — cursor overlay, no caption bar.
 */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('demo') !== 'report') return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (sel) => document.querySelector(sel);

  let cursorEl, rippleLayer;
  let flowRunning = false;
  window.__flowMarks = [];

  function mark(id) {
    window.__flowMarks.push({ id, t: performance.now() });
    window.dispatchEvent(new CustomEvent('reportflow-mark', { detail: { id } }));
  }

  function injectStyles() {
    const css = document.createElement('style');
    css.textContent = `
      #demoCursor {
        position: fixed; left: 50%; top: 50%; width: 28px; height: 28px;
        margin: -4px 0 0 -4px; z-index: 99999; pointer-events: none;
        transition: left 0.55s cubic-bezier(0.22, 1, 0.36, 1), top 0.55s cubic-bezier(0.22, 1, 0.36, 1);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
      }
      #demoCursor svg { display: block; }
      #demoCursor.is-clicking { transform: scale(0.82); transition: transform 0.12s ease; }
      .demo-highlight {
        outline: 3px solid rgba(99, 102, 241, 0.85) !important;
        outline-offset: 3px;
        box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.25) !important;
      }
      .demo-ripple {
        position: fixed; width: 12px; height: 12px; border-radius: 50%;
        border: 2px solid rgba(99, 102, 241, 0.9); pointer-events: none; z-index: 99997;
        animation: demoRipple 0.55s ease-out forwards;
      }
      @keyframes demoRipple {
        from { transform: translate(-50%,-50%) scale(0.5); opacity: 1; }
        to { transform: translate(-50%,-50%) scale(4); opacity: 0; }
      }
      body.demo-report-flow-active #coachOverlay,
      body.demo-report-flow-active #pwaInstallNudge { display: none !important; }
    `;
    document.head.appendChild(css);
  }

  function createCursor() {
    injectStyles();
    cursorEl = document.createElement('div');
    cursorEl.id = 'demoCursor';
    cursorEl.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-6 .5L10 20l-2-8-3-9z" fill="#fff" stroke="#1e293b" stroke-width="1.2"/></svg>';
    rippleLayer = document.createElement('div');
    rippleLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99996';
    document.body.appendChild(cursorEl);
    document.body.appendChild(rippleLayer);
  }

  async function moveTo(el, ms) {
    if (!el || !cursorEl) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    cursorEl.style.transitionDuration = `${ms || 550}ms`;
    cursorEl.style.left = `${x}px`;
    cursorEl.style.top = `${y}px`;
    await sleep(ms || 550);
  }

  function ripple(x, y) {
    const r = document.createElement('div');
    r.className = 'demo-ripple';
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    rippleLayer.appendChild(r);
    setTimeout(() => r.remove(), 600);
  }

  async function flowClick(el, opts) {
    if (!el) return;
    const hold = (opts && opts.hold) || 450;
    await moveTo(el, opts && opts.moveMs);
    el.classList.add('demo-highlight');
    await sleep(hold);
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    ripple(cx, cy);
    cursorEl.classList.add('is-clicking');
    await sleep(100);
    cursorEl.classList.remove('is-clicking');
    el.click();
    await sleep(320);
    el.classList.remove('demo-highlight');
  }

  function simulateReportPhoto() {
    const canvas = $('#imageCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 640;
    canvas.height = 480;
    const g = ctx.createLinearGradient(0, 0, 640, 480);
    g.addColorStop(0, '#475569');
    g.addColorStop(0.45, '#334155');
    g.addColorStop(1, '#1e293b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = 'rgba(34,197,94,0.28)';
    ctx.fillRect(40, 280, 560, 140);
    ctx.fillStyle = 'rgba(56,189,248,0.35)';
    ctx.fillRect(80, 300, 480, 90);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(320, 340, 200, 45, 0, 0, Math.PI * 2);
    ctx.fill();
    canvas.classList.add('visible');
    $('#reportNotes')?.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof window.updateReportFlowSteps === 'function') {
      window.updateReportFlowSteps('details');
    }
  }

  function waitForApp() {
    return new Promise((resolve) => {
      const tick = () => {
        if (window.openReportModal && document.querySelector('#map')) resolve();
        else setTimeout(tick, 80);
      };
      tick();
    });
  }

  async function runFlow() {
    if (flowRunning) return;
    flowRunning = true;
    createCursor();
    document.body.classList.add('demo-report-flow-active');
    window.__flowMarks = [];
    const t0 = performance.now();
    window.__flowT0 = t0;

    mark('02-open');
    await sleep(1400);
    await moveTo($('#headerContext') || $('#map'), 380);
    await sleep(900);

    mark('03-report');
    await flowClick($('#btnCamera'), { hold: 320, moveMs: 340 });
    await sleep(650);

    mark('04-photo');
    const stagnant = document.querySelector('[data-hazard="stagnant-water"]')
      || document.querySelector('#hazardGrid .hazard-chip.is-selected')
      || document.querySelector('#hazardGrid button');
    if (stagnant) {
      await moveTo(stagnant, 280);
      await sleep(380);
    }
    simulateReportPhoto();
    await moveTo($('#imageCanvas'), 300);
    await sleep(1400);

    mark('05-ward');
    await moveTo($('#headerContext') || $('#reportTitle'), 320);
    await sleep(750);
    const notes = $('#reportNotes');
    if (notes) {
      notes.value = 'Grey puddle — three weeks now.';
      notes.dispatchEvent(new Event('input', { bubbles: true }));
      await moveTo(notes, 300);
      await sleep(700);
    }

    mark('06-submit');
    await flowClick($('#btnSubmitReport'), { hold: 380, moveMs: 320 });
    await sleep(2800);

    mark('07-pin');
    const closeBtn = $('#btnSuccessClose') || $('#successModal .modal__close');
    if (closeBtn) {
      await sleep(900);
      await flowClick(closeBtn, { hold: 320, moveMs: 300 });
    } else {
      window.closeSuccessModal?.();
      await sleep(600);
    }
    await sleep(500);
    await moveTo($('#map'), 380);
    await sleep(14000);

    mark('flow-end');
    window.reportFlowComplete = true;
    flowRunning = false;
  }

  window.startReportFlowDemo = runFlow;

  waitForApp().then(() => {
    if (params.get('autostart') === '1') {
      setTimeout(runFlow, 1500);
    }
  });
})();
