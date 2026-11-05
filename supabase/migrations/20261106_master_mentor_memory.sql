-- HENIMA AI Business Master Mentor — Phase 2 Business Memory Engine.
-- Additive only. No DROP. Owner-scoped via auth.uid() / portfolio ownership.

-- ── Extend portfolio businesses with Business Memory profile fields ──────────
ALTER TABLE public.module_master_mentor_businesses
  ADD COLUMN IF NOT EXISTS business_model TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS products_services TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_customers TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sales_channels TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS operational_structure TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_goals TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_challenges TEXT NOT NULL DEFAULT '';

-- ── Owner Memory (1 row per owner) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_master_mentor_owner_memory (
  owner_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_vision TEXT NOT NULL DEFAULT '',
  long_term_goals TEXT NOT NULL DEFAULT '',
  communication_style TEXT NOT NULL DEFAULT '',
  decision_preferences TEXT NOT NULL DEFAULT '',
  business_philosophy TEXT NOT NULL DEFAULT '',
  risk_tolerance TEXT NOT NULL DEFAULT '',
  working_preferences TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.module_master_mentor_owner_memory ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_owner_memory_owner"
    ON public.module_master_mentor_owner_memory
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Financial Memory ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_master_mentor_financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.module_master_mentor_businesses(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL
    CHECK (metric_type IN (
      'revenue','cogs','gross_profit','operating_expenses','net_profit',
      'cash_inflow','cash_outflow','cash_balance','investment','debt_liabilities'
    )),
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  transaction_date DATE NOT NULL,
  transaction_category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  data_source TEXT NOT NULL DEFAULT 'owner_entry'
    CHECK (data_source IN ('owner_entry','import','system','mentor_candidate_approved')),
  certainty TEXT NOT NULL DEFAULT 'actual'
    CHECK (certainty IN ('actual','estimate','projection')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_fin_owner_biz_date
  ON public.module_master_mentor_financial_records (owner_user_id, business_id, transaction_date DESC);

ALTER TABLE public.module_master_mentor_financial_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_financial_owner"
    ON public.module_master_mentor_financial_records
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Decision Memory ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_master_mentor_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.module_master_mentor_businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reasoning TEXT NOT NULL DEFAULT '',
  alternatives TEXT NOT NULL DEFAULT '',
  expected_outcome TEXT NOT NULL DEFAULT '',
  risks TEXT NOT NULL DEFAULT '',
  decision_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','accepted','rejected','in_progress','completed','revisited')),
  actual_outcome TEXT NOT NULL DEFAULT '',
  review_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_decisions_owner_biz
  ON public.module_master_mentor_decisions (owner_user_id, business_id, decision_date DESC);

ALTER TABLE public.module_master_mentor_decisions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_decisions_owner"
    ON public.module_master_mentor_decisions
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Strategic Memory ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_master_mentor_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.module_master_mentor_businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  business_strategy TEXT NOT NULL DEFAULT '',
  short_term_targets TEXT NOT NULL DEFAULT '',
  medium_term_targets TEXT NOT NULL DEFAULT '',
  long_term_targets TEXT NOT NULL DEFAULT '',
  growth_plans TEXT NOT NULL DEFAULT '',
  expansion_plans TEXT NOT NULL DEFAULT '',
  marketing_strategies TEXT NOT NULL DEFAULT '',
  operational_strategies TEXT NOT NULL DEFAULT '',
  milestones TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','completed','paused','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_strategies_owner_biz
  ON public.module_master_mentor_strategies (owner_user_id, business_id, updated_at DESC);

ALTER TABLE public.module_master_mentor_strategies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_strategies_owner"
    ON public.module_master_mentor_strategies
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Learning Memory ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_master_mentor_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.module_master_mentor_businesses(id) ON DELETE CASCADE,
  related_decision_id UUID REFERENCES public.module_master_mentor_decisions(id) ON DELETE SET NULL,
  lesson TEXT NOT NULL,
  evidence TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'owner_entry'
    CHECK (source IN ('owner_entry','decision_review','mentor_candidate_approved')),
  recorded_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_learnings_owner_biz
  ON public.module_master_mentor_learnings (owner_user_id, business_id, recorded_date DESC);

ALTER TABLE public.module_master_mentor_learnings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_learnings_owner"
    ON public.module_master_mentor_learnings
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Memory candidates (Automatic Memory foundation — requires owner approval) ─
CREATE TABLE IF NOT EXISTS public.module_master_mentor_memory_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.module_master_mentor_businesses(id) ON DELETE CASCADE,
  memory_kind TEXT NOT NULL
    CHECK (memory_kind IN ('owner','business','financial','decision','strategy','learning')),
  classification TEXT NOT NULL DEFAULT 'assumption'
    CHECK (classification IN ('fact','preference','assumption','recommendation')),
  proposed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','corrected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_mm_candidates_owner_status
  ON public.module_master_mentor_memory_candidates (owner_user_id, status, created_at DESC);

ALTER TABLE public.module_master_mentor_memory_candidates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_candidates_owner"
    ON public.module_master_mentor_memory_candidates
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Audit log (create / update / delete) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_master_mentor_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','delete','approve','reject','correct')),
  summary TEXT NOT NULL DEFAULT '',
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_audit_owner
  ON public.module_master_mentor_audit_logs (owner_user_id, created_at DESC);

ALTER TABLE public.module_master_mentor_audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_audit_owner"
    ON public.module_master_mentor_audit_logs
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
