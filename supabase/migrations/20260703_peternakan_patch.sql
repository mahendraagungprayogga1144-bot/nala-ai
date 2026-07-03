-- Patch: kolom yang mungkin belum ada di farm_batches / farm_transactions lama

ALTER TABLE farm_batches ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE farm_batches ADD COLUMN IF NOT EXISTS tanggal_selesai DATE;
ALTER TABLE farm_batches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aktif';

ALTER TABLE farm_transactions ADD COLUMN IF NOT EXISTS keuangan_tx_ids UUID[] DEFAULT '{}';
