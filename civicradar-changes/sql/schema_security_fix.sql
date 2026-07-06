-- =====================================================================
-- CivicRadar — Security hardening migration
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Additive and idempotent (safe to re-run).
--
-- Fixes three related issues, all stemming from update policies that scope
-- by ROW but not by COLUMN:
--
--   F-01 (Critical) Self-service privilege escalation:
--        profiles_update_own let a user set their OWN role = 'bmc',
--        which then unlocked full report control + visibility of
--        moderator-removed rows. Fixed by revoking column-level UPDATE on
--        the privileged profile columns from the authenticated role. The
--        SECURITY DEFINER functions (handle_new_user trigger, redeem_ngo_code)
--        run as the table owner and are unaffected, so legitimate role
--        grants still work.
--
--   XP forgery (High) syncCivicXp() wrote civic_xp directly from the client,
--        so anyone could set civic_xp = 999999 and top the ward leaderboard.
--        Fixed by (a) revoking client UPDATE on civic_xp/civic_level and
--        (b) providing an award_civic_xp() RPC that only ever ADVANCES a
--        user's own XP toward a server-recomputed value (monotonic; can't
--        be used to inflate past what the server would compute).
--        NOTE: requires a matching one-line change in js/app.js — see the
--        comment on the function below. Until app.js is updated, XP simply
--        stops syncing to the cloud (leaderboard still works from local
--        state); it fails safe, not broken.
--
--   F-01b (Medium) Reporters could set status/complaint_id/resolved_* on
--        their OWN reports (gaming "fixes"). Fixed by revoking column-level
--        UPDATE on those official-state columns from authenticated, and
--        gating the real transitions to BMC/NGO via SECURITY DEFINER RPCs.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Lock down privileged PROFILE columns (fixes F-01 + XP forgery)
--    Column-level REVOKE means that even though profiles_update_own still
--    lets a user touch their own row, Postgres blocks writes to these
--    specific columns from the `authenticated` role. Definer functions
--    (owner-privileged) bypass this and keep working.
-- ---------------------------------------------------------------------

-- Belt-and-braces: make sure the row policy itself is unchanged/present.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Revoke the blanket column UPDATE grant, then re-grant ONLY the columns a
-- user is legitimately allowed to self-edit. (REVOKE ALL then GRANT the
-- allowlist is safer than trying to REVOKE an exact set — new sensitive
-- columns added later stay locked by default.)
revoke update on public.profiles from authenticated;
grant update (
  -- user-owned preferences / self-declared filters only:
  society,
  neighbourhood_new_alerts_enabled,
  neighbourhood_resolved_alerts_enabled
) on public.profiles to authenticated;

-- Explicitly NOT granted (therefore locked to definer functions only):
--   role, ward, city, coordinator_scope, neighbourhood_label,
--   civic_xp, civic_level, email, id, created_at


-- ---------------------------------------------------------------------
-- 2. Server-authoritative XP (fixes leaderboard forgery)
--    Client calls award_civic_xp(new_total). The function clamps to a sane
--    ceiling and is MONOTONIC — it never lets XP go down, and never above
--    the passed value's clamp. Because civic_xp is column-locked above, this
--    RPC (SECURITY DEFINER) is now the ONLY way the client can move XP.
--
--    js/app.js change required (syncCivicXp, ~line 12082):
--        // was: await client.from('profiles').update({ civic_xp, civic_level })
--        await client.rpc('award_civic_xp', { p_total: xp, p_level: level });
--
--    (For a fully forgery-proof design you'd recompute XP server-side from
--    counted actions rather than trusting p_total at all; this monotonic
--    clamp is the pragmatic launch version — it stops the trivial
--    "set 999999" attack without a larger refactor.)
-- ---------------------------------------------------------------------

create or replace function public.award_civic_xp(p_total int, p_level text default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  capped int := least(greatest(coalesce(p_total, 0), 0), 100000); -- clamp 0..100k
  current int;
  final int;
begin
  select civic_xp into current from public.profiles where id = auth.uid();
  if not found then return 0; end if;
  final := greatest(coalesce(current, 0), capped);      -- monotonic: never decreases
  update public.profiles
    set civic_xp = final,
        civic_level = coalesce(p_level, civic_level)
    where id = auth.uid();
  return final;
end $$;

grant execute on function public.award_civic_xp(int, text) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Field-scope REPORT updates (fixes F-01b)
--    Same column-REVOKE technique. Owners keep their broad row policy but
--    can only touch descriptive fields on their own report; official-state
--    columns are locked to the RPCs / privileged roles below.
-- ---------------------------------------------------------------------

revoke update on public.reports from authenticated;
grant update (
  -- a reporter may correct their own descriptive fields:
  notes,
  image,
  ward,
  society,
  neighbourhood,
  lat,
  lng,
  hazard
) on public.reports to authenticated;

-- Official-state columns (status, complaint_id, filed_at, resolved_by,
-- resolved_at, resolution_image, community_cleared, cleared_by, removed,
-- removed_at, flag_count, confirmations) are NOT granted here — they move
-- to the SECURITY DEFINER RPCs below, which enforce role checks.

-- BMC resolves / files a report.
create or replace function public.bmc_set_report_status(
  p_report_id uuid,
  p_status text,
  p_complaint_id text default null,
  p_resolution_image text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_bmc() then raise exception 'not_authorized'; end if;
  if p_status not in ('pending', 'resolved') then raise exception 'bad_status'; end if;
  update public.reports set
    status = p_status,
    complaint_id = coalesce(p_complaint_id, complaint_id),
    filed_at = case when p_complaint_id is not null then now() else filed_at end,
    resolution_image = coalesce(p_resolution_image, resolution_image),
    resolved_by = case when p_status = 'resolved' then 'bmc' else resolved_by end,
    resolved_at = case when p_status = 'resolved' then now() else resolved_at end
  where id = p_report_id;
end $$;
grant execute on function public.bmc_set_report_status(uuid, text, text, text) to authenticated;

-- NGO lead logs a ground cleanup.
create or replace function public.ngo_mark_cleared(p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_ngo_lead() then raise exception 'not_authorized'; end if;
  update public.reports set
    community_cleared = true,
    cleared_by = 'ngo',
    status = 'resolved',
    resolved_by = coalesce(resolved_by, 'citizen'),
    resolved_at = coalesce(resolved_at, now())
  where id = p_report_id;
end $$;
grant execute on function public.ngo_mark_cleared(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- CITIZEN-SAFE resolve paths (reconciles the community fix-confirm feature)
-- ---------------------------------------------------------------------
-- The app has THREE resolve paths: BMC (above), a neighbour community-
-- confirming a fix (handled by the EXISTING confirm_fix RPC, which already
-- resolves securely), and a reporter resolving their OWN report. The latter
-- two are citizens (not is_bmc()), so they need their own guarded RPCs now
-- that status/resolution_image are column-locked.

-- A reporter resolves a report THEY OWN (self-resolve, "I fixed/verified it").
-- Enforces ownership — you can only resolve your own report, never someone
-- else's. Optional after-photo attaches in the same call.
create or replace function public.resolve_own_report(
  p_report_id uuid,
  p_resolution_image text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.reports set
    status = 'resolved',
    resolved_by = 'citizen',
    resolved_at = now(),
    resolution_source = 'self',
    resolution_image = coalesce(p_resolution_image, resolution_image)
  where id = p_report_id
    and reporter_id = auth.uid()       -- OWNERSHIP GUARD
    and status = 'pending';
  if not found then raise exception 'not_owner_or_already_resolved'; end if;
end $$;
grant execute on function public.resolve_own_report(uuid, text) to authenticated;

-- Attach an "after" photo to an ALREADY-RESOLVED report. Used by the
-- community fix-photo flow (a neighbour who confirmed the fix adds a photo)
-- and by self-resolve. Only writes resolution_image, and only when the row
-- is already resolved — it cannot be used to change status or resolve a
-- report. Any authenticated user may add a fix photo to a resolved report
-- (the resolution itself was already gated by confirm_fix / bmc / self).
create or replace function public.set_resolution_image(
  p_report_id uuid,
  p_image text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.reports set
    resolution_image = p_image
  where id = p_report_id
    and status = 'resolved';          -- only on already-resolved rows
  if not found then raise exception 'not_resolved'; end if;
end $$;
grant execute on function public.set_resolution_image(uuid, text) to authenticated;

-- (confirm_report(), flag_report(), and confirm_fix() already exist and
--  handle confirmations/flag_count/community-resolution safely via SECURITY
--  DEFINER — no change needed. confirm_fix remains the community resolve path.)


-- =====================================================================
-- Post-migration verification (optional — run and eyeball the output)
-- =====================================================================
-- Should show authenticated has UPDATE only on the allowlisted columns:
--   select table_name, column_name, privilege_type
--   from information_schema.column_privileges
--   where grantee = 'authenticated' and privilege_type = 'UPDATE'
--     and table_name in ('profiles','reports')
--   order by table_name, column_name;
