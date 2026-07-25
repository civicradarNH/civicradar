# CivicRadar — remaining fixes to apply

Verified against the current code just now — **3 of the 5 issues found in this
session are already fixed** (someone ran a Cursor pass since the last report).
Confirmed fixed, no action needed:

- ✅ Dark map tiles (`css/styles.css` ~line 12808) — already scoped to
  `#map .leaflet-tile-pane, #reportPinMap .leaflet-tile-pane,
  body.map-popup-open #map .leaflet-tile-pane, body.map-popup-open
  #reportPinMap .leaflet-tile-pane` — beats both conflicting rules correctly.
- ✅ Analytics-toast overlapping the "be the first pin" sheet (`js/app.js`
  ~line 21290 and ~25535) — now deferred/suppressed while
  `body.map-empty-visible` / `#mapEmptyCta` is showing.
- ✅ Report photo stuck on "Capture" after decode (`js/app.js` ~line 27408,
  `scheduleShowPhotoConfirm`) — now races a `requestAnimationFrame` plus 50ms
  and 320ms `setTimeout` fallbacks, each idempotent and generation-guarded, so
  it can no longer get stranded if a single rAF tick doesn't fire.

Below are the **5 items still open**. Each has exact current file/line,
current code, and the exact replacement — paste directly into Cursor.

---

## 1. Photo moderation rejects legitimate stagnant-water photos (highest priority)

**File:** `js/image-moderation.js`, lines 14-18 (inside the `DEFAULTS` object).

**Problem:** the "blank/irrelevant image" heuristic measures brightness
variance and color-bucket count across a downsampled photo. Flat, still,
low-contrast subjects — which describes stagnant water, the app's primary
hazard type, almost exactly — can trip these thresholds even when the photo
is completely legitimate. This is the message users see: *"Use a photo of
the hazard — not a selfie, document, or blank image."*

**Current:**
```js
const DEFAULTS = {
  enabled: true,
  maxUploadBytes: 5 * 1024 * 1024,
  minWidth: 120,
  minHeight: 120,
  minColorVariance: 7,
  minUniqueColors: 12,
  maxSkinRatio: 0.52,
  minOutdoorRatio: 0.08,
  maxDocumentScore: 0.42,
  nsfwEnabled: true,
  nsfwThresholds: { Porn: 0.55, Hentai: 0.55, Sexy: 0.88 },
  nsfwCombinedAdult: 0.62,
  requireOnlineNsfw: false,
};
```

**Replace with:**
```js
const DEFAULTS = {
  enabled: true,
  maxUploadBytes: 5 * 1024 * 1024,
  minWidth: 120,
  minHeight: 120,
  minColorVariance: 4,
  minUniqueColors: 8,
  maxSkinRatio: 0.52,
  minOutdoorRatio: 0.08,
  maxDocumentScore: 0.42,
  nsfwEnabled: true,
  nsfwThresholds: { Porn: 0.55, Hentai: 0.55, Sexy: 0.88 },
  nsfwCombinedAdult: 0.62,
  requireOnlineNsfw: false,
};
```

Then in the same file, in `analyzePixels()` (search for
`if (uniqueColors < cfg.minUniqueColors...`), give a flat-but-clearly-outdoor
scene a pass even if it's under the color-variety bar, since `outdoorRatio` is
already computed a few lines above and is a stronger, more specific signal
than raw color count:

**Current:**
```js
    if (uniqueColors < cfg.minUniqueColors && lumStd < cfg.minColorVariance + 6) {
      return fail('irrelevant', 'Photo does not look like outdoor hazard evidence.', 'moderation.blocked.irrelevant');
    }
```

**Replace with:**
```js
    if (
      uniqueColors < cfg.minUniqueColors
      && lumStd < cfg.minColorVariance + 6
      && outdoorRatio < cfg.minOutdoorRatio
    ) {
      return fail('irrelevant', 'Photo does not look like outdoor hazard evidence.', 'moderation.blocked.irrelevant');
    }
```

*(This makes the "does not look like outdoor evidence" rejection require BOTH
low color variety AND a low outdoor-color signal, instead of color variety
alone — a flat but visibly outdoor/wet/muddy scene now survives.)*

---

## 2. Dead dark-mode rule: `.map-empty-cta__sheet` border

**File:** `css/styles.css`, line 14248.

**Problem:** a dark-mode-only rule at line 2793 sets a subtle translucent
border for this sheet in dark mode. A later, unconditional rule at line 14248
also sets `border-color` with the same specificity — and because it comes
later in the file, it always wins, in every color scheme, silently
overriding the dark-mode intent.

**Current (lines 14247-14251):**
```css
/* ---- Empty-ward sheet: quieter chrome (coach glass lives above) ---- */
.map-empty-cta__sheet {
  box-shadow: var(--shadow-lg);
  border-color: var(--border);
}
```

**Replace with:**
```css
/* ---- Empty-ward sheet: quieter chrome (coach glass lives above) ----
   border-color intentionally omitted here — the dark-mode block above
   (~line 2793) already sets it for dark mode; this rule used to duplicate
   it with equal specificity and silently win by source order. */
.map-empty-cta__sheet {
  box-shadow: var(--shadow-lg);
}
```

---

## 3. Dead dark-mode rule: `.coach-mark__handle`

**File:** `css/styles.css`, line 14260.

**Problem:** same pattern as #2. A dark-tuned rule at line 1173
(`background: #94a3b8; opacity: 0.5;`) is meant to apply in dark mode, but a
later unconditional duplicate at line 14260 always wins.

**Current (lines 14260-14263):**
```css
.coach-mark__handle {
  background: var(--ink-400);
  opacity: 0.55;
}
```

**Replace with:** delete this rule entirely — the base rule at line 901
already sets `background: var(--ink-400); opacity: 0.55;` for light mode
(confirm those exact values are present at line 901 before deleting), so this
is a pure duplicate with no unique light-mode value of its own, and removing
it lets the dark-mode override at line 1173 apply as intended.

---

## 4. Toasts can overlap the top banner row

**File:** `js/app.js`, `isAnyBannerVisible()` (search for that function name,
currently coordinates `appOpenBanner`, `referralWelcome`, `homeHero`,
`iosInstallHint`, `locationBanner`, `manualPinBanner`, `pwaInstallNudge`).

**Problem:** `#toastContainer` isn't part of this coordination. Toasts (GPS
status, save confirmations, etc.) can fire independently and their top offset
sits close enough to `.ios-install-hint` / `.location-banner` /
`.manual-pin-banner` that they can render overlapping, with no guard
preventing it — same root issue as the now-fixed analytics-toast/empty-cta
overlap, just for a different set of elements.

**Fix approach:** add a check for an active, visible toast
(`document.getElementById('toastContainer')?.children.length > 0`, or
similar — check how `isAnyBannerVisible()` currently detects visibility for
its other entries and match that pattern) to the trigger conditions for
`iosInstallHint`, `locationBanner`, and `manualPinBanner` specifically, so a
toast showing suppresses/delays those banners the same way `map-empty-visible`
now suppresses the analytics toast in the other direction.

*(This one needs you to look at the current `isAnyBannerVisible()` body to
match its existing style — the exact line numbers will depend on what else
has changed nearby; the other 4 fixes above are copy-paste, this one needs a
quick read-and-match.)*

---

## 5. Repo hygiene: accidentally committed scratch file

**File:** `scratchpad_darkblocks.txt` (1130 lines, repo root) — landed in the
last commit alongside the map-tile fix, looks like a working/debug file from
investigating the dark-mode CSS blocks, not something meant to ship.

**Fix:** delete the file and add `scratchpad_darkblocks.txt` (or `*.txt` if
there's a pattern of these) to `.gitignore` so it doesn't recur.

---

## Ship checklist reminder (per CLAUDE.md)

After applying these: bump `CIVIC_APP_VERSION` in `js/app.js`, match `CACHE`
in `sw.js` to the same version, update SW06 in
`tests/e2e_comprehensive.py` if it checks the cache string.
