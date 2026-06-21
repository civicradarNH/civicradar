/*
 * CivicRadar — EXAMPLE configuration (no real secrets).
 *
 * Copy to config.js and fill in the **[YOU]** fields before launch:
 *   copy js\config.example.js js\config.js
 *
 * Never commit real Supabase keys or personal emails to a public repo.
 * See LAUNCH-WALKTHROUGH.md for step-by-step setup.
 */
window.CIVICRADAR_CONFIG = {
  // **[YOU]** Supabase → Project Settings → API
  supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.EXAMPLE_ANON_KEY_NOT_REAL',

  // **[YOU]** Must match your deployed HTTPS URL exactly (trailing slash OK)
  publicUrl: 'https://YOUR-GITHUB-USER.github.io/civicradar',

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
        grievanceUrl: 'https://thanecity.gov.in/',
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
    participateMumbaiUrl: 'https://participatemumbai.mcgm.gov.in/',
    margAppStoreUrl: 'https://apps.apple.com/app/mybmc-marg/id6759655448',
    margPlayStoreUrl: 'https://play.google.com/store/apps/details?id=in.cdac.gov.mgov.mcgm',
    margPlayStoreSearchUrl: 'https://play.google.com/store/search?q=MyBMC+MARG&c=apps',
  },

  legal: {
    privacyUrl: 'privacy.html',
    termsUrl: 'terms.html',
    // **[YOU]** DPDP grievance officer — shown on privacy.html and terms.html
    grievanceEmail: 'privacy@yourdomain.com',
  },

  founder: {
    name: 'Nihira Hadawale',
    role: 'Founder & Developer (age 17)',
    school: 'MCST — Junior, Class of 2027',
    location: 'New Jersey, USA',
    // **[YOU]** Public support / partner contact
    email: 'nihira@yourdomain.com',
    operatorName: 'Nilesh Hadawale',
    // **[YOU]** Parent / legal operator contact (until founder turns 18)
    operatorEmail: 'nilesh@yourdomain.com',
    operatorRelation: 'Parent / legal operator until founder turns 18',
    tagline: 'Community hazard map for Mumbai monsoon — built from New Jersey with family on the ground.',
    story: 'CivicRadar was built by Nihira Hadawale, a high school student in New Jersey with family in Mumbai, to help neighbours see and report stagnant-water hazards each monsoon. Every year I hear from relatives about dengue in their wards — from far away, I wanted to help in a way that lasts. CivicRadar is a free community app: ward map pins, Me too corroboration, and volunteer cleanup logging. Official BMC filing is an optional next step when you want the government clock — not a BMC product, just tools I wish my family\'s neighbourhoods had years ago.',
    highlights: [
      'Built for Mumbai wards where family and community face dengue from stagnant water each monsoon',
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
