-- Account snapshot dari MT5 (DEMO/REAL account-agnostic).
-- Trading Brain tidak berubah; hanya audit + dashboard + margin gate.

ALTER TABLE trading_ai_execution_control
  ADD COLUMN IF NOT EXISTS last_account_broker TEXT,
  ADD COLUMN IF NOT EXISTS last_account_server TEXT,
  ADD COLUMN IF NOT EXISTS last_account_currency TEXT,
  ADD COLUMN IF NOT EXISTS last_account_balance DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_account_equity DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_account_free_margin DOUBLE PRECISION;
