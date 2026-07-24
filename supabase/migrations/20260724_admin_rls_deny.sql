-- Explicit deny policies for admin command center tables (client cannot read/write)
-- Service role bypasses RLS. Idempotent.

do $$ begin
  create policy app_events_no_client on app_events for all to authenticated using (false) with check (false);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy app_errors_no_client on app_errors for all to authenticated using (false) with check (false);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy platform_settings_no_client on platform_settings for all to authenticated using (false) with check (false);
exception when duplicate_object then null;
end $$;
