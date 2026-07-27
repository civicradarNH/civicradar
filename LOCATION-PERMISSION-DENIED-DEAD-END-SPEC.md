# CivicRadar — "Turn on location" banner never goes away when the browser has blocked location

Cursor-ready spec. Verified against current code (v452). Confirmed bug,
not a rendering glitch — reported by a closed tester on a second device.

## What's happening

The tester taps **Turn on** on the "Turn on location to pin hazards and
see nearby issues" banner. The banner briefly disappears, then
immediately reappears with the exact same message — no matter how many
times they tap it.

## Root cause

`enableLocationFromUser()` (`js/app.js:31112-31134`, the "Turn on" button's
handler) hides the banner immediately and calls `requestLocation(true,
true)`. That request goes through `getPrecisePosition()`
(`js/app.js:30230-30476`), which wraps the browser's real
`GeolocationPositionError` — the one with a `.code` of `1`
(`PERMISSION_DENIED`), `2` (`POSITION_UNAVAILABLE`), or `3` (`TIMEOUT`) —
and correctly propagates it up through rejection.

But `requestLocation()`'s own catch handler throws that information away:

**Current** (`js/app.js:31138-31186`, relevant tail):
```js
      .then((pos) => {

        applyLocationFromPosition(pos, { recenter, showAccuracyFeedback: true });

      })

      .catch(() => {

        showLocationBanner(t('location.bannerNearby'));

      })
```

The `.catch()` callback takes no parameter — it can't tell the difference
between "GPS timed out, try again" and "the browser has permanently
blocked location for this site." Most mobile browsers, once a user denies
(or a previous session denied) a location permission, **never show the
native permission prompt again** — every subsequent
`getCurrentPosition`/`watchPosition` call fails instantly and silently.
So for a tester in that state, tapping "Turn on" can *never* succeed, and
the app gives no indication of that — it just re-shows the identical
"Turn on location" banner every time, implying the one-tap fix will work
when it structurally cannot.

## Fix

Check the error code before deciding which banner message to show:

**Current** (`js/app.js:31174-31178`):
```js
      .catch(() => {

        showLocationBanner(t('location.bannerNearby'));

      })
```

**Replace with:**
```js
      .catch((err) => {

        showLocationBanner(err && err.code === 1 ? t('location.bannerBlocked') : t('location.bannerNearby'));

      })
```

Add the new key (`js/app.js:3322`, right after `location.bannerNearby`,
same pattern in the hi/mr/gu blocks — line numbers will shift slightly
after Fix on other reports have been applied, search for
`'location.bannerNearby'` in each language block):

```js
      'location.bannerBlocked': 'Location is blocked in your browser settings — allow it there, then reload.',
```

Suggested translations (same native-speaker-check caveat as always for
non-English copy from this session):
- Hindi: `'लोकेशन आपके ब्राउज़र सेटिंग्स में ब्लॉक है — वहाँ अनुमति दें, फिर पेज रीलोड करें।'`
- Marathi: `'तुमच्या ब्राउझर सेटिंग्जमध्ये लोकेशन ब्लॉक आहे — तिथे परवानगी द्या, मग पेज रीलोड करा.'`
- Gujarati: `'તમારા બ્રાઉઝર સેટિંગ્સમાં લોકેશન બ્લોક છે — ત્યાં મંજૂરી આપો, પછી પેજ રીલોડ કરો.'`

This leaves the existing "Turn on" button and dismiss (×) button exactly
as they are — no new UI, no browser-specific settings deep-link (those
vary too much across Chrome/Samsung Internet/Firefox and Android versions
to hardcode reliably). The fix is purely about not lying to the user about
what tapping the button will do: once blocked, the banner now tells them
where the actual fix lives (their browser's site settings) instead of
repeating a button that can't work.

## What does NOT change

- `location.bannerNearby` still shows for every other failure reason
  (`POSITION_UNAVAILABLE`, `TIMEOUT`, `no_geolocation`, `geo_failed`,
  `geo_timeout`, `geo_cancelled`) — all genuinely retriable, so re-showing
  the same "Turn on" banner is still the right call for those.
- No changes to `getPrecisePosition()`, `enableLocationFromUser()`, or the
  banner's HTML/CSS — the real `GeolocationPositionError` already reaches
  the catch handler intact; this fix just stops discarding it.

## One thing worth testing, not fixed blind here

Whether Android reports a fully-disabled system Location Services toggle
(as opposed to a per-site browser permission block) as `code === 1` or
`code === 2` varies by browser/OS version, and I can't verify which
without a real device. If testers on other Android versions report the
same dead-end with the new message *not* appearing (i.e. they're still
seeing the generic banner while their system location is fully off, not
just browser-blocked), that likely means that device reports `code === 2`
for this case — worth extending the same `err.code === 1` check to also
match `2` after confirming that's actually what's happening, rather than
guessing preemptively.

## Ship checklist reminder (per CLAUDE.md)

- Bump `CIVIC_APP_VERSION` in `js/app.js` (currently `v452`)
- Bump `CACHE` in `sw.js` to match
- Update SW06 in `tests/e2e_comprehensive.py` if it checks the cache string
- Manual check: in Chrome for Android, go to Site settings → Location →
  Block for the deployed URL, then open the app and tap "Turn on" — the
  banner should now show the new blocked-specific message instead of
  looping the same "Turn on location" text.
