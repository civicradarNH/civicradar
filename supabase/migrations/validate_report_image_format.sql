-- Manual prod migration (Supabase MCP unavailable at apply time).
-- Name: validate_report_image_format
-- Applies invalid_image_format checks to set_resolution_image + insert_report.
-- Keep in sync with supabase/schema.sql definitions of these functions.

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

grant execute on function public.set_resolution_image(uuid, text) to authenticated;

create or replace function public.insert_report(
  p_id uuid,
  p_hazard text,
  p_notes text default null,
  p_image text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_ward text default null,
  p_city text default null,
  p_society text default null,
  p_reporter_name text default null,
  p_neighbourhood text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rid uuid;
  rep_cnt int;
  cid text;
begin
  if uid is null then raise exception 'auth_required'; end if;

  select count(*) into rep_cnt from public.reports
    where reporter_id = uid and created_at > now() - interval '1 hour';
  if rep_cnt >= 30 then raise exception 'rate_limit_reports'; end if;

  if p_hazard is null or p_hazard not in ('stagnant-water', 'garbage', 'potholes', 'streetlight') then
    raise exception 'invalid_hazard';
  end if;

  if p_image is not null
     and btrim(p_image) <> ''
     and p_image !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'
     and p_image !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/report-photos/'
  then
    raise exception 'invalid_image_format';
  end if;

  cid := coalesce(nullif(left(btrim(coalesce(p_city, '')), 32), ''), 'mumbai');
  if cid not in ('mumbai', 'pune', 'thane') then cid := 'mumbai'; end if;

  perform public.validate_report_coords(cid, p_lat, p_lng);

  rid := coalesce(p_id, gen_random_uuid());

  insert into public.reports (
    id, reporter_id, reporter_name, hazard, notes, image,
    ward, city, society, neighbourhood, lat, lng,
    status, confirmations, fix_confirmations, flag_count, removed, community_cleared
  ) values (
    rid,
    uid,
    nullif(left(btrim(coalesce(p_reporter_name, '')), 30), ''),
    p_hazard,
    nullif(left(btrim(coalesce(p_notes, '')), 2000), ''),
    nullif(btrim(coalesce(p_image, '')), ''),
    nullif(left(btrim(coalesce(p_ward, '')), 200), ''),
    cid,
    nullif(left(btrim(coalesce(p_society, '')), 120), ''),
    nullif(left(btrim(coalesce(p_neighbourhood, '')), 120), ''),
    p_lat,
    p_lng,
    'pending',
    0,
    0,
    0,
    false,
    false
  )
  on conflict (id) do nothing;

  return rid;
end $$;

grant execute on function public.insert_report(
  uuid, text, text, text, double precision, double precision, text, text, text, text, text
) to authenticated;
