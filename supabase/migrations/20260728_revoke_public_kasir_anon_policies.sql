-- SECURITY: Drop tenant-agnostic public-kasir policies.
-- Those policies only required "employees.aktif = true" (no token, no auth.uid),
-- so anon/authenticated could read/write any F&B tenant with an active employee.
-- Public /kasir/[token] must use service role + token lookup in the app
-- (lib/kasir/public-db.ts), not broad table policies.

DROP POLICY IF EXISTS "employees_public_kasir_select" ON employees;
DROP POLICY IF EXISTS "employees_public_kasir_update" ON employees;
DROP POLICY IF EXISTS "businesses_public_kasir_select" ON businesses;
DROP POLICY IF EXISTS "menus_public_kasir_select" ON menus;
DROP POLICY IF EXISTS "menu_recipes_public_kasir_select" ON menu_recipes;
DROP POLICY IF EXISTS "products_public_kasir_select" ON products;
DROP POLICY IF EXISTS "products_public_kasir_update" ON products;
DROP POLICY IF EXISTS "checkins_public_kasir_all" ON checkins;
DROP POLICY IF EXISTS "orders_public_kasir_all" ON orders;
DROP POLICY IF EXISTS "order_items_public_kasir_all" ON order_items;
DROP POLICY IF EXISTS "transactions_public_kasir_insert" ON transactions;
DROP POLICY IF EXISTS "stock_movements_public_kasir_insert" ON stock_movements;

-- kasir_shifts had no RLS — any authenticated client could read/write all shifts
ALTER TABLE IF EXISTS kasir_shifts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "kasir_shifts_own" ON kasir_shifts
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Harden stock RPC: require product ownership for authenticated callers;
-- revoke anon (public kasir uses service role / direct updates).
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
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RETURN false;
  END IF;

  UPDATE products
  SET stock = GREATEST(0, stock - p_qty)
  WHERE id = p_product_id
    AND user_id = caller
    AND stock = p_expected_stock
    AND stock >= p_qty
  RETURNING id INTO updated_id;

  RETURN updated_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, numeric, numeric) TO authenticated;
