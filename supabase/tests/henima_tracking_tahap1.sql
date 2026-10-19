-- Tes manual Henima Tracking tahap 1.
-- JANGAN dijalankan otomatis. Jalankan sendiri di SQL editor, lalu biarkan ROLLBACK di akhir.
-- Butuh hak postgres untuk menyiapkan auth.users. Tidak memakai service_role.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.ok(p_label text, p_pass boolean) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_pass THEN
    RAISE EXCEPTION 'GAGAL: %', p_label;
  END IF;
  RAISE NOTICE 'LULUS: %', p_label;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.kode(p_sql text) RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION pg_temp.ok(text, boolean) TO PUBLIC;
GRANT EXECUTE ON FUNCTION pg_temp.kode(text) TO PUBLIC;

-- Batas hari WIB, ekspresi yang sama dengan trigger: (waktu AT TIME ZONE 'Asia/Jakarta')::date
SELECT pg_temp.ok(
  '23:59 WIB masih hari yang sama',
  (timestamptz '2026-10-19 16:59:00+00' AT TIME ZONE 'Asia/Jakarta')::date = DATE '2026-10-19'
);
SELECT pg_temp.ok(
  '00:01 WIB sudah hari berikutnya',
  (timestamptz '2026-10-19 17:01:00+00' AT TIME ZONE 'Asia/Jakarta')::date = DATE '2026-10-20'
);

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'founder-tracking@test.local', '', now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'leader-tracking@test.local', '', now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'sales-a-tracking@test.local', '', now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'sales-b-tracking@test.local', '', now(), now(), '{}'::jsonb, '{}'::jsonb);

INSERT INTO public.businesses (id, user_id, name)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Bisnis Tes Tracking');

INSERT INTO public.module_sales_staff (id, business_id, user_id, role, leader_id, nama, status)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'FOUNDER', NULL, 'Founder', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'LEADER', NULL, 'Leader', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'SALES', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Sales A', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'SALES', NULL, 'Sales B', 'active');

CREATE OR REPLACE FUNCTION pg_temp.jadi(p_user uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END;
$$;

SELECT pg_temp.jadi('33333333-3333-3333-3333-333333333333');
SELECT pg_temp.ok(
  'titik sebelum check-in ditolak',
  pg_temp.kode($q$SELECT public.henima_tracking_catat_titik(-6.2, 106.8, 10)$q$) = 'BELUM_CHECKIN'
);
SELECT pg_temp.ok(
  'kunjungan sebelum check-in ditolak',
  pg_temp.kode($q$SELECT public.henima_tracking_catat_kunjungan(-6.2, 106.8, 10, 'Toko A')$q$) = 'BELUM_CHECKIN'
);
SELECT pg_temp.ok(
  'sales tidak bisa menyisipkan user_id orang lain',
  pg_temp.kode($q$SELECT public.henima_tracking_catat_titik(-6.2, 106.8, 10, '44444444-4444-4444-4444-444444444444'::uuid)$q$) LIKE '%does not exist%'
);
SELECT pg_temp.ok(
  'koordinat tidak valid ditolak',
  pg_temp.kode($q$SELECT public.henima_tracking_catat_titik(120, 106.8, 10)$q$) = 'DATA_TIDAK_VALID'
);
SELECT pg_temp.ok(
  'akurasi negatif ditolak',
  pg_temp.kode($q$SELECT public.henima_tracking_catat_titik(-6.2, 106.8, -1)$q$) = 'DATA_TIDAK_VALID'
);
SELECT pg_temp.ok(
  'insert langsung ditolak',
  pg_temp.kode($q$
    INSERT INTO public.module_henima_tracking_points (business_id, staff_id, kind, lat, lng)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'ping', -6.2, 106.8)
  $q$) IS NOT NULL
);

RESET ROLE;
SELECT set_config('henima.tracking_write', 'on', true);
INSERT INTO public.module_henima_tracking_points (business_id, staff_id, kind, lat, lng)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'checkin_pagi', -6.2, 106.8);

SELECT pg_temp.jadi('33333333-3333-3333-3333-333333333333');
SELECT public.henima_tracking_catat_titik(-6.21, 106.81, 12);
SELECT pg_temp.ok(
  'titik setelah check-in memakai waktu server',
  EXISTS (
    SELECT 1
    FROM public.module_henima_tracking_points
    WHERE staff_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'
      AND kind = 'ping'
      AND recorded_at > now() - interval '2 minutes'
      AND recorded_at <= now() + interval '2 seconds'
  )
);

RESET ROLE;
SELECT set_config('henima.tracking_write', 'on', true);
SELECT pg_temp.ok(
  'check-in kedua pada hari yang sama ditolak',
  pg_temp.kode($q$
    INSERT INTO public.module_henima_tracking_points (business_id, staff_id, kind, lat, lng)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'checkin_pagi', -6.2, 106.8)
  $q$) = 'DATA_TIDAK_VALID'
);

SELECT set_config('henima.tracking_write', 'on', true);
INSERT INTO public.module_henima_tracking_points (business_id, staff_id, kind, lat, lng)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'checkin_sore', -6.2, 106.8);

SELECT pg_temp.jadi('33333333-3333-3333-3333-333333333333');
SELECT pg_temp.ok(
  'titik setelah check-out ditolak',
  pg_temp.kode($q$SELECT public.henima_tracking_catat_titik(-6.22, 106.82, 8)$q$) = 'SUDAH_CHECKOUT'
);

RESET ROLE;
SELECT set_config('henima.tracking_write', 'on', true);
SELECT pg_temp.ok(
  'check-in ulang setelah check-out ditolak',
  pg_temp.kode($q$
    INSERT INTO public.module_henima_tracking_points (business_id, staff_id, kind, lat, lng)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'checkin_pagi', -6.2, 106.8)
  $q$) = 'SUDAH_CHECKOUT'
);

RESET ROLE;
SELECT set_config('henima.tracking_write', 'on', true);
INSERT INTO public.module_henima_tracking_points (business_id, staff_id, kind, lat, lng)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'checkin_pagi', -6.3, 106.9);

SELECT pg_temp.jadi('33333333-3333-3333-3333-333333333333');
SELECT pg_temp.ok(
  'sales A tidak membaca data sales B',
  NOT EXISTS (
    SELECT 1 FROM public.module_henima_tracking_points
    WHERE staff_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'
  )
);

SELECT pg_temp.jadi('22222222-2222-2222-2222-222222222222');
SELECT pg_temp.ok(
  'leader melihat sales di timnya',
  EXISTS (
    SELECT 1 FROM public.module_henima_tracking_points
    WHERE staff_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'
  )
);
SELECT pg_temp.ok(
  'leader tidak melihat sales di luar tim',
  NOT EXISTS (
    SELECT 1 FROM public.module_henima_tracking_points
    WHERE staff_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'
  )
);

SELECT pg_temp.jadi('11111111-1111-1111-1111-111111111111');
SELECT pg_temp.ok(
  'founder melihat sales A dan sales B',
  (
    SELECT count(DISTINCT staff_id)
    FROM public.module_henima_tracking_points
    WHERE staff_id IN (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'
    )
  ) = 2
);

RESET ROLE;
SELECT pg_temp.ok(
  'tanpa login ditolak',
  pg_temp.kode($q$SELECT public.henima_tracking_catat_titik(-6.2, 106.8, 10)$q$) = 'TIDAK_LOGIN'
);

ROLLBACK;
