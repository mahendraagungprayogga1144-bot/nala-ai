-- HENIMA AI Master Mentor Phase 5 — Decision & Approval Execution layer.
-- Additive only. Owner-scoped. No automatic external side effects without approval.

CREATE TABLE IF NOT EXISTS public.module_master_mentor_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.module_master_mentor_businesses(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.module_master_mentor_conversations(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL
    CHECK (action_type IN (
      'note_recommendation',
      'record_decision',
      'record_strategy',
      'record_learning',
      'financial_memory_write',
      'memory_candidate_promote',
      'inventory_restock_plan',
      'sales_followup_plan',
      'external_message_draft'
    )),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  business_context TEXT NOT NULL DEFAULT '',
  expected_impact TEXT NOT NULL DEFAULT '',
  risk_level TEXT NOT NULL DEFAULT 'medium'
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  requested_permissions TEXT[] NOT NULL DEFAULT ARRAY['WRITE']::TEXT[],
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'mentor'
    CHECK (source IN ('mentor', 'owner', 'system', 'intelligence')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'approved', 'rejected', 'expired', 'executed', 'failed', 'cancelled'
    )),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT NOT NULL DEFAULT '',
  executed_at TIMESTAMPTZ,
  execution_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_actions_owner_status
  ON public.module_master_mentor_actions (owner_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mm_actions_owner_biz
  ON public.module_master_mentor_actions (owner_user_id, business_id, created_at DESC);

ALTER TABLE public.module_master_mentor_actions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_actions_owner"
    ON public.module_master_mentor_actions
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.module_master_mentor_action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES public.module_master_mentor_actions(id) ON DELETE CASCADE,
  attempt INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  detail TEXT NOT NULL DEFAULT '',
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_action_exec_owner
  ON public.module_master_mentor_action_executions (owner_user_id, created_at DESC);

ALTER TABLE public.module_master_mentor_action_executions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_action_exec_owner"
    ON public.module_master_mentor_action_executions
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
