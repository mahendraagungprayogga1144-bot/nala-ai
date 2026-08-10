-- Trading AI: DEMO_AUTOTRADE execution control + order journal.
-- Tetap demo-only. Server tidak pernah memanggil API broker; EA satu-satunya eksekutor.
-- Aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS public.trading_ai_execution_control (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Default OFF: autotrade harus dinyalakan manual tiap user.
  autotrade_enabled BOOLEAN NOT NULL DEFAULT false,
  emergency_stop BOOLEAN NOT NULL DEFAULT false,
  -- Saat emergency stop: false = biarkan posisi terbuka, true = perintahkan CLOSE.
  close_all_on_stop BOOLEAN NOT NULL DEFAULT false,
  cooldown_seconds INT NOT NULL DEFAULT 900,
  -- Diisi /api/trading-ai/order-report saat entry benar-benar FILLED.
  last_entry_at TIMESTAMPTZ,
  last_entry_signal_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trading_ai_orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_id TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT 'XAUUSD',
  -- READY | FILLED | FAILED | CLOSED | CLOSE_FAILED
  status TEXT NOT NULL,
  direction TEXT,
  lot DOUBLE PRECISION,
  ticket BIGINT,
  entry_price DOUBLE PRECISION,
  spread DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  account_mode TEXT,
  account_login BIGINT,
  error_code INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trading_ai_orders_user
  ON public.trading_ai_orders(user_id, created_at DESC);

-- Satu signal = maksimal satu percobaan order. Unique index ini menolak
-- attempt kedua untuk signal yang sama walau EA sempat restart.
CREATE UNIQUE INDEX IF NOT EXISTS idx_trading_ai_orders_attempt
  ON public.trading_ai_orders(user_id, signal_id)
  WHERE status IN ('FILLED', 'FAILED');

ALTER TABLE public.trading_ai_execution_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_ai_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trading_ai_execution_control_own" ON public.trading_ai_execution_control;
CREATE POLICY "trading_ai_execution_control_own" ON public.trading_ai_execution_control
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trading_ai_orders_own" ON public.trading_ai_orders;
CREATE POLICY "trading_ai_orders_own" ON public.trading_ai_orders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
