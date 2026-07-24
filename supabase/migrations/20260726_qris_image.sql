-- QRIS image URL for Upgrade checkout (idempotent)
insert into platform_settings (key, value) values
  ('qris_image_url', '""'::jsonb)
on conflict (key) do nothing;

-- Public bucket for platform assets (QRIS barcode, etc.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'platform-assets',
  'platform-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;
