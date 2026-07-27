# CivicRadar — same "discarded error" pattern found in two more places

Cursor-ready spec. Verified against current code (v452). Follow-up to
[LOCATION-PERMISSION-DENIED-DEAD-END-SPEC.md](LOCATION-PERMISSION-DENIED-DEAD-END-SPEC.md)
— that fix covered the map's "Turn on location" banner. This spec covers
two more confirmed instances of the same shape found by a systematic
audit, plus a lighter-touch third one, and documents what was checked and
is already fine.

The general shape, same as before: an async operation can fail for
genuinely different reasons — some retriable, some permanently blocked —
but the error handler discards the detail that would tell them apart and
shows one message regardless, either implying a dead button will work, or
(worse, in one case below) actively mislabeling a good outcome as bad.

---

## Fix 1 (HIGH) — Profile's "Detect my ward" has the exact same geolocation bug

Same root cause as the map banner, same `getPrecisePosition()` source,
same fix shape — just a different call site and a toast instead of a
banner. This one is actually worse than the original: it offers no
fallback action at all, just a bare error toast implying "tap the button
again."

**Current** (`js/app.js:24309-24331`, `startProfileWardDetect`):
```js
    getPrecisePosition({ fresh: true, watchMaxMs: 5000, timeoutMs: 5000 })
      .then((pos) => {
        user.gpsConsent = true;
        saveUser();
        hideLocationBanner();
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
        const ward = detectWardFromCoords(currentLat, currentLng, city);
        const input = $('#profileWardInput');
        if (ward && input) {
          input.value = ward;
          clearSocietyOnWardChange(input, $('#profileSocietyInput'));
          refreshSocietyDatalist(city, ward);
          saveProfileWard();
          syncProfileIdentitySummary();
          showToast(t(getWardDetectedHintKey(city)), 'success', 2800);
        } else {
          showToast(t('onboard.wardDetectFailed'), 'error');
        }
      })
      .catch(() => {
        showToast(t('toast.gpsFail'), 'error');
      })
```

**Replace with:**
```js
    getPrecisePosition({ fresh: true, watchMaxMs: 5000, timeoutMs: 5000 })
      .then((pos) => {
        user.gpsConsent = true;
        saveUser();
        hideLocationBanner();
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
        const ward = detectWardFromCoords(currentLat, currentLng, city);
        const input = $('#profileWardInput');
        if (ward && input) {
          input.value = ward;
          clearSocietyOnWardChange(input, $('#profileSocietyInput'));
          refreshSocietyDatalist(city, ward);
          saveProfileWard();
          syncProfileIdentitySummary();
          showToast(t(getWardDetectedHintKey(city)), 'success', 2800);
        } else {
          showToast(t('onboard.wardDetectFailed'), 'error');
        }
      })
      .catch((err) => {
        showToast(err && err.code === 1 ? t('toast.gpsBlocked') : t('toast.gpsFail'), 'error');
      })
```

Add the new key next to `toast.gpsFail` (`js/app.js:5279`, same pattern in
hi/mr/gu blocks):
```js
      'toast.gpsBlocked': 'Location is blocked in your browser settings — allow it there, then try again.',
```

---

## Fix 2 (HIGH) — the inverse bug: `claimAccess` mislabels network/offline failures as "invalid code"

This is the more damaging variant. A person with a genuinely correct,
approved claim code who happens to be offline, mid-network-hiccup, or hits
a transient server error is told **"That code is not valid or not yet
approved"** — actively wrong, and likely to make them distrust or discard
a code that was never the problem.

**Root cause, part A** — `Backend.claimAccess`'s offline sentinel doesn't
match this codebase's own established convention. Every other backend
call that wants callers to detect "we're offline" uses `{ message:
'offline', code: 'backend_offline' }` (see `Backend.sendEmailCode`,
`js/app.js:15960`, and its callers checking `error.code ===
'backend_offline'` at `js/app.js:24951` and `:25070` — this is the
existing "good" pattern already used elsewhere in the file).
`claimAccess`'s offline branch is missing the `code` field entirely, so
there's nothing for a caller to even check:

**Current** (`js/app.js:15758-15762`):
```js
    async claimAccess(code) {
      if (!this.enabled) return { data: null, error: { message: 'offline' } };
      const { data, error } = await this.client.rpc('claim_access', { p_code: code });
      return { data, error: error || null };
    },
```

**Replace with:**
```js
    async claimAccess(code) {
      if (!this.enabled) return { data: null, error: { message: 'offline', code: 'backend_offline' } };
      const { data, error } = await this.client.rpc('claim_access', { p_code: code });
      return { data, error: error || null };
    },
```

**Root cause, part B** — the UI-level handler only ever checks for one
specific business-logic error (`code_used`) and dumps everything else,
including the offline sentinel from part A *and* any genuinely-thrown
network exception, into the same "invalid code" message:

**Current** (`js/app.js:17605-17621`):
```js
        const { data, error } = await Backend.claimAccess(code);

        if (error || !data) {

          const used = /code_used/i.test((error && error.message) || '');

          if (errEl) {

            errEl.textContent = used ? t('access.claimErrUsed') : t('access.claimErrInvalid');

            errEl.classList.remove('hidden');

          }

          return;

        }
```

**Replace with:**
```js
        const { data, error } = await Backend.claimAccess(code);

        if (error || !data) {

          const used = /code_used/i.test((error && error.message) || '');

          const offline = error && error.code === 'backend_offline';

          if (errEl) {

            errEl.textContent = used
              ? t('access.claimErrUsed')
              : offline
                ? t('access.claimErrOffline')
                : t('access.claimErrInvalid');

            errEl.classList.remove('hidden');

          }

          return;

        }
```

And the outer catch — this one matters just as much as part B, since a
**thrown** exception (a real network failure — `fetch` rejecting) means
the code was never actually checked against the server at all. Telling
the user their code is invalid here is definitely wrong, every time:

**Current** (`js/app.js:17671-17676`):
```js
    } catch (e) {

      if (errEl) { errEl.textContent = t('access.claimErrInvalid'); errEl.classList.remove('hidden'); }

      console.warn('Claim access failed:', (e && e.message) || e);

    } finally {
```

**Replace with:**
```js
    } catch (e) {

      if (errEl) { errEl.textContent = t('access.claimErrOffline'); errEl.classList.remove('hidden'); }

      console.warn('Claim access failed:', (e && e.message) || e);

    } finally {
```

Add the new key next to `access.claimErrInvalid` / `access.claimErrUsed`
(`js/app.js:5827-5829`, same pattern in hi/mr/gu blocks):
```js
      'access.claimErrOffline': 'Could not reach the server — check your connection and try again.',
```

---

## Fix 3 (MEDIUM, lighter touch) — onboarding ward-detect's Retry button doesn't know retrying is pointless

Same discarded-error shape as Fix 1, but lower severity here because
`showOnboardingWardDetectFailed()` already expands the manual ward picker
as a working fallback — this isn't a hard dead end like Fix 1/2 were. The
one remaining rough edge: it also unconditionally shows a **Retry**
button that, when the real cause is a permission block, can never
succeed.

**Current** (`js/app.js:25935-25949`):
```js
      .catch(() => {

        if (!(input && input.value.trim())) {

          showOnboardingWardDetectFailed();

        } else {

          $('#wardDetectStatus')?.classList.add('hidden');

          $('#btnWardRetry')?.classList.remove('hidden');

        }

      });
```

**Replace with:**
```js
      .catch((err) => {

        const blocked = err && err.code === 1;

        if (!(input && input.value.trim())) {

          showOnboardingWardDetectFailed();

          if (blocked) $('#btnWardRetry')?.classList.add('hidden');

        } else {

          $('#wardDetectStatus')?.classList.add('hidden');

          if (blocked) {

            $('#btnWardRetry')?.classList.add('hidden');

          } else {

            $('#btnWardRetry')?.classList.remove('hidden');

          }

        }

      });
```

Written as a post-hoc override rather than threading a parameter into
`showOnboardingWardDetectFailed()`, because that function has a second,
unrelated call site (`js/app.js:25925`, the "inside a city but no ward
match" case) where geolocation *succeeded* and Retry should keep showing
normally — not worth changing that function's signature for this.

---

## Documented, not fixed — lower priority

Found by the same audit, real but lower-impact; noting for awareness
rather than proposing patches here:

- **Submit-time GPS fallback** (`js/app.js:37341-37419`) and **confirm-pin
  GPS refine** (`js/app.js:36282-36434`) have the same discarded-error
  shape, but both already degrade to a working manual-pin fallback rather
  than a dead end, so the harm is limited to a slightly-generic hint
  message rather than a stuck user. The confirm-pin refine currently fails
  completely silently (no message at all) — worth a message eventually,
  not urgent.
- **Admin access-approve/reject** (`js/app.js:18670-18728`) — internal
  admin-only surface, low traffic. If an admin's session lapses
  server-side, "try again" won't help and they get no re-auth hint, but
  this isn't public-facing.
- **`insertFeedback`** (`js/app.js:16977-17019`) — lowest severity found;
  the textarea content isn't lost on failure, so a pointless retry costs
  the user almost nothing.

## Checked and confirmed clean — no action needed

- **Notification-permission flow** (`js/app.js:19943-20037`,
  `:20097-20131`, `:20231-20262`) — already differentiates granted/denied/
  unsupported correctly, already matches the "good" bar.
- **`navigator.clipboard.writeText` catch** (`js/app.js:416-436`) — a
  legitimate feature-fallback to `execCommand('copy')`, not a swallowed
  user-facing error.
- **Image moderation** (`ImageModeration.validateFile`/`scanCanvas`, all
  call sites) — already gives each rejection reason a distinct `i18nKey`.
- **Auth/email-code flows** (`js/app.js:24919-25150`) — already the
  established "good" pattern this spec's fixes now match (`backend_offline`
  branching, rate-limit/captcha differentiation via `formatAuthError()`).
- **`insertReport`/`insertPledge`** (`js/app.js:15660-15676`,
  `:15896-15909`) — local-first by design; the user's action already
  succeeded locally regardless of backend sync outcome, so this was never
  a dead-end shape to begin with.
- **Lead nomination/voting** (`js/app.js:18105-18129`, `:18393-18405`) —
  already differentiates specific business-logic outcomes
  (`already_nominated`, `self_vote`, etc.) before falling through to a
  generic case.

---

## Ship checklist reminder (per CLAUDE.md)

- Bump `CIVIC_APP_VERSION` in `js/app.js` (currently `v452`)
- Bump `CACHE` in `sw.js` to match
- Update SW06 in `tests/e2e_comprehensive.py` if it checks the cache string
- Manual check for Fix 1: block location in browser site settings, open
  Profile → Detect my ward — should show the new blocked-specific toast,
  not the generic one.
- Manual check for Fix 2: the cleanest repro is going offline (airplane
  mode) before attempting to claim an access code — should show "Could
  not reach the server," not "That code is not valid."
