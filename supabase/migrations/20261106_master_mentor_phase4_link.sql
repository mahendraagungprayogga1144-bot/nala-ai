-- HENIMA AI Master Mentor Phase 4 — link portfolio to Gercep businesses.
-- Additive only. Does not mutate operational Gercep tables.

ALTER TABLE public.module_master_mentor_businesses
  ADD COLUMN IF NOT EXISTS gercep_business_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_master_mentor_biz_gercep
  ON public.module_master_mentor_businesses (owner_user_id, gercep_business_id)
  WHERE gercep_business_id IS NOT NULL;

COMMENT ON COLUMN public.module_master_mentor_businesses.gercep_business_id IS
  'Optional FK-like pointer to public.businesses.id for read-only Phase 4 intelligence. No cascade write.';
