-- Marketplace Center — produk & pesanan per toko (additive)

CREATE TABLE IF NOT EXISTS module_mp_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES module_marketplace_stores(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  sku TEXT,
  harga NUMERIC DEFAULT 0,
  stok INTEGER DEFAULT 0,
  kategori TEXT,
  platform TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_mp_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES module_marketplace_stores(id) ON DELETE CASCADE,
  no_pesanan TEXT,
  pembeli TEXT NOT NULL,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'baru',
  platform TEXT,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_products_store ON module_mp_products(store_id);
CREATE INDEX IF NOT EXISTS idx_mp_products_biz ON module_mp_products(business_id);
CREATE INDEX IF NOT EXISTS idx_mp_orders_store ON module_mp_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_mp_orders_biz ON module_mp_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_mp_orders_status ON module_mp_orders(status);

ALTER TABLE module_mp_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_mp_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_products_own" ON module_mp_products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "mp_orders_own" ON module_mp_orders FOR ALL USING (auth.uid() = user_id);
