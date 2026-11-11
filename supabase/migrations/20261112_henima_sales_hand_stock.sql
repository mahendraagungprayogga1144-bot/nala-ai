-- Stok di tangan sales: ambil dari gudang → jual potong stok sales (bukan gudang lagi).

CREATE TABLE IF NOT EXISTS public.module_sales_hand_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  sales_id UUID NOT NULL REFERENCES public.module_sales_staff(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, sales_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_henima_hand_stock_sales
  ON public.module_sales_hand_stock (business_id, sales_id);

CREATE TABLE IF NOT EXISTS public.module_sales_stock_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  sales_id UUID NOT NULL REFERENCES public.module_sales_staff(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  qty NUMERIC NOT NULL CHECK (qty > 0),
  direction TEXT NOT NULL CHECK (direction IN ('issue', 'return')),
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_henima_stock_issues_biz
  ON public.module_sales_stock_issues (business_id, created_at DESC);

ALTER TABLE public.module_sales_hand_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sales_stock_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS henima_hand_stock_deny ON public.module_sales_hand_stock;
CREATE POLICY henima_hand_stock_deny ON public.module_sales_hand_stock FOR ALL USING (false);

DROP POLICY IF EXISTS henima_stock_issues_deny ON public.module_sales_stock_issues;
CREATE POLICY henima_stock_issues_deny ON public.module_sales_stock_issues FOR ALL USING (false);

COMMENT ON TABLE public.module_sales_hand_stock IS 'Qty barang yang dibawa sales dari gudang.';
COMMENT ON TABLE public.module_sales_stock_issues IS 'Log ambil/kembali stok gudang ↔ sales.';
