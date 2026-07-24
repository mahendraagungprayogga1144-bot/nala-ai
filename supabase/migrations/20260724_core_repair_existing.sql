-- REPAIR: sesuaikan dengan skema yang SUDAH ADA di nala-ai
-- products.id ternyata BIGINT (bukan uuid) → jangan pakai FK uuid

-- 1) Pastikan businesses ada
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses(user_id);

-- 2) Pastikan products ada + kolom yang app butuhkan (tanpa ubah tipe id)
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT;

-- 3) Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  type TEXT,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'bisnis';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE;

-- 4) stock_movements — product_id BIGINT (cocok dengan products.id)
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  product_id BIGINT,
  type TEXT,
  reason TEXT,
  quantity NUMERIC DEFAULT 0,
  note TEXT,
  profit_loss NUMERIC DEFAULT 0,
  movement_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Kalau tabel stock_movements sudah ada dengan product_id uuid yang salah, perbaiki:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stock_movements'
      AND column_name='product_id' AND data_type='uuid'
  ) THEN
    -- drop FK lama kalau ada
    ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;
    -- ubah ke bigint (kosongkan dulu kalau ada data uuid tidak kompatibel)
    ALTER TABLE stock_movements ALTER COLUMN product_id DROP DEFAULT;
    ALTER TABLE stock_movements ALTER COLUMN product_id TYPE BIGINT USING NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'skip alter stock_movements.product_id: %', SQLERRM;
END $$;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS profit_loss NUMERIC DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS movement_date DATE DEFAULT CURRENT_DATE;

-- 5) inventory_history
CREATE TABLE IF NOT EXISTS inventory_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  business_id UUID,
  snapshot_date DATE NOT NULL,
  total_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_history_user_id_snapshot_date_key'
  ) THEN
    ALTER TABLE inventory_history ADD CONSTRAINT inventory_history_user_id_snapshot_date_key UNIQUE (user_id, snapshot_date);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 6) profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7) RLS (aman kalau sudah ada)
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "businesses_own" ON businesses FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "products_own" ON products FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "transactions_own" ON transactions FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "stock_movements_own" ON stock_movements FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "inventory_history_own" ON inventory_history FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8) Cek hasil
SELECT
  to_regclass('public.businesses') AS businesses,
  to_regclass('public.products') AS products,
  to_regclass('public.transactions') AS transactions,
  to_regclass('public.stock_movements') AS stock_movements;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='products' AND column_name IN ('id','business_id','stock')
ORDER BY column_name;
