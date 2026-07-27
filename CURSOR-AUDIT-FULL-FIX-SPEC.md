# CivicRadar — full fix spec for the 2026-07-26 Cursor audit findings

Cursor-ready spec. Verified against current code (v453) — every finding
below was independently confirmed by direct tracing before being included
here (see [CURSOR-AUDIT-VERIFICATION.md](CURSOR-AUDIT-VERIFICATION.md) for
the verification evidence). This doc is the follow-up: exact code for
every fix, in priority order.

**One honest caveat before the fixes**, discovered while designing them:
the codebase's existing "offline-safe" pattern (`syncPending` flag +
`Backend.pushLocalOwned()`) only retries fresh **inserts** — its report
path calls `syncReportInsert()` → the `insert_report` RPC, which creates a
*new* row and would fail on a primary-key conflict if the report already
exists. It does **not** retry updates (resolve/reopen/file/cleanup) to a
report's existing server row. So for those four mutation types, this spec
does the honest, buildable-right-now thing — make the failure **visible**
instead of silent, and flag `syncPending` for future reconciliation — but
does **not** claim to have wired up automatic retry for them, because that
retry path doesn't actually exist yet. Building it would be a reasonable
follow-up but is a bigger, separate piece of work than what's below.

---

## Fix 1 — P0: community "Looks fixed" can resolve locally with no confirmed server write

`js/app.js:22227-22263` (inside `confirmFix()`):

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

          // RPC failed (network/server error) — this is NOT the same as
          // "succeeded, threshold not yet reached." Do not locally resolve
          // on an unconfirmed count. Roll the optimistic confirmation back.
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

Add the new rollback helper right next to `loadFixConfirmedSet()`
(`js/app.js:21946-21952`), mirroring `unclaimConfirmation()`
(`js/app.js:21630-21638`) but also reversing the count and the points that
were already optimistically awarded earlier in `confirmFix()`:

```js
  function unclaimFixConfirmation(reportId) {

    const id = String(reportId);

    const set = loadFixConfirmedSet();

    set.delete(id);

    try { safeLocalSet(FIX_CONFIRMED_KEY, JSON.stringify(Array.from(set))); } catch {}

    const reports = loadReports();

    const idx = reports.findIndex((r) => String(r.id) === id);

    if (idx !== -1) {

      reports[idx].fixConfirmations = Math.max(0, (Number(reports[idx].fixConfirmations) || 0) - 1);

      try { saveReports(reports); } catch { /* best effort */ }

    }

    addPointsCache(-POINTS_FIX_CONFIRM);

    if (reportMarkerLayer) refreshReportMarkers();

    updateProfileUI();

  }
```

*(Local-only mode — `Backend.enabled === false` — is untouched: the
`else` branch's unconditional `finishResolve()` is correct there since
there's no server to fail against.)*

---

## Fix 2 — P0: stored XSS via unescaped report image URLs

Five call sites, all get the same one-line-per-`src` treatment —
`escapeHtml()` (`js/app.js:2988-3004`) already exists and already escapes
`"`/`'` correctly, it's just not applied to these specific values.

### 2a. `buildBeforeAfterSliderHtml()` — `js/app.js:39711-39728`

**Current:**
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

### 2b. `buildSuccessStoryThumbHtml()` — `js/app.js:39401-39427`

**Current:**
```js
              `<img src="${report.image}" alt="">` +
              `<span class="proof-flip-label">${beforeLabel}</span>` +
            `</div>` +
            `<div class="proof-flip-face proof-flip-face--back">` +
              `<img src="${report.resolutionImage}" alt="">` +
```
```js
    const thumb = hasAfter ? report.resolutionImage : (hasBefore ? report.image : '');
    if (thumb) {
      return `<img class="success-story-card__thumb" src="${thumb}" alt="">`;
    }
```

**Replace with:**
```js
              `<img src="${escapeHtml(report.image)}" alt="">` +
              `<span class="proof-flip-label">${beforeLabel}</span>` +
            `</div>` +
            `<div class="proof-flip-face proof-flip-face--back">` +
              `<img src="${escapeHtml(report.resolutionImage)}" alt="">` +
```
```js
    const thumb = hasAfter ? report.resolutionImage : (hasBefore ? report.image : '');
    if (thumb) {
      return `<img class="success-story-card__thumb" src="${escapeHtml(thumb)}" alt="">`;
    }
```

### 2c. Share Win modal `#shareWinProof` — `js/app.js:40825-40841`

**Current:**
```js
            ${hasBefore ? `<img src="${report.image}" alt="">` : '<div class="proof-compare__placeholder">—</div>'}
```
```js
            ${hasAfter ? `<img src="${report.resolutionImage}" alt="">` : `<div class="proof-compare__placeholder proof-compare__placeholder--fixed"><span class="proof-compare__check">✓</span><span>${escapeHtml(t('shareWin.fixedLabel'))}</span></div>`}
```

**Replace with:**
```js
            ${hasBefore ? `<img src="${escapeHtml(report.image)}" alt="">` : '<div class="proof-compare__placeholder">—</div>'}
```
```js
            ${hasAfter ? `<img src="${escapeHtml(report.resolutionImage)}" alt="">` : `<div class="proof-compare__placeholder proof-compare__placeholder--fixed"><span class="proof-compare__check">✓</span><span>${escapeHtml(t('shareWin.fixedLabel'))}</span></div>`}
```

### 2d. Profile report cards — `js/app.js:45411-45447`

**Current:**
```js
        const safeImg = isSafeReportImage(r.image) ? r.image : '';

        const safeAfter = isSafeReportImage(r.resolutionImage) ? r.resolutionImage : '';
```

**Replace with:**
```js
        const safeImg = isSafeReportImage(r.image) ? escapeHtml(r.image) : '';

        const safeAfter = isSafeReportImage(r.resolutionImage) ? escapeHtml(r.resolutionImage) : '';
```

*(Everywhere downstream in this function already does `src="${safeImg}"` /
`src="${safeAfter}"` — escaping at the point of assignment here covers
every use of these two variables lower in the function without touching
each template individually.)*

### 2e. Admin queue thumbs — `js/app.js:46967-46969`

Same pattern as the others — find the `src="${...}"` (or equivalent
report-image-field interpolation) in this range and wrap it the same way.
*(I traced 2a-2d directly against the live file; this one I'm including on
Cursor's citation plus the 100% consistency of the pattern everywhere else
it appears — verify the exact local variable name at this specific site
before applying, since I did not re-read it myself.)*

### 2f. Server-side hardening (defense in depth — do after 2a-2e, not instead of)

Client-side escaping stops the XSS from *executing* in this app's own UI.
It doesn't stop a malicious value from being *stored*, which matters if
any other client or API consumer ever renders the same field unsafely.

**`supabase/schema.sql:1784-1811`, `set_resolution_image`** — currently
has zero validation on `p_image`. Add a format check before the update:

```sql
create or replace function public.set_resolution_image(p_report_id uuid, p_image text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  rep record;
  is_confirmer boolean;
begin
  select * into rep from public.reports where id = p_report_id and status = 'resolved';
  if not found then raise exception 'not_resolved'; end if;

  if rep.resolution_image is not null then
    raise exception 'already_set';
  end if;

  if rep.reporter_id <> auth.uid() then
    select exists(
      select 1 from public.report_fix_confirmations
      where report_id = p_report_id and user_id = auth.uid()
    ) into is_confirmer;
    if not is_confirmer then
      raise exception 'not_authorized';
    end if;
  end if;

  if p_image is not null
     and p_image !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'
     and p_image !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/report-photos/'
  then
    raise exception 'invalid_image_format';
  end if;

  update public.reports set resolution_image = p_image where id = p_report_id;
end $$;
```

Adjust the `https://...supabase.co` pattern to your actual project ref if
you'd rather pin it exactly instead of matching any `*.supabase.co` host.

**`supabase/schema.sql:2043-2105`, `insert_report`** — same idea, insert
this check right after the existing `p_hazard` validation (around line
2072, before `cid := ...`):

```sql
  if p_image is not null
     and btrim(p_image) <> ''
     and p_image !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'
     and p_image !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/report-photos/'
  then
    raise exception 'invalid_image_format';
  end if;
```

---

## Fix 3 — P1: silent sync failures across resolve / reopen / file / cleanup / Me too / flag

All six `Backend.*` functions currently return `undefined` on both success
*and* failure — no caller can react even if it wanted to. Fix each
function to return a usable signal, then fix each caller.

### 3a. `Backend.updateReportResolution` — `js/app.js:15833-15858`

**Current** (tail):
```js
      if (error) console.warn('Resolution sync failed:', error.message);
    },
```

**Replace with:**
```js
      if (error) { console.warn('Resolution sync failed:', error.message); return false; }
      return true;
    },
```

**Caller 1 — `applyResolution()`, `js/app.js:45634-45644`:**

**Current:**
```js
    Backend.updateReportResolution(

      reportId, 'resolved', by, resolvedAt,

      resolutionImage || reports[idx].resolutionImage,

      src,

      reports[idx].communityVerifiedAt || null

    );
```

**Replace with:**
```js
    Backend.updateReportResolution(

      reportId, 'resolved', by, resolvedAt,

      resolutionImage || reports[idx].resolutionImage,

      src,

      reports[idx].communityVerifiedAt || null

    ).then((ok) => {

      if (!ok) {

        Backend.markReportSyncPending(reportId, true);

        showToast(t('toast.syncLocal'), 'info', 3500);

      }

    });
```

**Caller 2 — `handleFixPhotoCapture()`, `js/app.js:44129` area** (the
"attach an after-photo" flow) — same treatment: find the
`Backend.updateReportResolution(...)` call there and append the identical
`.then((ok) => { if (!ok) { Backend.markReportSyncPending(reportId, true); showToast(t('toast.syncLocal'), 'info', 3500); } });`.

### 3b. `Backend.reopenReport` — `js/app.js:15860-15864`

**Current:**
```js
    async reopenReport(id) {
      if (!this.enabled) return;
      const { error } = await this.client.rpc('reopen_report', { p_report_id: id });
      if (error) console.warn('Reopen sync failed:', error.message);
    },
```

**Replace with:**
```js
    async reopenReport(id) {
      if (!this.enabled) return true;
      const { error } = await this.client.rpc('reopen_report', { p_report_id: id });
      if (error) { console.warn('Reopen sync failed:', error.message); return false; }
      return true;
    },
```

**Caller — `applyReopen()`, `js/app.js:45724`:**

**Current:**
```js
    Backend.reopenReport(reportId);
```

**Replace with:**
```js
    Backend.reopenReport(reportId).then((ok) => {

      if (!ok) {

        Backend.markReportSyncPending(reportId, true);

        showToast(t('toast.syncLocal'), 'info', 3500);

      }

    });
```

### 3c. `Backend.updateReportFiling` — `js/app.js:15866-15872`

**Current:**
```js
    async updateReportFiling(id, complaintId, filedAt) {
      if (!this.enabled) return;
      const { error } = await this.client.rpc('bmc_set_report_status', {
        p_report_id: id, p_complaint_id: complaintId, p_filed_at: filedAt,
      });
      if (error) console.warn('Filing sync failed:', error.message);
    },
```

**Replace with:**
```js
    async updateReportFiling(id, complaintId, filedAt) {
      if (!this.enabled) return true;
      const { error } = await this.client.rpc('bmc_set_report_status', {
        p_report_id: id, p_complaint_id: complaintId, p_filed_at: filedAt,
      });
      if (error) { console.warn('Filing sync failed:', error.message); return false; }
      return true;
    },
```

**Caller — `js/app.js:43319`:**

**Current:**
```js
    Backend.updateReportFiling(activeEscalationId, val, reports[idx].filedAt);
```

**Replace with:**
```js
    Backend.updateReportFiling(activeEscalationId, val, reports[idx].filedAt).then((ok) => {

      if (!ok) {

        Backend.markReportSyncPending(activeEscalationId, true);

        showToast(t('toast.syncLocal'), 'info', 3500);

      }

    });
```

*(Your saved complaint number stays visible either way — this only
affects whether other viewers/devices see it until the next successful
sync. Don't erase `complaintId` on failure; the user's input is still
true, just not yet synced.)*

### 3d. `Backend.updateReportCleanup` — `js/app.js:15874-15880`

**Current:**
```js
    async updateReportCleanup(id, cleared, by) {
      if (!this.enabled) return;
      const { error } = await this.client.rpc('ngo_mark_cleared', {
        p_report_id: id, p_cleared: cleared, p_cleared_by: by,
      });
      if (error) console.warn('Cleanup sync failed:', error.message);
    },
```

**Replace with:**
```js
    async updateReportCleanup(id, cleared, by) {
      if (!this.enabled) return true;
      const { error } = await this.client.rpc('ngo_mark_cleared', {
        p_report_id: id, p_cleared: cleared, p_cleared_by: by,
      });
      if (error) { console.warn('Cleanup sync failed:', error.message); return false; }
      return true;
    },
```

**Caller 1 — `completeVolunteerTask()`, `js/app.js:47733`:**

**Current:**
```js
      Backend.updateReportCleanup(reports[rIdx].id, true, reports[rIdx].clearedBy);
```

**Replace with:**
```js
      Backend.updateReportCleanup(reports[rIdx].id, true, reports[rIdx].clearedBy).then((ok) => {

        if (!ok) {

          Backend.markReportSyncPending(reports[rIdx].id, true);

          showToast(t('toast.syncLocal'), 'info', 3500);

        }

      });
```

**Caller 2 — `logCommunityCleanup()`, `js/app.js:47879`:** identical
change, same `.then(...)` block, using `reports[idx].id`.

### 3e. `Backend.flagReport` — `js/app.js` (near `confirmFix`/`flagReport` block)

Lower stakes — nothing celebratory or points-based to roll back, this is
a moderation signal. Light touch: just surface a toast on failure, no
rollback needed.

**Current:**
```js
    async flagReport(id) {
      if (!this.enabled) return;
      const { error } = await this.client.rpc('flag_report', { p_report_id: id });
      if (error) console.warn('Flag sync failed:', error.message);
    },
```

**Replace with:**
```js
    async flagReport(id) {
      if (!this.enabled) return true;
      const { error } = await this.client.rpc('flag_report', { p_report_id: id });
      if (error) { console.warn('Flag sync failed:', error.message); return false; }
      return true;
    },
```

**Caller — `js/app.js:14405`:**

**Current:**
```js
      Backend.flagReport(id);
```

**Replace with:**
```js
      Backend.flagReport(id).then((ok) => {

        if (!ok) showToast(t('toast.syncLocal'), 'info', 3500);

      });
```

*(The report is already hidden on this device regardless — that's local
and instant. This only affects whether the moderation team's queue
learns about it.)*

---

## Fix 4 — P1: Me too is fully fire-and-forget

`js/app.js:15883-15887`:

**Current:**
```js
    async confirmReport(id) {
      if (!this.enabled) return;
      const { error } = await this.client.rpc('confirm_report', { p_report_id: id });
      if (error) console.warn('Confirm sync failed:', error.message);
    },
```

**Replace with:**
```js
    async confirmReport(id) {
      if (!this.enabled) return true;
      const { error } = await this.client.rpc('confirm_report', { p_report_id: id });
      if (error) { console.warn('Confirm sync failed:', error.message); return false; }
      return true;
    },
```

`js/app.js:21889` (inside `confirmReport()`, the UI function — keep the
optimistic instant feedback exactly as-is, just react afterward):

**Current:**
```js
    Backend.confirmReport(reportId);

    addPointsCache(POINTS_ME_TOO);
```

**Replace with:**
```js
    Backend.confirmReport(reportId).then((ok) => {

      if (!ok) unclaimMeTooConfirmation(reportId);

    });

    addPointsCache(POINTS_ME_TOO);
```

Add the rollback helper next to `unclaimConfirmation()`
(`js/app.js:21630-21638`):

```js
  function unclaimMeTooConfirmation(reportId) {

    const id = String(reportId);

    unclaimConfirmation(id);

    const reports = loadReports();

    const idx = reports.findIndex((r) => String(r.id) === id);

    if (idx !== -1) {

      reports[idx].confirmations = Math.max(0, (Number(reports[idx].confirmations) || 0) - 1);

      try { saveReports(reports); } catch { /* best effort */ }

    }

    addPointsCache(-POINTS_ME_TOO);

    if (reportMarkerLayer) refreshReportMarkers();

    updateProfileUI();

    showToast(t('toast.syncLocal'), 'info', 3500);

  }
```

Deliberately does **not** try to undo the haptic/confetti/chip animation
that already played — that's cosmetic and already over by the time this
fires; only the count and points (the things that actually persist and
affect the leaderboard) get reversed.

---

## Fix 5 — P1: `toast.wardRequired` hardcodes Mumbai in hi/mr/gu

**Current** (`js/app.js:7896`, `:10549`, `:13202`):
```js
      'toast.wardRequired': 'मुंबई की आधिकारिक सूची से वार्ड चुनें।',
```
```js
      'toast.wardRequired': 'मुंबईच्या अधिकृत यादीतून वॉर्ड निवडा.',
```
```js
      'toast.wardRequired': 'મુંબઈની અધિકૃત યાદીમાંથી વોર્ડ પસંદ કરો.',
```

**Replace with** (mirrors English's `{city}` placeholder exactly):
```js
      'toast.wardRequired': '{city} की आधिकारिक सूची से वार्ड चुनें।',
```
```js
      'toast.wardRequired': '{city} च्या अधिकृत यादीतून वॉर्ड निवडा.',
```
```js
      'toast.wardRequired': '{city} ની અધિકૃત યાદીમાંથી વોર્ડ પસંદ કરો.',
```

No caller changes needed — all three call sites (`js/app.js:2698`,
`:32076`, `:43622`) already do `.replace('{city}', getCityLabel(...))`;
they've just had nothing to replace until now.

*(Same native-speaker-check caveat as always for my non-English text —
these three are minimal, single-word-swap edits to strings a human
translator already wrote, so risk is low, but worth a glance.)*

---

## Fix 6 — P2: onboarding GPS-blocked copy still says "turn on location"

Corrected citation from the verification pass: the actual displayed
string is `onboard.wardError`, not `onboard.wardDetectFailed`.

`js/app.js:25965-25991` (the onboarding ward-detect catch block, already
patched once this session to hide the Retry button when blocked):

**Current:**
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

**Replace with:**
```js
      .catch((err) => {

        const blocked = err && err.code === 1;

        if (!(input && input.value.trim())) {

          showOnboardingWardDetectFailed();

          if (blocked) {

            $('#btnWardRetry')?.classList.add('hidden');

            const errEl = $('#wardError');

            if (errEl) errEl.textContent = t('location.bannerBlocked');

          }

        } else {

          $('#wardDetectStatus')?.classList.add('hidden');

          if (blocked) {

            $('#btnWardRetry')?.classList.add('hidden');

            const errEl = $('#wardError');

            if (errEl) errEl.textContent = t('location.bannerBlocked');

          } else {

            $('#btnWardRetry')?.classList.remove('hidden');

          }

        }

      });
```

Reuses the `location.bannerBlocked` string added earlier this session
("Location is blocked in your browser settings — allow it there, then
reload.") rather than adding a near-duplicate key — same underlying fact,
same fix pattern, no new translation work needed.

---

## Fix 7 — P2: lead nominate/vote/list offline sentinel missing `code`

`js/app.js:15806-15821`:

**Current:**
```js
    async nominateForLead(payload) {
      if (!this.enabled) return { data: null, error: { message: 'offline' } };
      const { data, error } = await this.client.rpc('nominate_for_lead', payload);
      return { data, error: error || null };
    },

    async voteForLead(nominationId) {
      if (!this.enabled) return { data: null, error: { message: 'offline' } };
      const { data, error } = await this.client.rpc('vote_for_lead', { p_nomination_id: nominationId });
      return { data, error: error || null };
    },

    async listLeadNominations(city, ward, neighbourhood) {
      if (!this.enabled) return { data: [], error: { message: 'offline' } };
```

**Replace with:**
```js
    async nominateForLead(payload) {
      if (!this.enabled) return { data: null, error: { message: 'offline', code: 'backend_offline' } };
      const { data, error } = await this.client.rpc('nominate_for_lead', payload);
      return { data, error: error || null };
    },

    async voteForLead(nominationId) {
      if (!this.enabled) return { data: null, error: { message: 'offline', code: 'backend_offline' } };
      const { data, error } = await this.client.rpc('vote_for_lead', { p_nomination_id: nominationId });
      return { data, error: error || null };
    },

    async listLeadNominations(city, ward, neighbourhood) {
      if (!this.enabled) return { data: [], error: { message: 'offline', code: 'backend_offline' } };
```

Now wire the two callers that discriminate error types to actually use it
— reusing `access.claimErrOffline` ("Could not reach the server — check
your connection and try again.") rather than adding another near-duplicate
key, since the message is generic enough to fit both contexts.

**`js/app.js:18135-18159` (`nominateForLead` UI caller):**

**Current:**
```js
        const { error } = await Backend.nominateForLead(rpcPayload);

        if (error) {

          const msg = (error.message || '').toLowerCase();

          if (/already_nominated/.test(msg)) {

            if (errEl) { errEl.textContent = t('lead.errAlreadyNominated'); errEl.classList.remove('hidden'); }

            return;

          }

          if (/already_lead/.test(msg)) {

            if (errEl) { errEl.textContent = t('lead.errAlreadyLead'); errEl.classList.remove('hidden'); }

            return;

          }

          throw new Error(error.message || 'submit_failed');

        }
```

**Replace with:**
```js
        const { error } = await Backend.nominateForLead(rpcPayload);

        if (error) {

          if (error.code === 'backend_offline') {

            if (errEl) { errEl.textContent = t('access.claimErrOffline'); errEl.classList.remove('hidden'); }

            return;

          }

          const msg = (error.message || '').toLowerCase();

          if (/already_nominated/.test(msg)) {

            if (errEl) { errEl.textContent = t('lead.errAlreadyNominated'); errEl.classList.remove('hidden'); }

            return;

          }

          if (/already_lead/.test(msg)) {

            if (errEl) { errEl.textContent = t('lead.errAlreadyLead'); errEl.classList.remove('hidden'); }

            return;

          }

          throw new Error(error.message || 'submit_failed');

        }
```

**`js/app.js:18423-18433` (`voteForLead` UI caller):**

**Current:**
```js
        const { data, error } = await Backend.voteForLead(nominationId);

        if (error) {

          const msg = (error.message || '').toLowerCase();

          if (/self_vote/.test(msg)) { showToast(t('lead.errSelfVote'), 'error', 4000); return; }

          if (/already_voted/.test(msg)) { showToast(t('lead.errAlreadyVoted'), 'warning'); return; }

          throw new Error(error.message || 'vote_failed');
```

**Replace with:**
```js
        const { data, error } = await Backend.voteForLead(nominationId);

        if (error) {

          if (error.code === 'backend_offline') { showToast(t('access.claimErrOffline'), 'error', 4000); return; }

          const msg = (error.message || '').toLowerCase();

          if (/self_vote/.test(msg)) { showToast(t('lead.errSelfVote'), 'error', 4000); return; }

          if (/already_voted/.test(msg)) { showToast(t('lead.errAlreadyVoted'), 'warning'); return; }

          throw new Error(error.message || 'vote_failed');
```

`listLeadNominations` doesn't need a caller change — it already
gracefully falls back to `data || []` / local nominations regardless of
error detail, so adding the `code` field there is just for consistency,
not because anything currently depends on it.

---

## Not fully spec'd here — flagged for a deliberate decision, not a quick fix

**P2 — Civic XP is client-computed and upward-ratchetable.** Confirmed
real (`getTotalCivicXp()` is pure local math; `sync_civic_xp` caps each
call at +2000 but has no cooldown between calls). Fixing this properly
means deriving XP server-side from audited actions (report inserts,
confirm RPCs) rather than trusting a client-submitted number at all —
that's a real architecture change, not a diff-sized fix, so I haven't
written it out. If you want a stopgap instead of the full fix: add a
per-user cooldown to `sync_civic_xp` (e.g. reject calls within N seconds
of the last successful one, tracked in a new column or a simple rate-limit
table) — meaningfully raises the bar without the bigger rework. Say the
word if you want that stopgap speced out precisely.

**P2 — localStorage report photos unbounded until quota eviction.**
Real, lower severity (performance/reliability, not correctness), and the
proper fix ("prefer Storage URLs in the local cache once uploaded, strip
the data URL") touches the same save/load path as everything else in this
doc. Worth its own focused pass rather than bolting onto this one — flag
if you want it done next.

---

## Ship checklist reminder (per CLAUDE.md)

- Bump `CIVIC_APP_VERSION` in `js/app.js` (currently `v453`)
- Bump `CACHE` in `sw.js` to match
- Update SW06 in `tests/e2e_comprehensive.py` if it checks the cache string
- Run the two SQL migrations (Fix 2f) directly in the Supabase SQL editor
  — `create or replace function` is safe to re-run, but review the regex
  patterns against a couple of real stored `image`/`resolution_image`
  values first to make sure nothing legitimate gets rejected before
  applying to production.
- Manual check for Fix 1: simulate a `confirm_fix` failure (e.g. temporarily
  break the RPC name in a local branch, or test on a flaky connection) and
  confirm the fix-confirmation count and points both revert, no phantom
  resolve.
- Manual check for Fix 2: submit a report via direct RPC call (Postman/curl
  with a valid session token) with `p_image` containing a `"` character —
  confirm it's now rejected server-side, and confirm existing legitimate
  reports still render correctly after the client-side escaping change.
- Manual check for Fix 4: airplane-mode a Me-too tap, confirm the count and
  points both revert and a toast appears.
