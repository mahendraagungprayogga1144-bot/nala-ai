-- P2 AI Kasir: void support + ensure order_items.product_id for stock restore

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_id UUID;

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(business_id, status, order_date);

NOTIFY pgrst, 'reload schema';
