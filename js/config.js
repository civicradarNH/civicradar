/*
 * CivicRadar runtime configuration.
 *
 * LAUNCH_CHECKLIST (founder must-do before end-user launch):
 *   [ ] publicUrl          — HTTPS deploy URL for WhatsApp shares & ?report= deep links
 *   [ ] supabaseUrl        — Supabase project URL (enables cross-device sync)
 *   [ ] supabaseAnonKey    — Supabase anon public key
 *   [ ] legal.grievanceEmail — DPDP grievance officer contact (privacy.html / terms.html)
 *   [ ] founder.email      — About modal + partner inquiries
 *   [ ] founder.operatorEmail — Legal/hosting contact until founder turns 18
 *   [ ] Run supabase/schema.sql once in Supabase SQL Editor
 *   [ ] Deploy to HTTPS (camera + GPS require it in production)
 *   [ ] Counsel review of privacy.html and terms.html
 *   See LAUNCH_CHECKLIST.md for full gate details.
 *
 * CUSTOMIZE THIS FILE before sharing with colleges, press, or partners.
 * Your daughter's name, school, and contact details live here — not buried in code.
 *
 * Backend (optional):
 *   1. Create a free project at https://supabase.com
 *   2. Project Settings → API → copy the "Project URL" and the "anon public" key
 *   3. Paste them below and reload the app
 *   4. Run the SQL in supabase/schema.sql once (SQL Editor → New query → Run)
 */
window.CIVICRADAR_CONFIG = {
  // **[YOU]** Supabase → Project Settings → API (see LAUNCH-WALKTHROUGH.md Phase A)
  supabaseUrl: 'https://shrjkexfokootrzrpjsi.supabase.co',      // e.g. 'https://abcdefgh.supabase.co'
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNocmprZXhmb2tvb3RyenJwanNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNTk1MTAsImV4cCI6MjA5NzYzNTUxMH0.EPdFoKveaLwl8DQ5HFRs8zYxfUXh8y1oDUQbrjhpgdA',  // e.g. 'eyJhbGciOi...' (anon public key — safe in browser; RLS protects data)
  // **[YOU]** REQUIRED before viral launch — WhatsApp shares & ?report= deep links use this (not localhost)
  publicUrl: 'https://nileshhadawale-oss.github.io/civicradar', // e.g. 'https://civicradar.app' or 'https://youruser.github.io/civicradar'

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
        // PMC CARE portal — log and track grievances online (official citizen-services link)
        grievanceUrl: 'https://pmccare.in/cep/home',
        whatsapp: '919689900002',
        helpline: '18001030222',
        helplineDisplay: '1800 1030 222',
        appName: 'PMC CARE',
        playStoreUrl: 'https://play.google.com/store/apps/details?id=in.gov.pmc.pmccare',
        appStoreUrl: 'https://apps.apple.com/in/app/pmc-care/id1330880892',
        playStoreSearchUrl: 'https://play.google.com/store/search?q=PMC+CARE&c=apps',
        aapleSarkarUrl: 'https://grievances.maharashtra.gov.in/en',
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
        // TMC citizen portal — login → Online citizen services → File a complaint
        grievanceUrl: 'https://thanecity.gov.in/',
        // Maharashtra Aaple Sarkar (IGRS) — select TMC as local body when filing
        aapleSarkarUrl: 'https://grievances.maharashtra.gov.in/en',
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

  /* ----- Legal & store compliance ----- */
  legal: {
    privacyUrl: 'privacy.html',
    termsUrl: 'terms.html',
    // **[YOU]** DPDP grievance officer — e.g. 'privacy@yourdomain.com' (defaults to founder.operatorEmail if empty)
    grievanceEmail: '',
    // Review with qualified Indian counsel before public launch.
  },

  /* ----- Founder & college-application story (edit these) ----- */
  founder: {
    name: 'Nihira Hadawale',
    role: 'Founder & Developer (age 17)',
    school: 'MCST — Junior, Class of 2027',
    location: 'New Jersey, USA',
    // **[YOU]** Nihira's public contact — shown in About modal + partner inquiries
    email: 'hadawalenihira@gmail.com',                               // e.g. 'nihira@yourdomain.com'
    operatorName: 'Nilesh Hadawale',         // [AGENT/DONE] pre-filled
    // **[YOU]** Nilesh's email — legal/hosting contact until founder turns 18
    operatorEmail: 'nilesh.hadawale@gmail.com',
    operatorRelation: 'Parent / legal operator until founder turns 18',
    tagline: 'Community hazard map for Mumbai, Pune & Thane monsoon — built from New Jersey with family on the ground.',
    story: 'CivicRadar was built by Nihira Hadawale, a high school student in New Jersey with family in Mumbai, to help neighbours see and report stagnant-water hazards each monsoon across Mumbai, Pune, and Thane. Every year I hear from relatives about dengue in their wards — from far away, I wanted to help in a way that lasts. CivicRadar is a free community app: ward map pins, Me too corroboration, and volunteer cleanup logging. Official corporation filing (BMC, PMC, or TMC) is an optional next step when you want the government clock — not a government product, just tools I wish my family\'s neighbourhoods had years ago.',
    highlights: [
      'Built for Mumbai, Pune, and Thane wards facing dengue from stagnant water each monsoon',
      'Community-first ward map with Me too corroboration and volunteer cleanup logging',
      'Optional corporation filing when you choose (BMC 1916/MyBMC, PMC CARE, TMC portal) — with complaint number tracking',
      '4-language UI (English, Hindi, Marathi, Gujarati) for inclusive access',
      'PWA with offline support — works on basic phones without an app store',
      'NGO coordinator hub for pledges, volunteer hours, and community cleanup dispatch',
      'Municipal queue for invited BMC officials — contact us to participate',
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
