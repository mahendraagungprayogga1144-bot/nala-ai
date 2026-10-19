-- Henima Tracking tahap 1.
-- Tidak mengubah kolom tabel yang sudah ada.
-- Satu-satunya jalur tulis titik lokasi: henima_tracking_record.

CREATE OR REPLACE FUNCTION public.henima_tracking_actor_can(p_staff_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.module_sales_staff%ROWTYPE;
  v_me public.module_sales_staff%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_target FROM public.module_sales_staff WHERE id = p_staff_id;
  IF NOT FOUND OR v_target.status = 'disabled' THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = v_target.business_id AND b.user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  SELECT * INTO v_me
  FROM public.module_sales_staff
  WHERE user_id = auth.uid()
    AND business_id = v_target.business_id
    AND status <> 'disabled'
  ORDER BY CASE role WHEN 'FOUNDER' THEN 0 WHEN 'LEADER' THEN 1 ELSE 2 END
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_me.role = 'FOUNDER' THEN
    RETURN true;
  END IF;

  IF v_me.role = 'LEADER' THEN
    RETURN v_target.id = v_me.id OR v_target.leader_id = v_me.id;
  END IF;

  RETURN v_me.role = 'SALES' AND v_target.id = v_me.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.henima_tracking_guard_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND current_setting('henima.tracking_write', true) = 'on' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Titik lokasi hanya boleh ditulis lewat henima_tracking_record.';
END;
$$;

DROP TRIGGER IF EXISTS henima_tracking_points_write_guard ON public.module_henima_tracking_points;
CREATE TRIGGER henima_tracking_points_write_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.module_henima_tracking_points
  FOR EACH ROW
  EXECUTE FUNCTION public.henima_tracking_guard_write();

CREATE OR REPLACE FUNCTION public.henima_tracking_record(
  p_staff_id uuid,
  p_kind text,
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
DECLARE
  v_staff public.module_sales_staff%ROWTYPE;
  v_now timestamptz := now();
  v_day date;
  v_start timestamptz;
  v_end timestamptz;
  v_has_in boolean;
  v_has_out boolean;
  v_id uuid;
  v_late boolean := false;
  v_note text;
  v_hour integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.henima_tracking_actor_can(p_staff_id) THEN
    RAISE EXCEPTION 'Tidak diizinkan mencatat lokasi ini.' USING ERRCODE = '42501';
  END IF;

  IF p_kind NOT IN ('checkin_pagi', 'checkin_sore', 'visit', 'ping') THEN
    RAISE EXCEPTION 'Jenis catatan tidak valid.';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL OR p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'Lokasi GPS tidak valid.';
  END IF;

  SELECT * INTO v_staff FROM public.module_sales_staff WHERE id = p_staff_id;

  v_day := (v_now AT TIME ZONE 'Asia/Jakarta')::date;
  v_start := v_day::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_end := (v_day + 1)::timestamp AT TIME ZONE 'Asia/Jakarta';

  SELECT EXISTS (
    SELECT 1 FROM public.module_henima_tracking_points
    WHERE staff_id = p_staff_id
      AND kind = 'checkin_pagi'
      AND recorded_at >= v_start
      AND recorded_at < v_end
  ) INTO v_has_in;

  SELECT EXISTS (
    SELECT 1 FROM public.module_henima_tracking_points
    WHERE staff_id = p_staff_id
      AND kind = 'checkin_sore'
      AND recorded_at >= v_start
      AND recorded_at < v_end
  ) INTO v_has_out;

  IF v_has_out THEN
    RAISE EXCEPTION 'Sudah check-out. Hari ini tidak bisa check-in atau mencatat lokasi lagi.';
  END IF;

  IF p_kind IN ('visit', 'ping') AND NOT v_has_in THEN
    RAISE EXCEPTION 'Belum check-in. Jejak dan kunjungan belum bisa dicatat.';
  END IF;

  IF p_kind = 'checkin_sore' AND NOT v_has_in THEN
    RAISE EXCEPTION 'Belum check-in. Check-out belum bisa dilakukan.';
  END IF;

  IF p_kind = 'checkin_pagi' AND v_has_in THEN
    RAISE EXCEPTION 'Check-in hari ini sudah tercatat.';
  END IF;

  v_hour := EXTRACT(HOUR FROM (v_now AT TIME ZONE 'Asia/Jakarta'))::integer;
  IF p_kind = 'checkin_pagi' AND v_hour >= 9 THEN
    v_late := true;
  END IF;

  v_note := NULLIF(btrim(left(regexp_replace(coalesce(p_note, ''), E'\\s+', ' ', 'g'), 180)), '');

  IF p_photo_path IS NOT NULL AND position(v_staff.business_id::text || '/' || p_staff_id::text || '/' IN p_photo_path) <> 1 THEN
    RAISE EXCEPTION 'Path foto tidak valid.';
  END IF;

  PERFORM set_config('henima.tracking_write', 'on', true);

  INSERT INTO public.module_henima_tracking_points (
    business_id, staff_id, kind, lat, lng, accuracy_m, note, photo_path, late, recorded_at
  ) VALUES (
    v_staff.business_id, p_staff_id, p_kind, p_lat, p_lng, p_accuracy_m, v_note, p_photo_path, v_late, v_now
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

DROP POLICY IF EXISTS "henima_tracking_points_owner" ON public.module_henima_tracking_points;

DROP POLICY IF EXISTS "henima_tracking_points_read" ON public.module_henima_tracking_points;
CREATE POLICY "henima_tracking_points_read"
  ON public.module_henima_tracking_points
  FOR SELECT
  TO authenticated
  USING (public.henima_tracking_actor_can(staff_id));

REVOKE ALL ON public.module_henima_tracking_points FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.module_henima_tracking_points TO authenticated;

REVOKE ALL ON FUNCTION public.henima_tracking_actor_can(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.henima_tracking_actor_can(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.henima_tracking_record(uuid, text, double precision, double precision, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.henima_tracking_record(uuid, text, double precision, double precision, integer, text, text) TO authenticated;
