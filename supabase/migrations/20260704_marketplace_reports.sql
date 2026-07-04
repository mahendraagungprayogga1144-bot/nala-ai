-- Marketplace CSV Reports & Parsed Orders

CREATE TABLE IF NOT EXISTS marketplace_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  platform TEXT NOT NULL,
  periode TEXT,
  total_omzet NUMERIC DEFAULT 0,
  total_fee NUMERIC DEFAULT 0,
  dana_diterima NUMERIC DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES marketplace_reports(id) ON DELETE CASCADE,
  order_id TEXT,
  platform TEXT NOT NULL,
  tanggal TEXT,
  nama_produk TEXT,
  sku TEXT,
  harga_jual NUMERIC DEFAULT 0,
  fee_total NUMERIC DEFAULT 0,
  dana_diterima NUMERIC DEFAULT 0,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_reports_biz ON marketplace_reports(business_id);
CREATE INDEX IF NOT EXISTS idx_mp_reports_user ON marketplace_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_parsed_orders_report ON marketplace_orders(report_id);
CREATE INDEX IF NOT EXISTS idx_mp_parsed_orders_platform ON marketplace_orders(platform);

ALTER TABLE marketplace_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_reports_own" ON marketplace_reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "mp_parsed_orders_own" ON marketplace_orders FOR ALL USING (
  EXISTS (SELECT 1 FROM marketplace_reports r WHERE r.id = report_id AND r.user_id = auth.uid())
);
