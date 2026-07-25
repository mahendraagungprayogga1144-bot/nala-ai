-- Standalone retail AI Kasir (bukan F&B, bukan Keuangan Bisnis sync).
-- Store name + staff PIN login.
-- Creates kasir_shifts if missing (older prod DBs may not have it).

CREATE TABLE IF NOT EXISTS public.kasir_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  modal_awal NUMERIC DEFAULT 0,
  total_transaksi NUMERIC DEFAULT 0,
  total_order INT DEFAULT 0,
  kas_akhir NUMERIC DEFAULT 0,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'open',
  staff_id UUID,
  staff_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_kasir_shifts_business ON public.kasir_shifts(business_id);
CREATE INDEX IF NOT EXISTS idx_kasir_shifts_user ON public.kasir_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_kasir_shifts_status ON public.kasir_shifts(status);

ALTER TABLE public.kasir_shifts ADD COLUMN IF NOT EXISTS staff_id UUID;
ALTER TABLE public.kasir_shifts ADD COLUMN IF NOT EXISTS staff_name TEXT;

ALTER TABLE public.kasir_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kasir_shifts_own" ON public.kasir_shifts;
CREATE POLICY "kasir_shifts_own" ON public.kasir_shifts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.retail_kasir_settings (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  store_name TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.retail_kasir_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  nama TEXT NOT NULL,
  pin TEXT NOT NULL,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retail_kasir_staff_biz ON public.retail_kasir_staff(business_id);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_source_date ON public.orders(business_id, source, order_date);

ALTER TABLE public.retail_kasir_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_kasir_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retail_kasir_settings_own" ON public.retail_kasir_settings;
CREATE POLICY "retail_kasir_settings_own" ON public.retail_kasir_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "retail_kasir_staff_own" ON public.retail_kasir_staff;
CREATE POLICY "retail_kasir_staff_own" ON public.retail_kasir_staff
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
