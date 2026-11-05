-- HENIMA AI Master Mentor Phase 6 — Automation & Integration engine.
-- Additive only. Owner-scoped. Sensitive sends require Phase 5 approval.

CREATE TABLE IF NOT EXISTS public.module_master_mentor_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.module_master_mentor_businesses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('scheduled', 'data_change', 'business_event', 'manual')),
  schedule_cron TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  require_approval BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_workflows_owner
  ON public.module_master_mentor_workflows (owner_user_id, enabled);

ALTER TABLE public.module_master_mentor_workflows ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_workflows_owner"
    ON public.module_master_mentor_workflows FOR ALL
    USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.module_master_mentor_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.module_master_mentor_workflows(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'failed', 'skipped', 'pending_approval')),
  attempt INT NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  error TEXT,
  result JSONB,
  logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (owner_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_mm_workflow_runs_owner
  ON public.module_master_mentor_workflow_runs (owner_user_id, started_at DESC);

ALTER TABLE public.module_master_mentor_workflow_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_workflow_runs_owner"
    ON public.module_master_mentor_workflow_runs FOR ALL
    USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.module_master_mentor_smart_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.module_master_mentor_businesses(id) ON DELETE SET NULL,
  alert_key TEXT NOT NULL,
  issue TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_action TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'detected' CHECK (kind IN ('detected', 'hypothesis')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acked', 'resolved', 'muted')),
  fingerprint TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notify_count INT NOT NULL DEFAULT 0,
  muted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mm_smart_alerts_fingerprint
  ON public.module_master_mentor_smart_alerts (owner_user_id, fingerprint)
  WHERE status IN ('open', 'muted');

CREATE INDEX IF NOT EXISTS idx_mm_smart_alerts_owner
  ON public.module_master_mentor_smart_alerts (owner_user_id, status, last_seen_at DESC);

ALTER TABLE public.module_master_mentor_smart_alerts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_smart_alerts_owner"
    ON public.module_master_mentor_smart_alerts FOR ALL
    USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.module_master_mentor_integration_settings (
  owner_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_provider TEXT NOT NULL DEFAULT 'none'
    CHECK (whatsapp_provider IN ('none', 'infobip', 'fonnte')),
  whatsapp_notify_owner_only BOOLEAN NOT NULL DEFAULT true,
  shopee_enabled BOOLEAN NOT NULL DEFAULT false,
  shopee_status TEXT NOT NULL DEFAULT 'pending_credentials'
    CHECK (shopee_status IN ('pending_credentials', 'configured', 'disabled')),
  shopee_notes TEXT NOT NULL DEFAULT '',
  sales_automation_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_briefing_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_review_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.module_master_mentor_integration_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_integration_settings_owner"
    ON public.module_master_mentor_integration_settings FOR ALL
    USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.module_master_mentor_message_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'telegram', 'email')),
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  to_address TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'failed', 'cancelled')),
  action_id UUID REFERENCES public.module_master_mentor_actions(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_msg_drafts_owner
  ON public.module_master_mentor_message_drafts (owner_user_id, status, created_at DESC);

ALTER TABLE public.module_master_mentor_message_drafts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_message_drafts_owner"
    ON public.module_master_mentor_message_drafts FOR ALL
    USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
