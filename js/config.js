/*
 * CivicRadar runtime configuration.
 *
 * LAUNCH_CHECKLIST (founder must-do before end-user launch):
 *   [x] publicUrl          — https://civicradarnh.github.io/civicradar
 *   [x] supabaseUrl        — Supabase project URL (enables cross-device sync)
 *   [x] supabaseAnonKey    — Supabase anon public key
 *   [x] legal.grievanceEmail — civicradarnh@gmail.com
 *   [x] founder.email      — civicradarnh@gmail.com
 *   [x] founder.operatorEmail — civicradarnh@gmail.com
 *   [x] turnstileSiteKey   — v120 Cloudflare Turnstile (secret → Supabase Auth → Captcha)
 *   [ ] Run supabase/schema.sql once in Supabase SQL Editor
 *   [ ] Enable Anonymous + Email OTP in Supabase Auth
 *   [ ] Paste Turnstile secret in Supabase Auth → Captcha
 *   [ ] Deploy to HTTPS (camera + GPS require it in production)
 *   [ ] Counsel review of privacy.html and terms.html
 *   See LAUNCH_CHECKLIST.md for full gate details.
 *
 * CUSTOMIZE THIS FILE before sharing with colleges, press, or partners.
 * Public-facing copy and contact emails live here — not buried in code.
 *
 * Backend (optional):
 *   1. Create a free project at https://supabase.com
 *   2. Project Settings → API → copy the "Project URL" and the "anon public" key
 *   3. Paste them below and reload the app
 *   4. Run the SQL in supabase/schema.sql once (SQL Editor → New query → Run)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ENVIRONMENT DETECTION (see RELEASE.md)
 * Backend/URL values resolve automatically by hostname so the same code runs
 * unchanged on local dev, the Cloudflare staging preview, and GitHub Pages prod:
 *   • dev      → localhost / 127.0.0.1            → local-only (no remote backend)
 *   • staging  → *.pages.dev / *civicradar-staging → staging Supabase (PLACEHOLDERS below)
 *   • prod     → civicradarnh.github.io           → production Supabase (real values)
 * SAFETY: any unknown host falls back to PROD values, so a misdetected host
 * can never silently break the live site. Fill the staging PLACEHOLDERS only
 * after you create the staging Supabase project (RELEASE.md → Setup checklist).
 * ─────────────────────────────────────────────────────────────────────────
 */
(function () {
  // Per-environment backend + public URL. Everything else (cities, legal,
  // founder, etc.) is shared across environments and lives in the object below.
  var ENVIRONMENTS = {
    // PRODUCTION — real values, do not change without a release. This is also
    // the safe fallback for any unrecognized host.
    prod: {
      supabaseUrl: 'https://shrjkexfokootrzrpjsi.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNocmprZXhmb2tvb3RyenJwanNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNTk1MTAsImV4cCI6MjA5NzYzNTUxMH0.EPdFoKveaLwl8DQ5HFRs8zYxfUXh8y1oDUQbrjhpgdA',
      publicUrl: 'https://civicradarnh.github.io/civicradar',
    },
    // STAGING — **[YOU]** PLACEHOLDERS. After creating a *separate* staging
    // Supabase project (never the prod ref), paste its Project URL + anon key
    // here and set publicUrl to your Cloudflare Pages staging domain.
    // See RELEASE.md → "Setup checklist to activate this process".
    staging: {
      supabaseUrl: 'https://YOUR-STAGING-PROJECT.supabase.co',     // **[YOU]** staging Supabase Project URL
      supabaseAnonKey: 'YOUR_STAGING_ANON_KEY',                    // **[YOU]** staging anon public key (safe in browser; RLS protects data)
      publicUrl: 'https://civicradar-staging.pages.dev',           // **[YOU]** Cloudflare Pages staging URL
    },
    // DEV (localhost) — pure local mode: empty backend so local testing never
    // reads or writes a shared database, and empty publicUrl so share links
    // fall back to the current origin. To exercise sync locally, temporarily
    // copy the `staging` values here.
    dev: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      publicUrl: '',
    },
  };

  function detectEnvironment(hostname) {
    var h = (hostname || '').toLowerCase();
    // Local development hosts.
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]' || h === '') {
      return 'dev';
    }
    // Production host (explicit) — keep ahead of generic checks.
    if (h === 'civicradarnh.github.io') {
      return 'prod';
    }
    // Staging: Cloudflare Pages previews (per-branch / per-PR) + named staging host.
    if (h.indexOf('.pages.dev') !== -1 || h.indexOf('civicradar-staging') !== -1) {
      return 'staging';
    }
    // SAFE DEFAULT: any unknown host (custom domain, mirror, etc.) → prod values.
    return 'prod';
  }

  var hostname = (typeof location !== 'undefined' && location && location.hostname) ? location.hostname : '';
  var environment = detectEnvironment(hostname);
  var resolved = ENVIRONMENTS[environment] || ENVIRONMENTS.prod;

  // Non-intrusive hint outside production only.
  if (environment !== 'prod' && typeof console !== 'undefined' && console.info) {
    console.info('CivicRadar env:', environment);
  }

  window.CIVICRADAR_CONFIG = {
  // Resolved environment name ('dev' | 'staging' | 'prod') — for analytics/debugging.
  environment: environment,
  // **[YOU]** Resolved per-environment (see ENVIRONMENTS above) — Supabase → Project Settings → API
  supabaseUrl: resolved.supabaseUrl,      // e.g. 'https://abcdefgh.supabase.co'
  supabaseAnonKey: resolved.supabaseAnonKey,  // e.g. 'eyJhbGciOi...' (anon public key — safe in browser; RLS protects data)
  // **[YOU]** Resolved per-environment — WhatsApp shares & ?report= deep links use this (not localhost)
  publicUrl: resolved.publicUrl, // e.g. 'https://civicradar.app' or 'https://youruser.github.io/civicradar'
  // Cloudflare Turnstile site key (public). Secret lives in Supabase Auth → Captcha only.
  turnstileSiteKey: '0x4AAAAAADvu8ppZ0_EjSdZd',
  // Seasonal hook override: 'auto' (default, date-driven May–Oct) | 'on'
  // (force the monsoon hook year-round, e.g. for a launch campaign) | 'off'
  // (fully evergreen — no seasonal banner ever, regardless of month).
  seasonalMode: 'auto',

  /* ----- Official BMC channels (optional overrides) ----- */
  /* ----- Multi-city support (Mumbai · Pune · Thane) ----- */
  cities: {
    mumbai: {
      id: 'mumbai',
      label: 'Mumbai',
      center: [19.076, 72.8777],
      bounds: { minLat: 18.88, maxLat: 19.28, minLng: 72.78, maxLng: 73.0 },
      detectRadiusKm: 8,
    },
    pune: {
      id: 'pune',
      label: 'Pune',
      center: [18.5204, 73.8567],
      bounds: { minLat: 18.44, maxLat: 18.58, minLng: 73.78, maxLng: 73.95 },
      detectRadiusKm: 6,
      corpChannels: {
        name: 'PMC',
        fullName: 'Pune Municipal Corporation',
        // PMC citizen services page — official .gov.in entry point for PMC CARE grievances
        grievanceUrl: 'https://www.pmc.gov.in/',
        whatsapp: '919689900002',
        helpline: '18001030222',
        helplineDisplay: '1800 1030 222',
        appName: 'PMC CARE',
        playStoreUrl: 'https://play.google.com/store/apps/details?id=in.gov.pmc.pmccare',
        appStoreUrl: 'https://apps.apple.com/in/app/pmc-care/id1330880892',
        playStoreSearchUrl: 'https://play.google.com/store/search?q=PMC+CARE&c=apps',
        aapleSarkarUrl: 'https://pgportal.gov.in/',
        aapleSarkarPlayStoreUrl: '',
      },
    },
    thane: {
      id: 'thane',
      label: 'Thane',
      center: [19.2183, 72.9781],
      bounds: { minLat: 19.15, maxLat: 19.28, minLng: 72.92, maxLng: 73.05 },
      detectRadiusKm: 6,
      corpChannels: {
        name: 'TMC',
        fullName: 'Thane Municipal Corporation',
        // TMC official website — online citizen services and complaint filing
        grievanceUrl: 'https://www.thanecity.gov.in/',
        // Maharashtra Aaple Sarkar — select TMC as local body when filing
        aapleSarkarUrl: 'https://pgportal.gov.in/',
        aapleSarkarPlayStoreUrl: '',
        helplines: ['02225331590', '02225331211'],
        helplineDisplay: '022-25331590 · 022-25331211',
        citizenCallCenter: '155300',
        email: 'mc@thanecity.gov.in',
        twitter: 'TMCaTweetAway',
        departments: [
          { key: 'water', phone: '02225363580', phoneDisplay: '022-25363580', email: 'ce@thanecity.gov.in' },
          { key: 'health', phone: '02225332685', phoneDisplay: '022-25332685', email: 'mho@thanecity.gov.in' },
          { key: 'pollution', phone: '02225362916', phoneDisplay: '022-25362916' },
        ],
      },
    },
  },
  serviceBounds: { minLat: 18.44, maxLat: 19.3, minLng: 72.78, maxLng: 73.95 },

  bmcChannels: {
    // Civic engagement portal — volunteering, CSR, project proposals (not complaint filing).
    participateMumbaiUrl: 'https://participatemumbai.mcgm.gov.in/',
    // MyBMC MARG — unified grievance app (114 categories incl. pest control / stagnant water).
    margAppStoreUrl: 'https://apps.apple.com/app/mybmc-marg/id6759655448',
    // Android: MARG may ship inside MyBMC or as a separate listing — override when BMC publishes a direct link.
    margPlayStoreUrl: 'https://play.google.com/store/apps/details?id=in.cdac.gov.mgov.mcgm',
    margPlayStoreSearchUrl: 'https://play.google.com/store/search?q=MyBMC+MARG&c=apps',
  },

  /* ----- Official grievance resources (verified links — no API partnerships) ----- */
  officialChannels: {
    swachhata: {
      id: 'swachhata',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.ichangemycity.swachhbharat',
      appStoreUrl: 'https://apps.apple.com/in/app/swachhata-mohua/id1124033628',
      infoUrl: 'https://www.swachh.city/',
      helpline: '1969',
    },
    aapleSarkar: {
      id: 'aaple_sarkar',
      portalUrl: 'https://pgportal.gov.in/',
      // Play Store listing removed Nov 2025 — portal is the verified source
      playStoreUrl: '',
    },
    // Per-city channel order (city corp primary, Swachhata + Aaple Sarkar as cross-cutting).
    cityOrder: {
      mumbai: ['marg', 'bmc_whatsapp', 'bmc_portal', 'swachhata', 'aaple_sarkar'],
      pune: ['pmc_care', 'pmc_wa', 'swachhata', 'aaple_sarkar'],
      thane: ['tmc_portal', 'tmc_call', 'swachhata', 'aaple_sarkar'],
    },
    hazardPrefer: {
      garbage: { swachhata: 20, marg: 8, pmc_care: 8, tmc_portal: 8 },
      'stagnant-water': { marg: 20, pmc_care: 20, tmc_portal: 20, bmc_whatsapp: 15, pmc_wa: 15, swachhata: 5 },
    },
  },

  /* ----- CivicRadar Android TWA (Play Store) — WhatsApp deep links open in app when verified ----- */
  store: {
    packageId: 'in.civicradar.app',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=in.civicradar.app',
    // **[YOU]** Set when iOS App Store listing exists (Smart App Banner + install CTA)
    appStoreUrl: '',
  },

  /* ----- Legal & store compliance ----- */
  legal: {
    privacyUrl: 'privacy.html',
    termsUrl: 'terms.html',
    deleteAccountUrl: 'delete-account.html',
    officialSourcesUrl: 'official-sources.html',
    // **[YOU]** DPDP grievance officer — e.g. 'privacy@yourdomain.com' (defaults to founder.operatorEmail if empty)
    grievanceEmail: 'civicradarnh@gmail.com',
  },

  /* ----- About modal & partner contact (edit these) ----- */
  founder: {
    name: '',  // leave empty — public UI shows "The CivicRadar team"
    role: '',
    school: '',
    location: '',
    // **[YOU]** Public support / partner contact — shown in About modal
    email: 'civicradarnh@gmail.com',                               // e.g. 'hello@yourdomain.com'
    operatorName: '',  // leave empty — no personal names in public UI
    // **[YOU]** Legal/hosting contact (privacy.html / terms.html fallback)
    operatorEmail: 'civicradarnh@gmail.com',
    operatorRelation: '',
    tagline: 'Community-powered ward hazard map — not an anonymous helpline router.',
    story: 'CivicRadar is a free community app for Mumbai, Pune, and Thane. Pin civic hazards on a live ward map, rally neighbours with Me too corroboration, and optionally file with BMC, PMC, or TMC when you choose. It is not a government product and not another helpline router.',
    highlights: [
      'Live ward map with photo pins — neighbours corroborate with Me too, not anonymous helpline drops',
      'Dual path: pin on CivicRadar first, then one-tap official filing (BMC 1916/MyBMC, PMC CARE, TMC)',
      'Four launch hazard types: stagnant water, garbage, potholes, broken streetlights',
      '4-language PWA with offline support — install to Home Screen, no login required',
      'Escalation timeline + complaint number tracking until spots are fixed',
      'NGO coordinator hub for pledges, volunteer hours, and community cleanup dispatch',
      'Civic Points gamification and community wins when hazards get cleaned',
    ],
  },

  /* ----- Monetization & local partners (future revenue) ----- */
  monetization: {
    // Ward-targeted offers shown in Community tab. Leave wards [] for city-wide.
    sponsors: [
      {
        business: 'Raju Hardware Mart',
        offer: '10% off mosquito nets and repellents this monsoon',
        wards: [],  // e.g. ['K/W Ward — Andheri West, Vile Parle West']
        url: '',    // optional: 'https://example.com/offer'
        active: false,  // demo placeholder — enable when a real partner is onboarded
      },
      {
        business: 'Clean Mumbai NGO',
        offer: 'Free volunteer cleanup kits for pledged wards',
        wards: [],
        url: '',
        active: false,  // demo placeholder — enable when a real partner is onboarded
      },
    ],
    // Revenue paths you can discuss in essays / pitch decks (informational only)
    revenueModel: [
      'Local business sponsorships — ward-relevant offers (mosquito nets, hardware, clinics)',
      'BMC / municipal dashboard licensing for multi-ward analytics',
      'NGO coordinator tools for volunteer verification at scale',
    ],
    // **[OPTIONAL]** defaults to founder.email if empty
    partnerInquiryEmail: '',  // e.g. 'partners@yourdomain.com'
    partnerNote: 'CivicRadar stays free for Mumbai, Pune, and Thane residents. Local partners help with hosting, moderation, and ward outreach — never paywalls on public safety.',
  },

  /* ----- Scale & free-tier limits (tune as you grow — see ARCHITECTURE.md) ----- */
  scale: {
    maxReportsPerDevice: 500,   // trim localStorage; always keep this user's reports
    syncBatchSize: 200,         // max rows pulled per Supabase query
    syncRecentDays: 90,         // sync recent city-wide reports + all of user's own
    imageMaxWidth: 320,         // resize uploads (was 400px) — saves DB/bandwidth
    jpegQuality: 0.52,          // JPEG re-encode quality (was 0.6)
    maxMapMarkers: 150,         // cap markers in viewport; pending hazards prioritized
    mapMarkerDebounceMs: 250,   // debounce marker refresh on pan/zoom
    geoThrottleMs: 15000,       // min interval between GPS refreshes (ms)
    fixConfirmThreshold: 2,     // neighbours saying "looks fixed" before community auto-resolve
    staleCheckDays: 7,          // prompt reporter to re-check old pending spots
  },

  /* ----- Society / neighbourhood suggestions (ward-keyed; see js/society-suggestions-data.js) ----- */
  cooperativeRegistryUrl: 'https://cooperatives.gov.in/en/state-dashboard/cooperative-list-reports/state/27',
  // Populated at runtime from CIVICRADAR_SOCIETY_BY_WARD (loaded before app.js).
  societySuggestionsByCityWard: null,

  /* ----- Demo NGO invite codes (local testing — production codes live in Supabase) ----- */
  demoNgoCodes: [
    {
      code: 'DEMO-WARD-GN',
      ward: 'G/N Ward — Dadar, Shivaji Park',
      ngoName: 'Dadar Cares (demo)',
      coordinatorScope: 'ward',
    },
    {
      code: 'DEMO-NBH-WORLI',
      ward: 'G/S Ward — Worli, Lower Parel',
      ngoName: 'Worli RWA (demo)',
      neighbourhood: 'Worli West — Phoenix Mills area',
      coordinatorScope: 'neighbourhood',
    },
    {
      code: 'DEMO-NBH-BANDRA',
      ward: 'H/W Ward — Bandra West, Khar West',
      ngoName: 'Bandra West Society Network (demo)',
      neighbourhood: 'Hill Road — St Andrews area',
      coordinatorScope: 'neighbourhood',
    },
  ],

  /* ----- Anonymous usage analytics (traffic, errors, performance) ----- */
  analytics: {
    enabled: true,
    batchSize: 10,
    flushIntervalMs: 30000,
    sampleRate: 1.0, // reduce in high traffic
    debug: false,
  },

  /* ----- Photo moderation (protect citizens & community) ----- */
  moderation: {
    enabled: true,
    maxUploadBytes: 8388608,       // 8 MB
    minWidth: 120,
    minHeight: 120,
    nsfwEnabled: true,             // lazy-loads NSFW model when online
    requireOnlineNsfw: false,      // true = block uploads when safety scan cannot run
    nsfwThresholds: { Porn: 0.55, Hentai: 0.55, Sexy: 0.88 },
  },
  };
})();
