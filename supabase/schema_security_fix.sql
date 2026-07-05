-- SUPERSEDED — this file's content (profiles column-lock + sync_civic_xp) is
-- now folded directly into schema.sql's "Column-level privilege hardening —
-- migration v125" section, which also adds the equivalent reports-table
-- lockdown. Re-running schema.sql alone is now sufficient for fresh installs;
-- this file is kept only for history / anyone who ran it standalone before
-- v125 (safe no-op to re-run either way — REVOKE/GRANT and OR REPLACE are
-- both idempotent).
--
-- CivicRadar — Security fix: column-level privilege escalation on public.profiles
-- Run this ONCE, after the original schema.sql, in Supabase SQL Editor.
-- Safe to re-run (uses REVOKE/GRANT and OR REPLACE, both idempotent).
--
-- THE HOLE
-- --------
-- The "profiles_update_own" RLS policy (schema.sql) only checks *row*
-- ownership:
--   using (auth.uid() = id) with check (auth.uid() = id)
-- Row Level Security in Postgres gates which ROWS a query can touch — it does
-- NOT restrict which COLUMNS an allowed UPDATE can change. Since `role` and
-- `civic_xp`/`civic_level` live on that same row, any signed-in user
-- (including CivicRadar's anonymous auth — every citizen gets a real
-- auth.uid()) could currently open the browser console and run:
--
--   supabase.from('profiles').update({ role: 'bmc' }).eq('id', myOwnId)
--
-- ...and instantly grant themselves BMC admin powers (resolve any report,
-- see the admin queue), or:
--
--   supabase.from('profiles').update({ civic_xp: 999999999 }).eq('id', myOwnId)
--
-- ...and fake their way to the top of every leaderboard. The RLS policy
-- itself was working exactly as written — this was a column-privilege gap,
-- not a broken policy.
--
-- THE FIX
-- -------
-- Postgres has a second, independent privilege layer for exactly this:
-- column-level GRANT/REVOKE. RLS still decides which rows; this decides which
-- columns, regardless of any RLS policy that exists now or is added later.
--
--   1. Revoke the blanket UPDATE grant on profiles, then grant UPDATE back
--      only on the specific columns citizens legitimately self-edit. `role`,
--      `civic_xp`, `civic_level`, `id`, `email`, `created_at` are deliberately
--      left off the list — nothing a client sends can touch them, no matter
--      what payload it tries.
--   2. `role` needs no replacement write path — every legitimate role grant
--      already goes through a dedicated SECURITY DEFINER function elsewhere
--      in schema.sql (claim-code redemption, peer-vote threshold). Those
--      still work unchanged; they run as the table owner, not the caller.
--   3. `civic_xp`/`civic_level` DO need a replacement, since the app
--      legitimately syncs XP after every report/confirmation. `sync_civic_xp`
--      below is a guarded RPC: XP can only move up (never reset someone's
--      progress backwards) and can only jump by a bounded amount per call
--      (2000 — generous next to the 8-200 XP a single action awards per the
--      in-app copy), so a console call can't set it to an arbitrary number.
--
-- =====================================================================

-- 1) Explicit allow-list of client-writable columns on profiles.
revoke update on public.profiles from authenticated;
grant update (
  ward,
  coordinator_scope,
  neighbourhood_label,
  society,
  neighbourhood_new_alerts_enabled,
  neighbourhood_resolved_alerts_enabled
) on public.profiles to authenticated;

-- 2) Guarded XP sync — replaces the direct civic_xp/civic_level column write
--    in js/app.js's Backend.syncCivicXp(). SECURITY DEFINER runs as the table
--    owner, so it isn't blocked by the column grant above, but only through
--    code we control (with the ratchet + cap checks below), not a raw client
--    UPDATE.
create or replace function public.sync_civic_xp(p_xp int, p_level text)
returns void
language plpgsql security definer set search_path = public as $$
declare current_xp int;
begin
  select civic_xp into current_xp from public.profiles where id = auth.uid();
  if current_xp is null then return; end if;
  if p_xp <= current_xp or p_xp - current_xp > 2000 then
    return;
  end if;
  update public.profiles set civic_xp = p_xp, civic_level = p_level where id = auth.uid();
end $$;

grant execute on function public.sync_civic_xp(int, text) to anon, authenticated;

-- =====================================================================
-- 3) VERIFICATION — run this by itself, after the two blocks above.
-- Uncomment and run. If the fix worked, this returns ZERO rows (no results
-- at all) — meaning "authenticated" no longer has column-level UPDATE on
-- role, civic_xp, or civic_level.
-- =====================================================================
-- select table_name, column_name, privilege_type
--   from information_schema.role_column_grants
--   where table_name = 'profiles'
--     and grantee = 'authenticated'
--     and privilege_type = 'UPDATE'
--     and column_name in ('role', 'civic_xp', 'civic_level');
