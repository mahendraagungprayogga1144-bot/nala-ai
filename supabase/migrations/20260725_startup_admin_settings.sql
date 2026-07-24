-- Startup admin: plan prices + soft announcement (idempotent)
insert into platform_settings (key, value) values
  ('bank_accounts', '[
    {"bank":"BCA","number":"1234567890","holder":"PT Henima Collection Indonesia"},
    {"bank":"DANA / QRIS","number":"081234567890","holder":"Gercep AI"}
  ]'::jsonb),
  ('plan_prices', '{
    "starter":40000,
    "pro":75000,
    "enterprise":150000,
    "starter_yearly":400000,
    "pro_yearly":750000,
    "enterprise_yearly":1500000
  }'::jsonb),
  ('announcement_enabled', 'false'::jsonb),
  ('announcement_message', '""'::jsonb),
  ('announcement_link', '""'::jsonb)
on conflict (key) do nothing;
