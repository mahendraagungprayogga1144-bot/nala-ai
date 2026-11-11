-- Pastikan jejak GPS (ping/visit/qris) tidak ditolak sebelum absensi pagi.
-- Absensi foto tetap opsional untuk catatan; GPS jalan terus sampai auto tutup 18:00 WIB.

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
  v_hour integer;
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
  v_hour := EXTRACT(HOUR FROM (v_now AT TIME ZONE 'Asia/Jakarta'))::integer;
  NEW.recorded_at := v_now;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.staff_id::text || ':' || v_day::text, 0));

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

  -- Jam 18:00+ WIB: titik lapangan otomatis jadi "selesai kerja".
  IF v_hour >= 18 AND NEW.kind IN ('ping', 'visit', 'qris') THEN
    NEW.kind := 'checkin_sore';
    NEW.note := coalesce(NULLIF(btrim(NEW.note), ''), 'Auto tutup jam 18:00');
    NEW.photo_path := NULL;
  END IF;

  -- Continuous GPS: ping/visit/qris TIDAK butuh check-in pagi.

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
