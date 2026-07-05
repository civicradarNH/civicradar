/**
 * CivicRadar choreographed product demo (?demo=tour&autostart=1)
 * Animated cursor overlay + on-screen captions for screen recording.
 */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('demo') !== 'tour') return;

  const VOICE_BASE = '/video/voiceover/';
  const VOICE_ENABLED = params.get('voice') !== '0';
  const CAPTURE_MODE = params.get('capture') === '1';

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

  function injectStyles() {
    const css = document.createElement('style');
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
        transition: outline 0.2s, box-shadow 0.2s;
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
    badge.textContent = window.t ? window.t('demo.badge') : 'Product demo';
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
    if (!el) return;
    el.classList.toggle('demo-highlight', on);
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

  function seedDemoReport() {
    const KEY = 'mosquiTrackReports';
    let reports = [];
    try { reports = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
    const uid = JSON.parse(localStorage.getItem('civicradar_user') || '{}').id;
    let pending = reports.find((r) => r.reporterId === uid && r.status === 'pending');
    if (!pending) {
      pending = {
        id: 'demo-tour-report',
        reporterId: uid,
        hazard: 'stagnant-water',
        notes: 'Stagnant water near the playground — mosquitoes breeding.',
        ward: 'G/N Ward — Dadar, Shivaji Park',
        reporter: 'Priya',
        lat: 19.017,
        lng: 72.847,
        status: 'pending',
        complaintId: 'BMC-2026-44192',
        filedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
        timestamp: new Date(Date.now() - 10 * 86400000).toISOString(),
        confirmations: 3,
      };
      reports.unshift(pending);
      localStorage.setItem(KEY, JSON.stringify(reports));
    } else if (!pending.complaintId) {
      pending.complaintId = 'BMC-2026-44192';
      pending.filedAt = new Date(Date.now() - 8 * 86400000).toISOString();
      localStorage.setItem(KEY, JSON.stringify(reports));
    }
    return pending.id;
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

  let currentAudio = null;

  function playChapterAudio(audioId) {
    if (!VOICE_ENABLED || !audioId) {
      return sleep(0);
    }
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

  const TOUR = [
    {
      audioId: '01-intro',
      narrateMs: 35000,
      caption: 'Every June, same story — stagnant water in your lane, mosquitoes, dengue. CivicRadar puts it on your ward map so neighbours can act.',
      run: async () => {
        closeAllTourModals();
        await sleep(800);
        await tourClick($('#btnRecenter'), { hold: 400 });
      },
    },
    {
      audioId: '02-map',
      narrateMs: 32000,
      caption: 'Red pins are open. Green means fixed. Your ward name stays up top.',
      run: async () => {
        await moveTo($('#headerContext'), 500);
        await sleep(1200);
        await moveTo($('#map'), 600);
        await sleep(1000);
      },
    },
    {
      audioId: '03-about',
      narrateMs: 33000,
      caption: 'Free for Mumbai residents — built for all 24 BMC wards. The CivicRadar team keeps it free for citizens.',
      run: async () => {
        await tourClick($('#btnProfile'));
        await sleep(400);
        const aboutBtn = $('#btnAbout');
        if (aboutBtn) await tourClick(aboutBtn);
        await sleep(1800);
        await tourScroll($('#aboutOverlay .modal'));
      },
    },
    {
      audioId: '04-community',
      narrateMs: 32000,
      caption: 'Community — ward leaderboard, Me too counts, volunteer signups, and supply pledges.',
      run: async () => {
        $('#aboutOverlay .modal__close')?.click();
        await sleep(500);
        await tourClick($('#bottomNav [data-tab="community"]') || $$('#bottomNav .nav-tab')[1]);
        await sleep(2000);
        await tourScroll($('.impact-stats'));
      },
    },
    {
      audioId: '05-profile',
      narrateMs: 30000,
      caption: 'Profile tracks every pin — filed with BMC or not, complaint number, and escalation steps.',
      run: async () => {
        await tourClick($('#bottomNav [data-tab="profile"]') || $$('#bottomNav .nav-tab')[2]);
        await sleep(2200);
      },
    },
    {
      audioId: '06-report',
      narrateMs: 35000,
      caption: 'Three taps: photo, details, submit. Stagnant water first — the monsoon wedge that matters most.',
      run: async () => {
        window.closeProfileModal?.();
        await sleep(400);
        await tourClick($('#btnCamera'));
        await sleep(1200);
        simulateReportPhoto();
        await moveTo($('#photoGuidelines'), 500);
        await sleep(1500);
        await tourScroll($('#reportModal'));
      },
    },
    {
      audioId: '07-escalation',
      narrateMs: 38000,
      caption: 'A map pin is not a BMC complaint. File separately on 1916 or MyBMC when you want the official clock.',
      run: async () => {
        window.closeReportModal?.();
        await sleep(600);
        const reportId = seedDemoReport();
        window.openEscalationModal(reportId);
        await sleep(1200);
        await tourScroll($('#escalationModal'));
        await moveTo($('#btnEscCall'), 500);
        await sleep(800);
        await moveTo($('#btnEscWhatsApp'), 500);
        await sleep(800);
      },
    },
    {
      audioId: '08-participate',
      narrateMs: 35000,
      caption: 'Save your complaint number here. Participate Mumbai is for volunteering and ward projects — not pest-control filing.',
      run: async () => {
        await tourScroll($('#btnEscParticipate'));
        await highlight($('#btnEscParticipate'), true);
        await sleep(1800);
        await highlight($('#btnEscParticipate'), false);
        await moveTo($('#escComplaintId'), 500);
        await sleep(1200);
      },
    },
    {
      audioId: '09-languages',
      narrateMs: 30000,
      caption: 'Four languages — English, Hindi, Marathi, Gujarati. Because Mumbai isn\'t one language.',
      run: async () => {
        $('#btnEscClose')?.click();
        await sleep(600);
        await tourClick($('#btnLang'));
        await sleep(1800);
        await tourClick($('[data-lang="hi"]'));
        await sleep(1200);
        await tourClick($('#btnLang'));
        await sleep(600);
        await tourClick($('[data-lang="en"]'));
        await sleep(800);
      },
    },
    {
      audioId: '10-bmc',
      narrateMs: 33000,
      caption: 'BMC officials get a hazard queue — filter by ward, sort by overdue, resolve with a double-tap so nothing gets cleared by accident.',
      run: async () => {
        $('#langOverlay')?.classList.remove('open');
        await sleep(400);
        await tourClick($('#btnProfile'));
        await sleep(500);
        let taps = 0;
        const ward = $('#profileGreeting');
        for (let i = 0; i < 5; i++) {
          ward?.click();
          taps++;
          await sleep(350);
        }
        await sleep(600);
        $('#adminUser').value = 'admin';
        $('#adminPass').value = 'password';
        await tourClick($('#btnAdminSubmit'));
        await sleep(2000);
        await tourScroll($('#adminQueueOverlay'));
      },
    },
    {
      audioId: '11-ngo',
      narrateMs: 33000,
      caption: 'Ward coordinators see volunteers and cleanup offers. Neighbourhood leads cover your RWA or society lane.',
      run: async () => {
        $('#personaBarAction')?.click();
        await sleep(800);
        await tourClick($('#btnProfile'));
        await sleep(400);
        for (let i = 0; i < 5; i++) {
          $('#profilePoints')?.click();
          await sleep(350);
        }
        $('#leadUser').value = 'lead';
        $('#leadPass').value = 'password';
        await tourClick($('#btnLeadSubmit'));
        await sleep(2200);
        await tourScroll($('#coordinatorOverlay'));
      },
    },
    {
      audioId: '12-closing',
      narrateMs: 28000,
      caption: 'That\'s CivicRadar — report, share, file, track, say Me too. Pick your ward and try it this monsoon.',
      run: async () => {
        $('#personaBarAction')?.click();
        await sleep(800);
        closeAllTourModals();
        await sleep(600);
        await moveTo($('#btnCamera'), 700);
        await sleep(2000);
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

    setCaption('Demo complete — explore your ward map.');
    setProgress(TOUR.length, TOUR.length);
    window.demoTourComplete = true;
    window.dispatchEvent(new CustomEvent('demotour-complete'));
    tourRunning = false;
  }

  window.startDemoTour = runTour;
  window.pauseDemoTour = () => { tourPaused = !tourPaused; };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') pauseDemoTour();
  });

  waitForApp().then(() => {
    if (params.get('autostart') === '1' || CAPTURE_MODE) {
      setTimeout(runTour, CAPTURE_MODE ? 2500 : 1800);
    } else {
      setCaption('Press T or call startDemoTour() to begin');
      document.addEventListener('keydown', (e) => {
        if (e.key === 't' || e.key === 'T') runTour();
      }, { once: true });
    }
  });
})();
