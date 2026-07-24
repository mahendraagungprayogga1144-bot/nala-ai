-- Align transactions.type with Gercep app contract (pemasukan | pengeluaran).
-- Fixes: "violates check constraint transactions_type_check" on Kasir F&B / chat / inventory sales.
-- Run in Supabase SQL Editor on PRODUCTION, then hard-refresh the app.

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('pemasukan', 'pengeluaran'));

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE;
