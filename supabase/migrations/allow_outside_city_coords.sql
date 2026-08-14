-- Allow user-confirmed out-of-metro pins to sync (soft confirm on client).
-- World lat/lng bounds still apply. Default p_allow_outside=false keeps old callers safe.

drop function if exists public.insert_report(uuid, text, text, text, double precision, double precision, text, text, text, text, text);
drop function if exists public.insert_report(uuid, text, text, text, double precision, double precision, text, text, text, text, text, boolean);
drop function if exists public.validate_report_coords(text, double precision, double precision);
drop function if exists public.validate_report_coords(text, double precision, double precision, boolean);

create or replace function public.validate_report_coords(
  p_city text,
  p_lat double precision,
  p_lng double precision,
  p_allow_outside boolean default false
)
returns void
language plpgsql immutable set search_path = public as $$
begin
  if p_lat is null or p_lng is null then return; end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid_coords';
  end if;
  if coalesce(p_allow_outside, false) then return; end if;
  case coalesce(nullif(btrim(p_city), ''), 'mumbai')
    when 'mumbai' then
      if p_lat < 18.88 or p_lat > 19.28 or p_lng < 72.78 or p_lng > 73.0 then
        raise exception 'coords_out_of_city';
      end if;
    when 'pune' then
      if p_lat < 18.44 or p_lat > 18.72 or p_lng < 73.74 or p_lng > 73.95 then
        raise exception 'coords_out_of_city';
      end if;
    when 'thane' then
      if p_lat < 19.15 or p_lat > 19.28 or p_lng < 72.92 or p_lng > 73.05 then
        raise exception 'coords_out_of_city';
      end if;
    else null;
  end case;
end $$;

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
  p_neighbourhood text default null,
  p_allow_outside boolean default false
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

  perform public.validate_report_coords(cid, p_lat, p_lng, coalesce(p_allow_outside, false));

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
  uuid, text, text, text, double precision, double precision, text, text, text, text, text, boolean
) to authenticated;
