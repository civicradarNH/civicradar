/**
 * CivicRadar 5-min demo v2 (?demo=demo5v2)
 * Story-driven tour: hook → map → report → community → profile → filing → langs/PWA → admin → close
 */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('demo') !== 'demo5v2') return;

  const VOICE_BASE = '/video/voiceover-demo5-v2/';
  const MANIFEST_URL = '/video/demo5-v2-manifest.json';
  const VOICE_ENABLED = params.get('voice') !== '0';
  const CAPTURE_MODE = params.get('capture') === '1';

  const sleep = (ms) => new Promise((r) => setTimeout(r, CAPTURE_MODE ? Math.min(ms, 250) : ms));
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const chapterDurations = {};

  async function loadManifest() {
    try {
      const res = await fetch(MANIFEST_URL);
      if (!res.ok) return;
      const data = await res.json();
      (data.chapters || []).forEach((c) => {
        if (c.id && c.durationSec) chapterDurations[c.id] = c.durationSec;
      });
    } catch { /* manifest optional until voiceover generated */ }
  }

  function chapterWaitMs(chapter) {
    const fromManifest = chapterDurations[chapter.audioId];
    if (fromManifest) return Math.round(fromManifest * 1000);
    return chapter.narrateMs || 12000;
  }

  function closeAllTourModals() {
    window.closeCommunityModal?.();
    window.closeProfileModal?.();
    window.closeReportModal?.();
    window.closeSuccessModal?.();
    window.closeAdminModal?.();
    window.closeLeadModal?.();
    window.closeCoordinatorDashboard?.();
    window.closeAdminReportModal?.();
    window.closePartnerPortal?.();
    $('#aboutOverlay')?.classList.remove('open');
    $('#escalationOverlay')?.classList.remove('open');
    $('#langOverlay')?.classList.remove('open');
    $('#adminQueueOverlay')?.classList.remove('open');
    document.body.style.overflow = '';
    $$('#bottomNav .nav-tab').forEach((t) => {
      if (t.dataset.tab === 'map') t.click();
    });
  }

  let cursorEl, captionEl, progressEl, rippleLayer;
  let tourRunning = false;
  let tourPaused = false;
  let lastSubmittedReportId = null;

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
      #demoCaptionBar {
        position: fixed; left: 0; right: 0; bottom: 72px; z-index: 99998;
        padding: 14px 20px; background: linear-gradient(transparent, rgba(15,23,42,0.92));
        pointer-events: none;
      }
      #demoCaptionInner {
        max-width: 720px; margin: 0 auto; padding: 12px 16px;
        background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(99, 102, 241, 0.4);
        border-radius: 12px; color: #f1f5f9; font: 500 15px/1.45 'Segoe UI', system-ui, sans-serif;
        text-align: center;
      }
      #demoProgress {
        position: fixed; top: 0; left: 0; height: 3px; background: #6366f1; z-index: 99999;
        width: 0%; transition: width 0.4s ease;
      }
      #demoTourBadge {
        position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 99998;
        background: #6366f1; color: #fff; font: 600 11px/1 'Segoe UI', sans-serif;
        padding: 6px 14px; border-radius: 999px; letter-spacing: 0.04em;
        text-transform: uppercase; pointer-events: none;
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
      body.demo5v2-active #coachOverlay { display: none !important; }
    `;
    document.head.appendChild(css);
  }

  function createOverlay() {
    injectStyles();
    cursorEl = document.createElement('div');
    cursorEl.id = 'demoCursor';
    cursorEl.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-6 .5L10 20l-2-8-3-9z" fill="#fff" stroke="#1e293b" stroke-width="1.2"/></svg>';
    captionEl = document.createElement('div');
    captionEl.id = 'demoCaptionBar';
    captionEl.innerHTML = '<div id="demoCaptionInner"></div>';
    progressEl = document.createElement('div');
    progressEl.id = 'demoProgress';
    const badge = document.createElement('div');
    badge.id = 'demoTourBadge';
    badge.textContent = 'Product demo';
    rippleLayer = document.createElement('div');
    rippleLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99996';
    document.body.appendChild(progressEl);
    document.body.appendChild(badge);
    document.body.appendChild(cursorEl);
    document.body.appendChild(captionEl);
    document.body.appendChild(rippleLayer);
  }

  function setCaption(text) {
    const inner = $('#demoCaptionInner');
    if (inner) inner.textContent = text || '';
  }

  function setProgress(i, total) {
    if (progressEl) progressEl.style.width = `${((i + 1) / total) * 100}%`;
  }

  function ripple(x, y) {
    const r = document.createElement('div');
    r.className = 'demo-ripple';
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    rippleLayer.appendChild(r);
    setTimeout(() => r.remove(), 600);
  }

  async function moveTo(el, ms) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    cursorEl.style.transitionDuration = `${ms || 550}ms`;
    cursorEl.style.left = `${x}px`;
    cursorEl.style.top = `${y}px`;
    await sleep(ms || 550);
  }

  async function highlight(el, on) {
    if (!el) return;
    el.classList.toggle('demo-highlight', on);
  }

  async function tourClick(el, opts) {
    if (!el) return;
    const hold = (opts && opts.hold) || 450;
    await moveTo(el, opts && opts.moveMs);
    await highlight(el, true);
    await sleep(hold);
    const rect = el.getBoundingClientRect();
    ripple(rect.left + rect.width / 2, rect.top + rect.height / 2);
    cursorEl.classList.add('is-clicking');
    await sleep(100);
    cursorEl.classList.remove('is-clicking');
    el.click();
    await sleep(320);
    await highlight(el, false);
  }

  async function tourScroll(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(650);
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
    canvas.classList.add('visible');
    $('#reportNotes')?.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof window.updateReportFlowSteps === 'function') {
      window.updateReportFlowSteps('details');
    }
  }

  function findLatestUserReportId() {
    try {
      const uid = JSON.parse(localStorage.getItem('civicradar_user') || '{}').id;
      const reports = JSON.parse(localStorage.getItem('mosquiTrackReports') || '[]');
      const mine = reports.filter((r) => r.reporterId === uid);
      if (mine.length) return mine[0].id;
    } catch { /* ignore */ }
    return lastSubmittedReportId;
  }

  async function openNeighborMeToo() {
    window.openReportPopupById?.('seed-2');
    await sleep(1400);
    const btn = document.querySelector('[data-confirm="seed-2"]');
    if (btn) {
      await tourClick(btn, { hold: 380, moveMs: 320 });
      await sleep(1600);
    } else {
      await moveTo($('#map'), 500);
      await sleep(1000);
    }
  }

  function showPwaNudge() {
    const el = $('#pwaInstallNudge');
    if (el) {
      el.classList.remove('hidden');
      document.body.classList.add('pwa-nudge-visible');
    }
  }

  let currentAudio = null;

  function playChapterAudio(audioId) {
    if (!VOICE_ENABLED || !audioId) return sleep(0);
    return new Promise((resolve) => {
      const audio = new Audio(VOICE_BASE + audioId + '.mp3');
      currentAudio = audio;
      audio.onended = () => { currentAudio = null; resolve(); };
      audio.onerror = () => { currentAudio = null; resolve(); };
      audio.play().catch(() => resolve());
    });
  }

  async function step(chapter, index) {
    while (tourPaused) await sleep(200);
    if (CAPTURE_MODE) {
      await chapter.run();
      await sleep(600);
      window.__tourCaptureReady = { index, id: chapter.audioId, caption: chapter.caption };
      await new Promise((resolve) => { window.__tourCaptureContinue = resolve; });
      return;
    }
    if (VOICE_ENABLED) {
      await Promise.all([chapter.run(), playChapterAudio(chapter.audioId)]);
    } else {
      const wait = chapterWaitMs(chapter);
      await Promise.all([chapter.run(), sleep(wait)]);
    }
    await sleep(350);
  }

  const TOUR = [
    {
      audioId: '01-hook',
      narrateMs: 42000,
      caption: 'June again — grey puddle, mosquitoes, WhatsApp forwards that go nowhere.',
      run: async () => {
        closeAllTourModals();
        await sleep(700);
        await moveTo($('#map'), 600);
        await sleep(1200);
        await moveTo($('#mapLegend'), 500);
        await sleep(1000);
        await moveTo($('#headerContext'), 500);
        await sleep(900);
      },
    },
    {
      audioId: '02-map',
      narrateMs: 28000,
      caption: 'Ward map — red open, green fixed. Mumbai, Pune, Thane.',
      run: async () => {
        await tourClick($('#btnRecenter'), { hold: 350, moveMs: 400 });
        await moveTo($('#headerContext'), 450);
        await sleep(900);
        await moveTo($('#map'), 550);
        await sleep(1100);
        await moveTo($('#mapLegend'), 450);
        await sleep(800);
      },
    },
    {
      audioId: '03-report',
      narrateMs: 72000,
      caption: 'Report stagnant water — photo, GPS ward, submit, confetti.',
      run: async () => {
        await tourClick($('#btnCamera'), { hold: 320, moveMs: 340 });
        await sleep(600);
        simulateReportPhoto();
        await moveTo($('#imageCanvas'), 400);
        await sleep(1200);
        const notes = $('#reportNotes');
        if (notes) {
          notes.value = 'Grey puddle near the playground.';
          notes.dispatchEvent(new Event('input', { bubbles: true }));
          await moveTo(notes, 350);
          await sleep(800);
        }
        await moveTo($('#headerContext') || $('#reportTitle'), 400);
        await sleep(700);
        await tourClick($('#btnSubmitReport'), { hold: 380, moveMs: 320 });
        await sleep(2200);
        await moveTo($('#btnShareWhatsApp'), 450);
        await sleep(1200);
        const closeBtn = $('#btnSuccessClose') || $('#successModal .modal__close');
        if (closeBtn) await tourClick(closeBtn, { hold: 300, moveMs: 300 });
        else window.closeSuccessModal?.();
        await sleep(500);
        lastSubmittedReportId = findLatestUserReportId();
      },
    },
    {
      audioId: '04-community',
      narrateMs: 42000,
      caption: 'Leaderboard, Me too corroboration, neighbour social proof.',
      run: async () => {
        closeAllTourModals();
        await sleep(400);
        await tourClick($('#bottomNav [data-tab="community"]') || $$('#bottomNav .nav-tab')[1]);
        await sleep(1800);
        await tourScroll($('.impact-stats') || $('.ward-leaderboard'));
        await sleep(800);
        await tourClick($('#bottomNav [data-tab="map"]') || $$('#bottomNav .nav-tab')[0]);
        await sleep(600);
        await openNeighborMeToo();
      },
    },
    {
      audioId: '05-profile',
      narrateMs: 28000,
      caption: 'Your reports, status, days pending, share link.',
      run: async () => {
        closeAllTourModals();
        await sleep(400);
        await tourClick($('#btnProfile'));
        await sleep(2000);
        await tourScroll($('#reportList'));
        await sleep(800);
        const escBtn = document.querySelector('[data-escalate]');
        if (escBtn) {
          await highlight(escBtn, true);
          await sleep(1000);
          await highlight(escBtn, false);
        }
        await moveTo($('#profilePoints'), 450);
        await sleep(800);
      },
    },
    {
      audioId: '06-filing',
      narrateMs: 28000,
      caption: 'Not official yet — 1916, MyBMC, PMC CARE, Thane helpline.',
      run: async () => {
        window.closeProfileModal?.();
        await sleep(400);
        const rid = findLatestUserReportId() || 'seed-1';
        window.openEscalationModal?.(rid);
        await sleep(1200);
        await tourScroll($('#escalationModal'));
        await moveTo($('#btnEscCall'), 450);
        await sleep(900);
        await moveTo($('#btnEscWhatsApp'), 450);
        await sleep(900);
        await moveTo($('#btnEscParticipate'), 450);
        await sleep(800);
      },
    },
    {
      audioId: '07-languages',
      narrateMs: 28000,
      caption: 'Four languages · Add to Home Screen.',
      run: async () => {
        $('#btnEscClose')?.click();
        await sleep(500);
        await tourClick($('#btnLang'));
        await sleep(1400);
        await tourClick($('[data-lang="hi"]'));
        await sleep(1000);
        await tourClick($('#btnLang'));
        await sleep(500);
        await tourClick($('[data-lang="mr"]'));
        await sleep(800);
        await tourClick($('#btnLang'));
        await sleep(400);
        await tourClick($('[data-lang="en"]'));
        await sleep(600);
        showPwaNudge();
        await sleep(600);
        const pwaBtn = $('#pwaInstallNudge button') || $('#btnInstall');
        if (pwaBtn) await moveTo(pwaBtn, 450);
        await sleep(1000);
      },
    },
    {
      audioId: '08-admin',
      narrateMs: 28000,
      caption: 'BMC hazard queue · NGO coordinator hub.',
      run: async () => {
        $('#pwaInstallNudge')?.classList.add('hidden');
        await sleep(300);
        await tourClick($('#btnProfile'));
        await sleep(500);
        const ward = $('#profileGreeting');
        for (let i = 0; i < 5; i++) {
          ward?.click();
          await sleep(320);
        }
        await sleep(500);
        $('#adminUser').value = 'admin';
        $('#adminPass').value = 'password';
        await tourClick($('#btnAdminSubmit'));
        await sleep(2000);
        await tourScroll($('#adminQueueOverlay'));
        await sleep(800);
        $('#personaBarAction')?.click();
        await sleep(600);
        await tourClick($('#btnProfile'));
        await sleep(400);
        for (let i = 0; i < 5; i++) {
          $('#profilePoints')?.click();
          await sleep(320);
        }
        $('#leadUser').value = 'lead';
        $('#leadPass').value = 'password';
        await tourClick($('#btnLeadSubmit'));
        await sleep(2000);
        await tourScroll($('#coordinatorOverlay'));
        await sleep(800);
      },
    },
    {
      audioId: '09-close',
      narrateMs: 18000,
      caption: 'Pin it. Rally neighbours. File when ready.',
      run: async () => {
        $('#personaBarAction')?.click();
        await sleep(600);
        closeAllTourModals();
        await sleep(500);
        await moveTo($('#btnCamera'), 600);
        await sleep(1500);
        await moveTo($('#map'), 500);
        await sleep(1000);
      },
    },
  ];

  async function runTour() {
    if (tourRunning) return;
    tourRunning = true;
    window.demoTourRunning = true;
    createOverlay();
    document.body.classList.add('demo5v2-active');

    for (let i = 0; i < TOUR.length; i++) {
      setProgress(i, TOUR.length);
      setCaption(TOUR[i].caption);
      await step(TOUR[i], i);
    }

    setCaption('Demo complete.');
    setProgress(TOUR.length, TOUR.length);
    window.demoTourComplete = true;
    window.dispatchEvent(new CustomEvent('demotour-complete'));
    tourRunning = false;
  }

  window.startDemoTour = runTour;
  window.pauseDemoTour = () => { tourPaused = !tourPaused; };

  waitForApp().then(async () => {
    await loadManifest();
    if (params.get('autostart') === '1' || CAPTURE_MODE) {
      setTimeout(runTour, CAPTURE_MODE ? 2500 : 1500);
    } else {
      setCaption('Press T or call startDemoTour()');
      document.addEventListener('keydown', (e) => {
        if (e.key === 't' || e.key === 'T') runTour();
      }, { once: true });
    }
  });
})();
