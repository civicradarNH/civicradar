# Changelog

All notable changes to CivicRadar are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release process and environment details live in [`RELEASE.md`](./RELEASE.md).

## [Unreleased]

### Added
- **Community after-photo on resolve (v145)** — when a report is community-verified fixed, neighbours who confirmed see a toast with **Add photo** → camera → `set_resolution_image` RPC; reporters get the same optional prompt after the share-win modal; success opens share-win with before/after. Community-specific i18n en/hi/mr/gu (`fix.thanksAddPhoto`, `fix.addAfterPhoto`, `toast.fixPhotoAdded`). Cache v145.
- **WhatsApp deep links + TWA App Links (v141)** — share URLs stay canonical HTTPS (`publicUrl/?report={id}`) for Android App Link interception; `.well-known/assetlinks.json` for `in.civicradar.app`; mobile-browser landing strip with **Open in app** (Android intent + Play Store fallback) and **Get the app** when `?report=` or `?ref=`; absolute OG/Twitter image URLs for WhatsApp previews; certificate share link uses `publicUrl`; E2E DL01 + ST01. Cache v141. **Founder:** paste Play Console app-signing SHA-256 into `assetlinks.json` and verify Digital Asset Links in Play Console (see `LAUNCH_CHECKLIST.md`).

### Changed
- **PWA launch splash (v140)** — branded indigo splash with icon + cyan radar ring (inline critical CSS for instant first paint); `manifest.json` `background_color` aligned to `#6366f1`; Google Fonts non-blocking; Leaflet/Phosphor/Supabase moved to body end so splash paints before heavy scripts; loader dismissed as soon as the Leaflet map shell is ready (not after backend/async work); SW precache reordered shell-first. Cache v140.

### Fixed
- **PWA session resume (v139)** — industry-standard installed-app lifecycle: **cold start** (process killed / tab discarded / fresh session marker) and **BFCache restore** reset to map home without `location.reload()`; **warm resume** (&lt;2 min hidden) preserves mid-report state; **stale** (≥30 min hidden) resets navigation; report camera flow still guarded. `manifest.json` intentionally omits `launch_handler` to avoid forced reload — JS reset handles home. Cache v139.
- **PWA session resume (v138)** — reopening the installed app after backgrounding no longer leaves Community/Profile (or other stacked modals) open from the last visit; standalone/TWA resets to map home after 5+ minutes hidden or on BFCache restore (`pageshow` persisted), while preserving in-flight report camera return. Cache v138.

### Security
- **P0 audit fixes (v126)** — Referral redemptions via `record_referral_redemption` RPC (binds `auth.uid()`, one row per user); `delete_user_data` removes `report-photos` Storage objects; Turnstile fail-closed when site key configured (no anonymous sign-in without captcha); demo BMC/NGO credentials disabled on `environment === 'prod'`; storage insert policy restricts `.jpg` + JPEG MIME only. **FOUNDER MUST RE-RUN** `supabase/schema.sql` and `supabase/storage-migration.sql` once. Cache v126.

### Added
- **Play Store government-source compliance (v130)** — new `official-sources.html` legal page with verified BMC/PMC/TMC and Maharashtra/national .gov links; wired into About modal, Community/Profile official channel blocks, privacy/terms; visible source URLs under each in-app official channel button; `legal.officialSourcesUrl` in `config.js`; precached and deployed. E2E LG07. Cache v130.
- **Photo-first report flow (v129)** — 2-screen wizard: Capture (camera opens immediately from FAB) → Confirm (photo hero, 2×2 hazard chips with contextual default, ward chip, collapsed "+ Add note", glass sticky footer with Submit + Retake). `getContextualDefaultHazard()` (last hazard, monsoon → stagnant-water, after 6:30pm → streetlight, else potholes). Submit button success morph + pin-drop map animation. E2E RP22, RP11/RP03/U20 updated. Cache v129.
- **Play Store compliance (v128)** — `delete-account.html` legal page (in-app deletion steps, email fallback via `config.js`, links to privacy/terms); precached in `sw.js` and deployed via GitHub Pages workflow. Client-side **mute reporter** — hide all pins from a reporter on your device (`civicradar_muted_reporters` in localStorage); popup action, map/leaderboard filtering, Profile → Hidden reporters unmute list; i18n en/hi/mr/gu. Privacy policy polish (Civic Hero XP, explicit CDN list, public photo URL clarification, deletion page link). E2E LG05, MR01. Cache v128.
- **Share win modal (v101)** — When a report is marked resolved (reporter via `checkResolvedWins`, self-resolve, community verify, volunteer cleanup), the Share Win modal shows a live canvas preview with side-by-side before/after photos, green "Fixed" placeholder when no after photo, and footer "I helped clean up {location} using CivicRadar!" using society/ward area. Square 1080×1080 or Story 1080×1920 (9:16) toggle for WhatsApp status; download, native share, WhatsApp, and Instagram caption unchanged. Resolved neighbourhood FYI toasts add a secondary **Share win** action. Localized en/hi/mr/gu. E2E WIN01–WIN04. Cache v101.
- **Civic Hero XP & certificates (v101)** — Civic Points rebranded to Civic Hero XP with 6-level ladder (Local Observer → Community Leader); XP for report (+50), Me too (+8), first share (+10), streak week (+25), resolved reporter (+20); Profile XP bar + level badge; shareable canvas certificates at Ward Watcher, Civic Champion, Monsoon Guardian, Community Leader; localized en/hi/mr/gu; Supabase `profiles.civic_xp` + `civic_level`; E2E XP01–XP03.

### Changed
- **Success modal official filing (v136)** — merged redundant “Want to go further?”, “File with BMC (optional)” button, and “Also file officially” accordion into one collapsed **Official filing (optional)** section; guided BMC filing + gov-app links live inside; **Back to map** separated with footer spacing. Localized en/hi/mr/gu. Cache v136.
- **UX audit pass (v137)** — removed duplicate megaphone “File with BMC” inside success accordion (gov-app channel buttons + **Filing guide & complaint copy** link instead); filing status clock moved inside accordion; Community subtitle drops official-filing mention (Resources owns that path); recenter hidden until GPS fix and decoupled from permission flow; report confirm + success footer spacing; location pill **Turn on location** (en). Localized en/hi/mr/gu. Cache v137.
- **Profile & Community modal hierarchy (v133)** — Community keeps the four impact stats sticky at the top; ward week details, leaderboard, get involved, and resources are collapsible accordions (collapsed by default). Profile groups into Your details (open), Activity, Notifications & privacy, and Account & support (collapsed). Reuses `cr-section` accordion pattern. Localized en/hi/mr/gu. Cache v133.

### Fixed
- **Deploy gate E2E (v137)** — smoke/full suite C17 + CL03 now assert `#btnSuccessOfficialToggle` (v136/v137 removed standalone `#btnSuccessFile`); SW06 cache string → `civicradar-v137`. Run #79 E2E passed; Pages deploy failed with transient GitHub error — workflow retries deploy once.
- **Profile location editing discoverability (v135)** — city, ward, and neighbourhood fields were already editable (save logic since v100) but sat inside the v133 "Your details" accordion below the tall stats card; moved them into an always-visible **City, ward & neighbourhood** block directly under the profile card, reset Profile accordion state each time the tab opens, and localized en/hi/mr/gu. Cache v135.
- **E2E smoke CI (v134)** — deploy-gate geolocation mock now stubs `watchPosition` + `clearWatch` for `getPrecisePosition()` (v134 onboarding/submit path); fixes C05/C16/RP07 timeouts on GitHub Actions.
- **Geolocation accuracy (v134)** — shared `getPrecisePosition()` uses `watchPosition` with `enableHighAccuracy`, `maximumAge: 0`, and accuracy threshold (≤50 m) before settling; "Locate me" bypasses 15 s throttle for a fresh fix; map shows accuracy circle and zoom scales to precision; poor-fix toasts (en/hi/mr/gu); report submit uses same path. Cache v134.
- **Modal/nav flow (v133)** — tab switches and hardware back now dismiss stacked overlays (report with photo, pledge/volunteer/deleteConfirm on community/profile); `closeAllModals` no longer skips report when a photo preview is showing; Escape closes the topmost open modal. E2E U25–U27. Cache v133.
- **Report flow hints (v132)** — photo-first copy: capture step encourages snapping a photo (not "add photo after hazard"); confirm-step hazard cue and photo hint guide Submit/Retake instead of asking for a photo. Localized en/hi/mr/gu. Cache v132.
- **Delete data confirmation (v131)** — replaced native browser `confirm()` (showed "civicradarnh.github.io says") with an in-app modal: clear title, bullet list of what is removed, "Keep my data" / "Yes, delete everything" actions; localized en/hi/mr/gu. E2E P11 updated. Cache v131.
- **Civic Hero certificate modal (v101 QA)** — level-up certificate now closes the success modal before opening so controls are not blocked; E2E XP03 uses cert dismiss; RP09 seeds nearby report after XP block clears storage.
- **E2E load test L01 (v101 QA)** — staggered parallel browser contexts with retries so 15/15 contexts load reliably on Windows.
- **Ward & neighbourhood re-selection (v100)** — Profile city + ward are editable anytime (datalist picker with validation); changing ward refreshes society/neighbourhood suggestions and i18n hints; GPS-detected onboarding ward shows an editable input immediately; reopening onboarding pre-fills saved ward instead of clearing it; datalist fields select-all on focus so users can pick a different suggestion. Empty display name auto-generates a unique civic/monsoon-themed default (e.g. "Ward Scout #A3F2"); editable in Profile. E2E SO09–SO10, C09c. Cache v100.
- **Encoding fix (v99)** — eliminated remaining `ï¿½` mojibake across app.js (ward separators, split/join, user-facing strings); restored apostrophes mangled by v98 em-dash over-replacement (`You—re` → `You're`, etc.); cache v99.
- **i18n polish (v98)** — fixed remaining English `?` arrow placeholders (share, esc, official hints, toast); translated hi/mr/gu official garbage/waste hints and report photo cue keys; restored missing `community.subtitle` keys (fixes PMC/TMC subtitle in Community modal). Cache v98.
- **First-run UX (v98)** — hide map-recenter while hero card is visible (dismiss no longer blocked); hero dismiss always chains to guided tour; location-banner E2E uses post-first-report state.
- **i18n audit (v94)** — restored corrupted hi/mr/gu strings (legacy `?` placeholders and mojibake); fixed English em-dash/middle-dot encoding; added translations for peer-vote lead keys, analytics tracking dashboard, v93 hero/coach/tour polish, and society hints. Cache v94.
- **Report flow & UX (v95)** — hazard picker redesign (checkmark, delegation, keyboard, photo cue); unified step-tab colors; photo return race fix; first-run overlay streamlining; garbage tile fix; "Map it · Snap it · Report it" tagline across hero/coach/tour/onboarding/about. Cache v95.

### Added
- **Neighbourhood report alerts (v97)** — Profile "Neighbourhood updates" with separate toggles for new reports and resolved FYI; matching by city+ward+society (normalized), ward-only fallback when report has no society; default ON when profile society is set; shared rate limit (max 3/24h, 5 min gap); resolved digest batches per hour; Web Notification + in-app toast fallback; Supabase profile prefs + realtime sync; local queue for offline E2E. Localized en/hi/mr/gu. E2E NA01–NA06. Cache v97. FOUNDER MUST RE-RUN `supabase/schema.sql` once.
- **Neighbourhood datalist autopopulate (v96)** — volunteer signup and lead-nomination neighbourhood fields now use the same ward+city-filtered datalist as society/profile (`js/society-suggestions-data.js` via `#societySuggestions`); dynamic hints ("Showing {n} neighbourhoods in {ward}"); free-text override; custom entries cached in `civicradar_custom_societies`. Onboarding/profile society fields unchanged (already ward-filtered). Localized en/hi/mr/gu. E2E NB01–NB04. Cache v96.
- **Analytics & tracking dashboard (v93)** — role-gated dashboard for BMC admin, super-admin, and NGO coordinators: visits/sessions, PWA installs (best-effort), reports by hazard category, official channel opens, neighbourhood/society breakdown, resolved counts, active reporters, Me too, and lead counts. Server aggregates via new `get_tracking_dashboard` RPC; local fallback for demo/offline. Period filter (7/30/90 days) and ward filter for admins. Instrumentation: `pwa_installed`, `pwa_standalone_session`. Cache v93. FOUNDER MUST RE-RUN `supabase/schema.sql` once.
- **Peer voting for community leads (v91/v92)** — NGO ward lead and neighbourhood lead roles are now granted democratically via neighbour supports instead of admin approval. Nominate yourself (Profile, Partner, Community, About), neighbours tap Support in Community; **2 supports** auto-grants the role; **5 supports each** when multiple active candidates share the same scope (co-leads allowed). BMC officials still use the admin-reviewed claim-code flow. New Supabase tables `lead_nominations` + `lead_votes` with RLS and RPCs `nominate_for_lead`, `vote_for_lead`, `list_lead_nominations`. Works in local/no-Supabase mode. Localized en/hi/mr/gu. Cache v92. E2E LV01–LV08; Access suite updated for BMC-only (AR01–AR12).

### Changed
- **Active monsoon messaging (v90)** — seasonal copy shifted from pre-monsoon prep ("coming", "before first rain", "Monsoon-ready") to active monsoon urgency across en/hi/mr/gu: community season hook, persona bar, hero, coach mark, map empty CTA, PWA nudge, onboarding subtitle. `getSeasonalHook()` now shows peak messaging Jun–Aug (June was incorrectly on prep key). Cache v90.

### Added
- **Ward-filtered society lists + onboarding trim (v89)** — comprehensive ward-keyed society/neighbourhood
  suggestions for Mumbai (24 wards), Pune (41), and Thane (66) in `js/society-suggestions-data.js`;
  datalist filters by city+ward on onboarding and Profile; custom entries cached in
  `civicradar_custom_societies`; free-text always allowed. Removed redundant onboarding
  how-it-works explainer (hero + app tour cover it); single-line subtitle kept. Cache v89.
  E2E SO05–SO08, OB10–OB13 updated.
- **Rewards & delight polish (v88)** — richer success moment: scaled confetti by report count,
  count-up Civic Points animation (reduced-motion safe), week streak callout, inline milestone
  badge unlock in success modal. Profile rewards dashboard with progress bar, streak weeks, next
  badge hint, subtle points glow. Map pin-drop pulse after submit; empty-map encourage line.
  Me Too awards +5 Civic Points with warmer toast. Playful Hinglish-friendly kudos in en/hi/mr/gu.
  Cache v88. E2E RW01–RW02, X30–X31.
- **Launch polish (v93)** — tighter copy en/hi/mr/gu; hero skips duplicate coach; tour 3 steps; photo inline hint (no checkbox tap); success modal streamlined + collapsible official channels; hero/modal/empty-map CSS refresh. Cache v93.
- **Launch polish (v87)** — tighter copy across en/hi/mr/gu (hero, coach, onboarding, success, tour, About, reminders, official channels); hero skips duplicate coach overlay; tour 4→3 steps (Me too merged into map); photo confirm checkbox replaced with inline hint + Retake (one fewer tap); success modal drops redundant next-steps list, collapsible official channels, primary "Back to map" CTA; visual refresh for hero card, modals, map empty state, tour Skip. Cache v87. E2E IS01–IS05, DF01 (3 bullets), C09b/OB13 updated.
- **Society / neighbourhood layer (MVP, v86)** — optional society/neighbourhood on onboarding
  (after ward) and Profile: searchable text + datalist from config suggestions + free-text
  fallback. Stored on user profile (`society`) and attached to new reports; shown on map
  popup when set. Profile link-out to National Cooperative Database (Maharashtra state list).
  Schema: additive `society` on `profiles` and `reports`. Localized en/hi/mr/gu. E2E SO01–SO04.
- **i18n audit complete (v86)** — `rerenderDynamicViews()` re-localizes open modals in place
  (success, community, profile, about, tour); `refreshSuccessModalStrings()` for success modal;
  map "You are here" localized. E2E I06–I08 (child screens in mr/hi).
- **Official grievance channel integration (Tier 1–3)** — city-aware panels linking to
  verified government resources without API partnerships: **MyBMC MARG**, **PMC CARE**,
  **Swachhata-MoHUA**, and **Aaple Sarkar** (plus existing BMC 1916/WhatsApp/portal and
  TMC helpline). Surfaces: report success modal (“Also file officially”), Community and
  Profile “Official grievance channels”, escalation extras (Swachhata + category hints), and
  escalation-ladder quick links. Smart routing by city + hazard (garbage → Swachhata;
  stagnant water → corp pest-control/drainage hints). One-tap open copies a structured
  summary (ward, hazard, CivicRadar report ID, category hint, photo guidance) to clipboard.
  Complaint-number save (Tier 3) unchanged. Analytics: `official_channel_open`. Config in
  `js/config.js` → `officialChannels`. Localized en/hi/mr/gu. Cache bumped to v84
  (E2E OC01–OC05).
- **Launch differentiation vs helpline routers (Majha Ward positioning)** — hero, empty-map CTA,
  and About modal now lead with community ward map + Me too corroboration + optional official filing,
  not "anonymous complaint to helpline." New **"What makes CivicRadar different"** section (4 bullets)
  in About, localized en/hi/mr/gu (`about.different*`). Hero reframed as "Community ward map" with
  trust strip "Add to Home Screen · 4 languages." Cache bumped to v84 (E2E DF01–DF02, RP16–RP18).
- **Four hazard types live at launch** — garbage/solid waste, potholes, and broken streetlights join
  stagnant water. All tiles selectable (no "Coming soon" locks). Share templates, copy1916 categories,
  map markers, and report flow handle all four. E2E RP01/RP02 updated for multi-hazard launch.
- **Dismissible location banner with a compact "Locate me" affordance** — the
  "Turn on location" map banner now has an accessible **×** dismiss control. Closing
  it **snoozes** the banner for 7 days (`civicradar_locbanner_snooze`) and collapses
  it into a small, unobtrusive **"Locate me"** pill on the map. While snoozed the
  full banner no longer reappears on every map load; the pill lets users re-enable
  location in one tap (which bypasses the snooze and re-runs the enable-location
  flow). Granting location, or any explicit tap, clears the snooze and hides both
  the banner and the pill. All banner copy is now localized via `t()`
  (`location.banner` / `location.bannerNearby` / `location.unavailable` /
  `location.withdrawn` / `location.dismiss` / `location.locate` /
  `location.locateAria`) in en/hi/mr/gu — replacing the previously hardcoded English
  strings. The snooze key is cleared on "delete my data". Keyboard operable,
  `focus-visible` rings, role/aria preserved, and motion respects
  `prefers-reduced-motion`. Cache bumped to v81 (E2E LB01–LB06).
- **First-run interactive guided tour** — after the onboarding explainer/coach tip,
  brand-new citizens get a short, skippable coach-mark spotlight tour that teaches
  the key navigation by highlighting the real UI: **Map = your ward** → **Report**
  (the camera FAB) → **Me too** (explained generically so it never points at a
  missing pin) → **Profile / Civic Points** (bottom-nav). It is sequenced right
  after the existing v79 `coachSpotTip` so users never see two stacked first-run
  pop-ups. The spotlight and tooltip are positioned from live bounding rects (mobile
  viewport safe), every step has visible **Skip** + **Next/Got it** controls, and
  **Esc**/backdrop tap dismiss it. Fully keyboard operable (Tab is trapped, Enter
  advances), focus is managed (and restored on exit), `aria` dialog semantics, and
  it respects `prefers-reduced-motion`. Shown **once** (`civicradar_tour_seen`) and
  never auto-shown for demo (`?demo=`), referral (`?ref=`), or returning users. A
  **"Replay app tour"** entry in Profile restarts it on demand. All copy localized
  in en/hi/mr/gu (`tour.*`). Cache bumped to v80.
- **Clearer onboarding — "what / why / how"** — the first-run onboarding modal now
  carries a compact explainer above the city/ward fields: a one-line *why*
  ("Stagnant water breeds dengue & malaria. Your report puts the spot on your ward
  map and into the BMC queue — and alerts neighbours."), a numbered 3-step *how it
  works* (Spot → Pin & snap on the spot → Submit & earn Civic Points), and a short
  "best reported on the spot" note. The first-run coach mark adds an explicit
  report-on-the-spot guidance line ("No need to report right now. When you pass
  stagnant water… open CivicRadar and pin it on the spot so the location is
  accurate."). All copy localized in en/hi/mr/gu; respects reduced-motion.
- **Opt-in "report stagnant water nearby" reminders** — a new Profile toggle
  ("Remind me to report stagnant water nearby") lets users opt into a gentle
  monsoon-season nudge. Enabling it requests notification permission; when granted,
  a foreground-triggered reminder (on load / tab focus, on a ~2-day cadence with
  snooze) is delivered via the service-worker registration or a page `Notification`.
  **Honest about platform limits:** there is *no* background push or geofencing —
  reminders fire only while the app is open. On iOS, unsupported browsers, or when
  permission is denied, it degrades gracefully to the existing in-app reminder card
  and never errors (feature-detected). Stored under
  `civicradar_report_reminder_optin`; easy to turn off.
- **Location-aware in-app nudge** — when the app is open and GPS is already granted,
  CivicRadar reuses the current position (never re-prompting, never persisting
  coordinates) to check proximity to known *pending* hazards via the existing
  haversine helper. Within ~150 m of a pending spot it surfaces the existing
  staleCheck reminder ("Spot near {ward} — still stagnant?") with "Still there" /
  "Add a photo" actions, routed through the same reminder queue so it respects
  `MAX_SESSION_REMINDERS`, snooze keys, and priority ordering. Foreground only.
  All new copy localized in en/hi/mr/gu. Cache bumped to v79.
- **Warmer post-report success experience** — every successful report now shows
  an encouraging line in the success modal, not just on milestone reports.
  Non-milestone reports rotate through a small set of warm "kudos" messages
  (deterministic by report count) so the praise never feels repetitive, while the
  special first-report and milestone messages still take priority. A new compact
  progress-to-next-badge nudge (`#successProgress`) tells the user how close they
  are to their next milestone (e.g. "Just 1 more report to your next badge"),
  switches to a celebratory "Badge unlocked!" variant right after a milestone, and
  becomes a sustained "{n} reports and counting — a true Monsoon Guardian" line
  once they pass the top milestone. All new copy localized in en/hi/mr/gu; points
  animation, confetti, badge toasts, and the share block are unchanged. Cache
  bumped to v78.
- **Coordinator access requests + approval workflow** — BMC officials and
  NGO/community coordinators can now request elevated access in-app (entry points
  in Profile, the partner portal, and the About modal). A low-friction request
  form (name, role, ward/city, one contact required; organization, proof photo,
  and note optional) submits even without logging in. The CivicRadar team reviews
  requests in an admin-only "Access requests" screen (reachable from the BMC
  queue) and approves/rejects with one tap; approving issues a one-time **claim
  code** the applicant enters to unlock their role. New `access_requests` table
  with RLS (anon/auth may INSERT a pending request only; admin-only read/update),
  an `admin` super-admin role on `profiles`, and `request_access` /
  `approve_access_request` / `reject_access_request` / `claim_access` RPCs. Works
  fully in local/no-Supabase mode (on-device queue). All UI strings localized in
  en/hi/mr/gu. **Requires re-running `supabase/schema.sql` and bootstrapping one
  super-admin.**
- Multi-city support for **Mumbai, Pune, and Thane** — per-city map centers,
  bounds, ward detection, and corporation channels (BMC / PMC CARE / TMC).
- Environment-aware configuration in `js/config.js` (and `js/config.example.js`):
  hostname-based `dev` / `staging` / `prod` detection that resolves
  `supabaseUrl`, `supabaseAnonKey`, and `publicUrl` per environment, with a safe
  fallback to production for unknown hosts.
- Release scaffolding: `RELEASE.md` runbook, PR-triggered E2E gate workflow
  (`.github/workflows/pr-checks.yml`), and an optional secret-guarded Cloudflare
  Pages preview workflow (`.github/workflows/preview-cloudflare.yml`).
- Admin proof-photo scan when resolving reports (resolution requires a proof
  photo).
- Soft photo-relevance confirmation prompt on report submission.
- Image-safety test scenarios in the E2E suite.

### Changed
- Anonymized founder identity across the public UI — no personal names shown
  ("The CivicRadar team"); contact via project email only.
- Migrated to a name-free public URL on the **civicradarNH** GitHub org
  (`https://civicradarnh.github.io/civicradar`).
- PWA icons moved from vector to raster for broader install/launch compatibility.
- Navigation Phase 1 improvements.
- E2E coverage expanded from **234 to 243** passing checks.

### Fixed
- Referral welcome banner behavior (shows on `?ref=`, hides after dismiss, stays
  hidden in demo tour).
- Single-language WhatsApp share — shared messages no longer duplicate content
  across multiple languages.
- Accessibility fixes.
- Offline / service-worker reliability fixes.
- Coordinator access copy no longer promises email when the applicant only
  provides a phone number; claim-code copy toast no longer references the team
  inbox instead of the applicant.
- BMC OTP fallback now accepts `admin` super-admin profiles (was signing them out).
- Magic-link callback hash errors routed through `formatAuthError` (no raw `{}`).
- Bottom-nav ghost taps ignored while the native camera / file picker is active.
- Twitter share no longer duplicates hashtag lines already in the template.

## [v142] - 2026-07-05

### Changed
- **Information architecture consolidation (v142)** — keep 3-tab nav (Map | Community | Profile); official grievance channels live only in Community → Resources (Profile links there); volunteer empty-state signup routes via Community; persona bar copy updated. Cache v142.

## [v143] - 2026-07-05

### Changed
- **4-tab navigation (v143)** — Map | Community | Resources | Profile. Official grievance channels, volunteer/pledge entry points, and sponsored offers move to a dedicated Resources tab (pre–Play Store launch). Community focuses on ward stats, leaderboard, and social action. Profile links to Resources tab. Localized en/hi/mr/gu. Cache v143.

## [v144] - 2026-07-05

### Fixed
- **Toast de-duplication (v144)** — `showToast()` skips stacking an identical non-interactive toast (same type + message) when one is already visible; interactive toasts with action buttons are unchanged. Cache v144.

[v142]: https://github.com/civicradarnh/civicradar/compare/v141...v142
[v143]: https://github.com/civicradarnh/civicradar/compare/v142...v143
[v144]: https://github.com/civicradarnh/civicradar/compare/v143...v144
[Unreleased]: https://github.com/civicradarnh/civicradar/compare/v144...HEAD
