-- Trading AI: heartbeat terpisah untuk EA executor.
--
-- Sebelum ini, ingest (candle push) dan signal (executor) sama-sama menulis
-- trading_ai_bridge_keys.last_seen_at, sehingga satu EA mati tidak terlihat
-- selama EA lainnya masih jalan. Kolom di bawah memisahkan keduanya:
--   feed     -> max(trading_ai_candles.updated_at)
--   executor -> trading_ai_execution_control.last_signal_at
--
-- Read-only terhadap Trading Brain. Tidak ada order. Aman dijalankan ulang.

ALTER TABLE public.trading_ai_execution_control
  ADD COLUMN IF NOT EXISTS last_signal_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_signal_account_mode TEXT,
  ADD COLUMN IF NOT EXISTS last_signal_account_login BIGINT,
  ADD COLUMN IF NOT EXISTS last_signal_decision TEXT;

NOTIFY pgrst, 'reload schema';
