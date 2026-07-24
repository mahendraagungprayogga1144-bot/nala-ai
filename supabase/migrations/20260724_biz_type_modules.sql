-- Modul khusus tipe bisnis: jasa, bengkel, kesehatan/grosir (atribut produk)

CREATE TABLE IF NOT EXISTS module_service_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  klien TEXT NOT NULL,
  judul TEXT NOT NULL,
  fee NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aktif',
  jatuh_tempo DATE,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_workshop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  pelanggan TEXT NOT NULL,
  kendaraan TEXT NOT NULL,
  keluhan TEXT,
  biaya_jasa NUMERIC DEFAULT 0,
  spare_part TEXT,
  status TEXT NOT NULL DEFAULT 'antrian',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_product_attrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  product_id UUID NOT NULL,
  expiry_date DATE,
  min_order_qty NUMERIC,
  wholesale_price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_service_jobs_biz ON module_service_jobs(business_id);
CREATE INDEX IF NOT EXISTS idx_workshop_orders_biz ON module_workshop_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_product_attrs_biz ON module_product_attrs(business_id);
CREATE INDEX IF NOT EXISTS idx_product_attrs_expiry ON module_product_attrs(expiry_date);

ALTER TABLE module_service_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_workshop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_product_attrs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_jobs_own" ON module_service_jobs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "workshop_orders_own" ON module_workshop_orders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "product_attrs_own" ON module_product_attrs FOR ALL USING (auth.uid() = user_id);
