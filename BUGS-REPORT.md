# CivicRadar — code bug hunt

Report only. No code was changed. Not an exhaustive line-by-line audit of a
23,500-line file — targeted at the highest-risk subsystems: the report/photo
state machine, points/XP/date math, event-listener lifecycle, and local
storage/sync integrity. Content, copy, and UX findings are covered in the
other reports from this session (UX-REVIEW.md, CONTENT-AUDIT.md,
MESSAGING-AUDIT.md, GEO-DETECTION-REVIEW.md, OUT-OF-AREA-EXPERIENCE.md,
SPLASH-BUG-REPORT.md) — not repeated here.

Each finding below was traced through the actual code, not inferred from
naming. Where something checked out as correct, it's noted as such — the goal
is an honest picture, not a padded list.

---

## Confirmed bugs

### 1. Silent data loss when localStorage fills up by byte-size, not report count

**File:** `js/app.js:14269-14284` (`saveReports`), called from `js/app.js:36194-36215` (`submitReport`).

`saveReports` first calls `trimReportsForDevice`, which only acts once the
**report count** exceeds `scale.maxReportsPerDevice` (500, `js/config.js`) —
and when it does act, it correctly protects the current user's own reports
from eviction. But real-world storage quota (typically 5–10MB per origin,
shared across every key the app uses) can be exceeded by **byte size** well
before 500 reports accumulate — report objects carry compressed JPEG data
URLs, and even at the configured compression settings, a few hundred photos
can add up to several MB. When that happens, `trimReportsForDevice` never
engages (count is still under 500), and the raw fallback loop runs instead:

```js
while (true) {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    _reportsCache = reports;
    return;
  } catch (err) {
    if ((err.name === 'QuotaExceededError' || err.code === 22) && reports.length > 0) {
      reports.pop();       // ← removes from the END, no ownership check
    } else {
      throw err;
    }
  }
}
```

New reports are added via `reports.unshift(report)` (`js/app.js:36198`), so a
brand-new submission sits at index 0 and isn't the first thing evicted — that
part is safe. But `pop()` removes from the **end** with no regard for whose
report it is or how old it is, and the loop has no upper bound: it will keep
evicting one report at a time — potentially many — until the save fits, with
**zero user-facing notification** that anything was deleted. The only
user-visible feedback (`toast.storageFull`) only fires in the one case where
eviction fails completely (`reports.length` reaches 0 and it *still* doesn't
fit) — the much more likely case, evicting N old reports and succeeding, is
silent.

**Impact is highest in local/offline-only mode** (per RELEASE.md, `dev`
environment has no backend at all — pure localStorage), where an evicted
report has no server copy to recover from. In connected mode the next sync
would likely re-pull server data, masking the local loss.

**Confidence: high** that the code behaves this way; the trigger condition
(byte-size quota hit before the 500-count cap) requires either many
photo-bearing reports or a constrained device, so real-world frequency is
plausibly low but the failure mode itself is not hypothetical — it's a direct
reading of the eviction loop.

**Suggested fix (not applied):** apply the same ownership-aware,
oldest-first-not-newest-blind logic `trimReportsForDevice` already has to the
`saveReports` fallback loop too (or just always route through
`trimReportsForDevice`'s merge/own-protection logic before the raw
`localStorage.setItem`), and surface a toast when eviction actually happens
("Freed up space by removing N old cached reports") rather than only when it
fails outright.

---

### 2. Two incompatible definitions of "this week," disagreeing on the same data

**Personal streak/milestone tracking** uses an ISO calendar week (Monday–Sunday,
resets exactly at the week boundary): `getWeekKey` (`js/app.js:18449`),
`getReportsThisWeek` (`js/app.js:18507-18513`), `getReportWeekStreak`
(`js/app.js:18467-18503`) — these feed the profile streak line and the
week-submission bonus (`awardWeekBonus`).

**Community-facing "this week" stats** use a rolling 7-day window instead
(`Date.now() - 7*24*60*60*1000`, never resets on a calendar boundary):
`getWeekImpactStats` (`js/app.js:16064-16080`, feeds the `impact.week` line —
*"This week: {n} reports…"*) and `getWardWeekStats`
(`js/app.js:43384-43412`, feeds the ward social-proof line and the shareable
weekly-recap message).

**Concrete trigger:** right after an ISO-week boundary (e.g. Monday morning
IST), a citizen who reported the previous Tuesday–Sunday sees their **personal**
streak/"this week" reset to zero (new calendar week, nothing filed yet),
while the **community** impact widget and the "Your ward this week" recap —
visible on the very same screen, potentially the same modal — still count
those same Tuesday–Sunday reports, because the rolling 7-day window hasn't
rolled past them. The two numbers visibly disagree for the same underlying
data, on the same page, at the same moment.

**Confidence: high** that two different window definitions are genuinely in
use (verified by reading both implementations, not just their names);
medium-high that this is a real user-visible bug rather than intentional,
since the weekly-recap share feature explicitly brands itself "Your ward this
week" right next to a personal tracker that resets on a different clock — a
citizen sharing that recap could show neighbours numbers that don't match
what they see on their own profile the same day.

**Suggested fix (not applied):** pick one definition (ISO calendar week is
the better fit here, since it gives users a predictable, explainable reset
point) and route both the personal and community "this week" figures through
`getWeekKey`'s boundary instead of maintaining two separate window
calculations.

---

## Minor finding

### 3. Nine permanent document-level touch listeners (bounded, not a growing leak)

**File:** `js/searchable-select.js`, inside `initSearchableSelect` — registers
`document.addEventListener('touchstart', onDocTouch)` per combobox instance,
with no matching `removeEventListener` anywhere in the file. Traced the
actual call pattern: `initSearchableComboboxes()` runs exactly once at
startup (`js/app.js:28935`) against 9 static, never-recreated `<input>`
elements (5 ward combos + 4 society combos), and the registry `WeakMap` plus
an `input.dataset.civicCombobox` guard both correctly prevent double-init on
the same element. So this is **not** an unbounded leak that grows as modals
reopen — it's a fixed 9 listeners for the life of the page, each doing a
redundant `wrap.contains(e.target)` check on every touch anywhere on screen
for the rest of the session. Real but low-impact; worth a teardown API only
if these comboboxes are ever expected to be dynamically created/destroyed in
the future, which they currently aren't.

---

## Checked and found solid — no bug

Listed so the coverage of this pass is clear, not just its findings:

- **XP/level math** (`getCivicLevelInfo`) — correct at 0 XP, exactly at a
  level threshold, and above the max level; no NaN/Infinity/out-of-0-100-range
  risk found.
- **Report-milestone progress** (`getReportMilestoneProgress`) — correct
  reset-to-next-bar behavior exactly at a milestone; correctly bounded above
  the top milestone.
- **Streak calculation** (`getReportWeekStreak`/`getWeekKey`) — properly
  timezone-safe (buckets by the user's local calendar day, not raw UTC), and
  a report late Saturday vs. early Sunday can't get double-counted. The
  "skip one empty week without breaking the streak" logic was traced
  explicitly and produces the correct result (doesn't count a week-1 +
  week-3-skip-week-2 pattern as a valid streak).
- **Escalation "days since filed" clock and ladder thresholds** — correct
  `Math.floor` day-diff math; the stated "7 days / 14 days / 30 days"
  thresholds use `>=`, so day 7 itself correctly unlocks the day-7 tier
  (not off-by-one).
- **Duplicate-report detection** (`findSubmitDuplicate`, `getDistanceInMeters`)
  — the Haversine implementation is textbook-correct (proper Earth radius in
  meters, correct trig), the 10m radius and 14-day window constants are
  applied in consistent units throughout, and the same-hazard-only /
  city-bounds-gated filtering is sound.
- **Re-render + listener re-attachment** (leaderboard, admin queue, access
  review lists) — all three checked patterns either attach listeners to
  freshly-created elements each render (safe) or use proper event delegation
  bound once at startup (also safe). No duplicate-firing-after-N-renders bug
  found. `bindHazardPicker` explicitly self-guards against double-binding
  (`grid.dataset.bound`), showing the codebase is otherwise deliberate about
  this exact risk class.
- **`setInterval` usage** — exactly one instance in app.js (the Community
  modal's "success story" card auto-flip), correctly guarded against
  restart-stacking and explicitly stopped on modal close. No leak.
- **Photo-capture state machine** — more defensively engineered than the
  complexity first suggested: a `captureGen`/`stillCurrent()` generation
  counter guards against races between rapid successive captures, and a
  20-second watchdog timer (`armReportPhotoWatchdog`) covers every exit
  branch (preview ready but flow stalled → advance to confirm; file accepted
  but never resolved → explicit failure + reset; nothing happened → quiet
  exit) — traced all three branches back to the same flag-reset function.
  No stuck-forever state found.
- **Admin resolve action** (`markReportResolved`) — re-verifies `hasRole('bmc')`
  inside the handler itself, not just by hiding the button from non-admins in
  the UI — correct defense-in-depth given the app's own docs already say real
  enforcement is server-side RLS.
- **Local/cloud sync merge** (`Backend.sync`, `js/app.js:15050-15103`) — the
  server/local reconcile uses a `Map` keyed by report id to de-dupe overlapping
  server queries, and explicitly reasons about the "recent page came back
  full, so we can't be sure what's missing" edge case before deciding whether
  to keep or drop a local-only cached copy of another user's report. Careful,
  deliberate logic — no duplicate-pin-on-map or premature-eviction bug found
  in the path examined.

---

## Not fully covered this pass

Two background research passes on this topic stalled mid-investigation and
weren't restarted; flagging honestly rather than presenting partial coverage
as complete:

- **Coordinator/NGO ward-and-neighbourhood scope filtering** — spot-checked
  the admin-side pattern (`adminScopedReports`/`cityScopedReports` gating,
  `js/app.js:30854`, `45336`) but did not exhaustively verify every
  coordinator-dashboard render function (`coordVolunteerList`,
  `coordHazardList`, `coordinatorPledgeList`) applies its ward/neighbourhood
  scope filter consistently. Worth a dedicated pass if coordinator-facing
  data leakage is a concern.
- **Full duplicate-listener sweep beyond the three sampled render functions**
  — leaderboard, admin queue, and access-review were checked and found safe;
  other dynamically-rendered lists (coordinator dashboards, escalation
  ladder, tracking-dashboard breakdowns) weren't individually re-verified.
