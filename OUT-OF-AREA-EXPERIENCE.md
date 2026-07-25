# CivicRadar — the experience for visitors outside Mumbai, Pune & Thane

Report only. No code was changed. Traces exactly what happens for someone
opening the app from outside the three served cities — e.g. Parsippany, NJ
(≈40.86°N, -74.42°W) — and whether they can explore the app's features without
pretending to be a resident.

---

## Headline finding

**The infrastructure for this already exists and is mostly good — a real
"Explore the map first" path, honest out-of-bounds messaging in onboarding, and
unrestricted tab navigation. There's one concrete, fixable bug: turning on
location *after* exploring silently stops working and pans the map to an empty,
pin-free view of the visitor's real location with no explanation.** Everything
else in this report is a smaller polish item, not a blocker.

---

## The actual flow, step by step (Parsippany, NJ visitor)

**1. ToS modal.** Still mandatory before anything else — but its content ("18+,
accept Terms & Privacy Policy") isn't India-specific, so this isn't really an
out-of-area problem, just the one universal gate everyone passes through
first.

**2. Onboarding modal appears** with three real paths, all already present:
- "Auto-detect my ward" (primary button)
- Manual city (Mumbai/Pune/Thane dropdown — see §2 below) + ward search
- **`#btnOnboardingExplore`, labeled "Explore the map first"** — a ghost-styled
  button already wired to `markExploredMapFirst()` (`js/app.js:31306-31328`),
  which closes onboarding, switches to the Map tab, and **requires no city or
  ward at all.**

**3a. If they tap "Auto-detect my ward" anyway** — GPS resolves to real NJ
coordinates, `isGpsOutsideSupportedCities()` correctly returns true, and
`showOnboardingWardOutOfBounds()` fires: the city dropdown highlights, and
`#wardError` shows *"CivicRadar currently serves Mumbai, Pune, and Thane only.
Please select one of these cities manually to explore."* — honest, clear,
correctly triggered, no crash. This is good, deliberate handling.

**3b. If they tap "Explore the map first" directly (the fast path — no need to
even attempt GPS detect)** — onboarding closes immediately, no ward required.

**4. Map view.** Since `user.city` is never set, `getUserCity()`
(`js/app.js:1302-1306`) falls back to `DEFAULT_CITY` (Mumbai), and
`getCityCenter()` (`js/app.js:1310-1314`) falls back to Mumbai's real
coordinates `[19.076, 72.8777]`. **The map loads centered on real Mumbai, with
real Mumbai pins and hazard data visible** — not a blank map of New Jersey.
This is the right default: a curious visitor sees the app's actual content
immediately.

**5. Other tabs.** `setNavTab()` (`js/app.js:23634`) has no onboarding/ward
gate at all — Community, Resources, and Profile are freely browsable. The
visitor can see the leaderboard, official-channel resources (Mumbai's, by
default), and their own (mostly-empty) profile. **Full feature visibility is
already achieved for passive browsing.**

**6. Tapping "Report."** `openReportModal()` (`js/app.js:27705-27717`) checks
`user.tosAccepted && user.ward` — ToS is accepted, but `user.ward` was never
set (they explored instead of onboarding), so it shows a toast —
`toast.onboardFirst`: *"Complete setup to report hazards."* — and reopens the
onboarding modal. This matches what you asked for (they don't need to be able
to submit) but the copy doesn't explain *why*, and reopening the exact modal
they just dismissed (with the same "Explore the map first" button available to
dismiss it again) can read as circular rather than explanatory. See §3.

**7. The bug — turning on location after exploring.** The map's
`#locationBanner` (*"Turn on location to pin hazards on the map — or place a
pin when reporting."*) is still shown post-explore, since `user.gpsConsent`
was never set either. If the visitor taps "Turn on":

- `requestLocation()` → `applyLocationFromPosition()` (`js/app.js:30209-30281`)
  acquires their real NJ coordinates.
- `applyWardFromCoords()` (`js/app.js:25282-25309`) is called, fails to detect
  a ward (correctly — they're not in a served city), and returns `null`
  **silently** — this function only surfaces the "out of bounds" message when
  the *onboarding modal* is open (`js/app.js:25288`); outside onboarding, on
  the plain map view, there's no equivalent message at all.
- But `applyLocationFromPosition` doesn't stop there — if `recenter` is true
  (which it is for this flow), it still calls `centerMapOnUser(lat, lng, ...)`
  (`js/app.js:30258-30263`, `29561-29567`), which **only validates that the
  coordinates are numerically valid GPS values — not that they're inside the
  service area** — and pans the map straight to the visitor's real location.

**Net effect: the map swoops away from Mumbai's rich, pinned content to an
empty patch of New Jersey (OpenStreetMap tiles render fine everywhere, but
there are zero CivicRadar reports there), with no message telling the visitor
what happened or how to get back.** Their only way back to browsable content
is to know, unprompted, to open Profile → Edit and manually re-select a city —
not something a first-time visitor exploring out of curiosity would think to
do. This is the one concrete regression in an otherwise well-thought-out flow.

---

## Smaller items worth a look

### 1. City selection is a closed list of exactly 3 (Mumbai/Pune/Thane)

Confirmed in both the onboarding city select and the profile-edit city select
(`index.html:483-485`, `1379-1381`) — no "Other / not listed" option. This is
consistent with the app's actual scope (it genuinely only has data for these
three cities) and isn't a bug, but it does mean the only way to "pretend" to be
local is picking one of the three, which the out-of-bounds message already
explicitly invites (*"select one of these cities manually to explore"*) — the
app's own copy already frames this as the intended path, so no change needed
here beyond what's in §3/§4 below.

### 2. `toast.onboardFirst` doesn't explain the "why" for an explorer

*"Complete setup to report hazards."* is fine for someone who dismissed
onboarding by accident and is trying to report for real. For someone who
deliberately chose "Explore the map first" specifically to look around without
committing, tapping Report and getting bounced back into the same modal they
already dismissed can read as broken rather than as an intentional gate.
Consider a slightly more explanatory variant when the visitor arrived via
explore-mode specifically — e.g. acknowledging they're just browsing and that
reporting needs a ward selected (even a placeholder one) to work.

### 3. No distinct "explored, not onboarded" state is exposed to the rest of the app

`hasExploredMapFirst()` (`js/app.js:25233-25235`) exists and is checked in a
few places (suppressing the purpose/coach-mark sheet), but nothing downstream
— the location banner, the persona bar, the map empty-state — currently
tailors its copy for "this person is deliberately just looking around" versus
"this person hasn't gotten to onboarding yet." Both states currently look
identical to every other part of the app. Worth considering whether the
location banner specifically should either (a) not appear at all in
explore-mode, since GPS in explore-mode can't do anything useful for someone
outside the service area, or (b) get a bounds check before offering to turn
on location at all (§4 covers the actual fix).

### 4. The core fix, restated concretely

The one change that would close the loop: give `applyWardFromCoords` (or its
caller) an explicit out-of-bounds branch **outside the onboarding-modal
condition**, mirroring what already exists inside it — e.g. on failure to
detect a ward AND `isGpsOutsideSupportedCities(lat, lng)` is true, show a
plain-map version of the same honest message (*"CivicRadar doesn't have data
for your area yet — here's Mumbai's map to explore."*) and **skip the
`centerMapOnUser` recenter call** so the view stays on whichever city's data
was already showing. This reuses logic and copy that already exists for the
onboarding case — it's a matter of extending where it applies, not inventing
a new pattern.

---

## What's already right — don't touch

- `#btnOnboardingExplore` / `markExploredMapFirst()` — the core "let me just
  look around" escape hatch already exists and works exactly as it should.
- `showOnboardingWardOutOfBounds()` — clear, honest, correctly-triggered
  messaging when GPS is used *during* onboarding and lands outside all three
  cities.
- The Mumbai-default fallback in `getUserCity()`/`getCityCenter()` — means an
  unonboarded visitor sees real, rich app content immediately rather than a
  blank map, which is exactly the "let them see all the features" outcome
  you're asking for.
- `setNavTab()` has no onboarding gate — Community/Resources/Profile are
  already freely browsable without committing to a city or ward.
- Gating the Report flow itself behind a set ward is the correct call, since
  a report needs *some* ward to be filed against, and you've said submission
  doesn't need to work for this audience — no change needed there, just the
  copy nuance in §3.
