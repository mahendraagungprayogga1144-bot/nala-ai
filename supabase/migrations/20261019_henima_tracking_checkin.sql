-- Check-in pagi, check-out, dan foto dokumentasi.
-- Tidak menambah atau mengubah kolom.
-- user, jam, dan tanggal tetap dari server. Foto wajib hanya untuk check-in pagi.
-- Telat dihitung di server: jam WIB >= 9.

DROP FUNCTION IF EXISTS public.henima_tracking_catat_titik(double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.henima_tracking_catat_kunjungan(double precision, double precision, integer, text);
DROP FUNCTION IF EXISTS public.henima_tracking_simpan(text, double precision, double precision, integer, text);

CREATE OR REPLACE FUNCTION public.henima_tracking_simpan(
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
  v_staff := public.henima_tracking_staff_saya();

  IF p_kind NOT IN ('ping', 'visit', 'checkin_pagi', 'checkin_sore')
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
  IF p_kind = 'ping' AND v_photo IS NOT NULL THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;
  IF v_photo IS NOT NULL AND v_photo !~* (
    '^' || v_staff.business_id::text || '/' || v_staff.id::text
    || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  ) THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;

  v_note := NULLIF(btrim(left(regexp_replace(coalesce(p_note, ''), E'\\s+', ' ', 'g'), 180)), '');
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

REVOKE ALL ON FUNCTION public.henima_tracking_simpan(text, double precision, double precision, integer, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.henima_tracking_catat_titik(
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.henima_tracking_simpan('ping', p_lat, p_lng, p_accuracy_m, NULL, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.henima_tracking_catat_kunjungan(
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m integer DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_photo_path text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.henima_tracking_simpan('visit', p_lat, p_lng, p_accuracy_m, p_note, p_photo_path);
END;
$$;

CREATE OR REPLACE FUNCTION public.henima_tracking_checkin(
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m integer DEFAULT NULL,
  p_photo_path text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.henima_tracking_simpan('checkin_pagi', p_lat, p_lng, p_accuracy_m, NULL, p_photo_path);
END;
$$;

CREATE OR REPLACE FUNCTION public.henima_tracking_checkout(
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m integer DEFAULT NULL,
  p_photo_path text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.henima_tracking_simpan('checkin_sore', p_lat, p_lng, p_accuracy_m, NULL, p_photo_path);
END;
$$;

REVOKE ALL ON FUNCTION public.henima_tracking_catat_titik(double precision, double precision, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.henima_tracking_catat_kunjungan(double precision, double precision, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.henima_tracking_checkin(double precision, double precision, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.henima_tracking_checkout(double precision, double precision, integer, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.henima_tracking_catat_titik(double precision, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.henima_tracking_catat_kunjungan(double precision, double precision, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.henima_tracking_checkin(double precision, double precision, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.henima_tracking_checkout(double precision, double precision, integer, text) TO authenticated;
