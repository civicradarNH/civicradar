# CivicRadar — codebase-wide audit for the bug patterns found this session

Cursor-ready spec. Verified against current code (v451). This is the
output of a systematic three-part audit, each part hunting for more
instances of a bug class already confirmed and fixed this session:

1. **Double-fire race conditions** (the confetti-twice bug)
2. **Dead/unreachable conditional logic** (the "0 neighbours backed this"
   bug)
3. **Data-provenance mismatches** (the society/ward bug)

Two of the three categories turned up nothing new to fix — that's a good
result, not a wasted pass, and is documented below so the "already
checked, confirmed clean" list doesn't get re-audited later. The third
category (race conditions) turned up a genuinely more severe sibling of
the confetti bug, plus a real missing-points gap. Three fixes below.

---

## Fix 1 — HIGH confidence: adding an after-photo double-fires the celebration, for essentially every user who does it

**This isn't a rare timing race — it's a designed two-step flow that
double-fires by construction.** Sequence, all for the same report:

1. `handleCommunityAutoResolve()` (`js/app.js:22015-22072`) resolves the
   report and, if the owner is present, schedules `showShareWinModal(reportId,
   'community')` 700ms later (celebrate defaults to `true` — confetti,
   haptic, chime).
2. If there's no after-photo yet, the app itself schedules a toast 1500ms
   later inviting the owner to add one (`t('fix.addAfterPhoto')`, with
   `onClick: () => promptFixPhoto(reportId)`).
3. If the owner taps that — an entirely normal thing to do, since the app
   is the one suggesting it — `promptFixPhoto` opens a file picker, and on
   selection `handleFixPhotoCapture()` runs.

**Current** (`js/app.js:44039-44098`, relevant tail):
```js
      if (reportMarkerLayer) refreshReportMarkers();
      showToast(t('toast.fixPhotoAdded'), 'success', 3000);
      setTimeout(() => showShareWinModal(reportId, 'community'), 500);
    } catch {
      showToast(t('moderation.blocked.fileType'), 'error');
    }
    e.target.value = '';
  }
```

That last `showShareWinModal` call has no `{ celebrate: false }` — so it
fires confetti/haptic/chime a **second time** for the same win, ~1.7
seconds after the first one already did. The codebase already knows the
right fix pattern and uses it correctly elsewhere for "reopen to view/share"
calls (`js/app.js:20493`, `js/app.js:39433` both pass `{ celebrate: false
}`) — this one call site was just missed.

**Fix:**
```js
      if (reportMarkerLayer) refreshReportMarkers();
      showToast(t('toast.fixPhotoAdded'), 'success', 3000);
      setTimeout(() => showShareWinModal(reportId, 'community', { celebrate: false }), 500);
    } catch {
      showToast(t('moderation.blocked.fileType'), 'error');
    }
    e.target.value = '';
  }
```

The modal still opens (so the owner can see/share the updated card with
their new after-photo) — it just doesn't re-fire the celebration effects
that already played once for this same report.

---

## Fix 2 — MEDIUM confidence: two independently-deduped boot checkers can both target the same report

Two separate "did something change while the user was away" checkers run
on the same boot sequence, each with their own dedupe key, unaware of each
other:

- `checkResolvedWins()` (`js/app.js:43705-43745`, dedupe key
  `RESOLVED_SEEN_KEY`) — fires `showShareWinModal(id, 'resolved'|'community')`
  ~2000ms after boot for any of the user's own reports whose `status`
  transitioned to `'resolved'` since last seen.
- `collectCleanupReminders()` (`js/app.js:19738-19782`, dedupe key
  `REMINDER_CLEARED_PREV_KEY`) — fires `showShareWinModal(report.id,
  'cleanup')` via `processBootReminders()`, ~2600ms after boot, for any
  report whose `communityCleared` flag transitioned to `true` since last
  seen.

`communityCleared` (volunteer/NGO task completion) is tracked completely
independently of `status === 'resolved'`. If a report both gets
community-cleared *and* separately marked resolved between two app opens,
both checkers see a fresh transition on the same boot and both call
`showShareWinModal` for the same report within ~600ms of each other — a
second confetti burst, same shape as Fix 1.

**Current** (`js/app.js:19756-19776`):
```js
      out.push({

        priority: REMINDER_PRIORITY.cleanup,

        type: 'cleanup',

        meta: { reportId: id },

        show: () => {

          prev[id] = true;

          setReminderJson(REMINDER_CLEARED_PREV_KEY, prev);

          updateCommunityWinBadge();

          setTimeout(() => showShareWinModal(report.id, 'cleanup'), 800);

        },

      });
```

**Fix:** if the report is *also* already resolved, `checkResolvedWins()`
is the authoritative celebration path for it — the cleanup-reminder path
should still open the modal (so the "before/after" cleanup framing is
available) but skip re-celebrating:

```js
      out.push({

        priority: REMINDER_PRIORITY.cleanup,

        type: 'cleanup',

        meta: { reportId: id },

        show: () => {

          prev[id] = true;

          setReminderJson(REMINDER_CLEARED_PREV_KEY, prev);

          updateCommunityWinBadge();

          // If this report is ALSO already resolved, checkResolvedWins()
          // (js/app.js:43705) owns the celebration for it — two
          // independently-deduped boot checkers (RESOLVED_SEEN_KEY here,
          // REMINDER_CLEARED_PREV_KEY there) could otherwise both fire
          // confetti for the same report on the same boot.
          const claimedByResolvedCheck = report.status === 'resolved' && loadResolvedSeen().includes(id);

          setTimeout(() => showShareWinModal(report.id, 'cleanup', { celebrate: !claimedByResolvedCheck }), 800);

        },

      });
```

Lower priority than Fix 1 — this needs a report to transition on *two*
independent flags between sessions, a narrower real-world window than
Fix 1's "just tap the button the app suggests."

---

## Fix 3 — confirmed gap: self-resolving your own report awards 0 Civic Points, community-verified resolution awards 20

Not a race condition — a genuinely missing award. `POINTS_REPORT_RESOLVED`
(`js/app.js:695`, value `20`) is only ever passed to `addPointsCache()` in
one place in the entire file: `handleCommunityAutoResolve()`
(`js/app.js:22057`), inside its `if (ownsReport(report))` branch.
`resolveOwnReport()` (`js/app.js:45870-45905`) — the one-tap self-resolve
flow — calls `applyResolution()` and opens the Share Win modal, but never
awards the points a citizen would get if the exact same report had instead
been resolved via community confirmation.

**Current** (`js/app.js:45886-45903`):
```js
    if (applyResolution(reportId, 'citizen', null, 'self')) {

      try { closeMapPinPopup(); } catch { /* ignore */ }

      closeModal('escalation');

      // Mark seen before share-win so checkResolvedWins does not re-celebrate
      // (same gate as handleCommunityAutoResolve).
      const id = String(reportId);
      const seen = loadResolvedSeen();
      if (!seen.includes(id)) {
        seen.push(id);
        saveResolvedSeen(seen);
      }

      setTimeout(() => showShareWinModal(reportId, 'resolved'), 600);

    }
```

**Fix:**
```js
    if (applyResolution(reportId, 'citizen', null, 'self')) {

      try { closeMapPinPopup(); } catch { /* ignore */ }

      closeModal('escalation');

      // Mark seen before share-win so checkResolvedWins does not re-celebrate
      // (same gate as handleCommunityAutoResolve).
      const id = String(reportId);
      const seen = loadResolvedSeen();
      if (!seen.includes(id)) {
        seen.push(id);
        saveResolvedSeen(seen);
      }

      addPointsCache(POINTS_REPORT_RESOLVED);

      setTimeout(() => showShareWinModal(reportId, 'resolved'), 600);

    }
```

Scoped deliberately narrow: `resolveOwnReport()` is only reachable once
`owned` has already been verified true earlier in the same function
(`js/app.js:45876-45884`), so no extra `ownsReport()` check is needed here
— unlike `handleCommunityAutoResolve()`, which can run for reports the
current viewer doesn't own and has to gate the award explicitly.

**Related open question, not fixed here (needs its own investigation, not
a confirmed gap the same way):** it's unclear whether a report resolved
*by BMC* (`applyResolution(id, 'bmc', ...)`, run on the admin's own
device) ever awards the citizen owner points either — the admin's device
can't award points to someone else's account, and `checkResolvedWins()`
(which is what tells the owner their report got resolved while they were
away) doesn't call `addPointsCache` at all. If that's also a real gap,
it's a separate, larger fix (likely belongs in `checkResolvedWins()`
itself, awarding on discovery rather than on the triggering device) —
flagging for awareness, not proposing a fix here without tracing it
properly first.

---

## Audited, confirmed clean — no fix needed

**Dead/unreachable conditional logic** (the "0 neighbours backed this"
bug class): swept all ~60 `classList.toggle('hidden', ...)` call sites,
every `.hidden =` / `.disabled =` assignment, every `=== 0`/`> 0`/`<= 0`
ternary, and every fallback-chain variable (`X || Y`) in the file to see
if it ever feeds a boolean condition where one side is structurally
guaranteed. No second instance of the confirmed pattern found. One
low-confidence, not-currently-actionable note: `js/app.js:18764`
(`contactBtn` hide condition) and `js/app.js:18794`
(`getPartnerEmail()`) have the same *shape* (a `||`-chained email fallback
feeding a `!email` check), but unlike the confirmed bug's hardcoded
`'Mumbai'` literal fallback, this chain only becomes unreachable given
today's `js/config.js` values (`legal.grievanceEmail` and
`founder.operatorEmail` both set) — it's config-dependent, not
code-structurally dead. Not worth a fix; worth knowing about if those
config values ever get blanked out.

**Data-provenance mismatches** (the society/ward bug class): the original
bug (`js/app.js:36916`, report `society` field) is confirmed already fixed
in the current committed code — it now correctly only carries the user's
home society over when the report's detected ward matches their home
ward. Checked every other `generateId()`-based entity draft (pledge,
volunteer signup, volunteer task, lead nomination, access request,
feedback) — all of them correctly source location/scope fields either
from a form field specific to that submission or from a deliberately
read-only home-profile field (e.g. volunteer signup's ward is
intentionally tied to home ward by design, confirmed against the
`readonly` input in `index.html`). No sibling instances found. Two
non-user-visible deviations noted for completeness, not worth a fix:
`shareWhatsApp(msg, { ward: user.ward, ... })` at a few call sites
(`js/app.js:39111`, `:43887`, `:44532`) passes `user.ward` for analytics
tagging only — the actual message text always correctly uses the report's
own ward — and a rare fallback path in `flushNbhResolveDigest`
(`js/app.js:20527`) that's already gated to only fire for reports matching
the user's own neighbourhood, making the theoretical mismatch essentially
unreachable in practice.

---

## Ship checklist reminder (per CLAUDE.md)

- Bump `CIVIC_APP_VERSION` in `js/app.js` (currently `v451`)
- Bump `CACHE` in `sw.js` to match
- Update SW06 in `tests/e2e_comprehensive.py` if it checks the cache string
- Manual check for Fix 1: resolve a report via community confirmation,
  wait for the "add an after-photo" toast, add one — confirm confetti
  fires once (at the initial resolve), not again when the photo is added.
- Manual check for Fix 3: self-resolve a report, confirm Civic Points
  increase by 20, matching what community-verified resolution already
  does.
- Fix 2 is harder to manually trigger (needs a report both community-cleared
  and resolved between sessions) — code review confidence is sufficient
  here, a live repro isn't practical to force.
