# CivicRadar — two unrelated bugs, both confirmed in code: wrong society on out-of-area reports, and double confetti on self-resolve

Cursor-ready spec. Verified against current code (v449). Two independent
fixes — bundled in one doc since both surfaced from the same round of
real-device screenshots, not because they're related.

---

## Bug 1 — a report's `society` can belong to a completely different ward than the report itself

**Symptom:** an auto-generated share caption read *"I helped clean up
Zaveri Bazaar CHS · H/E Ward"* — Zaveri Bazaar CHS is the user's home
society (South Mumbai, C Ward, per their own Profile screen), but the
report being shared was pinned in H/E Ward (Bandra East/Khar East), miles
away. The combination doesn't correspond to any real place.

**Root cause:** `js/app.js:36900-36919`, where a new report's draft object
is built:

```js
    const draft = {

      id: generateId(),

      hazard,

      notes: ($('#reportNotes')?.value ?? ''),

      image: lastReportDataUrl,

      ward: resolveReportWard(lat, lng),

      city: getUserCity(),

      society: user.society || '',

      reporter: user.displayName || 'Citizen',

      reporterId: user.id,

      lat,

      lng,

      timestamp: new Date().toISOString(),

    };
```

`ward` is correctly derived from the report's actual GPS coordinates via
`resolveReportWard(lat, lng)` — but `society` is unconditionally copied
from the user's **home profile**, with no check that the report is
anywhere near that society. Any time someone reports a hazard outside
their home ward (travelling, visiting family, anywhere but home), the
report ends up tagged with a society that has nothing to do with where it
actually is. This isn't just a display nit — `report.society` feeds
`getReportShareLocation()` (`js/app.js:39447-39473`), which is what builds
the caption text people actually see on shared social cards.

**Fix:**

```js
    const detectedWard = resolveReportWard(lat, lng);

    const draft = {

      id: generateId(),

      hazard,

      notes: ($('#reportNotes')?.value ?? ''),

      image: lastReportDataUrl,

      ward: detectedWard,

      city: getUserCity(),

      society: (detectedWard && detectedWard === user.ward) ? (user.society || '') : '',

      reporter: user.displayName || 'Citizen',

      reporterId: user.id,

      lat,

      lng,

      timestamp: new Date().toISOString(),

    };
```

Only carries `user.society` over when the report's detected ward matches
the user's own home ward (the common case, and the only case where the
society is actually relevant). Outside that, `society` stays empty and
`getReportShareLocation()`'s existing fallback chain
(`report.neighbourhood` → ward's area name → ward short name) takes over
correctly — no other change needed there.

*(Scoped to this one confirmed call site — the main "submit a hazard
report" flow. Didn't chase every other `generateId()` site in the file
without evidence any of them have the same issue; if you spot the same
"home society on an away report" pattern elsewhere after this ships,
same fix applies.)*

---

## Bug 2 — self-resolving can fire the celebration confetti twice

**Symptom:** confetti burst plays twice after marking your own report
resolved.

**Root cause:** two independent code paths can both decide to open the
Share Win modal (which unconditionally fires `launchConfetti()` at
`js/app.js:40821-40825`) for the same report:

1. `resolveOwnReport()` (`js/app.js:45884-45892`) opens it directly, 600ms
   after you resolve.
2. `checkResolvedWins()` (`js/app.js:43705-43743`) — run on a boot/resume
   timer via `runBootSequence()`, ~1200ms after the app loads — separately
   scans your own reports for anything resolved-but-not-yet-"seen," and
   opens the *same* modal 800ms after *that*.

If you resolve a report within the first couple of seconds of opening the
app (entirely normal — e.g. you opened the app specifically to mark
something fixed), both timers land close together. `checkResolvedWins()`
has no way to know `resolveOwnReport()` is already about to show the
modal for this exact report, finds it "unseen," and fires its own copy —
each call to `showShareWinModal()` triggers its own confetti burst
independently.

The fix already exists elsewhere in the codebase and just wasn't applied
here: `handleCommunityAutoResolve()` (`js/app.js:22045-22061`) marks the
report as "seen" in the same list `checkResolvedWins()` reads, *before*
scheduling its own `showShareWinModal()` call — so `checkResolvedWins()`
never finds it "fresh" later. `resolveOwnReport()` is missing that same
guard.

**Current** (`js/app.js:45884-45892`):
```js
    if (applyResolution(reportId, 'citizen', null, 'self')) {

      try { closeMapPinPopup(); } catch { /* ignore */ }

      closeModal('escalation');

      setTimeout(() => showShareWinModal(reportId, 'resolved'), 600);

    }
```

**Replace with:**
```js
    if (applyResolution(reportId, 'citizen', null, 'self')) {

      try { closeMapPinPopup(); } catch { /* ignore */ }

      closeModal('escalation');

      // Mark seen synchronously, mirroring handleCommunityAutoResolve()
      // (js/app.js:22045-22056) — otherwise checkResolvedWins()'s own
      // boot/resume timer can find this same report "unseen" and open a
      // second copy of this modal (and fire confetti a second time) a
      // few hundred ms later.
      const seenIds = loadResolvedSeen();

      const idStr = String(reportId);

      if (!seenIds.includes(idStr)) saveResolvedSeen([...seenIds, idStr]);

      setTimeout(() => showShareWinModal(reportId, 'resolved'), 600);

    }
```

`loadResolvedSeen`/`saveResolvedSeen` are both already defined earlier in
the same file (`js/app.js:43677-43697`) and already in scope here — no new
imports or helpers needed.

---

## What does NOT change

- Bug 1's fix touches only the main report-submission draft object — no
  changes to `resolveReportWard()`, `getReportShareLocation()`, or any
  share-caption template.
- Bug 2's fix touches only `resolveOwnReport()` — `handleCommunityAutoResolve()`
  (already correct), `checkResolvedWins()`, and `applyResolution()` itself
  are unchanged. The same class of race is theoretically possible anywhere
  else that calls `showShareWinModal()` directly without this guard
  (`js/app.js:19772`, `:44091`) — not touched here since neither was the
  reported symptom, but worth the same fix if the same double-fire is ever
  seen from those paths.

---

## Ship checklist reminder (per CLAUDE.md)

- Bump `CIVIC_APP_VERSION` in `js/app.js` (currently `v449`)
- Bump `CACHE` in `sw.js` to match
- Update SW06 in `tests/e2e_comprehensive.py` if it checks the cache string
- Manual check for Bug 1: report a hazard while GPS-located outside your
  profile's home ward, confirm the share caption doesn't show your home
  society.
- Manual check for Bug 2: open the app fresh and self-resolve a report
  within the first couple of seconds — confirm confetti fires once, not
  twice, and the Share Win modal opens only once.
