-- Allow authorized invoice posting users to record SMS send failures/successes.
-- Invoice posting must not fail just because the SMS log is protected by RLS.
create policy "sms_notice_log_admin_insert"
on public.sms_notice_log
for insert
to authenticated
with check (my_permissions() ? 'all'::text);
