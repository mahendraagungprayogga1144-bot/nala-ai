-- Core F&B + Home Industry tables (idempotent) for fresh environments

CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  nama TEXT NOT NULL,
  kategori TEXT DEFAULT 'Makanan',
  harga_jual NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'aktif',
  yield_quantity NUMERIC DEFAULT 1,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'gr',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  nama TEXT NOT NULL,
  jabatan TEXT,
  kasir_token UUID DEFAULT gen_random_uuid(),
  webauthn_credential_id TEXT,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  user_id UUID,
  business_id UUID,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  jam_masuk TIMESTAMPTZ,
  jam_keluar TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  total NUMERIC DEFAULT 0,
  diskon NUMERIC DEFAULT 0,
  hpp NUMERIC DEFAULT 0,
  laba NUMERIC DEFAULT 0,
  metode_bayar TEXT DEFAULT 'tunai',
  catatan TEXT,
  order_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_id UUID,
  qty NUMERIC DEFAULT 1,
  harga_jual NUMERIC DEFAULT 0,
  hpp NUMERIC DEFAULT 0,
  laba NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  name TEXT NOT NULL,
  product_id UUID,
  yield_quantity NUMERIC DEFAULT 1,
  yield_unit TEXT DEFAULT 'pcs',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  material_id UUID NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'gr',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  quantity_produced NUMERIC DEFAULT 0,
  total_material_cost NUMERIC DEFAULT 0,
  additional_cost NUMERIC DEFAULT 0,
  hpp_per_unit NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'selesai',
  production_date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menus_biz ON menus(business_id);
CREATE INDEX IF NOT EXISTS idx_employees_biz ON employees(business_id);
CREATE INDEX IF NOT EXISTS idx_employees_token ON employees(kasir_token);
CREATE INDEX IF NOT EXISTS idx_orders_biz_date ON orders(business_id, order_date);
CREATE INDEX IF NOT EXISTS idx_recipes_biz ON recipes(business_id);
CREATE INDEX IF NOT EXISTS idx_production_logs_biz ON production_logs(business_id);

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "menus_own" ON menus FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "menu_recipes_via_menu" ON menu_recipes FOR ALL USING (
    EXISTS (SELECT 1 FROM menus m WHERE m.id = menu_id AND m.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "employees_own" ON employees FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "checkins_own" ON checkins FOR ALL USING (auth.uid() = user_id OR employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- orders: owner sees own + employee sales on their businesses (if businesses exists)
DO $$ BEGIN
  IF to_regclass('public.businesses') IS NOT NULL THEN
    CREATE POLICY "orders_own" ON orders FOR ALL USING (
      auth.uid() = user_id
      OR business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );
  ELSE
    CREATE POLICY "orders_own" ON orders FOR ALL USING (auth.uid() = user_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  IF to_regclass('public.businesses') IS NOT NULL THEN
    CREATE POLICY "order_items_via_order" ON order_items FOR ALL USING (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_id
          AND (
            o.user_id = auth.uid()
            OR o.business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
          )
      )
    );
  ELSE
    CREATE POLICY "order_items_via_order" ON order_items FOR ALL USING (
      EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    );
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "recipes_own" ON recipes FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "recipe_ingredients_via_recipe" ON recipe_ingredients FOR ALL USING (
    EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "production_logs_own" ON production_logs FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public kasir (anon) policies: see 20260724_public_kasir_anon_policies.sql
-- Token-based employee share links need read/write beyond owner-only RLS.
