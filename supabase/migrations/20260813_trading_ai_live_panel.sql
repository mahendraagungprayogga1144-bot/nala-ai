-- Field sinyal untuk panel live di dashboard Otak MetaTrader.
-- Tidak mengubah Trading Brain. Aman dijalankan ulang.

ALTER TABLE public.trading_ai_execution_control
  ADD COLUMN IF NOT EXISTS last_signal_id TEXT,
  ADD COLUMN IF NOT EXISTS last_signal_confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_signal_spread DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_signal_m5_bias TEXT,
  ADD COLUMN IF NOT EXISTS last_signal_m1_direction TEXT,
  ADD COLUMN IF NOT EXISTS last_signal_executable BOOLEAN;

NOTIFY pgrst, 'reload schema';
