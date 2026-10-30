-- Check-in lapangan lewat token link, tanpa login.
-- Kolom tabel tidak berubah. Aturan check-in/checkout/telat tetap sama.
-- Link 32-hex = kunci akses sales itu.

CREATE OR REPLACE FUNCTION public.henima_tracking_staff_dari_token(p_token text)
RETURNS public.module_sales_staff
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff public.module_sales_staff%ROWTYPE;
  v_clean text;
BEGIN
  v_clean := lower(btrim(coalesce(p_token, '')));
  IF v_clean !~ '^[a-f0-9]{32}$' THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;

  SELECT s.*
  INTO v_staff
  FROM public.module_henima_tracking_links l
  JOIN public.module_sales_staff s ON s.id = l.staff_id
  WHERE l.token = v_clean
    AND s.business_id = l.business_id
    AND s.status <> 'disabled';

  IF NOT FOUND THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;

  RETURN v_staff;
END;
$$;

REVOKE ALL ON FUNCTION public.henima_tracking_staff_dari_token(text) FROM PUBLIC;

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

REVOKE ALL ON FUNCTION public.henima_tracking_simpan_token(text, text, double precision, double precision, integer, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.henima_tracking_field_checkin(
  p_token text,
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
  RETURN public.henima_tracking_simpan_token(p_token, 'checkin_pagi', p_lat, p_lng, p_accuracy_m, NULL, p_photo_path);
END;
$$;

CREATE OR REPLACE FUNCTION public.henima_tracking_field_checkout(
  p_token text,
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
  RETURN public.henima_tracking_simpan_token(p_token, 'checkin_sore', p_lat, p_lng, p_accuracy_m, NULL, p_photo_path);
END;
$$;

CREATE OR REPLACE FUNCTION public.henima_tracking_field_kunjungan(
  p_token text,
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
  RETURN public.henima_tracking_simpan_token(p_token, 'visit', p_lat, p_lng, p_accuracy_m, p_note, p_photo_path);
END;
$$;

CREATE OR REPLACE FUNCTION public.henima_tracking_field_titik(
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
  RETURN public.henima_tracking_simpan_token(p_token, 'ping', p_lat, p_lng, p_accuracy_m, NULL, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.henima_tracking_field_hari_ini(p_token text)
RETURNS TABLE (
  id uuid,
  staff_id uuid,
  kind text,
  lat double precision,
  lng double precision,
  accuracy_m integer,
  note text,
  photo_path text,
  late boolean,
  recorded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff public.module_sales_staff%ROWTYPE;
  v_day date;
  v_from timestamptz;
  v_to timestamptz;
BEGIN
  v_staff := public.henima_tracking_staff_dari_token(p_token);
  v_day := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_from := v_day::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_to := (v_day + 1)::timestamp AT TIME ZONE 'Asia/Jakarta';

  RETURN QUERY
  SELECT
    p.id,
    p.staff_id,
    p.kind,
    p.lat,
    p.lng,
    p.accuracy_m,
    p.note,
    p.photo_path,
    p.late,
    p.recorded_at
  FROM public.module_henima_tracking_points p
  WHERE p.staff_id = v_staff.id
    AND p.recorded_at >= v_from
    AND p.recorded_at < v_to
  ORDER BY p.recorded_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.henima_tracking_field_checkin(text, double precision, double precision, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.henima_tracking_field_checkout(text, double precision, double precision, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.henima_tracking_field_kunjungan(text, double precision, double precision, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.henima_tracking_field_titik(text, double precision, double precision, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.henima_tracking_field_hari_ini(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.henima_tracking_field_checkin(text, double precision, double precision, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.henima_tracking_field_checkout(text, double precision, double precision, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.henima_tracking_field_kunjungan(text, double precision, double precision, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.henima_tracking_field_titik(text, double precision, double precision, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.henima_tracking_field_hari_ini(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
