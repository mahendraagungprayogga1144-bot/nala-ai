-- Restore employee share-link kasir (/kasir/[token]) after owner-only RLS.
-- Token UUID is the secret; anon may read/write only the F&B kasir tables needed.
-- Idempotent.

DO $$ BEGIN
  CREATE POLICY "employees_public_kasir_select" ON employees
    FOR SELECT TO anon, authenticated
    USING (aktif = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "employees_public_kasir_update" ON employees
    FOR UPDATE TO anon, authenticated
    USING (aktif = true)
    WITH CHECK (aktif = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "businesses_public_kasir_select" ON businesses
    FOR SELECT TO anon, authenticated
    USING (
      id IN (SELECT business_id FROM employees WHERE aktif = true)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "menus_public_kasir_select" ON menus
    FOR SELECT TO anon, authenticated
    USING (
      status = 'aktif'
      AND business_id IN (SELECT business_id FROM employees WHERE aktif = true)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "menu_recipes_public_kasir_select" ON menu_recipes
    FOR SELECT TO anon, authenticated
    USING (
      EXISTS (
        SELECT 1 FROM menus m
        WHERE m.id = menu_id
          AND m.status = 'aktif'
          AND m.business_id IN (SELECT business_id FROM employees WHERE aktif = true)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "products_public_kasir_select" ON products
    FOR SELECT TO anon, authenticated
    USING (
      business_id IN (SELECT business_id FROM employees WHERE aktif = true)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "products_public_kasir_update" ON products
    FOR UPDATE TO anon, authenticated
    USING (
      business_id IN (SELECT business_id FROM employees WHERE aktif = true)
    )
    WITH CHECK (
      business_id IN (SELECT business_id FROM employees WHERE aktif = true)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "checkins_public_kasir_all" ON checkins
    FOR ALL TO anon, authenticated
    USING (
      employee_id IN (SELECT id FROM employees WHERE aktif = true)
    )
    WITH CHECK (
      employee_id IN (SELECT id FROM employees WHERE aktif = true)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "orders_public_kasir_all" ON orders
    FOR ALL TO anon, authenticated
    USING (
      business_id IN (SELECT business_id FROM employees WHERE aktif = true)
    )
    WITH CHECK (
      business_id IN (SELECT business_id FROM employees WHERE aktif = true)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "order_items_public_kasir_all" ON order_items
    FOR ALL TO anon, authenticated
    USING (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_id
          AND o.business_id IN (SELECT business_id FROM employees WHERE aktif = true)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_id
          AND o.business_id IN (SELECT business_id FROM employees WHERE aktif = true)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "transactions_public_kasir_insert" ON transactions
    FOR INSERT TO anon, authenticated
    WITH CHECK (
      business_id IN (SELECT business_id FROM employees WHERE aktif = true)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "stock_movements_public_kasir_insert" ON stock_movements
    FOR INSERT TO anon, authenticated
    WITH CHECK (
      product_id IN (
        SELECT id FROM products
        WHERE business_id IN (SELECT business_id FROM employees WHERE aktif = true)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
