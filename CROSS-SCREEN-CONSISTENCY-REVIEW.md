# CivicRadar — cross-screen consistency review

Report only, no code changed. Originally six screens (Profile, Community, the
report success screen, Report flow Capture/Confirm); a follow-up round added
Edit Profile, Resources, two more Community scroll states, and Terms of
Service. §0 below tracks what's since landed against the original findings.

---

## 0. Status update (follow-up screenshots)

**Confirmed fixed:**
- **#6 Leaderboard zero-fixes copy** — now reads "No ward has logged a fix
  yet this week — be the first." Exactly closes the "crowning a zero"
  problem.
- **#7 Illustrated empty states extended** — "Recent wins" now shows the
  same generous treatment as "Community leads" (icon + "Fixed spots show
  here. Report one and rally neighbours." + a direct CTA), instead of being
  the one bare exception.
- **Resources page** (separate report, several turns back) — now shows
  exactly one "Recommended" channel, the other four collapsed behind
  "4 more official channels," and both sections ("File with Corporation" /
  "Help in Your Ward") use the same compact row style. This was fully
  implemented, not partially.

**Correction to #5 (duplicate stats):** the follow-up screenshots show this
was very likely a false alarm on my part — the two earlier screenshots were
just two different scroll positions of one 2×2 stat grid (Reports/Fixed on
top, Me Too/Pledges below), not two separate components. Retracting that
finding; no fix needed.

**Still open:** #1 (Account & Legal isn't in a card like Community Roles),
#2 (icon-color muting not applied to either Profile section). #3 (text-color
rule) may be partially resolved — the latest screenshot shows Terms of
Service, Privacy Policy, and Privacy/grievance contact all in the same blue
link style now, which reads as a real rule ("blue = leaves the app") rather
than three arbitrary treatments; worth confirming that's deliberate and
extending it explicitly rather than leaving it as a coincidence.

---

## New screens (Edit Profile, Terms of Service)

**Edit profile** — clean, no real issues. One minor nit: "Detect with GPS"
sits as a button in the middle of a field stack (Ward → GPS button → Society)
rather than being visually attached to the ward field it acts on — works
fine contextually, just breaks the field-field-field rhythm slightly. Not
worth changing unless you're already touching this screen.

**Terms of Service (terms.html)** — appropriately more sober/document-styled
than the in-app modals, which is correct for a legal page, not an
inconsistency to fix. The "Not an official municipal app" disclaimer being
prominent and explicit here is *correct* — this is the one place that
repetition earned earlier (About modal, escalation modal, volunteer
subtitle) is the authoritative source, not redundant. No changes suggested.

---

---

## What's already landed well — the benchmark to match

Worth saying plainly: several earlier proposals are visibly implemented and
executed faithfully, and the **Report flow is now the most polished, most
internally-consistent screen in the app.** It's the standard the other screens
below should be brought up to, not the other way around:

- The pin-drop success animation, the "+50 Civic Points" single reward line,
  one primary WhatsApp CTA, and a collapsed "More" — matches the slimmed-down
  success-modal design almost exactly. Confetti is a nice, on-brand touch.
- Capture step: "Location data is removed from photos automatically" —
  the jargon-free rewrite of the old "EXIF stripped on-device" line — is live.
- Confirm step: photo thumbnail and hazard chips sit above the fold, the ward
  chip is compact, the pin-adjust section is collapsed rather than dominating
  the screen. This is the layout that was recommended and it reads cleanly.
- Dark map tiles are rendering correctly behind both report screens — the
  earlier CSS specificity fix is holding.
- "Community Roles" on Profile is now a collapsed accordion, matching
  Activity / Notifications & Privacy — the biggest structural fix from the
  last profile review is in place.

---

## 1. Profile: two adjacent sections use two different container styles

**"Community Roles"** renders as a bordered card with a header row and a
chevron (an accordion). **"Account & Legal"**, directly below it, renders as a
plain text label followed by individually-bordered rows with no shared
container. They sit back-to-back on the same screen, doing the same job
(grouped settings/links), styled two different ways.

**Fix:** give "Account & Legal" the same card treatment as "Community Roles"
— a single bordered container wrapping all its rows — even though it should
stay non-collapsible (legal links should remain always-visible, not hidden
behind a tap, per the earlier profile review). Matching containers, different
collapse behavior, is fine; what reads as inconsistent right now is the
container shape itself.

## 2. Icon-color muting was recommended but not applied

The earlier profile mockup proposed muting "Community Roles" and "Account &
Legal" icons to one restrained tone each, so low-priority/rare actions
visually recede rather than compete with primary content. The accordion
collapse landed; the icon-color pass didn't — Community Roles is still
blue/olive/teal/grey, Account & Legal is still indigo/teal/white/red. This is
a small, mechanical, low-risk follow-up now that the container structure is
already in place — worth doing as a quick pass rather than leaving it as the
one recommendation that didn't make the cut.

## 3. Three different text treatments in one list (Account & Legal)

Within the same five-row group: "Terms of Service" and "Privacy Policy" are
styled as blue link-colored text, "Privacy / grievance contact" reads as
plain white text, and "Delete account" reads in red/danger. Three visual
languages for five rows in one list reads as unplanned rather than
deliberately tiered. If the intent is "external links vs. in-app actions vs.
destructive actions," that's a reasonable three-tier system — but it should
be a documented, consistent rule (e.g., always blue for anything that opens
outside the app, always red for anything destructive, plain white for
everything else), not whatever each row happened to inherit.

## 4. "Delete account" subtext undersells what the row does

The row now reads "Delete account" / "How to close your account." That
subtext sounds like it opens a help article, not that tapping the row starts
account deletion. If it's the actual delete action, match the more explicit,
consequence-stating style used for its neighbor ("Delete my data" — describe
what's actually erased, the same way). If it genuinely just links to
instructions rather than triggering deletion directly, that's fine, but then
it shouldn't be styled identically (danger-red) to a row that performs a
destructive action — the styling is currently making a promise the copy
doesn't back up either way.

## 5. Community: the four stats may be rendered twice, two different ways

One scroll position shows "REPORTS / FIXED / ME TOO / PLEDGES" as a row of
pill-style segments near the top, above a ward-leaderboard teaser line.
Another shows the same four labels as a 2×2 stat grid with numbers (2 / 0 /
0 / 0) directly under the ward summary line. If these are the same underlying
metric shown twice in two different visual components depending on scroll
state, that's both redundant and inconsistent — pick one presentation. If
they're actually two different things that happen to share the same four
words (e.g., one is a filter control, the other is a summary), the shared
labels are themselves a source of confusion and should be worded
differently so it's clear at a glance they're not duplicates. Worth
confirming which case this is before deciding the fix.

## 6. Leaderboard teaser line undercuts its own message

"L Ward tops the ward board with 0 fixes — which ward is next?" — bragging
that a ward is "topping the board" with a score of zero reads as deflating
rather than motivating, especially paired with a trophy/energy icon that
implies achievement. This copy needs a guard for the all-zero case, the same
way `impact.week`/`social.wardWeekEmpty` already got a dedicated empty-state
line elsewhere in the app (per the earlier content audit) — a leaderboard
with nothing to show yet should say something like "No ward has logged a fix
yet this week — be the first" rather than crowning a zero as a leader.

## 7. Worth extending: the "Community leads" empty state is genuinely good

The large circular icon + "No candidates yet in your ward — nominate yourself
to get started" + a clear single CTA is a well-designed, generous empty
state — better than a plain line of grey text. This treatment isn't used
consistently elsewhere (e.g., the "Recent wins" section, per screenshot,
appears to just be a bare label with no equivalent illustrated empty state
visible). Worth applying the same pattern to other empty states across
Community and Profile rather than leaving this one section as the exception.

## 8. One thing to verify, not a confirmed bug

The Confirm step shows "Finding your location…" next to "Adjust pin" with
the mini-map still settling. Given the GPS-refine instability just diagnosed
in the main map (repeated panning while a fix hasn't stabilized), it's worth
confirming this specific loading state on the Confirm screen always resolves
promptly and never gets stuck — a hang here would land right before the
Submit button, the worst place in the whole flow for something to stall.

---

## Priority summary

| Item | Effort | Why it matters |
|---|---|---|
| #1 Account & Legal container styling | XS | Two adjacent sections currently look like they came from different screens |
| #2 Icon-color muting (both sections) | XS | Small follow-up to a fix that already landed everywhere else |
| #6 Leaderboard zero-fixes copy | XS | Currently celebrates an empty ward — reads as broken, not encouraging |
| #4 "Delete account" subtext | XS | Ambiguous wording on the highest-stakes row on the page |
| #3 Account & Legal text-color rule | S | Needs a decided rule, not just a fix |
| #5 Duplicate/ambiguous stats presentation | S (needs confirming first) | Possible redundant or confusing metric display |
| #7 Extend illustrated empty states | S | Genuine visual-appeal opportunity, not a fix |
| #8 Confirm-step location hang | Verify only | Ties to the GPS-refine bug already being fixed |

Everything here is small and independently shippable — this is a polish pass
on an already-mostly-consistent app, not a structural rework.
