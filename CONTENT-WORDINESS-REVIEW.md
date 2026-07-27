# CivicRadar — full-app content/wordiness editorial review

Report only, no code changed. Scope: every page, form, and warning/error
message in the app — onboarding, report flow, escalation modal, toasts,
forms, and the five legal/static pages. Builds on but doesn't repeat
[CONTENT-AUDIT.md](CONTENT-AUDIT.md) (tab-level redundancy) and
[MESSAGING-AUDIT.md](MESSAGING-AUDIT.md) (toast/banner pattern consistency)
— this pass is string-by-string wordiness across the whole app.

Editorial standard applied throughout: active voice, no hedging
("please"/"kindly"), state-what-happened-then-what-to-do for errors, cut
facts already stated elsewhere on the same screen. Legal pages get a
different bar — necessary legal repetition (e.g. restating a right in the
section that governs it) is fine; the findings below are places where the
*same sentence* reappears with no legal reason to.

Good news up front: onboarding copy (`onboard.subtitle`, `.cityHint`,
`.gpsDisclosure`, `.wardHint`) and the report-flow geo-explainer
(`report.geoExplainerBody`) are already tight from earlier rounds — no new
findings there. Auth error toasts (`toast.codeInvalid`, `.linkExpired`,
`.bmcUnauthorized`, `.authEmailInvalid`, etc.) are also already well-edited.
`delete-account.html` and `child-safety-standards.html` are clean —
sequential numbered steps, no repeated sentences — no findings for either.

---

## 1. Legal & static pages

### 1a. `terms.html` — disclaimer restated within 10 lines of itself

The page opens with a disclaimer box:

> **Not an official municipal app.** CivicRadar is an independent community
> tool. It is not affiliated with, endorsed by, or operated by BMC/MCGM,
> PMC, TMC, or any government agency. Filing with your local corporation
> (BMC 1916/MyBMC, PMC CARE, TMC portal, etc.) is your responsibility;
> CivicRadar maps and tracks community reports only.

Three lines later, the **Operator** section says:

> CivicRadar is operated by the project maintainers as an independent
> community tool — not an official municipal or government product (see
> disclaimer above).

The "(see disclaimer above)" is the tell — the section is aware it's
repeating itself. **Fix:** cut the restatement, keep only the operator
contact info: *"CivicRadar is operated by the project maintainers. For
legal notices, data requests, or Terms questions, contact us at
civicradarnh@gmail.com."*

### 1b. `privacy.html` — same disclaimer-echo pattern, plus two real duplications

Same structural issue as terms.html: the opening disclaimer says *"We
deep-link to official corporation channels; we do not submit complaints on
your behalf,"* and Section 11 (Government information sources) says almost
the same thing again: *"We do not publish government data as authoritative,
operate any government system, or file complaints on your behalf."* The
second half of that sentence is pure repetition — trim Section 11 to just
the new information: *"CivicRadar references official municipal and state
channels (BMC/MCGM, PMC, TMC, Aaple Sarkar, Swachhata) for your convenience
and does not publish government data as authoritative. Verified source URLs
are listed on our Official Government Sources page."*

**Consent-withdrawal mechanics, stated in full twice.** Section 4 says:

> You may withdraw consent for GPS in device settings or via Profile →
> Withdraw location consent; for analytics via Profile → Withdraw analytics
> consent; or erase all data via Profile → Delete my data.

Section 12 ("Your rights") then re-lists the identical three menu paths as
bullets:

> - **Profile → Delete my data** — permanent erasure of your reports,
>   pledges, volunteer signup, confirmations, and session analytics.
> - **Profile → Withdraw analytics consent** — stops new analytics; clears
>   local analytics buffer.
> - **Profile → Withdraw location consent** — stops GPS collection until
>   you re-enable.

These are 8 section-headings apart and say the same thing. **Fix:** Section
4 should state the *legal basis* (consent categories) without repeating the
menu paths — cut its trailing clause to *"Consent is collected separately
where required — Terms acceptance, GPS enablement, and analytics are not
bundled into a single mandatory checkbox. You can withdraw or erase any of
this from Profile (see Your Rights, below)."* — then Section 12 stays the
single canonical place the actual menu paths are listed.

**A 4-sentence paragraph disguised as one bullet point**, with "India"
repeated three times in three different senses:

> **Supabase** (when configured) — cloud database for report/pledge/
> volunteer records and analytics, plus a separate object storage bucket
> for hazard photos (see below). Our backend is hosted in the **Mumbai
> (ap-south-1) region in India**, so your data is primarily stored on
> servers **in India**. Supabase Inc. is a United States company acting as
> our data processor. Because project maintainers may administer the
> service **from outside India**, some processing involves cross-border
> transfer under the DPDP Act — we rely on your consent and on our contract
> with the processor for this.

This is legally substantive content (DPDP cross-border disclosure), so
nothing should be cut for brevity's sake — but it reads as a wall of prose
crammed into a `<li>` next to three one-line sibling bullets ("On your
device," "Third-party CDNs"). **Fix:** promote it out of the bullet list
into its own short paragraph or sub-heading ("Cross-border data transfer")
directly under the list — same words, just not squeezed into list-item
formatting that implies it should be one line like its neighbors.

### 1c. `official-sources.html` — a 3-bullet list that's really 1.5 points

> - **Community map** — user-generated reports visible to neighbours
>   (separate from any government system).
> - **Official filing** — when you choose, use the verified links below to
>   open BMC, PMC, TMC, or state portals and file there yourself.
> - **No automatic filing** — CivicRadar never sends your report to a
>   corporation without you opening an official channel.

Bullets 2 and 3 are the same fact from two angles ("you file it yourself" /
"we never file it for you"). **Fix:** merge into two bullets: *"Community
map"* (unchanged) and *"Official filing — when you choose, use the verified
links below to file yourself; CivicRadar never sends your report to a
corporation automatically."*

### 1d. About modal — static HTML fallback has drifted from the tightened `about.*` strings

`index.html`'s `#aboutOverlay` markup carries hardcoded fallback text in
each `data-i18n` element, shown until JS replaces it. Three of these no
longer match the (already-tightened) English strings in `app.js`:

| Key | Static HTML fallback (`index.html`) | Current `app.js` string |
|---|---|---|
| `about.feature1` | "Report hazards with a photo pin — stagnant water, garbage, potholes, or broken streetlights" | "Report hazards with a photo pin — water, garbage, potholes, streetlights" |
| `about.feature3` | "Get help filing with BMC, PMC, or TMC when you choose — after pinning on CivicRadar" | "Optional help filing with BMC, PMC, or TMC after you pin" |
| `about.audience` | "Residents, RWAs, and neighbourhood groups in Mumbai, Pune, and Thane — especially during monsoon when stagnant water and blocked drains matter most." | "Residents, RWAs, and neighbourhood groups in Mumbai, Pune, and Thane." |

This is a sync issue, not a wording issue — someone tightened the i18n
strings in a later pass and didn't update the HTML fallback that ships
alongside it. Notably, the `app.js` version of `about.audience` also
already dropped the monsoon-only framing, consistent with this project's
own "multi-hazard, not monsoon-only" principle (CLAUDE.md) — the stale HTML
fallback is the one out of step with that principle, not the other way
round. **Fix:** copy the three current `app.js` strings into the matching
`data-i18n` elements in `index.html` so the pre-JS fallback and the live
string never diverge again.

---

## 2. Escalation modal ("File with BMC/PMC/TMC") — cross-city audit

The modal's three city variants (`esc.*` / `esc.pmc.*` / `esc.tmc.*`) share
a lot of near-identical copy that was written independently per city
instead of templated once. Two of these are outright bugs, not just
wordiness — flagged first.

### 2a. Bug: Thane silently loses its "not an official channel" disclaimer

Mumbai (`esc.subtitle`) and Pune (`esc.pmc.subtitle`) both show: *"...it
starts the official clock. This is not a {corp} channel."* **No
`esc.tmc.subtitle` key exists** — the code falls through to the generic
`esc.corpSubtitle`, which drops that last sentence entirely. A Thane user
never sees the disclaimer that Mumbai and Pune users both get. **Fix:** add
`esc.tmc.subtitle` mirroring the BMC/PMC pattern.

### 2b. Bug: Thane's "Department contacts" hint is hardcoded to stagnant water

`esc.tmc.deptHint`: *"For stagnant-water follow-ups — Water, Health, or
Pollution Control."* This renders unconditionally regardless of hazard
type — a Thane user following up on a pothole or streetlight report sees a
panel that describes itself as being for stagnant water only. This directly
contradicts this project's own multi-hazard principle. **Fix:** either make
it hazard-generic (*"Follow-up contacts — Water, Health, or Pollution
Control."*) or give it per-hazard variants like `esc.tmc.fileHint.*` already
has.

### 2c. Six strings that are byte-identical except for the city name

These should be one templated string each (`{corp}` param), not three
independent translations that happen to say the same thing:

| Key family | BMC | PMC | TMC |
|---|---|---|---|
| `filedNote` | "Filed with BMC — escalation steps unlock as deadlines pass." | "...with PMC..." | "...with TMC..." |
| `daysSince` | "{n} days since you filed with BMC" | "...PMC" | "...TMC" |
| `selfTitle` | "BMC fixed it?" | "PMC fixed it?" | "TMC fixed it?" |
| `selfBody` | "Confirm yourself once BMC fixes it (your complaint number is proof). Turns the pin green for everyone." | same, PMC | same, TMC |
| `consentRequired` | "Confirm you filed on an official BMC channel before saving." | same, PMC | same, TMC |
| `complaintWarn` | "This doesn't look like a typical BMC number — you can still save if it's correct." | "...PMC reference..." | "...TMC reference..." |

**Fix:** collapse each family to one templated string with `{corp}` (and,
for `complaintWarn`, a second `{term}` param for "number" vs "reference").
Zero behavior change, six fewer strings to keep in sync per language.

Separately, `complaintWarn`'s own phrasing hedges more than a non-blocking
warning needs: *"...you can still save if it's correct"* → tighten to
*"...save anyway if it's correct."*

### 2d. Recommended-channel line — TMC breaks its own template

BMC/PMC: *"Recommended: {channel} — fastest for most {city} wards."* TMC
instead inlines a phone number that's already shown on the channel button
itself: *"Recommended: file on thanecity.gov.in or call TMC helpline
022-25331590."* **Fix:** *"Recommended: TMC portal — fastest for most Thane
wards."*

### 2e. Per-hazard file-hint — PMC repeats a fact already stated one line above

PMC's four hazard variants all end with "...go through PMC CARE" even
though `esc.pmc.recommended` (shown immediately above) already named PMC
CARE as the one channel. TMC's equivalent strings already dropped this
(*"Stagnant water / mosquito breeding — start with the recommended channel,
or open more ways below."*) — apply the same cut to PMC's four variants.

### 2f. Tier-1 "File" body — PMC/TMC re-list channels already shown as buttons

- BMC (tightest): *"Free. Routed to your ward's Pest Control Officer. Use
  any channel above, then save the complaint number here so the real clock
  starts."*
- PMC (current): *"Free. File on PMC CARE portal, WhatsApp, toll-free 1800
  1030 222, or the PMC CARE app. Save your reference number here."*
- TMC (current): *"File on thanecity.gov.in, call 022-25331590 /
  022-25331211, email mc@thanecity.gov.in, or use Citizen Call Center
  155300. Save your reference number here."*

Both re-list every channel and phone number that's already rendered as
buttons directly above this text, and TMC additionally drops the "Free."
trust signal the other two lead with. **Fix both to:** *"Free. Use any
channel above, then save your reference number here so the official clock
starts."* This also avoids hardcoding phone numbers/URLs in copy that goes
stale the moment `corp.helplines` config changes.

### 2g. Smaller, same-pattern items (batch these together — same fix each)

- **"Copied" toast** — TMC's *"Copied — paste when you file with TMC"* is
  tighter than BMC/PMC's channel re-lists (*"...paste when you file on
  MyBMC, WhatsApp, or the portal"*). Bring BMC/PMC down to TMC's pattern.
- **Complaint-number field label** — BMC is the unbranded outlier
  ("Complaint number" vs. PMC/TMC's "{city} complaint / reference number").
  Brand it: "BMC complaint number."
- **Portal navigation hint** — TMC drops "the" ("Paste details below" vs.
  everyone else's "Paste **the** details below"). Trivial, make consistent.
- **"I filed" consent checkbox** — TMC's parenthetical lists "Aaple Sarkar"
  as a filing channel; Aaple Sarkar is actually the Stage-4 grievance
  portal (`esc.tier.grievance.body`) for all three cities, not a
  first-filing channel. Likely a copy-paste slip — remove it from TMC's
  checkbox to match BMC/PMC.
- **Tier-2 body** — TMC splits into two sentences and repeats a phone
  number already on the helpline button. Rewrite to match the shared
  "...quoting your {city} reference number" construction PMC uses.
- **Tier-4 body** — PMC/TMC are template-identical (unify those two). BMC's
  version is missing the "select {corp} as local body" instruction PMC/TMC
  both give, and describes the portal ("Maharashtra state portal") instead
  of giving the actual URL (pgportal.gov.in) — align BMC to match.

### 2h. Adjacent bug worth flagging (same root cause as 2b)

`buildFollowUpText()`'s Mumbai and Thane tier-3 tweet templates hardcode
`#MumbaiMonsoon` / `#ThaneMonsoon` hashtags (`js/app.js:41449`, `:41511`),
appended even to pothole/garbage/streetlight follow-up tweets. Pune's
template has no such hashtag. Same "written stagnant-water-only, other
hazards bolted on later" pattern as 2b — not a copy-review core item, but
flagging since it shares the root cause.

---

## 3. Toasts, warnings, and inline errors

### 3a. The hedge word "Please" survives in four places

Every other error message in the app already avoids this per the
established standard — these four are the holdouts:

| Key | Current | Rewrite |
|---|---|---|
| `access.errName` | "Please add your name." | "Add your name." |
| `lead.errName` | "Please add your name." | "Add your name." |
| `feedback.errorEmpty` | "Please write a short message first." | "Write a short message first." |
| `feedback.error` | "Could not send — your text is safe. Please try again." | "Could not send — your text is safe. Try again." |

### 3b. `moderation.blocked.irrelevant` inverts the app's own error pattern

Every sibling `moderation.blocked.*` message states the failure first, then
the fix. This one leads with the instruction: *"Use a photo of the hazard —
not a selfie, document, or blank image."* **Rewrite:** *"That doesn't look
like a hazard photo — retake it showing the hazard, not a selfie or
document."*

### 3c. GPS/location messages

- `toast.gpsOutsideCity`: *"Location is outside your selected city. Move
  the pin inside city limits or update your city in Profile."* (18 words) →
  *"Location is outside your city — drag the pin inside city limits, or
  change your city in Profile."*
- `onboard.outOfBounds`: *"CivicRadar currently serves Mumbai, Pune, and
  Thane only. Please select one of these cities manually to explore."* (17
  words, contains "Please") → *"CivicRadar covers Mumbai, Pune, and Thane.
  Select one to explore."*

### 3d. Redundant callbacks / restated context

- `toast.hoursVerifiedOther`: *"Hours verified for {name}. +{points} Civic
  Points credited **to them**."* — "to them" repeats the subject already
  named. → *"Hours verified for {name} — +{points} Civic Points credited."*
- `toast.pledgeSaved`: *"Pledge recorded — your ward coordinator will see
  it **in their hub**."* — internal jargon the citizen doesn't need. →
  *"Pledge recorded — your ward coordinator will see it."*
- `toast.cleanupLogged`: *"Community cleanup logged. BMC complaint stays
  open until **officially** resolved."* — "officially" is filler. →
  *"Community cleanup logged — BMC complaint stays open until resolved."*
- `esc.complaintWarn` (see 2c) — same fix applies to all three city
  variants.

---

## 4. Form modal copy

### 4a. Hint text repeating its own field's label (recurring pattern — check for more instances)

This exact shape shows up three separate times, unprompted, suggesting it's
worth a dedicated pass beyond these three:

- `volunteer.contactHint`: *"**Optional** — shared with your coordinator
  only if you enter it. Never auto-called."* — field label is already
  `Phone / WhatsApp (optional)`. → *"Shared with your coordinator, never
  auto-called."*
- `volunteer.neighbourhoodHintCustom` / `lead.neighbourhoodHintCustom`:
  *"Type your neighbourhood, society, or lane if not listed."* — restates
  the field's own label (`Neighbourhood / society / lane`). → *"Not
  listed? Type it in."*
- `feedback.privacy`: *"We never share your contact. Used only to reply to
  this feedback."* — second sentence repeats the field label directly
  above it (`Contact (optional — only if you want a reply)`). → *"We never
  share your contact."*

### 4b. The 2-vs-5 lead-nomination rule, explained twice, both times wordy

`lead.confirmBody` and `lead.communityHint` independently state the same
"2 supports unlock the role, 5 if there's a rival candidate" rule, on two
different screens, both in soft two-sentence form:

- `lead.confirmBody`: *"Share CivicRadar with neighbours — 2 supports
  unlock coordinator tools. If someone else runs too, you both need 5."* →
  *"Share CivicRadar with neighbours — you need 2 supports (5 if there's a
  rival candidate)."*
- `lead.communityHint`: *"Support neighbours who volunteer to coordinate
  cleanups. 2 supports grants the role; 5 each if multiple candidates."* →
  *"Support a neighbour coordinating cleanups — 2 backers grant the role
  (5 if there's competition)."*

Tighten both independently; longer-term, one canonical short phrasing would
serve both screens instead of two independently-drifting explanations of
the same rule.

### 4c. Longest cuttable string in the app

`access.confirmBody`: *"Thanks! We will review and reach you with a claim
code, usually within a few days. Enter it in the app to unlock access."*
(24 words) — "Thanks!" is a filler opener, "usually" hedges a stated
timeline without adding value. → *"We'll review your request and send a
claim code within a few days. Enter it in the app to unlock access."*
(18 words, same two facts: timeline + next action.)

### 4d. Smaller cuts

- `volunteer.ageNote`: *"18+ required. Under-18? Only with a
  parent/guardian or school NSS coordinator who accepts Terms."* — "18+
  required" repeats the adjacent toggle label `Age requirement (18+)`. →
  *"Under 18? Needs a parent, guardian, or NSS coordinator to accept
  Terms."*
- `access.contactHint`: *"Give at least one. Claim codes go to email;
  phone-only means we contact you there."* → *"Give at least one — codes
  go to email, or we'll call if phone-only."*
- `feedback.subtitle`: *"Found a bug or have an idea? Tell us — it goes
  straight to the team."* — trailing clause is reassurance filler. →
  *"Found a bug or have an idea? Tell us."*
- `inquiry.coordBody`: opens with *"Lead your RWA/society or ward NGO —"*,
  which just restates `inquiry.coordTitle`'s "ward or neighbourhood
  coordinator" in different words. → drop the opening clause, start
  directly at *"See volunteers, match cleanup offers, verify pledge
  hours. Request an invite code from the operator."*
- `inquiry.subtitle`: *"Reach citizens in Mumbai, Pune, or Thane — in the
  wards that matter to you."* — trailing clause is vague marketing filler.
  → *"Reach citizens in Mumbai, Pune, or Thane, ward by ward."*

Pledge support (`pledge.notice`, `pledge.messagePh`) and the language
picker are already tight — no findings.

---

## 5. Report-flow camera disclosure — partial rollout of an earlier fix

Two issues found by direct spot-check, not covered by the agents above:

**5a. Stale "EXIF" jargon survives in one string but was already fixed in its siblings.**
`report.cameraDisclosureBody` still reads: *"Camera is only for hazard
evidence. Photos show on the community map. **EXIF location is stripped
on-device.** Avoid faces and documents."* Meanwhile the parallel
`report.geoExplainerBody` and `report.captureExifHint` were already
rewritten in plain language ("Location data is removed from photos
automatically"). This one string got missed in that pass. **Fix:** *"Camera
is only for hazard evidence. Photos show on the community map — location
data is removed automatically. Avoid faces and documents."*

The same stale phrase also appears in the About modal's `about.privacyNote`
("EXIF location is stripped before upload") — same fix applies there for
consistency, though it's lower priority since it's a one-time modal rather
than a per-report flow string.

**5b. Two camera-disclosure bullets now say near-duplicate things, and the
"never sold" reassurance implied by a key name has quietly disappeared.**

```
report.cameraDisclosure.verify:  'Used only to verify this hazard'
report.cameraDisclosure.noSell:  'Used only for this hazard report'
```

These read as the same sentence twice. The key name `noSell` implies this
slot should carry a distinct "never sold / no marketing use" reassurance —
that message isn't present anywhere else in the four-bullet disclosure
(`.verify`, `.visible`, `.location`, `.noSell`). **Fix:** give `.noSell` its
own content: *"Never sold or used for marketing."*

---

## Priority / effort summary

| Item | Type | Effort | Why it matters |
|---|---|---|---|
| 2a. Thane escalation subtitle missing | Bug | XS | Thane users silently lose a disclaimer Mumbai/Pune both get |
| 2b. Thane `deptHint` hardcoded to stagnant water | Bug | XS | Contradicts app's own multi-hazard principle |
| 5b. `.noSell` duplicates `.verify` | Bug-adjacent | XS | Named reassurance ("never sold") is missing from the disclosure |
| 5a. Stale "EXIF" jargon in `cameraDisclosureBody` | Consistency | XS | Sibling strings already fixed; this one was missed |
| 1d. About-modal HTML fallback vs. `app.js` drift | Consistency | XS | Pre-JS fallback text is out of sync with tightened strings |
| 2c. Unify 6 city-identical escalation strings | De-dup | S | Zero behavior change, removes per-language drift risk |
| 3a. Drop "Please" from 4 field errors | Wordiness | XS | Last holdouts of an otherwise-consistent no-hedge standard |
| 2f. Tighten PMC/TMC tier-1 "File" body | Wordiness | S | Re-lists channels already shown as buttons; hardcodes numbers that will go stale |
| 1b. Privacy — consent-withdrawal stated twice | Wordiness | S | Same 3 menu paths, 8 sections apart |
| 4a. Hint-repeats-label pattern (3 instances) | Wordiness | S | Recurring shape — worth a wider pass |
| 4c. `access.confirmBody` | Wordiness | XS | Longest single cuttable string in the app (24→18 words) |
| 4b. Lead-nomination rule explained twice | Wordiness | S | Same rule, two screens, both wordy |
| 1a/1c. Terms/official-sources disclaimer echoes | Wordiness | XS | Legally fine to restate briefly; current versions over-restate |
| 2d/2e/2g. Remaining escalation-copy smaller items | Wordiness | S | Batch together — same city-template fix pattern |
| 3b/3c/3d. Remaining toast tightening | Wordiness | XS each | Small, independent, no shared risk |
| 4d. Remaining form-copy cuts | Wordiness | XS each | Small, independent, no shared risk |

Nothing here requires a structural rework — the app's copy is already
disciplined in most places (auth errors, onboarding, geo-explainer). The
findings cluster into three repeatable patterns worth watching for
elsewhere: **(1)** per-city strings written independently instead of
templated, so cross-city drift creeps in silently (2a, 2b are real bugs
from this); **(2)** hint text quietly restating its own field's label
(4a); **(3)** a copy-tightening pass that fixed some sibling strings but
missed one (5a, 1d).
