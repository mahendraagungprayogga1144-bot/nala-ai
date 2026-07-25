-- AI Kasir: jenis struk menyesuaikan usaha (toko / cafe / jasa / umum).

ALTER TABLE public.retail_kasir_settings
  ADD COLUMN IF NOT EXISTS receipt_style TEXT NOT NULL DEFAULT 'toko';

ALTER TABLE public.retail_kasir_settings
  ADD COLUMN IF NOT EXISTS receipt_note TEXT;

ALTER TABLE public.retail_kasir_settings
  ADD COLUMN IF NOT EXISTS receipt_address TEXT;

NOTIFY pgrst, 'reload schema';
