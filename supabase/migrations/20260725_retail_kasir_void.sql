-- Fix: products.id di production sering BIGINT/serial (bukan UUID).
-- order_items.product_id harus TEXT supaya terima "14" maupun UUID.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

ALTER TABLE public.order_items DROP COLUMN IF EXISTS product_id;
ALTER TABLE public.order_items ADD COLUMN product_id TEXT;

CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(business_id, status, order_date);

NOTIFY pgrst, 'reload schema';
