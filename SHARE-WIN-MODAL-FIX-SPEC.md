# CivicRadar — Share Win modal: toast collision + demotivating zero-state

Cursor-ready spec. Verified against current code (v449). Three fixes, all
scoped to the self-resolve → "Share the win!" path — confirmed against the
user's own real-device screenshots of this exact flow.

---

## Fix 1 — toast and modal are guaranteed to collide

`resolveOwnReport()` (`js/app.js:45860-45888`) fires a 4-second toast, then
opens the Share Win modal 600ms later — the modal opens on top of the toast
with 3.4 seconds still left on its timer, which is exactly the messy
overlap visible in the screenshots (confetti dots and toast text sitting
on top of the modal's own "0 neighbours backed this" line).

**Current** (`js/app.js:45876-45886`):
```js
    if (applyResolution(reportId, 'citizen', null, 'self')) {

      try { closeMapPinPopup(); } catch { /* ignore */ }

      closeModal('escalation');

      showToast(t('toast.selfResolved'), 'success', 4000);

      setTimeout(() => showShareWinModal(reportId, 'resolved'), 600);

    }
```

**Replace with:**
```js
    if (applyResolution(reportId, 'citizen', null, 'self')) {

      try { closeMapPinPopup(); } catch { /* ignore */ }

      closeModal('escalation');

      setTimeout(() => showShareWinModal(reportId, 'resolved'), 600);

    }
```

The Share Win modal itself is a far richer confirmation than the toast
("Pinned in {ward}" → "Fixed", points, share/download tools) — the toast
was pure redundant clutter that only lived long enough to collide with the
thing that replaces it. `toast.selfResolved` isn't called anywhere else in
`js/app.js`, so this fully removes the collision rather than just
shortening the window for it.

---

## Fix 2 — "0 neighbours backed this" always shows, even though the code clearly meant to hide it

`showShareWinModal()` (`js/app.js:40728-40744`) tries to hide the impact
line when there's nothing to show:

```js
      impactEl.classList.toggle('hidden', n <= 0 && !ward);
```

`ward` comes from `getWardShortName(report.ward) || getCityLabel()` two
lines above — it is *never* empty, so `!ward` is always `false`, which
makes `n <= 0 && !ward` always `false` too. The hide branch is dead code:
every freshly-resolved report (confirmations always start at 0) leads with
"0 neighbours backed this," directly undercutting the "Share the win!"
headline right above it.

**Current** (`js/app.js:40728-40744`):
```js
    const impactEl = $('#shareWinImpact');

    if (impactEl) {

      const n = Number(report.confirmations) || 0;

      const ward = getWardShortName(report.ward) || getCityLabel();

      impactEl.textContent = t('shareWin.impact')

        .replace('{n}', String(n))

        .replace('{ward}', ward);

      impactEl.classList.toggle('hidden', n <= 0 && !ward);

    }
```

**Replace with:**
```js
    const impactEl = $('#shareWinImpact');

    if (impactEl) {

      const n = Number(report.confirmations) || 0;

      const ward = getWardShortName(report.ward) || getCityLabel();

      impactEl.textContent = n > 0

        ? t('shareWin.impact').replace('{n}', String(n)).replace('{ward}', ward)

        : t('shareWin.impactZero').replace('{ward}', ward);

      impactEl.classList.remove('hidden');

    }
```

Rather than hiding the line at zero (which would also drop the ward
context it carries), give zero its own non-demotivating phrasing — see
Fix 3 for the new string.

---

## Fix 3 — "screenshot this win!" contradicts the buttons directly below it

`shareWin.impact` currently reads: *"{n} neighbours backed this — {ward} —
screenshot this win!"* — but the modal already has purpose-built **Share
win on WhatsApp** and **Download success card** buttons right underneath.
Telling the user to manually screenshot reads like leftover copy from
before those existed.

**Current** (`js/app.js:4669`, English block — same edit applies to the
hi/mr/gu blocks at lines 7315, 9961, 12606):
```js
      'shareWin.impact': '{n} neighbours backed this — {ward} — screenshot this win!',
```

**Replace with:**
```js
      'shareWin.impact': '{n} neighbours backed this in {ward}.',

      'shareWin.impactZero': 'Share so more of {ward} sees it fixed.',
```

Suggested translations for the new `shareWin.impactZero` key (matching
each language's existing tone in this file):
- Hindi: `'{ward} में और लोगों तक पहुँचाने के लिए शेयर करें।'`
- Marathi: `'{ward} मध्ये अधिक लोकांपर्यंत पोहोचण्यासाठी शेअर करा.'`
- Gujarati: `'{ward} માં વધુ લોકો સુધી પહોંચવા શેર કરો.'`

*(Have a native speaker sanity-check these three before shipping — they're
directionally correct but not verified the way the English rewrite is.)*

Also trim the existing `shareWin.impact` translations to drop their own
"screenshot this win!" equivalent, matching the English simplification:
- Hindi (`js/app.js:7315`): `'{n} पड़ोसियों ने समर्थन किया — {ward}.'`
- Marathi (`js/app.js:9961`): `'{n} शेजाऱ्यांनी पाठिंबा दिला — {ward}.'`
- Gujarati (`js/app.js:12606`): `'{n} પડોશીઓએ ટેકો — {ward}.'` (drop the
  trailing 🏆 + "સ્ક્રીનશોટ કરો" clause for the same reason)

---

## What does NOT change

- No changes to the before/after photo comparison logic
  (`js/app.js:40748-40799`) — the checkmark "Fixed" placeholder for
  reports with no resolution photo is working as designed, a deliberate
  consequence of self-resolve no longer requiring photo evidence
  (see [RESOLVE-AND-REOPEN-SPEC.md](RESOLVE-AND-REOPEN-SPEC.md)). Not part
  of this fix.
- No changes to `showShareWinModal`'s subtitle logic, aspect toggle,
  download/share button wiring, or any other resolve path
  (community-confirmed, BMC-confirmed) — scoped strictly to the
  self-resolve toast/impact-line issues confirmed above.

---

## Ship checklist reminder (per CLAUDE.md)

- Bump `CIVIC_APP_VERSION` in `js/app.js` (currently `v449`)
- Bump `CACHE` in `sw.js` to match
- Update SW06 in `tests/e2e_comprehensive.py` if it checks the cache string
- Quick manual check after applying: self-resolve a test report and
  confirm the Share Win modal opens cleanly with no toast underneath it,
  and that the impact line reads sensibly at both 0 and >0 confirmations.
