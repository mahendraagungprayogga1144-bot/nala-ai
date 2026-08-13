-- Simpan jam server broker dari EA supaya dashboard bisa menampilkan
-- waktu yang sama dengan chart MetaTrader 5.
-- Tidak menyentuh Trading Brain. Aman dijalankan ulang.

ALTER TABLE public.trading_ai_execution_control
  ADD COLUMN IF NOT EXISTS last_broker_time BIGINT,
  ADD COLUMN IF NOT EXISTS broker_gmt_offset_sec INT;

NOTIFY pgrst, 'reload schema';
