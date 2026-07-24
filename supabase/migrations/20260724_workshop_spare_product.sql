-- Bengkel workshop orders: link spare part to inventory product for auto stock-out on selesai.

ALTER TABLE public.module_workshop_orders
  ADD COLUMN IF NOT EXISTS spare_product_id UUID;

ALTER TABLE public.module_workshop_orders
  ADD COLUMN IF NOT EXISTS spare_qty NUMERIC DEFAULT 0;
