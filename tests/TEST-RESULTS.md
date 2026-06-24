# CivicRadar Test Results

**Run:** 2026-06-23 23:15:26
**Server:** http://localhost:9080/
**Script:** `tests/e2e_comprehensive.py`
**Total:** 278 | **Pass:** 278 | **Fail:** 0

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

## Summary by category

- **API:** 5 pass / 0 fail
- **Access:** 12 pass / 0 fail
- **Admin:** 8 pass / 0 fail
- **Analytics:** 5 pass / 0 fail
- **Auth:** 10 pass / 0 fail
- **BMC:** 9 pass / 0 fail
- **Celebration:** 5 pass / 0 fail
- **Citizen:** 42 pass / 0 fail
- **Community:** 3 pass / 0 fail
- **DeepLink:** 1 pass / 0 fail
- **Demo:** 8 pass / 0 fail
- **Edge:** 17 pass / 0 fail
- **Escalation:** 6 pass / 0 fail
- **Feedback:** 7 pass / 0 fail
- **ImageSafety:** 8 pass / 0 fail
- **Legal:** 6 pass / 0 fail
- **Load:** 5 pass / 0 fail
- **Map:** 5 pass / 0 fail
- **MultiCity:** 10 pass / 0 fail
- **NGO:** 10 pass / 0 fail
- **Negative:** 8 pass / 0 fail
- **PWA:** 8 pass / 0 fail
- **Partner:** 1 pass / 0 fail
- **Persona:** 1 pass / 0 fail
- **Pledge:** 1 pass / 0 fail
- **Profile:** 4 pass / 0 fail
- **Referral:** 4 pass / 0 fail
- **Report:** 15 pass / 0 fail
- **Share:** 1 pass / 0 fail
- **Storage:** 2 pass / 0 fail
- **Sync:** 1 pass / 0 fail
- **UI:** 25 pass / 0 fail
- **Viral:** 4 pass / 0 fail
- **Volunteer:** 7 pass / 0 fail
- **Ward:** 8 pass / 0 fail
- **i18n:** 6 pass / 0 fail

## Failures

_None_

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
| C34 | Citizen | Pune hides BMC partner card | PASS |  |
| C34b | Citizen | Pune blocks BMC admin modal | PASS |  |
| C34c | Citizen | Pune community subtitle uses PMC | PASS |  |
| C10-hi | Citizen | Language switch HI | PASS |  |
| C10-mr | Citizen | Language switch MR | PASS |  |
| C10-gu | Citizen | Language switch GU | PASS |  |
| C10-en | Citizen | Language switch EN | PASS |  |
| C14 | Citizen | Report blocked without photo | PASS |  |
| C15 | Citizen | GPS denied blocks submit | PASS |  |
| C16 | Citizen | Report submit success modal | PASS | rid=None |
| C17 | Citizen | Success modal WhatsApp + File BMC | PASS |  |
| C17b | Citizen | Native share button feature-detect gating | PASS |  |
| C18 | Citizen | App origin for deep links | PASS |  |
| C19b | Citizen | PWA nudge after first report | PASS |  |
| C19 | Citizen | Map shows markers after report | PASS | markers=2 |
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
| L02 | Load | 200 reports refresh under 3s | PASS | 0.01s |
| L03 | Load | 50x loadReports parse under 500ms | PASS | 9ms |
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
| X28 | Celebration | Success celebrate element present | PASS |  |
| V40 | Viral | Referral welcome banner present + hidden by default | PASS |  |
| V41 | Viral | Seasonal hook element present in community | PASS |  |
| V42 | Viral | Ward weekly social proof line populated | PASS |  |
| V43 | Viral | Weekly recap share shown when recent reports | PASS |  |
| MC01 | MultiCity | Thane community subtitle uses TMC | PASS |  |
| MC02 | MultiCity | Thane blocks BMC admin modal | PASS |  |
| MC03 | MultiCity | Thane user city persisted | PASS |  |
| MC04 | MultiCity | Thane partner portal hides BMC card | PASS |  |
| MC05 | MultiCity | Pune user city persisted | PASS |  |
| MC06 | MultiCity | Pune datalist linked on pledge | PASS |  |
| MC07 | MultiCity | Mumbai datalist linked on pledge | PASS |  |
| MC08 | MultiCity | City picker has 3 options | PASS |  |
| MC09 | MultiCity | Thane GPS ward detect | PASS | TMC Ward 32 — Patlipada |
| MC10 | MultiCity | Pune GPS ward detect | PASS | Ward 25 — Bavdhan |
| D01 | Demo | Tour mode skips ToS | PASS |  |
| D02 | Demo | Tour mode seeds ward | PASS |  |
| D03 | Demo | Tour mode sets tosAccepted | PASS |  |
| D04 | Demo | Tour mode coach dismissed | PASS |  |
| D05 | Demo | startDemoTour exported | PASS |  |
| D06 | Demo | Persona mode skips ToS | PASS |  |
| D07 | Demo | Persona mode map visible | PASS |  |
| D08 | Demo | Persona startPersonaDemo exported | PASS |  |
| RF01 | Referral | Ref param shows welcome banner | PASS |  |
| RF02 | Referral | Ref dismiss hides banner | PASS |  |
| RF03 | Referral | Ref dismiss sets seen flag | PASS |  |
| RF04 | Referral | Ref hidden in demo tour | PASS |  |
| AN01 | Analytics | Analytics checkbox separate from ToS | PASS |  |
| AN02 | Analytics | Analytics unchecked by default | PASS |  |
| AN03 | Analytics | Analytics consent false when not opted in | PASS |  |
| AN04 | Analytics | Analytics consent true when opted in | PASS |  |
| AN05 | Analytics | CivicAnalytics module present | PASS |  |
| U01 | UI | Language overlay opens | PASS |  |
| U02 | UI | Language overlay closes | PASS |  |
| U03 | UI | About modal opens | PASS |  |
| U04 | UI | About modal closes | PASS |  |
| U05 | UI | Volunteer modal opens | PASS |  |
| U06 | UI | Volunteer modal closes | PASS |  |
| U10 | UI | Map nav tab active default | PASS |  |
| U07 | UI | Report modal closes | PASS |  |
| U08 | UI | Community modal closes | PASS |  |
| U09 | UI | Profile modal closes | PASS |  |
| U11 | UI | Community nav opens modal | PASS |  |
| U12 | UI | Profile nav opens modal | PASS |  |
| U13 | UI | Map nav closes modals | PASS |  |
| U21 | UI | Community close btn returns to Map | PASS |  |
| U22 | UI | Profile close btn returns to Map | PASS |  |
| U23 | UI | Community backdrop tap returns to Map | PASS |  |
| SH01 | Share | EN share single-language (no Marathi hook) | PASS |  |
| U14 | UI | Location banner element | PASS |  |
| U15 | UI | Header context element | PASS |  |
| U16 | UI | Persona bar present | PASS |  |
| U17 | UI | Partner inquiry exported | PASS |  |
| U18 | UI | PWA nudge dismiss button | PASS |  |
| U19 | UI | PWA nudge dismiss hides | PASS |  |
| U20 | UI | Flow steps in report modal | PASS |  |
| RP01 | Report | Only one live hazard tile | PASS | live=1 |
| RP02 | Report | Coming-soon hazard tiles exist | PASS | soon=3 |
| RP03 | Report | Stagnant-water preselected | PASS |  |
| RP04 | Report | Photo input accepts images | PASS |  |
| RP05 | Report | Capture photo button present | PASS |  |
| RP06 | Report | Close without submit saves nothing | PASS |  |
| RP07 | Report | Report stored in localStorage | PASS |  |
| RP08 | Report | Success overlay has celebrate el | PASS |  |
| RP09 | Report | Near-duplicate triggers Me too | PASS |  |
| RP10 | Report | Report notes maxlength enforced | PASS |  |
| RP11 | Report | Photo accept stays on submit step | PASS |  |
| RP12 | Report | Popstate+Map tap during photo keeps report open | PASS |  |
| VOL01 | Volunteer | Blocked without neighbourhood | PASS |  |
| VOL02 | Volunteer | Blocked without skills | PASS |  |
| VOL03 | Volunteer | Signup saved with valid data | PASS |  |
| VOL04 | Volunteer | Hours picker present | PASS |  |
| VOL05 | Volunteer | Remove signup button in profile | PASS |  |
| VOL06 | Volunteer | Blocked without ward | PASS |  |
| NEG01 | Negative | Empty admin login rejected | PASS |  |
| NEG02 | Negative | Empty lead login rejected | PASS |  |
| NEG03 | Negative | Pledge empty ward rejected | PASS |  |
| NEG04 | Negative | Empty complaint ID rejected | PASS |  |
| NEG05 | Negative | GPS denied shows manual ward option | PASS |  |
| NEG06 | Negative | Outside service area ward detect graceful | PASS |  |
| NEG07 | Negative | Invalid city reset to default | PASS |  |
| NEG08 | Negative | Coming-soon hazard not selectable | PASS |  |
| AD01 | Admin | Queue list renders items | PASS |  |
| AD02 | Admin | Queue filter element | PASS |  |
| AD03 | Admin | Queue sort element | PASS |  |
| AD04 | Admin | Admin health corroborations stat | PASS |  |
| AD05 | Admin | Admin queue closes | PASS |  |
| AD06 | Admin | Exit admin via persona bar | PASS |  |
| WD01 | Ward | CivicWardDetect module exported | PASS |  |
| WD02 | Ward | CivicWardData mumbai loaded | PASS |  |
| WD03 | Ward | CivicWardData pune loaded | PASS |  |
| WD04 | Ward | CivicWardData thane loaded | PASS |  |
| WD05 | Ward | Ward lookup returns name | PASS |  |
| WD06 | Ward | Service area check works | PASS |  |
| WD07 | Ward | Outside service area detected | PASS |  |
| WD08 | Ward | Three city datalists in DOM | PASS |  |
| I01 | i18n | FAB label non-English (hi) | PASS |  |
| I02 | i18n | FAB label non-English (mr) | PASS |  |
| I03 | i18n | FAB label non-English (gu) | PASS |  |
| I04 | i18n | Lang button shows EN code | PASS |  |
| I05 | i18n | Header context translated | PASS |  |
| SW01 | PWA | CIVICRADAR_CONFIG loaded | PASS |  |
| SW02 | PWA | Config has cities object | PASS |  |
| SW03 | PWA | Manifest href valid | PASS |  |
| SW04 | PWA | Theme color meta | PASS |  |
| SW05 | PWA | App icons linked | PASS |  |
| SW06 | PWA | SW precache uses scope-relative paths (subpath-safe) | PASS |  |
| ML01 | Auth | Official lead auth visible when connected | PASS |  |
| ML02 | Auth | Send button says sign-in link | PASS |  |
| ML03 | Auth | Link instructions hidden before send | PASS |  |
| ML04 | Auth | OTP fallback hidden before send | PASS |  |
| ML05 | Auth | OTP input collapsed by default | PASS |  |
| ML06 | Auth | publicUrl configured for redirect | PASS |  |
| ML07 | Auth | Link instructions shown after send | PASS |  |
| ML08 | Auth | OTP fallback shown after send | PASS |  |
| ML09 | Auth | Auth errors never show raw {} | PASS |  |
| AU01 | Auth | BMC OTP verify accepts admin super-admin role | PASS |  |
| LG01 | Legal | Privacy page loads | PASS |  |
| LG02 | Legal | Privacy mentions DPDP | PASS |  |
| LG03 | Legal | Terms page loads | PASS |  |
| LG04 | Legal | Terms mentions not government | PASS |  |
| HF01 | Map | Hidden report excluded from count | PASS |  |
| CL01 | Celebration | Success modal open after report | PASS |  |
| CL02 | Celebration | WhatsApp share btn present | PASS |  |
| CL03 | Celebration | File BMC btn present | PASS |  |
| CL04 | Celebration | Success close btn present | PASS |  |
| IS01 | ImageSafety | Submit blocked without relevance confirm | PASS |  |
| IS02 | ImageSafety | Confirm prompt toast shown | PASS |  |
| IS03 | ImageSafety | Confirm checkbox clears inline error | PASS |  |
| IS04 | ImageSafety | Submit succeeds after relevance confirm | PASS |  |
| IS05 | ImageSafety | Affirmation resets on modal reopen | PASS |  |
| IS05b | ImageSafety | Confirm group hidden with no photo | PASS |  |
| IS06 | ImageSafety | Admin proof accepted when scan passes | PASS |  |
| IS07 | ImageSafety | Admin proof blocked when scan fails (blank) | PASS |  |
| FB01 | Feedback | Feedback entry points present (Profile + About) | PASS |  |
| FB02 | Feedback | Feedback modal opens from menu | PASS |  |
| FB03 | Feedback | Empty message blocked with inline error | PASS |  |
| FB04 | Feedback | Category (Bug/Idea/Other) selectable | PASS |  |
| FB05 | Feedback | Local submit stores feedback + closes modal | PASS |  |
| FB06 | Feedback | Submit shows success/saved toast | PASS |  |
| FB07 | Feedback | Feedback strings render (i18n, no key leak) | PASS |  |
| AR01 | Access | Request entry points present (Profile + Partner) | PASS |  |
| AR02 | Access | Request modal opens with explainer | PASS |  |
| AR03 | Access | Empty name blocked with inline error | PASS |  |
| AR04 | Access | Contact required (email or phone) | PASS |  |
| AR05 | Access | Low-friction NGO submit (name+email) confirms + stores | PASS |  |
| AR06 | Access | Access strings render (i18n, no key leak) | PASS |  |
| AR07 | Access | Admin review lists pending request | PASS |  |
| AR08 | Access | Approve issues claim code | PASS |  |
| AR09 | Access | Reject marks request rejected | PASS |  |
| AR10 | Access | Claim code unlocks NGO coordinator role | PASS |  |
| AR11 | Access | Invalid claim code rejected | PASS |  |
| AR12 | Access | Phone-only confirm uses contact-neutral copy | PASS |  |
