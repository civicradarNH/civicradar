/**
 * CivicRadar — Core JavaScript Logic
 * Strict DOMContentLoaded bindings · localStorage · Haversine spam filter
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ---------- Constants ---------- */
  // Build tag attached to feedback rows. Kept in step with the SW cache version.
  const CIVIC_APP_VERSION = 'v92';
  const PENDING_AUTH_FLOW_KEY = 'civicradar_pending_auth_flow';
  const PENDING_NGO_CODE_KEY = 'civicradar_pending_ngo_code';

  function persistPendingAuth(flow, ngoCode) {
    sessionStorage.setItem(PENDING_AUTH_FLOW_KEY, flow);
    if (ngoCode) sessionStorage.setItem(PENDING_NGO_CODE_KEY, ngoCode);
  }

  function clearPendingAuth() {
    sessionStorage.removeItem(PENDING_AUTH_FLOW_KEY);
    sessionStorage.removeItem(PENDING_NGO_CODE_KEY);
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
  // Location-aware in-app nudge radius (foreground only; precise coords never persisted).
  const PROXIMITY_NUDGE_M = 150;
  const HIDDEN_REPORTS_KEY = 'civicradar_hidden_reports';
  const WEEK_BONUS_KEY = 'civicradar_week_bonus';
  const FIRST_SHARE_KEY = 'civicradar_first_share_done';
  const SUCCESS_STORIES_SEEN_KEY = 'civicradar_success_stories_seen';
  const VISIT_COUNT_KEY = 'civicradar_visit_count';
  const FIRST_REPORT_DONE_KEY = 'civicradar_first_report_done';
  const PWA_NUDGE_KEY = 'civicradar_pwa_nudge_dismissed';
  const SEASON_HOOK_DISMISS_KEY = 'civicradar_season_hook_dismissed';
  const REF_WELCOME_KEY = 'civicradar_ref_welcome_seen';
  const LOCBANNER_SNOOZE_KEY = 'civicradar_locbanner_snooze';
  const LOCBANNER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
  const POINTS_PER_REPORT = 50;
  const POINTS_WEEK_BONUS = 25;
  const POINTS_FIRST_SHARE = 10;
  const POINTS_COMMUNITY_RESOLVE_REPORTER = 25;
  const POINTS_FIX_CONFIRM = 10;
  const POINTS_ME_TOO = 5;
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
  let isSuperAdmin = false;
  window.isAdmin = false;
  window.isLead = false;
  window.isSuperAdmin = false;
  let accessProofDataUrl = null;

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
  // Native camera / file picker can pop history or deliver a ghost tap on Map nav
  // before async photo processing finishes — guard the report sheet until capture completes.
  let reportPhotoFlowActive = false;
  let reportPhotoProcessing = false;
  let reportCameraTimer = null;
  let reportPhotoDismissGuard = 0;

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
    feedback: $('#feedbackOverlay'),
    accessRequest: $('#accessRequestOverlay'),
    accessClaim: $('#accessClaimOverlay'),
    accessReview: $('#accessReviewOverlay'),
    leadNom: $('#leadNomOverlay'),
    tracking: $('#trackingOverlay'),
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
          small: 'portal.mcgm.gov.in',
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
      return `<button type="button" class="esc-channel${recCls}" data-official-channel="${escapeHtml(ch.id)}"${hintAttr}>
        <i class="ph ph-${ch.icon}"></i><span>${escapeHtml(ch.label)}</span><small>${escapeHtml(ch.small)}</small>
      </button>`;
    }).join('');
    container.dataset.officialReportId = report && report.id ? String(report.id) : '';
    container.dataset.officialContext = (opts && opts.context) || 'panel';
  }

  function renderOfficialChannelsSurfaces(report) {
    const city = getUserCity();
    const hazard = (report && report.hazard) || 'stagnant-water';
    renderOfficialChannelButtons($('#successOfficialChannels'), city, hazard, report, { context: 'success' });
    renderOfficialChannelButtons($('#communityOfficialChannels'), city, hazard, null, { context: 'community' });
    renderOfficialChannelButtons($('#profileOfficialChannels'), city, hazard, null, { context: 'profile' });
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
    const wrap = btn.closest('[data-official-report-id], #successOfficialChannels, #communityOfficialChannels, #profileOfficialChannels, #escOfficialExtras');
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
    localStorage.setItem(CUSTOM_SOCIETIES_KEY, JSON.stringify(store));
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

  function updateSocietyHint(cityId, ward, count) {
    if (typeof t !== 'function') return;
    const onboardHint = document.getElementById('onboardSocietyHint');
    const profileHint = document.getElementById('profileSocietyHint');
    const wardLabel = wardLabelShort(ward);
    if (onboardHint) {
      if (!ward) {
        onboardHint.textContent = t('onboard.societyHintNoWard');
      } else if (count > 0) {
        onboardHint.textContent = t('onboard.societyHintWard')
          .replace('{ward}', wardLabel)
          .replace('{n}', String(count));
      } else {
        onboardHint.textContent = t('onboard.societyHintCustom');
      }
    }
    if (profileHint) {
      if (!ward) {
        profileHint.textContent = t('profile.societyHintNoWard');
      } else if (count > 0) {
        profileHint.textContent = t('profile.societyHintWard')
          .replace('{ward}', wardLabel)
          .replace('{n}', String(count));
      } else {
        profileHint.textContent = t('profile.societyHintCustom');
      }
    }
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

  if (window.CIVICRADAR_CONFIG && window.CIVICRADAR_SOCIETY_BY_WARD) {
    window.CIVICRADAR_CONFIG.societySuggestionsByCityWard = window.CIVICRADAR_SOCIETY_BY_WARD;
  }
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
      'location.bannerNearby': 'Enable location to report hazards and see nearby issues.',
      'location.unavailable': 'Location unavailable in this browser.',
      'location.withdrawn': 'Location consent withdrawn. Enable again when you want to report.',
      'location.dismiss': 'Dismiss location prompt',
      'location.locate': 'Locate me',
      'location.locateAria': 'Turn on location',
      'location.enable': 'Turn on',
      'coach.step': '#MonsoonGuardian · 30 sec', 'coach.title': 'Standing water nearby? Pin it now.',
      'coach.body': 'Tap Report, snap a photo — we pin your ward map.',
      'coach.got': 'Got it',
      'tour.skip': 'Skip tour', 'tour.next': 'Next', 'tour.done': 'Got it',
      'tour.replay': 'Replay tour',
      'tour.map.title': 'Your ward map',
      'tour.map.body': 'Hazard pins show here — tap Me too to back neighbours.',
      'tour.report.title': 'Report in 30 sec',
      'tour.report.body': 'Tap here when you spot stagnant water.',
      'tour.profile.title': 'Profile',
      'tour.profile.body': 'Civic Points and your reports live here.',
      'persona.citizen.idle': '🦟 Monsoon standing water = dengue. Report now — pin your ward map in 30 sec.',
      'persona.wardImpact': '{ward}: {n} monsoon reports — dengue starts in stagnant lanes. #MonsoonGuardian',
      'persona.unfiled': '{n} open on the ward map — share with neighbours or file officially from Profile.',
      'persona.pendingFiled': '{n} open on the ward map — check Profile if overdue.',
      'persona.admin.idlePending': '{n} pending — open the queue or tap red pins.',
      'persona.admin.idleEmpty': 'No pending reports. New citizen pins appear here.',
      'persona.admin.header': 'BMC review mode',
      'persona.admin.exit': 'Exit BMC mode',
      'persona.ngo.header': 'NGO coordinator mode',
      'persona.ngo.exit': 'Exit NGO mode',
      'onboard.title': 'Welcome',
      'onboard.subtitle': 'Report stagnant water on your ward map in 30 sec.',
      'onboard.city': 'Your city',
      'onboard.cityHint': 'We find your ward from GPS next.',
      'onboard.ward': 'Your Ward', 'onboard.wardPh': 'Start typing your ward…',
      'onboard.wardHint': 'Pick from {city}\'s {n} official wards.',
      'onboard.wardDetecting': 'Finding your ward from location…',
      'onboard.wardDetectedHint': 'GPS estimate — not an official survey.',
      'onboard.wardManual': 'Not right? Pick manually',
      'onboard.wardRetry': 'Try again',
      'onboard.wardDetectFailed': 'Ward not found — pick manually or allow location.',
      'onboard.name': 'Display Name', 'onboard.namePh': 'What should neighbours call you?',
      'onboard.join': 'Join your ward',
      'onboard.wardError': 'Pick a ward or allow location.',
      'onboard.society': 'Society / neighbourhood (optional)',
      'onboard.societyPh': 'Type your society / RWA name if not listed',
      'onboard.societyHintNoWard': 'Pick your ward first for local suggestions.',
      'onboard.societyHintWard': 'Showing {n} societies in {ward} — type to add yours.',
      'onboard.societyHintCustom': 'Type your society / RWA name if not listed.',
      'report.title': 'Report a hazard',
      'report.step.photo': 'Photo', 'report.step.details': 'Details', 'report.step.submit': 'Submit',
      'report.hazardType': 'Hazard Type', 'report.photoEvidence': 'Photo',
      'report.capture': 'Take photo',
      'report.notes': 'Notes (optional)', 'report.notesPh': 'Add a note — lane, building, landmark…',
      'report.submit': 'Submit report',
      'report.photoHint': 'Photo shows the hazard? Tap Submit — or retake if not.',
      'report.retake': 'Retake photo',
      'moderation.guidelines': 'Photograph the actual stagnant water — not faces, documents, or unrelated objects. Location data is stripped for privacy.',
      'moderation.scanning': 'Checking photo…',
      'moderation.blocked.fileType': 'Only JPEG, PNG, or WebP hazard photos are allowed.',
      'moderation.blocked.fileSize': 'Photo is too large. Use a smaller image (max 8 MB).',
      'moderation.blocked.lowQuality': 'Photo is too small or unclear. Move closer to the hazard.',
      'moderation.blocked.irrelevant': 'Use a photo of the hazard — not a selfie, document, or blank image.',
      'moderation.blocked.sensitive': 'Avoid IDs, documents, or screenshots. Show the hazard only.',
      'moderation.blocked.nsfw': 'This photo was blocked for inappropriate content.',
      'moderation.blocked.offline': 'Connect to the internet to verify photo safety.',
      'success.title': 'Report logged', 'success.tagline': 'On your ward map',
      'success.taglineNeighbours': '{n} neighbour(s) backing nearby — yours is pinned too!',
      'success.subtitle': 'Optional: file with {corp} for the official clock.',
      'success.file': 'File with BMC (optional)',
      'success.fileCorp': 'File with {corp} (optional)',
      'success.tag': 'Tag @mybmc', 'success.alert': 'Alert neighbours', 'success.done': 'Back to map',
      'success.sharePrompt': 'Share on WhatsApp — more eyes, faster fixes.',
      'success.shareWhatsapp': 'Share on WhatsApp',
      'share.nativeShare': 'Share',
      'success.shareNudge': 'Neighbours may not know — share on WhatsApp?',
      'success.shareMsg': '🦟 {hazard} in {ward} — dengue risk! Pinned on CivicRadar ward map.\nTap Me too and report hazards in your lane:\n{link}\n{hashtags}',
      'share.appMsg': '🗺️ {city} monsoon map — pin stagnant water, tap Me too, beat rival wards!\n{link}\n{hashtags}',
      'share.defaultArea': 'my area',
      'share.meTooMsg': '👋 Me too — I see {hazard} in {ward} too. {n} neighbour(s) backed on CivicRadar:\n{link}\n{hashtags}',
      'share.meTooBtn': 'Share on WhatsApp',
      'share.wardMapMsg': '⚡ {ward}: {pending} open dengue-risk spots — beat us on CivicRadar!\n{link}\n{hashtags}',
      'share.cleanupMsg': '🧹 Volunteers cleared {hazard} in {ward}! Before → after on the ward map:\n{link}\n{hashtags}',
      'share.instagramCaption': '{hazard} spot cleared in {ward} 🎉 Before → After on CivicRadar. Monsoon win.\n{link}\n{hashtags}',
      'share.instagramCleanupCaption': 'Volunteers cleared {hazard} in {ward} 🧹 Before → After on CivicRadar.\n{link}\n{hashtags}',
      'share.milestoneMsg': '🏆 {ward} just hit {n} fixes this monsoon on CivicRadar! Can your ward beat us?\n{link}\n{hashtags}',
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
      'about.sharePitch': 'Free {city} monsoon map — pin stagnant water in 30 sec, say Me too, beat rival wards.\nBuilt for Mumbai, Pune & Thane. No login, 4 languages.\n{link}\nForward to your RWA / society WhatsApp group →',
      'about.copyPitch': 'Copy WhatsApp pitch',
      'about.pitchCopied': 'Pitch copied — paste in your RWA / school group!',
      'pwa.nudge': 'Monsoon season 🌧️ Add CivicRadar to Home Screen — one-tap reporting.',
      'pwa.nudgeAction': 'Add to Home Screen',
      'pwa.nudgeDismiss': 'Not now',
      'community.challengeShare': 'Challenge a friend — share ward map',
      'community.winsTitle': 'Wins this monsoon',
      'community.winsEmpty': 'Fixed spots appear here — report, rally neighbours, celebrate wins.',
      'community.winsNeighbours': 'Neighbours in {ward}',
      'community.winsCleanup': '{hazard} cleared · {ward}',
      'community.winsResolved': '{hazard} fixed · {ward}',
      'success.points': 'Civic Points earned', 'success.weekBonus': '+{n} first report this week!',
      'success.celebrateFirst': 'Shabash — you\'re protecting your ward!',
      'success.celebrateMilestone': '{n} reports — ward hero territory!',
      'success.kudos1': 'Shabash! Another hazard on the radar.',
      'success.kudos2': 'Ward hero — your lane got safer.',
      'success.kudos3': 'Logged! Neighbours noticed.',
      'success.kudos4': 'You showed up again — that\'s how lanes get fixed.',
      'success.kudos5': 'Another pin down — shabash!',
      'success.streakWeek': '{n} report(s) this week — keep it up!',
      'success.badgeUnlock': '🏅 {n} reports — milestone unlocked!',
      'success.progressOne': '1 more report to your next badge.',
      'success.progressMany': '{n} more to your next badge.',
      'success.progressMilestone': 'Badge unlocked! {n} more to go.',
      'success.progressGuardian': '{n} reports — true Monsoon Guardian.',
      'success.shareBrag': 'Helped your ward — tell neighbours on WhatsApp!',
      'success.shareBragFirst': 'First pin! Share now — spread Monsoon Guardian energy.',
      'toast.badgeMonsoon': 'Welcome, Monsoon Guardian! 🛡️',
      'confirm.meTooThanks': '+{n} pts — neighbours noticed! Shabash!',
      'toast.reportMilestone': '{n} reports — keep the momentum going!',
      'map.empty': 'No pins in {ward} yet — be first!',
      'map.emptyEncourage': 'Every pin helps your ward beat dengue this monsoon.',
      'map.emptyHint': 'Photo on the spot · ~30 sec',
      'map.emptyAction': 'Report now',
      'map.emptyShare': 'Invite neighbours',
      'map.emptyRival': '{ward} vs {rival} — {pending} open spots. Report or rally!',
      'home.hero.badge': '#MonsoonGuardian',
      'home.hero.headline': 'Report stagnant water on your ward map',
      'home.hero.subline': 'Monsoon is here — pin stagnant water on the spot: snap a photo, neighbours Me too.',
      'home.hero.benefit1': '30 sec',
      'home.hero.benefit2': 'Me too',
      'home.hero.benefit3': 'Track fixes',
      'home.hero.cta': 'Report now',
      'home.hero.tour': 'Quick tour',
      'home.hero.trust': 'Free · offline · 3 cities · 4 langs',
      'home.hero.dismiss': 'Dismiss',
      'map.legend.pending': 'Open',
      'map.legend.resolved': 'Fixed',
      'map.legend.you': 'You',
      'map.legend.aria': 'Map legend: open, fixed, and your pins',
      'reminder.unfiled': '{n} open — share or file from Profile.',
      'reminder.file': 'File now',
      'reminder.snooze3d': 'Remind in 3 days',
      'reminder.gotIt': 'Got it',
      'reminder.esc7': 'Day {n}+ — ward escalation for {hazard} in {ward}.',
      'reminder.esc14': 'Day {n}+ — zonal escalation for {hazard} in {ward}.',
      'reminder.esc30': 'Day {n}+ — grievance/RTI for {hazard} in {ward}.',
      'reminder.escAction': 'Escalate',
      'reminder.corroboration': '{n} Me too on your {hazard} — more eyes helps.',
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
      'profile.milestoneOne': '1 more report to your next milestone',
      'profile.milestoneMany': '{n} more reports to your next milestone',
      'profile.milestoneMax': 'Monsoon Guardian — keep reporting!',
      'profile.nextStreakBadge': '{n} more week(s) for {badge}',
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
      'community.subtitle': "Fix it together in {ward} — volunteer, pledge supplies, or file with {corp} separately.",
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
      'inquiry.coordBody': 'Lead your RWA/society or ward NGO — see volunteers, match cleanup offers, verify pledge hours. Earn the role with 2 neighbour supports (5 each if co-leads).',
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
      'about.subtitle': 'Community-powered ward map for Mumbai, Pune & Thane — not an anonymous helpline router.',
      'about.impactTitle': 'Community impact', 'about.builtTitle': 'What we built',
      'about.differentTitle': 'What makes CivicRadar different',
      'about.different1': 'Ward map + Me too — not anonymous helpline drops',
      'about.different2': 'Pin first, file officially when you choose',
      'about.different3': 'Offline, no login, 4 languages · Mumbai, Pune & Thane',
      'about.sustainTitle': 'Sustainable & free for citizens',
      'about.sustainBody': 'CivicRadar stays free for residents. Future support comes from local partners — not paywalls on public safety.',
      'about.copyImpact': 'Copy impact summary', 'about.contact': 'Contact us', 'about.contactOperator': 'Contact us', 'about.close': 'Close',
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
      'soon.roadmap': 'More hazard types coming soon — garbage, potholes, and streetlights are live now.',
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
      'reminder.staleCheck': 'Spot near {ward} — still stagnant?',
      'reminder.stillThere': 'Still there',
      'reminder.looksFixed': 'Looks fixed',
      'reminder.addPhoto': 'Add a photo',
      'settings.title': 'Reminders',
      'settings.reminder.label': 'Remind me to report stagnant water nearby',
      'settings.reminder.sub': 'Gentle nudge when you open CivicRadar. No tracking.',
      'settings.reminder.on': 'Reminders on.',
      'settings.reminder.off': 'Reminders off.',
      'settings.reminder.denied': 'Notifications blocked — in-app nudge instead.',
      'notify.report.title': 'Spotted stagnant water today?',
      'notify.report.body': 'If you pass a puddle, clogged drain, or open tank, take 30 seconds to report it.',
      'notify.report.cta': 'Report now',
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
      'confirm.shareResolvedMsg': '✅ FIXED in {ward}! Before → after proof on CivicRadar:\n{link}\n{hashtags}',
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
      'esc.officialHint': 'Suggested category: {hint}',
      'official.title': 'Official channels',
      'official.subtitle': 'Gov apps — CivicRadar does not file for you.',
      'official.alsoFile': 'Also file officially (optional)',
      'official.copyDone': 'Official filing summary copied — paste in the app or portal',
      'official.categoryHint': 'Suggested category: {hint}',
      'official.reportDate': 'Report date',
      'official.photoGuidance': 'Tip: attach your CivicRadar photo in the official app for faster action.',
      'official.marg.label': 'MyBMC MARG',
      'official.marg.small': '114 categories · geo photos',
      'official.swachhata.label': 'Swachhata-MoHUA',
      'official.swachhata.small': 'MoHUA sanitation',
      'official.aaple.label': 'Aaple Sarkar',
      'official.aaple.small': 'Maharashtra grievance portal',
      'official.pmc.label': 'PMC CARE',
      'official.pmc.small': 'Pune corp app',
      'official.tmc.label': 'TMC citizen portal',
      'official.tmc.small': 'thanecity.gov.in',
      'official.bmcWa.label': 'MyBMC WhatsApp',
      'official.bmcWa.small': 'Quick chat filing',
      'official.bmcPortal.label': 'BMC online portal',
      'official.bmcPortal.small': 'portal.mcgm.gov.in',
      'official.hint.marg.stagnant-water': 'Public Health → Pest Control → stagnant water / mosquito breeding',
      'official.hint.marg.garbage': 'Solid Waste Management → garbage / drainage',
      'official.hint.swachhata.garbage': 'Garbage dump',
      'official.hint.swachhata.stagnant-water': 'Choked drain (if drain-related); use BMC/PMC for pest control',
      'official.hint.pmc.stagnant-water': 'Health / mosquito breeding / stagnant water',
      'official.hint.pmc.garbage': 'Solid waste / garbage',
      'official.hint.aaple': 'Select {corp} as local body → Health / Water supply',
      'official.hint.tmc.stagnant-water': 'Water dept or Health dept (mosquito breeding)',
      'success.alsoOfficial': 'Also file officially',
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
      'profile.society': 'Society / neighbourhood (optional)',
      'profile.societyPh': 'Type your society / RWA name if not listed',
      'profile.societyHintWard': 'Showing {n} societies in {ward} — type to add yours.',
      'profile.societyHintNoWard': 'Set your ward for local society suggestions.',
      'profile.societyHintCustom': 'Type your society / RWA name if not listed.',
      'profile.societyRegistry': 'Find your registered cooperative society',
      'map.youAreHere': 'You are here',
      'about.subtitleNamed': 'Community tech for Mumbai, Pune & Thane monsoon — built by {name}, free for citizens.',
      'safety.hide': 'Flag / hide from map',
      'safety.hidden': 'Report hidden from your map.',
      'safety.hideConfirm': 'Hide this pin from your map? (Does not delete the report.)',
      'popup.pending': 'Pending',
      'popup.resolved': 'Resolved',
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
      'toast.linkSent': 'Sign-in link sent — check your inbox.',
      'toast.authEmailFail': 'Could not send sign-in email. Check Supabase SMTP settings and try again.',
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
      'tracking.loading': 'Loading metrics…',
      'tracking.sourceLocal': 'Device + local reports (demo / offline)',
      'tracking.sourceCloud': 'Cloud aggregate (all users)',
      'tracking.sourceCloudFail': 'Cloud metrics unavailable — run v92 tracking SQL in Supabase.',
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
      'about.founderDefault': 'The CivicRadar team',
      'about.teamLabel': 'The CivicRadar team',
      'about.teamRole': 'Community monsoon hazard map',
      'config.contactMissing': '(Contact not configured)',
      'ref.welcomeTitle': 'A neighbour invited you 👋',
      'ref.welcomeBody': '{n} hazard reports already on the {city} map. See open spots in your ward — or pin one in 30 seconds.',
      'ref.welcomeBodyEmpty': 'Be one of the first to map stagnant water in {city} this monsoon — it takes 30 seconds.',
      'ref.welcomeCta': 'See the map',
      'ref.welcomeReport': 'Report a spot',
      'ref.dismiss': 'Dismiss invite',
      'season.monsoonPrep': 'Monsoon season 🌧️ Spot stagnant water on your ward map before it breeds mosquitoes.',
      'season.monsoonPeak': 'Monsoon is here 🌧️ Report stagnant water near you — dengue spreads fast in standing water.',
      'season.ganesh': 'Ganesh Chaturthi 🙏 Keep your ward clean for the festival — report stagnant water near pandals and immersion routes.',
      'season.denguePeak': 'Dengue season ⚠️ Mosquitoes breed in still water. A 30-second report protects your lane.',
      'season.dismiss': 'Dismiss seasonal tip',
      'social.wardWeek': '👥 {n} neighbour(s) reported in {ward} this week',
      'social.wardWeekBacked': '👥 {n} reported · {c} backed in {ward} this week',
      'social.wardWeekEmpty': 'Be the first in {ward} to report this week — neighbours follow leaders.',
      'recap.title': 'Your ward this week',
      'recap.share': 'Share weekly recap',
      'share.weeklyRecap': '📊 {ward} this monsoon week: {reports} new report(s), {resolved} fixed, {backed} backed by neighbours. Join us on CivicRadar 👇\n{link}\n{hashtags}',
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
      'access.roleLabel': 'I am a…',
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
      'access.notePh': 'Ward focus, how you’ll use it, etc.',
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
      'lead.errSelfVote': "You can't vote for yourself.",
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
      'lang.name': 'हिन्दी', 'lang.native': 'हिन्दी',
      'nav.map': 'मानचित्र', 'nav.community': 'समुदाय', 'nav.profile': 'प्रोफ़ाइल',
      'fab.report': 'रिपोर्ट',
      'header.context': 'मानसून खतरा नक्शा — मुंबई, पुणे और ठाणे',
      'header.contextCity': '{city} मानसून — खतरा नक्शा',
      'location.banner': 'सटीक रिपोर्ट के लिए स्थान चालू करें।',
      'location.bannerNearby': 'खतरे रिपोर्ट करने और आस-पास की समस्याएँ देखने के लिए स्थान चालू करें।',
      'location.unavailable': 'इस ब्राउज़र में स्थान उपलब्ध नहीं है।',
      'location.withdrawn': 'स्थान की सहमति वापस ले ली गई। रिपोर्ट करते समय फिर से चालू करें।',
      'location.dismiss': 'स्थान सूचना बंद करें',
      'location.locate': 'मेरा स्थान',
      'location.locateAria': 'स्थान चालू करें',
      'location.enable': 'चालू करें',
      'coach.step': '#MonsoonGuardian · 30 सेक', 'coach.title': 'पास में रुका पानी? अभी पिन करें।',
      'coach.body': 'रिपोर्ट दबाएँ, फ़ोटो लें — वार्ड नक्शे पर पिन।',
      'coach.got': 'चलो',
      'tour.skip': 'टूर छोड़ें', 'tour.next': 'आगे', 'tour.done': 'समझ गया',
      'tour.replay': 'टूर फिर देखें',
      'tour.map.title': 'आपका वार्ड नक्शा',
      'tour.map.body': 'खतरे यहाँ पिन — Me too से पड़ोसियों का साथ।',
      'tour.report.title': '30 सेक में रिपोर्ट',
      'tour.report.body': 'रुका पानी दिखे तो यहाँ दबाएँ।',
      'tour.profile.title': 'प्रोफ़ाइल',
      'tour.profile.body': 'Civic Points और रिपोर्ट यहाँ।',
      'persona.citizen.idle': '🦟 मानसून में रुका पानी = डेंगू। अभी रिपोर्ट — 30 सेक में वार्ड नक्शे पर पिन।',
      'persona.wardImpact': '{ward}: {n} मानसून रिपोर्ट दर्ज — अपनी गली को डेंगू-मुक्त रखें।',
      'persona.unfiled': '{n} खुले खतरे वार्ड मानचित्र पर — पड़ोसियों के साथ साझा करें या प्रोफ़ाइल में आधिकारिक शिकायत दर्ज करें।',
      'persona.pendingFiled': '{n} खुले खतरे पड़ोसियों को दिख रहे हैं — अतिदेय हो तो प्रोफ़ाइल में आगे बढ़ाएँ।',
      'onboard.title': 'स्वागत है',
      'onboard.subtitle': '30 सेक में वार्ड नक्शे पर रुका पानी रिपोर्ट करें।',
      'onboard.ward': 'आपका वार्ड', 'onboard.wardPh': 'अपना वार्ड टाइप करना शुरू करें…',
      'onboard.wardHint': '{city} के {n} आधिकारिक वार्डों में से चुनें।',
      'onboard.city': 'आपका शहर',
      'onboard.cityHint': 'अगला कदम GPS से वार्ड।',
      'city.mumbai': 'मुंबई',
      'city.pune': 'पुणे',
      'city.thane': 'ठाणे',
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
      'report.photoHint': 'फ़ोटो में खतरा दिख रहा? भेजें — नहीं तो फिर लें।',
      'report.retake': 'फिर से फ़ोटो',
      'moderation.guidelines': 'वास्तविक रुके हुए पानी की फ़ोटो लें — चेहरे, दस्तावेज़ या असंबंधित वस्तुएँ नहीं। स्थान डेटा गोपनीयता के लिए हटाया जाता है।',
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
      'success.fileCorp': '{corp} में आधिकारिक शिकायत (वैकल्पिक)',
      'success.tag': '@mybmc को टैग करें', 'success.alert': 'पड़ोसियों को सूचित करें', 'success.done': 'नक्शे पर वापस',
      'success.sharePrompt': 'WhatsApp पर शेयर — ज़्यादा नज़र, जल्दी ठीक।',
      'success.shareWhatsapp': 'WhatsApp पर साझा करें',
      'share.nativeShare': 'साझा करें',
      'success.shareNudge': 'पड़ोसियों को अभी पता नहीं — WhatsApp पर शेयर करें, वार्ड नक्शे पर और नज़रें मदद करती हैं।',
      'success.shareMsg': '🦟 {ward} में {hazard} — डेंगू का खतरा! CivicRadar वार्ड नक्शे पर पिन।\nMe too करें और अपनी गली रिपोर्ट करें:\n{link}\n{hashtags}',
      'share.appMsg': '🗺️ {city} मानसून नक्शा — रुका पानी पिन, Me too बोलें, प्रतिद्वंद्वी वार्ड को हराएँ!\n{link}\n{hashtags}',
      'share.defaultArea': 'मेरे इलाके',
      'share.meTooMsg': '👋 मुझे भी — {ward} में {hazard}। {n} पड़ोसी CivicRadar पर:\n{link}\n{hashtags}',
      'share.meTooBtn': 'WhatsApp पर साझा करें',
      'share.wardMapMsg': '⚡ {ward}: {pending} खुले डेंगू-जोखिम स्पॉट — CivicRadar पर हमें हराओ!\n{link}\n{hashtags}',
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
      'shareWin.impact': '{n} पड़ोसियों ने समर्थन किया · {ward} — यह जीत स्क्रीनशॉट करें! 🏆',
      'about.shareTitle': 'ऐप साझा करें',
      'about.sharePitch': 'मुफ़्त {city} मानसून नक्शा — 30 सेक में रिपोर्ट, Me too, प्रतिद्वंद्वी वार्ड को हराएँ।\nमुंबई, पुणे और ठाणे के लिए बनाया गया। लॉगिन नहीं, 4 भाषाएँ।\n{link}\nRWA / सोसायटी WhatsApp ग्रुप में फॉरवर्ड करें →',
      'about.copyPitch': 'WhatsApp पिच कॉपी करें',
      'about.pitchCopied': 'पिच कॉपी — RWA / स्कूल ग्रुप में पेस्ट करें!',
      'pwa.nudge': 'मानसून 🌧️ होम स्क्रीन पर CivicRadar जोड़ें — एक टैप रिपोर्ट।',
      'pwa.nudgeAction': 'होम स्क्रीन पर जोड़ें',
      'pwa.nudgeDismiss': 'अभी नहीं',
      'community.challengeShare': 'दोस्त को चुनौती — वार्ड नक्शा साझा करें',
      'community.winsTitle': 'इस मानसून की जीत',
      'community.winsEmpty': 'हल की गई जगहें यहाँ दिखेंगी — रिपोर्ट करें, पड़ोसियों को बुलाएँ, जीत मनाएँ।',
      'community.winsNeighbours': '{ward} में पड़ोसी',
      'community.winsCleanup': '{hazard} साफ · {ward}',
      'community.winsResolved': '{hazard} हल · {ward}',
      'success.points': 'सिविक अंक मिले', 'success.weekBonus': '+{n} इस सप्ताह की पहली रिपोर्ट!',
      'success.celebrateFirst': 'शाबाश — आप अपने वार्ड की रक्षा कर रहे हैं!',
      'success.celebrateMilestone': '{n} रिपोर्ट — वार्ड हीरो!',
      'success.kudos1': 'शाबाश! एक और खतरा रडार पर।',
      'success.kudos2': 'वार्ड हीरो — आपकी गली सुरक्षित हुई।',
      'success.kudos3': 'दर्ज! पड़ोसियों ने देखा।',
      'success.kudos4': 'आप फिर आगे आए — इसी तरह गलियाँ ठीक होती हैं।',
      'success.kudos5': 'एक और पिन — शाबाश!',
      'success.streakWeek': 'इस हफ्ते {n} रिपोर्ट — जारी रखें!',
      'success.badgeUnlock': '🏅 {n} रिपोर्ट — माइलस्टोन अनलॉक!',
      'success.progressOne': 'अगले बैज के लिए बस 1 और रिपोर्ट।',
      'success.progressMany': 'अगले बैज के लिए {n} और रिपोर्ट।',
      'success.progressMilestone': 'बैज मिला! अगले के लिए {n} और।',
      'success.progressGuardian': '{n} रिपोर्ट और जारी — सच्चे Monsoon Guardian।',
      'success.shareBrag': 'आपने अपने वार्ड की मदद की — पड़ोसियों को WhatsApp पर बताएँ!',
      'success.shareBragFirst': 'नक्शे पर पहला पिन! अभी शेयर करें — Monsoon Guardian की ऊर्जा फैलती है।',
      'toast.badgeMonsoon': 'स्वागत है, Monsoon Guardian! 🛡️',
      'confirm.meTooThanks': '+{n} अंक — पड़ोसियों ने देखा! शाबाश!',
      'toast.reportMilestone': '{n} रिपोर्ट — जारी रखें!',
      'map.empty': '{ward} में अभी कोई पिन नहीं — पहले बनें!',
      'map.emptyEncourage': 'हर पिन इस मानसून डेंगू से लड़ने में मदद करता है।',
      'map.emptyHint': 'मौके पर फ़ोटो · ~30 सेक',
      'map.emptyAction': 'अभी रिपोर्ट',
      'map.emptyShare': 'WhatsApp पर पड़ोसियों को बुलाएँ',
      'map.emptyRival': '{ward} बनाम {rival} — {pending} खुले स्पॉट। रिपोर्ट या बुलाएँ!',
      'home.hero.badge': '#MonsoonGuardian',
      'home.hero.headline': 'वार्ड नक्शे पर रुका पानी रिपोर्ट करें',
      'home.hero.subline': 'मानसून चालू — जगह पर पिन करें: फ़ोटो लें, पड़ोसी Me too।',
      'home.hero.benefit1': '30 सेक',
      'home.hero.benefit2': 'Me too',
      'home.hero.benefit3': 'ट्रैक',
      'home.hero.cta': 'अभी रिपोर्ट',
      'home.hero.tour': 'छोटा टूर',
      'home.hero.trust': 'मुफ़्त · ऑफ़लाइन · 3 शहर · 4 भाषा',
      'home.hero.dismiss': 'स्वागत कार्ड बंद करें',
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
      'profile.milestoneOne': 'अगले माइलस्टोन के लिए 1 और रिपोर्ट',
      'profile.milestoneMany': 'अगले माइलस्टोन के लिए {n} और रिपोर्ट',
      'profile.milestoneMax': 'Monsoon Guardian — रिपोर्ट जारी रखें!',
      'profile.nextStreakBadge': '{badge} के लिए {n} और हफ्ते',
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
      'about.subtitle': 'मुंबई, पुणे और ठाणे के लिए सामुदायिक वार्ड नक्शा — गुमनाम हेल्पलाइन राउटर नहीं।',
      'about.impactTitle': 'सामुदायिक प्रभाव', 'about.builtTitle': 'हमने क्या बनाया',
      'about.differentTitle': 'CivicRadar अलग क्यों है',
      'about.different1': 'वार्ड नक्शा + Me too — गुमनाम हेल्पलाइन नहीं',
      'about.different2': 'पहले पिन, चाहें तो आधिकारिक दर्ज',
      'about.different3': 'ऑफ़लाइन, बिना लॉगिन, 4 भाषा · मुंबई, पुणे, ठाणे',
      'about.sustainTitle': 'टिकाऊ और नागरिकों के लिए निःशुल्क',
      'about.sustainBody': 'CivicRadar निवासियों के लिए हमेशा निःशुल्क रहेगा। भविष्य की आय नैतिक स्थानीय साझेदारी से आती है — सार्वजनिक सुरक्षा पर पेवॉल नहीं।',
      'about.copyImpact': 'प्रभाव सारांश कॉपी करें', 'about.contact': 'हमसे संपर्क करें', 'about.contactOperator': 'हमसे संपर्क करें', 'about.close': 'बंद',
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
      'soon.roadmap': 'और खतरा प्रकार जल्द — कचरा, गड्ढे और स्ट्रीटलाइट अब लाइव हैं।',
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
      'reminder.staleCheck': '{ward} के पास — अभी भी stagnant?',
      'reminder.stillThere': 'अभी भी है',
      'reminder.looksFixed': 'ठीक लगता है',
      'reminder.addPhoto': 'फ़ोटो जोड़ें',
      'settings.title': 'याद दिलाने वाले',
      'settings.reminder.label': 'पास में रुका पानी रिपोर्ट करने की याद दिलाएँ',
      'settings.reminder.sub': 'जब आप CivicRadar खोलें तो मानसून में हल्की याद। कोई बैकग्राउंड ट्रैकिंग नहीं।',
      'settings.reminder.on': 'याद चालू — जब आप CivicRadar खोलेंगे, हम हल्के से याद दिलाएँगे।',
      'settings.reminder.off': 'याद बंद।',
      'settings.reminder.denied': 'सूचनाएँ ब्लॉक हैं — हम इसके बजाय ऐप में हल्की याद दिखाएँगे।',
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
      'confirm.shareResolvedMsg': '✅ {ward} में ठीक! CivicRadar पर पहले → बाद प्रमाण:\n{link}\n{hashtags}',
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
      'esc.officialHint': 'सुझाई गई श्रेणी: {hint}',
      'official.title': 'आधिकारिक शिकायत चैनल', 'official.subtitle': 'सत्यापित सरकारी ऐप और पोर्टल — CivicRadar आपकी ओर से दर्ज नहीं करता।',
      'official.alsoFile': 'आधिकारिक रूप से भी दर्ज करें (वैकल्पिक)', 'official.copyDone': 'आधिकारिक शिकायत सारांश कॉपी — ऐप/पोर्टल में चिपकाएँ',
      'official.categoryHint': 'सुझाई गई श्रेणी: {hint}', 'official.reportDate': 'रिपोर्ट तिथि',
      'official.photoGuidance': 'टिप: तेज़ कार्रवाई के लिए CivicRadar फोटो आधिकारिक ऐप में संलग्न करें।',
      'official.marg.label': 'MyBMC MARG', 'official.marg.small': '114 श्रेणियाँ · जियो फोटो · ट्रैकिंग',
      'official.swachhata.label': 'Swachhata-MoHUA', 'official.swachhata.small': 'MoHUA स्वच्छता · वार्ड निरीक्षक',
      'official.aaple.label': 'Aaple Sarkar', 'official.aaple.small': 'महाराष्ट्र राज्य शिकायत पोर्टल',
      'official.pmc.label': 'PMC CARE', 'official.pmc.small': 'पुणे नगर निगम ऐप',
      'official.tmc.label': 'TMC नागरिक पोर्टल', 'official.tmc.small': 'thanecity.gov.in',
      'official.bmcWa.label': 'MyBMC WhatsApp', 'official.bmcWa.small': 'त्वरित चैट शिकायत',
      'official.bmcPortal.label': 'BMC ऑनलाइन पोर्टल', 'official.bmcPortal.small': 'portal.mcgm.gov.in',
      'official.hint.marg.stagnant-water': 'Public Health → Pest Control → stagnant water',
      'official.hint.marg.garbage': 'Solid Waste → garbage / drainage',
      'official.hint.swachhata.garbage': 'Garbage dump', 'official.hint.swachhata.stagnant-water': 'Choked drain (if drain-related)',
      'official.hint.pmc.stagnant-water': 'Health / mosquito breeding / stagnant water',
      'official.hint.pmc.garbage': 'Solid waste / garbage',
      'official.hint.aaple': 'स्थानीय निकाय {corp} चुनें → Health / Water',
      'official.hint.tmc.stagnant-water': 'Water / Health dept (mosquito breeding)',
      'success.alsoOfficial': 'आधिकारिक रूप से भी दर्ज करें',
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
      'profile.society': 'सोसाइटी / पड़ोस (वैकल्पिक)',
      'profile.societyPh': 'सूची में न हो तो सोसाइटी / RWA नाम लिखें',
      'profile.societyHintWard': '{ward} में {n} सोसाइटी — अपनी लिखें।',
      'profile.societyHintNoWard': 'स्थानीय सुझाव के लिए वार्ड सेट करें।',
      'profile.societyHintCustom': 'सूची में न हो तो सोसाइटी / RWA नाम लिखें।',
      'profile.societyRegistry': 'अपनी पंजीकृत सहकारी सोसाइटी खोजें',
      'map.youAreHere': 'आप यहाँ हैं',
      'about.subtitleNamed': 'मुंबई, पुणे और ठाणे मानसून — {name} द्वारा, नागरिकों के लिए निःशुल्क।',
      'safety.hide': 'फ़्लैग / छिपाएँ', 'safety.hidden': 'आपके मानचित्र से छिपाया।', 'safety.hideConfirm': 'इस पिन को छिपाएँ? (रिपोर्ट हटती नहीं।)',
      'popup.pending': 'लंबित', 'popup.resolved': 'हल', 'popup.society': 'सोसाइटी / पड़ोस',
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
      'flow.city': 'शहर',
      'flow.ready': 'तैयार',
      'flow.ward': 'वार्ड',
      'inquiry.coordBody': 'अपनी RWA/सोसायटी या वार्ड NGO की अगुवाई करें — स्वयंसेवक देखें, सफ़ाई मिलाएँ, दान घंटे सत्यापित करें। ऑपरेटर से इनवाइट कोड लें।',
      'map.legend.pending': 'खुला',
      'map.legend.resolved': 'ठीक',
      'map.legend.you': 'आप',
      'onboard.wardError': 'सूची से वार्ड चुनें या लोकेशन अनुमति दें।',
      'onboard.society': 'सोसाइटी / पड़ोस (वैकल्पिक)',
      'onboard.societyPh': 'सूची में न हो तो सोसाइटी / RWA नाम लिखें',
      'onboard.societyHintNoWard': 'पहले वार्ड चुनें — फिर स्थानीय सुझाव।',
      'onboard.societyHintWard': '{ward} में {n} सोसाइटी — अपनी लिखें।',
      'onboard.societyHintCustom': 'सूची में न हो तो सोसाइटी / RWA नाम लिखें।',
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
      'toast.linkSent': 'साइन-इन लिंक भेजा — इनबॉक्स देखें।',
      'toast.authEmailFail': 'साइन-इन ईमेल नहीं भेजा जा सका — Supabase SMTP सेटिंग जाँचें और फिर कोशिश करें।',
      'toast.authEmailOffline': 'क्लाउड साइन-इन उपलब्ध नहीं — कनेक्शन जाँचें और फिर कोशिश करें।',
      'toast.authEmailRateLimit': 'बहुत सारे साइन-इन ईमेल — कुछ मिनट रुकें और फिर कोशिश करें।',
      'toast.authEmailInvalid': 'ईमेल पता अमान्य लगता है — जाँचें और फिर कोशिश करें।',
      'toast.authEmailRedirect': 'साइन-इन रीडायरेक्ट URL अनुमत नहीं — Supabase Authentication में अपनी साइट URL जोड़ें।',
      'toast.linkExpired': 'साइन-इन लिंक समाप्त — नया लिंक मांगें।',
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
      'auth.sendCode': 'साइन-इन लिंक भेजें',
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
      'about.founderDefault': 'CivicRadar टीम',
      'about.teamLabel': 'CivicRadar टीम',
      'about.teamRole': 'सामुदायिक मानसून खतरा नक्शा',
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
      'tracking.open': 'एनालिटिक्स और ट्रैकिंग',
      'tracking.title': 'एनालिटिक्स और ट्रैकिंग',
      'tracking.subtitle': 'एकत्रित नागरिक मेट्रिक्स — विज़िट, रिपोर्ट, एस्केलेशन, निराकरण।',
      'tracking.period': 'अवधि',
      'tracking.days7': 'पिछले 7 दिन',
      'tracking.days30': 'पिछले 30 दिन',
      'tracking.days90': 'पिछले 90 दिन',
      'tracking.wardFilter': 'वार्ड',
      'tracking.sessions': 'विज़िट',
      'tracking.pwaInstalls': 'PWA इंस्टॉल',
      'tracking.reports': 'रिपोर्ट',
      'tracking.resolved': 'निराकृत',
      'tracking.pwaNote': 'PWA इंस्टॉल अनुमानित हैं (होम स्क्रीन / standalone)। GitHub Pages पर स्टोर डाउनलोड नहीं मापे जा सकते।',
      'tracking.loading': 'मेट्रिक्स लोड हो रहे…',
      'tracking.sourceLocal': 'डिवाइस + स्थानीय रिपोर्ट (डेमो / ऑफलाइन)',
      'tracking.sourceCloud': 'क्लाउड एकत्र (सभी उपयोगकर्ता)',
      'tracking.sourceCloudFail': 'क्लाउड मेट्रिक्स उपलब्ध नहीं — Supabase में v92 tracking SQL चलाएँ।',
      'tracking.reportsByCategory': 'श्रेणी अनुसार रिपोर्ट',
      'tracking.escalations': 'आधिकारिक चैनल खुलने',
      'tracking.neighbourhoods': 'पड़ोस / सोसाइटी अनुसार',
      'tracking.reporters': 'सक्रिय रिपोर्टर',
      'tracking.meToo': 'मुझे भी',
      'tracking.filed': 'आधिकारिक दर्ज',
      'tracking.leads': 'पड़ोस लीड',
      'tracking.empty': 'इस अवधि में कोई डेटा नहीं।',
      'tracking.pending': 'खुले',
      'tracking.channelUnknown': 'अन्य चैनल',
      'profile.neighbourOne': 'पड़ोसी ने मुझे भी कहा',
      'profile.neighbourMany': 'पड़ोसियों ने मुझे भी कहा',
      'ref.welcomeTitle': 'एक पड़ोसी ने आपको बुलाया 👋',
      'ref.welcomeBody': '{city} के नक्शे पर पहले से {n} रिपोर्ट हैं। अपने वार्ड के खुले स्पॉट देखें — या 30 सेकंड में एक पिन करें।',
      'ref.welcomeBodyEmpty': 'इस मानसून {city} में रुके पानी का नक्शा बनाने वालों में सबसे पहले बनें — सिर्फ़ 30 सेकंड।',
      'ref.welcomeCta': 'नक्शा देखें',
      'ref.welcomeReport': 'स्पॉट रिपोर्ट करें',
      'ref.dismiss': 'निमंत्रण बंद करें',
      'season.monsoonPrep': 'मानसून 🌧️ रुके पानी को नक्शे पर पिन करें — मच्छरों का खतरा टालें।',
      'season.monsoonPeak': 'मानसून आ गया 🌧️ पास का रुका पानी रिपोर्ट करें — डेंगू खड़े पानी में फैलता है।',
      'season.ganesh': 'गणेश चतुर्थी 🙏 त्योहार के लिए अपना वार्ड साफ़ रखें — पंडाल और विसर्जन मार्ग के पास रुका पानी रिपोर्ट करें।',
      'season.denguePeak': 'डेंगू का मौसम ⚠️ मच्छर रुके पानी में पनपते हैं। 30 सेकंड की रिपोर्ट आपकी गली की रक्षा करती है।',
      'season.dismiss': 'मौसमी सुझाव बंद करें',
      'social.wardWeek': '👥 इस सप्ताह {ward} में {n} पड़ोसियों ने रिपोर्ट की',
      'social.wardWeekBacked': '👥 इस सप्ताह {ward} में {n} रिपोर्ट · {c} समर्थन',
      'social.wardWeekEmpty': 'इस सप्ताह {ward} में सबसे पहले रिपोर्ट करें — पड़ोसी नेताओं का अनुसरण करते हैं।',
      'recap.title': 'इस सप्ताह आपका वार्ड',
      'recap.share': 'साप्ताहिक सारांश शेयर करें',
      'share.weeklyRecap': '📊 इस मानसून सप्ताह {ward}: {reports} नई रिपोर्ट, {resolved} ठीक, {backed} पड़ोसियों ने समर्थन किया। CivicRadar पर जुड़ें 👇\n{link}\n{hashtags}',
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
      'access.profileCta': 'NGO व BMC के लिए: समन्वयक एक्सेस का अनुरोध करें',
      'access.partnerCta': 'अभी एक्सेस नहीं है? समन्वयक एक्सेस का अनुरोध करें',
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
      'lead.title': 'समुदायिक अगुवा बनें',
      'lead.subtitle': 'खुद को नामांकित करें — पड़ोसी वोट से भूमिका मिलती है। एडमिन की ज़रूरत नहीं।',
      'lead.step1': 'वार्ड और दायरा चुनें',
      'lead.step2': 'पड़ोसी सहयोग दबाएँ',
      'lead.step3': '2 समर्थन = भूमिका (सह-अगुवा पर 5-5)',
      'lead.roleWard': 'वार्ड NGO अगुवा',
      'lead.roleNbh': 'पड़ोस अगुवा',
      'lead.submit': 'मेरा नामांकन',
      'lead.confirmTitle': 'आप मतदान में हैं!',
      'lead.profileCta': 'वार्ड या पड़ोस अगुवा बनें',
      'lead.partnerCta': 'समुदायिक अगुवा बनें — पड़ोसियों के समर्थन से',
      'lead.communityTitle': 'समुदायिक अगुवे',
      'lead.communityHint': 'सफ़ाई समन्वय के लिए volunteers का समर्थन करें। 2 = भूमिका; प्रतिस्पर्धा में 5-5।',
      'lead.communityEmpty': 'आपके वार्ड में अभी कोई उम्मीदवार नहीं — खुद को नामांकित करें।',
      'lead.becomeCta': 'समुदायिक अगुवा बनें',
      'lead.support': 'सहयोग',
      'lead.supported': 'समर्थित',
      'lead.progress': '{count}/{threshold} समर्थन',
      'lead.progressCoLead': 'सह-अगुवा {count}/{threshold}',
      'lead.tagWard': 'वार्ड अगुवा',
      'lead.tagNbh': 'पड़ोस',
      'lead.you': 'आप',
      'lead.granted': 'सीमा पूरी — समन्वयक एक्सेस अनलॉक!',
    },
      'lang.name': 'मराठी', 'lang.native': 'मराठी',
      'nav.map': 'नकाशा', 'nav.community': 'समुदाय', 'nav.profile': 'प्रोफाइल',
      'fab.report': 'तक्रार',
      'header.context': 'पावसाळ धोका नकाशा — मुंबई, पुणे आणि ठाणे',
      'header.contextCity': '{city} पावसाळ — धोका नकाशा',
      'location.banner': 'अचूक तक्रारीसाठी स्थान चालू करा.',
      'location.bannerNearby': 'धोके नोंदवण्यासाठी आणि जवळपासच्या समस्या पाहण्यासाठी स्थान चालू करा.',
      'location.unavailable': 'या ब्राउझरमध्ये स्थान उपलब्ध नाही.',
      'location.withdrawn': 'स्थान संमती मागे घेतली. तक्रार करताना पुन्हा चालू करा.',
      'location.dismiss': 'स्थान सूचना बंद करा',
      'location.locate': 'माझे स्थान',
      'location.locateAria': 'स्थान चालू करा',
      'location.enable': 'चालू करा',
      'coach.step': '#MonsoonGuardian · 30 सेक', 'coach.title': 'जवळ साचलेले पाणी? आत्ताच पिन करा.',
      'coach.body': 'तक्रार, फोटो — वॉर्ड नकाशावर पिन.',
      'coach.got': 'चला',
      'tour.skip': 'टूर वगळा', 'tour.next': 'पुढे', 'tour.done': 'समजले',
      'tour.replay': 'टूर पुन्हा',
      'tour.map.title': 'तुमचा वॉर्ड नकाशा',
      'tour.map.body': 'धोके इथे पिन — Me too ने शेजाऱ्यांना साथ.',
      'tour.report.title': '30 सेकंदात तक्रार',
      'tour.report.body': 'साचलेले पाणी दिसेल तर इथे दाबा.',
      'tour.profile.title': 'प्रोफाइल',
      'tour.profile.body': 'Civic Points आणि तक्रारी इथे.',
      'persona.citizen.idle': '🦟 पावसाळ्यात साचलेले पाणी = डेंगू. आत्ताच नोंदवा — 30 सेकंदात वॉर्ड नकाशावर.',
      'persona.wardImpact': '{ward}: {n} पावसाळी तक्रारी — डेंगू साचलेल्या लेनमधून सुरू. #MonsoonGuardian',
      'persona.unfiled': '{n} खुले धोके वॉर्ड नकाशावर — शेजाऱ्यांसोबत शेअर करा किंवा प्रोफाइलमध्ये अधिकृत तक्रार नोंदवा.',
      'persona.pendingFiled': '{n} खुले धोके शेजाऱ्यांना दिसत आहेत — मुदत ओलांडल्यास प्रोफाइलमध्ये पुढे न्या.',
      'onboard.title': 'स्वागत',
      'onboard.subtitle': '३० सेकंदात वॉर्ड नकाशावर साचलेले पाणी नोंदवा.',
      'onboard.ward': 'तुमचा वॉर्ड', 'onboard.wardPh': 'तुमचा वॉर्ड टाइप करायला सुरुवात करा…',
      'onboard.wardHint': '{city} च्या {n} अधिकृत वॉर्डांमधून निवडा.',
      'onboard.city': 'तुमचे शहर',
      'onboard.cityHint': 'कुठे राहता ते निवडा — पुढे GPS वरून वॉर्ड शोधू.',
      'city.mumbai': 'मुंबई',
      'city.pune': 'पुणे',
      'city.thane': 'ठाणे',
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
      'report.photoHint': 'फोटो धोका दाखवतो? पाठवा — नाहीतर पुन्हा काढा.',
      'report.retake': 'पुन्हा फोटो',
      'moderation.guidelines': 'प्रत्यक्ष साचलेल्या पाण्याचा फोटो काढा — चेहरे, कागदपत्रे किंवा असंबंधित वस्तू नाहीत. स्थान डेटा गोपनीयतेसाठी काढला जातो.',
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
      'success.fileCorp': '{corp} मध्ये अधिकृत तक्रार (पर्यायी)',
      'success.tag': '@mybmc ला टॅग करा', 'success.alert': 'शेजाऱ्यांना कळवा',       'success.done': 'नकाशावर परत',
      'success.sharePrompt': 'WhatsApp वर शेअर — जास्त नजर, लवकर सोडवणे.',
      'success.shareWhatsapp': 'WhatsApp वर शेअर करा',
      'share.nativeShare': 'शेअर करा',
      'success.shareNudge': 'शेजाऱ्यांना अजून कळले नाही — WhatsApp वर शेअर करा, वॉर्ड नकाशावर अधिक नजर मदत करते.',
      'success.shareMsg': '🦟 {ward} मध्ये {hazard} — डेंगू धोका! CivicRadar वॉर्ड नकाशावर पिन.\nMe too करा आणि तुमची लेन रिपोर्ट करा:\n{link}\n{hashtags}',
      'share.appMsg': '🗺️ {city} पावसाळा नकाशा — साचलेले पाणी पिन, Me too, प्रतिस्पर्धी वॉर्डला हरवा!\n{link}\n{hashtags}',
      'share.defaultArea': 'माझ्या भागात',
      'share.meTooMsg': '👋 मला पण — {ward} मध्ये {hazard}. {n} शेजारी CivicRadar वर:\n{link}\n{hashtags}',
      'share.meTooBtn': 'WhatsApp वर शेअर करा',
      'share.wardMapMsg': '⚡ {ward}: {pending} उघडे डेंगू-धोका स्पॉट — CivicRadar वर आम्हाला हरवा!\n{link}\n{hashtags}',
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
      'shareWin.impact': '{n} शेजाऱ्यांनी पाठिंबा · {ward} — ही विजय स्क्रीनशॉट करा! 🏆',
      'about.shareTitle': 'अ‍ॅप शेअर करा',
      'about.sharePitch': 'मोफत {city} पावसाळा नकाशा — 30 सेकंदात तक्रार, Me too, प्रतिस्पर्धी वॉर्डला हरवा.\nमुंबई, पुणे आणि ठाणेसाठी बांधले. लॉगिन नाही, 4 भाषा.\n{link}\nRWA / सोसायटी WhatsApp ग्रुपला फॉरवर्ड करा →',
      'about.copyPitch': 'WhatsApp पिच कॉपी करा',
      'about.pitchCopied': 'पिच कॉपी — RWA ग्रुपमध्ये पेस्ट करा!',
      'pwa.nudge': 'पावसाळा 🌧️ होम स्क्रीनवर CivicRadar जोडा — एक टॅप नोंद.',
      'pwa.nudgeAction': 'होम स्क्रीनवर जोडा',
      'pwa.nudgeDismiss': 'आत्ता नाही',
      'community.challengeShare': 'मित्राला आव्हान — वॉर्ड नकाशा शेअर करा',
      'community.winsTitle': 'या पावसाळ्यातील विजय',
      'community.winsEmpty': 'सोडवलेले स्पॉट येथे दिसतील — तक्रार करा, शेजाऱ्यांना बोलवा, विजय साजरा करा.',
      'community.winsNeighbours': '{ward} मधील शेजारी',
      'community.winsCleanup': '{hazard} साफ · {ward}',
      'community.winsResolved': '{hazard} सोडवले · {ward}',
      'success.points': 'सिव्हिक गुण मिळाले', 'success.weekBonus': '+{n} या आठवड्याची पहिली तक्रार!',
      'success.celebrateFirst': 'शाब्बास — तुम्ही वॉर्डचे रक्षण करत आहात!',
      'success.celebrateMilestone': '{n} तक्रारी — वॉर्ड हीरो!',
      'success.kudos1': 'शाब्बास! आणखी एक धोका रडारवर.',
      'success.kudos2': 'वॉर्ड हीरो — तुमची लेन सुरक्षित झाली.',
      'success.kudos3': 'नोंदवले! शेजाऱ्यांनी पाहिले.',
      'success.kudos4': 'तुम्ही पुन्हा पुढे आलात — अशाच लेन दुरुस्त होतात.',
      'success.kudos5': 'आणखी एक पिन — शाब्बास!',
      'success.streakWeek': 'या आठवड्यात {n} तक्रार — चालू ठेवा!',
      'success.badgeUnlock': '🏅 {n} तक्रारी — माइलस्टोन अनलॉक!',
      'success.progressOne': 'पुढच्या बॅजसाठी फक्त 1 आणखी तक्रार.',
      'success.progressMany': 'पुढच्या बॅजसाठी {n} आणखी तक्रारी.',
      'success.progressMilestone': 'बॅज मिळाला! पुढच्यासाठी {n} आणखी.',
      'success.progressGuardian': '{n} तक्रारी आणि सुरू — खरे Monsoon Guardian.',
      'success.shareBrag': 'तुम्ही वॉर्डला मदत केली — शेजाऱ्यांना WhatsApp वर सांगा!',
      'success.shareBragFirst': 'नकाशावर पहिला पिन! आत्ताच शेअर करा — Monsoon Guardian ऊर्जा पसरते.',
      'toast.badgeMonsoon': 'स्वागत, Monsoon Guardian! 🛡️',
      'confirm.meTooThanks': '+{n} गुण — शेजाऱ्यांनी पाहिले! शाब्बास!',
      'toast.reportMilestone': '{n} तक्रारी — चालू ठेवा!',
      'map.empty': '{ward} मध्ये अजून पिन नाही — पहिले व्हा!',
      'map.emptyEncourage': 'प्रत्येक पिन या पावसाळ्यात डेंग्यूवर मात करण्यात मदत करतो.',
      'map.emptyHint': 'जागेवर फोटो · ~30 सेक',
      'map.emptyAction': 'आत्ता नोंदवा',
      'map.emptyShare': 'WhatsApp वर शेजाऱ्यांना बोलवा',
      'map.emptyRival': '{ward} विरुद्ध {rival} — {pending} उघडे स्पॉट. नोंदवा किंवा बोलवा!',
      'home.hero.badge': '#MonsoonGuardian',
      'home.hero.headline': 'वॉर्ड नकाशावर साचलेले पाणी नोंदवा',
      'home.hero.subline': 'पावसाळा सुरू — जागी पिन करा: फोटो, Me too.',
      'home.hero.benefit1': '30 सेक',
      'home.hero.benefit2': 'Me too',
      'home.hero.benefit3': 'ट्रॅक',
      'home.hero.cta': 'आत्ता नोंदवा',
      'home.hero.tour': 'छोटा टूर',
      'home.hero.trust': 'मोफत · ऑफलाइन · 3 शहरे · 4 भाषा',
      'home.hero.dismiss': 'स्वागत कार्ड बंद करा',
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
      'profile.milestoneOne': 'पुढच्या माइलस्टोनसाठी 1 आणखी तक्रार',
      'profile.milestoneMany': 'पुढच्या माइलस्टोनसाठी {n} आणखी तक्रारी',
      'profile.milestoneMax': 'Monsoon Guardian — तक्रारी चालू ठेवा!',
      'profile.nextStreakBadge': '{badge} साठी {n} आणखी आठवडे',
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
      'about.subtitle': 'मुंबई, पुणे आणि ठाणेसाठी सामुदायिक वॉर्ड नकाशा — गुप्त हेल्पलाइन राऊटर नाही.',
      'about.impactTitle': 'सामुदायिक प्रभाव', 'about.builtTitle': 'आम्ही काय बांधले',
      'about.differentTitle': 'CivicRadar वेगळे का',
      'about.different1': 'वॉर्ड नकाशा + Me too — गुप्त हेल्पलाइन नाही',
      'about.different2': 'आधी पिन, नंतर अधिकृत नोंद',
      'about.different3': 'ऑफलाइन, लॉगिन नाही, 4 भाषा · मुंबई, पुणे, ठाणे',
      'about.sustainTitle': 'शाश्वत आणि नागरिकांसाठी मोफत',
      'about.sustainBody': 'CivicRadar रहिवाशांसाठी नेहमी मोफत राहील. भविष्यातील उत्पन्न नैतिक स्थानिक भागीदारीतून येते.',
      'about.copyImpact': 'प्रभाव सारांश कॉपी करा', 'about.contact': 'आमच्याशी संपर्क', 'about.contactOperator': 'आमच्याशी संपर्क', 'about.close': 'बंद करा',
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
      'soon.roadmap': 'अधिक धोका प्रकार लवकर — कचरा, खड्डे आणि पथदिवे आता लाइव्ह.',
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
      'reminder.staleCheck': '{ward} जवळ — अजून stagnant?',
      'reminder.stillThere': 'अजून आहे',
      'reminder.looksFixed': 'ठीक दिसते',
      'reminder.addPhoto': 'फोटो जोडा',
      'settings.title': 'आठवणी',
      'settings.reminder.label': 'जवळचे साचलेले पाणी नोंदवण्याची आठवण करा',
      'settings.reminder.sub': 'CivicRadar उघडल्यावर पावसाळ्यात सौम्य आठवण. बॅकग्राउंड ट्रॅकिंग नाही.',
      'settings.reminder.on': 'आठवणी सुरू — तुम्ही CivicRadar उघडाल तेव्हा आम्ही सौम्यपणे आठवण करू.',
      'settings.reminder.off': 'आठवणी बंद.',
      'settings.reminder.denied': 'सूचना ब्लॉक आहेत — त्याऐवजी आम्ही अॅपमध्ये सौम्य आठवण दाखवू.',
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
      'confirm.shareResolvedMsg': '✅ {ward} मध्ये सोडवले! CivicRadar वर आधी → नंतर:\n{link}\n{hashtags}',
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
      'esc.officialHint': 'सुचवलेली श्रेणी: {hint}',
      'official.title': 'अधिकृत तक्रार चॅनेल', 'official.subtitle': 'सत्यापित सरकारी अॅप आणि पोर्टल — CivicRadar तुमच्या वतीने नोंदवत नाही.',
      'official.alsoFile': 'अधिकृतपणेही नोंदवा (पर्यायी)', 'official.copyDone': 'अधिकृत तक्रार सारांश कॉपी — अॅप/पोर्टलमध्ये पेस्ट करा',
      'official.categoryHint': 'सुचवलेली श्रेणी: {hint}', 'official.reportDate': 'अहवाल तारीख',
      'official.photoGuidance': 'टिप: जलद कारवाईसाठी CivicRadar फोटो अधिकृत अॅपमध्ये जोडा.',
      'official.marg.label': 'MyBMC MARG', 'official.marg.small': '114 श्रेण्या · जिओ फोटो · ट्रॅकिंग',
      'official.swachhata.label': 'Swachhata-MoHUA', 'official.swachhata.small': 'MoHUA स्वच्छता · वार्ड निरीक्षक',
      'official.aaple.label': 'Aaple Sarkar', 'official.aaple.small': 'महाराष्ट्र राज्य तक्रार पोर्टल',
      'official.pmc.label': 'PMC CARE', 'official.pmc.small': 'पुणे महानगरपालिका अॅप',
      'official.tmc.label': 'TMC नागरिक पोर्टल', 'official.tmc.small': 'thanecity.gov.in',
      'official.bmcWa.label': 'MyBMC WhatsApp', 'official.bmcWa.small': 'जलद चॅट तक्रार',
      'official.bmcPortal.label': 'BMC ऑनलाइन पोर्टल', 'official.bmcPortal.small': 'portal.mcgm.gov.in',
      'official.hint.marg.stagnant-water': 'Public Health → Pest Control → stagnant water',
      'official.hint.marg.garbage': 'Solid Waste → garbage / drainage',
      'official.hint.swachhata.garbage': 'Garbage dump', 'official.hint.swachhata.stagnant-water': 'Choked drain (if drain-related)',
      'official.hint.pmc.stagnant-water': 'Health / mosquito breeding / stagnant water',
      'official.hint.pmc.garbage': 'Solid waste / garbage',
      'official.hint.aaple': 'स्थानिक संस्था {corp} निवडा → Health / Water',
      'official.hint.tmc.stagnant-water': 'Water / Health dept (mosquito breeding)',
      'success.alsoOfficial': 'अधिकृतपणेही नोंदवा',
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
      'profile.society': 'सोसायटी / परिसर (पर्यायी)',
      'profile.societyPh': 'यादीत नसेल तर सोसायटी / RWA नाव लिहा',
      'profile.societyHintWard': '{ward} मध्ये {n} सोसायटी — तुमची जोडा.',
      'profile.societyHintNoWard': 'स्थानिक सूचनांसाठी वॉर्ड सेट करा.',
      'profile.societyHintCustom': 'यादीत नसेल तर सोसायटी / RWA नाव लिहा.',
      'profile.societyRegistry': 'तुमची नोंदणीकृत सहकारी सोसायटी शोधा',
      'map.youAreHere': 'तुम्ही येथे आहात',
      'about.subtitleNamed': 'मुंबई, पुणे आणि ठाणे पावसाळा — {name} द्वारे, नागरिकांसाठी मोफत.',
      'safety.hide': 'फ्लॅग / लपवा', 'safety.hidden': 'तुमच्या नकाशावरून लपवले.', 'safety.hideConfirm': 'हा पिन लपवायचा? (तक्रार हटत नाही.)',
      'popup.pending': 'प्रलंबित', 'popup.resolved': 'सोडवले', 'popup.society': 'सोसायटी / परिसर',
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
      'flow.city': 'शहर',
      'flow.ready': 'तयार',
      'flow.ward': 'वॉर्ड',
      'inquiry.coordBody': 'RWA/सोसायटी किंवा वॉर्ड NGO चे नेतृत्व करा — स्वयंसेवक पाहा, सफाई जुळवा, देणगी तास सत्यापित करा. ऑपरेटरकडून इनवाइट कोड मागा.',
      'map.legend.pending': 'उघडे',
      'map.legend.resolved': 'निराकरण',
      'map.legend.you': 'तुम्ही',
      'onboard.wardError': 'यादीतून वॉर्ड निवडा किंवा लोकेशन परवानगी द्या.',
      'onboard.society': 'सोसायटी / परिसर (पर्यायी)',
      'onboard.societyPh': 'यादीत नसेल तर सोसायटी / RWA नाव लिहा',
      'onboard.societyHintNoWard': 'प्रथम वॉर्ड निवडा — नंतर स्थानिक सूचना.',
      'onboard.societyHintWard': '{ward} मध्ये {n} सोसायटी — तुमची जोडा.',
      'onboard.societyHintCustom': 'यादीत नसेल तर सोसायटी / RWA नाव लिहा.',
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
      'toast.linkSent': 'साइन-इन लिंक पाठवला — इनबॉक्स पाहा.',
      'toast.authEmailFail': 'साइन-इन ईमेल पाठवता आला नाही — Supabase SMTP सेटिंग्ज तपासा आणि पुन्हा प्रयत्न करा.',
      'toast.authEmailOffline': 'क्लाउड साइन-इन उपलब्ध नाही — कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.',
      'toast.authEmailRateLimit': 'खूप साइन-इन ईमेल — काही मिनिट थांबा आणि पुन्हा प्रयत्न करा.',
      'toast.authEmailInvalid': 'ईमेल पत्ता अवैध वाटतो — तपासा आणि पुन्हा प्रयत्न करा.',
      'toast.authEmailRedirect': 'साइन-इन रीडायरेक्ट URL परवानगी नाही — Supabase Authentication मध्ये तुमची साइट URL जोडा.',
      'toast.linkExpired': 'साइन-इन लिंक कालबाह्य — नवीन लिंक मागा.',
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
      'auth.sendCode': 'साइन-इन लिंक पाठवा',
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
      'about.founderDefault': 'CivicRadar संघ',
      'about.teamLabel': 'CivicRadar संघ',
      'about.teamRole': 'सामुदायिक पावसाळा धोका नकाशा',
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
      'tracking.open': 'अ‍ॅनालिटिक्स आणि ट्रॅकिंग',
      'tracking.title': 'अ‍ॅनालिटिक्स आणि ट्रॅकिंग',
      'tracking.subtitle': 'एकत्रित नागरिक मेट्रिक्स — भेटी, तक्रारी, एस्केलेशन, निराकरण.',
      'tracking.period': 'कालावधी',
      'tracking.days7': 'गेले 7 दिवस',
      'tracking.days30': 'गेले 30 दिवस',
      'tracking.days90': 'गेले 90 दिवस',
      'tracking.wardFilter': 'वार्ड',
      'tracking.sessions': 'भेटी',
      'tracking.pwaInstalls': 'PWA इंस्टॉल',
      'tracking.reports': 'तक्रारी',
      'tracking.resolved': 'निराकृत',
      'tracking.pwaNote': 'PWA इंस्टॉल अंदाजे (होम स्क्रीन / standalone). GitHub Pages वर स्टोअर डाउनलोड मोजता येत नाहीत.',
      'tracking.loading': 'मेट्रिक्स लोड होत आहेत…',
      'tracking.sourceLocal': 'डिव्हाइस + स्थानिक तक्रारी (डेमो / ऑफलाइन)',
      'tracking.sourceCloud': 'क्लाउड एकत्र (सर्व वापरकर्ते)',
      'tracking.sourceCloudFail': 'क्लाउड मेट्रिक्स उपलब्ध नाहीत — Supabase मध्ये v92 tracking SQL चालवा.',
      'tracking.reportsByCategory': 'प्रकारानुसार तक्रारी',
      'tracking.escalations': 'अधिकृत चॅनेल उघडणे',
      'tracking.neighbourhoods': 'परिसर / सोसायटी नुसार',
      'tracking.reporters': 'सक्रिय तक्रारदार',
      'tracking.meToo': 'मला पण',
      'tracking.filed': 'अधिकृत नोंद',
      'tracking.leads': 'परिसर लीड',
      'tracking.empty': 'या कालावधीत डेटा नाही.',
      'tracking.pending': 'उघडे',
      'tracking.channelUnknown': 'इतर चॅनेल',
      'volunteer.neighbourhood': 'परिसर / सोसायटी / लेन',
      'volunteer.subtitle': 'शेजाऱ्यांसोबत एकत्र — सरकारी स्वयंसेवा कार्यक्रम नाही.',
      'volunteer.skill.awareness': 'जागरूकता आणि WhatsApp outreach',
      'volunteer.skill.cleanup': 'साचलेले पाणी साफ करणे',
      'volunteer.skill.pledge': 'देणगी वितरण (साहित्य)',
      'profile.neighbourMany': 'शेजाऱ्यांनी मला पण म्हटले',
      'ref.welcomeTitle': 'एका शेजाऱ्याने तुम्हाला बोलावले 👋',
      'ref.welcomeBody': '{city} नकाशावर आधीच {n} तक्रारी आहेत. तुमच्या वॉर्डमधील खुले स्पॉट पाहा — किंवा 30 सेकंदात एक पिन करा.',
      'ref.welcomeBodyEmpty': 'या पावसाळ्यात {city} मध्ये साचलेल्या पाण्याचा नकाशा करणाऱ्यांत पहिले व्हा — फक्त 30 सेकंद.',
      'ref.welcomeCta': 'नकाशा पाहा',
      'ref.welcomeReport': 'स्पॉट नोंदवा',
      'ref.dismiss': 'आमंत्रण बंद करा',
      'season.monsoonPrep': 'पावसाळा 🌧️ वॉर्ड नकाशावर साचलेले पाणी पिन करा — डासांचा धोका टाळा.',
      'season.monsoonPeak': 'पावसाळा सुरू 🌧️ जवळचे साचलेले पाणी नोंदवा — डेंग्यू साचलेल्या पाण्यात पसरते.',
      'season.ganesh': 'गणेश चतुर्थी 🙏 सणासाठी तुमचा वॉर्ड स्वच्छ ठेवा — मंडप व विसर्जन मार्गाजवळ साचलेले पाणी नोंदवा.',
      'season.denguePeak': 'डेंग्यूचा हंगाम ⚠️ डास साचलेल्या पाण्यात वाढतात. 30 सेकंदांची तक्रार तुमची गल्ली वाचवते.',
      'season.dismiss': 'हंगामी सूचना बंद करा',
      'social.wardWeek': '👥 या आठवड्यात {ward} मध्ये {n} शेजाऱ्यांनी नोंद केली',
      'social.wardWeekBacked': '👥 या आठवड्यात {ward}: {n} नोंदी · {c} पाठिंबा',
      'social.wardWeekEmpty': 'या आठवड्यात {ward} मध्ये पहिली नोंद करा — शेजारी नेत्यांचे अनुसरण करतात.',
      'recap.title': 'या आठवड्यात तुमचा वॉर्ड',
      'recap.share': 'साप्ताहिक आढावा शेअर करा',
      'share.weeklyRecap': '📊 या पावसाळी आठवड्यात {ward}: {reports} नवीन तक्रारी, {resolved} दुरुस्त, {backed} शेजाऱ्यांचा पाठिंबा. CivicRadar वर सामील व्हा 👇\n{link}\n{hashtags}',
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
      'access.profileCta': 'NGO व BMC साठी: समन्वयक प्रवेशाची विनंती करा',
      'access.partnerCta': 'अजून प्रवेश नाही? समन्वयक प्रवेशाची विनंती करा',
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
      'lead.title': 'समुदायिक नेता व्हा',
      'lead.subtitle': 'स्वतः नामांकन — शेजारी मतदानाने भूमिका. प्रशासक नको.',
      'lead.step1': 'वॉर्ड आणि व्याप्ती निवडा',
      'lead.step2': 'शेजारी पाठिंबा देतात',
      'lead.step3': '2 पाठिंबे = भूमिका (सह-नेते 5-5)',
      'lead.roleWard': 'वॉर्ड NGO नेता',
      'lead.roleNbh': 'परिसर नेता',
      'lead.submit': 'माझे नामांकन',
      'lead.confirmTitle': 'तुम्ही मतदानात आहात!',
      'lead.profileCta': 'वॉर्ड किंवा परिसर नेता व्हा',
      'lead.partnerCta': 'समुदायिक नेता व्हा — शेजार्‍यांच्या पाठिंब्याने',
      'lead.communityTitle': 'समुदायिक नेते',
      'lead.communityHint': 'सफाई समन्वयासाठी पाठिंबा द्या. 2 = भूमिका; स्पर्धेत 5-5.',
      'lead.communityEmpty': 'तुमच्या वॉर्डमध्ये अद्याप उमेदवार नाहीत.',
      'lead.becomeCta': 'समुदायिक नेता व्हा',
      'lead.support': 'पाठिंबा',
      'lead.supported': 'पाठिंबा दिला',
      'lead.progress': '{count}/{threshold} पाठिंबे',
      'lead.progressCoLead': 'सह-नेता {count}/{threshold}',
      'lead.tagWard': 'वॉर्ड नेता',
      'lead.tagNbh': 'परिसर',
      'lead.you': 'तुम्ही',
      'lead.granted': 'मर्यादा पूर्ण — समन्वयक प्रवेश अनलॉक!',
    },    gu: {
      'lang.name': 'Gujarati', 'lang.native': 'ગુજરાતી',
      'nav.map': 'નકશો', 'nav.community': 'સમુદાય', 'nav.profile': 'પ્રોફાઇલ',
      'fab.report': 'ફરિયાદ',
      'header.context': 'ચોમાસું જોખમ નકશો — મુંબઈ, પુણે અને ઠાણે',
      'header.contextCity': '{city} ચોમાસું — જોખમ નકશો',
      'location.banner': 'સચોટ ફરિયાદ માટે સ્થાન ચાલુ કરો.',
      'location.bannerNearby': 'જોખમોની ફરિયાદ કરવા અને નજીકની સમસ્યાઓ જોવા માટે સ્થાન ચાલુ કરો.',
      'location.unavailable': 'આ બ્રાઉઝરમાં સ્થાન ઉપલબ્ધ નથી.',
      'location.withdrawn': 'સ્થાન સંમતિ પાછી ખેંચી. ફરિયાદ કરતી વખતે ફરી ચાલુ કરો.',
      'location.dismiss': 'સ્થાન સૂચના બંધ કરો',
      'location.locate': 'મારું સ્થાન',
      'location.locateAria': 'સ્થાન ચાલુ કરો',
      'location.enable': 'ચાલુ કરો',
      'coach.step': '#MonsoonGuardian · 30 સેક', 'coach.title': 'નજીક ભરાયેલું પાણી? હમણાં પિન કરો.',
      'coach.body': 'ફરિયાદ, ફોટો — વોર્ડ નકશા પર પિન.',
      'coach.got': 'ચાલો',
      'tour.skip': 'ટૂર છોડો', 'tour.next': 'આગળ', 'tour.done': 'સમજાઈ ગયું',
      'tour.replay': 'ટૂર ફરી',
      'tour.map.title': 'તમારો વોર્ડ નકશો',
      'tour.map.body': 'જોખમો અહીં પિન — Me too થી પડોશીઓને ટેકો.',
      'tour.report.title': '30 સેકમાં ફરિયાદ',
      'tour.report.body': 'ભરાયેલું પાણી દેખાય તો અહીં દબાવો.',
      'tour.profile.title': 'પ્રોફાઇલ',
      'tour.profile.body': 'Civic Points અને ફરિયાદ અહીં.',
      'persona.citizen.idle': '🦟 ચોમાસામાં ભરાયેલું પાણી = ડેંગુ. હમણાં રિપોર્ટ — 30 સેકમાં વોર્ડ નકશા પર.',
      'persona.wardImpact': '{ward}: {n} ચોમાસુ ફરિયાદ — ડેંગુ સ્થિર ગલીઓમાંથી શરૂ. #MonsoonGuardian',
      'persona.unfiled': '{n} ખુલ્લા જોખમો વોર્ડ નકશા પર — પડોશીઓ સાથે શેર કરો અથવા પ્રોફાઇલમાં અધિકૃત ફરિયાદ નોંધાવો.',
      'persona.pendingFiled': '{n} ખુલ્લા જોખમો પડોશીઓને દેખાય છે — મુદત ઓળંડે તો પ્રોફાઇલમાં આગળ વધારો.',
      'onboard.title': 'સ્વાગત',
      'onboard.subtitle': '૩૦ સેકમાં વોર્ડ નકશા પર ભરાયેલું પાણી રિપોર્ટ કરો.',
      'onboard.ward': 'તમારો વોર્ડ', 'onboard.wardPh': 'તમારો વોર્ડ ટાઈપ કરવાનું શરૂ કરો…',
      'onboard.wardHint': '{city}ના {n} સત્તાવાર વોર્ડમાંથી પસંદ કરો.',
      'onboard.city': 'તમારું શહેર',
      'onboard.cityHint': 'ક્યાં રહો છો પસંદ કરો — પછી GPS થી વોર્ડ શોધીશું.',
      'city.mumbai': 'મુંબઈ',
      'city.pune': 'પુણે',
      'city.thane': 'ઠાણે',
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
      'report.photoHint': 'ફોટો ખતરો બતાવે? મોકલો — નહીં તો ફરી લો.',
      'report.retake': 'ફરી ફોટો',
      'moderation.guidelines': 'ખરેખર ભરાયેલા પાણીનો ફોટો લો — ચહેરા, દસ્તાવેજો કે અસંબંધિત વસ્તુઓ નહીં. સ્થાન ડેટા ગોપનીયતા માટે દૂર કરવામાં આવે છે.',
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
      'success.fileCorp': '{corp} માં અધિકૃત ફરિયાદ (વૈકલ્પિક)',
      'success.tag': '@mybmc ને ટૅગ કરો', 'success.alert': 'પડોશીઓને જાણ કરો',       'success.done': 'નકશા પર પાછા',
      'success.sharePrompt': 'WhatsApp પર શેર — વધુ નજર, ઝડપથી ઠીક.',
      'success.shareWhatsapp': 'WhatsApp પર શેર કરો',
      'share.nativeShare': 'શેર કરો',
      'success.shareNudge': 'પડોશીઓને હજુ ખબર નથી — WhatsApp પર શેર કરો, વોર્ડ નકશા પર વધુ નજર મદદ કરે.',
      'success.shareMsg': '🦟 {ward} માં {hazard} — ડેંગુ જોખમ! CivicRadar વોર્ડ નકશા પર પિન.\nMe too કરો અને તમારી ગલી રિપોર્ટ કરો:\n{link}\n{hashtags}',
      'share.appMsg': '🗺️ {city} ચોમાસું નકશો — ભરાયેલું પાણી પિન, Me too, પ્રતિસ્પર્ધી વોર્ડને હરાવો!\n{link}\n{hashtags}',
      'share.defaultArea': 'મારા વિસ્તારમાં',
      'share.meTooMsg': '👋 મને પણ — {ward} માં {hazard}. {n} પડોશી CivicRadar પર:\n{link}\n{hashtags}',
      'share.meTooBtn': 'WhatsApp પર શેર કરો',
      'share.wardMapMsg': '⚡ {ward}: {pending} ખુલ્લા ડેંગુ-જોખમ સ્પોટ — CivicRadar પર અમને હરાવો!\n{link}\n{hashtags}',
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
      'shareWin.impact': '{n} પડોશીઓએ ટેકો · {ward} — આ જીત સ્ક્રીનશોટ કરો! 🏆',
      'about.shareTitle': 'એપ શેર કરો',
      'about.sharePitch': 'મફત {city} ચોમાસું નકશો — 30 સેકમાં રિપોર્ટ, Me too, પ્રતિસ્પર્ધી વોર્ડને હરાવો.\nમુંબઈ, પુણે અને ઠાણે માટે બનાવ્યું. લોગિન નહીં, 4 ભાષાઓ.\n{link}\nRWA / સોસાયટી WhatsApp ગ્રુપમાં ફોરવર્ડ કરો →',
      'about.copyPitch': 'WhatsApp પિચ કૉપી કરો',
      'about.pitchCopied': 'પિચ કૉપી — RWA ગ્રુપમાં પેસ્ટ કરો!',
      'pwa.nudge': 'ચોમાસું 🌧️ હોમ સ્ક્રીન પર CivicRadar ઉમેરો — એક ટૅપ રિપોર્ટ.',
      'pwa.nudgeAction': 'હોમ સ્ક્રીન પર ઉમેરો',
      'pwa.nudgeDismiss': 'હમણાં નહીં',
      'community.challengeShare': 'મિત્રને પડકાર — વોર્ડ નકશો શેર કરો',
      'community.winsTitle': 'આ ચોમાસાની જીત',
      'community.winsEmpty': 'ઉકેલાયેલા સ્પોટ અહીં દેખાશે — રિપોર્ટ કરો, પડોશીઓને બોલાવો, જીત ઉજવો.',
      'community.winsNeighbours': '{ward} માં પડોશીઓ',
      'community.winsCleanup': '{hazard} સાફ · {ward}',
      'community.winsResolved': '{hazard} ઉકેલાયું · {ward}',
      'success.points': 'સિવિક પોઈન્ટ મળ્યા', 'success.weekBonus': '+{n} આ અઠવાડિયાની પહેલી ફરિયાદ!',
      'success.celebrateFirst': 'શાબાશ — તમે વોર્ડનું રક્ષણ કરો છો!',
      'success.celebrateMilestone': '{n} ફરિયાદો — વોર્ડ હીરો!',
      'success.kudos1': 'શાબાશ! વધુ એક ખતરો રડાર પર.',
      'success.kudos2': 'વોર્ડ હીરો — તમારી લેન સુરક્ષિત થઈ.',
      'success.kudos3': 'નોંધાયું! પડોશીઓએ જોયું.',
      'success.kudos4': 'તમે ફરી આગળ આવ્યા — આ રીતે લેન સુધરે છે.',
      'success.kudos5': 'વધુ એક પિન — શાબાશ!',
      'success.streakWeek': 'આ અઠવાડિયે {n} ફરિયાદ — ચાલુ રાખો!',
      'success.badgeUnlock': '🏅 {n} ફરિયાદો — માઇલસ્ટોન અનલૉક!',
      'success.progressOne': 'આગલા બેજ માટે ફક્ત 1 વધુ ફરિયાદ.',
      'success.progressMany': 'આગલા બેજ માટે {n} વધુ ફરિયાદો.',
      'success.progressMilestone': 'બેજ મળ્યો! આગલા માટે {n} વધુ.',
      'success.progressGuardian': '{n} ફરિયાદો અને ચાલુ — સાચા Monsoon Guardian.',
      'success.shareBrag': 'તમે વોર્ડને મદદ કરી — પડોશીઓને WhatsApp પર કહો!',
      'success.shareBragFirst': 'નકશા પર પહેલું પિન! હમણાં શેર કરો — Monsoon Guardian ઊર્જા ફેલાય.',
      'toast.badgeMonsoon': 'સ્વાગત, Monsoon Guardian! 🛡️',
      'confirm.meTooThanks': '+{n} પોઈન્ટ — પડોશીઓએ જોયું! શાબાશ!',
      'toast.reportMilestone': '{n} ફરિયાદો — ચાલુ રાખો!',
      'map.empty': '{ward} માં હજુ પિન નથી — પહેલા બનો!',
      'map.emptyEncourage': 'દરેક પિન આ ચોમાસામાં ડેંગુ સામે મદદ કરે છે.',
      'map.emptyHint': 'જગ્યા પર ફોટો · ~30 સેક',
      'map.emptyAction': 'હમણાં રિપોર્ટ',
      'map.emptyShare': 'WhatsApp પર પડોશીઓને બોલાવો',
      'map.emptyRival': '{ward} વિ.{rival} — {pending} ખુલ્લા સ્પોટ. રિપોર્ટ કરો!',
      'home.hero.badge': '#MonsoonGuardian',
      'home.hero.headline': 'વોર્ડ નકશા પર ભરાયેલું પાણી રિપોર્ટ કરો',
      'home.hero.subline': 'ચોમાસું શરૂ — જગ્યાએ પિન કરો: ફોટો, Me too.',
      'home.hero.benefit1': '30 સેક',
      'home.hero.benefit2': 'Me too',
      'home.hero.benefit3': 'ટ્રેક',
      'home.hero.cta': 'હમણાં રિપોર્ટ',
      'home.hero.tour': 'ટૂંકો ટૂર',
      'home.hero.trust': 'મફત · ઑફલાઇન · 3 શહેર · 4 ભાષા',
      'home.hero.dismiss': 'સ્વાગત કાર્ડ બંધ કરો',
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
      'profile.milestoneOne': 'આગલા માઇલસ્ટોન માટે 1 વધુ ફરિયાદ',
      'profile.milestoneMany': 'આગલા માઇલસ્ટોન માટે {n} વધુ ફરિયાદો',
      'profile.milestoneMax': 'Monsoon Guardian — રિપોર્ટ ચાલુ રાખો!',
      'profile.nextStreakBadge': '{badge} માટે {n} વધુ અઠવાડિયા',
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
      'about.subtitle': 'મુંબઈ, પુણે અને ઠાણે માટે સામુદાયિક વોર્ડ નકશો — ગુપ્ત હેલ્પલાઇન રાઉટર નહીં.',
      'about.impactTitle': 'સામુદાયિક પ્રભાવ', 'about.builtTitle': 'અમે શું બનાવ્યું',
      'about.differentTitle': 'CivicRadar અલગ કેમ',
      'about.different1': 'વોર્ડ નકશો + Me too — ગુપ્ત હેલ્પલાઇન નહીં',
      'about.different2': 'પહેલા પિન, પછી અધિકૃત નોંધ',
      'about.different3': 'ઑફલાઇન, લૉગિન વગર, 4 ભાષા · મુંબઈ, પુણે, ઠાણે',
      'about.sustainTitle': 'ટકાઉ અને નાગરિકો માટે મફત',
      'about.sustainBody': 'CivicRadar રહેવાસીઓ માટે હંમેશા મફત રહેશે. ભવિષ્યની આવક નૈતિક સ્થાનિક ભાગીદારીમાંથી આવે છે.',
      'about.copyImpact': 'પ્રભાવ સારાંશ કૉપી કરો', 'about.contact': 'અમારો સંપર્ક', 'about.contactOperator': 'અમારો સંપર્ક', 'about.close': 'બંધ',
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
      'soon.roadmap': 'વધુ જોખમ પ્રકારો ટૂંક સમયમાં — કચરો, ખાડા અને સ્ટ્રીટલાઇટ હવે લાઇવ.',
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
      'reminder.staleCheck': '{ward} પાસે — હજુ stagnant?',
      'reminder.stillThere': 'હજુ છે',
      'reminder.looksFixed': 'ઠીક લાગે છે',
      'reminder.addPhoto': 'ફોટો ઉમેરો',
      'settings.title': 'યાદ અપાવનારા',
      'settings.reminder.label': 'નજીકનું ભરાયેલું પાણી ફરિયાદ કરવા યાદ અપાવો',
      'settings.reminder.sub': 'CivicRadar ખોલો ત્યારે ચોમાસામાં હળવી યાદ. કોઈ બેકગ્રાઉન્ડ ટ્રેકિંગ નહીં.',
      'settings.reminder.on': 'યાદ ચાલુ — તમે CivicRadar ખોલશો ત્યારે અમે હળવેથી યાદ અપાવીશું.',
      'settings.reminder.off': 'યાદ બંધ.',
      'settings.reminder.denied': 'સૂચનાઓ બ્લોક છે — તેના બદલે અમે એપમાં હળવી યાદ બતાવીશું.',
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
      'confirm.shareResolvedMsg': '✅ {ward} માં ઠીક! CivicRadar પર પહેલાં → પછી:\n{link}\n{hashtags}',
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
      'esc.officialHint': 'સૂચિત શ્રેણી: {hint}',
      'official.title': 'અધિકૃત ફરિયાદ ચેનલ', 'official.subtitle': 'ચકાસેલ સરકારી એપ અને પોર્ટલ — CivicRadar તમારી તરફથી નોંધાવતું નથી.',
      'official.alsoFile': 'અધિકૃત રીતે પણ નોંધાવો (વૈકલ્પિક)', 'official.copyDone': 'અધિકૃત ફરિયાદ સારાંશ કૉપી — એપ/પોર્ટલમાં પેસ્ટ કરો',
      'official.categoryHint': 'સૂચિત શ્રેણી: {hint}', 'official.reportDate': 'રિપોર્ટ તારીખ',
      'official.photoGuidance': 'ટિપ: ઝડપી કાર્યવાહી માટે CivicRadar ફોટો અધિકૃત એપમાં જોડો.',
      'official.marg.label': 'MyBMC MARG', 'official.marg.small': '114 શ્રેણીઓ · જીઓ ફોટો · ટ્રેકિંગ',
      'official.swachhata.label': 'Swachhata-MoHUA', 'official.swachhata.small': 'MoHUA સ્વચ્છતા · વોર્ડ નિરીક્ષક',
      'official.aaple.label': 'Aaple Sarkar', 'official.aaple.small': 'મહારાષ્ટ્ર રાજ્ય ફરિયાદ પોર્ટલ',
      'official.pmc.label': 'PMC CARE', 'official.pmc.small': 'પુણે મહાનગરપાલિકા એપ',
      'official.tmc.label': 'TMC નાગરિક પોર્ટલ', 'official.tmc.small': 'thanecity.gov.in',
      'official.bmcWa.label': 'MyBMC WhatsApp', 'official.bmcWa.small': 'ઝડપી ચેટ ફરિયાદ',
      'official.bmcPortal.label': 'BMC ઑનલાઇન પોર્ટલ', 'official.bmcPortal.small': 'portal.mcgm.gov.in',
      'official.hint.marg.stagnant-water': 'Public Health → Pest Control → stagnant water',
      'official.hint.marg.garbage': 'Solid Waste → garbage / drainage',
      'official.hint.swachhata.garbage': 'Garbage dump', 'official.hint.swachhata.stagnant-water': 'Choked drain (if drain-related)',
      'official.hint.pmc.stagnant-water': 'Health / mosquito breeding / stagnant water',
      'official.hint.pmc.garbage': 'Solid waste / garbage',
      'official.hint.aaple': 'સ્થાનિક સંસ્થા {corp} પસંદ કરો → Health / Water',
      'official.hint.tmc.stagnant-water': 'Water / Health dept (mosquito breeding)',
      'success.alsoOfficial': 'અધિકૃત રીતે પણ નોંધાવો',
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
      'profile.society': 'સોસાયટી / પડોશ (વૈકલ્પિક)',
      'profile.societyPh': 'યાદીમાં ન હોય તો સોસાયટી / RWA નામ લખો',
      'profile.societyHintWard': '{ward} માં {n} સોસાયટી — તમારી ઉમેરો.',
      'profile.societyHintNoWard': 'સ્થાનિક સૂચનો માટે વોર્ડ સેટ કરો.',
      'profile.societyHintCustom': 'યાદીમાં ન હોય તો સોસાયટી / RWA નામ લખો.',
      'profile.societyRegistry': 'તમારી નોંધાયેલ સહકારી સોસાયટી શોધો',
      'map.youAreHere': 'તમે અહીં છો',
      'about.subtitleNamed': 'મુંબઈ, પુણે અને ઠાણે ચોમાસું — {name} દ્વારા, નાગરિકો માટે મફત.',
      'safety.hide': 'ફ્લેગ / છુપાવો', 'safety.hidden': 'તમારા નકશાથી છુપાવ્યું.', 'safety.hideConfirm': 'આ પિન છુપાવીએ? (ફરિયાદ ડિલીટ નથી.)',
      'popup.pending': 'બાકી', 'popup.resolved': 'ઉકેલાયું', 'popup.society': 'સોસાયટી / પડોશ',
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
      'flow.city': 'શહેર',
      'flow.ready': 'તૈયાર',
      'flow.ward': 'વોર્ડ',
      'inquiry.coordBody': 'RWA/સોસાયટી અથવા વોર્ડ NGO નું નેતૃત્વ કરો — સ્વયંસેવક જુઓ, સફાઈ મેળવો, દાન કલાક ચકાસો. ઑપરેટર પાસેથી ઇનવાઇટ કોડ માંગો.',
      'map.legend.pending': 'ખુલ્લા',
      'map.legend.resolved': 'ઉકેલાયા',
      'map.legend.you': 'તમે',
      'onboard.wardError': 'યાદીમાંથી વોર્ડ પસંદ કરો અથવા લોકેશન મંજૂરી આપો.',
      'onboard.society': 'સોસાયટી / પડોશ (વૈકલ્પિક)',
      'onboard.societyPh': 'યાદીમાં ન હોય તો સોસાયટી / RWA નામ લખો',
      'onboard.societyHintNoWard': 'પહેલા વોર્ડ પસંદ કરો — પછી સ્થાનિક સૂચનો.',
      'onboard.societyHintWard': '{ward} માં {n} સોસાયટી — તમારી ઉમેરો.',
      'onboard.societyHintCustom': 'યાદીમાં ન હોય તો સોસાયટી / RWA નામ લખો.',
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
      'toast.linkSent': 'સાઇન-ઇન લિંક મોકલ્યું — ઇનબૉક્સ જુઓ.',
      'toast.authEmailFail': 'સાઇન-ઇન ઇમેઇલ મોકલી શકાઈ નહીં — Supabase SMTP સેટિંગ્સ તપાસો અને ફરી પ્રયાસ કરો.',
      'toast.authEmailOffline': 'ક્લાઉડ સાઇન-ઇન ઉપલબ્ધ નથી — કનેક્શન તપાસો અને ફરી પ્રયાસ કરો.',
      'toast.authEmailRateLimit': 'ઘણા બધા સાઇન-ઇન ઇમેઇલ — થોડી મિનિટ રાહ જુઓ અને ફરી પ્રયાસ કરો.',
      'toast.authEmailInvalid': 'ઇમેઇલ સરનામું અમાન્ય લાગે છે — તપાસો અને ફરી પ્રયાસ કરો.',
      'toast.authEmailRedirect': 'સાઇન-ઇન રીડાયરેક્ટ URL મંજૂર નથી — Supabase Authentication માં તમારી સાઇટ URL ઉમેરો.',
      'toast.linkExpired': 'સાઇન-ઇન લિંક સમાપ્ત — નવી લિંક માગો.',
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
      'auth.sendCode': 'સાઇન-ઇન લિંક મોકલો',
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
      'about.founderDefault': 'CivicRadar ટીમ',
      'about.teamLabel': 'CivicRadar ટીમ',
      'about.teamRole': 'સામુદાયિક ચોમાસા જોખમ નકશો',
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
      'tracking.open': 'એનાલિટિક્સ અને ટ્રેકિંગ',
      'tracking.title': 'એનાલિટિક્સ અને ટ્રેકિંગ',
      'tracking.subtitle': 'એકત્રિત નાગરિક મેટ્રિક્સ — મુલાકાત, રિપોર્ટ, એસ્કેલેશન, નિરાકરણ.',
      'tracking.period': 'સમયગાળો',
      'tracking.days7': 'છેલ્લા 7 દિવસ',
      'tracking.days30': 'છેલ્લા 30 દિવસ',
      'tracking.days90': 'છેલ્લા 90 દિવસ',
      'tracking.wardFilter': 'વોર્ડ',
      'tracking.sessions': 'મુલાકાત',
      'tracking.pwaInstalls': 'PWA ઇન્સ્ટોલ',
      'tracking.reports': 'રિપોર્ટ',
      'tracking.resolved': 'ઉકેલાયા',
      'tracking.pwaNote': 'PWA ઇન્સ્ટોલ અંદાજિત (હોમ સ્ક્રીન / standalone). GitHub Pages પર સ્ટોર ડાઉનલોડ માપી શકાતા નથી.',
      'tracking.loading': 'મેટ્રિક્સ લોડ થઈ રહ્યા…',
      'tracking.sourceLocal': 'ઉપકરણ + સ્થાનિક રિપોર્ટ (ડેમો / ઑફલાઇન)',
      'tracking.sourceCloud': 'ક્લાઉડ એગ્રિગેટ (બધા વપરાશકર્તા)',
      'tracking.sourceCloudFail': 'ક્લાઉડ મેટ્રિક્સ ઉપલબ્ધ નથી — Supabase માં v92 tracking SQL ચલાવો.',
      'tracking.reportsByCategory': 'શ્રેણી પ્રમાણે રિપોર્ટ',
      'tracking.escalations': 'અધિકૃત ચેનલ ખોલવા',
      'tracking.neighbourhoods': 'પડોશ / સોસાયટી પ્રમાણે',
      'tracking.reporters': 'સક્રિય રિપોર્ટર',
      'tracking.meToo': 'મને પણ',
      'tracking.filed': 'અધિકૃત દાખલ',
      'tracking.leads': 'પડોશ લીડ',
      'tracking.empty': 'આ સમયગાળામાં ડેટા નથી.',
      'tracking.pending': 'ખુલ્લા',
      'tracking.channelUnknown': 'અન્ય ચેનલ',
      'volunteer.neighbourhood': 'પડોશ / સોસાયટી / ગલી',
      'volunteer.subtitle': 'પડોશીઓ સાથે મળીને — સરકારી સ્વયંસેવક કાર્યક્રમ નથી.',
      'volunteer.skill.awareness': 'જાગૃતિ અને WhatsApp outreach',
      'volunteer.skill.cleanup': 'ભરાયેલું પાણી સાફ કરવું',
      'volunteer.skill.pledge': 'દાન વિતરણ (સામગ્રી)',
      'profile.neighbourMany': 'પડોશીઓએ મને પણ કહ્યું',
      'ref.welcomeTitle': 'એક પડોશીએ તમને આમંત્રણ આપ્યું 👋',
      'ref.welcomeBody': '{city} નકશા પર પહેલેથી {n} ફરિયાદ છે. તમારા વોર્ડના ખુલ્લા સ્પોટ જુઓ — અથવા 30 સેકન્ડમાં એક પિન કરો.',
      'ref.welcomeBodyEmpty': 'આ ચોમાસામાં {city} માં ભરાયેલા પાણીનો નકશો બનાવનારાઓમાં પહેલા બનો — માત્ર 30 સેકન્ડ.',
      'ref.welcomeCta': 'નકશો જુઓ',
      'ref.welcomeReport': 'સ્પોટ નોંધો',
      'ref.dismiss': 'આમંત્રણ બંધ કરો',
      'season.monsoonPrep': 'ચોમાસું 🌧️ વોર્ડ નકશા પર ભરાયેલું પાણી પિન કરો — મચ્છરોનો જોખમ ટાળો.',
      'season.monsoonPeak': 'ચોમાસું શરૂ 🌧️ નજીકનું ભરાયેલું પાણી નોંધો — ડેંગ્યુ ઊભા પાણીમાં ફેલાય છે.',
      'season.ganesh': 'ગણેશ ચતુર્થી 🙏 તહેવાર માટે તમારો વોર્ડ સ્વચ્છ રાખો — પંડાલ અને વિસર્જન માર્ગ પાસે ભરાયેલું પાણી નોંધો.',
      'season.denguePeak': 'ડેન્ગ્યુની મોસમ ⚠️ મચ્છર ભરાયેલા પાણીમાં ઊછરે છે. 30 સેકન્ડની ફરિયાદ તમારી ગલીને બચાવે છે.',
      'season.dismiss': 'મોસમી સૂચન બંધ કરો',
      'social.wardWeek': '👥 આ અઠવાડિયે {ward} માં {n} પડોશીઓએ નોંધ્યું',
      'social.wardWeekBacked': '👥 આ અઠવાડિયે {ward}: {n} નોંધ · {c} સમર્થન',
      'social.wardWeekEmpty': 'આ અઠવાડિયે {ward} માં પહેલા નોંધો — પડોશીઓ આગેવાનોને અનુસરે છે.',
      'recap.title': 'આ અઠવાડિયે તમારો વોર્ડ',
      'recap.share': 'સાપ્તાહિક સારાંશ શેર કરો',
      'share.weeklyRecap': '📊 આ ચોમાસા અઠવાડિયે {ward}: {reports} નવી ફરિયાદ, {resolved} ઠીક, {backed} પડોશીઓનું સમર્થન. CivicRadar પર જોડાઓ 👇\n{link}\n{hashtags}',
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
      'access.profileCta': 'NGO અને BMC માટે: સંયોજક ઍક્સેસ માટે વિનંતી કરો',
      'access.partnerCta': 'હજુ ઍક્સેસ નથી? સંયોજક ઍક્સેસ માટે વિનંતી કરો',
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
      'lead.title': 'સમુદાયિક નેતા બનો',
      'lead.subtitle': 'પોતાનું નામાંકન — પડોશી મતથી ભૂમિકા. એડમિન જરૂર નહીં.',
      'lead.step1': 'વોર્ડ અને વ્યાપ્તિ પસંદ કરો',
      'lead.step2': 'પડોશી સહાય દબાવે',
      'lead.step3': '2 સહાય = ભૂમિકા (સહ-નેતા 5-5)',
      'lead.roleWard': 'વોર્ડ NGO નેતા',
      'lead.roleNbh': 'પડોશ નેતા',
      'lead.submit': 'મારું નામાંકન',
      'lead.confirmTitle': 'તમે મતપેટી પર છો!',
      'lead.profileCta': 'વોર્ડ અથવા પડોશ નેતા બનો',
      'lead.partnerCta': 'સમુદાયિક નેતા બનો — પડોશીઓના સમર્થનથી',
      'lead.communityTitle': 'સમુદાયિક નેતાઓ',
      'lead.communityHint': 'સફાઈ સંકલન માટે સહાય કરો. 2 = ભૂમિકા; સ્પર્ધામાં 5-5.',
      'lead.communityEmpty': 'તમારા વોર્ડમાં હજી ઉમેદવાર નથી.',
      'lead.becomeCta': 'સમુદાયિક નેતા બનો',
      'lead.support': 'સહાય',
      'lead.supported': 'સહાય કરી',
      'lead.progress': '{count}/{threshold} સહાય',
      'lead.progressCoLead': 'સહ-નેતા {count}/{threshold}',
      'lead.tagWard': 'વોર્ડ નેતા',
      'lead.tagNbh': 'પડોશ',
      'lead.you': 'તમે',
      'lead.granted': 'થreshold પૂર્ણ — સંયોજક ઍક્સેસ અનલૉક!',
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
      if ($('#hazardGrid')) renderHazardPicker();
      if (activeEscalationId) {
        const escReport = findReportById(activeEscalationId);
        if (escReport) renderEscalation(escReport);
      }
      if (overlays.success && overlays.success.classList.contains('open')) refreshSuccessModalStrings();
      if (overlays.community && overlays.community.classList.contains('open')) {
        renderImpactWall();
        renderSuccessStories();
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
      society: '',
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
      society: sanitizeText(r.society || '', 120),
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
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
        updateSyncStatus();
        applyLocalLeadGrants();
        return false; // local-only mode
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
          const { data, error } = await this.client.auth.signInAnonymously();
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
        showToast(t('toast.syncConnected'), 'success', 3000);
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
        society: r.society || null,
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
      // Passwordless email sign-in. Default Supabase templates send magic links
      // (ConfirmationURL); OTP codes need custom SMTP + {{ .Token }} in the template.
      // emailRedirectTo must match Authentication → URL Configuration redirect allowlist.
      if (!this.enabled || !this.client) {
        return { data: null, error: { message: 'offline', code: 'backend_offline' } };
      }
      const publicUrl = ((window.CIVICRADAR_CONFIG || {}).publicUrl || '').replace(/\/$/, '');
      try {
        return await this.client.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            ...(publicUrl ? { emailRedirectTo: publicUrl } : {}),
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
      HIDDEN_REPORTS_KEY, WEEK_BONUS_KEY, INTEREST_KEY, COACH_KEY, TOUR_KEY,
      PLEDGE_STATUS_SNAPSHOT_KEY, PLEDGE_POINTS_CREDITED_KEY,
      REMINDER_NGO_PLEDGES_LAST_SEEN_KEY,
      VOLUNTEER_SIGNUPS_KEY, VOLUNTEER_TASKS_KEY,
      LOCBANNER_SNOOZE_KEY,
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
    showLocationBanner(t('location.withdrawn'));
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
      `Project: ${t('about.teamLabel')}`,
      f.tagline || 'Community-driven civic hazard reporting for Mumbai, Pune, and Thane.',
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

  /* ---------- In-app feedback (Supabase-backed, offline-safe) ---------- */
  const FEEDBACK_PENDING_KEY = 'civicradar_feedback_pending';

  function getPendingFeedback() {
    try { return JSON.parse(localStorage.getItem(FEEDBACK_PENDING_KEY) || '[]'); }
    catch { return []; }
  }

  function savePendingFeedback(list) {
    try { localStorage.setItem(FEEDBACK_PENDING_KEY, JSON.stringify(list.slice(-50))); }
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
    try { localStorage.setItem(ACCESS_LOCAL_KEY, JSON.stringify(list.slice(-100))); }
    catch { /* storage full — non-fatal */ }
  }
  function getPendingAccessSync() {
    try { return JSON.parse(localStorage.getItem(ACCESS_SYNC_KEY) || '[]'); }
    catch { return []; }
  }
  function savePendingAccessSync(list) {
    try { localStorage.setItem(ACCESS_SYNC_KEY, JSON.stringify(list.slice(-50))); }
    catch { /* non-fatal */ }
  }

  function genClaimCodeLocal() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let s = '';
    for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return 'CR-' + s;
  }

  // Friendly request role → operational profile role used everywhere else.
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
    wardInput.setAttribute('list', wardDatalistId(sel.value));
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
    const ngoRadio = $('#accessForm input[name="accessRole"][value="bmc_official"]');
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
        const idx = list.findIndex((r) => r.claim_code === code && r.status === 'approved');
        if (idx === -1) {
          const usedIdx = list.findIndex((r) => r.claim_code === code && r.claimed_at);
          if (errEl) {
            errEl.textContent = usedIdx !== -1 ? t('access.claimErrUsed') : t('access.claimErrInvalid');
            errEl.classList.remove('hidden');
          }
          return;
        }
        const req = list[idx];
        req.claimed_at = new Date().toISOString();
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
    try { localStorage.setItem(LEAD_NOM_LOCAL_KEY, JSON.stringify(list.slice(-200))); }
    catch { /* non-fatal */ }
  }
  function getLocalLeadVotes() {
    try { return JSON.parse(localStorage.getItem(LEAD_VOTES_LOCAL_KEY) || '[]'); }
    catch { return []; }
  }
  function saveLocalLeadVotes(list) {
    try { localStorage.setItem(LEAD_VOTES_LOCAL_KEY, JSON.stringify(list.slice(-500))); }
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
    wardInput.setAttribute('list', wardDatalistId(sel.value));
  }

  function syncLeadNomNeighbourhoodVisibility() {
    const checked = $('#leadNomForm input[name="leadRoleType"]:checked');
    const roleType = (checked && checked.value) || 'ngo_ward';
    const group = $('#leadNomNeighbourhoodGroup');
    if (group) group.classList.toggle('hidden', roleType !== 'neighbourhood');
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
    const meta = [n.org_name, n.neighbourhood_label].filter(Boolean).map((m) => escapeHtml(m)).join(' · ');
    const voted = !!n.i_voted;
    let action = '';
    if (isMine) {
      action = `<span class="lead-candidate__tag">${escapeHtml(t('lead.you'))}</span>`;
    } else if (voted) {
      action = `<button type="button" class="btn btn--outline btn--sm btn--support" disabled><i class="ph ph-check"></i> ${escapeHtml(t('lead.supported'))}</button>`;
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
    const contact = [req.contact_email, req.contact_phone].filter(Boolean).join(' · ');
    const meta = [req.org_name, req.ward, (CITIES[req.city] && CITIES[req.city].label) || req.city]
      .filter(Boolean).map((m) => escapeHtml(m)).join(' · ');
    const status = req.status || 'pending';
    let actions = '';
    if (status === 'pending') {
      actions = `
        <div class="access-req__actions">
          <button type="button" class="btn btn--primary btn--sm" data-access-action="approve" data-access-id="${escapeHtml(req.id)}">
            <i class="ph ph-check"></i> ${escapeHtml(t('access.approve'))}
          </button>
          <button type="button" class="btn btn--outline btn--sm" data-access-action="reject" data-access-id="${escapeHtml(req.id)}">
            <i class="ph ph-x"></i> ${escapeHtml(t('access.reject'))}
          </button>
        </div>`;
    } else if (status === 'approved' && req.claim_code) {
      actions = `
        <div class="access-req__code">
          <code class="claim-code">${escapeHtml(req.claim_code)}</code>
          <button type="button" class="btn btn--outline btn--sm" data-access-action="copy" data-access-code="${escapeHtml(req.claim_code)}">
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
    $('#founderName').textContent = FOUNDER.name || t('about.teamLabel');
    $('#founderRole').textContent = FOUNDER.role || FOUNDER.tagline || t('about.teamRole');
    const schoolLoc = [FOUNDER.school, FOUNDER.location].filter(Boolean).join(' · ');
    const schoolEl = $('#founderSchool');
    if (schoolEl) {
      schoolEl.textContent = schoolLoc;
      schoolEl.hidden = !schoolLoc;
    }
    $('#founderStory').textContent = FOUNDER.story || '';
    const opEl = $('#founderOperator');
    if (opEl) {
      if (FOUNDER.operatorName && FOUNDER.name) {
        opEl.textContent = t('about.operatorNote')
          .replace('{name}', FOUNDER.name)
          .replace('{operator}', FOUNDER.operatorName);
        opEl.hidden = false;
      } else {
        opEl.hidden = true;
        opEl.textContent = '';
      }
    }
    const aboutSub = $('#aboutSubtitle');
    if (aboutSub) {
      aboutSub.textContent = t('about.subtitle');
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
        contactLabel.textContent = t('about.contact');
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

  function getReportConfettiIntensity(reportCount) {
    if (reportCount === 1 || REPORT_CELEBRATION_MILESTONES.includes(reportCount)) return 'celebrate';
    if (reportCount >= 5) return 'normal';
    return 'mini';
  }

  function animateSuccessPoints(el, earned, weekBonus) {
    if (!el) return;
    const label = escapeHtml(t('success.points'));
    const bonusHtml = weekBonus > 0
      ? `<span class="success-points__bonus">${escapeHtml(t('success.weekBonus').replace('{n}', String(weekBonus)))}</span>`
      : '';
    el.classList.remove('hidden', 'is-animating');
    if (prefersReducedMotion()) {
      el.innerHTML = `+${earned} <span class="success-points__label">${label}</span>${bonusHtml}`;
      return;
    }
    const duration = 720;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(earned * eased);
      el.innerHTML = `+${val} <span class="success-points__label">${label}</span>${bonusHtml}`;
      if (p < 1) requestAnimationFrame(tick);
      else el.classList.add('is-animating');
    }
    requestAnimationFrame(tick);
  }

  function pulseUserPin(reportId) {
    if (prefersReducedMotion()) return;
    const marker = reportMarkerMap.get(reportId);
    if (!marker) return;
    const el = marker.getElement?.();
    if (el) {
      el.classList.remove('marker-pin-drop');
      void el.offsetWidth;
      el.classList.add('marker-pin-drop');
      setTimeout(() => el.classList.remove('marker-pin-drop'), 900);
    }
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
    try { localStorage.setItem(REPORT_REMINDER_OPTIN_KEY, enabled ? '1' : '0'); } catch {}
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
    let perm = 'default';
    try { perm = Notification.permission; } catch {}
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
        req.then((result) => {
          showToast(
            result === 'granted' ? t('settings.reminder.on') : t('settings.reminder.denied'),
            result === 'granted' ? 'success' : 'info',
            result === 'granted' ? 3600 : 4200
          );
        }).catch(() => showToast(t('settings.reminder.on'), 'success', 3600));
      } else {
        showToast(t('settings.reminder.on'), 'success', 3600);
      }
    } catch {
      showToast(t('settings.reminder.on'), 'success', 3600);
    }
  }

  function isReportReminderDue() {
    if (isReminderSnoozed(REPORT_REMINDER_SNOOZE_KEY)) return false;
    const last = localStorage.getItem(REPORT_REMINDER_LAST_KEY);
    if (!last) return true;
    return Date.now() - new Date(last).getTime() >= REPORT_REMINDER_DAYS * 86400000;
  }

  function markReportReminderShown() {
    try { localStorage.setItem(REPORT_REMINDER_LAST_KEY, new Date().toISOString()); } catch {}
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
      localStorage.setItem(REMINDER_NGO_LAST_SEEN_KEY, now);
      localStorage.setItem(REMINDER_NGO_PLEDGES_LAST_SEEN_KEY, now);
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
  }

  function dismissHomeHero() {
    try { localStorage.setItem(HERO_DISMISSED_KEY, '1'); } catch {}
    updateHomeHero();
    updateMapEmptyCta();
    if (!localStorage.getItem(COACH_KEY)) {
      localStorage.setItem(COACH_KEY, '1');
      setTimeout(maybeStartTour, 350);
    }
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

    addPointsCache(POINTS_ME_TOO);
    Backend.confirmReport(reportId);
    if (window.CivicAnalytics) {
      CivicAnalytics.track('report_corroborated', { reportId: String(reportId) }, report.ward);
    }
    if (reportMarkerLayer) refreshReportMarkers();
    updateProfileUI();
    pulseProfilePointsStat();
    if (isAdmin) renderAdminQueue();
    launchConfetti({ intensity: 'mini' });
    showToast(t('confirm.meTooThanks').replace('{n}', String(POINTS_ME_TOO)), 'success', 3200, {
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

  // Launch hazard types — each has i18n labels, map markers, share templates, and copy1916 categories.
  const HAZARD_CATEGORIES = [
    { key: 'stagnant-water', icon: 'ph-drop', live: true },
    { key: 'garbage', icon: 'ph-trash', live: true },
    { key: 'potholes', icon: 'ph-road-horizon', live: true },
    { key: 'streetlight', icon: 'ph-lightbulb-filament', live: true },
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
    // Hero card already covers welcome + spot guidance — skip duplicate coach overlay.
    if (shouldShowHomeHero()) {
      localStorage.setItem(COACH_KEY, '1');
      setTimeout(maybeStartTour, 600);
      return;
    }
    $('#coachMark').classList.remove('hidden');
  }

  function dismissCoachMark() {
    localStorage.setItem(COACH_KEY, '1');
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
    localStorage.setItem(TOUR_KEY, '1');
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
    startTour();
  }
  window.startCivicTour = (opts) => startTour(opts || {});

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
    ['admin', 'lead'].forEach((p) => {
      const official = $(`#${p}AuthOfficial`);
      const demo = $(`#${p}AuthDemo`);
      if (official) official.classList.toggle('hidden', !connected);
      if (demo) demo.classList.toggle('hidden', connected);
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
      const societyInput = $('#onboardSociety');
      if (societyInput) societyInput.value = user.society || '';
      startOnboardingWardDetect();
    }
  }

  function isReportPhotoPickerActive() {
    return reportPhotoFlowActive || reportPhotoProcessing
      || (Date.now() - reportPhotoDismissGuard < 800);
  }

  function finishReportPhotoFlow() {
    reportPhotoFlowActive = false;
    reportPhotoProcessing = false;
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
    const input = $('#photoInput');
    if (!input || reportPhotoProcessing) return;
    reportPhotoFlowActive = true;
    pushReportPhotoHistory();
    input.click();
  }

  function advanceReportPhotoReady() {
    ensureReportModalOpen();
    showPhotoConfirm();
    updateReportFlowSteps('submit');
    requestAnimationFrame(() => {
      const group = $('#photoConfirmGroup');
      if (group && !group.classList.contains('hidden')) {
        group.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  function closeModal(name) {
    const el = overlays[name];
    if (!el) return;
    if (name === 'report') {
      resetSubmitReportButton();
      finishReportPhotoFlow();
      if (reportCameraTimer) {
        clearTimeout(reportCameraTimer);
        reportCameraTimer = null;
      }
    }
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
    Object.keys(overlays).forEach((name) => {
      if (name === 'report' && isReportPhotoPickerActive()) return;
      closeModal(name);
    });
  }
  window.closeAllModals = closeAllModals;

  // Push a history entry when opening the full-screen Community/Profile tabs so
  // Android's hardware back button closes them instead of leaving the app.
  // One entry is enough; the popstate handler closes whichever tab is open.
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
    if (!reportPhotoFlowActive && !reportPhotoProcessing) {
      resetReportForm();
    } else {
      resetSubmitReportButton();
      const canvas = $('#imageCanvas');
      if (canvas.classList.contains('visible')) showPhotoConfirm();
      else resetPhotoConfirm();
      updateReportFlowSteps(canvas.classList.contains('visible') ? 'submit' : 'photo');
    }
    openModal('report');
    if (openCamera) {
      if (reportCameraTimer) clearTimeout(reportCameraTimer);
      requestAnimationFrame(() => {
        reportCameraTimer = setTimeout(() => {
          reportCameraTimer = null;
          if (overlays.report.classList.contains('open')) openReportPhotoPicker();
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
    pushNavModalHistory();
    closeModal('profile');
    renderLeaderboard('wards');
    updateCommunitySubtitle();
    renderSeasonalHook();
    renderCommunityImpactStats();
    renderWardWeekSocialProof();
    renderWeeklyRecapButton();
    renderSuccessStories();
    renderWardChallenge();
    renderImpactWall();
    renderLeadCandidates();
    renderOfficialChannelsSurfaces(null);
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
    pushNavModalHistory();
    closeModal('community');
    updateProfileUI();
    setNavTab('profile');
    openModal('profile');
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
      try { localStorage.setItem(PWA_NUDGE_KEY, '1'); } catch {}
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
  // Foreground-triggered opt-in reminder: re-check when the user returns to the tab.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      setTimeout(maybeShowReportReminder, 400);
    }
  });
  registerServiceWorker();
  setupInstallPrompt();
  warnIfShareUrlNotProduction();
  trackShareRefLanding();
  maybeShowReferralWelcome();
  trackVisitCount();
  updateMapEmptyCta();
  updateHomeHero();
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
      setTimeout(maybeShowReportReminder, 2400);
      updateMapEmptyCta();
      updateHomeHero();
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
    try { localStorage.setItem(LOCBANNER_SNOOZE_KEY, String(Date.now())); } catch {}
  }

  function clearLocBannerSnooze() {
    try { localStorage.removeItem(LOCBANNER_SNOOZE_KEY); } catch {}
  }

  function showLocatePill() {
    const el = $('#btnLocatePill');
    if (el) el.classList.remove('hidden');
  }

  function hideLocatePill() {
    const el = $('#btnLocatePill');
    if (el) el.classList.add('hidden');
  }

  // While snoozed, collapse the full banner into the unobtrusive locate pill.
  function showLocationBanner(message) {
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
      requestLocation(true);
    } else {
      showToast(t('toast.noLocation'), 'error');
    }
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
        hideLocatePill();
        applyWardFromCoords(currentLat, currentLng);
        if (recenter) map.setView([currentLat, currentLng], 14);
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker([currentLat, currentLng], {
          radius: 8,
          fillColor: '#6366f1',
          color: '#fff',
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(map).bindPopup(t('map.youAreHere'));
        setTimeout(() => promptNearbyCorroboration(currentLat, currentLng), 800);
        setTimeout(() => maybeProximityNudge(currentLat, currentLng), 1300);
      },
      () => {
        showLocationBanner(t('location.bannerNearby'));
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
    const societyLine = report.society
      ? `<div class="popup__society"><i class="ph ph-buildings"></i> ${escapeHtml(report.society)}</div>`
      : '';
    return `
      <div class="map-popup">
        <div class="popup__title">${escapeHtml(hazardLabel(report.hazard))}</div>
        <div class="popup__meta">${escapeHtml(status)} · ${escapeHtml((report.ward || getCityLabel(getReportCity(report))).split('—')[0].trim())}</div>
        ${societyLine}
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
      user.society = sanitizeText($('#onboardSociety')?.value || '', 120);
      cacheSocietyIfCustom(user.city, user.ward, user.society);
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
      updateHomeHero();
      updateMapEmptyCta();
      renderLeaderboard('wards');
      renderLeaderboard('citizens');
      showToast(t('toast.welcome').replace('{name}', name), 'success', 4500);
      setTimeout(showCoachMark, 500);
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

    const profileSocietyInput = $('#profileSocietyInput');
    if (profileSocietyInput) {
      profileSocietyInput.addEventListener('change', saveProfileSociety);
      profileSocietyInput.addEventListener('blur', saveProfileSociety);
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

    /* ---- Peer voting for community leads ---- */
    const leadNomForm = $('#leadNomForm');
    if (leadNomForm) {
      leadNomForm.addEventListener('submit', (e) => { e.preventDefault(); submitLeadNomination(); });
      leadNomForm.addEventListener('change', (e) => {
        if (e.target && e.target.name === 'leadRoleType') syncLeadNomNeighbourhoodVisibility();
      });
    }
    const leadNomCity = $('#leadNomCity');
    if (leadNomCity) leadNomCity.addEventListener('change', syncLeadNomWardList);
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
    const btnAccessReviewTracking = $('#btnAccessReviewTracking');
    if (btnAccessReviewTracking) btnAccessReviewTracking.addEventListener('click', () => window.openTrackingDashboard());
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
    const btnWithdrawAnalytics = $('#btnWithdrawAnalytics');
    if (btnWithdrawAnalytics) btnWithdrawAnalytics.addEventListener('click', withdrawAnalyticsConsent);
    const btnWithdrawGps = $('#btnWithdrawGps');
    if (btnWithdrawGps) btnWithdrawGps.addEventListener('click', withdrawGpsConsent);
    const btnPrivacyContact = $('#btnPrivacyContact');
    if (btnPrivacyContact) {
      const grievanceEmail = getGrievanceEmail();
      if (grievanceEmail) {
        btnPrivacyContact.href = 'mailto:' + grievanceEmail
          + '?subject=' + encodeURIComponent('CivicRadar — privacy / DPDP grievance');
      } else {
        btnPrivacyContact.style.display = 'none';
      }
    }
    $('#btnCopyImpact').addEventListener('click', copyImpactSummary);
    const btnCopyPitch = $('#btnCopySharePitch');
    if (btnCopyPitch) btnCopyPitch.addEventListener('click', copySharePitch);
    const btnShareWard = $('#btnShareWardChallenge');
    if (btnShareWard) btnShareWard.addEventListener('click', shareWardChallengeWhatsApp);
    const btnShareRecap = $('#btnShareWeeklyRecap');
    if (btnShareRecap) btnShareRecap.addEventListener('click', shareWeeklyRecapWhatsApp);
    const btnSeasonDismiss = $('#btnSeasonHookDismiss');
    if (btnSeasonDismiss) btnSeasonDismiss.addEventListener('click', dismissSeasonHook);
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
        const name = btn.dataset.close;
        if (name === 'escalation') tryCloseEscalation();
        else closeModal(name);
        // Community/Profile are full-screen tabs: closing returns to the Map tab
        // so the bottom-nav highlight stays correct.
        if (name === 'community' || name === 'profile') setNavTab('map');
      });
    });

    // Backdrop tap on the Community/Profile overlays dismisses and returns to Map.
    ['community', 'profile'].forEach((name) => {
      const overlay = overlays[name];
      if (!overlay) return;
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal(name);
          setNavTab('map');
        }
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
    });
    const btnRetake = $('#btnRetakePhoto');
    if (btnRetake) {
      btnRetake.addEventListener('click', () => {
        resetPhotoConfirm();
        const canvas = $('#imageCanvas');
        if (window.ImageModeration) {
          ImageModeration.clearPhotoCanvas(canvas, $('#photoInput'));
        } else {
          canvas.classList.remove('visible');
          $('#photoInput').value = '';
        }
        lastReportDataUrl = null;
        updateReportFlowSteps('photo');
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
    const btnSuccessNative = $('#btnSuccessNativeShare');
    if (btnSuccessNative) btnSuccessNative.addEventListener('click', () => { nativeShareReport(); });
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
        if (isReportPhotoPickerActive()) return;
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
      enableLocationFromUser();
    });
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

    // Android hardware back / browser back: close the Community/Profile tab and
    // return to the Map tab instead of navigating away from the app.
    // Returning from the native camera also pops history — keep the report sheet open.
    window.addEventListener('popstate', () => {
      if (isReportPhotoPickerActive()) {
        reportPhotoFlowActive = false;
        ensureReportModalOpen();
        reportPhotoDismissGuard = Date.now();
        return;
      }
      let closedAny = false;
      ['community', 'profile'].forEach((name) => {
        const overlay = overlays[name];
        if (overlay && overlay.classList.contains('open')) {
          closeModal(name);
          closedAny = true;
        }
      });
      if (closedAny) setNavTab('map');
    });

    window.addEventListener('pageshow', (e) => {
      if (e.persisted && $('#imageCanvas')?.classList.contains('visible')) {
        ensureReportModalOpen();
        updateReportFlowSteps('submit');
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
    $('#btnAdminOtpToggle')?.addEventListener('click', () => {
      $('#adminOtpRow')?.classList.toggle('hidden');
    });

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

  // Inline photo reminder (no extra tap) — moderation scan still gates unsafe images.
  function resetPhotoConfirm() {
    const group = $('#photoConfirmGroup');
    if (group) group.classList.add('hidden');
  }

  function showPhotoConfirm() {
    const group = $('#photoConfirmGroup');
    if (group) group.classList.remove('hidden');
  }

  function rejectPhoto(scanResult) {
    finishReportPhotoFlow();
    ensureReportModalOpen();
    const canvas = $('#imageCanvas');
    if (window.ImageModeration) {
      ImageModeration.clearPhotoCanvas(canvas, $('#photoInput'));
    } else {
      resetReportForm();
    }
    lastReportDataUrl = null;
    resetPhotoConfirm();
    updateReportFlowSteps('photo');
    const msg = scanResult.i18nKey ? t(scanResult.i18nKey) : (scanResult.message || t('moderation.blocked.irrelevant'));
    showToast(msg, 'error', 5500);
  }

  function handlePhotoCapture(e) {
    const file = e.target.files[0];
    if (!file) {
      reportPhotoFlowActive = false;
      return;
    }
    reportPhotoProcessing = true;
    ensureReportModalOpen();

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
        finishReportPhotoFlow();
        advanceReportPhotoReady();
      };
      img.onerror = () => {
        finishReportPhotoFlow();
        setPhotoScanning(false);
        showToast(t('moderation.blocked.fileType'), 'error');
        $('#photoInput').value = '';
        ensureReportModalOpen();
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
          society: user.society || '',
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
        try { localStorage.setItem(FIRST_REPORT_DONE_KEY, '1'); } catch {}
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
        pulseUserPin(report.id);
        const weekBonus = awardWeekBonus();
        setButtonLoading(submitBtn, false);
        resetReportForm();
        closeModal('report');
        showSuccessModal(weekBonus);
        maybeShowPwaNudge('report');
        updateProfileUI();
        updatePersonaUI();
        updateCommunitySubtitle();
        renderWardChallenge();
        updateMapEmptyCta();
        updateHomeHero();
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
    const badgeEl = $('#successBadgeUnlock');
    if (badgeEl) {
      if (REPORT_CELEBRATION_MILESTONES.includes(reportCount) && reportCount > 1) {
        badgeEl.textContent = t('success.badgeUnlock').replace('{n}', String(reportCount));
        badgeEl.classList.remove('hidden');
      } else {
        badgeEl.textContent = '';
        badgeEl.classList.add('hidden');
      }
    }
    const sharePromptEl = document.querySelector('#successModal .success-share-prompt');
    if (sharePromptEl) {
      sharePromptEl.textContent = reportCount === 1
        ? t('success.shareBragFirst')
        : t('success.shareBrag');
    }
    const fileBtn = $('#btnSuccessFile');
    if (fileBtn) {
      const corp = getCityCorpChannels(getUserCity());
      fileBtn.textContent = getUserCity() === 'mumbai'
        ? t('success.file')
        : t('success.fileCorp').replace('{corp}', corp.name || getCityLabel());
    }
    applyCorpAwareI18n();
    const lastReport = lastReportId ? findReportById(lastReportId) : null;
    renderOfficialChannelsSurfaces(lastReport);
  }

  function showSuccessModal(weekBonus = 0) {
    const thumb = $('#successThumbnail');
    if (lastReportDataUrl) {
      thumb.src = lastReportDataUrl;
      thumb.hidden = false;
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
      animateSuccessPoints(ptsEl, total, weekBonus);
    }
    updateSuccessNativeButton();
    const reportCount = getUserReports().length;
    openModal('success');
    requestAnimationFrame(() => {
      celebrateReportSubmit(reportCount);
      pulseProfilePointsStat();
    });
  }

  function resetReportForm() {
    $('#photoInput').value = '';
    $('#reportNotes').value = '';
    const canvas = $('#imageCanvas');
    canvas.classList.remove('visible');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastReportDataUrl = null;
    resetPhotoConfirm();
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
      .replace(/\{marathi\}/g, '')
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

  function launchConfetti(opts = {}) {
    if (prefersReducedMotion()) return;
    const intensity = opts.intensity || 'normal';
    const counts = { mini: 14, normal: 28, celebrate: 36 };
    const count = counts[intensity] || counts.normal;
    const wrap = document.createElement('div');
    wrap.className = 'confetti-burst';
    wrap.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < count; i++) {
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

  function celebrateReportSubmit(reportCount) {
    launchConfetti({ intensity: getReportConfettiIntensity(reportCount) });
    if (reportCount === 1) {
      setTimeout(() => showToast(t('toast.badgeMonsoon'), 'success', 4500), 700);
    } else if (REPORT_CELEBRATION_MILESTONES.includes(reportCount) && reportCount > 1) {
      setTimeout(
        () => showToast(t('toast.reportMilestone').replace('{n}', String(reportCount)), 'success', 4000),
        600
      );
    }
  }

  function pulseProfilePointsStat() {
    const el = $('#profilePoints');
    if (!el || getTotalCivicPoints() <= 0) return;
    el.classList.remove('profile-stat-pop', 'profile-stat-glow');
    void el.offsetWidth;
    el.classList.add('profile-stat-pop', 'profile-stat-glow');
    setTimeout(() => el.classList.remove('profile-stat-glow'), 1200);
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

  /* ---------- Viral: seasonal hooks, ward social proof & weekly recap ---------- */

  // Reports in a ward (or whole city when ward is empty) over the trailing 7 days.
  function getWardWeekStats(ward) {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = cityScopedReports(loadReports()).filter((r) => {
      if (isReportHidden(r.id)) return false;
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
    const m = new Date().getMonth(); // 0 = Jan
    if (m === 4) return { key: 'season.monsoonPrep', icon: 'ph-cloud-rain' };
    if (m === 5 || m === 6 || m === 7) return { key: 'season.monsoonPeak', icon: 'ph-cloud-rain' };
    if (m === 8) return { key: 'season.ganesh', icon: 'ph-flower-lotus' };
    if (m === 9) return { key: 'season.denguePeak', icon: 'ph-bug-beetle' };
    return null;
  }

  function renderSeasonalHook() {
    const el = $('#seasonHook');
    if (!el) return;
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
    if (key) localStorage.setItem(SEASON_HOOK_DISMISS_KEY, key);
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
    const total = cityScopedReports(loadReports()).filter((r) => !isReportHidden(r.id)).length;
    if (bodyEl) {
      bodyEl.textContent = total > 0
        ? t('ref.welcomeBody').replace('{n}', String(total)).replace('{city}', city)
        : t('ref.welcomeBodyEmpty').replace('{city}', city);
    }
    el.classList.remove('hidden');
  }

  function dismissReferralWelcome() {
    localStorage.setItem(REF_WELCOME_KEY, '1');
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
    if (loadReports().some(ownsReport)) { localStorage.setItem(REF_WELCOME_KEY, '1'); return; }
    if (window.CivicAnalytics) CivicAnalytics.track('ref_welcome_shown', { ref: String(ref).slice(0, 64) });
    renderReferralWelcome();
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

  /* ---------- Profile Stats Calculator ---------- */
  function updateProfileUI() {
    syncReportReminderToggle();
    syncCoopRegistryLink();
    renderOfficialChannelsSurfaces(null);
    const reports = getUserReports();
    const resolved = reports.filter((r) => r.status === 'resolved');
    const pending = reports.filter((r) => r.status === 'pending');
    const bonus = loadPointsCache();

    $('#profileGreeting').textContent = user.displayName
      ? t('profile.greeting').replace('{name}', user.displayName)
      : t('profile.greetingDefault');
    $('#profileWard').textContent = user.ward || t('profile.selectWard');
    refreshSocietyForProfile();
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
        (streak >= 2 ? ` · ${t('profile.streak').replace('{n}', String(streak))}` : '');
    } else if (wardImpactEl) {
      wardImpactEl.classList.add('hidden');
    }

    $('#profilePoints').textContent = getTotalCivicPoints().toLocaleString();
    $('#profileFixed').textContent = resolved.length;
    $('#profilePending').textContent = pending.length;

    const rewardsEl = $('#profileRewards');
    const streakLineEl = $('#profileStreakLine');
    const badgeTrackEl = $('#profileBadgeTrack');
    const badgeProgressEl = $('#profileBadgeProgress');
    const nextBadgeHintEl = $('#profileNextBadgeHint');
    if (rewardsEl && reports.length > 0) {
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
          hint += ` · ${t('profile.nextStreakBadge')
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
    const cities = CITY_IDS || ['mumbai', 'pune', 'thane'];
    for (let i = 0; i < cities.length; i++) {
      const list = getOfficialChannelsForCity(cities[i]);
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
      const events = (CivicAnalytics.getLocalSummary(days).counts) || {};
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
        ? ` · ${item.pending} ${t('tracking.pending')}`
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
