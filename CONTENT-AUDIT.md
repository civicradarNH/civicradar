# CivicRadar — Content Audit: exact copy fixes

Report only. No code was changed. Every finding below quotes the **exact current
string**, its **i18n key and location**, and an **exact proposed replacement**, so
each fix can be applied mechanically. This covers Profile, Community, and Resources
in depth (the three tabs flagged directly), plus Landing, Onboarding, Report flow,
Success, and the remaining modals for full-app coverage.

> **Translation parity:** every fix below quotes the English (`en:`) string. The
> matching `hi:`/`mr:`/`gu:` blocks in js/app.js use the same key at a fixed offset
> and must be updated in parallel or the four languages will drift out of sync —
> flagged per finding by key so it's a mechanical follow-up, not re-analysis.

---

## The five patterns behind the clutter

Every specific complaint below is an instance of one of these five repeating
mistakes. Naming them once here so the per-screen fixes can just say "Pattern 2"
instead of re-explaining:

1. **Parallel progress trackers.** Profile alone runs three separate "how am I
   doing" systems at once — a Civic Points level, a report-count milestone, and a
   week streak — each with its own line of text. A user experiences this as one
   question ("am I doing okay?"); the screen answers it three times, three ways.
2. **The same number restated in different phrasings.** "75 Civic Points" is not
   information the user needs to read twice in different sentences on one screen.
3. **Every card gets a description line, whether or not it adds anything.** A
   sub-label is only earning its place if it tells you something the title didn't
   ("MoHUA sanitation — ward inspector" adds scope info). "MyBMC WhatsApp" +
   "Quick chat filing" doesn't — the title already says WhatsApp.
4. **Independent nudges that don't know about each other.** The persona bar, the
   seasonal hook, and empty-state copy are each written and triggered in isolation,
   so on a quiet ward you can see three separate "you should report" messages
   stacked before you reach content.
5. **Uppercase labels sized for their happiest case.** "Reports" / "Pledges" in a
   4-column grid, uppercased, are already near their character budget before a
   translation or a long ward name makes it worse.

---

## 1. Profile tab

### 1a. "Civic Points" stated four times on one screen (Pattern 1 + 2)

Confirmed exactly as you described. On one Profile view, with 75 points and 25 to
the next level, here is everword for word what renders, top to bottom:

| Element | i18n key | Exact current text |
|---|---|---|
| `#profileXpTotal` (header, under the level badge) | `profile.xpTotalLabel` | **"75 Civic Points"** |
| `#profileXpHint` (progress bar caption) | `profile.xpToNext` | **"25 pts to Ward Watcher (+50/report)"** |
| `#profileNextBadgeHint` (line directly below the above) | milestone key, e.g. `profile.milestoneMany` | **"2 more reports to your next milestone"** |
| `#profileStreakLine` (below that, if streak ≥ 1) | `profile.streak` | **"{n}-week reporting streak"** |
| `#profileWardImpact` (above all of this, near the name) | `profile.wardImpact` | **"Your ward: 0 reports this season"** |
| `#profilePoints` stat card + `#profilePoints`'s label | `profile.points` | **"75"** + **"Civic Points"** (again) |

That's the point count stated twice verbatim ("75 Civic Points" / "75" + "Civic
Points"), plus **three different progress systems** (points-to-next-level,
reports-to-next-milestone, week-streak) each getting their own sentence, stacked
directly above each other.

**Proposed fix — pick ONE progress system, cut the rest to a single line:**

Keep the XP bar (it's the only one with a visual progress meter, so it's the
strongest of the three) and its existing hint. Delete the separate milestone
line entirely — it is measuring almost the same thing (report count) the XP bar
already measures, just against a different threshold table. Fold streak into the
XP hint only when it's the more interesting fact (a live streak beats a stale
"X pts to next level" for someone who just opened the app three days running).

```
BEFORE (4 lines):
  75 Civic Points
  25 pts to Ward Watcher (+50/report)
  2 more reports to your next milestone
  3-week reporting streak

AFTER (2 lines):
  25 pts to Ward Watcher            [progress bar underneath — already exists]
  🔥 3-week streak                  [only shown when streak ≥ 2; else omitted]
```

- Delete `#profileNextBadgeHint` from the render (`app.js:44216-44234` — the
  `nextBadgeHintEl` block) rather than rewording it; it is duplicate information,
  not badly worded information.
- Move the raw point count ("75") to live **only** on the stat card at the bottom
  (`#profilePoints` + `profile.points` label) — that is the one place a bare
  number-with-label is the right amount of information. Remove `#profileXpTotal`'s
  text entirely, or repurpose that slot to show the **level name only** ("Ward
  Watcher") since `#profileLevelBadge` right above it is currently the *current*
  level and `#profileXpHint` is the *next* level — those two already tell the
  level story without also restating the number a third time.
- `'profile.wardImpact': 'Your ward: {n} reports this season'` → when `{n}` is 0,
  this reads as a small failure ("0 reports") right next to the user's own name,
  which is a strange thing to lead with. Suggest gating this line to only render
  when `{n} > 0`, matching how `#profileStreakLine` already gates on `streak < 1`.

### 1b. Stat-card label wrap ("REPOR TS", "ME TOO", "PLEDG ES")

This is the same `.impact-stat` component used on the Community tab — see §2a for
the full CSS root-cause and fix; the content-level mitigation (shorter labels) is
listed there and applies here too since Profile reuses the identical markup.

### 1c. Points-math hint — orphaned but still writing

`'profile.pointsHint.base': '50 Civic Points per report · +8 Me too · +200
volunteer verified'` and `'profile.pointsHint.bonus': '{n} reports — 50 Civic
Points — +{bonus} volunteer bonus'` are set by code (`app.js:4755,4757`) but per
the existing code comment at `app.js:44246-44249` the element that displayed them
was already removed from the render — meaning **the strings themselves are now
dead** (unused i18n keys). Not a copy problem, but flag for deletion during the
next i18n hygiene pass (see UX-REVIEW.md §4d for the sibling case of this).

---

## 2. Community tab

### 2a. Stat-card label wrapping — "REPOR TS", "ME TOO", "PLEDG ES"

Root cause confirmed in `css/styles.css`:

```css
.impact-stat { padding: 16px; }                 /* line 6758 — generous for a 4-up grid */
.impact-stats { grid-template-columns: repeat(4, 1fr); }   /* line 6752 */
.impact-stat label {
  text-transform: uppercase;                     /* widens characters ~10-15% vs mixed case */
  word-break: break-word;                        /* breaks mid-word instead of wrapping whole label */
}
```

On a ~340px modal, four cards with 16px padding each leave roughly 44px of usable
text width per card — not enough for uppercase "REPORTS" or "PLEDGES" at
`--fs-xs`, so `word-break: break-word` snaps them mid-character rather than
wrapping the whole word to a second line cleanly.

**This is primarily a CSS fix** (reduce `.impact-stat` padding on 4-column layouts,
or switch `word-break: break-word` to `overflow-wrap: normal; white-space: nowrap`
so a label wraps as a whole word or shrinks the font instead of splitting
mid-word) — flagging for the engineer, not something copy alone fully solves.

**Content-level mitigation** (shortens the words so they're less likely to hit the
wrap threshold even before any CSS fix ships):

| i18n key | Current | Proposed |
|---|---|---|
| `impact.reports` | "Reports" | "Reports" *(already shortest accurate option — leave)* |
| `impact.resolved` | "Fixed" | "Fixed" *(already short — leave)* |
| `impact.confirms` | "Me too" | "Me too" *(already short — leave)* |
| `impact.pledges` | "Pledges" | "Pledges" *(already short — leave)* |

None of these four labels can be meaningfully shortened without losing meaning —
"Reports" and "Pledges" are already single common words. This confirms the fix
has to be the CSS padding/wrap rule, not the copy. Don't spend more words trying
to out-abbreviate a layout bug.

### 2b. Three stacked "you should report" nudges before the leaderboard

Confirmed in code: the "Your ward this week" section (`communityWardImpactSection`)
is force-expanded on Community modal open (`app.js:27842`,
`setCollapsibleSectionOpen(..., true)`), so — unlike the other accordions on this
screen, which stay collapsed until tapped — its contents are visible immediately.
That section can independently contain a seasonal hook, an impact-week line, and a
ward-week social-proof line, stacked with the modal's own header subtitle above
them:

| Element | i18n key | Exact current text (example) |
|---|---|---|
| Modal header subtitle | `community.subtitle` | "Fix it together in {ward} — rally neighbours, celebrate wins." |
| Seasonal hook (if in-season) | `season.monsoonPeak` | "Monsoon is here. Standing water spreads dengue — report in 30 seconds." |
| Impact-week line | `impact.week` | "This week: 0 reports — 0 resolved — 0 confirmations" |
| Ward-week social proof (empty case) | `social.wardWeekEmpty` | "No reports from {ward} yet this week — be the one neighbours follow." |

On a quiet ward with no activity yet, that's **four separate sentences**, from
three independently-triggered systems, all saying some version of "nothing has
happened here, you should report" before the user reaches the leaderboard they
opened the tab to see.

**Proposed fix — collapse "Your ward this week" back to closed-by-default, and
consolidate the empty case to one line:**

```
BEFORE (force-expanded, up to 4 lines when quiet):
  Fix it together in C Ward — rally neighbours, celebrate wins.
  🌧️ Monsoon is here. Standing water spreads dengue — report in 30 seconds.
  This week: 0 reports — 0 resolved — 0 confirmations
  No reports from C Ward yet this week — be the one neighbours follow.

AFTER (collapsed by default; when opened, one line covers the empty case):
  Fix it together in C Ward — rally neighbours, celebrate wins.
  [ ▸ Your ward this week ]  ← collapsed, as originally designed

  — if opened and genuinely empty —
  No reports from C Ward yet this week — be the one neighbours follow.
  [ Report the first spot ]
```

- Revert `app.js:27842`'s forced `true` back to matching the other accordions'
  default collapsed state (`cr-section--collapsed` in the HTML already assumes
  this) — the seasonal hook and impact-week line don't need to compete with the
  header before the user has asked to see them.
- When the section IS opened and there's no activity, show **only**
  `social.wardWeekEmpty` — it already contains the same information as
  `impact.week`'s "0 reports" in a friendlier, action-oriented sentence. Suppress
  `impact.week` entirely when all three counts are 0 (it currently renders "0
  reports — 0 resolved — 0 confirmations" regardless, which is the same fact as
  the empty state restated flatly).
- The seasonal hook is genuinely useful context (time-sensitive, changes what
  action matters right now) — keep it, but only show it alongside the *populated*
  ward-week state, not stacked on top of the *empty* state saying the same "report
  now" idea a second way.

### 2c. Header subtitle vs. dynamic variant — pick the one that's true

`community.subtitle` ("Fix it together in {ward} — rally neighbours, celebrate
wins.") is generic and always shown. There's already a more specific variant
defined: `'community.subtitleActive': '{ward}: {pending} of yours still open —
rally neighbours or see Resources.'` — confirm this swaps in when the user has
open reports of their own; if it's not currently wired to replace the generic
line, that's a quick win (the specific version is more useful and shorter).

---

## 3. Resources tab

### 3a. Sub-label overload under channel buttons

Section subtitle: `'official.subtitle': 'Verified .gov apps and portals for your
city.'` — fine, keep (states trust + scope in one line, does real work).

Per-channel, every button gets a `<small>` sub-label
(`renderOfficialChannelButtons()`, `app.js:1773-1867`), regardless of whether the
label alone is already clear:

| Channel | Label | Sub-label (current) | Does the sub-label add anything the label didn't? |
|---|---|---|---|
| MARG | "MyBMC MARG" | "114 categories — geo photos — tracking" | **Yes** — real scope info, keep |
| Swachhata | "Swachhata-MoHUA" | "MoHUA sanitation — ward inspector" | **Yes** — clarifies who handles it, keep |
| Aaple Sarkar | "Aaple Sarkar" | "Maharashtra state grievance portal" | **Yes** — the name alone doesn't say what it is, keep |
| PMC CARE | "PMC CARE" | "Pune Municipal Corporation app" | Marginal — "PMC" already implies Pune Municipal Corporation; keep only if a first-time Pune user genuinely wouldn't know what PMC stands for |
| TMC portal | "TMC citizen portal" | "thanecity.gov.in" | **Yes** — it's a URL, genuinely new info, keep |
| MyBMC WhatsApp | "MyBMC WhatsApp" | "Quick chat filing" | **No** — the label already says WhatsApp; "quick chat filing" restates it. Cut. |
| BMC online portal | "BMC online portal" | "Web portal" | **No** — the label already says "portal"; "Web portal" is a tautology. Cut. |

**Proposed fix:**

```
'official.bmcWa.small'     — delete (or repurpose to show a URL/number, e.g. the WhatsApp number itself)
'official.bmcPortal.small' — delete (or repurpose to show www.mcgm.gov.in, matching the TMC pattern above)
```

The rule going forward (this is Pattern 3 from the top of this doc): a sub-label
earns its place only if it adds a fact the title doesn't already contain — a URL,
a scope ("ward inspector"), a category count. If the sub-label just restates the
title in fewer or equal words, delete it rather than reword it.

---

## 4. Landing / map screen

Checked against current code — the tagline/reassurance consolidation from the
earlier UX review round is already live (`home.hero.headline`: "Spot it. Snap it.
Sorted.", `persona.citizen.idle`: "Hazard nearby? Report it.", `location.
bannerCompact`: "See hazards near you — turn on location.") — no further action
needed here; this section is already in good shape. Flagging so it isn't
re-flagged in a future pass.

One remaining nit: `home.hero.trust`, "Free · 3 cities · 4 languages", sits right
below `home.hero.subline`, "Report a hazard in 30 seconds — neighbours see it
too." Both are true and both are short, but stacked they're two separate trust/
value claims in a five-line card. If the hero card ever needs to shrink further,
`home.hero.trust` is the line to cut first — it's marketing information, not
task-relevant information (the other four lines all relate directly to what the
user is about to do).

---

## 5. Report-a-hazard flow

Already addressed in the earlier UX review (capture-hint jargon rewrite, geo-
explainer trim) and confirmed live in code. One addition from this pass:

**Confirm screen — the hazard-type hint restates what the chips already show.**

`'report.hazardHint': "Tap the hazard you're reporting"` sits directly above the
hazard chip grid. Once a chip is selected, `#hazardSelectedCue` shows a second
line confirming the pick (e.g. `'report.photoNext': '{hazard} selected'`). Before
selection the hint is useful (tells you to tap); after selection, having both the
now-highlighted chip *and* a text confirmation is the same "which one is chosen"
answer given twice. Suggest hiding `hazardPickerHint` once a selection exists
(mirrors how `#hazardSelectedCue` already only shows after selection) rather than
running both simultaneously.

---

## 6. Success modal

Covered in depth in the earlier UX review (§2a, "success modal overload") — that
finding stands; re-stating the exact strings here for completeness since this pass
is meant to be a single reference:

| Element | Current | Keep or cut |
|---|---|---|
| `success.title` | "Report logged — thank you!" | Keep |
| `success.tagline` | "Pinned on ward map" | Keep |
| Points pill | "+15 Civic Points" | Keep (this is the one place a bare points restatement is earned — right after the action that produced it) |
| `success.celebrateFirst` / `celebrateMilestone` | "First report logged." / "{n} reports in — your neighbours are lucky to have you." | Keep, but only one of celebrate/progress/streak should render per submission (see original UX-REVIEW.md §2a) |
| `success.shareTitle` **and** `success.sharePrompt` | Identical string, `success.shareTitle`'s element is `hidden` in HTML | Delete the dead `success.shareTitle` node + key (confirmed still present) |

---

## 7. Onboarding

Already trimmed per the earlier UX review round (GPS disclosure shortened, ward
hint consolidated). No new findings this pass — confirmed current strings match
the shortened versions.

---

## 8. Other modals — lighter-touch findings

**Volunteer modal.** `volunteer.subtitle` already reads "Join neighbours for local
cleanups." (short, good — matches the earlier fix). `volunteer.ageNote` ("18+
required per Terms. Under-18? Participate only with a parent/guardian or school
NSS coordinator who accepts Terms.") is two sentences of legal/logistics copy
inside a form that also has 5+ other fields. Not wrong, just heavy for its
position — consider moving to a small `ⓘ` disclosure rather than always-visible
body text, consistent with how the report flow already collapses its landmark
field behind "+ Add landmark".

**Escalation modal.** Per-corporation copy (`esc.tmc.*`, `esc.pmc.*`) is
well-scoped — each city's file/escalate/self-resolve strings are appropriately
short and specific to that corporation's actual process. No redundancy found here;
this modal is a good model for the rest of the app's tone (plain, procedural,
one fact per line).

**About modal.** `about.subtitle`, `about.privacyNote`, `about.officialSourcesNote`
each independently restate "this is not a government app / not affiliated with
BMC/PMC/TMC" in slightly different words across three consecutive sections. This
is the same "not a government app" repetition already flagged in the original
UX-REVIEW.md §4b — confirmed still present; recommend keeping it in exactly one
place (the ToS clause is the legally-load-bearing instance; the About modal can
state it once at the top and not repeat it per-section below).

---

## Summary — fixes by effort

| Fix | Files/keys touched | Effort |
|---|---|---|
| Delete `#profileNextBadgeHint` milestone line | `app.js:44216-44234`, remove element from render | XS |
| Gate `profile.wardImpact` to `{n} > 0` | `app.js:44047-44059` | XS |
| Repurpose or remove `#profileXpTotal` text | `app.js:44093`, `index.html:1127` | XS |
| Delete dead `profile.pointsHint.*` keys | i18n cleanup, all 4 languages | XS |
| Revert `communityWardImpactSection` to collapsed-by-default | `app.js:27842` | XS |
| Suppress `impact.week` "0/0/0" when empty; prefer `social.wardWeekEmpty` alone | wherever `impactWeekLine`/`wardWeekSocial` are populated together | S |
| Wire `community.subtitleActive` in when user has open reports | Community modal header render | S |
| Delete `official.bmcWa.small` / `official.bmcPortal.small` (or repurpose to real info) | `app.js:4663-4689`, config | XS |
| Hide `hazardPickerHint` after a hazard is selected | Confirm-step render | XS |
| Delete dead `success.shareTitle` node + key | `index.html`, i18n | XS |
| `.impact-stat` padding/word-break CSS fix (engineering, not content) | `css/styles.css:6758,6773-6782` | S |
| Move `volunteer.ageNote` behind a disclosure | Volunteer modal | S |
| Consolidate "not a government app" to one spot in About | `about.subtitle`/`privacyNote`/`officialSourcesNote` | XS |

Every fix above is XS–S effort — this is a trimming pass, not a redesign. Doing
all of it removes roughly 15 lines of standing text across three tabs without
losing any information a user actually needs.
