-- Foto dokumentasi Henima Tracking. Bukan kolom tabel.
-- Sales, leader, dan founder yang lolos henima_tracking_actor_can boleh unggah dan membaca fotonya.

DROP POLICY IF EXISTS "henima_tracking_staff_write" ON storage.objects;
CREATE POLICY "henima_tracking_staff_write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'henima-tracking'
    AND split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
    AND public.henima_tracking_actor_can(split_part(name, '/', 2)::uuid)
  );

DROP POLICY IF EXISTS "henima_tracking_staff_read" ON storage.objects;
CREATE POLICY "henima_tracking_staff_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'henima-tracking'
    AND split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
    AND public.henima_tracking_actor_can(split_part(name, '/', 2)::uuid)
  );
