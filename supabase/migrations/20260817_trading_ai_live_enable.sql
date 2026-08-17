-- LIVE ENABLE: eksekusi akun REAL butuh izin eksplisit terpisah dari autotrade.
-- Default false. Aman dijalankan ulang.

ALTER TABLE public.trading_ai_execution_control
  ADD COLUMN IF NOT EXISTS live_enable BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
