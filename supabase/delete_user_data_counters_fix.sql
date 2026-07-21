-- CivicRadar — delete_user_data counter consistency (additive, safe to re-run)
--
-- Gap: delete_user_data removed report_confirmations / report_fix_confirmations /
-- report_flags rows for the erasing user but left denormalized counters on
-- remaining reports (confirmations, fix_confirmations, flag_count). Live RPCs
-- get_tracking_dashboard / client ward pulse read those counters, so Me-too and
-- related metrics stayed inflated after "Delete my data".
--
-- Apply: Supabase Dashboard → SQL Editor → paste this file → Run.
-- (Also mirrored in schema.sql consolidated delete_user_data.)

create or replace function public.delete_user_data(p_session_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;

  -- DPDP erasure: remove report photos from Storage (report-photos/{uid}/…).
  delete from storage.objects
    where bucket_id = 'report-photos'
      and (storage.foldername(name))[1] = uid::text;

  delete from public.volunteer_tasks
    where volunteer_signup_id in (
      select id from public.volunteer_signups where user_id = uid
    );

  delete from public.volunteer_signups where user_id = uid;

  -- Drop denormalized counters on OTHER users' reports before removing this
  -- user's corroboration / fix / flag rows.
  update public.reports r
    set confirmations = greatest(0, coalesce(r.confirmations, 0) - sub.cnt)
    from (
      select report_id, count(*)::int as cnt
      from public.report_confirmations
      where user_id = uid
      group by report_id
    ) sub
    where r.id = sub.report_id;

  update public.reports r
    set fix_confirmations = greatest(0, coalesce(r.fix_confirmations, 0) - sub.cnt)
    from (
      select report_id, count(*)::int as cnt
      from public.report_fix_confirmations
      where user_id = uid
      group by report_id
    ) sub
    where r.id = sub.report_id;

  update public.reports r
    set flag_count = greatest(0, coalesce(r.flag_count, 0) - sub.cnt)
    from (
      select report_id, count(*)::int as cnt
      from public.report_flags
      where user_id = uid
      group by report_id
    ) sub
    where r.id = sub.report_id;

  delete from public.report_fix_confirmations where user_id = uid;
  delete from public.report_confirmations where user_id = uid;
  delete from public.report_flags where user_id = uid;
  delete from public.referrals where referred_user_id = uid;
  delete from public.reports where reporter_id = uid;
  delete from public.pledges where citizen_id = uid;

  if p_session_id is not null then
    delete from public.analytics_events where session_id = p_session_id;
  end if;
end $$;

grant execute on function public.delete_user_data(uuid) to anon, authenticated;
