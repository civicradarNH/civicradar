/**
 * CivicRadar ï¿½ Core JavaScript Logic
 * Strict DOMContentLoaded bindings ï¿½ localStorage ï¿½ Haversine spam filter
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ---------- Constants ---------- */
  // Build tag attached to feedback rows. Kept in step with the SW cache version.
  const CIVIC_APP_VERSION = 'v93';
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
  // no background push ï¿½ honest about platform limits). See maybeShowReportReminder().
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
  // server-side ï¿½ never trust client auth for BMC/NGO privileged actions.
  const DEMO_CREDENTIALS = {
    admin: { user: 'admin', pass: 'password' },
    lead: { user: 'lead', pass: 'password', ward: 'G/N Ward ï¿½ Dadar, Shivaji Park', scope: 'ward' },
    leadNbh: { user: 'lead-nbh', pass: 'password', ward: 'G/S Ward ï¿½ Worli, Lower Parel', scope: 'neighbourhood', neighbourhood: 'Worli West ï¿½ Phoenix Mills area' },
  };

  // Real BMC (Brihanmumbai Municipal Corporation) complaint channels.
  // Stagnant water / mosquito breeding is routed to the ward Pest Control Officer.
  const BMC = {
    helpline: '1916',                    // 24x7 central complaint line
    whatsapp: '918999228999',            // MyBMC WhatsApp assistant
    portalUrl: 'https://portal.mcgm.gov.in/irj/portal/anonymous/qlcomplaintreg?guest_user=english',
    twitter: 'mybmc',                    // @mybmc (X handles civic complaints)
    aapleSarkar: 'https://aaplesarkar.mahaonline.gov.in/', // Maharashtra state grievance portal
    participateUrl: 'https://participatemumbai.mcgm.gov.in/', // BMC civic engagement (volunteer / CSR ï¿½ not complaints)
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
  // before async photo processing finishes ï¿½ guard the report sheet until capture completes.
  let reportPhotoFlowActive = false;
  let reportPhotoProcessing = false;
  let reportCameraTimer = null;
  let reportPhotoDismissGuard = 0;

  const DEMO_WARD_SEED = [
    { name: 'G/N Ward ï¿½ Dadar, Shivaji Park', city: 'mumbai', points: 2840, reports: 142, isDemo: true },
    { name: 'H/W Ward ï¿½ Bandra West, Khar West', city: 'mumbai', points: 2650, reports: 128, isDemo: true },
    { name: 'K/E Ward ï¿½ Andheri East, Vile Parle East', city: 'mumbai', points: 2410, reports: 115, isDemo: true },
    { name: 'L Ward ï¿½ Kurla, Sakinaka', city: 'mumbai', points: 2180, reports: 98, isDemo: true },
    { name: 'F/N Ward ï¿½ Sion, Matunga', city: 'mumbai', points: 1950, reports: 87, isDemo: true },
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
    leadNom: $('#leadNomOverlay'),
    tracking: $('#trackingOverlay'),
    accessReview: $('#accessReviewOverlay'),
  };

  let user;
  let deferredInstallPrompt = null;
  let pwaNudgeVisible = false;
  let pendingPwaNudge = false;

  // Project config ï¿½ founder story & monetization (see js/config.js)
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
    localStorage.setItem(CUSTOM_SOCIETIES_KEY, JSON.stringify(store));
  }

  function wardLabelShort(ward) {
    if (!ward) return '';
    const parts = String(ward).split('ï¿½');
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
    if (parts.length) return parts.join(' ï¿½ ');
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
      'header.context': 'Monsoon hazard map ï¿½ Mumbai, Pune & Thane',
      'header.contextCity': 'Monsoon hazard map for {city}',
      'location.banner': 'Turn on location to pin hazards accurately.',
      'location.bannerNearby': 'Enable location to report hazards and see nearby issues.',
      'location.unavailable': 'Location unavailable in this browser.',
      'location.withdrawn': 'Location consent withdrawn. Enable again when you want to report.',
      'location.dismiss': 'Dismiss location prompt',
      'location.locate': 'Locate me',
      'location.locateAria': 'Turn on location',
      'location.enable': 'Turn on',
      'coach.step': '#MonsoonGuardian ï¿½ 30 sec', 'coach.title': 'Spot stagnant water? Pin it.',
      'coach.body': 'Tap Report, snap a photo ï¿½ we pin your ward map.',
      'coach.got': 'Got it',
      'tour.skip': 'Skip tour', 'tour.next': 'Next', 'tour.done': 'Got it',
      'tour.replay': 'Replay tour',
      'tour.map.title': 'Your ward map',
      'tour.map.body': 'Hazard pins show here ï¿½ tap Me too to back neighbours.',
      'tour.report.title': 'Report in 30 sec',
      'tour.report.body': 'Tap here when you spot stagnant water.',
      'tour.profile.title': 'Profile',
      'tour.profile.body': 'Civic Points and your reports live here.',
      'persona.citizen.idle': '?? Stagnant water = dengue risk. Tap Report ï¿½ pin it on your ward map in 30 sec, then share on WhatsApp.',
      'persona.wardImpact': '{ward}: {n} monsoon reports ï¿½ dengue starts in stagnant lanes. #MonsoonGuardian',
      'persona.unfiled': '{n} open on the ward map ï¿½ share with neighbours or file officially from Profile.',
      'persona.pendingFiled': '{n} open on the ward map ï¿½ check Profile if overdue.',
      'persona.admin.idlePending': '{n} pending ï¿½ open the queue or tap red pins.',
      'persona.admin.idleEmpty': 'No pending reports. New citizen pins appear here.',
      'persona.admin.header': 'BMC review mode',
      'persona.admin.exit': 'Exit BMC mode',
      'persona.ngo.header': 'NGO coordinator mode',
      'persona.ngo.exit': 'Exit NGO mode',
      'onboard.title': 'Welcome to CivicRadar',
      'onboard.subtitle': 'Pin hazards on your ward map in 30 sec.',
      'onboard.city': 'Your city',
      'onboard.cityHint': 'Choose where you live ï¿½ we detect your ward from GPS next.',
      'onboard.ward': 'Your Ward', 'onboard.wardPh': 'Start typing your wardï¿½',
      'onboard.wardHint': 'Pick from {city}\'s {n} official wards.',
      'onboard.wardDetecting': 'Detecting your ward from locationï¿½',
      'onboard.wardDetectedHint': 'Approximate ward from GPS ï¿½ not an official boundary survey.',
      'onboard.wardManual': 'Not right? Pick manually',
      'onboard.wardRetry': 'Try detecting again',
      'onboard.wardDetectFailed': 'Could not detect ward ï¿½ pick manually or allow location.',
      'onboard.name': 'Display Name', 'onboard.namePh': 'What should neighbours call you?',
      'onboard.join': 'Join your ward',
      'onboard.wardError': 'Pick a ward from the list or allow location.',
      'onboard.society': 'Society / neighbourhood (optional)',
      'onboard.societyPh': 'Type your society / RWA name if not listed',
      'onboard.societyHintNoWard': 'Pick your ward first for local suggestions.',
      'onboard.societyHintWard': 'Showing {n} societies in {ward} ï¿½ type to add yours.',
      'onboard.societyHintCustom': 'Type your society / RWA name if not listed.',
      'report.title': 'Report a hazard',
      'report.step.photo': 'Photo', 'report.step.details': 'Details', 'report.step.submit': 'Submit',
      'report.hazardType': 'Hazard Type', 'report.photoEvidence': 'Photo',
      'report.capture': 'Take photo',
      'report.notes': 'Notes (optional)', 'report.notesPh': 'Add a note ï¿½ lane, building, landmarkï¿½',
      'report.submit': 'Submit report',
      'report.photoHint': 'Photo shows the hazard? Tap Submit ï¿½ or retake if not.',
      'report.retake': 'Retake photo',
      'moderation.guidelines': 'Photograph the actual stagnant water ï¿½ not faces, documents, or unrelated objects. Location data is stripped for privacy.',
      'moderation.scanning': 'Checking photoï¿½',
      'moderation.blocked.fileType': 'Only JPEG, PNG, or WebP hazard photos are allowed.',
      'moderation.blocked.fileSize': 'Photo is too large. Use a smaller image (max 8 MB).',
      'moderation.blocked.lowQuality': 'Photo is too small or unclear. Move closer to the hazard.',
      'moderation.blocked.irrelevant': 'Use a photo of the hazard ï¿½ not a selfie, document, or blank image.',
      'moderation.blocked.sensitive': 'Avoid IDs, documents, or screenshots. Show the hazard only.',
      'moderation.blocked.nsfw': 'This photo was blocked for inappropriate content.',
      'moderation.blocked.offline': 'Connect to the internet to verify photo safety.',
      'success.title': 'Report logged', 'success.tagline': 'On your ward map',
      'success.taglineNeighbours': '{n} neighbour(s) already backing nearby spots ï¿½ yours is on the ward map too!',
      'success.subtitle': 'Optional: file with {corp} (free) to start the official clock.',
      'success.step1': 'Share on WhatsApp so neighbours see the ward pin',
      'success.step2': 'Optional: file with {corp} and save your complaint number',
      'success.step3': 'Volunteers or {corp} can confirm when fixed ï¿½ earn Civic Points',
      'success.file': 'File with BMC (optional)',
      'success.fileCorp': 'File with {corp} (optional)',
      'success.tag': 'Tag @mybmc', 'success.alert': 'Alert neighbours', 'success.done': 'Back to map',
      'success.sharePrompt': 'Share on WhatsApp ï¿½ more eyes, faster fixes.',
      'success.shareWhatsapp': 'Share on WhatsApp',
      'share.nativeShare': 'Share',
      'success.shareNudge': 'Neighbours may not know yet ï¿½ share on WhatsApp so the ward map gets more eyes.',
      'success.shareMsg': '?? {hazard} in {ward} ï¿½ dengue risk! Pinned on CivicRadar ward map.\nTap Me too and report hazards in your lane:\n{link}\n{hashtags}',
      'share.appMsg': '??? {city} monsoon map ï¿½ pin stagnant water, tap Me too, beat rival wards!\n{link}\n{hashtags}',
      'share.defaultArea': 'my area',
      'share.meTooMsg': '?? Me too ï¿½ I see {hazard} in {ward} too. {n} neighbour(s) backed on CivicRadar:\n{link}\n{hashtags}',
      'share.meTooBtn': 'Share on WhatsApp',
      'share.wardMapMsg': '? {ward}: {pending} open dengue-risk spots ï¿½ beat us on CivicRadar!\n{link}\n{hashtags}',
      'share.cleanupMsg': '?? Volunteers cleared {hazard} in {ward}! Before ? after on the ward map:\n{link}\n{hashtags}',
      'share.instagramCaption': '{hazard} spot cleared in {ward} ?? Before ? After on CivicRadar. Monsoon win.\n{link}\n{hashtags}',
      'share.instagramCleanupCaption': 'Volunteers cleared {hazard} in {ward} ?? Before ? After on CivicRadar.\n{link}\n{hashtags}',
      'share.milestoneMsg': '?? {ward} just hit {n} fixes this monsoon on CivicRadar! Can your ward beat us?\n{link}\n{hashtags}',
      'share.firstBonus': 'First share ï¿½ +10 Civic Points! ??',
      'shareWin.title': 'Share the win!',
      'shareWin.subtitle': 'Before ? after proof on your ward map ï¿½ neighbours love seeing fixes.',
      'shareWin.subtitleCleanup': 'Volunteers cleared it ï¿½ share the before/after on your building group.',
      'shareWin.whatsapp': 'Share win on WhatsApp',
      'shareWin.instagramHint': 'Save image ? post to Instagram Stories',
      'shareWin.downloadCard': 'Download success card',
      'shareWin.copyCaption': 'Copy caption for Instagram',
      'shareWin.nativeShare': 'Share image',
      'shareWin.cardDownloaded': 'Success card saved ï¿½ open Instagram to post',
      'shareWin.captionCopied': 'Caption copied ï¿½ paste in Instagram',
      'shareWin.done': 'Done',
      'about.shareTitle': 'Share this app',
      'about.sharePitch': 'Free {city} monsoon map ï¿½ pin stagnant water in 30 sec, say Me too, beat rival wards.\nBuilt for Mumbai, Pune & Thane. No login, 4 languages.\n{link}\nForward to your RWA / society WhatsApp group ?',
      'about.copyPitch': 'Copy WhatsApp pitch',
      'about.pitchCopied': 'Pitch copied ï¿½ paste in your RWA / school group!',
      'pwa.nudge': 'Monsoon-ready: Add CivicRadar to Home Screen for one-tap reporting.',
      'pwa.nudgeAction': 'Add to Home Screen',
      'pwa.nudgeDismiss': 'Not now',
      'community.challengeShare': 'Challenge a friend ï¿½ share ward map',
      'community.winsTitle': 'Wins this monsoon',
      'community.winsEmpty': 'Fixed spots appear here ï¿½ report, rally neighbours, celebrate wins.',
      'community.winsNeighbours': 'Neighbours in {ward}',
      'community.winsCleanup': '{hazard} cleared ï¿½ {ward}',
      'community.winsResolved': '{hazard} fixed ï¿½ {ward}',
      'success.points': 'Civic Points earned', 'success.weekBonus': '+{n} first report this week!',
      'success.celebrateFirst': 'Youï¿½re protecting your ward ï¿½ neighbours will thank you.',
      'success.celebrateMilestone': '{n} reports logged ï¿½ your lane is safer because of you!',
      'success.kudos1': 'Kudos! Another hazard on the radar.',
      'success.kudos2': 'Nice work ï¿½ your ward just got a little safer.',
      'success.kudos3': 'Logged! Thanks for looking out for your neighbours.',
      'success.kudos4': 'You showed up again ï¿½ thatï¿½s how lanes get fixed.',
      'success.kudos5': 'Another pin down ï¿½ your street thanks you.',
      'success.streakWeek': '{n} report(s) this week ï¿½ keep it up!',
      'success.badgeUnlock': '{n} reports ï¿½ milestone unlocked!',
      'profile.milestoneOne': '1 more report to your next milestone',
      'profile.milestoneMany': '{n} more reports to your next milestone',
      'profile.milestoneMax': 'Monsoon Guardian ï¿½ keep reporting!',
      'profile.nextStreakBadge': '{n} more week(s) for {badge}',
      'success.progressOne': 'Just 1 more report to your next badge.',
      'success.progressMany': '{n} more reports to your next badge.',
      'success.progressMilestone': 'Badge unlocked! {n} more to your next one.',
      'success.progressGuardian': '{n} reports and counting ï¿½ a true Monsoon Guardian.',
      'success.shareBrag': 'You just helped your ward ï¿½ tell neighbours on WhatsApp!',
      'success.shareBragFirst': 'First pin on the map! Share now ï¿½ Monsoon Guardian energy spreads fast.',
      'toast.badgeMonsoon': 'Welcome, Monsoon Guardian! ???',
      'confirm.meTooThanks': 'Me too counted ï¿½ neighbours see the pressure building.',
      'toast.reportMilestone': '{n} reports ï¿½ keep the momentum going!',
      'map.empty': 'No pins in {ward} yet ï¿½ be first!',
      'map.emptyHint': 'Photo on the spot ï¿½ ~30 sec',
      'map.emptyAction': 'Report now',
      'map.emptyShare': 'Invite neighbours on WhatsApp',
      'map.emptyRival': '{ward} vs {rival} ï¿½ {pending} open spots. Report or rally!',
      'home.hero.badge': '#MonsoonGuardian',
      'home.hero.headline': 'Pin stagnant water on your ward map',
      'home.hero.subline': 'Monsoon is here â pin stagnant water on the spot: snap a photo, neighbours Me too.',
      'home.hero.benefit1': '30 sec',
      'home.hero.benefit2': 'Me too',
      'home.hero.benefit3': 'Track fixes',
      'home.hero.cta': 'Report now',
      'home.hero.tour': 'Quick tour',
      'home.hero.trust': 'Free ï¿½ offline ï¿½ 3 cities ï¿½ 4 langs',
      'home.hero.dismiss': 'Dismiss welcome card',
      'map.legend.pending': 'Open',
      'map.legend.resolved': 'Fixed',
      'map.legend.you': 'You',
      'map.legend.aria': 'Map legend: open, fixed, and your pins',
      'reminder.unfiled': '{n} open on the map ï¿½ share with neighbours or file from Profile.',
      'reminder.file': 'File now',
      'reminder.snooze3d': 'Remind me in 3 days',
      'reminder.gotIt': 'Got it',
      'reminder.esc7': 'Day {n}+ since filing ï¿½ ward escalation due for {hazard} in {ward}.',
      'reminder.esc14': 'Day {n}+ since filing ï¿½ zonal escalation due for {hazard} in {ward}.',
      'reminder.esc30': 'Day {n}+ since filing ï¿½ grievance/RTI due for {hazard} in {ward}.',
      'reminder.escAction': 'Escalate',
      'reminder.corroboration': '{n} neighbour(s) said Me too on your {hazard} report ï¿½ more eyes on the ward map helps.',
      'reminder.corroAction': 'View report',
      'reminder.cleanup': 'Neighbours cleared {hazard} in {ward} ï¿½ your BMC complaint may still be open until officially closed.',
      'reminder.cleanupAction': 'View status',
      'persona.ngo.pledges': '{deliver} to deliver ï¿½ {verify} to verify',
      'persona.ngo.newHazards': '{n} new hazards',
      'persona.ngo.newPledges': '{n} new pledge(s)',
      'persona.admin.overdue': '{overdue} overdue ï¿½ {pending} pending ï¿½ tap to open queue',
      'profile.badge.reporter': 'Active Reporter',
      'profile.badge.2week': '2-Week Reporter',
      'profile.badge.3week': '3-Week Reporter',
      'profile.badge.monsoon': 'Monsoon Guardian',
      'profile.wardImpact': 'Your ward: {n} reports this monsoon',
      'profile.streak': '{n}-week reporting streak',
      'confirm.nearby': 'Pin {m}m away{backing}. Tap Me too instead of duplicating ï¿½ get updates when fixed.',
      'esc.participate.title': 'Community action (optional)',
      'esc.participate.hint': 'Participate Mumbai is BMCï¿½s official portal for volunteering and CSR ï¿½ not for filing pest-control complaints. Use it to join clean-ups or propose ward projects.',
      'esc.participate.btn': 'Participate Mumbai',
      'esc.participate.small': 'Volunteer ï¿½ CSR ï¿½ projects',
      'esc.corpTitle': 'File with local corporation (optional)',
      'esc.corpHint': 'Use {corp}\'s official grievance portal for stagnant-water / pest-control complaints.',
      'esc.corpBtn': 'Open {corp} portal',
      'esc.corpSubtitle': 'CivicRadar shows hazards on the community map. Filing with your local corporation is optional ï¿½ it starts the official clock.',
      'esc.titleCorp': 'File with {corp} (optional)',
      'esc.tmc.recommended': 'Recommended: file on thanecity.gov.in or call TMC helpline 022-25331590.',
      'esc.tmc.fileHint': 'Stagnant water / mosquito breeding ï¿½ use any official TMC channel below.',
      'esc.tmc.channelPortal': 'TMC online portal',
      'esc.tmc.channelCall': 'TMC helpline',
      'esc.tmc.channelEmail': 'Email Municipal Commissioner',
      'esc.tmc.channelTweet': 'Tag @TMCaTweetAway',
      'esc.tmc.channelCitizenCall': 'Citizen Call Center (155300)',
      'esc.tmc.copyBlock': 'Details for TMC portal / helpline / email',
      'esc.tmc.copyAllDone': 'Copied ï¿½ paste when you file with TMC',
      'esc.tmc.portalHint': 'On thanecity.gov.in: login ? Online citizen services ? File a complaint. Paste details below.',
      'esc.tmc.filedConsent': 'I filed on an official TMC channel (portal / helpline / email / 155300 / Aaple Sarkar)',
      'esc.tmc.complaintLabel': 'TMC complaint / reference number',
      'esc.tmc.complaintPh': 'e.g. TMC/2026/123456',
      'esc.tmc.complaintWarn': 'This doesnï¿½t look like a typical TMC reference ï¿½ you can still save if itï¿½s correct.',
      'esc.tmc.filedNote': 'Filed with TMC ï¿½ escalation steps unlock as deadlines pass.',
      'esc.tmc.daysSince': '{n} days since you filed with TMC',
      'esc.tmc.selfTitle': 'TMC fixed it?',
      'esc.tmc.selfBody': 'Confirm yourself once TMC fixes it (your complaint number is proof). Turns the pin green for everyone.',
      'esc.tmc.aaple': 'Aaple Sarkar ï¿½ select TMC as local body',
      'esc.tmc.deptTitle': 'Department contacts (escalation)',
      'esc.tmc.deptHint': 'For stagnant-water follow-ups ï¿½ Water, Health, or Pollution Control.',
      'esc.tmc.dept.water': 'Water',
      'esc.tmc.dept.health': 'Health',
      'esc.tmc.dept.pollution': 'Pollution Control',
      'esc.tmc.tier.file.body': 'Free. File on thanecity.gov.in, call 022-25331590 / 022-25331211, email mc@thanecity.gov.in, or use Citizen Call Center 155300. Save your reference number here.',
      'esc.tmc.tier.matrix.body': 'Follow up with your ward office or Health department (022-25332685). Quote your TMC reference number.',
      'esc.tmc.tier.zonal.body': 'Escalate to the Municipal Commissioner (mc@thanecity.gov.in). Tag @TMCaTweetAway on X with the photo for public visibility.',
      'esc.tmc.tier.grievance.body': 'Still ignored after a month? File with Aaple Sarkar (grievances.maharashtra.gov.in) ï¿½ select Thane Municipal Corporation as local body.',
      'esc.tmc.tier.openCall': 'Call TMC',
      'esc.tmc.tier.openTweet': 'Tag @TMCaTweetAway',
      'esc.tmc.tier.openEmail': 'Email MC',
      'esc.tmc.tier.openAaple': 'Aaple Sarkar',
      'esc.tmc.consentRequired': 'Confirm you filed on an official TMC channel before saving.',
      'esc.pmc.subtitle': 'CivicRadar shows hazards on the community map. Filing with PMC is your choice ï¿½ it starts the official clock. This is not a PMC channel.',
      'esc.pmc.recommended': 'Recommended: PMC CARE WhatsApp ï¿½ fastest for most Pune wards.',
      'esc.pmc.fileHint': 'Stagnant water and mosquito breeding go through PMC CARE. Use any channel:',
      'esc.pmc.channelWa': 'PMC CARE WhatsApp',
      'esc.pmc.channelWaSmall': 'Chat ï¿½ pre-fill below',
      'esc.pmc.channelCall': 'Toll-free helpline',
      'esc.pmc.channelPortal': 'PMC CARE portal',
      'esc.pmc.channelApp': 'PMC CARE app',
      'esc.pmc.channelAppSmall': 'Play Store ï¿½ App Store (replaces PuneConnect)',
      'esc.pmc.copyBlock': 'Details for PMC CARE / WhatsApp / helpline',
      'esc.pmc.copyAllDone': 'Copied ï¿½ paste when you file on PMC CARE, WhatsApp, or the helpline',
      'esc.pmc.portalHint': 'On PMC CARE portal or app: register a grievance for stagnant water / mosquito breeding. Paste the details below.',
      'esc.pmc.filedConsent': 'I filed on an official PMC channel (PMC CARE / WhatsApp / helpline / app)',
      'esc.pmc.complaintLabel': 'PMC complaint / reference number',
      'esc.pmc.complaintPh': 'e.g. PMC/2026/123456',
      'esc.pmc.complaintWarn': 'This doesnï¿½t look like a typical PMC reference ï¿½ you can still save if itï¿½s correct.',
      'esc.pmc.filedNote': 'Filed with PMC ï¿½ escalation steps unlock as deadlines pass.',
      'esc.pmc.daysSince': '{n} days since you filed with PMC',
      'esc.pmc.selfTitle': 'PMC fixed it?',
      'esc.pmc.selfBody': 'Confirm yourself once PMC fixes it (your complaint number is proof). Turns the pin green for everyone.',
      'esc.pmc.tier.file.body': 'Free. File on PMC CARE portal, WhatsApp, toll-free 1800 1030 222, or the PMC CARE app. Save your reference number here.',
      'esc.pmc.tier.matrix.body': 'Follow up via PMC CARE or the toll-free helpline, quoting your complaint number.',
      'esc.pmc.tier.zonal.body': 'Escalate through PMC CARE portal or WhatsApp if your ward has not acted.',
      'esc.pmc.tier.grievance.body': 'Still ignored after a month? File with Aaple Sarkar (grievances.maharashtra.gov.in) ï¿½ select Pune Municipal Corporation as local body.',
      'esc.pmc.tier.openWa': 'Open WhatsApp',
      'esc.pmc.tier.openCall': 'Call PMC helpline',
      'esc.pmc.tier.openAaple': 'Aaple Sarkar',
      'esc.pmc.consentRequired': 'Confirm you filed on an official PMC channel before saving.',
      'esc.pmc.aaple': 'Aaple Sarkar ï¿½ select Pune Municipal Corporation as local body',
      'copy1916.pmc.header': 'PMC complaint details (copy & paste for PMC CARE / WhatsApp / helpline)',
      'copy1916.pmc.complaintNotFiled': 'PMC complaint #: (not yet filed)',
      'copy1916.pmc.complaintFiled': 'PMC complaint #: {id}',
      'profile.fileCorp': 'File with {corp}',
      'community.title': 'Community',
      'community.subtitle': "Fix it together in {ward} ï¿½ volunteer, pledge supplies, or file with {corp} separately.",
      'community.subtitleActive': '{ward}: {pending} open on the map ï¿½ {resolved} fixed ï¿½ rally neighbours or volunteer.',
      'community.topWards': 'Top Wards', 'community.localCitizens': 'Local Citizens',
      'community.supportTitle': 'Support Volunteers',
      'community.supportBody': 'Pledge supplies for cleanup crews tackling stagnant water in your ward.',
      'community.pledge': 'Pledge',
      'community.volunteerTitle': 'Volunteer in my ward',
      'community.volunteerBody': 'Fix it together ï¿½ clean stagnant water, spread awareness, or deliver pledged supplies. Filing with {corp} is separate.',
      'community.volunteerCta': 'Sign up',
      'volunteer.title': 'Volunteer in my ward',
      'volunteer.subtitle': 'Fix it together with neighbours ï¿½ not a government volunteer programme.',
      'volunteer.ward': 'Your ward',
      'volunteer.neighbourhood': 'Neighbourhood / society / lane',
      'volunteer.neighbourhoodPh': 'e.g. Phoenix Mills lane, Building 7 Worli',
      'volunteer.neighbourhoodHint': 'Your RWA, society, or lane ï¿½ helps neighbourhood leads match you to nearby spots.',
      'volunteer.hours': 'Hours available this monsoon',
      'volunteer.hoursCustom': 'Custom',
      'volunteer.skills': 'I can help with',
      'volunteer.skill.cleanup': 'Cleanup stagnant water',
      'volunteer.skill.awareness': 'Awareness & WhatsApp outreach',
      'volunteer.skill.pledge': 'Pledge delivery (supplies)',
      'volunteer.contact': 'Phone / WhatsApp (optional)',
      'volunteer.contactHint': 'Optional ï¿½ shared with your ward or neighbourhood coordinator only if you enter it. You control this; CivicRadar never auto-calls.',
      'volunteer.ageNote': '18+ required per Terms. Under-18? Participate only with a parent/guardian or school NSS coordinator who accepts Terms.',
      'volunteer.submit': 'Save volunteer signup',
      'volunteer.remove': 'Remove my signup',
      'volunteer.edit': 'Edit signup',
      'volunteer.empty': 'Not signed up yet. Help fix hazards in your lane from Community.',
      'volunteer.emptyAction': 'Volunteer in my ward',
      'volunteer.hoursLabel': '{n} hrs this monsoon',
      'popup.helpClean': 'I can help clean this',
      'popup.taskOffered': 'Volunteer offered to help',
      'toast.volunteerSaved': 'Volunteer signup saved ï¿½ coordinators in your ward can see it.',
      'toast.volunteerRemoved': 'Volunteer signup removed.',
      'toast.volunteerWardRequired': 'Set your ward in onboarding first.',
      'toast.volunteerNeighbourhoodRequired': 'Enter your neighbourhood, society, or lane.',
      'toast.volunteerSkillRequired': 'Select at least one way you can help.',
      'toast.volunteerTaskOffered': 'Offer sent ï¿½ your ward or neighbourhood coordinator can match you to this spot.',
      'toast.volunteerTaskDuplicate': 'You already offered to help with this hazard.',
      'toast.volunteerSignupRequired': 'Sign up as a volunteer first (Community tab).',
      'toast.volunteerTaskCompleted': 'Cleanup marked complete ï¿½ reporter notified.',
      'toast.coordScopeWard': 'Ward coordinator ï¿½ all of {ward}',
      'toast.coordScopeNbh': 'Neighbourhood lead ï¿½ {label}',
      'inquiry.coordTitle': 'Become a ward or neighbourhood coordinator',
      'inquiry.coordBody': 'Lead your RWA/society or ward NGO ï¿½ see volunteers, match cleanup offers, verify pledge hours. Request an invite code from the operator.',
      'about.becomeCoord': 'Become a ward or neighbourhood coordinator',
      'coord.codeHint': 'Coordinators receive a code when onboarded ï¿½ ward-wide or neighbourhood (RWA/society) scope.',
      'coord.volunteers': 'Volunteers in your scope',
      'coord.volunteersEmpty': 'No volunteer signups yet. Share the Community tab ï¿½ citizens can sign up to help locally.',
      'coord.tasks': 'Volunteer cleanup offers',
      'coord.tasksEmpty': 'No volunteer offers yet. Citizens tap ï¿½I can help clean thisï¿½ on open hazard pins.',
      'coord.tasksPending': 'Tasks',
      'coord.volunteersLabel': 'Volunteers',
      'coord.markTaskComplete': 'Mark cleanup done',
      'coord.scopeWard': 'Ward lead ï¿½ {ward}',
      'coord.scopeNbh': 'Neighbourhood lead ï¿½ {label}',
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
      'impact.week': 'This week: {reports} reports ï¿½ {resolved} resolved ï¿½ {confirms} confirmations',
      'impact.resolvedBreakdown': 'You: {self} ï¿½ Community: {community} ï¿½ BMC: {bmc} ï¿½ Cleanup: {cleanup}',
      'about.title': 'About CivicRadar',
      'about.subtitle': 'Community-powered ward map for Mumbai, Pune & Thane ï¿½ not an anonymous helpline router.',
      'about.impactTitle': 'Community impact', 'about.builtTitle': 'What we built',
      'about.differentTitle': 'What makes CivicRadar different',
      'about.different1': 'Live ward map with photo pins ï¿½ neighbours tap Me too to corroborate, not anonymous helpline drops',
      'about.different2': 'Dual path: pin on CivicRadar first, then one-tap official filing (BMC 1916/MyBMC, PMC CARE, TMC) when you choose',
      'about.different3': 'Works offline ï¿½ install to Home Screen, no login, 4 languages across Mumbai, Pune & Thane',
      'about.different4': 'Track until fixed ï¿½ escalation timeline, Civic Points, and community wins when spots get cleaned',
      'about.sustainTitle': 'Sustainable & free for citizens',
      'about.sustainBody': 'CivicRadar stays free for residents. Future support comes from local partners ï¿½ not paywalls on public safety.',
      'about.copyImpact': 'Copy impact summary', 'about.contact': 'Contact us', 'about.contactOperator': 'Contact us', 'about.close': 'Close',
      'about.sponsored': 'Sponsored',       'about.copied': 'Impact summary copied ï¿½ paste into your application.',
      'about.operatorNote': 'Until {name} turns 18, {operator} operates the service ï¿½ hosting, accounts, and legal contact.',
      'inquiry.title': 'Partner with CivicRadar',
      'inquiry.subtitle': 'Reach citizens in Mumbai, Pune, or Thane ï¿½ in the wards that matter to you.',
      'inquiry.localTitle': 'Local business sponsor',
      'inquiry.localBody': 'Promote monsoon-relevant offers (nets, repellents, hardware) to citizens in specific wards.',
      'inquiry.bmcTitle': 'Municipal pilot',
      'inquiry.bmcBody': 'Multi-ward analytics and official workflows ï¿½ for invited BMC pilots only. Contact us to participate.',
      'inquiry.ngoTitle': 'NGO & volunteer networks',
      'inquiry.ngoBody': 'Coordinate pledges, verify hours, and log community cleanups at scale.',
      'inquiry.email': 'Send partnership inquiry',
      'lang.title': 'Choose your language',
      'hazard.stagnant-water': 'Stagnant Water', 'hazard.potholes': 'Potholes',
      'hazard.garbage': 'Garbage', 'hazard.streetlight': 'Broken Streetlight',
      'hazard.comingSoon': 'Coming soon',
      'soon.title': 'Coming soon', 'soon.notify': 'Notify me when itï¿½s live',
      'soon.thanks': 'Thanks ï¿½ weï¿½ll notify you when this launches.',
      'soon.roadmap': 'More hazard types coming soon ï¿½ garbage, potholes, and streetlights are live now.',
      'confirm.metoo': 'Me too', 'confirm.you': 'Your report',
      'confirm.done': 'Following ï¿½ updates when fixed',
      'confirm.thanks': 'Following ï¿½ we\'ll tell you when it\'s fixed.',
      'confirm.none': 'Be the first to say Me too',
      'confirm.followHint': 'Not a BMC complaint ï¿½ backs the community pin. You\'ll get updates when fixed.',
      'confirm.backingOne': ' ï¿½ 1 neighbour',
      'confirm.backingMany': ' ï¿½ {n} neighbours',
      'confirm.dupe': 'Already pinned within 10 m{backing}. Tap Me too ï¿½ we\'ll notify you when fixed.',
      'confirm.dupeAction': 'Me too',
      'confirm.ownDupe': 'You already pinned this spot. Track it in Profile.',
      'profile.unfiledBanner': '{n} open ï¿½ not filed with {corp} yet. Sharing helps too; each spot needs its own complaint if you file officially.',
      'profile.fileNext': 'File next',
      'confirm.resolved': 'A hazard you backed in {ward} was fixed!',
      'confirm.resolvedMany': '{n} hazards you backed were just fixed!',
      'confirm.shareBtn': 'Share',
      'confirm.shareMsg': '? Hazard I flagged in {ward} is FIXED on CivicRadar! Community pressure works:\n{link}\n{hashtags}',
      'fix.looksFixed': 'Looks fixed now',
      'fix.done': 'You said looks fixed',
      'fix.thanks': 'Thanks ï¿½ when enough neighbours agree, we mark it fixed.',
      'fix.countOne': '1 neighbour says fixed',
      'fix.countMany': '{n} neighbours say fixed',
      'fix.hint': 'Community spot-check only ï¿½ not official BMC confirmation.',
      'fix.resolved': 'A spot you checked in {ward} was community-verified fixed!',
      'fix.resolvedMany': '{n} spots you checked were community-verified fixed!',
      'fix.afterPhotoPrompt': 'Optional: add an after photo from Profile.',
      'reminder.staleCheck': 'Spot near {ward} ï¿½ still stagnant?',
      'reminder.stillThere': 'Still there',
      'reminder.looksFixed': 'Looks fixed',
      'reminder.addPhoto': 'Add a photo',
      'settings.title': 'Reminders',
      'settings.reminder.label': 'Remind me to report stagnant water nearby',
      'settings.reminder.sub': 'A gentle monsoon-season nudge when you open CivicRadar. No background tracking.',
      'settings.reminder.on': 'Reminders on ï¿½ we\'ll gently nudge you when you open CivicRadar.',
      'settings.reminder.off': 'Reminders off.',
      'settings.reminder.denied': 'Notifications are blocked ï¿½ we\'ll show a gentle in-app reminder instead.',
      'notify.report.title': 'Spotted stagnant water today?',
      'notify.report.body': 'If you pass a puddle, clogged drain, or open tank, take 30 seconds to report it.',
      'notify.report.cta': 'Report now',
      'profile.status.communityVerified': 'Community verified fixed',
      'profile.status.youMarkedFixed': 'You marked fixed',
      'profile.status.bmcResolved': 'BMC resolved',
      'profile.badge.communityVerified': 'Community verified',
      'profile.badge.youMarkedFixed': 'You marked fixed',
      'profile.badge.bmcResolved': 'BMC resolved',
      'community.winsCommunityVerified': '{hazard} community-verified ï¿½ {ward}',
      'shareWin.subtitleCommunity': 'Neighbours confirmed this spot looks fixed ï¿½ not an official BMC record.',
      'shareWin.impact': '{n} neighbours backed this ï¿½ {ward} ï¿½ screenshot this win! ??',
      'toast.fixConfirmed': '+10 points ï¿½ thanks for checking!',
      'toast.communityResolved': 'Community verified fixed ï¿½ thanks for reporting!',
      'sync.cloud': 'Syncing',
      'sync.local': 'Local only',
      'sync.cloudTitle': 'Reports sync across devices',
      'sync.localTitle': 'Saved on this device only ï¿½ syncs when cloud is connected',
      'report.submitting': 'Submittingï¿½',
      'success.clock': 'On the community map ï¿½ not filed with {corp} yet.',
      'community.challenge.empty': 'Be the first in {ward} to climb the monsoon board ï¿½ report a hazard today.',
      'community.challenge.beat': '{ward}: {pending} dengue-risk spots ï¿½ beat {rival} ({rivalPending} pending)! Monsoon urgency ??',
      'community.challenge.leading': '{ward} leads with {resolved} fixes ï¿½ stay ahead of {rival}!',
      'community.challenge.catch': '{ward}: chase {leader} ({leaderResolved} fixed). Clean lanes start at home.',
      'community.challenge.leaderboard': '{leader} tops the monsoon board with {resolved} fixes ï¿½ which ward is next?',
      'leaderboard.demo': 'Sample',
      'leaderboard.you': 'You',
      'leaderboard.demoNote': 'Sample data for demo ï¿½ real ward rankings appear as neighbours report.',
      'leaderboard.resolved': '{n} resolved',
      'leaderboard.emptyWards': 'Report hazards to see your ward climb the board.',
      'leaderboard.emptyCitizens': 'File reports to appear on the local citizens board.',
      'leaderboard.emptyFirst': 'Be the first in your ward ï¿½ report a hazard to climb the board.',
      'admin.proofBefore': 'Before (citizen report)',
      'admin.proofAfter': 'After (BMC proof)',
      'admin.proofCapture': 'Add proof photo',
      'admin.proofHint': 'Upload a clear photo showing the hazard is fixed ï¿½ citizens see before/after proof.',
      'admin.proofPrompt': 'Add an after photo, then tap again to confirm resolution.',
      'admin.proofRequired': 'Proof photo required ï¿½ add a clear after photo before resolving.',
      'admin.confirmResolve': 'Confirm resolution?',
      'admin.exportCsv': 'Export ward CSV',
      'admin.exportEmpty': 'No reports to export for this filter.',
      'admin.exportSuccess': 'Exported {n} report(s) to CSV.',
      'admin.copy1916': 'Copy for 1916',
      'admin.copy1916Copied': 'Copied ï¿½ paste into 1916',
      'copy1916.header': 'BMC complaint details (copy & paste when you call 1916 or use MyBMC)',
      'copy1916.categoryLabel': 'Category',
      'copy1916.category.stagnant-water': 'Mosquito breeding / stagnant water (Public Health ? Pest Control)',
      'copy1916.category.potholes': 'Potholes / road damage',
      'copy1916.category.garbage': 'Garbage / solid waste',
      'copy1916.category.streetlight': 'Broken streetlight',
      'copy1916.wardLabel': 'Ward + area',
      'copy1916.landmarkLabel': 'Nearest landmark / notes',
      'copy1916.gpsLabel': 'GPS',
      'copy1916.gpsWarning': '? GPS looks outside {city} ï¿½ confirm location before filing',
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
      'confirm.shareResolvedMsg': '? FIXED in {ward}! Before ? after proof on CivicRadar:\n{link}\n{hashtags}',
      'esc.title': 'File with BMC (optional)',
      'esc.subtitle': 'CivicRadar shows hazards on the community map. Filing with BMC is your choice ï¿½ it starts the official clock. This is not a BMC channel.',
      'esc.fileTitle': 'File the complaint (free)',
      'esc.fileHint': 'Stagnant water goes to your wardï¿½s Pest Control Officer. Use any channel:',
      'esc.recommended': 'Recommended: MyBMC WhatsApp ï¿½ fastest for most Mumbai wards.',
      'esc.channelWa': 'Chatbot ï¿½ pre-fill below',
      'esc.channelCall': '24ï¿½7 helpline',
      'esc.channelPortal': 'Online portal',
      'esc.channelTweet': 'Public pressure',
      'esc.margApp': 'MyBMC MARG app',
      'esc.margAppSmall': 'Official grievance app',
      'esc.copyBlock': 'Details for 1916 / portal / app',
      'esc.copyAll': 'Copy all details',
      'esc.copyAllDone': 'Copied ï¿½ paste when you file on 1916, MyBMC, or the portal',
      'esc.copyBilingual': 'For the call centre: read the Marathi section at the bottom of the text block.',
      'esc.portalHint': 'On the portal or MARG app: choose Public Health ? Pest Control ? stagnant water. Paste the details below.',
      'esc.filedConsent': 'I filed on an official BMC channel (1916 / MyBMC / portal / app)',
      'esc.complaintWarn': 'This doesnï¿½t look like a typical BMC number ï¿½ you can still save if itï¿½s correct.',
      'esc.saveUnlock': 'After save: escalation ladder, days-since-filed tracker, and follow-up copy templates unlock.',
      'esc.closeNudge': 'No complaint number saved yet ï¿½ you can file and save anytime from Profile.',
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
      'esc.rtiDisclaimer': 'Informational RTI template only ï¿½ not legal advice.',
      'esc.consentRequired': 'Confirm you filed on an official BMC channel before saving.',
      'esc.complaintLabel': 'Complaint number',
      'esc.complaintPh': 'e.g. N/2026/123456',
      'esc.complaintHint': 'Saving your complaint number starts the official clock and unlocks follow-up steps.',
      'esc.filedNote': 'Filed with BMC ï¿½ escalation steps unlock as deadlines pass.',
      'esc.ladderTitle': 'Escalation ladder',
      'esc.selfTitle': 'BMC fixed it?',
      'esc.selfBody': 'Confirm yourself once BMC fixes it (your complaint number is proof). Turns the pin green for everyone.',
      'esc.selfBtn': 'Mark resolved',
      'esc.aaple': 'Aaple Sarkar (state grievance)',
      'esc.officialHint': 'Suggested category: {hint}',
      'official.title': 'Official grievance channels',
      'official.subtitle': 'Verified government apps and portals ï¿½ CivicRadar does not file on your behalf.',
      'official.alsoFile': 'Also file officially (optional)',
      'official.copyDone': 'Official filing summary copied ï¿½ paste in the app or portal',
      'official.categoryHint': 'Suggested category: {hint}',
      'official.reportDate': 'Report date',
      'official.photoGuidance': 'Tip: attach your CivicRadar photo in the official app for faster action.',
      'official.marg.label': 'MyBMC MARG',
      'official.marg.small': '114 categories ï¿½ geo photos ï¿½ tracking',
      'official.swachhata.label': 'Swachhata-MoHUA',
      'official.swachhata.small': 'MoHUA sanitation ï¿½ ward inspector',
      'official.aaple.label': 'Aaple Sarkar',
      'official.aaple.small': 'Maharashtra state grievance portal',
      'official.pmc.label': 'PMC CARE',
      'official.pmc.small': 'Pune Municipal Corporation app',
      'official.tmc.label': 'TMC citizen portal',
      'official.tmc.small': 'thanecity.gov.in',
      'official.bmcWa.label': 'MyBMC WhatsApp',
      'official.bmcWa.small': 'Quick chat filing',
      'official.bmcPortal.label': 'BMC online portal',
      'official.bmcPortal.small': 'portal.mcgm.gov.in',
      'official.hint.marg.stagnant-water': 'Public Health ? Pest Control ? stagnant water / mosquito breeding',
      'official.hint.marg.garbage': 'Solid Waste Management ? garbage / drainage',
      'official.hint.swachhata.garbage': 'Garbage dump',
      'official.hint.swachhata.stagnant-water': 'Choked drain (if drain-related); use BMC/PMC for pest control',
      'official.hint.pmc.stagnant-water': 'Health / mosquito breeding / stagnant water',
      'official.hint.pmc.garbage': 'Solid waste / garbage',
      'official.hint.aaple': 'Select {corp} as local body ? Health / Water supply',
      'official.hint.tmc.stagnant-water': 'Water dept or Health dept (mosquito breeding)',
      'success.alsoOfficial': 'Also file officially',
      'esc.close': 'Close',
      'esc.save': 'Save',
      'esc.tier.file.title': '1 ï¿½ File the official complaint',
      'esc.tier.file.body': 'Free. Routed to your wardï¿½s Pest Control Officer. Use any channel above, then save the complaint number here so the real clock starts.',
      'esc.tier.matrix.title': '2 ï¿½ Day {n}+ ï¿½ Ward escalation',
      'esc.tier.matrix.body': 'BMCï¿½s system auto-escalates unresolved complaints at 7 days. Follow up with your Ward Complaint Officer, quoting your complaint number.',
      'esc.tier.zonal.title': '3 ï¿½ Day {n}+ ï¿½ Zonal + public pressure',
      'esc.tier.zonal.body': 'Escalate to the Zonal Deputy Municipal Commissioner. Tag @mybmc on X with the photo for public visibility.',
      'esc.tier.grievance.title': '4 ï¿½ Day {n}+ ï¿½ Grievance / RTI',
      'esc.tier.grievance.body': 'Still ignored after a month? File with the Public Grievance Cell via Aaple Sarkar (Maharashtra state portal), or file an RTI on the complaint status.',
      'profile.empty': 'No reports yet. Stagnant water near you?',
      'profile.emptyList': 'No reports yet. Tap Report to pin stagnant water near you.',
      'profile.emptyAction': 'Report now',
      'profile.trackEscalate': 'Track / escalate',
      'profile.fileBmc': 'File with BMC',
      'profile.status.resolvedCitizen': 'Resolved (you confirmed)',
      'profile.status.resolvedBmc': 'Resolved by BMC',
      'profile.status.notFiled': 'Open on community map',
      'profile.communityCleared': 'Volunteers cleared ï¿½ {corp} complaint may still be open',
      'profile.neighbourOne': 'neighbour said Me too',
      'profile.neighbourMany': 'neighbours said Me too',
      'profile.pointsHint.base': '50 pts per report ï¿½ +200 when volunteer hours verified',
      'profile.pointsHint.bonus': '{n} reports ï¿½ 50 pts ï¿½ +{bonus} volunteer bonus',
      'profile.greeting': 'Hello, {name}',
      'profile.greetingDefault': 'Hello, Citizen',
      'profile.selectWard': 'Select your ward',
      'profile.society': 'Society / neighbourhood (optional)',
      'profile.societyPh': 'Type your society / RWA name if not listed',
      'profile.societyHintWard': 'Showing {n} societies in {ward} ï¿½ type to add yours.',
      'profile.societyHintNoWard': 'Set your ward for local society suggestions.',
      'profile.societyHintCustom': 'Type your society / RWA name if not listed.',
      'profile.societyRegistry': 'Find your registered cooperative society',
      'map.youAreHere': 'You are here',
      'about.subtitleNamed': 'Community tech for Mumbai, Pune & Thane monsoon ï¿½ built by {name}, free for citizens.',
      'safety.hide': 'Flag / hide from map',
      'safety.hidden': 'Report hidden from your map.',
      'safety.hideConfirm': 'Hide this pin from your map? (Does not delete the report.)',
      'popup.pending': 'Pending',
      'popup.resolved': 'Resolved',
      'popup.society': 'Society / neighbourhood',
      'popup.communityCleared': 'Volunteers cleared ï¿½ {corp} complaint may still be open',
      'partner.title': 'Volunteer login',
      'partner.subtitle': 'For NGO coordinators and volunteers. BMC access by invitation only.',
      'partner.ngoTitle': 'NGO Coordinator',
      'partner.ngoBody': 'View pledges, send volunteers, log cleanups',
      'partner.bmcTitle': 'Municipal pilot',
      'partner.bmcBody': 'Invited BMC pilots only ï¿½ contact us for access',
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
      'tos.gps': 'GPS is collected only when you enable location or submit a report ï¿½ not bundled with Terms acceptance.',
      'tos.analytics': 'Anonymous usage analytics (optional) help improve reliability. No photos, GPS, or names are sent.',
      'tos.analyticsOptIn': 'I consent to anonymous usage analytics (optional ï¿½ withdraw anytime in Profile)',
      'tos.notBmc': 'CivicRadar is independent ï¿½ not affiliated with or run by BMC, PMC, TMC, or any government body.',
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
      'pledge.wardPh': 'Select wardï¿½',
      'pledge.message': 'Message',
      'pledge.messagePh': 'Note for volunteersï¿½',
      'pledge.notice': 'Your ward NGO coordinator sees this in their hub ï¿½ not BMC. They may follow up in-app; no automatic calls or SMS.',
      'pledge.status.pledged': 'Pledged',
      'pledge.status.delivered': 'Delivered',
      'pledge.status.verified': 'Verified (+200 pts)',
      'pledge.submit': 'Submit pledge',
      'toast.syncConnected': 'Connected ï¿½ reports sync across devices.',
      'toast.welcome': 'Welcome, {name}! You\'re ready to report.',
      'toast.syncLocal': 'Saved on this device ï¿½ cloud sync will retry.',
      'toast.copyFail': 'Could not copy ï¿½ select text manually.',
      'toast.saveFail': 'Could not save.',
      'toast.adminVerified': 'BMC access verified ï¿½ review your ward queue.',
      'toast.ngoVerified': 'Coordinator verified ï¿½ manage pledges and volunteers.',
      'toast.govEmail': 'Use your official gov.in / mcgm.gov.in email.',
      'toast.codeSent': 'Code sent ï¿½ check your inbox.',
      'toast.codeInvalid': 'Invalid or expired code.',
      'toast.linkSent': 'Sign-in link sent ï¿½ check your inbox.',
      'toast.authEmailFail': 'Could not send sign-in email. Check Supabase SMTP settings and try again.',
      'toast.authEmailOffline': 'Cloud sign-in is unavailable ï¿½ check your connection and try again.',
      'toast.authEmailRateLimit': 'Too many sign-in emails ï¿½ wait a few minutes and try again.',
      'toast.authEmailInvalid': 'That email address looks invalid ï¿½ check and try again.',
      'toast.authEmailRedirect': 'Sign-in redirect URL is not allowed ï¿½ add your site URL in Supabase Authentication settings.',
      'toast.linkExpired': 'That sign-in link expired ï¿½ request a new one.',
      'toast.bmcUnauthorized': 'This email is not authorised for BMC access.',
      'toast.ngoCodeRequired': 'Enter your email and NGO access code.',
      'toast.ngoCodeInvalid': 'That NGO access code is invalid or used up.',
      'toast.onboardFirst': 'Complete setup to report hazards.',
      'toast.tosRequired': 'Accept Terms & Privacy (18+) before using community features.',
      'toast.reportNotFound': 'That report link is invalid or no longer on this device.',
      'toast.installed': 'CivicRadar installed ï¿½ open from your home screen!',
      'toast.installHint': 'Browser menu ? Add to Home screen.',
      'toast.wardRequired': 'Pick a ward from the official {city} list.',
      'toast.contactConfig': 'Contact email not set ï¿½ check About in Profile.',
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
      'toast.storageFull': 'Storage full ï¿½ oldest report removed. Try again.',
      'toast.gpsFail': 'Could not get GPS. Turn on location and try again.',
      'toast.complaintRequired': 'Enter your complaint number to start tracking.',
      'toast.complaintSaved': 'Complaint number saved ï¿½ official clock is running.',
      'toast.pledgeWardRequired': 'Select a target ward for your pledge.',
      'toast.pledgeSaved': 'Pledge recorded ï¿½ your ward coordinator will see it in their hub.',
      'toast.pledgeDuplicate': 'You already have an open pledge for this ward and supply type.',
      'toast.pledgeWardMismatch': 'Different ward than yours ï¿½ that ward\'s coordinator will handle it.',
      'toast.pledgeStatusDelivered': 'Your pledge was marked delivered by the coordinator.',
      'toast.pledgeStatusVerified': 'Volunteer hours verified ï¿½ +200 Civic Points credited!',
      'toast.ngoNewPledge': '{n} new citizen pledge(s) in your ward.',
      'toast.ngoNewPledgeAction': 'Open hub',
      'toast.proofAdded': 'Proof photo added ï¿½ tap confirm to resolve.',
      'toast.resolveFail': 'Could not update report status.',
      'toast.bmcOnlyResolve': 'Only verified BMC officials can resolve reports.',
      'toast.resolvedProof': 'Marked resolved ï¿½ before/after proof saved.',
      'toast.ownReportOnly': 'You can only confirm your own reports.',
      'toast.complaintFirst': 'Add your complaint number first ï¿½ it\'s your proof.',
      'toast.selfResolved': 'Marked resolved ï¿½ thanks for following up!',
      'toast.shareWin': 'Share the win with neighbours.',
      'toast.cleanupLogged': 'Community cleanup logged. BMC complaint stays open until officially resolved.',
      'toast.pledgeDelivered': 'Supplies marked delivered. Verify hours next.',
      'toast.hoursVerified': 'Hours verified! +200 Civic Points credited.',
      'toast.saving': 'Savingï¿½',
      'toast.verifying': 'Verifyingï¿½',
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
      'admin.healthLoading': 'Loading usageï¿½',
      'admin.markResolved': 'Mark as resolved',
      'admin.resolveHint': 'Citizen gets credit and the pin turns green.',
      'admin.reviewTag': 'BMC review',
      'admin.reportTitle': 'Hazard report',
      'coord.title': 'Coordinator login',
      'coord.subtitle': 'Review pledges, send volunteers, verify hours.',
      'coord.hubTitle': 'Coordinator hub',
      'coord.hubSubtitle': 'Review citizen pledges and verify volunteer time.',
      'coord.workflow': 'Dispatch volunteers ? log cleanup ? confirm supplies ? verify hours (+200 pts)',
      'coord.openHazards': 'Open hazards in your ward',
      'coord.pledges': 'Citizen pledges',
      'coord.pledgesNew': 'Citizen pledges ï¿½ {n} new',
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
      'admin.meta.neighbourConfirm': ' ï¿½ {n} said Me too',
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
      'tracking.subtitle': 'Aggregate civic metrics ï¿½ visits, reports, escalations, and resolutions.',
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
      'tracking.loading': 'Loading metricsï¿½',
      'tracking.sourceLocal': 'Device + local reports (demo / offline)',
      'tracking.sourceCloud': 'Cloud aggregate (all users)',
      'tracking.sourceCloudFail': 'Cloud metrics unavailable ï¿½ run tracking SQL in Supabase.',
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
      'auth.demoTag.admin': 'Demo access ï¿½ production uses BMC email verification',
      'auth.demoTag.lead': 'Demo access ï¿½ production uses email + NGO invite code',
      'auth.officialEmail': 'Official email',
      'auth.emailHint': 'Only verified gov.in / mcgm.gov.in addresses get BMC access.',
      'auth.sendCode': 'Send sign-in link',
      'auth.linkInstructions': 'Check your email and tap the sign-in link. Keep this tab open ï¿½ you\'ll return here signed in.',
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
      'admin.health.cloudUnavailable': 'Cloud metrics unavailable ï¿½ run analytics SQL migration in Supabase.',
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
      'ref.welcomeTitle': 'A neighbour invited you ??',
      'ref.welcomeBody': '{n} hazard reports already on the {city} map. See open spots in your ward ï¿½ or pin one in 30 seconds.',
      'ref.welcomeBodyEmpty': 'Be one of the first to map stagnant water in {city} this monsoon ï¿½ it takes 30 seconds.',
      'ref.welcomeCta': 'See the map',
      'ref.welcomeReport': 'Report a spot',
      'ref.dismiss': 'Dismiss invite',
      'season.monsoonPrep': 'Monsoonï¿½s coming ??? Clear stagnant water early ï¿½ pin spots before the first heavy rain.',
      'season.monsoonPeak': 'Peak monsoon ??? Stagnant water breeds dengue. Report spots in your ward today.',
      'season.ganesh': 'Ganesh Chaturthi ?? Keep your ward clean for the festival ï¿½ report stagnant water near pandals and immersion routes.',
      'season.denguePeak': 'Dengue season ?? Mosquitoes breed in still water. A 30-second report protects your lane.',
      'season.dismiss': 'Dismiss seasonal tip',
      'social.wardWeek': '?? {n} neighbour(s) reported in {ward} this week',
      'social.wardWeekBacked': '?? {n} reported ï¿½ {c} backed in {ward} this week',
      'social.wardWeekEmpty': 'Be the first in {ward} to report this week ï¿½ neighbours follow leaders.',
      'recap.title': 'Your ward this week',
      'recap.share': 'Share weekly recap',
      'share.weeklyRecap': '?? {ward} this monsoon week: {reports} new report(s), {resolved} fixed, {backed} backed by neighbours. Join us on CivicRadar ??\n{link}\n{hashtags}',
      'feedback.menu': 'Send feedback',
      'feedback.title': 'Send feedback',
      'feedback.subtitle': 'Found a bug or have an idea? Tell us ï¿½ it goes straight to the team.',
      'feedback.categoryLabel': 'What kind of feedback?',
      'feedback.catIdea': 'Idea',
      'feedback.catBug': 'Bug',
      'feedback.catOther': 'Other',
      'feedback.messageLabel': 'Your feedback',
      'feedback.messagePh': 'What happened, or what would make CivicRadar better?',
      'feedback.contactLabel': 'Contact (optional ï¿½ only if you want a reply)',
      'feedback.contactPh': 'Email or phone',
      'feedback.privacy': 'We never share your contact. Used only to reply to this feedback.',
      'feedback.submit': 'Send feedback',
      'feedback.errorEmpty': 'Please write a short message first.',
      'feedback.error': 'Could not send ï¿½ your text is safe. Please try again.',
      'feedback.success': 'Thanks! Your feedback was sent.',
      'feedback.successLocal': 'Saved ï¿½ we will sync it when you are back online.',
      'access.title': 'Request BMC access',
      'access.subtitle': 'For invited BMC officials ï¿½ community leads use peer voting instead.',
      'access.step1': 'Apply with a few quick details',
      'access.step2': 'The CivicRadar team reviews',
      'access.step3': 'Get a claim code to unlock access',
      'access.roleLabel': 'I am aï¿½',
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
      'access.contactLabel': 'Contact ï¿½ email or phone',
      'access.emailPh': 'you@example.com',
      'access.phonePh': 'Phone',
      'access.contactHint': 'Give at least one. Claim codes go to email; if you only add a phone, we contact you there.',
      'access.proofLabel': 'ID / proof',
      'access.proofOptional': '(optional ï¿½ encouraged for BMC)',
      'access.proofAdd': 'Attach proof photo',
      'access.noteLabel': 'Anything else?',
      'access.notePh': 'Ward focus, how youï¿½ll use it, etc.',
      'access.submit': 'Submit request',
      'access.haveCode': 'I already have a claim code',
      'access.confirmTitle': 'Request received',
      'access.confirmBody': 'Thanks! The CivicRadar team will review your request and reach you with a claim code, usually within a few days. Enter that code in the app to unlock your access.',
      'access.confirmLocal': 'Saved on this device ï¿½ it will sync to the team when you are back online.',
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
      'access.codeCopied': 'Claim code copied ï¿½ share it with the applicant using their contact details.',
      'access.roleNgoTag': 'NGO coordinator',
      'access.roleBmcTag': 'BMC official',
      'access.statusApproved': 'Approved',
      'access.statusRejected': 'Rejected',
      'access.statusPending': 'Pending',
      'access.errName': 'Please add your name.',
      'access.errContact': 'Add an email or phone so we can reach you.',
      'access.submitted': 'Request sent ï¿½ we will review and reach you with your claim code.',
      'access.submittedLocal': 'Request saved ï¿½ we will sync and review it when you are online.',
      'access.submitError': 'Could not send ï¿½ your details are safe. Please try again.',
      'access.claimErrEmpty': 'Enter the claim code we sent you.',
      'access.claimErrInvalid': 'That code is not valid or not yet approved.',
      'access.claimErrUsed': 'That code has already been used.',
      'access.claimedNgo': 'Access unlocked ï¿½ welcome, coordinator!',
      'access.claimedBmc': 'BMC access unlocked ï¿½ review your ward queue.',
      'access.approvedToast': 'Approved ï¿½ claim code {code}',
      'access.rejectedToast': 'Request rejected.',
      'access.proofAttached': 'Proof attached',
      'access.proofTooBig': 'Image too large ï¿½ please attach a smaller photo.',
      'lead.title': 'Become a community lead',
      'lead.subtitle': 'Nominate yourself ï¿½ neighbours vote to grant access. No admin approval needed.',
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
      'lead.confirmBody': 'Share CivicRadar with neighbours ï¿½ you need 2 supports to unlock coordinator tools. If someone else runs for the same slot, you both need 5.',
      'lead.confirmLocal': "Saved on this device ï¿½ syncs when you're online.",
      'lead.viewCommunity': 'See candidates in Community',
      'lead.profileCta': 'Become a ward or neighbourhood lead',
      'lead.partnerCta': 'Become a community lead ï¿½ earn it with peer support',
      'lead.communityTitle': 'Community leads',
      'lead.communityHint': 'Support neighbours who volunteer to coordinate cleanups. 2 supports grants the role; 5 each if multiple candidates.',
      'lead.communityEmpty': 'No candidates yet in your ward ï¿½ nominate yourself to get started.',
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
      'lead.nominated': 'Nomination submitted ï¿½ rally supports in Community!',
      'lead.nominatedLocal': 'Nomination saved ï¿½ syncs when you are online.',
      'lead.voted': 'Support counted ï¿½ thanks for backing a neighbour!',
      'lead.granted': 'Threshold reached ï¿½ coordinator access unlocked!',
      'lead.submitError': 'Could not submit ï¿½ please try again.',
      'lead.voteError': 'Could not register support ï¿½ please try again.',
    },
    hi: {
      'lang.name': '??????', 'lang.native': '??????',
      'nav.map': '????????', 'nav.community': '??????', 'nav.profile': '?????????',
      'fab.report': '???????',
      'header.context': '?????? ???? ????? ï¿½ ?????, ???? ?? ????',
      'header.contextCity': '{city} ?????? ï¿½ ???? ?????',
      'location.banner': '???? ??????? ?? ??? ????? ???? ?????',
      'location.bannerNearby': '???? ??????? ???? ?? ??-??? ?? ???????? ????? ?? ??? ????? ???? ?????',
      'location.unavailable': '?? ???????? ??? ????? ?????? ???? ???',
      'location.withdrawn': '????? ?? ????? ???? ?? ?? ??? ??????? ???? ??? ??? ?? ???? ?????',
      'location.dismiss': '????? ????? ??? ????',
      'location.locate': '???? ?????',
      'location.locateAria': '????? ???? ????',
      'location.enable': '???? ????',
      'coach.step': '#MonsoonGuardian ï¿½ 30 ???', 'coach.title': '????? ?? ??????? ???? ????!',
      'coach.body': '??????? ?????, ????? ??? ï¿½ ????? ????? ?? ???? ?????? Me too ???????, ????? ??? ????? WhatsApp ?? ???? ????!',
      'coach.spotTip': '??? ??????? ???? ?????? ????? ?? ???? ???? ???? ï¿½ ????, ??? ???? ?? ???? ???? ï¿½ CivicRadar ????? ?? ???? ?? ?? ??? ???? ???? ?????? ??? ????',
      'coach.got': '??? ???? ????',
      'tour.skip': '??????', 'tour.next': '???', 'tour.done': '??? ???',
      'tour.replay': '?? ??? ??? ?????',
      'tour.map.title': '???? ????? ?????',
      'tour.map.body': '?? ???? ????? ????? ??? ????? ?? ???? ???? ??? ?? ??? ??? ????? ????',
      'tour.report.title': '30 ????? ??? ???????',
      'tour.report.body': '???? ???? ??????? ???? ?? ??? ???? ????? ï¿½ ?????? 30 ????? ???? ????',
      'tour.metoo.title': '????????? ?? ??? ???',
      'tour.metoo.body': '??? ??? ???? ?? ??? ??? ???? ???? ?? ï¿½Me tooï¿½ ????? ???? {corp} ?? ???? ?????',
      'tour.profile.title': 'Civic Points ?? ???????',
      'tour.profile.body': '???? Civic Points ?? ??????? ???? ????????? ??? ??????',
      'persona.citizen.idle': '?? ???? ???? = ????? ?? ????? ??????? ????? ï¿½ 30 ??? ??? ????? ????? ??, WhatsApp ?? ???? ?????',
      'persona.wardImpact': '{ward}: {n} ?????? ??????? ???? ï¿½ ???? ??? ?? ?????-????? ?????',
      'persona.unfiled': '{n} ???? ???? ????? ???????? ?? ï¿½ ????????? ?? ??? ???? ???? ?? ????????? ??? ???????? ?????? ???? ?????',
      'persona.pendingFiled': '{n} ???? ???? ????????? ?? ??? ??? ??? ï¿½ ?????? ?? ?? ????????? ??? ??? ???????',
      'onboard.title': 'CivicRadar ??? ???? ?????? ??',
      'onboard.subtitle': '30 ??? ??? ????? ???????? ?? ??? ?????',
      'onboard.ward': '???? ?????', 'onboard.wardPh': '???? ????? ???? ???? ???? ????ï¿½',
      'onboard.wardHint': '{city} ?? {n} ???????? ??????? ??? ?? ??????',
      'onboard.city': '???? ???',
      'onboard.cityHint': '????? ?? ?? ???? ???? ??? ï¿½ ???? ??? GPS ?? ????? ??????',
      'city.mumbai': '?????',
      'city.pune': '????',
      'city.thane': '????',
      'onboard.wardDetecting': '???? ????? ?? ????? ?????? ?? ??? ??ï¿½',
      'onboard.wardDetectedHint': 'GPS ?? ???????? ????? ï¿½ ???????? ???? ????????? ?????',
      'onboard.wardManual': '??? ??? ???????? ?????',
      'onboard.wardRetry': '??? ?? ???????',
      'onboard.wardDetectFailed': '????? ???? ???? ï¿½ ???????? ????? ?? ?????? ?????? ????',
      'onboard.name': '????????? ???',       'onboard.namePh': '?????? ???? ???? ?????',
      'onboard.join': '????? ?? ??????',
      'report.title': '???? ?? ??????? ????',
      'report.step.photo': '?????', 'report.step.details': '?????', 'report.step.submit': '?????',
      'report.hazardType': '???? ?? ??????', 'report.photoEvidence': '????? ??????',
      'report.capture': '????? ???',
      'report.notes': '??????? (????????)', 'report.notesPh': '???? ?? ????? ????ï¿½',
      'report.submit': '??????? ?????',
      'report.confirmRelevant.label': '???, ?? ????? ???????? ???? ?????? ?? ï¿½ ?????, ????????? ?? ???????? ??????? ?????',
      'report.confirmRelevant.error': '????? ?????? ???? ?? ????? ???? ?????? ??, ?? ??? ?? ????? ????',
      'moderation.guidelines': '???????? ???? ??? ???? ?? ????? ??? ï¿½ ?????, ????????? ?? ???????? ??????? ????? ????? ???? ???????? ?? ??? ????? ???? ???',
      'moderation.scanning': '????? ??????? ???? ?? ??? ??ï¿½',
      'moderation.blocked.fileType': '???? JPEG, PNG ?? WebP hazard ????? ??????? ????',
      'moderation.blocked.fileSize': '????? ???? ???? ??? ???? ??? ?? ????? ???? (?????? 8 MB)?',
      'moderation.blocked.lowQuality': '????? ???? ???? ?? ??????? ??? ???? ?? ??? ?????',
      'moderation.blocked.irrelevant': '???? ?? ????? ??? ï¿½ ???????, ????????? ?? ???? ????? ?????',
      'moderation.blocked.sensitive': 'ID, ????????? ?? ?????????? ?? ????? ???? ???? ???????',
      'moderation.blocked.nsfw': '?????? ??????? ?? ???? ?? ????? ????? ?? ???',
      'moderation.blocked.offline': '????? ??????? ???? ?? ??? ??????? ?? ???????',
      'success.title': '??????? ????', 'success.tagline': '???? ????? ???????? ?? ??? ???? ???',
      'success.taglineNeighbours': '{n} ?????? ??? ?? ????? ?? ?????? ?? ??? ??? ï¿½ ???? ??????? ?? ????? ???????? ?? ??? ??? ??!',
      'success.subtitle': '????????: ?????? ???? ???? ???? ?? ??? {corp} ??? ???????? ?????? ???? ???? (????????)?',
      'success.step1': 'WhatsApp ?? ???? ???? ???? ?????? ????? ???????? ?? ??? ?????',
      'success.step2': '????????: {corp} ??? ???? ???? ?? ?????? ???? ??????',
      'success.step3': '????????? ?? {corp} ??? ???? ?? ?????? ?? ???? ??? ï¿½ ????? ??? ???????',
      'success.file': '???????? ?????? ???? ???? (????????)',
      'success.fileCorp': '{corp} ??? ???????? ?????? (????????)',
      'success.tag': '@mybmc ?? ??? ????', 'success.alert': '????????? ?? ????? ????', 'success.done': '?? ???',
      'success.sharePrompt': '??? WhatsApp ?? ????? ï¿½ ??????? ???? = ????? ???? ????? ?? ???? ?? ?? ???? ????!',
      'success.shareWhatsapp': 'WhatsApp ?? ???? ????',
      'share.nativeShare': '???? ????',
      'success.shareNudge': '????????? ?? ??? ??? ???? ï¿½ WhatsApp ?? ???? ????, ????? ????? ?? ?? ?????? ??? ???? ????',
      'success.shareMsg': '?? {ward} ??? {hazard} ï¿½ ????? ?? ????! CivicRadar ????? ????? ?? ????\nMe too ???? ?? ???? ??? ??????? ????:\n{link}\n{hashtags}',
      'share.appMsg': '??? {city} ?????? ????? ï¿½ ???? ???? ???, Me too ?????, ????????????? ????? ?? ?????!\n{link}\n{hashtags}',
      'share.defaultArea': '???? ?????',
      'share.meTooMsg': '?? ???? ?? ï¿½ {ward} ??? {hazard}? {n} ?????? CivicRadar ??:\n{link}\n{hashtags}',
      'share.meTooBtn': 'WhatsApp ?? ???? ????',
      'share.wardMapMsg': '? {ward}: {pending} ???? ?????-????? ????? ï¿½ CivicRadar ?? ???? ????!\n{link}\n{hashtags}',
      'share.cleanupMsg': '?? {ward} ??? ??????????? ?? {hazard} ??? ????! ???? ? ???:\n{link}\n{hashtags}',
      'share.instagramCaption': '{ward} ??? {hazard} ??? ?? CivicRadar ?? ???? ? ???? ?????? ????\n{link}\n{hashtags}',
      'share.instagramCleanupCaption': '{ward} ??? ??????????? ?? {hazard} ??? ???? ?? CivicRadar ?? ???? ? ????\n{link}\n{hashtags}',
      'share.milestoneMsg': '?? {ward} ?? {n} ?? ???? ???! ???? ??????\n{link}\n{hashtags}',
      'share.firstBonus': '???? ???? ï¿½ +10 Civic Points! ??',
      'shareWin.title': '??? ???? ????!',
      'shareWin.subtitle': '???? ? ??? ?????? ï¿½ ????????? ?? ???????',
      'shareWin.subtitleCleanup': '??????????? ?? ??? ???? ï¿½ ???????? ????? ??? ???? ?????',
      'shareWin.whatsapp': 'WhatsApp ?? ??? ???? ????',
      'shareWin.instagramHint': '??? ??? ???? ? Instagram Stories ?? ????? ????',
      'shareWin.downloadCard': '????? ????? ??????? ????',
      'shareWin.copyCaption': 'Instagram ?? ??? ?????? ???? ????',
      'shareWin.nativeShare': '??? ???? ????',
      'shareWin.cardDownloaded': '????? ??? ï¿½ Instagram ?? ????? ????',
      'shareWin.captionCopied': '?????? ???? ï¿½ Instagram ??? ????? ????',
      'shareWin.done': '?? ???',
      'shareWin.impact': '{n} ????????? ?? ?????? ???? ï¿½ {ward} ï¿½ ?? ??? ?????????? ????! ??',
      'about.shareTitle': '?? ???? ????',
      'about.sharePitch': '?????? {city} ?????? ????? ï¿½ 30 ??? ??? ???????, Me too, ????????????? ????? ?? ??????\n?????, ???? ?? ???? ?? ??? ????? ???? ????? ????, 4 ???????\n{link}\nRWA / ??????? WhatsApp ????? ??? ??????? ???? ?',
      'about.copyPitch': 'WhatsApp ??? ???? ????',
      'about.pitchCopied': '??? ???? ï¿½ RWA / ????? ????? ??? ????? ????!',
      'pwa.nudge': '??????-?????: ??? ??????? ?? CivicRadar ???????',
      'pwa.nudgeAction': '??? ??????? ?? ??????',
      'pwa.nudgeDismiss': '??? ????',
      'community.challengeShare': '????? ?? ?????? ï¿½ ????? ????? ???? ????',
      'community.winsTitle': '?? ?????? ?? ???',
      'community.winsEmpty': '?? ?? ?? ????? ???? ??????? ï¿½ ??????? ????, ????????? ?? ??????, ??? ??????',
      'community.winsNeighbours': '{ward} ??? ??????',
      'community.winsCleanup': '{hazard} ??? ï¿½ {ward}',
      'community.winsResolved': '{hazard} ?? ï¿½ {ward}',
      'success.points': '????? ??? ????', 'success.weekBonus': '+{n} ?? ?????? ?? ???? ???????!',
      'success.celebrateFirst': '?? ???? ????? ?? ????? ?? ??? ??? ï¿½ ?????? ????? ??????',
      'success.celebrateMilestone': '{n} ??????? ï¿½ ???? ??? ???? ??? ?? ????????!',
      'success.kudos1': '?????! ?? ?? ???? ???? ???',
      'success.kudos2': '?????? ??? ï¿½ ???? ????? ????? ?? ???????? ????',
      'success.kudos3': '???? ???! ????????? ?? ????? ???? ?? ??? ????????',
      'success.kudos4': '?? ??? ??? ?? ï¿½ ??? ??? ?????? ??? ???? ????',
      'success.kudos5': '?? ?? ??? ï¿½ ???? ??? ???? ???????? ???? ???',
      'success.progressOne': '???? ??? ?? ??? ?? 1 ?? ????????',
      'success.progressMany': '???? ??? ?? ??? {n} ?? ????????',
      'success.progressMilestone': '??? ????! ???? ?? ??? {n} ???',
      'success.progressGuardian': '{n} ??????? ?? ???? ï¿½ ????? Monsoon Guardian?',
      'success.shareBrag': '???? ???? ????? ?? ??? ?? ï¿½ ????????? ?? WhatsApp ?? ?????!',
      'success.shareBragFirst': '????? ?? ???? ???! ??? ???? ???? ï¿½ Monsoon Guardian ?? ????? ????? ???',
      'toast.badgeMonsoon': '?????? ??, Monsoon Guardian! ???',
      'confirm.meTooThanks': 'Me too ???? ï¿½ ?????? ???? ??? ??? ????',
      'toast.reportMilestone': '{n} ??????? ï¿½ ???? ????!',
      'map.empty': '{ward} ??? ??? ????? ï¿½ #MonsoonGuardian ????! ????? ????? ?? ???? ???? ???? ??????? ?????',
      'map.emptyHint': '????? ?? ??? ? ???? ? ~30 ????? ??? ?????? ?????? ??? ????? ?? ????????',
      'map.emptyAction': '???? ???? ??????? ????',
      'map.emptyShare': 'WhatsApp ?? ????????? ?? ??????',
      'map.emptyRival': '{ward} ???? {rival} ï¿½ ???? {pending} ???? ?????? ??????? ???? ?? ????????? ?? ??????!',
      'home.hero.badge': '#MonsoonGuardian',
      'home.hero.headline': '???? ????? ????? ?? ???? ???? ??????? ????',
      'home.hero.subline': '????? ????? ï¿½ ????????? ?? BMC ?? ???? ????, ????? ????? ?????',
      'home.hero.benefit1': '30 ????? ???',
      'home.hero.benefit2': '?????? ????',
      'home.hero.benefit3': 'BMC ????',
      'home.hero.cta': '???? ???? ??????? ????',
      'home.hero.tour': '???? ??? ???? ??',
      'home.hero.trust': '?????? ï¿½ ???? ????? ï¿½ ??????? ï¿½ ?????, ???? ?? ????',
      'home.hero.dismiss': '?????? ????? ??? ????',
      'reminder.unfiled': '{n} ???? ???? ???????? ?? ï¿½ ????????? ?? ??? ???? ???? ?? ????????? ??? ???????? ??? ?? ???? ?????',
      'reminder.file': '??? ???? ????',
      'reminder.snooze3d': '3 ??? ??? ??? ??????',
      'reminder.gotIt': '??? ??',
      'reminder.esc7': '???? ???? ?? {n}+ ??? ï¿½ {ward} ??? {hazard} ?? ??? ????? ??????????',
      'reminder.esc14': '???? ???? ?? {n}+ ??? ï¿½ {ward} ??? {hazard} ?? ??? ????? ??????????',
      'reminder.esc30': '???? ???? ?? {n}+ ??? ï¿½ {ward} ??? {hazard} ?? ??? ??????/RTI?',
      'reminder.escAction': '???????? ????',
      'reminder.corroboration': '{n} ?????? ?? ???? {hazard} ??????? ?? "???? ??" ??? ï¿½ ????? ????? ?? ?? ?????? ??? ???? ????',
      'reminder.corroAction': '??????? ?????',
      'reminder.cleanup': '??????????? ?? {ward} ??? {hazard} ??? ???? ï¿½ {corp} ?????? ???????? ??? ?? ???? ?? ???? ???',
      'reminder.cleanupAction': '?????? ?????',
      'persona.ngo.pledges': '{deliver} ????? ï¿½ {verify} ???????',
      'persona.ngo.newHazards': '????? ??? {n} ?? ????',
      'persona.ngo.newPledges': '{n} ?? ?????????',
      'persona.admin.overdue': '{overdue} ?????? ï¿½ {pending} ????? ï¿½ ???? ?????',
      'profile.badge.reporter': '?????? ????????',
      'profile.badge.2week': '2-?????? ????????',
      'profile.badge.3week': '3-?????? ????????',
      'profile.badge.monsoon': '?????? ?????',
      'profile.wardImpact': '???? ?????: ?? ?????? {n} ???????',
      'profile.streak': '{n}-?????? ?????????? ???????',
      'confirm.nearby': '??? {m} ??. ???{backing}? ????????? ?? ??? ???? ?? ????? ï¿½ ??? ???? ?? ??????',
      'esc.participate.title': '????????? ???????? (????????)',
      'esc.participate.hint': 'Participate Mumbai BMC ?? ???????? ?????????/CSR ?????? ?? ï¿½ ??? ???????? ???????? ?? ??? ????? ???? ?????? ?? ????? ?????????? ?? ??? ????? ?????',
      'esc.participate.btn': 'Participate Mumbai',
      'esc.participate.small': '????????? ï¿½ CSR ï¿½ ??????????',
      'esc.corpTitle': '??????? ??? ???? ??? ???? ???? (????????)',
      'esc.corpHint': '{corp} ?? ???????? ?????? ?? ???? ???? / ??? ???????? ?????? ???? ?????',
      'esc.corpBtn': '{corp} ?????? ?????',
      'esc.corpSubtitle': 'CivicRadar ???? ????????? ???????? ?? ?????? ??? ??? ???? ??? ???? ???? ???????? ?? ï¿½ ?? ???????? ???? ???? ???? ???',
      'esc.titleCorp': '{corp} ??? ???? ???? (????????)',
      'community.title': '??????',
      'community.subtitle': '{ward} ??? ??? ????? ??? ???? ï¿½ ?????????, ????? ???, ?? ??? ?? {corp} ??? ???? ?????',
      'community.topWards': '????? ?????', 'community.localCitizens': '??????? ??????',
      'community.supportTitle': '??????????? ?? ??? ???',
      'community.supportBody': '???? ???? ?? ??? ??? ??????? ????? ?? ?? ??? ?? ??? ??????? ??? ?????',
      'community.pledge': '??? ????',
      'community.volunteerTitle': '???? ????? ??? ?????????',
      'community.volunteerBody': '??? ????? ??? ???? ï¿½ {corp} ??? ???? ???? ??? ???',
      'community.volunteerCta': '???? ??',
      'volunteer.title': '???? ????? ??? ?????????',
      'volunteer.subtitle': '????????? ?? ??? ????? ï¿½ ?????? ????????? ????????? ?????',
      'volunteer.neighbourhood': '????? / ??????? / ???',
      'volunteer.skill.cleanup': '???? ???? ?? ????',
      'volunteer.skill.awareness': '???????? ?? WhatsApp',
      'volunteer.skill.pledge': '??? ?????',
      'popup.helpClean': '??? ???? ??? ??? ?? ????/???? ???',
      'profile.volunteer': '???? ????????? ??????',
      'coord.volunteers': '???? ??????? ?? ?????????',
      'coord.tasks': '????????? ???? ????????',
      'inquiry.coordTitle': '????? ?? ????? ??????? ????',
      'about.becomeCoord': '????? ?? ????? ??????? ????',
      'pledge.notice': '???? ????? ?? NGO ??????? ??? ???? ?? ??? ?????? ï¿½ BMC ????? ?? ?? ??? ?????? ?? ???? ???; ??? ???????? ???/SMS ?????',
      'pledge.status.pledged': '??? ????',
      'pledge.status.delivered': '??????',
      'pledge.status.verified': '???????? (+200 ???)',
      'toast.pledgeSaved': '??? ???? ï¿½ ???? ????? ??????? ?? ?? ??? ???????',
      'toast.pledgeDuplicate': '?? ????? ?? ??????? ?? ??? ???? ?? ???? ????????? ???',
      'toast.pledgeWardMismatch': '?? ???? ????? ?? ??? ?? ï¿½ ???? ?? ??????? ?????????',
      'toast.pledgeStatusDelivered': '??????? ?? ???? ????????? ?????? ??????? ???',
      'toast.pledgeStatusVerified': '????????? ???? ???????? ï¿½ +200 ????? ???!',
      'toast.ngoNewPledge': '???? ????? ??? {n} ?? ?????? ??????????',
      'toast.ngoNewPledgeAction': '?? ?????',
      'coord.pledgesNew': '?????? ??????????? ï¿½ {n} ??',
      'coord.pledgesEmpty': '??? ??? ????????? ????? ???? ????? ?? ????????? ?? ??? Community ??? ???? ?????',
      'coord.markDelivered': '?????? ??????? ????',
      'coord.verifyHours': '???? ???????? (+200)',
      'coord.verified': '????????',
      'profile.pledges': '???? ???????????',
      'profile.pledgesEmpty': '??? ??? ????????? ????? Community ?? ??????? ??????????? ?? ??? ????',
      'profile.pledgesEmptyAction': '??? ????',
      'profile.title': '???? ?????????', 'profile.persona': '??????',
      'profile.points': '??? ????? ???', 'profile.fixed': '?? ??? ????', 'profile.pending': '???? ????',
      'profile.reports': '???? ?????????',
      'profile.install': 'CivicRadar ?? ??????? ????', 'profile.partner': '????????? / NGO ?????',
      'profile.about': 'CivicRadar ?? ???? ???', 'profile.sponsor': '???????? ?? ??????? ????',
      'profile.deleteData': '???? ???? ?????',
      'profile.deleteConfirm': '?? ????? ?? ?????? ?? ???? ???????, ????????? ?? ????????? ?????? ??? ?? ?????? ??????? ???? ?? ?????',
      'profile.deleteDone': '???? ???? ??? ???? ???? ?? ?? ???? ?? ???? ?? ???? ????',
      'legal.privacy': '???????? ????',
      'legal.terms': '???? ?? ??????',
      'impact.reports': '???????', 'impact.resolved': '??', 'impact.confirms': '???? ??',
      'impact.pledges': '???', 'impact.wards': '?????',
      'impact.week': '?? ??????: {reports} ??????? ï¿½ {resolved} ?? ï¿½ {confirms} ??????',
      'impact.resolvedBreakdown': '??: {self} ï¿½ ??????: {community} ï¿½ BMC: {bmc} ï¿½ ????: {cleanup}',
      'about.title': 'CivicRadar ?? ???? ???',
      'about.subtitle': '?????, ???? ?? ???? ?? ??? ????????? ????? ????? ï¿½ ?????? ????????? ????? ?????',
      'about.impactTitle': '????????? ??????', 'about.builtTitle': '???? ???? ?????',
      'about.differentTitle': 'CivicRadar ??? ????? ??',
      'about.different1': '???? ????? ????? + ???? ??? ï¿½ ?????? Me too ?? ?????? ???? ???, ?????? ????????? ????? ????',
      'about.different2': '????? ??????: ???? CivicRadar ?? ???, ??? ????? ?? ??-??? ???????? ???? (BMC 1916/MyBMC, PMC CARE, TMC)',
      'about.different3': '??????? ??? ???? ?? ï¿½ ??? ??????? ?? ??????, ???? ?????, 4 ??????',
      'about.different4': '??? ???? ?? ????? ï¿½ ????????? ????????, Civic Points, ?? ???? ?? ????????? ???',
      'about.sustainTitle': '????? ?? ???????? ?? ??? ????????',
      'about.sustainBody': 'CivicRadar ????????? ?? ??? ????? ???????? ?????? ?????? ?? ?? ????? ??????? ???????? ?? ??? ?? ï¿½ ????????? ??????? ?? ????? ?????',
      'about.copyImpact': '?????? ?????? ???? ????', 'about.contact': '???? ?????? ????', 'about.contactOperator': '???? ?????? ????', 'about.close': '???',
      'about.sponsored': '?????????', 'about.copied': '?????? ?????? ???? ?? ??? ï¿½ ???? ????? ??? ????????',
      'about.operatorNote': '{name} ?? 18 ??? ???? ??, {operator} ???? ??????? ???? ??? ï¿½ ????????, ???? ?? ?????? ???????',
      'inquiry.title': 'CivicRadar ?? ??? ????????',
      'inquiry.subtitle': '?????, ???? ?? ???? ?? ???????? ?? ??????? ï¿½ ?? ??????? ??? ?? ???? ??? ?????????? ????',
      'inquiry.localTitle': '??????? ??????? ????????',
      'inquiry.localBody': '??????? ??????? ??? ???????? ?? ??????-?????? ???? ???????? ?????',
      'inquiry.bmcTitle': '????????? ?????',
      'inquiry.bmcBody': '???-????? ???????? ï¿½ ???? ???????? BMC ????? ?? ???? ??? ???? ?? ??? ?????? ?????',
      'inquiry.ngoTitle': 'NGO ?? ????????? ???????',
      'inquiry.ngoBody': '???, ????? ?? ??????? ?? ????????? ????? ?? ???????',
      'inquiry.email': '???????? ?????? ?????',
      'lang.title': '???? ???? ?????',
      'hazard.stagnant-water': '???? ??? ????', 'hazard.potholes': '?????',
      'hazard.garbage': '????', 'hazard.streetlight': '???? ???????????',
      'hazard.comingSoon': '???? ? ??? ??',
      'soon.title': '???? ? ??? ??', 'soon.notify': '???? ???? ?? ???? ????? ????',
      'soon.thanks': '??????? ï¿½ ????? ???? ?? ?? ???? ????? ???????',
      'soon.roadmap': '?? ???? ?????? ???? ï¿½ ????, ????? ?? ??????????? ?? ???? ????',
      'confirm.metoo': '???? ??', 'confirm.you': '???? ???????',
      'confirm.done': '????? ?? ??? ??? ï¿½ ??? ???? ?? ?????',
      'confirm.thanks': '????? ???? ï¿½ ??? ???? ?? ????? ???????',
      'confirm.none': '???? ?????? ???? ???? ???? ????',
      'confirm.followHint': 'BMC ?????? ???? ï¿½ ?????? ??? ?? ?????? ?? ??????',
      'confirm.backingOne': ' ï¿½ 1 ?????? ?? ??????',
      'confirm.backingMany': ' ï¿½ {n} ????????? ?? ??????',
      'confirm.dupe': '10 ??. ?? ???? CivicRadar ?? ??? ??{backing}? ?????? ???? ï¿½ ??? ???? ?? ??????',
      'confirm.dupeAction': '???? ??',
      'confirm.ownDupe': '???? ???? ???? ?? ??? ???? ??? ????????? ??? ??????',
      'profile.unfiledBanner': '{n} ???? ï¿½ {corp} ??? ??? ???? ????? ???? ???? ?? ??? ???? ??; ???????? ???? ???? ?? ?? ????? ?? ??? ???????',
      'profile.fileNext': '???? ???? ????',
      'confirm.resolved': '{ward} ??? ??? ???? ?? ???? ?????? ???? ?? ??? ?? ???!',
      'confirm.resolvedMany': '???? ??? {n} ????? ?? ?????? ???? ?? ??? ??? ?? ??!',
      'confirm.shareBtn': '???? ????',
      'confirm.shareMsg': '? {ward} ??? ??? ???? ?? ????? ?? CivicRadar ?? ???! ??????? ???? ??? ???? ??:\n{link}\n{hashtags}',
      'fix.looksFixed': '?? ??? ???? ??',
      'fix.done': '???? ??? ???',
      'fix.thanks': '??????? ï¿½ ???????? ?????? ???? ???? ?? ?? ??? ??? ??????? ???????',
      'fix.countOne': '1 ?????? ???? ?? ??? ??',
      'fix.countMany': '{n} ?????? ???? ??? ??? ??',
      'fix.hint': '???? ?????? ???? ï¿½ ???????? BMC ?????? ?????',
      'fix.resolved': '{ward} ??? ??? ????? ?? ???? ???? ?? ?? ??????-???????? ???!',
      'fix.resolvedMany': '???? ??? {n} ??????? ?? ???? ?? ?? ??????-???????? ???!',
      'fix.afterPhotoPrompt': '????????: ????????? ?? ??? ?? ???? ???????',
      'reminder.staleCheck': '{ward} ?? ??? ï¿½ ??? ?? stagnant?',
      'reminder.stillThere': '??? ?? ??',
      'reminder.looksFixed': '??? ???? ??',
      'reminder.addPhoto': '????? ??????',
      'settings.title': '??? ?????? ????',
      'settings.reminder.label': '??? ??? ???? ???? ??????? ???? ?? ??? ??????',
      'settings.reminder.sub': '?? ?? CivicRadar ????? ?? ?????? ??? ????? ???? ??? ?????????? ???????? ?????',
      'settings.reminder.on': '??? ???? ï¿½ ?? ?? CivicRadar ???????, ?? ????? ?? ??? ?????????',
      'settings.reminder.off': '??? ????',
      'settings.reminder.denied': '??????? ????? ??? ï¿½ ?? ???? ???? ?? ??? ????? ??? ?????????',
      'notify.report.title': '?? ???? ???? ?????',
      'notify.report.body': '??? ????, ??? ???? ?? ???? ???? ??? ?? ???????, ?? 30 ????? ??? ??????? ?????',
      'notify.report.cta': '??? ??????? ????',
      'profile.status.communityVerified': '?????? ?? ??? ?? ??????',
      'profile.status.youMarkedFixed': '???? ??? ???????',
      'profile.status.bmcResolved': 'BMC ?? ?? ????',
      'profile.badge.communityVerified': '?????? ????????',
      'profile.badge.youMarkedFixed': '???? ???????',
      'profile.badge.bmcResolved': 'BMC ??',
      'community.winsCommunityVerified': '{hazard} ??????-???????? ï¿½ {ward}',
      'shareWin.subtitleCommunity': '????????? ?? ?????? ?? ï¿½ ???????? BMC ??????? ?????',
      'toast.fixConfirmed': '+10 ??? ï¿½ ???? ?? ??? ???????!',
      'toast.communityResolved': '??????-???????? ??? ï¿½ ??????? ?? ??? ???????!',
      'sync.cloud': '???? ?? ??? ??',
      'sync.local': '???? ???????',
      'sync.cloudTitle': '??????? ??? ??????? ?? ???? ???? ???',
      'sync.localTitle': '???? ?? ????? ?? ï¿½ ?????? ?????? ???? ?? ???? ????',
      'map.legend.aria': '????? ????????: ????, ???, ?? ??',
      'report.submitting': '???? ?? ??? ??ï¿½',
      'success.clock': '????????? ???????? ?? ï¿½ {corp} ??? ??? ???? ?????',
      'community.subtitleActive': '{ward}: {pending} ???? ???? ï¿½ {resolved} ??? ????????? ?? ??????!',
      'community.challenge.empty': '{ward} ??? ?????? ????? ?? ???? ???? ï¿½ ?? ?? ??????? ?????',
      'community.challenge.beat': '{ward}: {pending} ?????-????? ????? ï¿½ {rival} ({rivalPending} ?????) ?? ???! ??',
      'community.challenge.leading': '{ward} {resolved} ?? ?? ??? ?????? ï¿½ {rival} ?? ??? ????!',
      'community.challenge.catch': '{ward}: {leader} ({leaderResolved} ??) ?? ???? ????? ?????? ????????? ???? ??? ?? ?????',
      'community.challenge.leaderboard': '{leader} {resolved} ?? ?? ??? ????? ?? ï¿½ ???? ????? ????',
      'leaderboard.demo': '????', 'leaderboard.you': '??',
      'leaderboard.demoNote': '???? ????? ??????? ???? ?? ????? ????? ???????? ?????? ????? ???????',
      'leaderboard.resolved': '{n} ??', 'leaderboard.emptyWards': '???? ????? ?? ????? ?? ????? ?? ??? ??????? ?????',
      'leaderboard.emptyCitizens': '??????? ????? ?? ??? ?? ??? ??????? ???? ?????',
      'leaderboard.emptyFirst': '???? ????? ??? ???? ???? ï¿½ ????? ?? ????? ?? ??? ??????? ?????',
      'admin.proofBefore': '???? (?????? ???????)', 'admin.proofAfter': '??? (BMC ??????)',
      'admin.proofCapture': '?????? ????? ??????', 'admin.proofHint': '???? "???" ????? ï¿½ ?????? ????/??? ????????',
      'admin.proofPrompt': '??? ?? ????? ??????, ??? ?????? ?? ??? ??? ??? ?????',
      'admin.proofRequired': '?????? ????? ?????? ï¿½ ?? ???? ?? ???? "???" ?? ????? ???????',
      'admin.confirmResolve': '?? ?? ???????',
      'admin.exportCsv': '????? CSV ???????',
      'admin.exportEmpty': '?? ??????? ?? ??? ??????? ???? ?? ??? ??????? ?????',
      'admin.exportSuccess': '{n} ??????? CSV ??? ????????',
      'admin.copy1916': '1916 ?? ??? ????',
      'admin.copy1916Copied': '???? ?? ??? ï¿½ 1916 ??? ???????',
      'profile.proofBefore': '????', 'profile.proofAfter': '???',
      'confirm.shareResolvedMsg': '? {ward} ??? ???! CivicRadar ?? ???? ? ??? ??????:\n{link}\n{hashtags}',
      'esc.title': '???????? ?????? ?????', 'esc.subtitle': 'CivicRadar ???? ????????? ???????? ?? ?????? ??? BMC ??? ???? ???? ???????? ?? ????? ???????? ???? ???? ???? ?? ï¿½ ?? ???????? BMC ???? ???? ???',
      'esc.fileTitle': '?????? ???? ???? (????????)', 'esc.fileHint': '???? ???? ???? ????? ?? ??? ???????? ??????? ?? ???? ??? ??? ?? ????:',
      'esc.recommended': '????????: MyBMC WhatsApp ï¿½ ??????? Mumbai ??????? ?? ??? ???? ?????',
      'esc.channelWa': '?????? ï¿½ ???? ?? ???? ????', 'esc.channelCall': '24ï¿½7 ?????????', 'esc.channelPortal': '?????? ??????', 'esc.channelTweet': '????????? ????',
      'esc.margApp': 'MyBMC MARG ??', 'esc.margAppSmall': '???????? ?????? ??',
      'esc.copyBlock': '1916 / ?????? / ?? ?? ??? ?????', 'esc.copyAll': '??? ????? ???? ????', 'esc.copyAllDone': '???? ?? ??? ï¿½ ???????? ???? ?? ???? ???? ??? ???????',
      'esc.copyBilingual': '??? ?????: ??????? ????? ??? ????? ?????? ??? ???? ????',
      'esc.portalHint': '?????? ?? MARG ??: Public Health ? Pest Control ? stagnant water ?????? ???? ????? ????????',
      'esc.filedConsent': '????? ???????? BMC ???? ?? ???? ???? (1916 / MyBMC / ?????? / ??)',
      'esc.complaintWarn': '?? ??????? BMC ???? ???? ???? ???? ï¿½ ??? ?? ?? ??? ?? ???????',
      'esc.saveUnlock': '?????? ?? ???: ????????? ?????, ???-?????, ????-?? ????????',
      'esc.closeNudge': '?????? ???? ??? ????? ???? ï¿½ Profile ?? ??? ?? ???? ?? ???? ????',
      'esc.daysSince': 'BMC ??? ???? ??? {n} ???',
      'esc.progress.reported': '???????', 'esc.progress.shared': '????', 'esc.progress.filed': '????', 'esc.progress.escalating': '????????', 'esc.progress.resolved': '??',
      'esc.tier.copyFollowUp': '????-?? ????', 'esc.tier.openWa': 'WhatsApp', 'esc.tier.openCall': '1916 ???', 'esc.tier.openTweet': '@mybmc', 'esc.tier.openAaple': 'Aaple Sarkar',
      'esc.copyFollowUpDone': '????-?? ???? ?? ???', 'esc.rtiDisclaimer': '???? ????????? RTI ???????? ï¿½ ?????? ???? ?????', 'esc.consentRequired': '?????? ?? ???? ???????? BMC ???? ?? ???? ?? ?????? ?????',
      'esc.complaintLabel': 'BMC ?????? ????', 'esc.complaintPh': '???. N/2026/123456',
      'esc.complaintHint': '???? ?????? ?? ???????? ???? ???? ???? ???', 'esc.filedNote': 'BMC ??? ???? ï¿½ ??? ???? ?? ??? ???????',
      'esc.ladderTitle': '??? ?????? ?? ?????', 'esc.selfTitle': 'BMC ?? ??? ?????', 'esc.selfBody': '??? ?????? ???? ï¿½ ??? ?? ??? ??? ??????',
      'esc.selfBtn': '?? ??????? ????', 'esc.aaple': 'Aaple Sarkar (?????)', 'esc.close': '???', 'esc.save': '??????',
      'esc.officialHint': '????? ?? ??????: {hint}',
      'official.title': '???????? ?????? ????', 'official.subtitle': '???????? ?????? ?? ?? ?????? ï¿½ CivicRadar ???? ?? ?? ???? ???? ?????',
      'official.alsoFile': '???????? ??? ?? ?? ???? ???? (????????)', 'official.copyDone': '???????? ?????? ?????? ???? ï¿½ ??/?????? ??? ???????',
      'official.categoryHint': '????? ?? ??????: {hint}', 'official.reportDate': '??????? ????',
      'official.photoGuidance': '???: ???? ???????? ?? ??? CivicRadar ???? ???????? ?? ??? ?????? ?????',
      'official.marg.label': 'MyBMC MARG', 'official.marg.small': '114 ????????? ï¿½ ???? ???? ï¿½ ????????',
      'official.swachhata.label': 'Swachhata-MoHUA', 'official.swachhata.small': 'MoHUA ???????? ï¿½ ????? ????????',
      'official.aaple.label': 'Aaple Sarkar', 'official.aaple.small': '?????????? ????? ?????? ??????',
      'official.pmc.label': 'PMC CARE', 'official.pmc.small': '???? ??? ???? ??',
      'official.tmc.label': 'TMC ?????? ??????', 'official.tmc.small': 'thanecity.gov.in',
      'official.bmcWa.label': 'MyBMC WhatsApp', 'official.bmcWa.small': '?????? ??? ??????',
      'official.bmcPortal.label': 'BMC ?????? ??????', 'official.bmcPortal.small': 'portal.mcgm.gov.in',
      'official.hint.marg.stagnant-water': 'Public Health ? Pest Control ? stagnant water',
      'official.hint.marg.garbage': 'Solid Waste ? garbage / drainage',
      'official.hint.swachhata.garbage': 'Garbage dump', 'official.hint.swachhata.stagnant-water': 'Choked drain (if drain-related)',
      'official.hint.pmc.stagnant-water': 'Health / mosquito breeding / stagnant water',
      'official.hint.pmc.garbage': 'Solid waste / garbage',
      'official.hint.aaple': '??????? ????? {corp} ????? ? Health / Water',
      'official.hint.tmc.stagnant-water': 'Water / Health dept (mosquito breeding)',
      'success.alsoOfficial': '???????? ??? ?? ?? ???? ????',
      'esc.tmc.recommended': '????????: thanecity.gov.in ?? ???? ???? ?? TMC ????????? 022-25331590 ?? ??? ?????',
      'esc.tmc.fileHint': '???? ???? / ????? ?????? ï¿½ ???? ???? ?? ???????? TMC ???? ?? ????? ?????',
      'esc.tmc.channelPortal': 'TMC ?????? ??????', 'esc.tmc.channelCall': 'TMC ?????????',
      'esc.tmc.channelEmail': '??? ?????? ?? ????', 'esc.tmc.channelTweet': '@TMCaTweetAway ?? ??? ????',
      'esc.tmc.channelCitizenCall': '?????? ??? ????? (155300)',
      'esc.tmc.copyBlock': 'TMC ?????? / ????????? / ???? ?? ??? ?????',
      'esc.tmc.copyAllDone': '???? ?? ??? ï¿½ TMC ??? ???? ???? ??? ???????',
      'esc.tmc.portalHint': 'thanecity.gov.in: ????? ? ?????? ?????? ?????? ? ?????? ???? ????? ???? ????? ????????',
      'esc.tmc.filedConsent': '????? ???????? TMC ???? ?? ???? ???? (?????? / ????????? / ???? / 155300 / Aaple Sarkar)',
      'esc.tmc.complaintLabel': 'TMC ?????? / ?????? ??????', 'esc.tmc.complaintPh': '???. TMC/2026/123456',
      'esc.tmc.complaintWarn': '?? ??????? TMC ?????? ???? ???? ???? ï¿½ ??? ?? ?? ??? ?? ???????',
      'esc.tmc.filedNote': 'TMC ??? ???? ï¿½ ??? ???? ?? ??? ???????', 'esc.tmc.daysSince': 'TMC ??? ???? ??? {n} ???',
      'esc.tmc.selfTitle': 'TMC ?? ??? ?????', 'esc.tmc.selfBody': 'TMC ?????? ??? ???? ?? ??? ?????? ???? ï¿½ ??? ?? ??? ??? ??????',
      'esc.tmc.aaple': 'Aaple Sarkar ï¿½ TMC ?? ??????? ????? ?????',
      'esc.tmc.deptTitle': '????? ?????? (?????????)', 'esc.tmc.deptHint': '???? ???? ????-?? ï¿½ ??, ?????????, ?? ??????? ?????????',
      'esc.tmc.dept.water': '??', 'esc.tmc.dept.health': '?????????', 'esc.tmc.dept.pollution': '??????? ????????',
      'esc.tmc.tier.file.body': '????????? thanecity.gov.in, 022-25331590 / 022-25331211, mc@thanecity.gov.in, ?? 155300? ?????? ?????? ???? ???????',
      'esc.tmc.tier.matrix.body': '????? ???????? ?? ????????? (022-25332685) ?? ????-??? TMC ?????? ?????? ?????? ?????',
      'esc.tmc.tier.zonal.body': '??? ?????? (mc@thanecity.gov.in) ?? ????????? @TMCaTweetAway ?? ???? ?? ??? ??? ?????',
      'esc.tmc.tier.grievance.body': '?? ????? ??? ??? Aaple Sarkar (grievances.maharashtra.gov.in) ï¿½ Thane Municipal Corporation ??????',
      'esc.tmc.tier.openCall': 'TMC ???', 'esc.tmc.tier.openTweet': '@TMCaTweetAway', 'esc.tmc.tier.openEmail': 'MC ????', 'esc.tmc.tier.openAaple': 'Aaple Sarkar',
      'esc.tmc.consentRequired': '?????? ?? ???? ???????? TMC ???? ?? ???? ?? ?????? ?????',
      'esc.pmc.subtitle': 'CivicRadar ???? ????????? ???????? ?? ?????? ??? PMC ??? ???? ???? ???????? ?? ï¿½ ?? ???????? ???? ???? ???? ??? ?? PMC ???? ???? ???',
      'esc.pmc.recommended': '????????: PMC CARE WhatsApp ï¿½ ??????? Pune ??????? ?? ??? ???? ?????',
      'esc.pmc.fileHint': '???? ???? ?? ????? ?????? PMC CARE ?? ?????? ?? ???? ??? ??? ?? ????:',
      'esc.pmc.channelWa': 'PMC CARE WhatsApp', 'esc.pmc.channelWaSmall': '??? ï¿½ ???? ?? ????',
      'esc.pmc.channelCall': '???-???? ?????????', 'esc.pmc.channelPortal': 'PMC CARE ??????',
      'esc.pmc.channelApp': 'PMC CARE ??', 'esc.pmc.channelAppSmall': 'Play Store ï¿½ App Store',
      'esc.pmc.copyBlock': 'PMC CARE / WhatsApp / ????????? ?? ??? ?????',
      'esc.pmc.copyAllDone': '???? ?? ??? ï¿½ PMC CARE / WhatsApp ?? ???? ???? ??? ???????',
      'esc.pmc.portalHint': 'PMC CARE ?????? ?? ??: ???? ???? / ????? ?????? ???? ????? ???? ????? ????????',
      'esc.pmc.filedConsent': '????? ???????? PMC ???? ?? ???? ???? (PMC CARE / WhatsApp / ????????? / ??)',
      'esc.pmc.complaintLabel': 'PMC ?????? / ?????? ??????', 'esc.pmc.complaintPh': '???. PMC/2026/123456',
      'esc.pmc.complaintWarn': '?? ??????? PMC ?????? ???? ???? ???? ï¿½ ??? ?? ?? ??? ?? ???????',
      'esc.pmc.filedNote': 'PMC ??? ???? ï¿½ ??? ???? ?? ??? ???????', 'esc.pmc.daysSince': 'PMC ??? ???? ??? {n} ???',
      'esc.pmc.selfTitle': 'PMC ?? ??? ?????', 'esc.pmc.selfBody': 'PMC ?????? ??? ???? ?? ??? ?????? ???? ï¿½ ??? ?? ??? ??? ??????',
      'esc.pmc.tier.file.body': '????????? PMC CARE ??????, WhatsApp, 1800 1030 222, ?? PMC CARE ??? ?????? ?????? ???? ???????',
      'esc.pmc.tier.matrix.body': 'PMC CARE ?? ???-???? ????????? ?? ????-??? ?????? ?????? ?????? ?????',
      'esc.pmc.tier.zonal.body': '????? ?? ???????? ???? ??? PMC CARE ?????? ?? WhatsApp ?? ???????? ?????',
      'esc.pmc.tier.grievance.body': '?? ????? ??? ??? Aaple Sarkar ï¿½ Pune Municipal Corporation ??????',
      'esc.pmc.tier.openWa': 'WhatsApp', 'esc.pmc.tier.openCall': 'PMC ?????????', 'esc.pmc.tier.openAaple': 'Aaple Sarkar',
      'esc.pmc.consentRequired': '?????? ?? ???? ???????? PMC ???? ?? ???? ?? ?????? ?????',
      'esc.pmc.aaple': 'Aaple Sarkar ï¿½ Pune Municipal Corporation ?? ??????? ????? ?????',
      'copy1916.pmc.header': 'PMC ?????? ????? (PMC CARE / WhatsApp / ????????? ?? ????-?????)',
      'copy1916.pmc.complaintNotFiled': 'PMC ?????? #: (??? ???? ????)', 'copy1916.pmc.complaintFiled': 'PMC ?????? #: {id}',
      'profile.fileCorp': '{corp} ??? ???? ????',
      'esc.tier.file.title': '1 ï¿½ ???????? ?????? ???? ????', 'esc.tier.file.body': '????????? ????? PCO ??? ???? ???? ???????',
      'esc.tier.matrix.title': '2 ï¿½ ??? {n}+ ï¿½ ?????', 'esc.tier.matrix.body': '7 ??? ?? BMC ???-????????? WCO / AMC ?? ?????? ?????',
      'esc.tier.zonal.title': '3 ï¿½ ??? {n}+ ï¿½ ?????', 'esc.tier.zonal.body': 'Zonal DMC ?? @mybmc ?? ????????? ?????',
      'esc.tier.grievance.title': '4 ï¿½ ??? {n}+ ï¿½ ?????? / RTI', 'esc.tier.grievance.body': '?? ????? ??? ??? Aaple Sarkar ?? RTI?',
      'profile.empty': '??? ??? ??????? ????? ??? ???? ?????', 'profile.emptyAction': '??? ??????? ????',
      'profile.trackEscalate': '????? / ??? ??????', 'profile.fileBmc': 'BMC ??? ???? ????',
      'profile.status.resolvedCitizen': '?? (???? ??????)', 'profile.status.resolvedBmc': 'BMC ?? ?? ????',
      'profile.status.notFiled': '????????? ???????? ?? ????',
      'profile.neighbourOne': '?????? ?? ???? ?? ???',
      'profile.neighbourMany': '????????? ?? ???? ?? ???',
      'profile.pointsHint.base': '50 ???/??????? ï¿½ +200 ?????????', 'profile.pointsHint.bonus': '{n} ï¿½ 50 ï¿½ +{bonus} ????',
      'profile.greeting': '??????, {name}', 'profile.greetingDefault': '??????, ??????', 'profile.selectWard': '????? ?????',
      'profile.society': '??????? / ????? (????????)',
      'profile.societyPh': '???? ??? ? ?? ?? ??????? / RWA ??? ?????',
      'profile.societyHintWard': '{ward} ??? {n} ??????? ï¿½ ???? ??????',
      'profile.societyHintNoWard': '??????? ????? ?? ??? ????? ??? ?????',
      'profile.societyHintCustom': '???? ??? ? ?? ?? ??????? / RWA ??? ??????',
      'profile.societyRegistry': '???? ??????? ?????? ??????? ?????',
      'map.youAreHere': '?? ???? ???',
      'about.subtitleNamed': '?????, ???? ?? ???? ?????? ï¿½ {name} ??????, ???????? ?? ??? ?????????',
      'safety.hide': '?????? / ??????', 'safety.hidden': '???? ???????? ?? ???????', 'safety.hideConfirm': '?? ??? ?? ??????? (??????? ???? ?????)',
      'popup.pending': '?????', 'popup.resolved': '??', 'popup.society': '??????? / ?????',
      'popup.communityCleared': '??????????? ?? ??? ???? ï¿½ {corp} ?????? ??? ???? ?? ???? ??',
      'profile.communityCleared': '??????????? ?? ??? ???? ï¿½ {corp} ?????? ??? ???? ?? ???? ??',
      'partner.title': '??????? ??????',
      'partner.subtitle': 'NGO ????????? ?? ??????????? ?? ???? ????????? ?????? ???????? ???',
      'partner.ngoTitle': 'NGO ???????',
      'partner.ngoBody': '??? ?????, ??????????? ?? ????? ?? ????? ???? ????',
      'partner.bmcTitle': '????????? ?????',
      'partner.bmcBody': '???????? BMC ????? ?? ??? ï¿½ ?????? ?? ??? ?????? ????',
      'admin.allWards': '??? ?????',
      'admin.avgDays': '??? ???',
      'admin.exitMode': 'BMC ??? ???',
      'admin.healthLoading': '????? ??? ?? ???ï¿½',
      'admin.healthSummary': '?? ????????? (????? 7 ???)',
      'admin.markResolved': '??? ??????? ????',
      'admin.overdue': '7+ ??? ?????',
      'admin.pending': '????',
      'admin.queueSubtitle': '?????? ??????? ?????, ?????????? ???, ?? ?????',
      'admin.queueTitle': '???? ????',
      'admin.reportTitle': '???? ???????',
      'admin.resolved': '???',
      'admin.resolveHint': '?????? ?? ??????? ï¿½ ??? ??? ?? ??????',
      'admin.returnMap': '????? ?? ????',
      'admin.reviewTag': 'BMC ???????',
      'admin.sort.confirmed': '???? ??????? ???? ??',
      'admin.sort.newest': '?????? ????',
      'admin.sort.oldest': '?????? ????',
      'admin.sort.overdue': '????? ????',
      'admin.subtitle': '?????? ???? ??????? ?? ????, ????? ???? ??????',
      'admin.title': 'BMC ?????',
      'badge.admin': 'BMC ?????',
      'badge.coord': '??????? ??',
      'coord.cleared': '?????? ?? ??? ????',
      'coord.codeHint': '????????? ?? ??? ????? ?? ï¿½ ????? ?? RWA/??????? ?????',
      'coord.exitMode': 'NGO ??? ???',
      'coord.hubSubtitle': '?????? ??? ?????, ????????? ???? ???????? ?????',
      'coord.hubTitle': '??????? ??',
      'coord.markTaskComplete': '????? ?????',
      'coord.openHazards': '????? ??? ???? ????',
      'coord.openLabel': '???? ????',
      'coord.pledges': '?????? ???',
      'coord.pledgesLabel': '???',
      'coord.scopeNbh': '????? ??? ï¿½ {label}',
      'coord.scopeWard': '????? ??? ï¿½ {ward}',
      'coord.subtitle': '??? ?????, ????????? ?????, ???? ???????? ?????',
      'coord.tasksEmpty': '??? ??? ??? ????? ???? ??? ?? "??? ??? ???? ??? ??? ??????" ??????',
      'coord.tasksPending': '?????',
      'coord.title': '??????? ?????',
      'coord.toVerify': '??????? ????',
      'coord.volunteersEmpty': '??? ??? ????????? ????? Community ??? ???? ?????',
      'coord.volunteersLabel': '?????????',
      'coord.workflow': '????? ? ????? ??? ? ????? ?????? ? ???? (+200 ???)',
      'copy1916.category.garbage': '???? / ??? ???????',
      'copy1916.category.potholes': '????? / ???? ?????',
      'copy1916.category.stagnant-water': '??? / ???? ???? (Public Health ? Pest Control)',
      'copy1916.category.streetlight': '???? ???????????',
      'copy1916.categoryLabel': '??????',
      'copy1916.civicradarLinkLabel': 'CivicRadar ????? (????????)',
      'copy1916.complaintFiled': 'BMC ?????? #: {id}',
      'copy1916.complaintNotFiled': 'BMC ?????? #: (??? ???? ????)',
      'copy1916.dateLabel': '?????',
      'copy1916.gpsLabel': 'GPS',
      'copy1916.gpsWarning': '? GPS {city} ?? ???? ???? ?? ï¿½ ???? ???? ?? ???? ??? ?????? ????',
      'copy1916.header': 'BMC ?????? ????? (1916 / MyBMC ??? ?? ????-?????)',
      'copy1916.landmarkLabel': '??????? ????????? / ???',
      'copy1916.linkLocalhostNote': '(?? ??????? ???? ?? ???? ??? ?????)',
      'copy1916.mapsLabel': 'Maps',
      'copy1916.marathiHeader': '--- ????? (??? ????? ?? ?????) ---',
      'copy1916.refId': '?????? (????????): CivicRadar ID {id}',
      'copy1916.wardLabel': '????? + ?????',
      'flow.legal': '??????',
      'flow.city': '???',
      'flow.ready': '?????',
      'flow.ward': '?????',
      'inquiry.coordBody': '???? RWA/??????? ?? ????? NGO ?? ?????? ???? ï¿½ ????????? ?????, ????? ??????, ??? ???? ???????? ????? ?????? ?? ?????? ??? ????',
      'map.legend.pending': '????',
      'map.legend.resolved': '???',
      'map.legend.you': '??',
      'onboard.wardError': '???? ?? ????? ????? ?? ?????? ?????? ????',
      'onboard.society': '??????? / ????? (????????)',
      'onboard.societyPh': '???? ??? ? ?? ?? ??????? / RWA ??? ?????',
      'onboard.societyHintNoWard': '???? ????? ????? ï¿½ ??? ??????? ??????',
      'onboard.societyHintWard': '{ward} ??? {n} ??????? ï¿½ ???? ??????',
      'onboard.societyHintCustom': '???? ??? ? ?? ?? ??????? / RWA ??? ??????',
      'persona.admin.exit': 'BMC ??? ???',
      'persona.admin.header': 'BMC ??????? ???',
      'persona.admin.idleEmpty': '??? ????? ??????? ????? ?? ??? ???? ????????',
      'persona.admin.idlePending': '{n} ????? ï¿½ ???? ????? ?? ??? ??? ??????',
      'persona.ngo.exit': 'NGO ??? ???',
      'persona.ngo.header': 'NGO ??????? ???',
      'pledge.message': '?????',
      'pledge.messagePh': '??????????? ?? ??? ???ï¿½',
      'pledge.submit': '??? ?????',
      'pledge.subtitle': '????? ??? ??????????? ?? ????? ????',
      'pledge.title': '??? ???',
      'pledge.type': '????? ?? ??????',
      'pledge.type.cleaning': '????? ?????',
      'pledge.type.snacks': '??????',
      'pledge.type.repellent': '????? repellent',
      'pledge.ward': '?????? ?????',
      'pledge.wardPh': '????? ?????ï¿½',
      'popup.taskOffered': '????????? ?? ??? ?? ????? ??',
      'profile.emptyList': '??? ??? ??????? ????? Report ????? ??? ?? ???? ???? ??? ?????',
      'profile.persona.admin': 'BMC ?????',
      'profile.persona.ngo': 'NGO ???????',
      'toast.adminVerified': 'BMC ?????? ???????? ï¿½ ????? ???? ??????',
      'toast.bmcLoginFail': '??? BMC ????????????',
      'toast.bmcMumbaiOnly': 'BMC ????? ???? Mumbai ?? ???? ???? ??? ???? ?? Profile ??? ???? ?????',
      'toast.bmcOnlyResolve': '???? ???????? BMC ??????? ?? ?? ???? ????',
      'toast.bmcUnauthorized': '?? ???? BMC ?????? ?? ??? ?????? ?????',
      'toast.citizenView': '?????? ????? ?? ?????',
      'toast.cleanupLogged': '?????? ????? ??? ï¿½ BMC ?????? ???????? ??? ?? ???? ?? ???? ???',
      'toast.codeInvalid': '?????? ?? ?????? ????',
      'toast.codeSent': '??? ???? ï¿½ ??????? ??????',
      'toast.linkSent': '????-?? ???? ???? ï¿½ ??????? ??????',
      'toast.authEmailFail': '????-?? ???? ???? ???? ?? ??? ï¿½ Supabase SMTP ?????? ?????? ?? ??? ????? ?????',
      'toast.authEmailOffline': '?????? ????-?? ?????? ???? ï¿½ ??????? ?????? ?? ??? ????? ?????',
      'toast.authEmailRateLimit': '???? ???? ????-?? ???? ï¿½ ??? ???? ????? ?? ??? ????? ?????',
      'toast.authEmailInvalid': '???? ??? ?????? ???? ?? ï¿½ ?????? ?? ??? ????? ?????',
      'toast.authEmailRedirect': '????-?? ?????????? URL ????? ???? ï¿½ Supabase Authentication ??? ???? ???? URL ???????',
      'toast.linkExpired': '????-?? ???? ?????? ï¿½ ??? ???? ???????',
      'toast.complaintFirst': '???? ?????? ???? ?????? ï¿½ ??? ???? ???????',
      'toast.complaintRequired': '???????? ?? ??? ?????? ???? ???? ?????',
      'toast.complaintSaved': '?????? ???? ????? ï¿½ ???????? ???? ?????',
      'toast.contactConfig': '?????? ???? ??? ???? ï¿½ ????????? ??? About ??????',
      'toast.coordScopeNbh': '????? ??? ï¿½ {label}',
      'toast.coordScopeWard': '????? ??????? ï¿½ ???? {ward}',
      'toast.copyFail': '???? ???? ??? ï¿½ ??????? ???????? ??????',
      'toast.govEmail': '???? gov.in / mcgm.gov.in ???? ????? ?????',
      'toast.gpsFail': 'GPS ???? ????? ?????? ???? ???? ??? ????? ?????',
      'toast.gpsRequired': '???? ??? ?? ??? GPS ???????',
      'toast.hazardTypeRequired': '?? ?????? ???? ?????? ??????',
      'toast.hoursVerified': '???? ????????! +200 Civic Points?',
      'toast.installed': 'CivicRadar ??????? ï¿½ ??? ??????? ?? ?????!',
      'toast.installHint': '???????? ???? ? Add to Home screen?',
      'toast.ngoCodeInvalid': '??? ?? ?????? NGO ????',
      'toast.ngoCodeRequired': '???? ?? NGO ?????? ??? ???? ?????',
      'toast.ngoLoginFail': '??? ??????? ????????????',
      'toast.ngoVerified': '??????? ???????? ï¿½ ??? ?? ????????? ??????',
      'toast.noLocation': '?? ???????? ??? ?????? ?????? ?????',
      'toast.onboardFirst': '??????? ?? ??? ????? ???? ?????',
      'toast.ownReportOnly': '???? ???? ??????? ?????? ?? ???? ????',
      'toast.photoRequired': '????? ?? ???? ????? ???????',
      'toast.pledgeDelivered': '????? ?????? ??????? ï¿½ ?? ???? ???????? ?????',
      'toast.pledgeWardRequired': '??? ?? ??? ?????? ????? ??????',
      'toast.proofAdded': '?????? ????? ????? ï¿½ ?????? ?? ??? ??? ??????',
      'toast.recentered': '????? ???? ??? ?? ?????????',
      'toast.reportNotFound': '??????? ???? ?????? ?? ?? ?????? ?? ?????',
      'toast.resolvedProof': '??? ??????? ï¿½ ????/??? ?????? ??????',
      'toast.resolveFail': '?????? ????? ???? ?? ????',
      'toast.saveFail': '????? ???? ?? ????',
      'toast.saving': '????? ?? ???ï¿½',
      'toast.selfResolved': '??? ??????? ï¿½ ????-?? ?? ??? ???????!',
      'toast.shareWin': '????????? ?? ??? ??? ???? ?????',
      'toast.storageFull': '??????? ??? ï¿½ ?????? ??????? ????? ??? ????? ?????',
      'toast.syncConnected': '?????? ï¿½ ??????? ??? ?????? ?? ?????',
      'toast.syncLocal': '?? ?????? ?? ????? ï¿½ ?????? ???? ??????? ??????',
      'toast.verifying': '???????? ?? ???ï¿½',
      'toast.volunteerNeighbourhoodRequired': '?????, ??????? ?? ??? ???? ?????',
      'toast.volunteerRemoved': '????????? ???? ?????',
      'toast.volunteerSaved': '????????? ???? ????? ï¿½ ????? ??????? ??? ???? ????',
      'toast.volunteerSignupRequired': '???? Community ??? ????????? ???? ?? ?????',
      'toast.volunteerSkillRequired': '?? ?? ?? ?? ????? ????? ????? ??? ?? ?????',
      'toast.volunteerTaskCompleted': '????? ????? ï¿½ ???????? ?? ??????',
      'toast.volunteerTaskDuplicate': '?? ???? ?? ?? ???? ??? ??? ?? ????? ?? ?????',
      'toast.volunteerTaskOffered': '??? ???? ï¿½ ??????? ???? ?? ????? ?? ????????',
      'toast.volunteerWardRequired': '???? ?????????? ??? ????? ??? ?????',
      'toast.wardRequired': '{city} ?? ???????? ???? ?? ????? ??????',
      'toast.welcome': '??????, {name}! ??????? ?? ??? ??????',
      'tos.accept': '??? 18+ ???, <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms</a> ?? <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a> ??????? ????/???? ???',
      'tos.age': '??????? ?? ?????? ???? ?? ??? 18+ ???? ??????? 18 ?? ??? ????-???/??????? ?? NSS ??????? (18+) ?? ??? ?? ??? ??? ?? Terms ??????? ?????',
      'tos.content': '???? ???? ?? ??-???? ?????? ???????, ID ?? ????????? ????? ?????',
      'tos.continue': '??? ?????',
      'tos.emergency': '???? ?? ??? ????? ??? ?? ???? ?? ?? 112 ???? ?????',
      'tos.gps': 'GPS ???? ????? ???? ???? ?? ??????? ????? ?? ???? ???? ?? ï¿½ Terms ????????? ?? ????',
      'tos.itAct': 'CivicRadar IT Act, 2000 ?? ??? ??????? ??? ????? ?? ??????????? ?????',
      'tos.notBmc': 'CivicRadar ???????? ?? ï¿½ BMC, PMC, TMC ?? ???? ?????? ?????? ?? ????? ?? ????? ???? ?????',
      'tos.share': 'WhatsApp, X ??? ?? ???? ?? ????????? ???? ??? ???? ?? ï¿½ ???? ????? ???',
      'tos.subtitle': 'CivicRadar ????? ?? ???? ????? ?? ??????? ?????',
      'tos.title': '???? ?? ??????',
      'volunteer.contact': '???? / WhatsApp (????????)',
      'volunteer.contactHint': '???????? ï¿½ ???? ?????/????? ??????? ?? ??????? CivicRadar ??? ???-??? ???? ?????',
      'volunteer.edit': '???? ??????? ????',
      'volunteer.empty': '??? ???? ?? ????? Community ?? ???? ??? ??? ??? ?????',
      'volunteer.emptyAction': '???? ????? ??? ?????????',
      'volunteer.hours': '?? ?????? ??? ?????? ????',
      'volunteer.hoursCustom': '?????',
      'volunteer.hoursLabel': '?? ?????? {n} ????',
      'volunteer.neighbourhoodHint': 'RWA, ??????? ?? ??? ï¿½ ????? ??? ???? ??????? ????? ?? ????????',
      'volunteer.neighbourhoodPh': '???? Phoenix Mills ???, Building 7 Worli',
      'volunteer.remove': '???? ???? ?????',
      'volunteer.skills': '??? ????? ??? ?? ????/???? ???',
      'volunteer.submit': '????????? ???? ??????',
      'volunteer.ward': '???? ?????',
      'admin.meta.reporter': '????????',
      'admin.meta.ward': '?????',
      'admin.meta.status': '??????',
      'admin.meta.lat': 'Lat',
      'admin.meta.lng': 'Lng',
      'admin.close': '???',
      'aria.close': '???',
      'aria.lang': '???? ?????',
      'aria.recenter': '????? ???? ??? ?? ???????? ????',
      'aria.leaderboard': '?????? ????????? ?? ???',
      'aria.profile': '?????????',
      'aria.report': '???? ???????',
      'aria.filterWard': '????? ?? ???????',
      'aria.sortReports': '??????? ????',
      'auth.demoTag.admin': '???? ?????? ï¿½ ????????? ??? BMC ???? ???????',
      'auth.demoTag.lead': '???? ?????? ï¿½ ????????? ??? ???? + NGO ??????',
      'auth.officialEmail': '???????? ????',
      'auth.emailHint': '???? gov.in / mcgm.gov.in ?? BMC ???????',
      'auth.sendCode': '????-?? ???? ?????',
      'auth.linkInstructions': '???? ???? ????? ?? ????-?? ???? ?? ??? ????? ?? ??? ???? ???? ï¿½ ?? ????-?? ???? ???? ????????',
      'auth.otpFallback': '6-??? ?? ??? ???',
      'auth.otp': '6-??? ???',
      'auth.verifyEnter': '???????? ???? ?? ??????',
      'auth.email': '????',
      'auth.ngoCode': 'NGO ?????? ???',
      'auth.ngoCodePh': 'CivicRadar ?????? ?????? ????',
      'auth.username': '????????',
      'auth.password': '???????',
      'auth.loginDemo': '????? (????)',
      'admin.health.noData': '?? ?????? ?? ??? ????? ???? ?????',
      'admin.health.deviceSource': '?????? ???? (????? 7 ???)',
      'admin.health.cloudSource': '?????? ???????? (??? ?????)',
      'admin.health.cloudUnavailable': '?????? ????????? ?????? ???? ï¿½ Supabase ??? analytics SQL ??????',
      'admin.health.connectSupabase': '???-?????? ????? ?? ??? Supabase ?????? ?????',
      'admin.health.sessions': '????',
      'admin.health.tabViews': '??? ????',
      'admin.health.reportsFiled': '??????? ????',
      'admin.health.corroborations': '???? ??',
      'admin.health.bmcFiled': 'BMC ????',
      'admin.health.resolved': '???',
      'about.founderDefault': 'CivicRadar ???',
      'about.teamLabel': 'CivicRadar ???',
      'about.teamRole': '????????? ?????? ???? ?????',
      'config.contactMissing': '(?????? ???????? ????)',
      'demo.badge': '???????? ????',
      'profile.withdrawAnalytics': '?????????? ????? ???? ???',
      'profile.withdrawAnalyticsDone': '?????????? ????? ???? ï¿½ ??????? ???? ????',
      'profile.withdrawGps': '????? ????? ???? ???',
      'profile.withdrawGpsDone': '????? ????? ???? ï¿½ ?????? ?? ?? ????? ???? ?? ???? ?????',
      'profile.privacyContact': '???????? / ?????? ??????',
      'toast.tosRequired': '?????? ???????? ?? ???? Terms ?? Privacy (18+) ??????? ?????',
      'tos.analytics': '?????? ????? ?????????? (????????) ??????????? ?????? ??? ??? ?????, GPS ?? ??? ???? ???? ?????',
      'tos.analyticsOptIn': '??? ?????? ????? ?????????? ?? ????? ????/???? ??? (???????? ï¿½ Profile ?? ??? ?? ????)',
      'volunteer.ageNote': 'Terms ?? ?????? 18+ ??????? 18 ?? ??? ????-???/??????? ?? NSS ??????? ?? ??? ?? ??? ????',
      'admin.meta.neighbourConfirm': ' ï¿½ {n} ?? ???? ?? ???',
      'coord.hazardsEmpty': '???? ??????? ??? ??? ??? ???? ???? ?????',
      'coord.volunteerOffers': '{n} ????????? ????????',
      'coord.hazardCleaned': '??? ????',
      'coord.logCleanup': '???? ???? ????',
      'admin.health.communityCleanups': '????????? ????',
      'admin.health.whatsappShares': 'WhatsApp ????',
      'admin.health.errors': '?????????',
      'admin.health.perfSamples': '???????? ?????',
      'admin.health.avgPerf': '??? ??? ??? (???????)',
      'admin.health.bufferedEvents': '??? ????? (??????)',
      'tracking.open': '?????????? ?? ????????',
      'tracking.title': '?????????? ?? ????????',
      'tracking.subtitle': '??????? ?????? ????????? ï¿½ ??????, ???????, ?????????, ????????',
      'tracking.period': '????',
      'tracking.days7': '????? 7 ???',
      'tracking.days30': '????? 30 ???',
      'tracking.days90': '????? 90 ???',
      'tracking.wardFilter': '?????',
      'tracking.sessions': '??????',
      'tracking.pwaInstalls': 'PWA ???????',
      'tracking.reports': '???????',
      'tracking.resolved': '???????',
      'tracking.pwaNote': 'PWA ??????? ???????? ??? (??? ??????? / standalone)? GitHub Pages ?? ????? ??????? ???? ???? ?? ?????',
      'tracking.loading': '????????? ??? ?? ???ï¿½',
      'tracking.sourceLocal': '?????? + ??????? ??????? (???? / ??????)',
      'tracking.sourceCloud': '?????? ????? (??? ??????????)',
      'tracking.sourceCloudFail': '?????? ????????? ?????? ???? ï¿½ Supabase ??? tracking SQL ??????',
      'tracking.reportsByCategory': '?????? ?????? ???????',
      'tracking.escalations': '???????? ???? ?????',
      'tracking.neighbourhoods': '????? / ??????? ??????',
      'tracking.reporters': '?????? ????????',
      'tracking.meToo': '???? ??',
      'tracking.filed': '???????? ????',
      'tracking.leads': '????? ???',
      'tracking.empty': '?? ???? ??? ??? ???? ?????',
      'tracking.pending': '????',
      'tracking.channelUnknown': '???? ????',
      'profile.neighbourOne': '?????? ?? ???? ?? ???',
      'profile.neighbourMany': '????????? ?? ???? ?? ???',
      'ref.welcomeTitle': '?? ?????? ?? ???? ?????? ??',
      'ref.welcomeBody': '{city} ?? ????? ?? ???? ?? {n} ??????? ???? ???? ????? ?? ???? ????? ????? ï¿½ ?? 30 ????? ??? ?? ??? ?????',
      'ref.welcomeBodyEmpty': '?? ?????? {city} ??? ???? ???? ?? ????? ????? ????? ??? ???? ???? ???? ï¿½ ?????? 30 ??????',
      'ref.welcomeCta': '????? ?????',
      'ref.welcomeReport': '????? ??????? ????',
      'ref.dismiss': '???????? ??? ????',
      'season.monsoonPrep': '?????? ? ??? ?? ??? ???? ???? ????? ?? ???? ???? ???? ???? ???? ï¿½ ????? ??? ?????',
      'season.monsoonPeak': '??? ?????? ??? ???? ???? ????? ?????? ??? ?? ???? ????? ??? ????? ??????? ?????',
      'season.ganesh': '???? ??????? ?? ??????? ?? ??? ???? ????? ???? ???? ï¿½ ????? ?? ??????? ????? ?? ??? ???? ???? ??????? ?????',
      'season.denguePeak': '????? ?? ???? ?? ????? ???? ???? ??? ????? ???? 30 ????? ?? ??????? ???? ??? ?? ????? ???? ???',
      'season.dismiss': '????? ????? ??? ????',
      'social.wardWeek': '?? ?? ?????? {ward} ??? {n} ????????? ?? ??????? ??',
      'social.wardWeekBacked': '?? ?? ?????? {ward} ??? {n} ??????? ï¿½ {c} ??????',
      'social.wardWeekEmpty': '?? ?????? {ward} ??? ???? ???? ??????? ???? ï¿½ ?????? ?????? ?? ?????? ???? ????',
      'recap.title': '?? ?????? ???? ?????',
      'recap.share': '????????? ?????? ???? ????',
      'share.weeklyRecap': '?? ?? ?????? ?????? {ward}: {reports} ?? ???????, {resolved} ???, {backed} ????????? ?? ?????? ????? CivicRadar ?? ?????? ??\n{link}\n{hashtags}',
      'feedback.menu': '????? ?????',
      'feedback.title': '????? ?????',
      'feedback.subtitle': '??? ??????? ???? ?? ??? ????? ??? ???? ????? ï¿½ ?? ???? ??? ?? ??????? ???',
      'feedback.categoryLabel': '??? ??? ?? ??????',
      'feedback.catIdea': '?????',
      'feedback.catBug': '???????',
      'feedback.catOther': '????',
      'feedback.messageLabel': '???? ?????',
      'feedback.messagePh': '???? ???, ?? CivicRadar ?? ????? ???? ????? ????',
      'feedback.contactLabel': '?????? (???????? ï¿½ ???? ??? ?? ???? ????? ???)',
      'feedback.contactPh': '???? ?? ????',
      'feedback.privacy': '?? ???? ?????? ??? ???? ???? ????? ???? ?? ????? ?? ???? ???? ?? ??? ????? ???? ???',
      'feedback.submit': '????? ?????',
      'feedback.errorEmpty': '????? ???? ?? ???? ????? ??????',
      'feedback.error': '???? ???? ?? ??? ï¿½ ???? ??????? ???????? ??? ????? ??? ?? ?????? ?????',
      'feedback.success': '???????! ???? ????? ??? ???? ????',
      'feedback.successLocal': '????? ??? ï¿½ ?????? ???? ?? ?? ??? ???? ?? ??????',
      'access.title': '??????? ?????? ?? ?????? ????',
      'access.subtitle': 'NGO ? ????????? ????????? ?? BMC ?????????? ?? ????',
      'access.step1': '??? ???? ??????? ?? ??? ????? ????',
      'access.step2': 'CivicRadar ??? ??????? ???? ??',
      'access.step3': '?????? ????? ???? ?? ??? ????? ??? ????',
      'access.roleLabel': '??? ???ï¿½',
      'access.roleNgo': 'NGO ???????',
      'access.roleBmc': 'BMC ???????',
      'access.nameLabel': '???? ???',
      'access.namePh': '???? ???',
      'access.orgLabel': '??????',
      'access.orgPh': 'NGO / ????? / RWA ?? ???',
      'access.optional': '(????????)',
      'access.cityLabel': '???',
      'access.wardLabel': '?????',
      'access.wardPh': '???? ?????',
      'access.contactLabel': '?????? ï¿½ ???? ?? ????',
      'access.emailPh': 'you@example.com',
      'access.phonePh': '????',
      'access.contactHint': '?? ?? ?? ?? ???? ????? ??? ???? ??; ???? ???? ???? ?? ?? ???? ?????? ???????',
      'access.proofLabel': '????? / ??????',
      'access.proofOptional': '(???????? ï¿½ BMC ?? ??? ?????? ???)',
      'access.proofAdd': '?????? ????? ??????',
      'access.noteLabel': '?? ????',
      'access.notePh': '????? ????, ????? ???? ??????, ????',
      'access.submit': '?????? ?????',
      'access.haveCode': '???? ??? ???? ?? ????? ??? ??',
      'access.confirmTitle': '?????? ??????? ???',
      'access.confirmBody': '???????! CivicRadar ??? ???? ?????? ?? ??????? ????? ?? ????? ?? ??? ????? ??? ???? ????? ??? ?????? (???? ?? ????)? ?????? ????? ???? ?? ??? ?? ??? ?? ??? ???? ?????',
      'access.confirmLocal': '?? ?????? ?? ????? ??? ï¿½ ?????? ???? ?? ??? ?? ???? ?? ??????',
      'access.done': '?????',
      'access.profileCta': 'NGO ? BMC ?? ???: ??????? ?????? ?? ?????? ????',
      'access.partnerCta': '??? ?????? ???? ??? ??????? ?????? ?? ?????? ????',
      'access.partnerClaim': '???? ??? ????? ??? ??',
      'access.claimTitle': '???? ????? ??? ???? ????',
      'access.claimSubtitle': 'CivicRadar ??? ?? ??????? ??? ?????? ????? ???? ?? ??? ???? ??? ??? ???? ?????',
      'access.claimLabel': '????? ???',
      'access.claimPh': 'CR-XXXXXX',
      'access.claimSubmit': '?????? ????? ????',
      'access.reviewOpen': '?????? ??????',
      'access.reviewTag': 'CivicRadar ???',
      'access.reviewTitle': '?????? ??????',
      'access.reviewSubtitle': '??????? ? BMC ?????? ?????? ??????/???????? ????? ??????? ?? ????? ??? ???? ???? ???',
      'access.pending': '?????',
      'access.approved': '??????',
      'access.rejected': '????????',
      'access.reviewEmpty': '??? ??? ?????? ????? ?? ??????? ? BMC ?????? ???? ????????',
      'access.approve': '?????? ????',
      'access.reject': '???????? ????',
      'access.copyCode': '??? ???? ????',
      'access.codeCopied': '????? ??? ???? ??? ï¿½ ????? ?? ???? ?????? ????? ?? ???? ?????',
      'access.roleNgoTag': 'NGO ???????',
      'access.roleBmcTag': 'BMC ???????',
      'access.statusApproved': '??????',
      'access.statusRejected': '????????',
      'access.statusPending': '?????',
      'access.errName': '????? ???? ??? ???????',
      'access.errContact': '?????? ?? ??? ???? ?? ???? ???????',
      'access.submitted': '?????? ???? ??? ï¿½ ?? ??????? ?? ???? ????? ??? ????????',
      'access.submittedLocal': '?????? ????? ??? ï¿½ ?????? ???? ?? ???? ? ??????? ?????',
      'access.submitError': '???? ???? ?? ??? ï¿½ ???? ??????? ???????? ??? ????? ??? ?????? ?????',
      'access.claimErrEmpty': '???? ??? ????? ??? ???? ?????',
      'access.claimErrInvalid': '?? ??? ????? ???? ?? ?? ??? ?????? ???? ????',
      'access.claimErrUsed': '?? ??? ???? ?? ????? ?? ???? ???',
      'access.claimedNgo': '?????? ????? ï¿½ ?????? ??, ???????!',
      'access.claimedBmc': 'BMC ?????? ????? ï¿½ ???? ????? ???? ??????',
      'access.approvedToast': '?????? ï¿½ ????? ??? {code}',
      'access.rejectedToast': '?????? ?????????',
      'access.proofAttached': '?????? ????? ???',
      'access.proofTooBig': '??? ???? ???? ï¿½ ????? ???? ????? ???????',
      'lead.title': '???????? ????? ????',
      'lead.profileCta': '????? ?? ????? ????? ????',
      'lead.support': '?????',
      'lead.supported': '???????',
      'lead.progress': '{count}/{threshold} ??????',
      'lead.becomeCta': '???????? ????? ????',
      'lead.granted': '???? ???? ï¿½ ??????? ?????? ?????!',
    },
    mr: {
      'lang.name': '?????', 'lang.native': '?????',
      'nav.map': '?????', 'nav.community': '??????', 'nav.profile': '????????',
      'fab.report': '??????',
      'header.context': '?????? ???? ????? ï¿½ ?????, ???? ??? ????',
      'header.contextCity': '{city} ?????? ï¿½ ???? ?????',
      'location.banner': '???? ??????????? ????? ???? ???.',
      'location.bannerNearby': '???? ????????????? ??? ?????????? ?????? ??????????? ????? ???? ???.',
      'location.unavailable': '?? ???????????? ????? ?????? ????.',
      'location.withdrawn': '????? ????? ???? ?????. ?????? ?????? ?????? ???? ???.',
      'location.dismiss': '????? ????? ??? ???',
      'location.locate': '???? ?????',
      'location.locateAria': '????? ???? ???',
      'location.enable': '???? ???',
      'coach.step': '#MonsoonGuardian ï¿½ 30 ???', 'coach.title': '??????? ?????? ??????? ????!',
      'coach.body': '?????? ????, ???? ???? ï¿½ ????? ??????? ???. ?????? Me too ???????, ???? ?????? ????. WhatsApp ?? ???? ???!',
      'coach.spotTip': '?????? ????????? ??? ????. ?????? ??????? ???? ????? ï¿½ ????, ???????? ???? ????? ???? ???? ï¿½ CivicRadar ???? ??? ??????? ??? ??? ???????? ????? ???? ?????.',
      'coach.got': '??? ???? ???',
      'tour.skip': '????', 'tour.next': '????', 'tour.done': '?????',
      'tour.replay': '???? ??? ?????? ????',
      'tour.map.title': '????? ????? ?????',
      'tour.map.body': '?? ????? ????? ????? ???. ????? ???? ??? ??? ?????? ??????.',
      'tour.report.title': '30 ??????? ??????',
      'tour.report.body': '??????? ???? ????????????? ??? ???? ï¿½ ???? 30 ????? ??????.',
      'tour.metoo.title': '??????????? ??? ????',
      'tour.metoo.body': '??? ???? ??? ???? ??????? ???????? ï¿½Me tooï¿½ ???? ???????? {corp} ?? ???? ?????.',
      'tour.profile.title': 'Civic Points ??? ???????',
      'tour.profile.body': '????? Civic Points ??? ??????? ??? ????????????? ????.',
      'persona.citizen.idle': '?? ??????? ???? = ????? ????. ?????? ???? ï¿½ 30 ??????? ????? ???????, WhatsApp ?? ????.',
      'persona.wardImpact': '{ward}: {n} ??????? ??????? ï¿½ ????? ????????? ??????? ????. #MonsoonGuardian',
      'persona.unfiled': '{n} ???? ???? ????? ??????? ï¿½ ????????????? ???? ??? ????? ????????????? ?????? ?????? ??????.',
      'persona.pendingFiled': '{n} ???? ???? ??????????? ???? ???? ï¿½ ???? ?????????? ????????????? ???? ????.',
      'onboard.title': 'CivicRadar ????? ?????? ???',
      'onboard.subtitle': '?? ??????? ????? ??????? ??? ???.',
      'onboard.ward': '????? ?????', 'onboard.wardPh': '????? ????? ???? ?????? ??????? ???ï¿½',
      'onboard.wardHint': '{city} ???? {n} ?????? ??????????? ?????.',
      'onboard.city': '????? ???',
      'onboard.cityHint': '???? ????? ?? ????? ï¿½ ???? GPS ???? ????? ????.',
      'city.mumbai': '?????',
      'city.pune': '????',
      'city.thane': '????',
      'onboard.wardDetecting': '??????? ?????????? ????? ???? ???ï¿½',
      'onboard.wardDetectedHint': 'GPS ???? ?????? ????? ï¿½ ?????? ???? ????????? ????.',
      'onboard.wardManual': '??????? ????? ?????',
      'onboard.wardRetry': '?????? ????',
      'onboard.wardDetectFailed': '????? ?????? ???? ï¿½ ????? ????? ????? ?????? ??????? ????.',
      'onboard.name': '????????? ???', 'onboard.namePh': '????? ???????? ??? ????????',
      'onboard.join': '???????? ????? ????',
      'report.title': '???????? ?????? ???',
      'report.step.photo': '????', 'report.step.details': '?????', 'report.step.submit': '?????',
      'report.hazardType': '???????? ??????', 'report.photoEvidence': '???? ??????',
      'report.capture': '???? ????',
      'report.notes': '??? (??????)', 'report.notesPh': '???????? ????? ???ï¿½',
      'report.submit': '?????? ?????',
      'report.confirmRelevant.label': '???, ?? ???? ??? ???? ?????? ï¿½ ?????, ????????? ????? ???????? ????? ?????.',
      'report.confirmRelevant.error': '????? ???? ???? ?????? ???? ?????? ???, ????? ?????? ???? ????.',
      'moderation.guidelines': '????????? ????????? ???????? ???? ???? ï¿½ ?????, ????????? ????? ???????? ????? ?????. ????? ???? ???????????? ????? ????.',
      'moderation.scanning': '???? ??????? ??????ï¿½',
      'moderation.blocked.fileType': '???? JPEG, PNG ????? WebP hazard ???? ????????? ?????.',
      'moderation.blocked.fileSize': '???? ??? ???? ???. ???? ??????? ????? (???? 8 MB).',
      'moderation.blocked.lowQuality': '???? ??? ???? ????? ??????? ???. ????????? ??.',
      'moderation.blocked.irrelevant': '???????? ???? ???? ï¿½ ??????, ????????? ????? ?????? ????? ?????.',
      'moderation.blocked.sensitive': 'ID, ????????? ????? ?????????? ????. ???? ???????? ?????.',
      'moderation.blocked.nsfw': '?????? ??????????? ?? ???? ????? ????.',
      'moderation.blocked.offline': '???? ??????? ?????????? ????????? ?????? ????.',
      'success.title': '?????? ????', 'success.tagline': '??????? ????? ??????? ??? ????',
      'success.taglineNeighbours': '{n} ?????? ??????? ????????? ??????? ??? ???? ï¿½ ????? ???????? ????? ??????? ?????!',
      'success.subtitle': '???????: ?????? ?????? ???? ?????????? {corp} ??? ?????? ?????? ?????? (????).',
      'success.step1': 'WhatsApp ?? ???? ??? ???????? ?????? ????? ??????? ??? ??????',
      'success.step2': '???????: {corp} ??? ?????? ??? ?????? ??????? ??? ???',
      'success.step3': '????????? ????? {corp} ??????? ???????? ?????? ??? ????? ï¿½ ??????? ??? ??????',
      'success.file': '?????? ?????? ?????? (???????)',
      'success.fileCorp': '{corp} ????? ?????? ?????? (???????)',
      'success.tag': '@mybmc ?? ??? ???', 'success.alert': '??????????? ????', 'success.done': '????',
      'success.sharePrompt': '?????? WhatsApp ?? ????? ï¿½ ????? ???? = ???? ??????. ????? ??????? ???? ?? ???? ???!',
      'success.shareWhatsapp': 'WhatsApp ?? ???? ???',
      'share.nativeShare': '???? ???',
      'success.shareNudge': '??????????? ???? ???? ???? ï¿½ WhatsApp ?? ???? ???, ????? ??????? ???? ??? ??? ????.',
      'success.shareMsg': '?? {ward} ????? {hazard} ï¿½ ????? ????! CivicRadar ????? ??????? ???.\nMe too ??? ??? ????? ??? ??????? ???:\n{link}\n{hashtags}',
      'share.appMsg': '??? {city} ??????? ????? ï¿½ ??????? ???? ???, Me too, ???????????? ??????? ????!\n{link}\n{hashtags}',
      'share.defaultArea': '?????? ?????',
      'share.meTooMsg': '?? ??? ?? ï¿½ {ward} ????? {hazard}. {n} ?????? CivicRadar ??:\n{link}\n{hashtags}',
      'share.meTooBtn': 'WhatsApp ?? ???? ???',
      'share.wardMapMsg': '? {ward}: {pending} ???? ?????-???? ????? ï¿½ CivicRadar ?? ??????? ????!\n{link}\n{hashtags}',
      'share.cleanupMsg': '?? {ward} ????? ????????????? {hazard} ??? ????! ??? ? ????:\n{link}\n{hashtags}',
      'share.instagramCaption': '{ward} ????? {hazard} ??? ?? CivicRadar ?? ??? ? ????. ??????????? ????.\n{link}\n{hashtags}',
      'share.instagramCleanupCaption': '{ward} ????? ????????????? {hazard} ??? ???? ?? CivicRadar ?? ??? ? ????.\n{link}\n{hashtags}',
      'share.milestoneMsg': '?? {ward} ?? {n} ??????! ????? ??????\n{link}\n{hashtags}',
      'share.firstBonus': '????? ???? ï¿½ +10 Civic Points! ??',
      'shareWin.title': '???? ???? ???!',
      'shareWin.subtitle': '??? ? ???? ?????? ï¿½ ??????????? ?????.',
      'shareWin.subtitleCleanup': '????????????? ??? ???? ï¿½ ??????? ?????????? ???? ???.',
      'shareWin.whatsapp': 'WhatsApp ?? ???? ???? ???',
      'shareWin.instagramHint': '??????? ??? ??? ? Instagram Stories ?? ????? ???',
      'shareWin.downloadCard': '?? ????? ??????? ???',
      'shareWin.copyCaption': 'Instagram ???? ?????? ???? ???',
      'shareWin.nativeShare': '??????? ???? ???',
      'shareWin.cardDownloaded': '????? ??? ï¿½ Instagram ?? ????? ???',
      'shareWin.captionCopied': '?????? ???? ï¿½ Instagram ????? ????? ???',
      'shareWin.done': '????',
      'shareWin.impact': '{n} ??????????? ??????? ï¿½ {ward} ï¿½ ?? ???? ?????????? ???! ??',
      'about.shareTitle': '???? ???? ???',
      'about.sharePitch': '???? {city} ??????? ????? ï¿½ 30 ??????? ??????, Me too, ???????????? ??????? ????.\n?????, ???? ??? ???????? ??????. ????? ????, 4 ????.\n{link}\nRWA / ??????? WhatsApp ??????? ??????? ??? ?',
      'about.copyPitch': 'WhatsApp ??? ???? ???',
      'about.pitchCopied': '??? ???? ï¿½ RWA ?????????? ????? ???!',
      'pwa.nudge': '???????-????: ??? ????????? CivicRadar ????.',
      'pwa.nudgeAction': '??? ????????? ????',
      'pwa.nudgeDismiss': '????? ????',
      'community.challengeShare': '???????? ?????? ï¿½ ????? ????? ???? ???',
      'community.winsTitle': '?? ???????????? ????',
      'community.winsEmpty': '???????? ????? ???? ?????? ï¿½ ?????? ???, ??????????? ?????, ???? ????? ???.',
      'community.winsNeighbours': '{ward} ???? ??????',
      'community.winsCleanup': '{hazard} ??? ï¿½ {ward}',
      'community.winsResolved': '{hazard} ?????? ï¿½ {ward}',
      'success.points': '??????? ??? ??????', 'success.weekBonus': '+{n} ?? ????????? ????? ??????!',
      'success.celebrateFirst': '?????? ??????? ????? ??? ???? ï¿½ ?????? ????? ?????.',
      'success.celebrateMilestone': '{n} ??????? ï¿½ ??????? ???? ??? ????????!',
      'success.kudos1': '???????! ???? ?? ???? ??????.',
      'success.kudos2': '??? ??? ï¿½ ????? ????? ???? ???? ???????? ????.',
      'success.kudos3': '???????! ??????????? ????? ???????????? ???????.',
      'success.kudos4': '?????? ?????? ???? ???? ï¿½ ???? ??? ??????? ?????.',
      'success.kudos5': '???? ?? ??? ï¿½ ????? ????? ????? ???? ?????.',
      'success.progressOne': '??????? ??????? ???? 1 ???? ??????.',
      'success.progressMany': '??????? ??????? {n} ???? ???????.',
      'success.progressMilestone': '??? ??????! ??????????? {n} ????.',
      'success.progressGuardian': '{n} ??????? ??? ???? ï¿½ ??? Monsoon Guardian.',
      'success.shareBrag': '?????? ??????? ??? ???? ï¿½ ??????????? WhatsApp ?? ?????!',
      'success.shareBragFirst': '??????? ????? ???! ?????? ???? ??? ï¿½ Monsoon Guardian ????? ?????.',
      'toast.badgeMonsoon': '??????, Monsoon Guardian! ???',
      'confirm.meTooThanks': 'Me too ???? ï¿½ ??????????? ???? ?????.',
      'toast.reportMilestone': '{n} ??????? ï¿½ ???? ????!',
      'map.empty': '{ward} ????? ?????? ????? ï¿½ #MonsoonGuardian ????! ????? ????????????? ??????? ???? ??????? ???.',
      'map.emptyHint': '??????? ??? ? ???? ? ~30 ??????? ?????. ??????????? ??????? ?????.',
      'map.emptyAction': '????? ???? ??????? ???',
      'map.emptyShare': 'WhatsApp ?? ??????????? ?????',
      'map.emptyRival': '{ward} ??????? {rival} ï¿½ ??????? {pending} ???? ?????. ??????? ??? ????? ??????????? ?????!',
      'home.hero.badge': '#MonsoonGuardian',
      'home.hero.headline': '??????? ????? ??????? ??????? ???? ??????',
      'home.hero.subline': '????? ?????? ï¿½ ??????????? ??? BMC ?? ????? ???, ???????? ????? ???.',
      'home.hero.benefit1': '30 ???????',
      'home.hero.benefit2': '??????????? ?????',
      'home.hero.benefit3': 'BMC ????',
      'home.hero.cta': '??????? ???? ??????',
      'home.hero.tour': '??? ??? ????',
      'home.hero.trust': '???? ï¿½ ????? ???? ï¿½ ?????? ï¿½ ?????, ???? ??? ????',
      'home.hero.dismiss': '?????? ????? ??? ???',
      'reminder.unfiled': '{n} ???? ???? ??????? ï¿½ ????????????? ???? ??? ????? ????????????? ????????? ??????.',
      'reminder.file': '????? ??????',
      'reminder.snooze3d': '3 ???????? ???? ???',
      'reminder.gotIt': '??? ???',
      'reminder.esc7': '?????????????? {n}+ ???? ï¿½ {ward} ????? {hazard} ???? ????? ?????????.',
      'reminder.esc14': '?????????????? {n}+ ???? ï¿½ {ward} ????? {hazard} ???? ???? ?????????.',
      'reminder.esc30': '?????????????? {n}+ ???? ï¿½ {ward} ????? {hazard} ???? ??????/RTI.',
      'reminder.escAction': '???????? ???',
      'reminder.corroboration': '{n} ??????????? ??????? {hazard} ????????? "??? ??" ?????? ï¿½ ????? ??????? ???? ??? ??? ????.',
      'reminder.corroAction': '?????? ???',
      'reminder.cleanup': '????????????? {ward} ????? {hazard} ??? ???? ï¿½ BMC ?????? ???? ??? ????.',
      'reminder.cleanupAction': '?????? ???',
      'persona.ngo.pledges': '{deliver} ????? ï¿½ {verify} ???????',
      'persona.ngo.newHazards': '?????????? {n} ???? ????',
      'persona.ngo.newPledges': '{n} ???? ?????????',
      'persona.admin.overdue': '{overdue} ???? ??????? ï¿½ {pending} ???????? ï¿½ ???? ????',
      'profile.badge.reporter': '?????? ???????????',
      'profile.badge.2week': '2-????? ???????????',
      'profile.badge.3week': '3-????? ???????????',
      'profile.badge.monsoon': '??????? ?????',
      'profile.wardImpact': '????? ?????: ?? ?????????? {n} ???????',
      'profile.streak': '{n}-?????????? ?????? ?????',
      'confirm.nearby': '??? {m} ??. ????{backing}. ????????? ???? ??? ?? ???? ï¿½ ??????? ???????? ?????.',
      'esc.participate.title': '????????? ?????? (???????)',
      'esc.participate.hint': 'Participate Mumbai ?? BMC ?? ?????? ?????????/CSR ?????? ??? ï¿½ ???? ???????? ??????????? ????. ???????? ?????? ????? ????? ????????????? ?????.',
      'esc.participate.btn': 'Participate Mumbai',
      'esc.participate.small': '????????? ï¿½ CSR ï¿½ ???????',
      'esc.corpTitle': '??????? ????????????? ?????? (???????)',
      'esc.corpHint': '{corp} ???? ?????? ???????? ???????? ???? / ??? ???????? ?????? ??????.',
      'esc.corpBtn': '{corp} ?????? ????',
      'esc.corpSubtitle': 'CivicRadar ???? ?????? ??????? ??????. ????????????? ??????? ??????? ï¿½ ?????? ?????? ???? ????.',
      'esc.titleCorp': '{corp} ????? ?????? (???????)',
      'community.title': '??????',
      'community.subtitle': '{ward} ????? ????? ??? ??? ï¿½ ?????????, ??????? ?????, ????? ????????? {corp} ??? ????.',
      'community.topWards': '????? ?????', 'community.localCitizens': '??????? ??????',
      'community.supportTitle': '????????????? ??? ????',
      'community.supportBody': '????????? ???????? ???????? ??????? ???????? ??????? ???????? ??????? ????.',
      'community.pledge': '?????',
      'community.volunteerTitle': '?????? ??????? ?????????',
      'community.volunteerBody': '????? ??? ??? ï¿½ {corp} ??? ??????? ?????.',
      'community.volunteerCta': '??????',
      'volunteer.title': '?????? ??????? ?????????',
      'popup.helpClean': '?? ??? ??????? ??? ??? ????/????',
      'profile.volunteer': '???? ????????? ??????',
      'coord.volunteers': '??????? ??????????? ?????????',
      'coord.tasks': '????????? ???? ???',
      'inquiry.coordTitle': '????? ????? ????? ??????? ????',
      'about.becomeCoord': '????? ????? ????? ??????? ????',
      'pledge.notice': '??????? ??????? NGO ??????? ?? ????????? ??????? ????? ï¿½ BMC ????. ?? ????????? ?????? ??? ?????; ????????? ???/SMS ????.',
      'pledge.status.pledged': '????? ????',
      'pledge.status.delivered': '??????',
      'pledge.status.verified': '???????? (+200 ???)',
      'toast.pledgeSaved': '????? ???? ï¿½ ????? ?????????? ??????? ?????.',
      'toast.pledgeDuplicate': '?? ????? ??? ???????????? ???? ???? ????????? ???.',
      'toast.pledgeWardMismatch': '?? ??????? ??????????? ????? ï¿½ ???? ??????? ??????? ???????.',
      'toast.pledgeStatusDelivered': '?????????? ????? ????? ?????? ?????? ?????????? ????.',
      'toast.pledgeStatusVerified': '????????? ??? ???????? ï¿½ +200 ??????? ???!',
      'toast.ngoNewPledge': '??????? ?????????? {n} ???? ?????? ?????????.',
      'toast.ngoNewPledgeAction': '?? ????',
      'coord.pledgesNew': '?????? ????????? ï¿½ {n} ????',
      'coord.pledgesEmpty': '?????? ????????? ?????. ????????? ???????????? Community ??? ???? ???.',
      'coord.markDelivered': '?????? ?????????? ???',
      'coord.verifyHours': '??? ???????? (+200)',
      'coord.verified': '????????',
      'profile.pledges': '?????? ?????????',
      'profile.pledgesEmpty': '?????? ????????? ?????. Community ???? ??????? ????????????? ??? ????.',
      'profile.pledgesEmptyAction': '????? ????',
      'profile.title': '????? ????????', 'profile.persona': '??????',
      'profile.points': '???? ??????? ???', 'profile.fixed': '???????? ????', 'profile.pending': '???? ????',
      'profile.reports': '??????? ???????',
      'profile.install': 'CivicRadar ???? ??????? ???', 'profile.partner': '????????? / NGO ?????',
      'profile.about': 'CivicRadar ?????', 'profile.sponsor': '???????? ????? ??????? ????',
      'profile.deleteData': '???? ???? ????',
      'profile.deleteConfirm': '?? ?????????? ??? ?????????? ??????? ???????, ????????? ??? ???????? ???????? ?????????? ??? ?????? ????? ????.',
      'profile.deleteDone': '????? ???? ?????. ?????? ?????? ???? ??? ????.',
      'legal.privacy': '???????? ????',
      'legal.terms': '???? ???',
      'impact.reports': '???????', 'impact.resolved': '??????', 'impact.confirms': '??? ??',
      'impact.pledges': '?????', 'impact.wards': '?????',
      'impact.week': '?? ????????: {reports} ??????? ï¿½ {resolved} ?????? ï¿½ {confirms} ??????',
      'impact.resolvedBreakdown': '??????: {self} ï¿½ ??????: {community} ï¿½ BMC: {bmc} ï¿½ ????: {cleanup}',
      'about.title': 'CivicRadar ?????',
      'about.subtitle': '?????, ???? ??? ???????? ????????? ????? ????? ï¿½ ????? ????????? ????? ????.',
      'about.impactTitle': '????????? ??????', 'about.builtTitle': '????? ??? ??????',
      'about.differentTitle': 'CivicRadar ????? ??',
      'about.different1': '?????? ????? ????? + ???? ??? ï¿½ ?????? Me too ?? ??????, ????? ????????? ????? ????',
      'about.different2': '?????? ?????: ??? CivicRadar ?? ???, ???? ??-??? ?????? ???? (BMC 1916/MyBMC, PMC CARE, TMC)',
      'about.different3': '?????? ??? ???? ï¿½ ??? ????????? ????, ????? ????, 4 ????',
      'about.different4': '??? ????????? ????? ï¿½ ????????? ????????, Civic Points, ??? ?????? ????????? ????',
      'about.sustainTitle': '?????? ??? ???????????? ????',
      'about.sustainBody': 'CivicRadar ???????????? ????? ???? ?????. ?????????? ??????? ????? ??????? ??????????? ????.',
      'about.copyImpact': '?????? ?????? ???? ???', 'about.contact': '???????? ??????', 'about.contactOperator': '???????? ??????', 'about.close': '??? ???',
      'about.sponsored': '?????????',       'about.copied': '?????? ?????? ???? ???? ï¿½ ?????? ????? ???.',
      'about.operatorNote': '{name} 18 ???????? ?????????, {operator} ???? ??????? ï¿½ ????????, ???? ??? ???????? ??????.',
      'inquiry.title': 'CivicRadar ???? ????????',
      'inquiry.subtitle': '?????, ???? ????? ????????? ?????????????? ?????? ï¿½ ??????????? ?????????? ?????.',
      'inquiry.localTitle': '??????? ??????? ????????',
      'inquiry.localBody': '??????? ?????????? ??????-??????? ??? ???????? ???.',
      'inquiry.bmcTitle': '????????? ?????',
      'inquiry.bmcBody': '???-????? ???????? ï¿½ ???? ???????? BMC ?????????. ?????????? ?????? ???.',
      'inquiry.ngoTitle': 'NGO ??? ????????? ???????',
      'inquiry.ngoBody': '???????, ??????? ??????? ??? ????????? ???? ??????.',
      'inquiry.email': '???????? ????? ?????',
      'lang.title': '????? ???? ?????',
      'hazard.stagnant-water': '??????? ????', 'hazard.potholes': '?????',
      'hazard.garbage': '????', 'hazard.streetlight': '??? ??????',
      'hazard.comingSoon': '????? ??? ???',
      'soon.title': '????? ??? ???', 'soon.notify': '?????? ???????? ??? ????',
      'soon.thanks': '??????? ï¿½ ???? ???????? ????? ???????? ????.',
      'soon.roadmap': '???? ???? ?????? ???? ï¿½ ????, ????? ??? ?????? ??? ??????.',
      'confirm.metoo': '??? ??', 'confirm.you': '????? ??????',
      'confirm.done': '???? ??? ???? ï¿½ ?????????? ????',
      'confirm.thanks': '???? ???? ï¿½ ?????????? ????? ???.',
      'confirm.none': '???? ?????? ?????? ????? ????',
      'confirm.followHint': 'BMC ?????? ???? ï¿½ ?????? ????? ??????? ? ?????.',
      'confirm.backingOne': ' ï¿½ 1 ?????????? ???????',
      'confirm.backingMany': ' ï¿½ {n} ??????????? ???????',
      'confirm.dupe': '10 ??.???? ?? CivicRadar ?? ??? ???{backing}. ??????? ???? ï¿½ ?????????? ????.',
      'confirm.dupeAction': '??? ??',
      'confirm.ownDupe': '?????? ???? ???? ??? ???? ???. ????????????? ???.',
      'profile.unfiledBanner': '{n} ???? ï¿½ {corp} ??? ?????? ???????? ????. ???? ?????? ??? ????; ?????? ?????????? ???????? ?????????? ????? ??????.',
      'profile.fileNext': '????? ??????',
      'confirm.resolved': '{ward} ???? ???? ???????? ?????? ??????? ???? ?? ?????? ????!',
      'confirm.resolvedMany': '?????? ??????? ?????? {n} ???? ?????? ?????? ????!',
      'confirm.shareBtn': '???? ???',
      'confirm.shareMsg': '? {ward} ???? ???? CivicRadar ?? ??????! ??????? ???? ??? ????:\n{link}\n{hashtags}',
      'fix.looksFixed': '??? ??? ?????',
      'fix.done': '?????? ??? ????????',
      'fix.thanks': '??????? ï¿½ ?????? ?????? ???? ???? ?? ????? ??? ?????????? ???.',
      'fix.countOne': '1 ?????? ?????? ???',
      'fix.countMany': '{n} ?????? ??????? ???',
      'fix.hint': '???? ?????? ?????? ï¿½ ?????? BMC ?????? ????.',
      'fix.resolved': '{ward} ???? ?????? ???????? ????? ??????-???????? ???!',
      'fix.resolvedMany': '?????? ???????? {n} ?????? ??????-???????? ???!',
      'fix.afterPhotoPrompt': '???????: ???????????? ?????? ???? ????.',
      'reminder.staleCheck': '{ward} ??? ï¿½ ???? stagnant?',
      'reminder.stillThere': '???? ???',
      'reminder.looksFixed': '??? ?????',
      'reminder.addPhoto': '???? ????',
      'settings.title': '?????',
      'settings.reminder.label': '????? ??????? ???? ??????????? ???? ???',
      'settings.reminder.sub': 'CivicRadar ????????? ?????????? ????? ????. ?????????? ???????? ????.',
      'settings.reminder.on': '????? ???? ï¿½ ?????? CivicRadar ????? ?????? ????? ???????? ???? ???.',
      'settings.reminder.off': '????? ???.',
      'settings.reminder.denied': '????? ????? ???? ï¿½ ???????? ????? ???????? ????? ???? ?????.',
      'notify.report.title': '?? ??????? ???? ????? ???',
      'notify.report.body': '????, ???????? ???? ????? ???? ???? ????? ?????, ?? 30 ??????? ??????.',
      'notify.report.cta': '????? ??????',
      'profile.status.communityVerified': '????????? ??? ??????',
      'profile.status.youMarkedFixed': '?????? ??? ??????????',
      'profile.status.bmcResolved': 'BMC ?? ??????',
      'profile.badge.communityVerified': '?????? ????????',
      'profile.badge.youMarkedFixed': '?????? ??????????',
      'profile.badge.bmcResolved': 'BMC ??????',
      'community.winsCommunityVerified': '{hazard} ??????-???????? ï¿½ {ward}',
      'shareWin.subtitleCommunity': '??????????? ?????? ???? ï¿½ ?????? BMC ???? ????.',
      'toast.fixConfirmed': '+10 ??? ï¿½ ?????????? ???????!',
      'toast.communityResolved': '??????-???????? ??? ï¿½ ??????????? ???????!',
      'sync.cloud': '????', 'sync.local': '???? ???????',
      'sync.cloudTitle': '??????? ???? ????????? ????', 'sync.localTitle': '???? ?? ???????? ï¿½ ?????? ????????? ???? ????',
      'map.legend.aria': '????? ????????: ????, ???????, ??? ??????',
      'report.submitting': '????? ???ï¿½',       'success.clock': '????????? ??????? ï¿½ {corp} ??? ?????? ???????? ????.',
      'community.subtitleActive': '{ward}: {pending} ???? ???? ï¿½ {resolved} ??????. ??????????? ?????!',
      'community.challenge.empty': '{ward} ????? ??????? ??????? ????? ???? ï¿½ ??? ?????? ???.',
      'community.challenge.beat': '{ward}: {pending} ?????-???? ????? ï¿½ {rival} ({rivalPending} ????????) ?????? ????! ??',
      'community.challenge.leading': '{ward} {resolved} ?????? ï¿½ {rival} ?????? ???? ????!',
      'community.challenge.catch': '{ward}: {leader} ({leaderResolved} ??????) ?? ?????? ???. ?????? ????????? ??????? ????????.',
      'community.challenge.leaderboard': '{leader} {resolved} ?????? ï¿½ ????? ????? ????',
      'leaderboard.demo': '????', 'leaderboard.you': '??????', 'leaderboard.demoNote': '???? ????? ?????? ????????? ?????. ??? ???? ??????.',
      'leaderboard.resolved': '{n} ??????', 'leaderboard.emptyWards': '????? ????? ??????? ??????????? ?????? ???.',
      'leaderboard.emptyCitizens': '??????? ??????? ?????????? ?????? ??????.',
      'leaderboard.emptyFirst': '??????? ?????????? ????? ???? ï¿½ ??????? ?????????? ?????? ???.',
      'admin.proofBefore': '??? (?????? ??????)', 'admin.proofAfter': '???? (BMC ??????)',
      'admin.proofCapture': '?????? ???? ????', 'admin.proofHint': '?????? "????" ???? ï¿½ ?????? ???/???? ??????.',
      'admin.proofPrompt': '?????? ???? ????, ?? ?????????? ?????? ??? ???.',
      'admin.proofRequired': '?????? ???? ?????? ï¿½ ?????????????? "????" ???? ????.',
      'admin.confirmResolve': '?????????? ???????',
      'admin.exportCsv': '????? CSV ???????',
      'admin.exportEmpty': '?? ?????????? ??????? ?????????? ????? ?????.',
      'admin.exportSuccess': '{n} ????? CSV ????? ???????.',
      'admin.copy1916': '1916 ???? ????',
      'admin.copy1916Copied': '???? ???? ï¿½ 1916 ????? ????? ???',
      'copy1916.marathiLead.stagnant-water': '???????, {ward} ?????????? ??????? ???? ??? ï¿½ ??? ??????? ???????? ?????? ???.',
      'copy1916.marathiAction.stagnant-water': '????? Pest Control Officer ?? anti-larval treatment ??? fogging ???? ?????.',
      'copy1916.marathiLandmark': '????? landmark / ????: {notes}',
      'profile.proofBefore': '???', 'profile.proofAfter': '????',
      'confirm.shareResolvedMsg': '? {ward} ????? ??????! CivicRadar ?? ??? ? ????:\n{link}\n{hashtags}',
      'esc.title': '?????? ?????? ???????', 'esc.subtitle': 'CivicRadar ???? ????????? ??????? ??????. BMC ????? ??????? ??????? ??? ?? ?????? ?????? ???? ???? ï¿½ ?? ?????? BMC ????? ????.',
      'esc.fileTitle': '?????? ?????? (????)', 'esc.fileHint': '??????? ???? ????? PCO ??? ????. ??????? ?????:',
      'esc.recommended': '??????: MyBMC WhatsApp ï¿½ ?????? Mumbai ??????????? ?????? ???.',
      'esc.channelWa': '?????? ï¿½ ???? ????', 'esc.channelCall': '24ï¿½7 ?????????', 'esc.channelPortal': '?????? ??????', 'esc.channelTweet': '????????? ????',
      'esc.margApp': 'MyBMC MARG ???', 'esc.margAppSmall': '?????? ?????? ???',
      'esc.copyBlock': '1916 / ?????? / ??????? ?????', 'esc.copyAll': '???? ????? ????', 'esc.copyAllDone': '???? ???? ï¿½ ?????? ??????? ????????? ????? ???',
      'esc.copyBilingual': '??? ?????: ??????? ????? ?? ???? ????.',
      'esc.portalHint': '?????? ????? MARG: Public Health ? Pest Control ? stagnant water. ???? ????? ????? ???.',
      'esc.filedConsent': '?? ?????? BMC ??????? ??????? (1916 / MyBMC / ?????? / ???)',
      'esc.complaintWarn': '??????? BMC ??????? ????? ???? ???? ï¿½ ????? ???? ?? ??? ???.',
      'esc.saveUnlock': '??? ????????: ???????, ???? ?????, ????-?? ?????.',
      'esc.closeNudge': '?????? ??????? ???? ??? ???? ï¿½ Profile ???? ????? ??????.',
      'esc.daysSince': 'BMC ???? {n} ????',
      'esc.progress.reported': '????', 'esc.progress.shared': '????', 'esc.progress.filed': '????', 'esc.progress.escalating': '????', 'esc.progress.resolved': '??????',
      'esc.tier.copyFollowUp': '????-?? ????', 'esc.tier.openWa': 'WhatsApp', 'esc.tier.openCall': '1916', 'esc.tier.openTweet': '@mybmc', 'esc.tier.openAaple': 'Aaple Sarkar',
      'esc.copyFollowUpDone': '????-?? ????', 'esc.rtiDisclaimer': '???? ?????? RTI ????? ï¿½ ???????? ????? ????.', 'esc.consentRequired': '??? ???????????? ?????? BMC ??????? ??????????? ?????? ???.',
      'esc.complaintLabel': '?????? ???????', 'esc.complaintPh': '???. N/2026/123456',
      'esc.complaintHint': '??????? ??? ???????? ???????? ?????? ????.', 'esc.filedNote': 'BMC ??? ???? ï¿½ ?????????? ???? ????.',
      'esc.ladderTitle': '???? ???????? ???????', 'esc.selfTitle': 'BMC ?? ???????', 'esc.selfBody': '????? ?????? ??? ï¿½ ?????????? ?????.',
      'esc.selfBtn': '?????? ??????????', 'esc.aaple': 'Aaple Sarkar (?????)', 'esc.close': '???', 'esc.save': '???',
      'esc.officialHint': '???????? ??????: {hint}',
      'official.title': '?????? ?????? ?????', 'official.subtitle': '???????? ?????? ??? ??? ?????? ï¿½ CivicRadar ??????? ????? ?????? ????.',
      'official.alsoFile': '??????????? ?????? (???????)', 'official.copyDone': '?????? ?????? ?????? ???? ï¿½ ???/??????????? ????? ???',
      'official.categoryHint': '???????? ??????: {hint}', 'official.reportDate': '????? ?????',
      'official.photoGuidance': '???: ??? ?????????? CivicRadar ???? ?????? ???????? ????.',
      'official.marg.label': 'MyBMC MARG', 'official.marg.small': '114 ???????? ï¿½ ??? ???? ï¿½ ????????',
      'official.swachhata.label': 'Swachhata-MoHUA', 'official.swachhata.small': 'MoHUA ???????? ï¿½ ????? ????????',
      'official.aaple.label': 'Aaple Sarkar', 'official.aaple.small': '?????????? ????? ?????? ??????',
      'official.pmc.label': 'PMC CARE', 'official.pmc.small': '???? ???????????? ???',
      'official.tmc.label': 'TMC ?????? ??????', 'official.tmc.small': 'thanecity.gov.in',
      'official.bmcWa.label': 'MyBMC WhatsApp', 'official.bmcWa.small': '??? ??? ??????',
      'official.bmcPortal.label': 'BMC ?????? ??????', 'official.bmcPortal.small': 'portal.mcgm.gov.in',
      'official.hint.marg.stagnant-water': 'Public Health ? Pest Control ? stagnant water',
      'official.hint.marg.garbage': 'Solid Waste ? garbage / drainage',
      'official.hint.swachhata.garbage': 'Garbage dump', 'official.hint.swachhata.stagnant-water': 'Choked drain (if drain-related)',
      'official.hint.pmc.stagnant-water': 'Health / mosquito breeding / stagnant water',
      'official.hint.pmc.garbage': 'Solid waste / garbage',
      'official.hint.aaple': '??????? ?????? {corp} ????? ? Health / Water',
      'official.hint.tmc.stagnant-water': 'Water / Health dept (mosquito breeding)',
      'success.alsoOfficial': '??????????? ??????',
      'esc.tmc.recommended': '??????: thanecity.gov.in ?? ?????? ????? TMC ????????? 022-25331590 ?? ??? ???.',
      'esc.tmc.fileHint': '????? ???? / ??? ?????? ï¿½ ????? ????????? ?????? TMC ????? ?????.',
      'esc.tmc.channelPortal': 'TMC ?????? ??????', 'esc.tmc.channelCall': 'TMC ?????????',
      'esc.tmc.channelEmail': '????????? ????????? ????', 'esc.tmc.channelTweet': '@TMCaTweetAway ???',
      'esc.tmc.channelCitizenCall': '?????? ??? ????? (155300)',
      'esc.tmc.copyBlock': 'TMC ?????? / ????????? / ???????? ?????',
      'esc.tmc.copyAllDone': '???? ???? ï¿½ TMC ????? ????????? ????? ???',
      'esc.tmc.portalHint': 'thanecity.gov.in: ????? ? ?????? ?????? ???? ? ?????? ??????. ???? ????? ????? ???.',
      'esc.tmc.filedConsent': '?? ?????? TMC ??????? ??????? (?????? / ????????? / ???? / 155300 / Aaple Sarkar)',
      'esc.tmc.complaintLabel': 'TMC ?????? / ?????? ???????', 'esc.tmc.complaintPh': '???. TMC/2026/123456',
      'esc.tmc.complaintWarn': '?? ??????? TMC ?????? ????? ???? ï¿½ ????? ??????? ??? ???.',
      'esc.tmc.filedNote': 'TMC ????? ??????? ï¿½ ?????????? ???? ?????.', 'esc.tmc.daysSince': 'TMC ????? ?????????????? {n} ????',
      'esc.tmc.selfTitle': 'TMC ?? ???????', 'esc.tmc.selfBody': 'TMC ?? ?????????? ????? ?????? ??? ï¿½ ?????????? ????? ?????.',
      'esc.tmc.aaple': 'Aaple Sarkar ï¿½ TMC ??????? ?????? ?????',
      'esc.tmc.deptTitle': '????? ?????? (?????????)', 'esc.tmc.deptHint': '????? ???? ????-?? ï¿½ ????, ??????, ??????? ????????.',
      'esc.tmc.dept.water': '????', 'esc.tmc.dept.health': '??????', 'esc.tmc.dept.pollution': '??????? ????????',
      'esc.tmc.tier.file.body': '????. thanecity.gov.in, 022-25331590 / 022-25331211, mc@thanecity.gov.in, ????? 155300. ?????? ??????? ???? ??? ???.',
      'esc.tmc.tier.matrix.body': '????? ???????? ????? ?????? (022-25332685) ????? ????-??. TMC ?????? ??????? ????.',
      'esc.tmc.tier.zonal.body': '????????? ?????? (mc@thanecity.gov.in) ?????? ?????. @TMCaTweetAway ?? ?????? ???.',
      'esc.tmc.tier.grievance.body': '?? ?????????????? Aaple Sarkar (grievances.maharashtra.gov.in) ï¿½ Thane Municipal Corporation ?????.',
      'esc.tmc.tier.openCall': 'TMC ???', 'esc.tmc.tier.openTweet': '@TMCaTweetAway', 'esc.tmc.tier.openEmail': 'MC ????', 'esc.tmc.tier.openAaple': 'Aaple Sarkar',
      'esc.tmc.consentRequired': '??? ???????????? ?????? TMC ??????? ??????????? ?????? ???.',
      'esc.pmc.subtitle': 'CivicRadar ???? ????????? ??????? ??????. PMC ????? ??????? ??????? ï¿½ ?????? ?????? ???? ????. ?? PMC ????? ????.',
      'esc.pmc.recommended': '??????: PMC CARE WhatsApp ï¿½ ?????? Pune ??????????? ?????? ???.',
      'esc.pmc.fileHint': '??????? ???? ??? ??? PMC CARE ?????? ?????. ??????? ?????:',
      'esc.pmc.channelWa': 'PMC CARE WhatsApp', 'esc.pmc.channelWaSmall': '??? ï¿½ ???? ????',
      'esc.pmc.channelCall': '???-???? ?????????', 'esc.pmc.channelPortal': 'PMC CARE ??????',
      'esc.pmc.channelApp': 'PMC CARE ???', 'esc.pmc.channelAppSmall': 'Play Store ï¿½ App Store',
      'esc.pmc.copyBlock': 'PMC CARE / WhatsApp / ????????????? ?????',
      'esc.pmc.copyAllDone': '???? ???? ï¿½ PMC CARE / WhatsApp ?? ????????? ????? ???',
      'esc.pmc.portalHint': 'PMC CARE ?????? ????? ???: ??????? ???? / ??? ?????? ??????. ???? ????? ????? ???.',
      'esc.pmc.filedConsent': '?? ?????? PMC ??????? ??????? (PMC CARE / WhatsApp / ????????? / ???)',
      'esc.pmc.complaintLabel': 'PMC ?????? / ?????? ???????', 'esc.pmc.complaintPh': '???. PMC/2026/123456',
      'esc.pmc.complaintWarn': '?? ??????? PMC ?????? ????? ???? ï¿½ ????? ??????? ??? ???.',
      'esc.pmc.filedNote': 'PMC ????? ??????? ï¿½ ?????????? ???? ?????.', 'esc.pmc.daysSince': 'PMC ????? ?????????????? {n} ????',
      'esc.pmc.selfTitle': 'PMC ?? ???????', 'esc.pmc.selfBody': 'PMC ?? ?????????? ????? ?????? ??? ï¿½ ?????????? ????? ?????.',
      'esc.pmc.tier.file.body': '????. PMC CARE ??????, WhatsApp, 1800 1030 222, ????? PMC CARE ???. ?????? ??????? ???? ??? ???.',
      'esc.pmc.tier.matrix.body': 'PMC CARE ????? ???-???? ??????????????? ????-??. ?????? ??????? ????.',
      'esc.pmc.tier.zonal.body': '??????? ?????? ????? PMC CARE ?????? ????? WhatsApp ???? ?????.',
      'esc.pmc.tier.grievance.body': '?? ?????????????? Aaple Sarkar ï¿½ Pune Municipal Corporation ?????.',
      'esc.pmc.tier.openWa': 'WhatsApp', 'esc.pmc.tier.openCall': 'PMC ?????????', 'esc.pmc.tier.openAaple': 'Aaple Sarkar',
      'esc.pmc.consentRequired': '??? ???????????? ?????? PMC ??????? ??????????? ?????? ???.',
      'esc.pmc.aaple': 'Aaple Sarkar ï¿½ Pune Municipal Corporation ??????? ?????? ?????',
      'copy1916.pmc.header': 'PMC ?????? ????? (PMC CARE / WhatsApp / ??????????? ????-?????)',
      'copy1916.pmc.complaintNotFiled': 'PMC ?????? #: (?????? ???? ????)', 'copy1916.pmc.complaintFiled': 'PMC ?????? #: {id}',
      'profile.fileCorp': '{corp} ??? ??????',
      'esc.tier.file.title': '1 ï¿½ ?????? ??????', 'esc.tier.file.body': '????. ????? PCO. ??????? ???? ??? ???.',
      'esc.tier.matrix.title': '2 ï¿½ ???? {n}+ ï¿½ ?????', 'esc.tier.matrix.body': '7 ???????? BMC ???-????????. WCO / AMC.',
      'esc.tier.zonal.title': '3 ï¿½ ???? {n}+ ï¿½ ????', 'esc.tier.zonal.body': 'Zonal DMC ??? @mybmc ????????? ????.',
      'esc.tier.grievance.title': '4 ï¿½ ???? {n}+ ï¿½ ?????? / RTI', 'esc.tier.grievance.body': '????? ????? Aaple Sarkar ????? RTI.',
      'profile.empty': '?????? ?????? ????. ??? ??????? ?????', 'profile.emptyAction': '??? ??????',
      'profile.trackEscalate': '????? / ????', 'profile.fileBmc': 'BMC ??? ??????',
      'profile.status.resolvedCitizen': '?????? (??????)', 'profile.status.resolvedBmc': 'BMC ?? ??????',
      'profile.status.notFiled': '????????? ??????? ????',
      'profile.communityCleared': '????????????? ??? ???? ï¿½ {corp} ?????? ???? ???? ??? ????',
      'popup.communityCleared': '????????????? ??? ???? ï¿½ {corp} ?????? ???? ???? ??? ????',
      'profile.neighbourOne': '?????????? ??? ?? ??????',
      'profile.pointsHint.base': '50 ???/?????? ï¿½ +200 ?????????', 'profile.pointsHint.bonus': '{n} ï¿½ 50 ï¿½ +{bonus} ????',
      'profile.greeting': '???????, {name}', 'profile.greetingDefault': '???????, ??????', 'profile.selectWard': '????? ?????',
      'profile.society': '??????? / ????? (???????)',
      'profile.societyPh': '????? ???? ?? ??????? / RWA ??? ????',
      'profile.societyHintWard': '{ward} ????? {n} ??????? ï¿½ ????? ????.',
      'profile.societyHintNoWard': '??????? ?????????? ????? ??? ???.',
      'profile.societyHintCustom': '????? ???? ?? ??????? / RWA ??? ????.',
      'profile.societyRegistry': '????? ????????? ?????? ??????? ????',
      'map.youAreHere': '?????? ???? ????',
      'about.subtitleNamed': '?????, ???? ??? ???? ??????? ï¿½ {name} ??????, ???????????? ????.',
      'safety.hide': '????? / ????', 'safety.hidden': '??????? ????????? ?????.', 'safety.hideConfirm': '?? ??? ???????? (?????? ??? ????.)',
      'popup.pending': '????????', 'popup.resolved': '??????', 'popup.society': '??????? / ?????',
      'partner.title': '??????? ??????',
      'partner.subtitle': 'NGO ??????? ??? ???????????????. ????????? ?????? ???????????.',
      'partner.ngoTitle': 'NGO ???????',
      'partner.ngoBody': '????? ???, ????????? ????? ??? ???? ??????',
      'partner.bmcTitle': '????????? ?????',
      'partner.bmcBody': '???????? BMC ????????? ï¿½ ??????????? ?????? ???',
      'admin.allWards': '???? ?????',
      'admin.avgDays': '?????? ????',
      'admin.exitMode': 'BMC ??? ???',
      'admin.healthLoading': '???? ??? ??? ???ï¿½',
      'admin.healthSummary': '???? ?????? (???? 7 ????)',
      'admin.markResolved': '??????? ??????????',
      'admin.overdue': '7+ ???? ????????',
      'admin.pending': '????',
      'admin.queueSubtitle': '?????? ??????? ????, ????????? ????, ??????? ???.',
      'admin.queueTitle': '???? ????',
      'admin.reportTitle': '???? ??????',
      'admin.resolved': '???????',
      'admin.resolveHint': '????????? ????? ï¿½ ??? ????? ????.',
      'admin.returnMap': '??????? ???',
      'admin.reviewTag': 'BMC ??????????',
      'admin.sort.confirmed': '???????? ??? ??',
      'admin.sort.newest': '?????? ?????',
      'admin.sort.oldest': '???? ?????',
      'admin.sort.overdue': '???????? ?????',
      'admin.subtitle': '?????? ???? ??????? ??????? ???, ????? ???? ????.',
      'admin.title': 'BMC Admin',
      'badge.admin': 'BMC Admin',
      'badge.coord': '??????? ??',
      'coord.cleared': '????????? ??? ????',
      'coord.codeHint': '??????????? ??? ????? ï¿½ ????? ????? RWA/??????? ????.',
      'coord.exitMode': 'NGO ??? ???',
      'coord.hubSubtitle': '?????? ????? ????, ????????? ??? ???????? ???.',
      'coord.hubTitle': '??????? ??',
      'coord.markTaskComplete': '???? ?????',
      'coord.openHazards': '????????? ???? ????',
      'coord.openLabel': '???? ????',
      'coord.pledges': '?????? ?????',
      'coord.pledgesLabel': '?????',
      'coord.scopeNbh': '????? ??? ï¿½ {label}',
      'coord.scopeWard': '????? ??? ï¿½ {ward}',
      'coord.subtitle': '????? ????, ????????? ?????, ??? ???????? ???.',
      'coord.tasksEmpty': '?????? ??? ?????. ?????? ????? "?? ??? ??????? ??? ??? ????" ????.',
      'coord.tasksPending': '?????',
      'coord.title': '??????? ?????',
      'coord.toVerify': '??????? ????',
      'coord.volunteersEmpty': '?????? ????????? ?????. Community ??? ???? ???.',
      'coord.volunteersLabel': '?????????',
      'coord.workflow': '????? ? ???? ??? ? ??????? ? ??? (+200 ???)',
      'copy1916.category.garbage': '???? / ?? ????',
      'copy1916.category.potholes': '????? / ????? ????',
      'copy1916.category.stagnant-water': '??? / ??????? ???? (Public Health ? Pest Control)',
      'copy1916.category.streetlight': '??? ???????????',
      'copy1916.categoryLabel': '??????',
      'copy1916.civicradarLinkLabel': 'CivicRadar ????? (???????)',
      'copy1916.complaintFiled': 'BMC ?????? #: {id}',
      'copy1916.complaintNotFiled': 'BMC ?????? #: (?????? ???? ????)',
      'copy1916.dateLabel': '?????',
      'copy1916.gpsLabel': 'GPS',
      'copy1916.gpsWarning': '? GPS {city} ????? ????? ï¿½ ???????????? ????? ?????? ???',
      'copy1916.header': 'BMC ?????? ????? (1916 / MyBMC ????? ????-?????)',
      'copy1916.landmarkLabel': '????? ???????? / ???',
      'copy1916.linkLocalhostNote': '(???? ??????? ???????? ???? ??? ????)',
      'copy1916.mapsLabel': 'Maps',
      'copy1916.marathiHeader': '--- ????? (??? ??????? ????) ---',
      'copy1916.refId': '?????? (???????): CivicRadar ID {id}',
      'copy1916.wardLabel': '????? + ?????',
      'flow.legal': '????????',
      'flow.city': '???',
      'flow.ready': '????',
      'flow.ward': '?????',
      'inquiry.coordBody': 'RWA/??????? ????? ????? NGO ?? ??????? ??? ï¿½ ????????? ????, ???? ?????, ????? ??? ???????? ???. ?????????? ?????? ??? ????.',
      'map.legend.pending': '????',
      'map.legend.resolved': '???????',
      'map.legend.you': '??????',
      'onboard.wardError': '??????? ????? ????? ????? ?????? ??????? ????.',
      'onboard.society': '??????? / ????? (???????)',
      'onboard.societyPh': '????? ???? ?? ??????? / RWA ??? ????',
      'onboard.societyHintNoWard': '????? ????? ????? ï¿½ ???? ??????? ?????.',
      'onboard.societyHintWard': '{ward} ????? {n} ??????? ï¿½ ????? ????.',
      'onboard.societyHintCustom': '????? ???? ?? ??????? / RWA ??? ????.',
      'persona.admin.exit': 'BMC ??? ???',
      'persona.admin.header': 'BMC ?????????? ???',
      'persona.admin.idleEmpty': '???????? ??????? ?????. ???? ??? ???? ??????.',
      'persona.admin.idlePending': '{n} ???????? ï¿½ ???? ???? ????? ??? ??? ????.',
      'persona.ngo.exit': 'NGO ??? ???',
      'persona.ngo.header': 'NGO ??????? ???',
      'pledge.message': '?????',
      'pledge.messagePh': '??????????????? ???ï¿½',
      'pledge.submit': '????? ?????',
      'pledge.subtitle': '????????? ????????????? ??????? ????.',
      'pledge.title': '????? ????',
      'pledge.type': '??????? ??????',
      'pledge.type.cleaning': '???? ???????',
      'pledge.type.snacks': '??????',
      'pledge.type.repellent': '??? repellent',
      'pledge.ward': '?????? ?????',
      'pledge.wardPh': '????? ?????ï¿½',
      'popup.taskOffered': '???????????? ??? ??? ????',
      'profile.emptyList': '?????? ?????? ????. Report ????? ????? ??????? ???? ??? ???.',
      'profile.persona.admin': 'BMC Admin',
      'profile.persona.ngo': 'NGO ???????',
      'toast.adminVerified': 'BMC ?????? ???????? ï¿½ ????? ???? ????.',
      'toast.bmcLoginFail': '?????? BMC ????????.',
      'toast.bmcMumbaiOnly': 'BMC ????? ???? Mumbai ????. ??????? ???????????????? Profile ???? ???? ???.',
      'toast.bmcOnlyResolve': '???? ???????? BMC ??????? ??????? ??? ?????.',
      'toast.bmcUnauthorized': '?? ???? BMC ??????????? ?????? ????.',
      'toast.citizenView': '?????? ????????? ???.',
      'toast.cleanupLogged': '?????? ???? ??? ï¿½ BMC ?????? ????????? ???? ???? ????.',
      'toast.codeInvalid': '???? ????? ???????? ???.',
      'toast.codeSent': '??? ?????? ï¿½ ??????? ????.',
      'toast.linkSent': '????-?? ???? ?????? ï¿½ ??????? ????.',
      'toast.authEmailFail': '????-?? ???? ?????? ??? ???? ï¿½ Supabase SMTP ???????? ????? ??? ?????? ??????? ???.',
      'toast.authEmailOffline': '?????? ????-?? ?????? ???? ï¿½ ??????? ????? ??? ?????? ??????? ???.',
      'toast.authEmailRateLimit': '??? ????-?? ???? ï¿½ ???? ????? ????? ??? ?????? ??????? ???.',
      'toast.authEmailInvalid': '???? ????? ???? ????? ï¿½ ????? ??? ?????? ??????? ???.',
      'toast.authEmailRedirect': '????-?? ?????????? URL ??????? ???? ï¿½ Supabase Authentication ????? ????? ???? URL ????.',
      'toast.linkExpired': '????-?? ???? ???????? ï¿½ ???? ???? ????.',
      'toast.complaintFirst': '????? ?????? ??????? ???? ï¿½ ??? ??????.',
      'toast.complaintRequired': '???????????? ?????? ??????? ???.',
      'toast.complaintSaved': '?????? ??????? ??? ï¿½ ?????? ?????? ????.',
      'toast.contactConfig': '?????? ???? ??? ???? ï¿½ ????????????? About ????.',
      'toast.coordScopeNbh': '????? ??? ï¿½ {label}',
      'toast.coordScopeWard': '????? ??????? ï¿½ ??????? {ward}',
      'toast.copyFail': '???? ??????? ï¿½ ????? ????? ?????.',
      'toast.govEmail': 'gov.in / mcgm.gov.in ???? ?????.',
      'toast.gpsFail': 'GPS ?????? ????. ?????? ???? ???? ?????? ??????? ???.',
      'toast.gpsRequired': '???? ??????? GPS ??????.',
      'toast.hazardTypeRequired': '?????? ???? ?????? ?????.',
      'toast.hoursVerified': '??? ????????! +200 Civic Points.',
      'toast.installed': 'CivicRadar ??????? ï¿½ ??? ??????????? ????!',
      'toast.installHint': '??????? ???? ? Add to Home screen.',
      'toast.ngoCodeInvalid': '?????? ????? ???????? NGO ???.',
      'toast.ngoCodeRequired': '???? ??? NGO ?????? ??? ???.',
      'toast.ngoLoginFail': '?????? ??????? ????????.',
      'toast.ngoVerified': '??????? ???????? ï¿½ ????? ??? ????????? ????.',
      'toast.noLocation': '?? ???????????? ?????? ?????? ????.',
      'toast.onboardFirst': '??????????? ????? ????? ???.',
      'toast.ownReportOnly': '???? ????????? ????????? ?????? ??? ????.',
      'toast.photoRequired': '?????????????? ???? ????.',
      'toast.pledgeDelivered': '??????? ?????? ï¿½ ??? ??? ???????? ???.',
      'toast.pledgeWardRequired': '????????? ?????? ????? ?????.',
      'toast.proofAdded': '?????? ???? ????? ï¿½ ?????????? ?????? ????.',
      'toast.recentered': '????? ??????? ???????? ????????.',
      'toast.reportNotFound': '?????? ???? ???? ????? ?? ?????????? ????.',
      'toast.resolvedProof': '??????? ?????????? ï¿½ ???/???? ?????? ???.',
      'toast.resolveFail': '?????? ????? ??? ???? ????.',
      'toast.saveFail': '??? ??? ???? ????.',
      'toast.saving': '??? ??? ???ï¿½',
      'toast.selfResolved': '??????? ?????????? ï¿½ ????-?????? ???????!',
      'toast.shareWin': '????????????? ???? ???? ???.',
      'toast.storageFull': '??????? ???? ï¿½ ???? ?????? ?????. ?????? ??????? ???.',
      'toast.syncConnected': '?????? ï¿½ ??????? ???? ?????????? ????.',
      'toast.syncLocal': '?? ?????????? ??? ï¿½ ?????? ???? ?????? ??????? ????.',
      'toast.verifying': '??????? ??? ???ï¿½',
      'toast.volunteerNeighbourhoodRequired': '?????, ??????? ????? ??? ???.',
      'toast.volunteerRemoved': '????????? ???? ?????.',
      'toast.volunteerSaved': '????????? ???? ??? ï¿½ ????? ??????? ???? ?????.',
      'toast.volunteerSignupRequired': '????? Community ????? ????????? ???? ?? ???.',
      'toast.volunteerSkillRequired': '?????? ????? ?? ????? ?????.',
      'toast.volunteerTaskCompleted': '???? ????? ï¿½ ??????????????? ?????.',
      'toast.volunteerTaskDuplicate': '?? ?????????? ???? ??? ???? ???.',
      'toast.volunteerTaskOffered': '??? ?????? ï¿½ ??????? ?? ??????? ??????.',
      'toast.volunteerWardRequired': '????? ??????????????? ????? ??? ???.',
      'toast.wardRequired': '{city}???? ?????? ??????? ????? ?????.',
      'toast.welcome': '??????, {name}! ??????????? ????.',
      'tos.accept': '?? 18+ ???, <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms</a> ??? <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a> ?????????/?????????',
      'tos.age': '?????? ??? ?????? ??????????????? 18+ ??????. 18 ?????? ???? 18+ ????, ??????????? ????? NSS ??????????? Terms ????????? ????? ????.',
      'tos.content': '???? ???????? ??-???? ????. ??????, ID ????? ???????? ?????? ?????.',
      'tos.continue': '???? ??',
      'tos.emergency': '????????? ????. ??????? ???? ??????? 112 ?? ??? ???.',
      'tos.gps': 'GPS ???? ????? ???? ???? ????? ?????? ?????? ï¿½ Terms ????????????? ??????? ????.',
      'tos.itAct': 'CivicRadar IT Act, 2000 ??????? ??????? ???. ??????? ???????? ?????.',
      'tos.notBmc': 'CivicRadar ???????? ï¿½ BMC, PMC, TMC ????? ????????? ?????? ???????? ?????? ????? ?????? ????.',
      'tos.share': 'WhatsApp, X ?? ???? ???????? ???????? ???? ???? ???? ï¿½ ????????? ???????.',
      'tos.subtitle': 'CivicRadar ?????????????? ???? ??? ????????.',
      'tos.title': '???? ???',
      'volunteer.contact': '??? / WhatsApp (???????)',
      'volunteer.contactHint': '??????? ï¿½ ???? ?????/????? ?????????? ?????. CivicRadar ???-??? ??? ????.',
      'volunteer.edit': '???? ??????? ???',
      'volunteer.empty': '?????? ???? ?? ????. Community ???? ???????? ??? ???.',
      'volunteer.emptyAction': '?????? ??????? ?????????',
      'volunteer.hours': '?? ?????????? ?????? ???',
      'volunteer.hoursCustom': '???????',
      'volunteer.hoursLabel': '?? ?????????? {n} ???',
      'volunteer.neighbourhoodHint': 'RWA, ??????? ????? ??? ï¿½ ????? ??? ??????? ??????? ??????.',
      'volunteer.neighbourhoodPh': '???. Phoenix Mills ???, Building 7 Worli',
      'volunteer.remove': '???? ???? ????',
      'volunteer.skills': '?? ??? ??? ??? ????/????',
      'volunteer.submit': '????????? ???? ???',
      'volunteer.ward': '????? ?????',
      'admin.meta.reporter': '???????????',
      'admin.meta.ward': '?????',
      'admin.meta.status': '??????',
      'admin.meta.lat': 'Lat',
      'admin.meta.lng': 'Lng',
      'admin.close': '???',
      'aria.close': '???',
      'aria.lang': '???? ????',
      'aria.recenter': '????? ??????? ???????? ???????? ???',
      'aria.leaderboard': '?????? ????????? ??? ?????',
      'aria.profile': '????????',
      'aria.report': '???? ??????',
      'aria.filterWard': '?????????? ??????',
      'aria.sortReports': '??????? ????',
      'auth.demoTag.admin': '???? ?????? ï¿½ ?????????????? BMC ???? ???????',
      'auth.demoTag.lead': '???? ?????? ï¿½ ?????????????? ???? + NGO ??????',
      'auth.officialEmail': '?????? ????',
      'auth.emailHint': '???? gov.in / mcgm.gov.in ?? BMC ??????.',
      'auth.sendCode': '????-?? ???? ?????',
      'auth.linkInstructions': '????? ???? ???? ??? ????-?? ?????? ??? ???. ?? ??? ???? ???? ï¿½ ?????? ????-?? ???? ????? ??? ??.',
      'auth.otpFallback': '6-???? ??? ????',
      'auth.otp': '6-???? ???',
      'auth.verifyEnter': '???????? ??? ??? ??????',
      'auth.email': '????',
      'auth.ngoCode': 'NGO ?????? ???',
      'auth.ngoCodePh': 'CivicRadar ???????? ????',
      'auth.username': '???????',
      'auth.password': '???????',
      'auth.loginDemo': '????? (????)',
      'admin.health.noData': '?? ?????????? ?????? ???? ???? ????.',
      'admin.health.deviceSource': '???????? ??? (???? 7 ????)',
      'admin.health.cloudSource': '?????? ????? (???? ?????????)',
      'admin.health.cloudUnavailable': '?????? ????????? ?????? ????? ï¿½ Supabase ????? analytics SQL ?????.',
      'admin.health.connectSupabase': '???-?????? ????????? Supabase ?????? ???.',
      'admin.health.sessions': '????',
      'admin.health.tabViews': '??? ??????',
      'admin.health.reportsFiled': '??????? ????',
      'admin.health.corroborations': '??? ??',
      'admin.health.bmcFiled': 'BMC ????',
      'admin.health.resolved': '???????',
      'about.founderDefault': 'CivicRadar ???',
      'about.teamLabel': 'CivicRadar ???',
      'about.teamRole': '????????? ??????? ???? ?????',
      'config.contactMissing': '(?????? ??????? ????)',
      'demo.badge': '???????? ????',
      'profile.withdrawAnalytics': '???????????? ????? ???? ????',
      'profile.withdrawAnalyticsDone': '???????????? ????? ???? ï¿½ ??????? ???? ???.',
      'profile.withdrawGps': '????? ????? ???? ????',
      'profile.withdrawGpsDone': '????? ????? ???? ï¿½ ??? ???? ?? ????? ???????? ???? ???.',
      'profile.privacyContact': '???????? / ?????? ??????',
      'toast.tosRequired': '?????? ????????????????? Terms ??? Privacy (18+) ????????.',
      'tos.analytics': '???? ????? ???????????? (???????) ????????????? ??????. ????, GPS ????? ??? ?????? ??? ????.',
      'tos.analyticsOptIn': '?? ???? ????? ?????????????? ????? ????/???? (??????? ï¿½ Profile ???? ????? ????)',
      'volunteer.ageNote': 'Terms ????? 18+ ??????. 18 ?????? ???? ????/???? ????? NSS ?????????????.',
      'admin.meta.neighbourConfirm': ' ï¿½ {n} ??? ?? ??????',
      'coord.hazardsEmpty': '??????? ????????? ????? ???? ???? ?????.',
      'coord.volunteerOffers': '{n} ????????? ???',
      'coord.hazardCleaned': '??? ????',
      'coord.logCleanup': '???? ??????',
      'admin.health.communityCleanups': '????????? ????',
      'admin.health.whatsappShares': 'WhatsApp ????',
      'admin.health.errors': '??????',
      'admin.health.perfSamples': '????????????? ?????',
      'admin.health.avgPerf': '?????? ??? ??? (???????)',
      'admin.health.bufferedEvents': '??? ??????? (????????)',
      'tracking.open': '???????????? ??? ????????',
      'tracking.title': '???????????? ??? ????????',
      'tracking.subtitle': '??????? ?????? ????????? ï¿½ ????, ???????, ?????????, ???????.',
      'tracking.period': '???????',
      'tracking.days7': '???? 7 ????',
      'tracking.days30': '???? 30 ????',
      'tracking.days90': '???? 90 ????',
      'tracking.wardFilter': '?????',
      'tracking.sessions': '????',
      'tracking.pwaInstalls': 'PWA ???????',
      'tracking.reports': '???????',
      'tracking.resolved': '???????',
      'tracking.pwaNote': 'PWA ??????? ?????? (??? ??????? / standalone). GitHub Pages ?? ?????? ??????? ????? ??? ?????.',
      'tracking.loading': '????????? ??? ??? ????ï¿½',
      'tracking.sourceLocal': '???????? + ??????? ??????? (???? / ??????)',
      'tracking.sourceCloud': '?????? ????? (???? ?????????)',
      'tracking.sourceCloudFail': '?????? ????????? ?????? ????? ï¿½ Supabase ????? tracking SQL ?????.',
      'tracking.reportsByCategory': '???????????? ???????',
      'tracking.escalations': '?????? ????? ?????',
      'tracking.neighbourhoods': '????? / ??????? ?????',
      'tracking.reporters': '?????? ?????????',
      'tracking.meToo': '??? ??',
      'tracking.filed': '?????? ????',
      'tracking.leads': '????? ???',
      'tracking.empty': '?? ???????? ???? ????.',
      'tracking.pending': '????',
      'tracking.channelUnknown': '??? ?????',
      'volunteer.neighbourhood': '????? / ??????? / ???',
      'volunteer.subtitle': '????????????? ????? ï¿½ ?????? ????????? ????????? ????.',
      'volunteer.skill.awareness': '???????? ??? WhatsApp outreach',
      'volunteer.skill.cleanup': '??????? ???? ??? ????',
      'volunteer.skill.pledge': '????? ????? (???????)',
      'profile.neighbourMany': '??????????? ??? ?? ??????',
      'ref.welcomeTitle': '??? ?????????? ???????? ??????? ??',
      'ref.welcomeBody': '{city} ??????? ???? {n} ??????? ????. ??????? ????????? ???? ????? ???? ï¿½ ????? 30 ??????? ?? ??? ???.',
      'ref.welcomeBodyEmpty': '?? ?????????? {city} ????? ????????? ???????? ????? ?????????? ????? ???? ï¿½ ???? 30 ?????.',
      'ref.welcomeCta': '????? ????',
      'ref.welcomeReport': '????? ??????',
      'ref.dismiss': '??????? ??? ???',
      'season.monsoonPrep': '??????? ????? ??? ??????? ?????? ???????? ??????? ???? ??? ??? ï¿½ ????? ??? ???.',
      'season.monsoonPeak': '?? ??????? ??? ??????? ???? ??????? ??????. ?? ??????? ?????????? ????? ??????.',
      'season.ganesh': '???? ??????? ?? ??????? ????? ????? ?????? ???? ï¿½ ???? ? ??????? ????????? ??????? ???? ??????.',
      'season.denguePeak': '????????? ????? ?? ??? ????????? ??????? ??????. 30 ????????? ?????? ????? ????? ??????.',
      'season.dismiss': '?????? ????? ??? ???',
      'social.wardWeek': '?? ?? ???????? {ward} ????? {n} ??????????? ???? ????',
      'social.wardWeekBacked': '?? ?? ???????? {ward}: {n} ????? ï¿½ {c} ???????',
      'social.wardWeekEmpty': '?? ???????? {ward} ????? ????? ???? ??? ï¿½ ?????? ????????? ?????? ?????.',
      'recap.title': '?? ???????? ????? ?????',
      'recap.share': '????????? ????? ???? ???',
      'share.weeklyRecap': '?? ?? ??????? ???????? {ward}: {reports} ???? ???????, {resolved} ???????, {backed} ??????????? ???????. CivicRadar ?? ????? ???? ??\n{link}\n{hashtags}',
      'feedback.menu': '???????? ?????',
      'feedback.title': '???????? ?????',
      'feedback.subtitle': '????? ???? ????? ????? ?????? ???? ??????? ????? ï¿½ ?? ??? ?????? ????.',
      'feedback.categoryLabel': '??????? ???????? ?????????',
      'feedback.catIdea': '??????',
      'feedback.catBug': '????',
      'feedback.catOther': '???',
      'feedback.messageLabel': '????? ????????',
      'feedback.messagePh': '??? ????, ????? CivicRadar ???? ?????? ??? ???? ?????',
      'feedback.contactLabel': '?????? (??????? ï¿½ ???? ???????? ????? ??? ???????)',
      'feedback.contactPh': '???? ????? ???',
      'feedback.privacy': '????? ????? ?????? ????? ???? ??? ????. ???? ?? ??????????? ????? ?????????? ?????? ????.',
      'feedback.submit': '???????? ?????',
      'feedback.errorEmpty': '????? ????? ?? ???? ????? ????.',
      'feedback.error': '?????? ??? ???? ï¿½ ????? ????? ???????? ???. ????? ?????? ??????? ???.',
      'feedback.success': '???????! ????? ???????? ?????? ????.',
      'feedback.successLocal': '??? ???? ï¿½ ?????? ???????? ????? ?? ???? ???.',
      'access.title': '??????? ??????????? ?????? ???',
      'access.subtitle': 'NGO ? ?????? ??????? ??? BMC ??????????????.',
      'access.step1': '???? ?????? ????????? ???? ???',
      'access.step2': 'CivicRadar ??? ?????????? ????',
      'access.step3': '?????? ????? ?????????? ????? ??? ?????',
      'access.roleLabel': '?? ???ï¿½',
      'access.roleNgo': 'NGO ???????',
      'access.roleBmc': 'BMC ???????',
      'access.nameLabel': '????? ???',
      'access.namePh': '????? ???',
      'access.orgLabel': '??????',
      'access.orgPh': 'NGO / ????? / RWA ?? ???',
      'access.optional': '(???????)',
      'access.cityLabel': '???',
      'access.wardLabel': '?????',
      'access.wardPh': '????? ?????',
      'access.contactLabel': '?????? ï¿½ ???? ????? ???',
      'access.emailPh': 'you@example.com',
      'access.phonePh': '???',
      'access.contactHint': '????? ?? ????. ????? ??? ??????; ???? ??? ??????? ????? ?????? ???.',
      'access.proofLabel': '??? / ??????',
      'access.proofOptional': '(??????? ï¿½ BMC ???? ????????)',
      'access.proofAdd': '?????? ???? ????',
      'access.noteLabel': '???? ?????',
      'access.notePh': '????? ????, ???? ??? ????, ?.',
      'access.submit': '?????? ?????',
      'access.haveCode': '????????? ???? ????? ??? ???',
      'access.confirmTitle': '?????? ??????',
      'access.confirmBody': '???????! CivicRadar ??? ??????? ???????? ?????????? ???? ??? ???? ???? ??????? ???????? ????? ??? ?????? (???? ????? ???). ?????? ????? ?????????? ?? ??? ???????? ????.',
      'access.confirmLocal': '?? ?????????? ??? ï¿½ ?????? ???????? ?????? ???? ????.',
      'access.done': '?????',
      'access.profileCta': 'NGO ? BMC ????: ??????? ????????? ?????? ???',
      'access.partnerCta': '???? ?????? ????? ??????? ????????? ?????? ???',
      'access.partnerClaim': '????????? ????? ??? ???',
      'access.claimTitle': '????? ????? ??? ????',
      'access.claimSubtitle': 'CivicRadar ????? ????? ????? ?????? ????? ?????????? ???????? ??? ????.',
      'access.claimLabel': '????? ???',
      'access.claimPh': 'CR-XXXXXX',
      'access.claimSubmit': '?????? ????? ???',
      'access.reviewOpen': '?????? ????????',
      'access.reviewTag': 'CivicRadar ???',
      'access.reviewTitle': '?????? ????????',
      'access.reviewSubtitle': '??????? ? BMC ?????? ???????? ?????/??????. ???????? ????? ??? ???? ????.',
      'access.pending': '????????',
      'access.approved': '?????',
      'access.rejected': '???????',
      'access.reviewEmpty': '???? ???????? ?????. ???? ??????? ? BMC ???????? ??? ??????.',
      'access.approve': '????? ???',
      'access.reject': '??????',
      'access.copyCode': '??? ???? ???',
      'access.codeCopied': '????? ??? ???? ???? ï¿½ ?????????? ????????? ?????? ????????????? ?????.',
      'access.roleNgoTag': 'NGO ???????',
      'access.roleBmcTag': 'BMC ???????',
      'access.statusApproved': '?????',
      'access.statusRejected': '???????',
      'access.statusPending': '????????',
      'access.errName': '????? ????? ??? ????.',
      'access.errContact': '??????????? ???? ????? ??? ????.',
      'access.submitted': '?????? ?????? ï¿½ ????? ?????????? ???? ???????? ????? ??? ?????.',
      'access.submittedLocal': '?????? ??? ï¿½ ?????? ???????? ???? ? ?????????? ????.',
      'access.submitError': '?????? ??? ???? ï¿½ ????? ????? ???????? ????. ????? ?????? ??????? ???.',
      'access.claimErrEmpty': '???????? ????? ??? ????.',
      'access.claimErrInvalid': '?? ??? ??? ???? ????? ???? ????? ?????? ????.',
      'access.claimErrUsed': '?? ??? ???? ?????? ???? ???.',
      'access.claimedNgo': '?????? ????? ï¿½ ?????? ???, ???????!',
      'access.claimedBmc': 'BMC ?????? ????? ï¿½ ????? ????? ???? ????.',
      'access.approvedToast': '????? ï¿½ ????? ??? {code}',
      'access.rejectedToast': '?????? ???????.',
      'access.proofAttached': '?????? ?????',
      'access.proofTooBig': '??????? ??? ???? ï¿½ ????? ???? ???? ????.',
      'lead.title': '???????? ???? ????',
      'lead.profileCta': '????? ????? ????? ???? ????',
      'lead.support': '???????',
      'lead.supported': '??????? ????',
      'lead.progress': '{count}/{threshold} ???????',
      'lead.becomeCta': '???????? ???? ????',
      'lead.granted': '??????? ????? ï¿½ ??????? ?????? ?????!',
    },    gu: {
      'lang.name': 'Gujarati', 'lang.native': '???????',
      'nav.map': '????', 'nav.community': '??????', 'nav.profile': '????????',
      'fab.report': '??????',
      'header.context': '??????? ???? ???? ï¿½ ?????, ???? ??? ????',
      'header.contextCity': '{city} ??????? ï¿½ ???? ????',
      'location.banner': '???? ?????? ???? ????? ???? ???.',
      'location.bannerNearby': '??????? ?????? ???? ??? ?????? ??????? ???? ???? ????? ???? ???.',
      'location.unavailable': '? ?????????? ????? ?????? ???.',
      'location.withdrawn': '????? ????? ???? ?????. ?????? ???? ???? ??? ???? ???.',
      'location.dismiss': '????? ????? ??? ???',
      'location.locate': '????? ?????',
      'location.locateAria': '????? ???? ???',
      'location.enable': '???? ???',
      'coach.step': '#MonsoonGuardian ï¿½ 30 ???', 'coach.title': '??????? ??????? ???????? ????!',
      'coach.body': '?????? ?????, ???? ?? ï¿½ ????? ???? ?? ???. ?????? Me too ?????, ????? ??? ???. WhatsApp ?? ??? ???!',
      'coach.spotTip': '??????? ? ?????? ???? ????? ???. ?????? ???????? ???? ??? ï¿½ ?????????, ??????? ??? ?? ?????? ????? ï¿½ CivicRadar ???? ??? ????? ?? ? ??? ??? ???? ????? ???? ???.',
      'coach.got': '???? ??? ????',
      'tour.skip': '????', 'tour.next': '???', 'tour.done': '????? ????',
      'tour.replay': '?? ??? ??? ???',
      'tour.map.title': '????? ????? ????',
      'tour.map.body': '? ????? ????? ???? ??. ?????? ????? ???? ??? ????? ????? ??.',
      'tour.report.title': '30 ????????? ??????',
      'tour.report.body': '???????? ???? ?????? ???? ????? ï¿½ ????? 30 ?????? ???? ??.',
      'tour.metoo.title': '???????? ???? ???',
      'tour.metoo.body': '??????? ??????? ??? ??? ??? ???? ?? ï¿½Me tooï¿½ ????? ???? {corp} ?? ???? ?????.',
      'tour.profile.title': 'Civic Points ??? ??????',
      'tour.profile.body': '????? Civic Points ??? ?????? ???? ??????????? ???.',
      'persona.citizen.idle': '?? ???????? ???? = ????? ????. ?????? ????? ï¿½ 30 ?????? ????? ???? ??, WhatsApp ?? ???.',
      'persona.wardImpact': '{ward}: {n} ?????? ?????? ï¿½ ????? ????? ????????? ???. #MonsoonGuardian',
      'persona.unfiled': '{n} ?????? ????? ????? ???? ?? ï¿½ ?????? ???? ??? ??? ???? ??????????? ?????? ?????? ???????.',
      'persona.pendingFiled': '{n} ?????? ????? ???????? ????? ?? ï¿½ ???? ????? ?? ??????????? ??? ?????.',
      'onboard.title': 'CivicRadar ??? ????? ?????? ??',
      'onboard.subtitle': '?? ?????? ????? ???? ?? ??? ???.',
      'onboard.ward': '????? ?????', 'onboard.wardPh': '????? ????? ???? ??????? ??? ???ï¿½',
      'onboard.wardHint': '{city}?? {n} ???????? ?????????? ???? ???.',
      'onboard.city': '?????? ????',
      'onboard.cityHint': '????? ??? ?? ???? ??? ï¿½ ??? GPS ?? ????? ???????.',
      'city.mumbai': '?????',
      'city.pune': '????',
      'city.thane': '????',
      'onboard.wardDetecting': '????? ??????? ????? ???? ????? ???ï¿½',
      'onboard.wardDetectedHint': 'GPS ?? ??????? ????? ï¿½ ?????? ???? ????????? ???.',
      'onboard.wardManual': '?????? ???? ???? ???',
      'onboard.wardRetry': '??? ????',
      'onboard.wardDetectFailed': '????? ????? ???? ï¿½ ???? ???? ??? ???? ?????? ?????? ???.',
      'onboard.name': '????????? ???', 'onboard.namePh': '??? ???? ??? ?????',
      'onboard.join': '????????? ?????',
      'report.title': '?????? ?????? ???',
      'report.step.photo': '????', 'report.step.details': '?????', 'report.step.submit': '?????',
      'report.hazardType': '?????? ??????', 'report.photoEvidence': '???? ??????',
      'report.capture': '???? ??',
      'report.notes': '???? (????????)', 'report.notesPh': '??????? ????? ???ï¿½',
      'report.submit': '?????? ?????',
      'report.confirmRelevant.label': '??, ? ???? ??? ???? ????? ?? ï¿½ ?????, ????????? ?? ???????? ?????? ????.',
      'report.confirmRelevant.error': '???? ??? ????? ??? ?? ???? ???? ????? ??, ???? ??? ???? ??.',
      'moderation.guidelines': '????? ??????? ?????? ???? ?? ï¿½ ?????, ????????? ?? ???????? ?????? ????. ????? ???? ???????? ???? ??? ??????? ??? ??.',
      'moderation.scanning': '???? ?????? ????ï¿½',
      'moderation.blocked.fileType': '???? JPEG, PNG ???? WebP hazard ???? ????????? ??.',
      'moderation.blocked.fileSize': '???? ??? ???? ??. ???? ??? ????? (?????? 8 MB).',
      'moderation.blocked.lowQuality': '???? ??? ???? ???? ??????? ??. ?????? ???? ???.',
      'moderation.blocked.irrelevant': '?????? ???? ?? ï¿½ ??????, ????????? ???? ???? ?????? ????.',
      'moderation.blocked.sensitive': 'ID, ????????? ???? ?????????? ????. ???? ???? ?????.',
      'moderation.blocked.nsfw': '?????? ????????? ????? ? ???? ????? ?????.',
      'moderation.blocked.offline': '???? ?????? ???? ???? ?????????? ?????? ???.',
      'success.title': '?????? ??????', 'success.tagline': '????? ????? ???? ?? ??? ??????',
      'success.taglineNeighbours': '{n} ????? ?????? ??????? ???? ??? ?? ï¿½ ????? ?????? ?? ????? ???? ?? ????? ??!',
      'success.subtitle': '????????: ?????? ?????? ??? ???? {corp} ?? ?????? ?????? ??????? (???).',
      'success.step1': 'WhatsApp ?? ??? ??? ???? ?????? ????? ???? ?? ??? ??? ???',
      'success.step2': '????????: {corp} ?? ??????? ??? ?????? ???? ?????',
      'success.step3': '?????????? ???? {corp} ??? ??? ?????? ?????? ??? ??? ï¿½ ????? ?????? ???',
      'success.file': '?????? ?????? ??????? (????????)',
      'success.fileCorp': '{corp} ??? ?????? ?????? (????????)',
      'success.tag': '@mybmc ?? ??? ???', 'success.alert': '???????? ??? ???', 'success.done': '?? ????',
      'success.sharePrompt': '????? WhatsApp ?? ????? ï¿½ ??? ??? = ????? ???. ????? ?????? ??? ?? ??? ???!',
      'success.shareWhatsapp': 'WhatsApp ?? ??? ???',
      'share.nativeShare': '??? ???',
      'success.shareNudge': '???????? ??? ??? ??? ï¿½ WhatsApp ?? ??? ???, ????? ???? ?? ??? ??? ??? ???.',
      'success.shareMsg': '?? {ward} ??? {hazard} ï¿½ ????? ????! CivicRadar ????? ???? ?? ???.\nMe too ??? ??? ????? ??? ??????? ???:\n{link}\n{hashtags}',
      'share.appMsg': '??? {city} ??????? ???? ï¿½ ???????? ???? ???, Me too, ???????????? ??????? ?????!\n{link}\n{hashtags}',
      'share.defaultArea': '???? ??????????',
      'share.meTooMsg': '?? ??? ?? ï¿½ {ward} ??? {hazard}. {n} ????? CivicRadar ??:\n{link}\n{hashtags}',
      'share.meTooBtn': 'WhatsApp ?? ??? ???',
      'share.wardMapMsg': '? {ward}: {pending} ?????? ?????-???? ????? ï¿½ CivicRadar ?? ???? ?????!\n{link}\n{hashtags}',
      'share.cleanupMsg': '?? {ward} ??? ??????????? {hazard} ??? ??????! ?????? ? ???:\n{link}\n{hashtags}',
      'share.instagramCaption': '{ward} ??? {hazard} ??? ?? CivicRadar ?? ?????? ? ???. ???????? ???.\n{link}\n{hashtags}',
      'share.instagramCleanupCaption': '{ward} ??? ??????????? {hazard} ??? ?????? ?? CivicRadar ?? ?????? ? ???.\n{link}\n{hashtags}',
      'share.milestoneMsg': '?? {ward} ? {n} ????! ????? ??????\n{link}\n{hashtags}',
      'share.firstBonus': '?????? ??? ï¿½ +10 Civic Points! ??',
      'shareWin.title': '??? ??? ???!',
      'shareWin.subtitle': '?????? ? ??? ?????? ï¿½ ???????? ?????.',
      'shareWin.subtitleCleanup': '??????????? ??? ?????? ï¿½ ??????? ???????? ??? ???.',
      'shareWin.whatsapp': 'WhatsApp ?? ??? ??? ???',
      'shareWin.instagramHint': '??? ????? ? Instagram Stories ?? ????? ???',
      'shareWin.downloadCard': '????? ????? ??????? ???',
      'shareWin.copyCaption': 'Instagram ???? ?????? ???? ???',
      'shareWin.nativeShare': '??? ??? ???',
      'shareWin.cardDownloaded': '????? ???????? ï¿½ Instagram ?? ????? ???',
      'shareWin.captionCopied': '?????? ???? ï¿½ Instagram ??? ????? ???',
      'shareWin.done': '?? ????',
      'shareWin.impact': '{n} ??????? ???? ï¿½ {ward} ï¿½ ? ??? ?????????? ???! ??',
      'about.shareTitle': '?? ??? ???',
      'about.sharePitch': '??? {city} ??????? ???? ï¿½ 30 ?????? ???????, Me too, ???????????? ??????? ?????.\n?????, ???? ??? ???? ???? ????????. ????? ????, 4 ?????.\n{link}\nRWA / ??????? WhatsApp ???????? ??????? ??? ?',
      'about.copyPitch': 'WhatsApp ??? ???? ???',
      'about.pitchCopied': '??? ???? ï¿½ RWA ???????? ????? ???!',
      'pwa.nudge': '??????-?????: ??? ??????? ?? CivicRadar ?????.',
      'pwa.nudgeAction': '??? ??????? ?? ?????',
      'pwa.nudgeDismiss': '????? ????',
      'community.challengeShare': '??????? ????? ï¿½ ????? ???? ??? ???',
      'community.winsTitle': '? ???????? ???',
      'community.winsEmpty': '????????? ????? ???? ?????? ï¿½ ??????? ???, ???????? ??????, ??? ????.',
      'community.winsNeighbours': '{ward} ??? ??????',
      'community.winsCleanup': '{hazard} ??? ï¿½ {ward}',
      'community.winsResolved': '{hazard} ???????? ï¿½ {ward}',
      'success.points': '????? ?????? ?????', 'success.weekBonus': '+{n} ? ?????????? ????? ??????!',
      'success.celebrateFirst': '??? ???????? ????? ??? ?? ï¿½ ?????? ????? ?????.',
      'success.celebrateMilestone': '{n} ??????? ï¿½ ????? ????? ??? ????????!',
      'success.kudos1': '?????! ??? ?? ???? ???? ??.',
      'success.kudos2': '??? ??? ï¿½ ????? ????? ???? ??? ???????? ???.',
      'success.kudos3': '????????! ???????? ????? ???? ??? ????.',
      'success.kudos4': '??? ??? ??? ????? ï¿½ ? ???? ??? ????? ??.',
      'success.kudos5': '??? ?? ??? ï¿½ ????? ???? ????? ???? ???? ??.',
      'success.progressOne': '???? ??? ???? ???? 1 ??? ??????.',
      'success.progressMany': '???? ??? ???? {n} ??? ???????.',
      'success.progressMilestone': '??? ?????! ???? ???? {n} ???.',
      'success.progressGuardian': '{n} ??????? ??? ???? ï¿½ ???? Monsoon Guardian.',
      'success.shareBrag': '??? ??????? ??? ??? ï¿½ ???????? WhatsApp ?? ???!',
      'success.shareBragFirst': '???? ?? ?????? ???! ????? ??? ??? ï¿½ Monsoon Guardian ????? ?????.',
      'toast.badgeMonsoon': '??????, Monsoon Guardian! ???',
      'confirm.meTooThanks': 'Me too ???????? ï¿½ ?????? ???? ??? ????? ??.',
      'toast.reportMilestone': '{n} ??????? ï¿½ ???? ????!',
      'map.empty': '{ward} ??? ?????? ???? ï¿½ #MonsoonGuardian ???! ????? ????? ?? ?????? ???????? ???? ??????? ???.',
      'map.emptyHint': '????? ?? ??? ? ???? ? ~30 ????????? ?????. ?????? ???? ?? ????.',
      'map.emptyAction': '????? ???? ??????? ???',
      'map.emptyShare': 'WhatsApp ?? ???????? ??????',
      'map.emptyRival': '{ward} ??.{rival} ï¿½ ????? {pending} ?????? ?????. ??????? ??? ???? ???????? ??????!',
      'home.hero.badge': '#MonsoonGuardian',
      'home.hero.headline': '????? ????? ???? ?? ???????? ???? ??????? ???',
      'home.hero.subline': '????? ???? ï¿½ ?????? ??? BMC ?? ????? ???, ?????? ????? ???.',
      'home.hero.benefit1': '30 ?????????',
      'home.hero.benefit2': '?????? ?????',
      'home.hero.benefit3': 'BMC ????',
      'home.hero.cta': '???????? ???? ??????? ???',
      'home.hero.tour': '???? ???? ??? ???',
      'home.hero.trust': '??? ï¿½ ????? ??? ï¿½ ?????? ï¿½ ?????, ???? ??? ????',
      'home.hero.dismiss': '?????? ????? ??? ???',
      'reminder.unfiled': '{n} ?????? ????? ???? ?? ï¿½ ?????? ???? ??? ??? ???? ??????????? ?????? ???? ???????.',
      'reminder.file': '????? ???????',
      'reminder.snooze3d': '3 ??????? ??? ?????',
      'reminder.gotIt': '??? ??',
      'reminder.esc7': '??????????? {n}+ ???? ï¿½ {ward} ??? {hazard} ???? ????? ?????????.',
      'reminder.esc14': '??????????? {n}+ ???? ï¿½ {ward} ??? {hazard} ???? ???? ?????????.',
      'reminder.esc30': '??????????? {n}+ ???? ï¿½ {ward} ??? {hazard} ???? ??????/RTI.',
      'reminder.escAction': '???????? ???',
      'reminder.corroboration': '{n} ??????? ????? {hazard} ?????? ?? "??? ??" ?????? ï¿½ ????? ???? ?? ??? ??? ??? ???.',
      'reminder.corroAction': '?????? ???',
      'reminder.cleanup': '??????????? {ward} ??? {hazard} ??? ?????? ï¿½ {corp} ?????? ?????? ???? ?????? ??? ???.',
      'reminder.cleanupAction': '?????? ???',
      'persona.ngo.pledges': '{deliver} ????? ï¿½ {verify} ??????',
      'persona.ngo.newHazards': '???????? {n} ??? ????',
      'persona.ngo.newPledges': '{n} ??? ?????????',
      'persona.admin.overdue': '{overdue} ???? ????? ï¿½ {pending} ???? ï¿½ ???? ????',
      'profile.badge.reporter': '?????? ????????',
      'profile.badge.2week': '2-???????? ????????',
      'profile.badge.3week': '3-???????? ????????',
      'profile.badge.monsoon': '?????? ?????',
      'profile.wardImpact': '????? ?????: ? ?????? {n} ??????',
      'profile.streak': '{n}-?????????? ?????????? ???????',
      'confirm.nearby': '??? {m} ??. ???{backing}. ????????? ???? ??? ?? ????? ï¿½ ??? ??? ?????? ?????.',
      'esc.participate.title': '????????? ?????? (????????)',
      'esc.participate.hint': 'Participate Mumbai BMC ??? ?????? ?????????/CSR ?????? ?? ï¿½ ???? ???????? ??????? ???? ????. ???? ?????? ???? ????? ????????? ???? ?????.',
      'esc.participate.btn': 'Participate Mumbai',
      'esc.participate.small': '????????? ï¿½ CSR ï¿½ ?????????',
      'esc.corpTitle': '??????? ??????????????? ??????? (????????)',
      'esc.corpHint': '{corp} ?? ?????? ?????? ?? ??? ???? / ??? ???????? ?????? ???????.',
      'esc.corpBtn': '{corp} ?????? ????',
      'esc.corpSubtitle': 'CivicRadar ????? ?????? ???? ?? ????? ??. ??????????????? ??????? ???????? ï¿½ ?????? ?????? ??? ???.',
      'esc.titleCorp': '{corp} ??? ??????? (????????)',
      'community.title': '??????',
      'community.subtitle': '{ward} ??? ???? ????? ??? ??? ï¿½ ?????????, ??????? ???, ???? ????? {corp} ?? ????.',
      'community.topWards': '????? ?????', 'community.localCitizens': '??????? ???????',
      'community.supportTitle': '???????????? ???? ???',
      'community.supportBody': '??????? ???? ???? ???? ??????? ???? ????? ??? ???? ??????? ??? ???.',
      'community.pledge': '???',
      'community.volunteerTitle': '???? ???????? ?????????',
      'community.volunteerBody': '???? ????? ??? ??? ï¿½ {corp} ?? ???? ??? ??.',
      'community.volunteerCta': '???? ??',
      'volunteer.title': '???? ???????? ?????????',
      'popup.helpClean': '??? ??? ??????? ??? ??? ????',
      'profile.volunteer': '???? ????????? ??????',
      'coord.volunteers': '????? ????????? ??????????',
      'coord.tasks': '????????? ???? ???',
      'inquiry.coordTitle': '????? ???? ???? ??????? ???',
      'about.becomeCoord': '????? ???? ???? ??????? ???',
      'pledge.notice': '????? ??????? NGO ????? ??? ????? ????? ???? ï¿½ BMC ????. ??? ????? ?????? ??? ???; ???????? ???/SMS ????.',
      'pledge.status.pledged': '????????? ????',
      'pledge.status.delivered': '??????',
      'pledge.status.verified': '???????? (+200 ??????)',
      'toast.pledgeSaved': '????????? ???? ï¿½ ????? ??????? ????? ??????.',
      'toast.pledgeDuplicate': '? ????? ??? ??????? ???? ??????? ?????? ????????? ??.',
      'toast.pledgeWardMismatch': '? ????? ??????? ??? ï¿½ ?? ??????? ????? ???????.',
      'toast.pledgeStatusDelivered': '?????? ????? ????????? ?????? ????? ??????? ???.',
      'toast.pledgeStatusVerified': '????????? ???? ??????? ï¿½ +200 ????? ??????!',
      'toast.ngoNewPledge': '????? ???????? {n} ??? ?????? ?????????.',
      'toast.ngoNewPledgeAction': '?? ????',
      'coord.pledgesNew': '?????? ????????? ï¿½ {n} ???',
      'coord.pledgesEmpty': '??? ????????? ???. ??????? ???????? ???? Community ??? ??? ???.',
      'coord.markDelivered': '?????? ??????? ???',
      'coord.verifyHours': '???? ????? (+200)',
      'coord.verified': '????????',
      'profile.pledges': '???? ??????????',
      'profile.pledgesEmpty': '??? ????????? ???. Community ????? ??????? ???????????? ???? ???.',
      'profile.pledgesEmptyAction': '????????? ???',
      'profile.title': '????? ????????', 'profile.persona': '??????',
      'profile.points': '??? ????? ??????', 'profile.fixed': '????????? ?????', 'profile.pending': '?????? ?????',
      'profile.reports': '????? ???????',
      'profile.install': 'CivicRadar ?? ???????? ???', 'profile.partner': '????????? / NGO ?????',
      'profile.about': 'CivicRadar ????', 'profile.sponsor': '???????? ???? ??????? ???',
      'profile.deleteData': '???? ???? ???? ????',
      'profile.deleteConfirm': '? ????? ??? ??????????? ????? ???????, ????????? ??? ???????? ????? ???? ????? ????? ???? ????? ????.',
      'profile.deleteDone': '????? ???? ???? ??????. ??? ??? ??? ??? ???.',
      'legal.privacy': '???????? ????',
      'legal.terms': '?????? ????',
      'impact.reports': '???????', 'impact.resolved': '???????', 'impact.confirms': '??? ??',
      'impact.pledges': '???', 'impact.wards': '?????',
      'impact.week': '? ????????: {reports} ?????? ï¿½ {resolved} ??????? ï¿½ {confirms} ??????',
      'impact.resolvedBreakdown': '???: {self} ï¿½ ??????: {community} ï¿½ BMC: {bmc} ï¿½ ????: {cleanup}',
      'about.title': 'CivicRadar ????',
      'about.subtitle': '?????, ???? ??? ???? ???? ????????? ????? ???? ï¿½ ????? ????????? ????? ????.',
      'about.impactTitle': '????????? ??????', 'about.builtTitle': '??? ??? ????????',
      'about.differentTitle': 'CivicRadar ??? ???',
      'about.different1': '???? ????? ???? + ???? ??? ï¿½ ?????? Me too ?? ??????, ????? ????????? ????? ????',
      'about.different2': '???? ?????: ????? CivicRadar ?? ???, ??? ??-??? ?????? ???? (BMC 1916/MyBMC, PMC CARE, TMC)',
      'about.different3': '?????? ??? ??? ï¿½ ??? ??????? ?? ?????, ????? ???, 4 ?????',
      'about.different4': '??? ??? ????? ???? ????? ï¿½ ????????? ????????, Civic Points, ??? ???? ?? ????????? ???',
      'about.sustainTitle': '???? ??? ??????? ???? ???',
      'about.sustainBody': 'CivicRadar ???????? ???? ?????? ??? ?????. ???????? ??? ????? ??????? ????????????? ??? ??.',
      'about.copyImpact': '?????? ?????? ???? ???', 'about.contact': '????? ??????', 'about.contactOperator': '????? ??????', 'about.close': '???',
      'about.sponsored': '?????????',       'about.copied': '?????? ?????? ???? ??? ï¿½ ??????? ????? ???.',
      'about.operatorNote': '{name} 18 ?? ??? ????? ????, {operator} ???? ????? ?? ï¿½ ????????, ??????? ??? ?????? ??????.',
      'inquiry.title': 'CivicRadar ???? ????????',
      'inquiry.subtitle': '?????, ???? ???? ?????? ??????? ???? ?????? ï¿½ ????? ???? ??????? ????????.',
      'inquiry.localTitle': '??????? ??????? ????????',
      'inquiry.localBody': '??????? ???????? ????????? ??????-??????? ??? ???????? ???.',
      'inquiry.bmcTitle': '????????? ?????',
      'inquiry.bmcBody': '???-????? ???????? ï¿½ ???? ???????? BMC ????? ????. ??? ???? ?????? ???.',
      'inquiry.ngoTitle': 'NGO ??? ????????? ???????',
      'inquiry.ngoBody': '???, ??????? ?????? ??? ????????? ???? ?????.',
      'inquiry.email': '???????? ?????? ?????',
      'lang.title': '????? ???? ???? ???',
      'hazard.stagnant-water': '???????? ????', 'hazard.potholes': '????',
      'hazard.garbage': '????', 'hazard.streetlight': '??? ???????????',
      'hazard.comingSoon': '???? ??????',
      'soon.title': '???? ??????', 'soon.notify': '???? ??? ?????? ??? ??? ???',
      'soon.thanks': '???? ï¿½ ????? ??? ?????? ??? ???? ??? ??????.',
      'soon.roadmap': '??? ???? ??????? ???? ?????? ï¿½ ????, ???? ??? ??????????? ??? ????.',
      'confirm.metoo': '??? ??', 'confirm.you': '????? ??????',
      'confirm.done': '???? ??? ????? ï¿½ ??? ??? ?????? ?????',
      'confirm.thanks': '???? ?????? ï¿½ ??? ??? ?????? ????????.',
      'confirm.none': '??? ?????? ????? ????? ???',
      'confirm.followHint': 'BMC ?????? ???? ï¿½ ?????? ????? ???? ??? ?????.',
      'confirm.backingOne': ' ï¿½ 1 ??????? ????',
      'confirm.backingMany': ' ï¿½ {n} ???????? ????',
      'confirm.dupe': '10 ??.?? ???? CivicRadar ?? ??? ??{backing}. ???? ??? ï¿½ ??? ??? ?????? ?????.',
      'confirm.dupeAction': '??? ??',
      'confirm.ownDupe': '??? ???? ??????? ??? ?????? ??. ??????????? ???.',
      'profile.unfiledBanner': '{n} ?????? ï¿½ {corp} ?? ??? ??????? ???. ??? ????? ?? ??? ???; ?????? ??????? ?? ???? ???? ???? ??? ??????.',
      'profile.fileNext': '????? ???????',
      'confirm.resolved': '{ward} ??? ??? ???? ???? ???? ??? ?? ????!',
      'confirm.resolvedMany': '??? ???? ???? {n} ????? ????? ? ??? ????!',
      'confirm.shareBtn': '??? ???',
      'confirm.shareMsg': '? {ward} ??? ???? CivicRadar ?? ???! ??????? ???? ??? ??? ??:\n{link}\n{hashtags}',
      'fix.looksFixed': '??? ??? ???? ??',
      'fix.done': '??? ??? ??????',
      'fix.thanks': '???? ï¿½ ????? ?????? ???? ??? ?????? ??? ??????? ??????.',
      'fix.countOne': '1 ????? ??? ?? ???',
      'fix.countMany': '{n} ????? ??? ?? ???',
      'fix.hint': '???? ?????? ???? ï¿½ ?????? BMC ?????? ????.',
      'fix.resolved': '{ward} ?? ???? ????? ????? ??????-???????? ???!',
      'fix.resolvedMany': '??? ??????? {n} ?????? ??????-???????? ???!',
      'fix.afterPhotoPrompt': '????????: ????????????? ????? ???? ?????.',
      'reminder.staleCheck': '{ward} ???? ï¿½ ??? stagnant?',
      'reminder.stillThere': '??? ??',
      'reminder.looksFixed': '??? ???? ??',
      'reminder.addPhoto': '???? ?????',
      'settings.title': '??? ????????',
      'settings.reminder.label': '??????? ???????? ???? ?????? ???? ??? ?????',
      'settings.reminder.sub': 'CivicRadar ???? ?????? ????????? ???? ???. ??? ??????????? ???????? ????.',
      'settings.reminder.on': '??? ???? ï¿½ ??? CivicRadar ????? ?????? ??? ?????? ??? ????????.',
      'settings.reminder.off': '??? ???.',
      'settings.reminder.denied': '?????? ????? ?? ï¿½ ???? ???? ??? ????? ???? ??? ????????.',
      'notify.report.title': '??? ???????? ???? ??????',
      'notify.report.body': '?????????, ??????? ??? ?? ?????? ????? ?????? ???? ???, ?? 30 ????????? ?????? ???.',
      'notify.report.cta': '????? ?????? ???',
      'profile.status.communityVerified': '??????? ????? ??????',
      'profile.status.youMarkedFixed': '??? ??? ???????',
      'profile.status.bmcResolved': 'BMC ? ????????',
      'profile.badge.communityVerified': '?????? ????????',
      'profile.badge.youMarkedFixed': '??? ???????',
      'profile.badge.bmcResolved': 'BMC ????',
      'community.winsCommunityVerified': '{hazard} ??????-???????? ï¿½ {ward}',
      'shareWin.subtitleCommunity': '??????? ?????? ??? ï¿½ ?????? BMC ??????? ????.',
      'toast.fixConfirmed': '+10 ?????? ï¿½ ???? ???? ????!',
      'toast.communityResolved': '??????-???????? ??? ï¿½ ?????? ???? ????!',
      'sync.cloud': '????', 'sync.local': '???? ???????',
      'sync.cloudTitle': '??????? ??? ?????? ?? ????', 'sync.localTitle': '???? ? ????? ?? ï¿½ ?????? ????? ?????? ???? ???',
      'report.submitting': '?????? ?????? ??ï¿½',
      'success.clock': '????????? ???? ?? ï¿½ {corp} ?? ??? ???????? ???.',
      'map.legend.aria': '???? ????????: ???????, ???, ??? ????? ???',
      'community.subtitleActive': '{ward}: {pending} ?????? ????? ï¿½ {resolved} ???????. ???????? ??????!',
      'community.challenge.empty': '{ward} ??? ?????? ????? ?? ????? ??? ï¿½ ??? ? ??????? ???.',
      'community.challenge.beat': '{ward}: {pending} ?????-???? ????? ï¿½ {rival} ({rivalPending} ????) ????? ???! ??',
      'community.challenge.leading': '{ward} {resolved} ???? ???? ?????? ï¿½ {rival} ????? ???!',
      'community.challenge.catch': '{ward}: {leader} ({leaderResolved} ????) ?? ???? ???. ?????? ????????? ????? ?????.',
      'community.challenge.leaderboard': '{leader} {resolved} ???? ???? ??? ?? ï¿½ ??? ??? ??????',
      'leaderboard.demo': '????', 'leaderboard.you': '???', 'leaderboard.demoNote': '??? ????? ??????? ??? ????? ???? ?????. ???????? ????? ????.',
      'leaderboard.resolved': '{n} ???????', 'leaderboard.emptyWards': '????? ????? ????? ?? ???? ??????? ???.',
      'leaderboard.emptyCitizens': '??????? ????? ?? ???? ?????? ???????.',
      'leaderboard.emptyFirst': '????? ???????? ????? ??? ï¿½ ????? ?? ???? ??????? ???.',
      'admin.proofBefore': '?????? (??????)', 'admin.proofAfter': '??? (BMC ??????)',
      'admin.proofCapture': '?????? ???? ?????', 'admin.proofHint': '?????? "???" ???? ï¿½ ??????? ??????/??? ????.',
      'admin.proofPrompt': '????? ???? ?????, ??? ?????? ???? ??? ??? ???.',
      'admin.proofRequired': '?????? ???? ????? ï¿½ ?????? ?????? "???" ???? ?????.',
      'admin.confirmResolve': '?????? ???????',
      'admin.exportCsv': '????? CSV ?????',
      'admin.exportEmpty': '? ?????? ???? ????? ???? ????? ???.',
      'admin.exportSuccess': '{n} ????? CSV ??? ?????.',
      'admin.copy1916': '1916 ???? ????',
      'admin.copy1916Copied': '???? ???? ï¿½ 1916 ??? ????? ???',
      'profile.proofBefore': '??????', 'profile.proofAfter': '???',
      'confirm.shareResolvedMsg': '? {ward} ??? ???! CivicRadar ?? ?????? ? ???:\n{link}\n{hashtags}',
      'esc.title': '?????? ?????? ?????', 'esc.subtitle': 'CivicRadar ????? ????????? ???? ?? ????? ??. BMC ??? ????????? ???????? ?? ?? ?????? ?????? ??? ??? ï¿½ ? ?????? BMC ???? ???.',
      'esc.fileTitle': '?????? ??????? (???)', 'esc.fileHint': '???????? ???? ????? PCO ???? ??? ??. ??? ?? ????:',
      'esc.recommended': '?????: MyBMC WhatsApp ï¿½ ????????? Mumbai ????? ???? ???? ????.',
      'esc.channelWa': '?????? ï¿½ ?????? ????', 'esc.channelCall': '24ï¿½7 ?????????', 'esc.channelPortal': '?????? ??????', 'esc.channelTweet': '????? ????',
      'esc.margApp': 'MyBMC MARG ??', 'esc.margAppSmall': '?????? ?????? ??',
      'esc.copyBlock': '1916 / ?????? / ?? ???? ?????', 'esc.copyAll': '??? ????? ????', 'esc.copyAllDone': '???? ?? ï¿½ ?????? ???? ?? ???????? ???? ????? ???',
      'esc.copyBilingual': '??? ??????: ??????? ???????? ????? ???? ????? ???.',
      'esc.portalHint': '?????? ???? MARG: Public Health ? Pest Control ? stagnant water. ???? ????? ????? ???.',
      'esc.filedConsent': '??? ?????? BMC ???? ?? ?????????? (1916 / MyBMC / ?????? / ??)',
      'esc.complaintWarn': '??????? BMC ???? ????? ?????? ??? ï¿½ ????? ??? ?? ?????.',
      'esc.saveUnlock': '??????? ???: ???????, ???? ?????, ????-?? ???????.',
      'esc.closeNudge': '?????? ???? ??? ??????? ??? ï¿½ Profile ????? ?????? ?? ???????.',
      'esc.daysSince': 'BMC ???? {n} ????',
      'esc.progress.reported': '???????', 'esc.progress.shared': '???', 'esc.progress.filed': '????', 'esc.progress.escalating': '????????', 'esc.progress.resolved': '????',
      'esc.tier.copyFollowUp': '????-?? ????', 'esc.tier.openWa': 'WhatsApp', 'esc.tier.openCall': '1916', 'esc.tier.openTweet': '@mybmc', 'esc.tier.openAaple': 'Aaple Sarkar',
      'esc.copyFollowUpDone': '????-?? ????', 'esc.rtiDisclaimer': '????? ?????? RTI ???????? ï¿½ ?????? ???? ????.', 'esc.consentRequired': '?????? ?????? ?????? BMC ???? ?? ??????????? ?????? ???.',
      'esc.complaintLabel': 'BMC ?????? ????', 'esc.complaintPh': '??.?. N/2026/123456',
      'esc.complaintHint': '???? ??????? ???????? ?????? ???.', 'esc.filedNote': 'BMC ??? ???? ï¿½ ???? ?? ???.',
      'esc.ladderTitle': '????????? ???????', 'esc.selfTitle': 'BMC ? ??? ???????', 'esc.selfBody': '???? ?????? ??? ï¿½ ??? ???? ?????.',
      'esc.selfBtn': '???? ???????', 'esc.aaple': 'Aaple Sarkar (?????)', 'esc.close': '???', 'esc.save': '?????',
      'esc.officialHint': '????? ??????: {hint}',
      'official.title': '?????? ?????? ????', 'official.subtitle': '?????? ?????? ?? ??? ?????? ï¿½ CivicRadar ????? ????? ????????? ???.',
      'official.alsoFile': '?????? ???? ?? ??????? (????????)', 'official.copyDone': '?????? ?????? ?????? ???? ï¿½ ??/????????? ????? ???',
      'official.categoryHint': '????? ??????: {hint}', 'official.reportDate': '??????? ?????',
      'official.photoGuidance': '???: ???? ????????? ???? CivicRadar ???? ?????? ????? ????.',
      'official.marg.label': 'MyBMC MARG', 'official.marg.small': '114 ??????? ï¿½ ??? ???? ï¿½ ????????',
      'official.swachhata.label': 'Swachhata-MoHUA', 'official.swachhata.small': 'MoHUA ???????? ï¿½ ????? ????????',
      'official.aaple.label': 'Aaple Sarkar', 'official.aaple.small': '?????????? ????? ?????? ??????',
      'official.pmc.label': 'PMC CARE', 'official.pmc.small': '???? ???????????? ??',
      'official.tmc.label': 'TMC ?????? ??????', 'official.tmc.small': 'thanecity.gov.in',
      'official.bmcWa.label': 'MyBMC WhatsApp', 'official.bmcWa.small': '???? ??? ??????',
      'official.bmcPortal.label': 'BMC ?????? ??????', 'official.bmcPortal.small': 'portal.mcgm.gov.in',
      'official.hint.marg.stagnant-water': 'Public Health ? Pest Control ? stagnant water',
      'official.hint.marg.garbage': 'Solid Waste ? garbage / drainage',
      'official.hint.swachhata.garbage': 'Garbage dump', 'official.hint.swachhata.stagnant-water': 'Choked drain (if drain-related)',
      'official.hint.pmc.stagnant-water': 'Health / mosquito breeding / stagnant water',
      'official.hint.pmc.garbage': 'Solid waste / garbage',
      'official.hint.aaple': '??????? ?????? {corp} ???? ??? ? Health / Water',
      'official.hint.tmc.stagnant-water': 'Water / Health dept (mosquito breeding)',
      'success.alsoOfficial': '?????? ???? ?? ???????',
      'esc.tmc.recommended': '?????: thanecity.gov.in ?? ??????? ???? TMC ????????? 022-25331590 ?? ??? ???.',
      'esc.tmc.fileHint': '??????? ???? / ????? ï¿½ ?????? ??? ?? ?????? TMC ?????? ????? ???.',
      'esc.tmc.channelPortal': 'TMC ?????? ??????', 'esc.tmc.channelCall': 'TMC ?????????',
      'esc.tmc.channelEmail': '?????????? ???????? ????', 'esc.tmc.channelTweet': '@TMCaTweetAway ???',
      'esc.tmc.channelCitizenCall': '?????? ??? ?????? (155300)',
      'esc.tmc.copyBlock': 'TMC ?????? / ????????? / ???? ???? ?????',
      'esc.tmc.copyAllDone': '???? ???? ï¿½ TMC ??? ???????? ???? ????? ???',
      'esc.tmc.portalHint': 'thanecity.gov.in: ????? ? ?????? ?????? ????? ? ?????? ???????. ???? ????? ????? ???.',
      'esc.tmc.filedConsent': '??? ?????? TMC ???? ?? ?????????? (?????? / ????????? / ???? / 155300 / Aaple Sarkar)',
      'esc.tmc.complaintLabel': 'TMC ?????? / ?????? ????', 'esc.tmc.complaintPh': '???. TMC/2026/123456',
      'esc.tmc.complaintWarn': '? ??????? TMC ?????? ????? ??? ï¿½ ????? ??? ?? ?? ????? ???.',
      'esc.tmc.filedNote': 'TMC ??? ?????????? ï¿½ ???? ???? ???? ??? ?????.', 'esc.tmc.daysSince': 'TMC ??? ??????????? {n} ????',
      'esc.tmc.selfTitle': 'TMC ? ??? ???????', 'esc.tmc.selfBody': 'TMC ??? ??? ?????? ?????? ??? ï¿½ ??? ???? ???? ?????.',
      'esc.tmc.aaple': 'Aaple Sarkar ï¿½ TMC ??????? ?????? ???? ???',
      'esc.tmc.deptTitle': '????? ?????? (?????????)', 'esc.tmc.deptHint': '?????? ???? ???? ï¿½ ????, ??????, ??????? ????????.',
      'esc.tmc.dept.water': '????', 'esc.tmc.dept.health': '??????', 'esc.tmc.dept.pollution': '??????? ????????',
      'esc.tmc.tier.file.body': '???. thanecity.gov.in, 022-25331590 / 022-25331211, mc@thanecity.gov.in, ???? 155300. ?????? ???? ?????.',
      'esc.tmc.tier.matrix.body': '????? ???? ???? ?????? (022-25332685) ?? ????-??. TMC ?????? ???.',
      'esc.tmc.tier.zonal.body': '?????????? ?????? (mc@thanecity.gov.in) ???? ????????. @TMCaTweetAway ?? ???? ???? ???.',
      'esc.tmc.tier.grievance.body': '?? ????? ??? ??? Aaple Sarkar (grievances.maharashtra.gov.in) ï¿½ Thane Municipal Corporation ???? ???.',
      'esc.tmc.tier.openCall': 'TMC ???', 'esc.tmc.tier.openTweet': '@TMCaTweetAway', 'esc.tmc.tier.openEmail': 'MC ????', 'esc.tmc.tier.openAaple': 'Aaple Sarkar',
      'esc.tmc.consentRequired': '?????? ?????? ?????? TMC ???? ?? ??????????? ?????? ???.',
      'esc.pmc.subtitle': 'CivicRadar ????? ????????? ???? ?? ????? ??. PMC ??? ????????? ???????? ï¿½ ?????? ?????? ??? ???. ? PMC ???? ???.',
      'esc.pmc.recommended': '?????: PMC CARE WhatsApp ï¿½ ????????? Pune ????? ???? ???? ????.',
      'esc.pmc.fileHint': '??????? ???? ??? ????? PMC CARE ?????? ??? ??. ??? ?? ????:',
      'esc.pmc.channelWa': 'PMC CARE WhatsApp', 'esc.pmc.channelWaSmall': '??? ï¿½ ?????? ????',
      'esc.pmc.channelCall': '???-???? ?????????', 'esc.pmc.channelPortal': 'PMC CARE ??????',
      'esc.pmc.channelApp': 'PMC CARE ??', 'esc.pmc.channelAppSmall': 'Play Store ï¿½ App Store',
      'esc.pmc.copyBlock': 'PMC CARE / WhatsApp / ????????? ???? ?????',
      'esc.pmc.copyAllDone': '???? ???? ï¿½ PMC CARE / WhatsApp ?? ???????? ???? ????? ???',
      'esc.pmc.portalHint': 'PMC CARE ?????? ???? ??: ?????? ???? / ????? ?????? ???????. ???? ????? ????? ???.',
      'esc.pmc.filedConsent': '??? ?????? PMC ???? ?? ?????????? (PMC CARE / WhatsApp / ????????? / ??)',
      'esc.pmc.complaintLabel': 'PMC ?????? / ?????? ????', 'esc.pmc.complaintPh': '???. PMC/2026/123456',
      'esc.pmc.complaintWarn': '? ??????? PMC ?????? ????? ??? ï¿½ ????? ??? ?? ?? ????? ???.',
      'esc.pmc.filedNote': 'PMC ??? ?????????? ï¿½ ???? ???? ???? ??? ?????.', 'esc.pmc.daysSince': 'PMC ??? ??????????? {n} ????',
      'esc.pmc.selfTitle': 'PMC ? ??? ???????', 'esc.pmc.selfBody': 'PMC ??? ??? ?????? ?????? ??? ï¿½ ??? ???? ???? ?????.',
      'esc.pmc.tier.file.body': '???. PMC CARE ??????, WhatsApp, 1800 1030 222, ???? PMC CARE ??. ?????? ???? ?????.',
      'esc.pmc.tier.matrix.body': 'PMC CARE ???? ???-???? ????????? ?????? ????-??. ?????? ???? ???.',
      'esc.pmc.tier.zonal.body': '?????? ????????? ????? PMC CARE ?????? ???? WhatsApp ?????? ????????.',
      'esc.pmc.tier.grievance.body': '?? ????? ??? ??? Aaple Sarkar ï¿½ Pune Municipal Corporation ???? ???.',
      'esc.pmc.tier.openWa': 'WhatsApp', 'esc.pmc.tier.openCall': 'PMC ?????????', 'esc.pmc.tier.openAaple': 'Aaple Sarkar',
      'esc.pmc.consentRequired': '?????? ?????? ?????? PMC ???? ?? ??????????? ?????? ???.',
      'esc.pmc.aaple': 'Aaple Sarkar ï¿½ Pune Municipal Corporation ??????? ?????? ???? ???',
      'copy1916.pmc.header': 'PMC ?????? ???? (PMC CARE / WhatsApp / ????????? ?? ????-?????)',
      'copy1916.pmc.complaintNotFiled': 'PMC ?????? #: (??? ???? ???)', 'copy1916.pmc.complaintFiled': 'PMC ?????? #: {id}',
      'profile.fileCorp': '{corp} ??? ???????',
      'esc.tier.file.title': '1 ï¿½ ?????? ??????', 'esc.tier.file.body': '???. ????? PCO. ???? ???? ?????.',
      'esc.tier.matrix.title': '2 ï¿½ ???? {n}+ ï¿½ ?????', 'esc.tier.matrix.body': '7 ????? BMC ???-????????. WCO / AMC.',
      'esc.tier.zonal.title': '3 ï¿½ ???? {n}+ ï¿½ ????', 'esc.tier.zonal.body': 'Zonal DMC ??? @mybmc ????? ????.',
      'esc.tier.grievance.title': '4 ï¿½ ???? {n}+ ï¿½ ?????? / RTI', 'esc.tier.grievance.body': '?? ????? ???? Aaple Sarkar ???? RTI.',
      'profile.empty': '??? ?????? ???. ???? ???????? ?????', 'profile.emptyAction': '????? ???????',
      'profile.trackEscalate': '????? / ???', 'profile.fileBmc': 'BMC ??? ???????',
      'profile.status.resolvedCitizen': '???? (???)', 'profile.status.resolvedBmc': 'BMC ? ????????',
      'profile.status.notFiled': '????????? ???? ?? ???????',
      'profile.communityCleared': '??????????? ??? ?????? ï¿½ {corp} ?????? ??? ?????? ??? ???',
      'popup.communityCleared': '??????????? ??? ?????? ï¿½ {corp} ?????? ??? ?????? ??? ???',
      'profile.neighbourOne': '?????? ??? ?? ??????',
      'profile.pointsHint.base': '50 ??????/?????? ï¿½ +200 ?????????', 'profile.pointsHint.bonus': '{n} ï¿½ 50 ï¿½ +{bonus} ????',
      'profile.greeting': '??????, {name}', 'profile.greetingDefault': '??????, ??????', 'profile.selectWard': '????? ???? ???',
      'profile.society': '??????? / ???? (????????)',
      'profile.societyPh': '??????? ? ??? ?? ??????? / RWA ??? ???',
      'profile.societyHintWard': '{ward} ??? {n} ??????? ï¿½ ????? ?????.',
      'profile.societyHintNoWard': '??????? ????? ???? ????? ??? ???.',
      'profile.societyHintCustom': '??????? ? ??? ?? ??????? / RWA ??? ???.',
      'profile.societyRegistry': '????? ???????? ?????? ??????? ????',
      'map.youAreHere': '??? ???? ??',
      'about.subtitleNamed': '?????, ???? ??? ???? ??????? ï¿½ {name} ??????, ??????? ???? ???.',
      'safety.hide': '????? / ??????', 'safety.hidden': '????? ?????? ?????????.', 'safety.hideConfirm': '? ??? ???????? (?????? ????? ???.)',
      'popup.pending': '????', 'popup.resolved': '????????', 'popup.society': '??????? / ????',
      'partner.title': '??????? ??????',
      'partner.subtitle': 'NGO ?????????? ??? ?????????? ????. ????????? ?????? ??????? ??????.',
      'partner.ngoTitle': 'NGO ??????????',
      'partner.ngoBody': '??? ???, ?????????? ????? ??? ???? ?????',
      'partner.bmcTitle': '????????? ?????',
      'partner.bmcBody': '???????? BMC ????? ???? ï¿½ ?????? ???? ?????? ???',
      'admin.allWards': '??? ?????',
      'admin.avgDays': '?????? ????',
      'admin.exitMode': 'BMC ??? ???',
      'admin.healthLoading': '????? ??? ?? ?????ï¿½',
      'admin.healthSummary': '?? ?????? (?????? 7 ????)',
      'admin.markResolved': '???? ???????',
      'admin.overdue': '7+ ???? ????',
      'admin.pending': '??????',
      'admin.queueSubtitle': '?????? ??????? ???, ?????????? ???, ?????.',
      'admin.queueTitle': '???? ????',
      'admin.reportTitle': '???? ??????',
      'admin.resolved': '???????',
      'admin.resolveHint': '???????? ????? ï¿½ ??? ???? ???.',
      'admin.returnMap': '???? ?? ????',
      'admin.reviewTag': 'BMC ???????',
      'admin.sort.confirmed': '???? ??? ??? ??',
      'admin.sort.newest': '?????? ?????',
      'admin.sort.oldest': '???? ?????',
      'admin.sort.overdue': '???? ?????',
      'admin.subtitle': '?????? ???? ??????? ?????, ????? ???? ???.',
      'admin.title': 'BMC Admin',
      'badge.admin': 'BMC Admin',
      'badge.coord': '????? ??',
      'coord.cleared': '??????? ??? ??????',
      'coord.codeHint': '???????? ??? ??? ï¿½ ????? ???? RWA/??????? ????.',
      'coord.exitMode': 'NGO ??? ???',
      'coord.hubSubtitle': '?????? ??? ???, ????????? ???? ?????.',
      'coord.hubTitle': '????? ??',
      'coord.markTaskComplete': '???? ?????',
      'coord.openHazards': '???????? ?????? ????',
      'coord.openLabel': '?????? ????',
      'coord.pledges': '?????? ???',
      'coord.pledgesLabel': '???',
      'coord.scopeNbh': '???? ??? ï¿½ {label}',
      'coord.scopeWard': '????? ??? ï¿½ {ward}',
      'coord.subtitle': '??? ???, ????????? ?????, ???? ?????.',
      'coord.tasksEmpty': '??? ??? ???. ?????? ??? ?? "??? ??? ??????? ??? ??? ????" ?????.',
      'coord.tasksPending': '?????',
      'coord.title': '????? ?????',
      'coord.toVerify': '?????? ????',
      'coord.volunteersEmpty': '??? ????????? ???. Community ??? ??? ???.',
      'coord.volunteersLabel': '?????????',
      'coord.workflow': '????? ? ???? ??? ? ??????? ? ???? (+200 ??????)',
      'copy1916.category.garbage': '???? / ?? ????',
      'copy1916.category.potholes': '???? / ????? ????',
      'copy1916.category.stagnant-water': '??? / ???????? ???? (Public Health ? Pest Control)',
      'copy1916.category.streetlight': '??? ???????????',
      'copy1916.categoryLabel': '??????',
      'copy1916.civicradarLinkLabel': 'CivicRadar ???? (????????)',
      'copy1916.complaintFiled': 'BMC ?????? #: {id}',
      'copy1916.complaintNotFiled': 'BMC ?????? #: (??? ???? ???)',
      'copy1916.dateLabel': '?????',
      'copy1916.gpsLabel': 'GPS',
      'copy1916.gpsWarning': '? GPS {city} ???? ???? ?? ï¿½ ???????? ?????? ????? ?????',
      'copy1916.header': 'BMC ?????? ???? (1916 / MyBMC ??? ?? ????-?????)',
      'copy1916.landmarkLabel': '??????? ?????????? / ????',
      'copy1916.linkLocalhostNote': '(?? ??????? ??? ??? ???? ??? ????)',
      'copy1916.mapsLabel': 'Maps',
      'copy1916.marathiHeader': '--- ????? (??? ???????? ?????) ---',
      'copy1916.refId': '?????? (????????): CivicRadar ID {id}',
      'copy1916.wardLabel': '????? + ???????',
      'flow.legal': '????????',
      'flow.city': '????',
      'flow.ready': '?????',
      'flow.ward': '?????',
      'inquiry.coordBody': 'RWA/??????? ???? ????? NGO ??? ??????? ??? ï¿½ ????????? ???, ???? ?????, ??? ???? ?????. ?????? ?????? ?????? ??? ?????.',
      'map.legend.pending': '??????',
      'map.legend.resolved': '???????',
      'map.legend.you': '???',
      'onboard.wardError': '????????? ????? ???? ??? ???? ?????? ?????? ???.',
      'onboard.society': '??????? / ???? (????????)',
      'onboard.societyPh': '??????? ? ??? ?? ??????? / RWA ??? ???',
      'onboard.societyHintNoWard': '????? ????? ???? ??? ï¿½ ??? ??????? ?????.',
      'onboard.societyHintWard': '{ward} ??? {n} ??????? ï¿½ ????? ?????.',
      'onboard.societyHintCustom': '??????? ? ??? ?? ??????? / RWA ??? ???.',
      'persona.admin.exit': 'BMC ??? ???',
      'persona.admin.header': 'BMC ??????? ???',
      'persona.admin.idleEmpty': '???? ??????? ???. ??? ??? ???? ??????.',
      'persona.admin.idlePending': '{n} ???? ï¿½ ???? ???? ???? ??? ??? ?????.',
      'persona.ngo.exit': 'NGO ??? ???',
      'persona.ngo.header': 'NGO ????? ???',
      'pledge.message': '?????',
      'pledge.messagePh': '?????????? ???? ????ï¿½',
      'pledge.submit': '??? ?????',
      'pledge.subtitle': '???????? ???????????? ??????? ???.',
      'pledge.title': '??? ???',
      'pledge.type': '??????? ??????',
      'pledge.type.cleaning': '???? ???????',
      'pledge.type.snacks': '??????',
      'pledge.type.repellent': '??? repellent',
      'pledge.ward': '?????? ?????',
      'pledge.wardPh': '????? ???? ???ï¿½',
      'popup.taskOffered': '?????????? ????? ??? ???',
      'profile.emptyList': '??? ?????? ???. Report ????? ??????? ???????? ???? ??? ???.',
      'profile.persona.admin': 'BMC Admin',
      'profile.persona.ngo': 'NGO ?????',
      'toast.adminVerified': 'BMC ?????? ??????? ï¿½ ????? ???? ???.',
      'toast.bmcLoginFail': '???? BMC ????????????.',
      'toast.bmcMumbaiOnly': 'BMC ????? ???? Mumbai ????. ????? ?????????? ???? Profile ????? ???? ???.',
      'toast.bmcOnlyResolve': '???? ?????? BMC ??????? ????? ???.',
      'toast.bmcUnauthorized': '? ????? BMC ?????? ???? ?????? ???.',
      'toast.citizenView': '?????? ????? ?? ????.',
      'toast.cleanupLogged': '?????? ???? ??? ï¿½ BMC ?????? ?????? ???? ?????? ??? ???.',
      'toast.codeInvalid': '?????? ???? ?????? ???.',
      'toast.codeSent': '??? ??????? ï¿½ ??????? ???.',
      'toast.linkSent': '????-?? ???? ???????? ï¿½ ??????? ???.',
      'toast.authEmailFail': '????-?? ????? ????? ???? ???? ï¿½ Supabase SMTP ???????? ????? ??? ??? ?????? ???.',
      'toast.authEmailOffline': '?????? ????-?? ?????? ??? ï¿½ ??????? ????? ??? ??? ?????? ???.',
      'toast.authEmailRateLimit': '??? ??? ????-?? ????? ï¿½ ???? ????? ??? ??? ??? ??? ?????? ???.',
      'toast.authEmailInvalid': '????? ??????? ?????? ???? ?? ï¿½ ????? ??? ??? ?????? ???.',
      'toast.authEmailRedirect': '????-?? ?????????? URL ????? ??? ï¿½ Supabase Authentication ??? ????? ???? URL ?????.',
      'toast.linkExpired': '????-?? ???? ?????? ï¿½ ??? ???? ????.',
      'toast.complaintFirst': '????? ?????? ???? ????? ï¿½ ?? ? ??????.',
      'toast.complaintRequired': '???????? ???? ?????? ???? ???? ???.',
      'toast.complaintSaved': '?????? ???? ??????? ï¿½ ?????? ?????? ???.',
      'toast.contactConfig': '?????? ????? ??? ??? ï¿½ ??????????? About ???.',
      'toast.coordScopeNbh': '???? ??? ï¿½ {label}',
      'toast.coordScopeWard': '????? ????? ï¿½ ??????? {ward}',
      'toast.copyFail': '???? ? ?? ï¿½ ??????? ???????? ???? ???.',
      'toast.govEmail': 'gov.in / mcgm.gov.in ????? ?????.',
      'toast.gpsFail': 'GPS ?????? ????. ?????? ???? ??? ??? ?????? ???.',
      'toast.gpsRequired': '???? ??? ???? GPS ?????.',
      'toast.hazardTypeRequired': '?????? ???? ?????? ???? ???.',
      'toast.hoursVerified': '???? ???????! +200 Civic Points.',
      'toast.installed': 'CivicRadar ???????? ï¿½ ??? ????????? ????!',
      'toast.installHint': '??????? ???? ? Add to Home screen.',
      'toast.ngoCodeInvalid': '???? ???? ?????? NGO ???.',
      'toast.ngoCodeRequired': '????? ??? NGO ?????? ??? ???? ???.',
      'toast.ngoLoginFail': '???? ????? ????????????.',
      'toast.ngoVerified': '????? ??????? ï¿½ ??? ??? ????????? ???.',
      'toast.noLocation': '? ?????????? ?????? ?????? ???.',
      'toast.onboardFirst': '?????? ???? ????? ????? ???.',
      'toast.ownReportOnly': '???? ?????? ???????? ?????? ??? ???.',
      'toast.photoRequired': '?????? ?????? ???? ?????.',
      'toast.pledgeDelivered': '??????? ?????? ï¿½ ??? ???? ?????.',
      'toast.pledgeWardRequired': '??? ???? ?????? ????? ???? ???.',
      'toast.proofAdded': '?????? ???? ??????? ï¿½ ?????? ???? ??? ?????.',
      'toast.recentered': '???? ????? ????? ?? ?????????.',
      'toast.reportNotFound': '?????? ???? ?????? ???? ? ????? ?? ???.',
      'toast.resolvedProof': '???? ??????? ï¿½ ??????/??? ?????? ???????.',
      'toast.resolveFail': '?????? ????? ? ??.',
      'toast.saveFail': '????? ?????? ????.',
      'toast.saving': '????? ????? ???ï¿½',
      'toast.selfResolved': '???? ??????? ï¿½ ????-?? ???? ????!',
      'toast.shareWin': '?????? ???? ??? ??? ???.',
      'toast.storageFull': '??????? ?????? ï¿½ ???? ?????? ????. ??? ?????? ???.',
      'toast.syncConnected': '?????? ï¿½ ??????? ??? ?????? ?? ????.',
      'toast.syncLocal': '? ????? ?? ???????? ï¿½ ?????? ???? ??? ?????? ????.',
      'toast.verifying': '????? ????? ???ï¿½',
      'toast.volunteerNeighbourhoodRequired': '????, ??????? ???? ??? ???? ???.',
      'toast.volunteerRemoved': '????????? ???? ????.',
      'toast.volunteerSaved': '????????? ???? ????? ï¿½ ????? ????? ??? ???.',
      'toast.volunteerSignupRequired': '????? Community ??? ????????? ???? ?? ???.',
      'toast.volunteerSkillRequired': '????? ?????? ??? ?? ????? ???? ???.',
      'toast.volunteerTaskCompleted': '???? ????? ï¿½ ?????????? ?????.',
      'toast.volunteerTaskDuplicate': '? ???? ???? ??????? ??? ??? ??.',
      'toast.volunteerTaskOffered': '??? ????? ï¿½ ????? ? ????? ???? ??????.',
      'toast.volunteerWardRequired': '????? ????????????? ????? ??? ???.',
      'toast.wardRequired': '{city}?? ?????? ????????? ????? ???? ???.',
      'toast.welcome': '??????, {name}! ?????? ???? ?????.',
      'tos.accept': '??? 18+ ???, <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms</a> ??? <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a> ????????? ???',
      'tos.age': '?????? ??? ?????? ???? ???? 18+ ?????. 18 ?? ??? ????? 18+ ????-????, ?????? ???? NSS ?????? ?????? Terms ?????????? ??? ??.',
      'tos.content': '???? ?????? ??-???? ????. ??????, ID ???? ???????? ?????? ????.',
      'tos.continue': '??? ???',
      'tos.emergency': '?????? ???? ????. ????? ???? ??? ?? 112 ???? ???.',
      'tos.gps': 'GPS ???? ????? ???? ??? ???? ?????? ????? ?????? ï¿½ Terms ??????????? ???.',
      'tos.itAct': 'CivicRadar IT Act, 2000 ??????? ??????? ??. ??????? ???????? ?????.',
      'tos.notBmc': 'CivicRadar ???????? ï¿½ BMC, PMC, TMC ???? ??? ?????? ?????? ???? ????????? ???? ???????? ???.',
      'tos.share': 'WhatsApp, X ?? ??? ?????? ????????? ???? ???? ??? ï¿½ ?????? ?????.',
      'tos.subtitle': 'CivicRadar ?????? ?????? ????? ??? ????????.',
      'tos.title': '?????? ????',
      'volunteer.contact': '??? / WhatsApp (????????)',
      'volunteer.contactHint': '???????? ï¿½ ???? ?????/???? ??????? ??????. CivicRadar ???-??? ????? ???.',
      'volunteer.edit': '???? ??????? ???',
      'volunteer.empty': '??? ???? ?? ???. Community ????? ?????? ??? ???.',
      'volunteer.emptyAction': '???? ???????? ?????????',
      'volunteer.hours': '? ?????? ?????? ????',
      'volunteer.hoursCustom': '?????',
      'volunteer.hoursLabel': '? ?????? {n} ????',
      'volunteer.neighbourhoodHint': 'RWA, ??????? ???? ??? ï¿½ ???? ??? ?????? ????? ???? ??????.',
      'volunteer.neighbourhoodPh': '??.?. Phoenix Mills ???, Building 7 Worli',
      'volunteer.remove': '???? ???? ????',
      'volunteer.skills': '??? ???? ??? ??? ????',
      'volunteer.submit': '????????? ???? ?????',
      'volunteer.ward': '????? ?????',
      'admin.meta.reporter': '????????',
      'admin.meta.ward': '?????',
      'admin.meta.status': '??????',
      'admin.meta.lat': 'Lat',
      'admin.meta.lng': 'Lng',
      'admin.close': '???',
      'aria.close': '???',
      'aria.lang': '???? ????',
      'aria.recenter': '???? ????? ????? ?? ????????? ???',
      'aria.leaderboard': '?????? ????????? ??? ???',
      'aria.profile': '????????',
      'aria.report': '???? ??????',
      'aria.filterWard': '??????? ??????',
      'aria.sortReports': '?????? ????',
      'auth.demoTag.admin': '???? ?????? ï¿½ ???????????? BMC ????? ??????',
      'auth.demoTag.lead': '???? ?????? ï¿½ ???????????? ????? + NGO ??????',
      'auth.officialEmail': '?????? ?????',
      'auth.emailHint': '???? gov.in / mcgm.gov.in ?? BMC ??????.',
      'auth.sendCode': '????-?? ???? ?????',
      'auth.linkInstructions': '?????? ????? ????? ??? ????-?? ???? ?? ??? ???. ? ??? ??????? ???? ï¿½ ??? ????-?? ???? ???? ???? ????.',
      'auth.otpFallback': '6-????? ??? ???',
      'auth.otp': '6-??? ???',
      'auth.verifyEnter': '????? ??? ??????',
      'auth.email': '?????',
      'auth.ngoCode': 'NGO ?????? ???',
      'auth.ngoCodePh': 'CivicRadar ?????? ?????? ????',
      'auth.username': '???????',
      'auth.password': '???????',
      'auth.loginDemo': '????? (????)',
      'admin.health.noData': '? ????? ?? ??? ????? ???? ???.',
      'admin.health.deviceSource': '????? ??? (?????? 7 ????)',
      'admin.health.cloudSource': '?????? ???????? (??? ??????????)',
      'admin.health.cloudUnavailable': '?????? ????????? ?????? ??? ï¿½ Supabase ??? analytics SQL ?????.',
      'admin.health.connectSupabase': '????-?????? ????? ???? Supabase ?????? ???.',
      'admin.health.sessions': '????',
      'admin.health.tabViews': '??? ????',
      'admin.health.reportsFiled': '?????? ????',
      'admin.health.corroborations': '??? ??',
      'admin.health.bmcFiled': 'BMC ????',
      'admin.health.resolved': '???????',
      'about.founderDefault': 'CivicRadar ???',
      'about.teamLabel': 'CivicRadar ???',
      'about.teamRole': '????????? ?????? ???? ????',
      'config.contactMissing': '(?????? ??????? ???)',
      'demo.badge': '???????? ????',
      'profile.withdrawAnalytics': '?????????? ????? ???? ??',
      'profile.withdrawAnalyticsDone': '?????????? ????? ???? ï¿½ ??????? ???? ???.',
      'profile.withdrawGps': '????? ????? ???? ??',
      'profile.withdrawGpsDone': '????? ????? ???? ï¿½ ???? ??? ?? ???? ?????? ???? ???.',
      'profile.privacyContact': '???????? / ?????? ??????',
      'toast.tosRequired': '?????? ??????? ?????? Terms ??? Privacy (18+) ????????.',
      'tos.analytics': '???? ????? ?????????? (????????) ??????????? ?????. ????, GPS ?? ??? ??????? ???.',
      'tos.analyticsOptIn': '??? ???? ????? ???????????? ????? ???? ??? (???????? ï¿½ Profile ????? ?????? ?? ????)',
      'volunteer.ageNote': 'Terms ???? 18+ ?????. 18 ?? ??? ????? ????-???/?????? ???? NSS ????? ???? ?.',
      'admin.meta.neighbourConfirm': ' ï¿½ {n} ? ??? ?? ??????',
      'coord.hazardsEmpty': '????? ?????????? ????? ?????? ???? ???.',
      'coord.volunteerOffers': '{n} ????????? ???',
      'coord.hazardCleaned': '??? ??????',
      'coord.logCleanup': '???? ?????',
      'admin.health.communityCleanups': '????????? ????',
      'admin.health.whatsappShares': 'WhatsApp ???',
      'admin.health.errors': '????',
      'admin.health.perfSamples': '?????????? ?????',
      'admin.health.avgPerf': '?????? ??? ??? (???????)',
      'admin.health.bufferedEvents': '??? ?????? (?????)',
      'tracking.open': '?????????? ??? ????????',
      'tracking.title': '?????????? ??? ????????',
      'tracking.subtitle': '??????? ?????? ????????? ï¿½ ???????, ???????, ?????????, ???????.',
      'tracking.period': '???????',
      'tracking.days7': '?????? 7 ????',
      'tracking.days30': '?????? 30 ????',
      'tracking.days90': '?????? 90 ????',
      'tracking.wardFilter': '?????',
      'tracking.sessions': '???????',
      'tracking.pwaInstalls': 'PWA ????????',
      'tracking.reports': '???????',
      'tracking.resolved': '???????',
      'tracking.pwaNote': 'PWA ???????? ??????? (??? ??????? / standalone). GitHub Pages ?? ????? ??????? ???? ????? ???.',
      'tracking.loading': '????????? ??? ?? ?????ï¿½',
      'tracking.sourceLocal': '????? + ??????? ??????? (???? / ??????)',
      'tracking.sourceCloud': '?????? ???????? (??? ??????????)',
      'tracking.sourceCloudFail': '?????? ????????? ?????? ??? ï¿½ Supabase ??? tracking SQL ?????.',
      'tracking.reportsByCategory': '?????? ??????? ???????',
      'tracking.escalations': '?????? ???? ?????',
      'tracking.neighbourhoods': '???? / ??????? ???????',
      'tracking.reporters': '?????? ????????',
      'tracking.meToo': '??? ??',
      'tracking.filed': '?????? ????',
      'tracking.leads': '???? ???',
      'tracking.empty': '? ?????????? ???? ???.',
      'tracking.pending': '??????',
      'tracking.channelUnknown': '???? ????',
      'volunteer.neighbourhood': '???? / ??????? / ???',
      'volunteer.subtitle': '?????? ???? ????? ï¿½ ?????? ????????? ????????? ???.',
      'volunteer.skill.awareness': '?????? ??? WhatsApp outreach',
      'volunteer.skill.cleanup': '???????? ???? ??? ?????',
      'volunteer.skill.pledge': '??? ????? (???????)',
      'profile.neighbourMany': '??????? ??? ?? ??????',
      'ref.welcomeTitle': '?? ?????? ???? ??????? ?????? ??',
      'ref.welcomeBody': '{city} ???? ?? ??????? {n} ?????? ??. ????? ??????? ?????? ????? ??? ï¿½ ???? 30 ????????? ?? ??? ???.',
      'ref.welcomeBodyEmpty': '? ????????? {city} ??? ??????? ?????? ???? ???????????? ????? ??? ï¿½ ????? 30 ??????.',
      'ref.welcomeCta': '???? ???',
      'ref.welcomeReport': '????? ?????',
      'ref.dismiss': '??????? ??? ???',
      'season.monsoonPrep': '??????? ??? ?????? ?? ??? ????? ???? ????? ?????? ???????? ???? ??? ??? ï¿½ ????? ??? ???.',
      'season.monsoonPeak': '????????? ??? ???????? ???? ???????? ?????? ??. ??? ????? ???????? ????? ?????.',
      'season.ganesh': '???? ??????? ?? ?????? ???? ????? ????? ?????? ???? ï¿½ ????? ??? ??????? ????? ???? ???????? ???? ?????.',
      'season.denguePeak': '?????????? ???? ?? ????? ??????? ??????? ???? ??. 30 ???????? ?????? ????? ????? ????? ??.',
      'season.dismiss': '????? ???? ??? ???',
      'social.wardWeek': '?? ? ???????? {ward} ??? {n} ??????? ????????',
      'social.wardWeekBacked': '?? ? ???????? {ward}: {n} ???? ï¿½ {c} ??????',
      'social.wardWeekEmpty': '? ???????? {ward} ??? ????? ????? ï¿½ ?????? ????????? ?????? ??.',
      'recap.title': '? ???????? ????? ?????',
      'recap.share': '????????? ?????? ??? ???',
      'share.weeklyRecap': '?? ? ?????? ???????? {ward}: {reports} ??? ??????, {resolved} ???, {backed} ????????? ??????. CivicRadar ?? ????? ??\n{link}\n{hashtags}',
      'feedback.menu': '???????? ?????',
      'feedback.title': '???????? ?????',
      'feedback.subtitle': '??? ??? ??? ?? ??? ????? ??? ???? ????? ï¿½ ?? ????? ??? ???? ?????? ??.',
      'feedback.categoryLabel': '??? ???????? ?????????',
      'feedback.catIdea': '?????',
      'feedback.catBug': '???',
      'feedback.catOther': '????',
      'feedback.messageLabel': '????? ????????',
      'feedback.messagePh': '??? ????, ???? CivicRadar ?? ???? ???? ??? ????? ????? ?????',
      'feedback.contactLabel': '?????? (???????? ï¿½ ???? ?? ??? ???? ?????? ??)',
      'feedback.contactPh': '???? ???? ???',
      'feedback.privacy': '??? ????? ?????? ??????? ??? ???? ???. ???? ? ?????????? ???? ???? ???? ????? ??.',
      'feedback.submit': '???????? ?????',
      'feedback.errorEmpty': '???? ????? ????? ?? ????? ????? ???.',
      'feedback.error': '????? ?????? ???? ï¿½ ????? ??????? ???????? ??. ???? ????? ??? ?????? ???.',
      'feedback.success': '????! ????? ???????? ?????? ???.',
      'feedback.successLocal': '???????? ï¿½ ?????? ??? ?????? ??? ???? ???? ??????.',
      'access.title': '?????? ?????? ???? ?????? ???',
      'access.subtitle': 'NGO ??? ?????? ??????? ??? BMC ???????? ????.',
      'access.step1': '???? ???? ????? ???? ???? ???',
      'access.step2': 'CivicRadar ??? ??????? ??? ??',
      'access.step3': '?????? ????? ???? ????? ??? ?????',
      'access.roleLabel': '??? ???ï¿½',
      'access.roleNgo': 'NGO ??????',
      'access.roleBmc': 'BMC ???????',
      'access.nameLabel': '?????? ???',
      'access.namePh': '????? ???',
      'access.orgLabel': '??????',
      'access.orgPh': 'NGO / ????? / RWA ??? ???',
      'access.optional': '(????????)',
      'access.cityLabel': '????',
      'access.wardLabel': '?????',
      'access.wardPh': '????? ?????',
      'access.contactLabel': '?????? ï¿½ ???? ???? ???',
      'access.emailPh': 'you@example.com',
      'access.phonePh': '???',
      'access.contactHint': '?????? ???? ?? ???. ????? ??? ???? ??; ???? ??? ???? ?? ????? ? ?????? ??????.',
      'access.proofLabel': '??? / ??????',
      'access.proofOptional': '(???????? ï¿½ BMC ???? ?????)',
      'access.proofAdd': '?????? ???? ????',
      'access.noteLabel': '????? ????',
      'access.notePh': '????? ????, ???? ???? ??????, ?????.',
      'access.submit': '?????? ?????',
      'access.haveCode': '???? ???? ??????? ????? ??? ??',
      'access.confirmTitle': '?????? ???',
      'access.confirmBody': '????! CivicRadar ??? ????? ???????? ??????? ???? ??? ??????? ???? ???? ???????? ???? ????? ??? ?????? (???? ???? ???). ?????? ????? ???? ?? ??? ????? ???? ???.',
      'access.confirmLocal': '? ?????? ?? ???????? ï¿½ ?????? ??? ?????? ??? ???? ???? ???.',
      'access.done': '?????',
      'access.profileCta': 'NGO ??? BMC ????: ?????? ?????? ???? ?????? ???',
      'access.partnerCta': '??? ?????? ???? ?????? ?????? ???? ?????? ???',
      'access.partnerClaim': '???? ???? ????? ??? ??',
      'access.claimTitle': '????? ????? ??? ???? ???',
      'access.claimSubtitle': 'CivicRadar ???? ?????? ???? ?????? ????? ???? ?????? ??? ???? ???.',
      'access.claimLabel': '????? ???',
      'access.claimPh': 'CR-XXXXXX',
      'access.claimSubmit': '?????? ????? ???',
      'access.reviewOpen': '?????? ???????',
      'access.reviewTag': 'CivicRadar ???',
      'access.reviewTitle': '?????? ???????',
      'access.reviewSubtitle': '?????? ??? BMC ?????? ??????? ?????/?????. ?????? ?? ????? ??? ???? ??? ??.',
      'access.pending': '????',
      'access.approved': '?????',
      'access.rejected': '??????',
      'access.reviewEmpty': '??? ??? ?????? ???. ??? ?????? ??? BMC ??????? ???? ??????.',
      'access.approve': '????? ???',
      'access.reject': '?????',
      'access.copyCode': '??? ???? ???',
      'access.codeCopied': '????? ??? ???? ??? ï¿½ ???????? ????? ?????? ????? ?????? ??? ???.',
      'access.roleNgoTag': 'NGO ??????',
      'access.roleBmcTag': 'BMC ???????',
      'access.statusApproved': '?????',
      'access.statusRejected': '??????',
      'access.statusPending': '????',
      'access.errName': '???? ??? ?????? ??? ?????.',
      'access.errContact': '?????? ???? ???? ???? ??? ?????.',
      'access.submitted': '?????? ?????? ï¿½ ??? ??????? ??? ???? ????? ??? ????????.',
      'access.submittedLocal': '?????? ????? ï¿½ ?????? ??? ?????? ???? ??? ??????? ???.',
      'access.submitError': '????? ?????? ???? ï¿½ ????? ????? ???????? ??. ???? ??? ??? ?????? ???.',
      'access.claimErrEmpty': '?????? ????? ??? ???? ???.',
      'access.claimErrInvalid': '? ??? ????? ??? ???? ??? ????? ??? ???.',
      'access.claimErrUsed': '? ??? ??????? ????? ??? ??.',
      'access.claimedNgo': '?????? ????? ï¿½ ?????? ??, ??????!',
      'access.claimedBmc': 'BMC ?????? ????? ï¿½ ????? ????? ???? ???.',
      'access.approvedToast': '????? ï¿½ ????? ??? {code}',
      'access.rejectedToast': '?????? ?????.',
      'access.proofAttached': '?????? ??????',
      'access.proofTooBig': '??? ??? ???? ï¿½ ???? ??? ???? ???? ????.',
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
      const ward = r.ward ? r.ward.split('ï¿½')[0].trim() : getCityLabel(getReportCity(r));
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
    const leadTail = a.split('ï¿½').pop().trim();
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
      // emailRedirectTo must match Authentication ? URL Configuration redirect allowlist.
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
        console.warn('delete_user_data RPC failed ï¿½ falling back to row deletes:', e && e.message);
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
      // A backed hazard may have been resolved on another device ï¿½ notify on sync.
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
          ? `<span class="impact-wall__ward">${escapeHtml(s.wards[0].split('ï¿½')[0].trim())} ward</span>`
          : '';
        const inner = `
          <span class="impact-wall__badge">${escapeHtml(t('about.sponsored'))}</span>
          <p><strong>${escapeHtml(s.business)}</strong> ï¿½ ${escapeHtml(s.offer)}</p>
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
    const highlights = (f.highlights || []).map((h) => `ï¿½ ${h}`).join('\n');
    return [
      `CivicRadar ï¿½ Community Impact Summary (${date})`,
      '',
      `Project: ${t('about.teamLabel')}`,
      f.tagline || 'Community-driven civic hazard reporting for Mumbai, Pune, and Thane.',
      '',
      'Impact metrics:',
      `ï¿½ Reports logged: ${s.totalReports}`,
      `ï¿½ Hazards resolved: ${s.resolved}`,
      `ï¿½ Neighbour confirmations ("Me too"): ${s.confirmations}`,
      `ï¿½ Volunteer pledges: ${s.pledges}`,
      `ï¿½ BMC wards with activity: ${s.wardsActive}`,
      '',
      f.story || '',
      '',
      'Technical highlights:',
      highlights || 'ï¿½ PWA ï¿½ Multi-language ï¿½ BMC escalation ï¿½ Role-based dashboards',
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

  // Prefer execCommand ï¿½ reliable in WebViews, PWAs, and automated browsers.
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
    catch { /* storage full / unavailable ï¿½ non-fatal */ }
  }

  // Assemble a feedback row. Only standard, non-personal context is attached
  // automatically (anon uid, env, ward/city, coarse UA) ï¿½ no names.
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
    catch { /* storage full ï¿½ non-fatal */ }
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
    const meta = [n.org_name, n.neighbourhood_label].filter(Boolean).map((m) => escapeHtml(m)).join(' ï¿½ ');
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
    const contact = [req.contact_email, req.contact_phone].filter(Boolean).join(' ï¿½ ');
    const meta = [req.org_name, req.ward, (CITIES[req.city] && CITIES[req.city].label) || req.city]
      .filter(Boolean).map((m) => escapeHtml(m)).join(' ï¿½ ');
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
    const schoolLoc = [FOUNDER.school, FOUNDER.location].filter(Boolean).join(' ï¿½ ');
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
    return ward ? ward.split('ï¿½')[0].trim() : '';
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

  /* ---------- In-app reminders (P0/P1) ï¿½ deduped, snooze-friendly ---------- */
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
    return ward.split('ï¿½')[0].trim();
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
     denied all degrade gracefully ï¿½ the app never blocks or errors on this. */
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

    Backend.confirmReport(reportId);
    if (window.CivicAnalytics) {
      CivicAnalytics.track('report_corroborated', { reportId: String(reportId) }, report.ward);
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

  // "Looks fixed" ï¿½ community spot-check (not official BMC confirmation).
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

  // Launch hazard types ï¿½ each has i18n labels, map markers, share templates, and copy1916 categories.
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
        headline: loggedDays === 0 ? 'Logged on CivicRadar today' : `Logged ${dayWord(loggedDays)} ago ï¿½ not yet sent to BMC`,
        detail: 'BMC has not received this. File an official complaint to start the real clock.',
      };
    }
    const days = getDaysPending(report.filedAt || report.timestamp);
    if (days >= ESCALATION_DAYS.grievance) {
      return { key: 'grievance', filed: true, days,
        headline: `${dayWord(days)} since filing ï¿½ overdue`,
        detail: 'Past 30 days. Escalate to the Public Grievance Cell / Aaple Sarkar, or file an RTI.' };
    }
    if (days >= ESCALATION_DAYS.zonal) {
      return { key: 'zonal', filed: true, days,
        headline: `${dayWord(days)} since filing ï¿½ no action`,
        detail: 'Escalate to the Zonal Deputy Municipal Commissioner and add public pressure on X.' };
    }
    if (days >= ESCALATION_DAYS.matrix) {
      return { key: 'matrix', filed: true, days,
        headline: `${dayWord(days)} since filing ï¿½ escalate`,
        detail: 'Past BMCï¿½s 7-day matrix. Follow up with your Ward Complaint Officer / Asst. Commissioner.' };
    }
    return { key: 'filed', filed: true, days,
      headline: `Complaint filed ï¿½ ${dayWord(days)} in`,
      detail: 'With BMC. Charter target is ~3 days; weï¿½ll prompt escalation if it stalls.' };
  }

  // Short status line used on report cards and the admin detail modal.
  function getClockLine(report) {
    const s = getReportStage(report);
    const city = getReportCity(report);
    if (s.filed && report.complaintId) {
      return `${getComplaintRefPrefix(city)} #${report.complaintId} ï¿½ ${s.headline}`;
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
  // (gov-email magic link for BMC, NGO invite code for coordinators) ï¿½ see the login
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
        leadText += ' ï¿½ ' + t('persona.ngo.newPledges').replace('{n}', String(newPledges));
      }
      if (newHazards > 0) {
        leadText += ' ï¿½ ' + t('persona.ngo.newHazards').replace('{n}', String(newHazards));
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
        ? user.ward.split('ï¿½')[0].trim()
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
      const wardShort = user.ward ? user.ward.split('ï¿½')[0].trim() : (ward || '');
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
    } catch { /* history unavailable ï¿½ Escape/close button still work */ }
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
    if (canvas.classList.contains('visible')) showPhotoConfirm();
    else resetPhotoConfirm();
    updateReportFlowSteps(canvas.classList.contains('visible') ? 'submit' : 'photo');
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
        scopeEl.textContent = t('coord.scopeWard').replace('{ward}', user.ward.split('ï¿½')[0].trim());
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
      setMetaContent('meta[property="og:title"]', `CivicRadar ï¿½ ${ward} monsoon hazard map`);
      const pending = getWardReportStats().find((s) => s.name === user.ward);
      const openCount = pending ? pending.pending : 0;
      setMetaContent('meta[property="og:description"]',
        `${ward}: ${openCount} open hazard(s) on the map ï¿½ pin, Me too, beat other wards. Free PWA ï¿½ #MonsoonGuardian`);
    }
  }

  function runBootSequence() {
    const demo = new URLSearchParams(location.search).get('demo');
    if (demo === 'tour' || demo === 'persona') {
      localStorage.setItem(COACH_KEY, '1');
      if (!user.tosAccepted) user.tosAccepted = true;
      if (!user.analyticsConsent) user.analyticsConsent = true;
      if (!user.ward) user.ward = 'G/N Ward ï¿½ Dadar, Shivaji Park';
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
        <div class="popup__meta">${escapeHtml(status)} ï¿½ ${escapeHtml((report.ward || getCityLabel(getReportCity(report))).split('ï¿½')[0].trim())}</div>
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
          wardCode: ward.split('ï¿½')[0].trim(),
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
    const btnWithdrawAnalytics = $('#btnWithdrawAnalytics');
    if (btnWithdrawAnalytics) btnWithdrawAnalytics.addEventListener('click', withdrawAnalyticsConsent);
    const btnWithdrawGps = $('#btnWithdrawGps');
    if (btnWithdrawGps) btnWithdrawGps.addEventListener('click', withdrawGpsConsent);
    const btnPrivacyContact = $('#btnPrivacyContact');
    if (btnPrivacyContact) {
      const grievanceEmail = getGrievanceEmail();
      if (grievanceEmail) {
        btnPrivacyContact.href = 'mailto:' + grievanceEmail
          + '?subject=' + encodeURIComponent('CivicRadar ï¿½ privacy / DPDP grievance');
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
      if (email) window.open(`mailto:${email}?subject=${encodeURIComponent('CivicRadar ï¿½ inquiry')}`, '_self');
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
    // Returning from the native camera also pops history ï¿½ keep the report sheet open.
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
            // Don't create a duplicate ï¿½ offer to corroborate the existing pin instead.
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
    return ward ? ward.split('ï¿½')[0].trim() : '';
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
      console.warn('[CivicRadar] Set publicUrl in js/config.js before sharing ï¿½ WhatsApp links will point to localhost.');
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
    const isFirst = reportCount === 1;
    const isMilestone = REPORT_CELEBRATION_MILESTONES.includes(reportCount);
    launchConfetti({ intensity: isFirst || isMilestone ? 'celebrate' : 'mini' });
    if (isFirst) {
      setTimeout(() => showToast(t('toast.badgeMonsoon'), 'success', 4500), 700);
    } else if (isMilestone && reportCount > 1) {
      setTimeout(
        () => showToast(t('toast.reportMilestone').replace('{n}', String(reportCount)), 'success', 4000),
        600
      );
    }
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
        drawImagePlaceholder(ctx, leftX, imgY, imgW, imgH, 'ï¿½', dark);
      }
    } else {
      drawImagePlaceholder(ctx, leftX, imgY, imgW, imgH, 'ï¿½', dark);
    }

    if (hasAfter) {
      try {
        const afterImg = await loadCanvasImage(report.resolutionImage);
        drawRoundedImage(ctx, afterImg, rightX, imgY, imgW, imgH, 24);
      } catch {
        drawImagePlaceholder(ctx, rightX, imgY, imgW, imgH, '?', dark);
      }
    } else {
      drawImagePlaceholder(ctx, rightX, imgY, imgW, imgH, '?', dark);
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
      /* fall back silently ï¿½ WhatsApp/Twitter buttons remain available */
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
            ${hasBefore ? `<img src="${report.image}" alt="">` : '<div class="proof-compare__placeholder">ï¿½</div>'}
          </div>
          <div class="proof-compare__col">
            <span class="proof-compare__label">${escapeHtml(t('profile.proofAfter'))}</span>
            ${hasAfter ? `<img src="${report.resolutionImage}" alt="">` : '<div class="proof-compare__placeholder">?</div>'}
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
    if (!wardParts || (!wardParts.shortCode && !wardParts.code)) return 'ï¿½';
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
    const title = `${hazard} ï¿½ ${ward} | CivicRadar #MonsoonGuardian`;
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
          `Follow-up ï¿½ ${corp} complaint ${cid}`,
          `Ward: ${wardFull}`,
          `Issue: ${hazard} / stagnant water ï¿½ still unresolved after ${ESCALATION_DAYS.matrix}+ days.`,
          `Request: Please escalate for pest-control / drainage action.`,
          `CivicRadar: ${link}`,
        ].join('\n');
      }
      if (tier === 'zonal') {
        return `${corp} complaint ${cid} ï¿½ ${hazard} in ${wardName} still unresolved after ${ESCALATION_DAYS.zonal}+ days. Please escalate to senior officer. ${link} #CivicRadar`;
      }
      if (tier === 'grievance') {
        return [
          'RTI / grievance follow-up (informational draft ï¿½ not legal advice)',
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
        `Follow-up ï¿½ BMC complaint ${cid}`,
        `Ward: ${wardFull}`,
        `Issue: ${hazard} / stagnant water ï¿½ still unresolved after ${ESCALATION_DAYS.matrix}+ days.`,
        `Request: Please escalate to Ward Complaint Officer / Assistant Municipal Commissioner for pest-control action.`,
        `CivicRadar: ${link}`,
      ].join('\n');
    }
    if (tier === 'zonal') {
      return `@${BMC.twitter} Complaint ${cid} ï¿½ ${hazard} in ${wardName} still unresolved after ${ESCALATION_DAYS.zonal}+ days. Please escalate to Zonal DMC and depute Pest Control Officer. ${link} #CivicRadar #MumbaiMonsoon`;
    }
    if (tier === 'grievance') {
      return [
        'RTI application ï¿½ complaint status (informational draft ï¿½ not legal advice)',
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
        `Follow-up ï¿½ TMC complaint ${cid}`,
        `Ward: ${wardFull}`,
        `Issue: ${hazard} / stagnant water ï¿½ still unresolved after ${ESCALATION_DAYS.matrix}+ days.`,
        `Request: Please escalate to ward office / Health dept (022-25332685) for anti-larval treatment.`,
        `CivicRadar: ${link}`,
      ].join('\n');
    }
    if (tier === 'zonal') {
      return `@TMCaTweetAway Complaint ${cid} ï¿½ ${hazard} in ${wardName} still unresolved after ${ESCALATION_DAYS.zonal}+ days. Please escalate to Municipal Commissioner (mc@thanecity.gov.in). ${link} #CivicRadar #ThaneMonsoon`;
    }
    if (tier === 'grievance') {
      return [
        'Aaple Sarkar follow-up (informational draft ï¿½ not legal advice)',
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
        `Follow-up ï¿½ PMC complaint ${cid}`,
        `Ward: ${wardFull}`,
        `Issue: ${hazard} / stagnant water ï¿½ still unresolved after ${ESCALATION_DAYS.matrix}+ days.`,
        `Request: Please escalate via PMC CARE or toll-free helpline 1800 1030 222 for anti-larval treatment.`,
        `CivicRadar: ${link}`,
      ].join('\n');
    }
    if (tier === 'zonal') {
      return [
        `PMC CARE follow-up ï¿½ complaint ${cid}`,
        `Ward: ${wardFull}`,
        `Issue: ${hazard} still unresolved after ${ESCALATION_DAYS.zonal}+ days.`,
        `Please escalate through PMC CARE portal (pmccare.in) or WhatsApp 9689900002.`,
        `CivicRadar: ${link}`,
      ].join('\n');
    }
    if (tier === 'grievance') {
      return [
        'Aaple Sarkar follow-up (informational draft ï¿½ not legal advice)',
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
    const subject = encodeURIComponent(`Stagnant water complaint ï¿½ ${getWardShortName(report?.ward) || 'Thane'}`);
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
          <div class="profile-pledge-item__meta">${escapeHtml((p.ward || '').split('ï¿½')[0].trim())} ï¿½ ${escapeHtml(formatRelativeTime(p.timestamp))}</div>
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
  // invites them to share the win ï¿½ a key viral re-engagement moment.
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

    const wardName = fresh[0].ward ? fresh[0].ward.split('ï¿½')[0].trim() : 'your area';
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

    const wardName = fresh[0].ward ? fresh[0].ward.split('ï¿½')[0].trim() : 'your area';
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
    const wardLabel = user.ward ? user.ward.split('ï¿½')[0].trim() : t('header.context');
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

  // Date-aware, India-context seasonal nudge. Returns null off-season (Novï¿½Apr).
  function getSeasonalHook() {
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
        (streak >= 2 ? ` ï¿½ ${t('profile.streak').replace('{n}', String(streak))}` : '');
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
          hint += ` ï¿½ ${t('profile.nextStreakBadge')
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
              <div class="report-card__meta">${escapeHtml(formatRelativeTime(r.timestamp))}${r.notes ? ` ï¿½ ${escapeHtml(r.notes)}` : ''}</div>
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
    $('#adminReportWard').textContent = report.ward || 'ï¿½';
    $('#adminReportStatus').textContent = t('popup.pending');
    $('#adminReportStatus').className = 'status-badge status-badge--pending';
    $('#adminReportLat').textContent = report.lat != null ? report.lat.toFixed(6) : 'ï¿½';
    $('#adminReportLng').textContent = report.lng != null ? report.lng.toFixed(6) : 'ï¿½';
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
    const parts = ward.split('ï¿½').map((s) => s.trim());
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
    const wardSuffix = ($('#aqWardFilter')?.value || '').split('ï¿½')[0].trim().replace(/\s+/g, '-') || 'all-wards';
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
      lines.push(`${wardLine} ï¿½ ${I18N.mr[`hazard.${report.hazard}`] || hazardEn}`);
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
      wards.map((w) => `<option value="${escapeHtml(w)}">${escapeHtml(w.split('ï¿½')[0].trim())}</option>`).join('');
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
        ? ` ï¿½ ${item.pending} ${t('tracking.pending')}`
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
        scopeTag.textContent = t('coord.scopeWard').replace('{ward}', user.ward.split('ï¿½')[0].trim());
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

    const set = (id, val) => { const el = $(id); if (el) el.textContent = val != null ? String(val) : 'ï¿½'; };
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
              <div class="queue-item__title">${escapeHtml(hazardLabel(r.hazard))} ï¿½ ${escapeHtml((r.ward || getCityLabel(getReportCity(r))).split('ï¿½')[0].trim())}</div>
              <div class="queue-item__meta">${escapeHtml(formatRelativeTime(r.timestamp))} ï¿½ ${escapeHtml(getClockLine(r))}</div>
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
        <div class="profile-volunteer-card__meta">${escapeHtml(t('volunteer.hoursLabel').replace('{n}', String(signup.hours)))} ï¿½ ${escapeHtml((signup.ward || '').split('ï¿½')[0].trim())}</div>
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
      ward: 'G/N Ward ï¿½ Dadar, Shivaji Park',
      message: 'Volunteer cleanup shift ï¿½ 4 hours completed at Shivaji Park.',
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
              <span class="pledge-item__type">${escapeHtml(pledgeTypeLabel(p.type))}${isMock ? ' ï¿½ Demo' : ''}</span>
              ${statusBadge}
            </div>
            <span class="pledge-item__ward">${escapeHtml(p.ward)}</span>
            <p class="pledge-item__message">${escapeHtml(p.message || 'ï¿½')}</p>
            <div class="pledge-item__footer">
              <span class="pledge-item__citizen">${escapeHtml(p.citizen || 'Anonymous')} ï¿½ ${escapeHtml(formatRelativeTime(p.timestamp))}</span>
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
          .join(' ï¿½ ');
        return `
          <li class="pledge-item">
            <div class="pledge-item__header">
              <span class="pledge-item__type">${escapeHtml(v.displayName || 'Volunteer')}</span>
              <span class="status-badge">${escapeHtml(t('volunteer.hoursLabel').replace('{n}', String(v.hours)))}</span>
            </div>
            <span class="pledge-item__ward">${escapeHtml(v.neighbourhood)} ï¿½ ${escapeHtml((v.ward || '').split('ï¿½')[0].trim())}</span>
            <p class="pledge-item__message">${skills || 'ï¿½'}${v.contact ? ` ï¿½ ${escapeHtml(v.contact)}` : ''}</p>
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
              <div class="queue-item__title">${escapeHtml(task.volunteerName || 'Volunteer')} ï¿½ ${escapeHtml((task.neighbourhood || '').slice(0, 40))}</div>
              <div class="queue-item__meta">${report ? escapeHtml(hazardLabel(report.hazard)) : 'Hazard'} ï¿½ ${escapeHtml((task.ward || '').split('ï¿½')[0].trim())}</div>
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
              <div class="queue-item__title">${escapeHtml(hazardLabel(r.hazard))} ï¿½ ${escapeHtml((r.ward || getCityLabel(getReportCity(r))).split('ï¿½')[0].trim())}</div>
              <div class="queue-item__meta">${escapeHtml(formatRelativeTime(r.timestamp))}${r.notes ? ` ï¿½ ${escapeHtml(r.notes)}` : ''}</div>
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
