# CivicRadar Test Results

**Run:** 2026-07-22 22:40:09
**Server:** http://localhost:8095/
**Script:** `tests/e2e_comprehensive.py`
**Total:** 237 | **Pass:** 228 | **Fail:** 9

## Fixes applied this run

- `assets/*` + `tools/gen_icons.py`: regenerated the "Pin + Ripple" PNG app-icon set from the REAL approved artwork (`assets/icon-source-pin-ripple.png`). gen_icons.py now crops the source card, removes the white page background (flood-fill) for clean full-bleed transparent corners, and composites the maskable on sampled indigo; icon filenames unchanged so manifest/index/SW references stay valid
- `supabase/schema.sql`: added an additive, re-runnable `feedback` table (message/category/contact/app_version/env/device/ward/city/user_id) with RLS mirroring analytics — anon/auth INSERT allowed, no public SELECT (service-role/dashboard reads only). FOUNDER MUST RE-RUN schema.sql once
- `index.html` + `js/app.js` + `css/styles.css`: in-app feedback form (Supabase-backed, offline-safe). Entry points in Profile + About; accessible modal (focus trap, aria-live error, 44px targets, native-radio segmented control); inserts to Supabase when connected, else stores locally and flushes on reconnect (never loses text); all strings localized in en/hi/mr/gu
- `css/styles.css`: launch visual polish (v69) — extended design tokens (cyan accent, elevation/radii scale, brand gradients), confident button states with springy tap feedback, refined modal/toast/card depth, premium map chrome, segmented control + inline form-error + brand input focus rings + skeleton-loader utility — all motion gated by prefers-reduced-motion
- `js/config.js`: consolidated all contact/legal emails onto a single role inbox `civicradarnh@gmail.com` (legal.grievanceEmail, founder.email, founder.operatorEmail) — removed all personal Gmail addresses from deployable/source files (privacy.html / terms.html links are config-driven and now resolve to the role inbox)
- `css/styles.css`: launch polish (v71) — consistency pass extending the v69 surface system to screens it missed: branded Leaflet map chrome (brand/devanagari typography, modal-matched popups, cohesive zoom controls with focus rings + larger close target), premium podium emphasis on the leaderboard (ranks 1–3), resting elevation on queue + hazard cards, and a warmer on-brand empty-state icon. Additive only; motion gated by prefers-reduced-motion
- `index.html`: added a graceful `<noscript>` fallback (inline-styled, English + Hindi + Marathi) so JS-disabled or bundle-failure visitors get a friendly reload prompt instead of a blank screen
- `supabase/schema.sql`: coordinator access requests + approval workflow (v72) — new `access_requests` table with RLS (anon/auth INSERT *pending only*; admin-only SELECT/UPDATE), `admin` super-admin role added to `profiles`, and SECURITY-DEFINER RPCs `request_access`, `approve_access_request`, `reject_access_request`, `claim_access` (+ `is_admin`/`gen_claim_code`). Approval issues a one-time claim code. FOUNDER MUST RE-RUN schema.sql once + bootstrap one super-admin
- `index.html` + `js/app.js` + `css/styles.css`: in-app coordinator access request flow (NGO + BMC). Low-friction request form (name + role + one contact required; org/ward/proof/note optional; submits without login), confirmation panel, claim-code entry, and an admin-only review screen (one-tap approve/reject) reachable from the BMC queue. Works fully in local/no-Supabase mode (on-device queue). All strings localized in en/hi/mr/gu
- `sw.js`: cache bump → v72 (static assets changed: index.html + styles.css + app.js)
- `tests/e2e_comprehensive.py`: SW06 expected cache version → v72; added Access suite (AR01–AR11)
- `js/app.js`: fix report photo flow race after native camera accept (popstate + Map ghost tap); advance to Submit step; cache bump v73
- `sw.js` + `tests/e2e_comprehensive.py`: v73 cache bump; RP11/RP12 photo→submit regression tests; SW06 → v73
- `js/app.js`: export `window.closeAllModals` for automation/E2E callers
- `tests/e2e_comprehensive.py`: Access AR06/AR10 use safe modal close; hardened Leaflet waits (`wait_for_map_ready`, popup/marker waits)
- `js/app.js` + `index.html` + `css/styles.css`: magic-link primary auth UX — send sign-in link, post-send instructions, collapsed OTP fallback; callback handler for hash errors + NGO code redeem; `emailRedirectTo: publicUrl`
- `RELEASE.md`: §10 Supabase URL config + optional SMTP/OTP note
- `sw.js` + `tests/e2e_comprehensive.py`: v76 cache bump; ML01–ML09 magic-link auth UI + error tests; SW06 → v76
- `tests/e2e_comprehensive.py`: ensure_server verifies CivicRadar content (not Windows-reserved 8095 listener); port fallbacks 8097–8787; RP05 waits for report modal open
- `js/app.js` + `index.html`: second-pass review — contact-neutral coordinator access copy (phone-only path); admin OTP verify accepts super-admin role; magic-link callback errors via formatAuthError; claim-code copy toast fixed; bottom-nav ghost-tap guard during camera; Twitter share no duplicate hashtags
- `sw.js` + `tests/e2e_comprehensive.py`: v77 cache bump; AR12 phone-only confirm copy; AU01 admin OTP role check; SW06 → v77
- `tests/e2e_comprehensive.py`: ensure_server uses stdlib http.server + shorter probe timeout (fixes Windows 8095 HTTP.sys hang during test startup)
- `js/app.js` + `index.html` + `css/styles.css`: warm kudos on EVERY report (rotating non-milestone copy) + new `#successProgress` progress-to-next-badge nudge; localized en/hi/mr/gu
- `sw.js` + `tests/e2e_comprehensive.py`: v78 cache bump; RP13–RP15 kudos/progress tests; X29 progress element; SW06 → v78
- `index.html` + `js/app.js` + `css/styles.css`: onboarding "How it works" why/3-step explainer + report-on-the-spot coach guidance (OB10–OB13, C09b); opt-in "report stagnant water nearby" reminder toggle in Profile with graceful Notification/iOS fallback + location-aware in-app nudge built on the existing reminder queue (RR01–RR07); localized en/hi/mr/gu
- `sw.js` + `tests/e2e_comprehensive.py`: v79 cache bump; SW06 → v79
- `index.html` + `js/app.js` + `css/styles.css`: first-run purpose sheet + FAB spotlight (v314); full tour still replayable — skippable spotlight guided tour (Map → Report FAB → Me too → Profile) sequenced right after the v79 coachSpotTip explainer; shown once (`civicradar_tour_seen`), re-watchable via a "Replay app tour" entry in Profile; spotlight + bubble positioned from bounding rects, keyboard operable (Tab/Enter/Esc), focus-managed, backdrop/ESC dismiss, prefers-reduced-motion respected; suppressed for demo/referral/returning users; localized en/hi/mr/gu (TR01–TR09)
- `sw.js` + `tests/e2e_comprehensive.py`: v80 cache bump; SW06 → v80
- `index.html` + `js/app.js` + `css/styles.css`: location banner UX (v81) — added a dismiss "×" control that snoozes the banner for 7 days (`civicradar_locbanner_snooze`) and collapses it into an unobtrusive "Locate me" pill that re-runs the enable-location flow on tap (bypassing snooze); success and explicit taps clear the snooze and hide both; all banner copy localized via `t()` (location.banner/bannerNearby/unavailable/withdrawn/dismiss/locate/locateAria) in en/hi/mr/gu (LB01–LB06)
- `sw.js` + `tests/e2e_comprehensive.py`: v81 cache bump; SW06 → v81
- `index.html` + `js/app.js` + `css/styles.css`: home/landing hero card (v82) — dismissible #MonsoonGuardian strip above Report FAB with headline, 3 benefit pills, primary CTA, tour link, trust line; enhanced empty-map card; localized en/hi/mr/gu (HM01–HM07)
- `sw.js` + `tests/e2e_comprehensive.py`: v82 cache bump; SW06 → v82
- `js/config.js` + `js/app.js` + `index.html` + `css/styles.css`: official grievance channel integration (v84) — verified deep links for MyBMC MARG, PMC CARE, Swachhata-MoHUA, Aaple Sarkar; city-aware panels in success modal, Community, Profile, and escalation; hazard-smart routing + clipboard summary on open; `official_channel_open` analytics; localized en/hi/mr/gu (OC01–OC05)
- `sw.js` + `tests/e2e_comprehensive.py`: v84 cache bump; SW06 → v84
- `index.html` + `js/app.js` + `css/styles.css`: home/landing hero (v85) — #MonsoonGuardian stagnant-water hero above FAB (WHAT/WHY/HOW/trust), dismissible until first report; enhanced empty-map card with gradient drop icon; localized en/hi/mr/gu (HM01–HM07)
- `sw.js` + `tests/e2e_comprehensive.py`: v85 cache bump; SW06 → v85
- `tests/e2e_comprehensive.py`: RP17 varied canvas (moderation-safe); RP05 modal wait; clear reports before kudos block; RP15 progress assertion; OC01b/OC02b desktop store URLs; OC04 execCommand copy stub
- `index.html` + `js/app.js` + `js/config.js` + `css/styles.css` + `supabase/schema.sql`: society/neighbourhood MVP (v86) — optional onboarding + Profile field with datalist suggestions + free-text; stored on user profile and attached to reports; shown on map popup; National Cooperative Database link-out; localized en/hi/mr/gu (SO01–SO04)
- `js/app.js`: i18n audit complete — `rerenderDynamicViews()` re-localizes open modals (success, community, profile, about, tour); `refreshSuccessModalStrings()`; map popup `You are here` localized; child-screen i18n E2E (I06–I08)
- `index.html` + `js/app.js` + `js/config.js` + `js/society-suggestions-data.js` + `css/styles.css`: ward-filtered society lists (v89) + onboarding explainer trim; custom society cache; OB10–OB13 + SO05–SO08
- `sw.js` + `tests/e2e_comprehensive.py`: v89 cache bump; SW06 → v89
- `js/app.js` + `index.html`: active monsoon messaging (v90) + report photo reset on reopen (IS03); hero spot-guidance subline; cache v90
- `sw.js` + `tests/e2e_comprehensive.py`: v90 cache bump; OB10–OB13 hero-based (post v89 explainer trim); SW06 → v90; browser restart before late suites
- `supabase/schema.sql` + `js/analytics.js` + `js/app.js` + `index.html` + `css/styles.css`: analytics & tracking dashboard (v93) — `get_tracking_dashboard` RPC, role-gated UI, PWA install instrumentation, localized en/hi/mr/gu; TK01–TK05; SW06 → v93
- `index.html` + `js/app.js`: neighbourhood datalist autopopulate (v96) — volunteer + lead nomination fields share ward-filtered `societySuggestions` with free-text override and custom cache; localized en/hi/mr/gu; NB01–NB04; SW06 → v96
- `index.html` + `js/app.js` + `sw.js` + `supabase/schema.sql`: neighbourhood report alerts (v97) — Profile "Neighbourhood updates" with new-report + resolved FYI sub-toggles; shared rate limit; resolved digest; Web Notification + in-app toast; Supabase profile prefs + sync; local queue for E2E; localized en/hi/mr/gu; NA01–NA06; SW06 → v97
- `index.html` + `js/app.js` + `css/styles.css` + `sw.js`: ward/neighbourhood re-select (v100) — Profile city+ward editable; society datalist refreshes on ward change; datalist select-all on focus; auto civic display name when blank; E2E SO09–SO10, C09c; SW06 → v100
- `index.html` + `js/app.js` + `css/styles.css` + `sw.js`: before/after share-win graphic (v101) — canvas card with society/ward footer, green Fixed placeholder, square 1080×1080 + story 9:16 preview, WhatsApp/download/share; resolved nbh toast Share win CTA; localized en/hi/mr/gu; WIN01–WIN04; SW06 → v101
- `index.html` + `js/app.js` + `sw.js`: context-dependent hint refresh (v103) — hazard cue + esc BMC hints on category change; neighbourhood hints on language switch; RP18; SW06 → v103
- `index.html` + `js/app.js` + `css/styles.css` + `sw.js` + `supabase/schema.sql`: Civic Hero XP & certificates (v101) — 6-level ladder, Profile XP bar, Me too/report XP, shareable level certificates; localized en/hi/mr/gu; XP01–XP03; SW06 → v101
- `js/app.js` + `tests/e2e_comprehensive.py`: v101 QA — certificate modal closes success overlay before open (unblocks controls); L01 parallel load stagger+retry; RP09 seeds nearby report after XP storage reset
- `index.html` + `js/app.js` + `css/styles.css` + `sw.js`: iOS/Safari PWA compatibility (v108) — safe-area map/nav, WebKit tap/scroll fixes, Leaflet tap+resize, modal scroll lock, iOS install hint, photo accept image/*, report draft guard; IOS01–IOS04; manual checklist `tests/IOS-QA.md`; SW06 → v108
- `css/styles.css` + `index.html` + `js/app.js` + `sw.js`: visual refresh (v112) — merged the two design-token :root blocks into one, retired `--secondary` pink (split into `--lead-accent` for community-lead role UI and `--primary`/`--accent` for everything else it was inconsistently driving, incl. FAB + profile-card gradient → `--grad-brand-cyan`), detokenized repeated hardcoded toast/podium/warning-amber hex into new tokens, added OS-driven `prefers-color-scheme: dark` support (`color-scheme` meta → `light dark`), merged duplicate form-input focus-ring rules + added resting elevation, decluttered the home screen (home-hero z-index above legend/banner; FAB + persona-bar hidden while home-hero shows to remove the duplicate Report CTA), restyled the leaderboard demo-data note as a tonal notice, and differentiated the two near-identical "be the first" Community empty-state strings (`community.challenge.empty`, `social.wardWeekEmpty`) across en/hi/mr/gu; SW06 → v112
- `css/styles.css` + `index.html` + `js/app.js` + `supabase/schema.sql`: PM-review pass (v113) — fixed broken certificate WhatsApp share (undefined function); resolved the "Monsoon Guardian" label reused for 3 unrelated things (XP level, streak badge renamed "Local Hero", first-report toast); decluttered the success modal (removed duplicate badge-unlock line, grouped reward text into one panel, moved Twitter share into the existing collapsed accordion); merged Profile's scattered notification/consent controls into one "Notifications & Privacy" section; added a one-time lead/volunteer discoverability nudge after the 3rd report; added a "this month" vs "all time" Community leaderboard period toggle; added a per-user referral code + reward loop (new `referrals` table/RPC, one-time XP + Profile line when neighbours join via your invite); full Hindi/Marathi/Gujarati copy-quality pass (fixed cross-language contamination, untranslated fragments, inconsistent terminology, typos); refreshed monsoon-season copy for an early-monsoon launch; reverted OS dark-mode support after smoke-testing showed icons were hard to differentiate (`color-scheme` meta back to `light`-only) — SW06 → v113
- `css/styles.css` + `js/app.js` + `supabase/storage-migration.sql`: visual vibrancy + Storage scale-up (v114) — hazard picker tiles now color-coded per category (cyan/green/orange/gold) instead of flat gray, header icons tinted brand indigo; report/resolution photos now upload to a `report-photos` Supabase Storage bucket instead of embedding base64 in Postgres rows (`Backend.uploadReportImage`), fixing both the free-tier DB-size and sync-egress risk flagged for 10K-user scale; widened the `isSafeReportImage()` image-src guard (previously `data:` URL only) to also accept the resulting Storage URLs across all 13 render sites that check it; SW06 → v114
- `css/styles.css` + `index.html` + `js/app.js`: design polish pass (v115) — Community modal restructured from one long flat scroll into a clear hierarchy ("Your ward this week" / "Ward leaderboard" sections always visible, "Get involved" and "Resources" as collapsible groups reusing the existing official-channels accordion pattern); Profile's plain bordered form fields wrapped in an elevated `.profile-details-card` so the premium gradient stat card's tone carries down the screen, plus icons added to every Profile section header for visual consistency with Community; empty states (Reports, Volunteer, Pledges, Wins, Community leads) upgraded from flat muted icons to a warm gradient icon badge (shared `.empty-state--action i` style, one CSS change covers all five); removed the loud Instagram-gradient button style from two generic "Download" actions (certificate, share-win card) in favour of the existing outline style already used by their neighbouring "Copy caption" button, and deleted the now-unused `.btn--instagram` rule; SW06 → v115
- `js/app.js` + `sw.js`: fix report-modal close button (v116) — `canDismissReportOverlay()` was blocking the report modal's × button, backdrop tap, and hardware back indefinitely once a photo had been captured (`hasReportPhotoPreview()` check had no time bound, unlike the sibling `isReportPhotoPickerActive()` camera-return race-condition guard it sat next to); closing with a photo present is safe — `closeModal('report')` never clears the canvas, and `openReportModal()` already resumes straight to the photo/submit step on reopen — so the check was removed with no data-loss risk; audited all other modals/dismiss paths for the same indefinite-block pattern, found none; SW06 → v116
- `css/styles.css` + `js/app.js`: higher-energy milestone celebrations (v117) — confetti now draws from a vivid 8-hue brand palette (was a narrow green-cyan-purple band), mixes rect/dot/ribbon shapes and piece sizes, and adds horizontal drift + variable spin instead of a flat straight-down fall; added a new `epic` intensity tier (64 pieces) reserved for the biggest moments; wired confetti into two milestones that previously had none — filing a BMC complaint (`saveComplaintId`, celebrate-tier on first filing) and leveling up / unlocking a certificate (`showCertificateModal`, epic-tier); existing report-submit, Me too, fix-confirmed, and first-share confetti automatically pick up the richer palette/shapes with no call-site changes; SW06 → v117
- `css/styles.css` + `js/app.js`: trust-building report status stepper + hazard example text (v118) — profile report cards now show a 3-node visual stepper (Reported → Pending → Resolved) with check-circle icons and a filled connecting line, replacing the old plain progress dots (`renderReportCardProgress` rewritten in place, same call site); hazard picker tiles show a short example line per category ("e.g. clogged drain, waterlogged street") to reduce mis-categorized reports, localized across en/hi/mr/gu (new `hazard.<key>.example` i18n keys); stepper labels reuse existing `esc.progress.reported`/`esc.progress.resolved`/`popup.pending` keys rather than adding new ones; Map/Feed toggle, search, and a real reverse-geocoded location step were scoped out of this pass (deferred — no existing infra for any of the three, see session notes); SW06 → v118
- `css/styles.css` + `index.html` + `js/app.js` + `supabase/schema.sql` + `terms.html`: UGC content-moderation compliance (v119) — the report-popup "Flag / hide from map" button previously only hid a pin on the reporter's own device with no backend notification, and the admin queue had zero content-removal action; this is the core requirement of Apple Guideline 1.2 and Google Play's UGC policy for apps with public user photos, so it's fixed end-to-end: new `flag_report` RPC + `report_flags` table (dedup-by-user, mirrors `confirm_report`), new `reports.flag_count`/`removed`/`removed_at` columns, `reports_select_all` RLS policy updated so moderator-removed content is genuinely inaccessible via the API to everyone except the original reporter and BMC/admin (not just hidden client-side); flagged reports surface in the admin queue (sorted to the top, badge + count) and a new "Remove content" button lets BMC/admin take a report off the public map for every device's next sync, not just the moderator's own; the original reporter still sees their own removed report in Profile with a "Removed by moderator" status instead of it silently vanishing; hide-confirm copy now accurately says it also flags for review (previously implied a purely local action); terms.html section 5 updated to describe the actual in-app flow instead of only an email-based takedown request; localized across en/hi/mr/gu; SW06 → v119
- `js/app.js` + `supabase/schema.sql` + `supabase/schema_security_fix.sql` + `index.html`: profile privilege-escalation fix + About-modal developer credit (v121) — closed a column-level privilege gap on `public.profiles`: the `profiles_update_own` RLS policy only checked row ownership, not which columns could change, so any signed-in user (including anonymous auth) could directly set their own `role` to 'bmc'/'ngo_lead' or set `civic_xp` to an arbitrary number via the exposed Supabase client; fixed via `schema_security_fix.sql` (revokes blanket UPDATE on profiles, re-grants only the columns citizens legitimately self-edit, adds a guarded `sync_civic_xp` RPC that only allows XP to increase and caps the jump per call) plus the matching `Backend.syncCivicXp` app.js edit to call the RPC instead of writing the columns directly; also added a short "About the project" credit block to the About modal (right after Community impact stats) crediting the developer by first-name + initial only, routing all contact through the operator inbox, localized across en/hi/mr/gu; SW06 → v121
- `js/searchable-select.js`: combobox fix + accessibility (v122) — fixed the ward/society searchable dropdown re-opening filtered to the just-picked value right after selection (missing suppressInput guard around the programmatic value-set); added auto-advance-focus to the next field after picking a value, without auto-opening that field's own dropdown if it's also a combobox; added `aria-selected` to listbox options (previously only a CSS class tracked the active option — screen readers had no way to know which one was selected) and `aria-haspopup="listbox"` on the input; SW06 → v122
- `js/app.js` + `js/config.js`: copy rewrite — warm neighbourly voice + monsoon-neutral core (v123) — rewrote the high-impact user-facing strings (onboarding, coach mark/tour, home hero, persona bar, success/celebration, community, PWA nudge, map empty states) to a warmer, "your lane/your neighbours" voice with one idea per string, replacing several that crammed 3-4 messages into one sentence (worst offender: `persona.citizen.idle`); removed monsoon/dengue language from all evergreen core strings — it now lives only in the `season.*` keys, which `getSeasonalHook()` already shows/hides by month; added a deliberate `seasonalMode` override (auto/on/off, in `js/config.js`) so the seasonal banner can be forced on for a campaign or off entirely, on top of the existing date-driven default; standardized the pre-existing "Civic Hero XP" / "Civic Points" naming inconsistency (both were mixed across strings, even within the same language) onto "Civic Points" everywhere; fixed a leftover `#MonsoonGuardian` hashtag baked into `coach.step`/`home.hero.badge`/`persona.wardImpact` in all 4 languages; applied matching translations across hi/mr/gu (kept "Nihira H." and other proper nouns unchanged); left the ~2,000 functional strings (buttons, field labels, error text) and legal copy untouched, per the rewrite's own scope; note: `#MonsoonGuardian` is still hardcoded in 4 places in JS code (share-text templates, canvas watermark/title generation) rather than i18n strings — same underlying issue, flagged separately, not fixed in this pass; SW06 → v123
- `js/app.js` + `sw.js`: Me too dedupe fix (v124) — duplicate Me too clicks could inflate local confirmation counts and XP because the confirmed-id set was re-read from localStorage on every check (no in-memory cache), the claim was written only after incrementing, and the popup button stayed active with no in-flight guard; fixed with claim-first persistence to `civicradar_confirmed`, session cache + `confirmInFlight` set, immediate button disable/replace with done state, and duplicate feedback toast; backend `confirm_report` RPC was already idempotent; MT01; SW06 → v124
- `js/app.js` + `sw.js` + `supabase/schema.sql` + `supabase/schema_security_fix.sql`: reports column-lock hardening (v125) — closed the same class of column-privilege gap as v121's profiles fix, this time on `public.reports`: the `reports_update_roles` RLS policy only checked row ownership/role, not which columns an allowed UPDATE could touch, so a citizen could open the console and set `status`/`resolved_by`/`complaint_id` on their own report to fake an official BMC resolution or filing that never happened; fixed by revoking blanket UPDATE on reports entirely (no columns re-granted — every field is set once at INSERT time, which is unaffected) and moving every mutation behind a role/ownership-checked SECURITY DEFINER RPC: `bmc_set_report_status` (BMC/admin — filing + official resolution), `resolve_own_report` (reporter-only, from pending, once), `set_resolution_image` (reporter or a confirmed "looks fixed" neighbour, first-write-wins — closes a second hole where any signed-in user could otherwise overwrite any resolved report's "after" photo), `ngo_mark_cleared` (NGO lead only), `admin_remove_report` (BMC/admin — UGC takedown); rewired `Backend.updateReportResolution/updateReportFiling/updateReportCleanup/removeReportContent` to call the RPCs instead of raw `.update()`; removed `Backend.updateReportStatus` (dead code, zero call sites, would have silently started failing under the new column lock); also fixed `Backend.insertReport`/`pushLocalOwned`'s report upsert — `ON CONFLICT DO UPDATE` requires UPDATE privilege on every column in its SET clause even when a row never actually conflicts, so with reports column-locked the old upsert would have failed every new report sync; switched to `ignoreDuplicates: true` (`ON CONFLICT DO NOTHING`), which references no columns and is equivalent for a freshly generated report id; `schema_security_fix.sql`'s profiles-only fix is now folded into `schema.sql` directly (file kept as a superseded pointer); SW06 → v125
- `js/app.js` + `sw.js` + `supabase/schema.sql` + `tests/e2e_comprehensive.py`: hazard submission security hardening (v127) — pen-test pass on report INSERT mass-assignment, rate limits, and XSS: new `insert_report` SECURITY DEFINER RPC (only hazard/notes/image/lat/lng/ward/city/society/neighbourhood accepted; sets reporter_id=auth.uid(), status=pending, confirmations=0 server-side), REVOKE direct INSERT on reports, CHECK constraints on notes/ward/city/hazard/coords, per-user rate limits (30 reports/hr, 60 confirms/hr, 30 flags/hr), client `sanitizeReportInput()` + `Backend.syncReportInsert` RPC routing, popup notes rendered via escapeHtml; SEC01; SW06 → v127

## Summary by category

- **API:** 5 pass / 0 fail
- **Access:** 13 pass / 0 fail
- **Admin:** 2 pass / 0 fail
- **BMC:** 9 pass / 0 fail
- **Celebration:** 4 pass / 0 fail
- **Citizen:** 43 pass / 1 fail
- **Community:** 3 pass / 0 fail
- **DeepLink:** 2 pass / 0 fail
- **Edge:** 17 pass / 0 fail
- **Escalation:** 6 pass / 0 fail
- **Feedback:** 7 pass / 0 fail
- **HomeHero:** 7 pass / 0 fail
- **ImageSafety:** 1 pass / 2 fail
- **LeadVote:** 8 pass / 0 fail
- **Legal:** 2 pass / 0 fail
- **Load:** 5 pass / 0 fail
- **LocationBanner:** 7 pass / 0 fail
- **Map:** 4 pass / 0 fail
- **MultiCity:** 8 pass / 0 fail
- **NGO:** 10 pass / 0 fail
- **Neighbourhood:** 6 pass / 0 fail
- **OfficialChannels:** 9 pass / 0 fail
- **Onboarding:** 4 pass / 0 fail
- **PWA:** 2 pass / 0 fail
- **Partner:** 1 pass / 0 fail
- **Persona:** 1 pass / 0 fail
- **Pledge:** 1 pass / 0 fail
- **Profile:** 4 pass / 0 fail
- **Reminder:** 7 pass / 0 fail
- **Report:** 3 pass / 0 fail
- **Security:** 1 pass / 0 fail
- **ShareWin:** 3 pass / 1 fail
- **Storage:** 2 pass / 0 fail
- **Sync:** 1 pass / 0 fail
- **System:** 0 pass / 2 fail
- **Tour:** 7 pass / 3 fail
- **UI:** 7 pass / 0 fail
- **Viral:** 4 pass / 0 fail
- **Volunteer:** 1 pass / 0 fail
- **i18n:** 1 pass / 0 fail

## Failures

- `C09b` **Report-on-the-spot guidance shown at onboarding completion** — failed
- `ERR-Extended` **Suite Extended crashed** — Page.wait_for_function: Timeout 10000ms exceeded.
- `IS01` **Photo hint visible after capture** — failed
- `IS03` **Hint hidden on modal reopen without photo** — failed
- `ERR-ImageSafety` **Suite ImageSafety crashed** — Page.evaluate: TypeError: Cannot read properties of null (reading 'classList')
    at eval (eval at evaluate (:234:30), 
- `TR03` **Purpose sheet shows on first run (no FAB tip stack)** — failed
- `TR07` **Replay entry restarts tour on demand** — failed
- `TR10` **Purpose sheet blocks pin popup open** — failed
- `WIN02` **Success card canvas 1080×1080 + society location label** — failed

## Limitations

- Supabase backend not configured — cloud sync, magic-link auth, and cross-device tests are local-only.
- Photo moderation NSFW model skipped in headless (solid-color test images pass).
- PWA offline shell and service-worker stale-cache tests limited (SW blocked in automation).
- Camera permission denial uses geolocation mock proxy; real device camera not tested.

## All scenarios

| ID | Category | Scenario | Result | Note |
|---|---|---|---|---|
| C01 | Citizen | ToS modal on fresh user | PASS |  |
| C02 | Citizen | ToS continue disabled without checkbox | PASS |  |
| C03 | Citizen | ToS accept enables continue | PASS |  |
| C04 | Citizen | Onboarding after ToS accept | PASS |  |
| C04b | Citizen | City picker defaults to Mumbai | PASS | city=mumbai |
| C05 | Citizen | GPS consent after ward detect | PASS |  |
| C06 | Citizen | Ward auto-detected on onboarding | PASS | ward=L Ward — Kurla, Sakinaka |
| C06b | Citizen | Empty ward rejected | PASS |  |
| C07 | Citizen | Invalid/XSS ward rejected | PASS |  |
| C08 | Citizen | Valid ward onboarding | PASS |  |
| C08b | Citizen | City saved on onboarding | PASS |  |
| C09 | Citizen | XSS display name sanitized | PASS |  |
| C09b | Citizen | Report-on-the-spot guidance shown at onboarding completion | **FAIL** |  |
| C09c | Citizen | Empty display name gets unique civic default | PASS | name=Ward Scout · Dadar, Shiva #C5F |
| C34 | Citizen | Pune hides BMC partner card | PASS |  |
| C34b | Citizen | Pune blocks BMC admin modal | PASS |  |
| C34c | Citizen | Pune community subtitle ward-scoped (no BMC) | PASS |  |
| C10-hi | Citizen | Language switch HI | PASS |  |
| C10-mr | Citizen | Language switch MR | PASS |  |
| C10-gu | Citizen | Language switch GU | PASS |  |
| C10-en | Citizen | Language switch EN | PASS |  |
| C14 | Citizen | Report blocked without photo | PASS |  |
| C15 | Citizen | GPS denied still submits with provisional pin | PASS | success=True stored=True |
| C16 | Citizen | Report submit success modal | PASS | rid=de598366-f682-4857-b9bb-3fe76b296daf |
| C17 | Citizen | Success modal WhatsApp + official filing | PASS |  |
| C17b | Citizen | Native share button feature-detect gating | PASS |  |
| C18 | Citizen | App origin for deep links | PASS |  |
| DL01 | DeepLink | WhatsApp share URL is canonical HTTPS ?report= | PASS |  |
| C19b | Citizen | PWA nudge after first report | PASS |  |
| C19 | Citizen | Map shows markers after report | PASS | markers=3 |
| C20 | Citizen | Duplicate nearby Me too prompt | PASS |  |
| C21 | Citizen | Profile civic points visible | PASS |  |
| C22 | Citizen | Profile pending count | PASS |  |
| C23 | Citizen | Profile report cards | PASS | cards=1 |
| C24 | Citizen | Escalation modal opens | PASS |  |
| C25 | Citizen | Escalation copy-all button | PASS |  |
| C26 | Citizen | Complaint save blocked without consent | PASS |  |
| C27 | Citizen | Complaint ID saved | PASS |  |
| C28 | Citizen | Invalid complaint # handled | PASS |  |
| C29 | Citizen | Community modal opens | PASS |  |
| C30 | Citizen | Leaderboard wards populated | PASS | items=5 |
| C31 | Citizen | Pledge modal opens | PASS |  |
| C32 | Citizen | Pledge saved | PASS |  |
| C33 | Citizen | Sponsor wall renders | PASS |  |
| C35 | Citizen | Coach mark dismiss sets flag | PASS | already dismissed |
| N01 | NGO | Lead demo login | PASS |  |
| N02 | NGO | Coordinator hub opens | PASS |  |
| N03 | NGO | Coordinator pledges list | PASS |  |
| N04 | NGO | Log community cleanup | PASS |  |
| N05 | NGO | Mark pledge delivered | PASS |  |
| N06 | NGO | Verify volunteer hours | PASS |  |
| N07 | NGO | Persona bar lead styling | PASS |  |
| N08 | NGO | Exit NGO mode | PASS |  |
| A01 | BMC | Admin demo login | PASS |  |
| A02 | BMC | Admin queue opens | PASS |  |
| A03 | BMC | Queue ward filter options | PASS |  |
| A04 | BMC | Queue sort options | PASS |  |
| A05 | BMC | Copy for 1916 | PASS |  |
| A06 | BMC | CSV export button present | PASS |  |
| A07 | BMC | Resolve requires proof photo | PASS |  |
| A08 | BMC | App health panel element | PASS |  |
| A09 | BMC | Admin persona bar text | PASS |  |
| E01 | Edge | Corrupt reports JSON recovery | PASS |  |
| E02 | Edge | Corrupt user JSON -> default user | PASS |  |
| E03 | Edge | i18n keys render | PASS |  |
| E04 | Edge | Invalid deep link shows toast | PASS |  |
| E05 | Edge | Community closes profile (no stack) | PASS |  |
| E06 | Edge | Double submit disables button | PASS |  |
| E07 | Edge | XSS notes sanitized on save | PASS |  |
| SEC01 | Security | XSS notes escaped in profile DOM | PASS |  |
| E08 | Edge | Analytics blocked without consent | PASS |  |
| E09 | Edge | Analytics allowed after analytics opt-in | PASS |  |
| E10 | Edge | Admin mode persists mid-flow | PASS |  |
| E11 | Edge | Reminder snooze future date stored | PASS |  |
| E12 | Edge | Hidden report IDs stored | PASS |  |
| E13 | Edge | Empty community stats zero | PASS |  |
| E14 | Edge | Local demo sync status shown | PASS |  |
| E15 | Edge | Map empty CTA visible | PASS |  |
| E15b | Edge | Map empty share hidden first visit | PASS |  |
| E16 | Edge | Invalid ward cleared on load | PASS |  |
| L01 | Load | 15 parallel report contexts | PASS | 15/15 |
| L02 | Load | 200 reports refresh under 3s | PASS | 0.07s |
| L03 | Load | 50x loadReports parse under 500ms | PASS | 13ms |
| L04 | Load | Rapid corroboration increments | PASS | n=5 |
| L05 | Load | Analytics batch enqueue | PASS |  |
| M01 | Map | Leaflet map container | PASS |  |
| M02 | Map | Map legend visible | PASS |  |
| M03 | Map | Recenter button | PASS |  |
| M04 | PWA | Manifest link | PASS |  |
| M05 | PWA | Service worker API available | PASS |  |
| P01 | Profile | Delete data button | PASS |  |
| P02 | Profile | About button | PASS |  |
| P03 | Community | Ward challenge element | PASS |  |
| P04 | Community | Impact stats grid | PASS |  |
| P05 | Report | Hazard grid renders | PASS |  |
| P06 | Report | Stagnant-water live tile | PASS |  |
| P07 | Legal | Privacy link in ToS | PASS |  |
| P08 | Partner | Partner portal opens | PASS |  |
| P09 | Admin | Admin demo login btn | PASS |  |
| P10 | NGO | Lead demo login btn | PASS |  |
| P11 | Profile | Delete my data resets to ToS | PASS |  |
| P12 | DeepLink | Valid ?report= opens popup | PASS |  |
| X01 | API | openReportModal exported | PASS |  |
| X02 | API | setAdminMode exported | PASS |  |
| X03 | API | renderLeaderboard exported | PASS |  |
| X04 | API | markReportResolved exported | PASS |  |
| X05 | API | Backend local mode | PASS |  |
| X06 | i18n | Missing key fallback | PASS |  |
| X07 | Map | Marker layer refresh | PASS |  |
| X08 | Community | Citizens panel toggle | PASS |  |
| X09 | Report | Notes maxlength 500 | PASS |  |
| X10 | Admin | Invalid login rejected | PASS |  |
| X11 | NGO | Invalid login rejected | PASS |  |
| X12 | Escalation | Tier ladder markup | PASS |  |
| X13 | Profile | Civic points numeric | PASS |  |
| X14 | Storage | Pledges JSON parse safe | PASS |  |
| X15 | Storage | Confirmed set parse safe | PASS |  |
| X16 | UI | Bottom nav tabs | PASS |  |
| UX01 | UI | Active nav tab bold label | PASS |  |
| UX04 | UI | Bottom nav icons have mask-image | PASS |  |
| UX05 | UI | Report notes font matches Outfit path | PASS |  |
| UX02 | UI | Modal title clears close btn | PASS |  |
| UX03 | UI | Lead candidates light surface | PASS |  |
| X17 | UI | FAB report button | PASS |  |
| X18 | Legal | Terms page linked | PASS |  |
| X19 | Persona | Citizen default mode | PASS |  |
| X20 | Sync | Local mode label | PASS |  |
| X21 | Escalation | PMC modal opens (Pune) | PASS |  |
| X22 | Escalation | TMC modal opens (Thane) | PASS |  |
| X23 | Escalation | PMC complaint ID saved | PASS |  |
| X26 | Escalation | TMC Aaple label after PMC | PASS |  |
| X27 | Volunteer | Skill checkbox compact width | PASS |  |
| X24 | Escalation | Consent checkbox compact width | PASS |  |
| X25 | Pledge | Sticky footer present | PASS |  |
| OB10 | Onboarding | Hero welcome card present (explainer trim v89) | PASS |  |
| OB11 | Onboarding | Hero renders 3 benefit pills | PASS |  |
| OB12 | Onboarding | Hero subline populated (terse) | PASS |  |
| OB13 | Onboarding | Spot guidance in hero subline | PASS |  |
| X28 | Celebration | Success celebrate element present | PASS |  |
| X29 | Celebration | Success progress nudge element present | PASS |  |
| X30 | Celebration | Success streak callout element present | PASS |  |
| X31 | Celebration | Profile rewards dashboard present | PASS |  |
| V40 | Viral | Referral welcome banner present + hidden by default | PASS |  |
| V41 | Viral | Seasonal hook element present in community | PASS |  |
| V42 | Viral | Ward weekly social proof line populated | PASS |  |
| V43 | Viral | Weekly recap share shown when recent reports | PASS |  |
| MC01 | MultiCity | Thane community subtitle ward-scoped (no BMC) | PASS |  |
| MC02 | MultiCity | Thane blocks BMC admin modal | PASS |  |
| MC03 | MultiCity | Thane user city persisted | PASS |  |
| MC04 | MultiCity | Thane partner portal hides BMC card | PASS |  |
| MC05 | MultiCity | Pune user city persisted | PASS |  |
| MC06 | MultiCity | Pune ward combobox on pledge | PASS |  |
| MC07 | MultiCity | Mumbai ward combobox on pledge | PASS |  |
| MC08 | MultiCity | City picker has 3 options | PASS |  |
| ERR-Extended | System | Suite Extended crashed | **FAIL** | Page.wait_for_function: Timeout 10000ms exceeded. |
| IS01 | ImageSafety | Photo hint visible after capture | **FAIL** |  |
| IS02 | ImageSafety | Submit succeeds without checkbox confirm | PASS |  |
| IS03 | ImageSafety | Hint hidden on modal reopen without photo | **FAIL** |  |
| ERR-ImageSafety | System | Suite ImageSafety crashed | **FAIL** | Page.evaluate: TypeError: Cannot read properties of null (reading 'classList')
    at eval (eval at evaluate (:234:30),  |
| FB01 | Feedback | Feedback entry point present (About) | PASS |  |
| FB02 | Feedback | Feedback modal opens from menu | PASS |  |
| FB03 | Feedback | Empty message blocked with inline error | PASS |  |
| FB04 | Feedback | Category (Bug/Idea/Other) selectable | PASS |  |
| FB05 | Feedback | Local submit stores feedback + closes modal | PASS |  |
| FB06 | Feedback | Submit shows success/saved toast | PASS |  |
| FB07 | Feedback | Feedback strings render (i18n, no key leak) | PASS |  |
| TR01 | Tour | Tour overlay element present | PASS |  |
| TR02 | Tour | Replay-tour entry present in Profile | PASS |  |
| TR03 | Tour | Purpose sheet shows on first run (no FAB tip stack) | **FAIL** |  |
| TR04 | Tour | Got it sets coach+fab flags and clears first-run lock | PASS |  |
| TR06 | Tour | Purpose/tour do not reappear on reload once seen | PASS |  |
| TR05 | Tour | Purpose Got it sets fab_spot without FAB tip overlay | PASS |  |
| TR07 | Tour | Replay entry restarts tour on demand | **FAIL** |  |
| TR08 | Tour | Tour does NOT show in demo mode | PASS |  |
| TR09 | Tour | Tour does NOT show for referral (?ref=) entry | PASS |  |
| TR10 | Tour | Purpose sheet blocks pin popup open | **FAIL** |  |
| RR01 | Reminder | Report-reminder opt-in toggle present | PASS |  |
| RR02 | Reminder | Enable persists opt-in with no Notification API (no error) | PASS |  |
| RR03 | Reminder | Disable persists opt-out | PASS |  |
| RR04 | Reminder | Opt-in reminder shows in-app card (no push backend) | PASS |  |
| RR05 | Reminder | Reminder respects cadence (not re-shown same day) | PASS |  |
| RR06 | Reminder | No location nudge when hazard is far away | PASS |  |
| RR07 | Reminder | Nearby pending hazard triggers location nudge | PASS |  |
| NA01 | Neighbourhood | Neighbourhood alert toggles present | PASS |  |
| NA02 | Neighbourhood | Alert preferences persist in localStorage | PASS |  |
| NA03 | Neighbourhood | No new-report alert when toggle off | PASS |  |
| NA04 | Neighbourhood | Resolved alert fires for matching neighbourhood user | PASS |  |
| NA05 | Neighbourhood | No resolved alert when toggle off | PASS |  |
| NA06 | Neighbourhood | Rate limit prevents burst (max 3 / 24h) | PASS |  |
| WIN01 | ShareWin | Share win modal has preview + aspect toggles | PASS |  |
| WIN02 | ShareWin | Success card canvas 1080×1080 + society location label | **FAIL** |  |
| WIN03 | ShareWin | Story aspect canvas 1080×1920 (9:16) | PASS |  |
| WIN04 | ShareWin | Resolved neighbourhood toast has Share win action | PASS |  |
| AR01 | Access | Lead + BMC entry points present | PASS |  |
| AR02 | Access | BMC request modal opens with explainer | PASS |  |
| AR03 | Access | Empty name blocked with inline error | PASS |  |
| AR04 | Access | Contact required (email or phone) | PASS |  |
| AR05 | Access | BMC submit (name+email) confirms + stores | PASS |  |
| AR06 | Access | Access strings render (i18n, no key leak) | PASS |  |
| AR07 | Access | Admin review lists pending BMC request | PASS |  |
| AR08 | Access | Approve issues claim code | PASS |  |
| AR09 | Access | Reject marks request rejected | PASS |  |
| AR10 | Access | Claim code unlocks BMC role | PASS |  |
| AR13 | Access | Used claim code rejected on second redeem | PASS |  |
| AR11 | Access | Invalid claim code rejected | PASS |  |
| AR12 | Access | Phone-only confirm uses contact-neutral copy | PASS |  |
| LV01 | LeadVote | Nomination modal opens with explainer | PASS |  |
| LV02 | LeadVote | Ward required for nomination | PASS |  |
| LV03 | LeadVote | Nomination confirms + stores locally | PASS |  |
| LV04 | LeadVote | Candidate listed in Community | PASS |  |
| LV05 | LeadVote | Self-vote blocked | PASS |  |
| LV06 | LeadVote | 2 peer votes grant NGO lead role | PASS |  |
| LV07 | LeadVote | Conflict shows 5-vote co-lead threshold | PASS |  |
| LV08 | LeadVote | Lead strings render (i18n, no key leak) | PASS |  |
| LB01 | LocationBanner | Banner shows when consent missing | PASS |  |
| LB02 | LocationBanner | Dismiss hides banner + sets snooze + shows pill | PASS |  |
| LB03 | LocationBanner | Banner does not reappear while snoozed | PASS |  |
| LB04 | LocationBanner | Locate pill re-triggers enable flow | PASS |  |
| LB05 | LocationBanner | Banner text localized (Marathi, not hardcoded EN) | PASS |  |
| LB06 | LocationBanner | Dismiss control has localized aria-label | PASS |  |
| LB07 | LocationBanner | Pin popup parks / hides location banner | PASS |  |
| HM01 | HomeHero | Hero visible for onboarded user with no reports | PASS |  |
| HM02 | HomeHero | Purpose headline + subline visible | PASS |  |
| HM03 | HomeHero | Primary CTA present | PASS |  |
| HM04 | HomeHero | Three benefit pills present | PASS |  |
| HM05 | HomeHero | Hero hides map-empty overlay while visible | PASS |  |
| HM06 | HomeHero | Dismiss hides hero + sets localStorage | PASS |  |
| HM07 | HomeHero | After dismiss, map empty CTA can show | PASS |  |
| OC01 | OfficialChannels | Resources tab panel renders for mumbai | PASS |  |
| OC01b | OfficialChannels | mumbai primary channel href verified | PASS |  |
| OC02 | OfficialChannels | Resources tab panel renders for pune | PASS |  |
| OC02b | OfficialChannels | pune primary channel href verified | PASS |  |
| OC03 | OfficialChannels | Resources tab panel renders for thane | PASS |  |
| OC03b | OfficialChannels | thane primary channel href verified | PASS |  |
| OC04 | OfficialChannels | Copy helper includes report ID on open | PASS |  |
| OC05 | OfficialChannels | Resources tab renders channel buttons | PASS |  |
| OC06 | OfficialChannels | Resources grouping + Recommended + footer sources link | PASS |  |
