-- Identitas staff dari akun yang sedang login, untuk path foto check-in.

CREATE OR REPLACE FUNCTION public.henima_tracking_identitas()
RETURNS TABLE (staff_id uuid, business_id uuid, nama text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff public.module_sales_staff%ROWTYPE;
BEGIN
  v_staff := public.henima_tracking_staff_saya();
  staff_id := v_staff.id;
  business_id := v_staff.business_id;
  nama := v_staff.nama;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.henima_tracking_identitas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.henima_tracking_identitas() TO authenticated;

NOTIFY pgrst, 'reload schema';
