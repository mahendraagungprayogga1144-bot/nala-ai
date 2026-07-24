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
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for QRIS images (service role already bypasses RLS for upload)
drop policy if exists "platform_assets_public_read" on storage.objects;
create policy "platform_assets_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'platform-assets');
