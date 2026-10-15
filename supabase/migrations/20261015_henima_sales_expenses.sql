-- Biaya operasional Henima Sales. Additive. Tidak menghapus transaksi penjualan.

CREATE TABLE IF NOT EXISTS public.module_sales_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sales_id UUID REFERENCES public.module_sales_staff(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  note TEXT,
  expense_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sales_expenses_biz_date
  ON public.module_sales_expenses (business_id, expense_date DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.module_sales_expenses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sales_expenses_owner" ON public.module_sales_expenses FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
