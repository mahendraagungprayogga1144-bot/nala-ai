-- Admin roles for owner vs support (idempotent)
insert into platform_settings (key, value) values
  ('admin_roles', '{"mahendraagungprayogga1144@gmail.com":"owner"}'::jsonb)
on conflict (key) do nothing;
