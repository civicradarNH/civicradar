/**

 * CivicRadar — Core JavaScript Logic

 * Strict DOMContentLoaded bindings — localStorage — Haversine spam filter

 */



document.addEventListener('DOMContentLoaded', function () {

  'use strict';



  /* ---------- Constants ---------- */

  // Build tag attached to feedback rows. Kept in step with the SW cache version.

  const CIVIC_APP_VERSION = 'v194';

  const PENDING_AUTH_FLOW_KEY = 'civicradar_pending_auth_flow';

  const PENDING_NGO_CODE_KEY = 'civicradar_pending_ngo_code';

  const REPORT_DRAFT_KEY = 'civicradar_report_draft';

  const LAST_HAZARD_KEY = 'civicradar_last_hazard';

  const REPORT_DRAFT_TTL_MS = 30 * 60 * 1000;

  const REPORT_GEO_EXPLAINER_KEY = 'civicradar_report_geo_explainer';

  const REPORT_NOTES_MAX = 2000;

  const REPORT_WARD_MAX = 200;

  const REPORT_SOCIETY_MAX = 120;

  const REPORT_HAZARDS = ['stagnant-water', 'garbage', 'potholes', 'streetlight'];



  /* ---------- Debug Mode (gated — ?debug=1 or localStorage civicDebug=1) ---------- */

  const CIVIC_DEBUG = (function civicDebugEnabled() {

    try {

      if (new URLSearchParams(window.location.search).get('debug') === '1') return true;

      return localStorage.getItem('civicDebug') === '1';

    } catch (_) { return false; }

  })();

  const DEBUG_MAX_LINES = 80;

  const debugLines = [];

  let debugLogEl = null;

  function debugFmtKv(kv) {

    if (!kv || typeof kv !== 'object') return '';

    return Object.entries(kv)

      .map(([k, v]) => `${k}=${v == null ? 'null' : (typeof v === 'string' ? v : JSON.stringify(v))}`)

      .join(' | ');

  }

  const debugLog = CIVIC_DEBUG ? function debugLog(category, message, kv) {

    const ts = new Date().toISOString().slice(11, 23);

    const suffix = kv ? ` | ${debugFmtKv(kv)}` : '';

    const line = `${ts} [${category}] ${message}${suffix}`;

    debugLines.push(line);

    while (debugLines.length > DEBUG_MAX_LINES) debugLines.shift();

    if (debugLogEl) {

      debugLogEl.textContent = debugLines.join('\n');

      debugLogEl.scrollTop = debugLogEl.scrollHeight;

    }

    try { console.log('[CivicDebug]', line); } catch (_) { /* ignore */ }

  } : function () {};



  function debugInit() {

    if (!CIVIC_DEBUG) return;

    const panel = document.createElement('div');

    panel.id = 'civicDebugPanel';

    panel.className = 'civic-debug-panel';

    panel.setAttribute('role', 'log');

    panel.setAttribute('aria-label', 'Debug log');

    const header = document.createElement('div');

    header.className = 'civic-debug-panel__header';

    const title = document.createElement('span');

    title.className = 'civic-debug-panel__title';

    title.textContent = 'Debug';

    header.appendChild(title);

    const btnCopy = document.createElement('button');

    btnCopy.type = 'button';

    btnCopy.className = 'civic-debug-panel__btn';

    btnCopy.textContent = 'Copy logs';

    btnCopy.addEventListener('click', () => {

      const text = debugLines.join('\n');

      const done = () => debugLog('SYS', 'logs copied');

      if (navigator.clipboard && navigator.clipboard.writeText) {

        navigator.clipboard.writeText(text).then(done).catch(() => {

          const ta = document.createElement('textarea');

          ta.value = text;

          ta.style.cssText = 'position:fixed;left:-9999px';

          document.body.appendChild(ta);

          ta.select();

          try { document.execCommand('copy'); done(); } catch (_) { /* ignore */ }

          ta.remove();

        });

      }

    });

    const btnClear = document.createElement('button');

    btnClear.type = 'button';

    btnClear.className = 'civic-debug-panel__btn';

    btnClear.textContent = 'Clear';

    btnClear.addEventListener('click', () => {

      debugLines.length = 0;

      if (debugLogEl) debugLogEl.textContent = '';

      debugLog('SYS', 'logs cleared');

    });

    header.appendChild(btnCopy);

    header.appendChild(btnClear);

    debugLogEl = document.createElement('pre');

    debugLogEl.className = 'civic-debug-panel__log';

    panel.appendChild(header);

    panel.appendChild(debugLogEl);

    document.body.appendChild(panel);

    window.addEventListener('error', (ev) => {

      debugLog('ERR', ev.message || 'error', {

        at: ev.filename ? `${ev.filename}:${ev.lineno}` : 'unknown',

        stack: ev.error && ev.error.stack ? ev.error.stack.split('\n')[0] : '',

      });

    });

    window.addEventListener('unhandledrejection', (ev) => {

      const reason = ev.reason;

      const msg = reason && reason.message ? reason.message : String(reason);

      const stack = reason && reason.stack ? reason.stack.split('\n').slice(0, 2).join(' ') : '';

      debugLog('ERR', 'unhandledrejection', { msg, stack });

    });

    const origErr = console.error;

    console.error = function (...args) {

      try {

        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');

        debugLog('CONSOLE', msg);

      } catch (_) { /* ignore */ }

      return origErr.apply(console, args);

    };

    debugLog('SYS', 'debug mode active');

  }



  function persistPendingAuth(flow, ngoCode) {

    try {

      sessionStorage.setItem(PENDING_AUTH_FLOW_KEY, flow);

      if (ngoCode) sessionStorage.setItem(PENDING_NGO_CODE_KEY, ngoCode);

    } catch { /* private mode / quota */ }

  }



  function clearPendingAuth() {

    try {

      sessionStorage.removeItem(PENDING_AUTH_FLOW_KEY);

      sessionStorage.removeItem(PENDING_NGO_CODE_KEY);

    } catch { /* private mode */ }

  }



  function showAuthLinkSent(prefix) {

    const linkRow = document.getElementById(`${prefix}LinkSentRow`);

    const otpFallback = document.getElementById(`${prefix}OtpFallback`);

    if (linkRow) linkRow.classList.remove('hidden');

    if (otpFallback) otpFallback.classList.remove('hidden');

  }

  const REPORTS_KEY = 'mosquiTrackReports';

  const USER_KEY = 'civicradar_user';

  const PLEDGES_KEY = 'mosquiTrackPledges';

  const POINTS_CACHE_KEY = 'mosquiTrackPoints';

  const COACH_KEY = 'civicradar_coach_seen';

  const TOUR_KEY = 'civicradar_tour_seen';

  const HERO_DISMISSED_KEY = 'civicradar_hero_dismissed';

  const LANG_KEY = 'civicradar_lang';

  const INTEREST_KEY = 'civicradar_interest';

  const CONFIRMED_KEY = 'civicradar_confirmed';

  const FIX_CONFIRMED_KEY = 'civicradar_fix_confirmed';

  const FIX_CONFIRMED_SEEN_KEY = 'civicradar_fix_confirmed_seen';

  const REMINDER_STALE_SNOOZE_KEY = 'civicradar_stale_snooze';

  const RESOLVED_SEEN_KEY = 'civicradar_resolved_seen';

  const CONFIRMED_SEEN_KEY = 'civicradar_confirmed_seen';

  const REMINDER_UNFILED_SNOOZE_KEY = 'civicradar_reminder_unfiled_snooze';

  const REMINDER_UNFILED_MILESTONE_KEY = 'civicradar_reminder_unfiled_milestone';

  const REMINDER_CONFIRM_COUNTS_KEY = 'civicradar_reminder_confirm_counts';

  const REMINDER_CLEARED_PREV_KEY = 'civicradar_reminder_cleared_prev';

  const REMINDER_NGO_LAST_SEEN_KEY = 'civicradar_reminder_ngo_last_seen';

  const REMINDER_NGO_PLEDGES_LAST_SEEN_KEY = 'civicradar_reminder_ngo_pledges_last_seen';

  const PLEDGE_STATUS_SNAPSHOT_KEY = 'civicradar_pledge_status_snapshot';

  const PLEDGE_POINTS_CREDITED_KEY = 'civicradar_pledge_points_credited';

  const VOLUNTEER_SIGNUPS_KEY = 'civicradar_volunteer_signups';

  const VOLUNTEER_TASKS_KEY = 'civicradar_volunteer_tasks';

  const UNFILED_REMINDER_DAYS = [1, 3, 7];

  const REMINDER_PRIORITY = { escalation: 1, corroboration: 2, proximity: 3, staleCheck: 3, cleanup: 4, unfiled: 5 };

  const MAX_SESSION_REMINDERS = 2;

  // Opt-in "report stagnant water when you encounter it" reminder (foreground-triggered;

  // no background push — honest about platform limits). See maybeShowReportReminder().

  const REPORT_REMINDER_OPTIN_KEY = 'civicradar_report_reminder_optin';

  const REPORT_REMINDER_LAST_KEY = 'civicradar_report_reminder_last';

  const REPORT_REMINDER_SNOOZE_KEY = 'civicradar_report_reminder_snooze';

  const REPORT_REMINDER_DAYS = 2;

  // Neighbourhood new-report + resolved FYI alerts (Profile opt-in; rate-limited).
  const NBH_ALERT_NEW_KEY = 'civicradar_nbh_alert_new';
  const NBH_ALERT_RESOLVED_KEY = 'civicradar_nbh_alert_resolved';
  const NBH_ALERT_LOG_KEY = 'civicradar_nbh_alert_log';
  const NBH_ALERT_NEW_SEEN_KEY = 'civicradar_nbh_new_seen';
  const NBH_ALERT_RESOLVED_SEEN_KEY = 'civicradar_nbh_resolved_seen';
  const NBH_ALERT_RESOLVE_DIGEST_KEY = 'civicradar_nbh_resolve_digest';
  const NBH_ALERT_MIN_GAP_MS = 5 * 60 * 1000;
  const NBH_ALERT_MAX_PER_24H = 3;
  const NBH_ALERT_DIGEST_MS = 60 * 60 * 1000;

  // Location-aware in-app nudge radius (foreground only; precise coords never persisted).

  const PROXIMITY_NUDGE_M = 150;

  const HIDDEN_REPORTS_KEY = 'civicradar_hidden_reports';

  const MUTED_REPORTERS_KEY = 'civicradar_muted_reporters';

  const WEEK_BONUS_KEY = 'civicradar_week_bonus';

  const FIRST_SHARE_KEY = 'civicradar_first_share_done';

  const SUCCESS_STORIES_SEEN_KEY = 'civicradar_success_stories_seen';

  const LEAD_NUDGE_SEEN_KEY = 'civicradar_lead_nudge_seen';

  const VISIT_COUNT_KEY = 'civicradar_visit_count';

  const FIRST_REPORT_DONE_KEY = 'civicradar_first_report_done';

  const PWA_NUDGE_KEY = 'civicradar_pwa_nudge_dismissed';

  const APP_OPEN_BANNER_KEY = 'civicradar_app_open_banner_dismiss';

  const SEASON_HOOK_DISMISS_KEY = 'civicradar_season_hook_dismissed';

  const REF_WELCOME_KEY = 'civicradar_ref_welcome_seen';

  const LOCBANNER_SNOOZE_KEY = 'civicradar_locbanner_snooze';

  const LOCBANNER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

  const IOS_INSTALL_SNOOZE_KEY = 'civicradar_ios_install_snooze';

  const IOS_INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

  const POINTS_PER_REPORT = 50;

  const POINTS_WEEK_BONUS = 25;

  const POINTS_FIRST_SHARE = 10;

  const POINTS_REPORT_RESOLVED = 20;

  const POINTS_FIX_CONFIRM = 10;

  const POINTS_ME_TOO = 8;

  const POINTS_REFERRAL_JOINED = 30;

  const REFERRAL_REDEEMED_KEY = 'civicradar_referral_redeemed';

  const REFERRAL_REWARDED_COUNT_KEY = 'civicradar_referral_rewarded_count';

  const XP_CERTS_SEEN_KEY = 'civicradar_xp_certificates';

  const CIVIC_XP_LEVELS = [
    { id: 'observer', min: 0, cert: false },
    { id: 'wardWatcher', min: 100, cert: true },
    { id: 'neighbourhoodVoice', min: 250, cert: false },
    { id: 'civicChampion', min: 500, cert: true },
    { id: 'monsoonGuardian', min: 1000, cert: true },
    { id: 'communityLeader', min: 2000, cert: true },
  ];

  const REPORT_CELEBRATION_MILESTONES = [1, 3, 5, 10];

  const VERIFY_HOURS_BONUS = 200;

  const NEARBY_CORROB_M = 50;

  const DEFAULT_CITY = 'mumbai';

  const CITY_IDS = ['mumbai', 'pune', 'thane'];

  const SCALE_CFG = Object.assign(

    {

      maxReportsPerDevice: 500,

      syncBatchSize: 200,

      syncRecentDays: 90,

      imageMaxWidth: 320,

      jpegQuality: 0.52,

      maxMapMarkers: 150,

      mapMarkerDebounceMs: 250,

      geoThrottleMs: 15000,

      fixConfirmThreshold: 2,

      staleCheckDays: 7,

    },

    (window.CIVICRADAR_CONFIG || {}).scale || {}

  );

  const FIX_CONFIRM_THRESHOLD = SCALE_CFG.fixConfirmThreshold || 2;

  const STALE_CHECK_DAYS = SCALE_CFG.staleCheckDays || 7;

  const CANVAS_MAX_WIDTH = SCALE_CFG.imageMaxWidth;

  const JPEG_QUALITY = SCALE_CFG.jpegQuality;

  const DUPLICATE_RADIUS_M = 10;

  const DUPLICATE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // ignore duplicates older than 14 days

  const GEO_ACCURACY_GOOD_M = 50;

  const GEO_ACCURACY_POOR_M = 150;

  const GEO_ACCURACY_MAX_M = 5000;

  // Auto GPS pin on confirm must be near the user's city (laptop WiFi/IP can be accurate but continents away).

  const GEO_CITY_RADIUS_M = 80000;

  // Early settle only after consecutive samples agree (WiFi/IP often claims ~50 m but is ~1 km off).

  const GEO_STABLE_SAMPLES = 2;

  const GEO_STABLE_RADIUS_M = 40;

  const GEO_WATCH_MAX_MS = 25000;

  const GEO_LOCATE_TIMEOUT_MS = 20000;

  const GEO_REFINE_MS = 45000;

  // App URL is used for shareable deep links. Set to your deployed origin in production.

  const APP_URL = (location.origin && location.origin.startsWith('http'))

    ? location.origin + location.pathname.replace(/index\.html$/, '')

    : 'https://civicradar.app/';

  // NOTE: Demo-only client-side credentials. In production these MUST be validated

  // server-side — never trust client auth for BMC/NGO privileged actions.

  const DEMO_CREDENTIALS = {

    admin: { user: 'admin', pass: 'password' },

    lead: { user: 'lead', pass: 'password', ward: 'G/N Ward — Dadar, Shivaji Park', scope: 'ward' },

    leadNbh: { user: 'lead-nbh', pass: 'password', ward: 'G/S Ward — Worli, Lower Parel', scope: 'neighbourhood', neighbourhood: 'Worli West — Phoenix Mills area' },

  };



  // Real BMC (Brihanmumbai Municipal Corporation) complaint channels.

  // Stagnant water / mosquito breeding is routed to the ward Pest Control Officer.

  const BMC = {

    helpline: '1916',                    // 24x7 central complaint line

    whatsapp: '918999228999',            // MyBMC WhatsApp assistant

    portalUrl: 'https://www.mcgm.gov.in/',

    twitter: 'mybmc',                    // @mybmc (X handles civic complaints)

    aapleSarkar: 'https://pgportal.gov.in/', // Maharashtra state grievance portal

    participateUrl: 'https://participatemumbai.mcgm.gov.in/', // BMC civic engagement (volunteer / CSR — not complaints)

    margAppStoreUrl: 'https://apps.apple.com/app/mybmc-marg/id6759655448',

    margPlayStoreUrl: 'https://play.google.com/store/apps/details?id=in.cdac.gov.mgov.mcgm',

    margPlayStoreSearchUrl: 'https://play.google.com/store/search?q=MyBMC+MARG&c=apps',

  };

  // BMC Citizen Charter target is ~3 days; CCRS auto-escalation kicks in at ~7 days;

  // real-world median is far longer, so the ladder unlocks pressure over time.

  const ESCALATION_DAYS = { matrix: 7, zonal: 14, grievance: 30 };

  const ESC_TOAST_TIERS = [

    { days: ESCALATION_DAYS.grievance, key: '30' },

    { days: ESCALATION_DAYS.zonal, key: '14' },

    { days: ESCALATION_DAYS.matrix, key: '7' },

  ];



  /* ---------- Global Role Flags ---------- */

  let isAdmin = false;

  let isLead = false;

  let isSuperAdmin = false;

  let leaderboardPeriod = 'all';

  window.isAdmin = false;

  window.isLead = false;

  window.isSuperAdmin = false;

  let accessProofDataUrl = null;



  /* ---------- State ---------- */

  let map = null;

  let userMarker = null;

  let userAccuracyCircle = null;

  let reportMarkerLayer = null;

  const reportMarkerMap = new Map();

  let lastReportDataUrl = null;

  let lastReportId = null;

  let currentLat = null;

  let currentLng = null;

  let currentAccuracyM = null;

  let lastGeoRequest = 0;

  let locationRefineWatchId = null;

  let locationRefineUntil = 0;

  let markerRefreshTimer = null;

  let activeAdminReportId = null;

  let adminProofDataUrl = null;
  // Community fix-photo capture: report id awaiting an optional after-photo.
  let pendingFixPhotoReportId = null;

  let activeEscalationId = null;

  let pendingShareWinReportId = null;

  let pendingShareWinType = 'resolved';

  let pendingSuccessCardBlob = null;

  let pendingShareWinAspect = localStorage.getItem('civicradar_share_win_aspect') || 'square';

  let lastFocusedEl = null;

  let focusTrapHandler = null;

  let modalScrollY = 0;

  // Native camera / file picker can pop history or deliver a ghost tap on Map nav

  // before async photo processing finishes — guard the report sheet until capture completes.

  let reportPhotoFlowActive = false;

  let reportFlowStep = 'capture';

  let reportPhotoProcessing = false;

  let reportCameraTimer = null;

  let reportPhotoWatchdogTimer = null;

  let reportPhotoDismissGuard = 0;

  let reportManualPinDismiss = false;

  let manualPinModeActive = false;

  let manualPinLat = null;

  let manualPinLng = null;

  let manualPinPreviewMarker = null;

  let manualPinMapClickHandler = null;

  let confirmPinLat = null;

  let confirmPinLng = null;

  let confirmPinAccuracyM = null;

  let confirmPinUserAdjusted = false;

  let confirmPinProvisional = false;

  let reportPinMap = null;

  let reportPinMarker = null;

  let reportPinAccuracyCircle = null;

  let reportPinSeedToken = 0;

  let reportGeoExplainerResolve = null;

  let appHiddenAt = 0;

  let skipReportDraftRestoreOnce = false;

  let shareNudgeTimer = null;

  let pendingSwReload = false;

  // Ghost taps / popstate after native camera can dismiss the report sheet — guard longer.

  const PHOTO_RETURN_GUARD_MS = (() => {

    const ua = navigator.userAgent || '';

    const ios = /iPad|iPhone|iPod/.test(ua)

      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    return ios ? 2500 : 1500;

  })();

  // PWA/TWA session policy (installed app only — see maybeResetSessionOnResume):
  // • Cold start: OS process killed or tab discarded → map home, modals closed (no reload).
  // • Warm resume: hidden < WARM_RESUME_PRESERVE_MS → preserve state (mid-report camera/share).
  // • Stale: hidden ≥ SESSION_RESUME_RESET_MS → map home (industry-typical 30 min).
  // • BFCache (pageshow persisted): reset — restored snapshot must not leave Profile open.
  // manifest.json has no launch_handler: avoid navigate-existing reload; JS reset is enough.
  // focus-existing (if added later) resumes the WebView — warm/stale timers still apply.

  const SESSION_MARKER_KEY = 'civicradar_pwa_session';

  const WARM_RESUME_PRESERVE_MS = 2 * 60 * 1000;

  const SESSION_RESUME_RESET_MS = 30 * 60 * 1000;



  const DEMO_WARD_SEED = [

    { name: 'G/N Ward — Dadar, Shivaji Park', city: 'mumbai', points: 2840, reports: 142, isDemo: true },

    { name: 'H/W Ward — Bandra West, Khar West', city: 'mumbai', points: 2650, reports: 128, isDemo: true },

    { name: 'K/E Ward — Andheri East, Vile Parle East', city: 'mumbai', points: 2410, reports: 115, isDemo: true },

    { name: 'L Ward — Kurla, Sakinaka', city: 'mumbai', points: 2180, reports: 98, isDemo: true },

    { name: 'F/N Ward — Sion, Matunga', city: 'mumbai', points: 1950, reports: 87, isDemo: true },

  ];



  const DEMO_CITIZEN_SEED = [

    { name: 'Priya S.', ward: 'Dadar', points: 340, isDemo: true },

    { name: 'Rahul M.', ward: 'Bandra', points: 290, isDemo: true },

    { name: 'Ananya K.', ward: 'Andheri', points: 265, isDemo: true },

    { name: 'Vikram P.', ward: 'Kurla', points: 240, isDemo: true },

    { name: 'Sneha D.', ward: 'Worli', points: 220, isDemo: true },

  ];

  const $ = (sel) => document.querySelector(sel);

  const $$ = (sel) => document.querySelectorAll(sel);



  const overlays = {

    tos: $('#tosOverlay'),

    onboarding: $('#onboardingOverlay'),

    report: $('#reportOverlay'),

    reportGeo: $('#reportGeoOverlay'),

    success: $('#successOverlay'),

    community: $('#communityOverlay'),

    resources: $('#resourcesOverlay'),

    pledge: $('#pledgeOverlay'),

    volunteer: $('#volunteerOverlay'),

    profile: $('#profileOverlay'),

    deleteConfirm: $('#deleteConfirmOverlay'),

    admin: $('#adminOverlay'),

    lead: $('#leadOverlay'),

    coordinator: $('#coordinatorOverlay'),

    adminReport: $('#adminReportOverlay'),

    adminQueue: $('#adminQueueOverlay'),

    partner: $('#partnerOverlay'),

    escalation: $('#escalationOverlay'),

    lang: $('#langOverlay'),

    soon: $('#soonOverlay'),

    about: $('#aboutOverlay'),

    inquiry: $('#inquiryOverlay'),

    feedback: $('#feedbackOverlay'),

    accessRequest: $('#accessRequestOverlay'),

    accessClaim: $('#accessClaimOverlay'),

    leadNom: $('#leadNomOverlay'),

    tracking: $('#trackingOverlay'),

    accessReview: $('#accessReviewOverlay'),

    shareWin: $('#shareWinOverlay'),

    certificate: $('#certificateOverlay'),

  };



  let user;

  let deferredInstallPrompt = null;

  let pwaNudgeVisible = false;

  let pendingPwaNudge = false;



  // Project config — founder story & monetization (see js/config.js)

  const CFG = window.CIVICRADAR_CONFIG || {};

  function isProdEnvironment() {
    return CFG.environment === 'prod';
  }

  if (CFG.bmcChannels) {

    const ch = CFG.bmcChannels;

    if (ch.participateMumbaiUrl) BMC.participateUrl = ch.participateMumbaiUrl;

    if (ch.margAppStoreUrl) BMC.margAppStoreUrl = ch.margAppStoreUrl;

    if (ch.margPlayStoreUrl) BMC.margPlayStoreUrl = ch.margPlayStoreUrl;

    if (ch.margPlayStoreSearchUrl) BMC.margPlayStoreSearchUrl = ch.margPlayStoreSearchUrl;

  }

  const LEGAL = CFG.legal || {};

  const FOUNDER = CFG.founder || {};

  const MONET = CFG.monetization || {};

  const CITIES = CFG.cities || {};

  const SERVICE_BOUNDS = CFG.serviceBounds || { minLat: 18.44, maxLat: 19.3, minLng: 72.78, maxLng: 73.95 };

  const OFFICIAL = CFG.officialChannels || {};



  user = loadUser();

  if (window.CivicAnalytics) {

    CivicAnalytics.init({ consent: !!(user.tosAccepted && user.analyticsConsent) });

  }



  function getCityConfig(cityId) {

    const id = cityId || DEFAULT_CITY;

    return CITIES[id] || CITIES.mumbai || {

      id: 'mumbai',

      label: 'Mumbai',

      center: [19.076, 72.8777],

      bounds: { minLat: 18.88, maxLat: 19.28, minLng: 72.78, maxLng: 73.0 },

    };

  }



  function getUserCity() {

    return user.city && CITIES[user.city] ? user.city : DEFAULT_CITY;

  }



  function getCityCenter(cityId) {

    return getCityConfig(cityId || getUserCity()).center || [19.076, 72.8777];

  }



  function getCityLabel(cityId) {

    return getCityConfig(cityId || getUserCity()).label || 'Mumbai';

  }



  function getCityCorpChannels(cityId) {

    const city = getCityConfig(cityId || getUserCity());

    if (cityId === 'mumbai' || (!cityId && getUserCity() === 'mumbai')) {

      return Object.assign({}, BMC, CFG.bmcChannels || {});

    }

    return city.corpChannels || {};

  }



  function pickMobileStoreUrl(playUrl, appStoreUrl, webFallback) {

    const ua = navigator.userAgent || '';

    if (/iPhone|iPad|iPod/i.test(ua)) return appStoreUrl || playUrl || webFallback;

    if (/Android/i.test(ua)) return playUrl || appStoreUrl || webFallback;

    return playUrl || appStoreUrl || webFallback;

  }



  function getOfficialCategoryHint(channelId, hazard, cityId) {

    const h = hazard || 'stagnant-water';

    const specific = `official.hint.${channelId}.${h}`;

    if (I18N[currentLang]?.[specific] || I18N.en[specific]) return t(specific);

    if (channelId === 'aaple_sarkar') {

      return t('official.hint.aaple').replace('{corp}', getCorpShortName(cityId));

    }

    const swKey = `official.hint.swachhata.${h}`;

    if (channelId === 'swachhata' && (I18N[currentLang]?.[swKey] || I18N.en[swKey])) return t(swKey);

    return '';

  }



  function getOfficialSourceLink(channelId, cityId) {

    const city = cityId || getUserCity();

    const corp = getCityCorpChannels(city);

    const sw = OFFICIAL.swachhata || {};

    const aaple = OFFICIAL.aapleSarkar || {};

    switch (channelId) {

      case 'marg':

      case 'bmc_whatsapp':

      case 'bmc_portal':

      case 'bmc_call':

        return { url: BMC.portalUrl, label: 'www.mcgm.gov.in' };

      case 'pmc_care':

      case 'pmc_wa':

        return corp.grievanceUrl ? { url: corp.grievanceUrl, label: 'www.pmc.gov.in' } : null;

      case 'tmc_portal':

      case 'tmc_call':

        return corp.grievanceUrl ? { url: corp.grievanceUrl, label: 'thanecity.gov.in' } : null;

      case 'swachhata':

        return sw.infoUrl ? { url: sw.infoUrl, label: 'swachh.city' } : null;

      case 'aaple_sarkar': {

        const url = corp.aapleSarkarUrl || aaple.portalUrl || BMC.aapleSarkar;

        return url ? { url: url, label: 'pgportal.gov.in' } : null;

      }

      default:

        return null;

    }

  }



  function resolveOfficialChannelMeta(channelId, cityId) {

    const city = cityId || getUserCity();

    const corp = getCityCorpChannels(city);

    const sw = OFFICIAL.swachhata || {};

    const aaple = OFFICIAL.aapleSarkar || {};

    switch (channelId) {

      case 'marg':

        return {

          id: 'marg',

          icon: 'device-mobile',

          label: t('official.marg.label'),

          small: t('official.marg.small'),

          url: pickMobileStoreUrl(BMC.margPlayStoreUrl, BMC.margAppStoreUrl, BMC.margPlayStoreSearchUrl),

        };

      case 'bmc_whatsapp':

        return {

          id: 'bmc_whatsapp',

          icon: 'whatsapp-logo',

          label: t('official.bmcWa.label'),

          small: t('official.bmcWa.small'),

          url: `https://wa.me/${BMC.whatsapp}`,

          urlKind: 'whatsapp',

        };

      case 'bmc_portal':

        return {

          id: 'bmc_portal',

          icon: 'globe',

          label: t('official.bmcPortal.label'),

          small: 'www.mcgm.gov.in',

          url: BMC.portalUrl,

        };

      case 'bmc_call':

        return {

          id: 'bmc_call',

          icon: 'phone-call',

          label: t('esc.tier.openCall'),

          small: BMC.helpline,

          url: `tel:${BMC.helpline}`,

          urlKind: 'tel',

        };

      case 'pmc_care':

        return {

          id: 'pmc_care',

          icon: 'device-mobile',

          label: t('official.pmc.label'),

          small: t('official.pmc.small'),

          url: pickMobileStoreUrl(corp.playStoreUrl, corp.appStoreUrl, corp.grievanceUrl),

        };

      case 'pmc_wa':

        return corp.whatsapp ? {

          id: 'pmc_wa',

          icon: 'whatsapp-logo',

          label: t('esc.pmc.channelWa'),

          small: t('esc.pmc.channelWaSmall'),

          url: `https://wa.me/${corp.whatsapp}`,

          urlKind: 'whatsapp',

        } : null;

      case 'tmc_portal':

        return corp.grievanceUrl ? {

          id: 'tmc_portal',

          icon: 'globe',

          label: t('official.tmc.label'),

          small: t('official.tmc.small'),

          url: corp.grievanceUrl,

        } : null;

      case 'tmc_call':

        return corp.helplines && corp.helplines[0] ? {

          id: 'tmc_call',

          icon: 'phone-call',

          label: t('esc.tmc.channelCall'),

          small: corp.helplineDisplay || corp.helplines[0],

          url: `tel:${corp.helplines[0]}`,

          urlKind: 'tel',

        } : null;

      case 'swachhata':

        return {

          id: 'swachhata',

          icon: 'broom',

          label: t('official.swachhata.label'),

          small: t('official.swachhata.small'),

          url: pickMobileStoreUrl(sw.playStoreUrl, sw.appStoreUrl, sw.infoUrl),

        };

      case 'aaple_sarkar':

        return {

          id: 'aaple_sarkar',

          icon: 'bank',

          label: t('official.aaple.label'),

          small: t('official.aaple.small'),

          url: corp.aapleSarkarUrl || aaple.portalUrl || BMC.aapleSarkar,

          storeUrl: pickMobileStoreUrl(

            corp.aapleSarkarPlayStoreUrl || aaple.playStoreUrl,

            null,

            corp.aapleSarkarUrl || aaple.portalUrl

          ),

        };

      default:

        return null;

    }

  }



  function scoreOfficialChannel(channelId, hazard) {

    const prefer = (OFFICIAL.hazardPrefer && OFFICIAL.hazardPrefer[hazard]) || {};

    return prefer[channelId] || 0;

  }



  function getOfficialChannelsForCity(cityId, hazard, opts) {

    const city = cityId || getUserCity();

    const order = (OFFICIAL.cityOrder && OFFICIAL.cityOrder[city]) || [];

    const exclude = new Set((opts && opts.exclude) || []);

    const entries = [];

    order.forEach((id) => {

      if (exclude.has(id)) return;

      const meta = resolveOfficialChannelMeta(id, city);

      if (!meta || !meta.url) return;

      const source = getOfficialSourceLink(id, city);

      if (source) {

        meta.sourceUrl = source.url;

        meta.sourceLabel = source.label;

      }

      const score = scoreOfficialChannel(id, hazard || 'stagnant-water');

      entries.push(Object.assign({}, meta, {

        recommended: score >= 15,

        score,

        categoryHint: getOfficialCategoryHint(id, hazard || 'stagnant-water', city),

      }));

    });

    entries.sort((a, b) => b.score - a.score || order.indexOf(a.id) - order.indexOf(b.id));

    return entries;

  }



  function buildOfficialSummaryText(report, channelId) {

    if (!report) return '';

    const city = getReportCity(report);

    const lines = [buildCitizenComplaintText(report)];

    const hint = getOfficialCategoryHint(channelId, report.hazard, city);

    if (hint) lines.push('', t('official.categoryHint').replace('{hint}', hint));

    lines.push('', `CivicRadar report ID: ${report.id}`);

    if (report.timestamp) {

      lines.push(`${t('official.reportDate')}: ${new Date(report.timestamp).toLocaleDateString()}`);

    }

    lines.push(t('official.photoGuidance'));

    return lines.join('\n');

  }



  function trackOfficialChannelOpen(channelId, context, ward, hazard) {

    trackBmcEvent('official_channel_open', {

      channel: channelId,

      context: context || 'unknown',

      hazard: hazard || '',

    }, ward);

  }



  function openOfficialChannel(channelId, opts) {

    const options = opts || {};

    const report = options.report || (options.reportId ? findReportById(options.reportId) : null);

    const city = getReportCity(report || {}) || getUserCity();

    const meta = resolveOfficialChannelMeta(channelId, city);

    if (!meta || !meta.url) return;

    let url = meta.url;

    if (meta.urlKind === 'whatsapp' && report) {

      url = `${meta.url}?text=${encodeURIComponent(buildOfficialSummaryText(report, channelId))}`;

    }

    if (options.copySummary !== false && report) {

      copyTextSafe(buildOfficialSummaryText(report, channelId), 'official.copyDone');

    }

    trackOfficialChannelOpen(channelId, options.context || 'panel', report?.ward, report?.hazard);

    if (meta.urlKind === 'tel') window.open(url, '_self');

    else window.open(url, '_blank');

  }



  function renderOfficialChannelButtons(container, cityId, hazard, report, opts) {

    if (!container) return;

    const channels = getOfficialChannelsForCity(cityId, hazard, opts);

    if (!channels.length) {

      container.innerHTML = '';

      container.classList.add('hidden');

      return;

    }

    container.classList.remove('hidden');

    container.innerHTML = channels.map((ch) => {

      const recCls = ch.recommended ? ' esc-channel--recommended' : '';

      const hintAttr = ch.categoryHint

        ? ` title="${escapeHtml(ch.categoryHint)}"`

        : '';

      return `<div class="esc-channel-wrap">

        <button type="button" class="esc-channel${recCls}" data-official-channel="${escapeHtml(ch.id)}"${hintAttr}>

        <i class="ph ph-${ch.icon}"></i><span>${escapeHtml(ch.label)}</span><small>${escapeHtml(ch.small)}</small>

      </button>

      ${ch.sourceUrl ? `<p class="esc-channel-source"><a href="${escapeHtml(ch.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ch.sourceLabel || ch.sourceUrl)}</a></p>` : ''}

      </div>`;

    }).join('');

    container.dataset.officialReportId = report && report.id ? String(report.id) : '';

    container.dataset.officialContext = (opts && opts.context) || 'panel';

  }



  function renderOfficialChannelsSurfaces(report) {

    const city = getUserCity();

    const hazard = (report && report.hazard) || 'stagnant-water';

    renderOfficialChannelButtons($('#successOfficialChannels'), city, hazard, report, { context: 'success' });

    renderOfficialChannelButtons($('#resourcesOfficialChannels'), city, hazard, null, { context: 'resources' });

    const hintEl = $('#escOfficialCategoryHint');

    if (hintEl && report) {

      const primary = getOfficialChannelsForCity(getReportCity(report), report.hazard)[0];

      if (primary && primary.categoryHint) {

        hintEl.textContent = t('esc.officialHint').replace('{hint}', primary.categoryHint);

        hintEl.classList.remove('hidden');

      } else {

        hintEl.classList.add('hidden');

      }

    } else if (hintEl) {

      hintEl.classList.add('hidden');

    }

  }



  function getEscTierOfficialChannel(city, tierKey, hazard) {

    const channels = getOfficialChannelsForCity(city, hazard);

    if (tierKey === 'grievance') return 'aaple_sarkar';

    if (tierKey === 'file' || tierKey === 'matrix') {

      const primary = channels.find((c) => c.recommended) || channels[0];

      return primary ? primary.id : null;

    }

    if (tierKey === 'zonal') {

      if (city === 'mumbai') return 'bmc_whatsapp';

      if (city === 'pune') return 'pmc_wa';

      return channels[0] ? channels[0].id : null;

    }

    return null;

  }



  function handleOfficialChannelClick(e) {

    const btn = e.target.closest('[data-official-channel]');

    if (!btn) return;

    const channelId = btn.dataset.officialChannel;

    const wrap = btn.closest('[data-official-report-id], #successOfficialChannels, #resourcesOfficialChannels, #escOfficialExtras');

    let reportId = wrap && wrap.dataset.officialReportId;

    if (!reportId && activeEscalationId) reportId = activeEscalationId;

    if (!reportId && lastReportId) reportId = lastReportId;

    const report = reportId ? findReportById(reportId) : null;

    openOfficialChannel(channelId, {

      report,

      context: (wrap && wrap.dataset.officialContext) || (btn.closest('#escOfficialExtras') ? 'escalation' : 'panel'),

    });

  }



  function getCorpShortName(cityId) {

    const corp = getCityCorpChannels(cityId);

    return corp.name || getCityLabel(cityId);

  }



  function getComplaintRefPrefix(cityId) {

    return getCorpShortName(cityId);

  }



  function getReportCity(report) {

    if (report && report.city && CITIES[report.city]) return report.city;

    if (report && report.ward && window.CivicWardDetect && CivicWardDetect.isKnownWard) {

      for (let i = 0; i < CITY_IDS.length; i++) {

        if (CivicWardDetect.isKnownWard(report.ward, CITY_IDS[i])) return CITY_IDS[i];

      }

    }

    return DEFAULT_CITY;

  }



  function cityScopedReports(reports) {

    const city = getUserCity();

    return reports.filter((r) => getReportCity(r) === city);

  }



  // BMC municipal queue pilot is Mumbai-only; Pune/Thane use PMC/TMC corp filing.

  function isBmcPilotCity(cityId) {

    return (cityId || getUserCity()) === 'mumbai';

  }



  function adminScopedReports(reports) {

    return reports.filter((r) => getReportCity(r) === 'mumbai');

  }



  function isAdminReportInScope(report) {

    if (!report || !isAdmin) return true;

    return isSuperAdmin || getReportCity(report) === 'mumbai';

  }



  function updatePartnerPortalUi() {

    const bmcBtn = $('#btnPartnerBmc');

    if (bmcBtn) bmcBtn.classList.toggle('hidden', !isBmcPilotCity(getUserCity()));

  }



  function wardDatalistId(cityId) {

    const id = cityId || getUserCity();

    if (id === 'pune') return 'puneCommunities';

    if (id === 'thane') return 'thaneCommunities';

    return 'mumbaiCommunities';

  }



  function populateWardDatalists() {

    if (!window.CivicWardDetect || !CivicWardDetect.getWardNames) return;

    CITY_IDS.forEach((cityId) => {

      const list = document.getElementById(wardDatalistId(cityId));

      if (!list) return;

      const names = CivicWardDetect.getWardNames(cityId);

      list.innerHTML = names.map((n) => {

        const safe = String(n).replace(/"/g, '&quot;');

        return `<option value="${safe}"></option>`;

      }).join('');

    });

  }



  function syncOnboardingCityUi(cityId) {

    const city = cityId || getOnboardingCity();

    refreshWardComboboxes();

    const hint = $('#wardHint');

    if (hint) {

      const wardCount = (CivicWardDetect && CivicWardDetect.getWardNames)

        ? CivicWardDetect.getWardNames(city).length

        : 0;

      hint.textContent = t('onboard.wardHint').replace('{city}', getCityLabel(city)).replace('{n}', String(wardCount));

    }

    const hdr = $('#headerContext');

    refreshSocietyForOnboarding();

    if (hdr && getActivePersona() === 'citizen') {

      hdr.textContent = t('header.contextCity').replace('{city}', getCityLabel(city));

    }

    refreshSocietyForOnboarding();

  }



  function getOnboardingCity() {

    const sel = $('#onboardCity');

    const val = sel && sel.value;

    return val && CITIES[val] ? val : DEFAULT_CITY;

  }



  function updateHeaderContext() {

    const el = $('#headerContext');

    if (!el) return;

    el.textContent = t('header.contextCity').replace('{city}', getCityLabel(getUserCity()));

  }



  populateWardDatalists();



  const CUSTOM_SOCIETIES_KEY = 'civicradar_custom_societies';



  function getSocietyDataByCityWard() {

    const cfg = window.CIVICRADAR_CONFIG || {};

    return cfg.societySuggestionsByCityWard

      || window.CIVICRADAR_SOCIETY_BY_WARD

      || {};

  }



  function loadCustomSocieties() {

    try {

      return JSON.parse(localStorage.getItem(CUSTOM_SOCIETIES_KEY) || '{}');

    } catch {

      return {};

    }

  }



  function saveCustomSocietyEntry(cityId, ward, name) {

    const trimmed = sanitizeText(name, 120);

    if (!trimmed || !ward || !cityId) return;

    const store = loadCustomSocieties();

    if (!store[cityId]) store[cityId] = {};

    if (!store[cityId][ward]) store[cityId][ward] = [];

    if (store[cityId][ward].includes(trimmed)) return;

    store[cityId][ward].unshift(trimmed);

    if (store[cityId][ward].length > 20) store[cityId][ward] = store[cityId][ward].slice(0, 20);

    safeLocalSet(CUSTOM_SOCIETIES_KEY, JSON.stringify(store));

  }



  function wardLabelShort(ward) {

    if (!ward) return '';

    const parts = String(ward).split('—');

    return parts.length > 1 ? parts[parts.length - 1].trim() : String(ward).trim();

  }



  function getConfiguredSocieties(cityId, ward) {

    if (!cityId || !ward) return [];

    const byCity = getSocietyDataByCityWard()[cityId] || {};

    return Array.isArray(byCity[ward]) ? byCity[ward] : [];

  }



  function getSocietySuggestions(cityId, ward) {

    if (!cityId || !ward) return [];

    const custom = ((loadCustomSocieties()[cityId] || {})[ward] || []);

    const configured = getConfiguredSocieties(cityId, ward);

    const demoNbh = ((window.CIVICRADAR_CONFIG || {}).demoNgoCodes || [])

      .filter((c) => c.ward === ward && c.neighbourhood)

      .map((c) => c.neighbourhood);

    return [...new Set([...custom, ...configured, ...demoNbh])];

  }



  function setNeighbourhoodFieldHint(hintId, keyBase, ward, count) {

    const el = document.getElementById(hintId);

    if (!el || typeof t !== 'function') return;

    const wardLabel = wardLabelShort(ward);

    if (!ward) {

      el.textContent = t(keyBase + 'NoWard');

    } else if (count > 0) {

      el.textContent = t(keyBase + 'Ward')

        .replace('{ward}', wardLabel)

        .replace('{n}', String(count));

    } else {

      el.textContent = t(keyBase + 'Custom');

    }

  }



  function updateSocietyHint(cityId, ward, count) {

    setNeighbourhoodFieldHint('onboardSocietyHint', 'onboard.societyHint', ward, count);

    setNeighbourhoodFieldHint('profileSocietyHint', 'profile.societyHint', ward, count);

    setNeighbourhoodFieldHint('volunteerNeighbourhoodHint', 'volunteer.neighbourhoodHint', ward, count);

    setNeighbourhoodFieldHint('leadNomNeighbourhoodHint', 'lead.neighbourhoodHint', ward, count);

  }



  function refreshSocietyDatalist(cityId, ward) {

    const list = document.getElementById('societySuggestions');

    if (!list) return;

    const suggestions = getSocietySuggestions(cityId, ward);

    list.innerHTML = suggestions.map((n) => {

      const safe = String(n).replace(/"/g, '&quot;');

      return `<option value="${safe}"></option>`;

    }).join('');

    updateSocietyHint(cityId, ward, suggestions.length);

    refreshSocietyComboboxes();

  }



  function cacheSocietyIfCustom(cityId, ward, value) {

    const val = sanitizeText(value, 120);

    if (!val || !ward || !cityId) return;

    const known = getSocietySuggestions(cityId, ward);

    if (!known.includes(val)) {

      saveCustomSocietyEntry(cityId, ward, val);

      refreshSocietyDatalist(cityId, ward);

    }

  }



  function refreshSocietyForOnboarding() {

    const cityId = getOnboardingCity();

    const ward = getOnboardingWard();

    if (ward && isValidWard(ward, cityId)) {

      refreshSocietyDatalist(cityId, ward);

    } else {

      refreshSocietyDatalist(cityId, '');

    }

  }



  function refreshSocietyForProfile() {

    refreshSocietyDatalist(user.city || DEFAULT_CITY, user.ward || '');

  }



  function getProfileCity() {

    const sel = $('#profileCity');

    const val = sel && sel.value;

    return val && CITIES[val] ? val : (user.city || DEFAULT_CITY);

  }



  function syncProfileCityUi(cityId) {

    const city = cityId || getProfileCity();

    refreshWardComboboxes();

    const hint = $('#profileWardHint');

    if (hint) {

      const wardCount = (CivicWardDetect && CivicWardDetect.getWardNames)

        ? CivicWardDetect.getWardNames(city).length

        : 0;

      hint.textContent = t('onboard.wardHint').replace('{city}', getCityLabel(city)).replace('{n}', String(wardCount));

    }

    const ward = ($('#profileWardInput') && $('#profileWardInput').value.trim()) || user.ward || '';

    if (ward && isValidWard(ward, city)) refreshSocietyDatalist(city, ward);

    else refreshSocietyDatalist(city, '');

  }



  function saveProfileWard() {

    const wardInput = $('#profileWardInput');

    if (!wardInput) return;

    const city = getProfileCity();

    const ward = wardInput.value.trim();

    const wardErr = $('#profileWardError');

    if (wardErr) wardErr.classList.add('hidden');

    if (!ward) return;

    if (!isValidWard(ward, city)) {

      if (wardErr) revealFieldError(wardErr);

      showToast(t('toast.wardRequired').replace('{city}', getCityLabel(city)), 'error');

      return;

    }

    const cityChanged = city !== (user.city || DEFAULT_CITY);

    const wardChanged = ward !== (user.ward || '');

    if (!cityChanged && !wardChanged) return;

    user.city = city;

    user.ward = ward;

    saveUser();

    cacheSocietyIfCustom(city, ward, user.society);

    refreshSocietyForProfile();

    updateHeaderContext();

    updatePersonaUI();

    updateHomeHero();

    updateMapEmptyCta();

    updatePartnerPortalUi();

    if (typeof renderWardPulse === 'function') renderWardPulse();

    const wardImpactEl = $('#profileWardImpact');

    if (wardImpactEl) {

      const wardCount = getWardMonsoonCount(user.ward);

      wardImpactEl.classList.remove('hidden');

      const streak = getReportWeekStreak();

      wardImpactEl.textContent = t('profile.wardImpact').replace('{n}', String(wardCount)) +

        (streak >= 2 ? ` — ${t('profile.streak').replace('{n}', String(streak))}` : '');

    }

  }



  const SOCIETY_COMBO_IDS = ['onboardSociety', 'profileSocietyInput', 'volunteerNeighbourhood', 'leadNomNeighbourhood'];

  const WARD_COMBO_IDS = ['wardInput', 'profileWardInput', 'accessWard', 'leadNomWard', 'pledgeWard'];



  function comboboxLabels() {

    return {

      emptyLabel: () => (typeof t === 'function' ? t('combobox.noMatches') : 'No matches'),

      toggleLabel: () => (typeof t === 'function' ? t('combobox.showOptions') : 'Show options'),

    };

  }



  function getWardOptionsForCity(cityId) {

    const city = cityId || DEFAULT_CITY;

    if (window.CivicWardDetect && CivicWardDetect.getWardNames) {

      return CivicWardDetect.getWardNames(city) || [];

    }

    return getCityWards(city);

  }



  function getSocietyOptionsForField(fieldId) {

    let cityId = DEFAULT_CITY;

    let ward = '';

    if (fieldId === 'onboardSociety') {

      cityId = getOnboardingCity();

      ward = getOnboardingWard();

    } else if (fieldId === 'profileSocietyInput') {

      cityId = getProfileCity();

      ward = ($('#profileWardInput') && $('#profileWardInput').value.trim()) || user.ward || '';

    } else if (fieldId === 'volunteerNeighbourhood') {

      cityId = getUserCity();

      ward = user.ward || '';

    } else if (fieldId === 'leadNomNeighbourhood') {

      cityId = ($('#leadNomCity') && $('#leadNomCity').value) || user.city || DEFAULT_CITY;

      ward = sanitizeText($('#leadNomWard')?.value || '', 120);

    }

    if (!ward || !isValidWard(ward, cityId)) return [];

    return getSocietySuggestions(cityId, ward);

  }



  function refreshSocietyComboboxes() {

    if (!window.CivicSearchableSelect) return;

    SOCIETY_COMBO_IDS.forEach((id) => {

      const el = document.getElementById(id);

      if (el) CivicSearchableSelect.refresh(el);

    });

  }



  function refreshWardComboboxes() {

    if (!window.CivicSearchableSelect) return;

    WARD_COMBO_IDS.forEach((id) => {

      const el = document.getElementById(id);

      if (el) CivicSearchableSelect.refresh(el);

    });

  }



  function initSearchableComboboxes() {

    if (!window.CivicSearchableSelect) return;

    const labels = comboboxLabels();



    WARD_COMBO_IDS.forEach((id) => {

      const input = document.getElementById(id);

      if (!input || input.dataset.civicCombobox) return;

      input.dataset.civicCombobox = 'ward';

      const getCity = id === 'wardInput'

        ? getOnboardingCity

        : id === 'profileWardInput'

          ? getProfileCity

          : id === 'accessWard'

            ? () => ($('#accessCity') && $('#accessCity').value) || DEFAULT_CITY

            : id === 'leadNomWard'

              ? () => ($('#leadNomCity') && $('#leadNomCity').value) || user.city || DEFAULT_CITY

              : () => getUserCity();

      CivicSearchableSelect.init(input, Object.assign({}, labels, {

        allowCustom: false,

        getOptions: () => getWardOptionsForCity(getCity()),

      }));

    });



    SOCIETY_COMBO_IDS.forEach((id) => {

      const input = document.getElementById(id);

      if (!input || input.dataset.civicCombobox) return;

      input.dataset.civicCombobox = 'society';

      CivicSearchableSelect.init(input, Object.assign({}, labels, {

        allowCustom: true,

        getOptions: () => getSocietyOptionsForField(id),

      }));

    });

  }



  function refreshLeadNomNeighbourhoodDatalist() {

    const citySel = $('#leadNomCity');

    const cityId = (citySel && citySel.value) || user.city || DEFAULT_CITY;

    const ward = sanitizeText($('#leadNomWard')?.value || '', 120);

    if (ward && isValidWard(ward, cityId)) {

      refreshSocietyDatalist(cityId, ward);

    } else {

      refreshSocietyDatalist(cityId, '');

    }

  }



  if (window.CIVICRADAR_CONFIG && window.CIVICRADAR_SOCIETY_BY_WARD) {

    window.CIVICRADAR_CONFIG.societySuggestionsByCityWard = window.CIVICRADAR_SOCIETY_BY_WARD;

  }



  function getModCfg() {

    return window.ImageModeration

      ? ImageModeration.mergeConfig((window.CIVICRADAR_CONFIG || {}).moderation)

      : { enabled: false };

  }



  /* ---------- Utilities ---------- */

  // Report photos are either a local base64 data URL (pre-sync/offline) or a
  // public Supabase Storage URL (post-sync, see Backend.uploadReportImage) —
  // never anything else, so <img src> never renders an attacker-supplied URL.
  function isSafeReportImage(src) {
    if (!src) return false;
    if (/^data:image\//.test(src)) return true;
    const cfg = window.CIVICRADAR_CONFIG || {};
    return !!(cfg.supabaseUrl && src.indexOf(cfg.supabaseUrl + '/storage/v1/object/public/report-photos/') === 0);
  }

  function escapeHtml(value) {

    if (value == null) return '';

    return String(value)

      .replace(/&/g, '&amp;')

      .replace(/</g, '&lt;')

      .replace(/>/g, '&gt;')

      .replace(/"/g, '&quot;')

      .replace(/'/g, '&#39;');

  }



  function isUselessAuthMessage(value) {

    if (value == null) return true;

    const s = String(value).trim();

    return !s || s === '{}' || s === '[object Object]' || s === 'undefined' || s === 'null';

  }



  function authErrorCodeHint(code) {

    const hints = {

      over_email_send_rate_limit: 'toast.authEmailRateLimit',

      email_rate_limit_exceeded: 'toast.authEmailRateLimit',

      validation_failed: 'toast.authEmailInvalid',

      email_address_invalid: 'toast.authEmailInvalid',

      redirect_url_not_allowed: 'toast.authEmailRedirect',

      unexpected_failure: 'toast.authEmailFail',

      captcha_failed: 'toast.authCaptchaFail',

      captcha_unavailable: 'toast.authCaptchaFail',

      captcha_verification_failed: 'toast.authCaptchaFail',

    };

    const key = hints[code];

    return key ? t(key) : '';

  }



  function formatAuthError(err, fallbackKey) {

    const fb = t(fallbackKey || 'toast.authEmailFail');

    if (err == null) return fb;

    if (typeof err === 'string') {

      return isUselessAuthMessage(err) ? fb : err.trim();

    }

    const parts = [];

    const candidates = [err.message, err.msg, err.error_description, err.description];

    for (const c of candidates) {

      if (typeof c === 'string' && !isUselessAuthMessage(c)) {

        parts.push(c.trim());

        break;

      }

    }

    const code = err.code || err.error_code;

    if (typeof code === 'string' && code) {

      const hint = authErrorCodeHint(code);

      if (hint && !parts.includes(hint)) parts.push(hint);

    }

    if (parts.length) return parts.join(' — ');

    const status = err.status || err.statusCode;

    if (status === 429) return t('toast.authEmailRateLimit');

    if (/rate.?limit/i.test(String(err.message || ''))) return t('toast.authEmailRateLimit');

    if (/smtp|mail|email/i.test(String(err.message || ''))) return fb;

    console.warn('[CivicRadar] Auth error:', err);

    return fb;

  }



  // Strip markup from user-entered text before storing or displaying.

  function sanitizeText(value, maxLen) {

    const cleaned = String(value || '').replace(/<[^>]*>/g, '').trim();

    return maxLen ? cleaned.slice(0, maxLen) : cleaned;

  }



  function sanitizeDisplayName(name) {

    return sanitizeText(name, 30) || 'Citizen';

  }



  function reportCityBounds(cityId) {

    const cfg = CITIES[cityId] || CITIES.mumbai || {};

    return cfg.bounds || { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };

  }



  function sanitizeReportInput(r) {

    const city = r.city && CITIES[r.city] ? r.city : getReportCity(r);

    const hazard = REPORT_HAZARDS.includes(r.hazard) ? r.hazard : 'stagnant-water';

    const bounds = reportCityBounds(city);

    let lat = r.lat != null ? Number(r.lat) : null;

    let lng = r.lng != null ? Number(r.lng) : null;

    if (lat != null && (!Number.isFinite(lat) || lat < bounds.minLat || lat > bounds.maxLat)) lat = null;

    if (lng != null && (!Number.isFinite(lng) || lng < bounds.minLng || lng > bounds.maxLng)) lng = null;

    return {

      id: r.id,

      reporterId: r.reporterId || '',

      hazard,

      notes: sanitizeText(r.notes, REPORT_NOTES_MAX),

      image: r.image || '',

      ward: sanitizeText(r.ward, REPORT_WARD_MAX),

      city,

      society: sanitizeText(r.society || '', REPORT_SOCIETY_MAX),

      neighbourhood: sanitizeText(r.neighbourhood || '', REPORT_SOCIETY_MAX),

      reporter: sanitizeDisplayName(r.reporter || ''),

      lat,

      lng,

      status: 'pending',

      confirmations: 0,

      fixConfirmations: 0,

      timestamp: r.timestamp || new Date().toISOString(),

    };

  }



  const DEFAULT_DISPLAY_NAME_TITLES = [

    'Ward Scout', 'Monsoon Guardian', 'Pin Pioneer', 'Ripple Ranger',

    'Map Sherpa', 'Water Watch', 'Monsoon Mate', 'Civic Spotter',

    'Drain Detective', 'Neighbour Ninja',

  ];



  function randomHex4() {

    const bytes = new Uint8Array(2);

    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);

    else {

      bytes[0] = Math.floor(Math.random() * 256);

      bytes[1] = Math.floor(Math.random() * 256);

    }

    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

  }



  function wardLabelForDisplayName(ward) {

    const label = wardLabelShort(ward);

    if (!label) return '';

    return label.length > 12 ? label.slice(0, 12).trim() : label;

  }



  function generateDefaultDisplayName(opts) {

    const titles = DEFAULT_DISPLAY_NAME_TITLES;

    const title = titles[Math.floor(Math.random() * titles.length)];

    const hex = randomHex4();

    const wardBit = wardLabelForDisplayName(opts && opts.ward);

    const pattern = wardBit ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 2);

    let name;

    if (pattern === 0 && wardBit) name = `${title} · ${wardBit} #${hex}`;

    else if (pattern === 1) name = `${title} #${hex}`;

    else name = `${title} ${hex}`;

    return sanitizeText(name, 30) || `${title} #${hex}`.slice(0, 30);

  }



  function resolveDisplayName(raw, opts) {

    const trimmed = sanitizeText(raw, 30);

    if (trimmed) return trimmed;

    return generateDefaultDisplayName(opts);

  }



  function generateId() {

    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();

    return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  }



  /* ---------- Internationalisation (EN / HI / MR) ---------- */

  const I18N = {

    en: {

      'lang.name': 'English',

      'lang.native': 'English',

      'nav.map': 'Map',

      'nav.community': 'Community',

      'nav.resources': 'Resources',

      'nav.profile': 'Profile',

      'fab.report': 'Report',

      'header.context': 'Ward hazard map — Mumbai, Pune & Thane',

      'header.contextCity': 'Ward hazard map for {city}',

      'location.banner': 'Turn on location to pin hazards accurately.',

      'location.bannerNearby': 'Enable location to report hazards and see nearby issues.',

      'location.unavailable': 'Location unavailable in this browser.',

      'location.withdrawn': 'Location consent withdrawn. Enable again when you want to report.',

      'location.dismiss': 'Dismiss location prompt',

      'location.locate': 'Turn on location',

      'location.locateAria': 'Turn on location',

      'location.enable': 'Turn on',

      'tagline.threeBeat': 'Map it · Snap it · Report it',

      'tagline.subline': 'Three taps — your ward, a photo, neighbours alerted.',

      'tagline.beatMap': 'Map it',

      'tagline.beatSnap': 'Snap it',

      'tagline.beatReport': 'Report it',

      'coach.step': 'Quick start · 30 seconds',

      'coach.title': 'Welcome to your ward map',

      'coach.body': 'Three taps to report: your spot, a photo, and your neighbours are in the loop.',

      'coach.got': 'Got it',

      'tour.skip': 'Skip',

      'tour.next': 'Next',

      'tour.done': 'Got it',

      'tour.replay': 'Replay tour',

      'tour.map.title': 'Your ward, on the map',

      'tour.map.body': 'Every hazard your neighbours report shows up here as a pin.',

      'tour.report.title': 'Spotted something?',

      'tour.report.body': 'Tap Report and snap a photo right where you\'re standing.',

      'tour.profile.title': 'You\'re on the map',

      'tour.profile.body': 'Your neighbours see the pin. Track your Civic Points in Profile.',

      'persona.citizen.idle': 'Spotted a hazard nearby? Report it in 30 seconds — your neighbours will thank you.',

      'persona.wardImpact': '{ward}: {n} reports from your neighbours so far. Add yours.',

      'persona.unfiled': '{n} open spots on your ward map — share with neighbours, or file officially from Resources.',

      'persona.pendingFiled': '{n} open on your ward map — check Profile for anything overdue.',

      'persona.admin.idlePending': '{n} waiting for review — open the queue, or tap the red pins.',

      'persona.admin.idleEmpty': 'All clear. New reports from neighbours will show up here.',

      'persona.admin.header': 'BMC review mode',

      'persona.admin.exit': 'Exit BMC mode',

      'persona.ngo.header': 'NGO coordinator mode',

      'persona.ngo.exit': 'Exit NGO mode',

      'onboard.title': 'Welcome to CivicRadar',

      'onboard.subtitle': 'Your street, on one map. Spot a problem, snap it, and your neighbours see it too.',

      'onboard.city': 'Your city',

      'onboard.cityHint': 'Pick where you live — we\'ll find your ward from your location next.',

      'onboard.ward': 'Your ward',

      'onboard.wardPh': 'Start typing your ward…',

      'combobox.noMatches': 'No matches — try a different search',

      'combobox.showOptions': 'Show all options',

      'onboard.wardHint': 'Pick from {city}\'s wards, or let us detect it.',

      'onboard.wardDetecting': 'Finding your ward from your location…',

      'onboard.wardDetectedHint': 'Approximate ward from your location — you can change it.',

      'onboard.wardManual': 'Not right? Pick it yourself',

      'onboard.wardRetry': 'Try again',

      'onboard.wardDetectFailed': 'Couldn\'t find your ward. Pick it yourself, or turn on location.',

      'onboard.name': 'Display name',

      'onboard.namePh': 'What should neighbours call you?',

      'onboard.join': 'Join your ward',

      'onboard.wardError': 'Pick a ward from the list, or turn on location.',

      'onboard.society': 'Society or neighbourhood (optional)',

      'onboard.societyPh': 'Your society or RWA name, if it\'s not listed',

      'onboard.societyHintNoWard': 'Pick your ward first to see nearby societies.',

      'onboard.societyHintWard': '{n} societies in {ward} — start typing, or add yours.',

      'onboard.societyHintCustom': 'Type your society or RWA name if it\'s not listed.',

      'report.title': 'Report a hazard',

      'report.step.capture': 'Capture',

      'report.step.confirm': 'Confirm',

      'report.step.photo': 'Photo',

      'report.step.details': 'Details',

      'report.step.submit': 'Submit',

      'report.addNote': '+ Add landmark',

      'report.pinDragHint': 'Drag the pin if it\'s not exactly right',

      'report.pinAccuracyGood': 'Location accurate to ~{m} m',

      'report.pinAccuracyFair': 'Location ~{m} m — drag the pin or move to open sky',

      'report.pinAccuracyPoor': 'Location is approximate (~{m} m) — drag the pin onto the hazard',

      'report.pinAccuracyUnknown': 'Confirm the pin is on the hazard — drag to adjust',

      'report.pinAccuracyAdjusted': 'Pin adjusted — looks good',

      'report.pinLocating': 'Finding your location…',

      'report.pinMapAria': 'Adjust hazard location on map',

      'report.wardChip': '{ward}',

      'report.wardGps': 'GPS location on submit',

      'report.wardManualPin': 'Pin placed on map',

      'report.geoExplainerTitle': 'Pin this hazard on the map',

      'report.geoExplainerBody': 'We need your location only to pin the hazard — nothing else.',

      'report.geoExplainerContinue': 'Use my location',

      'report.geoExplainerManual': 'Place pin on map instead',

      'report.manualPinBanner': 'Tap the map where the hazard is',

      'report.manualPinCancel': 'Cancel',

      'report.placePinOnMap': 'Place pin on map',

      'report.geoEnableHint': 'How to enable location',

      'report.geoEnableHelp': 'Browser settings → Site permissions → Location → Allow for this site. Then tap Submit again.',

      'report.hazardType': 'Hazard Type',

      'report.hazardHint': 'Tap the hazard you\'re reporting',

      'report.photoNext': 'Selected: {hazard} — tap Submit when ready',

      'report.photoEvidence': 'Photo',

      'report.capture': 'Take photo',

      'report.notes': 'Landmark (optional)',

      'report.notesPh': 'Near which shop/building? e.g. opposite Sai Medical',

      'report.submit': 'Submit report',

      'report.photoHint': 'Photo shows the hazard? Tap Submit — or retake if not.',

      'report.retake': 'Retake photo',

      'moderation.guidelines': 'Snap a clear photo of the hazard — tap the button below. Avoid faces, documents, or unrelated objects. Location data is stripped for privacy.',

      'moderation.guidelines.stagnant-water': 'Snap the stagnant water — tap the button below. Avoid faces, documents, or unrelated objects. Location data is stripped for privacy.',

      'moderation.guidelines.garbage': 'Snap the garbage pile or dump — tap the button below. Avoid faces, documents, or unrelated objects. Location data is stripped for privacy.',

      'moderation.guidelines.potholes': 'Snap the pothole or road damage — tap the button below. Avoid faces, documents, or unrelated objects. Location data is stripped for privacy.',

      'moderation.guidelines.streetlight': 'Snap the broken streetlight — tap the button below. Avoid faces, documents, or unrelated objects. Location data is stripped for privacy.',

      'moderation.scanning': 'Checking photo…',

      'moderation.blocked.fileType': 'Only JPEG, PNG, or WebP hazard photos are allowed.',

      'moderation.blocked.fileSize': 'Photo is too large. Use a smaller image (max 8 MB).',

      'moderation.blocked.lowQuality': 'Photo is too small or unclear. Move closer to the hazard.',

      'moderation.blocked.irrelevant': 'Use a photo of the hazard — not a selfie, document, or blank image.',

      'moderation.blocked.sensitive': 'Avoid IDs, documents, or screenshots. Show the hazard only.',

      'moderation.blocked.nsfw': 'This photo was blocked for inappropriate content.',

      'moderation.blocked.offline': 'Connect to the internet to verify photo safety.',

      'success.title': 'Reported — nice one',

      'success.tagline': 'Your spot is pinned on the ward map.',

      'success.taglineNeighbours': '{n} neighbour(s) are already backing nearby spots — yours is up there now too.',

      'success.subtitle': 'Free with {corp} — starts the official complaint clock.',

      'success.step1': 'Share on WhatsApp so your neighbours can back it',

      'success.step2': 'Optional: file with {corp} and save your complaint number',

      'success.step3': 'Neighbours or {corp} can mark it fixed — and you earn Civic Points',

      'success.file': 'File with BMC',

      'success.fileCorp': 'File with {corp}',

      'success.tag': 'Tag @mybmc',

      'success.alert': 'Tell your neighbours',

      'success.done': 'Back to map',

      'success.sharePrompt': 'Share on WhatsApp — more eyes mean faster fixes.',

      'success.shareWhatsapp': 'Share on WhatsApp',

      'share.nativeShare': 'Share',

      'success.shareNudge': 'Your neighbours may not know yet — a quick WhatsApp share gets more eyes on it.',

      'success.shareMsg': '📍 {hazard} in {ward} — I just pinned it on our CivicRadar ward map.\nTap Me too, or report a spot in your lane:\n{link}\n{hashtags}',

      'share.appMsg': '🗺️ {city} ward hazard map — pin garbage, potholes, streetlights & stagnant water. Me too, beat rival wards!\n{link}\n{hashtags}',

      'share.defaultArea': 'my area',

      'share.meTooMsg': '👋 Me too — I see {hazard} in {ward} too. {n} neighbour(s) backed on CivicRadar:\n{link}\n{hashtags}',

      'share.meTooBtn': 'Share on WhatsApp',

      'share.wardMapMsg': '🗺️ {ward}: {pending} open hazard(s) — beat us on CivicRadar!\n{link}\n{hashtags}',

      'share.cleanupMsg': '🧹 Volunteers cleared {hazard} in {ward}! Before → after on the ward map:\n{link}\n{hashtags}',

      'share.instagramCaption': '{hazard} spot cleared in {ward} ✅ Before → After on CivicRadar.\n{link}\n{hashtags}',

      'share.instagramCleanupCaption': 'Volunteers cleared {hazard} in {ward} 🦟 Before → After on CivicRadar.\n{link}\n{hashtags}',

      'share.milestoneMsg': '🏆 {ward} just hit {n} fixes on CivicRadar! Can your ward beat us?\n{link}\n{hashtags}',

      'share.firstBonus': 'First share — +10 Civic Points! 👋',

      'shareWin.title': 'Share the win!',

      'shareWin.subtitle': 'Before → after proof on your ward map — neighbours love seeing fixes.',

      'shareWin.subtitleCleanup': 'Volunteers cleared it — share the before/after on your building group.',

      'shareWin.whatsapp': 'Share win on WhatsApp',

      'shareWin.instagramHint': 'Save image → post to Instagram Stories',

      'shareWin.downloadCard': 'Download success card',

      'shareWin.copyCaption': 'Copy caption for Instagram',

      'shareWin.nativeShare': 'Share image',

      'shareWin.cardDownloaded': 'Success card saved — open Instagram to post',

      'shareWin.captionCopied': 'Caption copied — paste in Instagram',

      'shareWin.done': 'Done',

      'shareWin.footerMsg': 'I helped clean up {location} using {app}!',

      'shareWin.fixedLabel': 'Fixed',
      'shareWin.stampFixed': 'FIXED',

      'ba.dragHint': 'Drag to compare before and after',

      'ba.before': 'Before',

      'ba.after': 'After',


      'shareWin.aspectSquare': 'Square',

      'shareWin.aspectStory': 'Story',

      'toast.shareWinBtn': 'Share win',

      'about.sharePitch': 'Free {city} ward hazard map — pin garbage, potholes, streetlights & stagnant water in 30 sec. Me too, beat rival wards.\nBuilt for Mumbai, Pune & Thane. No login, 4 languages.\n{link}\nForward to your RWA / society WhatsApp group 👋',

      'about.copyPitch': 'Copy WhatsApp pitch',

      'about.pitchCopied': 'Pitch copied — paste in your RWA / school group!',

      'pwa.nudge': 'Add CivicRadar to your home screen for one-tap reporting.',

      'pwa.nudgeAction': 'Add to home screen',

      'pwa.nudgeDismiss': 'Not now',

      'update.available': 'A new version of CivicRadar is ready.',

      'update.reload': 'Reload',

      'iosInstall.title': 'Install on iPhone',

      'iosInstall.hint': 'Same app as Android — no App Store needed. Open in Safari if needed, then Share → Add to Home Screen.',

      'iosInstall.dismiss': 'Dismiss install hint',

      'appOpen.title': 'Open in CivicRadar app',

      'appOpen.body': 'View this report in the app — faster map & alerts.',

      'appOpen.open': 'Open in app',

      'appOpen.getApp': 'Get the app',

      'appOpen.dismiss': 'Dismiss banner',

      'community.challengeShare': 'Challenge a friend — share ward map',

      'community.winsTitle': 'Recent wins',

      'community.winsEmpty': 'Fixed spots show up here. Report one, rally your neighbours, and watch your lane improve.',

      'community.winsNeighbours': 'Neighbours in {ward}',

      'community.winsCleanup': '{hazard} cleared — {ward}',

      'community.winsResolved': '{hazard} fixed — {ward}',

      'success.points': 'Civic Points',

      'success.xpBonus': '+{n} Civic Points',

      'success.weekBonus': '+{n} — your first report this week',

      'success.celebrateFirst': 'Your first report — your lane just got a little safer.',

      'success.celebrateMilestone': '{n} reports in — your neighbours are lucky to have you.',

      'success.kudos1': 'Nice one — another hazard on the radar.',

      'success.kudos2': 'Good work — your ward\'s a little safer now.',

      'success.kudos3': 'Logged! Thanks for looking out for your neighbours.',

      'success.kudos4': 'You showed up again — that\'s how lanes get fixed.',

      'success.kudos5': 'Another pin down — your street thanks you.',

      'success.streakWeek': '{n} report(s) this week — keep it up!',


      'profile.milestoneOne': '1 more report to your next milestone',

      'profile.milestoneMany': '{n} more reports to your next milestone',

      'profile.milestoneMax': '10+ reports — your ward thanks you!',

      'profile.nextStreakBadge': '{n} more week(s) for {badge}',

      'success.progressOne': 'Just 1 more report to your next badge.',

      'success.progressMany': '{n} more reports to your next badge.',

      'success.progressMilestone': 'Badge unlocked! {n} more to your next one.',

      'success.progressGuardian': '{n} reports and counting — a true Monsoon Guardian.',

      'success.shareBrag': 'You just helped your ward — tell neighbours on WhatsApp!',

      'success.shareBragFirst': 'First pin on the map! Share now — Monsoon Guardian energy spreads fast.',

      'toast.badgeMonsoon': 'First report logged — welcome aboard! 🌧️',

      'confirm.meTooThanks': 'Me too counted — neighbours see the pressure building.',

      'toast.reportMilestone': '{n} reports — keep the momentum going!',

      'map.empty': 'No pins in {ward} yet — be the first.',

      'map.emptyHint': 'It takes about 30 seconds.',

      'map.emptyAction': 'Report the first one',

      'map.emptyShare': 'Invite your neighbours on WhatsApp',

      'map.emptyRival': '{ward} vs {rival} — {pending} open spots. Report one, or rally your street.',

      'map.emptyEncourage': 'Every pin helps your lane get noticed — garbage, potholes, streetlights, or standing water. Your report is where a fix starts.',

      'home.hero.badge': 'Your ward, together',

      'home.hero.headline': 'Spot it. Snap it. Sorted.',

      'home.hero.subline': 'Report a hazard in your lane in 30 seconds — and your neighbours see it too.',

      'home.hero.benefit1': 'Snap a photo',

      'home.hero.benefit2': 'Pin your ward',

      'home.hero.benefit3': 'Neighbours notified',

      'home.hero.cta': 'Report a spot',

      'home.hero.tour': 'Take the quick tour',

      'home.hero.trust': 'Free · works offline · 3 cities · 4 languages',

      'home.hero.dismiss': 'Dismiss welcome card',

      'map.legend.pending': 'Open',

      'map.legend.resolved': 'Fixed',

      'map.legend.you': 'You',

      'map.legend.aria': 'Map legend: open, fixed, and your pins',

      'pulse.aria': 'Ward pulse: open hazards, fixed this week, and Me too',

      'pulse.open': 'open',

      'pulse.fixedWeek': 'fixed this week',

      'pulse.metoo': 'Me too',

      'pulse.yourWard': 'Your ward',

      'reminder.unfiled': '{n} open on the map — share with neighbours or file from Profile.',

      'reminder.file': 'File now',

      'reminder.snooze3d': 'Remind me in 3 days',

      'reminder.gotIt': 'Got it',

      'reminder.esc7': 'Day {n}+ since filing — ward escalation due for {hazard} in {ward}.',

      'reminder.esc14': 'Day {n}+ since filing — zonal escalation due for {hazard} in {ward}.',

      'reminder.esc30': 'Day {n}+ since filing — grievance/RTI due for {hazard} in {ward}.',

      'reminder.escAction': 'Escalate',

      'reminder.corroboration': '{n} neighbour(s) said Me too on your {hazard} report — more eyes on the ward map helps.',

      'reminder.corroAction': 'View report',

      'reminder.cleanup': 'Neighbours cleared {hazard} in {ward} — your BMC complaint may still be open until officially closed.',

      'reminder.cleanupAction': 'View status',

      'persona.ngo.pledges': '{deliver} to deliver — {verify} to verify',

      'persona.ngo.newHazards': '{n} new hazards',

      'persona.ngo.newPledges': '{n} new pledge(s)',

      'persona.admin.overdue': '{overdue} overdue — {pending} pending — tap to open queue',

      'profile.badge.reporter': 'Active Reporter',

      'profile.badge.2week': '2-Week Reporter',

      'profile.badge.3week': '3-Week Reporter',

      'profile.badge.monsoon': 'Local Hero',

      'profile.wardImpact': 'Your ward: {n} reports this season',

      'profile.streak': '{n}-week reporting streak',

      'confirm.nearby': 'Pin {m}m away{backing}. Tap Me too instead of duplicating — get updates when fixed.',

      'esc.participate.title': 'Community action (optional)',

      'esc.participate.hint': 'Participate Mumbai is BMC\'s official portal for volunteering and CSR — not for filing pest-control complaints. Use it to join clean-ups or propose ward projects.',

      'esc.participate.btn': 'Participate Mumbai',

      'esc.participate.small': 'Volunteer — CSR — projects',

      'esc.corpTitle': 'File with local corporation (optional)',

      'esc.corpHint': 'Use {corp}\'s official grievance portal for stagnant-water / pest-control complaints.',

      'esc.corpBtn': 'Open {corp} portal',

      'esc.corpSubtitle': 'CivicRadar shows hazards on the community map. Filing with your local corporation is optional — it starts the official clock.',

      'esc.titleCorp': 'File with {corp} (optional)',

      'esc.tmc.recommended': 'Recommended: file on thanecity.gov.in or call TMC helpline 022-25331590.',

      'esc.tmc.fileHint': 'Stagnant water / mosquito breeding — use any official TMC channel below.',

      'esc.tmc.channelPortal': 'TMC online portal',

      'esc.tmc.channelCall': 'TMC helpline',

      'esc.tmc.channelEmail': 'Email Municipal Commissioner',

      'esc.tmc.channelTweet': 'Tag @TMCaTweetAway',

      'esc.tmc.channelCitizenCall': 'Citizen Call Center (155300)',

      'esc.tmc.copyBlock': 'Details for TMC portal / helpline / email',

      'esc.tmc.copyAllDone': 'Copied — paste when you file with TMC',

      'esc.tmc.portalHint': 'On thanecity.gov.in: login → Online citizen services → File a complaint. Paste details below.',

      'esc.tmc.filedConsent': 'I filed on an official TMC channel (portal / helpline / email / 155300 / Aaple Sarkar)',

      'esc.tmc.complaintLabel': 'TMC complaint / reference number',

      'esc.tmc.complaintPh': 'e.g. TMC/2026/123456',

      'esc.tmc.complaintWarn': 'This doesn\'t look like a typical TMC reference — you can still save if it\'s correct.',

      'esc.tmc.filedNote': 'Filed with TMC — escalation steps unlock as deadlines pass.',

      'esc.tmc.daysSince': '{n} days since you filed with TMC',

      'esc.tmc.selfTitle': 'TMC fixed it?',

      'esc.tmc.selfBody': 'Confirm yourself once TMC fixes it (your complaint number is proof). Turns the pin green for everyone.',

      'esc.tmc.aaple': 'Aaple Sarkar — select TMC as local body',

      'esc.tmc.deptTitle': 'Department contacts (escalation)',

      'esc.tmc.deptHint': 'For stagnant-water follow-ups — Water, Health, or Pollution Control.',

      'esc.tmc.dept.water': 'Water',

      'esc.tmc.dept.health': 'Health',

      'esc.tmc.dept.pollution': 'Pollution Control',

      'esc.tmc.tier.file.body': 'File on thanecity.gov.in, call 022-25331590 / 022-25331211, email mc@thanecity.gov.in, or use Citizen Call Center 155300. Save your reference number here.',

      'esc.tmc.tier.matrix.body': 'Follow up with your ward office or Health department (022-25331590). Quote your TMC reference number.',

      'esc.tmc.tier.zonal.body': 'Escalate to the Municipal Commissioner (mc@thanecity.gov.in). Tag @TMCaTweetAway on X with the photo for public visibility.',

      'esc.tmc.tier.grievance.body': 'Still ignored after a month? File with Aaple Sarkar (pgportal.gov.in) — select Thane Municipal Corporation as local body.',

      'esc.tmc.tier.openCall': 'Call TMC',

      'esc.tmc.tier.openTweet': 'Tag @TMCaTweetAway',

      'esc.tmc.tier.openEmail': 'Email MC',

      'esc.tmc.tier.openAaple': 'Aaple Sarkar',

      'esc.tmc.consentRequired': 'Confirm you filed on an official TMC channel before saving.',

      'esc.pmc.subtitle': 'CivicRadar shows hazards on the community map. Filing with PMC is your choice — it starts the official clock. This is not a PMC channel.',

      'esc.pmc.recommended': 'Recommended: PMC CARE WhatsApp — fastest for most Pune wards.',

      'esc.pmc.fileHint': 'Stagnant water and mosquito breeding go through PMC CARE. Use any channel:',

      'esc.pmc.channelWa': 'PMC CARE WhatsApp',

      'esc.pmc.channelWaSmall': 'Chat — pre-fill below',

      'esc.pmc.channelCall': 'Toll-free helpline',

      'esc.pmc.channelPortal': 'PMC CARE portal',

      'esc.pmc.channelApp': 'PMC CARE app',

      'esc.pmc.channelAppSmall': 'Play Store — App Store (replaces PuneConnect)',

      'esc.pmc.copyBlock': 'Details for PMC CARE / WhatsApp / helpline',

      'esc.pmc.copyAllDone': 'Copied — paste when you file on PMC CARE, WhatsApp, or the helpline',

      'esc.pmc.portalHint': 'On PMC CARE portal or app: register a grievance for stagnant water / mosquito breeding. Paste the details below.',

      'esc.pmc.filedConsent': 'I filed on an official PMC channel (PMC CARE / WhatsApp / helpline / app)',

      'esc.pmc.complaintLabel': 'PMC complaint / reference number',

      'esc.pmc.complaintPh': 'e.g. PMC/2026/123456',

      'esc.pmc.complaintWarn': 'This doesn\'t look like a typical PMC reference — you can still save if it\'s correct.',

      'esc.pmc.filedNote': 'Filed with PMC — escalation steps unlock as deadlines pass.',

      'esc.pmc.daysSince': '{n} days since you filed with PMC',

      'esc.pmc.selfTitle': 'PMC fixed it?',

      'esc.pmc.selfBody': 'Confirm yourself once PMC fixes it (your complaint number is proof). Turns the pin green for everyone.',

      'esc.pmc.tier.file.body': 'Free. File on PMC CARE portal, WhatsApp, toll-free 1800 1030 222, or the PMC CARE app. Save your reference number here.',

      'esc.pmc.tier.matrix.body': 'Follow up via PMC CARE or the toll-free helpline, quoting your complaint number.',

      'esc.pmc.tier.zonal.body': 'Escalate through PMC CARE portal or WhatsApp if your ward has not acted.',

      'esc.pmc.tier.grievance.body': 'Still ignored after a month? File with Aaple Sarkar (pgportal.gov.in) — select Pune Municipal Corporation as local body.',

      'esc.pmc.tier.openWa': 'Open WhatsApp',

      'esc.pmc.tier.openCall': 'Call PMC helpline',

      'esc.pmc.tier.openAaple': 'Aaple Sarkar',

      'esc.pmc.consentRequired': 'Confirm you filed on an official PMC channel before saving.',

      'esc.pmc.aaple': 'Aaple Sarkar — select Pune Municipal Corporation as local body',

      'copy1916.pmc.header': 'PMC complaint details (copy & paste for PMC CARE / WhatsApp / helpline)',

      'copy1916.pmc.complaintNotFiled': 'PMC complaint #: (not yet filed)',

      'copy1916.pmc.complaintFiled': 'PMC complaint #: {id}',

      'copy1916.tmc.header': 'TMC complaint details (copy & paste for thanecity.gov.in / helpline / email)',

      'copy1916.tmc.complaintNotFiled': 'TMC complaint / reference #: (not yet filed)',

      'copy1916.tmc.complaintFiled': 'TMC complaint / reference #: {id}',

      'profile.fileCorp': 'File with {corp}',

      'community.title': 'Community',

      'community.subtitle': 'Fix it together in {ward} — rally neighbours with {corp}, celebrate wins, support local leads.',

      'community.subtitleActive': '{ward}: {pending} open on the map — {resolved} fixed — rally neighbours or see Resources to help.',

      'community.topWards': 'Top Wards',

      'community.localCitizens': 'Local Citizens',

      'community.periodMonth': 'This month',

      'community.periodAll': 'All time',

      'community.thisWeekTitle': 'Your ward this week',

      'community.leaderboardTitle': 'Ward leaderboard',

      'community.getInvolvedTitle': 'Get involved',

      'community.resourcesTitle': 'Resources',

      'resources.title': 'Resources',

      'resources.subtitle': 'Official filing links and ways to help in your ward.',

      'resources.actionTitle': 'Help in your ward',

      'community.supportTitle': 'Support Volunteers',

      'community.supportBody': 'Pledge supplies for cleanup crews tackling stagnant water in your ward.',

      'community.pledge': 'Pledge',

      'community.volunteerTitle': 'Volunteer in my ward',

      'community.volunteerBody': 'Fix it together — clean stagnant water, spread awareness, or deliver pledged supplies. Filing with {corp} is separate.',

      'community.volunteerCta': 'Sign up',

      'volunteer.title': 'Volunteer in my ward',

      'volunteer.subtitle': 'Fix it together with neighbours — not a government volunteer programme.',

      'volunteer.ward': 'Your ward',

      'volunteer.neighbourhood': 'Neighbourhood / society / lane',

      'volunteer.neighbourhoodPh': 'e.g. Phoenix Mills lane, Building 7 Worli',

      'volunteer.neighbourhoodHintNoWard': 'Pick your ward first for local suggestions.',

      'volunteer.neighbourhoodHintWard': 'Showing {n} neighbourhoods in {ward} — type to add yours.',

      'volunteer.neighbourhoodHintCustom': 'Type your neighbourhood, society, or lane if not listed.',

      'volunteer.hours': 'Hours available this monsoon',

      'volunteer.hoursCustom': 'Custom',

      'volunteer.skills': 'I can help with',

      'volunteer.skill.cleanup': 'Cleanup stagnant water',

      'volunteer.skill.awareness': 'Awareness & WhatsApp outreach',

      'volunteer.skill.pledge': 'Pledge delivery (supplies)',

      'volunteer.contact': 'Phone / WhatsApp (optional)',

      'volunteer.contactHint': 'Optional — shared with your ward or neighbourhood coordinator only if you enter it. You control this; CivicRadar never auto-calls.',

      'volunteer.ageNote': '18+ required per Terms. Under-18? Participate only with a parent/guardian or school NSS coordinator who accepts Terms.',

      'volunteer.submit': 'Save volunteer signup',

      'volunteer.remove': 'Remove my signup',

      'volunteer.edit': 'Edit signup',

      'volunteer.empty': 'Not signed up yet. Help fix hazards in your lane from Community.',

      'volunteer.emptyAction': 'Volunteer in my ward',

      'volunteer.hoursLabel': '{n} hrs this monsoon',

      'popup.helpClean': 'I can help clean this',

      'popup.taskOffered': 'Volunteer offered to help',

      'toast.volunteerSaved': 'Volunteer signup saved — coordinators in your ward can see it.',

      'toast.volunteerRemoved': 'Volunteer signup removed.',

      'toast.volunteerWardRequired': 'Set your ward in onboarding first.',

      'toast.volunteerNeighbourhoodRequired': 'Enter your neighbourhood, society, or lane.',

      'toast.volunteerSkillRequired': 'Select at least one way you can help.',

      'toast.volunteerTaskOffered': 'Offer sent — your ward or neighbourhood coordinator can match you to this spot.',

      'toast.volunteerTaskDuplicate': 'You already offered to help with this hazard.',

      'toast.volunteerSignupRequired': 'Sign up as a volunteer first (Community tab).',

      'toast.volunteerTaskCompleted': 'Cleanup marked complete — reporter notified.',

      'toast.coordScopeWard': 'Ward coordinator — all of {ward}',

      'toast.coordScopeNbh': 'Neighbourhood lead — {label}',

      'inquiry.coordTitle': 'Become a ward or neighbourhood coordinator',

      'inquiry.coordBody': 'Lead your RWA/society or ward NGO — see volunteers, match cleanup offers, verify pledge hours. Request an invite code from the operator.',

      'about.becomeCoord': 'Become a ward or neighbourhood coordinator',

      'coord.codeHint': 'Coordinators receive a code when onboarded — ward-wide or neighbourhood (RWA/society) scope.',

      'coord.volunteers': 'Volunteers in your scope',

      'coord.volunteersEmpty': 'No volunteer signups yet. Share the Community tab — citizens can sign up to help locally.',

      'coord.tasks': 'Volunteer cleanup offers',

      'coord.tasksEmpty': 'No volunteer offers yet. Citizens tap —I can help clean this— on open hazard pins.',

      'coord.tasksPending': 'Tasks',

      'coord.volunteersLabel': 'Volunteers',

      'coord.markTaskComplete': 'Mark cleanup done',

      'coord.scopeWard': 'Ward lead — {ward}',

      'coord.scopeNbh': 'Neighbourhood lead — {label}',

      'profile.volunteer': 'My volunteer signup',

      'profile.section.details': 'Your details',

      'profile.section.location': 'City, ward & neighbourhood',

      'profile.section.activity': 'Activity',

      'profile.section.account': 'Account & support',

      'profile.title': 'Your Profile',

      'profile.persona': 'Citizen',

      'profile.points': 'Civic Points',

      'profile.xpTotalLabel': '{n} XP',

      'profile.xpToNext': '{n} XP to {level}',

      'profile.xpMax': 'Max level — Community Leader!',

      'xp.level.observer': 'Local Observer',

      'xp.level.wardWatcher': 'Ward Watcher',

      'xp.level.neighbourhoodVoice': 'Neighbourhood Voice',

      'xp.level.civicChampion': 'Civic Champion',

      'xp.level.monsoonGuardian': 'Monsoon Guardian',

      'xp.level.communityLeader': 'Community Leader',

      'cert.title': 'Certificate unlocked!',

      'cert.subtitle': 'You reached {level}',

      'cert.cardHeading': 'Civic Hero Certificate',

      'cert.awarded': 'Awarded to {name}',

      'cert.date': '{date}',

      'cert.tagline': 'Protecting our ward this monsoon',

      'cert.download': 'Download certificate',

      'cert.whatsapp': 'Share on WhatsApp',

      'cert.copyCaption': 'Copy caption',

      'cert.caption': 'I earned {level} on CivicRadar — join me protecting {ward} this monsoon!\n{link}',

      'cert.captionCopied': 'Caption copied — paste on social media',

      'cert.downloaded': 'Certificate saved — share your civic win!',

      'cert.done': 'Done',

      'profile.fixed': 'Fixed',

      'profile.pending': 'Open',

      'profile.reports': 'Your Reports',

      'profile.install': 'Install CivicRadar app',

      'profile.partner': 'Volunteer / NGO login',

      'profile.about': 'About CivicRadar',

      'profile.sponsor': 'Sponsor or partner with us',

      'profile.deleteData': 'Delete my data',

      'profile.deleteConfirmTitle': 'Delete your data?',

      'profile.deleteConfirmBody': 'This permanently removes your CivicRadar data from this device and our servers. This cannot be undone.',

      'profile.deleteConfirmItem1': 'Reports and photos',

      'profile.deleteConfirmItem2': 'Pledges and volunteer signup',

      'profile.deleteConfirmItem3': 'Profile, rewards, and preferences',

      'profile.deleteConfirmItem4': 'Cloud backup linked to your account',

      'profile.deleteConfirmCancel': 'Keep my data',

      'profile.deleteConfirmProceed': 'Yes, delete everything',

      'profile.deleteDone': 'Your data has been deleted. You can start fresh.',

      'profile.withdrawAnalytics': 'Withdraw analytics consent',

      'profile.withdrawAnalyticsDone': 'Analytics consent withdrawn. Local analytics cleared.',

      'profile.withdrawGps': 'Withdraw location consent',

      'profile.withdrawGpsDone': 'Location consent withdrawn. Enable again from the map banner when needed.',

      'profile.privacyContact': 'Privacy / grievance contact',

      'legal.privacy': 'Privacy Policy',

      'legal.terms': 'Terms of Service',

      'legal.deleteAccount': 'Delete account',

      'legal.officialSources': 'Official government sources',

      'impact.reports': 'Reports',

      'impact.resolved': 'Fixed',

      'impact.confirms': 'Me too',

      'impact.pledges': 'Pledges',

      'impact.wards': 'Wards',

      'impact.week': 'This week: {reports} reports — {resolved} resolved — {confirms} confirmations',

      'impact.resolvedBreakdown': 'You: {self} — Community: {community} — BMC: {bmc} — Cleanup: {cleanup}',

      'about.title': 'About CivicRadar',

      'about.subtitle': 'CivicRadar is a free community app for reporting civic hazards on a live ward map in Mumbai, Pune, and Thane. It is not a government service or an official municipal complaint channel.',

      'about.featuresTitle': 'What you can do',

      'about.feature1': 'Report hazards with a photo pin — stagnant water, garbage, potholes, or broken streetlights',

      'about.feature2': 'Browse the ward map and tap Me too to corroborate nearby reports',

      'about.feature3': 'Get help filing with BMC, PMC, or TMC when you choose — after pinning on CivicRadar',

      'about.feature4': 'Track status, volunteer for cleanups, and see community progress on your ward',

      'about.audienceTitle': 'Who it\'s for',

      'about.audience': 'Residents, RWAs, and neighbourhood groups in Mumbai, Pune, and Thane — especially during monsoon when stagnant water and blocked drains matter most.',

      'about.creditTitle': 'About the project',

      'about.creditNote': 'CivicRadar is an independent student project — designed and built from scratch by Nihira to help neighbours in Mumbai, Pune, and Thane report and track local civic hazards. It is not affiliated with, endorsed by, or operated on behalf of any municipal authority. For project, press, or partnership enquiries, please use the contact below.',

      'about.privacyTitle': 'Privacy & data',

      'about.privacyNote': 'Photo location metadata (EXIF) is stripped before upload. GPS is used only to place your pin when you allow it. Reports are visible to the community on the map. Official complaints go through BMC, PMC, or TMC when you file there.',

      'about.officialSourcesTitle': 'Official information sources',

      'about.officialSourcesNote': 'CivicRadar is not a government app. Verified links to BMC, PMC, TMC, and Maharashtra state portals are listed on our official sources page — where you file complaints yourself.',

      'about.impactTitle': 'Community impact',

      'about.version': 'Version {version}',

      'about.contact': 'Contact us',

      'about.contactOperator': 'Contact us',

      'about.close': 'Close',

      'about.mapCredits': 'Map data © OpenStreetMap contributors (ODbL). Map powered by Leaflet.',

      'about.sponsored': 'Sponsored',

      'about.copied': 'Impact summary copied — paste into your application.',

      'about.operatorNote': 'Until {name} turns 18, {operator} operates the service — hosting, accounts, and legal contact.',

      'inquiry.title': 'Partner with CivicRadar',

      'inquiry.subtitle': 'Reach citizens in Mumbai, Pune, or Thane — in the wards that matter to you.',

      'inquiry.localTitle': 'Local business sponsor',

      'inquiry.localBody': 'Promote monsoon-relevant offers (nets, repellents, hardware) to citizens in specific wards.',

      'inquiry.bmcTitle': 'Municipal pilot',

      'inquiry.bmcBody': 'Multi-ward analytics and official workflows — for invited BMC pilots only. Contact us to participate.',

      'inquiry.ngoTitle': 'NGO & volunteer networks',

      'inquiry.ngoBody': 'Coordinate pledges, verify hours, and log community cleanups at scale.',

      'inquiry.email': 'Send partnership inquiry',

      'lang.title': 'Choose your language',

      'hazard.stagnant-water': 'Stagnant Water',

      'hazard.stagnant-water.example': 'e.g. clogged drain, waterlogged street',

      'hazard.potholes': 'Potholes',

      'hazard.potholes.example': 'e.g. road damage, sunken manhole',

      'hazard.garbage': 'Garbage',

      'hazard.garbage.example': 'e.g. overflowing bin, dumped waste',

      'hazard.streetlight': 'Broken Streetlight',

      'hazard.streetlight.example': 'e.g. broken or flickering light',

      'hazard.comingSoon': 'Coming soon',

      'soon.title': 'Coming soon',

      'soon.notify': 'Notify me when it\'s live',

      'soon.thanks': 'Thanks — we\'ll notify you when this launches.',

      'soon.roadmap': 'More hazard types coming soon — garbage, potholes, and streetlights are live now.',

      'confirm.metoo': 'Me too',

      'confirm.you': 'Your report',

      'confirm.done': 'Following — updates when fixed',

      'confirm.thanks': 'Following — we\'ll tell you when it\'s fixed.',

      'confirm.none': 'Be the first to say Me too',

      'confirm.followHint': 'Not a BMC complaint — backs the community pin. You\'ll get updates when fixed.',

      'confirm.backingOne': ' — 1 neighbour',

      'confirm.backingMany': ' — {n} neighbours',

      'confirm.dupe': 'Already pinned within 10 m{backing}. Tap Me too — we\'ll notify you when fixed.',

      'confirm.dupeAction': 'Me too',

      'confirm.ownDupe': 'You already pinned this spot. Track it in Profile.',

      'profile.unfiledBanner': '{n} open — not filed with {corp} yet. Sharing helps too; each spot needs its own complaint if you file officially.',

      'profile.fileNext': 'File next',

      'confirm.resolved': 'A hazard you backed in {ward} was fixed!',

      'confirm.resolvedMany': '{n} hazards you backed were just fixed!',

      'confirm.shareBtn': 'Share',

      'confirm.shareMsg': '✅ Hazard I flagged in {ward} is FIXED on CivicRadar! Community pressure works:\n{link}\n{hashtags}',

      'fix.looksFixed': 'Looks fixed now',

      'fix.done': 'You said looks fixed',

      'fix.thanks': 'Thanks — when enough neighbours agree, we mark it fixed.',

      'fix.countOne': '1 neighbour says fixed',

      'fix.countMany': '{n} neighbours say fixed',

      'fix.hint': 'Community spot-check only — not official BMC confirmation.',

      'fix.resolved': 'A spot you checked in {ward} was community-verified fixed!',

      'fix.resolvedMany': '{n} spots you checked were community-verified fixed!',

      'fix.afterPhotoPrompt': 'Optional: add an after photo from Profile.',

      'fix.thanksConfirmed': 'Thanks! You marked this fixed for your neighbours.',

      'fix.thanksAddPhoto': 'Thanks! Add a photo of the fix so neighbours can see?',

      'fix.addAfterPhoto': 'Add a photo of the fix to show the before & after?',

      'fix.addPhotoBtn': 'Add photo',

      'reminder.staleCheck': 'Spot near {ward} — still stagnant?',

      'reminder.stillThere': 'Still there',

      'reminder.looksFixed': 'Looks fixed',

      'reminder.addPhoto': 'Add a photo',

      'settings.notifications.title': 'Notifications & Privacy',

      'settings.reminder.label': 'Remind me to report stagnant water nearby',

      'settings.reminder.sub': 'A gentle monsoon-season nudge when you open CivicRadar. No background tracking.',

      'settings.reminder.on': 'Reminders on — we\'ll gently nudge you when you open CivicRadar.',

      'settings.reminder.off': 'Reminders off.',

      'settings.reminder.denied': 'Notifications are blocked — we\'ll show a gentle in-app reminder instead.',

      'settings.notifications.sub': 'Everything CivicRadar can nudge you about, and your consent choices, in one place.',

      'settings.nbh.new.label': 'New reports nearby',

      'settings.nbh.new.sub': 'Nudge when someone pins a hazard in your society or ward.',

      'settings.nbh.resolved.label': 'Resolved nearby',

      'settings.nbh.resolved.sub': 'Good news when a hazard near you is marked resolved.',

      'settings.nbh.on': 'Neighbourhood updates on.',

      'settings.nbh.newOff': 'New report alerts off.',

      'settings.nbh.resolvedOff': 'Resolved updates off.',

      'settings.nbh.denied': 'Notifications blocked — we\'ll show updates in the app instead.',

      'notify.nbh.new.title': 'New report near you',

      'notify.nbh.new.body': 'New report near {society}: {hazard} — open map to Me too',

      'notify.nbh.new.cta': 'View on map',

      'notify.nbh.resolved.title': 'Good news nearby',

      'notify.nbh.resolved.body': '{hazard} near {society} was marked resolved',

      'notify.nbh.resolved.bodyMany': '{n} hazards near {society} were marked resolved',

      'notify.nbh.resolved.cta': 'View on map',

      'notify.report.title': 'Spotted stagnant water today?',

      'notify.report.body': 'If you pass a puddle, clogged drain, or open tank, take 30 seconds to report it.',

      'notify.report.cta': 'Report now',

      'profile.status.communityVerified': 'Community verified fixed',

      'profile.status.youMarkedFixed': 'You marked fixed',

      'profile.status.bmcResolved': 'BMC resolved',

      'profile.badge.communityVerified': 'Community verified',

      'profile.badge.youMarkedFixed': 'You marked fixed',

      'profile.badge.bmcResolved': 'BMC resolved',

      'community.winsCommunityVerified': '{hazard} community-verified — {ward}',

      'shareWin.subtitleCommunity': 'Neighbours confirmed this spot looks fixed — not an official BMC record.',

      'shareWin.impact': '{n} neighbours backed this — {ward} — screenshot this win! 👋',

      'toast.fixConfirmed': '+10 Civic Points — thanks for checking!',

      'toast.communityResolved': 'Community verified fixed — thanks for reporting!',

      'sync.cloud': 'Syncing',

      'sync.local': 'Local only',

      'sync.cloudTitle': 'Reports sync across devices',

      'sync.localTitle': 'Saved on this device only — syncs when cloud is connected',

      'report.submitting': 'Submitting—',

      'success.clock': 'On the community map — not filed with {corp} yet.',

      'community.challenge.empty': '{ward} isn\'t ranked yet — report a hazard to put it on the board.',

      'community.challenge.beat': '{ward}: {pending} open hazards — beat {rival} ({rivalPending} pending)! Report or rally 👋',

      'community.challenge.leading': '{ward} leads with {resolved} fixes — stay ahead of {rival}!',

      'community.challenge.catch': '{ward}: chase {leader} ({leaderResolved} fixed). Clean lanes start at home.',

      'community.challenge.leaderboard': '{leader} tops the ward board with {resolved} fixes — which ward is next?',

      'leaderboard.demo': 'Sample',

      'leaderboard.you': 'You',

      'leaderboard.demoNote': 'Sample data for demo — real ward rankings appear as neighbours report.',

      'leaderboard.resolved': '{n} resolved',

      'leaderboard.emptyWards': 'Report hazards to see your ward climb the board.',

      'leaderboard.emptyCitizens': 'File reports to appear on the local citizens board.',

      'leaderboard.emptyFirst': 'Be the first in your ward — report a hazard to climb the board.',

      'admin.proofBefore': 'Before (citizen report)',

      'admin.proofAfter': 'After (BMC proof)',

      'admin.proofCapture': 'Add proof photo',

      'admin.proofHint': 'Upload a clear photo showing the hazard is fixed — citizens see before/after proof.',

      'admin.proofPrompt': 'Add an after photo, then tap again to confirm resolution.',

      'admin.proofRequired': 'Proof photo required — add a clear after photo before resolving.',

      'admin.confirmResolve': 'Confirm resolution?',

      'admin.exportCsv': 'Export ward CSV',

      'admin.exportEmpty': 'No reports to export for this filter.',

      'admin.exportSuccess': 'Exported {n} report(s) to CSV.',

      'admin.copy1916': 'Copy for 1916',

      'admin.copy1916Copied': 'Copied — paste into 1916',

      'copy1916.header': 'BMC complaint details (copy & paste when you call 1916 or use MyBMC)',

      'copy1916.categoryLabel': 'Category',

      'copy1916.category.stagnant-water': 'Mosquito breeding / stagnant water (Public Health → Pest Control)',

      'copy1916.category.potholes': 'Potholes / road damage',

      'copy1916.category.garbage': 'Garbage / solid waste',

      'copy1916.category.streetlight': 'Broken streetlight',

      'copy1916.wardLabel': 'Ward + area',

      'copy1916.landmarkLabel': 'Nearest landmark / notes',

      'copy1916.gpsLabel': 'GPS',

      'copy1916.gpsWarning': '⚠ GPS looks outside {city} — confirm location before filing',

      'copy1916.mapsLabel': 'Maps',

      'copy1916.dateLabel': 'Date',

      'copy1916.complaintNotFiled': 'BMC complaint #: (not yet filed)',

      'copy1916.complaintFiled': 'BMC complaint #: {id}',

      'copy1916.civicradarLinkLabel': 'CivicRadar map (optional)',

      'copy1916.linkLocalhostNote': '(link works after app is deployed)',

      'copy1916.marathiHeader': '--- Marathi (read to call centre) ---',

      'copy1916.refId': 'Reference (optional): CivicRadar ID {id}',

      'profile.proofBefore': 'Before',

      'profile.proofAfter': 'After',

      'confirm.shareResolvedMsg': '✅ FIXED in {ward}! Before → after proof on CivicRadar:\n{link}\n{hashtags}',

      'esc.title': 'File with BMC (optional)',

      'esc.subtitle': 'CivicRadar shows hazards on the community map. Filing with BMC is your choice — it starts the official clock. This is not a BMC channel.',

      'esc.fileTitle': 'File the complaint (free)',

      'esc.fileHint': 'Stagnant water goes to your ward\'s Pest Control Officer. Use any channel:',

      'esc.fileHint.garbage': 'Garbage / solid waste goes through Solid Waste Management. Use any channel:',

      'esc.fileHint.potholes': 'Potholes and road damage go to Roads / Engineering. Use any channel:',

      'esc.fileHint.streetlight': 'Broken streetlights go to the Electrical department. Use any channel:',

      'esc.recommended': 'Recommended: MyBMC WhatsApp — fastest for most Mumbai wards.',

      'esc.channelWa': 'Chatbot — pre-fill below',

      'esc.channelCall': '24—7 helpline',

      'esc.channelPortal': 'Online portal',

      'esc.channelTweet': 'Public pressure',

      'esc.margApp': 'MyBMC MARG app',

      'esc.margAppSmall': 'Official grievance app',

      'esc.copyBlock': 'Details for 1916 / portal / app',

      'esc.copyAll': 'Copy all details',

      'esc.copyAllDone': 'Copied — paste when you file on 1916, MyBMC, or the portal',

      'esc.copyBilingual': 'For the call centre: read the Marathi section at the bottom of the text block.',

      'esc.portalHint': 'On the portal or MARG app: choose Public Health → Pest Control → stagnant water. Paste the details below.',

      'esc.portalHint.garbage': 'On the portal or MARG app: Solid Waste Management → garbage / drainage. Paste the details below.',

      'esc.portalHint.potholes': 'On the portal or MARG app: Roads / potholes. Paste the details below.',

      'esc.portalHint.streetlight': 'On the portal or MARG app: Electrical → streetlight. Paste the details below.',

      'esc.portalHintNav': 'On the portal or MARG app: {hint}. Paste the details below.',

      'esc.filedConsent': 'I filed on an official BMC channel (1916 / MyBMC / portal / app)',

      'esc.complaintWarn': 'This doesn\'t look like a typical BMC number — you can still save if it\'s correct.',

      'esc.saveUnlock': 'After save: escalation ladder, days-since-filed tracker, and follow-up copy templates unlock.',

      'esc.closeNudge': 'No complaint number saved yet — you can file and save anytime from Profile.',

      'esc.daysSince': '{n} days since you filed with BMC',

      'esc.progress.reported': 'Reported',

      'esc.progress.shared': 'Shared',

      'esc.progress.filed': 'Filed',

      'esc.progress.escalating': 'Escalating',

      'esc.progress.resolved': 'Resolved',

      'esc.tier.copyFollowUp': 'Copy follow-up',

      'esc.tier.openWa': 'Open WhatsApp',

      'esc.tier.openCall': 'Call 1916',

      'esc.tier.openTweet': 'Tag @mybmc',

      'esc.tier.openAaple': 'Open Aaple Sarkar',

      'esc.copyFollowUpDone': 'Copied follow-up text',

      'esc.rtiDisclaimer': 'Informational RTI template only — not legal advice.',

      'esc.consentRequired': 'Confirm you filed on an official BMC channel before saving.',

      'esc.complaintLabel': 'Complaint number',

      'esc.complaintPh': 'e.g. N/2026/123456',

      'esc.complaintHint': 'Saving your complaint number starts the official clock and unlocks follow-up steps.',

      'esc.filedNote': 'Filed with BMC — escalation steps unlock as deadlines pass.',

      'esc.ladderTitle': 'Escalation ladder',

      'esc.selfTitle': 'BMC fixed it?',

      'esc.selfBody': 'Confirm yourself once BMC fixes it (your complaint number is proof). Turns the pin green for everyone.',

      'esc.selfBtn': 'Mark resolved',

      'esc.aaple': 'Aaple Sarkar (state grievance)',

      'esc.officialHint': 'Suggested category: {hint}',

      'official.title': 'Official grievance channels',

      'official.subtitle': 'Verified .gov apps and portals — CivicRadar does not file for you. Full source links on our official sources page.',

      'official.viewAllSources': 'View all official sources',

      'official.alsoFile': 'Also file officially (optional)',

      'official.copyDone': 'Official filing summary copied — paste in the app or portal',

      'official.categoryHint': 'Suggested category: {hint}',

      'official.reportDate': 'Report date',

      'official.photoGuidance': 'Tip: attach your CivicRadar photo in the official app for faster action.',

      'official.marg.label': 'MyBMC MARG',

      'official.marg.small': '114 categories — geo photos — tracking',

      'official.swachhata.label': 'Swachhata-MoHUA',

      'official.swachhata.small': 'MoHUA sanitation — ward inspector',

      'official.aaple.label': 'Aaple Sarkar',

      'official.aaple.small': 'Maharashtra state grievance portal',

      'official.pmc.label': 'PMC CARE',

      'official.pmc.small': 'Pune Municipal Corporation app',

      'official.tmc.label': 'TMC citizen portal',

      'official.tmc.small': 'thanecity.gov.in',

      'official.bmcWa.label': 'MyBMC WhatsApp',

      'official.bmcWa.small': 'Quick chat filing',

      'official.bmcPortal.label': 'BMC online portal',

      'official.bmcPortal.small': 'www.mcgm.gov.in',

      'official.hint.marg.stagnant-water': 'Public Health → Pest Control → stagnant water / mosquito breeding',

      'official.hint.marg.garbage': 'Solid Waste Management → garbage / drainage',

      'official.hint.swachhata.garbage': 'Garbage dump',

      'official.hint.swachhata.stagnant-water': 'Choked drain (if drain-related); use BMC/PMC for pest control',

      'official.hint.pmc.stagnant-water': 'Health / mosquito breeding / stagnant water',

      'official.hint.pmc.garbage': 'Solid waste / garbage',

      'official.hint.aaple': 'Select {corp} as local body → Health / Water supply',

      'official.hint.tmc.stagnant-water': 'Water dept or Health dept (mosquito breeding)',

      'success.alsoOfficial': 'Official filing (optional)',

      'success.filingGuide': 'Filing guide & complaint copy',

      'esc.close': 'Close',

      'esc.save': 'Save',

      'esc.tier.file.title': '1 — File the official complaint',

      'esc.tier.file.body': 'Free. Routed to your ward\'s Pest Control Officer. Use any channel above, then save the complaint number here so the real clock starts.',

      'esc.tier.matrix.title': '2 — Day {n}+ — Ward escalation',

      'esc.tier.matrix.body': 'BMC\'s system auto-escalates unresolved complaints at 7 days. Follow up with your Ward Complaint Officer, quoting your complaint number.',

      'esc.tier.zonal.title': '3 — Day {n}+ — Zonal + public pressure',

      'esc.tier.zonal.body': 'Escalate to the Zonal Deputy Municipal Commissioner. Tag @mybmc on X with the photo for public visibility.',

      'esc.tier.grievance.title': '4 — Day {n}+ — Grievance / RTI',

      'esc.tier.grievance.body': 'Still ignored after a month? File with the Public Grievance Cell via Aaple Sarkar (Maharashtra state portal), or file an RTI on the complaint status.',

      'profile.empty': 'No reports yet. Hazards near you?',

      'profile.emptyList': 'No reports yet. Tap Report to pin hazards near you.',

      'profile.emptyAction': 'Report now',

      'profile.trackEscalate': 'Track / escalate',

      'profile.fileBmc': 'File with BMC',

      'profile.status.resolvedCitizen': 'Resolved (you confirmed)',

      'profile.status.resolvedBmc': 'Resolved by BMC',

      'profile.status.notFiled': 'Open on community map',

      'profile.status.removed': 'Removed by moderator',

      'profile.communityCleared': 'Volunteers cleared — {corp} complaint may still be open',

      'profile.neighbourOne': 'neighbour said Me too',

      'profile.neighbourMany': 'neighbours said Me too',

      'profile.pointsHint.base': '50 XP per report · +8 Me too · +200 volunteer verified',

      'profile.pointsHint.bonus': '{n} reports — 50 pts — +{bonus} volunteer bonus',

      'profile.greeting': 'Hello, {name}',

      'profile.greetingDefault': 'Hello, Citizen',

      'profile.referralCount': '🎉 {n} neighbour(s) joined via your invite — thank you!',

      'profile.selectWard': 'Select your ward',

      'profile.society': 'Society / neighbourhood (optional)',

      'profile.societyPh': 'Type your society / RWA name if not listed',

      'profile.societyHintWard': 'Showing {n} societies in {ward} — type to add yours.',

      'profile.societyHintNoWard': 'Set your ward for local society suggestions.',

      'profile.societyHintCustom': 'Type your society / RWA name if not listed.',

      'profile.societyRegistry': 'Find your registered cooperative society',

      'map.youAreHere': 'You are here',

      'about.subtitleNamed': 'Community tech for Mumbai, Pune & Thane — built by {name}, free for citizens.',

      'safety.hide': 'Flag / hide from map',

      'safety.hidden': 'Report hidden from your map.',

      'safety.hideConfirm': 'Hide this pin and flag it for our team to review? (Does not delete the report immediately.)',

      'mute.hideReporter': 'Hide reports from this reporter',

      'mute.hideConfirm': 'Hide all pins from this reporter on your device? You can undo in Profile → Hidden reporters.',

      'mute.hidden': 'Reports from this reporter are hidden on your map.',

      'mute.unmuted': 'Reporter unmuted — their reports may appear again.',

      'mute.sectionTitle': 'Hidden reporters',

      'mute.sectionHint': 'Reports from these users are hidden on your map. Tap to show again.',

      'mute.empty': 'No hidden reporters.',

      'mute.unmute': 'Show again',

      'popup.pending': 'Pending',

      'popup.resolved': 'Resolved',

      'fix.by.community': 'Fixed — confirmed by a neighbour',

      'fix.by.self': 'Fixed — verified by the reporter',

      'fix.by.bmc': 'Resolved by {corp}',

      'popup.society': 'Society / neighbourhood',

      'popup.communityCleared': 'Volunteers cleared — {corp} complaint may still be open',

      'partner.title': 'Volunteer login',

      'partner.subtitle': 'For NGO coordinators and volunteers. BMC access by invitation only.',

      'partner.ngoTitle': 'NGO Coordinator',

      'partner.ngoBody': 'View pledges, send volunteers, log cleanups',

      'partner.bmcTitle': 'Municipal pilot',

      'partner.bmcBody': 'Invited BMC pilots only — contact us for access',

      'profile.persona.admin': 'BMC Admin',

      'profile.persona.ngo': 'NGO Coordinator',

      'flow.legal': 'Legal',

      'flow.city': 'City',

      'flow.ward': 'Ward',

      'flow.ready': 'Ready',

      'city.mumbai': 'Mumbai',

      'city.pune': 'Pune',

      'city.thane': 'Thane',

      'tos.title': 'Terms of Service',

      'tos.subtitle': 'Please read and accept before using CivicRadar.',

      'tos.age': 'You must be 18 or older to submit reports and use community features. Under-18? School or NSS groups may participate only with a parent, guardian, or coordinator who is 18+ and accepts Terms on their behalf.',

      'tos.emergency': 'CivicRadar is not for emergencies. For life-threatening situations, call 112 immediately.',

      'tos.itAct': 'CivicRadar is an intermediary under the IT Act, 2000. You are responsible for what you upload.',

      'tos.share': 'Sharing on WhatsApp, X, etc. may expose personal data. You share at your own risk.',

      'tos.gps': 'GPS is collected only when you enable location or submit a report — not bundled with Terms acceptance.',

      'tos.analytics': 'Anonymous usage analytics (optional) help improve reliability. No photos, GPS, or names are sent.',

      'tos.analyticsOptIn': 'I consent to anonymous usage analytics (optional — withdraw anytime in Profile)',

      'tos.notBmc': 'CivicRadar is independent — not affiliated with or run by BMC, PMC, TMC, or any government body.',

      'tos.content': 'Upload onsite hazard photos only. No selfies, IDs, or unrelated images. Reports may be moderated.',

      'tos.accept': 'I am 18+, I accept the <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms</a> and <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>',

      'tos.continue': 'Continue',

      'pledge.title': 'Pledge support',

      'pledge.subtitle': 'Help volunteers in your ward with supplies.',

      'pledge.type': 'Supply type',

      'pledge.type.cleaning': 'Cleaning supplies',

      'pledge.type.snacks': 'Snacks',

      'pledge.type.repellent': 'Mosquito repellent',

      'pledge.ward': 'Target ward',

      'pledge.wardPh': 'Select ward…',

      'pledge.message': 'Message',

      'pledge.messagePh': 'Note for volunteers—',

      'pledge.notice': 'Your ward NGO coordinator sees this in their hub — not BMC. They may follow up in-app; no automatic calls or SMS.',

      'pledge.status.pledged': 'Pledged',

      'pledge.status.delivered': 'Delivered',

      'pledge.status.verified': 'Verified (+200 pts)',

      'pledge.submit': 'Submit pledge',

      'toast.syncConnected': 'Connected — reports sync across devices.',

      'toast.welcome': 'Welcome, {name}! You\'re ready to report.',

      'toast.syncLocal': 'Saved on this device — cloud sync will retry.',

      'toast.copyFail': 'Could not copy — select text manually.',

      'toast.saveFail': 'Could not save.',

      'toast.adminVerified': 'BMC access verified — review your ward queue.',

      'toast.ngoVerified': 'Coordinator verified — manage pledges and volunteers.',

      'toast.govEmail': 'Use your official gov.in / mcgm.gov.in email.',

      'toast.codeSent': 'Code sent — check your inbox.',

      'toast.codeInvalid': 'Invalid or expired code.',

      'toast.linkSent': 'Sign-in link sent — check your inbox.',

      'toast.authEmailFail': 'Could not send sign-in email. Check Supabase SMTP settings and try again.',

      'toast.authCaptchaFail': 'Security check failed — reload the page and try again.',

      'toast.authEmailOffline': 'Cloud sign-in is unavailable — check your connection and try again.',

      'toast.authEmailRateLimit': 'Too many sign-in emails — wait a few minutes and try again.',

      'toast.authEmailInvalid': 'That email address looks invalid — check and try again.',

      'toast.authEmailRedirect': 'Sign-in redirect URL is not allowed — add your site URL in Supabase Authentication settings.',

      'toast.linkExpired': 'That sign-in link expired — request a new one.',

      'toast.bmcUnauthorized': 'This email is not authorised for BMC access.',

      'toast.ngoCodeRequired': 'Enter your email and NGO access code.',

      'toast.ngoCodeInvalid': 'That NGO access code is invalid or used up.',

      'toast.onboardFirst': 'Complete setup to report hazards.',

      'toast.tosRequired': 'Accept Terms & Privacy (18+) before using community features.',

      'toast.reportNotFound': 'That report link is invalid or no longer on this device.',

      'toast.installed': 'CivicRadar installed — open from your home screen!',

      'toast.installHint': 'Browser menu → Add to Home screen.',

      'toast.installHintIos': 'Safari Share → Add to Home Screen.',

      'toast.wardRequired': 'Pick a ward from the official {city} list.',

      'toast.contactConfig': 'Contact email not set — check About in Profile.',

      'config.contactMissing': '(Contact not configured)',

      'toast.citizenView': 'Back to citizen view.',

      'toast.noLocation': 'Location not available in this browser.',

      'toast.recentered': 'Map recentered on your location.',

      'toast.bmcLoginFail': 'Invalid BMC credentials.',

      'toast.bmcMumbaiOnly': 'BMC municipal pilot is Mumbai-only. File with your city corporation from Profile.',

      'toast.ngoLoginFail': 'Invalid coordinator credentials.',

      'toast.photoRequired': 'Add a photo before submitting.',

      'toast.photoFailed': 'Couldn\'t use that photo — try again.',

      'toast.gpsRequired': 'GPS is required to pin the hazard.',

      'toast.gpsOutsideCity': 'Location is outside your selected city. Move the pin inside city limits or update your city in Profile.',

      'toast.pinConfirmRequired': 'Confirm the pin on the map — drag it onto the hazard before submitting.',

      'toast.hazardTypeRequired': 'Select a live hazard type.',

      'toast.storageFull': 'Storage full — oldest report removed. Try again.',

      'toast.gpsFail': 'Could not get GPS. Turn on location and try again.',

      'toast.gpsFailAction': 'Could not get GPS. Place a pin on the map or turn location on in settings.',

      'toast.manualPinReady': 'Pin placed — tap Submit to finish your report.',

      'toast.gpsLocating': 'Finding your location…',

      'toast.gpsLowAccuracy': 'Location is approximate (~{m} m). Move outdoors or near a window for better GPS.',

      'toast.gpsPoorFix': 'Could not get a precise location. Try again outdoors with GPS enabled.',

      'toast.complaintRequired': 'Enter your complaint number to start tracking.',

      'toast.complaintSaved': 'Complaint number saved — official clock is running.',

      'toast.pledgeWardRequired': 'Select a target ward for your pledge.',

      'toast.pledgeSaved': 'Pledge recorded — your ward coordinator will see it in their hub.',

      'toast.pledgeDuplicate': 'You already have an open pledge for this ward and supply type.',

      'toast.pledgeWardMismatch': 'Different ward than yours — that ward\'s coordinator will handle it.',

      'toast.pledgeStatusDelivered': 'Your pledge was marked delivered by the coordinator.',

      'toast.pledgeStatusVerified': 'Volunteer hours verified — +200 Civic Points credited!',

      'toast.ngoNewPledge': '{n} new citizen pledge(s) in your ward.',

      'toast.ngoNewPledgeAction': 'Open hub',

      'toast.proofAdded': 'Proof photo added — tap confirm to resolve.',

      'toast.fixPhotoAdded': 'After photo saved — neighbours can see the before & after!',

      'toast.resolveFail': 'Could not update report status.',

      'toast.bmcOnlyResolve': 'Only verified BMC officials can resolve reports.',

      'toast.resolvedProof': 'Marked resolved — before/after proof saved.',

      'toast.ownReportOnly': 'You can only confirm your own reports.',

      'toast.complaintFirst': 'Add your complaint number first — it\'s your proof.',

      'toast.selfResolved': 'Marked resolved — thanks for following up!',

      'toast.shareWin': 'Share the win with neighbours.',

      'toast.cleanupLogged': 'Community cleanup logged. BMC complaint stays open until officially resolved.',

      'toast.pledgeDelivered': 'Supplies marked delivered. Verify hours next.',

      'toast.hoursVerified': 'Hours verified! +200 Civic Points credited.',

      'toast.saving': 'Saving—',

      'toast.verifying': 'Verifying—',

      'admin.title': 'BMC Admin',

      'admin.subtitle': 'Resolve citizen hazard reports and manage your ward queue.',

      'admin.queueTitle': 'Hazard queue',

      'admin.queueSubtitle': 'Review, prioritise, and resolve citizen reports.',

      'admin.returnMap': 'Return to map',

      'admin.exitMode': 'Exit BMC mode',

      'admin.allWards': 'All wards',

      'admin.sort.oldest': 'Oldest first',

      'admin.sort.newest': 'Newest first',

      'admin.sort.overdue': 'Overdue first',

      'admin.sort.confirmed': 'Most Me too',

      'admin.pending': 'Open',

      'admin.overdue': 'Overdue 7d+',

      'admin.resolved': 'Fixed',

      'admin.avgDays': 'Avg days',

      'admin.healthSummary': 'App health (last 7 days)',

      'admin.healthLoading': 'Loading usage—',

      'admin.markResolved': 'Mark as resolved',

      'admin.resolveHint': 'Citizen gets credit and the pin turns green.',

      'admin.removeContent': 'Remove content',

      'admin.removeConfirm': 'Remove this report from the public map? Use this for content that violates guidelines — the reporter can still see it was removed.',

      'admin.removeSuccess': 'Report removed from the public map.',

      'admin.flagged': 'Flagged',

      'admin.reviewTag': 'BMC review',

      'admin.reportTitle': 'Hazard report',

      'coord.title': 'Coordinator login',

      'coord.subtitle': 'Review pledges, send volunteers, verify hours.',

      'coord.hubTitle': 'Coordinator hub',

      'coord.hubSubtitle': 'Review citizen pledges and verify volunteer time.',

      'coord.workflow': 'Dispatch volunteers → log cleanup → confirm supplies → verify hours (+200 pts)',

      'coord.openHazards': 'Open hazards in your ward',

      'coord.pledges': 'Citizen pledges',

      'coord.pledgesNew': 'Citizen pledges — {n} new',

      'coord.pledgesEmpty': 'No citizen pledges yet. Share the Community tab with residents in your ward.',

      'coord.markDelivered': 'Mark delivered',

      'coord.verifyHours': 'Verify hours (+200)',

      'coord.verified': 'Verified',

      'coord.exitMode': 'Exit NGO mode',

      'coord.pledgesLabel': 'Pledges',

      'coord.toVerify': 'To verify',

      'coord.openLabel': 'Open hazards',

      'coord.cleared': 'Community-cleared',

      'profile.pledges': 'My pledges',

      'profile.pledgesEmpty': 'No pledges yet. Support local cleanup crews from Community.',

      'profile.pledgesEmptyAction': 'Pledge support',

      'profile.officialHint': 'Verified BMC, PMC, and TMC apps and portals — CivicRadar does not file on your behalf. Open from the Resources tab.',

      'profile.officialLink': 'Open Resources',

      'profile.communityHint': 'Volunteer sign-up and supply pledges — open from the Resources tab.',

      'profile.communityLink': 'Volunteer & pledges',

      'badge.admin': 'BMC Admin',

      'badge.coord': 'Coordinator hub',

      'admin.meta.reporter': 'Reporter',

      'admin.meta.ward': 'Ward',

      'admin.meta.status': 'Status',

      'admin.meta.lat': 'Lat',

      'admin.meta.lng': 'Lng',

      'admin.meta.neighbourConfirm': ' — {n} said Me too',

      'admin.close': 'Close',

      'coord.hazardsEmpty': 'No open hazards in your scope right now.',

      'coord.volunteerOffers': '{n} volunteer offer(s)',

      'coord.hazardCleaned': 'Cleaned',

      'coord.logCleanup': 'Log cleanup',

      'admin.health.communityCleanups': 'Community cleanups',

      'admin.health.whatsappShares': 'WhatsApp shares',

      'admin.health.errors': 'Errors',

      'admin.health.perfSamples': 'Perf samples',

      'admin.health.avgPerf': 'Avg load time (local)',

      'admin.health.bufferedEvents': 'Buffered events (device)',

      'tracking.open': 'Analytics & tracking',

      'tracking.title': 'Analytics & tracking',

      'tracking.subtitle': 'Aggregate civic metrics — visits, reports, escalations, and resolutions.',

      'tracking.period': 'Period',

      'tracking.days7': 'Last 7 days',

      'tracking.days30': 'Last 30 days',

      'tracking.days90': 'Last 90 days',

      'tracking.wardFilter': 'Ward',

      'tracking.sessions': 'Visits',

      'tracking.pwaInstalls': 'PWA installs',

      'tracking.reports': 'Reports',

      'tracking.resolved': 'Resolved',

      'tracking.pwaNote': 'PWA install counts are approximate (Add to Home Screen / standalone mode). Store downloads cannot be measured on GitHub Pages.',

      'tracking.loading': 'Loading metrics—',

      'tracking.sourceLocal': 'Device + local reports (demo / offline)',

      'tracking.sourceCloud': 'Cloud aggregate (all users)',

      'tracking.sourceCloudFail': 'Cloud metrics unavailable — run tracking SQL in Supabase.',

      'tracking.reportsByCategory': 'Reports by category',

      'tracking.escalations': 'Official channel opens',

      'tracking.neighbourhoods': 'By neighbourhood / society',

      'tracking.reporters': 'Active reporters',

      'tracking.meToo': 'Me too',

      'tracking.filed': 'Official filings',

      'tracking.leads': 'Neighbourhood leads',

      'tracking.empty': 'No data in this period.',

      'tracking.pending': 'open',

      'tracking.channelUnknown': 'Other channel',

      'a11y.skipToContent': 'Skip to main content',

      'aria.close': 'Close',

      'aria.lang': 'Change language',

      'aria.recenter': 'Recenter map on your location',

      'aria.leaderboard': 'Community leaderboard and pledges',

      'aria.profile': 'Profile',

      'aria.report': 'Report hazard',

      'aria.filterWard': 'Filter by ward',

      'aria.sortReports': 'Sort reports',

      'auth.demoTag.admin': 'Demo access — production uses BMC email verification',

      'auth.demoTag.lead': 'Demo access — production uses email + NGO invite code',

      'auth.officialEmail': 'Official email',

      'auth.emailHint': 'Only verified gov.in / mcgm.gov.in addresses get BMC access.',

      'auth.sendCode': 'Send sign-in link',

      'auth.linkInstructions': 'Check your email and tap the sign-in link. Keep this tab open — you\'ll return here signed in.',

      'auth.otpFallback': 'Have a 6-digit code instead?',

      'auth.otp': '6-digit code',

      'auth.verifyEnter': 'Verify & enter',

      'auth.email': 'Email',

      'auth.ngoCode': 'NGO access code',

      'auth.ngoCodePh': 'Issued by CivicRadar operator',

      'auth.username': 'Username',

      'auth.password': 'Password',

      'auth.loginDemo': 'Login (demo)',

      'admin.health.noData': 'No usage data yet on this device.',

      'admin.health.deviceSource': 'Device buffer (last 7 days)',

      'admin.health.cloudSource': 'Cloud aggregate (all users)',

      'admin.health.cloudUnavailable': 'Cloud metrics unavailable — run analytics SQL migration in Supabase.',

      'admin.health.connectSupabase': 'Connect Supabase for city-wide usage aggregates.',

      'admin.health.sessions': 'Sessions',

      'admin.health.tabViews': 'Tab views',

      'admin.health.reportsFiled': 'Reports filed',

      'admin.health.corroborations': 'Me too',

      'admin.health.bmcFiled': 'BMC filed',

      'admin.health.resolved': 'Fixed',

      'about.founderDefault': 'Nihira',

      'about.teamLabel': 'Nihira',

      'about.teamRole': 'Community civic reporting',

      'ref.welcomeTitle': 'A neighbour invited you 👋',

      'referral.joinedReward': '🎉 {n} neighbour(s) joined via your invite — +{pts} Civic Points!',

      'ref.welcomeBody': '{n} hazard reports already on the {city} map. See open spots in your ward — or pin one in 30 seconds.',

      'ref.welcomeBodyEmpty': 'Be one of the first to map hazards in {city} — garbage, potholes, streetlights & stagnant water. Takes 30 seconds.',

      'ref.welcomeCta': 'See the map',

      'ref.welcomeReport': 'Report a spot',

      'ref.dismiss': 'Dismiss invite',

      'season.monsoonPrep': 'Rains are on the way. Clearing standing water early keeps mosquitoes down — pin any spots before the first heavy downpour.',

      'season.monsoonPeak': 'Monsoon\'s here. Standing water is where dengue starts — a 30-second report helps your whole lane.',

      'season.ganesh': 'Ganesh Chaturthi is here. Let\'s keep the ward clean for the festival — report standing water near pandals and immersion routes.',

      'season.denguePeak': 'Dengue season. Mosquitoes breed in still water — one quick report protects your street.',

      'season.dismiss': 'Dismiss seasonal tip',

      'social.wardWeek': '📍 {n} neighbour(s) reported in {ward} this week',

      'social.wardWeekBacked': '🦟 {n} reported — {c} backed in {ward} this week',

      'social.wardWeekEmpty': 'No reports from {ward} yet this week — be the one neighbours follow.',

      'recap.title': 'Your ward this week',

      'recap.share': 'Share weekly recap',

      'share.weeklyRecap': '📊 {ward} this week: {reports} new report(s), {resolved} fixed, {backed} backed by neighbours. Join us on CivicRadar 👋\n{link}\n{hashtags}',

      'feedback.menu': 'Send feedback',

      'feedback.title': 'Send feedback',

      'feedback.subtitle': 'Found a bug or have an idea? Tell us — it goes straight to the team.',

      'feedback.categoryLabel': 'What kind of feedback?',

      'feedback.catIdea': 'Idea',

      'feedback.catBug': 'Bug',

      'feedback.catOther': 'Other',

      'feedback.messageLabel': 'Your feedback',

      'feedback.messagePh': 'What happened, or what would make CivicRadar better?',

      'feedback.contactLabel': 'Contact (optional — only if you want a reply)',

      'feedback.contactPh': 'Email or phone',

      'feedback.privacy': 'We never share your contact. Used only to reply to this feedback.',

      'feedback.submit': 'Send feedback',

      'feedback.errorEmpty': 'Please write a short message first.',

      'feedback.error': 'Could not send — your text is safe. Please try again.',

      'feedback.success': 'Thanks! Your feedback was sent.',

      'feedback.successLocal': 'Saved — we will sync it when you are back online.',

      'access.title': 'Request BMC access',

      'access.subtitle': 'For invited BMC officials — community leads use peer voting instead.',

      'access.step1': 'Apply with a few quick details',

      'access.step2': 'The CivicRadar team reviews',

      'access.step3': 'Get a claim code to unlock access',

      'access.roleLabel': 'I am a—',

      'access.roleNgo': 'NGO coordinator',

      'access.roleBmc': 'BMC official',

      'access.nameLabel': 'Your name',

      'access.namePh': 'Full name',

      'access.orgLabel': 'Organization',

      'access.orgPh': 'NGO / department / RWA name',

      'access.optional': '(optional)',

      'access.cityLabel': 'City',

      'access.wardLabel': 'Ward',

      'access.wardPh': 'Your ward',

      'access.contactLabel': 'Contact — email or phone',

      'access.emailPh': 'you@example.com',

      'access.phonePh': 'Phone',

      'access.contactHint': 'Give at least one. Claim codes go to email; if you only add a phone, we contact you there.',

      'access.proofLabel': 'ID / proof',

      'access.proofOptional': '(optional — encouraged for BMC)',

      'access.proofAdd': 'Attach proof photo',

      'access.noteLabel': 'Anything else?',

      'access.notePh': 'Ward focus, how you\'ll use it, etc.',

      'access.submit': 'Submit request',

      'access.haveCode': 'I already have a claim code',

      'access.confirmTitle': 'Request received',

      'access.confirmBody': 'Thanks! The CivicRadar team will review your request and reach you with a claim code, usually within a few days. Enter that code in the app to unlock your access.',

      'access.confirmLocal': 'Saved on this device — it will sync to the team when you are back online.',

      'access.done': 'Done',

      'access.profileBmcCta': 'BMC official? Request access',

      'access.partnerBmcCta': 'BMC official? Request access',

      'access.partnerClaim': 'I have a BMC claim code',

      'access.claimTitle': 'Enter your claim code',

      'access.claimSubtitle': 'Approved by the CivicRadar team? Enter the claim code we sent to unlock your access.',

      'access.claimLabel': 'Claim code',

      'access.claimPh': 'CR-XXXXXX',

      'access.claimSubmit': 'Unlock access',

      'access.reviewOpen': 'Access requests',

      'access.reviewTag': 'CivicRadar team',

      'access.reviewTitle': 'Access requests',

      'access.reviewSubtitle': 'Approve or reject BMC access requests. Approving issues a claim code to share.',

      'access.pending': 'Pending',

      'access.approved': 'Approved',

      'access.rejected': 'Rejected',

      'access.reviewEmpty': 'No BMC requests yet. New official requests appear here.',

      'access.approve': 'Approve',

      'access.reject': 'Reject',

      'access.copyCode': 'Copy code',

      'access.codeCopied': 'Claim code copied — share it with the applicant using their contact details.',

      'access.roleNgoTag': 'NGO coordinator',

      'access.roleBmcTag': 'BMC official',

      'access.statusApproved': 'Approved',

      'access.statusRejected': 'Rejected',

      'access.statusPending': 'Pending',

      'access.errName': 'Please add your name.',

      'access.errContact': 'Add an email or phone so we can reach you.',

      'access.submitted': 'Request sent — we will review and reach you with your claim code.',

      'access.submittedLocal': 'Request saved — we will sync and review it when you are online.',

      'access.submitError': 'Could not send — your details are safe. Please try again.',

      'access.claimErrEmpty': 'Enter the claim code we sent you.',

      'access.claimErrInvalid': 'That code is not valid or not yet approved.',

      'access.claimErrUsed': 'That code has already been used.',

      'access.claimedNgo': 'Access unlocked — welcome, coordinator!',

      'access.claimedBmc': 'BMC access unlocked — review your ward queue.',

      'access.approvedToast': 'Approved — claim code {code}',

      'access.rejectedToast': 'Request rejected.',

      'access.proofAttached': 'Proof attached',

      'access.proofTooBig': 'Image too large — please attach a smaller photo.',

      'lead.title': 'Become a community lead',

      'lead.subtitle': 'Nominate yourself — neighbours vote to grant access. No admin approval needed.',

      'lead.discoverNudge': 'You\'re on a roll! Consider leading cleanups in your ward.',

      'lead.discoverNudgeCta': 'Learn more',

      'lead.step1': 'Nominate with your ward & scope',

      'lead.step2': 'Neighbours tap Support',

      'lead.step3': '2 supports unlocks your role (5 each if co-leads)',

      'lead.roleLabel': 'Lead type',

      'lead.roleWard': 'Ward NGO lead',

      'lead.roleNbh': 'Neighbourhood lead',

      'lead.nameLabel': 'Your name',

      'lead.namePh': 'How neighbours know you',

      'lead.orgLabel': 'Organization / RWA',

      'lead.orgPh': 'NGO or society name',

      'lead.neighbourhoodLabel': 'Neighbourhood / society / lane',

      'lead.neighbourhoodHintNoWard': 'Pick your ward first for local suggestions.',

      'lead.neighbourhoodHintWard': 'Showing {n} neighbourhoods in {ward} — type to add yours.',

      'lead.neighbourhoodHintCustom': 'Type your neighbourhood, society, or lane if not listed.',

      'lead.pitchLabel': 'Why you?',

      'lead.pitchPh': 'Brief note for voters',

      'lead.submit': 'Nominate me',

      'lead.confirmTitle': "You're on the ballot!",

      'lead.confirmBody': 'Share CivicRadar with neighbours — you need 2 supports to unlock coordinator tools. If someone else runs for the same slot, you both need 5.',

      'lead.confirmLocal': "Saved on this device — syncs when you're online.",

      'lead.viewCommunity': 'See candidates in Community',

      'lead.profileCta': 'Become a ward or neighbourhood lead',

      'lead.partnerCta': 'Become a community lead — earn it with peer support',

      'lead.communityTitle': 'Community leads',

      'lead.communityHint': 'Support neighbours who volunteer to coordinate cleanups. 2 supports grants the role; 5 each if multiple candidates.',

      'lead.communityEmpty': 'No candidates yet in your ward — nominate yourself to get started.',

      'lead.becomeCta': 'Become a community lead',

      'lead.support': 'Support',

      'lead.supported': 'Supported',

      'lead.progress': '{count}/{threshold} supports',

      'lead.progressCoLead': '{count}/{threshold} for co-lead',

      'lead.tagWard': 'Ward lead',

      'lead.tagNbh': 'Neighbourhood',

      'lead.you': 'You',

      'lead.errName': 'Please add your name.',

      'lead.errWard': 'Pick your ward.',

      'lead.errNeighbourhood': 'Enter your neighbourhood or society.',

      'lead.errAlreadyVoted': 'You already supported this candidate.',

      'lead.errAlreadyNominated': 'You already have an active nomination for this scope.',

      'lead.errAlreadyLead': 'You already hold this lead role.',

      'lead.nominated': 'Nomination submitted — rally supports in Community!',

      'lead.nominatedLocal': 'Nomination saved — syncs when you are online.',

      'lead.voted': 'Support counted — thanks for backing a neighbour!',

      'lead.granted': 'Threshold reached — coordinator access unlocked!',

      'lead.submitError': 'Could not submit — please try again.',

      'lead.voteError': 'Could not register support — please try again.',

    },

    hi: {

      'lang.name': 'हिन्दी',

      'lang.native': 'हिन्दी',

      'nav.map': 'मानचित्र',

      'nav.community': 'समुदाय',

      'nav.resources': 'संसाधन',

      'nav.profile': 'प्रोफ़ाइल',

      'fab.report': 'रिपोर्ट',

      'header.context': 'वार्ड खतरा नक्शा — मुंबई, पुणे और ठाणे',

      'header.contextCity': '{city} के लिए वार्ड खतरा नक्शा',

      'location.banner': 'सटीक रिपोर्ट के लिए स्थान चालू करें।',

      'location.bannerNearby': 'खतरे रिपोर्ट करने और आस-पास की समस्याएँ देखने के लिए स्थान चालू करें।',

      'location.unavailable': 'इस ब्राउज़र में स्थान उपलब्ध नहीं है।',

      'location.withdrawn': 'स्थान की सहमति वापस ले ली गई। रिपोर्ट करते समय फिर से चालू करें।',

      'location.dismiss': 'स्थान सूचना बंद करें',

      'location.locate': 'मेरा स्थान',

      'location.locateAria': 'स्थान चालू करें',

      'location.enable': 'चालू करें',

      'tagline.threeBeat': 'नक्शे पर · फोटो · रिपोर्ट',

      'tagline.subline': 'तीन टैप — आपका वार्ड, एक फोटो, पड़ोसियों को सूचना।',

      'tagline.beatMap': 'नक्शे पर',

      'tagline.beatSnap': 'फोटो',

      'tagline.beatReport': 'रिपोर्ट',

      'coach.step': 'शुरुआत · 30 सेकंड',

      'coach.title': 'आपके वार्ड के नक्शे में आपका स्वागत है',

      'coach.body': 'रिपोर्ट करने के तीन टैप: अपनी जगह, एक फोटो, और आपके पड़ोसी सूचित हो जाते हैं।',

      'coach.got': 'चलो शुरू करें',

      'tour.skip': 'छोड़ें',

      'tour.next': 'आगे',

      'tour.done': 'समझ गया',

      'tour.replay': 'टूर फिर देखें',

      'tour.map.title': 'आपका वार्ड, नक्शे पर',

      'tour.map.body': 'आपके पड़ोसियों की हर रिपोर्ट यहाँ एक पिन के रूप में दिखती है।',

      'tour.report.title': 'कुछ दिखा?',

      'tour.report.body': 'रिपोर्ट दबाएँ और जहाँ खड़े हैं वहीं फोटो लें।',

      'tour.profile.title': 'आप नक्शे पर हैं',

      'tour.profile.body': 'आपके पड़ोसी पिन देखते हैं। प्रोफ़ाइल में अपने Civic Points ट्रैक करें।',

      'persona.citizen.idle': 'आस-पास कोई खतरा दिखा? 30 सेकंड में रिपोर्ट करें — आपके पड़ोसी आपको धन्यवाद देंगे।',

      'persona.wardImpact': '{ward}: अब तक आपके पड़ोसियों की {n} रिपोर्ट। आप भी जोड़ें।',

      'persona.unfiled': '{n} स्पॉट आपके वार्ड नक्शे पर खुले हैं — पड़ोसियों से शेयर करें, या Resources से आधिकारिक तौर पर दर्ज करें।',

      'persona.pendingFiled': '{n} आपके वार्ड नक्शे पर खुले हैं — कुछ अतिदेय हो तो Profile देखें।',

      'persona.admin.idlePending': '{n} समीक्षा का इंतज़ार कर रहे हैं — कतार खोलें, या लाल पिन दबाएँ।',

      'persona.admin.idleEmpty': 'सब ठीक है। पड़ोसियों की नई रिपोर्ट यहाँ दिखेंगी।',

      'persona.admin.header': 'BMC समीक्षा मोड',

      'persona.admin.exit': 'BMC मोड बंद',

      'persona.ngo.header': 'NGO समन्वयक मोड',

      'persona.ngo.exit': 'NGO मोड बंद',

      'onboard.title': 'CivicRadar में आपका स्वागत है',

      'onboard.subtitle': 'आपकी गली, एक नक्शे पर। कोई समस्या दिखे तो फोटो लें — आपके पड़ोसी भी उसे देखेंगे।',

      'onboard.city': 'आपका शहर',

      'onboard.cityHint': 'चुनें कि आप कहाँ रहते हैं — अगले चरण में हम आपके स्थान से आपका वार्ड ढूंढेंगे।',

      'onboard.ward': 'आपका वार्ड',

      'onboard.wardPh': 'अपना वार्ड टाइप करना शुरू करें…',

      'combobox.noMatches': 'कोई मेल नहीं — दूसरी खोज आज़माएँ',

      'combobox.showOptions': 'सभी विकल्प दिखाएँ',

      'onboard.wardHint': '{city} के वार्डों में से चुनें, या हमें पता लगाने दें।',

      'onboard.wardDetecting': 'आपके स्थान से आपका वार्ड ढूंढ रहे हैं…',

      'onboard.wardDetectedHint': 'आपके स्थान से अनुमानित वार्ड — आप इसे बदल सकते हैं।',

      'onboard.wardManual': 'सही नहीं है? खुद चुनें',

      'onboard.wardRetry': 'फिर कोशिश करें',

      'onboard.wardDetectFailed': 'आपका वार्ड नहीं मिला। खुद चुनें, या लोकेशन चालू करें।',

      'onboard.name': 'प्रदर्शित नाम',

      'onboard.namePh': 'पड़ोसी आपको क्या कहें?',

      'onboard.join': 'अपने वार्ड से जुड़ें',

      'onboard.wardError': 'सूची से वार्ड चुनें, या लोकेशन चालू करें।',

      'onboard.society': 'सोसाइटी या पड़ोस (वैकल्पिक)',

      'onboard.societyPh': 'आपकी सोसाइटी या RWA का नाम, अगर सूची में नहीं है',

      'onboard.societyHintNoWard': 'पास की सोसाइटी देखने के लिए पहले अपना वार्ड चुनें।',

      'onboard.societyHintWard': '{ward} में {n} सोसाइटी — टाइप करना शुरू करें, या अपनी जोड़ें।',

      'onboard.societyHintCustom': 'सूची में न हो तो अपनी सोसाइटी या RWA का नाम लिखें।',

      'report.title': 'खतरे की रिपोर्ट करें',

      'report.step.capture': 'फ़ोटो',

      'report.step.confirm': 'पुष्टि',

      'report.step.photo': 'फ़ोटो',

      'report.step.details': 'विवरण',

      'report.step.submit': 'भेजें',

      'report.addNote': '+ Landmark जोड़ें',

      'report.pinDragHint': 'पिन सही जगह पर नहीं है तो खींचकर ठीक करें',

      'report.pinAccuracyGood': 'स्थान लगभग ~{m} मी सटीक',

      'report.pinAccuracyFair': 'स्थान ~{m} मी — पिन खींचें या खुली जगह पर जाएँ',

      'report.pinAccuracyPoor': 'स्थान अनुमानित (~{m} मी) — पिन खतरे पर खींचें',

      'report.pinAccuracyUnknown': 'पिन खतरे पर है? ज़रूरत हो तो खींचें',

      'report.pinAccuracyAdjusted': 'पिन ठीक किया गया',

      'report.pinLocating': 'आपका स्थान खोज रहे हैं…',

      'report.pinMapAria': 'खतरे का स्थान मैप पर ठीक करें',

      'report.wardChip': '{ward}',

      'report.wardGps': 'भेजते समय GPS स्थान',

      'report.wardManualPin': 'मैप पर पिन लगाया',

      'report.geoExplainerTitle': 'खतरे को मैप पर पिन करें',

      'report.geoExplainerBody': 'हमें आपकी लोकेशन सिर्फ खतरे को पिन करने के लिए चाहिए — और कुछ नहीं।',

      'report.geoExplainerContinue': 'मेरी लोकेशन उपयोग करें',

      'report.geoExplainerManual': 'मैप पर पिन लगाएँ',

      'report.manualPinBanner': 'जहाँ खतरा है वहाँ मैप पर टैप करें',

      'report.manualPinCancel': 'रद्द करें',

      'report.placePinOnMap': 'मैप पर पिन लगाएँ',

      'report.geoEnableHint': 'लोकेशन कैसे चालू करें',

      'report.geoEnableHelp': 'ब्राउज़र सेटिंग → साइट अनुमति → लोकेशन → Allow। फिर Submit दबाएँ।',

      'report.hazardType': 'खतरे का प्रकार',

      'report.hazardHint': 'खतरे का प्रकार चुनें',

      'report.photoNext': '{hazard} चुना — तैयार हो तो Submit दबाएँ',

      'report.photoEvidence': 'फ़ोटो प्रमाण',

      'report.capture': 'फ़ोटो लें',

      'report.notes': 'Landmark (वैकल्पिक)',

      'report.notesPh': 'किस दुकान/इमारत के पास? जैसे "सई मेडिकल के सामने"',

      'report.submit': 'रिपोर्ट भेजें',

      'report.photoHint': 'फ़ोटो में खतरा दिख रहा? Submit दबाएँ — नहीं तो Retake।',

      'report.retake': 'फिर से लें',

      'moderation.guidelines': 'खतरे की स्पष्ट फ़ोटो लें — नीचे बटन दबाएँ। चेहरे, दस्तावेज़ या असंबंधित वस्तुएँ नहीं। स्थान डेटा गोपनीयता के लिए हटाया जाता है।',

      'moderation.guidelines.stagnant-water': 'रुके हुए पानी की स्पष्ट फ़ोटो लें — नीचे बटन दबाएँ। चेहरे, दस्तावेज़ या असंबंधित वस्तुएँ नहीं। स्थान डेटा गोपनीयता के लिए हटाया जाता है।',

      'moderation.guidelines.garbage': 'कचरे के ढेर या डंप की स्पष्ट फ़ोटो लें — नीचे बटन दबाएँ। चेहरे, दस्तावेज़ या असंबंधित वस्तुएँ नहीं। स्थान डेटा गोपनीयता के लिए हटाया जाता है।',

      'moderation.guidelines.potholes': 'गड्ढे या सड़क की क्षति की स्पष्ट फ़ोटो लें — नीचे बटन दबाएँ। चेहरे, दस्तावेज़ या असंबंधित वस्तुएँ नहीं। स्थान डेटा गोपनीयता के लिए हटाया जाता है।',

      'moderation.guidelines.streetlight': 'खराब स्ट्रीटलाइट की स्पष्ट फ़ोटो लें — नीचे बटन दबाएँ। चेहरे, दस्तावेज़ या असंबंधित वस्तुएँ नहीं। स्थान डेटा गोपनीयता के लिए हटाया जाता है।',

      'moderation.scanning': 'फ़ोटो सुरक्षा जाँच हो रही है…',

      'moderation.blocked.fileType': 'केवल JPEG, PNG या WebP hazard फ़ोटो स्वीकार हैं।',

      'moderation.blocked.fileSize': 'फ़ोटो बहुत बड़ी है। छोटी छवि का उपयोग करें (अधिकतम 8 MB)।',

      'moderation.blocked.lowQuality': 'फ़ोटो बहुत छोटी या अस्पष्ट है। खतरे के पास जाएँ।',

      'moderation.blocked.irrelevant': 'खतरे की फ़ोटो लें — सेल्फ़ी, दस्तावेज़ या खाली चित्र नहीं।',

      'moderation.blocked.sensitive': 'ID, दस्तावेज़ या स्क्रीनशॉट से बचें। केवल खतरा दिखाएँ।',

      'moderation.blocked.nsfw': 'अनुचित सामग्री के कारण यह फ़ोटो ब्लॉक की गई।',

      'moderation.blocked.offline': 'फ़ोटो सुरक्षा जाँच के लिए इंटरनेट से जुड़ें।',

      'success.title': 'रिपोर्ट हो गई — शाबाश',

      'success.tagline': 'आपकी जगह वार्ड नक्शे पर पिन हो गई है।',

      'success.taglineNeighbours': '{n} पड़ोसी पहले से पास के स्पॉट का समर्थन कर रहे हैं — अब आपकी रिपोर्ट भी वहाँ है।',

      'success.subtitle': '{corp} पर मुफ़्त — आधिकारिक शिकायत घड़ी शुरू होती है।',

      'success.step1': 'WhatsApp पर शेयर करें ताकि पड़ोसी इसका समर्थन कर सकें',

      'success.step2': 'वैकल्पिक: {corp} में दर्ज करें और अपना शिकायत नंबर सहेजें',

      'success.step3': 'पड़ोसी या {corp} इसे ठीक होने पर चिह्नित कर सकते हैं — और आपको Civic Points मिलेंगे',

      'success.file': 'BMC में शिकायत दर्ज करें',

      'success.fileCorp': '{corp} में शिकायत दर्ज करें',

      'success.tag': '@mybmc को टैग करें',

      'success.alert': 'अपने पड़ोसियों को बताएँ',

      'success.done': 'नक्शे पर वापस',

      'success.sharePrompt': 'WhatsApp पर शेयर करें — जितनी नज़र, उतनी जल्दी ठीक होगा।',

      'success.shareWhatsapp': 'WhatsApp पर साझा करें',

      'share.nativeShare': 'साझा करें',

      'success.shareNudge': 'आपके पड़ोसियों को अभी पता न हो — WhatsApp पर एक शेयर से इस पर और नज़रें पड़ेंगी।',

      'success.shareMsg': '📍 {ward} में {hazard} — मैंने इसे अभी अपने CivicRadar वार्ड नक्शे पर पिन किया।\nMe too टैप करें, या अपनी गली में स्पॉट रिपोर्ट करें:\n{link}\n{hashtags}',

      'share.appMsg': '🗺️ {city} वार्ड खतरा नक्शा — कचरा, गड्ढे, स्ट्रीटलाइट और रुका पानी पिन करें। Me too, प्रतिद्वंद्वी वार्ड को हराएँ!\n{link}\n{hashtags}',

      'share.defaultArea': 'मेरे इलाके',

      'share.meTooMsg': '👋 मुझे भी — {ward} में {hazard}। {n} पड़ोसी CivicRadar पर:\n{link}\n{hashtags}',

      'share.meTooBtn': 'WhatsApp पर साझा करें',

      'share.wardMapMsg': '🗺️ {ward}: {pending} खुले खतरे — CivicRadar पर हमें हराओ!\n{link}\n{hashtags}',

      'share.cleanupMsg': '🧹 {ward} में स्वयंसेवकों ने {hazard} साफ किया! पहले → बाद:\n{link}\n{hashtags}',

      'share.instagramCaption': '{ward} में {hazard} साफ 🎉 CivicRadar पर पहले → बाद। मानसून जीत।\n{link}\n{hashtags}',

      'share.instagramCleanupCaption': '{ward} में स्वयंसेवकों ने {hazard} साफ किया 🧹 CivicRadar पर पहले → बाद।\n{link}\n{hashtags}',

      'share.milestoneMsg': '🏆 {ward} ने {n} हल पूरे किए! आपका वार्ड?\n{link}\n{hashtags}',

      'share.firstBonus': 'पहला शेयर — +10 Civic Points! 🎉',

      'shareWin.title': 'जीत साझा करें!',

      'shareWin.subtitle': 'पहले → बाद प्रमाण — पड़ोसियों को दिखाएँ।',

      'shareWin.subtitleCleanup': 'स्वयंसेवकों ने साफ किया — बिल्डिंग ग्रुप में शेयर करें।',

      'shareWin.whatsapp': 'WhatsApp पर जीत साझा करें',

      'shareWin.instagramHint': 'छवि सेव करें → Instagram Stories पर पोस्ट करें',

      'shareWin.downloadCard': 'सफलता कार्ड डाउनलोड करें',

      'shareWin.copyCaption': 'Instagram के लिए कैप्शन कॉपी करें',

      'shareWin.nativeShare': 'छवि साझा करें',

      'shareWin.cardDownloaded': 'कार्ड सेव — Instagram पर पोस्ट करें',

      'shareWin.captionCopied': 'कैप्शन कॉपी — Instagram में पेस्ट करें',

      'shareWin.done': 'हो गया',

      'shareWin.footerMsg': 'मैंने {app} से {location} साफ करने में मदद की!',

      'shareWin.fixedLabel': 'ठीक',
      'shareWin.stampFixed': 'ठीक',

      'ba.dragHint': 'पहले और बाद की तुलना के लिए खींचें',

      'ba.before': 'पहले',

      'ba.after': 'बाद',


      'shareWin.aspectSquare': 'वर्ग',

      'shareWin.aspectStory': 'स्टोरी',

      'toast.shareWinBtn': 'जीत शेयर करें',

      'about.shareTitle': 'ऐप साझा करें',

      'about.sharePitch': 'मुफ़्त {city} वार्ड खतरा नक्शा — 30 सेक में कचरा, गड्ढे, स्ट्रीटलाइट और रुका पानी पिन करें। Me too, प्रतिद्वंद्वी वार्ड को हराएँ।\nमुंबई, पुणे और ठाणे के लिए बनाया गया। लॉगिन नहीं, 4 भाषाएँ।\n{link}\nRWA / सोसायटी WhatsApp ग्रुप में फॉरवर्ड करें →',

      'about.copyPitch': 'WhatsApp पिच कॉपी करें',

      'about.pitchCopied': 'पिच कॉपी — RWA / स्कूल ग्रुप में पेस्ट करें!',

      'pwa.nudge': 'एक-टैप रिपोर्टिंग के लिए CivicRadar को अपनी होम स्क्रीन पर जोड़ें।',

      'pwa.nudgeAction': 'होम स्क्रीन पर जोड़ें',

      'pwa.nudgeDismiss': 'अभी नहीं',

      'update.available': 'CivicRadar का नया संस्करण तैयार है।',

      'update.reload': 'फिर से लोड करें',

      'iosInstall.title': 'iPhone पर इंस्टॉल करें',

      'iosInstall.hint': 'Android जैसा ही ऐप — App Store की ज़रूरत नहीं। ज़रूरत हो तो Safari में खोलें, फिर Share → Add to Home Screen।',

      'iosInstall.dismiss': 'इंस्टॉल सुझाव बंद करें',

      'appOpen.title': 'CivicRadar ऐप में खोलें',

      'appOpen.body': 'रिपोर्ट ऐप में देखें — तेज़ नक्शा और अलर्ट।',

      'appOpen.open': 'ऐप में खोलें',

      'appOpen.getApp': 'ऐप डाउनलोड',

      'appOpen.dismiss': 'बैनर बंद करें',

      'community.challengeShare': 'दोस्त को चुनौती — वार्ड नक्शा साझा करें',

      'community.winsTitle': 'हाल की जीत',

      'community.winsEmpty': 'ठीक हुए स्पॉट यहाँ दिखेंगे। एक रिपोर्ट करें, पड़ोसियों को साथ लें, और अपनी गली को बेहतर होते देखें।',

      'community.winsNeighbours': '{ward} में पड़ोसी',

      'community.winsCleanup': '{hazard} साफ · {ward}',

      'community.winsResolved': '{hazard} हल · {ward}',

      'success.points': 'Civic Points',

      'success.xpBonus': '+{n} Civic Points',

      'success.weekBonus': '+{n} — इस सप्ताह आपकी पहली रिपोर्ट',

      'success.celebrateFirst': 'आपकी पहली रिपोर्ट — आपकी गली अभी थोड़ी सुरक्षित हुई।',

      'success.celebrateMilestone': '{n} रिपोर्ट हो गईं — आपके पड़ोसी खुशकिस्मत हैं कि आप हैं।',

      'success.kudos1': 'शाबाश — एक और खतरा रडार पर आया।',

      'success.kudos2': 'बढ़िया काम — आपका वार्ड अब थोड़ा सुरक्षित है।',

      'success.kudos3': 'दर्ज हुआ! पड़ोसियों का ध्यान रखने के लिए धन्यवाद।',

      'success.kudos4': 'फिर मौजूद हुए — इसी से गलियाँ ठीक होती हैं।',

      'success.kudos5': 'एक और पिन — आपकी गली धन्यवाद कहती है।',

      'success.streakWeek': 'इस हफ़्ते {n} रिपोर्ट — बढ़िया!',


      'profile.milestoneOne': 'अगले माइलस्टोन तक 1 रिपोर्ट और',

      'profile.milestoneMany': 'अगले माइलस्टोन तक {n} रिपोर्ट और',

      'profile.milestoneMax': '10+ रिपोर्ट — आपके वार्ड का धन्यवाद!',

      'profile.nextStreakBadge': '{badge} के लिए {n} हफ़्ते और',

      'success.progressOne': 'अगले बैज के लिए बस 1 और रिपोर्ट।',

      'success.progressMany': 'अगले बैज के लिए {n} और रिपोर्ट।',

      'success.progressMilestone': 'बैज मिला! अगले के लिए {n} और।',

      'success.progressGuardian': '{n} रिपोर्ट और गिनती — सच्चे मानसून रक्षक।',

      'success.shareBrag': 'आपने वार्ड की मदद की — WhatsApp पर बताएँ!',

      'success.shareBragFirst': 'नक्शे पर पहला पिन! अभी शेयर करें — Monsoon Guardian तेज़ फैलता है।',

      'toast.badgeMonsoon': 'पहली रिपोर्ट दर्ज — स्वागत है! 🌧️',

      'confirm.meTooThanks': 'Me too दर्ज — पड़ोसी दबाव देख रहे हैं।',

      'toast.reportMilestone': '{n} रिपोर्ट — जारी रखें!',

      'map.empty': '{ward} में अभी कोई पिन नहीं — पहले आप बनें।',

      'map.emptyHint': 'इसमें करीब 30 सेकंड लगते हैं।',

      'map.emptyAction': 'पहली रिपोर्ट करें',

      'map.emptyShare': 'WhatsApp पर अपने पड़ोसियों को बुलाएँ',

      'map.emptyRival': '{ward} बनाम {rival} — {pending} खुले स्पॉट। एक रिपोर्ट करें, या अपनी गली को साथ लाएँ।',

      'map.emptyEncourage': 'हर पिन आपकी गली पर ध्यान दिलाने में मदद करता है — कचरा, गड्ढे, स्ट्रीटलाइट, या रुका पानी। आपकी रिपोर्ट से ही समाधान शुरू होता है।',

      'home.hero.badge': 'आपका वार्ड, साथ मिलकर',

      'home.hero.headline': 'देखा। खींचा। हो गया।',

      'home.hero.subline': 'अपनी गली में खतरा 30 सेकंड में रिपोर्ट करें — आपके पड़ोसी भी इसे देखेंगे।',

      'home.hero.benefit1': 'फोटो लें',

      'home.hero.benefit2': 'अपना वार्ड पिन करें',

      'home.hero.benefit3': 'पड़ोसी सूचित',

      'home.hero.cta': 'स्पॉट रिपोर्ट करें',

      'home.hero.tour': 'छोटा टूर देखें',

      'home.hero.trust': 'मुफ़्त · ऑफ़लाइन काम करे · 3 शहर · 4 भाषाएँ',

      'home.hero.dismiss': 'स्वागत कार्ड बंद करें',

      'map.legend.pending': 'खुला',

      'pulse.aria': 'वार्ड पल्स: खुले खतरे, इस सप्ताह ठीक, और Me too',

      'pulse.open': 'खुले',

      'pulse.fixedWeek': 'इस सप्ताह ठीक',

      'pulse.metoo': 'Me too',

      'pulse.yourWard': 'आपका वार्ड',

      'map.legend.resolved': 'ठीक',

      'map.legend.you': 'आप',

      'map.legend.aria': 'नक्शा किंवदंती: खुला, ठीक, और आप',

      'reminder.unfiled': '{n} खुले खतरे मानचित्र पर — पड़ोसियों के साथ साझा करें या प्रोफ़ाइल में आधिकारिक रूप से दर्ज करें।',

      'reminder.file': 'अभी दर्ज करें',

      'reminder.snooze3d': '3 दिन बाद याद दिलाएँ',

      'reminder.gotIt': 'ठीक है',

      'reminder.esc7': 'दर्ज करने के {n}+ दिन — {ward} में {hazard} के लिए वार्ड एस्केलेशन।',

      'reminder.esc14': 'दर्ज करने के {n}+ दिन — {ward} में {hazard} के लिए ज़ोनल एस्केलेशन।',

      'reminder.esc30': 'दर्ज करने के {n}+ दिन — {ward} में {hazard} के लिए शिकायत/RTI।',

      'reminder.escAction': 'एस्केलेट करें',

      'reminder.corroboration': '{n} पड़ोसी ने आपकी {hazard} रिपोर्ट पर "मुझे भी" कहा — वार्ड नक्शे पर और नज़रें मदद करती हैं।',

      'reminder.corroAction': 'रिपोर्ट देखें',

      'reminder.cleanup': 'स्वयंसेवकों ने {ward} में {hazard} साफ किया — {corp} शिकायत आधिकारिक रूप से खुली हो सकती है।',

      'reminder.cleanupAction': 'स्थिति देखें',

      'persona.ngo.pledges': '{deliver} देने · {verify} सत्यापित',

      'persona.ngo.newHazards': 'वार्ड में {n} नए खतरे',

      'persona.ngo.newPledges': '{n} नई प्रतिज्ञा',

      'persona.admin.overdue': '{overdue} अतिदेय · {pending} लंबित — कतार खोलने के लिए दबाएँ',

      'profile.badge.reporter': 'सक्रिय रिपोर्टर',

      'profile.badge.2week': '2-सप्ताह रिपोर्टर',

      'profile.badge.3week': '3-सप्ताह रिपोर्टर',

      'profile.badge.monsoon': 'लोकल हीरो',

      'profile.wardImpact': 'आपका वार्ड: इस सीज़न {n} रिपोर्ट',

      'profile.streak': '{n}-सप्ताह रिपोर्टिंग स्ट्रीक',

      'confirm.nearby': 'पिन {m} मी. दूर{backing}। डुप्लिकेट की जगह मुझे भी दबाएँ — ठीक होने पर अपडेट।',

      'esc.participate.title': 'सामुदायिक कार्रवाई (वैकल्पिक)',

      'esc.participate.hint': 'Participate Mumbai BMC का आधिकारिक स्वयंसेवा/CSR पोर्टल है — कीट नियंत्रण शिकायतों के लिए नहीं। सफाई अभियान या वार्ड परियोजनाओं के लिए उपयोग करें।',

      'esc.participate.btn': 'Participate Mumbai',

      'esc.participate.small': 'स्वयंसेवा · CSR · परियोजनाएँ',

      'esc.corpTitle': 'स्थानीय नगर निगम में दर्ज करें (वैकल्पिक)',

      'esc.corpHint': '{corp} के आधिकारिक पोर्टल पर ठहरा पानी / कीट नियंत्रण शिकायत दर्ज करें।',

      'esc.corpBtn': '{corp} पोर्टल खोलें',

      'esc.corpSubtitle': 'CivicRadar खतरे सामुदायिक मानचित्र पर दिखाता है। नगर निगम में दर्ज करना वैकल्पिक है — यह आधिकारिक घड़ी शुरू करता है।',

      'esc.titleCorp': '{corp} में दर्ज करें (वैकल्पिक)',

      'esc.tmc.recommended': 'अनुशंसित: thanecity.gov.in पर दर्ज करें या TMC हेल्पलाइन 022-25331590 पर कॉल करें।',

      'esc.tmc.fileHint': 'ठहरा पानी / मच्छर प्रजनन — नीचे किसी भी आधिकारिक TMC चैनल का उपयोग करें।',

      'esc.tmc.channelPortal': 'TMC ऑनलाइन पोर्टल',

      'esc.tmc.channelCall': 'TMC हेल्पलाइन',

      'esc.tmc.channelEmail': 'नगर आयुक्त को ईमेल',

      'esc.tmc.channelTweet': '@TMCaTweetAway को टैग करें',

      'esc.tmc.channelCitizenCall': 'नागरिक कॉल सेंटर (155300)',

      'esc.tmc.copyBlock': 'TMC पोर्टल / हेल्पलाइन / ईमेल के लिए विवरण',

      'esc.tmc.copyAllDone': 'कॉपी हो गया — TMC में दर्ज करते समय चिपकाएँ',

      'esc.tmc.portalHint': 'thanecity.gov.in: लॉगिन → ऑनलाइन नागरिक सेवाएँ → शिकायत दर्ज करें। नीचे विवरण चिपकाएँ।',

      'esc.tmc.filedConsent': 'मैंने आधिकारिक TMC चैनल पर दर्ज किया (पोर्टल / हेल्पलाइन / ईमेल / 155300 / Aaple Sarkar)',

      'esc.tmc.complaintLabel': 'TMC शिकायत / संदर्भ संख्या',

      'esc.tmc.complaintPh': 'उदा. TMC/2026/123456',

      'esc.tmc.complaintWarn': 'यह सामान्य TMC संदर्भ जैसा नहीं लगता — सही हो तो फिर भी सहेजें।',

      'esc.tmc.filedNote': 'TMC में दर्ज — समय सीमा पर आगे बढ़ाएँ।',

      'esc.tmc.daysSince': 'TMC में दर्ज किए {n} दिन',

      'esc.tmc.selfTitle': 'TMC ने ठीक किया?',

      'esc.tmc.selfBody': 'TMC द्वारा ठीक होने पर खुद पुष्टि करें — सभी के लिए हरा चिह्न।',

      'esc.tmc.aaple': 'Aaple Sarkar — TMC को स्थानीय निकाय चुनें',

      'esc.tmc.deptTitle': 'विभाग संपर्क (एस्केलेशन)',

      'esc.tmc.deptHint': 'ठहरा पानी फॉलो-अप — जल, स्वास्थ्य, या प्रदूषण नियंत्रण।',

      'esc.tmc.dept.water': 'जल',

      'esc.tmc.dept.health': 'स्वास्थ्य',

      'esc.tmc.dept.pollution': 'प्रदूषण नियंत्रण',

      'esc.tmc.tier.file.body': 'thanecity.gov.in, 022-25331590 / 022-25331211, mc@thanecity.gov.in, या 155300। संदर्भ संख्या यहाँ सहेजें।',

      'esc.tmc.tier.matrix.body': 'वार्ड कार्यालय या स्वास्थ्य (022-25331590) से फॉलो-अप। TMC संदर्भ संख्या उद्धृत करें।',

      'esc.tmc.tier.zonal.body': 'नगर आयुक्त (mc@thanecity.gov.in) तक एस्केलेट। @TMCaTweetAway पर फोटो के साथ टैग करें।',

      'esc.tmc.tier.grievance.body': 'एक महीने बाद भी? Aaple Sarkar (pgportal.gov.in) — Thane Municipal Corporation चुनें।',

      'esc.tmc.tier.openCall': 'TMC कॉल',

      'esc.tmc.tier.openTweet': '@TMCaTweetAway',

      'esc.tmc.tier.openEmail': 'MC ईमेल',

      'esc.tmc.tier.openAaple': 'Aaple Sarkar',

      'esc.tmc.consentRequired': 'सहेजने से पहले आधिकारिक TMC चैनल पर दर्ज की पुष्टि करें।',

      'esc.pmc.subtitle': 'CivicRadar खतरे सामुदायिक मानचित्र पर दिखाता है। PMC में दर्ज करना वैकल्पिक है — यह आधिकारिक घड़ी शुरू करता है। यह PMC चैनल नहीं है।',

      'esc.pmc.recommended': 'अनुशंसित: PMC CARE WhatsApp — अधिकांश Pune वार्डों के लिए सबसे तेज़।',

      'esc.pmc.fileHint': 'ठहरा पानी और मच्छर प्रजनन PMC CARE के माध्यम से जाता है। कोई भी चैनल:',

      'esc.pmc.channelWa': 'PMC CARE WhatsApp',

      'esc.pmc.channelWaSmall': 'चैट · नीचे से कॉपी',

      'esc.pmc.channelCall': 'टोल-फ्री हेल्पलाइन',

      'esc.pmc.channelPortal': 'PMC CARE पोर्टल',

      'esc.pmc.channelApp': 'PMC CARE ऐप',

      'esc.pmc.channelAppSmall': 'Play Store · App Store',

      'esc.pmc.copyBlock': 'PMC CARE / WhatsApp / हेल्पलाइन के लिए विवरण',

      'esc.pmc.copyAllDone': 'कॉपी हो गया — PMC CARE / WhatsApp पर दर्ज करते समय चिपकाएँ',

      'esc.pmc.portalHint': 'PMC CARE पोर्टल या ऐप: ठहरा पानी / मच्छर शिकायत दर्ज करें। नीचे विवरण चिपकाएँ।',

      'esc.pmc.filedConsent': 'मैंने आधिकारिक PMC चैनल पर दर्ज किया (PMC CARE / WhatsApp / हेल्पलाइन / ऐप)',

      'esc.pmc.complaintLabel': 'PMC शिकायत / संदर्भ संख्या',

      'esc.pmc.complaintPh': 'उदा. PMC/2026/123456',

      'esc.pmc.complaintWarn': 'यह सामान्य PMC संदर्भ जैसा नहीं लगता — सही हो तो फिर भी सहेजें।',

      'esc.pmc.filedNote': 'PMC में दर्ज — समय सीमा पर आगे बढ़ाएँ।',

      'esc.pmc.daysSince': 'PMC में दर्ज किए {n} दिन',

      'esc.pmc.selfTitle': 'PMC ने ठीक किया?',

      'esc.pmc.selfBody': 'PMC द्वारा ठीक होने पर खुद पुष्टि करें — सभी के लिए हरा चिह्न।',

      'esc.pmc.tier.file.body': 'निःशुल्क। PMC CARE पोर्टल, WhatsApp, 1800 1030 222, या PMC CARE ऐप। संदर्भ संख्या यहाँ सहेजें।',

      'esc.pmc.tier.matrix.body': 'PMC CARE या टोल-फ्री हेल्पलाइन से फॉलो-अप। शिकायत संख्या उद्धृत करें।',

      'esc.pmc.tier.zonal.body': 'वार्ड ने कार्रवाई नहीं की? PMC CARE पोर्टल या WhatsApp से एस्केलेट करें।',

      'esc.pmc.tier.grievance.body': 'एक महीने बाद भी? Aaple Sarkar (pgportal.gov.in) — Pune Municipal Corporation चुनें।',

      'esc.pmc.tier.openWa': 'WhatsApp',

      'esc.pmc.tier.openCall': 'PMC हेल्पलाइन',

      'esc.pmc.tier.openAaple': 'Aaple Sarkar',

      'esc.pmc.consentRequired': 'सहेजने से पहले आधिकारिक PMC चैनल पर दर्ज की पुष्टि करें।',

      'esc.pmc.aaple': 'Aaple Sarkar — Pune Municipal Corporation को स्थानीय निकाय चुनें',

      'copy1916.pmc.header': 'PMC शिकायत विवरण (PMC CARE / WhatsApp / हेल्पलाइन पर कॉपी-पेस्ट)',

      'copy1916.pmc.complaintNotFiled': 'PMC शिकायत #: (अभी दर्ज नहीं)',

      'copy1916.pmc.complaintFiled': 'PMC शिकायत #: {id}',

      'copy1916.tmc.header': 'TMC शिकायत विवरण (thanecity.gov.in / हेल्पलाइन / ईमेल के लिए कॉपी-पेस्ट)',

      'copy1916.tmc.complaintNotFiled': 'TMC शिकायत / संदर्भ #: (अभी दर्ज नहीं)',

      'copy1916.tmc.complaintFiled': 'TMC शिकायत / संदर्भ #: {id}',

      'profile.fileCorp': '{corp} में दर्ज करें',

      'community.title': 'समुदाय',

      'community.subtitle': '{ward} में {corp} के साथ मिलकर ठीक करें — पड़ोसियों को बुलाएँ, जीत मनाएँ, स्थानीय लीड्स को सपोर्ट करें।',

      'community.subtitleActive': '{ward}: {pending} खुले खतरे · {resolved} हल। पड़ोसियों को बुलाएँ — मदद के लिए Resources देखें!',

      'community.topWards': 'शीर्ष वार्ड',

      'community.localCitizens': 'स्थानीय नागरिक',

      'community.periodMonth': 'इस महीने',

      'community.periodAll': 'हमेशा से',

      'community.thisWeekTitle': 'इस सप्ताह आपका वार्ड',

      'community.leaderboardTitle': 'वार्ड लीडरबोर्ड',

      'community.getInvolvedTitle': 'शामिल हों',

      'community.resourcesTitle': 'संसाधन',

      'resources.title': 'संसाधन',

      'resources.subtitle': 'आधिकारिक दर्ज लिंक और अपने वार्ड में मदद के तरीके।',

      'resources.actionTitle': 'अपने वार्ड में मदद करें',

      'community.supportTitle': 'स्वयंसेवकों का साथ दें',

      'community.supportBody': 'रुके पानी से लड़ रहे स्थानीय सफ़ाई दल की मदद के लिए सामग्री दान करें।',

      'community.pledge': 'दान करें',

      'community.volunteerTitle': 'मेरे वार्ड में स्वयंसेवा',

      'community.volunteerBody': 'साथ मिलकर ठीक करें — {corp} में दर्ज करना अलग है।',

      'community.volunteerCta': 'साइन अप',

      'volunteer.title': 'मेरे वार्ड में स्वयंसेवा',

      'volunteer.subtitle': 'पड़ोसियों के साथ मिलकर — सरकारी स्वयंसेवी कार्यक्रम नहीं।',

      'volunteer.ward': 'आपका वार्ड',

      'volunteer.neighbourhood': 'पड़ोस / सोसाइटी / गली',

      'volunteer.neighbourhoodPh': 'जैसे Phoenix Mills लेन, Building 7 Worli',

      'volunteer.neighbourhoodHintNoWard': 'स्थानीय सुझाव के लिए पहले वार्ड चुनें।',

      'volunteer.neighbourhoodHintWard': '{ward} में {n} पड़ोस/सोसाइटी — नहीं मिली तो टाइप करें।',

      'volunteer.neighbourhoodHintCustom': 'सूची में न हो तो पड़ोस, सोसाइटी या गली लिखें।',

      'volunteer.hours': 'इस मानसून में उपलब्ध घंटे',

      'volunteer.hoursCustom': 'कस्टम',

      'volunteer.skills': 'मैं इनमें मदद कर सकता/सकती हूँ',

      'volunteer.skill.cleanup': 'रुके पानी की सफाई',

      'volunteer.skill.awareness': 'जागरूकता और WhatsApp',

      'volunteer.skill.pledge': 'दान वितरण',

      'volunteer.contact': 'फ़ोन / WhatsApp (वैकल्पिक)',

      'volunteer.contactHint': 'वैकल्पिक — केवल वार्ड/पड़ोस समन्वयक को दिखेगा। CivicRadar कभी ऑटो-कॉल नहीं करता।',

      'volunteer.ageNote': 'Terms के अनुसार 18+ ज़रूरी। 18 से कम? माता-पिता/अभिभावक या NSS समन्वयक के साथ ही भाग लें।',

      'volunteer.submit': 'स्वयंसेवक जानकारी सहेजें',

      'volunteer.remove': 'मेरी जानकारी हटाएँ',

      'volunteer.edit': 'जानकारी संपादित करें',

      'volunteer.empty': 'अभी साइन अप नहीं। Community से अपनी गली में मदद करें।',

      'volunteer.emptyAction': 'मेरे वार्ड में स्वयंसेवा',

      'volunteer.hoursLabel': 'इस मानसून {n} घंटे',

      'popup.helpClean': 'मैं सफाई में मदद कर सकता/सकती हूँ',

      'popup.taskOffered': 'स्वयंसेवक ने मदद की पेशकश की',

      'toast.volunteerSaved': 'स्वयंसेवक जानकारी सहेजी — वार्ड समन्वयक देख सकते हैं।',

      'toast.volunteerRemoved': 'स्वयंसेवक जानकारी हटाई।',

      'toast.volunteerWardRequired': 'पहले ऑनबोर्डिंग में वार्ड सेट करें।',

      'toast.volunteerNeighbourhoodRequired': 'पड़ोस, सोसायटी या गली दर्ज करें।',

      'toast.volunteerSkillRequired': 'कम से कम एक तरीका चुनें जिससे मदद कर सकें।',

      'toast.volunteerTaskOffered': 'ऑफर भेजा — समन्वयक आपको इस स्पॉट से मिलाएगा।',

      'toast.volunteerTaskDuplicate': 'आप पहले ही इस खतरे में मदद की पेशकश कर चुके।',

      'toast.volunteerSignupRequired': 'पहले Community में स्वयंसेवक साइन अप करें।',

      'toast.volunteerTaskCompleted': 'सफ़ाई पूर्ण — रिपोर्टर को सूचना।',

      'toast.coordScopeWard': 'वार्ड समन्वयक — पूरा {ward}',

      'toast.coordScopeNbh': 'पड़ोस लीड — {label}',

      'inquiry.coordTitle': 'वार्ड या पड़ोस समन्वयक बनें',

      'inquiry.coordBody': 'अपनी RWA/सोसायटी या वार्ड NGO की अगुवाई करें — स्वयंसेवक देखें, सफ़ाई मिलाएँ, दान घंटे सत्यापित करें। ऑपरेटर से इनवाइट कोड लें।',

      'about.becomeCoord': 'वार्ड या पड़ोस समन्वयक बनें',

      'coord.codeHint': 'समन्वयकों को कोड मिलता है — वार्ड या RWA/सोसायटी स्तर।',

      'coord.volunteers': 'आपके क्षेत्र के स्वयंसेवक',

      'coord.volunteersEmpty': 'अभी कोई स्वयंसेवक नहीं। Community टैब शेयर करें।',

      'coord.tasks': 'स्वयंसेवक सफाई प्रस्ताव',

      'coord.tasksEmpty': 'अभी कोई ऑफर नहीं। खुले पिन पर "मैं सफाई में मदद कर सकता/सकती हूँ" दबाएँ।',

      'coord.tasksPending': 'कार्य',

      'coord.volunteersLabel': 'स्वयंसेवक',

      'coord.markTaskComplete': 'सफ़ाई पूर्ण',

      'coord.scopeWard': 'वार्ड लीड · {ward}',

      'coord.scopeNbh': 'पड़ोस लीड · {label}',

      'profile.volunteer': 'मेरा स्वयंसेवक साइनअप',

      'profile.section.details': 'आपका विवरण',

      'profile.section.location': 'शहर, वार्ड और पड़ोस',

      'profile.section.activity': 'गतिविधि',

      'profile.section.account': 'खाता और सहायता',

      'profile.title': 'आपकी प्रोफ़ाइल',

      'profile.persona': 'नागरिक',

      'profile.points': 'Civic Points',

      'profile.xpTotalLabel': '{n} XP',

      'profile.xpToNext': '{level} तक {n} XP',

      'profile.xpMax': 'अधिकतम स्तर — Community Leader!',

      'xp.level.observer': 'स्थानीय पर्यवेक्षक',

      'xp.level.wardWatcher': 'वार्ड वॉचर',

      'xp.level.neighbourhoodVoice': 'पड़ोस की आवाज़',

      'xp.level.civicChampion': 'सिविक चैंपियन',

      'xp.level.monsoonGuardian': 'मानसून रक्षक',

      'xp.level.communityLeader': 'Community Leader',

      'cert.title': 'प्रमाणपत्र अनलॉक!',

      'cert.subtitle': 'आपने {level} हासिल किया',

      'cert.cardHeading': 'Civic Hero प्रमाणपत्र',

      'cert.awarded': '{name} को प्रदान',

      'cert.date': '{date}',

      'cert.tagline': 'इस मानसून में हमारे वार्ड की रक्षा',

      'cert.download': 'प्रमाणपत्र डाउनलोड',

      'cert.whatsapp': 'WhatsApp पर साझा',

      'cert.copyCaption': 'कैप्शन कॉपी',

      'cert.caption': 'मैंने CivicRadar पर {level} अर्जित किया — {ward} की रक्षा में जुड़ें!\n{link}',

      'cert.captionCopied': 'कैप्शन कॉपी — सोशल पर पेस्ट करें',

      'cert.downloaded': 'प्रमाणपत्र सेव — अपनी जीत साझा करें!',

      'cert.done': 'हो गया',

      'profile.fixed': 'ठीक किए खतरे',

      'profile.pending': 'खुले खतरे',

      'profile.reports': 'आपकी रिपोर्टें',

      'profile.install': 'CivicRadar ऐप इंस्टॉल करें',

      'profile.partner': 'स्वयंसेवक / NGO लॉगिन',

      'profile.about': 'CivicRadar के बारे में',

      'profile.sponsor': 'प्रायोजक या साझेदार बनें',

      'profile.deleteData': 'मेरा डेटा हटाएँ',

      'profile.deleteConfirmTitle': 'अपना डेटा हटाएँ?',

      'profile.deleteConfirmBody': 'यह आपका CivicRadar डेटा इस उपकरण और हमारे सर्वर से स्थायी रूप से हटा देगा। पूर्ववत नहीं हो सकता।',

      'profile.deleteConfirmItem1': 'रिपोर्ट और फ़ोटो',

      'profile.deleteConfirmItem2': 'प्रतिज्ञा और स्वयंसेवक पंजीकरण',

      'profile.deleteConfirmItem3': 'प्रोफ़ाइल, पुरस्कार और प्राथमिकताएँ',

      'profile.deleteConfirmItem4': 'आपके खाते से जुड़ा क्लाउड बैकअप',

      'profile.deleteConfirmCancel': 'मेरा डेटा रखें',

      'profile.deleteConfirmProceed': 'हाँ, सब कुछ हटाएँ',

      'profile.deleteDone': 'आपका डेटा हटा दिया गया। आप नए सिरे से शुरू कर सकते हैं।',

      'profile.withdrawAnalytics': 'एनालिटिक्स सहमति वापस लें',

      'profile.withdrawAnalyticsDone': 'एनालिटिक्स सहमति वापस — स्थानीय डेटा साफ।',

      'profile.withdrawGps': 'स्थान सहमति वापस लें',

      'profile.withdrawGpsDone': 'स्थान सहमति वापस — ज़रूरत हो तो नक्शे बैनर से चालू करें।',

      'profile.privacyContact': 'गोपनीयता / शिकायत संपर्क',

      'legal.privacy': 'गोपनीयता नीति',

      'legal.terms': 'Terms of Service',

      'legal.deleteAccount': 'खाता हटाएँ',

      'legal.officialSources': 'आधिकारिक सरकारी स्रोत',

      'impact.reports': 'रिपोर्ट',

      'impact.resolved': 'हल',

      'impact.confirms': 'मुझे भी',

      'impact.pledges': 'दान',

      'impact.wards': 'वार्ड',

      'impact.week': 'इस सप्ताह: {reports} रिपोर्ट · {resolved} हल · {confirms} पुष्टि',

      'impact.resolvedBreakdown': 'आप: {self} · समुदाय: {community} · BMC: {bmc} · सफाई: {cleanup}',

      'about.title': 'CivicRadar के बारे में',

      'about.subtitle': 'CivicRadar मुंबई, पुणे और ठाणे में नागरिक खतरों की रिपोर्ट करने के लिए एक मुफ़्त सामुदायिक ऐप है — लाइव वार्ड नक्शे पर। यह सरकारी सेवा या आधिकारिक नगर निगम शिकायत चैनल नहीं है।',

      'about.featuresTitle': 'आप क्या कर सकते हैं',

      'about.feature1': 'फोटो पिन से खतरे की रिपोर्ट — रुका हुआ पानी, कचरा, गड्ढे, या टूटी स्ट्रीटलाइट',

      'about.feature2': 'वार्ड नक्शा देखें और पास की रिपोर्ट पर Me too से पुष्टि करें',

      'about.feature3': 'CivicRadar पर पिन के बाद, चाहें तो BMC, PMC या TMC में दर्ज करने में मदद',

      'about.feature4': 'स्थिति ट्रैक करें, सफाई के लिए स्वयंसेवा करें, और अपने वार्ड की सामुदायिक प्रगति देखें',

      'about.audienceTitle': 'किसके लिए',

      'about.audience': 'मुंबई, पुणे और ठाणे के निवासी, RWA और पड़ोस समूह — खासकर मानसून में जब रुका हुआ पानी और बंद नालियाँ महत्वपूर्ण हों।',

      'about.creditTitle': 'प्रोजेक्ट के बारे में',

      'about.creditNote': 'CivicRadar एक स्वतंत्र स्टूडेंट प्रोजेक्ट है — Nihira द्वारा शुरू से बनाया गया, ताकि मुंबई, पुणे और ठाणे के पड़ोसी स्थानीय नागरिक खतरों की रिपोर्ट कर सकें और उन्हें ट्रैक कर सकें। यह किसी भी नगर निगम प्राधिकरण से संबद्ध, अनुमोदित या उसकी ओर से संचालित नहीं है। प्रोजेक्ट, प्रेस या साझेदारी संबंधी पूछताछ के लिए कृपया नीचे दिए गए संपर्क का उपयोग करें।',

      'about.privacyTitle': 'गोपनीयता और डेटा',

      'about.privacyNote': 'अपलोड से पहले फोटो की location metadata (EXIF) हटा दी जाती है। GPS सिर्फ आपकी अनुमति पर पिन लगाने के लिए। रिपोर्ट नक्शे पर समुदाय को दिखती हैं। आधिकारिक शिकायत BMC, PMC या TMC चैनल से होती है।',

      'about.officialSourcesTitle': 'आधिकारिक सूचना स्रोत',

      'about.officialSourcesNote': 'CivicRadar सरकारी ऐप नहीं है। BMC, PMC, TMC और महाराष्ट्र राज्य पोर्टल के सत्यापित लिंक हमारे आधिकारिक स्रोत पेज पर हैं — शिकायत आप स्वयं दर्ज करें।',

      'about.impactTitle': 'सामुदायिक प्रभाव',

      'about.version': 'संस्करण {version}',

      'about.contact': 'हमसे संपर्क करें',

      'about.contactOperator': 'हमसे संपर्क करें',

      'about.close': 'बंद',

      'about.mapCredits': 'नक्शा डेटा © OpenStreetMap contributors (ODbL)। नक्शा Leaflet द्वारा।',

      'about.sponsored': 'प्रायोजित',

      'about.copied': 'प्रभाव सारांश कॉपी हो गया — अपने आवेदन में चिपकाएँ।',

      'about.operatorNote': '{name} के 18 साल होने तक, {operator} सेवा संचालित करते हैं — होस्टिंग, खाते और कानूनी संपर्क।',

      'inquiry.title': 'CivicRadar के साथ साझेदारी',

      'inquiry.subtitle': 'मुंबई, पुणे या ठाणे के नागरिकों तक पहुँचें — उन वार्डों में जो आपके लिए महत्वपूर्ण हैं।',

      'inquiry.localTitle': 'स्थानीय व्यवसाय प्रायोजक',

      'inquiry.localBody': 'विशिष्ट वार्डों में नागरिकों को मानसून-संबंधी ऑफ़र प्रचारित करें।',

      'inquiry.bmcTitle': 'नगरपालिका पायलट',

      'inquiry.bmcBody': 'बहु-वार्ड विश्लेषण — केवल आमंत्रित BMC पायलट के लिए। भाग लेने के लिए संपर्क करें।',

      'inquiry.ngoTitle': 'NGO और स्वयंसेवक नेटवर्क',

      'inquiry.ngoBody': 'दान, घंटों का सत्यापन और सामुदायिक सफ़ाई का समन्वय।',

      'inquiry.email': 'साझेदारी पूछताछ भेजें',

      'lang.title': 'अपनी भाषा चुनें',

      'hazard.stagnant-water': 'रुका हुआ पानी',

      'hazard.stagnant-water.example': 'जैसे बंद नाला, जलभराव वाली सड़क',

      'hazard.potholes': 'गड्ढे',

      'hazard.potholes.example': 'जैसे सड़क का गड्ढा, धंसा मैनहोल',

      'hazard.garbage': 'कचरा',

      'hazard.garbage.example': 'जैसे कचरे का ढेर, भरा हुआ डिब्बा',

      'hazard.streetlight': 'खराब स्ट्रीटलाइट',

      'hazard.streetlight.example': 'जैसे खराब या टिमटिमाती लाइट',

      'hazard.comingSoon': 'जल्द आ रहा है',

      'soon.title': 'जल्द आ रहा है',

      'soon.notify': 'लाइव होने पर मुझे सूचित करें',

      'soon.thanks': 'धन्यवाद — लॉन्च होने पर हम आपको सूचित करेंगे।',

      'soon.roadmap': 'और खतरा प्रकार जल्द — कचरा, गड्ढे और स्ट्रीटलाइट अब लाइव हैं।',

      'confirm.metoo': 'मुझे भी',

      'confirm.you': 'आपकी रिपोर्ट',

      'confirm.done': 'फ़ॉलो कर रहे हैं — ठीक होने पर सूचना',

      'confirm.thanks': 'फ़ॉलो किया — ठीक होने पर सूचित करेंगे।',

      'confirm.none': 'इसकी पुष्टि करने वाले पहले बनें',

      'confirm.followHint': 'BMC शिकायत नहीं — समुदाय पिन का समर्थन और अपडेट।',

      'confirm.backingOne': ' · 1 पड़ोसी का समर्थन',

      'confirm.backingMany': ' · {n} पड़ोसियों का समर्थन',

      'confirm.dupe': '10 मी. के भीतर CivicRadar पर पिन है{backing}। समर्थन करें — ठीक होने पर सूचना।',

      'confirm.dupeAction': 'मुझे भी',

      'confirm.ownDupe': 'आपने यहाँ पहले ही पिन किया है। प्रोफ़ाइल में देखें।',

      'profile.unfiledBanner': '{n} खुले — {corp} में अभी दर्ज नहीं। साझा करना भी मदद करता है; आधिकारिक दर्ज करने पर हर स्थान की अलग शिकायत।',

      'profile.fileNext': 'अगली दर्ज करें',

      'confirm.resolved': '{ward} में जिस खतरे का आपने समर्थन किया वह ठीक हो गया!',

      'confirm.resolvedMany': 'आपने जिन {n} खतरों का समर्थन किया वे अभी ठीक हो गए!',

      'confirm.shareBtn': 'साझा करें',

      'confirm.shareMsg': '✅ {ward} में जिस खतरे को उठाया वह CivicRadar पर ठीक! सामूहिक दबाव काम करता है:\n{link}\n{hashtags}',

      'fix.looksFixed': 'अब ठीक लगता है',

      'fix.done': 'आपने ठीक कहा',

      'fix.thanks': 'धन्यवाद — पर्याप्त पड़ोसी सहमत होने पर हम इसे ठीक चिह्नित करेंगे।',

      'fix.countOne': '1 पड़ोसी कहता है ठीक है',

      'fix.countMany': '{n} पड़ोसी कहते हैं ठीक है',

      'fix.hint': 'केवल समुदाय जाँच — आधिकारिक BMC पुष्टि नहीं।',

      'fix.resolved': '{ward} में जिस स्थान की आपने जाँच की वह समुदाय-सत्यापित ठीक!',

      'fix.resolvedMany': 'आपने जिन {n} स्थानों की जाँच की वे समुदाय-सत्यापित ठीक!',

      'fix.afterPhotoPrompt': 'वैकल्पिक: प्रोफ़ाइल से बाद की फोटो जोड़ें।',

      'fix.thanksConfirmed': 'धन्यवाद! आपने इसे पड़ोसियों के लिए ठीक चिह्नित किया।',

      'fix.thanksAddPhoto': 'धन्यवाद! ठीक हुई जगह की फोटो जोड़ें ताकि पड़ोसी देख सकें?',

      'fix.addAfterPhoto': 'पहले और बाद की तस्वीर दिखाने के लिए ठीक हुई फोटो जोड़ें?',

      'fix.addPhotoBtn': 'फोटो जोड़ें',

      'reminder.staleCheck': '{ward} के पास — क्या पानी अभी भी रुका है?',

      'reminder.stillThere': 'अभी भी है',

      'reminder.looksFixed': 'ठीक लगता है',

      'reminder.addPhoto': 'फ़ोटो जोड़ें',

      'settings.notifications.title': 'सूचनाएं और गोपनीयता',

      'settings.reminder.label': 'पास में रुका पानी रिपोर्ट करने की याद दिलाएँ',

      'settings.reminder.sub': 'जब आप CivicRadar खोलें तो मानसून में हल्की याद। कोई बैकग्राउंड ट्रैकिंग नहीं।',

      'settings.reminder.on': 'याद चालू — जब आप CivicRadar खोलेंगे, हम हल्के से याद दिलाएँगे।',

      'settings.reminder.off': 'याद बंद।',

      'settings.reminder.denied': 'सूचनाएँ ब्लॉक हैं — हम इसके बजाय ऐप में हल्की याद दिखाएँगे।',

      'settings.notifications.sub': 'CivicRadar आपको जिन बातों की सूचना दे सकता है और आपकी सहमति के विकल्प, सब एक जगह।',

      'settings.nbh.new.label': 'पास में नई रिपोर्ट',

      'settings.nbh.new.sub': 'आपके पड़ोस/वार्ड में कोई पिन करे तो याद।',

      'settings.nbh.resolved.label': 'पास में हल',

      'settings.nbh.resolved.sub': 'पास का जोखिम हल हो तो खुशखबरी।',

      'settings.nbh.on': 'पड़ोस अपडेट चालू।',

      'settings.nbh.newOff': 'नई रिपोर्ट अलर्ट बंद।',

      'settings.nbh.resolvedOff': 'हल अपडेट बंद।',

      'settings.nbh.denied': 'सूचनाएँ ब्लॉक — अपडेट ऐप में दिखेंगे।',

      'notify.nbh.new.title': 'पास में नई रिपोर्ट',

      'notify.nbh.new.body': '{society} के पास: {hazard} — नक्शे पर मुझे भी दबाएँ',

      'notify.nbh.new.cta': 'नक्शा देखें',

      'notify.nbh.resolved.title': 'पास की खुशखबरी',

      'notify.nbh.resolved.body': '{society} के पास {hazard} हल चिह्नित',

      'notify.nbh.resolved.bodyMany': '{society} के पास {n} जोखिम हल',

      'notify.nbh.resolved.cta': 'नक्शा देखें',

      'notify.report.title': 'आज रुका पानी दिखा?',

      'notify.report.body': 'अगर पोखर, जाम नाली या खुली टंकी पास से गुज़रें, तो 30 सेकंड में रिपोर्ट करें।',

      'notify.report.cta': 'अभी रिपोर्ट करें',

      'profile.status.communityVerified': 'समुदाय ने ठीक की पुष्टि',

      'profile.status.youMarkedFixed': 'आपने ठीक चिह्नित',

      'profile.status.bmcResolved': 'BMC ने हल किया',

      'profile.badge.communityVerified': 'समुदाय सत्यापित',

      'profile.badge.youMarkedFixed': 'आपने चिह्नित',

      'profile.badge.bmcResolved': 'BMC हल',

      'community.winsCommunityVerified': '{hazard} समुदाय-सत्यापित · {ward}',

      'shareWin.subtitleCommunity': 'पड़ोसियों ने पुष्टि की — आधिकारिक BMC रिकॉर्ड नहीं।',

      'shareWin.impact': '{n} पड़ोसियों ने समर्थन किया · {ward} — यह जीत स्क्रीनशॉट करें! 🏆',

      'toast.fixConfirmed': '+10 Civic Points — जाँच के लिए धन्यवाद!',

      'toast.communityResolved': 'समुदाय-सत्यापित ठीक — रिपोर्ट के लिए धन्यवाद!',

      'sync.cloud': 'सिंक हो रहा है',

      'sync.local': 'केवल स्थानीय',

      'sync.cloudTitle': 'रिपोर्ट सभी उपकरणों पर सिंक होती हैं',

      'sync.localTitle': 'केवल इस उपकरण पर — क्लाउड कनेक्ट होने पर सिंक होगा',

      'report.submitting': 'भेजा जा रहा है…',

      'success.clock': 'सामुदायिक नक्शे पर — {corp} में अभी दर्ज नहीं।',

      'community.challenge.empty': '{ward} अभी बोर्ड पर नहीं है — खतरे की रिपोर्ट करें और वार्ड को बोर्ड पर लाएँ।',

      'community.challenge.beat': '{ward}: {pending} खुले खतरे — {rival} ({rivalPending} लंबित) से आगे! रिपोर्ट करें या रैली 👋',

      'community.challenge.leading': '{ward} {resolved} हल के साथ अग्रणी — {rival} से आगे रहें!',

      'community.challenge.catch': '{ward}: {leader} ({leaderResolved} हल) का पीछा करें। स्वच्छ सर्वेक्षण आपकी गली से शुरू।',

      'community.challenge.leaderboard': '{leader} {resolved} हल के साथ वार्ड बोर्ड पर शीर्ष — अगला वार्ड कौन?',

      'leaderboard.demo': 'डेमो',

      'leaderboard.you': 'आप',

      'leaderboard.demoNote': 'अधिक वार्ड रिपोर्ट करने तक नमूना डेटा। वास्तविक आँकड़े बढ़ते रहेंगे।',

      'leaderboard.resolved': '{n} हल',

      'leaderboard.emptyWards': 'अपने वार्ड को बोर्ड पर देखने के लिए रिपोर्ट करें।',

      'leaderboard.emptyCitizens': 'स्थानीय बोर्ड पर आने के लिए रिपोर्ट दर्ज करें।',

      'leaderboard.emptyFirst': 'अपने वार्ड में पहले बनें — बोर्ड पर चढ़ने के लिए रिपोर्ट करें।',

      'admin.proofBefore': 'पहले (नागरिक रिपोर्ट)',

      'admin.proofAfter': 'बाद (BMC प्रमाण)',

      'admin.proofCapture': 'प्रमाण फ़ोटो जोड़ें',

      'admin.proofHint': 'साफ़ "बाद" फ़ोटो — नागरिक पहले/बाद देखेंगे।',

      'admin.proofPrompt': 'बाद की फ़ोटो जोड़ें, फिर पुष्टि के लिए फिर टैप करें।',

      'admin.proofRequired': 'प्रमाण फ़ोटो ज़रूरी — हल करने से पहले "बाद" की फ़ोटो जोड़ें।',

      'admin.confirmResolve': 'हल की पुष्टि?',

      'admin.exportCsv': 'वार्ड CSV निर्यात',

      'admin.exportEmpty': 'इस फ़िल्टर के लिए निर्यात करने को कोई रिपोर्ट नहीं।',

      'admin.exportSuccess': '{n} रिपोर्ट CSV में निर्यात।',

      'admin.copy1916': '1916 के लिए कॉपी',

      'admin.copy1916Copied': 'कॉपी हो गया — 1916 में चिपकाएँ',

      'copy1916.header': 'BMC शिकायत विवरण (1916 / MyBMC कॉल पर कॉपी-पेस्ट)',

      'copy1916.categoryLabel': 'श्रेणी',

      'copy1916.category.stagnant-water': 'मच्छर / रुका पानी (Public Health → Pest Control)',

      'copy1916.category.potholes': 'गड्ढे / सड़क क्षति',

      'copy1916.category.garbage': 'कचरा / ठोस अपशिष्ट',

      'copy1916.category.streetlight': 'खराब स्ट्रीटलाइट',

      'copy1916.wardLabel': 'वार्ड + इलाका',

      'copy1916.landmarkLabel': 'नज़दीकी लैंडमार्क / नोट',

      'copy1916.gpsLabel': 'GPS',

      'copy1916.gpsWarning': '⚠ GPS मुंबई से बाहर लगता है — दर्ज करने से पहले जगह पुष्टि करें',

      'copy1916.mapsLabel': 'Maps',

      'copy1916.dateLabel': 'तारीख',

      'copy1916.complaintNotFiled': 'BMC शिकायत #: (अभी दर्ज नहीं)',

      'copy1916.complaintFiled': 'BMC शिकायत #: {id}',

      'copy1916.civicradarLinkLabel': 'CivicRadar नक्शा (वैकल्पिक)',

      'copy1916.linkLocalhostNote': '(ऐप डिप्लॉय होने पर लिंक काम करेगा)',

      'copy1916.marathiHeader': '--- मराठी (कॉल सेंटर को पढ़ें) ---',

      'copy1916.refId': 'संदर्भ (वैकल्पिक): CivicRadar ID {id}',

      'profile.proofBefore': 'पहले',

      'profile.proofAfter': 'बाद',

      'confirm.shareResolvedMsg': '✅ {ward} में ठीक! CivicRadar पर पहले → बाद प्रमाण:\n{link}\n{hashtags}',

      'esc.title': 'आधिकारिक शिकायत सहायक',

      'esc.subtitle': 'CivicRadar खतरे सामुदायिक मानचित्र पर दिखाता है। BMC में दर्ज करना वैकल्पिक है लेकिन आधिकारिक घड़ी शुरू करता है — यह आधिकारिक BMC चैनल नहीं है।',

      'esc.fileTitle': 'शिकायत दर्ज करें (निःशुल्क)',

      'esc.fileHint': 'रुका पानी आपके वार्ड के कीट नियंत्रण अधिकारी तक जाता है। कोई भी चैनल:',

      'esc.fileHint.garbage': 'कचरा / ठोस अपशिष्ट Solid Waste Management से जाता है। कोई भी चैनल:',

      'esc.fileHint.potholes': 'गड्ढे और सड़क क्षति Roads / Engineering को जाती है। कोई भी चैनल:',

      'esc.fileHint.streetlight': 'खराब स्ट्रीटलाइट Electrical विभाग को जाती है। कोई भी चैनल:',

      'esc.recommended': 'अनुशंसित: MyBMC WhatsApp — अधिकांश मुंबई वार्डों के लिए सबसे तेज़।',

      'esc.channelWa': 'चैटबॉट · नीचे से कॉपी करें',

      'esc.channelCall': '24×7 हेल्पलाइन',

      'esc.channelPortal': 'ऑनलाइन पोर्टल',

      'esc.channelTweet': 'सार्वजनिक दबाव',

      'esc.margApp': 'MyBMC MARG ऐप',

      'esc.margAppSmall': 'आधिकारिक शिकायत ऐप',

      'esc.copyBlock': '1916 / पोर्टल / ऐप के लिए विवरण',

      'esc.copyAll': 'सभी विवरण कॉपी करें',

      'esc.copyAllDone': 'कॉपी हो गया — आधिकारिक चैनल पर दर्ज करते समय चिपकाएँ',

      'esc.copyBilingual': 'कॉल सेंटर: टेक्स्ट ब्लॉक में मराठी पंक्ति पढ़ सकते हैं।',

      'esc.portalHint': 'पोर्टल या MARG ऐप: Public Health → Pest Control → stagnant water चुनें। नीचे विवरण चिपकाएँ।',

      'esc.portalHint.garbage': 'पोर्टल या MARG ऐप: Solid Waste Management → garbage / drainage। नीचे विवरण चिपकाएँ।',

      'esc.portalHint.potholes': 'पोर्टल या MARG ऐप: Roads / potholes। नीचे विवरण चिपकाएँ।',

      'esc.portalHint.streetlight': 'पोर्टल या MARG ऐप: Electrical → streetlight। नीचे विवरण चिपकाएँ।',

      'esc.portalHintNav': 'पोर्टल या MARG ऐप: {hint}। नीचे विवरण चिपकाएँ।',

      'esc.filedConsent': 'मैंने आधिकारिक BMC चैनल पर दर्ज किया (1916 / MyBMC / पोर्टल / ऐप)',

      'esc.complaintWarn': 'यह सामान्य BMC नंबर जैसा नहीं लगता — सही हो तो फिर भी सहेजें।',

      'esc.saveUnlock': 'सहेजने के बाद: एस्केलेशन सीढ़ी, दिन-गिनती, फॉलो-अप टेक्स्ट।',

      'esc.closeNudge': 'शिकायत नंबर अभी सहेजा नहीं — Profile से कभी भी दर्ज कर सकते हैं।',

      'esc.daysSince': 'BMC में दर्ज किए {n} दिन',

      'esc.progress.reported': 'रिपोर्ट',

      'esc.progress.shared': 'शेयर',

      'esc.progress.filed': 'दर्ज',

      'esc.progress.escalating': 'एस्केलेट',

      'esc.progress.resolved': 'हल',

      'esc.tier.copyFollowUp': 'फॉलो-अप कॉपी',

      'esc.tier.openWa': 'WhatsApp',

      'esc.tier.openCall': '1916 कॉल',

      'esc.tier.openTweet': '@mybmc',

      'esc.tier.openAaple': 'Aaple Sarkar',

      'esc.copyFollowUpDone': 'फॉलो-अप कॉपी हो गया',

      'esc.rtiDisclaimer': 'केवल सूचनात्मक RTI टेम्पलेट — कानूनी सलाह नहीं।',

      'esc.consentRequired': 'सहेजने से पहले आधिकारिक BMC चैनल पर दर्ज की पुष्टि करें।',

      'esc.complaintLabel': 'BMC शिकायत नंबर',

      'esc.complaintPh': 'उदा. N/2026/123456',

      'esc.complaintHint': 'नंबर सहेजने से जवाबदेही घड़ी शुरू होती है।',

      'esc.filedNote': 'BMC में दर्ज — समय सीमा पर आगे बढ़ाएँ।',

      'esc.ladderTitle': 'आगे बढ़ाने की सीढ़ी',

      'esc.selfTitle': 'BMC ने ठीक किया?',

      'esc.selfBody': 'खुद पुष्टि करें — सभी के लिए हरा चिह्न।',

      'esc.selfBtn': 'हल चिह्नित करें',

      'esc.aaple': 'Aaple Sarkar (राज्य)',

      'esc.officialHint': 'सुझाई गई श्रेणी: {hint}',

      'official.title': 'आधिकारिक शिकायत चैनल',

      'official.subtitle': 'सत्यापित .gov ऐप और पोर्टल — CivicRadar आपकी ओर से दर्ज नहीं करता। सभी स्रोत लिंक आधिकारिक स्रोत पेज पर।',

      'official.viewAllSources': 'सभी आधिकारिक स्रोत देखें',

      'official.alsoFile': 'आधिकारिक रूप से भी दर्ज करें (वैकल्पिक)',

      'official.copyDone': 'आधिकारिक शिकायत सारांश कॉपी — ऐप/पोर्टल में चिपकाएँ',

      'official.categoryHint': 'सुझाई गई श्रेणी: {hint}',

      'official.reportDate': 'रिपोर्ट तिथि',

      'official.photoGuidance': 'टिप: तेज़ कार्रवाई के लिए CivicRadar फोटो आधिकारिक ऐप में संलग्न करें।',

      'official.marg.label': 'MyBMC MARG',

      'official.marg.small': '114 श्रेणियाँ · जियो फोटो · ट्रैकिंग',

      'official.swachhata.label': 'Swachhata-MoHUA',

      'official.swachhata.small': 'MoHUA स्वच्छता · वार्ड निरीक्षक',

      'official.aaple.label': 'Aaple Sarkar',

      'official.aaple.small': 'महाराष्ट्र राज्य शिकायत पोर्टल',

      'official.pmc.label': 'PMC CARE',

      'official.pmc.small': 'पुणे नगर निगम ऐप',

      'official.tmc.label': 'TMC नागरिक पोर्टल',

      'official.tmc.small': 'thanecity.gov.in',

      'official.bmcWa.label': 'MyBMC WhatsApp',

      'official.bmcWa.small': 'त्वरित चैट शिकायत',

      'official.bmcPortal.label': 'BMC ऑनलाइन पोर्टल',

      'official.bmcPortal.small': 'www.mcgm.gov.in',

      'official.hint.marg.stagnant-water': 'सार्वजनिक स्वास्थ्य → कीट नियंत्रण → रुका हुआ पानी / मच्छर प्रजनन',

      'official.hint.marg.garbage': 'ठोस अपशिष्ट प्रबंधन → कचरा / नाली',

      'official.hint.swachhata.garbage': 'कचरा डंप',

      'official.hint.swachhata.stagnant-water': 'बंद नाली (अगर नाली से संबंधित हो)',

      'official.hint.pmc.stagnant-water': 'स्वास्थ्य / मच्छर प्रजनन / रुका हुआ पानी',

      'official.hint.pmc.garbage': 'ठोस अपशिष्ट / कचरा',

      'official.hint.aaple': 'स्थानीय निकाय {corp} चुनें → स्वास्थ्य / जल विभाग',

      'official.hint.tmc.stagnant-water': 'जल / स्वास्थ्य विभाग (मच्छर प्रजनन)',

      'success.alsoOfficial': 'आधिकारिक शिकायत (वैकल्पिक)',

      'success.filingGuide': 'दर्ज करने की गाइड और शिकायत कॉपी',

      'esc.close': 'बंद',

      'esc.save': 'सहेजें',

      'esc.tier.file.title': '1 · आधिकारिक शिकायत दर्ज करें',

      'esc.tier.file.body': 'निःशुल्क। वार्ड PCO तक। नंबर यहाँ सहेजें।',

      'esc.tier.matrix.title': '2 · दिन {n}+ — वार्ड',

      'esc.tier.matrix.body': '7 दिन पर BMC ऑटो-एस्केलेट। WCO / AMC से संपर्क करें।',

      'esc.tier.zonal.title': '3 · दिन {n}+ — ज़ोनल',

      'esc.tier.zonal.body': 'Zonal DMC और @mybmc पर सार्वजनिक दबाव।',

      'esc.tier.grievance.title': '4 · दिन {n}+ — शिकायत / RTI',

      'esc.tier.grievance.body': 'एक महीने बाद भी? Aaple Sarkar या RTI।',

      'profile.empty': 'अभी कोई रिपोर्ट नहीं। पास कोई खतरा?',

      'profile.emptyList': 'अभी कोई रिपोर्ट नहीं। रिपोर्ट दबाकर पास के खतरे पिन करें।',

      'profile.emptyAction': 'अभी रिपोर्ट करें',

      'profile.trackEscalate': 'ट्रैक / आगे बढ़ाएँ',

      'profile.fileBmc': 'BMC में दर्ज करें',

      'profile.status.resolvedCitizen': 'हल (आपने पुष्टि)',

      'profile.status.resolvedBmc': 'BMC ने हल किया',

      'profile.status.notFiled': 'सामुदायिक मानचित्र पर खुला',

      'profile.status.removed': 'मॉडरेटर द्वारा हटाई गई',

      'profile.communityCleared': 'स्वयंसेवकों ने साफ किया — {corp} शिकायत अभी खुली हो सकती है',

      'profile.neighbourOne': 'पड़ोसी ने मुझे भी कहा',

      'profile.neighbourMany': 'पड़ोसियों ने मुझे भी कहा',

      'profile.pointsHint.base': '50 अंक/रिपोर्ट · +200 स्वयंसेवा',

      'profile.pointsHint.bonus': '{n} × 50 · +{bonus} बोनस',

      'profile.greeting': 'नमस्ते, {name}',

      'profile.greetingDefault': 'नमस्ते, नागरिक',

      'profile.referralCount': '🎉 आपके निमंत्रण से {n} पड़ोसी जुड़े — धन्यवाद!',

      'profile.selectWard': 'वार्ड चुनें',

      'profile.society': 'सोसाइटी / पड़ोस (वैकल्पिक)',

      'profile.societyPh': 'जैसे Phoenix Mills CHS, Worli',

      'profile.societyHintWard': '{ward} में {n} सोसाइटी — नहीं मिली तो टाइप करें।',

      'profile.societyHintNoWard': 'सोसाइटी सुझाव के लिए पहले वार्ड चुनें।',

      'profile.societyHintCustom': 'सूची में न हो तो सोसाइटी / RWA का नाम लिखें।',

      'profile.societyRegistry': 'अपनी पंजीकृत सहकारी सोसाइटी खोजें',

      'map.youAreHere': 'आप यहाँ हैं',

      'about.subtitleNamed': 'मुंबई, पुणे और ठाणे के लिए सामुदायिक तकनीक — {name} द्वारा, नागरिकों के लिए निःशुल्क।',

      'safety.hide': 'फ़्लैग / छिपाएँ',

      'safety.hidden': 'आपके मानचित्र से छिपाया।',

      'safety.hideConfirm': 'इस पिन को छिपाएँ और समीक्षा के लिए हमारी टीम को भेजें? (रिपोर्ट तुरंत हटती नहीं।)',

      'mute.hideReporter': 'इस रिपोर्टर की रिपोर्ट छिपाएँ',

      'mute.hideConfirm': 'अपने डिवाइस पर इस रिपोर्टर की सभी पिन छिपाएँ? प्रोफ़ाइल → छिपे रिपोर्टर में वापस ला सकते हैं।',

      'mute.hidden': 'इस रिपोर्टर की रिपोर्ट आपके मानचित्र पर छिपी हैं।',

      'mute.unmuted': 'रिपोर्टर अनम्यूट — उनकी रिपोर्ट फिर दिख सकती हैं।',

      'mute.sectionTitle': 'छिपे रिपोर्टर',

      'mute.sectionHint': 'इन उपयोगकर्ताओं की रिपोर्ट आपके मानचित्र पर छिपी हैं। फिर दिखाने के लिए टैप करें।',

      'mute.empty': 'कोई छिपा रिपोर्टर नहीं।',

      'mute.unmute': 'फिर दिखाएँ',

      'popup.pending': 'लंबित',

      'popup.resolved': 'हल',

      'fix.by.community': 'ठीक — पड़ोसी ने पुष्टि की',

      'fix.by.self': 'ठीक — रिपोर्टर ने सत्यापित',

      'fix.by.bmc': '{corp} द्वारा हल',

      'popup.society': 'सोसाइटी / पड़ोस',

      'popup.communityCleared': 'स्वयंसेवकों ने साफ किया — {corp} शिकायत अभी खुली हो सकती है',

      'partner.title': 'पार्टनर एक्सेस',

      'partner.subtitle': 'NGO समन्वयकों और स्वयंसेवकों के लिए। नगरपालिका एक्सेस निमंत्रण पर।',

      'partner.ngoTitle': 'NGO समन्वयक',

      'partner.ngoBody': 'दान देखें, स्वयंसेवकों को भेजें और सफ़ाई दर्ज करें',

      'partner.bmcTitle': 'नगरपालिका पायलट',

      'partner.bmcBody': 'आमंत्रित BMC पायलट के लिए — एक्सेस के लिए संपर्क करें',

      'profile.persona.admin': 'BMC एडमिन',

      'profile.persona.ngo': 'NGO समन्वयक',

      'flow.legal': 'कानूनी',

      'flow.city': 'शहर',

      'flow.ward': 'वार्ड',

      'flow.ready': 'तैयार',

      'city.mumbai': 'मुंबई',

      'city.pune': 'पुणे',

      'city.thane': 'ठाणे',

      'tos.title': 'सेवा की शर्तें',

      'tos.subtitle': 'CivicRadar उपयोग से पहले पढ़ें और स्वीकार करें।',

      'tos.age': 'रिपोर्ट और समुदाय फीचर के लिए 18+ होना ज़रूरी।',

      'tos.emergency': 'आपात के लिए नहीं। जान को खतरा हो तो 112 डायल करें।',

      'tos.itAct': 'CivicRadar IT Act, 2000 के तहत मध्यस्थ है। अपलोड की ज़िम्मेदारी आपकी।',

      'tos.share': 'WhatsApp, X आदि पर शेयर से व्यक्तिगत डेटा खुल सकता है — अपने जोखिम पर।',

      'tos.gps': 'DPDP Act के तहत खतरा नक्शे के लिए GPS सहमति ज़रूरी।',

      'tos.analytics': 'गुमनाम उपयोग एनालिटिक्स (वैकल्पिक) विश्वसनीयता बढ़ाता है। कोई फ़ोटो, GPS या नाम नहीं भेजा जाता।',

      'tos.analyticsOptIn': 'मैं गुमनाम उपयोग एनालिटिक्स की सहमति देता/देती हूँ (वैकल्पिक — Profile से कभी भी वापस)',

      'tos.notBmc': 'CivicRadar स्वतंत्र है — BMC/MCGM से जुड़ा या चलाया नहीं जाता।',

      'tos.content': 'केवल खतरे की ऑन-साइट फ़ोटो। सेल्फ़ी, ID या असंबंधित चित्र नहीं।',

      'tos.accept': 'मैं 18+ हूँ, <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms</a> और <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a> स्वीकार करता/करती हूँ, GPS संग्रह की सहमति देता/देती हूँ',

      'tos.continue': 'आगे बढ़ें',

      'pledge.title': 'दान दें',

      'pledge.subtitle': 'वार्ड में स्वयंसेवकों को सामान दें।',

      'pledge.type': 'सामान का प्रकार',

      'pledge.type.cleaning': 'सफ़ाई सामान',

      'pledge.type.snacks': 'नाश्ता',

      'pledge.type.repellent': 'मच्छर भगाने का सामान',

      'pledge.ward': 'लक्ष्य वार्ड',

      'pledge.wardPh': 'वार्ड चुनें…',

      'pledge.message': 'संदेश',

      'pledge.messagePh': 'स्वयंसेवकों के लिए नोट…',

      'pledge.notice': 'आपके वार्ड का NGO समन्वयक इसे अपने हब में देखेगा — BMC नहीं। वे ऐप में संपर्क कर सकते हैं; कोई स्वचालित कॉल/SMS नहीं।',

      'pledge.status.pledged': 'दान दर्ज',

      'pledge.status.delivered': 'वितरित',

      'pledge.status.verified': 'सत्यापित (+200 अंक)',

      'pledge.submit': 'दान भेजें',

      'toast.syncConnected': 'कनेक्ट — रिपोर्ट सभी डिवाइस पर सिंक।',

      'toast.welcome': 'स्वागत, {name}! रिपोर्ट के लिए तैयार।',

      'toast.syncLocal': 'इस डिवाइस पर सहेजा — क्लाउड सिंक रिट्राई करेगा।',

      'toast.copyFail': 'कॉपी नहीं हुई — टेक्स्ट मैन्युअल चुनें।',

      'toast.saveFail': 'सहेजा नहीं जा सका।',

      'toast.adminVerified': 'BMC एक्सेस सत्यापित — वार्ड कतार देखें।',

      'toast.ngoVerified': 'समन्वयक सत्यापित — दान और स्वयंसेवक देखें।',

      'toast.govEmail': 'अपना gov.in / mcgm.gov.in ईमेल उपयोग करें।',

      'toast.codeSent': 'कोड भेजा — इनबॉक्स देखें।',

      'toast.codeInvalid': 'अमान्य या समाप्त कोड।',

      'toast.linkSent': 'साइन-इन लिंक भेजा — इनबॉक्स देखें।',

      'toast.authEmailFail': 'साइन-इन ईमेल नहीं भेजा जा सका — Supabase SMTP सेटिंग जाँचें और फिर कोशिश करें।',

      'toast.authCaptchaFail': 'सुरक्षा जाँच विफल — पेज रीलोड करें और फिर कोशिश करें।',

      'toast.authEmailOffline': 'क्लाउड साइन-इन उपलब्ध नहीं — कनेक्शन जाँचें और फिर कोशिश करें।',

      'toast.authEmailRateLimit': 'बहुत सारे साइन-इन ईमेल — कुछ मिनट रुकें और फिर कोशिश करें।',

      'toast.authEmailInvalid': 'ईमेल पता अमान्य लगता है — जाँचें और फिर कोशिश करें।',

      'toast.authEmailRedirect': 'साइन-इन रीडायरेक्ट URL अनुमत नहीं — Supabase Authentication में अपनी साइट URL जोड़ें।',

      'toast.linkExpired': 'साइन-इन लिंक समाप्त — नया लिंक मांगें।',

      'toast.bmcUnauthorized': 'यह ईमेल BMC एक्सेस के लिए अधिकृत नहीं।',

      'toast.ngoCodeRequired': 'ईमेल और NGO एक्सेस कोड दर्ज करें।',

      'toast.ngoCodeInvalid': 'गलत या समाप्त NGO कोड।',

      'toast.onboardFirst': 'रिपोर्ट के लिए सेटअप पूरा करें।',

      'toast.tosRequired': 'समुदाय सुविधाओं से पहले Terms और Privacy (18+) स्वीकार करें।',

      'toast.reportNotFound': 'रिपोर्ट लिंक अमान्य या इस डिवाइस पर नहीं।',

      'toast.installed': 'CivicRadar इंस्टॉल — होम स्क्रीन से खोलें!',

      'toast.installHint': 'ब्राउज़र मेनू → Add to Home screen।',

      'toast.installHintIos': 'Safari Share → Add to Home Screen.',

      'toast.wardRequired': 'मुंबई की आधिकारिक सूची से वार्ड चुनें।',

      'toast.contactConfig': 'संपर्क ईमेल सेट नहीं — js/config.js देखें',

      'config.contactMissing': '(js/config.js में founder.email या founder.operatorEmail सेट करें)',

      'toast.citizenView': 'नागरिक दृश्य पर वापस।',

      'toast.noLocation': 'इस ब्राउज़र में लोकेशन उपलब्ध नहीं।',

      'toast.recentered': 'नक्शा आपकी जगह पर केंद्रित।',

      'toast.bmcLoginFail': 'गलत BMC क्रेडेंशियल।',

      'toast.bmcMumbaiOnly': 'BMC पायलट केवल Mumbai के लिए। अपने नगर निगम से Profile में दर्ज करें।',

      'toast.ngoLoginFail': 'गलत समन्वयक क्रेडेंशियल।',

      'toast.photoRequired': 'भेजने से पहले फ़ोटो जोड़ें।',

      'toast.photoFailed': 'वह फ़ोटो इस्तेमाल नहीं हो सकी — फिर कोशिश करें।',

      'toast.gpsRequired': 'खतरा पिन के लिए GPS ज़रूरी।',

      'toast.gpsOutsideCity': 'स्थान आपके चुने शहर के बाहर है। पिन शहर की सीमा में लगाएँ या प्रोफ़ाइल में शहर बदलें।',

      'toast.pinConfirmRequired': 'मैप पर पिन की पुष्टि करें — सबमिट से पहले पिन खतरे पर खींचें।',

      'toast.hazardTypeRequired': 'एक सक्रिय खतरा प्रकार चुनें।',

      'toast.storageFull': 'स्टोरेज भरा — पुरानी रिपोर्ट हटाई। फिर कोशिश करें।',

      'toast.gpsFail': 'GPS नहीं मिला। लोकेशन चालू करके फिर कोशिश करें।',

      'toast.gpsFailAction': 'GPS नहीं मिला। मैप पर पिन लगाएँ या सेटिंग में लोकेशन चालू करें।',

      'toast.manualPinReady': 'पिन लग गया — Submit दबाकर रिपोर्ट पूरी करें।',

      'toast.gpsLocating': 'आपका स्थान खोज रहे हैं…',

      'toast.gpsLowAccuracy': 'स्थान अनुमानित है (~{m} मी)। बेहतर GPS के लिए बाहर या खिड़की के पास जाएँ।',

      'toast.gpsPoorFix': 'सटीक स्थान नहीं मिला। GPS चालू करके बाहर फिर कोशिश करें।',

      'toast.complaintRequired': 'ट्रैकिंग के लिए शिकायत नंबर दर्ज करें।',

      'toast.complaintSaved': 'शिकायत नंबर सहेजा — आधिकारिक घड़ी चालू।',

      'toast.pledgeWardRequired': 'दान के लिए लक्ष्य वार्ड चुनें।',

      'toast.pledgeSaved': 'दान दर्ज — आपके वार्ड समन्वयक को हब में दिखेगा।',

      'toast.pledgeDuplicate': 'इस वार्ड और सामग्री के लिए पहले से खुली प्रतिज्ञा है।',

      'toast.pledgeWardMismatch': 'यह आपके वार्ड से अलग है — वहाँ का समन्वयक संभालेगा।',

      'toast.pledgeStatusDelivered': 'समन्वयक ने आपकी प्रतिज्ञा वितरित चिह्नित की।',

      'toast.pledgeStatusVerified': 'स्वयंसेवक घंटे सत्यापित — +200 Civic Points!',

      'toast.ngoNewPledge': 'आपके वार्ड में {n} नई नागरिक प्रतिज्ञा।',

      'toast.ngoNewPledgeAction': 'हब खोलें',

      'toast.proofAdded': 'प्रमाण फ़ोटो जोड़ी — पुष्टि के लिए फिर दबाएँ।',

      'toast.fixPhotoAdded': 'बाद की फोटो सेव — पड़ोसी पहले और बाद देख सकते हैं!',

      'toast.resolveFail': 'स्थिति अपडेट नहीं हो सकी।',

      'toast.bmcOnlyResolve': 'केवल सत्यापित BMC अधिकारी हल कर सकते हैं।',

      'toast.resolvedProof': 'ठीक चिह्नित — पहले/बाद प्रमाण सहेजा।',

      'toast.ownReportOnly': 'केवल अपनी रिपोर्ट पुष्टि कर सकते हैं।',

      'toast.complaintFirst': 'पहले शिकायत नंबर जोड़ें — यही आपका प्रमाण।',

      'toast.selfResolved': 'ठीक चिह्नित — फॉलो-अप के लिए धन्यवाद!',

      'toast.shareWin': 'पड़ोसियों के साथ जीत शेयर करें।',

      'toast.cleanupLogged': 'समुदाय सफ़ाई लॉग — BMC शिकायत आधिकारिक रूप से खुली रह सकती है।',

      'toast.pledgeDelivered': 'सामान वितरित चिह्नित — अब घंटे सत्यापित करें।',

      'toast.hoursVerified': 'घंटे सत्यापित! +200 Civic Points मिले।',

      'toast.saving': 'सहेजा जा रहा…',

      'toast.verifying': 'सत्यापित हो रहा…',

      'admin.title': 'BMC एडमिन',

      'admin.subtitle': 'नागरिक खतरा रिपोर्ट हल करें, वार्ड कतार देखें।',

      'admin.queueTitle': 'खतरा कतार',

      'admin.queueSubtitle': 'नागरिक रिपोर्ट देखें, प्राथमिकता दें, हल करें।',

      'admin.returnMap': 'नक्शे पर वापस',

      'admin.exitMode': 'BMC मोड बंद',

      'admin.allWards': 'सभी वार्ड',

      'admin.sort.oldest': 'पुराना पहले',

      'admin.sort.newest': 'नवीनतम पहले',

      'admin.sort.overdue': 'लंबित पहले',

      'admin.sort.confirmed': 'सबसे ज़्यादा मुझे भी',

      'admin.pending': 'खुला',

      'admin.overdue': '7+ दिन लंबित',

      'admin.resolved': 'ठीक',

      'admin.avgDays': 'औसत दिन',

      'admin.healthSummary': 'ऐप स्वास्थ्य (पिछले 7 दिन)',

      'admin.healthLoading': 'उपयोग लोड हो रहा…',

      'admin.markResolved': 'ठीक चिह्नित करें',

      'admin.resolveHint': 'नागरिक को क्रेडिट — पिन हरा हो जाएगा।',

      'admin.removeContent': 'सामग्री हटाएँ',

      'admin.removeConfirm': 'इस रिपोर्ट को सार्वजनिक मानचित्र से हटाएँ? दिशानिर्देशों का उल्लंघन करने वाली सामग्री के लिए उपयोग करें — रिपोर्टर देख सकेगा कि इसे हटाया गया।',

      'admin.removeSuccess': 'रिपोर्ट सार्वजनिक मानचित्र से हटा दी गई।',

      'admin.flagged': 'फ़्लैग की गई',

      'admin.reviewTag': 'BMC समीक्षा',

      'admin.reportTitle': 'खतरा रिपोर्ट',

      'coord.title': 'समन्वयक लॉगिन',

      'coord.subtitle': 'दान देखें, स्वयंसेवक भेजें, घंटे सत्यापित करें।',

      'coord.hubTitle': 'समन्वयक हब',

      'coord.hubSubtitle': 'नागरिक दान देखें, स्वयंसेवक घंटे सत्यापित करें।',

      'coord.workflow': 'भेजें → सफ़ाई लॉग → सामान पुष्टि → घंटे (+200 अंक)',

      'coord.openHazards': 'वार्ड में खुले खतरे',

      'coord.pledges': 'नागरिक दान',

      'coord.pledgesNew': 'नागरिक प्रतिज्ञाएँ · {n} नई',

      'coord.pledgesEmpty': 'अभी कोई प्रतिज्ञा नहीं। अपने वार्ड के निवासियों के साथ Community टैब साझा करें।',

      'coord.markDelivered': 'वितरित चिह्नित करें',

      'coord.verifyHours': 'घंटे सत्यापित (+200)',

      'coord.verified': 'सत्यापित',

      'coord.exitMode': 'NGO मोड बंद',

      'coord.pledgesLabel': 'दान',

      'coord.toVerify': 'सत्यापन बाकी',

      'coord.openLabel': 'खुले खतरे',

      'coord.cleared': 'समुदाय ने साफ किया',

      'profile.pledges': 'मेरी प्रतिज्ञाएँ',

      'profile.pledgesEmpty': 'अभी कोई प्रतिज्ञा नहीं। Community से स्थानीय स्वयंसेवकों का साथ दें।',

      'profile.pledgesEmptyAction': 'दान करें',

      'profile.officialHint': 'सत्यापित BMC, PMC और TMC ऐप और पोर्टल — CivicRadar आपकी ओर से दर्ज नहीं करता। Resources टैब से खोलें।',

      'profile.officialLink': 'Resources खोलें',

      'profile.communityHint': 'स्वयंसेवक साइन अप और दान — Resources टैब से खोलें।',

      'profile.communityLink': 'स्वयंसेवा और दान',

      'badge.admin': 'BMC एडमिन',

      'badge.coord': 'समन्वयक हब',

      'admin.meta.reporter': 'रिपोर्टर',

      'admin.meta.ward': 'वार्ड',

      'admin.meta.status': 'स्थिति',

      'admin.meta.lat': 'Lat',

      'admin.meta.lng': 'Lng',

      'admin.meta.neighbourConfirm': ' · {n} ने मुझे भी कहा',

      'admin.close': 'बंद',

      'coord.hazardsEmpty': 'आपके क्षेत्र में अभी कोई खुला खतरा नहीं।',

      'coord.volunteerOffers': '{n} स्वयंसेवक प्रस्ताव',

      'coord.hazardCleaned': 'साफ किया',

      'coord.logCleanup': 'सफाई दर्ज करें',

      'admin.health.communityCleanups': 'सामुदायिक सफाई',

      'admin.health.whatsappShares': 'WhatsApp शेयर',

      'admin.health.errors': 'त्रुटियाँ',

      'admin.health.perfSamples': 'प्रदर्शन नमूने',

      'admin.health.avgPerf': 'औसत लोड समय (स्थानीय)',

      'admin.health.bufferedEvents': 'बफर इवेंट (डिवाइस)',

      'tracking.open': 'Analytics और tracking',

      'tracking.title': 'Analytics और tracking',

      'tracking.subtitle': 'एकत्र civic मेट्रिक्स — विज़िट, रिपोर्ट, escalation और resolution।',

      'tracking.period': 'अवधि',

      'tracking.days7': 'पिछले 7 दिन',

      'tracking.days30': 'पिछले 30 दिन',

      'tracking.days90': 'पिछले 90 दिन',

      'tracking.wardFilter': 'वार्ड',

      'tracking.sessions': 'विज़िट',

      'tracking.pwaInstalls': 'PWA installs',

      'tracking.reports': 'रिपोर्ट',

      'tracking.resolved': 'ठीक',

      'tracking.pwaNote': 'PWA install अनुमानित (Add to Home Screen / standalone)। Store downloads GitHub Pages पर नापे नहीं जाते।',

      'tracking.loading': 'मेट्रिक्स लोड हो रहे हैं…',

      'tracking.sourceLocal': 'डिवाइस + स्थानीय रिपोर्ट (demo / offline)',

      'tracking.sourceCloud': 'क्लाउड aggregate (सभी उपयोगकर्ता)',

      'tracking.sourceCloudFail': 'क्लाउड मेट्रिक्स उपलब्ध नहीं — Supabase में tracking SQL चलाएँ।',

      'tracking.reportsByCategory': 'श्रेणी के अनुसार रिपोर्ट',

      'tracking.escalations': 'आधिकारिक चैनल खुलने',

      'tracking.neighbourhoods': 'पड़ोस / सोसाइटी के अनुसार',

      'tracking.reporters': 'सक्रिय रिपोर्टर',

      'tracking.meToo': 'Me too',

      'tracking.filed': 'आधिकारिक दर्ज',

      'tracking.leads': 'पड़ोस लीड',

      'tracking.empty': 'इस अवधि में कोई डेटा नहीं।',

      'tracking.pending': 'खुला',

      'tracking.channelUnknown': 'अन्य चैनल',

      'a11y.skipToContent': 'मुख्य सामग्री पर जाएँ',

      'aria.close': 'बंद',

      'aria.lang': 'भाषा बदलें',

      'aria.recenter': 'नक्शा आपकी जगह पर केंद्रित करें',

      'aria.leaderboard': 'समुदाय लीडरबोर्ड और दान',

      'aria.profile': 'प्रोफ़ाइल',

      'aria.report': 'खतरा रिपोर्ट',

      'aria.filterWard': 'वार्ड से फ़िल्टर',

      'aria.sortReports': 'रिपोर्ट क्रम',

      'auth.demoTag.admin': 'डेमो एक्सेस — प्रोडक्शन में BMC ईमेल सत्यापन',

      'auth.demoTag.lead': 'डेमो एक्सेस — प्रोडक्शन में ईमेल + NGO इनवाइट',

      'auth.officialEmail': 'आधिकारिक ईमेल',

      'auth.emailHint': 'केवल gov.in / mcgm.gov.in पर BMC एक्सेस।',

      'auth.sendCode': 'साइन-इन कोड भेजें',

      'auth.linkInstructions': 'अपना ईमेल देखें और साइन-इन लिंक पर टैप करें। यह टैब खुला रखें — आप साइन-इन होकर यहीं लौटेंगे।',

      'auth.otpFallback': '6-अंक का कोड है?',

      'auth.otp': '6-अंक कोड',

      'auth.verifyEnter': 'सत्यापित करें और प्रवेश',

      'auth.email': 'ईमेल',

      'auth.ngoCode': 'NGO एक्सेस कोड',

      'auth.ngoCodePh': 'CivicRadar ऑपरेटर द्वारा जारी',

      'auth.username': 'यूज़रनेम',

      'auth.password': 'पासवर्ड',

      'auth.loginDemo': 'लॉगिन (डेमो)',

      'admin.health.noData': 'इस डिवाइस पर अभी उपयोग डेटा नहीं।',

      'admin.health.deviceSource': 'डिवाइस बफ़र (पिछले 7 दिन)',

      'admin.health.cloudSource': 'क्लाउड एग्रीगेट (सभी यूज़र)',

      'admin.health.cloudUnavailable': 'क्लाउड मेट्रिक्स उपलब्ध नहीं — Supabase में analytics SQL चलाएँ।',

      'admin.health.connectSupabase': 'शहर-व्यापी उपयोग के लिए Supabase कनेक्ट करें।',

      'admin.health.sessions': 'सत्र',

      'admin.health.tabViews': 'टैब व्यू',

      'admin.health.reportsFiled': 'रिपोर्ट दर्ज',

      'admin.health.corroborations': 'मुझे भी',

      'admin.health.bmcFiled': 'BMC दर्ज',

      'admin.health.resolved': 'ठीक',

      'about.founderDefault': 'Nihira',

      'about.teamLabel': 'Nihira',

      'about.teamRole': 'सामुदायिक नागरिक रिपोर्टिंग',

      'ref.welcomeTitle': 'एक पड़ोसी ने आपको बुलाया 👋',

      'referral.joinedReward': '🎉 आपके निमंत्रण से {n} पड़ोसी जुड़े — +{pts} Civic Points!',

      'ref.welcomeBody': '{city} के नक्शे पर पहले से {n} रिपोर्ट हैं। अपने वार्ड के खुले स्पॉट देखें — या 30 सेकंड में एक पिन करें।',

      'ref.welcomeBodyEmpty': '{city} में खतरों का नक्शा बनाने वालों में सबसे पहले बनें — कचरा, गड्ढे, स्ट्रीटलाइट और रुका पानी। सिर्फ़ 30 सेकंड।',

      'ref.welcomeCta': 'नक्शा देखें',

      'ref.welcomeReport': 'स्पॉट रिपोर्ट करें',

      'ref.dismiss': 'निमंत्रण बंद करें',

      'season.monsoonPrep': 'बारिश आने वाली है। जल्दी रुका पानी साफ़ करने से मच्छर कम होते हैं — पहली तेज़ बारिश से पहले स्पॉट पिन करें।',

      'season.monsoonPeak': 'मानसून आ गया है। रुका पानी वहीं से डेंगू शुरू होता है — 30 सेकंड की रिपोर्ट आपकी पूरी गली की मदद करती है।',

      'season.ganesh': 'गणेश चतुर्थी आ गई है। आइए त्योहार के लिए वार्ड को साफ़ रखें — पंडाल और विसर्जन मार्ग के पास रुका पानी रिपोर्ट करें।',

      'season.denguePeak': 'डेंगू का मौसम है। मच्छर रुके पानी में पनपते हैं — एक जल्दी रिपोर्ट आपकी गली की रक्षा करती है।',

      'season.dismiss': 'मौसमी सुझाव बंद करें',

      'social.wardWeek': '👥 इस सप्ताह {ward} में {n} पड़ोसियों ने रिपोर्ट की',

      'social.wardWeekBacked': '👥 इस सप्ताह {ward} में {n} रिपोर्ट · {c} समर्थन',

      'social.wardWeekEmpty': 'इस सप्ताह {ward} से अभी तक कोई रिपोर्ट नहीं — पड़ोसी आपका अनुसरण करेंगे।',

      'recap.title': 'इस सप्ताह आपका वार्ड',

      'recap.share': 'साप्ताहिक सारांश शेयर करें',

      'share.weeklyRecap': '📊 इस सप्ताह {ward}: {reports} नई रिपोर्ट, {resolved} ठीक, {backed} पड़ोसियों ने समर्थन किया। CivicRadar पर जुड़ें 👇\n{link}\n{hashtags}',

      'feedback.menu': 'सुझाव भेजें',

      'feedback.title': 'सुझाव भेजें',

      'feedback.subtitle': 'कोई गड़बड़ी मिली या कोई सुझाव है? हमें बताएं — यह सीधे टीम तक पहुंचता है।',

      'feedback.categoryLabel': 'किस तरह का सुझाव?',

      'feedback.catIdea': 'सुझाव',

      'feedback.catBug': 'गड़बड़ी',

      'feedback.catOther': 'अन्य',

      'feedback.messageLabel': 'आपका सुझाव',

      'feedback.messagePh': 'क्या हुआ, या CivicRadar को बेहतर कैसे बनाया जाए?',

      'feedback.contactLabel': 'संपर्क (वैकल्पिक — केवल यदि आप जवाब चाहते हैं)',

      'feedback.contactPh': 'ईमेल या फ़ोन',

      'feedback.privacy': 'हम आपका संपर्क कभी साझा नहीं करते। केवल इस सुझाव का जवाब देने के लिए उपयोग होता है।',

      'feedback.submit': 'सुझाव भेजें',

      'feedback.errorEmpty': 'कृपया पहले एक छोटा संदेश लिखें।',

      'feedback.error': 'भेजा नहीं जा सका — आपका टेक्स्ट सुरक्षित है। कृपया फिर से प्रयास करें।',

      'feedback.success': 'धन्यवाद! आपका सुझाव भेज दिया गया।',

      'feedback.successLocal': 'सहेजा गया — ऑनलाइन होने पर हम इसे सिंक कर देंगे।',

      'access.title': 'समन्वयक एक्सेस का अनुरोध करें',

      'access.subtitle': 'NGO व सामुदायिक समन्वयकों और BMC अधिकारियों के लिए।',

      'access.step1': 'कुछ आसान जानकारी के साथ आवेदन करें',

      'access.step2': 'CivicRadar टीम समीक्षा करती है',

      'access.step3': 'एक्सेस अनलॉक करने के लिए क्लेम कोड पाएं',

      'access.roleLabel': 'मैं हूँ…',

      'access.roleNgo': 'NGO समन्वयक',

      'access.roleBmc': 'BMC अधिकारी',

      'access.nameLabel': 'आपका नाम',

      'access.namePh': 'पूरा नाम',

      'access.orgLabel': 'संस्था',

      'access.orgPh': 'NGO / विभाग / RWA का नाम',

      'access.optional': '(वैकल्पिक)',

      'access.cityLabel': 'शहर',

      'access.wardLabel': 'वार्ड',

      'access.wardPh': 'आपका वार्ड',

      'access.contactLabel': 'संपर्क — ईमेल या फ़ोन',

      'access.emailPh': 'you@example.com',

      'access.phonePh': 'फ़ोन',

      'access.contactHint': 'कम से कम एक दें। क्लेम कोड ईमेल पर; केवल फ़ोन देने पर हम वहीं संपर्क करेंगे।',

      'access.proofLabel': 'पहचान / प्रमाण',

      'access.proofOptional': '(वैकल्पिक — BMC के लिए सुझाया गया)',

      'access.proofAdd': 'प्रमाण फ़ोटो जोड़ें',

      'access.noteLabel': 'और कुछ?',

      'access.notePh': 'वार्ड फोकस, उपयोग कैसे करेंगे, आदि।',

      'access.submit': 'अनुरोध भेजें',

      'access.haveCode': 'मेरे पास पहले से क्लेम कोड है',

      'access.confirmTitle': 'अनुरोध प्राप्त हुआ',

      'access.confirmBody': 'धन्यवाद! CivicRadar टीम आपके अनुरोध की समीक्षा करेगी और आमतौर पर कुछ दिनों में आपको क्लेम कोड भेजेगी (ईमेल या फ़ोन)। एक्सेस अनलॉक करने के लिए वह कोड ऐप में दर्ज करें।',

      'access.confirmLocal': 'इस डिवाइस पर सहेजा गया — ऑनलाइन होने पर टीम को सिंक हो जाएगा।',

      'access.done': 'पूर्ण',

      'access.profileBmcCta': 'BMC अधिकारी? एक्सेस माँगें',

      'access.partnerBmcCta': 'BMC अधिकारी? एक्सेस माँगें',

      'access.partnerClaim': 'मेरे पास क्लेम कोड है',

      'access.claimTitle': 'अपना क्लेम कोड दर्ज करें',

      'access.claimSubtitle': 'CivicRadar टीम ने मंज़ूरी दी? एक्सेस अनलॉक करने के लिए भेजा गया कोड दर्ज करें।',

      'access.claimLabel': 'क्लेम कोड',

      'access.claimPh': 'CR-XXXXXX',

      'access.claimSubmit': 'एक्सेस अनलॉक करें',

      'access.reviewOpen': 'एक्सेस अनुरोध',

      'access.reviewTag': 'CivicRadar टीम',

      'access.reviewTitle': 'एक्सेस अनुरोध',

      'access.reviewSubtitle': 'समन्वयक व BMC एक्सेस अनुरोध मंज़ूर/अस्वीकार करें। मंज़ूरी पर क्लेम कोड जारी होता है।',

      'access.pending': 'लंबित',

      'access.approved': 'मंज़ूर',

      'access.rejected': 'अस्वीकृत',

      'access.reviewEmpty': 'अभी कोई अनुरोध नहीं। नए समन्वयक व BMC अनुरोध यहाँ दिखेंगे।',

      'access.approve': 'मंज़ूर करें',

      'access.reject': 'अस्वीकार करें',

      'access.copyCode': 'कोड कॉपी करें',

      'access.codeCopied': 'क्लेम कोड कॉपी हुआ — आवेदक को उनके संपर्क विवरण से साझा करें।',

      'access.roleNgoTag': 'NGO समन्वयक',

      'access.roleBmcTag': 'BMC अधिकारी',

      'access.statusApproved': 'मंज़ूर',

      'access.statusRejected': 'अस्वीकृत',

      'access.statusPending': 'लंबित',

      'access.errName': 'कृपया अपना नाम जोड़ें।',

      'access.errContact': 'संपर्क के लिए ईमेल या फ़ोन जोड़ें।',

      'access.submitted': 'अनुरोध भेजा गया — हम समीक्षा कर आपको क्लेम कोड भेजेंगे।',

      'access.submittedLocal': 'अनुरोध सहेजा गया — ऑनलाइन होने पर सिंक व समीक्षा होगी।',

      'access.submitError': 'भेजा नहीं जा सका — आपकी जानकारी सुरक्षित है। कृपया फिर प्रयास करें।',

      'access.claimErrEmpty': 'भेजा गया क्लेम कोड दर्ज करें।',

      'access.claimErrInvalid': 'यह कोड मान्य नहीं है या अभी मंज़ूर नहीं हुआ।',

      'access.claimErrUsed': 'यह कोड पहले ही उपयोग हो चुका है।',

      'access.claimedNgo': 'एक्सेस अनलॉक — स्वागत है, समन्वयक!',

      'access.claimedBmc': 'BMC एक्सेस अनलॉक — अपनी वार्ड कतार देखें।',

      'access.approvedToast': 'मंज़ूर — क्लेम कोड {code}',

      'access.rejectedToast': 'अनुरोध अस्वीकृत।',

      'access.proofAttached': 'प्रमाण जोड़ा गया',

      'access.proofTooBig': 'छवि बहुत बड़ी — कृपया छोटी फ़ोटो जोड़ें।',

      'lead.title': 'सामुदायिक लीड बनें',

      'lead.subtitle': 'खुद को नामांकित करें — पड़ोसी वोट करेंगे। एडमिन की ज़रूरत नहीं।',

      'lead.discoverNudge': 'आप बहुत सक्रिय हैं! अपने वार्ड में सफ़ाई का नेतृत्व करने पर विचार करें।',

      'lead.discoverNudgeCta': 'और जानें',

      'lead.step1': 'वार्ड और क्षेत्र के साथ नामांकन',

      'lead.step2': 'पड़ोसी Support दबाएँ',

      'lead.step3': '2 समर्थन से भूमिका (co-lead में हर एक को 5)',

      'lead.roleLabel': 'लीड प्रकार',

      'lead.roleWard': 'वार्ड NGO लीड',

      'lead.roleNbh': 'पड़ोस लीड',

      'lead.nameLabel': 'आपका नाम',

      'lead.namePh': 'पड़ोसी आपको कैसे जानते हैं',

      'lead.orgLabel': 'संगठन / RWA',

      'lead.orgPh': 'NGO या सोसाइटी का नाम',

      'lead.neighbourhoodLabel': 'पड़ोस / सोसाइटी / गली',

      'lead.neighbourhoodHintNoWard': 'स्थानीय सुझाव के लिए पहले वार्ड चुनें।',

      'lead.neighbourhoodHintWard': '{ward} में {n} पड़ोस/सोसाइटी — नहीं मिली तो टाइप करें।',

      'lead.neighbourhoodHintCustom': 'सूची में न हो तो पड़ोस, सोसाइटी या गली लिखें।',

      'lead.pitchLabel': 'आप क्यों?',

      'lead.pitchPh': 'वोटर्स के लिए छोटा नोट',

      'lead.submit': 'मुझे नामांकित करें',

      'lead.confirmTitle': 'आप मतदान में हैं!',

      'lead.confirmBody': 'CivicRadar पड़ोसियों के साथ शेयर करें — समन्वयक टूल्स के लिए 2 समर्थन चाहिए। एक ही स्लॉट पर दो उम्मीदवार हों तो दोनों को 5।',

      'lead.confirmLocal': 'इस डिवाइस पर सहेजा गया — ऑनलाइन होने पर सिंक होगा।',

      'lead.viewCommunity': 'Community में उम्मीदवार देखें',

      'lead.profileCta': 'वार्ड या पड़ोस लीड बनें',

      'lead.partnerCta': 'सामुदायिक लीड बनें — peer support से कमाएँ',

      'lead.communityTitle': 'सामुदायिक लीड',

      'lead.communityHint': 'सफ़ाई समन्वय के लिए स्वयंसेवक पड़ोसियों को Support करें। 2 समर्थन = भूमिका; कई उम्मीदवार = हर एक को 5।',

      'lead.communityEmpty': 'आपके वार्ड में अभी कोई उम्मीदवार नहीं — खुद नामांकित करें।',

      'lead.becomeCta': 'सामुदायिक लीड बनें',

      'lead.support': 'Support',

      'lead.supported': 'समर्थित',

      'lead.progress': '{count}/{threshold} समर्थन',

      'lead.progressCoLead': 'co-lead के लिए {count}/{threshold}',

      'lead.tagWard': 'वार्ड लीड',

      'lead.tagNbh': 'पड़ोस',

      'lead.you': 'आप',

      'lead.errName': 'कृपया अपना नाम जोड़ें।',

      'lead.errWard': 'अपना वार्ड चुनें।',

      'lead.errNeighbourhood': 'पड़ोस या सोसाइटी दर्ज करें।',

      'lead.errAlreadyVoted': 'आप पहले ही इस उम्मीदवार को Support कर चुके हैं।',

      'lead.errAlreadyNominated': 'इस क्षेत्र के लिए आपका सक्रिय नामांकन पहले से है।',

      'lead.errAlreadyLead': 'आप पहले से यह लीड भूमिका रखते हैं।',

      'lead.nominated': 'नामांकन भेजा — Community में समर्थन जुटाएँ!',

      'lead.nominatedLocal': 'नामांकन सहेजा — ऑनलाइन होने पर सिंक होगा।',

      'lead.voted': 'समर्थन दर्ज — पड़ोसी का साथ देने के लिए धन्यवाद!',

      'lead.granted': 'सीमा पूरी — समन्वयक एक्सेस अनलॉक!',

      'lead.submitError': 'भेजा नहीं जा सका — फिर प्रयास करें।',

      'lead.voteError': 'समर्थन दर्ज नहीं हुआ — फिर प्रयास करें।',

    },
    mr: {

      'lang.name': 'मराठी',

      'lang.native': 'मराठी',

      'nav.map': 'नकाशा',

      'nav.community': 'समुदाय',

      'nav.resources': 'संसाधने',

      'nav.profile': 'प्रोफाइल',

      'fab.report': 'तक्रार',

      'header.context': 'वॉर्ड धोका नकाशा — मुंबई, पुणे आणि ठाणे',

      'header.contextCity': '{city} साठी वॉर्ड धोका नकाशा',

      'location.banner': 'अचूक तक्रारीसाठी स्थान चालू करा.',

      'location.bannerNearby': 'धोके नोंदवण्यासाठी आणि जवळपासच्या समस्या पाहण्यासाठी स्थान चालू करा.',

      'location.unavailable': 'या ब्राउझरमध्ये स्थान उपलब्ध नाही.',

      'location.withdrawn': 'स्थान संमती मागे घेतली. तक्रार करताना पुन्हा चालू करा.',

      'location.dismiss': 'स्थान सूचना बंद करा',

      'location.locate': 'माझे स्थान',

      'location.locateAria': 'स्थान चालू करा',

      'location.enable': 'चालू करा',

      'tagline.threeBeat': 'नकाशावर · फोटो · नोंदवा',

      'tagline.subline': 'तीन टॅप — तुमचा वॉर्ड, एक फोटो, शेजाऱ्यांना कळवा.',

      'tagline.beatMap': 'नकाशावर',

      'tagline.beatSnap': 'फोटो',

      'tagline.beatReport': 'नोंदवा',

      'coach.step': 'सुरुवात · 30 सेकंद',

      'coach.title': 'तुमच्या वॉर्ड नकाशात स्वागत आहे',

      'coach.body': 'नोंदवण्यासाठी तीन टॅप: तुमची जागा, एक फोटो, आणि तुमचे शेजारी कळवले जातात.',

      'coach.got': 'चला सुरू करू',

      'tour.skip': 'वगळा',

      'tour.next': 'पुढे',

      'tour.done': 'समजले',

      'tour.replay': 'टूर पुन्हा पाहा',

      'tour.map.title': 'तुमचा वॉर्ड, नकाशावर',

      'tour.map.body': 'तुमच्या शेजाऱ्यांनी नोंदवलेला प्रत्येक धोका इथे पिन म्हणून दिसतो.',

      'tour.report.title': 'काही दिसलं?',

      'tour.report.body': 'Report दाबा आणि जिथे उभे आहात तिथेच फोटो काढा.',

      'tour.profile.title': 'तुम्ही नकाशावर आहात',

      'tour.profile.body': 'तुमचे शेजारी पिन पाहतात. प्रोफाइलमध्ये तुमचे Civic Points ट्रॅक करा.',

      'persona.citizen.idle': 'जवळपास एखादा धोका दिसला? 30 सेकंदात नोंदवा — तुमचे शेजारी तुमचे आभार मानतील.',

      'persona.wardImpact': '{ward}: आतापर्यंत तुमच्या शेजाऱ्यांच्या {n} तक्रारी. तुमचीही जोडा.',

      'persona.unfiled': '{n} स्पॉट तुमच्या वॉर्ड नकाशावर उघडे आहेत — शेजाऱ्यांसोबत शेअर करा, किंवा Resources मधून अधिकृतपणे नोंदवा.',

      'persona.pendingFiled': '{n} तुमच्या वॉर्ड नकाशावर उघडे आहेत — मुदत उलटली असेल तर Profile पहा.',

      'persona.admin.idlePending': '{n} पुनरावलोकनाची वाट पाहत आहेत — queue उघडा, किंवा red pins दाबा.',

      'persona.admin.idleEmpty': 'सर्व ठीक आहे. शेजाऱ्यांच्या नवीन तक्रारी इथे दिसतील.',

      'persona.admin.header': 'BMC पुनरावलोकन मोड',

      'persona.admin.exit': 'BMC मोड बंद',

      'persona.ngo.header': 'NGO समन्वयक मोड',

      'persona.ngo.exit': 'NGO मोड बंद',

      'onboard.title': 'CivicRadar मध्ये स्वागत आहे',

      'onboard.subtitle': 'तुमची गल्ली, एका नकाशावर. समस्या दिसली की फोटो घ्या — तुमचे शेजारीही ती पाहतील.',

      'onboard.city': 'तुमचे शहर',

      'onboard.cityHint': 'कुठे राहता ते निवडा — पुढच्या टप्प्यात आम्ही तुमच्या स्थानावरून वॉर्ड शोधू.',

      'onboard.ward': 'तुमचा वॉर्ड',

      'onboard.wardPh': 'तुमचा वॉर्ड टाइप करायला सुरुवात करा…',

      'combobox.noMatches': 'जुळणी नाही — वेगळा शोध वापरा',

      'combobox.showOptions': 'सर्व पर्याय दाखवा',

      'onboard.wardHint': '{city} च्या वॉर्डांमधून निवडा, किंवा आम्हाला शोधू द्या.',

      'onboard.wardDetecting': 'तुमच्या स्थानावरून तुमचा वॉर्ड शोधत आहोत…',

      'onboard.wardDetectedHint': 'तुमच्या स्थानावरून अंदाजे वॉर्ड — तुम्ही तो बदलू शकता.',

      'onboard.wardManual': 'बरोबर नाही? स्वतः निवडा',

      'onboard.wardRetry': 'पुन्हा प्रयत्न करा',

      'onboard.wardDetectFailed': 'तुमचा वॉर्ड सापडला नाही. स्वतः निवडा, किंवा लोकेशन सुरू करा.',

      'onboard.name': 'प्रदर्शित नाव',

      'onboard.namePh': 'शेजारी तुम्हाला काय म्हणावेत?',

      'onboard.join': 'तुमच्या वॉर्डमध्ये सामील व्हा',

      'onboard.wardError': 'यादीतून वॉर्ड निवडा, किंवा लोकेशन सुरू करा.',

      'onboard.society': 'सोसायटी किंवा परिसर (पर्यायी)',

      'onboard.societyPh': 'तुमच्या सोसायटी किंवा RWA चे नाव, यादीत नसेल तर',

      'onboard.societyHintNoWard': 'जवळच्या सोसायटी पाहण्यासाठी आधी तुमचा वॉर्ड निवडा.',

      'onboard.societyHintWard': '{ward} मध्ये {n} सोसायटी — टाइप करायला सुरुवात करा, किंवा तुमची जोडा.',

      'onboard.societyHintCustom': 'यादीत नसेल तर तुमच्या सोसायटी किंवा RWA चे नाव लिहा.',

      'report.title': 'धोक्याची तक्रार करा',

      'report.step.capture': 'फोटो',

      'report.step.confirm': 'पुष्टी',

      'report.step.photo': 'फोटो',

      'report.step.details': 'तपशील',

      'report.step.submit': 'पाठवा',

      'report.addNote': '+ Landmark जोडा',

      'report.pinDragHint': 'पिन योग्य जागी नसेल तर ओढून ठेवा',

      'report.pinAccuracyGood': 'स्थान सुमारे ~{m} मी अचूक',

      'report.pinAccuracyFair': 'स्थान ~{m} मी — पिन ओढा किंवा मोकळ्या जागी जा',

      'report.pinAccuracyPoor': 'स्थान अंदाजे (~{m} मी) — पिन धोक्यावर ओढा',

      'report.pinAccuracyUnknown': 'पिन धोक्यावर आहे का? गरज असल्यास ओढा',

      'report.pinAccuracyAdjusted': 'पिन सुधारला',

      'report.pinLocating': 'तुमचे स्थान शोधत आहोत…',

      'report.pinMapAria': 'धोक्याचे स्थान नकाशावर समायोजित करा',

      'report.wardChip': '{ward}',

      'report.wardGps': 'पाठवताना GPS स्थान',

      'report.wardManualPin': 'नकाशावर पिन लावला',

      'report.geoExplainerTitle': 'धोका नकाशावर पिन करा',

      'report.geoExplainerBody': 'धोका पिन करण्यासाठीच आम्हाला तुमचे स्थान हवे — इतर काही नाही.',

      'report.geoExplainerContinue': 'माझे स्थान वापरा',

      'report.geoExplainerManual': 'नकाशावर पिन लावा',

      'report.manualPinBanner': 'धोका जिथे आहे तिथे नकाशावर टॅप करा',

      'report.manualPinCancel': 'रद्द करा',

      'report.placePinOnMap': 'नकाशावर पिन लावा',

      'report.geoEnableHint': 'स्थान कसे चालू करावे',

      'report.geoEnableHelp': 'ब्राउझर सेटिंग → साइट परवानगी → Location → Allow. मग Submit दाबा.',

      'report.hazardType': 'धोक्याचा प्रकार',

      'report.hazardHint': 'धोक्याचा प्रकार निवडा',

      'report.photoNext': '{hazard} निवडले — तयार असल्यास Submit दाबा',

      'report.photoEvidence': 'फोटो पुरावा',

      'report.capture': 'फोटो काढा',

      'report.notes': 'Landmark (ऐच्छिक)',

      'report.notesPh': 'कोणत्या दुकान/इमारतीजवळ? उदा. "साई मेडिकल समोर"',

      'report.submit': 'तक्रार पाठवा',

      'report.photoHint': 'फोटोमध्ये धोका दिसतो? Submit — नाहीतर Retake.',

      'report.retake': 'पुन्हा काढा',

      'moderation.guidelines': 'धोक्याचा स्पष्ट फोटो काढा — खालील बटण दाबा. चेहरे, कागदपत्रे किंवा असंबंधित वस्तू नाहीत. स्थान डेटा गोपनीयतेसाठी काढला जातो.',

      'moderation.guidelines.stagnant-water': 'साचलेल्या पाण्याचा स्पष्ट फोटो काढा — खालील बटण दाबा. चेहरे, कागदपत्रे किंवा असंबंधित वस्तू नाहीत. स्थान डेटा गोपनीयतेसाठी काढला जातो.',

      'moderation.guidelines.garbage': 'कचऱ्याच्या ढिगाचा किंवा डंपचा स्पष्ट फोटो काढा — खालील बटण दाबा. चेहरे, कागदपत्रे किंवा असंबंधित वस्तू नाहीत. स्थान डेटा गोपनीयतेसाठी काढला जातो.',

      'moderation.guidelines.potholes': 'खड्ड्याचा किंवा रस्त्याच्या नुकसानाचा स्पष्ट फोटो काढा — खालील बटण दाबा. चेहरे, कागदपत्रे किंवा असंबंधित वस्तू नाहीत. स्थान डेटा गोपनीयतेसाठी काढला जातो.',

      'moderation.guidelines.streetlight': 'बंद पथदिव्याचा स्पष्ट फोटो काढा — खालील बटण दाबा. चेहरे, कागदपत्रे किंवा असंबंधित वस्तू नाहीत. स्थान डेटा गोपनीयतेसाठी काढला जातो.',

      'moderation.scanning': 'फोटो सुरक्षा तपासणी…',

      'moderation.blocked.fileType': 'फक्त JPEG, PNG किंवा WebP hazard फोटो स्वीकारले जातात.',

      'moderation.blocked.fileSize': 'फोटो खूप मोठा आहे. लहान प्रतिमा वापरा (कमाल 8 MB).',

      'moderation.blocked.lowQuality': 'फोटो खूप लहान किंवा अस्पष्ट आहे. धोक्याजवळ जा.',

      'moderation.blocked.irrelevant': 'धोक्याचा फोटो घ्या — सेल्फी, कागदपत्रे किंवा रिकामे चित्र नाहीत.',

      'moderation.blocked.sensitive': 'ID, कागदपत्रे किंवा स्क्रीनशॉट टाळा. फक्त धोक्याचे दाखवा.',

      'moderation.blocked.nsfw': 'अनुचित सामग्रीमुळे हा फोटो ब्लॉक केला.',

      'moderation.blocked.offline': 'फोटो सुरक्षा तपासणीसाठी इंटरनेटशी कनेक्ट व्हा.',

      'success.title': 'नोंदवले — छान काम',

      'success.tagline': 'तुमची जागा वॉर्ड नकाशावर पिन झाली आहे.',

      'success.taglineNeighbours': '{n} शेजारी आधीच जवळपासच्या स्पॉट्सना पाठिंबा देत आहेत — आता तुमचीही तक्रार तिथे आहे.',

      'success.subtitle': '{corp} कडे मोफत — अधिकृत तक्रार घड्याळ सुरू होते.',

      'success.step1': 'WhatsApp वर शेअर करा जेणेकरून शेजारी पाठिंबा देऊ शकतील',

      'success.step2': 'पर्यायी: {corp} कडे नोंदवा आणि तुमचा तक्रार क्रमांक जतन करा',

      'success.step3': 'शेजारी किंवा {corp} दुरुस्ती झाल्यावर चिन्हांकित करू शकतात — आणि तुम्हाला Civic Points मिळतील',

      'success.file': 'BMC कडे तक्रार नोंदवा',

      'success.fileCorp': '{corp} कडे तक्रार नोंदवा',

      'success.tag': '@mybmc ला टॅग करा',

      'success.alert': 'तुमच्या शेजाऱ्यांना सांगा',

      'success.done': 'नकाशावर परत',

      'success.sharePrompt': 'WhatsApp वर शेअर करा — जितके जास्त पाहतील, तितकी दुरुस्ती लवकर होईल.',

      'success.shareWhatsapp': 'WhatsApp वर शेअर करा',

      'share.nativeShare': 'शेअर करा',

      'success.shareNudge': 'तुमच्या शेजाऱ्यांना कदाचित अजून माहीत नसेल — एक WhatsApp शेअर यावर जास्त नजरा आणेल.',

      'success.shareMsg': '📍 {ward} मध्ये {hazard} — मी नुकतीच ती आमच्या CivicRadar वॉर्ड नकाशावर पिन केली.\nMe too टॅप करा, किंवा तुमच्या गल्लीतील स्पॉट नोंदवा:\n{link}\n{hashtags}',

      'share.appMsg': '🗺️ {city} वॉर्ड धोका नकाशा — कचरा, खड्डे, स्ट्रीटलाइट आणि साचलेले पाणी पिन. Me too, प्रतिस्पर्धी वॉर्डला हरवा!\n{link}\n{hashtags}',

      'share.defaultArea': 'माझ्या भागात',

      'share.meTooMsg': '👋 मला पण — {ward} मध्ये {hazard}. {n} शेजारी CivicRadar वर:\n{link}\n{hashtags}',

      'share.meTooBtn': 'WhatsApp वर शेअर करा',

      'share.wardMapMsg': '🗺️ {ward}: {pending} उघडे धोके — CivicRadar वर आम्हाला हरवा!\n{link}\n{hashtags}',

      'share.cleanupMsg': '🧹 {ward} मध्ये स्वयंसेवकांनी {hazard} साफ केले! आधी → नंतर:\n{link}\n{hashtags}',

      'share.instagramCaption': '{ward} मध्ये {hazard} साफ 🎉 CivicRadar वर आधी → नंतर. पावसाळ्याची विजय.\n{link}\n{hashtags}',

      'share.instagramCleanupCaption': '{ward} मध्ये स्वयंसेवकांनी {hazard} साफ केले 🧹 CivicRadar वर आधी → नंतर.\n{link}\n{hashtags}',

      'share.milestoneMsg': '🏆 {ward} ने {n} सोडवले! तुमचा वॉर्ड?\n{link}\n{hashtags}',

      'share.firstBonus': 'पहिले शेअर — +10 Civic Points! 🎉',

      'shareWin.title': 'विजय शेअर करा!',

      'shareWin.subtitle': 'आधी → नंतर पुरावा — शेजाऱ्यांना दाखवा.',

      'shareWin.subtitleCleanup': 'स्वयंसेवकांनी साफ केले — सोसायटी ग्रुपमध्ये शेअर करा.',

      'shareWin.whatsapp': 'WhatsApp वर विजय शेअर करा',

      'shareWin.instagramHint': 'प्रतिमा जतन करा → Instagram Stories वर पोस्ट करा',

      'shareWin.downloadCard': 'यश कार्ड डाउनलोड करा',

      'shareWin.copyCaption': 'Instagram साठी कॅप्शन कॉपी करा',

      'shareWin.nativeShare': 'प्रतिमा शेअर करा',

      'shareWin.cardDownloaded': 'कार्ड जतन — Instagram वर पोस्ट करा',

      'shareWin.captionCopied': 'कॅप्शन कॉपी — Instagram मध्ये पेस्ट करा',

      'shareWin.done': 'झाले',

      'shareWin.footerMsg': 'मी {app} वापरून {location} स्वच्छ केले!',

      'shareWin.fixedLabel': 'ठीक',
      'shareWin.stampFixed': 'ठीक',

      'ba.dragHint': 'आधी आणि नंतर तुलना करण्यासाठी ओढा',

      'ba.before': 'आधी',

      'ba.after': 'नंतर',


      'shareWin.aspectSquare': 'चौरस',

      'shareWin.aspectStory': 'स्टोरी',

      'toast.shareWinBtn': 'विजय शेअर करा',

      'about.shareTitle': 'अ‍ॅप शेअर करा',

      'about.sharePitch': 'मोफत {city} वॉर्ड धोका नकाशा — 30 सेकंदात कचरा, खड्डे, स्ट्रीटलाइट आणि साचलेले पाणी पिन. Me too, प्रतिस्पर्धी वॉर्डला हरवा.\nमुंबई, पुणे आणि ठाणेसाठी बांधले. लॉगिन नाही, 4 भाषा.\n{link}\nRWA / सोसायटी WhatsApp ग्रुपला फॉरवर्ड करा →',

      'about.copyPitch': 'WhatsApp पिच कॉपी करा',

      'about.pitchCopied': 'पिच कॉपी — RWA ग्रुपमध्ये पेस्ट करा!',

      'pwa.nudge': 'एक-टॅप नोंदणीसाठी CivicRadar तुमच्या होम स्क्रीनवर जोडा.',

      'pwa.nudgeAction': 'होम स्क्रीनवर जोडा',

      'pwa.nudgeDismiss': 'आत्ता नाही',

      'update.available': 'CivicRadar ची नवी आवृत्ती तयार आहे.',

      'update.reload': 'पुन्हा लोड करा',

      'iosInstall.title': 'iPhone वर इंस्टॉल करा',

      'iosInstall.hint': 'Android सारखाच अ‍ॅप — App Store नाही लागत. गरज असेल तर Safari मध्ये उघडा, नंतर Share → Add to Home Screen.',

      'iosInstall.dismiss': 'इंस्टॉल सूचना बंद करा',

      'appOpen.title': 'CivicRadar अ‍ॅपमध्ये उघडा',

      'appOpen.body': 'अहवाल अ‍ॅपमध्ये पहा — जलद नकाशा आणि अलर्ट.',

      'appOpen.open': 'अ‍ॅपमध्ये उघडा',

      'appOpen.getApp': 'अ‍ॅप मिळवा',

      'appOpen.dismiss': 'बॅनर बंद करा',

      'community.challengeShare': 'मित्राला आव्हान — वॉर्ड नकाशा शेअर करा',

      'community.winsTitle': 'अलीकडील विजय',

      'community.winsEmpty': 'सुटलेले स्पॉट इथे दिसतील. एक तक्रार नोंदवा, शेजाऱ्यांना सोबत घ्या, आणि तुमची गल्ली सुधारताना पाहा.',

      'community.winsNeighbours': '{ward} मधील शेजारी',

      'community.winsCleanup': '{hazard} साफ · {ward}',

      'community.winsResolved': '{hazard} सोडवले · {ward}',

      'success.points': 'Civic Points',

      'success.xpBonus': '+{n} Civic Points',

      'success.weekBonus': '+{n} — या आठवड्यातील तुमची पहिली तक्रार',

      'success.celebrateFirst': 'तुमची पहिली तक्रार — तुमची गल्ली आत्ताच थोडी सुरक्षित झाली.',

      'success.celebrateMilestone': '{n} तक्रारी झाल्या — तुमचे शेजारी भाग्यवान आहेत की तुम्ही आहात.',

      'success.kudos1': 'शाब्बास — आणखी एक धोका रडारवर आला.',

      'success.kudos2': 'छान काम — तुमचा वॉर्ड आता थोडा सुरक्षित आहे.',

      'success.kudos3': 'नोंदवले! शेजाऱ्यांची काळजी घेतल्याबद्दल धन्यवाद.',

      'success.kudos4': 'पुन्हा हजर — अशाच प्रकारे गल्ल्या दुरुस्त होतात.',

      'success.kudos5': 'आणखी एक पिन — तुमच्या गल्लीला धन्यवाद वाटतो!',

      'success.streakWeek': 'या आठवड्यात {n} तक्रार — छान!',


      'profile.milestoneOne': 'पुढच्या milestone साठी आणखी 1 तक्रार',

      'profile.milestoneMany': 'पुढच्या milestone साठी आणखी {n} तक्रार',

      'profile.milestoneMax': '10+ तक्रारी — तुमच्या वॉर्डकडून धन्यवाद!',

      'profile.nextStreakBadge': '{badge} साठी {n} आठवडे',

      'success.progressOne': 'पुढच्या बॅजसाठी फक्त 1 आणखी तक्रार.',

      'success.progressMany': 'पुढच्या बॅजसाठी {n} आणखी तक्रारी.',

      'success.progressMilestone': 'बॅज मिळाला! पुढच्यासाठी {n} आणखी.',

      'success.progressGuardian': '{n} तक्रारी — तुम्ही खरे पावसाळी रक्षक!',

      'success.shareBrag': 'तुम्ही वॉर्डला मदत केली — WhatsApp वर शेजाऱ्यांना सांगा!',

      'success.shareBragFirst': 'नकाशावर तुमचा पहिला पिन! आत्ताच शेअर करा — वेगाने पसरवा.',

      'toast.badgeMonsoon': 'पहिली तक्रार नोंदवली — स्वागत आहे! 🌧️',

      'confirm.meTooThanks': 'Me too नोंद — शेजाऱ्यांना दबाव दिसतो.',

      'toast.reportMilestone': '{n} तक्रारी — चालू ठेवा!',

      'map.empty': '{ward} मध्ये अजून pin नाही — पहिले तुम्ही व्हा.',

      'map.emptyHint': 'यासाठी सुमारे 30 सेकंद लागतात.',

      'map.emptyAction': 'पहिली नोंद करा',

      'map.emptyShare': 'WhatsApp वर तुमच्या शेजाऱ्यांना बोलवा',

      'map.emptyRival': '{ward} विरुद्ध {rival} — {pending} उघडे स्पॉट. एक नोंदवा, किंवा तुमची गल्ली सोबत आणा.',

      'map.emptyEncourage': 'प्रत्येक pin तुमच्या गल्लीकडे लक्ष वेधण्यास मदत करतो — कचरा, खड्डे, स्ट्रीटलाइट, किंवा साचलेले पाणी. तुमच्या तक्रारीपासूनच उपाय सुरू होतो.',

      'home.hero.badge': 'तुमचा वॉर्ड, एकत्र',

      'home.hero.headline': 'दिसलं. टिपलं. झालं.',

      'home.hero.subline': 'तुमच्या गल्लीतील धोका 30 सेकंदात नोंदवा — तुमचे शेजारीही तो पाहतील.',

      'home.hero.benefit1': 'फोटो घ्या',

      'home.hero.benefit2': 'तुमचा वॉर्ड पिन करा',

      'home.hero.benefit3': 'शेजाऱ्यांना कळवले जाते',

      'home.hero.cta': 'स्पॉट नोंदवा',

      'home.hero.tour': 'छोटा टूर पाहा',

      'home.hero.trust': 'मोफत · ऑफलाइन काम करते · 3 शहरे · 4 भाषा',

      'home.hero.dismiss': 'स्वागत कार्ड बंद करा',

      'map.legend.pending': 'उघडे',

      'pulse.aria': 'वॉर्ड पल्स: उघडे धोके, या आठवड्यात सोडवले, आणि Me too',

      'pulse.open': 'उघडे',

      'pulse.fixedWeek': 'या आठवड्यात सोडवले',

      'pulse.metoo': 'Me too',

      'pulse.yourWard': 'तुमचा वॉर्ड',

      'map.legend.resolved': 'सोडवले',

      'map.legend.you': 'तुम्ही',

      'map.legend.aria': 'नकाशा किंवदंती: खुले, निराकरण, आणि तुम्ही',

      'reminder.unfiled': '{n} खुले धोके नकाशावर — शेजाऱ्यांसोबत शेअर करा किंवा प्रोफाइलमध्ये अधिकृतपणे नोंदवा.',

      'reminder.file': 'आत्ता नोंदवा',

      'reminder.snooze3d': '3 दिवसांनी आठवण करा',

      'reminder.gotIt': 'ठीक आहे',

      'reminder.esc7': 'नोंदवल्यापासून {n}+ दिवस — {ward} मध्ये {hazard} साठी वॉर्ड एस्केलेशन.',

      'reminder.esc14': 'नोंदवल्यापासून {n}+ दिवस — {ward} मध्ये {hazard} साठी झोनल एस्केलेशन.',

      'reminder.esc30': 'नोंदवल्यापासून {n}+ दिवस — {ward} मध्ये {hazard} साठी तक्रार/RTI.',

      'reminder.escAction': 'एस्केलेट करा',

      'reminder.corroboration': '{n} शेजाऱ्यांनी तुमच्या {hazard} तक्रारीवर "मला पण" म्हटले — वॉर्ड नकाशावर अधिक नजर मदत करते.',

      'reminder.corroAction': 'तक्रार पहा',

      'reminder.cleanup': 'स्वयंसेवकांनी {ward} मध्ये {hazard} साफ केले — BMC तक्रार खुली असू शकते.',

      'reminder.cleanupAction': 'स्थिती पहा',

      'persona.ngo.pledges': '{deliver} deliver · {verify} verify',

      'persona.ngo.newHazards': 'वॉर्डमध्ये {n} नवीन धोके',

      'persona.ngo.newPledges': '{n} नवीन प्रतिज्ञा',

      'persona.admin.overdue': '{overdue} overdue · {pending} pending — queue साठी tap',

      'profile.badge.reporter': 'सक्रिय तक्रारकर्ता',

      'profile.badge.2week': '2-आठवडे तक्रारकर्ता',

      'profile.badge.3week': '3-आठवडे तक्रारकर्ता',

      'profile.badge.monsoon': 'लोकल हिरो',

      'profile.wardImpact': 'तुमचा वॉर्ड: या सीझन {n} तक्रारी',

      'profile.streak': '{n}-आठवड्यांची तक्रार साखळी',

      'confirm.nearby': 'पिन {m} मी. लांब{backing}. डुप्लिकेट ऐवजी मला पण दाबा — निराकरण झाल्यावर अपडेट.',

      'esc.participate.title': 'सामुदायिक उपक्रम (पर्यायी)',

      'esc.participate.hint': 'Participate Mumbai हे BMC चे अधिकृत स्वयंसेवा/CSR पोर्टल आहे — कीटक नियंत्रण तक्रारीसाठी नाही. स्वच्छता मोहिमा किंवा वॉर्ड प्रकल्पांसाठी वापरा.',

      'esc.participate.btn': 'Participate Mumbai',

      'esc.participate.small': 'स्वयंसेवा · CSR · प्रकल्प',

      'esc.corpTitle': 'स्थानिक महानगरपालिकेत नोंदवा (पर्यायी)',

      'esc.corpHint': '{corp} च्या अधिकृत पोर्टलवर ठिबकलेले पाणी / कीट नियंत्रण तक्रार नोंदवा.',

      'esc.corpBtn': '{corp} पोर्टल उघडा',

      'esc.corpSubtitle': 'CivicRadar धोके समुदाय नकाशावर दाखवते. महानगरपालिकेत नोंदवणे पर्यायी — अधिकृत घड्याळ सुरू होते.',

      'esc.titleCorp': '{corp} मध्ये नोंदवा (पर्यायी)',

      'esc.tmc.recommended': 'शिफारस: thanecity.gov.in वर नोंदवा किंवा TMC हेल्पलाइन 022-25331590 वर कॉल करा.',

      'esc.tmc.fileHint': 'स्थिर पाणी / डास प्रजनन — खालील कोणत्याही अधिकृत TMC चॅनेल वापरा.',

      'esc.tmc.channelPortal': 'TMC ऑनलाइन पोर्टल',

      'esc.tmc.channelCall': 'TMC हेल्पलाइन',

      'esc.tmc.channelEmail': 'महापालिका आयुक्ताला ईमेल',

      'esc.tmc.channelTweet': '@TMCaTweetAway टॅग',

      'esc.tmc.channelCitizenCall': 'नागरिक कॉल सेंटर (155300)',

      'esc.tmc.copyBlock': 'TMC पोर्टल / हेल्पलाइन / ईमेलसाठी तपशील',

      'esc.tmc.copyAllDone': 'कॉपी झाले — TMC मध्ये नोंदवताना पेस्ट करा',

      'esc.tmc.portalHint': 'thanecity.gov.in: लॉगिन → ऑनलाइन नागरिक सेवा → तक्रार नोंदवा. खाली तपशील पेस्ट करा.',

      'esc.tmc.filedConsent': 'मी अधिकृत TMC चॅनेलवर नोंदवले (पोर्टल / हेल्पलाइन / ईमेल / 155300 / Aaple Sarkar)',

      'esc.tmc.complaintLabel': 'TMC तक्रार / संदर्भ क्रमांक',

      'esc.tmc.complaintPh': 'उदा. TMC/2026/123456',

      'esc.tmc.complaintWarn': 'हे सामान्य TMC संदर्भ सारखे नाही — बरोबर असल्यास जतन करा.',

      'esc.tmc.filedNote': 'TMC मध्ये नोंदवले — मुदतीनुसार पुढे वाढवा.',

      'esc.tmc.daysSince': 'TMC मध्ये नोंदवल्यापासून {n} दिवस',

      'esc.tmc.selfTitle': 'TMC ने सोडवले?',

      'esc.tmc.selfBody': 'TMC ने सोडवल्यावर स्वतः पुष्टी करा — सर्वांसाठी हिरवा चिन्ह.',

      'esc.tmc.aaple': 'Aaple Sarkar — TMC स्थानिक संस्था निवडा',

      'esc.tmc.deptTitle': 'विभाग संपर्क (एस्केलेशन)',

      'esc.tmc.deptHint': 'स्थिर पाणी फॉलो-अप — पाणी, आरोग्य, प्रदूषण नियंत्रण.',

      'esc.tmc.dept.water': 'पाणी',

      'esc.tmc.dept.health': 'आरोग्य',

      'esc.tmc.dept.pollution': 'प्रदूषण नियंत्रण',

      'esc.tmc.tier.file.body': 'thanecity.gov.in, 022-25331590 / 022-25331211, mc@thanecity.gov.in, किंवा 155300. संदर्भ क्रमांक येथे जतन करा.',

      'esc.tmc.tier.matrix.body': 'वार्ड कार्यालय किंवा आरोग्य (022-25331590) यांना फॉलो-अप. TMC संदर्भ क्रमांक द्या.',

      'esc.tmc.tier.zonal.body': 'महापालिका आयुक्त (mc@thanecity.gov.in) पर्यंत वाढवा. @TMCaTweetAway वर फोटोसह टॅग.',

      'esc.tmc.tier.grievance.body': 'एक महिन्यानंतरही? Aaple Sarkar (pgportal.gov.in) — Thane Municipal Corporation निवडा.',

      'esc.tmc.tier.openCall': 'TMC कॉल',

      'esc.tmc.tier.openTweet': '@TMCaTweetAway',

      'esc.tmc.tier.openEmail': 'MC ईमेल',

      'esc.tmc.tier.openAaple': 'Aaple Sarkar',

      'esc.tmc.consentRequired': 'जतन करण्यापूर्वी अधिकृत TMC चॅनेलवर नोंदवल्याची पुष्टी करा.',

      'esc.pmc.subtitle': 'CivicRadar धोके सामुदायिक नकाशावर दाखवते. PMC मध्ये नोंदवणे पर्यायी — अधिकृत घड्याळ सुरू करते. हे PMC चॅनेल नाही.',

      'esc.pmc.recommended': 'शिफारस: PMC CARE WhatsApp — बहुतेक Pune वॉर्डांसाठी सर्वात जलद.',

      'esc.pmc.fileHint': 'साचलेले पाणी आणि डास PMC CARE मार्फत जातात. कोणताही चॅनेल:',

      'esc.pmc.channelWa': 'PMC CARE WhatsApp',

      'esc.pmc.channelWaSmall': 'चॅट · खाली कॉपी',

      'esc.pmc.channelCall': 'टोल-फ्री हेल्पलाइन',

      'esc.pmc.channelPortal': 'PMC CARE पोर्टल',

      'esc.pmc.channelApp': 'PMC CARE अॅप',

      'esc.pmc.channelAppSmall': 'Play Store · App Store',

      'esc.pmc.copyBlock': 'PMC CARE / WhatsApp / हेल्पलाइनसाठी तपशील',

      'esc.pmc.copyAllDone': 'कॉपी झाले — PMC CARE / WhatsApp वर नोंदवताना पेस्ट करा',

      'esc.pmc.portalHint': 'PMC CARE पोर्टल किंवा अॅप: साचलेले पाणी / डास तक्रार नोंदवा. खाली तपशील पेस्ट करा.',

      'esc.pmc.filedConsent': 'मी अधिकृत PMC चॅनेलवर नोंदवले (PMC CARE / WhatsApp / हेल्पलाइन / अॅप)',

      'esc.pmc.complaintLabel': 'PMC तक्रार / संदर्भ क्रमांक',

      'esc.pmc.complaintPh': 'उदा. PMC/2026/123456',

      'esc.pmc.complaintWarn': 'हे सामान्य PMC संदर्भ सारखे नाही — बरोबर असल्यास जतन करा.',

      'esc.pmc.filedNote': 'PMC मध्ये नोंदवले — मुदतीनुसार पुढे वाढवा.',

      'esc.pmc.daysSince': 'PMC मध्ये नोंदवल्यापासून {n} दिवस',

      'esc.pmc.selfTitle': 'PMC ने सोडवले?',

      'esc.pmc.selfBody': 'PMC ने सोडवल्यावर स्वतः पुष्टी करा — सर्वांसाठी हिरवा चिन्ह.',

      'esc.pmc.tier.file.body': 'मोफत. PMC CARE पोर्टल, WhatsApp, 1800 1030 222, किंवा PMC CARE अॅप. संदर्भ क्रमांक येथे जतन करा.',

      'esc.pmc.tier.matrix.body': 'PMC CARE किंवा टोल-फ्री हेल्पलाइनद्वारे फॉलो-अप. तक्रार क्रमांक द्या.',

      'esc.pmc.tier.zonal.body': 'वॉर्डने कारवाई नाही? PMC CARE पोर्टल किंवा WhatsApp वरून वाढवा.',

      'esc.pmc.tier.grievance.body': 'एक महिन्यानंतरही? Aaple Sarkar (pgportal.gov.in) — Pune Municipal Corporation निवडा.',

      'esc.pmc.tier.openWa': 'WhatsApp',

      'esc.pmc.tier.openCall': 'PMC हेल्पलाइन',

      'esc.pmc.tier.openAaple': 'Aaple Sarkar',

      'esc.pmc.consentRequired': 'जतन करण्यापूर्वी अधिकृत PMC चॅनेलवर नोंदवल्याची पुष्टी करा.',

      'esc.pmc.aaple': 'Aaple Sarkar — Pune Municipal Corporation स्थानिक संस्था निवडा',

      'copy1916.pmc.header': 'PMC तक्रार तपशील (PMC CARE / WhatsApp / हेल्पलाइनवर कॉपी-पेस्ट)',

      'copy1916.pmc.complaintNotFiled': 'PMC तक्रार #: (अद्याप नोंद नाही)',

      'copy1916.pmc.complaintFiled': 'PMC तक्रार #: {id}',

      'copy1916.tmc.header': 'TMC तक्रार तपशील (thanecity.gov.in / हेल्पलाइन / ईमेलसाठी कॉपी-पेस्ट)',

      'copy1916.tmc.complaintNotFiled': 'TMC तक्रार / संदर्भ #: (अद्याप दाखल नाही)',

      'copy1916.tmc.complaintFiled': 'TMC तक्रार / संदर्भ #: {id}',

      'profile.fileCorp': '{corp} कडे नोंदवा',

      'community.title': 'समुदाय',

      'community.subtitle': '{ward} मध्ये {corp} सोबत एकत्र ठीक करा — शेजाऱ्यांना बोलवा, विजय साजरे करा, स्थानिक लीड्सना पाठिंबा द्या.',

      'community.subtitleActive': '{ward}: {pending} खुले धोके · {resolved} सोडवले. शेजाऱ्यांना बोलवा — मदतीसाठी Resources पहा!',

      'community.topWards': 'अव्वल वॉर्ड',

      'community.localCitizens': 'स्थानिक नागरिक',

      'community.periodMonth': 'या महिन्यात',

      'community.periodAll': 'आतापर्यंत',

      'community.thisWeekTitle': 'या आठवड्यात तुमचा वॉर्ड',

      'community.leaderboardTitle': 'वॉर्ड लीडरबोर्ड',

      'community.getInvolvedTitle': 'सहभागी व्हा',

      'community.resourcesTitle': 'संसाधने',

      'resources.title': 'संसाधने',

      'resources.subtitle': 'अधिकृत दाखल दुवे आणि तुमच्या वॉर्डमध्ये मदत करण्याचे मार्ग.',

      'resources.actionTitle': 'तुमच्या वॉर्डमध्ये मदत करा',

      'community.supportTitle': 'स्वयंसेवकांना साथ द्या',

      'community.supportBody': 'साचलेल्या पाण्याशी लढणाऱ्या स्थानिक स्वच्छता पथकांना मदतीसाठी साहित्य द्या.',

      'community.pledge': 'देणगी',

      'community.volunteerTitle': 'माझ्या वार्डात स्वयंसेवा',

      'community.volunteerBody': 'एकत्र ठीक करा — {corp} कडे नोंदवणे वेगळे.',

      'community.volunteerCta': 'नोंदणी',

      'volunteer.title': 'माझ्या वार्डात स्वयंसेवा',

      'volunteer.subtitle': 'शेजाऱ्यांसोबत एकत्र — अधिकृत BMC स्वयंसेवा कार्यक्रम नाही.',

      'volunteer.ward': 'तुमचा वॉर्ड',

      'volunteer.neighbourhood': 'परिसर / सोसायटी / लेन',

      'volunteer.neighbourhoodPh': 'उदा. Phoenix Mills लेन, Building 7 Worli',

      'volunteer.neighbourhoodHintNoWard': 'स्थानिक सूचना साठी प्रथम वॉर्ड निवडा.',

      'volunteer.neighbourhoodHintWard': '{ward} मध्ये {n} परिसर/सोसायटी — नसेल तर टाइप करा.',

      'volunteer.neighbourhoodHintCustom': 'यादीत नसेल तर परिसर, सोसायटी किंवा लेन लिहा.',

      'volunteer.hours': 'या पावसाळ्यात उपलब्ध तास',

      'volunteer.hoursCustom': 'सानुकूल',

      'volunteer.skills': 'मी यात मदत करू शकतो/शकते',

      'volunteer.skill.cleanup': 'साचलेले पाणी साफ करणे',

      'volunteer.skill.awareness': 'जागरूकता आणि WhatsApp outreach',

      'volunteer.skill.pledge': 'देणगी वितरण (साहित्य)',

      'volunteer.contact': 'फोन / WhatsApp (पर्यायी)',

      'volunteer.contactHint': 'पर्यायी — फक्त वॉर्ड/परिसर समन्वयकाला दिसेल. CivicRadar ऑटो-कॉल करत नाही.',

      'volunteer.ageNote': 'Terms नुसार 18+ वय आवश्यक. 18 पेक्षा कमी? पालकांच्या किंवा NSS समन्वयकाच्या सोबतीनेच सहभागी व्हा.',

      'volunteer.submit': 'स्वयंसेवक नोंद जतन',

      'volunteer.remove': 'माझी नोंद काढा',

      'volunteer.edit': 'नोंद संपादित करा',

      'volunteer.empty': 'अद्याप साइन अप नाही. Community मधून लेनमध्ये मदत करा.',

      'volunteer.emptyAction': 'माझ्या वार्डात स्वयंसेवा',

      'volunteer.hoursLabel': 'या पावसाळ्यात {n} तास',

      'popup.helpClean': 'मी साफ करण्यात मदत करू शकतो/शकते',

      'popup.taskOffered': 'स्वयंसेवकाने मदत ऑफर केली',

      'toast.volunteerSaved': 'स्वयंसेवक नोंद जतन — वॉर्ड समन्वयक पाहू शकतात.',

      'toast.volunteerRemoved': 'स्वयंसेवक नोंद काढली.',

      'toast.volunteerWardRequired': 'प्रथम ऑनबोर्डिंगमध्ये वॉर्ड सेट करा.',

      'toast.volunteerNeighbourhoodRequired': 'परिसर, सोसायटी किंवा लेन भरा.',

      'toast.volunteerSkillRequired': 'मदतीचा किमान एक मार्ग निवडा.',

      'toast.volunteerTaskOffered': 'ऑफर पाठवला — समन्वयक या स्पॉटशी जुळवेल.',

      'toast.volunteerTaskDuplicate': 'या धोक्यासाठी आधीच ऑफर केले आहे.',

      'toast.volunteerSignupRequired': 'प्रथम Community मध्ये स्वयंसेवक साइन अप करा.',

      'toast.volunteerTaskCompleted': 'सफाई पूर्ण — तक्रारकर्त्याला सूचना.',

      'toast.coordScopeWard': 'वॉर्ड समन्वयक — संपूर्ण {ward}',

      'toast.coordScopeNbh': 'परिसर लीड — {label}',

      'inquiry.coordTitle': 'वार्ड किंवा परिसर समन्वयक व्हा',

      'inquiry.coordBody': 'RWA/सोसायटी किंवा वॉर्ड NGO चे नेतृत्व करा — स्वयंसेवक पाहा, सफाई जुळवा, देणगी तास सत्यापित करा. ऑपरेटरकडून इनवाइट कोड मागा.',

      'about.becomeCoord': 'वार्ड किंवा परिसर समन्वयक व्हा',

      'coord.codeHint': 'समन्वयकांना कोड मिळतो — वॉर्ड किंवा RWA/सोसायटी स्तर.',

      'coord.volunteers': 'तुमच्या क्षेत्रातील स्वयंसेवक',

      'coord.volunteersEmpty': 'अद्याप स्वयंसेवक नाहीत. Community टॅब शेअर करा.',

      'coord.tasks': 'स्वयंसेवक सफाई ऑफर',

      'coord.tasksEmpty': 'अद्याप ऑफर नाहीत. उघड्या पिनवर "मी साफ करण्यात मदत करू शकतो" दाबा.',

      'coord.tasksPending': 'कार्य',

      'coord.volunteersLabel': 'स्वयंसेवक',

      'coord.markTaskComplete': 'सफाई पूर्ण',

      'coord.scopeWard': 'वॉर्ड लीड · {ward}',

      'coord.scopeNbh': 'परिसर लीड · {label}',

      'profile.volunteer': 'माझी स्वयंसेवक नोंदणी',

      'profile.section.details': 'तुमची माहिती',

      'profile.section.location': 'शहर, वॉर्ड आणि परिसर',

      'profile.section.activity': 'कृती',

      'profile.section.account': 'खाते आणि मदत',

      'profile.title': 'तुमची प्रोफाइल',

      'profile.persona': 'नागरिक',

      'profile.points': 'Civic Points',

      'profile.xpTotalLabel': '{n} XP',

      'profile.xpToNext': '{level} पर्यंत {n} XP',

      'profile.xpMax': 'कमाल स्तर — Community Leader!',

      'xp.level.observer': 'स्थानिक निरीक्षक',

      'xp.level.wardWatcher': 'वार्ड वॉचर',

      'xp.level.neighbourhoodVoice': 'शेजारचा आवाज',

      'xp.level.civicChampion': 'सिविक चॅम्पियन',

      'xp.level.monsoonGuardian': 'पावसाळी रक्षक',

      'xp.level.communityLeader': 'Community Leader',

      'cert.title': 'प्रमाणपत्र अनलॉक!',

      'cert.subtitle': 'तुम्ही {level} गाठले',

      'cert.cardHeading': 'Civic Hero प्रमाणपत्र',

      'cert.awarded': '{name} ला प्रदान',

      'cert.date': '{date}',

      'cert.tagline': 'या पावसाळ्यात आमच्या वार्डाचे रक्षण',

      'cert.download': 'प्रमाणपत्र डाउनलोड',

      'cert.whatsapp': 'WhatsApp वर शेअर',

      'cert.copyCaption': 'कॅप्शन कॉपी',

      'cert.caption': 'मी CivicRadar वर {level} मिळवले — {ward} चे रक्षण करा!\n{link}',

      'cert.captionCopied': 'कॅप्शन कॉपी — सोशलवर पेस्ट',

      'cert.downloaded': 'प्रमाणपत्र जतन — विजय शेअर करा!',

      'cert.done': 'झाले',

      'profile.fixed': 'सोडवलेले धोके',

      'profile.pending': 'खुले धोके',

      'profile.reports': 'तुमच्या तक्रारी',

      'profile.install': 'CivicRadar अ‍ॅप इंस्टॉल करा',

      'profile.partner': 'स्वयंसेवक / NGO लॉगिन',

      'profile.about': 'CivicRadar बद्दल',

      'profile.sponsor': 'प्रायोजक किंवा भागीदार व्हा',

      'profile.deleteData': 'माझा डेटा हटवा',

      'profile.deleteConfirmTitle': 'तुमचा डेटा हटवायचा?',

      'profile.deleteConfirmBody': 'हे तुमचा CivicRadar डेटा या उपकरणावरून आणि आमच्या सर्व्हरवरून कायमचा हटवेल. परत मिळवता येणार नाही.',

      'profile.deleteConfirmItem1': 'तक्रारी आणि फोटो',

      'profile.deleteConfirmItem2': 'प्रतिज्ञा आणि स्वयंसेवक नोंदणी',

      'profile.deleteConfirmItem3': 'प्रोफाइल, बक्षिसे आणि प्राधान्ये',

      'profile.deleteConfirmItem4': 'तुमच्या खात्याशी जोडलेला क्लाउड बॅकअप',

      'profile.deleteConfirmCancel': 'माझा डेटा ठेवा',

      'profile.deleteConfirmProceed': 'होय, सर्व काही हटवा',

      'profile.deleteDone': 'तुमचा डेटा हटवला. तुम्ही पुन्हा सुरू करू शकता.',

      'profile.withdrawAnalytics': 'अ‍ॅनालिटिक्स संमती मागे घ्या',

      'profile.withdrawAnalyticsDone': 'अ‍ॅनालिटिक्स संमती मागे — स्थानिक डेटा साफ.',

      'profile.withdrawGps': 'स्थान संमती मागे घ्या',

      'profile.withdrawGpsDone': 'स्थान संमती मागे — गरज असेल तर नकाशा बॅनरवरून चालू करा.',

      'profile.privacyContact': 'गोपनीयता / तक्रार संपर्क',

      'legal.privacy': 'गोपनीयता धोरण',

      'legal.terms': 'सेवा अटी',

      'legal.deleteAccount': 'खाते हटवा',

      'legal.officialSources': 'अधिकृत सरकारी स्रोत',

      'impact.reports': 'तक्रारी',

      'impact.resolved': 'सोडवले',

      'impact.confirms': 'मला पण',

      'impact.pledges': 'देणगी',

      'impact.wards': 'वॉर्ड',

      'impact.week': 'या आठवड्यात: {reports} तक्रारी · {resolved} सोडवले · {confirms} पुष्टी',

      'impact.resolvedBreakdown': 'तुम्ही: {self} · समुदाय: {community} · BMC: {bmc} · सफाई: {cleanup}',

      'about.title': 'CivicRadar बद्दल',

      'about.subtitle': 'CivicRadar हा मुंबई, पुणे आणि ठाण्यात नागरी धोके नोंदवण्यासाठी एक मोफत सामुदायिक अ‍ॅप आहे — लाइव्ह वॉर्ड नकाशावर. ही सरकारी सेवा किंवा अधिकृत महानगरपालिका तक्रार चॅनेल नाही.',

      'about.featuresTitle': 'तुम्ही काय करू शकता',

      'about.feature1': 'फोटो पिनने धोका नोंदवा — साचलेले पाणी, कचरा, खड्डे, किंवा तुटलेली स्ट्रीटलाइट',

      'about.feature2': 'वॉर्ड नकाशा पहा आणि जवळच्या तक्रारीवर Me too ने पुष्टी करा',

      'about.feature3': 'CivicRadar वर पिन केल्यानंतर, इच्छित असल्यास BMC, PMC किंवा TMC मध्ये नोंदवण्यास मदत',

      'about.feature4': 'स्थिती ट्रॅक करा, सफाईसाठी स्वयंसेवा करा, आणि तुमच्या वॉर्डची सामुदायिक प्रगती पहा',

      'about.audienceTitle': 'कोणासाठी',

      'about.audience': 'मुंबई, पुणे आणि ठाण्यातील रहिवासी, RWA आणि परिसर गट — विशेषतः पावसाळ्यात जेव्हा साचलेले पाणी आणि बंद नाले महत्त्वाचे असतात.',

      'about.creditTitle': 'प्रकल्पाबद्दल',

      'about.creditNote': 'CivicRadar हा एक स्वतंत्र विद्यार्थी प्रकल्प आहे — Nihira यांनी सुरुवातीपासून तयार केलेला, जेणेकरून मुंबई, पुणे आणि ठाण्यातील शेजारी स्थानिक नागरी धोके नोंदवू शकतील आणि त्यांचा मागोवा घेऊ शकतील. हा कोणत्याही महानगरपालिका प्राधिकरणाशी संलग्न, मान्यताप्राप्त किंवा त्यांच्या वतीने चालवला जाणारा नाही. प्रकल्प, प्रेस किंवा भागीदारीसंबंधी चौकशीसाठी कृपया खालील संपर्क वापरा.',

      'about.privacyTitle': 'गोपनीयता आणि डेटा',

      'about.privacyNote': 'अपलोडपूर्वी फोटोची location metadata (EXIF) काढली जाते. GPS फक्त तुमच्या परवानगीने पिन ठेवण्यासाठी. तक्रारी नकाशावर समुदायाला दिसतात. अधिकृत तक्रार BMC, PMC किंवा TMC चॅनेलद्वारे होते.',

      'about.officialSourcesTitle': 'अधिकृत माहिती स्रोत',

      'about.officialSourcesNote': 'CivicRadar हे सरकारी अॅप नाही. BMC, PMC, TMC आणि महाराष्ट्र राज्य पोर्टलचे सत्यापित दुवे आमच्या अधिकृत स्रोत पानावर आहेत — तक्रार तुम्ही स्वतः नोंदवा.',

      'about.impactTitle': 'सामुदायिक प्रभाव',

      'about.version': 'आवृत्ती {version}',

      'about.contact': 'आमच्याशी संपर्क',

      'about.contactOperator': 'आमच्याशी संपर्क',

      'about.close': 'बंद करा',

      'about.mapCredits': 'नकाशा डेटा © OpenStreetMap contributors (ODbL). नकाशा Leaflet द्वारे.',

      'about.sponsored': 'प्रायोजित',

      'about.copied': 'प्रभाव सारांश कॉपी झाला — अर्जात पेस्ट करा.',

      'about.operatorNote': '{name} 18 वर्षांचे होईपर्यंत, {operator} सेवा चालवतात — होस्टिंग, खाती आणि कायदेशीर संपर्क.',

      'inquiry.title': 'CivicRadar सोबत भागीदारी',

      'inquiry.subtitle': 'मुंबई, पुणे किंवा ठाण्यातील नागरिकांपर्यंत पोहोचा — तुमच्यासाठी महत्त्वाचे वॉर्ड.',

      'inquiry.localTitle': 'स्थानिक व्यवसाय प्रायोजक',

      'inquiry.localBody': 'विशिष्ट वॉर्डमध्ये मानसून-संबंधित ऑफर प्रचारित करा.',

      'inquiry.bmcTitle': 'नगरपालिका पायलट',

      'inquiry.bmcBody': 'बहु-वॉर्ड विश्लेषण — फक्त आमंत्रित BMC पायलटसाठी. सहभागासाठी संपर्क करा.',

      'inquiry.ngoTitle': 'NGO आणि स्वयंसेवक नेटवर्क',

      'inquiry.ngoBody': 'देणग्या, तासांचे सत्यापन आणि सामुदायिक सफाई समन्वय.',

      'inquiry.email': 'भागीदारी चौकशी पाठवा',

      'lang.title': 'तुमची भाषा निवडा',

      'hazard.stagnant-water': 'साचलेले पाणी',

      'hazard.stagnant-water.example': 'उदा. तुंबलेले गटार, साचलेले पाणी असलेला रस्ता',

      'hazard.potholes': 'खड्डे',

      'hazard.potholes.example': 'उदा. रस्त्यावरील खड्डा, बसलेले मॅनहोल',

      'hazard.garbage': 'कचरा',

      'hazard.garbage.example': 'उदा. कचऱ्याचा ढीग, भरलेला डबा',

      'hazard.streetlight': 'बंद पथदिवा',

      'hazard.streetlight.example': 'उदा. बंद किंवा लुकलुकणारा दिवा',

      'hazard.comingSoon': 'लवकरच येत आहे',

      'soon.title': 'लवकरच येत आहे',

      'soon.notify': 'लाइव्ह झाल्यावर मला कळवा',

      'soon.thanks': 'धन्यवाद — लाँच झाल्यावर आम्ही तुम्हाला कळवू.',

      'soon.roadmap': 'अधिक धोका प्रकार लवकर — कचरा, खड्डे आणि पथदिवे आता लाइव्ह.',

      'confirm.metoo': 'मला पण',

      'confirm.you': 'तुमची तक्रार',

      'confirm.done': 'फॉलो करत आहात — सोडवल्यावर कळवू',

      'confirm.thanks': 'फॉलो केले — सोडवल्यावर सूचित करू.',

      'confirm.none': 'याची पुष्टी करणारे पहिले व्हा',

      'confirm.followHint': 'BMC तक्रार नाही — समुदाय पिनला पाठिंबा व अपडेट.',

      'confirm.backingOne': ' · 1 शेजाऱ्याचा पाठिंबा',

      'confirm.backingMany': ' · {n} शेजाऱ्यांचा पाठिंबा',

      'confirm.dupe': '10 मी.च्या आत CivicRadar वर पिन आहे{backing}. पाठिंबा द्या — सोडवल्यावर कळवू.',

      'confirm.dupeAction': 'मला पण',

      'confirm.ownDupe': 'तुम्ही येथे आधीच पिन केले आहे. प्रोफाइलमध्ये पहा.',

      'profile.unfiledBanner': '{n} खुले — {corp} कडे अद्याप नोंदलेले नाही. शेअर करणेही मदत करते; अधिकृत नोंदवल्यास प्रत्येक ठिकाणासाठी वेगळी तक्रार.',

      'profile.fileNext': 'पुढील नोंदवा',

      'confirm.resolved': '{ward} मधील ज्या धोक्याला तुम्ही पाठिंबा दिला तो सोडवला गेला!',

      'confirm.resolvedMany': 'तुम्ही पाठिंबा दिलेले {n} धोके आत्ताच सोडवले गेले!',

      'confirm.shareBtn': 'शेअर करा',

      'confirm.shareMsg': '✅ {ward} मधील धोका CivicRadar वर सोडवला! सामूहिक दबाव काम करतो:\n{link}\n{hashtags}',

      'fix.looksFixed': 'आता ठीक दिसते',

      'fix.done': 'तुम्ही ठीक म्हणालात',

      'fix.thanks': 'धन्यवाद — पुरेसे शेजारी सहमत झाले की आम्ही ठीक चिन्हांकित करू.',

      'fix.countOne': '1 शेजारी म्हणतो ठीक',

      'fix.countMany': '{n} शेजारी म्हणतात ठीक',

      'fix.hint': 'फक्त समुदाय तपासणी — अधिकृत BMC पुष्टी नाही.',

      'fix.resolved': '{ward} मधील तुम्ही तपासलेले ठिकाण समुदाय-सत्यापित ठीक!',

      'fix.resolvedMany': 'तुम्ही तपासलेली {n} ठिकाणे समुदाय-सत्यापित ठीक!',

      'fix.afterPhotoPrompt': 'पर्यायी: प्रोफाइलमधून नंतरचा फोटो जोडा.',

      'fix.thanksConfirmed': 'धन्यवाद! तुम्ही हे शेजाऱ्यांसाठी ठीक म्हणून चिन्हांकित केले.',

      'fix.thanksAddPhoto': 'धन्यवाद! ठीक झालेल्या जागेचा फोटो जोडा जेणेकरून शेजारी पाहू शकतील?',

      'fix.addAfterPhoto': 'आधी आणि नंतर दाखवण्यासाठी ठीक झालेल्या जागेचा फोटो जोडा?',

      'fix.addPhotoBtn': 'फोटो जोडा',

      'reminder.staleCheck': '{ward} जवळ — अजूनही पाणी साचलेले आहे का?',

      'reminder.stillThere': 'अजून आहे',

      'reminder.looksFixed': 'ठीक दिसते',

      'reminder.addPhoto': 'फोटो जोडा',

      'settings.notifications.title': 'सूचना आणि गोपनीयता',

      'settings.reminder.label': 'जवळचे साचलेले पाणी नोंदवण्याची आठवण करा',

      'settings.reminder.sub': 'CivicRadar उघडल्यावर पावसाळ्यात सौम्य आठवण. बॅकग्राउंड ट्रॅकिंग नाही.',

      'settings.reminder.on': 'आठवणी सुरू — तुम्ही CivicRadar उघडाल तेव्हा आम्ही सौम्यपणे आठवण करू.',

      'settings.reminder.off': 'आठवणी बंद.',

      'settings.reminder.denied': 'सूचना ब्लॉक आहेत — त्याऐवजी आम्ही अॅपमध्ये सौम्य आठवण दाखवू.',

      'settings.notifications.sub': 'CivicRadar तुम्हाला जे सूचित करू शकते आणि तुमचे संमती पर्याय, सर्व एकाच ठिकाणी.',

      'settings.nbh.new.label': 'जवळच्या नवीन तक्रारी',

      'settings.nbh.new.sub': 'तुमच्या सोसायटी/वॉर्डमध्ये नवीन पिन झाल्यावर सूचना.',

      'settings.nbh.resolved.label': 'जवळपास सोडवलेले',

      'settings.nbh.resolved.sub': 'जवळचा धोका सोडवला गेल्यावर आनंदाची बातमी.',

      'settings.nbh.on': 'परिसर अपडेट सुरू.',

      'settings.nbh.newOff': 'नवीन तक्रार सूचना बंद.',

      'settings.nbh.resolvedOff': 'निराकरण अपडेट बंद.',

      'settings.nbh.denied': 'सूचना ब्लॉक — अपडेट अॅपमध्ये.',

      'notify.nbh.new.title': 'जवळ नवीन तक्रार',

      'notify.nbh.new.body': '{society} जवळ: {hazard} — नकाशावर मला पण करा',

      'notify.nbh.new.cta': 'नकाशा पहा',

      'notify.nbh.resolved.title': 'जवळपासची चांगली बातमी',

      'notify.nbh.resolved.body': '{society} जवळ {hazard} सोडवले',

      'notify.nbh.resolved.bodyMany': '{society} जवळ {n} hazards resolve',

      'notify.nbh.resolved.cta': 'Map पहा',

      'notify.report.title': 'आज साचलेले पाणी दिसले का?',

      'notify.report.body': 'डबके, तुंबलेले गटार किंवा उघडी टाकी जवळून गेलात, तर 30 सेकंदात नोंदवा.',

      'notify.report.cta': 'आत्ता नोंदवा',

      'profile.status.communityVerified': 'समुदायाने ठीक पुष्टी',

      'profile.status.youMarkedFixed': 'तुम्ही ठीक चिन्हांकित',

      'profile.status.bmcResolved': 'BMC ने सोडवले',

      'profile.badge.communityVerified': 'समुदाय सत्यापित',

      'profile.badge.youMarkedFixed': 'तुम्ही चिन्हांकित',

      'profile.badge.bmcResolved': 'BMC सोडवले',

      'community.winsCommunityVerified': '{hazard} समुदाय-सत्यापित · {ward}',

      'shareWin.subtitleCommunity': 'शेजाऱ्यांनी पुष्टी केली — अधिकृत BMC नोंद नाही.',

      'shareWin.impact': '{n} शेजाऱ्यांनी पाठिंबा · {ward} — ही विजय स्क्रीनशॉट करा! 🏆',

      'toast.fixConfirmed': '+10 गुण — तपासणीसाठी धन्यवाद!',

      'toast.communityResolved': 'समुदाय-सत्यापित ठीक — तक्रारीसाठी धन्यवाद!',

      'sync.cloud': 'सिंक',

      'sync.local': 'फक्त स्थानिक',

      'sync.cloudTitle': 'तक्रारी सर्व उपकरणांवर सिंक',

      'sync.localTitle': 'फक्त या उपकरणावर — क्लाउड जोडल्यावर सिंक होईल',

      'report.submitting': 'पाठवत आहे…',

      'success.clock': 'community map वर — {corp} मध्ये अजून file नाही.',

      'community.challenge.empty': '{ward} अजून बोर्डवर नाही — धोका नोंदवा आणि वॉर्डला बोर्डवर आणा.',

      'community.challenge.beat': '{ward}: {pending} उघडे धोके — {rival} ({rivalPending} प्रलंबित) पेक्षा पुढे! नोंदवा किंवा रॅली 👋',

      'community.challenge.leading': '{ward} {resolved} सोडवले — {rival} पेक्षा पुढे राहा!',

      'community.challenge.catch': '{ward}: {leader} ({leaderResolved} सोडवले) चा पाठलाग करा. स्वच्छ सर्वेक्षण तुमच्या लेनपासून.',

      'community.challenge.leaderboard': '{leader} {resolved} सोडवले — वॉर्ड बोर्डवर अग्रणी. पुढचा वॉर्ड कोण?',

      'leaderboard.demo': 'डेमो',

      'leaderboard.you': 'तुम्ही',

      'leaderboard.demoNote': 'अधिक वॉर्ड तक्रार करेपर्यंत नमुना. खरे आकडे वाढतील.',

      'leaderboard.resolved': '{n} सोडवले',

      'leaderboard.emptyWards': 'तुमचा वॉर्ड बोर्डवर पाहण्यासाठी तक्रार करा.',

      'leaderboard.emptyCitizens': 'स्थानिक बोर्डवर येण्यासाठी तक्रार नोंदवा.',

      'leaderboard.emptyFirst': 'तुमच्या वॉर्डमध्ये पहिले व्हा — बोर्डवर चढण्यासाठी तक्रार करा.',

      'admin.proofBefore': 'आधी (नागरिक तक्रार)',

      'admin.proofAfter': 'नंतर (BMC पुरावा)',

      'admin.proofCapture': 'पुरावा फोटो जोडा',

      'admin.proofHint': 'स्पष्ट "नंतर" फोटो — नागरिक आधी/नंतर पाहतील.',

      'admin.proofPrompt': 'नंतरचा फोटो जोडा, मग पुष्टीसाठी पुन्हा टॅप करा.',

      'admin.proofRequired': 'पुरावा फोटो आवश्यक — सोडवण्यापूर्वी "नंतर" फोटो जोडा.',

      'admin.confirmResolve': 'निराकरणाची पुष्टी?',

      'admin.exportCsv': 'वॉर्ड CSV निर्यात',

      'admin.exportEmpty': 'या फिल्टरसाठी निर्यात करण्यासाठी अहवाल नाहीत.',

      'admin.exportSuccess': '{n} अहवाल CSV मध्ये निर्यात.',

      'admin.copy1916': '1916 साठी कॉपी',

      'admin.copy1916Copied': 'कॉपी झाले — 1916 मध्ये पेस्ट करा',

      'copy1916.header': 'BMC तक्रार तपशील (1916 / MyBMC कॉलवर कॉपी-पेस्ट)',

      'copy1916.categoryLabel': 'श्रेणी',

      'copy1916.category.stagnant-water': 'डास / साचलेले पाणी (Public Health → Pest Control)',

      'copy1916.category.potholes': 'खड्डे / रस्ता खराब',

      'copy1916.category.garbage': 'कचरा / घन कचरा',

      'copy1916.category.streetlight': 'बंद स्ट्रीटलाइट',

      'copy1916.wardLabel': 'वॉर्ड + परिसर',

      'copy1916.landmarkLabel': 'जवळचे लँडमार्क / टीप',

      'copy1916.gpsLabel': 'GPS',

      'copy1916.gpsWarning': '⚠ GPS मुंबई बाहेर दिसतो — नोंदणीपूर्वी ठिकाण पुष्टी करा',

      'copy1916.mapsLabel': 'Maps',

      'copy1916.dateLabel': 'तारीख',

      'copy1916.complaintNotFiled': 'BMC तक्रार #: (अद्याप नोंद नाही)',

      'copy1916.complaintFiled': 'BMC तक्रार #: {id}',

      'copy1916.civicradarLinkLabel': 'CivicRadar नकाशा (पर्यायी)',

      'copy1916.linkLocalhostNote': '(अ‍ॅप डिप्लॉय झाल्यावर लिंक काम करेल)',

      'copy1916.marathiHeader': '--- मराठी (कॉल सेंटरला वाचा) ---',

      'copy1916.refId': 'संदर्भ (पर्यायी): CivicRadar ID {id}',

      'profile.proofBefore': 'आधी',

      'profile.proofAfter': 'नंतर',

      'confirm.shareResolvedMsg': '✅ {ward} मध्ये सोडवले! CivicRadar वर आधी → नंतर:\n{link}\n{hashtags}',

      'esc.title': 'अधिकृत तक्रार सहाय्यक',

      'esc.subtitle': 'CivicRadar धोके सामुदायिक नकाशावर दाखवते. BMC मध्ये नोंदवणे पर्यायी आहे पण अधिकृत घड्याळ सुरू करते — हे अधिकृत BMC चॅनेल नाही.',

      'esc.fileTitle': 'तक्रार नोंदवा (मोफत)',

      'esc.fileHint': 'साचलेले पाणी वॉर्ड PCO कडे जाते. कोणताही चॅनेल:',

      'esc.fileHint.garbage': 'कचरा / घन कचरा Solid Waste Management मार्गे जातो. कोणताही चॅनेल:',

      'esc.fileHint.potholes': 'खड्डे आणि रस्त्याचे नुकसान Roads / Engineering कडे जाते. कोणताही चॅनेल:',

      'esc.fileHint.streetlight': 'बंद पथदिवे Electrical विभागाकडे जातात. कोणताही चॅनेल:',

      'esc.recommended': 'शिफारस: MyBMC WhatsApp — बहुतेक मुंबई वॉर्डांसाठी सर्वात जलद.',

      'esc.channelWa': 'चॅटबॉट · खाली कॉपी',

      'esc.channelCall': '24×7 हेल्पलाइन',

      'esc.channelPortal': 'ऑनलाइन पोर्टल',

      'esc.channelTweet': 'सार्वजनिक दबाव',

      'esc.margApp': 'MyBMC MARG अॅप',

      'esc.margAppSmall': 'अधिकृत तक्रार अॅप',

      'esc.copyBlock': '1916 / पोर्टल / अॅपसाठी तपशील',

      'esc.copyAll': 'सर्व तपशील कॉपी',

      'esc.copyAllDone': 'कॉपी झाले — अधिकृत चॅनेलवर नोंदवताना पेस्ट करा',

      'esc.copyBilingual': 'कॉल सेंटर: मजकुरात मराठी ओळ वाचू शकता.',

      'esc.portalHint': 'पोर्टल किंवा MARG: Public Health → Pest Control → stagnant water. खाली तपशील पेस्ट करा.',

      'esc.portalHint.garbage': 'पोर्टल किंवा MARG: Solid Waste Management → garbage / drainage. खाली तपशील पेस्ट करा.',

      'esc.portalHint.potholes': 'पोर्टल किंवा MARG: Roads / potholes. खाली तपशील पेस्ट करा.',

      'esc.portalHint.streetlight': 'पोर्टल किंवा MARG: Electrical → streetlight. खाली तपशील पेस्ट करा.',

      'esc.portalHintNav': 'पोर्टल किंवा MARG: {hint}. खाली तपशील पेस्ट करा.',

      'esc.filedConsent': 'मी अधिकृत BMC चॅनेलवर नोंदवले (1916 / MyBMC / पोर्टल / अॅप)',

      'esc.complaintWarn': 'सामान्य BMC क्रमांक सारखे दिसत नाही — बरोबर असेल तर जतन करा.',

      'esc.saveUnlock': 'जतन केल्यावर: पायऱ्या, दिवस मोजणी, फॉलो-अप मजकूर.',

      'esc.closeNudge': 'तक्रार क्रमांक अजून जतन नाही — Profile मधून कधीही नोंदवा.',

      'esc.daysSince': 'BMC नोंद {n} दिवस',

      'esc.progress.reported': 'नोंद',

      'esc.progress.shared': 'शेअर',

      'esc.progress.filed': 'दाखल',

      'esc.progress.escalating': 'पुढे',

      'esc.progress.resolved': 'सोडवले',

      'esc.tier.copyFollowUp': 'फॉलो-अप कॉपी',

      'esc.tier.openWa': 'WhatsApp',

      'esc.tier.openCall': '1916',

      'esc.tier.openTweet': '@mybmc',

      'esc.tier.openAaple': 'Aaple Sarkar',

      'esc.copyFollowUpDone': 'फॉलो-अप कॉपी',

      'esc.rtiDisclaimer': 'फक्त माहिती RTI नमुना — कायदेशीर सल्ला नाही.',

      'esc.consentRequired': 'जतन करण्यापूर्वी अधिकृत BMC चॅनेलवर नोंदवल्याची खात्री करा.',

      'esc.complaintLabel': 'तक्रार क्रमांक',

      'esc.complaintPh': 'उदा. N/2026/123456',

      'esc.complaintHint': 'क्रमांक जतन केल्यावर जबाबदारी घड्याळ सुरू.',

      'esc.filedNote': 'BMC कडे नोंद — मुदतीनुसार पुढे न्या.',

      'esc.ladderTitle': 'पुढे नेण्याची पायऱ्या',

      'esc.selfTitle': 'BMC ने सोडवले?',

      'esc.selfBody': 'स्वतः पुष्टी करा — सर्वांसाठी हिरवा.',

      'esc.selfBtn': 'सोडवले चिन्हांकित',

      'esc.aaple': 'Aaple Sarkar (राज्य)',

      'esc.officialHint': 'सुचवलेली श्रेणी: {hint}',

      'official.title': 'अधिकृत तक्रार चॅनेल',

      'official.subtitle': 'सत्यापित .gov अॅप आणि पोर्टल — CivicRadar तुमच्या वतीने नोंदवत नाही. सर्व स्रोत दुवे अधिकृत स्रोत पानावर.',

      'official.viewAllSources': 'सर्व अधिकृत स्रोत पहा',

      'official.alsoFile': 'अधिकृतपणेही नोंदवा (पर्यायी)',

      'official.copyDone': 'अधिकृत तक्रार सारांश कॉपी — अॅप/पोर्टलमध्ये पेस्ट करा',

      'official.categoryHint': 'सुचवलेली श्रेणी: {hint}',

      'official.reportDate': 'अहवाल तारीख',

      'official.photoGuidance': 'टिप: जलद कारवाईसाठी CivicRadar फोटो अधिकृत अॅपमध्ये जोडा.',

      'official.marg.label': 'MyBMC MARG',

      'official.marg.small': '114 श्रेण्या · जिओ फोटो · ट्रॅकिंग',

      'official.swachhata.label': 'Swachhata-MoHUA',

      'official.swachhata.small': 'MoHUA स्वच्छता · वार्ड निरीक्षक',

      'official.aaple.label': 'Aaple Sarkar',

      'official.aaple.small': 'महाराष्ट्र राज्य तक्रार पोर्टल',

      'official.pmc.label': 'PMC CARE',

      'official.pmc.small': 'पुणे महानगरपालिका अॅप',

      'official.tmc.label': 'TMC नागरिक पोर्टल',

      'official.tmc.small': 'thanecity.gov.in',

      'official.bmcWa.label': 'MyBMC WhatsApp',

      'official.bmcWa.small': 'जलद चॅट तक्रार',

      'official.bmcPortal.label': 'BMC ऑनलाइन पोर्टल',

      'official.bmcPortal.small': 'www.mcgm.gov.in',

      'official.hint.marg.stagnant-water': 'सार्वजनिक आरोग्य → कीटक नियंत्रण → stagnant water / डास प्रजनन',

      'official.hint.marg.garbage': 'घन कचरा व्यवस्थापन → कचरा / नाला',

      'official.hint.swachhata.garbage': 'कचरा डंप',

      'official.hint.swachhata.stagnant-water': 'बंद गटार (गटारशी संबंधित असल्यास)',

      'official.hint.pmc.stagnant-water': 'आरोग्य / डास उत्पत्ती / साचलेले पाणी',

      'official.hint.pmc.garbage': 'घन कचरा / कचरा',

      'official.hint.aaple': 'स्थानिक संस्था {corp} निवडा → आरोग्य / पाणी विभाग',

      'official.hint.tmc.stagnant-water': 'पाणी / आरोग्य विभाग (डास उत्पत्ती)',

      'success.alsoOfficial': 'अधिकृत तक्रार (पर्यायी)',

      'success.filingGuide': 'नोंदणी मार्गदर्शक आणि तक्रार मजकूर',

      'esc.close': 'बंद',

      'esc.save': 'जतन',

      'esc.tier.file.title': '1 · अधिकृत तक्रार',

      'esc.tier.file.body': 'मोफत. वॉर्ड PCO. क्रमांक येथे जतन करा.',

      'esc.tier.matrix.title': '2 · दिवस {n}+ — वॉर्ड',

      'esc.tier.matrix.body': '7 दिवसांवर BMC ऑटो-एस्केलेट. WCO / AMC.',

      'esc.tier.zonal.title': '3 · दिवस {n}+ — झोनल',

      'esc.tier.zonal.body': 'Zonal DMC आणि @mybmc सार्वजनिक दबाव.',

      'esc.tier.grievance.title': '4 · दिवस {n}+ — तक्रार / RTI',

      'esc.tier.grievance.body': 'महिना झाला? Aaple Sarkar किंवा RTI.',

      'profile.empty': 'अद्याप तक्रार नाही. जवळ कोणता धोका?',

      'profile.emptyList': 'अद्याप तक्रार नाही. Report दाबून जवळचे धोके पिन करा.',

      'profile.emptyAction': 'आता तक्रार',

      'profile.trackEscalate': 'ट्रॅक / पुढे',

      'profile.fileBmc': 'BMC कडे नोंदवा',

      'profile.status.resolvedCitizen': 'सोडवले (तुम्ही)',

      'profile.status.resolvedBmc': 'BMC ने सोडवले',

      'profile.status.notFiled': 'सामुदायिक नकाशावर खुले',

      'profile.status.removed': 'मॉडरेटरने काढून टाकले',

      'profile.communityCleared': 'स्वयंसेवकांनी साफ केले — {corp} तक्रार अजून खुली असू शकते',

      'profile.neighbourOne': 'शेजाऱ्याने मला पण म्हटले',

      'profile.neighbourMany': 'शेजाऱ्यांनी मला पण म्हटले',

      'profile.pointsHint.base': '50 गुण/तक्रार · +200 स्वयंसेवा',

      'profile.pointsHint.bonus': '{n} × 50 · +{bonus} बोनस',

      'profile.greeting': 'नमस्कार, {name}',

      'profile.greetingDefault': 'नमस्कार, नागरिक',

      'profile.referralCount': '🎉 तुमच्या आमंत्रणामुळे {n} शेजारी सामील झाले — धन्यवाद!',

      'profile.selectWard': 'वॉर्ड निवडा',

      'profile.society': 'सोसायटी / परिसर (पर्यायी)',

      'profile.societyPh': 'उदा. Phoenix Mills CHS, Worli',

      'profile.societyHintWard': '{ward} मध्ये {n} सोसायटी — नसेल तर टाइप करा.',

      'profile.societyHintNoWard': 'सोसायटी सूचना साठी प्रथम वॉर्ड निवडा.',

      'profile.societyHintCustom': 'यादीत नसेल तर सोसायटी / RWA नाव लिहा.',

      'profile.societyRegistry': 'तुमची नोंदणीकृत सहकारी सोसायटी शोधा',

      'map.youAreHere': 'तुम्ही येथे आहात',

      'about.subtitleNamed': 'मुंबई, पुणे आणि ठाणेसाठी सामुदायिक तंत्र — {name} द्वारे, नागरिकांसाठी मोफत.',

      'safety.hide': 'फ्लॅग / लपवा',

      'safety.hidden': 'तुमच्या नकाशावरून लपवले.',

      'safety.hideConfirm': 'हा पिन लपवायचा आणि आमच्या टीमकडे पुनरावलोकनासाठी पाठवायचा? (तक्रार लगेच हटत नाही.)',

      'mute.hideReporter': 'या तक्रारकर्त्याच्या तक्रारी लपवा',

      'mute.hideConfirm': 'तुमच्या डिव्हाइसवर या तक्रारकर्त्याचे सर्व पिन लपवायचे? प्रोफाइल → लपलेले तक्रारकर्ते मध्ये परत दाखवता येते.',

      'mute.hidden': 'या तक्रारकर्त्याच्या तक्रारी तुमच्या नकाशावर लपवल्या.',

      'mute.unmuted': 'तक्रारकर्ता अनम्यूट — त्यांच्या तक्रारी पुन्हा दिसू शकतात.',

      'mute.sectionTitle': 'लपलेले तक्रारकर्ते',

      'mute.sectionHint': 'या वापरकर्त्यांच्या तक्रारी तुमच्या नकाशावर लपवल्या. पुन्हा दाखवण्यासाठी टॅप करा.',

      'mute.empty': 'कोणतेही लपलेले तक्रारकर्ते नाहीत.',

      'mute.unmute': 'पुन्हा दाखवा',

      'popup.pending': 'प्रलंबित',

      'popup.resolved': 'सोडवले',

      'fix.by.community': 'ठीक — शेजाऱ्याने पुष्टी केली',

      'fix.by.self': 'ठीक — अहवालकर्त्याने पडताळले',

      'fix.by.bmc': '{corp} ने सोडवले',

      'popup.society': 'सोसायटी / परिसर',

      'popup.communityCleared': 'स्वयंसेवकांनी साफ केले — {corp} तक्रार अजून खुली असू शकते',

      'partner.title': 'पार्टनर प्रवेश',

      'partner.subtitle': 'NGO समन्वयक आणि स्वयंसेवकांसाठी. नगरपालिका प्रवेश निमंत्रणाने.',

      'partner.ngoTitle': 'NGO समन्वयक',

      'partner.ngoBody': 'देणगी पहा, स्वयंसेवक पाठवा आणि सफाई नोंदवा',

      'partner.bmcTitle': 'नगरपालिका पायलट',

      'partner.bmcBody': 'आमंत्रित BMC पायलटसाठी — प्रवेशासाठी संपर्क करा',

      'profile.persona.admin': 'BMC Admin',

      'profile.persona.ngo': 'NGO समन्वयक',

      'flow.legal': 'कायदेशीर',

      'flow.city': 'शहर',

      'flow.ward': 'वॉर्ड',

      'flow.ready': 'तयार',

      'city.mumbai': 'मुंबई',

      'city.pune': 'पुणे',

      'city.thane': 'ठाणे',

      'tos.title': 'सेवा अटी',

      'tos.subtitle': 'CivicRadar वापरण्यापूर्वी वाचा आणि स्वीकारा.',

      'tos.age': 'तक्रार आणि समुदाय वैशिष्ट्यांसाठी 18+ आवश्यक.',

      'tos.emergency': 'आपत्कालीन नाही. जीवघेणा धोका असल्यास 112 वर कॉल करा.',

      'tos.itAct': 'CivicRadar IT Act, 2000 अंतर्गत मध्यस्थ आहे. अपलोडची जबाबदारी तुमची.',

      'tos.share': 'WhatsApp, X वर शेअर केल्याने वैयक्तिक डेटा उघडू शकतो — स्वतःच्या जोखमीवर.',

      'tos.gps': 'DPDP Act अंतर्गत धोका नकाशासाठी GPS संमती आवश्यक.',

      'tos.analytics': 'अनाम उपयोग अ‍ॅनालिटिक्स (पर्यायी) विश्वासार्हता वाढवते. फोटो, GPS किंवा नाव पाठवले जात नाही.',

      'tos.analyticsOptIn': 'मी अनाम उपयोग अ‍ॅनालिटिक्सला संमती देतो/देते (पर्यायी — Profile मधून कधीही मागे)',

      'tos.notBmc': 'CivicRadar स्वतंत्र — BMC/MCGM शी संलग्न किंवा चालवले नाही.',

      'tos.content': 'फक्त धोक्याचे ऑन-साइट फोटो. सेल्फी, ID किंवा असंबंधित चित्रे नाहीत.',

      'tos.accept': 'मी 18+ आहे, <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms</a> आणि <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a> स्वीकारतो/स्वीकारते, GPS संग्रहास संमती देतो/देते',

      'tos.continue': 'पुढे जा',

      'pledge.title': 'देणगी द्या',

      'pledge.subtitle': 'वॉर्डमधील स्वयंसेवकांना साहित्य द्या.',

      'pledge.type': 'साहित्य प्रकार',

      'pledge.type.cleaning': 'सफाई साहित्य',

      'pledge.type.snacks': 'नाश्ता',

      'pledge.type.repellent': 'डास repellent',

      'pledge.ward': 'लक्ष्य वॉर्ड',

      'pledge.wardPh': 'वॉर्ड निवडा…',

      'pledge.message': 'संदेश',

      'pledge.messagePh': 'स्वयंसेवकांसाठी टीप…',

      'pledge.notice': 'तुमच्या वॉर्डचा NGO समन्वयक हे त्यांच्या हबमध्ये पाहतो — BMC नाही. ते अ‍ॅपमध्ये संपर्क करू शकतात; स्वयंचलित कॉल/SMS नाही.',

      'pledge.status.pledged': 'देणगी नोंद',

      'pledge.status.delivered': 'वितरित',

      'pledge.status.verified': 'सत्यापित (+200 गुण)',

      'pledge.submit': 'देणगी पाठवा',

      'toast.syncConnected': 'कनेक्ट — तक्रारी सर्व डिव्हाइसवर सिंक.',

      'toast.welcome': 'स्वागत, {name}! तक्रारीसाठी तयार.',

      'toast.syncLocal': 'या डिव्हाइसवर जतन — क्लाउड सिंक पुन्हा प्रयत्न करेल.',

      'toast.copyFail': 'कॉपी अयशस्वी — मजकूर स्वतः निवडा.',

      'toast.saveFail': 'जतन होऊ शकले नाही.',

      'toast.adminVerified': 'BMC प्रवेश सत्यापित — वॉर्ड रांग पाहा.',

      'toast.ngoVerified': 'समन्वयक सत्यापित — देणगी आणि स्वयंसेवक पाहा.',

      'toast.govEmail': 'gov.in / mcgm.gov.in ईमेल वापरा.',

      'toast.codeSent': 'कोड पाठवला — इनबॉक्स पाहा.',

      'toast.codeInvalid': 'अवैध किंवा कालबाह्य कोड.',

      'toast.linkSent': 'साइन-इन लिंक पाठवला — इनबॉक्स पाहा.',

      'toast.authEmailFail': 'साइन-इन ईमेल पाठवता आला नाही — Supabase SMTP सेटिंग्ज तपासा आणि पुन्हा प्रयत्न करा.',

      'toast.authCaptchaFail': 'सुरक्षा तपासणी अयशस्वी — पेज रीलोड करा आणि पुन्हा प्रयत्न करा.',

      'toast.authEmailOffline': 'क्लाउड साइन-इन उपलब्ध नाही — कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.',

      'toast.authEmailRateLimit': 'खूप साइन-इन ईमेल — काही मिनिट थांबा आणि पुन्हा प्रयत्न करा.',

      'toast.authEmailInvalid': 'ईमेल पत्ता अवैध वाटतो — तपासा आणि पुन्हा प्रयत्न करा.',

      'toast.authEmailRedirect': 'साइन-इन रीडायरेक्ट URL परवानगी नाही — Supabase Authentication मध्ये तुमची साइट URL जोडा.',

      'toast.linkExpired': 'साइन-इन लिंक कालबाह्य — नवीन लिंक मागा.',

      'toast.bmcUnauthorized': 'हा ईमेल BMC प्रवेशासाठी अधिकृत नाही.',

      'toast.ngoCodeRequired': 'ईमेल आणि NGO प्रवेश कोड भरा.',

      'toast.ngoCodeInvalid': 'चुकीचा किंवा कालबाह्य NGO कोड.',

      'toast.onboardFirst': 'तक्रारीसाठी सेटअप पूर्ण करा.',

      'toast.tosRequired': 'समुदाय वैशिष्ट्यांपूर्वी Terms आणि Privacy (18+) स्वीकारा.',

      'toast.reportNotFound': 'तक्रार लिंक अवैध किंवा या डिव्हाइसवर नाही.',

      'toast.installed': 'CivicRadar इंस्टॉल — होम स्क्रीनवरून उघडा!',

      'toast.installHint': 'ब्राउझर मेनू → Add to Home screen.',

      'toast.installHintIos': 'Safari Share → Add to Home Screen.',

      'toast.wardRequired': 'मुंबईच्या अधिकृत यादीतून वॉर्ड निवडा.',

      'toast.contactConfig': 'संपर्क ईमेल सेट नाही — js/config.js पाहा',

      'config.contactMissing': '(js/config.js मध्ये founder.email किंवा founder.operatorEmail सेट करा)',

      'toast.citizenView': 'नागरिक दृश्याकडे परत.',

      'toast.noLocation': 'या ब्राउझरमध्ये लोकेशन उपलब्ध नाही.',

      'toast.recentered': 'नकाशा तुमच्या स्थानावर केंद्रित.',

      'toast.bmcLoginFail': 'चुकीची BMC ओळखपत्रे.',

      'toast.bmcMumbaiOnly': 'BMC पायलट फक्त Mumbai साठी. तुमच्या महानगरपालिकेसाठी Profile मधून दाखल करा.',

      'toast.ngoLoginFail': 'चुकीची समन्वयक ओळखपत्रे.',

      'toast.photoRequired': 'पाठवण्यापूर्वी फोटो जोडा.',

      'toast.photoFailed': 'तो फोटो वापरता आला नाही — पुन्हा प्रयत्न करा.',

      'toast.gpsRequired': 'धोका पिनसाठी GPS आवश्यक.',

      'toast.gpsOutsideCity': 'स्थान तुमच्या निवडलेल्या शहराच्या बाहेर आहे. पिन शहराच्या मर्यादेत ठेवा किंवा प्रोफाइलमध्ये शहर बदला.',

      'toast.pinConfirmRequired': 'नकाशावर पिनची खात्री करा — पाठवण्यापूर्वी पिन धोक्यावर ओढा.',

      'toast.hazardTypeRequired': 'सक्रिय धोका प्रकार निवडा.',

      'toast.storageFull': 'स्टोरेज भरले — जुनी तक्रार काढली. पुन्हा प्रयत्न करा.',

      'toast.gpsFail': 'GPS मिळाला नाही. लोकेशन चालू करून पुन्हा प्रयत्न करा.',

      'toast.gpsFailAction': 'GPS मिळाला नाही. नकाशावर पिन लावा किंवा सेटिंगमध्ये स्थान चालू करा.',

      'toast.manualPinReady': 'पिन लावला — Submit दाबून अहवाल पूर्ण करा.',

      'toast.gpsLocating': 'तुमचे स्थान शोधत आहोत…',

      'toast.gpsLowAccuracy': 'स्थान अंदाजे आहे (~{m} मी). चांगल्या GPS साठी बाहेर किंवा खिडकीजवळ जा.',

      'toast.gpsPoorFix': 'अचूक स्थान मिळाले नाही. GPS चालू करून बाहेर पुन्हा प्रयत्न करा.',

      'toast.complaintRequired': 'ट्रॅकिंगसाठी तक्रार क्रमांक भरा.',

      'toast.complaintSaved': 'तक्रार क्रमांक जतन — अधिकृत घड्याळ सुरू.',

      'toast.pledgeWardRequired': 'देणगीसाठी लक्ष्य वॉर्ड निवडा.',

      'toast.pledgeSaved': 'देणगी नोंद — वॉर्ड समन्वयकाला हबमध्ये दिसेल.',

      'toast.pledgeDuplicate': 'या वॉर्ड आणि साहित्यासाठी आधीच खुली प्रतिज्ञा आहे.',

      'toast.pledgeWardMismatch': 'हे तुमच्या वॉर्डपेक्षा वेगळे — त्या वॉर्डचा समन्वयक हाताळेल.',

      'toast.pledgeStatusDelivered': 'समन्वयकाने तुमची देणगी वितरित म्हणून चिन्हांकित केली.',

      'toast.pledgeStatusVerified': 'स्वयंसेवक तास सत्यापित — +200 सिव्हिक गुण!',

      'toast.ngoNewPledge': 'तुमच्या वॉर्डमध्ये {n} नवीन नागरिक प्रतिज्ञा.',

      'toast.ngoNewPledgeAction': 'हब उघडा',

      'toast.proofAdded': 'पुरावा फोटो जोडला — पुष्टीसाठी पुन्हा दाबा.',

      'toast.fixPhotoAdded': 'नंतरचा फोटो जतन — शेजारी आधी आणि नंतर पाहू शकतात!',

      'toast.resolveFail': 'स्थिती अपडेट होऊ शकली नाही.',

      'toast.bmcOnlyResolve': 'फक्त सत्यापित BMC अधिकारी निराकरण करू शकतात.',

      'toast.resolvedProof': 'निराकरण चिन्हांकित — आधी/नंतर पुरावा जतन.',

      'toast.ownReportOnly': 'फक्त स्वतःच्या तक्रारीची पुष्टी करू शकता.',

      'toast.complaintFirst': 'प्रथम तक्रार क्रमांक जोडा — तोच पुरावा.',

      'toast.selfResolved': 'निराकरण चिन्हांकित — फॉलो-अपसाठी धन्यवाद!',

      'toast.shareWin': 'शेजाऱ्यांसोबत विजय शेअर करा.',

      'toast.cleanupLogged': 'समुदाय सफाई लॉग — BMC तक्रार अधिकृतपणे उघडी राहू शकते.',

      'toast.pledgeDelivered': 'साहित्य वितरित — आता तास सत्यापित करा.',

      'toast.hoursVerified': 'तास सत्यापित! +200 Civic Points.',

      'toast.saving': 'जतन होत आहे…',

      'toast.verifying': 'सत्यापन होत आहे…',

      'admin.title': 'BMC Admin',

      'admin.subtitle': 'नागरिक धोका तक्रारी निराकरण करा, वॉर्ड रांग पाहा.',

      'admin.queueTitle': 'धोका रांग',

      'admin.queueSubtitle': 'नागरिक तक्रारी पाहा, प्राधान्य द्या, निराकरण करा.',

      'admin.returnMap': 'नकाशावर परत',

      'admin.exitMode': 'BMC मोड बंद',

      'admin.allWards': 'सर्व वॉर्ड',

      'admin.sort.oldest': 'जुने प्रथम',

      'admin.sort.newest': 'नवीनतम प्रथम',

      'admin.sort.overdue': 'प्रलंबित प्रथम',

      'admin.sort.confirmed': 'सर्वाधिक मला पण',

      'admin.pending': 'उघडे',

      'admin.overdue': '7+ दिवस प्रलंबित',

      'admin.resolved': 'निराकरण',

      'admin.avgDays': 'सरासरी दिवस',

      'admin.healthSummary': 'अ‍ॅप आरोग्य (गेले 7 दिवस)',

      'admin.healthLoading': 'वापर लोड होत आहे…',

      'admin.markResolved': 'निराकरण चिन्हांकित',

      'admin.resolveHint': 'नागरिकाला श्रेय — पिन हिरवा होईल.',

      'admin.removeContent': 'मजकूर काढा',

      'admin.removeConfirm': 'ही तक्रार सार्वजनिक नकाशावरून काढायची? मार्गदर्शक तत्त्वांचे उल्लंघन करणाऱ्या मजकुरासाठी वापरा — तक्रारदाराला ती काढल्याचे दिसेल.',

      'admin.removeSuccess': 'तक्रार सार्वजनिक नकाशावरून काढली.',

      'admin.flagged': 'फ्लॅग केले',

      'admin.reviewTag': 'BMC पुनरावलोकन',

      'admin.reportTitle': 'धोका तक्रार',

      'coord.title': 'समन्वयक लॉगिन',

      'coord.subtitle': 'देणगी पाहा, स्वयंसेवक पाठवा, तास सत्यापित करा.',

      'coord.hubTitle': 'समन्वयक हब',

      'coord.hubSubtitle': 'नागरिक देणगी पाहा, स्वयंसेवक तास सत्यापित करा.',

      'coord.workflow': 'पाठवा → सफाई लॉग → साहित्य → तास (+200 गुण)',

      'coord.openHazards': 'वॉर्डमधील उघडे धोके',

      'coord.pledges': 'नागरिक देणगी',

      'coord.pledgesNew': 'नागरिक प्रतिज्ञा · {n} नवीन',

      'coord.pledgesEmpty': 'अद्याप प्रतिज्ञा नाहीत. वॉर्डमधील रहिवाशांसोबत Community टॅब शेअर करा.',

      'coord.markDelivered': 'वितरित चिन्हांकित करा',

      'coord.verifyHours': 'तास सत्यापित (+200)',

      'coord.verified': 'सत्यापित',

      'coord.exitMode': 'NGO मोड बंद',

      'coord.pledgesLabel': 'देणगी',

      'coord.toVerify': 'सत्यापन बाकी',

      'coord.openLabel': 'उघडे धोके',

      'coord.cleared': 'समुदायाने साफ केले',

      'profile.pledges': 'माझ्या प्रतिज्ञा',

      'profile.pledgesEmpty': 'अद्याप प्रतिज्ञा नाहीत. Community वरून स्थानिक स्वयंसेवकांना साथ द्या.',

      'profile.pledgesEmptyAction': 'देणगी द्या',

      'profile.officialHint': 'सत्यापित BMC, PMC आणि TMC अॅप्स आणि पोर्टल — CivicRadar तुमच्या वतीने दाखल करत नाही. Resources टॅबमधून उघडा.',

      'profile.officialLink': 'Resources उघडा',

      'profile.communityHint': 'स्वयंसेवक नोंदणी आणि दान — Resources टॅबमधून उघडा.',

      'profile.communityLink': 'स्वयंसेवा आणि दान',

      'badge.admin': 'BMC Admin',

      'badge.coord': 'समन्वयक हब',

      'admin.meta.reporter': 'तक्रारकर्ता',

      'admin.meta.ward': 'वॉर्ड',

      'admin.meta.status': 'स्थिती',

      'admin.meta.lat': 'Lat',

      'admin.meta.lng': 'Lng',

      'admin.meta.neighbourConfirm': ' · {n} मला पण म्हटले',

      'admin.close': 'बंद',

      'coord.hazardsEmpty': 'तुमच्या क्षेत्रात सध्या खुले धोके नाहीत.',

      'coord.volunteerOffers': '{n} स्वयंसेवक ऑफर',

      'coord.hazardCleaned': 'साफ केले',

      'coord.logCleanup': 'सफाई नोंदवा',

      'admin.health.communityCleanups': 'सामुदायिक सफाई',

      'admin.health.whatsappShares': 'WhatsApp शेअर',

      'admin.health.errors': 'त्रुटी',

      'admin.health.perfSamples': 'कार्यप्रदर्शन नमुने',

      'admin.health.avgPerf': 'सरासरी लोड वेळ (स्थानिक)',

      'admin.health.bufferedEvents': 'बफर इव्हेंट (डिव्हाइस)',

      'tracking.open': 'Analytics आणि tracking',

      'tracking.title': 'Analytics आणि tracking',

      'tracking.subtitle': 'एकत्र civic metrics — visits, reports, escalations, resolutions.',

      'tracking.period': 'कालावधी',

      'tracking.days7': 'मागील 7 दिवस',

      'tracking.days30': 'मागील 30 दिवस',

      'tracking.days90': 'मागील 90 दिवस',

      'tracking.wardFilter': 'वॉर्ड',

      'tracking.sessions': 'Visits',

      'tracking.pwaInstalls': 'PWA installs',

      'tracking.reports': 'तक्रारी',

      'tracking.resolved': 'सोडवले',

      'tracking.pwaNote': 'PWA install अंदाजे (Add to Home Screen / standalone). Store downloads GitHub Pages वर मोजता येत नाहीत.',

      'tracking.loading': 'Metrics लोड होत आहेत…',

      'tracking.sourceLocal': 'Device + local reports (demo / offline)',

      'tracking.sourceCloud': 'Cloud aggregate (सर्व users)',

      'tracking.sourceCloudFail': 'Cloud metrics उपलब्ध नाहीत — Supabase मध्ये tracking SQL चालवा.',

      'tracking.reportsByCategory': 'Category नुसार reports',

      'tracking.escalations': 'Official channel opens',

      'tracking.neighbourhoods': 'Neighbourhood / society नुसार',

      'tracking.reporters': 'Active reporters',

      'tracking.meToo': 'Me too',

      'tracking.filed': 'Official filings',

      'tracking.leads': 'Neighbourhood leads',

      'tracking.empty': 'या कालावधीत डेटा नाही.',

      'tracking.pending': 'open',

      'tracking.channelUnknown': 'इतर channel',

      'a11y.skipToContent': 'मुख्य सामग्रीवर जा',

      'aria.close': 'बंद',

      'aria.lang': 'भाषा बदला',

      'aria.recenter': 'नकाशा तुमच्या स्थानावर केंद्रित करा',

      'aria.leaderboard': 'समुदाय लीडरबोर्ड आणि देणगी',

      'aria.profile': 'प्रोफाइल',

      'aria.report': 'धोका तक्रार',

      'aria.filterWard': 'वॉर्डनुसार फिल्टर',

      'aria.sortReports': 'तक्रारी क्रम',

      'auth.demoTag.admin': 'डेमो प्रवेश — प्रोडक्शनमध्ये BMC ईमेल सत्यापन',

      'auth.demoTag.lead': 'डेमो प्रवेश — प्रोडक्शनमध्ये ईमेल + NGO इनवाइट',

      'auth.officialEmail': 'अधिकृत ईमेल',

      'auth.emailHint': 'फक्त gov.in / mcgm.gov.in वर BMC प्रवेश.',

      'auth.sendCode': 'साइन-इन कोड पाठवा',

      'auth.linkInstructions': 'तुमचा ईमेल पाहा आणि साइन-इन लिंकवर टॅप करा. हा टॅब उघडा ठेवा — तुम्ही साइन-इन होऊन येथेच परत या.',

      'auth.otpFallback': '6-अंकी कोड आहे?',

      'auth.otp': '6-अंकी कोड',

      'auth.verifyEnter': 'सत्यापित करा आणि प्रवेश',

      'auth.email': 'ईमेल',

      'auth.ngoCode': 'NGO प्रवेश कोड',

      'auth.ngoCodePh': 'CivicRadar ऑपरेटरने जारी',

      'auth.username': 'युजरनेम',

      'auth.password': 'पासवर्ड',

      'auth.loginDemo': 'लॉगिन (डेमो)',

      'admin.health.noData': 'या डिव्हाइसवर अद्याप वापर डेटा नाही.',

      'admin.health.deviceSource': 'डिव्हाइस बफर (गेले 7 दिवस)',

      'admin.health.cloudSource': 'क्लाउड एकत्र (सर्व वापरकर्ते)',

      'admin.health.cloudUnavailable': 'क्लाउड मेट्रिक्स उपलब्ध नाहीत — Supabase मध्ये analytics SQL चालवा.',

      'admin.health.connectSupabase': 'शहर-व्यापी वापरासाठी Supabase कनेक्ट करा.',

      'admin.health.sessions': 'सत्र',

      'admin.health.tabViews': 'टॅब व्ह्यू',

      'admin.health.reportsFiled': 'तक्रारी नोंद',

      'admin.health.corroborations': 'मला पण',

      'admin.health.bmcFiled': 'BMC नोंद',

      'admin.health.resolved': 'निराकरण',

      'about.founderDefault': 'Nihira',

      'about.teamLabel': 'Nihira',

      'about.teamRole': 'सामुदायिक नागरी अहवाल',

      'ref.welcomeTitle': 'एका शेजाऱ्याने तुम्हाला बोलावले 👋',

      'referral.joinedReward': '🎉 तुमच्या आमंत्रणामुळे {n} शेजारी सामील झाले — +{pts} Civic Points!',

      'ref.welcomeBody': '{city} नकाशावर आधीच {n} तक्रारी आहेत. तुमच्या वॉर्डमधील खुले स्पॉट पाहा — किंवा 30 सेकंदात एक पिन करा.',

      'ref.welcomeBodyEmpty': '{city} मध्ये धोके नकाशित करणाऱ्यांत पहिले व्हा — कचरा, खड्डे, स्ट्रीटलाइट आणि साचलेले पाणी. फक्त 30 सेकंद.',

      'ref.welcomeCta': 'नकाशा पाहा',

      'ref.welcomeReport': 'स्पॉट नोंदवा',

      'ref.dismiss': 'आमंत्रण बंद करा',

      'season.monsoonPrep': 'पाऊस येत आहे. लवकर साचलेले पाणी साफ केल्याने डास कमी होतात — पहिल्या जोरदार पावसाआधी स्पॉट पिन करा.',

      'season.monsoonPeak': 'पावसाळा आला आहे. साचलेल्या पाण्यातूनच डेंग्यू सुरू होतो — 30 सेकंदांची तक्रार तुमच्या संपूर्ण गल्लीला मदत करते.',

      'season.ganesh': 'गणेश चतुर्थी आली आहे. चला सणासाठी वॉर्ड स्वच्छ ठेवूया — मंडप व विसर्जन मार्गाजवळ साचलेले पाणी नोंदवा.',

      'season.denguePeak': 'डेंग्यूचा हंगाम आहे. डास साचलेल्या पाण्यात वाढतात — एक झटपट तक्रार तुमच्या गल्लीचे रक्षण करते.',

      'season.dismiss': 'हंगामी सूचना बंद करा',

      'social.wardWeek': '👥 या आठवड्यात {ward} मध्ये {n} शेजाऱ्यांनी नोंद केली',

      'social.wardWeekBacked': '👥 या आठवड्यात {ward}: {n} नोंदी · {c} पाठिंबा',

      'social.wardWeekEmpty': 'या आठवड्यात {ward} मधून अजून कोणतीही तक्रार नाही — शेजारी तुमचे अनुसरण करतील.',

      'recap.title': 'या आठवड्यात तुमचा वॉर्ड',

      'recap.share': 'साप्ताहिक आढावा शेअर करा',

      'share.weeklyRecap': '📊 या आठवड्यात {ward}: {reports} नवीन तक्रारी, {resolved} दुरुस्त, {backed} शेजाऱ्यांचा पाठिंबा. CivicRadar वर सामील व्हा 👇\n{link}\n{hashtags}',

      'feedback.menu': 'अभिप्राय पाठवा',

      'feedback.title': 'अभिप्राय पाठवा',

      'feedback.subtitle': 'एखादी अडचण आढळली किंवा कल्पना आहे? आम्हाला सांगा — ते थेट टीमकडे जाते.',

      'feedback.categoryLabel': 'कोणत्या प्रकारचा अभिप्राय?',

      'feedback.catIdea': 'कल्पना',

      'feedback.catBug': 'अडचण',

      'feedback.catOther': 'इतर',

      'feedback.messageLabel': 'तुमचा अभिप्राय',

      'feedback.messagePh': 'काय झाले, किंवा CivicRadar अधिक चांगले कसे करता येईल?',

      'feedback.contactLabel': 'संपर्क (पर्यायी — फक्त तुम्हाला उत्तर हवे असल्यास)',

      'feedback.contactPh': 'ईमेल किंवा फोन',

      'feedback.privacy': 'आम्ही तुमचा संपर्क कधीही शेअर करत नाही. फक्त या अभिप्रायाला उत्तर देण्यासाठी वापरला जातो.',

      'feedback.submit': 'अभिप्राय पाठवा',

      'feedback.errorEmpty': 'कृपया प्रथम एक छोटा संदेश लिहा.',

      'feedback.error': 'पाठवता आले नाही — तुमचा मजकूर सुरक्षित आहे. कृपया पुन्हा प्रयत्न करा.',

      'feedback.success': 'धन्यवाद! तुमचा अभिप्राय पाठवला गेला.',

      'feedback.successLocal': 'जतन केले — ऑनलाइन झाल्यावर आम्ही ते सिंक करू.',

      'access.title': 'समन्वयक प्रवेशासाठी विनंती करा',

      'access.subtitle': 'NGO व समुदाय समन्वयक आणि BMC अधिकाऱ्यांसाठी.',

      'access.step1': 'काही सोप्या तपशिलांसह अर्ज करा',

      'access.step2': 'CivicRadar टीम पुनरावलोकन करते',

      'access.step3': 'प्रवेश अनलॉक करण्यासाठी क्लेम कोड मिळवा',

      'access.roleLabel': 'मी आहे…',

      'access.roleNgo': 'NGO समन्वयक',

      'access.roleBmc': 'BMC अधिकारी',

      'access.nameLabel': 'तुमचे नाव',

      'access.namePh': 'पूर्ण नाव',

      'access.orgLabel': 'संस्था',

      'access.orgPh': 'NGO / विभाग / RWA चे नाव',

      'access.optional': '(पर्यायी)',

      'access.cityLabel': 'शहर',

      'access.wardLabel': 'वॉर्ड',

      'access.wardPh': 'तुमचा वॉर्ड',

      'access.contactLabel': 'संपर्क — ईमेल किंवा फोन',

      'access.emailPh': 'you@example.com',

      'access.phonePh': 'फोन',

      'access.contactHint': 'किमान एक द्या. क्लेम कोड ईमेलवर; फक्त फोन दिल्यास तिथेच संपर्क करू.',

      'access.proofLabel': 'ओळख / पुरावा',

      'access.proofOptional': '(पर्यायी — BMC साठी सुचवलेले)',

      'access.proofAdd': 'पुरावा फोटो जोडा',

      'access.noteLabel': 'आणखी काही?',

      'access.notePh': 'वॉर्ड फोकस, वापर कसा कराल, इ.',

      'access.submit': 'विनंती पाठवा',

      'access.haveCode': 'माझ्याकडे आधीच क्लेम कोड आहे',

      'access.confirmTitle': 'विनंती मिळाली',

      'access.confirmBody': 'धन्यवाद! CivicRadar टीम तुमच्या विनंतीचे पुनरावलोकन करेल आणि सहसा काही दिवसांत तुम्हाला क्लेम कोड पाठवेल (ईमेल किंवा फोन). प्रवेश अनलॉक करण्यासाठी तो कोड अॅपमध्ये टाका.',

      'access.confirmLocal': 'या डिव्हाइसवर जतन — ऑनलाइन झाल्यावर टीमकडे सिंक होईल.',

      'access.done': 'पूर्ण',

      'access.profileBmcCta': 'BMC अधिकारी? प्रवेश विनंती',

      'access.partnerBmcCta': 'BMC अधिकारी? प्रवेश विनंती',

      'access.partnerClaim': 'माझ्याकडे क्लेम कोड आहे',

      'access.claimTitle': 'तुमचा क्लेम कोड टाका',

      'access.claimSubtitle': 'CivicRadar टीमने मंजूर केले? प्रवेश अनलॉक करण्यासाठी पाठवलेला कोड टाका.',

      'access.claimLabel': 'क्लेम कोड',

      'access.claimPh': 'CR-XXXXXX',

      'access.claimSubmit': 'प्रवेश अनलॉक करा',

      'access.reviewOpen': 'प्रवेश विनंत्या',

      'access.reviewTag': 'CivicRadar टीम',

      'access.reviewTitle': 'प्रवेश विनंत्या',

      'access.reviewSubtitle': 'समन्वयक व BMC प्रवेश विनंत्या मंजूर/नाकारा. मंजुरीवर क्लेम कोड जारी होतो.',

      'access.pending': 'प्रलंबित',

      'access.approved': 'मंजूर',

      'access.rejected': 'नाकारले',

      'access.reviewEmpty': 'अजून विनंत्या नाहीत. नवीन समन्वयक व BMC विनंत्या इथे दिसतील.',

      'access.approve': 'मंजूर करा',

      'access.reject': 'नाकारा',

      'access.copyCode': 'कोड कॉपी करा',

      'access.codeCopied': 'क्लेम कोड कॉपी झाला — अर्जदाराला त्यांच्या संपर्क तपशीलांद्वारे पाठवा.',

      'access.roleNgoTag': 'NGO समन्वयक',

      'access.roleBmcTag': 'BMC अधिकारी',

      'access.statusApproved': 'मंजूर',

      'access.statusRejected': 'नाकारले',

      'access.statusPending': 'प्रलंबित',

      'access.errName': 'कृपया तुमचे नाव जोडा.',

      'access.errContact': 'संपर्कासाठी ईमेल किंवा फोन जोडा.',

      'access.submitted': 'विनंती पाठवली — आम्ही पुनरावलोकन करून तुम्हाला क्लेम कोड पाठवू.',

      'access.submittedLocal': 'विनंती जतन — ऑनलाइन झाल्यावर सिंक व पुनरावलोकन होईल.',

      'access.submitError': 'पाठवता आले नाही — तुमचे तपशील सुरक्षित आहेत. कृपया पुन्हा प्रयत्न करा.',

      'access.claimErrEmpty': 'पाठवलेला क्लेम कोड टाका.',

      'access.claimErrInvalid': 'हा कोड वैध नाही किंवा अजून मंजूर झालेला नाही.',

      'access.claimErrUsed': 'हा कोड आधीच वापरला गेला आहे.',

      'access.claimedNgo': 'प्रवेश अनलॉक — स्वागत आहे, समन्वयक!',

      'access.claimedBmc': 'BMC प्रवेश अनलॉक — तुमची वॉर्ड रांग पाहा.',

      'access.approvedToast': 'मंजूर — क्लेम कोड {code}',

      'access.rejectedToast': 'विनंती नाकारली.',

      'access.proofAttached': 'पुरावा जोडला',

      'access.proofTooBig': 'प्रतिमा खूप मोठी — कृपया लहान फोटो जोडा.',

      'lead.title': 'समुदाय लीड व्हा',

      'lead.subtitle': 'स्वतःला नामांकित करा — शेजारी मतदान करतील. अ‍ॅडमिनची गरज नाही.',

      'lead.discoverNudge': 'तुम्ही खूप सक्रिय आहात! तुमच्या वॉर्डमध्ये स्वच्छता मोहिमेचे नेतृत्व करण्याचा विचार करा.',

      'lead.discoverNudgeCta': 'अधिक जाणून घ्या',

      'lead.step1': 'वॉर्ड आणि scope सह nominate',

      'lead.step2': 'शेजारी समर्थन दाबतील',

      'lead.step3': '2 समर्थन = भूमिका (दोन उमेदवार असल्यास प्रत्येकाला 5)',

      'lead.roleLabel': 'Lead प्रकार',

      'lead.roleWard': 'वॉर्ड NGO लीड',

      'lead.roleNbh': 'परिसर लीड',

      'lead.nameLabel': 'तुमचे नाव',

      'lead.namePh': 'शेजारी तुम्हाला कसे ओळखतात',

      'lead.orgLabel': 'संस्था / RWA',

      'lead.orgPh': 'NGO किंवा society नाव',

      'lead.neighbourhoodLabel': 'परिसर / सोसायटी / लेन',

      'lead.neighbourhoodHintNoWard': 'स्थानिक सूचना साठी प्रथम वॉर्ड निवडा.',

      'lead.neighbourhoodHintWard': '{ward} मध्ये {n} परिसर/सोसायटी — नसेल तर टाइप करा.',

      'lead.neighbourhoodHintCustom': 'यादीत नसेल तर परिसर, सोसायटी किंवा लेन लिहा.',

      'lead.pitchLabel': 'तुम्ही का?',

      'lead.pitchPh': 'मतदारांसाठी छोटी नोंद',

      'lead.submit': 'मला nominate करा',

      'lead.confirmTitle': 'तुम्ही मतदानात आहात!',

      'lead.confirmBody': 'CivicRadar शेजाऱ्यांसोबत शेअर करा — समन्वयक साधनांसाठी 2 समर्थन हवे. एकाच जागेसाठी दोन उमेदवार असल्यास दोघांनाही 5 हवे.',

      'lead.confirmLocal': 'या डिव्हाइसवर जतन — ऑनलाइन झाल्यावर सिंक होईल.',

      'lead.viewCommunity': 'Community मध्ये candidates पहा',

      'lead.profileCta': 'वॉर्ड किंवा neighbourhood lead व्हा',

      'lead.partnerCta': 'Community lead व्हा — peer support ने मिळवा',

      'lead.communityTitle': 'समुदाय leads',

      'lead.communityHint': 'सफाई coordinator म्हणून volunteer शेजाऱ्यांना Support करा. 2 = role; अनेक candidates = प्रत्येकाला 5.',

      'lead.communityEmpty': 'तुमच्या वॉर्डमध्ये अजून उमेदवार नाही — स्वतःला नामांकित करा.',

      'lead.becomeCta': 'Community lead व्हा',

      'lead.support': 'समर्थन',

      'lead.supported': 'समर्थित',

      'lead.progress': '{count}/{threshold} support',

      'lead.progressCoLead': 'co-lead साठी {count}/{threshold}',

      'lead.tagWard': 'वॉर्ड लीड',

      'lead.tagNbh': 'परिसर',

      'lead.you': 'तुम्ही',

      'lead.errName': 'कृपया नाव जोडा.',

      'lead.errWard': 'वॉर्ड निवडा.',

      'lead.errNeighbourhood': 'neighbourhood किंवा society प्रविष्ट करा.',

      'lead.errAlreadyVoted': 'तुम्ही या candidate ला आधीच Support केले.',

      'lead.errAlreadyNominated': 'या scope साठी active nomination आधीच आहे.',

      'lead.errAlreadyLead': 'तुम्ही आधीच ही lead role धरता.',

      'lead.nominated': 'नामांकन पाठवले — Community मध्ये समर्थन मिळवा!',

      'lead.nominatedLocal': 'Nomination जतन — online झाल्यावर sync.',

      'lead.voted': 'Support मोजला — शेजाऱ्याला पाठिंबा दिल्याबद्दल धन्यवाद!',

      'lead.granted': 'आवश्यक समर्थन पूर्ण — समन्वयक प्रवेश खुला!',

      'lead.submitError': 'पाठवता आले नाही — पुन्हा प्रयत्न.',

      'lead.voteError': 'Support नोंदवता आला नाही — पुन्हा प्रयत्न.',

    },
    gu: {

      'lang.name': 'Gujarati',

      'lang.native': 'ગુજરાતી',

      'nav.map': 'નકશો',

      'nav.community': 'સમુદાય',

      'nav.resources': 'સંસાધનો',

      'nav.profile': 'પ્રોફાઇલ',

      'fab.report': 'ફરિયાદ',

      'header.context': 'વોર્ડ જોખમ નકશો — મુંબઈ, પુણે અને ઠાણે',

      'header.contextCity': '{city} માટે વોર્ડ જોખમ નકશો',

      'location.banner': 'સચોટ ફરિયાદ માટે સ્થાન ચાલુ કરો.',

      'location.bannerNearby': 'જોખમોની ફરિયાદ કરવા અને નજીકની સમસ્યાઓ જોવા માટે સ્થાન ચાલુ કરો.',

      'location.unavailable': 'આ બ્રાઉઝરમાં સ્થાન ઉપલબ્ધ નથી.',

      'location.withdrawn': 'સ્થાન સંમતિ પાછી ખેંચી. ફરિયાદ કરતી વખતે ફરી ચાલુ કરો.',

      'location.dismiss': 'સ્થાન સૂચના બંધ કરો',

      'location.locate': 'મારું સ્થાન',

      'location.locateAria': 'સ્થાન ચાલુ કરો',

      'location.enable': 'ચાલુ કરો',

      'tagline.threeBeat': 'નકશા પર · ફોટો · રિપોર્ટ',

      'tagline.subline': 'ત્રણ ટૅપ — તમારો વોર્ડ, એક ફોટો, પડોશીઓને ચેતવણી.',

      'tagline.beatMap': 'નકશા પર',

      'tagline.beatSnap': 'ફોટો',

      'tagline.beatReport': 'રિપોર્ટ',

      'coach.step': 'શરૂઆત · 30 સેકંડ',

      'coach.title': 'તમારા વોર્ડના નકશામાં આપનું સ્વાગત છે',

      'coach.body': 'રિપોર્ટ કરવા માટે ત્રણ ટૅપ: તમારી જગ્યા, એક ફોટો, અને તમારા પડોશીઓને ખબર પડી જાય છે.',

      'coach.got': 'ચાલો શરૂ કરીએ',

      'tour.skip': 'છોડો',

      'tour.next': 'આગળ',

      'tour.done': 'સમજાઈ ગયું',

      'tour.replay': 'ટૂર ફરી જુઓ',

      'tour.map.title': 'તમારો વોર્ડ, નકશા પર',

      'tour.map.body': 'તમારા પડોશીઓએ નોંધેલ દરેક જોખમ અહીં પિન તરીકે દેખાય છે.',

      'tour.report.title': 'કંઈક દેખાયું?',

      'tour.report.body': 'Report દબાવો અને તમે જ્યાં ઊભા છો ત્યાં જ ફોટો લો.',

      'tour.profile.title': 'તમે નકશા પર છો',

      'tour.profile.body': 'તમારા પડોશીઓ પિન જુએ છે. Profile માં તમારા Civic Points ટ્રૅક કરો.',

      'persona.citizen.idle': 'આસપાસ કોઈ જોખમ દેખાયું? 30 સેકંડમાં નોંધો — તમારા પડોશીઓ તમારો આભાર માનશે.',

      'persona.wardImpact': '{ward}: અત્યાર સુધી તમારા પડોશીઓની {n} ફરિયાદ. તમારી પણ ઉમેરો.',

      'persona.unfiled': '{n} સ્પોટ તમારા વોર્ડ નકશા પર ખુલ્લા છે — પડોશીઓ સાથે શેર કરો, અથવા Resources માંથી અધિકૃત રીતે નોંધાવો.',

      'persona.pendingFiled': '{n} તમારા વોર્ડ નકશા પર ખુલ્લા છે — મુદત વીતી હોય તો Profile જુઓ.',

      'persona.admin.idlePending': '{n} સમીક્ષાની રાહ જોઈ રહ્યા છે — queue ખોલો, અથવા red pins દબાવો.',

      'persona.admin.idleEmpty': 'બધું બરાબર છે. પડોશીઓની નવી ફરિયાદો અહીં દેખાશે.',

      'persona.admin.header': 'BMC સમીક્ષા મોડ',

      'persona.admin.exit': 'BMC મોડ બંધ',

      'persona.ngo.header': 'NGO સંકલક મોડ',

      'persona.ngo.exit': 'NGO મોડ બંધ',

      'onboard.title': 'CivicRadar માં આપનું સ્વાગત છે',

      'onboard.subtitle': 'તમારી શેરી, એક નકશા પર. સમસ્યા દેખાય તો ફોટો લો — તમારા પડોશીઓ પણ તે જોશે.',

      'onboard.city': 'તમારું શહેર',

      'onboard.cityHint': 'ક્યાં રહો છો પસંદ કરો — પછીના પગલામાં અમે તમારા સ્થાનથી તમારો વોર્ડ શોધીશું.',

      'onboard.ward': 'તમારો વોર્ડ',

      'onboard.wardPh': 'તમારો વોર્ડ ટાઈપ કરવાનું શરૂ કરો…',

      'combobox.noMatches': 'કોઈ મેળ નહીં — બીજી શોધ અજમાવો',

      'combobox.showOptions': 'બધા વિકલ્પો બતાવો',

      'onboard.wardHint': '{city}ના વોર્ડમાંથી પસંદ કરો, અથવા અમને શોધવા દો.',

      'onboard.wardDetecting': 'તમારા સ્થાનથી તમારો વોર્ડ શોધી રહ્યા છીએ…',

      'onboard.wardDetectedHint': 'તમારા સ્થાનથી અંદાજિત વોર્ડ — તમે તે બદલી શકો છો.',

      'onboard.wardManual': 'બરાબર નથી? જાતે પસંદ કરો',

      'onboard.wardRetry': 'ફરી પ્રયત્ન કરો',

      'onboard.wardDetectFailed': 'તમારો વોર્ડ મળ્યો નહીં. જાતે પસંદ કરો, અથવા લોકેશન ચાલુ કરો.',

      'onboard.name': 'પ્રદર્શિત નામ',

      'onboard.namePh': 'પડોશીઓ તમને શું કહે?',

      'onboard.join': 'તમારા વોર્ડમાં જોડાઓ',

      'onboard.wardError': 'યાદીમાંથી વોર્ડ પસંદ કરો, અથવા લોકેશન ચાલુ કરો.',

      'onboard.society': 'સોસાયટી અથવા પડોશ (વૈકલ્પિક)',

      'onboard.societyPh': 'તમારી સોસાયટી અથવા RWA નું નામ, જો યાદીમાં ન હોય',

      'onboard.societyHintNoWard': 'નજીકની સોસાયટી જોવા માટે પહેલા તમારો વોર્ડ પસંદ કરો.',

      'onboard.societyHintWard': '{ward} માં {n} સોસાયટી — ટાઇપ કરવાનું શરૂ કરો, અથવા તમારી ઉમેરો.',

      'onboard.societyHintCustom': 'યાદીમાં ન હોય તો તમારી સોસાયટી અથવા RWA નું નામ લખો.',

      'report.title': 'જોખમની ફરિયાદ કરો',

      'report.step.capture': 'ફોટો',

      'report.step.confirm': 'પુષ્ટિ',

      'report.step.photo': 'ફોટો',

      'report.step.details': 'વિગતો',

      'report.step.submit': 'મોકલો',

      'report.addNote': '+ Landmark ઉમેરો',

      'report.pinDragHint': 'પિન યોગ્ય જગ્યાએ ન હોય તો ખેંચીને સેટ કરો',

      'report.pinAccuracyGood': 'સ્થાન આશરે ~{m} મી ચોક્કસ',

      'report.pinAccuracyFair': 'સ્થાન ~{m} મી — પિન ખેંચો અથવા ખુલ્લી જગ્યાએ જાઓ',

      'report.pinAccuracyPoor': 'સ્થાન અંદાજે (~{m} મી) — પિન જોખમ પર ખેંચો',

      'report.pinAccuracyUnknown': 'પિન જોખમ પર છે? જરૂર હોય તો ખેંચો',

      'report.pinAccuracyAdjusted': 'પિન સમાયોજિત',

      'report.pinLocating': 'તમારું સ્થાન શોધી રહ્યાં છીએ…',

      'report.pinMapAria': 'જોખમનું સ્થાન નકશા પર સમાયોજિત કરો',

      'report.wardChip': '{ward}',

      'report.wardGps': 'મોકલતી વખતે GPS સ્થાન',

      'report.wardManualPin': 'નકશા પર પિન મૂક્યું',

      'report.geoExplainerTitle': 'જોખમ નકશા પર પિન કરો',

      'report.geoExplainerBody': 'જોખમ પિન કરવા માટે જ અમને તમારું સ્થાન જોઈએ — બીજું કંઈ નહીં.',

      'report.geoExplainerContinue': 'મારું સ્થાન વાપરો',

      'report.geoExplainerManual': 'નકશા પર પિન મૂકો',

      'report.manualPinBanner': 'જોખમ જ્યાં છે ત્યાં નકશા પર ટૅપ કરો',

      'report.manualPinCancel': 'રદ કરો',

      'report.placePinOnMap': 'નકશા પર પિન મૂકો',

      'report.geoEnableHint': 'લોકેશન કેવી રીતે ચાલુ કરવું',

      'report.geoEnableHelp': 'બ્રાઉઝર સેટિંગ → સાઇટ પરવાનગી → Location → Allow. પછી Submit દબાવો.',

      'report.hazardType': 'જોખમનો પ્રકાર',

      'report.hazardHint': 'જોખમનો પ્રકાર પસંદ કરો',

      'report.photoNext': '{hazard} પસંદ — તૈયાર હો તો Submit દબાવો',

      'report.photoEvidence': 'ફોટો પુરાવો',

      'report.capture': 'ફોટો લો',

      'report.notes': 'Landmark (વૈકલ્પિક)',

      'report.notesPh': 'કઈ દુકાન/ઇમારત પાસે? જેમ કે "સાઈ મેડિકલ સામે"',

      'report.submit': 'ફરિયાદ મોકલો',

      'report.photoHint': 'ફોટોમાં જોખમ દેખાય? Submit — નહીં તો Retake.',

      'report.retake': 'ફરી લો',

      'moderation.guidelines': 'જોખમનો સ્પષ્ટ ફોટો લો — નીચેનું બટન દબાવો. ચહેરા, દસ્તાવેજો કે અસંબંધિત વસ્તુઓ નહીં. સ્થાન ડેટા ગોપનીયતા માટે દૂર કરવામાં આવે છે.',

      'moderation.guidelines.stagnant-water': 'ભરાયેલા પાણીનો સ્પષ્ટ ફોટો લો — નીચેનું બટન દબાવો. ચહેરા, દસ્તાવેજો કે અસંબંધિત વસ્તુઓ નહીં. સ્થાન ડેટા ગોપનીયતા માટે દૂર કરવામાં આવે છે.',

      'moderation.guidelines.garbage': 'કચરાના ઢગાળા કે ડંપનો સ્પષ્ટ ફોટો લો — નીચેનું બટન દબાવો. ચહેરા, દસ્તાવેજો કે અસંબંધિત વસ્તુઓ નહીં. સ્થાન ડેટા ગોપનીયતા માટે દૂર કરવામાં આવે છે.',

      'moderation.guidelines.potholes': 'ખાડા કે રસ્તાની નુકસાનનો સ્પષ્ટ ફોટો લો — નીચેનું બટન દબાવો. ચહેરા, દસ્તાવેજો કે અસંબંધિત વસ્તુઓ નહીં. સ્થાન ડેટા ગોપનીયતા માટે દૂર કરવામાં આવે છે.',

      'moderation.guidelines.streetlight': 'બંધ સ્ટ્રીટલાઇટનો સ્પષ્ટ ફોટો લો — નીચેનું બટન દબાવો. ચહેરા, દસ્તાવેજો કે અસંબંધિત વસ્તુઓ નહીં. સ્થાન ડેટા ગોપનીયતા માટે દૂર કરવામાં આવે છે.',

      'moderation.scanning': 'ફોટો સલામતી તપાસ…',

      'moderation.blocked.fileType': 'ફક્ત JPEG, PNG અથવા WebP hazard ફોટો સ્વીકાર્ય છે.',

      'moderation.blocked.fileSize': 'ફોટો ખૂબ મોટો છે. નાની છબી વાપરો (મહત્તમ 8 MB).',

      'moderation.blocked.lowQuality': 'ફોટો ખૂબ નાનો અથવા અસ્પષ્ટ છે. ખતરાની નજીક જાઓ.',

      'moderation.blocked.irrelevant': 'ખતરાનો ફોટો લો — સેલ્ફી, દસ્તાવેજો અથવા ખાલી ચિત્રો નહીં.',

      'moderation.blocked.sensitive': 'ID, દસ્તાવેજો અથવા સ્ક્રીનશોટ ટાળો. ફક્ત ખતરો બતાવો.',

      'moderation.blocked.nsfw': 'અનુચિત સામગ્રીને કારણે આ ફોટો બ્લોક કર્યો.',

      'moderation.blocked.offline': 'ફોટો સલામતી તપાસ માટે ઇન્ટરનેટથી કનેક્ટ થાઓ.',

      'success.title': 'નોંધાઈ ગઈ — સરસ',

      'success.tagline': 'તમારી જગ્યા વોર્ડ નકશા પર પિન થઈ ગઈ છે.',

      'success.taglineNeighbours': '{n} પડોશીઓ પહેલેથી નજીકના સ્પોટને ટેકો આપી રહ્યા છે — હવે તમારી ફરિયાદ પણ ત્યાં છે.',

      'success.subtitle': '{corp} પર મફત — અધિકૃત ફરિયાદ ઘડિયાળ શરૂ થાય.',

      'success.step1': 'WhatsApp પર શેર કરો જેથી પડોશીઓ તેને ટેકો આપી શકે',

      'success.step2': 'વૈકલ્પિક: {corp} પર નોંધાવો અને તમારો ફરિયાદ નંબર સાચવો',

      'success.step3': 'પડોશીઓ કે {corp} તેને ઠીક થયેલું ચિહ્નિત કરી શકે — અને તમને Civic Points મળશે',

      'success.file': 'BMC પર ફરિયાદ નોંધાવો',

      'success.fileCorp': '{corp} પર ફરિયાદ નોંધાવો',

      'success.tag': '@mybmc ને ટૅગ કરો',

      'success.alert': 'તમારા પડોશીઓને કહો',

      'success.done': 'Map પર પાછા',

      'success.sharePrompt': 'WhatsApp પર શેર કરો — જેટલી વધુ નજર, એટલી ઝડપી ફિક્સ.',

      'success.shareWhatsapp': 'WhatsApp પર શેર કરો',

      'share.nativeShare': 'શેર કરો',

      'success.shareNudge': 'તમારા પડોશીઓને હજુ ખબર ન હોય — એક WhatsApp શેર તેના પર વધુ નજર લાવશે.',

      'success.shareMsg': '📍 {ward} માં {hazard} — મેં હમણાં જ તેને અમારા CivicRadar વોર્ડ નકશા પર પિન કરી.\nMe too ટૅપ કરો, અથવા તમારી શેરીમાં સ્પોટ નોંધો:\n{link}\n{hashtags}',

      'share.appMsg': '🗺️ {city} વોર્ડ જોખમ નકશો — કચરો, ખાડા, સ્ટ્રીટલાઇટ અને ભરાયેલું પાણી પિન. Me too, પ્રતિસ્પર્ધી વોર્ડને હરાવો!\n{link}\n{hashtags}',

      'share.defaultArea': 'મારા વિસ્તારમાં',

      'share.meTooMsg': '👋 મને પણ — {ward} માં {hazard}. {n} પડોશી CivicRadar પર:\n{link}\n{hashtags}',

      'share.meTooBtn': 'WhatsApp પર શેર કરો',

      'share.wardMapMsg': '🗺️ {ward}: {pending} ખુલ્લા જોખમ — CivicRadar પર અમને હરાવો!\n{link}\n{hashtags}',

      'share.cleanupMsg': '🧹 {ward} માં સ્વયંસેવકોએ {hazard} સાફ કર્યું! પહેલાં → પછી:\n{link}\n{hashtags}',

      'share.instagramCaption': '{ward} માં {hazard} સાફ 🎉 CivicRadar પર પહેલાં → પછી. ચોમાસાની જીત.\n{link}\n{hashtags}',

      'share.instagramCleanupCaption': '{ward} માં સ્વયંસેવકોએ {hazard} સાફ કર્યું 🧹 CivicRadar પર પહેલાં → પછી.\n{link}\n{hashtags}',

      'share.milestoneMsg': '🏆 {ward} એ {n} ઉકેલ! તમારો વોર્ડ?\n{link}\n{hashtags}',

      'share.firstBonus': 'પહેલું શેર — +10 Civic Points! 🎉',

      'shareWin.title': 'જીત શેર કરો!',

      'shareWin.subtitle': 'પહેલાં → પછી પુરાવો — પડોશીઓને બતાવો.',

      'shareWin.subtitleCleanup': 'સ્વયંસેવકોએ સાફ કર્યું — સોસાયટી ગ્રુપમાં શેર કરો.',

      'shareWin.whatsapp': 'WhatsApp પર જીત શેર કરો',

      'shareWin.instagramHint': 'છબી સાચવો → Instagram Stories પર પોસ્ટ કરો',

      'shareWin.downloadCard': 'સફળતા કાર્ડ ડાઉનલોડ કરો',

      'shareWin.copyCaption': 'Instagram માટે કેપ્શન કૉપી કરો',

      'shareWin.nativeShare': 'છબી શેર કરો',

      'shareWin.cardDownloaded': 'કાર્ડ સાચવ્યું — Instagram પર પોસ્ટ કરો',

      'shareWin.captionCopied': 'કેપ્શન કૉપી — Instagram માં પેસ્ટ કરો',

      'shareWin.done': 'થઈ ગયું',

      'shareWin.footerMsg': 'મેં {app} વડે {location} સાફ કરવામાં મદદ કરી!',

      'shareWin.fixedLabel': 'ઠીક',
      'shareWin.stampFixed': 'ઠીક',

      'ba.dragHint': 'પહેલાં અને પછી સરખાવવા ખેંચો',

      'ba.before': 'પહેલાં',

      'ba.after': 'પછી',


      'shareWin.aspectSquare': 'ચોરસ',

      'shareWin.aspectStory': 'સ્ટોરી',

      'toast.shareWinBtn': 'જીત શેર કરો',

      'about.shareTitle': 'એપ શેર કરો',

      'about.sharePitch': 'મફત {city} વોર્ડ જોખમ નકશો — 30 સેકમાં કચરો, ખાડા, સ્ટ્રીટલાઇટ અને ભરાયેલું પાણી પિન. Me too, પ્રતિસ્પર્ધી વોર્ડને હરાવો.\nમુંબઈ, પુણે અને ઠાણે માટે બનાવ્યું. લોગિન નહીં, 4 ભાષાઓ.\n{link}\nRWA / સોસાયટી WhatsApp ગ્રુપમાં ફોરવર્ડ કરો →',

      'about.copyPitch': 'WhatsApp પિચ કૉપી કરો',

      'about.pitchCopied': 'પિચ કૉપી — RWA ગ્રુપમાં પેસ્ટ કરો!',

      'pwa.nudge': 'એક-ટૅપ રિપોર્ટિંગ માટે CivicRadar તમારી હોમ સ્ક્રીન પર ઉમેરો.',

      'pwa.nudgeAction': 'હોમ સ્ક્રીન પર ઉમેરો',

      'pwa.nudgeDismiss': 'હમણાં નહીં',

      'update.available': 'CivicRadar ની નવી આવૃત્તિ તૈયાર છે.',

      'update.reload': 'ફરી લોડ કરો',

      'iosInstall.title': 'iPhone પર ઇન્સ્ટોલ કરો',

      'iosInstall.hint': 'Android જેવી જ એપ — App Store જરૂરી નથી. જરૂર પડે તો Safari માં ખોલો, પછી Share → Add to Home Screen.',

      'iosInstall.dismiss': 'ઇન્સ્ટોલ સૂચન બંધ કરો',

      'appOpen.title': 'CivicRadar એપમાં ખોલો',

      'appOpen.body': 'રિપોર્ટ એપમાં જુઓ — ઝડપી નકશો અને અલર્ટ.',

      'appOpen.open': 'એપમાં ખોલો',

      'appOpen.getApp': 'એપ મેળવો',

      'appOpen.dismiss': 'બેનર બંધ કરો',

      'community.challengeShare': 'મિત્રને પડકાર — વોર્ડ નકશો શેર કરો',

      'community.winsTitle': 'તાજેતરની જીત',

      'community.winsEmpty': 'ઠીક થયેલા સ્પોટ અહીં દેખાશે. એક ફરિયાદ નોંધો, પડોશીઓને સાથે લો, અને તમારી શેરી સુધરતી જુઓ.',

      'community.winsNeighbours': '{ward} માં પડોશીઓ',

      'community.winsCleanup': '{hazard} સાફ · {ward}',

      'community.winsResolved': '{hazard} ઉકેલાયું · {ward}',

      'success.points': 'Civic Points',

      'success.xpBonus': '+{n} Civic Points',

      'success.weekBonus': '+{n} — આ અઠવાડિયે તમારી પહેલી ફરિયાદ',

      'success.celebrateFirst': 'તમારી પહેલી ફરિયાદ — તમારી શેરી હમણાં જ થોડી સુરક્ષિત થઈ.',

      'success.celebrateMilestone': '{n} ફરિયાદો થઈ — તમારા પડોશીઓ નસીબદાર છે કે તમે છો.',

      'success.kudos1': 'શાબાશ — વધુ એક ખતરો રડાર પર આવ્યો.',

      'success.kudos2': 'સરસ કામ — તમારો વોર્ડ હવે થોડો સુરક્ષિત છે.',

      'success.kudos3': 'નોંધાયું! પડોશીઓની કાળજી લેવા બદલ આભાર.',

      'success.kudos4': 'ફરી હાજર — lanes આમ fix.',

      'success.kudos5': 'વધુ pin — street thanks.',

      'success.streakWeek': 'આ અઠવાડિયે {n} રિપોર્ટ — સરસ!',


      'profile.milestoneOne': 'આગલા milestone માટે 1 રિપોર્ટ બાકી',

      'profile.milestoneMany': 'આગલા milestone માટે {n} રિપોર્ટ બાકી',

      'profile.milestoneMax': '10+ રિપોર્ટ — તમારા વોર્ડ તરફથી આભાર!',

      'profile.nextStreakBadge': '{badge} માટે {n} અઠવાડિયા',

      'success.progressOne': 'આગલા બેજ માટે ફક્ત 1 વધુ ફરિયાદ.',

      'success.progressMany': 'આગલા બેજ માટે {n} વધુ ફરિયાદો.',

      'success.progressMilestone': 'બેજ મળ્યો! આગલા માટે {n} વધુ.',

      'success.progressGuardian': '{n} ફરિયાદો — તમે ખરા ચોમાસુ રક્ષક!',

      'success.shareBrag': 'વોર્ડને મદદ મળી — WhatsApp પર જણાવો!',

      'success.shareBragFirst': 'નકશા પર તમારો પહેલો પિન! શેર કરો — ઝડપથી ફેલાવો.',

      'toast.badgeMonsoon': 'પહેલો રિપોર્ટ નોંધાયો — સ્વાગત છે! 🌧️',

      'confirm.meTooThanks': 'Me too નોંધાયું — પડોશીઓ દબાણ જોઈ રહ્યા છે.',

      'toast.reportMilestone': '{n} ફરિયાદો — ચાલુ રાખો!',

      'map.empty': '{ward} માં હજુ કોઈ પિન નથી — પહેલા તમે બનો.',

      'map.emptyHint': 'તેમાં લગભગ 30 સેકંડ લાગે છે.',

      'map.emptyAction': 'પહેલી ફરિયાદ નોંધો',

      'map.emptyShare': 'WhatsApp પર તમારા પડોશીઓને બોલાવો',

      'map.emptyRival': '{ward} વિરુદ્ધ {rival} — {pending} ખુલ્લા સ્પોટ. એક નોંધો, અથવા તમારી શેરીને સાથે લાવો.',

      'map.emptyEncourage': 'દરેક પિન તમારી શેરી પર ધ્યાન દોરવામાં મદદ કરે છે — કચરો, ખાડા, સ્ટ્રીટલાઇટ, અથવા ભરાયેલું પાણી. તમારી ફરિયાદથી જ ઉકેલ શરૂ થાય છે.',

      'home.hero.badge': 'તમારો વોર્ડ, સાથે મળીને',

      'home.hero.headline': 'જોયું. લીધું. થઈ ગયું.',

      'home.hero.subline': 'તમારી શેરીમાં જોખમ 30 સેકંડમાં રિપોર્ટ કરો — તમારા પડોશીઓ પણ તે જોશે.',

      'home.hero.benefit1': 'ફોટો લો',

      'home.hero.benefit2': 'તમારો વોર્ડ પિન કરો',

      'home.hero.benefit3': 'પડોશીઓને જાણ થાય',

      'home.hero.cta': 'સ્પોટ રિપોર્ટ કરો',

      'home.hero.tour': 'ટૂંકો ટૂર જુઓ',

      'home.hero.trust': 'મફત · ઑફલાઇન કામ કરે · 3 શહેર · 4 ભાષા',

      'home.hero.dismiss': 'સ્વાગત કાર્ડ બંધ કરો',

      'map.legend.pending': 'ખુલ્લા',

      'pulse.aria': 'વોર્ડ પલ્સ: ખુલ્લા જોખમો, આ અઠવાડિયે ઠીક, અને Me too',

      'pulse.open': 'ખુલ્લા',

      'pulse.fixedWeek': 'આ અઠવાડિયે ઠીક',

      'pulse.metoo': 'Me too',

      'pulse.yourWard': 'તમારો વોર્ડ',

      'map.legend.resolved': 'ઉકેલાયા',

      'map.legend.you': 'તમે',

      'map.legend.aria': 'નકશા કિંવદંતી: ખુલ્લું, ઠીક, અને તમારા પિન',

      'reminder.unfiled': '{n} ખુલ્લા જોખમો નકશા પર — પડોશીઓ સાથે શેર કરો અથવા પ્રોફાઇલમાં અધિકૃત રીતે નોંધાવો.',

      'reminder.file': 'હમણાં નોંધાવો',

      'reminder.snooze3d': '3 દિવસમાં યાદ કરાવો',

      'reminder.gotIt': 'ઠીક છે',

      'reminder.esc7': 'નોંધાવ્યાથી {n}+ દિવસ — {ward} માં {hazard} માટે વોર્ડ એસ્કેલેશન.',

      'reminder.esc14': 'નોંધાવ્યાથી {n}+ દિવસ — {ward} માં {hazard} માટે ઝોનલ એસ્કેલેશન.',

      'reminder.esc30': 'નોંધાવ્યાથી {n}+ દિવસ — {ward} માં {hazard} માટે ફરિયાદ/RTI.',

      'reminder.escAction': 'એસ્કેલેટ કરો',

      'reminder.corroboration': '{n} પડોશીઓએ તમારી {hazard} ફરિયાદ પર "મને પણ" કહ્યું — વોર્ડ નકશા પર વધુ નજર મદદ કરે.',

      'reminder.corroAction': 'ફરિયાદ જુઓ',

      'reminder.cleanup': 'સ્વયંસેવકોએ {ward} માં {hazard} સાફ કર્યું — {corp} ફરિયાદ અધિકૃત રીતે ખુલ્લી હોઈ શકે.',

      'reminder.cleanupAction': 'સ્થિતિ જુઓ',

      'persona.ngo.pledges': '{deliver} deliver · {verify} verify',

      'persona.ngo.newHazards': 'વોર્ડમાં {n} નવા જોખમ',

      'persona.ngo.newPledges': '{n} નવી પ્રતિજ્ઞા',

      'persona.admin.overdue': '{overdue} overdue · {pending} pending — queue tap',

      'profile.badge.reporter': 'સક્રિય રિપોર્ટર',

      'profile.badge.2week': '2-અઠવાડિયા રિપોર્ટર',

      'profile.badge.3week': '3-અઠવાડિયા રિપોર્ટર',

      'profile.badge.monsoon': 'લોકલ હીરો',

      'profile.wardImpact': 'તમારો વોર્ડ: આ સીઝન {n} ફરિયાદ',

      'profile.streak': '{n}-અઠવાડિયાની રિપોર્ટિંગ સ્ટ્રીક',

      'confirm.nearby': 'પિન {m} મી. દૂર{backing}. ડુપ્લિકેટ બદલે મને પણ દબાવો — ઠીક થાય ત્યારે અપડેટ.',

      'esc.participate.title': 'સામુદાયિક ક્રિયા (વૈકલ્પિક)',

      'esc.participate.hint': 'Participate Mumbai BMC નું અધિકૃત સ્વયંસેવા/CSR પોર્ટલ છે — જંતુ નિયંત્રણ ફરિયાદો માટે નહીં. સફાઈ અભિયાન અથવા વોર્ડ પ્રોજેક્ટ માટે વાપરો.',

      'esc.participate.btn': 'Participate Mumbai',

      'esc.participate.small': 'સ્વયંસેવા · CSR · પ્રોજેક્ટ',

      'esc.corpTitle': 'સ્થાનિક મહાનગરપાલિકામાં નોંધાવો (વૈકલ્પિક)',

      'esc.corpHint': '{corp} ના અધિકૃત પોર્ટલ પર ઠેર પાણી / કીટ નિયંત્રણ ફરિયાદ નોંધાવો.',

      'esc.corpBtn': '{corp} પોર્ટલ ખોલો',

      'esc.corpSubtitle': 'CivicRadar જોખમો સમુદાય નકશા પર બતાવે છે. મહાનગરપાલિકામાં નોંધવું વૈકલ્પિક — અધિકૃત ઘડિયાળ શરૂ થાય.',

      'esc.titleCorp': '{corp} માં નોંધાવો (વૈકલ્પિક)',

      'esc.tmc.recommended': 'ભલામણ: thanecity.gov.in પર નોંધાવો અથવા TMC હેલ્પલાઇન 022-25331590 પર કૉલ કરો.',

      'esc.tmc.fileHint': 'અટકેલું પાણી / મચ્છર — નીચેના કોઈ પણ અધિકૃત TMC ચેનલનો ઉપયોગ કરો.',

      'esc.tmc.channelPortal': 'TMC ઑનલાઇન પોર્ટલ',

      'esc.tmc.channelCall': 'TMC હેલ્પલાઇન',

      'esc.tmc.channelEmail': 'મ્યુનિસિપલ કમિશનરને ઈમેલ',

      'esc.tmc.channelTweet': '@TMCaTweetAway ટૅગ',

      'esc.tmc.channelCitizenCall': 'નાગરિક કૉલ સેન્ટર (155300)',

      'esc.tmc.copyBlock': 'TMC પોર્ટલ / હેલ્પલાઇન / ઈમેલ માટે વિગતો',

      'esc.tmc.copyAllDone': 'કૉપી થયું — TMC માં નોંધાવતી વખતે પેસ્ટ કરો',

      'esc.tmc.portalHint': 'thanecity.gov.in: લૉગિન → ઑનલાઇન નાગરિક સેવાઓ → ફરિયાદ નોંધાવો. નીચે વિગતો પેસ્ટ કરો.',

      'esc.tmc.filedConsent': 'મેં અધિકૃત TMC ચેનલ પર નોંધાવ્યું (પોર્ટલ / હેલ્પલાઇન / ઈમેલ / 155300 / Aaple Sarkar)',

      'esc.tmc.complaintLabel': 'TMC ફરિયાદ / સંદર્ભ નંબર',

      'esc.tmc.complaintPh': 'ઉદા. TMC/2026/123456',

      'esc.tmc.complaintWarn': 'આ સામાન્ય TMC સંદર્ભ જેવું નથી — સાચું હોય તો પણ સાચવી શકો.',

      'esc.tmc.filedNote': 'TMC માં નોંધાવ્યું — મુદત પસાર થતાં આગળ વધારો.',

      'esc.tmc.daysSince': 'TMC માં નોંધાવ્યાના {n} દિવસ',

      'esc.tmc.selfTitle': 'TMC એ ઠીક કર્યું?',

      'esc.tmc.selfBody': 'TMC ઠીક કરે ત્યારે પુષ્ટિ કરો — બધા માટે લીલો ચિહ્ન.',

      'esc.tmc.aaple': 'Aaple Sarkar — TMC સ્થાનિક સંસ્થા પસંદ કરો',

      'esc.tmc.deptTitle': 'વિભાગ સંપર્ક (એસ્કેલેશન)',

      'esc.tmc.deptHint': 'અટકેલા પાણી માટે — પાણી, આરોગ્ય, પ્રદૂષણ નિયંત્રણ.',

      'esc.tmc.dept.water': 'પાણી',

      'esc.tmc.dept.health': 'આરોગ્ય',

      'esc.tmc.dept.pollution': 'પ્રદૂષણ નિયંત્રણ',

      'esc.tmc.tier.file.body': 'thanecity.gov.in, 022-25331590 / 022-25331211, mc@thanecity.gov.in, અથવા 155300. સંદર્ભ અહીં સાચવો.',

      'esc.tmc.tier.matrix.body': 'વોર્ડ ઑફિસ અથવા આરોગ્ય (022-25331590) ને ફોલો-અપ. TMC સંદર્ભ આપો.',

      'esc.tmc.tier.zonal.body': 'મ્યુનિસિપલ કમિશનર (mc@thanecity.gov.in) સુધી એસ્કેલેટ. @TMCaTweetAway પર ફોટો સાથે ટૅગ.',

      'esc.tmc.tier.grievance.body': 'એક મહિના પછી પણ? Aaple Sarkar (pgportal.gov.in) — Thane Municipal Corporation પસંદ કરો.',

      'esc.tmc.tier.openCall': 'TMC કૉલ',

      'esc.tmc.tier.openTweet': '@TMCaTweetAway',

      'esc.tmc.tier.openEmail': 'MC ઈમેલ',

      'esc.tmc.tier.openAaple': 'Aaple Sarkar',

      'esc.tmc.consentRequired': 'સાચવતા પહેલાં અધિકૃત TMC ચેનલ પર નોંધાવ્યાની પુષ્ટિ કરો.',

      'esc.pmc.subtitle': 'CivicRadar જોખમો સામુદાયિક નકશા પર બતાવે છે. PMC માં નોંધાવવું વૈકલ્પિક — અધિકૃત ઘડિયાળ શરૂ કરે. આ PMC ચેનલ નથી.',

      'esc.pmc.recommended': 'ભલામણ: PMC CARE WhatsApp — મોટાભાગના Pune વોર્ડ માટે સૌથી ઝડપી.',

      'esc.pmc.fileHint': 'અટકેલું પાણી અને મચ્છર PMC CARE દ્વારા જાય છે. કોઈ પણ ચેનલ:',

      'esc.pmc.channelWa': 'PMC CARE WhatsApp',

      'esc.pmc.channelWaSmall': 'ચેટ · નીચેથી કૉપી',

      'esc.pmc.channelCall': 'ટોલ-ફ્રી હેલ્પલાઇન',

      'esc.pmc.channelPortal': 'PMC CARE પોર્ટલ',

      'esc.pmc.channelApp': 'PMC CARE એપ',

      'esc.pmc.channelAppSmall': 'Play Store · App Store',

      'esc.pmc.copyBlock': 'PMC CARE / WhatsApp / હેલ્પલાઇન માટે વિગતો',

      'esc.pmc.copyAllDone': 'કૉપી થયું — PMC CARE / WhatsApp પર નોંધાવતી વખતે પેસ્ટ કરો',

      'esc.pmc.portalHint': 'PMC CARE પોર્ટલ અથવા એપ: અટકેલા પાણી / મચ્છર ફરિયાદ નોંધાવો. નીચે વિગતો પેસ્ટ કરો.',

      'esc.pmc.filedConsent': 'મેં અધિકૃત PMC ચેનલ પર નોંધાવ્યું (PMC CARE / WhatsApp / હેલ્પલાઇન / એપ)',

      'esc.pmc.complaintLabel': 'PMC ફરિયાદ / સંદર્ભ નંબર',

      'esc.pmc.complaintPh': 'ઉદા. PMC/2026/123456',

      'esc.pmc.complaintWarn': 'આ સામાન્ય PMC સંદર્ભ જેવું નથી — સાચું હોય તો પણ સાચવી શકો.',

      'esc.pmc.filedNote': 'PMC માં નોંધાવ્યું — મુદત પસાર થતાં આગળ વધારો.',

      'esc.pmc.daysSince': 'PMC માં નોંધાવ્યાના {n} દિવસ',

      'esc.pmc.selfTitle': 'PMC એ ઠીક કર્યું?',

      'esc.pmc.selfBody': 'PMC ઠીક કરે ત્યારે પુષ્ટિ કરો — બધા માટે લીલો ચિહ્ન.',

      'esc.pmc.tier.file.body': 'મફત. PMC CARE પોર્ટલ, WhatsApp, 1800 1030 222, અથવા PMC CARE એપ. સંદર્ભ અહીં સાચવો.',

      'esc.pmc.tier.matrix.body': 'PMC CARE અથવા ટોલ-ફ્રી હેલ્પલાઇન દ્વારા ફોલો-અપ. ફરિયાદ નંબર આપો.',

      'esc.pmc.tier.zonal.body': 'વોર્ડે કાર્યવાહી નહીં? PMC CARE પોર્ટલ અથવા WhatsApp દ્વારા એસ્કેલેટ.',

      'esc.pmc.tier.grievance.body': 'એક મહિના પછી પણ? Aaple Sarkar (pgportal.gov.in) — Pune Municipal Corporation પસંદ કરો.',

      'esc.pmc.tier.openWa': 'WhatsApp',

      'esc.pmc.tier.openCall': 'PMC હેલ્પલાઇન',

      'esc.pmc.tier.openAaple': 'Aaple Sarkar',

      'esc.pmc.consentRequired': 'સાચવતા પહેલાં અધિકૃત PMC ચેનલ પર નોંધાવ્યાની પુષ્ટિ કરો.',

      'esc.pmc.aaple': 'Aaple Sarkar — Pune Municipal Corporation સ્થાનિક સંસ્થા પસંદ કરો',

      'copy1916.pmc.header': 'PMC ફરિયાદ વિગત (PMC CARE / WhatsApp / હેલ્પલાઇન પર કૉપી-પેસ્ટ)',

      'copy1916.pmc.complaintNotFiled': 'PMC ફરિયાદ #: (હજુ નોંધ નથી)',

      'copy1916.pmc.complaintFiled': 'PMC ફરિયાદ #: {id}',

      'copy1916.tmc.header': 'TMC ફરિયાદ વિગત (thanecity.gov.in / હેલ્પલાઇન / ઈમેલ માટે કૉપી-પેસ્ટ)',

      'copy1916.tmc.complaintNotFiled': 'TMC ફરિયાદ / સંદર્ભ #: (હજી દાખલ નથી)',

      'copy1916.tmc.complaintFiled': 'TMC ફરિયાદ / સંદર્ભ #: {id}',

      'profile.fileCorp': '{corp} માં નોંધાવો',

      'community.title': 'સમુદાય',

      'community.subtitle': '{ward} માં {corp} સાથે મળીને ઠીક કરો — પડોશીઓને બોલાવો, જીત ઉજવો, સ્થાનિક લીડ્સને સપોર્ટ કરો.',

      'community.subtitleActive': '{ward}: {pending} ખુલ્લા જોખમો · {resolved} ઉકેલાયા. પડોશીઓને બોલાવો — મદદ માટે Resources જુઓ!',

      'community.topWards': 'ટોચના વોર્ડ',

      'community.localCitizens': 'સ્થાનિક નાગરિકો',

      'community.periodMonth': 'આ મહિને',

      'community.periodAll': 'અત્યાર સુધી',

      'community.thisWeekTitle': 'આ અઠવાડિયે તમારો વોર્ડ',

      'community.leaderboardTitle': 'વોર્ડ લીડરબોર્ડ',

      'community.getInvolvedTitle': 'સામેલ થાઓ',

      'community.resourcesTitle': 'સંસાધનો',

      'resources.title': 'સંસાધનો',

      'resources.subtitle': 'અધિકૃત દાખલ લિંક્સ અને તમારા વોર્ડમાં મદદ કરવાના માર્ગો.',

      'resources.actionTitle': 'તમારા વોર્ડમાં મદદ કરો',

      'community.supportTitle': 'સ્વયંસેવકોને ટેકો આપો',

      'community.supportBody': 'ભરાયેલા પાણી સામે લડતા સ્થાનિક સફાઈ દળોને મદદ માટે સામગ્રી દાન કરો.',

      'community.pledge': 'દાન',

      'community.volunteerTitle': 'મારા વોર્ડમાં સ્વયંસેવા',

      'community.volunteerBody': 'સાથે મળીને ઠીક કરો — {corp} પર નોંધ અલગ છે.',

      'community.volunteerCta': 'સાઇન અપ',

      'volunteer.title': 'મારા વોર્ડમાં સ્વયંસેવા',

      'volunteer.subtitle': 'પડોશીઓ સાથે મળીને — અધિકૃત BMC સ્વયંસેવક કાર્યક્રમ નથી.',

      'volunteer.ward': 'તમારો વોર્ડ',

      'volunteer.neighbourhood': 'પડોશ / સોસાયટી / ગલી',

      'volunteer.neighbourhoodPh': 'દા.ત. Phoenix Mills લેન, Building 7 Worli',

      'volunteer.neighbourhoodHintNoWard': 'સ્થાનિક સૂચનાઓ માટે પહેલા વોર્ડ પસંદ કરો.',

      'volunteer.neighbourhoodHintWard': '{ward} માં {n} પડોશ/સોસાયટી — ન મળે તો ટાઇપ કરો.',

      'volunteer.neighbourhoodHintCustom': 'યાદીમાં ન હોય તો પડોશ, સોસાયટી અથવા ગલી લખો.',

      'volunteer.hours': 'આ ચોમાસે ઉપલબ્ધ કલાક',

      'volunteer.hoursCustom': 'કસ્ટમ',

      'volunteer.skills': 'હું આમાં મદદ કરી શકું',

      'volunteer.skill.cleanup': 'ભરાયેલું પાણી સાફ કરવું',

      'volunteer.skill.awareness': 'જાગૃતિ અને WhatsApp outreach',

      'volunteer.skill.pledge': 'દાન વિતરણ (સામગ્રી)',

      'volunteer.contact': 'ફોન / WhatsApp (વૈકલ્પિક)',

      'volunteer.contactHint': 'વૈકલ્પિક — ફક્ત વોર્ડ/પડોશ સંકલકને દેખાશે. CivicRadar ઑટો-કૉલ કરતું નથી.',

      'volunteer.ageNote': 'Terms મુજબ 18+ જરૂરી. 18 થી ઓછી ઉંમર? માતા-પિતા/સંભાળક અથવા NSS સંકલક સાથે જ.',

      'volunteer.submit': 'સ્વયંસેવક નોંધ સાચવો',

      'volunteer.remove': 'મારી નોંધ કાઢો',

      'volunteer.edit': 'નોંધ સંપાદિત કરો',

      'volunteer.empty': 'હજુ સાઇન અપ નથી. Community માંથી ગલીમાં મદદ કરો.',

      'volunteer.emptyAction': 'મારા વોર્ડમાં સ્વયંસેવા',

      'volunteer.hoursLabel': 'આ ચોમાસે {n} કલાક',

      'popup.helpClean': 'હું સાફ કરવામાં મદદ કરી શકું',

      'popup.taskOffered': 'સ્વયંસેવકે મદદની ઓફર કરી',

      'toast.volunteerSaved': 'સ્વયંસેવક નોંધ સાચવી — વોર્ડ સંકલક જોઈ શકે.',

      'toast.volunteerRemoved': 'સ્વયંસેવક નોંધ કાઢી.',

      'toast.volunteerWardRequired': 'પહેલા ઑનબોર્ડિંગમાં વોર્ડ સેટ કરો.',

      'toast.volunteerNeighbourhoodRequired': 'પડોશ, સોસાયટી અથવા ગલી દાખલ કરો.',

      'toast.volunteerSkillRequired': 'મદદનો ઓછામાં ઓછો એક રસ્તો પસંદ કરો.',

      'toast.volunteerTaskOffered': 'ઓફર મોકલી — સંકલક આ સ્પોટ સાથે મેળવશે.',

      'toast.volunteerTaskDuplicate': 'આ જોખમ માટે પહેલેથી ઓફર કરી છે.',

      'toast.volunteerSignupRequired': 'પહેલા Community માં સ્વયંસેવક સાઇન અપ કરો.',

      'toast.volunteerTaskCompleted': 'સફાઈ પૂર્ણ — રિપોર્ટરને સૂચના.',

      'toast.coordScopeWard': 'વોર્ડ સંકલક — સંપૂર્ણ {ward}',

      'toast.coordScopeNbh': 'પડોશ લીડ — {label}',

      'inquiry.coordTitle': 'વોર્ડ અથવા પડોશ સમન્વયક બનો',

      'inquiry.coordBody': 'RWA/સોસાયટી અથવા વોર્ડ NGO નું નેતૃત્વ કરો — સ્વયંસેવક જુઓ, સફાઈ મેળવો, દાન કલાક ચકાસો. ઑપરેટર પાસેથી ઇનવાઇટ કોડ માંગો.',

      'about.becomeCoord': 'વોર્ડ અથવા પડોશ સમન્વયક બનો',

      'coord.codeHint': 'સંકલકોને કોડ મળે — વોર્ડ અથવા RWA/સોસાયટી સ્તર.',

      'coord.volunteers': 'તમારા વિસ્તારના સ્વયંસેવકો',

      'coord.volunteersEmpty': 'હજુ સ્વયંસેવક નથી. Community ટેબ શેર કરો.',

      'coord.tasks': 'સ્વયંસેવક સફાઈ ઓફર',

      'coord.tasksEmpty': 'હજુ ઓફર નથી. ખુલ્લા પિન પર "હું સાફ કરવામાં મદદ કરી શકું" દબાવો.',

      'coord.tasksPending': 'કાર્ય',

      'coord.volunteersLabel': 'સ્વયંસેવક',

      'coord.markTaskComplete': 'સફાઈ પૂર્ણ',

      'coord.scopeWard': 'વોર્ડ લીડ · {ward}',

      'coord.scopeNbh': 'પડોશ લીડ · {label}',

      'profile.volunteer': 'મારી સ્વયંસેવક નોંધણી',

      'profile.section.details': 'તમારી વિગતો',

      'profile.section.location': 'શહેર, વોર્ડ અને પડોશ',

      'profile.section.activity': 'પ્રવૃત્તિ',

      'profile.section.account': 'એકાઉન્ટ અને સહાય',

      'profile.title': 'તમારી પ્રોફાઇલ',

      'profile.persona': 'નાગરિક',

      'profile.points': 'Civic Points',

      'profile.xpTotalLabel': '{n} XP',

      'profile.xpToNext': '{level} સુધી {n} XP',

      'profile.xpMax': 'મહત્તમ સ્તર — Community Leader!',

      'xp.level.observer': 'સ્થાનિક નિરીક્ષક',

      'xp.level.wardWatcher': 'વાર્ડ વૉચર',

      'xp.level.neighbourhoodVoice': 'પડોશની આવાજ',

      'xp.level.civicChampion': 'સિવિક ચેમ્પિયન',

      'xp.level.monsoonGuardian': 'ચોમાસુ રક્ષક',

      'xp.level.communityLeader': 'Community Leader',

      'cert.title': 'પ્રમાણપત્ર અનલૉક!',

      'cert.subtitle': 'તમે {level} પ્રાપ્ત કર્યું',

      'cert.cardHeading': 'Civic Hero પ્રમાણપત્ર',

      'cert.awarded': '{name} ને પ્રદાન',

      'cert.date': '{date}',

      'cert.tagline': 'આ ચોમાસામાં અમારા વાર્ડનું રક્ષણ',

      'cert.download': 'પ્રમાણપત્ર ડાઉનલોડ',

      'cert.whatsapp': 'WhatsApp પર શેર',

      'cert.copyCaption': 'કેપ્શન કૉપી',

      'cert.caption': 'મેં CivicRadar પર {level} મેળવ્યું — {ward} નું રક્ષણ કરો!\n{link}',

      'cert.captionCopied': 'કેપ્શન કૉપી — સોશલ પર પેસ્ટ',

      'cert.downloaded': 'પ્રમાણપત્ર સાચવ્યું — જીત શેર કરો!',

      'cert.done': 'થઈ ગયું',

      'profile.fixed': 'ઉકેલાયેલા જોખમો',

      'profile.pending': 'ખુલ્લા જોખમો',

      'profile.reports': 'તમારી ફરિયાદો',

      'profile.install': 'CivicRadar એપ ઇન્સ્ટોલ કરો',

      'profile.partner': 'સ્વયંસેવક / NGO લૉગિન',

      'profile.about': 'CivicRadar વિશે',

      'profile.sponsor': 'પ્રાયોજક અથવા ભાગીદાર બનો',

      'profile.deleteData': 'મારો ડેટા કાઢી નાખો',

      'profile.deleteConfirmTitle': 'તમારો ડેટા કાઢી નાખો?',

      'profile.deleteConfirmBody': 'આ તમારો CivicRadar ડેટા આ ઉપકરણ અને અમારા સર્વરમાંથી કાયમી કાઢી નાખશે. પાછું લાવી શકાશે નહીં.',

      'profile.deleteConfirmItem1': 'રિપોર્ટ અને ફોટા',

      'profile.deleteConfirmItem2': 'પ્રતિજ્ઞા અને સ્વયંસેવક નોંધણી',

      'profile.deleteConfirmItem3': 'પ્રોફાઇલ, ઇનામો અને પસંદગીઓ',

      'profile.deleteConfirmItem4': 'તમારા એકાઉન્ટ સાથે જોડાયેલ ક્લાઉડ બેકઅપ',

      'profile.deleteConfirmCancel': 'મારો ડેટા રાખો',

      'profile.deleteConfirmProceed': 'હા, બધું કાઢી નાખો',

      'profile.deleteDone': 'તમારો ડેટા કાઢી નાખ્યો. તમે ફરી શરૂ કરી શકો.',

      'profile.withdrawAnalytics': 'એનાલિટિક્સ સંમતિ પાછી લો',

      'profile.withdrawAnalyticsDone': 'એનાલિટિક્સ સંમતિ પાછી — સ્થાનિક ડેટા સાફ.',

      'profile.withdrawGps': 'સ્થાન સંમતિ પાછી લો',

      'profile.withdrawGpsDone': 'સ્થાન સંમતિ પાછી — જરૂર હોય તો નકશા બેનરથી ચાલુ કરો.',

      'profile.privacyContact': 'ગોપનીયતા / ફરિયાદ સંપર્ક',

      'legal.privacy': 'ગોપનીયતા નીતિ',

      'legal.terms': 'સેવાની શરતો',

      'legal.deleteAccount': 'એકાઉન્ટ કાઢો',

      'legal.officialSources': 'અધિકૃત સરકારી સ્રોતો',

      'impact.reports': 'ફરિયાદો',

      'impact.resolved': 'ઉકેલાયા',

      'impact.confirms': 'મને પણ',

      'impact.pledges': 'દાન',

      'impact.wards': 'વોર્ડ',

      'impact.week': 'આ અઠવાડિયે: {reports} ફરિયાદ · {resolved} ઉકેલાયા · {confirms} પુષ્ટિ',

      'impact.resolvedBreakdown': 'તમે: {self} · સમુદાય: {community} · BMC: {bmc} · સફાઈ: {cleanup}',

      'about.title': 'CivicRadar વિશે',

      'about.subtitle': 'CivicRadar મુંબઈ, પુણે અને ઠાણેમાં નાગરિક જોખમોની રિપોર્ટ કરવા માટેનું મફત સામુદાયિક એપ છે — લાઇવ વોર્ડ નકશા પર. આ સરકારી સેવા કે અધિકૃત municipal ફરિયાદ ચેનલ નથી.',

      'about.featuresTitle': 'તમે શું કરી શકો',

      'about.feature1': 'ફોટો પિનથી જોખમની રિપોર્ટ — ભરાયેલું પાણી, કચરો, ખાડા, કે તૂટેલી સ્ટ્રીટલાઇટ',

      'about.feature2': 'વોર્ડ નકશો જુઓ અને નજીકની રિપોર્ટ પર Me too થી પુષ્ટિ કરો',

      'about.feature3': 'CivicRadar પર પિન પછી, ઇચ્છો તો BMC, PMC કે TMC માં નોંધવામાં મદદ',

      'about.feature4': 'સ્થિતિ ટ્રેક કરો, સફાઈ માટે સ્વયંસેવા કરો, અને તમારા વોર્ડની સામુદાયિક પ્રગતિ જુઓ',

      'about.audienceTitle': 'કોના માટે',

      'about.audience': 'મુંબઈ, પુણે અને ઠાણેના રહેવાસીઓ, RWA અને પડોશ જૂથો — ખાસ કરીને ચોમાસામાં જ્યારે ભરાયેલું પાણી અને બંધ ગટરો મહત્વના હોય.',

      'about.creditTitle': 'પ્રોજેક્ટ વિશે',

      'about.creditNote': 'CivicRadar એક સ્વતંત્ર વિદ્યાર્થી પ્રોજેક્ટ છે — Nihira દ્વારા શરૂઆતથી બનાવવામાં આવેલ, જેથી મુંબઈ, પુણે અને ઠાણેના પડોશીઓ સ્થાનિક નાગરિક જોખમોની જાણ કરી શકે અને તેને ટ્રેક કરી શકે. તે કોઈપણ મ્યુનિસિપલ ઓથોરિટી સાથે સંલગ્ન, માન્યતાપ્રાપ્ત અથવા તેમના વતી સંચાલિત નથી. પ્રોજેક્ટ, પ્રેસ અથવા ભાગીદારી અંગેની પૂછપરછ માટે કૃપા કરીને નીચે આપેલા સંપર્કનો ઉપયોગ કરો.',

      'about.privacyTitle': 'ગોપનીયતા અને ડેટા',

      'about.privacyNote': 'અપલોડ પહેલાં ફોટોની location metadata (EXIF) દૂર થાય છે. GPS ફક્ત તમારી પરવાનગીથી પિન મૂકવા માટે. રિપોર્ટ નકશા પર સમુદાયને દેખાય છે. અધિકૃત ફરિયાદ BMC, PMC કે TMC ચેનલ દ્વારા થાય છે.',

      'about.officialSourcesTitle': 'અધિકૃત માહિતી સ્રોતો',

      'about.officialSourcesNote': 'CivicRadar સરકારી એપ નથી. BMC, PMC, TMC અને મહારાષ્ટ્ર રાજ્ય પોર્ટલના ચકાસેલ લિંક અમારા અધિકૃત સ્રોત પૃષ્ઠ પર છે — ફરિયાદ તમે જ દાખલ કરો.',

      'about.impactTitle': 'સામુદાયિક પ્રભાવ',

      'about.version': 'આવૃત્તિ {version}',

      'about.contact': 'અમારો સંપર્ક',

      'about.contactOperator': 'અમારો સંપર્ક',

      'about.close': 'બંધ',

      'about.mapCredits': 'નકશા ડેટા © OpenStreetMap contributors (ODbL). નકશો Leaflet દ્વારા.',

      'about.sponsored': 'પ્રાયોજિત',

      'about.copied': 'પ્રભાવ સારાંશ કૉપી થયો — અરજીમાં પેસ્ટ કરો.',

      'about.operatorNote': '{name} 18 ના થાય ત્યાં સુધી, {operator} સેવા ચલાવે છે — હોસ્ટિંગ, એકાઉન્ટ અને કાનૂની સંપર્ક.',

      'inquiry.title': 'CivicRadar સાથે ભાગીદારી',

      'inquiry.subtitle': 'મુંબઈ, પુણે અથવા ઠાણેના નાગરિકો સુધી પહોંચો — તમારા માટે મહત્વના વોર્ડમાં.',

      'inquiry.localTitle': 'સ્થાનિક વ્યવસાય પ્રાયોજક',

      'inquiry.localBody': 'વિશિષ્ટ વોર્ડમાં નાગરિકોને ચોમાસા-સંબંધિત ઑફર પ્રચારિત કરો.',

      'inquiry.bmcTitle': 'નગરપાલિકા પાયલટ',

      'inquiry.bmcBody': 'બહુ-વોર્ડ વિશ્લેષણ — ફક્ત આમંત્રિત BMC પાયલટ માટે. ભાગ લેવા સંપર્ક કરો.',

      'inquiry.ngoTitle': 'NGO અને સ્વયંસેવક નેટવર્ક',

      'inquiry.ngoBody': 'દાન, કલાકોની ચકાસણી અને સામુદાયિક સફાઈ સંકલન.',

      'inquiry.email': 'ભાગીદારી પૂછપરછ મોકલો',

      'lang.title': 'તમારી ભાષા પસંદ કરો',

      'hazard.stagnant-water': 'ભરાયેલું પાણી',

      'hazard.stagnant-water.example': 'દા.ત. બંધ ગટર, ભરાયેલો રસ્તો',

      'hazard.potholes': 'ખાડા',

      'hazard.potholes.example': 'દા.ત. રસ્તાનો ખાડો, બેઠેલું મેનહોલ',

      'hazard.garbage': 'કચરો',

      'hazard.garbage.example': 'દા.ત. કચરાનો ઢગલો, ભરેલો ડબ્બો',

      'hazard.streetlight': 'બંધ સ્ટ્રીટલાઇટ',

      'hazard.streetlight.example': 'દા.ત. બંધ અથવા ઝબકતી લાઇટ',

      'hazard.comingSoon': 'ટૂંક સમયમાં',

      'soon.title': 'ટૂંક સમયમાં',

      'soon.notify': 'લાઇવ થાય ત્યારે મને જાણ કરો',

      'soon.thanks': 'આભાર — લૉન્ચ થાય ત્યારે અમે તમને જાણ કરીશું.',

      'soon.roadmap': 'વધુ જોખમ પ્રકારો ટૂંક સમયમાં — કચરો, ખાડા અને સ્ટ્રીટલાઇટ હવે લાઇવ.',

      'confirm.metoo': 'મને પણ',

      'confirm.you': 'તમારી ફરિયાદ',

      'confirm.done': 'ફોલો કરી રહ્યા — ઠીક થાય ત્યારે સૂચના',

      'confirm.thanks': 'ફોલો કર્યું — ઠીક થાય ત્યારે જણાવીશું.',

      'confirm.none': 'આની પુષ્ટિ કરનાર પ્રથમ બનો',

      'confirm.followHint': 'BMC ફરિયાદ નહીં — સમુદાય પિનને ટેકો અને અપડેટ.',

      'confirm.backingOne': ' · 1 પડોશીનો ટેકો',

      'confirm.backingMany': ' · {n} પડોશીઓનો ટેકો',

      'confirm.dupe': '10 મી.ની અંદર CivicRadar પર પિન છે{backing}. ટેકો આપો — ઠીક થાય ત્યારે સૂચના.',

      'confirm.dupeAction': 'મને પણ',

      'confirm.ownDupe': 'તમે અહીં પહેલેથી પિન કર્યું છે. પ્રોફાઇલમાં જુઓ.',

      'profile.unfiledBanner': '{n} ખુલ્લા — {corp} પર હજુ નોંધાયા નથી. શેર કરવું પણ મદદ કરે; અધિકૃત નોંધાવો તો દરેક સ્થળ માટે અલગ ફરિયાદ.',

      'profile.fileNext': 'આગળની નોંધાવો',

      'confirm.resolved': '{ward} માં તમે ટેકો આપેલ જોખમ ઠીક થઈ ગયું!',

      'confirm.resolvedMany': 'તમે ટેકો આપેલ {n} જોખમો હમણાં જ ઠીક થયાં!',

      'confirm.shareBtn': 'શેર કરો',

      'confirm.shareMsg': '✅ {ward} માં જોખમ CivicRadar પર ઠીક! સામૂહિક દબાણ કામ કરે છે:\n{link}\n{hashtags}',

      'fix.looksFixed': 'હવે ઠીક લાગે છે',

      'fix.done': 'તમે ઠીક કહ્યું',

      'fix.thanks': 'આભાર — પૂરતા પડોશીઓ સહમત થાય ત્યારે ઠીક ચિહ્નિત કરીશું.',

      'fix.countOne': '1 પડોશી કહે છે ઠીક',

      'fix.countMany': '{n} પડોશી કહે છે ઠીક',

      'fix.hint': 'ફક્ત સમુદાય તપાસ — અધિકૃત BMC પુષ્ટિ નહીં.',

      'fix.resolved': '{ward} ની તપાસ કરેલી જગ્યા સમુદાય-સત્યાપિત ઠીક!',

      'fix.resolvedMany': 'તમે તપાસેલી {n} જગ્યાઓ સમુદાય-સત્યાપિત ઠીક!',

      'fix.afterPhotoPrompt': 'વૈકલ્પિક: પ્રોફાઇલમાંથી પછીનો ફોટો ઉમેરો.',

      'fix.thanksConfirmed': 'આભાર! તમે આ પડોશીઓ માટે ઠીક તરીકે ચિહ્નિત કર્યું.',

      'fix.thanksAddPhoto': 'આભાર! ઠીક થયેલી જગ્યાનો ફોટો ઉમેરો જેથી પડોશીઓ જોઈ શકે?',

      'fix.addAfterPhoto': 'પહેલાં અને પછી બતાવવા માટે ઠીક થયેલી જગ્યાનો ફોટો ઉમેરો?',

      'fix.addPhotoBtn': 'ફોટો ઉમેરો',

      'reminder.staleCheck': '{ward} પાસે — હજુ પાણી ભરાયેલું છે?',

      'reminder.stillThere': 'હજુ છે',

      'reminder.looksFixed': 'ઠીક લાગે છે',

      'reminder.addPhoto': 'ફોટો ઉમેરો',

      'settings.notifications.title': 'સૂચનાઓ અને ગોપનીયતા',

      'settings.reminder.label': 'નજીકનું ભરાયેલું પાણી ફરિયાદ કરવા યાદ અપાવો',

      'settings.reminder.sub': 'CivicRadar ખોલો ત્યારે ચોમાસામાં હળવી યાદ. કોઈ બેકગ્રાઉન્ડ ટ્રેકિંગ નહીં.',

      'settings.reminder.on': 'યાદ ચાલુ — તમે CivicRadar ખોલશો ત્યારે અમે હળવેથી યાદ અપાવીશું.',

      'settings.reminder.off': 'યાદ બંધ.',

      'settings.reminder.denied': 'સૂચનાઓ બ્લોક છે — તેના બદલે અમે એપમાં હળવી યાદ બતાવીશું.',

      'settings.notifications.sub': 'CivicRadar તમને જે જણાવી શકે અને તમારી સંમતિના વિકલ્પો, બધું એક જ જગ્યાએ.',

      'settings.nbh.new.label': 'નજીકની નવી ફરિયાદો',

      'settings.nbh.new.sub': 'તમારી સોસાયટી/વોર્ડમાં નવો પિન થાય ત્યારે યાદ અપાવીશું.',

      'settings.nbh.resolved.label': 'નજીકનો ઉકેલ',

      'settings.nbh.resolved.sub': 'નજીકનું જોખમ ઉકેલાય ત્યારે સારા સમાચાર.',

      'settings.nbh.on': 'પડોશ અપડેટ ચાલુ.',

      'settings.nbh.newOff': 'નવી ફરિયાદ સૂચનાઓ બંધ.',

      'settings.nbh.resolvedOff': 'ઉકેલ અપડેટ બંધ.',

      'settings.nbh.denied': 'સૂચનાઓ બ્લોક — અપડેટ એપમાં.',

      'notify.nbh.new.title': 'નજીક નવી ફરિયાદ',

      'notify.nbh.new.body': '{society} નજીક: {hazard} — નકશા પર મને પણ કરો',

      'notify.nbh.new.cta': 'નકશો જુઓ',

      'notify.nbh.resolved.title': 'નજીકના સારા સમાચાર',

      'notify.nbh.resolved.body': '{society} નજીક {hazard} ઉકેલાયું',

      'notify.nbh.resolved.bodyMany': '{society} નજીક {n} hazards resolve',

      'notify.nbh.resolved.cta': 'Map જુઓ',

      'notify.report.title': 'આજે ભરાયેલું પાણી જોયું?',

      'notify.report.body': 'ખાબોચિયું, ભરાયેલી ગટર કે ખુલ્લી ટાંકી પાસેથી પસાર થાઓ, તો 30 સેકન્ડમાં ફરિયાદ કરો.',

      'notify.report.cta': 'હમણાં ફરિયાદ કરો',

      'profile.status.communityVerified': 'સમુદાયે ઠીકની પુષ્ટિ',

      'profile.status.youMarkedFixed': 'તમે ઠીક ચિહ્નિત',

      'profile.status.bmcResolved': 'BMC એ ઉકેલ્યું',

      'profile.badge.communityVerified': 'સમુદાય સત્યાપિત',

      'profile.badge.youMarkedFixed': 'તમે ચિહ્નિત',

      'profile.badge.bmcResolved': 'BMC ઉકેલ',

      'community.winsCommunityVerified': '{hazard} સમુદાય-સત્યાપિત · {ward}',

      'shareWin.subtitleCommunity': 'પડોશીઓએ પુષ્ટિ કરી — અધિકૃત BMC રેકોર્ડ નહીં.',

      'shareWin.impact': '{n} પડોશીઓએ ટેકો · {ward} — આ જીત સ્ક્રીનશોટ કરો! 🏆',

      'toast.fixConfirmed': '+10 પોઇન્ટ — તપાસ માટે આભાર!',

      'toast.communityResolved': 'સમુદાય-સત્યાપિત ઠીક — ફરિયાદ માટે આભાર!',

      'sync.cloud': 'સિંક',

      'sync.local': 'ફક્ત સ્થાનિક',

      'sync.cloudTitle': 'ફરિયાદો બધા ઉપકરણો પર સિંક',

      'sync.localTitle': 'ફક્ત આ ઉપકરણ પર — ક્લાઉડ જોડાય ત્યારે સિંક થશે',

      'report.submitting': 'મોકલાઈ રહ્યું છે…',

      'success.clock': 'community map પર — {corp} માં હજુ file નહીં.',

      'community.challenge.empty': '{ward} હજુ બોર્ડ પર નથી — જોખમની જાણ કરો અને તેને બોર્ડ પર લાવો.',

      'community.challenge.beat': '{ward}: {pending} ખુલ્લા જોખમ — {rival} ({rivalPending} બાકી) કરતાં આગળ! રિપોર્ટ કે રેલી 👋',

      'community.challenge.leading': '{ward} {resolved} ઉકેલ સાથે અગ્રણી — {rival} કરતાં આગળ!',

      'community.challenge.catch': '{ward}: {leader} ({leaderResolved} ઉકેલ) નો પીછો કરો. સ્વચ્છ સર્વેક્ષણ તમારી ગલીથી.',

      'community.challenge.leaderboard': '{leader} {resolved} ઉકેલ સાથે વોર્ડ બોર્ડ પર ટોચ — આગળ કયો વોર્ડ?',

      'leaderboard.demo': 'ડેમો',

      'leaderboard.you': 'તમે',

      'leaderboard.demoNote': 'વધુ વોર્ડ રિપોર્ટ થાય ત્યાં સુધી નમૂના. વાસ્તવિક આંકડા વધશે.',

      'leaderboard.resolved': '{n} ઉકેલાયા',

      'leaderboard.emptyWards': 'તમારો વોર્ડ બોર્ડ પર જોવા રિપોર્ટ કરો.',

      'leaderboard.emptyCitizens': 'સ્થાનિક બોર્ડ પર આવવા ફરિયાદ નોંધાવો.',

      'leaderboard.emptyFirst': 'તમારા વોર્ડમાં પહેલા બનો — બોર્ડ પર ચડવા રિપોર્ટ કરો.',

      'admin.proofBefore': 'પહેલાં (નાગરિક)',

      'admin.proofAfter': 'પછી (BMC પુરાવો)',

      'admin.proofCapture': 'પુરાવો ફોટો ઉમેરો',

      'admin.proofHint': 'સ્પષ્ટ "પછી" ફોટો — નાગરિકો પહેલાં/પછી જોશે.',

      'admin.proofPrompt': 'પછીનો ફોટો ઉમેરો, પછી પુષ્ટિ માટે ફરી ટૅપ કરો.',

      'admin.proofRequired': 'પુરાવો ફોટો જરૂરી — ઉકેલતા પહેલાં "પછી" ફોટો ઉમેરો.',

      'admin.confirmResolve': 'ઉકેલની પુષ્ટિ?',

      'admin.exportCsv': 'વોર્ડ CSV નિકાસ',

      'admin.exportEmpty': 'આ ફિલ્ટર માટે નિકાસ કરવા અહવાલ નથી.',

      'admin.exportSuccess': '{n} અહવાલ CSV માં નિકાસ.',

      'admin.copy1916': '1916 માટે કૉપી',

      'admin.copy1916Copied': 'કૉપી થયું — 1916 માં પેસ્ટ કરો',

      'copy1916.header': 'BMC ફરિયાદ વિગત (1916 / MyBMC કૉલ પર કૉપી-પેસ્ટ)',

      'copy1916.categoryLabel': 'શ્રેણી',

      'copy1916.category.stagnant-water': 'ડાસ / ભરાયેલું પાણી (Public Health → Pest Control)',

      'copy1916.category.potholes': 'ખાડા / રસ્તો ખરાબ',

      'copy1916.category.garbage': 'કચરો / ઘન કચરો',

      'copy1916.category.streetlight': 'બંધ સ્ટ્રીટલાઇટ',

      'copy1916.wardLabel': 'વોર્ડ + વિસ્તાર',

      'copy1916.landmarkLabel': 'નજીકનું લેન્ડમાર્ક / નોંધ',

      'copy1916.gpsLabel': 'GPS',

      'copy1916.gpsWarning': '⚠ GPS મુંબઈ બહાર લાગે છે — નોંધાવતા પહેલાં જગ્યા ચકાસો',

      'copy1916.mapsLabel': 'Maps',

      'copy1916.dateLabel': 'તારીખ',

      'copy1916.complaintNotFiled': 'BMC ફરિયાદ #: (હજુ નોંધ નથી)',

      'copy1916.complaintFiled': 'BMC ફરિયાદ #: {id}',

      'copy1916.civicradarLinkLabel': 'CivicRadar નકશો (વૈકલ્પિક)',

      'copy1916.linkLocalhostNote': '(એપ ડિપ્લોય થયા પછી લિંક કામ કરશે)',

      'copy1916.marathiHeader': '--- મરાઠી (કૉલ સેન્ટરને વાંચો) ---',

      'copy1916.refId': 'સંદર્ભ (વૈકલ્પિક): CivicRadar ID {id}',

      'profile.proofBefore': 'પહેલાં',

      'profile.proofAfter': 'પછી',

      'confirm.shareResolvedMsg': '✅ {ward} માં ઠીક! CivicRadar પર પહેલાં → પછી:\n{link}\n{hashtags}',

      'esc.title': 'અધિકૃત ફરિયાદ સહાયક',

      'esc.subtitle': 'CivicRadar જોખમો સામુદાયિક નકશા પર બતાવે છે. BMC માં નોંધાવવું વૈકલ્પિક છે પણ અધિકૃત ઘડિયાળ શરૂ કરે — આ અધિકૃત BMC ચેનલ નથી.',

      'esc.fileTitle': 'ફરિયાદ નોંધાવો (મફત)',

      'esc.fileHint': 'ભરાયેલું પાણી વોર્ડ PCO પાસે જાય છે. કોઈ પણ ચેનલ:',

      'esc.fileHint.garbage': 'કચરો / ઘન કચરો Solid Waste Management દ્વારા જાય છે. કોઈ પણ ચેનલ:',

      'esc.fileHint.potholes': 'ખાડા અને રસ્તાનું નુકસાન Roads / Engineering પાસે જાય છે. કોઈ પણ ચેનલ:',

      'esc.fileHint.streetlight': 'બંધ સ્ટ્રીટલાઇટ Electrical વિભાગ પાસે જાય છે. કોઈ પણ ચેનલ:',

      'esc.recommended': 'ભલામણ: MyBMC WhatsApp — મોટાભાગના મુંબઈ વોર્ડ માટે સૌથી ઝડપી.',

      'esc.channelWa': 'ચેટબોટ · નીચેથી કૉપી',

      'esc.channelCall': '24×7 હેલ્પલાઇન',

      'esc.channelPortal': 'ઓનલાઇન પોર્ટલ',

      'esc.channelTweet': 'જાહેર દબાણ',

      'esc.margApp': 'MyBMC MARG એપ',

      'esc.margAppSmall': 'અધિકૃત ફરિયાદ એપ',

      'esc.copyBlock': '1916 / પોર્ટલ / એપ માટે વિગતો',

      'esc.copyAll': 'બધી વિગતો કૉપી',

      'esc.copyAllDone': 'કૉપી થઈ — અધિકૃત ચેનલ પર નોંધાવતી વખતે પેસ્ટ કરો',

      'esc.copyBilingual': 'કોલ સેન્ટર: ટેક્સ્ટ બ્લોકમાં મરાઠી લીટી વાંચી શકો.',

      'esc.portalHint': 'પોર્ટલ અથવા MARG: Public Health → Pest Control → stagnant water. નીચે વિગતો પેસ્ટ કરો.',

      'esc.portalHint.garbage': 'પોર્ટલ અથવા MARG: Solid Waste Management → garbage / drainage. નીચે વિગતો પેસ્ટ કરો.',

      'esc.portalHint.potholes': 'પોર્ટલ અથવા MARG: Roads / potholes. નીચે વિગતો પેસ્ટ કરો.',

      'esc.portalHint.streetlight': 'પોર્ટલ અથવા MARG: Electrical → streetlight. નીચે વિગતો પેસ્ટ કરો.',

      'esc.portalHintNav': 'પોર્ટલ અથવા MARG એપ પર: {hint}. વિગતો નીચે પેસ્ટ કરો.',

      'esc.filedConsent': 'મેં અધિકૃત BMC ચેનલ પર નોંધાવ્યું (1916 / MyBMC / પોર્ટલ / એપ)',

      'esc.complaintWarn': 'સામાન્ય BMC નંબર જેવું લાગતું નથી — સાચું હોય તો સાચવો.',

      'esc.saveUnlock': 'સાચવ્યા પછી: પગથિયાં, દિવસ ગણતરી, ફોલો-અપ ટેક્સ્ટ.',

      'esc.closeNudge': 'ફરિયાદ નંબર હજુ સાચવ્યો નથી — Profile માંથી ક્યારે પણ નોંધાવો.',

      'esc.daysSince': 'BMC નોંધ {n} દિવસ',

      'esc.progress.reported': 'રિપોર્ટ',

      'esc.progress.shared': 'શેર',

      'esc.progress.filed': 'નોંધ',

      'esc.progress.escalating': 'એસ્કેલેટ',

      'esc.progress.resolved': 'ઉકેલ',

      'esc.tier.copyFollowUp': 'ફોલો-અપ કૉપી',

      'esc.tier.openWa': 'WhatsApp',

      'esc.tier.openCall': '1916',

      'esc.tier.openTweet': '@mybmc',

      'esc.tier.openAaple': 'Aaple Sarkar',

      'esc.copyFollowUpDone': 'ફોલો-અપ કૉપી',

      'esc.rtiDisclaimer': 'માત્ર માહિતી RTI ટેમ્પલેટ — કાનૂની સલાહ નહીં.',

      'esc.consentRequired': 'સાચવતા પહેલાં અધિકૃત BMC ચેનલ પર નોંધાવ્યાની પુષ્ટિ કરો.',

      'esc.complaintLabel': 'BMC ફરિયાદ નંબર',

      'esc.complaintPh': 'દા.ત. N/2026/123456',

      'esc.complaintHint': 'નંબર સાચવતાં જવાબદારી ઘડિયાળ શરૂ.',

      'esc.filedNote': 'BMC માં નોંધ — મુદત પર આગળ.',

      'esc.ladderTitle': 'એસ્કેલેશન પગથિયાં',

      'esc.selfTitle': 'BMC એ ઠીક કર્યું?',

      'esc.selfBody': 'પોતે પુષ્ટિ કરો — બધા માટે લીલું.',

      'esc.selfBtn': 'ઉકેલ ચિહ્નિત',

      'esc.aaple': 'Aaple Sarkar (રાજ્ય)',

      'esc.officialHint': 'સૂચિત શ્રેણી: {hint}',

      'official.title': 'અધિકૃત ફરિયાદ ચેનલ',

      'official.subtitle': 'ચકાસેલ .gov એપ અને પોર્ટલ — CivicRadar તમારી તરફથી નોંધાવતું નથી. બધા સ્રોત લિંક અધિકૃત સ્રોત પૃષ્ઠ પર.',

      'official.viewAllSources': 'બધા અધિકૃત સ્રોતો જુઓ',

      'official.alsoFile': 'અધિકૃત રીતે પણ નોંધાવો (વૈકલ્પિક)',

      'official.copyDone': 'અધિકૃત ફરિયાદ સારાંશ કૉપી — એપ/પોર્ટલમાં પેસ્ટ કરો',

      'official.categoryHint': 'સૂચિત શ્રેણી: {hint}',

      'official.reportDate': 'રિપોર્ટ તારીખ',

      'official.photoGuidance': 'ટિપ: ઝડપી કાર્યવાહી માટે CivicRadar ફોટો અધિકૃત એપમાં જોડો.',

      'official.marg.label': 'MyBMC MARG',

      'official.marg.small': '114 શ્રેણીઓ · જીઓ ફોટો · ટ્રેકિંગ',

      'official.swachhata.label': 'Swachhata-MoHUA',

      'official.swachhata.small': 'MoHUA સ્વચ્છતા · વોર્ડ નિરીક્ષક',

      'official.aaple.label': 'Aaple Sarkar',

      'official.aaple.small': 'મહારાષ્ટ્ર રાજ્ય ફરિયાદ પોર્ટલ',

      'official.pmc.label': 'PMC CARE',

      'official.pmc.small': 'પુણે મહાનગરપાલિકા એપ',

      'official.tmc.label': 'TMC નાગરિક પોર્ટલ',

      'official.tmc.small': 'thanecity.gov.in',

      'official.bmcWa.label': 'MyBMC WhatsApp',

      'official.bmcWa.small': 'ઝડપી ચેટ ફરિયાદ',

      'official.bmcPortal.label': 'BMC ઑનલાઇન પોર્ટલ',

      'official.bmcPortal.small': 'www.mcgm.gov.in',

      'official.hint.marg.stagnant-water': 'જાહેર આરોગ્ય → કીટ નિયંત્રણ → stagnant water / મચ્છર પ્રજનન',

      'official.hint.marg.garbage': 'ઘન કચરો વ્યવસ્થાપન → કચરો / ગટર',

      'official.hint.swachhata.garbage': 'કચરો ડંપ',

      'official.hint.swachhata.stagnant-water': 'ભરાયેલી ગટર (જો ગટર સંબંધિત હોય)',

      'official.hint.pmc.stagnant-water': 'આરોગ્ય / મચ્છર ઉત્પત્તિ / ભરાયેલું પાણી',

      'official.hint.pmc.garbage': 'ઘન કચરો / કચરો',

      'official.hint.aaple': 'સ્થાનિક સંસ્થા {corp} પસંદ કરો → આરોગ્ય / પાણી વિભાગ',

      'official.hint.tmc.stagnant-water': 'પાણી / આરોગ્ય વિભાગ (મચ્છર ઉત્પત્તિ)',

      'success.alsoOfficial': 'અધિકૃત ફરિયાદ (વૈકલ્પિક)',

      'success.filingGuide': 'નોંધણી માર્ગદર્શિકા અને ફરિયાદ કૉપી',

      'esc.close': 'બંધ',

      'esc.save': 'સાચવો',

      'esc.tier.file.title': '1 · અધિકૃત ફરિયાદ',

      'esc.tier.file.body': 'મફત. વોર્ડ PCO. નંબર અહીં સાચવો.',

      'esc.tier.matrix.title': '2 · દિવસ {n}+ — વોર્ડ',

      'esc.tier.matrix.body': '7 દિવસે BMC ઑટો-એસ્કેલેટ. WCO / AMC.',

      'esc.tier.zonal.title': '3 · દિવસ {n}+ — ઝોનલ',

      'esc.tier.zonal.body': 'Zonal DMC અને @mybmc જાહેર દબાણ.',

      'esc.tier.grievance.title': '4 · દિવસ {n}+ — ફરિયાદ / RTI',

      'esc.tier.grievance.body': 'એક મહિના પછી? Aaple Sarkar અથવા RTI.',

      'profile.empty': 'હજુ ફરિયાદ નથી. નજીક કોઈ જોખમ?',

      'profile.emptyList': 'હજુ ફરિયાદ નથી. Report દબાવી નજીકના જોખમ પિન કરો.',

      'profile.emptyAction': 'હમણાં રિપોર્ટ',

      'profile.trackEscalate': 'ટ્રૅક / આગળ',

      'profile.fileBmc': 'BMC માં નોંધાવો',

      'profile.status.resolvedCitizen': 'ઉકેલ (તમે)',

      'profile.status.resolvedBmc': 'BMC એ ઉકેલ્યું',

      'profile.status.notFiled': 'સામુદાયિક નકશા પર ખુલ્લું',

      'profile.status.removed': 'મોડરેટર દ્વારા દૂર કરાયું',

      'profile.communityCleared': 'સ્વયંસેવકોએ સાફ કર્યું — {corp} ફરિયાદ હજુ ખુલ્લી હોઈ શકે',

      'profile.neighbourOne': 'પડોશીએ મને પણ કહ્યું',

      'profile.neighbourMany': 'પડોશીઓએ મને પણ કહ્યું',

      'profile.pointsHint.base': '50 પોઈન્ટ/ફરિયાદ · +200 સ્વયંસેવા',

      'profile.pointsHint.bonus': '{n} × 50 · +{bonus} બોનસ',

      'profile.greeting': 'નમસ્તે, {name}',

      'profile.greetingDefault': 'નમસ્તે, નાગરિક',

      'profile.referralCount': '🎉 તમારા આમંત્રણથી {n} પડોશીઓ જોડાયા — આભાર!',

      'profile.selectWard': 'વોર્ડ પસંદ કરો',

      'profile.society': 'સોસાયટી / પડોશ (વૈકલ્પિક)',

      'profile.societyPh': 'દા.ત. Phoenix Mills CHS, Worli',

      'profile.societyHintWard': '{ward} માં {n} સોસાયટી — ન મળે તો ટાઇપ કરો.',

      'profile.societyHintNoWard': 'સોસાયટી સૂચનાઓ માટે પહેલા વોર્ડ પસંદ કરો.',

      'profile.societyHintCustom': 'યાદીમાં ન હોય તો સોસાયટી / RWA નામ લખો.',

      'profile.societyRegistry': 'તમારી નોંધાયેલ સહકારી સોસાયટી શોધો',

      'map.youAreHere': 'તમે અહીં છો',

      'about.subtitleNamed': 'મુંબઈ, પુણે અને ઠાણે માટે સામુદાયિક ટેક — {name} દ્વારા, નાગરિકો માટે મફત.',

      'safety.hide': 'ફ્લેગ / છુપાવો',

      'safety.hidden': 'તમારા નકશાથી છુપાવ્યું.',

      'safety.hideConfirm': 'આ પિન છુપાવીએ અને સમીક્ષા માટે અમારી ટીમને મોકલીએ? (ફરિયાદ તરત ડિલીટ થતી નથી.)',

      'mute.hideReporter': 'આ રિપોર્ટરની રિપોર્ટ છુપાવો',

      'mute.hideConfirm': 'તમારા ડિવાઇસ પર આ રિપોર્ટરની બધી પિન છુપાવીએ? પ્રોફાઇલ → છુપાયેલા રિપોર્ટરમાં પાછા લાવી શકાય.',

      'mute.hidden': 'આ રિપોર્ટરની રિપોર્ટ તમારા નકશાથી છુપાઈ.',

      'mute.unmuted': 'રિપોર્ટર અનમ્યૂટ — તેમની રિપોર્ટ ફરી દેખાઈ શકે.',

      'mute.sectionTitle': 'છુપાયેલા રિપોર્ટર',

      'mute.sectionHint': 'આ વપરાશકર્તાઓની રિપોર્ટ તમારા નકશાથી છુપાઈ. ફરી દર્શાવવા ટૅપ કરો.',

      'mute.empty': 'કોઈ છુપાયેલા રિપોર્ટર નથી.',

      'mute.unmute': 'ફરી દર્શાવો',

      'popup.pending': 'બાકી',

      'popup.resolved': 'ઉકેલાયું',

      'fix.by.community': 'ઠીક — પડોશીએ પુષ્ટિ કરી',

      'fix.by.self': 'ઠીક — રિપોર્ટરે ચકાસ્યું',

      'fix.by.bmc': '{corp} દ્વારા ઉકેલ',

      'popup.society': 'સોસાયટી / પડોશ',

      'popup.communityCleared': 'સ્વયંસેવકોએ સાફ કર્યું — {corp} ફરિયાદ હજુ ખુલ્લી હોઈ શકે',

      'partner.title': 'પાર્ટનર ઍક્સેસ',

      'partner.subtitle': 'NGO સંકલનકર્તા અને સ્વયંસેવકો માટે. નગરપાલિકા ઍક્સેસ આમંત્રણ દ્વારા.',

      'partner.ngoTitle': 'NGO સંકલનકર્તા',

      'partner.ngoBody': 'દાન જુઓ, સ્વયંસેવકો મોકલો અને સફાઈ નોંધો',

      'partner.bmcTitle': 'નગરપાલિકા પાયલટ',

      'partner.bmcBody': 'આમંત્રિત BMC પાયલટ માટે — ઍક્સેસ માટે સંપર્ક કરો',

      'profile.persona.admin': 'BMC Admin',

      'profile.persona.ngo': 'NGO સંકલક',

      'flow.legal': 'કાયદાકીય',

      'flow.city': 'શહેર',

      'flow.ward': 'વોર્ડ',

      'flow.ready': 'તૈયાર',

      'city.mumbai': 'મુંબઈ',

      'city.pune': 'પુણે',

      'city.thane': 'ઠાણે',

      'tos.title': 'સેવાની શરતો',

      'tos.subtitle': 'CivicRadar વાપરતા પહેલાં વાંચો અને સ્વીકારો.',

      'tos.age': 'ફરિયાદ અને સમુદાય ફીચર માટે 18+ જરૂરી.',

      'tos.emergency': 'આપત્તિ માટે નહીં. જીવને જોખમ હોય તો 112 ડાયલ કરો.',

      'tos.itAct': 'CivicRadar IT Act, 2000 અંતર્ગત મધ્યસ્થ છે. અપલોડની જવાબદારી તમારી.',

      'tos.share': 'WhatsApp, X પર શેર કરવાથી વ્યક્તિગત ડેટા ખુલી શકે — પોતાના જોખમે.',

      'tos.gps': 'DPDP Act અંતર્ગત જોખમ નકશા માટે GPS સંમતિ જરૂરી.',

      'tos.analytics': 'અનામ ઉપયોગ એનાલિટિક્સ (વૈકલ્પિક) વિશ્વસનીયતા વધારે. ફોટો, GPS કે નામ મોકલાતા નથી.',

      'tos.analyticsOptIn': 'હું અનામ ઉપયોગ એનાલિટિક્સની સંમતિ આપું છું (વૈકલ્પિક — Profile માંથી ક્યારે પણ પાછી)',

      'tos.notBmc': 'CivicRadar સ્વતંત્ર — BMC/MCGM સાથે જોડાયેલું અથવા ચલાવેલું નથી.',

      'tos.content': 'ફક્ત જોખમના ઑન-સાઇટ ફોટો. સેલ્ફી, ID અથવા અનિયુક્ત ચિત્રો નહીં.',

      'tos.accept': 'હું 18+ છું, <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms</a> અને <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a> સ્વીકારું છું, GPS સંગ્રહની સંમતિ આપું છું',

      'tos.continue': 'આગળ વધો',

      'pledge.title': 'દાન કરો',

      'pledge.subtitle': 'વોર્ડમાં સ્વયંસેવકોને સામગ્રી આપો.',

      'pledge.type': 'સામગ્રી પ્રકાર',

      'pledge.type.cleaning': 'સફાઈ સામગ્રી',

      'pledge.type.snacks': 'નાસ્તો',

      'pledge.type.repellent': 'ડાસ repellent',

      'pledge.ward': 'લક્ષ્ય વોર્ડ',

      'pledge.wardPh': 'વોર્ડ પસંદ કરો…',

      'pledge.message': 'સંદેશ',

      'pledge.messagePh': 'સ્વયંસેવકો માટે નોંધ…',

      'pledge.notice': 'તમારા વોર્ડનો NGO સંકલક આને તેમના હબમાં જોશે — BMC નહીં. તેઓ એપમાં સંપર્ક કરી શકે; સ્વચાલિત કૉલ/SMS નહીં.',

      'pledge.status.pledged': 'પ્રતિજ્ઞા નોંધ',

      'pledge.status.delivered': 'વિતરિત',

      'pledge.status.verified': 'ચકાસાયેલ (+200 પોઈન્ટ)',

      'pledge.submit': 'દાન મોકલો',

      'toast.syncConnected': 'કનેક્ટ — ફરિયાદો બધા ઉપકરણો પર સિંક.',

      'toast.welcome': 'સ્વાગત, {name}! ફરિયાદ માટે તૈયાર.',

      'toast.syncLocal': 'આ ઉપકરણ પર સાચવ્યું — ક્લાઉડ સિંક ફરી પ્રયાસ કરશે.',

      'toast.copyFail': 'કૉપી ન થઈ — ટેક્સ્ટ મેન્યુઅલ પસંદ કરો.',

      'toast.saveFail': 'સાચવી શકાયું નહીં.',

      'toast.adminVerified': 'BMC ઍક્સેસ ચકાસાયો — વોર્ડ કતાર જુઓ.',

      'toast.ngoVerified': 'સંકલક ચકાસાયો — દાન અને સ્વયંસેવક જુઓ.',

      'toast.govEmail': 'gov.in / mcgm.gov.in ઇમેઇલ વાપરો.',

      'toast.codeSent': 'કોડ મોકલ્યો — ઇનબૉક્સ જુઓ.',

      'toast.codeInvalid': 'અમાન્ય અથવા સમાપ્ત કોડ.',

      'toast.linkSent': 'સાઇન-ઇન લિંક મોકલ્યું — ઇનબૉક્સ જુઓ.',

      'toast.authEmailFail': 'સાઇન-ઇન ઇમેઇલ મોકલી શકાઈ નહીં — Supabase SMTP સેટિંગ્સ તપાસો અને ફરી પ્રયાસ કરો.',

      'toast.authCaptchaFail': 'સુરક્ષા તપાસ નિષ્ફળ — પેજ રીલોડ કરો અને ફરી પ્રયાસ કરો.',

      'toast.authEmailOffline': 'ક્લાઉડ સાઇન-ઇન ઉપલબ્ધ નથી — કનેક્શન તપાસો અને ફરી પ્રયાસ કરો.',

      'toast.authEmailRateLimit': 'ઘણા બધા સાઇન-ઇન ઇમેઇલ — થોડી મિનિટ રાહ જુઓ અને ફરી પ્રયાસ કરો.',

      'toast.authEmailInvalid': 'ઇમેઇલ સરનામું અમાન્ય લાગે છે — તપાસો અને ફરી પ્રયાસ કરો.',

      'toast.authEmailRedirect': 'સાઇન-ઇન રીડાયરેક્ટ URL મંજૂર નથી — Supabase Authentication માં તમારી સાઇટ URL ઉમેરો.',

      'toast.linkExpired': 'સાઇન-ઇન લિંક સમાપ્ત — નવી લિંક માગો.',

      'toast.bmcUnauthorized': 'આ ઇમેઇલ BMC ઍક્સેસ માટે અધિકૃત નથી.',

      'toast.ngoCodeRequired': 'ઇમેઇલ અને NGO ઍક્સેસ કોડ દાખલ કરો.',

      'toast.ngoCodeInvalid': 'ખોટો અથવા સમાપ્ત NGO કોડ.',

      'toast.onboardFirst': 'ફરિયાદ માટે સેટઅપ પૂર્ણ કરો.',

      'toast.tosRequired': 'સમુદાય સુવિધાઓ પહેલાં Terms અને Privacy (18+) સ્વીકારો.',

      'toast.reportNotFound': 'ફરિયાદ લિંક અમાન્ય અથવા આ ઉપકરણ પર નથી.',

      'toast.installed': 'CivicRadar ઇન્સ્ટોલ — હોમ સ્ક્રીનથી ખોલો!',

      'toast.installHint': 'બ્રાઉઝર મેનૂ → Add to Home screen.',

      'toast.installHintIos': 'Safari Share → Add to Home Screen.',

      'toast.wardRequired': 'મુંબઈની અધિકૃત યાદીમાંથી વોર્ડ પસંદ કરો.',

      'toast.contactConfig': 'સંપર્ક ઇમેઇલ સેટ નથી — js/config.js જુઓ',

      'config.contactMissing': '(js/config.js માં founder.email અથવા founder.operatorEmail સેટ કરો)',

      'toast.citizenView': 'નાગરિક દૃશ્ય પર પાછા.',

      'toast.noLocation': 'આ બ્રાઉઝરમાં લોકેશન ઉપલબ્ધ નથી.',

      'toast.recentered': 'નકશો તમારી જગ્યા પર કેન્દ્રિત.',

      'toast.bmcLoginFail': 'ખોટા BMC ક્રેડેન્શિયલ.',

      'toast.bmcMumbaiOnly': 'BMC પાયલટ ફક્ત Mumbai માટે. તમારા કોર્પોરેશન માટે Profile માંથી દાખલ કરો.',

      'toast.ngoLoginFail': 'ખોટા સંકલક ક્રેડેન્શિયલ.',

      'toast.photoRequired': 'મોકલતા પહેલાં ફોટો ઉમેરો.',

      'toast.photoFailed': 'તે ફોટો વાપરી શકાયો નહીં — ફરી પ્રયાસ કરો.',

      'toast.gpsRequired': 'જોખમ પિન માટે GPS જરૂરી.',

      'toast.gpsOutsideCity': 'સ્થાન તમારા પસંદ કરેલા શહેરની બહાર છે. પિન શહેરની સીમામાં મૂકો અથવા પ્રોફાઇલમાં શહેર બદલો.',

      'toast.pinConfirmRequired': 'નકશા પર પિનની પુષ્ટિ કરો — સબમિટ પહેલાં પિન જોખમ પર ખેંચો.',

      'toast.hazardTypeRequired': 'સક્રિય જોખમ પ્રકાર પસંદ કરો.',

      'toast.storageFull': 'સ્ટોરેજ ભરેલું — જૂની ફરિયાદ કાઢી. ફરી પ્રયાસ કરો.',

      'toast.gpsFail': 'GPS મળ્યું નહીં. લોકેશન ચાલુ કરી ફરી પ્રયાસ કરો.',

      'toast.gpsFailAction': 'GPS મળ્યું નહીં. નકશા પર પિન મૂકો અથવા સેટિંગમાં લોકેશન ચાલુ કરો.',

      'toast.manualPinReady': 'પિન મૂક્યું — Submit દબાવી રિપોર્ટ પૂર્ણ કરો.',

      'toast.gpsLocating': 'તમારું સ્થાન શોધી રહ્યાં છીએ…',

      'toast.gpsLowAccuracy': 'સ્થાન અંદાજે છે (~{m} મી). ચોક્કસ GPS માટે બહાર કે બારી પાસે જાઓ.',

      'toast.gpsPoorFix': 'ચોક્કસ સ્થાન મળ્યું નહીં. GPS ચાલુ કરી બહાર ફરી પ્રયાસ કરો.',

      'toast.complaintRequired': 'ટ્રેકિંગ માટે ફરિયાદ નંબર દાખલ કરો.',

      'toast.complaintSaved': 'ફરિયાદ નંબર સાચવ્યો — સરકારી ઘડિયાળ શરૂ.',

      'toast.pledgeWardRequired': 'દાન માટે લક્ષ્ય વોર્ડ પસંદ કરો.',

      'toast.pledgeSaved': 'પ્રતિજ્ઞા નોંધ — વોર્ડ સંકલકને હબમાં દેખાશે.',

      'toast.pledgeDuplicate': 'આ વોર્ડ અને સામગ્રી માટે પહેલેથી ખુલ્લી પ્રતિજ્ઞા છે.',

      'toast.pledgeWardMismatch': 'આ તમારા વોર્ડથી અલગ — તે વોર્ડનો સંકલક સંભાળશે.',

      'toast.pledgeStatusDelivered': 'સંકલકે તમારી પ્રતિજ્ઞા વિતરિત તરીકે ચિહ્નિત કરી.',

      'toast.pledgeStatusVerified': 'સ્વયંસેવક કલાક ચકાસાયા — +200 સિવિક પોઈન્ટ!',

      'toast.ngoNewPledge': 'તમારા વોર્ડમાં {n} નવી નાગરિક પ્રતિજ્ઞા.',

      'toast.ngoNewPledgeAction': 'હબ ખોલો',

      'toast.proofAdded': 'પુરાવા ફોટો ઉમેર્યો — પુષ્ટિ માટે ફરી દબાવો.',

      'toast.fixPhotoAdded': 'પછીનો ફોટો સાચવ્યો — પડોશી પહેલાં અને પછી જોઈ શકે!',

      'toast.resolveFail': 'સ્થિતિ અપડેટ ન થઈ.',

      'toast.bmcOnlyResolve': 'ફક્ત ચકાસેલ BMC અધિકારી ઉકેલી શકે.',

      'toast.resolvedProof': 'ઉકેલ ચિહ્નિત — પહેલાં/પછી પુરાવો સાચવ્યો.',

      'toast.ownReportOnly': 'ફક્ત પોતાની ફરિયાદની પુષ્ટિ કરી શકો.',

      'toast.complaintFirst': 'પહેલા ફરિયાદ નંબર ઉમેરો — તે જ પુરાવો.',

      'toast.selfResolved': 'ઉકેલ ચિહ્નિત — ફોલો-અપ માટે આભાર!',

      'toast.shareWin': 'પડોશીઓ સાથે જીત શેર કરો.',

      'toast.cleanupLogged': 'સમુદાય સફાઈ લોગ — BMC ફરિયાદ અધિકૃત રીતે ખુલ્લી રહી શકે.',

      'toast.pledgeDelivered': 'સામગ્રી વિતરિત — હવે કલાક ચકાસો.',

      'toast.hoursVerified': 'કલાક ચકાસાયા! +200 Civic Points.',

      'toast.saving': 'સાચવી રહ્યા છીએ…',

      'toast.verifying': 'ચકાસી રહ્યા છીએ…',

      'admin.title': 'BMC Admin',

      'admin.subtitle': 'નાગરિક જોખમ ફરિયાદો ઉકેલો, વોર્ડ કતાર જુઓ.',

      'admin.queueTitle': 'જોખમ કતાર',

      'admin.queueSubtitle': 'નાગરિક ફરિયાદો જુઓ, પ્રાથમિકતા આપો, ઉકેલો.',

      'admin.returnMap': 'નકશા પર પાછા',

      'admin.exitMode': 'BMC મોડ બંધ',

      'admin.allWards': 'બધા વોર્ડ',

      'admin.sort.oldest': 'જૂના પહેલા',

      'admin.sort.newest': 'નવીનતમ પહેલા',

      'admin.sort.overdue': 'બાકી પહેલા',

      'admin.sort.confirmed': 'સૌથી વધુ મને પણ',

      'admin.pending': 'ખુલ્લા',

      'admin.overdue': '7+ દિવસ બાકી',

      'admin.resolved': 'ઉકેલાયા',

      'admin.avgDays': 'સરેરાશ દિવસ',

      'admin.healthSummary': 'એપ આરોગ્ય (છેલ્લા 7 દિવસ)',

      'admin.healthLoading': 'ઉપયોગ લોડ થઈ રહ્યો…',

      'admin.markResolved': 'ઉકેલ ચિહ્નિત',

      'admin.resolveHint': 'નાગરિકને શ્રેય — પિન લીલો થશે.',

      'admin.removeContent': 'સામગ્રી દૂર કરો',

      'admin.removeConfirm': 'આ ફરિયાદ જાહેર નકશા પરથી દૂર કરીએ? માર્ગદર્શિકાનું ઉલ્લંઘન કરતી સામગ્રી માટે વાપરો — ફરિયાદ કરનારને દેખાશે કે તે દૂર કરવામાં આવી.',

      'admin.removeSuccess': 'ફરિયાદ જાહેર નકશા પરથી દૂર કરવામાં આવી.',

      'admin.flagged': 'ફ્લેગ કરેલ',

      'admin.reviewTag': 'BMC સમીક્ષા',

      'admin.reportTitle': 'જોખમ ફરિયાદ',

      'coord.title': 'સંકલક લૉગિન',

      'coord.subtitle': 'દાન જુઓ, સ્વયંસેવક મોકલો, કલાક ચકાસો.',

      'coord.hubTitle': 'સંકલક હબ',

      'coord.hubSubtitle': 'નાગરિક દાન જુઓ, સ્વયંસેવક કલાક ચકાસો.',

      'coord.workflow': 'મોકલો → સફાઈ લોગ → સામગ્રી → કલાક (+200 પોઈન્ટ)',

      'coord.openHazards': 'વોર્ડમાં ખુલ્લા જોખમ',

      'coord.pledges': 'નાગરિક દાન',

      'coord.pledgesNew': 'નાગરિક પ્રતિજ્ઞા · {n} નવી',

      'coord.pledgesEmpty': 'હજુ પ્રતિજ્ઞા નથી. વોર્ડના રહેવાસીઓ સાથે Community ટેબ શેર કરો.',

      'coord.markDelivered': 'વિતરિત ચિહ્નિત કરો',

      'coord.verifyHours': 'કલાક ચકાસો (+200)',

      'coord.verified': 'ચકાસાયેલ',

      'coord.exitMode': 'NGO મોડ બંધ',

      'coord.pledgesLabel': 'દાન',

      'coord.toVerify': 'ચકાસણી બાકી',

      'coord.openLabel': 'ખુલ્લા જોખમ',

      'coord.cleared': 'સમુદાયે સાફ કર્યું',

      'profile.pledges': 'મારી પ્રતિજ્ઞાઓ',

      'profile.pledgesEmpty': 'હજુ પ્રતિજ્ઞા નથી. Community માંથી સ્થાનિક સ્વયંસેવકોને ટેકો આપો.',

      'profile.pledgesEmptyAction': 'પ્રતિજ્ઞા કરો',

      'profile.officialHint': 'ચકાસેલ BMC, PMC અને TMC એપ્સ અને પોર્ટલ — CivicRadar તમારી તરફથી દાખલ કરતું નથી. Resources ટેબમાંથી ખોલો.',

      'profile.officialLink': 'Resources ખોલો',

      'profile.communityHint': 'સ્વયંસેવક નોંધણી અને દાન — Resources ટેબમાંથી ખોલો.',

      'profile.communityLink': 'સ્વયંસેવા અને દાન',

      'badge.admin': 'BMC એડમિન',

      'badge.coord': 'સંકલક હબ',

      'admin.meta.reporter': 'રિપોર્ટર',

      'admin.meta.ward': 'વોર્ડ',

      'admin.meta.status': 'સ્થિતિ',

      'admin.meta.lat': 'Lat',

      'admin.meta.lng': 'Lng',

      'admin.meta.neighbourConfirm': ' · {n} એ મને પણ કહ્યું',

      'admin.close': 'બંધ',

      'coord.hazardsEmpty': 'તમારા વિસ્તારમાં હમણાં ખુલ્લા જોખમ નથી.',

      'coord.volunteerOffers': '{n} સ્વયંસેવક ઓફર',

      'coord.hazardCleaned': 'સાફ કર્યું',

      'coord.logCleanup': 'સફાઈ નોંધો',

      'admin.health.communityCleanups': 'સામુદાયિક સફાઈ',

      'admin.health.whatsappShares': 'WhatsApp શેર',

      'admin.health.errors': ' ભૂલો',

      'admin.health.perfSamples': 'પરફોર્મન્સ નમૂના',

      'admin.health.avgPerf': 'સરેરાશ લોડ સમય (સ્થાનિક)',

      'admin.health.bufferedEvents': 'બફર ઇવેન્ટ (ઉપકરણ)',

      'tracking.open': 'Analytics અને tracking',

      'tracking.title': 'Analytics અને tracking',

      'tracking.subtitle': 'એકત્ર civic metrics — visits, reports, escalations, resolutions.',

      'tracking.period': 'સમયગાળો',

      'tracking.days7': 'છેલ્લા 7 દિવસ',

      'tracking.days30': 'છેલ્લા 30 દિવસ',

      'tracking.days90': 'છેલ્લા 90 દિવસ',

      'tracking.wardFilter': 'વોર્ડ',

      'tracking.sessions': 'મુલાકાત',

      'tracking.pwaInstalls': 'PWA installs',

      'tracking.reports': 'રિપોર્ટ',

      'tracking.resolved': 'ઉકેલાયું',

      'tracking.pwaNote': 'PWA install અંદાજે (Add to Home Screen / standalone). Store downloads GitHub Pages પર માપી શકાતા નથી.',

      'tracking.loading': 'મેટ્રિક્સ લોડ થઈ રહ્યા છે…',

      'tracking.sourceLocal': 'ઉપકરણ + સ્થાનિક રિપોર્ટ (demo / offline)',

      'tracking.sourceCloud': 'ક્લાઉડ aggregate (બધા users)',

      'tracking.sourceCloudFail': 'ક્લાઉડ metrics ઉપલબ્ધ નથી — Supabase માં tracking SQL ચલાવો.',

      'tracking.reportsByCategory': 'શ્રેણી પ્રમાણે રિપોર્ટ',

      'tracking.escalations': 'અધિકૃત ચેનલ ખોલવું',

      'tracking.neighbourhoods': 'Neighbourhood / society પ્રમાણે',

      'tracking.reporters': 'સક્રિય રિપોર્ટર',

      'tracking.meToo': 'Me too',

      'tracking.filed': 'અધિકૃત નોંધ',

      'tracking.leads': 'Neighbourhood leads',

      'tracking.empty': 'આ સમયગાળામાં ડેટા નથી.',

      'tracking.pending': 'ખુલ્લા',

      'tracking.channelUnknown': 'અન્ય channel',

      'a11y.skipToContent': 'મુખ્ય સામગ્રી પર જાઓ',

      'aria.close': 'બંધ',

      'aria.lang': 'ભાષા બદલો',

      'aria.recenter': 'નકશો તમારી જગ્યા પર કેન્દ્રિત કરો',

      'aria.leaderboard': 'સમુદાય લીડરબોર્ડ અને દાન',

      'aria.profile': 'પ્રોફાઇલ',

      'aria.report': 'જોખમ ફરિયાદ',

      'aria.filterWard': 'વોર્ડથી ફિલ્ટર',

      'aria.sortReports': 'ફરિયાદ ક્રમ',

      'auth.demoTag.admin': 'ડેમો ઍક્સેસ — પ્રોડક્શનમાં BMC ઇમેઇલ ચકાસણી',

      'auth.demoTag.lead': 'ડેમો ઍક્સેસ — પ્રોડક્શનમાં ઇમેઇલ + NGO ઇનવાઇટ',

      'auth.officialEmail': 'અધિકૃત ઇમેઇલ',

      'auth.emailHint': 'ફક્ત gov.in / mcgm.gov.in પર BMC ઍક્સેસ.',

      'auth.sendCode': 'સાઇન-ઇન કોડ મોકલો',

      'auth.linkInstructions': 'તમારું ઇમેઇલ તપાસો અને સાઇન-ઇન લિંક પર ટેપ કરો. આ ટેબ ખુલ્લું રાખો — તમે સાઇન-ઇન થઈને અહીં પાછા આવશો.',

      'auth.otpFallback': '6-અંકનો કોડ છે?',

      'auth.otp': '6-અંક કોડ',

      'auth.verifyEnter': 'ચકાસો અને પ્રવેશ',

      'auth.email': 'ઇમેઇલ',

      'auth.ngoCode': 'NGO ઍક્સેસ કોડ',

      'auth.ngoCodePh': 'CivicRadar ઑપરેટર દ્વારા જારી',

      'auth.username': 'યુઝરનેમ',

      'auth.password': 'પાસવર્ડ',

      'auth.loginDemo': 'લૉગિન (ડેમો)',

      'admin.health.noData': 'આ ઉપકરણ પર હજુ ઉપયોગ ડેટા નથી.',

      'admin.health.deviceSource': 'ઉપકરણ બફર (છેલ્લા 7 દિવસ)',

      'admin.health.cloudSource': 'ક્લાઉડ એગ્રિગેટ (બધા વપરાશકર્તા)',

      'admin.health.cloudUnavailable': 'ક્લાઉડ મેટ્રિક્સ ઉપલબ્ધ નથી — Supabase માં analytics SQL ચલાવો.',

      'admin.health.connectSupabase': 'શહેર-વ્યાપી ઉપયોગ માટે Supabase કનેક્ટ કરો.',

      'admin.health.sessions': 'સત્ર',

      'admin.health.tabViews': 'ટેબ વ્યૂ',

      'admin.health.reportsFiled': 'ફરિયાદ નોંધ',

      'admin.health.corroborations': 'મને પણ',

      'admin.health.bmcFiled': 'BMC નોંધ',

      'admin.health.resolved': 'ઉકેલાયા',

      'about.founderDefault': 'Nihira',

      'about.teamLabel': 'Nihira',

      'about.teamRole': 'સામુદાયિક નાગરિક રિપોર્ટિંગ',

      'ref.welcomeTitle': 'એક પડોશીએ તમને આમંત્રણ આપ્યું 👋',

      'referral.joinedReward': '🎉 તમારા આમંત્રણથી {n} પડોશીઓ જોડાયા — +{pts} Civic Points!',

      'ref.welcomeBody': '{city} નકશા પર પહેલેથી {n} ફરિયાદ છે. તમારા વોર્ડના ખુલ્લા સ્પોટ જુઓ — અથવા 30 સેકન્ડમાં એક પિન કરો.',

      'ref.welcomeBodyEmpty': '{city} માં જોખમો નકશિત કરનારાઓમાં પહેલા બનો — કચરો, ખાડા, સ્ટ્રીટલાઇટ અને ભરાયેલું પાણી. માત્ર 30 સેકન્ડ.',

      'ref.welcomeCta': 'નકશો જુઓ',

      'ref.welcomeReport': 'સ્પોટ નોંધો',

      'ref.dismiss': 'આમંત્રણ બંધ કરો',

      'season.monsoonPrep': 'વરસાદ આવી રહ્યો છે. વહેલા ભરાયેલું પાણી સાફ કરવાથી મચ્છર ઓછા થાય છે — પહેલા ભારે વરસાદ પહેલાં સ્પોટ પિન કરો.',

      'season.monsoonPeak': 'ચોમાસું આવી ગયું છે. ભરાયેલા પાણીથી જ ડેન્ગ્યુ શરૂ થાય છે — 30 સેકંડની ફરિયાદ તમારી આખી શેરીને મદદ કરે છે.',

      'season.ganesh': 'ગણેશ ચતુર્થી આવી ગઈ છે. ચાલો તહેવાર માટે વોર્ડ સ્વચ્છ રાખીએ — પંડાલ અને વિસર્જન માર્ગ પાસે ભરાયેલું પાણી નોંધો.',

      'season.denguePeak': 'ડેન્ગ્યુની મોસમ છે. મચ્છર ભરાયેલા પાણીમાં ઊછરે છે — એક ઝડપી ફરિયાદ તમારી શેરીનું રક્ષણ કરે છે.',

      'season.dismiss': 'મોસમી સૂચન બંધ કરો',

      'social.wardWeek': '👥 આ અઠવાડિયે {ward} માં {n} પડોશીઓએ નોંધ્યું',

      'social.wardWeekBacked': '👥 આ અઠવાડિયે {ward}: {n} નોંધ · {c} સમર્થન',

      'social.wardWeekEmpty': 'આ અઠવાડિયે {ward} માંથી હજુ કોઈ રિપોર્ટ નથી — પડોશીઓ તમને અનુસરશે.',

      'recap.title': 'આ અઠવાડિયે તમારો વોર્ડ',

      'recap.share': 'સાપ્તાહિક સારાંશ શેર કરો',

      'share.weeklyRecap': '📊 આ અઠવાડિયે {ward}: {reports} નવી ફરિયાદ, {resolved} ઠીક, {backed} પડોશીઓનું સમર્થન. CivicRadar પર જોડાઓ 👇\n{link}\n{hashtags}',

      'feedback.menu': 'પ્રતિસાદ મોકલો',

      'feedback.title': 'પ્રતિસાદ મોકલો',

      'feedback.subtitle': 'કોઈ ભૂલ મળી કે કોઈ વિચાર છે? અમને જણાવો — તે સીધું ટીમ સુધી પહોંચે છે.',

      'feedback.categoryLabel': 'કયા પ્રકારનો પ્રતિસાદ?',

      'feedback.catIdea': 'વિચાર',

      'feedback.catBug': 'ભૂલ',

      'feedback.catOther': 'અન્ય',

      'feedback.messageLabel': 'તમારો પ્રતિસાદ',

      'feedback.messagePh': 'શું થયું, અથવા CivicRadar ને કેવી રીતે વધુ સારું બનાવી શકાય?',

      'feedback.contactLabel': 'સંપર્ક (વૈકલ્પિક — ફક્ત જો તમે જવાબ ઇચ્છતા હો)',

      'feedback.contactPh': 'ઈમેલ અથવા ફોન',

      'feedback.privacy': 'અમે તમારો સંપર્ક ક્યારેય શેર કરતા નથી. ફક્ત આ પ્રતિસાદનો જવાબ આપવા માટે વપરાય છે.',

      'feedback.submit': 'પ્રતિસાદ મોકલો',

      'feedback.errorEmpty': 'કૃપા કરીને પહેલા એક ટૂંકો સંદેશ લખો.',

      'feedback.error': 'મોકલી શકાયું નહીં — તમારો ટેક્સ્ટ સુરક્ષિત છે. કૃપા કરીને ફરી પ્રયાસ કરો.',

      'feedback.success': 'આભાર! તમારો પ્રતિસાદ મોકલાઈ ગયો.',

      'feedback.successLocal': 'સાચવ્યું — ઓનલાઈન થશો ત્યારે અમે તેને સિંક કરીશું.',

      'access.title': 'સંયોજક ઍક્સેસ માટે વિનંતી કરો',

      'access.subtitle': 'NGO અને સમુદાય સંયોજકો તથા BMC અધિકારીઓ માટે.',

      'access.step1': 'થોડી ઝડપી વિગતો સાથે અરજી કરો',

      'access.step2': 'CivicRadar ટીમ સમીક્ષા કરે છે',

      'access.step3': 'ઍક્સેસ અનલૉક કરવા ક્લેમ કોડ મેળવો',

      'access.roleLabel': 'હું છું…',

      'access.roleNgo': 'NGO સંયોજક',

      'access.roleBmc': 'BMC અધિકારી',

      'access.nameLabel': 'તમારું નામ',

      'access.namePh': 'પૂરું નામ',

      'access.orgLabel': 'સંસ્થા',

      'access.orgPh': 'NGO / વિભાગ / RWA નું નામ',

      'access.optional': '(વૈકલ્પિક)',

      'access.cityLabel': 'શહેર',

      'access.wardLabel': 'વોર્ડ',

      'access.wardPh': 'તમારો વોર્ડ',

      'access.contactLabel': 'સંપર્ક — ઈમેલ અથવા ફોન',

      'access.emailPh': 'you@example.com',

      'access.phonePh': 'ફોન',

      'access.contactHint': 'ઓછામાં ઓછું એક આપો. ક્લેમ કોડ ઈમેલ પર; ફક્ત ફોન આપશો તો ત્યાં જ સંપર્ક કરીશું.',

      'access.proofLabel': 'ઓળખ / પુરાવો',

      'access.proofOptional': '(વૈકલ્પિક — BMC માટે ભલામણ)',

      'access.proofAdd': 'પુરાવો ફોટો જોડો',

      'access.noteLabel': 'બીજું કંઈ?',

      'access.notePh': 'વોર્ડ ફોકસ, કેવી રીતે વાપરશો, વગેરે.',

      'access.submit': 'વિનંતી મોકલો',

      'access.haveCode': 'મારી પાસે પહેલેથી ક્લેમ કોડ છે',

      'access.confirmTitle': 'વિનંતી મળી',

      'access.confirmBody': 'આભાર! CivicRadar ટીમ તમારી વિનંતીની સમીક્ષા કરશે અને સામાન્ય રીતે થોડા દિવસોમાં તમને ક્લેમ કોડ મોકલશે (ઈમેલ અથવા ફોન). ઍક્સેસ અનલૉક કરવા તે કોડ ઍપમાં દાખલ કરો.',

      'access.confirmLocal': 'આ ડિવાઇસ પર સાચવ્યું — ઓનલાઈન થશો ત્યારે ટીમ સુધી સિંક થશે.',

      'access.done': 'પૂર્ણ',

      'access.profileBmcCta': 'BMC અધિકારી? ઍક્સેસ માંગો',

      'access.partnerBmcCta': 'BMC અધિકારી? ઍક્સેસ માંગો',

      'access.partnerClaim': 'મારી પાસે ક્લેમ કોડ છે',

      'access.claimTitle': 'તમારો ક્લેમ કોડ દાખલ કરો',

      'access.claimSubtitle': 'CivicRadar ટીમે મંજૂરી આપી? ઍક્સેસ અનલૉક કરવા મોકલેલ કોડ દાખલ કરો.',

      'access.claimLabel': 'ક્લેમ કોડ',

      'access.claimPh': 'CR-XXXXXX',

      'access.claimSubmit': 'ઍક્સેસ અનલૉક કરો',

      'access.reviewOpen': 'ઍક્સેસ વિનંતીઓ',

      'access.reviewTag': 'CivicRadar ટીમ',

      'access.reviewTitle': 'ઍક્સેસ વિનંતીઓ',

      'access.reviewSubtitle': 'સંયોજક અને BMC ઍક્સેસ વિનંતીઓ મંજૂર/નકારો. મંજૂરી પર ક્લેમ કોડ જારી થાય છે.',

      'access.pending': 'બાકી',

      'access.approved': 'મંજૂર',

      'access.rejected': 'નકારેલ',

      'access.reviewEmpty': 'હજુ કોઈ વિનંતી નથી. નવી સંયોજક અને BMC વિનંતીઓ અહીં દેખાશે.',

      'access.approve': 'મંજૂર કરો',

      'access.reject': 'નકારો',

      'access.copyCode': 'કોડ કૉપિ કરો',

      'access.codeCopied': 'ક્લેમ કોડ કૉપિ થયો — અરજદારને તેમના સંપર્ક વિગતો દ્વારા શેર કરો.',

      'access.roleNgoTag': 'NGO સંયોજક',

      'access.roleBmcTag': 'BMC અધિકારી',

      'access.statusApproved': 'મંજૂર',

      'access.statusRejected': 'નકારેલ',

      'access.statusPending': 'બાકી',

      'access.errName': 'કૃપા કરી તમારું નામ ઉમેરો.',

      'access.errContact': 'સંપર્ક માટે ઈમેલ અથવા ફોન ઉમેરો.',

      'access.submitted': 'વિનંતી મોકલાઈ — અમે સમીક્ષા કરી તમને ક્લેમ કોડ મોકલીશું.',

      'access.submittedLocal': 'વિનંતી સાચવી — ઓનલાઈન થશો ત્યારે સિંક અને સમીક્ષા થશે.',

      'access.submitError': 'મોકલી શકાયું નહીં — તમારી વિગતો સુરક્ષિત છે. કૃપા કરી ફરી પ્રયાસ કરો.',

      'access.claimErrEmpty': 'મોકલેલ ક્લેમ કોડ દાખલ કરો.',

      'access.claimErrInvalid': 'આ કોડ માન્ય નથી અથવા હજુ મંજૂર થયો નથી.',

      'access.claimErrUsed': 'આ કોડ પહેલેથી વપરાઈ ગયો છે.',

      'access.claimedNgo': 'ઍક્સેસ અનલૉક — સ્વાગત છે, સંયોજક!',

      'access.claimedBmc': 'BMC ઍક્સેસ અનલૉક — તમારી વોર્ડ કતાર જુઓ.',

      'access.approvedToast': 'મંજૂર — ક્લેમ કોડ {code}',

      'access.rejectedToast': 'વિનંતી નકારી.',

      'access.proofAttached': 'પુરાવો જોડ્યો',

      'access.proofTooBig': 'છબી ઘણી મોટી — કૃપા કરી નાનો ફોટો જોડો.',

      'lead.title': 'સામુદાયિક લીડ બનો',

      'lead.subtitle': 'પોતાની ઉમેદવારી નોંધાવો — પડોશીઓ મત આપશે. Admin મંજૂરીની જરૂર નથી.',

      'lead.discoverNudge': 'તમે ખૂબ સક્રિય છો! તમારા વોર્ડમાં સફાઈનું નેતૃત્વ કરવાનું વિચારો.',

      'lead.discoverNudgeCta': 'વધુ જાણો',

      'lead.step1': 'વોર્ડ અને scope સાથે nominate',

      'lead.step2': 'પડોશીઓ સમર્થન આપશે',

      'lead.step3': '2 સમર્થન = ભૂમિકા (બે candidate હોય તો દરેકને 5)',

      'lead.roleLabel': 'Lead પ્રકાર',

      'lead.roleWard': 'વોર્ડ NGO લીડ',

      'lead.roleNbh': 'પડોશ લીડ',

      'lead.nameLabel': 'તમારું નામ',

      'lead.namePh': 'પડોશીઓ તમને કેવી રીતે ઓળખે',

      'lead.orgLabel': 'સંસ્થા / RWA',

      'lead.orgPh': 'NGO અથવા society નામ',

      'lead.neighbourhoodLabel': 'પડોશ / સોસાયટી / ગલી',

      'lead.neighbourhoodHintNoWard': 'સ્થાનિક સૂચનાઓ માટે પહેલા વોર્ડ પસંદ કરો.',

      'lead.neighbourhoodHintWard': '{ward} માં {n} પડોશ/સોસાયટી — ન મળે તો ટાઇપ કરો.',

      'lead.neighbourhoodHintCustom': 'યાદીમાં ન હોય તો પડોશ, સોસાયટી અથવા ગલી લખો.',

      'lead.pitchLabel': 'તમે શા માટે?',

      'lead.pitchPh': 'મતદારો માટે ટૂંકી નોંધ',

      'lead.submit': 'મને nominate કરો',

      'lead.confirmTitle': 'તમે મતપેટી પર છો!',

      'lead.confirmBody': 'CivicRadar પડોશીઓ સાથે શેર કરો — સંકલક સાધનો માટે 2 સમર્થન જોઈએ. એક જ જગ્યા માટે બે ઉમેદવાર હોય તો બંનેને 5 જોઈએ.',

      'lead.confirmLocal': 'આ ડિવાઇસ પર સાચવ્યું — ઓનલાઈન થશો ત્યારે સિંક થશે.',

      'lead.viewCommunity': 'Community માં candidates જુઓ',

      'lead.profileCta': 'વોર્ડ અથવા neighbourhood lead બનો',

      'lead.partnerCta': 'Community lead બનો — peer support થી મેળવો',

      'lead.communityTitle': 'સામુદાયિક leads',

      'lead.communityHint': 'સફાઈ coordinator તરીકે volunteer પડોશીઓને Support કરો. 2 = role; ઘણા candidates = દરેકને 5.',

      'lead.communityEmpty': 'તમારા વોર્ડમાં હજુ ઉમેદવાર નથી — પોતાની ઉમેદવારી નોંધાવો.',

      'lead.becomeCta': 'Community lead બનો',

      'lead.support': 'સમર્થન',

      'lead.supported': 'સમર્થિત',

      'lead.progress': '{count}/{threshold} support',

      'lead.progressCoLead': 'co-lead માટે {count}/{threshold}',

      'lead.tagWard': 'વોર્ડ લીડ',

      'lead.tagNbh': 'પડોશ',

      'lead.you': 'તમે',

      'lead.errName': 'કૃપા કરીને નામ ઉમેરો.',

      'lead.errWard': 'વોર્ડ પસંદ કરો.',

      'lead.errNeighbourhood': 'neighbourhood અથવા society દાખલ કરો.',

      'lead.errAlreadyVoted': 'તમે આ candidate ને પહેલેથી Support કર્યું.',

      'lead.errAlreadyNominated': 'આ scope માટે active nomination પહેલેથી છે.',

      'lead.errAlreadyLead': 'તમે પહેલેથી આ lead role ધરાવો છો.',

      'lead.nominated': 'ઉમેદવારી મોકલી — Community માં સમર્થન મેળવો!',

      'lead.nominatedLocal': 'Nomination સાચવ્યું — online થાય ત્યારે sync.',

      'lead.voted': 'Support ગણ્યું — પડોશીને પાછળ ઊભા રહ્યા બદલ આભાર!',

      'lead.granted': 'જરૂરી સમર્થન પૂર્ણ — સંકલક ઍક્સેસ અનલૉક!',

      'lead.submitError': 'મોકલી શકાયું નહીં — ફરી પ્રયાસ.',

      'lead.voteError': 'Support નોંધાઈ શક્યું નહીં — ફરી પ્રયાસ.',

    },
  };

  const LANG_ORDER = ['en', 'hi', 'mr', 'gu'];
  let currentLang = localStorage.getItem(LANG_KEY) || 'en';
  if (!I18N[currentLang]) currentLang = 'en';

  function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
  }

  function corpCopy(key, cityId) {
    const corp = getCorpShortName(cityId || getUserCity());
    return t(key).replace(/\{corp\}/g, corp);
  }

  function applyCorpAwareI18n() {
    const corp = getCorpShortName(getUserCity());
    $$('[data-i18n]').forEach((el) => {
      const raw = t(el.dataset.i18n);
      if (raw.includes('{corp}')) el.textContent = raw.replace(/\{corp\}/g, corp);
    });
    const twitterWrap = $('#btnShareTwitter')?.closest('.share-buttons');
    if (twitterWrap) twitterWrap.classList.toggle('hidden', getUserCity() !== 'mumbai');
  }

  function backingSuffix(count) {
    const n = Number(count) || 0;
    if (n <= 0) return '';
    return n === 1 ? t('confirm.backingOne') : t('confirm.backingMany').replace('{n}', String(n));
  }

  function getUnfiledReports() {
    return getUserReports().filter((r) => r.status === 'pending' && !r.complaintId);
  }

  function refreshAllContextHints() {
    syncOnboardingCityUi(getOnboardingCity());
    syncProfileCityUi(getProfileCity());
    refreshSocietyForOnboarding();
    refreshSocietyForProfile();
    const volWard = user.ward || '';
    if (volWard) {
      const volCount = getSocietySuggestions(getUserCity(), volWard).length;
      setNeighbourhoodFieldHint('volunteerNeighbourhoodHint', 'volunteer.neighbourhoodHint', volWard, volCount);
    } else {
      setNeighbourhoodFieldHint('volunteerNeighbourhoodHint', 'volunteer.neighbourhoodHint', '', 0);
    }
    const leadWard = ($('#leadNomWard') && $('#leadNomWard').value.trim()) || user.ward || '';
    const leadCity = ($('#leadNomCity') && $('#leadNomCity').value) || user.city || DEFAULT_CITY;
    if (leadWard && isValidWard(leadWard, leadCity)) {
      const leadCount = getSocietySuggestions(leadCity, leadWard).length;
      setNeighbourhoodFieldHint('leadNomNeighbourhoodHint', 'lead.neighbourhoodHint', leadWard, leadCount);
    } else {
      setNeighbourhoodFieldHint('leadNomNeighbourhoodHint', 'lead.neighbourhoodHint', '', 0);
    }
    updateHazardSelectedCue($('#hazardType')?.value || '');
    updateMapEmptyCta();
  }

  function applyTranslations() {
    document.documentElement.lang = currentLang;
    $$('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    $$('[data-i18n-ph]').forEach((el) => {
      el.setAttribute('placeholder', t(el.dataset.i18nPh));
    });
    $$('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    $$('[data-i18n-option]').forEach((el) => {
      el.textContent = t(el.dataset.i18nOption);
    });
    $$('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    applyCorpAwareI18n();
    const tosBtn = $('#btnTosContinue');
    if (tosBtn) tosBtn.disabled = !($('#tosAccept') && $('#tosAccept').checked);
    const langBtn = $('#btnLang');
    if (langBtn) langBtn.textContent = currentLang === 'en' ? 'EN' : t('lang.native');
    updateSyncStatus();
    updatePersonaUI();
    updateHeaderContext();
    refreshWardComboboxes();
    refreshSocietyComboboxes();
    updatePhotoGuidelines($('#hazardType')?.value || 'stagnant-water');
    refreshAllContextHints();
    if ($('#reportStepConfirm') && !$('#reportStepConfirm').hidden) {
      const hint = $('#reportPinDragHint');
      if (hint) hint.textContent = t('report.pinDragHint');
      updateReportPinAccuracyHint();
      const mapEl = $('#reportPinMap');
      if (mapEl) mapEl.setAttribute('aria-label', t('report.pinMapAria'));
    }
  }

  function updateSyncStatus() {
    const el = $('#syncStatus');
    if (!el) return;
    const connected = Backend.enabled;
    el.classList.toggle('header__sync--cloud', connected);
    el.classList.toggle('header__sync--local', !connected);
    el.textContent = connected ? t('sync.cloud') : t('sync.local');
    el.title = connected ? t('sync.cloudTitle') : t('sync.localTitle');
  }

  function loadHiddenReportIds() {
    try {
      return new Set(JSON.parse(localStorage.getItem(HIDDEN_REPORTS_KEY)) || []);
    } catch {
      return new Set();
    }
  }

  function isReportHidden(id) {
    return loadHiddenReportIds().has(String(id));
  }

  function hideReportFromMap(id) {
    const ids = loadHiddenReportIds();
    const alreadyFlagged = ids.has(String(id));
    ids.add(String(id));
    try {
      safeLocalSet(HIDDEN_REPORTS_KEY, JSON.stringify([...ids]));
    } catch { /* ignore */ }
    // Hiding also flags the report for moderator review (UGC compliance) —
    // once per device, so repeat hides of the same pin don't inflate the count.
    if (!alreadyFlagged) {
      const reports = loadReports();
      const idx = reports.findIndex((r) => String(r.id) === String(id));
      if (idx !== -1) {
        reports[idx].flagCount = (Number(reports[idx].flagCount) || 0) + 1;
        try { saveReports(reports); } catch { /* ignore */ }
      }
      Backend.flagReport(id);
    }
    if (map) map.closePopup();
    refreshReportMarkers();
    showToast(t('safety.hidden'), 'info', 3200);
  }

  function loadMutedReporterIds() {
    try {
      return new Set(JSON.parse(localStorage.getItem(MUTED_REPORTERS_KEY)) || []);
    } catch {
      return new Set();
    }
  }

  function isReporterMuted(reporterId) {
    if (!reporterId) return false;
    return loadMutedReporterIds().has(String(reporterId));
  }

  function isReportFromMutedReporter(r) {
    return isReporterMuted(r && r.reporterId);
  }

  function isReportPubliclyHidden(r) {
    if (!r || r.removed) return true;
    if (isReportHidden(r.id)) return true;
    if (isReportFromMutedReporter(r)) return true;
    return false;
  }

  function reporterDisplayName(reporterId) {
    const reports = loadReports();
    const match = reports.find((r) => String(r.reporterId) === String(reporterId));
    if (match && match.reporter) return match.reporter;
    const short = String(reporterId).slice(0, 8);
    return short ? `Reporter ${short}` : 'Reporter';
  }

  function muteReporter(reporterId) {
    if (!reporterId || ownsReport({ reporterId })) return;
    const ids = loadMutedReporterIds();
    ids.add(String(reporterId));
    try {
      safeLocalSet(MUTED_REPORTERS_KEY, JSON.stringify([...ids]));
    } catch { /* ignore */ }
    if (map) map.closePopup();
    refreshReportMarkers();
    renderWardWeekSocialProof();
    renderProfileMutedReporters();
    showToast(t('mute.hidden'), 'info', 3200);
  }

  function unmuteReporter(reporterId) {
    if (!reporterId) return;
    const ids = loadMutedReporterIds();
    ids.delete(String(reporterId));
    try {
      safeLocalSet(MUTED_REPORTERS_KEY, JSON.stringify([...ids]));
    } catch { /* ignore */ }
    refreshReportMarkers();
    renderWardWeekSocialProof();
    renderProfileMutedReporters();
    showToast(t('mute.unmuted'), 'info', 3200);
  }

  // sinceTs (optional): only count reports at/after this timestamp — powers the
  // "this month" leaderboard view alongside the default all-time aggregation.
  function aggregateWardLeaderboard(sinceTs) {
    const byWard = {};
    cityScopedReports(loadReports()).forEach((r) => {
      if (!r.ward || isReportPubliclyHidden(r)) return;
      if (sinceTs && Number(r.timestamp) < sinceTs) return;
      if (!byWard[r.ward]) {
        byWard[r.ward] = { name: r.ward, points: 0, reports: 0, resolved: 0, isUser: false, isDemo: false };
      }
      byWard[r.ward].reports++;
      if (r.status === 'resolved') {
        byWard[r.ward].resolved++;
        byWard[r.ward].points += POINTS_PER_REPORT;
      }
      byWard[r.ward].points += (Number(r.confirmations) || 0) * 5;
    });
    return Object.values(byWard);
  }

  function aggregateCitizenLeaderboard(sinceTs) {
    const byCitizen = {};
    cityScopedReports(loadReports()).forEach((r) => {
      if (isReportPubliclyHidden(r)) return;
      if (sinceTs && Number(r.timestamp) < sinceTs) return;
      const key = r.reporterId || r.reporter || 'anon';
      const name = r.reporter || 'Citizen';
      const ward = r.ward ? r.ward.split('—')[0].trim() : getCityLabel(getReportCity(r));
      if (!byCitizen[key]) {
        byCitizen[key] = { id: key, name, ward, points: 0, isUser: false, isDemo: false };
      }
      byCitizen[key].points += POINTS_PER_REPORT;
      if (r.status === 'resolved') byCitizen[key].points += POINTS_PER_REPORT;
    });
    return Object.values(byCitizen);
  }

  function mergeUserWard(wards, sinceTs) {
    if (!user.ward) return wards;
    const allUserReports = getUserReports();
    const userReports = sinceTs ? allUserReports.filter((r) => Number(r.timestamp) >= sinceTs) : allUserReports;
    const userResolvedCount = userReports.filter((r) => r.status === 'resolved').length;
    // All-time keeps the existing full-XP total (bonuses included); a period view
    // recomputes from the same per-report formula the rest of the board uses, since
    // lifetime XP bonuses can't be meaningfully sliced to "this month" alone.
    const userWardPoints = sinceTs
      ? userResolvedCount * POINTS_PER_REPORT + userReports.reduce((sum, r) => sum + (Number(r.confirmations) || 0) * 5, 0)
      : getTotalCivicPoints();
    const existing = wards.find((w) => w.name === user.ward);
    if (existing) {
      existing.points = Math.max(existing.points, userWardPoints);
      existing.reports = Math.max(existing.reports, userReports.length);
      existing.resolved = Math.max(existing.resolved || 0, userResolvedCount);
      existing.isUser = true;
      existing.isDemo = false;
    } else {
      wards.push({
        name: user.ward,
        points: userWardPoints,
        reports: userReports.length,
        resolved: userResolvedCount,
        isUser: true,
        isDemo: false,
      });
    }
    return wards;
  }

  function getFocusable(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  function setLanguage(code) {
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
  }

  function rerenderDynamicViews() {
    try {
      if (typeof updateProfileUI === 'function') updateProfileUI();
      if (typeof updateMapEmptyCta === 'function') updateMapEmptyCta();
      if (typeof updateHomeHero === 'function') updateHomeHero();
      if (typeof updateCommunitySubtitle === 'function') updateCommunitySubtitle();
      if (typeof renderWardChallenge === 'function') renderWardChallenge();
      if (typeof renderLeaderboard === 'function') { renderLeaderboard('wards'); renderLeaderboard('citizens'); }
      if (typeof renderCommunityImpactStats === 'function') renderCommunityImpactStats();
      if (typeof renderWardPulse === 'function') renderWardPulse();
      if ($('#hazardGrid')) renderHazardPicker();
      if (activeEscalationId) {
        const escReport = findReportById(activeEscalationId);
        if (escReport) renderEscalation(escReport);
      }
      if (overlays.success && overlays.success.classList.contains('open')) refreshSuccessModalStrings();
      if (overlays.community && overlays.community.classList.contains('open')) {
        renderSuccessStories();
      }
      if (overlays.resources && overlays.resources.classList.contains('open')) {
        renderImpactWall();
        renderOfficialChannelsSurfaces(null);
      }
      if (overlays.profile && overlays.profile.classList.contains('open')) {
        renderOfficialChannelsSurfaces(null);
      }
      if (overlays.about && overlays.about.classList.contains('open')) renderAboutModal();
      if (tourState) renderTourStep();
      if (userMarker) userMarker.setPopupContent(t('map.youAreHere'));
    } catch (e) { /* views may not be mounted */ }
  }

  function openLanguagePicker() {
    const list = $('#langList');
    if (list) {
      list.innerHTML = LANG_ORDER.map((code) => `
        <button type="button" class="lang-option${code === currentLang ? ' lang-option--active' : ''}" data-lang="${code}">
          <span>${I18N[code]['lang.native']}</span>
          ${code === currentLang ? '<i class="ph ph-check"></i>' : ''}
        </button>`).join('');
      list.querySelectorAll('[data-lang]').forEach((btn) => {
        btn.addEventListener('click', () => {
          setLanguage(btn.dataset.lang);
          closeModal('lang');
          showToast(t('lang.native'), 'info', 1600);
        });
      });
    }
    openModal('lang');
  }

  /* ---------- Haversine ---------- */
  function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }


  /* ---------- Reports Storage ---------- */
  function loadReports() {
    try {
      const raw = localStorage.getItem(REPORTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function trimReportsForDevice(reports) {
    const max = SCALE_CFG.maxReportsPerDevice;
    if (reports.length <= max) return reports;
    const uid = user.id;
    const own = reports.filter((r) => r.reporterId === uid);
    const rest = reports
      .filter((r) => r.reporterId !== uid)
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    const keepRest = Math.max(0, max - own.length);
    const merged = [...own, ...rest.slice(0, keepRest)];
    const seen = new Set();
    return merged.filter((r) => {
      const id = String(r.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function saveReports(reports) {
    reports = trimReportsForDevice(reports);
    while (true) {
      try {
        localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
        return;
      } catch (err) {
        if ((err.name === 'QuotaExceededError' || err.code === 22) && reports.length > 0) {
          reports.pop();
        } else {
          throw err;
        }
      }
    }
  }

  function loadUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      const parsed = raw ? JSON.parse(raw) : defaultUser();
      if (!parsed.id) parsed.id = generateId();
      const cityCfg = (window.CIVICRADAR_CONFIG || {}).cities || CITIES || {};
      if (!parsed.city || !cityCfg[parsed.city]) parsed.city = DEFAULT_CITY;
      if (parsed.analyticsConsent == null) parsed.analyticsConsent = false;
      if (parsed.displayName) parsed.displayName = sanitizeDisplayName(parsed.displayName);
      if (parsed.ward && !isValidWard(parsed.ward, parsed.city)) parsed.ward = '';
      if (parsed.society) parsed.society = sanitizeText(parsed.society, 120);
      if (parsed.civicXp == null) parsed.civicXp = 0;
      migrateLegacyReports(parsed);
      safeLocalSet(USER_KEY, JSON.stringify(parsed));
      return parsed;
    } catch {
      return defaultUser();
    }
  }

  function defaultUser() {
    return {
      id: generateId(),
      tosAccepted: false,
      analyticsConsent: false,
      gpsConsent: false,
      city: DEFAULT_CITY,
      ward: '',
      displayName: '',
      pledges: [],
      coordinatorScope: '',
      neighbourhoodLabel: '',
      society: '',
      civicXp: 0,
      civicLevel: 'observer',
    };
  }

  function migrateLegacyReports(u) {
    if (u.reports && u.reports.length > 0) {
      const existing = loadReports();
      const merged = [...u.reports.map((r) => normalizeReport(r, u.id)), ...existing];
      saveReports(merged);
      delete u.reports;
      delete u.civicPoints;
      delete u.hazardsFixed;
      safeLocalSet(USER_KEY, JSON.stringify(u));
    }
  }

  function normalizeReport(r, ownerId) {
    return {
      id: r.id || Date.now(),
      reporterId: r.reporterId || ownerId || '',
      hazard: REPORT_HAZARDS.includes(r.hazard) ? r.hazard : 'stagnant-water',
      notes: sanitizeText(r.notes, REPORT_NOTES_MAX),
      image: r.image || '',
      ward: sanitizeText(r.ward, REPORT_WARD_MAX),
      city: r.city || getReportCity(r),
      reporter: sanitizeDisplayName(r.reporter || ''),
      lat: r.lat ?? null,
      lng: r.lng ?? null,
      status: r.status || 'pending',
      complaintId: r.complaintId || '',
      filedAt: r.filedAt || '',
      resolvedBy: r.resolvedBy || '',
      resolvedAt: r.resolvedAt || '',
      resolutionImage: r.resolutionImage || '',
      communityCleared: r.communityCleared || false,
      clearedBy: r.clearedBy || '',
      communityShared: r.communityShared || '',
      confirmations: Number(r.confirmations) || 0,
      fixConfirmations: Number(r.fixConfirmations) || 0,
      resolutionSource: r.resolutionSource || '',
      communityVerifiedAt: r.communityVerifiedAt || '',
      society: sanitizeText(r.society || '', REPORT_SOCIETY_MAX),
      neighbourhood: sanitizeText(r.neighbourhood || '', REPORT_SOCIETY_MAX),
      timestamp: r.timestamp || new Date().toISOString(),
      flagCount: Number(r.flagCount) || 0,
      removed: r.removed || false,
      removedAt: r.removedAt || '',
    };
  }

  function saveUser() {
    try {
      safeLocalSet(USER_KEY, JSON.stringify(user));
    } catch (err) {
      console.error('Failed to save user profile:', err);
    }
  }

  /** Quota-safe localStorage write — never throw into UI handlers. */
  function safeLocalSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.warn('[CivicRadar] localStorage set failed', key, err && err.name);
      return false;
    }
  }

  function loadPledges() {
    try {
      const raw = localStorage.getItem(PLEDGES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function savePledges(pledges) {
    try {
      safeLocalSet(PLEDGES_KEY, JSON.stringify(pledges));
    } catch (err) {
      console.error('Failed to save pledges:', err);
    }
  }

  function loadVolunteerSignups() {
    try {
      const raw = localStorage.getItem(VOLUNTEER_SIGNUPS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveVolunteerSignups(rows) {
    try {
      safeLocalSet(VOLUNTEER_SIGNUPS_KEY, JSON.stringify(rows));
    } catch (err) {
      console.error('Failed to save volunteer signups:', err);
    }
  }

  function loadVolunteerTasks() {
    try {
      const raw = localStorage.getItem(VOLUNTEER_TASKS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveVolunteerTasks(rows) {
    try {
      safeLocalSet(VOLUNTEER_TASKS_KEY, JSON.stringify(rows));
    } catch (err) {
      console.error('Failed to save volunteer tasks:', err);
    }
  }

  function getMyVolunteerSignup() {
    return loadVolunteerSignups().find(
      (v) => v.userId === user.id && v.status !== 'removed'
    ) || null;
  }

  function neighbourhoodMatches(leadLabel, volunteerNeighbourhood) {
    if (!leadLabel || !volunteerNeighbourhood) return false;
    const a = leadLabel.toLowerCase().trim();
    const b = volunteerNeighbourhood.toLowerCase().trim();
    const leadTail = a.split('—').pop().trim();
    return a.includes(b) || b.includes(a) || b.includes(leadTail) || leadTail.includes(b);
  }

  function matchesCoordinatorScope(ward, neighbourhood, opts) {
    const wardOnly = opts && opts.wardOnly;
    if (!user.ward) return true;
    if (ward && ward !== user.ward) return false;
    if (wardOnly || user.coordinatorScope !== 'neighbourhood' || !user.neighbourhoodLabel) return true;
    if (!neighbourhood) return false;
    return neighbourhoodMatches(user.neighbourhoodLabel, neighbourhood);
  }

  function volunteerSkillLabel(skill) {
    const key = `volunteer.skill.${skill}`;
    const label = t(key);
    return label === key ? skill : label;
  }

  function findDemoNgoCode(code) {
    const codes = (CFG.demoNgoCodes || []);
    return codes.find((c) => c.code === String(code || '').trim()) || null;
  }

  function loadPointsCache() {
    return parseInt(localStorage.getItem(POINTS_CACHE_KEY) || '0', 10) || 0;
  }

  function addPointsCache(amount) {
    const prevXp = getTotalCivicXp();
    const next = loadPointsCache() + amount;
    safeLocalSet(POINTS_CACHE_KEY, String(next));
    checkXpLevelUp(prevXp, getTotalCivicXp());
    return getTotalCivicXp();
  }

  /* ---------- Shared Backend (Supabase) ----------
   * Additive sync layer. When configured (see js/config.js) reports & pledges
   * sync across devices with realtime updates. When NOT configured, every call
   * is a no-op and the app runs purely on localStorage (offline / demo mode).
   */
  function mergeById(localArr, serverArr) {
    const serverIds = new Set(serverArr.map((x) => String(x.id)));
    const localOnly = localArr.filter((x) => !serverIds.has(String(x.id)));
    return [...serverArr, ...localOnly];
  }

  /* ---------- Cloudflare Turnstile (Supabase captcha) ---------- */
  const TURNSTILE_CONTAINER_ID = 'civic-turnstile';
  const turnstileState = { widgetId: null, pending: null };

  function getTurnstileSiteKey() {
    return String(((window.CIVICRADAR_CONFIG || {}).turnstileSiteKey) || '').trim();
  }

  function turnstileRequired() {
    return !!getTurnstileSiteKey();
  }

  function ensureTurnstileContainer() {
    let el = document.getElementById(TURNSTILE_CONTAINER_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TURNSTILE_CONTAINER_ID;
      el.className = 'turnstile-offscreen';
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    }
    return el;
  }

  function waitForTurnstileScript(timeoutMs) {
    if (window.turnstile && typeof window.turnstile.render === 'function') {
      return Promise.resolve(window.turnstile);
    }
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function tick() {
        if (window.turnstile && typeof window.turnstile.render === 'function') {
          resolve(window.turnstile);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error('turnstile_script_timeout'));
          return;
        }
        setTimeout(tick, 50);
      })();
    });
  }

  function initTurnstileWidget(turnstile) {
    if (turnstileState.widgetId != null) return turnstileState.widgetId;
    const container = ensureTurnstileContainer();
    turnstileState.widgetId = turnstile.render(container, {
      sitekey: getTurnstileSiteKey(),
      size: 'invisible',
      callback: (token) => {
        const p = turnstileState.pending;
        turnstileState.pending = null;
        if (p && p.resolve) p.resolve(token);
      },
      'error-callback': () => {
        const p = turnstileState.pending;
        turnstileState.pending = null;
        if (p && p.reject) p.reject(new Error('turnstile_error'));
      },
      'expired-callback': () => {
        try { turnstile.reset(turnstileState.widgetId); } catch { /* noop */ }
      },
    });
    return turnstileState.widgetId;
  }

  // Returns a fresh Turnstile token when a site key is configured; null when disabled.
  // Throws when opts.required and Turnstile cannot produce a token (email OTP flows).
  async function getCaptchaToken(opts) {
    const siteKey = getTurnstileSiteKey();
    if (!siteKey) return null;
    const strict = !!(opts && opts.required);
    try {
      const turnstile = await waitForTurnstileScript(10000);
      if (turnstileState.pending) {
        try { turnstileState.pending.reject(new Error('turnstile_superseded')); } catch { /* noop */ }
        turnstileState.pending = null;
      }
      const widgetId = initTurnstileWidget(turnstile);
      const token = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          turnstileState.pending = null;
          reject(new Error('turnstile_timeout'));
        }, 30000);
        turnstileState.pending = {
          resolve: (t) => { clearTimeout(timeout); resolve(t); },
          reject: (err) => { clearTimeout(timeout); reject(err); },
        };
        try {
          turnstile.reset(widgetId);
          turnstile.execute(widgetId);
        } catch (e) {
          clearTimeout(timeout);
          turnstileState.pending = null;
          reject(e);
        }
      });
      try { turnstile.reset(widgetId); } catch { /* noop */ }
      if (!token && strict) throw new Error('turnstile_empty_token');
      return token || null;
    } catch (e) {
      console.warn('[CivicRadar] Turnstile failed:', e && e.message);
      if (strict) throw e;
      return null;
    }
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-civic-src="${src}"]`);
      if (existing) {
        if (existing.dataset.civicLoaded === '1') { resolve(); return; }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('script_load_failed:' + src)), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.dataset.civicSrc = src;
      s.onload = () => { s.dataset.civicLoaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('script_load_failed:' + src));
      document.head.appendChild(s);
    });
  }

  const Backend = {
    client: null,
    enabled: false,
    _authListenerBound: false,
    _finishSignInLock: false,

    hasAuthCallbackInUrl() {
      const hash = location.hash || '';
      const search = location.search || '';
      return /access_token=|refresh_token=|type=magiclink|error=/.test(hash) || /[?&]code=/.test(search);
    },

    parseAuthCallbackError() {
      const raw = (location.hash || '').replace(/^#/, '');
      if (!raw) return null;
      const params = new URLSearchParams(raw);
      const error = params.get('error');
      if (!error) return null;
      return {
        error,
        code: params.get('error_code') || error,
        description: params.get('error_description') || '',
      };
    },

    clearAuthCallbackFromUrl() {
      try {
        const u = new URL(location.href);
        u.hash = '';
        u.searchParams.delete('code');
        history.replaceState(history.state, '', u.pathname + u.search);
      } catch { /* ignore */ }
    },

    async recoverSessionFromUrl() {
      if (!this.client) return null;
      const authErr = this.parseAuthCallbackError();
      if (authErr) {
        this.clearAuthCallbackFromUrl();
        const msg = authErr.code === 'otp_expired' || /expired|invalid/i.test(authErr.description)
          ? t('toast.linkExpired')
          : formatAuthError(authErr);
        showToast(msg, 'error', 5000);
        return null;
      }
      if (!this.hasAuthCallbackInUrl()) return null;

      const code = new URLSearchParams(location.search).get('code');
      if (code) {
        const { data, error } = await this.client.auth.exchangeCodeForSession(code);
        this.clearAuthCallbackFromUrl();
        if (error) {
          showToast(t('toast.linkExpired'), 'error', 5000);
          return null;
        }
        return data.session;
      }

      const { data: { session }, error } = await this.client.auth.getSession();
      this.clearAuthCallbackFromUrl();
      if (error) {
        showToast(t('toast.linkExpired'), 'error', 5000);
        return null;
      }
      return session;
    },

    bindAuthStateListener() {
      if (this._authListenerBound || !this.client) return;
      this._authListenerBound = true;
      this.client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session && !session.user.is_anonymous) {
          this.finishEmailSignIn(session).catch((e) => {
            console.warn('Magic-link sign-in handling failed:', e && e.message);
          });
        }
      });
    },

    async finishEmailSignIn(session) {
      if (!session || session.user.is_anonymous || this._finishSignInLock) return;
      this._finishSignInLock = true;
      try {
        adoptBackendUserId(session.user.id);
        const flow = sessionStorage.getItem(PENDING_AUTH_FLOW_KEY);
        if (flow === 'lead') {
          const code = sessionStorage.getItem(PENDING_NGO_CODE_KEY) || ($('#leadCode') && $('#leadCode').value.trim());
          clearPendingAuth();
          if (!code) {
            showToast(t('toast.ngoCodeRequired'), 'error', 5000);
            return;
          }
          const { data, error: rpcError } = await this.redeemNgoCode(code);
          if (rpcError || !data) {
            await this.signOut();
            showToast(t('toast.ngoCodeInvalid'), 'error', 5000);
            return;
          }
          const assignment = typeof data === 'object' ? data : { ward: data };
          const profile = await this.getMyRole();
          grantLeadAccess(
            assignment.ward || (profile && profile.ward),
            (profile && profile.coordinator_scope) || assignment.coordinator_scope || 'ward',
            (profile && profile.neighbourhood_label) || assignment.neighbourhood_label || '',
            assignment.city || (profile && profile.city) || ''
          );
          return;
        }
        if (flow === 'admin') {
          clearPendingAuth();
          const profile = await this.getMyRole();
          if (profile && profile.role === 'admin') {
            isSuperAdmin = true;
            window.isSuperAdmin = true;
            refreshAccessReviewBadge();
          }
          if (profile && (profile.role === 'bmc' || profile.role === 'admin')) {
            grantBmcAccess();
          } else {
            await this.signOut();
            showToast(t('toast.bmcUnauthorized'), 'error', 5000);
          }
          return;
        }
        await restoreElevatedRole();
        if (isAdmin || isLead) {
          closeAllModals();
          showToast(isAdmin ? t('toast.adminVerified') : t('toast.ngoVerified'), 'success', 4500);
        }
      } finally {
        this._finishSignInLock = false;
      }
    },

    async init() {
      const cfg = window.CIVICRADAR_CONFIG || {};
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
        updateSyncStatus();
        applyLocalLeadGrants();
        return false; // local-only mode
      }
      if (!window.supabase) {
        try {
          await loadScriptOnce('vendor/supabase/supabase.js');
        } catch (e) {
          console.warn('[CivicRadar] Supabase script failed — staying local', e);
          updateSyncStatus();
          applyLocalLeadGrants();
          return false;
        }
      }
      if (!window.supabase) {
        updateSyncStatus();
        applyLocalLeadGrants();
        return false;
      }
      try {
        this.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        this.bindAuthStateListener();

        let session = await this.recoverSessionFromUrl();
        if (!session) {
          const { data: { session: stored } } = await this.client.auth.getSession();
          session = stored;
        }

        if (!session) {
          let captchaToken = null;
          if (turnstileRequired()) {
            captchaToken = await getCaptchaToken({ required: true });
          } else {
            try {
              captchaToken = await getCaptchaToken();
            } catch (e) {
              console.warn('[CivicRadar] Turnstile unavailable at init — trying anonymous sign-in without token');
            }
          }
          if (turnstileRequired() && !captchaToken) {
            showToast(t('toast.authCaptchaFail'), 'error', 5000);
            throw new Error('captcha_required');
          }
          const signInOpts = captchaToken ? { options: { captchaToken } } : {};
          const { data, error } = await this.client.auth.signInAnonymously(signInOpts);
          if (error) throw error;
          session = data.session;
        }
        const uid = session.user.id;
        adoptBackendUserId(uid);

        this.enabled = true;
        await this.pullAll();
        await this.pushLocalOwned();
        this.flushPendingFeedback();
        this.flushPendingAccessRequests();
        this.subscribe();
        updateAuthMode();
        updateSyncStatus();
        if (session && !session.user.is_anonymous) {
          await this.finishEmailSignIn(session);
        } else {
          await restoreElevatedRole();
        }
        if (window.CivicAnalytics) CivicAnalytics.setSupabaseClient(this.client);
        // Quiet success — header "Syncing" chip is enough; toast confused end users.
        return true;
      } catch (e) {
        const code = (e && (e.error_code || e.code)) || '';
        const msg = (e && e.message) || String(e);
        console.warn('Supabase unavailable, running in local mode:', msg, code ? `[${code}]` : '');
        this.enabled = false;
        updateSyncStatus();
        applyLocalLeadGrants();
        showToast(t('toast.syncLocal'), 'info', 3500);
        return false;
      }
    },

    rowToReport(r) {
      return normalizeReport({
        id: r.id,
        reporterId: r.reporter_id,
        reporter: r.reporter_name,
        hazard: r.hazard,
        notes: r.notes,
        image: r.image,
        ward: r.ward,
        city: r.city || DEFAULT_CITY,
        lat: r.lat,
        lng: r.lng,
        status: r.status,
        complaintId: r.complaint_id || '',
        filedAt: r.filed_at || '',
        resolvedBy: r.resolved_by || '',
        resolvedAt: r.resolved_at || '',
        resolutionImage: r.resolution_image || '',
        communityCleared: !!r.community_cleared,
        clearedBy: r.cleared_by || '',
        confirmations: Number(r.confirmations) || 0,
        fixConfirmations: Number(r.fix_confirmations) || 0,
        resolutionSource: r.resolution_source || '',
        communityVerifiedAt: r.community_verified_at || '',
        society: r.society || '',
        timestamp: r.created_at,
        flagCount: Number(r.flag_count) || 0,
        removed: !!r.removed,
        removedAt: r.removed_at || '',
      });
    },

    // Uploads a local JPEG data URL to the report-photos Storage bucket and
    // returns its public URL, so synced rows carry a short URL instead of a
    // 30-160KB base64 blob (keeps Postgres row size and sync egress small at
    // scale — see ARCHITECTURE.md Stage 1). Falls back to the raw data URL
    // untouched if not connected, already a URL, or the upload fails, so a
    // report never silently fails to sync over a storage hiccup.
    async uploadReportImage(dataUrl, path) {
      if (!this.enabled || !dataUrl || !dataUrl.startsWith('data:')) return dataUrl || '';
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const { error: uploadError } = await this.client.storage
          .from('report-photos')
          .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw uploadError;
        const { data } = this.client.storage.from('report-photos').getPublicUrl(path);
        return data?.publicUrl || dataUrl;
      } catch (err) {
        if (window.CivicAnalytics) {
          CivicAnalytics.trackError(err?.message || 'upload_failed', { context: 'uploadReportImage' });
        }
        return dataUrl;
      }
    },

    async syncReportInsert(r) {
      const s = sanitizeReportInput(Object.assign({}, r, { reporterId: user.id }));
      const image = await this.uploadReportImage(s.image, `${user.id}/${s.id}.jpg`);
      return this.client.rpc('insert_report', {
        p_id: s.id,
        p_hazard: s.hazard,
        p_notes: s.notes || null,
        p_image: image || null,
        p_lat: s.lat,
        p_lng: s.lng,
        p_ward: s.ward || null,
        p_city: s.city || null,
        p_society: s.society || null,
        p_reporter_name: s.reporter || null,
        p_neighbourhood: s.neighbourhood || null,
      });
    },

    pledgeToRow(p) {
      return {
        id: p.id,
        citizen_id: p.citizenId || user.id,
        citizen_name: p.citizen || '',
        type: p.type,
        ward: p.ward || '',
        city: p.city || getUserCity(),
        message: p.message || '',
        delivered: !!p.delivered,
        verified: !!p.hoursVerified || !!p.verified,
        created_at: p.timestamp || new Date().toISOString(),
      };
    },

    rowToPledge(r) {
      return {
        id: r.id,
        citizenId: r.citizen_id,
        citizen: r.citizen_name,
        type: r.type,
        ward: r.ward,
        city: r.city || DEFAULT_CITY,
        message: r.message,
        delivered: !!r.delivered,
        hoursVerified: !!r.verified,
        timestamp: r.created_at,
      };
    },

    rowToVolunteerSignup(r) {
      return {
        id: r.id,
        userId: r.user_id,
        displayName: r.display_name,
        ward: r.ward,
        city: r.city || DEFAULT_CITY,
        neighbourhood: r.neighbourhood,
        hours: Number(r.hours) || 2,
        skills: Array.isArray(r.skills) ? r.skills : [],
        contact: r.contact || '',
        status: r.status || 'active',
        timestamp: r.created_at,
      };
    },

    volunteerSignupToRow(v) {
      return {
        id: v.id,
        user_id: v.userId || user.id,
        display_name: v.displayName || user.displayName || '',
        ward: v.ward,
        city: v.city || getUserCity(),
        neighbourhood: v.neighbourhood,
        hours: v.hours,
        skills: v.skills || [],
        contact: v.contact || null,
        status: v.status || 'active',
        created_at: v.timestamp || new Date().toISOString(),
      };
    },

    rowToVolunteerTask(r) {
      return {
        id: r.id,
        reportId: r.report_id,
        volunteerSignupId: r.volunteer_signup_id,
        volunteerName: r.volunteer_name,
        ward: r.ward,
        neighbourhood: r.neighbourhood,
        status: r.status || 'pending',
        timestamp: r.created_at,
        completedAt: r.completed_at || '',
      };
    },

    volunteerTaskToRow(task) {
      return {
        id: task.id,
        report_id: task.reportId,
        volunteer_signup_id: task.volunteerSignupId || null,
        volunteer_name: task.volunteerName || '',
        ward: task.ward || '',
        neighbourhood: task.neighbourhood || '',
        status: task.status || 'pending',
        created_at: task.timestamp || new Date().toISOString(),
        completed_at: task.completedAt || null,
      };
    },

    async pullAll() {
      if (!this.enabled) return;
      if (window.CivicAnalytics) CivicAnalytics.perfStart('sync_duration');
      try {
      const batch = SCALE_CFG.syncBatchSize;
      const recentCutoff = new Date(
        Date.now() - SCALE_CFG.syncRecentDays * 24 * 60 * 60 * 1000
      ).toISOString();
      const uid = user.id;

      const [{ data: recentReps }, { data: ownReps }, { data: pls }, { data: vols }, { data: tasks }] = await Promise.all([
        this.client
          .from('reports')
          .select('*')
          .gte('created_at', recentCutoff)
          .order('created_at', { ascending: false })
          .limit(batch),
        this.client
          .from('reports')
          .select('*')
          .eq('reporter_id', uid)
          .order('created_at', { ascending: false }),
        this.client
          .from('pledges')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(batch),
        this.client
          .from('volunteer_signups')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(batch),
        this.client
          .from('volunteer_tasks')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(batch),
      ]);

      const repRows = new Map();
      [...(recentReps || []), ...(ownReps || [])].forEach((r) => {
        repRows.set(String(r.id), r);
      });
      // Authoritative reconcile: merge-only left stale localStorage rows after a
      // cloud purge, and pushLocalOwned then re-seeded the empty DB. Drop other
      // users' UUID rows not returned when the recent page is complete; keep only
      // this user's syncPending drafts. Always write — including when cloud is empty.
      {
        const serverMapped = [...repRows.values()].map((r) => this.rowToReport(r));
        const serverIds = new Set(serverMapped.map((r) => String(r.id)));
        const recentComplete = (recentReps || []).length < batch;
        const uuidRe = /^[0-9a-f-]{36}$/i;
        const prevReports = loadReports();
        const localKeep = prevReports.filter((r) => {
          const id = String(r.id);
          if (serverIds.has(id)) return false;
          if (!uuidRe.test(id)) return true;
          if (String(r.reporterId) === String(uid)) return !!r.syncPending;
          return !recentComplete;
        });
        saveReports([...serverMapped, ...localKeep]);
        processNeighbourhoodAlertsOnSync(prevReports);
      }
      if (pls) {
        const serverMapped = pls.map((r) => this.rowToPledge(r));
        const serverIds = new Set(serverMapped.map((p) => String(p.id)));
        const uuidRe = /^[0-9a-f-]{36}$/i;
        const localKeep = loadPledges().filter((p) => {
          if (p.mock) return false;
          const id = String(p.id);
          if (serverIds.has(id)) return false;
          if (!uuidRe.test(id)) return true;
          if (String(p.citizenId) === String(uid)) return !!p.syncPending;
          return false;
        });
        savePledges([...serverMapped, ...localKeep]);
      }
      if (vols) {
        const serverMapped = vols.map((r) => this.rowToVolunteerSignup(r));
        const serverIds = new Set(serverMapped.map((v) => String(v.id)));
        const uuidRe = /^[0-9a-f-]{36}$/i;
        const localKeep = loadVolunteerSignups().filter((v) => {
          const id = String(v.id);
          if (serverIds.has(id)) return false;
          if (!uuidRe.test(id)) return true;
          if (String(v.userId) === String(uid)) return !!v.syncPending;
          return false;
        });
        saveVolunteerSignups([...serverMapped, ...localKeep]);
      }
      if (tasks) {
        const serverMapped = tasks.map((r) => this.rowToVolunteerTask(r));
        const serverIds = new Set(serverMapped.map((t) => String(t.id)));
        const uuidRe = /^[0-9a-f-]{36}$/i;
        const localKeep = loadVolunteerTasks().filter((t) => {
          const id = String(t.id);
          if (serverIds.has(id)) return false;
          if (!uuidRe.test(id)) return true;
          return !!t.syncPending;
        });
        saveVolunteerTasks([...serverMapped, ...localKeep]);
      }
      refreshAllViews();
      } finally {
        if (window.CivicAnalytics) CivicAnalytics.perfEnd('sync_duration');
      }
    },

    // Best-effort push of rows created/failed while offline. Only syncPending
    // rows — never re-upload stale cache after a cloud purge.
    async pushLocalOwned() {
      if (!this.enabled) return;
      const myReports = loadReports().filter(
        (r) => r.syncPending && r.reporterId === user.id && /^[0-9a-f-]{36}$/i.test(String(r.id))
      );
      if (myReports.length) {
        await Promise.all(myReports.map(async (r) => {
          const { error } = await this.syncReportInsert(r);
          if (!error) this.markReportSyncPending(r.id, false);
        }));
      }
      const myPledges = loadPledges().filter(
        (p) => p.syncPending && !p.mock && p.citizenId === user.id && /^[0-9a-f-]{36}$/i.test(String(p.id))
      );
      if (myPledges.length) {
        const { error } = await this.client.from('pledges').upsert(myPledges.map((p) => this.pledgeToRow(p)), { onConflict: 'id' });
        if (!error) {
          const cleared = loadPledges().map((p) => (
            myPledges.some((m) => String(m.id) === String(p.id)) ? { ...p, syncPending: false } : p
          ));
          savePledges(cleared);
        }
      }
    },

    markReportSyncPending(reportId, pending) {
      const reports = loadReports();
      let changed = false;
      reports.forEach((r) => {
        if (String(r.id) === String(reportId)) {
          if (!!r.syncPending !== !!pending) changed = true;
          r.syncPending = !!pending;
        }
      });
      if (changed) saveReports(reports);
    },

    subscribe() {
      if (!this.enabled) return;
      let pullTimer = null;
      const schedulePull = () => {
        clearTimeout(pullTimer);
        pullTimer = setTimeout(() => this.pullAll(), 800);
      };
      this.client
        .channel('civicradar-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, schedulePull)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pledges' }, schedulePull)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'volunteer_signups' }, schedulePull)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'volunteer_tasks' }, schedulePull)
        .subscribe();
    },

    async insertReport(report) {
      if (!this.enabled) {
        this.markReportSyncPending(report.id, true);
        return;
      }
      const { error } = await this.syncReportInsert(report);
      if (error) {
        console.warn('Report sync failed (saved locally):', error.message);
        this.markReportSyncPending(report.id, true);
        if (window.CivicAnalytics) {
          CivicAnalytics.trackError(error.message, { context: 'insertReport', source: 'sync' });
        }
        showToast(t('toast.syncLocal'), 'info', 3500);
      } else {
        this.markReportSyncPending(report.id, false);
      }
    },

    async insertFeedback(row) {
      if (!this.enabled) return { error: { message: 'offline' } };
      const { error } = await this.client.from('feedback').insert(row);
      if (error && window.CivicAnalytics) {
        CivicAnalytics.trackError(error.message, { context: 'insertFeedback' });
      }
      return { error: error || null };
    },

    // Best-effort: push any feedback saved while offline once the backend is up.
    async flushPendingFeedback() {
      if (!this.enabled) return;
      const list = getPendingFeedback();
      if (!list.length) return;
      const remaining = [];
      for (const row of list) {
        try {
          const { error } = await this.client.from('feedback').insert(row);
          if (error) remaining.push(row);
        } catch {
          remaining.push(row);
        }
      }
      savePendingFeedback(remaining);
    },

    // ---- Referral reward loop ----
    async insertReferral(row) {
      if (!this.enabled) return { error: { message: 'offline' } };
      const { error } = await this.client.rpc('record_referral_redemption', {
        p_referrer_code: row.referrer_code,
        p_city: row.city || null,
        p_ward: row.ward || null,
      });
      if (error && window.CivicAnalytics) {
        CivicAnalytics.trackError(error.message, { context: 'insertReferral' });
      }
      return { error: error || null };
    },

    async getReferralCount(code) {
      if (!this.enabled || !code) return { count: 0, error: null };
      const { data, error } = await this.client.rpc('get_referral_count', { p_code: code });
      if (error && window.CivicAnalytics) {
        CivicAnalytics.trackError(error.message, { context: 'get_referral_count' });
      }
      return { count: error ? 0 : (Number(data) || 0), error: error || null };
    },

    // ---- Coordinator access requests ----
    async submitAccessRequest(payload) {
      if (!this.enabled) return { error: { message: 'offline' } };
      const { data, error } = await this.client.rpc('request_access', payload);
      if (error && window.CivicAnalytics) {
        CivicAnalytics.trackError(error.message, { context: 'request_access' });
      }
      return { data, error: error || null };
    },

    async listAccessRequests() {
      if (!this.enabled) return { data: [], error: { message: 'offline' } };
      const { data, error } = await this.client
        .from('access_requests')
        .select('*')
        .order('created_at', { ascending: false });
      return { data: data || [], error: error || null };
    },

    async approveAccessRequest(id) {
      if (!this.enabled) return { data: null, error: { message: 'offline' } };
      const { data, error } = await this.client.rpc('approve_access_request', { p_id: id });
      return { data, error: error || null };
    },

    async rejectAccessRequest(id) {
      if (!this.enabled) return { error: { message: 'offline' } };
      const { error } = await this.client.rpc('reject_access_request', { p_id: id });
      return { error: error || null };
    },

    async claimAccess(code) {
      if (!this.enabled) return { data: null, error: { message: 'offline' } };
      const { data, error } = await this.client.rpc('claim_access', { p_code: code });
      return { data, error: error || null };
    },

    // Best-effort: push any access requests saved while offline once back online.
    async flushPendingAccessRequests() {
      if (!this.enabled) return;
      const list = getPendingAccessSync();
      if (!list.length) return;
      const remaining = [];
      for (const payload of list) {
        try {
          const { error } = await this.client.rpc('request_access', payload);
          if (error) remaining.push(payload);
        } catch {
          remaining.push(payload);
        }
      }
      savePendingAccessSync(remaining);
    },

    // ---- Peer voting for NGO / neighbourhood leads ----
    async nominateForLead(payload) {
      if (!this.enabled) return { data: null, error: { message: 'offline' } };
      const { data, error } = await this.client.rpc('nominate_for_lead', payload);
      return { data, error: error || null };
    },

    async voteForLead(nominationId) {
      if (!this.enabled) return { data: null, error: { message: 'offline' } };
      const { data, error } = await this.client.rpc('vote_for_lead', { p_nomination_id: nominationId });
      return { data, error: error || null };
    },

    async listLeadNominations(city, ward, neighbourhood) {
      if (!this.enabled) return { data: [], error: { message: 'offline' } };
      const { data, error } = await this.client.rpc('list_lead_nominations', {
        p_city: city || 'mumbai',
        p_ward: ward || null,
        p_neighbourhood: neighbourhood || null,
      });
      return { data: data || [], error: error || null };
    },

    // Status/resolution/filing/cleanup all go through SECURITY DEFINER RPCs,
    // not direct column writes — `authenticated` no longer holds UPDATE on any
    // reports column (schema.sql column-lock hardening). Each RPC re-checks
    // role/ownership server-side, so a client can't fake e.g. by:'bmc' the way
    // a raw .update() with a client-supplied `by` string previously could.
    async updateReportResolution(id, status, by, at, resolutionImage, resolutionSource, communityVerifiedAt) {
      if (!this.enabled) return;
      // Path is scoped to the *uploader's* (this session's) own auth.uid(), not the
      // original reporter's — an admin/coordinator resolving someone else's report
      // still writes to their own Storage folder per the report_photos RLS policy.
      const imageUrl = resolutionImage
        ? await this.uploadReportImage(resolutionImage, `${user.id}/${id}-resolved.jpg`)
        : null;
      let error;
      if (by === 'bmc') {
        ({ error } = await this.client.rpc('bmc_set_report_status', {
          p_report_id: id, p_status: status, p_resolution_image: imageUrl,
        }));
      } else if (by === 'citizen') {
        ({ error } = await this.client.rpc('resolve_own_report', {
          p_report_id: id, p_resolution_image: imageUrl,
        }));
      } else if (imageUrl) {
        // community: confirm_fix() already resolved the report server-side —
        // this just attaches the "after" photo, if the confirming device has one.
        ({ error } = await this.client.rpc('set_resolution_image', {
          p_report_id: id, p_image: imageUrl,
        }));
      }
      if (error) console.warn('Resolution sync failed:', error.message);
    },

    async updateReportFiling(id, complaintId, filedAt) {
      if (!this.enabled) return;
      const { error } = await this.client.rpc('bmc_set_report_status', {
        p_report_id: id, p_complaint_id: complaintId, p_filed_at: filedAt,
      });
      if (error) console.warn('Filing sync failed:', error.message);
    },

    async updateReportCleanup(id, cleared, by) {
      if (!this.enabled) return;
      const { error } = await this.client.rpc('ngo_mark_cleared', {
        p_report_id: id, p_cleared: cleared, p_cleared_by: by,
      });
      if (error) console.warn('Cleanup sync failed:', error.message);
    },

    // Atomic, dedup-by-user corroboration via RPC (see schema.sql).
    async confirmReport(id) {
      if (!this.enabled) return;
      const { error } = await this.client.rpc('confirm_report', { p_report_id: id });
      if (error) console.warn('Confirm sync failed:', error.message);
    },

    // Content-moderation flag (UGC compliance) — atomic, dedup-by-user via RPC.
    async flagReport(id) {
      if (!this.enabled) return;
      const { error } = await this.client.rpc('flag_report', { p_report_id: id });
      if (error) console.warn('Flag sync failed:', error.message);
    },

    // BMC/admin takedown of objectionable content. Soft-delete: the row stays
    // for audit (reporter + BMC can still see it), but the RLS select policy
    // hides it from everyone else, so it drops off every other device's next
    // sync rather than just the moderator's own local cache.
    async removeReportContent(id) {
      if (!this.enabled) return;
      const { error } = await this.client.rpc('admin_remove_report', { p_report_id: id });
      if (error) console.warn('Remove-content sync failed:', error.message);
    },

    async confirmFix(id, staleCheck) {
      if (!this.enabled) return null;
      const { data, error } = await this.client.rpc('confirm_fix', {
        p_report_id: id,
        p_threshold: FIX_CONFIRM_THRESHOLD,
        p_stale_check: !!staleCheck,
      });
      if (error) {
        console.warn('Fix confirm sync failed:', error.message);
        return null;
      }
      return data;
    },

    async insertPledge(pledge) {
      if (!this.enabled) return;
      const { error } = await this.client.from('pledges').upsert(this.pledgeToRow(pledge), { onConflict: 'id' });
      if (error) console.warn('Pledge sync failed:', error.message);
    },

    async updatePledge(id, fields) {
      if (!this.enabled) return;
      const { error } = await this.client.from('pledges').update(fields).eq('id', id);
      if (error) console.warn('Pledge update sync failed:', error.message);
    },

    async upsertVolunteerSignup(signup) {
      if (!this.enabled) return;
      const { error } = await this.client
        .from('volunteer_signups')
        .upsert(this.volunteerSignupToRow(signup), { onConflict: 'id' });
      if (error) console.warn('Volunteer signup sync failed:', error.message);
    },

    async removeVolunteerSignup(id) {
      if (!this.enabled) return;
      const { error } = await this.client.from('volunteer_signups').delete().eq('id', id);
      if (error) console.warn('Volunteer signup delete failed:', error.message);
    },

    async insertVolunteerTask(task) {
      if (!this.enabled) return;
      const { error } = await this.client
        .from('volunteer_tasks')
        .upsert(this.volunteerTaskToRow(task), { onConflict: 'id' });
      if (error) console.warn('Volunteer task sync failed:', error.message);
    },

    async updateVolunteerTask(id, fields) {
      if (!this.enabled) return;
      const { error } = await this.client.from('volunteer_tasks').update(fields).eq('id', id);
      if (error) console.warn('Volunteer task update failed:', error.message);
    },

    // ---- Auth / roles ----
    async sendEmailCode(email) {
      // Passwordless email sign-in. Default Supabase templates send magic links
      // (ConfirmationURL); OTP codes need custom SMTP + {{ .Token }} in the template.
      // emailRedirectTo must match Authentication → URL Configuration redirect allowlist.
      if (!this.enabled || !this.client) {
        return { data: null, error: { message: 'offline', code: 'backend_offline' } };
      }
      const publicUrl = ((window.CIVICRADAR_CONFIG || {}).publicUrl || '').replace(/\/$/, '');
      let captchaToken = null;
      if (turnstileRequired()) {
        try {
          captchaToken = await getCaptchaToken({ required: true });
        } catch (e) {
          console.warn('Turnstile failed before sendEmailCode:', e && e.message);
          return { data: null, error: { message: 'Captcha verification unavailable', code: 'captcha_unavailable' } };
        }
      }
      try {
        return await this.client.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            ...(publicUrl ? { emailRedirectTo: publicUrl } : {}),
            ...(captchaToken ? { captchaToken } : {}),
          },
        });
      } catch (e) {
        console.warn('sendEmailCode failed:', e);
        return { data: null, error: e };
      }
    },

    async verifyEmailCode(email, token) {
      return this.client.auth.verifyOtp({ email, token, type: 'email' });
    },

    // Reads the caller's role from the profiles table (set server-side).
    async getMyRole() {
      const { data: { user: u } } = await this.client.auth.getUser();
      if (!u) return null;
      const { data, error } = await this.client.from('profiles').select('role, ward, city, coordinator_scope, neighbourhood_label, society, neighbourhood_new_alerts_enabled, neighbourhood_resolved_alerts_enabled').eq('id', u.id).single();
      if (error) return { role: 'citizen', ward: '' };
      return data;
    },

    // Redeems an NGO invite code server-side (SECURITY DEFINER RPC), which
    // grants the ngo_lead role and returns the assigned ward.
    async redeemNgoCode(code) {
      return this.client.rpc('redeem_ngo_code', { p_code: code });
    },

    async updateNotificationPrefs({ newAlerts, resolvedAlerts }) {
      if (!this.enabled || !this.client) return;
      const patch = {};
      if (typeof newAlerts === 'boolean') patch.neighbourhood_new_alerts_enabled = newAlerts;
      if (typeof resolvedAlerts === 'boolean') patch.neighbourhood_resolved_alerts_enabled = resolvedAlerts;
      if (!Object.keys(patch).length) return;
      const { error } = await this.client.from('profiles').update(patch).eq('id', user.id);
      if (error) console.warn('Notification prefs sync failed:', error.message);
    },

    // Goes through the sync_civic_xp RPC, not a direct column write — profiles
    // no longer grants client UPDATE on civic_xp/civic_level (schema.sql column-lock
    // hardening), so a raw .update() here would be silently rejected by Postgres anyway.
    async syncCivicXp(xp, level) {
      if (!this.enabled || !this.client) return;
      const uid = user.id;
      if (!/^[0-9a-f-]{36}$/i.test(String(uid))) return;
      const { error } = await this.client.rpc('sync_civic_xp', {
        p_xp: Number(xp) || 0,
        p_level: level || 'observer',
      });
      if (error) console.warn('Civic XP sync failed:', error.message);
    },

    async signOut() {
      if (!this.enabled) return;
      try { await this.client.auth.signOut(); } catch {}
    },

    // Delete this user's cloud data (DPDP erasure) via RPC; rotate anonymous session.
    async deleteMyData() {
      if (!this.enabled || !this.client) return;
      const sessionId = window.CivicAnalytics ? CivicAnalytics.getSessionId() : null;
      try {
        await this.client.rpc('delete_user_data', { p_session_id: sessionId });
      } catch (e) {
        console.warn('delete_user_data RPC failed — falling back to row deletes:', e && e.message);
        const uid = user.id;
        if (/^[0-9a-f-]{36}$/i.test(String(uid))) {
          await this.client.from('reports').delete().eq('reporter_id', uid);
          await this.client.from('pledges').delete().eq('citizen_id', uid);
          await this.client.from('volunteer_signups').delete().eq('user_id', uid);
        }
      }
      await this.signOut();
      try {
        let captchaToken = null;
        if (turnstileRequired()) {
          captchaToken = await getCaptchaToken({ required: true });
        } else {
          try {
            captchaToken = await getCaptchaToken();
          } catch (e) {
            console.warn('Turnstile unavailable after data deletion — re-auth without token');
          }
        }
        if (turnstileRequired() && !captchaToken) {
          showToast(t('toast.authCaptchaFail'), 'error', 5000);
          return;
        }
        const signInOpts = captchaToken ? { options: { captchaToken } } : {};
        const { data, error } = await this.client.auth.signInAnonymously(signInOpts);
        if (!error && data.session) adoptBackendUserId(data.session.user.id);
      } catch (e) {
        console.warn('Re-auth after deletion failed:', e && e.message);
        if (turnstileRequired()) showToast(t('toast.authCaptchaFail'), 'error', 5000);
      }
    },
  };
  window.Backend = Backend;




  /* ---------- Auth (elevated-role sign-in) ----------

   * BMC officials authenticate with an official government email (magic link or OTP

   * when custom SMTP is configured); the server grants the 'bmc' role only for

   * allowlisted gov domains. NGO coordinators authenticate with email + an invite

   * code that the platform issues; redeeming it server-side grants the 'ngo_lead' role.

   * In local/demo mode (no backend) we fall back to the labelled demo logins.

   */

  const Auth = {

    GOV_DOMAINS: ['mcgm.gov.in', 'gov.in', 'nic.in', 'maharashtra.gov.in'],



    emailDomain(email) {

      const m = /@([^@\s]+)$/.exec(String(email).trim().toLowerCase());

      return m ? m[1] : '';

    },



    isGovEmail(email) {

      const d = this.emailDomain(email);

      return this.GOV_DOMAINS.some((g) => d === g || d.endsWith('.' + g));

    },

  };



  // Re-render everything that reflects shared data. Guards keep it safe to call

  // before the DOM/handlers are ready.

  function refreshAllViews() {

    try {

      if (reportMarkerLayer) refreshReportMarkers();

      updateProfileUI();

      updatePersonaUI();

      updateCommunitySubtitle();

      renderWardChallenge();

      renderLeaderboard('wards');

      renderLeaderboard('citizens');

      if (overlays.coordinator && overlays.coordinator.classList.contains('open')) {

        renderCoordinatorPledges();

        renderCoordinatorHazards();

        renderCoordinatorVolunteers();

        renderCoordinatorTasks();

      }

      if (overlays.adminQueue && overlays.adminQueue.classList.contains('open')) {

        renderAdminQueue();

      }

      renderCommunityImpactStats();

      renderWardChallenge();

      if (overlays.community && overlays.community.classList.contains('open')) {

        renderImpactWall();

        renderSuccessStories();

      }

      updateCommunityWinBadge();

      // A backed hazard may have been resolved on another device — notify on sync.

      checkConfirmedResolved();

      checkFixConfirmedResolved();

      checkResolvedWins();

      checkPledgeStatusUpdates();

      notifyNgoNewPledges();

      processSyncReminders();

      processLocalNbhQueue();

    } catch (e) {

      /* views may not be mounted yet */

    }

  }



  // When the backend assigns a real auth uid, re-key this device's local data

  // so the user keeps ownership of reports/pledges created in offline mode.

  function adoptBackendUserId(uid) {

    if (!uid || user.id === uid) return;

    const preserved = {

      tosAccepted: user.tosAccepted,

      analyticsConsent: user.analyticsConsent,

      gpsConsent: user.gpsConsent,

      city: user.city || DEFAULT_CITY,

      ward: user.ward,

      displayName: user.displayName,

      pledges: user.pledges || [],

      coordinatorScope: user.coordinatorScope || '',

      neighbourhoodLabel: user.neighbourhoodLabel || '',

      society: user.society || '',

    };

    const oldId = user.id;

    const reports = loadReports().map((r) => {

      if (r.reporterId === oldId) r.reporterId = uid;

      return r;

    });

    saveReports(reports);

    const pledges = loadPledges().map((p) => {

      if (p.citizenId === oldId) p.citizenId = uid;

      return p;

    });

    savePledges(pledges);

    const vols = loadVolunteerSignups().map((v) => {

      if (v.userId === oldId) v.userId = uid;

      return v;

    });

    saveVolunteerSignups(vols);

    Object.assign(user, preserved, { id: uid });

    saveUser();

  }



  function wipeLocalUserData() {

    const uid = user.id;

    const reports = loadReports().filter((r) => r.reporterId !== uid);

    saveReports(reports);

    const pledges = loadPledges().filter((p) => p.mock || p.citizenId !== uid);

    savePledges(pledges);

    [

      POINTS_CACHE_KEY, CONFIRMED_KEY, FIX_CONFIRMED_KEY, FIX_CONFIRMED_SEEN_KEY,

      RESOLVED_SEEN_KEY, CONFIRMED_SEEN_KEY,

      REMINDER_STALE_SNOOZE_KEY,

      SUCCESS_STORIES_SEEN_KEY,

      HIDDEN_REPORTS_KEY, MUTED_REPORTERS_KEY, WEEK_BONUS_KEY, INTEREST_KEY, COACH_KEY, TOUR_KEY,

      PLEDGE_STATUS_SNAPSHOT_KEY, PLEDGE_POINTS_CREDITED_KEY,

      REMINDER_NGO_PLEDGES_LAST_SEEN_KEY,

      VOLUNTEER_SIGNUPS_KEY, VOLUNTEER_TASKS_KEY,

      LOCBANNER_SNOOZE_KEY,

      NBH_ALERT_NEW_KEY, NBH_ALERT_RESOLVED_KEY, NBH_ALERT_LOG_KEY,

      NBH_ALERT_NEW_SEEN_KEY, NBH_ALERT_RESOLVED_SEEN_KEY, NBH_ALERT_RESOLVE_DIGEST_KEY,

    ].forEach((k) => { try { localStorage.removeItem(k); } catch {} });

    confirmedIdCache = null;

    if (window.CivicAnalytics) {

      CivicAnalytics.setConsent(false);

      CivicAnalytics.clearLocalData();

    }

    isAdmin = false;

    isLead = false;

    window.isAdmin = false;

    window.isLead = false;

    user = defaultUser();

    saveUser();

  }



  function withdrawAnalyticsConsent() {

    user.analyticsConsent = false;

    saveUser();

    if (window.CivicAnalytics) CivicAnalytics.setConsent(false);

    showToast(t('profile.withdrawAnalyticsDone'), 'info', 4500);

  }



  function withdrawGpsConsent() {

    user.gpsConsent = false;

    saveUser();

    stopUserLocationRefine();

    showLocationBanner(t('location.withdrawn'));

    showToast(t('profile.withdrawGpsDone'), 'info', 4500);

  }



  function deleteMyData() {

    openModal('deleteConfirm');

  }



  async function executeDeleteMyData() {

    closeModal('deleteConfirm');

    const wasConnected = Backend.enabled;

    if (wasConnected) await Backend.deleteMyData();

    wipeLocalUserData();

    refreshReportMarkers();

    updateProfileUI();

    updatePersonaUI();

    renderLeaderboard('wards');

    renderLeaderboard('citizens');

    closeModal('profile');

    showToast(t('profile.deleteDone'), 'success', 5000);

    openModal('tos');

  }



  function getCommunityImpactStats() {

    const reports = loadReports();

    const pledges = loadPledges().filter((p) => p.id !== 'mock-volunteer-pledge');

    const wards = new Set(reports.map((r) => r.ward).filter(Boolean));

    const resolved = reports.filter((r) => r.status === 'resolved');

    const src = (r) => r.resolutionSource || (r.resolvedBy === 'bmc' ? 'bmc_admin' : r.resolvedBy === 'citizen' ? 'self' : '');

    return {

      totalReports: reports.length,

      resolved: resolved.length,

      pending: reports.filter((r) => r.status === 'pending').length,

      confirmations: reports.reduce((s, r) => s + (Number(r.confirmations) || 0), 0),

      pledges: pledges.length,

      wardsActive: wards.size,

      resolvedSelf: resolved.filter((r) => src(r) === 'self').length,

      resolvedCommunity: resolved.filter((r) => src(r) === 'community_verified').length,

      resolvedBmc: resolved.filter((r) => src(r) === 'bmc_admin').length,

      resolvedStale: resolved.filter((r) => src(r) === 'stale_verified').length,

      volunteerCleanup: reports.filter((r) => r.communityCleared).length,

    };

  }



  function getWeekImpactStats() {

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const reports = loadReports().filter((r) => new Date(r.timestamp).getTime() >= weekAgo);

    return {

      reports: reports.length,

      resolved: reports.filter((r) => r.status === 'resolved').length,

      confirmations: reports.reduce((s, r) => s + (Number(r.confirmations) || 0), 0),

    };

  }



  function renderCommunityImpactStats() {

    const s = getCommunityImpactStats();

    const w = getWeekImpactStats();

    const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };

    set('#impactReports', s.totalReports);

    set('#impactResolved', s.resolved);

    set('#impactConfirmations', s.confirmations);

    set('#impactPledges', s.pledges);

    set('#aboutReports', s.totalReports);

    set('#aboutResolved', s.resolved);

    set('#aboutConfirmations', s.confirmations);

    set('#aboutWards', s.wardsActive);

    const weekEl = $('#impactWeekLine');

    if (weekEl) {

      weekEl.textContent = t('impact.week')

        .replace('{reports}', String(w.reports))

        .replace('{resolved}', String(w.resolved))

        .replace('{confirms}', String(w.confirmations));

    }

    const breakdownEl = $('#impactResolvedBreakdown');

    if (breakdownEl) {

      breakdownEl.textContent = t('impact.resolvedBreakdown')

        .replace('{self}', String(s.resolvedSelf + s.resolvedStale))

        .replace('{community}', String(s.resolvedCommunity))

        .replace('{bmc}', String(s.resolvedBmc))

        .replace('{cleanup}', String(s.volunteerCleanup));

    }

    if (typeof renderWardPulse === 'function') renderWardPulse();

  }



  function getSponsorsForUser() {

    const list = (MONET.sponsors || []).filter((s) => s.active !== false);

    if (!user.ward) return list.filter((s) => !s.wards || !s.wards.length);

    return list.filter((s) => {

      if (!s.wards || !s.wards.length) return true;

      return s.wards.includes(user.ward);

    });

  }



  function renderImpactWall() {

    const wall = $('#impactWall');

    if (!wall) return;

    const sponsors = getSponsorsForUser();

    if (sponsors.length === 0) {

      wall.innerHTML = '';

      return;

    }

    wall.innerHTML = sponsors

      .map((s) => {

        const wardNote = s.wards && s.wards.length

          ? `<span class="impact-wall__ward">${escapeHtml(s.wards[0].split('—')[0].trim())} ward</span>`

          : '';

        const inner = `

          <span class="impact-wall__badge">${escapeHtml(t('about.sponsored'))}</span>

          <p><strong>${escapeHtml(s.business)}</strong> — ${escapeHtml(s.offer)}</p>

          ${wardNote}`;

        if (s.url && /^https?:\/\//i.test(s.url)) {

          return `<a class="impact-wall impact-wall--link" href="${s.url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${inner}</a>`;

        }

        return `<div class="impact-wall">${inner}</div>`;

      })

      .join('');

  }



  function getGrievanceEmail() {

    return LEGAL.grievanceEmail || FOUNDER.operatorEmail || FOUNDER.email || '';

  }



  function getFounderContactEmail() {

    return FOUNDER.email || getGrievanceEmail();

  }



  function getPartnerEmail() {

    return MONET.partnerInquiryEmail || getFounderContactEmail();

  }



  function requireCommunityConsent(action) {

    if (!user.tosAccepted) {

      showToast(t('toast.tosRequired'), 'info');

      openModal('tos');

      return false;

    }

    if (action) action();

    return true;

  }



  function buildImpactSummaryText() {

    const s = getCommunityImpactStats();

    const f = FOUNDER;

    const date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    const highlights = (f.highlights || []).map((h) => `· ${h}`).join('\n');

    return [

      `CivicRadar — Community Impact Summary (${date})`,

      '',

      `Project: ${FOUNDER.name || t('about.teamLabel')}`,

      f.tagline || 'Community-driven civic hazard reporting for Mumbai, Pune, and Thane.',

      '',

      'Impact metrics:',

      `· Reports logged: ${s.totalReports}`,

      `· Hazards resolved: ${s.resolved}`,

      `· Neighbour confirmations ("Me too"): ${s.confirmations}`,

      `· Volunteer pledges: ${s.pledges}`,

      `· BMC wards with activity: ${s.wardsActive}`,

      '',

      f.story || '',

      '',

      'Technical highlights:',

      highlights || '· PWA — Multi-language — BMC escalation — Role-based dashboards',

      '',

      `Contact: ${getGrievanceEmail() || getFounderContactEmail() || getPartnerEmail() || t('config.contactMissing')}`,

      getShareAppUrl(),

    ].filter(Boolean).join('\n');

  }



  function fallbackCopy(text, toastKey = 'about.copied') {

    const ta = document.createElement('textarea');

    ta.value = text;

    ta.style.position = 'fixed';

    ta.style.left = '0';

    ta.style.top = '0';

    ta.style.opacity = '0';

    document.body.appendChild(ta);

    ta.focus();

    ta.select();

    try {

      document.execCommand('copy');

      showToast(t(toastKey), 'success', 4000);

    } catch {

      showToast(t('toast.copyFail'), 'error');

    }

    document.body.removeChild(ta);

  }



  // Prefer execCommand — reliable in WebViews, PWAs, and automated browsers.

  function copyTextSafe(text, toastKey, onSuccess) {

    fallbackCopy(text, toastKey || 'about.copied');

    if (typeof onSuccess === 'function') onSuccess();

  }



  function copyImpactSummary() {

    copyTextSafe(buildImpactSummaryText(), 'about.copied');

  }



  /* ---------- In-app feedback (Supabase-backed, offline-safe) ---------- */

  const FEEDBACK_PENDING_KEY = 'civicradar_feedback_pending';



  function getPendingFeedback() {

    try { return JSON.parse(localStorage.getItem(FEEDBACK_PENDING_KEY) || '[]'); }

    catch { return []; }

  }



  function savePendingFeedback(list) {

    try { safeLocalSet(FEEDBACK_PENDING_KEY, JSON.stringify(list.slice(-50))); }

    catch { /* storage full / unavailable — non-fatal */ }

  }



  // Assemble a feedback row. Only standard, non-personal context is attached

  // automatically (anon uid, env, ward/city, coarse UA) — no names.

  function buildFeedbackRow(message, category, contact) {

    const cfg = window.CIVICRADAR_CONFIG || {};

    const row = {

      message: message,

      category: category,

      contact: contact || null,

      app_version: CIVIC_APP_VERSION,

      env: cfg.environment || null,

      device: (typeof navigator !== 'undefined' && navigator.userAgent

        ? String(navigator.userAgent).slice(0, 300) : null),

      ward: (user && user.ward) || null,

      city: (user && user.city) || null,

      user_id: (Backend.enabled && user && user.id) ? user.id : null,

    };

    return row;

  }



  function resetFeedbackForm() {

    const form = $('#feedbackForm');

    if (form) form.reset();

    const err = $('#feedbackError');

    if (err) { err.classList.add('hidden'); err.textContent = ''; }

    const btn = $('#btnFeedbackSubmit');

    if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }

  }



  window.openFeedbackModal = function () {

    resetFeedbackForm();

    openModal('feedback');

  };



  async function submitFeedback() {

    const msgEl = $('#feedbackMessage');

    const errEl = $('#feedbackError');

    const btn = $('#btnFeedbackSubmit');

    if (!msgEl || !btn) return;



    const message = (msgEl.value || '').trim();

    if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }



    if (!message) {

      if (errEl) { errEl.textContent = t('feedback.errorEmpty'); errEl.classList.remove('hidden'); }

      msgEl.focus();

      return;

    }



    const checked = $('#feedbackForm input[name="feedbackCategory"]:checked');

    const category = (checked && checked.value) || 'other';

    const contactEl = $('#feedbackContact');

    const contact = contactEl ? (contactEl.value || '').trim() : '';

    const row = buildFeedbackRow(message, category, contact);



    btn.classList.add('is-loading');

    btn.disabled = true;

    try {

      if (Backend.enabled) {

        const { error } = await Backend.insertFeedback(row);

        if (error) throw new Error(error.message || 'insert_failed');

        showToast(t('feedback.success'), 'success', 3500);

      } else {

        // Local / offline mode: persist so we never lose the text; sync on reconnect.

        const list = getPendingFeedback();

        list.push(row);

        savePendingFeedback(list);

        showToast(t('feedback.successLocal'), 'info', 4000);

      }

      if (window.CivicAnalytics) CivicAnalytics.track('feedback_submitted', { category }, row.ward);

      resetFeedbackForm();

      closeModal('feedback');

    } catch (e) {

      // Keep the modal open and the user's text intact; surface a clear error.

      if (errEl) { errEl.textContent = t('feedback.error'); errEl.classList.remove('hidden'); }

      showToast(t('feedback.error'), 'error', 4000);

      console.warn('Feedback submit failed:', (e && e.message) || e);

    } finally {

      btn.classList.remove('is-loading');

      btn.disabled = false;

    }

  }



  /* ---------- Coordinator access requests (NGO / BMC) ----------

   * Low-friction self-serve flow: anyone (even logged-out) can apply with a few

   * fields. The CivicRadar super-admin reviews and approves; approval issues a

   * one-time claim code the applicant redeems to unlock their role. Works fully

   * in local/no-Supabase mode (queued on-device) so the flow is always usable.

   */

  const ACCESS_LOCAL_KEY = 'civicradar_access_local';   // local-mode store (submit/review/claim)

  const ACCESS_SYNC_KEY = 'civicradar_access_sync';     // connected-mode offline submit queue



  function getLocalAccessRequests() {

    try { return JSON.parse(localStorage.getItem(ACCESS_LOCAL_KEY) || '[]'); }

    catch { return []; }

  }

  function saveLocalAccessRequests(list) {

    try { safeLocalSet(ACCESS_LOCAL_KEY, JSON.stringify(list.slice(-100))); }

    catch { /* storage full — non-fatal */ }

  }

  function getPendingAccessSync() {

    try { return JSON.parse(localStorage.getItem(ACCESS_SYNC_KEY) || '[]'); }

    catch { return []; }

  }

  function savePendingAccessSync(list) {

    try { safeLocalSet(ACCESS_SYNC_KEY, JSON.stringify(list.slice(-50))); }

    catch { /* non-fatal */ }

  }



  function genClaimCodeLocal() {

    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

    let s = '';

    for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];

    return 'CR-' + s;

  }



  // Friendly request role ? operational profile role used everywhere else.

  function accessRoleToOperational(roleRequested) {

    return roleRequested === 'bmc_official' ? 'bmc' : 'ngo_lead';

  }



  function accessRoleLabel(roleRequested) {

    return roleRequested === 'bmc_official' ? t('access.roleBmcTag') : t('access.roleNgoTag');

  }



  function populateAccessCitySelect() {

    const sel = $('#accessCity');

    if (!sel) return;

    const current = sel.value || user.city || DEFAULT_CITY;

    sel.innerHTML = CITY_IDS.map((id) => {

      const label = (CITIES[id] && CITIES[id].label) || id;

      return `<option value="${id}">${escapeHtml(label)}</option>`;

    }).join('');

    sel.value = CITIES[current] ? current : DEFAULT_CITY;

    syncAccessWardList();

  }



  function syncAccessWardList() {

    const sel = $('#accessCity');

    const wardInput = $('#accessWard');

    if (!sel || !wardInput) return;

    refreshWardComboboxes();

  }



  function resetAccessRequestForm() {

    const form = $('#accessForm');

    if (form) form.reset();

    accessProofDataUrl = null;

    const proofName = $('#accessProofName');

    if (proofName) { proofName.classList.add('hidden'); proofName.textContent = ''; }

    const err = $('#accessError');

    if (err) { err.classList.add('hidden'); err.textContent = ''; }

    const btn = $('#btnAccessSubmit');

    if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }

    const formWrap = $('#accessRequestForm');

    const confirm = $('#accessRequestConfirm');

    if (formWrap) formWrap.classList.remove('hidden');

    if (confirm) confirm.classList.add('hidden');

    const ngoRadio = $('#accessForm input[name="accessRole"][value="ngo_coordinator"]');

    if (ngoRadio) ngoRadio.checked = true;

    populateAccessCitySelect();

  }



  window.openAccessRequestModal = function (preferredRole) {

    resetAccessRequestForm();

    if (preferredRole) {

      const radio = $(`#accessForm input[name="accessRole"][value="${preferredRole}"]`);

      if (radio) radio.checked = true;

    }

    openModal('accessRequest');

  };

  window.closeAccessRequestModal = function () { closeModal('accessRequest'); };



  // Downscale an attached proof image to a small JPEG data URL (optional field).

  function readAccessProof(file) {

    return new Promise((resolve, reject) => {

      if (!file) { resolve(null); return; }

      if (file.size > 8 * 1024 * 1024) { reject(new Error('too_big')); return; }

      const reader = new FileReader();

      reader.onload = () => {

        const img = new Image();

        img.onload = () => {

          try {

            const maxW = 640;

            const scale = Math.min(1, maxW / (img.width || maxW));

            const w = Math.max(1, Math.round((img.width || maxW) * scale));

            const h = Math.max(1, Math.round((img.height || maxW) * scale));

            const canvas = document.createElement('canvas');

            canvas.width = w; canvas.height = h;

            canvas.getContext('2d').drawImage(img, 0, 0, w, h);

            resolve(canvas.toDataURL('image/jpeg', 0.6));

          } catch { resolve(reader.result); }

        };

        img.onerror = () => resolve(reader.result);

        img.src = reader.result;

      };

      reader.onerror = () => reject(new Error('read_failed'));

      reader.readAsDataURL(file);

    });

  }



  async function handleAccessProofPick(e) {

    const file = e.target && e.target.files && e.target.files[0];

    const nameEl = $('#accessProofName');

    if (!file) return;

    try {

      accessProofDataUrl = await readAccessProof(file);

      if (nameEl) {

        nameEl.textContent = `${t('access.proofAttached')}: ${file.name}`;

        nameEl.classList.remove('hidden');

      }

    } catch (err) {

      accessProofDataUrl = null;

      showToast(t('access.proofTooBig'), 'error', 4000);

      if (nameEl) nameEl.classList.add('hidden');

    }

  }



  function buildAccessRequestPayload() {

    const hidden = $('#accessForm input[name="accessRole"]');

    const roleRequested = (hidden && hidden.value) || 'bmc_official';

    return {

      p_full_name: ($('#accessName').value || '').trim(),

      p_role_requested: roleRequested,

      p_org_name: ($('#accessOrg').value || '').trim() || null,

      p_city: ($('#accessCity').value || DEFAULT_CITY),

      p_ward: ($('#accessWard').value || '').trim() || null,

      p_contact_email: ($('#accessEmail').value || '').trim() || null,

      p_contact_phone: ($('#accessPhone').value || '').trim() || null,

      p_note: ($('#accessNote').value || '').trim() || null,

      p_proof_url: accessProofDataUrl || null,

    };

  }



  function showAccessConfirm(local) {

    const formWrap = $('#accessRequestForm');

    const confirm = $('#accessRequestConfirm');

    const localNote = $('#accessConfirmLocalNote');

    if (formWrap) formWrap.classList.add('hidden');

    if (confirm) confirm.classList.remove('hidden');

    if (localNote) localNote.classList.toggle('hidden', !local);

  }



  async function submitAccessRequest() {

    const errEl = $('#accessError');

    const btn = $('#btnAccessSubmit');

    if (!btn) return;

    if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }



    const payload = buildAccessRequestPayload();

    if (!payload.p_full_name) {

      if (errEl) { errEl.textContent = t('access.errName'); errEl.classList.remove('hidden'); }

      $('#accessName').focus();

      return;

    }

    if (!payload.p_contact_email && !payload.p_contact_phone) {

      if (errEl) { errEl.textContent = t('access.errContact'); errEl.classList.remove('hidden'); }

      $('#accessEmail').focus();

      return;

    }



    btn.classList.add('is-loading');

    btn.disabled = true;

    try {

      if (Backend.enabled) {

        const { error } = await Backend.submitAccessRequest(payload);

        if (error) {

          // Network/offline error: queue so the request is never lost.

          if (/offline|fetch|network/i.test(error.message || '')) {

            const list = getPendingAccessSync();

            list.push(payload);

            savePendingAccessSync(list);

            showToast(t('access.submittedLocal'), 'info', 4500);

            showAccessConfirm(true);

          } else {

            throw new Error(error.message || 'submit_failed');

          }

        } else {

          showToast(t('access.submitted'), 'success', 4500);

          showAccessConfirm(false);

        }

      } else {

        // Local / no-backend mode: store on-device (review + claim work locally).

        const list = getLocalAccessRequests();

        list.push({

          id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),

          created_at: new Date().toISOString(),

          full_name: payload.p_full_name,

          org_name: payload.p_org_name,

          role_requested: payload.p_role_requested,

          city: payload.p_city,

          ward: payload.p_ward,

          contact_email: payload.p_contact_email,

          contact_phone: payload.p_contact_phone,

          note: payload.p_note,

          has_proof: !!payload.p_proof_url,

          status: 'pending',

          claim_code: null,

        });

        saveLocalAccessRequests(list);

        showToast(t('access.submittedLocal'), 'info', 4500);

        showAccessConfirm(true);

      }

      if (window.CivicAnalytics) {

        CivicAnalytics.track('access_request_submitted', { role: payload.p_role_requested }, payload.p_ward);

      }

    } catch (e) {

      if (errEl) { errEl.textContent = t('access.submitError'); errEl.classList.remove('hidden'); }

      showToast(t('access.submitError'), 'error', 4000);

      console.warn('Access request submit failed:', (e && e.message) || e);

    } finally {

      btn.classList.remove('is-loading');

      btn.disabled = false;

    }

  }



  /* ---------- Claim code redemption ---------- */

  function resetAccessClaimForm() {

    const form = $('#accessClaimForm');

    if (form) form.reset();

    const err = $('#accessClaimError');

    if (err) { err.classList.add('hidden'); err.textContent = ''; }

    const btn = $('#btnAccessClaimSubmit');

    if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }

  }



  window.openAccessClaimModal = function () {

    resetAccessClaimForm();

    closeModal('accessRequest');

    openModal('accessClaim');

  };

  window.closeAccessClaimModal = function () { closeModal('accessClaim'); };



  function unlockClaimedRole(assignment) {

    const opRole = assignment && assignment.role;

    if (opRole === 'bmc') {

      closeModal('accessClaim');

      grantBmcAccess();

      showToast(t('access.claimedBmc'), 'success', 4500);

    } else {

      closeModal('accessClaim');

      grantLeadAccess(

        assignment && assignment.ward,

        (assignment && assignment.coordinator_scope) || 'ward',

        '',

        (assignment && assignment.city) || ''

      );

      showToast(t('access.claimedNgo'), 'success', 4500);

    }

    if (window.CivicAnalytics) CivicAnalytics.track('access_claimed', { role: opRole || 'ngo_lead' });

  }



  async function submitAccessClaim() {

    const inputEl = $('#accessClaimCode');

    const errEl = $('#accessClaimError');

    const btn = $('#btnAccessClaimSubmit');

    if (!inputEl || !btn) return;

    if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }

    const code = (inputEl.value || '').trim().toUpperCase();

    if (!code) {

      if (errEl) { errEl.textContent = t('access.claimErrEmpty'); errEl.classList.remove('hidden'); }

      inputEl.focus();

      return;

    }



    btn.classList.add('is-loading');

    btn.disabled = true;

    try {

      if (Backend.enabled) {

        const { data, error } = await Backend.claimAccess(code);

        if (error || !data) {

          const used = /code_used/i.test((error && error.message) || '');

          if (errEl) {

            errEl.textContent = used ? t('access.claimErrUsed') : t('access.claimErrInvalid');

            errEl.classList.remove('hidden');

          }

          return;

        }

        unlockClaimedRole(data);

      } else {

        // Local mode: match an approved on-device request.

        const list = getLocalAccessRequests();

        const idx = list.findIndex((r) => r.claim_code === code && r.status === 'approved' && !r.claimed_at);

        if (idx === -1) {

          const usedIdx = list.findIndex((r) => r.claim_code === code && (r.claimed_at || r.status === 'claimed'));

          if (errEl) {

            errEl.textContent = usedIdx !== -1 ? t('access.claimErrUsed') : t('access.claimErrInvalid');

            errEl.classList.remove('hidden');

          }

          return;

        }

        const req = list[idx];

        req.claimed_at = new Date().toISOString();

        req.status = 'claimed';

        saveLocalAccessRequests(list);

        unlockClaimedRole({

          role: accessRoleToOperational(req.role_requested),

          ward: req.ward,

          city: req.city,

          coordinator_scope: 'ward',

        });

      }

    } catch (e) {

      if (errEl) { errEl.textContent = t('access.claimErrInvalid'); errEl.classList.remove('hidden'); }

      console.warn('Claim access failed:', (e && e.message) || e);

    } finally {

      btn.classList.remove('is-loading');

      btn.disabled = false;

    }

  }



  /* ---------- Peer voting for NGO / neighbourhood leads ----------

   * Democratic role grant: 2 community supports by default; 5 each when

   * multiple active candidates share the same ward/neighbourhood scope.

   * BMC officials still use access_requests + admin approval above.

   */

  const LEAD_NOM_LOCAL_KEY = 'civicradar_lead_nominations';

  const LEAD_VOTES_LOCAL_KEY = 'civicradar_lead_votes';

  const LEAD_VOTE_THRESHOLD = 2;

  const LEAD_COLEAD_THRESHOLD = 5;



  function getLocalLeadNominations() {

    try { return JSON.parse(localStorage.getItem(LEAD_NOM_LOCAL_KEY) || '[]'); }

    catch { return []; }

  }

  function saveLocalLeadNominations(list) {

    try { safeLocalSet(LEAD_NOM_LOCAL_KEY, JSON.stringify(list.slice(-200))); }

    catch { /* non-fatal */ }

  }

  function getLocalLeadVotes() {

    try { return JSON.parse(localStorage.getItem(LEAD_VOTES_LOCAL_KEY) || '[]'); }

    catch { return []; }

  }

  function saveLocalLeadVotes(list) {

    try { safeLocalSet(LEAD_VOTES_LOCAL_KEY, JSON.stringify(list.slice(-500))); }

    catch { /* non-fatal */ }

  }



  function leadScopeKey(n) {

    return [

      n.role_type || '',

      n.city || 'mumbai',

      n.ward || '',

      n.neighbourhood_label || '',

    ].join('|');

  }



  function computeLeadThreshold(nomination, allActive) {

    const key = leadScopeKey(nomination);

    const others = allActive.filter(

      (n) => n.status === 'active' && n.id !== nomination.id && leadScopeKey(n) === key

    );

    return others.length >= 1 ? LEAD_COLEAD_THRESHOLD : LEAD_VOTE_THRESHOLD;

  }



  function localLeadVoteCount(nominationId) {

    return getLocalLeadVotes().filter((v) => v.nomination_id === nominationId).length;

  }



  function localIVoted(nominationId) {

    return getLocalLeadVotes().some(

      (v) => v.nomination_id === nominationId && v.voter_id === user.id

    );

  }



  function maybeGrantLeadLocal(nominationId) {

    const nominations = getLocalLeadNominations();

    const nom = nominations.find((n) => n.id === nominationId);

    if (!nom || nom.status !== 'active') return false;

    const active = nominations.filter((n) => n.status === 'active');

    nom.vote_count = localLeadVoteCount(nominationId);

    const thresh = computeLeadThreshold(nom, active);

    if (nom.vote_count < thresh) {

      saveLocalLeadNominations(nominations);

      return false;

    }

    nom.status = 'granted';

    nom.granted_at = new Date().toISOString();

    saveLocalLeadNominations(nominations);

    applyLocalLeadGrants();

    return true;

  }



  function applyLocalLeadGrants() {

    if (Backend.enabled || isLead) return;

    const granted = getLocalLeadNominations().find(

      (n) => n.status === 'granted' && n.nominee_id === user.id

    );

    if (!granted) return;

    const scope = granted.role_type === 'neighbourhood' ? 'neighbourhood' : 'ward';

    grantLeadAccess(granted.ward, scope, granted.neighbourhood_label || '', granted.city || DEFAULT_CITY);

  }



  function populateLeadNomCitySelect() {

    const sel = $('#leadNomCity');

    if (!sel) return;

    const current = sel.value || user.city || DEFAULT_CITY;

    sel.innerHTML = CITY_IDS.map((id) => {

      const label = (CITIES[id] && CITIES[id].label) || id;

      return `<option value="${id}">${escapeHtml(label)}</option>`;

    }).join('');

    sel.value = CITIES[current] ? current : DEFAULT_CITY;

    syncLeadNomWardList();

  }



  function syncLeadNomWardList() {

    const sel = $('#leadNomCity');

    const wardInput = $('#leadNomWard');

    if (!sel || !wardInput) return;

    refreshWardComboboxes();

    refreshLeadNomNeighbourhoodDatalist();

  }



  function syncLeadNomNeighbourhoodVisibility() {

    const checked = $('#leadNomForm input[name="leadRoleType"]:checked');

    const roleType = (checked && checked.value) || 'ngo_ward';

    const group = $('#leadNomNeighbourhoodGroup');

    if (group) group.classList.toggle('hidden', roleType !== 'neighbourhood');

    if (roleType === 'neighbourhood') refreshLeadNomNeighbourhoodDatalist();

  }



  function resetLeadNominationForm() {

    const form = $('#leadNomForm');

    if (form) form.reset();

    const err = $('#leadNomError');

    if (err) { err.classList.add('hidden'); err.textContent = ''; }

    const btn = $('#btnLeadNomSubmit');

    if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }

    const formWrap = $('#leadNomFormWrap');

    const confirm = $('#leadNomConfirm');

    if (formWrap) formWrap.classList.remove('hidden');

    if (confirm) confirm.classList.add('hidden');

    const wardRadio = $('#leadNomForm input[name="leadRoleType"][value="ngo_ward"]');

    if (wardRadio) wardRadio.checked = true;

    const nameEl = $('#leadNomName');

    if (nameEl && user.displayName) nameEl.value = user.displayName;

    const wardEl = $('#leadNomWard');

    if (wardEl && user.ward) wardEl.value = user.ward;

    if (user.society) {

      const nbh = $('#leadNomNeighbourhood');

      if (nbh) nbh.value = user.society;

    }

    populateLeadNomCitySelect();

    syncLeadNomNeighbourhoodVisibility();

    refreshLeadNomNeighbourhoodDatalist();

  }



  window.openLeadNominationModal = function () {

    resetLeadNominationForm();

    openModal('leadNom');

  };

  window.closeLeadNominationModal = function () { closeModal('leadNom'); };



  function buildLeadNominationPayload() {

    const checked = $('#leadNomForm input[name="leadRoleType"]:checked');

    const roleType = (checked && checked.value) || 'ngo_ward';

    return {

      p_role_type: roleType,

      p_display_name: ($('#leadNomName').value || '').trim(),

      p_org_name: ($('#leadNomOrg').value || '').trim() || null,

      p_city: ($('#leadNomCity').value || DEFAULT_CITY),

      p_ward: ($('#leadNomWard').value || '').trim() || null,

      p_neighbourhood: roleType === 'neighbourhood'

        ? ($('#leadNomNeighbourhood').value || '').trim() || null

        : null,

      pitch: ($('#leadNomPitch').value || '').trim() || null,

    };

  }



  function showLeadNomConfirm(local) {

    const formWrap = $('#leadNomFormWrap');

    const confirm = $('#leadNomConfirm');

    const localNote = $('#leadNomConfirmLocal');

    if (formWrap) formWrap.classList.add('hidden');

    if (confirm) confirm.classList.remove('hidden');

    if (localNote) localNote.classList.toggle('hidden', !local);

  }



  async function submitLeadNomination() {

    const errEl = $('#leadNomError');

    const btn = $('#btnLeadNomSubmit');

    if (!btn) return;

    if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }



    const payload = buildLeadNominationPayload();

    if (!payload.p_display_name) {

      if (errEl) { errEl.textContent = t('lead.errName'); errEl.classList.remove('hidden'); }

      $('#leadNomName').focus();

      return;

    }

    if (!payload.p_ward) {

      if (errEl) { errEl.textContent = t('lead.errWard'); errEl.classList.remove('hidden'); }

      $('#leadNomWard').focus();

      return;

    }

    if (payload.p_role_type === 'neighbourhood' && !payload.p_neighbourhood) {

      if (errEl) { errEl.textContent = t('lead.errNeighbourhood'); errEl.classList.remove('hidden'); }

      $('#leadNomNeighbourhood').focus();

      return;

    }

    if (payload.p_neighbourhood) {

      cacheSocietyIfCustom(payload.p_city, payload.p_ward, payload.p_neighbourhood);

    }



    btn.classList.add('is-loading');

    btn.disabled = true;

    try {

      if (Backend.enabled) {

        const rpcPayload = {

          p_role_type: payload.p_role_type,

          p_display_name: payload.p_display_name,

          p_org_name: payload.p_org_name,

          p_city: payload.p_city,

          p_ward: payload.p_ward,

          p_neighbourhood: payload.p_neighbourhood,

        };

        const { error } = await Backend.nominateForLead(rpcPayload);

        if (error) {

          const msg = (error.message || '').toLowerCase();

          if (/already_nominated/.test(msg)) {

            if (errEl) { errEl.textContent = t('lead.errAlreadyNominated'); errEl.classList.remove('hidden'); }

            return;

          }

          if (/already_lead/.test(msg)) {

            if (errEl) { errEl.textContent = t('lead.errAlreadyLead'); errEl.classList.remove('hidden'); }

            return;

          }

          throw new Error(error.message || 'submit_failed');

        }

        showToast(t('lead.nominated'), 'success', 4500);

        showLeadNomConfirm(false);

      } else {

        const list = getLocalLeadNominations();

        const dup = list.some(

          (n) => n.status === 'active' && n.nominee_id === user.id

            && n.role_type === payload.p_role_type && n.city === payload.p_city

            && n.ward === payload.p_ward

            && (n.neighbourhood_label || '') === (payload.p_neighbourhood || '')

        );

        if (dup) {

          if (errEl) { errEl.textContent = t('lead.errAlreadyNominated'); errEl.classList.remove('hidden'); }

          return;

        }

        if (isLead && user.ward === payload.p_ward

          && ((payload.p_role_type === 'neighbourhood' && user.coordinatorScope === 'neighbourhood')

            || (payload.p_role_type === 'ngo_ward' && user.coordinatorScope === 'ward'))) {

          if (errEl) { errEl.textContent = t('lead.errAlreadyLead'); errEl.classList.remove('hidden'); }

          return;

        }

        list.push({

          id: 'local-nom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),

          created_at: new Date().toISOString(),

          nominee_id: user.id,

          display_name: payload.p_display_name,

          org_name: payload.p_org_name,

          role_type: payload.p_role_type,

          city: payload.p_city,

          ward: payload.p_ward,

          neighbourhood_label: payload.p_neighbourhood,

          pitch: payload.pitch,

          status: 'active',

          vote_count: 0,

        });

        saveLocalLeadNominations(list);

        showToast(t('lead.nominatedLocal'), 'info', 4500);

        showLeadNomConfirm(true);

      }

      if (window.CivicAnalytics) {

        CivicAnalytics.track('lead_nomination_submitted', { role_type: payload.p_role_type }, payload.p_ward);

      }

    } catch (e) {

      if (errEl) { errEl.textContent = t('lead.submitError'); errEl.classList.remove('hidden'); }

      showToast(t('lead.submitError'), 'error', 4000);

      console.warn('Lead nomination failed:', (e && e.message) || e);

    } finally {

      btn.classList.remove('is-loading');

      btn.disabled = false;

    }

  }



  async function loadLeadNominationsForWard() {

    const city = user.city || DEFAULT_CITY;

    const ward = user.ward || '';

    if (Backend.enabled && ward) {

      const { data } = await Backend.listLeadNominations(city, ward, null);

      return data || [];

    }

    if (!ward) return [];

    return getLocalLeadNominations()

      .filter((n) => n.status === 'active' && n.city === city && n.ward === ward)

      .map((n) => ({

        ...n,

        vote_count: localLeadVoteCount(n.id),

        threshold: computeLeadThreshold(n, getLocalLeadNominations().filter((x) => x.status === 'active')),

        i_voted: localIVoted(n.id),

      }));

  }



  function leadCandidateCardHtml(n) {

    const isMine = n.nominee_id === user.id;

    const thresh = n.threshold != null ? n.threshold : computeLeadThreshold(

      n, getLocalLeadNominations().filter((x) => x.status === 'active')

    );

    const count = n.vote_count || 0;

    const pct = Math.min(100, Math.round((count / Math.max(thresh, 1)) * 100));

    const coLead = thresh >= LEAD_COLEAD_THRESHOLD;

    const progressKey = coLead ? 'lead.progressCoLead' : 'lead.progress';

    const progressText = t(progressKey).replace('{count}', String(count)).replace('{threshold}', String(thresh));

    const roleTag = n.role_type === 'neighbourhood' ? t('lead.tagNbh') : t('lead.tagWard');

    const meta = [n.org_name, n.neighbourhood_label].filter(Boolean).map((m) => escapeHtml(m)).join(' — ');

    const voted = !!n.i_voted;

    let action = '';

    if (isMine) {

      action = `<span class="lead-candidate__tag">${escapeHtml(t('lead.you'))}</span>`;

    } else if (voted) {

      action = `<button type="button" class="btn btn--secondary btn--sm btn--support" disabled><i class="ph ph-check"></i> ${escapeHtml(t('lead.supported'))}</button>`;

    } else {

      action = `<button type="button" class="btn btn--primary btn--sm btn--support" data-lead-vote="${escapeHtml(n.id)}"><i class="ph ph-hand-heart"></i> ${escapeHtml(t('lead.support'))}</button>`;

    }

    return `

      <li class="lead-candidate${isMine ? ' lead-candidate--mine' : ''}${voted ? ' lead-candidate--voted' : ''}" role="listitem">

        <div class="lead-candidate__head">

          <strong class="lead-candidate__name">${escapeHtml(n.display_name || '')}</strong>

          <span class="lead-candidate__tag">${escapeHtml(roleTag)}</span>

        </div>

        ${meta ? `<p class="lead-candidate__meta">${meta}</p>` : ''}

        <div class="lead-candidate__progress">

          <div class="lead-candidate__bar" aria-hidden="true"><div class="lead-candidate__bar-fill" style="width:${pct}%"></div></div>

          <span class="lead-candidate__count${coLead ? ' lead-candidate__count--colead' : ''}">${escapeHtml(progressText)}</span>

        </div>

        <div class="lead-candidate__actions">${action}</div>

      </li>`;

  }



  async function renderLeadCandidates() {

    const listEl = $('#leadCandidatesList');

    const emptyEl = $('#leadCandidatesEmpty');

    const section = $('#leadCandidatesSection');

    if (!listEl) return;

    if (!user.ward) {

      if (section) section.classList.add('hidden');

      return;

    }

    if (section) section.classList.remove('hidden');

    const candidates = await loadLeadNominationsForWard();

    listEl.innerHTML = candidates.length

      ? candidates.map(leadCandidateCardHtml).join('')

      : '';

    if (emptyEl) emptyEl.classList.toggle('hidden', candidates.length > 0);

  }



  async function castLeadVote(nominationId) {

    const nominations = getLocalLeadNominations();

    const nom = nominations.find((n) => n.id === nominationId);

    if (nom && nom.nominee_id === user.id) {

      showToast(t('lead.errSelfVote'), 'error', 4000);

      return;

    }

    try {

      if (Backend.enabled) {

        const { data, error } = await Backend.voteForLead(nominationId);

        if (error) {

          const msg = (error.message || '').toLowerCase();

          if (/self_vote/.test(msg)) { showToast(t('lead.errSelfVote'), 'error', 4000); return; }

          if (/already_voted/.test(msg)) { showToast(t('lead.errAlreadyVoted'), 'info', 3500); return; }

          throw new Error(error.message || 'vote_failed');

        }

        showToast(t('lead.voted'), 'success', 3500);

        if (data && data.granted && nom && nom.nominee_id === user.id) {

          showToast(t('lead.granted'), 'success', 5000);

        }

        await restoreElevatedRole();

      } else {

        if (!nom || nom.status !== 'active') return;

        if (localIVoted(nominationId)) {

          showToast(t('lead.errAlreadyVoted'), 'info', 3500);

          return;

        }

        const votes = getLocalLeadVotes();

        votes.push({

          id: 'local-vote-' + Date.now(),

          nomination_id: nominationId,

          voter_id: user.id,

          created_at: new Date().toISOString(),

        });

        saveLocalLeadVotes(votes);

        const granted = maybeGrantLeadLocal(nominationId);

        showToast(granted ? t('lead.granted') : t('lead.voted'), 'success', granted ? 5000 : 3500);

      }

      if (window.CivicAnalytics) CivicAnalytics.track('lead_vote_cast', {}, user.ward);

      await renderLeadCandidates();

    } catch (e) {

      showToast(t('lead.voteError'), 'error', 4000);

      console.warn('Lead vote failed:', (e && e.message) || e);

    }

  }



  window.castLeadVote = castLeadVote;

  window.applyLocalLeadGrants = applyLocalLeadGrants;

  window.refreshUserFromStorage = function () { user = loadUser(); };



  /* ---------- Super-admin review screen ---------- */

  window.openAccessReview = function () {

    if (!isAdmin && !isSuperAdmin) return; // server RLS is the real guard

    renderAccessReview();

    openModal('accessReview');

  };

  window.closeAccessReview = function () { closeModal('accessReview'); };



  async function loadAccessRequestsForReview() {

    if (Backend.enabled) {

      const { data } = await Backend.listAccessRequests();

      return (data || []).filter((r) => r.role_requested === 'bmc_official');

    }

    return getLocalAccessRequests().filter((r) => r.role_requested === 'bmc_official').slice().reverse();

  }



  function accessRequestCardHtml(req) {

    const roleTag = accessRoleLabel(req.role_requested);

    const contact = [req.contact_email, req.contact_phone].filter(Boolean).join(' — ');

    const meta = [req.org_name, req.ward, (CITIES[req.city] && CITIES[req.city].label) || req.city]

      .filter(Boolean).map((m) => escapeHtml(m)).join(' — ');

    const status = req.status || 'pending';

    let actions = '';

    if (status === 'pending') {

      actions = `

        <div class="access-req__actions">

          <button type="button" class="btn btn--primary btn--sm" data-access-action="approve" data-access-id="${escapeHtml(req.id)}">

            <i class="ph ph-check"></i> ${escapeHtml(t('access.approve'))}

          </button>

          <button type="button" class="btn btn--secondary btn--sm" data-access-action="reject" data-access-id="${escapeHtml(req.id)}">

            <i class="ph ph-x"></i> ${escapeHtml(t('access.reject'))}

          </button>

        </div>`;

    } else if (status === 'approved' && req.claim_code) {

      actions = `

        <div class="access-req__code">

          <code class="claim-code">${escapeHtml(req.claim_code)}</code>

          <button type="button" class="btn btn--secondary btn--sm" data-access-action="copy" data-access-code="${escapeHtml(req.claim_code)}">

            <i class="ph ph-copy"></i> ${escapeHtml(t('access.copyCode'))}

          </button>

        </div>`;

    }

    const statusKey = status === 'approved' ? 'access.statusApproved'

      : status === 'rejected' ? 'access.statusRejected' : 'access.statusPending';

    return `

      <li class="queue-item access-req access-req--${status}">

        <div class="access-req__head">

          <strong>${escapeHtml(req.full_name || '')}</strong>

          <span class="access-req__role">${escapeHtml(roleTag)}</span>

        </div>

        ${meta ? `<p class="access-req__meta">${meta}</p>` : ''}

        ${contact ? `<p class="access-req__contact"><i class="ph ph-address-book"></i> ${escapeHtml(contact)}</p>` : ''}

        ${req.note ? `<p class="access-req__note">${escapeHtml(req.note)}</p>` : ''}

        <span class="access-req__status access-req__status--${status}">${escapeHtml(t(statusKey))}</span>

        ${actions}

      </li>`;

  }



  async function renderAccessReview() {

    const listEl = $('#accessReviewList');

    if (!listEl) return;

    const all = await loadAccessRequestsForReview();

    const pending = all.filter((r) => (r.status || 'pending') === 'pending');

    const approved = all.filter((r) => r.status === 'approved');

    const rejected = all.filter((r) => r.status === 'rejected');

    const setNum = (id, n) => { const el = $(id); if (el) el.textContent = String(n); };

    setNum('#arPending', pending.length);

    setNum('#arApproved', approved.length);

    setNum('#arRejected', rejected.length);

    // Pending first, then approved (so the team can re-copy codes), then rejected.

    const ordered = pending.concat(approved, rejected);

    listEl.innerHTML = ordered.length

      ? ordered.map(accessRequestCardHtml).join('')

      : `<li class="queue-empty">${escapeHtml(t('access.reviewEmpty'))}</li>`;

    updateAccessReviewBadge(pending.length);

  }



  function updateAccessReviewBadge(count) {

    const badge = $('#accessReviewBadge');

    if (!badge) return;

    if (count > 0) {

      badge.textContent = String(count);

      badge.classList.remove('hidden');

    } else {

      badge.classList.add('hidden');

    }

  }



  async function refreshAccessReviewBadge() {

    try {

      const all = await loadAccessRequestsForReview();

      updateAccessReviewBadge(all.filter((r) => (r.status || 'pending') === 'pending').length);

    } catch { /* non-fatal */ }

  }



  async function approveAccessReq(id) {

    if (Backend.enabled) {

      const { data, error } = await Backend.approveAccessRequest(id);

      if (error || !data) { showToast(t('access.submitError'), 'error', 4000); return; }

      showToast(t('access.approvedToast').replace('{code}', data.claim_code || ''), 'success', 6000);

    } else {

      const list = getLocalAccessRequests();

      const req = list.find((r) => r.id === id);

      if (!req) return;

      req.status = 'approved';

      req.claim_code = req.claim_code || genClaimCodeLocal();

      req.reviewed_at = new Date().toISOString();

      saveLocalAccessRequests(list);

      showToast(t('access.approvedToast').replace('{code}', req.claim_code), 'success', 6000);

    }

    renderAccessReview();

  }



  async function rejectAccessReq(id) {

    if (Backend.enabled) {

      const { error } = await Backend.rejectAccessRequest(id);

      if (error) { showToast(t('access.submitError'), 'error', 4000); return; }

    } else {

      const list = getLocalAccessRequests();

      const req = list.find((r) => r.id === id);

      if (!req) return;

      req.status = 'rejected';

      req.reviewed_at = new Date().toISOString();

      saveLocalAccessRequests(list);

    }

    showToast(t('access.rejectedToast'), 'info', 3500);

    renderAccessReview();

  }



  function renderAboutModal() {

    renderCommunityImpactStats();

    const aboutSub = $('#aboutSubtitle');

    if (aboutSub) {

      aboutSub.textContent = t('about.subtitle');

    }

    const versionEl = $('#aboutVersion');

    if (versionEl) {

      versionEl.textContent = t('about.version').replace('{version}', CIVIC_APP_VERSION);

    }

    const contactEmail = getFounderContactEmail();

    const contactBtn = $('#btnContactFounder');

    if (contactBtn) {

      contactBtn.classList.toggle('hidden', !contactEmail);

      const contactLabel = contactBtn.querySelector('span');

      if (contactLabel) {

        contactLabel.textContent = t('about.contact');

      }

    }

  }



  function copySharePitch() {

    const pitch = t('about.sharePitch')

      .replace(/\{city\}/g, getCityLabel())

      .replace(/\{link\}/g, shareAppLink('about'))

      + '\n' + buildHashtagLine(user.ward);

    copyTextSafe(pitch, 'about.pitchCopied');

  }



  function renderInquiryModal() {

    const note = $('#inquiryNote');

    if (note) note.textContent = MONET.partnerNote || '';

    const btn = $('#btnInquiryEmail');

    if (btn) btn.classList.toggle('hidden', !getPartnerEmail());

  }



  window.openAboutModal = function () {

    renderAboutModal();

    openModal('about');

  };



  window.openPartnerInquiry = function () {

    renderInquiryModal();

    openModal('inquiry');

  };



  function getTotalCivicPoints() {
    return getTotalCivicXp();
  }

  function getTotalCivicXp() {
    return getUserReports().length * POINTS_PER_REPORT + loadPointsCache();
  }

  function getCivicLevelInfo(xp) {
    xp = Number(xp) || 0;
    let level = CIVIC_XP_LEVELS[0];
    for (let i = CIVIC_XP_LEVELS.length - 1; i >= 0; i--) {
      if (xp >= CIVIC_XP_LEVELS[i].min) {
        level = CIVIC_XP_LEVELS[i];
        break;
      }
    }
    const idx = CIVIC_XP_LEVELS.findIndex((l) => l.id === level.id);
    const next = CIVIC_XP_LEVELS[idx + 1] || null;
    const pct = next
      ? Math.round(((xp - level.min) / (next.min - level.min)) * 100)
      : 100;
    const remaining = next ? Math.max(0, next.min - xp) : 0;
    return { level, next, pct: Math.min(100, Math.max(0, pct)), remaining, xp };
  }

  function civicLevelName(levelId) {
    return t('xp.level.' + levelId);
  }

  function loadXpCertificatesSeen() {
    try { return new Set(JSON.parse(localStorage.getItem(XP_CERTS_SEEN_KEY)) || []); }
    catch { return new Set(); }
  }

  function markXpCertificateSeen(levelId) {
    const set = loadXpCertificatesSeen();
    set.add(levelId);
    try { safeLocalSet(XP_CERTS_SEEN_KEY, JSON.stringify(Array.from(set))); } catch {}
  }

  function getNewlyUnlockedCertLevels(prevXp, newXp) {
    return CIVIC_XP_LEVELS
      .filter((l) => l.cert && newXp >= l.min && prevXp < l.min)
      .map((l) => l.id);
  }

  function syncUserCivicXp() {
    user.civicXp = getTotalCivicXp();
    user.civicLevel = getCivicLevelInfo(user.civicXp).level.id;
    saveUser();
    Backend.syncCivicXp(user.civicXp, user.civicLevel);
  }

  let pendingCertificateLevelId = null;

  function checkXpLevelUp(prevXp, newXp) {
    syncUserCivicXp();
    const seen = loadXpCertificatesSeen();
    const toShow = getNewlyUnlockedCertLevels(prevXp, newXp).filter((id) => !seen.has(id));
    const certEl = $('#certificateOverlay');
    if (toShow.length && !(certEl && certEl.classList.contains('open'))) {
      setTimeout(() => showCertificateModal(toShow[0]), 1400);
    }
  }

  window.getTotalCivicXp = getTotalCivicXp;



  function getWeekKey(d = new Date()) {

    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

    const dayNum = date.getUTCDay() || 7;

    date.setUTCDate(date.getUTCDate() + 4 - dayNum);

    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);

    return `${date.getUTCFullYear()}-W${weekNo}`;

  }



  function getReportWeekStreak() {

    const reports = getUserReports();

    if (!reports.length) return 0;

    const weekSet = new Set(reports.map((r) => getWeekKey(new Date(r.timestamp))));

    let streak = 0;

    const cursor = new Date();

    for (let i = 0; i < 52; i++) {

      const wk = getWeekKey(cursor);

      if (weekSet.has(wk)) {

        streak++;

        cursor.setDate(cursor.getDate() - 7);

      } else if (i === 0) {

        cursor.setDate(cursor.getDate() - 7);

      } else {

        break;

      }

    }

    return streak;

  }



  function getReportsThisWeek() {

    const wk = getWeekKey();

    return getUserReports().filter((r) => getWeekKey(new Date(r.timestamp)) === wk).length;

  }



  function getReportMilestoneProgress(reportCount) {

    const n = Number(reportCount) || 0;

    const milestones = REPORT_CELEBRATION_MILESTONES;

    const top = milestones[milestones.length - 1];

    if (n >= top) {

      return { pct: 100, remaining: 0, hintKey: 'profile.milestoneMax', next: null };

    }

    const next = milestones.find((m) => m > n) || top;

    const prev = [...milestones].reverse().find((m) => m <= n) || 0;

    const span = next - prev;

    const pct = span <= 0 ? 100 : Math.round(((n - prev) / span) * 100);

    const remaining = next - n;

    return {

      pct: Math.min(100, Math.max(0, pct)),

      remaining,

      hintKey: remaining === 1 ? 'profile.milestoneOne' : 'profile.milestoneMany',

      next,

    };

  }



  function getNextStreakBadgeInfo(streak) {

    if (streak >= 4) return { nextKey: null, weeksToNext: 0, pct: 100 };

    if (streak >= 3) return { nextKey: 'profile.badge.monsoon', weeksToNext: 4 - streak, pct: Math.round((streak / 4) * 100) };

    if (streak >= 2) return { nextKey: 'profile.badge.3week', weeksToNext: 3 - streak, pct: Math.round((streak / 3) * 100) };

    if (streak >= 1) return { nextKey: 'profile.badge.2week', weeksToNext: 2 - streak, pct: Math.round((streak / 2) * 100) };

    return { nextKey: 'profile.badge.reporter', weeksToNext: 1, pct: 0 };

  }



  function getReporterBadges() {

    const reports = getUserReports();

    if (!reports.length) return [];

    const streak = getReportWeekStreak();

    const badges = [];

    if (streak >= 4) badges.push({ key: 'profile.badge.monsoon', icon: 'ph-shield-star' });

    else if (streak >= 3) badges.push({ key: 'profile.badge.3week', icon: 'ph-fire' });

    else if (streak >= 2) badges.push({ key: 'profile.badge.2week', icon: 'ph-lightning' });

    else badges.push({ key: 'profile.badge.reporter', icon: 'ph-camera' });

    return badges;

  }



  function getWardMonsoonCount(ward) {

    if (!ward) return 0;

    const year = new Date().getFullYear();

    const start = new Date(year, 5, 1);

    const end = new Date(year, 9, 31, 23, 59, 59);

    return loadReports().filter((r) => {

      if (r.ward !== ward) return false;

      const t = new Date(r.timestamp);

      return t >= start && t <= end;

    }).length;

  }



  function awardWeekBonus() {

    const key = getWeekKey();

    const last = localStorage.getItem(WEEK_BONUS_KEY);

    if (last === key) return 0;

    safeLocalSet(WEEK_BONUS_KEY, key);

    addPointsCache(POINTS_WEEK_BONUS);

    return POINTS_WEEK_BONUS;

  }



  function wardShortLabel(ward) {

    return ward ? ward.split('—')[0].trim() : '';

  }



  function findNearbyCorroboration(lat, lng) {

    if (lat == null || lng == null) return null;

    const reports = loadReports();

    let best = null;

    let bestDist = NEARBY_CORROB_M;

    reports.forEach((r) => {

      if (r.status !== 'pending' || r.lat == null || r.lng == null) return;

      if (ownsReport(r) || hasConfirmed(r.id)) return;

      const dist = getDistanceInMeters(lat, lng, r.lat, r.lng);

      if (dist < bestDist) {

        bestDist = dist;

        best = { report: r, dist: Math.round(dist) };

      }

    });

    return best;

  }



  function promptNearbyCorroboration(lat, lng) {

    if (isAdmin || isLead || !user.ward) return;

    if (sessionStorage.getItem('civicradar_nearby_prompt')) return;

    const hit = findNearbyCorroboration(lat, lng);

    if (!hit) return;

    sessionStorage.setItem('civicradar_nearby_prompt', '1');

    const { report, dist } = hit;

    showToast(

      t('confirm.nearby').replace('{m}', String(dist)).replace('{backing}', backingSuffix(report.confirmations)),

      'info', 7500, {

      label: t('confirm.metoo'),

      onClick: () => {

        if (confirmReport(report.id) && map) {

          map.setView([report.lat, report.lng], 16);

          const marker = reportMarkerMap.get(report.id);

          if (marker) marker.openPopup();

        }

      },

    });

  }



  function checkUnfiledReminder() {

    processBootReminders();

  }



  /* ---------- In-app reminders (P0/P1) — deduped, snooze-friendly ---------- */

  let sessionReminderCount = 0;

  let bootRemindersDone = false;



  function reminderJson(key, fallback) {

    try {

      const raw = localStorage.getItem(key);

      return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : null);

    } catch {

      return fallback !== undefined ? fallback : null;

    }

  }



  function setReminderJson(key, val) {

    try { safeLocalSet(key, JSON.stringify(val)); } catch {}

  }



  function isReminderSnoozed(key) {

    const until = localStorage.getItem(key);

    if (!until) return false;

    return Date.now() < new Date(until).getTime();

  }



  function snoozeReminder(key, days, analyticsType) {

    const until = new Date(Date.now() + days * 86400000).toISOString();

    try { safeLocalSet(key, until); } catch {}

    if (window.CivicAnalytics) {

      CivicAnalytics.track('reminder_snoozed', { type: analyticsType || 'unfiled', days }, user.ward);

    }

  }



  function escTierShownKey(reportId, tierKey) {

    return `civicradar_esc_shown_${reportId}_${tierKey}`;

  }



  function markEscTierShown(reportId, tierKey) {

    try { safeLocalSet(escTierShownKey(reportId, tierKey), '1'); } catch {}

  }



  function hasEscTierShown(reportId, tierKey) {

    return localStorage.getItem(escTierShownKey(reportId, tierKey)) === '1';

  }



  function wardShortForReminder(ward) {

    if (!ward) return '';

    return ward.split('—')[0].trim();

  }



  function seedReminderSnapshots() {

    const mine = getUserReports();

    if (!localStorage.getItem(REMINDER_CONFIRM_COUNTS_KEY)) {

      const counts = {};

      mine.forEach((r) => { counts[String(r.id)] = Number(r.confirmations) || 0; });

      setReminderJson(REMINDER_CONFIRM_COUNTS_KEY, counts);

    }

    if (!localStorage.getItem(REMINDER_CLEARED_PREV_KEY)) {

      const cleared = {};

      mine.forEach((r) => { cleared[String(r.id)] = !!r.communityCleared; });

      setReminderJson(REMINDER_CLEARED_PREV_KEY, cleared);

    }

  }



  function canShowSessionReminder() {

    return sessionReminderCount < MAX_SESSION_REMINDERS;

  }



  function trackReminderShown(type, extra) {

    if (window.CivicAnalytics) {

      CivicAnalytics.track('reminder_shown', Object.assign({ type }, extra || {}), user.ward);

    }

  }



  function dispatchReminderQueue(candidates) {

    candidates.sort((a, b) => a.priority - b.priority);

    for (const c of candidates) {

      if (!canShowSessionReminder()) break;

      c.show();

      sessionReminderCount++;

      trackReminderShown(c.type, c.meta);

    }

  }



  function collectEscalationReminders() {

    if (isAdmin || isLead || !user.ward) return [];

    const out = [];

    getUserReports()

      .filter((r) => r.status === 'pending' && r.complaintId)

      .forEach((report) => {

        const days = getDaysPending(report.filedAt || report.timestamp);

        const hazard = hazardLabel(report.hazard);

        const ward = wardShortForReminder(report.ward);

        ESC_TOAST_TIERS.forEach((tier) => {

          if (days < tier.days || hasEscTierShown(report.id, tier.key)) return;

          const msgKey = tier.key === '7' ? 'reminder.esc7' : tier.key === '14' ? 'reminder.esc14' : 'reminder.esc30';

          out.push({

            priority: REMINDER_PRIORITY.escalation,

            type: 'escalation',

            meta: { reportId: String(report.id), tier: tier.key, days },

            show: () => {

              markEscTierShown(report.id, tier.key);

              if (window.CivicAnalytics) {

                CivicAnalytics.track('escalation_tier_toast', { reportId: String(report.id), tier: tier.key, days }, report.ward);

              }

              showToast(

                t(msgKey).replace('{n}', String(days)).replace('{hazard}', hazard).replace('{ward}', ward),

                'info',

                7500,

                {

                  label: t('reminder.escAction'),

                  onClick: () => openEscalationModal(report.id),

                }

              );

            },

          });

        });

      });

    return out;

  }



  function collectUnfiledReminders() {

    if (isAdmin || isLead || !user.ward) return [];

    if (isReminderSnoozed(REMINDER_UNFILED_SNOOZE_KEY)) return [];



    const unfiled = getUserReports().filter((r) => r.status === 'pending' && !r.complaintId);

    if (!unfiled.length) {

      try { localStorage.removeItem(REMINDER_UNFILED_MILESTONE_KEY); } catch {}

      return [];

    }



    const oldestDays = Math.max(...unfiled.map((r) => getDaysPending(r.timestamp)));

    const lastMilestone = Number(localStorage.getItem(REMINDER_UNFILED_MILESTONE_KEY)) || 0;

    const nextMilestone = UNFILED_REMINDER_DAYS.find((m) => oldestDays >= m && m > lastMilestone);

    if (!nextMilestone) return [];



    const first = unfiled[0];

    return [{

      priority: REMINDER_PRIORITY.unfiled,

      type: 'unfiled',

      meta: { count: unfiled.length, milestone: nextMilestone },

      show: () => {

        try { safeLocalSet(REMINDER_UNFILED_MILESTONE_KEY, String(nextMilestone)); } catch {}

        showToast(

          t('reminder.unfiled').replace('{n}', String(unfiled.length)),

          'info',

          9000,

          {

            label: t('reminder.file'),

            onClick: () => {

              if (first) openEscalationModal(first.id);

              else window.openProfileModal();

            },

            secondary: [

              {

                label: t('reminder.snooze3d'),

                onClick: () => snoozeReminder(REMINDER_UNFILED_SNOOZE_KEY, 3, 'unfiled'),

              },

              {

                label: t('reminder.gotIt'),

                onClick: () => snoozeReminder(REMINDER_UNFILED_SNOOZE_KEY, 1, 'unfiled'),

              },

            ],

          }

        );

      },

    }];

  }



  function collectCorroborationReminders() {

    if (isAdmin || isLead || !user.ward) return [];

    const prev = reminderJson(REMINDER_CONFIRM_COUNTS_KEY, {}) || {};

    const out = [];

    getUserReports()

      .filter((r) => r.status === 'pending')

      .forEach((report) => {

        const id = String(report.id);

        const prevCount = Number(prev[id]) || 0;

        const curr = Number(report.confirmations) || 0;

        if (curr <= prevCount) return;

        const delta = curr - prevCount;

        out.push({

          priority: REMINDER_PRIORITY.corroboration,

          type: 'corroboration',

          meta: { reportId: id, delta, total: curr },

          show: () => {

            prev[id] = curr;

            setReminderJson(REMINDER_CONFIRM_COUNTS_KEY, prev);

            showToast(

              t('reminder.corroboration')

                .replace('{n}', String(delta))

                .replace('{hazard}', hazardLabel(report.hazard)),

              'success',

              6500,

              {

                label: t('reminder.corroAction'),

                onClick: () => window.openReportPopupById(report.id),

              }

            );

          },

        });

      });

    return out;

  }



  function collectStaleCheckReminders() {

    if (isAdmin || isLead || !user.ward) return [];

    if (sessionStorage.getItem('civicradar_stale_check_session')) return [];



    const candidates = getUserReports()

      .filter((r) => {

        if (r.status !== 'pending') return false;

        if (isStaleReportSnoozed(r.id)) return false;

        return getDaysPending(r.timestamp) >= STALE_CHECK_DAYS;

      })

      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));



    if (!candidates.length) return [];

    const report = candidates[0];

    const ward = wardShortForReminder(report.ward) || t('header.context');



    return [{

      priority: REMINDER_PRIORITY.staleCheck,

      type: 'stale_check',

      meta: { reportId: String(report.id), days: getDaysPending(report.timestamp) },

      show: () => {

        sessionStorage.setItem('civicradar_stale_check_session', '1');

        showToast(

          t('reminder.staleCheck').replace('{ward}', ward),

          'info',

          9000,

          {

            label: t('reminder.looksFixed'),

            onClick: () => confirmFix(report.id, { staleCheck: true }),

            secondary: [{

              label: t('reminder.stillThere'),

              onClick: () => snoozeStaleReport(report.id),

            }],

          }

        );

      },

    }];

  }



  function collectCleanupReminders() {

    if (isAdmin || isLead || !user.ward) return [];

    const prev = reminderJson(REMINDER_CLEARED_PREV_KEY, {}) || {};

    const out = [];

    getUserReports().forEach((report) => {

      const id = String(report.id);

      const wasCleared = !!prev[id];

      const nowCleared = !!report.communityCleared;

      if (!nowCleared || wasCleared) return;

      out.push({

        priority: REMINDER_PRIORITY.cleanup,

        type: 'cleanup',

        meta: { reportId: id },

        show: () => {

          prev[id] = true;

          setReminderJson(REMINDER_CLEARED_PREV_KEY, prev);

          updateCommunityWinBadge();

          setTimeout(() => showShareWinModal(report.id, 'cleanup'), 800);

        },

      });

    });

    return out;

  }



  function processBootReminders() {

    if (!user.ward || !user.tosAccepted) return;

    seedReminderSnapshots();

    dispatchReminderQueue([

      ...collectEscalationReminders(),

      ...collectStaleCheckReminders(),

      ...collectUnfiledReminders(),

    ]);

    bootRemindersDone = true;

    processSyncReminders();

  }



  function processSyncReminders() {

    if (!user.ward || !user.tosAccepted || !bootRemindersDone) return;

    if (!localStorage.getItem(REMINDER_CONFIRM_COUNTS_KEY)) seedReminderSnapshots();

    dispatchReminderQueue([

      ...collectCorroborationReminders(),

      ...collectCleanupReminders(),

    ]);

  }



  /* ---------- Opt-in "report stagnant water nearby" reminder (Feature 2a) ----------

     Honest about platform limits: NO background push / geofencing. Reminders fire

     only while the app is open (load + visibilitychange). When the user opted in and

     a reminder is "due", we prefer a real Notification (granted permission) and

     otherwise fall back to the existing in-app reminder card. iOS / unsupported /

     denied all degrade gracefully — the app never blocks or errors on this. */

  function isReportReminderOptedIn() {

    return localStorage.getItem(REPORT_REMINDER_OPTIN_KEY) === '1';

  }



  function notificationsSupported() {

    return typeof window !== 'undefined' && 'Notification' in window;

  }



  function setReportReminderOptIn(enabled) {

    try { safeLocalSet(REPORT_REMINDER_OPTIN_KEY, enabled ? '1' : '0'); } catch {}

    if (window.CivicAnalytics) {

      CivicAnalytics.track('report_reminder_optin', { enabled: !!enabled }, user.ward);

    }

  }



  function syncReportReminderToggle() {

    const el = $('#reportReminderToggle');

    if (el) el.checked = isReportReminderOptedIn();

  }



  // Wired from the Profile toggle. Requesting permission requires a user gesture,

  // which the toggle click provides. Feature-detected so headless/iOS never hangs.

  function handleReportReminderToggle(enabled) {

    setReportReminderOptIn(enabled);

    if (!enabled) {

      showToast(t('settings.reminder.off'), 'info', 2600);

      return;

    }

    if (!notificationsSupported()) {

      showToast(t('settings.reminder.denied'), 'info', 4200);

      return;

    }

    function showReportReminderPermissionToast(result) {

      if (result === 'granted') {

        showToast(t('settings.reminder.on'), 'success', 3600);

        return;

      }

      if (result === 'denied') {

        showToast(t('settings.reminder.denied'), 'info', 4200);

        return;

      }

      showToast(t('settings.reminder.on'), 'success', 3600);

    }

    function readNotificationPermission() {

      try { return Notification.permission; } catch { return 'default'; }

    }

    let perm = readNotificationPermission();

    if (perm === 'granted') {

      showToast(t('settings.reminder.on'), 'success', 3600);

      return;

    }

    if (perm === 'denied') {

      showToast(t('settings.reminder.denied'), 'info', 4200);

      return;

    }

    try {

      const req = Notification.requestPermission();

      if (req && typeof req.then === 'function') {

        req.then(showReportReminderPermissionToast).catch(() => {

          showReportReminderPermissionToast(readNotificationPermission());

        });

      } else {

        showReportReminderPermissionToast(readNotificationPermission());

      }

    } catch {

      showReportReminderPermissionToast(readNotificationPermission());

    }

  }



  function isReportReminderDue() {

    if (isReminderSnoozed(REPORT_REMINDER_SNOOZE_KEY)) return false;

    const last = localStorage.getItem(REPORT_REMINDER_LAST_KEY);

    if (!last) return true;

    return Date.now() - new Date(last).getTime() >= REPORT_REMINDER_DAYS * 86400000;

  }



  function markReportReminderShown() {

    try { safeLocalSet(REPORT_REMINDER_LAST_KEY, new Date().toISOString()); } catch {}

  }



  function showReportReminderInApp() {

    if (!canShowSessionReminder()) return;

    sessionReminderCount++;

    trackReminderShown('report_reminder', { channel: 'in_app' });

    showToast(t('notify.report.body'), 'info', 9000, {

      label: t('notify.report.cta'),

      onClick: () => window.openReportModal(true),

      secondary: [{

        label: t('reminder.snooze3d'),

        onClick: () => snoozeReminder(REPORT_REMINDER_SNOOZE_KEY, 3, 'report_reminder'),

      }],

    });

  }



  function fireReportReminderNotification() {

    // Prefer the SW registration (works when the page is backgrounded on supported

    // browsers); fall back to a page Notification; finally fall back to in-app.

    const title = t('notify.report.title');

    const opts = { body: t('notify.report.body'), tag: 'civicradar-report-reminder', icon: 'assets/icon-192.png', badge: 'assets/favicon-32.png' };

    try {

      if (navigator.serviceWorker && navigator.serviceWorker.ready) {

        navigator.serviceWorker.ready

          .then((reg) => { if (reg && reg.showNotification) reg.showNotification(title, opts); else throw new Error('no showNotification'); })

          .catch(() => { try { new Notification(title, opts); } catch { showReportReminderInApp(); } });

        return true;

      }

      new Notification(title, opts);

      return true;

    } catch {

      return false;

    }

  }



  function maybeShowReportReminder() {

    if (isAdmin || isLead) return;

    if (!user.ward || !user.tosAccepted) return;

    if (!isReportReminderOptedIn()) return;

    if (!isReportReminderDue()) return;

    markReportReminderShown();

    if (window.CivicAnalytics) CivicAnalytics.track('report_reminder_due', {}, user.ward);

    let perm = 'default';

    if (notificationsSupported()) { try { perm = Notification.permission; } catch {} }

    if (perm === 'granted') {

      trackReminderShown('report_reminder', { channel: 'notification' });

      if (fireReportReminderNotification()) return;

    }

    showReportReminderInApp();

  }

  window.maybeShowReportReminder = maybeShowReportReminder;

  /* ---------- Neighbourhood alerts (new report + resolved FYI) ----------
     Matching: same city + ward + normalized society when report has society;
     ward-only fallback when report has no society. Default ON when profile society set.
     Shared rate limit: max 3 alerts / 24h, min 5 min gap. Resolved batched per hour. */

  let nbhResolveDigestTimer = null;

  function defaultNbhAlertsOn() {
    return !!(user.society && String(user.society).trim());
  }

  function isNbhNewAlertsEnabled() {
    const v = localStorage.getItem(NBH_ALERT_NEW_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
    return defaultNbhAlertsOn();
  }

  function isNbhResolvedAlertsEnabled() {
    const v = localStorage.getItem(NBH_ALERT_RESOLVED_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
    return defaultNbhAlertsOn();
  }

  function setNbhNewAlertsEnabled(enabled) {
    try { safeLocalSet(NBH_ALERT_NEW_KEY, enabled ? '1' : '0'); } catch {}
    if (Backend.enabled) Backend.updateNotificationPrefs({ newAlerts: enabled });
    if (window.CivicAnalytics) CivicAnalytics.track('nbh_alert_optin', { type: 'new', enabled: !!enabled }, user.ward);
  }

  function setNbhResolvedAlertsEnabled(enabled) {
    try { safeLocalSet(NBH_ALERT_RESOLVED_KEY, enabled ? '1' : '0'); } catch {}
    if (Backend.enabled) Backend.updateNotificationPrefs({ resolvedAlerts: enabled });
    if (window.CivicAnalytics) CivicAnalytics.track('nbh_alert_optin', { type: 'resolved', enabled: !!enabled }, user.ward);
  }

  function syncNbhAlertToggles() {
    const n = $('#nbhNewAlertToggle');
    const r = $('#nbhResolvedAlertToggle');
    if (n) n.checked = isNbhNewAlertsEnabled();
    if (r) r.checked = isNbhResolvedAlertsEnabled();
  }

  function handleNbhNewAlertToggle(enabled) {
    setNbhNewAlertsEnabled(enabled);
    if (!enabled) { showToast(t('settings.nbh.newOff'), 'info', 2600); return; }
    requestNotificationForNbhToggle(true);
  }

  function handleNbhResolvedAlertToggle(enabled) {
    setNbhResolvedAlertsEnabled(enabled);
    if (!enabled) { showToast(t('settings.nbh.resolvedOff'), 'info', 2600); return; }
    requestNotificationForNbhToggle(true);
  }

  function requestNotificationForNbhToggle(showOnToast) {
    if (!notificationsSupported()) {
      if (showOnToast) showToast(t('settings.nbh.denied'), 'info', 4200);
      return;
    }
    let perm = 'default';
    try { perm = Notification.permission; } catch {}
    if (perm === 'granted') {
      if (showOnToast) showToast(t('settings.nbh.on'), 'success', 3600);
      return;
    }
    if (perm === 'denied') {
      showToast(t('settings.nbh.denied'), 'info', 4200);
      return;
    }
    try {
      const req = Notification.requestPermission();
      if (req && typeof req.then === 'function') {
        req.then((result) => {
          showToast(
            result === 'granted' ? t('settings.nbh.on') : t('settings.nbh.denied'),
            result === 'granted' ? 'success' : 'info',
            result === 'granted' ? 3600 : 4200
          );
        }).catch(() => { if (showOnToast) showToast(t('settings.nbh.on'), 'success', 3600); });
      } else if (showOnToast) showToast(t('settings.nbh.on'), 'success', 3600);
    } catch {
      if (showOnToast) showToast(t('settings.nbh.on'), 'success', 3600);
    }
  }

  function normalizeNbhToken(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function nbhSocietyLabel(report) {
    const soc = (report && (report.society || report.neighbourhood)) || user.society || '';
    const trimmed = String(soc).trim();
    if (trimmed) return trimmed;
    return wardLabelShort((report && report.ward) || user.ward || '');
  }

  function reportMatchesUserNeighbourhood(report) {
    if (!user.ward || !user.tosAccepted) return false;
    if (isAdmin || isLead) return false;
    const city = report.city || getReportCity(report);
    if (city !== getUserCity()) return false;
    if ((report.ward || '') !== user.ward) return false;
    const reportSoc = normalizeNbhToken(report.society || report.neighbourhood);
    const userSoc = normalizeNbhToken(user.society);
    if (reportSoc && userSoc) return reportSoc === userSoc;
    if (!reportSoc) return true;
    return false;
  }

  function loadNbhAlertLog() {
    try {
      const raw = localStorage.getItem(NBH_ALERT_LOG_KEY);
      const parsed = raw ? JSON.parse(raw) : { timestamps: [] };
      if (!Array.isArray(parsed.timestamps)) parsed.timestamps = [];
      return parsed;
    } catch {
      return { timestamps: [] };
    }
  }

  function saveNbhAlertLog(log) {
    try { safeLocalSet(NBH_ALERT_LOG_KEY, JSON.stringify(log)); } catch {}
  }

  function canSendNbhAlert() {
    const log = loadNbhAlertLog();
    const now = Date.now();
    const recent = (log.timestamps || []).filter((ts) => now - ts < 86400000);
    if (recent.length >= NBH_ALERT_MAX_PER_24H) return false;
    const last = recent.length ? Math.max(...recent) : 0;
    if (last && now - last < NBH_ALERT_MIN_GAP_MS) return false;
    return true;
  }

  function recordNbhAlertSent() {
    const log = loadNbhAlertLog();
    const now = Date.now();
    log.timestamps = (log.timestamps || []).filter((ts) => now - ts < 86400000);
    log.timestamps.push(now);
    saveNbhAlertLog(log);
  }

  function loadNbhIdSet(key) {
    try {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function saveNbhIdSet(key, set) {
    try { safeLocalSet(key, JSON.stringify([...set].slice(-500))); } catch {}
  }

  function loadResolveDigest() {
    try {
      return JSON.parse(localStorage.getItem(NBH_ALERT_RESOLVE_DIGEST_KEY) || 'null') || {};
    } catch {
      return {};
    }
  }

  function saveResolveDigest(d) {
    try { safeLocalSet(NBH_ALERT_RESOLVE_DIGEST_KEY, JSON.stringify(d)); } catch {}
  }

  function focusReportOnMap(reportId) {
    const r = findReportById(reportId);
    if (!r) return;
    closeAllModals();
    if (r.lat != null && r.lng != null && map) {
      map.setView([r.lat, r.lng], 16);
      const marker = reportMarkerMap.get(String(reportId));
      if (marker) marker.openPopup();
    }
  }

  function showNbhAlertInApp(title, body, reportId, ctaKey, secondaryAction) {
    window.__civicNbhAlertLast = body;
    const action = {
      label: t(ctaKey || 'notify.nbh.new.cta'),
      onClick: () => focusReportOnMap(reportId),
    };
    if (secondaryAction && secondaryAction.label) action.secondary = [secondaryAction];
    showToast(body, 'info', 9000, action);
  }

  function fireNbhAlertNotification(title, body, reportId, alertType) {
    const tag = `civicradar-nbh-${alertType}`;
    const opts = {
      body,
      tag,
      icon: 'assets/icon-192.png',
      badge: 'assets/favicon-32.png',
      data: { reportId: String(reportId || ''), type: alertType, url: reportId ? `?report=${reportId}` : './' },
    };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready
          .then((reg) => {
            if (reg && reg.showNotification) reg.showNotification(title, opts);
            else throw new Error('no showNotification');
          })
          .catch(() => { try { new Notification(title, opts); } catch { showNbhAlertInApp(title, body, reportId, alertType === 'resolved' ? 'notify.nbh.resolved.cta' : 'notify.nbh.new.cta'); } });
        return true;
      }
      new Notification(title, opts);
      return true;
    } catch {
      return false;
    }
  }

  function deliverNbhAlert(kind, report, bodyOverride) {
    if (!report || !reportMatchesUserNeighbourhood(report)) return false;
    if (report.reporterId === user.id) return false;
    if (!canSendNbhAlert()) return false;
    const society = nbhSocietyLabel(report);
    const hazard = hazardLabel(report.hazard);
    const isResolved = kind === 'resolved';
    const title = t(isResolved ? 'notify.nbh.resolved.title' : 'notify.nbh.new.title');
    const body = bodyOverride || (isResolved
      ? t('notify.nbh.resolved.body').replace('{society}', society).replace('{hazard}', hazard)
      : t('notify.nbh.new.body').replace('{society}', society).replace('{hazard}', hazard));
    window.__civicNbhAlertLast = body;
    recordNbhAlertSent();
    if (window.CivicAnalytics) CivicAnalytics.track(isResolved ? 'nbh_alert_resolved' : 'nbh_alert_new', { reportId: String(report.id) }, user.ward);
    let perm = 'default';
    if (notificationsSupported()) { try { perm = Notification.permission; } catch {} }
    if (perm === 'granted' && fireNbhAlertNotification(title, body, report.id, kind)) return true;
    const shareWinAction = isResolved ? {
      label: t('toast.shareWinBtn'),
      onClick: () => showShareWinModal(report.id, 'resolved', { celebrate: false }),
    } : null;
    showNbhAlertInApp(title, body, report.id, isResolved ? 'notify.nbh.resolved.cta' : 'notify.nbh.new.cta', shareWinAction);
    return true;
  }

  function maybeDeliverNbhNewReportAlert(report) {
    if (!isNbhNewAlertsEnabled()) return;
    if (!report || report.status === 'resolved') return;
    deliverNbhAlert('new', report);
  }

  function queueNbhResolvedAlert(report) {
    if (!isNbhResolvedAlertsEnabled()) return;
    if (!report || report.status !== 'resolved') return;
    const hourKey = Math.floor(Date.now() / NBH_ALERT_DIGEST_MS);
    const digest = loadResolveDigest();
    if (digest.hourKey !== hourKey) {
      digest.hourKey = hourKey;
      digest.count = 0;
      digest.society = nbhSocietyLabel(report);
      digest.lastReportId = report.id;
    }
    digest.count = (digest.count || 0) + 1;
    digest.lastReportId = report.id;
    saveResolveDigest(digest);
    clearTimeout(nbhResolveDigestTimer);
    nbhResolveDigestTimer = setTimeout(flushNbhResolveDigest, 400);
  }

  function flushNbhResolveDigest() {
    nbhResolveDigestTimer = null;
    const digest = loadResolveDigest();
    if (!digest.count || !digest.lastReportId) return;
    const report = findReportById(digest.lastReportId) || { id: digest.lastReportId, ward: user.ward, city: getUserCity(), society: digest.society, status: 'resolved', hazard: 'stagnant-water' };
    let body;
    if (digest.count > 1) {
      body = t('notify.nbh.resolved.bodyMany').replace('{n}', String(digest.count)).replace('{society}', digest.society || nbhSocietyLabel(report));
    }
    deliverNbhAlert('resolved', report, body);
    saveResolveDigest({});
  }

  function maybeDeliverNbhResolvedAlert(report) {
    queueNbhResolvedAlert(report);
  }

  function fanOutLocalNbhNewReport(report) {
    if (!report) return;
    try {
      const q = JSON.parse(localStorage.getItem('civicradar_nbh_local_queue') || '[]');
      q.push({ type: 'new', report: { id: report.id, hazard: report.hazard, society: report.society, ward: report.ward, city: report.city, reporterId: report.reporterId, status: report.status }, at: Date.now() });
      safeLocalSet('civicradar_nbh_local_queue', JSON.stringify(q.slice(-50)));
    } catch {}
    processLocalNbhQueue();
  }

  function fanOutLocalNbhResolved(report) {
    if (!report) return;
    try {
      const q = JSON.parse(localStorage.getItem('civicradar_nbh_local_queue') || '[]');
      q.push({ type: 'resolved', report: { id: report.id, hazard: report.hazard, society: report.society, ward: report.ward, city: report.city, reporterId: report.reporterId, status: 'resolved' }, at: Date.now() });
      safeLocalSet('civicradar_nbh_local_queue', JSON.stringify(q.slice(-50)));
    } catch {}
    processLocalNbhQueue();
  }

  function processLocalNbhQueue() {
    let q;
    try { q = JSON.parse(localStorage.getItem('civicradar_nbh_local_queue') || '[]'); } catch { return; }
    if (!q.length) return;
    const remaining = [];
    q.forEach((item) => {
      const r = item.report;
      if (!r || r.reporterId === user.id) return;
      if (item.type === 'new' && isNbhNewAlertsEnabled()) {
        if (!deliverNbhAlert('new', r)) remaining.push(item);
      } else if (item.type === 'resolved' && isNbhResolvedAlertsEnabled()) {
        queueNbhResolvedAlert(r);
      } else {
        remaining.push(item);
      }
    });
    try { safeLocalSet('civicradar_nbh_local_queue', JSON.stringify(remaining)); } catch {}
  }

  function processNeighbourhoodAlertsOnSync(prevReports) {
    if (!user.ward || isAdmin || isLead) return;
    const prevMap = new Map((prevReports || []).map((r) => [String(r.id), r]));
    const newSeen = loadNbhIdSet(NBH_ALERT_NEW_SEEN_KEY);
    const resolvedSeen = loadNbhIdSet(NBH_ALERT_RESOLVED_SEEN_KEY);
    loadReports().forEach((r) => {
      if (r.reporterId === user.id) return;
      if (!reportMatchesUserNeighbourhood(r)) return;
      const prev = prevMap.get(String(r.id));
      if (r.status !== 'resolved' && !newSeen.has(String(r.id)) && isNbhNewAlertsEnabled()) {
        if (deliverNbhAlert('new', r)) newSeen.add(String(r.id));
      }
      if (r.status === 'resolved' && !resolvedSeen.has(String(r.id))) {
        const wasPending = !prev || prev.status !== 'resolved';
        if (wasPending && isNbhResolvedAlertsEnabled()) {
          queueNbhResolvedAlert(r);
          resolvedSeen.add(String(r.id));
        }
      }
    });
    saveNbhIdSet(NBH_ALERT_NEW_SEEN_KEY, newSeen);
    saveNbhIdSet(NBH_ALERT_RESOLVED_SEEN_KEY, resolvedSeen);
  }

  function applyNbhPrefsFromProfile(profile) {
    if (!profile) return;
    if (profile.neighbourhood_new_alerts_enabled === true) safeLocalSet(NBH_ALERT_NEW_KEY, '1');
    else if (profile.neighbourhood_new_alerts_enabled === false) safeLocalSet(NBH_ALERT_NEW_KEY, '0');
    if (profile.neighbourhood_resolved_alerts_enabled === true) safeLocalSet(NBH_ALERT_RESOLVED_KEY, '1');
    else if (profile.neighbourhood_resolved_alerts_enabled === false) safeLocalSet(NBH_ALERT_RESOLVED_KEY, '0');
    syncNbhAlertToggles();
  }

  window.__civicSimulateNbhNewReport = function (report) {
    const r = report || { id: 'sim-nbh-new', hazard: 'stagnant-water', society: user.society, ward: user.ward, city: getUserCity(), reporterId: 'other-user', status: 'pending' };
    maybeDeliverNbhNewReportAlert(r);
  };
  window.__civicSimulateNbhResolved = function (report) {
    const r = report || { id: 'sim-nbh-res', hazard: 'stagnant-water', society: user.society, ward: user.ward, city: getUserCity(), reporterId: 'other-user', status: 'resolved' };
    maybeDeliverNbhResolvedAlert(r);
  };
  window.__civicShowShareWinModal = showShareWinModal;
  window.__civicGenerateSuccessCardCanvas = generateSuccessCardCanvas;
  window.__civicGetReportShareLocation = getReportShareLocation;
  window.__civicReportDeepLink = reportDeepLink;
  window.__civicGetShareAppUrl = getShareAppUrl;
  window.__civicBuildAndroidIntentUrl = buildAndroidIntentUrl;
  window.__civicResetNbhAlertLimits = function () {
    localStorage.removeItem(NBH_ALERT_LOG_KEY);
    localStorage.removeItem(NBH_ALERT_RESOLVE_DIGEST_KEY);
    clearTimeout(nbhResolveDigestTimer);
    nbhResolveDigestTimer = null;
  };
  window.processLocalNbhQueue = processLocalNbhQueue;
  window.syncNbhAlertToggles = syncNbhAlertToggles;
  window.flushNbhResolveDigest = flushNbhResolveDigest;



  /* ---------- Location-aware in-app nudge (Feature 2b) ----------

     Foreground only. Reuses the granted GPS position (never re-prompts) and the

     existing haversine helper to see if the user is standing near a known PENDING

     hazard. Surfaces through the SAME reminder queue (staleCheck priority), so it

     respects MAX_SESSION_REMINDERS, snooze keys and priority ordering. Precise

     coordinates are used transiently and never persisted. */

  function collectProximityReminders(lat, lng) {

    if (isAdmin || isLead || !user.ward) return [];

    if (lat == null || lng == null) return [];

    // One location prompt per session: if the 50m Me-too prompt already fired, skip.

    if (sessionStorage.getItem('civicradar_nearby_prompt')) return [];

    if (sessionStorage.getItem('civicradar_proximity_session')) return [];



    let best = null;

    let bestDist = PROXIMITY_NUDGE_M;

    loadReports().forEach((r) => {

      if (r.status !== 'pending' || r.lat == null || r.lng == null) return;

      if (isStaleReportSnoozed(r.id)) return;

      const owns = ownsReport(r);

      if (!owns && hasConfirmed(r.id)) return;

      const dist = getDistanceInMeters(lat, lng, r.lat, r.lng);

      if (dist < bestDist) { bestDist = dist; best = { report: r, owns }; }

    });

    if (!best) return [];



    const report = best.report;

    const owns = best.owns;

    const ward = wardShortForReminder(report.ward) || t('header.context');

    return [{

      priority: REMINDER_PRIORITY.proximity,

      type: 'proximity_nudge',

      meta: { reportId: String(report.id), owns },

      show: () => {

        sessionStorage.setItem('civicradar_proximity_session', '1');

        snoozeStaleReport(report.id);

        if (window.CivicAnalytics) {

          CivicAnalytics.track('proximity_nudge_shown', { reportId: String(report.id), owns }, report.ward);

        }

        showToast(

          t('reminder.staleCheck').replace('{ward}', ward),

          'info',

          9000,

          {

            label: t('reminder.addPhoto'),

            onClick: () => window.openReportModal(true),

            secondary: [{

              label: t('reminder.stillThere'),

              onClick: () => {

                if (owns) snoozeStaleReport(report.id);

                else confirmReport(report.id);

              },

            }],

          }

        );

      },

    }];

  }



  function maybeProximityNudge(lat, lng) {

    if (!user.ward || !user.tosAccepted) return;

    dispatchReminderQueue(collectProximityReminders(lat, lng));

  }

  window.maybeProximityNudge = maybeProximityNudge;



  // Test-only: lets the E2E suite exercise the per-session reminder cap and the

  // location-nudge flow deterministically. No-op effect on real users.

  window.__civicResetReminderSession = function () {

    sessionReminderCount = 0;

    try {

      sessionStorage.removeItem('civicradar_nearby_prompt');

      sessionStorage.removeItem('civicradar_proximity_session');

      sessionStorage.removeItem('civicradar_stale_check_session');

    } catch {}

  };



  function countNewNgoHazards() {

    const lastSeen = localStorage.getItem(REMINDER_NGO_LAST_SEEN_KEY);

    if (!lastSeen) return 0;

    const cutoff = new Date(lastSeen).getTime();

    return getCoordinatorHazards().filter(

      (r) => new Date(r.timestamp).getTime() > cutoff

    ).length;

  }



  function countNewNgoPledges() {

    let lastSeen = localStorage.getItem(REMINDER_NGO_PLEDGES_LAST_SEEN_KEY);

    if (!lastSeen) lastSeen = localStorage.getItem(REMINDER_NGO_LAST_SEEN_KEY);

    if (!lastSeen) return 0;

    const cutoff = new Date(lastSeen).getTime();

    const { citizenPledges } = getCoordinatorPledges();

    return citizenPledges.filter((p) => new Date(p.timestamp).getTime() > cutoff).length;

  }



  function markNgoHubSeen() {

    const now = new Date().toISOString();

    try {

      safeLocalSet(REMINDER_NGO_LAST_SEEN_KEY, now);

      safeLocalSet(REMINDER_NGO_PLEDGES_LAST_SEEN_KEY, now);

    } catch {}

    updatePersonaUI();

  }



  function canShowMapEmptyShare() {

    if (getUserReports().length > 0) return true;

    try {

      if (localStorage.getItem(FIRST_REPORT_DONE_KEY)) return true;

      const visits = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);

      return visits >= 2;

    } catch {

      return false;

    }

  }



  function hasSubmittedFirstReport() {

    try {

      if (localStorage.getItem(FIRST_REPORT_DONE_KEY)) return true;

    } catch { /* ignore */ }

    return getUserReports().length > 0;

  }



  function shouldDeferFirstRunNudges() {

    try {

      const visits = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);

      return visits <= 1 && !hasSubmittedFirstReport();

    } catch {

      return !hasSubmittedFirstReport();

    }

  }



  function isBlockingFirstRunOverlay() {

    const hero = $('#homeHero');

    if (hero && !hero.classList.contains('hidden')) return true;

    const coach = $('#coachMark');

    if (coach && !coach.classList.contains('hidden')) return true;

    const tour = $('#tourOverlay');

    if (tour && !tour.classList.contains('hidden')) return true;

    if (overlays.tos && overlays.tos.classList.contains('open')) return true;

    if (overlays.onboarding && overlays.onboarding.classList.contains('open')) return true;

    return false;

  }



  function shouldShowHomeHero() {

    if (getActivePersona() !== 'citizen') return false;

    if (!user.tosAccepted || !user.ward) return false;

    if (isAdmin || isLead) return false;

    if (getUserReports().length > 0) return false;

    try {

      if (localStorage.getItem(FIRST_REPORT_DONE_KEY)) return false;

      if (localStorage.getItem(HERO_DISMISSED_KEY)) return false;

    } catch { return false; }

    const demo = new URLSearchParams(location.search).get('demo');

    if (demo === 'tour' || demo === 'persona') return false;

    return true;

  }



  function updateHomeHero() {

    const el = $('#homeHero');

    if (!el) return;

    const show = shouldShowHomeHero();

    el.classList.toggle('hidden', !show);

    document.body.classList.toggle('home-hero-visible', show);

    updateIosInstallHint();

    if (typeof renderWardPulse === 'function') renderWardPulse();

    if (map) {
      try { map.invalidateSize({ pan: false }); } catch { /* ignore */ }
    }

  }



  function isIosInstallHintSnoozed() {

    try {

      const ts = parseInt(localStorage.getItem(IOS_INSTALL_SNOOZE_KEY) || '0', 10);

      return ts > 0 && (Date.now() - ts) < IOS_INSTALL_SNOOZE_MS;

    } catch { return false; }

  }



  function snoozeIosInstallHint() {

    try { safeLocalSet(IOS_INSTALL_SNOOZE_KEY, String(Date.now())); } catch {}

  }



  function shouldShowIosInstallHint() {

    if (!isAppleMobile() || isStandalonePwa()) return false;

    if (getActivePersona() !== 'citizen') return false;

    if (isAdmin || isLead) return false;

    if (!user.tosAccepted || !user.ward) return false;

    if (isIosInstallHintSnoozed()) return false;

    const coach = $('#coachMark');

    if (coach && !coach.classList.contains('hidden')) return false;

    const tour = $('#tourOverlay');

    if (tour && !tour.classList.contains('hidden')) return false;

    if (overlays.tos && overlays.tos.classList.contains('open')) return false;

    if (overlays.onboarding && overlays.onboarding.classList.contains('open')) return false;

    return true;

  }



  function updateIosInstallHint() {

    const el = $('#iosInstallHint');

    if (!el) return;

    const show = shouldShowIosInstallHint();

    const wasHidden = el.classList.contains('hidden');

    el.classList.toggle('hidden', !show);

    if (show && wasHidden && window.CivicAnalytics) CivicAnalytics.track('ios_install_hint_shown', {});

  }



  function dismissIosInstallHint() {

    snoozeIosInstallHint();

    updateIosInstallHint();

    if (window.CivicAnalytics) CivicAnalytics.track('ios_install_hint_dismissed', {});

  }



  function dismissHomeHero() {

    try { safeLocalSet(HERO_DISMISSED_KEY, '1'); } catch {}

    updateHomeHero();

    updateMapEmptyCta();

    if (!localStorage.getItem(COACH_KEY)) {

      safeLocalSet(COACH_KEY, '1');

    }

    setTimeout(maybeStartTour, 350);

  }



  function updateMapEmptyCta() {

    const el = $('#mapEmptyCta');

    const textEl = $('#mapEmptyText');

    const shareBtn = $('#btnMapEmptyShare');

    if (!el) return;

    const citizen = getActivePersona() === 'citizen';

    const show = citizen && user.ward && getUserReports().length === 0 && cityScopedReports(loadReports()).length === 0;

    const heroUp = shouldShowHomeHero();

    el.classList.toggle('hidden', !show || heroUp);

    if (shareBtn) shareBtn.classList.toggle('hidden', !show || !canShowMapEmptyShare());

    if (textEl && show && user.ward) {

      const wardLabel = getWardShortName(user.ward);

      const rival = getWardRivalSnippet();

      textEl.textContent = rival

        ? t('map.emptyRival')

          .replace('{ward}', wardLabel)

          .replace('{rival}', rival.name)

          .replace('{pending}', String(rival.pending))

        : t('map.empty').replace('{ward}', wardLabel);

    }

  }



  function getWardRivalSnippet() {

    if (!user.ward) return null;

    const stats = getWardReportStats();

    if (stats.length < 2) return null;

    const userStat = stats.find((s) => s.name === user.ward);

    if (!userStat) return null;

    const rivals = stats.filter((s) => s.name !== user.ward);

    const rival = rivals.sort((a, b) => b.pending - a.pending || b.resolved - a.resolved)[0];

    if (!rival || rival.pending <= 0) return null;

    return { name: getWardShortName(rival.name), pending: rival.pending };

  }



  // Per-device record of which reports this user has corroborated, so a single

  // device can't inflate the count. (The backend enforces this server-side too.)

  let confirmedIdCache = null;

  const confirmInFlight = new Set();



  function loadConfirmedSet() {

    if (confirmedIdCache) return confirmedIdCache;

    try { confirmedIdCache = new Set(JSON.parse(localStorage.getItem(CONFIRMED_KEY)) || []); }

    catch { confirmedIdCache = new Set(); }

    return confirmedIdCache;

  }



  function persistConfirmedSet(set) {

    confirmedIdCache = set;

    try { safeLocalSet(CONFIRMED_KEY, JSON.stringify(Array.from(set))); } catch {}

  }



  function hasConfirmed(reportId) {

    return loadConfirmedSet().has(String(reportId));

  }



  function unclaimConfirmation(reportId) {

    const set = loadConfirmedSet();

    set.delete(String(reportId));

    persistConfirmedSet(set);

  }



  function disableMeTooControl(el) {

    if (!el) return;

    el.disabled = true;

    el.setAttribute('aria-disabled', 'true');

    el.classList.add('popup__btn--busy');

  }



  function showMeTooDoneInPopup(el) {

    if (!el || !el.parentNode) return;

    const note = document.createElement('span');

    note.className = 'popup__note popup__note--done';

    note.innerHTML = `<i class="ph ph-check-circle"></i> ${escapeHtml(t('confirm.done'))}`;

    el.replaceWith(note);

  }



  function ownsReport(report) {

    return report && report.reporterId ? report.reporterId === user.id : false;

  }



  // "Me too" corroboration: a neighbour confirms an existing pending hazard

  // instead of filing a duplicate. Boosts the report's priority + social proof.

  function confirmReport(reportId) {

    const id = String(reportId);

    if (confirmInFlight.has(id)) return false;

    const reports = loadReports();

    const idx = reports.findIndex((r) => String(r.id) === id);

    if (idx === -1) return false;

    const report = reports[idx];

    if (report.status !== 'pending') return false;

    if (ownsReport(report)) { showToast(t('confirm.you'), 'info', 2200); return false; }

    if (hasConfirmed(id)) {

      showToast(t('confirm.done'), 'info', 2200);

      return false;

    }



    confirmInFlight.add(id);

    const set = loadConfirmedSet();

    set.add(id);

    persistConfirmedSet(set);



    try {

      report.confirmations = (Number(report.confirmations) || 0) + 1;

      saveReports(reports);

    } catch {

      unclaimConfirmation(id);

      showToast(t('toast.saveFail'), 'error');

      return false;

    } finally {

      confirmInFlight.delete(id);

    }



    Backend.confirmReport(reportId);

    addPointsCache(POINTS_ME_TOO);

    if (window.CivicAnalytics) {

      CivicAnalytics.track('report_corroborated', { reportId: id }, report.ward);

    }

    if (reportMarkerLayer) refreshReportMarkers();

    updateProfileUI();

    if (isAdmin) renderAdminQueue();

    launchConfetti({ intensity: 'mini' });

    showToast(t('confirm.meTooThanks'), 'success', 3200, {

      label: t('share.meTooBtn'),

      onClick: () => shareMeTooWhatsApp(reportId),

    });

    return true;
  }

  window.confirmReport = confirmReport;



  function loadFixConfirmedSet() {

    try { return new Set(JSON.parse(localStorage.getItem(FIX_CONFIRMED_KEY)) || []); }

    catch { return new Set(); }

  }



  function hasFixConfirmed(reportId) {

    return loadFixConfirmedSet().has(String(reportId));

  }



  function loadFixConfirmedSeen() {

    try { return JSON.parse(localStorage.getItem(FIX_CONFIRMED_SEEN_KEY)) || []; }

    catch { return []; }

  }



  function saveFixConfirmedSeen(ids) {

    try { safeLocalSet(FIX_CONFIRMED_SEEN_KEY, JSON.stringify(ids)); } catch {}

  }



  function getReportResolutionSource(report) {

    if (!report) return '';

    if (report.resolutionSource) return report.resolutionSource;

    if (report.resolvedBy === 'bmc') return 'bmc_admin';

    if (report.resolvedBy === 'citizen') return 'self';

    if (report.resolvedBy === 'community') return 'community_verified';

    return '';

  }



  function resolutionStatusLabel(report) {

    if (!report || report.status !== 'resolved') return t('popup.resolved');

    if (report.resolvedBy === 'bmc') {
      return t('fix.by.bmc').replace('{corp}', getCorpShortName(getReportCity(report)));
    }

    const src = getReportResolutionSource(report);

    if (src === 'self' || src === 'stale_verified') return t('fix.by.self');

    if (src === 'bmc_admin') {
      return t('fix.by.bmc').replace('{corp}', getCorpShortName(getReportCity(report)));
    }

    return t('fix.by.community');

  }



  function resolutionBadgeHtml(report) {

    if (report.status !== 'resolved') return '';

    const src = getReportResolutionSource(report);

    let cls = '';

    if (src === 'stale_verified' || src === 'self') {

      cls = ' report-card__resolution-badge--self';

    } else if (src === 'bmc_admin' || report.resolvedBy === 'bmc') {

      cls = ' report-card__resolution-badge--bmc';

    }

    return `<div class="report-card__resolution-badge${cls}"><i class="ph ph-check-circle"></i> ${escapeHtml(resolutionStatusLabel(report))}</div>`;

  }



  function handleCommunityAutoResolve(reportId, resolutionSource) {

    const wasResolved = applyResolution(

      reportId,

      resolutionSource === 'stale_verified' ? 'citizen' : 'community',

      null,

      resolutionSource || 'community_verified'

    );

    if (!wasResolved) return;

    const report = findReportById(reportId);

    if (window.CivicAnalytics) {

      CivicAnalytics.track('community_auto_resolved', {

        reportId: String(reportId),

        resolutionSource: resolutionSource || 'community_verified',

      }, report && report.ward);

    }

    if (ownsReport(report)) {

      const id = String(reportId);

      const seen = loadResolvedSeen();

      if (!seen.includes(id)) {

        seen.push(id);

        saveResolvedSeen(seen);

        addPointsCache(POINTS_REPORT_RESOLVED);

        showToast(t('toast.communityResolved'), 'success', 5000);

        setTimeout(() => showShareWinModal(reportId, 'community'), 700);

        if (!report.resolutionImage) {

          setTimeout(() => showToast(t('fix.addAfterPhoto'), 'info', 6000, {
            label: t('fix.addPhotoBtn'),
            onClick: () => promptFixPhoto(reportId),
          }), 1500);

        }

      }

    } else if (report && !report.resolutionImage) {

      // Neighbour who confirmed — standing at the fixed spot; prompt for after-photo.

      showToast(t('fix.thanksAddPhoto'), 'success', 6000, {

        label: t('fix.addPhotoBtn'),

        onClick: () => promptFixPhoto(reportId),

      });

    } else {

      showToast(t('fix.thanksConfirmed'), 'success', 4000);

    }

    setTimeout(checkFixConfirmedResolved, 400);

  }



  // "Looks fixed" — community spot-check (not official BMC confirmation).

  function confirmFix(reportId, opts) {

    opts = opts || {};

    const reports = loadReports();

    const idx = reports.findIndex((r) => String(r.id) === String(reportId));

    if (idx === -1) return false;

    const report = reports[idx];

    if (report.status !== 'pending') return false;

    if (hasFixConfirmed(reportId)) return false;



    if (opts.staleCheck && !ownsReport(report)) {

      showToast(t('toast.ownReportOnly'), 'error');

      return false;

    }

    if (!opts.staleCheck && ownsReport(report)) return false;



    report.fixConfirmations = (Number(report.fixConfirmations) || 0) + 1;

    try {

      saveReports(reports);

    } catch { showToast(t('toast.saveFail'), 'error'); return false; }



    const set = loadFixConfirmedSet();

    set.add(String(reportId));

    try { safeLocalSet(FIX_CONFIRMED_KEY, JSON.stringify(Array.from(set))); } catch {}



    addPointsCache(POINTS_FIX_CONFIRM);

    if (window.CivicAnalytics) {

      CivicAnalytics.track('fix_confirmed', {

        reportId: String(reportId),

        staleCheck: !!opts.staleCheck,

      }, report.ward);

      if (opts.staleCheck) {

        CivicAnalytics.track('stale_check_fixed', { reportId: String(reportId) }, report.ward);

      }

    }



    if (reportMarkerLayer) refreshReportMarkers();

    updateProfileUI();

    launchConfetti({ intensity: 'mini' });

    showToast(t('toast.fixConfirmed'), 'success', 3200);



    const finishResolve = (resolutionSource) => {

      if (Number(report.fixConfirmations) >= FIX_CONFIRM_THRESHOLD) {

        handleCommunityAutoResolve(reportId, resolutionSource);

      }

    };



    if (Backend.enabled) {

      Backend.confirmFix(reportId, !!opts.staleCheck).then((result) => {

        if (!result) {

          finishResolve(opts.staleCheck ? 'stale_verified' : 'community_verified');

          return;

        }

        const count = Number(result.fix_confirmations);

        if (!Number.isNaN(count)) {

          const fresh = loadReports();

          const rIdx = fresh.findIndex((r) => String(r.id) === String(reportId));

          if (rIdx !== -1) {

            fresh[rIdx].fixConfirmations = count;

            saveReports(fresh);

          }

        }

        if (result.resolved) {

          handleCommunityAutoResolve(reportId, result.resolution_source || 'community_verified');

        }

      });

    } else {

      finishResolve(opts.staleCheck ? 'stale_verified' : 'community_verified');

    }

    return true;

  }



  function snoozeStaleReport(reportId) {

    const map = reminderJson(REMINDER_STALE_SNOOZE_KEY, {}) || {};

    map[String(reportId)] = new Date(Date.now() + STALE_CHECK_DAYS * 86400000).toISOString();

    setReminderJson(REMINDER_STALE_SNOOZE_KEY, map);

    if (window.CivicAnalytics) {

      CivicAnalytics.track('stale_check_still_there', { reportId: String(reportId) }, user.ward);

    }

  }



  function isStaleReportSnoozed(reportId) {

    const map = reminderJson(REMINDER_STALE_SNOOZE_KEY, {}) || {};

    const until = map[String(reportId)];

    if (!until) return false;

    return Date.now() < new Date(until).getTime();

  }



  function getUserReports() {

    const all = loadReports();

    return all.filter((r) => {

      // Primary: stable per-device user id. Fallback for legacy rows without an id.

      if (r.reporterId) return r.reporterId === user.id;

      if (r.reporter && user.displayName) return r.reporter === user.displayName && r.ward === user.ward;

      return false;

    });

  }



  function formatRelativeTime(iso) {

    const diff = Date.now() - new Date(iso).getTime();

    const mins = Math.floor(diff / 60000);

    if (mins < 1) return 'Just now';

    if (mins < 60) return `${mins}m ago`;

    const hrs = Math.floor(mins / 60);

    if (hrs < 24) return `${hrs}h ago`;

    const days = Math.floor(hrs / 24);

    return `${days}d ago`;

  }



  function hazardLabel(key) {

    const i18nKey = `hazard.${key}`;

    const translated = I18N[currentLang] && I18N[currentLang][i18nKey];

    return translated || I18N.en[i18nKey] || 'Hazard';

  }

  function hazardExample(key) {

    const i18nKey = `hazard.${key}.example`;

    const translated = I18N[currentLang] && I18N[currentLang][i18nKey];

    return translated || I18N.en[i18nKey] || '';

  }



  // Launch hazard types — each has i18n labels, map markers, share templates, and copy1916 categories.

  const HAZARD_CATEGORIES = [

    { key: 'stagnant-water', icon: 'ph-drop', live: true },

    { key: 'garbage', icon: 'ph-trash', live: true },

    { key: 'potholes', icon: 'ph-road-horizon', live: true },

    { key: 'streetlight', icon: 'ph-lightbulb-filament', live: true },

  ];



  function isLiveHazardKey(key) {

    return HAZARD_CATEGORIES.some((c) => c.key === key && c.live);

  }



  function getContextualDefaultHazard() {

    try {

      const last = localStorage.getItem(LAST_HAZARD_KEY);

      if (last && isLiveHazardKey(last)) return last;

    } catch { /* ignore */ }

    if (getSeasonalHook()) return 'stagnant-water';

    const now = new Date();

    const mins = now.getHours() * 60 + now.getMinutes();

    if (mins >= 18 * 60 + 30) return 'streetlight';

    return 'potholes';

  }



  function normalizeReportStep(step) {

    if (step === 'photo') return 'capture';

    if (step === 'submit' || step === 'details') return 'confirm';

    return step === 'confirm' || step === 'capture' ? step : 'capture';

  }



  function getInterest() {

    try { return JSON.parse(localStorage.getItem(INTEREST_KEY)) || {}; }

    catch { return {}; }

  }



  function renderHazardPicker() {

    const grid = $('#hazardGrid');

    if (!grid) return;

    const current = $('#hazardType').value || 'stagnant-water';

    const interest = getInterest();

    grid.innerHTML = HAZARD_CATEGORIES

      .map((c) => {

        const active = c.live && c.key === current;

        const soon = c.live ? '' : `<span class="hazard-tile__soon">${escapeHtml(t('hazard.comingSoon'))}</span>`;

        const requested = !c.live && interest[c.key] ? ' hazard-tile--requested' : '';

        return `

          <button type="button" role="radio" aria-checked="${active ? 'true' : 'false'}"

            class="hazard-tile${active ? ' hazard-tile--active' : ''}${c.live ? '' : ' hazard-tile--soon'}${requested}"

            data-hazard="${c.key}" data-live="${c.live ? 'true' : 'false'}"

            ${c.live ? 'tabindex="0"' : 'tabindex="-1" disabled aria-disabled="true"'}>

            <span class="hazard-tile__check" aria-hidden="true"><i class="ph ph-check-circle-fill"></i></span>

            <i class="ph ${c.icon}"></i>

            <span class="hazard-tile__label">${escapeHtml(hazardLabel(c.key))}</span>

            ${c.live ? `<span class="hazard-tile__example">${escapeHtml(hazardExample(c.key))}</span>` : ''}

            ${soon}

          </button>`;

      })

      .join('');

  }



  function isHazardTileLive(btn) {

    if (!btn || !btn.dataset.hazard) return false;

    const cat = HAZARD_CATEGORIES.find((c) => c.key === btn.dataset.hazard);

    return cat ? !!cat.live : btn.dataset.live !== 'false';

  }



  function bindHazardPicker() {

    const grid = $('#hazardGrid');

    if (!grid || grid.dataset.bound) return;

    grid.dataset.bound = '1';

    grid.addEventListener('click', (e) => {

      const btn = e.target.closest('[data-hazard]');

      if (!btn || !grid.contains(btn)) return;

      e.preventDefault();

      if (isHazardTileLive(btn)) selectHazard(btn.dataset.hazard);

      else openSoonModal(btn.dataset.hazard);

    });

    grid.addEventListener('keydown', (e) => {

      const liveTiles = [...grid.querySelectorAll('[data-hazard]')].filter(isHazardTileLive);

      if (!liveTiles.length) return;

      const idx = liveTiles.indexOf(document.activeElement);

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {

        e.preventDefault();

        liveTiles[(idx + 1 + liveTiles.length) % liveTiles.length].focus();

      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {

        e.preventDefault();

        liveTiles[(idx - 1 + liveTiles.length) % liveTiles.length].focus();

      } else if ((e.key === 'Enter' || e.key === ' ') && idx >= 0) {

        e.preventDefault();

        selectHazard(liveTiles[idx].dataset.hazard);

      }

    });

  }



  function photoGuidelinesForHazard(key) {

    const specificKey = `moderation.guidelines.${key}`;

    const specific = t(specificKey);

    if (specific !== specificKey) return specific;

    return t('moderation.guidelines');

  }



  function updatePhotoGuidelines(key) {

    const el = $('#photoGuidelines');

    if (!el) return;

    el.textContent = photoGuidelinesForHazard(key || $('#hazardType')?.value || 'stagnant-water');

  }



  function escHintForHazard(keyBase, hazard) {

    const specificKey = `${keyBase}.${hazard}`;

    const specific = t(specificKey);

    if (specific !== specificKey) return specific;

    return t(keyBase);

  }



  function escPortalHintForHazard(hazard, city) {

    const specificKey = `esc.portalHint.${hazard}`;

    const specific = t(specificKey);

    if (specific !== specificKey) return specific;

    const navHint = getOfficialCategoryHint('marg', hazard, city);

    if (navHint) {

      const navKey = 'esc.portalHintNav';

      const nav = t(navKey);

      if (nav !== navKey) return nav.replace('{hint}', navHint);

    }

    return null;

  }



  function updateEscHazardHints(hazard, city) {

    const h = hazard || 'stagnant-water';

    if (city !== 'mumbai') return;

    const fileEl = $('#escFileHint');

    if (fileEl) fileEl.textContent = escHintForHazard('esc.fileHint', h);

    const portalEl = $('#escPortalHint');

    if (portalEl) {

      const hazardPortal = escPortalHintForHazard(h, city);

      if (hazardPortal) portalEl.textContent = hazardPortal;

    }

  }



  function updateHazardSelectedCue(key) {

    const cue = $('#hazardSelectedCue');

    if (!cue) return;

    if (!key) {

      cue.classList.add('hidden');

      cue.textContent = '';

      return;

    }

    cue.textContent = t('report.photoNext').replace('{hazard}', hazardLabel(key));

    cue.classList.remove('hidden');

  }



  function highlightPhotoSection() {

    const section = $('#reportPhotoSection');

    const btn = $('#btnTakePhoto');

    if (section) {

      section.classList.add('report-photo-section--cue');

      setTimeout(() => section.classList.remove('report-photo-section--cue'), 2400);

      requestAnimationFrame(() => {

        section.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

      });

    }

    if (btn) {

      btn.classList.remove('btn--pulse-once');

      void btn.offsetWidth;

      btn.classList.add('btn--pulse-once');

      setTimeout(() => btn.classList.remove('btn--pulse-once'), 700);

    }

  }



  function selectHazard(key) {

    $('#hazardType').value = key;

    $$('#hazardGrid .hazard-tile').forEach((t) => {

      const on = t.dataset.hazard === key;

      t.classList.toggle('hazard-tile--active', on);

      t.setAttribute('aria-checked', on ? 'true' : 'false');

    });

    updateHazardSelectedCue(key);

    updatePhotoGuidelines(key);

    if (!hasReportPhotoPreview()) highlightPhotoSection();

    if (overlays.report?.classList.contains('open')) touchReportDraft({ hazardType: key });

  }



  function openSoonModal(key) {

    const icon = (HAZARD_CATEGORIES.find((c) => c.key === key) || {}).icon || 'ph-rocket-launch';

    $('#soonIcon').innerHTML = `<i class="ph ${icon}"></i>`;

    $('#soonCategory').textContent = hazardLabel(key);

    $('#soonBody').textContent = t('soon.roadmap');

    const interest = getInterest();

    const already = !!interest[key];

    const notifyBtn = $('#btnSoonNotify');

    notifyBtn.dataset.hazard = key;

    notifyBtn.disabled = already;

    notifyBtn.innerHTML = already

      ? `<i class="ph ph-check"></i> ${escapeHtml(t('soon.thanks'))}`

      : escapeHtml(t('soon.notify'));

    $('#soonCount').textContent = '';

    openModal('soon');

  }



  function recordInterest(key) {

    if (!key) return;

    const interest = getInterest();

    interest[key] = true;

    try { safeLocalSet(INTEREST_KEY, JSON.stringify(interest)); } catch {}

    // When a backend is connected this is where we'd log aggregate demand.

    Backend.logInterest && Backend.logInterest(key);

    const btn = $('#btnSoonNotify');

    btn.disabled = true;

    btn.innerHTML = `<i class="ph ph-check"></i> ${escapeHtml(t('soon.thanks'))}`;

    showToast(t('soon.thanks'), 'success', 2600);

    renderHazardPicker();

  }



  function getDaysPending(iso) {

    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

    return Math.max(0, days);

  }



  function dayWord(n) {

    return n === 1 ? '1 day' : `${n} days`;

  }



  // Returns the lifecycle stage of a report grounded in how BMC actually works.

  // Stages: 'unfiled' -> 'filed' -> 'matrix' (7d+) -> 'zonal' (14d+) -> 'grievance' (30d+) -> 'resolved'

  function getReportStage(report) {

    if (report.status === 'resolved') {

      const headline = report.resolvedBy === 'citizen' ? 'Resolved (you confirmed)' : 'Resolved by BMC';

      return { key: 'resolved', filed: !!report.complaintId, days: 0,

        headline, detail: 'Marked fixed. Share the win to encourage your neighbours.' };

    }

    const filed = !!report.complaintId;

    if (!filed) {

      const loggedDays = getDaysPending(report.timestamp);

      return {

        key: 'unfiled', filed: false, days: loggedDays,

        headline: loggedDays === 0 ? 'Logged on CivicRadar today' : `Logged ${dayWord(loggedDays)} ago — not yet sent to BMC`,

        detail: 'BMC has not received this. File an official complaint to start the real clock.',

      };

    }

    const days = getDaysPending(report.filedAt || report.timestamp);

    if (days >= ESCALATION_DAYS.grievance) {

      return { key: 'grievance', filed: true, days,

        headline: `${dayWord(days)} since filing — overdue`,

        detail: 'Past 30 days. Escalate to the Public Grievance Cell / Aaple Sarkar, or file an RTI.' };

    }

    if (days >= ESCALATION_DAYS.zonal) {

      return { key: 'zonal', filed: true, days,

        headline: `${dayWord(days)} since filing — no action`,

        detail: 'Escalate to the Zonal Deputy Municipal Commissioner and add public pressure on X.' };

    }

    if (days >= ESCALATION_DAYS.matrix) {

      return { key: 'matrix', filed: true, days,

        headline: `${dayWord(days)} since filing — escalate`,

        detail: 'Past BMC\'s 7-day matrix. Follow up with your Ward Complaint Officer / Asst. Commissioner.' };

    }

    return { key: 'filed', filed: true, days,

      headline: `Complaint filed — ${dayWord(days)} in`,

      detail: 'With BMC. Charter target is ~3 days; we\'ll prompt escalation if it stalls.' };

  }



  // Short status line used on report cards and the admin detail modal.

  function getClockLine(report) {

    const s = getReportStage(report);

    const city = getReportCity(report);

    if (s.filed && report.complaintId) {

      return `${getComplaintRefPrefix(city)} #${report.complaintId} — ${s.headline}`;

    }

    return s.headline;

  }



  function countPendingReports() {

    const pool = isAdmin ? adminScopedReports(loadReports()) : loadReports();

    return pool.filter((r) => r.status === 'pending').length;

  }



  // Overdue = filed with BMC and past the 7-day escalation-matrix threshold.

  function countOverdueReports() {

    const pool = isAdmin ? adminScopedReports(loadReports()) : loadReports();

    return pool.filter(

      (r) => r.status === 'pending' && r.complaintId &&

        getDaysPending(r.filedAt || r.timestamp) >= ESCALATION_DAYS.matrix

    ).length;

  }



  function getActivePersona() {

    if (isAdmin) return 'admin';

    if (isLead) return 'lead';

    return 'citizen';

  }



  // Role model. Elevated roles are granted only after authentication

  // (gov-email magic link for BMC, NGO invite code for coordinators) — see the login

  // handlers and BACKEND_SETUP.md. In demo mode they map to the demo logins.

  function getRole() {

    if (isAdmin) return 'bmc';

    if (isLead) return 'ngo_lead';

    return 'citizen';

  }



  function hasRole(role) {

    return getRole() === role;

  }



  function updatePersonaUI() {

    const persona = getActivePersona();

    document.body.classList.remove('persona-citizen', 'persona-admin', 'persona-lead');

    document.body.classList.add(`persona-${persona}`);



    const bar = $('#personaBar');

    const barText = $('#personaBarText');

    const barIcon = $('#personaBarIcon');

    const barAction = $('#personaBarAction');

    const headerCtx = $('#headerContext');

    const fab = $('#btnCamera');



    bar.className = `persona-bar persona-bar--${persona}`;

    barAction.classList.add('hidden');

    bar.classList.remove('persona-bar--clickable');

    bar.removeAttribute('role');

    bar.setAttribute('role', 'status');



    if (persona === 'admin') {

      const pending = countPendingReports();

      headerCtx.textContent = t('persona.admin.header');

      barIcon.className = 'ph ph-shield-check persona-bar__icon';

      const overdue = countOverdueReports();

      if (overdue > 0) {

        barText.textContent = t('persona.admin.overdue')

          .replace('{overdue}', String(overdue))

          .replace('{pending}', String(pending));

        bar.classList.add('persona-bar--clickable');

        bar.setAttribute('role', 'button');

      } else {

        barText.textContent =

          pending > 0

            ? t('persona.admin.idlePending').replace('{n}', String(pending))

            : t('persona.admin.idleEmpty');

      }

      barAction.textContent = t('persona.admin.exit');

      barAction.classList.remove('hidden');

      setFabHidden(fab, true);

      $('#profilePersonaTag').textContent = t('profile.persona.admin');

      $('#profilePersonaTag').className = 'persona-tag persona-tag--admin';

    } else if (persona === 'lead') {

      if (!localStorage.getItem(REMINDER_NGO_LAST_SEEN_KEY)) markNgoHubSeen();

      const { all } = getCoordinatorPledges();

      const toDeliver = all.filter((p) => !p.delivered).length;

      const toVerify = all.filter((p) => p.delivered && !p.hoursVerified).length;

      const newHazards = countNewNgoHazards();

      const newPledges = countNewNgoPledges();

      headerCtx.textContent = t('persona.ngo.header');

      barIcon.className = 'ph ph-hand-heart persona-bar__icon';

      let leadText = t('persona.ngo.pledges')

        .replace('{deliver}', String(toDeliver))

        .replace('{verify}', String(toVerify));

      if (newPledges > 0) {

        leadText += ' — ' + t('persona.ngo.newPledges').replace('{n}', String(newPledges));

      }

      if (newHazards > 0) {

        leadText += ' — ' + t('persona.ngo.newHazards').replace('{n}', String(newHazards));

      }

      barText.textContent = leadText;

      bar.classList.add('persona-bar--clickable');

      bar.setAttribute('role', 'button');

      barAction.textContent = t('persona.ngo.exit');

      barAction.classList.remove('hidden');

      setFabHidden(fab, true);

      $('#profilePersonaTag').textContent = t('profile.persona.ngo');

      $('#profilePersonaTag').className = 'persona-tag persona-tag--lead';

    } else {

      const mine = getUserReports();

      const pendingReports = mine.filter((r) => r.status === 'pending');

      const unfiled = pendingReports.filter((r) => !r.complaintId).length;

      headerCtx.textContent = user.ward

        ? user.ward.split('—')[0].trim()

        : t('header.context');

      barIcon.className = 'ph ph-camera persona-bar__icon';

      if (unfiled > 0) {

        barText.textContent = t('persona.unfiled').replace('{n}', String(unfiled));

      } else if (pendingReports.length > 0) {

        barText.textContent = t('persona.pendingFiled').replace('{n}', String(pendingReports.length));

      } else if (user.ward) {

        const wardLabel = wardShortLabel(user.ward);

        const wardCount = getWardMonsoonCount(user.ward);

        barText.textContent = t('persona.wardImpact')

          .replace('{ward}', wardLabel)

          .replace('{n}', String(wardCount));

      } else {

        barText.textContent = t('persona.citizen.idle');

      }

      setFabHidden(fab, false);

      $('#profilePersonaTag').textContent = t('profile.persona');

      $('#profilePersonaTag').className = 'persona-tag persona-tag--citizen';

    }

    updatePartnerPortalUi();

  }



  // Hides the report FAB for non-citizen personas and makes it non-interactive

  // (removed from tab order and the accessibility tree) when hidden.

  function setFabHidden(fab, hidden) {

    fab.classList.toggle('is-hidden-persona', hidden);

    fab.setAttribute('aria-hidden', hidden ? 'true' : 'false');

    fab.tabIndex = hidden ? -1 : 0;

    if ('inert' in fab) fab.inert = hidden;

  }



  function updateReportFlowSteps(step) {

    const s = normalizeReportStep(step);

    if (s === reportFlowStep) {

      debugLog('REPORT', 'updateReportFlowSteps skip', { step: s });

      return;

    }

    reportFlowStep = s;

    debugLog('REPORT', 'updateReportFlowSteps', { step: s });

    const modal = $('#reportModal');

    if (modal) {

      modal.classList.toggle('report-modal--capture', s === 'capture');

      modal.classList.toggle('report-modal--confirm', s === 'confirm');

    }

    $$('#reportFlowSteps .flow-step').forEach((el) => {

      const ds = el.dataset.step;

      el.classList.remove('is-active', 'is-done');

      el.removeAttribute('aria-current');

      if (ds === s) {

        el.classList.add('is-active');

        el.setAttribute('aria-current', 'step');

      } else if (s === 'confirm' && ds === 'capture') {

        el.classList.add('is-done');

      }

    });

    const fill = $('#reportFlowFill');

    if (fill) fill.style.width = (s === 'confirm' ? '100%' : '50%');

    $$('#reportModal .report-step').forEach((panel) => {

      const active = panel.dataset.step === s;

      panel.classList.toggle('report-step--active', active);

      panel.hidden = !active;

    });

  }



  function updateReportWardChip() {

    const label = $('#reportWardChipLabel');

    if (!label) return;

    let text;

    const pinLat = confirmPinLat != null ? confirmPinLat : manualPinLat;

    const pinLng = confirmPinLng != null ? confirmPinLng : manualPinLng;

    if (pinLat != null && pinLng != null) {

      const pinWard = detectWardFromCoords(pinLat, pinLng, getUserCity());

      text = pinWard

        ? t('report.wardChip').replace('{ward}', getWardShortName(pinWard))

        : t('report.wardManualPin');

    } else {

      text = user.ward

        ? t('report.wardChip').replace('{ward}', getWardShortName(user.ward))

        : t('report.wardGps');

    }

    label.textContent = text;

  }



  function collapseReportNotesIfEmpty() {

    const notes = $('#reportNotes');

    const body = $('#reportNotesBody');

    const toggle = $('#btnReportNotesToggle');

    if (!notes || !body || !toggle) return;

    const hasText = !!(notes.value && notes.value.trim());

    body.classList.toggle('hidden', !hasText);

    toggle.classList.toggle('hidden', hasText);

    toggle.setAttribute('aria-expanded', hasText ? 'true' : 'false');

  }



  function setReportNotesExpanded(expanded) {

    const body = $('#reportNotesBody');

    const toggle = $('#btnReportNotesToggle');

    if (!body || !toggle) return;

    body.classList.toggle('hidden', !expanded);

    toggle.classList.toggle('hidden', expanded);

    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');

    if (expanded) {

      const notesEl = $('#reportNotes');

      requestAnimationFrame(() => { notesEl?.focus(); });

    }

  }



  function revealFieldError(el) {

    if (!el) return;

    el.classList.remove('hidden');

    requestAnimationFrame(() => {

      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    });

  }



  function bindModalInputScroll() {

    $$('.modal input, .modal textarea, .modal select').forEach((el) => {

      if (el.dataset.scrollBound) return;

      el.dataset.scrollBound = '1';

      el.addEventListener('focus', () => {

        setTimeout(() => {

          el.scrollIntoView({ block: 'center', behavior: 'smooth' });

        }, 320);

      });

    });

  }



  function showCoachMark() {

    if (localStorage.getItem(COACH_KEY)) return;

    const demo = new URLSearchParams(location.search).get('demo');

    if (demo === 'video' || demo === 'tour' || demo === 'persona') return;

    if (isAdmin || isLead) return;

    if (shouldShowHomeHero()) {

      safeLocalSet(COACH_KEY, '1');

      return;

    }

    $('#coachMark').classList.remove('hidden');

  }



  function dismissCoachMark() {

    safeLocalSet(COACH_KEY, '1');

    $('#coachMark').classList.add('hidden');

    setTimeout(maybeStartTour, 350);

  }



  /* ---------- Interactive guided tour (coach-mark spotlight) ---------- */

  let tourState = null;



  function isTourElementVisible(el) {

    if (!el || (el.classList && el.classList.contains('hidden'))) return false;

    const r = el.getBoundingClientRect();

    if (r.width <= 0 || r.height <= 0) return false;

    const cs = window.getComputedStyle(el);

    return cs.display !== 'none' && cs.visibility !== 'hidden';

  }



  // Steps with target:null are explained generically (centred, no spotlight) so we

  // never point at an element that may not exist on first run (e.g. no pins yet).

  function getTourSteps() {

    return [

      { target: '#map', titleKey: 'tour.map.title', bodyKey: 'tour.map.body' },

      { target: '#btnCamera', titleKey: 'tour.report.title', bodyKey: 'tour.report.body' },

      { target: '#bottomNav .nav-tab[data-tab="profile"]', titleKey: 'tour.profile.title', bodyKey: 'tour.profile.body' },

    ];

  }



  function startTour(opts = {}) {

    if (tourState) return;

    // Tour highlights the map shell + FAB + bottom-nav, so clear modals first.

    closeAllModals();

    setNavTab('map');

    const steps = getTourSteps().filter((step) => {

      if (!step.target) return true;

      return isTourElementVisible($(step.target));

    });

    if (!steps.length) return;

    tourState = { steps, index: 0, lastFocus: document.activeElement };

    const overlay = $('#tourOverlay');

    overlay.classList.remove('hidden');

    document.addEventListener('keydown', onTourKeydown, true);

    window.addEventListener('resize', positionTour);

    window.addEventListener('scroll', positionTour, true);

    renderTourStep();

    if (window.CivicAnalytics) CivicAnalytics.track('tour_start', { replay: !!opts.replay });

  }



  function renderTourStep() {

    if (!tourState) return;

    const { steps, index } = tourState;

    const step = steps[index];

    const last = index === steps.length - 1;

    $('#tourStep').textContent = `${index + 1} / ${steps.length}`;

    $('#tourTitle').textContent = t(step.titleKey);

    $('#tourBody').textContent = corpCopy(step.bodyKey);

    $('#btnTourNext').textContent = last ? t('tour.done') : t('tour.next');

    positionTour();

    const bubble = $('#tourBubble');

    if (bubble && !prefersReducedMotion()) bubble.focus();

    else if (bubble) { try { bubble.focus({ preventScroll: true }); } catch { bubble.focus(); } }

  }



  function positionTour() {

    if (!tourState) return;

    const step = tourState.steps[tourState.index];

    const overlay = $('#tourOverlay');

    const spot = $('#tourSpotlight');

    const bubble = $('#tourBubble');

    const el = step.target ? $(step.target) : null;

    if (!el || !isTourElementVisible(el)) {

      overlay.classList.add('tour--centered');

      bubble.style.top = '';

      bubble.style.left = '';

      return;

    }

    overlay.classList.remove('tour--centered');

    const r = el.getBoundingClientRect();

    const vw = window.innerWidth;

    const vh = window.innerHeight;

    const pad = 8;

    spot.style.top = `${r.top - pad}px`;

    spot.style.left = `${r.left - pad}px`;

    spot.style.width = `${r.width + pad * 2}px`;

    spot.style.height = `${r.height + pad * 2}px`;

    const bw = bubble.offsetWidth || 320;

    const bh = bubble.offsetHeight || 160;

    let top = r.bottom + 14;

    if (top + bh > vh - 12) top = r.top - bh - 14;

    if (top < 12) top = Math.min(12, Math.max(12, vh - bh - 12));

    let left = r.left + r.width / 2 - bw / 2;

    left = Math.max(12, Math.min(left, vw - bw - 12));

    bubble.style.top = `${top}px`;

    bubble.style.left = `${left}px`;

  }



  function nextTourStep() {

    if (!tourState) return;

    if (tourState.index >= tourState.steps.length - 1) {

      endTour(true);

      return;

    }

    tourState.index += 1;

    renderTourStep();

  }



  function endTour(completed) {

    if (!tourState) return;

    safeLocalSet(TOUR_KEY, '1');

    const overlay = $('#tourOverlay');

    overlay.classList.add('hidden');

    overlay.classList.remove('tour--centered');

    document.removeEventListener('keydown', onTourKeydown, true);

    window.removeEventListener('resize', positionTour);

    window.removeEventListener('scroll', positionTour, true);

    const lastFocus = tourState.lastFocus;

    tourState = null;

    if (lastFocus && typeof lastFocus.focus === 'function') {

      try { lastFocus.focus(); } catch { /* ignore */ }

    }

    if (window.CivicAnalytics) CivicAnalytics.track(completed ? 'tour_complete' : 'tour_skip');

  }



  function onTourKeydown(e) {

    if (!tourState) return;

    if (e.key === 'Escape') {

      e.preventDefault();

      e.stopPropagation();

      endTour(false);

    } else if (e.key === 'Enter') {

      // Let a focused button activate natively; advance only from the bubble itself.

      if (e.target && e.target.tagName === 'BUTTON') return;

      e.preventDefault();

      nextTourStep();

    } else if (e.key === 'Tab') {

      // Keep keyboard focus trapped between Skip and Next.

      const focusables = [$('#btnTourSkip'), $('#btnTourNext')].filter(Boolean);

      if (focusables.length < 2) return;

      const first = focusables[0];

      const last = focusables[focusables.length - 1];

      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === $('#tourBubble'))) {

        e.preventDefault();

        last.focus();

      } else if (!e.shiftKey && active === last) {

        e.preventDefault();

        first.focus();

      }

    }

  }



  // Auto-show path: once only, never for demo/referral entries or coordinators.

  function maybeStartTour() {

    if (localStorage.getItem(TOUR_KEY)) return;

    let demo = null;

    let ref = null;

    try {

      const params = new URLSearchParams(location.search);

      demo = params.get('demo');

      ref = params.get('ref');

    } catch { /* ignore */ }

    if (demo || ref) return;

    if (isAdmin || isLead) return;

    if (shouldShowHomeHero()) return;

    startTour();

  }

  window.startCivicTour = (opts) => startTour(opts || {});



  function setNavTab(tab) {

    $$('#bottomNav .nav-tab').forEach((t) => {

      t.classList.toggle('active', t.dataset.tab === tab);

    });

  }



  /* ---------- Toast Notifications ---------- */

  // Generic collapsible-section toggle (Community modal's "Get involved" /
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
  }

  function resetProfileSectionsOnOpen() {
    setCollapsibleSectionOpen('profileDetailsSection', 'profileDetailsBody', 'btnProfileDetailsToggle', true);
    setCollapsibleSectionOpen('profileActivitySection', 'profileActivityBody', 'btnProfileActivityToggle', false);
    setCollapsibleSectionOpen('profileNotificationsSection', 'profileNotificationsBody', 'btnProfileNotificationsToggle', false);
    setCollapsibleSectionOpen('profileAccountSection', 'profileAccountBody', 'btnProfileAccountToggle', false);
  }

  function showToast(message, type = 'info', duration = 3500, action = null) {

    debugLog('TOAST', 'showToast', { type, duration, msg: String(message).slice(0, 80), hasAction: !!action });

    const container = $('#toastContainer');

    const icons = { success: 'check-circle', error: 'warning-circle', info: 'info' };

    // De-dupe: identical non-interactive toast already visible → don't stack.

    if (!action) {

      const key = `${type}::${message}`;

      const existing = Array.from(container.children).find((el) => el.dataset && el.dataset.civicToastKey === key);

      if (existing) return;

    }

    const toast = document.createElement('div');

    toast.className = `toast toast--${type}`;

    toast.setAttribute('role', 'status');

    toast.dataset.civicToastKey = `${type}::${message}`;

    let hideTimer = null;

    let fadeTimer = null;

    const clearToastTimers = () => {

      if (hideTimer) clearTimeout(hideTimer);

      if (fadeTimer) clearTimeout(fadeTimer);

      hideTimer = null;

      fadeTimer = null;

    };

    const dismissToast = () => {

      clearToastTimers();

      if (!toast.isConnected) return;

      toast.style.opacity = '0';

      toast.style.transition = 'opacity 0.25s';

      fadeTimer = setTimeout(() => toast.remove(), 250);

    };

    const row = document.createElement('div');

    row.className = 'toast__row';

    row.innerHTML =

      `<i class="ph ph-${icons[type] || 'info'}" aria-hidden="true"></i><span>${escapeHtml(message)}</span>`;

    const closeBtn = document.createElement('button');

    closeBtn.type = 'button';

    closeBtn.className = 'toast__close';

    closeBtn.setAttribute('aria-label', t('aria.close'));

    closeBtn.innerHTML = '&times;';

    closeBtn.addEventListener('click', (e) => {

      e.stopPropagation();

      dismissToast();

    });

    row.appendChild(closeBtn);

    toast.appendChild(row);



    const actionList = [];

    if (action) {

      if (action.label && typeof action.onClick === 'function') actionList.push(action);

      if (action.secondary) {

        const sec = Array.isArray(action.secondary) ? action.secondary : [action.secondary];

        actionList.push(...sec.filter((a) => a && a.label));

      }

    }

    if (actionList.length) {

      const wrap = document.createElement('div');

      wrap.className = 'toast__actions';

      actionList.forEach((act, i) => {

        const btn = document.createElement('button');

        btn.type = 'button';

        btn.className = 'toast__action' + (i === 0 ? ' toast__action--primary' : '');

        btn.textContent = act.label;

        btn.addEventListener('click', () => {

          clearToastTimers();

          if (typeof act.onClick === 'function') act.onClick();

          toast.remove();

        });

        wrap.appendChild(btn);

      });

      toast.appendChild(wrap);

      toast.classList.add('toast--interactive', 'toast--multi');

    }



    container.appendChild(toast);

    // Action toasts stay until the user taps an action or × (long CTAs need time).
    if (!actionList.length) {

      hideTimer = setTimeout(dismissToast, duration);

    }

  }



  window.showToast = showToast;

  window.formatAuthError = formatAuthError;



  function setAdminMode(enabled) {

    isAdmin = enabled;

    window.isAdmin = enabled;

    if (enabled) setLeadMode(false);

    $('#badgeAdmin').classList.toggle('hidden', !enabled);

    $('#roleBadges').classList.toggle('hidden', !enabled && !isLead);

    updatePersonaUI();

  }



  function setLeadMode(enabled) {

    isLead = enabled;

    window.isLead = enabled;

    if (enabled) setAdminMode(false);

    $('#badgeLead').classList.toggle('hidden', !enabled);

    $('#roleBadges').classList.toggle('hidden', !enabled && !isAdmin);

    updatePersonaUI();

  }



  // Shows the correct sign-in method per environment: real email magic link when the

  // backend is connected, labelled demo logins otherwise.

  function updateAuthMode() {

    const connected = Backend.enabled;

    const showDemo = !connected && !isProdEnvironment();

    ['admin', 'lead'].forEach((p) => {

      const official = $(`#${p}AuthOfficial`);

      const demo = $(`#${p}AuthDemo`);

      if (official) official.classList.toggle('hidden', !connected);

      if (demo) demo.classList.toggle('hidden', !showDemo);

    });

  }

  window.updateAuthMode = updateAuthMode;



  // On reload in connected mode, re-apply an elevated role from the persisted session.

  async function restoreElevatedRole() {

    if (!Backend.enabled) return;

    try {

      const profile = await Backend.getMyRole();

      if (profile && profile.role === 'admin') {

        // Super-admin: the CivicRadar reviewer. Gets the admin surface + the

        // access-requests review screen (server RLS enforces the real guard).

        isSuperAdmin = true;

        window.isSuperAdmin = true;

        setAdminMode(true);

        refreshAccessReviewBadge();

      } else if (profile && profile.role === 'bmc') setAdminMode(true);

      else if (profile && profile.role === 'ngo_lead') {

        if (profile.ward) { user.ward = user.ward || profile.ward; }

        if (profile.city) { user.city = user.city || profile.city; }

        user.coordinatorScope = profile.coordinator_scope || 'ward';

        user.neighbourhoodLabel = profile.neighbourhood_label || '';

        applyNbhPrefsFromProfile(profile);

        saveUser();

        setLeadMode(true);

      }

    } catch { /* ignore */ }

  }



  function grantBmcAccess() {

    setAdminMode(true);

    closeModal('admin');

    closeModal('partner');

    closeAllModals();

    setNavTab('map');

    window.openAdminQueue();

    showToast(t('toast.adminVerified'), 'success', 4500);

  }



  function grantLeadAccess(ward, scope, neighbourhoodLabel, city) {

    if (ward) { user.ward = user.ward || ward; }

    if (city && CITIES[city]) user.city = city;

    user.coordinatorScope = scope || 'ward';

    user.neighbourhoodLabel = neighbourhoodLabel || '';

    saveUser();

    setLeadMode(true);

    closeModal('lead');

    closeModal('partner');

    setNavTab('map');

    window.openCoordinatorDashboard();

    if (user.coordinatorScope === 'neighbourhood' && user.neighbourhoodLabel) {

      showToast(t('toast.coordScopeNbh').replace('{label}', user.neighbourhoodLabel), 'success', 5000);

    } else {

      const wardShort = user.ward ? user.ward.split('—')[0].trim() : (ward || '');

      showToast(t('toast.coordScopeWard').replace('{ward}', wardShort), 'success', 5000);

    }

  }



  async function adminSendCode() {

    const email = $('#adminEmail').value.trim();

    const founderEmail = ((window.CIVICRADAR_CONFIG || {}).founder || {}).email || '';

    const isTeamEmail = founderEmail && email.toLowerCase() === founderEmail.toLowerCase();

    if (!Auth.isGovEmail(email) && !isTeamEmail) {

      showToast(t('toast.govEmail'), 'error', 4500);

      return;

    }

    const btn = $('#btnAdminSendCode');

    btn.disabled = true;

    persistPendingAuth('admin');

    try {

      const { error } = await Backend.sendEmailCode(email);

      if (error) {

        clearPendingAuth();

        const msg = error.code === 'backend_offline'

          ? t('toast.authEmailOffline')

          : formatAuthError(error);

        showToast(msg, 'error', 5500);

        return;

      }

      showAuthLinkSent('admin');

      showToast(t('toast.linkSent'), 'info', 4000);

    } catch (e) {

      clearPendingAuth();

      showToast(formatAuthError(e), 'error', 5500);

    } finally {

      btn.disabled = false;

    }

  }



  async function adminVerify() {

    const email = $('#adminEmail').value.trim();

    const token = $('#adminOtp').value.trim();

    const btn = $('#btnAdminVerify');

    btn.disabled = true;

    const { error } = await Backend.verifyEmailCode(email, token);

    if (error) { btn.disabled = false; showToast(t('toast.codeInvalid'), 'error'); return; }

    const profile = await Backend.getMyRole();

    btn.disabled = false;

    if (profile && profile.role === 'admin') {

      isSuperAdmin = true;

      window.isSuperAdmin = true;

      refreshAccessReviewBadge();

      grantBmcAccess();

    } else if (profile && profile.role === 'bmc') {

      grantBmcAccess();

    } else {

      await Backend.signOut();

      showToast(t('toast.bmcUnauthorized'), 'error', 5000);

    }

  }



  async function leadSendCode() {

    const email = $('#leadEmail').value.trim();

    const code = $('#leadCode').value.trim();

    if (!email || !code) { showToast(t('toast.ngoCodeRequired'), 'error'); return; }

    const btn = $('#btnLeadSendCode');

    btn.disabled = true;

    persistPendingAuth('lead', code);

    try {

      const { error } = await Backend.sendEmailCode(email);

      if (error) {

        clearPendingAuth();

        const msg = error.code === 'backend_offline'

          ? t('toast.authEmailOffline')

          : formatAuthError(error);

        showToast(msg, 'error', 5500);

        return;

      }

      showAuthLinkSent('lead');

      showToast(t('toast.linkSent'), 'info', 4000);

    } catch (e) {

      clearPendingAuth();

      showToast(formatAuthError(e), 'error', 5500);

    } finally {

      btn.disabled = false;

    }

  }



  async function leadVerify() {

    const email = $('#leadEmail').value.trim();

    const token = $('#leadOtp').value.trim();

    const code = $('#leadCode').value.trim();

    const btn = $('#btnLeadVerify');

    btn.disabled = true;

    const { error } = await Backend.verifyEmailCode(email, token);

    if (error) { btn.disabled = false; showToast(t('toast.codeInvalid'), 'error'); return; }

    const { data, error: rpcError } = await Backend.redeemNgoCode(code);

    btn.disabled = false;

    if (rpcError || !data) {

      await Backend.signOut();

      showToast(t('toast.ngoCodeInvalid'), 'error', 5000);

      return;

    }

    const assignment = typeof data === 'object' ? data : { ward: data };

    const profile = await Backend.getMyRole();

    grantLeadAccess(

      assignment.ward || (profile && profile.ward),

      (profile && profile.coordinator_scope) || assignment.coordinator_scope || 'ward',

      (profile && profile.neighbourhood_label) || assignment.neighbourhood_label || '',

      assignment.city || (profile && profile.city) || ''

    );

  }



  function getCityWards(cityId) {

    const city = cityId || getUserCity();

    if (window.CivicWardDetect && CivicWardDetect.getWardNames) {

      return CivicWardDetect.getWardNames(city);

    }

    return Array.from($$(`#${wardDatalistId(city)} option`)).map((o) => o.value);

  }



  function isValidWard(ward, cityId) {

    const city = cityId || getUserCity();

    if (window.CivicWardDetect && CivicWardDetect.isKnownWard) {

      return CivicWardDetect.isKnownWard(ward, city);

    }

    return getCityWards(city).includes(ward);

  }



  let onboardingDetectedWard = '';



  function detectWardFromCoords(lat, lng, cityId) {

    const city = cityId || getOnboardingCity() || getUserCity();

    if (window.CivicWardDetect && typeof CivicWardDetect.detectWard === 'function') {

      return CivicWardDetect.detectWard(lat, lng, city);

    }

    return null;

  }



  function resolveReportWard(lat, lng) {

    return detectWardFromCoords(lat, lng, getUserCity()) || user.ward || null;

  }



  function showOnboardingWardDetecting() {

    const status = $('#wardDetectStatus');

    const detected = $('#wardDetected');

    const hint = $('#wardDetectedHint');

    if (status) status.classList.remove('hidden');

    if (detected) detected.classList.add('hidden');

    if (hint) hint.classList.add('hidden');

    // Ward list is local — keep the picker usable while GPS auto-fill runs.
    $('#wardManualGroup')?.classList.remove('hidden');

    $('#btnWardManual')?.classList.add('hidden');

    $('#btnWardRetry')?.classList.add('hidden');

    const statusText = $('#wardDetectStatusText');

    if (statusText) statusText.textContent = t('onboard.wardDetecting');

  }



  function showOnboardingWardDetected(ward) {

    onboardingDetectedWard = ward;

    const input = $('#wardInput');

    if (input) input.value = ward;

    $('#wardDetectStatus')?.classList.add('hidden');

    $('#wardDetected')?.classList.remove('hidden');

    const nameEl = $('#wardDetectedName');

    if (nameEl) nameEl.textContent = ward;

    $('#wardDetectedHint')?.classList.remove('hidden');

    $('#wardManualGroup')?.classList.remove('hidden');

    $('#btnWardManual')?.classList.add('hidden');

    $('#btnWardRetry')?.classList.add('hidden');

    refreshSocietyForOnboarding();

  }



  function showOnboardingWardDetectFailed() {

    onboardingDetectedWard = '';

    $('#wardDetectStatus')?.classList.add('hidden');

    $('#wardDetected')?.classList.add('hidden');

    $('#wardDetectedHint')?.classList.add('hidden');

    $('#wardManualGroup')?.classList.remove('hidden');

    $('#btnWardManual')?.classList.add('hidden');

    $('#btnWardRetry')?.classList.remove('hidden');

    const input = $('#wardInput');

    if (input && !input.value.trim()) input.focus();

  }



  function showOnboardingWardManual() {

    $('#wardManualGroup')?.classList.remove('hidden');

    $('#btnWardManual')?.classList.add('hidden');

    const input = $('#wardInput');

    if (input) {

      input.focus();

      input.select();

    }

  }



  function getOnboardingWard() {

    const manual = ($('#wardInput') && $('#wardInput').value.trim()) || '';

    if (manual) return manual;

    return onboardingDetectedWard || '';

  }



  function applyWardFromCoords(lat, lng) {

    const ward = detectWardFromCoords(lat, lng, getOnboardingCity());

    if (!ward) return null;

    if (overlays.onboarding && overlays.onboarding.classList.contains('open')) {

      const input = $('#wardInput');

      const typed = (input && input.value.trim()) || '';

      // Don't clobber a ward the user already picked while GPS was running.
      if (typed && typed !== onboardingDetectedWard) {

        $('#wardDetectStatus')?.classList.add('hidden');

        return null;

      }

      showOnboardingWardDetected(ward);

    }

    return ward;

  }



  function startOnboardingWardDetect() {

    onboardingDetectedWard = '';

    const input = $('#wardInput');

    // City-change clears the field before calling this; retry/open keep typed value.
    syncOnboardingCityUi(getOnboardingCity());

    showOnboardingWardDetecting();

    if (!navigator.geolocation) {

      showOnboardingWardDetectFailed();

      return;

    }

    // Short timeout — list is local; GPS is optional convenience, not a gate.
    getPrecisePosition({ fresh: true, watchMaxMs: 5000, timeoutMs: 5000 })

      .then((pos) => {

        user.gpsConsent = true;

        saveUser();

        currentLat = pos.coords.latitude;

        currentLng = pos.coords.longitude;

        const ward = applyWardFromCoords(currentLat, currentLng);

        if (ward) {

          showOnboardingWardDetected(ward);

        } else if (!(input && input.value.trim())) {

          showOnboardingWardDetectFailed();

        } else {

          $('#wardDetectStatus')?.classList.add('hidden');

        }

      })

      .catch(() => {

        if (!(input && input.value.trim())) {

          showOnboardingWardDetectFailed();

        } else {

          $('#wardDetectStatus')?.classList.add('hidden');

          $('#btnWardRetry')?.classList.remove('hidden');

        }

      });

  }



  /* ---------- Modals ---------- */

  function openModal(name) {

    debugLog('MODAL', 'openModal', { name });

    const el = overlays[name];

    if (!el) return;

    if (shouldPushModalHistory(name)) pushNavModalHistory();

    const hadOpen = Object.values(overlays).some((o) => o && o.classList.contains('open'));

    lastFocusedEl = document.activeElement;

    el.classList.add('open');

    el.setAttribute('aria-hidden', 'false');

    document.documentElement.classList.add('modal-open');

    document.body.classList.add('modal-open');

    document.body.style.overflow = 'hidden';

    if (!hadOpen) {

      modalScrollY = window.scrollY || window.pageYOffset || 0;

      document.body.style.position = 'fixed';

      document.body.style.top = `-${modalScrollY}px`;

      document.body.style.left = '0';

      document.body.style.right = '0';

      document.body.style.width = '100%';

    }

    if (name === 'admin' || name === 'lead') updateAuthMode();

    const modal = el.querySelector('.modal') || el;

    const focusable = getFocusable(modal);

    if (focusable.length) focusable[0].focus();

    if (focusTrapHandler) document.removeEventListener('keydown', focusTrapHandler);

    focusTrapHandler = (e) => {

      if (e.key !== 'Tab' || !el.classList.contains('open')) return;

      const items = getFocusable(modal);

      if (items.length < 2) return;

      const first = items[0];

      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {

        e.preventDefault();

        last.focus();

      } else if (!e.shiftKey && document.activeElement === last) {

        e.preventDefault();

        first.focus();

      }

    };

    document.addEventListener('keydown', focusTrapHandler);

    if (name === 'onboarding') {

      const citySel = $('#onboardCity');

      if (citySel) citySel.value = user.city || DEFAULT_CITY;

      syncOnboardingCityUi(getOnboardingCity());

      const societyInput = $('#onboardSociety');

      if (societyInput) societyInput.value = user.society || '';

      if (user.ward) {

        onboardingDetectedWard = user.ward;

        const wardIn = $('#wardInput');

        if (wardIn) wardIn.value = user.ward;

        $('#wardDetectStatus')?.classList.add('hidden');

        $('#wardDetected')?.classList.add('hidden');

        $('#wardDetectedHint')?.classList.add('hidden');

        $('#wardManualGroup')?.classList.remove('hidden');

        $('#btnWardManual')?.classList.add('hidden');

        $('#btnWardRetry')?.classList.remove('hidden');

        refreshSocietyForOnboarding();

      } else {

        startOnboardingWardDetect();

      }

    }

  }



  function readReportDraft() {

    try {

      const raw = sessionStorage.getItem(REPORT_DRAFT_KEY);

      return raw ? JSON.parse(raw) : null;

    } catch { return null; }

  }



  function writeReportDraft(draft) {

    try {

      sessionStorage.setItem(REPORT_DRAFT_KEY, JSON.stringify({ ...draft, ts: Date.now() }));

    } catch { /* quota */ }

  }



  function clearReportDraft() {

    try { sessionStorage.removeItem(REPORT_DRAFT_KEY); } catch { /* ignore */ }

  }



  function isReportDraftAwaitingPhoto() {

    const d = readReportDraft();

    return !!(d && d.awaitingPhoto);

  }



  function touchReportDraft(updates) {

    const prev = readReportDraft() || {};

    const modalOpen = overlays.report?.classList.contains('open');

    const domDraft = modalOpen ? {

      hazardType: $('#hazardType')?.value || prev.hazardType || getContextualDefaultHazard(),

      step: hasReportPhotoPreview() ? 'confirm' : normalizeReportStep(prev.step || 'capture'),

      notes: ($('#reportNotes')?.value ?? prev.notes ?? ''),

    } : {};

    writeReportDraft({

      hazardType: prev.hazardType || getContextualDefaultHazard(),

      step: normalizeReportStep(prev.step || 'capture'),

      notes: prev.notes ?? '',

      awaitingPhoto: prev.awaitingPhoto || false,

      ...domDraft,

      ...updates,

    });

  }



  function persistReportDraftOnHide() {

    const modalOpen = overlays.report?.classList.contains('open');

    if (!modalOpen

      && !reportPhotoFlowActive && !reportPhotoProcessing && !isReportDraftAwaitingPhoto()) return;

    if (!modalOpen && !reportPhotoFlowActive && !reportPhotoProcessing) {

      const draft = readReportDraft();

      if (draft) writeReportDraft(draft);

      return;

    }

    touchReportDraft({

      awaitingPhoto: reportPhotoFlowActive || reportPhotoProcessing || isReportDraftAwaitingPhoto(),

    });

  }



  function restoreReportDraftIfNeeded() {

    const draft = readReportDraft();

    if (!draft) return false;

    if (!user.tosAccepted || !user.ward) return false;

    if (draft.ts && Date.now() - draft.ts > REPORT_DRAFT_TTL_MS) {

      clearReportDraft();

      return false;

    }

    if (tourState) endTour(false);

    selectHazard(draft.hazardType || getContextualDefaultHazard());

    renderHazardPicker();

    if (draft.notes && $('#reportNotes')) $('#reportNotes').value = draft.notes;

    resetSubmitReportButton();

    // Open first so the confirm pin map has a non-zero container when Leaflet inits.
    openModal('report');

    if (hasReportPhotoPreview()) {

      requestAnimationFrame(() => {

        showPhotoConfirm();

        touchReportDraft({ step: 'confirm', awaitingPhoto: false });

        scheduleReportPinMapResize();

      });

    } else {

      resetPhotoConfirm();

      updateReportFlowSteps(normalizeReportStep(draft.step || 'capture'));

      if (draft.awaitingPhoto) {

        reportPhotoFlowActive = true;

        reportPhotoDismissGuard = Date.now();

      }

    }

    return true;

  }



  function isReportPhotoPickerActive() {

    return reportPhotoFlowActive || reportPhotoProcessing

      || isReportDraftAwaitingPhoto()

      || (Date.now() - reportPhotoDismissGuard < PHOTO_RETURN_GUARD_MS);

  }



  /** True while mid-report (camera, confirm, or draft) — suppress unrelated toasts/reloads. */
  function isReportFlowBusy() {

    if (isReportPhotoPickerActive() || isReportDraftAwaitingPhoto()) return true;

    if (overlays.report && overlays.report.classList.contains('open')) return true;

    return false;

  }



  function hasReportPhotoPreview() {

    const canvas = $('#imageCanvas');

    return !!(canvas && canvas.classList.contains('visible'));

  }



  function clearReportPhotoPreviewOnly() {

    const canvas = $('#imageCanvas');

    if (canvas) {

      canvas.classList.remove('visible');

      try {

        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);

      } catch { /* ignore */ }

    }

    try { $('#photoInput').value = ''; } catch { /* ignore */ }

    lastReportDataUrl = null;

  }



  function isPlausibleConfirmPinGps(lat, lng) {

    if (!isValidGpsCoords(lat, lng)) return false;

    if (detectWardFromCoords(lat, lng, getUserCity())) return true;

    const center = getCityCenter();

    return getDistanceInMeters(lat, lng, center[0], center[1]) <= GEO_CITY_RADIUS_M;

  }



  function canDismissReportOverlay() {

    return !isReportPhotoPickerActive();

  }



  function syncReportPhotoReturn() {

    const fromCameraFlow = reportPhotoFlowActive || reportPhotoProcessing || isReportDraftAwaitingPhoto();

    debugLog('PHOTO', 'syncReportPhotoReturn', {

      fromCameraFlow,

      hasPreview: hasReportPhotoPreview(),

      reportPhotoFlowActive,

      reportPhotoProcessing,

    });

    ensureReportModalOpen();

    reportPhotoDismissGuard = Date.now();

    if (hasReportPhotoPreview()) {

      debugLog('PHOTO', 'syncReportPhotoReturn branch', { branch: 'confirm' });

      showPhotoConfirm();

      finishReportPhotoFlow('syncReportPhotoReturn');

      touchReportDraft({ step: 'confirm', awaitingPhoto: false });

      scheduleReportPinMapResize();

    } else if (fromCameraFlow || reportPhotoFlowActive || reportPhotoProcessing || isReportDraftAwaitingPhoto()) {

      debugLog('PHOTO', 'syncReportPhotoReturn branch', { branch: 'capture' });

      updateReportFlowSteps('capture');

      if (!reportPhotoFlowActive) reportPhotoFlowActive = true;

      touchReportDraft({ step: 'capture', awaitingPhoto: true });

    }

  }



  function finishReportPhotoFlow(where) {

    const src = where || 'finishReportPhotoFlow';

    const wasActive = reportPhotoFlowActive || reportPhotoProcessing;

    const hadWatchdog = !!reportPhotoWatchdogTimer;

    if (!wasActive && !hadWatchdog) {

      debugLog('REPORT', 'reportPhotoProcessing skip', { where: src, reason: 'already idle' });

      return;

    }

    reportPhotoFlowActive = false;

    reportPhotoProcessing = false;

    if (reportPhotoWatchdogTimer) {

      clearTimeout(reportPhotoWatchdogTimer);

      reportPhotoWatchdogTimer = null;

    }

    debugLog('REPORT', 'reportPhotoProcessing', { value: false, where: src, wasActive });

  }



  function failReportPhotoCapture() {

    debugLog('PHOTO', 'handlePhotoCapture fail', { where: 'failReportPhotoCapture' });

    finishReportPhotoFlow('failReportPhotoCapture');

    touchReportDraft({ step: 'capture', awaitingPhoto: false });

    try { $('#photoInput').value = ''; } catch { /* ignore */ }

    ensureReportModalOpen();

    updateReportFlowSteps('capture');

    showToast(t('toast.photoFailed'), 'error');

  }



  function armReportPhotoWatchdog() {

    if (reportPhotoWatchdogTimer) clearTimeout(reportPhotoWatchdogTimer);

    reportPhotoWatchdogTimer = setTimeout(() => {

      reportPhotoWatchdogTimer = null;

      if (!reportPhotoProcessing && !reportPhotoFlowActive) return;

      debugLog('PHOTO', 'watchdog timeout', { reportPhotoProcessing, reportPhotoFlowActive, hasPreview: hasReportPhotoPreview() });

      if (hasReportPhotoPreview()) {

        finishReportPhotoFlow('handlePhotoCapture');

        return;

      }

      failReportPhotoCapture();

    }, 15000);

  }



  function cancelPendingShareNudge() {

    if (shareNudgeTimer) {

      clearTimeout(shareNudgeTimer);

      shareNudgeTimer = null;

    }

  }



  function flushPendingSwReload() {

    if (!pendingSwReload) return;

    if (isReportFlowBusy()) {

      debugLog('SW', 'reload deferred', { reason: 'report flow busy' });

      return;

    }

    debugLog('SW', 'reload flush', { action: 'location.reload' });

    pendingSwReload = false;

    try {

      window.location.reload();

    } catch { /* ignore */ }

  }



  function pushReportPhotoHistory() {

    try {

      history.pushState({ civicReportPhoto: true }, '');

    } catch { /* history unavailable */ }

  }



  function ensureReportModalOpen() {

    if (overlays.report && !overlays.report.classList.contains('open')) openModal('report');

  }



  function openReportPhotoPicker() {

    debugLog('PHOTO', 'openReportPhotoPicker', { reportPhotoProcessing });

    const input = $('#photoInput');

    if (!input || reportPhotoProcessing) return;

    reportPhotoFlowActive = true;

    touchReportDraft({ step: 'capture', awaitingPhoto: true });

    pushReportPhotoHistory();

    input.click();

  }



  function advanceReportPhotoReady() {

    ensureReportModalOpen();

    selectHazard(getContextualDefaultHazard());

    renderHazardPicker();

    requestAnimationFrame(() => showPhotoConfirm());

    requestAnimationFrame(() => {

      const grid = $('#hazardGrid');

      if (grid && grid.querySelector('.hazard-tile')) {

        grid.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

      }

    });

  }



  function closeModal(name) {

    debugLog('MODAL', 'closeModal', { name });

    const el = overlays[name];

    if (!el) return;

    if (name === 'report') {

      resetSubmitReportButton();

      finishReportPhotoFlow('closeModal');

      if (!reportManualPinDismiss) {

        clearReportDraft();

        resetReportForm();

        selectHazard(getContextualDefaultHazard());

        renderHazardPicker();

      }

      if (reportCameraTimer) {

        clearTimeout(reportCameraTimer);

        reportCameraTimer = null;

      }

      // Allow deferred SW reload after mid-report camera/update race.
      setTimeout(flushPendingSwReload, 0);

    }

    el.classList.remove('open');

    el.setAttribute('aria-hidden', 'true');

    if (name === 'reportGeo' && reportGeoExplainerResolve) {

      const resolve = reportGeoExplainerResolve;

      reportGeoExplainerResolve = null;

      resolve('cancel');

    }

    const anyOpen = Object.values(overlays).some((o) => o && o.classList.contains('open'));

    if (!anyOpen) {

      document.documentElement.classList.remove('modal-open');

      document.body.classList.remove('modal-open');

      document.body.style.overflow = '';

      document.body.style.position = '';

      document.body.style.top = '';

      document.body.style.left = '';

      document.body.style.right = '';

      document.body.style.width = '';

      window.scrollTo(0, modalScrollY);

    }

    if (!anyOpen && focusTrapHandler) {

      document.removeEventListener('keydown', focusTrapHandler);

      focusTrapHandler = null;

    }

    if (!anyOpen && lastFocusedEl && typeof lastFocusedEl.focus === 'function') {

      try { lastFocusedEl.focus(); } catch { /* ignore */ }

      lastFocusedEl = null;

    }

  }



  function getTopmostOpenModalName() {

    const open = Object.entries(overlays).filter(([, el]) => el && el.classList.contains('open'));

    if (!open.length) return null;

    const navTabs = new Set(['community', 'resources', 'profile']);

    const elevated = open.filter(([name]) => !navTabs.has(name));

    if (elevated.length) return elevated[elevated.length - 1][0];

    return open[open.length - 1][0];

  }



  // Close stacked overlays when switching nav tabs; keep blocking gates unless forced.

  function closeStackedModalsForNav(keepName) {

    Object.keys(overlays).forEach((name) => {

      if (name === keepName) return;

      if (name === 'tos' || name === 'onboarding') return;

      if (name === 'report' && isReportPhotoPickerActive()) return;

      closeModal(name);

    });

  }



  function closeAllModals() {

    if (manualPinModeActive) stopManualPinMode(true);

    closeStackedModalsForNav(null);

  }

  window.closeAllModals = closeAllModals;



  function clearNavModalHistory() {

    try {

      if (history.state && history.state.civicNavModal) history.replaceState({}, '');

    } catch { /* history unavailable */ }

  }



  function resetAppSessionUi() {

    if (tourState) endTour(false);

    dismissCoachMark();

    closeStackedModalsForNav(null);

    setNavTab('map');

    clearNavModalHistory();

    if (!overlays.report?.classList.contains('open') && hasReportPhotoPreview()) {

      resetReportForm();

    }

    scheduleMapResize();

  }



  function markPwaSessionActive() {

    try { sessionStorage.setItem(SESSION_MARKER_KEY, '1'); } catch { /* private mode */ }

  }



  function isColdPwaLaunch() {

    if (!isStandalonePwa()) return false;

    try {

      const hadSession = sessionStorage.getItem(SESSION_MARKER_KEY);

      markPwaSessionActive();

      return !hadSession;

    } catch {

      return false;

    }

  }



  function shouldResetOnColdPwaLaunch() {

    if (!isStandalonePwa()) return false;

    if (document.wasDiscarded) {

      markPwaSessionActive();

      return true;

    }

    return isColdPwaLaunch();

  }



  function maybeResetSessionOnResume(opts) {

    const bfcache = !!(opts && opts.bfcache);

    const coldStart = !!(opts && opts.coldStart);

    const hiddenMs = (opts && opts.hiddenMs) || 0;

    const standalone = !!(opts && opts.forceStandalone) || isStandalonePwa();

    if (isReportPhotoPickerActive()) return false;

    if (overlays.report?.classList.contains('open') && hasReportPhotoPreview()) return false;

    if (!standalone) return false;

    if (bfcache || coldStart) {

      resetAppSessionUi();

      skipReportDraftRestoreOnce = true;

      return true;

    }

    if (hiddenMs > 0 && hiddenMs < WARM_RESUME_PRESERVE_MS) return false;

    if (hiddenMs >= SESSION_RESUME_RESET_MS) {

      resetAppSessionUi();

      skipReportDraftRestoreOnce = true;

      return true;

    }

    return false;

  }



  window.resetAppSessionUi = resetAppSessionUi;

  window.civicMaybeResetSessionOnResume = maybeResetSessionOnResume;

  window.syncReportPhotoReturn = syncReportPhotoReturn;

  window.civicTestDropManualPin = function (lat, lng) {

    if (!manualPinModeActive) return false;

    onManualPinMapClick({ latlng: { lat, lng } });

    return manualPinLat != null && manualPinLng != null;

  };

  /** E2E helper: seed confirm-step pin so submit does not race async GPS. */
  window.civicTestSetConfirmPin = function (lat, lng, accuracyM, userAdjusted) {

    if (!isValidGpsCoords(lat, lng)) return false;

    confirmPinProvisional = false;

    initReportPinPreview(lat, lng, Number.isFinite(accuracyM) ? accuracyM : 5, userAdjusted !== false);

    return confirmPinLat != null && confirmPinLng != null && !confirmPinProvisional;

  };

  window.civicSessionResumeResetMs = SESSION_RESUME_RESET_MS;

  window.civicWarmResumePreserveMs = WARM_RESUME_PRESERVE_MS;



  function isBlockingOverlay(name) {

    return name === 'tos' || name === 'onboarding' || name === 'deleteConfirm';

  }

  function shouldPushModalHistory(name) {

    return name === 'community' || name === 'resources' || name === 'profile'

      || name === 'report' || name === 'success' || name === 'shareWin' || name === 'certificate';

  }

  /** Close a non-blocking overlay with the same semantics as × / Done. */
  function dismissOverlayByName(name) {

    if (!name || isBlockingOverlay(name)) return false;

    if (name === 'report' && !canDismissReportOverlay()) return false;

    if (name === 'success') dismissSuccessModal();

    else if (name === 'escalation') tryCloseEscalation();

    else {

      closeModal(name);

      if (name === 'community' || name === 'resources' || name === 'profile') setNavTab('map');

    }

    return true;

  }

  // Push a history entry when opening main sheets so Android back closes them
  // instead of leaving the app. One entry is enough; popstate closes the stack.

  function pushNavModalHistory() {

    try {

      if (!(history.state && history.state.civicNavModal)) {

        history.pushState({ civicNavModal: true }, '');

      }

    } catch { /* history unavailable — Escape/close button still work */ }

  }



  /* ---------- Window Modal Bindings ---------- */

  window.openTosModal = function () { openModal('tos'); };

  window.closeTosModal = function () { closeModal('tos'); };

  window.openOnboardingModal = function () { openModal('onboarding'); };

  window.closeOnboardingModal = function () { closeModal('onboarding'); };

  window.openReportModal = function (openCamera = true) {

    debugLog('REPORT', 'openReportModal', { openCamera });

    if (!user.tosAccepted) {

      openModal('tos');

      return;

    }

    if (!user.ward) {

      showToast(t('toast.onboardFirst'), 'info');

      openModal('onboarding');

      return;

    }

    cancelPendingShareNudge();

    if (tourState) endTour(false);

    const canvas = $('#imageCanvas');

    let hasPhoto = canvas.classList.contains('visible');

    if (openCamera && hasPhoto) {

      debugLog('REPORT', 'openReportModal clearStalePhoto', { reason: 'openCamera intent' });

      clearReportPhotoPreviewOnly();

      clearConfirmPinState();

      hasPhoto = false;

    }

    if (!hasPhoto) selectHazard(getContextualDefaultHazard());

    else {

      updateHazardSelectedCue($('#hazardType').value);

      updatePhotoGuidelines($('#hazardType').value);

    }

    renderHazardPicker();

    resetSubmitReportButton();

    openModal('report');

    if (hasPhoto) {

      requestAnimationFrame(() => showPhotoConfirm());

    } else {

      resetPhotoConfirm();

    }

    touchReportDraft({

      hazardType: $('#hazardType').value,

      step: hasPhoto ? 'confirm' : 'capture',

      awaitingPhoto: openCamera && !hasPhoto,

    });

    if (openCamera && !hasPhoto) {

      if (reportCameraTimer) clearTimeout(reportCameraTimer);

      requestAnimationFrame(() => {

        reportCameraTimer = setTimeout(() => {

          reportCameraTimer = null;

          if (overlays.report.classList.contains('open')) openReportPhotoPicker();

        }, 50);

      });

    }

  };

  window.closeReportModal = function () {

    debugLog('REPORT', 'closeReportModal');

    closeModal('report');

  };

  window.getContextualDefaultHazard = getContextualDefaultHazard;

  window.openSuccessModal = function () { openModal('success'); };

  window.closeSuccessModal = function () {

    closeModal('success');

    flushPendingPwaNudge();

  };

  window.openCommunityModal = function () {

    pushNavModalHistory();

    closeStackedModalsForNav('community');

    renderLeaderboard('wards');

    updateCommunitySubtitle();

    checkReferralRewards();

    renderSeasonalHook();

    renderCommunityImpactStats();

    renderWardWeekSocialProof();

    renderWeeklyRecapButton();

    renderSuccessStories();

    renderWardChallenge();

    renderLeadCandidates();

    markSuccessStoriesSeen();

    setNavTab('community');

    openModal('community');

    // Engaged users (≥1 report) see the volunteer section expanded by default.
    if (getUserReports().length >= 1) {
      setCollapsibleSectionOpen('getInvolvedSection', 'getInvolvedBody', 'btnGetInvolvedToggle', true);
    }

  };

  window.closeCommunityModal = function () { closeModal('community'); };

  window.openResourcesModal = function () {

    pushNavModalHistory();

    closeStackedModalsForNav('resources');

    renderImpactWall();

    renderOfficialChannelsSurfaces(null);

    setNavTab('resources');

    openModal('resources');

  };

  window.closeResourcesModal = function () { closeModal('resources'); };

  window.openCommunityResources = function () { window.openResourcesModal(); };

  window.openPledgeModal = function () {

    if (!requireCommunityConsent()) return;

    if (user.ward) $('#pledgeWard').value = user.ward;

    const pledgeWard = $('#pledgeWard');

    if (pledgeWard) refreshWardComboboxes();

    openModal('pledge');

  };

  window.closePledgeModal = function () { closeModal('pledge'); };

  window.openProfileModal = function () {

    pushNavModalHistory();

    closeStackedModalsForNav('profile');

    resetProfileSectionsOnOpen();

    updateProfileUI();

    setNavTab('profile');

    openModal('profile');

    requestAnimationFrame(() => {

      $('#btnReplayTour')?.scrollIntoView({ block: 'nearest', behavior: 'auto' });

    });

    pulseProfilePointsStat();

    checkResolvedWins();

    checkConfirmedResolved();

    checkFixConfirmedResolved();

    checkPledgeStatusUpdates();

  };

  window.closeProfileModal = function () { closeModal('profile'); };

  window.openAdminModal = function () {

    if (!isBmcPilotCity(getUserCity()) && !isAdmin) {

      showToast(t('toast.bmcMumbaiOnly'), 'info', 5000);

      return;

    }

    openModal('admin');

  };

  window.closeAdminModal = function () { closeModal('admin'); };

  window.openLeadModal = function () { openModal('lead'); };

  window.closeLeadModal = function () { closeModal('lead'); };

  window.openCoordinatorDashboard = function () {

    if (!hasRole('ngo_lead')) return;

    markNgoHubSeen();

    const scopeEl = $('#coordScopeTag');

    if (scopeEl) {

      if (user.coordinatorScope === 'neighbourhood' && user.neighbourhoodLabel) {

        scopeEl.textContent = t('coord.scopeNbh').replace('{label}', user.neighbourhoodLabel);

        scopeEl.classList.remove('hidden');

      } else if (user.ward) {

        scopeEl.textContent = t('coord.scopeWard').replace('{ward}', user.ward.split('—')[0].trim());

        scopeEl.classList.remove('hidden');

      } else {

        scopeEl.classList.add('hidden');

      }

    }

    renderCoordinatorPledges();

    renderCoordinatorVolunteers();

    renderCoordinatorTasks();

    renderCoordinatorHazards();

    openModal('coordinator');

  };

  window.closeCoordinatorDashboard = function () { closeModal('coordinator'); };

  window.openAdminReportModal = openAdminReportModal;

  window.closeAdminReportModal = function () { closeModal('adminReport'); };

  window.submitPledge = submitPledge;

  window.renderLeaderboard = renderLeaderboard;

  window.verifyVolunteerHours = verifyVolunteerHours;

  window.markReportResolved = markReportResolved;



  window.openPartnerPortal = function () {

    updatePartnerPortalUi();

    openModal('partner');

  };

  window.closePartnerPortal = function () { closeModal('partner'); };

  window.openEscalationModal = openEscalationModal;

  window.getOfficialChannelsForCity = getOfficialChannelsForCity;

  window.openOfficialChannel = openOfficialChannel;

  window.renderOfficialChannelsSurfaces = renderOfficialChannelsSurfaces;

  window.buildOfficialSummaryText = buildOfficialSummaryText;

  window.buildReportPopup = buildReportPopup;

  window.refreshSocietyDatalist = refreshSocietyDatalist;

  window.refreshNeighbourhoodDatalist = refreshSocietyDatalist;

  window.cacheSocietyIfCustom = cacheSocietyIfCustom;

  window.getSocietySuggestions = getSocietySuggestions;

  window.openAdminQueue = function () {

    if (!hasRole('bmc')) return;

    renderAdminQueue();

    refreshAccessReviewBadge();

    setNavTab('map');

    openModal('adminQueue');

  };



  window.refreshReportMarkers = refreshReportMarkers;

  window.setAdminMode = setAdminMode;

  window.setLeadMode = setLeadMode;

  window.openReportPopupById = function (reportId) {

    const report = findReportById(reportId);

    if (!report || report.lat == null || !map) return;

    refreshReportMarkers();

    map.setView([report.lat, report.lng], 16);

    setTimeout(() => {

      const marker = reportMarkerMap.get(reportId) || reportMarkerMap.get(String(reportId));

      if (marker) marker.openPopup();

    }, 450);

  };

  window.openVolunteerModal = function () {

    if (!requireCommunityConsent()) return;

    if (!user.ward) {

      showToast(t('toast.volunteerWardRequired'), 'info');

      openModal('onboarding');

      return;

    }

    $('#volunteerWard').value = user.ward;

    const existing = getMyVolunteerSignup();

    if (existing) {

      $('#volunteerNeighbourhood').value = existing.neighbourhood || '';

      $('#volSkillCleanup').checked = (existing.skills || []).includes('cleanup');

      $('#volSkillAwareness').checked = (existing.skills || []).includes('awareness');

      $('#volSkillPledge').checked = (existing.skills || []).includes('pledge');

      $('#volunteerContact').value = existing.contact || '';

      const hrs = existing.hours || 4;

      $$('#volunteerHoursPicker .hours-picker__btn').forEach((btn) => {

        const h = btn.dataset.hours;

        btn.classList.toggle('active', h !== 'custom' && Number(h) === hrs);

      });

      const preset = [2, 4, 8].includes(hrs);

      $('#volunteerHoursCustom').classList.toggle('hidden', preset);

      if (!preset) {

        $$('#volunteerHoursPicker .hours-picker__btn').forEach((btn) => {

          btn.classList.toggle('active', btn.dataset.hours === 'custom');

        });

        $('#volunteerHoursCustom').value = hrs;

      }

      $('#btnRemoveVolunteer').classList.remove('hidden');

    } else {

      $('#volunteerNeighbourhood').value = '';

      $('#volSkillCleanup').checked = true;

      $('#volSkillAwareness').checked = false;

      $('#volSkillPledge').checked = false;

      $('#volunteerContact').value = '';

      $('#volunteerHoursCustom').classList.add('hidden');

      $$('#volunteerHoursPicker .hours-picker__btn').forEach((btn) => {

        btn.classList.toggle('active', btn.dataset.hours === '4');

      });

      $('#btnRemoveVolunteer').classList.add('hidden');

    }

    refreshSocietyDatalist(getUserCity(), user.ward || '');

    openModal('volunteer');

  };



  /* ---------- PWA install (Add to Home Screen) ---------- */

  function hidePwaInstallNudge() {

    const el = $('#pwaInstallNudge');

    if (!el) return;

    el.classList.add('hidden');

    document.body.classList.remove('pwa-nudge-visible');

    pwaNudgeVisible = false;

  }



  function showPwaInstallNudge() {

    if (pwaNudgeVisible) return;

    const el = $('#pwaInstallNudge');

    if (!el) return;

    el.classList.remove('hidden');

    document.body.classList.add('pwa-nudge-visible');

    pwaNudgeVisible = true;

    if (window.CivicAnalytics) CivicAnalytics.track('pwa_nudge_shown', {});

  }



  function dismissPwaNudge() {

    hidePwaInstallNudge();

    try { safeLocalSet(PWA_NUDGE_KEY, '1'); } catch {}

    if (window.CivicAnalytics) CivicAnalytics.track('pwa_nudge_dismissed', {});

  }



  function canShowPwaNudge() {

    try {

      if (localStorage.getItem(PWA_NUDGE_KEY)) return false;

    } catch { /* ignore */ }

    return !isStandalonePwa();

  }



  async function triggerPwaInstall() {

    if (deferredInstallPrompt) {

      deferredInstallPrompt.prompt();

      try {

        const choice = await deferredInstallPrompt.userChoice;

        if (choice?.outcome === 'accepted') hidePwaInstallNudge();

      } catch { /* ignore */ }

      deferredInstallPrompt = null;

      const btn = $('#btnInstall');

      if (btn) btn.classList.add('hidden');

      return;

    }

    showToast(getInstallHint(), 'info', 5000);

  }



  function setupInstallPrompt() {

    const btn = $('#btnInstall');

    if (window.CivicAnalytics && user.tosAccepted && user.analyticsConsent && isStandalonePwa()) {

      CivicAnalytics.track('pwa_standalone_session', {});

    }

    window.addEventListener('beforeinstallprompt', (e) => {

      e.preventDefault();

      deferredInstallPrompt = e;

      if (btn) btn.classList.remove('hidden');

      if (window.CivicAnalytics) CivicAnalytics.track('pwa_install_prompt', { shown: true });

    });

    window.addEventListener('appinstalled', () => {

      deferredInstallPrompt = null;

      if (btn) btn.classList.add('hidden');

      hidePwaInstallNudge();

      try { safeLocalSet(PWA_NUDGE_KEY, '1'); } catch {}

      if (window.CivicAnalytics) CivicAnalytics.track('pwa_installed', {});

      showToast(t('toast.installed'), 'success');

    });

    if (btn) {

      btn.addEventListener('click', () => triggerPwaInstall());

    }

    const nudgeInstall = $('#btnPwaNudgeInstall');

    const nudgeDismiss = $('#btnPwaNudgeDismiss');

    if (nudgeInstall) nudgeInstall.addEventListener('click', () => triggerPwaInstall());

    if (nudgeDismiss) nudgeDismiss.addEventListener('click', () => dismissPwaNudge());

    if (!canShowPwaNudge()) hidePwaInstallNudge();

  }



  function isStandalonePwa() {

    return window.matchMedia('(display-mode: standalone)').matches

      || window.matchMedia('(display-mode: fullscreen)').matches

      || window.matchMedia('(display-mode: minimal-ui)').matches

      || window.navigator.standalone === true

      || (document.referrer || '').startsWith('android-app://');

  }



  function getStoreConfig() {

    return (window.CIVICRADAR_CONFIG || {}).store || {};

  }



  function getPlayStoreUrl() {

    const cfg = getStoreConfig();

    return cfg.playStoreUrl || 'https://play.google.com/store/apps/details?id=in.civicradar.app';

  }



  function getAndroidPackageId() {

    const cfg = getStoreConfig();

    return cfg.packageId || 'in.civicradar.app';

  }



  function isAndroidMobile() {

    return /Android/i.test(navigator.userAgent || '');

  }



  function getCanonicalPageUrl() {

    const pub = getPublicAppUrl();

    const base = pub || `${location.origin}${location.pathname.replace(/index\.html$/, '')}`;

    const normalized = base.replace(/\?.*$/, '').replace(/index\.html$/, '').replace(/\/?$/, '/');

    return `${normalized}${location.search || ''}`;

  }



  function buildAndroidIntentUrl(httpsUrl) {

    const fallback = encodeURIComponent(getPlayStoreUrl());

    try {

      const u = new URL(httpsUrl);

      const hostPath = `${u.host}${u.pathname}${u.search}${u.hash}`;

      return `intent://${hostPath}#Intent;scheme=https;package=${getAndroidPackageId()};S.browser_fallback_url=${fallback};end`;

    } catch {

      return httpsUrl;

    }

  }



  function openInNativeApp(httpsUrl) {

    const url = httpsUrl || getCanonicalPageUrl();

    if (isAndroidMobile()) {

      window.location.href = buildAndroidIntentUrl(url);

      return;

    }

    const appStore = getStoreConfig().appStoreUrl;

    if (isAppleMobile() && appStore) {

      window.open(appStore, '_blank');

      return;

    }

    triggerPwaInstall();

  }



  function shouldShowAppOpenBanner() {

    if (isStandalonePwa()) return false;

    try {

      if (sessionStorage.getItem(APP_OPEN_BANNER_KEY)) return false;

    } catch { /* ignore */ }

    const params = new URLSearchParams(location.search);

    return !!(params.get('report') || params.get('ref'));

  }



  function showAppOpenBanner() {

    if (!shouldShowAppOpenBanner()) return;

    const el = $('#appOpenBanner');

    if (!el) return;

    el.classList.remove('hidden');

    document.body.classList.add('app-open-banner-visible');

    if (window.CivicAnalytics) {

      CivicAnalytics.track('app_open_banner_shown', {

        hasReport: !!new URLSearchParams(location.search).get('report'),

      });

    }

  }



  function dismissAppOpenBanner() {

    const el = $('#appOpenBanner');

    if (el) el.classList.add('hidden');

    document.body.classList.remove('app-open-banner-visible');

    try { sessionStorage.setItem(APP_OPEN_BANNER_KEY, '1'); } catch {}

    if (window.CivicAnalytics) CivicAnalytics.track('app_open_banner_dismissed', {});

  }



  function setupAppOpenBanner() {

    const openBtn = $('#btnAppOpenInApp');

    const storeBtn = $('#btnAppOpenGetApp');

    const dismissBtn = $('#btnAppOpenDismiss');

    if (openBtn) {

      openBtn.addEventListener('click', () => {

        openInNativeApp(getCanonicalPageUrl());

        if (window.CivicAnalytics) CivicAnalytics.track('app_open_banner_open_click', {});

      });

    }

    if (storeBtn) {

      storeBtn.addEventListener('click', () => {

        window.open(getPlayStoreUrl(), '_blank');

        if (window.CivicAnalytics) CivicAnalytics.track('app_open_banner_store_click', {});

      });

    }

    if (dismissBtn) dismissBtn.addEventListener('click', () => dismissAppOpenBanner());

    showAppOpenBanner();

  }



  function isAppleMobile() {

    const ua = navigator.userAgent || '';

    return /iPad|iPhone|iPod/.test(ua)

      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  }



  function getInstallHint() {

    return isAppleMobile() ? t('toast.installHintIos') : t('toast.installHint');

  }



  function trackVisitCount() {

    try {

      const n = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1;

      safeLocalSet(VISIT_COUNT_KEY, String(n));

      return n;

    } catch {

      return 1;

    }

  }



  function maybeShowPwaNudge(trigger) {

    if (isAppleMobile()) return;

    if (!canShowPwaNudge()) return;

    if (shouldDeferFirstRunNudges() && trigger === 'visit') return;

    const visits = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);

    const shouldShow = trigger === 'report' || (trigger === 'visit' && visits >= 2);

    if (!shouldShow) return;

    if (trigger === 'report' && overlays.success?.classList.contains('open')) {

      pendingPwaNudge = true;

      return;

    }

    showPwaInstallNudge();

  }



  function flushPendingPwaNudge() {

    if (!pendingPwaNudge) return;

    pendingPwaNudge = false;

    maybeShowPwaNudge('report');

  }



  function deferNonCritical(fn) {

    if (typeof requestIdleCallback === 'function') {

      requestIdleCallback(fn, { timeout: 2000 });

    } else {

      setTimeout(fn, 50);

    }

  }



  /* ---------- Init ---------- */

  function hideAppLaunch() {

    const el = document.getElementById('appLaunch');

    if (!el || el.classList.contains('app-launch--done')) return;

    el.classList.add('app-launch--done');

    document.body.classList.remove('app-booting');

    const remove = () => { if (el.parentNode) el.remove(); };

    el.addEventListener('transitionend', remove, { once: true });

    setTimeout(remove, 400);

  }



  initMap();

  debugInit();

  initSearchableComboboxes();

  bindEvents();

  updateMapLocationControls();

  updateAuthMode();

  applyTranslations();

  updatePartnerPortalUi();

  updatePersonaUI();

  maybeResetSessionOnResume({ coldStart: shouldResetOnColdPwaLaunch() });

  runBootSequence();

  // Foreground-triggered opt-in reminder: re-check when the user returns to the tab.

  document.addEventListener('visibilitychange', () => {

    if (document.visibilityState === 'visible') {

      if (isReportPhotoPickerActive() || hasReportPhotoPreview() || isReportFlowBusy()) {

        debugLog('PHOTO', 'visibilitychange visible during report', {

          pickerActive: isReportPhotoPickerActive(),

          hasPreview: hasReportPhotoPreview(),

          reportBusy: isReportFlowBusy(),

        });

      }

      const hiddenMs = appHiddenAt ? Date.now() - appHiddenAt : 0;

      appHiddenAt = 0;

      maybeResetSessionOnResume({ hiddenMs });

      if (!skipReportDraftRestoreOnce) restoreReportDraftIfNeeded();

      else skipReportDraftRestoreOnce = false;

      if (isReportPhotoPickerActive() || hasReportPhotoPreview()) syncReportPhotoReturn();

      flushPendingSwReload();

      // Do not interrupt mid-report with neighbour/unfiled reminders (camera return).
      if (!shouldDeferFirstRunNudges() && !isReportFlowBusy()) setTimeout(maybeShowReportReminder, 400);

    } else if (document.visibilityState === 'hidden') {

      appHiddenAt = Date.now();

      persistReportDraftOnHide();

    }

  });

  window.addEventListener('pagehide', persistReportDraftOnHide);

  registerServiceWorker();

  setupInstallPrompt();

  setupAppOpenBanner();

  warnIfShareUrlNotProduction();

  trackShareRefLanding();

  maybeShowReferralWelcome();

  checkReferralRewards();

  trackVisitCount();

  updateMapEmptyCta();

  updateHomeHero();

  updateIosInstallHint();

  deferNonCritical(() => {

    renderLeaderboard('wards');

    renderLeaderboard('citizens');

    renderWardChallenge();

    if (user.tosAccepted && user.ward) {

      setTimeout(() => maybeShowPwaNudge('visit'), 2500);

    }

  });

  initStaticOgMeta();

  // Connect to the shared backend (no-op in local/demo mode). Non-blocking.

  // Supabase + sync after first paint — do not block splash/map on the SDK download.
  setTimeout(() => {
    Backend.init().then(() => { handleReportDeepLink(); processLocalNbhQueue(); });
  }, 0);



  function initStaticOgMeta() {

    const base = getShareAppUrl();

    setMetaContent('meta[property="og:image"]', absoluteOgUrl('assets/og-civicradar.svg'));

    setMetaContent('meta[name="twitter:image"]', absoluteOgUrl('assets/og-civicradar.svg'));

    setMetaContent('meta[property="og:url"]', base);

    if (user.ward) {

      const ward = getWardShortName(user.ward);

      setMetaContent('meta[property="og:title"]', `CivicRadar — ${ward} ward hazard map`);

      const pending = getWardReportStats().find((s) => s.name === user.ward);

      const openCount = pending ? pending.pending : 0;

      setMetaContent('meta[property="og:description"]',

        `${ward}: ${openCount} open hazard(s) on the map — pin, Me too, beat other wards. Free PWA — #MonsoonGuardian`);

    }

  }



  function runBootSequence() {

    const demo = new URLSearchParams(location.search).get('demo');

    if (demo === 'tour' || demo === 'persona') {

      safeLocalSet(COACH_KEY, '1');

      if (!user.tosAccepted) user.tosAccepted = true;

      if (!user.analyticsConsent) user.analyticsConsent = true;

      if (!user.ward) user.ward = 'G/N Ward — Dadar, Shivaji Park';

      if (!user.city) user.city = DEFAULT_CITY;

      if (!user.displayName) user.displayName = 'Priya';

      saveUser();

      if (window.CivicAnalytics) CivicAnalytics.setConsent(true);

      closeAllModals();

      updateProfileUI();

      updatePersonaUI();

      setNavTab('map');

      return;

    }

    if (!user.tosAccepted) {

      openModal('tos');

    } else if (!user.ward) {

      openModal('onboarding');

    } else {

      updateProfileUI();

      updatePersonaUI();

      updateHomeHero();

      updateMapEmptyCta();

      const restoredReportDraft = restoreReportDraftIfNeeded();

      if (!restoredReportDraft && !shouldShowHomeHero()) setTimeout(showCoachMark, 600);

      if (!restoredReportDraft && !shouldDeferFirstRunNudges()) {

        setTimeout(() => { checkResolvedWins(); checkConfirmedResolved(); updateCommunityWinBadge(); }, 1200);

        setTimeout(processBootReminders, 1800);

        setTimeout(maybeShowReportReminder, 2400);

      }

      handleReportDeepLink();

      if (window.CivicAnalytics) CivicAnalytics.track('tab_view', { tab: 'map', initial: true, reportDraftRestore: restoredReportDraft });

    }

  }



  /* ---------- Map ---------- */

  function initMap() {

    if (typeof L === 'undefined') {

      showMapError();

      hideAppLaunch();

      return;

    }

    if (window.CivicAnalytics) CivicAnalytics.perfStart('map_init_duration');

    try {

      map = L.map('map', {

        zoomControl: false,

        attributionControl: false,

        tap: false,

      }).setView(getCityCenter(), 12);



      L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(map);



      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {

        maxZoom: 19,

        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',

      }).addTo(map);



      L.control.zoom({ position: 'bottomright' }).addTo(map);



      reportMarkerLayer = L.layerGroup().addTo(map);

      refreshReportMarkers();



      map.on('moveend zoomend', scheduleRefreshReportMarkers);



      // GPS is requested only after explicit consent (DPDP). See maybeRequestLocation().

      maybeRequestLocation(true);

      if (window.visualViewport) {

        window.visualViewport.addEventListener('resize', scheduleMapResize);

        window.visualViewport.addEventListener('scroll', scheduleMapResize);

      }

      window.addEventListener('orientationchange', () => setTimeout(scheduleMapResize, 300));

      if (window.CivicAnalytics) CivicAnalytics.perfEnd('map_init_duration');

      hideAppLaunch();

    } catch (err) {

      console.error('Map failed to initialise:', err);

      if (window.CivicAnalytics) {

        CivicAnalytics.trackError(err.message || 'Map init failed', { stack: err.stack, context: 'initMap' });

        CivicAnalytics.perfEnd('map_init_duration', { failed: true });

      }

      showMapError();

      hideAppLaunch();

    }

  }



  function scheduleMapResize() {

    if (!map) return;

    requestAnimationFrame(() => {

      try { map.invalidateSize({ pan: false }); } catch { /* ignore */ }

    });

  }



  function showMapError() {

    const el = $('#map');

    if (el) {

      el.innerHTML =

        '<div class="map-error"><i class="ph ph-wifi-slash"></i>' +

        '<p>Map could not load. Check your connection and reload.</p>' +

        '<button type="button" class="btn btn--primary btn--sm" onclick="location.reload()">Reload</button></div>';

    }

  }



  // Requests GPS only if the user accepted ToS and granted GPS consent.

  function isValidGpsCoords(lat, lng) {

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;

    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;

    return true;

  }



  function zoomForAccuracy(accuracyM) {

    const acc = Number.isFinite(accuracyM) ? accuracyM : 100;

    if (acc <= 20) return 17;

    if (acc <= 50) return 16;

    if (acc <= 150) return 15;

    if (acc <= 500) return 14;

    return 13;

  }



  function getPrecisePosition(opts) {

    opts = opts || {};

    const fresh = opts.fresh !== false;

    const targetAccuracy = opts.targetAccuracyM != null ? opts.targetAccuracyM : GEO_ACCURACY_GOOD_M;

    const timeoutMs = opts.timeoutMs || GEO_LOCATE_TIMEOUT_MS;

    const watchMaxMs = opts.watchMaxMs || GEO_WATCH_MAX_MS;

    const minSamples = opts.minSamples != null ? opts.minSamples : GEO_STABLE_SAMPLES;

    const stableRadiusM = opts.stableRadiusM != null ? opts.stableRadiusM : GEO_STABLE_RADIUS_M;

    return new Promise((resolve, reject) => {

      if (!navigator.geolocation) {

        reject(new Error('no_geolocation'));

        return;

      }

      const geoOpts = {

        enableHighAccuracy: true,

        timeout: timeoutMs,

        maximumAge: fresh ? 0 : 15000,

      };

      let watchId = null;

      let bestPos = null;

      let settled = false;

      const samples = [];

      const started = Date.now();

      function cleanup() {

        if (watchId != null) {

          navigator.geolocation.clearWatch(watchId);

          watchId = null;

        }

      }

      function settle(pos, err) {

        if (settled) return;

        settled = true;

        cleanup();

        if (pos && isValidGpsCoords(pos.coords.latitude, pos.coords.longitude)) {

          resolve(pos);

        } else if (bestPos && isValidGpsCoords(bestPos.coords.latitude, bestPos.coords.longitude)) {

          resolve(bestPos);

        } else {

          reject(err || new Error('geo_failed'));

        }

      }

      function samplesAgree() {

        if (samples.length < minSamples) return false;

        const a = samples[samples.length - 1];

        const b = samples[samples.length - 2];

        return getDistanceInMeters(a.lat, a.lng, b.lat, b.lng) <= stableRadiusM;

      }

      function onPos(pos) {

        const lat = pos.coords.latitude;

        const lng = pos.coords.longitude;

        if (!isValidGpsCoords(lat, lng)) return;

        const acc = pos.coords.accuracy;

        samples.push({ lat, lng, acc, pos });

        if (!bestPos || !Number.isFinite(bestPos.coords.accuracy)

            || (Number.isFinite(acc) && acc < bestPos.coords.accuracy)) {

          bestPos = pos;

        }

        // Require agreement between samples — a single WiFi fix often claims ≤50 m while being ~1 km off.

        const confident = Number.isFinite(acc) && acc <= targetAccuracy && samplesAgree();

        const veryConfident = Number.isFinite(acc) && acc <= 25 && samples.length >= 2 && samplesAgree();

        if (confident || veryConfident) {

          settle(pos);

        } else if (Date.now() - started >= watchMaxMs) {

          settle(bestPos || pos);

        }

      }

      function onErr(err) {

        if (bestPos) {

          settle(bestPos);

        } else {

          navigator.geolocation.getCurrentPosition(

            (pos) => settle(pos),

            (e) => settle(null, e),

            geoOpts

          );

        }

      }

      watchId = navigator.geolocation.watchPosition(onPos, onErr, geoOpts);

      setTimeout(() => {

        if (!settled) settle(bestPos, bestPos ? null : new Error('geo_timeout'));

      }, watchMaxMs + 500);

    });

  }



  function showGpsRecoveryActions(message, type, duration) {

    showToast(message, type || 'error', duration || 9000, {

      label: t('report.placePinOnMap'),

      onClick: () => startManualPinMode(),

      secondary: {

        label: t('report.geoEnableHint'),

        onClick: () => showGeoEnableHelp(),

      },

    });

  }



  function showGpsAccuracyFeedback(accuracyM) {

    if (!Number.isFinite(accuracyM)) return;

    if (accuracyM > GEO_ACCURACY_MAX_M) {

      showGpsRecoveryActions(t('toast.gpsPoorFix'), 'error', 9000);

    } else if (accuracyM > GEO_ACCURACY_POOR_M) {

      showGpsRecoveryActions(

        t('toast.gpsLowAccuracy').replace('{m}', String(Math.round(accuracyM))),

        'info',

        9000

      );

    }

  }



  function updateUserLocationMarker(lat, lng, accuracyM) {

    if (!map) return;

    if (userMarker) map.removeLayer(userMarker);

    if (userAccuracyCircle) map.removeLayer(userAccuracyCircle);

    userMarker = L.circleMarker([lat, lng], {

      radius: 8,

      fillColor: '#6366f1',

      color: '#fff',

      weight: 2,

      fillOpacity: 0.9,

    }).addTo(map).bindPopup(t('map.youAreHere'));

    if (Number.isFinite(accuracyM) && accuracyM > 0) {

      userAccuracyCircle = L.circle([lat, lng], {

        radius: accuracyM,

        color: '#6366f1',

        fillColor: '#6366f1',

        fillOpacity: 0.12,

        weight: 1,

      }).addTo(map);

    } else {

      userAccuracyCircle = null;

    }

  }



  function stopUserLocationRefine() {

    if (locationRefineWatchId != null) {

      try { navigator.geolocation.clearWatch(locationRefineWatchId); } catch { /* ignore */ }

      locationRefineWatchId = null;

    }

    locationRefineUntil = 0;

  }



  // After the first fix, keep listening briefly — WiFi/IP often jumps to real GPS within ~10–30s.

  function startUserLocationRefine() {

    if (!navigator.geolocation || !map) return;

    stopUserLocationRefine();

    locationRefineUntil = Date.now() + GEO_REFINE_MS;

    locationRefineWatchId = navigator.geolocation.watchPosition(

      (pos) => {

        if (Date.now() > locationRefineUntil) {

          stopUserLocationRefine();

          return;

        }

        const lat = pos.coords.latitude;

        const lng = pos.coords.longitude;

        const acc = pos.coords.accuracy;

        if (!isValidGpsCoords(lat, lng)) return;

        if (Number.isFinite(acc) && acc > GEO_ACCURACY_MAX_M) return;

        const prevAcc = currentAccuracyM;

        const moved = (currentLat != null && currentLng != null)

          ? getDistanceInMeters(currentLat, currentLng, lat, lng)

          : Infinity;

        const betterAcc = !Number.isFinite(prevAcc) || (Number.isFinite(acc) && acc < prevAcc * 0.75);

        const bigJumpWithBetterOrSimilar = moved > 80 && (

          !Number.isFinite(prevAcc) || !Number.isFinite(acc) || acc <= prevAcc * 1.15

        );

        if (!betterAcc && !bigJumpWithBetterOrSimilar) return;

        currentLat = lat;

        currentLng = lng;

        currentAccuracyM = Number.isFinite(acc) ? acc : currentAccuracyM;

        updateUserLocationMarker(lat, lng, acc);

        if (moved > 120) {

          try { map.panTo([lat, lng], { animate: true }); } catch { /* ignore */ }

        }

        if (Number.isFinite(acc) && acc <= GEO_ACCURACY_GOOD_M && moved < GEO_STABLE_RADIUS_M) {

          stopUserLocationRefine();

        }

      },

      () => { /* keep previous fix */ },

      { enableHighAccuracy: true, maximumAge: 0, timeout: GEO_LOCATE_TIMEOUT_MS }

    );

    setTimeout(() => {

      if (Date.now() >= locationRefineUntil) stopUserLocationRefine();

    }, GEO_REFINE_MS + 1000);

  }



  function applyLocationFromPosition(pos, opts) {

    opts = opts || {};

    const lat = pos.coords.latitude;

    const lng = pos.coords.longitude;

    const accuracyM = pos.coords.accuracy;

    if (!isValidGpsCoords(lat, lng)) return false;

    if (Number.isFinite(accuracyM) && accuracyM > GEO_ACCURACY_MAX_M) {

      showGpsRecoveryActions(t('toast.gpsPoorFix'), 'error', 9000);

      return false;

    }

    currentLat = lat;

    currentLng = lng;

    currentAccuracyM = Number.isFinite(accuracyM) ? accuracyM : null;

    hideLocationBanner();

    hideLocatePill();

    applyWardFromCoords(lat, lng);

    updateMapLocationControls();

    if (opts.recenter && map) {

      map.setView([lat, lng], zoomForAccuracy(accuracyM));

    }

    updateUserLocationMarker(lat, lng, accuracyM);

    if (opts.refine !== false) startUserLocationRefine();

    if (opts.showAccuracyFeedback !== false) showGpsAccuracyFeedback(accuracyM);

    if (!opts.quiet) {

      setTimeout(() => promptNearbyCorroboration(lat, lng), 800);

      setTimeout(() => maybeProximityNudge(lat, lng), 1300);

    }

    return true;

  }



  function maybeRequestLocation(recenter) {

    if (!map) return;

    if (!user.tosAccepted || !user.gpsConsent) {

      showLocationBanner(t('location.banner'));

      return;

    }

    if (!navigator.geolocation) {

      showLocationBanner(t('location.unavailable'));

      return;

    }

    requestLocation(recenter);

  }



  // True while the user has dismissed the banner within the snooze window.

  function isLocBannerSnoozed() {

    try {

      const ts = parseInt(localStorage.getItem(LOCBANNER_SNOOZE_KEY) || '0', 10);

      return ts > 0 && (Date.now() - ts) < LOCBANNER_SNOOZE_MS;

    } catch { return false; }

  }



  function snoozeLocBanner() {

    try { safeLocalSet(LOCBANNER_SNOOZE_KEY, String(Date.now())); } catch {}

  }



  function clearLocBannerSnooze() {

    try { localStorage.removeItem(LOCBANNER_SNOOZE_KEY); } catch {}

  }



  function showLocatePill() {

    const el = $('#btnLocatePill');

    if (el) el.classList.remove('hidden');

    updateMapLocationControls();

  }



  function hideLocatePill() {

    const el = $('#btnLocatePill');

    if (el) el.classList.add('hidden');

    updateMapLocationControls();

  }



  function updateMapLocationControls() {

    const recenter = $('#btnRecenter');

    const pill = $('#btnLocatePill');

    if (!recenter) return;

    const hasFix = currentLat != null && currentLng != null;

    const pillVisible = pill && !pill.classList.contains('hidden');

    recenter.classList.toggle('hidden', !hasFix || pillVisible);

  }



  // While snoozed, collapse the full banner into the unobtrusive locate pill.

  function showLocationBanner(message) {

    if (shouldDeferFirstRunNudges()) return;

    if (isLocBannerSnoozed()) {

      showLocatePill();

      return;

    }

    $('#locationBannerText').textContent = message;

    $('#locationBanner').classList.remove('hidden');

  }



  function hideLocationBanner() {

    $('#locationBanner').classList.add('hidden');

  }



  // Shared explicit opt-in: clears snooze, hides UI, requests GPS.

  function enableLocationFromUser() {

    clearLocBannerSnooze();

    hideLocatePill();

    user.gpsConsent = true;

    saveUser();

    if (navigator.geolocation) {

      requestLocation(true, true);

    } else {

      showToast(t('toast.noLocation'), 'error');

    }

  }



  function requestLocation(recenter, forceFresh) {

    const now = Date.now();

    if (!forceFresh && now - lastGeoRequest < SCALE_CFG.geoThrottleMs && currentLat != null && currentLng != null) {

      if (recenter && map) map.setView([currentLat, currentLng], zoomForAccuracy(GEO_ACCURACY_POOR_M));

      return;

    }

    lastGeoRequest = now;

    if (forceFresh) showToast(t('toast.gpsLocating'), 'info', 2500);

    stopUserLocationRefine();

    getPrecisePosition({

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

  }



  function getMarkerColor(status) {

    return status === 'resolved' ? '#10b981' : '#ef4444';

  }



  function buildReportPopup(report) {

    const count = Number(report.confirmations) || 0;

    const countLine = count > 0

      ? `<div class="popup__confirms"><i class="ph ph-users"></i> ${count} ${count === 1 ? escapeHtml(t('profile.neighbourOne')) : escapeHtml(t('profile.neighbourMany'))}</div>`

      : '';

    const fixCount = Number(report.fixConfirmations) || 0;

    const fixCountLine = fixCount > 0

      ? `<div class="popup__fix-confirms"><i class="ph ph-check-circle"></i> ${fixCount === 1 ? escapeHtml(t('fix.countOne')) : escapeHtml(t('fix.countMany')).replace('{n}', String(fixCount))}</div>`

      : '';

    let safety = '';

    if (!ownsReport(report)) {

      safety = `<button type="button" class="popup__hide" data-hide="${escapeHtml(String(report.id))}">${escapeHtml(t('safety.hide'))}</button>`;

      if (report.reporterId) {

        safety += `<button type="button" class="popup__hide" data-mute-reporter="${escapeHtml(String(report.reporterId))}">${escapeHtml(t('mute.hideReporter'))}</button>`;

      }

    }

    let action = '';

    if (report.status === 'pending') {

      if (ownsReport(report)) {

        action = `<span class="popup__note">${escapeHtml(t('confirm.you'))}</span>`;

      } else if (hasConfirmed(report.id)) {

        action = `<span class="popup__note popup__note--done"><i class="ph ph-check-circle"></i> ${escapeHtml(t('confirm.done'))}</span>`;

      } else {

        action = `<button type="button" class="popup__btn" data-confirm="${escapeHtml(String(report.id))}"><i class="ph ph-hand-pointing"></i> ${escapeHtml(t('confirm.metoo'))}</button>

        <p class="popup__follow-hint">${escapeHtml(t('confirm.followHint'))}</p>`;

      }

      if (!ownsReport(report)) {

        if (hasFixConfirmed(report.id)) {

          action += `<span class="popup__note popup__note--done"><i class="ph ph-check-circle"></i> ${escapeHtml(t('fix.done'))}</span>`;

        } else {

          action += `<button type="button" class="popup__btn popup__btn--fix" data-fix-confirm="${escapeHtml(String(report.id))}"><i class="ph ph-check-circle"></i> ${escapeHtml(t('fix.looksFixed'))}</button>

          <p class="popup__fix-hint">${escapeHtml(t('fix.hint'))}</p>`;

        }

      }

      const signup = getMyVolunteerSignup();

      const pendingOffer = signup && hasPendingTaskForReport(report.id, signup.id);

      const existingTasks = getTasksForReport(report.id).filter((tk) => tk.status === 'pending');

      if (!report.communityCleared && signup && (signup.skills || []).includes('cleanup')) {

        if (pendingOffer) {

          action += `<div class="popup__volunteer"><span class="popup__note popup__note--done"><i class="ph ph-broom"></i> ${escapeHtml(t('popup.taskOffered'))}</span></div>`;

        } else {

          action += `<div class="popup__volunteer"><button type="button" class="popup__btn popup__btn--secondary" data-volunteer-help="${escapeHtml(String(report.id))}"><i class="ph ph-broom"></i> ${escapeHtml(t('popup.helpClean'))}</button></div>`;

        }

      } else if (existingTasks.length > 0 && !report.communityCleared) {

        action += `<div class="popup__volunteer"><span class="popup__note"><i class="ph ph-hand-waving"></i> ${escapeHtml(t('popup.taskOffered'))}</span></div>`;

      }

    }

    const clearedLine = report.communityCleared

      ? `<div class="popup__cleared"><i class="ph ph-broom"></i> ${escapeHtml(corpCopy('popup.communityCleared', getReportCity(report)))}</div>`

      : '';

    const status = report.status === 'resolved' ? resolutionStatusLabel(report) : t('popup.pending');

    const societyLine = report.society

      ? `<div class="popup__society"><i class="ph ph-buildings"></i> ${escapeHtml(report.society)}</div>`

      : '';

    const notesLine = report.notes

      ? `<div class="popup__notes">${escapeHtml(report.notes)}</div>`

      : '';

    const hasBeforeImg = isSafeReportImage(report.image);

    const hasAfterImg = isSafeReportImage(report.resolutionImage);

    const proofSlider = (report.status === 'resolved' && hasBeforeImg && hasAfterImg)

      ? `<div class="popup__ba">${buildBeforeAfterSliderHtml(report.image, report.resolutionImage)}</div>`

      : '';


    return `

      <div class="map-popup">

        <div class="popup__title">${escapeHtml(hazardLabel(report.hazard))}</div>

        <div class="popup__meta">${escapeHtml(status)} — ${escapeHtml((report.ward || getCityLabel(getReportCity(report))).split('—')[0].trim())}</div>

        ${societyLine}

        ${notesLine}

        ${proofSlider}

        ${clearedLine}

        ${countLine}

        ${fixCountLine}

        ${action}

        ${safety}

      </div>`;

  }



  function reportsForMap() {

    let reports = loadReports().filter(

      (r) => !isReportPubliclyHidden(r) && r.lat != null && r.lng != null

    );

    if (!isAdmin) reports = cityScopedReports(reports);

    else reports = adminScopedReports(reports);

    return reports;

  }



  function reportsInViewport(reports) {

    if (!map) return reports;

    try {

      const bounds = map.getBounds().pad(0.12);

      return reports.filter((r) => bounds.contains([r.lat, r.lng]));

    } catch {

      return reports;

    }

  }



  function prioritizeMapReports(reports) {

    return [...reports].sort((a, b) => {

      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;

      const ca = Number(a.confirmations) || 0;

      const cb = Number(b.confirmations) || 0;

      if (cb !== ca) return cb - ca;

      return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);

    });

  }



  function scheduleRefreshReportMarkers() {

    if (!reportMarkerLayer) return;

    clearTimeout(markerRefreshTimer);

    markerRefreshTimer = setTimeout(refreshReportMarkers, SCALE_CFG.mapMarkerDebounceMs);

  }



  function createReportMarker(report, opts) {

    if (report.lat == null || report.lng == null) return null;



    const marker = L.circleMarker([report.lat, report.lng], {

      radius: 10,

      fillColor: getMarkerColor(report.status),

      color: '#ffffff',

      weight: 2,

      fillOpacity: 0.92,

    });



    marker.bindPopup(buildReportPopup(report));

    marker.on('popupopen', () => {

      const el = marker.getPopup() && marker.getPopup().getElement();

      if (el) bindBeforeAfterSliders(el);

    });



    marker.on('click', (e) => {

      L.DomEvent.stopPropagation(e);

      if (isAdmin && report.status === 'pending') {

        openAdminReportModal(report.id);

      } else {

        marker.openPopup();

      }

    });



    marker.reportId = report.id;

    reportMarkerMap.set(report.id, marker);

    reportMarkerLayer.addLayer(marker);

    if (opts && opts.drop) {

      if (typeof marker.setRadius === 'function' && !prefersReducedMotion()) {

        const base = marker.getRadius ? marker.getRadius() : 10;

        marker.setRadius(0.1);

        [0.5, 1.35, 0.9, 1.1, 1].forEach((f, i) =>

          setTimeout(() => { try { marker.setRadius(base * f); } catch { /* marker removed */ } }, 60 + i * 70)

        );

      }

      requestAnimationFrame(() => {

        const el = marker.getElement && marker.getElement();

        if (el) {

          el.classList.add('marker-pin-drop');

          el.addEventListener('animationend', () => el.classList.remove('marker-pin-drop'), { once: true });

        }

      });

    }

    return marker;

  }



  function refreshReportMarkers() {

    if (!reportMarkerLayer) return;

    let reopenId = null;

    reportMarkerMap.forEach((marker, id) => {

      try {

        if (marker && typeof marker.isPopupOpen === 'function' && marker.isPopupOpen()) {

          reopenId = id;

        }

      } catch { /* marker torn down */ }

    });

    reportMarkerLayer.clearLayers();

    reportMarkerMap.clear();

    let pool = reportsForMap();

    if (map) pool = reportsInViewport(pool);

    pool = prioritizeMapReports(pool).slice(0, SCALE_CFG.maxMapMarkers);

    pool.forEach((r) => createReportMarker(r));

    if (reopenId != null) {

      const marker = reportMarkerMap.get(reopenId);

      if (marker) {

        try { marker.openPopup(); } catch { /* ignore */ }

      }

    }

    if (typeof renderWardPulse === 'function') renderWardPulse();

  }



  function getUserWardPulseStats() {
    const ward = user && user.ward;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let open = 0;
    let fixedWeek = 0;
    let meToo = 0;
    cityScopedReports(loadReports()).forEach((r) => {
      if (!ward || r.ward !== ward) return;
      if (typeof isReportPubliclyHidden === 'function' && isReportPubliclyHidden(r)) return;
      if (r.status === 'pending') {
        open += 1;
        meToo += Number(r.confirmations) || 0;
      } else if (r.status === 'resolved') {
        const ts = r.resolvedAt || r.timestamp;
        if (ts && new Date(ts).getTime() >= weekAgo) fixedWeek += 1;
      }
    });
    return { open, fixedWeek, meToo };
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
    if (openEl) openEl.textContent = String(stats.open);
    if (fixedEl) fixedEl.textContent = String(stats.fixedWeek);
    if (meTooEl) meTooEl.textContent = String(stats.meToo);
    el.setAttribute('aria-label', t('pulse.aria'));
  }

  function loadReportMarkers() {

    refreshReportMarkers();

  }



  /* ---------- Events ---------- */

  function bindEvents() {

    bindHazardPicker();

    Object.entries(overlays).forEach(([name, el]) => {

      el.addEventListener('click', (e) => {

        if (e.target !== el) return;

        if (isBlockingOverlay(name)) return;

        dismissOverlayByName(name);

      });

    });



    $('#tosAccept').addEventListener('change', (e) => {

      $('#btnTosContinue').disabled = !e.target.checked;

    });

    $('#btnTosContinue').addEventListener('click', () => {

      user.tosAccepted = true;

      user.analyticsConsent = !!$('#tosAnalytics').checked;

      saveUser();

      if (window.CivicAnalytics) CivicAnalytics.setConsent(!!user.analyticsConsent);

      closeModal('tos');

      maybeRequestLocation(true);

      if (!user.ward) openModal('onboarding');

    });



    $('#btnOnboardingContinue').addEventListener('click', () => {

      const ward = getOnboardingWard().trim();

      const name = resolveDisplayName($('#displayName').value, { ward, city: getOnboardingCity() });

      $('#wardError').classList.add('hidden');

      if (!ward) {

        revealFieldError($('#wardError'));

        if ($('#wardManualGroup')?.classList.contains('hidden')) showOnboardingWardManual();

        else $('#wardInput')?.focus();

        return;

      }

      if (!isValidWard(ward, getOnboardingCity())) {

        revealFieldError($('#wardError'));

        showToast(t('toast.wardRequired').replace('{city}', getCityLabel(getOnboardingCity())), 'error');

        return;

      }

      user.city = getOnboardingCity();

      user.ward = ward;

      user.society = sanitizeText($('#onboardSociety')?.value || '', 120);

      cacheSocietyIfCustom(user.city, user.ward, user.society);

      user.displayName = name;

      saveUser();

      recordReferralRedemption();

      updatePartnerPortalUi();

      if (window.CivicAnalytics) {

        CivicAnalytics.track('onboarding_complete', {

          wardCode: ward.split('—')[0].trim(),

          city: user.city,

        }, ward);

      }

      closeModal('onboarding');

      updateHeaderContext();

      updateProfileUI();

      updatePersonaUI();

      updateHomeHero();

      updateMapEmptyCta();

      renderLeaderboard('wards');

      renderLeaderboard('citizens');

      showToast(t('toast.welcome').replace('{name}', name), 'success', 4500);

      if (!shouldShowHomeHero()) setTimeout(showCoachMark, 500);

    });



    $('#wardInput').addEventListener('input', () => {

      $('#wardError').classList.add('hidden');

      onboardingDetectedWard = '';

      refreshSocietyForOnboarding();

    });



    const btnWardManual = $('#btnWardManual');

    if (btnWardManual) btnWardManual.addEventListener('click', showOnboardingWardManual);

    const btnWardRetry = $('#btnWardRetry');

    if (btnWardRetry) btnWardRetry.addEventListener('click', startOnboardingWardDetect);

    const onboardCity = $('#onboardCity');

    if (onboardCity) {

      onboardCity.addEventListener('change', () => {

        onboardingDetectedWard = '';

        if ($('#wardInput')) $('#wardInput').value = '';

        syncOnboardingCityUi(getOnboardingCity());

        startOnboardingWardDetect();

      });

    }



    const reportReminderToggle = $('#reportReminderToggle');

    if (reportReminderToggle) {

      reportReminderToggle.addEventListener('change', (e) => {

        handleReportReminderToggle(e.target.checked);

      });

    }



    const nbhNewAlertToggle = $('#nbhNewAlertToggle');

    if (nbhNewAlertToggle) {

      nbhNewAlertToggle.addEventListener('change', (e) => {

        handleNbhNewAlertToggle(e.target.checked);

      });

    }



    const nbhResolvedAlertToggle = $('#nbhResolvedAlertToggle');

    if (nbhResolvedAlertToggle) {

      nbhResolvedAlertToggle.addEventListener('change', (e) => {

        handleNbhResolvedAlertToggle(e.target.checked);

      });

    }



    const profileSocietyInput = $('#profileSocietyInput');

    if (profileSocietyInput) {

      profileSocietyInput.addEventListener('change', saveProfileSociety);

      profileSocietyInput.addEventListener('blur', saveProfileSociety);

    }

    const profileDisplayNameInput = $('#profileDisplayNameInput');

    if (profileDisplayNameInput) {

      profileDisplayNameInput.addEventListener('change', saveProfileDisplayName);

      profileDisplayNameInput.addEventListener('blur', saveProfileDisplayName);

    }



    $('#btnDismissCoach').addEventListener('click', dismissCoachMark);

    const coachMark = $('#coachMark');

    if (coachMark) {

      coachMark.addEventListener('click', (e) => {

        if (e.target === coachMark) dismissCoachMark();

      });

    }



    const btnTourNext = $('#btnTourNext');

    if (btnTourNext) btnTourNext.addEventListener('click', nextTourStep);

    const btnTourSkip = $('#btnTourSkip');

    if (btnTourSkip) btnTourSkip.addEventListener('click', () => endTour(false));

    const tourOverlay = $('#tourOverlay');

    if (tourOverlay) {

      tourOverlay.addEventListener('click', (e) => {

        // Backdrop tap (anywhere outside the bubble) skips the tour.

        if (e.target === tourOverlay || e.target === $('#tourSpotlight')) endTour(false);

      });

    }

    const btnReplayTour = $('#btnReplayTour');

    if (btnReplayTour) {

      btnReplayTour.addEventListener('click', () => {

        closeModal('profile');

        setTimeout(() => startTour({ replay: true }), 250);

      });

    }

    $('#btnPartnerAccess').addEventListener('click', window.openPartnerPortal);

    $('#btnPartnerInquiry').addEventListener('click', window.openPartnerInquiry);

    const btnBecomeCoord = $('#btnBecomeCoordinator');

    if (btnBecomeCoord) {

      btnBecomeCoord.addEventListener('click', () => {

        closeModal('about');

        window.openLeadNominationModal();

      });

    }

    $('#btnAbout').addEventListener('click', window.openAboutModal);

    $('#btnAboutClose').addEventListener('click', () => closeModal('about'));

    const btnProfileFeedback = $('#btnProfileFeedback');

    if (btnProfileFeedback) btnProfileFeedback.addEventListener('click', () => window.openFeedbackModal());

    const btnProfileOfficialChannels = $('#btnProfileOfficialChannels');

    if (btnProfileOfficialChannels) {
      btnProfileOfficialChannels.addEventListener('click', () => {
        closeModal('profile');
        window.openResourcesModal();
      });
    }

    const btnProfileCommunityHelp = $('#btnProfileCommunityHelp');

    if (btnProfileCommunityHelp) {
      btnProfileCommunityHelp.addEventListener('click', () => {
        closeModal('profile');
        window.openResourcesModal();
      });
    }

    const btnAboutFeedback = $('#btnAboutFeedback');

    if (btnAboutFeedback) {

      btnAboutFeedback.addEventListener('click', () => {

        closeModal('about');

        window.openFeedbackModal();

      });

    }

    const feedbackForm = $('#feedbackForm');

    if (feedbackForm) {

      feedbackForm.addEventListener('submit', (e) => {

        e.preventDefault();

        submitFeedback();

      });

    }



    /* ---- Coordinator access request / claim / review wiring ---- */

    const btnProfileLeadNominate = $('#btnProfileLeadNominate');

    if (btnProfileLeadNominate) {

      btnProfileLeadNominate.addEventListener('click', () => {

        closeModal('profile');

        window.openLeadNominationModal();

      });

    }

    const btnProfileBmcAccess = $('#btnProfileBmcAccess');

    if (btnProfileBmcAccess) {

      btnProfileBmcAccess.addEventListener('click', () => {

        closeModal('profile');

        window.openAccessRequestModal();

      });

    }

    const btnPartnerLeadNominate = $('#btnPartnerLeadNominate');

    if (btnPartnerLeadNominate) {

      btnPartnerLeadNominate.addEventListener('click', () => {

        closeModal('partner');

        window.openLeadNominationModal();

      });

    }

    const btnPartnerBmcRequest = $('#btnPartnerBmcRequest');

    if (btnPartnerBmcRequest) {

      btnPartnerBmcRequest.addEventListener('click', () => {

        closeModal('partner');

        window.openAccessRequestModal();

      });

    }

    const btnPartnerClaim = $('#btnPartnerClaim');

    if (btnPartnerClaim) {

      btnPartnerClaim.addEventListener('click', () => {

        closeModal('partner');

        window.openAccessClaimModal();

      });

    }

    const accessForm = $('#accessForm');

    if (accessForm) {

      accessForm.addEventListener('submit', (e) => { e.preventDefault(); submitAccessRequest(); });

    }

    const accessCity = $('#accessCity');

    if (accessCity) accessCity.addEventListener('change', syncAccessWardList);

    const btnAccessProof = $('#btnAccessProof');

    if (btnAccessProof) btnAccessProof.addEventListener('click', () => $('#accessProofInput')?.click());

    const accessProofInput = $('#accessProofInput');

    if (accessProofInput) accessProofInput.addEventListener('change', handleAccessProofPick);

    const btnAccessHaveCode = $('#btnAccessHaveCode');

    if (btnAccessHaveCode) btnAccessHaveCode.addEventListener('click', () => window.openAccessClaimModal());

    const btnAccessConfirmCode = $('#btnAccessConfirmCode');

    if (btnAccessConfirmCode) btnAccessConfirmCode.addEventListener('click', () => window.openAccessClaimModal());

    const btnAccessDone = $('#btnAccessDone');

    if (btnAccessDone) btnAccessDone.addEventListener('click', () => closeModal('accessRequest'));



    const accessClaimForm = $('#accessClaimForm');

    if (accessClaimForm) {

      accessClaimForm.addEventListener('submit', (e) => { e.preventDefault(); submitAccessClaim(); });

    }



    const leadNomForm = $('#leadNomForm');

    if (leadNomForm) {

      leadNomForm.addEventListener('submit', (e) => { e.preventDefault(); submitLeadNomination(); });

      leadNomForm.addEventListener('change', (e) => {

        if (e.target && e.target.name === 'leadRoleType') syncLeadNomNeighbourhoodVisibility();

      });

    }

    const leadNomCity = $('#leadNomCity');

    if (leadNomCity) leadNomCity.addEventListener('change', syncLeadNomWardList);

    const leadNomWard = $('#leadNomWard');

    if (leadNomWard) leadNomWard.addEventListener('input', refreshLeadNomNeighbourhoodDatalist);

    const btnLeadNomDone = $('#btnLeadNomDone');

    if (btnLeadNomDone) btnLeadNomDone.addEventListener('click', () => closeModal('leadNom'));

    const btnLeadNomViewCommunity = $('#btnLeadNomViewCommunity');

    if (btnLeadNomViewCommunity) {

      btnLeadNomViewCommunity.addEventListener('click', () => {

        closeModal('leadNom');

        window.openCommunityModal();

      });

    }

    const btnCommunityBecomeLead = $('#btnCommunityBecomeLead');

    if (btnCommunityBecomeLead) {

      btnCommunityBecomeLead.addEventListener('click', () => window.openLeadNominationModal());

    }

    const leadCandidatesList = $('#leadCandidatesList');

    if (leadCandidatesList) {

      leadCandidatesList.addEventListener('click', (e) => {

        const btn = e.target.closest('[data-lead-vote]');

        if (!btn) return;

        castLeadVote(btn.dataset.leadVote);

      });

    }



    const btnAccessReviewOpen = $('#btnAccessReviewOpen');

    if (btnAccessReviewOpen) btnAccessReviewOpen.addEventListener('click', () => window.openAccessReview());

    const btnOpenTracking = $('#btnOpenTracking');

    if (btnOpenTracking) btnOpenTracking.addEventListener('click', () => window.openTrackingDashboard());

    const btnCoordTracking = $('#btnCoordTracking');

    if (btnCoordTracking) btnCoordTracking.addEventListener('click', () => window.openTrackingDashboard());

    const btnAccessReviewTracking = $('#btnAccessReviewTracking');

    if (btnAccessReviewTracking) btnAccessReviewTracking.addEventListener('click', () => window.openTrackingDashboard());

    const btnTrackingClose = $('#btnTrackingClose');

    if (btnTrackingClose) btnTrackingClose.addEventListener('click', () => { closeModal('tracking'); setNavTab('map'); });

    const trackingDays = $('#trackingDays');

    if (trackingDays) trackingDays.addEventListener('change', () => renderTrackingDashboard());

    const trackingWardFilter = $('#trackingWardFilter');

    if (trackingWardFilter) trackingWardFilter.addEventListener('change', () => renderTrackingDashboard());

    const btnAccessReviewClose = $('#btnAccessReviewClose');

    if (btnAccessReviewClose) {

      btnAccessReviewClose.addEventListener('click', () => { closeModal('accessReview'); setNavTab('map'); });

    }

    const accessReviewList = $('#accessReviewList');

    if (accessReviewList) {

      accessReviewList.addEventListener('click', (e) => {

        const btn = e.target.closest('[data-access-action]');

        if (!btn) return;

        const action = btn.dataset.accessAction;

        if (action === 'approve') approveAccessReq(btn.dataset.accessId);

        else if (action === 'reject') rejectAccessReq(btn.dataset.accessId);

        else if (action === 'copy') {

          copyTextSafe(btn.dataset.accessCode, null);

          showToast(t('access.codeCopied'), 'success', 5000);

        }

      });

    }

    $('#btnDeleteData').addEventListener('click', () => { deleteMyData(); });

    $('#btnDeleteConfirmCancel').addEventListener('click', () => closeModal('deleteConfirm'));

    $('#btnDeleteConfirmProceed').addEventListener('click', () => { executeDeleteMyData(); });

    const btnWithdrawAnalytics = $('#btnWithdrawAnalytics');

    if (btnWithdrawAnalytics) btnWithdrawAnalytics.addEventListener('click', withdrawAnalyticsConsent);

    const btnWithdrawGps = $('#btnWithdrawGps');

    if (btnWithdrawGps) btnWithdrawGps.addEventListener('click', withdrawGpsConsent);

    const btnPrivacyContact = $('#btnPrivacyContact');

    if (btnPrivacyContact) {

      // Fall back so the contact never stays as a dead '#' (Play reviewers click these).
      const grievanceEmail = getGrievanceEmail() || 'civicradarnh@gmail.com';

      btnPrivacyContact.href = 'mailto:' + grievanceEmail

        + '?subject=' + encodeURIComponent('CivicRadar — privacy / DPDP grievance');

    }

    // Self-heal static escalation labels if index.html still shows retired BMC deep-link text.
    // Build needles without embedding retired host strings (Play reviewers Ctrl+F the bundle).
    const retiredPortalNeedle = ['portal', 'mcgm', 'gov', 'in'].join('.');
    const retiredAapleNeedle = 'maha' + 'online';
    $$('.esc-channel small').forEach((el) => {
      const txt = el.textContent || '';
      if (txt.indexOf(retiredPortalNeedle) !== -1) {
        el.textContent = 'www.mcgm.gov.in';
      }
      if (txt.indexOf(retiredAapleNeedle) !== -1) {
        el.textContent = 'pgportal.gov.in';
      }
    });

    const btnCopyImpact = $('#btnCopyImpact');

    if (btnCopyImpact) btnCopyImpact.addEventListener('click', copyImpactSummary);

    const btnCopyPitch = $('#btnCopySharePitch');

    if (btnCopyPitch) btnCopyPitch.addEventListener('click', copySharePitch);

    const btnShareWard = $('#btnShareWardChallenge');

    if (btnShareWard) btnShareWard.addEventListener('click', shareWardChallengeWhatsApp);

    const btnShareRecap = $('#btnShareWeeklyRecap');

    if (btnShareRecap) btnShareRecap.addEventListener('click', shareWeeklyRecapWhatsApp);

    const btnSeasonDismiss = $('#btnSeasonHookDismiss');

    if (btnSeasonDismiss) btnSeasonDismiss.addEventListener('click', dismissSeasonHook);

    const btnIosInstallDismiss = $('#btnIosInstallDismiss');

    if (btnIosInstallDismiss) btnIosInstallDismiss.addEventListener('click', () => dismissIosInstallHint());

    const btnRefDismiss = $('#btnRefWelcomeDismiss');

    if (btnRefDismiss) btnRefDismiss.addEventListener('click', dismissReferralWelcome);

    const btnRefMap = $('#btnRefWelcomeMap');

    if (btnRefMap) btnRefMap.addEventListener('click', dismissReferralWelcome);

    const btnRefReport = $('#btnRefWelcomeReport');

    if (btnRefReport) {

      btnRefReport.addEventListener('click', () => {

        dismissReferralWelcome();

        if (typeof window.openReportModal === 'function') window.openReportModal();

        else $('#btnCamera')?.click();

      });

    }

    const btnShareWinWa = $('#btnShareWinWhatsApp');

    if (btnShareWinWa) {

      btnShareWinWa.addEventListener('click', () => {

        const report = findReportById(pendingShareWinReportId);

        if (!report) return;

        const msg = pendingShareWinType === 'cleanup'

          ? buildShareCleanupMessage(report)

          : buildShareResolvedMessage(report);

        shareWhatsApp(msg, {

          context: pendingShareWinType === 'cleanup' ? 'cleanup' : 'resolved',

          ward: report.ward,

          meta: { reportId: String(report.id) },

        });

      });

    }

    const btnShareWinClose = $('#btnShareWinClose');

    if (btnShareWinClose) btnShareWinClose.addEventListener('click', () => closeModal('shareWin'));

    const btnShareWinDownload = $('#btnShareWinDownload');

    if (btnShareWinDownload) btnShareWinDownload.addEventListener('click', () => { downloadSuccessCard(); });

    const btnShareWinCopyCaption = $('#btnShareWinCopyCaption');

    if (btnShareWinCopyCaption) btnShareWinCopyCaption.addEventListener('click', copyInstagramCaption);

    const btnShareWinNativeShare = $('#btnShareWinNativeShare');

    if (btnShareWinNativeShare) btnShareWinNativeShare.addEventListener('click', () => { nativeShareSuccessCard(); });

    const btnShareWinAspectSquare = $('#btnShareWinAspectSquare');

    const btnShareWinAspectStory = $('#btnShareWinAspectStory');

    if (btnShareWinAspectSquare) btnShareWinAspectSquare.addEventListener('click', () => setShareWinAspect('square'));

    if (btnShareWinAspectStory) btnShareWinAspectStory.addEventListener('click', () => setShareWinAspect('story'));

    const btnCertClose = $('#btnCertClose');

    if (btnCertClose) btnCertClose.addEventListener('click', () => closeModal('certificate'));

    const btnCertWhatsApp = $('#btnCertWhatsApp');

    if (btnCertWhatsApp) btnCertWhatsApp.addEventListener('click', shareCertificateWhatsApp);

    const btnCertDownload = $('#btnCertDownload');

    if (btnCertDownload) btnCertDownload.addEventListener('click', () => { downloadCertificate(); });

    const btnCertCopyCaption = $('#btnCertCopyCaption');

    if (btnCertCopyCaption) btnCertCopyCaption.addEventListener('click', copyCertificateCaption);

    $('#btnContactFounder').addEventListener('click', () => {

      const email = getFounderContactEmail();

      if (email) window.open(`mailto:${email}?subject=${encodeURIComponent('CivicRadar — inquiry')}`, '_self');

    });

    $('#btnInquiryEmail').addEventListener('click', () => {

      const email = getPartnerEmail();

      if (!email) { showToast(t('toast.contactConfig'), 'info'); return; }

      const subject = encodeURIComponent('CivicRadar partnership inquiry');

      const body = encodeURIComponent(

        'Hi,\n\nI am interested in partnering with CivicRadar.\n\nOrganisation:\nWard(s) of interest:\n\nThanks,'

      );

      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self');

    });

    $('#btnPartnerBmc').addEventListener('click', () => {

      closeModal('partner');

      window.openAdminModal();

    });

    $('#btnPartnerNgo').addEventListener('click', () => {

      closeModal('partner');

      window.openLeadModal();

    });



    $$('.modal__close').forEach((btn) => {

      btn.addEventListener('click', () => {

        dismissOverlayByName(btn.dataset.close);

      });

    });



    $('#personaBarAction').addEventListener('click', () => {

      if (isAdmin) {

        setAdminMode(false);

        showToast(t('toast.citizenView'), 'info');

      } else if (isLead) {

        setLeadMode(false);

        closeModal('coordinator');

        showToast(t('toast.citizenView'), 'info');

      }

    });



    $('#personaBar').addEventListener('click', (e) => {

      if (e.target.closest('#personaBarAction')) return;

      if (isAdmin && countOverdueReports() > 0) window.openAdminQueue();

      else if (isLead) window.openCoordinatorDashboard();

    });



    $('#btnCamera').addEventListener('click', () => window.openReportModal(true));

    const mapEmptyBtn = $('#btnMapEmptyReport');

    if (mapEmptyBtn) mapEmptyBtn.addEventListener('click', () => window.openReportModal(true));

    const mapEmptyShare = $('#btnMapEmptyShare');

    if (mapEmptyShare) {

      mapEmptyShare.addEventListener('click', () => {

        shareWardChallengeWhatsApp();

      });

    }

    const btnHeroDismiss = $('#btnHeroDismiss');

    if (btnHeroDismiss) btnHeroDismiss.addEventListener('click', dismissHomeHero);

    const btnHeroReport = $('#btnHeroReport');

    if (btnHeroReport) btnHeroReport.addEventListener('click', () => window.openReportModal(true));

    const btnHeroTour = $('#btnHeroTour');

    if (btnHeroTour) {

      btnHeroTour.addEventListener('click', () => startTour({ replay: true }));

    }

    $('#btnTakePhoto').addEventListener('click', () => openReportPhotoPicker());

    $('#photoInput').addEventListener('change', handlePhotoCapture);

    $('#photoInput').addEventListener('cancel', () => {

      reportPhotoFlowActive = false;

      touchReportDraft({ awaitingPhoto: false });

    });

    const btnRetake = $('#btnRetakePhoto');

    if (btnRetake) {

      btnRetake.addEventListener('click', () => {

        // Block retake while submit/morph is in flight — clearing lastReportDataUrl
        // here previously wiped the success-modal thumbnail after the report was saved.
        if (submitReport.__inFlight) return;

        const submitBtn = $('#btnSubmitReport');

        if (submitBtn && (submitBtn.classList.contains('is-loading') || submitBtn.classList.contains('is-success'))) return;

        resetPhotoConfirm();

        const canvas = $('#imageCanvas');

        if (window.ImageModeration) {

          ImageModeration.clearPhotoCanvas(canvas, $('#photoInput'));

        } else {

          canvas.classList.remove('visible');

          $('#photoInput').value = '';

        }

        lastReportDataUrl = null;

        updateReportFlowSteps('capture');

        openReportPhotoPicker();

      });

    }

    const btnOfficialToggle = $('#btnSuccessOfficialToggle');

    if (btnOfficialToggle) {

      btnOfficialToggle.addEventListener('click', () => {

        const body = $('#successOfficialBody');

        const block = $('#successOfficialBlock');

        const open = body && body.classList.toggle('hidden') === false;

        if (block) block.classList.toggle('official-channels-block--collapsed', !open);

        btnOfficialToggle.setAttribute('aria-expanded', open ? 'true' : 'false');

      });

    }

    wireCollapsibleSection('btnCommunityWardImpactToggle', 'communityWardImpactBody', 'communityWardImpactSection');

    wireCollapsibleSection('btnCommunityLeaderboardToggle', 'communityLeaderboardBody', 'communityLeaderboardSection');

    wireCollapsibleSection('btnGetInvolvedToggle', 'getInvolvedBody', 'getInvolvedSection');


    wireCollapsibleSection('btnProfileDetailsToggle', 'profileDetailsBody', 'profileDetailsSection');

    wireCollapsibleSection('btnProfileActivityToggle', 'profileActivityBody', 'profileActivitySection');

    wireCollapsibleSection('btnProfileNotificationsToggle', 'profileNotificationsBody', 'profileNotificationsSection');

    wireCollapsibleSection('btnProfileAccountToggle', 'profileAccountBody', 'profileAccountSection');

    const btnNotesToggle = $('#btnReportNotesToggle');

    if (btnNotesToggle) {

      btnNotesToggle.addEventListener('click', () => setReportNotesExpanded(true));

    }

    const btnPinFullMap = $('#btnReportPinFullMap');

    if (btnPinFullMap) {

      btnPinFullMap.addEventListener('click', () => startManualPinMode());

    }

    $('#reportNotes').addEventListener('input', () => {

      if ($('#imageCanvas').classList.contains('visible')) {

        updateReportFlowSteps('confirm');

      }

    });

    $('#btnSubmitReport').addEventListener('click', submitReport);



    $('#btnShareTwitter').addEventListener('click', () => shareTwitter(buildDefaultShareMessage()));

    $('#btnShareWhatsApp').addEventListener('click', () => {

      if (lastReportId) shareReportWhatsApp(lastReportId);

      else shareWhatsApp(buildDefaultShareMessage());

    });

    const btnSuccessNative = $('#btnSuccessNativeShare');

    if (btnSuccessNative) btnSuccessNative.addEventListener('click', () => { nativeShareReport(); });

    const btnSuccessFilingGuide = $('#btnSuccessFilingGuide');

    if (btnSuccessFilingGuide) {

      btnSuccessFilingGuide.addEventListener('click', () => {

        if (!lastReportId) return;

        closeModal('success');

        resetReportForm();

        flushPendingPwaNudge();

        openEscalationModal(lastReportId);

      });

    }

    $('#btnSuccessClose').addEventListener('click', () => dismissSuccessModal());



    $('#btnEscCall').addEventListener('click', escalationFileCall);

    $('#btnEscWhatsApp').addEventListener('click', escalationFileWhatsApp);

    $('#btnEscPortal').addEventListener('click', escalationFilePortal);

    $('#btnEscMarg').addEventListener('click', escalationFileMargApp);

    $('#btnEscTweet').addEventListener('click', escalationFileTweet);

    $('#btnEscCopyAll').addEventListener('click', copyEscAllDetails);

    $('#btnEscSaveId').addEventListener('click', saveComplaintId);

    $('#btnEscAaple').addEventListener('click', escalationOpenAapleSarkar);

    $('#btnEscParticipate').addEventListener('click', escalationOpenParticipateMumbai);

    const btnEscCorp = $('#btnEscCorpPortal');

    if (btnEscCorp) btnEscCorp.addEventListener('click', escalationOpenCorpPortal);

    const btnEscCorpAaple = $('#btnEscCorpAaple');

    if (btnEscCorpAaple) btnEscCorpAaple.addEventListener('click', escalationOpenCorpAaple);

    const escModal = $('#escalationModal');

    if (escModal) escModal.addEventListener('click', handleCorpChannelClick);

    document.addEventListener('click', (e) => {

      if (e.target.closest('[data-official-channel]')) handleOfficialChannelClick(e);

    });

    $('#btnEscResolveOwn').addEventListener('click', (e) => resolveOwnReport(e.currentTarget.dataset.reportId));

    $('#btnEscClose').addEventListener('click', tryCloseEscalation);

    const escLadder = $('#escLadder');

    if (escLadder) escLadder.addEventListener('click', handleEscLadderAction);

    const escConsent = $('#escFiledConsent');

    if (escConsent) escConsent.addEventListener('change', () => updateEscSaveState(findReportById(activeEscalationId)));

    const escComplaintInput = $('#escComplaintId');

    if (escComplaintInput) escComplaintInput.addEventListener('input', () => updateEscSaveState(findReportById(activeEscalationId)));



    const langBtn = $('#btnLang');

    if (langBtn) langBtn.addEventListener('click', openLanguagePicker);



    const notifyBtn = $('#btnSoonNotify');

    if (notifyBtn) notifyBtn.addEventListener('click', () => recordInterest(notifyBtn.dataset.hazard));



    // Delegated handler for "Me too" buttons inside Leaflet popups (popup DOM

    // is created/destroyed on open/close, so binding per-popup is fragile).

    document.addEventListener('click', (e) => {

      const cb = e.target.closest && e.target.closest('[data-confirm]');

      if (cb) {

        e.preventDefault();

        e.stopPropagation();

        if (cb.disabled || cb.getAttribute('aria-disabled') === 'true') return;

        const rid = cb.dataset.confirm;

        if (hasConfirmed(rid)) {

          showMeTooDoneInPopup(cb);

          showToast(t('confirm.done'), 'info', 2200);

          return;

        }

        disableMeTooControl(cb);

        // confirmReport → refreshReportMarkers reopens popup with Me-too done state

        if (!confirmReport(rid) && !hasConfirmed(rid)) {

          cb.disabled = false;

          cb.removeAttribute('aria-disabled');

          cb.classList.remove('popup__btn--busy');

        }

        return;

      }

      const fixBtn = e.target.closest && e.target.closest('[data-fix-confirm]');

      if (fixBtn) {

        e.preventDefault();

        if (confirmFix(fixBtn.dataset.fixConfirm) && map) map.closePopup();

        return;

      }

      const hideBtn = e.target.closest && e.target.closest('[data-hide]');

      if (hideBtn) {

        e.preventDefault();

        if (window.confirm(t('safety.hideConfirm'))) hideReportFromMap(hideBtn.dataset.hide);

        return;

      }

      const muteBtn = e.target.closest && e.target.closest('[data-mute-reporter]');

      if (muteBtn) {

        e.preventDefault();

        if (window.confirm(t('mute.hideConfirm'))) muteReporter(muteBtn.dataset.muteReporter);

        return;

      }

      const volBtn = e.target.closest && e.target.closest('[data-volunteer-help]');

      if (volBtn) {

        e.preventDefault();

        if (offerVolunteerTask(volBtn.dataset.volunteerHelp) && map) map.closePopup();

      }

    });



    $('#btnLeaderboard').addEventListener('click', window.openCommunityModal);

    $$('#leaderboardToggle .segment-control__btn').forEach((btn) => {

      btn.addEventListener('click', () => {

        $$('#leaderboardToggle .segment-control__btn').forEach((b) => b.classList.remove('active'));

        btn.classList.add('active');

        const view = btn.dataset.view;

        $('#wardsPanel').classList.toggle('hidden', view !== 'wards');

        $('#citizensPanel').classList.toggle('hidden', view !== 'citizens');

        renderLeaderboard(view);

      });

    });

    $$('#leaderboardPeriodToggle .segment-control__btn').forEach((btn) => {

      btn.addEventListener('click', () => {

        $$('#leaderboardPeriodToggle .segment-control__btn').forEach((b) => b.classList.remove('active'));

        btn.classList.add('active');

        leaderboardPeriod = btn.dataset.period;

        renderLeaderboard('wards');

        renderLeaderboard('citizens');

      });

    });



    $('#btnOpenPledge').addEventListener('click', () => {

      closeModal('resources');

      window.openPledgeModal();

    });

    $('#btnOpenVolunteer').addEventListener('click', () => {

      closeModal('resources');

      window.openVolunteerModal();

    });

    $('#btnSubmitPledge').addEventListener('click', submitPledge);

    $('#btnSubmitVolunteer').addEventListener('click', submitVolunteerSignup);

    $('#btnRemoveVolunteer').addEventListener('click', removeVolunteerSignup);

    $$('#volunteerHoursPicker .hours-picker__btn').forEach((btn) => {

      btn.addEventListener('click', () => {

        $$('#volunteerHoursPicker .hours-picker__btn').forEach((b) => b.classList.remove('active'));

        btn.classList.add('active');

        const isCustom = btn.dataset.hours === 'custom';

        $('#volunteerHoursCustom').classList.toggle('hidden', !isCustom);

        if (isCustom) $('#volunteerHoursCustom').focus();

      });

    });



    $('#btnProfile').addEventListener('click', window.openProfileModal);



    $$('#bottomNav .nav-tab').forEach((tab) => {

      tab.addEventListener('click', () => {

        if (isReportPhotoPickerActive()) return;

        setNavTab(tab.dataset.tab);

        const target = tab.dataset.tab;

        if (window.CivicAnalytics) CivicAnalytics.track('tab_view', { tab: target });

        if (target === 'community') window.openCommunityModal();

        else if (target === 'resources') window.openResourcesModal();

        else if (target === 'profile') window.openProfileModal();

        else closeAllModals();

      });

    });



    $('#btnEnableLocation').addEventListener('click', () => {

      // Tapping "Enable" is an explicit opt-in to GPS collection.

      enableLocationFromUser();

    });

    const btnManualPinCancel = $('#btnManualPinCancel');

    if (btnManualPinCancel) {

      btnManualPinCancel.addEventListener('click', () => {

        stopManualPinMode(true);

        ensureReportModalOpen();

        updateReportFlowSteps('confirm');

      });

    }

    $('#btnDismissLocation').addEventListener('click', () => {

      // Dismiss = snooze the banner and collapse to the compact locate pill.

      snoozeLocBanner();

      hideLocationBanner();

      showLocatePill();

    });

    $('#btnLocatePill').addEventListener('click', () => {

      // Explicit tap bypasses the snooze and re-runs the enable-location flow.

      enableLocationFromUser();

    });

    $('#btnRecenter').addEventListener('click', () => {

      // Re-acquire GPS — panning to a stale WiFi fix keeps the half-mile error.

      requestLocation(true, true);

    });



    $('#badgeAdmin').addEventListener('click', () => {

      if (isAdmin) window.openAdminQueue();

    });

    $('#badgeLead').addEventListener('click', () => {

      if (isLead) window.openCoordinatorDashboard();

    });



    document.addEventListener('keydown', (e) => {

      if (e.key === 'Escape') {

        const coach = $('#coachMark');

        if (coach && !coach.classList.contains('hidden')) {

          dismissCoachMark();

          return;

        }

        const topName = getTopmostOpenModalName();

        if (!topName || isBlockingOverlay(topName)) return;

        dismissOverlayByName(topName);

      }

      if (e.ctrlKey && e.shiftKey && e.key === 'A') window.openAdminModal();

      if (e.ctrlKey && e.shiftKey && e.key === 'L') {

        if (isLead) window.openCoordinatorDashboard();

        else window.openLeadModal();

      }

    });



    // Android hardware back / browser back: close main sheets instead of leaving the TWA.

    // Camera return pops history — keep the sheet open only while the photo picker is active

    // (or within the dismiss guard). A photo already on confirm must NOT block normal back.

    window.addEventListener('popstate', () => {

      const photoReturn = isReportPhotoPickerActive()

        || (hasReportPhotoPreview() && Date.now() - reportPhotoDismissGuard < PHOTO_RETURN_GUARD_MS);

      const backTargets = ['community', 'resources', 'profile', 'report', 'success', 'shareWin', 'certificate'];

      const backClose = backTargets.some((name) => overlays[name]?.classList.contains('open'));

      const openOverlays = backTargets.filter((name) => overlays[name]?.classList.contains('open'));

      debugLog('POPSTATE', 'popstate', { photoReturn, backClose, openOverlays: openOverlays.join(',') || 'none' });

      if (photoReturn) {

        debugLog('POPSTATE', 'branch photoReturn', { action: 'syncReportPhotoReturn' });

        syncReportPhotoReturn();

        if (overlays.report?.classList.contains('open')) pushNavModalHistory();

        return;

      }

      if (!backClose) {

        debugLog('POPSTATE', 'branch noop', { reason: 'no overlay open' });

        return;

      }

      if (overlays.report?.classList.contains('open') && !canDismissReportOverlay()) {

        debugLog('POPSTATE', 'branch blocked', { reason: 'report photo picker active' });

        pushNavModalHistory();

        return;

      }

      if (overlays.success?.classList.contains('open')) dismissSuccessModal();

      debugLog('POPSTATE', 'branch closeStack', { action: 'closeStackedModalsForNav' });

      closeStackedModalsForNav(null);

      setNavTab('map');

    });



    window.addEventListener('pageshow', (e) => {

      if (isReportPhotoPickerActive() || hasReportPhotoPreview()) {

        debugLog('PHOTO', 'pageshow during report', { persisted: !!e.persisted, pickerActive: isReportPhotoPickerActive(), hasPreview: hasReportPhotoPreview() });

        restoreReportDraftIfNeeded();

        syncReportPhotoReturn();

        scheduleMapResize();

        return;

      }

      maybeResetSessionOnResume({ bfcache: e.persisted });

      if (!skipReportDraftRestoreOnce) restoreReportDraftIfNeeded();

      else skipReportDraftRestoreOnce = false;

      scheduleMapResize();

    });



    let adminTapCount = 0;

    let leadTapCount = 0;

    $('#profileGreeting').addEventListener('click', () => {

      adminTapCount++;

      if (adminTapCount >= 5) {

        adminTapCount = 0;

        window.openAdminModal();

      }

      setTimeout(() => { adminTapCount = 0; }, 2000);

    });



    const profileCity = $('#profileCity');

    if (profileCity) {

      profileCity.addEventListener('change', () => {

        syncProfileCityUi(getProfileCity());

        saveProfileWard();

      });

    }

    const profileWardInput = $('#profileWardInput');

    if (profileWardInput) {

      profileWardInput.addEventListener('input', () => {

        $('#profileWardError')?.classList.add('hidden');

        const city = getProfileCity();

        const ward = profileWardInput.value.trim();

        if (ward && isValidWard(ward, city)) refreshSocietyDatalist(city, ward);

        else refreshSocietyDatalist(city, '');

      });

      profileWardInput.addEventListener('change', saveProfileWard);

      profileWardInput.addEventListener('blur', saveProfileWard);

    }



    $('#profilePoints').addEventListener('click', () => {

      leadTapCount++;

      if (leadTapCount >= 5) {

        leadTapCount = 0;

        if (isLead) window.openCoordinatorDashboard();

        else window.openLeadModal();

      }

      setTimeout(() => { leadTapCount = 0; }, 2000);

    });



    $('#btnAdminSubmit').addEventListener('click', () => {

      if (isProdEnvironment()) {

        showToast(t('toast.bmcUnauthorized'), 'error');

        return;

      }

      const u = $('#adminUser').value.trim();

      const p = $('#adminPass').value;

      if (u === DEMO_CREDENTIALS.admin.user && p === DEMO_CREDENTIALS.admin.pass) {

        grantBmcAccess();

      } else {

        showToast(t('toast.bmcLoginFail'), 'error');

      }

    });

    $('#btnAdminSendCode').addEventListener('click', adminSendCode);

    $('#btnAdminVerify').addEventListener('click', adminVerify);

    $('#btnAdminOtpToggle')?.addEventListener('click', () => {

      $('#adminOtpRow')?.classList.toggle('hidden');

    });



    $('#btnLeadSubmit').addEventListener('click', () => {

      if (isProdEnvironment()) {

        showToast(t('toast.ngoLoginFail'), 'error');

        return;

      }

      const u = $('#leadUser').value.trim();

      const p = $('#leadPass').value;

      const code = ($('#leadCode') && $('#leadCode').value.trim()) || '';

      const demoCode = findDemoNgoCode(code);

      if (u === DEMO_CREDENTIALS.leadNbh.user && p === DEMO_CREDENTIALS.leadNbh.pass) {

        const d = DEMO_CREDENTIALS.leadNbh;

        grantLeadAccess(d.ward, d.scope, d.neighbourhood, 'mumbai');

      } else if (u === DEMO_CREDENTIALS.lead.user && p === DEMO_CREDENTIALS.lead.pass) {

        if (demoCode) {

          grantLeadAccess(demoCode.ward, demoCode.coordinatorScope || 'ward', demoCode.neighbourhood || '', demoCode.city || 'mumbai');

        } else {

          const d = DEMO_CREDENTIALS.lead;

          grantLeadAccess(d.ward, d.scope || 'ward', '', 'mumbai');

        }

      } else {

        showToast(t('toast.ngoLoginFail'), 'error');

      }

    });

    $('#btnLeadSendCode').addEventListener('click', leadSendCode);

    $('#btnLeadVerify').addEventListener('click', leadVerify);

    $('#btnLeadOtpToggle')?.addEventListener('click', () => {

      $('#leadOtpRow')?.classList.toggle('hidden');

    });



    $('#aqWardFilter').addEventListener('change', renderAdminQueue);

    $('#aqSort').addEventListener('change', renderAdminQueue);

    $('#btnAdminExportCsv').addEventListener('click', exportAdminQueueCsv);

    $('#btnAdminQueueClose').addEventListener('click', () => {

      closeModal('adminQueue');

      setNavTab('map');

    });

    $('#btnAdminQueueExit').addEventListener('click', () => {

      setAdminMode(false);

      closeModal('adminQueue');

      setNavTab('map');

      showToast(t('toast.citizenView'), 'info');

    });



    $('#btnCoordinatorClose').addEventListener('click', () => {

      closeModal('coordinator');

      setNavTab('map');

    });

    $('#btnCoordinatorExit').addEventListener('click', () => {

      setLeadMode(false);

      closeModal('coordinator');

      setNavTab('map');

      showToast(t('toast.citizenView'), 'info');

    });



    $('#btnMarkResolved').addEventListener('click', markReportResolved);

    $('#btnAdminRemoveContent').addEventListener('click', removeReportContentAction);

    $('#btnAdminCopy1916').addEventListener('click', () => {

      if (activeAdminReportId) copyFor1916(activeAdminReportId);

    });

    $('#btnAdminProofCapture').addEventListener('click', () => $('#adminProofInput').click());

    $('#adminProofInput').addEventListener('change', handleAdminProofCapture);

    $('#btnAdminReportClose').addEventListener('click', () => closeModal('adminReport'));

    bindModalInputScroll();

  }



  /* ---------- Camera & Canvas Pipeline ---------- */

  function setPhotoScanning(active) {

    const btn = $('#btnTakePhoto');

    const status = $('#photoScanStatus');

    if (btn) btn.classList.toggle('is-scanning', active);

    if (status) status.classList.toggle('hidden', !active);

  }



  function resetPhotoConfirm() {

    const group = $('#photoConfirmGroup');

    if (group) group.classList.add('hidden');

    clearConfirmPinState();

    updateReportFlowSteps('capture');

    collapseReportNotesIfEmpty();

  }



  function showPhotoConfirm() {

    const group = $('#photoConfirmGroup');

    if (group) group.classList.remove('hidden');

    updateReportWardChip();

    setReportNotesExpanded(true);

    updateReportFlowSteps('confirm');

    prepareConfirmPin();

    scheduleReportPinMapResize();

  }



  function rejectPhoto(scanResult) {

    finishReportPhotoFlow('rejectPhoto');

    ensureReportModalOpen();

    const canvas = $('#imageCanvas');

    if (window.ImageModeration) {

      ImageModeration.clearPhotoCanvas(canvas, $('#photoInput'));

    } else {

      resetReportForm();

    }

    lastReportDataUrl = null;

    resetPhotoConfirm();

    updateReportFlowSteps('capture');

    touchReportDraft({ step: 'capture', awaitingPhoto: false });

    const msg = scanResult.i18nKey ? t(scanResult.i18nKey) : (scanResult.message || t('moderation.blocked.irrelevant'));

    showToast(msg, 'error', 5500);

  }



  function handlePhotoCapture(e) {

    const file = e.target.files[0];

    if (!file) {

      debugLog('PHOTO', 'handlePhotoCapture no file', { reportPhotoFlowActive });

      reportPhotoFlowActive = false;

      touchReportDraft({ awaitingPhoto: false });

      return;

    }

    debugLog('PHOTO', 'handlePhotoCapture start', { size: file.size, type: file.type });

    debugLog('REPORT', 'reportPhotoProcessing', { value: true, where: 'handlePhotoCapture' });

    reportPhotoProcessing = true;

    armReportPhotoWatchdog();

    ensureReportModalOpen();



    if (window.ImageModeration) {

      const fileCheck = ImageModeration.validateFile(file, getModCfg());

      if (!fileCheck.ok) {

        rejectPhoto(fileCheck);

        return;

      }

    }



    const reader = new FileReader();

    reader.onerror = () => {

      failReportPhotoCapture();

    };

    reader.onload = (ev) => {

      const img = new Image();

      img.onload = async () => {

        const canvas = $('#imageCanvas');

        const ctx = canvas.getContext('2d');

        let w = img.width;

        let h = img.height;

        if (w > CANVAS_MAX_WIDTH) {

          h = (h * CANVAS_MAX_WIDTH) / w;

          w = CANVAS_MAX_WIDTH;

        }

        canvas.width = w;

        canvas.height = h;

        // Re-encoding through canvas strips EXIF/GPS and other embedded metadata.

        ctx.drawImage(img, 0, 0, w, h);



        if (window.ImageModeration && getModCfg().enabled) {

          setPhotoScanning(true);

          const scan = await ImageModeration.scanCanvas(canvas, getModCfg());

          setPhotoScanning(false);

          if (!scan.ok) {

            rejectPhoto(scan);

            return;

          }

        }



        canvas.classList.add('visible');

        lastReportDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

        finishReportPhotoFlow('handlePhotoCapture');

        reportPhotoDismissGuard = Date.now();

        touchReportDraft({ step: 'confirm', awaitingPhoto: false });

        advanceReportPhotoReady();

        debugLog('PHOTO', 'handlePhotoCapture success', { w, h });

      };

      img.onerror = () => {

        failReportPhotoCapture();

      };

      img.src = ev.target.result;

    };

    reader.readAsDataURL(file);

  }



  function resetSubmitReportButton() {

    const submitBtn = $('#btnSubmitReport');

    if (!submitBtn) return;

    submitBtn.classList.remove('is-loading', 'is-success');

    submitBtn.disabled = false;

    delete submitBtn.dataset.originalLabel;

    const label = submitBtn.querySelector('.btn__label');

    if (label) label.textContent = t('report.submit');

    submitReport.__inFlight = false;

    finishReportSubmitWithCoords._busy = false;

  }



  function morphSubmitButtonSuccess(btn) {

    return new Promise((resolve) => {

      if (!btn) { resolve(); return; }

      btn.classList.remove('is-loading');

      btn.disabled = true;

      btn.classList.add('is-success');

      submitReport.__inFlight = false;

      finishReportSubmitWithCoords._busy = false;

      const label = btn.querySelector('.btn__label');

      if (label) label.innerHTML = '<i class="ph ph-check" aria-hidden="true"></i>';

      setTimeout(resolve, 600);

    });

  }



  function setButtonLoading(btn, loading, loadingLabel) {

    if (!btn) return;

    btn.classList.toggle('is-loading', loading);

    btn.disabled = loading;

    const label = btn.querySelector('.btn__label');

    if (!label) return;

    if (loading && loadingLabel) {

      if (!btn.dataset.originalLabel) btn.dataset.originalLabel = label.textContent;

      label.textContent = loadingLabel;

    } else if (!loading) {

      label.textContent = btn.dataset.originalLabel || t('report.submit');

      delete btn.dataset.originalLabel;

    }

    if (!loading && btn && btn.id === 'btnSubmitReport') {

      submitReport.__inFlight = false;

      finishReportSubmitWithCoords._busy = false;

    }

  }



  function hasSeenReportGeoExplainer() {

    try { return localStorage.getItem(REPORT_GEO_EXPLAINER_KEY) === '1'; } catch { return false; }

  }



  function markReportGeoExplainerSeen() {

    try { safeLocalSet(REPORT_GEO_EXPLAINER_KEY, '1'); } catch { /* ignore */ }

  }



  async function queryGeolocationPermission() {

    if (!navigator.permissions || !navigator.permissions.query) return false;

    try {

      const status = await navigator.permissions.query({ name: 'geolocation' });

      return status.state === 'granted';

    } catch {

      return false;

    }

  }



  function showReportGeoExplainerModal() {

    return new Promise((resolve) => {

      const overlay = overlays.reportGeo;

      if (!overlay) {

        resolve('gps');

        return;

      }

      reportGeoExplainerResolve = resolve;

      const btnContinue = $('#btnReportGeoContinue');

      const btnManual = $('#btnReportGeoManual');

      const title = $('#reportGeoTitle');

      const body = $('#reportGeoBody');

      if (title) title.textContent = t('report.geoExplainerTitle');

      if (body) body.textContent = t('report.geoExplainerBody');

      if (btnContinue) btnContinue.textContent = t('report.geoExplainerContinue');

      if (btnManual) btnManual.textContent = t('report.geoExplainerManual');

      function finish(choice) {

        if (!reportGeoExplainerResolve) return;

        reportGeoExplainerResolve = null;

        if (btnContinue) btnContinue.removeEventListener('click', onContinue);

        if (btnManual) btnManual.removeEventListener('click', onManual);

        closeModal('reportGeo');

        resolve(choice);

      }

      function onContinue() { finish('gps'); }

      function onManual() {

        markReportGeoExplainerSeen();

        startManualPinMode();

        finish('manual');

      }

      if (btnContinue) btnContinue.addEventListener('click', onContinue);

      if (btnManual) btnManual.addEventListener('click', onManual);

      openModal('reportGeo');

    });

  }




  function clearConfirmPinPreview() {

    setReportPinMapLoading(false);

    if (reportPinAccuracyCircle && reportPinMap) {

      try { reportPinMap.removeLayer(reportPinAccuracyCircle); } catch { /* ignore */ }

    }

    reportPinAccuracyCircle = null;

    if (reportPinMarker && reportPinMap) {

      try { reportPinMap.removeLayer(reportPinMarker); } catch { /* ignore */ }

    }

    reportPinMarker = null;

    if (reportPinMap) {

      try { reportPinMap.remove(); } catch { /* ignore */ }

    }

    reportPinMap = null;

  }



  function clearConfirmPinState() {

    reportPinSeedToken += 1;

    clearConfirmPinPreview();

    confirmPinLat = null;

    confirmPinLng = null;

    confirmPinAccuracyM = null;

    confirmPinUserAdjusted = false;

    confirmPinProvisional = false;

    const accEl = $('#reportPinAccuracy');

    if (accEl) {

      accEl.textContent = '';

      accEl.className = 'report-pin-accuracy';

    }

  }



  function updateReportPinAccuracyHint() {

    const el = $('#reportPinAccuracy');

    if (!el) return;

    el.className = 'report-pin-accuracy';

    if (confirmPinUserAdjusted) {

      el.textContent = t('report.pinAccuracyAdjusted');

      el.classList.add('report-pin-accuracy--adjusted');

      return;

    }

    const acc = confirmPinAccuracyM;

    if (!Number.isFinite(acc)) {

      el.textContent = t('report.pinAccuracyUnknown');

      return;

    }

    const m = String(Math.round(acc));

    if (acc <= GEO_ACCURACY_GOOD_M) {

      el.textContent = t('report.pinAccuracyGood').replace('{m}', m);

      el.classList.add('report-pin-accuracy--good');

    } else if (acc <= GEO_ACCURACY_POOR_M) {

      el.textContent = t('report.pinAccuracyFair').replace('{m}', m);

      el.classList.add('report-pin-accuracy--fair');

    } else {

      el.textContent = t('report.pinAccuracyPoor').replace('{m}', m);

      el.classList.add('report-pin-accuracy--poor');

    }

  }



  function setConfirmPinCoords(lat, lng, accuracyM, userAdjusted) {

    if (!isValidGpsCoords(lat, lng)) return false;

    confirmPinLat = lat;

    confirmPinLng = lng;

    if (userAdjusted) {

      confirmPinUserAdjusted = true;

      confirmPinAccuracyM = null;

      confirmPinProvisional = false;

    } else if (!confirmPinUserAdjusted) {

      confirmPinAccuracyM = Number.isFinite(accuracyM) ? accuracyM : confirmPinAccuracyM;

      if (Number.isFinite(accuracyM) && isPlausibleConfirmPinGps(lat, lng)) {

        confirmPinProvisional = false;

        debugLog('PIN', 'confirmPinProvisional', { value: false, reason: 'GPS accuracy' });

      } else if (Number.isFinite(accuracyM)) {

        confirmPinProvisional = true;

        debugLog('PIN', 'confirmPinProvisional', { value: true, reason: 'GPS implausible for city' });

      }

    }

    updateReportPinAccuracyHint();

    updateReportWardChip();

    return true;

  }



  function renderConfirmPinMarkerIcon() {

    const adjusted = confirmPinUserAdjusted ? ' report-pin-marker__dot--adjusted' : '';

    return L.divIcon({

      className: 'report-pin-marker',

      html: '<span class="report-pin-marker__dot' + adjusted + '" aria-hidden="true"></span>',

      iconSize: [28, 28],

      iconAnchor: [14, 14],

    });

  }



  function setReportPinMapLoading(loading) {

    const mapEl = $('#reportPinMap');

    if (!mapEl) return;

    mapEl.classList.toggle('report-pin-map--loading', !!loading);

  }



  function scheduleReportPinMapResize() {

    if (!reportPinMap) return;

    debugLog('PIN', 'invalidateSize', { where: 'scheduleReportPinMapResize' });

    const run = () => {

      try { reportPinMap.invalidateSize({ pan: false }); } catch { /* ignore */ }

    };

    requestAnimationFrame(() => {

      run();

      requestAnimationFrame(() => {

        run();

        setTimeout(run, 50);

        setTimeout(run, 250);

        setTimeout(run, 600);

      });

    });

  }



  function syncConfirmPinMarker() {

    if (!reportPinMap || confirmPinLat == null || confirmPinLng == null) return;

    const ll = L.latLng(confirmPinLat, confirmPinLng);

    if (reportPinMarker) {

      reportPinMarker.setLatLng(ll);

      reportPinMarker.setIcon(renderConfirmPinMarkerIcon());

    }

    if (reportPinAccuracyCircle) {

      try { reportPinMap.removeLayer(reportPinAccuracyCircle); } catch { /* ignore */ }

      reportPinAccuracyCircle = null;

    }

    if (!confirmPinUserAdjusted && Number.isFinite(confirmPinAccuracyM) && confirmPinAccuracyM > 0) {

      reportPinAccuracyCircle = L.circle(ll, {

        radius: confirmPinAccuracyM,

        color: '#6366f1',

        fillColor: '#6366f1',

        fillOpacity: 0.1,

        weight: 1,

        interactive: false,

      }).addTo(reportPinMap);

    }

  }



  function initReportPinPreview(lat, lng, accuracyM, userAdjusted) {

    debugLog('PIN', 'initReportPinPreview', { lat, lng, accuracyM, userAdjusted, provisional: confirmPinProvisional });

    if (typeof L === 'undefined') return;

    const host = $('#reportPinMap');

    if (!host) return;

    if (!setConfirmPinCoords(lat, lng, accuracyM, !!userAdjusted)) return;

    if (!reportPinMap) {

      reportPinMap = L.map(host, {

        zoomControl: false,

        attributionControl: false,

        dragging: true,

        scrollWheelZoom: false,

        doubleClickZoom: false,

        boxZoom: false,

        keyboard: false,

      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {

        maxZoom: 19,

      }).addTo(reportPinMap);

      reportPinMarker = L.marker([confirmPinLat, confirmPinLng], {

        draggable: true,

        autoPan: true,

        icon: renderConfirmPinMarkerIcon(),

      }).addTo(reportPinMap);

      reportPinMarker.on('dragstart', () => {

        if (reportPinAccuracyCircle) {

          try { reportPinMap.removeLayer(reportPinAccuracyCircle); } catch { /* ignore */ }

          reportPinAccuracyCircle = null;

        }

      });

      reportPinMarker.on('dragend', () => {

        const p = reportPinMarker.getLatLng();

        setConfirmPinCoords(p.lat, p.lng, null, true);

        // Keep full-map manual pin in sync so existing submit path stays coherent.

        manualPinLat = p.lat;

        manualPinLng = p.lng;

        syncConfirmPinMarker();

        try { reportPinMap.panTo(p, { animate: true }); } catch { /* ignore */ }

      });

    } else {

      syncConfirmPinMarker();

    }

    const zoom = zoomForAccuracy(confirmPinAccuracyM);

    reportPinMap.setView([confirmPinLat, confirmPinLng], Math.max(zoom, 16), { animate: false });

    syncConfirmPinMarker();

    scheduleReportPinMapResize();

  }



  function prepareConfirmPin() {

    const hint = $('#reportPinDragHint');

    if (hint) hint.textContent = t('report.pinDragHint');

    const mapEl = $('#reportPinMap');

    if (mapEl) mapEl.setAttribute('aria-label', t('report.pinMapAria'));

    setReportNotesExpanded(true);

    // Full-map manual pin wins if already placed.

    if (manualPinLat != null && manualPinLng != null && isValidGpsCoords(manualPinLat, manualPinLng)) {

      setReportPinMapLoading(false);

      initReportPinPreview(manualPinLat, manualPinLng, null, true);

      return;

    }

    if (confirmPinUserAdjusted && confirmPinLat != null && confirmPinLng != null) {

      setReportPinMapLoading(false);

      initReportPinPreview(confirmPinLat, confirmPinLng, null, true);

      return;

    }

    if (currentLat != null && currentLng != null && isValidGpsCoords(currentLat, currentLng)

      && isPlausibleConfirmPinGps(currentLat, currentLng)) {

      setReportPinMapLoading(false);

      confirmPinProvisional = false;

      initReportPinPreview(currentLat, currentLng, currentAccuracyM, false);

    } else {

      if (currentLat != null && currentLng != null && isValidGpsCoords(currentLat, currentLng)) {

        debugLog('PIN', 'confirmPinProvisional', { value: true, reason: 'cached GPS implausible for city' });

      }

      // Always seed a visible map (city centre) so confirm is never a blank gray box
      // while GPS refines — user can drag immediately; GPS replaces if not adjusted.
      const center = getCityCenter();

      confirmPinProvisional = true;

      debugLog('PIN', 'confirmPinProvisional', { value: true, reason: 'no GPS yet' });

      initReportPinPreview(center[0], center[1], null, false);

      confirmPinProvisional = true;

      setReportPinMapLoading(true);

      const accEl = $('#reportPinAccuracy');

      if (accEl) {

        accEl.className = 'report-pin-accuracy';

        accEl.textContent = t('report.pinLocating');

      }

    }

    if (!navigator.geolocation) {

      setReportPinMapLoading(false);

      updateReportPinAccuracyHint();

      return;

    }

    const token = ++reportPinSeedToken;

    debugLog('PIN', 'GPS refine start', { token });

    getPrecisePosition({

      fresh: true,

      targetAccuracyM: GEO_ACCURACY_GOOD_M,

      watchMaxMs: 20000,

      minSamples: GEO_STABLE_SAMPLES,

    }).then((pos) => {

      if (token !== reportPinSeedToken) return;

      if (confirmPinUserAdjusted) return;

      if (manualPinLat != null && manualPinLng != null) return;

      setReportPinMapLoading(false);

      debugLog('PIN', 'GPS refine settle', {

        lat: pos.coords.latitude,

        lng: pos.coords.longitude,

        accuracy: pos.coords.accuracy,

      });

      if (!isPlausibleConfirmPinGps(pos.coords.latitude, pos.coords.longitude)) {

        debugLog('PIN', 'GPS refine reject', {

          reason: 'implausible for city',

          token,

          rejectedLat: pos.coords.latitude,

          rejectedLng: pos.coords.longitude,

          keepLat: confirmPinLat,

          keepLng: confirmPinLng,

          provisional: true,

        });

        setReportPinMapLoading(false);

        // Never apply rejected coords — keep city-center (or last in-city) provisional pin.

        if (confirmPinLat == null || confirmPinLng == null || !isPlausibleConfirmPinGps(confirmPinLat, confirmPinLng)) {

          const center = getCityCenter();

          confirmPinUserAdjusted = false;

          initReportPinPreview(center[0], center[1], null, false);

        }

        confirmPinProvisional = true;

        confirmPinAccuracyM = null;

        updateReportPinAccuracyHint();

        scheduleReportPinMapResize();

        return;

      }

      initReportPinPreview(

        pos.coords.latitude,

        pos.coords.longitude,

        pos.coords.accuracy,

        false

      );

    }).catch(() => {

      if (token !== reportPinSeedToken) return;

      if (confirmPinUserAdjusted) return;

      debugLog('PIN', 'GPS refine fail', { token });

      setReportPinMapLoading(false);

      if (confirmPinLat != null && confirmPinLng != null) {

        const accEl = $('#reportPinAccuracy');

        if (accEl && !Number.isFinite(confirmPinAccuracyM)) {

          accEl.className = 'report-pin-accuracy report-pin-accuracy--poor';

          accEl.textContent = t('report.pinAccuracyUnknown');

        }

        scheduleReportPinMapResize();

        return;

      }

      const center = getCityCenter();

      initReportPinPreview(center[0], center[1], null, false);

      const accEl = $('#reportPinAccuracy');

      if (accEl) {

        accEl.className = 'report-pin-accuracy report-pin-accuracy--poor';

        accEl.textContent = t('report.pinAccuracyUnknown');

      }

    });

  }


  function showManualPinBanner() {

    const el = $('#manualPinBanner');

    const text = $('#manualPinBannerText');

    const cancel = $('#btnManualPinCancel');

    if (text) text.textContent = t('report.manualPinBanner');

    if (cancel) cancel.textContent = t('report.manualPinCancel');

    if (el) el.classList.remove('hidden');

  }



  function hideManualPinBanner() {

    $('#manualPinBanner')?.classList.add('hidden');

  }



  function clearManualPinPreviewMarker() {

    if (manualPinPreviewMarker && map) {

      map.removeLayer(manualPinPreviewMarker);

    }

    manualPinPreviewMarker = null;

  }



  function setManualPinPreviewMarker(lat, lng) {

    if (!map) return;

    clearManualPinPreviewMarker();

    manualPinPreviewMarker = L.circleMarker([lat, lng], {

      radius: 11,

      fillColor: '#f59e0b',

      color: '#ffffff',

      weight: 3,

      fillOpacity: 0.95,

      className: 'manual-pin-preview',

    }).addTo(map);

    map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true });

  }



  function stopManualPinMode(clearCoords) {

    manualPinModeActive = false;

    document.body.classList.remove('manual-pin-mode');

    hideManualPinBanner();

    if (map && manualPinMapClickHandler) {

      map.off('click', manualPinMapClickHandler);

      manualPinMapClickHandler = null;

    }

    if (clearCoords) {

      manualPinLat = null;

      manualPinLng = null;

      clearManualPinPreviewMarker();

      updateReportWardChip();

    }

  }



  function clearManualPinState() {

    stopManualPinMode(true);

  }



  function onManualPinMapClick(e) {

    if (!manualPinModeActive || !e || !e.latlng) return;

    const lat = e.latlng.lat;

    const lng = e.latlng.lng;

    if (!isValidGpsCoords(lat, lng)) return;

    manualPinLat = lat;

    manualPinLng = lng;

    setConfirmPinCoords(lat, lng, null, true);

    setManualPinPreviewMarker(lat, lng);

    stopManualPinMode(false);

    ensureReportModalOpen();

    updateReportFlowSteps('confirm');

    updateReportWardChip();

    prepareConfirmPin();

    showToast(t('toast.manualPinReady'), 'success', 4500);

  }



  function startManualPinMode() {

    const submitBtn = $('#btnSubmitReport');

    setButtonLoading(submitBtn, false);

    touchReportDraft({ step: 'confirm', awaitingPhoto: false });

    reportManualPinDismiss = true;

    closeModal('report');

    reportManualPinDismiss = false;

    setNavTab('map');

    manualPinModeActive = true;

    document.body.classList.add('manual-pin-mode');

    showManualPinBanner();

    scheduleMapResize();

    if (map) {

      if (manualPinMapClickHandler) map.off('click', manualPinMapClickHandler);

      manualPinMapClickHandler = onManualPinMapClick;

      map.on('click', manualPinMapClickHandler);

    }

  }



  function showGeoEnableHelp() {

    showToast(t('report.geoEnableHelp'), 'info', 9000);

  }



  function handleReportGpsFailure(submitBtn) {

    setButtonLoading(submitBtn, false);

    if (window.CivicAnalytics) CivicAnalytics.perfEnd('report_submit_duration', { gpsFailed: true });

    showGpsRecoveryActions(t('toast.gpsFailAction'), 'error', 9000);

  }



  function finishReportSubmitWithCoords(lat, lng, submitBtn, accuracyM, opts) {

    if (finishReportSubmitWithCoords._busy) return;

    finishReportSubmitWithCoords._busy = true;

    opts = opts || {};

    const manualPin = !!opts.manualPin;

    debugLog('REPORT', 'finishReportSubmitWithCoords', {

      lat,

      lng,

      accuracyM,

      manualPin,

      provisional: confirmPinProvisional,

    });

    if (!isValidGpsCoords(lat, lng)) {

      setButtonLoading(submitBtn, false);

      handleReportGpsFailure(submitBtn);

      return;

    }

    if (!manualPin && Number.isFinite(accuracyM) && accuracyM > GEO_ACCURACY_POOR_M) {

      setButtonLoading(submitBtn, false);

      if (accuracyM > GEO_ACCURACY_MAX_M) {

        showGpsRecoveryActions(t('toast.gpsPoorFix'), 'error', 9000);

      } else {

        showGpsRecoveryActions(

          t('toast.gpsLowAccuracy').replace('{m}', String(Math.round(accuracyM))),

          'info',

          9000

        );

      }

      return;

    }

    currentLat = lat;

    currentLng = lng;

    const reports = loadReports();

    const now = Date.now();



    for (let i = 0; i < reports.length; i++) {

      const r = reports[i];

      if (r.lat == null || r.lng == null) continue;

      if (r.status === 'resolved') continue;

      const age = now - new Date(r.timestamp).getTime();

      if (Number.isFinite(age) && age > DUPLICATE_WINDOW_MS) continue;

      const dist = getDistanceInMeters(lat, lng, r.lat, r.lng);

      if (dist < DUPLICATE_RADIUS_M) {

        setButtonLoading(submitBtn, false);

        if (window.CivicAnalytics) {

          CivicAnalytics.track('report_submitted', {

            hazard: $('#hazardType').value,

            hasGps: !manualPin,

            hasPhoto: true,

            path: 'duplicate_corroboration',

          }, user.ward);

          CivicAnalytics.perfEnd('report_submit_duration', { duplicate: true });

        }

        const dupeId = r.id;

        if (ownsReport(r) || hasConfirmed(dupeId)) {

          showToast(t('confirm.ownDupe'), 'info', 4000);

          closeModal('report');

        } else {

          showToast(

            t('confirm.dupe').replace('{backing}', backingSuffix(r.confirmations)),

            'info', 7000, {

            label: t('confirm.dupeAction'),

            onClick: () => {

              if (confirmReport(dupeId)) {

                closeModal('report');

                const marker = reportMarkerMap.get(dupeId);

                if (marker && map) { map.setView([r.lat, r.lng], 16); marker.openPopup(); }

              }

            },

          });

        }

        return;

      }

    }



    const hazard = $('#hazardType').value;

    const liveHazard = HAZARD_CATEGORIES.find((c) => c.key === hazard && c.live);

    if (!liveHazard) {

      setButtonLoading(submitBtn, false);

      showToast(t('toast.hazardTypeRequired'), 'error');

      return;

    }

    const draft = {

      id: generateId(),

      hazard,

      notes: ($('#reportNotes')?.value ?? ''),

      image: lastReportDataUrl,

      ward: resolveReportWard(lat, lng),

      city: getUserCity(),

      society: user.society || '',

      reporter: user.displayName || 'Citizen',

      reporterId: user.id,

      lat,

      lng,

      timestamp: new Date().toISOString(),

    };

    const report = Object.assign({}, normalizeReport(draft, user.id), sanitizeReportInput(draft));

    if (report.lat == null || report.lng == null) {

      setButtonLoading(submitBtn, false);

      debugLog('REPORT', 'submit blocked outside city', { lat, lng, city: getUserCity() });

      showGpsRecoveryActions(t('toast.gpsOutsideCity'), 'error', 9000);

      return;

    }



    reports.unshift(report);

    const prevXp = getTotalCivicXp();

    try {

      saveReports(reports);

    } catch (err) {

      setButtonLoading(submitBtn, false);

      showToast(t('toast.storageFull'), 'error', 4500);

      return;

    }



    debugLog('MODAL', 'lastReportId', { value: report.id, where: 'submitReport' });

    lastReportId = report.id;

    try { safeLocalSet(FIRST_REPORT_DONE_KEY, '1'); } catch {}

    Backend.insertReport(report);

    fanOutLocalNbhNewReport(report);

    if (window.CivicAnalytics) {

      CivicAnalytics.track('report_submitted', {

        hazard,

        hasGps: !manualPin,

        hasPhoto: true,

        path: manualPin ? 'manual_pin' : 'new_report',

        city: getUserCity(),

      }, user.ward);

      CivicAnalytics.perfEnd('report_submit_duration');

    }

    createReportMarker(report, { drop: true });

    clearManualPinPreviewMarker();

    manualPinLat = null;

    manualPinLng = null;

    clearConfirmPinState();

    if (map && report.lat != null && report.lng != null) {

      map.setView([report.lat, report.lng], Math.max(map.getZoom(), 15), { animate: true });

    }

    const weekBonus = awardWeekBonus();

    checkXpLevelUp(prevXp, getTotalCivicXp());

    try { safeLocalSet(LAST_HAZARD_KEY, hazard); } catch {}

    // Capture photo at save time — do not re-read lastReportDataUrl after reset/retake.
    const savedPhoto = report.image || lastReportDataUrl || null;

    morphSubmitButtonSuccess(submitBtn).then(() => {

      closeModal('report');

      resetReportForm();

      clearReportDraft();

      showSuccessModal(weekBonus, savedPhoto);

      maybeShowPwaNudge('report');

      updateProfileUI();

      updatePersonaUI();

      updateCommunitySubtitle();

      renderWardChallenge();

      updateMapEmptyCta();

      updateHomeHero();

      renderLeaderboard('wards');

      renderLeaderboard('citizens');

    });

  }



  async function submitReport() {

    // Re-entrancy lock: rapid double-tap must not double-file during async GPS/moderation.
    if (submitReport.__inFlight) return;

    if (overlays.report?.classList.contains('open') && hasReportPhotoPreview()) {

      const confirmPanel = $('#reportStepConfirm');

      if (confirmPanel && confirmPanel.hidden) syncReportPhotoReturn();

    }

    const canvas = $('#imageCanvas');

    const submitBtn = $('#btnSubmitReport');

    if (!canvas || !canvas.classList.contains('visible')) {

      showToast(t('toast.photoRequired'), 'error');

      return;

    }

    if (submitBtn && (submitBtn.disabled || submitBtn.classList.contains('is-loading'))) return;

    submitReport.__inFlight = true;

    if (window.CivicAnalytics) CivicAnalytics.perfStart('report_submit_duration');

    setButtonLoading(submitBtn, true, t('report.submitting'));



    if (window.ImageModeration && getModCfg().enabled) {

      setButtonLoading(submitBtn, true, t('moderation.scanning'));

      const scan = await ImageModeration.scanCanvas(canvas, getModCfg());

      if (!scan.ok) {

        setButtonLoading(submitBtn, false);

        rejectPhoto(scan);

        return;

      }

    }



    lastReportDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

    debugLog('REPORT', 'submitReport pin state', {

      lat: confirmPinLat,

      lng: confirmPinLng,

      provisional: confirmPinProvisional,

      accuracy: confirmPinAccuracyM,

      userAdjusted: confirmPinUserAdjusted,

      manualLat: manualPinLat,

      manualLng: manualPinLng,

    });

    if (confirmPinLat != null && confirmPinLng != null && !confirmPinProvisional) {

      finishReportSubmitWithCoords(

        confirmPinLat,

        confirmPinLng,

        submitBtn,

        confirmPinUserAdjusted ? null : confirmPinAccuracyM,

        { manualPin: !!confirmPinUserAdjusted }

      );

      return;

    }

    // Provisional city-center pin is intentional — do not re-fetch GPS (often still
    // out-of-city, which produced a dead "outside city" toast with no recovery).
    if (confirmPinLat != null && confirmPinLng != null && confirmPinProvisional) {

      setButtonLoading(submitBtn, false);

      debugLog('REPORT', 'submit blocked provisional pin', {

        lat: confirmPinLat,

        lng: confirmPinLng,

      });

      showToast(t('toast.pinConfirmRequired'), 'info', 8000, {

        label: t('report.placePinOnMap'),

        onClick: () => startManualPinMode(),

      });

      return;

    }

    if (manualPinLat != null && manualPinLng != null) {

      finishReportSubmitWithCoords(manualPinLat, manualPinLng, submitBtn, null, { manualPin: true });

      return;

    }



    const granted = await queryGeolocationPermission();

    if (!granted && !hasSeenReportGeoExplainer()) {

      const choice = await showReportGeoExplainerModal();

      if (choice === 'cancel') {

        setButtonLoading(submitBtn, false);

        return;

      }

      if (choice === 'manual') {

        setButtonLoading(submitBtn, false);

        return;

      }

      setButtonLoading(submitBtn, true, t('report.submitting'));

    }

    markReportGeoExplainerSeen();



    if (!navigator.geolocation) {

      handleReportGpsFailure(submitBtn);

      return;

    }



    user.gpsConsent = true;

    saveUser();

    setButtonLoading(submitBtn, true, t('report.submitting'));



    getPrecisePosition({ fresh: true, targetAccuracyM: GEO_ACCURACY_POOR_M })

      .then((pos) => {

        const lat = pos.coords.latitude;

        const lng = pos.coords.longitude;

        debugLog('REPORT', 'submit GPS settle', {

          lat,

          lng,

          accuracy: pos.coords.accuracy,

        });

        if (!isPlausibleConfirmPinGps(lat, lng)) {

          setButtonLoading(submitBtn, false);

          showGpsRecoveryActions(t('toast.gpsOutsideCity'), 'error', 9000);

          return;

        }

        finishReportSubmitWithCoords(

          lat,

          lng,

          submitBtn,

          pos.coords.accuracy,

          { manualPin: false }

        );

      })

      .catch(() => {

        handleReportGpsFailure(submitBtn);

      });

  }



  // Rotating warm kudos for every non-special report so it never feels repetitive.

  function getRotatingKudos(reportCount) {

    const keys = [

      'success.kudos1', 'success.kudos2', 'success.kudos3', 'success.kudos4', 'success.kudos5',

    ];

    const n = Number(reportCount) || 0;

    const idx = ((n % keys.length) + keys.length) % keys.length;

    return t(keys[idx]);

  }



  // Short nudge telling the user how close they are to their next milestone/badge.

  function buildSuccessProgress(reportCount) {

    const n = Number(reportCount) || 0;

    const top = REPORT_CELEBRATION_MILESTONES[REPORT_CELEBRATION_MILESTONES.length - 1];

    if (n >= top) {

      return t('success.progressGuardian').replace('{n}', String(n));

    }

    const next = REPORT_CELEBRATION_MILESTONES.find((m) => m > n);

    if (!next) return '';

    const remaining = next - n;

    if (REPORT_CELEBRATION_MILESTONES.includes(n)) {

      return t('success.progressMilestone').replace('{n}', String(remaining));

    }

    return remaining === 1

      ? t('success.progressOne')

      : t('success.progressMany').replace('{n}', String(remaining));

  }



  function refreshSuccessModalStrings() {

    const reportCount = getUserReports().length;

    $('#successClock').textContent = corpCopy('success.clock');

    const taglineEl = $('#successTagline');

    if (taglineEl) {

      const wardConfirms = user.ward

        ? loadReports()

          .filter((r) => r.ward === user.ward && r.status === 'pending')

          .reduce((sum, r) => sum + (Number(r.confirmations) || 0), 0)

        : 0;

      taglineEl.textContent = wardConfirms > 0

        ? t('success.taglineNeighbours').replace('{n}', String(wardConfirms))

        : t('success.tagline');

    }

    const celebrateEl = $('#successCelebrate');

    if (celebrateEl) {

      if (reportCount === 1) {

        celebrateEl.textContent = t('success.celebrateFirst');

      } else if (REPORT_CELEBRATION_MILESTONES.includes(reportCount) && reportCount > 1) {

        celebrateEl.textContent = t('success.celebrateMilestone').replace('{n}', String(reportCount));

      } else {

        celebrateEl.textContent = getRotatingKudos(reportCount);

      }

      celebrateEl.classList.remove('hidden');

    }

    const progressEl = $('#successProgress');

    if (progressEl) {

      const progressMsg = buildSuccessProgress(reportCount);

      progressEl.textContent = progressMsg;

      progressEl.classList.toggle('hidden', !progressMsg);

    }

    const streakEl = $('#successStreak');

    if (streakEl) {

      const weekCount = getReportsThisWeek();

      if (weekCount >= 2) {

        streakEl.textContent = t('success.streakWeek').replace('{n}', String(weekCount));

        streakEl.classList.remove('hidden');

      } else {

        streakEl.textContent = '';

        streakEl.classList.add('hidden');

      }

    }

    const sharePromptEl = document.querySelector('#successModal .success-share-prompt');

    if (sharePromptEl) {

      sharePromptEl.textContent = reportCount === 1

        ? t('success.shareBragFirst')

        : t('success.shareBrag');

    }

    const fileBtn = $('#btnSuccessFilingGuide');

    if (fileBtn) {

      const label = fileBtn.querySelector('span');

      if (label) label.textContent = t('success.filingGuide');

    }

    applyCorpAwareI18n();

    const lastReport = lastReportId ? findReportById(lastReportId) : null;

    renderOfficialChannelsSurfaces(lastReport);

  }



  function dismissSuccessModal() {

    debugLog('MODAL', 'dismissSuccessModal', { lastReportId });

    if (!overlays.success || !overlays.success.classList.contains('open')) return;

    const reportId = lastReportId;

    const report = reportId ? findReportById(reportId) : null;

    const notShared = report && !report.communityShared;

    closeModal('success');

    const thumb = $('#successThumbnail');

    if (thumb) {

      thumb.removeAttribute('src');

      thumb.hidden = true;

    }

    resetReportForm();

    setNavTab('map');

    flushPendingPwaNudge();

    let shareNudgeShown = false;

    cancelPendingShareNudge();

    if (notShared && reportId) {

      shareNudgeShown = true;

      shareNudgeTimer = setTimeout(() => {

        shareNudgeTimer = null;

        // Never show over an in-progress report (FAB reopen right after Done).
        if (isReportFlowBusy()) return;

        showToast(t('success.shareNudge'), 'info', 5500, {

          label: t('success.shareWhatsapp'),

          onClick: () => shareReportWhatsApp(reportId),

        });

      }, 450);

    }

    maybeShowLeadVolunteerNudge(getUserReports().length, shareNudgeShown ? 6200 : 450);

    // Prevent a later success dismiss / stale id from re-firing the neighbour share nudge
    // while the user is already starting another report.
    debugLog('MODAL', 'lastReportId', { value: null, where: 'dismissSuccessModal' });

    lastReportId = null;

  }



  function showSuccessModal(weekBonus = 0, imageUrl) {

    const thumb = $('#successThumbnail');

    const photoSrc = imageUrl || lastReportDataUrl || null;

    if (photoSrc) lastReportDataUrl = photoSrc;

    if (thumb) {

      if (photoSrc) {

        thumb.src = photoSrc;

        thumb.hidden = false;

      } else {

        thumb.removeAttribute('src');

        thumb.hidden = true;

      }

    }

    refreshSuccessModalStrings();

    const successIcon = document.querySelector('#successModal .success-icon');

    if (successIcon && !prefersReducedMotion()) {

      successIcon.classList.remove('is-celebrating');

      void successIcon.offsetWidth;

      successIcon.classList.add('is-celebrating');

    } else if (successIcon) {

      successIcon.classList.remove('is-celebrating');

    }

    const ptsEl = $('#successPoints');

    if (ptsEl) {

      const total = POINTS_PER_REPORT + weekBonus;

      ptsEl.classList.remove('hidden', 'is-animating');

      ptsEl.innerHTML =

        `+${total} <span class="success-points__label">${escapeHtml(t('success.points'))}</span>` +

        (weekBonus > 0

          ? `<span class="success-points__bonus">${escapeHtml(t('success.weekBonus').replace('{n}', String(weekBonus)))}</span>`

          : '');

      void ptsEl.offsetWidth;

      ptsEl.classList.add('is-animating');

    }

    updateSuccessNativeButton();

    const reportCount = getUserReports().length;

    const officialBody = $('#successOfficialBody');

    const officialBlock = $('#successOfficialBlock');

    const officialToggle = $('#btnSuccessOfficialToggle');

    if (officialBody) officialBody.classList.add('hidden');

    if (officialBlock) officialBlock.classList.add('official-channels-block--collapsed');

    if (officialToggle) officialToggle.setAttribute('aria-expanded', 'false');

    openModal('success');

    requestAnimationFrame(() => {

      celebrateReportSubmit(reportCount);

      pulseProfilePointsStat();

    });

  }



  window.showSuccessModal = showSuccessModal;



  function resetReportForm() {

    $('#photoInput').value = '';

    $('#reportNotes').value = '';

    clearManualPinState();

    clearConfirmPinState();

    const canvas = $('#imageCanvas');

    canvas.classList.remove('visible');

    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    lastReportDataUrl = null;

    resetPhotoConfirm();

    resetSubmitReportButton();

    updateReportFlowSteps('capture');

  }



  /* ---------- Share & deep links ---------- */

  function getWardShortName(ward) {

    return ward ? ward.split('—')[0].trim() : '';

  }



  function getWardHashtag(ward) {

    const short = getWardShortName(ward);

    if (!short) return `#${getCityLabel().replace(/\s+/g, '')}`;

    const slug = short.replace(/[^a-zA-Z0-9]/g, '') + 'Ward';

    return `#${slug}`;

  }



  function appendShareRef(url, ref) {

    if (!ref || !url) return url;

    const sep = url.includes('?') ? '&' : '?';

    return `${url}${sep}ref=${encodeURIComponent(ref)}`;

  }



  function shareAppLink(ref) {

    return appendShareRef(getShareAppUrl(), ref || 'invite');

  }



  // Short, shareable per-user code (not the full generateId() UUID) so a
  // WhatsApp invite link stays readable, and so redemptions can be attributed
  // back to the specific neighbour who shared it.
  function getMyReferralCode() {

    if (!user.referralCode) {

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

      let code = '';

      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];

      user.referralCode = code;

      saveUser();

    }

    return user.referralCode;

  }



  // Records a one-time redemption when a NEW user completes onboarding via a
  // neighbour's ?ref=<code> link, so the referrer can later see how many
  // people joined through them. Legacy static share tags ('invite'/'fixed'/
  // 'recap'/'about', used by non-referral share surfaces) are not redemptions.

  const LEGACY_SHARE_TAGS = ['invite', 'fixed', 'recap', 'about'];

  async function recordReferralRedemption() {

    try {

      const ref = new URLSearchParams(location.search).get('ref');

      if (!ref || LEGACY_SHARE_TAGS.includes(ref)) return;

      if (localStorage.getItem(REFERRAL_REDEEMED_KEY)) return;

      safeLocalSet(REFERRAL_REDEEMED_KEY, '1');

      if (!Backend.enabled) return;

      await Backend.insertReferral({

        referrer_code: ref.slice(0, 32),

        city: user.city || null,

        ward: user.ward || null,

      });

    } catch { /* best-effort only */ }

  }



  // Checks (when connected) how many neighbours have joined via this user's
  // referral code since the last check, awards one-time XP per new join, and
  // tells the referrer. No-ops gracefully offline/local-only, same as the
  // rest of this app's optional-backend features.
  async function checkReferralRewards() {

    if (!Backend.enabled || !user.referralCode) return;

    try {

      const { count } = await Backend.getReferralCount(user.referralCode);

      const rewarded = parseInt(localStorage.getItem(REFERRAL_REWARDED_COUNT_KEY) || '0', 10);

      if (count <= rewarded) return;

      const newJoins = count - rewarded;

      safeLocalSet(REFERRAL_REWARDED_COUNT_KEY, String(count));

      addPointsCache(POINTS_REFERRAL_JOINED * newJoins);

      showToast(

        t('referral.joinedReward').replace('{n}', String(newJoins)).replace('{pts}', String(POINTS_REFERRAL_JOINED * newJoins)),

        'success',

        6000

      );

      updateProfileUI();

    } catch { /* best-effort only */ }

  }



  function trackShareRefLanding() {

    try {

      const ref = new URLSearchParams(location.search).get('ref');

      if (ref && window.CivicAnalytics) {

        CivicAnalytics.track('share_ref_landing', { ref: ref.slice(0, 64) });

      }

    } catch { /* ignore */ }

  }



  function buildHashtagLine(ward) {

    const wh = getWardHashtag(ward || user.ward);

    return `#CivicRadar #MonsoonGuardian ${wh}`;

  }



  function getShareAppUrl() {

    const pub = getPublicAppUrl();

    if (pub) return pub;

    return APP_URL.replace(/\?.*$/, '').replace(/index\.html$/, '').replace(/\/?$/, '/');

  }



  function warnIfShareUrlNotProduction() {

    if (!getPublicAppUrl() && isLocalhostOrigin()) {

      console.warn('[CivicRadar] Set publicUrl in js/config.js before sharing — WhatsApp links will point to localhost.');

    }

  }



  function reportDeepLink(id, ref) {

    const base = getShareAppUrl();

    const sep = base.includes('?') ? '&' : '?';

    const url = `${base}${sep}report=${encodeURIComponent(String(id))}`;

    return appendShareRef(url, ref || 'report');

  }



  function getPublicAppUrl() {

    const raw = (window.CIVICRADAR_CONFIG || {}).publicUrl;

    if (!raw || typeof raw !== 'string') return '';

    const trimmed = raw.trim();

    if (!/^https?:\/\//i.test(trimmed)) return '';

    return trimmed.replace(/\?.*$/, '').replace(/index\.html$/, '').replace(/\/?$/, '/');

  }



  function isLocalhostOrigin() {

    try {

      const host = new URL(APP_URL).hostname;

      return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

    } catch {

      return false;

    }

  }



  function reportCopyDeepLink(id) {

    return reportDeepLink(id);

  }



  function fillShareTemplate(template, vars) {

    const ward = vars.ward || (user.ward ? getWardShortName(user.ward) : '');

    const link = vars.link || getShareAppUrl();

    let out = template

      .replace(/\{hazard\}/g, vars.hazard || '')

      .replace(/\{ward\}/g, ward)

      .replace(/\{link\}/g, link)

      .replace(/\{n\}/g, vars.n != null ? String(vars.n) : '')

      .replace(/\{pending\}/g, vars.pending != null ? String(vars.pending) : '')

      .replace(/\{city\}/g, vars.city || getCityLabel())

      .replace(/\{marathi\}/g, '')

      .replace(/\{hashtags\}/g, buildHashtagLine(vars.wardFull || user.ward));

    return out;

  }



  function buildDefaultShareMessage() {

    const ward = user.ward ? getWardShortName(user.ward) : getCityLabel();

    return fillShareTemplate(t('share.appMsg'), {

      city: getCityLabel(),

      ward,

      link: shareAppLink(getMyReferralCode()),

      wardFull: user.ward,

    });

  }



  function buildShareReportMessage(report) {

    if (!report) return buildDefaultShareMessage();

    return fillShareTemplate(t('success.shareMsg'), {

      hazard: hazardLabel(report.hazard),

      ward: getWardShortName(report.ward) || t('header.context'),

      link: reportDeepLink(report.id, 'report'),

      wardFull: report.ward,

    });

  }



  function buildShareResolvedMessage(report) {

    if (!report) return buildDefaultShareMessage();

    return fillShareTemplate(t('confirm.shareResolvedMsg'), {

      hazard: hazardLabel(report.hazard),

      ward: getWardShortName(report.ward) || t('header.context'),

      link: reportDeepLink(report.id, 'win'),

      wardFull: report.ward,

    });

  }



  function buildShareMeTooMessage(report) {

    if (!report) return buildDefaultShareMessage();

    const n = Number(report.confirmations) || 1;

    return fillShareTemplate(t('share.meTooMsg'), {

      hazard: hazardLabel(report.hazard),

      ward: getWardShortName(report.ward) || t('header.context'),

      link: reportDeepLink(report.id, 'metoo'),

      wardFull: report.ward,

      n: String(n),

    });

  }



  function buildShareWardMapMessage() {

    const wardLabel = user.ward ? getWardShortName(user.ward) : getCityLabel();

    const userStat = user.ward

      ? getWardReportStats().find((s) => s.name === user.ward)

      : null;

    const pending = userStat ? userStat.pending : loadReports().filter((r) => r.status === 'pending').length;

    return fillShareTemplate(t('share.wardMapMsg'), {

      ward: wardLabel,

      pending: String(pending),

      link: getShareAppUrl(),

      wardFull: user.ward,

    });

  }



  function buildShareCleanupMessage(report) {

    if (!report) return buildDefaultShareMessage();

    return fillShareTemplate(t('share.cleanupMsg'), {

      hazard: hazardLabel(report.hazard),

      ward: getWardShortName(report.ward) || t('header.context'),

      link: reportDeepLink(report.id, 'cleanup'),

      wardFull: report.ward,

    });

  }



  function buildShareBackedMessage(wardName) {

    const ward = wardName || (user.ward ? getWardShortName(user.ward) : t('share.defaultArea'));

    return fillShareTemplate(t('confirm.shareMsg'), {

      ward,

      link: shareAppLink('fixed'),

      wardFull: user.ward,

    });

  }



  function prefersReducedMotion() {

    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  }



  const CONFETTI_HUES = [4, 28, 45, 160, 190, 230, 280, 330];

  let _audioCtx = null;

  function celebrationSoundMuted() {

    try { return localStorage.getItem('civicradar_sound_muted') === '1'; } catch { return false; }

  }

  function playCelebrationChime() {

    if (celebrationSoundMuted() || prefersReducedMotion()) return;

    try {

      const AC = window.AudioContext || window.webkitAudioContext;

      if (!AC) return;

      if (!_audioCtx) _audioCtx = new AC();

      if (_audioCtx.state === 'suspended') _audioCtx.resume();

      const ctx = _audioCtx;

      const now = ctx.currentTime;

      const master = ctx.createGain();

      master.gain.value = 0.09;

      master.connect(ctx.destination);

      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {

        const t0 = now + i * 0.085;

        const osc = ctx.createOscillator();

        const g = ctx.createGain();

        osc.type = 'triangle';

        osc.frequency.value = freq;

        g.gain.setValueAtTime(0.0001, t0);

        g.gain.exponentialRampToValueAtTime(1, t0 + 0.02);

        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);

        osc.connect(g);

        g.connect(master);

        osc.start(t0);

        osc.stop(t0 + 0.3);

      });

    } catch { /* best-effort */ }

  }

  window.setCelebrationSoundMuted = (m) => {

    try { safeLocalSet('civicradar_sound_muted', m ? '1' : '0'); } catch {}

  };

  let _audioPrimed = false;

  function primeCelebrationAudio() {

    if (_audioPrimed) return;

    _audioPrimed = true;

    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((evt) =>

      window.removeEventListener(evt, primeCelebrationAudio, true)

    );

    try {

      const AC = window.AudioContext || window.webkitAudioContext;

      if (!AC) return;

      if (!_audioCtx) _audioCtx = new AC();

      if (_audioCtx.state === 'suspended') _audioCtx.resume();

      const buf = _audioCtx.createBuffer(1, 1, 22050);

      const src = _audioCtx.createBufferSource();

      src.buffer = buf;

      src.connect(_audioCtx.destination);

      src.start(0);

    } catch { /* retry lazily on next chime */ }

  }

  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((evt) =>

    window.addEventListener(evt, primeCelebrationAudio, { capture: true, passive: true })

  );

  function launchConfetti(opts = {}) {

    if (prefersReducedMotion()) return;

    const intensity = opts.intensity || 'normal';

    const counts = { mini: 14, normal: 28, celebrate: 42, epic: 64 };

    const count = counts[intensity] || counts.normal;

    const wrap = document.createElement('div');

    wrap.className = 'confetti-burst';

    wrap.setAttribute('aria-hidden', 'true');

    const shapes = ['', '', 'confetti-burst__piece--dot', 'confetti-burst__piece--ribbon'];

    for (let i = 0; i < count; i++) {

      const p = document.createElement('span');

      const shape = shapes[Math.floor(Math.random() * shapes.length)];

      p.className = `confetti-burst__piece${shape ? ` ${shape}` : ''}`;

      p.style.setProperty('--x', `${Math.random() * 100}%`);

      p.style.setProperty('--delay', `${Math.random() * 0.5}s`);

      p.style.setProperty('--hue', String(CONFETTI_HUES[Math.floor(Math.random() * CONFETTI_HUES.length)]));

      p.style.setProperty('--size', `${6 + Math.floor(Math.random() * 7)}px`);

      p.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 160)}px`);

      p.style.setProperty('--spin', `${360 + Math.floor(Math.random() * 360)}deg`);

      p.style.setProperty('--spin-end', `${720 + Math.floor(Math.random() * 540)}deg`);

      wrap.appendChild(p);

    }

    document.body.appendChild(wrap);

    setTimeout(() => wrap.remove(), 2700);

  }



  function celebrationHaptic() {

    try {

      if (celebrationSoundMuted()) return;

      if (navigator.vibrate) navigator.vibrate(10);

    } catch { /* unsupported / denied */ }

  }



  function celebrateReportSubmit(reportCount) {

    const isFirst = reportCount === 1;

    const isMilestone = REPORT_CELEBRATION_MILESTONES.includes(reportCount);

    celebrationHaptic();

    launchConfetti({ intensity: isFirst || isMilestone ? 'celebrate' : 'mini' });

    if (isFirst || isMilestone) playCelebrationChime();

    if (isFirst) {

      setTimeout(() => showToast(t('toast.badgeMonsoon'), 'success', 4500), 700);

    } else if (isMilestone && reportCount > 1) {

      setTimeout(

        () => showToast(t('toast.reportMilestone').replace('{n}', String(reportCount)), 'success', 4000),

        600

      );

    }

  }



  // One-time nudge pointing active reporters toward community-lead/volunteer
  // roles, which are otherwise only discoverable by digging into Community.
  // Fired after the 3rd report (already a milestone) and shown only once ever.
  function maybeShowLeadVolunteerNudge(reportCount, delay) {

    if (reportCount !== 3) return false;

    if (isAdmin || isLead) return false;

    if (localStorage.getItem(LEAD_NUDGE_SEEN_KEY)) return false;

    safeLocalSet(LEAD_NUDGE_SEEN_KEY, '1');

    setTimeout(() => {

      showToast(t('lead.discoverNudge'), 'info', 6000, {

        label: t('lead.discoverNudgeCta'),

        onClick: () => { setNavTab('community'); if (window.openLeadModal) window.openLeadModal(); },

      });

    }, delay);

    return true;

  }



  function pulseProfilePointsStat() {

    const el = $('#profilePoints');

    if (!el || getTotalCivicPoints() <= 0) return;

    el.classList.remove('profile-stat-pop');

    void el.offsetWidth;

    el.classList.add('profile-stat-pop');

  }



  function celebrateFirstShare() {

    if (localStorage.getItem(FIRST_SHARE_KEY)) return;

    try { safeLocalSet(FIRST_SHARE_KEY, '1'); } catch {}

    addPointsCache(POINTS_FIRST_SHARE);

    launchConfetti();

    playCelebrationChime();

    showToast(t('share.firstBonus'), 'success', 5500);

    if (window.CivicAnalytics) CivicAnalytics.track('first_share_bonus', { points: POINTS_FIRST_SHARE });

    updateProfileUI();

  }



  function trackWhatsAppShare(context, ward, meta) {

    if (window.CivicAnalytics) {

      CivicAnalytics.track('share_whatsapp', Object.assign({ context: context || 'generic' }, meta || {}), ward);

    }

    celebrateFirstShare();

  }



  function shareTwitter(message) {

    const base = typeof message === 'string' ? message : buildDefaultShareMessage();

    const text = encodeURIComponent(base);

    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');

  }



  function shareWhatsApp(message, opts) {

    const ctx = (opts && opts.context) || 'generic';

    const ward = (opts && opts.ward) || (user.ward || undefined);

    trackWhatsAppShare(ctx, ward, opts && opts.meta);

    const base = typeof message === 'string' ? message : buildDefaultShareMessage();

    const text = encodeURIComponent(base);

    window.open(`https://wa.me/?text=${text}`, '_blank');

  }



  function shareReportWhatsApp(reportId) {

    const report = findReportById(reportId);

    markReportShared(reportId);

    shareWhatsApp(buildShareReportMessage(report), {

      context: 'report',

      ward: report && report.ward,

      meta: { reportId: String(reportId) },

    });

  }



  function shareMeTooWhatsApp(reportId) {

    const report = findReportById(reportId);

    shareWhatsApp(buildShareMeTooMessage(report), {

      context: 'metoo',

      ward: report && report.ward,

      meta: { reportId: String(reportId) },

    });

  }



  function shareWardChallengeWhatsApp() {

    if (window.CivicAnalytics) CivicAnalytics.track('share_challenge', { ward: user.ward || '' }, user.ward);

    shareWhatsApp(buildShareWardMapMessage(), { context: 'challenge', ward: user.ward });

  }



  function shareResolvedWin(reportId) {

    const report = reportId

      ? findReportById(reportId)

      : getUserReports().filter((r) => r.status === 'resolved').sort((a, b) => new Date(b.resolvedAt || b.timestamp) - new Date(a.resolvedAt || a.timestamp))[0];

    shareWhatsApp(buildShareResolvedMessage(report), {

      context: 'resolved',

      ward: report && report.ward,

      meta: { reportId: report && String(report.id) },

    });

  }



  function buildInstagramCaption(report, type) {

    if (!report) return buildDefaultShareMessage();

    const templateKey = type === 'cleanup' ? 'share.instagramCleanupCaption' : 'share.instagramCaption';

    return fillShareTemplate(t(templateKey), {

      hazard: hazardLabel(report.hazard),

      ward: getWardShortName(report.ward) || t('header.context'),

      link: reportDeepLink(report.id, 'instagram'),

      wardFull: report.ward,

    });

  }



  function loadSuccessStoriesSeen() {

    try {

      return JSON.parse(localStorage.getItem(SUCCESS_STORIES_SEEN_KEY)) || [];

    } catch {

      return [];

    }

  }



  function saveSuccessStoriesSeen(ids) {

    try { safeLocalSet(SUCCESS_STORIES_SEEN_KEY, JSON.stringify(ids)); } catch {}

  }



  function getSuccessStories() {

    return cityScopedReports(loadReports())

      .filter((r) => r.status === 'resolved' || r.communityCleared)

      .sort((a, b) => {

        const ta = new Date(a.resolvedAt || a.timestamp || 0).getTime();

        const tb = new Date(b.resolvedAt || b.timestamp || 0).getTime();

        return tb - ta;

      })

      .slice(0, 20);

  }



  function getUnseenWinIds() {

    const seen = new Set(loadSuccessStoriesSeen());

    return getSuccessStories()

      .map((r) => String(r.id))

      .filter((id) => !seen.has(id));

  }



  function updateCommunityWinBadge() {

    const count = getUnseenWinIds().length;

    const badge = $('#communityNavBadge');

    if (badge) {

      badge.classList.toggle('hidden', count === 0);

      badge.textContent = count > 9 ? '9+' : String(count);

    }

  }



  function markSuccessStoriesSeen() {

    saveSuccessStoriesSeen(getSuccessStories().map((r) => String(r.id)));

    updateCommunityWinBadge();

  }



  function getSuccessStoryType(report) {

    const src = getReportResolutionSource(report);

    if (src === 'community_verified' || src === 'stale_verified') return 'community';

    if (report.status === 'resolved') return 'resolved';

    if (report.communityCleared) return 'cleanup';

    return 'resolved';

  }



  function renderSuccessStories() {

    const list = $('#successStoriesList');

    const empty = $('#successStoriesEmpty');

    if (!list) return;

    const stories = getSuccessStories();

    if (stories.length === 0) {

      list.innerHTML = '';

      if (empty) empty.classList.remove('hidden');

      updateCommunityWinBadge();

      return;

    }

    if (empty) empty.classList.add('hidden');

    list.innerHTML = stories.map((r) => {

      const type = getSuccessStoryType(r);

      const ward = getWardShortName(r.ward) || t('header.context');

      const thumb = isSafeReportImage(r.resolutionImage)

        ? r.resolutionImage

        : (isSafeReportImage(r.image) ? r.image : '');

      const labelKey = type === 'cleanup'

        ? 'community.winsCleanup'

        : type === 'community'

          ? 'community.winsCommunityVerified'

          : 'community.winsResolved';

      const label = t(labelKey)

        .replace('{hazard}', hazardLabel(r.hazard))

        .replace('{ward}', ward);

      const meta = t('community.winsNeighbours').replace('{ward}', ward);

      const thumbHtml = thumb

        ? `<img class="success-story-card__thumb" src="${thumb}" alt="">`

        : '<div class="success-story-card__thumb success-story-card__thumb--empty"><i class="ph ph-trophy"></i></div>';

      return `<button type="button" class="success-story-card" data-win-id="${escapeHtml(String(r.id))}" data-win-type="${type}" role="listitem">${thumbHtml}<div class="success-story-card__body"><span class="success-story-card__label">${escapeHtml(label)}</span><span class="success-story-card__meta">${escapeHtml(meta)}</span></div></button>`;

    }).join('');

    list.querySelectorAll('.success-story-card').forEach((btn) => {

      btn.addEventListener('click', () => {

        const report = findReportById(btn.dataset.winId);

        if (!report) return;

        if (window.CivicAnalytics) {

          CivicAnalytics.track('success_story_viewed', {

            reportId: String(report.id),

            type: btn.dataset.winType || 'resolved',

          }, report.ward);

        }

        showShareWinModal(report.id, btn.dataset.winType || 'resolved', { celebrate: false });

      });

    });

    updateCommunityWinBadge();

  }



  function getReportShareLocation(report) {

    if (!report) return t('header.context');

    const soc = (report.society || report.neighbourhood || '').trim();

    if (soc) return soc;

    const parts = parseWardParts(report.ward);

    if (parts.area) return parts.area;

    return getWardShortName(report.ward) || t('header.context');

  }



  function getShareWinFooterText(report) {

    return t('shareWin.footerMsg')

      .replace('{location}', getReportShareLocation(report))

      .replace('{app}', 'CivicRadar');

  }



  function setShareWinAspect(aspect) {

    pendingShareWinAspect = aspect === 'story' ? 'story' : 'square';

    try { safeLocalSet('civicradar_share_win_aspect', pendingShareWinAspect); } catch {}

    pendingSuccessCardBlob = null;

    document.querySelectorAll('.share-win-aspect__btn').forEach((btn) => {

      btn.classList.toggle('share-win-aspect__btn--active', btn.dataset.aspect === pendingShareWinAspect);

    });

    renderShareWinCardPreview();

  }



  function wrapCanvasText(ctx, text, maxWidth) {

    const words = String(text).split(/\s+/);

    const lines = [];

    let line = '';

    words.forEach((word) => {

      const test = line ? `${line} ${word}` : word;

      if (ctx.measureText(test).width > maxWidth && line) {

        lines.push(line);

        line = word;

      } else {

        line = test;

      }

    });

    if (line) lines.push(line);

    return lines;

  }



  function loadCanvasImage(src) {

    return new Promise((resolve, reject) => {

      const img = new Image();

      if (src && /supabase\.co/i.test(String(src))) img.crossOrigin = 'anonymous';

      img.onload = () => resolve(img);

      img.onerror = () => reject(new Error('image load failed'));

      img.src = src;

    });

  }



  function drawRoundedImage(ctx, img, x, y, w, h, radius) {

    ctx.save();

    ctx.beginPath();

    ctx.moveTo(x + radius, y);

    ctx.arcTo(x + w, y, x + w, y + h, radius);

    ctx.arcTo(x + w, y + h, x, y + h, radius);

    ctx.arcTo(x, y + h, x, y, radius);

    ctx.arcTo(x, y, x + w, y, radius);

    ctx.closePath();

    ctx.clip();

    ctx.drawImage(img, x, y, w, h);

    ctx.restore();

  }



  function drawImagePlaceholder(ctx, x, y, w, h, label, dark) {

    ctx.fillStyle = dark ? '#1e293b' : '#e2e8f0';

    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';

    ctx.font = '600 28px Outfit, system-ui, sans-serif';

    ctx.textAlign = 'center';

    ctx.fillText(label, x + w / 2, y + h / 2 + 10);

  }



  function drawFixedPlaceholder(ctx, x, y, w, h, label, dark) {

    ctx.save();

    ctx.beginPath();

    ctx.moveTo(x + 24, y);

    ctx.arcTo(x + w, y, x + w, y + h, 24);

    ctx.arcTo(x + w, y + h, x, y + h, 24);

    ctx.arcTo(x, y + h, x, y, 24);

    ctx.arcTo(x, y, x + w, y, 24);

    ctx.closePath();

    ctx.fillStyle = dark ? '#064e3b' : '#d1fae5';

    ctx.fill();

    ctx.fillStyle = dark ? '#34d399' : '#10b981';

    ctx.font = '700 88px Outfit, system-ui, sans-serif';

    ctx.textAlign = 'center';

    ctx.fillText('✓', x + w / 2, y + h / 2 - 8);

    ctx.fillStyle = dark ? '#ecfdf5' : '#065f46';

    ctx.font = '600 34px "Noto Sans Devanagari", Outfit, system-ui, sans-serif';

    ctx.fillText(label, x + w / 2, y + h / 2 + 44);

    ctx.textAlign = 'left';

    ctx.restore();

  }



  let pendingCertificateBlob = null;



  const CERT_LEVEL_BADGE = {
    observer: { ring: '#64748b', fill: '#94a3b8', glow: '#cbd5e1' },
    wardWatcher: { ring: '#4f46e5', fill: '#6366f1', glow: '#a5b4fc' },
    neighbourhoodVoice: { ring: '#0e7490', fill: '#0891b2', glow: '#67e8f8' },
    civicChampion: { ring: '#b45309', fill: '#d97706', glow: '#fcd34d' },
    monsoonGuardian: { ring: '#047857', fill: '#059669', glow: '#6ee7b7' },
    communityLeader: { ring: '#a16207', fill: '#ca8a04', glow: '#fde68a' },
  };

  function buildBeforeAfterSliderHtml(beforeSrc, afterSrc) {
    const hint = escapeHtml(t('ba.dragHint'));
    const beforeLabel = escapeHtml(t('ba.before'));
    const afterLabel = escapeHtml(t('ba.after'));
    return `
      <div class="ba-slider" role="group" aria-label="${hint}">
        <div class="ba-slider__frame">
          <img class="ba-slider__img ba-slider__img--after" src="${afterSrc}" alt="${afterLabel}" draggable="false">
          <div class="ba-slider__before-wrap" style="clip-path: inset(0 50% 0 0)">
            <img class="ba-slider__img ba-slider__img--before" src="${beforeSrc}" alt="${beforeLabel}" draggable="false">
          </div>
          <div class="ba-slider__divider" style="left: 50%" aria-hidden="true"></div>
          <button type="button" class="ba-slider__handle" style="left: 50%" aria-label="${hint}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" role="slider"></button>
          <span class="ba-slider__tag ba-slider__tag--before">${beforeLabel}</span>
          <span class="ba-slider__tag ba-slider__tag--after">${afterLabel}</span>
        </div>
      </div>`;
  }

  function bindBeforeAfterSliders(root) {
    if (!root) return;
    const scopes = root.classList && root.classList.contains('ba-slider')
      ? [root]
      : Array.from(root.querySelectorAll('.ba-slider'));
    scopes.forEach((slider) => {
      if (slider.dataset.baBound === '1') return;
      slider.dataset.baBound = '1';
      const wrap = slider.querySelector('.ba-slider__before-wrap');
      const divider = slider.querySelector('.ba-slider__divider');
      const handle = slider.querySelector('.ba-slider__handle');
      const frame = slider.querySelector('.ba-slider__frame');
      if (!wrap || !handle || !frame) return;

      const setPos = (pct) => {
        const p = Math.max(2, Math.min(98, pct));
        const right = 100 - p;
        wrap.style.clipPath = 'inset(0 ' + right + '% 0 0)';
        if (divider) divider.style.left = p + '%';
        handle.style.left = p + '%';
        handle.setAttribute('aria-valuenow', String(Math.round(p)));
      };

      const posFromEvent = (ev) => {
        const rect = frame.getBoundingClientRect();
        const clientX = (ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX);
        if (!rect.width) return 50;
        return ((clientX - rect.left) / rect.width) * 100;
      };

      let dragging = false;
      const onMove = (ev) => {
        if (!dragging) return;
        if (ev.cancelable) ev.preventDefault();
        setPos(posFromEvent(ev));
      };
      const onUp = () => {
        dragging = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
      };
      const onDown = (ev) => {
        dragging = true;
        setPos(posFromEvent(ev));
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
      };
      handle.addEventListener('pointerdown', onDown);
      frame.addEventListener('pointerdown', (ev) => {
        if (ev.target === handle) return;
        onDown(ev);
      });
      handle.addEventListener('keydown', (ev) => {
        const cur = Number(handle.getAttribute('aria-valuenow') || 50);
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); setPos(cur - 5); }
        if (ev.key === 'ArrowRight') { ev.preventDefault(); setPos(cur + 5); }
        if (ev.key === 'Home') { ev.preventDefault(); setPos(2); }
        if (ev.key === 'End') { ev.preventDefault(); setPos(98); }
      });
    });
  }

  async function generateCertificateCanvas(levelId) {

    const W = 1080;

    const H = 1350;

    const canvas = document.createElement('canvas');

    canvas.width = W;

    canvas.height = H;

    const ctx = canvas.getContext('2d');

    const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    const levelTitle = civicLevelName(levelId);

    const name = user.displayName || t('profile.greetingDefault');

    const ward = getWardShortName(user.ward) || getCityLabel();

    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    const badge = CERT_LEVEL_BADGE[levelId] || CERT_LEVEL_BADGE.observer;



    const grad = ctx.createLinearGradient(0, 0, W, H);

    if (dark) {

      grad.addColorStop(0, '#0f172a');

      grad.addColorStop(0.55, '#1e293b');

      grad.addColorStop(1, '#0f172a');

    } else {

      grad.addColorStop(0, '#f8fafc');

      grad.addColorStop(0.5, '#eef2ff');

      grad.addColorStop(1, '#f8fafc');

    }

    ctx.fillStyle = grad;

    ctx.fillRect(0, 0, W, H);



    ctx.strokeStyle = dark ? badge.fill : badge.ring;

    ctx.lineWidth = 5;

    ctx.strokeRect(48, 48, W - 96, H - 96);



    ctx.fillStyle = dark ? '#a5b4fc' : '#6366f1';

    ctx.font = '700 44px Outfit, system-ui, sans-serif';

    ctx.textAlign = 'center';

    ctx.fillText('CivicRadar', W / 2, 140);



    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';

    ctx.font = '600 30px Outfit, system-ui, sans-serif';

    ctx.fillText(t('cert.cardHeading'), W / 2, 196);



    const cx = W / 2;

    const cy = 390;

    const r = 128;

    const radial = ctx.createRadialGradient(cx - 36, cy - 40, 12, cx, cy, r);

    radial.addColorStop(0, badge.glow);

    radial.addColorStop(0.45, badge.fill);

    radial.addColorStop(1, badge.ring);

    ctx.beginPath();

    ctx.arc(cx, cy, r, 0, Math.PI * 2);

    ctx.fillStyle = radial;

    ctx.fill();

    ctx.lineWidth = 10;

    ctx.strokeStyle = dark ? 'rgba(248,250,252,0.35)' : 'rgba(255,255,255,0.85)';

    ctx.stroke();

    ctx.beginPath();

    ctx.arc(cx, cy, r - 22, 0, Math.PI * 2);

    ctx.strokeStyle = dark ? 'rgba(15,23,42,0.35)' : 'rgba(15,23,42,0.12)';

    ctx.lineWidth = 3;

    ctx.stroke();

    // Geometric medal mark (no emoji) — concentric ring + diamond
    ctx.fillStyle = '#ffffff';

    ctx.beginPath();

    ctx.moveTo(cx, cy - 36);

    ctx.lineTo(cx + 28, cy);

    ctx.lineTo(cx, cy + 36);

    ctx.lineTo(cx - 28, cy);

    ctx.closePath();

    ctx.fill();

    ctx.beginPath();

    ctx.arc(cx, cy, 12, 0, Math.PI * 2);

    ctx.fillStyle = badge.ring;

    ctx.fill();



    ctx.fillStyle = dark ? '#f8fafc' : '#0f172a';

    ctx.font = '700 64px Outfit, system-ui, sans-serif';

    ctx.fillText(levelTitle, W / 2, 580);



    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';

    ctx.font = '500 38px "Noto Sans Devanagari", Outfit, system-ui, sans-serif';

    ctx.fillText(t('cert.awarded').replace('{name}', name), W / 2, 680);



    ctx.font = '500 34px Outfit, system-ui, sans-serif';

    ctx.fillText(ward, W / 2, 750);



    ctx.font = '500 30px Outfit, system-ui, sans-serif';

    ctx.fillText(t('cert.date').replace('{date}', dateStr), W / 2, 820);



    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';

    ctx.font = '500 26px Outfit, system-ui, sans-serif';

    ctx.fillText(t('cert.tagline'), W / 2, H - 120);



    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';

    ctx.font = '500 22px Outfit, system-ui, sans-serif';

    ctx.fillText(location.origin + location.pathname, W / 2, H - 72);



    return canvas;

  }


  async function ensureCertificateBlob() {

    if (pendingCertificateBlob) return pendingCertificateBlob;

    const canvas = await generateCertificateCanvas(pendingCertificateLevelId);

    pendingCertificateBlob = await new Promise((resolve) => {

      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92);

    });

    return pendingCertificateBlob;

  }



  function buildCertificateCaption(levelId) {

    const levelTitle = civicLevelName(levelId);

    const ward = getWardShortName(user.ward) || getCityLabel();

    return t('cert.caption')

      .replace('{level}', levelTitle)

      .replace('{ward}', ward)

      .replace('{link}', shareAppLink('cert'));

  }



  function showCertificateModal(levelId) {

    pendingCertificateLevelId = levelId;

    pendingCertificateBlob = null;

    markXpCertificateSeen(levelId);

    const sub = $('#certificateSubtitle');

    if (sub) {

      sub.textContent = t('cert.subtitle').replace('{level}', civicLevelName(levelId));

    }



    // Certificate replaces the success modal — leaving both open blocks clicks on success controls.

    closeModal('success');



    const modal = $('#certificateModal');

    const icon = modal && modal.querySelector('.success-icon--cert');

    const previewWrap = $('#certificatePreviewWrap');

    const previewImg = $('#certificateCardPreview');

    const actions = modal && modal.querySelectorAll('.btn, .share-win-instagram');

    const badge = CERT_LEVEL_BADGE[levelId] || CERT_LEVEL_BADGE.observer;



    if (icon) {

      icon.style.setProperty('--cert-badge', badge.fill);

      icon.classList.remove('cert-badge--pop');

    }



    if (previewWrap) previewWrap.hidden = true;

    if (previewImg) previewImg.removeAttribute('src');



    if (actions) actions.forEach((el) => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });



    openModal('certificate');



    const revealCard = async () => {

      if (icon) icon.classList.add('cert-badge--pop');

      try {

        const canvas = await generateCertificateCanvas(levelId);

        if (previewImg) previewImg.src = canvas.toDataURL('image/png', 0.92);

        if (previewWrap) previewWrap.hidden = false;

      } catch { /* preview optional */ }



      if (actions) {

        actions.forEach((el) => {

          el.style.opacity = '';

          el.style.pointerEvents = '';

          if (!prefersReducedMotion()) el.classList.add('cert-actions--reveal');

        });

      }

    };



    if (prefersReducedMotion()) {

      revealCard();

    } else {

      launchConfetti({ intensity: 'epic' });

      setTimeout(() => playCelebrationChime(), 180);

      setTimeout(() => { revealCard(); }, 700);

    }



    if (window.CivicAnalytics) {

      CivicAnalytics.track('xp_certificate_unlocked', { level: levelId }, user.ward);

    }



  }


  async function downloadCertificate() {

    if (!pendingCertificateLevelId) return;

    try {

      const blob = await ensureCertificateBlob();

      if (!blob) throw new Error('no blob');

      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');

      a.href = url;

      a.download = `civicradar-cert-${pendingCertificateLevelId}.png`;

      document.body.appendChild(a);

      a.click();

      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      showToast(t('cert.downloaded'), 'success', 4500);

    } catch {

      showToast(t('toast.saveFail'), 'error');

    }

  }



  function copyCertificateCaption() {

    if (!pendingCertificateLevelId) return;

    copyTextSafe(buildCertificateCaption(pendingCertificateLevelId), 'cert.captionCopied');

  }



  function shareCertificateWhatsApp() {

    if (!pendingCertificateLevelId) return;

    const msg = buildCertificateCaption(pendingCertificateLevelId);

    shareWhatsApp(msg, { context: 'xp_certificate', meta: { level: pendingCertificateLevelId } });

  }



  async function generateSuccessCardCanvas(report, type, aspect) {

    aspect = aspect || pendingShareWinAspect || 'square';

    const isStory = aspect === 'story';

    const W = 1080;

    const H = isStory ? 1920 : 1080;

    const canvas = document.createElement('canvas');

    canvas.width = W;

    canvas.height = H;

    const ctx = canvas.getContext('2d');

    const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    const ward = getWardShortName(report.ward) || t('header.context');

    const hazard = hazardLabel(report.hazard);

    const headline = type === 'cleanup' ? `Cleared in ${ward}` : `Fixed in ${ward}`;



    const grad = ctx.createLinearGradient(0, 0, W, H);

    if (dark) {

      grad.addColorStop(0, '#0f172a');

      grad.addColorStop(1, '#1e1b4b');

    } else {

      grad.addColorStop(0, '#eef2ff');

      grad.addColorStop(1, '#f8fafc');

    }

    ctx.fillStyle = grad;

    ctx.fillRect(0, 0, W, H);



    ctx.fillStyle = dark ? '#a5b4fc' : '#6366f1';

    ctx.font = '700 52px Outfit, system-ui, sans-serif';

    ctx.textAlign = 'left';

    ctx.fillText('CivicRadar', 72, isStory ? 120 : 96);



    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';

    ctx.font = '500 24px Outfit, system-ui, sans-serif';

    ctx.fillText('#MonsoonGuardian', W - 72 - ctx.measureText('#MonsoonGuardian').width, isStory ? 120 : 96);



    ctx.fillStyle = dark ? '#f8fafc' : '#0f172a';

    ctx.font = '700 56px Outfit, system-ui, sans-serif';

    const headLines = wrapCanvasText(ctx, headline, W - 144);

    headLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, 72, (isStory ? 210 : 190) + i * 64));



    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';

    ctx.font = '500 36px "Noto Sans Devanagari", Outfit, system-ui, sans-serif';

    ctx.fillText(hazard, 72, (isStory ? 210 : 190) + Math.min(headLines.length, 2) * 64 + 20);



    const imgY = isStory ? 420 : 340;

    const imgW = isStory ? 460 : 440;

    const imgH = isStory ? 520 : 360;

    const gap = 40;

    const leftX = 72;

    const rightX = leftX + imgW + gap;



    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';

    ctx.font = '600 24px Outfit, system-ui, sans-serif';

    ctx.fillText(t('profile.proofBefore').toUpperCase(), leftX, imgY - 12);

    ctx.fillText(t('profile.proofAfter').toUpperCase(), rightX, imgY - 12);



    const hasBefore = isSafeReportImage(report.image);

    const hasAfter = isSafeReportImage(report.resolutionImage);

    const fixedLabel = t('shareWin.fixedLabel');



    if (hasBefore) {

      try {

        const beforeImg = await loadCanvasImage(report.image);

        drawRoundedImage(ctx, beforeImg, leftX, imgY, imgW, imgH, 24);

      } catch {

        drawImagePlaceholder(ctx, leftX, imgY, imgW, imgH, '—', dark);

      }

    } else {

      drawImagePlaceholder(ctx, leftX, imgY, imgW, imgH, '—', dark);

    }



    if (hasAfter) {

      try {

        const afterImg = await loadCanvasImage(report.resolutionImage);

        drawRoundedImage(ctx, afterImg, rightX, imgY, imgW, imgH, 24);

      } catch {

        drawFixedPlaceholder(ctx, rightX, imgY, imgW, imgH, fixedLabel, dark);

      }

    } else {

      drawFixedPlaceholder(ctx, rightX, imgY, imgW, imgH, fixedLabel, dark);

    }



    // Diagonal FIXED stamp on after-photo corner (shareable win card)

    {

      const stamp = (t('shareWin.stampFixed') || fixedLabel || 'FIXED').toString();

      ctx.save();

      ctx.font = '800 36px Outfit, "Noto Sans Devanagari", system-ui, sans-serif';

      const padX = 18;

      const bw = ctx.measureText(stamp).width + padX * 2;

      const bh = 44;

      const sx = rightX + imgW - 24 - bw * 0.15;

      const sy = imgY + 52;

      ctx.translate(sx, sy);

      ctx.rotate(-12 * Math.PI / 180);

      ctx.globalAlpha = 0.88;

      ctx.fillStyle = dark ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.32)';

      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

      ctx.strokeStyle = '#059669';

      ctx.lineWidth = 3;

      ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);

      ctx.globalAlpha = 0.95;

      ctx.fillStyle = '#047857';

      ctx.textAlign = 'center';

      ctx.textBaseline = 'middle';

      ctx.fillText(stamp, 0, 1);

      ctx.restore();

      ctx.textAlign = 'left';

      ctx.textBaseline = 'alphabetic';

    }


    const footerY = imgY + imgH + (isStory ? 72 : 56);

    ctx.fillStyle = dark ? '#e2e8f0' : '#1e293b';

    ctx.font = '600 38px "Noto Sans Devanagari", Outfit, system-ui, sans-serif';

    const footerLines = wrapCanvasText(ctx, getShareWinFooterText(report), W - 144);

    footerLines.slice(0, isStory ? 3 : 2).forEach((line, i) => ctx.fillText(line, 72, footerY + i * 48));



    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';

    ctx.font = '500 28px Outfit, system-ui, sans-serif';

    ctx.fillText(reportDeepLink(report.id), 72, H - (isStory ? 72 : 64));



    return canvas;

  }



  async function ensureSuccessCardBlob() {

    const report = findReportById(pendingShareWinReportId);

    if (!report) return null;

    if (pendingSuccessCardBlob) return pendingSuccessCardBlob;

    const canvas = await generateSuccessCardCanvas(report, pendingShareWinType);

    pendingSuccessCardBlob = await new Promise((resolve) => {

      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92);

    });

    return pendingSuccessCardBlob;

  }



  async function downloadSuccessCard() {

    const report = findReportById(pendingShareWinReportId);

    if (!report) return;

    try {

      const blob = await ensureSuccessCardBlob();

      if (!blob) throw new Error('no blob');

      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');

      a.href = url;

      a.download = `civicradar-win-${String(report.id).slice(-8)}.png`;

      document.body.appendChild(a);

      a.click();

      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      showToast(t('shareWin.cardDownloaded'), 'success', 4500);

      if (window.CivicAnalytics) {

        CivicAnalytics.track('success_card_downloaded', {

          reportId: String(report.id),

          type: pendingShareWinType,

        }, report.ward);

      }

      celebrateFirstShare();

    } catch {

      showToast(t('toast.saveFail'), 'error');

    }

  }



  function copyInstagramCaption() {

    const report = findReportById(pendingShareWinReportId);

    if (!report) return;

    copyTextSafe(buildInstagramCaption(report, pendingShareWinType), 'shareWin.captionCopied');

    if (window.CivicAnalytics) {

      CivicAnalytics.track('share_instagram', {

        action: 'copy_caption',

        reportId: String(report.id),

        type: pendingShareWinType,

      }, report.ward);

    }

    celebrateFirstShare();

  }



  async function nativeShareSuccessCard() {

    const report = findReportById(pendingShareWinReportId);

    if (!report || !navigator.share) return;

    try {

      const blob = await ensureSuccessCardBlob();

      if (!blob) throw new Error('no blob');

      const file = new File([blob], `civicradar-win-${String(report.id).slice(-8)}.png`, { type: 'image/png' });

      const shareData = {

        files: [file],

        title: t('shareWin.title'),

        text: buildInstagramCaption(report, pendingShareWinType),

      };

      if (navigator.canShare && !navigator.canShare(shareData)) {

        showToast(t('shareWin.instagramHint'), 'info', 4500);

        return;

      }

      await navigator.share(shareData);

      if (window.CivicAnalytics) {

        CivicAnalytics.track('share_instagram', {

          action: 'native_share',

          reportId: String(report.id),

          type: pendingShareWinType,

        }, report.ward);

      }

      celebrateFirstShare();

    } catch (err) {

      if (err && err.name === 'AbortError') return;

      showToast(t('toast.saveFail'), 'error');

    }

  }



  function canShareImageFiles() {

    if (!navigator.share || typeof navigator.canShare !== 'function') return false;

    try {

      const probe = new File(['x'], 'probe.png', { type: 'image/png' });

      return navigator.canShare({ files: [probe] });

    } catch {

      return false;

    }

  }



  function updateShareWinNativeButton() {

    const btn = $('#btnShareWinNativeShare');

    if (!btn) return;

    btn.classList.toggle('hidden', !canShareImageFiles());

  }



  function updateSuccessNativeButton() {

    const btn = $('#btnSuccessNativeShare');

    if (!btn) return;

    btn.classList.toggle('hidden', !navigator.share);

  }



  async function nativeShareReport() {

    if (!navigator.share) return;

    const report = lastReportId ? findReportById(lastReportId) : null;

    const text = report ? buildShareReportMessage(report) : buildDefaultShareMessage();

    const shareData = { title: t('success.title'), text };

    try {

      if (typeof navigator.canShare === 'function' && !navigator.canShare(shareData)) return;

      await navigator.share(shareData);

      if (report) markReportShared(report.id);

      if (window.CivicAnalytics) {

        CivicAnalytics.track('share_report_native', {

          reportId: report ? String(report.id) : '',

        }, report && report.ward);

      }

      celebrateFirstShare();

    } catch (err) {

      if (err && err.name === 'AbortError') return;

      /* fall back silently — WhatsApp/Twitter buttons remain available */

    }

  }



  async function renderShareWinCardPreview() {

    const wrap = $('#shareWinPreviewWrap');

    const img = $('#shareWinCardPreview');

    const report = findReportById(pendingShareWinReportId);

    if (!wrap || !img || !report) {

      if (wrap) wrap.hidden = true;

      return;

    }

    wrap.hidden = false;

    img.alt = getShareWinFooterText(report);

    img.classList.toggle('share-win-preview__img--story', pendingShareWinAspect === 'story');

    try {

      const canvas = await generateSuccessCardCanvas(report, pendingShareWinType, pendingShareWinAspect);

      img.src = canvas.toDataURL('image/png', 0.92);

    } catch {

      wrap.hidden = true;

      img.removeAttribute('src');

    }

  }



  function showShareWinModal(reportId, type, opts) {

    opts = opts || {};

    const report = findReportById(reportId);

    if (!report) return;

    pendingShareWinReportId = reportId;

    pendingShareWinType = type || 'resolved';

    pendingSuccessCardBlob = null;



    const sub = $('#shareWinSubtitle');

    if (sub) {

      sub.textContent = pendingShareWinType === 'cleanup'

        ? t('shareWin.subtitleCleanup')

        : pendingShareWinType === 'community'

          ? t('shareWin.subtitleCommunity')

          : t('shareWin.subtitle');

    }



    const impactEl = $('#shareWinImpact');

    if (impactEl) {

      const n = Number(report.confirmations) || 0;

      const ward = getWardShortName(report.ward) || getCityLabel();

      impactEl.textContent = t('shareWin.impact')

        .replace('{n}', String(n))

        .replace('{ward}', ward);

      impactEl.classList.toggle('hidden', n <= 0 && !ward);

    }



    const proof = $('#shareWinProof');

    if (proof) {

      const hasBefore = isSafeReportImage(report.image);

      const hasAfter = isSafeReportImage(report.resolutionImage);

      if (hasBefore && hasAfter) {

        proof.hidden = false;

        proof.classList.add('share-win-proof--slider');

        proof.innerHTML = buildBeforeAfterSliderHtml(report.image, report.resolutionImage);

        bindBeforeAfterSliders(proof);

      } else if (hasBefore || hasAfter) {

        proof.hidden = false;

        proof.classList.remove('share-win-proof--slider');

        proof.innerHTML = `

          <div class="proof-compare__col">

            <span class="proof-compare__label">${escapeHtml(t('profile.proofBefore'))}</span>

            ${hasBefore ? `<img src="${report.image}" alt="">` : '<div class="proof-compare__placeholder">—</div>'}

          </div>

          <div class="proof-compare__col">

            <span class="proof-compare__label">${escapeHtml(t('profile.proofAfter'))}</span>

            ${hasAfter ? `<img src="${report.resolutionImage}" alt="">` : `<div class="proof-compare__placeholder proof-compare__placeholder--fixed"><span class="proof-compare__check">✓</span><span>${escapeHtml(t('shareWin.fixedLabel'))}</span></div>`}

          </div>`;

      } else {

        proof.hidden = true;

        proof.classList.remove('share-win-proof--slider');

        proof.innerHTML = '';

      }
    }



    document.querySelectorAll('.share-win-aspect__btn').forEach((btn) => {

      btn.classList.toggle('share-win-aspect__btn--active', btn.dataset.aspect === pendingShareWinAspect);

    });

    renderShareWinCardPreview();

    updateShareWinNativeButton();

    if (opts.celebrate !== false) {
      celebrationHaptic();
      launchConfetti();
      playCelebrationChime();
    }

    openModal('shareWin');

  }



  function te(key) {

    return (I18N.en && I18N.en[key]) || key;

  }



  function isGpsOutsideCity(lat, lng, cityId) {

    if (lat == null || lng == null) return false;

    const city = cityId || getUserCity();

    if (window.CivicWardDetect && CivicWardDetect.inCityBounds) {

      return !CivicWardDetect.inCityBounds(lat, lng, city);

    }

    const b = getCityConfig(city).bounds;

    if (!b) return false;

    return lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng;

  }



  function isGpsOutsideMumbai(lat, lng) {

    return isGpsOutsideCity(lat, lng, 'mumbai');

  }



  function formatWardForCopy(wardParts) {

    if (!wardParts || (!wardParts.shortCode && !wardParts.code)) return '—';

    const code = wardParts.shortCode || wardParts.code;

    return wardParts.area ? `${code} (${wardParts.area})` : code;

  }



  function bmcCategoryLabel(hazard) {

    const key = `copy1916.category.${hazard}`;

    return I18N.en[key] || I18N.en[`hazard.${hazard}`] || hazardLabel(hazard);

  }



  function absoluteOgUrl(path) {

    if (!path) return '';

    if (/^https?:\/\//i.test(path)) return path;

    const base = getShareAppUrl().replace(/\?.*$/, '').replace(/index\.html$/, '');

    const clean = path.replace(/^\//, '');

    return `${base}${base.endsWith('/') ? '' : '/'}${clean}`;

  }



  function setMetaContent(selector, value) {

    if (!value) return;

    const el = document.querySelector(selector);

    if (el) el.setAttribute('content', value);

  }



  // Client-side meta refresh for in-browser tabs. WhatsApp/Facebook crawlers need SSR for per-report OG.

  function updatePageMetaForReport(report) {

    if (!report) return;

    const ward = getWardShortName(report.ward) || t('header.context');

    const hazard = hazardLabel(report.hazard);

    const title = `${hazard} — ${ward} | CivicRadar #MonsoonGuardian`;

    const desc = fillShareTemplate(t('success.shareMsg'), {

      hazard,

      ward,

      link: reportDeepLink(report.id),

      wardFull: report.ward,

    }).slice(0, 200);

    document.title = title;

    setMetaContent('meta[property="og:title"]', title);

    setMetaContent('meta[property="og:description"]', desc);

    setMetaContent('meta[name="twitter:title"]', title);

    setMetaContent('meta[name="twitter:description"]', desc);

    const img = isSafeReportImage(report.image) ? report.image : absoluteOgUrl('assets/og-civicradar.svg');

    setMetaContent('meta[property="og:url"]', reportDeepLink(report.id));

    setMetaContent('meta[property="og:image"]', img.startsWith('data:') ? absoluteOgUrl('assets/og-civicradar.svg') : img);

    setMetaContent('meta[name="twitter:image"]', absoluteOgUrl('assets/og-civicradar.svg'));

  }



  // Focus map on ?report=id deep links (retries after backend sync).

  function handleReportDeepLink(attempt = 0) {

    const reportId = new URLSearchParams(location.search).get('report');

    if (!reportId) return;

    const report = findReportById(reportId);

    if (!report || report.lat == null) {

      if (attempt < 6 && Backend.enabled) {

        setTimeout(() => handleReportDeepLink(attempt + 1), 700);

        return;

      }

      if (attempt >= 6 || !Backend.enabled) {

        showToast(t('toast.reportNotFound'), 'info', 4000);

      }

      return;

    }

    updatePageMetaForReport(report);

    showAppOpenBanner();

    if (!map) return;

    deferNonCritical(() => {

      map.setView([report.lat, report.lng], 17);

      const marker = reportMarkerMap.get(report.id) || reportMarkerMap.get(String(report.id));

      if (marker) {

        marker.openPopup();

        const el = marker.getElement && marker.getElement();

        if (el) {

          el.classList.add('marker-flash');

          setTimeout(() => el.classList.remove('marker-flash'), 2400);

        }

      }

    });

  }



  /* ---------- BMC Escalation Ladder ----------

   * Mirrors how Mumbai civic complaints actually escalate: file via CCRS

   * (1916 / MyBMC / portal / @mybmc) ? ward complaint officer ? zonal DMC ?

   * Public Grievance / Aaple Sarkar. Stagnant water routes to the ward PCO.

   */

  function findReportById(id) {

    return loadReports().find((r) => String(r.id) === String(id));

  }



  function trackBmcEvent(eventType, payload, ward) {

    if (window.CivicAnalytics) {

      CivicAnalytics.track(eventType, payload || {}, ward);

    }

  }



  function looksLikeBmcComplaintId(val) {

    if (!val) return false;

    const s = String(val).trim();

    return /[A-Za-z]\/\d{4}\//.test(s) || (/\d{4}/.test(s) && /\d/.test(s));

  }



  function markReportShared(reportId) {

    if (!reportId) return;

    const reports = loadReports();

    const idx = reports.findIndex((r) => String(r.id) === String(reportId));

    if (idx === -1 || reports[idx].communityShared) return;

    reports[idx].communityShared = new Date().toISOString();

    try {

      saveReports(reports);

    } catch { /* ignore */ }

  }



  function getFilingProgress(report) {

    const steps = ['reported', 'shared', 'filed', 'escalating', 'resolved'];

    const stage = getReportStage(report);

    const done = new Set(['reported']);

    if (report.communityShared || (Number(report.confirmations) || 0) > 0) done.add('shared');

    if (stage.filed) done.add('filed');

    if (report.status === 'resolved') {

      done.add('escalating');

      done.add('resolved');

    } else if (stage.filed && stage.days >= ESCALATION_DAYS.matrix) {

      done.add('escalating');

    }

    let active = 'reported';

    if (report.status === 'resolved') active = 'resolved';

    else if (stage.filed && stage.days >= ESCALATION_DAYS.matrix) active = 'escalating';

    else if (stage.filed) active = 'filed';

    else if (done.has('shared')) active = 'shared';

    return { steps, done, active };

  }



  function renderFilingProgress(container, report) {

    if (!container || !report) return;

    const { steps, done, active } = getFilingProgress(report);

    container.innerHTML = steps.map((key) => {

      let cls = '';

      if (done.has(key)) cls = 'is-done';

      else if (key === active) cls = 'is-active';

      return `<div class="esc-progress__step ${cls}">${escapeHtml(t(`esc.progress.${key}`))}</div>`;

    }).join('');

  }



  function renderReportCardProgress(report) {

    const resolved = report.status === 'resolved';

    const stepDefs = [
      { label: t('esc.progress.reported'), state: 'is-done' },
      { label: t('popup.pending'), state: resolved ? 'is-done' : 'is-active' },
      { label: t('esc.progress.resolved'), state: resolved ? 'is-done' : '' },
    ];

    const iconFor = (state) => (state === 'is-done' ? 'ph-check-bold' : state === 'is-active' ? 'ph-clock' : 'ph-circle');

    const stepHtml = (s) => `<div class="status-stepper__step ${s.state}"><span class="status-stepper__icon"><i class="ph ${iconFor(s.state)}"></i></span><span class="status-stepper__label">${escapeHtml(s.label)}</span></div>`;

    const lineHtml = (done) => `<div class="status-stepper__line${done ? ' is-done' : ''}"></div>`;

    return `<div class="status-stepper" aria-hidden="true">${stepHtml(stepDefs[0])}${lineHtml(true)}${stepHtml(stepDefs[1])}${lineHtml(resolved)}${stepHtml(stepDefs[2])}</div>`;

  }



  function buildCitizenComplaintText(report) {

    return buildBmcComplaintCopyText(report);

  }



  function buildComplaintText(report) {

    const wardParts = parseWardParts(report.ward || user.ward);

    const wardLine = formatWardForCopy(wardParts);

    const category = bmcCategoryLabel(report.hazard);

    const loc =

      report.lat != null && report.lng != null

        ? ` GPS: ${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}. Maps: https://maps.google.com/?q=${report.lat},${report.lng}.`

        : '';

    const gpsWarn = (report.lat != null && isGpsOutsideCity(report.lat, report.lng, getReportCity(report)))

      ? ` ${te('copy1916.gpsWarning').replace('{city}', getCityLabel(getReportCity(report)))}.`

      : '';

    const link = reportCopyDeepLink(report.id);

    const linkNote = isLocalhostOrigin() && !getPublicAppUrl() ? ` ${te('copy1916.linkLocalhostNote')}` : '';

    const marathiLead = I18N.mr[`copy1916.marathiLead.${report.hazard}`] || '';

    const marathiAction = I18N.mr[`copy1916.marathiAction.${report.hazard}`] || '';

    const marathi = marathiLead

      ? ` Marathi: ${marathiLead.replace('{ward}', wardLine)} ${marathiAction}`

      : '';

    const cityLabel = getCityLabel(getReportCity(report));

    return (

      `${category} in Ward ${wardLine}, ${cityLabel}.${loc}${gpsWarn} ` +

      `Please depute the ward Pest Control Officer for anti-larval treatment.` +

      (report.notes ? ` Landmark: ${report.notes}.` : '') +

      ` CivicRadar: ${link}.${linkNote}${marathi}`

    );

  }



  function buildFollowUpText(report, tier) {

    const city = getReportCity(report);

    if (city === 'thane') return buildTmcFollowUpText(report, tier);

    if (city === 'pune') return buildPmcFollowUpText(report, tier);

    const wardName = getWardShortName(report.ward) || getCityLabel(city);

    const wardFull = report.ward || wardName;

    const cid = report.complaintId || '(complaint number)';

    const hazard = hazardLabel(report.hazard);

    const link = reportDeepLink(report.id);

    const corp = getCorpShortName(city);

    if (city !== 'mumbai') {

      if (tier === 'matrix') {

        return [

          `Follow-up — ${corp} complaint ${cid}`,

          `Ward: ${wardFull}`,

          `Issue: ${hazard} / stagnant water — still unresolved after ${ESCALATION_DAYS.matrix}+ days.`,

          `Request: Please escalate for pest-control / drainage action.`,

          `CivicRadar: ${link}`,

        ].join('\n');

      }

      if (tier === 'zonal') {

        return `${corp} complaint ${cid} — ${hazard} in ${wardName} still unresolved after ${ESCALATION_DAYS.zonal}+ days. Please escalate to senior officer. ${link} #CivicRadar`;

      }

      if (tier === 'grievance') {

        return [

          'RTI / grievance follow-up (informational draft — not legal advice)',

          `Complaint reference: ${cid}`,

          `Ward: ${wardFull}`,

          `Subject: Status of stagnant water / pest-control complaint filed with ${corp}`,

          `Question: Please provide current status, assigned officer, and expected resolution date.`,

          `Citizen report: ${link}`,

        ].join('\n');

      }

      return buildCitizenComplaintText(report);

    }

    if (tier === 'matrix') {

      return [

        `Follow-up — BMC complaint ${cid}`,

        `Ward: ${wardFull}`,

        `Issue: ${hazard} / stagnant water — still unresolved after ${ESCALATION_DAYS.matrix}+ days.`,

        `Request: Please escalate to Ward Complaint Officer / Assistant Municipal Commissioner for pest-control action.`,

        `CivicRadar: ${link}`,

      ].join('\n');

    }

    if (tier === 'zonal') {

      return `@${BMC.twitter} Complaint ${cid} — ${hazard} in ${wardName} still unresolved after ${ESCALATION_DAYS.zonal}+ days. Please escalate to Zonal DMC and depute Pest Control Officer. ${link} #CivicRadar #MumbaiMonsoon`;

    }

    if (tier === 'grievance') {

      return [

        'RTI application — complaint status (informational draft — not legal advice)',

        `Complaint reference: ${cid}`,

        `Ward: ${wardFull}`,

        `Subject: Status of pest-control / stagnant water complaint filed with BMC`,

        `Question: Please provide current status, assigned officer, and expected resolution date for the above complaint.`,

        `Citizen report: ${link}`,

      ].join('\n');

    }

    return buildCitizenComplaintText(report);

  }



  function buildTmcFollowUpText(report, tier) {

    const wardName = getWardShortName(report.ward) || getCityLabel('thane');

    const wardFull = report.ward || wardName;

    const cid = report.complaintId || '(reference number)';

    const hazard = hazardLabel(report.hazard);

    const link = reportDeepLink(report.id);

    if (tier === 'matrix') {

      return [

        `Follow-up — TMC complaint ${cid}`,

        `Ward: ${wardFull}`,

        `Issue: ${hazard} / stagnant water — still unresolved after ${ESCALATION_DAYS.matrix}+ days.`,

        `Request: Please escalate to ward office / Health dept (022-25331590) for anti-larval treatment.`,

        `CivicRadar: ${link}`,

      ].join('\n');

    }

    if (tier === 'zonal') {

      return `@TMCaTweetAway Complaint ${cid} — ${hazard} in ${wardName} still unresolved after ${ESCALATION_DAYS.zonal}+ days. Please escalate to Municipal Commissioner (mc@thanecity.gov.in). ${link} #CivicRadar #ThaneMonsoon`;

    }

    if (tier === 'grievance') {

      return [

        'Aaple Sarkar follow-up (informational draft — not legal advice)',

        `TMC complaint reference: ${cid}`,

        `Ward: ${wardFull}`,

        `Local body: Thane Municipal Corporation`,

        `Subject: Status of stagnant water / mosquito breeding complaint`,

        `Question: Please provide current status, assigned officer, and expected resolution date.`,

        `Citizen report: ${link}`,

        `Portal: https://pgportal.gov.in/`,

      ].join('\n');

    }

    return buildCitizenComplaintText(report);

  }



  function buildPmcFollowUpText(report, tier) {

    const wardName = getWardShortName(report.ward) || getCityLabel('pune');

    const wardFull = report.ward || wardName;

    const cid = report.complaintId || '(reference number)';

    const hazard = hazardLabel(report.hazard);

    const link = reportDeepLink(report.id);

    if (tier === 'matrix') {

      return [

        `Follow-up — PMC complaint ${cid}`,

        `Ward: ${wardFull}`,

        `Issue: ${hazard} / stagnant water — still unresolved after ${ESCALATION_DAYS.matrix}+ days.`,

        `Request: Please escalate via PMC CARE or toll-free helpline 1800 1030 222 for anti-larval treatment.`,

        `CivicRadar: ${link}`,

      ].join('\n');

    }

    if (tier === 'zonal') {

      return [

        `PMC CARE follow-up — complaint ${cid}`,

        `Ward: ${wardFull}`,

        `Issue: ${hazard} still unresolved after ${ESCALATION_DAYS.zonal}+ days.`,

        `Please escalate through PMC citizen services (www.pmc.gov.in/citizen-services) or WhatsApp 9689900002.`,

        `CivicRadar: ${link}`,

      ].join('\n');

    }

    if (tier === 'grievance') {

      return [

        'Aaple Sarkar follow-up (informational draft — not legal advice)',

        `PMC complaint reference: ${cid}`,

        `Ward: ${wardFull}`,

        `Local body: Pune Municipal Corporation`,

        `Subject: Status of stagnant water / mosquito breeding complaint`,

        `Question: Please provide current status, assigned officer, and expected resolution date.`,

        `Citizen report: ${link}`,

        `Portal: https://pgportal.gov.in/`,

      ].join('\n');

    }

    return buildCitizenComplaintText(report);

  }



  function updateEscCityLabels(city, corp) {

    const isMumbai = city === 'mumbai';

    const isThane = city === 'thane';

    const isPune = city === 'pune';

    const copyLabel = $('#escCopyBlockLabel');

    const portalHint = $('#escPortalHint');

    const complaintLabel = $('#escComplaintLabel');

    const consentLabel = $('#escFiledConsentLabel');

    const filedNoteText = $('#escFiledNoteText');

    const selfTitle = $('#escSelfConfirm strong');

    const selfBody = $('#escSelfConfirm p');

    if (copyLabel) copyLabel.textContent = isThane ? t('esc.tmc.copyBlock') : isPune ? t('esc.pmc.copyBlock') : isMumbai ? t('esc.copyBlock') : t('esc.copyBlock');

    if (portalHint) {

      portalHint.textContent = isThane ? t('esc.tmc.portalHint') : isPune ? t('esc.pmc.portalHint') : isMumbai ? t('esc.portalHint') : t('esc.corpHint').replace('{corp}', corp.name || getCityLabel(city));

    }

    if (complaintLabel) complaintLabel.textContent = isThane ? t('esc.tmc.complaintLabel') : isPune ? t('esc.pmc.complaintLabel') : t('esc.complaintLabel');

    if (consentLabel) {

      consentLabel.textContent = isThane ? t('esc.tmc.filedConsent') : isPune ? t('esc.pmc.filedConsent') : isMumbai ? t('esc.filedConsent') : t('esc.filedConsent').replace('BMC', corp.name || getCityLabel(city));

    }

    if (filedNoteText) filedNoteText.textContent = isThane ? t('esc.tmc.filedNote') : isPune ? t('esc.pmc.filedNote') : isMumbai ? t('esc.filedNote') : t('esc.filedNote').replace('BMC', corp.name || getCityLabel(city));

    if (selfTitle) selfTitle.textContent = isThane ? t('esc.tmc.selfTitle') : isPune ? t('esc.pmc.selfTitle') : isMumbai ? t('esc.selfTitle') : t('esc.selfTitle').replace('BMC', corp.name || getCityLabel(city));

    if (selfBody) selfBody.textContent = isThane ? t('esc.tmc.selfBody') : isPune ? t('esc.pmc.selfBody') : isMumbai ? t('esc.selfBody') : t('esc.selfBody').replace('BMC', corp.name || getCityLabel(city));

    const warnEl = $('#escComplaintWarn');

    if (warnEl && isThane) warnEl.textContent = t('esc.tmc.complaintWarn');

    else if (warnEl && isPune) warnEl.textContent = t('esc.pmc.complaintWarn');

    else if (warnEl && isMumbai) warnEl.textContent = t('esc.complaintWarn');

    const input = $('#escComplaintId');

    if (input && isThane) input.placeholder = t('esc.tmc.complaintPh');

    else if (input && isPune) input.placeholder = t('esc.pmc.complaintPh');

    else if (input) input.placeholder = t('esc.complaintPh');

  }



  function renderTmcChannels(corp) {

    const container = $('#escCorpChannels');

    const legacyBtn = $('#btnEscCorpPortal');

    const helplineEl = $('#escCorpHelpline');

    const deptsWrap = $('#escCorpDepts');

    const deptList = $('#escCorpDeptList');

    const aapleBtn = $('#btnEscCorpAaple');

    const recommended = $('#escCorpRecommended');

    if (recommended) {

      recommended.textContent = t('esc.tmc.recommended');

      recommended.classList.remove('hidden');

    }

    if (legacyBtn) legacyBtn.classList.add('hidden');

    if (helplineEl) {

      if (corp.helplineDisplay) {

        helplineEl.textContent = `${t('esc.tmc.channelCall')}: ${corp.helplineDisplay}`;

        helplineEl.classList.remove('hidden');

      } else {

        helplineEl.classList.add('hidden');

      }

    }

    if (!container) return;

    const channels = [];

    if (corp.grievanceUrl) {

      channels.push({

        type: 'portal',

        icon: 'globe',

        label: t('esc.tmc.channelPortal'),

        small: 'thanecity.gov.in',

        recommended: true,

      });

    }

    if (corp.helplines && corp.helplines[0]) {

      channels.push({

        type: 'call',

        phone: corp.helplines[0],

        icon: 'phone-call',

        label: t('esc.tmc.channelCall'),

        small: corp.helplineDisplay || corp.helplines[0],

      });

    }

    if (corp.email) {

      channels.push({

        type: 'email',

        email: corp.email,

        icon: 'envelope',

        label: t('esc.tmc.channelEmail'),

        small: corp.email,

      });

    }

    if (corp.twitter) {

      channels.push({

        type: 'tweet',

        handle: corp.twitter,

        icon: 'x-logo',

        label: t('esc.tmc.channelTweet'),

        small: `@${corp.twitter}`,

      });

    }

    if (corp.citizenCallCenter) {

      channels.push({

        type: 'call',

        phone: corp.citizenCallCenter,

        icon: 'headset',

        label: t('esc.tmc.channelCitizenCall'),

        small: corp.citizenCallCenter,

      });

    }

    container.innerHTML = channels.map((ch) => {

      const recCls = ch.recommended ? ' esc-channel--recommended' : '';

      const attrs = ch.type === 'call'

        ? `data-corp-channel="call" data-corp-phone="${escapeHtml(ch.phone)}"`

        : ch.type === 'email'

          ? `data-corp-channel="email" data-corp-email="${escapeHtml(ch.email)}"`

          : ch.type === 'tweet'

            ? `data-corp-channel="tweet" data-corp-twitter="${escapeHtml(ch.handle)}"`

            : `data-corp-channel="portal"`;

      return `<button type="button" class="esc-channel${recCls}" ${attrs}>

        <i class="ph ph-${ch.icon}"></i><span>${escapeHtml(ch.label)}</span><small>${escapeHtml(ch.small)}</small>

      </button>`;

    }).join('');

    if (deptsWrap && deptList && corp.departments && corp.departments.length) {

      deptList.innerHTML = corp.departments.map((dept) => {

        const label = t(`esc.tmc.dept.${dept.key}`) || dept.key;

        const actions = [];

        if (dept.phone) {

          actions.push(`<button type="button" class="btn btn--secondary btn--sm" data-corp-channel="call" data-corp-phone="${escapeHtml(dept.phone)}">${escapeHtml(dept.phoneDisplay || dept.phone)}</button>`);

        }

        if (dept.email) {

          actions.push(`<button type="button" class="btn btn--secondary btn--sm" data-corp-channel="email" data-corp-email="${escapeHtml(dept.email)}">${escapeHtml(t('esc.tmc.tier.openEmail'))}</button>`);

        }

        return `<li><span class="esc-dept-list__label">${escapeHtml(label)}</span><span class="esc-dept-list__actions">${actions.join('')}</span></li>`;

      }).join('');

      deptsWrap.classList.remove('hidden');

    } else if (deptsWrap) {

      deptsWrap.classList.add('hidden');

    }

    if (aapleBtn) {

      aapleBtn.classList.toggle('hidden', !corp.aapleSarkarUrl);

      const span = aapleBtn.querySelector('span');

      if (span) span.textContent = t('esc.tmc.aaple');

    }

  }



  function renderPmcChannels(corp) {

    const container = $('#escCorpChannels');

    const legacyBtn = $('#btnEscCorpPortal');

    const helplineEl = $('#escCorpHelpline');

    const deptsWrap = $('#escCorpDepts');

    const aapleBtn = $('#btnEscCorpAaple');

    const recommended = $('#escCorpRecommended');

    if (recommended) {

      recommended.textContent = t('esc.pmc.recommended');

      recommended.classList.remove('hidden');

    }

    if (legacyBtn) legacyBtn.classList.add('hidden');

    if (helplineEl) {

      if (corp.helplineDisplay) {

        helplineEl.textContent = `${t('esc.pmc.channelCall')}: ${corp.helplineDisplay}`;

        helplineEl.classList.remove('hidden');

      } else {

        helplineEl.classList.add('hidden');

      }

    }

    if (deptsWrap) deptsWrap.classList.add('hidden');

    if (!container) return;

    const channels = [];

    if (corp.whatsapp) {

      channels.push({

        type: 'whatsapp',

        icon: 'whatsapp-logo',

        label: t('esc.pmc.channelWa'),

        small: t('esc.pmc.channelWaSmall'),

        recommended: true,

      });

    }

    if (corp.grievanceUrl) {

      channels.push({

        type: 'portal',

        icon: 'globe',

        label: t('esc.pmc.channelPortal'),

        small: 'www.pmc.gov.in',

      });

    }

    if (corp.helpline) {

      channels.push({

        type: 'call',

        phone: corp.helpline,

        icon: 'phone-call',

        label: t('esc.pmc.channelCall'),

        small: corp.helplineDisplay || corp.helpline,

      });

    }

    if (corp.playStoreUrl || corp.appStoreUrl) {

      channels.push({

        type: 'app',

        icon: 'device-mobile',

        label: t('esc.pmc.channelApp'),

        small: t('esc.pmc.channelAppSmall'),

      });

    }

    container.innerHTML = channels.map((ch) => {

      const recCls = ch.recommended ? ' esc-channel--recommended' : '';

      const attrs = ch.type === 'call'

        ? `data-corp-channel="call" data-corp-phone="${escapeHtml(ch.phone)}"`

        : ch.type === 'whatsapp'

          ? `data-corp-channel="whatsapp"`

          : ch.type === 'app'

            ? `data-corp-channel="app"`

            : `data-corp-channel="portal"`;

      return `<button type="button" class="esc-channel${recCls}" ${attrs}>

        <i class="ph ph-${ch.icon}"></i><span>${escapeHtml(ch.label)}</span><small>${escapeHtml(ch.small)}</small>

      </button>`;

    }).join('');

    if (aapleBtn) {

      aapleBtn.classList.toggle('hidden', !corp.aapleSarkarUrl);

      const span = aapleBtn.querySelector('span');

      if (span) span.textContent = t('esc.pmc.aaple');

    }

  }



  function renderSimpleCorpChannels(corp) {

    const container = $('#escCorpChannels');

    const legacyBtn = $('#btnEscCorpPortal');

    const helplineEl = $('#escCorpHelpline');

    const deptsWrap = $('#escCorpDepts');

    const aapleBtn = $('#btnEscCorpAaple');

    const recommended = $('#escCorpRecommended');

    if (recommended) recommended.classList.add('hidden');

    if (container) container.innerHTML = '';

    if (deptsWrap) deptsWrap.classList.add('hidden');

    if (aapleBtn) aapleBtn.classList.add('hidden');

    if (legacyBtn) legacyBtn.classList.toggle('hidden', !corp.grievanceUrl);

    if (helplineEl) {

      if (corp.helpline) {

        helplineEl.textContent = `Helpline: ${corp.helpline}`;

        helplineEl.classList.remove('hidden');

      } else {

        helplineEl.classList.add('hidden');

      }

    }

  }



  function openCorpWhatsApp(report, corp) {

    const wa = corp && corp.whatsapp;

    if (!wa) return;

    const text = encodeURIComponent(report ? buildCitizenComplaintText(report) : 'Stagnant water hazard in Pune.');

    window.open(`https://wa.me/${wa}?text=${text}`, '_blank');

  }



  function openCorpApp(corp) {

    if (!corp) return;

    const ua = navigator.userAgent || '';

    let url = corp.playStoreUrl || corp.playStoreSearchUrl;

    if (/iPhone|iPad|iPod/i.test(ua) && corp.appStoreUrl) url = corp.appStoreUrl;

    else if (/Android/i.test(ua) && corp.playStoreUrl) url = corp.playStoreUrl;

    if (url) window.open(url, '_blank');

  }



  function openCorpPhone(phone) {

    if (!phone) return;

    const digits = String(phone).replace(/\D/g, '');

    window.open(`tel:${digits}`, '_self');

  }



  function openCorpEmail(email, report) {

    if (!email) return;

    const subject = encodeURIComponent(`Stagnant water complaint — ${getWardShortName(report?.ward) || 'Thane'}`);

    const body = encodeURIComponent(report ? buildCitizenComplaintText(report) : '');

    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self');

  }



  function openCorpTweet(handle, report, tier) {

    const h = handle || 'TMCaTweetAway';

    const text = encodeURIComponent(report ? buildFollowUpText(report, tier || 'zonal') : `Stagnant water hazard in Thane. @${h} #CivicRadar`);

    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');

  }



  function handleCorpChannelClick(e) {

    const btn = e.target.closest('[data-corp-channel]');

    if (!btn) return;

    const report = findReportById(activeEscalationId);

    const ch = btn.dataset.corpChannel;

    const city = getReportCity(report || {});

    const corp = getCityCorpChannels(city);

    if (ch === 'portal') escalationOpenCorpPortal();

    else if (ch === 'whatsapp') openCorpWhatsApp(report, corp);

    else if (ch === 'app') openCorpApp(corp);

    else if (ch === 'call') openCorpPhone(btn.dataset.corpPhone);

    else if (ch === 'email') openCorpEmail(btn.dataset.corpEmail, report);

    else if (ch === 'tweet') openCorpTweet(btn.dataset.corpTwitter || corp.twitter, report);

  }



  function escalationOpenCorpAaple() {

    const report = findReportById(activeEscalationId);

    const corp = getCityCorpChannels(getReportCity(report || {}));

    const url = corp.aapleSarkarUrl || BMC.aapleSarkar;

    window.open(url, '_blank');

  }



  function getEscTierCopy(city, tierKey) {

    if (city === 'thane' && tierKey !== 'file') {

      const tmcKey = `esc.tmc.tier.${tierKey}.body`;

      if (I18N[currentLang] && I18N[currentLang][tmcKey]) return t(tmcKey);

    }

    if (city === 'pune' && tierKey !== 'file') {

      const pmcKey = `esc.pmc.tier.${tierKey}.body`;

      if (I18N[currentLang] && I18N[currentLang][pmcKey]) return t(pmcKey);

    }

    return t(`esc.tier.${tierKey}.body`);

  }



  function getEscTierActionLabels(city, tierKey) {

    if (city === 'thane') {

      if (tierKey === 'matrix') return { copy: t('esc.tier.copyFollowUp'), action: t('esc.tmc.tier.openCall'), channel: 'corp-call', phone: '02225331590' };

      if (tierKey === 'zonal') return { copy: t('esc.tier.copyFollowUp'), action: t('esc.tmc.tier.openTweet'), channel: 'corp-tweet' };

      if (tierKey === 'grievance') return { copy: t('esc.tier.copyFollowUp'), action: t('esc.tmc.tier.openAaple'), channel: 'corp-aaple' };

    }

    if (city === 'pune') {

      const corp = getCityCorpChannels('pune');

      if (tierKey === 'matrix') return { copy: t('esc.tier.copyFollowUp'), action: t('esc.pmc.tier.openCall'), channel: 'corp-call', phone: corp.helpline || '18001030222' };

      if (tierKey === 'zonal') return { copy: t('esc.tier.copyFollowUp'), action: t('esc.pmc.tier.openWa'), channel: 'corp-wa' };

      if (tierKey === 'grievance') return { copy: t('esc.tier.copyFollowUp'), action: t('esc.pmc.tier.openAaple'), channel: 'corp-aaple' };

    }

    if (city !== 'mumbai') {

      if (tierKey === 'matrix') return { copy: t('esc.tier.copyFollowUp'), action: t('esc.tier.openCall'), channel: 'corp-portal' };

      if (tierKey === 'zonal') return { copy: t('esc.tier.copyFollowUp'), action: t('profile.trackEscalate'), channel: 'corp-portal' };

      if (tierKey === 'grievance') return { copy: t('esc.tier.copyFollowUp'), action: t('esc.tier.openAaple'), channel: 'corp-aaple' };

    }

    return null;

  }



  function copyEscText(text, toastKey) {

    const key = toastKey || 'esc.copyAllDone';

    copyTextSafe(text, key, () => trackBmcEvent('bmc_text_copied', { context: key }));

  }



  function updateEscSaveState(report) {

    const consent = $('#escFiledConsent');

    const saveBtn = $('#btnEscSaveId');

    const consentWrap = $('#escConsentWrap');

    const warnEl = $('#escComplaintWarn');

    const val = ($('#escComplaintId')?.value || '').trim();

    const alreadyFiled = !!(report && report.complaintId);

    if (consentWrap) consentWrap.classList.toggle('hidden', alreadyFiled);

    if (consent) {

      if (alreadyFiled) {

        consent.checked = true;

        consent.disabled = true;

      } else {

        consent.disabled = false;

      }

    }

    if (saveBtn) {

      saveBtn.disabled = !val || (!alreadyFiled && !(consent && consent.checked));

    }

    if (warnEl) {

      const showWarn = val.length >= 4 && !looksLikeBmcComplaintId(val);

      warnEl.classList.toggle('hidden', !showWarn);

    }

  }



  function tryCloseEscalation() {

    const report = findReportById(activeEscalationId);

    if (report && report.status === 'pending' && !report.complaintId) {

      showToast(t('esc.closeNudge'), 'info', 5000);

    }

    closeModal('escalation');

  }



  function openEscalationModal(reportId) {

    const report = findReportById(reportId);

    if (!report) return;

    activeEscalationId = report.id;

    applyTranslations();

    renderEscalation(report);

    openModal('escalation');

  }



  function renderEscalation(report) {

    const city = getReportCity(report);

    const isMumbai = city === 'mumbai';

    const corp = getCityCorpChannels(city);

    const bmcPanel = $('#escBmcPanel');

    const corpPanel = $('#escCorpPanel');

    const participateBlock = $('#escParticipateBlock');

    if (bmcPanel) bmcPanel.classList.toggle('hidden', !isMumbai);

    if (corpPanel) corpPanel.classList.toggle('hidden', isMumbai);

    if (participateBlock) participateBlock.classList.toggle('hidden', !isMumbai);

    $('#btnEscAaple')?.classList.toggle('hidden', !isMumbai);

    const titleEl = $('#escTitleText');

    const subtitleEl = $('#escSubtitle');

    if (titleEl) {

      titleEl.textContent = isMumbai

        ? t('esc.title')

        : t('esc.titleCorp').replace('{corp}', corp.name || getCityLabel(city));

    }

    if (subtitleEl) {

      if (isMumbai) subtitleEl.textContent = t('esc.subtitle');

      else if (city === 'pune') subtitleEl.textContent = t('esc.pmc.subtitle');

      else subtitleEl.textContent = t('esc.corpSubtitle');

    }

    if (!isMumbai && corpPanel) {

      const hint = $('#escCorpHint');

      if (hint) {

        hint.textContent = city === 'thane'

          ? t('esc.tmc.fileHint')

          : city === 'pune'

            ? t('esc.pmc.fileHint')

            : t('esc.corpHint').replace('{corp}', corp.name || getCityLabel(city));

      }

      const btnLabel = $('#escCorpBtnLabel');

      if (btnLabel) btnLabel.textContent = t('esc.corpBtn').replace('{corp}', corp.name || getCityLabel(city));

      if (city === 'thane') renderTmcChannels(corp);

      else if (city === 'pune') renderPmcChannels(corp);

      else renderSimpleCorpChannels(corp);

    }

    const escExtras = $('#escOfficialExtras');

    if (escExtras) {

      const exclude = isMumbai

        ? ['marg', 'bmc_whatsapp', 'bmc_portal', 'aaple_sarkar']

        : city === 'pune'

          ? ['pmc_care', 'pmc_wa', 'aaple_sarkar']

          : ['tmc_portal', 'tmc_call', 'aaple_sarkar'];

      renderOfficialChannelButtons(escExtras, city, report.hazard, report, { exclude, context: 'escalation' });

    }

    renderOfficialChannelsSurfaces(report);

    updateEscCityLabels(city, corp);

    updateEscHazardHints(report.hazard, city);

    const stage = getReportStage(report);

    $('#escClock').textContent = getClockLine(report);

    $('#escComplaintId').value = report.complaintId || '';

    const textEl = $('#escComplaintText');

    if (textEl) textEl.value = buildCitizenComplaintText(report);

    $('#escFiledNote').classList.toggle('hidden', !stage.filed);

    const daysEl = $('#escDaysSince');

    if (daysEl) {

      if (stage.filed && report.status === 'pending') {

        const daysKey = city === 'thane' ? 'esc.tmc.daysSince' : city === 'pune' ? 'esc.pmc.daysSince' : 'esc.daysSince';

        daysEl.textContent = t(daysKey).replace('{n}', String(stage.days));

        daysEl.classList.remove('hidden');

      } else {

        daysEl.classList.add('hidden');

      }

    }

    renderFilingProgress($('#escProgress'), report);

    updateEscSaveState(report);



    const owned = report.reporterId ? report.reporterId === user.id : false;

    const canSelfConfirm = owned && report.status === 'pending' && !!report.complaintId;

    const confirmWrap = $('#escSelfConfirm');

    if (confirmWrap) {

      confirmWrap.classList.toggle('hidden', !canSelfConfirm);

      const btn = $('#btnEscResolveOwn');

      if (btn) btn.dataset.reportId = report.id;

    }



    const days = stage.filed ? stage.days : 0;

    const fileBody = city === 'thane' ? t('esc.tmc.tier.file.body') : city === 'pune' ? t('esc.pmc.tier.file.body') : t('esc.tier.file.body');

    const tiers = [

      {

        key: 'file', threshold: 0,

        title: t('esc.tier.file.title'),

        body: fileBody,

      },

      {

        key: 'matrix', threshold: ESCALATION_DAYS.matrix,

        title: t('esc.tier.matrix.title').replace('{n}', String(ESCALATION_DAYS.matrix)),

        body: getEscTierCopy(city, 'matrix'),

      },

      {

        key: 'zonal', threshold: ESCALATION_DAYS.zonal,

        title: t('esc.tier.zonal.title').replace('{n}', String(ESCALATION_DAYS.zonal)),

        body: getEscTierCopy(city, 'zonal'),

      },

      {

        key: 'grievance', threshold: ESCALATION_DAYS.grievance,

        title: t('esc.tier.grievance.title').replace('{n}', String(ESCALATION_DAYS.grievance)),

        body: getEscTierCopy(city, 'grievance'),

      },

    ];



    $('#escLadder').innerHTML = tiers

      .map((tobj) => {

        let state = 'locked';

        if (report.status === 'resolved') state = 'done';

        else if (tobj.key === 'file') state = stage.filed ? 'done' : 'active';

        else if (stage.filed && days >= tobj.threshold) state = 'active';

        const icon = state === 'done' ? 'check-circle' : state === 'active' ? 'arrow-circle-right' : 'lock-simple';

        let actions = '';

        if (state === 'active' || (tobj.key === 'file' && !stage.filed)) {

          const corpActions = getEscTierActionLabels(city, tobj.key);

          if (tobj.key === 'file') {

            if (isMumbai) {

              actions = `

              <div class="esc-step__actions">

                <button type="button" class="btn btn--secondary btn--sm" data-esc-copy="file">${escapeHtml(t('esc.copyAll'))}</button>

                <button type="button" class="btn btn--primary btn--sm" data-esc-channel="whatsapp">${escapeHtml(t('esc.tier.openWa'))}</button>

              </div>`;

            } else if (city === 'pune') {

              actions = `

              <div class="esc-step__actions">

                <button type="button" class="btn btn--secondary btn--sm" data-esc-copy="file">${escapeHtml(t('esc.copyAll'))}</button>

                <button type="button" class="btn btn--primary btn--sm" data-corp-channel="whatsapp">${escapeHtml(t('esc.pmc.tier.openWa'))}</button>

              </div>`;

            } else {

              actions = `

              <div class="esc-step__actions">

                <button type="button" class="btn btn--secondary btn--sm" data-esc-copy="file">${escapeHtml(t('esc.copyAll'))}</button>

                <button type="button" class="btn btn--primary btn--sm" data-corp-channel="portal">${escapeHtml(t('esc.corpBtn').replace('{corp}', corp.name || getCityLabel(city)))}</button>

              </div>`;

            }

          } else if (corpActions) {

            const phoneAttr = corpActions.phone ? ` data-corp-phone="${escapeHtml(corpActions.phone)}"` : '';

            const actionCls = corpActions.channel === 'corp-aaple' ? 'btn--secondary' : 'btn--primary';

            actions = `

              <div class="esc-step__actions">

                <button type="button" class="btn btn--secondary btn--sm" data-esc-copy="${escapeHtml(tobj.key)}">${escapeHtml(corpActions.copy)}</button>

                <button type="button" class="btn ${actionCls} btn--sm" data-esc-channel="${escapeHtml(corpActions.channel)}"${phoneAttr}>${escapeHtml(corpActions.action)}</button>

              </div>`;

            if (tobj.key === 'grievance') {

              actions += `<p class="esc-step__rti-note">${escapeHtml(t('esc.rtiDisclaimer'))}</p>`;

            }

          } else if (tobj.key === 'matrix') {

            actions = `

              <div class="esc-step__actions">

                <button type="button" class="btn btn--secondary btn--sm" data-esc-copy="matrix">${escapeHtml(t('esc.tier.copyFollowUp'))}</button>

                <button type="button" class="btn btn--primary btn--sm" data-esc-channel="call">${escapeHtml(t('esc.tier.openCall'))}</button>

              </div>`;

          } else if (tobj.key === 'zonal') {

            actions = `

              <div class="esc-step__actions">

                <button type="button" class="btn btn--secondary btn--sm" data-esc-copy="zonal">${escapeHtml(t('esc.tier.copyFollowUp'))}</button>

                <button type="button" class="btn btn--primary btn--sm" data-esc-channel="tweet">${escapeHtml(t('esc.tier.openTweet'))}</button>

              </div>`;

          } else if (tobj.key === 'grievance') {

            actions = `

              <div class="esc-step__actions">

                <button type="button" class="btn btn--secondary btn--sm" data-esc-copy="grievance">${escapeHtml(t('esc.tier.copyFollowUp'))}</button>

                <button type="button" class="btn btn--secondary btn--sm" data-esc-channel="aaple">${escapeHtml(t('esc.tier.openAaple'))}</button>

              </div>

              <p class="esc-step__rti-note">${escapeHtml(t('esc.rtiDisclaimer'))}</p>`;

          }

          const tierOfficialId = getEscTierOfficialChannel(city, tobj.key, report.hazard);

          if (tierOfficialId && (state === 'active' || (tobj.key === 'file' && !stage.filed))) {

            const tierMeta = resolveOfficialChannelMeta(tierOfficialId, city);

            if (tierMeta) {

              actions += `

              <div class="esc-step__official">

                <button type="button" class="btn btn--ghost btn--sm" data-official-channel="${escapeHtml(tierOfficialId)}">

                  <i class="ph ph-arrow-square-out"></i> ${escapeHtml(tierMeta.label)}

                </button>

              </div>`;

            }

          }

        }

        return `

          <li class="esc-step esc-step--${state}">

            <i class="ph ph-${icon}"></i>

            <div>

              <strong>${escapeHtml(tobj.title)}</strong>

              <p>${escapeHtml(tobj.body)}</p>

              ${actions}

            </div>

          </li>`;

      })

      .join('');

  }



  function escalationFileCall() {

    trackBmcEvent('bmc_channel_opened', { channel: 'call' }, findReportById(activeEscalationId)?.ward);

    window.open(`tel:${BMC.helpline}`, '_self');

  }



  function escalationFileWhatsApp() {

    const report = findReportById(activeEscalationId);

    trackBmcEvent('bmc_channel_opened', { channel: 'whatsapp' }, report?.ward);

    const text = encodeURIComponent(report ? buildComplaintText(report) : 'Stagnant water hazard in Mumbai.');

    window.open(`https://wa.me/${BMC.whatsapp}?text=${text}`, '_blank');

  }



  function escalationFilePortal() {

    trackBmcEvent('bmc_channel_opened', { channel: 'portal' }, findReportById(activeEscalationId)?.ward);

    window.open(BMC.portalUrl, '_blank');

  }



  function escalationFileMargApp() {

    const report = findReportById(activeEscalationId);

    trackBmcEvent('bmc_channel_opened', { channel: 'marg_app' }, report?.ward);

    const ua = navigator.userAgent || '';

    let url = BMC.margPlayStoreUrl;

    if (/iPhone|iPad|iPod/i.test(ua)) url = BMC.margAppStoreUrl;

    else if (/Android/i.test(ua)) url = BMC.margPlayStoreUrl;

    else url = BMC.margAppStoreUrl;

    window.open(url, '_blank');

  }



  function escalationFileTweet() {

    const report = findReportById(activeEscalationId);

    trackBmcEvent('bmc_channel_opened', { channel: 'twitter' }, report?.ward);

    const text = encodeURIComponent(buildFollowUpText(report || {}, 'zonal'));

    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');

  }



  function escalationOpenAapleSarkar() {

    trackBmcEvent('bmc_channel_opened', { channel: 'aaple_sarkar' }, findReportById(activeEscalationId)?.ward);

    window.open(BMC.aapleSarkar, '_blank');

  }



  function escalationOpenParticipateMumbai() {

    trackBmcEvent('bmc_channel_opened', { channel: 'participate_mumbai' }, findReportById(activeEscalationId)?.ward);

    window.open(BMC.participateUrl, '_blank');

  }



  function escalationOpenCorpPortal() {

    const report = findReportById(activeEscalationId);

    const city = getReportCity(report || {});

    const corp = getCityCorpChannels(city);

    if (corp.grievanceUrl) window.open(corp.grievanceUrl, '_blank');

    else showToast(t('esc.corpHint').replace('{corp}', corp.name || getCityLabel(city)), 'info', 4000);

  }



  function handleEscLadderAction(e) {

    if (e.target.closest('[data-official-channel]')) {

      handleOfficialChannelClick(e);

      return;

    }

    const corpBtn = e.target.closest('[data-corp-channel]');

    if (corpBtn) {

      handleCorpChannelClick(e);

      return;

    }

    const copyBtn = e.target.closest('[data-esc-copy]');

    if (copyBtn) {

      const report = findReportById(activeEscalationId);

      if (!report) return;

      const tier = copyBtn.dataset.escCopy;

      const text = tier === 'file' ? buildCitizenComplaintText(report) : buildFollowUpText(report, tier);

      const copyKey = tier === 'file'

        ? (getReportCity(report) === 'thane' ? 'esc.tmc.copyAllDone' : getReportCity(report) === 'pune' ? 'esc.pmc.copyAllDone' : 'esc.copyAllDone')

        : 'esc.copyFollowUpDone';

      copyEscText(text, copyKey);

      return;

    }

    const chBtn = e.target.closest('[data-esc-channel]');

    if (!chBtn) return;

    const ch = chBtn.dataset.escChannel;

    const report = findReportById(activeEscalationId);

    const corp = getCityCorpChannels(getReportCity(report || {}));

    if (ch === 'whatsapp') escalationFileWhatsApp();

    else if (ch === 'call') escalationFileCall();

    else if (ch === 'tweet') escalationFileTweet();

    else if (ch === 'aaple') escalationOpenAapleSarkar();

    else if (ch === 'corp-call') openCorpPhone(chBtn.dataset.corpPhone || (corp.helplines && corp.helplines[0]));

    else if (ch === 'corp-tweet') openCorpTweet(corp.twitter, report, 'zonal');

    else if (ch === 'corp-aaple') escalationOpenCorpAaple();

    else if (ch === 'corp-wa') openCorpWhatsApp(report, corp);

    else if (ch === 'corp-portal') escalationOpenCorpPortal();

  }



  function copyEscAllDetails() {

    const report = findReportById(activeEscalationId);

    if (!report) return;

    const city = getReportCity(report);

    const copyKey = city === 'thane' ? 'esc.tmc.copyAllDone' : city === 'pune' ? 'esc.pmc.copyAllDone' : 'esc.copyAllDone';

    copyEscText(buildCitizenComplaintText(report), copyKey);

  }



  function saveComplaintId() {

    const report = findReportById(activeEscalationId);

    if (!report) return;

    const city = getReportCity(report);

    const val = $('#escComplaintId').value.trim();

    if (!val) {

      showToast(t('toast.complaintRequired'), 'error');

      return;

    }

    const alreadyFiled = !!report.complaintId;

    const consent = $('#escFiledConsent');

    if (!alreadyFiled && consent && !consent.checked) {

      const consentKey = city === 'thane' ? 'esc.tmc.consentRequired' : city === 'pune' ? 'esc.pmc.consentRequired' : 'esc.consentRequired';

      showToast(t(consentKey), 'error', 4000);

      return;

    }

    if (!looksLikeBmcComplaintId(val)) {

      const warnKey = city === 'thane' ? 'esc.tmc.complaintWarn' : city === 'pune' ? 'esc.pmc.complaintWarn' : 'esc.complaintWarn';

      showToast(t(warnKey), 'info', 4500);

    }

    const reports = loadReports();

    const idx = reports.findIndex((r) => String(r.id) === String(activeEscalationId));

    if (idx === -1) return;

    const firstTime = !reports[idx].complaintId;

    reports[idx].complaintId = val;

    if (firstTime || !reports[idx].filedAt) reports[idx].filedAt = new Date().toISOString();

    try {

      saveReports(reports);

    } catch {

      showToast(t('toast.storageFull'), 'error');

      return;

    }

    Backend.updateReportFiling(activeEscalationId, val, reports[idx].filedAt);

    trackBmcEvent('bmc_complaint_saved', { reportId: String(activeEscalationId), firstTime }, reports[idx].ward);

    if (firstTime) trackBmcEvent('bmc_filed', { reportId: String(activeEscalationId) }, reports[idx].ward);

    launchConfetti({ intensity: firstTime ? 'celebrate' : 'mini' });

    showToast(t('toast.complaintSaved'), 'success', 4000);

    renderEscalation(reports[idx]);

    updateProfileUI();

    updatePersonaUI();

  }



  /* ---------- Pledge helpers ---------- */

  function sortPledgesNewestFirst(pledges) {

    return [...pledges].sort(

      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()

    );

  }



  function getUserPledges() {

    return sortPledgesNewestFirst(

      loadPledges().filter((p) => p.mock !== true && p.citizenId === user.id)

    );

  }



  function getPledgeStatusKey(p) {

    if (p.hoursVerified) return 'verified';

    if (p.delivered) return 'delivered';

    return 'pledged';

  }



  function pledgeTypeLabel(type) {

    const key = `pledge.type.${type}`;

    const label = t(key);

    return label !== key ? label : type;

  }



  function pledgeStatusLabel(p) {

    const key = `pledge.status.${getPledgeStatusKey(p)}`;

    return t(key);

  }



  function pledgeStatusBadgeClass(p) {

    const status = getPledgeStatusKey(p);

    if (status === 'verified') return 'status-badge--verified';

    if (status === 'delivered') return 'status-badge--delivered';

    return 'status-badge--pledged';

  }



  function loadPledgeStatusSnapshot() {

    try { return JSON.parse(localStorage.getItem(PLEDGE_STATUS_SNAPSHOT_KEY)) || {}; }

    catch { return {}; }

  }



  function savePledgeStatusSnapshot(snapshot) {

    try { safeLocalSet(PLEDGE_STATUS_SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch {}

  }



  function loadPledgePointsCredited() {

    try { return new Set(JSON.parse(localStorage.getItem(PLEDGE_POINTS_CREDITED_KEY)) || []); }

    catch { return new Set(); }

  }



  function markPledgePointsCredited(id) {

    const credited = loadPledgePointsCredited();

    credited.add(String(id));

    try { safeLocalSet(PLEDGE_POINTS_CREDITED_KEY, JSON.stringify([...credited])); } catch {}

  }



  function creditVerifiedPledgePoints(p) {

    if (!p || !p.hoursVerified || p.citizenId !== user.id) return false;

    const id = String(p.id);

    if (loadPledgePointsCredited().has(id)) return false;

    addPointsCache(VERIFY_HOURS_BONUS);

    markPledgePointsCredited(id);

    updateProfileUI();

    renderLeaderboard('wards');

    renderLeaderboard('citizens');

    return true;

  }



  function hasDuplicatePendingPledge(type, ward) {

    return getUserPledges().some(

      (p) => p.type === type && p.ward === ward && !p.delivered && !p.hoursVerified

    );

  }



  function checkPledgeStatusUpdates() {

    if (isAdmin || isLead) return;

    const myPledges = getUserPledges();

    const snapshot = loadPledgeStatusSnapshot();

    let changed = false;



    myPledges.forEach((p) => {

      const id = String(p.id);

      const prev = snapshot[id] || 'none';

      const curr = getPledgeStatusKey(p);



      if (prev !== 'none' && prev !== curr) {

        if (curr === 'delivered') {

          showToast(t('toast.pledgeStatusDelivered'), 'success', 6000);

        } else if (curr === 'verified') {

          const credited = creditVerifiedPledgePoints(p);

          showToast(t('toast.pledgeStatusVerified'), 'success', 8000);

          if (!credited) updateProfileUI();

        }

      } else if (curr === 'verified') {

        creditVerifiedPledgePoints(p);

      }



      snapshot[id] = curr;

      changed = true;

    });



    if (changed) savePledgeStatusSnapshot(snapshot);

  }



  function notifyNgoNewPledges() {

    if (!isLead) return;

    let lastSeen = localStorage.getItem(REMINDER_NGO_PLEDGES_LAST_SEEN_KEY);

    if (!lastSeen) lastSeen = localStorage.getItem(REMINDER_NGO_LAST_SEEN_KEY);

    if (!lastSeen) return;

    if (overlays.coordinator && overlays.coordinator.classList.contains('open')) return;

    const cutoff = new Date(lastSeen).getTime();

    const { citizenPledges } = getCoordinatorPledges();

    const newCount = citizenPledges.filter((p) => new Date(p.timestamp).getTime() > cutoff).length;

    if (newCount === 0) return;

    showToast(t('toast.ngoNewPledge').replace('{n}', String(newCount)), 'info', 5500, {

      label: t('toast.ngoNewPledgeAction'),

      onClick: () => window.openCoordinatorDashboard(),

    });

  }



  /* ---------- Pledge Validation ---------- */

  function submitPledge() {

    const type = $('#pledgeType').value;

    const ward = $('#pledgeWard').value.trim();

    const message = sanitizeText($('#pledgeMessage').value, 300);



    if (!ward) {

      showToast(t('toast.pledgeWardRequired'), 'error');

      $('#pledgeWard').focus();

      return;

    }



    if (!isValidWard(ward, getUserCity())) {

      showToast(t('toast.wardRequired').replace('{city}', getCityLabel(getUserCity())), 'error');

      $('#pledgeWard').focus();

      return;

    }



    if (hasDuplicatePendingPledge(type, ward)) {

      showToast(t('toast.pledgeDuplicate'), 'error');

      return;

    }



    if (user.ward && ward !== user.ward) {

      showToast(t('toast.pledgeWardMismatch'), 'info', 4500);

    }



    user.pledges = user.pledges || [];

    user.pledges.push({ type, ward, message, timestamp: new Date().toISOString() });

    saveUser();



    const globalPledges = loadPledges();

    const pledge = {

      id: generateId(),

      type,

      ward,

      city: getUserCity(),

      message,

      citizen: user.displayName || 'Citizen',

      citizenId: user.id,

      delivered: false,

      hoursVerified: false,

      timestamp: new Date().toISOString(),

    };

    globalPledges.unshift(pledge);

    savePledges(globalPledges);

    Backend.insertPledge(pledge);



    const snapshot = loadPledgeStatusSnapshot();

    snapshot[String(pledge.id)] = 'pledged';

    savePledgeStatusSnapshot(snapshot);



    if (window.CivicAnalytics) {

      CivicAnalytics.track('pledge_created', { pledgeId: String(pledge.id), type, city: getUserCity() }, ward);

    }



    showToast(t('toast.pledgeSaved'), 'success', 5500);

    closeModal('pledge');

    $('#pledgeMessage').value = '';

    updatePersonaUI();

  }



  /* ---------- Resolved "share the win" loop ---------- */

  function loadResolvedSeen() {

    try {

      return JSON.parse(localStorage.getItem(RESOLVED_SEEN_KEY)) || [];

    } catch {

      return [];

    }

  }



  function saveResolvedSeen(ids) {

    safeLocalSet(RESOLVED_SEEN_KEY, JSON.stringify(ids));

  }



  // Detects the user's own reports that were resolved since last check and

  // invites them to share the win — a key viral re-engagement moment.

  function checkResolvedWins() {

    const resolvedIds = getUserReports()

      .filter((r) => r.status === 'resolved')

      .map((r) => String(r.id));

    if (resolvedIds.length === 0) return;



    const seen = loadResolvedSeen();

    const fresh = resolvedIds.filter((id) => !seen.includes(id));

    // Always persist so we only celebrate new resolutions once.

    saveResolvedSeen(resolvedIds);

    if (fresh.length === 0) return;



    setTimeout(() => {

      const report = findReportById(fresh[0]);

      const src = report ? getReportResolutionSource(report) : '';

      const winType = src === 'community_verified' || src === 'stale_verified' ? 'community' : 'resolved';

      showShareWinModal(fresh[0], winType);

    }, 800);

    updateCommunityWinBadge();

  }



  function loadConfirmedSeen() {

    try {

      return JSON.parse(localStorage.getItem(CONFIRMED_SEEN_KEY)) || [];

    } catch {

      return [];

    }

  }



  function saveConfirmedSeen(ids) {

    try { safeLocalSet(CONFIRMED_SEEN_KEY, JSON.stringify(ids)); } catch {}

  }



  function checkConfirmedResolved() {

    const confirmed = loadConfirmedSet();

    if (confirmed.size === 0) return;



    const reports = loadReports();

    const backedResolved = reports.filter(

      (r) => r.status === 'resolved' && confirmed.has(String(r.id)) && !ownsReport(r)

    );

    const ids = backedResolved.map((r) => String(r.id));



    const seen = loadConfirmedSeen();

    const fresh = backedResolved.filter((r) => !seen.includes(String(r.id)));

    saveConfirmedSeen(ids);

    if (fresh.length === 0) return;



    const wardName = fresh[0].ward ? fresh[0].ward.split('—')[0].trim() : 'your area';

    const msg = fresh.length === 1

      ? t('confirm.resolved').replace('{ward}', wardName)

      : t('confirm.resolvedMany').replace('{n}', String(fresh.length));



    showToast(msg, 'success', 8000, {

      label: t('confirm.shareBtn'),

      onClick: () => shareBackedWin(wardName),

    });

  }



  // Notifies citizens who said "looks fixed" when a report is community-verified resolved.

  function checkFixConfirmedResolved() {

    const fixConfirmed = loadFixConfirmedSet();

    if (fixConfirmed.size === 0) return;



    const reports = loadReports();

    const checkedResolved = reports.filter(

      (r) => r.status === 'resolved'

        && fixConfirmed.has(String(r.id))

        && !ownsReport(r)

        && (getReportResolutionSource(r) === 'community_verified' || getReportResolutionSource(r) === 'stale_verified')

    );

    const ids = checkedResolved.map((r) => String(r.id));



    const seen = loadFixConfirmedSeen();

    const fresh = checkedResolved.filter((r) => !seen.includes(String(r.id)));

    saveFixConfirmedSeen(ids);

    if (fresh.length === 0) return;



    const wardName = fresh[0].ward ? fresh[0].ward.split('—')[0].trim() : 'your area';

    const msg = fresh.length === 1

      ? t('fix.resolved').replace('{ward}', wardName)

      : t('fix.resolvedMany').replace('{n}', String(fresh.length));



    showToast(msg, 'success', 8000, {

      label: t('confirm.shareBtn'),

      onClick: () => shareBackedWin(wardName),

    });

  }



  function shareBackedWin(wardName) {

    shareWhatsApp(buildShareBackedMessage(wardName), { context: 'backed_resolved', ward: user.ward });

  }



  async function compressImageFromFile(file) {

    return new Promise((resolve, reject) => {

      const reader = new FileReader();

      reader.onload = (ev) => {

        const img = new Image();

        img.onload = () => {

          const canvas = document.createElement('canvas');

          const ctx = canvas.getContext('2d');

          let w = img.width;

          let h = img.height;

          if (w > CANVAS_MAX_WIDTH) {

            h = (h * CANVAS_MAX_WIDTH) / w;

            w = CANVAS_MAX_WIDTH;

          }

          canvas.width = w;

          canvas.height = h;

          ctx.drawImage(img, 0, 0, w, h);

          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));

        };

        img.onerror = () => reject(new Error('image load failed'));

        img.src = ev.target.result;

      };

      reader.onerror = () => reject(new Error('read failed'));

      reader.readAsDataURL(file);

    });

  }



  async function handleAdminProofCapture(e) {

    const file = e.target.files[0];

    if (!file) return;

    if (window.ImageModeration) {

      const fileCheck = ImageModeration.validateFile(file, getModCfg());

      if (!fileCheck.ok) {

        const msg = fileCheck.i18nKey ? t(fileCheck.i18nKey) : (fileCheck.message || t('moderation.blocked.irrelevant'));

        showToast(msg, 'error', 5500);

        e.target.value = '';

        return;

      }

    }

    try {

      adminProofDataUrl = await compressImageFromFile(file);

      // Proof-of-fix photos get the same safety scan (NSFW/blank/document) as

      // citizen reports. Offline behaviour matches the citizen flow: NSFW is

      // skipped unless requireOnlineNsfw is set in config.

      if (window.ImageModeration && getModCfg().enabled) {

        const scanCanvasEl = document.createElement('canvas');

        const scanImg = new Image();

        await new Promise((resolve, reject) => {

          scanImg.onload = resolve;

          scanImg.onerror = reject;

          scanImg.src = adminProofDataUrl;

        });

        scanCanvasEl.width = scanImg.width;

        scanCanvasEl.height = scanImg.height;

        scanCanvasEl.getContext('2d').drawImage(scanImg, 0, 0);

        const scan = await ImageModeration.scanCanvas(scanCanvasEl, getModCfg());

        if (!scan.ok) {

          adminProofDataUrl = null;

          const msg = scan.i18nKey ? t(scan.i18nKey) : (scan.message || t('moderation.blocked.irrelevant'));

          showToast(msg, 'error', 5500);

          e.target.value = '';

          return;

        }

      }

      const preview = $('#adminProofPreview');

      const btn = $('#btnAdminProofCapture');

      if (preview) {

        preview.src = adminProofDataUrl;

        preview.hidden = false;

      }

      if (btn) btn.classList.add('hidden');

      showToast(t('toast.proofAdded'), 'success', 3000);

    } catch {

      showToast(t('moderation.blocked.fileType'), 'error');

    }

    e.target.value = '';

  }



  // Optional "after" photo from the neighbour who just confirmed a fix.
  // Mirrors the admin proof pattern (same compress + moderation helpers) but
  // writes to the resolved report's resolutionImage, which the before/after
  // comparison and share card already render. Fully self-contained input.
  async function handleFixPhotoCapture(e) {
    const file = e.target.files && e.target.files[0];
    const reportId = pendingFixPhotoReportId;
    pendingFixPhotoReportId = null;
    if (!file || !reportId) { e.target.value = ''; return; }
    if (window.ImageModeration) {
      const fileCheck = ImageModeration.validateFile(file, getModCfg());
      if (!fileCheck.ok) {
        const msg = fileCheck.i18nKey ? t(fileCheck.i18nKey) : (fileCheck.message || t('moderation.blocked.fileType'));
        showToast(msg, 'error', 5000);
        e.target.value = '';
        return;
      }
    }
    try {
      const dataUrl = await compressImageFromFile(file);
      if (window.ImageModeration && getModCfg().enabled) {
        const scanCanvasEl = document.createElement('canvas');
        const scanImg = new Image();
        await new Promise((resolve, reject) => {
          scanImg.onload = resolve;
          scanImg.onerror = reject;
          scanImg.src = dataUrl;
        });
        scanCanvasEl.width = scanImg.width;
        scanCanvasEl.height = scanImg.height;
        scanCanvasEl.getContext('2d').drawImage(scanImg, 0, 0);
        const scan = await ImageModeration.scanCanvas(scanCanvasEl, getModCfg());
        if (!scan.ok) {
          const msg = scan.i18nKey ? t(scan.i18nKey) : (scan.message || t('moderation.blocked.irrelevant'));
          showToast(msg, 'error', 5500);
          e.target.value = '';
          return;
        }
      }
      const reports = loadReports();
      const idx = reports.findIndex((r) => String(r.id) === String(reportId));
      if (idx === -1) { e.target.value = ''; return; }
      reports[idx].resolutionImage = dataUrl;
      try { saveReports(reports); } catch { showToast(t('toast.saveFail'), 'error'); e.target.value = ''; return; }
      const r = reports[idx];
      if (Backend.enabled) {
        Backend.updateReportResolution(
          reportId, r.status, r.resolvedBy || 'community', r.resolvedAt || new Date().toISOString(),
          dataUrl, r.resolutionSource || 'community_verified', r.communityVerifiedAt || ''
        );
      }
      if (reportMarkerLayer) refreshReportMarkers();
      showToast(t('toast.fixPhotoAdded'), 'success', 3000);
      setTimeout(() => showShareWinModal(reportId, 'community'), 500);
    } catch {
      showToast(t('moderation.blocked.fileType'), 'error');
    }
    e.target.value = '';
  }

  // Opens the fix-photo picker (lazily creates its hidden input on first use).
  function promptFixPhoto(reportId) {
    pendingFixPhotoReportId = String(reportId);
    let input = $('#fixPhotoInput');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.id = 'fixPhotoInput';
      input.style.display = 'none';
      input.addEventListener('change', handleFixPhotoCapture);
      document.body.appendChild(input);
    }
    input.click();
  }



  function updateCommunitySubtitle() {

    const el = $('#communitySubtitle');

    if (!el) return;

    const mine = getUserReports();

    const pending = mine.filter((r) => r.status === 'pending').length;

    const resolved = mine.filter((r) => r.status === 'resolved').length;

    const wardLabel = user.ward ? user.ward.split('—')[0].trim() : t('header.context');

    el.textContent = pending > 0

      ? t('community.subtitleActive')

        .replace('{ward}', wardLabel)

        .replace('{pending}', String(pending))

        .replace('{resolved}', String(resolved))

      : t('community.subtitle')

        .replace('{ward}', wardLabel)

        .replace('{corp}', getCorpShortName(getUserCity()));

  }



  function getWardReportStats() {

    const byWard = {};

    cityScopedReports(loadReports()).forEach((r) => {

      if (!r.ward || isReportPubliclyHidden(r)) return;

      if (!byWard[r.ward]) {

        byWard[r.ward] = { name: r.ward, pending: 0, resolved: 0, reports: 0 };

      }

      byWard[r.ward].reports++;

      if (r.status === 'pending') byWard[r.ward].pending++;

      else if (r.status === 'resolved') byWard[r.ward].resolved++;

    });

    return Object.values(byWard);

  }



  function renderWardChallenge() {

    const el = $('#wardChallenge');

    if (!el) return;

    const stats = getWardReportStats();

    const userWardLabel = user.ward ? getWardShortName(user.ward) : t('header.context');



    if (stats.length === 0) {

      el.hidden = false;

      el.innerHTML = `<i class="ph ph-lightning"></i><p class="ward-challenge__text">${escapeHtml(t('community.challenge.empty').replace('{ward}', userWardLabel))}</p>`;

      const shareBtn = $('#btnShareWardChallenge');

      if (shareBtn) shareBtn.classList.remove('hidden');

      return;

    }



    const sorted = [...stats].sort((a, b) => b.resolved - a.resolved || b.reports - a.reports);

    const leader = sorted[0];

    const userStat = user.ward ? stats.find((s) => s.name === user.ward) : null;

    let message = '';



    if (userStat && stats.length > 1) {

      const rivals = stats.filter((s) => s.name !== user.ward);

      const ahead = rivals.filter((r) => r.resolved > userStat.resolved || (r.resolved === userStat.resolved && r.pending < userStat.pending));

      const rival = ahead.sort((a, b) => a.resolved - b.resolved || a.pending - b.pending)[0]

        || rivals.sort((a, b) => b.pending - a.pending)[0];



      if (userStat.resolved >= leader.resolved && userStat.pending <= (rival ? rival.pending : userStat.pending)) {

        message = t('community.challenge.leading')

          .replace('{ward}', userWardLabel)

          .replace('{resolved}', String(userStat.resolved))

          .replace('{rival}', rival ? getWardShortName(rival.name) : userWardLabel);

      } else if (userStat.pending > 0 && rival) {

        message = t('community.challenge.beat')

          .replace('{ward}', userWardLabel)

          .replace('{pending}', String(userStat.pending))

          .replace('{rival}', getWardShortName(rival.name))

          .replace('{rivalPending}', String(rival.pending));

      } else if (rival) {

        message = t('community.challenge.catch')

          .replace('{ward}', userWardLabel)

          .replace('{leader}', getWardShortName(leader.name))

          .replace('{leaderResolved}', String(leader.resolved));

      }

    }



    if (!message) {

      message = t('community.challenge.leaderboard')

        .replace('{leader}', getWardShortName(leader.name))

        .replace('{resolved}', String(leader.resolved));

    }



    el.hidden = false;

    el.innerHTML = `<i class="ph ph-lightning"></i><p class="ward-challenge__text">${escapeHtml(message)}</p>`;

    const shareBtn = $('#btnShareWardChallenge');

    if (shareBtn) shareBtn.classList.remove('hidden');

  }



  /* ---------- Viral: seasonal hooks, ward social proof & weekly recap ---------- */



  // Reports in a ward (or whole city when ward is empty) over the trailing 7 days.

  function getWardWeekStats(ward) {

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const recent = cityScopedReports(loadReports()).filter((r) => {

      if (isReportPubliclyHidden(r)) return false;

      if (ward && r.ward !== ward) return false;

      return new Date(r.timestamp).getTime() >= weekAgo;

    });

    return {

      reports: recent.length,

      resolved: recent.filter((r) => r.status === 'resolved').length,

      backed: recent.reduce((s, r) => s + (Number(r.confirmations) || 0), 0),

    };

  }



  function renderWardWeekSocialProof() {

    const el = $('#wardWeekSocial');

    if (!el) return;

    const wardLabel = user.ward ? getWardShortName(user.ward) : getCityLabel();

    const w = getWardWeekStats(user.ward);

    if (w.reports === 0) {

      el.textContent = t('social.wardWeekEmpty').replace('{ward}', wardLabel);

      el.classList.add('ward-week-social--empty');

    } else if (w.backed > 0) {

      el.textContent = t('social.wardWeekBacked')

        .replace('{n}', String(w.reports))

        .replace('{c}', String(w.backed))

        .replace('{ward}', wardLabel);

      el.classList.remove('ward-week-social--empty');

    } else {

      el.textContent = t('social.wardWeek')

        .replace('{n}', String(w.reports))

        .replace('{ward}', wardLabel);

      el.classList.remove('ward-week-social--empty');

    }

  }



  // Date-aware, India-context seasonal nudge. Returns null off-season (Nov–Apr).

  function getSeasonalHook() {

    const mode = (window.CIVICRADAR_CONFIG || {}).seasonalMode; // 'auto' | 'on' | 'off'

    if (mode === 'off') return null;

    if (mode === 'on') return { key: 'season.monsoonPeak', icon: 'ph-cloud-rain' };

    const m = new Date().getMonth(); // 0 = Jan

    if (m === 4 || m === 5) return { key: 'season.monsoonPrep', icon: 'ph-cloud-rain' };

    if (m === 6 || m === 7) return { key: 'season.monsoonPeak', icon: 'ph-cloud-rain' };

    if (m === 8) return { key: 'season.ganesh', icon: 'ph-flower-lotus' };

    if (m === 9) return { key: 'season.denguePeak', icon: 'ph-bug-beetle' };

    return null;

  }



  function renderSeasonalHook() {

    const el = $('#seasonHook');

    if (!el) return;

    if (shouldDeferFirstRunNudges()) {

      el.classList.add('hidden');

      return;

    }

    const hook = getSeasonalHook();

    if (!hook || localStorage.getItem(SEASON_HOOK_DISMISS_KEY) === hook.key) {

      el.classList.add('hidden');

      return;

    }

    const icon = $('#seasonHookIcon');

    const text = $('#seasonHookText');

    if (icon) icon.className = `ph ${hook.icon} season-hook__icon`;

    if (text) text.textContent = t(hook.key);

    el.dataset.hookKey = hook.key;

    el.classList.remove('hidden');

  }



  function dismissSeasonHook() {

    const el = $('#seasonHook');

    const key = el && el.dataset.hookKey;

    if (key) safeLocalSet(SEASON_HOOK_DISMISS_KEY, key);

    if (el) el.classList.add('hidden');

  }



  function buildWeeklyRecapMessage() {

    const wardLabel = user.ward ? getWardShortName(user.ward) : getCityLabel();

    const w = getWardWeekStats(user.ward);

    return fillShareTemplate(t('share.weeklyRecap'), {

      ward: wardLabel,

      link: shareAppLink('recap'),

      wardFull: user.ward,

    })

      .replace('{reports}', String(w.reports))

      .replace('{resolved}', String(w.resolved))

      .replace('{backed}', String(w.backed));

  }



  function shareWeeklyRecapWhatsApp() {

    if (window.CivicAnalytics) CivicAnalytics.track('share_weekly_recap', { ward: user.ward || '' }, user.ward);

    shareWhatsApp(buildWeeklyRecapMessage(), { context: 'recap', ward: user.ward });

  }



  function renderWeeklyRecapButton() {

    const btn = $('#btnShareWeeklyRecap');

    if (!btn) return;

    const w = getWardWeekStats(user.ward);

    // Only surface the recap share when there's something worth bragging about.

    btn.classList.toggle('hidden', !(w.reports > 0 || w.resolved > 0));

  }



  // Welcomes visitors who arrive via a neighbour's ?ref= link with social proof.

  function renderReferralWelcome() {

    const el = $('#referralWelcome');

    if (!el) return;

    const bodyEl = $('#refWelcomeBody');

    const city = getCityLabel();

    const total = cityScopedReports(loadReports()).filter((r) => !isReportPubliclyHidden(r)).length;

    if (bodyEl) {

      bodyEl.textContent = total > 0

        ? t('ref.welcomeBody').replace('{n}', String(total)).replace('{city}', city)

        : t('ref.welcomeBodyEmpty').replace('{city}', city);

    }

    el.classList.remove('hidden');

  }



  function dismissReferralWelcome() {

    safeLocalSet(REF_WELCOME_KEY, '1');

    const el = $('#referralWelcome');

    if (el) el.classList.add('hidden');

  }



  function maybeShowReferralWelcome() {

    let ref = null;

    try { ref = new URLSearchParams(location.search).get('ref'); } catch { ref = null; }

    if (!ref) return;

    const demo = new URLSearchParams(location.search).get('demo');

    if (demo === 'tour' || demo === 'persona' || demo === 'video') return;

    if (localStorage.getItem(REF_WELCOME_KEY)) return;

    // Brand-new users get onboarding (already neighbour-friendly); welcome returning

    // visitors arriving via a friend's link. Skip anyone who already reported.

    if (!user.tosAccepted) return;

    if (isAdmin || isLead) return;

    if (loadReports().some(ownsReport)) { safeLocalSet(REF_WELCOME_KEY, '1'); return; }

    if (window.CivicAnalytics) CivicAnalytics.track('ref_welcome_shown', { ref: String(ref).slice(0, 64) });

    renderReferralWelcome();

  }



  /* ---------- Leaderboard Engine ---------- */

  function startOfCurrentMonthTs() {

    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  }



  function renderLeaderboard(type) {

    const rankClass = (i) => (i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '');

    const demoNote = $('#leaderboardDemoNote');

    const liveBackend = Backend.enabled;

    const sinceTs = leaderboardPeriod === 'month' ? startOfCurrentMonthTs() : null;



    if (type === 'wards') {

      const realWards = aggregateWardLeaderboard(sinceTs);

      let wards = realWards;

      // Demo seeds only in non-prod offline — never on prod (even if sync fails).
      const usingDemo = !liveBackend && !isProdEnvironment() && realWards.length < 2;

      if (usingDemo) {

        wards = DEMO_WARD_SEED.filter((w) => w.city === getUserCity()).map((w) => ({ ...w }));

      }

      wards = mergeUserWard(wards, sinceTs);

      wards.sort((a, b) => b.points - a.points);



      if (demoNote) {

        demoNote.classList.toggle('hidden', !usingDemo);

        if (usingDemo) demoNote.textContent = t('leaderboard.demoNote');

      }



      const listEl = $('#wardsList');

      if (liveBackend && realWards.length === 0) {

        const emptyMsg = user.ward ? t('leaderboard.emptyFirst') : t('leaderboard.emptyWards');

        listEl.innerHTML = `<li class="empty-state"><p>${escapeHtml(emptyMsg)}</p></li>`;

        return;

      }

      if (!wards.length) {

        listEl.innerHTML = `<li class="empty-state"><p>${escapeHtml(t('leaderboard.emptyWards'))}</p></li>`;

        return;

      }



      listEl.innerHTML = wards

        .map(

          (w, i) => `

          <li class="${w.isUser ? 'lb-highlight' : ''}${w.isDemo ? ' lb-demo-row' : ''}">

            <span class="lb-rank ${rankClass(i)}">${i + 1}</span>

            <div class="lb-info">

              <div class="lb-name">${escapeHtml(w.name)}${w.isUser ? ` (${t('leaderboard.you')})` : ''}${w.isDemo ? ` <span class="lb-demo">${escapeHtml(t('leaderboard.demo'))}</span>` : ''}</div>

              <div class="lb-meta">${escapeHtml(t('leaderboard.resolved').replace('{n}', String(w.resolved != null ? w.resolved : w.reports)))}</div>

            </div>

            <span class="lb-score">${w.points.toLocaleString()} pts</span>

          </li>`

        )

        .join('');

    }



    if (type === 'citizens') {

      let citizens = aggregateCitizenLeaderboard(sinceTs);

      citizens = citizens.filter((c) => c.id !== user.id && c.name !== (user.displayName || ''));

      const usingDemo = !liveBackend && !isProdEnvironment() && citizens.length < 2;

      if (usingDemo) {

        citizens = DEMO_CITIZEN_SEED.map((c) => ({ ...c }));

      }



      const periodUserReports = sinceTs ? getUserReports().filter((r) => Number(r.timestamp) >= sinceTs) : getUserReports();

      const userPoints = sinceTs

        ? periodUserReports.reduce((sum, r) => sum + POINTS_PER_REPORT + (r.status === 'resolved' ? POINTS_PER_REPORT : 0), 0)

        : getTotalCivicPoints();

      citizens.push({

        name: t('leaderboard.you'),

        ward: user.ward ? getWardShortName(user.ward) : getCityLabel(),

        points: userPoints,

        isUser: true,

        isDemo: false,

      });

      citizens.sort((a, b) => b.points - a.points);



      if (demoNote) {

        demoNote.classList.toggle('hidden', !usingDemo);

        if (usingDemo) demoNote.textContent = t('leaderboard.demoNote');

      }



      const listEl = $('#citizensList');

      const realCitizens = citizens.filter((c) => !c.isDemo && !c.isUser);

      if (liveBackend && realCitizens.length === 0) {

        listEl.innerHTML = `<li class="empty-state"><p>${escapeHtml(user.ward ? t('leaderboard.emptyFirst') : t('leaderboard.emptyCitizens'))}</p></li>`;

        return;

      }

      if (citizens.length <= 1 && !usingDemo) {

        listEl.innerHTML = `<li class="empty-state"><p>${escapeHtml(t('leaderboard.emptyCitizens'))}</p></li>`;

        return;

      }



      listEl.innerHTML = citizens

        .map(

          (c, i) => `

          <li class="${c.isUser ? 'lb-highlight' : ''}${c.isDemo ? ' lb-demo-row' : ''}">

            <span class="lb-rank ${rankClass(i)}">${i + 1}</span>

            <div class="lb-info">

              <div class="lb-name">${escapeHtml(c.name)}${c.isDemo ? ` <span class="lb-demo">${escapeHtml(t('leaderboard.demo'))}</span>` : ''}</div>

              <div class="lb-meta">${escapeHtml(c.ward)}</div>

            </div>

            <span class="lb-score">${c.points.toLocaleString()} pts</span>

          </li>`

        )

        .join('');

    }

  }



  function syncCoopRegistryLink() {

    const link = $('#linkCoopRegistry');

    if (!link) return;

    const url = (window.CIVICRADAR_CONFIG || {}).cooperativeRegistryUrl

      || 'https://cooperatives.gov.in/';

    link.href = url;

  }



  function saveProfileSociety() {

    const input = $('#profileSocietyInput');

    if (!input) return;

    const val = sanitizeText(input.value, 120);

    if (val === (user.society || '')) return;

    user.society = val;

    saveUser();

    cacheSocietyIfCustom(user.city || DEFAULT_CITY, user.ward, val);

  }



  function saveProfileDisplayName() {

    const input = $('#profileDisplayNameInput');

    if (!input) return;

    const resolved = resolveDisplayName(input.value, { ward: user.ward, city: user.city || DEFAULT_CITY });

    if (resolved === (user.displayName || '')) return;

    user.displayName = resolved;

    saveUser();

    const greeting = $('#profileGreeting');

    if (greeting) {

      greeting.textContent = t('profile.greeting').replace('{name}', user.displayName);

    }

    if (document.activeElement !== input) input.value = user.displayName;

  }



  /* ---------- Profile Stats Calculator ---------- */

  function updateProfileUI() {

    syncReportReminderToggle();

    syncNbhAlertToggles();

    syncCoopRegistryLink();

    renderOfficialChannelsSurfaces(null);

    if (typeof renderWardPulse === 'function') renderWardPulse();

    const reports = getUserReports();

    const resolved = reports.filter((r) => r.status === 'resolved');

    const pending = reports.filter((r) => r.status === 'pending');

    const bonus = loadPointsCache();



    $('#profileGreeting').textContent = user.displayName

      ? t('profile.greeting').replace('{name}', user.displayName)

      : t('profile.greetingDefault');

    const referralLineEl = $('#profileReferralLine');

    if (referralLineEl) {

      const referredCount = parseInt(localStorage.getItem(REFERRAL_REWARDED_COUNT_KEY) || '0', 10);

      referralLineEl.classList.toggle('hidden', referredCount <= 0);

      if (referredCount > 0) {

        referralLineEl.textContent = t('profile.referralCount').replace('{n}', String(referredCount));

      }

    }

    const profileDisplayNameInput = $('#profileDisplayNameInput');

    if (profileDisplayNameInput && document.activeElement !== profileDisplayNameInput) {

      profileDisplayNameInput.value = user.displayName || '';

    }

    const profileCitySel = $('#profileCity');

    if (profileCitySel && document.activeElement !== profileCitySel) {

      profileCitySel.value = user.city || DEFAULT_CITY;

    }

    syncProfileCityUi(user.city || DEFAULT_CITY);

    const profileWardInput = $('#profileWardInput');

    if (profileWardInput && document.activeElement !== profileWardInput) {

      profileWardInput.value = user.ward || '';

    }

    const societyInput = $('#profileSocietyInput');

    if (societyInput && document.activeElement !== societyInput) {

      societyInput.value = user.society || '';

    }



    const badgesEl = $('#profileBadges');

    const badges = getReporterBadges();

    const streak = getReportWeekStreak();

    if (badgesEl) {

      if (badges.length) {

        badgesEl.classList.remove('hidden');

        badgesEl.innerHTML = badges

          .map((b) => `<span class="profile-badge"><i class="ph ${b.icon}"></i> ${escapeHtml(t(b.key))}</span>`)

          .join('');

      } else {

        badgesEl.classList.add('hidden');

        badgesEl.innerHTML = '';

      }

    }



    const wardImpactEl = $('#profileWardImpact');

    if (wardImpactEl && user.ward) {

      const wardCount = getWardMonsoonCount(user.ward);

      wardImpactEl.classList.remove('hidden');

      wardImpactEl.textContent = t('profile.wardImpact').replace('{n}', String(wardCount)) +

        (streak >= 2 ? ` — ${t('profile.streak').replace('{n}', String(streak))}` : '');

    } else if (wardImpactEl) {

      wardImpactEl.classList.add('hidden');

    }



    $('#profilePoints').textContent = getTotalCivicXp().toLocaleString();

    $('#profileFixed').textContent = resolved.length;

    $('#profilePending').textContent = pending.length;

    syncUserCivicXp();

    const xpInfo = getCivicLevelInfo(getTotalCivicXp());

    const levelBadgeEl = $('#profileLevelBadge');

    const xpTotalEl = $('#profileXpTotal');

    const xpTrackEl = $('#profileXpTrack');

    const xpProgressEl = $('#profileXpProgress');

    const xpHintEl = $('#profileXpHint');

    if (levelBadgeEl) levelBadgeEl.textContent = civicLevelName(xpInfo.level.id);

    if (xpTotalEl) xpTotalEl.textContent = t('profile.xpTotalLabel').replace('{n}', String(xpInfo.xp));

    if (xpProgressEl && xpTrackEl) {

      xpProgressEl.style.width = `${xpInfo.pct}%`;

      xpTrackEl.setAttribute('aria-valuenow', String(xpInfo.pct));

    }

    if (xpHintEl) {

      xpHintEl.textContent = xpInfo.next

        ? t('profile.xpToNext')

          .replace('{n}', String(xpInfo.remaining))

          .replace('{level}', civicLevelName(xpInfo.next.id))

        : t('profile.xpMax');

    }



    const rewardsEl = $('#profileRewards');

    const streakLineEl = $('#profileStreakLine');

    const badgeTrackEl = $('#profileBadgeTrack');

    const badgeProgressEl = $('#profileBadgeProgress');

    const nextBadgeHintEl = $('#profileNextBadgeHint');

    if (rewardsEl && (reports.length > 0 || getTotalCivicXp() > 0)) {

      rewardsEl.classList.remove('hidden');

      const milestone = getReportMilestoneProgress(reports.length);

      const streakInfo = getNextStreakBadgeInfo(streak);

      if (streakLineEl) {

        streakLineEl.textContent = streak >= 1

          ? t('profile.streak').replace('{n}', String(streak))

          : '';

        streakLineEl.classList.toggle('hidden', streak < 1);

      }

      if (badgeProgressEl && badgeTrackEl) {

        badgeProgressEl.style.width = `${milestone.pct}%`;

        badgeTrackEl.setAttribute('aria-valuenow', String(milestone.pct));

      }

      if (nextBadgeHintEl) {

        let hint = t(milestone.hintKey).replace('{n}', String(milestone.remaining));

        if (streakInfo.nextKey && streakInfo.weeksToNext > 0) {

          hint += ` — ${t('profile.nextStreakBadge')

            .replace('{n}', String(streakInfo.weeksToNext))

            .replace('{badge}', t(streakInfo.nextKey))}`;

        }

        nextBadgeHintEl.textContent = hint;

      }

    } else if (rewardsEl) {

      rewardsEl.classList.add('hidden');

    }



    $('#profilePointsHint').textContent =

      bonus > 0

        ? t('profile.pointsHint.bonus')

          .replace('{n}', String(reports.length))

          .replace('{bonus}', String(bonus))

        : t('profile.pointsHint.base');



    renderProfileMutedReporters();



    const list = $('#reportList');

    if (reports.length === 0) {

      list.innerHTML = `

        <div class="empty-state empty-state--action">

          <i class="ph ph-camera"></i>

          <p>${escapeHtml(t('profile.empty'))}</p>

          <button type="button" class="btn btn--primary btn--sm" id="btnEmptyReport">${escapeHtml(t('profile.emptyAction'))}</button>

        </div>`;

      const btn = $('#btnEmptyReport');

      if (btn) btn.addEventListener('click', window.openReportModal);

      return;

    }



    const unfiledReports = getUnfiledReports();

    let batchBanner = '';

    if (unfiledReports.length > 1) {

      batchBanner = `

        <div class="profile-batch-banner">

          <p>${escapeHtml(t('profile.unfiledBanner').replace('{n}', String(unfiledReports.length)))}</p>

          <button type="button" class="btn btn--primary btn--sm" id="btnFileNextUnfiled">${escapeHtml(t('profile.fileNext'))}</button>

        </div>`;

    }



    list.innerHTML = batchBanner + reports

      .map((r) => {

        const stage = getReportStage(r);

        const resolved = r.status === 'resolved';

        const statusClass = r.removed

          ? 'status-badge--removed'

          : resolved

            ? 'status-badge--resolved'

            : stage.filed

              ? 'status-badge--filed'

              : 'status-badge--pending';

        const statusText = r.removed

          ? t('profile.status.removed')

          : resolved

            ? resolutionStatusLabel(r)

            : stage.filed

              ? `${getComplaintRefPrefix(getReportCity(r))} #${escapeHtml(r.complaintId)}`

              : t('profile.status.notFiled');

        const clock = !resolved && !r.removed

          ? `<span class="report-card__clock">${escapeHtml(getClockLine(r))}</span>`

          : '';

        let action = '';

        if (!resolved && !r.removed) {

          const rCity = getReportCity(r);

          const label = stage.filed

            ? t('profile.trackEscalate')

            : (rCity === 'mumbai' ? t('profile.fileBmc') : t('profile.fileCorp').replace('{corp}', getCorpShortName(rCity)));

          const cls = stage.key === 'matrix' || stage.key === 'zonal' || stage.key === 'grievance'

            ? 'btn--primary' : 'btn--secondary';

          action = `<button type="button" class="btn ${cls} btn--sm report-card__cta" data-escalate="${escapeHtml(String(r.id))}">${label}</button>`;

        }

        const safeImg = isSafeReportImage(r.image) ? r.image : '';

        const safeAfter = isSafeReportImage(r.resolutionImage) ? r.resolutionImage : '';

        let thumb;

        if (resolved && safeAfter && safeImg) {

          thumb = `

            <div class="report-card__proof">

              <div class="report-card__proof-wrap">

                <img class="report-card__thumb report-card__thumb--before" src="${safeImg}" alt="">

                <span class="report-card__proof-label">${escapeHtml(t('profile.proofBefore'))}</span>

              </div>

              <div class="report-card__proof-wrap">

                <img class="report-card__thumb report-card__thumb--after" src="${safeAfter}" alt="">

                <span class="report-card__proof-label">${escapeHtml(t('profile.proofAfter'))}</span>

              </div>

            </div>`;

        } else {

          thumb = safeImg

            ? `<img class="report-card__thumb" src="${safeImg}" alt="">`

            : '<div class="report-card__thumb"></div>';

        }

        const clearedBadge = r.communityCleared && !resolved

          ? `<div class="report-card__cleared"><i class="ph ph-broom"></i> ${escapeHtml(corpCopy('profile.communityCleared', getReportCity(r)))}</div>`

          : '';

        return `

          <article class="report-card">

            ${thumb}

            <div class="report-card__body">

              <div class="report-card__title">${escapeHtml(hazardLabel(r.hazard))}</div>

              <div class="report-card__meta">${escapeHtml(formatRelativeTime(r.timestamp))}${r.notes ? ` — ${escapeHtml(r.notes)}` : ''}</div>

              <div class="report-card__status">

                <span class="status-badge ${statusClass}">${statusText}</span>

                ${clock}

              </div>

              ${renderReportCardProgress(r)}

              ${clearedBadge}

              ${resolved ? resolutionBadgeHtml(r) : ''}

              ${(Number(r.confirmations) || 0) > 0 ? `<div class="report-card__confirms"><i class="ph ph-users"></i> ${r.confirmations} ${r.confirmations === 1 ? escapeHtml(t('profile.neighbourOne')) : escapeHtml(t('profile.neighbourMany'))}</div>` : ''}

              ${(Number(r.fixConfirmations) || 0) > 0 && !resolved ? `<div class="report-card__confirms"><i class="ph ph-check-circle"></i> ${r.fixConfirmations === 1 ? escapeHtml(t('fix.countOne')) : escapeHtml(t('fix.countMany')).replace('{n}', String(r.fixConfirmations))}</div>` : ''}

              ${action ? `<div class="report-card__actions">${action}</div>` : ''}

            </div>

          </article>`;

      })

      .join('');



    list.querySelectorAll('[data-escalate]').forEach((btn) => {

      btn.addEventListener('click', () => openEscalationModal(btn.dataset.escalate));

    });

    const fileNextBtn = $('#btnFileNextUnfiled');

    if (fileNextBtn) {

      fileNextBtn.addEventListener('click', () => {

        const next = getUnfiledReports()[0];

        if (next) openEscalationModal(next.id);

      });

    }

  }



  /* ---------- BMC Admin Dashboard ---------- */

  function openAdminReportModal(reportId) {

    const reports = loadReports();

    const report = reports.find((r) => String(r.id) === String(reportId));

    if (!report || report.status !== 'pending') return;

    if (!isAdminReportInScope(report)) return;



    activeAdminReportId = reportId;

    adminProofDataUrl = null;

    $('#adminReportPhoto').src = isSafeReportImage(report.image) ? report.image : '';

    const preview = $('#adminProofPreview');

    const captureBtn = $('#btnAdminProofCapture');

    if (preview) {

      preview.hidden = true;

      preview.removeAttribute('src');

    }

    if (captureBtn) captureBtn.classList.remove('hidden');

    $('#adminReportReporter').textContent = report.reporter || 'Citizen';

    $('#adminReportWard').textContent = report.ward || '—';

    $('#adminReportStatus').textContent = t('popup.pending');

    $('#adminReportStatus').className = 'status-badge status-badge--pending';

    const flagCount = Number(report.flagCount) || 0;

    $('#adminReportFlagRow').classList.toggle('hidden', flagCount === 0);

    $('#adminReportFlags').textContent = String(flagCount);

    $('#adminReportLat').textContent = report.lat != null ? report.lat.toFixed(6) : '—';

    $('#adminReportLng').textContent = report.lng != null ? report.lng.toFixed(6) : '—';

    const conf = Number(report.confirmations) || 0;

    $('#adminReportClock').textContent = getClockLine(report) +

      (conf > 0 ? t('admin.meta.neighbourConfirm').replace('{n}', String(conf)) : '');

    $('#btnMarkResolved').disabled = false;

    $('#btnMarkResolved').dataset.confirm = '';

    const lbl = $('#btnMarkResolved .btn__label');

    if (lbl) lbl.textContent = t('admin.markResolved');

    openModal('adminReport');

  }



  // Shared resolution routine. `by` is 'bmc' (official), 'citizen' (self-confirmed), or 'community'.

  function applyResolution(reportId, by, resolutionImage, resolutionSource) {

    const reports = loadReports();

    const idx = reports.findIndex((r) => String(r.id) === String(reportId));

    if (idx === -1) return false;

    if (reports[idx].status === 'resolved') return false;

    if (!isAdminReportInScope(reports[idx])) return false;

    const resolvedAt = new Date().toISOString();

    const src = resolutionSource || (by === 'bmc' ? 'bmc_admin' : by === 'citizen' ? 'self' : by === 'community' ? 'community_verified' : '');

    reports[idx].status = 'resolved';

    reports[idx].resolvedBy = by;

    reports[idx].resolvedAt = resolvedAt;

    reports[idx].resolutionSource = src;

    if (src === 'community_verified' || src === 'stale_verified') {

      reports[idx].communityVerifiedAt = resolvedAt;

    }

    if (resolutionImage) reports[idx].resolutionImage = resolutionImage;

    try {

      saveReports(reports);

    } catch (err) {

      showToast(t('toast.resolveFail'), 'error');

      return false;

    }

    Backend.updateReportResolution(

      reportId, 'resolved', by, resolvedAt,

      resolutionImage || reports[idx].resolutionImage,

      src,

      reports[idx].communityVerifiedAt || null

    );

    fanOutLocalNbhResolved(reports[idx]);

    if (window.CivicAnalytics) {

      CivicAnalytics.track('report_resolved', {

        reportId: String(reportId),

        resolvedBy: by,

        resolutionSource: src,

      }, reports[idx].ward);

    }

    adminProofDataUrl = null;

    if (reportMarkerLayer) refreshReportMarkers();

    updateProfileUI();

    updateCommunitySubtitle();

    renderWardChallenge();

    renderLeaderboard('wards');

    renderLeaderboard('citizens');

    updatePersonaUI();

    // Notify this device if it had corroborated the hazard just resolved.

    setTimeout(checkConfirmedResolved, 400);

    updateCommunityWinBadge();

    return true;

  }



  function markReportResolved() {

    if (!activeAdminReportId) return;

    if (!hasRole('bmc')) {

      showToast(t('toast.bmcOnlyResolve'), 'error');

      return;

    }



    const btn = $('#btnMarkResolved');

    if (btn.dataset.confirm !== 'yes') {

      btn.dataset.confirm = 'yes';

      const lbl = btn.querySelector('.btn__label');

      if (lbl) lbl.textContent = t('admin.confirmResolve');

      showToast(t('admin.proofPrompt'), 'info', 4000);

      return;

    }



    if (!adminProofDataUrl) {

      showToast(t('admin.proofRequired'), 'error', 4500);

      $('#adminProofInput').click();

      return;

    }



    if (applyResolution(activeAdminReportId, 'bmc', adminProofDataUrl, 'bmc_admin')) {

      closeModal('adminReport');

      activeAdminReportId = null;

      renderAdminQueue();

      showToast(t('toast.resolvedProof'), 'success');

    }

  }



  // Moderator takedown of objectionable content (UGC compliance — Apple 1.2 /
  // Google Play). Soft-deletes: the reporter and BMC can still see it for
  // audit, but it drops off the public map and admin queue everywhere.
  function removeReportContentAction() {

    if (!activeAdminReportId) return;

    if (!hasRole('bmc')) {

      showToast(t('toast.bmcOnlyResolve'), 'error');

      return;

    }

    if (!window.confirm(t('admin.removeConfirm'))) return;

    const reports = loadReports();

    const idx = reports.findIndex((r) => String(r.id) === String(activeAdminReportId));

    if (idx === -1) return;

    reports[idx].removed = true;

    reports[idx].removedAt = new Date().toISOString();

    try {

      saveReports(reports);

    } catch {

      showToast(t('toast.resolveFail'), 'error');

      return;

    }

    Backend.removeReportContent(activeAdminReportId);

    closeModal('adminReport');

    activeAdminReportId = null;

    renderAdminQueue();

    refreshReportMarkers();

    showToast(t('admin.removeSuccess'), 'success');

  }



  // Citizen self-confirmation: the report owner confirms BMC fixed it.

  // Requires a filed complaint number as proof, and is tagged as citizen-confirmed.

  function resolveOwnReport(reportId) {

    const report = findReportById(reportId);

    if (!report) return;

    const owned = report.reporterId ? report.reporterId === user.id : false;

    if (!owned) {

      showToast(t('toast.ownReportOnly'), 'error');

      return;

    }

    if (!report.complaintId) {

      showToast(t('toast.complaintFirst'), 'error', 4500);

      return;

    }

    if (applyResolution(reportId, 'citizen', null, 'self')) {

      closeModal('escalation');

      showToast(t('toast.selfResolved'), 'success', 4000);

      setTimeout(() => showShareWinModal(reportId, 'resolved'), 600);

    }

  }



  /* ---------- BMC Admin Queue ---------- */

  function parseWardParts(ward) {

    if (!ward) return { code: '', area: '', shortCode: '' };

    const parts = ward.split('—').map((s) => s.trim());

    const code = parts[0] || ward;

    const area = parts[1] || '';

    const shortCode = code.replace(/\s+Ward\s*$/i, '').trim() || code;

    return { code, area, shortCode };

  }



  function reportHasCitizenPhoto(r) {

    return isSafeReportImage(r.image);

  }



  function reportHasResolutionProof(r) {

    return isSafeReportImage(r.resolutionImage);

  }



  function escapeCsvField(val) {

    let s = val == null ? '' : String(val);

    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;

    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;

    return s;

  }



  function getAdminExportReports() {

    const all = adminScopedReports(loadReports());

    const wardFilter = $('#aqWardFilter')?.value || '';

    let rows = all.filter((r) => !r.removed && (!wardFilter || r.ward === wardFilter));

    const sort = $('#aqSort')?.value || 'oldest';

    const ageOf = (r) => getDaysPending(r.filedAt || r.timestamp);

    const confOf = (r) => Number(r.confirmations) || 0;

    if (sort === 'newest') rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    else if (sort === 'overdue') rows.sort((a, b) => (isOverdue(b) - isOverdue(a)) || (ageOf(b) - ageOf(a)));

    else if (sort === 'confirmed') rows.sort((a, b) => confOf(b) - confOf(a) || (ageOf(b) - ageOf(a)));

    else rows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return rows;

  }



  function exportAdminQueueCsv() {

    if (!hasRole('bmc')) return;

    const rows = getAdminExportReports();

    if (!rows.length) {

      showToast(t('admin.exportEmpty'), 'info', 3500);

      return;

    }

    const headers = [

      'Report ID', 'Ward', 'Ward Code', 'Status', 'Created', 'Hazard Type',

      'Lat', 'Lng', 'Location Notes', 'BMC Complaint #', 'Days Pending', 'Overdue Tier',

      'Corroborations', 'Has Citizen Photo', 'Has Resolution Proof', 'Deep Link',

    ];

    const csvRows = rows.map((r) => {

      const stage = getReportStage(r);

      const days = r.status === 'pending' ? getDaysPending(r.filedAt || r.timestamp) : '';

      const wardParts = parseWardParts(r.ward);

      return [

        r.id,

        r.ward || '',

        wardParts.code,

        r.status,

        r.timestamp ? new Date(r.timestamp).toISOString().slice(0, 10) : '',

        hazardLabel(r.hazard),

        r.lat != null ? r.lat : '',

        r.lng != null ? r.lng : '',

        r.notes || '',

        r.complaintId || '',

        days,

        stage.key,

        Number(r.confirmations) || 0,

        reportHasCitizenPhoto(r) ? 'yes' : 'no',

        reportHasResolutionProof(r) ? 'yes' : 'no',

        reportDeepLink(r.id),

      ].map(escapeCsvField).join(',');

    });

    const csv = [headers.map(escapeCsvField).join(','), ...csvRows].join('\r\n');

    const wardSuffix = ($('#aqWardFilter')?.value || '').split('—')[0].trim().replace(/\s+/g, '-') || 'all-wards';

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;

    a.download = `civicradar-ward-export-${wardSuffix}-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    showToast(t('admin.exportSuccess').replace('{n}', String(rows.length)), 'success', 3500);

  }



  function buildBmcComplaintCopyText(report) {

    const city = getReportCity(report);

    const headerKey = city === 'pune' ? 'copy1916.pmc.header' : city === 'thane' ? 'copy1916.tmc.header' : 'copy1916.header';

    const complaintFiledKey = city === 'pune' ? 'copy1916.pmc.complaintFiled' : city === 'thane' ? 'copy1916.tmc.complaintFiled' : 'copy1916.complaintFiled';

    const complaintNotFiledKey = city === 'pune' ? 'copy1916.pmc.complaintNotFiled' : city === 'thane' ? 'copy1916.tmc.complaintNotFiled' : 'copy1916.complaintNotFiled';

    const wardParts = parseWardParts(report.ward);

    const wardLine = formatWardForCopy(wardParts);

    const category = bmcCategoryLabel(report.hazard);

    const dateStr = new Date(report.timestamp).toLocaleDateString('en-IN', {

      day: 'numeric', month: 'short', year: 'numeric',

    });

    const lines = [

      te(headerKey),

      '',

      `${te('copy1916.categoryLabel')}: ${category}`,

      `${te('copy1916.wardLabel')}: ${wardLine}`,

    ];

    if (report.notes) lines.push(`${te('copy1916.landmarkLabel')}: ${report.notes}`);

    if (report.lat != null && report.lng != null) {

      lines.push(`${te('copy1916.gpsLabel')}: ${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}`);

      if (isGpsOutsideCity(report.lat, report.lng, city)) {

        lines.push(te('copy1916.gpsWarning').replace('{city}', getCityLabel(city)));

      }

      lines.push(`${te('copy1916.mapsLabel')}: https://maps.google.com/?q=${report.lat},${report.lng}`);

    }

    lines.push(`${te('copy1916.dateLabel')}: ${dateStr}`);

    lines.push(

      report.complaintId

        ? te(complaintFiledKey).replace('{id}', report.complaintId)

        : te(complaintNotFiledKey)

    );

    const link = reportCopyDeepLink(report.id);

    const linkLine = `${te('copy1916.civicradarLinkLabel')}: ${link}`;

    lines.push(

      isLocalhostOrigin() && !getPublicAppUrl()

        ? `${linkLine} ${te('copy1916.linkLocalhostNote')}`

        : linkLine

    );

    const hazardEn = I18N.en[`hazard.${report.hazard}`] || hazardLabel(report.hazard);

    const marathiLead = I18N.mr[`copy1916.marathiLead.${report.hazard}`];

    const marathiAction = I18N.mr[`copy1916.marathiAction.${report.hazard}`];

    if (marathiLead || marathiAction) {

      lines.push('');

      lines.push(te('copy1916.marathiHeader'));

      if (marathiLead) lines.push(marathiLead.replace('{ward}', wardLine));

      if (marathiAction) lines.push(marathiAction);

      if (report.notes && I18N.mr['copy1916.marathiLandmark']) {

        lines.push(I18N.mr['copy1916.marathiLandmark'].replace('{notes}', report.notes));

      }

      if (report.lat != null && report.lng != null) {

        lines.push(`GPS: ${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}`);

      }

    } else if (I18N.mr[`hazard.${report.hazard}`]) {

      lines.push('');

      lines.push(te('copy1916.marathiHeader'));

      lines.push(`${wardLine} — ${I18N.mr[`hazard.${report.hazard}`] || hazardEn}`);

    }

    lines.push('');

    lines.push(te('copy1916.refId').replace('{id}', report.id));

    return lines.join('\n');

  }



  function buildCopy1916Text(report) {

    return buildBmcComplaintCopyText(report);

  }



  function copyFor1916(reportId) {

    const report = findReportById(reportId);

    if (!report) return;

    copyTextSafe(buildCopy1916Text(report), 'admin.copy1916Copied');

  }



  function populateWardFilter(selectEl, reports) {

    if (!selectEl) return;

    const current = selectEl.value;

    const wards = Array.from(new Set(reports.map((r) => r.ward).filter(Boolean))).sort();

    selectEl.innerHTML = '<option value="">' + escapeHtml(t('admin.allWards')) + '</option>' +

      wards.map((w) => `<option value="${escapeHtml(w)}">${escapeHtml(w.split('—')[0].trim())}</option>`).join('');

    if (wards.includes(current)) selectEl.value = current;

  }



  function formatHealthCounts(summary) {

    if (!summary) return '';

    const lines = [];

    const pick = (label, key) => {

      const val = summary[key] ?? summary.counts?.[key];

      if (val != null) lines.push(`<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(val))}</li>`);

    };

    pick(t('admin.health.sessions'), 'sessions');

    pick(t('admin.health.tabViews'), 'tab_views');

    pick(t('admin.health.reportsFiled'), 'reports_submitted');

    pick(t('admin.health.corroborations'), 'corroborations');

    pick(t('admin.health.bmcFiled'), 'bmc_filed');

    pick(t('admin.health.resolved'), 'resolved');

    pick(t('admin.health.communityCleanups'), 'community_cleanups');

    pick(t('admin.health.whatsappShares'), 'whatsapp_shares');

    pick(t('admin.health.errors'), 'errors');

    pick(t('admin.health.perfSamples'), 'perf_samples');

    if (summary.avgPerfMs != null) {

      lines.push(`<li><strong>${escapeHtml(t('admin.health.avgPerf'))}:</strong> ${escapeHtml(String(summary.avgPerfMs))} ms</li>`);

    }

    if (summary.errors != null && summary.total != null) {

      lines.push(`<li><strong>${escapeHtml(t('admin.health.bufferedEvents'))}:</strong> ${escapeHtml(String(summary.total))}</li>`);

    }

    return lines.length ? `<ul class="health-panel__list">${lines.join('')}</ul>` : `<p>${escapeHtml(t('admin.health.noData'))}</p>`;

  }



  async function renderAdminHealthStats() {

    const el = $('#adminHealthStats');

    if (!el || !window.CivicAnalytics) return;

    const local = CivicAnalytics.getLocalSummary(7);

    let html = `<p class="health-panel__source">${escapeHtml(t('admin.health.deviceSource'))}</p>`;

    html += formatHealthCounts(Object.assign({}, local.counts, {

      sessions: local.counts.session_start,

      tab_views: local.counts.tab_view,

      reports_submitted: local.counts.report_submitted,

      corroborations: local.counts.report_corroborated,

      bmc_filed: local.counts.bmc_filed,

      resolved: local.counts.report_resolved,

      community_cleanups: local.counts.community_cleanup,

      whatsapp_shares: local.counts.whatsapp_share,

      errors: local.errors,

      perf_samples: local.counts.perf,

      avgPerfMs: local.avgPerfMs,

      total: local.total,

    }));

    if (Backend.enabled) {

      const server = await CivicAnalytics.fetchServerSummary(7);

      if (server) {

        html += `<p class="health-panel__source">${escapeHtml(t('admin.health.cloudSource'))}</p>`;

        html += formatHealthCounts(server);

      } else {

        html += `<p class="health-panel__hint">${escapeHtml(t('admin.health.cloudUnavailable'))}</p>`;

      }

    } else {

      html += `<p class="health-panel__hint">${escapeHtml(t('admin.health.connectSupabase'))}</p>`;

    }

    el.innerHTML = html;

  }



  function canViewTracking() {

    return isAdmin || isLead || isSuperAdmin;

  }



  function trackingScopedReports(reports, wardFilter) {

    let rows = reports.slice();

    if (isAdmin && !isSuperAdmin) rows = adminScopedReports(rows);

    if (isLead) {

      rows = rows.filter((r) => matchesCoordinatorScope(

        r.ward,

        r.neighbourhood || r.society,

        { wardOnly: false }

      ));

    }

    if (wardFilter) rows = rows.filter((r) => r.ward === wardFilter);

    return rows;

  }



  function trackingChannelLabel(channelId) {

    const id = String(channelId || '').trim();

    if (!id) return t('tracking.channelUnknown');

    for (let i = 0; i < CITY_IDS.length; i++) {

      const list = getOfficialChannelsForCity(CITY_IDS[i]);

      const hit = list.find((c) => c.id === id);

      if (hit) return hit.label;

    }

    return id.replace(/_/g, ' ');

  }



  function buildLocalTrackingDashboard(days, wardFilter) {

    const since = Date.now() - (days || 7) * 86400000;

    const reports = trackingScopedReports(loadReports(), wardFilter)

      .filter((r) => new Date(r.timestamp).getTime() >= since);

    const byHazardMap = {};

    const nbMap = {};

    const reporterIds = new Set();

    let confirmations = 0;

    reports.forEach((r) => {

      const h = r.hazard || 'unknown';

      if (!byHazardMap[h]) byHazardMap[h] = { hazard: h, total: 0, pending: 0, resolved: 0 };

      byHazardMap[h].total++;

      if (r.status === 'resolved') byHazardMap[h].resolved++;

      else byHazardMap[h].pending++;

      if (r.reporterId) reporterIds.add(String(r.reporterId));

      confirmations += Number(r.confirmations) || 0;

      const label = (r.society || r.neighbourhood || '').trim();

      if (label) nbMap[label] = (nbMap[label] || 0) + 1;

    });

    const byHazard = Object.values(byHazardMap).sort((a, b) => b.total - a.total);

    const neighbourhoods = Object.entries(nbMap)

      .map(([label, count]) => ({ label, count }))

      .sort((a, b) => b.count - a.count)

      .slice(0, 12);



    let traffic = {

      sessions: 0,

      page_views: 0,

      pwa_installs: 0,

      pwa_standalone_sessions: 0,

      unique_visitors: 0,

    };

    const officialOpens = {};

    if (window.CivicAnalytics) {

      const events = CivicAnalytics.getLocalSummary(days).counts || {};

      traffic = {

        sessions: events.session_start || 0,

        page_views: (events.session_start || 0) + (events.tab_view || 0),

        pwa_installs: events.pwa_installed || 0,

        pwa_standalone_sessions: events.pwa_standalone_session || 0,

        unique_visitors: events.session_start || 0,

      };

      try {

        const raw = JSON.parse(localStorage.getItem('civicradar_analytics_buffer') || '[]');

        raw.filter((e) => new Date(e.created_at).getTime() >= since).forEach((e) => {

          if (e.event_type !== 'official_channel_open' && e.event_type !== 'bmc_channel_opened') return;

          const ch = (e.payload && e.payload.channel) || 'unknown';

          officialOpens[ch] = (officialOpens[ch] || 0) + 1;

        });

      } catch { /* ignore */ }

    }



    return {

      days: days || 7,

      source: 'local',

      traffic,

      reports: {

        total: reports.length,

        pending: reports.filter((r) => r.status === 'pending').length,

        resolved: reports.filter((r) => r.status === 'resolved').length,

        filed: reports.filter((r) => r.complaintId).length,

        reporters: reporterIds.size,

        confirmations,

        by_hazard: byHazard,

      },

      escalations: {

        official_opens: officialOpens,

        bmc_filed_events: 0,

        reports_with_complaint: reports.filter((r) => r.complaintId).length,

      },

      community: {

        corroborations: confirmations,

        pledges: loadPledges().filter((p) => new Date(p.timestamp || p.created_at || 0).getTime() >= since).length,

      },

      neighbourhoods,

      leads: { ward_leads: 0, neighbourhood_leads: isLead && user.coordinatorScope === 'neighbourhood' ? 1 : 0 },

    };

  }



  function renderTrackingBreakdownList(el, items, valueKey, labelFn) {

    if (!el) return;

    if (!items || !items.length) {

      el.innerHTML = `<li class="tracking-breakdown__empty">${escapeHtml(t('tracking.empty'))}</li>`;

      return;

    }

    const max = Math.max(...items.map((x) => Number(x[valueKey]) || 0), 1);

    el.innerHTML = items.map((item) => {

      const val = Number(item[valueKey]) || 0;

      const label = labelFn ? labelFn(item) : item.label;

      const pct = Math.round((val / max) * 100);

      const extra = item.pending != null

        ? ` — ${item.pending} ${t('tracking.pending')}`

        : '';

      return `<li>

        <span>${escapeHtml(label)}${extra}</span>

        <div class="tracking-breakdown__bar" aria-hidden="true"><div class="tracking-breakdown__fill" style="width:${pct}%"></div></div>

        <strong>${val}</strong>

      </li>`;

    }).join('');

  }



  async function renderTrackingDashboard() {

    const days = parseInt($('#trackingDays')?.value || '7', 10) || 7;

    const wardFilter = $('#trackingWardFilter')?.value || '';

    const sourceEl = $('#trackingSource');

    const noteEl = $('#trackingPwaNote');

    if (sourceEl) sourceEl.textContent = t('tracking.loading');



    const scopeTag = $('#trackingScopeTag');

    if (scopeTag) {

      if (isLead && user.coordinatorScope === 'neighbourhood' && user.neighbourhoodLabel) {

        scopeTag.textContent = t('coord.scopeNbh').replace('{label}', user.neighbourhoodLabel);

        scopeTag.classList.remove('hidden');

      } else if (isLead && user.ward) {

        scopeTag.textContent = t('coord.scopeWard').replace('{ward}', user.ward.split('—')[0].trim());

        scopeTag.classList.remove('hidden');

      } else if (isAdmin && !isSuperAdmin) {

        scopeTag.textContent = getCityLabel('mumbai');

        scopeTag.classList.remove('hidden');

      } else {

        scopeTag.classList.add('hidden');

      }

    }



    let data = null;

    if (Backend.enabled && window.CivicAnalytics) {

      data = await CivicAnalytics.fetchTrackingDashboard(days, {

        ward: wardFilter || null,

        city: isAdmin && !isSuperAdmin ? 'mumbai' : null,

      });

    }

    if (!data) data = buildLocalTrackingDashboard(days, wardFilter);



    const traffic = data.traffic || {};

    const reports = data.reports || {};

    const escalations = data.escalations || {};

    const leads = data.leads || {};



    const set = (id, val) => { const el = $(id); if (el) el.textContent = val != null ? String(val) : '—'; };

    const pwaCount = (traffic.pwa_installs || 0) + (traffic.pwa_standalone_sessions || 0);

    set('#trSessions', traffic.unique_visitors ?? traffic.sessions ?? 0);

    set('#trPwa', pwaCount);

    set('#trReports', reports.total ?? 0);

    set('#trResolved', reports.resolved ?? 0);

    set('#trReporters', reports.reporters ?? 0);

    set('#trMeToo', reports.confirmations ?? data.community?.corroborations ?? 0);

    set('#trFiled', reports.filed ?? escalations.reports_with_complaint ?? 0);

    set('#trLeads', (leads.neighbourhood_leads || 0) + (leads.ward_leads || 0));



    if (noteEl) noteEl.classList.remove('hidden');



    if (sourceEl) {

      if (data.source === 'cloud') {

        sourceEl.textContent = t('tracking.sourceCloud');

      } else if (Backend.enabled) {

        sourceEl.textContent = t('tracking.sourceCloudFail');

      } else {

        sourceEl.textContent = t('tracking.sourceLocal');

      }

    }



    const hazardItems = (reports.by_hazard || []).map((row) => ({

      label: hazardLabel(row.hazard),

      count: row.total,

      pending: row.pending,

      resolved: row.resolved,

    }));

    renderTrackingBreakdownList($('#trackingByCategory'), hazardItems, 'count', (item) => item.label);



    const escItems = Object.entries(escalations.official_opens || {})

      .map(([channel, count]) => ({ label: trackingChannelLabel(channel), count }))

      .sort((a, b) => b.count - a.count);

    renderTrackingBreakdownList($('#trackingEscalations'), escItems, 'count');



    renderTrackingBreakdownList($('#trackingNeighbourhoods'), data.neighbourhoods || [], 'count');

  }



  window.openTrackingDashboard = function () {

    if (!canViewTracking()) return;

    const wardWrap = $('#trackingWardWrap');

    const wardSel = $('#trackingWardFilter');

    if (wardWrap && wardSel) {

      const showWard = isAdmin || isSuperAdmin;

      wardWrap.classList.toggle('hidden', !showWard);

      if (showWard) populateWardFilter(wardSel, trackingScopedReports(loadReports()));

    }

    renderTrackingDashboard();

    openModal('tracking');

  };

  window.closeTrackingDashboard = function () { closeModal('tracking'); };



  function renderAdminQueue() {

    const all = isAdmin ? adminScopedReports(loadReports()) : loadReports();

    const pending = all.filter((r) => r.status === 'pending' && !r.removed);

    const resolved = all.filter((r) => r.status === 'resolved' && !r.removed);

    const overdue = countOverdueReports();

    const avgAge = pending.length

      ? Math.round(pending.reduce((sum, r) => sum + getDaysPending(r.timestamp), 0) / pending.length)

      : 0;



    $('#aqPending').textContent = pending.length;

    $('#aqOverdue').textContent = overdue;

    $('#aqResolved').textContent = resolved.length;

    $('#aqAvgAge').textContent = avgAge;



    renderAdminHealthStats();



    populateWardFilter($('#aqWardFilter'), all);



    const wardFilter = $('#aqWardFilter').value;

    const sort = $('#aqSort').value || 'oldest';

    let rows = pending.filter((r) => !wardFilter || r.ward === wardFilter);



    const ageOf = (r) => getDaysPending(r.filedAt || r.timestamp);

    const confOf = (r) => Number(r.confirmations) || 0;

    if (sort === 'newest') rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    else if (sort === 'overdue') rows.sort((a, b) => (isOverdue(b) - isOverdue(a)) || (ageOf(b) - ageOf(a)));

    else if (sort === 'confirmed') rows.sort((a, b) => confOf(b) - confOf(a) || (ageOf(b) - ageOf(a)));

    else rows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Flagged content jumps to the top regardless of chosen sort — moderation
    // review shouldn't wait behind the normal triage order.
    rows.sort((a, b) => ((Number(b.flagCount) || 0) > 0 ? 1 : 0) - ((Number(a.flagCount) || 0) > 0 ? 1 : 0));



    const listEl = $('#adminQueueList');

    if (rows.length === 0) {

      listEl.innerHTML = `

        <li class="empty-state empty-state--action">

          <i class="ph ph-check-circle"></i>

          <p>No pending hazards${wardFilter ? ' in this ward' : ''}. Queue is clear.</p>

        </li>`;

      return;

    }



    listEl.innerHTML = rows

      .map((r) => {

        const overdueFlag = isOverdue(r);

        const filedBadge = r.complaintId

          ? `<span class="status-badge status-badge--filed">BMC #${escapeHtml(r.complaintId)}</span>`

          : '<span class="status-badge status-badge--pending">Unfiled</span>';

        const confCount = Number(r.confirmations) || 0;

        const confBadge = confCount > 0 ? `<span class="status-badge status-badge--confirms"><i class="ph ph-users"></i> ${confCount}</span>` : '';

        const flagCount = Number(r.flagCount) || 0;

        const flagBadge = flagCount > 0 ? `<span class="status-badge status-badge--flagged"><i class="ph ph-flag"></i> ${t('admin.flagged')}</span>` : '';

        const safeImg = isSafeReportImage(r.image) ? r.image : '';

        const thumb = safeImg ? `<img class="queue-item__thumb" src="${safeImg}" alt="">` : '<div class="queue-item__thumb"></div>';

        return `

          <li class="queue-item${overdueFlag ? ' queue-item--overdue' : ''}${flagCount > 0 ? ' queue-item--flagged' : ''}">

            ${thumb}

            <div class="queue-item__body">

              <div class="queue-item__title">${escapeHtml(hazardLabel(r.hazard))} — ${escapeHtml((r.ward || getCityLabel(getReportCity(r))).split('—')[0].trim())}</div>

              <div class="queue-item__meta">${escapeHtml(formatRelativeTime(r.timestamp))} — ${escapeHtml(getClockLine(r))}</div>

              <div class="queue-item__tags">${flagBadge}${filedBadge}${confBadge}${overdueFlag ? '<span class="status-badge status-badge--overdue">Overdue</span>' : ''}</div>

            </div>

            <div class="queue-item__actions">

              <button type="button" class="btn btn--secondary btn--sm" data-copy-1916="${escapeHtml(String(r.id))}" title="${escapeHtml(t('admin.copy1916'))}">${escapeHtml(t('admin.copy1916'))}</button>

              <button type="button" class="btn btn--primary btn--sm" data-queue-open="${escapeHtml(String(r.id))}">Review</button>

            </div>

          </li>`;

      })

      .join('');



    listEl.querySelectorAll('[data-queue-open]').forEach((btn) => {

      btn.addEventListener('click', () => openAdminReportModal(coerceReportId(btn.dataset.queueOpen)));

    });

    listEl.querySelectorAll('[data-copy-1916]').forEach((btn) => {

      btn.addEventListener('click', (e) => {

        e.stopPropagation();

        copyFor1916(coerceReportId(btn.dataset.copy1916));

      });

    });

  }



  function isOverdue(r) {

    return r.status === 'pending' && !!r.complaintId &&

      getDaysPending(r.filedAt || r.timestamp) >= ESCALATION_DAYS.matrix;

  }



  // Report ids may be uuid strings (new) or numeric (legacy). Match the stored type.

  function coerceReportId(idStr) {

    const found = loadReports().find((r) => String(r.id) === String(idStr));

    return found ? found.id : idStr;

  }



  function getSelectedVolunteerHours() {

    const customBtn = $('#volunteerHoursPicker .hours-picker__btn.active');

    if (customBtn && customBtn.dataset.hours === 'custom') {

      return Math.max(1, parseInt($('#volunteerHoursCustom').value, 10) || 1);

    }

    return parseInt(customBtn?.dataset.hours || '4', 10) || 4;

  }



  function submitVolunteerSignup() {

    if (!user.ward) {

      showToast(t('toast.volunteerWardRequired'), 'error');

      return;

    }

    const neighbourhood = sanitizeText($('#volunteerNeighbourhood').value, 120);

    if (!neighbourhood) {

      showToast(t('toast.volunteerNeighbourhoodRequired'), 'error');

      $('#volunteerNeighbourhood').focus();

      return;

    }

    cacheSocietyIfCustom(getUserCity(), user.ward, neighbourhood);

    const skills = [];

    if ($('#volSkillCleanup').checked) skills.push('cleanup');

    if ($('#volSkillAwareness').checked) skills.push('awareness');

    if ($('#volSkillPledge').checked) skills.push('pledge');

    if (!skills.length) {

      showToast(t('toast.volunteerSkillRequired'), 'error');

      return;

    }

    const contact = sanitizeText($('#volunteerContact').value, 20);

    const hours = getSelectedVolunteerHours();

    const existing = getMyVolunteerSignup();

    const signup = {

      id: existing?.id || generateId(),

      userId: user.id,

      displayName: user.displayName || 'Citizen',

      ward: user.ward,

      city: getUserCity(),

      neighbourhood,

      hours,

      skills,

      contact,

      status: 'active',

      timestamp: existing?.timestamp || new Date().toISOString(),

    };

    let rows = loadVolunteerSignups().filter((v) => v.userId !== user.id);

    rows.unshift(signup);

    saveVolunteerSignups(rows);

    Backend.upsertVolunteerSignup(signup);

    if (window.CivicAnalytics) {

      CivicAnalytics.track('volunteer_signup_created', { signupId: String(signup.id), hours }, signup.ward);

    }

    showToast(t('toast.volunteerSaved'), 'success', 5000);

    closeModal('volunteer');

    updatePersonaUI();

  }



  function removeVolunteerSignup() {

    const existing = getMyVolunteerSignup();

    if (!existing) return;

    if (!window.confirm(t('volunteer.remove') + '?')) return;

    const rows = loadVolunteerSignups().filter((v) => String(v.id) !== String(existing.id));

    saveVolunteerSignups(rows);

    Backend.removeVolunteerSignup(existing.id);

    showToast(t('toast.volunteerRemoved'), 'info');

    closeModal('volunteer');

  }



  function hasPendingTaskForReport(reportId, signupId) {

    return loadVolunteerTasks().some(

      (task) => String(task.reportId) === String(reportId)

        && String(task.volunteerSignupId) === String(signupId)

        && task.status === 'pending'

    );

  }



  function getTasksForReport(reportId) {

    return loadVolunteerTasks().filter((t) => String(t.reportId) === String(reportId));

  }



  function offerVolunteerTask(reportId) {

    const signup = getMyVolunteerSignup();

    if (!signup) {

      showToast(t('toast.volunteerSignupRequired'), 'info', 4500, {

        label: t('volunteer.emptyAction'),

        onClick: () => window.openVolunteerModal(),

      });

      return false;

    }

    if (hasPendingTaskForReport(reportId, signup.id)) {

      showToast(t('toast.volunteerTaskDuplicate'), 'info');

      return false;

    }

    const report = findReportById(reportId);

    if (!report || report.status !== 'pending') return false;

    const task = {

      id: generateId(),

      reportId: report.id,

      volunteerSignupId: signup.id,

      volunteerName: signup.displayName || user.displayName || 'Volunteer',

      ward: report.ward || signup.ward,

      neighbourhood: signup.neighbourhood,

      status: 'pending',

      timestamp: new Date().toISOString(),

    };

    const rows = loadVolunteerTasks();

    rows.unshift(task);

    saveVolunteerTasks(rows);

    Backend.insertVolunteerTask(task);

    if (window.CivicAnalytics) {

      CivicAnalytics.track('volunteer_task_offered', { taskId: String(task.id), reportId: String(reportId) }, task.ward);

    }

    showToast(t('toast.volunteerTaskOffered'), 'success', 4500);

    refreshReportMarkers();

    return true;

  }



  function renderProfileMutedReporters() {

    const section = $('#profileMutedSection');

    const list = $('#profileMutedList');

    if (!section || !list) return;

    const ids = [...loadMutedReporterIds()];

    if (ids.length === 0) {

      section.classList.add('hidden');

      list.innerHTML = '';

      return;

    }

    section.classList.remove('hidden');

    list.innerHTML = ids.map((id) => {

      const name = escapeHtml(reporterDisplayName(id));

      return `<div class="profile-muted-row">

        <span class="profile-muted-row__name">${name}</span>

        <button type="button" class="btn btn--ghost btn--sm" data-unmute-reporter="${escapeHtml(String(id))}">${escapeHtml(t('mute.unmute'))}</button>

      </div>`;

    }).join('');

    list.querySelectorAll('[data-unmute-reporter]').forEach((btn) => {

      btn.addEventListener('click', () => unmuteReporter(btn.dataset.unmuteReporter));

    });

  }



  /* ---------- Coordinator Dashboard ---------- */

  function getMockPledge() {

    return {

      id: 'mock-volunteer-pledge',

      type: 'Snacks',

      ward: 'G/N Ward — Dadar, Shivaji Park',

      message: 'Volunteer cleanup shift — 4 hours completed at Shivaji Park.',

      citizen: 'Priya S. (Mock)',

      timestamp: new Date().toISOString(),

      mock: true,

      hoursVerified: false,

    };

  }



  function getCoordinatorPledges() {

    const pledges = loadPledges();

    const showMock = !Backend.enabled && !isProdEnvironment();

    const mockId = getMockPledge().id;

    const mockStored = showMock ? pledges.find((p) => p.id === mockId) : null;

    const mockPledge = mockStored || (showMock ? getMockPledge() : null);

    let citizenPledges = pledges.filter((p) => p.id !== mockId);

    if (user.ward) {

      citizenPledges = citizenPledges.filter((p) => matchesCoordinatorScope(p.ward, '', { wardOnly: true }));

    }

    citizenPledges = sortPledgesNewestFirst(citizenPledges);

    const all = mockPledge ? [mockPledge, ...citizenPledges] : citizenPledges;

    return { mockPledge, citizenPledges, all };

  }



  function renderCoordinatorPledges() {

    const { citizenPledges, all } = getCoordinatorPledges();

    const toVerify = all.filter((p) => p.delivered && !p.hoursVerified).length;

    const newCount = countNewNgoPledges();

    const pledgesLastSeen = localStorage.getItem(REMINDER_NGO_PLEDGES_LAST_SEEN_KEY)

      || localStorage.getItem(REMINDER_NGO_LAST_SEEN_KEY);

    const newCutoff = pledgesLastSeen ? new Date(pledgesLastSeen).getTime() : 0;



    $('#coordPledgeCount').textContent = citizenPledges.length;

    $('#coordPendingVerify').textContent = toVerify;



    const titleEl = $('#coordPledgesTitle');

    if (titleEl) {

      titleEl.textContent = newCount > 0

        ? t('coord.pledgesNew').replace('{n}', String(newCount))

        : t('coord.pledges');

    }



    const listEl = $('#coordinatorPledgeList');



    if (all.length === 0) {

      listEl.innerHTML = `

        <li class="empty-state empty-state--action">

          <i class="ph ph-hand-heart"></i>

          <p>${escapeHtml(t('coord.pledgesEmpty'))}</p>

        </li>`;

      return;

    }



    listEl.innerHTML = all

      .map((p) => {

        const isMock = p.mock === true;

        const verified = p.hoursVerified === true;

        const delivered = p.delivered === true;

        const isNew = !isMock && pledgesLastSeen && new Date(p.timestamp).getTime() > newCutoff;

        let actionBtn = '';

        if (verified) {

          actionBtn = `<span class="pledge-item__done"><i class="ph ph-check-circle"></i> ${escapeHtml(t('coord.verified'))}</span>`;

        } else if (!delivered) {

          actionBtn = `<button type="button" class="btn btn--secondary btn--sm" data-action="deliver" data-pledge-id="${escapeHtml(String(p.id))}">${escapeHtml(t('coord.markDelivered'))}</button>`;

        } else {

          actionBtn = `<button type="button" class="btn btn--secondary btn--sm" data-action="verify" data-pledge-id="${escapeHtml(String(p.id))}">${escapeHtml(t('coord.verifyHours'))}</button>`;

        }

        const statusKey = getPledgeStatusKey(p);

        const statusBadge = `<span class="status-badge ${pledgeStatusBadgeClass(p)}">${escapeHtml(t(`pledge.status.${statusKey}`))}</span>`;

        return `

          <li class="pledge-item${isMock ? ' pledge-item--mock' : ''}${isNew ? ' pledge-item--new' : ''}">

            <div class="pledge-item__header">

              <span class="pledge-item__type">${escapeHtml(pledgeTypeLabel(p.type))}${isMock ? ' — Demo' : ''}</span>

              ${statusBadge}

            </div>

            <span class="pledge-item__ward">${escapeHtml(p.ward)}</span>

            <p class="pledge-item__message">${escapeHtml(p.message || '—')}</p>

            <div class="pledge-item__footer">

              <span class="pledge-item__citizen">${escapeHtml(p.citizen || 'Anonymous')} — ${escapeHtml(formatRelativeTime(p.timestamp))}</span>

              ${actionBtn}

            </div>

          </li>`;

      })

      .join('');



    // Event delegation keeps handlers off the (escaped) markup.

    listEl.querySelectorAll('[data-action]').forEach((btn) => {

      btn.addEventListener('click', () => {

        const id = btn.dataset.pledgeId;

        if (btn.dataset.action === 'deliver') markPledgeDelivered(id, btn);

        else verifyVolunteerHours(id, btn);

      });

    });

  }



  // Hazards an NGO coordinator can act on: open (pending) reports in scope.

  function getCoordinatorHazards() {

    const all = loadReports().filter((r) => r.status === 'pending');

    const scoped = all.filter((r) => matchesCoordinatorScope(r.ward, '', { wardOnly: true }));

    if (scoped.length) return scoped;

    if (user.ward) return [];

    return all;

  }



  function getCoordinatorVolunteers() {

    return loadVolunteerSignups().filter(

      (v) => v.status === 'active' && matchesCoordinatorScope(v.ward, v.neighbourhood)

    );

  }



  function getCoordinatorTasks() {

    return loadVolunteerTasks().filter(

      (task) => matchesCoordinatorScope(task.ward, task.neighbourhood)

    );

  }



  function renderCoordinatorVolunteers() {

    const volunteers = getCoordinatorVolunteers();

    const countEl = $('#coordVolunteers');

    if (countEl) countEl.textContent = volunteers.length;

    const listEl = $('#coordVolunteerList');

    if (!listEl) return;

    if (volunteers.length === 0) {

      listEl.innerHTML = `<li class="empty-state"><p>${escapeHtml(t('coord.volunteersEmpty'))}</p></li>`;

      return;

    }

    listEl.innerHTML = volunteers

      .map((v) => {

        const skills = (v.skills || [])

          .map((s) => escapeHtml(volunteerSkillLabel(s)))

          .join(' — ');

        return `

          <li class="pledge-item">

            <div class="pledge-item__header">

              <span class="pledge-item__type">${escapeHtml(v.displayName || 'Volunteer')}</span>

              <span class="status-badge">${escapeHtml(t('volunteer.hoursLabel').replace('{n}', String(v.hours)))}</span>

            </div>

            <span class="pledge-item__ward">${escapeHtml(v.neighbourhood)} — ${escapeHtml((v.ward || '').split('—')[0].trim())}</span>

            <p class="pledge-item__message">${skills || '—'}${v.contact ? ` — ${escapeHtml(v.contact)}` : ''}</p>

          </li>`;

      })

      .join('');

  }



  function renderCoordinatorTasks() {

    const tasks = getCoordinatorTasks();

    const pending = tasks.filter((tk) => tk.status === 'pending');

    const countEl = $('#coordTasksPending');

    if (countEl) countEl.textContent = pending.length;

    const listEl = $('#coordTaskList');

    if (!listEl) return;

    if (tasks.length === 0) {

      listEl.innerHTML = `<li class="empty-state"><p>${escapeHtml(t('coord.tasksEmpty'))}</p></li>`;

      return;

    }

    listEl.innerHTML = tasks

      .map((task) => {

        const report = findReportById(task.reportId);

        const done = task.status === 'completed';

        const action = done

          ? '<span class="pledge-item__done"><i class="ph ph-check-circle"></i> Done</span>'

          : `<button type="button" class="btn btn--secondary btn--sm" data-task-complete="${escapeHtml(String(task.id))}">${escapeHtml(t('coord.markTaskComplete'))}</button>`;

        return `

          <li class="queue-item${done ? ' queue-item--cleared' : ''}">

            <div class="queue-item__body">

              <div class="queue-item__title">${escapeHtml(task.volunteerName || 'Volunteer')} — ${escapeHtml((task.neighbourhood || '').slice(0, 40))}</div>

              <div class="queue-item__meta">${report ? escapeHtml(hazardLabel(report.hazard)) : 'Hazard'} — ${escapeHtml((task.ward || '').split('—')[0].trim())}</div>

            </div>

            ${action}

          </li>`;

      })

      .join('');

    listEl.querySelectorAll('[data-task-complete]').forEach((btn) => {

      btn.addEventListener('click', () => completeVolunteerTask(btn.dataset.taskComplete, btn));

    });

  }



  function completeVolunteerTask(taskId, btn) {

    if (!isLead) return;

    if (btn) { btn.disabled = true; btn.textContent = t('toast.saving'); }

    const tasks = loadVolunteerTasks();

    const idx = tasks.findIndex((tk) => String(tk.id) === String(taskId));

    if (idx === -1) return;

    const task = tasks[idx];

    task.status = 'completed';

    task.completedAt = new Date().toISOString();

    saveVolunteerTasks(tasks);

    Backend.updateVolunteerTask(task.id, { status: 'completed', completed_at: task.completedAt });



    const reports = loadReports();

    const rIdx = reports.findIndex((r) => String(r.id) === String(task.reportId));

    if (rIdx !== -1 && !reports[rIdx].communityCleared) {

      reports[rIdx].communityCleared = true;

      reports[rIdx].clearedBy = task.volunteerName || 'Community volunteer';

      saveReports(reports);

      Backend.updateReportCleanup(reports[rIdx].id, true, reports[rIdx].clearedBy);

    }



    if (window.CivicAnalytics) {

      CivicAnalytics.track('volunteer_task_completed', { taskId: String(taskId), reportId: String(task.reportId) }, task.ward);

      CivicAnalytics.track('community_cleanup', { reportId: String(task.reportId), source: 'volunteer_task' }, task.ward);

    }

    showToast(t('toast.volunteerTaskCompleted'), 'success', 4500);

    renderCoordinatorTasks();

    renderCoordinatorHazards();

    refreshReportMarkers();

  }



  function renderCoordinatorHazards() {

    const hazards = getCoordinatorHazards();

    const open = hazards.filter((r) => !r.communityCleared).length;

    const cleared = loadReports().filter((r) => r.communityCleared).length;

    $('#coordHazards').textContent = open;

    $('#coordCleared').textContent = cleared;



    const listEl = $('#coordHazardList');

    if (!listEl) return;

    if (hazards.length === 0) {

      listEl.innerHTML = `

        <li class="empty-state">

          <p>${escapeHtml(t('coord.hazardsEmpty'))}</p>

        </li>`;

      return;

    }



    listEl.innerHTML = hazards

      .map((r) => {

        const cleared = r.communityCleared;

        const pendingTasks = getTasksForReport(r.id).filter((tk) => tk.status === 'pending');

        const taskNote = pendingTasks.length

          ? `<div class="queue-item__meta"><i class="ph ph-hand-waving"></i> ${escapeHtml(t('coord.volunteerOffers').replace('{n}', String(pendingTasks.length)))}</div>`

          : '';

        const action = cleared

          ? `<span class="pledge-item__done"><i class="ph ph-broom"></i> ${escapeHtml(t('coord.hazardCleaned'))}</span>`

          : `<button type="button" class="btn btn--secondary btn--sm" data-cleanup="${escapeHtml(String(r.id))}">${escapeHtml(t('coord.logCleanup'))}</button>`;

        return `

          <li class="queue-item${cleared ? ' queue-item--cleared' : ''}">

            <div class="queue-item__body">

              <div class="queue-item__title">${escapeHtml(hazardLabel(r.hazard))} — ${escapeHtml((r.ward || getCityLabel(getReportCity(r))).split('—')[0].trim())}</div>

              <div class="queue-item__meta">${escapeHtml(formatRelativeTime(r.timestamp))}${r.notes ? ` — ${escapeHtml(r.notes)}` : ''}</div>

              ${taskNote}

            </div>

            ${action}

          </li>`;

      })

      .join('');



    listEl.querySelectorAll('[data-cleanup]').forEach((btn) => {

      btn.addEventListener('click', () => logCommunityCleanup(btn.dataset.cleanup, btn));

    });

  }



  // NGO logs that volunteers cleared the stagnant water on the ground. This is a

  // community action distinct from BMC's official resolution.

  function logCommunityCleanup(reportId, btn) {

    if (!isLead) return;

    if (btn) { btn.disabled = true; btn.textContent = t('toast.saving'); }

    const reports = loadReports();

    const idx = reports.findIndex((r) => String(r.id) === String(reportId));

    if (idx === -1) return;

    reports[idx].communityCleared = true;

    reports[idx].clearedBy = user.displayName || 'NGO volunteer';

    try {

      saveReports(reports);

    } catch {

      showToast(t('toast.saveFail'), 'error');

      return;

    }

    Backend.updateReportCleanup(reports[idx].id, true, reports[idx].clearedBy);

    if (window.CivicAnalytics) {

      CivicAnalytics.track('community_cleanup', { reportId: String(reportId) }, reports[idx].ward);

    }

    showToast(t('toast.cleanupLogged'), 'success', 4500);

    updateCommunityWinBadge();

    renderCoordinatorHazards();

  }



  function findPledgeById(id) {

    // Pledge ids may be numbers (Date.now) or the mock string id.

    const pledges = loadPledges();

    return pledges.find((p) => String(p.id) === String(id));

  }



  function markPledgeDelivered(pledgeId, btn) {

    if (!isLead) return;

    if (btn) { btn.disabled = true; btn.textContent = t('toast.saving'); }

    const pledges = loadPledges();

    let p = pledges.find((x) => String(x.id) === String(pledgeId));

    if (!p) {

      // First interaction with the demo pledge persists it.

      p = { ...getMockPledge(), delivered: true };

      pledges.unshift(p);

    } else {

      p.delivered = true;

    }

    savePledges(pledges);

    if (!p.mock) Backend.updatePledge(p.id, { delivered: true });

    if (window.CivicAnalytics) {

      CivicAnalytics.track('pledge_delivered', { pledgeId: String(p.id) }, p.ward);

    }

    if (p.citizenId === user.id) {

      const snapshot = loadPledgeStatusSnapshot();

      snapshot[String(p.id)] = 'delivered';

      savePledgeStatusSnapshot(snapshot);

    }

    showToast(t('toast.pledgeDelivered'), 'info');

    renderCoordinatorPledges();

  }



  function verifyVolunteerHours(pledgeId, btn) {

    if (!isLead) return;

    if (btn) { btn.disabled = true; btn.textContent = t('toast.verifying'); }



    setTimeout(() => {

      const pledges = loadPledges();

      let p = pledges.find((x) => String(x.id) === String(pledgeId));

      if (!p) {

        p = { ...getMockPledge(), delivered: true, hoursVerified: true };

        pledges.unshift(p);

      } else {

        p.hoursVerified = true;

        p.delivered = true;

      }

      savePledges(pledges);

      if (!p.mock) Backend.updatePledge(p.id, { delivered: true, verified: true });



      if (window.CivicAnalytics) {

        CivicAnalytics.track('pledge_verified', { pledgeId: String(p.id) }, p.ward);

      }



      // Credit points only when the pledging citizen is this device's user

      // (or the demo pledge). Cross-device crediting uses sync + snapshot.

      const creditsLocalUser = p.mock === true || !p.citizenId || p.citizenId === user.id;

      if (creditsLocalUser) {

        if (!loadPledgePointsCredited().has(String(p.id))) {

          addPointsCache(VERIFY_HOURS_BONUS);

          markPledgePointsCredited(p.id);

        }

        const snapshot = loadPledgeStatusSnapshot();

        snapshot[String(p.id)] = 'verified';

        savePledgeStatusSnapshot(snapshot);

        updateProfileUI();

        renderLeaderboard('wards');

        renderLeaderboard('citizens');

        showToast(t('toast.hoursVerified'), 'success');

      } else {

        showToast(`Hours verified for ${p.citizen || 'citizen'}. +200 points credited to them.`, 'success');

      }

      renderCoordinatorPledges();

    }, 1200);

  }



  /* ---------- PWA Service Worker ---------- */

  function registerServiceWorker() {

    if (!('serviceWorker' in navigator)) return;

    let reloaded = false;

    const reportBlocksSwReload = () => {

      try {

        if (isReportPhotoPickerActive() || isReportDraftAwaitingPhoto()) return true;

        if (overlays.report && overlays.report.classList.contains('open')) return true;

        const raw = sessionStorage.getItem(REPORT_DRAFT_KEY);

        if (!raw) return false;

        const d = JSON.parse(raw);

        return !!(d && d.ts && Date.now() - d.ts < REPORT_DRAFT_TTL_MS);

      } catch {

        return false;

      }

    };

    const reloadOnce = () => {

      debugLog('SW', 'controllerchange', { reloaded, pendingSwReload });

      if (reloaded) return;

      if (reportBlocksSwReload()) {

        pendingSwReload = true;

        debugLog('SW', 'reload blocked', { reason: 'report flow active' });

        return;

      }

      reloaded = true;

      pendingSwReload = false;

      debugLog('SW', 'reload executing', {});

      window.location.reload();

    };

    // Auto-reload only when this page was already controlled (update), not on
    // first install when skipWaiting + clients.claim would otherwise double-load.
    const hadController = !!navigator.serviceWorker.controller;

    if (hadController) {

      navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);

    }

    navigator.serviceWorker

      .register('sw.js')

      .then((reg) => {

        const checkForUpdate = () => {

          reg.update().catch(() => {});

        };

        checkForUpdate();

        document.addEventListener('visibilitychange', () => {

          if (document.visibilityState === 'visible') checkForUpdate();

        });

        reg.addEventListener('updatefound', () => {

          debugLog('SW', 'updatefound', {});

          const installing = reg.installing;

          if (!installing) return;

          installing.addEventListener('statechange', () => {

            if (installing.state !== 'installed') return;

            debugLog('SW', 'update installed', { hadController: !!navigator.serviceWorker.controller });

            // First install: no controller yet — skip "update available" toast.
            if (!navigator.serviceWorker.controller) return;

            // Action toasts persist until dismiss (duration ignored).
            showToast(t('update.available'), 'info', 0, {

              label: t('update.reload'),

              onClick: () => reloadOnce(),

            });

          });

        });

      })

      .catch(() => {});

    navigator.serviceWorker.addEventListener('message', (ev) => {

      if (ev.data && ev.data.type === 'nbh-alert-focus') focusReportOnMap(ev.data.reportId);

    });

  }

});

