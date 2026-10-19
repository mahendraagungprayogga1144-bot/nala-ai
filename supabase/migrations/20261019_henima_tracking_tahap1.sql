-- Henima Tracking tahap 1 (database saja).
-- Tidak menambah, mengubah, atau menghapus kolom.
-- Jejak dan kunjungan hanya lewat function di bawah. auth.uid() adalah user-nya.
-- Pemilik bisnis (businesses.user_id) dibaca sebagai founder untuk bisnis itu,
-- selain baris module_sales_staff.role = 'FOUNDER'.

CREATE OR REPLACE FUNCTION public.henima_tracking_raise(p_code text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '%', p_code USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.henima_tracking_raise(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.henima_tracking_boleh_baca(p_staff_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.module_sales_staff AS target
      WHERE target.id = p_staff_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.businesses AS bisnis
            WHERE bisnis.id = target.business_id
              AND bisnis.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.module_sales_staff AS saya
            WHERE saya.user_id = auth.uid()
              AND saya.status <> 'disabled'
              AND saya.business_id = target.business_id
              AND (
                saya.role = 'FOUNDER'
                OR (saya.role = 'LEADER' AND (target.id = saya.id OR target.leader_id = saya.id))
                OR (saya.role = 'SALES' AND target.user_id = auth.uid())
              )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.henima_tracking_boleh_baca(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.henima_tracking_boleh_baca(uuid) TO authenticated;

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

  IF NEW.kind IN ('ping', 'visit') AND NOT v_punya_masuk THEN
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

DROP TRIGGER IF EXISTS henima_tracking_points_write_guard ON public.module_henima_tracking_points;
CREATE TRIGGER henima_tracking_points_write_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.module_henima_tracking_points
  FOR EACH ROW
  EXECUTE FUNCTION public.henima_tracking_guard_write();

CREATE OR REPLACE FUNCTION public.henima_tracking_staff_saya()
RETURNS public.module_sales_staff
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff public.module_sales_staff%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.henima_tracking_raise('TIDAK_LOGIN');
  END IF;

  SELECT staff.*
  INTO v_staff
  FROM public.module_sales_staff AS staff
  WHERE staff.user_id = auth.uid()
    AND staff.status = 'active'
  ORDER BY CASE staff.role WHEN 'FOUNDER' THEN 0 WHEN 'LEADER' THEN 1 ELSE 2 END, staff.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;

  RETURN v_staff;
END;
$$;

REVOKE ALL ON FUNCTION public.henima_tracking_staff_saya() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.henima_tracking_simpan(
  p_kind text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m integer,
  p_note text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff public.module_sales_staff%ROWTYPE;
  v_id uuid;
  v_note text;
BEGIN
  v_staff := public.henima_tracking_staff_saya();

  IF p_kind NOT IN ('ping', 'visit')
     OR p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lng < -180 OR p_lng > 180
     OR (p_accuracy_m IS NOT NULL AND p_accuracy_m < 0) THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;

  v_note := NULLIF(btrim(left(regexp_replace(coalesce(p_note, ''), E'\\s+', ' ', 'g'), 180)), '');
  PERFORM set_config('henima.tracking_write', 'on', true);

  INSERT INTO public.module_henima_tracking_points (
    business_id, staff_id, kind, lat, lng, accuracy_m, note, photo_path, late
  ) VALUES (
    v_staff.business_id, v_staff.id, p_kind, p_lat, p_lng, p_accuracy_m, v_note, NULL, false
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.henima_tracking_simpan(text, double precision, double precision, integer, text) FROM PUBLIC;

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
  RETURN public.henima_tracking_simpan('ping', p_lat, p_lng, p_accuracy_m, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.henima_tracking_catat_kunjungan(
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m integer DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.henima_tracking_simpan('visit', p_lat, p_lng, p_accuracy_m, p_note);
END;
$$;

REVOKE ALL ON FUNCTION public.henima_tracking_catat_titik(double precision, double precision, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.henima_tracking_catat_kunjungan(double precision, double precision, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.henima_tracking_catat_titik(double precision, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.henima_tracking_catat_kunjungan(double precision, double precision, integer, text) TO authenticated;

-- Function lama menerima staff_id dari pemanggil. Klien authenticated tidak boleh memakainya lagi.
REVOKE ALL ON FUNCTION public.henima_tracking_record(uuid, text, double precision, double precision, integer, text, text) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "henima_tracking_points_owner" ON public.module_henima_tracking_points;
DROP POLICY IF EXISTS "henima_tracking_points_read" ON public.module_henima_tracking_points;

CREATE POLICY "henima_tracking_points_read"
  ON public.module_henima_tracking_points
  FOR SELECT
  TO authenticated
  USING (public.henima_tracking_boleh_baca(staff_id));

REVOKE INSERT, UPDATE, DELETE ON public.module_henima_tracking_points FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.module_henima_tracking_points TO authenticated;
