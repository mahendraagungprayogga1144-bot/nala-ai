-- Admin Command Center: events, errors, platform settings
-- Idempotent for existing projects.

create table if not exists app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  business_id uuid,
  event text not null,
  module text,
  meta jsonb default '{}'::jsonb,
  path text,
  ua text,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_events_created on app_events (created_at desc);
create index if not exists idx_app_events_user_created on app_events (user_id, created_at desc);
create index if not exists idx_app_events_module_created on app_events (module, created_at desc);
create index if not exists idx_app_events_event_created on app_events (event, created_at desc);

create table if not exists app_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  source text,
  message text not null,
  stack text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_errors_created on app_errors (created_at desc);

create table if not exists platform_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_email text,
  action text,
  target_user_id uuid,
  detail jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_admin_logs_admin on admin_logs (admin_email);
create index if not exists idx_admin_logs_created on admin_logs (created_at desc);

insert into platform_settings (key, value) values
  ('trial_days', '5'::jsonb),
  ('maintenance_mode', 'false'::jsonb),
  ('maintenance_message', '"Sedang maintenance. Coba lagi sebentar."'::jsonb),
  ('signup_open', 'true'::jsonb),
  ('demo_enabled', 'true'::jsonb),
  ('payment_wa', '"6281234567890"'::jsonb),
  ('support_email', '"mahendraagungprayogga1144@gmail.com"'::jsonb),
  ('app_url', '"https://www.gercepos.id"'::jsonb),
  ('admin_emails', '["mahendraagungprayogga1144@gmail.com"]'::jsonb),
  ('feature_flags', '{"ai_kasir":true,"ai_jual_beli":true,"pwa_banner":true,"marketplace":true,"pajak":true}'::jsonb),
  ('event_retention_days', '90'::jsonb)
on conflict (key) do nothing;

alter table app_events enable row level security;
alter table app_errors enable row level security;
alter table platform_settings enable row level security;
