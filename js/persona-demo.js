/**
 * CivicRadar persona walkthrough (?demo=persona&autostart=1&capture=1)
 * Citizen → NGO Coordinator → BMC Admin with screenshot capture hooks.
 */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('demo') !== 'persona') return;

  const VOICE_BASE = '/video/voiceover-persona/';
  const VOICE_ENABLED = params.get('voice') !== '0';
  const CAPTURE_MODE = params.get('capture') === '1';
  const REPORTS_KEY = 'mosquiTrackReports';
  const USER_KEY = 'civicradar_user';

  const sleep = (ms) => new Promise((r) => setTimeout(r, CAPTURE_MODE ? Math.min(ms, 250) : ms));
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function closeAllTourModals() {
    window.closeCommunityModal?.();
    window.closeProfileModal?.();
    window.closeReportModal?.();
    window.closeAdminModal?.();
    window.closeLeadModal?.();
    window.closeCoordinatorDashboard?.();
    window.closeAdminReportModal?.();
    window.closePartnerPortal?.();
    window.closeSuccessModal?.();
    window.closeTosModal?.();
    window.closeOnboardingModal?.();
    $('#aboutOverlay')?.classList.remove('open');
    $('#escalationOverlay')?.classList.remove('open');
    $('#langOverlay')?.classList.remove('open');
    $('#adminQueueOverlay')?.classList.remove('open');
    document.body.style.overflow = '';
    $$('#bottomNav .nav-tab').forEach((t) => {
      if (t.dataset.tab === 'map') t.click();
    });
  }

  function loadReports() {
    try { return JSON.parse(localStorage.getItem(REPORTS_KEY)) || []; }
    catch { return []; }
  }

  function saveReports(reports) {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  }

  function loadUserObj() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || {}; }
    catch { return {}; }
  }

  function saveUserObj(u) {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }

  function refreshMap() {
    if (typeof window.refreshReportMarkers === 'function') window.refreshReportMarkers();
  }

  function seedPersonaDemoData() {
    const u = loadUserObj();
    const uid = u.id || 'persona-citizen';
    let reports = loadReports().filter((r) => !String(r.id).startsWith('persona-'));

    reports.unshift({
      id: 'persona-neighbor-report',
      reporterId: 'persona-neighbor',
      hazard: 'stagnant-water',
      notes: 'Stagnant water near the playground gate — mosquitoes breeding.',
      ward: 'G/N Ward — Dadar, Shivaji Park',
      reporter: 'Rahul',
      lat: 19.0185,
      lng: 72.8485,
      status: 'pending',
      confirmations: 2,
      timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
    });

    reports.unshift({
      id: 'persona-escalation-report',
      reporterId: uid,
      hazard: 'stagnant-water',
      notes: 'Grey puddle behind our building — filed with BMC.',
      ward: 'G/N Ward — Dadar, Shivaji Park',
      reporter: u.displayName || 'Priya',
      lat: 19.0168,
      lng: 72.8468,
      status: 'pending',
      complaintId: 'BMC-2026-44192',
      filedAt: new Date(Date.now() - 9 * 86400000).toISOString(),
      timestamp: new Date(Date.now() - 12 * 86400000).toISOString(),
      confirmations: 4,
    });

    reports.unshift({
      id: 'persona-admin-report',
      reporterId: 'persona-other-citizen',
      hazard: 'stagnant-water',
      notes: 'Open drain near Shivaji Park — overdue.',
      ward: 'G/N Ward — Dadar, Shivaji Park',
      reporter: 'Ananya',
      lat: 19.0192,
      lng: 72.8492,
      status: 'pending',
      complaintId: 'N/2026/88341',
      filedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      timestamp: new Date(Date.now() - 14 * 86400000).toISOString(),
      confirmations: 5,
      image: simulatePhotoDataUrl('#64748b', '#1e3a2f'),
    });

    saveReports(reports);
    refreshMap();
  }

  function simulatePhotoDataUrl(c1, c2) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 400, 300);
    g.addColorStop(0, c1 || '#64748b');
    g.addColorStop(1, c2 || '#1e3a2f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = 'rgba(34,197,94,0.35)';
    ctx.fillRect(40, 180, 320, 90);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  function simulateReportPhoto() {
    const canvas = $('#imageCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 300;
    const g = ctx.createLinearGradient(0, 0, 400, 300);
    g.addColorStop(0, '#64748b');
    g.addColorStop(0.5, '#334155');
    g.addColorStop(1, '#1e3a2f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = 'rgba(34,197,94,0.35)';
    ctx.fillRect(40, 180, 320, 90);
    canvas.classList.add('visible');
    $('#reportNotes')?.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function injectAdminProof() {
    const input = $('#adminProofInput');
    if (!input) return;
    const blob = await new Promise((resolve) => {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 300;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#86efac';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#166534';
      ctx.font = '16px sans-serif';
      ctx.fillText('Fixed — drain cleared', 80, 150);
      c.toBlob(resolve, 'image/jpeg', 0.9);
    });
    if (!blob) return;
    const file = new File([blob], 'proof.jpg', { type: 'image/jpeg' });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function loginAdmin() {
    window.setAdminMode?.(false);
    window.setLeadMode?.(false);
    await tourClick($('#btnProfile'));
    await sleep(400);
    const ward = $('#profileGreeting');
    for (let i = 0; i < 5; i++) {
      ward?.click();
      await sleep(300);
    }
    await sleep(400);
    $('#adminUser').value = 'admin';
    $('#adminPass').value = 'password';
    await tourClick($('#btnAdminSubmit'));
    await sleep(1200);
  }

  async function loginNgo() {
    window.setAdminMode?.(false);
    window.setLeadMode?.(false);
    await tourClick($('#btnProfile'));
    await sleep(400);
    for (let i = 0; i < 5; i++) {
      $('#profilePoints')?.click();
      await sleep(300);
    }
    await sleep(400);
    $('#leadUser').value = 'lead';
    $('#leadPass').value = 'password';
    await tourClick($('#btnLeadSubmit'));
    await sleep(1200);
  }

  async function exitPersonas() {
    window.setAdminMode?.(false);
    window.setLeadMode?.(false);
    $('#personaBarAction')?.click();
    await sleep(500);
  }

  let cursorEl, captionEl, progressEl, rippleLayer;
  let tourRunning = false;
  let tourPaused = false;

  function injectStyles() {
    if ($('#demoPersonaStyles')) return;
    const css = document.createElement('style');
    css.id = 'demoPersonaStyles';
    css.textContent = `
      #demoCursor {
        position: fixed; left: 50%; top: 50%; width: 28px; height: 28px;
        margin: -4px 0 0 -4px; z-index: 99999; pointer-events: none;
        transition: left 0.65s cubic-bezier(0.22, 1, 0.36, 1), top 0.65s cubic-bezier(0.22, 1, 0.36, 1);
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
        background: #7c3aed; color: #fff; font: 600 11px/1 'Segoe UI', sans-serif;
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
    badge.textContent = 'Persona walkthrough';
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
    cursorEl.style.transitionDuration = `${ms || 650}ms`;
    cursorEl.style.left = `${x}px`;
    cursorEl.style.top = `${y}px`;
    await sleep(ms || 650);
  }

  async function highlight(el, on) {
    if (el) el.classList.toggle('demo-highlight', on);
  }

  async function tourClick(el, opts) {
    if (!el) return;
    const hold = (opts && opts.hold) || 500;
    await moveTo(el, opts && opts.moveMs);
    await highlight(el, true);
    await sleep(hold);
    const rect = el.getBoundingClientRect();
    ripple(rect.left + rect.width / 2, rect.top + rect.height / 2);
    cursorEl.classList.add('is-clicking');
    await sleep(120);
    cursorEl.classList.remove('is-clicking');
    el.click();
    await sleep(350);
    await highlight(el, false);
  }

  async function tourScroll(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(700);
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
    const voice = playChapterAudio(chapter.audioId);
    await Promise.all([chapter.run(), voice]);
    if (!VOICE_ENABLED) await sleep(chapter.narrateMs || 10000);
    await sleep(400);
  }

  async function openNeighborPopup() {
    refreshMap();
    window.openReportPopupById?.('persona-neighbor-report');
    await sleep(1400);
    const btn = document.querySelector('[data-confirm="persona-neighbor-report"]');
    if (btn) {
      await highlight(btn, true);
      await sleep(1400);
      await highlight(btn, false);
    } else {
      await moveTo($('#map'), 600);
      await sleep(1000);
    }
  }

  const TOUR = [
    {
      audioId: '01-intro',
      narrateMs: 32000,
      caption: 'CivicRadar — community hazard reporting for Mumbai monsoon. Not official BMC.',
      run: async () => {
        closeAllTourModals();
        seedPersonaDemoData();
        await sleep(600);
        await moveTo($('#headerContext'), 500);
        await sleep(800);
        await moveTo($('#map'), 600);
        await sleep(1000);
      },
    },
    {
      audioId: '02-onboard',
      narrateMs: 28000,
      caption: 'Terms of Service, GPS consent, ward pick — your first-time setup.',
      run: async () => {
        closeAllTourModals();
        window.openTosModal?.();
        await sleep(800);
        await tourScroll($('#tosModal'));
        await moveTo($('#tosAccept'), 500);
        await sleep(600);
        $('#tosAccept').checked = true;
        $('#btnTosContinue').disabled = false;
        await tourClick($('#btnTosContinue'));
        await sleep(600);
        window.openOnboardingModal?.();
        await sleep(600);
        $('#wardInput').value = 'G/N Ward — Dadar, Shivaji Park';
        $('#displayName').value = 'Priya';
        await moveTo($('#wardInput'), 500);
        await sleep(800);
        await moveTo($('#btnOnboardingContinue'), 500);
        await sleep(800);
      },
    },
    {
      audioId: '03-report',
      narrateMs: 30000,
      caption: 'Report stagnant water — photo, GPS pin, submit in three taps.',
      run: async () => {
        closeAllTourModals();
        await tourClick($('#btnCamera'));
        await sleep(1000);
        simulateReportPhoto();
        await moveTo($('#photoGuidelines'), 500);
        await sleep(1000);
        await tourScroll($('#reportModal'));
        await highlight($('#btnSubmitReport'), true);
        await sleep(1000);
      },
    },
    {
      audioId: '04-success',
      narrateMs: 28000,
      caption: 'Report logged — share on WhatsApp so neighbours see the ward pin.',
      run: async () => {
        closeAllTourModals();
        const thumb = $('#successThumbnail');
        if (thumb) {
          thumb.src = simulatePhotoDataUrl();
          thumb.hidden = false;
        }
        window.openSuccessModal?.();
        await sleep(800);
        await moveTo($('#btnShareWhatsApp'), 500);
        await sleep(1200);
        await tourScroll($('#successModal'));
      },
    },
    {
      audioId: '05-map-pin',
      narrateMs: 26000,
      caption: 'Red pins pending, green resolved — tap for hazard details and ward context.',
      run: async () => {
        window.closeSuccessModal?.();
        await sleep(500);
        closeAllTourModals();
        refreshMap();
        await sleep(1000);
        await moveTo($('#mapLegend'), 500);
        await sleep(800);
        await moveTo($('#map'), 600);
        await sleep(1200);
      },
    },
    {
      audioId: '06-corroborate',
      narrateMs: 26000,
      caption: '"Me too" backs a neighbour\'s pin — no duplicate reports.',
      run: async () => {
        closeAllTourModals();
        await openNeighborPopup();
      },
    },
    {
      audioId: '07-profile',
      narrateMs: 28000,
      caption: 'Profile — civic points, your reports, BMC filing status, days pending.',
      run: async () => {
        closeAllTourModals();
        await tourClick($('#btnProfile'));
        await sleep(2200);
        await tourScroll($('#profileModal'));
        await moveTo($('#profilePoints'), 500);
        await sleep(1000);
      },
    },
    {
      audioId: '08-escalation',
      narrateMs: 32000,
      caption: 'File with BMC — copy text, save complaint number, unlock escalation ladder.',
      run: async () => {
        window.closeProfileModal?.();
        await sleep(400);
        window.openEscalationModal?.('persona-escalation-report');
        await sleep(1000);
        await tourScroll($('#escalationModal'));
        await moveTo($('#btnEscWhatsApp'), 500);
        await sleep(800);
        await moveTo($('#escComplaintId'), 500);
        await sleep(800);
        await tourScroll($('#escLadder'));
      },
    },
    {
      audioId: '09-selfresolve',
      narrateMs: 24000,
      caption: 'BMC fixed it? Self-confirm resolution once you have a complaint number.',
      run: async () => {
        const wrap = $('#escSelfConfirm');
        if (wrap) wrap.classList.remove('hidden');
        await tourScroll(wrap);
        await highlight($('#btnEscResolveOwn'), true);
        await sleep(1500);
        await highlight($('#btnEscResolveOwn'), false);
      },
    },
    {
      audioId: '10-community',
      narrateMs: 28000,
      caption: 'Community — ward leaderboard, pledges, impact stats, ward challenge.',
      run: async () => {
        $('#btnEscClose')?.click();
        await sleep(500);
        await tourClick($('#bottomNav [data-tab="community"]') || $$('#bottomNav .nav-tab')[1]);
        await sleep(1800);
        await tourScroll($('.impact-stats'));
        await moveTo($('#wardChallenge'), 500);
        await sleep(800);
        await tourScroll($('#communityModal'));
      },
    },
    {
      audioId: '11-ngo-login',
      narrateMs: 24000,
      caption: 'NGO Coordinator — five taps on civic points, demo login lead/password.',
      run: async () => {
        window.closeCommunityModal?.();
        await sleep(400);
        await exitPersonas();
        await loginNgo();
        await sleep(600);
      },
    },
    {
      audioId: '12-ngo-hub',
      narrateMs: 30000,
      caption: 'Coordinator Hub — pledges, open hazards, log community cleanup.',
      run: async () => {
        window.openCoordinatorDashboard?.();
        await sleep(1000);
        await tourScroll($('#coordinatorModal'));
        await moveTo($('#coordCleared'), 500);
        await sleep(800);
        const cleanupBtn = $('[data-cleanup]');
        if (cleanupBtn) await highlight(cleanupBtn, true);
        await sleep(1200);
        await tourScroll($('#coordinatorPledgeList'));
      },
    },
    {
      audioId: '13-bmc-login',
      narrateMs: 26000,
      caption: 'BMC Admin — five taps on ward name, hazard queue for your ward.',
      run: async () => {
        window.closeCoordinatorDashboard?.();
        await sleep(400);
        await exitPersonas();
        await loginAdmin();
        await sleep(800);
      },
    },
    {
      audioId: '14-bmc-queue',
      narrateMs: 28000,
      caption: 'Hazard queue — filter, sort, Copy for 1916 with GPS and ward details.',
      run: async () => {
        window.openAdminQueue?.();
        await sleep(1000);
        await tourScroll($('#adminQueueModal'));
        const copyBtn = $('[data-copy-1916]');
        if (copyBtn) await highlight(copyBtn, true);
        await sleep(1200);
        await highlight(copyBtn, false);
      },
    },
    {
      audioId: '15-bmc-tools',
      narrateMs: 30000,
      caption: 'CSV export, app health panel, before/after proof on resolve.',
      run: async () => {
        const health = $('#adminHealthPanel');
        if (health) health.open = true;
        await sleep(600);
        await moveTo($('#btnAdminExportCsv'), 500);
        await sleep(800);
        await tourScroll($('#adminHealthStats'));
        const reviewBtn = $('[data-queue-open]');
        if (reviewBtn) await tourClick(reviewBtn);
        await sleep(1000);
        await injectAdminProof();
        await sleep(800);
        await tourScroll($('#adminProofCompare'));
      },
    },
    {
      audioId: '16-closing',
      narrateMs: 26000,
      caption: 'Three personas, one map — report, mobilise, resolve. Try it this monsoon.',
      run: async () => {
        window.closeAdminReportModal?.();
        window.closeCoordinatorDashboard?.();
        await exitPersonas();
        closeAllTourModals();
        await sleep(600);
        await tourClick($('#btnProfile'));
        await sleep(400);
        const aboutBtn = $('#btnAbout');
        if (aboutBtn) await tourClick(aboutBtn);
        await sleep(1500);
        await tourScroll($('#founderCard'));
        await sleep(800);
        $('#aboutOverlay .modal__close')?.click();
        await sleep(400);
        await moveTo($('#btnCamera'), 700);
        await sleep(1500);
      },
    },
  ];

  async function runTour() {
    if (tourRunning) return;
    tourRunning = true;
    window.demoTourRunning = true;
    createOverlay();
    document.body.classList.add('demo-tour-active');

    for (let i = 0; i < TOUR.length; i++) {
      setProgress(i, TOUR.length);
      setCaption(TOUR[i].caption);
      await step(TOUR[i], i);
      await sleep(CAPTURE_MODE ? 200 : 400);
    }

    setCaption('Walkthrough complete — explore freely.');
    setProgress(TOUR.length, TOUR.length);
    window.demoTourComplete = true;
    window.dispatchEvent(new CustomEvent('demotour-complete'));
    tourRunning = false;
  }

  window.startPersonaDemo = runTour;
  window.startDemoTour = runTour;
  window.pauseDemoTour = () => { tourPaused = !tourPaused; };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') window.pauseDemoTour();
  });

  waitForApp().then(() => {
    seedPersonaDemoData();
    if (params.get('autostart') === '1' || CAPTURE_MODE) {
      setTimeout(runTour, CAPTURE_MODE ? 2500 : 1800);
    }
  });
})();
