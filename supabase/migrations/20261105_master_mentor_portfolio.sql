-- HENIMA AI Business Master Mentor — portfolio businesses (Phase 1).
-- Additive only. Owner-scoped via auth.uid() = owner_user_id.

CREATE TABLE IF NOT EXISTS public.module_master_mentor_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  targets TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_mentor_biz_owner
  ON public.module_master_mentor_businesses (owner_user_id, created_at ASC);

ALTER TABLE public.module_master_mentor_businesses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "master_mentor_businesses_owner"
    ON public.module_master_mentor_businesses
    FOR ALL
    USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
