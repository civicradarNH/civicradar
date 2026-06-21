# CivicRadar Test Results

**Run:** 2026-06-21 19:49:58
**Server:** http://localhost:8095/
**Script:** `tests/e2e_comprehensive.py`
**Total:** 96 | **Pass:** 95 | **Fail:** 1

## Fixes applied this run

- `js/app.js`: `loadUser()` clears invalid/corrupt ward values on load
- `js/app.js`: `openAdminReportModal()` string-safe id match
- `js/app.js`: `handleReportDeepLink()` toast for missing report (`toast.reportNotFound`)
- `js/app.js`: `getModCfg()` reads moderation config live at submit time
- `js/app.js`: `copyTextSafe()` / improved `fallbackCopy()` for clipboard reliability
- `js/app.js`: `applyTranslations()` calls `updatePersonaUI()` (was broken `renderPersonaBar`)
- `tests/e2e_comprehensive.py`: E09 checks analytics opt-in checkbox (separate from ToS)
- `js/app.js`: `saveComplaintId()` uses city-specific PMC/TMC complaint warn toast
- `sw.js`: cache bump v44 → v45

## Summary by category

- **API:** 5 pass / 0 fail
- **Admin:** 2 pass / 0 fail
- **Citizen:** 37 pass / 0 fail
- **Community:** 3 pass / 0 fail
- **DeepLink:** 1 pass / 0 fail
- **Edge:** 16 pass / 0 fail
- **Escalation:** 1 pass / 0 fail
- **Legal:** 2 pass / 0 fail
- **Load:** 5 pass / 0 fail
- **Map:** 4 pass / 0 fail
- **NGO:** 2 pass / 0 fail
- **PWA:** 2 pass / 0 fail
- **Partner:** 1 pass / 0 fail
- **Persona:** 1 pass / 0 fail
- **Profile:** 4 pass / 0 fail
- **Report:** 3 pass / 0 fail
- **Storage:** 2 pass / 0 fail
- **Sync:** 1 pass / 0 fail
- **System:** 0 pass / 1 fail
- **UI:** 2 pass / 0 fail
- **i18n:** 1 pass / 0 fail

## Failures

- `ERR-NGO/Admin` **Suite NGO/Admin crashed** — Page.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator("#btnLeadSubmit")
    - locator resolved to <but

## Limitations

- Supabase backend not configured — cloud sync, OTP auth, and cross-device tests are local-only.
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
| C10-hi | Citizen | Language switch HI | PASS |  |
| C10-mr | Citizen | Language switch MR | PASS |  |
| C10-gu | Citizen | Language switch GU | PASS |  |
| C10-en | Citizen | Language switch EN | PASS |  |
| C14 | Citizen | Report blocked without photo | PASS |  |
| C15 | Citizen | GPS denied blocks submit | PASS |  |
| C16 | Citizen | Report submit success modal | PASS | rid=None |
| C17 | Citizen | Success modal WhatsApp + File BMC | PASS |  |
| C18 | Citizen | App origin for deep links | PASS |  |
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
| ERR-NGO/Admin | System | Suite NGO/Admin crashed | **FAIL** | Page.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator("#btnLeadSubmit")
    - locator resolved to <but |
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
| E16 | Edge | Invalid ward cleared on load | PASS |  |
| L01 | Load | 15 parallel report contexts | PASS | 15/15 |
| L02 | Load | 200 reports refresh under 3s | PASS | 0.01s |
| L03 | Load | 50x loadReports parse under 500ms | PASS | 7ms |
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
