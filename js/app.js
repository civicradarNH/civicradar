/**
 * CivicRadar — Core JavaScript Logic
 * Strict DOMContentLoaded bindings · localStorage · Haversine spam filter
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ---------- Constants ---------- */
  const REPORTS_KEY = 'mosquiTrackReports';
  const USER_KEY = 'civicradar_user';
  const PLEDGES_KEY = 'mosquiTrackPledges';
  const POINTS_CACHE_KEY = 'mosquiTrackPoints';
  const COACH_KEY = 'civicradar_coach_seen';
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
  const REMINDER_PRIORITY = { escalation: 1, corroboration: 2, staleCheck: 3, cleanup: 4, unfiled: 5 };
  const MAX_SESSION_REMINDERS = 2;
  const HIDDEN_REPORTS_KEY = 'civicradar_hidden_reports';
  const WEEK_BONUS_KEY = 'civicradar_week_bonus';
  const FIRST_SHARE_KEY = 'civicradar_first_share_done';
  const SUCCESS_STORIES_SEEN_KEY = 'civicradar_success_stories_seen';
  const VISIT_COUNT_KEY = 'civicradar_visit_count';
  const PWA_NUDGE_KEY = 'civicradar_pwa_nudge_dismissed';
  const POINTS_PER_REPORT = 50;
  const POINTS_WEEK_BONUS = 25;
  const POINTS_FIRST_SHARE = 10;
  const POINTS_COMMUNITY_RESOLVE_REPORTER = 25;
  const POINTS_FIX_CONFIRM = 10;
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
    portalUrl: 'https://portal.mcgm.gov.in/irj/portal/anonymous/qlcomplaintreg?guest_user=english',
    twitter: 'mybmc',                    // @mybmc (X handles civic complaints)
    aapleSarkar: 'https://aaplesarkar.mahaonline.gov.in/', // Maharashtra state grievance portal
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
  window.isAdmin = false;
  window.isLead = false;

  /* ---------- State ---------- */
  let map = null;
  let userMarker = null;
  let reportMarkerLayer = null;
  const reportMarkerMap = new Map();
  let lastReportDataUrl = null;
  let lastReportId = null;
  let currentLat = null;
  let currentLng = null;
  let lastGeoRequest = 0;
  let markerRefreshTimer = null;
  let activeAdminReportId = null;
  let adminProofDataUrl = null;
  let activeEscalationId = null;
  let pendingShareWinReportId = null;
  let pendingShareWinType = 'resolved';
  let pendingSuccessCardBlob = null;
  let lastFocusedEl = null;
  let focusTrapHandler = null;

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
    success: $('#successOverlay'),
    community: $('#communityOverlay'),
    pledge: $('#pledgeOverlay'),
    volunteer: $('#volunteerOverlay'),
    profile: $('#profileOverlay'),
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
  };

  let user;
  let deferredInstallPrompt = null;
  let pwaNudgeVisible = false;
  let pendingPwaNudge = false;

  // Project config — founder story & monetization (see js/config.js)
  const CFG = window.CIVICRADAR_CONFIG || {};
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
    const input = $('#wardInput');
    if (input) input.setAttribute('list', wardDatalistId(city));
    const hint = $('#wardHint');
    if (hint) {
      const wardCount = (CivicWardDetect && CivicWardDetect.getWardNames)
        ? CivicWardDetect.getWardNames(city).length
        : 0;
      hint.textContent = t('onboard.wardHint').replace('{city}', getCityLabel(city)).replace('{n}', String(wardCount));
    }
    const hdr = $('#headerContext');
    if (hdr && getActivePersona() === 'citizen') {
      hdr.textContent = t('header.contextCity').replace('{city}', getCityLabel(city));
    }
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
  function getModCfg() {
    return window.ImageModeration
      ? ImageModeration.mergeConfig((window.CIVICRADAR_CONFIG || {}).moderation)
      : { enabled: false };
  }

  /* ---------- Utilities ---------- */
  function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Strip markup from user-entered text before storing or displaying.
  function sanitizeText(value, maxLen) {
    const cleaned = String(value || '').replace(/<[^>]*>/g, '').trim();
    return maxLen ? cleaned.slice(0, maxLen) : cleaned;
  }

  function sanitizeDisplayName(name) {
    return sanitizeText(name, 30) || 'Citizen';
  }

  function generateId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /* ---------- Internationalisation (EN / HI / MR) ---------- */
  const I18N = {
    en: {
      'lang.name': 'English', 'lang.native': 'English',
      'nav.map': 'Map', 'nav.community': 'Community', 'nav.profile': 'Profile',
      'fab.report': 'Report',
      'header.context': 'Monsoon hazard map — Mumbai, Pune & Thane',
      'header.contextCity': 'Monsoon hazard map for {city}',
      'location.banner': 'Turn on location to pin hazards accurately.',
      'location.enable': 'Turn on',
      'coach.step': '#MonsoonGuardian · 30 sec', 'coach.title': 'Dengue\'s enemy? Stagnant water!',
      'coach.body': 'Tap Report, snap a photo — we pin it on your ward map. Neighbours can say Me too. Share on WhatsApp so more eyes see it.',
      'coach.got': 'Got it',
      'persona.citizen.idle': '🦟 Stagnant water = dengue risk. Tap Report — pin it on your ward map in 30 sec, then share on WhatsApp.',
      'persona.wardImpact': '{ward}: {n} monsoon reports — dengue starts in stagnant lanes. #MonsoonGuardian',
      'persona.unfiled': '{n} open on the ward map — share with neighbours or file officially from Profile.',
      'persona.pendingFiled': '{n} open on the ward map — check Profile if overdue.',
      'persona.admin.idlePending': '{n} pending — open the queue or tap red pins.',
      'persona.admin.idleEmpty': 'No pending reports. New citizen pins appear here.',
      'persona.admin.header': 'BMC review mode',
      'persona.admin.exit': 'Exit BMC mode',
      'persona.ngo.header': 'NGO coordinator mode',
      'persona.ngo.exit': 'Exit NGO mode',
      'onboard.title': 'Welcome to CivicRadar',
      'onboard.subtitle': 'Pin stagnant water in 30 sec · rally neighbours · beat rival wards. #MonsoonGuardian',
      'onboard.city': 'Your city',
      'onboard.cityHint': 'Choose where you live — we detect your ward from GPS next.',
      'onboard.ward': 'Your Ward', 'onboard.wardPh': 'Start typing your ward…',
      'onboard.wardHint': 'Pick from {city}\'s {n} official wards.',
      'onboard.wardDetecting': 'Detecting your ward from location…',
      'onboard.wardDetectedHint': 'Approximate ward from GPS — not an official boundary survey.',
      'onboard.wardManual': 'Not right? Pick manually',
      'onboard.wardRetry': 'Try detecting again',
      'onboard.wardDetectFailed': 'Could not detect ward — pick manually or allow location.',
      'onboard.name': 'Display Name', 'onboard.namePh': 'What should neighbours call you?',
      'onboard.join': 'Join your ward',
      'onboard.wardError': 'Pick a ward from the list or allow location.',
      'report.title': 'Report a hazard',
      'report.step.photo': 'Photo', 'report.step.details': 'Details', 'report.step.submit': 'Submit',
      'report.hazardType': 'Hazard Type', 'report.photoEvidence': 'Photo',
      'report.capture': 'Take photo',
      'report.notes': 'Notes (optional)', 'report.notesPh': 'Add a note — lane, building, landmark…',
      'report.submit': 'Submit report',
      'moderation.guidelines': 'Clear onsite photo of the hazard only. No selfies, IDs, or unrelated images — location data is stripped for privacy.',
      'moderation.scanning': 'Checking photo…',
      'moderation.blocked.fileType': 'Only JPEG, PNG, or WebP hazard photos are allowed.',
      'moderation.blocked.fileSize': 'Photo is too large. Use a smaller image (max 8 MB).',
      'moderation.blocked.lowQuality': 'Photo is too small or unclear. Move closer to the hazard.',
      'moderation.blocked.irrelevant': 'Use a photo of the hazard — not a selfie, document, or blank image.',
      'moderation.blocked.sensitive': 'Avoid IDs, documents, or screenshots. Show the hazard only.',
      'moderation.blocked.nsfw': 'This photo was blocked for inappropriate content.',
      'moderation.blocked.offline': 'Connect to the internet to verify photo safety.',
      'success.title': 'Report logged', 'success.tagline': 'On your ward map',
      'success.taglineNeighbours': '{n} neighbour(s) already backing nearby spots — yours is on the ward map too!',
      'success.subtitle': 'Optional: file with {corp} (free) to start the official clock.',
      'success.step1': 'Share on WhatsApp so neighbours see the ward pin',
      'success.step2': 'Optional: file with {corp} and save your complaint number',
      'success.step3': 'Volunteers or {corp} can confirm when fixed — earn Civic Points',
      'success.file': 'File with BMC (optional)',
      'success.fileCorp': 'File with {corp} (optional)',
      'success.tag': 'Tag @mybmc', 'success.alert': 'Alert neighbours', 'success.done': 'Done',
      'success.sharePrompt': 'Share on WhatsApp now — more neighbours on the ward map helps pressure for a fix.',
      'success.shareWhatsapp': 'Share on WhatsApp',
      'success.shareNudge': 'Neighbours may not know yet — share on WhatsApp so the ward map gets more eyes.',
      'success.shareMsg': '🦟 {hazard} in {ward} — dengue risk! Pinned on CivicRadar ward map.\nTap Me too and report hazards in your lane:\n{link}\n\n{marathi}\n{hashtags}',
      'share.marathiHook': 'पावसाळ्यात साचलेलं पाणी? वॉर्ड नकाशा पहा →',
      'share.appMsg': '🗺️ {city} monsoon map — pin stagnant water, tap Me too, beat rival wards!\n{link}\n\n{marathi}\n{hashtags}',
      'share.meTooMsg': '👋 Me too — I see {hazard} in {ward} too. {n} neighbour(s) backed on CivicRadar:\n{link}\n\n{marathi}\n{hashtags}',
      'share.meTooBtn': 'Share on WhatsApp',
      'share.wardMapMsg': '⚡ {ward}: {pending} open dengue-risk spots — beat us on CivicRadar!\n{link}\n\n{marathi}\n{hashtags}',
      'share.cleanupMsg': '🧹 Volunteers cleared {hazard} in {ward}! Before → after on the ward map:\n{link}\n\n{marathi}\n{hashtags}',
      'share.instagramCaption': '{hazard} spot cleared in {ward} 🎉 Before → After on CivicRadar. Monsoon win.\n{link}\n\n{marathi}\n{hashtags}',
      'share.instagramCleanupCaption': 'Volunteers cleared {hazard} in {ward} 🧹 Before → After on CivicRadar.\n{link}\n\n{marathi}\n{hashtags}',
      'share.milestoneMsg': '🏆 {ward} just hit {n} fixes this monsoon on CivicRadar! Can your ward beat us?\n{link}\n\n{marathi}\n{hashtags}',
      'share.firstBonus': 'First share — +10 Civic Points! 🎉',
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
      'about.shareTitle': 'Share this app',
      'about.sharePitch': 'Free {city} monsoon map — pin stagnant water in 30 sec, say Me too, beat rival wards.\nBuilt by a NJ student with family in India. No login, 4 languages.\n{link}\nForward to your RWA / society WhatsApp group →',
      'about.copyPitch': 'Copy WhatsApp pitch',
      'about.pitchCopied': 'Pitch copied — paste in your RWA / school group!',
      'pwa.nudge': 'Monsoon-ready: Add CivicRadar to Home Screen for one-tap reporting.',
      'pwa.nudgeAction': 'Add to Home Screen',
      'pwa.nudgeDismiss': 'Not now',
      'community.challengeShare': 'Challenge a friend — share ward map',
      'community.winsTitle': 'Wins this monsoon',
      'community.winsEmpty': 'Fixed spots appear here — report, rally neighbours, celebrate wins.',
      'community.winsNeighbours': 'Neighbours in {ward}',
      'community.winsCleanup': '{hazard} cleared · {ward}',
      'community.winsResolved': '{hazard} fixed · {ward}',
      'success.points': 'Civic Points earned', 'success.weekBonus': '+{n} first report this week!',
      'map.empty': 'Clean map in {ward} — be the #MonsoonGuardian! Report stagnant water before dengue spreads.',
      'map.emptyAction': 'Report first hazard',
      'map.emptyShare': 'Invite neighbours on WhatsApp',
      'map.emptyRival': '{ward} vs {rival} — they have {pending} open spots. Report or rally neighbours!',
      'map.legend.pending': 'Open',
      'map.legend.resolved': 'Fixed',
      'map.legend.you': 'You',
      'map.legend.aria': 'Map legend: open, fixed, and your pins',
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
      'persona.ngo.pledges': '{deliver} to deliver · {verify} to verify',
      'persona.ngo.newHazards': '{n} new hazards',
      'persona.ngo.newPledges': '{n} new pledge(s)',
      'persona.admin.overdue': '{overdue} overdue · {pending} pending — tap to open queue',
      'profile.badge.reporter': 'Active Reporter',
      'profile.badge.2week': '2-Week Reporter',
      'profile.badge.3week': '3-Week Reporter',
      'profile.badge.monsoon': 'Monsoon Guardian',
      'profile.wardImpact': 'Your ward: {n} reports this monsoon',
      'profile.streak': '{n}-week reporting streak',
      'confirm.nearby': 'Pin {m}m away{backing}. Tap Me too instead of duplicating — get updates when fixed.',
      'esc.participate.title': 'Community action (optional)',
      'esc.participate.hint': 'Participate Mumbai is BMC’s official portal for volunteering and CSR — not for filing pest-control complaints. Use it to join clean-ups or propose ward projects.',
      'esc.participate.btn': 'Participate Mumbai',
      'esc.participate.small': 'Volunteer · CSR · projects',
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
      'esc.tmc.complaintWarn': 'This doesn’t look like a typical TMC reference — you can still save if it’s correct.',
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
      'esc.tmc.tier.file.body': 'Free. File on thanecity.gov.in, call 022-25331590 / 022-25331211, email mc@thanecity.gov.in, or use Citizen Call Center 155300. Save your reference number here.',
      'esc.tmc.tier.matrix.body': 'Follow up with your ward office or Health department (022-25332685). Quote your TMC reference number.',
      'esc.tmc.tier.zonal.body': 'Escalate to the Municipal Commissioner (mc@thanecity.gov.in). Tag @TMCaTweetAway on X with the photo for public visibility.',
      'esc.tmc.tier.grievance.body': 'Still ignored after a month? File with Aaple Sarkar (grievances.maharashtra.gov.in) — select Thane Municipal Corporation as local body.',
      'esc.tmc.tier.openCall': 'Call TMC',
      'esc.tmc.tier.openTweet': 'Tag @TMCaTweetAway',
      'esc.tmc.tier.openEmail': 'Email MC',
      'esc.tmc.tier.openAaple': 'Aaple Sarkar',
      'esc.tmc.consentRequired': 'Confirm you filed on an official TMC channel before saving.',
      'esc.pmc.subtitle': 'CivicRadar shows hazards on the community map. Filing with PMC is your choice — it starts the official clock. This is not a PMC channel.',
      'esc.pmc.recommended': 'Recommended: PMC CARE WhatsApp — fastest for most Pune wards.',
      'esc.pmc.fileHint': 'Stagnant water and mosquito breeding go through PMC CARE. Use any channel:',
      'esc.pmc.channelWa': 'PMC CARE WhatsApp',
      'esc.pmc.channelWaSmall': 'Chat · pre-fill below',
      'esc.pmc.channelCall': 'Toll-free helpline',
      'esc.pmc.channelPortal': 'PMC CARE portal',
      'esc.pmc.channelApp': 'PMC CARE app',
      'esc.pmc.channelAppSmall': 'Play Store · App Store (replaces PuneConnect)',
      'esc.pmc.copyBlock': 'Details for PMC CARE / WhatsApp / helpline',
      'esc.pmc.copyAllDone': 'Copied — paste when you file on PMC CARE, WhatsApp, or the helpline',
      'esc.pmc.portalHint': 'On PMC CARE portal or app: register a grievance for stagnant water / mosquito breeding. Paste the details below.',
      'esc.pmc.filedConsent': 'I filed on an official PMC channel (PMC CARE / WhatsApp / helpline / app)',
      'esc.pmc.complaintLabel': 'PMC complaint / reference number',
      'esc.pmc.complaintPh': 'e.g. PMC/2026/123456',
      'esc.pmc.complaintWarn': 'This doesn’t look like a typical PMC reference — you can still save if it’s correct.',
      'esc.pmc.filedNote': 'Filed with PMC — escalation steps unlock as deadlines pass.',
      'esc.pmc.daysSince': '{n} days since you filed with PMC',
      'esc.pmc.selfTitle': 'PMC fixed it?',
      'esc.pmc.selfBody': 'Confirm yourself once PMC fixes it (your complaint number is proof). Turns the pin green for everyone.',
      'esc.pmc.tier.file.body': 'Free. File on PMC CARE portal, WhatsApp, toll-free 1800 1030 222, or the PMC CARE app. Save your reference number here.',
      'esc.pmc.tier.matrix.body': 'Follow up via PMC CARE or the toll-free helpline, quoting your complaint number.',
      'esc.pmc.tier.zonal.body': 'Escalate through PMC CARE portal or WhatsApp if your ward has not acted.',
      'esc.pmc.tier.grievance.body': 'Still ignored after a month? File with Aaple Sarkar (grievances.maharashtra.gov.in) — select Pune Municipal Corporation as local body.',
      'esc.pmc.tier.openWa': 'Open WhatsApp',
      'esc.pmc.tier.openCall': 'Call PMC helpline',
      'esc.pmc.tier.openAaple': 'Aaple Sarkar',
      'esc.pmc.consentRequired': 'Confirm you filed on an official PMC channel before saving.',
      'esc.pmc.aaple': 'Aaple Sarkar — select Pune Municipal Corporation as local body',
      'copy1916.pmc.header': 'PMC complaint details (copy & paste for PMC CARE / WhatsApp / helpline)',
      'copy1916.pmc.complaintNotFiled': 'PMC complaint #: (not yet filed)',
      'copy1916.pmc.complaintFiled': 'PMC complaint #: {id}',
      'profile.fileCorp': 'File with {corp}',
      'community.title': 'Community',
      'community.subtitle': "Fix it together in {ward} — volunteer, pledge supplies, or file with BMC separately.",
      'community.subtitleActive': '{ward}: {pending} open on the map · {resolved} fixed — rally neighbours or volunteer.',
      'community.topWards': 'Top Wards', 'community.localCitizens': 'Local Citizens',
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
      'volunteer.neighbourhoodHint': 'Your RWA, society, or lane — helps neighbourhood leads match you to nearby spots.',
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
      'coord.tasksEmpty': 'No volunteer offers yet. Citizens tap “I can help clean this” on open hazard pins.',
      'coord.tasksPending': 'Tasks',
      'coord.volunteersLabel': 'Volunteers',
      'coord.markTaskComplete': 'Mark cleanup done',
      'coord.scopeWard': 'Ward lead · {ward}',
      'coord.scopeNbh': 'Neighbourhood lead · {label}',
      'profile.volunteer': 'My volunteer signup',
      'profile.title': 'Your Profile', 'profile.persona': 'Citizen',
      'profile.points': 'Total Civic Points', 'profile.fixed': 'Fixed', 'profile.pending': 'Open',
      'profile.reports': 'Your Reports',
      'profile.install': 'Install CivicRadar app', 'profile.partner': 'Volunteer / NGO login',
      'profile.about': 'About CivicRadar', 'profile.sponsor': 'Sponsor or partner with us',
      'profile.deleteData': 'Delete my data',
      'profile.deleteConfirm': 'Permanently delete your reports, pledges, volunteer signup, analytics, and profile from this device and cloud? This cannot be undone.',
      'profile.deleteDone': 'Your data has been deleted. You can start fresh.',
      'profile.withdrawAnalytics': 'Withdraw analytics consent',
      'profile.withdrawAnalyticsDone': 'Analytics consent withdrawn. Local analytics cleared.',
      'profile.withdrawGps': 'Withdraw location consent',
      'profile.withdrawGpsDone': 'Location consent withdrawn. Enable again from the map banner when needed.',
      'profile.privacyContact': 'Privacy / grievance contact',
      'legal.privacy': 'Privacy Policy',
      'legal.terms': 'Terms of Service',
      'impact.reports': 'Reports', 'impact.resolved': 'Fixed', 'impact.confirms': 'Me too',
      'impact.pledges': 'Pledges', 'impact.wards': 'Wards',
      'impact.week': 'This week: {reports} reports · {resolved} resolved · {confirms} confirmations',
      'impact.resolvedBreakdown': 'You: {self} · Community: {community} · BMC: {bmc} · Cleanup: {cleanup}',
      'about.title': 'About CivicRadar',
      'about.subtitle': 'Community app for Mumbai, Pune & Thane monsoon — built by a student with family in India. Free for citizens.',
      'about.impactTitle': 'Community impact', 'about.builtTitle': 'What we built',
      'about.sustainTitle': 'Sustainable & free for citizens',
      'about.sustainBody': 'CivicRadar stays free for residents. Future support comes from local partners — not paywalls on public safety.',
      'about.copyImpact': 'Copy impact summary', 'about.contact': 'Contact founder', 'about.contactOperator': 'Contact operator', 'about.close': 'Close',
      'about.sponsored': 'Sponsored',       'about.copied': 'Impact summary copied — paste into your application.',
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
      'hazard.stagnant-water': 'Stagnant Water', 'hazard.potholes': 'Potholes',
      'hazard.garbage': 'Garbage', 'hazard.streetlight': 'Broken Streetlight',
      'hazard.comingSoon': 'Coming soon',
      'soon.title': 'Coming soon', 'soon.notify': 'Notify me when it’s live',
      'soon.thanks': 'Thanks — we’ll notify you when this launches.',
      'soon.roadmap': 'Today: stagnant water. Next, based on your votes:',
      'confirm.metoo': 'Me too', 'confirm.you': 'Your report',
      'confirm.done': 'Following — updates when fixed',
      'confirm.thanks': 'Following — we\'ll tell you when it\'s fixed.',
      'confirm.none': 'Be the first to say Me too',
      'confirm.followHint': 'Not a BMC complaint — backs the community pin. You\'ll get updates when fixed.',
      'confirm.backingOne': ' · 1 neighbour',
      'confirm.backingMany': ' · {n} neighbours',
      'confirm.dupe': 'Already pinned within 10 m{backing}. Tap Me too — we\'ll notify you when fixed.',
      'confirm.dupeAction': 'Me too',
      'confirm.ownDupe': 'You already pinned this spot. Track it in Profile.',
      'profile.unfiledBanner': '{n} open — not filed with {corp} yet. Sharing helps too; each spot needs its own complaint if you file officially.',
      'profile.fileNext': 'File next',
      'confirm.resolved': 'A hazard you backed in {ward} was fixed!',
      'confirm.resolvedMany': '{n} hazards you backed were just fixed!',
      'confirm.shareBtn': 'Share',
      'confirm.shareMsg': '✅ Hazard I flagged in {ward} is FIXED on CivicRadar! Community pressure works:\n{link}\n\n{marathi}\n{hashtags}',
      'fix.looksFixed': 'Looks fixed now',
      'fix.done': 'You said looks fixed',
      'fix.thanks': 'Thanks — when enough neighbours agree, we mark it fixed.',
      'fix.countOne': '1 neighbour says fixed',
      'fix.countMany': '{n} neighbours say fixed',
      'fix.hint': 'Community spot-check only — not official BMC confirmation.',
      'fix.resolved': 'A spot you checked in {ward} was community-verified fixed!',
      'fix.resolvedMany': '{n} spots you checked were community-verified fixed!',
      'fix.afterPhotoPrompt': 'Optional: add an after photo from Profile.',
      'reminder.staleCheck': 'Spot near {ward} — still stagnant?',
      'reminder.stillThere': 'Still there',
      'reminder.looksFixed': 'Looks fixed',
      'profile.status.communityVerified': 'Community verified fixed',
      'profile.status.youMarkedFixed': 'You marked fixed',
      'profile.status.bmcResolved': 'BMC resolved',
      'profile.badge.communityVerified': 'Community verified',
      'profile.badge.youMarkedFixed': 'You marked fixed',
      'profile.badge.bmcResolved': 'BMC resolved',
      'community.winsCommunityVerified': '{hazard} community-verified · {ward}',
      'shareWin.subtitleCommunity': 'Neighbours confirmed this spot looks fixed — not an official BMC record.',
      'shareWin.impact': '{n} neighbours backed this · {ward} — screenshot this win! 🏆',
      'toast.fixConfirmed': '+10 points — thanks for checking!',
      'toast.communityResolved': 'Community verified fixed — thanks for reporting!',
      'sync.cloud': 'Syncing',
      'sync.local': 'Local only',
      'sync.cloudTitle': 'Reports sync across devices',
      'sync.localTitle': 'Saved on this device only — syncs when cloud is connected',
      'report.submitting': 'Submitting…',
      'success.clock': 'On the community map — not filed with {corp} yet.',
      'community.challenge.empty': 'Be the first in {ward} to climb the monsoon board — report a hazard today.',
      'community.challenge.beat': '{ward}: {pending} dengue-risk spots — beat {rival} ({rivalPending} pending)! Monsoon urgency 🔥',
      'community.challenge.leading': '{ward} leads with {resolved} fixes — stay ahead of {rival}!',
      'community.challenge.catch': '{ward}: chase {leader} ({leaderResolved} fixed). Clean lanes start at home.',
      'community.challenge.leaderboard': '{leader} tops the monsoon board with {resolved} fixes — which ward is next?',
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
      'confirm.shareResolvedMsg': '✅ FIXED in {ward}! Before → after proof on CivicRadar:\n{link}\n\n{marathi}\n{hashtags}',
      'esc.title': 'File with BMC (optional)',
      'esc.subtitle': 'CivicRadar shows hazards on the community map. Filing with BMC is your choice — it starts the official clock. This is not a BMC channel.',
      'esc.fileTitle': 'File the complaint (free)',
      'esc.fileHint': 'Stagnant water goes to your ward’s Pest Control Officer. Use any channel:',
      'esc.recommended': 'Recommended: MyBMC WhatsApp — fastest for most Mumbai wards.',
      'esc.channelWa': 'Chatbot · pre-fill below',
      'esc.channelCall': '24×7 helpline',
      'esc.channelPortal': 'Online portal',
      'esc.channelTweet': 'Public pressure',
      'esc.margApp': 'MyBMC MARG app',
      'esc.margAppSmall': 'Official grievance app',
      'esc.copyBlock': 'Details for 1916 / portal / app',
      'esc.copyAll': 'Copy all details',
      'esc.copyAllDone': 'Copied — paste when you file on 1916, MyBMC, or the portal',
      'esc.copyBilingual': 'For the call centre: read the Marathi section at the bottom of the text block.',
      'esc.portalHint': 'On the portal or MARG app: choose Public Health → Pest Control → stagnant water. Paste the details below.',
      'esc.filedConsent': 'I filed on an official BMC channel (1916 / MyBMC / portal / app)',
      'esc.complaintWarn': 'This doesn’t look like a typical BMC number — you can still save if it’s correct.',
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
      'esc.close': 'Close',
      'esc.save': 'Save',
      'esc.tier.file.title': '1 · File the official complaint',
      'esc.tier.file.body': 'Free. Routed to your ward’s Pest Control Officer. Use any channel above, then save the complaint number here so the real clock starts.',
      'esc.tier.matrix.title': '2 · Day {n}+ — Ward escalation',
      'esc.tier.matrix.body': 'BMC’s system auto-escalates unresolved complaints at 7 days. Follow up with your Ward Complaint Officer, quoting your complaint number.',
      'esc.tier.zonal.title': '3 · Day {n}+ — Zonal + public pressure',
      'esc.tier.zonal.body': 'Escalate to the Zonal Deputy Municipal Commissioner. Tag @mybmc on X with the photo for public visibility.',
      'esc.tier.grievance.title': '4 · Day {n}+ — Grievance / RTI',
      'esc.tier.grievance.body': 'Still ignored after a month? File with the Public Grievance Cell via Aaple Sarkar (Maharashtra state portal), or file an RTI on the complaint status.',
      'profile.empty': 'No reports yet. Stagnant water near you?',
      'profile.emptyList': 'No reports yet. Tap Report to pin stagnant water near you.',
      'profile.emptyAction': 'Report now',
      'profile.trackEscalate': 'Track / escalate',
      'profile.fileBmc': 'File with BMC',
      'profile.status.resolvedCitizen': 'Resolved (you confirmed)',
      'profile.status.resolvedBmc': 'Resolved by BMC',
      'profile.status.notFiled': 'Open on community map',
      'profile.communityCleared': 'Volunteers cleared — {corp} complaint may still be open',
      'profile.neighbourOne': 'neighbour said Me too',
      'profile.neighbourMany': 'neighbours said Me too',
      'profile.pointsHint.base': '50 pts per report · +200 when volunteer hours verified',
      'profile.pointsHint.bonus': '{n} reports × 50 pts · +{bonus} volunteer bonus',
      'profile.greeting': 'Hello, {name}',
      'profile.greetingDefault': 'Hello, Citizen',
      'profile.selectWard': 'Select your ward',
      'about.subtitleNamed': 'Community tech for Mumbai, Pune & Thane monsoon — built by {name}, free for citizens.',
      'safety.hide': 'Flag / hide from map',
      'safety.hidden': 'Report hidden from your map.',
      'safety.hideConfirm': 'Hide this pin from your map? (Does not delete the report.)',
      'popup.pending': 'Pending',
      'popup.resolved': 'Resolved',
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
      'pledge.messagePh': 'Note for volunteers…',
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
      'toast.bmcUnauthorized': 'This email is not authorised for BMC access.',
      'toast.ngoCodeRequired': 'Enter your email and NGO access code.',
      'toast.ngoCodeInvalid': 'That NGO access code is invalid or used up.',
      'toast.onboardFirst': 'Complete setup to report hazards.',
      'toast.tosRequired': 'Accept Terms & Privacy (18+) before using community features.',
      'toast.reportNotFound': 'That report link is invalid or no longer on this device.',
      'toast.installed': 'CivicRadar installed — open from your home screen!',
      'toast.installHint': 'Browser menu → Add to Home screen.',
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
      'toast.gpsRequired': 'GPS is required to pin the hazard.',
      'toast.hazardTypeRequired': 'Select a live hazard type.',
      'toast.storageFull': 'Storage full — oldest report removed. Try again.',
      'toast.gpsFail': 'Could not get GPS. Turn on location and try again.',
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
      'toast.saving': 'Saving…',
      'toast.verifying': 'Verifying…',
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
      'admin.healthLoading': 'Loading usage…',
      'admin.markResolved': 'Mark as resolved',
      'admin.resolveHint': 'Citizen gets credit and the pin turns green.',
      'admin.reviewTag': 'BMC review',
      'admin.reportTitle': 'Hazard report',
      'coord.title': 'Coordinator login',
      'coord.subtitle': 'Review pledges, send volunteers, verify hours.',
      'coord.hubTitle': 'Coordinator hub',
      'coord.hubSubtitle': 'Review citizen pledges and verify volunteer time.',
      'coord.workflow': 'Dispatch volunteers → log cleanup → confirm supplies → verify hours (+200 pts)',
      'coord.openHazards': 'Open hazards in your ward',
      'coord.pledges': 'Citizen pledges',
      'coord.pledgesNew': 'Citizen pledges · {n} new',
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
      'badge.admin': 'BMC Admin',
      'badge.coord': 'Coordinator hub',
      'admin.meta.reporter': 'Reporter',
      'admin.meta.ward': 'Ward',
      'admin.meta.status': 'Status',
      'admin.meta.lat': 'Lat',
      'admin.meta.lng': 'Lng',
      'admin.meta.neighbourConfirm': ' · {n} said Me too',
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
      'auth.sendCode': 'Send sign-in code',
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
      'about.founderDefault': 'Student founder',
      'config.contactMissing': '(Contact not configured)',
    },
    hi: {
      'lang.name': 'हिन्दी', 'lang.native': 'हिन्दी',
      'nav.map': 'मानचित्र', 'nav.community': 'समुदाय', 'nav.profile': 'प्रोफ़ाइल',
      'fab.report': 'रिपोर्ट',
      'header.context': 'मानसून खतरा नक्शा — मुंबई, पुणे और ठाणे',
      'header.contextCity': '{city} मानसून — खतरा नक्शा',
      'location.banner': 'सटीक रिपोर्ट के लिए स्थान चालू करें।',
      'location.enable': 'चालू करें',
      'coach.step': '#MonsoonGuardian · 30 सेक', 'coach.title': 'डेंगू का दुश्मन? रुका पानी!',
      'coach.body': 'रिपोर्ट दबाएँ, फ़ोटो लें — वार्ड नक्शे पर पिन। पड़ोसी Me too बोलेंगे, जल्दी ठीक होगा। WhatsApp पर शेयर करें!',
      'coach.got': 'चलो शुरू करें',
      'persona.citizen.idle': '🦟 रुका पानी = डेंगू का खतरा। रिपोर्ट दबाएँ — 30 सेक में वार्ड नक्शे पर, WhatsApp पर शेयर करें।',
      'persona.wardImpact': '{ward}: {n} मानसून रिपोर्ट दर्ज — अपनी गली को डेंगू-मुक्त रखें।',
      'persona.unfiled': '{n} खुले खतरे वार्ड मानचित्र पर — पड़ोसियों के साथ साझा करें या प्रोफ़ाइल में आधिकारिक शिकायत दर्ज करें।',
      'persona.pendingFiled': '{n} खुले खतरे पड़ोसियों को दिख रहे हैं — अतिदेय हो तो प्रोफ़ाइल में आगे बढ़ाएँ।',
      'onboard.title': 'CivicRadar में आपका स्वागत है',
      'onboard.subtitle': '30 सेक में रुका पानी पिन · पड़ोसियों को बुलाएँ · प्रतिद्वंद्वी वार्ड को हराएँ। #MonsoonGuardian',
      'onboard.ward': 'आपका वार्ड', 'onboard.wardPh': 'अपना वार्ड टाइप करना शुरू करें…',
      'onboard.wardHint': '{city} के {n} आधिकारिक वार्डों में से चुनें।',
      'onboard.city': 'आपका शहर',
      'onboard.cityHint': 'चुनें कि आप कहाँ रहते हैं — अगला कदम GPS से वार्ड पहचान।',
      'onboard.wardDetecting': 'आपके स्थान से वार्ड पहचाना जा रहा है…',
      'onboard.wardDetectedHint': 'GPS से अनुमानित वार्ड — आधिकारिक सीमा सर्वेक्षण नहीं।',
      'onboard.wardManual': 'गलत है? मैन्युअल चुनें',
      'onboard.wardRetry': 'फिर से पहचानें',
      'onboard.wardDetectFailed': 'वार्ड नहीं मिला — मैन्युअल चुनें या लोकेशन अनुमति दें।',
      'onboard.name': 'प्रदर्शित नाम',       'onboard.namePh': 'पड़ोसी आपको क्या कहें?',
      'onboard.join': 'वार्ड से जुड़ें',
      'report.title': 'खतरे की रिपोर्ट करें',
      'report.step.photo': 'फ़ोटो', 'report.step.details': 'विवरण', 'report.step.submit': 'भेजें',
      'report.hazardType': 'खतरे का प्रकार', 'report.photoEvidence': 'फ़ोटो प्रमाण',
      'report.capture': 'फ़ोटो लें',
      'report.notes': 'टिप्पणी (वैकल्पिक)', 'report.notesPh': 'खतरे का वर्णन करें…',
      'report.submit': 'रिपोर्ट भेजें',
      'moderation.guidelines': 'केवल खतरे की स्पष्ट ऑन-साइट फ़ोटो अपलोड करें। सेल्फ़ी, ID, दस्तावेज़ या असंबंधित चित्र नहीं — स्थान मेटाडेटा गोपनीयता के लिए हटाया जाता है।',
      'moderation.scanning': 'फ़ोटो सुरक्षा जाँच हो रही है…',
      'moderation.blocked.fileType': 'केवल JPEG, PNG या WebP hazard फ़ोटो स्वीकार हैं।',
      'moderation.blocked.fileSize': 'फ़ोटो बहुत बड़ी है। छोटी छवि का उपयोग करें (अधिकतम 8 MB)।',
      'moderation.blocked.lowQuality': 'फ़ोटो बहुत छोटी या अस्पष्ट है। खतरे के पास जाएँ।',
      'moderation.blocked.irrelevant': 'खतरे की फ़ोटो लें — सेल्फ़ी, दस्तावेज़ या खाली चित्र नहीं।',
      'moderation.blocked.sensitive': 'ID, दस्तावेज़ या स्क्रीनशॉट से बचें। केवल खतरा दिखाएँ।',
      'moderation.blocked.nsfw': 'अनुचित सामग्री के कारण यह फ़ोटो ब्लॉक की गई।',
      'moderation.blocked.offline': 'फ़ोटो सुरक्षा जाँच के लिए इंटरनेट से जुड़ें।',
      'success.title': 'रिपोर्ट दर्ज', 'success.tagline': 'आपके वार्ड मानचित्र पर पिन किया गया',
      'success.taglineNeighbours': '{n} पड़ोसी पास के खतरों का समर्थन कर रहे हैं — आपकी रिपोर्ट भी वार्ड मानचित्र पर दिख रही है!',
      'success.subtitle': 'वैकल्पिक: सरकारी घड़ी शुरू करने के लिए {corp} में आधिकारिक शिकायत दर्ज करें (निःशुल्क)।',
      'success.step1': 'WhatsApp पर साझा करें ताकि पड़ोसी वार्ड मानचित्र पर पिन देखें',
      'success.step2': 'वैकल्पिक: {corp} में दर्ज करें और शिकायत नंबर सहेजें',
      'success.step3': 'स्वयंसेवक या {corp} ठीक होने पर पुष्टि कर सकते हैं — सिविक अंक मिलेंगे',
      'success.file': 'आधिकारिक शिकायत दर्ज करें (वैकल्पिक)',
      'success.tag': '@mybmc को टैग करें', 'success.alert': 'पड़ोसियों को सूचित करें', 'success.done': 'हो गया',
      'success.sharePrompt': 'अभी WhatsApp पर भेजें — ज़्यादा नज़र = जल्दी ठीक। डेंगू से बचना है तो शेयर करें!',
      'success.shareWhatsapp': 'WhatsApp पर साझा करें',
      'success.shareNudge': 'पड़ोसियों को अभी पता नहीं — WhatsApp पर शेयर करें, वार्ड नक्शे पर और नज़रें मदद करती हैं।',
      'success.shareMsg': '🦟 {ward} में {hazard} — डेंगू का खतरा! CivicRadar वार्ड नक्शे पर पिन।\nMe too करें और अपनी गली रिपोर्ट करें:\n{link}\n\n{marathi}\n{hashtags}',
      'share.marathiHook': 'पावसाळ्यात साचलेलं पाणी? वॉर्ड नकाशा पहा →',
      'share.appMsg': '🗺️ {city} मानसून नक्शा — रुका पानी पिन, Me too बोलें, प्रतिद्वंद्वी वार्ड को हराएँ!\n{link}\n\n{marathi}\n{hashtags}',
      'share.meTooMsg': '👋 मुझे भी — {ward} में {hazard}। {n} पड़ोसी CivicRadar पर:\n{link}\n\n{marathi}\n{hashtags}',
      'share.meTooBtn': 'WhatsApp पर साझा करें',
      'share.wardMapMsg': '⚡ {ward}: {pending} खुले डेंगू-जोखिम स्पॉट — CivicRadar पर हमें हराओ!\n{link}\n\n{marathi}\n{hashtags}',
      'share.cleanupMsg': '🧹 {ward} में स्वयंसेवकों ने {hazard} साफ किया! पहले → बाद:\n{link}\n\n{marathi}\n{hashtags}',
      'share.instagramCaption': '{ward} में {hazard} साफ 🎉 CivicRadar पर पहले → बाद। मानसून जीत।\n{link}\n\n{marathi}\n{hashtags}',
      'share.instagramCleanupCaption': '{ward} में स्वयंसेवकों ने {hazard} साफ किया 🧹 CivicRadar पर पहले → बाद।\n{link}\n\n{marathi}\n{hashtags}',
      'share.milestoneMsg': '🏆 {ward} ने {n} हल पूरे किए! आपका वार्ड?\n{link}\n\n{marathi}\n{hashtags}',
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
      'shareWin.impact': '{n} पड़ोसियों ने समर्थन किया · {ward} — यह जीत स्क्रीनशॉट करें! 🏆',
      'about.shareTitle': 'ऐप साझा करें',
      'about.sharePitch': 'मुफ़्त {city} मानसून नक्शा — 30 सेक में रिपोर्ट, Me too, प्रतिद्वंद्वी वार्ड को हराएँ।\nNJ छात्रा ने भारत में परिवार के लिए बनाया। लॉगिन नहीं, 4 भाषाएँ।\n{link}\nRWA / सोसायटी WhatsApp ग्रुप में फॉरवर्ड करें →',
      'about.copyPitch': 'WhatsApp पिच कॉपी करें',
      'about.pitchCopied': 'पिच कॉपी — RWA / स्कूल ग्रुप में पेस्ट करें!',
      'pwa.nudge': 'मानसून-तैयार: होम स्क्रीन पर CivicRadar जोड़ें।',
      'pwa.nudgeAction': 'होम स्क्रीन पर जोड़ें',
      'pwa.nudgeDismiss': 'अभी नहीं',
      'community.challengeShare': 'दोस्त को चुनौती — वार्ड नक्शा साझा करें',
      'community.winsTitle': 'इस मानसून की जीत',
      'community.winsEmpty': 'हल की गई जगहें यहाँ दिखेंगी — रिपोर्ट करें, पड़ोसियों को बुलाएँ, जीत मनाएँ।',
      'community.winsNeighbours': '{ward} में पड़ोसी',
      'community.winsCleanup': '{hazard} साफ · {ward}',
      'community.winsResolved': '{hazard} हल · {ward}',
      'success.points': 'सिविक अंक मिले', 'success.weekBonus': '+{n} इस सप्ताह की पहली रिपोर्ट!',
      'map.empty': '{ward} में साफ नक्शा — #MonsoonGuardian बनें! डेंगू फैलने से पहले रुका पानी रिपोर्ट करें।',
      'map.emptyAction': 'पहला खतरा रिपोर्ट करें',
      'map.emptyShare': 'WhatsApp पर पड़ोसियों को बुलाएँ',
      'map.emptyRival': '{ward} बनाम {rival} — उनके {pending} खुले स्पॉट। रिपोर्ट करें या पड़ोसियों को बुलाएँ!',
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
      'persona.ngo.pledges': '{deliver} वितरण · {verify} सत्यापन',
      'persona.ngo.newHazards': 'वार्ड में {n} नए खतरे',
      'persona.ngo.newPledges': '{n} नई प्रतिज्ञा',
      'persona.admin.overdue': '{overdue} अतिदेय · {pending} लंबित — कतार खोलें',
      'profile.badge.reporter': 'सक्रिय रिपोर्टर',
      'profile.badge.2week': '2-सप्ताह रिपोर्टर',
      'profile.badge.3week': '3-सप्ताह रिपोर्टर',
      'profile.badge.monsoon': 'मानसून रक्षक',
      'profile.wardImpact': 'आपका वार्ड: इस मानसून {n} रिपोर्ट',
      'profile.streak': '{n}-सप्ताह रिपोर्टिंग स्ट्रीक',
      'confirm.nearby': 'पिन {m} मी. दूर{backing}। डुप्लिकेट की जगह मुझे भी दबाएँ — ठीक होने पर अपडेट।',
      'esc.participate.title': 'सामुदायिक कार्रवाई (वैकल्पिक)',
      'esc.participate.hint': 'Participate Mumbai BMC का आधिकारिक स्वयंसेवा/CSR पोर्टल है — कीट नियंत्रण शिकायतों के लिए नहीं। सफाई अभियान या वार्ड परियोजनाओं के लिए उपयोग करें।',
      'esc.participate.btn': 'Participate Mumbai',
      'esc.participate.small': 'स्वयंसेवा · CSR · परियोजनाएँ',
      'community.title': 'समुदाय',
      'community.subtitle': '{ward} में साथ मिलकर ठीक करें — स्वयंसेवा, सामान दान, या अलग से {corp} में दर्ज करें।',
      'community.topWards': 'शीर्ष वार्ड', 'community.localCitizens': 'स्थानीय नागरिक',
      'community.supportTitle': 'स्वयंसेवकों का साथ दें',
      'community.supportBody': 'रुके पानी से लड़ रहे स्थानीय सफ़ाई दल की मदद के लिए सामग्री दान करें।',
      'community.pledge': 'दान करें',
      'community.volunteerTitle': 'मेरे वार्ड में स्वयंसेवा',
      'community.volunteerBody': 'साथ मिलकर ठीक करें — {corp} में दर्ज करना अलग है।',
      'community.volunteerCta': 'साइन अप',
      'volunteer.title': 'मेरे वार्ड में स्वयंसेवा',
      'volunteer.subtitle': 'पड़ोसियों के साथ मिलकर — सरकारी स्वयंसेवी कार्यक्रम नहीं।',
      'volunteer.neighbourhood': 'पड़ोस / सोसाइटी / गली',
      'volunteer.skill.cleanup': 'रुके पानी की सफाई',
      'volunteer.skill.awareness': 'जागरूकता और WhatsApp',
      'volunteer.skill.pledge': 'दान वितरण',
      'popup.helpClean': 'मैं सफाई में मदद कर सकता/सकती हूँ',
      'profile.volunteer': 'मेरा स्वयंसेवक साइनअप',
      'coord.volunteers': 'आपके क्षेत्र के स्वयंसेवक',
      'coord.tasks': 'स्वयंसेवक सफाई प्रस्ताव',
      'inquiry.coordTitle': 'वार्ड या पड़ोस समन्वयक बनें',
      'about.becomeCoord': 'वार्ड या पड़ोस समन्वयक बनें',
      'pledge.notice': 'आपके वार्ड का NGO समन्वयक इसे अपने हब में देखेगा — BMC नहीं। वे ऐप में संपर्क कर सकते हैं; कोई स्वचालित कॉल/SMS नहीं।',
      'pledge.status.pledged': 'दान दर्ज',
      'pledge.status.delivered': 'वितरित',
      'pledge.status.verified': 'सत्यापित (+200 अंक)',
      'toast.pledgeSaved': 'दान दर्ज — आपके वार्ड समन्वयक को हब में दिखेगा।',
      'toast.pledgeDuplicate': 'इस वार्ड और सामग्री के लिए पहले से खुली प्रतिज्ञा है।',
      'toast.pledgeWardMismatch': 'यह आपके वार्ड से अलग है — वहाँ का समन्वयक संभालेगा।',
      'toast.pledgeStatusDelivered': 'समन्वयक ने आपकी प्रतिज्ञा वितरित चिह्नित की।',
      'toast.pledgeStatusVerified': 'स्वयंसेवक घंटे सत्यापित — +200 सिविक अंक!',
      'toast.ngoNewPledge': 'आपके वार्ड में {n} नई नागरिक प्रतिज्ञा।',
      'toast.ngoNewPledgeAction': 'हब खोलें',
      'coord.pledgesNew': 'नागरिक प्रतिज्ञाएँ · {n} नई',
      'coord.pledgesEmpty': 'अभी कोई प्रतिज्ञा नहीं। अपने वार्ड के निवासियों के साथ Community टैब साझा करें।',
      'coord.markDelivered': 'वितरित चिह्नित करें',
      'coord.verifyHours': 'घंटे सत्यापित (+200)',
      'coord.verified': 'सत्यापित',
      'profile.pledges': 'मेरी प्रतिज्ञाएँ',
      'profile.pledgesEmpty': 'अभी कोई प्रतिज्ञा नहीं। Community से स्थानीय स्वयंसेवकों का साथ दें।',
      'profile.pledgesEmptyAction': 'दान करें',
      'profile.title': 'आपकी प्रोफ़ाइल', 'profile.persona': 'नागरिक',
      'profile.points': 'कुल सिविक अंक', 'profile.fixed': 'हल किए खतरे', 'profile.pending': 'खुले खतरे',
      'profile.reports': 'आपकी रिपोर्टें',
      'profile.install': 'CivicRadar ऐप इंस्टॉल करें', 'profile.partner': 'स्वयंसेवक / NGO लॉगिन',
      'profile.about': 'CivicRadar के बारे में', 'profile.sponsor': 'प्रायोजक या साझेदार बनें',
      'profile.deleteData': 'मेरा डेटा हटाएँ',
      'profile.deleteConfirm': 'इस उपकरण और क्लाउड से आपकी रिपोर्ट, प्रतिज्ञा और प्रोफ़ाइल स्थायी रूप से हटाएँ? पूर्ववत नहीं हो सकता।',
      'profile.deleteDone': 'आपका डेटा हटा दिया गया। आप नए सिरे से शुरू कर सकते हैं।',
      'legal.privacy': 'गोपनीयता नीति',
      'legal.terms': 'सेवा की शर्तें',
      'impact.reports': 'रिपोर्ट', 'impact.resolved': 'हल', 'impact.confirms': 'मुझे भी',
      'impact.pledges': 'दान', 'impact.wards': 'वार्ड',
      'impact.week': 'इस सप्ताह: {reports} रिपोर्ट · {resolved} हल · {confirms} पुष्टि',
      'impact.resolvedBreakdown': 'आप: {self} · समुदाय: {community} · BMC: {bmc} · सफाई: {cleanup}',
      'about.title': 'CivicRadar के बारे में',
      'about.subtitle': 'मुंबई, पुणे और ठाणे मानसून के लिए सामुदायिक ऐप — एक छात्र द्वारा, नागरिकों के लिए निःशुल्क।',
      'about.impactTitle': 'सामुदायिक प्रभाव', 'about.builtTitle': 'हमने क्या बनाया',
      'about.sustainTitle': 'टिकाऊ और नागरिकों के लिए निःशुल्क',
      'about.sustainBody': 'CivicRadar निवासियों के लिए हमेशा निःशुल्क रहेगा। भविष्य की आय नैतिक स्थानीय साझेदारी से आती है — सार्वजनिक सुरक्षा पर पेवॉल नहीं।',
      'about.copyImpact': 'प्रभाव सारांश कॉपी करें', 'about.contact': 'संस्थापक से संपर्क', 'about.contactOperator': 'ऑपरेटर से संपर्क', 'about.close': 'बंद',
      'about.sponsored': 'प्रायोजित', 'about.copied': 'प्रभाव सारांश कॉपी हो गया — अपने आवेदन में चिपकाएँ।',
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
      'hazard.stagnant-water': 'रुका हुआ पानी', 'hazard.potholes': 'गड्ढे',
      'hazard.garbage': 'कचरा', 'hazard.streetlight': 'खराब स्ट्रीटलाइट',
      'hazard.comingSoon': 'जल्द आ रहा है',
      'soon.title': 'जल्द आ रहा है', 'soon.notify': 'लाइव होने पर मुझे सूचित करें',
      'soon.thanks': 'धन्यवाद — लॉन्च होने पर हम आपको सूचित करेंगे।',
      'soon.roadmap': 'आज: रुका पानी। आगे, आपके वोटों के आधार पर:',
      'confirm.metoo': 'मुझे भी', 'confirm.you': 'आपकी रिपोर्ट',
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
      'confirm.shareMsg': '✅ {ward} में जिस खतरे को उठाया वह CivicRadar पर ठीक! सामूहिक दबाव काम करता है:\n{link}\n\n{marathi}\n{hashtags}',
      'fix.looksFixed': 'अब ठीक लगता है',
      'fix.done': 'आपने ठीक कहा',
      'fix.thanks': 'धन्यवाद — पर्याप्त पड़ोसी सहमत होने पर हम इसे ठीक चिह्नित करेंगे।',
      'fix.countOne': '1 पड़ोसी कहता है ठीक है',
      'fix.countMany': '{n} पड़ोसी कहते हैं ठीक है',
      'fix.hint': 'केवल समुदाय जाँच — आधिकारिक BMC पुष्टि नहीं।',
      'fix.resolved': '{ward} में जिस स्थान की आपने जाँच की वह समुदाय-सत्यापित ठीक!',
      'fix.resolvedMany': 'आपने जिन {n} स्थानों की जाँच की वे समुदाय-सत्यापित ठीक!',
      'fix.afterPhotoPrompt': 'वैकल्पिक: प्रोफ़ाइल से बाद की फोटो जोड़ें।',
      'reminder.staleCheck': '{ward} के पास — अभी भी stagnant?',
      'reminder.stillThere': 'अभी भी है',
      'reminder.looksFixed': 'ठीक लगता है',
      'profile.status.communityVerified': 'समुदाय ने ठीक की पुष्टि',
      'profile.status.youMarkedFixed': 'आपने ठीक चिह्नित',
      'profile.status.bmcResolved': 'BMC ने हल किया',
      'profile.badge.communityVerified': 'समुदाय सत्यापित',
      'profile.badge.youMarkedFixed': 'आपने चिह्नित',
      'profile.badge.bmcResolved': 'BMC हल',
      'community.winsCommunityVerified': '{hazard} समुदाय-सत्यापित · {ward}',
      'shareWin.subtitleCommunity': 'पड़ोसियों ने पुष्टि की — आधिकारिक BMC रिकॉर्ड नहीं।',
      'toast.fixConfirmed': '+10 अंक — जाँच के लिए धन्यवाद!',
      'toast.communityResolved': 'समुदाय-सत्यापित ठीक — रिपोर्ट के लिए धन्यवाद!',
      'sync.cloud': 'सिंक हो रहा है',
      'sync.local': 'केवल स्थानीय',
      'sync.cloudTitle': 'रिपोर्ट सभी उपकरणों पर सिंक होती हैं',
      'sync.localTitle': 'केवल इस उपकरण पर — क्लाउड कनेक्ट होने पर सिंक होगा',
      'map.legend.aria': 'नक्शा किंवदंती: खुला, ठीक, और आप',
      'report.submitting': 'भेजा जा रहा है…',
      'success.clock': 'सामुदायिक मानचित्र पर — {corp} में अभी दर्ज नहीं।',
      'community.subtitleActive': '{ward}: {pending} खुले खतरे · {resolved} हल। पड़ोसियों को बुलाएँ!',
      'community.challenge.empty': '{ward} में मानसून बोर्ड पर पहले बनें — आज ही रिपोर्ट करें।',
      'community.challenge.beat': '{ward}: {pending} डेंगू-जोखिम स्पॉट — {rival} ({rivalPending} लंबित) से आगे! 🔥',
      'community.challenge.leading': '{ward} {resolved} हल के साथ अग्रणी — {rival} से आगे रहें!',
      'community.challenge.catch': '{ward}: {leader} ({leaderResolved} हल) का पीछा करें। स्वच्छ सर्वेक्षण आपकी गली से शुरू।',
      'community.challenge.leaderboard': '{leader} {resolved} हल के साथ शीर्ष पर — अगला वार्ड कौन?',
      'leaderboard.demo': 'डेमो', 'leaderboard.you': 'आप',
      'leaderboard.demoNote': 'अधिक वार्ड रिपोर्ट करने तक नमूना डेटा। वास्तविक आँकड़े बढ़ते रहेंगे।',
      'leaderboard.resolved': '{n} हल', 'leaderboard.emptyWards': 'अपने वार्ड को बोर्ड पर देखने के लिए रिपोर्ट करें।',
      'leaderboard.emptyCitizens': 'स्थानीय बोर्ड पर आने के लिए रिपोर्ट दर्ज करें।',
      'leaderboard.emptyFirst': 'अपने वार्ड में पहले बनें — बोर्ड पर चढ़ने के लिए रिपोर्ट करें।',
      'admin.proofBefore': 'पहले (नागरिक रिपोर्ट)', 'admin.proofAfter': 'बाद (BMC प्रमाण)',
      'admin.proofCapture': 'प्रमाण फ़ोटो जोड़ें', 'admin.proofHint': 'साफ़ "बाद" फ़ोटो — नागरिक पहले/बाद देखेंगे।',
      'admin.proofPrompt': 'बाद की फ़ोटो जोड़ें, फिर पुष्टि के लिए फिर टैप करें।',
      'admin.proofRequired': 'प्रमाण फ़ोटो ज़रूरी — हल करने से पहले "बाद" की फ़ोटो जोड़ें।',
      'admin.confirmResolve': 'हल की पुष्टि?',
      'admin.exportCsv': 'वार्ड CSV निर्यात',
      'admin.exportEmpty': 'इस फ़िल्टर के लिए निर्यात करने को कोई रिपोर्ट नहीं।',
      'admin.exportSuccess': '{n} रिपोर्ट CSV में निर्यात।',
      'admin.copy1916': '1916 के लिए कॉपी',
      'admin.copy1916Copied': 'कॉपी हो गया — 1916 में चिपकाएँ',
      'profile.proofBefore': 'पहले', 'profile.proofAfter': 'बाद',
      'confirm.shareResolvedMsg': '✅ {ward} में ठीक! CivicRadar पर पहले → बाद प्रमाण:\n{link}\n\n{marathi}\n{hashtags}',
      'esc.title': 'आधिकारिक शिकायत सहायक', 'esc.subtitle': 'CivicRadar खतरे सामुदायिक मानचित्र पर दिखाता है। BMC में दर्ज करना वैकल्पिक है लेकिन आधिकारिक घड़ी शुरू करता है — यह आधिकारिक BMC चैनल नहीं है।',
      'esc.fileTitle': 'शिकायत दर्ज करें (निःशुल्क)', 'esc.fileHint': 'रुका पानी आपके वार्ड के कीट नियंत्रण अधिकारी तक जाता है। कोई भी चैनल:',
      'esc.recommended': 'अनुशंसित: MyBMC WhatsApp — अधिकांश Mumbai वार्डों के लिए सबसे तेज़।',
      'esc.channelWa': 'चैटबॉट · नीचे से कॉपी करें', 'esc.channelCall': '24×7 हेल्पलाइन', 'esc.channelPortal': 'ऑनलाइन पोर्टल', 'esc.channelTweet': 'सार्वजनिक दबाव',
      'esc.margApp': 'MyBMC MARG ऐप', 'esc.margAppSmall': 'आधिकारिक शिकायत ऐप',
      'esc.copyBlock': '1916 / पोर्टल / ऐप के लिए विवरण', 'esc.copyAll': 'सभी विवरण कॉपी करें', 'esc.copyAllDone': 'कॉपी हो गया — आधिकारिक चैनल पर दर्ज करते समय चिपकाएँ',
      'esc.copyBilingual': 'कॉल सेंटर: टेक्स्ट ब्लॉक में मराठी पंक्ति पढ़ सकते हैं।',
      'esc.portalHint': 'पोर्टल या MARG ऐप: Public Health → Pest Control → stagnant water चुनें। नीचे विवरण चिपकाएँ।',
      'esc.filedConsent': 'मैंने आधिकारिक BMC चैनल पर दर्ज किया (1916 / MyBMC / पोर्टल / ऐप)',
      'esc.complaintWarn': 'यह सामान्य BMC नंबर जैसा नहीं लगता — सही हो तो फिर भी सहेजें।',
      'esc.saveUnlock': 'सहेजने के बाद: एस्केलेशन सीढ़ी, दिन-गिनती, फॉलो-अप टेक्स्ट।',
      'esc.closeNudge': 'शिकायत नंबर अभी सहेजा नहीं — Profile से कभी भी दर्ज कर सकते हैं।',
      'esc.daysSince': 'BMC में दर्ज किए {n} दिन',
      'esc.progress.reported': 'रिपोर्ट', 'esc.progress.shared': 'शेयर', 'esc.progress.filed': 'दर्ज', 'esc.progress.escalating': 'एस्केलेट', 'esc.progress.resolved': 'हल',
      'esc.tier.copyFollowUp': 'फॉलो-अप कॉपी', 'esc.tier.openWa': 'WhatsApp', 'esc.tier.openCall': '1916 कॉल', 'esc.tier.openTweet': '@mybmc', 'esc.tier.openAaple': 'Aaple Sarkar',
      'esc.copyFollowUpDone': 'फॉलो-अप कॉपी हो गया', 'esc.rtiDisclaimer': 'केवल सूचनात्मक RTI टेम्पलेट — कानूनी सलाह नहीं।', 'esc.consentRequired': 'सहेजने से पहले आधिकारिक BMC चैनल पर दर्ज की पुष्टि करें।',
      'esc.complaintLabel': 'BMC शिकायत नंबर', 'esc.complaintPh': 'उदा. N/2026/123456',
      'esc.complaintHint': 'नंबर सहेजने से जवाबदेही घड़ी शुरू होती है।', 'esc.filedNote': 'BMC में दर्ज — समय सीमा पर आगे बढ़ाएँ।',
      'esc.ladderTitle': 'आगे बढ़ाने की सीढ़ी', 'esc.selfTitle': 'BMC ने ठीक किया?', 'esc.selfBody': 'खुद पुष्टि करें — सभी के लिए हरा चिह्न।',
      'esc.selfBtn': 'हल चिह्नित करें', 'esc.aaple': 'Aaple Sarkar (राज्य)', 'esc.close': 'बंद', 'esc.save': 'सहेजें',
      'esc.tmc.recommended': 'अनुशंसित: thanecity.gov.in पर दर्ज करें या TMC हेल्पलाइन 022-25331590 पर कॉल करें।',
      'esc.tmc.fileHint': 'ठहरा पानी / मच्छर प्रजनन — नीचे किसी भी आधिकारिक TMC चैनल का उपयोग करें।',
      'esc.tmc.channelPortal': 'TMC ऑनलाइन पोर्टल', 'esc.tmc.channelCall': 'TMC हेल्पलाइन',
      'esc.tmc.channelEmail': 'नगर आयुक्त को ईमेल', 'esc.tmc.channelTweet': '@TMCaTweetAway को टैग करें',
      'esc.tmc.channelCitizenCall': 'नागरिक कॉल सेंटर (155300)',
      'esc.tmc.copyBlock': 'TMC पोर्टल / हेल्पलाइन / ईमेल के लिए विवरण',
      'esc.tmc.copyAllDone': 'कॉपी हो गया — TMC में दर्ज करते समय चिपकाएँ',
      'esc.tmc.portalHint': 'thanecity.gov.in: लॉगिन → ऑनलाइन नागरिक सेवाएँ → शिकायत दर्ज करें। नीचे विवरण चिपकाएँ।',
      'esc.tmc.filedConsent': 'मैंने आधिकारिक TMC चैनल पर दर्ज किया (पोर्टल / हेल्पलाइन / ईमेल / 155300 / Aaple Sarkar)',
      'esc.tmc.complaintLabel': 'TMC शिकायत / संदर्भ संख्या', 'esc.tmc.complaintPh': 'उदा. TMC/2026/123456',
      'esc.tmc.complaintWarn': 'यह सामान्य TMC संदर्भ जैसा नहीं लगता — सही हो तो फिर भी सहेजें।',
      'esc.tmc.filedNote': 'TMC में दर्ज — समय सीमा पर आगे बढ़ाएँ।', 'esc.tmc.daysSince': 'TMC में दर्ज किए {n} दिन',
      'esc.tmc.selfTitle': 'TMC ने ठीक किया?', 'esc.tmc.selfBody': 'TMC द्वारा ठीक होने पर खुद पुष्टि करें — सभी के लिए हरा चिह्न।',
      'esc.tmc.aaple': 'Aaple Sarkar — TMC को स्थानीय निकाय चुनें',
      'esc.tmc.deptTitle': 'विभाग संपर्क (एस्केलेशन)', 'esc.tmc.deptHint': 'ठहरा पानी फॉलो-अप — जल, स्वास्थ्य, या प्रदूषण नियंत्रण।',
      'esc.tmc.dept.water': 'जल', 'esc.tmc.dept.health': 'स्वास्थ्य', 'esc.tmc.dept.pollution': 'प्रदूषण नियंत्रण',
      'esc.tmc.tier.file.body': 'निःशुल्क। thanecity.gov.in, 022-25331590 / 022-25331211, mc@thanecity.gov.in, या 155300। संदर्भ संख्या यहाँ सहेजें।',
      'esc.tmc.tier.matrix.body': 'वार्ड कार्यालय या स्वास्थ्य (022-25332685) से फॉलो-अप। TMC संदर्भ संख्या उद्धृत करें।',
      'esc.tmc.tier.zonal.body': 'नगर आयुक्त (mc@thanecity.gov.in) तक एस्केलेट। @TMCaTweetAway पर फोटो के साथ टैग करें।',
      'esc.tmc.tier.grievance.body': 'एक महीने बाद भी? Aaple Sarkar (grievances.maharashtra.gov.in) — Thane Municipal Corporation चुनें।',
      'esc.tmc.tier.openCall': 'TMC कॉल', 'esc.tmc.tier.openTweet': '@TMCaTweetAway', 'esc.tmc.tier.openEmail': 'MC ईमेल', 'esc.tmc.tier.openAaple': 'Aaple Sarkar',
      'esc.tmc.consentRequired': 'सहेजने से पहले आधिकारिक TMC चैनल पर दर्ज की पुष्टि करें।',
      'esc.pmc.subtitle': 'CivicRadar खतरे सामुदायिक मानचित्र पर दिखाता है। PMC में दर्ज करना वैकल्पिक है — यह आधिकारिक घड़ी शुरू करता है। यह PMC चैनल नहीं है।',
      'esc.pmc.recommended': 'अनुशंसित: PMC CARE WhatsApp — अधिकांश Pune वार्डों के लिए सबसे तेज़।',
      'esc.pmc.fileHint': 'ठहरा पानी और मच्छर प्रजनन PMC CARE के माध्यम से जाता है। कोई भी चैनल:',
      'esc.pmc.channelWa': 'PMC CARE WhatsApp', 'esc.pmc.channelWaSmall': 'चैट · नीचे से कॉपी',
      'esc.pmc.channelCall': 'टोल-फ्री हेल्पलाइन', 'esc.pmc.channelPortal': 'PMC CARE पोर्टल',
      'esc.pmc.channelApp': 'PMC CARE ऐप', 'esc.pmc.channelAppSmall': 'Play Store · App Store',
      'esc.pmc.copyBlock': 'PMC CARE / WhatsApp / हेल्पलाइन के लिए विवरण',
      'esc.pmc.copyAllDone': 'कॉपी हो गया — PMC CARE / WhatsApp पर दर्ज करते समय चिपकाएँ',
      'esc.pmc.portalHint': 'PMC CARE पोर्टल या ऐप: ठहरा पानी / मच्छर शिकायत दर्ज करें। नीचे विवरण चिपकाएँ।',
      'esc.pmc.filedConsent': 'मैंने आधिकारिक PMC चैनल पर दर्ज किया (PMC CARE / WhatsApp / हेल्पलाइन / ऐप)',
      'esc.pmc.complaintLabel': 'PMC शिकायत / संदर्भ संख्या', 'esc.pmc.complaintPh': 'उदा. PMC/2026/123456',
      'esc.pmc.complaintWarn': 'यह सामान्य PMC संदर्भ जैसा नहीं लगता — सही हो तो फिर भी सहेजें।',
      'esc.pmc.filedNote': 'PMC में दर्ज — समय सीमा पर आगे बढ़ाएँ।', 'esc.pmc.daysSince': 'PMC में दर्ज किए {n} दिन',
      'esc.pmc.selfTitle': 'PMC ने ठीक किया?', 'esc.pmc.selfBody': 'PMC द्वारा ठीक होने पर खुद पुष्टि करें — सभी के लिए हरा चिह्न।',
      'esc.pmc.tier.file.body': 'निःशुल्क। PMC CARE पोर्टल, WhatsApp, 1800 1030 222, या PMC CARE ऐप। संदर्भ संख्या यहाँ सहेजें।',
      'esc.pmc.tier.matrix.body': 'PMC CARE या टोल-फ्री हेल्पलाइन से फॉलो-अप। शिकायत संख्या उद्धृत करें।',
      'esc.pmc.tier.zonal.body': 'वार्ड ने कार्रवाई नहीं की? PMC CARE पोर्टल या WhatsApp से एस्केलेट करें।',
      'esc.pmc.tier.grievance.body': 'एक महीने बाद भी? Aaple Sarkar — Pune Municipal Corporation चुनें।',
      'esc.pmc.tier.openWa': 'WhatsApp', 'esc.pmc.tier.openCall': 'PMC हेल्पलाइन', 'esc.pmc.tier.openAaple': 'Aaple Sarkar',
      'esc.pmc.consentRequired': 'सहेजने से पहले आधिकारिक PMC चैनल पर दर्ज की पुष्टि करें।',
      'esc.pmc.aaple': 'Aaple Sarkar — Pune Municipal Corporation को स्थानीय निकाय चुनें',
      'copy1916.pmc.header': 'PMC शिकायत विवरण (PMC CARE / WhatsApp / हेल्पलाइन पर कॉपी-पेस्ट)',
      'copy1916.pmc.complaintNotFiled': 'PMC शिकायत #: (अभी दर्ज नहीं)', 'copy1916.pmc.complaintFiled': 'PMC शिकायत #: {id}',
      'profile.fileCorp': '{corp} में दर्ज करें',
      'esc.tier.file.title': '1 · आधिकारिक शिकायत दर्ज करें', 'esc.tier.file.body': 'निःशुल्क। वार्ड PCO तक। नंबर यहाँ सहेजें।',
      'esc.tier.matrix.title': '2 · दिन {n}+ — वार्ड', 'esc.tier.matrix.body': '7 दिन पर BMC ऑटो-एस्केलेट। WCO / AMC से संपर्क करें।',
      'esc.tier.zonal.title': '3 · दिन {n}+ — ज़ोनल', 'esc.tier.zonal.body': 'Zonal DMC और @mybmc पर सार्वजनिक दबाव।',
      'esc.tier.grievance.title': '4 · दिन {n}+ — शिकायत / RTI', 'esc.tier.grievance.body': 'एक महीने बाद भी? Aaple Sarkar या RTI।',
      'profile.empty': 'अभी कोई रिपोर्ट नहीं। पास रुका पानी?', 'profile.emptyAction': 'अभी रिपोर्ट करें',
      'profile.trackEscalate': 'ट्रैक / आगे बढ़ाएँ', 'profile.fileBmc': 'BMC में दर्ज करें',
      'profile.status.resolvedCitizen': 'हल (आपने पुष्टि)', 'profile.status.resolvedBmc': 'BMC ने हल किया',
      'profile.status.notFiled': 'सामुदायिक मानचित्र पर खुला',
      'profile.neighbourOne': 'पड़ोसी ने मुझे भी कहा',
      'profile.neighbourMany': 'पड़ोसियों ने मुझे भी कहा',
      'profile.pointsHint.base': '50 अंक/रिपोर्ट · +200 स्वयंसेवा', 'profile.pointsHint.bonus': '{n} × 50 · +{bonus} बोनस',
      'profile.greeting': 'नमस्ते, {name}', 'profile.greetingDefault': 'नमस्ते, नागरिक', 'profile.selectWard': 'वार्ड चुनें',
      'about.subtitleNamed': 'मुंबई, पुणे और ठाणे मानसून — {name} द्वारा, नागरिकों के लिए निःशुल्क।',
      'safety.hide': 'फ़्लैग / छिपाएँ', 'safety.hidden': 'आपके मानचित्र से छिपाया।', 'safety.hideConfirm': 'इस पिन को छिपाएँ? (रिपोर्ट हटती नहीं।)',
      'popup.pending': 'लंबित', 'popup.resolved': 'हल',
      'popup.communityCleared': 'स्वयंसेवकों ने साफ किया — {corp} शिकायत अभी खुली हो सकती है',
      'profile.communityCleared': 'स्वयंसेवकों ने साफ किया — {corp} शिकायत अभी खुली हो सकती है',
      'partner.title': 'पार्टनर एक्सेस',
      'partner.subtitle': 'NGO समन्वयकों और स्वयंसेवकों के लिए। नगरपालिका एक्सेस निमंत्रण पर।',
      'partner.ngoTitle': 'NGO समन्वयक',
      'partner.ngoBody': 'दान देखें, स्वयंसेवकों को भेजें और सफ़ाई दर्ज करें',
      'partner.bmcTitle': 'नगरपालिका पायलट',
      'partner.bmcBody': 'आमंत्रित BMC पायलट के लिए — एक्सेस के लिए संपर्क करें',
      'admin.allWards': 'सभी वार्ड',
      'admin.avgDays': 'औसत दिन',
      'admin.exitMode': 'BMC मोड बंद',
      'admin.healthLoading': 'उपयोग लोड हो रहा…',
      'admin.healthSummary': 'ऐप स्वास्थ्य (पिछले 7 दिन)',
      'admin.markResolved': 'ठीक चिह्नित करें',
      'admin.overdue': '7+ दिन लंबित',
      'admin.pending': 'खुला',
      'admin.queueSubtitle': 'नागरिक रिपोर्ट देखें, प्राथमिकता दें, हल करें।',
      'admin.queueTitle': 'खतरा कतार',
      'admin.reportTitle': 'खतरा रिपोर्ट',
      'admin.resolved': 'ठीक',
      'admin.resolveHint': 'नागरिक को क्रेडिट — पिन हरा हो जाएगा।',
      'admin.returnMap': 'नक्शे पर वापस',
      'admin.reviewTag': 'BMC समीक्षा',
      'admin.sort.confirmed': 'सबसे ज़्यादा मुझे भी',
      'admin.sort.newest': 'नवीनतम पहले',
      'admin.sort.oldest': 'पुराना पहले',
      'admin.sort.overdue': 'लंबित पहले',
      'admin.subtitle': 'नागरिक खतरा रिपोर्ट हल करें, वार्ड कतार देखें।',
      'admin.title': 'BMC एडमिन',
      'badge.admin': 'BMC एडमिन',
      'badge.coord': 'समन्वयक हब',
      'coord.cleared': 'समुदाय ने साफ किया',
      'coord.codeHint': 'समन्वयकों को कोड मिलता है — वार्ड या RWA/सोसायटी स्तर।',
      'coord.exitMode': 'NGO मोड बंद',
      'coord.hubSubtitle': 'नागरिक दान देखें, स्वयंसेवक घंटे सत्यापित करें।',
      'coord.hubTitle': 'समन्वयक हब',
      'coord.markTaskComplete': 'सफ़ाई पूर्ण',
      'coord.openHazards': 'वार्ड में खुले खतरे',
      'coord.openLabel': 'खुले खतरे',
      'coord.pledges': 'नागरिक दान',
      'coord.pledgesLabel': 'दान',
      'coord.scopeNbh': 'पड़ोस लीड · {label}',
      'coord.scopeWard': 'वार्ड लीड · {ward}',
      'coord.subtitle': 'दान देखें, स्वयंसेवक भेजें, घंटे सत्यापित करें।',
      'coord.tasksEmpty': 'अभी कोई ऑफर नहीं। खुले पिन पर "मैं साफ करने में मदद करूँगा" दबाएँ।',
      'coord.tasksPending': 'कार्य',
      'coord.title': 'समन्वयक लॉगिन',
      'coord.toVerify': 'सत्यापन बाकी',
      'coord.volunteersEmpty': 'अभी कोई स्वयंसेवक नहीं। Community टैब शेयर करें।',
      'coord.volunteersLabel': 'स्वयंसेवक',
      'coord.workflow': 'भेजें → सफ़ाई लॉग → सामान पुष्टि → घंटे (+200 अंक)',
      'copy1916.category.garbage': 'कचरा / ठोस अपशिष्ट',
      'copy1916.category.potholes': 'गड्ढे / सड़क क्षति',
      'copy1916.category.stagnant-water': 'डास / रुका पानी (Public Health → Pest Control)',
      'copy1916.category.streetlight': 'खराब स्ट्रीटलाइट',
      'copy1916.categoryLabel': 'श्रेणी',
      'copy1916.civicradarLinkLabel': 'CivicRadar नक्शा (वैकल्पिक)',
      'copy1916.complaintFiled': 'BMC शिकायत #: {id}',
      'copy1916.complaintNotFiled': 'BMC शिकायत #: (अभी दर्ज नहीं)',
      'copy1916.dateLabel': 'तारीख',
      'copy1916.gpsLabel': 'GPS',
      'copy1916.gpsWarning': '⚠ GPS {city} से बाहर लगता है — दर्ज करने से पहले जगह पुष्टि करें',
      'copy1916.header': 'BMC शिकायत विवरण (1916 / MyBMC कॉल पर कॉपी-पेस्ट)',
      'copy1916.landmarkLabel': 'नज़दीकी लैंडमार्क / नोट',
      'copy1916.linkLocalhostNote': '(ऐप डिप्लॉय होने पर लिंक काम करेगा)',
      'copy1916.mapsLabel': 'Maps',
      'copy1916.marathiHeader': '--- मराठी (कॉल सेंटर को पढ़ें) ---',
      'copy1916.refId': 'संदर्भ (वैकल्पिक): CivicRadar ID {id}',
      'copy1916.wardLabel': 'वार्ड + इलाका',
      'flow.legal': 'कानूनी',
      'flow.ready': 'तैयार',
      'flow.ward': 'वार्ड',
      'inquiry.coordBody': 'अपनी RWA/सोसायटी या वार्ड NGO की अगुवाई करें — स्वयंसेवक देखें, सफ़ाई मिलाएँ, दान घंटे सत्यापित करें। ऑपरेटर से इनवाइट कोड लें।',
      'map.legend.pending': 'खुला',
      'map.legend.resolved': 'ठीक',
      'map.legend.you': 'आप',
      'onboard.wardError': 'सूची से वार्ड चुनें या लोकेशन अनुमति दें।',
      'persona.admin.exit': 'BMC मोड बंद',
      'persona.admin.header': 'BMC समीक्षा मोड',
      'persona.admin.idleEmpty': 'कोई लंबित रिपोर्ट नहीं। नए पिन यहाँ दिखेंगे।',
      'persona.admin.idlePending': '{n} लंबित — कतार खोलें या लाल पिन दबाएँ।',
      'persona.ngo.exit': 'NGO मोड बंद',
      'persona.ngo.header': 'NGO समन्वयक मोड',
      'pledge.message': 'संदेश',
      'pledge.messagePh': 'स्वयंसेवकों के लिए नोट…',
      'pledge.submit': 'दान भेजें',
      'pledge.subtitle': 'वार्ड में स्वयंसेवकों को सामान दें।',
      'pledge.title': 'दान दें',
      'pledge.type': 'सामान का प्रकार',
      'pledge.type.cleaning': 'सफ़ाई सामान',
      'pledge.type.snacks': 'नाश्ता',
      'pledge.type.repellent': 'मच्छर repellent',
      'pledge.ward': 'लक्ष्य वार्ड',
      'pledge.wardPh': 'वार्ड चुनें…',
      'popup.taskOffered': 'स्वयंसेवक ने मदद की पेशकश की',
      'profile.emptyList': 'अभी कोई रिपोर्ट नहीं। Report दबाकर पास का रुका पानी पिन करें।',
      'profile.persona.admin': 'BMC एडमिन',
      'profile.persona.ngo': 'NGO समन्वयक',
      'toast.adminVerified': 'BMC एक्सेस सत्यापित — वार्ड कतार देखें।',
      'toast.bmcLoginFail': 'गलत BMC क्रेडेंशियल।',
      'toast.bmcMumbaiOnly': 'BMC पायलट केवल Mumbai के लिए। अपने नगर निगम से Profile में दर्ज करें।',
      'toast.bmcOnlyResolve': 'केवल सत्यापित BMC अधिकारी हल कर सकते हैं।',
      'toast.bmcUnauthorized': 'यह ईमेल BMC एक्सेस के लिए अधिकृत नहीं।',
      'toast.citizenView': 'नागरिक दृश्य पर वापस।',
      'toast.cleanupLogged': 'समुदाय सफ़ाई लॉग — BMC शिकायत आधिकारिक रूप से खुली रह सकती है।',
      'toast.codeInvalid': 'अमान्य या समाप्त कोड।',
      'toast.codeSent': 'कोड भेजा — इनबॉक्स देखें।',
      'toast.complaintFirst': 'पहले शिकायत नंबर जोड़ें — यही आपका प्रमाण।',
      'toast.complaintRequired': 'ट्रैकिंग के लिए शिकायत नंबर दर्ज करें।',
      'toast.complaintSaved': 'शिकायत नंबर सहेजा — आधिकारिक घड़ी चालू।',
      'toast.contactConfig': 'संपर्क ईमेल सेट नहीं — प्रोफ़ाइल में About देखें।',
      'toast.coordScopeNbh': 'पड़ोस लीड — {label}',
      'toast.coordScopeWard': 'वार्ड समन्वयक — पूरा {ward}',
      'toast.copyFail': 'कॉपी नहीं हुई — टेक्स्ट मैन्युअल चुनें।',
      'toast.govEmail': 'अपना gov.in / mcgm.gov.in ईमेल उपयोग करें।',
      'toast.gpsFail': 'GPS नहीं मिला। लोकेशन चालू करके फिर कोशिश करें।',
      'toast.gpsRequired': 'खतरा पिन के लिए GPS ज़रूरी।',
      'toast.hazardTypeRequired': 'एक सक्रिय खतरा प्रकार चुनें।',
      'toast.hoursVerified': 'घंटे सत्यापित! +200 Civic Points।',
      'toast.installed': 'CivicRadar इंस्टॉल — होम स्क्रीन से खोलें!',
      'toast.installHint': 'ब्राउज़र मेनू → Add to Home screen।',
      'toast.ngoCodeInvalid': 'गलत या समाप्त NGO कोड।',
      'toast.ngoCodeRequired': 'ईमेल और NGO एक्सेस कोड दर्ज करें।',
      'toast.ngoLoginFail': 'गलत समन्वयक क्रेडेंशियल।',
      'toast.ngoVerified': 'समन्वयक सत्यापित — दान और स्वयंसेवक देखें।',
      'toast.noLocation': 'इस ब्राउज़र में लोकेशन उपलब्ध नहीं।',
      'toast.onboardFirst': 'रिपोर्ट के लिए सेटअप पूरा करें।',
      'toast.ownReportOnly': 'केवल अपनी रिपोर्ट पुष्टि कर सकते हैं।',
      'toast.photoRequired': 'भेजने से पहले फ़ोटो जोड़ें।',
      'toast.pledgeDelivered': 'सामान वितरित चिह्नित — अब घंटे सत्यापित करें।',
      'toast.pledgeWardRequired': 'दान के लिए लक्ष्य वार्ड चुनें।',
      'toast.proofAdded': 'प्रमाण फ़ोटो जोड़ी — पुष्टि के लिए फिर दबाएँ।',
      'toast.recentered': 'नक्शा आपकी जगह पर केंद्रित।',
      'toast.reportNotFound': 'रिपोर्ट लिंक अमान्य या इस डिवाइस पर नहीं।',
      'toast.resolvedProof': 'ठीक चिह्नित — पहले/बाद प्रमाण सहेजा।',
      'toast.resolveFail': 'स्थिति अपडेट नहीं हो सकी।',
      'toast.saveFail': 'सहेजा नहीं जा सका।',
      'toast.saving': 'सहेजा जा रहा…',
      'toast.selfResolved': 'ठीक चिह्नित — फॉलो-अप के लिए धन्यवाद!',
      'toast.shareWin': 'पड़ोसियों के साथ जीत शेयर करें।',
      'toast.storageFull': 'स्टोरेज भरा — पुरानी रिपोर्ट हटाई। फिर कोशिश करें।',
      'toast.syncConnected': 'कनेक्ट — रिपोर्ट सभी डिवाइस पर सिंक।',
      'toast.syncLocal': 'इस डिवाइस पर सहेजा — क्लाउड सिंक रिट्राई करेगा।',
      'toast.verifying': 'सत्यापित हो रहा…',
      'toast.volunteerNeighbourhoodRequired': 'पड़ोस, सोसायटी या गली दर्ज करें।',
      'toast.volunteerRemoved': 'स्वयंसेवक नोंद हटाई।',
      'toast.volunteerSaved': 'स्वयंसेवक नोंद सहेजी — वार्ड समन्वयक देख सकते हैं।',
      'toast.volunteerSignupRequired': 'पहले Community में स्वयंसेवक साइन अप करें।',
      'toast.volunteerSkillRequired': 'कम से कम एक तरीका चुनें जिससे मदद कर सकें।',
      'toast.volunteerTaskCompleted': 'सफ़ाई पूर्ण — रिपोर्टर को सूचना।',
      'toast.volunteerTaskDuplicate': 'आप पहले ही इस खतरे में मदद की पेशकश कर चुके।',
      'toast.volunteerTaskOffered': 'ऑफर भेजा — समन्वयक आपको इस स्पॉट से मिलाएगा।',
      'toast.volunteerWardRequired': 'पहले ऑनबोर्डिंग में वार्ड सेट करें।',
      'toast.wardRequired': '{city} की आधिकारिक सूची से वार्ड चुनें।',
      'toast.welcome': 'स्वागत, {name}! रिपोर्ट के लिए तैयार।',
      'tos.accept': 'मैं 18+ हूँ, <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms</a> और <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a> स्वीकार करता/करती हूँ',
      'tos.age': 'रिपोर्ट और समुदाय फीचर के लिए 18+ होना ज़रूरी। 18 से कम? माता-पित/अभिभावक या NSS समन्वयक (18+) के साथ ही भाग लें जो Terms स्वीकार करें।',
      'tos.content': 'केवल खतरे की ऑन-साइट फ़ोटो। सेल्फ़ी, ID या अनर्लेटेड चित्र नहीं।',
      'tos.continue': 'आगे बढ़ें',
      'tos.emergency': 'आपात के लिए नहीं। जान को खतरा हो तो 112 डायल करें।',
      'tos.gps': 'GPS केवल स्थान चालू करने या रिपोर्ट भेजने पर लिया जाता है — Terms स्वीकारने से अलग।',
      'tos.itAct': 'CivicRadar IT Act, 2000 के तहत मध्यस्थ है। अपलोड की ज़िम्मेदारी आपकी।',
      'tos.notBmc': 'CivicRadar स्वतंत्र है — BMC, PMC, TMC या किसी सरकारी संस्था से जुड़ा या चलाया नहीं जाता।',
      'tos.share': 'WhatsApp, X आदि पर शेयर से व्यक्तिगत डेटा खुल सकता है — अपने जोखिम पर।',
      'tos.subtitle': 'CivicRadar उपयोग से पहले पढ़ें और स्वीकार करें।',
      'tos.title': 'सेवा की शर्तें',
      'volunteer.contact': 'फ़ोन / WhatsApp (वैकल्पिक)',
      'volunteer.contactHint': 'वैकल्पिक — केवल वार्ड/पड़ोस समन्वयक को दिखेगा। CivicRadar कभी ऑटो-कॉल नहीं करता।',
      'volunteer.edit': 'नोंद संपादित करें',
      'volunteer.empty': 'अभी साइन अप नहीं। Community से अपनी गली में मदद करें।',
      'volunteer.emptyAction': 'मेरे वार्ड में स्वयंसेवा',
      'volunteer.hours': 'इस मानसून में उपलब्ध घंटे',
      'volunteer.hoursCustom': 'कस्टम',
      'volunteer.hoursLabel': 'इस मानसून {n} घंटे',
      'volunteer.neighbourhoodHint': 'RWA, सोसायटी या गली — पड़ोस लीड आपको नज़दीकी स्पॉट से मिलाएगा।',
      'volunteer.neighbourhoodPh': 'जैसे Phoenix Mills लेन, Building 7 Worli',
      'volunteer.remove': 'मेरी नोंद हटाएँ',
      'volunteer.skills': 'मैं इनमें मदद कर सकता/सकती हूँ',
      'volunteer.submit': 'स्वयंसेवक नोंद सहेजें',
      'volunteer.ward': 'आपका वार्ड',
      'admin.meta.reporter': 'रिपोर्टर',
      'admin.meta.ward': 'वार्ड',
      'admin.meta.status': 'स्थिति',
      'admin.meta.lat': 'Lat',
      'admin.meta.lng': 'Lng',
      'admin.close': 'बंद',
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
      'about.founderDefault': 'विद्यार्थी संस्थापक',
      'config.contactMissing': '(संपर्क कॉन्फ़िग नहीं)',
      'demo.badge': 'प्रोडक्ट डेमो',
      'profile.withdrawAnalytics': 'एनालिटिक्स सहमति वापस लें',
      'profile.withdrawAnalyticsDone': 'एनालिटिक्स सहमति वापस — स्थानीय डेटा साफ।',
      'profile.withdrawGps': 'स्थान सहमति वापस लें',
      'profile.withdrawGpsDone': 'स्थान सहमति वापस — ज़रूरत हो तो नक्शे बैनर से चालू करें।',
      'profile.privacyContact': 'गोपनीयता / शिकायत संपर्क',
      'toast.tosRequired': 'समुदाय सुविधाओं से पहले Terms और Privacy (18+) स्वीकार करें।',
      'tos.analytics': 'गुमनाम उपयोग एनालिटिक्स (वैकल्पिक) विश्वसनीयता बढ़ाता है। कोई फ़ोटो, GPS या नाम नहीं भेजा जाता।',
      'tos.analyticsOptIn': 'मैं गुमनाम उपयोग एनालिटिक्स की सहमति देता/देती हूँ (वैकल्पिक — Profile से कभी भी वापस)',
      'volunteer.ageNote': 'Terms के अनुसार 18+ ज़रूरी। 18 से कम? माता-पित/अभिभावक या NSS समन्वयक के साथ ही भाग लें।',
      'admin.meta.neighbourConfirm': ' · {n} ने मुझे भी कहा',
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
      'profile.neighbourOne': 'पड़ोसी ने मुझे भी कहा',
      'profile.neighbourMany': 'पड़ोसियों ने मुझे भी कहा',
    },
    mr: {
      'lang.name': 'मराठी', 'lang.native': 'मराठी',
      'nav.map': 'नकाशा', 'nav.community': 'समुदाय', 'nav.profile': 'प्रोफाइल',
      'fab.report': 'तक्रार',
      'header.context': 'पावसाळ धोका नकाशा — मुंबई, पुणे आणि ठाणे',
      'header.contextCity': '{city} पावसाळ — धोका नकाशा',
      'location.banner': 'अचूक तक्रारीसाठी स्थान चालू करा.',
      'location.enable': 'चालू करा',
      'coach.step': '#MonsoonGuardian · 30 सेक', 'coach.title': 'डेंगूचा शत्रू? साचलेले पाणी!',
      'coach.body': 'तक्रार दाबा, फोटो काढा — वॉर्ड नकाशावर पिन. शेजारी Me too म्हणतील, लवकर सोडवले जाईल. WhatsApp वर शेअर करा!',
      'coach.got': 'चला सुरू करू',
      'persona.citizen.idle': '🦟 साचलेले पाणी = डेंगू धोका. तक्रार दाबा — 30 सेकंदात वॉर्ड नकाशावर, WhatsApp वर शेअर.',
      'persona.wardImpact': '{ward}: {n} पावसाळी तक्रारी — डेंगू साचलेल्या लेनमधून सुरू. #MonsoonGuardian',
      'persona.unfiled': '{n} खुले धोके वॉर्ड नकाशावर — शेजाऱ्यांसोबत शेअर करा किंवा प्रोफाइलमध्ये अधिकृत तक्रार नोंदवा.',
      'persona.pendingFiled': '{n} खुले धोके शेजाऱ्यांना दिसत आहेत — मुदत ओलांडल्यास प्रोफाइलमध्ये पुढे न्या.',
      'onboard.title': 'CivicRadar मध्ये स्वागत आहे',
      'onboard.subtitle': '30 सेकंदात साचलेले पाणी पिन · शेजाऱ्यांना बोलवा · प्रतिस्पर्धी वॉर्डला हरवा. #MonsoonGuardian',
      'onboard.ward': 'तुमचा वॉर्ड', 'onboard.wardPh': 'तुमचा वॉर्ड टाइप करायला सुरुवात करा…',
      'onboard.wardHint': '{city} च्या {n} अधिकृत वॉर्डांमधून निवडा.',
      'onboard.city': 'तुमचे शहर',
      'onboard.cityHint': 'कुठे राहता ते निवडा — पुढे GPS वरून वॉर्ड शोधू.',
      'onboard.wardDetecting': 'तुमच्या स्थानावरून वॉर्ड शोधत आहे…',
      'onboard.wardDetectedHint': 'GPS वरून अंदाजे वॉर्ड — अधिकृत सीमा सर्वेक्षण नाही.',
      'onboard.wardManual': 'चुकीचे? स्वतः निवडा',
      'onboard.wardRetry': 'पुन्हा शोधा',
      'onboard.wardDetectFailed': 'वॉर्ड सापडला नाही — स्वतः निवडा किंवा लोकेशन परवानगी द्या.',
      'onboard.name': 'प्रदर्शित नाव', 'onboard.namePh': 'आम्ही तुम्हाला काय म्हणावे?',
      'onboard.join': 'समुदायात सामील व्हा',
      'report.title': 'धोक्याची तक्रार करा',
      'report.step.photo': 'फोटो', 'report.step.details': 'तपशील', 'report.step.submit': 'पाठवा',
      'report.hazardType': 'धोक्याचा प्रकार', 'report.photoEvidence': 'फोटो पुरावा',
      'report.capture': 'फोटो काढा',
      'report.notes': 'टीप (ऐच्छिक)', 'report.notesPh': 'धोक्याचे वर्णन करा…',
      'report.submit': 'तक्रार पाठवा',
      'moderation.guidelines': 'फक्त धोक्याचे स्पष्ट ऑन-साइट फोटो अपलोड करा. सेल्फी, ID, कागदपत्रे किंवा असंबंधित चित्र नाहीत — स्थान मेटाडेटा गोपनीयतेसाठी काढले जाते.',
      'moderation.scanning': 'फोटो सुरक्षा तपासणी…',
      'moderation.blocked.fileType': 'फक्त JPEG, PNG किंवा WebP hazard फोटो स्वीकारले जातात.',
      'moderation.blocked.fileSize': 'फोटो खूप मोठा आहे. लहान प्रतिमा वापरा (कमाल 8 MB).',
      'moderation.blocked.lowQuality': 'फोटो खूप लहान किंवा अस्पष्ट आहे. धोक्याजवळ जा.',
      'moderation.blocked.irrelevant': 'धोक्याचा फोटो घ्या — सेल्फी, कागदपत्रे किंवा रिकामे चित्र नाहीत.',
      'moderation.blocked.sensitive': 'ID, कागदपत्रे किंवा स्क्रीनशॉट टाळा. फक्त धोक्याचे दाखवा.',
      'moderation.blocked.nsfw': 'अनुचित सामग्रीमुळे हा फोटो ब्लॉक केला.',
      'moderation.blocked.offline': 'फोटो सुरक्षा तपासणीसाठी इंटरनेटशी कनेक्ट व्हा.',
      'success.title': 'तक्रार नोंद', 'success.tagline': 'तुमच्या वॉर्ड नकाशावर पिन केले',
      'success.taglineNeighbours': '{n} शेजारी जवळच्या धोक्यांना पाठिंबा देत आहेत — तुमची तक्रारही वॉर्ड नकाशावर दिसते!',
      'success.subtitle': 'पर्यायी: सरकारी घड्याळ सुरू करण्यासाठी {corp} कडे अधिकृत तक्रार नोंदवा (मोफत).',
      'success.step1': 'WhatsApp वर शेअर करा जेणेकरून शेजारी वॉर्ड नकाशावर पिन पाहतील',
      'success.step2': 'पर्यायी: {corp} कडे नोंदवा आणि तक्रार क्रमांक जतन करा',
      'success.step3': 'स्वयंसेवक किंवा {corp} निराकरण झाल्यावर पुष्टी करू शकतात — सिव्हिक गुण मिळतील',
      'success.file': 'अधिकृत तक्रार नोंदवा (पर्यायी)',
      'success.tag': '@mybmc ला टॅग करा', 'success.alert': 'शेजाऱ्यांना कळवा', 'success.done': 'झाले',
      'success.sharePrompt': 'आत्ताच WhatsApp वर पाठवा — जास्त डोळे = लवकर सोडवणे. डेंगू टाळायचा असेल तर शेअर करा!',
      'success.shareWhatsapp': 'WhatsApp वर शेअर करा',
      'success.shareNudge': 'शेजाऱ्यांना अजून कळले नाही — WhatsApp वर शेअर करा, वॉर्ड नकाशावर अधिक नजर मदत करते.',
      'success.shareMsg': '🦟 {ward} मध्ये {hazard} — डेंगू धोका! CivicRadar वॉर्ड नकाशावर पिन.\nMe too करा आणि तुमची लेन रिपोर्ट करा:\n{link}\n\n{marathi}\n{hashtags}',
      'share.marathiHook': 'पावसाळ्यात साचलेलं पाणी? वॉर्ड नकाशा पहा →',
      'share.appMsg': '🗺️ {city} पावसाळा नकाशा — साचलेले पाणी पिन, Me too, प्रतिस्पर्धी वॉर्डला हरवा!\n{link}\n\n{marathi}\n{hashtags}',
      'share.meTooMsg': '👋 मला पण — {ward} मध्ये {hazard}. {n} शेजारी CivicRadar वर:\n{link}\n\n{marathi}\n{hashtags}',
      'share.meTooBtn': 'WhatsApp वर शेअर करा',
      'share.wardMapMsg': '⚡ {ward}: {pending} उघडे डेंगू-धोका स्पॉट — CivicRadar वर आम्हाला हरवा!\n{link}\n\n{marathi}\n{hashtags}',
      'share.cleanupMsg': '🧹 {ward} मध्ये स्वयंसेवकांनी {hazard} साफ केले! आधी → नंतर:\n{link}\n\n{marathi}\n{hashtags}',
      'share.instagramCaption': '{ward} मध्ये {hazard} साफ 🎉 CivicRadar वर आधी → नंतर. पावसाळ्याची विजय.\n{link}\n\n{marathi}\n{hashtags}',
      'share.instagramCleanupCaption': '{ward} मध्ये स्वयंसेवकांनी {hazard} साफ केले 🧹 CivicRadar वर आधी → नंतर.\n{link}\n\n{marathi}\n{hashtags}',
      'share.milestoneMsg': '🏆 {ward} ने {n} सोडवले! तुमचा वॉर्ड?\n{link}\n\n{marathi}\n{hashtags}',
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
      'shareWin.impact': '{n} शेजाऱ्यांनी पाठिंबा · {ward} — ही विजय स्क्रीनशॉट करा! 🏆',
      'about.shareTitle': 'अ‍ॅप शेअर करा',
      'about.sharePitch': 'मोफत {city} पावसाळा नकाशा — 30 सेकंदात तक्रार, Me too, प्रतिस्पर्धी वॉर्डला हरवा.\nNJ विद्यार्थिनीने भारतात कुटुंबासाठी बनवले. लॉगिन नाही, 4 भाषा.\n{link}\nRWA / सोसायटी WhatsApp ग्रुपला फॉरवर्ड करा →',
      'about.copyPitch': 'WhatsApp पिच कॉपी करा',
      'about.pitchCopied': 'पिच कॉपी — RWA ग्रुपमध्ये पेस्ट करा!',
      'pwa.nudge': 'पावसाळा-तयार: होम स्क्रीनवर CivicRadar जोडा.',
      'pwa.nudgeAction': 'होम स्क्रीनवर जोडा',
      'pwa.nudgeDismiss': 'आत्ता नाही',
      'community.challengeShare': 'मित्राला आव्हान — वॉर्ड नकाशा शेअर करा',
      'community.winsTitle': 'या पावसाळ्यातील विजय',
      'community.winsEmpty': 'सोडवलेले स्पॉट येथे दिसतील — तक्रार करा, शेजाऱ्यांना बोलवा, विजय साजरा करा.',
      'community.winsNeighbours': '{ward} मधील शेजारी',
      'community.winsCleanup': '{hazard} साफ · {ward}',
      'community.winsResolved': '{hazard} सोडवले · {ward}',
      'success.points': 'सिव्हिक गुण मिळाले', 'success.weekBonus': '+{n} या आठवड्याची पहिली तक्रार!',
      'map.empty': '{ward} मध्ये स्वच्छ नकाशा — #MonsoonGuardian व्हा! डेंगू पसरण्यापूर्वी साचलेले पाणी रिपोर्ट करा.',
      'map.emptyAction': 'पहिला धोका रिपोर्ट करा',
      'map.emptyShare': 'WhatsApp वर शेजाऱ्यांना बोलवा',
      'map.emptyRival': '{ward} विरुद्ध {rival} — त्यांचे {pending} उघडे स्पॉट. रिपोर्ट करा किंवा शेजाऱ्यांना बोलवा!',
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
      'persona.ngo.pledges': '{deliver} वितरण · {verify} सत्यापन',
      'persona.ngo.newHazards': 'वॉर्डमध्ये {n} नवीन धोके',
      'persona.ngo.newPledges': '{n} नवीन प्रतिज्ञा',
      'persona.admin.overdue': '{overdue} मुदत ओलांडली · {pending} प्रलंबित — रांग उघडा',
      'profile.badge.reporter': 'सक्रिय तक्रारकर्ता',
      'profile.badge.2week': '2-आठवडे तक्रारकर्ता',
      'profile.badge.3week': '3-आठवडे तक्रारकर्ता',
      'profile.badge.monsoon': 'पावसाळी रक्षक',
      'profile.wardImpact': 'तुमचा वॉर्ड: या पावसाळ्यात {n} तक्रारी',
      'profile.streak': '{n}-आठवड्यांची तक्रार साखळी',
      'confirm.nearby': 'पिन {m} मी. लांब{backing}. डुप्लिकेट ऐवजी मला पण दाबा — निराकरण झाल्यावर अपडेट.',
      'esc.participate.title': 'सामुदायिक उपक्रम (पर्यायी)',
      'esc.participate.hint': 'Participate Mumbai हे BMC चे अधिकृत स्वयंसेवा/CSR पोर्टल आहे — कीटक नियंत्रण तक्रारीसाठी नाही. स्वच्छता मोहिमा किंवा वॉर्ड प्रकल्पांसाठी वापरा.',
      'esc.participate.btn': 'Participate Mumbai',
      'esc.participate.small': 'स्वयंसेवा · CSR · प्रकल्प',
      'community.title': 'समुदाय',
      'community.subtitle': '{ward} मध्ये एकत्र ठीक करा — स्वयंसेवा, साहित्य देणगी, किंवा वेगळ्याने {corp} कडे नोंद.',
      'community.topWards': 'अव्वल वॉर्ड', 'community.localCitizens': 'स्थानिक नागरिक',
      'community.supportTitle': 'स्वयंसेवकांना साथ द्या',
      'community.supportBody': 'साचलेल्या पाण्याशी लढणाऱ्या स्थानिक स्वच्छता पथकांना मदतीसाठी साहित्य द्या.',
      'community.pledge': 'देणगी',
      'community.volunteerTitle': 'माझ्या वार्डात स्वयंसेवा',
      'community.volunteerBody': 'एकत्र ठीक करा — {corp} कडे नोंदवणे वेगळे.',
      'community.volunteerCta': 'नोंदणी',
      'volunteer.title': 'माझ्या वार्डात स्वयंसेवा',
      'popup.helpClean': 'मी साफ करण्यात मदत करू शकतो/शकते',
      'profile.volunteer': 'माझी स्वयंसेवक नोंदणी',
      'coord.volunteers': 'तुमच्या क्षेत्रातील स्वयंसेवक',
      'coord.tasks': 'स्वयंसेवक सफाई ऑफर',
      'inquiry.coordTitle': 'वार्ड किंवा परिसर समन्वयक व्हा',
      'about.becomeCoord': 'वार्ड किंवा परिसर समन्वयक व्हा',
      'pledge.notice': 'तुमच्या वॉर्डचा NGO समन्वयक हे त्यांच्या हबमध्ये पाहतो — BMC नाही. ते अ‍ॅपमध्ये संपर्क करू शकतात; स्वयंचलित कॉल/SMS नाही.',
      'pledge.status.pledged': 'देणगी नोंद',
      'pledge.status.delivered': 'वितरित',
      'pledge.status.verified': 'सत्यापित (+200 गुण)',
      'toast.pledgeSaved': 'देणगी नोंद — वॉर्ड समन्वयकाला हबमध्ये दिसेल.',
      'toast.pledgeDuplicate': 'या वॉर्ड आणि साहित्यासाठी आधीच खुली प्रतिज्ञा आहे.',
      'toast.pledgeWardMismatch': 'हे तुमच्या वॉर्डपेक्षा वेगळे — त्या वॉर्डचा समन्वयक हाताळेल.',
      'toast.pledgeStatusDelivered': 'समन्वयकाने तुमची देणगी वितरित म्हणून चिन्हांकित केली.',
      'toast.pledgeStatusVerified': 'स्वयंसेवक तास सत्यापित — +200 सिव्हिक गुण!',
      'toast.ngoNewPledge': 'तुमच्या वॉर्डमध्ये {n} नवीन नागरिक प्रतिज्ञा.',
      'toast.ngoNewPledgeAction': 'हब उघडा',
      'coord.pledgesNew': 'नागरिक प्रतिज्ञा · {n} नवीन',
      'coord.pledgesEmpty': 'अद्याप प्रतिज्ञा नाहीत. वॉर्डमधील रहिवाशांसोबत Community टॅब शेअर करा.',
      'coord.markDelivered': 'वितरित चिन्हांकित करा',
      'coord.verifyHours': 'तास सत्यापित (+200)',
      'coord.verified': 'सत्यापित',
      'profile.pledges': 'माझ्या प्रतिज्ञा',
      'profile.pledgesEmpty': 'अद्याप प्रतिज्ञा नाहीत. Community वरून स्थानिक स्वयंसेवकांना साथ द्या.',
      'profile.pledgesEmptyAction': 'देणगी द्या',
      'profile.title': 'तुमची प्रोफाइल', 'profile.persona': 'नागरिक',
      'profile.points': 'एकूण सिव्हिक गुण', 'profile.fixed': 'सोडवलेले धोके', 'profile.pending': 'खुले धोके',
      'profile.reports': 'तुमच्या तक्रारी',
      'profile.install': 'CivicRadar अ‍ॅप इंस्टॉल करा', 'profile.partner': 'स्वयंसेवक / NGO लॉगिन',
      'profile.about': 'CivicRadar बद्दल', 'profile.sponsor': 'प्रायोजक किंवा भागीदार व्हा',
      'profile.deleteData': 'माझा डेटा हटवा',
      'profile.deleteConfirm': 'या उपकरणावरून आणि क्लाउडवरून तुमच्या तक्रारी, प्रतिज्ञा आणि प्रोफाइल कायमच्या हटवायच्या? परत मिळवता येणार नाही.',
      'profile.deleteDone': 'तुमचा डेटा हटवला. तुम्ही पुन्हा सुरू करू शकता.',
      'legal.privacy': 'गोपनीयता धोरण',
      'legal.terms': 'सेवा अटी',
      'impact.reports': 'तक्रारी', 'impact.resolved': 'सोडवले', 'impact.confirms': 'मला पण',
      'impact.pledges': 'देणगी', 'impact.wards': 'वॉर्ड',
      'impact.week': 'या आठवड्यात: {reports} तक्रारी · {resolved} सोडवले · {confirms} पुष्टी',
      'impact.resolvedBreakdown': 'तुम्ही: {self} · समुदाय: {community} · BMC: {bmc} · सफाई: {cleanup}',
      'about.title': 'CivicRadar बद्दल',
      'about.subtitle': 'मुंबई, पुणे आणि ठाणे पावसाळ्यासाठी सामुदायिक अ‍ॅप — विद्यार्थिनीने बनवले, नागरिकांसाठी मोफत.',
      'about.impactTitle': 'सामुदायिक प्रभाव', 'about.builtTitle': 'आम्ही काय बांधले',
      'about.sustainTitle': 'शाश्वत आणि नागरिकांसाठी मोफत',
      'about.sustainBody': 'CivicRadar रहिवाशांसाठी नेहमी मोफत राहील. भविष्यातील उत्पन्न नैतिक स्थानिक भागीदारीतून येते.',
      'about.copyImpact': 'प्रभाव सारांश कॉपी करा', 'about.contact': 'संस्थापकाशी संपर्क', 'about.contactOperator': 'ऑपरेटरशी संपर्क', 'about.close': 'बंद करा',
      'about.sponsored': 'प्रायोजित',       'about.copied': 'प्रभाव सारांश कॉपी झाला — अर्जात पेस्ट करा.',
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
      'hazard.stagnant-water': 'साचलेले पाणी', 'hazard.potholes': 'खड्डे',
      'hazard.garbage': 'कचरा', 'hazard.streetlight': 'बंद पथदिवा',
      'hazard.comingSoon': 'लवकरच येत आहे',
      'soon.title': 'लवकरच येत आहे', 'soon.notify': 'लाइव्ह झाल्यावर मला कळवा',
      'soon.thanks': 'धन्यवाद — लाँच झाल्यावर आम्ही तुम्हाला कळवू.',
      'soon.roadmap': 'आज: साचलेले पाणी. पुढे, तुमच्या मतांवर आधारित:',
      'confirm.metoo': 'मला पण', 'confirm.you': 'तुमची तक्रार',
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
      'confirm.shareMsg': '✅ {ward} मधील धोका CivicRadar वर सोडवला! सामूहिक दबाव काम करतो:\n{link}\n\n{marathi}\n{hashtags}',
      'fix.looksFixed': 'आता ठीक दिसते',
      'fix.done': 'तुम्ही ठीक म्हणालात',
      'fix.thanks': 'धन्यवाद — पुरेसे शेजारी सहमत झाले की आम्ही ठीक चिन्हांकित करू.',
      'fix.countOne': '1 शेजारी म्हणतो ठीक',
      'fix.countMany': '{n} शेजारी म्हणतात ठीक',
      'fix.hint': 'फक्त समुदाय तपासणी — अधिकृत BMC पुष्टी नाही.',
      'fix.resolved': '{ward} मधील तुम्ही तपासलेले ठिकाण समुदाय-सत्यापित ठीक!',
      'fix.resolvedMany': 'तुम्ही तपासलेली {n} ठिकाणे समुदाय-सत्यापित ठीक!',
      'fix.afterPhotoPrompt': 'पर्यायी: प्रोफाइलमधून नंतरचा फोटो जोडा.',
      'reminder.staleCheck': '{ward} जवळ — अजून stagnant?',
      'reminder.stillThere': 'अजून आहे',
      'reminder.looksFixed': 'ठीक दिसते',
      'profile.status.communityVerified': 'समुदायाने ठीक पुष्टी',
      'profile.status.youMarkedFixed': 'तुम्ही ठीक चिन्हांकित',
      'profile.status.bmcResolved': 'BMC ने सोडवले',
      'profile.badge.communityVerified': 'समुदाय सत्यापित',
      'profile.badge.youMarkedFixed': 'तुम्ही चिन्हांकित',
      'profile.badge.bmcResolved': 'BMC सोडवले',
      'community.winsCommunityVerified': '{hazard} समुदाय-सत्यापित · {ward}',
      'shareWin.subtitleCommunity': 'शेजाऱ्यांनी पुष्टी केली — अधिकृत BMC नोंद नाही.',
      'toast.fixConfirmed': '+10 गुण — तपासणीसाठी धन्यवाद!',
      'toast.communityResolved': 'समुदाय-सत्यापित ठीक — तक्रारीसाठी धन्यवाद!',
      'sync.cloud': 'सिंक', 'sync.local': 'फक्त स्थानिक',
      'sync.cloudTitle': 'तक्रारी सर्व उपकरणांवर सिंक', 'sync.localTitle': 'फक्त या उपकरणावर — क्लाउड जोडल्यावर सिंक होईल',
      'map.legend.aria': 'नकाशा किंवदंती: खुले, निराकरण, आणि तुम्ही',
      'report.submitting': 'पाठवत आहे…',       'success.clock': 'सामुदायिक नकाशावर — {corp} कडे अद्याप नोंदलेले नाही.',
      'community.subtitleActive': '{ward}: {pending} खुले धोके · {resolved} सोडवले. शेजाऱ्यांना बोलवा!',
      'community.challenge.empty': '{ward} मध्ये मान्सून बोर्डवर पहिले व्हा — आजच तक्रार करा.',
      'community.challenge.beat': '{ward}: {pending} डेंगू-धोका स्पॉट — {rival} ({rivalPending} प्रलंबित) पेक्षा पुढे! 🔥',
      'community.challenge.leading': '{ward} {resolved} सोडवले — {rival} पेक्षा पुढे राहा!',
      'community.challenge.catch': '{ward}: {leader} ({leaderResolved} सोडवले) चा पाठलाग करा. स्वच्छ सर्वेक्षण तुमच्या लेनपासून.',
      'community.challenge.leaderboard': '{leader} {resolved} सोडवले — पुढचा वॉर्ड कोण?',
      'leaderboard.demo': 'डेमो', 'leaderboard.you': 'तुम्ही', 'leaderboard.demoNote': 'अधिक वॉर्ड तक्रार करेपर्यंत नमुना. खरे आकडे वाढतील.',
      'leaderboard.resolved': '{n} सोडवले', 'leaderboard.emptyWards': 'तुमचा वॉर्ड बोर्डवर पाहण्यासाठी तक्रार करा.',
      'leaderboard.emptyCitizens': 'स्थानिक बोर्डवर येण्यासाठी तक्रार नोंदवा.',
      'leaderboard.emptyFirst': 'तुमच्या वॉर्डमध्ये पहिले व्हा — बोर्डवर चढण्यासाठी तक्रार करा.',
      'admin.proofBefore': 'आधी (नागरिक तक्रार)', 'admin.proofAfter': 'नंतर (BMC पुरावा)',
      'admin.proofCapture': 'पुरावा फोटो जोडा', 'admin.proofHint': 'स्पष्ट "नंतर" फोटो — नागरिक आधी/नंतर पाहतील.',
      'admin.proofPrompt': 'नंतरचा फोटो जोडा, मग पुष्टीसाठी पुन्हा टॅप करा.',
      'admin.proofRequired': 'पुरावा फोटो आवश्यक — सोडवण्यापूर्वी "नंतर" फोटो जोडा.',
      'admin.confirmResolve': 'निराकरणाची पुष्टी?',
      'admin.exportCsv': 'वॉर्ड CSV निर्यात',
      'admin.exportEmpty': 'या फिल्टरसाठी निर्यात करण्यासाठी अहवाल नाहीत.',
      'admin.exportSuccess': '{n} अहवाल CSV मध्ये निर्यात.',
      'admin.copy1916': '1916 साठी कॉपी',
      'admin.copy1916Copied': 'कॉपी झाले — 1916 मध्ये पेस्ट करा',
      'copy1916.marathiLead.stagnant-water': 'नमस्कार, {ward} वॉर्डमध्ये साचलेले पाणी आहे — डास उत्पन्न होण्याची शक्यता आहे.',
      'copy1916.marathiAction.stagnant-water': 'कृपया Pest Control Officer ला anti-larval treatment आणि fogging साठी पाठवा.',
      'copy1916.marathiLandmark': 'जवळचे landmark / टिपा: {notes}',
      'profile.proofBefore': 'आधी', 'profile.proofAfter': 'नंतर',
      'confirm.shareResolvedMsg': '✅ {ward} मध्ये सोडवले! CivicRadar वर आधी → नंतर:\n{link}\n\n{marathi}\n{hashtags}',
      'esc.title': 'अधिकृत तक्रार सहाय्यक', 'esc.subtitle': 'CivicRadar धोके सामुदायिक नकाशावर दाखवते. BMC मध्ये नोंदवणे पर्यायी आहे पण अधिकृत घड्याळ सुरू करते — हे अधिकृत BMC चॅनेल नाही.',
      'esc.fileTitle': 'तक्रार नोंदवा (मोफत)', 'esc.fileHint': 'साचलेले पाणी वॉर्ड PCO कडे जाते. कोणताही चॅनेल:',
      'esc.recommended': 'शिफारस: MyBMC WhatsApp — बहुतेक Mumbai वॉर्डांसाठी सर्वात जलद.',
      'esc.channelWa': 'चॅटबॉट · खाली कॉपी', 'esc.channelCall': '24×7 हेल्पलाइन', 'esc.channelPortal': 'ऑनलाइन पोर्टल', 'esc.channelTweet': 'सार्वजनिक दबाव',
      'esc.margApp': 'MyBMC MARG अॅप', 'esc.margAppSmall': 'अधिकृत तक्रार अॅप',
      'esc.copyBlock': '1916 / पोर्टल / अॅपसाठी तपशील', 'esc.copyAll': 'सर्व तपशील कॉपी', 'esc.copyAllDone': 'कॉपी झाले — अधिकृत चॅनेलवर नोंदवताना पेस्ट करा',
      'esc.copyBilingual': 'कॉल सेंटर: मजकुरात मराठी ओळ वाचू शकता.',
      'esc.portalHint': 'पोर्टल किंवा MARG: Public Health → Pest Control → stagnant water. खाली तपशील पेस्ट करा.',
      'esc.filedConsent': 'मी अधिकृत BMC चॅनेलवर नोंदवले (1916 / MyBMC / पोर्टल / अॅप)',
      'esc.complaintWarn': 'सामान्य BMC क्रमांक सारखे दिसत नाही — बरोबर असेल तर जतन करा.',
      'esc.saveUnlock': 'जतन केल्यावर: पायऱ्या, दिवस मोजणी, फॉलो-अप मजकूर.',
      'esc.closeNudge': 'तक्रार क्रमांक अजून जतन नाही — Profile मधून कधीही नोंदवा.',
      'esc.daysSince': 'BMC नोंद {n} दिवस',
      'esc.progress.reported': 'नोंद', 'esc.progress.shared': 'शेअर', 'esc.progress.filed': 'दाखल', 'esc.progress.escalating': 'पुढे', 'esc.progress.resolved': 'सोडवले',
      'esc.tier.copyFollowUp': 'फॉलो-अप कॉपी', 'esc.tier.openWa': 'WhatsApp', 'esc.tier.openCall': '1916', 'esc.tier.openTweet': '@mybmc', 'esc.tier.openAaple': 'Aaple Sarkar',
      'esc.copyFollowUpDone': 'फॉलो-अप कॉपी', 'esc.rtiDisclaimer': 'फक्त माहिती RTI नमुना — कायदेशीर सल्ला नाही.', 'esc.consentRequired': 'जतन करण्यापूर्वी अधिकृत BMC चॅनेलवर नोंदवल्याची खात्री करा.',
      'esc.complaintLabel': 'तक्रार क्रमांक', 'esc.complaintPh': 'उदा. N/2026/123456',
      'esc.complaintHint': 'क्रमांक जतन केल्यावर जबाबदारी घड्याळ सुरू.', 'esc.filedNote': 'BMC कडे नोंद — मुदतीनुसार पुढे न्या.',
      'esc.ladderTitle': 'पुढे नेण्याची पायऱ्या', 'esc.selfTitle': 'BMC ने सोडवले?', 'esc.selfBody': 'स्वतः पुष्टी करा — सर्वांसाठी हिरवा.',
      'esc.selfBtn': 'सोडवले चिन्हांकित', 'esc.aaple': 'Aaple Sarkar (राज्य)', 'esc.close': 'बंद', 'esc.save': 'जतन',
      'esc.tmc.recommended': 'शिफारस: thanecity.gov.in वर नोंदवा किंवा TMC हेल्पलाइन 022-25331590 वर कॉल करा.',
      'esc.tmc.fileHint': 'स्थिर पाणी / डास प्रजनन — खालील कोणत्याही अधिकृत TMC चॅनेल वापरा.',
      'esc.tmc.channelPortal': 'TMC ऑनलाइन पोर्टल', 'esc.tmc.channelCall': 'TMC हेल्पलाइन',
      'esc.tmc.channelEmail': 'महापालिका आयुक्ताला ईमेल', 'esc.tmc.channelTweet': '@TMCaTweetAway टॅग',
      'esc.tmc.channelCitizenCall': 'नागरिक कॉल सेंटर (155300)',
      'esc.tmc.copyBlock': 'TMC पोर्टल / हेल्पलाइन / ईमेलसाठी तपशील',
      'esc.tmc.copyAllDone': 'कॉपी झाले — TMC मध्ये नोंदवताना पेस्ट करा',
      'esc.tmc.portalHint': 'thanecity.gov.in: लॉगिन → ऑनलाइन नागरिक सेवा → तक्रार नोंदवा. खाली तपशील पेस्ट करा.',
      'esc.tmc.filedConsent': 'मी अधिकृत TMC चॅनेलवर नोंदवले (पोर्टल / हेल्पलाइन / ईमेल / 155300 / Aaple Sarkar)',
      'esc.tmc.complaintLabel': 'TMC तक्रार / संदर्भ क्रमांक', 'esc.tmc.complaintPh': 'उदा. TMC/2026/123456',
      'esc.tmc.complaintWarn': 'हे सामान्य TMC संदर्भ सारखे नाही — बरोबर असल्यास जतन करा.',
      'esc.tmc.filedNote': 'TMC मध्ये नोंदवले — मुदतीनुसार पुढे वाढवा.', 'esc.tmc.daysSince': 'TMC मध्ये नोंदवल्यापासून {n} दिवस',
      'esc.tmc.selfTitle': 'TMC ने सोडवले?', 'esc.tmc.selfBody': 'TMC ने सोडवल्यावर स्वतः पुष्टी करा — सर्वांसाठी हिरवा चिन्ह.',
      'esc.tmc.aaple': 'Aaple Sarkar — TMC स्थानिक संस्था निवडा',
      'esc.tmc.deptTitle': 'विभाग संपर्क (एस्केलेशन)', 'esc.tmc.deptHint': 'स्थिर पाणी फॉलो-अप — पाणी, आरोग्य, प्रदूषण नियंत्रण.',
      'esc.tmc.dept.water': 'पाणी', 'esc.tmc.dept.health': 'आरोग्य', 'esc.tmc.dept.pollution': 'प्रदूषण नियंत्रण',
      'esc.tmc.tier.file.body': 'मोफत. thanecity.gov.in, 022-25331590 / 022-25331211, mc@thanecity.gov.in, किंवा 155300. संदर्भ क्रमांक येथे जतन करा.',
      'esc.tmc.tier.matrix.body': 'वार्ड कार्यालय किंवा आरोग्य (022-25332685) यांना फॉलो-अप. TMC संदर्भ क्रमांक द्या.',
      'esc.tmc.tier.zonal.body': 'महापालिका आयुक्त (mc@thanecity.gov.in) पर्यंत वाढवा. @TMCaTweetAway वर फोटोसह टॅग.',
      'esc.tmc.tier.grievance.body': 'एक महिन्यानंतरही? Aaple Sarkar (grievances.maharashtra.gov.in) — Thane Municipal Corporation निवडा.',
      'esc.tmc.tier.openCall': 'TMC कॉल', 'esc.tmc.tier.openTweet': '@TMCaTweetAway', 'esc.tmc.tier.openEmail': 'MC ईमेल', 'esc.tmc.tier.openAaple': 'Aaple Sarkar',
      'esc.tmc.consentRequired': 'जतन करण्यापूर्वी अधिकृत TMC चॅनेलवर नोंदवल्याची पुष्टी करा.',
      'esc.pmc.subtitle': 'CivicRadar धोके सामुदायिक नकाशावर दाखवते. PMC मध्ये नोंदवणे पर्यायी — अधिकृत घड्याळ सुरू करते. हे PMC चॅनेल नाही.',
      'esc.pmc.recommended': 'शिफारस: PMC CARE WhatsApp — बहुतेक Pune वॉर्डांसाठी सर्वात जलद.',
      'esc.pmc.fileHint': 'साचलेले पाणी आणि डास PMC CARE मार्फत जातात. कोणताही चॅनेल:',
      'esc.pmc.channelWa': 'PMC CARE WhatsApp', 'esc.pmc.channelWaSmall': 'चॅट · खाली कॉपी',
      'esc.pmc.channelCall': 'टोल-फ्री हेल्पलाइन', 'esc.pmc.channelPortal': 'PMC CARE पोर्टल',
      'esc.pmc.channelApp': 'PMC CARE अॅप', 'esc.pmc.channelAppSmall': 'Play Store · App Store',
      'esc.pmc.copyBlock': 'PMC CARE / WhatsApp / हेल्पलाइनसाठी तपशील',
      'esc.pmc.copyAllDone': 'कॉपी झाले — PMC CARE / WhatsApp वर नोंदवताना पेस्ट करा',
      'esc.pmc.portalHint': 'PMC CARE पोर्टल किंवा अॅप: साचलेले पाणी / डास तक्रार नोंदवा. खाली तपशील पेस्ट करा.',
      'esc.pmc.filedConsent': 'मी अधिकृत PMC चॅनेलवर नोंदवले (PMC CARE / WhatsApp / हेल्पलाइन / अॅप)',
      'esc.pmc.complaintLabel': 'PMC तक्रार / संदर्भ क्रमांक', 'esc.pmc.complaintPh': 'उदा. PMC/2026/123456',
      'esc.pmc.complaintWarn': 'हे सामान्य PMC संदर्भ सारखे नाही — बरोबर असल्यास जतन करा.',
      'esc.pmc.filedNote': 'PMC मध्ये नोंदवले — मुदतीनुसार पुढे वाढवा.', 'esc.pmc.daysSince': 'PMC मध्ये नोंदवल्यापासून {n} दिवस',
      'esc.pmc.selfTitle': 'PMC ने सोडवले?', 'esc.pmc.selfBody': 'PMC ने सोडवल्यावर स्वतः पुष्टी करा — सर्वांसाठी हिरवा चिन्ह.',
      'esc.pmc.tier.file.body': 'मोफत. PMC CARE पोर्टल, WhatsApp, 1800 1030 222, किंवा PMC CARE अॅप. संदर्भ क्रमांक येथे जतन करा.',
      'esc.pmc.tier.matrix.body': 'PMC CARE किंवा टोल-फ्री हेल्पलाइनद्वारे फॉलो-अप. तक्रार क्रमांक द्या.',
      'esc.pmc.tier.zonal.body': 'वॉर्डने कारवाई नाही? PMC CARE पोर्टल किंवा WhatsApp वरून वाढवा.',
      'esc.pmc.tier.grievance.body': 'एक महिन्यानंतरही? Aaple Sarkar — Pune Municipal Corporation निवडा.',
      'esc.pmc.tier.openWa': 'WhatsApp', 'esc.pmc.tier.openCall': 'PMC हेल्पलाइन', 'esc.pmc.tier.openAaple': 'Aaple Sarkar',
      'esc.pmc.consentRequired': 'जतन करण्यापूर्वी अधिकृत PMC चॅनेलवर नोंदवल्याची पुष्टी करा.',
      'esc.pmc.aaple': 'Aaple Sarkar — Pune Municipal Corporation स्थानिक संस्था निवडा',
      'copy1916.pmc.header': 'PMC तक्रार तपशील (PMC CARE / WhatsApp / हेल्पलाइनवर कॉपी-पेस्ट)',
      'copy1916.pmc.complaintNotFiled': 'PMC तक्रार #: (अद्याप नोंद नाही)', 'copy1916.pmc.complaintFiled': 'PMC तक्रार #: {id}',
      'profile.fileCorp': '{corp} कडे नोंदवा',
      'esc.tier.file.title': '1 · अधिकृत तक्रार', 'esc.tier.file.body': 'मोफत. वॉर्ड PCO. क्रमांक येथे जतन करा.',
      'esc.tier.matrix.title': '2 · दिवस {n}+ — वॉर्ड', 'esc.tier.matrix.body': '7 दिवसांवर BMC ऑटो-एस्केलेट. WCO / AMC.',
      'esc.tier.zonal.title': '3 · दिवस {n}+ — झोनल', 'esc.tier.zonal.body': 'Zonal DMC आणि @mybmc सार्वजनिक दबाव.',
      'esc.tier.grievance.title': '4 · दिवस {n}+ — तक्रार / RTI', 'esc.tier.grievance.body': 'महिना झाला? Aaple Sarkar किंवा RTI.',
      'profile.empty': 'अद्याप तक्रार नाही. जवळ साचलेले पाणी?', 'profile.emptyAction': 'आता तक्रार',
      'profile.trackEscalate': 'ट्रॅक / पुढे', 'profile.fileBmc': 'BMC कडे नोंदवा',
      'profile.status.resolvedCitizen': 'सोडवले (तुम्ही)', 'profile.status.resolvedBmc': 'BMC ने सोडवले',
      'profile.status.notFiled': 'सामुदायिक नकाशावर खुले',
      'profile.communityCleared': 'स्वयंसेवकांनी साफ केले — {corp} तक्रार अजून खुली असू शकते',
      'popup.communityCleared': 'स्वयंसेवकांनी साफ केले — {corp} तक्रार अजून खुली असू शकते',
      'profile.neighbourOne': 'शेजाऱ्याने मला पण म्हटले',
      'profile.pointsHint.base': '50 गुण/तक्रार · +200 स्वयंसेवा', 'profile.pointsHint.bonus': '{n} × 50 · +{bonus} बोनस',
      'profile.greeting': 'नमस्कार, {name}', 'profile.greetingDefault': 'नमस्कार, नागरिक', 'profile.selectWard': 'वॉर्ड निवडा',
      'about.subtitleNamed': 'मुंबई, पुणे आणि ठाणे पावसाळा — {name} द्वारे, नागरिकांसाठी मोफत.',
      'safety.hide': 'फ्लॅग / लपवा', 'safety.hidden': 'तुमच्या नकाशावरून लपवले.', 'safety.hideConfirm': 'हा पिन लपवायचा? (तक्रार हटत नाही.)',
      'popup.pending': 'प्रलंबित', 'popup.resolved': 'सोडवले',
      'partner.title': 'पार्टनर प्रवेश',
      'partner.subtitle': 'NGO समन्वयक आणि स्वयंसेवकांसाठी. नगरपालिका प्रवेश निमंत्रणाने.',
      'partner.ngoTitle': 'NGO समन्वयक',
      'partner.ngoBody': 'देणगी पहा, स्वयंसेवक पाठवा आणि सफाई नोंदवा',
      'partner.bmcTitle': 'नगरपालिका पायलट',
      'partner.bmcBody': 'आमंत्रित BMC पायलटसाठी — प्रवेशासाठी संपर्क करा',
      'admin.allWards': 'सर्व वॉर्ड',
      'admin.avgDays': 'सरासरी दिवस',
      'admin.exitMode': 'BMC मोड बंद',
      'admin.healthLoading': 'वापर लोड होत आहे…',
      'admin.healthSummary': 'अ‍ॅप आरोग्य (गेले 7 दिवस)',
      'admin.markResolved': 'निराकरण चिन्हांकित',
      'admin.overdue': '7+ दिवस प्रलंबित',
      'admin.pending': 'उघडे',
      'admin.queueSubtitle': 'नागरिक तक्रारी पाहा, प्राधान्य द्या, निराकरण करा.',
      'admin.queueTitle': 'धोका रांग',
      'admin.reportTitle': 'धोका तक्रार',
      'admin.resolved': 'निराकरण',
      'admin.resolveHint': 'नागरिकाला श्रेय — पिन हिरवा होईल.',
      'admin.returnMap': 'नकाशावर परत',
      'admin.reviewTag': 'BMC पुनरावलोकन',
      'admin.sort.confirmed': 'सर्वाधिक मला पण',
      'admin.sort.newest': 'नवीनतम प्रथम',
      'admin.sort.oldest': 'जुने प्रथम',
      'admin.sort.overdue': 'प्रलंबित प्रथम',
      'admin.subtitle': 'नागरिक धोका तक्रारी निराकरण करा, वॉर्ड रांग पाहा.',
      'admin.title': 'BMC Admin',
      'badge.admin': 'BMC Admin',
      'badge.coord': 'समन्वयक हब',
      'coord.cleared': 'समुदायाने साफ केले',
      'coord.codeHint': 'समन्वयकांना कोड मिळतो — वॉर्ड किंवा RWA/सोसायटी स्तर.',
      'coord.exitMode': 'NGO मोड बंद',
      'coord.hubSubtitle': 'नागरिक देणगी पाहा, स्वयंसेवक तास सत्यापित करा.',
      'coord.hubTitle': 'समन्वयक हब',
      'coord.markTaskComplete': 'सफाई पूर्ण',
      'coord.openHazards': 'वॉर्डमधील उघडे धोके',
      'coord.openLabel': 'उघडे धोके',
      'coord.pledges': 'नागरिक देणगी',
      'coord.pledgesLabel': 'देणगी',
      'coord.scopeNbh': 'परिसर लीड · {label}',
      'coord.scopeWard': 'वॉर्ड लीड · {ward}',
      'coord.subtitle': 'देणगी पाहा, स्वयंसेवक पाठवा, तास सत्यापित करा.',
      'coord.tasksEmpty': 'अद्याप ऑफर नाहीत. उघड्या पिनवर "मी साफ करण्यात मदत करू शकतो" दाबा.',
      'coord.tasksPending': 'कार्य',
      'coord.title': 'समन्वयक लॉगिन',
      'coord.toVerify': 'सत्यापन बाकी',
      'coord.volunteersEmpty': 'अद्याप स्वयंसेवक नाहीत. Community टॅब शेअर करा.',
      'coord.volunteersLabel': 'स्वयंसेवक',
      'coord.workflow': 'पाठवा → सफाई लॉग → साहित्य → तास (+200 गुण)',
      'copy1916.category.garbage': 'कचरा / घन कचरा',
      'copy1916.category.potholes': 'खड्डे / रस्ता खराब',
      'copy1916.category.stagnant-water': 'डास / साचलेले पाणी (Public Health → Pest Control)',
      'copy1916.category.streetlight': 'बंद स्ट्रीटलाइट',
      'copy1916.categoryLabel': 'श्रेणी',
      'copy1916.civicradarLinkLabel': 'CivicRadar नकाशा (पर्यायी)',
      'copy1916.complaintFiled': 'BMC तक्रार #: {id}',
      'copy1916.complaintNotFiled': 'BMC तक्रार #: (अद्याप नोंद नाही)',
      'copy1916.dateLabel': 'तारीख',
      'copy1916.gpsLabel': 'GPS',
      'copy1916.gpsWarning': '⚠ GPS {city} बाहेर दिसतो — नोंदणीपूर्वी ठिकाण पुष्टी करा',
      'copy1916.header': 'BMC तक्रार तपशील (1916 / MyBMC कॉलवर कॉपी-पेस्ट)',
      'copy1916.landmarkLabel': 'जवळचे लँडमार्क / टीप',
      'copy1916.linkLocalhostNote': '(अ‍ॅप डिप्लॉय झाल्यावर लिंक काम करेल)',
      'copy1916.mapsLabel': 'Maps',
      'copy1916.marathiHeader': '--- मराठी (कॉल सेंटरला वाचा) ---',
      'copy1916.refId': 'संदर्भ (पर्यायी): CivicRadar ID {id}',
      'copy1916.wardLabel': 'वॉर्ड + परिसर',
      'flow.legal': 'कायदेशीर',
      'flow.ready': 'तयार',
      'flow.ward': 'वॉर्ड',
      'inquiry.coordBody': 'RWA/सोसायटी किंवा वॉर्ड NGO चे नेतृत्व करा — स्वयंसेवक पाहा, सफाई जुळवा, देणगी तास सत्यापित करा. ऑपरेटरकडून इनवाइट कोड मागा.',
      'map.legend.pending': 'उघडे',
      'map.legend.resolved': 'निराकरण',
      'map.legend.you': 'तुम्ही',
      'onboard.wardError': 'यादीतून वॉर्ड निवडा किंवा लोकेशन परवानगी द्या.',
      'persona.admin.exit': 'BMC मोड बंद',
      'persona.admin.header': 'BMC पुनरावलोकन मोड',
      'persona.admin.idleEmpty': 'प्रलंबित तक्रारी नाहीत. नवीन पिन येथे दिसतील.',
      'persona.admin.idlePending': '{n} प्रलंबित — रांग उघडा किंवा लाल पिन दाबा.',
      'persona.ngo.exit': 'NGO मोड बंद',
      'persona.ngo.header': 'NGO समन्वयक मोड',
      'pledge.message': 'संदेश',
      'pledge.messagePh': 'स्वयंसेवकांसाठी टीप…',
      'pledge.submit': 'देणगी पाठवा',
      'pledge.subtitle': 'वॉर्डमधील स्वयंसेवकांना साहित्य द्या.',
      'pledge.title': 'देणगी द्या',
      'pledge.type': 'साहित्य प्रकार',
      'pledge.type.cleaning': 'सफाई साहित्य',
      'pledge.type.snacks': 'नाश्ता',
      'pledge.type.repellent': 'डास repellent',
      'pledge.ward': 'लक्ष्य वॉर्ड',
      'pledge.wardPh': 'वॉर्ड निवडा…',
      'popup.taskOffered': 'स्वयंसेवकाने मदत ऑफर केली',
      'profile.emptyList': 'अद्याप तक्रार नाही. Report दाबून जवळचे साचलेले पाणी पिन करा.',
      'profile.persona.admin': 'BMC Admin',
      'profile.persona.ngo': 'NGO समन्वयक',
      'toast.adminVerified': 'BMC प्रवेश सत्यापित — वॉर्ड रांग पाहा.',
      'toast.bmcLoginFail': 'चुकीची BMC ओळखपत्रे.',
      'toast.bmcMumbaiOnly': 'BMC पायलट फक्त Mumbai साठी. तुमच्या महानगरपालिकेसाठी Profile मधून दाखल करा.',
      'toast.bmcOnlyResolve': 'फक्त सत्यापित BMC अधिकारी निराकरण करू शकतात.',
      'toast.bmcUnauthorized': 'हा ईमेल BMC प्रवेशासाठी अधिकृत नाही.',
      'toast.citizenView': 'नागरिक दृश्याकडे परत.',
      'toast.cleanupLogged': 'समुदाय सफाई लॉग — BMC तक्रार अधिकृतपणे उघडी राहू शकते.',
      'toast.codeInvalid': 'अवैध किंवा कालबाह्य कोड.',
      'toast.codeSent': 'कोड पाठवला — इनबॉक्स पाहा.',
      'toast.complaintFirst': 'प्रथम तक्रार क्रमांक जोडा — तोच पुरावा.',
      'toast.complaintRequired': 'ट्रॅकिंगसाठी तक्रार क्रमांक भरा.',
      'toast.complaintSaved': 'तक्रार क्रमांक जतन — अधिकृत घड्याळ सुरू.',
      'toast.contactConfig': 'संपर्क ईमेल सेट नाही — प्रोफाइलमध्ये About पाहा.',
      'toast.coordScopeNbh': 'परिसर लीड — {label}',
      'toast.coordScopeWard': 'वॉर्ड समन्वयक — संपूर्ण {ward}',
      'toast.copyFail': 'कॉपी अयशस्वी — मजकूर स्वतः निवडा.',
      'toast.govEmail': 'gov.in / mcgm.gov.in ईमेल वापरा.',
      'toast.gpsFail': 'GPS मिळाला नाही. लोकेशन चालू करून पुन्हा प्रयत्न करा.',
      'toast.gpsRequired': 'धोका पिनसाठी GPS आवश्यक.',
      'toast.hazardTypeRequired': 'सक्रिय धोका प्रकार निवडा.',
      'toast.hoursVerified': 'तास सत्यापित! +200 Civic Points.',
      'toast.installed': 'CivicRadar इंस्टॉल — होम स्क्रीनवरून उघडा!',
      'toast.installHint': 'ब्राउझर मेनू → Add to Home screen.',
      'toast.ngoCodeInvalid': 'चुकीचा किंवा कालबाह्य NGO कोड.',
      'toast.ngoCodeRequired': 'ईमेल आणि NGO प्रवेश कोड भरा.',
      'toast.ngoLoginFail': 'चुकीची समन्वयक ओळखपत्रे.',
      'toast.ngoVerified': 'समन्वयक सत्यापित — देणगी आणि स्वयंसेवक पाहा.',
      'toast.noLocation': 'या ब्राउझरमध्ये लोकेशन उपलब्ध नाही.',
      'toast.onboardFirst': 'तक्रारीसाठी सेटअप पूर्ण करा.',
      'toast.ownReportOnly': 'फक्त स्वतःच्या तक्रारीची पुष्टी करू शकता.',
      'toast.photoRequired': 'पाठवण्यापूर्वी फोटो जोडा.',
      'toast.pledgeDelivered': 'साहित्य वितरित — आता तास सत्यापित करा.',
      'toast.pledgeWardRequired': 'देणगीसाठी लक्ष्य वॉर्ड निवडा.',
      'toast.proofAdded': 'पुरावा फोटो जोडला — पुष्टीसाठी पुन्हा दाबा.',
      'toast.recentered': 'नकाशा तुमच्या स्थानावर केंद्रित.',
      'toast.reportNotFound': 'तक्रार लिंक अवैध किंवा या डिव्हाइसवर नाही.',
      'toast.resolvedProof': 'निराकरण चिन्हांकित — आधी/नंतर पुरावा जतन.',
      'toast.resolveFail': 'स्थिती अपडेट होऊ शकली नाही.',
      'toast.saveFail': 'जतन होऊ शकले नाही.',
      'toast.saving': 'जतन होत आहे…',
      'toast.selfResolved': 'निराकरण चिन्हांकित — फॉलो-अपसाठी धन्यवाद!',
      'toast.shareWin': 'शेजाऱ्यांसोबत विजय शेअर करा.',
      'toast.storageFull': 'स्टोरेज भरले — जुनी तक्रार काढली. पुन्हा प्रयत्न करा.',
      'toast.syncConnected': 'कनेक्ट — तक्रारी सर्व डिव्हाइसवर सिंक.',
      'toast.syncLocal': 'या डिव्हाइसवर जतन — क्लाउड सिंक पुन्हा प्रयत्न करेल.',
      'toast.verifying': 'सत्यापन होत आहे…',
      'toast.volunteerNeighbourhoodRequired': 'परिसर, सोसायटी किंवा लेन भरा.',
      'toast.volunteerRemoved': 'स्वयंसेवक नोंद काढली.',
      'toast.volunteerSaved': 'स्वयंसेवक नोंद जतन — वॉर्ड समन्वयक पाहू शकतात.',
      'toast.volunteerSignupRequired': 'प्रथम Community मध्ये स्वयंसेवक साइन अप करा.',
      'toast.volunteerSkillRequired': 'मदतीचा किमान एक मार्ग निवडा.',
      'toast.volunteerTaskCompleted': 'सफाई पूर्ण — तक्रारकर्त्याला सूचना.',
      'toast.volunteerTaskDuplicate': 'या धोक्यासाठी आधीच ऑफर केले आहे.',
      'toast.volunteerTaskOffered': 'ऑफर पाठवला — समन्वयक या स्पॉटशी जुळवेल.',
      'toast.volunteerWardRequired': 'प्रथम ऑनबोर्डिंगमध्ये वॉर्ड सेट करा.',
      'toast.wardRequired': '{city}च्या अधिकृत यादीतून वॉर्ड निवडा.',
      'toast.welcome': 'स्वागत, {name}! तक्रारीसाठी तयार.',
      'tos.accept': 'मी 18+ आहे, <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms</a> आणि <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a> स्वीकारतो/स्वीकारते',
      'tos.age': 'तक्रार आणि समुदाय वैशिष्ट्यांसाठी 18+ आवश्यक. 18 पेक्षा कमी? 18+ पालक, पालकत्वदाता किंवा NSS समन्वयकांनी Terms स्वीकारून सहभाग घ्या.',
      'tos.content': 'फक्त धोक्याचे ऑन-साइट फोटो. सेल्फी, ID किंवा असंबंधित चित्रे नाहीत.',
      'tos.continue': 'पुढे जा',
      'tos.emergency': 'आपत्कालीन नाही. जीवघेणा धोका असल्यास 112 वर कॉल करा.',
      'tos.gps': 'GPS फक्त स्थान चालू करता किंवा तक्रार पाठवता — Terms स्वीकारण्याशी जोडलेले नाही.',
      'tos.itAct': 'CivicRadar IT Act, 2000 अंतर्गत मध्यस्थ आहे. अपलोडची जबाबदारी तुमची.',
      'tos.notBmc': 'CivicRadar स्वतंत्र — BMC, PMC, TMC किंवा कोणत्याही सरकारी संस्थेशी संलग्न किंवा चालवले नाही.',
      'tos.share': 'WhatsApp, X वर शेअर केल्याने वैयक्तिक डेटा उघडू शकतो — स्वतःच्या जोखमीवर.',
      'tos.subtitle': 'CivicRadar वापरण्यापूर्वी वाचा आणि स्वीकारा.',
      'tos.title': 'सेवा अटी',
      'volunteer.contact': 'फोन / WhatsApp (पर्यायी)',
      'volunteer.contactHint': 'पर्यायी — फक्त वॉर्ड/परिसर समन्वयकाला दिसेल. CivicRadar ऑटो-कॉल करत नाही.',
      'volunteer.edit': 'नोंद संपादित करा',
      'volunteer.empty': 'अद्याप साइन अप नाही. Community मधून लेनमध्ये मदत करा.',
      'volunteer.emptyAction': 'माझ्या वार्डात स्वयंसेवा',
      'volunteer.hours': 'या पावसाळ्यात उपलब्ध तास',
      'volunteer.hoursCustom': 'सानुकूल',
      'volunteer.hoursLabel': 'या पावसाळ्यात {n} तास',
      'volunteer.neighbourhoodHint': 'RWA, सोसायटी किंवा लेन — परिसर लीड जवळच्या स्पॉटशी जुळवेल.',
      'volunteer.neighbourhoodPh': 'उदा. Phoenix Mills लेन, Building 7 Worli',
      'volunteer.remove': 'माझी नोंद काढा',
      'volunteer.skills': 'मी यात मदत करू शकतो/शकते',
      'volunteer.submit': 'स्वयंसेवक नोंद जतन',
      'volunteer.ward': 'तुमचा वॉर्ड',
      'admin.meta.reporter': 'तक्रारकर्ता',
      'admin.meta.ward': 'वॉर्ड',
      'admin.meta.status': 'स्थिती',
      'admin.meta.lat': 'Lat',
      'admin.meta.lng': 'Lng',
      'admin.close': 'बंद',
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
      'about.founderDefault': 'विद्यार्थी संस्थापक',
      'config.contactMissing': '(संपर्क कॉन्फिग नाही)',
      'demo.badge': 'प्रोडक्ट डेमो',
      'profile.withdrawAnalytics': 'अ‍ॅनालिटिक्स संमती मागे घ्या',
      'profile.withdrawAnalyticsDone': 'अ‍ॅनालिटिक्स संमती मागे — स्थानिक डेटा साफ.',
      'profile.withdrawGps': 'स्थान संमती मागे घ्या',
      'profile.withdrawGpsDone': 'स्थान संमती मागे — गरज असेल तर नकाशा बॅनरवरून चालू करा.',
      'profile.privacyContact': 'गोपनीयता / तक्रार संपर्क',
      'toast.tosRequired': 'समुदाय वैशिष्ट्यांपूर्वी Terms आणि Privacy (18+) स्वीकारा.',
      'tos.analytics': 'अनाम उपयोग अ‍ॅनालिटिक्स (पर्यायी) विश्वासार्हता वाढवते. फोटो, GPS किंवा नाव पाठवले जात नाही.',
      'tos.analyticsOptIn': 'मी अनाम उपयोग अ‍ॅनालिटिक्सला संमती देतो/देते (पर्यायी — Profile मधून कधीही मागे)',
      'volunteer.ageNote': 'Terms नुसार 18+ आवश्यक. 18 पेक्षा कमी? पालक/पालक किंवा NSS समन्वयकासोबतच.',
      'admin.meta.neighbourConfirm': ' · {n} मला पण म्हटले',
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
      'volunteer.neighbourhood': 'परिसर / सोसायटी / लेन',
      'volunteer.subtitle': 'शेजाऱ्यांसोबत एकत्र — सरकारी स्वयंसेवा कार्यक्रम नाही.',
      'volunteer.skill.awareness': 'जागरूकता आणि WhatsApp outreach',
      'volunteer.skill.cleanup': 'साचलेले पाणी साफ करणे',
      'volunteer.skill.pledge': 'देणगी वितरण (साहित्य)',
      'profile.neighbourMany': 'शेजाऱ्यांनी मला पण म्हटले',
    },    gu: {
      'lang.name': 'Gujarati', 'lang.native': 'ગુજરાતી',
      'nav.map': 'નકશો', 'nav.community': 'સમુદાય', 'nav.profile': 'પ્રોફાઇલ',
      'fab.report': 'ફરિયાદ',
      'header.context': 'ચોમાસું જોખમ નકશો — મુંબઈ, પુણે અને ઠાણે',
      'header.contextCity': '{city} ચોમાસું — જોખમ નકશો',
      'location.banner': 'સચોટ ફરિયાદ માટે સ્થાન ચાલુ કરો.',
      'location.enable': 'ચાલુ કરો',
      'coach.step': '#MonsoonGuardian · 30 સેક', 'coach.title': 'ડેંગુનો દુશ્મન? ભરાયેલું પાણી!',
      'coach.body': 'ફરિયાદ દબાવો, ફોટો લો — વોર્ડ નકશા પર પિન. પડોશીઓ Me too કહેશે, ઝડપથી ઠીક થશે. WhatsApp પર શેર કરો!',
      'coach.got': 'ચાલો શરૂ કરીએ',
      'persona.citizen.idle': '🦟 ભરાયેલું પાણી = ડેંગુ જોખમ. ફરિયાદ દબાવો — 30 સેકમાં વોર્ડ નકશા પર, WhatsApp પર શેર.',
      'persona.wardImpact': '{ward}: {n} ચોમાસુ ફરિયાદ — ડેંગુ સ્થિર ગલીઓમાંથી શરૂ. #MonsoonGuardian',
      'persona.unfiled': '{n} ખુલ્લા જોખમો વોર્ડ નકશા પર — પડોશીઓ સાથે શેર કરો અથવા પ્રોફાઇલમાં અધિકૃત ફરિયાદ નોંધાવો.',
      'persona.pendingFiled': '{n} ખુલ્લા જોખમો પડોશીઓને દેખાય છે — મુદત ઓળંડે તો પ્રોફાઇલમાં આગળ વધારો.',
      'onboard.title': 'CivicRadar માં આપનું સ્વાગત છે',
      'onboard.subtitle': '30 સેકમાં ભરાયેલું પાણી પિન · પડોશીઓને બોલાવો · પ્રતિસ્પર્ધી વોર્ડને હરાવો. #MonsoonGuardian',
      'onboard.ward': 'તમારો વોર્ડ', 'onboard.wardPh': 'તમારો વોર્ડ ટાઈપ કરવાનું શરૂ કરો…',
      'onboard.wardHint': '{city}ના {n} સત્તાવાર વોર્ડમાંથી પસંદ કરો.',
      'onboard.city': 'તમારું શહેર',
      'onboard.cityHint': 'ક્યાં રહો છો પસંદ કરો — પછી GPS થી વોર્ડ શોધીશું.',
      'onboard.wardDetecting': 'તમારા સ્થાનથી વોર્ડ શોધી રહ્યા છીએ…',
      'onboard.wardDetectedHint': 'GPS થી અંદાજિત વોર્ડ — અધિકૃત સીમા સર્વેક્ષણ નથી.',
      'onboard.wardManual': 'ખોટું? જાતે પસંદ કરો',
      'onboard.wardRetry': 'ફરી શોધો',
      'onboard.wardDetectFailed': 'વોર્ડ મળ્યો નહીં — જાતે પસંદ કરો અથવા લોકેશન મંજૂરી આપો.',
      'onboard.name': 'પ્રદર્શિત નામ', 'onboard.namePh': 'અમે તમને શું કહીએ?',
      'onboard.join': 'સમુદાયમાં જોડાઓ',
      'report.title': 'જોખમની ફરિયાદ કરો',
      'report.step.photo': 'ફોટો', 'report.step.details': 'વિગતો', 'report.step.submit': 'મોકલો',
      'report.hazardType': 'જોખમનો પ્રકાર', 'report.photoEvidence': 'ફોટો પુરાવો',
      'report.capture': 'ફોટો લો',
      'report.notes': 'નોંધ (વૈકલ્પિક)', 'report.notesPh': 'જોખમનું વર્ણન કરો…',
      'report.submit': 'ફરિયાદ મોકલો',
      'moderation.guidelines': 'ફક્ત ખતરાનો સ્પષ્ટ ઑન-સાઇટ ફોટો અપલોડ કરો. સેલ્ફી, ID, દસ્તાવેજો અથવા અનિયુક્ત ચિત્રો નહીં — સ્થાન મેટાડેટા ગોપનીયતા માટે દૂર કરવામાં આવે છે.',
      'moderation.scanning': 'ફોટો સલામતી તપાસ…',
      'moderation.blocked.fileType': 'ફક્ત JPEG, PNG અથવા WebP hazard ફોટો સ્વીકાર્ય છે.',
      'moderation.blocked.fileSize': 'ફોટો ખૂબ મોટો છે. નાની છબી વાપરો (મહત્તમ 8 MB).',
      'moderation.blocked.lowQuality': 'ફોટો ખૂબ નાનો અથવા અસ્પષ્ટ છે. ખતરાની નજીક જાઓ.',
      'moderation.blocked.irrelevant': 'ખતરાનો ફોટો લો — સેલ્ફી, દસ્તાવેજો અથવા ખાલી ચિત્રો નહીં.',
      'moderation.blocked.sensitive': 'ID, દસ્તાવેજો અથવા સ્ક્રીનશોટ ટાળો. ફક્ત ખતરો બતાવો.',
      'moderation.blocked.nsfw': 'અનુચિત સામગ્રીને કારણે આ ફોટો બ્લોક કર્યો.',
      'moderation.blocked.offline': 'ફોટો સલામતી તપાસ માટે ઇન્ટરનેટથી કનેક્ટ થાઓ.',
      'success.title': 'ફરિયાદ નોંધાઈ', 'success.tagline': 'તમારા વોર્ડ નકશા પર પિન કરાયું',
      'success.taglineNeighbours': '{n} પડોશી નજીકના જોખમોને ટેકો આપે છે — તમારી ફરિયાદ પણ વોર્ડ નકશા પર દેખાય છે!',
      'success.subtitle': 'વૈકલ્પિક: સરકારી ઘડિયાળ શરૂ કરવા {corp} પર અધિકૃત ફરિયાદ નોંધાવો (મફત).',
      'success.step1': 'WhatsApp પર શેર કરો જેથી પડોશીઓ વોર્ડ નકશા પર પિન જોઈ શકે',
      'success.step2': 'વૈકલ્પિક: {corp} પર નોંધાવો અને ફરિયાદ નંબર સાચવો',
      'success.step3': 'સ્વયંસેવકો અથવા {corp} ઠીક થાય ત્યારે પુષ્ટિ કરી શકે — સિવિક પોઈન્ટ મળે',
      'success.file': 'અધિકૃત ફરિયાદ નોંધાવો (વૈકલ્પિક)',
      'success.tag': '@mybmc ને ટૅગ કરો', 'success.alert': 'પડોશીઓને જાણ કરો', 'success.done': 'થઈ ગયું',
      'success.sharePrompt': 'હમણાં WhatsApp પર મોકલો — વધુ નજર = ઝડપથી ઠીક. ડેંગુ ટાળવું હોય તો શેર કરો!',
      'success.shareWhatsapp': 'WhatsApp પર શેર કરો',
      'success.shareNudge': 'પડોશીઓને હજુ ખબર નથી — WhatsApp પર શેર કરો, વોર્ડ નકશા પર વધુ નજર મદદ કરે.',
      'success.shareMsg': '🦟 {ward} માં {hazard} — ડેંગુ જોખમ! CivicRadar વોર્ડ નકશા પર પિન.\nMe too કરો અને તમારી ગલી રિપોર્ટ કરો:\n{link}\n\n{marathi}\n{hashtags}',
      'share.marathiHook': 'पावसाळ्यात साचलेलं पाणी? वॉर्ड नकाशा पहा →',
      'share.appMsg': '🗺️ {city} ચોમાસું નકશો — ભરાયેલું પાણી પિન, Me too, પ્રતિસ્પર્ધી વોર્ડને હરાવો!\n{link}\n\n{marathi}\n{hashtags}',
      'share.meTooMsg': '👋 મને પણ — {ward} માં {hazard}. {n} પડોશી CivicRadar પર:\n{link}\n\n{marathi}\n{hashtags}',
      'share.meTooBtn': 'WhatsApp પર શેર કરો',
      'share.wardMapMsg': '⚡ {ward}: {pending} ખુલ્લા ડેંગુ-જોખમ સ્પોટ — CivicRadar પર અમને હરાવો!\n{link}\n\n{marathi}\n{hashtags}',
      'share.cleanupMsg': '🧹 {ward} માં સ્વયંસેવકોએ {hazard} સાફ કર્યું! પહેલાં → પછી:\n{link}\n\n{marathi}\n{hashtags}',
      'share.instagramCaption': '{ward} માં {hazard} સાફ 🎉 CivicRadar પર પહેલાં → પછી. ચોમાસાની જીત.\n{link}\n\n{marathi}\n{hashtags}',
      'share.instagramCleanupCaption': '{ward} માં સ્વયંસેવકોએ {hazard} સાફ કર્યું 🧹 CivicRadar પર પહેલાં → પછી.\n{link}\n\n{marathi}\n{hashtags}',
      'share.milestoneMsg': '🏆 {ward} એ {n} ઉકેલ! તમારો વોર્ડ?\n{link}\n\n{marathi}\n{hashtags}',
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
      'shareWin.impact': '{n} પડોશીઓએ ટેકો · {ward} — આ જીત સ્ક્રીનશોટ કરો! 🏆',
      'about.shareTitle': 'એપ શેર કરો',
      'about.sharePitch': 'મફત {city} ચોમાસું નકશો — 30 સેકમાં રિપોર્ટ, Me too, પ્રતિસ્પર્ધી વોર્ડને હરાવો.\nNJ વિદ્યાર્થીએ ભારતમાં પરિવાર માટે બનાવ્યું. લોગિન નહીં, 4 ભાષાઓ.\n{link}\nRWA / સોસાયટી WhatsApp ગ્રુપમાં ફોરવર્ડ કરો →',
      'about.copyPitch': 'WhatsApp પિચ કૉપી કરો',
      'about.pitchCopied': 'પિચ કૉપી — RWA ગ્રુપમાં પેસ્ટ કરો!',
      'pwa.nudge': 'ચોમાસા-તૈયાર: હોમ સ્ક્રીન પર CivicRadar ઉમેરો.',
      'pwa.nudgeAction': 'હોમ સ્ક્રીન પર ઉમેરો',
      'pwa.nudgeDismiss': 'હમણાં નહીં',
      'community.challengeShare': 'મિત્રને પડકાર — વોર્ડ નકશો શેર કરો',
      'community.winsTitle': 'આ ચોમાસાની જીત',
      'community.winsEmpty': 'ઉકેલાયેલા સ્પોટ અહીં દેખાશે — રિપોર્ટ કરો, પડોશીઓને બોલાવો, જીત ઉજવો.',
      'community.winsNeighbours': '{ward} માં પડોશીઓ',
      'community.winsCleanup': '{hazard} સાફ · {ward}',
      'community.winsResolved': '{hazard} ઉકેલાયું · {ward}',
      'success.points': 'સિવિક પોઈન્ટ મળ્યા', 'success.weekBonus': '+{n} આ અઠવાડિયાની પહેલી ફરિયાદ!',
      'map.empty': '{ward} માં સ્વચ્છ નકશો — #MonsoonGuardian બનો! ડેંગુ ફેલાય તે પહેલાં ભરાયેલું પાણી રિપોર્ટ કરો.',
      'map.emptyAction': 'પહેલો જોખમ રિપોર્ટ કરો',
      'map.emptyShare': 'WhatsApp પર પડોશીઓને બોલાવો',
      'map.emptyRival': '{ward} વિ.{rival} — તેમના {pending} ખુલ્લા સ્પોટ. રિપોર્ટ કરો અથવા પડોશીઓને બોલાવો!',
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
      'persona.ngo.pledges': '{deliver} વિતરણ · {verify} ચકાસણી',
      'persona.ngo.newHazards': 'વોર્ડમાં {n} નવા જોખમ',
      'persona.ngo.newPledges': '{n} નવી પ્રતિજ્ઞા',
      'persona.admin.overdue': '{overdue} મુદત ઓળંડી · {pending} બાકી — કતાર ખોલો',
      'profile.badge.reporter': 'સક્રિય રિપોર્ટર',
      'profile.badge.2week': '2-અઠવાડિયા રિપોર્ટર',
      'profile.badge.3week': '3-અઠવાડિયા રિપોર્ટર',
      'profile.badge.monsoon': 'ચોમાસુ રક્ષક',
      'profile.wardImpact': 'તમારો વોર્ડ: આ ચોમાસે {n} ફરિયાદ',
      'profile.streak': '{n}-અઠવાડિયાની રિપોર્ટિંગ સ્ટ્રીક',
      'confirm.nearby': 'પિન {m} મી. દૂર{backing}. ડુપ્લિકેટ બદલે મને પણ દબાવો — ઠીક થાય ત્યારે અપડેટ.',
      'esc.participate.title': 'સામુદાયિક ક્રિયા (વૈકલ્પિક)',
      'esc.participate.hint': 'Participate Mumbai BMC નું અધિકૃત સ્વયંસેવા/CSR પોર્ટલ છે — જંતુ નિયંત્રણ ફરિયાદો માટે નહીં. સફાઈ અભિયાન અથવા વોર્ડ પ્રોજેક્ટ માટે વાપરો.',
      'esc.participate.btn': 'Participate Mumbai',
      'esc.participate.small': 'સ્વયંસેવા · CSR · પ્રોજેક્ટ',
      'community.title': 'સમુદાય',
      'community.subtitle': '{ward} માં સાથે મળીને ઠીક કરો — સ્વયંસેવા, સામગ્રી દાન, અથવા અલગથી {corp} પર નોંધ.',
      'community.topWards': 'ટોચના વોર્ડ', 'community.localCitizens': 'સ્થાનિક નાગરિકો',
      'community.supportTitle': 'સ્વયંસેવકોને ટેકો આપો',
      'community.supportBody': 'ભરાયેલા પાણી સામે લડતા સ્થાનિક સફાઈ દળોને મદદ માટે સામગ્રી દાન કરો.',
      'community.pledge': 'દાન',
      'community.volunteerTitle': 'મારા વોર્ડમાં સ્વયંસેવા',
      'community.volunteerBody': 'સાથે મળીને ઠીક કરો — {corp} પર નોંધ અલગ છે.',
      'community.volunteerCta': 'સાઇન અપ',
      'volunteer.title': 'મારા વોર્ડમાં સ્વયંસેવા',
      'popup.helpClean': 'હું સાફ કરવામાં મદદ કરી શકું',
      'profile.volunteer': 'મારી સ્વયંસેવક નોંધણી',
      'coord.volunteers': 'તમારા વિસ્તારના સ્વયંસેવકો',
      'coord.tasks': 'સ્વયંસેવક સફાઈ ઓફર',
      'inquiry.coordTitle': 'વોર્ડ અથવા પડોશ સમન્વયક બનો',
      'about.becomeCoord': 'વોર્ડ અથવા પડોશ સમન્વયક બનો',
      'pledge.notice': 'તમારા વોર્ડનો NGO સંકલક આને તેમના હબમાં જોશે — BMC નહીં. તેઓ એપમાં સંપર્ક કરી શકે; સ્વચાલિત કૉલ/SMS નહીં.',
      'pledge.status.pledged': 'પ્રતિજ્ઞા નોંધ',
      'pledge.status.delivered': 'વિતરિત',
      'pledge.status.verified': 'ચકાસાયેલ (+200 પોઈન્ટ)',
      'toast.pledgeSaved': 'પ્રતિજ્ઞા નોંધ — વોર્ડ સંકલકને હબમાં દેખાશે.',
      'toast.pledgeDuplicate': 'આ વોર્ડ અને સામગ્રી માટે પહેલેથી ખુલ્લી પ્રતિજ્ઞા છે.',
      'toast.pledgeWardMismatch': 'આ તમારા વોર્ડથી અલગ — તે વોર્ડનો સંકલક સંભાળશે.',
      'toast.pledgeStatusDelivered': 'સંકલકે તમારી પ્રતિજ્ઞા વિતરિત તરીકે ચિહ્નિત કરી.',
      'toast.pledgeStatusVerified': 'સ્વયંસેવક કલાક ચકાસાયા — +200 સિવિક પોઈન્ટ!',
      'toast.ngoNewPledge': 'તમારા વોર્ડમાં {n} નવી નાગરિક પ્રતિજ્ઞા.',
      'toast.ngoNewPledgeAction': 'હબ ખોલો',
      'coord.pledgesNew': 'નાગરિક પ્રતિજ્ઞા · {n} નવી',
      'coord.pledgesEmpty': 'હજુ પ્રતિજ્ઞા નથી. વોર્ડના રહેવાસીઓ સાથે Community ટેબ શેર કરો.',
      'coord.markDelivered': 'વિતરિત ચિહ્નિત કરો',
      'coord.verifyHours': 'કલાક ચકાસો (+200)',
      'coord.verified': 'ચકાસાયેલ',
      'profile.pledges': 'મારી પ્રતિજ્ઞાઓ',
      'profile.pledgesEmpty': 'હજુ પ્રતિજ્ઞા નથી. Community માંથી સ્થાનિક સ્વયંસેવકોને ટેકો આપો.',
      'profile.pledgesEmptyAction': 'પ્રતિજ્ઞા કરો',
      'profile.title': 'તમારી પ્રોફાઇલ', 'profile.persona': 'નાગરિક',
      'profile.points': 'કુલ સિવિક પોઈન્ટ', 'profile.fixed': 'ઉકેલાયેલા જોખમો', 'profile.pending': 'ખુલ્લા જોખમો',
      'profile.reports': 'તમારી ફરિયાદો',
      'profile.install': 'CivicRadar એપ ઇન્સ્ટોલ કરો', 'profile.partner': 'સ્વયંસેવક / NGO લૉગિન',
      'profile.about': 'CivicRadar વિશે', 'profile.sponsor': 'પ્રાયોજક અથવા ભાગીદાર બનો',
      'profile.deleteData': 'મારો ડેટા કાઢી નાખો',
      'profile.deleteConfirm': 'આ ઉપકરણ અને ક્લાઉડમાંથી તમારી રિપોર્ટ, પ્રતિજ્ઞા અને પ્રોફાઇલ કાયમી કાઢી નાખો? પાછું લાવી શકાશે નહીં.',
      'profile.deleteDone': 'તમારો ડેટા કાઢી નાખ્યો. તમે ફરી શરૂ કરી શકો.',
      'legal.privacy': 'ગોપનીયતા નીતિ',
      'legal.terms': 'સેવાની શરતો',
      'impact.reports': 'ફરિયાદો', 'impact.resolved': 'ઉકેલાયા', 'impact.confirms': 'મને પણ',
      'impact.pledges': 'દાન', 'impact.wards': 'વોર્ડ',
      'impact.week': 'આ અઠવાડિયે: {reports} ફરિયાદ · {resolved} ઉકેલાયા · {confirms} પુષ્ટિ',
      'impact.resolvedBreakdown': 'તમે: {self} · સમુદાય: {community} · BMC: {bmc} · સફાઈ: {cleanup}',
      'about.title': 'CivicRadar વિશે',
      'about.subtitle': 'મુંબઈ, પુણે અને ઠાણે ચોમાસા માટે સામુદાયિક એપ — વિદ્યાર્થી દ્વારા, નાગરિકો માટે મફત.',
      'about.impactTitle': 'સામુદાયિક પ્રભાવ', 'about.builtTitle': 'અમે શું બનાવ્યું',
      'about.sustainTitle': 'ટકાઉ અને નાગરિકો માટે મફત',
      'about.sustainBody': 'CivicRadar રહેવાસીઓ માટે હંમેશા મફત રહેશે. ભવિષ્યની આવક નૈતિક સ્થાનિક ભાગીદારીમાંથી આવે છે.',
      'about.copyImpact': 'પ્રભાવ સારાંશ કૉપી કરો', 'about.contact': 'સંસ્થાપકનો સંપર્ક', 'about.contactOperator': 'ઑપરેટરનો સંપર્ક', 'about.close': 'બંધ',
      'about.sponsored': 'પ્રાયોજિત',       'about.copied': 'પ્રભાવ સારાંશ કૉપી થયો — અરજીમાં પેસ્ટ કરો.',
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
      'hazard.stagnant-water': 'ભરાયેલું પાણી', 'hazard.potholes': 'ખાડા',
      'hazard.garbage': 'કચરો', 'hazard.streetlight': 'બંધ સ્ટ્રીટલાઇટ',
      'hazard.comingSoon': 'ટૂંક સમયમાં',
      'soon.title': 'ટૂંક સમયમાં', 'soon.notify': 'લાઇવ થાય ત્યારે મને જાણ કરો',
      'soon.thanks': 'આભાર — લૉન્ચ થાય ત્યારે અમે તમને જાણ કરીશું.',
      'soon.roadmap': 'આજે: ભરાયેલું પાણી. આગળ, તમારા મતના આધારે:',
      'confirm.metoo': 'મને પણ', 'confirm.you': 'તમારી ફરિયાદ',
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
      'confirm.shareMsg': '✅ {ward} માં જોખમ CivicRadar પર ઠીક! સામૂહિક દબાણ કામ કરે છે:\n{link}\n\n{marathi}\n{hashtags}',
      'fix.looksFixed': 'હવે ઠીક લાગે છે',
      'fix.done': 'તમે ઠીક કહ્યું',
      'fix.thanks': 'આભાર — પૂરતા પડોશીઓ સહમત થાય ત્યારે ઠીક ચિહ્નિત કરીશું.',
      'fix.countOne': '1 પડોશી કહે છે ઠીક',
      'fix.countMany': '{n} પડોશી કહે છે ઠીક',
      'fix.hint': 'ફક્ત સમુદાય તપાસ — અધિકૃત BMC પુષ્ટિ નહીં.',
      'fix.resolved': '{ward} ની તપાસ કરેલી જગ્યા સમુદાય-સત્યાપિત ઠીક!',
      'fix.resolvedMany': 'તમે તપાસેલી {n} જગ્યાઓ સમુદાય-સત્યાપિત ઠીક!',
      'fix.afterPhotoPrompt': 'વૈકલ્પિક: પ્રોફાઇલમાંથી પછીનો ફોટો ઉમેરો.',
      'reminder.staleCheck': '{ward} પાસે — હજુ stagnant?',
      'reminder.stillThere': 'હજુ છે',
      'reminder.looksFixed': 'ઠીક લાગે છે',
      'profile.status.communityVerified': 'સમુદાયે ઠીકની પુષ્ટિ',
      'profile.status.youMarkedFixed': 'તમે ઠીક ચિહ્નિત',
      'profile.status.bmcResolved': 'BMC એ ઉકેલ્યું',
      'profile.badge.communityVerified': 'સમુદાય સત્યાપિત',
      'profile.badge.youMarkedFixed': 'તમે ચિહ્નિત',
      'profile.badge.bmcResolved': 'BMC ઉકેલ',
      'community.winsCommunityVerified': '{hazard} સમુદાય-સત્યાપિત · {ward}',
      'shareWin.subtitleCommunity': 'પડોશીઓએ પુષ્ટિ કરી — અધિકૃત BMC રેકોર્ડ નહીં.',
      'toast.fixConfirmed': '+10 પોઇન્ટ — તપાસ માટે આભાર!',
      'toast.communityResolved': 'સમુદાય-સત્યાપિત ઠીક — ફરિયાદ માટે આભાર!',
      'sync.cloud': 'સિંક', 'sync.local': 'ફક્ત સ્થાનિક',
      'sync.cloudTitle': 'ફરિયાદો બધા ઉપકરણો પર સિંક', 'sync.localTitle': 'ફક્ત આ ઉપકરણ પર — ક્લાઉડ જોડાય ત્યારે સિંક થશે',
      'report.submitting': 'મોકલાઈ રહ્યું છે…',
      'success.clock': 'સામુદાયિક નકશા પર — {corp} પર હજુ નોંધાયું નથી.',
      'map.legend.aria': 'નકશા કિંવદંતી: ખુલ્લું, ઠીક, અને તમારા પિન',
      'community.subtitleActive': '{ward}: {pending} ખુલ્લા જોખમો · {resolved} ઉકેલાયા. પડોશીઓને બોલાવો!',
      'community.challenge.empty': '{ward} માં મોનસૂન બોર્ડ પર પહેલા બનો — આજે જ રિપોર્ટ કરો.',
      'community.challenge.beat': '{ward}: {pending} ડેંગુ-જોખમ સ્પોટ — {rival} ({rivalPending} બાકી) કરતાં આગળ! 🔥',
      'community.challenge.leading': '{ward} {resolved} ઉકેલ સાથે અગ્રણી — {rival} કરતાં આગળ!',
      'community.challenge.catch': '{ward}: {leader} ({leaderResolved} ઉકેલ) નો પીછો કરો. સ્વચ્છ સર્વેક્ષણ તમારી ગલીથી.',
      'community.challenge.leaderboard': '{leader} {resolved} ઉકેલ સાથે ટોચ પર — આગળ કયો વોર્ડ?',
      'leaderboard.demo': 'ડેમો', 'leaderboard.you': 'તમે', 'leaderboard.demoNote': 'વધુ વોર્ડ રિપોર્ટ થાય ત્યાં સુધી નમૂના. વાસ્તવિક આંકડા વધશે.',
      'leaderboard.resolved': '{n} ઉકેલાયા', 'leaderboard.emptyWards': 'તમારો વોર્ડ બોર્ડ પર જોવા રિપોર્ટ કરો.',
      'leaderboard.emptyCitizens': 'સ્થાનિક બોર્ડ પર આવવા ફરિયાદ નોંધાવો.',
      'leaderboard.emptyFirst': 'તમારા વોર્ડમાં પહેલા બનો — બોર્ડ પર ચડવા રિપોર્ટ કરો.',
      'admin.proofBefore': 'પહેલાં (નાગરિક)', 'admin.proofAfter': 'પછી (BMC પુરાવો)',
      'admin.proofCapture': 'પુરાવો ફોટો ઉમેરો', 'admin.proofHint': 'સ્પષ્ટ "પછી" ફોટો — નાગરિકો પહેલાં/પછી જોશે.',
      'admin.proofPrompt': 'પછીનો ફોટો ઉમેરો, પછી પુષ્ટિ માટે ફરી ટૅપ કરો.',
      'admin.proofRequired': 'પુરાવો ફોટો જરૂરી — ઉકેલતા પહેલાં "પછી" ફોટો ઉમેરો.',
      'admin.confirmResolve': 'ઉકેલની પુષ્ટિ?',
      'admin.exportCsv': 'વોર્ડ CSV નિકાસ',
      'admin.exportEmpty': 'આ ફિલ્ટર માટે નિકાસ કરવા અહવાલ નથી.',
      'admin.exportSuccess': '{n} અહવાલ CSV માં નિકાસ.',
      'admin.copy1916': '1916 માટે કૉપી',
      'admin.copy1916Copied': 'કૉપી થયું — 1916 માં પેસ્ટ કરો',
      'profile.proofBefore': 'પહેલાં', 'profile.proofAfter': 'પછી',
      'confirm.shareResolvedMsg': '✅ {ward} માં ઠીક! CivicRadar પર પહેલાં → પછી:\n{link}\n\n{marathi}\n{hashtags}',
      'esc.title': 'અધિકૃત ફરિયાદ સહાયક', 'esc.subtitle': 'CivicRadar જોખમો સામુદાયિક નકશા પર બતાવે છે. BMC માં નોંધાવવું વૈકલ્પિક છે પણ અધિકૃત ઘડિયાળ શરૂ કરે — આ અધિકૃત BMC ચેનલ નથી.',
      'esc.fileTitle': 'ફરિયાદ નોંધાવો (મફત)', 'esc.fileHint': 'ભરાયેલું પાણી વોર્ડ PCO પાસે જાય છે. કોઈ પણ ચેનલ:',
      'esc.recommended': 'ભલામણ: MyBMC WhatsApp — મોટાભાગના Mumbai વોર્ડ માટે સૌથી ઝડપી.',
      'esc.channelWa': 'ચેટબોટ · નીચેથી કૉપી', 'esc.channelCall': '24×7 હેલ્પલાઇન', 'esc.channelPortal': 'ઓનલાઇન પોર્ટલ', 'esc.channelTweet': 'જાહેર દબાણ',
      'esc.margApp': 'MyBMC MARG એપ', 'esc.margAppSmall': 'અધિકૃત ફરિયાદ એપ',
      'esc.copyBlock': '1916 / પોર્ટલ / એપ માટે વિગતો', 'esc.copyAll': 'બધી વિગતો કૉપી', 'esc.copyAllDone': 'કૉપી થઈ — અધિકૃત ચેનલ પર નોંધાવતી વખતે પેસ્ટ કરો',
      'esc.copyBilingual': 'કોલ સેન્ટર: ટેક્સ્ટ બ્લોકમાં મરાઠી લીટી વાંચી શકો.',
      'esc.portalHint': 'પોર્ટલ અથવા MARG: Public Health → Pest Control → stagnant water. નીચે વિગતો પેસ્ટ કરો.',
      'esc.filedConsent': 'મેં અધિકૃત BMC ચેનલ પર નોંધાવ્યું (1916 / MyBMC / પોર્ટલ / એપ)',
      'esc.complaintWarn': 'સામાન્ય BMC નંબર જેવું લાગતું નથી — સાચું હોય તો સાચવો.',
      'esc.saveUnlock': 'સાચવ્યા પછી: પગથિયાં, દિવસ ગણતરી, ફોલો-અપ ટેક્સ્ટ.',
      'esc.closeNudge': 'ફરિયાદ નંબર હજુ સાચવ્યો નથી — Profile માંથી ક્યારે પણ નોંધાવો.',
      'esc.daysSince': 'BMC નોંધ {n} દિવસ',
      'esc.progress.reported': 'રિપોર્ટ', 'esc.progress.shared': 'શેર', 'esc.progress.filed': 'નોંધ', 'esc.progress.escalating': 'એસ્કેલેટ', 'esc.progress.resolved': 'ઉકેલ',
      'esc.tier.copyFollowUp': 'ફોલો-અપ કૉપી', 'esc.tier.openWa': 'WhatsApp', 'esc.tier.openCall': '1916', 'esc.tier.openTweet': '@mybmc', 'esc.tier.openAaple': 'Aaple Sarkar',
      'esc.copyFollowUpDone': 'ફોલો-અપ કૉપી', 'esc.rtiDisclaimer': 'માત્ર માહિતી RTI ટેમ્પલેટ — કાનૂની સલાહ નહીં.', 'esc.consentRequired': 'સાચવતા પહેલાં અધિકૃત BMC ચેનલ પર નોંધાવ્યાની પુષ્ટિ કરો.',
      'esc.complaintLabel': 'BMC ફરિયાદ નંબર', 'esc.complaintPh': 'દા.ત. N/2026/123456',
      'esc.complaintHint': 'નંબર સાચવતાં જવાબદારી ઘડિયાળ શરૂ.', 'esc.filedNote': 'BMC માં નોંધ — મુદત પર આગળ.',
      'esc.ladderTitle': 'એસ્કેલેશન પગથિયાં', 'esc.selfTitle': 'BMC એ ઠીક કર્યું?', 'esc.selfBody': 'પોતે પુષ્ટિ કરો — બધા માટે લીલું.',
      'esc.selfBtn': 'ઉકેલ ચિહ્નિત', 'esc.aaple': 'Aaple Sarkar (રાજ્ય)', 'esc.close': 'બંધ', 'esc.save': 'સાચવો',
      'esc.tmc.recommended': 'ભલામણ: thanecity.gov.in પર નોંધાવો અથવા TMC હેલ્પલાઇન 022-25331590 પર કૉલ કરો.',
      'esc.tmc.fileHint': 'અટકેલું પાણી / મચ્છર — નીચેના કોઈ પણ અધિકૃત TMC ચેનલનો ઉપયોગ કરો.',
      'esc.tmc.channelPortal': 'TMC ઑનલાઇન પોર્ટલ', 'esc.tmc.channelCall': 'TMC હેલ્પલાઇન',
      'esc.tmc.channelEmail': 'મ્યુનિસિપલ કમિશનરને ઈમેલ', 'esc.tmc.channelTweet': '@TMCaTweetAway ટૅગ',
      'esc.tmc.channelCitizenCall': 'નાગરિક કૉલ સેન્ટર (155300)',
      'esc.tmc.copyBlock': 'TMC પોર્ટલ / હેલ્પલાઇન / ઈમેલ માટે વિગતો',
      'esc.tmc.copyAllDone': 'કૉપી થયું — TMC માં નોંધાવતી વખતે પેસ્ટ કરો',
      'esc.tmc.portalHint': 'thanecity.gov.in: લૉગિન → ઑનલાઇન નાગરિક સેવાઓ → ફરિયાદ નોંધાવો. નીચે વિગતો પેસ્ટ કરો.',
      'esc.tmc.filedConsent': 'મેં અધિકૃત TMC ચેનલ પર નોંધાવ્યું (પોર્ટલ / હેલ્પલાઇન / ઈમેલ / 155300 / Aaple Sarkar)',
      'esc.tmc.complaintLabel': 'TMC ફરિયાદ / સંદર્ભ નંબર', 'esc.tmc.complaintPh': 'ઉદા. TMC/2026/123456',
      'esc.tmc.complaintWarn': 'આ સામાન્ય TMC સંદર્ભ જેવું નથી — સાચું હોય તો પણ સાચવી શકો.',
      'esc.tmc.filedNote': 'TMC માં નોંધાવ્યું — મુદત પસાર થતાં આગળ વધારો.', 'esc.tmc.daysSince': 'TMC માં નોંધાવ્યાના {n} દિવસ',
      'esc.tmc.selfTitle': 'TMC એ ઠીક કર્યું?', 'esc.tmc.selfBody': 'TMC ઠીક કરે ત્યારે પુષ્ટિ કરો — બધા માટે લીલો ચિહ્ન.',
      'esc.tmc.aaple': 'Aaple Sarkar — TMC સ્થાનિક સંસ્થા પસંદ કરો',
      'esc.tmc.deptTitle': 'વિભાગ સંપર્ક (એસ્કેલેશન)', 'esc.tmc.deptHint': 'અટકેલા પાણી માટે — પાણી, આરોગ્ય, પ્રદૂષણ નિયંત્રણ.',
      'esc.tmc.dept.water': 'પાણી', 'esc.tmc.dept.health': 'આરોગ્ય', 'esc.tmc.dept.pollution': 'પ્રદૂષણ નિયંત્રણ',
      'esc.tmc.tier.file.body': 'મફત. thanecity.gov.in, 022-25331590 / 022-25331211, mc@thanecity.gov.in, અથવા 155300. સંદર્ભ અહીં સાચવો.',
      'esc.tmc.tier.matrix.body': 'વોર્ડ ઑફિસ અથવા આરોગ્ય (022-25332685) ને ફોલો-અપ. TMC સંદર્ભ આપો.',
      'esc.tmc.tier.zonal.body': 'મ્યુનિસિપલ કમિશનર (mc@thanecity.gov.in) સુધી એસ્કેલેટ. @TMCaTweetAway પર ફોટો સાથે ટૅગ.',
      'esc.tmc.tier.grievance.body': 'એક મહિના પછી પણ? Aaple Sarkar (grievances.maharashtra.gov.in) — Thane Municipal Corporation પસંદ કરો.',
      'esc.tmc.tier.openCall': 'TMC કૉલ', 'esc.tmc.tier.openTweet': '@TMCaTweetAway', 'esc.tmc.tier.openEmail': 'MC ઈમેલ', 'esc.tmc.tier.openAaple': 'Aaple Sarkar',
      'esc.tmc.consentRequired': 'સાચવતા પહેલાં અધિકૃત TMC ચેનલ પર નોંધાવ્યાની પુષ્ટિ કરો.',
      'esc.pmc.subtitle': 'CivicRadar જોખમો સામુદાયિક નકશા પર બતાવે છે. PMC માં નોંધાવવું વૈકલ્પિક — અધિકૃત ઘડિયાળ શરૂ કરે. આ PMC ચેનલ નથી.',
      'esc.pmc.recommended': 'ભલામણ: PMC CARE WhatsApp — મોટાભાગના Pune વોર્ડ માટે સૌથી ઝડપી.',
      'esc.pmc.fileHint': 'અટકેલું પાણી અને મચ્છર PMC CARE દ્વારા જાય છે. કોઈ પણ ચેનલ:',
      'esc.pmc.channelWa': 'PMC CARE WhatsApp', 'esc.pmc.channelWaSmall': 'ચેટ · નીચેથી કૉપી',
      'esc.pmc.channelCall': 'ટોલ-ફ્રી હેલ્પલાઇન', 'esc.pmc.channelPortal': 'PMC CARE પોર્ટલ',
      'esc.pmc.channelApp': 'PMC CARE એપ', 'esc.pmc.channelAppSmall': 'Play Store · App Store',
      'esc.pmc.copyBlock': 'PMC CARE / WhatsApp / હેલ્પલાઇન માટે વિગતો',
      'esc.pmc.copyAllDone': 'કૉપી થયું — PMC CARE / WhatsApp પર નોંધાવતી વખતે પેસ્ટ કરો',
      'esc.pmc.portalHint': 'PMC CARE પોર્ટલ અથવા એપ: અટકેલા પાણી / મચ્છર ફરિયાદ નોંધાવો. નીચે વિગતો પેસ્ટ કરો.',
      'esc.pmc.filedConsent': 'મેં અધિકૃત PMC ચેનલ પર નોંધાવ્યું (PMC CARE / WhatsApp / હેલ્પલાઇન / એપ)',
      'esc.pmc.complaintLabel': 'PMC ફરિયાદ / સંદર્ભ નંબર', 'esc.pmc.complaintPh': 'ઉદા. PMC/2026/123456',
      'esc.pmc.complaintWarn': 'આ સામાન્ય PMC સંદર્ભ જેવું નથી — સાચું હોય તો પણ સાચવી શકો.',
      'esc.pmc.filedNote': 'PMC માં નોંધાવ્યું — મુદત પસાર થતાં આગળ વધારો.', 'esc.pmc.daysSince': 'PMC માં નોંધાવ્યાના {n} દિવસ',
      'esc.pmc.selfTitle': 'PMC એ ઠીક કર્યું?', 'esc.pmc.selfBody': 'PMC ઠીક કરે ત્યારે પુષ્ટિ કરો — બધા માટે લીલો ચિહ્ન.',
      'esc.pmc.tier.file.body': 'મફત. PMC CARE પોર્ટલ, WhatsApp, 1800 1030 222, અથવા PMC CARE એપ. સંદર્ભ અહીં સાચવો.',
      'esc.pmc.tier.matrix.body': 'PMC CARE અથવા ટોલ-ફ્રી હેલ્પલાઇન દ્વારા ફોલો-અપ. ફરિયાદ નંબર આપો.',
      'esc.pmc.tier.zonal.body': 'વોર્ડે કાર્યવાહી નહીં? PMC CARE પોર્ટલ અથવા WhatsApp દ્વારા એસ્કેલેટ.',
      'esc.pmc.tier.grievance.body': 'એક મહિના પછી પણ? Aaple Sarkar — Pune Municipal Corporation પસંદ કરો.',
      'esc.pmc.tier.openWa': 'WhatsApp', 'esc.pmc.tier.openCall': 'PMC હેલ્પલાઇન', 'esc.pmc.tier.openAaple': 'Aaple Sarkar',
      'esc.pmc.consentRequired': 'સાચવતા પહેલાં અધિકૃત PMC ચેનલ પર નોંધાવ્યાની પુષ્ટિ કરો.',
      'esc.pmc.aaple': 'Aaple Sarkar — Pune Municipal Corporation સ્થાનિક સંસ્થા પસંદ કરો',
      'copy1916.pmc.header': 'PMC ફરિયાદ વિગત (PMC CARE / WhatsApp / હેલ્પલાઇન પર કૉપી-પેસ્ટ)',
      'copy1916.pmc.complaintNotFiled': 'PMC ફરિયાદ #: (હજુ નોંધ નથી)', 'copy1916.pmc.complaintFiled': 'PMC ફરિયાદ #: {id}',
      'profile.fileCorp': '{corp} માં નોંધાવો',
      'esc.tier.file.title': '1 · અધિકૃત ફરિયાદ', 'esc.tier.file.body': 'મફત. વોર્ડ PCO. નંબર અહીં સાચવો.',
      'esc.tier.matrix.title': '2 · દિવસ {n}+ — વોર્ડ', 'esc.tier.matrix.body': '7 દિવસે BMC ઑટો-એસ્કેલેટ. WCO / AMC.',
      'esc.tier.zonal.title': '3 · દિવસ {n}+ — ઝોનલ', 'esc.tier.zonal.body': 'Zonal DMC અને @mybmc જાહેર દબાણ.',
      'esc.tier.grievance.title': '4 · દિવસ {n}+ — ફરિયાદ / RTI', 'esc.tier.grievance.body': 'એક મહિના પછી? Aaple Sarkar અથવા RTI.',
      'profile.empty': 'હજુ ફરિયાદ નથી. નજીક ભરાયેલું પાણી?', 'profile.emptyAction': 'હમણાં રિપોર્ટ',
      'profile.trackEscalate': 'ટ્રૅક / આગળ', 'profile.fileBmc': 'BMC માં નોંધાવો',
      'profile.status.resolvedCitizen': 'ઉકેલ (તમે)', 'profile.status.resolvedBmc': 'BMC એ ઉકેલ્યું',
      'profile.status.notFiled': 'સામુદાયિક નકશા પર ખુલ્લું',
      'profile.communityCleared': 'સ્વયંસેવકોએ સાફ કર્યું — {corp} ફરિયાદ હજુ ખુલ્લી હોઈ શકે',
      'popup.communityCleared': 'સ્વયંસેવકોએ સાફ કર્યું — {corp} ફરિયાદ હજુ ખુલ્લી હોઈ શકે',
      'profile.neighbourOne': 'પડોશીએ મને પણ કહ્યું',
      'profile.pointsHint.base': '50 પોઈન્ટ/ફરિયાદ · +200 સ્વયંસેવા', 'profile.pointsHint.bonus': '{n} × 50 · +{bonus} બોનસ',
      'profile.greeting': 'નમસ્તે, {name}', 'profile.greetingDefault': 'નમસ્તે, નાગરિક', 'profile.selectWard': 'વોર્ડ પસંદ કરો',
      'about.subtitleNamed': 'મુંબઈ, પુણે અને ઠાણે ચોમાસું — {name} દ્વારા, નાગરિકો માટે મફત.',
      'safety.hide': 'ફ્લેગ / છુપાવો', 'safety.hidden': 'તમારા નકશાથી છુપાવ્યું.', 'safety.hideConfirm': 'આ પિન છુપાવીએ? (ફરિયાદ ડિલીટ નથી.)',
      'popup.pending': 'બાકી', 'popup.resolved': 'ઉકેલાયું',
      'partner.title': 'પાર્ટનર ઍક્સેસ',
      'partner.subtitle': 'NGO સંકલનકર્તા અને સ્વયંસેવકો માટે. નગરપાલિકા ઍક્સેસ આમંત્રણ દ્વારા.',
      'partner.ngoTitle': 'NGO સંકલનકર્તા',
      'partner.ngoBody': 'દાન જુઓ, સ્વયંસેવકો મોકલો અને સફાઈ નોંધો',
      'partner.bmcTitle': 'નગરપાલિકા પાયલટ',
      'partner.bmcBody': 'આમંત્રિત BMC પાયલટ માટે — ઍક્સેસ માટે સંપર્ક કરો',
      'admin.allWards': 'બધા વોર્ડ',
      'admin.avgDays': 'સરેરાશ દિવસ',
      'admin.exitMode': 'BMC મોડ બંધ',
      'admin.healthLoading': 'ઉપયોગ લોડ થઈ રહ્યો…',
      'admin.healthSummary': 'એપ આરોગ્ય (છેલ્લા 7 દિવસ)',
      'admin.markResolved': 'ઉકેલ ચિહ્નિત',
      'admin.overdue': '7+ દિવસ બાકી',
      'admin.pending': 'ખુલ્લા',
      'admin.queueSubtitle': 'નાગરિક ફરિયાદો જુઓ, પ્રાથમિકતા આપો, ઉકેલો.',
      'admin.queueTitle': 'જોખમ કતાર',
      'admin.reportTitle': 'જોખમ ફરિયાદ',
      'admin.resolved': 'ઉકેલાયા',
      'admin.resolveHint': 'નાગરિકને શ્રેય — પિન લીલો થશે.',
      'admin.returnMap': 'નકશા પર પાછા',
      'admin.reviewTag': 'BMC સમીક્ષા',
      'admin.sort.confirmed': 'સૌથી વધુ મને પણ',
      'admin.sort.newest': 'નવીનતમ પહેલા',
      'admin.sort.oldest': 'જૂના પહેલા',
      'admin.sort.overdue': 'બાકી પહેલા',
      'admin.subtitle': 'નાગરિક જોખમ ફરિયાદો ઉકેલો, વોર્ડ કતાર જુઓ.',
      'admin.title': 'BMC Admin',
      'badge.admin': 'BMC Admin',
      'badge.coord': 'સંકલક હબ',
      'coord.cleared': 'સમુદાયે સાફ કર્યું',
      'coord.codeHint': 'સંકલકોને કોડ મળે — વોર્ડ અથવા RWA/સોસાયટી સ્તર.',
      'coord.exitMode': 'NGO મોડ બંધ',
      'coord.hubSubtitle': 'નાગરિક દાન જુઓ, સ્વયંસેવક કલાક ચકાસો.',
      'coord.hubTitle': 'સંકલક હબ',
      'coord.markTaskComplete': 'સફાઈ પૂર્ણ',
      'coord.openHazards': 'વોર્ડમાં ખુલ્લા જોખમ',
      'coord.openLabel': 'ખુલ્લા જોખમ',
      'coord.pledges': 'નાગરિક દાન',
      'coord.pledgesLabel': 'દાન',
      'coord.scopeNbh': 'પડોશ લીડ · {label}',
      'coord.scopeWard': 'વોર્ડ લીડ · {ward}',
      'coord.subtitle': 'દાન જુઓ, સ્વયંસેવક મોકલો, કલાક ચકાસો.',
      'coord.tasksEmpty': 'હજુ ઓફર નથી. ખુલ્લા પિન પર "હું સાફ કરવામાં મદદ કરી શકું" દબાવો.',
      'coord.tasksPending': 'કાર્ય',
      'coord.title': 'સંકલક લૉગિન',
      'coord.toVerify': 'ચકાસણી બાકી',
      'coord.volunteersEmpty': 'હજુ સ્વયંસેવક નથી. Community ટેબ શેર કરો.',
      'coord.volunteersLabel': 'સ્વયંસેવક',
      'coord.workflow': 'મોકલો → સફાઈ લોગ → સામગ્રી → કલાક (+200 પોઈન્ટ)',
      'copy1916.category.garbage': 'કચરો / ઘન કચરો',
      'copy1916.category.potholes': 'ખાડા / રસ્તો ખરાબ',
      'copy1916.category.stagnant-water': 'ડાસ / ભરાયેલું પાણી (Public Health → Pest Control)',
      'copy1916.category.streetlight': 'બંધ સ્ટ્રીટલાઇટ',
      'copy1916.categoryLabel': 'શ્રેણી',
      'copy1916.civicradarLinkLabel': 'CivicRadar નકશો (વૈકલ્પિક)',
      'copy1916.complaintFiled': 'BMC ફરિયાદ #: {id}',
      'copy1916.complaintNotFiled': 'BMC ફરિયાદ #: (હજુ નોંધ નથી)',
      'copy1916.dateLabel': 'તારીખ',
      'copy1916.gpsLabel': 'GPS',
      'copy1916.gpsWarning': '⚠ GPS {city} બહાર લાગે છે — નોંધાવતા પહેલાં જગ્યા ચકાસો',
      'copy1916.header': 'BMC ફરિયાદ વિગત (1916 / MyBMC કૉલ પર કૉપી-પેસ્ટ)',
      'copy1916.landmarkLabel': 'નજીકનું લેન્ડમાર્ક / નોંધ',
      'copy1916.linkLocalhostNote': '(એપ ડિપ્લોય થયા પછી લિંક કામ કરશે)',
      'copy1916.mapsLabel': 'Maps',
      'copy1916.marathiHeader': '--- મરાઠી (કૉલ સેન્ટરને વાંચો) ---',
      'copy1916.refId': 'સંદર્ભ (વૈકલ્પિક): CivicRadar ID {id}',
      'copy1916.wardLabel': 'વોર્ડ + વિસ્તાર',
      'flow.legal': 'કાયદાકીય',
      'flow.ready': 'તૈયાર',
      'flow.ward': 'વોર્ડ',
      'inquiry.coordBody': 'RWA/સોસાયટી અથવા વોર્ડ NGO નું નેતૃત્વ કરો — સ્વયંસેવક જુઓ, સફાઈ મેળવો, દાન કલાક ચકાસો. ઑપરેટર પાસેથી ઇનવાઇટ કોડ માંગો.',
      'map.legend.pending': 'ખુલ્લા',
      'map.legend.resolved': 'ઉકેલાયા',
      'map.legend.you': 'તમે',
      'onboard.wardError': 'યાદીમાંથી વોર્ડ પસંદ કરો અથવા લોકેશન મંજૂરી આપો.',
      'persona.admin.exit': 'BMC મોડ બંધ',
      'persona.admin.header': 'BMC સમીક્ષા મોડ',
      'persona.admin.idleEmpty': 'બાકી ફરિયાદો નથી. નવા પિન અહીં દેખાશે.',
      'persona.admin.idlePending': '{n} બાકી — કતાર ખોલો અથવા લાલ પિન દબાવો.',
      'persona.ngo.exit': 'NGO મોડ બંધ',
      'persona.ngo.header': 'NGO સંકલક મોડ',
      'pledge.message': 'સંદેશ',
      'pledge.messagePh': 'સ્વયંસેવકો માટે નોંધ…',
      'pledge.submit': 'દાન મોકલો',
      'pledge.subtitle': 'વોર્ડમાં સ્વયંસેવકોને સામગ્રી આપો.',
      'pledge.title': 'દાન કરો',
      'pledge.type': 'સામગ્રી પ્રકાર',
      'pledge.type.cleaning': 'સફાઈ સામગ્રી',
      'pledge.type.snacks': 'નાસ્તો',
      'pledge.type.repellent': 'ડાસ repellent',
      'pledge.ward': 'લક્ષ્ય વોર્ડ',
      'pledge.wardPh': 'વોર્ડ પસંદ કરો…',
      'popup.taskOffered': 'સ્વયંસેવકે મદદની ઓફર કરી',
      'profile.emptyList': 'હજુ ફરિયાદ નથી. Report દબાવી નજીકનું ભરાયેલું પાણી પિન કરો.',
      'profile.persona.admin': 'BMC Admin',
      'profile.persona.ngo': 'NGO સંકલક',
      'toast.adminVerified': 'BMC ઍક્સેસ ચકાસાયો — વોર્ડ કતાર જુઓ.',
      'toast.bmcLoginFail': 'ખોટા BMC ક્રેડેન્શિયલ.',
      'toast.bmcMumbaiOnly': 'BMC પાયલટ ફક્ત Mumbai માટે. તમારા કોર્પોરેશન માટે Profile માંથી દાખલ કરો.',
      'toast.bmcOnlyResolve': 'ફક્ત ચકાસેલ BMC અધિકારી ઉકેલી શકે.',
      'toast.bmcUnauthorized': 'આ ઇમેઇલ BMC ઍક્સેસ માટે અધિકૃત નથી.',
      'toast.citizenView': 'નાગરિક દૃશ્ય પર પાછા.',
      'toast.cleanupLogged': 'સમુદાય સફાઈ લોગ — BMC ફરિયાદ અધિકૃત રીતે ખુલ્લી રહી શકે.',
      'toast.codeInvalid': 'અમાન્ય અથવા સમાપ્ત કોડ.',
      'toast.codeSent': 'કોડ મોકલ્યો — ઇનબૉક્સ જુઓ.',
      'toast.complaintFirst': 'પહેલા ફરિયાદ નંબર ઉમેરો — તે જ પુરાવો.',
      'toast.complaintRequired': 'ટ્રેકિંગ માટે ફરિયાદ નંબર દાખલ કરો.',
      'toast.complaintSaved': 'ફરિયાદ નંબર સાચવ્યો — સરકારી ઘડિયાળ શરૂ.',
      'toast.contactConfig': 'સંપર્ક ઇમેઇલ સેટ નથી — પ્રોફાઇલમાં About જુઓ.',
      'toast.coordScopeNbh': 'પડોશ લીડ — {label}',
      'toast.coordScopeWard': 'વોર્ડ સંકલક — સંપૂર્ણ {ward}',
      'toast.copyFail': 'કૉપી ન થઈ — ટેક્સ્ટ મેન્યુઅલ પસંદ કરો.',
      'toast.govEmail': 'gov.in / mcgm.gov.in ઇમેઇલ વાપરો.',
      'toast.gpsFail': 'GPS મળ્યું નહીં. લોકેશન ચાલુ કરી ફરી પ્રયાસ કરો.',
      'toast.gpsRequired': 'જોખમ પિન માટે GPS જરૂરી.',
      'toast.hazardTypeRequired': 'સક્રિય જોખમ પ્રકાર પસંદ કરો.',
      'toast.hoursVerified': 'કલાક ચકાસાયા! +200 Civic Points.',
      'toast.installed': 'CivicRadar ઇન્સ્ટોલ — હોમ સ્ક્રીનથી ખોલો!',
      'toast.installHint': 'બ્રાઉઝર મેનૂ → Add to Home screen.',
      'toast.ngoCodeInvalid': 'ખોટો અથવા સમાપ્ત NGO કોડ.',
      'toast.ngoCodeRequired': 'ઇમેઇલ અને NGO ઍક્સેસ કોડ દાખલ કરો.',
      'toast.ngoLoginFail': 'ખોટા સંકલક ક્રેડેન્શિયલ.',
      'toast.ngoVerified': 'સંકલક ચકાસાયો — દાન અને સ્વયંસેવક જુઓ.',
      'toast.noLocation': 'આ બ્રાઉઝરમાં લોકેશન ઉપલબ્ધ નથી.',
      'toast.onboardFirst': 'ફરિયાદ માટે સેટઅપ પૂર્ણ કરો.',
      'toast.ownReportOnly': 'ફક્ત પોતાની ફરિયાદની પુષ્ટિ કરી શકો.',
      'toast.photoRequired': 'મોકલતા પહેલાં ફોટો ઉમેરો.',
      'toast.pledgeDelivered': 'સામગ્રી વિતરિત — હવે કલાક ચકાસો.',
      'toast.pledgeWardRequired': 'દાન માટે લક્ષ્ય વોર્ડ પસંદ કરો.',
      'toast.proofAdded': 'પુરાવા ફોટો ઉમેર્યો — પુષ્ટિ માટે ફરી દબાવો.',
      'toast.recentered': 'નકશો તમારી જગ્યા પર કેન્દ્રિત.',
      'toast.reportNotFound': 'ફરિયાદ લિંક અમાન્ય અથવા આ ઉપકરણ પર નથી.',
      'toast.resolvedProof': 'ઉકેલ ચિહ્નિત — પહેલાં/પછી પુરાવો સાચવ્યો.',
      'toast.resolveFail': 'સ્થિતિ અપડેટ ન થઈ.',
      'toast.saveFail': 'સાચવી શકાયું નહીં.',
      'toast.saving': 'સાચવી રહ્યા છીએ…',
      'toast.selfResolved': 'ઉકેલ ચિહ્નિત — ફોલો-અપ માટે આભાર!',
      'toast.shareWin': 'પડોશીઓ સાથે જીત શેર કરો.',
      'toast.storageFull': 'સ્ટોરેજ ભરેલું — જૂની ફરિયાદ કાઢી. ફરી પ્રયાસ કરો.',
      'toast.syncConnected': 'કનેક્ટ — ફરિયાદો બધા ઉપકરણો પર સિંક.',
      'toast.syncLocal': 'આ ઉપકરણ પર સાચવ્યું — ક્લાઉડ સિંક ફરી પ્રયાસ કરશે.',
      'toast.verifying': 'ચકાસી રહ્યા છીએ…',
      'toast.volunteerNeighbourhoodRequired': 'પડોશ, સોસાયટી અથવા ગલી દાખલ કરો.',
      'toast.volunteerRemoved': 'સ્વયંસેવક નોંધ કાઢી.',
      'toast.volunteerSaved': 'સ્વયંસેવક નોંધ સાચવી — વોર્ડ સંકલક જોઈ શકે.',
      'toast.volunteerSignupRequired': 'પહેલા Community માં સ્વયંસેવક સાઇન અપ કરો.',
      'toast.volunteerSkillRequired': 'મદદનો ઓછામાં ઓછો એક રસ્તો પસંદ કરો.',
      'toast.volunteerTaskCompleted': 'સફાઈ પૂર્ણ — રિપોર્ટરને સૂચના.',
      'toast.volunteerTaskDuplicate': 'આ જોખમ માટે પહેલેથી ઓફર કરી છે.',
      'toast.volunteerTaskOffered': 'ઓફર મોકલી — સંકલક આ સ્પોટ સાથે મેળવશે.',
      'toast.volunteerWardRequired': 'પહેલા ઑનબોર્ડિંગમાં વોર્ડ સેટ કરો.',
      'toast.wardRequired': '{city}ની અધિકૃત યાદીમાંથી વોર્ડ પસંદ કરો.',
      'toast.welcome': 'સ્વાગત, {name}! ફરિયાદ માટે તૈયાર.',
      'tos.accept': 'હું 18+ છું, <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms</a> અને <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a> સ્વીકારું છું',
      'tos.age': 'ફરિયાદ અને સમુદાય ફીચર માટે 18+ જરૂરી. 18 થી ઓછી ઉંમર? 18+ માતા-પિતા, સંભાળક અથવા NSS સંકલાક દ્વારા Terms સ્વીકારીને ભાગ લો.',
      'tos.content': 'ફક્ત જોખમના ઑન-સાઇટ ફોટો. સેલ્ફી, ID અથવા અનિયુક્ત ચિત્રો નહીં.',
      'tos.continue': 'આગળ વધો',
      'tos.emergency': 'આપત્તિ માટે નહીં. જીવને જોખમ હોય તો 112 ડાયલ કરો.',
      'tos.gps': 'GPS ફક્ત સ્થાન ચાલુ કરો અથવા ફરિયાદ મોકલો ત્યારે — Terms સ્વીકારવાથી અલગ.',
      'tos.itAct': 'CivicRadar IT Act, 2000 અંતર્ગત મધ્યસ્થ છે. અપલોડની જવાબદારી તમારી.',
      'tos.notBmc': 'CivicRadar સ્વતંત્ર — BMC, PMC, TMC અથવા કોઈ સરકારી સંસ્થા સાથે જોડાયેલું અથવા ચલાવેલું નથી.',
      'tos.share': 'WhatsApp, X પર શેર કરવાથી વ્યક્તિગત ડેટા ખુલી શકે — પોતાના જોખમે.',
      'tos.subtitle': 'CivicRadar વાપરતા પહેલાં વાંચો અને સ્વીકારો.',
      'tos.title': 'સેવાની શરતો',
      'volunteer.contact': 'ફોન / WhatsApp (વૈકલ્પિક)',
      'volunteer.contactHint': 'વૈકલ્પિક — ફક્ત વોર્ડ/પડોશ સંકલકને દેખાશે. CivicRadar ઑટો-કૉલ કરતું નથી.',
      'volunteer.edit': 'નોંધ સંપાદિત કરો',
      'volunteer.empty': 'હજુ સાઇન અપ નથી. Community માંથી ગલીમાં મદદ કરો.',
      'volunteer.emptyAction': 'મારા વોર્ડમાં સ્વયંસેવા',
      'volunteer.hours': 'આ ચોમાસે ઉપલબ્ધ કલાક',
      'volunteer.hoursCustom': 'કસ્ટમ',
      'volunteer.hoursLabel': 'આ ચોમાસે {n} કલાક',
      'volunteer.neighbourhoodHint': 'RWA, સોસાયટી અથવા ગલી — પડોશ લીડ નજીકના સ્પોટ સાથે મેળવશે.',
      'volunteer.neighbourhoodPh': 'દા.ત. Phoenix Mills લેન, Building 7 Worli',
      'volunteer.remove': 'મારી નોંધ કાઢો',
      'volunteer.skills': 'હું આમાં મદદ કરી શકું',
      'volunteer.submit': 'સ્વયંસેવક નોંધ સાચવો',
      'volunteer.ward': 'તમારો વોર્ડ',
      'admin.meta.reporter': 'રિપોર્ટર',
      'admin.meta.ward': 'વોર્ડ',
      'admin.meta.status': 'સ્થિતિ',
      'admin.meta.lat': 'Lat',
      'admin.meta.lng': 'Lng',
      'admin.close': 'બંધ',
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
      'about.founderDefault': 'વિદ્યાર્થી સંસ્થાપક',
      'config.contactMissing': '(સંપર્ક કોન્ફિગ નથી)',
      'demo.badge': 'પ્રોડક્ટ ડેમો',
      'profile.withdrawAnalytics': 'એનાલિટિક્સ સંમતિ પાછી લો',
      'profile.withdrawAnalyticsDone': 'એનાલિટિક્સ સંમતિ પાછી — સ્થાનિક ડેટા સાફ.',
      'profile.withdrawGps': 'સ્થાન સંમતિ પાછી લો',
      'profile.withdrawGpsDone': 'સ્થાન સંમતિ પાછી — જરૂર હોય તો નકશા બેનરથી ચાલુ કરો.',
      'profile.privacyContact': 'ગોપનીયતા / ફરિયાદ સંપર્ક',
      'toast.tosRequired': 'સમુદાય સુવિધાઓ પહેલાં Terms અને Privacy (18+) સ્વીકારો.',
      'tos.analytics': 'અનામ ઉપયોગ એનાલિટિક્સ (વૈકલ્પિક) વિશ્વસનીયતા વધારે. ફોટો, GPS કે નામ મોકલાતા નથી.',
      'tos.analyticsOptIn': 'હું અનામ ઉપયોગ એનાલિટિક્સની સંમતિ આપું છું (વૈકલ્પિક — Profile માંથી ક્યારે પણ પાછી)',
      'volunteer.ageNote': 'Terms મુજબ 18+ જરૂરી. 18 થી ઓછી ઉંમર? માતા-પિત/સંભાળક અથવા NSS સંકલક સાથે જ.',
      'admin.meta.neighbourConfirm': ' · {n} એ મને પણ કહ્યું',
      'coord.hazardsEmpty': 'તમારા વિસ્તારમાં હમણાં ખુલ્લા જોખમ નથી.',
      'coord.volunteerOffers': '{n} સ્વયંસેવક ઓફર',
      'coord.hazardCleaned': 'સાફ કર્યું',
      'coord.logCleanup': 'સફાઈ નોંધો',
      'admin.health.communityCleanups': 'સામુદાયિક સફાઈ',
      'admin.health.whatsappShares': 'WhatsApp શેર',
      'admin.health.errors': 'ભૂલો',
      'admin.health.perfSamples': 'પરફોર્મન્સ નમૂના',
      'admin.health.avgPerf': 'સરેરાશ લોડ સમય (સ્થાનિક)',
      'admin.health.bufferedEvents': 'બફર ઇવેન્ટ (ઉપકરણ)',
      'volunteer.neighbourhood': 'પડોશ / સોસાયટી / ગલી',
      'volunteer.subtitle': 'પડોશીઓ સાથે મળીને — સરકારી સ્વયંસેવક કાર્યક્રમ નથી.',
      'volunteer.skill.awareness': 'જાગૃતિ અને WhatsApp outreach',
      'volunteer.skill.cleanup': 'ભરાયેલું પાણી સાફ કરવું',
      'volunteer.skill.pledge': 'દાન વિતરણ (સામગ્રી)',
      'profile.neighbourMany': 'પડોશીઓએ મને પણ કહ્યું',
    },  };
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
    if ($('#onboardCity')) syncOnboardingCityUi(getOnboardingCity());
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
    ids.add(String(id));
    try {
      localStorage.setItem(HIDDEN_REPORTS_KEY, JSON.stringify([...ids]));
    } catch { /* ignore */ }
    if (map) map.closePopup();
    refreshReportMarkers();
    showToast(t('safety.hidden'), 'info', 3200);
  }

  function aggregateWardLeaderboard() {
    const byWard = {};
    cityScopedReports(loadReports()).forEach((r) => {
      if (!r.ward || isReportHidden(r.id)) return;
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

  function aggregateCitizenLeaderboard() {
    const byCitizen = {};
    cityScopedReports(loadReports()).forEach((r) => {
      if (isReportHidden(r.id)) return;
      const key = r.reporterId || r.reporter || 'anon';
      const name = r.reporter || 'Citizen';
      const ward = r.ward ? r.ward.split('—')[0].trim() : getCityLabel(getReportCity(r));
      if (!byCitizen[key]) {
        byCitizen[key] = { name, ward, points: 0, isUser: false, isDemo: false };
      }
      byCitizen[key].points += POINTS_PER_REPORT;
      if (r.status === 'resolved') byCitizen[key].points += POINTS_PER_REPORT;
    });
    return Object.values(byCitizen);
  }

  function mergeUserWard(wards) {
    if (!user.ward) return wards;
    const userReports = getUserReports();
    const userWardPoints = getTotalCivicPoints();
    const existing = wards.find((w) => w.name === user.ward);
    if (existing) {
      existing.points = Math.max(existing.points, userWardPoints);
      existing.reports = Math.max(existing.reports, userReports.length);
      existing.resolved = Math.max(existing.resolved || 0, userReports.filter((r) => r.status === 'resolved').length);
      existing.isUser = true;
      existing.isDemo = false;
    } else {
      wards.push({
        name: user.ward,
        points: userWardPoints,
        reports: userReports.length,
        resolved: userReports.filter((r) => r.status === 'resolved').length,
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
    localStorage.setItem(LANG_KEY, currentLang);
    applyTranslations();
    updatePersonaUI();
    if (prev !== code && window.CivicAnalytics) {
      CivicAnalytics.track('language_change', { from: prev, to: code });
    }
    // Re-render dynamic views so translated labels apply immediately.
    try {
      if (typeof updateProfileUI === 'function') updateProfileUI();
      if (typeof updateMapEmptyCta === 'function') updateMapEmptyCta();
      if (typeof updateCommunitySubtitle === 'function') updateCommunitySubtitle();
      if (typeof renderWardChallenge === 'function') renderWardChallenge();
      if (typeof renderLeaderboard === 'function') { renderLeaderboard('wards'); renderLeaderboard('citizens'); }
      if (typeof renderCommunityImpactStats === 'function') renderCommunityImpactStats();
      if ($('#hazardGrid')) renderHazardPicker();
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
      migrateLegacyReports(parsed);
      localStorage.setItem(USER_KEY, JSON.stringify(parsed));
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
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    }
  }

  function normalizeReport(r, ownerId) {
    return {
      id: r.id || Date.now(),
      reporterId: r.reporterId || ownerId || '',
      hazard: r.hazard || 'stagnant-water',
      notes: sanitizeText(r.notes, 500),
      image: r.image || '',
      ward: r.ward || '',
      city: r.city || getReportCity(r),
      reporter: sanitizeDisplayName(r.reporter || ''),
      lat: r.lat ?? null,
      lng: r.lng ?? null,
      status: r.status || 'pending',
      complaintId: r.complaintId || '',
      filedAt: r.filedAt || '',
      resolvedBy: r.resolvedBy || '',   // 'bmc' | 'citizen'
      resolvedAt: r.resolvedAt || '',
      resolutionImage: r.resolutionImage || '', // BMC "after" proof photo
      communityCleared: r.communityCleared || false, // NGO logged a cleanup
      clearedBy: r.clearedBy || '',
      communityShared: r.communityShared || '', // user tapped WhatsApp share for this report
      confirmations: Number(r.confirmations) || 0, // neighbours who corroborated
      fixConfirmations: Number(r.fixConfirmations) || 0, // neighbours who said "looks fixed"
      resolutionSource: r.resolutionSource || '', // self | bmc_admin | community_verified | stale_verified
      communityVerifiedAt: r.communityVerifiedAt || '',
      timestamp: r.timestamp || new Date().toISOString(),
    };
  }

  function saveUser() {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (err) {
      console.error('Failed to save user profile:', err);
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
      localStorage.setItem(PLEDGES_KEY, JSON.stringify(pledges));
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
      localStorage.setItem(VOLUNTEER_SIGNUPS_KEY, JSON.stringify(rows));
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
      localStorage.setItem(VOLUNTEER_TASKS_KEY, JSON.stringify(rows));
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
    const next = loadPointsCache() + amount;
    localStorage.setItem(POINTS_CACHE_KEY, String(next));
    return next;
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

  const Backend = {
    client: null,
    enabled: false,

    async init() {
      const cfg = window.CIVICRADAR_CONFIG || {};
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
        updateSyncStatus();
        return false; // local-only mode
      }
      try {
        this.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true },
        });

        let { data: { session } } = await this.client.auth.getSession();
        if (!session) {
          const { data, error } = await this.client.auth.signInAnonymously();
          if (error) throw error;
          session = data.session;
        }
        const uid = session.user.id;
        adoptBackendUserId(uid);

        this.enabled = true;
        await this.pullAll();
        await this.pushLocalOwned();
        this.subscribe();
        updateAuthMode();
        updateSyncStatus();
        await restoreElevatedRole();
        if (window.CivicAnalytics) CivicAnalytics.setSupabaseClient(this.client);
        showToast(t('toast.syncConnected'), 'success', 3000);
        return true;
      } catch (e) {
        const code = (e && (e.error_code || e.code)) || '';
        const msg = (e && e.message) || String(e);
        console.warn('Supabase unavailable, running in local mode:', msg, code ? `[${code}]` : '');
        this.enabled = false;
        updateSyncStatus();
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
        timestamp: r.created_at,
      });
    },

    reportToRow(r) {
      return {
        id: r.id,
        reporter_id: r.reporterId || user.id,
        reporter_name: r.reporter || '',
        hazard: r.hazard,
        notes: r.notes || '',
        image: r.image || '',
        ward: r.ward || '',
        city: r.city || getUserCity(),
        lat: r.lat,
        lng: r.lng,
        status: r.status || 'pending',
        complaint_id: r.complaintId || null,
        filed_at: r.filedAt || null,
        resolved_by: r.resolvedBy || null,
        resolved_at: r.resolvedAt || null,
        resolution_image: r.resolutionImage || null,
        community_cleared: !!r.communityCleared,
        cleared_by: r.clearedBy || null,
        confirmations: Number(r.confirmations) || 0,
        fix_confirmations: Number(r.fixConfirmations) || 0,
        resolution_source: r.resolutionSource || null,
        community_verified_at: r.communityVerifiedAt || null,
        created_at: r.timestamp || new Date().toISOString(),
      };
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
      if (repRows.size) {
        const merged = mergeById(
          loadReports(),
          [...repRows.values()].map((r) => this.rowToReport(r))
        );
        saveReports(merged);
      }
      if (pls) {
        const merged = mergeById(loadPledges(), pls.map((r) => this.rowToPledge(r)));
        savePledges(merged);
      }
      if (vols) {
        const merged = mergeById(loadVolunteerSignups(), vols.map((r) => this.rowToVolunteerSignup(r)));
        saveVolunteerSignups(merged);
      }
      if (tasks) {
        const merged = mergeById(loadVolunteerTasks(), tasks.map((r) => this.rowToVolunteerTask(r)));
        saveVolunteerTasks(merged);
      }
      refreshAllViews();
      } finally {
        if (window.CivicAnalytics) CivicAnalytics.perfEnd('sync_duration');
      }
    },

    // Best-effort push of this user's local rows that may predate the connection.
    async pushLocalOwned() {
      if (!this.enabled) return;
      const myReports = loadReports().filter(
        (r) => r.reporterId === user.id && /^[0-9a-f-]{36}$/i.test(String(r.id))
      );
      if (myReports.length) {
        await this.client.from('reports').upsert(myReports.map((r) => this.reportToRow(r)), { onConflict: 'id' });
      }
      const myPledges = loadPledges().filter(
        (p) => !p.mock && p.citizenId === user.id && /^[0-9a-f-]{36}$/i.test(String(p.id))
      );
      if (myPledges.length) {
        await this.client.from('pledges').upsert(myPledges.map((p) => this.pledgeToRow(p)), { onConflict: 'id' });
      }
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
      if (!this.enabled) return;
      const { error } = await this.client.from('reports').upsert(this.reportToRow(report), { onConflict: 'id' });
      if (error) {
        console.warn('Report sync failed (saved locally):', error.message);
        if (window.CivicAnalytics) {
          CivicAnalytics.trackError(error.message, { context: 'insertReport', source: 'sync' });
        }
        showToast(t('toast.syncLocal'), 'info', 3500);
      }
    },

    async updateReportStatus(id, status) {
      if (!this.enabled) return;
      const { error } = await this.client.from('reports').update({ status }).eq('id', id);
      if (error) console.warn('Status sync failed:', error.message);
    },

    async updateReportResolution(id, status, by, at, resolutionImage, resolutionSource, communityVerifiedAt) {
      if (!this.enabled) return;
      const patch = { status, resolved_by: by, resolved_at: at };
      if (resolutionImage) patch.resolution_image = resolutionImage;
      if (resolutionSource) patch.resolution_source = resolutionSource;
      if (communityVerifiedAt) patch.community_verified_at = communityVerifiedAt;
      const { error } = await this.client
        .from('reports')
        .update(patch)
        .eq('id', id);
      if (error) console.warn('Resolution sync failed:', error.message);
    },

    async updateReportFiling(id, complaintId, filedAt) {
      if (!this.enabled) return;
      const { error } = await this.client
        .from('reports')
        .update({ complaint_id: complaintId, filed_at: filedAt })
        .eq('id', id);
      if (error) console.warn('Filing sync failed:', error.message);
    },

    async updateReportCleanup(id, cleared, by) {
      if (!this.enabled) return;
      const { error } = await this.client
        .from('reports')
        .update({ community_cleared: cleared, cleared_by: by })
        .eq('id', id);
      if (error) console.warn('Cleanup sync failed:', error.message);
    },

    // Atomic, dedup-by-user corroboration via RPC (see schema.sql).
    async confirmReport(id) {
      if (!this.enabled) return;
      const { error } = await this.client.rpc('confirm_report', { p_report_id: id });
      if (error) console.warn('Confirm sync failed:', error.message);
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
      // Passwordless OTP. shouldCreateUser lets new officials onboard via the trigger.
      return this.client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    },

    async verifyEmailCode(email, token) {
      return this.client.auth.verifyOtp({ email, token, type: 'email' });
    },

    // Reads the caller's role from the profiles table (set server-side).
    async getMyRole() {
      const { data: { user: u } } = await this.client.auth.getUser();
      if (!u) return null;
      const { data, error } = await this.client.from('profiles').select('role, ward, city, coordinator_scope, neighbourhood_label').eq('id', u.id).single();
      if (error) return { role: 'citizen', ward: '' };
      return data;
    },

    // Redeems an NGO invite code server-side (SECURITY DEFINER RPC), which
    // grants the ngo_lead role and returns the assigned ward.
    async redeemNgoCode(code) {
      return this.client.rpc('redeem_ngo_code', { p_code: code });
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
        const { data, error } = await this.client.auth.signInAnonymously();
        if (!error && data.session) adoptBackendUserId(data.session.user.id);
      } catch (e) {
        console.warn('Re-auth after deletion failed:', e && e.message);
      }
    },
  };

  /* ---------- Auth (elevated-role sign-in) ----------
   * BMC officials authenticate with an official government email (OTP); the
   * server grants the 'bmc' role only for allowlisted gov domains.
   * NGO coordinators authenticate with email (OTP) + an invite code that the
   * platform issues; redeeming it server-side grants the 'ngo_lead' role.
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
      HIDDEN_REPORTS_KEY, WEEK_BONUS_KEY, INTEREST_KEY, COACH_KEY,
      PLEDGE_STATUS_SNAPSHOT_KEY, PLEDGE_POINTS_CREDITED_KEY,
      REMINDER_NGO_PLEDGES_LAST_SEEN_KEY,
      VOLUNTEER_SIGNUPS_KEY, VOLUNTEER_TASKS_KEY,
    ].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
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
    showLocationBanner('Location consent withdrawn. Enable again when you want to report.');
    showToast(t('profile.withdrawGpsDone'), 'info', 4500);
  }

  async function deleteMyData() {
    if (!window.confirm(t('profile.deleteConfirm'))) return;
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
    const highlights = (f.highlights || []).map((h) => `• ${h}`).join('\n');
    return [
      `CivicRadar — Community Impact Summary (${date})`,
      '',
      `Founder: ${f.name || t('about.founderDefault')}${f.school ? ` · ${f.school}` : ''}`,
      f.operatorName ? `Operator (until founder turns 18): ${f.operatorName}` : '',
      f.tagline || 'Community-driven civic hazard reporting for Mumbai.',
      '',
      'Impact metrics:',
      `• Reports logged: ${s.totalReports}`,
      `• Hazards resolved: ${s.resolved}`,
      `• Neighbour confirmations ("Me too"): ${s.confirmations}`,
      `• Volunteer pledges: ${s.pledges}`,
      `• BMC wards with activity: ${s.wardsActive}`,
      '',
      f.story || '',
      '',
      'Technical highlights:',
      highlights || '• PWA · Multi-language · BMC escalation · Role-based dashboards',
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

  function renderAboutModal() {
    renderCommunityImpactStats();
    $('#founderName').textContent = FOUNDER.name || t('about.founderDefault');
    $('#founderRole').textContent = FOUNDER.role || 'Founder & Developer';
    $('#founderSchool').textContent = [FOUNDER.school, FOUNDER.location].filter(Boolean).join(' · ') || '';
    $('#founderStory').textContent = FOUNDER.story || '';
    const opEl = $('#founderOperator');
    if (opEl) {
      if (FOUNDER.operatorName) {
        opEl.textContent = t('about.operatorNote')
          .replace('{name}', FOUNDER.name || 'Nihira Hadawale')
          .replace('{operator}', FOUNDER.operatorName);
        opEl.hidden = false;
      } else {
        opEl.hidden = true;
        opEl.textContent = '';
      }
    }
    const aboutSub = $('#aboutSubtitle');
    if (aboutSub) {
      aboutSub.textContent = t('about.subtitleNamed').replace('{name}', FOUNDER.name || 'Nihira Hadawale');
    }

    const hl = $('#founderHighlights');
    if (hl) {
      hl.innerHTML = (FOUNDER.highlights || [])
        .map((h) => `<li>${escapeHtml(h)}</li>`)
        .join('');
    }

    const rev = $('#revenueModelList');
    if (rev) {
      rev.innerHTML = (MONET.revenueModel || [])
        .map((r) => `<li>${escapeHtml(r)}</li>`)
        .join('');
    }

    const contactEmail = getFounderContactEmail();
    const contactBtn = $('#btnContactFounder');
    if (contactBtn) {
      contactBtn.classList.toggle('hidden', !contactEmail);
      const contactLabel = contactBtn.querySelector('span');
      if (contactLabel) {
        contactLabel.textContent = FOUNDER.email ? t('about.contact') : t('about.contactOperator');
      }
    }

    const pitchEl = $('#aboutSharePitchText');
    if (pitchEl) {
      const pitch = t('about.sharePitch')
        .replace(/\{city\}/g, getCityLabel())
        .replace(/\{link\}/g, shareAppLink('about'));
      pitchEl.textContent = pitch;
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
    return getUserReports().length * POINTS_PER_REPORT + loadPointsCache();
  }

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
    localStorage.setItem(WEEK_BONUS_KEY, key);
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
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  function isReminderSnoozed(key) {
    const until = localStorage.getItem(key);
    if (!until) return false;
    return Date.now() < new Date(until).getTime();
  }

  function snoozeReminder(key, days, analyticsType) {
    const until = new Date(Date.now() + days * 86400000).toISOString();
    try { localStorage.setItem(key, until); } catch {}
    if (window.CivicAnalytics) {
      CivicAnalytics.track('reminder_snoozed', { type: analyticsType || 'unfiled', days }, user.ward);
    }
  }

  function escTierShownKey(reportId, tierKey) {
    return `civicradar_esc_shown_${reportId}_${tierKey}`;
  }

  function markEscTierShown(reportId, tierKey) {
    try { localStorage.setItem(escTierShownKey(reportId, tierKey), '1'); } catch {}
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
        try { localStorage.setItem(REMINDER_UNFILED_MILESTONE_KEY, String(nextMilestone)); } catch {}
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
      localStorage.setItem(REMINDER_NGO_LAST_SEEN_KEY, now);
      localStorage.setItem(REMINDER_NGO_PLEDGES_LAST_SEEN_KEY, now);
    } catch {}
    updatePersonaUI();
  }

  function updateMapEmptyCta() {
    const el = $('#mapEmptyCta');
    const textEl = $('#mapEmptyText');
    if (!el) return;
    const citizen = getActivePersona() === 'citizen';
    const show = citizen && user.ward && getUserReports().length === 0 && cityScopedReports(loadReports()).length === 0;
    el.classList.toggle('hidden', !show);
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
  function loadConfirmedSet() {
    try { return new Set(JSON.parse(localStorage.getItem(CONFIRMED_KEY)) || []); }
    catch { return new Set(); }
  }

  function hasConfirmed(reportId) {
    return loadConfirmedSet().has(String(reportId));
  }

  function ownsReport(report) {
    return report && report.reporterId ? report.reporterId === user.id : false;
  }

  // "Me too" corroboration: a neighbour confirms an existing pending hazard
  // instead of filing a duplicate. Boosts the report's priority + social proof.
  function confirmReport(reportId) {
    const reports = loadReports();
    const idx = reports.findIndex((r) => String(r.id) === String(reportId));
    if (idx === -1) return false;
    const report = reports[idx];
    if (report.status !== 'pending') return false;
    if (ownsReport(report)) { showToast(t('confirm.you'), 'info', 2200); return false; }
    if (hasConfirmed(reportId)) return false;

    report.confirmations = (Number(report.confirmations) || 0) + 1;
    try {
      saveReports(reports);
    } catch { showToast(t('toast.saveFail'), 'error'); return false; }

    const set = loadConfirmedSet();
    set.add(String(reportId));
    try { localStorage.setItem(CONFIRMED_KEY, JSON.stringify(Array.from(set))); } catch {}

    Backend.confirmReport(reportId);
    if (window.CivicAnalytics) {
      CivicAnalytics.track('report_corroborated', { reportId: String(reportId) }, report.ward);
    }
    if (reportMarkerLayer) refreshReportMarkers();
    updateProfileUI();
    if (isAdmin) renderAdminQueue();
    showToast(t('confirm.thanks'), 'success', 3200, {
      label: t('share.meTooBtn'),
      onClick: () => shareMeTooWhatsApp(reportId),
    });
    return true;
  }

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
    try { localStorage.setItem(FIX_CONFIRMED_SEEN_KEY, JSON.stringify(ids)); } catch {}
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
    const src = getReportResolutionSource(report);
    if (src === 'community_verified') return t('profile.status.communityVerified');
    if (src === 'stale_verified' || src === 'self') return t('profile.status.youMarkedFixed');
    if (src === 'bmc_admin') return t('profile.status.bmcResolved');
    if (report.resolvedBy === 'citizen') return t('profile.status.resolvedCitizen');
    if (report.resolvedBy === 'bmc') return t('profile.status.resolvedBmc');
    return t('popup.resolved');
  }

  function resolutionBadgeHtml(report) {
    if (report.status !== 'resolved') return '';
    const src = getReportResolutionSource(report);
    let key = 'profile.badge.communityVerified';
    let cls = '';
    if (src === 'stale_verified' || src === 'self') {
      key = 'profile.badge.youMarkedFixed';
      cls = ' report-card__resolution-badge--self';
    } else if (src === 'bmc_admin') {
      key = 'profile.badge.bmcResolved';
      cls = ' report-card__resolution-badge--bmc';
    }
    return `<div class="report-card__resolution-badge${cls}"><i class="ph ph-check-circle"></i> ${escapeHtml(t(key))}</div>`;
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
        addPointsCache(POINTS_COMMUNITY_RESOLVE_REPORTER);
        showToast(t('toast.communityResolved'), 'success', 5000);
        setTimeout(() => showShareWinModal(reportId, 'community'), 700);
        if (!report.resolutionImage) {
          setTimeout(() => showToast(t('fix.afterPhotoPrompt'), 'info', 4500), 1500);
        }
      }
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
    try { localStorage.setItem(FIX_CONFIRMED_KEY, JSON.stringify(Array.from(set))); } catch {}

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

  // One live category at launch (stagnant water — the monsoon/dengue wedge).
  // The rest are deliberate teasers that capture demand before we build them.
  const HAZARD_CATEGORIES = [
    { key: 'stagnant-water', icon: 'ph-drop', live: true },
    { key: 'potholes', icon: 'ph-road-horizon', live: false },
    { key: 'garbage', icon: 'ph-trash', live: false },
    { key: 'streetlight', icon: 'ph-lightbulb-filament', live: false },
  ];

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
          <button type="button" role="radio" aria-checked="${active}"
            class="hazard-tile${active ? ' hazard-tile--active' : ''}${c.live ? '' : ' hazard-tile--soon'}${requested}"
            data-hazard="${c.key}" data-live="${c.live}">
            <i class="ph ${c.icon}"></i>
            <span class="hazard-tile__label">${escapeHtml(hazardLabel(c.key))}</span>
            ${soon}
          </button>`;
      })
      .join('');
    grid.querySelectorAll('[data-hazard]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.live === 'true') selectHazard(btn.dataset.hazard);
        else openSoonModal(btn.dataset.hazard);
      });
    });
  }

  function selectHazard(key) {
    $('#hazardType').value = key;
    $$('#hazardGrid .hazard-tile').forEach((t) => {
      const on = t.dataset.hazard === key;
      t.classList.toggle('hazard-tile--active', on);
      t.setAttribute('aria-checked', on);
    });
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
    try { localStorage.setItem(INTEREST_KEY, JSON.stringify(interest)); } catch {}
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
        detail: 'Past BMC’s 7-day matrix. Follow up with your Ward Complaint Officer / Asst. Commissioner.' };
    }
    return { key: 'filed', filed: true, days,
      headline: `Complaint filed — ${dayWord(days)} in`,
      detail: 'With BMC. Charter target is ~3 days; we’ll prompt escalation if it stalls.' };
  }

  // Short status line used on report cards and the admin detail modal.
  function getClockLine(report) {
    const s = getReportStage(report);
    const city = getReportCity(report);
    if (s.filed && report.complaintId) {
      return `${getComplaintRefPrefix(city)} #${report.complaintId} · ${s.headline}`;
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
  // (gov-email OTP for BMC, NGO invite code for coordinators) — see the login
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
        leadText += ' · ' + t('persona.ngo.newPledges').replace('{n}', String(newPledges));
      }
      if (newHazards > 0) {
        leadText += ' · ' + t('persona.ngo.newHazards').replace('{n}', String(newHazards));
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
    $$('#reportFlowSteps .flow-step').forEach((el) => {
      const s = el.dataset.step;
      el.classList.remove('is-active', 'is-done');
      el.removeAttribute('aria-current');
      if (s === step) {
        el.classList.add('is-active');
        el.setAttribute('aria-current', 'step');
      } else if (
        (step === 'details' && s === 'photo') ||
        (step === 'submit' && (s === 'photo' || s === 'details'))
      ) {
        el.classList.add('is-done');
      }
    });
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
    $('#coachMark').classList.remove('hidden');
  }

  function dismissCoachMark() {
    localStorage.setItem(COACH_KEY, '1');
    $('#coachMark').classList.add('hidden');
  }

  function setNavTab(tab) {
    $$('#bottomNav .nav-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
  }

  /* ---------- Toast Notifications ---------- */
  function showToast(message, type = 'info', duration = 3500, action = null) {
    const container = $('#toastContainer');
    const icons = { success: 'check-circle', error: 'warning-circle', info: 'info' };
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;

    const row = document.createElement('div');
    row.className = 'toast__row';
    row.innerHTML =
      `<i class="ph ph-${icons[type] || 'info'}"></i><span>${escapeHtml(message)}</span>`;
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
          if (typeof act.onClick === 'function') act.onClick();
          toast.remove();
        });
        wrap.appendChild(btn);
      });
      toast.appendChild(wrap);
      toast.classList.add('toast--interactive', 'toast--multi');
    }

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  window.showToast = showToast;

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

  // Shows the correct sign-in method per environment: real email-OTP when the
  // backend is connected, labelled demo logins otherwise.
  function updateAuthMode() {
    const connected = Backend.enabled;
    ['admin', 'lead'].forEach((p) => {
      const official = $(`#${p}AuthOfficial`);
      const demo = $(`#${p}AuthDemo`);
      if (official) official.classList.toggle('hidden', !connected);
      if (demo) demo.classList.toggle('hidden', connected);
    });
  }

  // On reload in connected mode, re-apply an elevated role from the persisted session.
  async function restoreElevatedRole() {
    if (!Backend.enabled) return;
    try {
      const profile = await Backend.getMyRole();
      if (profile && profile.role === 'bmc') setAdminMode(true);
      else if (profile && profile.role === 'ngo_lead') {
        if (profile.ward) { user.ward = user.ward || profile.ward; }
        if (profile.city) { user.city = user.city || profile.city; }
        user.coordinatorScope = profile.coordinator_scope || 'ward';
        user.neighbourhoodLabel = profile.neighbourhood_label || '';
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
    if (!Auth.isGovEmail(email)) {
      showToast(t('toast.govEmail'), 'error', 4500);
      return;
    }
    const btn = $('#btnAdminSendCode');
    btn.disabled = true;
    const { error } = await Backend.sendEmailCode(email);
    btn.disabled = false;
    if (error) { showToast(error.message || 'Could not send code.', 'error'); return; }
    $('#adminOtpRow').classList.remove('hidden');
    showToast(t('toast.codeSent'), 'info', 4000);
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
    if (profile && profile.role === 'bmc') {
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
    const { error } = await Backend.sendEmailCode(email);
    btn.disabled = false;
    if (error) { showToast(error.message || 'Could not send code.', 'error'); return; }
    $('#leadOtpRow').classList.remove('hidden');
    showToast(t('toast.codeSent'), 'info', 4000);
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
    $('#wardManualGroup')?.classList.add('hidden');
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
    $('#btnWardManual')?.classList.remove('hidden');
    $('#btnWardRetry')?.classList.add('hidden');
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
      showOnboardingWardDetected(ward);
    }
    return ward;
  }

  function startOnboardingWardDetect() {
    onboardingDetectedWard = '';
    const input = $('#wardInput');
    if (input) input.value = '';
    syncOnboardingCityUi(getOnboardingCity());
    showOnboardingWardDetecting();
    if (!navigator.geolocation) {
      showOnboardingWardDetectFailed();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        user.gpsConsent = true;
        saveUser();
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
        const ward = applyWardFromCoords(currentLat, currentLng);
        if (ward) {
          showOnboardingWardDetected(ward);
        } else {
          showOnboardingWardDetectFailed();
        }
      },
      () => {
        showOnboardingWardDetectFailed();
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  /* ---------- Modals ---------- */
  function openModal(name) {
    const el = overlays[name];
    if (!el) return;
    lastFocusedEl = document.activeElement;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
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
      startOnboardingWardDetect();
    }
  }

  function closeModal(name) {
    const el = overlays[name];
    if (!el) return;
    if (name === 'report') resetSubmitReportButton();
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    const anyOpen = Object.values(overlays).some((o) => o && o.classList.contains('open'));
    if (!anyOpen) document.body.style.overflow = '';
    if (!anyOpen && focusTrapHandler) {
      document.removeEventListener('keydown', focusTrapHandler);
      focusTrapHandler = null;
    }
    if (!anyOpen && lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
      try { lastFocusedEl.focus(); } catch { /* ignore */ }
      lastFocusedEl = null;
    }
  }

  function closeAllModals() {
    Object.keys(overlays).forEach(closeModal);
  }

  /* ---------- Window Modal Bindings ---------- */
  window.openTosModal = function () { openModal('tos'); };
  window.closeTosModal = function () { closeModal('tos'); };
  window.openOnboardingModal = function () { openModal('onboarding'); };
  window.closeOnboardingModal = function () { closeModal('onboarding'); };
  window.openReportModal = function (openCamera = true) {
    if (!user.tosAccepted) {
      openModal('tos');
      return;
    }
    if (!user.ward) {
      showToast(t('toast.onboardFirst'), 'info');
      openModal('onboarding');
      return;
    }
    selectHazard('stagnant-water');
    renderHazardPicker();
    resetSubmitReportButton();
    const canvas = $('#imageCanvas');
    updateReportFlowSteps(canvas.classList.contains('visible') ? 'details' : 'photo');
    openModal('report');
    if (openCamera) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const input = $('#photoInput');
          if (input && overlays.report.classList.contains('open')) input.click();
        }, 320);
      });
    }
  };
  window.closeReportModal = function () { closeModal('report'); };
  window.openSuccessModal = function () { openModal('success'); };
  window.closeSuccessModal = function () {
    closeModal('success');
    flushPendingPwaNudge();
  };
  window.openCommunityModal = function () {
    closeModal('profile');
    renderLeaderboard('wards');
    updateCommunitySubtitle();
    renderCommunityImpactStats();
    renderSuccessStories();
    renderWardChallenge();
    renderImpactWall();
    markSuccessStoriesSeen();
    setNavTab('community');
    openModal('community');
  };
  window.closeCommunityModal = function () { closeModal('community'); };
  window.openPledgeModal = function () {
    if (!requireCommunityConsent()) return;
    if (user.ward) $('#pledgeWard').value = user.ward;
    const pledgeWard = $('#pledgeWard');
    if (pledgeWard) pledgeWard.setAttribute('list', wardDatalistId());
    openModal('pledge');
  };
  window.closePledgeModal = function () { closeModal('pledge'); };
  window.openProfileModal = function () {
    closeModal('community');
    updateProfileUI();
    setNavTab('profile');
    openModal('profile');
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
  window.openAdminQueue = function () {
    if (!hasRole('bmc')) return;
    renderAdminQueue();
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
    try { localStorage.setItem(PWA_NUDGE_KEY, '1'); } catch {}
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
    showToast(t('toast.installHint'), 'info', 5000);
  }

  function setupInstallPrompt() {
    const btn = $('#btnInstall');
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
      try { localStorage.setItem(PWA_NUDGE_KEY, '1'); } catch {}
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
      || window.navigator.standalone === true;
  }

  function trackVisitCount() {
    try {
      const n = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1;
      localStorage.setItem(VISIT_COUNT_KEY, String(n));
      return n;
    } catch {
      return 1;
    }
  }

  function maybeShowPwaNudge(trigger) {
    if (!canShowPwaNudge()) return;
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
  initMap();
  bindEvents();
  updateAuthMode();
  applyTranslations();
  updatePartnerPortalUi();
  updatePersonaUI();
  runBootSequence();
  registerServiceWorker();
  setupInstallPrompt();
  warnIfShareUrlNotProduction();
  trackShareRefLanding();
  updateMapEmptyCta();
  const visitCount = trackVisitCount();
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
  Backend.init().then(() => handleReportDeepLink());

  function initStaticOgMeta() {
    const base = getShareAppUrl();
    setMetaContent('meta[property="og:image"]', absoluteOgUrl('assets/og-civicradar.svg'));
    setMetaContent('meta[name="twitter:image"]', absoluteOgUrl('assets/og-civicradar.svg'));
    setMetaContent('meta[property="og:url"]', base);
    if (user.ward) {
      const ward = getWardShortName(user.ward);
      setMetaContent('meta[property="og:title"]', `CivicRadar — ${ward} monsoon hazard map`);
      const pending = getWardReportStats().find((s) => s.name === user.ward);
      const openCount = pending ? pending.pending : 0;
      setMetaContent('meta[property="og:description"]',
        `${ward}: ${openCount} open hazard(s) on the map — pin, Me too, beat other wards. Free PWA · #MonsoonGuardian`);
    }
  }

  function runBootSequence() {
    const demo = new URLSearchParams(location.search).get('demo');
    if (demo === 'tour' || demo === 'persona') {
      localStorage.setItem(COACH_KEY, '1');
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
      setTimeout(showCoachMark, 600);
      setTimeout(() => { checkResolvedWins(); checkConfirmedResolved(); updateCommunityWinBadge(); }, 1200);
      setTimeout(processBootReminders, 1800);
      updateMapEmptyCta();
      handleReportDeepLink();
      if (window.CivicAnalytics) CivicAnalytics.track('tab_view', { tab: 'map', initial: true });
    }
  }

  /* ---------- Map ---------- */
  function initMap() {
    if (typeof L === 'undefined') {
      showMapError();
      return;
    }
    if (window.CivicAnalytics) CivicAnalytics.perfStart('map_init_duration');
    try {
      map = L.map('map', {
        zoomControl: false,
        attributionControl: true,
      }).setView(getCityCenter(), 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      reportMarkerLayer = L.layerGroup().addTo(map);
      refreshReportMarkers();

      map.on('moveend zoomend', scheduleRefreshReportMarkers);

      // GPS is requested only after explicit consent (DPDP). See maybeRequestLocation().
      maybeRequestLocation(true);
      if (window.CivicAnalytics) CivicAnalytics.perfEnd('map_init_duration');
    } catch (err) {
      console.error('Map failed to initialise:', err);
      if (window.CivicAnalytics) {
        CivicAnalytics.trackError(err.message || 'Map init failed', { stack: err.stack, context: 'initMap' });
        CivicAnalytics.perfEnd('map_init_duration', { failed: true });
      }
      showMapError();
    }
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
  function maybeRequestLocation(recenter) {
    if (!map) return;
    if (!user.tosAccepted || !user.gpsConsent) {
      showLocationBanner('Enable location to report hazards accurately.');
      return;
    }
    if (!navigator.geolocation) {
      showLocationBanner('Location unavailable in this browser.');
      return;
    }
    requestLocation(recenter);
  }

  function showLocationBanner(message) {
    $('#locationBannerText').textContent = message;
    $('#locationBanner').classList.remove('hidden');
  }

  function hideLocationBanner() {
    $('#locationBanner').classList.add('hidden');
  }

  function requestLocation(recenter) {
    const now = Date.now();
    if (now - lastGeoRequest < SCALE_CFG.geoThrottleMs && currentLat != null && currentLng != null) {
      if (recenter && map) map.setView([currentLat, currentLng], 14);
      return;
    }
    lastGeoRequest = now;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
        hideLocationBanner();
        applyWardFromCoords(currentLat, currentLng);
        if (recenter) map.setView([currentLat, currentLng], 14);
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker([currentLat, currentLng], {
          radius: 8,
          fillColor: '#6366f1',
          color: '#fff',
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(map).bindPopup('You are here');
        setTimeout(() => promptNearbyCorroboration(currentLat, currentLng), 800);
      },
      () => {
        showLocationBanner('Enable location to report hazards and see nearby issues.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
          action += `<div class="popup__volunteer"><button type="button" class="popup__btn" data-volunteer-help="${escapeHtml(String(report.id))}"><i class="ph ph-broom"></i> ${escapeHtml(t('popup.helpClean'))}</button></div>`;
        }
      } else if (existingTasks.length > 0 && !report.communityCleared) {
        action += `<div class="popup__volunteer"><span class="popup__note"><i class="ph ph-hand-waving"></i> ${escapeHtml(t('popup.taskOffered'))}</span></div>`;
      }
    }
    const clearedLine = report.communityCleared
      ? `<div class="popup__cleared"><i class="ph ph-broom"></i> ${escapeHtml(corpCopy('popup.communityCleared', getReportCity(report)))}</div>`
      : '';
    const status = report.status === 'resolved' ? t('popup.resolved') : t('popup.pending');
    return `
      <div class="map-popup">
        <div class="popup__title">${escapeHtml(hazardLabel(report.hazard))}</div>
        <div class="popup__meta">${escapeHtml(status)} · ${escapeHtml((report.ward || getCityLabel(getReportCity(report))).split('—')[0].trim())}</div>
        ${clearedLine}
        ${countLine}
        ${fixCountLine}
        ${action}
        ${safety}
      </div>`;
  }

  function reportsForMap() {
    let reports = loadReports().filter(
      (r) => !isReportHidden(r.id) && r.lat != null && r.lng != null
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

  function createReportMarker(report) {
    if (report.lat == null || report.lng == null) return null;

    const marker = L.circleMarker([report.lat, report.lng], {
      radius: 10,
      fillColor: getMarkerColor(report.status),
      color: '#ffffff',
      weight: 2,
      fillOpacity: 0.92,
    });

    marker.bindPopup(buildReportPopup(report));

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
    return marker;
  }

  function refreshReportMarkers() {
    if (!reportMarkerLayer) return;
    reportMarkerLayer.clearLayers();
    reportMarkerMap.clear();
    let pool = reportsForMap();
    if (map) pool = reportsInViewport(pool);
    pool = prioritizeMapReports(pool).slice(0, SCALE_CFG.maxMapMarkers);
    pool.forEach((r) => createReportMarker(r));
  }

  function loadReportMarkers() {
    refreshReportMarkers();
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    Object.entries(overlays).forEach(([name, el]) => {
      el.addEventListener('click', (e) => {
        if (e.target === el && name !== 'tos' && name !== 'onboarding') {
          if (name === 'escalation') tryCloseEscalation();
          else closeModal(name);
        }
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
      const name = $('#displayName').value.trim() || 'Citizen';
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
      user.displayName = sanitizeDisplayName(name);
      saveUser();
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
      renderLeaderboard('wards');
      renderLeaderboard('citizens');
      showToast(t('toast.welcome').replace('{name}', name), 'success', 4500);
      setTimeout(showCoachMark, 500);
    });

    $('#wardInput').addEventListener('input', () => {
      $('#wardError').classList.add('hidden');
      onboardingDetectedWard = '';
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

    $('#btnDismissCoach').addEventListener('click', dismissCoachMark);
    const coachMark = $('#coachMark');
    if (coachMark) {
      coachMark.addEventListener('click', (e) => {
        if (e.target === coachMark) dismissCoachMark();
      });
    }
    $('#btnPartnerAccess').addEventListener('click', window.openPartnerPortal);
    $('#btnPartnerInquiry').addEventListener('click', window.openPartnerInquiry);
    const btnBecomeCoord = $('#btnBecomeCoordinator');
    if (btnBecomeCoord) {
      btnBecomeCoord.addEventListener('click', () => {
        closeModal('about');
        window.openPartnerInquiry();
      });
    }
    $('#btnAbout').addEventListener('click', window.openAboutModal);
    $('#btnAboutClose').addEventListener('click', () => closeModal('about'));
    $('#btnDeleteData').addEventListener('click', () => { deleteMyData(); });
    const btnWithdrawAnalytics = $('#btnWithdrawAnalytics');
    if (btnWithdrawAnalytics) btnWithdrawAnalytics.addEventListener('click', withdrawAnalyticsConsent);
    const btnWithdrawGps = $('#btnWithdrawGps');
    if (btnWithdrawGps) btnWithdrawGps.addEventListener('click', withdrawGpsConsent);
    $('#btnCopyImpact').addEventListener('click', copyImpactSummary);
    const btnCopyPitch = $('#btnCopySharePitch');
    if (btnCopyPitch) btnCopyPitch.addEventListener('click', copySharePitch);
    const btnShareWard = $('#btnShareWardChallenge');
    if (btnShareWard) btnShareWard.addEventListener('click', shareWardChallengeWhatsApp);
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
        if (btn.dataset.close === 'escalation') tryCloseEscalation();
        else closeModal(btn.dataset.close);
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
    $('#btnTakePhoto').addEventListener('click', () => $('#photoInput').click());
    $('#photoInput').addEventListener('change', handlePhotoCapture);
    $('#reportNotes').addEventListener('input', () => {
      if ($('#imageCanvas').classList.contains('visible')) {
        updateReportFlowSteps('submit');
      }
    });
    $('#btnSubmitReport').addEventListener('click', submitReport);

    $('#btnShareTwitter').addEventListener('click', () => shareTwitter(buildDefaultShareMessage()));
    $('#btnShareWhatsApp').addEventListener('click', () => {
      if (lastReportId) shareReportWhatsApp(lastReportId);
      else shareWhatsApp(buildDefaultShareMessage());
    });
    $('#btnSuccessFile').addEventListener('click', () => {
      if (!lastReportId) return;
      closeModal('success');
      resetReportForm();
      flushPendingPwaNudge();
      openEscalationModal(lastReportId);
    });
    $('#btnSuccessClose').addEventListener('click', () => {
      const reportId = lastReportId;
      const report = reportId ? findReportById(reportId) : null;
      const notShared = report && !report.communityShared;
      closeModal('success');
      resetReportForm();
      setNavTab('map');
      flushPendingPwaNudge();
      if (notShared && reportId) {
        setTimeout(() => {
          showToast(t('success.shareNudge'), 'info', 5500, {
            label: t('success.shareWhatsapp'),
            onClick: () => shareReportWhatsApp(reportId),
          });
        }, 450);
      }
    });

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
        if (confirmReport(cb.dataset.confirm) && map) map.closePopup();
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

    $('#btnOpenPledge').addEventListener('click', () => {
      closeModal('community');
      window.openPledgeModal();
    });
    $('#btnOpenVolunteer').addEventListener('click', () => {
      closeModal('community');
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
        setNavTab(tab.dataset.tab);
        const target = tab.dataset.tab;
        if (window.CivicAnalytics) CivicAnalytics.track('tab_view', { tab: target });
        if (target === 'community') window.openCommunityModal();
        else if (target === 'profile') window.openProfileModal();
        else closeAllModals();
      });
    });

    $('#btnEnableLocation').addEventListener('click', () => {
      // Tapping "Enable" is an explicit opt-in to GPS collection.
      user.gpsConsent = true;
      saveUser();
      if (navigator.geolocation) {
        requestLocation(true);
      } else {
        showToast(t('toast.noLocation'), 'error');
      }
    });
    $('#btnRecenter').addEventListener('click', () => {
      if (currentLat != null && currentLng != null) {
        map.setView([currentLat, currentLng], 15);
        showToast(t('toast.recentered'), 'info', 2000);
      } else {
        maybeRequestLocation(true);
      }
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
        const open = Object.entries(overlays).find(([, el]) => el.classList.contains('open'));
        if (open && open[0] !== 'tos' && open[0] !== 'onboarding') closeModal(open[0]);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'A') window.openAdminModal();
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        if (isLead) window.openCoordinatorDashboard();
        else window.openLeadModal();
      }
    });

    let adminTapCount = 0;
    let leadTapCount = 0;
    $('#profileWard').addEventListener('click', () => {
      adminTapCount++;
      if (adminTapCount >= 5) {
        adminTapCount = 0;
        window.openAdminModal();
      }
      setTimeout(() => { adminTapCount = 0; }, 2000);
    });
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

    $('#btnLeadSubmit').addEventListener('click', () => {
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

  function rejectPhoto(scanResult) {
    const canvas = $('#imageCanvas');
    if (window.ImageModeration) {
      ImageModeration.clearPhotoCanvas(canvas, $('#photoInput'));
    } else {
      resetReportForm();
    }
    lastReportDataUrl = null;
    updateReportFlowSteps('photo');
    const msg = scanResult.i18nKey ? t(scanResult.i18nKey) : (scanResult.message || t('moderation.blocked.irrelevant'));
    showToast(msg, 'error', 5500);
  }

  function handlePhotoCapture(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (window.ImageModeration) {
      const fileCheck = ImageModeration.validateFile(file, getModCfg());
      if (!fileCheck.ok) {
        rejectPhoto(fileCheck);
        return;
      }
    }

    const reader = new FileReader();
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
        updateReportFlowSteps('details');
      };
      img.onerror = () => {
        setPhotoScanning(false);
        showToast(t('moderation.blocked.fileType'), 'error');
        $('#photoInput').value = '';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function resetSubmitReportButton() {
    const submitBtn = $('#btnSubmitReport');
    if (!submitBtn) return;
    submitBtn.classList.remove('is-loading');
    submitBtn.disabled = false;
    delete submitBtn.dataset.originalLabel;
    const label = submitBtn.querySelector('.btn__label');
    if (label) label.textContent = t('report.submit');
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
  }

  async function submitReport() {
    const canvas = $('#imageCanvas');
    const submitBtn = $('#btnSubmitReport');
    if (window.CivicAnalytics) CivicAnalytics.perfStart('report_submit_duration');
    if (!canvas.classList.contains('visible')) {
      showToast(t('toast.photoRequired'), 'error');
      return;
    }

    if (!navigator.geolocation) {
      showToast(t('toast.gpsRequired'), 'error');
      return;
    }

    if (window.ImageModeration && getModCfg().enabled) {
      setButtonLoading(submitBtn, true, t('moderation.scanning'));
      const scan = await ImageModeration.scanCanvas(canvas, getModCfg());
      if (!scan.ok) {
        setButtonLoading(submitBtn, false);
        rejectPhoto(scan);
        return;
      }
    }

    // Submitting a report is an explicit GPS opt-in.
    user.gpsConsent = true;
    saveUser();
    lastReportDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    setButtonLoading(submitBtn, true, t('report.submitting'));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const reports = loadReports();
        const now = Date.now();

        for (let i = 0; i < reports.length; i++) {
          const r = reports[i];
          if (r.lat == null || r.lng == null) continue;
          // Only block against still-pending reports inside the time window.
          // Resolved or stale hazards can legitimately recur and should be re-reportable.
          if (r.status === 'resolved') continue;
          const age = now - new Date(r.timestamp).getTime();
          if (Number.isFinite(age) && age > DUPLICATE_WINDOW_MS) continue;
          const dist = getDistanceInMeters(lat, lng, r.lat, r.lng);
          if (dist < DUPLICATE_RADIUS_M) {
            setButtonLoading(submitBtn, false);
            if (window.CivicAnalytics) {
              CivicAnalytics.track('report_submitted', {
                hazard: $('#hazardType').value,
                hasGps: true,
                hasPhoto: true,
                path: 'duplicate_corroboration',
              }, user.ward);
              CivicAnalytics.perfEnd('report_submit_duration', { duplicate: true });
            }
            // Don't create a duplicate — offer to corroborate the existing pin instead.
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
        const notes = sanitizeText($('#reportNotes').value, 500);

        const report = normalizeReport({
          id: generateId(),
          hazard,
          notes,
          image: lastReportDataUrl,
          ward: resolveReportWard(lat, lng),
          city: getUserCity(),
          reporter: user.displayName || 'Citizen',
          lat,
          lng,
          status: 'pending',
          timestamp: new Date().toISOString(),
        }, user.id);

        reports.unshift(report);

        try {
          saveReports(reports);
        } catch (err) {
          setButtonLoading(submitBtn, false);
          showToast(t('toast.storageFull'), 'error', 4500);
          return;
        }

        lastReportId = report.id;
        Backend.insertReport(report);
        if (window.CivicAnalytics) {
          CivicAnalytics.track('report_submitted', {
            hazard,
            hasGps: true,
            hasPhoto: true,
            path: 'new_report',
            city: getUserCity(),
          }, user.ward);
          CivicAnalytics.perfEnd('report_submit_duration');
        }
        createReportMarker(report);
        const weekBonus = awardWeekBonus();
        setButtonLoading(submitBtn, false);
        closeModal('report');
        showSuccessModal(weekBonus);
        maybeShowPwaNudge('report');
        updateProfileUI();
        updatePersonaUI();
        updateCommunitySubtitle();
        renderWardChallenge();
        updateMapEmptyCta();
        renderLeaderboard('wards');
        renderLeaderboard('citizens');
      },
      () => {
        setButtonLoading(submitBtn, false);
        if (window.CivicAnalytics) CivicAnalytics.perfEnd('report_submit_duration', { gpsFailed: true });
        showToast(t('toast.gpsFail'), 'error', 4500);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function showSuccessModal(weekBonus = 0) {
    const thumb = $('#successThumbnail');
    if (lastReportDataUrl) {
      thumb.src = lastReportDataUrl;
      thumb.hidden = false;
    }
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
    openModal('success');
    const fileBtn = $('#btnSuccessFile');
    if (fileBtn) {
      const corp = getCityCorpChannels(getUserCity());
      fileBtn.textContent = getUserCity() === 'mumbai'
        ? t('success.file')
        : t('success.fileCorp').replace('{corp}', corp.name || getCityLabel());
    }
    applyCorpAwareI18n();
  }

  function resetReportForm() {
    $('#photoInput').value = '';
    $('#reportNotes').value = '';
    const canvas = $('#imageCanvas');
    canvas.classList.remove('visible');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastReportDataUrl = null;
    resetSubmitReportButton();
    updateReportFlowSteps('photo');
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
      .replace(/\{marathi\}/g, t('share.marathiHook'))
      .replace(/\{hashtags\}/g, buildHashtagLine(vars.wardFull || user.ward));
    return out;
  }

  function buildDefaultShareMessage() {
    const ward = user.ward ? getWardShortName(user.ward) : getCityLabel();
    return fillShareTemplate(t('share.appMsg'), {
      city: getCityLabel(),
      ward,
      link: shareAppLink('invite'),
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
    const ward = wardName || (user.ward ? getWardShortName(user.ward) : 'my area');
    return fillShareTemplate(t('confirm.shareMsg'), {
      ward,
      link: shareAppLink('fixed'),
      wardFull: user.ward,
    });
  }

  function launchConfetti() {
    const wrap = document.createElement('div');
    wrap.className = 'confetti-burst';
    wrap.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('span');
      p.className = 'confetti-burst__piece';
      p.style.setProperty('--x', `${Math.random() * 100}%`);
      p.style.setProperty('--delay', `${Math.random() * 0.45}s`);
      p.style.setProperty('--hue', `${140 + Math.floor(Math.random() * 120)}`);
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 2600);
  }

  function celebrateFirstShare() {
    if (localStorage.getItem(FIRST_SHARE_KEY)) return;
    try { localStorage.setItem(FIRST_SHARE_KEY, '1'); } catch {}
    addPointsCache(POINTS_FIRST_SHARE);
    launchConfetti();
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
    const text = encodeURIComponent(`${base} ${buildHashtagLine(user.ward)}`);
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
    try { localStorage.setItem(SUCCESS_STORIES_SEEN_KEY, JSON.stringify(ids)); } catch {}
  }

  function getSuccessStories() {
    return loadReports()
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
      const thumb = (r.resolutionImage && /^data:image\//.test(r.resolutionImage))
        ? r.resolutionImage
        : (r.image && /^data:image\//.test(r.image) ? r.image : '');
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

  function loadCanvasImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
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

  async function generateSuccessCardCanvas(report, type) {
    const W = 1080;
    const H = 1350;
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
    ctx.fillText('CivicRadar', 72, 110);

    ctx.fillStyle = dark ? '#f8fafc' : '#0f172a';
    ctx.font = '700 64px Outfit, system-ui, sans-serif';
    const headLines = headline.length > 28 ? [headline.slice(0, 28), headline.slice(28)] : [headline];
    headLines.forEach((line, i) => ctx.fillText(line, 72, 210 + i * 72));

    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
    ctx.font = '500 40px Outfit, system-ui, sans-serif';
    ctx.fillText(hazard, 72, 210 + headLines.length * 72 + 24);

    const imgY = 380;
    const imgW = 460;
    const imgH = 345;
    const gap = 40;
    const leftX = 72;
    const rightX = leftX + imgW + gap;

    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
    ctx.font = '600 24px Outfit, system-ui, sans-serif';
    ctx.fillText(t('profile.proofBefore').toUpperCase(), leftX, imgY - 12);
    ctx.fillText(t('profile.proofAfter').toUpperCase(), rightX, imgY - 12);

    const hasBefore = report.image && /^data:image\//.test(report.image);
    const hasAfter = report.resolutionImage && /^data:image\//.test(report.resolutionImage);

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
        drawImagePlaceholder(ctx, rightX, imgY, imgW, imgH, '✓', dark);
      }
    } else {
      drawImagePlaceholder(ctx, rightX, imgY, imgW, imgH, '✓', dark);
    }

    ctx.fillStyle = dark ? '#cbd5e1' : '#334155';
    ctx.font = '500 34px "Noto Sans Devanagari", Outfit, system-ui, sans-serif';
    ctx.fillText(buildHashtagLine(report.ward), 72, imgY + imgH + 80);

    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
    ctx.font = '500 30px Outfit, system-ui, sans-serif';
    ctx.fillText(reportDeepLink(report.id), 72, H - 96);

    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 26px Outfit, system-ui, sans-serif';
    ctx.fillText('#MonsoonGuardian', 72, H - 52);

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

  function updateShareWinNativeButton() {
    const btn = $('#btnShareWinNativeShare');
    if (!btn) return;
    btn.classList.toggle('hidden', !navigator.share);
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
      const hasBefore = report.image && /^data:image\//.test(report.image);
      const hasAfter = report.resolutionImage && /^data:image\//.test(report.resolutionImage);
      if (hasBefore || hasAfter) {
        proof.hidden = false;
        proof.innerHTML = `
          <div class="proof-compare__col">
            <span class="proof-compare__label">${escapeHtml(t('profile.proofBefore'))}</span>
            ${hasBefore ? `<img src="${report.image}" alt="">` : '<div class="proof-compare__placeholder">—</div>'}
          </div>
          <div class="proof-compare__col">
            <span class="proof-compare__label">${escapeHtml(t('profile.proofAfter'))}</span>
            ${hasAfter ? `<img src="${report.resolutionImage}" alt="">` : '<div class="proof-compare__placeholder">✓</div>'}
          </div>`;
      } else {
        proof.hidden = true;
        proof.innerHTML = '';
      }
    }

    updateShareWinNativeButton();
    if (opts.celebrate !== false) launchConfetti();
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
    const img = report.image && /^data:image\//.test(report.image) ? report.image : absoluteOgUrl('assets/og-civicradar.svg');
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
   * (1916 / MyBMC / portal / @mybmc) → ward complaint officer → zonal DMC →
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
    const { steps, done, active } = getFilingProgress(report);
    return `<div class="report-card__progress" aria-hidden="true">${steps.map((key) => {
      let cls = '';
      if (done.has(key)) cls = 'is-done';
      else if (key === active) cls = 'is-active';
      return `<span class="report-card__progress-dot ${cls}"></span>`;
    }).join('')}</div>`;
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
        `Request: Please escalate to ward office / Health dept (022-25332685) for anti-larval treatment.`,
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
        `Portal: https://grievances.maharashtra.gov.in/en`,
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
        `Please escalate through PMC CARE portal (pmccare.in) or WhatsApp 9689900002.`,
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
        `Portal: https://grievances.maharashtra.gov.in/en`,
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
          actions.push(`<button type="button" class="btn btn--outline btn--sm" data-corp-channel="call" data-corp-phone="${escapeHtml(dept.phone)}">${escapeHtml(dept.phoneDisplay || dept.phone)}</button>`);
        }
        if (dept.email) {
          actions.push(`<button type="button" class="btn btn--outline btn--sm" data-corp-channel="email" data-corp-email="${escapeHtml(dept.email)}">${escapeHtml(t('esc.tmc.tier.openEmail'))}</button>`);
        }
        return `<li><span class="esc-dept-list__label">${escapeHtml(label)}</span><span class="esc-dept-list__actions">${actions.join('')}</span></li>`;
      }).join('');
      deptsWrap.classList.remove('hidden');
    } else if (deptsWrap) {
      deptsWrap.classList.add('hidden');
    }
    if (aapleBtn) aapleBtn.classList.toggle('hidden', !corp.aapleSarkarUrl);
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
        small: 'pmccare.in',
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
    renderEscalation(report);
    applyTranslations();
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
    updateEscCityLabels(city, corp);
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
                <button type="button" class="btn btn--outline btn--sm" data-esc-copy="file">${escapeHtml(t('esc.copyAll'))}</button>
                <button type="button" class="btn btn--primary btn--sm" data-esc-channel="whatsapp">${escapeHtml(t('esc.tier.openWa'))}</button>
              </div>`;
            } else if (city === 'pune') {
              actions = `
              <div class="esc-step__actions">
                <button type="button" class="btn btn--outline btn--sm" data-esc-copy="file">${escapeHtml(t('esc.copyAll'))}</button>
                <button type="button" class="btn btn--primary btn--sm" data-corp-channel="whatsapp">${escapeHtml(t('esc.pmc.tier.openWa'))}</button>
              </div>`;
            } else {
              actions = `
              <div class="esc-step__actions">
                <button type="button" class="btn btn--outline btn--sm" data-esc-copy="file">${escapeHtml(t('esc.copyAll'))}</button>
                <button type="button" class="btn btn--primary btn--sm" data-corp-channel="portal">${escapeHtml(t('esc.corpBtn').replace('{corp}', corp.name || getCityLabel(city)))}</button>
              </div>`;
            }
          } else if (corpActions) {
            const phoneAttr = corpActions.phone ? ` data-corp-phone="${escapeHtml(corpActions.phone)}"` : '';
            actions = `
              <div class="esc-step__actions">
                <button type="button" class="btn btn--outline btn--sm" data-esc-copy="${escapeHtml(tobj.key)}">${escapeHtml(corpActions.copy)}</button>
                <button type="button" class="btn btn--primary btn--sm" data-esc-channel="${escapeHtml(corpActions.channel)}"${phoneAttr}>${escapeHtml(corpActions.action)}</button>
              </div>`;
            if (tobj.key === 'grievance') {
              actions += `<p class="esc-step__rti-note">${escapeHtml(t('esc.rtiDisclaimer'))}</p>`;
            }
          } else if (tobj.key === 'matrix') {
            actions = `
              <div class="esc-step__actions">
                <button type="button" class="btn btn--outline btn--sm" data-esc-copy="matrix">${escapeHtml(t('esc.tier.copyFollowUp'))}</button>
                <button type="button" class="btn btn--primary btn--sm" data-esc-channel="call">${escapeHtml(t('esc.tier.openCall'))}</button>
              </div>`;
          } else if (tobj.key === 'zonal') {
            actions = `
              <div class="esc-step__actions">
                <button type="button" class="btn btn--outline btn--sm" data-esc-copy="zonal">${escapeHtml(t('esc.tier.copyFollowUp'))}</button>
                <button type="button" class="btn btn--primary btn--sm" data-esc-channel="tweet">${escapeHtml(t('esc.tier.openTweet'))}</button>
              </div>`;
          } else if (tobj.key === 'grievance') {
            actions = `
              <div class="esc-step__actions">
                <button type="button" class="btn btn--outline btn--sm" data-esc-copy="grievance">${escapeHtml(t('esc.tier.copyFollowUp'))}</button>
                <button type="button" class="btn btn--primary btn--sm" data-esc-channel="aaple">${escapeHtml(t('esc.tier.openAaple'))}</button>
              </div>
              <p class="esc-step__rti-note">${escapeHtml(t('esc.rtiDisclaimer'))}</p>`;
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
    try { localStorage.setItem(PLEDGE_STATUS_SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch {}
  }

  function loadPledgePointsCredited() {
    try { return new Set(JSON.parse(localStorage.getItem(PLEDGE_POINTS_CREDITED_KEY)) || []); }
    catch { return new Set(); }
  }

  function markPledgePointsCredited(id) {
    const credited = loadPledgePointsCredited();
    credited.add(String(id));
    try { localStorage.setItem(PLEDGE_POINTS_CREDITED_KEY, JSON.stringify([...credited])); } catch {}
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
    renderProfilePledges();
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

  function renderProfilePledges() {
    const listEl = $('#profilePledgeList');
    if (!listEl) return;
    if (isAdmin || isLead) {
      listEl.innerHTML = '';
      return;
    }

    const pledges = getUserPledges();
    if (pledges.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state empty-state--action">
          <i class="ph ph-hand-heart"></i>
          <p>${escapeHtml(t('profile.pledgesEmpty'))}</p>
          <button type="button" class="btn btn--secondary btn--sm" id="btnEmptyPledge">${escapeHtml(t('profile.pledgesEmptyAction'))}</button>
        </div>`;
      const btn = $('#btnEmptyPledge');
      if (btn) btn.addEventListener('click', () => { closeModal('profile'); window.openCommunityModal(); window.openPledgeModal(); });
      return;
    }

    listEl.innerHTML = pledges
      .map((p) => `
        <div class="profile-pledge-item">
          <div class="profile-pledge-item__header">
            <span class="profile-pledge-item__type">${escapeHtml(pledgeTypeLabel(p.type))}</span>
            <span class="status-badge ${pledgeStatusBadgeClass(p)}">${escapeHtml(pledgeStatusLabel(p))}</span>
          </div>
          <div class="profile-pledge-item__meta">${escapeHtml((p.ward || '').split('—')[0].trim())} · ${escapeHtml(formatRelativeTime(p.timestamp))}</div>
          ${p.message ? `<p class="profile-pledge-item__message">${escapeHtml(p.message)}</p>` : ''}
        </div>`)
      .join('');
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
    renderProfilePledges();
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
    localStorage.setItem(RESOLVED_SEEN_KEY, JSON.stringify(ids));
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
    try { localStorage.setItem(CONFIRMED_SEEN_KEY, JSON.stringify(ids)); } catch {}
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
        rejectPhoto(fileCheck);
        e.target.value = '';
        return;
      }
    }
    try {
      adminProofDataUrl = await compressImageFromFile(file);
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
      if (!r.ward || isReportHidden(r.id)) return;
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

  /* ---------- Leaderboard Engine ---------- */
  function renderLeaderboard(type) {
    const rankClass = (i) => (i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '');
    const demoNote = $('#leaderboardDemoNote');
    const liveBackend = Backend.enabled;

    if (type === 'wards') {
      const realWards = aggregateWardLeaderboard();
      let wards = realWards;
      const usingDemo = !liveBackend && realWards.length < 2;
      if (usingDemo) {
        wards = DEMO_WARD_SEED.filter((w) => w.city === getUserCity()).map((w) => ({ ...w }));
      }
      wards = mergeUserWard(wards);
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
      let citizens = aggregateCitizenLeaderboard();
      const usingDemo = !liveBackend && citizens.length < 2;
      if (usingDemo) {
        citizens = DEMO_CITIZEN_SEED.map((c) => ({ ...c }));
      }

      const userPoints = getTotalCivicPoints();
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

  /* ---------- Profile Stats Calculator ---------- */
  function updateProfileUI() {
    const reports = getUserReports();
    const resolved = reports.filter((r) => r.status === 'resolved');
    const pending = reports.filter((r) => r.status === 'pending');
    const bonus = loadPointsCache();

    $('#profileGreeting').textContent = user.displayName
      ? t('profile.greeting').replace('{name}', user.displayName)
      : t('profile.greetingDefault');
    $('#profileWard').textContent = user.ward || t('profile.selectWard');

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
        (streak >= 2 ? ` · ${t('profile.streak').replace('{n}', String(streak))}` : '');
    } else if (wardImpactEl) {
      wardImpactEl.classList.add('hidden');
    }

    $('#profilePoints').textContent = getTotalCivicPoints().toLocaleString();
    $('#profileFixed').textContent = resolved.length;
    $('#profilePending').textContent = pending.length;
    $('#profilePointsHint').textContent =
      bonus > 0
        ? t('profile.pointsHint.bonus')
          .replace('{n}', String(reports.length))
          .replace('{bonus}', String(bonus))
        : t('profile.pointsHint.base');

    renderProfilePledges();
    renderProfileVolunteer();

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
        const statusClass = resolved
          ? 'status-badge--resolved'
          : stage.filed
            ? 'status-badge--filed'
            : 'status-badge--pending';
        const statusText = resolved
          ? resolutionStatusLabel(r)
          : stage.filed
            ? `${getComplaintRefPrefix(getReportCity(r))} #${escapeHtml(r.complaintId)}`
            : t('profile.status.notFiled');
        const clock = !resolved
          ? `<span class="report-card__clock">${escapeHtml(getClockLine(r))}</span>`
          : '';
        let action = '';
        if (!resolved) {
          const rCity = getReportCity(r);
          const label = stage.filed
            ? t('profile.trackEscalate')
            : (rCity === 'mumbai' ? t('profile.fileBmc') : t('profile.fileCorp').replace('{corp}', getCorpShortName(rCity)));
          const cls = stage.key === 'matrix' || stage.key === 'zonal' || stage.key === 'grievance'
            ? 'btn--primary' : 'btn--outline';
          action = `<button type="button" class="btn ${cls} btn--sm report-card__cta" data-escalate="${escapeHtml(String(r.id))}">${label}</button>`;
        }
        const safeImg = r.image && /^data:image\//.test(r.image) ? r.image : '';
        const safeAfter = r.resolutionImage && /^data:image\//.test(r.resolutionImage) ? r.resolutionImage : '';
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
              <div class="report-card__meta">${escapeHtml(formatRelativeTime(r.timestamp))}${r.notes ? ` · ${escapeHtml(r.notes)}` : ''}</div>
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

    activeAdminReportId = reportId;
    adminProofDataUrl = null;
    $('#adminReportPhoto').src = (report.image && /^data:image\//.test(report.image)) ? report.image : '';
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
    return !!(r.image && /^data:image\//.test(r.image));
  }

  function reportHasResolutionProof(r) {
    return !!(r.resolutionImage && /^data:image\//.test(r.resolutionImage));
  }

  function escapeCsvField(val) {
    const s = val == null ? '' : String(val);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function getAdminExportReports() {
    const all = adminScopedReports(loadReports());
    const wardFilter = $('#aqWardFilter')?.value || '';
    let rows = all.filter((r) => !wardFilter || r.ward === wardFilter);
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
    const headerKey = city === 'pune' ? 'copy1916.pmc.header' : 'copy1916.header';
    const complaintFiledKey = city === 'pune' ? 'copy1916.pmc.complaintFiled' : 'copy1916.complaintFiled';
    const complaintNotFiledKey = city === 'pune' ? 'copy1916.pmc.complaintNotFiled' : 'copy1916.complaintNotFiled';
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

  function renderAdminQueue() {
    const all = loadReports();
    const pending = all.filter((r) => r.status === 'pending');
    const resolved = all.filter((r) => r.status === 'resolved');
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
        const safeImg = r.image && /^data:image\//.test(r.image) ? r.image : '';
        const thumb = safeImg ? `<img class="queue-item__thumb" src="${safeImg}" alt="">` : '<div class="queue-item__thumb"></div>';
        return `
          <li class="queue-item${overdueFlag ? ' queue-item--overdue' : ''}">
            ${thumb}
            <div class="queue-item__body">
              <div class="queue-item__title">${escapeHtml(hazardLabel(r.hazard))} · ${escapeHtml((r.ward || getCityLabel(getReportCity(r))).split('—')[0].trim())}</div>
              <div class="queue-item__meta">${escapeHtml(formatRelativeTime(r.timestamp))} · ${escapeHtml(getClockLine(r))}</div>
              <div class="queue-item__tags">${filedBadge}${confBadge}${overdueFlag ? '<span class="status-badge status-badge--overdue">Overdue</span>' : ''}</div>
            </div>
            <div class="queue-item__actions">
              <button type="button" class="btn btn--outline btn--sm" data-copy-1916="${escapeHtml(String(r.id))}" title="${escapeHtml(t('admin.copy1916'))}">${escapeHtml(t('admin.copy1916'))}</button>
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
    openModal('volunteer');
  };

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
    renderProfileVolunteer();
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
    renderProfileVolunteer();
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

  function renderProfileVolunteer() {
    const el = $('#profileVolunteer');
    if (!el) return;
    if (isAdmin || isLead) {
      el.innerHTML = '';
      return;
    }
    const signup = getMyVolunteerSignup();
    if (!signup) {
      el.innerHTML = `
        <div class="empty-state empty-state--action">
          <i class="ph ph-broom"></i>
          <p>${escapeHtml(t('volunteer.empty'))}</p>
          <button type="button" class="btn btn--secondary btn--sm" id="btnEmptyVolunteer">${escapeHtml(t('volunteer.emptyAction'))}</button>
        </div>`;
      const btn = $('#btnEmptyVolunteer');
      if (btn) btn.addEventListener('click', () => { closeModal('profile'); window.openVolunteerModal(); });
      return;
    }
    const skills = (signup.skills || [])
      .map((s) => `<span>${escapeHtml(volunteerSkillLabel(s))}</span>`)
      .join('');
    el.innerHTML = `
      <div class="profile-volunteer-card">
        <strong>${escapeHtml(signup.neighbourhood)}</strong>
        <div class="profile-volunteer-card__meta">${escapeHtml(t('volunteer.hoursLabel').replace('{n}', String(signup.hours)))} · ${escapeHtml((signup.ward || '').split('—')[0].trim())}</div>
        <div class="profile-volunteer-card__skills">${skills}</div>
        <button type="button" class="btn btn--outline btn--sm" id="btnEditVolunteer" style="margin-top:10px">${escapeHtml(t('volunteer.edit'))}</button>
      </div>`;
    $('#btnEditVolunteer').addEventListener('click', window.openVolunteerModal);
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
    const showMock = !Backend.enabled;
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
          actionBtn = `<button type="button" class="btn btn--outline btn--sm" data-action="deliver" data-pledge-id="${escapeHtml(String(p.id))}">${escapeHtml(t('coord.markDelivered'))}</button>`;
        } else {
          actionBtn = `<button type="button" class="btn btn--secondary btn--sm" data-action="verify" data-pledge-id="${escapeHtml(String(p.id))}">${escapeHtml(t('coord.verifyHours'))}</button>`;
        }
        const statusKey = getPledgeStatusKey(p);
        const statusBadge = `<span class="status-badge ${pledgeStatusBadgeClass(p)}">${escapeHtml(t(`pledge.status.${statusKey}`))}</span>`;
        return `
          <li class="pledge-item${isMock ? ' pledge-item--mock' : ''}${isNew ? ' pledge-item--new' : ''}">
            <div class="pledge-item__header">
              <span class="pledge-item__type">${escapeHtml(pledgeTypeLabel(p.type))}${isMock ? ' · Demo' : ''}</span>
              ${statusBadge}
            </div>
            <span class="pledge-item__ward">${escapeHtml(p.ward)}</span>
            <p class="pledge-item__message">${escapeHtml(p.message || '—')}</p>
            <div class="pledge-item__footer">
              <span class="pledge-item__citizen">${escapeHtml(p.citizen || 'Anonymous')} · ${escapeHtml(formatRelativeTime(p.timestamp))}</span>
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
          .join(' · ');
        return `
          <li class="pledge-item">
            <div class="pledge-item__header">
              <span class="pledge-item__type">${escapeHtml(v.displayName || 'Volunteer')}</span>
              <span class="status-badge">${escapeHtml(t('volunteer.hoursLabel').replace('{n}', String(v.hours)))}</span>
            </div>
            <span class="pledge-item__ward">${escapeHtml(v.neighbourhood)} · ${escapeHtml((v.ward || '').split('—')[0].trim())}</span>
            <p class="pledge-item__message">${skills || '—'}${v.contact ? ` · ${escapeHtml(v.contact)}` : ''}</p>
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
              <div class="queue-item__title">${escapeHtml(task.volunteerName || 'Volunteer')} · ${escapeHtml((task.neighbourhood || '').slice(0, 40))}</div>
              <div class="queue-item__meta">${report ? escapeHtml(hazardLabel(report.hazard)) : 'Hazard'} · ${escapeHtml((task.ward || '').split('—')[0].trim())}</div>
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
              <div class="queue-item__title">${escapeHtml(hazardLabel(r.hazard))} · ${escapeHtml((r.ward || getCityLabel(getReportCity(r))).split('—')[0].trim())}</div>
              <div class="queue-item__meta">${escapeHtml(formatRelativeTime(r.timestamp))}${r.notes ? ` · ${escapeHtml(r.notes)}` : ''}</div>
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
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
});
