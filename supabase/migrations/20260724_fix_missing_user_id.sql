-- FIX: products (dan tabel lain) mungkin sudah ada tanpa user_id
-- Urutan: ADD COLUMN dulu → baru CREATE POLICY

-- === PRODUCTS ===
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- === BUSINESSES ===
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- === TRANSACTIONS ===
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'bisnis';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE;

-- === STOCK_MOVEMENTS ===
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS product_id BIGINT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS profit_loss NUMERIC DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS movement_date DATE DEFAULT CURRENT_DATE;

-- Fix product_id kalau masih uuid
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stock_movements'
      AND column_name='product_id' AND udt_name='uuid'
  ) THEN
    ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;
    ALTER TABLE stock_movements ALTER COLUMN product_id DROP DEFAULT;
    ALTER TABLE stock_movements ALTER COLUMN product_id TYPE BIGINT USING NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'skip product_id cast: %', SQLERRM;
END $$;

-- === INVENTORY_HISTORY ===
CREATE TABLE IF NOT EXISTS inventory_history (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE inventory_history ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE inventory_history ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE inventory_history ADD COLUMN IF NOT EXISTS snapshot_date DATE;
ALTER TABLE inventory_history ADD COLUMN IF NOT EXISTS total_value NUMERIC DEFAULT 0;

-- === PROFILES ===
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- === RLS + POLICY (setelah kolom pasti ada) ===
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "products_own" ON products FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "businesses_own" ON businesses FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "transactions_own" ON transactions FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "stock_movements_own" ON stock_movements FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "inventory_history_own" ON inventory_history FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- === VERIFIKASI ===
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name IN ('id', 'user_id', 'business_id', 'stock', 'name')
ORDER BY 1;
