-- Menempelkan akun yang sedang login ke sales pemilik link.
-- Hanya mengisi user_id yang masih kosong. Tidak mengubah kolom.

CREATE OR REPLACE FUNCTION public.henima_tracking_klaim(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff public.module_sales_staff%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.henima_tracking_raise('TIDAK_LOGIN');
  END IF;

  IF p_token IS NULL OR p_token !~ '^[a-fA-F0-9]{32}$' THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;

  SELECT staff.*
  INTO v_staff
  FROM public.module_henima_tracking_links AS link
  JOIN public.module_sales_staff AS staff
    ON staff.id = link.staff_id
   AND staff.business_id = link.business_id
  WHERE link.token = lower(p_token);

  IF NOT FOUND OR v_staff.status <> 'active' OR v_staff.role = 'FOUNDER' THEN
    PERFORM public.henima_tracking_raise('DATA_TIDAK_VALID');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('klaim:' || v_staff.id::text, 0));

  SELECT staff.*
  INTO v_staff
  FROM public.module_sales_staff AS staff
  WHERE staff.id = v_staff.id;

  IF v_staff.user_id = auth.uid() THEN
    RETURN v_staff.id;
  END IF;

  IF v_staff.user_id IS NOT NULL THEN
    PERFORM public.henima_tracking_raise('LINK_SUDAH_DIPAKAI');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.module_sales_staff AS lain
    WHERE lain.user_id = auth.uid()
      AND lain.status = 'active'
      AND lain.id <> v_staff.id
  ) THEN
    PERFORM public.henima_tracking_raise('AKUN_SUDAH_TERHUBUNG');
  END IF;

  UPDATE public.module_sales_staff
  SET user_id = auth.uid(), updated_at = now()
  WHERE id = v_staff.id
    AND user_id IS NULL;

  IF NOT FOUND THEN
    PERFORM public.henima_tracking_raise('LINK_SUDAH_DIPAKAI');
  END IF;

  RETURN v_staff.id;
END;
$$;

REVOKE ALL ON FUNCTION public.henima_tracking_klaim(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.henima_tracking_klaim(text) TO authenticated;
