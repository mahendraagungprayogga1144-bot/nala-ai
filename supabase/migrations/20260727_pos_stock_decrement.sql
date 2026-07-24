-- Atomic-ish stock helpers for POS (optimistic concurrency via WHERE stock = expected)
-- Apply on Supabase SQL editor if RPC preferred; app also has TS fallback.

CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  p_product_id uuid,
  p_qty numeric,
  p_expected_stock numeric
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_id uuid;
BEGIN
  UPDATE products
  SET stock = GREATEST(0, stock - p_qty)
  WHERE id = p_product_id
    AND stock = p_expected_stock
    AND stock >= p_qty
  RETURNING id INTO updated_id;
  RETURN updated_id IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, numeric, numeric) TO authenticated, anon;
