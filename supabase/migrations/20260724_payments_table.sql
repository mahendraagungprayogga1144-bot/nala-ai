-- Ensure payments table exists for Upgrade invoice flow.
-- Fixes: "Could not find the table 'public.payments' in the schema cache"
-- Run in Supabase SQL Editor on PRODUCTION, then Settings → API → Reload schema (or wait ~1 min).

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  invoice_id TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "payments_own" ON public.payments
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
