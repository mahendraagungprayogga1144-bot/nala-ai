-- Modul perusahaan — masing-masing punya tabel & input sendiri (additive)

CREATE TABLE IF NOT EXISTS module_tax_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  npwp TEXT,
  nama_wp TEXT,
  alamat TEXT,
  jenis_usaha TEXT,
  omzet_lapor NUMERIC DEFAULT 0,
  pengeluaran_lapor NUMERIC DEFAULT 0,
  periode_bulan INTEGER NOT NULL,
  periode_tahun INTEGER NOT NULL,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_crm_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  nama TEXT NOT NULL,
  telepon TEXT,
  email TEXT,
  alamat TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  kode TEXT NOT NULL,
  nama_barang TEXT NOT NULL,
  merek TEXT,
  supplier TEXT,
  harga NUMERIC,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_trade_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  nama_barang TEXT NOT NULL,
  kondisi TEXT DEFAULT 'baru',
  harga_jual NUMERIC,
  harga_beli NUMERIC,
  lokasi TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_marketplace_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  platform TEXT NOT NULL,
  nama_toko TEXT NOT NULL,
  url_toko TEXT,
  seller_id TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_marketing_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  judul TEXT,
  caption TEXT NOT NULL,
  channel TEXT DEFAULT 'whatsapp',
  jadwal DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_research_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  topik TEXT NOT NULL,
  temuan TEXT,
  sumber TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_commission_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  nama TEXT NOT NULL,
  jabatan TEXT,
  komisi_pct NUMERIC DEFAULT 5,
  telepon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_commission_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  staff_id UUID NOT NULL REFERENCES module_commission_staff(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  omzet NUMERIC NOT NULL DEFAULT 0,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_platform_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  channel TEXT NOT NULL,
  identifier TEXT,
  aktif BOOLEAN DEFAULT false,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_tax_biz ON module_tax_profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_module_crm_biz ON module_crm_customers(business_id);
CREATE INDEX IF NOT EXISTS idx_module_barcode_biz ON module_barcodes(business_id);
CREATE INDEX IF NOT EXISTS idx_module_trade_biz ON module_trade_listings(business_id);
CREATE INDEX IF NOT EXISTS idx_module_mkt_store_biz ON module_marketplace_stores(business_id);
CREATE INDEX IF NOT EXISTS idx_module_mkt_draft_biz ON module_marketing_drafts(business_id);
CREATE INDEX IF NOT EXISTS idx_module_research_biz ON module_research_notes(business_id);
CREATE INDEX IF NOT EXISTS idx_module_comm_staff_biz ON module_commission_staff(business_id);
CREATE INDEX IF NOT EXISTS idx_module_comm_sales_biz ON module_commission_sales(business_id);
CREATE INDEX IF NOT EXISTS idx_module_platform_biz ON module_platform_channels(business_id);

ALTER TABLE module_tax_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_trade_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_marketplace_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_marketing_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_research_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_commission_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_commission_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_platform_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_tax_own" ON module_tax_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "module_crm_own" ON module_crm_customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "module_barcode_own" ON module_barcodes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "module_trade_own" ON module_trade_listings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "module_mkt_store_own" ON module_marketplace_stores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "module_mkt_draft_own" ON module_marketing_drafts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "module_research_own" ON module_research_notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "module_comm_staff_own" ON module_commission_staff FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "module_comm_sales_own" ON module_commission_sales FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "module_platform_own" ON module_platform_channels FOR ALL USING (auth.uid() = user_id);
