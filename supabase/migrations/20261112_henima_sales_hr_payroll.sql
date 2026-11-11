-- HR & penggajian departemen sales HENIMA (tanggal masuk, gaji pokok, jadwal gaji, slip).

ALTER TABLE public.module_sales_staff
  ADD COLUMN IF NOT EXISTS joined_at DATE,
  ADD COLUMN IF NOT EXISTS base_salary NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pay_day INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS employment_note TEXT;

COMMENT ON COLUMN public.module_sales_staff.joined_at IS 'Tanggal masuk kerja sales.';
COMMENT ON COLUMN public.module_sales_staff.base_salary IS 'Gaji pokok bulanan (Rp).';
COMMENT ON COLUMN public.module_sales_staff.pay_day IS 'Tanggal gajian tiap bulan (1-28). Default 25.';

CREATE TABLE IF NOT EXISTS public.module_sales_hr_bonus_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- target_pct: bonus jika pencapaian target >= min_achievement_pct
  kind TEXT NOT NULL DEFAULT 'target_pct' CHECK (kind IN ('target_pct', 'fixed')),
  min_achievement_pct NUMERIC NOT NULL DEFAULT 100,
  bonus_amount NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_henima_hr_bonus_biz
  ON public.module_sales_hr_bonus_rules (business_id, active);

CREATE TABLE IF NOT EXISTS public.module_sales_hr_payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  period_ym TEXT NOT NULL, -- YYYY-MM
  pay_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'paid', 'void')),
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, period_ym)
);

CREATE INDEX IF NOT EXISTS idx_henima_hr_payroll_runs_biz
  ON public.module_sales_hr_payroll_runs (business_id, period_ym DESC);

CREATE TABLE IF NOT EXISTS public.module_sales_hr_payroll_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.module_sales_hr_payroll_runs(id) ON DELETE CASCADE,
  business_id UUID NOT NULL,
  sales_id UUID NOT NULL REFERENCES public.module_sales_staff(id) ON DELETE CASCADE,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  commission NUMERIC NOT NULL DEFAULT 0,
  target_bonus NUMERIC NOT NULL DEFAULT 0,
  deduction NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  achievement_pct NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, sales_id)
);

CREATE INDEX IF NOT EXISTS idx_henima_hr_payroll_lines_run
  ON public.module_sales_hr_payroll_lines (run_id);

ALTER TABLE public.module_sales_hr_bonus_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sales_hr_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sales_hr_payroll_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS henima_hr_bonus_deny ON public.module_sales_hr_bonus_rules;
CREATE POLICY henima_hr_bonus_deny ON public.module_sales_hr_bonus_rules FOR ALL USING (false);

DROP POLICY IF EXISTS henima_hr_runs_deny ON public.module_sales_hr_payroll_runs;
CREATE POLICY henima_hr_runs_deny ON public.module_sales_hr_payroll_runs FOR ALL USING (false);

DROP POLICY IF EXISTS henima_hr_lines_deny ON public.module_sales_hr_payroll_lines;
CREATE POLICY henima_hr_lines_deny ON public.module_sales_hr_payroll_lines FOR ALL USING (false);
