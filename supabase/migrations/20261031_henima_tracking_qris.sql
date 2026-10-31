-- QRIS gambar saja (tanpa Midtrans).
-- Tambah kind 'qris' di titik jejak. Kolom lain tidak diubah.
-- Saat sales tampilkan QRIS, tercatat di riwayat atas nama sales itu.

ALTER TABLE public.module_henima_tracking_points
  DROP CONSTRAINT IF EXISTS module_henima_tracking_points_kind_check;

ALTER TABLE public.module_henima_tracking_points
  ADD CONSTRAINT module_henima_tracking_points_kind_check
  CHECK (kind IN ('checkin_pagi', 'checkin_sore', 'visit', 'ping', 'qris'));

CREATE OR REPLACE FUNCTION public.henima_tracking_guard_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_day date;
  v_start timestamptz;
  v_end timestamptz;
  v_punya_masuk boolean;
  v_sudah_pulang boolean;
  v_sudah_masuk boolean;
BEGIN
  IF TG_OP <> 'INSERT' OR current_setting('henima.tracking_write', true) IS DISTINCT FROM 'on' THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;

  IF NEW.lat IS NULL OR NEW.lng IS NULL
     OR NEW.lat < -90 OR NEW.lat > 90
     OR NEW.lng < -180 OR NEW.lng > 180
     OR (NEW.accuracy_m IS NOT NULL AND NEW.accuracy_m < 0) THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;

  v_day := (v_now AT TIME ZONE 'Asia/Jakarta')::date;
  v_start := v_day::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_end := (v_day + 1)::timestamp AT TIME ZONE 'Asia/Jakarta';
  NEW.recorded_at := v_now;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.staff_id::text || ':' || v_day::text, 0));

  SELECT EXISTS (
    SELECT 1
    FROM public.module_henima_tracking_points AS titik
    WHERE titik.staff_id = NEW.staff_id
      AND titik.kind = 'checkin_pagi'
      AND titik.recorded_at >= v_start
      AND titik.recorded_at < v_end
  ) INTO v_punya_masuk;

  SELECT EXISTS (
    SELECT 1
    FROM public.module_henima_tracking_points AS titik
    WHERE titik.staff_id = NEW.staff_id
      AND titik.kind = 'checkin_sore'
      AND titik.recorded_at >= v_start
      AND titik.recorded_at < v_end
  ) INTO v_sudah_pulang;

  IF v_sudah_pulang THEN
    PERFORM public.henima_tracking_raise('SUDAH_CHECKOUT');
  END IF;

  IF NEW.kind IN ('ping', 'visit', 'qris') AND NOT v_punya_masuk THEN
    PERFORM public.henima_tracking_raise('BELUM_CHECKIN');
  END IF;

  IF NEW.kind = 'checkin_sore' AND NOT v_punya_masuk THEN
    PERFORM public.henima_tracking_raise('BELUM_CHECKIN');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.module_henima_tracking_points AS titik
    WHERE titik.staff_id = NEW.staff_id
      AND titik.kind = 'checkin_pagi'
      AND titik.recorded_at >= v_start
      AND titik.recorded_at < v_end
  ) INTO v_sudah_masuk;

  IF NEW.kind = 'checkin_pagi' AND v_sudah_masuk THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.henima_tracking_simpan_token(
  p_token text,
  p_kind text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m integer,
  p_note text,
  p_photo_path text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff public.module_sales_staff%ROWTYPE;
  v_id uuid;
  v_note text;
  v_photo text;
  v_late boolean := false;
BEGIN
  v_staff := public.henima_tracking_staff_dari_token(p_token);

  IF p_kind NOT IN ('ping', 'visit', 'checkin_pagi', 'checkin_sore', 'qris')
     OR p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lng < -180 OR p_lng > 180
     OR (p_accuracy_m IS NOT NULL AND p_accuracy_m < 0) THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;

  v_photo := NULLIF(btrim(coalesce(p_photo_path, '')), '');
  IF p_kind = 'checkin_pagi' AND v_photo IS NULL THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;
  IF p_kind IN ('ping', 'qris') AND v_photo IS NOT NULL THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;
  IF v_photo IS NOT NULL AND v_photo !~* (
    '^' || v_staff.business_id::text || '/' || v_staff.id::text
    || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  ) THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;

  v_note := NULLIF(btrim(left(regexp_replace(coalesce(p_note, ''), E'\\s+', ' ', 'g'), 180)), '');
  IF p_kind = 'qris' THEN
    v_note := coalesce(v_note, 'QRIS');
  END IF;
  IF p_kind = 'checkin_pagi' AND EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Jakarta'))::integer >= 9 THEN
    v_late := true;
  END IF;

  PERFORM set_config('henima.tracking_write', 'on', true);

  INSERT INTO public.module_henima_tracking_points (
    business_id, staff_id, kind, lat, lng, accuracy_m, note, photo_path, late
  ) VALUES (
    v_staff.business_id, v_staff.id, p_kind, p_lat, p_lng, p_accuracy_m, v_note, v_photo, v_late
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.henima_tracking_field_qris(
  p_token text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.henima_tracking_simpan_token(p_token, 'qris', p_lat, p_lng, p_accuracy_m, 'QRIS', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.henima_tracking_field_qris(text, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.henima_tracking_field_qris(text, double precision, double precision, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
