-- Ensure peternakan farm tables exist (idempotent).
-- Fixes: "Could not find the table 'public.farm_batches' in the schema cache"
-- Run in Supabase SQL Editor on PRODUCTION, then Settings → API → Reload schema (or wait ~1 min).

CREATE TABLE IF NOT EXISTS public.farm_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  nama_batch TEXT NOT NULL,
  jenis_ternak TEXT NOT NULL,
  tanggal_mulai DATE NOT NULL DEFAULT CURRENT_DATE,
  tanggal_selesai DATE,
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.farm_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.farm_batches(id) ON DELETE CASCADE,
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

-- Patch columns if an older/partial table already exists
ALTER TABLE public.farm_batches ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.farm_batches ADD COLUMN IF NOT EXISTS tanggal_selesai DATE;
ALTER TABLE public.farm_batches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aktif';
ALTER TABLE public.farm_transactions ADD COLUMN IF NOT EXISTS keuangan_tx_ids UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_farm_batches_business ON public.farm_batches(business_id);
CREATE INDEX IF NOT EXISTS idx_farm_batches_user ON public.farm_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_farm_transactions_batch ON public.farm_transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_farm_transactions_user ON public.farm_transactions(user_id);

ALTER TABLE public.farm_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "farm_batches_user" ON public.farm_batches
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "farm_transactions_user" ON public.farm_transactions
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
