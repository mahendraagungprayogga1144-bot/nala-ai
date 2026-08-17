-- Lot size yang bisa diubah dari dashboard Gercep.
-- Default 0.10. Aman dijalankan ulang.

ALTER TABLE public.trading_ai_execution_control
  ADD COLUMN IF NOT EXISTS lot DOUBLE PRECISION NOT NULL DEFAULT 0.10;

NOTIFY pgrst, 'reload schema';
