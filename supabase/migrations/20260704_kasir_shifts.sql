create table kasir_shifts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses on delete cascade,
  user_id uuid references auth.users,
  modal_awal numeric default 0,
  total_transaksi numeric default 0,
  total_order int default 0,
  kas_akhir numeric default 0,
  opened_at timestamptz default now(),
  closed_at timestamptz,
  status text default 'open'
);

create index idx_kasir_shifts_business on kasir_shifts(business_id);
create index idx_kasir_shifts_user on kasir_shifts(user_id);
create index idx_kasir_shifts_status on kasir_shifts(status);
