-- Trading AI: MT5 read-only candle ingest (EA push).
-- No live orders. Aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS public.trading_ai_bridge_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'MT5 EA',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trading_ai_bridge_keys_user
  ON public.trading_ai_bridge_keys(user_id);

CREATE INDEX IF NOT EXISTS idx_trading_ai_bridge_keys_key
  ON public.trading_ai_bridge_keys(api_key)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.trading_ai_candles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL DEFAULT 'XAUUSD',
  timeframe TEXT NOT NULL CHECK (timeframe IN ('M1', 'M5')),
  bar_time BIGINT NOT NULL,
  open DOUBLE PRECISION NOT NULL,
  high DOUBLE PRECISION NOT NULL,
  low DOUBLE PRECISION NOT NULL,
  close DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'mt5_ea',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol, timeframe, bar_time)
);

CREATE INDEX IF NOT EXISTS idx_trading_ai_candles_lookup
  ON public.trading_ai_candles(user_id, symbol, timeframe, bar_time DESC);

ALTER TABLE public.trading_ai_bridge_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_ai_candles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trading_ai_bridge_keys_own" ON public.trading_ai_bridge_keys;
CREATE POLICY "trading_ai_bridge_keys_own" ON public.trading_ai_bridge_keys
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trading_ai_candles_own" ON public.trading_ai_candles;
CREATE POLICY "trading_ai_candles_own" ON public.trading_ai_candles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
