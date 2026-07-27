# CivicRadar — map-shake and missing resolve option: root cause + exact fixes

Report only, no code changed. Two separate, unrelated bugs, both triggered by
clicking a pin on the map. Verified against the current code (v441).

Worth noting up front: the earlier GPS-refine map-jumping fix (`7321b37 map
movement`) is correctly implemented and not the cause here — this is a
**second, independent source of map movement**, specific to opening a pin
popup, that was never addressed.

---

## Bug 1 — map keeps moving when a pin popup opens

**Root cause:** a conflict between Leaflet's built-in popup auto-positioning
and this app's custom "sheet mode" popup (the bottom-docked card style used
on phones — every screenshot in this conversation).

`getReportPopupOptions()` (`js/app.js:20831`) sets `autoPan: true` and
`keepInView: true` on every pin popup. Leaflet's own `keepInView`/`autoPan`
logic works by tracking the popup's position *relative to the marker's
geographic anchor point*, and panning the map whenever it calculates that
position isn't fully visible.

But `applyPinPopupSheetMode()` (`js/app.js:20862`) — which runs whenever a
popup opens on a phone-sized screen — **reparents the popup's DOM element out
of Leaflet's map pane** (`host.appendChild(el)`, line 20874) and patches
Leaflet's internal `_updatePosition` method to force the popup's CSS
transform to `(0,0)` (lines 20877-20890), so the popup can be positioned
purely by CSS as a fixed bottom sheet instead of following the map's pan
transform.

That patch stops the *popup itself* from being repositioned by Leaflet's pan
math — but it does nothing to `autoPan`/`keepInView`, which are a *separate*
mechanism that keeps recalculating "is the popup, wherever it actually is,
within the visible map area?" using the marker's geographic position. Since
the popup's real on-screen position (CSS-fixed sheet at the bottom) no longer
has any relationship to where Leaflet's geographic math expects it to be,
that check can never resolve as "satisfied" — so Leaflet keeps calling
`panTo()` to "fix" it, the pan does nothing to change the popup's actual
(CSS-fixed) position, and it tries again. That's the repeated
map-moving-on-its-own behavior.

This explains why it's specifically tied to clicking a pin (any pin, new or
already-reported) and why it persisted after the GPS-refine fix, which
addressed a completely different code path.

### Fix

`js/app.js:20831-20858`, inside `getReportPopupOptions()`:

**Current:**
```js
    const opts = {
      maxWidth: sheet ? Math.min(420, (window.innerWidth || 360) - 24) : 320,
      minWidth: 180,
      maxHeight: maxH,
      autoPan: true,
      keepInView: true,
      className: sheet ? 'map-pin-popup map-pin-popup--sheet' : 'map-pin-popup',
```

**Replace with:**
```js
    const opts = {
      maxWidth: sheet ? Math.min(420, (window.innerWidth || 360) - 24) : 320,
      minWidth: 180,
      maxHeight: maxH,
      // Sheet mode positions the popup via CSS after applyPinPopupSheetMode()
      // reparents it out of the map pane — Leaflet's own autoPan/keepInView
      // then can't tell where it actually is and repeatedly re-pans trying
      // to "fix" a position that CSS already owns. Only the non-sheet
      // (desktop) popup, which Leaflet still positions itself, needs these.
      autoPan: !sheet,
      keepInView: !sheet,
      className: sheet ? 'map-pin-popup map-pin-popup--sheet' : 'map-pin-popup',
```

This keeps `autoPan`/`keepInView` for the desktop popup style (which Leaflet
still positions normally, so the conflict doesn't apply there) and disables
both for sheet mode, where the CSS positioning already guarantees the popup
is visible regardless of map pan — it doesn't need Leaflet's help to stay in
view.

---

## Bug 2 — no way for the reporter to mark their own hazard resolved

**Root cause:** two separate gates, both correctly implemented on their own,
that together leave the report owner with no path forward from the pin.

`buildReportPopup()` (`js/app.js:31148-31179`) builds the popup's action
area. The "Looks fixed" community-vote button is explicitly gated:

```js
if (!ownsReport(report)) {
  // ...renders the "Looks fixed" button here...
}
```

— correct: an app shouldn't let you vote "looks fixed" on your own report.
But for the owner's own pending report, the code takes the *other* branch:

```js
if (ownsReport(report) || hasConfirmed(report.id)) {
  action = alreadyPinnedBlockHtml();
}
```

And `alreadyPinnedBlockHtml()` (`js/app.js:21502-21510`) renders exactly two
things: a **disabled** "already pinned" pill (`disabled aria-disabled="true"`
— does nothing when tapped) and a "Track in Profile" button that just
navigates away. No resolve action, no explanation of how resolution actually
happens, nothing.

The app *does* have a real self-resolve mechanism —
`resolveOwnReport(reportId)` (`js/app.js:45386-45410`) — currently only
wired to a button inside the Escalation modal (`#btnEscResolveOwn`). It's
deliberately gated behind having already filed a complaint:

```js
if (!report.complaintId) {
  showToast(t('toast.complaintFirst'), 'error', 4500);
  return;
}
```

That gate is correct and shouldn't change — letting anyone instantly mark
their own report "resolved" with zero verification would be an obvious abuse
vector; requiring a saved BMC complaint number as proof is the right design.
**The actual bug is that this path is invisible from the pin popup.** An
owner tapping their own pin has no way to discover that filing with BMC
first, then self-confirming, is even possible — the popup just shows a dead
end.

### Fix

`js/app.js:21502-21510`, change `alreadyPinnedBlockHtml()` to accept the
report and branch on whether it's been filed:

**Current:**
```js
  function alreadyPinnedBlockHtml() {
    const label = t('confirm.alreadyPinned');
    const track = t('confirm.trackProfile');
    return `<div class="popup__already-pinned">`
      + `<button type="button" class="popup__btn popup__btn--primary popup__btn--backed" disabled aria-disabled="true" aria-label="${escapeHtml(label)}">`
      + `<i class="ph ph-check-circle" aria-hidden="true"></i> ${escapeHtml(label)}</button>`
      + `<button type="button" class="popup__track-profile" data-goto-profile data-i18n="confirm.trackProfile">${escapeHtml(track)}</button>`
      + `</div>`;
  }
```

**Replace with:**
```js
  function alreadyPinnedBlockHtml(report) {
    const label = t('confirm.alreadyPinned');
    const track = t('confirm.trackProfile');
    const owned = report && ownsReport(report);
    let resolveRow = '';
    if (owned && report.complaintId) {
      // Filed — the real self-resolve action already exists (resolveOwnReport),
      // just never surfaced here. Reuse it instead of the escalation-modal-only wiring.
      resolveRow = `<button type="button" class="popup__btn popup__btn--secondary" data-resolve-own="${escapeHtml(String(report.id))}">`
        + `<i class="ph ph-check-circle" aria-hidden="true"></i> ${escapeHtml(t('esc.selfBtn'))}</button>`;
    } else if (owned) {
      // Not filed yet — point at the one path that unlocks self-resolve,
      // instead of a dead end with no next step.
      resolveRow = `<button type="button" class="popup__btn popup__btn--secondary" data-open-escalation="${escapeHtml(String(report.id))}">`
        + `<i class="ph ph-megaphone" aria-hidden="true"></i> ${escapeHtml(t('esc.fileTitle'))}</button>`;
    }
    return `<div class="popup__already-pinned">`
      + `<button type="button" class="popup__btn popup__btn--primary popup__btn--backed" disabled aria-disabled="true" aria-label="${escapeHtml(label)}">`
      + `<i class="ph ph-check-circle" aria-hidden="true"></i> ${escapeHtml(label)}</button>`
      + resolveRow
      + `<button type="button" class="popup__track-profile" data-goto-profile data-i18n="confirm.trackProfile">${escapeHtml(track)}</button>`
      + `</div>`;
  }
```

Then update the one call site, `js/app.js:31154`:

**Current:**
```js
        action = alreadyPinnedBlockHtml();
```

**Replace with:**
```js
        action = alreadyPinnedBlockHtml(report);
```

Finally, wire the two new `data-` attributes wherever the popup's other
`data-*` actions are delegated (search for where `data-confirm`,
`data-fix-confirm`, `data-goto-profile` are handled — likely one shared
click-delegation function on the map or popup container):

```js
if (target.matches('[data-resolve-own]')) {
  resolveOwnReport(target.getAttribute('data-resolve-own'));
}
if (target.matches('[data-open-escalation]')) {
  const reportId = target.getAttribute('data-open-escalation');
  try { closeMapPinPopup(); } catch { /* ignore */ }
  window.openEscalationModal(reportId); // match whatever the existing "File with BMC" entry point is actually called
}
```

*(The exact function name for opening the escalation modal from a report id
should be confirmed against wherever the Profile "File with BMC" button
already does this — reuse that, don't add a second implementation.)*

---

## Ship checklist reminder (per CLAUDE.md)

Bump `CIVIC_APP_VERSION` in `js/app.js`, match `CACHE` in `sw.js`, update SW06
in `tests/e2e_comprehensive.py`.
