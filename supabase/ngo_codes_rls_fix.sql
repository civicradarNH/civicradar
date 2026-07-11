-- F-02: ngo_codes privilege lockdown
-- Invite codes must never be listable via the anon/authenticated Data API.
-- redeem_ngo_code is SECURITY DEFINER and continues to work for legitimate redemption.
-- Safe to re-run.

alter table public.ngo_codes enable row level security;

do $$
declare
  pol text;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'ngo_codes'
  loop
    execute format('drop policy if exists %I on public.ngo_codes', pol);
  end loop;
end $$;

revoke all on table public.ngo_codes from anon, authenticated;

grant execute on function public.redeem_ngo_code(text) to anon, authenticated;
