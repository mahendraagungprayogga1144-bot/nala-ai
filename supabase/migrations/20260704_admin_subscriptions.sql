-- Subscriptions table
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade unique,
  plan text not null default 'free',
  status text not null default 'active',
  started_at timestamptz default now(),
  expired_at timestamptz,
  trial_ends_at timestamptz,
  notes text,
  extended_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_subscriptions_user on subscriptions(user_id);
create index idx_subscriptions_plan on subscriptions(plan);
create index idx_subscriptions_status on subscriptions(status);

-- Payments table
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  plan text not null,
  amount numeric not null default 0,
  method text,
  status text not null default 'pending',
  invoice_id text,
  confirmed_by text,
  confirmed_at timestamptz,
  period_start date,
  period_end date,
  created_at timestamptz default now()
);

create index idx_payments_user on payments(user_id);
create index idx_payments_status on payments(status);

-- Admin audit log
create table admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_email text,
  action text,
  target_user_id uuid,
  detail jsonb,
  created_at timestamptz default now()
);

create index idx_admin_logs_admin on admin_logs(admin_email);
