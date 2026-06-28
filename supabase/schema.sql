-- CivicRadar — Supabase schema
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE where possible).

-- =====================================================================
-- Tables
-- =====================================================================

create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references auth.users (id) on delete cascade,
  reporter_name text,
  hazard        text not null default 'stagnant-water',
  notes         text,
  image         text,                       -- compressed JPEG data URL (MVP). Move to Storage later.
  ward          text,
  lat           double precision,
  lng           double precision,
  status        text not null default 'pending' check (status in ('pending', 'resolved')),
  complaint_id  text,                       -- BMC CCRS complaint number (once filed)
  filed_at      timestamptz,                -- when the official complaint was filed
  resolved_by   text,                       -- 'bmc' | 'citizen'
  resolved_at   timestamptz,
  resolution_image text,                    -- BMC "after" proof photo (compressed JPEG data URL)
  community_cleared boolean not null default false, -- NGO logged a ground cleanup
  cleared_by    text,
  confirmations int not null default 0,        -- neighbours who corroborated ("me too")
  created_at    timestamptz not null default now()
);

-- If upgrading an existing table, add the newer columns:
alter table public.reports add column if not exists complaint_id text;
alter table public.reports add column if not exists filed_at timestamptz;
alter table public.reports add column if not exists resolved_by text;
alter table public.reports add column if not exists resolved_at timestamptz;
alter table public.reports add column if not exists community_cleared boolean not null default false;
alter table public.reports add column if not exists cleared_by text;
alter table public.reports add column if not exists confirmations int not null default 0;
-- BMC resolution proof photo (compressed JPEG data URL — "after" photo). Added v19.
alter table public.reports add column if not exists resolution_image text;
-- Multi-city support (Mumbai · Pune · Thane) — migration v44
alter table public.reports add column if not exists city text not null default 'mumbai';
alter table public.profiles add column if not exists city text default 'mumbai';
alter table public.pledges add column if not exists city text default 'mumbai';
alter table public.volunteer_signups add column if not exists city text default 'mumbai';
alter table public.ngo_codes add column if not exists city text default 'mumbai';

create index if not exists reports_city_idx on public.reports (city);
create index if not exists reports_city_ward_idx on public.reports (city, ward);

create index if not exists reports_status_idx  on public.reports (status);
create index if not exists reports_ward_idx     on public.reports (ward);
create index if not exists reports_created_idx   on public.reports (created_at desc);

create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_status_created_idx on public.reports (status, created_at desc);

create table if not exists public.pledges (
  id           uuid primary key default gen_random_uuid(),
  citizen_id   uuid not null references auth.users (id) on delete cascade,
  citizen_name text,
  type         text not null,
  ward         text,
  message      text,
  delivered    boolean not null default false,
  verified     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists pledges_created_idx on public.pledges (created_at desc);

-- =====================================================================
-- Roles & identity
--   citizen  : default
--   bmc      : BMC official — auto-granted to allowlisted gov email domains
--   ngo_lead : NGO coordinator — granted by redeeming an invite code
-- =====================================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'citizen' check (role in ('citizen', 'bmc', 'ngo_lead')),
  ward       text,
  coordinator_scope text check (coordinator_scope in ('ward', 'neighbourhood')),
  neighbourhood_label text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists coordinator_scope text check (coordinator_scope in ('ward', 'neighbourhood'));
alter table public.profiles add column if not exists neighbourhood_label text;
alter table public.profiles add column if not exists society text;
alter table public.reports add column if not exists society text;
alter table public.reports add column if not exists neighbourhood text;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Auto-create a profile on signup; auto-grant BMC role for official gov domains.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare dom text; r text := 'citizen';
begin
  dom := lower(split_part(coalesce(new.email, ''), '@', 2));
  if dom in ('mcgm.gov.in', 'gov.in', 'nic.in', 'maharashtra.gov.in') or dom like '%.gov.in' then
    r := 'bmc';
  end if;
  insert into public.profiles (id, email, role) values (new.id, new.email, r)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helpers used by RLS policies.
create or replace function public.is_bmc()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'bmc');
$$;

create or replace function public.is_ngo_lead()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'ngo_lead');
$$;

-- NGO invite codes. Issue one row per onboarded NGO/ward.
create table if not exists public.ngo_codes (
  code      text primary key,
  ward      text,
  ngo_name  text,
  neighbourhood text,
  coordinator_scope text not null default 'ward' check (coordinator_scope in ('ward', 'neighbourhood')),
  max_uses  int not null default 100,
  uses      int not null default 0,
  active    boolean not null default true
);
alter table public.ngo_codes add column if not exists neighbourhood text;
alter table public.ngo_codes add column if not exists coordinator_scope text not null default 'ward'
  check (coordinator_scope in ('ward', 'neighbourhood'));
-- Ward lead:  insert into public.ngo_codes (code, ward, ngo_name, coordinator_scope)
--             values ('CLEAN-HW-2026', 'H/W Ward — Bandra West, Khar West', 'Bandra Cares', 'ward');
-- Neighbourhood lead:
--             insert into public.ngo_codes (code, ward, ngo_name, neighbourhood, coordinator_scope)
--             values ('NBH-WORLI-2026', 'G/S Ward — Worli, Lower Parel', 'Worli RWA', 'Worli West — Phoenix Mills area', 'neighbourhood');

-- Redeem an NGO code → grants ngo_lead + assigns ward/scope. Returns assignment json.
create or replace function public.redeem_ngo_code(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare c record;
        scope text := 'ward';
begin
  select * into c from public.ngo_codes where code = p_code and active = true for update;
  if not found then raise exception 'invalid_code'; end if;
  if c.uses >= c.max_uses then raise exception 'code_exhausted'; end if;
  scope := coalesce(c.coordinator_scope, 'ward');
  update public.ngo_codes set uses = uses + 1 where code = p_code;
  update public.profiles set
    role = 'ngo_lead',
    ward = coalesce(c.ward, ward),
    city = coalesce(c.city, city, 'mumbai'),
    coordinator_scope = scope,
    neighbourhood_label = case when scope = 'neighbourhood' then c.neighbourhood else null end
  where id = auth.uid();
  return jsonb_build_object(
    'ward', c.ward,
    'city', coalesce(c.city, 'mumbai'),
    'coordinator_scope', scope,
    'neighbourhood_label', c.neighbourhood,
    'ngo_name', c.ngo_name
  );
end $$;

-- =====================================================================
-- Volunteer self-help (citizens) + neighbourhood lead dispatch
-- =====================================================================

create table if not exists public.volunteer_signups (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text,
  ward          text not null,
  neighbourhood text not null,
  hours         int not null default 2,
  skills        jsonb not null default '[]'::jsonb,
  contact       text,
  status        text not null default 'active' check (status in ('active', 'removed')),
  created_at    timestamptz not null default now()
);

create index if not exists volunteer_signups_ward_idx on public.volunteer_signups (ward);
create index if not exists volunteer_signups_user_idx on public.volunteer_signups (user_id);

create table if not exists public.volunteer_tasks (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references public.reports (id) on delete cascade,
  volunteer_signup_id uuid references public.volunteer_signups (id) on delete set null,
  volunteer_name      text,
  ward                text,
  neighbourhood       text,
  status              text not null default 'pending' check (status in ('pending', 'completed')),
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index if not exists volunteer_tasks_report_idx on public.volunteer_tasks (report_id);
create index if not exists volunteer_tasks_ward_idx on public.volunteer_tasks (ward);
create index if not exists volunteer_tasks_status_idx on public.volunteer_tasks (status);

alter table public.volunteer_signups enable row level security;
alter table public.volunteer_tasks enable row level security;

create or replace function public.coordinator_ward()
returns text language sql stable security definer set search_path = public as $$
  select ward from public.profiles where id = auth.uid() and role = 'ngo_lead';
$$;

drop policy if exists "volunteer_signups_select" on public.volunteer_signups;
create policy "volunteer_signups_select"
  on public.volunteer_signups for select
  to authenticated
  using (auth.uid() = user_id or (public.is_ngo_lead() and ward = public.coordinator_ward()));

drop policy if exists "volunteer_signups_insert_own" on public.volunteer_signups;
create policy "volunteer_signups_insert_own"
  on public.volunteer_signups for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "volunteer_signups_update_own" on public.volunteer_signups;
create policy "volunteer_signups_update_own"
  on public.volunteer_signups for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "volunteer_signups_delete_own" on public.volunteer_signups;
create policy "volunteer_signups_delete_own"
  on public.volunteer_signups for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "volunteer_tasks_select" on public.volunteer_tasks;
create policy "volunteer_tasks_select"
  on public.volunteer_tasks for select
  to authenticated
  using (
    public.is_ngo_lead() and ward = public.coordinator_ward()
    or exists (
      select 1 from public.volunteer_signups vs
      where vs.id = volunteer_signup_id and vs.user_id = auth.uid()
    )
  );

drop policy if exists "volunteer_tasks_insert_own" on public.volunteer_tasks;
create policy "volunteer_tasks_insert_own"
  on public.volunteer_tasks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.volunteer_signups vs
      where vs.id = volunteer_signup_id and vs.user_id = auth.uid() and vs.status = 'active'
    )
  );

drop policy if exists "volunteer_tasks_update_roles" on public.volunteer_tasks;
create policy "volunteer_tasks_update_roles"
  on public.volunteer_tasks for update
  to authenticated
  using (
    public.is_ngo_lead()
    or exists (
      select 1 from public.volunteer_signups vs
      where vs.id = volunteer_signup_id and vs.user_id = auth.uid()
    )
  )
  with check (public.is_ngo_lead() or auth.uid() is not null);

-- =====================================================================
-- Row Level Security (role-based)
-- =====================================================================

alter table public.reports enable row level security;
alter table public.pledges enable row level security;

-- Reports: public map → anyone can read.
drop policy if exists "reports_select_all" on public.reports;
create policy "reports_select_all"
  on public.reports for select
  using (true);

-- Reports: a user may insert only their own rows.
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

-- Reports update: the owner (filing / self-confirm), a BMC official (resolve),
-- or an NGO lead (community cleanup). Replaces the old open policy.
drop policy if exists "reports_update_auth" on public.reports;
drop policy if exists "reports_update_roles" on public.reports;
create policy "reports_update_roles"
  on public.reports for update
  to authenticated
  using (auth.uid() = reporter_id or public.is_bmc() or public.is_ngo_lead())
  with check (auth.uid() = reporter_id or public.is_bmc() or public.is_ngo_lead());

-- Pledges: anyone can read (coordinators review them).
drop policy if exists "pledges_select_all" on public.pledges;
create policy "pledges_select_all"
  on public.pledges for select
  using (true);

-- Pledges: a citizen may insert only their own.
drop policy if exists "pledges_insert_own" on public.pledges;
create policy "pledges_insert_own"
  on public.pledges for insert
  with check (auth.uid() = citizen_id);

-- Pledges update: the owner, or an NGO lead (deliver / verify hours).
drop policy if exists "pledges_update_auth" on public.pledges;
drop policy if exists "pledges_update_roles" on public.pledges;
create policy "pledges_update_roles"
  on public.pledges for update
  to authenticated
  using (auth.uid() = citizen_id or public.is_ngo_lead())
  with check (auth.uid() = citizen_id or public.is_ngo_lead());

-- Users may delete their own reports and pledges (account/data erasure).
drop policy if exists "reports_delete_own" on public.reports;
create policy "reports_delete_own"
  on public.reports for delete
  to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists "pledges_delete_own" on public.pledges;
create policy "pledges_delete_own"
  on public.pledges for delete
  to authenticated
  using (auth.uid() = citizen_id);

-- =====================================================================
-- Corroboration ("Me too") — one confirmation per user per report
-- =====================================================================
create table if not exists public.report_confirmations (
  report_id  uuid not null references public.reports (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

alter table public.report_confirmations enable row level security;

drop policy if exists "confirmations_select_all" on public.report_confirmations;
create policy "confirmations_select_all"
  on public.report_confirmations for select using (true);

-- Atomically record a confirmation (deduped by PK) and bump the cached count.
-- Returns the new confirmation total.
create or replace function public.confirm_report(p_report_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare new_count int;
begin
  insert into public.report_confirmations (report_id, user_id)
  values (p_report_id, auth.uid())
  on conflict do nothing;

  if found then
    update public.reports
      set confirmations = confirmations + 1
      where id = p_report_id
      returning confirmations into new_count;
  else
    select confirmations into new_count from public.reports where id = p_report_id;
  end if;

  return coalesce(new_count, 0);
end $$;

-- =====================================================================
-- Realtime (so the BMC admin sees new citizen reports instantly)
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pledges'
  ) then
    alter publication supabase_realtime add table public.pledges;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'volunteer_signups'
  ) then
    alter publication supabase_realtime add table public.volunteer_signups;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'volunteer_tasks'
  ) then
    alter publication supabase_realtime add table public.volunteer_tasks;
  end if;
end $$;

-- =====================================================================
-- Analytics events (traffic, errors, performance) — migration v22
-- Anonymous session ids only; no photos/GPS in payload. Ward code optional.
-- =====================================================================

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  event_type  text not null,
  session_id  uuid,
  ward        text,
  payload     jsonb not null default '{}'::jsonb,
  user_agent  text
);

create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_type_idx on public.analytics_events (event_type);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id);

alter table public.analytics_events enable row level security;

-- Anyone may insert (anon key); reads restricted to aggregates via RPC below.
drop policy if exists "analytics_insert_anon" on public.analytics_events;
create policy "analytics_insert_anon"
  on public.analytics_events for insert
  with check (true);

drop policy if exists "analytics_select_none" on public.analytics_events;
create policy "analytics_select_none"
  on public.analytics_events for select
  using (false);

-- Public aggregate summary (no PII) for impact dashboards.
create or replace function public.get_analytics_summary(p_days int default 7)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 7), 90)),
    'total_events', count(*),
    'sessions', count(*) filter (where event_type = 'session_start'),
    'tab_views', count(*) filter (where event_type = 'tab_view'),
    'reports_submitted', count(*) filter (where event_type = 'report_submitted'),
    'corroborations', count(*) filter (where event_type = 'report_corroborated'),
    'bmc_filed', count(*) filter (where event_type = 'bmc_filed'),
    'resolved', count(*) filter (where event_type = 'report_resolved'),
    'community_cleanups', count(*) filter (where event_type = 'community_cleanup'),
    'volunteer_signups', count(*) filter (where event_type = 'volunteer_signup_created'),
    'volunteer_tasks_offered', count(*) filter (where event_type = 'volunteer_task_offered'),
    'volunteer_tasks_completed', count(*) filter (where event_type = 'volunteer_task_completed'),
    'whatsapp_shares', count(*) filter (where event_type = 'whatsapp_share'),
    'errors', count(*) filter (where event_type = 'error'),
    'perf_samples', count(*) filter (where event_type = 'perf')
  )
  from public.analytics_events
  where created_at >= now() - (greatest(1, least(coalesce(p_days, 7), 90)) || ' days')::interval;
$$;

grant execute on function public.get_analytics_summary(int) to anon, authenticated;

-- =====================================================================
-- Account erasure (DPDP right to deletion) — migration v23
-- Deletes all rows tied to auth.uid(); optionally purges analytics by session.
-- Review with qualified counsel before launch.
-- =====================================================================

create or replace function public.delete_user_data(p_session_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;

  delete from public.volunteer_tasks
    where volunteer_signup_id in (
      select id from public.volunteer_signups where user_id = uid
    );

  delete from public.volunteer_signups where user_id = uid;
  delete from public.report_confirmations where user_id = uid;
  delete from public.reports where reporter_id = uid;
  delete from public.pledges where citizen_id = uid;

  if p_session_id is not null then
    delete from public.analytics_events where session_id = p_session_id;
  end if;
end $$;

grant execute on function public.delete_user_data(uuid) to anon, authenticated;

-- =====================================================================
-- Community "looks fixed" verification — migration v39
-- Neighbours confirm a pending hazard appears fixed (not official BMC).
-- Auto-resolves at threshold with honest resolution_source attribution.
-- =====================================================================

alter table public.reports add column if not exists fix_confirmations int not null default 0;
alter table public.reports add column if not exists resolution_source text;
alter table public.reports add column if not exists community_verified_at timestamptz;

create table if not exists public.report_fix_confirmations (
  report_id  uuid not null references public.reports (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

alter table public.report_fix_confirmations enable row level security;

drop policy if exists "fix_confirmations_select_all" on public.report_fix_confirmations;
create policy "fix_confirmations_select_all"
  on public.report_fix_confirmations for select
  using (true);

-- Atomically record a fix confirmation (deduped by PK), bump count, auto-resolve at threshold.
-- p_stale_check: reporter answered a stale-spot prompt ("Looks fixed").
-- Returns { fix_confirmations, resolved, resolution_source }.
create or replace function public.confirm_fix(
  p_report_id uuid,
  p_threshold int default 2,
  p_stale_check boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  new_count int;
  inserted boolean := false;
  rep record;
  src text;
  did_resolve boolean := false;
begin
  select * into rep from public.reports where id = p_report_id for update;
  if not found then raise exception 'not_found'; end if;

  if rep.status = 'resolved' then
    return jsonb_build_object(
      'fix_confirmations', coalesce(rep.fix_confirmations, 0),
      'resolved', true,
      'resolution_source', rep.resolution_source
    );
  end if;

  insert into public.report_fix_confirmations (report_id, user_id)
  values (p_report_id, auth.uid())
  on conflict do nothing;
  inserted := found;

  if inserted then
    update public.reports
      set fix_confirmations = fix_confirmations + 1
      where id = p_report_id
      returning fix_confirmations into new_count;
  else
    select fix_confirmations into new_count from public.reports where id = p_report_id;
  end if;

  if inserted and new_count >= greatest(1, coalesce(p_threshold, 2)) then
    src := case
      when p_stale_check and rep.reporter_id = auth.uid() then 'stale_verified'
      else 'community_verified'
    end;
    update public.reports set
      status = 'resolved',
      resolved_by = case when src = 'stale_verified' then 'citizen' else 'community' end,
      resolved_at = now(),
      resolution_source = src,
      community_verified_at = now()
    where id = p_report_id and status = 'pending';
    did_resolve := found;
  end if;

  if did_resolve then
    select fix_confirmations, resolution_source into new_count, src
    from public.reports where id = p_report_id;
  end if;

  return jsonb_build_object(
    'fix_confirmations', coalesce(new_count, 0),
    'resolved', did_resolve,
    'resolution_source', coalesce(src, rep.resolution_source)
  );
end $$;

grant execute on function public.confirm_fix(uuid, int, boolean) to anon, authenticated;

-- Extend erasure + analytics for fix confirmations.
create or replace function public.delete_user_data(p_session_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;

  delete from public.volunteer_tasks
    where volunteer_signup_id in (
      select id from public.volunteer_signups where user_id = uid
    );

  delete from public.volunteer_signups where user_id = uid;
  delete from public.report_fix_confirmations where user_id = uid;
  delete from public.report_confirmations where user_id = uid;
  delete from public.reports where reporter_id = uid;
  delete from public.pledges where citizen_id = uid;

  if p_session_id is not null then
    delete from public.analytics_events where session_id = p_session_id;
  end if;
end $$;

create or replace function public.get_analytics_summary(p_days int default 7)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 7), 90)),
    'total_events', count(*),
    'sessions', count(*) filter (where event_type = 'session_start'),
    'tab_views', count(*) filter (where event_type = 'tab_view'),
    'reports_submitted', count(*) filter (where event_type = 'report_submitted'),
    'corroborations', count(*) filter (where event_type = 'report_corroborated'),
    'fix_confirmed', count(*) filter (where event_type = 'fix_confirmed'),
    'community_auto_resolved', count(*) filter (where event_type = 'community_auto_resolved'),
    'stale_check_fixed', count(*) filter (where event_type = 'stale_check_fixed'),
    'bmc_filed', count(*) filter (where event_type = 'bmc_filed'),
    'resolved', count(*) filter (where event_type = 'report_resolved'),
    'community_cleanups', count(*) filter (where event_type = 'community_cleanup'),
    'volunteer_signups', count(*) filter (where event_type = 'volunteer_signup_created'),
    'volunteer_tasks_offered', count(*) filter (where event_type = 'volunteer_task_offered'),
    'volunteer_tasks_completed', count(*) filter (where event_type = 'volunteer_task_completed'),
    'whatsapp_shares', count(*) filter (where event_type = 'whatsapp_share'),
    'errors', count(*) filter (where event_type = 'error'),
    'perf_samples', count(*) filter (where event_type = 'perf')
  )
  from public.analytics_events
  where created_at >= now() - (greatest(1, least(coalesce(p_days, 7), 90)) || ' days')::interval;
$$;

-- =====================================================================
-- In-app feedback (bug reports / ideas) — migration v69
-- Public can submit (anon or signed-in); only the service role / dashboard
-- can read. Mirrors the analytics_events security pattern (anon insert, no
-- public select). No founder name/email is exposed — feedback flows to the DB.
-- Additive and safe to re-run.
-- =====================================================================

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  message     text not null,
  category    text not null default 'other' check (category in ('bug', 'idea', 'other')),
  contact     text,                       -- optional: only if the user wants a reply
  app_version text,                       -- SW cache / build version
  env         text,                       -- 'dev' | 'staging' | 'prod'
  device      text,                       -- coarse device/useragent string
  ward        text,                       -- optional ward context
  city        text,                       -- optional city context
  user_id     uuid                        -- anon auth uid if signed in (nullable)
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_category_idx on public.feedback (category);

alter table public.feedback enable row level security;

-- Anyone (anon or authenticated) may submit feedback.
drop policy if exists "feedback_insert_anon" on public.feedback;
create policy "feedback_insert_anon"
  on public.feedback for insert
  with check (true);

-- No public reads/updates/deletes — only the service role (dashboard) sees feedback.
drop policy if exists "feedback_select_none" on public.feedback;
create policy "feedback_select_none"
  on public.feedback for select
  using (false);

-- =====================================================================
-- Coordinator access requests + approval workflow — migration v72
-- BMC officials and NGO/community coordinators request elevated access
-- in-app; the CivicRadar super-admin reviews and approves. Approving issues a
-- one-time CLAIM CODE the requester redeems in-app to unlock their role — the
-- most robust path for anonymous applicants (no account needed to apply).
--
-- Operational roles (profiles.role):
--   citizen  : default
--   ngo_lead : NGO / community coordinator   (requested as 'ngo_coordinator')
--   bmc      : BMC official                  (requested as 'bmc_official')
--   admin    : CivicRadar super-admin        — the approver
--
-- ▶ BOOTSTRAP YOUR FIRST SUPER-ADMIN (run once, after they have signed in once
--   so a profiles row exists — replace the email with your reviewer's):
--     update public.profiles set role = 'admin' where email = 'civicradarnh@gmail.com';
--
-- Additive and safe to re-run.
-- =====================================================================

-- Allow the new super-admin role on profiles (idempotent constraint swap).
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('citizen', 'bmc', 'ngo_lead', 'admin'));

-- Role helper used by RLS + RPC guards below.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create table if not exists public.access_requests (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  full_name      text not null,
  org_name       text,
  role_requested text not null default 'ngo_coordinator'
                 check (role_requested in ('ngo_coordinator', 'bmc_official')),
  city           text default 'mumbai',
  ward           text,
  contact_email  text,
  contact_phone  text,
  note           text,
  proof_url      text,                       -- optional ID/proof (data URL or Storage path)
  status         text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  claim_code     text,                       -- issued on approve (one-time)
  claimed_at     timestamptz,
  reviewed_at    timestamptz,
  reviewed_by    uuid,
  requester_id   uuid                        -- anon auth uid if signed in (nullable)
);

create index if not exists access_requests_status_idx on public.access_requests (status, created_at desc);
create unique index if not exists access_requests_claim_code_idx
  on public.access_requests (claim_code) where claim_code is not null;

alter table public.access_requests enable row level security;

-- Anyone (anon or signed-in) may submit a *pending* request and nothing more —
-- they can never pre-approve themselves or mint a claim code.
drop policy if exists "access_requests_insert_pending" on public.access_requests;
create policy "access_requests_insert_pending"
  on public.access_requests for insert
  with check (
    status = 'pending' and claim_code is null and claimed_at is null
    and reviewed_at is null and reviewed_by is null
  );

-- Only the super-admin can read or update requests.
drop policy if exists "access_requests_select_admin" on public.access_requests;
create policy "access_requests_select_admin"
  on public.access_requests for select
  using (public.is_admin());

drop policy if exists "access_requests_update_admin" on public.access_requests;
create policy "access_requests_update_admin"
  on public.access_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Submit a request (SECURITY DEFINER so requester_id is captured safely and the
-- caller cannot spoof status/claim fields). Validates the low-friction minimums.
create or replace function public.request_access(
  p_full_name text,
  p_role_requested text,
  p_org_name text default null,
  p_city text default 'mumbai',
  p_ward text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_note text default null,
  p_proof_url text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
        rr text := lower(coalesce(p_role_requested, 'ngo_coordinator'));
begin
  if rr not in ('ngo_coordinator', 'bmc_official') then rr := 'ngo_coordinator'; end if;
  if coalesce(btrim(p_full_name), '') = '' then raise exception 'name_required'; end if;
  if coalesce(btrim(p_contact_email), '') = '' and coalesce(btrim(p_contact_phone), '') = '' then
    raise exception 'contact_required';
  end if;
  insert into public.access_requests (
    full_name, org_name, role_requested, city, ward,
    contact_email, contact_phone, note, proof_url, requester_id
  ) values (
    btrim(p_full_name),
    nullif(btrim(coalesce(p_org_name, '')), ''),
    rr,
    coalesce(nullif(btrim(coalesce(p_city, '')), ''), 'mumbai'),
    nullif(btrim(coalesce(p_ward, '')), ''),
    nullif(btrim(coalesce(p_contact_email, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    nullif(btrim(coalesce(p_proof_url, '')), ''),
    auth.uid()
  ) returning id into new_id;
  return new_id;
end $$;

grant execute on function public.request_access(text, text, text, text, text, text, text, text, text)
  to anon, authenticated;

-- Generate a short, human-friendly one-time claim code (e.g. CR-7Q2KX9).
create or replace function public.gen_claim_code()
returns text language sql volatile set search_path = public as $$
  select 'CR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

-- Approve a pending request (admin only). Issues a one-time claim code and, if
-- the requester was signed in when applying, elevates their profile immediately
-- too. Returns the claim code so the team can email it from the role mailbox.
create or replace function public.approve_access_request(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare req record;
        code text;
        op_role text;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  select * into req from public.access_requests where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  code := coalesce(req.claim_code, public.gen_claim_code());
  op_role := case when req.role_requested = 'bmc_official' then 'bmc' else 'ngo_lead' end;
  update public.access_requests set
    status = 'approved', claim_code = code,
    reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_id;
  if req.requester_id is not null then
    update public.profiles set
      role = op_role,
      ward = coalesce(req.ward, ward),
      city = coalesce(req.city, city, 'mumbai'),
      coordinator_scope = case when op_role = 'ngo_lead' then coalesce(coordinator_scope, 'ward')
                               else coordinator_scope end
    where id = req.requester_id;
  end if;
  return jsonb_build_object('id', p_id, 'claim_code', code, 'role', op_role);
end $$;

grant execute on function public.approve_access_request(uuid) to authenticated;

create or replace function public.reject_access_request(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  update public.access_requests set
    status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_id;
end $$;

grant execute on function public.reject_access_request(uuid) to authenticated;

-- Redeem a claim code → elevates the caller's profile to the approved role.
-- Works for anyone signed in (the app uses anonymous sessions), which is why a
-- claim code is the robust path for applicants who applied without an account.
create or replace function public.claim_access(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare req record;
        op_role text;
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  select * into req from public.access_requests
    where claim_code = upper(btrim(p_code)) and status = 'approved' for update;
  if not found then raise exception 'invalid_code'; end if;
  if req.claimed_at is not null and req.requester_id is distinct from auth.uid() then
    raise exception 'code_used';
  end if;
  op_role := case when req.role_requested = 'bmc_official' then 'bmc' else 'ngo_lead' end;
  update public.profiles set
    role = op_role,
    ward = coalesce(req.ward, ward),
    city = coalesce(req.city, city, 'mumbai'),
    coordinator_scope = case when op_role = 'ngo_lead' then coalesce(coordinator_scope, 'ward')
                             else coordinator_scope end
  where id = auth.uid();
  update public.access_requests set
    claimed_at = now(), requester_id = coalesce(requester_id, auth.uid())
  where id = req.id;
  return jsonb_build_object(
    'role', op_role,
    'ward', req.ward,
    'city', coalesce(req.city, 'mumbai'),
    'coordinator_scope', case when op_role = 'ngo_lead' then 'ward' else null end
  );
end $$;

grant execute on function public.claim_access(text) to authenticated;

-- Realtime so the super-admin sees new access requests instantly.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'access_requests'
  ) then
    alter publication supabase_realtime add table public.access_requests;
  end if;
end $$;

-- =====================================================================
-- Peer voting for NGO ward lead + neighbourhood lead — migration v91
-- Democratic role grant: 2 community supports by default; 5 each when
-- multiple active candidates compete for the same scope (co-leads allowed).
-- BMC officials still use access_requests + admin approval above.
-- Additive and safe to re-run.
-- =====================================================================

create table if not exists public.lead_nominations (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  nominee_id          uuid not null references auth.users (id) on delete cascade,
  display_name        text not null,
  org_name            text,
  role_type           text not null check (role_type in ('ngo_ward', 'neighbourhood')),
  city                text not null default 'mumbai',
  ward                text not null,
  neighbourhood_label text,
  status              text not null default 'active'
                      check (status in ('active', 'granted', 'withdrawn')),
  vote_count          int not null default 0,
  granted_at          timestamptz,
  constraint lead_nominations_neighbourhood_chk check (
    role_type <> 'neighbourhood' or coalesce(btrim(neighbourhood_label), '') <> ''
  )
);

create index if not exists lead_nominations_scope_idx
  on public.lead_nominations (role_type, city, ward, neighbourhood_label, status);

create unique index if not exists lead_nominations_active_nominee_scope_idx
  on public.lead_nominations (
    nominee_id, role_type, city, ward, coalesce(neighbourhood_label, '')
  )
  where status = 'active';

create table if not exists public.lead_votes (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  nomination_id  uuid not null references public.lead_nominations (id) on delete cascade,
  voter_id       uuid not null references auth.users (id) on delete cascade,
  unique (nomination_id, voter_id)
);

create index if not exists lead_votes_nomination_idx on public.lead_votes (nomination_id);

alter table public.lead_nominations enable row level security;
alter table public.lead_votes enable row level security;

-- Anyone signed in may read nominations (community candidate list).
drop policy if exists "lead_nominations_select_auth" on public.lead_nominations;
create policy "lead_nominations_select_auth"
  on public.lead_nominations for select
  to authenticated
  using (true);

-- Voters may see their own votes (dedup / UI state).
drop policy if exists "lead_votes_select_own" on public.lead_votes;
create policy "lead_votes_select_own"
  on public.lead_votes for select
  to authenticated
  using (auth.uid() = voter_id);

-- Vote threshold: 2 normally; 5 when another active candidate shares the scope.
create or replace function public.lead_vote_threshold(p_nomination_id uuid)
returns int
language plpgsql stable security definer set search_path = public as $$
declare n record;
        others int;
begin
  select * into n from public.lead_nominations where id = p_nomination_id;
  if not found then return 2; end if;
  select count(*)::int into others
    from public.lead_nominations
    where status = 'active'
      and role_type = n.role_type
      and city = n.city
      and ward = n.ward
      and coalesce(neighbourhood_label, '') = coalesce(n.neighbourhood_label, '')
      and id <> n.id;
  if others >= 1 then return 5; else return 2; end if;
end $$;

-- Grant role when threshold met (SECURITY DEFINER — only callable from vote path).
create or replace function public.maybe_grant_lead(p_nomination_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare n record;
        thresh int;
        scope text;
begin
  select * into n from public.lead_nominations where id = p_nomination_id for update;
  if not found or n.status <> 'active' then return; end if;
  thresh := public.lead_vote_threshold(p_nomination_id);
  if n.vote_count < thresh then return; end if;
  scope := case when n.role_type = 'neighbourhood' then 'neighbourhood' else 'ward' end;
  update public.lead_nominations
    set status = 'granted', granted_at = now()
    where id = p_nomination_id;
  update public.profiles set
    role = 'ngo_lead',
    ward = n.ward,
    city = n.city,
    coordinator_scope = scope,
    neighbourhood_label = case when scope = 'neighbourhood' then n.neighbourhood_label else null end
  where id = n.nominee_id;
end $$;

create or replace function public.lead_vote_after_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.lead_nominations
    set vote_count = vote_count + 1
    where id = new.nomination_id;
  perform public.maybe_grant_lead(new.nomination_id);
  return new;
end $$;

drop trigger if exists lead_vote_after_insert_trg on public.lead_votes;
create trigger lead_vote_after_insert_trg
  after insert on public.lead_votes
  for each row execute function public.lead_vote_after_insert();

-- Nominate self for a lead role (auth required).
create or replace function public.nominate_for_lead(
  p_role_type text,
  p_display_name text,
  p_org_name text default null,
  p_city text default 'mumbai',
  p_ward text default null,
  p_neighbourhood text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
        rt text := lower(coalesce(p_role_type, 'ngo_ward'));
        nbh text;
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if rt not in ('ngo_ward', 'neighbourhood') then rt := 'ngo_ward'; end if;
  if coalesce(btrim(p_display_name), '') = '' then raise exception 'name_required'; end if;
  if coalesce(btrim(p_ward), '') = '' then raise exception 'ward_required'; end if;
  nbh := nullif(btrim(coalesce(p_neighbourhood, '')), '');
  if rt = 'neighbourhood' and nbh is null then raise exception 'neighbourhood_required'; end if;
  if exists (
    select 1 from public.lead_nominations
    where nominee_id = auth.uid() and status = 'active'
      and role_type = rt and city = coalesce(nullif(btrim(coalesce(p_city, '')), ''), 'mumbai')
      and ward = btrim(p_ward)
      and coalesce(neighbourhood_label, '') = coalesce(nbh, '')
  ) then raise exception 'already_nominated'; end if;
  if exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ngo_lead'
      and ward = btrim(p_ward)
      and coordinator_scope = case when rt = 'neighbourhood' then 'neighbourhood' else 'ward' end
      and coalesce(neighbourhood_label, '') = coalesce(nbh, '')
  ) then raise exception 'already_lead'; end if;
  insert into public.lead_nominations (
    nominee_id, display_name, org_name, role_type, city, ward, neighbourhood_label
  ) values (
    auth.uid(),
    btrim(p_display_name),
    nullif(btrim(coalesce(p_org_name, '')), ''),
    rt,
    coalesce(nullif(btrim(coalesce(p_city, '')), ''), 'mumbai'),
    btrim(p_ward),
    nbh
  ) returning id into new_id;
  return new_id;
end $$;

grant execute on function public.nominate_for_lead(text, text, text, text, text, text)
  to authenticated;

-- Cast a support vote (one per voter per nomination; no self-votes).
create or replace function public.vote_for_lead(p_nomination_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare n record;
        thresh int;
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  select * into n from public.lead_nominations where id = p_nomination_id for update;
  if not found then raise exception 'not_found'; end if;
  if n.status <> 'active' then raise exception 'not_active'; end if;
  if n.nominee_id = auth.uid() then raise exception 'self_vote'; end if;
  insert into public.lead_votes (nomination_id, voter_id)
    values (p_nomination_id, auth.uid());
  select * into n from public.lead_nominations where id = p_nomination_id;
  thresh := public.lead_vote_threshold(p_nomination_id);
  return jsonb_build_object(
    'nomination_id', p_nomination_id,
    'vote_count', n.vote_count,
    'threshold', thresh,
    'granted', n.status = 'granted'
  );
exception
  when unique_violation then raise exception 'already_voted';
end $$;

grant execute on function public.vote_for_lead(uuid) to authenticated;

-- List active candidates for a ward (optional neighbourhood filter).
create or replace function public.list_lead_nominations(
  p_city text default 'mumbai',
  p_ward text default null,
  p_neighbourhood text default null
)
returns table (
  id uuid,
  created_at timestamptz,
  nominee_id uuid,
  display_name text,
  org_name text,
  role_type text,
  city text,
  ward text,
  neighbourhood_label text,
  status text,
  vote_count int,
  threshold int,
  i_voted boolean
)
language sql stable security definer set search_path = public as $$
  select
    n.id,
    n.created_at,
    n.nominee_id,
    n.display_name,
    n.org_name,
    n.role_type,
    n.city,
    n.ward,
    n.neighbourhood_label,
    n.status,
    n.vote_count,
    public.lead_vote_threshold(n.id) as threshold,
    exists (
      select 1 from public.lead_votes v
      where v.nomination_id = n.id and v.voter_id = auth.uid()
    ) as i_voted
  from public.lead_nominations n
  where n.status = 'active'
    and n.city = coalesce(nullif(btrim(coalesce(p_city, '')), ''), 'mumbai')
    and (p_ward is null or btrim(p_ward) = '' or n.ward = btrim(p_ward))
    and (
      p_neighbourhood is null or btrim(p_neighbourhood) = ''
      or n.role_type = 'ngo_ward'
      or coalesce(n.neighbourhood_label, '') = btrim(p_neighbourhood)
    )
  order by n.vote_count desc, n.created_at asc;
$$;

grant execute on function public.list_lead_nominations(text, text, text)
  to authenticated;

-- Realtime for live candidate counts in Community.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lead_nominations'
  ) then
    alter publication supabase_realtime add table public.lead_nominations;
  end if;
end $$;

-- =====================================================================
-- Tracking dashboard aggregates — migration v92
-- Role-gated RPC for admin / BMC / NGO coordinator analytics.
-- Privacy: counts only — no PII, photos, or GPS in responses.
-- PWA install counts are best-effort (appinstalled / standalone sessions).
-- Additive and safe to re-run.
-- =====================================================================

create or replace function public.get_tracking_dashboard(
  p_days int default 7,
  p_ward text default null,
  p_city text default null,
  p_neighbourhood text default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  prof record;
  days int := greatest(1, least(coalesce(p_days, 7), 90));
  since timestamptz := now() - (days || ' days')::interval;
  filt_ward text;
  filt_city text;
  filt_nbh text;
  ward_code text;
  traffic jsonb;
  reports_agg jsonb;
  escalations jsonb;
  community jsonb;
  neighbourhoods jsonb;
  leads jsonb;
begin
  if auth.uid() is null then raise exception 'not_authorized'; end if;
  select * into prof from public.profiles where id = auth.uid();
  if not found or prof.role not in ('admin', 'bmc', 'ngo_lead') then
    raise exception 'not_authorized';
  end if;

  if prof.role = 'ngo_lead' then
    filt_ward := prof.ward;
    filt_city := coalesce(prof.city, 'mumbai');
    if prof.coordinator_scope = 'neighbourhood' then
      filt_nbh := prof.neighbourhood_label;
    end if;
  elsif prof.role = 'bmc' then
    filt_ward := nullif(btrim(coalesce(p_ward, '')), '');
    filt_city := coalesce(nullif(btrim(coalesce(p_city, '')), ''), 'mumbai');
  else
    filt_ward := nullif(btrim(coalesce(p_ward, '')), '');
    filt_city := nullif(btrim(coalesce(p_city, '')), '');
    filt_nbh := nullif(btrim(coalesce(p_neighbourhood, '')), '');
  end if;

  ward_code := case when filt_ward is null then null else split_part(filt_ward, '—', 1) end;

  select jsonb_build_object(
    'sessions', count(distinct session_id) filter (where event_type = 'session_start'),
    'page_views', count(*) filter (where event_type in ('session_start', 'tab_view')),
    'pwa_installs', count(*) filter (where event_type = 'pwa_installed'),
    'pwa_install_prompts', count(*) filter (where event_type = 'pwa_install_prompt'),
    'pwa_standalone_sessions', count(*) filter (where event_type = 'pwa_standalone_session'),
    'unique_visitors', count(distinct session_id)
  ) into traffic
  from public.analytics_events
  where created_at >= since
    and (
      ward_code is null
      or ward = ward_code
      or ward = filt_ward
    );

  with scoped as (
    select * from public.reports r
    where (filt_city is null or r.city = filt_city)
      and (filt_ward is null or r.ward = filt_ward)
      and (
        filt_nbh is null
        or coalesce(r.neighbourhood, r.society, '') ilike '%' || filt_nbh || '%'
        or filt_nbh ilike '%' || coalesce(r.neighbourhood, r.society, '') || '%'
      )
  ),
  by_hazard as (
    select coalesce(hazard, 'unknown') as hazard,
      count(*)::int as total,
      count(*) filter (where status = 'pending')::int as pending,
      count(*) filter (where status = 'resolved')::int as resolved
    from scoped group by 1
  )
  select jsonb_build_object(
    'total', (select count(*)::int from scoped),
    'pending', (select count(*)::int from scoped where status = 'pending'),
    'resolved', (select count(*)::int from scoped where status = 'resolved'),
    'filed', (select count(*)::int from scoped where coalesce(btrim(complaint_id), '') <> ''),
    'reporters', (select count(distinct reporter_id)::int from scoped),
    'confirmations', (select coalesce(sum(confirmations), 0)::int from scoped),
    'by_hazard', coalesce((
      select jsonb_agg(jsonb_build_object(
        'hazard', hazard, 'total', total, 'pending', pending, 'resolved', resolved
      ) order by total desc) from by_hazard
    ), '[]'::jsonb)
  ) into reports_agg;

  select jsonb_build_object(
    'official_opens', coalesce((
      select jsonb_object_agg(ch, cnt)
      from (
        select coalesce(nullif(btrim(payload->>'channel'), ''), 'unknown') as ch,
          count(*)::int as cnt
        from public.analytics_events
        where created_at >= since
          and event_type in ('official_channel_open', 'bmc_channel_opened')
          and (
            ward_code is null
            or ward = ward_code
            or ward = filt_ward
          )
        group by 1
      ) x
    ), '{}'::jsonb),
    'bmc_filed_events', (
      select count(*)::int from public.analytics_events
      where created_at >= since and event_type = 'bmc_filed'
        and (
          ward_code is null
          or ward = ward_code
          or ward = filt_ward
        )
    ),
    'reports_with_complaint', (reports_agg->>'filed')::int
  ) into escalations;

  select jsonb_build_object(
    'corroborations', (
      select count(*)::int from public.analytics_events
      where created_at >= since and event_type = 'report_corroborated'
        and (
          ward_code is null
          or ward = ward_code
          or ward = filt_ward
        )
    ),
    'volunteer_signups', (
      select count(*)::int from public.analytics_events
      where created_at >= since and event_type = 'volunteer_signup_created'
        and (
          ward_code is null
          or ward = ward_code
          or ward = filt_ward
        )
    ),
    'community_cleanups', (
      select count(*)::int from public.analytics_events
      where created_at >= since and event_type = 'community_cleanup'
        and (
          ward_code is null
          or ward = ward_code
          or ward = filt_ward
        )
    ),
    'pledges', (
      select count(*)::int from public.pledges p
      where p.created_at >= since
        and (filt_city is null or p.city = filt_city)
        and (filt_ward is null or p.ward = filt_ward)
    )
  ) into community;

  select coalesce(jsonb_agg(jsonb_build_object('label', label, 'count', cnt) order by cnt desc), '[]'::jsonb)
  into neighbourhoods
  from (
    select coalesce(nullif(btrim(society), ''), nullif(btrim(neighbourhood), ''), '—') as label,
      count(*)::int as cnt
    from public.reports r
    where (filt_city is null or r.city = filt_city)
      and (filt_ward is null or r.ward = filt_ward)
      and coalesce(nullif(btrim(society), ''), nullif(btrim(neighbourhood), '')) is not null
      and (
        filt_nbh is null
        or coalesce(r.neighbourhood, r.society, '') ilike '%' || filt_nbh || '%'
      )
    group by 1
    order by cnt desc
    limit 12
  ) nb;

  select jsonb_build_object(
    'ward_leads', (
      select count(*)::int from public.profiles
      where role = 'ngo_lead' and coordinator_scope = 'ward'
        and (filt_city is null or city = filt_city)
        and (filt_ward is null or ward = filt_ward)
    ),
    'neighbourhood_leads', (
      select count(*)::int from public.profiles
      where role = 'ngo_lead' and coordinator_scope = 'neighbourhood'
        and (filt_city is null or city = filt_city)
        and (filt_ward is null or ward = filt_ward)
        and (filt_nbh is null or neighbourhood_label = filt_nbh)
    )
  ) into leads;

  return jsonb_build_object(
    'days', days,
    'scope', jsonb_build_object('ward', filt_ward, 'city', filt_city, 'neighbourhood', filt_nbh),
    'traffic', traffic,
    'reports', reports_agg,
    'escalations', escalations,
    'community', community,
    'neighbourhoods', neighbourhoods,
    'leads', leads,
    'source', 'cloud'
  );
end $$;

grant execute on function public.get_tracking_dashboard(int, text, text, text) to authenticated;

-- Extend public analytics summary with PWA + official-channel counts (v92).
create or replace function public.get_analytics_summary(p_days int default 7)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 7), 90)),
    'total_events', count(*),
    'sessions', count(*) filter (where event_type = 'session_start'),
    'tab_views', count(*) filter (where event_type = 'tab_view'),
    'page_views', count(*) filter (where event_type in ('session_start', 'tab_view')),
    'pwa_installs', count(*) filter (where event_type = 'pwa_installed'),
    'pwa_standalone_sessions', count(*) filter (where event_type = 'pwa_standalone_session'),
    'official_channel_opens', count(*) filter (where event_type in ('official_channel_open', 'bmc_channel_opened')),
    'reports_submitted', count(*) filter (where event_type = 'report_submitted'),
    'corroborations', count(*) filter (where event_type = 'report_corroborated'),
    'fix_confirmed', count(*) filter (where event_type = 'fix_confirmed'),
    'community_auto_resolved', count(*) filter (where event_type = 'community_auto_resolved'),
    'stale_check_fixed', count(*) filter (where event_type = 'stale_check_fixed'),
    'bmc_filed', count(*) filter (where event_type = 'bmc_filed'),
    'resolved', count(*) filter (where event_type = 'report_resolved'),
    'community_cleanups', count(*) filter (where event_type = 'community_cleanup'),
    'volunteer_signups', count(*) filter (where event_type = 'volunteer_signup_created'),
    'volunteer_tasks_offered', count(*) filter (where event_type = 'volunteer_task_offered'),
    'volunteer_tasks_completed', count(*) filter (where event_type = 'volunteer_task_completed'),
    'whatsapp_shares', count(*) filter (where event_type = 'whatsapp_share'),
    'errors', count(*) filter (where event_type = 'error'),
    'perf_samples', count(*) filter (where event_type = 'perf')
  )
  from public.analytics_events
  where created_at >= now() - (greatest(1, least(coalesce(p_days, 7), 90)) || ' days')::interval;
$$;
