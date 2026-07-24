-- Standalone retail AI Kasir (bukan F&B, bukan Keuangan Bisnis sync).
-- Store name + staff PIN login.

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

ALTER TABLE public.kasir_shifts ADD COLUMN IF NOT EXISTS staff_id UUID;
ALTER TABLE public.kasir_shifts ADD COLUMN IF NOT EXISTS staff_name TEXT;

-- Isolate retail POS orders from F&B / other modules
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
