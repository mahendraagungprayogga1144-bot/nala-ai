-- HENIMA AI Master Mentor Phase 7 — Bounded Autonomous Business Assistant.
-- Additive only. Default autonomy = 0 (read-only). Emergency stop available.
-- Level 2 actions still go through Phase 5 Approval Center (one approval ≠ blanket).

-- Owner autonomy settings (per owner; optional per-business override later)
CREATE TABLE IF NOT EXISTS public.module_master_mentor_autonomy_settings (
  owner_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  autonomy_level INT NOT NULL DEFAULT 0
    CHECK (autonomy_level IN (0, 1, 2, 3)),
  emergency_stop BOOLEAN NOT NULL DEFAULT false,
  allowed_level3_tools TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  max_concurrent_tasks INT NOT NULL DEFAULT 3 CHECK (max_concurrent_tasks BETWEEN 1 AND 20),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.module_master_mentor_autonomy_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_autonomy_settings_owner"
    ON public.module_master_mentor_autonomy_settings
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Autonomous tasks
CREATE TABLE IF NOT EXISTS public.module_master_mentor_auto_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.module_master_mentor_businesses(id) ON DELETE SET NULL,
  goal TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  risk_level TEXT NOT NULL DEFAULT 'medium'
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  permission_level INT NOT NULL DEFAULT 0
    CHECK (permission_level IN (0, 1, 2, 3)),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'planning', 'waiting_approval', 'approved', 'executing',
      'verifying', 'completed', 'rejected', 'failed', 'cancelled', 'paused', 'expired'
    )),
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error_log TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL,
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_mm_auto_tasks_owner_status
  ON public.module_master_mentor_auto_tasks (owner_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mm_auto_tasks_owner_biz
  ON public.module_master_mentor_auto_tasks (owner_user_id, business_id, created_at DESC);

ALTER TABLE public.module_master_mentor_auto_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_auto_tasks_owner"
    ON public.module_master_mentor_auto_tasks
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task steps
CREATE TABLE IF NOT EXISTS public.module_master_mentor_auto_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.module_master_mentor_auto_tasks(id) ON DELETE CASCADE,
  step_index INT NOT NULL CHECK (step_index >= 0),
  title TEXT NOT NULL,
  tool_name TEXT NOT NULL DEFAULT '',
  specialist TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'running', 'waiting_approval', 'completed', 'failed', 'skipped', 'cancelled'
    )),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  error_log TEXT NOT NULL DEFAULT '',
  linked_action_id UUID REFERENCES public.module_master_mentor_actions(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_mm_auto_steps_task
  ON public.module_master_mentor_auto_steps (task_id, step_index);

ALTER TABLE public.module_master_mentor_auto_steps ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_auto_steps_owner"
    ON public.module_master_mentor_auto_steps
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tool invocation log (audit of registry calls)
CREATE TABLE IF NOT EXISTS public.module_master_mentor_tool_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.module_master_mentor_auto_tasks(id) ON DELETE SET NULL,
  step_id UUID REFERENCES public.module_master_mentor_auto_steps(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  permission_level INT NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'blocked', 'skipped')),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_tool_runs_owner
  ON public.module_master_mentor_tool_runs (owner_user_id, created_at DESC);

ALTER TABLE public.module_master_mentor_tool_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_tool_runs_owner"
    ON public.module_master_mentor_tool_runs
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Emergency stop event log
CREATE TABLE IF NOT EXISTS public.module_master_mentor_emergency_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cleared_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mm_emergency_owner
  ON public.module_master_mentor_emergency_stops (owner_user_id, created_at DESC);

ALTER TABLE public.module_master_mentor_emergency_stops ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_emergency_owner"
    ON public.module_master_mentor_emergency_stops
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
