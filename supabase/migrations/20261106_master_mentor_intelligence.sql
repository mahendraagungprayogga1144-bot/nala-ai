-- HENIMA AI Phase 3 — chat persistence + usage tracking.
-- Additive only. Owner-scoped. No DROP.

CREATE TABLE IF NOT EXISTS public.module_master_mentor_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.module_master_mentor_businesses(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New consultation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_conv_owner
  ON public.module_master_mentor_conversations (owner_user_id, updated_at DESC);

ALTER TABLE public.module_master_mentor_conversations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_conversations_owner"
    ON public.module_master_mentor_conversations
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.module_master_mentor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.module_master_mentor_conversations(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL DEFAULT '',
  specialists TEXT[] NOT NULL DEFAULT '{}',
  sources_used TEXT[] NOT NULL DEFAULT '{}',
  missing TEXT[] NOT NULL DEFAULT '{}',
  usage JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_messages_conv
  ON public.module_master_mentor_messages (conversation_id, created_at ASC);

ALTER TABLE public.module_master_mentor_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_messages_owner"
    ON public.module_master_mentor_messages
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.module_master_mentor_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID,
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  specialist TEXT NOT NULL DEFAULT '',
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_usage_owner
  ON public.module_master_mentor_usage_logs (owner_user_id, created_at DESC);

ALTER TABLE public.module_master_mentor_usage_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "master_mentor_usage_owner"
    ON public.module_master_mentor_usage_logs
    FOR ALL USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
