-- Gercep AI — Modul Peternakan (farm_batches + farm_transactions)

CREATE TABLE IF NOT EXISTS farm_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  nama_batch TEXT NOT NULL,
  jenis_ternak TEXT NOT NULL,
  tanggal_mulai DATE NOT NULL DEFAULT CURRENT_DATE,
  tanggal_selesai DATE,
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES farm_batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  jenis_transaksi TEXT NOT NULL,
  nama_item TEXT,
  qty DECIMAL(14, 2),
  satuan TEXT,
  harga DECIMAL(14, 2),
  total DECIMAL(14, 2) NOT NULL DEFAULT 0,
  catatan TEXT,
  keuangan_tx_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_farm_batches_business ON farm_batches(business_id);
CREATE INDEX IF NOT EXISTS idx_farm_batches_user ON farm_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_farm_transactions_batch ON farm_transactions(batch_id);

ALTER TABLE farm_transactions ADD COLUMN IF NOT EXISTS keuangan_tx_ids UUID[] DEFAULT '{}';

ALTER TABLE farm_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farm_batches_user" ON farm_batches FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "farm_transactions_user" ON farm_transactions FOR ALL USING (auth.uid() = user_id);
