-- Expand Pune report coord validation to PMC+PCMC metro union (mirrors js/config.js pune-metro).
create or replace function public.validate_report_coords(p_city text, p_lat double precision, p_lng double precision)
returns void
language plpgsql immutable set search_path = public as $$
begin
  if p_lat is null or p_lng is null then return; end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid_coords';
  end if;
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
