# CivicRadar — one-tap self-resolve + neighbour reopen: implementation spec

Report only, no code changed by me — this is the exact spec to feed to
Cursor. Two parts: Part 1 is small and safe (removes a client-side
restriction the server never actually required). Part 2 is a real feature
addition (needs a new database function) — bigger, but still low-risk if
applied as written.

---

## Important finding while preparing this spec

The server-side RPC behind self-resolve, `resolve_own_report`
(`supabase/schema.sql:1720-1732`), **never required a complaint ID**:

```sql
create or replace function public.resolve_own_report(p_report_id uuid, p_resolution_image text default null)
...
  where id = p_report_id and reporter_id = auth.uid() and status = 'pending';
```

No `complaint_id` check anywhere in it. The requirement was **entirely a
client-side restriction** in `js/app.js`'s `resolveOwnReport()` — stricter
than what the backend was already willing to allow. That means Part 1 below
is not just low-risk, it's *removing* an inconsistency between client and
server, not introducing a new relaxation the backend has to catch up to.

---

## Part 1 — one-tap self-resolve, no complaint ID or photo required

### 1a. `js/app.js` — simplify `alreadyPinnedBlockHtml(report)`

Search for `function alreadyPinnedBlockHtml`.

**Current:**
```js
  function alreadyPinnedBlockHtml(report) {
    const label = t('confirm.alreadyPinned');
    const track = t('confirm.trackProfile');
    let ownerAction = '';
    if (ownsReport(report) && report.status === 'pending') {
      const rid = escapeHtml(String(report.id));
      if (report.complaintId) {
        ownerAction = `<button type="button" class="popup__btn popup__btn--secondary" data-resolve-own="${rid}">`
          + `<i class="ph ph-check-circle" aria-hidden="true"></i> ${escapeHtml(t('esc.selfBtn'))}</button>`;
      } else {
        ownerAction = `<button type="button" class="popup__btn popup__btn--secondary" data-open-escalation="${rid}">`
          + `<i class="ph ph-buildings" aria-hidden="true"></i> ${escapeHtml(t('esc.fileTitle'))}</button>`;
      }
    }
    return `<div class="popup__already-pinned">`
      + `<button type="button" class="popup__btn popup__btn--primary popup__btn--backed" disabled aria-disabled="true" aria-label="${escapeHtml(label)}">`
      + `<i class="ph ph-check-circle" aria-hidden="true"></i> ${escapeHtml(label)}</button>`
      + ownerAction
      + `<button type="button" class="popup__track-profile" data-goto-profile data-i18n="confirm.trackProfile">${escapeHtml(track)}</button>`
      + `</div>`;
  }
```

**Replace with:**
```js
  function alreadyPinnedBlockHtml(report) {
    const label = t('confirm.alreadyPinned');
    const track = t('confirm.trackProfile');
    let ownerAction = '';
    if (ownsReport(report) && report.status === 'pending') {
      // One tap, same trust level as reporting itself — no complaint ID or
      // photo required. The server (resolve_own_report RPC) never required
      // one either; this used to be a stricter client-only gate. Accuracy
      // is protected by reopenReport() below, not by upfront friction here.
      const rid = escapeHtml(String(report.id));
      ownerAction = `<button type="button" class="popup__btn popup__btn--secondary" data-resolve-own="${rid}">`
        + `<i class="ph ph-check-circle" aria-hidden="true"></i> ${escapeHtml(t('fix.markFixed'))}</button>`;
    }
    return `<div class="popup__already-pinned">`
      + `<button type="button" class="popup__btn popup__btn--primary popup__btn--backed" disabled aria-disabled="true" aria-label="${escapeHtml(label)}">`
      + `<i class="ph ph-check-circle" aria-hidden="true"></i> ${escapeHtml(label)}</button>`
      + ownerAction
      + `<button type="button" class="popup__track-profile" data-goto-profile data-i18n="confirm.trackProfile">${escapeHtml(track)}</button>`
      + `</div>`;
  }
```

The `data-open-escalation` click-delegation handler (search
`e.target.closest('[data-open-escalation]')`) can stay wired as-is — it's
just no longer triggered from this specific button. Safe to leave; optional
cleanup if you want to remove the now-dead branch.

### 1b. `js/app.js` — simplify `resolveOwnReport(reportId)`

Search for `function resolveOwnReport`.

**Current:**
```js
  function resolveOwnReport(reportId) {
    const report = findReportById(reportId);
    if (!report) return;
    const owned = report.reporterId ? report.reporterId === user.id : false;
    if (!owned) {
      showToast(t('toast.ownReportOnly'), 'error');
      return;
    }
    if (!report.complaintId) {
      showToast(t('toast.complaintFirst'), 'error', 4500);
      return;
    }
    if (applyResolution(reportId, 'citizen', null, 'self')) {
      closeModal('escalation');
      showToast(t('toast.selfResolved'), 'success', 4000);
      setTimeout(() => showShareWinModal(reportId, 'resolved'), 600);
    }
  }
```

**Replace with:**
```js
  function resolveOwnReport(reportId) {
    const report = findReportById(reportId);
    if (!report) return;
    const owned = report.reporterId ? report.reporterId === user.id : false;
    if (!owned) {
      showToast(t('toast.ownReportOnly'), 'error');
      return;
    }
    if (applyResolution(reportId, 'citizen', null, 'self')) {
      closeModal('escalation');
      showToast(t('toast.selfResolved'), 'success', 4000);
      setTimeout(() => showShareWinModal(reportId, 'resolved'), 600);
    }
  }
```

Just the complaint-ID gate removed. `closeModal('escalation')` is a
harmless no-op when this runs from the map popup (that modal isn't open in
that context) — no change needed there.

### 1c. New i18n key

Add `fix.markFixed`: **"Mark as fixed"** to the `en:` block near
`esc.selfBtn`, and matching translations to the `hi:`/`mr:`/`gu:` blocks
(same key, same position in each).

---

## Part 2 — let a neighbour (or the owner) reopen a wrongly-resolved report

This is the safety-net half of the design: since resolving no longer
requires proof, disputing a resolution needs to be exactly as easy, not
gated behind an admin. **No existing database function does this** — I
checked `supabase/schema.sql` for anything resolved→pending; nothing exists
except the BMC-only path inside `bmc_set_report_status`, which requires the
`bmc` role.

### 2a. New SQL function — add to `supabase/schema.sql`

Modeled directly on `resolve_own_report`'s style (same security-definer
pattern, same file). Authorization: the original reporter, or anyone who
already has a stake in this specific report (confirmed it via "Me too," or
already fix-confirmed it) — the same people who could act on the hazard
while it was open, not literally any signed-in user, to avoid pure griefing.

```sql
-- Reopen: lets the reporter, or a neighbour who corroborated (Me too) or
-- fix-confirmed the hazard, dispute a wrongly-resolved report. Deliberately
-- symmetric with resolve_own_report — same one-tap trust level, no evidence
-- required, because this dispute path IS the safety net, not a formality.
create or replace function public.reopen_report(p_report_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  rep record;
  has_stake boolean;
begin
  select * into rep from public.reports where id = p_report_id and status = 'resolved';
  if not found then raise exception 'not_resolved'; end if;

  if rep.reporter_id = auth.uid() then
    has_stake := true;
  else
    select exists(
      select 1 from public.report_confirmations
      where report_id = p_report_id and user_id = auth.uid()
    ) or exists(
      select 1 from public.report_fix_confirmations
      where report_id = p_report_id and user_id = auth.uid()
    ) into has_stake;
  end if;

  if not has_stake then
    raise exception 'not_authorized';
  end if;

  update public.reports set
    status = 'pending',
    resolved_by = null,
    resolved_at = null,
    resolution_source = null,
    resolution_image = null,
    community_verified_at = null
  where id = p_report_id;
end $$;

grant execute on function public.reopen_report(uuid) to authenticated;
```

**Please verify before applying:** I confirmed `report_fix_confirmations` is
a real table (used by `set_resolution_image` in the same schema file), but
I'm inferring the "Me too" confirmations table is called
`report_confirmations` by naming convention — grep `schema.sql` for the
actual table `confirmReport()`/`hasConfirmed()` write to on the client side
(search `js/app.js` for where a "Me too" tap syncs to Supabase) and correct
the table name here if it's different.

### 2b. `js/app.js` — add a `Backend` method

Near `updateReportResolution` inside the `Backend` object:

```js
    async reopenReport(id) {
      if (!this.enabled) return;
      const { error } = await this.client.rpc('reopen_report', { p_report_id: id });
      if (error) console.warn('Reopen sync failed:', error.message);
    },
```

### 2c. `js/app.js` — new local function, mirroring `applyResolution`

`applyResolution` (search `function applyResolution`) is the local-first
counterpart that `resolveOwnReport` calls before syncing to the backend.
Add a symmetric `applyReopen`, placed right after it, that mirrors the same
structure (load reports, find by id, flip status, save, sync, refresh UI):

```js
  function applyReopen(reportId) {
    const reports = loadReports();
    const idx = reports.findIndex((r) => String(r.id) === String(reportId));
    if (idx === -1) return false;
    if (reports[idx].status !== 'resolved') return false;

    reports[idx].status = 'pending';
    reports[idx].resolvedBy = null;
    reports[idx].resolvedAt = null;
    reports[idx].resolutionSource = null;
    reports[idx].resolutionImage = null;
    reports[idx].communityVerifiedAt = null;

    try {
      saveReports(reports);
    } catch (err) {
      showToast(t('toast.resolveFail'), 'error');
      return false;
    }

    Backend.reopenReport(reportId);

    if (window.CivicAnalytics) {
      CivicAnalytics.track('report_reopened', { reportId: String(reportId) }, reports[idx].ward);
    }

    if (reportMarkerLayer) refreshReportMarkers();
    updateProfileUI();
    updateCommunitySubtitle();
    renderWardChallenge();
    renderLeaderboard('wards');
    renderLeaderboard('citizens');
    updatePersonaUI();
    updateCommunityWinBadge();

    return true;
  }

  function reopenReport(reportId) {
    const report = findReportById(reportId);
    if (!report) return;
    const stake = ownsReport(report) || hasConfirmed(report.id) || hasFixConfirmed(report.id);
    if (!stake) {
      showToast(t('toast.ownReportOnly'), 'error');
      return;
    }
    if (applyReopen(reportId)) {
      showToast(t('toast.reopened'), 'info', 4000);
    }
  }
```

*(The UI-refresh calls at the end of `applyReopen` are copied from the end
of `applyResolution` — please diff against the current `applyResolution`
body when applying, in case anything's been added there since this spec was
written, and mirror the same list.)*

### 2d. `js/app.js` — render the reopen button in the popup

In `buildReportPopup()`, the `action` variable is only populated inside
`if (report.status === 'pending') { ... }` — for a resolved report it stays
empty. Add an `else if` branch right after that block closes:

**Find:**
```js
    let action = '';

    if (report.status === 'pending') {
      ...
    }

    const clearedLine = report.communityCleared
```

**Insert the new branch just before `const clearedLine`:**
```js
    } else if (
      report.status === 'resolved'
      && (ownsReport(report) || hasConfirmed(report.id) || hasFixConfirmed(report.id))
    ) {
      action = `<button type="button" class="popup__btn popup__btn--ghost" data-reopen="${escapeHtml(String(report.id))}">`
        + `<i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i> ${escapeHtml(t('fix.reopen'))}</button>`;
    }

    const clearedLine = report.communityCleared
```

*(This changes the existing `if (report.status === 'pending') { ... }` block
to `if (...) { ... } else if (...) { ... }` — make sure the closing brace of
the pending block is removed and reattached to the new `else if`, not left
as two separate top-level statements.)*

### 2e. `js/app.js` — wire the new button in the popup's click delegation

Right next to the existing `data-resolve-own` / `data-open-escalation`
handling (search `e.target.closest('[data-resolve-own]')`):

```js
      const reopenBtn = e.target.closest && e.target.closest('[data-reopen]');
      if (reopenBtn) {
        e.preventDefault();
        e.stopPropagation();
        reopenReport(reopenBtn.dataset.reopen);
        return;
      }
```

### 2f. New i18n keys

Add to the `en:` block (and matching translations to `hi:`/`mr:`/`gu:`):

- `fix.reopen`: **"Still there? Reopen"**
- `toast.reopened`: **"Reopened — thanks for keeping the map accurate."**

---

## Ship checklist reminder (per CLAUDE.md)

Bump `CIVIC_APP_VERSION` in `js/app.js`, match `CACHE` in `sw.js`, update SW06
in `tests/e2e_comprehensive.py`. Part 2 also needs the new
`reopen_report` SQL function run once in the Supabase SQL editor (same as
any other `schema.sql` addition) — it won't take effect just by editing the
file, per the project's own setup notes.
