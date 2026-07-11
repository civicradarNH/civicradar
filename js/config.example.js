/*
 * CivicRadar — EXAMPLE configuration (no real secrets).
 *
 * Copy to config.js and fill in the **[YOU]** fields before launch:
 *   copy js\config.example.js js\config.js
 *
 * Never commit real Supabase keys or personal emails to a public repo.
 * See LAUNCH-WALKTHROUGH.md for step-by-step setup.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ENVIRONMENT DETECTION (see RELEASE.md)
 * Backend/URL values resolve automatically by hostname so the same code runs
 * unchanged on local dev, the Cloudflare staging preview, and GitHub Pages prod:
 *   • dev      → localhost / 127.0.0.1            → local-only (no remote backend)
 *   • staging  → *.pages.dev / *civicradar-staging → staging Supabase
 *   • prod     → your production host             → production Supabase
 * SAFETY: any unknown host falls back to PROD values. All values below are
 * PLACEHOLDERS — fill them in your private config.js, never commit real keys.
 * ─────────────────────────────────────────────────────────────────────────
 */
(function () {
  // Per-environment backend + public URL (all placeholders in this example).
  var ENVIRONMENTS = {
    // PRODUCTION — also the safe fallback for any unrecognized host.
    prod: {
      supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.EXAMPLE_ANON_KEY_NOT_REAL',
      publicUrl: 'https://YOUR-GITHUB-USER.github.io/civicradar',
    },
    // STAGING — separate Supabase project + Cloudflare Pages domain.
    staging: {
      supabaseUrl: 'https://YOUR-STAGING-PROJECT.supabase.co',
      supabaseAnonKey: 'YOUR_STAGING_ANON_KEY',
      publicUrl: 'https://civicradar-staging.pages.dev',
    },
    // DEV (localhost) — pure local mode (no remote backend, origin-relative links).
    dev: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      publicUrl: '',
    },
  };

  function detectEnvironment(hostname) {
    var h = (hostname || '').toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]' || h === '') {
      return 'dev';
    }
    // **[YOU]** Replace with your production host (e.g. 'youruser.github.io').
    if (h === 'YOUR-GITHUB-USER.github.io') {
      return 'prod';
    }
    if (h.indexOf('.pages.dev') !== -1 || h.indexOf('civicradar-staging') !== -1) {
      return 'staging';
    }
    // SAFE DEFAULT: any unknown host → prod values.
    return 'prod';
  }

  var hostname = (typeof location !== 'undefined' && location && location.hostname) ? location.hostname : '';
  var environment = detectEnvironment(hostname);
  var resolved = ENVIRONMENTS[environment] || ENVIRONMENTS.prod;

  if (environment !== 'prod' && typeof console !== 'undefined' && console.info) {
    console.info('CivicRadar env:', environment);
  }

  window.CIVICRADAR_CONFIG = {
  // Resolved environment name ('dev' | 'staging' | 'prod').
  environment: environment,
  // **[YOU]** Resolved per-environment (see ENVIRONMENTS above) — Supabase → Project Settings → API
  supabaseUrl: resolved.supabaseUrl,
  supabaseAnonKey: resolved.supabaseAnonKey,

  // **[YOU]** Must match your deployed HTTPS URL exactly (trailing slash OK)
  publicUrl: resolved.publicUrl,
  // **[YOU]** Cloudflare Turnstile site key (public). Leave empty for local-only dev.
  turnstileSiteKey: '',

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
        grievanceUrl: 'https://www.pmc.gov.in/',
        whatsapp: '919689900002',
        helpline: '18001030222',
        helplineDisplay: '1800 1030 222',
        appName: 'PMC CARE',
        playStoreUrl: 'https://play.google.com/store/apps/details?id=in.gov.pmc.pmccare',
        appStoreUrl: 'https://apps.apple.com/in/app/pmc-care/id1330880892',
        playStoreSearchUrl: 'https://play.google.com/store/search?q=PMC+CARE&c=apps',
        aapleSarkarUrl: 'https://pgportal.gov.in/',
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
        grievanceUrl: 'https://www.thanecity.gov.in/',
        aapleSarkarUrl: 'https://pgportal.gov.in/',
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
    participateMumbaiUrl: 'https://participatemumbai.mcgm.gov.in/',
    margAppStoreUrl: 'https://apps.apple.com/app/mybmc-marg/id6759655448',
    margPlayStoreUrl: 'https://play.google.com/store/apps/details?id=in.cdac.gov.mgov.mcgm',
    margPlayStoreSearchUrl: 'https://play.google.com/store/search?q=MyBMC+MARG&c=apps',
  },

  store: {
    packageId: 'in.civicradar.app',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=in.civicradar.app',
    appStoreUrl: '',
  },

  legal: {
    privacyUrl: 'privacy.html',
    termsUrl: 'terms.html',
    deleteAccountUrl: 'delete-account.html',
    officialSourcesUrl: 'official-sources.html',
    // **[YOU]** DPDP grievance officer — shown on privacy.html and terms.html
    grievanceEmail: 'privacy@yourdomain.com',
  },

  founder: {
    name: '',  // leave empty — public UI shows "The CivicRadar team"
    role: '',
    school: '',
    location: '',
    // **[YOU]** Public support / partner contact
    email: 'hello@yourdomain.com',
    operatorName: '',  // leave empty — no personal names in public UI
    // **[YOU]** Legal/hosting contact (privacy.html / terms.html fallback)
    operatorEmail: 'privacy@yourdomain.com',
    operatorRelation: '',
    tagline: 'Community hazard map for Mumbai, Pune & Thane monsoon civic reporting.',
    story: 'CivicRadar helps neighbours in Mumbai, Pune, and Thane see and report stagnant-water hazards each monsoon. It is a free community app: ward map pins, Me too corroboration, and volunteer cleanup logging. Official corporation filing (BMC, PMC, or TMC) is an optional next step when you want the government clock — not a government product.',
    highlights: [
      'Built for Mumbai, Pune, and Thane wards facing dengue from stagnant water each monsoon',
      'Community-first ward map with Me too corroboration and volunteer cleanup logging',
      'Optional BMC filing when you choose (1916, MyBMC, Aaple Sarkar) — with complaint number tracking',
      '4-language UI (English, Hindi, Marathi, Gujarati) for inclusive access',
      'PWA with offline support — works on basic phones without an app store',
      'NGO coordinator hub for pledges, volunteer hours, and community cleanup dispatch',
      'Municipal queue for invited BMC officials — contact us to participate',
    ],
  },

  monetization: {
    sponsors: [
      {
        business: 'Raju Hardware Mart',
        offer: '10% off mosquito nets and repellents this monsoon',
        wards: [],
        url: '',
        active: false,
      },
      {
        business: 'Clean Mumbai NGO',
        offer: 'Free volunteer cleanup kits for pledged wards',
        wards: [],
        url: '',
        active: false,
      },
    ],
    revenueModel: [
      'Local business sponsorships — ward-relevant offers (mosquito nets, hardware, clinics)',
      'BMC / municipal dashboard licensing for multi-ward analytics',
      'NGO coordinator tools for volunteer verification at scale',
    ],
    // **[OPTIONAL]** defaults to founder.email if empty
    partnerInquiryEmail: 'partners@yourdomain.com',
    partnerNote: 'CivicRadar stays free for Mumbai residents. Local partners help with hosting, moderation, and ward outreach — never paywalls on public safety.',
  },

  demoNgoCodes: [
    {
      code: 'DEMO-WARD-GN',
      ward: 'G/N Ward — Dadar, Shivaji Park',
      ngoName: 'Dadar Cares (demo)',
      coordinatorScope: 'ward',
    },
  ],

  analytics: {
    enabled: true,
    batchSize: 10,
    flushIntervalMs: 30000,
    sampleRate: 1.0,
    debug: false,
  },

  moderation: {
    enabled: true,
    maxUploadBytes: 8388608,
    minWidth: 120,
    minHeight: 120,
    nsfwEnabled: true,
    requireOnlineNsfw: false,
    nsfwThresholds: { Porn: 0.55, Hentai: 0.55, Sexy: 0.88 },
  },
  };
})();
