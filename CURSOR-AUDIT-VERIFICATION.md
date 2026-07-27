# Verification of Cursor's 2026-07-26 bug audit

I independently re-traced every "Confirmed" finding against the actual
code at v453 — not just reading Cursor's citations, but following each
claim through to its actual data flow (server RPC → client save → next
sync, or user input → template string → DOM). Verdict: **Cursor's audit is
substantively accurate.** Every P0/P1 claim I checked holds up under
independent tracing, with one citation error (wrong i18n key name on one
P2) that doesn't change the underlying finding. This is good, careful work
— both P0s in particular are real and worth fixing promptly.

Below: my verdict per finding, then exact fix code for the two P0s (Cursor
gave direction, not a diff — these are ready for Cursor to apply). The
P1s and P2s are confirmed valid; I've described precise fix patterns for
those but stopped short of full diffs for all of them to keep this
focused — say the word if you want those written out with the same
precision.

---

## P0 #1 — Community "Looks fixed" can resolve locally without a confirmed server write

**Verdict: CONFIRMED, fully traced end-to-end.** I followed all three
links in the chain myself:

1. `confirmFix()` (`js/app.js:22227-22263`) calls `Backend.confirmFix(...).then((result) => { if (!result) { finishResolve(...); return; } ... })`. I checked `Backend.confirmFix` (`js/app.js:15906-15918`) directly: **it returns `null` on any RPC error** (`if (error) { console.warn(...); return null; }`). The caller's `if (!result)` branch cannot distinguish "RPC failed" from "RPC succeeded, threshold not yet reached" — both hit `finishResolve()`, which locally resolves if the *local* `fixConfirmations` count has crossed the threshold, regardless of whether the server ever recorded anything.
2. `Backend.updateReportResolution` (`js/app.js:15833-15858`) confirms the architecture assumes `confirm_fix()` already did the server-side resolve for the community/no-photo case — there's an explicit comment saying so, and the code has no branch that fires an RPC for `by === 'community'` with no image. So when step 1's RPC failed, **nothing ever writes the resolution to the server** — not even as a fallback.
3. `pullAll()` (`js/app.js:15546-15568`): confirmed the reconcile is server-authoritative — `saveReports([...serverMapped, ...localKeep])` where `localKeep` explicitly excludes any report ID the server already has a row for. Since the server row was never updated in step 2, the next sync overwrites the local `resolved` status back to the server's stale `pending`.

Net effect, confirmed: a network hiccup during "Looks fixed" → user sees resolved + confetti + points, and it silently reverts on next sync with the points never clawed back. Real, and worth fixing before wider rollout.

**Fix** (`js/app.js:22227-22263`):

**Current:**
```js
    if (Backend.enabled) {

      Backend.confirmFix(reportId, !!opts.staleCheck).then((result) => {

        if (!result) {

          finishResolve(opts.staleCheck ? 'stale_verified' : 'community_verified');

          return;

        }

        const count = Number(result.fix_confirmations);

        if (!Number.isNaN(count)) {

          const fresh = loadReports();

          const rIdx = fresh.findIndex((r) => String(r.id) === String(reportId));

          if (rIdx !== -1) {

            fresh[rIdx].fixConfirmations = count;

            saveReports(fresh);

          }

        }

        if (result.resolved) {

          handleCommunityAutoResolve(reportId, result.resolution_source || 'community_verified');

        }

      });

    } else {

      finishResolve(opts.staleCheck ? 'stale_verified' : 'community_verified');

    }
```

**Replace with:**
```js
    if (Backend.enabled) {

      Backend.confirmFix(reportId, !!opts.staleCheck).then((result) => {

        if (!result) {

          // RPC failed (network/server error) — do NOT locally resolve on an
          // unconfirmed threshold. Roll the optimistic confirmation back and
          // tell the user, mirroring toast.syncLocal's existing pattern.
          unclaimFixConfirmation(reportId);

          showToast(t('toast.syncLocal'), 'info', 3500);

          return;

        }

        const count = Number(result.fix_confirmations);

        if (!Number.isNaN(count)) {

          const fresh = loadReports();

          const rIdx = fresh.findIndex((r) => String(r.id) === String(reportId));

          if (rIdx !== -1) {

            fresh[rIdx].fixConfirmations = count;

            saveReports(fresh);

          }

        }

        if (result.resolved) {

          handleCommunityAutoResolve(reportId, result.resolution_source || 'community_verified');

        }

      });

    } else {

      finishResolve(opts.staleCheck ? 'stale_verified' : 'community_verified');

    }
```

This needs a new `unclaimFixConfirmation(reportId)` helper (mirroring the
existing `unclaimConfirmation(id)` used a few lines above for the local
`saveReports` failure case — same file, search for `unclaimConfirmation`
to match its exact shape): decrement `report.fixConfirmations`, remove the
ID from `FIX_CONFIRMED_KEY`'s set, and reverse `POINTS_FIX_CONFIRM` via a
negative `addPointsCache()` call. I'd write this out in full if you want
it, but wanted to flag: **local-only mode (`Backend.enabled === false`)
correctly keeps the current unconditional `finishResolve()`** — that's
intentional, not a bug, since there's no server to fail in that mode.

---

## P0 #2 — Stored XSS via unescaped report image URLs

**Verdict: CONFIRMED, and I traced it slightly further than Cursor's
citations — worth fixing before any wider closed-testing rollout since
it's a real stored-XSS vector, not theoretical.**

Root cause, confirmed at the source: `isSafeReportImage()` (`js/app.js:2981-2986`)
only checks that a string *starts with* `data:image/` or the Supabase
storage URL prefix — it does not reject quote characters, angle brackets,
or anything else that would let a value break out of an HTML attribute.

I then checked the server side, since that's what actually determines
whether an attacker-controlled value can reach this gate:
`insert_report` (`supabase/schema.sql:2091`) does `nullif(btrim(coalesce(p_image, '')), '')`
— trim only, no format/content validation. `set_resolution_image`
(`supabase/schema.sql:1784-1811`) is worse — **zero validation at all**,
not even a trim, and is callable by the report's own reporter or by
anyone whose fix-confirmation is on record for that report. Either RPC
can be called directly (bypassing the client's own always-safe
canvas-generated data URLs entirely) by any authenticated user with a
valid session token.

I then directly verified 4 of the 5 render sites Cursor cited all share
the identical unescaped-interpolation pattern (I did not additionally
re-verify the 5th, admin queue thumbs, but given 4-for-4 consistency
across genuinely different functions, I'm confident it matches too):

- `buildBeforeAfterSliderHtml()` (`js/app.js:39711-39728`) — `src="${afterSrc}"` / `src="${beforeSrc}"`, no escaping (labels *are* escaped, just not the URLs)
- `buildSuccessStoryThumbHtml()` (`js/app.js:39401-39427`) — `src="${report.image}"` / `src="${report.resolutionImage}"`, same gap
- Share Win modal's `#shareWinProof` block (`js/app.js:40825-40841`) — same
- Profile's report cards (`js/app.js:45411-45447`) — same, note `safeImg`/`safeAfter` are just unescaped aliases of the raw fields after the (inadequate) prefix check

**The fix is simpler than "add a new escapeAttr() helper"** — `escapeHtml()`
(`js/app.js:2988-3004`) already exists and already correctly escapes both
`"` (→ `&quot;`) and `'` (→ `&#39;`), i.e. it's already attribute-safe, not
just text-safe. It's already used for the labels in these exact same
functions — it was just never applied to the `src` values themselves.

**Fix, apply at all 4 (5) sites** — example for `buildBeforeAfterSliderHtml`:

**Current** (`js/app.js:39716-39721`):
```js
          <img class="ba-slider__img ba-slider__img--after" src="${afterSrc}" alt="${afterLabel}" draggable="false">
          <div class="ba-slider__before-wrap" style="clip-path: inset(0 50% 0 0)">
            <img class="ba-slider__img ba-slider__img--before" src="${beforeSrc}" alt="${beforeLabel}" draggable="false">
          </div>
```

**Replace with:**
```js
          <img class="ba-slider__img ba-slider__img--after" src="${escapeHtml(afterSrc)}" alt="${afterLabel}" draggable="false">
          <div class="ba-slider__before-wrap" style="clip-path: inset(0 50% 0 0)">
            <img class="ba-slider__img ba-slider__img--before" src="${escapeHtml(beforeSrc)}" alt="${beforeLabel}" draggable="false">
          </div>
```

Same one-line change (`${x}` → `${escapeHtml(x)}`) at each of the other
three (four) confirmed sites, wherever `report.image`, `report.resolutionImage`,
`beforeSrc`/`afterSrc`, `safeImg`/`safeAfter`, or equivalent report-image
fields are interpolated into a `src="..."` attribute.

**Also do the server-side hardening Cursor recommended** — this matters
because client-side escaping alone doesn't stop a malicious value from
being *stored*, just from executing when the *official app* renders it. A
future feature, a different client, or a direct API consumer could still
render the raw stored value unsafely. Add a format check to both RPCs:
reject `p_image`/`p_resolution_image` values that aren't either a
`data:image/(jpeg|png|webp);base64,...` string with only base64-alphabet
characters after the comma, or an `https://` URL matching your own
Supabase storage bucket prefix (the same prefix `isSafeReportImage`
already checks client-side). I'd write the exact SQL if you want it, but
the two client-side call sites above are the more urgent fix — go there
first.

---

## P1 claims — all confirmed

**P1 #3, silent sync failures** (`js/app.js:15833-15894`, six functions:
`updateReportResolution`, `reopenReport`, `updateReportFiling`,
`updateReportCleanup`, `confirmReport`, `flagReport`) — confirmed, all six
follow the identical `if (error) console.warn(...)` pattern with no
user-visible feedback and no retry/pending marker. The codebase already
has the right pattern for this (`toast.syncLocal` + a `syncPending` flag,
used correctly for report/pledge inserts at `js/app.js:15338`) — it's just
not applied to these six mutation paths. Cursor's fix direction (await,
revert-or-mark-pending, toast, mirroring the existing insert pattern) is
correct.

**P1 #4, Me too is fully fire-and-forget** (`js/app.js:21889-21891`) —
confirmed precisely: `Backend.confirmReport(reportId);` has no `await`, no
`.then()`, no `.catch()` at all — the very next line unconditionally
awards `POINTS_ME_TOO`. Cursor's suggested fix (await, call the *already-
existing* `unclaimConfirmation()` helper on failure — I confirmed it's
real and already used two lines above for the local-save-failure case) is
exactly right and low-risk since the rollback helper doesn't need to be
built, just wired to one more failure path.

**P1 #5, `toast.wardRequired` hardcodes Mumbai in hi/mr/gu** — confirmed
character-for-character: English has `{city}`
(`'Pick a ward from the official {city} list.'`, `js/app.js:5241`); Hindi/
Marathi/Gujarati (`js/app.js:7896`, `:10549`, `:13202`) all hardcode
"Mumbai"/"मुंबई"/"મુંબઈ" with no placeholder, so the `.replace('{city}', ...)`
at all three call sites (`js/app.js:2698`, `:32076`, `:43622`) is a silent
no-op for those three languages. A Pune/Thane user on Hindi, Marathi, or
Gujarati is told to pick a ward from Mumbai's list. Straightforward fix:
add `{city}` to those three strings, mirroring English exactly.

---

## P2 claims — confirmed, one citation correction

**Onboarding GPS-blocked copy** — confirmed in substance, but **Cursor
cited the wrong i18n key**. It says `showOnboardingWardDetectFailed()`
"sets fail copy to `onboard.wardDetectFailed`" — I traced the actual call
chain and that's not right: `showOnboardingWardDetectFailed()`
(`js/app.js:25539-25567`) calls `resetOnboardingWardErrorDefault()`
(`js/app.js:25671-25683`), which sets `#wardError`'s text to
**`onboard.wardError`** (`'Pick a ward from the list, or turn on
location.'`, `js/app.js:3501`) — a different key with similar wording.
`onboard.wardDetectFailed` is actually only used in the unrelated Profile
"Detect my ward" success-but-no-match toast (`js/app.js:24356`). The
underlying finding still holds with the correct key: after my earlier fix
this session hides the Retry button when blocked, the still-visible
`onboard.wardError` text keeps saying "...or turn on location" as if
retrying would help. Real gap, easy fix (branch this text the same way
the button visibility already branches), just needed the citation fixed.

**Civic XP is client-authoritative upward** — confirmed, and arguably
understated: `getTotalCivicXp()` (`js/app.js:18856-18858`) is pure local
computation from locally-editable data. `sync_civic_xp`
(`supabase/schema.sql:1647-1658`) caps each call's delta at 2000, but I
checked and found **no rate limit or cooldown on repeated calls** (unlike
`insert_report`, which has an explicit hourly cap) — a scripted client
could call it in a loop with no real ceiling. Cursor's P2 severity call
(gameable, not a breach) is fair; the fix direction (server-derived XP
from audited actions, or at minimum a cooldown) is reasonable.

**Lead nominate/vote/list offline sentinel missing `code`** — confirmed
precisely at all three call sites (`js/app.js:15806-15821`), identical gap
to the `claimAccess` bug already fixed this session.

**localStorage report photos unbounded until eviction** — did not
re-trace this one as deeply (lowest severity of the set, and I'd already
verified the cap/eviction mechanism it describes in earlier work this
session) — the mechanism it describes (`maxReportsPerDevice` cap,
non-own-reports-trimmed-first eviction) matches what I know of `saveReports()`.
Plausible and consistent with everything else checked; not independently
re-verified line-by-line here.

---

## "Suspected / needs device verification" and "Clean" sections

Didn't re-verify these as deeply since Cursor already correctly hedged
them as needing a real device rather than claiming them as confirmed —
that's the right call for things like WhatsApp handoff behavior and TWA
App Links, which genuinely can't be settled from static reading (same
conclusion I reached earlier this session on the WhatsApp prefill issue).

I did spot-check one "Clean" claim relevant to my own earlier work this
session — "double confetti after-photo: clean,
`showShareWinModal(..., {celebrate:false})` (~44136)" — confirmed exactly
right, grep shows all three `celebrate: false` sites present including
44136. No reason to doubt the rest of that list given this and the
P0/P1/P2 hit rate above.

---

## Bottom line

Ship the two P0 fixes above first — the XSS one is a small, low-risk,
mechanical change (wrap 4-5 existing values in the escaping function
that's already in the file); the sync-integrity one needs the small new
rollback helper but the pattern is clear. Want me to write the P1 sync-
honesty fixes out in full for all six functions, or the P0 #1 rollback
helper's exact code, before you hand this to Cursor?
